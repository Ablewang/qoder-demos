import { getClass, getSkill, num, rawRows, SKILLS, text, EXPERIENCE } from './catalog';
import type { ClassId, DerivedStats, Difficulty, Element, Item, ItemMods, Player, RawRow, SkillEffect, Slot, StatKey } from './types';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const fixed = (value: number): number => Math.trunc(value * 256) / 256;
const weaponRows = new Map(rawRows('weapons').map(row => [text(row, 'code'), row]));
const armorRows = new Map(rawRows('armor').map(row => [text(row, 'code'), row]));
const miscRows = new Map(rawRows('misc').map(row => [text(row, 'code'), row]));
const rawSkills = new Map(rawRows('skills').map(row => [num(row, 'Id'), row]));
const rawMissiles = new Map(rawRows('Missiles').map(row => [text(row, 'Missile'), row]));
const bySkillName = new Map(SKILLS.map(skill => [skill.key.toLowerCase(), skill]));
const xpRatios = new Map(rawRows('experience').map(row => [num(row, 'Level', -1), num(row, 'ExpRatio', 1024)]));

export function createPlayer(classId: ClassId, name: string): Player {
  const def = getClass(classId);
  // Starting equipment/potions are granted by items/engine, not this pure state factory.
  return {
    classId, name, level: 1, experience: 0, difficulty: 'normal',
    strength: def.strength, dexterity: def.dexterity, vitality: def.vitality, energy: def.energy,
    statPoints: 0, skillPoints: 0, skills: {}, life: def.life, mana: def.mana, stamina: def.stamina,
    gold: 0, inventory: [], stash: [], cube: [], equipment: {}, belt: Array(16).fill(null), weaponSwap: false,
    quests: {}, waypoints: [1], unlockedActs: 1, unlockedDifficulties: 1,
    bonusLife: 0, bonusResist: 0, leftSkill: 0, rightSkill: classId === 'sor' ? 36 : classId === 'nec' ? 70 : 0,
    running: true, dead: false, x: 0, y: 0,
  };
}

function usable(item: Item): boolean {
  return item.maxDurability <= 0 || item.durability > 0;
}
function effectiveMods(item: Item): ItemMods {
  return item.identified || ['low', 'normal', 'superior'].includes(item.quality) ? item.mods : {};
}
function activeEquipment(player: Player): [Slot, Item][] {
  const excluded = player.weaponSwap ? ['weapon', 'offhand'] : ['weapon2', 'offhand2'];
  return (Object.entries(player.equipment) as [Slot, Item][])
    .filter(([slot, item]) => !excluded.includes(slot) && !!item && player.level >= item.requiredLevel && usable(item));
}
function activeItems(player: Player): Item[] {
  return [...activeEquipment(player).map(([, item]) => item), ...player.inventory.filter(item => {
    const type = text(miscRows.get(item.code) ?? {}, 'type');
    return item.identified && player.level >= item.requiredLevel && (['cm1', 'cm2', 'cm3'].includes(item.code) || ['char', 'scha', 'mcha', 'lcha'].includes(type));
  })];
}
function sumMods(items: Item[]): ItemMods {
  const result: ItemMods = {};
  for (const item of items) {
    for (const [key, value] of Object.entries(effectiveMods(item))) {
      if (Number.isFinite(value)) result[key] = (result[key] ?? 0) + value;
    }
  }
  return result;
}
export function skillLevel(player: Player, skillId: number): number {
  if (skillId === 0) return 1;
  const skill = getSkill(skillId);
  if (!skill || player.classId !== skill.classId) return 0;
  const mods = sumMods(activeItems(player));
  const hard = Math.max(0, player.skills[skillId] ?? 0);
  const granted = Math.max(0, mods[`skill:${skillId}`] ?? 0);
  if (hard + granted <= 0) return 0;
  const classBonus = (mods.classSkills ?? 0) + (mods[`classSkill:${player.classId}`] ?? 0);
  const treeBonus = mods[`skillTab:${player.classId}:${skill.tree}`] ?? 0;
  const fireBonus = text(skill.raw, 'EType') === 'fire' ? (mods.fireSkills ?? 0) : 0;
  return Math.max(0, hard + granted + (mods.allSkills ?? 0) + classBonus + treeBonus + fireBonus);
}

