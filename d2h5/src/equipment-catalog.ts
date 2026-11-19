import { CLASSES, getSkill, num, rawRows, text } from './catalog';
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
      : identity === 'Runeword31' && offlineWords.has(identity) ? `重制版离线边缘覆盖已启用（原始 server=1）；${PARTIAL}`
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

const RUNEWORD_GROUP_ORDER = ['武器', '盔甲', '头盔', '盾牌'];

export function runewordEquipmentGroup(entry: EquipmentEntry): string {
  const groups = new Set<string>();
  for (let i = 1; i <= 6; i++) {
    const type = text(entry.raw, `itype${i}`);
    if (!type) continue;
    if (type === 'tors') groups.add('盔甲');
    else if (type === 'helm') groups.add('头盔');
    else if (type === 'shld' || type === 'pala') groups.add('盾牌');
    else groups.add('武器');
  }
  return RUNEWORD_GROUP_ORDER.filter(group => groups.has(group)).join(' / ') || '未定义';
}

export function runewordRequiredLevel(entry: EquipmentEntry): number {
  const levels = Array.from({ length: 6 }, (_, index) => text(entry.raw, `Rune${index + 1}`))
    .filter(Boolean)
    .map(code => getBase(code)?.requiredLevel)
    .filter((level): level is number => level !== undefined);
  return levels.length ? Math.max(...levels) : Number.POSITIVE_INFINITY;
}

interface PropertyTuple {
  code: string;
  parameter: string;
  min: number;
  max: number;
  context: string;
}

const PROPERTY_LABELS: Record<string, string> = {
  str: '力量', dex: '敏捷', vit: '体力', enr: '精力', hp: '生命', mana: '法力', stam: '耐力',
  att: '攻击准确率', ac: '防御', 'ac-hth': '近战防御', 'ac-miss': '远程防御', block: '格挡几率',
  'dmg-min': '最小伤害', 'dmg-max': '最大伤害', dmg: '伤害', 'dmg-norm': '伤害',
  'res-fire': '火焰抗性', 'res-cold': '冰冷抗性', 'res-ltng': '闪电抗性', 'res-pois': '毒素抗性',
  'res-all': '所有抗性', 'res-fire-max': '最大火焰抗性', 'res-cold-max': '最大冰冷抗性',
  'res-ltng-max': '最大闪电抗性', 'res-pois-max': '最大毒素抗性', 'res-all-max': '所有最大抗性',
  'abs-fire': '火焰吸收', 'abs-cold': '冰冷吸收', 'abs-ltng': '闪电吸收', 'abs-mag': '魔法吸收',
  regen: '生命恢复速度', thorns: '攻击者受到伤害', 'light-thorns': '攻击者受到闪电伤害',
  'heal-kill': '每杀死一个敌人后获得生命', 'mana-kill': '每杀死一个敌人后获得法力',
  'demon-heal': '每杀死一个恶魔后获得生命', 'dmg-to-mana': '受到伤害转移至法力',
  'red-dmg': '物理伤害降低', 'red-mag': '魔法伤害降低', dur: '最大耐久度',
  light: '照亮范围', stack: '数量上限', addxp: '获得经验值', cheap: '商人价格降低',
  'att-demon': '对恶魔的攻击准确率', 'att-undead': '对不死生物的攻击准确率',
  'dmg-demon': '对恶魔的伤害', 'dmg-undead': '对不死生物的伤害', 'dmg-ac': '目标防御',
  'att-dem': '对恶魔的攻击准确率', 'att-und': '对不死生物的攻击准确率',
  'dmg-dem': '对恶魔的伤害', 'dmg-und': '对不死生物的伤害',
  'gold%': '从怪物身上获得的金币', 'mag%': '获得魔法装备的几率', 'deadly': '致命攻击几率',
  'dmg%': '增强伤害', 'ac%': '增强防御', 'att%': '攻击准确率',
  'fire-min': '最小火焰伤害', 'fire-max': '最大火焰伤害', 'cold-min': '最小冰冷伤害',
  'cold-max': '最大冰冷伤害', 'ltng-min': '最小闪电伤害', 'ltng-max': '最大闪电伤害',
  'pois-min': '最小毒素伤害', 'pois-max': '最大毒素伤害', 'cold-len': '冰冷持续时间',
  'pois-len': '毒素持续时间', 'regen-stam': '耐力恢复速度', stamdrain: '耐力消耗降低',
};

