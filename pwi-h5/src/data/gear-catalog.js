import { CLASSES } from './classes.js';
import { GEAR_RULES, gearSpec, allowedWeaponClasses } from './gear-specs.js';
import { getProductionRecipes } from './production.js';
import { HIGH_EQUIPMENT } from './high-equipment.js';

function freezeTree(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}

const classIds = Object.keys(CLASSES);
const armorSlots = ['head', 'body', 'legs', 'feet', 'wrist'];
const armorNames = { heavy: '重装', light: '轻装', robe: '法装' };
export const CATALOG_TYPES = freezeTree({
  ...Object.fromEntries(Object.entries(GEAR_RULES.weapons).map(([id, data]) => [id, `${data.name} · ${data.attackType === 'phys' ? '物理' : '法术'}`])),
  ...armorNames, cape: '披风', neck: '项链', waist: '腰带',
  physRing: '物攻戒指', magicRing: '法攻戒指', highMagicSword: '法剑 · 固定神铸',
});
const usual = (key, value) => classIds.filter((id) => CLASSES[id][key] === value);
const profiles = [
  ...Object.keys(GEAR_RULES.weapons).map((type) => ({ slot: 'weapon', type, classes: usual('weapon', type), wearClasses: allowedWeaponClasses(type) })),
  ...armorSlots.flatMap((slot) => Object.keys(GEAR_RULES.armor).map((type) => ({ slot, type, classes: usual('armor', type), wearClasses: classIds }))),
  ...['cape', 'neck', 'waist'].map((slot) => ({ slot, type: slot, classes: classIds, wearClasses: classIds })),
  ...['phys', 'magic'].map((attack) => ({ slot: 'ring1', type: `${attack}Ring`, classes: usual('atkType', attack), wearClasses: classIds })),
];

function descriptor(profile, series, lv, q, stars) {
  const line = GEAR_RULES.seriesRules[series];
  const tier = GEAR_RULES.grades.find((tier) => lv >= tier.minLv && lv <= tier.maxLv);
  const noun = profile.slot === 'weapon' ? GEAR_RULES.weapons[profile.type].name
    : armorSlots.includes(profile.slot) ? GEAR_RULES.armor[profile.type].names[profile.slot]
      : GEAR_RULES.accessories[profile.slot].name;
  return {
    id: `${series}:${profile.slot}:${profile.type}:${lv}:${q}:${stars}`,
    cls: profile.classes[0], classes: [...profile.classes], wearClasses: [...profile.wearClasses],
    lv, grade: series === 'ordinary' ? tier.grade : line.grades[lv], q, stars,
    type: profile.type, slot: profile.slot, series,
    name: `${series === 'ordinary' ? tier.name : `${line.name}·`}${noun}·${lv}级·${stars}星${q === 3 && series === 'ordinary' ? '（本作珍品）' : ''}`,
  };
}

const entries = [];
for (let lv = GEAR_RULES.levelRange[0]; lv <= GEAR_RULES.levelRange[1]; lv++) {
  for (const profile of profiles) {
    for (const { q } of GEAR_RULES.qualities) {
      for (const stars of q < 2 ? [1, 2] : [3]) entries.push(descriptor(profile, 'ordinary', lv, q, stars));
    }
  }
}
for (const [series, line] of Object.entries(GEAR_RULES.seriesRules)) {
  if (series === 'ordinary') continue;
  for (const lv of Object.keys(line.grades).map(Number).sort((a, b) => a - b)) {
    for (const profile of profiles.filter((profile) => line.slots.includes(profile.slot))) {
      entries.push(descriptor(profile, series, lv, line.q, GEAR_RULES.qualities[line.q].stars));
    }
  }
}
for (const template of Object.values(HIGH_EQUIPMENT)) {
  const type = template.armorType || (Object.hasOwn(template.base, 'matk') ? 'highMagicSword' : 'axe');
  const associated = template.armorType ? usual('armor', template.armorType)
    : type === 'axe' ? usual('weapon', 'axe') : usual('atkType', 'magic');
  const wearClasses = template.classes || classIds;
  const classes = associated.filter((id) => wearClasses.includes(id));
  entries.push({
    id: `high:${template.id}`, templateId: template.id, cls: classes[0], classes,
    wearClasses: [...wearClasses], lv: template.lv, grade: template.grade, q: 4,
    stars: template.name.match(/^★+/)?.[0].length ?? null, stage: template.stage,
    type, slot: template.slot, series: 'high', name: template.name,
  });
}
export const EQUIPMENT_CATALOG = freezeTree(entries);
const byId = new Map(EQUIPMENT_CATALOG.map((entry) => [entry.id, entry]));

