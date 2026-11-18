import { GEAR_RULES, gearSpec, gearAddonSpec } from './gear-specs.js';
import { CLASSES } from './classes.js';
import { HIGH_EQUIPMENT } from './high-equipment.js';
import { PRODUCTION_MATERIALS } from './production.js';

export const SLOTS = {
  weapon: '武器', head: '头盔', body: '上衣', legs: '护腿', feet: '鞋子', wrist: '护腕',
  cape: '披风', neck: '项链', waist: '腰带', ring1: '戒指', ring2: '戒指',
};
export const ARMOR_SLOTS = ['head', 'body', 'legs', 'feet', 'wrist'];
export const ACC_SLOTS = ['cape', 'neck', 'waist', 'ring1'];

export const QUALITY = [
  { name: '普通', color: '#d8d8d8', mult: 1.0, addons: 0 },
  { name: '精良', color: '#5aa9ff', mult: 1.1, addons: 1 },
  { name: '三星紫装', color: '#caa2fa', mult: 1.25, addons: 2 },
  { name: '本作珍品', color: '#ff8a3d', mult: 1.45, addons: 3 },
  { name: '神铸', color: '#ff5454', mult: 1.45, addons: 0 },
];

export const STAT_NAMES = {
  patk: '物理攻击', matk: '法术攻击', def: '物理防御', mdef: '法术防御', hp: '生命', mp: '真气',
  str: '力量', con: '体质', dex: '敏捷', mag: '灵力', crit: '暴击', dodge: '闪避', speed: '攻速',
  accuracy: '命中', critDamage: '暴击伤害', attackLevel: '攻击等级', defenseLevel: '防御等级',
  penetrationP: '物理穿透', penetrationM: '法术穿透', channel: '吟唱缩减', hpRegen: '生命恢复', mpRegen: '真气恢复',
  metalRes: '金伤减免比例', woodRes: '木伤减免比例', waterRes: '水伤减免比例', fireRes: '火伤减免比例', earthRes: '土伤减免比例',
  metalDef: '金系防御值', woodDef: '木系防御值', waterDef: '水系防御值', fireDef: '火系防御值', earthDef: '土系防御值',
  hpPct: '生命上限增幅', huntLevel: '猎魔等级', spirit: '气魄', creation: '创世等级',
};

export const EQUIPMENT_DEFAULTS = {
  durability: 100, maxDurability: 100, bound: false, sockets: [], socketLimit: 4,
  rerolls: 0, upgrades: 0, setId: null,
};
export const EQUIPMENT_SETS = {
  guardian: { name: '玄武守御', armor: 'heavy', bonuses: { 2: { hp: 180, defenseLevel: 3 }, 4: { def: 60, hpRegen: 8 }, 5: { defenseLevel: 5, metalRes: 0.1, earthRes: 0.1 } } },
  hunter: { name: '白虎追猎', armor: 'light', bonuses: { 2: { accuracy: 0.2, attackLevel: 3 }, 4: { speed: 0.15, crit: 0.03 }, 5: { penetrationP: 0.08, woodRes: 0.1, waterRes: 0.1 } } },
  arcane: { name: '朱雀灵法', armor: 'robe', bonuses: { 2: { mp: 120, attackLevel: 3 }, 4: { channel: 0.1, mpRegen: 6 }, 5: { penetrationM: 0.08, fireRes: 0.15 } } },
};

export function setStats(equipment) {
  const counts = {};
  const slots = new Set();
  for (const it of Object.values(equipment || {})) {
    if (!it || !ARMOR_SLOTS.includes(it.slot) || slots.has(it.slot) || (it.durability ?? 100) <= 0) continue;
    if (!Object.hasOwn(EQUIPMENT_SETS, it.setId) || EQUIPMENT_SETS[it.setId].armor !== it.armorType) continue;
    slots.add(it.slot);
    counts[it.setId] = (counts[it.setId] || 0) + 1;
  }
  const out = {};
  for (const [id, count] of Object.entries(counts)) {
    for (const [need, bonus] of Object.entries(EQUIPMENT_SETS[id].bonuses)) {
      if (count < Number(need)) continue;
      for (const [key, value] of Object.entries(bonus)) out[key] = +((out[key] || 0) + value).toFixed(3);
    }
  }
  return out;
}

export const REFINE_BONUS = [0, 0.05, 0.1, 0.16, 0.23, 0.31, 0.4, 0.5, 0.62, 0.76, 0.92, 1.1, 1.3];
export const REFINE_RATE = [0.5, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05];
export const REFINE_MAX = 12;