const PERCENT_PROPERTIES = new Set([
  'ac%', 'att%', 'block', 'block2', 'block3', 'crush', 'deadly', 'dmg%', 'dmg-demon', 'dmg-undead',
  'dmg-to-mana', 'gold%', 'hp%', 'lifesteal', 'mag%', 'mana%', 'manasteal', 'openwounds',
  'red-dmg%', 'regen-mana', 'regen-stam', 'res-fire', 'res-cold', 'res-ltng', 'res-pois', 'res-all',
  'res-fire-max', 'res-cold-max', 'res-ltng-max', 'res-pois-max', 'res-all-max', 'res-pois-len',
  'slow', 'stamdrain', 'swing1', 'swing2', 'swing3', 'cast1', 'cast2', 'cast3',
  'balance1', 'balance2', 'balance3', 'move1', 'move2', 'move3', 'abs-fire%', 'abs-cold%', 'abs-ltng%',
  'extra-fire', 'extra-cold', 'extra-ltng', 'extra-pois', 'pierce-fire', 'pierce-cold', 'pierce-ltng', 'pierce-pois',
]);

function propertyTuples(raw: RawRow): PropertyTuple[] {
  const tuples: PropertyTuple[] = [];
  const add = (codeKey: string, parameterKey: string, minKey: string, maxKey: string, context = '') => {
    const code = text(raw, codeKey);
    if (!code || code.startsWith('*')) return;
    tuples.push({ code, parameter: text(raw, parameterKey), min: num(raw, minKey), max: num(raw, maxKey), context });
  };
  for (const key of Object.keys(raw)) {
    let match = key.match(/^prop(\d+)$/);
    if (match) { add(key, `par${match[1]}`, `min${match[1]}`, `max${match[1]}`); continue; }
    match = key.match(/^aprop(\d+)([ab])$/);
    if (match) { add(key, `apar${match[1]}${match[2]}`, `amin${match[1]}${match[2]}`, `amax${match[1]}${match[2]}`, '套装加成'); continue; }
    match = key.match(/^PCode(\d+)([ab])$/);
    if (match) { add(key, `PParam${match[1]}${match[2]}`, `PMin${match[1]}${match[2]}`, `PMax${match[1]}${match[2]}`, `${match[1]} 件套装奖励`); continue; }
    match = key.match(/^FCode(\d+)$/);
    if (match) { add(key, `FParam${match[1]}`, `FMin${match[1]}`, `FMax${match[1]}`, '完整套装奖励'); continue; }
    match = key.match(/^T1Code(\d+)$/);
    if (match) { add(key, `T1Param${match[1]}`, `T1Min${match[1]}`, `T1Max${match[1]}`); continue; }
    match = key.match(/^mod(\d+)code$/);
    if (match) { add(key, `mod${match[1]}param`, `mod${match[1]}min`, `mod${match[1]}max`); continue; }
    match = key.match(/^(weapon|helm|shield)Mod(\d+)Code$/);
    if (match) {
      const prefix = `${match[1]}Mod${match[2]}`;
      const context = { weapon: '武器', helm: '头盔 / 护甲', shield: '盾牌' }[match[1]];
      add(key, `${prefix}Param`, `${prefix}Min`, `${prefix}Max`, context);
    }
  }
  return tuples;
}

function range(min: number, max: number, suffix = ''): string {
  return `${min === max ? min : `${min}–${max}`}${suffix}`;
}

function signedRange(min: number, max: number, suffix = ''): string {
  const value = range(min, max, suffix);
  return min >= 0 && max >= 0 ? `+${value}` : value;
}

function skillName(parameter: string): string {
  const numeric = /^\d+$/.test(parameter) ? Number(parameter) : undefined;
  const row = numeric === undefined ? rawRows('skills').find(skill => text(skill, 'skill').toLowerCase() === parameter.toLowerCase()) : undefined;
  const skill = getSkill(numeric ?? (row ? num(row, 'Id') : -1));
  return skill?.name ?? '技能';
}

function perLevelAmount(min: number, max: number): string {
  const display = (value: number) => Number((value / 8).toFixed(3)).toString();
  return min === max ? display(min) : `${display(min)}–${display(max)}`;
}

