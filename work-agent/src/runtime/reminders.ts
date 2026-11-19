import { createHash } from 'node:crypto';
import { assertCredentialFree } from './validation.ts';
import { ContractError } from '../contracts/index.ts';
import type { Reminder, NoticeSink, StorageService, SqlValue } from '../contracts/index.ts';

export interface ReminderStore {
  create(text: string, dueAt: number): Reminder;
  list(status?: Reminder['status']): Reminder[];
  cancel(id: string): Reminder;
  scan(): Promise<void>;
  start(): void;
  stop(): void;
}

function unpack(row: Record<string, SqlValue>): Reminder {
  return { id: String(row.id), text: String(row.text), dueAt: Number(row.due_at), createdAt: Number(row.created_at), status: row.status as Reminder['status'], ...(row.notice_id === null ? {} : { noticeId: String(row.notice_id) }) };
}

export function createReminderStore(deps: { storage: StorageService; notices: NoticeSink; now(): number; newId(prefix: string): string; onChange(reminder: Reminder): void; eraseNoticeOriginal?(id: string): void; onError?(): void }): ReminderStore {
  const sql = 'CREATE TABLE rt_reminders (id TEXT PRIMARY KEY, text TEXT NOT NULL, due_at INTEGER NOT NULL, created_at INTEGER NOT NULL, status TEXT NOT NULL, notice_id TEXT); CREATE INDEX rt_reminders_due ON rt_reminders(status, due_at);';
  deps.storage.registerMigrations('runtime.reminders', ['rt_'], [{ version: 1, checksum: createHash('sha256').update(sql).digest('hex'), apply: (tx) => { tx.run(sql); } }]);
  let running = false;
  let scanning = false;
  let timer: NodeJS.Timeout | undefined;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    if (!running) return;
    const row = deps.storage.transaction((tx) => tx.get("SELECT MIN(due_at) AS due FROM rt_reminders WHERE status = 'scheduled'"));
    const delay = row?.due === null || row?.due === undefined ? 3600_000 : Math.min(3600_000, Math.max(100, Number(row.due) - deps.now()));
    timer = setTimeout(() => { void api.scan().catch(() => deps.onError?.()); }, delay);
    timer.unref();
  };
  const api: ReminderStore = {
    create(text, dueAt) {
      assertCredentialFree(text);
      if (typeof text !== 'string' || [...text.trim()].length < 1 || [...text].length > 100 || !Number.isFinite(dueAt) || dueAt <= deps.now() || dueAt >= deps.now() + 30 * 24 * 3600_000) throw new ContractError('bad_request', 'invalid reminder fields');
      const item: Reminder = { id: deps.newId('reminder'), text, dueAt, createdAt: deps.now(), status: 'scheduled' };
      deps.storage.transaction((tx) => tx.run('INSERT INTO rt_reminders VALUES (?, ?, ?, ?, ?, NULL)', [item.id, text, dueAt, item.createdAt, item.status]));
      deps.onChange(item);
      schedule();
      return item;
    },
    list(status) {
      if (status && !['scheduled', 'fired', 'cancelled'].includes(status)) throw new ContractError('bad_request', 'invalid reminder status');
      return deps.storage.transaction((tx) => tx.all(`SELECT * FROM rt_reminders ${status ? 'WHERE status = ?' : ''} ORDER BY due_at`, status ? [status] : []).map(unpack));
    },
    cancel(id) {
      const item = deps.storage.transaction((tx) => {
        const row = tx.get('SELECT * FROM rt_reminders WHERE id = ?', [id]);
        if (!row) throw new ContractError('not_found', 'reminder not found');
        tx.run("UPDATE rt_reminders SET status = 'cancelled', text = '' WHERE id = ?", [id]);
        return { ...unpack(row), text: '', status: 'cancelled' as const };
      });
      if (item.noticeId) deps.eraseNoticeOriginal?.(item.noticeId);
      deps.onChange(item);
      schedule();
      return item;
    },
    async scan() {
      if (scanning) return;
      scanning = true;
      try {
        const rows = deps.storage.transaction((tx) => tx.all("SELECT * FROM rt_reminders WHERE status = 'scheduled' AND due_at <= ? ORDER BY due_at", [deps.now()]));
        for (const row of rows) {
          const current = deps.storage.transaction((tx) => tx.get("SELECT * FROM rt_reminders WHERE id = ? AND status = 'scheduled'", [row.id]));
          if (!current) continue;
          const item = unpack(current);
          const late = Math.floor((deps.now() - item.dueAt) / 60_000);
          const clock = (time: number) => new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
          const notice = await deps.notices.submit({ kind: 'companion.reminder', title: '你设定的提醒', sensitivity: 'normal', evidence: [], tone: 'neutral', urgency: 'normal', dedupeKey: `reminder:${item.id}`, facts: [{ label: '时间', value: clock(item.dueAt) }, { label: '原话', value: item.text }, ...(late > 0 ? [{ label: '补发', value: `晚了 ${late} 分钟` }] : [])], why: `你在 ${clock(item.createdAt)} 让我提醒` }, { kind: 'system', component: 'companion' });
          const result = deps.storage.transaction((tx) => {
            const fired = tx.run("UPDATE rt_reminders SET status = 'fired', notice_id = ? WHERE id = ? AND status = 'scheduled'", [notice.id, item.id]).changes;
            if (fired) return { fired: true, associated: false, reminder: unpack(tx.get('SELECT * FROM rt_reminders WHERE id = ?', [item.id])!) };
            const cancelled = tx.get("SELECT * FROM rt_reminders WHERE id = ? AND status = 'cancelled'", [item.id]);
            if (!cancelled) return undefined;
            const associated = tx.run("UPDATE rt_reminders SET notice_id = ? WHERE id = ? AND status = 'cancelled' AND (notice_id IS NULL OR notice_id <> ?)", [notice.id, item.id, notice.id]).changes > 0;
            return { fired: false, associated, reminder: { ...unpack(cancelled), text: '', noticeId: notice.id } };
          });
          if (result?.fired) deps.onChange(result.reminder);
          else if (result) {
            deps.eraseNoticeOriginal?.(notice.id);
            // The initial cancellation could not identify an in-flight notice.
            // Publish its new association once, using only the cleared DB state.
            if (result.associated) deps.onChange(result.reminder);
          }
        }
      } finally { scanning = false; schedule(); }
    },
    start() { running = true; void api.scan().catch(() => deps.onError?.()); },
    stop() { running = false; if (timer) clearTimeout(timer); },
  };
  return api;
}
