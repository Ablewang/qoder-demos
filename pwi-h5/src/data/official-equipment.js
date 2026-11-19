import archive from '../../official-library/structured/equipment-compare.json' with { type: 'json' };
import { HIGH_EQUIPMENT } from './high-equipment.js';
import { CLASSES } from './classes.js';
import sourceGear from './official-gear.json' with { type: 'json' };
import { NAMED_EQUIPMENT } from './named-equipment.js';
import { itemNameColor } from './item-colors.js';

const integer = (value) => /^\d+$/.test(String(value ?? '')) ? Number(value) : null;
function freezeTree(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}
export const OFFICIAL_EQUIPMENT_NOTE = '207条原表具名记录、744条历史对比记录及5个高阶样本分别保留来源。原表中可运行的记录关联具名模板，其余只供查阅；未知攻击、品阶、星数、名称色及材料不按公式补成官方字段。历史对比器没有穿戴等级和基础属性，不冒充装备实例。各来源不拼成同一版本，也不是完整官方装备库。';
const sourceTypes = Object.fromEntries([...new Set(sourceGear.records.map((record) => record.type))].map((type) => [`source:${type}`, `原表·${type}`]));
export const OFFICIAL_EQUIPMENT_TYPES = Object.freeze({ ...archive.types, ...sourceTypes, high: '已核高阶样本' });
export const OFFICIAL_EQUIPMENT = freezeTree([
  ...sourceGear.records.map((record) => Object.freeze({
    id: `source:${record.id}`, name: record.name, typeId: `source:${record.type}`, type: record.type,
    grade: record.grade, lv: record.lv, slot: record.slot,
    classes: NAMED_EQUIPMENT[record.id]?.classes ?? null,
    base: structuredClone(record.sourceStats), addons: structuredClone(record.affixes), randomAffixes: structuredClone(record.affixes),
    materialsText: record.materials.map(({ name, qty }) => `${name}×${qty}`).join('、') || null,
    refineUnit: null, refineStatLabel: null, source: record.source.url,
    sourceFields: structuredClone(record.source), sourceRecord: structuredClone(record), nameColor: itemNameColor(record),
    libraryUrl: `/official-library/index.html#page=${record.source.pageId}`,
    sourceKind: 'source-table', templateId: NAMED_EQUIPMENT[record.id] ? record.id : null,
  })),
  ...archive.records.map((record) => Object.freeze({
    id: `official:${record.id}`, name: record.name, typeId: record.sourceFields.typeid,
    type: record.type, grade: integer(record.sourceLevel), lv: null, slot: null,
    classes: null, base: null, addons: null, randomAffixes: null,
    materialsText: record.materialsText || null,
    refineUnit: record.refineUnit === '9999' ? null : integer(record.refineUnit),
    refineStatLabel: record.refineStatLabel,
    source: archive.source, sourceFields: Object.freeze({ ...record.sourceFields }),
    libraryUrl: '/official-library/index.html#page=412128097a759a3c48bf',
    sourceKind: 'historical-compare', templateId: null,
  })),
  ...Object.values(HIGH_EQUIPMENT).map((template) => Object.freeze({
    id: `sample:${template.id}`, name: template.name, typeId: 'high',
    type: template.armorType === 'robe' ? '法衣' : template.id.startsWith('axe') ? '斧锤' : '法剑',
    grade: template.grade, lv: template.lv, slot: template.slot,
    classes: template.classes, base: template.base, addons: template.addons,
    randomAffixes: [], materialsText: null, refineUnit: null,
    refineStatLabel: null, source: template.source[0], sourceFields: null,
    libraryUrl: '/official-library/index.html',
    sourceKind: 'verified-sample', templateId: template.id,
  })),
]);

export function queryOfficialEquipment(filters = {}) {
  const empty = (error) => ({ entries: [], total: 0, page: 1, pageCount: 0, pageSize: 40, error });
  const number = (value) => value === '' || value == null ? null : integer(value);
  const min = number(filters.minLv), max = number(filters.maxLv), grade = number(filters.grade);
  if ([['minLv', min], ['maxLv', max]].some(([key, value]) => filters[key] !== '' && filters[key] != null && (value === null || value < 1 || value > 105))) return empty('穿戴等级须为1—105的整数。');
  if (min !== null && max !== null && min > max) return empty('最低穿戴等级不能高于最高等级。');
  if (filters.grade !== '' && filters.grade != null && (grade === null || grade < 1 || grade > 19)) return empty('品阶须为1—19的整数。');
  if (filters.cls && filters.cls !== 'all' && !Object.hasOwn(CLASSES, filters.cls)) return empty('职业筛选无效。');
  if (filters.type && filters.type !== 'all' && !Object.hasOwn(OFFICIAL_EQUIPMENT_TYPES, filters.type)) return empty('类型筛选无效。');
  if (filters.slot && !['all', 'weapon', 'head', 'body', 'legs', 'feet', 'wrist', 'cape', 'neck', 'waist', 'ring1', 'ring2'].includes(filters.slot)) return empty('部位筛选无效。');
  const unknown = filters.includeUnknown !== false;
  const match = (value, predicate) => value === null ? unknown : predicate(value);
  const search = String(filters.search || '').trim().toLocaleLowerCase();
  const entries = OFFICIAL_EQUIPMENT.filter((entry) => (!search || `${entry.name} ${entry.type} ${entry.materialsText || ''}`.toLocaleLowerCase().includes(search))
    && (!filters.type || filters.type === 'all' || entry.typeId === filters.type)
    && (!filters.cls || filters.cls === 'all' || match(entry.classes, (classes) => classes.includes(filters.cls)))
    && (!filters.slot || filters.slot === 'all' || match(entry.slot, (slot) => slot === filters.slot))
    && (grade === null || entry.grade === grade)
    && (min === null || match(entry.lv, (lv) => lv >= min))
    && (max === null || match(entry.lv, (lv) => lv <= max)))
    .sort((a, b) => (a.lv ?? Infinity) - (b.lv ?? Infinity) || (a.grade ?? Infinity) - (b.grade ?? Infinity) || a.name.localeCompare(b.name, 'zh-CN') || a.id.localeCompare(b.id));
  const pageCount = Math.ceil(entries.length / 40);
  const requested = Number(filters.page ?? 1);
  if (!Number.isSafeInteger(requested) || requested < 1) return empty('页码须为正整数。');
  const page = Math.min(requested, Math.max(1, pageCount));
  return { entries: structuredClone(entries.slice((page - 1) * 40, page * 40)), total: entries.length, page, pageCount, pageSize: 40, error: '' };
}
