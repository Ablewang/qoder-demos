import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES, EXPERIENCE, getClass, getSkill, num, rawRows, rawTables, SKILLS, text } from '../src/catalog';
import { allocateSkill, allocateStat, blockChance, createPlayer, deriveStats, grantExperience, hitChance, leechAmount, manaRegeneration, resistDamage, skillEffect, skillLevel, SHRINES, getShrine, setTemporaryShrine } from '../src/rules';
import type { ClassId, Item, ItemMods } from '../src/types';
import { createItem, effectiveItemModifiers, effectiveItemStats, getBase, insertSocket, namedItemRow } from '../src/items';
import { activeEquipment, equipmentModifiers } from '../src/rules';

function item(code: string, mods: ItemMods = {}, extra: Partial<Item> = {}): Item {
  return {
    uid: `test-${code}`, code, name: code, quality: 'normal', ilvl: 1, width: 1, height: 1,
    x: 0, y: 0, identified: true, ethereal: false, durability: 10, maxDurability: 10,
    minDamage: 0, maxDamage: 0, defense: 0, mods, sockets: 0, socketed: [], requiredLevel: 0,
    price: 0, quantity: 1, ...extra,
  };
}
test('supported shrine definitions retain exact pinned arguments, frame durations and reset minutes',()=>{
  assert.deepEqual(SHRINES.map(s=>s.code),[1,6,7,8,9,10,11,12,13,14,15,17,18]);
  for(const shrine of SHRINES){const raw=rawRows('shrines').find(r=>num(r,'Code')===shrine.code)!;
    assert.equal(shrine.arg0,num(raw,'Arg0')); assert.equal(shrine.arg1,num(raw,'Arg1'));
    assert.equal(shrine.duration,num(raw,'Duration in frames')); assert.equal(shrine.resetFrames,num(raw,'reset time in minutes')*1500);
  }
  assert.equal(getShrine(2),undefined); assert.equal(getShrine(19),undefined);
});
test('temporary shrine modifiers are additive to native buckets, replace rather than stack, and never serialize',()=>{
  const p=createPlayer('sor','临时祝福'); p.strength=0; p.skills={36:1,37:1};
  p.equipment={weapon:item('hax',{}, {minDamage:10,maxDamage:20}),body:item('qui',{}, {defense:100})};
  const snapshot=structuredClone(p),base=deriveStats(p);
  setTemporaryShrine(p,6); assert.equal(deriveStats(p).defense,base.defense*2);
  setTemporaryShrine(p,7); const combat=deriveStats(p); assert.equal(combat.attackRating,base.attackRating*3); assert.equal(combat.minDamage,30); assert.equal(combat.maxDamage,60); assert.equal(combat.defense,base.defense);
  for(const [code,key,element] of [[8,'resFire','fire'],[9,'resCold','cold'],[10,'resLightning','lightning'],[11,'resPoison','poison']] as const){
    p.difficulty='hell'; setTemporaryShrine(p,code); const stats=deriveStats(p);
    assert.equal(stats[key],-25); assert.equal(stats.resistances[element].stored,-25); assert.equal(stats.resistances[element].maximum,75);
  }
  p.difficulty='normal'; setTemporaryShrine(p,13); assert.equal(deriveStats(p).manaRegenPercent,base.manaRegenPercent+400);
  setTemporaryShrine(p,12); assert.equal(skillLevel(p,36),3); assert.equal(skillLevel(p,37),3); assert.equal(skillLevel(p,47),0);
  assert.equal(skillEffect(p,36).min,6); assert.equal(deriveStats(p).manaRegenPercent,54);
  assert.deepEqual(p,snapshot); assert.deepEqual(deriveStats(structuredClone(p)),base);
  setTemporaryShrine(p); assert.deepEqual(deriveStats(p),base); assert.equal(skillLevel(p,36),1);
});
test('skill shrine cannot unlock foreign/unsupported skills or create hard-point synergies',()=>{
  const p=createPlayer('sor','技能边界'); p.skills={36:1,47:1,61:1,64:1};
  const before=skillEffect(p,36); setTemporaryShrine(p,12);
  assert.equal(skillLevel(p,64),1,'unsupported Frozen Orb does not get a pretend runtime level'); assert.equal(skillLevel(p,70),0);
  const reference=structuredClone(p); reference.skills[36]+=2;
  assert.deepEqual(skillEffect(p,36),skillEffect(reference,36),'other learned soft points must not increase hard-point synergies');
  assert.ok(skillEffect(p,36).min>before.min); assert.equal(p.skills[47],1); setTemporaryShrine(p);
});
test('experience shrine applies after native penalties and disappears on replacement or death',()=>{
  const p=createPlayer('sor','经验祝福'); p.level=90; p.experience=EXPERIENCE[90]; const reference=structuredClone(p),earned=grantExperience(reference,80,100000);
  setTemporaryShrine(p,15); assert.equal(grantExperience(p,80,100000),Math.floor(earned*1.5));
  setTemporaryShrine(p,6); const plain=structuredClone(p); assert.equal(grantExperience(p,80,100000),grantExperience(plain,80,100000));
  setTemporaryShrine(p,15); p.dead=true; assert.equal(grantExperience(p,80,100000),0); assert.equal(deriveStats(p).allSkills,0);
});

