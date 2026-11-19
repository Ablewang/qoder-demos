import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fixture } from '../surfaces/fixture.ts';
import { createLineSelector, safeAssistantText } from '../../src/companion/lines.ts';
import { DEFAULT_PERSONA, parsePersona, serializePersona, validatePersona } from '../../src/companion/persona.ts';
import { memoryValidity, parseReminder, normalizeCommand } from '../../src/companion/commands.ts';
import type { ChatResponse, Notice, Persona, PetInteraction } from '../../src/contracts/index.ts';
import { startDaemon } from '../../src/daemon.ts';
import { createLogger } from '../../src/platform/logger.ts';

const actor = { kind: 'system' as const, component: 'test' };
const notice = (dedupeKey: string, patch: Partial<Notice> = {}): Notice => ({ title: 'MR 评审人张三 15:30', facts: [{ label: '数量', value: 3, unit: '个', ref: 'mr:1' }, { label: '链接文本', value: 'https://example.invalid/?a=1' }], tone: 'neutral', urgency: 'normal', kind: 'dev.test', sensitivity: 'normal', evidence: [], dedupeKey, ...patch });

test('quiet multi-source lease, audio protection, queued dedupe and exactly one merged bubble', async (t) => {
  const f = await fixture(t);
  await f.call('/pet/audio', 'PUT', { enabled: true, volume: 0.4 });
  await f.companion.onInteraction({ kind: 'audio_play' }); assert.equal(f.companion.state().audio.playing, true);
  f.companion.setQuiet({ source: 'user', reasons: ['user_dnd'], detection: 'known' });
  f.companion.setQuiet({ source: 'client', reasons: ['screen_share'], detection: 'known', expiresAt: f.now() + 1000 });
  assert.equal(f.companion.state().audio.enabled, true); assert.equal(f.companion.state().audio.playing, false);
  f.advance(1001); f.companion.tick();
  assert.equal(f.companion.quietSignals().find((s) => s.source === 'client')!.detection, 'unknown');
  f.companion.setQuiet({ source: 'client', reasons: [], detection: 'known', expiresAt: f.now() + 120000 });
  assert.deepEqual(f.companion.state().quietReasons, ['user_dnd']);
  const before = f.bubbles().length;
  for (const key of ['one', 'one', 'two', 'three', 'four']) await f.notices.submit(notice(key), actor);
  assert.equal(f.bubbles().length, before); assert.equal(f.companion.state().badge.notices, 4);
  f.companion.setQuiet({ source: 'user', reasons: [], detection: 'known' });
  assert.equal(f.bubbles().length, before + 1); assert.match(f.bubbles().at(-1)!.text, /安静期间来了 4 条/);
  assert.equal(f.bubbles().at(-1)!.facts!.length, 3);
  f.companion.setQuiet({ source: 'user', reasons: [], detection: 'known' }); assert.equal(f.bubbles().length, before + 1);
});

test('quiet exit publishes nonquiet state before the merged utterance', async (t) => {
  const f = await fixture(t);
  for (const expiry of [false, true]) {
    f.companion.setQuiet({ source: 'user', reasons: ['user_dnd'], detection: 'known', ...(expiry ? { expiresAt: f.now() + 1000 } : {}) });
    await f.notices.submit(notice(`state-first-${expiry}`), actor);
    const before = f.events().length;
    if (expiry) { f.advance(1001); f.companion.tick(); }
    else f.companion.setQuiet({ source: 'user', reasons: [], detection: 'known' });
    const events = f.events().slice(before);
    const utterance = events.findIndex((e) => e.type === 'pet.utterance');
    const state = events.findIndex((e) => e.type === 'pet.state' && e.data.state.activity !== 'quiet');
    assert.ok(state >= 0 && utterance > state);
  }
});

