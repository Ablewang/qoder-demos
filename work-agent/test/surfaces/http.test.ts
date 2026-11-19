import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { ContractError, OWNER_ACTOR } from '../../src/contracts/index.ts';
import type { MemoryItem, PersonaView, NoticeRecord, Reminder, ChatResponse } from '../../src/contracts/index.ts';
import { fixture, openStream } from './fixture.ts';

const notice = { title: '原样通知', facts: [{ label: '数量', value: 3, unit: '个' }], kind: 'dev.test', tone: 'neutral', urgency: 'normal', dedupeKey: 'http.test', sensitivity: 'normal', evidence: [] };

test('HTTP auth order, Host/Origin allowlists, CORS OPTIONS and body limits', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call('/health', 'GET', undefined, { Authorization: '' })).status, 200);
  assert.equal((await f.call('/pet/state', 'GET', undefined, { Authorization: '' })).status, 401);
  assert.equal((await f.call('/pet/state', 'GET', undefined, { Authorization: 'Bearer wrong' })).status, 401);
  assert.equal((await f.call('/health', 'GET', undefined, { Host: 'evil.test', Origin: 'https://evil.test' })).status, 403);
  assert.equal((await f.call('/pet/state', 'GET', undefined, { Origin: 'https://evil.test', Authorization: '' })).status, 403);
  for (const origin of ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost', 'http://localhost:1420']) {
    const response = await f.call('/pet/state', 'GET', undefined, { Origin: origin });
    assert.equal(response.status, 200); assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  }
  const preflight = await f.call('/chat', 'OPTIONS', undefined, { Origin: 'tauri://localhost', Authorization: '' });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Headers'), 'Authorization, Content-Type, Last-Event-ID');
  assert.equal((await f.call('/chat', 'OPTIONS', undefined, { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await f.call('/chat', 'POST', { message: 'x'.repeat(65537) })).status, 400);
  assert.equal((await f.call('/memory', 'POST', { layer: 'profile', kind: 'rule', text: '周五不排会', origin: { kind: 'user' } })).status, 400);
  assert.equal((await f.call('/notices', 'POST', { ...notice, title: '字'.repeat(81) })).status, 400);
  assert.equal((await f.call('/notices', 'POST', { ...notice, kind: 'capability.fake' })).status, 422);
  assert.equal((await f.call('/memory/journal?date=2026-02-30')).status, 400);
  assert.equal((await f.call('/stream', 'GET', undefined, { 'Last-Event-ID': 'nonsense' })).status, 400);
});

