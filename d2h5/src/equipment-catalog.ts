import { num, rawRows, text } from './catalog';
import { getBase, itemName, RUNEWORDS } from './items';
import type { RawRow } from './types';
import uniques from './data/raw/UniqueItems.json';
import prefixes from './data/raw/MagicPrefix.json';
import suffixes from './data/raw/MagicSuffix.json';
import words from './data/raw/Runes.json';
import cube from './data/raw/cubemain.json';

export type CatalogKind = 'base' | 'unique' | 'set-item' | 'set' | 'runeword' | 'rune' | 'gem' | 'prefix' | 'suffix' | 'cube';
export const CATALOG_CATEGORIES: { kind: CatalogKind; label: string }[] = [
  { kind: 'base', label: '底材' }, { kind: 'unique', label: '暗金装备' },
  { kind: 'set-item', label: '套装单件' }, { kind: 'set', label: '套装组合' },
  { kind: 'runeword', label: '符文之语' }, { kind: 'rune', label: '符文' },
  { kind: 'gem', label: '宝石' }, { kind: 'prefix', label: '魔法前缀' },
  { kind: 'suffix', label: '魔法后缀' }, { kind: 'cube', label: '方块配方' },
];
export interface EquipmentEntry {
  id: string;
  kind: CatalogKind;
  name: string;
  code: string;
  status: string;
  lines: string[];
  raw: RawRow;
}

const PARTIAL = '仅部分行为已接入，不代表完整生成或全部属性生效';
const DEFINITION = '仅定义，未接入执行';
const SET_KEYS = new Map(rawRows('Sets').map(row => [text(row, 'index'), text(row, 'name')]));
const offlineWords = new Set(RUNEWORDS.map(word => text(word.raw, 'Name')));
const WORD_ALIASES = new Map(Object.entries(words).map(([name, row]) => [`${row.Name}:${row.lineNumber}`, name]));
const baseRows = ['weapons', 'armor', 'misc'].flatMap(table => rawRows(table));
const rawBases = new Map(baseRows.map(row => [text(row, 'code'), row]));
function baseName(code: string): string {
  return getBase(code)?.name ?? itemName(text(rawBases.get(code) ?? {}, 'namestr', code));
}
function baseLines(code: string): string[] {
  const base = getBase(code), row = rawBases.get(code);
  if (!row) return code ? [`底材引用缺失：${code}`] : [];
  const lines = [`底材：${baseName(code)} (${code})`, `尺寸：${num(row, 'invwidth')}×${num(row, 'invheight')}`];
  if (base) lines.push(
    `类型：${base.type} / 槽位：${base.slot ?? '无'} / 职业：${base.classId ?? '不限'}`,
    `底材伤害：${base.minDamage}–${base.maxDamage}${base.twoHanded ? '（双手）' : ''} / 防御：${base.defenseMin}–${base.defenseMax}`,
    `底材需求：等级 ${base.requiredLevel} / 力量 ${base.strength} / 敏捷 ${base.dexterity}`,
    `底材等级：${base.qlvl} / 最大孔数：${base.maxSockets}（仍受物品等级与类型限制） / 耐久：${base.durability} / 腰带行数：${base.beltRows}`,
  );
  return lines;
}
function entry(kind: CatalogKind, key: string, name: string, code: string, status: string, raw: RawRow, lines: string[] = []): EquipmentEntry {
  // Copy before freezing: the index must never freeze or mutate shared runtime rows.
  const snapshot = Object.freeze({ ...raw });
  const details = [...baseLines(code), ...lines, `原始字段：${JSON.stringify(snapshot)}`];
  Object.freeze(details);
  return Object.freeze({ id: `${kind}:${key}`, kind, name, code, status, lines: details, raw: snapshot });
}
function namedStatus(raw: RawRow, unique: boolean): string {
  const code = text(raw, unique ? 'code' : 'item');
  if (unique && num(raw, 'enabled') !== 1) return `原始禁用（enabled≠1）；${DEFINITION}`;
  if (!getBase(code) || num(raw, 'rarity') <= 0 || num(raw, 'lvl') > 99) return `当前运行时不可选取；${DEFINITION}`;
  return `${unique ? '运行时候选，受等级与稀有度限制' : '单件运行时候选，组合奖励未实现'}${num(raw, 'ladder') === 1 ? '；天梯标记不限制原版离线暗金生成' : ''}；${PARTIAL}`;
}
function affixes(kind: 'prefix' | 'suffix', rows: Record<string, RawRow>): EquipmentEntry[] {
  // Numeric source keys are sparse; names and filtered array positions are not IDs.
  return Object.entries(rows).filter(([, raw]) => text(raw, 'Name')).map(([key, raw]) => {
    const eligible = [1, 100].includes(num(raw, 'version')) && num(raw, 'spawnable') === 1 && num(raw, 'frequency') > 0;
    const status = eligible ? `运行时候选，仍受类型、等级与组别限制；${PARTIAL}` : `历史版本或不可随机生成，运行时禁用；${DEFINITION}`;
    return entry(kind, key, itemName(text(raw, 'Name')), '', status, raw);
  });
}