test('daily cap, high and user exceptions, original facts and sensitivity filtering', async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 5; i++) await f.notices.submit(notice(`cap-${i}`), actor);
  assert.equal(f.bubbles().length, 3); assert.equal(f.companion.state().badge.notices, 5);
  const first = f.bubbles()[0];
  assert.deepEqual(first.facts, [{ label: '标题', value: 'MR 评审人张三 15:30' }, ...notice('ignored').facts]);
  assert.doesNotMatch(first.text, /张三|15:30|example.invalid/);
  await f.notices.submit(notice('high', { urgency: 'high' }), actor); assert.equal(f.bubbles().length, 4);
  f.advance(24 * 3600_000); await f.notices.submit(notice('next-day'), actor); assert.equal(f.bubbles().length, 5);
  const count = f.bubbles().length;
  await f.notices.submit(notice('secret', { sensitivity: 'secret', urgency: 'high', title: 'secret raw title' }), actor);
  assert.equal(f.bubbles().length, count);
  const confidential = await f.notices.submit(notice('confidential', { sensitivity: 'confidential', urgency: 'high', title: 'confidential raw title' }), actor);
  const bubble = f.bubbles().at(-1)!;
  assert.equal(bubble.text, '有一条敏感通知'); assert.equal(bubble.facts, undefined); assert.equal(bubble.sensitivity, 'confidential');
  assert.equal(bubble.ref!.noticeId, confidential.id);
  const list = await f.call('/notices'); assert.ok(!JSON.stringify(list.data).includes('secret raw title'));
  assert.ok(!JSON.stringify(f.events()).includes('secret raw title'));
  await f.call('/pet/settings', 'PUT', { discloseConfidentialInBubble: true });
  await f.notices.submit(notice('disclosed', { sensitivity: 'confidential', urgency: 'high' }), actor);
  assert.deepEqual(f.bubbles().at(-1)!.facts, [{ label: '标题', value: notice('unused').title }, ...notice('unused').facts]);
});

test('low notices stay in the notice center, interactions only nurture, dismissal and throttles remain', async (t) => {
  const f = await fixture(t);
  const low = await f.notices.submit(notice('low', { urgency: 'low', tone: 'good_news' }), actor);
  assert.equal(f.bubbles().length, 0);
  const eventOffset = f.events().length;
  assert.equal(await f.companion.onInteraction({ kind: 'hover' }), null);
  assert.equal(await f.companion.onInteraction({ kind: 'click' }), null);
  assert.equal(await f.companion.onInteraction({ kind: 'double_click' }), null);
  assert.equal(await f.companion.onInteraction({ kind: 'click' }), null);
  const firstPet = await f.companion.onInteraction({ kind: 'pet' }); assert.ok(firstPet);
  assert.equal(firstPet.animation, 'pet_squint');
  assert.equal(f.companion.state().expression!.animationId, 'pet_squint');
  assert.equal(await f.companion.onInteraction({ kind: 'pet' }), null);
  f.advance(600000); assert.ok(await f.companion.onInteraction({ kind: 'pet' }));
  const poke = await f.companion.onInteraction({ kind: 'poke', times: 6 }); assert.ok(poke);
  assert.equal(poke.animation, 'poke_pout');
  assert.equal(f.companion.state().expression!.animationId, 'poke_pout');
  assert.equal(await f.companion.onInteraction({ kind: 'poke', times: 6 }), null);
  assert.ok(await f.companion.onInteraction({ kind: 'drag_start' }));
  assert.equal(await f.companion.onInteraction({ kind: 'drag_start' }), null);
  const interactionEvents = f.events().slice(eventOffset);
  assert.ok(!interactionEvents.some((event) => event.type.startsWith('notice.')));
  for (const event of interactionEvents) if (event.type === 'pet.utterance') {
    assert.equal(event.data.utterance.ref, undefined);
    assert.equal(event.data.utterance.facts, undefined);
    assert.equal(event.data.utterance.quickActions, undefined);
  }
  assert.equal(f.notices.get(low.id).status, 'unread');
  assert.equal(f.companion.state().badge.notices, 1);
  assert.deepEqual(f.notices.list({ status: 'unread' }).map((record) => record.id), [low.id]);
  const center = await f.call('/notices?status=unread');
  assert.equal(center.status, 200); assert.ok(JSON.stringify(center.data).includes(low.id));
  const delivery = f.storage.transaction((tx) => tx.get('SELECT emitted, low FROM comp_delivery WHERE notice_id = ?', [low.id]))!;
  assert.equal(delivery.emitted, 0); assert.equal(delivery.low, 1);
  const beforeStandard = f.bubbles().length;
  const standard = await f.notices.submit(notice('dismissed'), actor);
  assert.equal(f.bubbles().length, beforeStandard + 1);
  const utterance = f.bubbles().at(-1)!;
  assert.equal(utterance.ref!.noticeId, standard.id);
  assert.equal(utterance.animation, 'sign_hold');
  await f.companion.onInteraction({ kind: 'utterance_dismissed', id: utterance.id });
  await f.notices.snooze(standard.id, 5);
  const before = f.bubbles().length;
  f.advance(5 * 60000); await f.notices.scan(); assert.equal(f.bubbles().length, before);
  assert.equal(f.notices.get(standard.id).status, 'unread');
  assert.equal(f.notices.get(low.id).status, 'unread');
  assert.equal(f.companion.state().badge.notices, 2);
});

