#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ROOT = new URL('../', import.meta.url);
const OUTPUT = new URL('src/data/official-gear.json', ROOT);

// This allowlist is the entire extraction scope; no network or comparator data.
export const PAGE_SPECS = Object.freeze([
  { id: 'e1fe6614443052284ef7', series: 'ordinary', kind: 'weapon', counts: [44] },
  { id: '59138861d3ccb56e4cf5', series: 'ordinary', kind: 'weapon', counts: [48] },
  { id: 'd15600c7e7503aa1f7ab', series: 'ordinary', kind: 'weapon', counts: [33] },
  { id: '9c1ef01ee36759a5edb2', series: 'ordinary', kind: 'weapon', counts: [44] },
  { id: '2d8855695daeb73911ea', series: 'lunar', kind: 'weapon', counts: [9, 3] },
  { id: '645e40c39c6b495aa26f', series: 'lunar', kind: 'armor', counts: [6, 6, 6] },
  { id: '7a0a27bc2b88df6a38fd', series: 'lunar', kind: 'accessory', counts: [3, 3, 2] },
]);

// Exact source labels only. The engine's sword is physical, not a 法剑.
const WEAPONS = new Map([
  ['单剑', 'sword'], ['双剑', 'sword'],
  ['单刀', 'blade'], ['双刀', 'blade'], ['长刀', 'blade'],
  ['双斧', 'axe'], ['单斧', 'axe'], ['长锤', 'axe'], ['双锤', 'axe'],
  ['弓', 'bow'], ['弩', 'bow'], ['弹弓', 'bow'],
  ['短杖', 'wand'], ['法剑', 'wand'], ['幡杖', 'glaive'], ['轮', 'glaive'],
]);
const ARMOR = new Map([
  ['重铠', ['body', 'heavy']], ['重腕', ['wrist', 'heavy']],
  ['重腿', ['legs', 'heavy']], ['重靴', ['feet', 'heavy']], ['重盔', ['head', 'heavy']],
  ['轻甲', ['body', 'light']], ['轻腕', ['wrist', 'light']],
  ['轻腿', ['legs', 'light']], ['轻靴', ['feet', 'light']], ['轻帽', ['head', 'light']],
  ['法袍', ['body', 'robe']], ['法腕', ['wrist', 'robe']],
  ['法裤', ['legs', 'robe']], ['法鞋', ['feet', 'robe']], ['法帽', ['head', 'robe']],
  ['披风', ['cape', null]],
]);
const ACCESSORIES = new Map([
  ['多彩项链', 'neck'], ['流光项链', 'neck'], ['符文项链', 'neck'],
  ['宝坠', 'waist'], ['香囊', 'waist'], ['玉佩', 'waist'],
  ['金属戒指', 'ring1'], ['宝石指环', 'ring1'],
]);
const HEADERS = new Map([
  ['名称', 'name'], ['装备名称', 'name'], ['类型', 'type'], ['图标', 'icon'],
  ['需求职业', 'class'], ['需求人物等级', 'lv'], ['等级', 'lv'], ['品阶', 'grade'],
  ['需求力量点数', 'str'], ['力量', 'str'], ['需求敏捷点数', 'dex'], ['敏捷', 'dex'],
  ['需求体质点数', 'con'], ['体质', 'con'], ['需求灵力点数', 'mag'], ['灵力', 'mag'],
  ['物理攻击', 'patk'], ['法术攻击', 'matk'], ['物理防御', 'def'], ['法术防御', 'mdef'],
  ['躲闪', 'evade'], ['躲闪度', 'evade'], ['生命值', 'hp'], ['真气值', 'mp'],
  ['装备属性', 'affixes'], ['制作材料', 'materials'],
]);
const REQUIREMENTS = ['str', 'dex', 'con', 'mag'];
const STATS = ['patk', 'matk', 'def', 'mdef', 'evade', 'hp', 'mp'];
const DASH = /^[-－—–﹣]+$/u;

function span(value) {
  const result = Number(value ?? 1);
  assert(Number.isSafeInteger(result) && result > 0, `Invalid span: ${value}`);
  return result;
}

