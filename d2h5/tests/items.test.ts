import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { getClass, num, rawRows, text } from '../src/catalog';
import type { ClassId, Item, Monster, Player, Rng } from '../src/types';
import { deriveStats, skillLevel } from '../src/rules';
import {
  BASE_ITEMS, ITEM_LIMITATIONS, RUNES, GEMS, RUNEWORDS, affixLevel, allowedSockets, itemLabel,
  consumePotion, consumeInventoryPotion, isUsableItem, itemName, runewordName,
  createItem, createStartingItems, describeItem, unmetItemRequirements, equipItem, fitsItem,
  getBase, insertSocket, itemHasType, placeItem, qualityDenominator, effectiveMagicFind,
  repairCost, repairItems, rollLoot, transmute, unequipItem, vendorStock,
} from '../src/items';
import { ART_KEYS, artUrl, itemArtKey } from '../src/art';

test('ordinary and event keys have a self-contained key icon, not the sword fallback', () => {
  for (const code of ['key', 'pk1', 'pk2', 'pk3']) {
    assert.equal(itemArtKey(code), 'key');
    const url = artUrl(itemArtKey(code));
    assert.match(url, /^data:image\/svg\+xml,/);
    assert.match(decodeURIComponent(url.split(',')[1]), /^<svg /);
  }
  assert.equal(ART_KEYS.length, 49);
  assert.equal(itemArtKey('rvl'), 'rejuvenation');
  assert.equal(itemArtKey('r33'), 'rune');
  assert.equal(itemArtKey('crs'), 'sword');
});

const localizedNames = JSON.parse(readFileSync(new URL('../src/data/item-zhCN.json', import.meta.url), 'utf8')) as Record<string, string>;
function assertDisplayOnly(item: Item, expected: string): void {
  const before = structuredClone(item), persisted = JSON.stringify(item);
  assert.equal(itemLabel(item), expected);
  assert.equal(describeItem(item)[0], expected);
  assert.deepEqual(item, before, 'display must not change UID, raw identity, mods or other item fields');
  assert.equal(JSON.stringify(item), persisted, 'saved representation must remain byte-for-byte identical');
  const loaded = JSON.parse(persisted) as Item;
  assert.equal(itemLabel(loaded), expected);
  assert.equal(describeItem(loaded)[0], expected);
  assert.equal(JSON.stringify(loaded), persisted);
}