const starts: [ClassId, number[], number[], number[]][] = [
  // Str/Dex/Vit/Ene, life/mana/stamina, life/lvl,mana/lvl,stamina/lvl,life/Vit,mana/Ene,stamina/Vit,block,AR
  ['ama', [20, 25, 20, 15], [50, 15, 84], [2, 1.5, 1, 3, 1.5, 1, 25, 5]],
  ['sor', [10, 25, 10, 35], [40, 35, 74], [1, 2, 1, 2, 2, 1, 20, -15]],
  ['nec', [15, 25, 15, 25], [45, 25, 79], [1.5, 2, 1, 2, 2, 1, 20, -10]],
  ['pal', [25, 20, 25, 15], [55, 15, 89], [2, 1.5, 1, 3, 1.5, 1, 30, 20]],
  ['bar', [30, 20, 25, 10], [55, 10, 92], [2, 1, 1, 4, 1, 1, 25, 20]],
  ['dru', [15, 20, 25, 20], [55, 20, 84], [1.5, 2, 1, 2, 2, 1, 20, 5]],
  ['ass', [20, 20, 20, 25], [50, 25, 95], [2, 1.5, 1.25, 3, 1.75, 1.25, 25, 15]],
];
for (const [id, attributes, resources, growth] of starts) {
  test(`${id}: exact pinned starting stats and quarter-unit growth`, () => {
    const def = getClass(id), player = createPlayer(id, '测试'), stats = deriveStats(player);
    assert.deepEqual([def.strength, def.dexterity, def.vitality, def.energy], attributes);
    assert.deepEqual([player.strength, player.dexterity, player.vitality, player.energy], attributes);
    assert.deepEqual([player.life, player.mana, player.stamina], resources);
    assert.deepEqual([stats.maxLife, stats.maxMana, stats.maxStamina], resources);
    assert.deepEqual([def.lifePerLevel, def.manaPerLevel, def.staminaPerLevel, def.lifePerVitality, def.manaPerEnergy, def.staminaPerVitality, def.blockFactor, def.arFactor], growth);
    assert.equal(stats.attackRating, 5 * (attributes[1] - 7) + growth[7]);
    assert.equal(stats.block, 0); // class block factor alone grants no shield block
    assert.equal(player.statPoints, 0); assert.equal(player.skillPoints, 0);
    assert.deepEqual(player.skills, {}); assert.deepEqual(player.equipment, {});
    assert.deepEqual(player.inventory, []); assert.deepEqual(player.stash, []); assert.deepEqual(player.cube, []);
    assert.equal(player.belt.length, 16); assert.ok(player.belt.every(slot => slot === null));
    assert.deepEqual(player.waypoints, [1]); assert.equal(player.unlockedActs, 1); assert.equal(player.unlockedDifficulties, 1);
    assert.equal(player.running, true); assert.equal(player.weaponSwap, false); assert.equal(player.dead, false);
    assert.equal(player.leftSkill, 0); assert.equal(player.rightSkill, id === 'sor' ? 36 : id === 'nec' ? 70 : 0);
    player.level = 2;
    assert.deepEqual([deriveStats(player).maxLife, deriveStats(player).maxMana, deriveStats(player).maxStamina], resources.map((value, i) => value + growth[i]));
    player.vitality++; player.energy++;
    assert.deepEqual([deriveStats(player).maxLife, deriveStats(player).maxMana, deriveStats(player).maxStamina], resources.map((value, i) => value + growth[i] + growth[i + 3]));
  });
}

