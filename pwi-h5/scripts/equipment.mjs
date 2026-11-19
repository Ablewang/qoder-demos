import assert from 'node:assert/strict';
import { CLASSES, SKILLS } from '../src/data/classes.js';
import { ARMOR_SLOTS, ITEMS, STAT_NAMES, EQUIPMENT_DEFAULTS, EQUIPMENT_SETS, makeEquip, equipStats, setStats, shopList } from '../src/data/items.js';
import { createPlayer, stats, makeMonster } from '../src/core/model.js';
import { ensureEquipment, equipmentAction, wearEquipment } from '../src/core/equipment.js';
import { matchesNamedEquip } from '../src/data/named-equipment.js';

// Controlled pre-ruleVersion compatibility fixtures; never downgrade a live item.
function legacyEquip(slot, lv, q, cls) {
  const it = structuredClone(makeEquip(slot, lv, q, cls));
  for (const key of ['ruleVersion', 'series', 'weaponType', 'wear', 'ranges', 'stars', 'attackType', 'origin']) delete it[key];
  it.socketLimit = 4; it.sockets = [];
  it.setId = q >= 2 && ARMOR_SLOTS.includes(slot) ? Object.keys(EQUIPMENT_SETS).find((id) => EQUIPMENT_SETS[id].armor === CLASSES[cls].armor) : null;
  return it;
}
import { createBattle, takeTurn, canUseSkill, pickAutoAction, skillCooldown } from '../src/core/combat.js';

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const withRandom = (value, fn) => {
  const old = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = old; }
};
function player(cls = 'blademaster', addons = {}) {
  const p = createPlayer('装备测试', cls);
  p.lv = 60; p.cult = 6; p.chi = 300; p.gold = 100000;
  p.skills = Object.fromEntries(SKILLS[cls].filter((s) => s.lv <= p.lv).map((s) => [s.id, 1]));
  p.equipment = { weapon: legacyEquip('weapon', 35, 0, cls) };
  p.equipment.weapon.addons = { ...addons };
  p.items = { socketStone: 20, reforgeStone: 20, upgradeStone: 20, salvage: 20, gemHp1: 8, gemMp1: 8, gemPatk2: 8 };
  p.hp = stats(p).hp; p.mp = stats(p).mp;
  return p;
}
function game() {
  return {
    state: { player: player(), battle: null, journal: [] },
    get p() { return this.state.player; },
    get busy() { return !!this.state.battle && !this.state.battle.result; },
    event(text) { this.state.journal.push({ text }); },
  };
}
function packed(g, q = 2, lv = 35) {
  const it = legacyEquip('body', lv, q, g.p.cls);
  g.p.bag.push(it);
  return it;
}
const act = (g, action, it, params = {}) => equipmentAction(g, action, { uid: it.uid, ...params });
function reject(g, action, params, pattern) {
  const before = structuredClone(g.state);
  assert.throws(() => equipmentAction(g, action, params), pattern);
  assert.deepEqual(g.state, before, `${action} rejected operation mutated state`);
}
function battle(p, extra = {}) {
  return createBattle(p, [{ ...makeMonster('木桩', 60), hp: 1000000, maxHp: 1000000, atk: 80, ...extra }]);
}
function dealt(addons = {}, { cls = 'blademaster', action = 'attack', enemy = {}, roll = 0.5 } = {}) {
  const p = player(cls, addons);
  const b = battle(p, enemy);
  const hp = b.monsters[0].hp;
  withRandom(roll, () => takeTurn(p, b, action));
  return { damage: hp - b.monsters[0].hp, p, b };
}
function received(addons = {}, enemy = {}, roll = 0.5) {
  const p = player('blademaster', addons);
  const b = battle(p, enemy);
  const hp = p.hp;
  withRandom(roll, () => takeTurn(p, b, 'attack'));
  const damage = b.logs.filter((x) => x.text.includes('对你造成')).reduce((n, x) => n + Number(x.text.match(/造成(\d+)/)[1]), 0);
  return { damage, p, b, lost: hp - p.hp };
}