// Coordinates are zero-based raw table/row indices, including headers/spacers.
// Reused cell objects retain their origin so inherited names never become items.
export function expandTable(table) {
  const grid = Array.from({ length: table.rows.length }, () => []);
  table.rows.forEach((row, rowIndex) => {
    let column = 0;
    for (const raw of row) {
      while (grid[rowIndex][column] !== undefined) column++;
      const rowspan = span(raw.rowspan), colspan = span(raw.colspan);
      assert(rowIndex + rowspan <= grid.length, 'Rowspan exceeds source table');
      const cell = { text: raw.text ?? '', row: rowIndex, column, rowspan, colspan };
      for (let r = rowIndex; r < rowIndex + rowspan; r++) {
        for (let c = column; c < column + colspan; c++) {
          assert(grid[r][c] === undefined, `Overlapping spans at ${r}:${c}`);
          grid[r][c] = cell;
        }
      }
      column += colspan;
    }
  });
  const width = Math.max(0, ...grid.map(row => row.length));
  return grid.map(row => Array.from({ length: width }, (_, c) => row[c] ?? null));
}

function columnsFor(row) {
  const columns = new Map();
  row.forEach((cell, index) => {
    if (!cell) return;
    const key = HEADERS.get(cell.text.trim());
    assert(key, `Unrecognized header: ${cell.text}`);
    assert(!columns.has(key), `Duplicate header: ${key}`);
    columns.set(key, index);
  });
  assert(columns.has('name') && columns.has('type') && columns.has('lv'), 'Not an equipment table');
  return columns;
}

function textAt(row, columns, key) {
  return row[columns.get(key)]?.text ?? null;
}

function integer(text, requirement = false) {
  if (text === null || text.trim() === '') return null;
  const value = text.trim();
  if (DASH.test(value)) return requirement ? 0 : null;
  assert(/^\d+$/.test(value), `Non-integer source value: ${text}`);
  const result = Number(value);
  assert(Number.isSafeInteger(result), `Unsafe source integer: ${text}`);
  return result;
}

function attack(text) {
  if (text === null || text.trim() === '' || DASH.test(text.trim())) return null;
  const match = text.trim().match(/^(\d+)\s*[-－—–~～]\s*(\d+)$/u);
  // A single printed attack (rings) is a degenerate range, not an added bonus.
  const result = match ? [Number(match[1]), Number(match[2])] : [integer(text), integer(text)];
  assert(result.every(Number.isSafeInteger) && result[0] <= result[1], `Invalid attack range: ${text}`);
  return result;
}

function lines(text) {
  return text === null ? [] : text.split(/\r?\n/).filter(line => line.trim() && !DASH.test(line.trim()));
}

function material(text) {
  const match = text.match(/^(.+?)(?:\s*[×x*]\s*)?(\d+)\s*$/u);
  assert(match, `Material has no explicit quantity: ${text}`);
  const qty = integer(match[2]);
  assert(qty > 0, `Invalid material quantity: ${text}`);
  return { name: match[1].trim(), qty };
}

function classify(spec, type) {
  if (spec.kind === 'weapon') return { slot: 'weapon', weaponType: WEAPONS.get(type) ?? null, armorType: null };
  if (spec.kind === 'armor') {
    assert(ARMOR.has(type), `Unknown armor label: ${type}`);
    const [slot, armorType] = ARMOR.get(type);
    return { slot, weaponType: null, armorType };
  }
  assert(ACCESSORIES.has(type), `Unknown accessory label: ${type}`);
  return { slot: ACCESSORIES.get(type), weaponType: null, armorType: null };
}