test('catalog loads pinned tables under node and preserves exact case and wrappers', () => {
  assert.equal(CLASSES.length, 7); assert.equal(rawRows('CHARSTATS').length, 7);
  assert.equal(rawRows('missing').length, 0); assert.ok('ItemStatCost' in rawTables); assert.ok('Missiles' in rawTables);
  assert.ok(!('itemstatcost' in rawTables));
  assert.equal(text({ value: '"min(24,ln12)"' }, 'value'), 'min(24,ln12)');
  assert.equal(num({ value: '"7"' }, 'value'), 7); assert.equal(num({ value: '' }, 'value', 9), 9);
  assert.equal(num({ value: 'not numeric' }, 'value', 9), 9); assert.equal(text({}, 'missing', 'fallback'), 'fallback');
});
test('all 210 class skills join numeric IDs, zero-based tree coordinates and hard prerequisite IDs', () => {
  assert.equal(SKILLS.length, 210); assert.equal(new Set(SKILLS.map(skill => skill.id)).size, 210);
  for (const def of CLASSES) {
    assert.equal(SKILLS.filter(skill => skill.classId === def.id).length, 30);
    for (let tree = 0; tree < 3; tree++) assert.equal(SKILLS.filter(skill => skill.classId === def.id && skill.tree === tree).length, 10);
  }
  for (const skill of SKILLS) {
    assert.ok(skill.row >= 0 && skill.row < 6); assert.ok(skill.column >= 0 && skill.column < 3);
    assert.ok([1, 6, 12, 18, 24, 30].includes(skill.level));
    for (const id of skill.prerequisites) assert.equal(getSkill(id)?.classId, skill.classId);
    if (!skill.supported) assert.match(skill.description, /未实现/);
  }
  assert.deepEqual([getSkill(36)?.tree, getSkill(36)?.row, getSkill(36)?.column], [0, 0, 1]);
  assert.deepEqual(getSkill(47)?.prerequisites, [36]);
  assert.deepEqual(getSkill(59)?.prerequisites, [44, 55]);
  assert.deepEqual(getSkill(64)?.prerequisites, [59]); assert.equal(getSkill(64)?.level, 30);
  assert.equal(getSkill(251)?.key, 'Fire Trauma'); assert.equal(getSkill(251)?.name, '火焰爆震');
  assert.equal(getSkill(99999), undefined);
  assert.ok(SKILLS.filter(skill => skill.supported).length < 35);
  for (const id of [6, 10, 38, 49, 59, 64, 66, 70, 75, 106, 221, 225, 229, 234, 253]) assert.equal(getSkill(id)?.supported, false);
});
test('XP array indexes entered clvl, not Experience.txt row Level', () => {
  assert.equal(EXPERIENCE.length, 100);
  assert.deepEqual(EXPERIENCE.slice(1, 5), [0, 500, 1500, 3750]);
  assert.equal(EXPERIENCE[99], 3_520_485_254);
  for (let level = 2; level <= 99; level++) assert.ok(EXPERIENCE[level] > EXPERIENCE[level - 1]);
});
test('500 XP enters level 2, 1500 XP enters level 3, gaining only free points and refilling resources', () => {
  const player = createPlayer('sor', '法师'); player.life = 1; player.mana = 0;
  assert.equal(grantExperience(player, 1, 499), 499); assert.equal(player.level, 1);
  assert.equal(player.life, 1); assert.equal(player.mana, 0);
  assert.equal(grantExperience(player, 1, 1), 1); assert.equal(player.level, 2);
  assert.equal(player.statPoints, 5); assert.equal(player.skillPoints, 1);
  assert.deepEqual([player.life, player.mana, player.stamina], [41, 37, 75]);
  assert.equal(grantExperience(player, 2, 1000), 1000); assert.equal(player.level, 3);
  assert.equal(player.experience, 1500); assert.equal(player.statPoints, 10); assert.equal(player.skillPoints, 2);
  assert.deepEqual([player.life, player.mana, player.stamina], [42, 39, 76]);
  assert.equal(player.vitality, 10); assert.equal(player.energy, 35);
});
test('single XP grant crosses multiple thresholds', () => {
  const player = createPlayer('ass', '刺客');
  assert.equal(grantExperience(player, 1, 1500), 1500); assert.equal(player.level, 3);
  assert.equal(player.statPoints, 10); assert.equal(player.skillPoints, 2); assert.equal(player.stamina, 97.5);
});
test('exact /256 level gaps and current-clvl /1024 high-level penalties', () => {
  const check = (level: number, mlvl: number, xp: number, expected: number): void => {
    const player = createPlayer('bar', '野蛮人'); player.level = level; player.experience = EXPERIENCE[level];
    assert.equal(grantExperience(player, mlvl, xp), expected);
  };
  check(20, 30, 10000, 195); check(20, 29, 10000, 1484); check(20, 14, 10000, 8085);
  check(80, 85, 100000, 45587); check(90, 85, 100000, 5957); check(90, 84, 100000, 4816);
  check(30, 24, 2_000_000, Math.floor(2_000_000 / 256) * 207);
  check(70, 70, 3_000_000, Math.floor(3_000_000 / 1024) * 976);
  const capped = createPlayer('pal', '圣骑士'); capped.level = 98; capped.experience = EXPERIENCE[99] - 1;
  assert.equal(grantExperience(capped, 98, 1000), 1); assert.equal(capped.level, 99);
  assert.equal(grantExperience(capped, 99, 1000), 0); assert.equal(capped.experience, EXPERIENCE[99]);
});
test('stat allocation mutates only with a free point', () => {
  const player = createPlayer('nec', '死灵法师'), before = structuredClone(player);
  assert.equal(allocateStat(player, 'vitality'), false); assert.deepEqual(player, before);
  player.statPoints = 1; assert.equal(allocateStat(player, 'vitality'), true);
  assert.equal(player.vitality, 16); assert.equal(player.statPoints, 0); assert.equal(deriveStats(player).maxLife, 47);
});
test('skill allocation requires class, points, clvl tier and hard prerequisites', () => {
  const player = createPlayer('sor', '法师');
  assert.equal(allocateSkill(player, 36).ok, false);
  player.skillPoints = 10;
  assert.equal(allocateSkill(player, 67).ok, false); assert.equal(allocateSkill(player, 0).ok, false);
  assert.equal(allocateSkill(player, 47).ok, false);
  player.level = 12; player.equipment.weapon = item('sst', { 'skill:36': 1, allSkills: 5 });
  assert.equal(skillLevel(player, 36), 6); assert.equal(player.skills[36], undefined);
  const before = structuredClone(player);
  assert.equal(allocateSkill(player, 47).ok, false); assert.deepEqual(player, before);
  assert.equal(allocateSkill(player, 36).ok, true); assert.equal(allocateSkill(player, 47).ok, true);
  assert.equal(allocateSkill(player, 47).ok, false); // tier12: only H1 at clvl12
  player.level = 13; assert.equal(allocateSkill(player, 47).ok, true);
});
test('20 hard point cap independent of equipment bonuses; tier30 reaches H20 at clvl49', () => {
  const player = createPlayer('sor', '法师'); player.level = 49; player.skillPoints = 50; player.skills[59] = 1;
  player.equipment.weapon = item('sst', { allSkills: 10 });
  for (let i = 0; i < 20; i++) assert.equal(allocateSkill(player, 64).ok, true);
  assert.equal(skillLevel(player, 64), 30);
  const before = structuredClone(player); assert.equal(allocateSkill(player, 64).ok, false); assert.deepEqual(player, before);
  player.skills[64] = 18; player.level = 48;
  assert.equal(allocateSkill(player, 64).ok, true); assert.equal(allocateSkill(player, 64).ok, false);
});
test('+all/class skills only augment learned or staff-granted skills in the active weapon set', () => {
  const player = createPlayer('sor', '法师');
  player.strength = 12; // Quilted Armor's actual strength requirement is not bypassed by this skill fixture.
  player.equipment.body = item('qui', { allSkills: 2, classSkills: 1, 'classSkill:sor': 3 });
  assert.equal(skillLevel(player, 36), 0);
  player.equipment.weapon = item('sst', { 'skill:36': 1 });
  assert.equal(skillLevel(player, 36), 7);
  player.equipment.weapon2 = item('sst', { 'skill:39': 2, allSkills: 4 });
  assert.equal(skillLevel(player, 39), 0); player.weaponSwap = true;
  assert.equal(skillLevel(player, 36), 0); assert.equal(skillLevel(player, 39), 12);
  assert.equal(skillLevel(player, 0), 1);
});
test('pinned Fire Bolt level1 is 3–6 HP, not proposed 2–4; mana remains exactly 2.5', () => {
  const row = getSkill(36)!.raw;
  assert.deepEqual([num(row, 'EMin'), num(row, 'EMax'), num(row, 'HitShift')], [6, 12, 7]);
  const player = createPlayer('sor', '法师'); player.skills[36] = 1;
  const effect = skillEffect(player, 36);
  assert.equal(effect.kind, 'projectile'); assert.equal(effect.element, 'fire'); assert.equal(effect.supported, true);
  assert.deepEqual([effect.min, effect.max, effect.mana], [3, 6, 2.5]);
});
test('damage brackets preserve half-HP increments and switch at 8/16/22/28', () => {
  const player = createPlayer('sor', '法师');
  for (const [level, min, max] of [[1, 3, 6], [2, 4.5, 7.5], [8, 13.5, 16.5], [9, 15.5, 19.5], [16, 29.5, 40.5], [17, 33.5, 45.5], [22, 53.5, 70.5], [23, 62.5, 80.5], [28, 107.5, 130.5], [29, 134.5, 158.5]]) {
    player.skills[36] = level;
    const effect = skillEffect(player, 36); assert.deepEqual([effect.min, effect.max], [min, max], `skill level ${level}`);
  }
});
test('synergies count hard points only and truncate in 1/256 HP, mastery applies afterward', () => {
  const player = createPlayer('sor', '法师'); player.skills[36] = 1; player.skills[47] = 1;
  assert.deepEqual([skillEffect(player, 36).min, skillEffect(player, 36).max], [890 / 256, 1781 / 256]);
  player.equipment.weapon = item('sst', { 'skill:47': 10 });
  assert.equal(skillLevel(player, 47), 11);
  assert.deepEqual([skillEffect(player, 36).min, skillEffect(player, 36).max], [890 / 256, 1781 / 256]);
  player.skills[61] = 1;
  assert.deepEqual([skillEffect(player, 36).min, skillEffect(player, 36).max], [1157 / 256, 2315 / 256]);
});
test('preview fields preserve data for unsupported skills without claiming execution', () => {
  const player = createPlayer('sor', '法师');
  const bolt = skillEffect(player, 38); assert.deepEqual([bolt.min, bolt.max, bolt.mana, bolt.projectiles], [2, 4, 3, 3]); assert.equal(bolt.supported, false);
  const nova = skillEffect(player, 48); assert.deepEqual([nova.min, nova.max, nova.mana], [1, 20, 15]); assert.equal(nova.supported, false);
  const blizzard = skillEffect(player, 59); assert.deepEqual([blizzard.min, blizzard.max], [45, 75]); assert.equal(blizzard.supported, false);
  const nec = createPlayer('nec', '死灵法师'); const teeth = skillEffect(nec, 67);
  assert.deepEqual([teeth.min, teeth.max, teeth.projectiles], [2, 4, 2]); assert.equal(teeth.supported, false);
  assert.equal(skillEffect(nec, 70).supported, false);
  const ass = createPlayer('ass', '刺客'); const fire = skillEffect(ass, 251);
  assert.deepEqual([fire.min, fire.max, fire.mana, fire.radius], [3, 4, 3, 5]);
  assert.equal(fire.supported, true);
  const hammer = skillEffect(ass, 253); assert.equal(hammer.supported, false); assert.match(hammer.description, /双通道/);
  const teleport = skillEffect(player, 54); assert.equal(teleport.mana, 24); assert.equal(teleport.kind, 'teleport');
  player.skills[54] = 30; assert.equal(skillEffect(player, 54).mana, 1);
});
test('cold duration uses three raw frame brackets and exposes seconds to the engine', () => {
  const player = createPlayer('sor', '法师'); player.skills[39] = 1;
  assert.equal(skillEffect(player, 39).duration, 6);
  player.skills[39] = 2; assert.equal(skillEffect(player, 39).duration, 7.4);
  player.skills[39] = 17; assert.equal(skillEffect(player, 39).duration, 28.4);
});
test('all skill previews are finite and supported flags never exceed the catalog whitelist', () => {
  for (const skill of SKILLS) {
    const player = createPlayer(skill.classId, '测试');
    player.skills[skill.id] = 1;
    const before = structuredClone(player), effect = skillEffect(player, skill.id);
    for (const value of [effect.min, effect.max, effect.mana, effect.radius, effect.projectiles, effect.duration]) assert.ok(Number.isFinite(value), skill.key);
    if (effect.supported) assert.equal(skill.supported, true);
    assert.deepEqual(player, before);
  }
});
test('restricted expression parser refuses external code and preserves player state', () => {
  const player = createPlayer('sor', '法师'), row = getSkill(36)!.raw;
  const original = row.EDmgSymPerCalc, before = structuredClone(player);
  try {
    row.EDmgSymPerCalc = 'globalThis.__rulesExecuted = 1';
    const effect = skillEffect(player, 36);
    assert.equal(effect.supported, false); assert.match(effect.description, /公式尚不可执行/);
    assert.equal((globalThis as Record<string, unknown>).__rulesExecuted, undefined); assert.deepEqual(player, before);
  } finally { row.EDmgSymPerCalc = original; }
});
test('deriveStats includes inventory charms, excludes storage/inactive/broken/unidentified mods and has no side effects', () => {
  const player = createPlayer('sor', '法师');
  player.equipment.weapon = item('sst', { energy: 2, allSkills: 1 });
  player.equipment.weapon2 = item('sst', { energy: 100, allSkills: 10 });
  player.equipment.head = item('cap', { vitality: 100 }, { durability: 0 });
  player.equipment.neck = item('amu', { energy: 100 }, { identified: false, quality: 'magic' });
  player.inventory.push(item('cm1', { vitality: 2, mana: 3 }), item('sst', { vitality: 100 }), item('cm2', { vitality: 100 }, { identified: false }));
  player.stash.push(item('cm1', { energy: 100 })); player.cube.push(item('cm1', { energy: 100 }));
  const before = structuredClone(player), stats = deriveStats(player);
  assert.equal(stats.vitality, 12); assert.equal(stats.energy, 37); assert.equal(stats.maxLife, 44); assert.equal(stats.maxMana, 42);
  assert.equal(stats.allSkills, 1); assert.deepEqual(player, before);
});
test('maximum mana percent multiplies hard energy, level growth and flat mana but not item energy', () => {
  for (const [id] of starts) {
    const player = createPlayer(id, '法力测试'), def = getClass(id); player.level = 29; player.energy += 5;
    player.equipment.ring1 = item('rin', { mana: 20, maxManaPercent: 25 });
    player.equipment.neck = item('amu', { energy: 7 });
    const manaBase = def.mana + 28 * def.manaPerLevel + 5 * def.manaPerEnergy + 20;
    const expected = Math.floor((manaBase * 1.25 + 7 * def.manaPerEnergy) * 256) / 256;
    const before = structuredClone(player); assert.equal(deriveStats(player).maxMana, expected); assert.deepEqual(player, before);
    player.equipment.ring2 = item('rin', { mana: 20, maxManaPercent: 25 }, { quality: 'unique' });
    assert.equal(deriveStats(player).maxMana, Math.floor(((manaBase + 20) * 1.5 + 7 * def.manaPerEnergy) * 256) / 256);
    player.equipment.ring2.identified = false; assert.equal(deriveStats(player).maxMana, expected);
    delete player.equipment.ring1; delete player.equipment.ring2;
    assert.equal(deriveStats(player).maxMana, def.mana + 28 * def.manaPerLevel + 12 * def.manaPerEnergy);
  }
});