test('persona Unicode limits, YAML/Markdown round-trip and no unsafe owner modification', async (t) => {
  const f = await fixture(t);
  const persona: Persona = { ...structuredClone(DEFAULT_PERSONA), name: '小\"团子', description: '# 我是谁\n\n一起工作。\n', traits: ['温柔', '靠谱'] };
  assert.deepEqual(parsePersona(serializePersona(persona)), persona);
  validatePersona({ ...persona, name: '团'.repeat(8) });
  for (const patch of [{ name: '' }, { addressUser: '你'.repeat(7) }, { traits: ['traittoolong'] }, { catchphrases: Array(4).fill('好') }, { taboos: ['字'.repeat(21)] }, { description: '字'.repeat(2001) }, { skin: 'other' }]) {
    assert.equal((await f.call('/pet/persona', 'PUT', patch)).status, 400);
  }
  assert.throws(() => f.companion.updatePersona({ name: '坏' }, { kind: 'system', component: 'test' }), { code: 'rejected' });
  assert.equal((await f.call('/pet/persona', 'PUT', persona)).status, 200);
  assert.equal(f.companion.personaView().firstRun, false);
  assert.deepEqual(parsePersona(readFileSync(path.join(f.dir, 'companion', 'persona.md'), 'utf8')), persona);
});

test('line library personality weighting, latest-five avoidance, taboo/formality/tone, catchphrase and emoji', () => {
  const persona = structuredClone(DEFAULT_PERSONA);
  persona.traits = ['温柔', '毒舌', '傲娇', '元气'];
  const select = createLineSelector(() => 0.99);
  assert.match(select('pet', persona), /被摸头了/);
  const second = select('pet', persona); assert.notEqual(second, '被摸头了，心情变软。');
  const card = createLineSelector(() => 0);
  persona.catchphrases = ['嘿']; persona.speakingStyle.emoji = true;
  assert.match(card('pet', persona), /嘿❤️$/u);
  assert.doesNotMatch(card('notice', persona, { card: true }), /嘿/);
  persona.speakingStyle.verbosity = 'terse'; assert.doesNotMatch(createLineSelector(() => 0)('pet', persona), /嘿/);
  persona.speakingStyle.verbosity = 'normal'; persona.speakingStyle.emoji = false;
  persona.speakingStyle.formality = 'neutral'; persona.taboos = ['摸归摸', '再往左'];
  for (let i = 0; i < 100; i++) assert.doesNotMatch(select('pet', persona), /摸归摸|再往左/);
  for (const tone of ['concern', 'care']) assert.doesNotMatch(createLineSelector(() => 0.99)('notice', persona, { tone }), /又来活了/);
});