const fixed: Rng = () => .5;
function seeded(seed: number): Rng { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function player(classId: ClassId = 'pal'): Player {
  const c = getClass(classId);
  return {
    classId, name: '测试', level: 1, experience: 0, difficulty: 'normal', strength: c.strength, dexterity: c.dexterity, vitality: c.vitality, energy: c.energy,
    statPoints: 0, skillPoints: 0, skills: {}, life: c.life, mana: c.mana, stamina: c.stamina, gold: 0,
    inventory: [], stash: [], cube: [], equipment: {}, belt: Array(16).fill(null), weaponSwap: false,
    quests: {}, waypoints: [], unlockedActs: 1, unlockedDifficulties: 1, bonusLife: 0, bonusResist: 0,
    leftSkill: 0, rightSkill: 0, running: false, dead: false, x: 0, y: 0,
  };
}
function put(p: Player, code: string, ilvl = 1): Item {
  const item = createItem(code, ilvl, fixed); assert.equal(placeItem(p.inventory, item, 10, 4), true); return item;
}
function monster(code = 'skeleton1', level = 2): Monster {
  return { uid: 'monster-test', code, name: code, level, life: 10, maxLife: 10, minDamage: 1, maxDamage: 2, defense: 1, attackRating: 1, experience: 1, resists: { physical: 0, fire: 0, cold: 0, lightning: 0, poison: 0, magic: 0 }, boss: false, champion: false, ai: 'melee', color: '#fff', cooldown: 0, dead: false, chill: 0, poison: 0, poisonFrames: 0, modifiers: [], x: 0, y: 0 };
}

test('all five skulls have a dedicated self-contained skull icon instead of a ruby', () => {
  for (const code of ['skc', 'skf', 'sku', 'skl', 'skz']) {
    assert.equal(itemArtKey(code), 'skull'); const url = artUrl(itemArtKey(code));
    assert.match(url, /^data:image\/svg\+xml,/); assert.match(decodeURIComponent(url.split(',')[1]), /^<svg /);
  }
  assert.equal(itemArtKey('gpr'), 'gem'); assert.equal(ART_KEYS.length, 49);
});

test('raw base catalogs contain real enabled equipment, all 33 runes, Chinese principal names', () => {
  assert.ok(BASE_ITEMS.length > 600);
  assert.equal(RUNES.length, 33); assert.deepEqual(RUNES.map(r => r.number), Array.from({ length: 33 }, (_, i) => i + 1));
  assert.equal(getBase('sst')!.name, '短杖'); assert.equal(getBase('gld')!.name, '金币'); assert.equal(getBase('xxx'), undefined);
  for (const base of BASE_ITEMS) { assert.ok(base.width > 0 && base.height > 0); assert.notEqual(num(base.raw, 'enabled', 1), 0); }
  assert.throws(() => createItem('not-a-base', 1, fixed), /未知/);
  assert.ok(ITEM_LIMITATIONS.length > 0);
});

test('ItemTypes inheritance and socket bands are loaded from the raw catalog', () => {
  assert.ok(rawRows('ItemTypes').length > 90, 'Node catalog must include newly fetched ItemTypes');
  assert.ok(itemHasType(getBase('crs')!, 'weap')); assert.ok(itemHasType(getBase('buc')!, 'shld'));
  assert.equal(itemHasType(getBase('scp')!, 'mace'), false);
  assert.equal(itemHasType(getBase('ob1')!, 'staf'), false);
  assert.equal(allowedSockets(getBase('crs')!, 25), 3); assert.equal(allowedSockets(getBase('crs')!, 26), 4); assert.equal(allowedSockets(getBase('crs')!, 41), 6);
  assert.equal(getBase('ktr')!.classId, 'ass'); assert.equal(getBase('ob1')!.classId, 'sor');
  assert.equal(getBase('tbl')!.beltRows, 3); assert.equal(getBase('hbl')!.beltRows, 4);
});

test('10×4 packing rejects overlap, overflow, rotation and duplicate pushes atomically', () => {
  const items: Item[] = [], armor = createItem('qui', 1, fixed);
  assert.equal(placeItem(items, armor, 10, 4), true); assert.deepEqual([armor.x, armor.y], [0, 0]);
  const sword = createItem('2hs', 1, fixed);
  assert.equal(fitsItem(items, sword, 0, 0, 10, 4), false); assert.equal(fitsItem(items, sword, 10, 0, 10, 4), false); assert.equal(fitsItem(items, sword, 2, 1, 10, 4), false);
  assert.equal(placeItem(items, sword, 10, 4), true); assert.deepEqual([sword.x, sword.y], [2, 0]);
  assert.equal(placeItem(items, sword, 10, 4), false); assert.equal(items.length, 2);
  const tooTall = { ...createItem('hp1', 1, fixed), height: 5, width: 1 };
  assert.equal(placeItem([], tooTall, 10, 4), false); assert.deepEqual([tooTall.x, tooTall.y], [-1, -1]);
  const full: Item[] = [];
  for (let i = 0; i < 40; i++) assert.ok(placeItem(full, createItem('hp1', 1, fixed), 10, 4));
  const before = JSON.stringify(full), extra = createItem('hp1', 1, fixed);
  assert.equal(placeItem(full, extra, 10, 4), false); assert.equal(JSON.stringify(full), before);
});

test('all seven starting loadouts match CharStats; soft skills are not hard points', () => {
  for (const id of ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass'] as ClassId[]) {
    const p = player(id); createStartingItems(p);
    const row = rawRows('charstats').find(r => text(r, 'class') === getClass(id).english)!;
    assert.equal(p.equipment.weapon!.code, text(row, 'item1'));
    assert.equal(p.equipment.offhand?.code, ['sor', 'nec'].includes(id) ? undefined : 'buc');
    assert.deepEqual(p.inventory.map(i => i.code).sort(), ['isc', 'tsc']);
    assert.deepEqual(p.belt.slice(0, 4).map(i => i!.code), ['hp1', 'hp1', 'hp1', 'hp1']);
    assert.ok(p.belt.slice(4).every(i => !i)); assert.deepEqual(p.skills, {}); assert.equal(p.skillPoints, 0);
    assert.equal(p.equipment.weapon!.mods['skill:36'], id === 'sor' ? 1 : undefined);
    assert.equal(p.equipment.weapon!.mods['skill:70'], id === 'nec' ? 1 : undefined);
    assert.equal(Object.keys(p.equipment).length, ['sor', 'nec'].includes(id) ? 1 : 2);
  }
});

test('base damage, ethereal, low quality, and UID flags are independent', () => {
  const a = createItem('sst', 1, fixed), b = createItem('sst', 1, () => .01);
  assert.deepEqual([a.minDamage, a.maxDamage], [1, 5]); assert.notEqual(a.uid, b.uid);
  assert.equal(a.ethereal, false); assert.equal(b.ethereal, true); assert.equal(b.quality, 'normal'); assert.equal(b.maxDamage, 7);
  assert.equal(b.maxDurability, 11); assert.equal(b.durability, 11);
  const bow = createItem('sbw', 1, () => 0); assert.equal(bow.ethereal, false);
  const low = createItem('sst', 1, () => 0, 'low'); assert.equal(low.ethereal, false); assert.equal(low.maxDamage, 3); assert.equal(low.maxDurability, 6);
  assert.equal(createItem('hp1', 1, () => 0).ethereal, false);
});

test('equip validates class, level, strength, dexterity, identification and broken gear', () => {
  const p = player('pal'), sword = put(p, '2hs');
  assert.equal(equipItem(p, sword.uid).ok, false);
  p.strength = 100; p.dexterity = 100; sword.requiredLevel = 10;
  assert.equal(equipItem(p, sword.uid).ok, false); p.level = 10;
  sword.identified = false; assert.equal(equipItem(p, sword.uid).ok, false); sword.identified = true;
  sword.durability = 0; assert.equal(equipItem(p, sword.uid).ok, false); sword.durability = sword.maxDurability;
  assert.equal(equipItem(p, sword.uid).ok, true);
  const claw = put(p, 'ktr'); assert.equal(equipItem(p, claw.uid).ok, false);
});

test('unmet requirement lines cover every failed threshold and clear at exact equip limits', () => {
  const p = player(), sword = put(p, '2hs'), base = getBase(sword.code)!;
  p.strength = p.dexterity = 0; sword.requiredLevel = 10;
  assert.deepEqual(unmetItemRequirements(p, sword), ['需要等级：10', `需要力量：${base.strength}`, `需要敏捷：${base.dexterity}`]);
  for (const line of unmetItemRequirements(p, sword)) assert.ok(describeItem(sword).includes(line));
  p.level = 10; p.strength = base.strength; p.dexterity = base.dexterity;
  assert.deepEqual(unmetItemRequirements(p, sword), []); assert.equal(equipItem(p, sword.uid).ok, true);
});

test('class requirements remain unmet independently of level and attributes', () => {
  const p = player(), claw = put(p, 'ktr'); p.level = 99; p.strength = p.dexterity = 1000;
  assert.deepEqual(unmetItemRequirements(p, claw), ['仅限刺客']); assert.equal(equipItem(p, claw.uid).ok, false);
  p.classId = 'ass'; assert.deepEqual(unmetItemRequirements(p, claw), []); assert.equal(equipItem(p, claw.uid).ok, true);
});

test('unidentified and broken lines use the same restrictions as actual equipment validation', () => {
  const p = player(), item = put(p, 'hax'); item.identified = false; item.durability = 0;
  assert.deepEqual(unmetItemRequirements(p, item), ['尚未辨识', `耐久度：0/${item.maxDurability}`]);
  assert.equal(equipItem(p, item.uid).message, '请先辨识物品'); item.identified = true;
  assert.equal(equipItem(p, item.uid).message, '装备已经损坏'); item.mods.indestructible = 1;
  assert.deepEqual(unmetItemRequirements(p, item), []); assert.equal(equipItem(p, item.uid).ok, true);
});

test('requirement display uses reduced ethereal thresholds rather than raw base values', () => {
  const p = player(), item = put(p, '2hs'), base = getBase(item.code)!;
  item.ethereal = true; item.mods.requirementsPercent = -20;
  const strength = Math.max(0, Math.floor(base.strength * .8) - 10), dexterity = Math.max(0, Math.floor(base.dexterity * .8) - 10);
  p.strength = strength - 1; p.dexterity = dexterity - 1;
  assert.deepEqual(unmetItemRequirements(p, item), [`需要力量：${strength}`, `需要敏捷：${dexterity}`]);
  p.strength = strength; p.dexterity = dexterity;
  assert.deepEqual(unmetItemRequirements(p, item), []); assert.equal(equipItem(p, item.uid).ok, true);
});

test('preview rejects self bonuses and stats lost by replacement but retains independent support', () => {
  const p = player('sor'), shield = put(p, 'tow'); p.strength = 0; shield.mods.strength = 1000;
  const support = createItem('sst', 1, fixed); support.mods.strength = 1000; p.equipment.weapon = support;
  const line = `需要力量：${getBase(shield.code)!.strength}`;
  assert.deepEqual(unmetItemRequirements(p, shield), [line]); assert.equal(equipItem(p, shield.uid).ok, false, 'shield removes a supporting two-handed staff');
  p.equipment = { ring1: Object.assign(createItem('rin', 1, fixed), { mods: { strength: 1000 } }) };
  assert.deepEqual(unmetItemRequirements(p, shield), []); assert.equal(equipItem(p, shield.uid).ok, true);
});

test('preview follows active weapon bonuses and never mutates held or candidate items', () => {
  const p = player('sor'), shield = put(p, 'tow'); p.strength = 0;
  p.equipment.weapon2 = Object.assign(createItem('hax', 1, fixed), { mods: { strength: 1000 } });
  const before = structuredClone(p), line = `需要力量：${getBase(shield.code)!.strength}`;
  assert.deepEqual(unmetItemRequirements(p, shield), [line]); assert.deepEqual(p, before);
  p.weaponSwap = true; assert.deepEqual(unmetItemRequirements(p, shield), []);
  p.equipment.weapon2.durability = 0; assert.deepEqual(unmetItemRequirements(p, shield), [line]);
  const broken = structuredClone(p); for (let i = 0; i < 5; i++) unmetItemRequirements(p, shield); assert.deepEqual(p, broken);
});

test('equipment attribute bonuses count, incoming item cannot satisfy its own requirement', () => {
  const p = player('sor'), ring = put(p, 'rin'); ring.mods.strength = 20;
  assert.ok(equipItem(p, ring.uid).ok);
  const shield = put(p, 'buc'); assert.ok(equipItem(p, shield.uid).ok);
  const q = player('sor'), self = put(q, 'buc'); self.mods.strength = 100;
  assert.equal(equipItem(q, self.uid).ok, false);
  p.weaponSwap = true; p.equipment.weapon = createItem('hax', 1, fixed); p.equipment.weapon.mods.strength = 100;
  const large = put(p, 'tow'); assert.equal(equipItem(p, large.uid).ok, false, 'inactive weapon cannot supply strength');
});

test('two-hand conflict returns both old items and weapon swapping uses the active pair', () => {
  const p = player(); p.strength = p.dexterity = 100; createStartingItems(p);
  const sword = put(p, '2hs'); assert.ok(equipItem(p, sword.uid).ok);
  assert.equal(p.equipment.weapon!.uid, sword.uid); assert.equal(p.equipment.offhand, undefined);
  assert.ok(p.inventory.some(i => i.code === 'ssd')); assert.ok(p.inventory.some(i => i.code === 'buc'));
  const shield = p.inventory.find(i => i.code === 'buc')!; assert.ok(equipItem(p, shield.uid).ok);
  assert.equal(p.equipment.weapon, undefined); assert.equal(p.equipment.offhand!.uid, shield.uid);
  const savedShield = p.equipment.offhand!.uid; p.weaponSwap = true;
  const axe = put(p, 'hax'); assert.ok(equipItem(p, axe.uid).ok);
  assert.equal(p.equipment.weapon2!.uid, axe.uid); assert.equal(p.equipment.offhand!.uid, savedShield);
});

test('bow retains a matching quiver; barbarians use two-handed sword 1H damage with offhand', () => {
  const p = player('ama'); p.strength = p.dexterity = 100;
  const bow = put(p, 'sbw'); assert.ok(equipItem(p, bow.uid).ok);
  const arrows = put(p, 'aqv'); assert.ok(equipItem(p, arrows.uid).ok);
  const newBow = put(p, 'lbw'); assert.ok(equipItem(p, newBow.uid).ok); assert.equal(p.equipment.offhand!.code, 'aqv');
  const b = player('bar'); b.strength = b.dexterity = 100;
  const sword = put(b, '2hs'); assert.ok(equipItem(b, sword.uid).ok); assert.equal(sword.minDamage, 8);
  const shield = put(b, 'buc'); assert.ok(equipItem(b, shield.uid).ok); assert.equal(sword.minDamage, 2); assert.equal(sword.maxDamage, 9);
  assert.ok(unequipItem(b, 'offhand').ok); assert.equal(sword.minDamage, 8);
});

test('failed two-hand replacement and unequip have exact atomic rollback when inventory is full', () => {
  const p = player(); p.strength = p.dexterity = 100;
  p.equipment.weapon = createItem('gsd', 1, fixed); p.equipment.offhand = createItem('buc', 1, fixed);
  const sword = put(p, '2hs');
  while (placeItem(p.inventory, createItem('hp1', 1, fixed), 10, 8)) {}
  const before = JSON.stringify(p);
  assert.equal(equipItem(p, sword.uid).ok, false); assert.equal(JSON.stringify(p), before);
  assert.equal(unequipItem(p, 'offhand').ok, false); assert.equal(JSON.stringify(p), before);
});

test('rings choose two distinct slots; losing belt rows never deletes potions', () => {
  const p = player(), r1 = put(p, 'rin'), r2 = put(p, 'rin');
  assert.ok(equipItem(p, r1.uid).ok); assert.ok(equipItem(p, r2.uid).ok);
  assert.equal(p.equipment.ring1!.uid, r1.uid); assert.equal(p.equipment.ring2!.uid, r2.uid);
  p.strength = 100; const belt = put(p, 'hbl'); assert.ok(equipItem(p, belt.uid).ok);
  const potion = createItem('hp5', 1, fixed); p.belt[12] = potion;
  assert.ok(unequipItem(p, 'belt').ok); assert.equal(p.belt[12], null); assert.ok(p.inventory.some(i => i.uid === potion.uid));
});

test('normal exact rune order makes Leaf once; reverse order and magic bases do not', () => {
  assert.equal(RUNEWORDS.length, 56); assert.ok(RUNEWORDS.some(w => w.name === 'Leaf')); assert.ok(!RUNEWORDS.some(w => w.name === 'Spirit'));
  for (const mode of ['normal', 'reverse', 'magic', 'superior'] as const) {
    const p = player('sor'), staff = createItem('sst', 20, fixed, mode === 'magic' ? 'magic' : mode === 'superior' ? 'superior' : 'normal');
    staff.sockets = 2; staff.mods['skill:36'] = 1; assert.ok(placeItem(p.inventory, staff, 10, 4));
    for (const code of mode === 'reverse' ? ['r08', 'r03'] : ['r03', 'r08']) { const rune = put(p, code); assert.ok(insertSocket(p, staff.uid, rune.uid).ok); assert.ok(!p.inventory.some(i => i.uid === rune.uid)); }
    assert.equal(staff.runeword, mode === 'normal' || mode === 'superior' ? 'Leaf' : undefined);
    assert.equal(staff.mods.minFire, 5); assert.equal(staff.mods.maxFire, 30, 'paired damage endpoints must not be rolled into one scalar');
    assert.equal(staff.mods['skill:36'], mode === 'normal' || mode === 'superior' ? 4 : 1);
    assert.equal(staff.mods.fireSkills ?? 0, mode === 'normal' || mode === 'superior' ? 3 : 0);
    assert.ok(!Object.keys(staff.mods).some(key => key.startsWith('unsupported:fireskill:')));
    const before = JSON.stringify(staff), extra = put(p, 'r03'); assert.equal(insertSocket(p, staff.uid, extra.uid).ok, false); assert.equal(JSON.stringify(staff), before); assert.ok(p.inventory.includes(extra));
  }
});

test('socketing an equipped staff deactivates all bonuses until its raised level requirement is met', () => {
  const p = player('sor'), staff = put(p, 'sst', 20); staff.sockets = 2; staff.mods['skill:36'] = 1;
  assert.equal(equipItem(p, staff.uid).ok, true); assert.equal(skillLevel(p, 36), 1);
  for (const code of ['r03', 'r08']) { const rune = put(p, code); assert.equal(insertSocket(p, staff.uid, rune.uid).ok, true); }
  assert.equal(staff.requiredLevel, 19);
  assert.equal(skillLevel(p, 36), 0); assert.equal(skillLevel(p, 37), 0); assert.equal(deriveStats(p).manaRegenPercent, 0);
  p.level = 18; assert.equal(skillLevel(p, 36), 0);
  p.level = 19; assert.equal(skillLevel(p, 36), 7); assert.equal(skillLevel(p, 37), 6); assert.equal(deriveStats(p).manaRegenPercent, 90);
});

test('Leaf fire bonuses enhance learned Assassin fire skills but native staff grants stay Sorceress-only', () => {
  const p = player('ass'); p.level = 20; p.skills[251] = 1;
  const staff = put(p, 'sst', 20); staff.sockets = 2;
  for (const code of ['r03', 'r08']) { const rune = put(p, code); assert.equal(insertSocket(p, staff.uid, rune.uid).ok, true); }
  assert.equal(equipItem(p, staff.uid).ok, true);
  assert.equal(skillLevel(p, 251), 4); assert.equal(skillLevel(p, 36), 0); assert.equal(skillLevel(p, 37), 0);
  assert.equal(deriveStats(p).manaRegenPercent, 0);
  assert.ok(describeItem(staff).includes('+3 火焰技能'));
  assert.ok(describeItem(staff).some(line => line.includes('未实现属性：ac/lvl')));
});

for (const [index, name] of [
  "Fletcher's", "Acrobat's", "Harpoonist's", 'Burning', 'Sparking', 'Chilling',
  'Hexing', 'Fungal', "Graverobber's", 'Lion Branded', "Captain's", "Preserver's",
  "Expert's", 'Fanatic', 'Sounding', "Trainer's", 'Spiritual', "Nature's", 'Entrapping', "Mentalist's", "Shogukusha's",
].entries()) test(`actual ${name} grand charm maps skilltab ${index} to its native tree`, () => {
  const base = getBase('cm3')!;
  const pool = rawRows('MagicPrefix').filter(row => [1, 100].includes(num(row, 'version')) && num(row, 'spawnable') === 1 && num(row, 'frequency') > 0 && num(row, 'level') <= 99 && (!num(row, 'maxlevel') || num(row, 'maxlevel') >= 99) && !text(row, 'class') &&
    Array.from({ length: 7 }, (_, i) => text(row, `itype${i + 1}`)).filter(Boolean).some(type => itemHasType(base, type)) &&
    !Array.from({ length: 5 }, (_, i) => text(row, `etype${i + 1}`)).filter(Boolean).some(type => itemHasType(base, type)));
  const selected = pool.findIndex(row => text(row, 'Name') === name && text(row, 'mod1code') === 'skilltab');
  assert.ok(selected >= 0);
  assert.equal(num(pool[selected], 'mod1param'), index);
  const total = pool.reduce((sum, row) => sum + num(row, 'frequency'), 0);
  const midpoint = (pool.slice(0, selected).reduce((sum, row) => sum + num(row, 'frequency'), 0) + num(pool[selected], 'frequency') / 2) / total;
  const rolls = [.5, 0, midpoint, .5]; let call = 0;
  const charm = createItem('cm3', 99, () => rolls[call++] ?? .5, 'magic');
  const classId = (['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass'] as ClassId[])[Math.floor(index / 3)], tree = index % 3;
  assert.equal(charm.mods[`skillTab:${classId}:${tree}`], 1);
  assert.ok(!Object.keys(charm.mods).some(key => key.startsWith('unsupported:skilltab:')));
  assert.equal(charm.requiredLevel, 42);
  charm.identified = true;
  assert.ok(describeItem(charm).includes(`+1 ${getClass(classId).trees[tree]}（仅限${getClass(classId).name}）`));
});

test('rune modifiers and local ED apply only once, even after another insertion/save reload', () => {
  const p = player(), sword = put(p, 'crs', 30); sword.sockets = 2;
  for (const code of ['r27', 'r08']) { const rune = put(p, code); assert.ok(insertSocket(p, sword.uid, rune.uid).ok); }
  assert.equal(sword.mods.localDamagePercent, 50); assert.equal(sword.minDamage, 7); assert.equal(sword.maxDamage, 22);
  assert.deepEqual([sword.mods.minFire, sword.mods.maxFire], [5, 30]);
  const saved = JSON.parse(JSON.stringify(sword)) as Item; assert.equal(saved.maxDamage, 22); assert.equal(saved.mods['internal:baseMax'], 15);
  assert.ok(describeItem(sword).some(line => line.includes('5–30')));
});

test('gem insertion uses weapon/body/shield contexts and rejected input is never consumed', () => {
  for (const [code, key, value] of [['sst', 'attackRating', 40], ['qui', 'strength', 3], ['buc', 'defense', 8]] as const) {
    const p = player(), item = put(p, code); item.sockets = 1;
    const gem = put(p, 'gcv'); assert.ok(insertSocket(p, item.uid, gem.uid).ok); assert.equal(item.mods[key], value);
  }
  const p = player(), armor = put(p, 'qui'); armor.sockets = 1; const potion = put(p, 'hp1');
  const before = JSON.stringify(p); assert.equal(insertSocket(p, armor.uid, potion.uid).ok, false); assert.equal(JSON.stringify(p), before);
});

test('three chipped gems upgrade by BetterGem; mixed gems and extra inputs are rejected', () => {
  const p = player(); p.cube = Array.from({ length: 3 }, () => createItem('gcv', 1, fixed));
  assert.ok(transmute(p).ok); assert.equal(p.cube.length, 1); assert.equal(p.cube[0].code, 'gfv'); assert.deepEqual([p.cube[0].x, p.cube[0].y], [0, 0]);
  p.cube = ['gcv', 'gcv', 'gcr'].map(c => createItem(c, 1, fixed)); const before = JSON.stringify(p.cube);
  assert.equal(transmute(p).ok, false); assert.equal(JSON.stringify(p.cube), before);
  p.cube = Array.from({ length: 4 }, () => createItem('gcv', 1, fixed)); assert.equal(transmute(p).ok, false);
});

test('rune upgrades require exact gem and quantities; single player allows ladder-flagged cube recipes', () => {
  const p = player(); p.cube = ['r01', 'r01', 'r01'].map(c => createItem(c, 1, fixed)); assert.ok(transmute(p).ok); assert.equal(p.cube[0].code, 'r02');
  p.cube = ['r10', 'r10', 'r10'].map(c => createItem(c, 1, fixed)); const before = JSON.stringify(p.cube); assert.equal(transmute(p).ok, false); assert.equal(JSON.stringify(p.cube), before);
  p.cube.push(createItem('gcy', 1, fixed)); assert.ok(transmute(p).ok); assert.equal(p.cube[0].code, 'r11');
  p.cube = ['r32', 'r32', 'glg'].map(c => createItem(c, 1, fixed)); assert.ok(transmute(p).ok); assert.equal(p.cube[0].code, 'r33');
  p.cube = ['rvs', 'rvs', 'rvs'].map(c => createItem(c, 1, fixed)); assert.ok(transmute(p).ok); assert.equal(p.cube[0].code, 'rvl');
});

test('socket recipe rejects superior; normal socket count obeys actual ilvl caps and ethereal ebug', () => {
  const p = player(), armor = createItem('qui', 10, () => .01); assert.equal(armor.ethereal, true);
  const defense = armor.defense; p.cube = [armor, ...['r07', 'r10', 'gpy'].map(c => createItem(c, 1, fixed))];
  assert.ok(transmute(p).ok); assert.ok(p.cube[0].sockets >= 1 && p.cube[0].sockets <= 2); assert.equal(p.cube[0].defense, Math.floor(defense * 1.5));
  const superior = createItem('qui', 10, fixed, 'superior'); p.cube = [superior, ...['r07', 'r10', 'gpy'].map(c => createItem(c, 1, fixed))];
  const before = JSON.stringify(p.cube); assert.equal(transmute(p).ok, false); assert.equal(JSON.stringify(p.cube), before);
});

test('Hel clear-sockets restores intrinsic mods and destroys contents, including word bonuses', () => {
  const p = player('sor'), staff = put(p, 'sst', 20); staff.sockets = 2; staff.mods['skill:36'] = 1;
  for (const code of ['r03', 'r08']) assert.ok(insertSocket(p, staff.uid, put(p, code).uid).ok);
  const loaded = JSON.parse(JSON.stringify(staff)) as Item;
  p.cube = [loaded, createItem('r15', 1, fixed), createItem('tsc', 1, fixed)]; assert.ok(transmute(p).ok);
  const result = p.cube[0]; assert.equal(result.uid, staff.uid); assert.equal(result.sockets, 2); assert.equal(result.socketed.length, 0); assert.equal(result.runeword, undefined);
  assert.equal(result.mods['skill:36'], 1); assert.equal(result.mods.minFire, undefined); assert.equal(result.requiredLevel, 0);
  assert.equal(result.mods.fireSkills, undefined); assert.equal(result.mods['skill:37'], undefined);
});

test('potions return exact class coefficients and duration, compact bottom-up without instant healing', () => {
  for (const id of ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass'] as ClassId[]) {
    const p = player(id), beforeLife = p.life, beforeMana = p.mana;
    p.equipment.belt = createItem('lbl', 1, fixed); p.belt[0] = createItem('hp1', 1, fixed); p.belt[4] = createItem('hp2', 1, fixed);
    const r = consumePotion(p, 0); assert.ok(r.ok); assert.equal(r.life, id === 'bar' ? 60 : ['ama', 'pal', 'ass'].includes(id) ? 45 : 30); assert.equal(r.duration * 25, 192);
    assert.equal(p.belt[0]!.code, 'hp2'); assert.equal(p.belt[4], null); assert.equal(p.life, beforeLife);
    p.belt[0] = createItem('mp5', 1, fixed); const m = consumePotion(p, 0); assert.equal(m.mana, id === 'bar' ? 250 : ['ama', 'pal', 'ass'].includes(id) ? 375 : 500); assert.equal(m.duration * 25, 128); assert.equal(p.mana, beforeMana);
    p.belt[0] = createItem('hp3', 1, fixed); assert.equal(consumePotion(p, 0).duration * 25, 171);
  }
  const p = player('sor'); p.belt[0] = createItem('rvs', 1, fixed); const r = consumePotion(p, 0); assert.equal(r.duration, 0); assert.equal(r.life, 14); assert.equal(r.mana, 12.25); assert.equal(p.life, 40);
  assert.equal(consumePotion(p, -1).ok, false); assert.equal(consumePotion(p, 4).ok, false);
});

test('rejuvenations use the same resource caps as derived stats, including active charms', () => {
  for (const code of ['rvs', 'rvl']) {
    const p = player('sor'), charm = createItem('cm1', 1, fixed);
    charm.mods = { life: 20, mana: 25 }; charm.identified = true;
    p.inventory.push(charm);
    const stored = createItem('cm1', 1, fixed); stored.mods = { life: 100, mana: 100 }; stored.identified = true;
    p.stash.push(stored); p.cube.push(structuredClone(stored));
    const inactive = createItem('sst', 1, fixed); inactive.mods = { life: 100, mana: 100 }; p.equipment.weapon2 = inactive;
    p.belt[0] = createItem(code, 1, fixed);
    const result = consumePotion(p, 0);
    assert.equal(result.life, code === 'rvs' ? 21 : 60);
    assert.equal(result.mana, code === 'rvs' ? 21 : 60);
    assert.equal(result.duration, 0); assert.equal(p.belt[0], null);
    assert.equal(p.life, 40); assert.equal(p.mana, 35);
  }
});

test('rejuvenations retain fractional resource caps in frame-bit units', () => {
  const p = player('nec'); p.level = 18;
  p.belt[0] = createItem('rvl', 1, fixed);
  const full = consumePotion(p, 0);
  assert.equal(full.life, 70.5); assert.equal(full.mana, 59);
  const sor = player('sor'), charm = createItem('cm1', 1, fixed);
  charm.identified = true; charm.mods = { life: 20.5, mana: 25.5 }; sor.inventory.push(charm);
  sor.belt[0] = createItem('rvs', 1, fixed);
  const small = consumePotion(sor, 0);
  assert.equal(small.life, 5420 / 256); assert.equal(small.mana, 5420 / 256);
});

test('real rune socket tuples generate usable deadly strike and mana regeneration', () => {
  const p = player(), weapon = put(p, 'hax', 80); weapon.sockets = 1;
  assert.equal(insertSocket(p, weapon.uid, put(p, 'r28', 80).uid).ok, true);
  assert.equal(weapon.mods.deadlyStrike, 20);
  assert.ok(describeItem(weapon).some(line => line.includes('致命攻击')));
  assert.ok(!Object.keys(weapon.mods).some(key => key.startsWith('unsupported:deadly')));
  const helm = put(p, 'cap'); helm.sockets = 1;
  assert.equal(insertSocket(p, helm.uid, put(p, 'r05').uid).ok, true);
  assert.equal(helm.mods.manaRegenPercent, 15);
  assert.ok(describeItem(helm).some(line => line.includes('法力回复速度')));
});

test('MF diminishing returns and quality denominators follow ItemRatio, not uniform rarity', () => {
  assert.equal(effectiveMagicFind(300, 'unique'), 136); assert.equal(effectiveMagicFind(300, 'set'), 187); assert.equal(effectiveMagicFind(300, 'rare'), 200); assert.equal(effectiveMagicFind(300, 'magic'), 300);
  assert.equal(effectiveMagicFind(10, 'unique'), 10); assert.equal(effectiveMagicFind(-5, 'rare'), 0);
  const base = { ...getBase('crs')!, qlvl: 50 };
  assert.equal(qualityDenominator(base, 85, 'unique', 200), 22142); assert.equal(qualityDenominator(base, 85, 'unique', 200, 1024), 1);
  assert.ok(qualityDenominator(base, 85, 'unique', 0) > qualityDenominator(base, 85, 'unique', 200));
  assert.equal(affixLevel(1, 85, 18), 99); assert.equal(affixLevel(28, 11), 23);
});

test('magic/rare affixes honor alvl, types, groups and maximum 3+3; unique/set fixed properties use eligible tables', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const item = createItem('rin', 80, seeded(seed), 'rare');
    assert.equal(item.quality, 'rare'); assert.equal(item.identified, false); assert.ok(Object.keys(item.mods).length > 3);
    assert.ok(item.mods['internal:prefixCount'] <= 3 && item.mods['internal:suffixCount'] <= 3);
    const count = item.mods['internal:prefixCount'] + item.mods['internal:suffixCount'];
    assert.ok(count >= 3 && count <= 6);
    assert.equal(Object.keys(item.mods).filter(key => key.startsWith('internal:affixGroup:')).length, count);
    assert.ok(item.requiredLevel <= 80);
  }
  const unique = createItem('hax', 7, fixed, 'unique'); assert.equal(unique.name, 'The Gnasher'); assert.equal(unique.mods.strength, 8); assert.equal(unique.mods.localDamagePercent, 65); assert.equal(unique.requiredLevel, 5);
  const failed = createItem('hax', 1, fixed, 'unique'); assert.equal(failed.quality, 'rare'); assert.equal(failed.maxDurability, getBase('hax')!.durability * 3);
  assert.equal(createItem('crs', 99, fixed, 'unique').quality, 'rare', 'disabled legacy Crystal Sword Azurewrath must not generate');
  const set = createItem('lgl', 12, fixed, 'set'); assert.equal(set.quality, 'set'); assert.equal(set.ethereal, false);
  unique.identified = true;
  assert.ok(describeItem(unique).some(line => line.includes('未实现属性')));
});