test('local weapon/armor ED is already applied; strength and off-weapon ED are additive', () => {
  const player = createPlayer('bar', '野蛮人');
  player.equipment.weapon = item('hax', { localDamagePercent: 100, minDamage: 3, maxDamage: 5 }, { minDamage: 20, maxDamage: 40 });
  player.equipment.body = item('qui', { damagePercent: 50, defensePercent: 100 }, { defense: 100 });
  let stats = deriveStats(player);
  assert.deepEqual([stats.minDamage, stats.maxDamage], [36, 72]); assert.equal(stats.defense, 105);
  player.equipment.offhand = item('hax', { localDamagePercent: 500, minDamage: 100, maxDamage: 100, attackRating: 1000, ias: 100 }, { minDamage: 500, maxDamage: 1000 });
  stats = deriveStats(player); assert.deepEqual([stats.minDamage, stats.maxDamage], [36, 72]); assert.equal(stats.attackRating, 85); assert.equal(stats.ias, 0);
});
test('weapon raw StrBonus/DexBonus, global flat damage, and active shield block', () => {
  const player = createPlayer('ama', '亚马逊'); player.running = false;
  player.equipment.weapon = item('jav', {}, { minDamage: 10, maxDamage: 20 });
  player.equipment.ring1 = item('rin', { minDamage: 2, maxDamage: 4 });
  assert.deepEqual([deriveStats(player).minDamage, deriveStats(player).maxDamage], [15, 31]);
  player.equipment.offhand = item('buc', {}, { defense: 5 });
  assert.equal(deriveStats(player).block, 75); player.running = true; assert.equal(deriveStats(player).block, 75);
  player.weaponSwap = true; assert.equal(deriveStats(player).block, 0);
});
test('resist difficulty penalties, caps, quest bonuses, utility mods and known passives', () => {
  const player = createPlayer('bar', '野蛮人'); player.bonusResist = 10; player.bonusLife = 20;
  player.equipment.ring1 = item('rin', { resAll: 20, resFire: 100, magicFind: 10, goldFind: 20, fcr: 30, fhr: 40, frw: 50, lifeLeech: 5, manaLeech: 6, damageReduction: 99, flatReduction: 7 });
  let stats = deriveStats(player); assert.deepEqual([stats.resFire, stats.resCold], [75, 30]); assert.equal(stats.maxLife, 75);
  assert.deepEqual([stats.magicFind, stats.goldFind, stats.fcr, stats.fhr, stats.frw, stats.lifeLeech, stats.manaLeech, stats.damageReduction, stats.flatReduction], [10, 20, 30, 40, 50, 5, 6, 50, 7]);
  player.difficulty = 'nightmare'; assert.equal(deriveStats(player).resCold, -10);
  player.difficulty = 'hell'; assert.equal(deriveStats(player).resCold, -70);
  player.skills[153] = 1; player.skills[145] = 1; player.skills[141] = 1;
  stats = deriveStats(player); assert.equal(stats.resCold, -58); assert.equal(stats.defense, 6); assert.equal(stats.maxStamina, 119.59765625);
  for (const id of [141, 145, 153]) assert.equal(skillEffect(player, id).supported, true);
  const amazon = createPlayer('ama', '亚马逊'); amazon.skills[23] = 1;
  assert.equal(deriveStats(amazon).attackRating, 128); assert.equal(skillEffect(amazon, 23).supported, true);
});
test('belt rows come from actual Belts layout (Heavy Belt is three rows)', () => {
  const player = createPlayer('pal', '圣骑士'); player.strength = 200; player.level = 99;
  assert.equal(deriveStats(player).beltRows, 1);
  for (const [code, rows] of [['lbl', 2], ['vbl', 2], ['mbl', 3], ['tbl', 3], ['hbl', 4], ['zlb', 4], ['ulc', 4]] as const) {
    player.equipment.belt = item(code); assert.equal(deriveStats(player).beltRows, rows, code);
  }
});
test('hit chance clamps to 5–95%, uses level ratio, running defender bypasses AR', () => {
  assert.equal(hitChance(100, 100, 10, 10), 50); assert.equal(hitChance(100, 100, 10, 30), 25);
  assert.equal(hitChance(0, 100, 1, 99), 5); assert.equal(hitChance(1_000_000, 0, 99, 1), 95);
  assert.equal(hitChance(0, 1_000_000, 1, 99, true), 100);
});
test('block chance caps final formula at 75%, running divides capped chance by three', () => {
  assert.equal(blockChance(75, 175, 80), 75); assert.equal(blockChance(75, 175, 80, true), 25);
  assert.equal(blockChance(75, 100, 80), 39); assert.equal(blockChance(75, 100, 80, true), 13);
  assert.equal(blockChance(100, 100, 80), 53); assert.equal(blockChance(100, 10, 1), 0);
  assert.equal(blockChance(0, 200, 1), 0);
});
test('resistance damage retains 1/256 points, handles immunity and clamps negative resistance', () => {
  assert.equal(resistDamage(101, 75), 25.25); assert.equal(resistDamage(100, 100), 0);
  assert.equal(resistDamage(100, 150), 0); assert.equal(resistDamage(100, -40), 140);
  assert.equal(resistDamage(100, -200), 200); assert.equal(resistDamage(-10, 0), 0);
  assert.equal(resistDamage(1 / 256, 50), 0); assert.equal(resistDamage(3 / 256, 50), 1 / 256);
});
test('mana regeneration uses two frame-bit floors, not an exact 120-second approximation', () => {
  assert.equal(manaRegeneration(3000), 1); assert.equal(manaRegeneration(3000, 30), 332 / 256);
  assert.equal(manaRegeneration(35), 2 / 256); assert.equal(manaRegeneration(0), 0);
  assert.equal(manaRegeneration(900, 258) * 25, 26.5625);
  assert.equal(manaRegeneration(3000, -200), 0);
});
test('Critical Strike uses effective skill levels and excludes unlearned skills and inactive bonuses', () => {
  const player = createPlayer('ama', '暴击');
  assert.equal(deriveStats(player).criticalStrike, 0);
  for (const [level, chance] of [[1, 16], [2, 25], [3, 32], [20, 68]]) {
    player.skills[9] = level; assert.equal(deriveStats(player).criticalStrike, chance);
  }
  player.skills[9] = 1; player.equipment.weapon = item('hax', { allSkills: 1 });
  player.equipment.weapon2 = item('hax', { allSkills: 19 });
  assert.equal(deriveStats(player).criticalStrike, 25); assert.equal(skillEffect(player, 9).supported, true);
  player.skills = {}; assert.equal(deriveStats(player).criticalStrike, 0);
});
test('attacking modifiers include active charms and armor but not the other weapon or storage', () => {
  const player = createPlayer('bar', '来源');
  player.equipment.weapon = item('hax', { deadlyStrike: 20, minFire: 10, maxFire: 20 });
  player.equipment.offhand = item('hax', { deadlyStrike: 90, minFire: 100, maxFire: 100 });
  player.equipment.body = item('qui', { deadlyStrike: 15, minMagic: 2, maxMagic: 3 });
  player.inventory.push(item('cm1', { minFire: 4, maxFire: 5, minCold: 6, maxCold: 7, coldLength: 50 }));
  player.stash.push(item('cm1', { deadlyStrike: 100, maxFire: 100 }));
  player.cube.push(item('cm1', { maxMagic: 100 }));
  player.equipment.weapon2 = item('hax', { deadlyStrike: 100, maxFire: 100 });
  const stats = deriveStats(player);
  assert.equal(stats.deadlyStrike, 35);
  assert.deepEqual(stats.elementalDamage, { fire: { min: 14, max: 25 }, cold: { min: 6, max: 7 }, lightning: { min: 0, max: 0 }, magic: { min: 2, max: 3 } });
  assert.equal(stats.coldLength, 50);
  player.equipment.weapon!.durability = 0; player.equipment.body!.quality = 'magic'; player.equipment.body!.identified = false;
  assert.equal(deriveStats(player).deadlyStrike, 0); assert.equal(deriveStats(player).elementalDamage.fire.max, 5);
});
test('Warmth and active equipment regeneration add before the second floor', () => {
  const player = createPlayer('sor', '暖气');
  assert.equal(deriveStats(player).manaRegenPercent, 0);
  player.skills[37] = 1; assert.equal(deriveStats(player).manaRegenPercent, 30);
  player.skills[37] = 20; player.equipment.head = item('cap', { manaRegenPercent: 15 });
  player.equipment.weapon2 = item('sst', { manaRegenPercent: 100 });
  assert.equal(deriveStats(player).manaRegenPercent, 273); assert.equal(skillEffect(player, 37).supported, true);
  player.equipment.head!.durability = 0; assert.equal(deriveStats(player).manaRegenPercent, 258);
});
test('leech truncates in 1/256 units after difficulty and monster drain', () => {
  assert.equal(leechAmount(100, 10, 100, 'normal'), 10);
  assert.equal(leechAmount(100, 10, 100, 'nightmare'), 5);
  assert.equal(leechAmount(100, 1, 100, 'hell'), 84 / 256);
  assert.equal(leechAmount(3, 10, 100, 'normal'), 76 / 256);
  assert.equal(leechAmount(100, 10, 50, 'normal'), 5);
  assert.equal(leechAmount(100, 10, 0, 'normal'), 0);
});
test('Fire Ball damage radius comes from server hit parameters, not client visuals', () => {
  const player = createPlayer('sor', '火球'); player.skills[47] = 1;
  assert.equal(skillEffect(player, 47).radius, 4);
});

