import assert from 'node:assert/strict';
import { CLASSES } from '../src/data/classes.js';
import { GEAR_RULES, gearSpec } from '../src/data/gear-specs.js';
import { HIGH_EQUIPMENT } from '../src/data/high-equipment.js';
import { getProductionRecipes } from '../src/data/production.js';

const originalRandom = Math.random;
const originalUUID = globalThis.crypto?.randomUUID;
let randomCalls = 0;
Math.random = () => { randomCalls++; throw new Error('Catalog must not use RNG'); };
if (originalUUID) globalThis.crypto.randomUUID = () => { throw new Error('Catalog must not create UIDs'); };
const before = JSON.stringify({ CLASSES, GEAR_RULES, HIGH_EQUIPMENT });
try {
  const { EQUIPMENT_CATALOG, CATALOG_TYPES, catalogSpec, catalogRecipes, queryEquipmentCatalog, compareCatalogEntries } = await import('../src/data/gear-catalog.js');
  const ordinary = EQUIPMENT_CATALOG.filter((entry) => entry.series === 'ordinary');
  const special = EQUIPMENT_CATALOG.filter((entry) => entry.series !== 'ordinary' && entry.series !== 'high');
  const high = EQUIPMENT_CATALOG.filter((entry) => entry.series === 'high');
  assert.equal(ordinary.length, 17640);
  assert.equal(special.length, 121);
  assert.equal(high.length, 5);
  assert.equal(EQUIPMENT_CATALOG.length, 17766);
  assert.equal(new Set(EQUIPMENT_CATALOG.map((entry) => entry.id)).size, 17766);
  assert.equal(new Set(ordinary.map((entry) => `${entry.slot}:${entry.type}`)).size, 28);
  assert.deepEqual(new Set(ordinary.filter((entry) => entry.slot === 'weapon').map((entry) => entry.type)), new Set(Object.keys(GEAR_RULES.weapons)));
  assert.deepEqual(new Set(ordinary.map((entry) => entry.slot)), new Set(GEAR_RULES.slots.filter((slot) => slot !== 'ring2')));
  assert.deepEqual([...new Set(ordinary.map((entry) => entry.lv))].sort((a, b) => a - b), Array.from({ length: 105 }, (_, i) => i + 1));
  for (let lv = 1; lv <= 105; lv++) assert.equal(ordinary.filter((entry) => entry.lv === lv).length, 168);
  for (const type of ['heavy', 'light', 'robe']) {
    for (const slot of ['head', 'body', 'legs', 'feet', 'wrist']) assert.equal(ordinary.filter((entry) => entry.type === type && entry.slot === slot).length, 630);
  }
  assert.deepEqual(new Set(ordinary.map((entry) => `${entry.q}:${entry.stars}`)), new Set(['0:1', '0:2', '1:1', '1:2', '2:3', '3:3']));
  for (const [series, rules] of Object.entries(GEAR_RULES.seriesRules)) {
    if (series === 'ordinary') continue;
    assert.equal(special.filter((entry) => entry.series === series).length, Object.keys(rules.grades).length * 11);
    for (const lv of Object.keys(rules.grades).map(Number)) {
      const group = special.filter((entry) => entry.series === series && entry.lv === lv);
      assert.equal(group.filter((entry) => entry.slot === 'weapon').length, 8);
      assert.equal(group.filter((entry) => entry.slot === 'body').length, 3);
      assert.ok(group.every((entry) => entry.q === rules.q && entry.grade === rules.grades[lv] && entry.stars === 3));
    }
  }
  assert.deepEqual(new Set(high.map((entry) => entry.templateId)), new Set(Object.keys(HIGH_EQUIPMENT)));
  assert.equal(high.find((entry) => entry.templateId === 'sword18b').stars, null);
  const snapshot = JSON.stringify(EQUIPMENT_CATALOG);
  const noUID = (value) => {
    if (value && typeof value === 'object') {
      assert.ok(!Object.hasOwn(value, 'uid'));
      for (const child of Object.values(value)) noUID(child);
    }
  };
  for (const entry of EQUIPMENT_CATALOG) {
    assert.ok(Object.isFrozen(entry) && Object.isFrozen(entry.classes) && Object.isFrozen(entry.wearClasses));
    assert.ok(entry.classes.includes(entry.cls));
    assert.ok(Object.hasOwn(CATALOG_TYPES, entry.type));
    const spec = catalogSpec(entry.id);
    const repeated = catalogSpec(entry);
    assert.deepEqual(spec, repeated);
    noUID(entry); noUID(spec);
    if (entry.templateId) {
      assert.deepEqual(spec, HIGH_EQUIPMENT[entry.templateId]);
      spec.base.testMutation = 123;
      assert.ok(!Object.hasOwn(catalogSpec(entry).base, 'testMutation'));
    } else {
      const options = { series: entry.series, stars: entry.stars };
      if (entry.slot === 'weapon') options.weaponType = entry.type;
      if (['head', 'body', 'legs', 'feet', 'wrist'].includes(entry.slot)) options.armorType = entry.type;
      assert.deepEqual(spec, gearSpec(entry.slot, entry.lv, entry.q, entry.cls, options));
      assert.equal(entry.name, spec.name);
      assert.equal(entry.grade, spec.grade);
      assert.equal(spec.addonCount, entry.q);
      assert.equal(Object.hasOwn(spec, 'addons'), false);
      for (const cls of entry.classes) {
        const other = gearSpec(entry.slot, entry.lv, entry.q, cls, options);
        assert.deepEqual({ ...other, cls: null }, { ...spec, cls: null });
      }
      spec.base.testMutation = 123;
      spec.addonPool.push('testMutation');
      assert.deepEqual(catalogSpec(entry), repeated);
    }
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
    assert.equal(new Set(rows.map((entry) => entry.id)).size, rows.length);
    return rows;
  };
  for (const sort of ['level-grade', 'grade-level']) {
    const rows = collect({ sort });
    assert.equal(rows.length, 17766);
    assert.deepEqual(rows, [...EQUIPMENT_CATALOG].sort((a, b) => compareCatalogEntries(a, b, sort)));
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i];
      if (sort === 'level-grade') assert.ok(a.lv < b.lv || a.lv === b.lv && a.grade <= b.grade);
      else assert.ok(a.grade < b.grade || a.grade === b.grade && a.lv <= b.lv);
    }
    assert.deepEqual(queryEquipmentCatalog({ sort }), queryEquipmentCatalog({ sort }));
  }
  assert.equal(queryEquipmentCatalog().pageCount, 297);
  assert.equal(queryEquipmentCatalog({ page: 297 }).entries.length, 6);
  assert.equal(queryEquipmentCatalog({ page: 9999 }).page, 297);
  assert.equal(queryEquipmentCatalog({ minLv: '', maxLv: '' }).total, 17766);
  for (const filters of [{ minLv: 0 }, { maxLv: 106 }, { minLv: 1.5 }, { minLv: 'invalid' }, { minLv: 80, maxLv: 10 }, { page: '' }, { page: 0 }, { page: 1.5 }, { cls: 'unknown' }, { q: 5 }, { grade: 20 }]) {
    const result = queryEquipmentCatalog(filters);
    assert.ok(result.error);
    assert.equal(result.total, 0);
    assert.deepEqual(result.entries, []);
  }
  assert.deepEqual(collect({ slot: 'ring2' }), collect({ slot: 'ring1' }));
  assert.deepEqual(new Set(collect({ slot: 'ring1', series: 'ordinary' }).map((entry) => entry.type)), new Set(['physRing', 'magicRing']));
  for (const cls of Object.keys(CLASSES)) {
    const filters = { cls, minLv: 55, maxLv: 100, q: 3, stars: 3, sort: 'grade-level' };
    const rows = collect(filters);
    assert.deepEqual(rows, EQUIPMENT_CATALOG.filter((entry) => entry.classes.includes(cls) && entry.lv >= 55 && entry.lv <= 100 && entry.q === 3 && entry.stars === 3).sort((a, b) => compareCatalogEntries(a, b, 'grade-level')));
    assert.equal(queryEquipmentCatalog({ cls, series: 'ordinary', slot: 'weapon' }).total, 630);
  }
  assert.equal(queryEquipmentCatalog({ cls: 'wizard', slot: 'head', type: 'heavy' }).total, 0);
  assert.equal(queryEquipmentCatalog({ cls: 'all', slot: 'head', type: 'heavy' }).total, 630);
  assert.equal(queryEquipmentCatalog({ cls: 'wizard', slot: 'ring1', type: 'physRing' }).total, 0);
  for (const grade of Array.from({ length: 19 }, (_, i) => i + 1)) {
    assert.equal(queryEquipmentCatalog({ grade }).total, EQUIPMENT_CATALOG.filter((entry) => entry.grade === grade).length);
  }
  for (const stars of [1, 2]) assert.equal(queryEquipmentCatalog({ series: 'ordinary', q: 1, stars }).total, 2940);
  for (const type of Object.keys(GEAR_RULES.weapons)) assert.equal(queryEquipmentCatalog({ cls: 'all', series: 'ordinary', type }).total, 630);
  const find = (series, slot, type, lv, q, stars = 3) => EQUIPMENT_CATALOG.find((entry) => entry.series === series && entry.slot === slot && entry.type === type && entry.lv === lv && entry.q === q && entry.stars === stars);
  assert.equal(catalogRecipes(find('ordinary', 'weapon', 'blade', 1, 1, 1))[0].id, 'ordinary-1-weapon');
  assert.equal(catalogRecipes(find('ordinary', 'weapon', 'blade', 1, 1, 2))[0].id, 'ordinary-1-weapon');
  assert.deepEqual(catalogRecipes(find('ordinary', 'weapon', 'blade', 1, 0, 1)), []);
  assert.deepEqual(catalogRecipes(find('ordinary', 'weapon', 'blade', 2, 1, 2)), []);
  assert.deepEqual(catalogRecipes(find('ordinary', 'weapon', 'blade', 1, 3)), []);
  assert.deepEqual(catalogRecipes(find('ordinary', 'weapon', 'axe', 1, 1, 2), 'wizard'), []);
  assert.equal(catalogRecipes(find('ordinary', 'weapon', 'axe', 1, 1, 2))[0].weaponType, 'axe');
  assert.deepEqual(catalogRecipes(find('twilight', 'body', 'heavy', 60, 3)), []);
  for (const lv of [55, 65, 85]) assert.deepEqual(catalogRecipes(find('frost', 'weapon', 'blade', lv, 2)), []);
  assert.deepEqual(catalogRecipes(find('frost', 'body', 'robe', 85, 2)), []);
  assert.equal(catalogRecipes(find('lunar', 'body', 'robe', 95, 3))[0].id, 'lunar-95-body');
  for (const cls of Object.keys(CLASSES)) {
    for (const recipe of getProductionRecipes(cls)) {
      for (const q of recipe.qualities) {
        const type = recipe.weaponType || recipe.armorType || (recipe.slot === 'ring1' ? `${CLASSES[cls].atkType}Ring` : recipe.slot);
        const entry = find(recipe.series, recipe.slot, type, recipe.lv, q, GEAR_RULES.qualities[q].stars);
        assert.ok(entry);
        assert.deepEqual(catalogRecipes(entry, cls)[0], recipe);
      }
    }
  }
  const detached = queryEquipmentCatalog();
  detached.entries.reverse();
  assert.deepEqual(queryEquipmentCatalog(), queryEquipmentCatalog());
  assert.equal(JSON.stringify(EQUIPMENT_CATALOG), snapshot);
  assert.equal(JSON.stringify({ CLASSES, GEAR_RULES, HIGH_EQUIPMENT }), before);
  assert.equal(randomCalls, 0);
  console.log('Catalog regression passed: 17,640 ordinary + 121 special + 5 fixed high = 17,766 entries; 297 pages. All profiles, canonical specs, independent filters, numeric sorting, recipes, RNG/UID/mutation checks passed.');
} finally {
  Math.random = originalRandom;
  if (originalUUID) globalThis.crypto.randomUUID = originalUUID;
}