test('recursive real monster TC drops preserve ilvl, NoDrop and seed, exclude quest/unknown items', () => {
  assert.deepEqual(rollLoot(monster('does-not-exist'), fixed, 'normal', 0), []);
  // First pick falls into the actual skeleton TC NoDrop=100, not a synthetic loot table.
  assert.deepEqual(rollLoot(monster(), () => 0, 'normal', 0), []);
  const a = rollLoot(monster(), seeded(5), 'normal', 0), b = rollLoot(monster(), seeded(5), 'normal', 0);
  assert.deepEqual(a.map(i => ({ ...i, uid: '' })), b.map(i => ({ ...i, uid: '' })));
  const all: Item[] = [];
  const rng = seeded(835713);
  for (let sample = 0; sample < 350; sample++) all.push(...rollLoot(monster(), rng, 'normal', 0));
  assert.ok(all.length > 0); assert.ok(all.some(i => getBase(i.code)?.slot), 'generated weap3/armo3 TCs must resolve to raw bases');
  for (const item of all) { assert.equal(item.ilvl, 2); assert.ok(getBase(item.code)); assert.equal(num(getBase(item.code)!.raw, 'quest'), 0); }
  const gold = all.find(i => i.code === 'gld'); assert.ok(gold && gold.quantity > 0);
});