test('local command normalization, rules, expiry, reminders and chat cards stay factual', async (t) => {
  const f = await fixture(t);
  assert.equal(normalizeCommand('@团子，记住：周五不排会', '团子'), '记住:周五不排会');
  for (const text of ['今天不排会', '明天不排会', '这周不排会', '本周不排会', '下周不排会', '本月不排会', '到12月1日不排会']) assert.ok(memoryValidity(text, f.now())! > f.now());
  assert.equal(parseReminder('30 分钟后提醒我交周报', f.now())!.dueAt, f.now() + 1800000);
  assert.ok(parseReminder('15:30 提醒我评审', f.now())); assert.ok(parseReminder('明天 9 点提醒我评审', f.now()));
  const commands = ['记住 张三负责前端', '你记得什么', '你记得关于张三的事吗', '忘掉 张三', '30 分钟后提醒我交周报', '勿扰 1 小时', '取消勿扰', '有什么通知', '几条未读', '你是谁', '你叫什么', '你会什么', '陪伴几天了', '我们多熟了', '现在几点', '今天几号', '帮助', '请帮我发消息'];
  for (const message of commands) {
    const res = await f.call('/chat', 'POST', { message }); assert.equal(res.status, 200, message);
    const data = res.data as ChatResponse; assert.equal(data.chunks.at(-1)!.kind, 'done');
  }
  assert.equal(f.memory.longTerm().length, 1);
  const refused = (await f.call('/chat', 'POST', { message: '记住 token 不要记录' })).data as ChatResponse;
  assert.ok(refused.chunks.some((c) => c.kind === 'text' && c.text.includes('我不记这种东西')));
  assert.equal(f.memory.longTerm().length, 1);
  const rows = f.storage.transaction((tx) => tx.all('SELECT * FROM ui_user_evidence'));
  assert.ok(rows.length > 0); assert.ok(rows.every((r) => !('text' in r) && !('message' in r)));
});

test('growth is monotonic, affinity capped at 20/day, milestones low and diary counts only', async (t) => {
  const f = await fixture(t);
  for (let day = 0; day < 7; day++) {
    for (let i = 0; i < 30; i++) await f.companion.onInteraction({ kind: 'feed' });
    assert.equal(f.companion.state().growth.stats.affinity, (day + 1) * 20);
    if (day < 6) { f.advance(24 * 3600_000); f.companion.tick(); }
  }
  const growth = f.companion.state().growth;
  assert.equal(growth.stats.companionDays, 7);
  assert.deepEqual(growth.unlocked.slice().sort(), ['headset_mint', 'ball_yarn', 'act_read_notebook', 'headset_sakura'].sort());
  assert.equal(growth.level, 5);
  const milestones = f.notices.list().filter((n) => n.notice.kind === 'companion.milestone');
  assert.equal(milestones.length, 4); assert.ok(milestones.every((n) => n.notice.urgency === 'low'));
  await f.call('/chat', 'POST', { message: '记住 周五不排会' });
  const memory = f.memory.profile()[0]; await f.call(`/memory/${memory.id}`, 'DELETE');
  assert.deepEqual(f.companion.state().growth, growth);
  await f.stop();
  const journal = readFileSync(path.join(f.dir, 'companion', 'journal', '2026-11-26.md'), 'utf8');
  assert.match(journal, /喂零食 30/); assert.match(journal, /截至/);
  assert.doesNotMatch(journal, /周五|张三|MR|example.invalid/);
});

