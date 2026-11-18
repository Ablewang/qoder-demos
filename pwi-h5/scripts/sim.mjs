import assert from 'node:assert/strict';
import { CLASSES, SKILLS, findSkill, skillReq } from '../src/data/classes.js';
import { ZONES, HOME_CITY, CULTIVATION, CULT_TRIALS, DUNGEONS, DUNGEON_DAILY } from '../src/data/world.js';
import { ITEMS, SLOTS, makeEquip, itemSell, equipStats, REFINE_RATE, REFINE_MAX } from '../src/data/items.js';
import { buildMainline, makeBounty, BOUNTY_DAILY } from '../src/data/quests.js';
import { createPlayer, stats, gainExp, expNeed, makeMonster, monsterReward, MAX_LEVEL, BAG_LIMIT, dayKey } from '../src/core/model.js';
import { Game, validateSave } from '../src/core/game.js';
import { validateSnapshot } from '../src/core/schema.js';
import { ensureEquipment } from '../src/core/equipment.js';
import { ensureEconomy } from '../src/core/economy.js';
import { getProductionRecipe } from '../src/data/production.js';
import { gearSpec, matchesGearSpec } from '../src/data/gear-specs.js';

// Clone-only legacy stats fixtures for arbitrary damage-oracle addons. New
// generation/API/save tests retain all canonical metadata and validate it.
function legacyStats(it) {
  const copy = structuredClone(it);
  for (const key of ['ruleVersion', 'series', 'weaponType', 'wear', 'ranges', 'stars', 'attackType', 'origin']) delete copy[key];
  copy.socketLimit = 4;
  return copy;
}
function dungeonEntrance(g, d) {
  g.p.location = d.entrance[0]; g.p.encounter = null; g.state.battle = null;
  if (!g.p.discovered.includes(g.p.location)) g.p.discovered.push(g.p.location);
}
import { ENCOUNTERS, ENCOUNTER_IDS } from '../src/data/encounters.js';
import { createBattle, takeTurn, canUseSkill, pickAutoAction, skillCooldown, INTENTS, rollIntent } from '../src/core/combat.js';

// These are initialized mechanics/configuration fixtures, not a simulation of
// earning level 105, completing the mainline, or legitimately obtaining gear.
// No sleeps, application patches, external packages, or filesystem writes.
const SEED = 0x50_57_49;
const AUTO_LIMIT = 300;
const ROUND_LIMIT = 200;
const originalRandom = Math.random;
const OriginalDate = Date;
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const failures = [];
let tests = 0;
let passed = 0;
let manualTurns = 0;
const auto = { started: 0, completed: 0, wins: 0, losses: 0, rounds: 0, maxRound: 0 };
// Game is a pure domain object. Any accidental storage access must fail rather
// than silently succeeding against a mock disk.
const forbiddenStorage = {
  getItem() { throw new Error('Game must not read localStorage'); },
  setItem() { throw new Error('Game must not write localStorage'); },
  removeItem() { throw new Error('Game must not remove localStorage data'); },
  clear() { throw new Error('Game must not clear localStorage'); },
};

function hash(text) {
  let n = SEED;
  for (const ch of text) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  return n >>> 0;
}
function seeded(seed) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let x = Math.imul(n ^ (n >>> 15), n | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function withRandom(value, fn) {
  const previous = Math.random;
  Math.random = typeof value === 'function' ? value : () => value;
  try { return fn(); } finally { Math.random = previous; }
}
function withDate(ms, fn) {
  const previous = globalThis.Date;
  globalThis.Date = class extends OriginalDate {
    constructor(...args) { super(...(args.length ? args : [ms])); }
    static now() { return ms; }
  };
  try { return fn(); } finally { globalThis.Date = previous; }
}
function test(name, fn) {
  tests++;
  const previous = Math.random;
  Math.random = seeded(hash(name));
  try {
    fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`FAIL ${name}: ${error.message}`);
  } finally {
    Math.random = previous;
  }
}
function cases(entries) {
  const errors = [];
  for (const [name, fn] of entries) {
    try { fn(); } catch (error) { errors.push(`${name}: ${error.message}`); }
  }
  assert.equal(errors.length, 0, errors.join('\n'));
}
function unchanged(g, fn, pattern) {
  const before = structuredClone(g.state);
  assert.throws(fn, pattern);
  assert.deepEqual(g.state, before, 'rejected operation must not mutate persisted state');
}
function newGame(cls = 'blademaster') {
  const g = new Game();
  g.start('测试修士', cls);
  return g;
}
function unlockedCult(lv) {
  let rank = 0;
  for (let i = 1; i < CULTIVATION.length; i++) if (lv >= CULTIVATION[i].lv) rank = i;
  return rank;
}
function fixture(cls = 'blademaster', lv = 20, options = {}) {
  const g = newGame(cls);
  const p = g.p;
  p.lv = lv;
  p.attrs = Object.fromEntries(Object.entries(CLASSES[cls].base)
    .map(([key, value]) => [key, value + CLASSES[cls].auto[key] * (lv - 1)]));
  p.points = 0;
  p.exp = 0;
  p.gold = 2_000_000;
  p.sp = 2_000_000;
  p.cult = options.cult ?? unlockedCult(lv);
  p.path = p.cult >= 9 ? (options.path ?? 'sage') : null;
  p.chi = options.chi ?? 300;
  p.equipment = {};
  const slots = options.gear === 'starter' ? ['weapon', 'body', 'legs', 'feet'] : Object.keys(SLOTS);
  for (const slot of slots) {
    const it = makeEquip(slot === 'ring2' ? 'ring1' : slot, lv, options.quality ?? 2, cls);
    p.equipment[slot] = it;
  }
  p.skills = {};
  for (const skill of SKILLS[cls]) {
    if (options.skills === 'basic' && skill.lv !== 1) continue;
    if (skill.lv > lv || (skill.cult || 0) > p.cult) continue;
    let rank = 1;
    if (options.skills !== 'basic') {
      while (rank < skill.maxLv && skillReq(skill, rank + 1).level <= lv) rank++;
    }
    p.skills[skill.id] = rank;
  }
  p.items = { town: 3, huanxian: 50 };
  for (const type of ['hp', 'mp']) {
    const best = Object.entries(ITEMS).filter(([, item]) => item.type === type && item.lv <= lv).at(-1);
    if (best) p.items[best[0]] = options.potions ?? 8;
  }
  const st = stats(p);
  p.hp = st.hp;
  p.mp = st.mp;
  return g;
}
function enemy(overrides = {}) {
  return { ...makeMonster('耐久测试靶', 20), hp: 100_000, maxHp: 100_000, atk: 2, def: 0, mdef: 0, ...overrides };
}
function manual(g, action, targetId) {
  const before = g.battle.round;
  const result = g.turn(action, targetId);
  manualTurns += g.battle.round - before;
  return result;
}
function combat(p, b, action, targetId) {
  const before = b.round;
  const result = takeTurn(p, b, action, targetId);
  manualTurns += b.round - before;
  return result;
}
function mechanicsSnapshot(p, b) {
  const snapshot = structuredClone({ p, b });
  delete snapshot.b.logs; // A rejection may log its reason, but must do nothing else.
  return snapshot;
}
function rejectedTurn(p, b, action, targetId, reason) {
  const before = mechanicsSnapshot(p, b);
  assert.equal(combat(p, b, action, targetId), null);
  assert.deepEqual(mechanicsSnapshot(p, b), before, 'invalid action advanced resources/timers');
  if (reason) assert.match(b.logs.at(-1).text, reason);
}
// Independent arithmetic oracle for the documented damage rules (no crit or
// random variance here); used for DOT ticks and deterministic mechanism cases.
function expectedDamage(amount, attacker, defender, type, elem = null) {
  const gap = Math.max(-300, Math.min(300, (attacker.attackLevel || 0) - (defender.defenseLevel || 0)));
  const level = gap >= 0 ? 1 + gap * 0.01 : 1 / (1 - gap * 0.01);
  const penetration = Math.max(0, Math.min(0.8, attacker[type === 'magic' ? 'penetrationM' : 'penetrationP'] || 0));
  const armorBreak = Math.max(0, Math.min(0.9, (defender.statuses || []).reduce((sum, s) => sum + (s.kind === 'armorBreak' ? s.value || 0 : 0), 0)));
  const defense = defender[type === 'magic' ? 'mdef' : 'def'] * (1 - armorBreak) * (1 - penetration);
  const resistance = elem ? Math.max(0, Math.min(0.8, defender[`${elem}Res`] || 0)) : 0;
  return Math.max(1, Math.round(amount * 100 / (100 + Math.max(0, defense) * 0.32) * level * (1 - resistance)));
}
function xpLedger(p) {
  let total = p.exp;
  for (let i = 1; i < p.lv; i++) total += expNeed(i);
  return total;
}
function woundedVictory(g, mob, zone) {
  // Reward/quest unit fixture: an already wounded real data monster, not an
  // auto-play win or evidence of organic progression. Use the real turn resolver.
  const m = Array.isArray(mob) ? makeMonster(...mob) : makeMonster(mob, 1);
  m.hp = 1;
  g.state.battle = createBattle(g.p, [m], { type: 'field', zone });
  withRandom(0.99, () => assert.equal(manual(g, 'attack'), 'win'));
}
function assertBattleBounds(g, b) {
  const p = g.p;
  const st = stats(p, b);
  for (const key of ['hp', 'mp', 'chi']) assert.ok(Number.isFinite(p[key]) && p[key] >= 0, `invalid player ${key}`);
  assert.ok(p.hp <= st.hp && p.mp <= st.mp && p.chi <= 300, 'resource overflow');
  assert.ok(b.logs.length <= 81, 'unbounded combat log'); // Game appends one reward summary.
  for (const m of b.monsters) {
    assert.ok(Number.isFinite(m.hp) && m.hp >= 0 && m.hp <= m.maxHp, 'monster HP out of bounds');
    const seen = new Set();
    for (const status of m.statuses) {
      assert.ok(Number.isInteger(status.turns) && status.turns > 0, 'expired status retained');
      const key = status.kind === 'stun' ? 'stun' : `${status.kind}:${status.source}`;
      assert.ok(!seen.has(key), 'duplicate same-source status');
      seen.add(key);
    }
  }
  assert.equal(new Set(b.buffs.map((x) => x.id)).size, b.buffs.length, 'duplicate buff');
  assert.equal(b.shield, b.buffs.reduce((sum, x) => sum + (x.shield || 0), 0));
  assert.ok(b.shield >= 0);
  for (const buff of b.buffs) assert.ok(buff.turns === null || (Number.isInteger(buff.turns) && buff.turns > 0));
  for (const cd of Object.values(b.cooldowns)) assert.ok(Number.isInteger(cd) && cd >= 0);
  for (const qty of Object.values(p.items)) assert.ok(Number.isInteger(qty) && qty >= 0);
  if (b.pet) assert.ok(b.pet.hp >= 0 && b.pet.hp <= b.pet.maxHp);
}
function runAuto(g, label) {
  assert.ok(auto.started < AUTO_LIMIT, 'automatic battle budget exhausted');
  const b = g.battle;
  assert.ok(g.busy, 'automatic fixture must start an active battle');
  auto.started++;
  try {
    while (g.busy && b.round < ROUND_LIMIT) {
      const choice = pickAutoAction(g.p, b);
      if (choice.action.startsWith('skill:')) assert.equal(canUseSkill(g.p, b, choice.action.slice(6)), null);
      const before = b.round;
      g.autoTurn();
      assert.equal(b.round, before + 1, `${label}: automatic choice did not advance a round`);
      assertBattleBounds(g, b);
    }
    assert.ok(['win', 'lose'].includes(b.result), `${label}: no terminal result within ${ROUND_LIMIT} rounds`);
    assert.ok(b.round > 0 && b.round <= ROUND_LIMIT);
    const before = mechanicsSnapshot(g.p, b);
    g.autoTurn();
    assert.deepEqual(mechanicsSnapshot(g.p, b), before, 'finished auto battle is not inert');
    return b.result;
  } finally {
    auto.rounds += b.round;
    auto.maxRound = Math.max(auto.maxRound, b.round);
    if (b.result) auto.completed++;
    if (b.result === 'win') auto.wins++;
    if (b.result === 'lose') auto.losses++;
    console.log(`  AUTO ${label}: result=${b.result ?? 'unfinished'}, rounds=${b.round}`);
  }
}