test('all 383 eligible offline unique definitions can be selected, including all 29 ladder-tagged uniques', () => {
  const definitions = rawRows('UniqueItems').filter(row => num(row, 'enabled') === 1 && num(row, 'lvl') <= 99 && num(row, 'rarity') > 0 && text(row, 'index') && getBase(text(row, 'code')));
  assert.equal(definitions.length, 383);
  assert.equal(definitions.filter(row => num(row, 'ladder') === 1).length, 29);
  for (const row of definitions) {
    const code = text(row, 'code'), candidates = definitions.filter(candidate => text(candidate, 'code') === code);
    const position = candidates.indexOf(row), total = candidates.reduce((sum, candidate) => sum + num(candidate, 'rarity'), 0);
    const before = candidates.slice(0, position).reduce((sum, candidate) => sum + num(candidate, 'rarity'), 0);
    const roll = (before + num(row, 'rarity') / 2) / total;
    const item = createItem(code, 99, () => roll, 'unique');
    assert.equal(item.quality, 'unique', text(row, 'index'));
    assert.equal(item.name, text(row, 'index'));
    assert.equal(item.mods['internal:namedRow'], num(row, 'lineNumber', -1));
    assertDisplayOnly(item, `未鉴定的${localizedNames[text(getBase(code)!.raw, 'namestr')]}`);
    item.identified = true;
    assertDisplayOnly(item, localizedNames[text(row, 'index')]);
    assert.equal(item.name, text(row, 'index'), 'localization must retain the exact English named identity');
  }
});

