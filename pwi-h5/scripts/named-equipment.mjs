import assert from 'node:assert/strict';
import archive from '../src/data/official-gear.json' with { type: 'json' };
import { Game, validateSave } from '../src/core/game.js';
import { CLASSES } from '../src/data/classes.js';
import { NAMED_EQUIPMENT, NAMED_EQUIPMENT_NOTE, TUTORIAL_LEVELS, namedSpec, matchesNamedEquip, selectEquipmentTemplate, equipmentForShop } from '../src/data/named-equipment.js';
import { ITEMS, makeNamedEquip, makeEquipmentFor, makeEquip, makeHighEquip, equippedWeaponType, refinePlan, refineGain } from '../src/data/items.js';
import { GEAR_RULES, gearSpec, matchesGearSpec } from '../src/data/gear-specs.js';
import { EQUIPMENT_CATALOG, catalogSpec, catalogRecipes, queryEquipmentCatalog } from '../src/data/gear-catalog.js';
import { LUNAR_MATERIAL_IDS, LUNAR_MATERIAL_DROPS, PRODUCTION_MATERIALS, PRODUCTION_SKILLS, getProductionRecipes } from '../src/data/production.js';
import { getProductionCatalog, productionAction } from '../src/core/production.js';
import { equipmentAction, validateEquipment } from '../src/core/equipment.js';
import { economyAction } from '../src/core/economy.js';
import { stats, BAG_LIMIT } from '../src/core/model.js';
import { DUNGEONS, ZONES } from '../src/data/world.js';
import { canUseSkill, createBattle, takeTurn } from '../src/core/combat.js';