function linear(row: RawRow, level: number, first: number): number {
  return num(row, `Param${first}`) + (level - 1) * num(row, `Param${first + 1}`);
}
function diminishing(row: RawRow, level: number, first: number): number {
  const a = num(row, `Param${first}`), b = num(row, `Param${first + 1}`);
  const percent = Math.min(100, Math.trunc(110 * level / (level + 6)));
  return a + Math.trunc((b - a) * percent / 100);
}

// Restricted data-expression interpreter. No eval/Function, property access,
// JavaScript identifiers, assignments, or executable strings are accepted.
// Integer division and diminishing-return inner truncation match skillcalc units.
function calculate(expression: string, player: Player, row: RawRow, level: number): number {
  if (!expression) return 0;
  if (expression.length > 2048) throw new Error('Skill expression too long');
  type Token = { value: string; kind: 'number' | 'word' | 'string' | 'symbol' };
  const tokens: Token[] = [];
  const pattern = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z_0-9]*)|'([^']*)'|(>=|<=|==|!=|&&|\|\||[()+\-*/%,?:.<>!]))/y;
  let offset = 0;
  while (offset < expression.length) {
    if (!expression.slice(offset).trim()) break;
    pattern.lastIndex = offset;
    const match = pattern.exec(expression);
    if (!match) throw new Error('Unsupported skill expression token');
    tokens.push({ value: match[1] ?? match[2] ?? match[3] ?? match[4], kind: match[1] !== undefined ? 'number' : match[2] !== undefined ? 'word' : match[3] !== undefined ? 'string' : 'symbol' });
    if (tokens.length > 512) throw new Error('Too many skill expression tokens');
    offset = pattern.lastIndex;
  }
  let index = 0, depth = 0;
  const peek = (): string => tokens[index]?.value ?? '';
  const accept = (symbol: string): boolean => { if (peek() !== symbol) return false; index++; return true; };
  const expect = (symbol: string): void => { if (!accept(symbol)) throw new Error(`Expected ${symbol}`); };
  const variable = (name: string, source = row, effective = level, hard = player.skills[num(source, 'Id')] ?? 0): number => {
    if (name === 'lvl') return effective;
    if (name === 'blvl') return hard;
    if (name === 'ulvl') return player.level;
    const param = /^par([1-8])$/.exec(name);
    if (param) return num(source, `Param${param[1]}`);
    const ln = /^ln(12|34|56|78)$/.exec(name);
    if (ln) return effective > 0 ? linear(source, effective, Number(ln[1][0])) : 0;
    const dm = /^dm(12|34|56|78)$/.exec(name);
    if (dm) return effective > 0 ? diminishing(source, effective, Number(dm[1][0])) : 0;
    throw new Error(`Unsupported skill variable ${name}`);
  };
  const primary = (): number => {
    if (++depth > 64) throw new Error('Skill expression nesting too deep');
    let result: number;
    const token = tokens[index++];
    if (!token) throw new Error('Incomplete skill expression');
    if (token.kind === 'number') result = Number(token.value);
    else if (token.value === '(') { result = conditional(); expect(')'); }
    else if (token.kind === 'word') {
      const name = token.value;
      if (name === 'skill') {
        expect('(');
        const reference = tokens[index++];
        if (reference?.kind !== 'string') throw new Error('Expected internal skill name');
        expect('.');
        const field = tokens[index++];
        if (field?.kind !== 'word') throw new Error('Expected skillcalc field');
        expect(')');
        const other = bySkillName.get(reference.value.toLowerCase());
        if (!other) throw new Error('Unknown referenced skill');
        result = variable(field.value, other.raw, skillLevel(player, other.id), player.skills[other.id] ?? 0);
      } else if (name === 'min' || name === 'max') {
        expect('(');
        const a = conditional(); expect(','); const b = conditional(); expect(')');
        result = name === 'min' ? Math.min(a, b) : Math.max(a, b);
      } else result = variable(name);
    } else throw new Error('Unsupported skill expression');
    depth--;
    return result;
  };
  const unary = (): number => {
    if (accept('-')) return -primary();
    if (accept('+')) return primary();
    if (accept('!')) return primary() ? 0 : 1;
    return primary();
  };
  const product = (): number => {
    let value = unary();
    while (['*', '/', '%'].includes(peek())) {
      const op = tokens[index++].value, right = unary();
      if ((op === '/' || op === '%') && right === 0) throw new Error('Zero divisor');
      value = op === '*' ? value * right : op === '/' ? Math.trunc(value / right) : value % right;
    }
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (['+', '-'].includes(peek())) {
      const op = tokens[index++].value, right = product();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  };
  const compare = (): number => {
    let value = sum();
    while (['<', '>', '<=', '>=', '==', '!='].includes(peek())) {
      const op = tokens[index++].value, right = sum();
      value = Number(op === '<' ? value < right : op === '>' ? value > right : op === '<=' ? value <= right : op === '>=' ? value >= right : op === '==' ? value === right : value !== right);
    }
    return value;
  };
  const and = (): number => {
    let value = compare();
    while (accept('&&')) { const right = compare(); value = Number(!!value && !!right); }
    return value;
  };
  const or = (): number => {
    let value = and();
    while (accept('||')) { const right = and(); value = Number(!!value || !!right); }
    return value;
  };
  const conditional = (): number => {
    const condition = or();
    if (!accept('?')) return condition;
    const yes = conditional(); expect(':'); const no = conditional();
    return condition ? yes : no;
  };
  const result = conditional();
  if (index !== tokens.length || !Number.isFinite(result)) throw new Error('Invalid skill expression');
  return result;
}
function passiveValue(player: Player, id: number): number {
  const skill = getSkill(id), level = skillLevel(player, id);
  if (!skill || level <= 0) return 0;
  return calculate(text(skill.raw, 'passivecalc1'), player, skill.raw, level);
}