test('gem catalog includes all seven families and five original grades including skulls', () => {
  assert.equal(GEMS.length, 35); assert.equal(new Set(GEMS.map(gem => gem.code)).size, 35);
  for (const type of ['gema', 'gems', 'geme', 'gemr', 'gemd', 'gemt', 'gemz']) {
    const family = GEMS.filter(gem => gem.type === type);
    assert.deepEqual(family.map(gem => gem.grade), [0, 1, 2, 3, 4]);
    assert.match(family[0].name, /^碎裂的/); assert.match(family[4].name, /^完美的/);
    for (const gem of family) { const base = getBase(gem.code)!; assert.ok(itemHasType(base, 'gem')); assert.equal(gem.name, base.name); }
  }
  assert.equal(GEMS.filter(gem => gem.type === 'gemz').length, 5);
});

test('all 35 purchased gem types can be socketed in weapon, armor and shield contexts with original requirements', () => {
  for (const gem of GEMS) for (const code of ['sst', 'qui', 'buc']) {
    const p = player(), target = put(p, code); target.sockets = 1; const source = put(p, gem.code);
    assert.ok(insertSocket(p, target.uid, source.uid).ok, `${gem.code} → ${code}`);
    assert.deepEqual(target.socketed, [gem.code]); assert.ok(!p.inventory.some(item => item.uid === source.uid));
    assert.equal(target.requiredLevel, Math.max(getBase(code)!.requiredLevel, getBase(gem.code)!.requiredLevel));
    assert.deepEqual(JSON.parse(JSON.stringify(target)).mods, target.mods);
  }
});

