import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { rawRows } from '../src/catalog';
import { BASE_ITEMS, getBase, RUNES, RUNEWORDS } from '../src/items';
import { CATALOG_CATEGORIES, EQUIPMENT_CATALOG, searchEquipment } from '../src/equipment-catalog';
import type { CatalogKind, EquipmentEntry } from '../src/equipment-catalog';

// Read files independently: do not use rawRows or runtime filters as the oracle.
type SourceRow = Record<string, string | number | boolean | null>;
function source(table: string): Record<string, SourceRow> {
  return JSON.parse(readFileSync(new URL(`../src/data/raw/${table}.json`, import.meta.url), 'utf8'));
}
const bases = ['weapons', 'armor', 'misc'].flatMap(table => Object.values(source(table)));
const basesByCode = new Map(bases.map(row => [String(row.code), row]));
const uniqueRows = source('UniqueItems'), setItems = source('SetItems'), sets = source('Sets');
const wordRows = source('Runes'), socketRows = source('gems'), cubeRows = source('cubemain');
const prefixRows = source('MagicPrefix'), suffixRows = source('MagicSuffix');
const byId = new Map(EQUIPMENT_CATALOG.map(entry => [entry.id, entry]));
const entries = (kind: CatalogKind) => EQUIPMENT_CATALOG.filter(entry => entry.kind === kind);
function find(id: string): EquipmentEntry {
  const entry = byId.get(id);
  assert.ok(entry, id);
  return entry;
}
const sorted = (values: string[]) => values.slice().sort();
const counts: Record<CatalogKind, number> = {
  base: 659, unique: 388, 'set-item': 127, set: 32, runeword: 169,
  rune: 33, gem: 35, prefix: 636, suffix: 741, cube: 151,
};
const excludedBases = [
  '0sc', 'bpl', 'bps', 'brz', 'ear', 'eyz', 'flg', 'fng', 'hpf', 'hpo', 'hrb', 'hrn',
  'hrt', 'jaw', 'mpf', 'mpo', 'qll', 'rpl', 'rps', 'scz', 'sol', 'spe', 'tal', 'tch',
];

// IDs deliberately retain sparse numeric source keys and original word Name identities.
const expected: { kind: CatalogKind; id: string; code: string; raw: SourceRow }[] = [
  ...bases.map(raw => ({ kind: 'base' as const, id: `base:${raw.code}`, code: String(raw.code), raw })),
  ...Object.entries(uniqueRows).filter(([, raw]) => raw.index && raw.code).map(([key, raw]) =>
    ({ kind: 'unique' as const, id: `unique:${key}`, code: String(raw.code), raw })),
  ...Object.values(setItems).map(raw => ({ kind: 'set-item' as const, id: `set-item:${raw.index}`, code: String(raw.item), raw })),
  ...Object.values(sets).map(raw => ({ kind: 'set' as const, id: `set:${raw.index}`, code: '', raw })),
  ...Object.entries(wordRows).map(([name, raw]) => ({
    kind: 'runeword' as const, id: `runeword:${raw.Name}${name === 'Patience' ? ':118' : ''}`, code: '', raw,
  })),
  ...Object.values(socketRows).map(raw => ({
    kind: /^r\d{2}$/.test(String(raw.code)) ? 'rune' as const : 'gem' as const,
    id: `${/^r\d{2}$/.test(String(raw.code)) ? 'rune' : 'gem'}:${raw.code}`, code: String(raw.code), raw,
  })),
  ...Object.entries(prefixRows).filter(([, raw]) => raw.Name).map(([key, raw]) =>
    ({ kind: 'prefix' as const, id: `prefix:${key}`, code: '', raw })),
  ...Object.entries(suffixRows).filter(([, raw]) => raw.Name).map(([key, raw]) =>
    ({ kind: 'suffix' as const, id: `suffix:${key}`, code: '', raw })),
  ...Object.entries(cubeRows).map(([key, raw]) => {
    // Cube code identifies a single literal output base, not a type or useitem expression.
    const output = String(raw.output ?? '').replace(/^"|"$/g, '').split(',')[0];
    return { kind: 'cube' as const, id: `cube:${key}`, code: basesByCode.has(output) && !raw['output b'] && !raw['output c'] ? output : '', raw };
  }),
];