test('native single skills never grant another class spells or Warmth regeneration', () => {
  for (const def of CLASSES.filter(def => def.id !== 'sor')) {
    const player = createPlayer(def.id, '职业边界');
    player.skills = { 36: 20, 37: 20 };
    player.equipment.weapon = item('sst', { 'skill:36': 3, 'skill:37': 3, allSkills: 2, fireSkills: 3 });
    assert.equal(skillLevel(player, 36), 0);
    assert.equal(skillLevel(player, 37), 0);
    assert.equal(deriveStats(player).manaRegenPercent, 0);
  }
});

test('all 21 skill tabs enhance only unlocked native skills on the matching tree', () => {
  for (const def of CLASSES) for (let tree = 0; tree < 3; tree++) {
    const player = createPlayer(def.id, '技能树');
    player.equipment.head = item('cap', { [`skillTab:${def.id}:${tree}`]: 2 });
    for (const skill of SKILLS.filter(skill => skill.classId === def.id)) {
      assert.equal(skillLevel(player, skill.id), 0);
      player.skills[skill.id] = 1;
      assert.equal(skillLevel(player, skill.id), skill.tree === tree ? 3 : 1);
    }
    player.equipment.head!.mods = { 'skillTab:foreign:0': 50 };
    for (const skill of SKILLS.filter(skill => skill.classId === def.id)) assert.equal(skillLevel(player, skill.id), 1);
  }
});