test('quiet entry clears active expression and audio; every interaction stays quiet without replay', async (t) => {
  const f = await fixture(t);
  await f.call('/pet/audio', 'PUT', { enabled: true, volume: 0.4 });
  const previous = await f.companion.onInteraction({ kind: 'pet' });
  assert.ok(previous); assert.equal(f.companion.state().expression!.animationId, 'pet_squint');
  await f.companion.onInteraction({ kind: 'audio_play' });
  assert.equal(f.companion.state().audio.playing, true);
  f.companion.setQuiet({ source: 'user', reasons: ['user_dnd'], detection: 'known' });
  assert.equal(f.companion.state().expression, undefined);
  assert.equal(f.companion.state().audio.playing, false);
  await f.notices.submit(notice('quiet-low', { urgency: 'low' }), actor);
  await f.notices.submit(notice('quiet-high', { urgency: 'high' }), actor);
  const before = f.bubbles().length;
  const eventOffset = f.events().length;
  const interactions: PetInteraction[] = [
    { kind: 'hover' }, { kind: 'click' }, { kind: 'double_click' }, { kind: 'pet' },
    { kind: 'poke', times: 3 }, { kind: 'poke', times: 6 }, { kind: 'drag_start' },
    { kind: 'drop' }, ...(['top', 'left', 'right', 'bottom'] as const).map((screenEdge) => ({ kind: 'drop' as const, screenEdge })),
    { kind: 'feed' }, ...['play_ball', 'stretch', 'music_nod', 'read_notebook', 'box_peek'].map((activityId) => ({ kind: 'play' as const, activityId })),
    { kind: 'audio_play' }, { kind: 'audio_pause' }, { kind: 'utterance_dismissed', id: previous.id },
  ];
  for (const interaction of interactions) {
    assert.equal(await f.companion.onInteraction(interaction), null, interaction.kind);
    const state = f.companion.state();
    assert.equal(state.activity, 'quiet', interaction.kind);
    assert.equal(state.expression, undefined, interaction.kind);
    assert.equal(state.audio.playing, false, interaction.kind);
    assert.equal(state.audio.enabled, true);
  }
  assert.equal(f.bubbles().length, before);
  for (const event of f.events().slice(eventOffset)) {
    if (event.type !== 'pet.state') continue;
    assert.equal(event.data.state.activity, 'quiet');
    assert.equal(event.data.state.expression, undefined);
    assert.equal(event.data.state.audio.playing, false);
  }
  const counts = f.storage.transaction((tx) => JSON.parse(String(tx.get('SELECT counts_json FROM comp_daily')!.counts_json))) as Record<string, number>;
  assert.equal(counts.pet, 2); assert.equal(counts.poke, 2); assert.equal(counts.feed, 1); assert.equal(counts.play, 5);
  assert.equal(f.companion.state().growth.stats.affinity, 10);
  f.companion.setQuiet({ source: 'user', reasons: [], detection: 'known' });
  assert.equal(f.bubbles().length, before + 1);
  assert.equal(f.companion.state().expression, undefined);
  assert.equal(f.companion.state().audio.playing, false);
});

test('quiet expiry at offwork emits one summary, uses one cap slot and never defers extra chatter', async (t) => {
  const f = await fixture(t);
  const untilOffwork = 6.5 * 3600_000;
  f.companion.setQuiet({ source: 'user', reasons: ['user_dnd'], detection: 'known', expiresAt: f.now() + untilOffwork });
  await f.notices.submit(notice('expiry-one'), actor);
  await f.notices.submit(notice('expiry-two'), actor);
  f.advance(untilOffwork); f.companion.tick();
  assert.equal(f.bubbles().length, 1); assert.match(f.bubbles()[0].text, /安静期间来了 2 条/);
  const daily = () => f.storage.transaction((tx) => tx.get('SELECT bubbles, offwork FROM comp_daily'))!;
  assert.equal(daily().bubbles, 1); assert.equal(daily().offwork, 1);
  f.companion.tick(); f.advance(60_000); f.companion.tick();
  assert.equal(f.bubbles().length, 1);
  for (const key of ['remaining-one', 'remaining-two', 'over-cap']) await f.notices.submit(notice(key), actor);
  assert.equal(f.bubbles().length, 3); assert.equal(daily().bubbles, 3);
});