function testCreation() {
  assert.equal(Object.keys(CLASSES).length, 10);
  for (const [cls, definition] of Object.entries(CLASSES)) {
    const p = createPlayer('初生修士', cls);
    assert.equal(p.race, definition.race);
    assert.deepEqual(p.attrs, definition.base);
    assert.notEqual(p.attrs, definition.base);
    assert.equal(p.lv, 1);
    assert.equal(p.exp, 0);
    assert.equal(p.gold, 300);
    assert.equal(p.points, 0);
    assert.equal(p.location, HOME_CITY[p.race]);
    assert.deepEqual(p.discovered, [p.location]);
    assert.deepEqual(p.visits, [], 'discovery at creation is not a completed visit');
    assert.deepEqual(Object.keys(p.equipment), ['weapon']);
    const tutorialSkills = SKILLS[cls].filter((s) => s.tutorialUnlock);
    assert.equal(tutorialSkills.length, 1);
    assert.equal(tutorialSkills[0], SKILLS[cls][0]);
    assert.equal(tutorialSkills[0].kind, 'dmg');
    assert.deepEqual(p.skills, { [tutorialSkills[0].id]: 1 });
    assert.deepEqual(skillReq(tutorialSkills[0], 1), { level: 1, sp: 0, gold: 0 });
    assert.equal(canUseSkill(p, createBattle(p, [enemy()]), tutorialSkills[0].id), null);
    assert.equal(p.hp, stats(p).hp);
    assert.equal(p.mp, stats(p).mp);
    const before = structuredClone(p);
    const expected = structuredClone(p);
    ensureEquipment(expected);
    ensureEconomy(expected);
    expected.daily.arena = 0;
    const migrated = validateSave({ version: 1, player: p, journal: [] });
    assert.deepEqual(migrated, { version: 2, player: expected, journal: [], battle: null });
    assert.deepEqual(p, before, 'legacy migration must not mutate its input');
    assert.deepEqual(expected.charms, { hp: 0, mp: 0 });
    assert.deepEqual(expected.wallet, { yuanbao: 300, boundYuanbao: 0 });
    const started = newGame(cls);
    assert.equal(started.state.version, 2);
    assert.equal(started.p.daily.arena, 0);
    assert.deepEqual(validateSave(JSON.parse(started.export())), started.state);
    assert.equal(validateSave, validateSnapshot, 'Game must delegate validation to the snapshot schema');
  }
  const g = new Game();
  for (const [name, cls] of [['', 'wizard'], ['  ', 'wizard'], ['字'.repeat(13), 'wizard'], ['合法名', 'no-class'], ['合法名', 'constructor']]) {
    unchanged(g, () => g.start(name, cls));
  }
  g.start('  十二字以内  ', 'wizard');
  assert.equal(g.p.name, '十二字以内');
  assert.equal(new Game().p, null);
}
function testExperienceAndAllocation() {
  const g = newGame();
  const p = g.p;
  const initialAttrs = structuredClone(p.attrs);
  assert.equal(gainExp(p, -100), 0);
  assert.equal(p.exp, 0);
  p.hp = 1;
  p.mp = 0;
  const amount = expNeed(1) + expNeed(2) + expNeed(3) + 7;
  assert.equal(gainExp(p, amount), 3);
  assert.equal(p.lv, 4);
  assert.equal(p.exp, 7);
  assert.equal(p.points, 15);
  assert.deepEqual(p.attrs, initialAttrs, 'leveling must not silently allocate attributes');
  assert.equal(p.hp, stats(p).hp);
  assert.equal(p.mp, stats(p).mp);
  g.allocate('con', 2);
  assert.equal(p.points, 13);
  assert.equal(p.attrs.con, initialAttrs.con + 2);
  for (const [key, qty] of [['unknown', 1], ['str', 0], ['str', -1], ['str', 0.5], ['str', 14], ['str', NaN], ['str', Infinity]]) unchanged(g, () => g.allocate(key, qty));
  const before = structuredClone(p.attrs);
  g.autoAllocate();
  assert.equal(p.points, 0, 'recommended allocation spends all controlled available points');
  assert.deepEqual(p.attrs, { ...before, str: before.str + 12, con: before.con + 1 });
  for (const slot of ['weapon', 'body']) {
    const wear = gearSpec(slot, p.lv, 0, p.cls).wear;
    for (const [key, need] of Object.entries(wear)) if (key !== 'lv') assert.ok(p.attrs[key] >= need);
  }
  unchanged(g, () => g.autoAllocate());
  p.points = 5;
  g.state.battle = createBattle(p, [enemy()]);
  unchanged(g, () => g.allocate('str'));
  unchanged(g, () => g.autoAllocate());
  const capped = fixture('wizard', 104).p;
  capped.exp = expNeed(104) - 1;
  assert.equal(gainExp(capped, 1_000_000), 1);
  assert.equal(capped.lv, MAX_LEVEL);
  assert.equal(capped.points, 5);
  assert.equal(capped.exp, 0);
  const capSnapshot = structuredClone(capped);
  assert.equal(gainExp(capped, 1_000_000), 0);
  assert.deepEqual(capped, capSnapshot);
}
function testTravel() {
  const g = newGame();
  unchanged(g, () => g.travel('missing'));
  unchanged(g, () => g.travel('jiyu'));
  unchanged(g, () => g.travel('h_f2'), /需要5级/);
  g.travel('h_f1');
  assert.equal(g.p.location, 'h_f1');
  assert.ok(g.p.visits.includes('h_f1'));
  assert.equal(g.p.lastCity, 'wanliu');
  unchanged(g, () => g.travel('jiyu', true));
  g.hunt(0);
  unchanged(g, () => g.travel('wanliu'));
  withRandom(0, () => assert.equal(manual(g, 'escape'), 'escape'));
  g.travel('wanliu');
  assert.equal(g.battle, null);
  unchanged(g, () => g.travel('jiyu', true));
  g.p.discovered.push('jiyu');
  g.p.gold = 22;
  unchanged(g, () => g.travel('jiyu', true), /金币不足/);
  g.p.gold = 23;
  g.travel('jiyu', true);
  assert.equal(g.p.gold, 0);
  assert.equal(g.p.lastCity, 'jiyu');
  unchanged(g, () => g.travel('jiyu', true));
  const gate = fixture('wizard', 96, { cult: 8 });
  gate.p.location = 'f_longgong';
  unchanged(gate, () => gate.travel('f_xianmo'));
  gate.p.lv = 97;
  unchanged(gate, () => gate.travel('f_xianmo'), /仙魔修为/);
  gate.p.cult = 9;
  gate.p.path = 'sage';
  gate.travel('f_xianmo');
  assert.equal(gate.p.location, 'f_xianmo');
}
function testRejectedTeleportIsAtomic() {
  const g = newGame();
  g.p.discovered.push('zulong');
  g.p.gold = 100;
  unchanged(g, () => g.travel('zulong', true), /需要15级/);
}
function testEconomyAndItems() {
  const g = newGame();
  for (const qty of [0, -1, 0.5, 100, NaN, Infinity, '1']) unchanged(g, () => g.buy('hp1', qty));
  unchanged(g, () => g.buy('unknown'));
  unchanged(g, () => g.buy('tiangang'));
  unchanged(g, () => g.buy('hp2'));
  g.p.gold = 19;
  unchanged(g, () => g.buy('hp1', 2), /金币不足/);
  g.p.gold = 20;
  const qty = g.p.items.hp1;
  g.buy('hp1', 2);
  assert.equal(g.p.gold, 0);
  assert.equal(g.p.items.hp1, qty + 2);
  unchanged(g, () => g.useItem('hp1'), /已满/);
  g.p.hp = stats(g.p).hp - 1;
  g.useItem('hp1');
  assert.equal(g.p.hp, stats(g.p).hp);
  assert.equal(g.p.items.hp1, qty + 1);
  g.p.hp = 1;
  g.useItem('hp1');
  assert.equal(g.p.hp, 81);
  g.p.mp = stats(g.p).mp - 1;
  g.useItem('mp1');
  assert.equal(g.p.mp, stats(g.p).mp);
  g.p.items.mp1 = 0;
  unchanged(g, () => g.useItem('mp1'));
  unchanged(g, () => g.useItem('huanxian'));
  g.p.items.julin = 2;
  g.useItem('julin');
  g.useItem('julin');
  assert.equal(g.p.expBoost, 60);
  assert.equal(g.p.items.julin, 0);
  g.travel('h_f1');
  unchanged(g, () => g.buy('hp1'));
  unchanged(g, () => g.rest());
  g.useItem('town');
  assert.equal(g.p.location, g.p.lastCity);
  assert.equal(g.p.items.town, 2);
  g.p.gold = 6;
  unchanged(g, () => g.rest(), /金币不足/);
  g.p.gold = 7;
  g.rest();
  assert.equal(g.p.gold, 0);
  assert.equal(g.p.hp, stats(g.p).hp);
  assert.equal(g.p.mp, stats(g.p).mp);
  unchanged(g, () => g.rest(), /已满/);
  const boost = fixture('wizard', 20);
  boost.p.expBoost = 1;
  const beforeXp = xpLedger(boost.p);
  const reward = monsterReward(makeMonster('小野猪', 1));
  woundedVictory(boost, ['小野猪', 1], 'h_f1');
  assert.equal(xpLedger(boost.p) - beforeXp, reward.exp * 2);
  assert.equal(boost.p.expBoost, 0);
  assert.equal(boost.p.totals.earned, reward.gold);
}
function testPotionLevelOutsideBattle() {
  cases(['hp', 'mp'].map((type) => [`${type} potion below required level`, () => {
    const g = fixture('wizard', ITEMS[`${type}2`].lv - 1);
    g.p.items[`${type}2`] = 1;
    g.p[type] = 1;
    unchanged(g, () => g.useItem(`${type}2`), /等级|级/);
  }]));
}
function testEquipmentAndRing2() {
  const g = fixture('wizard', 20);
  g.p.equipment = { weapon: g.p.equipment.weapon };
  const rings = [0, 1, 2].map((q) => makeEquip('ring1', 20, q, g.p.cls));
  g.p.bag.push(...rings);
  g.equip(rings[0].uid);
  g.equip(rings[1].uid);
  assert.equal(g.p.equipment.ring1.uid, rings[0].uid);
  assert.equal(g.p.equipment.ring2.uid, rings[1].uid);
  g.equip(rings[2].uid, 'ring2');
  assert.equal(g.p.equipment.ring2.uid, rings[2].uid);
  assert.deepEqual(g.p.bag.map((x) => x.uid), [rings[1].uid]);
  g.equip(rings[1].uid, 'ring1');
  assert.deepEqual(g.p.bag.map((x) => x.uid), [rings[0].uid]);
  assert.equal(new Set([...g.p.bag, ...Object.values(g.p.equipment)].map((x) => x.uid)).size, 4);
  assert.deepEqual(validateSave(JSON.parse(g.export())).player.equipment.ring2, rings[2]);
  unchanged(g, () => g.equip('absent'));
  unchanged(g, () => g.equip(rings[0].uid, 'body'));
  const wrongClass = makeEquip('weapon', 20, 0, 'archer');
  const tooHigh = makeEquip('body', 21, 0, g.p.cls);
  g.p.bag.push(wrongClass, tooHigh);
  unchanged(g, () => g.equip(wrongClass.uid));
  unchanged(g, () => g.equip(tooHigh.uid));
  const gold = g.p.gold;
  const price = itemSell(wrongClass);
  g.sell(wrongClass.uid);
  assert.equal(g.p.gold, gold + price);
  unchanged(g, () => g.sell(wrongClass.uid));
  const common = makeEquip('feet', 20, 0, g.p.cls);
  const refined = makeEquip('feet', 20, 0, g.p.cls);
  refined.refine = 1;
  const blue = makeEquip('feet', 20, 1, g.p.cls);
  g.p.bag = [common, refined, blue];
  const money = g.p.gold;
  g.sellCommon();
  assert.equal(g.p.gold, money + itemSell(common));
  assert.deepEqual(g.p.bag.map((x) => x.uid), [refined.uid, blue.uid]);
  g.p.bag = Array.from({ length: BAG_LIMIT }, () => makeEquip('head', 20, 0, g.p.cls));
  unchanged(g, () => g.buyEquip('weapon'), /背包已满/);
  const overflow = makeEquip('body', 20, 2, g.p.cls);
  const beforeOverflow = g.p.gold;
  assert.equal(g.putEquip(overflow), false);
  assert.equal(g.p.bag.length, BAG_LIMIT);
  assert.equal(g.p.gold, beforeOverflow + itemSell(overflow));
  unchanged(g, () => g.buyEquip('ring2'));
}
function testSkillLearning() {
  for (const cls of Object.keys(CLASSES)) {
    const g = fixture(cls, 20);
    const skill = SKILLS[cls][0];
    g.p.skills[skill.id] = 1;
    const req = skillReq(skill, 2);
    g.p.lv = req.level - 1;
    unchanged(g, () => g.learn(skill.id));
    g.p.lv = req.level;
    g.p.sp = req.sp - 1;
    g.p.gold = req.gold;
    unchanged(g, () => g.learn(skill.id));
    g.p.sp = req.sp;
    g.p.gold = req.gold - 1;
    unchanged(g, () => g.learn(skill.id));
    g.p.gold = req.gold;
    g.learn(skill.id);
    assert.equal(g.p.skills[skill.id], 2);
    assert.equal(g.p.sp, 0);
    assert.equal(g.p.gold, 0);
    g.p.skills[skill.id] = skill.maxLv;
    g.p.lv = 105;
    unchanged(g, () => g.learn(skill.id));
    unchanged(g, () => g.learn('foreign-skill'));
  }
  const g = fixture('wizard', 100, { cult: 5 });
  const ultimate = findSkill('wizard', 'wz7');
  delete g.p.skills[ultimate.id];
  unchanged(g, () => g.learn(ultimate.id), /境界不足/);
  g.p.cult = 6;
  g.learn(ultimate.id);
  assert.equal(g.p.skills.wz7, 1);
  g.p.location = 'h_f1';
  unchanged(g, () => g.learn('wz1'));
  g.p.location = 'wanliu';
  g.state.battle = createBattle(g.p, [enemy()]);
  unchanged(g, () => g.learn('wz1'));
}
function testQuestOnlyCurrentTarget() {
  const g = fixture('blademaster', 20);
  const [firstVisit, firstKill, returnHome, nextKill] = g.quests;
  assert.deepEqual(firstVisit.goal, { type: 'visit', zone: firstKill.zone });
  assert.equal(firstKill.goal.type, 'kill');
  assert.equal(firstKill.goal.count, 1);
  assert.deepEqual(returnHome.goal, { type: 'visit', zone: HOME_CITY[g.p.race] });
  assert.equal(nextKill.goal.type, 'kill');
  for (let i = 0; i < firstKill.goal.count; i++) woundedVictory(g, firstKill.goal.mob, firstKill.zone);
  assert.equal(g.p.mainProgress, 0, 'future quest must not accumulate kills');
  unchanged(g, () => g.claimQuest());
  g.travel(firstVisit.goal.zone);
  assert.equal(g.questProgress(firstVisit).ready, true);
  assert.equal(g.questProgress(returnHome).ready, false, 'starting at home must not complete the return journey');
  g.claimQuest();
  assert.equal(g.p.mainIndex, firstKill.idx);
  assert.deepEqual(g.questProgress(g.mainQuest), { done: 0, total: firstKill.goal.count, ready: false });
  unchanged(g, () => g.claimQuest());
  woundedVictory(g, nextKill.goal.mob, firstKill.zone);
  assert.equal(g.p.mainProgress, 0, 'wrong monster counted');
  woundedVictory(g, firstKill.goal.mob, 'e_f1');
  assert.equal(g.p.mainProgress, 0, 'wrong zone counted');
  for (let i = 0; i < firstKill.goal.count; i++) woundedVictory(g, firstKill.goal.mob, firstKill.zone);
  assert.equal(g.p.mainProgress, firstKill.goal.count);
  assert.equal(g.questProgress(g.mainQuest).ready, true);
  const before = { gold: g.p.gold, sp: g.p.sp, xp: xpLedger(g.p) };
  g.claimQuest();
  assert.equal(g.p.gold - before.gold, Math.round(150 + firstKill.rlv * 100));
  assert.equal(g.p.sp - before.sp, Math.round((100 + firstKill.rlv ** 2 * 1.5) * firstKill.rsp));
  assert.equal(xpLedger(g.p) - before.xp, Math.round(expNeed(firstKill.rlv) * firstKill.rexp));
  assert.equal(g.p.mainIndex, returnHome.idx);
  assert.equal(g.p.mainProgress, 0, 'preexisting kills leaked into return objective');
  unchanged(g, () => g.claimQuest());
  g.travel(returnHome.goal.zone);
  assert.equal(g.questProgress(returnHome).ready, true);
  g.claimQuest();
  assert.equal(g.p.mainIndex, nextKill.idx);
  assert.equal(g.p.mainProgress, 0, 'preexisting kills leaked into new objective');
  unchanged(g, () => g.claimQuest());
  woundedVictory(g, nextKill.goal.mob, nextKill.zone);
  assert.equal(g.p.mainProgress, 1);
  const progression = g.p.mainProgress;
  g.questProgress(g.mainQuest);
  assert.equal(g.p.mainProgress, progression, 'reading progress must be pure');
  const dungeonQuest = g.quests.find((q) => q.goal.type === 'dungeon');
  assert.equal(g.questProgress(dungeonQuest).ready, false);
  g.p.clears[dungeonQuest.goal.id] = 1;
  assert.equal(g.questProgress(dungeonQuest).ready, true);
  const visitQuest = g.quests.find((q) => q.goal.type === 'visit' && q.goal.zone === 'zulong');
  assert.equal(g.questProgress(visitQuest).ready, false);
  g.p.visits.push(visitQuest.goal.zone);
  assert.equal(g.questProgress(visitQuest).ready, true);
  const cultQuest = g.quests.find((q) => q.goal.type === 'cult');
  g.p.cult = 0;
  assert.equal(g.questProgress(cultQuest).ready, false);
  g.p.cult = cultQuest.goal.rank;
  assert.equal(g.questProgress(cultQuest).ready, true);
  assert.deepEqual(g.questProgress(null), { done: 0, total: 0, ready: false });
}
function testBountyAndCards() {
  const g = fixture('wizard', 20);
  g.p.daily.bounties = BOUNTY_DAILY - 1;
  g.p.bountyProgress = 99;
  g.acceptBounty();
  const q = structuredClone(g.p.bounty);
  assert.equal(g.p.bountyProgress, 0);
  assert.equal(g.p.daily.bounties, 9, 'accepting must not count as completing');
  unchanged(g, () => g.acceptBounty());
  unchanged(g, () => g.claimQuest(true));
  woundedVictory(g, q.goal.mob, q.zone === 'h_f1' ? 'e_f1' : 'h_f1');
  assert.equal(g.p.bountyProgress, 0);
  woundedVictory(g, '非目标怪物', q.zone);
  assert.equal(g.p.bountyProgress, 0);
  const mob = ZONES[q.zone].mobs.find((m) => m[0] === q.goal.mob);
  for (let i = 0; i < q.goal.count; i++) woundedVictory(g, mob, q.zone);
  assert.equal(g.p.bountyProgress, q.goal.count);
  const before = { gold: g.p.gold, sp: g.p.sp, xp: xpLedger(g.p) };
  g.claimQuest(true);
  assert.equal(g.p.bounty, null);
  assert.equal(g.p.bountyProgress, 0);
  assert.equal(g.p.daily.bounties, BOUNTY_DAILY);
  assert.equal(g.p.gold - before.gold, 150 + q.rlv * 100);
  assert.equal(g.p.sp - before.sp, Math.round((100 + q.rlv ** 2 * 1.5) * q.rsp));
  assert.equal(xpLedger(g.p) - before.xp, Math.round(expNeed(q.rlv) * q.rexp));
  unchanged(g, () => g.claimQuest(true));
  unchanged(g, () => g.acceptBounty());
  g.p.items.card = 3;
  const sp = g.p.sp;
  g.redeemCards();
  assert.equal(g.p.sp, sp + 3 * (100 + g.p.lv * 30));
  assert.equal(g.p.items.card, 0);
  unchanged(g, () => g.redeemCards());
}
function testDailyRefreshAndSignIn() {
  const today = OriginalDate.UTC(2026, 10, 20, 12);
  let g;
  withDate(today, () => {
    g = fixture('wizard', 20);
    const gold = g.p.gold;
    const stones = g.p.items.huanxian;
    g.signIn();
    assert.equal(g.p.gold, gold + 300 + g.p.lv * 50);
    assert.equal(g.p.items.huanxian, stones + 3);
    assert.equal(g.p.items.julin, 1);
    assert.equal(g.p.daily.signed, true);
    unchanged(g, () => g.signIn());
    g.p.daily.bounties = 10;
    g.p.daily.dungeons = { d15: 3 };
    g.p.daily.arena = 3;
    g.p.bounty = makeBounty(g.p.lv);
    const before = structuredClone(g.p.daily);
    g.refreshDay();
    assert.deepEqual(g.p.daily, before);
  });
  const persistent = structuredClone(g.p);
  withDate(today + 86400000, () => {
    g.refreshDay();
    assert.deepEqual(g.p.daily, { day: dayKey(), bounties: 0, dungeons: {}, signed: false, arena: 0 });
    const expected = structuredClone(persistent);
    expected.daily = structuredClone(g.p.daily);
    assert.deepEqual(g.p, expected, 'daily refresh must preserve inventory, active bounty, and progression');
    g.signIn();
    assert.equal(g.p.items.julin, 2);
    assert.equal(g.p.items.huanxian, persistent.items.huanxian + 3);
    unchanged(g, () => g.signIn());
  });
  const busy = fixture();
  busy.state.battle = createBattle(busy.p, [enemy()]);
  unchanged(busy, () => busy.signIn());
}
function testForge() {
  for (const quality of [1, 2]) {
    const g = fixture('wizard', 20);
    const recipe = getProductionRecipe('ordinary-20-weapon', g.p.cls);
    g.p.production = { blacksmith: { level: recipe.skillLevel, exp: 0 } };
    g.p.items = { ...g.p.items, ...recipe.materials };
    g.p.gold = recipe.gold - 1;
    unchanged(g, () => g.forge('weapon', quality));
    g.p.gold = recipe.gold;
    const material = Object.keys(recipe.materials)[0];
    g.p.items[material]--;
    unchanged(g, () => g.forge('weapon', quality));
    g.p.items[material]++;
    const huanxian = g.p.items.huanxian;
    // Both old quality requests redirect to actual production, not forced q2.
    withRandom(0.5, () => g.forge('weapon', quality));
    assert.equal(g.p.gold, 0);
    assert.equal(g.p.items.huanxian, huanxian);
    for (const id of Object.keys(recipe.materials)) assert.equal(g.p.items[id], 0);
    assert.equal(g.p.production.blacksmith.exp, 1);
    assert.equal(g.p.bag.length, 1);
    assert.equal(g.p.bag[0].q, 1);
    assert.ok(matchesGearSpec(g.p.bag[0]));
    assert.equal(g.p.bag[0].lv, g.p.lv);
    assert.equal(g.p.bag[0].cls, 'wizard');
    assert.ok(Object.keys(g.p.bag[0].addons).length > 0);
    assert.ok(Object.values(equipStats(g.p.bag[0])).every(Number.isFinite));
  }
  const g = fixture();
  for (const [slot, quality] of [['ring2', 1], ['missing', 1], ['weapon', 0], ['weapon', 3]]) unchanged(g, () => g.forge(slot, quality));
  g.p.bag = Array.from({ length: BAG_LIMIT }, () => makeEquip('head', 20, 0, g.p.cls));
  unchanged(g, () => g.forge('body'));
  g.p.bag = [];
  g.p.location = 'h_f1';
  unchanged(g, () => g.forge('body'));
}
function testRefineSuccessFailureAndAids() {
  const scenarios = [
    { prev: 0, aid: '', random: 0.499999, next: 1 },
    { prev: 0, aid: '', random: REFINE_RATE[0], next: 0 },
    { prev: 3, aid: '', random: 0.99, next: 0 },
    { prev: 3, aid: 'tiangang', random: 0.99, next: 0 },
    { prev: 3, aid: 'disha', random: 0.99, next: 2 },
    { prev: 0, aid: 'disha', random: 0.99, next: 0 },
    { prev: 3, aid: 'qiankun', random: REFINE_RATE[3] - 0.00001, next: 4 },
    { prev: 3, aid: 'qiankun', random: REFINE_RATE[3], next: 3 },
    { prev: 0, aid: 'dragonOrb1', random: 0.99999, next: 1 },
    { prev: 11, aid: '', random: 0, next: 12 },
  ];
  for (const { prev, aid, random, next } of scenarios) {
    for (const slot of ['weapon', 'body', 'ring2']) {
      const g = fixture('wizard', 20);
      const it = g.p.equipment[slot];
      it.refine = prev;
      const gold = (prev + 1) * it.lv * 15 + 50;
      const stones = it.slot === 'weapon' ? 2 : 1;
      g.p.gold = gold;
      g.p.items.huanxian = stones;
      if (aid) g.p.items[aid] = 1;
      withRandom(random, () => g.refine(slot, aid));
      assert.equal(it.refine, next, `${slot}: +${prev}, ${aid || 'unprotected'}, roll=${random}`);
      assert.equal(g.p.gold, 0);
      assert.equal(g.p.items.huanxian, 0);
      if (aid) assert.equal(g.p.items[aid], 0);
      assert.ok(g.p.hp <= stats(g.p).hp);
      assert.ok(g.message.includes(next > prev ? '成功' : '失败'));
    }
  }
  const g = fixture();
  const it = g.p.equipment.weapon;
  const cost = it.lv * 15 + 50;
  g.p.gold = cost - 1;
  unchanged(g, () => g.refine('weapon'));
  g.p.gold = cost;
  g.p.items.huanxian = 1;
  unchanged(g, () => g.refine('weapon'));
  g.p.items.huanxian = 2;
  unchanged(g, () => g.refine('weapon', 'tiangang'));
  unchanged(g, () => g.refine('weapon', 'fake'));
  unchanged(g, () => g.refine('missing'));
  it.refine = REFINE_MAX;
  unchanged(g, () => g.refine('weapon'));
  it.refine = 0;
  g.p.location = 'h_f1';
  unchanged(g, () => g.refine('weapon'));
}
function testDungeonEntryLimits() {
  const g = fixture('wizard', 11);
  dungeonEntrance(g, DUNGEONS.find((d) => d.id === 'd15'));
  unchanged(g, () => g.enterDungeon('d15'));
  unchanged(g, () => g.enterDungeon('missing'));
  g.p.lv = 12;
  for (let i = 1; i <= DUNGEON_DAILY; i++) {
    g.enterDungeon('d15');
    assert.equal(g.p.daily.dungeons.d15, i);
    assert.equal(g.battle.context.wave, 0);
    assert.equal(g.battle.monsters.length, 2);
    unchanged(g, () => g.enterDungeon('d15'));
    unchanged(g, () => g.nextWave());
    withRandom(0, () => assert.equal(manual(g, 'escape'), 'escape'));
    unchanged(g, () => g.nextWave());
    assert.equal(g.p.daily.dungeons.d15, i, 'escape must not refund entry');
  }
  unchanged(g, () => g.enterDungeon('d15'), /次数已用尽/);
  g.p.location = 'h_f1';
  unchanged(g, () => g.enterDungeon('d25'));
}
function testDungeonWavesAndGuaranteedLoot(id) {
  const d = DUNGEONS.find((x) => x.id === id);
  const g = fixture('wizard', 105);
  const startItems = structuredClone(g.p.items);
  const startBattles = g.p.totals.battles;
  dungeonEntrance(g, d);
  g.enterDungeon(id);
  for (let wave = 0; wave <= (d.waves || 3); wave++) {
    assert.equal(g.battle.context.wave, wave);
    const bossWave = wave === (d.waves || 3);
    assert.equal(g.battle.context.bossWave, bossWave);
    assert.equal(g.battle.context.id, id);
    assert.equal(g.battle.monsters.length, bossWave ? 1 : 2);
    assert.equal(runAuto(g, `dungeon/${id}/wave-${wave}/initialized-L105`), 'win');
    if (!bossWave) {
      assert.equal(g.p.clears[id] || 0, 0, 'non-boss waves must not award a clear');
      const oldBattle = g.battle;
      const before = structuredClone(g.p);
      g.nextWave();
      assert.notEqual(g.battle, oldBattle);
      assert.deepEqual(g.p, before, 'next wave must not heal or charge another entry');
      assert.deepEqual(g.battle.buffs, []);
      assert.deepEqual(g.battle.cooldowns, {});
      assert.equal(g.battle.pet, null);
      assert.equal(g.battle.round, 0);
    }
  }
  assert.equal(g.p.daily.dungeons[id], 1);
  assert.equal(g.p.clears[id], 1);
  assert.equal(g.p.totals.battles - startBattles, (d.waves || 3) + 1);
  if (d.rewardKind === 'materials') {
    assert.equal(g.p.bag.length, 0, 'material dungeons must never drop finished gear in any wave');
    for (const id of d.rewardMaterials) assert.equal(g.p.items[id] - (startItems[id] || 0), 4);
  } else assert.ok(g.p.bag.some((it) => it.slot === 'weapon' && it.lv === d.lv && it.q === 2 && matchesGearSpec(it)), 'guaranteed classic/Frost weapon missing');
  assert.equal(g.p.items.card, 1);
  assert.equal(g.p.items.tiangang, 1);
  assert.ok(g.p.items.huanxian >= startItems.huanxian + 8, 'boss and clear guaranteed stones missing');
  unchanged(g, () => g.nextWave());
}
function testCultTrialsAndBreakthroughs() {
  const tooLow = fixture('wizard', 8, { cult: 0 });
  unchanged(tooLow, () => tooLow.enterTrial());
  unchanged(tooLow, () => tooLow.breakthrough());
  // Level/equipment are deliberately provisioned. The eleven trials themselves
  // run real automatic turns, but this is not a claim of natural leveling.
  const g = fixture('wizard', 105, { cult: 0 });
  for (let rank = 1; rank < CULTIVATION.length; rank++) {
    const c = CULTIVATION[rank];
    g.p.sp = c.sp;
    const gold = g.p.gold;
    const kills = structuredClone(g.p.kills);
    const xp = xpLedger(g.p);
    g.enterTrial();
    assert.equal(g.battle.context.rank, rank);
    assert.equal(g.battle.monsters[0].name, CULT_TRIALS[rank].boss);
    assert.equal(runAuto(g, `cult/rank-${rank}/initialized-L105`), 'win');
    assert.equal(g.p.trialReady, true);
    assert.equal(g.p.cult, rank - 1, 'trial win must not automatically break through');
    assert.equal(g.p.gold, gold);
    assert.deepEqual(g.p.kills, kills);
    assert.equal(xpLedger(g.p), xp, 'trial must not award field experience');
    unchanged(g, () => g.enterTrial());
    g.p.sp = c.sp - 1;
    unchanged(g, () => g.breakthrough('sage'));
    g.p.sp = c.sp;
    g.breakthrough('sage');
    assert.equal(g.p.cult, rank);
    assert.equal(g.p.sp, 0);
    assert.equal(g.p.trialReady, false);
    assert.equal(g.p.hp, stats(g.p).hp);
    assert.equal(g.p.mp, stats(g.p).mp);
    if (rank >= 9) assert.equal(g.p.path, 'sage');
  }
  unchanged(g, () => g.enterTrial());
  unchanged(g, () => g.breakthrough());
}
function testSageDemonBranches() {
  const branches = {};
  for (const path of ['sage', 'demon']) {
    const g = fixture('wizard', 89, { cult: 8 });
    g.p.trialReady = true; // Isolate branch selection from the separately tested trial.
    g.p.sp = CULTIVATION[9].sp;
    unchanged(g, () => g.breakthrough());
    unchanged(g, () => g.breakthrough('invalid'));
    const before = stats(g.p);
    g.breakthrough(path);
    assert.equal(g.p.path, path);
    assert.equal(g.p.cult, 9);
    const after = stats(g.p);
    if (path === 'sage') {
      assert.equal(after.hp - before.hp, 1000);
      assert.ok(after.mdef > before.mdef);
    } else {
      assert.ok(after.atk > before.atk);
      assert.ok(after.crit > before.crit);
    }
    branches[path] = g;
    for (const rank of [10, 11]) {
      g.p.lv = CULTIVATION[rank].lv;
      g.p.trialReady = true;
      g.p.sp = CULTIVATION[rank].sp;
      g.breakthrough(path === 'sage' ? 'demon' : 'sage');
      assert.equal(g.p.path, path, 'later breakthrough must preserve the chosen branch');
    }
  }
  assert.ok(stats(branches.sage.p).hp > stats(branches.demon.p).hp);
  assert.ok(stats(branches.demon.p).atk > stats(branches.sage.p).atk);
}
function testDeathLossAndReviveScroll() {
  for (const revive of [false, true]) {
    const g = fixture('blademaster', 20);
    g.p.location = 'h_f1';
    g.p.exp = 101;
    g.p.hp = 1;
    if (revive) g.p.items.revive = 1;
    const before = structuredClone(g.p);
    const st = stats(g.p);
    g.state.battle = createBattle(g.p, [enemy({ atk: 1_000_000 })], { type: 'field', zone: 'h_f1' });
    withRandom(0.5, () => assert.equal(manual(g, 'defend'), 'lose'));
    assert.equal(g.p.exp, revive ? 101 : 96);
    assert.equal(g.p.location, revive ? 'h_f1' : g.p.lastCity);
    assert.equal(g.p.hp, Math.ceil(st.hp * 0.5));
    assert.equal(g.p.mp, Math.ceil(st.mp * 0.5));
    assert.equal(g.p.totals.deaths, 1);
    assert.equal(g.p.totals.battles, 0);
    assert.equal(g.p.gold, before.gold);
    assert.equal(g.p.sp, before.sp);
    assert.equal(g.p.lv, before.lv);
    const worn = structuredClone(before.equipment);
    for (const it of Object.values(worn)) it.durability = Math.max(0, it.durability - 1);
    assert.deepEqual(g.p.equipment, worn, 'death must deduct exactly one durability and preserve every other equipment field');
    assert.deepEqual(g.p.bag, before.bag, 'packed equipment must not wear');
    if (revive) assert.equal(g.p.items.revive, 0);
    unchanged(g, () => g.turn('attack'));
  }
}
function testClericPassiveRevivesOnlyOnce() {
  const p = fixture('cleric', 60).p;
  p.hp = 1;
  const b = createBattle(p, [enemy({ atk: 1_000_000 })]);
  withRandom(0.5, () => {
    assert.equal(combat(p, b, 'defend'), null);
    assert.equal(b.revived, true);
    assert.equal(p.hp, Math.min(stats(p, b).hp, Math.round(stats(p, b).hp * findSkill('cleric', 'cl7').revive) + stats(p, b).hpRegen), 'one-time revive is followed by the surviving player’s end-round natural recovery');
    assert.equal(combat(p, b, 'defend'), 'lose');
    assert.equal(p.hp, 0);
  });
}
function testSaveRoundTrip() {
  for (const cls of Object.keys(CLASSES)) {
    const g = fixture(cls, 100, { path: Object.keys(CLASSES).indexOf(cls) % 2 ? 'demon' : 'sage' });
    const p = g.p;
    p.exp = 321;
    p.points = 7;
    p.hp -= 17;
    p.mp -= 9;
    p.trialReady = true;
    p.flight = true;
    p.expBoost = 13;
    p.location = 'f_longgong';
    p.lastCity = 'zulong';
    p.discovered = Object.keys(ZONES);
    p.visits = Object.keys(ZONES);
    p.mainIndex = 2;
    p.mainProgress = 3;
    p.bounty = makeBounty(p.lv);
    p.bountyProgress = 2;
    p.kills = { 蟹将: 15, 小野猪: 4 };
    p.clears = { d15: 2, d75: 1 };
    p.totals = { battles: 42, deaths: 3, earned: 12345 };
    p.daily = { day: dayKey(), bounties: 4, dungeons: { d15: 2, d100: 1 }, signed: true, arena: 2 };
    p.items.revive = 0;
    p.items.card = 5;
    p.bag = [makeEquip('weapon', 99, 3, cls), makeEquip('head', 100, 1, cls)];
    p.equipment.ring2.refine = 4;
    p.bag[0].refine = 12;
    for (let i = 0; i < 75; i++) g.event(`存档日志${i}`, i % 2 ? 'victory' : 'system');
    assert.equal(g.state.journal.length, 60);
    const before = structuredClone(g.state);
    const exported = g.export();
    const parsed = JSON.parse(exported);
    const validated = validateSave(parsed);
    assert.deepEqual(g.state, before, 'export/validate must not alter the game');
    assert.deepEqual(parsed, { version: 2, player: before.player, journal: before.journal, battle: before.battle });
    const loaded = new Game(validated);
    assert.deepEqual(loaded.state, before, `${cls}: export → validate → load lost data`);
    assert.deepEqual(JSON.parse(loaded.export()), parsed);
  }
  const g = fixture('venomancer', 60);
  g.p.location = 'h_f1';
  g.state.battle = createBattle(g.p, [makeMonster('快照物理靶', 60), makeMonster('快照法术靶', 60, 'elite', 'magic', 1)],
    { type: 'field', zone: 'h_f1', noEscape: false });
  // Populate battle fields using real combat, not incomplete ad-hoc monsters.
  withRandom(0.5, () => {
    combat(g.p, g.battle, 'skill:vm2');
    combat(g.p, g.battle, 'skill:vm1', 'm1');
  });
  assert.ok(g.busy);
  assert.ok(g.battle.pet?.hp > 0);
  assert.ok(g.battle.monsters[1].statuses.some((s) => s.kind === 'dot'));
  assert.ok(g.battle.round > 0 && g.battle.logs.length > 0);
  const before = structuredClone(g.state);
  const validated = validateSave(JSON.parse(g.export()));
  assert.deepEqual(validated, before, 'version 2 must preserve the entire active battle');
  assert.deepEqual(new Game(validated).state, before);
  assert.deepEqual(g.state, before, 'battle export/validate must be pure');
  const raw = JSON.parse(g.export());
  raw.version = 1; // Journal cleaning and battle dropping are legacy migration only.
  raw.journal = [{ text: '有效日志', kind: 'system' }, null, { text: 1 }, { text: 'x'.repeat(1000) }];
  const legacyBefore = structuredClone(raw);
  const migrated = validateSave(raw);
  assert.deepEqual(migrated.journal, [{ text: '有效日志', kind: 'system', time: '' }], 'legacy journal migration must fill the missing time field');
  assert.equal(migrated.version, 2);
  assert.equal(migrated.battle, null);
  assert.deepEqual(raw, legacyBefore, 'legacy migration must not mutate the raw snapshot');
}
function testSaveStorageFailureAndNoStorage() {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const external = { unrelated: 'must remain untouched' };
  const beforeExternal = structuredClone(external);
  let accesses = 0;
  const forbidden = (operation) => {
    accesses++;
    throw new Error(`Game accessed external storage: ${operation}`);
  };
  const exercise = () => {
    let g;
    assert.doesNotThrow(() => { g = newGame(); }, 'start must not depend on storage');
    assert.equal(typeof g.save, 'undefined', 'Game must not expose the removed disk-writing save method');
    g.p.location = 'h_f1';
    g.state.battle = createBattle(g.p, [makeMonster('领域隔离靶', 1)], { type: 'field', zone: 'h_f1' });
    assert.doesNotThrow(() => withRandom(0.5, () => manual(g, 'defend')), 'turn must not depend on storage');
    assert.equal(g.battle.round, 1);
    const before = structuredClone(g.state);
    assert.doesNotThrow(() => assert.deepEqual(JSON.parse(g.export()), before), 'export must not depend on storage');
    assert.deepEqual(g.state, before, 'export must not mutate domain state');
    assert.deepEqual(external, beforeExternal, 'domain operations must not modify external storage');
  };
  try {
    cases([
      ['localStorage absent', () => { delete globalThis.localStorage; exercise(); }],
      ['localStorage throwing getter/setter', () => {
        Object.defineProperty(globalThis, 'localStorage', { configurable: true,
          get() { return forbidden('getter'); }, set() { forbidden('setter'); } });
        exercise();
      }],
      ['localStorage methods throw', () => {
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
          getItem() { return forbidden('getItem'); }, setItem() { forbidden('setItem'); },
          removeItem() { forbidden('removeItem'); }, clear() { forbidden('clear'); },
        } });
        exercise();
      }],
    ]);
    assert.equal(accesses, 0, 'Game must never even attempt a storage access');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
}
function invalidSaves(entries) {
  const valid = JSON.parse(fixture('wizard', 100).export());
  const accepted = [];
  for (const [name, mutate] of entries) {
    const raw = structuredClone(valid);
    mutate(raw);
    try { validateSave(raw); accepted.push(name); } catch (error) { assert.ok(error instanceof Error); }
  }
  assert.deepEqual(accepted, [], `validator accepted invalid saves: ${accepted.join(', ')}`);
}
function testMalformedJSONAndStructures() {
  for (const text of ['', '{', '{"version":1,}', '{"x":NaN}', '{"x":Infinity}', 'undefined']) assert.throws(() => JSON.parse(text), SyntaxError);
  for (const raw of [null, [], {}, 1, 'save', { version: 2, player: {} }, { version: 1, player: null }]) assert.throws(() => validateSave(raw));
  const entries = [];
  for (const field of ['attrs', 'skills', 'items', 'kills', 'clears', 'equipment', 'totals', 'daily']) {
    for (const value of [null, [], 'bad']) entries.push([`${field}=${JSON.stringify(value)}`, (raw) => { raw.player[field] = value; }]);
  }
  entries.push(
    ['unknown class', (r) => { r.player.cls = 'constructor'; }],
    ['race mismatch', (r) => { r.player.race = 'elf'; }],
    ['empty name', (r) => { r.player.name = ''; }],
    ['name too long', (r) => { r.player.name = '字'.repeat(17); }],
    ['unknown location', (r) => { r.player.location = 'missing'; }],
    ['lastCity is field', (r) => { r.player.lastCity = 'h_f1'; }],
    ['missing attr', (r) => { delete r.player.attrs.mag; }],
    ['extra attr', (r) => { r.player.attrs.luck = 1; }],
    ['bag object', (r) => { r.player.bag = {}; }],
    ['null bag item', (r) => { r.player.bag = [null]; }],
    ['bag overflow', (r) => { r.player.bag = Array(BAG_LIMIT + 1).fill(r.player.equipment.weapon); }],
    ['duplicate equip uid', (r) => { r.player.bag = [structuredClone(r.player.equipment.weapon)]; }],
    ['invalid equip uid', (r) => { r.player.equipment.weapon.uid = '../x'; }],
    ['equipment slot mismatch', (r) => { r.player.equipment.body.slot = 'head'; }],
    ['unknown equipment slot', (r) => { r.player.equipment.fake = r.player.equipment.body; }],
    ['unknown equip stat', (r) => { r.player.equipment.weapon.base.luck = 1; }],
    ['equipment addons array', (r) => { r.player.equipment.weapon.addons = []; }],
    ['visits object', (r) => { r.player.visits = {}; }],
    ['unknown visited zone', (r) => { r.player.visits = ['missing']; }],
    ['discovered null', (r) => { r.player.discovered = null; }],
    ['unknown skill', (r) => { r.player.skills.as1 = 1; }],
    ['unknown item', (r) => { r.player.items.fake = 1; }],
    ['bad daily dungeons', (r) => { r.player.daily.dungeons = []; }],
    ['bad daily day', (r) => { r.player.daily.day = 1; }],
    ['bad bounty', (r) => { r.player.bounty = {}; }],
    ['invalid path', (r) => { r.player.path = 'evil'; }],
  );
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    for (const field of ['attrs', 'items', 'skills', 'daily.dungeons']) entries.push([`${field}.${key}`, (r) => {
      const target = field === 'daily.dungeons' ? r.player.daily.dungeons : r.player[field];
      Object.defineProperty(target, key, { value: 1, enumerable: true });
    }]);
  }
  invalidSaves(entries);
}
function testIllegalNumericSaveValues() {
  const entries = [];
  const scalars = ['lv', 'exp', 'sp', 'gold', 'points', 'hp', 'mp', 'chi', 'cult', 'expBoost', 'mainIndex', 'mainProgress', 'bountyProgress'];
  for (const field of scalars) {
    for (const value of [-1, NaN, Infinity, -Infinity, '1', null, 1e12 + 1]) entries.push([`${field}=${String(value)}`, (r) => { r.player[field] = value; }]);
  }
  entries.push(
    ['level zero', (r) => { r.player.lv = 0; }],
    ['level 106', (r) => { r.player.lv = 106; }],
    ['fractional level', (r) => { r.player.lv = 20.5; }],
    ['cult overflow', (r) => { r.player.cult = CULTIVATION.length; }],
    ['fractional cult', (r) => { r.player.cult = 1.5; }],
    ['chi overflow', (r) => { r.player.chi = 301; }],
    ['mainIndex overflow', (r) => { r.player.mainIndex = buildMainline(r.player.race).length + 1; }],
    ['skill zero', (r) => { r.player.skills.wz1 = 0; }],
    ['skill eleven', (r) => { r.player.skills.wz1 = 11; }],
    ['fractional skill', (r) => { r.player.skills.wz1 = 1.5; }],
    ['fractional item', (r) => { r.player.items.hp1 = 0.5; }],
    ['negative item', (r) => { r.player.items.hp1 = -1; }],
    ['item overflow', (r) => { r.player.items.hp1 = 1e7 + 1; }],
    ['attribute overflow', (r) => { r.player.attrs.mag = 100001; }],
    ['negative attribute', (r) => { r.player.attrs.mag = -1; }],
    ['negative kill stat', (r) => { r.player.kills.test = -1; }],
    ['nonfinite clear stat', (r) => { r.player.clears.d15 = Infinity; }],
    ['string total stat', (r) => { r.player.totals.deaths = '1'; }],
    ['negative dungeon count', (r) => { r.player.daily.dungeons.d15 = -1; }],
    ['daily bounties NaN', (r) => { r.player.daily.bounties = NaN; }],
    ['negative equipment price', (r) => { r.player.equipment.weapon.price = -1; }],
    ['bad equip level', (r) => { r.player.equipment.weapon.lv = 106; }],
    ['fractional equip quality', (r) => { r.player.equipment.weapon.q = 1.5; }],
    ['refine overflow', (r) => { r.player.equipment.weapon.refine = REFINE_MAX + 1; }],
    ['negative addon', (r) => { r.player.equipment.weapon.addons.crit = -0.1; }],
    ['nonfinite base', (r) => { r.player.equipment.weapon.base.matk = NaN; }],
  );
  invalidSaves(entries);
  // JSON overflow survives parsing as Infinity and must still be rejected.
  const raw = JSON.parse(fixture().export());
  raw.player.gold = 'overflow-marker';
  const overflow = JSON.stringify(raw).replace('"overflow-marker"', '1e309');
  assert.throws(() => validateSave(JSON.parse(overflow)));
}
function testSaveBooleanStructureBoundaries() {
  invalidSaves([
    ['daily.signed string', (r) => { r.player.daily.signed = 'false'; }],
    ['daily.signed missing', (r) => { delete r.player.daily.signed; }],
    ['trialReady object', (r) => { r.player.trialReady = {}; }],
    ['trialReady missing', (r) => { delete r.player.trialReady; }],
    ['flight string', (r) => { r.player.flight = 'yes'; }],
  ]);
}
function testSaveDiscreteCounterBoundaries() {
  invalidSaves([
    ['fractional points', (r) => { r.player.points = 0.5; }],
    ['fractional quest progress', (r) => { r.player.mainProgress = 0.5; }],
    ['fractional bounty progress', (r) => { r.player.bountyProgress = 0.5; }],
    ['fractional daily bounties', (r) => { r.player.daily.bounties = 0.5; }],
    ['fractional daily dungeon entries', (r) => { r.player.daily.dungeons.d15 = 0.5; }],
    ['nonfinite arena count', (r) => { r.player.daily.arena = Infinity; }],
    ['fractional bounty goal', (r) => { r.player.bounty = makeBounty(r.player.lv); r.player.bounty.goal.count = 1.5; }],
  ]);
}
function testBattleSnapshotStructureBoundaries() {
  const entries = [
    ['missing battle', (r) => { delete r.battle; }],
    ['unknown context', (r) => { r.battle.context.type = 'fixture'; }],
    ['city field context', (r) => { r.battle.context.zone = 'wanliu'; }],
    ['active field/location mismatch', (r) => { r.player.location = 'e_f1'; }],
    ['duplicate monster ID', (r) => { r.battle.monsters.push(structuredClone(r.battle.monsters[0])); }],
    ['monster HP overflow', (r) => { r.battle.monsters[0].hp = r.battle.monsters[0].maxHp + 1; }],
    ['fractional round', (r) => { r.battle.round = 0.5; }],
    ['fractional cooldown', (r) => { r.battle.cooldowns.wz3 = 0.5; }],
    ['unknown cooldown skill', (r) => { r.battle.cooldowns.fake = 1; }],
    ['nonboolean stealth', (r) => { r.battle.stealth = 'false'; }],
    ['missing journal time in v2', (r) => { delete r.journal[0].time; }],
  ];
  invalidSaves(entries.map(([name, mutate]) => [name, (r) => {
    r.player.location = 'h_f1';
    r.battle = createBattle(r.player, [makeMonster('结构验证靶', 100)], { type: 'field', zone: 'h_f1' });
    mutate(r);
  }]));
}
function testBattleSnapshotExtendedNumericAttributes() {
  const keys = ['accuracy', 'dodge', 'crit', 'critDamage', 'attackLevel', 'defenseLevel',
    'penetrationP', 'penetrationM', 'metalRes', 'woodRes', 'waterRes', 'fireRes', 'earthRes'];
  // Version 2 persists these live combat inputs. Strings/null are not numerical
  // values: accepting them makes arithmetic depend on coercion after loading.
  invalidSaves(keys.flatMap((key) => ['1', null, Infinity].map((value) => [`monster.${key}=${typeof value}:${String(value)}`, (r) => {
    r.player.location = 'h_f1';
    r.battle = createBattle(r.player, [makeMonster('战斗属性验证靶', 100)], { type: 'field', zone: 'h_f1' });
    r.battle.monsters[0][key] = value;
  }])));
}
function testBattleInputIsolationAndTargetIDs() {
  const p = fixture().p;
  const inputs = [enemy({ id: 'external', hp: 123 }), enemy({ id: 'external', hp: 456 }), enemy({ id: 'm1', hp: 789 })];
  const context = { type: 'fixture', nested: { safe: true } };
  const before = structuredClone({ inputs, context });
  const b = createBattle(p, inputs, context);
  assert.equal(b.monsters[0].id, 'external');
  assert.equal(new Set(b.monsters.map((m) => m.id)).size, 3);
  b.monsters[0].statuses.push({ kind: 'stun', turns: 1 });
  b.context.nested.safe = false;
  withRandom(0.5, () => combat(p, b, 'attack', b.monsters[1].id));
  assert.equal(b.monsters[0].hp, 123);
  assert.ok(b.monsters[1].hp < 456);
  assert.deepEqual({ inputs, context }, before);
  const clampBattle = createBattle(p, [enemy({ hp: 200, maxHp: 100 }), enemy({ hp: -1 })]);
  assert.equal(clampBattle.monsters[0].hp, 100);
  assert.equal(clampBattle.monsters[1].hp, 0);
}
function testRejectedCombatActionsDoNotTick() {
  const cooldownSkill = findSkill('wizard', 'wz4');
  // Initialized eligible caster, not an unlearned Lv.20 skill hiding the cooldown rejection.
  const p = fixture('wizard', skillReq(cooldownSkill, 1).level, { cult: cooldownSkill.cult }).p;
  p.skills.wz4 = 1;
  const b = createBattle(p, [enemy()], { noEscape: true });
  assert.equal(canUseSkill(p, b, 'wz4'), null);
  p.mp = 0;
  b.buffs.push({ id: 'fixture-buff', name: '边界护体', values: { def: 0.1 }, turns: 2 });
  b.cooldowns.wz4 = 2;
  b.monsters[0].statuses.push({ kind: 'dot', source: 'fixture-dot', name: '边界毒', turns: 1, attack: 10, type: 'magic' });
  rejectedTurn(p, b, 'skill:wz1', undefined, /真气不足/);
  rejectedTurn(p, b, 'skill:wz4', undefined, /冷却/);
  rejectedTurn(p, b, 'skill:as1', undefined, /本职业/);
  rejectedTurn(p, b, 'attack', 'missing', /目标/);
  rejectedTurn(p, b, 'invalid', undefined, /无效/);
  rejectedTurn(p, b, 'escape', undefined, /不能逃跑/);
  rejectedTurn(p, b, 'item:unknown', undefined, /不能/);
  rejectedTurn(p, b, 'item:town', undefined, /不能/);
  p.items.hp1 = 0;
  p.hp = 1;
  rejectedTurn(p, b, 'item:hp1', undefined, /没有足够/);
  p.items.hp1 = Infinity;
  rejectedTurn(p, b, 'item:hp1', undefined, /没有足够/);
  p.items.hp1 = 1;
  p.hp = stats(p, b).hp;
  rejectedTurn(p, b, 'item:hp1', undefined, /已满/);
  p.lv = 14;
  p.hp = 1;
  p.items.hp2 = 1;
  rejectedTurn(p, b, 'item:hp2', undefined, /15级/);
  p.lv = 15;
  p.hp = stats(p, b).hp - 1;
  b.monsters[0].statuses.push({ kind: 'stun', turns: 1 });
  withRandom(0.5, () => combat(p, b, 'item:hp2'));
  assert.equal(p.hp, stats(p, b).hp);
  assert.equal(p.items.hp2, 0);
  assert.equal(b.round, 1);
  assert.equal(b.cooldowns.wz4, 1);
  assert.equal(b.monsters[0].statuses.some((x) => x.kind === 'dot'), false);
  const locked = fixture('wizard', 100, { cult: 5 }).p;
  locked.skills.wz7 = 1;
  const lockedBattle = createBattle(locked, [enemy()]);
  rejectedTurn(locked, lockedBattle, 'skill:wz7', undefined, /修为不足/);
  locked.cult = 6;
  locked.chi = 299;
  rejectedTurn(locked, lockedBattle, 'skill:wz7', undefined, /元气不足/);
  const low = fixture('wizard', cooldownSkill.lv, { cult: cooldownSkill.cult }).p;
  low.skills.wz4 = 1;
  // Deliberately lower an initialized learned caster to isolate the level rejection.
  low.lv = cooldownSkill.lv - 1;
  const lowBattle = createBattle(low, [enemy()]);
  rejectedTurn(low, lowBattle, 'skill:wz4', undefined, new RegExp(`${cooldownSkill.lv}级`));
  delete low.skills.wz4;
  rejectedTurn(low, lowBattle, 'skill:wz4', undefined, /尚未学习/);
  const cleric = fixture('cleric', 60).p;
  rejectedTurn(cleric, createBattle(cleric, [enemy()]), 'skill:cl7', undefined, /被动/);
}
function testBuffDurationAndShield() {
  const p = fixture('blademaster', 20).p;
  const b = createBattle(p, [enemy()]);
  const baseline = stats(p).def;
  withRandom(0.5, () => {
    combat(p, b, 'skill:bm4');
    assert.equal(b.buffs[0].turns, 4);
    assert.ok(stats(p, b).def > baseline);
    const cooldown = Math.max(1, Math.round(findSkill(p.cls, 'bm4').cd * (1 - stats(p, b).channel)));
    assert.equal(b.cooldowns.bm4, cooldown, 'channel-adjusted new cooldown must not tick on cast turn');
    for (const turns of [3, 2, 1]) {
      combat(p, b, 'defend');
      assert.equal(b.buffs[0].turns, turns);
      assert.ok(stats(p, b).def > baseline);
    }
    combat(p, b, 'defend');
    assert.deepEqual(b.buffs, []);
    assert.equal(stats(p, b).def, baseline);
    assert.equal(b.cooldowns.bm4, Math.max(0, cooldown - 4));
  });
  const mage = fixture('wizard', 20).p;
  const armorBattle = createBattle(mage, [enemy({ statuses: [{ kind: 'stun', turns: 20 }] })]);
  const armorBaseline = stats(mage);
  const factor = 0.1 * mage.skills.wz3;
  withRandom(0.5, () => {
    combat(mage, armorBattle, 'skill:wz3');
    assert.equal(armorBattle.shield, 0, 'stone armor must not absorb damage');
    assert.deepEqual(armorBattle.buffs[0].values, { equipmentDefPct: factor, equipmentEarthDefPct: factor });
    assert.equal(stats(mage, armorBattle).def, Math.round(armorBaseline.def + armorBaseline.equipmentDef * factor));
    assert.equal(stats(mage, armorBattle).earthDef, Math.round(armorBaseline.earthDef + armorBaseline.equipmentEarthDef * factor));
    for (const turns of [4, 3, 2, 1]) {
      combat(mage, armorBattle, 'defend');
      assert.equal(armorBattle.buffs[0].turns, turns);
    }
    combat(mage, armorBattle, 'defend');
    assert.deepEqual(armorBattle.buffs, []);
    assert.equal(stats(mage, armorBattle).def, armorBaseline.def);
  });
  const legacyMage = fixture('wizard', 20).p;
  const shieldBattle = createBattle(legacyMage, [enemy({ atk: 200 })]);
  const shieldMax = Math.round(stats(legacyMage).mag * 2);
  shieldBattle.buffs.push({ id: 'wz3', name: '磐石护甲', values: { shield: 2 }, turns: 5, shield: shieldMax });
  shieldBattle.shield = shieldMax;
  const hp = legacyMage.hp;
  withRandom(0.5, () => {
    combat(legacyMage, shieldBattle, 'defend');
    assert.ok(shieldBattle.shield > 0 && shieldBattle.shield < shieldMax);
    assert.equal(legacyMage.hp, hp, 'legacy shield must still absorb damage');
    for (let i = 0; i < 4; i++) combat(legacyMage, shieldBattle, 'defend');
    assert.equal(shieldBattle.shield, 0, 'expired legacy shield retained absorption');
    assert.deepEqual(shieldBattle.buffs, []);
    assert.ok(legacyMage.hp < hp, 'expired legacy shield still protected player');
  });
}
function testHotAndRegenLastTickAndClamp() {
  const cleric = fixture('cleric', 40).p;
  cleric.skills.cl5 = 1;
  const b = createBattle(cleric, [enemy({ statuses: [{ kind: 'stun', turns: 20 }] })]);
  const maxHp = stats(cleric).hp;
  cleric.hp = 1;
  const skill = findSkill('cleric', 'cl5');
  withRandom(0.5, () => {
    combat(cleric, b, 'skill:cl5');
    assert.equal(cleric.hp, Math.min(maxHp, 1 + Math.round(stats(cleric).matk * skill.mult) + stats(cleric, b).hpRegen), 'cast turn permits immediate heal plus natural regen, but no HOT tick');
    for (let i = 0; i < skill.hot[1]; i++) {
      const before = cleric.hp;
      combat(cleric, b, 'defend');
      assert.equal(cleric.hp, Math.min(maxHp, before + Math.round(maxHp * skill.hot[0]) + stats(cleric, b).hpRegen), 'each HOT tick includes separate end-round natural regen');
    }
    assert.equal(b.buffs.length, 0, 'HOT final tick missing or duration too long');
    const hp = cleric.hp;
    combat(cleric, b, 'defend');
    assert.equal(cleric.hp, Math.min(maxHp, hp + stats(cleric, b).hpRegen), 'after HOT expiry only natural regen may heal');
  });
  const barb = fixture('barbarian', 100).p;
  barb.hp = Math.floor(stats(barb).hp * 0.5);
  const regenBattle = createBattle(barb, [enemy({ statuses: [{ kind: 'stun', turns: 20 }] })]);
  const hp = barb.hp;
  combat(barb, regenBattle, 'skill:bb7');
  assert.equal(barb.hp, Math.min(stats(barb, regenBattle).hp, hp + stats(barb, regenBattle).hpRegen), 'cast turn allows natural regen, but no percentage regen tick');
  for (let i = 0; i < 4; i++) {
    const before = barb.hp;
    combat(barb, regenBattle, 'defend');
    assert.equal(barb.hp, Math.min(stats(barb).hp, before + Math.round(stats(barb).hp * 0.1) + stats(barb, regenBattle).hpRegen));
  }
  assert.equal(regenBattle.buffs.length, 0);
  const after = barb.hp;
  combat(barb, regenBattle, 'defend');
  assert.equal(barb.hp, Math.min(stats(barb).hp, after + stats(barb, regenBattle).hpRegen), 'after percentage regen expiry only natural regen may heal');
  const nearFull = fixture('cleric', 40).p;
  nearFull.hp = stats(nearFull).hp - 1;
  const capBattle = createBattle(nearFull, [enemy({ statuses: [{ kind: 'stun', turns: 20 }] })]);
  combat(nearFull, capBattle, 'skill:cl5');
  combat(nearFull, capBattle, 'defend');
  assert.equal(nearFull.hp, stats(nearFull).hp, 'healing exceeded maximum HP');
}
function testDotDurationRefreshAndRetarget() {
  const p = fixture('venomancer', 20).p;
  p.skills.vm1 = 1;
  const b = createBattle(p, [enemy({ statuses: [{ kind: 'stun', turns: 20 }] })]);
  withRandom(0.5, () => {
    combat(p, b, 'skill:vm1');
    const m = b.monsters[0];
    const dot = m.statuses.find((x) => x.kind === 'dot');
    assert.equal(dot.turns, 2);
    const tick = expectedDamage(dot.attack, dot.attacker || {}, m, dot.type, dot.elem); // Includes snapshotted attack level, penetration and elemental resistance.
    const before = m.hp;
    rejectedTurn(p, b, 'attack', 'missing');
    combat(p, b, 'defend');
    assert.equal(m.hp, before - tick);
    assert.equal(m.statuses.find((x) => x.kind === 'dot').turns, 1);
    combat(p, b, 'defend');
    assert.equal(m.hp, before - tick * 2);
    assert.equal(m.statuses.some((x) => x.kind === 'dot'), false);
    combat(p, b, 'defend');
    assert.equal(m.hp, before - tick * 2, 'DOT jumped after expiration');
    combat(p, b, 'skill:vm1');
    combat(p, b, 'skill:vm1');
    assert.equal(m.statuses.filter((x) => x.kind === 'dot' && x.source === 'vm1').length, 1);
    assert.equal(m.statuses.find((x) => x.source === 'vm1').turns, 2);
    combat(p, b, 'skill:vm4');
    combat(p, b, 'skill:vm1');
    assert.deepEqual(m.statuses.filter((x) => x.kind === 'dot').map((x) => x.source).sort(), ['vm1', 'vm4']);
  });
  const victim = enemy({ id: 'dying', hp: 1, statuses: [{ kind: 'dot', source: 'vm1', name: '毒', turns: 1, attack: 100, type: 'magic' }] });
  const final = createBattle(p, [victim]);
  p.mp = 100;
  assert.equal(combat(p, final, 'defend'), 'win');
  assert.equal(p.mp, Math.min(stats(p, final).mp, 100 + stats(p, final).mpRegen), 'terminal DOT turn allows natural MP regen but must not execute defend recovery');
  assert.equal(final.logs.some((l) => l.text.includes('凝神防御')), false, 'selected action occurred after final DOT killed the last target');
  assert.equal(final.monsters[0].hp, 0);
  const retarget = createBattle(p, [victim, enemy({ id: 'survivor' })]);
  withRandom(0.5, () => combat(p, retarget, 'attack', 'dying'));
  assert.equal(retarget.monsters[0].hp, 0);
  assert.ok(retarget.monsters[1].hp < retarget.monsters[1].maxHp, 'DOT-killed target was not retargeted');
  rejectedTurn(p, retarget, 'attack', 'dying', /目标/);
}
function testStunActionOpportunitiesAndChanceBoundary() {
  const stunSkill = findSkill('blademaster', 'bm2');
  const stunLevel = skillReq(stunSkill, 1).level;
  for (const [roll, stuns] of [[0.499999, true], [0.5, false]]) {
    const p = fixture('blademaster', stunLevel, { cult: stunSkill.cult }).p;
    p.skills.bm2 = 1;
    const b = createBattle(p, [enemy({ atk: 200 })]);
    assert.equal(canUseSkill(p, b, 'bm2'), null);
    const hp = p.hp;
    withRandom(roll, () => combat(p, b, 'skill:bm2'));
    assert.equal(b.logs.some((x) => x.text.includes('被眩晕，无法行动')), stuns);
    assert.equal(b.monsters[0].statuses.some((x) => x.kind === 'stun'), false);
    if (stuns) assert.equal(p.hp, hp, 'one-turn stun did not block the cast-turn attack');
    else assert.ok(p.hp < hp);
    const before = p.hp;
    withRandom(0.5, () => combat(p, b, 'defend'));
    assert.ok(p.hp < before, 'one-turn stun blocked a second action');
  }
  const p = fixture('psychic', 60).p;
  const b = createBattle(p, [enemy({ atk: 200 })]);
  const hp = p.hp;
  withRandom(0.5, () => {
    combat(p, b, 'skill:ps6');
    assert.equal(p.hp, hp);
    assert.equal(b.monsters[0].statuses.find((x) => x.kind === 'stun').turns, 1);
    combat(p, b, 'defend');
    assert.equal(p.hp, hp, 'two-turn stun lost its last action block');
    assert.equal(b.monsters[0].statuses.some((x) => x.kind === 'stun'), false);
    combat(p, b, 'defend');
    assert.ok(p.hp < hp);
  });
  const bm = fixture('blademaster', stunLevel, { cult: stunSkill.cult }).p;
  bm.skills.bm2 = 1;
  const refresh = createBattle(bm, [enemy({ statuses: [{ kind: 'stun', source: 'ps6', turns: 2 }] })]);
  assert.equal(canUseSkill(bm, refresh, 'bm2'), null);
  withRandom(0.1, () => combat(bm, refresh, 'skill:bm2'));
  const statuses = refresh.monsters[0].statuses.filter((x) => x.kind === 'stun');
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0].turns, 1, 'shorter stun overwrote a longer remaining stun');
}
function testTransformDoesNotHealByToggling() {
  const p = fixture('barbarian', 20).p;
  const b = createBattle(p, [enemy({ statuses: [{ kind: 'stun', turns: 10 }] })]);
  const baseAttrs = structuredClone(p.attrs);
  const maxHp = stats(p).hp;
  p.hp = Math.floor(maxHp * 0.4);
  const hp = p.hp;
  const regen = stats(p, b).hpRegen;
  combat(p, b, 'skill:bb2');
  assert.equal(b.buffs[0].turns, null);
  const tigerMaxHp = stats(p, b).hp;
  const tigerHpBeforeRegen = Math.floor(hp * tigerMaxHp / maxHp);
  assert.equal(p.hp, Math.min(tigerMaxHp, tigerHpBeforeRegen + regen), 'transform preserves wounded ratio, then natural regen applies');
  const tigerHp = p.hp;
  combat(p, b, 'skill:bb2');
  assert.equal(b.buffs.length, 0);
  assert.equal(p.hp, Math.min(maxHp, Math.floor(tigerHp * maxHp / tigerMaxHp) + regen), 'untransform must not heal beyond ratio preservation and natural regen');
  assert.ok(p.hp <= hp + regen * 2, 'transform toggle generated health beyond the two normal regen ticks');
  assert.deepEqual(p.attrs, baseAttrs);
}
function testPetDuplicateSummonAndHealing() {
  for (const [cls, summon, ultimate] of [['venomancer', 'vm2', 'vm7'], ['mystic', 'my2', 'my7']]) {
    const p = fixture(cls, 100).p;
    const b = createBattle(p, [enemy({ statuses: [{ kind: 'stun', turns: 20 }] })]);
    combat(p, b, `skill:${summon}`);
    assert.ok(b.pet.hp > 0);
    const pet = structuredClone(b.pet);
    assert.match(canUseSkill(p, b, summon), /不能重复召唤/);
    assert.match(canUseSkill(p, b, ultimate), /不能重复召唤/);
    rejectedTurn(p, b, `skill:${summon}`, undefined, /不能重复召唤/);
    rejectedTurn(p, b, `skill:${ultimate}`, undefined, /不能重复召唤/);
    assert.deepEqual(b.pet, pet);
    if (cls === 'venomancer') {
      rejectedTurn(p, b, 'skill:vm3', undefined, /宠物生命已满/);
      b.pet.hp = Math.floor(b.pet.maxHp * 0.9);
      combat(p, b, 'skill:vm3');
      assert.equal(b.pet.hp, b.pet.maxHp, 'pet healing must clamp at maximum HP');
    }
    b.pet.hp = 0;
    if (cls === 'venomancer') rejectedTurn(p, b, 'skill:vm3', undefined, /没有存活/);
    assert.equal(canUseSkill(p, b, ultimate), null);
    combat(p, b, `skill:${ultimate}`);
    assert.equal(b.pet.name, findSkill(cls, ultimate).pet.name);
    assert.equal(b.pet.hp, Math.round(stats(p, b).hp * findSkill(cls, ultimate).pet.hp));
  }
}
function testSpeedRealCombosAndSkillHits() {
  cases([[1, 0.5, 1], [2, 0.5, 2], [3, 0.5, 3], [1.25, 0.249999, 2], [1.25, 0.25, 1], [10, 0.5, 3]]
    .map(([speed, roll, hits]) => [`speed=${speed}, roll=${roll}`, () => {
      const p = fixture('blademaster', 20, { quality: 0, chi: 0 }).p;
      p.equipment.weapon = legacyStats(p.equipment.weapon);
      p.equipment.weapon.addons.speed = speed - 1;
      const b = createBattle(p, [enemy({ statuses: [{ kind: 'stun', turns: 10 }] })]);
      const st = stats(p, b);
      assert.equal(st.speed, Math.min(3, speed));
      let first = true;
      withRandom(() => {
        if (first && st.speed % 1) { first = false; return roll; }
        return 0.5;
      }, () => combat(p, b, 'attack'));
      assert.equal(b.monsters[0].maxHp - b.monsters[0].hp, expectedDamage(st.atk, st, b.monsters[0], 'phys') * hits, 'speed must produce real per-hit damage');
      assert.equal(p.chi, 10, 'basic combo grants chi once per action, not per hit');
      assert.equal(b.round, 1, 'combo must remain a single round');
    }]));
  for (const [id, hits] of [['bm1', 1], ['bm3', 3]]) {
    const s = findSkill('blademaster', id);
    const p = fixture('blademaster', Math.max(20, skillReq(s, 1).level), { quality: 0, cult: s.cult }).p;
    p.skills[id] = 1;
    const b = createBattle(p, [enemy({ statuses: [{ kind: 'stun', turns: 10 }] })]);
    assert.equal(canUseSkill(p, b, id), null, 'configured rank-one skill must be usable with its canonical class weapon');
    p.equipment.weapon = legacyStats(p.equipment.weapon);
    p.equipment.weapon.addons.speed = 2;
    const st = stats(p, b);
    withRandom(0.5, () => combat(p, b, `skill:${id}`));
    assert.equal(b.monsters[0].maxHp - b.monsters[0].hp, expectedDamage(st.atk * s.mult, st, b.monsters[0], 'phys') * hits, `${id}: speed must not multiply the skill's configured hits`);
  }
}
function testChannelCooldownBoundaries() {
  cases([0, 0.25, 0.75, 1].map((channel) => [`channel=${channel}`, () => {
    const p = fixture('blademaster', 20, { quality: 0 }).p;
    p.equipment.weapon = legacyStats(p.equipment.weapon);
    p.equipment.weapon.addons.channel = channel;
    const b = createBattle(p, [enemy({ statuses: [{ kind: 'stun', turns: 20 }] })]);
    assert.equal(stats(p, b).channel, Math.min(0.75, channel));
    const expected = Math.max(1, Math.round(6 * (1 - Math.min(0.75, channel))));
    assert.equal(skillCooldown(p, b, 'bm4'), expected);
    assert.equal(skillCooldown(p, b, 'bm1'), 0, 'zero-CD skills must remain zero-CD');
    withRandom(0.5, () => combat(p, b, 'skill:bm4'));
    assert.equal(b.cooldowns.bm4, expected, 'cast must not tick its new cooldown');
    rejectedTurn(p, b, 'skill:bm4', undefined, /冷却/);
    for (let remaining = expected - 1; remaining >= 0; remaining--) {
      combat(p, b, 'defend');
      assert.equal(b.cooldowns.bm4, remaining, 'accepted action ticks old cooldown once');
    }
    assert.equal(canUseSkill(p, b, 'bm4'), null);
  }]));
}
function testNaturalRecoveryAndTerminalRounds() {
  cases(['attack', 'defend', 'item:mp1', 'skill:bm1', 'win', 'escape', 'lose'].map((action) => [action, () => {
    const p = fixture('blademaster', 20, { quality: 0 }).p;
    p.equipment.body = legacyStats(p.equipment.body);
    p.equipment.body.addons = { hpRegen: 4, mpRegen: 6 };
    const st = stats(p);
    assert.equal(st.hpRegen, 5, 'base HP regen is one plus equipment regen');
    assert.equal(st.mpRegen, 7, 'base MP regen is one plus equipment regen');
    p.hp = 1;
    p.mp = 100;
    p.items.mp1 = 1;
    const m = action === 'lose' ? enemy({ atk: 1_000_000 })
      : enemy({ hp: action === 'win' ? 1 : 100_000, statuses: [{ kind: 'stun', turns: 10 }] });
    const b = createBattle(p, [m]);
    const choice = action === 'win' ? 'attack' : action === 'lose' ? 'defend' : action;
    const result = withRandom(action === 'escape' ? 0 : 0.5, () => combat(p, b, choice));
    assert.equal(result, ['win', 'escape', 'lose'].includes(action) ? action : null);
    assert.equal(p.hp, action === 'lose' ? 0 : 6, 'living terminal turns regen; dead players must not regen');
    const actionMp = choice === 'defend' ? Math.max(3, Math.round(st.mp * 0.04))
      : choice === 'item:mp1' ? ITEMS.mp1.value : choice === 'skill:bm1' ? -findSkill(p.cls, 'bm1').mp : 0;
    assert.equal(p.mp, Math.min(st.mp, 100 + actionMp + (action === 'lose' ? 0 : 7)));
    if (action === 'item:mp1') assert.equal(p.items.mp1, 0);
  }]));
  const p = fixture('blademaster', 20, { quality: 0 }).p;
  p.hp--;
  p.mp--;
  const b = createBattle(p, [enemy({ statuses: [{ kind: 'stun', turns: 10 }] })]);
  combat(p, b, 'attack');
  assert.equal(p.hp, stats(p).hp);
  assert.equal(p.mp, stats(p).mp, 'natural recovery must clamp both resources');
}
function testAccuracyHitBoundary() {
  cases([[0, false], [0, true], [1, false], [1, true]]
    .map(([accuracy, lands]) => [`accuracy addon=${accuracy}, lands=${lands}`, () => {
      const p = fixture('blademaster', 20, { quality: 0 }).p;
      p.equipment.weapon = legacyStats(p.equipment.weapon);
      p.equipment.weapon.addons.accuracy = accuracy;
      const b = createBattle(p, [enemy({ dodge: 0.5, statuses: [{ kind: 'stun', turns: 10 }] })]);
      const st = stats(p, b);
      assert.equal(st.accuracyRating, st.dex * CLASSES.blademaster.accuracyDex);
      assert.equal(st.accuracy, 1 + st.accuracyRating * 0.0001 + accuracy);
      const mathematicalThreshold = b.monsters[0].dodge / st.accuracy;
      const threshold = 1 - (1 - mathematicalThreshold);
      assert.ok(Math.abs(threshold - mathematicalThreshold) <= Number.EPSILON);
      const roll = lands ? threshold : threshold - 0.000001;
      let first = true;
      withRandom(() => { if (first) { first = false; return roll; } return 0.5; }, () => combat(p, b, 'attack'));
      assert.equal(b.monsters[0].maxHp - b.monsters[0].hp, lands ? expectedDamage(st.atk, st, b.monsters[0], 'phys') : 0, 'miss threshold is evasion / accuracy, with equality landing');
      assert.equal(b.logs.some((l) => l.text.includes('闪避了普通攻击')), !lands);
    }]));
}
function testDamageLevelsPenetrationAndElements() {
  cases([
    ['physical positive level gap', 'blademaster', { attackLevel: 30, penetrationP: 0.5 }, { defenseLevel: 20 }],
    ['physical negative level gap', 'blademaster', {}, { defenseLevel: 40 }],
    ['magic penetration and fire resistance', 'wizard', { attackLevel: 30, penetrationM: 0.5 }, { defenseLevel: 20, fireRes: 0.4 }],
    ['physical ignores magic penetration and fire resistance', 'blademaster', { penetrationM: 0.5 }, { fireRes: 0.4 }],
  ].map(([name, cls, addons, overrides]) => [name, () => {
    const p = fixture(cls, 20, { quality: 0 }).p;
    p.equipment.weapon = legacyStats(p.equipment.weapon);
    p.equipment.weapon.addons = addons;
    const s = findSkill(cls, cls === 'wizard' ? 'wz1' : 'bm1');
    p.skills[s.id] = 1;
    const b = createBattle(p, [enemy({ def: 200, mdef: 200, statuses: [{ kind: 'stun', turns: 10 }], ...overrides })]);
    const st = stats(p, b);
    withRandom(0.5, () => combat(p, b, `skill:${s.id}`));
    assert.equal(b.monsters[0].maxHp - b.monsters[0].hp, expectedDamage(st.atk * s.mult, st, b.monsters[0], CLASSES[cls].atkType, s.elem));
  }]));
}
function testEnemyDamageAttributesAndCrit() {
  cases(['phys', 'magic'].map((type) => [type, () => {
    const p = fixture('blademaster', 20, { quality: 0 }).p;
    p.equipment.body = legacyStats(p.equipment.body);
    p.equipment.body.addons = { defenseLevel: 20, fireRes: 0.4 };
    const b = createBattle(p, [enemy({ atk: 400, def: 200, mdef: 200, type, elem: 'fire', attackLevel: 30,
      penetrationP: 0.5, penetrationM: 0.5, crit: 0.75, critDamage: 3 })]);
    const st = stats(p, b);
    const hp = p.hp;
    const damage = expectedDamage(400 * 3, b.monsters[0], st, type, type === 'magic' ? 'fire' : null);
    withRandom(0.5, () => combat(p, b, 'attack'));
    assert.equal(p.hp, hp - damage + st.hpRegen, 'enemy crit, level, penetration and matching element must affect real damage');
    assert.ok(b.logs.some((l) => l.text.includes('对你造成') && l.text.includes('暴击')));
  }]));
}
function testCharmsThresholdsConsumptionAndRejection() {
  cases([
    ['hp', 0, 30], ['hp', 1, 30], ['mp', 0, 30], ['mp', 1, 30], ['hp', 0, 100_000], ['mp', 0, 100_000],
  ].map(([type, above, charge]) => [`${type}, above=${above}, charge=${charge}`, () => {
    const p = fixture('blademaster', 20, { quality: 0 }).p;
    const st = stats(p);
    const initial = Math.floor(st[type] * (type === 'hp' ? 0.5 : 0.75)) + above;
    p[type] = initial;
    p.charms[type] = charge;
    const b = createBattle(p, [enemy({ statuses: [{ kind: 'stun', turns: 10 }] })]);
    const consumed = above ? 0 : Math.min(st[type] - initial, charge);
    withRandom(0.5, () => combat(p, b, 'attack'));
    assert.equal(p.charms[type], charge - consumed, 'charm consumes only actual restoration at or below its threshold');
    assert.equal(p[type], Math.min(st[type], initial + consumed + st[type === 'hp' ? 'hpRegen' : 'mpRegen']));
    assert.equal(b.logs.filter((l) => l.text.includes('护符恢复')).length, consumed ? 1 : 0);
  }]));
  const p = fixture('blademaster', 20, { quality: 0 }).p;
  p.hp = 1;
  p.mp = 0;
  p.charms = { hp: 100_000, mp: 100_000 };
  const b = createBattle(p, [enemy()]);
  rejectedTurn(p, b, 'skill:bm1', undefined, /真气不足/);
  rejectedTurn(p, b, 'attack', 'missing', /目标/);
  p.hp = 0;
  const charge = structuredClone(p.charms);
  assert.equal(combat(p, b, 'defend'), 'lose');
  assert.equal(p.hp, 0, 'charms cannot resurrect a dead player');
  assert.deepEqual(p.charms, charge);
  const before = mechanicsSnapshot(p, b);
  assert.equal(combat(p, b, 'attack'), 'lose');
  assert.deepEqual(mechanicsSnapshot(p, b), before, 'terminal battle must not spend charms');
}
function testBattleSnapshotCombatMechanisms() {
  cases([
    ['wizard', ['wz3']], ['cleric', ['cl5']], ['barbarian', ['bb2']], ['assassin', ['as2']],
    ['venomancer', ['vm2', 'vm5', 'vm4']], ['blademaster', ['bm4', 'bm2']],
  ].map(([cls, skills]) => [cls, () => {
    const g = fixture(cls, 60, { quality: 0 });
    g.p.location = 'h_f1';
    if (cls === 'cleric') g.p.hp = 1;
    g.state.battle = createBattle(g.p, [makeMonster('真实快照靶', 60, 'boss')], { type: 'field', zone: 'h_f1' });
    withRandom(0.5, () => { for (const id of skills) manual(g, `skill:${id}`); });
    assert.ok(g.busy, 'snapshot fixture must remain active');
    assert.ok(g.battle.buffs.length > 0 || g.battle.stealth);
    if (cls !== 'barbarian') assert.ok(Object.values(g.battle.cooldowns).some((cd) => cd > 0));
    else assert.deepEqual(g.battle.cooldowns, {}, 'zero-CD transform must not create a cooldown');
    if (cls === 'wizard') {
      assert.equal(g.battle.shield, 0);
      assert.deepEqual(g.battle.buffs[0].values, {
        equipmentDefPct: 0.1 * g.p.skills.wz3,
        equipmentEarthDefPct: 0.1 * g.p.skills.wz3,
      });
    }
    if (cls === 'cleric') assert.ok(g.battle.buffs.some((b) => b.hot));
    if (cls === 'barbarian') assert.equal(g.battle.buffs[0].turns, null);
    if (cls === 'venomancer') {
      assert.ok(g.battle.pet?.hp > 0);
      assert.ok(g.battle.monsters[0].statuses.some((s) => s.kind === 'dot'));
    }
    const before = structuredClone(g.state);
    const loaded = new Game(validateSave(JSON.parse(g.export())));
    assert.deepEqual(loaded.state, before, 'schema must preserve real buffs, shields, HOT, DOT, pets, stealth and cooldowns');
    withRandom(0.5, () => manual(g, 'defend'));
    withRandom(0.5, () => manual(loaded, 'defend'));
    assert.deepEqual(loaded.state, g.state, 'resumed battle must produce identical next-turn results');
  }]));
  const legacy = fixture('wizard', 60, { quality: 0 });
  legacy.p.location = 'h_f1';
  legacy.state.battle = createBattle(legacy.p, [makeMonster('旧护盾快照靶', 60, 'boss')], { type: 'field', zone: 'h_f1' });
  const shield = Math.round(stats(legacy.p).mag * 2);
  legacy.battle.buffs.push({ id: 'wz3', name: '磐石护甲', values: { shield: 2 }, turns: 5, shield });
  legacy.battle.shield = shield;
  const loaded = new Game(validateSave(JSON.parse(legacy.export())));
  assert.deepEqual(loaded.state, legacy.state, 'valid legacy absorption shield must survive schema roundtrip unchanged');
  withRandom(0.5, () => manual(legacy, 'defend'));
  withRandom(0.5, () => manual(loaded, 'defend'));
  assert.ok(loaded.battle.shield > 0 && loaded.battle.shield < shield);
  assert.deepEqual(loaded.state, legacy.state, 'legacy shield must resume with identical absorption and duration');
}
function testAutomaticConfiguration(cls, lv, profile, encounter) {
  const provisioned = profile === 'provisioned';
  const g = fixture(cls, lv, provisioned
    ? { quality: 2, potions: 8 }
    : { gear: 'starter', quality: 0, skills: 'basic', cult: 0, chi: 0, potions: 0 });
  const monsters = encounter === 'phys'
    ? [makeMonster('同级物理配置靶', lv)]
    : encounter === 'mixed'
      ? [makeMonster('同级物理双靶', lv, '', 'phys', 0), makeMonster('同级法术双靶', lv, '', 'magic', 1)]
      : [makeMonster('同级法术首领配置靶', lv, 'boss', 'magic')];
  g.state.battle = createBattle(g.p, monsters, { type: 'field', zone: g.p.location });
  // Convergence, not universal victory: an under-equipped/empty-bag fixture
  // losing is a legitimate terminal outcome. Never turn a timeout into a loss.
  runAuto(g, `${cls}/L${lv}/${profile}/${encounter}`);
}