test('fire skill bonuses use EType across native classes, include Warmth, and never unlock alone', () => {
  for (const def of CLASSES) {
    const player = createPlayer(def.id, '火焰类型');
    player.equipment.head = item('cap', { fireSkills: 3 });
    for (const skill of SKILLS.filter(skill => skill.classId === def.id)) {
      assert.equal(skillLevel(player, skill.id), 0);
      player.skills[skill.id] = 1;
      assert.equal(skillLevel(player, skill.id), text(skill.raw, 'EType') === 'fire' ? 4 : 1);
    }
  }
  const player = createPlayer('sor', '暖气'); player.skills[37] = 1;
  player.equipment.head = item('cap', { fireSkills: 3 });
  assert.equal(deriveStats(player).manaRegenPercent, 66);
});

test('fire and tab bonuses ignore storage, inactive weapons, unidentified and broken items', () => {
  const player = createPlayer('sor', '来源'); player.skills = { 36: 1, 39: 1 };
  const mods = { fireSkills: 3, 'skillTab:sor:0': 2 };
  player.equipment.weapon = item('sst', mods);
  player.equipment.weapon2 = item('sst', { fireSkills: 100 });
  player.equipment.head = item('cap', mods, { durability: 0 });
  player.equipment.neck = item('amu', mods, { quality: 'magic', identified: false });
  player.inventory = [item('cm3', mods), item('cm3', mods, { identified: false })];
  player.stash = [item('cm3', mods)]; player.cube = [item('cm3', mods)];
  assert.equal(skillLevel(player, 36), 11); assert.equal(skillLevel(player, 39), 1);
  player.weaponSwap = true;
  assert.equal(skillLevel(player, 36), 106);
  player.inventory = []; player.equipment.weapon2!.durability = 0;
  assert.equal(skillLevel(player, 36), 1);
});