test('taboo-filtered quiet summary and offwork text never spend invisible cap slots', async (t) => {
  for (const blockOffwork of [false, true]) await t.test(blockOffwork ? 'both omitted' : 'offwork still fits the cap', async (t) => {
    const f = await fixture(t);
    await f.call('/pet/persona', 'PUT', { taboos: blockOffwork ? ['安静', '🔔', '🍵'] : ['安静', '攒'], speakingStyle: { ...f.companion.persona().speakingStyle, emoji: blockOffwork } });
    await f.call('/pet/settings', 'PUT', { dailyBubbleCap: 1 });
    const before = f.bubbles().length;
    const untilOffwork = 6.5 * 3600_000;
    f.companion.setQuiet({ source: 'user', reasons: ['user_dnd'], detection: 'known', expiresAt: f.now() + untilOffwork });
    await f.notices.submit(notice('blocked-summary'), actor);
    f.advance(untilOffwork); f.companion.tick();
    assert.equal(f.bubbles().length, before + (blockOffwork ? 0 : 1));
    assert.equal(f.storage.transaction((tx) => tx.get('SELECT bubbles FROM comp_daily'))!.bubbles, blockOffwork ? 0 : 1);
    if (!blockOffwork) assert.match(f.bubbles().at(-1)!.text, /下班/);
    await f.call('/pet/persona', 'PUT', { taboos: [], speakingStyle: { ...f.companion.persona().speakingStyle, emoji: false } });
    const count = f.bubbles().length;
    f.companion.tick(); assert.equal(f.bubbles().length, count);
    await f.notices.submit(notice('after-filtering'), actor);
    assert.equal(f.bubbles().length, count + (blockOffwork ? 1 : 0));
  });
});

test('final decorated lines reject taboo words across catchphrase and emoji boundaries', () => {
  const persona = structuredClone(DEFAULT_PERSONA);
  persona.catchphrases = ['嘿'];
  persona.taboos = ['～嘿'];
  assert.equal(createLineSelector(() => 0)('pet', persona), '');
  persona.catchphrases = []; persona.speakingStyle.emoji = true;
  persona.taboos = ['～❤️'];
  assert.equal(createLineSelector(() => 0)('pet', persona), '');
  persona.taboos = ['❤️'];
  assert.equal(createLineSelector(() => 0)('pet', persona), '');
  persona.taboos = [];
  assert.match(createLineSelector(() => 0)('pet', persona), /❤️$/u);
});

test('chat literals and fallbacks obey current taboos while user-owned memory facts stay intact', async (t) => {
  const f = await fixture(t);
  await f.call('/pet/persona', 'PUT', { taboos: ['记', '本', '保存', '记录'] });
  const original = '我想记星星';
  const remembered = (await f.call('/chat', 'POST', { message: `记住 ${original}` })).data as ChatResponse;
  assert.ok(!remembered.chunks.some((chunk) => chunk.kind === 'text'));
  assert.equal(remembered.chunks.at(-1)!.kind, 'done');
  const card = remembered.chunks.find((chunk) => chunk.kind === 'card');
  assert.ok(card?.kind === 'card'); assert.equal(card.card.facts![0].value, original);
  assert.equal(f.memory.longTerm()[0].text, original);
  await f.call('/pet/persona', 'PUT', { taboos: ['记事'] });
  const unknown = (await f.call('/chat', 'POST', { message: '还不支持的指令' })).data as ChatResponse;
  assert.ok(!unknown.chunks.some((chunk) => chunk.kind === 'text'));
  await f.call('/pet/persona', 'PUT', { taboos: ['安静', '通知', '结束', '勿扰'] });
  for (const message of ['勿扰 1 小时', '取消勿扰']) {
    const response = (await f.call('/chat', 'POST', { message })).data as ChatResponse;
    assert.ok(!response.chunks.some((chunk) => chunk.kind === 'text'), message);
    assert.equal(response.chunks.at(-1)!.kind, 'done');
  }
  assert.deepEqual(f.companion.state().quietReasons, []);
  await f.call('/pet/persona', 'PUT', { taboos: [] });
  const safe = (await f.call('/chat', 'POST', { message: '取消勿扰' })).data as ChatResponse;
  assert.ok(safe.chunks.some((chunk) => chunk.kind === 'text' && chunk.text === '勿扰已取消。'));
});