function testExploreFirstTwoVictories() {
  for (const cls of Object.keys(CLASSES)) {
    const g = newGame(cls);
    const field = ZONES[g.p.location].links.find((id) => ZONES[id].type === 'field');
    unchanged(g, () => g.explore(), /城镇/);
    g.travel(field);
    for (let wins = 0; wins < 2; wins++) {
      assert.equal(g.p.totals.battles, wins);
      assert.equal(withRandom(0.97, () => g.explore()).kind, 'fight', cls);
      const m = g.battle.monsters[0];
      assert.equal(m.rank, '');
      assert.ok(m.lv <= g.p.lv, 'available gentle starter monster must not exceed player level');
      assert.equal(m.intent, 'attack');
      assert.equal(g.battle.context.ambush, undefined);
      unchanged(g, () => g.explore(), /当前战斗/);
      // Explicit wounded-monster reward fixture, not organic leveling evidence.
      m.hp = 1;
      withRandom(0.99, () => assert.equal(manual(g, 'attack'), 'win'));
    }
  }
  for (const [id, z] of Object.entries(ZONES).filter(([, z]) => z.type === 'field')) {
    const normal = z.mobs.filter((m) => !m[2]);
    for (const wins of [0, 1]) {
      const g = fixture('blademaster', normal[1][1]);
      g.p.location = id; g.p.mainIndex = g.quests.length; g.p.totals.battles = wins;
      withRandom(0.97, () => g.explore());
      assert.equal(g.battle.monsters[0].name, normal[1][0], `${id}: highest gentle normal monster`);
      assert.ok(g.battle.monsters[0].lv <= g.p.lv);
    }
  }
}
function testExploreOutcomesAndPending() {
  for (const [roll, kind] of [[0.1, 'fight'], [0.65, 'find'], [0.8, 'encounter'], [0.97, 'rare']]) {
    const g = fixture('blademaster', 20);
    g.p.location = 'h_f1'; g.p.totals.battles = 2;
    const before = structuredClone(g.p);
    const result = withRandom(roll, () => g.explore());
    assert.equal(result.kind, kind);
    assert.equal(result.text, g.message);
    assert.equal(g.p.totals.battles, 2, 'exploration alone is not a battle victory');
    assert.equal(g.busy, kind === 'fight');
    if (kind === 'fight') assert.equal(g.battle.monsters[0].intent, 'attack');
    if (kind === 'find') assert.equal(g.p.items.huanxian, before.items.huanxian + 1);
    if (kind === 'rare') assert.equal(g.p.expBoost, before.expBoost + 3);
    if (kind === 'encounter') {
      assert.ok(ENCOUNTER_IDS.includes(g.p.encounter.id));
      assert.equal(g.p.encounter.zone, g.p.location);
      unchanged(g, () => g.explore(), /奇遇/);
      unchanged(g, () => g.chooseEncounter('missing'), /选项/);
    } else assert.equal(g.p.encounter ?? null, null);
    validateSave(g.state);
  }
}
function testEncounterDefinitionCoverage() {
  assert.equal(ENCOUNTER_IDS.length, 8);
  assert.deepEqual(ENCOUNTER_IDS, Object.keys(ENCOUNTERS));
  for (const [id, def] of Object.entries(ENCOUNTERS)) {
    assert.ok(def.title && typeof def.text === 'function', id);
    assert.ok(def.text(ZONES.h_f1.name, '山贼头目').length > 0);
    assert.equal(new Set(def.choices.map((c) => c.id)).size, def.choices.length, 'unique encounter choices');
    assert.ok(def.choices.every((c) => c.id && c.label && typeof c.resolve === 'function'));
  }
}
function testEncounterChoices(id) {
  const base = fixture('blademaster', 20);
  base.p.location = 'h_f1'; base.p.hp = Math.floor(stats(base.p).hp / 2); base.p.mp = 1;
  base.p.items.hp1 = 2; base.p.items.hp2 = 2;
  base.p.encounter = { id, zone: 'h_f1', mob: id === 'beast' ? '山贼头目' : '小野猪' };
  const source = structuredClone(base.state);
  for (const choice of ENCOUNTERS[id].choices) for (const roll of [0.1, 0.9]) {
    const g = new Game(structuredClone(source)); const p = g.p; const st = stats(p);
    assert.equal(choice.require?.(p) ?? null, null, `${id}:${choice.id} fixture must enable choice`);
    const before = structuredClone(p); const xp = xpLedger(p);
    const expected = { gold: 0, sp: 0, exp: 0, boost: 0, hp: p.hp, mp: p.mp, items: {}, loot: 0, fight: null };
    const exp = (frac) => { expected.exp = Math.round(expNeed(p.lv) * frac); };
    switch (`${id}:${choice.id}`) {
      case 'merchant:help': expected.items.hp1 = -1; expected.gold = 80 + p.lv * 25; exp(0.3); break;
      case 'merchant:rob': if (roll < 0.5) expected.gold = 120 + p.lv * 40; else expected.fight = ['行商护卫', p.lv + 1, 'elite', 'attack']; break;
      case 'chest:open':
        if (roll < 0.65) { expected.gold = 40 + p.lv * 15; expected.items.huanxian = 1; expected.loot = 1; }
        else { expected.hp -= Math.min(p.hp - 1, Math.round(st.hp * 0.2)); expected.gold = 20 + p.lv * 5; }
        break;
      case 'chest:careful': expected.gold = 30 + p.lv * 10; expected.items.hp2 = 1; break;
      case 'spring:drink': expected.hp = st.hp; expected.mp = st.mp; break;
      case 'spring:bottle': expected.items = { hp2: 2, mp2: 2 }; break;
      case 'spring:meditate': expected.sp = 60 + p.lv * 20; exp(0.2); if (roll < 0.3) expected.fight = ['小野猪', 1, '', 'heavy']; break;
      case 'beast:ambush': expected.fight = ['山贼头目', 9, 'elite', 'exposed']; break;
      case 'beast:steal': if (roll < 0.6) { expected.items.huanxian = 2; expected.gold = 60 + p.lv * 20; } else expected.fight = ['山贼头目', 9, 'elite', 'heavy']; break;
      case 'beast:leave': exp(0.08); break;
      case 'stele:study': expected.sp = 100 + p.lv * 30; exp(0.15); break;
      case 'stele:rub': expected.gold = 80 + p.lv * 25; break;
      case 'child:escort': exp(0.35); expected.gold = 30 + p.lv * 8; if (roll < 0.3) expected.fight = ['小野猪', 1, '', 'attack']; break;
      case 'child:point': exp(0.1); break;
      case 'taoist:buy': expected.gold = -(50 + p.lv * 30); expected.boost = 3; break;
      case 'bandit:fight': expected.fight = ['拦路山贼', p.lv, 'elite', 'attack']; break;
      case 'bandit:pay': expected.gold = -(30 + p.lv * 15); break;
      default: assert.ok(['merchant:leave', 'chest:leave', 'taoist:refuse'].includes(`${id}:${choice.id}`), 'choice needs an explicit oracle');
    }
    const result = withRandom(roll, () => g.chooseEncounter(choice.id));
    assert.equal(result.kind, expected.fight ? 'fight' : 'resolved');
    assert.equal(p.encounter, null);
    assert.equal(p.gold - before.gold, expected.gold, `${id}:${choice.id}/${roll} gold cost/reward`);
    assert.equal(p.sp - before.sp, expected.sp);
    assert.equal(xpLedger(p) - xp, expected.exp);
    assert.equal(p.expBoost - before.expBoost, expected.boost);
    assert.equal(p.hp, expected.hp); assert.equal(p.mp, expected.mp);
    const items = { ...before.items };
    for (const [key, qty] of Object.entries(expected.items)) items[key] = (items[key] || 0) + qty;
    assert.deepEqual(p.items, items);
    assert.equal(p.bag.length - before.bag.length, expected.loot);
    if (expected.loot) assert.equal(p.bag.at(-1).q, 1);
    if (expected.fight) {
      const m = g.battle.monsters[0];
      assert.deepEqual([m.name, m.lv, m.rank, m.intent], expected.fight);
      assert.equal(g.battle.context.ambush === true, id === 'beast' && choice.id === 'ambush');
      assert.equal(g.battle.round, 0, 'choice starts but does not resolve combat');
    } else assert.equal(g.battle, null);
    validateSave(g.state);
    unchanged(g, () => g.chooseEncounter(choice.id), /当前战斗|没有奇遇/);
    assert.deepEqual(base.state, source, 'each choice/branch must use an isolated copy');
  }
}
function testEncounterRequirementsAndTravel() {
  const g = fixture('blademaster', 20); g.p.location = 'h_f1';
  g.p.encounter = { id: 'merchant', zone: 'h_f1', mob: '小野猪' };
  g.p.items.hp1 = 0; g.p.items.hp2 = 0;
  unchanged(g, () => g.chooseEncounter('help'), /生命药/);
  // hp2 is the supported fallback when hp1 is absent.
  g.p.items.hp2 = 1;
  withRandom(0.9, () => g.chooseEncounter('help'));
  assert.equal(g.p.items.hp2, 0); assert.equal(g.p.items.hp1, 0);
  for (const [id, choice, fee] of [['taoist', 'buy', 50 + g.p.lv * 30], ['bandit', 'pay', 30 + g.p.lv * 15]]) {
    g.p.encounter = { id, zone: 'h_f1', mob: '小野猪' }; g.p.gold = fee - 1;
    unchanged(g, () => g.chooseEncounter(choice), /金币不足/);
    g.p.gold = fee; g.chooseEncounter(choice); assert.equal(g.p.gold, 0);
  }
  g.p.encounter = { id: 'chest', zone: 'h_f1', mob: '小野猪' };
  unchanged(g, () => g.travel('missing'), /目的地/);
  g.travel('wanliu');
  assert.equal(g.p.encounter, null); assert.equal(g.battle, null);
  unchanged(g, () => g.chooseEncounter('open'), /没有奇遇/);
  g.p.location = 'h_f1';
  g.p.encounter = { id: 'chest', zone: 'h_f1', mob: '小野猪' };
  const town = g.p.items.town;
  g.useItem('town');
  assert.equal(g.p.location, g.p.lastCity);
  assert.equal(g.p.encounter, null); assert.equal(g.battle, null);
  assert.equal(g.p.items.town, town - 1);
  validateSave(g.state);
}
function testEncounterSaveBoundaries() {
  const g = fixture(); g.p.location = 'h_f1';
  g.p.encounter = { id: 'merchant', zone: 'h_f1', mob: '小野猪' };
  assert.deepEqual(validateSave(g.state), g.state);
  cases([
    ['unknown ID', s => s.player.encounter.id = 'missing'],
    ['prototype ID', s => s.player.encounter.id = 'constructor'],
    ['wrong zone', s => s.player.encounter.zone = 'e_f1'],
    ['unknown zone', s => s.player.encounter.zone = 'missing'],
    ['city encounter', s => { s.player.location = 'wanliu'; s.player.encounter.zone = 'wanliu'; }],
    ['array encounter', s => s.player.encounter = []],
    ['extra field', s => s.player.encounter.reward = 999],
    ['invalid mob', s => s.player.encounter.mob = 1],
  ].map(([name, mutate]) => [name, () => { const s = structuredClone(g.state); mutate(s); assert.throws(() => validateSave(s)); }]));
  const noMob = structuredClone(g.state); delete noMob.player.encounter.mob;
  validateSave(noMob);
  const old = structuredClone(g.state); delete old.player.encounter;
  const loaded = new Game(validateSave(old));
  assert.equal(withRandom(0.97, () => loaded.explore()).kind, 'fight', 'missing old encounter is accepted');
}
function testMonsterIntentSaveCompatibility() {
  const g = fixture(); g.p.location = 'h_f1'; g.hunt(0);
  for (const intent of INTENTS) {
    const s = structuredClone(g.state); s.battle.monsters[0].intent = intent;
    assert.equal(validateSave(s).battle.monsters[0].intent, intent);
  }
  for (const intent of ['missing', '', null, 2, {}, []]) {
    const s = structuredClone(g.state); s.battle.monsters[0].intent = intent;
    assert.throws(() => validateSave(s));
  }
  const old = structuredClone(g.state);
  delete old.player.encounter; delete old.battle.monsters[0].intent; delete old.battle.rewards;
  const loaded = new Game(validateSave(old));
  const current = new Game(structuredClone(g.state));
  withRandom(0.5, () => manual(loaded, 'defend'));
  withRandom(0.5, () => manual(current, 'defend'));
  assert.deepEqual(loaded.battle, current.battle, 'missing old intent behaves as attack and updates normally');
}
function intentCombatFixture() {
  const p = fixture('blademaster', 20, { cult: 0, chi: 80 }).p;
  p.equipment = {}; p.skills = {};
  p.hp = stats(p).hp; p.mp = stats(p).mp;
  const b = createBattle(p, [enemy({ atk: 400 })], { type: 'field', zone: 'h_f1' });
  return { p, b };
}
function incomingLogged(b) {
  return b.logs.reduce((sum, l) => sum + Number(l.text.match(/对你造成(\d+)点伤害/)?.[1] || 0), 0);
}
function testHeavyIntentScaleAndPerfectParry() {
  const source = intentCombatFixture();
  const run = (intent, atk, action) => {
    const { p, b } = structuredClone(source); const hp = p.hp;
    b.monsters[0].intent = intent; b.monsters[0].atk = atk;
    withRandom(0.5, () => combat(p, b, action));
    assert.equal(p.hp, hp - incomingLogged(b) + stats(p).hpRegen);
    return { p, b };
  };
  const ordinary = run('attack', 400, 'attack');
  const heavy = run('heavy', 400, 'attack');
  const scaled = run('attack', 400 * 2.4, 'attack');
  assert.equal(incomingLogged(heavy.b), incomingLogged(scaled.b), 'heavy has exactly the 2.4 attack scale');
  assert.ok(incomingLogged(heavy.b) > incomingLogged(ordinary.b));
  const parry = run('heavy', 400, 'defend');
  const quarter = run('attack', 400 * 0.25, 'attack');
  assert.equal(incomingLogged(parry.b), incomingLogged(quarter.b), 'perfect parry takes .25 of base, not .25 of heavy');
  const st = stats(source.p); const m = source.b.monsters[0];
  assert.equal(m.hp - parry.b.monsters[0].hp, expectedDamage(st.atk * 0.7, st, m, 'phys'), 'counter uses .7 player attack');
  assert.equal(parry.p.chi, source.p.chi + 15);
  assert.match(parry.b.logs.map((l) => l.text).join('\n'), /完美格挡/);
  assert.equal(run('attack', 400, 'defend').p.chi, source.p.chi, 'ordinary defend does not earn parry chi');
}
function testStunnedHeavyAndExposed() {
  const source = intentCombatFixture();
  const { p, b } = structuredClone(source);
  b.monsters[0].intent = 'heavy'; b.monsters[0].statuses = [{ kind: 'stun', source: 'bm4', value: 1, turns: 1 }];
  withRandom(0.5, () => combat(p, b, 'defend'));
  assert.equal(incomingLogged(b), 0); assert.equal(p.chi, source.p.chi);
  assert.equal(b.monsters[0].hp, source.b.monsters[0].hp, 'stunned heavy produces no counter');
  assert.deepEqual(b.monsters[0].statuses, []);
  assert.ok(b.logs.some((l) => /蓄力被眩晕打断/.test(l.text)));
  const attack = (intent, atk) => {
    const copy = structuredClone(source); copy.b.monsters[0].intent = intent; copy.b.monsters[0].atk = atk;
    withRandom(0.5, () => combat(copy.p, copy.b, 'attack')); return copy;
  };
  const normal = attack('attack', 400); const exposed = attack('exposed', 400); const scaled = attack('attack', 400 * 0.6);
  const dealt = (x) => source.b.monsters[0].hp - x.b.monsters[0].hp;
  assert.ok(Math.abs(dealt(exposed) - dealt(normal) * 1.5) <= 1, 'exposed receives 1.5 damage with single-hit rounding');
  assert.equal(incomingLogged(exposed.b), incomingLogged(scaled.b), 'exposed attacks at .6 base scale');
  assert.ok(exposed.b.logs.some((l) => /击中破绽/.test(l.text)));
}
function testIntentChangesAfterAllEnemyActions() {
  const { p, b } = intentCombatFixture();
  b.monsters.push({ ...structuredClone(b.monsters[0]), id: 'm1', name: '第二重击靶' });
  for (const m of b.monsters) m.intent = 'heavy';
  let calls = 0;
  withRandom(() => {
    calls++;
    if (calls <= 5) assert.deepEqual(b.monsters.map((m) => m.intent), ['heavy', 'heavy'], 'all attacks and counters precede first intent roll');
    if (calls === 6) assert.deepEqual(b.monsters.map((m) => m.intent), ['exposed', 'heavy']);
    return calls <= 4 ? 0.5 : 0.1;
  }, () => combat(p, b, 'defend'));
  assert.equal(calls, 6); assert.deepEqual(b.monsters.map((m) => m.intent), ['exposed', 'exposed']);
  assert.equal(p.chi, 110, 'both heavy actions parry before intents change');
  const firstAnnouncement = b.logs.findIndex((l) => /露出破绽/.test(l.text));
  const lastCounter = b.logs.findLastIndex((l) => /格挡反击对/.test(l.text));
  assert.ok(firstAnnouncement > lastCounter);
  for (const rank of ['', 'elite', 'boss']) {
    for (const intent of INTENTS) for (const roll of [0.1, 0.9]) {
      assert.equal(withRandom(roll, () => rollIntent({ rank, intent })), roll === 0.9 ? 'attack' : intent === 'heavy' ? 'exposed' : 'heavy');
    }
  }
}
function assertRewardLedger(g, before, xp, expMultiplier = 1) {
  const b = g.battle; const r = b.rewards;
  const expected = b.monsters.map(monsterReward).reduce((sum, x) => ({ exp: sum.exp + x.exp, sp: sum.sp + x.sp, gold: sum.gold + x.gold }), { exp: 0, sp: 0, gold: 0 });
  assert.equal(r.exp, expected.exp * expMultiplier); assert.equal(r.sp, expected.sp); assert.equal(r.gold, expected.gold);
  assert.equal(xpLedger(g.p) - xp, r.exp); assert.equal(g.p.sp - before.sp, r.sp); assert.equal(g.p.gold - before.gold, r.gold);
  assert.equal(g.p.totals.earned - before.totals.earned, r.gold); assert.equal(g.p.totals.battles - before.totals.battles, 1);
  let remaining = before.exp + r.exp; let level = before.lv;
  while (level < MAX_LEVEL && remaining >= expNeed(level)) { remaining -= expNeed(level); level++; }
  assert.equal(r.levelUps, level - before.lv); assert.equal(g.p.lv, level);
  assert.deepEqual(r.loot, g.p.bag.slice(before.bag.length).map(({ name, q }) => ({ name, q })));
  assert.deepEqual(r.items, Object.entries(g.p.items).filter(([id, n]) => n > (before.items[id] || 0)).map(([id, n]) => ({ id, qty: n - (before.items[id] || 0) })));
  validateSave(g.state);
  const finished = structuredClone(g.state);
  unchanged(g, () => manual(g, 'attack'), /没有战斗/);
  g.autoTurn(); assert.deepEqual(g.state, finished, 'auto on finished battle cannot repeat payout');
  assert.equal(combat(g.p, g.battle, 'attack'), 'win'); assert.deepEqual(g.state, finished, 'terminal combat cannot repeat payout');
}
function testFieldBattleRewardMetadata() {
  for (const mode of ['main', 'bounty', 'none']) for (const roll of [0.1, 0.9]) {
    const g = fixture('blademaster', 20); g.p.location = 'h_f1';
    g.p.mainIndex = mode === 'main' ? 1 : 0;
    const q = g.quests[1]; g.p.mainProgress = q.goal.count - 1;
    if (mode !== 'none') g.p.bounty = { ...structuredClone(q), bounty: true, title: '奖励元数据悬赏' };
    g.p.bountyProgress = q.goal.count - 1; g.p.exp = expNeed(g.p.lv) - 1; g.p.expBoost = 1;
    const m = makeMonster(...ZONES.h_f1.mobs[0]); m.hp = 1;
    g.state.battle = createBattle(g.p, [m], { type: 'field', zone: 'h_f1' });
    const before = structuredClone(g.p); const xp = xpLedger(g.p);
    withRandom(roll, () => assert.equal(manual(g, 'attack'), 'win'));
    assertRewardLedger(g, before, xp, 2);
    assert.equal(g.battle.rewards.levelUps, 1); assert.equal(g.p.expBoost, 0);
    assert.equal(g.battle.rewards.loot.length, roll === 0.1 ? 1 : 0);
    assert.deepEqual(g.battle.rewards.items, roll === 0.1 ? [{ id: 'huanxian', qty: 1 }, { id: 'hide1', qty: 1 }, { id: 'hp1', qty: 1 }] : [{ id: 'hide1', qty: 1 }]);
    assert.deepEqual(g.battle.rewards.quest, mode === 'none' ? null : { title: mode === 'main' ? q.title : g.p.bounty.title, done: q.goal.count, total: q.goal.count });
    assert.equal(g.p.mainProgress, before.mainProgress + (mode === 'main' ? 1 : 0));
    assert.equal(g.p.bountyProgress, before.bountyProgress + (mode !== 'none' ? 1 : 0));
  }
}
function testDungeonBattleRewardMetadata(id) {
  const d = DUNGEONS.find((d) => d.id === id);
  for (const bossWave of [false, true]) {
    const g = fixture('blademaster', d.lv); dungeonEntrance(g, d); g.enterDungeon(id);
    if (bossWave) g.startDungeonWave(d, d.waves || 3);
    // Already wounded wave fixture; use the actual turn/reward resolver.
    g.battle.monsters.forEach((m, i) => { m.hp = i === 0 ? 1 : 0; });
    const before = structuredClone(g.p); const xp = xpLedger(g.p);
    withRandom(0.9, () => assert.equal(manual(g, 'attack'), 'win'));
    assertRewardLedger(g, before, xp);
    assert.equal(g.battle.rewards.quest, null);
    assert.equal(g.p.daily.dungeons[id], 1); assert.equal(g.p.clears[id] || 0, bossWave ? 1 : 0);
    assert.equal(g.battle.rewards.loot.length, bossWave && d.rewardKind === 'equipment' ? 2 : 0);
    const items = bossWave ? [{ id: 'huanxian', qty: 8 }, { id: 'card', qty: 1 }, ...(d.rewardMaterials || []).map((id) => ({ id, qty: 4 })), { id: 'tiangang', qty: 1 }, ...(d.lv >= 75 ? [{ id: 'highForgeSigil', qty: 2 }] : [])] : [];
    assert.deepEqual(g.battle.rewards.items, items);
    if (bossWave && d.rewardKind === 'equipment') assert.equal(g.battle.rewards.loot.at(-1).q, 2);
  }
}
function testBattleRewardsSaveBoundaries() {
  const g = fixture(); g.p.location = 'h_f1'; woundedVictory(g, ZONES.h_f1.mobs[0], 'h_f1');
  const source = structuredClone(g.state); assert.ok(source.battle.rewards);
  cases([
    ['not a win', s => s.battle.result = 'escape'], ['array rewards', s => s.battle.rewards = []],
    ...['exp', 'sp', 'gold', 'levelUps'].flatMap((key) => [[`${key} fraction`, s => s.battle.rewards[key] = 0.5], [`${key} missing`, s => delete s.battle.rewards[key]]]),
    ['too many levels', s => s.battle.rewards.levelUps = 106],
    ['loot not array', s => s.battle.rewards.loot = {}], ['too many loot', s => s.battle.rewards.loot = Array(11).fill({ name: '装备', q: 0 })],
    ['empty loot name', s => s.battle.rewards.loot = [{ name: '', q: 0 }]], ['bad quality', s => s.battle.rewards.loot = [{ name: '装备', q: 5 }]],
    ['items not array', s => s.battle.rewards.items = {}], ['unknown item', s => s.battle.rewards.items = [{ id: 'missing', qty: 1 }]],
    ['zero quantity', s => s.battle.rewards.items = [{ id: 'hp1', qty: 0 }]], ['fraction quantity', s => s.battle.rewards.items = [{ id: 'hp1', qty: 0.5 }]],
    ['too many items', s => s.battle.rewards.items = Array(11).fill({ id: 'hp1', qty: 1 })],
    ['bad quest', s => s.battle.rewards.quest = []], ['empty quest title', s => s.battle.rewards.quest = { title: '', done: 0, total: 1 }],
    ['quest overflow', s => s.battle.rewards.quest = { title: '任务', done: 2, total: 1 }],
  ].map(([name, mutate]) => [name, () => { const s = structuredClone(source); mutate(s); assert.throws(() => validateSave(s)); }]));
  for (const missing of [true, false]) {
    const old = structuredClone(source); if (missing) delete old.battle.rewards; else old.battle.rewards = null;
    const loaded = new Game(validateSave(old)); unchanged(loaded, () => loaded.turn('attack'), /没有战斗/);
  }
}