// 旧装备品阶算法保留兼容；新普通装备使用gearSpec的显式1—12品段表。
export function gradeOf(lv) {
  return Math.min(16, Math.floor(lv / 9) + 1);
}

let uidSeed = Date.now() % 100000;
export function uid() {
  uidSeed += 1;
  return `i${uidSeed.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function rollAddons(slot, lv, q, context = {}) {
  const { count, pool, budget } = gearAddonSpec(slot, lv, q, context);
  const available = [...pool];
  const addons = {};
  for (let i = 0; i < count; i++) {
    const index = Math.floor(Math.random() * available.length);
    const [stat] = available.splice(index, 1);
    const { min, max, precision } = budget[stat];
    addons[stat] = +rnd(min, max).toFixed(precision);
  }
  return addons;
}

// 前四参数兼容；生成职业只选默认类型，实际穿戴限制由weaponType/wear决定。
export function makeEquip(slot, lv, q, cls, options = {}) {
  const stars = options.stars ?? (q === 1 ? 1 + Math.floor(Math.random() * 2) : GEAR_RULES.qualities[q]?.stars);
  const spec = gearSpec(slot, lv, q, cls, { ...options, stars });
  const socketLimit = slot === 'weapon' ? 2 : ARMOR_SLOTS.includes(slot) ? 4 : 0;
  return {
    uid: uid(), kind: 'equip', slot, name: spec.name, desc: spec.desc, lv, grade: spec.grade, q,
    cls: spec.cls, ruleVersion: spec.ruleVersion, series: spec.series, stars: spec.stars,
    weaponType: spec.weaponType, armorType: spec.armorType, attackType: spec.attackType,
    base: spec.base, wear: spec.wear, ranges: spec.ranges,
    addons: rollAddons(slot, lv, q, spec), refine: 0,
    ...EQUIPMENT_DEFAULTS, socketLimit, sockets: Array(socketLimit ? (q >= 2 ? 1 : 0) : 0).fill(null),
    ...(options.origin === undefined ? {} : { origin: options.origin }),
    setId: spec.setId,
    price: Math.round((20 + lv * lv * 0.8) * (1 + q * 0.8)),
  };
}

// Known fixed template types, not equipment-name inference: sword18b is a 法剑
// (magic weapon), NOT a physical 刀剑. Keep immutable template/save data untouched.
const FIXED_WEAPON_TYPES = Object.freeze({ axe19a: 'axe', axe19b: 'axe', axe19c: 'axe', sword18b: 'wand' });
export function equippedWeaponType(p) {
  const it = p.equipment?.weapon;
  if (!it) return 'unarmed';
  if (it.slot !== 'weapon') return null;
  if (it.templateId) return HIGH_EQUIPMENT[it.templateId]?.slot === 'weapon' ? FIXED_WEAPON_TYPES[it.templateId] || null : null;
  if (Object.hasOwn(it, 'weaponType')) return Object.hasOwn(GEAR_RULES.weapons, it.weaponType) ? it.weaponType : null;
  // Old weapons encoded their default type by generating class, not their name.
  if (!Object.hasOwn(it, 'ruleVersion') && it.cls && Object.hasOwn(CLASSES, it.cls)) return CLASSES[it.cls].weapon;
  return null; // A typeless legacy universal item is unknown, not free permission.
}

// 神铸装备不走随机品质、命名或词条流程。
export function makeHighEquip(templateId) {
  if (typeof templateId !== 'string' || !Object.hasOwn(HIGH_EQUIPMENT, templateId)) throw new Error('高阶装备模板不存在。');
  const template = structuredClone(HIGH_EQUIPMENT[templateId]);
  return {
    ...structuredClone(EQUIPMENT_DEFAULTS), ...template,
    uid: uid(), kind: 'equip', templateId, q: 4, cls: null, bound: true, refine: 0,
    durability: template.maxDurability, sockets: Array(template.initialSockets).fill(null),
    setId: null, price: template.slot === 'weapon' ? 231200 : 20000,
  };
}

export function rollQuality(bonus = 0) {
  const r = Math.random() - bonus;
  if (r < 0.02) return 3;
  if (r < 0.12) return 2;
  if (r < 0.4) return 1;
  return 0;
}

export function randomSlot() {
  return pick(['weapon', 'head', 'body', 'legs', 'feet', 'wrist', 'cape', 'neck', 'waist', 'ring1']);
}

const FRACTIONAL_STATS = ['crit', 'dodge', 'speed', 'accuracy', 'critDamage', 'penetrationP', 'penetrationM', 'channel', 'metalRes', 'woodRes', 'waterRes', 'fireRes', 'earthRes'];
function legacyRefinedBase(it, level) {
  const out = {};
  const r = REFINE_BONUS[level] ?? 0;
  for (const [k, v] of Object.entries(it.base || {})) {
    const main = (it.slot === 'weapon' && (k === 'patk' || k === 'matk'))
      || (ARMOR_SLOTS.includes(it.slot) && (k === 'def' || k === 'mdef'))
      || (!ARMOR_SLOTS.includes(it.slot) && it.slot !== 'weapon');
    out[k] = main && k !== 'dodge' ? (FRACTIONAL_STATS.includes(k) ? +(v * (1 + r)).toFixed(3) : Math.round(v * (1 + r))) : v;
  }
  return out;
}

// 纯增益字典{stat: amount}：所选精炼等级相对+0的累计增益，不含词条、宝石或耐久。
// 下一精炼预览可比较refineGain(it, it.refine + 1)与当前增益；不修改装备。
export function refineGain(it, level = it?.refine ?? 0) {
  if (!it) return {};
  if (!Number.isInteger(level) || level < 0 || level > REFINE_MAX) throw new Error('精炼等级必须为0—12的整数。');
  const out = {};
  if (it.ruleVersion !== 1 || it.templateId) {
    const refined = legacyRefinedBase(it, level);
    const unrefined = legacyRefinedBase(it, 0);
    for (const key of Object.keys(refined)) {
      const gain = +(refined[key] - unrefined[key]).toFixed(3);
      if (gain) out[key] = gain;
    }
    return out;
  }
  const r = REFINE_BONUS[level];
  const budget = GEAR_RULES.refineBudget;
  const amount = (profile, factor = 1) => Math.round((profile[0] + it.grade * profile[1]) * factor * r);
  const add = (key, value) => { if (value) out[key] = value; };
  if (it.slot === 'weapon') {
    const magic = GEAR_RULES.weapons[it.weaponType]?.attackType === 'magic';
    add('patk', amount(budget.weapon, magic ? GEAR_RULES.baseBudget.magicPhysicalRatio : 1));
    if (magic) add('matk', amount(budget.weapon));
  } else if (ARMOR_SLOTS.includes(it.slot)) add('hp', amount(budget.armorHp, GEAR_RULES.partBudget[it.slot]));
  else if (it.slot === 'cape') add('hp', amount(budget.armorHp, budget.capeFactor));
  else if (it.slot === 'neck') add('mdef', amount(budget.neck));
  else if (it.slot === 'waist') add('def', amount(budget.waist));
  else if (it.slot === 'ring1' || it.slot === 'ring2') add(it.base?.matk ? 'matk' : 'patk', amount(budget.ring));
  return out;
}

// 新普通装备按品阶预算加值；legacy与固定高阶保持原乘法精炼规则。
export function equipStats(it) {
  if (!it) return {};
  const ordinary = it.ruleVersion === 1 && !it.templateId;
  const out = ordinary ? { ...(it.base || {}) } : legacyRefinedBase(it, it.refine || 0);
  if (ordinary) {
    for (const [k, v] of Object.entries(refineGain(it))) out[k] = +((out[k] || 0) + v).toFixed(3);
  }
  for (const [k, v] of Object.entries(it.addons || {})) out[k] = +((out[k] || 0) + v).toFixed(3);
  for (const gemId of (it.sockets || []).slice(0, Math.min(4, it.socketLimit ?? 4))) {
    const gem = Object.hasOwn(ITEMS, gemId) ? ITEMS[gemId] : null;
    if (gem?.type === 'gem') out[gem.stat] = +((out[gem.stat] || 0) + gem.value).toFixed(3);
  }
  if ((it.durability ?? 100) <= 0) for (const k of Object.keys(out)) out[k] = +(out[k] * 0.5).toFixed(3);
  return out;
}

// —— 消耗品与材料 ——
export const ITEMS = {
  hp1: { name: '金创药', type: 'hp', value: 80, price: 10, lv: 1, desc: '回复80点生命。' },
  hp2: { name: '大还丹', type: 'hp', value: 300, price: 40, lv: 15, desc: '回复300点生命。' },
  hp3: { name: '九转还魂丹', type: 'hp', value: 900, price: 110, lv: 35, desc: '回复900点生命。' },
  hp4: { name: '天香续命露', type: 'hp', value: 2200, price: 260, lv: 60, desc: '回复2200点生命。' },
  hp5: { name: '仙灵玉露', type: 'hp', value: 5000, price: 550, lv: 85, desc: '回复5000点生命。' },
  mp1: { name: '回灵散', type: 'mp', value: 60, price: 10, lv: 1, desc: '回复60点真气。' },
  mp2: { name: '凝神丹', type: 'mp', value: 220, price: 40, lv: 15, desc: '回复220点真气。' },
  mp3: { name: '紫府灵丹', type: 'mp', value: 650, price: 110, lv: 35, desc: '回复650点真气。' },
  mp4: { name: '天心玉髓', type: 'mp', value: 1500, price: 260, lv: 60, desc: '回复1500点真气。' },
  mp5: { name: '太清仙露', type: 'mp', value: 3200, price: 550, lv: 85, desc: '回复3200点真气。' },
  town: { name: '回城符', type: 'town', price: 30, lv: 1, desc: '战斗外使用，返回最近的主城。' },
  julin: { name: '聚灵丹', type: 'exp', value: 30, price: 600, lv: 1, desc: '接下来30场战斗获得双倍经验（聚灵）。' },
  revive: { name: '复活卷轴', type: 'revive', price: 300, lv: 1, desc: '阵亡时自动使用，原地复活且不损失经验。' },
  huanxian: { name: '幻仙石', type: 'mat', price: 120, lv: 1, desc: '精炼装备的基本材料。失败时精炼等级归零。' },
  tiangang: { name: '天罡石', type: 'mat', price: 0, sell: 800, lv: 1, desc: '提高精炼成功率，本作适配增加15个百分点；失败仍归零，不是保底石。' },
  disha: { name: '地煞石', type: 'mat', price: 0, sell: 300, lv: 1, desc: '提高精炼成功率，本作适配增加5个百分点；失败仅降1级。' },
  qiankun: { name: '乾坤石', type: 'mat', price: 0, sell: 2000, lv: 1, desc: '精炼失败保底，维持原等级；亦用于扭转乾坤转移和轮回继承，不是概率翻倍石。' },
  card: { name: '卡片BOSS凭证', type: 'mat', price: 0, sell: 500, lv: 1, desc: '击败野外首领所得，可在任务使者处兑换元神。' },
  socketStone: { name: '镶嵌石·本作', type: 'mat', price: 160, lv: 1, desc: '本作开孔/镶嵌资源：先打孔再镶嵌。新版武器最多2孔、防具4孔，首饰不打孔；费用并非端游原始表。' },
  reforgeStone: { name: '旧制重铸石', type: 'mat', price: 350, lv: 1, desc: '仅供无规则版本的旧存档装备洗练；新版普通装备需重新制造，轮回按前件与水晶重铸。' },
  upgradeStone: { name: '旧制升阶石', type: 'mat', price: 500, lv: 1, desc: '仅供无规则版本的旧存档装备通用升级；新版装备不能凭此增加等级，须走明确配方。' },
  salvage: { name: '装备精华', type: 'mat', price: 0, sell: 30, lv: 1, desc: '旧制装备分解资源：旧装重洗消耗1份，通用升级消耗2份；新版精良及以下分解返采集材料与精华，三星紫装/珍品返幻仙石，黄昏另返汇总剑魂。数量为本作适配。' },
  highForgeSigil: { name: '神铸凭证·本作', type: 'material', price: 0, sell: 0, lv: 1, desc: '本作兑换/升阶资源：商城、鸿运秘宝或推荐等级≥75的副本最终首领波通关获取；每次此类通关确定获得2份，普通波与野外首领不掉落。配方和成本为本作设定，不是官方资源。' },
  treasureKey: { name: '秘宝钥匙', type: 'event', price: 0, lv: 1, desc: '在乾坤袋购买，仅用于鸿运秘宝抽取；开宝箱、开粽子不消耗钥匙。' },
  bronzeChest: { name: '青铜宝箱', type: 'chest', price: 0, lv: 1, desc: '乾坤袋购买后直接打开，每次消耗1个宝箱；不额外消耗钥匙。' },
  goldChest: { name: '黄金宝箱', type: 'chest', price: 0, lv: 1, desc: '乾坤袋购买后直接打开，每次消耗1个宝箱；不额外消耗钥匙。' },
  zongzi: { name: '幸运粽子', type: 'event', price: 0, lv: 1, desc: '乾坤袋购买的粽礼，直接打开获得随机奖励；不额外消耗钥匙。' },
  bigZongzi: { name: '大粽子', type: 'event', price: 0, lv: 1, desc: '乾坤袋购买的进阶粽礼，直接打开获得随机奖励；不额外消耗钥匙。' },
  charmHp: { name: '黄金护身符', type: 'charm', resource: 'hp', value: 600000, price: 0, lv: 1, desc: '装载600000点生命储量；生命不高于50%时自动消耗储量恢复。本作按回合检查，不模拟端游10秒冷却。' },
  charmMp: { name: '黄金守神符', type: 'charm', resource: 'mp', value: 900000, price: 0, lv: 1, desc: '装载900000点真气储量；真气不高于75%时自动消耗储量恢复。本作按回合检查，不模拟端游5秒冷却。' },
};

Object.assign(ITEMS, PRODUCTION_MATERIALS);

export function refinePlan(it, aid = '') {
  if (!it || it.refine >= REFINE_MAX) throw new Error('装备不存在或精炼已满。');
  if (aid && !['tiangang', 'disha', 'qiankun', 'dragonOrb1'].includes(aid)) throw new Error('精炼辅料无效。');
  if (aid === 'dragonOrb1' && it.refine !== 0) throw new Error('一星龙珠只能保证下一次+1，不能用于+2及以上。');
  const rate = aid === 'dragonOrb1' ? 1 : Math.min(1, REFINE_RATE[it.refine] + (aid === 'tiangang' ? 0.15 : aid === 'disha' ? 0.05 : 0));
  return { rate, stones: it.slot === 'weapon' ? 2 : 1, cost: (it.refine + 1) * it.lv * 15 + 50,
    failLevel: aid === 'qiankun' ? it.refine : aid === 'disha' ? Math.max(0, it.refine - 1) : 0, aid };
}

const GEM_FAMILIES = {
  Hp: ['黄沉之石', 'hp', [60, 150, 360]], Mp: ['暗青之石', 'mp', [40, 100, 240]],
  Patk: ['火红之石', 'patk', [8, 20, 48]], Matk: ['白雾之石', 'matk', [8, 20, 48]],
  Def: ['磐甲石', 'def', [10, 25, 60]], Mdef: ['御灵石', 'mdef', [10, 25, 60]],
  Crit: ['暴击石', 'crit', [0.005, 0.01, 0.02]],
  AtkLevel: ['斗神石', 'attackLevel', [1, 2, 4]], DefLevel: ['守神石', 'defenseLevel', [1, 2, 4]],
};
for (const [family, [name, stat, values]] of Object.entries(GEM_FAMILIES)) {
  values.forEach((value, i) => {
    const percent = stat === 'crit';
    ITEMS[`gem${family}${i + 1}`] = {
      name: `${i + 1}阶${name}`, type: 'gem', stat, value, tier: i + 1,
      price: [200, 700, 2200][i], lv: [1, 25, 55][i], requiredGrade: [1, 5, 8][i],
      desc: `镶嵌增加${STAT_NAMES[stat]}${percent ? `${value * 100}%` : value}；新版需装备${[1, 5, 8][i]}品，攻击类适配武器、生命/真气/防御类适配护甲；先开孔。效果和预算为本作适配，城镇杂货店出售。`,
    };
  });
}

export function itemSell(it) {
  if (it.kind === 'equip') return Math.round(it.price * 0.3 * (1 + (it.refine || 0) * 0.3));
  const d = ITEMS[it.id];
  return d.sell ?? Math.round(d.price * 0.3);
}

export function shopList(type, playerLv) {
  if (type === 'potion') {
    return Object.entries(ITEMS)
      .filter(([, d]) => (d.type === 'hp' || d.type === 'mp') && d.lv <= playerLv + 5)
      .map(([id]) => id);
  }
  return ['town', 'julin', 'revive', 'huanxian', 'socketStone', 'reforgeStone', 'upgradeStone',
    ...Object.keys(ITEMS).filter((id) => ITEMS[id].type === 'gem' && ITEMS[id].lv <= playerLv + 5)];
}

// 装备商店：当前等级段白装/蓝装
export function equipShop(cls, playerLv) {
  const lv = Math.max(1, Math.floor(playerLv / 5) * 5 || 1);
  const slots = ['weapon', 'head', 'body', 'legs', 'feet', 'wrist', 'cape', 'neck', 'waist', 'ring1'];
  return slots.map((s) => {
    const spec = gearSpec(s, lv, 0, cls);
    return { ...spec, price: Math.round((20 + lv * lv * 0.8) * 2.2) };
  });
}
