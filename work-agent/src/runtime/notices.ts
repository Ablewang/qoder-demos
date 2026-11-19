import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { assertCredentialFree, isGeneratedId } from './validation.ts';
import { ContractError, NOTICE_LIMITS, SENSITIVITY_RANK } from '../contracts/index.ts';
import type { Actor, Notice, NoticeRecord, NoticeSink, NoticeStatus, StorageService, SqlValue } from '../contracts/index.ts';

export interface NoticeDelivery { bubble: boolean; repeat: boolean; created: boolean }
export interface NoticeStore extends NoticeSink {
  get(id: string): NoticeRecord;
  summary(): { unread: number; alert: boolean };
  list(options?: { status?: NoticeStatus; limit?: number }): NoticeRecord[];
  read(id: string): Promise<NoticeRecord>;
  snooze(id: string, minutes?: number): Promise<NoticeRecord>;
  dismiss(id: string): Promise<NoticeRecord>;
  scan(): Promise<void>;
  eraseReminderOriginal(id: string): void;
  start(): void;
  stop(): void;
  setHook(hook: (record: NoticeRecord, delivery: NoticeDelivery) => void): void;
}

export function validateNotice(value: Notice, trusted: { reminderKey?: string; memoryIds?: ReadonlySet<string> } = {}): void {
  const bad = () => { throw new ContractError('bad_request', 'invalid notice fields'); };
  if (!value || typeof value !== 'object') bad();
  assertCredentialFree({ ...value,
    dedupeKey: typeof value.dedupeKey === 'string' && value.dedupeKey === trusted.reminderKey && isGeneratedId(value.dedupeKey.slice('reminder:'.length), 'reminder') ? 'reminder:resolved' : value.dedupeKey,
    evidence: Array.isArray(value.evidence) ? value.evidence.map((ref) => ref?.kind === 'memory' && typeof ref.id === 'string' && trusted.memoryIds?.has(ref.id) && isGeneratedId(ref.id, 'mem') ? { ...ref, id: 'resolved' } : ref) : value.evidence,
  });
  for (const key of ['title', 'dedupeKey', 'body', 'why', 'nextStep'] as const) {
    const field = value[key];
    if (field !== undefined && (typeof field !== 'string' || [...field].length > NOTICE_LIMITS[key])) bad();
  }
  if (typeof value.title !== 'string' || !value.title.trim() || typeof value.dedupeKey !== 'string' || !value.dedupeKey.trim()) bad();
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(value.kind) || !['normal', 'confidential', 'secret'].includes(value.sensitivity) || !['neutral', 'good_news', 'concern', 'care'].includes(value.tone) || !['low', 'normal', 'high'].includes(value.urgency)) bad();
  if (!Array.isArray(value.facts) || value.facts.length > NOTICE_LIMITS.facts || !Array.isArray(value.evidence)) bad();
  for (const fact of value.facts) {
    if (!fact || typeof fact.label !== 'string' || !['string', 'number'].includes(typeof fact.value) || (typeof fact.value === 'number' && !Number.isFinite(fact.value)) || (fact.unit !== undefined && typeof fact.unit !== 'string') || (fact.ref !== undefined && typeof fact.ref !== 'string')) bad();
  }
  for (const evidence of value.evidence) {
    if (!evidence || !['entity', 'memory', 'tool_result'].includes(evidence.kind) || typeof evidence.id !== 'string' || (evidence.kind === 'entity' && typeof evidence.owner !== 'string')) bad();
  }
  if (value.links !== undefined && (!Array.isArray(value.links) || value.links.some((x) => typeof x !== 'string'))) bad();
  if (value.channels !== undefined && (!Array.isArray(value.channels) || value.channels.some((x) => !['pet', 'console', 'feishu_bot'].includes(x)))) bad();
}

