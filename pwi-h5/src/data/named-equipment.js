import archive from './official-gear.json' with { type: 'json' };
import { CLASSES } from './classes.js';
import { GEAR_RULES, gearSpec, allowedWeaponClasses } from './gear-specs.js';

const own = (o, k) => Object.hasOwn(o, k);
const armorSlots = ['head', 'body', 'legs', 'feet', 'wrist'];
const slots = ['weapon', ...armorSlots, 'cape', 'neck', 'waist', 'ring1'];
const classIds = Object.keys(CLASSES);
function freezeTree(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}
function same(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => own(b, key) && same(a[key], b[key]));
}
const labels = {
  力量: 'str', 敏捷: 'dex', 体质: 'con', 灵力: 'mag',
  物理攻击: 'patk', 法术攻击: 'matk', 物理防御: 'def', 法术防御: 'mdef',
  生命: 'hp', 生命值: 'hp', 真气: 'mp', 真气值: 'mp',
  致命一击率: 'crit', 暴击率: 'crit', 吟唱时间: 'channel',
  生命恢复速度: 'hpRegen', 真气恢复速度: 'mpRegen', 躲闪度: 'evasionRating',
  物理伤害减免: 'physicalReduction',
};
function sourceAffix({ text }) {
  const match = /^(.+?)([+\-])([0-9]+(?:\.[0-9]+)?)(?:[~～]([0-9]+(?:\.[0-9]+)?))?(%)?$/.exec(text.replace(/\s/g, ''));
  const stat = match && labels[match[1]];
  if (!stat) return { text, supported: false, reason: '原文保留；该效果未接入战斗，不授予其他属性。' };
  const percent = ['crit', 'channel', 'physicalReduction'].includes(stat);
  if (percent !== Boolean(match[5]) || (match[2] === '-' && stat !== 'channel')) {
    return { text, supported: false, reason: '单位或符号不在已支持的精确效果内。' };
  }
  const min = Number(match[3]) / (percent ? 100 : 1), max = Number(match[4] ?? match[3]) / (percent ? 100 : 1);
  if (min > max) return { text, supported: false, reason: '来源区间异常，未擅自更正。' };
  const decimals = Math.max(...[match[3], match[4] ?? match[3]].map((v) => (v.split('.')[1] || '').length));
  return { text, supported: true, runtimeSupported: true, stat, range: [min, max], precision: decimals + (percent ? 2 : 0),
    ...(stat === 'physicalReduction' ? { reason: '原文物理减免按独立比例作用于物理伤害通道，不冒充物防、五行防御或攻防等级。' } : {}) };
}
function addonData(affixes) {
  const addons = {}, addonBudget = {};
  for (const effect of affixes.filter((a) => a.supported)) {
    const [min, max] = effect.range, prior = addonBudget[effect.stat];
    addonBudget[effect.stat] = { min: +((prior?.min || 0) + min).toFixed(6), max: +((prior?.max || 0) + max).toFixed(6), precision: Math.max(prior?.precision || 0, effect.precision) };
    addons[effect.stat] = addonBudget[effect.stat].min;
  }
  return { addons, addonBudget };
}
const localPrice = (lv) => Math.round((20 + lv * lv * 0.8) * 2.2);
const templateCommon = (slot) => ({
  ruleVersion: 2, kind: 'equip', q: 0, cls: null, setId: null,
  socketLimit: slot === 'weapon' ? 2 : armorSlots.includes(slot) ? 4 : 0,
  maxDurability: 100, initialSockets: 0,
});
function sourcedTemplate(record) {
  const { slot, lv, weaponType, armorType } = record;
  const supported = slots.includes(slot) && Number.isInteger(lv) && lv >= 1 && lv <= 105
    && (slot !== 'weapon' || own(GEAR_RULES.weapons, weaponType))
    && (!armorSlots.includes(slot) || own(GEAR_RULES.armor, armorType));
  const base = {}, ranges = {}, adaptedFields = [], runtimeAdaptation = { values: {}, ranges: {}, note: '' };
  for (const [key, value] of Object.entries(record.sourceStats)) {
    if (value === null) continue;
    if (['patk', 'matk'].includes(key)) {
      ranges[key] = [...value]; base[key] = (value[0] + value[1]) / 2;
    } else base[key === 'evade' ? 'evasionRating' : key] = value;
  }
  if (supported && slot === 'weapon' && record.series === 'ordinary') {
    const cls = allowedWeaponClasses(weaponType)[0];
    const fallback = gearSpec(slot, lv, 0, cls, { weaponType });
    for (const key of ['patk', 'matk']) {
      if (record.sourceStats[key] !== null || !own(fallback.base, key)) continue;
      base[key] = fallback.base[key]; ranges[key] = [...fallback.ranges[key]];
      runtimeAdaptation.values[key] = base[key]; runtimeAdaptation.ranges[key] = [...ranges[key]];
      adaptedFields.push(`base.${key}`, `ranges.${key}`);
    }
    runtimeAdaptation.note = '来源没有攻击值；仅以原文精确穿戴等级的本作q0预算提供可玩攻击，不是官方攻击。';
  }
  if (record.sourceStats.mdef !== null) adaptedFields.push('combat.elementDefenseFallback');
  const affixes = record.affixes.map(sourceAffix);
  return {
    ...templateCommon(slot), id: record.id, templateId: record.id,
    name: record.name, desc: '历史来源具名装备；未知项保留null，运行适配、金币与生产技能不是官方数据。',
    slot, lv, grade: record.grade, stars: record.stars, nameColor: record.nameColor,
    series: record.series, type: record.type, weaponType, armorType,
    attackType: slot === 'weapon' ? GEAR_RULES.weapons[weaponType]?.attackType ?? null : null,
    classes: slot === 'weapon' ? allowedWeaponClasses(weaponType) : classIds,
    requirements: structuredClone(record.requirements), wear: { lv, ...record.requirements },
    sourceStats: structuredClone(record.sourceStats), sourceRecord: structuredClone(record),
    source: structuredClone(record.source), materials: structuredClone(record.materials),
    base, ranges, affixes, ...addonData(affixes), adaptedFields, runtimeAdaptation,
    status: 'partial', referenceOnly: !supported,
    price: supported ? localPrice(lv) : 0,
    adaptation: '基础区间均值用于本作回合战斗；通用法防只以本地规则回退五行防御，不验证五行来源。金币、制造门槛及材料分配均为本作规则；星数与色阶未知。',
  };
}
function tutorialTemplate(slot, type, lv) {
  const cls = slot === 'weapon' ? allowedWeaponClasses(type)[0]
    : armorSlots.includes(slot) ? classIds.find((id) => CLASSES[id].armor === type)
      : type === 'magicRing' ? 'wizard' : 'blademaster';
  const spec = gearSpec(slot, lv, 0, cls, slot === 'weapon' ? { weaponType: type } : armorSlots.includes(slot) ? { armorType: type } : {});
  const id = `local-tutorial:${slot}:${type}:${lv}`;
  const requirements = Object.fromEntries(['str', 'dex', 'con', 'mag'].map((key) => [key, spec.wear[key] ?? 0]));
  const noun = slot === 'weapon' ? GEAR_RULES.weapons[type].name : armorSlots.includes(slot) ? GEAR_RULES.armor[type].names[slot] : GEAR_RULES.accessories[slot].name;
  return {
    ...templateCommon(slot), id, templateId: id, slot, lv, grade: spec.grade,
    name: `${noun}·${lv}级（本作训练）`, desc: '有限训练装备；所有属性、需求、品阶及金币为本作明确本地数据，非官方具名装备。',
    series: 'local-tutorial', type, stars: null, nameColor: null,
    weaponType: spec.weaponType, armorType: spec.armorType, attackType: spec.attackType,
    classes: slot === 'weapon' ? allowedWeaponClasses(type) : classIds,
    requirements, wear: { lv, ...requirements }, base: spec.base, ranges: spec.ranges,
    sourceStats: { patk: null, matk: null, def: null, mdef: null, evade: null, hp: null, mp: null },
    sourceRecord: null, source: null, materials: [], affixes: [], addons: {}, addonBudget: {},
    status: 'local-tutorial', referenceOnly: false, adaptedFields: ['base', 'ranges', 'requirements', 'grade'],
    runtimeAdaptation: { values: structuredClone(spec.base), ranges: structuredClone(spec.ranges), note: '明确本地训练预算，不补填官方来源。' },
    price: localPrice(lv), adaptation: '本作训练模板为1级与5—100级每5级一档；开孔、精炼、价格及制造消耗是本作规则。',
  };
}
const templates = archive.records.map(sourcedTemplate);
export const TUTORIAL_LEVELS = Object.freeze([1, ...Array.from({ length: 20 }, (_, i) => (i + 1) * 5)]);
for (const lv of TUTORIAL_LEVELS) {
  for (const slot of armorSlots) for (const type of Object.keys(GEAR_RULES.armor)) templates.push(tutorialTemplate(slot, type, lv));
  for (const slot of ['cape', 'neck', 'waist']) templates.push(tutorialTemplate(slot, slot, lv));
  for (const type of ['physRing', 'magicRing']) templates.push(tutorialTemplate('ring1', type, lv));
  for (const type of Object.keys(GEAR_RULES.weapons)) {
    // Source starter levels/requirements do not fit all birth attributes; these are explicitly local, never relabeled source weapons.
    if (lv === 1 || ['dagger', 'soulsphere'].includes(type)) templates.push(tutorialTemplate('weapon', type, lv));
  }
}
export const NAMED_EQUIPMENT = freezeTree(Object.fromEntries(templates.map((template) => [template.templateId, template])));
export const NAMED_EQUIPMENT_NOTE = freezeTree({
  version: 2,
  scope: '有限具名模板：四页普通武器、神月武器/防具/饰品和有限本地训练装备；固定神铸另走高阶系统。',
  gaps: structuredClone(archive.gaps),
  adaptation: '普通来源武器攻击缺失，仅单独记录精确来源等级q0本地攻击；缺失官方品阶阻止精炼、宝石、开孔、分解。训练防具/首饰与匕首/魂球为1级及5—100级每5级一档（来源普通武器没有这两类及任何防具首饰），其他训练武器只有1级入门。',
  quality: '新装备q0仅为旧界面记账，不随请求品质乘属性；星数、名称色未证实保持null。',
  unsupported: '移动米/秒、攻击上限等未接入效果原文保留，不转换为攻速或均值攻击；物理减免已接入独立物理伤害通道，不作用于魔法或五行伤害。',
  acquisition: '商店、任务、野外与事件只给普通来源/本地训练模板；神月成品仅按具名精确材料制造，副本仅材料。官方未核黄昏/轮回前身链不列入新生产。',
});
export function namedSpec(templateId) {
  if (typeof templateId !== 'string' || !own(NAMED_EQUIPMENT, templateId)) throw new Error('具名装备模板不存在。');
  return structuredClone(NAMED_EQUIPMENT[templateId]);
}
const mutableFields = ['uid', 'refine', 'sockets', 'bound', 'durability', 'rerolls', 'upgrades', 'origin', 'locked', 'affixRolls'];
export function matchesNamedEquip(it) {
  if (!it || typeof it !== 'object' || Array.isArray(it) || it.ruleVersion !== 2 || !own(NAMED_EQUIPMENT, it.templateId)) return false;
  const template = NAMED_EQUIPMENT[it.templateId];
  if (template.referenceOnly || Object.keys(it).some((key) => !own(template, key) && !mutableFields.includes(key))) return false;
  if (!Object.keys(template).filter((key) => key !== 'addons').every((key) => own(it, key) && same(it[key], template[key]))) return false;
  const effects = template.affixes.filter((a) => a.supported);
  if (!Array.isArray(it.affixRolls) || it.affixRolls.length !== effects.length) return false;
  const addons = {};
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i], value = it.affixRolls[i];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < effect.range[0] || value > effect.range[1] || value !== +value.toFixed(effect.precision)) return false;
    addons[effect.stat] = +((addons[effect.stat] || 0) + value).toFixed(6);
  }
  return same(it.addons, addons);
}
function usual(template, cls) {
  const c = CLASSES[cls];
  if (template.slot === 'weapon') return template.weaponType === c.weapon && template.classes.includes(cls);
  if (armorSlots.includes(template.slot)) return template.armorType === c.armor;
  if (template.slot === 'ring1') return template.type === `${c.atkType}Ring`;
  return true;
}
export function selectEquipmentTemplate({ slot, lv, cls, channel = 'loot' } = {}) {
  if (!slots.includes(slot === 'ring2' ? 'ring1' : slot) || !Number.isInteger(lv) || lv < 1 || lv > 105 || !own(CLASSES, cls) || typeof channel !== 'string') throw new Error('具名装备选择参数无效。');
  const normalized = slot === 'ring2' ? 'ring1' : slot;
  const candidates = Object.values(NAMED_EQUIPMENT).filter((t) => !t.referenceOnly && t.slot === normalized && t.lv <= lv
    && ['ordinary', 'local-tutorial'].includes(t.series) && usual(t, cls)
    && (channel !== 'starter' || t.status === 'local-tutorial' && t.lv === 1));
  candidates.sort((a, b) => b.lv - a.lv || Number(a.status === 'local-tutorial') - Number(b.status === 'local-tutorial') || a.templateId.localeCompare(b.templateId));
  if (!candidates.length) throw new Error('该栏位没有可用具名装备模板。');
  return candidates[0].templateId;
}
export function equipmentForShop(p) {
  if (!p || !own(CLASSES, p.cls) || !Number.isInteger(p.lv) || p.lv < 1 || p.lv > 105) throw new Error('装备商店角色参数无效。');
  return Object.values(NAMED_EQUIPMENT).filter((t) => !t.referenceOnly && ['ordinary', 'local-tutorial'].includes(t.series)
    && t.lv <= p.lv && usual(t, p.cls)).sort((a, b) => a.lv - b.lv || a.templateId.localeCompare(b.templateId)).map((t) => namedSpec(t.templateId));
}
