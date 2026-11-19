import assert from 'node:assert/strict';
import { Game, validateSave } from '../src/core/game.js';
import { stats, makeMonster } from '../src/core/model.js';
import { makeEquip, makeHighEquip, QUALITY } from '../src/data/items.js';
import { HIGH_EQUIPMENT, HIGH_RECIPES, matchesHighEquip } from '../src/data/high-equipment.js';
import { equipmentAction } from '../src/core/equipment.js';
import { createBattle, takeTurn } from '../src/core/combat.js';
import { economyAction } from '../src/core/economy.js';
import { HONGYUN_POOL } from '../src/data/economy.js';
import { DUNGEONS } from '../src/data/world.js';
import { itemNameColor, ITEM_COLOR_PALETTE } from '../src/data/item-colors.js';

let passed = 0;
const failures = [];
const originalRandom = Math.random;
function test(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.stack}`); }
  finally { Math.random = originalRandom; }
}
function legacy(it) {
  const copy = structuredClone(it);
  for (const key of ['ruleVersion', 'series', 'weaponType', 'wear', 'ranges', 'stars', 'attackType', 'origin']) delete copy[key];
  copy.socketLimit = 4; copy.sockets = []; return copy;
}
function fixture(cls = 'blademaster') {
  const g = new Game(); g.start('神铸测试', cls);
  g.p.lv = 105; g.p.attrs = { str: 300, con: 185, dex: 50, mag: 5 };
  if (cls === 'wizard') g.p.attrs = { str: 50, con: 185, dex: 5, mag: 300 };
  g.p.gold = 1e7; g.p.items.highForgeSigil = 1000; g.p.items.treasureKey = 100;
  g.p.wallet.yuanbao = 10000; g.p.equipment = {}; g.p.bag = [];
  const st = stats(g.p); g.p.hp = st.hp; g.p.mp = st.mp;
  return g;
}
function unchanged(g, run) {
  const before = structuredClone(g.state);
  assert.throws(run); assert.deepEqual(g.state, before);
}
function opponent(index = 0) {
  const m = makeMonster('神铸试剑敌', 105, '', 'phys', index);
  m.hp = m.maxHp = 1e8; m.atk = 100; m.def = m.mdef = 0; return m;
}
function sample(id, guaranteed = false) {
  const pool = guaranteed ? HONGYUN_POOL.filter((x) => x.rarity === 'legendary') : HONGYUN_POOL;
  const total = pool.reduce((n, x) => n + x.weight, 0);
  let n = 0;
  for (const entry of pool) { if (entry.id === id) return (n + entry.weight / 2) / total; n += entry.weight; }
  throw new Error(`Missing prize ${id}`);
}

test('five named templates preserve official grade stage ranges and red names', () => {
  assert.equal(Object.keys(HIGH_EQUIPMENT).length, 5);
  for (const [id, t] of Object.entries(HIGH_EQUIPMENT)) {
    const first = makeHighEquip(id); const second = makeHighEquip(id);
    assert.ok(matchesHighEquip(first)); assert.notEqual(first.uid, second.uid);
    assert.equal(first.grade, t.grade); assert.equal(first.stage, t.stage);
    assert.equal(first.name, t.name); assert.equal(first.q, 4); assert.equal(first.bound, true);
    assert.deepEqual(first.base, t.base); assert.deepEqual(first.addons, t.addons);
    assert.equal(first.durability, t.maxDurability); assert.equal(first.sockets.length, t.initialSockets);
    first.base.def = 123; assert.notDeepEqual(first.base, second.base); assert.notDeepEqual(first.base, t.base);
  }
  assert.deepEqual(HIGH_EQUIPMENT.axe19c.attackRanges.patk, [1647, 3843]);
  assert.deepEqual(HIGH_EQUIPMENT.sword18b.attackRanges.matk, [1768, 2161]);
  assert.equal(QUALITY[4].color, '#ff5454');
});
test('robe provenance durability classes and exact historical variant remain verifiable', () => {
  const it = makeHighEquip('robe17c');
  assert.equal(it.maxDurability, 320);
  assert.deepEqual(it.classes, ['wizard', 'psychic', 'venomancer', 'cleric', 'mystic']);
  assert.equal(it.source[0], 'https://w2i.wanmei.com/mobile/mobilenews/20180815/80718.shtml');
  for (const element of ['metal', 'wood', 'water', 'fire', 'earth']) assert.equal(it.base[`${element}Def`], 2515);
  const old = { ...structuredClone(it), classes: null, base: { def: 349, mdef: 2515 }, durability: 100, maxDurability: 100,
    source: ['https://w2i.wanmei.com/mobile/mobilebroad/20221114/85515.shtml'],
    adaptation: '五行防御各2515合并为mdef=2515，不是五项总和；4孔和100耐久为本作适配，原图耐久未核。生命上限增幅按本作属性模型计算。未核特殊效果，无额外战斗效果。' };
  assert.ok(matchesHighEquip(old));
  const g = fixture(); g.p.bag = [it, old]; old.uid += 'old'; validateSave(g.state);
  for (const mutate of [x => x.base.def++, x => x.source[0] = 'wrong', x => x.maxDurability = 320]) {
    const forged = structuredClone(old); mutate(forged); assert.equal(matchesHighEquip(forged), false);
  }
});
test('item name colors require exact evidence and never depend on quality grade or stars', () => {
  for (const q of [0, 1, 2, 3, 4]) {
    assert.equal(itemNameColor({ name: '★凤兮法冠', q, grade: 11, stars: 1 }), 'green');
    assert.equal(itemNameColor({ name: '★未知装备', q, grade: 19, stars: 3, nameColor: 'red' }), 'unknown');
    assert.equal(itemNameColor({ name: '幻仙石', q }), 'purple');
  }
  for (const it of Object.values(HIGH_EQUIPMENT)) assert.equal(itemNameColor(it), 'red');
  assert.deepEqual(Object.keys(ITEM_COLOR_PALETTE), ['unknown', 'white', 'blue', 'purple', 'gold', 'green', 'orange', 'red']);
});
test('craft deducts exact local recipe and delivers a fixed 105-level instance', () => {
  for (const [id, recipe] of Object.entries(HIGH_RECIPES).filter(([, x]) => !x.from)) {
    const g = fixture(); const gold = g.p.gold; const count = g.p.items.highForgeSigil;
    equipmentAction(g, 'craft', { templateId: id, confirm: true });
    assert.equal(g.p.bag.length, 1); assert.ok(matchesHighEquip(g.p.bag[0]));
    assert.equal(g.p.bag[0].templateId, id);
    assert.equal(g.p.gold, gold - recipe.gold);
    assert.equal(g.p.items.highForgeSigil, count - recipe.materials.highForgeSigil);
    validateSave(g.state);
  }
});
test('craft rejects unconfirmed unknown privileged low-level poor full and combat inputs without mutation', () => {
  const g = fixture();
  for (const body of [{ templateId: 'axe19a', confirm: false }, { templateId: 'constructor', confirm: true }, { templateId: 'axe19b', confirm: true }, { templateId: 'axe19a', confirm: true, grade: 21 }]) unchanged(g, () => equipmentAction(g, 'craft', body));
  g.p.lv = 104; unchanged(g, () => equipmentAction(g, 'craft', { templateId: 'axe19a', confirm: true })); g.p.lv = 105;
  g.p.items.highForgeSigil = 59; unchanged(g, () => equipmentAction(g, 'craft', { templateId: 'axe19a', confirm: true })); g.p.items.highForgeSigil = 1000;
  g.p.gold = 0; unchanged(g, () => equipmentAction(g, 'craft', { templateId: 'axe19a', confirm: true })); g.p.gold = 1e7;
  g.p.bag = Array.from({ length: 80 }, () => makeEquip('weapon', 1, 0, g.p.cls));
  unchanged(g, () => equipmentAction(g, 'craft', { templateId: 'axe19a', confirm: true })); g.p.bag = [];
  g.state.battle = createBattle(g.p, [opponent()], { type: 'arena' });
  unchanged(g, () => equipmentAction(g, 'craft', { templateId: 'axe19a', confirm: true }));
});
test('19-grade stage chain preserves UID refinement sockets binding and remaining durability', () => {
  const g = fixture(); const it = makeHighEquip('axe19a');
  it.refine = 7; it.sockets = ['gemPatk1', null]; it.durability = 321; g.p.bag.push(it);
  for (const next of ['axe19b', 'axe19c']) {
    const before = structuredClone(g.p); equipmentAction(g, 'ascend', { uid: it.uid, confirm: true });
    const actual = g.p.bag[0]; assert.equal(actual.templateId, next); assert.ok(matchesHighEquip(actual));
    assert.equal(actual.uid, it.uid); assert.equal(actual.refine, 7); assert.deepEqual(actual.sockets, ['gemPatk1', null]);
    assert.equal(actual.durability, 321); assert.equal(actual.bound, true);
    assert.equal(g.p.gold, before.gold - HIGH_RECIPES[next].gold);
    assert.equal(g.p.items.highForgeSigil, before.items.highForgeSigil - HIGH_RECIPES[next].materials.highForgeSigil);
    validateSave(g.state);
  }
  unchanged(g, () => equipmentAction(g, 'ascend', { uid: it.uid, confirm: true }));
});
test('fixed identity rejects random rerolls upgrades sales decomposition and poor or worn ascension', () => {
  const g = fixture(); const it = makeHighEquip('axe19a'); g.p.bag.push(it);
  for (const action of ['reroll', 'upgrade', 'decompose']) unchanged(g, () => equipmentAction(g, action, { uid: it.uid, ...(action === 'decompose' ? { confirm: true } : {}) }));
  unchanged(g, () => g.sell(it.uid));
  unchanged(g, () => equipmentAction(g, 'ascend', { uid: it.uid, confirm: false }));
  g.p.items.highForgeSigil = 0; unchanged(g, () => equipmentAction(g, 'ascend', { uid: it.uid, confirm: true }));
  g.p.items.highForgeSigil = 1000; g.equip(it.uid);
  unchanged(g, () => equipmentAction(g, 'ascend', { uid: it.uid, confirm: true }));
});
test('wear requirements reject unsupported classes low level and self-supported attributes', () => {
  const g = fixture(); const it = makeHighEquip('axe19c'); g.p.bag.push(it);
  g.p.attrs.str = 299; unchanged(g, () => g.equip(it.uid));
  const old = legacy(makeEquip('weapon', 105, 3, 'blademaster')); old.addons.str = 100; g.p.equipment.weapon = old;
  unchanged(g, () => g.equip(it.uid)); delete g.p.equipment.weapon;
  g.p.attrs.str = 300; g.p.lv = 104; unchanged(g, () => g.equip(it.uid)); g.p.lv = 105;
  g.equip(it.uid); assert.equal(g.p.equipment.weapon.uid, it.uid);
  const seeker = fixture('seeker'); seeker.p.bag = [makeHighEquip('axe19c')]; unchanged(seeker, () => seeker.equip(seeker.p.bag[0].uid));
  const wizard = fixture('wizard'); wizard.p.bag = [makeHighEquip('sword18b')]; wizard.equip(wizard.p.bag[0].uid);
});
test('snapshot roundtrip validates immutable fields rejects unknown templates and still accepts old equipment', () => {
  const g = fixture(); g.p.bag = [makeHighEquip('axe19c')];
  assert.deepEqual(validateSave(g.state), g.state);
  for (const mutate of [x => x.templateId = 'constructor', x => x.stage = 5, x => x.name = '伪造', x => x.grade = 21, x => x.q = 3, x => x.base.patk++, x => x.addons.str++, x => x.bound = false, x => x.maxDurability = 999]) {
    const raw = structuredClone(g.state); mutate(raw.player.bag[0]); assert.throws(() => validateSave(raw));
  }
  g.p.bag = [legacy(makeEquip('body', 100, 3, g.p.cls)), makeEquip('body', 100, 3, g.p.cls)]; assert.deepEqual(validateSave(g.state), g.state);
  const forged = structuredClone(g.state); forged.player.bag[0].q = 4; assert.throws(() => validateSave(forged));
});
test('430-durability weapons repair and socket normally; refinement widens actual damage ranges', () => {
  const g = fixture(); const it = makeHighEquip('axe19c'); it.durability = 400; g.p.bag.push(it);
  equipmentAction(g, 'repair', { uid: it.uid }); assert.equal(it.durability, 430);
  g.p.items.socketStone = 1; g.p.items.gemPatk1 = 1;
  equipmentAction(g, 'socket', { uid: it.uid, gemId: 'gemPatk1', index: 0 }); assert.equal(it.sockets[0], 'gemPatk1');
  g.equip(it.uid); const before = stats(g.p); assert.ok(before.atkMax - before.atkMin >= 2195);
  it.refine = 12; const refined = stats(g.p); assert.ok(refined.atkMax - refined.atkMin > before.atkMax - before.atkMin);
  it.durability = 0; assert.ok(stats(g.p).atkMax - stats(g.p).atkMin < refined.atkMax - refined.atkMin);
  validateSave(g.state);
});
test('HP-percent hunt spirit creation are effective attributes not decorative labels', () => {
  const g = fixture('wizard'); const robe = makeHighEquip('robe17c'); g.p.equipment.body = robe;
  const st = stats(g.p); const noPercent = structuredClone(g.p); noPercent.equipment.body.addons.hpPct = 0;
  assert.equal(st.hp, Math.round(stats(noPercent).hp * 1.05));
  g.p.equipment.weapon = makeHighEquip('sword18b'); const high = stats(g.p);
  assert.equal(high.spirit, 200); assert.equal(high.creation, 1); assert.ok(high.atkMin < high.atkMax);
  g.p.equipment.weapon = makeHighEquip('axe19c'); assert.equal(stats(g.p).huntLevel, 800);
});
test('double damage fixed proc has a real effect and broken weapon disables it', () => {
  function damage(proc, broken = false) {
    const g = fixture(); g.p.equipment.weapon = makeHighEquip('axe19c');
    if (broken) g.p.equipment.weapon.durability = 0;
    const b = createBattle(g.p, [opponent()], { type: 'arena' });
    const draws = broken ? [0.99, 0.5, 0.5, 0.5, 0.99] : [0.99, 0.5, proc, 0.5, 0.5, 0.99, 0.99];
    Math.random = () => draws.shift() ?? 0.99; takeTurn(g.p, b, 'attack');
    g.state.battle = b; validateSave(g.state);
    return { damage: b.monsters[0].maxHp - b.monsters[0].hp, logs: b.logs };
  }
  const normal = damage(0.3); const empowered = damage(0.1);
  assert.ok(Math.abs(empowered.damage - normal.damage * 2) <= 1);
  assert.ok(empowered.logs.some((x) => x.text.includes('狂天神触发')));
  assert.ok(!damage(0.1, true).logs.some((x) => x.text.includes('狂天神触发')));
});
test('sword defensive proc loses subsequent targets persists legally then expires next round', () => {
  const g = fixture('wizard'); g.p.equipment.weapon = makeHighEquip('sword18b');
  const b = createBattle(g.p, [opponent(0), opponent(1)], { type: 'arena' });
  Math.random = () => 0.1; takeTurn(g.p, b, 'defend');
  assert.ok(b.buffs.some((x) => x.id === 'gear:sword18b:guard' && x.turns === 1));
  assert.ok(b.logs.some((x) => x.text.includes('失去目标')));
  g.state.battle = b; validateSave(g.state);
  Math.random = () => 0.99; takeTurn(g.p, b, 'defend');
  assert.ok(!b.buffs.some((x) => x.id === 'gear:sword18b:guard'));
});
test('first-stage armor break changes next-round damage and validates its exact source', () => {
  const g = fixture(); g.p.equipment.weapon = makeHighEquip('axe19a');
  const enemy = opponent(); enemy.def = enemy.mdef = 10000; enemy.atk = 0;
  const b = createBattle(g.p, [enemy], { type: 'arena' });
  Math.random = () => 0.1; takeTurn(g.p, b, 'attack');
  assert.ok(b.monsters[0].statuses.some((s) => s.source === 'equip:axe19a' && s.value === 0.9));
  g.state.battle = b; validateSave(g.state);
  const invalid = structuredClone(g.state); invalid.battle.monsters[0].statuses[0].source = 'equip:fake';
  assert.throws(() => validateSave(invalid));
  const plainP = structuredClone(g.p); const plainB = structuredClone(b); plainB.monsters[0].statuses = [];
  const before = b.monsters[0].hp; const plainBefore = plainB.monsters[0].hp;
  Math.random = () => 0.5; takeTurn(g.p, b, 'attack');
  Math.random = () => 0.5; takeTurn(plainP, plainB, 'attack');
  assert.ok(before - b.monsters[0].hp > plainBefore - plainB.monsters[0].hp);
  Math.random = () => 0.99; takeTurn(g.p, b, 'defend');
  assert.ok(!b.monsters[0].statuses.some((s) => s.source === 'equip:axe19a'));
});
test('second-stage crit proc raises effective stats then expires without refreshing', () => {
  const g = fixture(); g.p.equipment.weapon = makeHighEquip('axe19b');
  const b = createBattle(g.p, [opponent()], { type: 'arena' }); const baseline = stats(g.p, b);
  Math.random = () => 0.1; takeTurn(g.p, b, 'attack');
  assert.ok(b.buffs.some((x) => x.id === 'gear:axe19b:crit' && x.turns === 2));
  assert.ok(Math.abs(stats(g.p, b).crit - baseline.crit - 0.3) < 1e-9);
  assert.ok(Math.abs(stats(g.p, b).critDamage - baseline.critDamage - 0.3) < 1e-9);
  g.state.battle = b; validateSave(g.state);
  Math.random = () => 0.99; takeTurn(g.p, b, 'defend'); takeTurn(g.p, b, 'defend');
  assert.ok(!b.buffs.some((x) => x.id === 'gear:axe19b:crit'));
});
test('first-stage guard halves subsequent damage and next-round combo is not decorative', () => {
  const g = fixture(); g.p.equipment.weapon = makeHighEquip('axe19a');
  const enemies = [opponent(0), opponent(1)].map((m, index) => ({ ...m, name: `目标${index}`, crit: 0, atk: 1000 }));
  const b = createBattle(g.p, enemies, { type: 'arena' });
  const draws = [0.5, 0.99, 0.1, 0.5, 0.99, 0.99]; Math.random = () => draws.shift() ?? 0.99;
  takeTurn(g.p, b, 'defend');
  const damages = b.logs.filter((x) => /对你造成/.test(x.text)).map((x) => Number(x.text.match(/造成(\d+)/)[1]));
  assert.equal(damages.length, 2); assert.ok(Math.abs(damages[0] / 2 - damages[1]) <= 1);
  g.state.battle = b; validateSave(g.state);
  Math.random = () => 0.99; takeTurn(g.p, b, 'attack');
  assert.ok(!b.buffs.some((x) => x.id === 'gear:axe19a:guard'));
  assert.ok(b.logs.some((x) => /3\/3连击命中/.test(x.text)));
  takeTurn(g.p, b, 'defend'); assert.ok(!b.buffs.some((x) => x.id === 'gear:axe19a:speed'));
});
test('second-stage dodge guard stops subsequent attacks and broken stages cannot proc', () => {
  const g = fixture(); g.p.equipment.weapon = makeHighEquip('axe19b');
  const b = createBattle(g.p, [opponent(0), opponent(1)], { type: 'arena' });
  Math.random = () => 0.1; takeTurn(g.p, b, 'defend');
  assert.ok(b.logs.some((x) => x.text.includes('风残影免疫')));
  assert.equal(b.logs.filter((x) => x.text.includes('对你造成')).length, 1);
  g.state.battle = b; validateSave(g.state);
  Math.random = () => 0.99; takeTurn(g.p, b, 'defend'); assert.ok(!b.buffs.some((x) => x.id === 'gear:axe19b:guard'));
  for (const templateId of ['axe19a', 'axe19b']) {
    const broken = fixture(); broken.p.equipment.weapon = makeHighEquip(templateId); broken.p.equipment.weapon.durability = 0;
    const battle = createBattle(broken.p, [opponent()], { type: 'arena' });
    Math.random = () => 0.1; takeTurn(broken.p, battle, 'attack');
    assert.ok(!battle.buffs.some((x) => x.id.startsWith('gear:')));
    assert.ok(!battle.monsters[0].statuses.some((x) => x.source.startsWith('equip:')));
  }
});
test('19-grade hunt applies to monsters but not NPC arena opponents', () => {
  function damage(type) {
    const g = fixture(); g.p.equipment.weapon = makeHighEquip('axe19a');
    const b = createBattle(g.p, [opponent()], type === 'arena' ? { type } : { type, zone: g.p.location });
    const draws = [0.99, 0.5, 0.5, 0.5, 0.99]; Math.random = () => draws.shift() ?? 0.99;
    takeTurn(g.p, b, 'attack'); return b.monsters[0].maxHp - b.monsters[0].hp;
  }
  const arena = damage('arena'); const field = damage('field'); assert.ok(Math.abs(field - arena * 1.6) <= 1);
});
test('all high prizes deliver real fixed equipment even to low-level holders; pity and full-bag rollback apply', () => {
  for (const id of ['hySovereign19', 'hyHeaven18', 'hyTwilight17', 'hyForge']) {
    const g = fixture(); g.p.lv = 1; const point = sample(id); Math.random = () => point;
    const result = economyAction(g, 'treasure.draw', { count: 1 });
    assert.equal(result.results[0].prizeId, id);
    if (id === 'hyForge') assert.equal(g.p.items.highForgeSigil, 1012);
    else { assert.ok(matchesHighEquip(g.p.bag[0])); assert.equal(g.p.bag[0].lv, 105); }
    validateSave(g.state);
  }
  const g = fixture(); g.p.events.hongyun = { draws: 49, pity: 49 }; Math.random = () => sample('hySovereign19', true);
  economyAction(g, 'treasure.draw', { count: 1 }); assert.equal(g.p.bag[0].templateId, 'axe19c'); assert.equal(g.p.events.hongyun.pity, 0);
  g.p.bag = Array.from({ length: 80 }, () => makeHighEquip('robe17c'));
  unchanged(g, () => economyAction(g, 'treasure.draw', { count: 1 }));
});
test('75-plus dungeon boss victory grants exactly two usable local forging sigils', () => {
  const g = fixture(); const m = makeMonster('凭证首领', 75, 'boss'); m.hp = 0;
  const d = DUNGEONS.find((entry) => entry.id === 'd95');
  assert.equal(d.lv, 90); g.p.location = d.entrance[0]; g.p.encounter = null;
  g.state.battle = { ...createBattle(g.p, [m], { type: 'dungeon', id: d.id, wave: d.waves || 3, bossWave: true }), result: 'win' };
  const count = g.p.items.highForgeSigil; Math.random = () => 0.99; g.resolveBattle();
  assert.equal(g.p.items.highForgeSigil, count + 2);
});
console.log(`High equipment: ${passed}/${passed + failures.length} passed. Imported mechanics fixtures; not natural progression.`);
if (failures.length) process.exitCode = 1;