test('every gem and skull upgrade follows BetterGem and perfect grades cannot be upgraded', () => {
  for (const gem of GEMS) {
    const p = player(); p.cube = Array.from({ length: 3 }, () => createItem(gem.code, 1, fixed));
    const before = structuredClone(p.cube), next = text(getBase(gem.code)!.raw, 'BetterGem');
    const result = transmute(p);
    if (gem.grade < 4) { assert.ok(result.ok, gem.code); assert.equal(p.cube.length, 1); assert.equal(p.cube[0].code, next); }
    else { assert.equal(result.ok, false); assert.deepEqual(p.cube, before); }
  }
});

test('all rune labels show the familiar 1–33 number without changing stored item data', () => {
  for (const rune of RUNES) {
    const item = createItem(rune.code, 1, fixed), before = structuredClone(item);
    assert.equal(itemLabel(item), `${rune.number}号 · ${rune.name}`);
    assert.ok(describeItem(item).includes(`${rune.number}号 · ${rune.name}`));
    assert.deepEqual(item, before);
  }
});

test('explicit Jordan identity has all original properties and never falls back to another ring', () => {
  const jordan = createItem('rin', 39, fixed, 'unique', 'The Stone of Jordan'); jordan.identified = true;
  assert.equal(jordan.name, 'The Stone of Jordan'); assert.equal(jordan.code, 'rin'); assert.equal(jordan.quality, 'unique');
  assert.equal(jordan.requiredLevel, 29); assert.equal(jordan.ilvl, 39);
  for (const [key, value] of Object.entries({ mana: 20, maxManaPercent: 25, allSkills: 1, minLightning: 1, maxLightning: 12 })) assert.equal(jordan.mods[key], value);
  assert.ok(!Object.keys(jordan.mods).some(key => key.startsWith('unsupported:')));
  const before = structuredClone(jordan); assert.equal(itemLabel(jordan), '乔丹之石'); assert.deepEqual(jordan, before);
  assert.ok(describeItem(jordan).includes('+25 最大法力%'));
  assert.match(describeItem(jordan).join(' '), /黑毛事件尚未开放.*不会召唤/);
  assert.throws(() => createItem('rin', 38, fixed, 'unique', 'The Stone of Jordan'), /不能生成/);
  assert.throws(() => createItem('amu', 99, fixed, 'unique', 'The Stone of Jordan'), /不能生成/);
  assert.throws(() => createItem('rin', 99, fixed, 'unique', 'Missing Ring'), /不能生成/);
  assert.throws(() => createItem('rin', 99, fixed, 'magic', 'The Stone of Jordan'), /仅适用于/);
});

test('Jordan level requirement remains 29 and two rings stack without granting unlearned skills', () => {
  const p = player('sor'); p.skills[36] = 1; p.level = 28;
  const first = createItem('rin', 39, fixed, 'unique', 'The Stone of Jordan'); first.identified = true; assert.ok(placeItem(p.inventory, first, 10, 4));
  const before = structuredClone(p); assert.equal(equipItem(p, first.uid).ok, false); assert.deepEqual(p, before);
  p.level = 29; const baseMana = deriveStats(p).maxMana;
  assert.ok(equipItem(p, first.uid).ok); assert.equal(deriveStats(p).maxMana, (baseMana + 20) * 1.25); assert.equal(skillLevel(p, 36), 2); assert.equal(skillLevel(p, 39), 0);
  const second = createItem('rin', 39, fixed, 'unique', 'The Stone of Jordan'); second.identified = true; assert.ok(placeItem(p.inventory, second, 10, 4)); assert.ok(equipItem(p, second.uid).ok);
  assert.notEqual(first.uid, second.uid); assert.equal(p.equipment.ring1!.uid, first.uid); assert.equal(p.equipment.ring2!.uid, second.uid);
  assert.equal(deriveStats(p).maxMana, (baseMana + 40) * 1.5); assert.equal(skillLevel(p, 36), 3);
  assert.ok(unequipItem(p, 'ring1').ok); assert.ok(unequipItem(p, 'ring2').ok); assert.equal(deriveStats(p).maxMana, baseMana); assert.equal(skillLevel(p, 36), 1);
});