export function deriveStats(player: Player): DerivedStats {
  const def = getClass(player.classId), equipment = activeEquipment(player), items = activeItems(player);
  const mods = sumMods(items), mod = (key: string): number => mods[key] ?? 0;
  const strength = Math.max(0, player.strength + mod('strength'));
  const dexterity = Math.max(0, player.dexterity + mod('dexterity'));
  const vitality = Math.max(0, player.vitality + mod('vitality'));
  const energy = Math.max(0, player.energy + mod('energy'));
  const levels = player.level - 1;
  const maxLife = fixed(Math.max(1, def.life + levels * def.lifePerLevel + (vitality - def.vitality) * def.lifePerVitality + mod('life') + player.bonusLife));
  const manaBase = def.mana + levels * def.manaPerLevel + (player.energy - def.energy) * def.manaPerEnergy + mod('mana');
  const maxMana = fixed(Math.max(0, manaBase * (100 + mod('maxManaPercent')) / 100 + (energy - player.energy) * def.manaPerEnergy));
  const baseStamina = def.stamina + levels * def.staminaPerLevel + (vitality - def.vitality) * def.staminaPerVitality + mod('stamina');
  const maxStamina = fixed(Math.max(0, baseStamina * (100 + passiveValue(player, 141)) / 100));
  // Defense/min/max already contain each item's local ED. Never apply it again.
  const armorDefense = equipment.reduce((total, [, item]) => total + item.defense, 0);
  const globalDefensePercent = items.reduce((total, item) => total + (armorRows.has(item.code) ? 0 : effectiveMods(item).defensePercent ?? 0), 0);
  const defense = Math.max(0, Math.floor((Math.floor(dexterity / 4) + armorDefense) * (100 + globalDefensePercent + passiveValue(player, 145)) / 100));
  const weaponSlot: Slot = player.weaponSwap ? 'weapon2' : 'weapon';
  const offhandSlot: Slot = player.weaponSwap ? 'offhand2' : 'offhand';
  const weapon = equipment.find(([slot]) => slot === weaponSlot)?.[1];
  const offhand = equipment.find(([slot]) => slot === offhandSlot)?.[1];
  const weaponRow = weapon ? weaponRows.get(weapon.code) : undefined;
  const offhandWeapon = offhand && weaponRows.has(offhand.code) ? offhand : undefined;
  const localOffhand = offhandWeapon ? effectiveMods(offhandWeapon) : {};
  const attackMod = (key: string): number => mod(key) - (localOffhand[key] ?? 0);
  const elementalDamage = Object.fromEntries((['fire', 'cold', 'lightning', 'magic'] as const).map(element => {
    const suffix = element[0].toUpperCase() + element.slice(1);
    return [element, { min: Math.max(0, attackMod('min' + suffix)), max: Math.max(0, attackMod('max' + suffix)) }];
  })) as DerivedStats['elementalDamage'];
  const attackRating = Math.max(0, Math.floor((5 * (dexterity - 7) + def.arFactor + mod('attackRating') - (localOffhand.attackRating ?? 0)) * (100 + mod('attackRatingPercent') - (localOffhand.attackRatingPercent ?? 0) + passiveValue(player, 23)) / 100));
  const statDamagePercent = weaponRow
    ? (strength * num(weaponRow, 'StrBonus') + dexterity * num(weaponRow, 'DexBonus')) / 100
    : strength;
  // localDamagePercent on the attacking weapon is baked in; on other items it
  // is off-weapon enhanced damage (for example an ED jewel in body armor).
  const globalDamagePercent = mod('damagePercent') + items.reduce((total, item) => total + (weaponRows.has(item.code) ? 0 : effectiveMods(item).localDamagePercent ?? 0), 0);
  const damageMultiplier = Math.max(0, (100 + statDamagePercent + globalDamagePercent) / 100);
  const flatMin = items.reduce((total, item) => total + (weaponRows.has(item.code) ? 0 : effectiveMods(item).minDamage ?? 0), 0);
  const flatMax = items.reduce((total, item) => total + (weaponRows.has(item.code) ? 0 : effectiveMods(item).maxDamage ?? 0), 0);
  const minDamage = Math.max(0, Math.floor(((weapon?.minDamage ?? 1) + flatMin) * damageMultiplier));
  const maxDamage = Math.max(minDamage, Math.floor(((weapon?.maxDamage ?? 2) + flatMax) * damageMultiplier));
  const shieldRow = offhand ? armorRows.get(offhand.code) : undefined;
  const shield = shieldRow && ['shie', 'ashd', 'head'].includes(text(shieldRow, 'type'));
  // The filtered mirror omits Buckler's block column. Its legacy item block=5
  // is established in research/01-classes-skills.md §1, not a class base chance.
  const shieldBase = shieldRow ? num(shieldRow, 'block', offhand?.code === 'buc' ? 5 : 0) : 0;
  const block = shield ? blockChance(shieldBase + def.blockFactor + mod('block'), dexterity, player.level) : 0;
  const penalty = player.difficulty === 'hell' ? -100 : player.difficulty === 'nightmare' ? -40 : 0;
  const commonResist = penalty + player.bonusResist + mod('resAll') + passiveValue(player, 153);
  const resistance = (key: string): number => clamp(commonResist + mod(key), -100, 75);
  const belt = equipment.find(([slot]) => slot === 'belt')?.[1];
  const beltRow = belt ? armorRows.get(belt.code) : undefined;
  // Armor.belt indexes Belts.txt; never interpret it as the row count.
  // Exceptional/elite belts all use the sixteen-box layout.
  const layout = beltRow ? rawRows('belts')[num(beltRow, 'belt')] : undefined;
  const upgradedBelt = beltRow && text(beltRow, 'normcode') && text(beltRow, 'normcode') !== text(beltRow, 'code');
  const beltRows = upgradedBelt ? 4 : layout ? num(layout, 'numboxes', 4) / 4 : 1;
  return {
    strength, dexterity, vitality, energy, maxLife, maxMana, maxStamina, defense, attackRating,
    minDamage, maxDamage, block, resFire: resistance('resFire'), resCold: resistance('resCold'),
    resLightning: resistance('resLightning'), resPoison: resistance('resPoison'),
    magicFind: mod('magicFind'), goldFind: mod('goldFind'), fcr: mod('fcr'), fhr: mod('fhr'),
    ias: mod('ias') - (localOffhand.ias ?? 0), frw: mod('frw'),
    lifeLeech: mod('lifeLeech') - (localOffhand.lifeLeech ?? 0), manaLeech: mod('manaLeech') - (localOffhand.manaLeech ?? 0),
    damageReduction: clamp(mod('damageReduction'), 0, 50), flatReduction: Math.max(0, mod('flatReduction')),
    criticalStrike: clamp(passiveValue(player, 9), 0, 100), deadlyStrike: clamp(attackMod('deadlyStrike'), 0, 100),
    manaRegenPercent: mod('manaRegenPercent') + passiveValue(player, 37), elementalDamage, coldLength: Math.max(0, attackMod('coldLength')),
    allSkills: mod('allSkills'), beltRows,
  };
}
export function allocateStat(player: Player, stat: StatKey): boolean {
  if (player.statPoints <= 0 || !['strength', 'dexterity', 'vitality', 'energy'].includes(stat)) return false;
  player[stat]++;
  player.statPoints--;
  return true;
}
export function allocateSkill(player: Player, skillId: number): { ok: boolean; message: string } {
  const skill = getSkill(skillId);
  if (!skill || skill.classId !== player.classId) return { ok: false, message: '不是本职业技能。' };
  if (player.skillPoints <= 0) return { ok: false, message: '没有可分配的技能点。' };
  if (player.level < skill.level) return { ok: false, message: `需要角色等级 ${skill.level}。` };
  if (skill.prerequisites.some(id => (player.skills[id] ?? 0) < 1)) return { ok: false, message: '前置技能需要至少一个硬点；装备加成不计。' };
  const hard = player.skills[skillId] ?? 0;
  if (hard >= 20) return { ok: false, message: '已达到 20 硬点上限。' };
  if (hard >= player.level - skill.level + 1) return { ok: false, message: '当前角色等级不能再提高此技能。' };
  player.skills[skillId] = hard + 1;
  player.skillPoints--;
  return { ok: true, message: `${skill.name}提升至 ${hard + 1} 级。` };
}

