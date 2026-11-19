import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { ContractError } from '../../src/contracts/index.ts';
import type { Actor, Notice, NoticeRecord, NoticeSink, StorageService, StreamEvent } from '../../src/contracts/index.ts';
import { newId } from '../../src/platform/ids.ts';
import { SqliteStorage } from '../../src/platform/storage.ts';
import { createEventHub } from '../../src/surfaces/events.ts';
import { createNoticeStore } from '../../src/runtime/notices.ts';
import { createReminderStore } from '../../src/runtime/reminders.ts';

const actor: Actor = { kind: 'system', component: 'companion' };
const notification = (dedupeKey: string, patch: Partial<Notice> = {}): Notice => ({ title: '原样标题', facts: [{ label: '数量', value: 3, unit: '个' }], kind: 'runtime.test', sensitivity: 'normal', evidence: [], tone: 'neutral', urgency: 'normal', dedupeKey, ...patch });
const reminderNotice = (id: string, text = '测试提醒原话') => notification(`reminder:${id}`, { kind: 'companion.reminder', facts: [{ label: '原话', value: text }], body: '测试正文', why: '测试原因', nextStep: '测试下一步' });

function runtime(t: TestContext, options: { filename?: string; time?: number; memorySensitivity?(id: string): Notice['sensitivity'] | undefined } = {}) {
  const storage = new SqliteStorage(options.filename ?? ':memory:');
  let time = options.time ?? new Date('2026-11-20T12:00:00+08:00').getTime();
  const now = () => time;
  const events = createEventHub({ storage, now, maxAgeMs: 365 * 24 * 3600_000 });
  const changes: Array<{ record: NoticeRecord; created: boolean }> = [];
  const deliveries: NoticeRecord[] = [];
  const notices = createNoticeStore({ storage, now, newId: (prefix) => newId(prefix, now()), acceptDev: () => true, memorySensitivity: options.memorySensitivity, onChange(record, created) { changes.push({ record: structuredClone(record), created }); events.emit({ type: created ? 'notice.created' : 'notice.updated', data: { notice: record } }); } });
  notices.setHook((record) => { deliveries.push(structuredClone(record)); });
  const sink: NoticeSink = { submit: (notice, from) => notices.submit(notice, from) };
  const reminders = createReminderStore({ storage, now, notices: sink, newId: (prefix) => newId(prefix, now()), onChange(reminder) { events.emit({ type: 'reminder.changed', data: { reminder } }); }, eraseNoticeOriginal(id) { try { notices.eraseReminderOriginal(id); } catch (error) { if (!(error instanceof ContractError) || error.code !== 'not_found') throw error; } events.eraseReminderOriginal(id); } });
  let closed = false;
  const stop = () => { if (closed) return; reminders.stop(); notices.stop(); events.stop(); storage.close(); closed = true; };
  t.after(stop);
  return { storage, notices, reminders, sink, changes, deliveries, now, stop, advance(ms: number) { time += ms; }, history: () => storage.transaction((tx) => tx.all('SELECT type, data_json FROM ui_events ORDER BY id').map((row) => ({ type: row.type, data: JSON.parse(String(row.data_json)) }) as StreamEvent)) };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test('cancellation during deferred submit clears fresh notice and history, associates its receipt without fired/original events', async (t) => {
  const f = runtime(t);
  const entered = deferred(); const release = deferred();
  let returned: NoticeRecord | undefined;
  f.sink.submit = async (notice, from) => { entered.resolve(); await release.promise; returned = await f.notices.submit(notice, from); return returned; };
  const reminder = f.reminders.create('延迟投递原话', f.now() + 1000);
  f.advance(1000);
  const scan = f.reminders.scan();
  await entered.promise;
  const cancelled = f.reminders.cancel(reminder.id);
  assert.equal(cancelled.noticeId, undefined);
  release.resolve(); await scan;
  const final = f.reminders.list()[0];
  assert.equal(final.status, 'cancelled'); assert.equal(final.text, ''); assert.equal(final.noticeId, returned!.id);
  assert.equal(f.notices.list().length, 1);
  const persisted = f.storage.transaction((tx) => ({ notices: tx.all('SELECT * FROM rt_notices'), reminders: tx.all('SELECT * FROM rt_reminders'), receipts: tx.all('SELECT * FROM rt_notice_receipts'), events: tx.all('SELECT * FROM ui_events') }));
  assert.ok(!JSON.stringify(persisted).includes('延迟投递原话'));
  assert.equal(persisted.receipts[0].notice_id, returned!.id);
  const changes = f.history().filter((event) => event.type === 'reminder.changed');
  assert.ok(changes.every((event) => event.data.reminder.status !== 'fired'));
  const cancellations = changes.filter((event) => event.data.reminder.status === 'cancelled');
  assert.equal(cancellations.length, 2);
  assert.deepEqual(cancellations.map((event) => event.data.reminder.text), ['', '']);
  assert.equal(cancellations[1].data.reminder.noticeId, returned!.id);
  const before = { changes: f.changes.length, hooks: f.deliveries.length, events: f.history().length };
  const retry = await f.notices.submit(reminderNotice(reminder.id, '延迟投递原话'), actor);
  assert.equal(retry.id, returned!.id); assert.equal(retry.count, 1); assert.ok(!JSON.stringify(retry).includes('延迟投递原话'));
  await f.reminders.scan();
  assert.deepEqual({ changes: f.changes.length, hooks: f.deliveries.length, events: f.history().length }, before);
});

test('scanner rechecks a queued reminder after an earlier asynchronous dispatch', async (t) => {
  const f = runtime(t);
  const entered = deferred(); const release = deferred();
  let submissions = 0;
  f.sink.submit = async (notice, from) => { submissions++; entered.resolve(); await release.promise; return f.notices.submit(notice, from); };
  f.reminders.create('先到点', f.now() + 1000);
  const second = f.reminders.create('排队期间取消', f.now() + 2000);
  f.advance(2000); const scan = f.reminders.scan(); await entered.promise;
  f.reminders.cancel(second.id); release.resolve(); await scan;
  assert.equal(submissions, 1); assert.equal(f.notices.list().length, 1);
  assert.equal(f.reminders.list().find((item) => item.id === second.id)!.status, 'cancelled');
});

for (const status of ['read', 'dismissed'] as const) test(`committed reminder notice survives failed association, ${status}, restart and retention without redelivery`, async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'wa-runtime-receipts-'));
  t.after(() => { rmSync(dir, { recursive: true, force: true }); });
  const filename = path.join(dir, 'runtime.sqlite');
  const f = runtime(t, { filename });
  const reminder = f.reminders.create('故障前提交的原话', f.now() + 1000);
  f.advance(1000);
  f.storage.db.exec("CREATE TRIGGER rt_test_fail_fired BEFORE UPDATE OF status ON rt_reminders WHEN NEW.status = 'fired' BEGIN SELECT RAISE(ABORT, 'injected reminder update failure'); END;");
  await assert.rejects(f.reminders.scan(), /injected reminder update failure/);
  const first = f.notices.list()[0];
  assert.equal(f.reminders.list()[0].status, 'scheduled'); assert.equal(first.count, 1);
  assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM rt_notice_receipts')).length, 1);
  if (status === 'read') await f.notices.read(first.id); else await f.notices.dismiss(first.id);
  f.storage.db.exec('DROP TRIGGER rt_test_fail_fired');
  const time = f.now(); f.stop();
  const restarted = runtime(t, { filename, time });
  restarted.reminders.start(); await restarted.reminders.scan(); await Promise.resolve(); restarted.reminders.stop();
  assert.equal(restarted.reminders.list()[0].status, 'fired'); assert.equal(restarted.reminders.list()[0].noticeId, first.id);
  assert.equal(restarted.notices.list().length, 1); assert.equal(restarted.notices.get(first.id).status, status); assert.equal(restarted.notices.get(first.id).count, 1);
  assert.equal(restarted.history().filter((event) => event.type === 'notice.created').length, 1);
  assert.equal(restarted.changes.length, 0); assert.equal(restarted.deliveries.length, 0);
  restarted.advance(31 * 24 * 3600_000); await restarted.notices.scan();
  assert.equal(restarted.notices.list().length, 0);
  const before = restarted.history().length;
  const expired = await restarted.notices.submit(reminderNotice(reminder.id), actor);
  assert.equal(expired.id, first.id); assert.equal(expired.createdAt, first.createdAt); assert.equal(expired.count, 1);
  assert.equal(expired.status, 'dismissed'); assert.deepEqual(expired.notice.facts, []); assert.deepEqual(expired.notice.evidence, []);
  for (const key of ['body', 'why', 'nextStep', 'links'] as const) assert.equal(expired.notice[key], undefined);
  assert.ok(!JSON.stringify(expired).includes('测试提醒原话')); assert.ok(!JSON.stringify(expired).includes('故障前提交的原话'));
  assert.equal(restarted.notices.list().length, 0); assert.equal(restarted.history().length, before); assert.equal(restarted.changes.length, 0); assert.equal(restarted.deliveries.length, 0);
  restarted.reminders.cancel(reminder.id);
  assert.equal(restarted.reminders.list()[0].text, '');
});