test('old English gem names are translated for display without rerolling saved items', () => {
  for (const gem of GEMS) {
    const saved = createItem(gem.code, 1, fixed); saved.name = text(getBase(gem.code)!.raw, 'name');
    const before = structuredClone(saved); assert.equal(itemLabel(saved), gem.name); assert.deepEqual(saved, before);
  }
});

for (const difficulty of ['normal', 'nightmare', 'hell'] as const) test(`convenience shop stocks full rejuvenation, all 33 runes, all 35 gems, Jordan and three disclosed event keys on ${difficulty}`, () => {
  const p = player(); p.difficulty = difficulty;
  const stock = vendorStock(p, seeded(1));
  assert.deepEqual(stock.filter(item => /^r\d{2}$/.test(item.code)).map(item => item.code), RUNES.map(rune => rune.code));
  assert.deepEqual(stock.filter(item => GEMS.some(gem => gem.code === item.code)).map(item => item.code), GEMS.map(gem => gem.code));
  for (const code of ['rvl', ...RUNES.map(rune => rune.code), ...GEMS.map(gem => gem.code), 'pk1', 'pk2', 'pk3']) {
    const offers = stock.filter(item => item.code === code); assert.equal(offers.length, 1);
    const offer = offers[0], base = getBase(code)!;
    assert.equal(offer.price, num(base.raw, 'cost')); assert.ok(offer.price > 0);
    assert.equal(offer.requiredLevel, base.requiredLevel); assert.equal(offer.identified, true);
    assert.equal(offer.ethereal, false); assert.equal(offer.quantity, 1);
    assert.equal(offer.width, base.width); assert.equal(offer.height, base.height);
    if (code.startsWith('pk')) assert.match(describeItem(offer).join(' '), /事件尚未开放.*不能合成事件传送门/);
  }
  const jordans = stock.filter(item => item.name === 'The Stone of Jordan'); assert.equal(jordans.length, 1);
  const jordan = jordans[0]; assert.equal(jordan.price, 14000); assert.equal(jordan.requiredLevel, 29);
  assert.equal(jordan.identified, true); assert.equal(jordan.ethereal, false); assert.equal(jordan.quality, 'unique');
  assert.equal(jordan.mods.maxManaPercent, 25); assert.equal(itemLabel(jordan), '乔丹之石');
  assert.equal(new Set(stock.map(item => item.uid)).size, stock.length);
  assert.ok(!stock.some(item => item.code === 'box'));
  assert.equal(RUNEWORDS.length, 56);
});

test('all 635 runtime bases and legacy English base saves display exact namestr Chinese', () => {
  assert.equal(BASE_ITEMS.length, 635);
  for (const base of BASE_ITEMS) {
    const key = text(base.raw, 'namestr');
    assert.ok(Object.hasOwn(localizedNames, key), `${base.code}: ${key}`);
    assert.equal(base.name, localizedNames[key]);
    assert.match(base.name, /[\u4e00-\u9fff]/, base.code);
    assert.doesNotMatch(base.name, /未收录译名/, base.code);
    const saved = createItem(base.code, 99, fixed);
    saved.name = base.english;
    const label = base.code === 'gld' ? `${saved.quantity} ${base.name}`
      : /^r\d{2}$/.test(base.code) ? `${Number(base.code.slice(1))}号 · ${base.name}` : base.name;
    assertDisplayOnly(saved, label);
  }
});

test('known Blizzard names are pinned rather than guessed or hand-translated', () => {
  for (const [key, expected] of [
    ['sst', '短杖'], ['mpi', '军镐'], ['wnd', '魔杖'], ['qui', '内衬甲'],
    ['glb', '无瑕的蓝宝石'], ['gpv', '完美的紫宝石'], ['Azurewrath', '碧蓝怒火'],
    ['The Gnasher', '血肉撕咬'], ['The Stone of Jordan', '乔丹之石'],
    ["Aldur's Watchtower", '艾尔多的警戒塔'], ["Civerb's Ward", '希弗伯的防护'],
    ['Cruel', '暴虐'], ['of the Magus', '术士之'],
    ['Runeword14', '荣耀之链'], ['Runeword47', '悔恨'], ['Runeword99', '理智之声'],
  ]) assert.equal(itemName(key), expected, key);
  for (const [name, expected] of [
    ['Chains of Honor', '荣耀之链'], ['Bound by Duty', '荣耀之链'], ['Runeword14', '荣耀之链'],
    ['Grief', '悔恨'], ['Widowmaker', '悔恨'], ['Runeword47', '悔恨'],
    ['Voice of Reason', '理智之声'], ['Winter', '理智之声'], ['Runeword99', '理智之声'],
    ['Infinity', '无限'], ['Runeword60', '无限'],
  ]) assert.equal(runewordName(name), expected, name);
});

test('every set item displays its exact localized identity without changing stored English', () => {
  const definitions = rawRows('SetItems').filter(row => text(row, 'index') && text(row, 'item'));
  assert.equal(definitions.length, 127);
  for (const row of definitions) {
    const identity = text(row, 'index'), code = text(row, 'item');
    const item = createItem(code, 99, fixed, 'set', identity);
    assert.equal(item.name, identity); assert.equal(item.quality, 'set');
    assertDisplayOnly(item, `未鉴定的${getBase(code)!.name}`);
    item.identified = true;
    assertDisplayOnly(item, localizedNames[identity]);
    assert.equal(item.name, identity);
  }
});

test('old mixed Chinese and English magic saves preserve identities and use suffix-prefix-base order', () => {
  for (const [code, rawName, expected] of [
    ['ssd', 'Jagged 短剑 of Strength', '力量之参差短剑'],
    ['ssd', 'Jagged Short Sword of Strength', '力量之参差短剑'],
    ['ssd', 'Jagged Short Sword', '参差短剑'],
    ['ssd', 'Short Sword of Strength', '力量之短剑'],
    ['mpi', 'Jagged 军用锹 of Strength', '力量之参差军镐'],
    ['mpi', 'Jagged Military Pick of Strength', '力量之参差军镐'],
    ['sst', '短棍 of the Apprentice', '习法者之短杖'],
    ['sst', 'Short Staff of the Apprentice', '习法者之短杖'],
  ]) {
    const saved = createItem(code, 99, fixed, 'magic');
    saved.identified = true; saved.name = rawName;
    saved.mods.strength = 7; saved.mods['internal:legacy-fixture'] = 99;
    assertDisplayOnly(saved, expected);
  }
});

