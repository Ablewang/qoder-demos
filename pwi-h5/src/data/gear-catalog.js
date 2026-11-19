import { CLASSES } from './classes.js';
import { GEAR_RULES } from './gear-specs.js';
import { getProductionRecipes } from './production.js';
import { HIGH_EQUIPMENT } from './high-equipment.js';
import { NAMED_EQUIPMENT, namedSpec } from './named-equipment.js';

function freezeTree(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}
const classIds = Object.keys(CLASSES);
const armorNames = { heavy: '重装', light: '轻装', robe: '法装' };
export const CATALOG_TYPES = freezeTree({
  ...Object.fromEntries(Object.entries(GEAR_RULES.weapons).map(([id, data]) => [id, `${data.name} · ${data.attackType === 'phys' ? '物理' : '法术'}`])),
  ...armorNames, cape: '披风', neck: '项链', waist: '腰带',
  physRing: '物攻戒指', magicRing: '法攻戒指', highMagicSword: '法剑 · 固定神铸',
  ...Object.fromEntries(Object.values(NAMED_EQUIPMENT).filter((t) => t.referenceOnly).map((t) => [t.type, `${t.type} · 仅参考`])),
});
const usual = (key, value) => classIds.filter((id) => CLASSES[id][key] === value);
const entries = Object.values(NAMED_EQUIPMENT).map((t) => {
  const type = t.weaponType || t.armorType || (t.slot === 'ring1' ? t.type === 'magicRing' || t.base.matk ? 'magicRing' : 'physRing'
    : ['cape', 'neck', 'waist'].includes(t.slot) ? t.slot : t.type || t.slot);
  const associated = t.referenceOnly ? [] : t.weaponType ? usual('weapon', t.weaponType)
    : t.armorType ? usual('armor', t.armorType) : t.slot === 'ring1' ? usual('atkType', type === 'magicRing' ? 'magic' : 'phys') : classIds;
  const wearClasses = t.referenceOnly ? [] : [...t.classes];
  return { id: t.templateId, templateId: t.templateId, cls: associated[0] ?? wearClasses[0] ?? null, classes: wearClasses,
    recommendedClasses: associated, wearClasses, lv: t.lv, grade: t.grade, q: t.q, stars: t.stars,
    type, slot: t.slot, series: t.series, name: t.name, status: t.status,
    referenceOnly: t.referenceOnly, nameColor: t.nameColor, adaptedFields: [...t.adaptedFields],
  };
});
for (const template of Object.values(HIGH_EQUIPMENT)) {
  const type = template.armorType || (Object.hasOwn(template.base, 'matk') ? 'highMagicSword' : 'axe');
  const associated = template.armorType ? usual('armor', template.armorType)
    : type === 'axe' ? usual('weapon', 'axe') : usual('atkType', 'magic');
  const wearClasses = template.classes || classIds;
  const classes = associated.filter((id) => wearClasses.includes(id));
  entries.push({ id: `high:${template.id}`, templateId: template.id, cls: classes[0], classes,
    wearClasses: [...wearClasses], lv: template.lv, grade: template.grade, q: 4,
    stars: template.stars ?? null, stage: template.stage,
    type, slot: template.slot, series: 'high', name: template.name,
  });
}
export const EQUIPMENT_CATALOG = freezeTree(entries);
export const CATALOG_MAX_LEVEL = Math.max(105, ...EQUIPMENT_CATALOG.map((entry) => entry.lv));
const byId = new Map(EQUIPMENT_CATALOG.map((entry) => [entry.id, entry]));
function resolve(entryOrId) {
  const entry = byId.get(typeof entryOrId === 'string' ? entryOrId : entryOrId?.id);
  if (!entry) throw new Error('装备目录条目不存在。');
  return entry;
}
export function catalogSpec(entryOrId) {
  const entry = resolve(entryOrId);
  return entry.series === 'high' ? structuredClone(HIGH_EQUIPMENT[entry.templateId]) : namedSpec(entry.templateId);
}
export function catalogRecipes(entryOrId, cls) {
  const entry = resolve(entryOrId), representative = cls ?? entry.cls;
  if (entry.series === 'high' || entry.referenceOnly || !entry.classes.includes(representative)) return [];
  return getProductionRecipes(representative).filter((recipe) => recipe.templateId === entry.templateId);
}
const all = (value) => value === undefined || value === '' || value === 'all';
const idCompare = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export function compareCatalogEntries(a, b, sort = 'level-grade') {
  const grade = (a.grade ?? Infinity) - (b.grade ?? Infinity);
  const dimensions = sort === 'grade-level' ? grade || a.lv - b.lv : a.lv - b.lv || grade;
  return dimensions || a.q - b.q || (a.stars ?? Infinity) - (b.stars ?? Infinity) || idCompare(a, b);
}
export function queryEquipmentCatalog(filters = {}) {
  const emptyResult = (error) => ({ entries: [], total: 0, catalogTotal: EQUIPMENT_CATALOG.length, page: 1, pageCount: 0, pageSize: 60, error });
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return emptyResult('目录筛选无效。');
  const level = (value, fallback) => value === undefined || String(value).trim() === '' ? fallback : Number(value);
  const minLv = level(filters.minLv, 1), maxLv = level(filters.maxLv, CATALOG_MAX_LEVEL);
  if (![minLv, maxLv].every((lv) => Number.isInteger(lv) && lv >= 1 && lv <= CATALOG_MAX_LEVEL)) return emptyResult(`等级请输入1—${CATALOG_MAX_LEVEL}之间的整数；留空表示不限。`);
  if (minLv > maxLv) return emptyResult('最低等级不能高于最高等级，请调整范围。');
  const slot = filters.slot === 'ring2' ? 'ring1' : filters.slot;
  const validations = [[filters.cls, classIds], [slot, GEAR_RULES.slots], [filters.type, Object.keys(CATALOG_TYPES)],
    [filters.series, [...new Set(EQUIPMENT_CATALOG.map((e) => e.series))]]];
  if (validations.some(([value, values]) => !all(value) && !values.includes(value))) return emptyResult('职业、部位、类型或系列筛选无效。');
  for (const [key, min, max] of [['grade', 1, 19], ['q', 0, 4], ['stars', 1, 3]]) {
    if (!all(filters[key]) && (!Number.isInteger(Number(filters[key])) || Number(filters[key]) < min || Number(filters[key]) > max)) return emptyResult('品阶、品质或星级筛选无效。');
  }
  const sort = filters.sort ?? 'level-grade';
  if (!['level-grade', 'grade-level'].includes(sort)) return emptyResult('排序方式无效。');
  const requestedPage = Number(filters.page ?? 1);
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) return emptyResult('页码请输入大于0的整数。');
  const search = String(filters.search || '').trim().toLocaleLowerCase();
  const matching = EQUIPMENT_CATALOG.filter((entry) => entry.lv >= minLv && entry.lv <= maxLv
    && (!search || entry.name.toLocaleLowerCase().includes(search))
    && (all(filters.cls) || entry.classes.includes(filters.cls))
    && (all(slot) || entry.slot === slot) && (all(filters.type) || entry.type === filters.type)
    && (all(filters.series) || entry.series === filters.series)
    && ['grade', 'q', 'stars'].every((key) => all(filters[key]) || entry[key] === Number(filters[key])))
    .sort((a, b) => compareCatalogEntries(a, b, sort));
  const pageSize = 60, total = matching.length, pageCount = Math.ceil(total / pageSize), page = Math.min(requestedPage, Math.max(1, pageCount));
  return { entries: structuredClone(matching.slice((page - 1) * pageSize, page * pageSize)), total,
    catalogTotal: EQUIPMENT_CATALOG.length, page, pageCount, pageSize, error: '' };
}
