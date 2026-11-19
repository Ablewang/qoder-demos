import assert from 'node:assert/strict';
import { Game } from '../src/core/game.js';
import { LocalBackend, API_ROUTES } from '../src/core/api.js';
import { validateSnapshot } from '../src/core/schema.js';
import { stats, makeMonster } from '../src/core/model.js';
import { SKILLS } from '../src/data/classes.js';
import { ITEMS } from '../src/data/items.js';
import { economyAction } from '../src/core/economy.js';
import { REALTIME_RULES, aggroRadius, createBattle, enableRealtime, advanceRealtime, realtimeAction, realtimeLoadout, skillCooldown, takeTurn } from '../src/core/combat.js';

// Deliberate mechanics fixtures, not organically earned levels/equipment.
// Fixed RNG, in-memory CAS/receipt store, no IndexedDB, sleeps or wall-clock ticks.
const originalRandom = Math.random;
Math.random = () => 0.5;
let passed = 0;
const failures = [];
async function test(name, run) {
  try { await run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, error }); console.error(`FAIL ${name}: ${error.stack}`); }
}
function fixture({ cls = 'wizard', count = 1, type = 'magic', realtime = true, skills = false } = {}) {
  const g = new Game(); g.start('实时时钟', cls);
  const p = g.p;
  p.lv = 80; p.cult = 8; p.chi = 300; p.location = 'h_f1';
  p.attrs = { str: 200, con: 200, dex: 200, mag: 200 };
  p.skills = skills ? Object.fromEntries(SKILLS[cls].filter((s) => s.kind !== 'passive').map((s) => [s.id, 1])) : {};
  const st = stats(p); p.hp = st.hp; p.mp = st.mp;
  g.state.battle = createBattle(p, Array.from({ length: count }, (_, i) => ({
    ...makeMonster(`计时敌人${i}`, 80, '', type, i), hp: 1e7, maxHp: 1e7, atk: 100, accuracy: 10, dodge: 0, crit: 0,
  })), { type: 'field', zone: p.location });
  if (realtime) { g.enableRealtime(); g.battle.rt.autoSkills = false; }
  return g;
}
const tick = (g, steps = 1, direction = 'stop', targetId) => g.advanceRealtime({ steps, direction, ...(targetId === undefined ? {} : { targetId }) });
const runTicks = (g, count, direction = 'stop') => {
  for (let i = 0; i < count; i++) tick(g, 1, direction);
};
const events = (g, kind, actor) => g.battle.rt.events.filter((e) => e.kind === kind && (actor === undefined || e.actor === actor));
function unchanged(g, run, pattern) {
  const before = structuredClone(g.state);
  assert.throws(run, pattern);
  assert.deepEqual(g.state, before);
}
function far(g) {
  g.battle.rt.player.x = -4; g.battle.rt.player.z = -2.8;
  for (const e of Object.values(g.battle.rt.enemies)) { e.x = 4; e.z = 2.8; }
}
function close(g) {
  const e = g.battle.rt.enemies[g.battle.monsters[0].id];
  e.x = g.battle.rt.player.x + 0.5; e.z = g.battle.rt.player.z;
}
class MemoryStore {
  record = null;
  receipts = new Map();
  fail = false;
  async current() { return structuredClone(this.record); }
  async receipt(id) { return structuredClone(this.receipts.get(id)); }
  async commit(snapshot, expected, receipt) {
    if (this.fail) throw Object.assign(new Error('Injected transaction abort'), { code: 'STORAGE_WRITE_FAILED' });
    if ((this.record?.revision || 0) !== expected) throw Object.assign(new Error('CAS conflict'), { code: 'REVISION_CONFLICT' });
    const previous = this.receipts.get(receipt.id);
    if (previous) return { record: structuredClone(this.record), receipt: structuredClone(previous), duplicate: true };
    const revision = expected + 1;
    this.record = { schemaVersion: 2, revision, snapshot: structuredClone(snapshot) };
    this.receipts.set(receipt.id, structuredClone(receipt));
    return { record: structuredClone(this.record), receipt: structuredClone(receipt), duplicate: false };
  }
}
async function backend(g = fixture({ realtime: false })) {
  const store = new MemoryStore();
  const api = new LocalBackend(store);
  await api.request('POST', '/v1/save/import', { snapshot: g.state, confirm: true });
  return api;
}
async function apiUnchanged(api, path, body, options) {
  const state = api.game.state, disk = await api.store.current(), revision = api.revision;
  await assert.rejects(api.request('POST', path, body, options));
  assert.deepEqual(api.game.state, state); assert.deepEqual(await api.store.current(), disk); assert.equal(api.revision, revision);
}
try {
  await test('旧战斗不默认启用；实时启用保持约定字段、位置和护符时钟', () => {
    const g = fixture({ realtime: false, count: 4 });
    assert.equal(g.battle.rt, undefined); assert.equal(g.p.charmCooldowns, undefined);
    const rt = enableRealtime(g.p, g.battle);
    assert.deepEqual(rt.player, { x: -1.65, z: 0.55, readyAt: 0, guardUntil: 0, guardReadyAt: 0, potionReadyAt: 0 });
    assert.equal(rt.tick, 0); assert.equal(rt.paused, false); assert.equal(rt.autoSkills, true);
    assert.deepEqual(rt.enemies.m3, { x: 2.75, z: 1.25, readyAt: 6, windupUntil: 0, aim: null });
    assert.deepEqual(g.p.charmCooldowns, { hp: 0, mp: 0 });
    const before = structuredClone(g.state); g.enableRealtime(); assert.deepEqual(g.state, before);
    validateSnapshot(g.state);
    unchanged(g, () => takeTurn(g.p, g.battle, 'attack'));
    unchanged(g, () => g.autoTurn());
    const tooMany = fixture({ count: 5, realtime: false });
    unchanged(tooMany, () => tooMany.enableRealtime(), /1—4/);
  });
  await test('普通攻击前摇至少400ms，不提前扣血；两怪独立发动', () => {
    const g = fixture({ count: 2 }); const hp = g.p.hp;
    tick(g); assert.equal(g.p.hp, hp);
    assert.equal(g.battle.rt.enemies.m0.windupUntil, 3);
    tick(g); assert.equal(g.p.hp, hp);
    assert.equal(g.battle.rt.enemies.m1.windupUntil, 4);
    tick(g); assert.ok(g.p.hp < hp);
    assert.equal(events(g, 'attack', 'm1').length, 0);
    tick(g);
    assert.deepEqual(events(g, 'attack').filter((e) => e.actor.startsWith('m')).map((e) => [e.actor, e.tick]), [['m0', 3], ['m1', 4]]);
    validateSnapshot(g.state);
  });
  await test('近战追击有限速度，普通落下重新判射程并记录miss', () => {
    const g = fixture({ type: 'phys' }); close(g);
    const hp = g.p.hp; tick(g); const e = g.battle.rt.enemies.m0;
    assert.equal(e.windupUntil, 3);
    tick(g, 2, 'left'); assert.equal(g.p.hp, hp);
    assert.ok(events(g, 'miss', 'm0').some((x) => x.name === '射程外'));
    const x = e.x; tick(g, 1, 'left'); assert.ok(Math.abs(e.x - x) <= 2.2 * 0.2 + 1e-9);
  });
  await test('重击锁定坐标，1.2秒前摇，离开半径不伤血', () => {
    const g = fixture(); g.battle.monsters[0].intent = 'heavy';
    const hp = g.p.hp; tick(g);
    const e = g.battle.rt.enemies.m0, aim = structuredClone(e.aim);
    assert.equal(e.windupUntil, 7); assert.deepEqual(aim, { x: -1.65, z: 0.55 });
    tick(g, 5, 'up'); assert.equal(g.p.hp, hp); assert.deepEqual(e.aim, aim);
    tick(g, 1, 'up'); assert.equal(g.p.hp, hp); assert.equal(e.aim, null);
    assert.ok(events(g, 'miss', 'm0').some((x) => x.name === '重击落空'));
    assert.ok(g.battle.logs.some((x) => x.text.includes('落空')));
  });
  await test('守御3秒/8秒CD，重击完美反击；暂停继续不刷新CD', () => {
    const plain = fixture(); plain.battle.monsters[0].intent = 'heavy'; runTicks(plain, 7);
    const damage = events(plain, 'damage', 'm0')[0].amount;
    const g = fixture(); g.battle.monsters[0].intent = 'heavy';
    g.realtimeAction('guard'); assert.equal(g.battle.rt.player.guardUntil, 15); assert.equal(g.battle.rt.player.guardReadyAt, 40);
    unchanged(g, () => g.realtimeAction('guard'), /冷却/);
    runTicks(g, 7);
    assert.ok(events(g, 'damage', 'm0')[0].amount < damage * 0.2);
    assert.ok(events(g, 'attack', 'player').some((x) => x.name === '格挡反击'));
    assert.ok(events(g, 'guard').some((x) => x.name === '完美格挡'));
    g.realtimeAction('pause'); const before = structuredClone(g.state);
    tick(g, 5, 'right'); assert.deepEqual(g.state, before);
    g.realtimeAction('resume'); assert.equal(g.battle.rt.player.guardReadyAt, 40);
    runTicks(g, 8); assert.equal(g.battle.rt.tick, 15);
    unchanged(g, () => g.realtimeAction('guard'), /冷却/);
    runTicks(g, 25); g.realtimeAction('guard'); assert.equal(g.battle.rt.player.guardReadyAt, 80);
  });
  await test('真实眩晕立刻取消heavy，持续2秒不会被频繁startRound提前吃掉', () => {
    const g = fixture({ cls: 'psychic', skills: true });
    g.battle.monsters[0].intent = 'heavy'; tick(g);
    const previous = Math.random; Math.random = () => 0.2;
    try { g.realtimeAction('skill:ps6'); } finally { Math.random = previous; }
    assert.equal(g.battle.rt.enemies.m0.windupUntil, 0);
    assert.ok(events(g, 'miss', 'm0').some((e) => e.name === '眩晕打断'));
    const stun = () => g.battle.monsters[0].statuses.find((s) => s.kind === 'stun');
    assert.equal(stun().turns, 2); runTicks(g, 9); assert.equal(stun().turns, 2);
    tick(g); assert.equal(stun().turns, 1); runTicks(g, 9); assert.equal(stun().turns, 1);
    tick(g); assert.equal(stun(), undefined);
    validateSnapshot(g.state);
  });
  await test('移动3.5/s，对角归一化，手动移动不被自动追敌抢走且夹界', () => {
    const g = fixture({ cls: 'blademaster' }); const before = { ...g.battle.rt.player };
    tick(g, 1, 'up-left');
    assert.ok(Math.abs(Math.hypot(g.battle.rt.player.x - before.x, g.battle.rt.player.z - before.z) - 0.7) < 1e-9);
    runTicks(g, 20, 'up-left'); assert.equal(g.battle.rt.player.x, -4); assert.equal(g.battle.rt.player.z, -2.8);
    validateSnapshot(g.state);
    const chase = fixture({ cls: 'blademaster', type: 'phys' });
    runTicks(chase, 4); assert.ok(events(chase, 'attack', 'player').length > 0);
  });
  await test('普攻与技能独立CD；缺蓝不阻塞普攻；不自动喝药', () => {
    const g = fixture({ skills: true });
    g.realtimeAction('skill:wz4'); assert.equal(g.battle.rt.player.readyAt, 3);
    assert.equal(g.battle.rt.skillReady.wz4, 20); assert.equal(g.battle.cooldowns.wz4, 2);
    tick(g); assert.equal(events(g, 'attack', 'player').filter((e) => e.name === '普通攻击').length, 1);
    unchanged(g, () => g.realtimeAction('skill:wz1'), /公共冷却/);
    runTicks(g, 2); g.realtimeAction('skill:wz1');
    assert.equal(g.battle.rt.basicReadyAt, 7);
    runTicks(g, 4); assert.equal(events(g, 'attack', 'player').filter((e) => e.name === '普通攻击').length, 2);
    const low = fixture({ skills: true }); low.p.mp = 0; low.battle.rt.autoSkills = true;
    const inventory = { ...low.p.items }; tick(low);
    assert.equal(events(low, 'cast').length, 0); assert.equal(events(low, 'attack', 'player').length, 1);
    assert.deepEqual(low.p.items, inventory); assert.equal(low.p.mp, 0);
    validateSnapshot(g.state);
  });
  await test('攻速只缩短普攻间隔，不再叠加普攻连击；channel影响源CD', () => {
    const g = fixture();
    g.battle.buffs.push({ id: 'timing-fixture', name: '时钟夹具', values: { speed: 2, channel: 0.75 }, turns: 5, nextEffectAt: 10 });
    tick(g); assert.equal(g.battle.rt.basicReadyAt, 3);
    const attacks = events(g, 'damage', 'player'); assert.equal(attacks.length, 1);
    assert.ok(!g.battle.logs.some((l) => l.text.includes('连击命中')));
    g.p.skills.wz4 = 1;
    assert.equal(skillCooldown(g.p, g.battle, 'wz4'), 1);
    g.realtimeAction('skill:wz4'); assert.equal(g.battle.rt.skillReady.wz4, 11); assert.equal(g.battle.cooldowns.wz4, 1);
    runTicks(g, 9); assert.equal(g.battle.cooldowns.wz4, 1);
    tick(g); assert.equal(g.battle.cooldowns.wz4, 0);
    validateSnapshot(g.state);
  });
  await test('4槽负载与UI同源且不因缺蓝/CD/Hp/pet变动；自动AoE优先、治疗不打满血', () => {
    const g = fixture({ count: 3, skills: true });
    const slots = realtimeLoadout(g.p, g.battle).map((s) => s.id);
    assert.equal(slots.length, 4); assert.ok(slots.includes('wz1'));
    g.p.mp = 0; g.p.hp = 1; g.battle.cooldowns.wz1 = 5;
    assert.deepEqual(realtimeLoadout(g.p, g.battle).map((s) => s.id), slots);
    const aoe = fixture({ count: 3 }); aoe.p.skills = { wz1: 1, wz5: 1 }; aoe.battle.rt.autoSkills = true;
    tick(aoe); assert.equal(events(aoe, 'cast')[0].name, SKILLS.wizard.find((s) => s.id === 'wz5').name);
    const cleric = fixture({ cls: 'cleric' }); cleric.p.skills = { cl1: 1, cl2: 1 }; cleric.battle.rt.autoSkills = true;
    tick(cleric); assert.equal(events(cleric, 'cast')[0].name, SKILLS.cleric.find((s) => s.id === 'cl1').name);
    const low = fixture({ cls: 'cleric' }); low.p.skills = { cl1: 1, cl2: 1 }; low.p.hp = Math.floor(stats(low.p).hp * 0.54); low.battle.rt.autoSkills = true;
    tick(low); assert.equal(events(low, 'cast')[0].name, SKILLS.cleric.find((s) => s.id === 'cl2').name);
    const pet = fixture({ cls: 'venomancer' }); pet.p.skills = { vm1: 1, vm2: 1, vm3: 1 }; pet.battle.rt.autoSkills = true;
    const petSlots = realtimeLoadout(pet.p, pet.battle).map((s) => s.id); tick(pet);
    assert.ok(pet.battle.pet?.hp > 0); assert.deepEqual(realtimeLoadout(pet.p, pet.battle).map((s) => s.id), petSlots);
    const tiger = fixture({ cls: 'barbarian' }); tiger.p.skills = { bb1: 1, bb2: 1 }; tiger.battle.rt.autoSkills = true;
    runTicks(tiger, 15); assert.equal(events(tiger, 'cast').filter((e) => e.name === SKILLS.barbarian.find((s) => s.id === 'bb2').name).length, 1);
  });
  await test('合法指定目标/最近目标，手动技能不受4槽限制；切换自动技能不会刷新时钟', () => {
    const g = fixture({ count: 2, skills: true });
    g.battle.rt.enemies.m1.x = g.battle.rt.player.x + 0.2; g.battle.rt.enemies.m1.z = g.battle.rt.player.z;
    tick(g); assert.equal(events(g, 'attack', 'player')[0].target, 'm1');
    runTicks(g, 5); tick(g, 1, 'stop', 'm0'); assert.equal(events(g, 'attack', 'player').at(-1).target, 'm0');
    const outside = SKILLS.wizard.find((s) => s.kind === 'dmg' && !realtimeLoadout(g.p, g.battle).some((x) => x.id === s.id));
    assert.ok(outside); g.realtimeAction(`skill:${outside.id}`, 'm0');
    const clocks = { readyAt: g.battle.rt.player.readyAt, skillReady: { ...g.battle.rt.skillReady }, basicReadyAt: g.battle.rt.basicReadyAt };
    g.realtimeAction('autoskills'); assert.equal(g.battle.rt.autoSkills, true);
    g.realtimeAction('autoskills'); assert.equal(g.battle.rt.autoSkills, false);
    assert.deepEqual({ readyAt: g.battle.rt.player.readyAt, skillReady: g.battle.rt.skillReady, basicReadyAt: g.battle.rt.basicReadyAt }, clocks);
    const boss = fixture(); boss.battle.monsters[0].rank = 'boss'; runTicks(boss, 3);
    assert.equal(boss.battle.rt.enemies.m0.readyAt, 10);
    const normal = fixture(); runTicks(normal, 3); assert.equal(normal.battle.rt.enemies.m0.readyAt, 12);
  });
  await test('所有职业自动技能连续推进均保持合法快照、4槽上限和真实buff', () => {
    for (const cls of Object.keys(SKILLS)) {
      const g = fixture({ cls, skills: true, count: 4 }); g.battle.rt.autoSkills = true;
      const slots = realtimeLoadout(g.p, g.battle).map((s) => s.id); assert.ok(slots.length <= 4);
      for (let i = 0; i < 100 && g.busy; i++) { tick(g); validateSnapshot(g.state); }
      assert.deepEqual(realtimeLoadout(g.p, g.battle).map((s) => s.id), slots);
      const slotNames = slots.map((id) => SKILLS[cls].find((s) => s.id === id).name);
      assert.ok(events(g, 'cast').every((e) => slotNames.includes(e.name)));
    }
  });
  await test('HOT/DOT施放同tick不减时长，最后一跳保留；磐石护甲真实buff通过schema', () => {
    const g = fixture({ cls: 'cleric', skills: true }); g.p.hp = Math.floor(stats(g.p).hp * 0.3);
    tick(g); g.realtimeAction('skill:cl5');
    const hot = () => g.battle.buffs.find((b) => b.id === 'cl5:hot');
    assert.equal(hot().turns, 4); assert.equal(hot().nextEffectAt, 11);
    runTicks(g, 9); assert.equal(hot().turns, 4);
    runTicks(g, 31); assert.equal(hot(), undefined);
    assert.equal(events(g, 'heal').filter((e) => e.name === SKILLS.cleric.find((s) => s.id === 'cl5').name).length, 5);
    const dot = fixture({ cls: 'venomancer', skills: true }); tick(dot); dot.realtimeAction('skill:vm4');
    const status = () => dot.battle.monsters[0].statuses.find((s) => s.kind === 'dot');
    runTicks(dot, 9); assert.equal(status().turns, 4);
    runTicks(dot, 31); assert.equal(status(), undefined);
    assert.equal(events(dot, 'damage').filter((e) => e.name.endsWith('的持续伤害')).length, 4);
    validateSnapshot(dot.state);
    const armor = fixture({ skills: true }); armor.realtimeAction('skill:wz3');
    const buff = armor.battle.buffs.find((b) => b.id === 'wz3');
    assert.deepEqual(buff.values, { equipmentDefPct: 0.1, equipmentEarthDefPct: 0.1 }); assert.equal(buff.shield, undefined);
    validateSnapshot(armor.state); runTicks(armor, 9); assert.equal(buff.turns, 5);
    tick(armor); assert.equal(buff.turns, 4); validateSnapshot(armor.state);
  });
  await test('暂停tick/HOT/DOT/cd/护符完全不变，禁止守御/技能/药品且resume不刷新', () => {
    const g = fixture({ skills: true }); g.p.charms = { hp: 10000, mp: 10000 };
    g.realtimeAction('guard'); g.realtimeAction('skill:wz4'); g.p.hp = 10; g.realtimeAction('item:hp1');
    g.p.charmCooldowns = { hp: 20, mp: 15 }; g.realtimeAction('pause');
    const before = structuredClone(g.state);
    for (let i = 0; i < 10; i++) tick(g, 5, 'down-right');
    assert.deepEqual(g.state, before);
    for (const action of ['guard', 'skill:wz1', 'item:hp1', 'escape']) unchanged(g, () => g.realtimeAction(action), /暂停/);
    g.realtimeAction('resume'); assert.equal(g.battle.rt.player.guardReadyAt, 40); assert.equal(g.battle.rt.player.potionReadyAt, 40);
    assert.deepEqual(g.p.charmCooldowns, { hp: 20, mp: 15 });
  });
  await test('护符严格小于50/75%，尾储量按min缺口扣同量；致死先结束不能符复活', () => {
    const g = fixture(); far(g); const st = stats(g.p); g.p.charms = { hp: 7, mp: 9 };
    g.p.hp = st.hp * 0.5; g.p.mp = st.mp * 0.75;
    tick(g, 1, 'left'); assert.deepEqual(g.p.charms, { hp: 7, mp: 9 });
    g.p.hp = Math.floor(st.hp * 0.5) - 1; g.p.mp = Math.floor(st.mp * 0.75) - 1;
    const before = { hp: g.p.hp, mp: g.p.mp }; tick(g, 1, 'left');
    assert.equal(g.p.hp, before.hp + 7); assert.equal(g.p.mp, before.mp + 9);
    assert.deepEqual(g.p.charms, { hp: 0, mp: 0 }); assert.deepEqual(g.p.charmCooldowns, { hp: 50, mp: 25 });
    const lethal = fixture(); lethal.p.hp = 1; lethal.p.charms = { hp: 10000, mp: 0 }; lethal.p.charmCooldowns.hp = 50;
    tick(lethal, 3); assert.equal(lethal.battle.result, 'lose'); assert.equal(lethal.battle.rt.tick, 3);
    assert.equal(lethal.p.charms.hp, 10000); assert.equal(lethal.p.charmCooldowns.hp, 47);
    assert.equal(events(lethal, 'heal').filter((e) => e.name === 'hp护符').length, 0);
    const noCooldown = fixture(); noCooldown.p.hp = 1; noCooldown.p.charms = { hp: 10000, mp: 0 };
    // A landed lethal attack on the very first tick must not auto-recover first.
    noCooldown.battle.rt.enemies.m0.windupUntil = 1;
    tick(noCooldown, 5); assert.equal(noCooldown.battle.result, 'lose'); assert.equal(noCooldown.battle.rt.tick, 1);
    assert.equal(noCooldown.p.charms.hp, 10000);
  });
  await test('护符10/5秒跨战斗、撤退、启用、装填不刷新；只实际tick递减', () => {
    const g = fixture(); far(g); const st = stats(g.p);
    g.p.charms = { hp: 100000, mp: 100000 }; g.p.hp = 1; g.p.mp = 1;
    tick(g, 1, 'left'); assert.deepEqual(g.p.charmCooldowns, { hp: 50, mp: 25 });
    runTicks(g, 10, 'left'); assert.deepEqual(g.p.charmCooldowns, { hp: 40, mp: 15 });
    g.realtimeAction('escape'); const clocks = { ...g.p.charmCooldowns };
    g.p.items.charmHp = 1; economyAction(g, 'charm.equip', { itemId: 'charmHp', count: 1 });
    assert.deepEqual(g.p.charmCooldowns, clocks);
    g.state.battle = createBattle(g.p, [{ ...makeMonster('换场敌人', 80, '', 'magic'), hp: 1e7, maxHp: 1e7,
      statuses: [{ kind: 'stun', source: 'wz4', name: '时钟隔离夹具', value: 1, turns: 100 }] }], { type: 'field', zone: 'h_f1' });
    g.enableRealtime(); g.battle.rt.autoSkills = false; far(g); assert.deepEqual(g.p.charmCooldowns, clocks);
    g.enableRealtime(); assert.deepEqual(g.p.charmCooldowns, clocks);
    const mpReserve = g.p.charms.mp; g.p.mp = 1; runTicks(g, 14, 'left'); assert.equal(g.p.charms.mp, mpReserve);
    tick(g, 1, 'left'); assert.ok(g.p.charms.mp < mpReserve); assert.equal(g.p.charmCooldowns.mp, 25);
    const hpReserve = g.p.charms.hp; g.p.hp = 1; runTicks(g, 24, 'left'); assert.equal(g.p.charms.hp, hpReserve);
    tick(g, 1, 'left'); assert.ok(g.p.charms.hp < hpReserve); assert.equal(g.p.charmCooldowns.hp, 50);
  });
  await test('非法steps/direction/目标/action无任何快照变化；noEscape严格', () => {
    const g = fixture({ skills: true });
    for (const steps of [0, 6, -1, 1.5, NaN, Infinity, '1']) unchanged(g, () => tick(g, steps));
    for (const direction of ['north', '', 'constructor', 1, null]) unchanged(g, () => tick(g, 1, direction));
    for (const id of ['missing', 'player', 'pet', '', null]) unchanged(g, () => tick(g, 1, 'stop', id));
    for (const action of ['attack', 'defend', 'auto', 'skill:missing', 'item:town', 'item:missing', '', null]) unchanged(g, () => g.realtimeAction(action));
    unchanged(g, () => g.realtimeAction('guard', 'missing'));
    g.battle.context.noEscape = true; unchanged(g, () => g.realtimeAction('escape'), /不能撤退/);
  });
  await test('药品即时消耗真实数量，共享8秒CD，不插队敌人、不重置技能CD', () => {
    const g = fixture({ skills: true }); g.p.hp -= 500; g.p.mp -= 500;
    g.realtimeAction('skill:wz4'); const ready = structuredClone(g.battle.rt.skillReady);
    const mp = g.p.mp, hp = g.p.hp, count = g.p.items.hp1;
    g.realtimeAction('item:hp1'); assert.equal(g.p.items.hp1, count - 1); assert.equal(g.p.hp, hp + ITEMS.hp1.value);
    assert.equal(g.p.mp, mp); assert.equal(g.battle.rt.tick, 0); assert.equal(g.battle.rt.player.potionReadyAt, 40);
    assert.deepEqual(g.battle.rt.skillReady, ready); assert.equal(events(g, 'attack', 'm0').length, 0);
    unchanged(g, () => g.realtimeAction('item:mp1'), /共享冷却/);
    runTicks(g, 40); g.realtimeAction('item:mp1'); assert.equal(g.battle.rt.player.potionReadyAt, 80);
  });
  await test('schema拒绝非法坐标/ID/事件/seq/ticks/flags/aim/cd及伪造事件奖励', () => {
    const g = fixture(); tick(g); validateSnapshot(g.state);
    const mutations = [
      (s) => s.battle.rt.player.x = -4.01, (s) => s.battle.rt.enemies.m0.z = 2.81,
      (s) => s.battle.rt.player.x = NaN, (s) => s.battle.rt.tick = 1.5,
      (s) => s.battle.rt.paused = 'false', (s) => s.battle.rt.autoSkills = 0,
      (s) => s.battle.rt.player.guardReadyAt = 10000,
      (s) => s.battle.rt.enemies.unknown = { ...s.battle.rt.enemies.m0 },
      (s) => s.battle.rt.enemies.m0.aim = { x: 0, z: 5 },
      (s) => s.battle.rt.events[0].actor = 'unknown', (s) => s.battle.rt.events[0].target = 'unknown',
      (s) => s.battle.rt.events[0].kind = 'reward', (s) => s.battle.rt.events[0].gold = 1e9,
      (s) => s.battle.rt.events[0].seq = 0, (s) => s.battle.rt.events[0].tick = 100,
      (s) => s.battle.rt.events[0].amount = -1, (s) => s.battle.rt.events[0].element = 'void',
      (s) => s.battle.rt.skillReady.wz4 = 100, (s) => s.player.charmCooldowns.hp = 51,
      (s) => s.player.charmCooldowns.mp = 0.5, (s) => s.player.gold = -1,
    ];
    for (const mutate of mutations) { const s = structuredClone(g.state); mutate(s); assert.throws(() => validateSnapshot(s)); }
    const legacy = fixture({ realtime: false }); validateSnapshot(legacy.state);
    const zero = fixture(); zero.p.charmCooldowns = { hp: 0, mp: 0 }; validateSnapshot(zero.state);
  });
  await test('事件队列有限64条、顺序稳定；战斗tick不读取Date.now', () => {
    const g = fixture(); const previous = Date.now;
    Date.now = () => { throw new Error('No wall-clock battle ticks'); };
    try { runTicks(g, 150); } finally { Date.now = previous; }
    assert.equal(g.battle.rt.events.length, 64);
    assert.equal(g.battle.rt.events.at(-1).seq, g.battle.rt.sequence);
    validateSnapshot(g.state);
  });
  await test('POST仍走schema+CAS+receipt；启用返回rt；暂停/GET不动护符；旧turn/auto拒绝', async () => {
    const api = await backend();
    const response = await api.request('POST', '/v1/battle/realtime');
    assert.equal(response.data.result.tick, 0); assert.equal(response.data.result.player.x, -1.65);
    const rt = api.game.battle.rt;
    assert.ok(API_ROUTES.some((r) => r.path === '/v1/battle/tick' && r.fields.steps === 'integer'));
    await apiUnchanged(api, '/v1/battle/turn', { action: 'attack' }); await apiUnchanged(api, '/v1/battle/auto', {});
    for (const body of [{ steps: 0 }, { steps: 6 }, { steps: 1.5 }, { steps: 1, direction: 'invalid' }, { steps: 1, targetId: 'missing' }, { steps: 1, reward: 1 }]) await apiUnchanged(api, '/v1/battle/tick', body);
    await apiUnchanged(api, '/v1/battle/action', { action: 'attack' });
    const revision = api.revision;
    const opts = { requestId: 'tick-once' };
    const [first, second] = await Promise.all([api.request('POST', '/v1/battle/tick', { steps: 1 }, opts), api.request('POST', '/v1/battle/tick', { steps: 1 }, opts)]);
    assert.equal(first.meta.duplicate, false); assert.equal(second.meta.duplicate, true);
    assert.equal(api.game.battle.rt.tick, rt.tick + 1); assert.equal(api.revision, revision + 1);
    await api.request('POST', '/v1/battle/action', { action: 'pause' });
    const before = api.game.state; await api.request('POST', '/v1/battle/tick', { steps: 5, direction: 'right' });
    assert.deepEqual(api.game.state, before);
    await api.request('GET', '/v1/state'); await api.request('GET', '/v1/character'); assert.deepEqual(api.game.state, before);
    await apiUnchanged(api, '/v1/items/use', { id: 'hp1' });
    await api.request('POST', '/v1/battle/action', { action: 'resume' });
    api.store.fail = true; await apiUnchanged(api, '/v1/battle/tick', { steps: 1 }); api.store.fail = false;
    const originalAdvance = Game.prototype.advanceRealtime;
    Game.prototype.advanceRealtime = function (body) {
      const result = originalAdvance.call(this, body);
      this.p.items.hp1--; this.p.charms.hp = 0; this.battle.rt.enemies.m0.x = 100;
      return result;
    };
    try { await apiUnchanged(api, '/v1/battle/tick', { steps: 1 }); }
    finally { Game.prototype.advanceRealtime = originalAdvance; }
    const other = new LocalBackend(api.store); other.adopt(await api.store.current());
    await api.request('POST', '/v1/battle/tick', { steps: 1 });
    await apiUnchanged(other, '/v1/battle/tick', { steps: 1 });
  });
  await test('DOT致胜立即停止本tick后续恢复/护符/敌方及剩余steps', () => {
    const g = fixture();
    g.battle.monsters[0].statuses.push({ kind: 'dot', source: 'wz5', name: '尾跳', value: 0.3, turns: 1,
      attack: 1e8, type: 'magic', elem: 'fire', attacker: { attackLevel: 0, penetrationP: 0, penetrationM: 0 }, nextEffectAt: 10 });
    runTicks(g, 9); g.p.hp = 1; g.p.charms.hp = 10000;
    const before = events(g, 'attack', 'm0').length;
    assert.equal(advanceRealtime(g.p, g.battle, { steps: 5 }), 'win');
    assert.equal(g.battle.rt.tick, 10); assert.equal(g.p.hp, 1); assert.equal(g.p.charms.hp, 10000);
    assert.equal(events(g, 'attack', 'm0').length, before); validateSnapshot(g.state);
  });
  await test('即时胜利停止剩余tick、奖励/耐久仅一次；幂等receipt不重复结算', async () => {
    const g = fixture({ realtime: false }); g.battle.monsters[0].hp = 1;
    const api = await backend(g); await api.request('POST', '/v1/battle/realtime');
    const initial = api.game.p.totals.battles, durability = api.game.p.equipment.weapon.durability;
    const options = { requestId: 'victory-once' }, body = { steps: 5 };
    const response = await api.request('POST', '/v1/battle/tick', body, options);
    assert.equal(response.data.result, 'win'); assert.equal(api.game.battle.rt.tick, 1); assert.equal(api.game.p.totals.battles, initial + 1);
    assert.equal(api.game.p.equipment.weapon.durability, durability - 1);
    const before = api.game.state;
    assert.equal((await api.request('POST', '/v1/battle/tick', body, options)).meta.duplicate, true);
    assert.deepEqual(api.game.state, before);
    await apiUnchanged(api, '/v1/battle/tick', body); await apiUnchanged(api, '/v1/battle/action', { action: 'guard' });
    const settled = api.game; settled.resolveBattle(); assert.deepEqual(settled.state, before);
    assert.ok(api.game.battle.rewards); validateSnapshot(api.game.state);
    const manual = fixture({ skills: true }); manual.battle.monsters[0].hp = 1;
    assert.equal(manual.realtimeAction('skill:wz1'), 'win'); assert.equal(manual.battle.rt.tick, 0);
    const settledManual = structuredClone(manual.state); manual.resolveBattle(); assert.deepEqual(manual.state, settledManual);
  });
  await test('野外布局：原点偏移、站位与主动攻击半径', async () => {
    const g = fixture({ realtime: false, count: 2 });
    g.enableRealtime({ origin: { x: -12.5, z: 30 }, player: { x: -1.2, z: 0.4 }, enemy: { x: 1.2, z: -0.4 } });
    const rt = g.battle.rt; const [first, second] = g.battle.monsters.map((m) => rt.enemies[m.id]);
    assert.deepEqual(rt.origin, { x: -12.5, z: 30 });
    assert.deepEqual([rt.player.x, rt.player.z, first.x, first.z], [-1.2, 0.4, 1.2, -0.4]);
    assert.ok(Math.abs(second.x) <= 4 && Math.abs(second.z) <= 2.8);
    validateSnapshot(g.state);
    tick(g, 3, 'right'); assert.deepEqual(g.battle.rt.origin, { x: -12.5, z: 30 });
    const legacy = fixture(); assert.equal(legacy.battle.rt.origin, undefined); validateSnapshot(legacy.state);
    for (const [layout, pattern] of [[{ origin: { x: 99, z: 0 } }, /布局无效/], [{ origin: { x: 0, z: 0 }, player: { x: 0, z: 0 } }, /布局无效/],
      [{ origin: { x: 0, z: 0 }, player: { x: 0, z: 0 }, enemy: { x: 0.2, z: 0 } }, /站位无效/], [{ origin: { x: 0, z: 0 }, extra: 1 }, /布局无效/]]) {
      const fresh = fixture({ realtime: false }); unchanged(fresh, () => fresh.enableRealtime(layout), pattern);
    }
    const bad = structuredClone(g.state); bad.battle.rt.origin = { x: 0, z: 0, y: 1 };
    assert.throws(() => validateSnapshot(bad), /原点无效/);
    const p = { lv: 30 };
    assert.deepEqual([aggroRadius(p, 30, ''), aggroRadius(p, 30, 'elite'), aggroRadius(p, 30, 'boss'), aggroRadius(p, 22, ''), aggroRadius(p, 21, 'boss')],
      [REALTIME_RULES.aggroNormal, REALTIME_RULES.aggroElite, REALTIME_RULES.aggroBoss, REALTIME_RULES.aggroNormal, 0]);
  });
} finally { Math.random = originalRandom; }
console.log(`Realtime: ${passed} passed, ${failures.length} failed; ${REALTIME_RULES.stepMs}ms deterministic steps.`);
if (failures.length) process.exitCode = 1;