test('all ten Chinese categories and exactly 2971 indexed definitions have unique stable IDs', () => {
  assert.equal(EQUIPMENT_CATALOG.length, 2971);
  assert.equal(byId.size, 2971, 'no duplicate IDs, even for repeated display names');
  assert.deepEqual(CATALOG_CATEGORIES.map(category => category.kind), Object.keys(counts));
  for (const { label } of CATALOG_CATEGORIES) assert.match(label, /[\u4e00-\u9fff]/);
  for (const kind of Object.keys(counts) as CatalogKind[]) {
    const actual = entries(kind), independent = expected.filter(row => row.kind === kind);
    assert.equal(actual.length, counts[kind], kind);
    assert.equal(independent.length, counts[kind], `${kind} pinned source count`);
    assert.deepEqual(sorted(actual.map(row => row.id)), sorted(independent.map(row => row.id)), `${kind} exact ID set`);
    assert.deepEqual(sorted(actual.map(row => `${row.id}=${row.code}`)), sorted(independent.map(row => `${row.id}=${row.code}`)), `${kind} exact code bindings`);
  }
});

test('every raw definition and all tuples are retained verbatim, including conditional and formula fields', () => {
  for (const row of expected) {
    const actual = find(row.id);
    assert.deepEqual(actual.raw, row.raw, row.id);
    assert.ok(actual.name && actual.status && actual.lines.length, row.id);
    const rawLine = actual.lines.find(line => line.startsWith('原始字段：'));
    assert.ok(rawLine, row.id);
    assert.deepEqual(JSON.parse(rawLine.slice('原始字段：'.length)), row.raw, `${row.id} visible raw tuples`);
  }
  assert.equal(find('cube:15').raw['input 1'], '"weap,sock"');
  assert.equal(find('cube:146').raw['mod 2 max'], 50);
  assert.equal(find('runeword:Runeword81').raw.T1Min6, -5);
  assert.equal(find('runeword:Runeword33').raw.T1Param4, 6);
  assert.equal(find("set:Aldur's Watchtower").raw.FCode7, 'state');
  assert.equal(find('gem:skc').raw.helmMod2Code, 'regen-mana');
});

test('runtime base completeness is the exact raw complement of 24 documented legacy exclusions', () => {
  assert.equal(Object.keys(source('weapons')).length, 306);
  assert.equal(Object.keys(source('armor')).length, 202);
  assert.equal(Object.keys(source('misc')).length, 151);
  assert.equal(BASE_ITEMS.length, 635);
  assert.equal(new Set(BASE_ITEMS.map(base => base.code)).size, 635);
  assert.deepEqual(sorted(BASE_ITEMS.map(base => base.code)), sorted(bases.map(row => String(row.code)).filter(code => !excludedBases.includes(code))));
  assert.deepEqual(sorted(entries('base').filter(entry => entry.status.includes('底材未纳入')).map(entry => entry.code)), sorted(excludedBases));
  for (const code of excludedBases) {
    assert.equal(getBase(code), undefined, code);
    assert.match(find(`base:${code}`).status, /仅定义/);
  }
  // Recovery potions have no spawnable flag but are referenced by TC/recipes.
  for (const code of ['rvs', 'rvl']) {
    assert.equal(basesByCode.get(code)!.spawnable, undefined);
    assert.ok(getBase(code));
    assert.match(find(`base:${code}`).status, /底材已纳入/);
  }
  for (const code of ['hst', 'qf1', 'qf2', 'box']) {
    assert.ok(Number(basesByCode.get(code)!.quest) > 0, code);
    assert.match(find(`base:${code}`).status, /不保证掉落或商店可得/);
  }
  assert.ok(!basesByCode.has('xxx') && !basesByCode.has('0bk'));
});