let passed = 0;
const failures = [];
const originalRandom = Math.random;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}\n${error.stack}`); }
  finally { Math.random = originalRandom; }
}
function random(value, fn) {
  const previous = Math.random; Math.random = () => value;
  try { return fn(); } finally { Math.random = previous; }
}
function fixture(cls = 'blademaster') {
  const g = new Game(); g.start('具名测试', cls);
  g.p.lv = 105; g.p.gold = 1e7;
  g.p.attrs = { str: 1000, dex: 1000, con: 1000, mag: 1000 };
  g.p.production = Object.fromEntries(Object.keys(PRODUCTION_SKILLS).map((skill) => [skill, { level: 6, exp: 0 }]));
  g.p.bag = []; g.p.equipment = {};
  g.p.hp = stats(g.p).hp; g.p.mp = stats(g.p).mp;
  return g;
}
function reject(g, fn, pattern) {
  const before = structuredClone(g.state);
  assert.throws(fn, pattern); assert.deepEqual(g.state, before, 'failed operation mutated state');
}
const axeId = 'official:2d8855695daeb73911ea:0:1';
const robeId = 'official:645e40c39c6b495aa26f:2:1';
const source = (id) => archive.records.find((r) => r.id === id);
const produce = (g, templateId, params = {}) => productionAction(g, 'produce', { recipeId: `named:${templateId}`, confirm: true, ...params });
const fillCosts = (g, recipe) => { for (const [id, qty] of Object.entries(recipe.materials)) g.p.items[id] = qty; };

for (const cls of Object.keys(CLASSES)) test(`finite named gameplay selection/${cls}`, () => {
  const g = new Game(); g.start('新手', cls);
  const starter = g.p.equipment.weapon;
  assert.equal(starter.ruleVersion, 2); assert.equal(starter.status, 'local-tutorial');
  assert.match(starter.name, /（本作训练）/); assert.equal(starter.origin, 'starter');
  for (const [key, need] of Object.entries(starter.requirements)) assert.ok(g.p.attrs[key] >= need);
  validateSave(g.state);
  for (const lv of [1, 15, 30, 59, 60, 95, 105]) for (const slot of ['weapon', 'head', 'body', 'legs', 'feet', 'wrist', 'cape', 'neck', 'waist', 'ring1']) {
    const id = selectEquipmentTemplate({ slot, lv, cls, channel: 'quest' });
    const low = makeEquipmentFor(slot, lv, 0, cls), high = makeEquipmentFor(slot, lv, 3, cls);
    assert.equal(low.templateId, id); assert.equal(high.templateId, id);
    assert.deepEqual(low.base, high.base); assert.deepEqual(low.ranges, high.ranges);
    assert.equal(low.q, 0); assert.equal(low.stars, null); assert.ok(low.lv <= lv);
    assert.ok(['ordinary', 'local-tutorial'].includes(low.series)); validateEquipment(low);
  }
});
test('registry finite, deeply frozen, exact detached source records, reference-only types', () => {
  const perTier = 15 + 3 + 2 + 2, starterOnlyWeapons = Object.keys(GEAR_RULES.weapons).length - 2;
  assert.equal(Object.keys(NAMED_EQUIPMENT).length, archive.records.length + TUTORIAL_LEVELS.length * perTier + starterOnlyWeapons);
  assert.equal(Object.values(NAMED_EQUIPMENT).filter((t) => t.status === 'local-tutorial').length, TUTORIAL_LEVELS.length * perTier + starterOnlyWeapons);
  assert.ok(Object.isFrozen(NAMED_EQUIPMENT)); assert.ok(NAMED_EQUIPMENT_NOTE.gaps.length > 0);
  for (const record of archive.records) {
    const template = NAMED_EQUIPMENT[record.id];
    assert.deepEqual(template.sourceRecord, record); assert.deepEqual(template.sourceStats, record.sourceStats);
    assert.equal(template.lv, record.lv); assert.equal(template.grade, record.grade);
    assert.equal(template.name, record.name); assert.equal(template.stars, record.stars);
    assert.deepEqual(template.requirements, record.requirements); assert.ok(Object.isFrozen(template.sourceRecord.requirements));
    const preview = namedSpec(record.id); preview.sourceRecord.name = '伪造';
    assert.equal(NAMED_EQUIPMENT[record.id].sourceRecord.name, record.name);
    if (template.referenceOnly) { assert.throws(() => makeNamedEquip(record.id), /仅供参考/); continue; }
    const it = makeNamedEquip(record.id); assert.ok(matchesNamedEquip(it)); validateEquipment(it);
    for (const [key, value] of Object.entries(record.sourceStats)) {
      if (value === null) continue;
      if (Array.isArray(value)) { assert.deepEqual(it.ranges[key], value); assert.equal(it.base[key], (value[0] + value[1]) / 2); }
      else assert.equal(it.base[key === 'evade' ? 'evasionRating' : key], value);
    }
  }
});
test('ordinary unknown attacks remain null, isolated exact-lv q0 runtime adaptation', () => {
  const record = archive.records.find((r) => r.series === 'ordinary' && r.weaponType === 'sword');
  const it = makeNamedEquip(record.id);
  const fallback = gearSpec('weapon', record.lv, 0, 'blademaster', { weaponType: 'sword' });
  assert.equal(it.sourceStats.patk, null); assert.equal(it.sourceRecord.sourceStats.patk, null);
  assert.equal(it.status, 'partial'); assert.equal(it.grade, null);
  assert.deepEqual(it.base, fallback.base); assert.deepEqual(it.runtimeAdaptation.values, fallback.base);
  assert.ok(it.adaptedFields.includes('base.patk')); assert.equal(it.nameColor, null);
  assert.throws(() => refinePlan(it), /未载品阶/); assert.throws(() => refineGain(it, 1), /未载品阶/);
  assert.deepEqual(refineGain(it, 0), {});
});
test('金鳞斩 exact source combat and named material quantities', () => {
  const it = makeNamedEquip(axeId), recipe = getProductionRecipes('barbarian').find((r) => r.templateId === axeId);
  assert.equal(it.name, '★金鳞斩'); assert.equal(it.lv, 95); assert.equal(it.grade, 11);
  assert.deepEqual(it.requirements, { str: 287, dex: 52, con: null, mag: null });
  assert.deepEqual(it.ranges, { patk: [646, 1508] }); assert.equal(it.base.patk, 1077);
  assert.deepEqual(it.addons, { str: 11, dex: 10 }); assert.equal(it.stars, null);
  assert.deepEqual(recipe.materials, { [LUNAR_MATERIAL_IDS['碎片凝结体']]: 5, [LUNAR_MATERIAL_IDS['结晶凝结体']]: 1,
    [LUNAR_MATERIAL_IDS['精华凝结体']]: 1, [LUNAR_MATERIAL_IDS['自然精髓']]: 5 });
  assert.equal(recipe.from, null); assert.deepEqual(recipe.qualities, [0]);
  assert.deepEqual(it.sourceRecord, source(axeId));
});
test('凤兮法袍 exact defense, independently rolled source ranges, no fake five-element record', () => {
  let calls = 0;
  Math.random = () => { calls++; return calls === 1 ? 0 : .999; };
  const it = makeNamedEquip(robeId);
  assert.equal(calls, 3, 'two source-field rolls plus UID only');
  assert.deepEqual(it.base, { def: 188, mdef: 1685 }); assert.deepEqual(it.addons, { mag: 5, con: 6 });
  assert.deepEqual(it.affixRolls, [5, 6]); assert.equal(it.grade, 11);
  assert.deepEqual(it.requirements, { str: 52, dex: null, con: null, mag: 146 });
  assert.deepEqual(it.sourceRecord, source(robeId)); assert.equal(it.sourceStats.hp, null);
  assert.ok(it.adaptedFields.includes('combat.elementDefenseFallback'));
  for (const elem of ['metal', 'wood', 'water', 'fire', 'earth']) assert.ok(!Object.hasOwn(it.base, `${elem}Def`));
  const recipe = getProductionRecipes('wizard').find((r) => r.templateId === robeId);
  assert.deepEqual(Object.fromEntries(Object.entries(recipe.materials).map(([id, qty]) => [PRODUCTION_MATERIALS[id].name, qty])),
    { 碎片凝结体: 3, 结晶凝结体: 1, 纯水精华: 2, 火炎精华: 2, 大地精华: 2, 生命精华: 2, 精铁精华: 5, 自然精髓: 3 });
});
test('pure shop and production/catalog GET previews consume no RNG/UID and detach nested data', () => {
  const g = fixture('wizard'), before = structuredClone(g.state);
  Math.random = () => { throw new Error('GET consumed randomness'); };
  for (const entry of EQUIPMENT_CATALOG) assert.ok(!Object.hasOwn(catalogSpec(entry), 'uid'));
  const shop = equipmentForShop(g.p), catalog = getProductionCatalog(g.p);
  assert.ok(shop.every((s) => !Object.hasOwn(s, 'uid') && s.series !== 'lunar'));
  assert.ok(catalog.recipes.every((r) => r.templateId && r.from === null && r.previews.length === 1 && !r.previews[0].uid));
  assert.ok(!catalog.recipes.some((r) => /twilight|nirvana/.test(r.series)));
  assert.ok(catalogRecipes(robeId, 'wizard').every((r) => r.templateId === robeId));
  shop[0].base.patk = 999999; catalog.recipes[0].previews[0].base.def = 999999;
  catalog.materials.ore1.name = 'changed'; queryEquipmentCatalog({ search: '凤兮' }).entries[0].name = 'changed';
  assert.equal(namedSpec(robeId).name, '★凤兮法袍'); assert.notEqual(PRODUCTION_MATERIALS.ore1.name, 'changed');
  assert.deepEqual(g.state, before);
});
const mutations = {
  name: it => it.name += '假', base: it => it.base.def++, requirement: it => it.requirements.mag = 0,
  wear: it => it.wear.mag = 0, range: it => it.ranges.matk = [1, 9999], grade: it => it.grade = null,
  q: it => it.q = 3, star: it => it.stars = 3, source: it => it.source.sha256 = 'fake',
  sourceRecord: it => it.sourceRecord.sourceStats.def++, affixText: it => it.affixes[0].text = '灵力+100',
  addons: it => it.addons.mag = 100, roll: it => it.affixRolls[0] = 7,
  fakeEffect: it => it.addons.speed = .1, status: it => it.status = 'complete',
  adaptation: it => it.adaptedFields = [], price: it => it.price = 1,
  ruleMissing: it => delete it.ruleVersion, templateMissing: it => delete it.templateId,
  bothMissing: it => { delete it.ruleVersion; delete it.templateId; },
  downgrade: it => it.ruleVersion = 1, invalidGem: it => it.sockets = ['gemPatk1'],
  socketLimit: it => it.socketLimit = 2, forgedRefine: it => it.refine = 13,
};
for (const [name, mutate] of Object.entries(mutations)) test(`forged named metadata/source/addons rejected without mutation/${name}`, () => {
  const g = fixture('wizard'), it = makeNamedEquip(robeId); g.p.bag.push(it); validateSave(g.state);
  mutate(it); assert.throws(() => validateSave(g.state));
  reject(g, () => g.equip(it.uid)); reject(g, () => equipmentAction(g, 'repair', { uid: it.uid }));
  reject(g, () => g.sell(it.uid)); reject(g, () => g.sellCommon());
});
test('unknown grade blocks punch/gems/decomposition/refine transfer, normal repair/binding remain', () => {
  const g = fixture(), id = archive.records.find((r) => r.series === 'ordinary' && r.weaponType === 'blade').id;
  const it = makeNamedEquip(id); g.p.bag.push(it);
  for (const action of ['punch', 'socket', 'decompose']) reject(g, () => equipmentAction(g, action, { uid: it.uid, ...(action === 'socket' ? { gemId: 'gemPatk1' } : action === 'decompose' ? { confirm: true } : {}) }), /未载品阶/);
  g.equip(it.uid); reject(g, () => g.refine('weapon'), /未载品阶/);
  it.durability = 99; equipmentAction(g, 'repair', { uid: it.uid }); assert.equal(it.durability, 100);
  const other = makeEquipmentFor('weapon', 1, 0, g.p.cls, { origin: 'starter' }); other.refine = 1; g.p.bag.push(other);
  reject(g, () => equipmentAction(g, 'transfer', { fromUid: other.uid, toUid: it.uid, confirm: true }), /未载品阶/);
  equipmentAction(g, 'bind', { uid: it.uid, confirm: true }); validateSave(g.state);
});
test('actual shop exact listing/payment/level/capacity checked before one create', () => {
  const g = fixture('barbarian');
  const listing = equipmentForShop(g.p).find((t) => t.series === 'ordinary');
  for (const invalid of ['weapon', 'constructor', axeId, 'official:fake']) reject(g, () => g.buyEquip(invalid));
  const gold = g.p.gold; let calls = 0; Math.random = () => { calls++; return .5; };
  const bought = g.buyEquip(listing.templateId);
  assert.equal(calls, 1); assert.equal(bought.templateId, listing.templateId); assert.equal(g.p.gold, gold - listing.price);
  g.p.gold = 0; calls = 0; reject(g, () => g.buyEquip(listing.templateId)); assert.equal(calls, 0);
  g.p.gold = 1e7; g.p.lv = 1; reject(g, () => g.buyEquip(listing.templateId));
  g.p.lv = 105; g.p.bag = Array(BAG_LIMIT).fill(bought); reject(g, () => g.buyEquip(listing.templateId));
  g.p.bag = []; g.p.location = Object.keys(ZONES).find((id) => ZONES[id].type === 'field'); reject(g, () => g.buyEquip(listing.templateId));
});
test('quest, encounter, field loot and non-material dungeon create only finite ordinary/local identities', () => {
  const g = fixture();
  g.p.mainIndex = g.quests.findIndex((q) => q.equip !== undefined && q.equip !== null);
  const q = g.mainQuest;
  if (q.goal.type === 'kill') g.p.mainProgress = q.goal.count;
  if (q.goal.type === 'visit') g.p.visits.push(q.goal.zone);
  random(0, () => g.claimQuest()); assert.ok(g.p.bag.length);
  const zone = Object.keys(ZONES).find((id) => ZONES[id].type === 'field' && ZONES[id].mobs?.length);
  g.p.location = zone; g.p.encounter = { id: 'chest', zone, mob: ZONES[zone].mobs[0][0] };
  random(0, () => g.chooseEncounter('open'));
  const count = g.p.bag.length; g.hunt(0); g.battle.monsters.forEach((m) => m.hp = 0); g.battle.result = 'win';
  random(0, () => g.resolveBattle()); assert.ok(g.p.bag.length > count);
  assert.ok(g.battle.rewards.loot.every((r) => r.templateId));
  const dungeon = DUNGEONS.find((d) => !['lunar', 'twilight', 'nirvana'].includes(d.family));
  g.p.location = dungeon.entrance[0]; g.enterDungeon(dungeon.id); g.startDungeonWave(dungeon, dungeon.waves || 3);
  g.battle.monsters.forEach((m) => m.hp = 0); g.battle.result = 'win'; random(0, () => g.resolveBattle());
  assert.ok(g.p.bag.every((it) => matchesNamedEquip(it) && ['ordinary', 'local-tutorial'].includes(it.series)));
  validateSave(g.state);
});
test('actual event equipment and history remain finite named and failed batch remains atomic', () => {
  const g = fixture('wizard'); g.p.items.bronzeChest = 1;
  random(.95, () => economyAction(g, 'activity.open', { itemId: 'bronzeChest', count: 1 }));
  const it = g.p.bag.at(-1); assert.ok(matchesNamedEquip(it)); assert.equal(it.origin, 'event');
  assert.equal(g.p.drawHistory.at(-1).rewards[0].equipment.templateId, it.templateId); validateSave(g.state);
  g.p.bag = Array(BAG_LIMIT).fill(it); g.p.items.bronzeChest = 1;
  reject(g, () => economyAction(g, 'activity.open', { itemId: 'bronzeChest', count: 1 }));
});
test('actual Lunar material-only acquisition enables exact named production, aggregates never substitute', () => {
  const g = fixture('barbarian'), d = DUNGEONS.find((entry) => entry.family === 'lunar');
  const recipe = getProductionRecipes(g.p.cls).find((r) => r.templateId === axeId);
  g.p.items.lunarEssence = 10000;
  Math.random = () => { throw new Error('failure created equipment'); };
  reject(g, () => produce(g, axeId), /不足/);
  Math.random = originalRandom;
  const bagCount = g.p.bag.length;
  for (let run = 0; run < 5; run++) {
    if (run === 3) g.p.daily.day = '2000-01-01';
    g.p.location = d.entrance[0]; g.enterDungeon(d.id); g.startDungeonWave(d, d.waves || 3);
    g.battle.monsters.forEach((m) => m.hp = 0); g.battle.result = 'win'; random(0, () => g.resolveBattle());
  }
  assert.equal(g.p.bag.length, bagCount); assert.ok(!g.battle.rewards.loot.length);
  for (const [id, qty] of Object.entries(LUNAR_MATERIAL_DROPS)) assert.equal(g.p.items[id], qty * 5);
  g.p.location = g.p.lastCity;
  const before = { ...g.p.items }, result = produce(g, axeId);
  assert.equal(result.templateId, axeId); assert.deepEqual(result.consumed, recipe.materials);
  for (const [id, qty] of Object.entries(recipe.materials)) assert.equal(g.p.items[id], before[id] - qty);
  assert.ok(matchesNamedEquip(g.p.bag.at(-1))); validateSave(g.state);
  const wizard = fixture('wizard'), robeRecipe = getProductionRecipes('wizard').find((r) => r.templateId === robeId);
  fillCosts(wizard, robeRecipe); produce(wizard, robeId); validateSave(wizard.state);
});
test('local training produces named progression, exact root recipes reject generic/predecessor injection', () => {
  const g = fixture(); g.p.production.blacksmith = { level: 1, exp: 0 };
  const recipe = getProductionRecipes(g.p.cls).find((r) => r.slot === 'weapon' && r.lv === 1);
  for (let i = 0; i < 5; i++) { fillCosts(g, recipe); produce(g, recipe.templateId); }
  assert.equal(g.p.production.blacksmith.exp, 5);
  productionAction(g, 'train', { skill: 'blacksmith' }); assert.equal(g.p.production.blacksmith.level, 2);
  assert.ok(g.p.bag.every((it) => it.status === 'local-tutorial'));
  fillCosts(g, recipe); reject(g, () => produce(g, recipe.templateId, { uid: g.p.bag[0].uid }), /根配方/);
  reject(g, () => produce(g, recipe.templateId, { inherit: true }), /根配方/);
  reject(g, () => productionAction(g, 'produce', { recipeId: 'twilight-99-weapon', confirm: true }), /不存在/);
  reject(g, () => productionAction(g, 'produce', { recipeId: 'nirvana1-100-weapon', confirm: true }), /不存在/);
  validateSave(g.state);
});
for (const skill of Object.keys(PRODUCTION_SKILLS)) test(`finite local training reaches skill six/${skill}`, () => {
  const g = fixture(); g.p.production[skill] = { level: 1, exp: 0 };
  const recipe = getProductionRecipes(g.p.cls).find((r) => r.skill === skill && r.lv === 1);
  for (let level = 1; level < 6; level++) {
    for (let i = 0; i < 5; i++) { fillCosts(g, recipe); produce(g, recipe.templateId); }
    productionAction(g, 'train', { skill });
    assert.deepEqual(g.p.production[skill], { level: level + 1, exp: 0 });
  }
  validateSave(g.state);
});
test('every current named production entry consumes exact costs and creates its template once', () => {
  for (const cls of Object.keys(CLASSES)) for (const recipe of getProductionRecipes(cls)) {
    const g = fixture(cls); fillCosts(g, recipe);
    const before = g.p.gold, result = produce(g, recipe.templateId);
    assert.equal(result.equipment.templateId, recipe.templateId); assert.equal(g.p.gold, before - recipe.gold);
    assert.deepEqual(result.consumed, recipe.materials);
    for (const id of Object.keys(recipe.materials)) assert.equal(g.p.items[id], 0);
    assert.equal(g.p.bag.length, 1); validateSave(g.state);
  }
});
test('known-grade named cultivation is mutable without changing source rolls or immutable identity', () => {
  const g = fixture('wizard'), it = makeNamedEquip(robeId);
  g.p.bag.push(it); g.equip(it.uid);
  g.p.items.socketStone = 100; g.p.items.gemHp1 = 1;
  const rolls = [...it.affixRolls], before = stats(g.p).hp;
  equipmentAction(g, 'punch', { uid: it.uid });
  equipmentAction(g, 'socket', { uid: it.uid, gemId: 'gemHp1' });
  assert.equal(stats(g.p).hp, before + ITEMS.gemHp1.value);
  random(0, () => g.refine('body')); assert.equal(it.refine, 1);
  it.durability = 0; equipmentAction(g, 'repair', { uid: it.uid });
  equipmentAction(g, 'bind', { uid: it.uid, confirm: true });
  assert.deepEqual(it.affixRolls, rolls); assert.ok(matchesNamedEquip(it)); validateSave(g.state);
});
test('physical sword distinct from 法剑, unsupported types never give free skill permissions', () => {
  const g = fixture('wizard'), sword = archive.records.find((r) => r.series === 'ordinary' && r.weaponType === 'sword');
  g.p.bag.push(makeNamedEquip(sword.id)); g.equip(g.p.bag[0].uid);
  const battle = { result: null, cooldowns: {}, pet: null, stealth: false };
  assert.equal(equippedWeaponType(g.p), 'sword'); assert.match(canUseSkill(g.p, battle, 'wz1'), /武器不支持/);
  const magic = archive.records.find((r) => r.series === 'ordinary' && r.weaponType === 'wand' && r.type === '法剑');
  g.p.bag.push(makeNamedEquip(magic.id)); g.equip(g.p.bag[0].uid);
  assert.equal(equippedWeaponType(g.p), 'wand'); assert.equal(canUseSkill(g.p, battle, 'wz1'), null);
  const unsupported = archive.records.find((r) => r.weaponType === null && r.slot === 'weapon');
  assert.throws(() => makeNamedEquip(unsupported.id));
  g.p.equipment.weapon = { kind: 'equip', slot: 'weapon', templateId: unsupported.id, ruleVersion: 2 };
  assert.equal(equippedWeaponType(g.p), null); assert.match(canUseSkill(g.p, battle, 'wz1'), /类型未知/);
});
test('evasion source rating added before local probability conversion, movement does not become attack speed', () => {
  const g = fixture('barbarian'), t = Object.values(NAMED_EQUIPMENT).find((entry) => !entry.referenceOnly && entry.addonBudget.evasionRating);
  const it = makeNamedEquip(t.templateId), before = stats(g.p); g.p.equipment[it.slot] = it;
  const after = stats(g.p); assert.equal(after.evasionRating, after.dex * CLASSES[g.p.cls].evasionDex + it.addons.evasionRating + (it.base.evasionRating || 0));
  assert.ok(after.evasionRating > before.evasionRating); assert.ok(after.dodge <= .5);
  const moving = Object.values(NAMED_EQUIPMENT).find((entry) => !entry.referenceOnly && entry.affixes.some((a) => /米\/秒/.test(a.text)));
  const item = makeNamedEquip(moving.templateId);
  assert.ok(item.affixes.filter((a) => /米\/秒/.test(a.text)).every((a) => a.supported === false));
  assert.ok(!Object.hasOwn(item.addons, 'speed'));
});
test('source physical reduction affects only incoming physical damage', () => {
  const reductionId = 'official:645e40c39c6b495aa26f:2:30';
  const template = NAMED_EQUIPMENT[reductionId];
  const effect = template.affixes.find((entry) => entry.stat === 'physicalReduction');
  assert.deepEqual(effect.range, [.01, .01]); assert.equal(effect.runtimeSupported, true);
  const receive = (type, enabled) => {
    const g = fixture('cleric'), item = makeNamedEquip(reductionId);
    if (!enabled) item.addons.physicalReduction = 0;
    g.p.equipment = { head: item };
    const initialHp = stats(g.p).hp; g.p.hp = initialHp;
    const battle = createBattle(g.p, [{ name: '通道测试', lv: 95, type, atk: 10_000,
      hp: 1_000_000, maxHp: 1_000_000, def: 0, mdef: 0, accuracy: 10, dodge: 0, crit: 0 }], { type: 'arena' });
    random(.5, () => takeTurn(g.p, battle, 'defend'));
    return initialHp - g.p.hp;
  };
  assert.ok(receive('phys', true) < receive('phys', false));
  assert.equal(receive('magic', true), receive('magic', false));
});
test('valid historical v1 and no-version saves remain valid without rebuilding identity', () => {
  const g = fixture(); g.p.bag = [makeEquip('weapon', 35, 2, g.p.cls), makeEquip('body', 95, 3, g.p.cls, { series: 'lunar' })];
  assert.ok(g.p.bag.every(matchesGearSpec)); validateSave(g.state);
  const old = structuredClone(g.p.bag[0]);
  for (const key of ['ruleVersion', 'series', 'weaponType', 'wear', 'ranges', 'stars', 'attackType', 'origin']) delete old[key];
  old.uid += 'old'; g.p.bag.push(old); validateSave(g.state);
  const snapshot = structuredClone(g.state); snapshot.version = 1;
  assert.deepEqual(validateSave(snapshot).player.bag, g.p.bag);
  g.p.bag.push(makeHighEquip('axe19a')); validateSave(g.state);
});
console.log(`${passed} named-equipment checks passed; ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