test('receipt lookup is durable across every notice status and concurrent stores', async (t) => {
  const f = runtime(t);
  const reminder = f.reminders.create('所有状态', f.now() + 1000);
  const input = reminderNotice(reminder.id);
  const first = await f.notices.submit(input, actor);
  for (const status of ['unread', 'snoozed', 'read', 'dismissed'] as const) {
    if (status === 'snoozed') await f.notices.snooze(first.id, 5);
    if (status === 'read') await f.notices.read(first.id);
    if (status === 'dismissed') { await f.notices.dismiss(first.id); f.advance(25 * 3600_000); }
    const before = { changes: f.changes.length, hooks: f.deliveries.length, events: f.history().length };
    const retry = await f.notices.submit(input, actor);
    assert.equal(retry.id, first.id); assert.equal(retry.count, 1); assert.equal(retry.status, status);
    assert.deepEqual({ changes: f.changes.length, hooks: f.deliveries.length, events: f.history().length }, before);
  }
  const other = createNoticeStore({ storage: f.storage, now: f.now, newId: (prefix) => newId(prefix, f.now()), acceptDev: () => true, onChange() { assert.fail('retry callback'); } });
  other.setHook(() => { assert.fail('retry hook'); });
  const retried = await Promise.all([f.notices.submit(input, actor), other.submit(input, actor)]);
  assert.ok(retried.every((item) => item.id === first.id && item.count === 1));
});