function extractTable(page, spec, tableIndex) {
  const grid = expandTable(page.tables[tableIndex]);
  assert(grid.length > 0, `Empty table: ${page.id}:${tableIndex}`);
  const columns = columnsFor(grid[0]);
  const records = [];
  for (let rowIndex = 1; rowIndex < grid.length; rowIndex++) {
    const row = grid[rowIndex];
    const nameCell = row[columns.get('name')];
    if (!nameCell?.text.trim() || nameCell.row !== rowIndex) continue;
    if (['名称', '装备名称'].includes(nameCell.text.trim())) continue;
    assert(row.every(Boolean), `Misaligned named row: ${page.id}:${tableIndex}:${rowIndex}`);
    const type = textAt(row, columns, 'type');
    assert(type?.trim(), `Named row has no type: ${nameCell.text}`);
    const sourceStats = Object.fromEntries(STATS.map(key => [key,
      ['patk', 'matk'].includes(key) ? attack(textAt(row, columns, key)) : integer(textAt(row, columns, key)),
    ]));
    const affixes = [], materials = [];
    const seenAffixes = new Set(), seenMaterials = new Set();
    // Iterate only the rows owned by this exact name cell; collect each origin
    // once, while retaining distinct material cells even if their texts match.
    for (let r = rowIndex; r < rowIndex + nameCell.rowspan; r++) {
      assert(grid[r][columns.get('name')] === nameCell, 'Item continuation lost its name origin');
      for (const [key, seen, output, parse] of [
        ['affixes', seenAffixes, affixes, text => ({ text })],
        ['materials', seenMaterials, materials, material],
      ]) {
        const cell = grid[r][columns.get(key)];
        if (!cell || seen.has(cell)) continue;
        assert(cell.row >= rowIndex && cell.row + cell.rowspan <= rowIndex + nameCell.rowspan,
          `Shared ${key} cell crosses item boundary: ${nameCell.text}`);
        seen.add(cell);
        output.push(...lines(cell.text).map(parse));
      }
    }
    records.push({
      id: `official:${page.id}:${tableIndex}:${rowIndex}`,
      name: nameCell.text,
      ...classify(spec, type),
      type,
      series: spec.series,
      grade: integer(textAt(row, columns, 'grade')),
      lv: integer(textAt(row, columns, 'lv')),
      requirements: Object.fromEntries(REQUIREMENTS.map(key => [key, integer(textAt(row, columns, key), true)])),
      sourceStats,
      affixes,
      materials,
      nameColor: null,
      stars: null,
      source: { url: page.url, pageId: page.id, table: tableIndex, row: rowIndex, sha256: page.sha256 },
    });
  }
  assert.equal(records.length, spec.counts[tableIndex], `Named-row count: ${page.id}:${tableIndex}`);
  return records;
}

function gapsFor(records) {
  const ordinary = records.filter(record => record.series === 'ordinary');
  const lunar = records.filter(record => record.series === 'lunar');
  const unmapped = records.filter(record => record.slot === 'weapon' && record.weaponType === null);
  const unknownTypes = [...new Set(unmapped.map(record => record.type))];
  return [
    {
      code: 'ordinary-fields-not-provided', count: ordinary.length,
      pageIds: PAGE_SPECS.filter(spec => spec.series === 'ordinary').map(spec => spec.id),
      description: '普通武器页仅载真实名称、类型、等级及需求；低级及其余普通武器的基础攻击、品阶、词条、材料均未记载，保持null或空数组，不从等级或精炼单位补值。',
    },
    {
      code: 'missing-requirement-columns', count: lunar.length,
      description: '神月武器/防具只有表头所列的部分需求，神月饰品没有四项需求列；缺列为null，现有需求列中的明确横杠为0，空白为null。',
    },
    {
      code: 'blank-source-requirement',
      recordIds: records.filter(record => record.name === '天师剑').map(record => record.id),
      description: '天师剑的力量需求单元格为空，保留null，未当作横杠或按相邻行推算。',
    },
    {
      code: 'literal-source-anomalies',
      recordIds: records.filter(record => ['真武剑', '逝水幡'].includes(record.name)).map(record => record.id),
      description: '法器页真武剑灵力需求原文为2，逝水幡原文为5；疑似历史表格异常但照录，未经其他获准来源核实，不擅自改成162或165。',
    },
    {
      code: 'unmapped-exact-weapon-labels', count: unmapped.length, types: unknownTypes,
      description: '只映射获准的精确类型标签；本批长斧、宝轮不等同于映射表的单斧、轮，铁拳不受支持，利刃含义不明，weaponType均为null。拳套同样不映射；不按装备名猜匕首。',
    },
    {
      code: 'daggers-and-soulspheres-missing',
      description: '这七页没有明确标注匕首/双匕或魂球/法宝的模板；未用利刃冒充匕首，也未将法器冒充魂球。',
    },
    {
      code: 'other-series-and-low-level-armor-outside-scope',
      description: '仅抽取四页普通武器和三页神月；普通低级防具/饰品、黄昏、覆霜、轮回等不在这次获准来源中，没有合成公式名称模板。',
    },
    {
      code: 'high4-samples-outside-extraction',
      description: 'high4高阶样本不在本次七页抽取范围内；不读取或合并其他高阶数据，也不宣称覆盖其装备。',
    },
    {
      code: 'name-color-and-stars-unverified', count: records.length,
      description: '未研究名称颜色；名称原有★逐字保留，但不代表已验证星数；nameColor与stars全部为null。',
    },
    {
      code: 'unprovided-stats-and-random-pools', count: lunar.length,
      description: '属性中的横杠或缺列保持null；法术防御只存原始mdef，不扩展五行；附加属性保留原文及范围，不推算随机词条池、概率或基础属性。',
    },
    {
      code: 'historical-snapshots-not-current-completeness',
      description: '来源是2009普通武器页和2010专题路径的本地历史归档，sha256沿用归档原页面摘要；不是当前全装备清单，也没有完成游戏接入。',
    },
  ];
}