function resolve(entryOrId) {
  const entry = byId.get(typeof entryOrId === 'string' ? entryOrId : entryOrId?.id);
  if (!entry) throw new Error('装备目录条目不存在。');
  return entry;
}

export function catalogSpec(entryOrId) {
  const entry = resolve(entryOrId);
  if (entry.templateId) return structuredClone(HIGH_EQUIPMENT[entry.templateId]);
  const options = { series: entry.series, stars: entry.stars };
  if (entry.slot === 'weapon') options.weaponType = entry.type;
  if (armorSlots.includes(entry.slot)) options.armorType = entry.type;
  return gearSpec(entry.slot, entry.lv, entry.q, entry.cls, options);
}

export function catalogRecipes(entryOrId, cls) {
  const entry = resolve(entryOrId);
  const representative = cls ?? entry.cls;
  if (entry.templateId || !entry.classes.includes(representative)) return [];
  if (entry.q !== 1 && entry.stars !== GEAR_RULES.qualities[entry.q].stars) return [];
  return getProductionRecipes(representative).filter((recipe) => recipe.series === entry.series
    && recipe.lv === entry.lv && recipe.slot === entry.slot && recipe.qualities.includes(entry.q)
    && (entry.slot !== 'weapon' || recipe.weaponType === entry.type)
    && (!armorSlots.includes(entry.slot) || recipe.armorType === entry.type));
}

const all = (value) => value === undefined || value === '' || value === 'all';
const idCompare = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export function compareCatalogEntries(a, b, sort = 'level-grade') {
  const dimensions = sort === 'grade-level' ? a.grade - b.grade || a.lv - b.lv
    : a.lv - b.lv || a.grade - b.grade;
  return dimensions || a.q - b.q || (a.stars ?? 0) - (b.stars ?? 0) || idCompare(a, b);
}

export function queryEquipmentCatalog(filters = {}) {
  const emptyResult = (error) => ({ entries: [], total: 0, catalogTotal: EQUIPMENT_CATALOG.length, page: 1, pageCount: 0, pageSize: 60, error });
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return emptyResult('目录筛选无效。');
  const level = (value, fallback) => value === undefined || String(value).trim() === '' ? fallback : Number(value);
  const minLv = level(filters.minLv, 1), maxLv = level(filters.maxLv, 105);
  if (![minLv, maxLv].every((lv) => Number.isInteger(lv) && lv >= 1 && lv <= 105)) return emptyResult('等级请输入1—105之间的整数；留空表示不限。');
  if (minLv > maxLv) return emptyResult('最低等级不能高于最高等级，请调整范围。');
  const slot = filters.slot === 'ring2' ? 'ring1' : filters.slot;
  const validations = [
    [filters.cls, classIds], [slot, GEAR_RULES.slots], [filters.type, Object.keys(CATALOG_TYPES)],
    [filters.series, [...GEAR_RULES.series, 'high']],
  ];
  if (validations.some(([value, values]) => !all(value) && !values.includes(value))) return emptyResult('职业、部位、类型或系列筛选无效。');
  for (const [key, min, max] of [['grade', 1, 19], ['q', 0, 4], ['stars', 1, 3]]) {
    if (!all(filters[key]) && (!Number.isInteger(Number(filters[key])) || Number(filters[key]) < min || Number(filters[key]) > max)) return emptyResult('品阶、品质或星级筛选无效。');
  }
  const sort = filters.sort ?? 'level-grade';
  if (!['level-grade', 'grade-level'].includes(sort)) return emptyResult('排序方式无效。');
  const requestedPage = Number(filters.page ?? 1);
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) return emptyResult('页码请输入大于0的整数。');
  const matching = EQUIPMENT_CATALOG.filter((entry) => entry.lv >= minLv && entry.lv <= maxLv
    && (all(filters.cls) || entry.classes.includes(filters.cls))
    && (all(slot) || entry.slot === slot) && (all(filters.type) || entry.type === filters.type)
    && (all(filters.series) || entry.series === filters.series)
    && ['grade', 'q', 'stars'].every((key) => all(filters[key]) || entry[key] === Number(filters[key])))
    .sort((a, b) => compareCatalogEntries(a, b, sort));
  const pageSize = 60, total = matching.length, pageCount = Math.ceil(total / pageSize);
  const page = Math.min(requestedPage, Math.max(1, pageCount));
  return { entries: matching.slice((page - 1) * pageSize, page * pageSize), total,
    catalogTotal: EQUIPMENT_CATALOG.length, page, pageCount, pageSize, error: '' };
}