test('first notice and receipt insertion roll back atomically on receipt failure', async (t) => {
  const f = runtime(t);
  f.storage.db.exec("CREATE TRIGGER rt_test_fail_receipt BEFORE INSERT ON rt_notice_receipts BEGIN SELECT RAISE(ABORT, 'injected receipt failure'); END;");
  await assert.rejects(f.notices.submit(reminderNotice('atomic'), actor), /injected receipt failure/);
  assert.equal(f.notices.list().length, 0); assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM rt_notice_receipts')).length, 0);
  assert.equal(f.changes.length, 0); assert.equal(f.deliveries.length, 0); assert.equal(f.history().length, 0);
  f.storage.db.exec('DROP TRIGGER rt_test_fail_receipt');
  await f.notices.submit(reminderNotice('atomic'), actor);
  assert.equal(f.notices.list().length, 1); assert.equal(f.changes.length, 1);
});

test('migration 2 backfills earliest legitimate reminder receipt without changing migration 1 or deleting history', async (t) => {
  const storage = new SqliteStorage(':memory:'); t.after(() => storage.close());
  const legacy: StorageService = { transaction: (work) => storage.transaction(work), registerMigrations: (moduleId, prefixes, migrations) => storage.registerMigrations(moduleId, prefixes, migrations.filter((migration) => migration.version === 1)) };
  createNoticeStore({ storage: legacy, now: () => 1000, newId: (prefix) => newId(prefix), acceptDev: () => true, onChange() { assert.fail('migration callback'); } });
  const originalSql = 'CREATE TABLE rt_notices (id TEXT PRIMARY KEY, dedupe_key TEXT NOT NULL, notice_json TEXT NOT NULL, from_json TEXT NOT NULL, status TEXT NOT NULL, count INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, snoozed_until INTEGER, dismissed_at INTEGER, replayed INTEGER NOT NULL DEFAULT 0); CREATE INDEX rt_notices_dedupe ON rt_notices(dedupe_key, status);';
  const originalChecksum = storage.transaction((tx) => tx.get("SELECT checksum FROM platform_migrations WHERE module_id = 'runtime.notices' AND version = 1")!.checksum);
  assert.equal(originalChecksum, createHash('sha256').update(originalSql).digest('hex'));
  const id = newId('reminder'); const input = reminderNotice(id);
  storage.transaction((tx) => {
    for (const [noticeId, createdAt, notice] of [['legacy-first', 100, input], ['legacy-duplicate', 200, input], ['bad-legacy', 300, reminderNotice('sk-synthetic')], ['ordinary', 400, notification(input.dedupeKey)]] as const) {
      tx.run("INSERT INTO rt_notices (id, dedupe_key, notice_json, from_json, status, count, created_at, updated_at) VALUES (?, ?, ?, ?, 'read', 1, ?, ?)", [noticeId, notice.dedupeKey, JSON.stringify(notice), JSON.stringify(actor), createdAt, createdAt]);
    }
  });
  const notices = createNoticeStore({ storage, now: () => 1000, newId: (prefix) => newId(prefix), acceptDev: () => true, onChange() { assert.fail('backfilled retry callback'); } });
  const receipts = storage.transaction((tx) => tx.all('SELECT * FROM rt_notice_receipts'));
  assert.equal(receipts.length, 1); assert.equal(receipts[0].notice_id, 'legacy-first'); assert.equal(receipts[0].first_created_at, 100);
  assert.equal(notices.list().length, 4);
  const retry = await notices.submit(input, actor); assert.equal(retry.id, 'legacy-first'); assert.equal(retry.count, 1);
  assert.equal(storage.transaction((tx) => tx.get("SELECT checksum FROM platform_migrations WHERE module_id = 'runtime.notices' AND version = 1")!.checksum), originalChecksum);
});

