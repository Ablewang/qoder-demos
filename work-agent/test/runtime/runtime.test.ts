import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Notice } from '../../src/contracts/index.ts';
import { fixture } from '../surfaces/fixture.ts';

export const notification = (dedupeKey: string, patch: Partial<Notice> = {}): Notice => ({ title: '用户原样标题', facts: [{ label: '评审中', value: 3, unit: '个', ref: 'mr:123' }, { label: '人名', value: '张三' }, { label: '时间', value: '15:30' }, { label: '链接文本', value: 'https://example.invalid/MR?a=1' }], tone: 'concern', urgency: 'normal', kind: 'dev.test', sensitivity: 'normal', evidence: [], dedupeKey, ...patch });
const actor = { kind: 'system' as const, component: 'test' };

test('notice dedupe updates count without bubble; dismissed suppression anchored for exactly 24 hours', async (t) => {
  const f = await fixture(t);
  const first = await f.notices.submit(notification('same'), actor);
  const before = f.bubbles().length;
  const second = await f.notices.submit(notification('same', { title: '更新标题' }), actor);
  assert.equal(second.id, first.id); assert.equal(second.count, 2); assert.equal(second.notice.title, '更新标题');
  assert.equal(f.bubbles().length, before);
  await f.notices.dismiss(first.id);
  f.advance(23 * 3600_000);
  const ignored = await f.notices.submit(notification('same'), actor);
  assert.equal(ignored.status, 'dismissed'); assert.equal(ignored.count, 3); assert.equal(f.bubbles().length, before);
  f.advance(3600_000);
  const fresh = await f.notices.submit(notification('same'), actor);
  assert.notEqual(fresh.id, first.id); assert.equal(fresh.status, 'unread');
});

test('snooze validation, dedupe while snoozed, expiry resumes unread and re-pops only once', async (t) => {
  const f = await fixture(t);
  const first = await f.notices.submit(notification('later', { urgency: 'high' }), actor);
  await assert.rejects(f.notices.snooze(first.id, 4), { code: 'bad_request' });
  await assert.rejects(f.notices.snooze(first.id, 1441), { code: 'bad_request' });
  await f.notices.snooze(first.id, 5);
  assert.equal(f.companion.state().activity, 'concerned');
  const update = await f.notices.submit(notification('later', { urgency: 'high' }), actor);
  assert.equal(update.status, 'snoozed'); assert.equal(update.count, 2);
  const before = f.bubbles().length;
  f.advance(5 * 60_000); await f.notices.scan();
  assert.equal(f.notices.get(first.id).status, 'unread'); assert.equal(f.bubbles().length, before + 1);
  await f.notices.scan(); assert.equal(f.bubbles().length, before + 1);
  await f.notices.snooze(first.id, 5); f.advance(5 * 60_000); await f.notices.scan();
  assert.equal(f.notices.get(first.id).status, 'unread'); assert.equal(f.bubbles().length, before + 1);
});

test('30-day notice retention and developer notice setting', async (t) => {
  const f = await fixture(t);
  await f.notices.submit(notification('retention'), actor);
  f.advance(30 * 24 * 3600_000 + 1); await f.notices.scan();
  assert.equal(f.notices.list().length, 0);
  await f.call('/pet/settings', 'PUT', { acceptDevNotices: false });
  assert.equal((await f.call('/notices', 'POST', notification('rejected'))).status, 422);
});

test('reminder due scan emits once, startup catch-up preserves original and lateness; cancellation deletes text', async (t) => {
  const f = await fixture(t);
  const item = f.reminders.create('交周报', f.now() + 60000);
  await assert.rejects(Promise.resolve().then(() => f.reminders.create('不合法', f.now())), { code: 'bad_request' });
  f.advance(180000); await f.reminders.scan();
  const fired = f.reminders.list()[0]; assert.equal(fired.status, 'fired');
  const notice = f.notices.get(fired.noticeId!);
  assert.equal(notice.notice.kind, 'companion.reminder');
  assert.deepEqual(notice.notice.facts.find((x) => x.label === '原话'), { label: '原话', value: '交周报' });
  assert.deepEqual(notice.notice.facts.find((x) => x.label === '补发'), { label: '补发', value: '晚了 2 分钟' });
  await f.reminders.scan(); assert.equal(f.notices.list().filter((x) => x.notice.kind === 'companion.reminder').length, 1);
  f.reminders.cancel(item.id);
  assert.ok(!JSON.stringify(f.notices.list()).includes('交周报'));
  assert.ok(!JSON.stringify(f.events()).includes('交周报'));
  const second = f.reminders.create('删除原话', f.now() + 60000);
  assert.equal(f.reminders.cancel(second.id).text, '');
  assert.equal(f.reminders.list().find((x) => x.id === item.id)!.status, 'cancelled');
});