try {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: forbiddenStorage });
  // Stable day/log timestamps without touching OS time; daily tests advance the
  // mock explicitly. Math.random is separately reset for every named test.
  withDate(OriginalDate.UTC(2026, 10, 20, 12), () => {
    const named = [
      testCreation, testExperienceAndAllocation, testTravel, testRejectedTeleportIsAtomic,
      testEconomyAndItems, testPotionLevelOutsideBattle, testEquipmentAndRing2, testSkillLearning,
      testQuestOnlyCurrentTarget, testBountyAndCards, testDailyRefreshAndSignIn,
      testForge, testRefineSuccessFailureAndAids, testDungeonEntryLimits,
      testCultTrialsAndBreakthroughs, testSageDemonBranches, testDeathLossAndReviveScroll,
      testClericPassiveRevivesOnlyOnce, testSaveRoundTrip, testSaveStorageFailureAndNoStorage,
      testMalformedJSONAndStructures, testIllegalNumericSaveValues,
      testSaveBooleanStructureBoundaries, testSaveDiscreteCounterBoundaries,
      testBattleSnapshotStructureBoundaries, testBattleSnapshotExtendedNumericAttributes,
      testBattleInputIsolationAndTargetIDs, testRejectedCombatActionsDoNotTick,
      testBuffDurationAndShield, testHotAndRegenLastTickAndClamp, testDotDurationRefreshAndRetarget,
      testStunActionOpportunitiesAndChanceBoundary, testTransformDoesNotHealByToggling,
      testPetDuplicateSummonAndHealing, testSpeedRealCombosAndSkillHits, testChannelCooldownBoundaries,
      testNaturalRecoveryAndTerminalRounds, testAccuracyHitBoundary, testDamageLevelsPenetrationAndElements,
      testEnemyDamageAttributesAndCrit, testCharmsThresholdsConsumptionAndRejection, testBattleSnapshotCombatMechanisms,
      testExploreFirstTwoVictories, testExploreOutcomesAndPending, testEncounterDefinitionCoverage,
      testEncounterRequirementsAndTravel, testEncounterSaveBoundaries, testMonsterIntentSaveCompatibility,
      testHeavyIntentScaleAndPerfectParry, testStunnedHeavyAndExposed, testIntentChangesAfterAllEnemyActions,
      testFieldBattleRewardMetadata, testBattleRewardsSaveBoundaries,
    ];
    for (const fn of named) test(fn.name, fn);
    for (const id of ENCOUNTER_IDS) test(`testEncounterChoices/${id}`, () => testEncounterChoices(id));
    for (const id of ['d15', 'd75']) test(`testDungeonBattleRewardMetadata/${id}`, () => testDungeonBattleRewardMetadata(id));
    for (const id of ['d15', 'd75', 'd105']) test(`testDungeonWavesAndGuaranteedLoot/${id}`, () => testDungeonWavesAndGuaranteedLoot(id));
    for (const cls of Object.keys(CLASSES)) {
      for (const lv of [1, 20, 60, 100]) {
        for (const profile of ['provisioned', 'resource-poor']) {
          for (const encounter of ['phys', 'mixed', 'boss']) {
            test(`testAutomaticConfiguration/${cls}/L${lv}/${profile}/${encounter}`,
              () => testAutomaticConfiguration(cls, lv, profile, encounter));
          }
        }
      }
    }
    test('testAutomaticCoverageAndBudget', function testAutomaticCoverageAndBudget() {
      // 240 class/config battles + 11 trials + (4 + 5 + 6) dungeon waves.
      assert.equal(auto.started, 266, 'automatic coverage was skipped');
      assert.equal(auto.completed, auto.started, 'some automatic battles never terminated');
      assert.equal(auto.wins + auto.losses, auto.started);
      assert.ok(auto.started <= AUTO_LIMIT);
      assert.ok(auto.maxRound <= ROUND_LIMIT);
    });
  });
} finally {
  Math.random = originalRandom;
  globalThis.Date = OriginalDate;
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
  else delete globalThis.localStorage;
}
test('testGlobalMocksRestored', function testGlobalMocksRestored() {
  // test() temporarily replaces random; verify restoration outside its wrapper.
  assert.equal(globalThis.Date, OriginalDate);
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), storageDescriptor);
});
assert.equal(Math.random, originalRandom, 'Math.random was not restored');
console.log(`\nSUMMARY tests=${tests}, passed=${passed}, failed=${failures.length}, seed=0x${SEED.toString(16)}`);
console.log(`AUTO actual=${auto.started}/${AUTO_LIMIT}, completed=${auto.completed}, wins=${auto.wins}, losses=${auto.losses}, rounds=${auto.rounds}, maxRounds=${auto.maxRound}/${ROUND_LIMIT}; manualTurns=${manualTurns}`);
console.log('All high-level/gear/cult fixtures are initialized configurations, not proof of authentic progression.');
if (failures.length) {
  console.error('\nREAL FAILURES (application files were not modified):');
  for (const { name, error } of failures) console.error(`- ${name}: ${error.message}`);
  process.exitCode = 1;
}
