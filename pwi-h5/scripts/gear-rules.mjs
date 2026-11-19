import assert from 'node:assert/strict';
import { Game, validateSave } from '../src/core/game.js';
import { CLASSES, SKILLS } from '../src/data/classes.js';
import { GEAR_RULES, gearSpec, matchesGearSpec, allowedWeaponClasses } from '../src/data/gear-specs.js';
import { ITEMS, makeEquip, equipStats, equipShop, refineGain, refinePlan, REFINE_RATE, REFINE_BONUS } from '../src/data/items.js';
import { NAMED_EQUIPMENT, TUTORIAL_LEVELS, namedSpec, matchesNamedEquip } from '../src/data/named-equipment.js';
import { PRODUCTION_SKILLS, PRODUCTION_LEVELS, QIANKUN_TRANSFER_COSTS, MACHINE_RECIPE, LUNAR_MATERIAL_IDS, getProductionRecipes, getProductionRecipe, gemRequiredGrade } from '../src/data/production.js';
import { productionAction, getProductionCatalog } from '../src/core/production.js';
import { equipmentAction, validateEquipment } from '../src/core/equipment.js';
import { stats, BAG_LIMIT } from '../src/core/model.js';
import { createBattle, takeTurn, canUseSkill } from '../src/core/combat.js';
import { ZONES, DUNGEONS, DUNGEON_DAILY } from '../src/data/world.js';
import { ATLAS_NODES, ATLAS_REGIONS, regionOf, routeTo } from '../src/data/atlas.js';