test('ten classes / 72 skills remain intact', () => {
  assert.equal(Object.keys(CLASSES).length, 10);
  assert.equal(Object.values(SKILLS).flat().length, 72);
  for (const cls of Object.keys(CLASSES)) {
    const p = createPlayer('初始角色', cls);
    assert.ok(!Object.hasOwn(p, 'charms'));
    for (const it of Object.values(p.equipment)) {
      assert.ok(matchesNamedEquip(it));
      for (const [key, value] of Object.entries(EQUIPMENT_DEFAULTS)) {
        if (key === 'socketLimit') assert.equal(it[key], it.slot === 'weapon' ? 2 : 4);
        else assert.deepEqual(it[key], value);
      }
    }
  }
});
test('migration only fills absent equipment fields and is idempotent', () => {
  const p = player();
  const it = p.equipment.weapon;
  for (const key of Object.keys(EQUIPMENT_DEFAULTS)) delete it[key];
  const oldStats = equipStats(it);
  const bag = legacyEquip('head', 35, 2, p.cls);
  bag.durability = 0; bag.bound = true; bag.sockets = ['gemHp1']; bag.rerolls = 8;
  p.bag.push(bag);
  const beforeBag = structuredClone(bag);
  const beforeItems = structuredClone(p.items);
  ensureEquipment(p);
  assert.deepEqual(equipStats(it), oldStats);
  assert.deepEqual(bag, beforeBag);
  assert.deepEqual(p.items, beforeItems);
  assert.ok(!Object.hasOwn(p, 'charms'));
  assert.notEqual(it.sockets, bag.sockets);
  const once = structuredClone(p);
  ensureEquipment(p);
  assert.deepEqual(p, once);
  it.bound = null;
  ensureEquipment(p);
  assert.equal(it.bound, null, 'migration must not overwrite existing invalid fields');
});
test('27 gem definitions and shop sources / 7 event definitions', () => {
  const families = ['Hp', 'Mp', 'Patk', 'Matk', 'Def', 'Mdef', 'Crit', 'AtkLevel', 'DefLevel'];
  const gems = Object.entries(ITEMS).filter(([, it]) => it.type === 'gem');
  assert.equal(gems.length, 27);
  for (const family of families) for (let tier = 1; tier <= 3; tier++) {
    const id = `gem${family}${tier}`;
    const gem = ITEMS[id];
    assert.ok(gem.value > 0 && gem.price > 0 && gem.desc && STAT_NAMES[gem.stat]);
    assert.ok(shopList('misc', 105).includes(id));
    const it = legacyEquip('weapon', 60, 0, 'blademaster');
    const old = equipStats(it)[gem.stat] || 0;
    it.sockets.push(id);
    assert.ok(Math.abs(equipStats(it)[gem.stat] - old - gem.value) < 0.001);
  }
  assert.ok(!shopList('misc', 1).includes('gemHp3'));
  for (const id of ['treasureKey', 'bronzeChest', 'goldChest', 'zongzi', 'bigZongzi', 'charmHp', 'charmMp']) {
    assert.equal(ITEMS[id].price, 0);
    assert.ok(ITEMS[id].name && ITEMS[id].type && ITEMS[id].lv && ITEMS[id].desc);
  }
  for (const id of ['socketStone', 'reforgeStone', 'upgradeStone']) assert.ok(shopList('misc', 1).includes(id));
  assert.equal(ITEMS.salvage.price, 0);
});
test('repair worn equipment / no free character healing', () => {
  const g = game(), it = g.p.equipment.weapon;
  it.durability = 0;
  const broken = equipStats(it).patk;
  const hp = g.p.hp - 30;
  g.p.hp = hp;
  const result = act(g, 'repair', it);
  assert.equal(it.durability, 100);
  assert.equal(equipStats(it).patk, broken * 2);
  assert.equal(g.p.hp, hp);
  assert.ok(result.gold > 0);
  reject(g, 'repair', { uid: it.uid }, /耐久已满/);
});
test('socket and unsocket preserve gem / stable hole indices', () => {
  const g = game(), it = packed(g);
  const count = g.p.items.gemHp1;
  const hp = equipStats(it).hp;
  act(g, 'socket', it, { gemId: 'gemHp1' });
  assert.equal(it.sockets[0], 'gemHp1');
  assert.equal(g.p.items.gemHp1, count - 1);
  assert.equal(equipStats(it).hp, hp + 60);
  assert.equal(g.p.items.socketStone, 19);
  act(g, 'socket', it, { gemId: 'gemMp1', index: 1 });
  const result = act(g, 'unsocket', it, { index: 0 });
  assert.deepEqual(it.sockets, [null, 'gemMp1']);
  assert.equal(g.p.items.gemHp1, count);
  assert.ok(result.gold > 0);
  act(g, 'socket', it, { gemId: 'gemHp1' });
  assert.deepEqual(it.sockets, ['gemHp1', 'gemMp1']);
});
test('socket validates gem, level, full capacity and each index', () => {
  const g = game(), it = packed(g, 2, 1);
  reject(g, 'socket', { uid: it.uid, gemId: 'hp1' }, /宝石/);
  reject(g, 'socket', { uid: it.uid, gemId: '__proto__' }, /宝石/);
  reject(g, 'socket', { uid: it.uid, gemId: 'gemPatk2' }, /达到/);
  for (const index of [-1, 4, 1, 0.5, '0', null]) reject(g, 'socket', { uid: it.uid, gemId: 'gemHp1', index }, /孔位|开孔/);
  for (let i = 0; i < 4; i++) act(g, 'socket', it, { gemId: 'gemHp1' });
  reject(g, 'socket', { uid: it.uid, gemId: 'gemHp1' }, /已满|开孔/);
  reject(g, 'socket', { uid: it.uid, gemId: 'gemHp1', index: 0 }, /已有宝石/);
  reject(g, 'unsocket', { uid: it.uid, index: 4 }, /孔位/);
  act(g, 'unsocket', it, { index: 0 });
  reject(g, 'unsocket', { uid: it.uid, index: 0 }, /没有宝石/);
});
test('reroll changes addons only, respects quality and forbids privileged overrides', () => {
  const g = game(), it = packed(g);
  it.refine = 7; it.sockets = ['gemHp1']; it.bound = true; it.durability = 43; it.addons = { patk: 1 };
  const before = structuredClone(it);
  withRandom(0.5, () => act(g, 'reroll', it));
  assert.notDeepEqual(it.addons, before.addons);
  const { addons, rerolls, ...rest } = it;
  const { addons: oldAddons, rerolls: oldRerolls, ...oldRest } = before;
  assert.deepEqual(rest, oldRest);
  assert.equal(rerolls, oldRerolls + 1);
  assert.equal(g.p.items.reforgeStone, 19);
  assert.equal(g.p.items.salvage, 19);
  reject(g, 'reroll', { uid: it.uid, addons: { patk: 1e7 } }, /参数/);
  reject(g, 'reroll', { uid: it.uid, q: 3 }, /参数/);
  const common = packed(g, 0);
  reject(g, 'reroll', { uid: common.uid }, /没有随机词条/);
});
test('upgrade preserves UID, refine, holes, quality, binding, durability, set and addons', () => {
  const g = game(), it = packed(g);
  it.refine = 8; it.sockets = ['gemHp1', null, 'gemMp1']; it.durability = 37; it.bound = true; it.rerolls = 5;
  const before = structuredClone(it);
  const result = act(g, 'upgrade', it);
  assert.equal(it.lv, 40);
  assert.equal(result.lv, 40);
  assert.ok(it.base.def > before.base.def);
  for (const key of ['uid', 'refine', 'sockets', 'q', 'bound', 'durability', 'setId', 'addons', 'rerolls', 'armorType']) assert.deepEqual(it[key], before[key]);
  assert.equal(it.upgrades, 1);
  assert.equal(g.p.items.upgradeStone, 19);
  assert.equal(g.p.items.salvage, 18);
  reject(g, 'upgrade', { uid: it.uid, lv: 105 }, /参数/);
  g.p.lv = 42;
  act(g, 'upgrade', it);
  assert.equal(it.lv, 42);
  reject(g, 'upgrade', { uid: it.uid }, /当前角色等级上限/);
  g.p.lv = 105; it.lv = 103;
  act(g, 'upgrade', it);
  assert.equal(it.lv, 105);
  reject(g, 'upgrade', { uid: it.uid }, /上限/);
});
test('upgrade keeps foreign weapon class, armor category and ring attack type', () => {
  const g = game();
  g.state.player = player('wizard');
  for (const slot of ['weapon', 'body', 'ring1']) {
    const it = legacyEquip(slot, 35, 2, 'blademaster');
    g.p.bag.push(it);
    act(g, 'upgrade', it);
    assert.equal(it.lv, 40);
    if (slot === 'weapon') { assert.equal(it.cls, 'blademaster'); assert.ok(it.base.patk); assert.ok(!it.base.matk); }
    if (slot === 'body') assert.equal(it.armorType, 'heavy');
    if (slot === 'ring1') { assert.ok(it.base.patk); assert.ok(!it.base.matk); }
  }
});
test('cloned Game operations do not leak charges, rolls or migration into original', () => {
  const original = game(), it = packed(original);
  delete it.bound;
  const before = structuredClone(original.state);
  const clone = game(); clone.state = structuredClone(original.state);
  act(clone, 'reroll', clone.p.bag[0]);
  assert.deepEqual(original.state, before);
  assert.ok(clone.p.gold < original.p.gold);
  assert.equal(clone.p.bag[0].rerolls, 1);
  assert.equal(clone.p.bag[0].bound, false);
});
test('all actions reject wrong UID without migration or mutation', () => {
  const g = game();
  delete g.p.equipment.weapon.bound;
  for (const action of ['repair', 'socket', 'unsocket', 'reroll', 'upgrade', 'decompose', 'bind']) {
    const params = { uid: 'doesnotexist' };
    if (action === 'socket') params.gemId = 'gemHp1';
    if (action === 'unsocket') params.index = 0;
    if (action === 'decompose' || action === 'bind') params.confirm = true;
    reject(g, action, params, /不存在/);
  }
  reject(g, 'repair', { uid: '' }, /UID/);
  const dup = structuredClone(g.p.equipment.weapon);
  g.p.bag.push(dup);
  reject(g, 'repair', { uid: dup.uid }, /UID重复/);
});
test('missing gold / every required material rejects before RNG and mutation', () => {
  for (const [action, missing] of [['repair', null], ['socket', null], ['reroll', null], ['upgrade', null], ['unsocket', null], ['socket', 'socketStone'], ['socket', 'gemHp1'], ['reroll', 'reforgeStone'], ['reroll', 'salvage'], ['upgrade', 'upgradeStone'], ['upgrade', 'salvage']]) {
    const g = game(), it = packed(g);
    it.durability = 40;
    if (action === 'unsocket') it.sockets = ['gemHp1'];
    if (missing) g.p.items[missing] = 0;
    else g.p.gold = 0;
    let draws = 0;
    const old = Math.random;
    Math.random = () => { draws++; return 0.5; };
    try {
      reject(g, action, { uid: it.uid, ...(action === 'socket' ? { gemId: 'gemHp1' } : {}), ...(action === 'unsocket' ? { index: 0 } : {}) }, /不足/);
      assert.equal(draws, 0);
    } finally { Math.random = old; }
  }
});
test('bind/decompose confirmations and worn/bound/locked protections', () => {
  const g = game(), it = packed(g);
  reject(g, 'bind', { uid: it.uid }, /确认/);
  reject(g, 'bind', { uid: it.uid, confirm: 'true' }, /确认/);
  act(g, 'bind', it, { confirm: true });
  assert.equal(it.bound, true);
  reject(g, 'decompose', { uid: it.uid, confirm: true }, /绑定/);
  reject(g, 'bind', { uid: it.uid, confirm: true }, /已经绑定/);
  reject(g, 'decompose', { uid: g.p.equipment.weapon.uid, confirm: true }, /卸下/);
  const locked = packed(g); locked.locked = true;
  reject(g, 'decompose', { uid: locked.uid, confirm: true }, /锁定/);
  const unbound = packed(g);
  reject(g, 'decompose', { uid: unbound.uid }, /确认/);
  act(g, 'bind', g.p.equipment.weapon, { confirm: true });
  assert.equal(g.p.equipment.weapon.bound, true);
});
test('decompose yields salvage and returns every socketed gem', () => {
  const g = game(), it = packed(g);
  it.refine = 6; it.sockets = ['gemHp1', null, 'gemHp1', 'gemMp1'];
  const result = act(g, 'decompose', it, { confirm: true });
  assert.equal(g.p.bag.length, 0);
  assert.equal(result.received.salvage, 9);
  assert.equal(g.p.items.salvage, 29);
  assert.equal(g.p.items.gemHp1, 10);
  assert.equal(g.p.items.gemMp1, 9);
  assert.equal(result.gold, 0);
});
test('inventory return limits reject before charging', () => {
  const g = game(), it = packed(g);
  it.sockets = ['gemHp1']; g.p.items.gemHp1 = 1e7;
  reject(g, 'unsocket', { uid: it.uid, index: 0 }, /上限/);
  reject(g, 'decompose', { uid: it.uid, confirm: true }, /上限/);
});
test('all operations forbidden during battle or outside a city', () => {
  const g = game(), it = packed(g);
  g.state.battle = battle(g.p);
  for (const action of ['repair', 'socket', 'unsocket', 'reroll', 'upgrade', 'decompose', 'bind']) reject(g, action, { uid: it.uid }, /战斗中/);
  g.state.battle = null; g.p.location = 'invalidZone';
  reject(g, 'repair', { uid: it.uid }, /城镇/);
});
test('durability zero halves base, refine, addons and gems / wear only affects equipped', () => {
  const p = player('blademaster', { crit: 0.02, accuracy: 0.1 });
  const it = p.equipment.weapon;
  it.refine = 5; it.sockets = ['gemHp1'];
  const fresh = equipStats(it);
  it.durability = 0;
  for (const [key, value] of Object.entries(fresh)) assert.ok(Math.abs(equipStats(it)[key] - value * 0.5) < 0.001);
  it.durability = 1;
  const bag = legacyEquip('head', 35, 0, p.cls); p.bag.push(bag);
  const atk = stats(p).atk;
  assert.equal(wearEquipment(p), 1);
  assert.equal(it.durability, 0);
  assert.ok(stats(p).atk < atk);
  assert.equal(bag.durability, 100);
  wearEquipment(p);
  assert.equal(it.durability, 0);
});
test('three real sets have cumulative 2/4/5 thresholds, broken pieces do not count', () => {
  for (const [id, set] of Object.entries(EQUIPMENT_SETS)) {
    const cls = Object.keys(CLASSES).find((key) => CLASSES[key].armor === set.armor);
    const p = player(cls);
    p.equipment = {};
    ARMOR_SLOTS.forEach((slot, i) => {
      const it = legacyEquip(slot, 35, 2, cls);
      assert.equal(it.setId, id);
      it.addons = {};
      p.equipment[slot] = it;
      const bonuses = setStats(p.equipment);
      const expected = {};
      for (const [need, values] of Object.entries(set.bonuses)) if (i + 1 >= Number(need)) for (const [key, value] of Object.entries(values)) expected[key] = +((expected[key] || 0) + value).toFixed(3);
      assert.deepEqual(bonuses, expected);
    });
    const st = stats(p);
    p.equipment.head.durability = 0;
    assert.notDeepEqual(setStats(p.equipment), Object.assign({}, setStats({ ...p.equipment, head: { ...p.equipment.head, durability: 100 } })));
    assert.ok(stats(p).power < st.power || stats(p).channel < st.channel || stats(p).speed < st.speed);
  }
});
test('set effects reach damage, defense, regeneration and cooldown calculations', () => {
  for (const [id, cls] of [['guardian', 'blademaster'], ['hunter', 'archer'], ['arcane', 'wizard']]) {
    const p = player(cls);
    for (const slot of ARMOR_SLOTS) { p.equipment[slot] = legacyEquip(slot, 35, 2, cls); p.equipment[slot].addons = {}; }
    const plain = structuredClone(p);
    for (const it of Object.values(plain.equipment)) it.setId = null;
    p.hp = stats(p).hp; plain.hp = stats(plain).hp;
    const b = battle(p, { atk: 500 }), pb = battle(plain, { atk: 500 });
    withRandom(0.5, () => { takeTurn(p, b, 'attack'); takeTurn(plain, pb, 'attack'); });
    if (id === 'guardian') {
      const amount = (x) => Number(x.logs.find((row) => row.text.includes('对你造成')).text.match(/造成(\d+)/)[1]);
      assert.ok(amount(b) < amount(pb));
      assert.ok(stats(p).hpRegen > stats(plain).hpRegen);
    } else {
      assert.ok(b.monsters[0].hp < pb.monsters[0].hp);
      if (id === 'arcane') assert.ok(skillCooldown(p, b, 'wz3') < skillCooldown(plain, pb, 'wz3'));
    }
  }
});
test('fractional accessory base stats survive refinement', () => {
  const it = legacyEquip('neck', 35, 0, 'blademaster');
  it.base = { accuracy: 0.15, penetrationM: 0.08, channel: 0.1 };
  it.refine = 1;
  assert.deepEqual(equipStats(it), { accuracy: 0.158, penetrationM: 0.084, channel: 0.105 });
});
test('physical/magic attack and critical gems produce actual damage', () => {
  for (const [cls, id] of [['blademaster', 'gemPatk1'], ['wizard', 'gemMatk1']]) {
    const p = player(cls), b = battle(p);
    const base = dealt({}, { cls }).damage;
    p.equipment.weapon.sockets = [id];
    withRandom(0.5, () => takeTurn(p, b, 'attack'));
    assert.ok(1000000 - b.monsters[0].hp > base);
  }
  assert.ok(dealt({ crit: 0.75 }, { roll: 0.5 }).damage > dealt().damage);
});
test('HP/MP and physical/magic defense gems alter resources and received damage', () => {
  const p = player();
  const base = stats(p);
  p.equipment.weapon.sockets = ['gemHp1', 'gemMp1', 'gemDef1', 'gemMdef1'];
  const gemmed = stats(p);
  assert.equal(gemmed.hp - base.hp, 60);
  assert.equal(gemmed.mp - base.mp, 40);
  assert.equal(gemmed.def - base.def, 10);
  assert.equal(gemmed.mdef - base.mdef, 10);
  assert.ok(received({ def: 100 }).damage < received().damage);
  assert.ok(received({ mdef: 100 }, { type: 'magic' }).damage < received({}, { type: 'magic' }).damage);
});
test('accuracy combines with both sides evasion', () => {
  assert.equal(dealt({}, { enemy: { evasion: 0.8 } }).damage, 0);
  assert.ok(dealt({ accuracy: 3 }, { enemy: { evasion: 0.8 } }).damage > 0);
  assert.equal(received({ dodge: 0.5 }, {}, 0.3).damage, 0);
  assert.ok(received({ dodge: 0.5 }, { accuracy: 4 }, 0.3).damage > 0);
});
test('critical multiplier base two / bonus increases critical damage', () => {
  assert.equal(stats(player()).critDamage, 2);
  const base = dealt({}, { roll: 0.02 }).damage;
  const enhanced = dealt({ critDamage: 1 }, { roll: 0.02 }).damage;
  assert.ok(enhanced > base * 1.45);
  assert.equal(stats(player('blademaster', { critDamage: 100 })).critDamage, 5);
});
test('attack and defense levels modify damage in both directions', () => {
  const base = dealt().damage;
  assert.ok(dealt({ attackLevel: 30 }).damage > base);
  assert.ok(dealt({}, { enemy: { defenseLevel: 30 } }).damage < base);
  assert.ok(received({ defenseLevel: 30 }).damage < received().damage);
  assert.ok(received({}, { attackLevel: 30 }).damage > received().damage);
  const p = player(); p.equipment.weapon.sockets = ['gemAtkLevel3', 'gemDefLevel3'];
  assert.equal(stats(p).attackLevel, 4);
  assert.equal(stats(p).defenseLevel, 4);
});
test('physical and magical penetration affect only matching defense', () => {
  const enemy = { def: 800, mdef: 800 };
  const phys = dealt({}, { enemy }).damage;
  assert.ok(dealt({ penetrationP: 0.5 }, { enemy }).damage > phys);
  assert.equal(dealt({ penetrationM: 0.5 }, { enemy }).damage, phys);
  const magic = dealt({}, { cls: 'wizard', enemy }).damage;
  assert.ok(dealt({ penetrationM: 0.5 }, { cls: 'wizard', enemy }).damage > magic);
  assert.equal(dealt({ penetrationP: 0.5 }, { cls: 'wizard', enemy }).damage, magic);
  assert.ok(received({}, { penetrationP: 0.5 }).damage > received().damage);
  assert.equal(stats(player('blademaster', { penetrationP: 100 })).penetrationP, 0.8);
});
test('all five resistances reduce elemental skill and enemy damage / wrong element does not', () => {
  const skills = [['metal', 'cleric', 'cl1'], ['wood', 'venomancer', 'vm1'], ['water', 'wizard', 'wz2'], ['fire', 'wizard', 'wz1'], ['earth', 'wizard', 'wz4']];
  for (const [elem, cls, id] of skills) {
    const base = dealt({}, { cls, action: `skill:${id}` }).damage;
    const resisted = dealt({}, { cls, action: `skill:${id}`, enemy: { [`${elem}Res`]: 0.5 } }).damage;
    assert.ok(resisted < base * 0.6, elem);
    const damage = received({}, { type: 'magic', elem }).damage;
    assert.ok(received({ [`${elem}Res`]: 0.5 }, { type: 'magic', elem }).damage < damage * 0.6, elem);
  }
  assert.equal(dealt({}, { cls: 'wizard', action: 'skill:wz1', enemy: { waterRes: 0.8 } }).damage, dealt({}, { cls: 'wizard', action: 'skill:wz1' }).damage);
  assert.equal(received({ fireRes: 0.8 }).damage, received().damage);
});
test('elemental DOT snapshots penetration/levels and honors resistance', () => {
  function tick(addons, enemy) {
    const p = player('venomancer', addons), b = battle(p, { ...enemy, statuses: [{ kind: 'stun', turns: 20 }] });
    withRandom(0.5, () => takeTurn(p, b, 'skill:vm1'));
    p.equipment.weapon.addons = {};
    const before = b.monsters[0].hp;
    withRandom(0.5, () => takeTurn(p, b, 'defend'));
    return before - b.monsters[0].hp;
  }
  assert.ok(tick({ attackLevel: 50, penetrationM: 0.5 }, {}) > tick({}, {}));
  assert.ok(tick({}, { woodRes: 0.5 }) < tick({}, {}));
});
test('speed changes basic combo only / fractional hit chance / hard cap three', () => {
  const baseline = dealt().damage;
  assert.equal(dealt({ speed: 1 }).damage, baseline * 2);
  assert.equal(dealt({ speed: 100 }).damage, baseline * 3);
  assert.ok(dealt({ speed: 0.5 }, { roll: 0.4 }).damage > dealt({}, { roll: 0.4 }).damage);
  assert.equal(dealt({ speed: 2 }, { action: 'skill:bm1' }).damage, dealt({}, { action: 'skill:bm1' }).damage);
});
test('channel shortens cooldown with actual mana/chi cost and no invalid action ticking', () => {
  const p = player('blademaster', { channel: 0.5 }), b = battle(p);
  assert.equal(skillCooldown(p, b, 'bm2'), 2);
  const mp = p.mp;
  withRandom(0.5, () => takeTurn(p, b, 'skill:bm2'));
  assert.equal(b.cooldowns.bm2, 2);
  assert.equal(p.mp, mp - 14 + stats(p).mpRegen);
  const before = structuredClone(p), round = b.round;
  takeTurn(p, b, 'skill:bm2');
  assert.deepEqual(p, before);
  assert.equal(b.round, round);
  assert.equal(b.cooldowns.bm2, 2);
  withRandom(0.5, () => { takeTurn(p, b, 'defend'); takeTurn(p, b, 'defend'); });
  assert.equal(canUseSkill(p, b, 'bm2'), null);
  assert.equal(skillCooldown(player(), null, 'bm2'), 3);
  assert.equal(stats(player('blademaster', { channel: 100 })).channel, 0.75);
});
test('per-round HP/MP regen applies, clamps, and does not revive dead players', () => {
  const p = player('blademaster', { hpRegen: 14, mpRegen: 10 });
  p.hp -= 100; p.mp -= 100;
  const beforeHp = p.hp, beforeMp = p.mp;
  const b = battle(p, { statuses: [{ kind: 'stun', turns: 20 }] });
  withRandom(0.5, () => takeTurn(p, b, 'attack'));
  assert.equal(p.hp, beforeHp + 15);
  assert.equal(p.mp, beforeMp + 11);
  p.hp = stats(p).hp - 1; p.mp = stats(p).mp - 1;
  withRandom(0.5, () => takeTurn(p, b, 'attack'));
  assert.equal(p.hp, stats(p).hp); assert.equal(p.mp, stats(p).mp);
  p.hp = 0;
  takeTurn(p, b, 'attack');
  assert.equal(p.hp, 0);
  assert.equal(b.result, 'lose');
});
test('charms consume existing stock at exact thresholds, log, exhaust and never generate', () => {
  const p = player(), st = stats(p);
  p.hp = Math.floor(st.hp * 0.5); p.mp = Math.floor(st.mp * 0.75);
  p.charms = { hp: 40, mp: 30 };
  const hp = p.hp, mp = p.mp;
  const b = battle(p, { statuses: [{ kind: 'stun', turns: 20 }] });
  withRandom(0.5, () => takeTurn(p, b, 'attack'));
  assert.equal(p.hp, hp + 40 + st.hpRegen);
  assert.equal(p.mp, mp + 30 + st.mpRegen);
  assert.deepEqual(p.charms, { hp: 0, mp: 0 });
  assert.equal(b.logs.filter((x) => x.text.includes('护符恢复')).length, 2);
  const q = player(), qb = battle(q);
  q.hp = Math.floor(stats(q).hp * 0.4);
  withRandom(0.5, () => takeTurn(q, qb, 'attack'));
  assert.ok(!Object.hasOwn(q, 'charms'));
  assert.ok(!qb.logs.some((x) => x.text.includes('护符恢复')));
});
test('charms above thresholds do not spend / trigger between enemy attacks / no resurrection', () => {
  const p = player(), st = stats(p);
  p.charms = { hp: 100000, mp: 100000 };
  p.hp = Math.floor(st.hp * 0.5) + 1; p.mp = Math.floor(st.mp * 0.75) + 1;
  const b = battle(p, { statuses: [{ kind: 'stun', turns: 10 }] });
  withRandom(0.5, () => takeTurn(p, b, 'attack'));
  assert.deepEqual(p.charms, { hp: 100000, mp: 100000 });
  p.hp = Math.floor(st.hp * 0.5) + 2;
  b.monsters[0].statuses = [];
  withRandom(0.5, () => takeTurn(p, b, 'attack'));
  assert.ok(p.charms.hp < 100000);
  assert.equal(p.hp, st.hp);
  const dead = player(); dead.hp = 1; dead.charms = { hp: 1, mp: 0 };
  const db = battle(dead, { atk: 100000 });
  withRandom(0.5, () => takeTurn(dead, db, 'attack'));
  assert.equal(db.result, 'lose');
  assert.equal(dead.hp, 0);
});
test('auto scoring uses speed/resistance/resources/cooldown and does not mutate state', () => {
  const p = player(), b = battle(p);
  p.skills = { bm1: 1 }; p.items = {};
  assert.equal(pickAutoAction(p, b).action, 'skill:bm1');
  p.equipment.weapon.addons.speed = 2;
  assert.equal(pickAutoAction(p, b).action, 'attack');
  const wizard = player('wizard'), wb = battle(wizard, { fireRes: 0.8 });
  wizard.skills = { wz1: 1, wz2: 1 }; wizard.items = {};
  assert.equal(pickAutoAction(wizard, wb).action, 'skill:wz2');
  wb.cooldowns.wz2 = 2;
  assert.notEqual(pickAutoAction(wizard, wb).action, 'skill:wz2');
  wizard.mp = 0;
  assert.equal(pickAutoAction(wizard, wb).action, 'attack');
  p.hp = Math.floor(stats(p).hp * 0.4); p.mp = 0;
  p.charms = { hp: 100000, mp: 100000 }; p.items = { hp4: 3, mp4: 3 };
  const before = structuredClone({ p, b });
  assert.equal(pickAutoAction(p, b).action, 'attack');
  assert.deepEqual({ p, b }, before);
});
test('all ten classes have a finite autonomous combat loop with new stats', () => {
  for (const cls of Object.keys(CLASSES)) {
    const p = player(cls, { accuracy: 0.2, attackLevel: 5, defenseLevel: 5, channel: 0.15, hpRegen: 5, mpRegen: 6 });
    p.charms = { hp: 5000, mp: 5000 };
    const b = battle(p, { hp: 2200, maxHp: 2200, atk: 40 });
    for (let i = 0; i < 120 && !b.result; i++) {
      const choice = pickAutoAction(p, b);
      const round = b.round;
      withRandom(0.5, () => takeTurn(p, b, choice.action, choice.targetId));
      assert.ok(b.round > round || b.result, `${cls} selected invalid action ${choice.action}`);
    }
    assert.equal(b.result, 'win', cls);
    assert.ok(p.charms.hp <= 5000 && p.charms.mp <= 5000);
  }
});

for (const [name, fn] of tests) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}\n${error.stack}`); process.exitCode = 1; }
}
console.log(`Equipment/combat: ${passed}/${tests.length} groups passed.`);
