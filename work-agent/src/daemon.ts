import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { ContractError, KEYCHAIN_TOKEN_ACCOUNT, LOCAL_API_PROTOCOL } from './contracts/index.ts';
import type { CreateMemoryModule, Logger, MemoryChange, SecretStore, PetState, DaemonInfo } from './contracts/index.ts';
import { loadConfig } from './platform/config.ts';
import type { DaemonConfig } from './platform/config.ts';
import { acquireLock, writeDaemonInfo, removeDaemonInfo } from './platform/files.ts';
import { SqliteStorage } from './platform/storage.ts';
import { createSecretStore } from './platform/secrets.ts';
import { createLogger } from './platform/logger.ts';
import { createAuditWriter } from './platform/audit.ts';
import { newId, randomToken } from './platform/ids.ts';
import { createEvidenceRegistry } from './surfaces/evidence.ts';
import { createEventHub } from './surfaces/events.ts';
import { createHttpSurface } from './surfaces/http.ts';
import { createMemoryModule } from './memory/index.ts';
import { createNoticeStore } from './runtime/notices.ts';
import { createReminderStore } from './runtime/reminders.ts';
import { createCompanionModule } from './companion/index.ts';
import type { CompanionModule } from './companion/index.ts';

export async function startDaemon(options: { config?: DaemonConfig; secrets?: SecretStore; log?: Logger; now?: () => number; memoryFactory?: CreateMemoryModule; eventRetention?: number; random?: () => number } = {}) {
  const config = options.config ?? loadConfig();
  const now = options.now ?? Date.now;
  const startedAt = now();
  const release = acquireLock(config.runDir);
  const log = options.log ?? createLogger(config.logToFile ? { file: path.join(config.runDir, 'daemon.log') } : {});
  let storage: SqliteStorage | undefined;
  let cleanup: (() => Promise<void>) | undefined;
  try {
    storage = new SqliteStorage(config.dbPath);
    const audit = createAuditWriter(storage);
    const secrets = options.secrets ?? createSecretStore();
    let token = await secrets.get(KEYCHAIN_TOKEN_ACCOUNT);
    if (token === undefined) {
      token = randomToken(); await secrets.set(KEYCHAIN_TOKEN_ACCOUNT, token);
      if (await secrets.get(KEYCHAIN_TOKEN_ACCOUNT) !== token) throw new ContractError('internal', 'credential write verification failed');
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(token) || Buffer.from(token, 'base64url').length !== 32) throw new ContractError('internal', 'invalid local API credential');
    const id = (prefix: string) => newId(prefix, now());
    const evidence = createEvidenceRegistry({ storage, now, newId: id });
    const events = createEventHub({ storage, now, maxEvents: options.eventRetention });
    mkdirSync(config.companionDir, { recursive: true, mode: 0o700 });
    let companion: CompanionModule | undefined;
    const pending: MemoryChange[] = [];
    let reportIssue: ((change: Extract<MemoryChange, { change: 'issue' }>) => void) | undefined;
    let pendingProgress: PetState['progress'] | null = null;
    const memory = (options.memoryFactory ?? createMemoryModule)({ storage, audit, log, evidence, companionDir: config.companionDir, now, newId: id, onChange(change) {
      if (change.change === 'issue') { if (reportIssue) reportIssue(change); else pending.push(change); }
      else {
        events.emit({ type: 'memory.changed', data: change });
        if ('layer' in change && change.layer !== 'journal' && ['created', 'updated', 'forgotten'].includes(change.change)) companion?.onMemoryChange(change.change);
      }
    }, progress(value) { pendingProgress = value; companion?.progress(value); } });
    memory.start();
    const notices = createNoticeStore({ storage, now, newId: id, acceptDev: () => companion?.settings().acceptDevNotices ?? true, memorySensitivity: (id) => memory.get(id)?.sensitivity, onChange(record, created) { events.emit({ type: created ? 'notice.created' : 'notice.updated', data: { notice: record } }); }, onAction(action) { companion?.onNoticeAction(action); } });
    const reminders = createReminderStore({ storage, notices, now, newId: id, onChange(reminder) { events.emit({ type: 'reminder.changed', data: { reminder } }); }, eraseNoticeOriginal: (noticeId) => { try { notices.eraseReminderOriginal(noticeId); } catch (error) { if (!(error instanceof ContractError) || error.code !== 'not_found') throw error; } events.eraseReminderOriginal(noticeId); }, onError: () => log.error('reminder.schedule_failed') });
    companion = createCompanionModule({ storage, audit, memory, notices, reminders, companionDir: config.companionDir, now, newId: id, registerMessage: () => evidence.register('message'), emit: (event) => events.emit(event), random: options.random, onError: () => log.error('companion.delivery_failed') });
    companion.progress(pendingProgress);
    notices.setHook((record, delivery) => companion!.onNotice(record, delivery));
    reportIssue = (issue) => {
      events.emit({ type: 'memory.changed', data: { change: 'issue' } });
      void notices.submit({ kind: 'memory.reindex_issue', title: '记忆文件存在无法识别的行', facts: [{ label: '文件', value: issue.file }, ...(issue.line !== undefined ? [{ label: '行号', value: issue.line }] : [])], sensitivity: 'normal', evidence: [], tone: 'concern', urgency: 'low', dedupeKey: `memory.issue:${issue.file}:${issue.line ?? 0}` }, { kind: 'system', component: 'memory' }).catch(() => log.error('memory.issue_delivery_failed'));
    };
    for (const issue of pending) {
      if (issue.change !== 'issue') continue;
      events.emit({ type: 'memory.changed', data: { change: 'issue' } });
      await notices.submit({ kind: 'memory.reindex_issue', title: '记忆文件存在无法识别的行', facts: [{ label: '文件', value: issue.file }, ...(issue.line !== undefined ? [{ label: '行号', value: issue.line }] : [])], sensitivity: 'normal', evidence: [], tone: 'concern', urgency: 'low', dedupeKey: `memory.issue:${issue.file}:${issue.line ?? 0}` }, { kind: 'system', component: 'memory' });
    }
    companion.start(); notices.start(); reminders.start();
    const http = createHttpSurface({ token, origins: config.origins, version: config.version, startedAt, log, companion, memory, notices, reminders, evidence, events, now });
    let stopped = false;
    cleanup = async () => {
      if (stopped) return;
      stopped = true;
      reminders.stop(); notices.stop();
      await http.stop();
      try { companion!.stop(); } catch { log.error('journal.flush_failed'); }
      memory.stop(); storage!.close(); removeDaemonInfo(config.runDir); release();
      log.info('daemon.stopped');
    };
    let port: number;
    try { port = await http.listen(...config.portRange); }
    catch (error) { log.error('daemon.listen_failed', { firstPort: config.portRange[0], lastPort: config.portRange[1], reason: (error as NodeJS.ErrnoException).code === 'EADDRINUSE' ? 'ports_occupied' : 'listen_error' }); throw error; }
    const info: DaemonInfo = { pid: process.pid, port, startedAt, version: config.version, protocol: LOCAL_API_PROTOCOL };
    writeDaemonInfo(config.runDir, info);
    log.info('daemon.started', { port, pid: process.pid });
    return { info, stop: cleanup, config, storage, memory, notices, reminders, companion, evidence, events, http };
  } catch (error) {
    if (cleanup) await cleanup();
    else { storage?.close(); release(); }
    throw error;
  }
}

if (import.meta.main) {
  const log = createLogger();
  let stopping = false;
  try {
    const daemon = await startDaemon();
    const shutdown = () => {
      if (stopping) return;
      stopping = true;
      void daemon.stop().catch(() => { log.error('daemon.shutdown_failed'); process.exitCode = 1; });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    log.error('daemon.start_failed', { code: error instanceof ContractError ? error.code : 'internal' });
    process.exitCode = 1;
  }
}