test('HTTP endpoint coverage, real memory integration, evidence expiry, retype and delete', async (t) => {
  const f = await fixture(t);
  const first = (await f.call('/pet/persona')).data as PersonaView;
  assert.equal(first.firstRun, true); assert.equal(first.persona.name, '团子');
  assert.equal((await f.call('/pet/persona', 'PUT', { name: '超过八个字的人格名字' })).status, 400);
  const saved = (await f.call('/pet/persona', 'PUT', { name: '汤圆' })).data as PersonaView;
  assert.equal(saved.firstRun, false); assert.equal(saved.persona.name, '汤圆');
  assert.equal((await f.call('/pet/settings', 'PUT', { dailyBubbleCap: 0 })).status, 200);
  assert.equal((await f.call('/pet/settings')).status, 200);
  assert.equal((await f.call('/pet/settings', 'PUT', { dailyBubbleCap: 4 })).status, 400);
  assert.equal((await f.call('/pet/audio', 'PUT', { enabled: true, volume: 0.3 })).status, 200);
  assert.equal((await f.call('/pet/interactions', 'POST', { kind: 'audio_play' })).status, 200);
  assert.equal((await f.call('/pet/quiet/client', 'POST', { reasons: [], detection: 'unknown', ttlMs: 120001 })).status, 400);
  assert.equal((await f.call('/pet/quiet/client', 'POST', { reasons: ['fullscreen'], detection: 'known', ttlMs: 120000 })).status, 200);
  assert.equal((await f.call('/pet/quiet', 'POST', { mode: 'dnd', minutes: 30 })).status, 200);
  await f.call('/pet/quiet/client', 'POST', { reasons: [], detection: 'known', ttlMs: 120000 });
  assert.deepEqual(f.companion.state().quietReasons, ['user_dnd']);
  assert.equal(f.companion.state().audio.playing, false); assert.equal(f.companion.state().audio.enabled, true);
  await f.call('/pet/quiet', 'POST', { mode: 'off' });
  const chat = (await f.call('/chat', 'POST', { message: '汤圆，记住 周五下午不排会' })).data as ChatResponse;
  const chunk = chat.chunks.find((c) => c.kind === 'memory'); assert.ok(chunk && chunk.kind === 'memory');
  const memory = f.memory.get(chunk.itemId)!;
  assert.equal(memory.kind, 'rule'); assert.equal(memory.layer, 'profile');
  assert.equal(memory.origin.kind, 'user');
  assert.match(readFileSync(path.join(f.dir, 'companion', 'user.md'), 'utf8'), /周五下午不排会.*kind=rule/);
  assert.ok(chat.chunks.some((c) => c.kind === 'card' && c.card.actions?.some((a) => a.action === 'memory_undo')));
  if (memory.origin.kind === 'user') {
    assert.ok(f.evidence.verify(memory.origin.evidenceId, 'message'));
    f.advance(600000); assert.equal(f.evidence.verify(memory.origin.evidenceId, 'message'), false);
  }
  const forget = (await f.call('/chat', 'POST', { message: '忘掉 周五' })).data as ChatResponse;
  assert.ok(forget.chunks.some((c) => c.kind === 'card' && c.card.actions?.some((a) => a.action === 'memory_forget')));
  assert.ok(f.memory.get(memory.id));
  const updated = (await f.call(`/memory/${memory.id}`, 'PATCH', { text: '周五不排评审会', validUntil: f.now() + 60000 })).data as MemoryItem;
  assert.equal(updated.text, '周五不排评审会');
  const cleared = (await f.call(`/memory/${memory.id}`, 'PATCH', { validUntil: null })).data as MemoryItem;
  assert.equal(cleared.validUntil, undefined);
  const retyped = (await f.call(`/memory/${memory.id}/retype`, 'POST', { kind: 'fact' })).data as MemoryItem;
  assert.equal(retyped.kind, 'fact'); assert.equal(retyped.id, memory.id); assert.equal(retyped.layer, memory.layer);
  assert.equal(f.memory.get(memory.id)?.text, cleared.text);
  assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 0);
  assert.equal((await f.call('/memory?layer=long_term&q=周五&limit=5')).status, 200);
  const created = (await f.call('/memory', 'POST', { layer: 'long_term', kind: 'fact', text: '张三负责前端' })).data as MemoryItem;
  assert.equal((await f.call(`/memory/${created.id}`, 'DELETE')).status, 200);
  assert.equal((await f.call(`/memory/${retyped.id}`, 'DELETE')).status, 200);
  assert.equal((await f.call('/memory/journal?date=2026-11-20')).status, 200);
  const remind = (await f.call('/reminders', 'POST', { text: '交周报', dueAt: f.now() + 60000 })).data as Reminder;
  assert.equal((await f.call('/reminders?status=scheduled')).status, 200);
  const cancelled = (await f.call(`/reminders/${remind.id}`, 'DELETE')).data as Reminder;
  assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.text, '');
  assert.doesNotMatch(JSON.stringify(f.events().filter((e) => e.type === 'reminder.changed')), /交周报/);
  const item = (await f.call('/notices', 'POST', notice)).data as NoticeRecord;
  assert.equal((await f.call('/notices?status=unread&limit=5')).status, 200);
  assert.equal((await f.call(`/notices/${item.id}/snooze`, 'POST', { minutes: 5 })).status, 200);
  assert.equal((await f.call(`/notices/${item.id}/read`, 'POST')).status, 200);
  assert.equal((await f.call(`/notices/${item.id}/dismiss`, 'POST')).status, 200);
  await f.stop();
  assert.equal(existsSync(path.join(f.dir, 'run', 'daemon.json')), false);
  assert.equal(existsSync(path.join(f.dir, 'run', 'daemon.lock')), false);
  assert.doesNotMatch(f.logs.join(''), /周五|张三|原样通知|交周报/);
  assert.ok(!f.logs.join('').includes(f.token));
});