test('normal dedupe retains maximum sensitivity and full evidence refs while preserving input facts', async (t) => {
  const memoryId = newId('mem');
  let memorySensitivity: Notice['sensitivity'] | undefined = 'confidential';
  const f = runtime(t, { memorySensitivity: (id) => id === memoryId ? memorySensitivity : undefined });
  const source: Notice['evidence'] = [{ kind: 'entity', id: 'mr:1', owner: 'person:a' }, { kind: 'memory', id: memoryId }];
  const first = await f.notices.submit(notification('sensitive', { sensitivity: 'secret', evidence: source }), actor);
  const facts = [{ label: '原样事实', value: '新内容', ref: 'mr:1' }];
  const merged = await f.notices.submit(notification('sensitive', { facts, evidence: [{ kind: 'entity', owner: 'person:a', id: 'mr:1' }, { kind: 'entity', id: 'mr:1', owner: 'person:b' }] }), actor);
  assert.equal(merged.id, first.id); assert.equal(merged.notice.sensitivity, 'secret'); assert.deepEqual(merged.notice.facts, facts);
  assert.deepEqual(merged.notice.evidence, [...source, { kind: 'entity', id: 'mr:1', owner: 'person:b' }]);
  const confidential = await f.notices.submit(notification('inherited', { evidence: [{ kind: 'memory', id: memoryId }] }), actor);
  assert.equal(confidential.notice.sensitivity, 'confidential');
  memorySensitivity = undefined;
  const retained = await f.notices.submit(notification('inherited', { facts }), actor);
  assert.equal(retained.notice.sensitivity, 'confidential'); assert.deepEqual(retained.notice.evidence, confidential.notice.evidence); assert.deepEqual(retained.notice.facts, facts);
  memorySensitivity = 'secret';
  const elevated = await f.notices.submit(notification('inherited'), actor);
  assert.equal(elevated.notice.sensitivity, 'secret'); assert.deepEqual(elevated.notice.evidence, confidential.notice.evidence);
});

