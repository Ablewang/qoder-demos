import assert from 'node:assert/strict';
import { Game } from '../src/core/game.js';
import { validateSnapshot } from '../src/core/schema.js';
import { stats, makeMonster } from '../src/core/model.js';
import { SKILLS } from '../src/data/classes.js';
import { REALTIME_RULES, ENEMY_AI, AUTO_AI, createBattle, realtimeLoadout, pickAutoAction } from '../src/core/combat.js';

// Deterministic behaviour fixtures for the realtime monster AI and the player's
// auto AI. Fixed RNG; the new decisions themselves never read Math.random/Date.
const originalRandom = Math.random, originalNow = Date.now;
Math.random = () => 0.5;
Date.now = () => { throw new Error('AI must not read wall-clock time'); };
let passed = 0;
const failures = [];
async function test(name, run) {
  try { await run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, error }); console.error(`FAIL ${name}: ${error.stack}`); }
}
function fixture({ cls = 'wizard', monsters = [{}], skills = false, realtime = true } = {}) {
  const g = new Game(); g.start('行为夹具', cls);
  const p = g.p;
  p.lv = 80; p.cult = 8; p.chi = 300; p.location = 'h_f1';
  p.attrs = { str: 200, con: 200, dex: 200, mag: 200 };
  p.skills = skills ? Object.fromEntries(SKILLS[cls].filter((s) => s.kind !== 'passive').map((s) => [s.id, 1])) : {};
  const st = stats(p); p.hp = st.hp; p.mp = st.mp;
  g.state.battle = createBattle(p, monsters.map(({ rank = '', type = 'phys', hp = 1e7, ...rest }, i) => ({
    ...makeMonster(`行为敌人${i}`, 80, rank, type, i), hp, maxHp: 1e7, atk: 100, accuracy: 10, dodge: 0, crit: 0, ...rest,
  })), { type: 'field', zone: p.location });
  if (realtime) { g.enableRealtime(); g.battle.rt.autoSkills = false; }
  return g;
}
const tick = (g, steps = 1, direction = 'stop') => g.advanceRealtime({ steps, direction });
const runTicks = (g, count, direction = 'stop') => { for (let i = 0; i < count; i++) { tick(g, 1, direction); validateSnapshot(g.state); } };
const events = (g, kind, actor) => g.battle.rt.events.filter((e) => e.kind === kind && (actor === undefined || e.actor === actor));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const place = (g, id, x, z) => Object.assign(g.battle.rt.enemies[id], { x, z });