test('notification literals and final prefixes obey taboos; nurturing leaves low facts and cap intact', async (t) => {
  const f = await fixture(t);
  await f.call('/pet/persona', 'PUT', { addressUser: '你', taboos: ['敏感', '～ 你'] });
  const persona = f.companion.persona();
  const prefix = createLineSelector(() => 0)('pet', persona, { card: true });
  const selected = createLineSelector(() => 0)('notice', persona, { card: true });
  assert.ok(prefix.endsWith('～')); assert.ok(selected.startsWith('你'));
  assert.equal(safeAssistantText(prefix, persona), prefix);
  assert.equal(safeAssistantText(selected, persona), selected);
  assert.equal(safeAssistantText(`${prefix} ${selected}`, persona), '');
  const before = f.bubbles().length;
  const protectedNotice = await f.notices.submit(notice('taboo-confidential', { sensitivity: 'confidential' }), actor);
  assert.equal(f.bubbles().length, before);
  assert.equal(f.notices.get(protectedNotice.id).status, 'unread');
  const original = '事实中保留～ 你和敏感';
  const low = await f.notices.submit(notice('taboo-prefix', { urgency: 'low', title: original }), actor);
  const eventOffset = f.events().length;
  const response = await f.companion.onInteraction({ kind: 'pet' });
  assert.ok(response); assert.equal(response.ref, undefined);
  assert.equal(response.facts, undefined); assert.equal(response.quickActions, undefined);
  assert.doesNotMatch(response.text, /敏感|～ 你/);
  assert.equal(await f.companion.onInteraction({ kind: 'click' }), null);
  assert.equal(await f.companion.onInteraction({ kind: 'double_click' }), null);
  assert.ok(!f.events().slice(eventOffset).some((event) => event.type.startsWith('notice.')));
  assert.equal(f.storage.transaction((tx) => tx.get('SELECT bubbles FROM comp_daily'))!.bubbles, 0);
  const delivery = f.storage.transaction((tx) => tx.get('SELECT emitted, low FROM comp_delivery WHERE notice_id = ?', [low.id]))!;
  assert.equal(delivery.emitted, 0); assert.equal(delivery.low, 1);
  assert.equal(f.notices.get(low.id).status, 'unread');
  assert.equal(f.notices.get(low.id).notice.title, original);
  assert.equal(f.companion.state().badge.notices, 2);
  const center = await f.call('/notices?status=unread');
  assert.equal(center.status, 200); assert.ok(JSON.stringify(center.data).includes(original));
  const standard = await f.notices.submit(notice('taboo-facts', { title: original }), actor);
  const bubble = f.bubbles().at(-1)!;
  assert.equal(bubble.ref!.noticeId, standard.id);
  assert.equal(bubble.facts![0].value, original);
  assert.doesNotMatch(bubble.text, /敏感|～ 你/);
  assert.equal(f.storage.transaction((tx) => tx.get('SELECT bubbles FROM comp_daily'))!.bubbles, 1);
});

