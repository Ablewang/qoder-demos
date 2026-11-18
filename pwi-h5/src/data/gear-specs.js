import { CLASSES } from './classes.js';

const ARMOR_SLOTS = ['head', 'body', 'legs', 'feet', 'wrist'];
const SLOTS = ['weapon', ...ARMOR_SLOTS, 'cape', 'neck', 'waist', 'ring1', 'ring2'];
const RESISTS = ['metalRes', 'woodRes', 'waterRes', 'fireRes', 'earthRes'];

function freezeTree(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

// 普通装备段表、需求及预算均是本作规则，不是未经核实的端游精确表。
export const GEAR_RULES = freezeTree({
  version: 1,
  series: ['ordinary', 'twilight', 'lunar', 'nirvana1', 'nirvana2', 'frost'],
  seriesRules: {
    ordinary: { name: '普通生产', mult: 1 },
    twilight: { name: '黄昏', mult: 1.08, q: 3, slots: ['weapon', 'body'], grades: { 60: 10, 70: 11, 80: 12, 90: 13, 99: 14 } },
    lunar: { name: '神月', mult: 1.12, q: 3, slots: ['weapon', 'body'], grades: { 95: 14 } },
    nirvana1: { name: '轮回一阶段', mult: 1.2, q: 3, slots: ['weapon', 'body'], grades: { 100: 15 } },
    nirvana2: { name: '轮回二阶段', mult: 1.35, q: 3, slots: ['weapon', 'body'], grades: { 100: 16 } },
    frost: { name: '覆霜', mult: 1.05, q: 2, slots: ['weapon', 'body'], grades: { 55: 9, 65: 10, 85: 12 } },
  },
  levelRange: [1, 105],
  slots: SLOTS,
  grades: [
    { grade: 1, minLv: 1, maxLv: 4, name: '凡铁' },
    { grade: 2, minLv: 5, maxLv: 9, name: '精钢' },
    { grade: 3, minLv: 10, maxLv: 19, name: '玄铁' },
    { grade: 4, minLv: 20, maxLv: 29, name: '寒月' },
    { grade: 5, minLv: 30, maxLv: 39, name: '赤炎' },
    { grade: 6, minLv: 40, maxLv: 49, name: '碧落' },
    { grade: 7, minLv: 50, maxLv: 59, name: '紫霄' },
    { grade: 8, minLv: 60, maxLv: 69, name: '天罡' },
    { grade: 9, minLv: 70, maxLv: 79, name: '太虚' },
    { grade: 10, minLv: 80, maxLv: 89, name: '九天' },
    { grade: 11, minLv: 90, maxLv: 98, name: '鸿蒙' },
    { grade: 12, minLv: 99, maxLv: 105, name: '混沌' },
  ],
  qualities: [
    { q: 0, stars: 1, mult: 1, addons: 0 },
    { q: 1, stars: 2, mult: 1.1, addons: 1 },
    { q: 2, stars: 3, mult: 1.25, addons: 2 },
    { q: 3, stars: 3, mult: 1.45, addons: 3, name: '本作珍品' },
  ],
  // 每项需求为 ceil(perLevel * (lv - 1)) + initial；一级可满足。
  requirements: {
    heavy: { str: [2.5, 3], dex: [0.5, 1] },
    light: { str: [1, 1], dex: [1, 1] },
    robe: { str: [0.5, 1], mag: [3, 3] },
    agileWeapon: { str: [1, 1], dex: [3, 3] },
  },
  weapons: {
    blade: { name: '长刀', attackType: 'phys', spread: 0.18, wear: 'heavy', classes: Object.keys(CLASSES) },
    axe: { name: '巨斧', attackType: 'phys', spread: 0.3, wear: 'heavy', classes: Object.keys(CLASSES) },
    bow: { name: '长弓', attackType: 'phys', spread: 0.22, wear: 'agileWeapon', classes: Object.keys(CLASSES) },
    dagger: { name: '双匕', attackType: 'phys', spread: 0.12, wear: 'agileWeapon', classes: ['assassin'] },
    sword: { name: '长剑', attackType: 'phys', spread: 0.15, wear: 'heavy', classes: Object.keys(CLASSES) },
    wand: { name: '法杖', attackType: 'magic', spread: 0.1, wear: 'robe', classes: Object.keys(CLASSES) },
    soulsphere: { name: '魂球', attackType: 'magic', spread: 0.12, wear: 'robe', classes: ['psychic'] },
    glaive: { name: '法轮', attackType: 'magic', spread: 0.18, wear: 'robe', classes: Object.keys(CLASSES) },
  },
  armor: {
    heavy: { growth: { def: [10, 6], mdef: [8, 2.5], hp: [10, 4] }, names: { head: '重盔', body: '重铠', legs: '战裙', feet: '战靴', wrist: '铁护腕' } },
    light: { growth: { def: [10, 4.2], mdef: [8, 3.6], hp: [10, 3] }, names: { head: '皮帽', body: '皮甲', legs: '皮裤', feet: '皮靴', wrist: '皮护腕' } },
    robe: { growth: { def: [10, 2.5], mdef: [8, 6], hp: [10, 2] }, names: { head: '法冠', body: '法袍', legs: '法裙', feet: '云履', wrist: '法护手' } },
  },
  partBudget: { head: 0.6, body: 1, legs: 0.8, feet: 0.5, wrist: 0.4 },
  baseBudget: { weapon: [10, 4], magicPhysicalRatio: 0.25, ring: [3, 1.6] },
  accessories: {
    cape: { name: '披风', growth: { def: [5, 2] } },
    neck: { name: '项链', growth: { hp: [20, 8], mdef: [5, 2] } },
    waist: { name: '腰带', growth: { hp: [25, 10], def: [3, 1] } },
    ring1: { name: '戒指' }, ring2: { name: '戒指' },
  },
  addons: {
    count: [0, 1, 2, 3], levelStatsMinLv: 60,
    pools: {
      physWeapon: ['str', 'dex', 'crit', 'patk', 'speed', 'accuracy', 'critDamage', 'attackLevel', 'penetrationP'],
      magicWeapon: ['mag', 'matk', 'crit', 'channel', 'critDamage', 'attackLevel', 'penetrationM', 'mpRegen'],
      heavy: ['hp', 'con', 'str', 'def', 'mdef', 'defenseLevel', 'hpRegen', ...RESISTS],
      light: ['hp', 'con', 'dex', 'def', 'mdef', 'dodge', 'defenseLevel', 'hpRegen', ...RESISTS],
      robe: ['hp', 'mp', 'con', 'mag', 'def', 'mdef', 'defenseLevel', 'channel', 'mpRegen', ...RESISTS],
      cape: ['hp', 'con', 'def', 'mdef', 'dodge', 'defenseLevel', 'hpRegen', ...RESISTS],
      neck: ['hp', 'mp', 'mag', 'mdef', 'defenseLevel', 'channel', 'mpRegen', ...RESISTS],
      waist: ['hp', 'con', 'str', 'def', 'dodge', 'defenseLevel', 'hpRegen', ...RESISTS],
      physRing: ['patk', 'str', 'dex', 'crit', 'accuracy', 'critDamage', 'attackLevel', 'penetrationP'],
      magicRing: ['matk', 'mag', 'mp', 'crit', 'channel', 'critDamage', 'attackLevel', 'penetrationM'],
      legacyWeapon: ['str', 'dex', 'mag', 'crit', 'patk', 'matk', 'speed', 'accuracy', 'critDamage', 'attackLevel', 'penetrationP', 'penetrationM', 'channel'],
      legacyArmor: ['hp', 'con', 'def', 'mdef', 'dodge', 'mp', 'defenseLevel', 'hpRegen', 'mpRegen', ...RESISTS],
      legacyAccessory: ['hp', 'mp', 'crit', 'dodge', 'str', 'dex', 'mag', 'con', 'accuracy', 'critDamage', 'attackLevel', 'defenseLevel', 'channel', 'hpRegen', 'mpRegen'],
    },
    // flat: [基础上限, 每级上限增长, 最小比例]；percent: [下限, 上限, 小数位]。
    flat: { hp: [20, 6, 0.5], mp: [15, 4, 0.5], patk: [5, 1.2, 0.5], matk: [5, 1.2, 0.5], def: [6, 1.5, 0.5], mdef: [6, 1.5, 0.5] },
    percent: { crit: [0.01, 0.03, 3], dodge: [0.01, 0.025, 3], speed: [0.05, 0.15, 2], accuracy: [0.05, 0.15, 3], critDamage: [0.05, 0.15, 3], penetrationP: [0.02, 0.06, 3], penetrationM: [0.02, 0.06, 3], channel: [0.02, 0.06, 3], ...Object.fromEntries(RESISTS.map((key) => [key, [0.02, 0.06, 3]])) },
    attribute: [2, 1 / 15], level: [2, 1 / 35], regen: [2, 1 / 15],
    forbidden: ['huntLevel', 'spirit', 'creation', 'hpPct'],
  },
  refineBudget: {
    weapon: [12, 25], armorHp: [20, 40], capeFactor: 0.6,
    neck: [8, 18], waist: [5, 12], ring: [6, 10],
  },
  adaptation: {
    grades: '1—12品采用本作显式等级段表；保留输入装备等级，不将35/55级归整为段起点。',
    requirements: '重装、轻装、法装与武器需求为本作适配公式；护甲不设职业封锁，武器限制依据类型，不依据生成职业。',
    budget: '基础攻击、防御、生命沿既有数量级；物法武器分池，魔法武器保留四分之一物攻；五行防御合并为法防。',
    stars: '星级与0—3品质编码独立；q0/q1可为一星或二星，q2/q3三星。星数目前是独立标记，不额外叠乘基础预算；q3为本作珍品。',
    skills: '穿戴与技能可用性分开：72个普通技能逐条映射原武器限制；新版、旧版、固定模板与空手均走同一施法检查。未支持或未知武器类型不授予通用权限。',
    addons: '固定去重条数0/1/2/3，各条使用显式上限预算；60级前不生成攻防等级，普通系列不生成气魄或创世等高阶属性。',
    refine: '本作品阶预算乘REFINE_BONUS；攻击加值平移区间，护甲与披风加生命，项链/腰带加自身防御，戒指加主攻击。',
    legacy: '无ruleVersion的装备不重建；固定高阶模板不进入普通生成器。',
  },
});

const own = (o, key) => Object.hasOwn(o, key);
const object = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
function validate(slot, lv, q) {
  if (!SLOTS.includes(slot)) throw new Error('装备栏位不存在。');
  if (!Number.isInteger(lv) || lv < 1 || lv > 105) throw new Error('装备等级必须为1—105的整数。');
  if (!Number.isInteger(q) || q < 0 || q > 3) throw new Error('普通装备品质必须为0—3；固定高阶装备只能通过模板生成。');
}

export function allowedWeaponClasses(type) {
  return typeof type === 'string' && own(GEAR_RULES.weapons, type) ? [...GEAR_RULES.weapons[type].classes] : [];
}

function wearFor(profile, lv) {
  return { lv, ...Object.fromEntries(Object.entries(GEAR_RULES.requirements[profile]).map(([key, [growth, initial]]) => [key, Math.ceil(growth * (lv - 1)) + initial])) };
}

// 共享词条契约：budget[key] = { min, max, precision }。空context保留旧洗练的共用池。
export function gearAddonSpec(slot, lv, q, context = {}) {
  validate(slot, lv, q);
  if (!object(context)) throw new Error('词条上下文无效。');
  if (context.series !== undefined && !GEAR_RULES.series.includes(context.series)) throw new Error('装备系列无效。');
  const type = context.weaponType && GEAR_RULES.weapons[context.weaponType]?.attackType;
  const attackType = type || context.attackType;
  const pools = GEAR_RULES.addons.pools;
  let pool;
  if (slot === 'weapon') pool = pools[attackType === 'phys' ? 'physWeapon' : attackType === 'magic' ? 'magicWeapon' : 'legacyWeapon'];
  else if (ARMOR_SLOTS.includes(slot)) pool = pools[context.armorType] || pools.legacyArmor;
  else if (slot === 'ring1' || slot === 'ring2') pool = pools[attackType === 'phys' ? 'physRing' : attackType === 'magic' ? 'magicRing' : 'legacyAccessory'];
  else pool = context.ruleVersion === 1 ? pools[slot] : pools.legacyAccessory;
  pool = pool.filter((key) => lv >= GEAR_RULES.addons.levelStatsMinLv || !['attackLevel', 'defenseLevel'].includes(key));
  const budget = {};
  for (const key of pool) {
    const percent = GEAR_RULES.addons.percent[key];
    const flat = GEAR_RULES.addons.flat[key];
    if (percent) budget[key] = { min: percent[0], max: percent[1], precision: percent[2] };
    else if (flat) {
      const max = Math.round(flat[0] + lv * flat[1]);
      budget[key] = { min: Math.max(1, Math.round(max * flat[2])), max, precision: 0 };
    } else {
      const [base, growth] = GEAR_RULES.addons[['attackLevel', 'defenseLevel'].includes(key) ? 'level' : ['hpRegen', 'mpRegen'].includes(key) ? 'regen' : 'attribute'];
      budget[key] = { min: 1, max: Math.max(1, Math.round(base + lv * growth)), precision: 0 };
    }
  }
  return { count: GEAR_RULES.addons.count[q], pool, budget };
}

// 纯规格：只根据精确等级、品质、类型与生成职业确定基础数据。
export function gearSpec(slot, lv, q, cls, options = {}) {
  validate(slot, lv, q);
  if (typeof cls !== 'string' || !own(CLASSES, cls)) throw new Error('装备生成职业不存在。');
  if (!object(options) || Object.keys(options).some((key) => !['armorType', 'weaponType', 'series', 'origin', 'stars'].includes(key))) throw new Error('装备生成选项无效。');
  const series = options.series ?? 'ordinary';
  if (!own(GEAR_RULES.seriesRules, series)) throw new Error('装备系列无效。');
  const line = GEAR_RULES.seriesRules[series];
  if (series !== 'ordinary' && (!line.slots.includes(slot) || !own(line.grades, lv) || q !== line.q)) throw new Error('等级、栏位或品质不在系列规格内。');
  const stars = options.stars ?? GEAR_RULES.qualities[q].stars;
  if (!Number.isInteger(stars) || stars < 1 || stars > 3 || (q < 2 ? stars > 2 : stars !== 3)) throw new Error('装备星级与普通色别规则不符。');
  if (options.origin !== undefined && (typeof options.origin !== 'string' || !options.origin || options.origin.length > 80)) throw new Error('装备来源无效。');
  if (options.armorType !== undefined && (!ARMOR_SLOTS.includes(slot) || !own(GEAR_RULES.armor, options.armorType))) throw new Error('护甲类型与栏位不符。');
  if (options.weaponType !== undefined && (slot !== 'weapon' || !own(GEAR_RULES.weapons, options.weaponType))) throw new Error('武器类型与栏位不符。');
  const c = CLASSES[cls];
  const tier = GEAR_RULES.grades.find((entry) => lv >= entry.minLv && lv <= entry.maxLv);
  const quality = GEAR_RULES.qualities[q];
  const base = {}, ranges = {};
  let weaponType = null, armorType = null, wear = { lv }, noun;
  let attackType = slot === 'weapon' || slot === 'ring1' || slot === 'ring2' ? c.atkType : null;
  const growthStats = (growth, factor = 1) => {
    for (const [key, [initial, perLevel]] of Object.entries(growth)) base[key] = Math.round((initial + lv * perLevel) * factor * quality.mult * line.mult);
  };
  if (slot === 'weapon') {
    weaponType = options.weaponType ?? c.weapon;
    const weapon = GEAR_RULES.weapons[weaponType];
    if (!weapon || !allowedWeaponClasses(weaponType).includes(cls)) throw new Error('生成职业不能使用该武器类型。');
    attackType = weapon.attackType;
    wear = wearFor(weapon.wear, lv);
    noun = weapon.name;
    const [initial, perLevel] = GEAR_RULES.baseBudget.weapon;
    const mean = Math.round((initial + lv * perLevel) * quality.mult * line.mult);
    const attackRange = (key, value) => {
      const spread = Math.min(value - 1, Math.max(1, Math.round(value * weapon.spread)));
      ranges[key] = [value - spread, value + spread];
      base[key] = (ranges[key][0] + ranges[key][1]) / 2;
    };
    if (attackType === 'magic') {
      attackRange('patk', Math.round(mean * GEAR_RULES.baseBudget.magicPhysicalRatio));
      attackRange('matk', mean);
    } else attackRange('patk', mean);
  } else if (ARMOR_SLOTS.includes(slot)) {
    armorType = options.armorType ?? c.armor;
    const armor = GEAR_RULES.armor[armorType];
    growthStats(armor.growth, GEAR_RULES.partBudget[slot]);
    wear = wearFor(armorType, lv);
    noun = armor.names[slot];
  } else {
    const accessory = GEAR_RULES.accessories[slot];
    noun = accessory.name;
    if (accessory.growth) growthStats(accessory.growth);
    if (slot === 'cape') base.dodge = +(0.01 + lv * 0.0002).toFixed(3);
    if (slot === 'ring1' || slot === 'ring2') {
      const [initial, perLevel] = GEAR_RULES.baseBudget.ring;
      base[attackType === 'phys' ? 'patk' : 'matk'] = Math.round((initial + lv * perLevel) * quality.mult * line.mult);
    }
  }
  const spec = {
    ruleVersion: 1, series, slot, lv, q, grade: series === 'ordinary' ? tier.grade : line.grades[lv], stars,
    cls: slot === 'weapon' ? cls : null, weaponType, armorType, attackType,
    name: `${series === 'ordinary' ? tier.name : `${line.name}·`}${noun}·${lv}级·${stars}星${q === 3 && series === 'ordinary' ? '（本作珍品）' : ''}`,
    desc: `${line.name}系列生成装备，${lv}级；基础属性、需求、品阶映射及词条预算为本作适配，不是原版具名装备的精确数据。`,
    setId: null,
    base, wear, ranges,
  };
  const addons = gearAddonSpec(slot, lv, q, spec);
  return { ...spec, addonCount: addons.count, addonPool: addons.pool, addonBudget: addons.budget };
}

// 返回新对象；旧装备只有原等级需求，高阶使用原模板已记录的需求，不重建基础。
export function gearWearRequirements(it) {
  if (!object(it)) return {};
  if (it.ruleVersion === 1 && !own(it, 'templateId')) return { ...(it.wear || {}) };
  return { lv: it.lv, ...(it.requirements || {}) };
}

function same(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => own(b, key) && same(a[key], b[key]));
}

