import assert from 'node:assert/strict';
import { CLASSES } from '../src/data/classes.js';
import { GEAR_RULES } from '../src/data/gear-specs.js';
import { HIGH_EQUIPMENT } from '../src/data/high-equipment.js';
import { NAMED_EQUIPMENT, namedSpec } from '../src/data/named-equipment.js';
import { getProductionRecipes } from '../src/data/production.js';

const originalRandom = Math.random;
const originalUUID = globalThis.crypto?.randomUUID;
let randomCalls = 0;
Math.random = () => { randomCalls++; throw new Error('Catalog must not use RNG'); };
if (originalUUID) globalThis.crypto.randomUUID = () => { throw new Error('Catalog must not create UIDs'); };
const before = JSON.stringify({ CLASSES, GEAR_RULES, HIGH_EQUIPMENT, NAMED_EQUIPMENT });
try {
  const { EQUIPMENT_CATALOG, CATALOG_TYPES, CATALOG_MAX_LEVEL, catalogSpec, catalogRecipes, queryEquipmentCatalog, compareCatalogEntries } = await import('../src/data/gear-catalog.js');
  const total = Object.keys(NAMED_EQUIPMENT).length + Object.keys(HIGH_EQUIPMENT).length;
  assert.equal(EQUIPMENT_CATALOG.length, total);
  assert.ok(total < 1000, 'Finite named records must replace level-quality-star combinations');
  assert.equal(new Set(EQUIPMENT_CATALOG.map(entry => entry.id)).size, total);
  assert.deepEqual(new Set(EQUIPMENT_CATALOG.map(entry => entry.templateId)), new Set([...Object.keys(NAMED_EQUIPMENT), ...Object.keys(HIGH_EQUIPMENT)]));
  const snapshot = JSON.stringify(EQUIPMENT_CATALOG);
  const noUID = value => {
    if (value && typeof value === 'object') {
      assert.ok(!Object.hasOwn(value, 'uid'));
      for (const child of Object.values(value)) noUID(child);
    }
  };
  for (const entry of EQUIPMENT_CATALOG) {
    assert.ok(Object.isFrozen(entry));
    assert.ok(Object.hasOwn(CATALOG_TYPES, entry.type));
    assert.equal(typeof entry.templateId, 'string');
    const spec = catalogSpec(entry.id);
    assert.deepEqual(spec, catalogSpec(entry));
    noUID(entry); noUID(spec);
    const expected = Object.hasOwn(NAMED_EQUIPMENT, entry.templateId) ? namedSpec(entry.templateId) : structuredClone(HIGH_EQUIPMENT[entry.templateId]);
    assert.deepEqual(spec, expected);
    assert.equal(entry.name, spec.name);
    assert.equal(entry.lv, spec.lv);
    assert.equal(entry.grade, spec.grade);
    spec.base.testMutation = 123;
    assert.deepEqual(catalogSpec(entry), expected);
    for (const recipe of catalogRecipes(entry)) assert.equal(recipe.templateId, entry.templateId);
  }
  const collect = (filters = {}) => {
    const first = queryEquipmentCatalog(filters);
    assert.equal(first.error, '');
    const rows = [];
    for (let page = 1; page <= first.pageCount; page++) {
      const result = queryEquipmentCatalog({ ...filters, page });
      assert.equal(result.total, first.total);
      assert.equal(result.page, page);
      assert.equal(result.pageSize, 60);
      assert.ok(result.entries.length <= 60);
      rows.push(...result.entries);
    }
    assert.equal(rows.length, first.total);
    assert.equal(new Set(rows.map(entry => entry.id)).size, rows.length);
    return rows;
  };
  const number = value => value ?? Infinity;
  for (const sort of ['level-grade', 'grade-level']) {
    const rows = collect({ sort });
    assert.equal(rows.length, total);
    assert.deepEqual(rows, [...EQUIPMENT_CATALOG].sort((a, b) => compareCatalogEntries(a, b, sort)));
    const keys = sort === 'level-grade' ? ['lv', 'grade'] : ['grade', 'lv'];
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i];
      assert.ok(number(a[keys[0]]) < number(b[keys[0]]) || number(a[keys[0]]) === number(b[keys[0]]) && number(a[keys[1]]) <= number(b[keys[1]]));
    }
    assert.deepEqual(queryEquipmentCatalog({ sort }), queryEquipmentCatalog({ sort }));
  }
  const pages = Math.ceil(total / 60);
  assert.equal(queryEquipmentCatalog().pageCount, pages);
  assert.equal(queryEquipmentCatalog({ page: 9999 }).page, pages);
  assert.equal(queryEquipmentCatalog({ minLv: '', maxLv: '' }).total, total);
  for (const filters of [{ minLv: 0 }, { maxLv: CATALOG_MAX_LEVEL + 1 }, { minLv: 1.5 }, { minLv: 'invalid' }, { minLv: 80, maxLv: 10 }, { page: '' }, { page: 0 }, { page: 1.5 }, { cls: 'unknown' }, { q: 5 }, { grade: 20 }]) {
    const result = queryEquipmentCatalog(filters);
    assert.ok(result.error, JSON.stringify(filters));
    assert.equal(result.total, 0);
    assert.deepEqual(result.entries, []);
  }
  assert.deepEqual(collect({ slot: 'ring2' }), collect({ slot: 'ring1' }));
  for (const cls of Object.keys(CLASSES)) {
    const rows = collect({ cls, minLv: 1, maxLv: 105 });
    assert.deepEqual(rows, EQUIPMENT_CATALOG.filter(entry => entry.classes.includes(cls) && entry.lv >= 1 && entry.lv <= 105).sort((a, b) => compareCatalogEntries(a, b, 'level-grade')));
    for (const recipe of getProductionRecipes(cls)) {
      const entry = EQUIPMENT_CATALOG.find(candidate => candidate.templateId === recipe.templateId);
      assert.ok(entry, recipe.id);
      assert.ok(catalogRecipes(entry, cls).some(candidate => candidate.id === recipe.id), recipe.id);
    }
  }
  for (const grade of Array.from({ length: 19 }, (_, i) => i + 1)) assert.equal(queryEquipmentCatalog({ grade }).total, EQUIPMENT_CATALOG.filter(entry => entry.grade === grade).length);
  for (const type of Object.keys(CATALOG_TYPES)) assert.equal(queryEquipmentCatalog({ type }).total, EQUIPMENT_CATALOG.filter(entry => entry.type === type).length);
  for (const slot of GEAR_RULES.slots.filter(slot => slot !== 'ring2')) assert.equal(queryEquipmentCatalog({ slot }).total, EQUIPMENT_CATALOG.filter(entry => entry.slot === slot).length);
  const detached = queryEquipmentCatalog(); detached.entries.reverse();
  assert.deepEqual(queryEquipmentCatalog().entries, [...EQUIPMENT_CATALOG].sort((a, b) => compareCatalogEntries(a, b, 'level-grade')).slice(0, 60));
  assert.equal(JSON.stringify(EQUIPMENT_CATALOG), snapshot);
  assert.equal(JSON.stringify({ CLASSES, GEAR_RULES, HIGH_EQUIPMENT, NAMED_EQUIPMENT }), before);
  assert.equal(randomCalls, 0);
  console.log(`Catalog regression passed: ${total} finite named entries, ${pages} pages; exact template identity, filters, numeric ordering, recipes and RNG/UID/mutation boundaries.`);
} finally {
  Math.random = originalRandom;
  if (originalUUID) globalThis.crypto.randomUUID = originalUUID;
}