test('metadata and dimensions agree with independent raw rows and with runtime presentation', () => {
  const weapons = new Set(Object.keys(source('weapons')));
  const itemTypes = new Map(Object.values(source('ItemTypes')).map(row => [String(row.Code), row]));
  const slotTypes: Record<string, string> = {
    tors: 'body', helm: 'head', circ: 'head', pelt: 'head', phlm: 'head', shie: 'offhand', ashd: 'offhand', head: 'offhand',
    glov: 'gloves', boot: 'boots', belt: 'belt', ring: 'ring1', amul: 'neck', bowq: 'offhand', xboq: 'offhand',
  };
  for (const base of BASE_ITEMS) {
    const row = basesByCode.get(base.code)!;
    assert.deepEqual(base.raw, row, base.code);
    assert.deepEqual([base.width, base.height], [row.invwidth, row.invheight], base.code);
    assert.equal(base.english, row.name, base.code);
    assert.equal(base.type, row.type, base.code);
    assert.equal(base.slot, weapons.has(base.code) ? 'weapon' : slotTypes[String(row.type)], base.code);
    for (const [field, rawKey] of [
      ['requiredLevel', 'levelreq'], ['qlvl', 'level'], ['strength', 'reqstr'], ['dexterity', 'reqdex'],
      ['maxSockets', 'gemsockets'], ['defenseMin', 'minac'], ['defenseMax', 'maxac'],
    ] as const) assert.equal(base[field], Number(row[rawKey] ?? 0), `${base.code}.${field}`);
    assert.equal(base.twoHanded, row['2handed'] === 1, base.code);
    assert.equal(base.minDamage, Number(row[row['2handed'] === 1 ? '2handmindam' : 'mindam'] ?? 0), base.code);
    assert.equal(base.maxDamage, Number(row[row['2handed'] === 1 ? '2handmaxdam' : 'maxdam'] ?? 0), base.code);
    assert.equal(base.durability, row.nodurability ? 0 : Number(row.durability ?? 0), base.code);
    const type = itemTypes.get(String(row.type));
    assert.ok(type, base.code);
    assert.equal(base.classId, type.Class ? String(type.Class).toLowerCase() : undefined, base.code);
    const display = find(`base:${base.code}`);
    assert.ok(display.lines.includes(`尺寸：${base.width}×${base.height}`), base.code);
    assert.ok(display.lines.includes(`底材需求：等级 ${base.requiredLevel} / 力量 ${base.strength} / 敏捷 ${base.dexterity}`), base.code);
    assert.ok(display.lines.includes(`底材伤害：${base.minDamage}–${base.maxDamage}${base.twoHanded ? '（双手）' : ''} / 防御：${base.defenseMin}–${base.defenseMax}`), base.code);
    assert.ok(display.lines.some(line => line.endsWith(`腰带行数：${base.beltRows}`)), base.code);
  }
  for (const [code, rows] of [['lbl', 2], ['vbl', 2], ['mbl', 3], ['tbl', 3], ['hbl', 4], ['zlb', 4], ['ulc', 4]] as const) {
    assert.equal(getBase(code)!.beltRows, rows, code);
  }
  assert.deepEqual(sorted([...new Set(BASE_ITEMS.map(base => base.classId).filter((id): id is NonNullable<typeof id> => !!id))]), ['ama', 'ass', 'bar', 'dru', 'nec', 'pal', 'sor']);
  for (const entry of EQUIPMENT_CATALOG.filter(entry => entry.code)) {
    const row = basesByCode.get(entry.code)!;
    assert.ok(row, entry.id);
    assert.ok(entry.lines.includes(`尺寸：${row.invwidth}×${row.invheight}`), entry.id);
  }
});