function formatProperty(tuple: PropertyTuple): string | null {
  const { parameter, min, max } = tuple;
  const code = tuple.code.toLowerCase();
  if (['state', 'bloody', 'fade'].includes(code)) return null;
  const prefix = tuple.context ? `[${tuple.context}] ` : '';
  const amount = range(min, max), percent = range(min, max, '%');
  const signed = signedRange(min, max), signedPercent = signedRange(min, max, '%');
  const classDef = CLASSES.find(definition => definition.id === code);
  if (classDef) return `${prefix}+${amount} ${classDef.name}技能等级`;
  if (code === 'all-stats') return `${prefix}+${amount} 所有属性`;
  if (code === 'allskills') return `${prefix}+${amount} 所有技能等级`;
  if (code === 'fireskill') return `${prefix}+${amount} 火焰技能等级`;
  if (code === 'skill' || code === 'oskill') return `${prefix}+${amount} ${skillName(parameter)}${code === 'oskill' ? '' : '（仅限对应职业）'}`;
  if (code === 'skill-rand') return `${prefix}+${parameter || 1} 随机技能（技能等级 ${amount}）`;
  if (code === 'randclassskill') return `${prefix}+3 随机职业技能等级`;
  if (code === 'skilltab') {
    const tab = Number(parameter), owner = CLASSES[Math.floor(tab / 3)], tree = owner?.trees[tab % 3];
    return `${prefix}+${amount} ${tree ?? '职业技能树'}（仅限${owner?.name ?? '对应职业'}）`;
  }
  const trigger: Record<string, string> = {
    'hit-skill': '击中敌人时', 'gethit-skill': '被击中时', 'att-skill': '攻击时', 'death-skill': '死亡时',
    'kill-skill': '杀死敌人时', 'levelup-skill': '升级时',
  };
  if (trigger[code]) return `${prefix}${min}% 几率在${trigger[code]}施展 ${max} 级 ${skillName(parameter)}`;
  if (code === 'charged') return `${prefix}${max} 级 ${skillName(parameter)}（${min}/${min} 聚气）`;
  if (code === 'aura') return `${prefix}装备时赋予 ${amount} 级 ${skillName(parameter)}灵气`;
  if (code === 'dmg%') return `${prefix}增强伤害 ${percent}`;
  if (code === 'ac%') return `${prefix}增强防御 ${percent}`;
  if (code === 'att%') return `${prefix}攻击准确率提高 ${percent}`;
  if (code === 'swing1' || code === 'swing2' || code === 'swing3') return `${prefix}提升 ${percent} 攻击速度`;
  if (code === 'cast1' || code === 'cast2' || code === 'cast3') return `${prefix}提升 ${percent} 施法速度`;
  if (code === 'balance1' || code === 'balance2' || code === 'balance3') return `${prefix}提升 ${percent} 打击恢复速度`;
  if (code === 'block2' || code === 'block3') return `${prefix}提升 ${percent} 格挡速度`;
  if (code === 'move1' || code === 'move2' || code === 'move3') return `${prefix}提升 ${percent} 跑步 / 行走速度`;
  if (code === 'openwounds') return `${prefix}${percent} 撕开伤口机会`;
  if (code === 'crush') return `${prefix}${percent} 造成压碎性打击的几率`;
  if (code === 'deadly') return `${prefix}${percent} 致命攻击几率`;
  if (code === 'lifesteal') return `${prefix}${percent} 击中偷取生命`;
  if (code === 'manasteal') return `${prefix}${percent} 击中偷取法力`;
  if (code === 'mag%') return `${prefix}获得魔法装备的几率提高 ${percent}`;
  if (code === 'gold%') return `${prefix}从怪物身上获得的金币提高 ${percent}`;
  if (code === 'hp%') return `${prefix}最大生命提高 ${percent}`;
  if (code === 'mana%') return `${prefix}最大法力提高 ${percent}`;
  if (code === 'regen-mana') return `${prefix}法力恢复速度提高 ${percent}`;
  if (code === 'regen-stam') return `${prefix}耐力恢复速度提高 ${percent}`;
  if (code === 'red-dmg%') return `${prefix}物理伤害降低 ${percent}`;
  if (code === 'res-pois-len') return `${prefix}毒素持续时间缩短 ${percent}`;
  if (code === 'slow') return `${prefix}使目标减速 ${percent}`;
  if (code === 'stamdrain') return `${prefix}耐力消耗降低 ${percent}`;
  if (code === 'extra-fire') return `${prefix}火焰技能伤害提高 ${percent}`;
  if (code === 'extra-cold') return `${prefix}冰冷技能伤害提高 ${percent}`;
  if (code === 'extra-ltng') return `${prefix}闪电技能伤害提高 ${percent}`;
  if (code === 'extra-pois') return `${prefix}毒素技能伤害提高 ${percent}`;
  if (code.startsWith('pierce-')) {
    const element = { fire: '火焰', cold: '冰冷', ltng: '闪电', pois: '毒素' }[code.slice(7)];
    return `${prefix}敌人的${element ?? '元素'}抗性降低 ${percent}`;
  }
  if (code === 'dmg-fire') return `${prefix}增加 ${amount} 点火焰伤害`;
  if (code === 'dmg-cold') return `${prefix}增加 ${amount} 点冰冷伤害`;
  if (code === 'dmg-ltng') return `${prefix}增加 ${amount} 点闪电伤害`;
  if (code === 'dmg-mag') return `${prefix}增加 ${amount} 点魔法伤害`;
  if (code === 'dmg-pois') return `${prefix}增加 ${amount} 点毒素伤害`;
  if (code === 'dmg-elem') return `${prefix}增加 ${amount} 点元素伤害`;
  if (code === 'nofreeze') return `${prefix}无法冰冻`;
  if (code === 'indestruct') return `${prefix}无法破坏`;
  if (code === 'ethereal') return `${prefix}无形（无法修复）`;
  if (code === 'ignore-ac') return `${prefix}忽视目标防御`;
  if (code === 'noheal') return `${prefix}防止怪物自疗`;
  if (code === 'half-freeze') return `${prefix}冰冻时间减半`;
  if (code === 'knock') return `${prefix}击退`;
  if (code === 'rip') return `${prefix}被杀死的怪物会安息`;
  if (code === 'magicarrow') return `${prefix}射出魔法箭矢`;
  if (code === 'explosivearrow') return `${prefix}射出爆炸箭矢`;
  if (code === 'pierce') return `${prefix}穿刺攻击`;
  if (code === 'noheal') return `${prefix}防止怪物自疗`;
  if (code === 'freeze') return `${prefix}冻结目标 +${amount}`;
  if (code === 'howl') return `${prefix}命中使怪物逃跑 ${percent}`;
  if (code === 'stupidity') return `${prefix}使目标失明 +${amount}`;
  if (code === 'reanimate') return `${prefix}${percent} 几率将目标复活为怪物`;
  if (code === 'sock') return `${prefix}镶孔（${parameter || amount}）`;
  if (code === 'ease') return `${prefix}需求 ${signedPercent}`;
  if (code === 'rep-dur') return `${prefix}自动恢复耐久度`;
  if (code === 'rep-quant') return `${prefix}自动补充数量`;
  if (code === 'reduce-ac') return `${prefix}${signed} 目标防御`;
  if (code.endsWith('/lvl')) {
    const baseCode = code.slice(0, -4), label = PROPERTY_LABELS[baseCode] ?? '属性';
    const percentSuffix = PERCENT_PROPERTIES.has(baseCode) || baseCode.endsWith('%') ? '%' : '';
    const factor = Number(parameter);
    const perLevel = Number.isFinite(factor) && parameter !== '' ? perLevelAmount(factor, factor) : perLevelAmount(min, max);
    return `${prefix}+${perLevel}${percentSuffix} ${label}（每角色等级）`;
  }
  if (code.endsWith('/time')) {
    const label = PROPERTY_LABELS[code.slice(0, -5)] ?? '属性';
    return `${prefix}${label}随时间变化（${amount}）`;
  }
  if (PERCENT_PROPERTIES.has(code)) {
    const label = PROPERTY_LABELS[code] ?? {
      'abs-fire%': '火焰吸收', 'abs-cold%': '冰冷吸收', 'abs-ltng%': '闪电吸收',
    }[code] ?? '属性';
    return `${prefix}${label} ${signedPercent}`;
  }
  const label = PROPERTY_LABELS[code];
  return `${prefix}${label ? `${signed} ${label}` : `属性 ${signed}${parameter ? `（${parameter}）` : ''}`}`;
}