// 仅核验v1普通实例；legacy由原schema校验，精炼/UID/价格/宝石/耐久等可变培养字段不属于规格身份。
export function matchesGearSpec(it) {
  if (!object(it) || it.ruleVersion !== 1 || !GEAR_RULES.series.includes(it.series) || it.kind !== 'equip') return false;
  if (['templateId', 'stage', 'id', 'requirements', 'classes', 'attackRanges', 'effects', 'source', 'adaptation', 'initialSockets', ...GEAR_RULES.addons.forbidden].some((key) => own(it, key))) return false;
  try {
    let cls = it.cls;
    if (it.slot !== 'weapon') {
      if (cls !== null) return false;
      cls = (it.slot === 'ring1' || it.slot === 'ring2') && own(it.base || {}, 'matk') ? 'wizard' : 'blademaster';
    }
    const options = { series: it.series, stars: it.stars };
    if (ARMOR_SLOTS.includes(it.slot)) options.armorType = it.armorType;
    if (it.slot === 'weapon') options.weaponType = it.weaponType;
    const spec = gearSpec(it.slot, it.lv, it.q, cls, options);
    if (!['ruleVersion', 'series', 'slot', 'lv', 'q', 'grade', 'stars', 'cls', 'name', 'desc', 'base', 'wear', 'ranges', 'weaponType', 'armorType'].every((key) => own(it, key) && same(it[key], spec[key]))) return false;
    if (own(it, 'attackType') && it.attackType !== spec.attackType) return false;
    if (it.setId !== null) return false;
    if (!object(it.addons) || Object.keys(it.addons).length !== spec.addonCount) return false;
    return Object.entries(it.addons).every(([key, value]) => {
      if (!own(spec.addonBudget, key)) return false;
      const { min, max, precision } = spec.addonBudget[key];
      return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && value === +value.toFixed(precision);
    });
  } catch {
    return false;
  }
}