function bracket(row: RawRow, level: number, base: string, increments: string): number {
  const counts = [Math.min(level - 1, 7), clamp(level - 8, 0, 8), clamp(level - 16, 0, 6), clamp(level - 22, 0, 6), Math.max(level - 28, 0)];
  return num(row, base) + counts.reduce((value, count, i) => value + count * num(row, `${increments}${i + 1}`), 0);
}
function damageChannel(row: RawRow, player: Player, level: number, elemental: boolean): [number, number] {
  const shift = 2 ** num(row, 'HitShift', 8);
  const minimum = bracket(row, level, elemental ? 'EMin' : 'MinDam', elemental ? 'EMinLev' : 'MinLevDam');
  const maximum = bracket(row, level, elemental ? 'EMax' : 'MaxDam', elemental ? 'EMaxLev' : 'MaxLevDam');
  const formula = text(row, elemental ? 'EDmgSymPerCalc' : 'DmgSymPerCalc');
  const synergy = formula ? calculate(formula, player, row, level) : 0;
  let minFixed = Math.trunc(minimum * shift * (100 + synergy) / 100);
  let maxFixed = Math.trunc(maximum * shift * (100 + synergy) / 100);
  if (elemental && player.classId === 'sor') {
    const mastery = text(row, 'EType') === 'fire' ? 61 : text(row, 'EType') === 'ltng' ? 63 : 0;
    if (mastery) {
      const bonus = passiveValue(player, mastery);
      minFixed = Math.trunc(minFixed * (100 + bonus) / 100);
      maxFixed = Math.trunc(maxFixed * (100 + bonus) / 100);
    }
  }
  return [minFixed / 256, maxFixed / 256];
}
const elementNames: Record<string, Element> = { fire: 'fire', cold: 'cold', frze: 'cold', frz: 'cold', ltng: 'lightning', pois: 'poison', mag: 'magic' };
const meleeIds = new Set([10, 14, 19, 24, 30, 34, 73, 96, 97, 106, 107, 111, 116, 126, 132, 133, 139, 143, 144, 147, 151, 152, 223, 228, 232, 233, 238, 239, 242, 248, 254, 255, 259, 260, 265, 269, 270, 274, 275, 280]);
const buffIds = new Set([40, 50, 52, 58, 60, 68, 138, 149, 155, 224, 235, 258, 264, 267, 277, 278]);
function effectKind(id: number, row: RawRow): SkillEffect['kind'] {
  if (num(row, 'passive')) return 'passive';
  if (text(row, 'summon')) return 'summon';
  if ([44, 48, 92, 154].includes(id)) return 'nova';
  if (id === 54) return 'teleport';
  if (buffIds.has(id)) return 'buff';
  if (id >= 66 && id <= 95 && getSkill(id)?.tree === 0) return 'curse';
  if (id >= 96 && id <= 125 && getSkill(id)?.tree !== 0) return 'aura';
  if (meleeIds.has(id)) return 'melee';
  if ([41, 46, 51, 56, 59, 62, 225, 229, 230, 234, 244, 249, 250, 256, 257, 261, 262, 271, 272, 276].includes(id)) return 'area';
  return 'projectile';
}
export function skillEffect(player: Player, skillId: number): SkillEffect {
  if (skillId === 0) {
    const stats = deriveStats(player);
    return { kind: 'melee', element: 'physical', mana: 0, min: stats.minDamage, max: stats.maxDamage, radius: 0, projectiles: 1, duration: 0, supported: true, description: '普通攻击；使用当前武器组的物理伤害与命中率。' };
  }
  const skill = getSkill(skillId), row = rawSkills.get(skillId);
  if (!skill || !row) return { kind: 'melee', element: 'physical', mana: 0, min: 0, max: 0, radius: 0, projectiles: 0, duration: 0, supported: false, description: '未收录的职业技能。' };
  // Level-one preview is intentional for locked/unlearned tree tooltips. Casting
  // must separately require skillLevel>0; previews never allocate hard points.
  const level = Math.max(1, skillLevel(player, skillId)), kind = effectKind(skillId, row);
  const element = elementNames[text(row, 'EType')] ?? 'physical';
  const mana = kind === 'passive' ? 0 : Math.max(num(row, 'minmana'), (num(row, 'mana') + (level - 1) * num(row, 'lvlmana')) * 2 ** num(row, 'manashift', 8) / 256, 0);
  let supported = skill.supported, description = skill.description;
  let min = 0, max = 0, duration = 0, radius = 0, projectiles = 1;
  const calc = (key: string): number => calculate(text(row, key), player, row, level);
  try {
    const elemental = Object.hasOwn(elementNames, text(row, 'EType'));
    // Untyped E channels can mean armor, healing or absorption, not damage.
    [min, max] = damageChannel(row, player, level, elemental);
    if (kind === 'melee' && !num(row, 'MinDam') && !num(row, 'MaxDam')) {
      const stats = deriveStats(player);
      let bonus = 0, flat = 0;
      if ([10, 19, 22, 96, 106, 126, 139, 144].includes(skillId)) bonus = calc('calc1');
      if (skillId === 126) flat = calc('calc2');
      // Add skill ED to the same strength/off-weapon ED bucket, not multiply
      // the already-enhanced displayed attack damage by another ED factor.
      const slot: Slot = player.weaponSwap ? 'weapon2' : 'weapon';
      const weapon = player.equipment[slot];
      const baseMin = weapon && usable(weapon) ? weapon.minDamage : 1;
      const baseMax = weapon && usable(weapon) ? weapon.maxDamage : 2;
      min = Math.max(0, stats.minDamage + Math.floor(baseMin * bonus / 100) + flat);
      max = Math.max(min, stats.maxDamage + Math.floor(baseMax * bonus / 100) + flat);
    }
    duration = num(row, 'ELen') + Math.min(level - 1, 7) * num(row, 'ELevLen1') + clamp(level - 8, 0, 8) * num(row, 'ELevLen2') + Math.max(level - 16, 0) * num(row, 'ELevLen3');
    const lengthSynergy = text(row, 'ELenSymPerCalc');
    if (lengthSynergy) duration = Math.trunc(duration * (100 + calculate(lengthSynergy, player, row, level)) / 100);
    if (text(row, 'auralencalc')) duration = calc('auralencalc');
    if (text(row, 'aurarangecalc')) radius = calc('aurarangecalc');
    if ([38, 67].includes(skillId)) projectiles = calc('calc1');
    if (kind === 'summon' && text(row, 'petmax')) projectiles = calc('petmax');
    if (skillId === 106) projectiles = Math.min(5, level + 1);
    if (skillId === 10) projectiles = 3;
    if (skillId === 47) radius = num(rawMissiles.get(text(row, 'srvmissile'))!, 'sHitPar1');
    if (skillId === 44) radius = num(row, 'Param1');
    if (skillId === 48) radius = 10; // preview only; original expanding missiles are not executable here.
    if (skillId === 59) radius = num(row, 'Param1');
    if (skillId === 221) {
      duration = 0; // Raven lifetime is limited by attacks, not time.
      description += ` 每只乌鸦可攻击 ${linear(row, level, 5)} 次。`;
    }
    if (element === 'poison') {
      min = fixed(min * duration); max = fixed(max * duration);
      description += ' 伤害为全持续时间总量；原始 E 通道为每帧速率。';
    }
    if (kind === 'passive') {
      min = 0; max = 0; projectiles = 0;
      const expression = text(row, 'passivecalc1');
      if (expression) {
        try { description += ` 被动首通道：${calculate(expression, player, row, level)}。`; }
        catch { description += ` 被动公式：${expression}（未执行）。`; }
      }
    }
  } catch (error) {
    supported = false;
    description += ` 数据公式尚不可执行：${error instanceof Error ? error.message : 'unknown expression'}。`;
  }
  // Engine contract: radius is in map subtiles; duration is in seconds.
  // All raw lengths and their integer synergy arithmetic above stay in 25Hz frames.
  return { kind, element, mana, min, max, radius, projectiles, duration: duration / 25, supported, description };
}