test('generated identifiers require resolved ownership and never exempt free text', async (t) => {
  const memoryId = newId('mem');
  let resolutions = 0;
  const f = runtime(t, { memorySensitivity(id) { resolutions++; return id === memoryId ? 'normal' : undefined; } });
  const secret = 'sk-synthetic-reference-test';
  await assert.rejects(f.notices.submit(notification('validation', { body: secret, evidence: [{ kind: 'memory', id: memoryId }] }), actor), { code: 'rejected' });
  assert.equal(resolutions, 0);
  await assert.rejects(f.notices.submit(notification('validation', { evidence: [{ kind: 'memory', id: newId('mem') }] }), actor), { code: 'rejected' });
  await assert.rejects(f.notices.submit(reminderNotice(newId('reminder')), actor), { code: 'rejected' });
  await assert.rejects(f.notices.submit(notification('validation', { title: memoryId }), actor), { code: 'rejected' });
  await assert.rejects(f.notices.submit(notification('validation', { facts: [{ label: '原文', value: memoryId }] }), actor), { code: 'rejected' });
  assert.equal(f.notices.list().length, 0); assert.equal(f.changes.length, 0); assert.equal(f.deliveries.length, 0); assert.equal(f.history().length, 0);
  await f.notices.submit(notification('resolved', { evidence: [{ kind: 'memory', id: memoryId }] }), actor);
  assert.equal(f.notices.list().length, 1);
});

test('all notice string fields, metadata, actors and direct reminder text reject synthetic credentials before writes/events/hooks', async (t) => {
  const f = runtime(t);
  const secret = 'sk-synthetic-runtime-only';
  const cases: Notice[] = [];
  for (const key of ['title', 'body', 'why', 'nextStep', 'dedupeKey', 'kind', 'sensitivity', 'tone', 'urgency'] as const) cases.push(notification('validation', { [key]: secret } as Partial<Notice>));
  for (const key of ['label', 'value', 'unit', 'ref'] as const) cases.push(notification('validation', { facts: [{ label: '标签', value: '值', [key]: secret }] }));
  cases.push(notification('validation', { links: [secret] }));
  cases.push(notification('validation', { channels: [secret] as unknown as Notice['channels'] }));
  for (const kind of ['memory', 'entity', 'tool_result'] as const) cases.push(notification('validation', { evidence: [kind === 'entity' ? { kind, id: secret, owner: 'person:a' } : { kind, id: secret }] }));
  cases.push(notification('validation', { evidence: [{ kind: 'entity', id: 'mr:1', owner: `person:${secret}` }] }));
  cases.push(notification('validation', { evidence: [{ kind: secret, id: 'mr:1' }] } as unknown as Partial<Notice>));
  cases.push({ ...notification('validation'), extra: { nested: secret } } as Notice);
  // Existing rows must remain untouched on rejected dedupe attempts too.
  const existing = await f.notices.submit(notification('validation'), actor);
  const snapshot = () => f.storage.transaction((tx) => JSON.stringify({ notices: tx.all('SELECT * FROM rt_notices'), reminders: tx.all('SELECT * FROM rt_reminders'), receipts: tx.all('SELECT * FROM rt_notice_receipts'), events: tx.all('SELECT * FROM ui_events') }));
  const before = snapshot(); const callbacks = f.changes.length; const hooks = f.deliveries.length;
  const generic = (error: unknown) => { assert.equal((error as { code: string }).code, 'rejected'); assert.ok(!(error as Error).message.includes(secret)); return true; };
  for (const notice of cases) await assert.rejects(f.notices.submit(notice, actor), generic);
  for (const from of [{ kind: 'system', component: secret }, { kind: 'capability', id: secret }, { kind: 'user', personId: `person:${secret}` }, { kind: 'remote', personId: 'person:a', via: secret }] as Actor[]) await assert.rejects(f.notices.submit(notification('validation'), from), generic);
  assert.throws(() => f.reminders.create(secret, f.now() + 1000), generic);
  assert.equal(snapshot(), before); assert.ok(!snapshot().includes(secret)); assert.equal(f.changes.length, callbacks); assert.equal(f.deliveries.length, hooks); assert.equal(f.notices.get(existing.id).count, 1);
});