function record(row: Record<string, SqlValue>): NoticeRecord {
  return { id: String(row.id), notice: JSON.parse(String(row.notice_json)) as Notice, from: JSON.parse(String(row.from_json)) as Actor, status: row.status as NoticeStatus, count: Number(row.count), createdAt: Number(row.created_at), updatedAt: Number(row.updated_at), ...(row.snoozed_until === null ? {} : { snoozedUntil: Number(row.snoozed_until) }) };
}

export function createNoticeStore(deps: { storage: StorageService; now(): number; newId(prefix: string): string; acceptDev(): boolean; memorySensitivity?(id: string): Notice['sensitivity'] | undefined; onChange(record: NoticeRecord, created: boolean): void; onAction?(action: 'read' | 'snooze' | 'dismiss'): void }): NoticeStore {
  const { storage, now } = deps;
  const sql = `CREATE TABLE rt_notices (id TEXT PRIMARY KEY, dedupe_key TEXT NOT NULL, notice_json TEXT NOT NULL, from_json TEXT NOT NULL, status TEXT NOT NULL, count INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, snoozed_until INTEGER, dismissed_at INTEGER, replayed INTEGER NOT NULL DEFAULT 0); CREATE INDEX rt_notices_dedupe ON rt_notices(dedupe_key, status);`;
  const receiptSql = 'CREATE TABLE rt_notice_receipts (delivery_key TEXT PRIMARY KEY, notice_id TEXT NOT NULL, first_created_at INTEGER NOT NULL);';
  const backfillSql = "SELECT * FROM rt_notices WHERE json_valid(notice_json) AND json_extract(notice_json, '$.kind') = 'companion.reminder' ORDER BY created_at, id";
  const reminderKey = (notice: Notice) => notice.kind === 'companion.reminder' && typeof notice.dedupeKey === 'string' && /^reminder:[a-zA-Z0-9_.-]+$/.test(notice.dedupeKey);
  storage.registerMigrations('runtime.notices', ['rt_'], [
    { version: 1, checksum: createHash('sha256').update(sql).digest('hex'), apply: (tx) => { tx.run(sql); } },
    { version: 2, checksum: createHash('sha256').update(receiptSql + backfillSql).digest('hex'), apply: (tx) => {
      tx.run(receiptSql);
      for (const row of tx.all(backfillSql)) {
        const item = record(row);
        if (!reminderKey(item.notice) || item.notice.dedupeKey !== row.dedupe_key || item.from.kind !== 'system' || item.from.component !== 'companion') continue;
        try { validateNotice(item.notice, { reminderKey: item.notice.dedupeKey }); assertCredentialFree(item.from); }
        catch (error) { if (error instanceof ContractError) continue; throw error; }
        tx.run('INSERT OR IGNORE INTO rt_notice_receipts (delivery_key, notice_id, first_created_at) VALUES (?, ?, ?)', [item.notice.dedupeKey, item.id, item.createdAt]);
      }
    } },
  ]);
  let hook: (record: NoticeRecord, delivery: NoticeDelivery) => void = () => {};
  let timer: NodeJS.Timeout | undefined;
  let running = false;
  const get = (id: string) => {
    const row = storage.transaction((tx) => tx.get('SELECT * FROM rt_notices WHERE id = ?', [id]));
    if (!row) throw new ContractError('not_found', 'notice not found');
    return record(row);
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    if (!running) return;
    const row = storage.transaction((tx) => tx.get("SELECT MIN(snoozed_until) AS due FROM rt_notices WHERE status = 'snoozed'"));
    const delay = row?.due === null || row?.due === undefined ? 3600_000 : Math.min(3600_000, Math.max(1, Number(row.due) - now()));
    timer = setTimeout(() => { void api.scan(); }, delay);
    timer.unref();
  };
  const change = async (id: string, status: NoticeStatus, minutes?: number) => {
    const before = get(id);
    if (minutes !== undefined && (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440)) throw new ContractError('bad_request', 'snooze minutes must be 5 to 1440');
    storage.transaction((tx) => tx.run('UPDATE rt_notices SET status = ?, updated_at = ?, snoozed_until = ?, dismissed_at = ? WHERE id = ?', [status, now(), status === 'snoozed' ? now() + minutes! * 60_000 : null, status === 'dismissed' ? now() : null, id]));
    const result = get(id);
    deps.onChange(result, false);
    hook(result, { bubble: false, repeat: false, created: false });
    if (before.status !== status) deps.onAction?.(status === 'read' ? 'read' : status === 'snoozed' ? 'snooze' : 'dismiss');
    schedule();
    return result;
  };
  const api: NoticeStore = {
    get,
    summary() {
      const row = storage.transaction((tx) => tx.get("SELECT COUNT(*) AS unread, MAX(CASE WHEN json_extract(notice_json, '$.urgency') <> 'low' THEN 1 ELSE 0 END) AS alert FROM rt_notices WHERE status = 'unread'"))!;
      return { unread: Number(row.unread), alert: Boolean(row.alert) };
    },
    list(options = {}) {
      if (options.status && !['unread', 'read', 'snoozed', 'dismissed'].includes(options.status)) throw new ContractError('bad_request', 'invalid notice status');
      const limit = options.limit ?? 1000;
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new ContractError('bad_request', 'invalid limit');
      return storage.transaction((tx) => tx.all(`SELECT * FROM rt_notices ${options.status ? 'WHERE status = ?' : ''} ORDER BY updated_at DESC, id DESC LIMIT ?`, options.status ? [options.status, limit] : [limit]).map(record));
    },
    async submit(notice, from) {
      const generatedMemory = new Set<string>();
      if (Array.isArray(notice?.evidence)) for (const ref of notice.evidence) {
        if (ref?.kind === 'memory' && typeof ref.id === 'string' && isGeneratedId(ref.id, 'mem')) generatedMemory.add(ref.id);
      }
      const deliveryKey = notice && reminderKey(notice) ? notice.dedupeKey : undefined;
      const generatedKey = deliveryKey && isGeneratedId(deliveryKey.slice('reminder:'.length), 'reminder') ? deliveryKey : undefined;
      // Reject free text before invoking even the read-only reference resolver.
      // Generated metadata candidates must then prove their runtime ownership.
      validateNotice(notice, { memoryIds: generatedMemory, reminderKey: generatedKey });
      assertCredentialFree(from);
      const trustedMemory = new Set([...generatedMemory].filter((id) => deps.memorySensitivity?.(id)));
      const trustedKey = generatedKey && storage.transaction((tx) =>
        Boolean(tx.get('SELECT notice_id FROM rt_notice_receipts WHERE delivery_key = ?', [generatedKey]) ||
          (tx.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rt_reminders'") && tx.get('SELECT id FROM rt_reminders WHERE id = ?', [generatedKey.slice('reminder:'.length)]))));
      if (generatedMemory.size || generatedKey) validateNotice(notice, { memoryIds: trustedMemory, ...(trustedKey ? { reminderKey: generatedKey } : {}) });
      if (notice.kind.startsWith('dev.') && !deps.acceptDev()) throw new ContractError('rejected', 'development notices disabled');
      const result = storage.transaction((tx) => {
        if (deliveryKey) {
          const receipt = tx.get('SELECT * FROM rt_notice_receipts WHERE delivery_key = ?', [deliveryKey]);
          if (receipt) {
            const row = tx.get('SELECT * FROM rt_notices WHERE id = ?', [receipt.notice_id]);
            const expired: NoticeRecord = { id: String(receipt.notice_id), createdAt: Number(receipt.first_created_at), updatedAt: Number(receipt.first_created_at), count: 1, status: 'dismissed', from: { kind: 'system', component: 'companion' }, notice: { kind: 'companion.reminder', title: '提醒通知已过期', facts: [], evidence: [], sensitivity: 'normal', tone: 'neutral', urgency: 'low', dedupeKey: deliveryKey } };
            return { item: row ? record(row) : expired, created: false, retry: true };
          }
        }
        const existing = deliveryKey ? undefined : tx.get("SELECT * FROM rt_notices WHERE dedupe_key = ? AND (status IN ('unread', 'snoozed') OR (status = 'dismissed' AND dismissed_at > ?)) ORDER BY updated_at DESC LIMIT 1", [notice.dedupeKey, now() - 24 * 3600_000]);
        const previous = existing ? record(existing).notice : undefined;
        const evidence: Notice['evidence'] = [];
        for (const ref of [...(previous?.evidence ?? []), ...notice.evidence]) if (!evidence.some((kept) => isDeepStrictEqual(kept, ref))) evidence.push(ref);
        let sensitivity = notice.sensitivity;
        for (const inherited of [previous?.sensitivity, ...evidence.map((ref) => ref.kind === 'memory' ? deps.memorySensitivity?.(ref.id) : undefined)]) {
          if (inherited && SENSITIVITY_RANK[inherited] > SENSITIVITY_RANK[sensitivity]) sensitivity = inherited;
        }
        const merged = { ...notice, sensitivity, evidence };
        if (existing) {
          tx.run('UPDATE rt_notices SET notice_json = ?, from_json = ?, count = count + 1, updated_at = ? WHERE id = ?', [JSON.stringify(merged), JSON.stringify(from), now(), existing.id]);
          return { item: record(tx.get('SELECT * FROM rt_notices WHERE id = ?', [existing.id])!), created: false, retry: false };
        }
        const id = deps.newId('notice');
        const createdAt = now();
        tx.run("INSERT INTO rt_notices (id, dedupe_key, notice_json, from_json, status, count, created_at, updated_at) VALUES (?, ?, ?, ?, 'unread', 1, ?, ?)", [id, notice.dedupeKey, JSON.stringify(merged), JSON.stringify(from), createdAt, createdAt]);
        if (deliveryKey) tx.run('INSERT INTO rt_notice_receipts (delivery_key, notice_id, first_created_at) VALUES (?, ?, ?)', [deliveryKey, id, createdAt]);
        return { item: record(tx.get('SELECT * FROM rt_notices WHERE id = ?', [id])!), created: true, retry: false };
      });
      if (!result.retry) {
        deps.onChange(result.item, result.created);
        hook(result.item, { created: result.created, bubble: result.created, repeat: false });
        schedule();
      }
      return result.item;
    },
    eraseReminderOriginal(id) {
      const before = get(id);
      if (before.notice.kind !== 'companion.reminder') throw new ContractError('bad_request', 'not a reminder notice');
      const notice = { ...before.notice, facts: before.notice.facts.filter((fact) => fact.label !== '原话') };
      storage.transaction((tx) => tx.run('UPDATE rt_notices SET notice_json = ?, updated_at = ? WHERE id = ?', [JSON.stringify(notice), now(), id]));
      deps.onChange(get(id), false);
    },
    read: (id) => change(id, 'read'),
    snooze: (id, minutes = 60) => change(id, 'snoozed', minutes),
    dismiss: (id) => change(id, 'dismissed'),
    async scan() {
      const due = storage.transaction((tx) => {
        tx.run('DELETE FROM rt_notices WHERE created_at < ?', [now() - 30 * 24 * 3600_000]);
        const rows = tx.all("SELECT * FROM rt_notices WHERE status = 'snoozed' AND snoozed_until <= ?", [now()]);
        for (const row of rows) tx.run("UPDATE rt_notices SET status = 'unread', snoozed_until = NULL, updated_at = ?, replayed = 1 WHERE id = ?", [now(), row.id]);
        return rows;
      });
      for (const row of due) {
        const item = get(String(row.id));
        deps.onChange(item, false);
        hook(item, { bubble: Number(row.replayed) === 0, repeat: true, created: false });
      }
      schedule();
    },
    start() { running = true; void api.scan(); },
    stop() { running = false; if (timer) clearTimeout(timer); },
    setHook(next) { hook = next; },
  };
  return api;
}