test('dismissed pet, poke, drag and drop chatter survives restart until the precise 30-minute boundary', async (t) => {
  const cases: Array<{ name: string; interaction: PetInteraction; delay: number; affinity: number }> = [
    { name: 'pet', interaction: { kind: 'pet' }, delay: 600_000, affinity: 4 },
    { name: 'poke', interaction: { kind: 'poke', times: 6 }, delay: 30_000, affinity: 4 },
    { name: 'drag', interaction: { kind: 'drag_start' }, delay: 30_000, affinity: 0 },
    { name: 'drop', interaction: { kind: 'drop', screenEdge: 'top' }, delay: 0, affinity: 0 },
  ];
  for (const entry of cases) await t.test(entry.name, async (t) => {
    const f = await fixture(t);
    const response = await f.companion.onInteraction(entry.interaction); assert.ok(response);
    await f.companion.onInteraction({ kind: 'utterance_dismissed', id: response.id });
    const dismissedAt = f.now();
    await f.stop();
    const restarted = await startDaemon({ config: f.config, now: f.now, secrets: { get: async () => f.token, set: async () => { throw new Error('unexpected secret write'); }, delete: async () => {} }, log: createLogger({ write: () => {} }), random: () => 0 });
    try {
      const throttles = restarted.storage.transaction((tx) => JSON.parse(String(tx.get('SELECT value FROM comp_values WHERE key = ?', ['throttles'])!.value))) as Array<[string, number]>;
      assert.equal(new Map(throttles).get(`dismiss:${entry.name}`), dismissedAt);
      f.advance(entry.delay + 1);
      assert.equal(await restarted.companion.onInteraction(entry.interaction), null);
      f.advance(1800_000 - entry.delay - 2);
      assert.equal(f.now() - dismissedAt, 1799_999);
      assert.equal(await restarted.companion.onInteraction(entry.interaction), null);
      f.advance(1);
      assert.ok(await restarted.companion.onInteraction(entry.interaction));
      assert.equal(restarted.companion.state().growth.stats.affinity, entry.affinity);
      assert.equal(restarted.companion.state().growth.stats.companionDays, 1);
      if (entry.delay) assert.equal(await restarted.companion.onInteraction(entry.interaction), null);
    } finally { await restarted.stop(); }
  });
});

test('unread chat aggregate retains maximum confidential/secret sensitivity and masks protected titles', async (t) => {
  const f = await fixture(t);
  const oldestSecret = await f.notices.submit(notice('oldest-secret', { sensitivity: 'secret', title: 'hidden-old-secret' }), actor);
  f.advance(1); await f.notices.submit(notice('normal-one', { urgency: 'low', title: '公开标题一' }), actor);
  f.advance(1); await f.notices.submit(notice('normal-two', { urgency: 'low', title: '公开标题二' }), actor);
  f.advance(1); const confidential = await f.notices.submit(notice('mixed-confidential', { sensitivity: 'confidential', title: 'hidden-confidential' }), actor);
  await f.call('/pet/settings', 'PUT', { discloseConfidentialInBubble: true });
  const aggregate = async () => {
    const response = (await f.call('/chat', 'POST', { message: '有什么通知' })).data as ChatResponse;
    const chunk = response.chunks.find((chunk) => chunk.kind === 'card'); assert.ok(chunk?.kind === 'card');
    assert.doesNotMatch(JSON.stringify(chunk.card), /hidden-old-secret|hidden-new-secret|hidden-confidential/);
    return chunk.card;
  };
  let card = await aggregate();
  assert.equal(card.sensitivity, 'secret'); assert.equal(card.facts![0].value, 4);
  assert.deepEqual(card.facts!.slice(1).map((fact) => fact.value), ['有一条敏感通知', '公开标题二', '公开标题一']);
  f.advance(1); const newestSecret = await f.notices.submit(notice('newest-secret', { sensitivity: 'secret', title: 'hidden-new-secret' }), actor);
  card = await aggregate();
  assert.equal(card.sensitivity, 'secret'); assert.equal(card.facts![1].value, '一条机密通知');
  await f.notices.read(newestSecret.id); await f.notices.read(oldestSecret.id);
  assert.equal((await aggregate()).sensitivity, 'confidential');
  await f.notices.read(confidential.id);
  assert.equal((await aggregate()).sensitivity, 'normal');
});