test('all 33 runes and seven complete five-grade gem families retain exact codes and socket contexts', () => {
  const runeCodes = Array.from({ length: 33 }, (_, i) => `r${String(i + 1).padStart(2, '0')}`);
  assert.deepEqual(sorted(entries('rune').map(entry => entry.code)), runeCodes);
  assert.deepEqual(RUNES.map(rune => rune.code), runeCodes);
  const families = [
    ['gcv', 'gfv', 'gsv', 'gzv', 'gpv'], ['gcb', 'gfb', 'gsb', 'glb', 'gpb'], ['gcg', 'gfg', 'gsg', 'glg', 'gpg'],
    ['gcr', 'gfr', 'gsr', 'glr', 'gpr'], ['gcw', 'gfw', 'gsw', 'glw', 'gpw'], ['gcy', 'gfy', 'gsy', 'gly', 'gpy'],
    ['skc', 'skf', 'sku', 'skl', 'skz'],
  ];
  assert.deepEqual(sorted(entries('gem').map(entry => entry.code)), sorted(families.flat()));
  for (const family of families) for (let i = 0; i < family.length; i++) {
    const code = family[i], row = basesByCode.get(code)!;
    assert.equal(row.BetterGem, family[i + 1] ?? 'non', code);
    assert.match(find(`gem:${code}`).name, /[\u4e00-\u9fff]/);
    assert.match(find(`gem:${code}`).status, /武器、头盔\/护甲、盾牌/);
    assert.equal(row.type2, `gem${i}`, code);
  }
  for (const rune of RUNES) {
    const entry = find(`rune:${rune.code}`);
    assert.equal(entry.name, rune.name);
    assert.equal(getBase(rune.code)!.requiredLevel, rune.level);
  }
  // Pinned spelling/type anomalies are presentation-only corrections, never raw edits.
  assert.equal(find('gem:glb').raw.name, 'Flwless Saphire');
  assert.equal(find('gem:glb').name, '无瑕疵的蓝宝石');
  assert.equal(find('base:gcb').raw.type, 'gems');
  assert.equal(find('base:gcb').name, '碎裂的蓝宝石');
});

test('385 enabled uniques and every set piece have valid bases; all 32 set relations are complete', () => {
  const enabled = entries('unique').filter(entry => entry.raw.enabled === 1);
  assert.equal(enabled.length, 385);
  for (const entry of [...enabled, ...entries('set-item')]) {
    assert.ok(basesByCode.has(entry.code), entry.id);
    assert.ok(getBase(entry.code), entry.id);
  }
  const relationCounts = [4, 4, 4, 4, 3, 2, 5, 3, 3, 3, 3, 4, 4, 3, 4, 6, 3, 4, 4, 5, 4, 4, 3, 4, 4, 3, 6, 5, 5, 5, 5, 4];
  assert.equal(Object.keys(sets).length, relationCounts.length);
  Object.keys(sets).forEach((key, i) => {
    assert.equal(Object.values(setItems).filter(row => row.set === key).length, relationCounts[i], key);
    assert.equal(entries('set-item').filter(entry => entry.raw.set === key).length, relationCounts[i], key);
  });
  for (const entry of entries('set-item')) {
    assert.ok(byId.has(`set:${entry.raw.set}`), entry.id);
    assert.ok(entry.lines.includes(`所属套装：${entry.raw.set}`), entry.id);
    assert.match(entry.status, /组合奖励未实现/);
  }
  for (const entry of entries('set')) assert.match(entry.status, /仅定义/);
});

test('disabled unique rows, sparse IDs, placeholders and level restrictions stay explicit; ladder uniques remain offline candidates', () => {
  assert.equal(Object.keys(uniqueRows).length, 401);
  const placeholders = ['201', '248', '268', '279', '296', '304', '306', '319', '340', '353', '363', '373', '378'];
  assert.deepEqual(Object.keys(uniqueRows).filter(key => !uniqueRows[key].code), placeholders);
  for (const key of placeholders) assert.equal(byId.has(`unique:${key}`), false, 'no single-base definition');
  assert.equal(uniqueRows['129'], undefined, 'source key hole must not shift later IDs');
  assert.equal(find('unique:130').name, String(uniqueRows['130'].index));
  assert.deepEqual(entries('unique').filter(entry => entry.raw.enabled !== 1).map(entry => entry.id), ['unique:29', 'unique:264', 'unique:347']);
  for (const id of ['unique:29', 'unique:264', 'unique:347']) assert.match(find(id).status, /原始禁用.*仅定义/);
  assert.equal(find('unique:29').name, 'Azurewrath');
  assert.equal(find('unique:29').code, 'crs');
  assert.equal(find('unique:302').name, 'Azurewrath');
  assert.equal(find('unique:302').code, '7cr');
  const ladderKeys = [291, 293, 299, 301, 302, 303, 310, 311, 312, 314, 315, 316, 317, 318, 323, 326, 327, 331, 332, 335, 337, 339, 346, 355, 358, 360, 372, 376, 387];
  assert.deepEqual(entries('unique').filter(entry => entry.raw.ladder === 1).map(entry => entry.id), ladderKeys.map(key => `unique:${key}`));
  for (const key of ladderKeys) assert.match(find(`unique:${key}`).status, /运行时候选.*天梯标记不限制原版离线/);
  const eventDefinitions = entries('unique').filter(entry => Number(entry.raw.lvl) > 99);
  assert.deepEqual(eventDefinitions.map(entry => entry.name), ['Annihilus', 'Hellfire Torch']);
  for (const entry of eventDefinitions) assert.match(entry.status, /不可选取.*仅定义/);
  assert.equal(entries('unique').filter(entry => entry.status.startsWith('运行时候选')).length, 383);
});

