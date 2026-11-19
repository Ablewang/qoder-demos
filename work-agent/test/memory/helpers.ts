import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMemoryModule } from '../../src/memory/index.ts';
import type { AuditRecord, Logger, Migration, SqlValue, StorageService, Tx } from '../../src/contracts/platform.ts';
import type { MemoryChange, MemoryModuleDeps, UserEvidenceType } from '../../src/contracts/memory.ts';

export class TestStorage implements StorageService {
  db: DatabaseSync;
  readonly registrations: Array<{ moduleId: string; prefixes: string[] }> = [];
  readonly statements: string[] = [];
  private readonly versions = new Map<string, string>();
  private transactionDepth = 0;

  private readonly path: string;

  constructor(path = ':memory:') { this.path = path; this.db = new DatabaseSync(path); }

  reopen(): void {
    if (this.path === ':memory:') throw new Error('reopen requires a disk-backed test database');
    this.db.close();
    this.db = new DatabaseSync(this.path);
    // The storage service owns migration bookkeeping; preserve it across connection reopen.
  }

  transaction<T>(work: (tx: Tx) => T): T {
    if (this.transactionDepth) throw new Error('nested test transactions are not supported');
    const tx: Tx = {
      run: (sql, params = []) => {
        this.statements.push(sql);
        return { changes: Number(this.db.prepare(sql).run(...params).changes) };
      },
      get: (sql, params = []) => {
        this.statements.push(sql);
        return this.db.prepare(sql).get(...params) as Record<string, SqlValue> | undefined;
      },
      all: (sql, params = []) => {
        this.statements.push(sql);
        return this.db.prepare(sql).all(...params) as Array<Record<string, SqlValue>>;
      },
    };
    this.db.exec('BEGIN IMMEDIATE');
    this.transactionDepth++;
    try {
      const result = work(tx);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    } finally { this.transactionDepth--; }
  }

  registerMigrations(moduleId: string, prefixes: string[], migrations: Migration[]): void {
    this.registrations.push({ moduleId, prefixes });
    for (const migration of migrations) {
      const key = `${moduleId}:${migration.version}`;
      const existing = this.versions.get(key);
      if (existing && existing !== migration.checksum) throw new Error('migration checksum changed');
      if (existing) continue;
      this.transaction((tx) => {
        const guarded: Tx = {
          ...tx,
          run(sql, params) {
            const tables = sql.matchAll(/CREATE\s+(?:VIRTUAL\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w]+)/gi);
            for (const match of tables) if (!prefixes.some((p) => match[1].startsWith(p))) throw new Error('unowned table');
            return tx.run(sql, params);
          },
        };
        migration.apply(guarded);
      });
      this.versions.set(key, migration.checksum);
    }
  }

  close(): void { this.db.close(); }
}

export function fixture({ persistent = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'tuanzi-memory-'));
  const companionDir = join(dir, 'companion');
  mkdirSync(companionDir);
  const storage = new TestStorage(persistent ? join(dir, 'memory.sqlite') : ':memory:');
  const audit: AuditRecord[] = [];
  const changes: MemoryChange[] = [];
  const logs: Array<{ level: string; event: string; fields?: Record<string, unknown> }> = [];
  const progress: Array<Parameters<NonNullable<MemoryModuleDeps['progress']>>[0]> = [];
  const verifications: Array<{ id: string; type: UserEvidenceType }> = [];
  const valid = new Map<string, UserEvidenceType>([['ev_message', 'message'], ['ev_edit', 'local_edit'], ['ev_decision', 'decision']]);
  let serial = 0;
  let time = Date.UTC(2026, 10, 19, 2, 0, 0);
  const log: Logger = {
    info: (event, fields) => logs.push({ level: 'info', event, fields }),
    warn: (event, fields) => logs.push({ level: 'warn', event, fields }),
    error: (event, fields) => logs.push({ level: 'error', event, fields }),
  };
  const deps: MemoryModuleDeps = {
    storage, companionDir, log, audit: { append: (record) => audit.push(structuredClone(record)) },
    evidence: { verify(id, type) { verifications.push({ id, type }); return valid.get(id) === type; } },
    now: () => time, newId: (prefix) => `${prefix}_${++serial}`,
    onChange: (change) => changes.push(change), progress: (p) => progress.push(p),
  };
  const memory = createMemoryModule(deps);
  memory.start();
  return {
    dir, companionDir, storage, deps, memory, audit, changes, logs, progress, valid, verifications,
    now: () => time, advance: (ms: number) => { time += ms; },
    cleanup: () => { memory.stop(); storage.close(); rmSync(dir, { recursive: true, force: true }); },
  };
}