export function extractOfficialGear() {
  const records = [];
  for (const spec of PAGE_SPECS) {
    const page = JSON.parse(readFileSync(new URL(`official-library/pages/${spec.id}.json`, ROOT), 'utf8'));
    assert.equal(page.id, spec.id);
    assert.equal(page.status, 'ok');
    assert.match(page.sha256, /^[a-f0-9]{64}$/);
    assert.equal(page.tables.length, spec.counts.length, `Unexpected table count: ${spec.id}`);
    page.tables.forEach((_, tableIndex) => records.push(...extractTable(page, spec, tableIndex)));
  }
  assert.equal(new Set(records.map(record => record.id)).size, records.length);
  return { version: 1, records, gaps: gapsFor(records) };
}

export function assertSourceParity(data) {
  const find = name => {
    const matches = data.records.filter(record => record.name === name);
    assert.equal(matches.length, 1, `Exactly one genuine item: ${name}`);
    return matches[0];
  };
  const swords = find('子母双剑');
  assert.deepEqual([swords.lv, swords.requirements.str, swords.requirements.dex], [1, 5, 5]);
  assert.equal(swords.weaponType, 'sword');
  assert.deepEqual(swords.requirements, { str: 5, dex: 5, con: 0, mag: 0 });
  assert.deepEqual(swords.sourceStats, Object.fromEntries(STATS.map(key => [key, null])));
  assert.equal(swords.grade, null);

  const axe = find('★金鳞斩');
  assert.deepEqual([axe.lv, axe.grade, axe.sourceStats.patk, axe.requirements.str, axe.requirements.dex],
    [95, 11, [646, 1508], 287, 52]);
  assert.deepEqual(axe.materials, [
    { name: '碎片凝结体', qty: 5 }, { name: '结晶凝结体', qty: 1 },
    { name: '精华凝结体', qty: 1 }, { name: '自然精髓', qty: 5 },
  ]);
  assert.deepEqual(axe.affixes, [{ text: '力量+11' }, { text: '敏捷+10' }]);
  assert.deepEqual([axe.source.table, axe.source.row], [0, 1]);

  const robe = find('★凤兮法袍');
  assert.deepEqual([robe.lv, robe.grade, robe.sourceStats.def, robe.sourceStats.mdef,
    robe.requirements.str, robe.requirements.mag], [95, 11, 188, 1685, 52, 146]);
  assert.deepEqual([robe.slot, robe.armorType], ['body', 'robe']);
  assert.deepEqual(robe.affixes, [{ text: '灵力+5~6' }, { text: '体质+5~6' }]);
  assert.equal(robe.materials.length, 8);
  assert.deepEqual(robe.materials.map(entry => entry.qty), [3, 1, 2, 2, 2, 2, 5, 3]);
  assert.deepEqual([robe.source.table, robe.source.row], [2, 1]);

  // Accessories use different headers: do not offset level, evade, or attack.
  for (const [name, slot, table, row, def, mdef, evade, patk, matk, qty] of [
    ['★凤势护符', 'neck', 0, 1, null, 288, null, null, null, 3],
    ['★残雷护符', 'neck', 0, 2, null, null, 181, null, null, 3],
    ['★鸣泉护符', 'neck', 0, 3, 288, null, null, null, null, 3],
    ['★浮罄纹饰', 'waist', 1, 1, null, 288, null, null, null, 3],
    ['★混沌纹饰', 'waist', 1, 2, null, null, 181, null, null, 3],
    ['★松风纹饰', 'waist', 1, 3, 288, null, null, null, null, 3],
    ['★霜鸿徽记', 'ring1', 2, 1, null, null, null, [97, 97], null, 5],
    ['★存古徽记', 'ring1', 2, 2, null, null, null, null, [97, 97], 5],
  ]) {
    const item = find(name);
    assert.deepEqual([item.slot, item.source.table, item.source.row, item.lv, item.grade], [slot, table, row, 95, 11]);
    assert.deepEqual(item.sourceStats, { patk, matk, def, mdef, evade, hp: null, mp: null });
    assert.deepEqual(item.requirements, { str: null, dex: null, con: null, mag: null });
    assert.deepEqual(item.materials.map(entry => entry.qty), [slot === 'ring1' ? 4 : 3, 1, 1, qty]);
  }
  for (const prefix of ['★狂客', '★重光', '★凤兮']) {
    const items = data.records.filter(record => record.name.startsWith(prefix));
    assert.equal(items.length, 6);
    assert.deepEqual(items.map(record => record.slot), ['body', 'wrist', 'legs', 'feet', 'head', 'cape']);
    assert.equal(items[5].armorType, null);
    assert.equal(items[5].sourceStats.evade, 242);
  }
  assert.equal(find('★凤兮法冠').sourceStats.mp, 365);
  assert.equal(find('★凤兮法冠').requirements.mag, 0);
  assert.equal(find('天师剑').requirements.str, null);
  assert.equal(find('真武剑').requirements.mag, 2);
  assert.equal(find('逝水幡').requirements.mag, 5);
  for (const item of data.records) {
    assert.equal(item.nameColor, null);
    assert.equal(item.stars, null);
    assert.deepEqual(Object.keys(item.sourceStats), STATS);
    if (item.slot === 'weapon') assert.equal(item.weaponType, WEAPONS.get(item.type) ?? null);
  }
  assert.equal(data.records.length, 207);
  assert.equal(data.records.filter(item => item.series === 'ordinary').length, 169);
  assert.equal(data.records.filter(item => item.slot === 'weapon').length, 181);
}