export function equipmentPropertyLines(entry: EquipmentEntry): string[] {
  return propertyTuples(entry.raw).map(formatProperty).filter((line): line is string => !!line);
}

function runewordGroupRank(group: string): number {
  const single = RUNEWORD_GROUP_ORDER.indexOf(group);
  if (single >= 0) return single;
  if (group === '未定义') return 100;
  return 10 + RUNEWORD_GROUP_ORDER.reduce((rank, type, index) => rank + (group.includes(type) ? 1 << index : 0), 0);
}

export function searchEquipment(kind: CatalogKind, query: string): EquipmentEntry[] {
  const needle = query.trim().toLowerCase();
  const results = EQUIPMENT_CATALOG.filter(entry => entry.kind === kind && (!needle || [
    entry.name, entry.code, entry.kind === 'runeword' ? WORD_ALIASES.get(`${text(entry.raw, 'Name')}:${num(entry.raw, 'lineNumber')}`) ?? '' : '', ...['name', 'Name', 'Rune Name', 'index', 'namestr', '*name', 'description', 'set'].map(key => String(entry.raw[key] ?? '')),
  ].some(value => value.toLowerCase().includes(needle))));
  if (kind !== 'runeword') return results;
  return results.sort((a, b) => {
    const groupA = runewordEquipmentGroup(a), groupB = runewordEquipmentGroup(b);
    return runewordGroupRank(groupA) - runewordGroupRank(groupB)
      || groupA.localeCompare(groupB, 'zh-CN')
      || runewordRequiredLevel(a) - runewordRequiredLevel(b)
      || a.name.localeCompare(b.name, 'zh-CN')
      || a.id.localeCompare(b.id);
  });
}