/** Pinned definitions, including disabled/history rows; never a spawn menu. */
export const EQUIPMENT_CATALOG: EquipmentEntry[] = [
  ...baseRows.filter(raw => text(raw, 'code') && text(raw, 'name')).map(raw => {
    const code = text(raw, 'code');
    const status = getBase(code) ? `运行时底材已纳入，不保证掉落或商店可得；${PARTIAL}` : `运行时底材未纳入（历史或不可生成条目）；${DEFINITION}`;
    return entry('base', code, baseName(code), code, status, raw);
  }),
  ...Object.entries(uniques).filter(([, raw]) => text(raw, 'index') && text(raw, 'code')).map(([key, raw]) =>
    entry('unique', key, itemName(text(raw, 'index')), text(raw, 'code'), namedStatus(raw, true), raw,
      [`定义等级：${num(raw, 'lvl')} / 定义需求等级：${num(raw, 'lvl req')}`])),
  ...rawRows('SetItems').filter(raw => text(raw, 'index') && text(raw, 'item')).map(raw =>
    entry('set-item', text(raw, 'index'), itemName(text(raw, 'index')), text(raw, 'item'), namedStatus(raw, false), raw,
      [`所属套装：${itemName(SET_KEYS.get(text(raw, 'set')) ?? text(raw, 'set'))}`, `定义等级：${num(raw, 'lvl')} / 定义需求等级：${num(raw, 'lvl req')}`])),
  ...rawRows('Sets').filter(raw => text(raw, 'index')).map(raw =>
    entry('set', text(raw, 'index'), itemName(text(raw, 'name', text(raw, 'index'))), '', `组合奖励未实现；${DEFINITION}`, raw)),
  // RawRow's legacy type omits null; preserve Infinity's null cell, as catalog.ts does.
  ...Object.entries(words as unknown as Record<string, RawRow>).filter(([, raw]) => text(raw, 'Name')).map(([sourceName, raw]) => {
    const identity = text(raw, 'Name');
    // The pinned incomplete Patience row repeats Passion's Name=Runeword95.
    const key = identity === 'Runeword95' && num(raw, 'complete') !== 1 ? `${identity}:${num(raw, 'lineNumber')}` : identity;
    const name = key.includes(':') ? '未完成符文之语（原始名称键重复）' : itemName(identity);
    const status = num(raw, 'complete') !== 1 ? `原始未完成（complete≠1），离线匹配禁用；${DEFINITION}`
      : num(raw, 'server') === 1 ? `服务器限定（server=1），原版离线匹配禁用；${DEFINITION}，属性处理仍不完整`
      : offlineWords.has(identity) ? `原版离线匹配已启用；${PARTIAL}` : `离线匹配未纳入；${DEFINITION}`;
    const runes = Array.from({ length: 6 }, (_, i) => text(raw, `Rune${i + 1}`)).filter(Boolean);
    const allowed = Array.from({ length: 6 }, (_, i) => text(raw, `itype${i + 1}`)).filter(Boolean);
    const excluded = Array.from({ length: 3 }, (_, i) => text(raw, `etype${i + 1}`)).filter(Boolean);
    return entry('runeword', key, name, '', status, raw, [
      `原始名称：${sourceName} / 身份：${identity}`,
      `符文顺序：${runes.map(code => `${baseName(code)} (${code})`).join(' → ') || '未定义'} / 孔数：${runes.length}`,
      `允许类型：${allowed.join(', ') || '未定义'} / 排除类型：${excluded.join(', ') || '无'}`,
    ]);
  }),
  ...rawRows('gems').filter(raw => text(raw, 'code')).map(raw => {
    const code = text(raw, 'code'), kind = /^r\d{2}$/.test(code) ? 'rune' : 'gem';
    return entry(kind, code, baseName(code), code, `镶嵌按武器、头盔/护甲、盾牌区分；${PARTIAL}`, raw);
  }),
  ...affixes('prefix', prefixes), ...affixes('suffix', suffixes),
  ...Object.entries(cube).filter(([, raw]) => text(raw, 'description')).map(([key, raw]) => {
    const output = text(raw, 'output').split(',')[0];
    const code = rawBases.has(output) && !text(raw, 'output b') && !text(raw, 'output c') ? output : '';
    const status = num(raw, 'enabled') === 1 ? `原始启用，目录仅定义，不代表此配方可执行；方块仅支持升级、打孔、清孔和维修子集`
      : `原始禁用（enabled≠1）；${DEFINITION}`;
    return entry('cube', key, text(raw, 'description'), code, status, raw, [
      '高阶升级配方的 ladder 标记不等同符文之语 server 限制；离线允许对应升级子集，特殊事件入口未实现。',
    ]);
  }),
];
for (const category of CATALOG_CATEGORIES) Object.freeze(category);
Object.freeze(CATALOG_CATEGORIES);
Object.freeze(EQUIPMENT_CATALOG);

export function searchEquipment(kind: CatalogKind, query: string): EquipmentEntry[] {
  const needle = query.trim().toLowerCase();
  return EQUIPMENT_CATALOG.filter(entry => entry.kind === kind && (!needle || [
    entry.name, entry.code, entry.kind === 'runeword' ? WORD_ALIASES.get(`${text(entry.raw, 'Name')}:${num(entry.raw, 'lineNumber')}`) ?? '' : '', ...['name', 'Name', 'Rune Name', 'index', 'namestr', '*name', 'description', 'set'].map(key => String(entry.raw[key] ?? '')),
  ].some(value => value.toLowerCase().includes(needle))));
}