test('charm level requirements apply to skill bonuses and all derived attributes', () => {
  const player = createPlayer('sor', '护符等级'); player.level = 41; player.skills[36] = 1;
  player.inventory.push(item('cm3', { 'skillTab:sor:0': 1, life: 20, mana: 25 }, { requiredLevel: 42 }));
  assert.equal(skillLevel(player, 36), 1);
  assert.equal(deriveStats(player).maxLife, 80); assert.equal(deriveStats(player).maxMana, 115);
  player.level = 42;
  assert.equal(skillLevel(player, 36), 2);
  assert.equal(deriveStats(player).maxLife, 101); assert.equal(deriveStats(player).maxMana, 142);
});

test('fire and tab soft points do not enter Fire Bolt hard-point synergies', () => {
  const player = createPlayer('sor', '协同'); player.skills = { 36: 1, 47: 1 };
  player.equipment.head = item('cap', { fireSkills: 3, 'skillTab:sor:0': 2 });
  assert.equal(skillLevel(player, 36), 6); assert.equal(skillLevel(player, 47), 6);
  assert.deepEqual([skillEffect(player, 36).min, skillEffect(player, 36).max], [3118 / 256, 4008 / 256]);
  player.skills[47] = 2;
  assert.deepEqual([skillEffect(player, 36).min, skillEffect(player, 36).max], [3548 / 256, 4561 / 256]);
});

function unique(name: string): Item {
  const row = rawRows('UniqueItems').find(row => text(row, 'index') === name)!;
  const result = createItem(text(row, 'code'), 99, () => .5, 'unique', name); result.identified = true;
  return result;
}
for (const level of [1, 8, 50, 99]) test(`actual per-level sources at clvl ${level}: Headstriker/Ali Baba/AR/HP retain exact coefficients and targets`, () => {
  const head = unique('Headstriker'), ali = unique('Blade of Ali Baba'), ar = unique('Pus Spiter'), shako = unique('Harlequin Crest');
  const snapshot = JSON.stringify([head, ali, ar, shako]);
  assert.equal(head.mods['perLevel:dmg/lvl'], 8); assert.equal(head.mods['perLevel:deadly/lvl'], 12);
  const mods = effectiveItemModifiers(head, level), damage = effectiveItemStats(head, mods);
  assert.equal(mods.localMaxDamage, level); assert.equal(mods.deadlyStrike, Math.floor(level * 1.5));
  assert.equal(damage.minDamage, head.minDamage); assert.equal(damage.maxDamage, head.maxDamage + level);
  assert.equal(effectiveItemModifiers(ali, level).goldFind, Math.floor(level * 2.5)); assert.equal(effectiveItemModifiers(ali, level).magicFind, level);
  assert.equal(effectiveItemModifiers(ar, level).attackRating, level * 5, 'attack op param is 1, not the usual 3');
  assert.equal(effectiveItemModifiers(shako, level).lifePerLevelBonus, level * 1.5); assert.equal(effectiveItemModifiers(shako, level).manaPerLevelBonus, level * 1.5);
  const warlord = unique("Warlord's Trust"); assert.equal(effectiveItemModifiers(warlord, level).vitality, Math.floor(level / 2));
  assert.equal(JSON.stringify([head, ali, ar, shako]), snapshot);
  assert.deepEqual(effectiveItemModifiers(JSON.parse(JSON.stringify(shako)) as Item, level), effectiveItemModifiers(shako, level));
});

test('max-only /lvl ED and armor local target changes recompute rather than multiply saved display damage', () => {
  const hell = unique('Hellslayer'), base = getBase(hell.code)!;
  const original = JSON.stringify(hell);
  for (const level of [1, 8, 50, 99, 8, 1]) {
    const mods = effectiveItemModifiers(hell, level), scaled = effectiveItemStats(hell, mods);
    assert.equal(mods.localMaxDamagePercent, level * 3);
    assert.equal(scaled.minDamage, hell.minDamage);
    assert.equal(scaled.maxDamage, Math.floor(hell.mods['internal:baseMax'] * (200 + level * 3) / 100));
    assert.equal(hell.mods['internal:baseMax'], base.maxDamage);
  }
  assert.equal(JSON.stringify(hell), original);
  const p = createPlayer('sor', '叶子本地防御'); p.level = 19;
  const staff = createItem('sst', 99, () => .5); staff.sockets = 2; p.inventory.push(staff);
  for (const code of ['r03', 'r08']) { const rune = createItem(code, 99, () => .5); p.inventory.push(rune); assert.equal(insertSocket(p, staff.uid, rune.uid).ok, true); }
  p.equipment.weapon = staff; p.inventory = [];
  assert.equal(staff.mods['perLevel:ac/lvl'], 16);
  for (const level of [19, 50, 99, 19]) { p.level = level; assert.equal(deriveStats(p).defense, 6 + level * 2); }
  assert.equal(staff.defense, 0);
});