test('new magic labels across levels 1–99 and many seeds contain only localized affixes and bases', () => {
  const prefixNames = [...new Set(rawRows('MagicPrefix').map(row => text(row, 'Name')).filter(Boolean))].sort((a, b) => b.length - a.length);
  const suffixNames = [...new Set(rawRows('MagicSuffix').map(row => text(row, 'Name')).filter(Boolean))].sort((a, b) => b.length - a.length);
  let withPrefix = 0, withSuffix = 0, withBoth = 0;
  for (let level = 1; level <= 99; level++) for (let seed = 1; seed <= 12; seed++) {
    for (const code of ['ssd', 'sst', 'rin', 'amu', 'cm1', 'cm3', 'ob1', 'jew']) {
      const item = createItem(code, level, seeded(seed * 65537 + level), 'magic'); item.identified = true;
      const prefix = prefixNames.find(name => item.name.startsWith(name + ' '));
      const suffix = suffixNames.find(name => item.name.endsWith(' ' + name));
      if (prefix) withPrefix++; if (suffix) withSuffix++; if (prefix && suffix) withBoth++;
      const expected = [suffix && localizedNames[suffix], prefix && localizedNames[prefix], getBase(code)!.name].filter(Boolean).join('');
      const label = itemLabel(item);
      assert.equal(label, expected, `${code}, ilvl=${level}, seed=${seed}, raw=${item.name}`);
      assert.match(label, /[\u4e00-\u9fff]/);
      assert.doesNotMatch(label, /[a-z]|未收录译名/i);
      assertDisplayOnly(item, expected);
    }
  }
  assert.ok(withPrefix > 0 && withSuffix > 0 && withBoth > 0, 'exercise all affix arrangements');
});

test('old English rune names including Zod keep their numbered Chinese display and save data', () => {
  for (const rune of RUNES) {
    for (const rawName of [getBase(rune.code)!.english, rune.code === 'r33' ? 'Zod' : getBase(rune.code)!.english.replace(/ Rune$/, '')]) {
      const saved = createItem(rune.code, 1, fixed); saved.name = rawName;
      assertDisplayOnly(saved, `${rune.number}号 · ${localizedNames[rune.code]}`);
    }
  }
  const zod = createItem('r33', 1, fixed); zod.name = 'Zod';
  assertDisplayOnly(zod, '33号 · 佐德符文');
});

test('runeword display and descriptions never mutate English rule identities or persisted player data', () => {
  const p = player();
  for (const word of RUNEWORDS) {
    const item = createItem('sst', 99, fixed);
    item.name = 'Short Staff'; item.runeword = word.name;
    item.sockets = word.runes.length; item.socketed = [...word.runes];
    item.mods['internal:persisted-word'] = 1;
    p.inventory.push(item); p.stash.push(structuredClone(item)); p.cube.push(structuredClone(item));
    assert.equal(runewordName(word.name), localizedNames[text(word.raw, 'Name')]);
    assertDisplayOnly(item, localizedNames[text(word.raw, 'Name')]);
    assert.equal(item.runeword, word.name); assert.equal(item.name, 'Short Staff');
  }
  assert.ok(RUNEWORDS.some(word => word.name === 'Leaf'));
  const persisted = JSON.stringify(p), loaded = JSON.parse(persisted) as Player;
  for (const item of [...loaded.inventory, ...loaded.stash, ...loaded.cube]) {
    assertDisplayOnly(item, runewordName(item.runeword!));
    assert.doesNotMatch(describeItem(item).slice(0, 3).join(' '), /[a-z]|未收录译名/i);
  }
  assert.equal(JSON.stringify(loaded), persisted);
});

test('inventory potion consumption removes only the exact UID and leaves belt and resources unchanged', () => {
  for (const classId of ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass'] as ClassId[]) {
    for (const code of ['hp1', 'hp5', 'mp1', 'mp5', 'rvs', 'rvl']) {
      const p = player(classId), first = put(p, code), selected = put(p, code), last = put(p, code);
      p.equipment.belt = createItem('hbl', 1, fixed);
      p.belt[0] = createItem(code, 1, fixed); p.belt[4] = createItem('hp2', 1, fixed);
      const charm = put(p, 'cm1'); charm.identified = true; charm.mods = { life: 20.5, mana: 25.5 };
      p.stash.push(createItem(code, 1, fixed)); p.cube.push(createItem(code, 1, fixed));
      const before = structuredClone(p), beltPlayer = structuredClone(p);
      beltPlayer.belt[0] = structuredClone(selected);
      const expected = consumePotion(beltPlayer, 0), result = consumeInventoryPotion(p, selected.uid);
      assert.equal(result.ok, true); assert.deepEqual(result, expected, `${classId}: ${code}`);
      assert.deepEqual(p, { ...before, inventory: before.inventory.filter(item => item.uid !== selected.uid) });
      assert.deepEqual(p.inventory.map(item => item.uid), [first.uid, last.uid, charm.uid]);
      assert.deepEqual(selected, before.inventory[1]);
      const after = structuredClone(p);
      assert.equal(consumeInventoryPotion(p, selected.uid).ok, false, 'the same UID cannot be consumed twice');
      assert.deepEqual(p, after);
    }
  }
});

test('usable-item boundaries do not consume scrolls, books, unimplemented potions or unknown inventory UIDs', () => {
  const usable = ['hp1', 'hp2', 'hp3', 'hp4', 'hp5', 'mp1', 'mp2', 'mp3', 'mp4', 'mp5', 'rvs', 'rvl', 'tsc', 'isc', 'tbk', 'ibk'];
  for (const base of BASE_ITEMS) assert.equal(isUsableItem(createItem(base.code, 1, fixed)), usable.includes(base.code), base.code);
  const p = player();
  for (const code of ['tsc', 'isc', 'tbk', 'ibk', 'yps', 'wms', 'vps', 'r33', 'gpb', 'pk1', 'box', 'ssd']) {
    const item = put(p, code), before = structuredClone(p);
    assert.deepEqual(consumeInventoryPotion(p, item.uid), { ok: false, message: '此药水状态效果尚未实现', life: 0, mana: 0, duration: 0 });
    assert.deepEqual(p, before);
  }
  for (const code of ['hp0', 'hp6', 'mp6', 'rvx', 'hp1extra', 'HP1', 'unknown']) {
    const item = { ...createItem('hp1', 1, fixed), code }; p.inventory.push(item);
    assert.equal(isUsableItem(item), false, code);
    const before = structuredClone(p);
    assert.equal(consumeInventoryPotion(p, item.uid).ok, false); assert.deepEqual(p, before);
  }
  const beltPotion = createItem('hp1', 1, fixed), storedPotion = createItem('hp1', 1, fixed);
  p.belt[0] = beltPotion; p.stash.push(storedPotion); p.cube.push(createItem('hp1', 1, fixed));
  for (const uid of ['', 'unknown-uid', beltPotion.uid, storedPotion.uid, p.cube[0].uid]) {
    const before = structuredClone(p), result = consumeInventoryPotion(p, uid);
    assert.equal(result.ok, false); assert.deepEqual([result.life, result.mana, result.duration], [0, 0, 0]);
    assert.deepEqual(p, before);
  }
});

test('vendor excludes quest cube and repair is transactional, excludes ethereal', () => {
  const p = player(); const stock = vendorStock(p, seeded(1));
  for (const code of ['hp1', 'mp1', 'tsc', 'isc', 'tbk', 'ibk']) assert.ok(stock.some(i => i.code === code));
  assert.ok(stock.every(i => i.code !== 'box' && !i.ethereal)); assert.ok(!stock.some(i => i.code === 'hp5'));
  p.level = 40; assert.ok(vendorStock(p, seeded(1)).some(i => i.code === 'hp5'));
  p.equipment.weapon = createItem('hax', 1, fixed); p.equipment.weapon.durability = 1;
  p.equipment.body = createItem('qui', 1, () => 0); p.equipment.body.durability = 0;
  const cost = repairCost(p); assert.ok(cost > 0); const before = JSON.stringify(p);
  assert.equal(repairItems(p).ok, false); assert.equal(JSON.stringify(p), before);
  p.gold = cost; assert.ok(repairItems(p).ok); assert.equal(p.gold, 0); assert.equal(p.equipment.weapon.durability, p.equipment.weapon.maxDurability); assert.equal(p.equipment.body.durability, 0);
});