export function hitChance(ar: number, defense: number, attackerLevel: number, defenderLevel: number, running = false): number {
  if (running) return 100; // Defender running: bypass AR check, not merely Defense=0.
  const rating = Math.max(0, ar), armor = Math.max(0, defense);
  const aLevel = Math.max(1, attackerLevel), dLevel = Math.max(1, defenderLevel);
  if (rating + armor === 0) return 5;
  return clamp(Math.floor(200 * rating / (rating + armor) * aLevel / (aLevel + dLevel)), 5, 95);
}
export function blockChance(blockBase: number, dexterity: number, level: number, running = false): number {
  const chance = clamp(Math.floor(Math.max(0, blockBase) * (dexterity - 15) / (2 * Math.max(1, level))), 0, 75);
  return running ? Math.floor(chance / 3) : chance;
}
export function resistDamage(damage: number, resistance: number): number {
  if (resistance >= 100) return 0;
  const bits = Math.floor(Math.max(0, damage) * 256);
  return Math.floor(bits * (100 - Math.max(-100, resistance)) / 100) / 256;
}
export function leechAmount(physicalDamage: number, percent: number, drain: number, difficulty: Difficulty): number {
  const divisor = difficulty === 'normal' ? 1 : difficulty === 'nightmare' ? 2 : 3;
  const rate = Math.floor(Math.max(0, percent) * 64 / divisor);
  const damageBits = Math.floor(Math.max(0, physicalDamage) * 256);
  const drained = Math.floor(Math.floor(damageBits * rate / 100) * Math.max(0, drain) / 100);
  return Math.floor(drained / 64) / 256;
}
export function manaRegeneration(maxMana: number, regenPercent = 0): number {
  const baseBits = Math.floor(Math.max(0, maxMana) * 256 / 3000);
  return Math.floor(baseBits * Math.max(0, 100 + regenPercent) / 100) / 256;
}
export function grantExperience(player: Player, monsterLevel: number, baseXp: number): number {
  if (player.level >= 99 || player.dead || !Number.isFinite(baseXp) || baseXp <= 0) return 0;
  const mlvl = Math.max(1, Math.trunc(monsterLevel)), level = player.level, delta = mlvl - level;
  let earned = Math.min(8_388_607, Math.floor(baseXp));
  let coefficient = 256;
  if (delta <= -6) coefficient = delta <= -10 ? 13 : [207, 159, 110, 61][-delta - 6];
  else if (level < 25 && delta >= 6) coefficient = delta >= 10 ? 5 : [225, 174, 92, 38][delta - 6];
  if (level >= 25 && delta > 0) {
    earned = earned > 1_048_576 ? Math.floor(earned / mlvl) * level : Math.floor(earned * level / mlvl);
  } else if (coefficient !== 256) {
    earned = earned > 1_048_576 ? Math.floor(earned / 256) * coefficient : Math.floor(earned * coefficient / 256);
  }
  const ratio = xpRatios.get(level) ?? 1024;
  earned = earned >= 2_097_152 ? Math.floor(earned / 1024) * ratio : Math.floor(earned * ratio / 1024);
  const before = player.experience;
  player.experience = Math.min(EXPERIENCE[99], before + earned);
  let leveled = false;
  while (player.level < 99 && player.experience >= EXPERIENCE[player.level + 1]) {
    player.level++;
    player.statPoints += 5;
    player.skillPoints++;
    leveled = true;
  }
  if (leveled) {
    const stats = deriveStats(player);
    player.life = stats.maxLife; player.mana = stats.maxMana; player.stamina = stats.maxStamina;
  }
  return player.experience - before;
}