test('78 complete words have original Name identities: 55 offline matches, 23 server-disabled, 91 incomplete', () => {
  const complete = entries('runeword').filter(entry => entry.raw.complete === 1);
  const offline = complete.filter(entry => entry.raw.server !== 1), server = complete.filter(entry => entry.raw.server === 1);
  assert.equal(complete.length, 78);
  assert.equal(offline.length, 55);
  assert.equal(server.length, 23);
  assert.equal(entries('runeword').length - complete.length, 91);
  assert.deepEqual(sorted(RUNEWORDS.map(word => String(word.raw.Name))), sorted(offline.map(entry => String(entry.raw.Name))));
  const itemTypes = new Set(Object.values(source('ItemTypes')).map(row => row.Code));
  for (const entry of complete) {
    assert.equal(entry.id, `runeword:${entry.raw.Name}`, entry.name);
    const runes = Object.entries(entry.raw).filter(([key]) => /^Rune[1-6]$/.test(key)).map(([, code]) => String(code));
    assert.ok(runes.length >= 2 && runes.length <= 6, entry.id);
    for (const code of runes) assert.ok(byId.has(`rune:${code}`) && getBase(code), `${entry.id}:${code}`);
    const allowed = Object.entries(entry.raw).filter(([key]) => /^itype[1-6]$/.test(key));
    assert.ok(allowed.length, entry.id);
    for (const [, type] of allowed) assert.ok(itemTypes.has(type), entry.id);
  }
  for (const entry of offline) {
    assert.match(entry.status, /离线匹配已启用.*仅部分行为/);
    assert.equal(entry.name, RUNEWORDS.find(word => word.raw.Name === entry.raw.Name)!.name);
  }
  for (const entry of server) assert.match(entry.status, /server=1.*离线匹配禁用.*仅定义.*不完整/);
  for (const entry of entries('runeword').filter(entry => entry.raw.complete !== 1)) assert.match(entry.status, /未完成.*匹配禁用.*仅定义/);
  assert.equal(find('runeword:Runeword47').name, 'Grief');
  assert.equal(find('runeword:Runeword99').name, 'Voice of Reason');
  assert.equal(find('runeword:Runeword14').name, 'Chains of Honor');
  assert.equal(find('runeword:Runeword60').name, 'Infinity');
  assert.equal(find('runeword:Runeword60').raw['Rune Name'], null);
  assert.equal(find('runeword:Runeword95').name, 'Passion');
  assert.equal(find('runeword:Runeword95:118').name, 'Patience');
  assert.equal(wordRows.Patience.Name, wordRows.Passion.Name, 'explicit pinned duplicate identity');
  assert.equal(find('runeword:Runeword97').name, 'Pattern');
  assert.match(find('runeword:Runeword97').status, /未完成/, 'do not enable a later D2R word');
});