function assertSpanExpansion() {
  const cell = (text, rowspan = 1, colspan = 1) => ({ text, rowspan, colspan });
  const grid = expandTable({ rows: [
    [cell('A', 2, 2), cell('B')], [cell('C')], [cell('D', 1, 3)], [cell('')],
  ] });
  assert.deepEqual(grid.map(row => row.map(entry => entry?.text ?? null)), [
    ['A', 'A', 'B'], ['A', 'A', 'C'], ['D', 'D', 'D'], ['', null, null],
  ]);
  assert.equal(grid[0][0], grid[1][1]);
  assert.deepEqual([grid[1][1].row, grid[1][1].column], [0, 0]);
  assert.throws(() => expandTable({ rows: [
    [cell('A'), cell('B', 2)], [cell('C', 1, 2)],
  ] }), /Overlapping spans/);
  assert.throws(() => expandTable({ rows: [[cell('A', 2)]] }), /Rowspan exceeds/);
}

export const serializeGear = data => `${JSON.stringify(data, null, 2)}\n`;

function main() {
  const args = process.argv.slice(2);
  assert(args.length === 0 || (args.length === 1 && args[0] === '--check'),
    'Usage: node scripts/extract-official-gear.mjs [--check]');
  assertSpanExpansion();
  const data = extractOfficialGear();
  assertSourceParity(data);
  const output = serializeGear(data);
  assert.equal(serializeGear(extractOfficialGear()), output, 'Extraction must be deterministic');
  if (args[0] === '--check') {
    assert.equal(readFileSync(OUTPUT, 'utf8'), output, 'Generated JSON is stale');
  } else {
    writeFileSync(OUTPUT, output);
  }
  console.log(JSON.stringify({
    output: fileURLToPath(OUTPUT), mode: args[0] === '--check' ? 'check' : 'write',
    pages: PAGE_SPECS.length, tables: PAGE_SPECS.reduce((sum, spec) => sum + spec.counts.length, 0),
    records: data.records.length, ordinary: 169, lunar: 38,
    bySlot: Object.fromEntries([...new Set(data.records.map(item => item.slot))]
      .map(slot => [slot, data.records.filter(item => item.slot === slot).length])),
    unmappedWeapons: data.records.filter(item => item.slot === 'weapon' && item.weaponType === null).length,
    gaps: data.gaps.length, sourceParity: 'passed', reproducible: true,
    sha256: createHash('sha256').update(output).digest('hex'),
  }, null, 2));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
