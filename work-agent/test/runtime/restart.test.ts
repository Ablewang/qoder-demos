import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture } from '../surfaces/fixture.ts';
import { startDaemon } from '../../src/daemon.ts';
import { createLogger } from '../../src/platform/logger.ts';
import type { Notice, PetInteraction, StreamEvent } from '../../src/contracts/index.ts';

const actor = { kind: 'system' as const, component: 'test' };
const notice: Notice = { title: '重启测试', facts: [], kind: 'dev.test', sensitivity: 'normal', evidence: [], tone: 'neutral', urgency: 'high', dedupeKey: 'restart' };

test('restart preserves settings, persona, quiet queue, dismissed utterance and overdue reminder', async (t) => {
  const f = await fixture(t);
  await f.call('/pet/persona', 'PUT', { name: '小团' });
  await f.call('/pet/settings', 'PUT', { dailyBubbleCap: 2 });
  const record = await f.notices.submit(notice, actor);
  const utterance = f.bubbles().at(-1)!;
  await f.companion.onInteraction({ kind: 'utterance_dismissed', id: utterance.id });
  await f.notices.snooze(record.id, 5);
  const reminder = f.reminders.create('离线期间到点', f.now() + 60000);
  f.companion.setQuiet({ source: 'user', reasons: ['user_dnd'], detection: 'known' });
  await f.notices.submit({ ...notice, dedupeKey: 'queued' }, actor);
  await f.stop();
  f.advance(6 * 60000);
  const restarted = await startDaemon({ config: f.config, now: f.now, secrets: { get: async () => f.token, set: async () => {}, delete: async () => {} }, log: createLogger({ write: () => {} }), random: () => 0 });
  try {
    assert.equal(restarted.companion.settings().dailyBubbleCap, 2);
    assert.equal(restarted.companion.persona().name, '小团');
    assert.equal(restarted.companion.personaView().firstRun, false);
    assert.equal(restarted.companion.state().activity, 'quiet');
    assert.equal(restarted.notices.get(record.id).status, 'unread');
    assert.equal(restarted.reminders.list().find((r) => r.id === reminder.id)!.status, 'fired');
    const fired = restarted.notices.list().find((n) => n.notice.kind === 'companion.reminder')!;
    assert.ok(fired.notice.facts.some((fact) => fact.value === '晚了 5 分钟'));
    const before = restarted.events.seq();
    restarted.companion.setQuiet({ source: 'user', reasons: [], detection: 'known' });
    const delivered = restarted.storage.transaction((tx) => tx.all("SELECT data_json FROM ui_events WHERE id > ? AND type = 'pet.utterance'", [before]));
    assert.equal(delivered.length, 1);
    assert.match(String(delivered[0].data_json), /安静期间来了 2 条/);
    assert.ok(!String(delivered[0].data_json).includes(record.id));
  } finally { await restarted.stop(); }
});

test('real setTimeout dispatches due reminder using injected clock without cron', async (t) => {
  const f = await fixture(t);
  const original = f.eventHub.emit;
  let timeout: NodeJS.Timeout;
  await new Promise<void>((resolve, reject) => {
    timeout = setTimeout(() => reject(new Error('reminder timer did not dispatch')), 2000);
    f.eventHub.emit = (event) => {
      original(event);
      if (event.type === 'notice.created' && event.data.notice.notice.kind === 'companion.reminder') { clearTimeout(timeout); resolve(); }
    };
    f.reminders.create('真实定时器', f.now() + 10);
    f.advance(10);
  });
  f.eventHub.emit = original;
  clearTimeout(timeout!);
  await Promise.resolve();
  assert.equal(f.reminders.list()[0].status, 'fired');
});

test('notice sensitivity inherits referenced memory and low stays unread through interactions and restart', async (t) => {
  const f = await fixture(t);
  const evidenceId = f.evidence.register('local_edit');
  const memory = f.memory.remember({ layer: 'long_term', kind: 'fact', text: '保密项目的负责人', sensitivity: 'confidential', origin: { kind: 'user', evidenceType: 'local_edit', evidenceId } });
  const sensitive = await f.notices.submit({ ...notice, dedupeKey: 'inherited', evidence: [{ kind: 'memory', id: memory.id }] }, actor);
  assert.equal(sensitive.notice.sensitivity, 'confidential');
  assert.equal(f.bubbles().at(-1)!.text, '有一条敏感通知');
  assert.equal(f.bubbles().at(-1)!.sensitivity, 'confidential');
  assert.equal(f.bubbles().at(-1)!.ref!.noticeId, sensitive.id);
  const low = await f.notices.submit({ ...notice, dedupeKey: 'low-pet', urgency: 'low', evidence: [{ kind: 'memory', id: memory.id }] }, actor);
  assert.equal(low.notice.sensitivity, 'confidential');
  const before = f.bubbles().length;
  const response = await f.companion.onInteraction({ kind: 'pet' });
  assert.ok(response); assert.equal(f.bubbles().length, before + 1);
  assert.equal(response.ref, undefined); assert.equal(response.facts, undefined); assert.equal(response.quickActions, undefined);
  assert.equal(response.sensitivity, 'normal');
  assert.equal(f.notices.get(low.id).status, 'unread');
  assert.equal(f.companion.state().badge.notices, 2);
  await f.stop();
  f.advance(600_000);
  const restarted = await startDaemon({ config: f.config, now: f.now, secrets: { get: async () => f.token, set: async () => { throw new Error('unexpected secret write'); }, delete: async () => {} }, log: createLogger({ write: () => {} }), random: () => 0 });
  try {
    const eventOffset = restarted.events.seq();
    const interactions: PetInteraction[] = [{ kind: 'click' }, { kind: 'double_click' }, { kind: 'pet' }, { kind: 'poke', times: 3 }];
    for (const interaction of interactions) {
      const result = await restarted.companion.onInteraction(interaction);
      if (interaction.kind === 'click' || interaction.kind === 'double_click') assert.equal(result, null);
      else assert.ok(result);
      assert.equal(result?.ref, undefined); assert.equal(result?.facts, undefined); assert.equal(result?.quickActions, undefined);
    }
    const events = restarted.storage.transaction((tx) => tx.all('SELECT type, data_json FROM ui_events WHERE id > ?', [eventOffset]).map((row) => ({ type: row.type, data: JSON.parse(String(row.data_json)) }) as StreamEvent));
    assert.ok(!events.some((event) => event.type.startsWith('notice.')));
    for (const event of events) if (event.type === 'pet.utterance') assert.equal(event.data.utterance.ref, undefined);
    assert.equal(restarted.notices.get(low.id).status, 'unread');
    assert.equal(restarted.notices.get(low.id).notice.sensitivity, 'confidential');
    assert.ok(restarted.notices.list({ status: 'unread' }).some((record) => record.id === low.id));
    assert.equal(restarted.companion.state().badge.notices, 2);
    const delivery = restarted.storage.transaction((tx) => tx.get('SELECT emitted, low FROM comp_delivery WHERE notice_id = ?', [low.id]))!;
    assert.equal(delivery.emitted, 0); assert.equal(delivery.low, 1);
  } finally { await restarted.stop(); }
});