// Controlled imported domain fixtures, not naturally earned levels/resources.
let passed = 0, total = 0, combinations = 0;
const failures = [];
const originalRandom = Math.random;
function test(name, fn) {
  total++;
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}\n${error.stack}`); }
  finally { Math.random = originalRandom; }
}
function random(value, fn) {
  const previous = Math.random; Math.random = () => value;
  try { return fn(); } finally { Math.random = previous; }
}
function fixture(cls = 'blademaster') {
  const g = new Game(); g.start('规则夹具', cls);
  g.p.lv = 105; g.p.gold = 1e7; g.p.cult = 0;
  g.p.attrs = { str: 1000, dex: 1000, mag: 1000, con: 1000 };
  g.p.equipment = {}; g.p.bag = [];
  g.p.items = Object.fromEntries(Object.keys(ITEMS).map((id) => [id, 10000]));
  g.p.production = Object.fromEntries(Object.keys(PRODUCTION_SKILLS).map((skill) => [skill, { level: 6, exp: 0 }]));
  g.p.hp = stats(g.p).hp; g.p.mp = stats(g.p).mp; return g;
}
function reject(g, fn, pattern) {
  const before = structuredClone(g.state);
  assert.throws(fn, pattern); assert.deepEqual(g.state, before, 'rejection mutated live state');
}
function legacy(it) {
  const copy = structuredClone(it);
  for (const key of ['ruleVersion', 'series', 'weaponType', 'wear', 'ranges', 'stars', 'attackType', 'origin']) delete copy[key];
  copy.socketLimit = 4; return copy;
}
const act = (g, action, it, params = {}) => equipmentAction(g, action, { uid: it.uid, ...params });
const produce = (g, recipeId, params = {}) => productionAction(g, 'produce', { recipeId, confirm: true, ...params });
const slots = ['weapon', 'head', 'body', 'legs', 'feet', 'wrist', 'cape', 'neck', 'waist', 'ring1'];
const qualityMult = [1, 1.1, 1.25, 1.45];
const part = { head: .6, body: 1, legs: .8, feet: .5, wrist: .4 };
const growth = { heavy: { def: [10, 6], mdef: [8, 2.5], hp: [10, 4] }, light: { def: [10, 4.2], mdef: [8, 3.6], hp: [10, 3] }, robe: { def: [10, 2.5], mdef: [8, 6], hp: [10, 2] } };
const requirement = { heavy: { str: [2.5, 3], dex: [.5, 1] }, light: { str: [1, 1], dex: [1, 1] }, robe: { str: [.5, 1], mag: [3, 3] }, agileWeapon: { str: [1, 1], dex: [3, 3] } };

for (const cls of Object.keys(CLASSES)) test(`42000 matrix/${cls}/105 levels x 10 slots x 4 qualities`, () => {
  for (let lv = 1; lv <= 105; lv++) for (const slot of slots) for (let q = 0; q <= 3; q++) {
    const spec = gearSpec(slot, lv, q, cls), it = makeEquip(slot, lv, q, cls);
    combinations++;
    assert.ok(matchesGearSpec(it), `${cls}/${slot}/${lv}/${q}`); validateEquipment(it);
    assert.equal(it.lv, lv); assert.equal(it.ruleVersion, 1); assert.equal(it.setId, null);
    assert.equal(it.grade, [4, 9, 19, 29, 39, 49, 59, 69, 79, 89, 98, 105].findIndex((max) => lv <= max) + 1);
    assert.equal(it.socketLimit, slot === 'weapon' ? 2 : slot in part ? 4 : 0);
    assert.deepEqual(it.sockets, Array(it.socketLimit && q >= 2 ? 1 : 0).fill(null));
    assert.equal(Object.keys(it.addons).length, q);
    for (const [key, value] of Object.entries(it.addons)) {
      const budget = spec.addonBudget[key]; assert.ok(budget && value >= budget.min && value <= budget.max);
      assert.equal(value, +value.toFixed(budget.precision));
      assert.ok(!['huntLevel', 'spirit', 'creation', 'hpPct'].includes(key));
      if (lv < 60) assert.ok(!['attackLevel', 'defenseLevel'].includes(key));
    }
    let profile;
    if (slot === 'weapon') {
      const type = GEAR_RULES.weapons[it.weaponType]; profile = type.wear;
      const mean = Math.round((10 + lv * 4) * qualityMult[q]);
      assert.equal(it.base[type.attackType === 'phys' ? 'patk' : 'matk'], mean);
      if (type.attackType === 'magic') assert.equal(it.base.patk, Math.round(mean * .25));
      else assert.ok(!Object.hasOwn(it.base, 'matk'));
      for (const [key, range] of Object.entries(it.ranges)) {
        assert.equal(range[0] + range[1], it.base[key] * 2); assert.ok(range[0] >= 1 && range[0] < range[1]);
      }
      assert.equal(it.cls, cls);
    } else if (slot in part) {
      profile = it.armorType;
      for (const [key, [initial, perLevel]] of Object.entries(growth[profile])) assert.equal(it.base[key], Math.round((initial + lv * perLevel) * part[slot] * qualityMult[q]));
      assert.equal(it.cls, null);
    } else {
      const accessoryGrowth = { cape: { def: [5, 2] }, neck: { hp: [20, 8], mdef: [5, 2] }, waist: { hp: [25, 10], def: [3, 1] } }[slot];
      if (accessoryGrowth) for (const [key, [initial, perLevel]] of Object.entries(accessoryGrowth)) assert.equal(it.base[key], Math.round((initial + lv * perLevel) * qualityMult[q]));
      else assert.equal(it.base[CLASSES[cls].atkType === 'phys' ? 'patk' : 'matk'], Math.round((3 + lv * 1.6) * qualityMult[q]));
    }
    const wear = { lv };
    if (profile) for (const [key, [perLevel, initial]] of Object.entries(requirement[profile])) wear[key] = Math.ceil(perLevel * (lv - 1)) + initial;
    assert.deepEqual(it.wear, wear); assert.deepEqual(it.base, spec.base);
  }
});

for (const armorType of Object.keys(growth)) test(`whole armor budget/${armorType}`, () => {
  for (const lv of [1, 35, 55, 105]) for (let q = 0; q <= 3; q++) {
    const pieces = Object.keys(part).map((slot) => gearSpec(slot, lv, q, 'wizard', { armorType }));
    for (const [key, [initial, perLevel]] of Object.entries(growth[armorType])) {
      const sum = pieces.reduce((n, it) => n + it.base[key], 0);
      const whole = (initial + lv * perLevel) * 3.3 * qualityMult[q];
      assert.ok(Math.abs(sum - whole) <= 2.5);
    }
  }
});
for (const [type, profile] of Object.entries(GEAR_RULES.weapons)) test(`weapon profiles/classes/${type}`, () => {
  assert.deepEqual(allowedWeaponClasses(type), ['dagger', 'soulsphere'].includes(type) ? [type === 'dagger' ? 'assassin' : 'psychic'] : Object.keys(CLASSES));
  for (const cls of Object.keys(CLASSES)) {
    if (!profile.classes.includes(cls)) { assert.throws(() => gearSpec('weapon', 35, 2, cls, { weaponType: type })); continue; }
    const it = makeEquip('weapon', 35, 2, cls, { weaponType: type }); assert.ok(matchesGearSpec(it));
    assert.equal(it.attackType, profile.attackType);
    const spec = gearSpec('weapon', 35, 2, cls, { weaponType: type });
    assert.ok(spec.addonPool.includes(profile.attackType === 'phys' ? 'patk' : 'matk'));
    assert.ok(!spec.addonPool.includes(profile.attackType === 'phys' ? 'matk' : 'patk'));
  }
});
for (const [series, line] of Object.entries(GEAR_RULES.seriesRules).filter(([id]) => id !== 'ordinary')) test(`supported series whole identity/${series}`, () => {
  for (const cls of Object.keys(CLASSES)) for (const lv of [1, 35, 55, 60, 65, 70, 80, 85, 90, 95, 99, 100, 105]) for (const slot of slots) for (let q = 0; q <= 3; q++) {
    const supported = line.slots.includes(slot) && Object.hasOwn(line.grades, lv) && q === line.q;
    if (!supported) assert.throws(() => gearSpec(slot, lv, q, cls, { series }));
    else {
      const it = makeEquip(slot, lv, q, cls, { series });
      assert.equal(it.series, series); assert.equal(it.grade, line.grades[lv]); assert.ok(matchesGearSpec(it)); validateEquipment(it);
      const forged = structuredClone(it); forged.lv++; assert.equal(matchesGearSpec(forged), false);
    }
  }
});
test('pure finite previews and exact production catalog bindings draw no RNG/create no UID/mutate nothing', () => {
  const g = fixture(); delete g.p.production; const before = structuredClone(g.state);
  Math.random = () => { throw new Error('Preview consumed RNG'); };
  for (const slot of slots) assert.ok(!Object.hasOwn(gearSpec(slot, 35, 2, g.p.cls), 'uid'));
  const shop = equipShop(g.p.cls, 35); assert.ok(shop.length > 0); assert.ok(shop.every((it) => it.ruleVersion === 2 && !Object.hasOwn(it, 'uid')));
  const expected = getProductionRecipes(g.p.cls), catalog = getProductionCatalog(g.p);
  assert.equal(catalog.recipes.length, expected.length);
  assert.deepEqual(catalog.recipes.map(({ id, templateId }) => [id, templateId]), expected.map(({ id, templateId }) => [id, templateId]));
  for (const recipe of catalog.recipes) {
    assert.equal(recipe.id, `named:${recipe.templateId}`);
    assert.ok(Object.hasOwn(NAMED_EQUIPMENT, recipe.templateId));
    assert.deepEqual(recipe.previews, [namedSpec(recipe.templateId)]);
    assert.ok(recipe.previews.every((spec) => !Object.hasOwn(spec, 'uid')));
  }
  catalog.recipes[0].materials[Object.keys(catalog.recipes[0].materials)[0]] = -99;
  catalog.skills.blacksmith.level = 6; catalog.materials.ore1.name = 'changed';
  assert.deepEqual(g.state, before); assert.notEqual(getProductionCatalog(g.p).materials.ore1.name, 'changed');
});
const mutations = {
  base: x => x.base.patk++, name: x => x.name += 'fake', grade: x => x.grade++, level: x => x.lv++, quality: x => x.q--,
  wear: x => x.wear.str = 0, range: x => x.ranges.patk[1]++, series: x => x.series = 'twilight', stars: x => x.stars = 1,
  attackType: x => x.attackType = 'magic', weaponType: x => x.weaponType = 'bow', class: x => x.cls = 'constructor',
  set: x => x.setId = 'guardian', addonOverflow: x => { const key = Object.keys(x.addons)[0]; x.addons[key] = 1e6; },
  addonMissing: x => x.addons = {}, addonUnknown: x => x.addons.creation = 1, addonNaN: x => x.addons[Object.keys(x.addons)[0]] = NaN,
  ruleMissing: x => delete x.ruleVersion, ruleDowngrade: x => x.ruleVersion = 0,
  socketLimit: x => x.socketLimit = 4, invalidGem: x => x.sockets = ['gemHp1'], tooManyHoles: x => x.sockets = [null, null, null],
  rerolls: x => x.rerolls = 1, upgrades: x => x.upgrades = 1, templateSpoof: x => x.templateId = 'axe19a',
};
for (const [name, mutate] of Object.entries(mutations)) test(`snapshot/API-equipment forgery rejection/${name}`, () => {
  const g = fixture(); const it = makeEquip('weapon', 60, 3, g.p.cls); g.p.bag = [it]; validateSave(g.state);
  const invalid = structuredClone(g.state); mutate(invalid.player.bag[0]); assert.throws(() => validateSave(invalid));
  g.p.bag = invalid.player.bag; reject(g, () => act(g, 'repair', g.p.bag[0]));
});
test('generic new reroll/upgrade reject alongside explicit legacy compatibility', () => {
  const g = fixture(); const it = makeEquip('body', 35, 2, g.p.cls); g.p.bag.push(it);
  for (const action of ['reroll', 'upgrade']) reject(g, () => act(g, action, it), /新制造/);
  const old = legacy(it); old.uid += 'old'; old.sockets = []; g.p.bag.push(old);
  random(.5, () => act(g, 'reroll', old)); assert.equal(old.rerolls, 1);
  act(g, 'upgrade', old); assert.equal(old.lv, 40); assert.equal(old.upgrades, 1); validateSave(g.state);
});
for (const slot of slots) test(`wear actual deficits/source does not self-support/${slot}`, () => {
  const g = fixture('wizard'), it = makeEquip(slot, 60, 0, 'blademaster'); g.p.bag.push(it);
  g.p.lv = 59; reject(g, () => g.equip(it.uid)); g.p.lv = 60;
  for (const [key, need] of Object.entries(it.wear).filter(([key]) => key !== 'lv')) {
    g.p.attrs[key] = need - 1;
    const source = legacy(makeEquip(slot, 60, 0, g.p.cls)); source.addons = { [key]: 1000 }; g.p.equipment[slot] = source;
    reject(g, () => g.equip(it.uid), /穿戴条件/); delete g.p.equipment[slot]; g.p.attrs[key] = need;
  }
  g.equip(it.uid); assert.equal(g.p.equipment[slot].uid, it.uid); validateSave(g.state);
});
for (const cls of Object.keys(CLASSES)) test(`default odd weapon skill compatibility/${cls}`, () => {
  const g = fixture(cls); g.p.equipment.weapon = makeEquip('weapon', 60, 0, cls);
  g.p.cult = 8; g.p.chi = 300; g.p.skills = Object.fromEntries(SKILLS[cls].filter((s) => s.lv <= 60).map((s) => [s.id, 1]));
  for (const skill of SKILLS[cls].filter((s) => s.lv <= 60 && !['passive', 'petheal'].includes(s.kind))) {
    const p = structuredClone(g.p), b = createBattle(p, [{ name: '兼容靶', lv: 1, hp: 1e8, maxHp: 1e8, atk: 0, statuses: [{ kind: 'stun', turns: 99 }] }]);
    if (skill.source.weapons.supportedTypes.includes(CLASSES[cls].weapon)) assert.equal(canUseSkill(p, b, skill.id), null, `${cls}/${skill.id}`);
    else assert.match(canUseSkill(p, b, skill.id), /武器不支持/, `${cls}/${skill.id}`);
  }
});
for (const cls of Object.keys(CLASSES)) test(`skill source permits supported types and rejects worn incompatible/${cls}`, () => {
  const skill = SKILLS[cls].find((s) => s.kind === 'dmg');
  for (const type of Object.keys(GEAR_RULES.weapons)) {
    const owner = allowedWeaponClasses(type)[0], it = makeEquip('weapon', 60, 0, owner, { weaponType: type });
    const g = fixture(cls); g.p.bag = [it]; g.p.skills = { [skill.id]: 1 };
    if (!allowedWeaponClasses(type).includes(cls)) {
      reject(g, () => g.equip(it.uid), /专属武器/); continue;
    }
    g.equip(it.uid); assert.equal(g.p.equipment.weapon.uid, it.uid, 'ordinary generated class must not be a wear lock');
    const b = createBattle(g.p, [{ name: '技能适配靶', lv: 1, hp: 1e8, maxHp: 1e8, atk: 0, statuses: [{ kind: 'stun', turns: 99 }] }]);
    if (skill.source.weapons.supportedTypes.includes(type)) {
      assert.equal(canUseSkill(g.p, b, skill.id), null); random(.5, () => takeTurn(g.p, b, `skill:${skill.id}`)); assert.equal(b.round, 1);
    } else {
      assert.match(canUseSkill(g.p, b, skill.id), /武器不支持/);
      const before = structuredClone(g.p), timers = structuredClone({ round: b.round, cooldowns: b.cooldowns, buffs: b.buffs, monsters: b.monsters });
      assert.equal(takeTurn(g.p, b, `skill:${skill.id}`), null); assert.deepEqual(g.p, before);
      assert.deepEqual({ round: b.round, cooldowns: b.cooldowns, buffs: b.buffs, monsters: b.monsters }, timers);
    }
  }
});
test('independent literal source examples bind exact finite templates and recipes', () => {
  const examples = [
    ['official:2d8855695daeb73911ea:0:1', { name: '★金鳞斩', slot: 'weapon', weaponType: 'axe', lv: 95, grade: 11,
      requirements: { str: 287, dex: 52, con: null, mag: null }, base: { patk: 1077 }, ranges: { patk: [646, 1508] },
      materials: [['碎片凝结体', 5], ['结晶凝结体', 1], ['精华凝结体', 1], ['自然精髓', 5]] }],
    ['official:645e40c39c6b495aa26f:2:1', { name: '★凤兮法袍', slot: 'body', armorType: 'robe', lv: 95, grade: 11,
      requirements: { str: 52, dex: null, con: null, mag: 146 }, base: { def: 188, mdef: 1685 }, ranges: {},
      materials: [['碎片凝结体', 3], ['结晶凝结体', 1], ['纯水精华', 2], ['火炎精华', 2], ['大地精华', 2], ['生命精华', 2], ['精铁精华', 5], ['自然精髓', 3]] }],
  ];
  for (const [templateId, expected] of examples) {
    const template = namedSpec(templateId);
    for (const key of ['name', 'slot', 'weaponType', 'armorType', 'lv', 'grade', 'requirements', 'base', 'ranges']) if (Object.hasOwn(expected, key)) assert.deepEqual(template[key], expected[key]);
    assert.deepEqual(template.materials.map(({ name, qty }) => [name, qty]), expected.materials);
    const recipe = getProductionRecipe(`named:${templateId}`, template.slot === 'weapon' ? 'barbarian' : 'wizard');
    assert.equal(recipe.templateId, templateId);
    assert.deepEqual(recipe.materials, Object.fromEntries(expected.materials.map(([name, qty]) => [LUNAR_MATERIAL_IDS[name], qty])));
  }
});
for (const roll of [.099999, .1, .99999]) test(`named production q is bookkeeping only/${roll}`, () => {
  const g = fixture(); const recipe = getProductionRecipes(g.p.cls).find((r) => r.series === 'local-tutorial' && r.slot === 'weapon' && r.lv === 1);
  const result = random(roll, () => produce(g, recipe.id));
  assert.equal(result.equipment.q, 0); assert.ok(matchesNamedEquip(result.equipment));
  assert.equal(result.equipment.templateId, recipe.templateId); assert.deepEqual(result.equipment.base, NAMED_EQUIPMENT[recipe.templateId].base);
});
for (const skill of Object.keys(PRODUCTION_SKILLS)) for (let level = 1; level < 6; level++) test(`five exact named crafts + level gate training/${skill}/${level}`, () => {
  const g = fixture();
  const recipe = getProductionRecipes(g.p.cls).find((entry) => entry.skill === skill && entry.series === 'local-tutorial' && entry.lv === 1);
  assert.ok(recipe); g.p.production[skill] = { level, exp: 0 }; const next = PRODUCTION_LEVELS[level];
  for (let i = 0; i < 5; i++) {
    reject(g, () => productionAction(g, 'train', { skill }), /经验/);
    random(.5, () => produce(g, recipe.id)); assert.equal(g.p.production[skill].exp, i + 1); g.p.bag = [];
  }
  g.p.lv = next.lv - 1; reject(g, () => productionAction(g, 'train', { skill }), /角色/); g.p.lv = next.lv;
  const gold = g.p.gold; productionAction(g, 'train', { skill });
  assert.deepEqual(g.p.production[skill], { level: level + 1, exp: 0 }); assert.equal(g.p.gold, gold - next.gold);
});
for (const cls of Object.keys(CLASSES)) test(`all finite production recipes/exact costs/UID/${cls}`, () => {
  const g = fixture(cls), recipes = getProductionRecipes(cls);
  const tutorialWeapons = ['dagger', 'soulsphere'].includes(CLASSES[cls].weapon) ? TUTORIAL_LEVELS.length : 1;
  assert.equal(recipes.filter((r) => r.series === 'local-tutorial').length, TUTORIAL_LEVELS.length * 9 + tutorialWeapons);
  assert.ok([16, 17, 18].includes(recipes.filter((r) => r.series === 'lunar').length));
  assert.ok(recipes.every((r) => ['local-tutorial', 'lunar'].includes(r.series)));
  assert.equal(new Set(recipes.map((r) => r.id)).size, recipes.length);
  for (const recipe of recipes) {
    assert.equal(recipe.id, `named:${recipe.templateId}`); assert.equal(recipe.from, null); assert.equal(recipe.inheritance, false);
    assert.ok(Object.hasOwn(NAMED_EQUIPMENT, recipe.templateId)); g.p.bag = [];
    const paid = structuredClone(g.p);
    g.p.gold = recipe.gold - 1; reject(g, () => produce(g, recipe.id), /金币/); g.p.gold = paid.gold;
    for (const [id, amount] of Object.entries(recipe.materials)) {
      g.p.items[id] = amount - 1; reject(g, () => produce(g, recipe.id), /不足/); g.p.items[id] = paid.items[id];
    }
    const before = structuredClone(g.p), result = random(.5, () => produce(g, recipe.id));
    assert.equal(g.p.gold, before.gold - recipe.gold); assert.deepEqual(result.consumed, recipe.materials);
    for (const [id, amount] of Object.entries(recipe.materials)) assert.equal(g.p.items[id], before.items[id] - amount);
    assert.equal(g.p.bag.length, 1); assert.ok(matchesNamedEquip(g.p.bag[0]));
    assert.equal(g.p.bag[0].templateId, recipe.templateId); assert.equal(g.p.bag[0].q, 0);
    assert.equal(g.p.production[recipe.skill].exp, before.production[recipe.skill].exp + 1); validateSave(g.state);
  }
});
for (const inherit of [false, true]) test(`retired Nirvana recipe absent and historical item preserved/inherit=${inherit}`, () => {
  const g = fixture(), old = makeEquip('weapon', 95, 3, g.p.cls, { series: 'lunar' });
  old.refine = 3; old.bound = true; old.durability = 37; old.sockets = ['gemPatk2', null]; g.p.bag = [old];
  assert.equal(getProductionRecipe('nirvana1-100-weapon', g.p.cls), null);
  assert.ok(!getProductionRecipes(g.p.cls).some((r) => /^(ordinary|twilight|lunar|nirvana)/.test(r.id)));
  let draws = 0; Math.random = () => { draws++; return .5; };
  reject(g, () => produce(g, 'nirvana1-100-weapon', { uid: old.uid, inherit }), /不存在/);
  assert.equal(draws, 0); assert.deepEqual(g.p.bag, [old]); validateSave(g.state);
});
for (const [name, mutate] of Object.entries({
  unconfirmed: (g, it, b) => b.confirm = false, badInherit: (g, it, b) => b.inherit = 'true', wrongUID: (g, it, b) => b.uid = 'absent',
  ordinaryHistorical: (g) => { g.p.bag[0] = makeEquip('weapon', 95, 3, g.p.cls); }, wrongTypeHistorical: (g) => { g.p.bag[0] = makeEquip('body', 95, 3, g.p.cls, { series: 'lunar' }); },
  locked: (g, it) => it.locked = true, worn: (g, it) => { g.p.bag = []; g.p.equipment.weapon = it; },
  duplicate: (g, it) => g.p.bag.push(structuredClone(it)), missingCrystal: g => g.p.items.rapture = 0, missingInheritance: g => g.p.items.qiankun = 0,
  poor: g => g.p.gold = 0, lowLevel: g => g.p.lv = 99, lowSkill: g => g.p.production.blacksmith.level = 5,
})) test(`retired Nirvana atomic rejection preserves historical equipment/${name}`, () => {
  const g = fixture(), it = makeEquip('weapon', 95, 3, g.p.cls, { series: 'lunar' }); it.refine = 3; g.p.bag = [it];
  const body = { recipeId: 'nirvana1-100-weapon', uid: it.uid, confirm: true, inherit: true }; mutate(g, it, body);
  const historical = structuredClone({ bag: g.p.bag, equipment: g.p.equipment });
  let draws = 0; Math.random = () => { draws++; return .5; };
  reject(g, () => productionAction(g, 'produce', body)); assert.equal(draws, 0);
  assert.deepEqual({ bag: g.p.bag, equipment: g.p.equipment }, historical);
});
test('full bag exact named root fails unchanged; retired predecessor cannot replace historical item', () => {
  const g = fixture(), recipe = getProductionRecipes(g.p.cls).find((r) => r.series === 'local-tutorial' && r.slot === 'weapon' && r.lv === 1);
  g.p.bag = Array.from({ length: BAG_LIMIT }, () => makeEquip('head', 1, 0, g.p.cls));
  Math.random = () => { throw new Error('Full bag consumed RNG'); };
  reject(g, () => produce(g, recipe.id), /背包/); Math.random = originalRandom;
  g.p.bag[37] = makeEquip('weapon', 95, 3, g.p.cls, { series: 'lunar' }); const historical = structuredClone(g.p.bag[37]);
  reject(g, () => produce(g, 'nirvana1-100-weapon', { uid: historical.uid }), /不存在/);
  assert.equal(g.p.bag.length, BAG_LIMIT); assert.deepEqual(g.p.bag[37], historical);
});
test('machine consumes accessible tier-1/2 recipe without equipment XP', () => {
  const g = fixture(), before = structuredClone(g.p); const result = productionAction(g, 'manufactureMachine');
  assert.deepEqual(result.consumed, MACHINE_RECIPE.materials); assert.equal(g.p.items.ttMachine, before.items.ttMachine + 1);
  assert.equal(g.p.gold, before.gold - 100); assert.deepEqual(g.p.production, before.production);
  g.p.items.ttMachine = 1e7; reject(g, () => productionAction(g, 'manufactureMachine'));
});
test('Qiankun exact +1 through +12 transfer cost table', () => {
  assert.deepEqual(QIANKUN_TRANSFER_COSTS, [0, 1, 5, 12, 28, 60, 80, 100, 150, 250, 400, 650, 1000]);
});
for (let level = 1; level <= 12; level++) test(`transfer clears source/overwrites target/+${level}`, () => {
  const g = fixture(), from = makeEquip('weapon', 60, 2, g.p.cls), to = makeEquip('body', 60, 2, g.p.cls);
  from.refine = level; to.refine = level - 1; g.p.bag = [from, to]; const before = structuredClone(g.p);
  const body = { fromUid: from.uid, toUid: to.uid, confirm: true };
  from.bound = true; reject(g, () => equipmentAction(g, 'transfer', body), /绑定/); from.bound = false;
  g.p.items.qiankun = QIANKUN_TRANSFER_COSTS[level] - 1; reject(g, () => equipmentAction(g, 'transfer', body), /不足/);
  g.p.items.qiankun = before.items.qiankun; equipmentAction(g, 'transfer', body);
  assert.equal(from.refine, 0); assert.equal(to.refine, level); assert.equal(g.p.items.qiankun, before.items.qiankun - QIANKUN_TRANSFER_COSTS[level]);
  assert.equal(g.p.gold, before.gold); reject(g, () => equipmentAction(g, 'transfer', body)); validateSave(g.state);
});
for (let level = 0; level < 12; level++) test(`refine aid rates/failures/consumption/+${level}`, () => {
  for (const aid of ['', 'tiangang', 'disha', 'qiankun']) for (const slot of ['weapon', 'body']) for (const success of [false, true]) {
    const g = fixture(), it = makeEquip(slot, 60, 0, g.p.cls); it.refine = level; g.p.equipment[slot] = it;
    const before = structuredClone(g.p), rate = Math.min(1, REFINE_RATE[level] + (aid === 'tiangang' ? .15 : aid === 'disha' ? .05 : 0));
    assert.equal(refinePlan(it, aid).rate, rate); random(success ? 0 : .999999, () => g.refine(slot, aid));
    assert.equal(it.refine, success ? level + 1 : aid === 'qiankun' ? level : aid === 'disha' ? Math.max(0, level - 1) : 0);
    assert.equal(g.p.gold, before.gold - ((level + 1) * 60 * 15 + 50));
    assert.equal(g.p.items.huanxian, before.items.huanxian - (slot === 'weapon' ? 2 : 1));
    if (aid) assert.equal(g.p.items[aid], before.items[aid] - 1);
  }
});
test('one-star dragon orb only guarantees +0 to +1', () => {
  const g = fixture(), it = makeEquip('weapon', 60, 0, g.p.cls); g.p.equipment.weapon = it;
  random(.99999, () => g.refine('weapon', 'dragonOrb1')); assert.equal(it.refine, 1);
  reject(g, () => g.refine('weapon', 'dragonOrb1'), /一星龙珠/);
});
for (const slot of slots) test(`punch before socket/caps/${slot}`, () => {
  const g = fixture(), it = makeEquip(slot, 60, 0, g.p.cls); g.p.bag = [it];
  if (!it.socketLimit) { reject(g, () => act(g, 'punch', it), /饰品/); return; }
  const gemId = slot === 'weapon' ? 'gemPatk1' : 'gemHp1';
  reject(g, () => act(g, 'socket', it, { gemId }), /先开孔/);
  for (let i = 0; i < it.socketLimit; i++) {
    const count = g.p.items.socketStone; act(g, 'punch', it);
    assert.equal(g.p.items.socketStone, count - it.grade * (i + 1)); assert.equal(it.sockets[i], null);
    const afterPunch = g.p.items.socketStone; act(g, 'socket', it, { gemId, index: i }); assert.equal(g.p.items.socketStone, afterPunch);
  }
  reject(g, () => act(g, 'punch', it), /上限/);
  reject(g, () => act(g, 'socket', it, { gemId, index: 0 }), /已有宝石/); validateSave(g.state);
});
for (const [id, gem] of Object.entries(ITEMS).filter(([, gem]) => gem.type === 'gem')) test(`gem family/grade not role level/${id}`, () => {
  assert.equal(gem.requiredGrade, [0, 1, 5, 8][gem.tier]); assert.equal(gemRequiredGrade(id, gem), gem.requiredGrade);
  const weapon = ['patk', 'matk', 'crit', 'attackLevel'].includes(gem.stat), slot = weapon ? 'weapon' : 'body';
  const g = fixture(), it = makeEquip(slot, [0, 1, 30, 60][gem.tier], 2, g.p.cls); g.p.bag = [it]; g.p.lv = 1;
  act(g, 'socket', it, { gemId: id }); assert.equal(it.sockets[0], id); validateEquipment(it);
  const wrong = makeEquip(weapon ? 'body' : 'weapon', 60, 2, g.p.cls); g.p.bag.push(wrong);
  reject(g, () => act(g, 'socket', wrong, { gemId: id }), /适配/);
  if (gem.tier > 1) {
    const low = makeEquip(slot, gem.tier === 2 ? 20 : 50, 2, g.p.cls); g.p.bag.push(low); g.p.lv = 105;
    reject(g, () => act(g, 'socket', low, { gemId: id }), /品/);
  }
});
test('unsocket and decompose return each actual gem exactly once', () => {
  const g = fixture(), it = makeEquip('body', 60, 2, g.p.cls); g.p.bag.push(it);
  act(g, 'socket', it, { gemId: 'gemHp1' }); const before = g.p.items.gemHp1;
  act(g, 'unsocket', it, { index: 0 }); assert.equal(g.p.items.gemHp1, before + 1);
  reject(g, () => act(g, 'unsocket', it, { index: 0 })); act(g, 'socket', it, { gemId: 'gemHp1' });
  const count = g.p.items.gemHp1, stones = g.p.items.huanxian; const result = act(g, 'decompose', it, { confirm: true });
  assert.equal(g.p.items.gemHp1, count + 1); assert.equal(result.received.gemHp1, 1); assert.equal(g.p.items.huanxian, stones + 5);
  reject(g, () => act(g, 'decompose', it, { confirm: true }));
});
for (const [cls, type] of [['wizard', 'wand'], ['wizard', 'axe'], ['blademaster', 'wand'], ['blademaster', 'blade']]) test(`mixed physical/magic actual combat ranges/${cls}/${type}`, () => {
  const g = fixture(cls), it = makeEquip('weapon', 60, 0, cls, { weaponType: type }); g.p.equipment.weapon = it;
  const unrefined = stats(g.p); it.refine = 12; const refined = stats(g.p), gain = refineGain(it);
  for (const key of ['patk', 'matk']) {
    assert.equal(refined[key] - unrefined[key], gain[key] || 0);
    assert.equal(refined[`${key}Max`] - refined[`${key}Min`], unrefined[`${key}Max`] - unrefined[`${key}Min`]);
  }
  assert.ok(REFINE_BONUS[12] > 0); assert.ok(Object.values(equipStats(it)).every(Number.isFinite));
  const damage = (rangeRoll) => {
    const p = structuredClone(g.p), b = createBattle(p, [{ name: '区间靶', lv: 1, hp: 1e8, maxHp: 1e8, atk: 0, def: 0, mdef: 0, statuses: [{ kind: 'stun', turns: 99 }] }]);
    const rolls = [.99, .99, rangeRoll]; Math.random = () => rolls.shift() ?? .99;
    takeTurn(p, b, 'attack'); assert.equal(b.round, 1); return 1e8 - b.monsters[0].hp;
  };
  const low = damage(0), high = damage(.99999); assert.ok(high >= low && low > 0);
  if (refined.atkMax > refined.atkMin) assert.ok(high > low, 'range endpoints must influence real damage');
  it.durability = 0; assert.ok(stats(g.p).atk <= refined.atk);
});
function bfs(from, to, p) {
  const enter = id => !p || p.lv >= ZONES[id].lv[0] - 5 && (!ZONES[id].minCult || p.cult >= ZONES[id].minCult);
  if (!enter(from) || !enter(to)) return null;
  const queue = [[from]], seen = new Set([from]);
  for (const path of queue) {
    if (path.at(-1) === to) return path;
    for (const next of ZONES[path.at(-1)].links) if (!seen.has(next) && enter(next)) { seen.add(next); queue.push([...path, next]); }
  }
  return null;
}
test('real names/reciprocal map/independent BFS eligible and blocked routes', () => {
  for (const [id, name] of Object.entries({ wanliu: '剑仙城', jiyu: '积羽城', wanhua: '万化城', xidao: '惊涛城', lingyuan: '灵犀城', jifeng: '飞来镇', wanjie: '寻梦港', f_wanjie: '夜哭岛', f_tongtian: '秘宝窟' })) assert.equal(ZONES[id].name, name);
  assert.deepEqual(Object.keys(ATLAS_NODES).sort(), Object.keys(ZONES).sort());
  for (const [id, z] of Object.entries(ZONES)) for (const next of z.links) assert.ok(ZONES[next]?.links.includes(id), `${id}/${next} not reciprocal`);
  for (const lv of [1, 5, 15, 30, 60, 90, 105]) for (const cult of [0, 9]) for (const from of Object.keys(ZONES)) for (const to of Object.keys(ZONES)) {
    const p = { lv, cult }, expected = bfs(from, to, p), actual = routeTo(from, to, p);
    assert.equal(actual?.length ?? null, expected?.length ?? null, `${from}/${to}/${lv}/${cult}`);
    if (actual) for (let i = 1; i < actual.length; i++) assert.ok(ZONES[actual[i - 1]].links.includes(actual[i]));
  }
  assert.equal(routeTo('wanliu', 'f_xianmo', { lv: 105, cult: 0 }), null);
});
test('万流城 region: hierarchy covers every zone once and official neighbours are linked', () => {
  const covered = ATLAS_REGIONS.flatMap((r) => r.zones);
  assert.deepEqual([...covered].sort(), Object.keys(ZONES).sort());
  assert.equal(new Set(covered).size, covered.length);
  for (const id of Object.keys(ZONES)) assert.ok(regionOf(id)?.zones.includes(id), id);
  assert.equal(ZONES.wl_city.name, '万流城'); assert.equal(ZONES.wl_city.type, 'city');
  for (const id of ['wl_fenxin', 'wl_cangmang', 'wl_changcheng', 'wl_jimo', 'wl_cigu']) assert.equal(regionOf(id).id, regionOf('wl_city').id);
  assert.ok(ZONES.f_xianmo.links.includes('wl_city'), '仙魔两界入口位于万流城归宗塔下');
  assert.ok(ZONES.jifeng.links.includes('wanhua'), '龙战之野东接万化城');
  assert.ok(ATLAS_NODES.wl_city.x < ATLAS_NODES.wanliu.x && ATLAS_NODES.wl_city.y < ATLAS_NODES.taoyuan.y, '万流城位于大陆西北');
  assert.ok(routeTo('jifeng', 'wl_city', { lv: 80, cult: 0 })?.at(-1) === 'wl_city');
});
for (const d of DUNGEONS) test(`every dungeon wave reward family/${d.id}`, () => {
  const g = fixture(); const beforeItems = structuredClone(g.p.items);
  // Controlled wounded monsters exercise the real resolver, not natural clears.
  for (let wave = 0; wave <= (d.waves || 3); wave++) {
    g.startDungeonWave(d, wave); g.battle.monsters.forEach((m, i) => m.hp = i ? 0 : 1);
    random(.1, () => assert.equal(g.turn('attack'), 'win'));
    if (d.rewardKind === 'materials') { assert.equal(g.p.bag.length, 0); assert.deepEqual(g.battle.rewards.loot, []); }
    if (wave < (d.waves || 3)) for (const id of d.rewardMaterials || []) assert.equal(g.p.items[id], beforeItems[id]);
  }
  assert.equal(g.p.clears[d.id], 1);
  if (d.rewardKind === 'materials') for (const id of d.rewardMaterials) assert.equal(g.p.items[id], beforeItems[id] + 4);
  else assert.ok(g.p.bag.some((it) => it.slot === 'weapon' && it.ruleVersion === 2 && it.q === 0
    && Object.hasOwn(NAMED_EQUIPMENT, it.templateId) && matchesNamedEquip(it)));
  assert.equal(g.p.items.highForgeSigil, beforeItems.highForgeSigil + (d.lv >= 75 ? 2 : 0));
});
test('level-60 machine has no tier-3 resource gate', () => {
  const g = fixture(); g.p.lv = 60; g.p.items.ore3 = 0; g.p.items.wood3 = 0;
  productionAction(g, 'manufactureMachine');
  assert.ok(!Object.keys(MACHINE_RECIPE.materials).some(id => id.endsWith('3')));
});
test('invalid dungeon on day rollover leaves direct Game state unchanged', () => {
  const g = fixture(); g.p.daily.day = '2000-01-01'; g.p.daily.dungeons.d15 = 3;
  reject(g, () => g.enterDungeon('missing'));
  g.p.location = DUNGEONS[0].entrance[0];
  g.enterDungeon(DUNGEONS[0].id);
  assert.equal(g.p.daily.dungeons[DUNGEONS[0].id], 1);
  assert.notEqual(g.p.daily.day, '2000-01-01');
});
for (const d of DUNGEONS) {
  test(`dungeon only listed entrance/${d.id}`, () => {
    const g = fixture(); g.p.location = Object.keys(ZONES).find(id => ZONES[id].type === 'city' && !d.entrance.includes(id));
    reject(g, () => g.enterDungeon(d.id));
  });
  test(`dungeon pending encounter blocks entry/${d.id}`, () => {
    const g = fixture(); g.p.location = d.entrance[0]; g.p.encounter = { id: 'merchant', zone: g.p.location, mob: '小野猪' };
    reject(g, () => g.enterDungeon(d.id));
  });
  test(`actual entrance/daily cost/no refund/${d.id}`, () => {
    const g = fixture(); g.p.location = d.entrance[0]; g.p.encounter = null;
    for (let i = 1; i <= DUNGEON_DAILY; i++) {
      g.enterDungeon(d.id); assert.equal(g.p.daily.dungeons[d.id], i); reject(g, () => g.enterDungeon(d.id));
      random(0, () => assert.equal(g.turn('escape'), 'escape')); assert.equal(g.p.daily.dungeons[d.id], i); g.state.battle = null;
    }
    reject(g, () => g.enterDungeon(d.id), /次数/);
  });
}
assert.equal(Math.random, originalRandom);
console.log(`Gear rules: ${passed}/${total} groups; matrix=${combinations}/42000; failed=${failures.length}. Controlled fixtures, not natural level-105 progression.`);
if (failures.length) process.exitCode = 1;