test('authenticated reindex preserves entries and safety tables', async (t) => {
  const f = await fixture(t);
  const item = (await f.call('/memory', 'POST', { layer: 'long_term', kind: 'fact', text: '前端评审在周五' })).data as MemoryItem;
  assert.equal((await f.call('/memory/reindex', 'POST', undefined, { Authorization: '' })).status, 401);
  assert.equal((await f.call('/memory/reindex', 'POST', { unexpected: true })).status, 400);
  assert.equal((await f.call('/memory/reindex', 'POST')).status, 200);
  assert.equal(f.memory.get(item.id)?.text, '前端评审在周五');
  await f.call(`/memory/${item.id}`, 'DELETE');
  const before = f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones'));
  assert.deepEqual((await f.call('/memory/reindex', 'POST')).data, { ok: true });
  assert.deepEqual(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')), before);
  assert.ok(f.events().some((e) => e.type === 'memory.changed' && e.data.change === 'reindexed'));
});

test('retype failure never invokes forget or deletes the original memory', async (t) => {
  const f = await fixture(t);
  const item = (await f.call('/memory', 'POST', { layer: 'long_term', kind: 'fact', text: '原位修改不能丢掉这条事实' })).data as MemoryItem;
  const before = readFileSync(item.file, 'utf8');
  const events = f.events().length;
  f.memory.retype = () => { throw new ContractError('conflict', 'private-retype-detail'); };
  f.memory.forget = () => { assert.fail('retype must not forget'); };
  const result = await f.call(`/memory/${item.id}/retype`, 'POST', { kind: 'rule' });
  assert.equal(result.status, 409); assert.ok(!JSON.stringify(result.data).includes('private-retype-detail'));
  assert.equal(readFileSync(item.file, 'utf8'), before); assert.deepEqual(f.memory.get(item.id), item);
  assert.equal(f.events().length, events);
  assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 0);
});

test('all memory ContractError codes map to HTTP without leaking error body', async (t) => {
  const f = await fixture(t);
  const original = f.memory.update.bind(f.memory);
  for (const [code, status] of [['rejected', 422], ['tombstoned', 409], ['not_found', 404], ['bad_request', 400]] as const) {
    f.memory.update = () => { throw new ContractError(code, 'private-memory-original'); };
    const res = await f.call('/memory/any', 'PATCH', { text: '普通事实' });
    assert.equal(res.status, status); assert.ok(!JSON.stringify(res.data).includes('private-memory-original'));
  }
  f.memory.update = original;
});

test('SSE hello, persistent increasing IDs, replay, retention resync and bye', async (t) => {
  const f = await fixture(t, 4);
  const fresh = await openStream(f.base, f.token);
  t.after(() => fresh.close());
  await fresh.until((s) => s.includes('event: hello'));
  assert.match(fresh.text(), /retry: 3000/);
  const checkpoint = f.eventHub.seq();
  f.eventHub.emit({ type: 'memory.changed', data: { change: 'reindexed' } });
  await fresh.until((s) => s.includes('event: memory.changed'));
  const replay = await openStream(f.base, f.token, checkpoint);
  t.after(() => replay.close());
  await replay.until((s) => s.includes('event: memory.changed'));
  assert.match(replay.text(), new RegExp(`id: ${checkpoint + 1}`));
  for (let i = 0; i < 8; i++) f.eventHub.emit({ type: 'memory.changed', data: { change: 'reindexed' } });
  const stale = await openStream(f.base, f.token, checkpoint);
  t.after(() => stale.close());
  await stale.until((s) => s.includes('event: resync_required'));
  assert.equal(f.storage.transaction((tx) => tx.all('SELECT id FROM ui_events')).length, 4);
  await f.stop();
  await fresh.until((s) => s.includes('event: bye'));
});

test('play accepts the box entry only, not arbitrary game frames or extra fields', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call('/pet/interactions', 'POST', { kind: 'play', activityId: 'box_peek' })).status, 200);
  for (const activityId of ['box_hide', 'box_pop', 'ball_catch', 'unknown']) {
    assert.equal((await f.call('/pet/interactions', 'POST', { kind: 'play', activityId })).status, 400);
  }
  assert.equal((await f.call('/pet/interactions', 'POST', { kind: 'play', activityId: 'box_peek', caught: 3 })).status, 400);
});

test('HTTP moves past occupied port without stopping occupant', async (t) => {
  const f = await fixture(t);
  await f.http.stop();
  const blocker = createServer();
  await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => blocker.close(() => resolve())));
  const first = (blocker.address() as { port: number }).port;
  const chosen = await f.http.listen(first, first + 10);
  assert.ok(chosen > first); assert.ok(blocker.listening);
  assert.equal((await fetch(`http://127.0.0.1:${chosen}/api/v1/health`)).status, 200);
  assert.throws(() => f.memory.forget('missing', OWNER_ACTOR), { code: 'rejected' });
});
