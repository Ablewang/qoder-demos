import { createHash } from 'node:crypto';
import { ContractError, STREAM_RETENTION } from '../contracts/index.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { NoticeRecord, StorageService, StreamEvent } from '../contracts/index.ts';

export function noticeSummary(record: NoticeRecord): NoticeRecord {
  if (record.notice.sensitivity !== 'secret') return structuredClone(record);
  return { ...record, notice: { ...record.notice, title: '一条机密通知', facts: [], evidence: [], body: undefined, why: undefined, nextStep: undefined, links: undefined } };
}

export interface EventHub {
  emit(event: StreamEvent): void;
  connect(req: IncomingMessage, res: ServerResponse): void;
  prune(): void;
  stop(): void;
  seq(): number;
  eraseReminderOriginal(noticeId: string): void;
}

export function createEventHub(deps: { storage: StorageService; now(): number; maxEvents?: number; maxAgeMs?: number; heartbeatMs?: number }): EventHub {
  const sql = 'CREATE TABLE ui_events (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, type TEXT NOT NULL, data_json TEXT NOT NULL); CREATE INDEX ui_events_at ON ui_events(at);';
  deps.storage.registerMigrations('surfaces.events', ['ui_'], [{ version: 1, checksum: createHash('sha256').update(sql).digest('hex'), apply: (tx) => { tx.run(sql); } }]);
  const clients = new Map<ServerResponse, NodeJS.Timeout>();
  const seq = () => deps.storage.transaction((tx) => Number(tx.get("SELECT seq FROM sqlite_sequence WHERE name = 'ui_events'")?.seq ?? 0));
  const frame = (event: StreamEvent, id?: number) => `${id === undefined ? '' : `id: ${id}\n`}event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  const prune = () => deps.storage.transaction((tx) => {
    tx.run('DELETE FROM ui_events WHERE at < ? OR id <= ?', [deps.now() - (deps.maxAgeMs ?? STREAM_RETENTION.maxAgeMs), seq() - (deps.maxEvents ?? STREAM_RETENTION.maxEvents)]);
  });
  const write = (res: ServerResponse, content: string) => {
    if (res.writableLength > 1024 * 1024) { res.destroy(); return; }
    res.write(content);
  };
  const api: EventHub = {
    seq,
    prune,
    eraseReminderOriginal(noticeId) {
      deps.storage.transaction((tx) => {
        for (const row of tx.all("SELECT id, type, data_json FROM ui_events WHERE type IN ('notice.created', 'notice.updated', 'pet.utterance')")) {
          const data = JSON.parse(String(row.data_json)) as Record<string, unknown>;
          if (row.type === 'pet.utterance') {
            const utterance = data.utterance as { ref?: { noticeId?: string }; facts?: Array<{ label: string }> };
            if (utterance.ref?.noticeId === noticeId && utterance.facts) utterance.facts = utterance.facts.filter((fact) => fact.label !== '原话'); else continue;
          } else {
            const notice = data.notice as NoticeRecord;
            if (notice.id !== noticeId) continue;
            notice.notice.facts = notice.notice.facts.filter((fact) => fact.label !== '原话');
          }
          tx.run('UPDATE ui_events SET data_json = ? WHERE id = ?', [JSON.stringify(data), row.id]);
        }
      });
    },
    emit(event) {
      if (['hello', 'resync_required', 'bye'].includes(event.type)) {
        for (const res of clients.keys()) write(res, frame(event));
        return;
      }
      const safe = event.type === 'notice.created' || event.type === 'notice.updated' ? { ...event, data: { notice: noticeSummary(event.data.notice) } } : event;
      const id = deps.storage.transaction((tx) => {
        if (safe.type === 'reminder.changed' && safe.data.reminder.status === 'cancelled') {
          const rows = tx.all("SELECT id, data_json FROM ui_events WHERE type = 'reminder.changed'");
          for (const row of rows) {
            const data = JSON.parse(String(row.data_json)) as { reminder: { id: string; text: string } };
            if (data.reminder.id === safe.data.reminder.id) { data.reminder.text = ''; tx.run('UPDATE ui_events SET data_json = ? WHERE id = ?', [JSON.stringify(data), row.id]); }
          }
        }
        tx.run('INSERT INTO ui_events (at, type, data_json) VALUES (?, ?, ?)', [deps.now(), safe.type, JSON.stringify(safe.data)]);
        return Number(tx.get('SELECT last_insert_rowid() AS id')!.id);
      });
      prune();
      for (const res of clients.keys()) write(res, frame(safe, id));
    },
    connect(req, res) {
      const last = req.headers['last-event-id'];
      if (Array.isArray(last) || (last !== undefined && !/^\d+$/.test(last)) || (last !== undefined && !Number.isSafeInteger(Number(last)))) throw new ContractError('bad_request', 'invalid event checkpoint');
      prune();
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write(`retry: ${STREAM_RETENTION.retryMs}\n\n`);
      const current = seq();
      if (last === undefined) res.write(frame({ type: 'hello', data: { seq: current } }, current));
      else {
        const oldest = deps.storage.transaction((tx) => tx.get('SELECT MIN(id) AS id FROM ui_events'))?.id;
        if (Number(last) > current || (oldest === null ? Number(last) < current : Number(last) < Number(oldest) - 1)) res.write(frame({ type: 'resync_required', data: {} }, current));
        else {
          const rows = deps.storage.transaction((tx) => tx.all('SELECT id, type, data_json FROM ui_events WHERE id > ? ORDER BY id', [Number(last)]));
          for (const row of rows) res.write(`id: ${row.id}\nevent: ${row.type}\ndata: ${row.data_json}\n\n`);
        }
      }
      const heartbeat = setInterval(() => { write(res, ': ping\n\n'); }, deps.heartbeatMs ?? STREAM_RETENTION.heartbeatMs);
      heartbeat.unref(); clients.set(res, heartbeat);
      res.on('close', () => { clearInterval(heartbeat); clients.delete(res); });
    },
    stop() {
      for (const [res, heartbeat] of clients) { clearInterval(heartbeat); res.end(frame({ type: 'bye', data: {} })); }
      clients.clear();
    },
  };
  return api;
}