test('level up/down changes local damage, deadly strike, MF/GF and per-level resource fractions without changing rolls', () => {
  const p = createPlayer('bar', '动态等级'); p.strength = p.dexterity = 1000;
  const head = unique('Headstriker'), ali = unique('Blade of Ali Baba');
  p.equipment = { weapon: head, offhand: ali };
  const original = JSON.stringify(p.equipment);
  for (const level of [50, 99, 50, 8, 1]) {
    p.level = level; const stats = deriveStats(p);
    if (level >= 39) {
      assert.equal(stats.deadlyStrike, Math.min(100, Math.floor(level * 1.5)));
      assert.equal(stats.magicFind, level); assert.equal(stats.goldFind, Math.floor(level * 2.5));
      assert.equal(stats.maxDamage, Math.floor((head.maxDamage + level) * (100 + p.strength + 15) / 100));
    } else { assert.equal(stats.magicFind, 0); assert.equal(stats.deadlyStrike, 0); }
    assert.equal(JSON.stringify(p.equipment), original);
  }
  const hp = createItem('rin', 99, () => .5); hp.mods = { 'perLevel:hp/lvl': 1, 'perLevel:mana/lvl': 1 }; p.equipment = { ring1: hp };
  for (const level of [1, 8, 50, 99, 1]) {
    p.level = level; const plain = deriveStats({ ...p, equipment: {} }), stats = deriveStats(p);
    assert.equal(stats.maxLife - plain.maxLife, level / 8); assert.equal(stats.maxMana - plain.maxMana, level / 8);
  }
});

test('maximum life percent multiplies base/hard vitality/flat life, not item vitality or per-level HP', () => {
  for (const def of CLASSES) {
    const p = createPlayer(def.id, '生命类别'); p.level = 8; p.vitality += 5; p.bonusLife = 20;
    p.equipment.ring1 = item('rin', { maxLifePercent: 25, life: 30, vitality: 7, 'perLevel:hp/lvl': 1 });
    const base = def.life + 7 * def.lifePerLevel + 5 * def.lifePerVitality + 20 + 30;
    assert.equal(deriveStats(p).maxLife, Math.trunc((base * 1.25 + 7 * def.lifePerVitality + 1) * 256) / 256);
    p.equipment.ring1!.identified = false;
    assert.equal(deriveStats(p).maxLife, def.life + 7 * def.lifePerLevel + 5 * def.lifePerVitality + 20);
  }
});

test('all four maximum resists use the playerResistance 95 cap, and magic reduction is exposed without pretending to consume it', () => {
  const p = createPlayer('pal', '抗性上限');
  p.equipment.ring1 = item('rin', { resAll: 200, maxResAll: 5, maxResFire: 10, maxResCold: 50, maxResLightning: 15, maxResPoison: 1, flatMagicReduction: 7 });
  const stats = deriveStats(p);
  assert.deepEqual(Object.values(stats.resistances).map(res => [res.stored, res.maximum, res.effective]), [[200,90,90],[200,95,95],[200,95,95],[200,81,81]]);
  assert.equal(stats.flatMagicReduction, 7);
  p.equipment.ring1!.identified = false; assert.equal(deriveStats(p).flatMagicReduction, 0); assert.equal(deriveStats(p).resFire, 0);
});

test('offhand weapon dynamic local damage, IAS, leech, elemental damage and AR never leak into the attacking weapon', () => {
  const p = createPlayer('bar', '动态双持'); p.level = 99; p.strength = p.dexterity = 1000;
  const main = createItem('hax', 99, () => .5), offhand = unique("Schaefer's Hammer");
  offhand.mods.lifeLeech = 90; offhand.mods.manaLeech = 90;
  p.equipment = { weapon: main, offhand };
  const before = deriveStats({ ...p, equipment: { weapon: main } }), stats = deriveStats(p);
  assert.equal(stats.minDamage, before.minDamage); assert.equal(stats.maxDamage, before.maxDamage);
  assert.equal(stats.attackRating, before.attackRating); assert.equal(stats.ias, 0); assert.equal(stats.lifeLeech, 0); assert.equal(stats.manaLeech, 0);
  assert.equal(stats.elementalDamage.lightning.max, 0); assert.equal(stats.maxLife, before.maxLife + 50, 'non-attack resource bonuses still apply');
});

test('set-wide endpoint ranges have a once-persisted owner and runtime refresh never calls random', () => {
  const p = createPlayer('sor', '套装源'); p.level = 99; p.strength = p.dexterity = 1000;
  const names = ["Cathan's Seal", "Cathan's Sigil", "Cathan's Mesh", "Cathan's Visage", "Cathan's Rule"];
  const pieces = names.map(name => {
    const row = rawRows('SetItems').find(row => text(row, 'index') === name)!;
    const piece = createItem(text(row, 'item'), 99, () => .5, 'set', name); piece.identified = true; return piece;
  });
  p.equipment = { ring1: pieces[0], neck: pieces[1], body: pieces[2], head: pieces[3], weapon: pieces[4] };
  assert.equal(pieces[0].mods['conditional:wide2:minFire'], 15); assert.equal(pieces[0].mods['conditional:wide2:maxFire'], 20);
  const snapshot = JSON.stringify(p), stats = deriveStats(p), mods = equipmentModifiers(p);
  assert.equal(mods.minFire, 15); assert.equal(mods.maxFire, 30, 'Cathan Rule adds its intrinsic 10 maximum fire damage'); assert.equal(stats.flatMagicReduction, 3);
  const rng = Math.random;
  try {
    Math.random = () => { throw new Error('refresh cannot roll'); };
    for (let i = 0; i < 10; i++) { assert.deepEqual(deriveStats(p), stats); assert.deepEqual(equipmentModifiers(p), mods); }
    const loaded = JSON.parse(snapshot); assert.deepEqual(deriveStats(loaded), stats); assert.equal(JSON.stringify(loaded), snapshot);
    delete p.equipment.ring1; assert.equal(equipmentModifiers(p).minFire, 15); assert.equal(equipmentModifiers(p).maxFire, 30);
  } finally { Math.random = rng; }
});