test('historical affixes and all 151 cube definitions are visible without claiming generic execution', () => {
  assert.equal(Object.keys(prefixRows).length, 637);
  assert.equal(Object.keys(suffixRows).length, 742);
  assert.deepEqual(Object.keys(prefixRows).filter(key => !prefixRows[key].Name), ['153']);
  assert.deepEqual(Object.keys(suffixRows).filter(key => !suffixRows[key].Name), ['4']);
  assert.equal(byId.has('prefix:153'), false);
  assert.equal(byId.has('suffix:4'), false);
  assert.equal(find('prefix:669').name, String(prefixRows['669'].Name));
  assert.equal(find('suffix:747').name, String(suffixRows['747'].Name));
  assert.equal(entries('prefix').filter(entry => entry.status.startsWith('运行时候选')).length, 501);
  assert.equal(entries('suffix').filter(entry => entry.status.startsWith('运行时候选')).length, 466);
  for (const entry of [...entries('prefix'), ...entries('suffix')].filter(entry => entry.raw.version !== 1 && entry.raw.version !== 100)) {
    assert.match(entry.status, /历史版本.*禁用.*仅定义/);
  }
  assert.equal(entries('cube').filter(entry => entry.raw.enabled === 1).length, 146);
  const disabled = ['cube:142', 'cube:143', 'cube:144', 'cube:145', 'cube:146'];
  assert.deepEqual(entries('cube').filter(entry => entry.raw.enabled !== 1).map(entry => entry.id), disabled);
  for (const id of disabled) assert.match(find(id).status, /原始禁用.*仅定义/);
  for (const entry of entries('cube').filter(entry => entry.raw.enabled === 1)) assert.match(entry.status, /仅定义.*不代表此配方可执行/);
  assert.equal(find('cube:104').raw.ladder, 1);
  assert.ok(find('cube:104').lines.some(line => line.includes('离线允许对应升级子集')));
  assert.match(find('cube:64').name, /hitpower helm/);
  assert.match(find('cube:64').status, /不代表此配方可执行/, 'crafting still unsupported');
  assert.equal(find('cube:148').code, '', 'portal is not an inventory base');
});

test('search is case-insensitive substring matching of Chinese, display, raw names and codes', () => {
  for (const kind of Object.keys(counts) as CatalogKind[]) {
    assert.deepEqual(searchEquipment(kind, ''), entries(kind));
    assert.deepEqual(searchEquipment(kind, ' \t\n '), entries(kind));
    assert.deepEqual(searchEquipment(kind, 'not-a-real-definition-!'), []);
  }
  for (const entry of EQUIPMENT_CATALOG) {
    for (const query of [entry.name, entry.code, ...['name', 'Name', 'Rune Name', 'index', 'description'].map(key => String(entry.raw[key] ?? ''))].filter(Boolean)) {
      assert.ok(searchEquipment(entry.kind, query.toUpperCase()).some(result => result.id === entry.id), `${entry.id}: ${query}`);
    }
  }
  assert.deepEqual(searchEquipment('base', ' 短棍 ').map(entry => entry.id), ['base:sst']);
  assert.ok(searchEquipment('base', 'HaNd Ax').some(entry => entry.code === 'hax'));
  assert.deepEqual(searchEquipment('unique', 'azurewrath').map(entry => entry.code), ['crs', '7cr']);
  assert.deepEqual(searchEquipment('runeword', 'by duty').map(entry => entry.name), ['Chains of Honor']);
  assert.deepEqual(searchEquipment('runeword', 'Runeword95').map(entry => entry.name), ['Passion', 'Patience']);
  assert.deepEqual(searchEquipment('gem', '蓝宝石').map(entry => entry.code).sort(), ['gcb', 'gfb', 'glb', 'gpb', 'gsb']);
  assert.deepEqual(searchEquipment('runeword', 'inFinIty').map(entry => entry.id), ['runeword:Runeword60']);
});

test('the index is read-only and search results cannot mutate shared runtime or catalog data', () => {
  const before = JSON.stringify(rawRows('weapons'));
  const entry = find('base:hax'), runtime = getBase('hax')!;
  assert.notEqual(entry.raw, runtime.raw);
  assert.ok(Object.isFrozen(EQUIPMENT_CATALOG) && Object.isFrozen(CATALOG_CATEGORIES));
  assert.ok(Object.isFrozen(entry) && Object.isFrozen(entry.raw) && Object.isFrozen(entry.lines));
  assert.throws(() => { entry.raw.code = 'bad'; }, TypeError);
  assert.throws(() => { entry.name = 'bad'; }, TypeError);
  assert.throws(() => entry.lines.push('bad'), TypeError);
  assert.throws(() => EQUIPMENT_CATALOG.pop(), TypeError);
  const results = searchEquipment('base', 'hax');
  results.splice(0, results.length);
  assert.equal(searchEquipment('base', 'hax').length, 1);
  assert.equal(JSON.stringify(rawRows('weapons')), before);
});