try {
  await test('近战多怪包抄分散：首怪直线逼近，其余按左右交替方位绕到侧翼且不超速', () => {
    const g = fixture({ monsters: [{}, {}, {}] });
    const rt = g.battle.rt, P = rt.player;
    const hold = (game) => { for (const e of Object.values(game.battle.rt.enemies)) e.readyAt = game.battle.rt.tick + 2; };
    let last = structuredClone(rt.enemies);
    for (let i = 0; i < 25; i++) {
      hold(g); tick(g, 1, 'stop'); validateSnapshot(g.state);
      for (const [id, e] of Object.entries(rt.enemies)) assert.ok(dist(e, last[id]) <= REALTIME_RULES.meleeSpeed * 0.2 + 1e-9, `${id}超速`);
      last = structuredClone(rt.enemies);
    }
    const bearing = (id) => Math.atan2(rt.enemies[id].z - P.z, rt.enemies[id].x - P.x);
    const gap = (a, z) => Math.abs(Math.atan2(Math.sin(bearing(a) - bearing(z)), Math.cos(bearing(a) - bearing(z))));
    assert.ok(gap('m0', 'm1') > 0.8 && gap('m0', 'm2') > 0.8, '侧翼方位未展开');
    for (const [a, z] of [['m0', 'm1'], ['m0', 'm2'], ['m1', 'm2']]) assert.ok(dist(rt.enemies[a], rt.enemies[z]) > 0.9, `${a}/${z}重叠`);
    for (const e of Object.values(rt.enemies)) assert.ok(dist(e, P) <= REALTIME_RULES.meleeRange + 1e-9);
    // Same inputs replay to the identical state: no hidden randomness in movement.
    const replay = fixture({ monsters: [{}, {}, {}] });
    for (let i = 0; i < 25; i++) { hold(replay); tick(replay); }
    assert.deepEqual(replay.battle.rt.enemies, rt.enemies);
  });
  await test('法系冷却中被贴脸会后撤风筝；就绪时原地出手；首领法系不后撤', () => {
    const g = fixture({ monsters: [{ type: 'magic' }] }); const rt = g.battle.rt;
    place(g, 'm0', rt.player.x + 1, rt.player.z); rt.enemies.m0.readyAt = 10;
    const before = dist(rt.enemies.m0, rt.player); tick(g);
    assert.ok(Math.abs(dist(rt.enemies.m0, rt.player) - before - REALTIME_RULES.casterSpeed * 0.2) < 1e-9);
    runTicks(g, 4); assert.ok(dist(rt.enemies.m0, rt.player) >= ENEMY_AI.kiteDistance - 1e-9);
    const ready = fixture({ monsters: [{ type: 'magic' }] });
    place(ready, 'm0', ready.battle.rt.player.x + 1, ready.battle.rt.player.z); tick(ready);
    assert.equal(ready.battle.rt.enemies.m0.windupUntil, 3);
    const boss = fixture({ monsters: [{ type: 'magic', rank: 'boss' }] }); const brt = boss.battle.rt;
    place(boss, 'm0', brt.player.x + 1, brt.player.z); brt.enemies.m0.readyAt = 10;
    const pos = { ...brt.enemies.m0 }; tick(boss);
    assert.equal(brt.enemies.m0.x, pos.x); assert.equal(brt.enemies.m0.z, pos.z);
  });
  await test('精英冲锋：红圈锁定1.2秒，命中2.4倍重击并突进；离圈落空；10秒内不再冲锋', () => {
    const g = fixture({ monsters: [{ rank: 'elite' }] }); const rt = g.battle.rt, e = rt.enemies.m0;
    place(g, 'm0', rt.player.x + 3.5, rt.player.z);
    const hp = g.p.hp; tick(g);
    assert.equal(e.mode, 'charge'); assert.equal(e.windupUntil, 1 + REALTIME_RULES.heavyWindupTicks);
    assert.equal(g.battle.monsters[0].intent, 'heavy'); assert.deepEqual(e.aim, { x: rt.player.x, z: rt.player.z });
    assert.equal(e.chargeAt, 1 + ENEMY_AI.chargeCooldownTicks);
    assert.ok(events(g, 'telegraph', 'm0').some((x) => x.name === '蓄力冲锋'));
    validateSnapshot(g.state);
    const aim = { ...e.aim };
    runTicks(g, 5); assert.equal(g.p.hp, hp, '前摇期间不得伤血');
    tick(g); assert.ok(g.p.hp < hp); assert.equal(e.mode, undefined);
    assert.ok(Math.abs(dist(e, aim) - ENEMY_AI.chargeLanding) < 1e-9, '冲锋应突进到落点前');
    const dodge = fixture({ monsters: [{ rank: 'elite' }] }); const drt = dodge.battle.rt;
    place(dodge, 'm0', drt.player.x + 3.5, drt.player.z); const dhp = dodge.p.hp;
    tick(dodge); runTicks(dodge, 6, 'up');
    assert.equal(dodge.p.hp, dhp); assert.ok(events(dodge, 'miss', 'm0').some((x) => x.name === '冲锋落空'));
    for (let i = 0; i < 30; i++) { tick(dodge, 1, 'left'); assert.notEqual(drt.enemies.m0.mode, 'charge'); }
    const normal = fixture({ monsters: [{}] }); place(normal, 'm0', normal.battle.rt.player.x + 3.5, normal.battle.rt.player.z);
    tick(normal); assert.equal(normal.battle.rt.enemies.m0.mode, undefined); assert.equal(normal.battle.rt.enemies.m0.windupUntil, 0);
  });
  await test('首领半血进入狂怒：立即震地（以自身为圆心），蓄力缩短为1秒，每3次攻击再震地', () => {
    const g = fixture({ monsters: [{ rank: 'boss', hp: 4e6 }] }); const rt = g.battle.rt, e = rt.enemies.m0, m = g.battle.monsters[0];
    place(g, 'm0', rt.player.x + 1, rt.player.z);
    tick(g);
    assert.equal(e.phase, 2); assert.equal(e.mode, 'quake'); assert.equal(m.intent, 'heavy');
    assert.deepEqual(e.aim, { x: e.x, z: e.z }); assert.equal(e.windupUntil, 1 + ENEMY_AI.phaseWindupTicks);
    assert.ok(events(g, 'telegraph', 'm0').some((x) => x.name === '狂怒'));
    assert.ok(events(g, 'telegraph', 'm0').some((x) => x.name === '震地'));
    validateSnapshot(g.state);
    const hp = g.p.hp; runTicks(g, 5, 'left');
    assert.equal(g.p.hp, hp); assert.ok(events(g, 'miss', 'm0').some((x) => x.name === '震地落空'));
    let quakes = 1;
    for (let i = 0; i < 120; i++) {
      tick(g); validateSnapshot(g.state);
      if (e.windupUntil === rt.tick + ENEMY_AI.phaseWindupTicks && e.mode === 'quake') quakes++;
      if (e.windupUntil > rt.tick) assert.ok(e.windupUntil - rt.tick <= ENEMY_AI.phaseWindupTicks);
    }
    assert.ok(quakes >= 3, `狂怒阶段震地次数${quakes}`);
    assert.equal(g.battle.logs.filter((x) => x.text.includes('进入狂怒阶段')).length, 1);
    const healthy = fixture({ monsters: [{ rank: 'boss' }] }); healthy.battle.monsters[0].intent = 'heavy';
    place(healthy, 'm0', healthy.battle.rt.player.x + 1, healthy.battle.rt.player.z); tick(healthy);
    assert.equal(healthy.battle.rt.enemies.m0.windupUntil, 1 + REALTIME_RULES.heavyWindupTicks); assert.equal(healthy.battle.rt.enemies.m0.phase, undefined);
  });
  await test('精英30%血狂暴：冷却缩短为首领节奏，只宣告一次；普通怪不狂暴', () => {
    const g = fixture({ monsters: [{ rank: 'elite', type: 'magic', hp: 2e6 }] }); const e = g.battle.rt.enemies.m0;
    runTicks(g, 3);
    assert.equal(e.phase, 2); assert.equal(e.readyAt, 3 + REALTIME_RULES.bossCooldownTicks);
    runTicks(g, 20); assert.equal(events(g, 'telegraph', 'm0').filter((x) => x.name === '狂暴').length, 1);
    const normal = fixture({ monsters: [{ type: 'magic', hp: 1e6 }] }); runTicks(normal, 3);
    assert.equal(normal.battle.rt.enemies.m0.phase, undefined); assert.equal(normal.battle.rt.enemies.m0.readyAt, 3 + REALTIME_RULES.enemyCooldownTicks);
  });
  await test('自动：控制技优先打断射程内最早的蓄力重击', () => {
    const g = fixture({ cls: 'psychic', skills: true, monsters: [{ type: 'magic' }, { type: 'magic' }] });
    const control = realtimeLoadout(g.p, g.battle).filter((s) => s.fx?.stun);
    assert.ok(control.length, '心法师4槽应含控制技');
    g.battle.monsters[1].intent = 'heavy'; g.battle.rt.player.readyAt = 3; g.battle.rt.autoSkills = true;
    runTicks(g, 2);
    assert.ok(g.battle.rt.enemies.m1.windupUntil > g.battle.rt.tick);
    tick(g);
    const cast = events(g, 'cast').at(-1);
    assert.equal(cast.tick, 3); assert.equal(cast.target, 'm1'); assert.ok(control.some((s) => s.name === cast.name));
  });
  await test('自动：低血且将被命中才守御；危急才喝血药，不喝蓝药', () => {
    const g = fixture({ monsters: [{ type: 'magic' }] }); const st = stats(g.p);
    g.p.hp = Math.floor(st.hp * (AUTO_AI.guardHp - 0.05)); g.battle.rt.autoSkills = true;
    tick(g); assert.equal(events(g, 'guard').length, 0, '尚无来袭攻击不应守御');
    tick(g); assert.equal(events(g, 'guard').filter((x) => x.name === '守御').length, 1);
    assert.equal(g.battle.rt.player.guardReadyAt, 2 + REALTIME_RULES.guardCooldownTicks);
    const healthy = fixture({ monsters: [{ type: 'magic' }] }); healthy.battle.rt.autoSkills = true; runTicks(healthy, 4);
    assert.equal(events(healthy, 'guard').length, 0);
    const low = fixture({ monsters: [{ type: 'magic' }] }); low.battle.rt.autoSkills = true;
    low.p.hp = Math.floor(st.hp * 0.2); low.p.mp = 0; const items = { ...low.p.items };
    tick(low);
    const used = Object.keys(items).filter((id) => low.p.items[id] < items[id]);
    assert.equal(used.length, 1); assert.ok(used[0].startsWith('hp'));
    assert.equal(low.battle.rt.player.potionReadyAt, 1 + REALTIME_RULES.potionCooldownTicks); assert.equal(low.p.mp, 0);
    const manual = fixture({ monsters: [{ type: 'magic' }] }); manual.p.hp = Math.floor(st.hp * 0.2);
    const manualItems = { ...manual.p.items }; runTicks(manual, 3);
    assert.deepEqual(manual.p.items, manualItems, '关闭自动时不得代喝药');
    validateSnapshot(low.state);
  });
  await test('自动：伤害技能保留20%真气，满蓝照常施放', () => {
    const g = fixture({ monsters: [{ type: 'magic' }] }); g.p.skills = { wz1: 1 }; g.battle.rt.autoSkills = true;
    const st = stats(g.p); g.p.mp = Math.ceil(st.mp * AUTO_AI.manaReserve) + 1;
    runTicks(g, 4); assert.equal(events(g, 'cast').length, 0);
    assert.ok(events(g, 'attack', 'player').length > 0, '保留真气时仍应普攻');
    const full = fixture({ monsters: [{ type: 'magic' }] }); full.p.skills = { wz1: 1 }; full.battle.rt.autoSkills = true;
    tick(full); assert.equal(events(full, 'cast').length, 1);
  });
  await test('自动追击不会走进存活的红圈，红圈结束后继续追击', () => {
    const g = fixture({ cls: 'blademaster', monsters: [{ type: 'magic' }] }); const rt = g.battle.rt;
    place(g, 'm0', 2, 0.55); rt.player.x = -1.6; rt.player.z = 0.55;
    g.battle.monsters[0].intent = 'heavy';
    Object.assign(rt.enemies.m0, { windupUntil: 6, aim: { x: 0, z: 0.55 }, readyAt: 0 });
    validateSnapshot(g.state);
    for (let i = 0; i < 5; i++) { tick(g); assert.ok(dist(rt.player, rt.enemies.m0.aim || { x: 0, z: 0.55 }) > REALTIME_RULES.heavyRadius); }
    tick(g); runTicks(g, 4); assert.ok(rt.player.x > -0.4, '红圈结束后应恢复追击');
  });
  await test('回合制自动：单个蓄力者用高几率控制技打断；低血先防御格挡；低蓝保留', () => {
    const g = fixture({ cls: 'psychic', skills: true, realtime: false, monsters: [{ type: 'magic' }] });
    g.battle.monsters[0].intent = 'heavy';
    const choice = pickAutoAction(g.p, g.battle);
    assert.equal(choice.action, 'skill:ps6'); assert.equal(choice.targetId, 'm0');
    const low = fixture({ cls: 'blademaster', realtime: false, monsters: [{ type: 'magic', atk: 400 }] });
    low.battle.monsters[0].intent = 'heavy'; low.p.hp = Math.floor(stats(low.p).hp * 0.35);
    assert.equal(pickAutoAction(low.p, low.battle).action, 'defend');
    const mana = fixture({ realtime: false, monsters: [{ type: 'magic' }] }); mana.p.skills = { wz1: 1 }; mana.p.items = {};
    mana.p.mp = Math.ceil(stats(mana.p).mp * AUTO_AI.manaReserve) + 1;
    assert.equal(pickAutoAction(mana.p, mana.battle).action, 'attack');
    mana.p.mp = stats(mana.p).mp; assert.equal(pickAutoAction(mana.p, mana.battle).action, 'skill:wz1');
  });
  await test('schema：新AI字段可选且严格；旧存档字段集仍合法', () => {
    const g = fixture({ monsters: [{ rank: 'boss', hp: 4e6 }] }); place(g, 'm0', g.battle.rt.player.x + 1, g.battle.rt.player.z);
    tick(g); assert.equal(g.battle.rt.enemies.m0.mode, 'quake'); validateSnapshot(g.state);
    const legacy = fixture(); tick(legacy); assert.deepEqual(Object.keys(legacy.battle.rt.enemies.m0).sort(), ['aim', 'readyAt', 'windupUntil', 'x', 'z']);
    validateSnapshot(legacy.state);
    const bad = [
      (s) => s.battle.rt.enemies.m0.mode = 'spin', (s) => s.battle.rt.enemies.m0.phase = 3,
      (s) => s.battle.rt.enemies.m0.combo = ENEMY_AI.quakeEvery + 1, (s) => s.battle.rt.enemies.m0.combo = -1,
      (s) => s.battle.rt.enemies.m0.chargeAt = s.battle.rt.tick + ENEMY_AI.chargeCooldownTicks + 1,
      (s) => { s.battle.rt.enemies.m0.aim = null; s.battle.rt.enemies.m0.windupUntil = 0; },
      (s) => s.battle.rt.enemies.m0.unknown = 1,
    ];
    for (const mutate of bad) { const s = structuredClone(g.state); mutate(s); assert.throws(() => validateSnapshot(s)); }
  });
} finally { Math.random = originalRandom; Date.now = originalNow; }
console.log(`Realtime AI: ${passed} passed, ${failures.length} failed.`);
if (failures.length) process.exitCode = 1;
