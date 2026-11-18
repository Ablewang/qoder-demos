import assert from 'node:assert/strict';
import { appendFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { CLASSES } from '../src/data/classes.js';
import { ITEMS, SLOTS, QUALITY, STAT_NAMES, EQUIPMENT_SETS } from '../src/data/items.js';
import { GEAR_RULES } from '../src/data/gear-specs.js';
import { HIGH_EQUIPMENT, HIGH_RECIPES } from '../src/data/high-equipment.js';
import { PRODUCTION_SKILLS } from '../src/data/production.js';
import { EQUIPMENT_CATALOG, CATALOG_TYPES, catalogSpec, catalogRecipes, queryEquipmentCatalog } from '../src/data/gear-catalog.js';

const base = process.env.GAME_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:517[67]$/, 'Explicit isolated GAME_URL required; never use the player origin');
const tag = new URL(base).port === '5176' ? 'production' : 'development';
const run = process.env.CATALOG_RUN || `${Date.now()}-${process.pid}`;
assert.match(run, /^[a-zA-Z0-9-]+$/);
const prefix = new URL(`../artifacts/catalog-${tag}-${run}`, import.meta.url).pathname;
const logPath = `${prefix}.log`;
const log = message => { console.log(message); appendFileSync(logPath, `${message}\n`); };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const n = value => Math.round(value || 0).toLocaleString('zh-CN');
const percentKeys = new Set(['crit', 'dodge', 'accuracy', 'critDamage', 'penetrationP', 'penetrationM', 'channel', 'metalRes', 'woodRes', 'waterRes', 'fireRes', 'earthRes', 'hpPct']);
const stat = (key, value, bonus = false) => key === 'speed' ? `${Number(value.toFixed(3))}×${bonus ? ' 基础攻速增量' : ''}` : percentKeys.has(key) ? `${Number((value * 100).toFixed(2))}%` : n(value);
const rawStat = (key, value) => `${STAT_NAMES[key] || key} +${percentKeys.has(key) || key === 'speed' ? stat(key, value, true) : Number(value.toFixed(3)).toLocaleString('zh-CN')}`;
const fields = { cls: 'catalog-class', minLv: 'catalog-min-level', maxLv: 'catalog-max-level', slot: 'catalog-slot', type: 'catalog-type', q: 'catalog-quality', stars: 'catalog-stars', grade: 'catalog-grade', series: 'catalog-series', sort: 'catalog-sort' };
const defaults = { cls: 'all', minLv: '', maxLv: '', slot: 'all', type: 'all', q: 'all', stars: 'all', grade: 'all', series: 'all', sort: 'level-grade', page: 1 };
let filters = { ...defaults, cls: 'blademaster' }, baseline, checks = 0;
const failures = [], errors = [];
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const idle = () => page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
const button = (action, attrs = '') => page.locator(`[data-action="${action}"]${attrs}`).filter({ visible: true }).first();
async function click(action, attrs = '') { await button(action, attrs).click(); await idle(); }
const nav = id => click('page', `[data-id="${id}"]`);
const close = () => click('closeModal');
const dbContents = () => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('pwi-text-backend');
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result, names = [...db.objectStoreNames], tx = db.transaction(names, 'readonly'), result = {};
    for (const name of names) {
      const store = tx.objectStore(name), keys = store.getAllKeys(), values = store.getAll();
      keys.onsuccess = () => { result[name] = { keys: keys.result }; };
      values.onsuccess = () => { result[name].values = values.result; };
    }
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  };
}));
async function unchanged(label) {
  assert.deepEqual(await dbContents(), baseline, `${label}: full saves/requests/meta contents changed (including revision/timestamps/history)`);
  assert.deepEqual(await page.evaluate(() => window.__catalogPurity), { writes: 0, random: 0, uuid: 0 }, `${label}: browsing attempted a write/RNG/UID`);
}
async function shot(name) {
  await page.evaluate(async () => { await document.fonts.ready; });
  const path = `${prefix}-${name}.png`;
  await page.screenshot({ path, fullPage: !await page.locator('#modal:not(.hidden)').count(), animations: 'disabled' });
  log(`SCREENSHOT ${path}`);
}
async function stage(name, work) {
  log(`BEGIN ${name}`);
  try { await work(); await unchanged(name); log(`PASS ${name}`); }
  catch (error) {
    failures.push({ name, message: error.message }); log(`FAIL ${name}: ${error.stack}`);
    const evidence = await page.evaluate(() => ({ url: location.href, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, focus: document.activeElement?.outerHTML, count: document.querySelector('#catalog-count')?.textContent, alert: document.querySelector('.catalog-filter-error')?.textContent, modal: document.querySelector('#modal')?.innerText, overflow: [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1); }).slice(0, 20).map(el => ({ tag: el.tagName, id: el.id, class: el.className, text: el.textContent.slice(0, 150), rect: el.getBoundingClientRect().toJSON() })) }));
    writeFileSync(`${prefix}-failure-${failures.length}.json`, JSON.stringify(evidence, null, 2));
    await shot(`failure-${failures.length}`);
    if (await page.locator('#modal:not(.hidden)').count()) await close();
  }
}
async function set(key, value) {
  if (['type', 'q', 'stars', 'grade', 'series', 'sort'].includes(key) && !await page.locator('.gear-catalog-advanced').evaluate(node => node.open))
    await page.locator('.gear-catalog-advanced > summary').click();
  const locator = page.locator(`#${fields[key]}`);
  if (key === 'minLv' || key === 'maxLv') {
    await locator.fill(String(value));
    // Commit before pointerdown so blur cannot replace the clicked row.
    await locator.press('Tab'); await locator.dispatchEvent('change');
  }
  else await locator.selectOption(String(value));
  filters[key] = value; filters.page = 1; await idle();
}
async function reset(overrides = {}) {
  if (!await page.locator('#catalog-results').count()) { await nav('bag'); await click('bagTab', '[data-id="arsenal"]'); }
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) if (key !== 'page') await set(key, value);
  filters.page = 1;
}
async function checkResults(label) {
  const expected = queryEquipmentCatalog(filters);
  const ui = await page.locator('#catalog-results').evaluate(el => ({
    count: el.querySelector('#catalog-count').textContent,
    rows: [...el.querySelectorAll('.gear-catalog-row')].map(row => ({ id: row.dataset.id, action: row.dataset.action, name: row.querySelector('.equipment-name').textContent, quality: row.querySelector('.equipment-name').className, meta: [...row.querySelectorAll('.gear-catalog-meta > span')].map(span => span.textContent) })),
    error: el.querySelector('.catalog-filter-error')?.textContent || '',
    pagination: el.querySelector('.gear-catalog-pagination > span').textContent,
  }));
  const first = expected.total ? (expected.page - 1) * 60 + 1 : 0;
  assert.equal(ui.count, `筛选 ${n(expected.total)} / 全目录 17,766 条 · 本页 ${first}—${expected.total ? Math.min(expected.page * 60, expected.total) : 0} 条 · 每页60条`, label);
  assert.deepEqual(ui.rows.map(row => row.id), expected.entries.map(entry => entry.id), `${label}: exact full descriptor IDs and ordering`);
  expected.entries.forEach((entry, i) => {
    assert.equal(ui.rows[i].action, 'catalogEquipmentDetail'); assert.equal(ui.rows[i].name, entry.name);
    assert.ok(ui.rows[i].quality.split(' ').includes(`quality-${entry.q}`));
    assert.deepEqual(ui.rows[i].meta, [`Lv.${entry.lv}`, `${entry.grade}品`, `${QUALITY[entry.q].name} · q${entry.q}`, `${entry.stars === null ? '星级未核' : `${entry.stars}星`}${entry.stage ? ` · ${entry.stage}阶` : ''}`]);
  });
  assert.equal(ui.error, expected.error ? `${expected.error}（未显示旧结果）` : '');
  assert.equal(ui.pagination, `第 ${expected.pageCount ? expected.page : 0} / ${expected.pageCount} 页`);
  assert.ok(await page.evaluate(() => window.__catalogNodes.every(node => node.isConnected && node === document.getElementById(node.id))), `${label}: filter DOM replaced instead of results-only update`);
  if (!expected.error) filters.page = expected.page;
  checks++; return expected;
}
async function pageButton(name, target) {
  await page.getByRole('navigation', { name: '装备目录分页' }).getByRole('button', { name, exact: true }).click();
  filters.page = target; await idle(); return checkResults(name);
}
async function jump(value) {
  await page.locator('#catalog-page-jump').fill(String(value)); await click('catalogEquipmentJump');
  filters.page = Number(value); const result = await checkResults(`jump ${value}`);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'catalog-page-jump'); return result;
}
async function detail(id) {
  const entry = EQUIPMENT_CATALOG.find(entry => entry.id === id); assert.ok(entry, id);
  await reset({ minLv: String(entry.lv), maxLv: String(entry.lv), slot: entry.slot, type: entry.type, q: String(entry.q), stars: entry.stars === null ? 'all' : String(entry.stars), series: entry.series });
  await checkResults(`find ${id}`);
  const row = page.locator(`.gear-catalog-row[data-id="${id}"]`); assert.equal(await row.count(), 1, 'Detail must open by an actual visible descriptor row');
  await row.click(); await idle();
  assert.equal(await page.getByRole('dialog').getAttribute('aria-modal'), 'true');
  assert.match(await page.locator('#modal').innerText(), /职业常用制式：.*实际可穿职业：/);
  assert.equal(await page.locator('#modal [data-action="equip"], #modal [data-action="produceConfirm"], #modal [data-op="reroll"], #modal [data-op="upgrade"]').count(), 0);
  await unchanged(id); return catalogSpec(id);
}
async function ordinaryDetails(id) {
  const spec = await detail(id);
  assert.equal(await page.locator('#dialog-title').innerText(), '装备纯规格 · 目录详情');
  assert.deepEqual(await page.locator('#modal .spec-dimensions strong').allTextContents(), [`Lv.${spec.lv}`, `${spec.grade}品`, `${spec.stars}星`, QUALITY[spec.q].name, GEAR_RULES.seriesRules[spec.series].name]);
  const sections = page.locator('#modal .raw-stat-grid section');
  assert.deepEqual(await sections.nth(0).locator('.item-stats > span').allTextContents(), Object.entries(spec.base).map(([key, value]) => rawStat(key, value)));
  assert.deepEqual(await sections.nth(1).locator('p:not(.muted)').allTextContents(), [`人物 ${spec.wear.lv}级`, ...Object.entries(spec.wear).filter(([key]) => key !== 'lv').map(([key, value]) => `${STAT_NAMES[key] || key} ${n(value)}`)]);
  assert.deepEqual(await page.locator('#modal .spec-ranges p').allTextContents(), Object.entries(spec.ranges).map(([key, range]) => `${STAT_NAMES[key]}${n(range[0])} — ${n(range[1])}`));
  assert.ok(await page.locator('#modal .spec-affixes').evaluate(el => el.open), 'Random pool must be expanded immediately');
  if (!spec.addonCount) {
    assert.equal(await page.locator('#modal .affix-budget').count(), 0);
    assert.match(await page.locator('#modal .spec-affixes').innerText(), /q0无随机附加属性；不抽取词条/);
  } else {
    assert.equal(await page.locator('#modal .spec-affixes summary').innerText(), `可能随机附加属性 · 从${spec.addonPool.length}种中去重抽取${spec.addonCount}条 · 每项下限—上限（并非全部获得）`);
    assert.deepEqual(await page.locator('#modal .affix-budget > div').allTextContents(), spec.addonPool.map(key => `${STAT_NAMES[key]}${stat(key, spec.addonBudget[key].min)} — ${stat(key, spec.addonBudget[key].max)}`));
    for (const forbidden of ['气魄', '创世等级', '猎魔等级']) assert.ok(!await page.locator('#modal .affix-budget').innerText().then(text => text.includes(forbidden)));
  }
  return spec;
}
async function layout(label) {
  const geometry = await page.evaluate(() => {
    const modal = document.querySelector('#modal:not(.hidden) .modal-card'), body = modal?.querySelector('.modal-body');
    return { width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollWidth, box: modal?.getBoundingClientRect().toJSON(), bodyWidth: body?.clientWidth, bodyScroll: body?.scrollWidth };
  });
  assert.ok(geometry.scroll <= geometry.width + 1, `${label}: document overflow ${JSON.stringify(geometry)}`);
  if (geometry.box) {
    assert.ok(geometry.box.x >= -1 && geometry.box.right <= geometry.width + 1, `${label}: modal horizontal bounds ${JSON.stringify(geometry)}`);
    assert.ok(geometry.box.y >= -1 && geometry.box.bottom <= geometry.height + 1, `${label}: modal vertical bounds ${JSON.stringify(geometry)}`);
    assert.ok(geometry.bodyScroll <= geometry.bodyWidth + 1, `${label}: modal content horizontal overflow ${JSON.stringify(geometry)}`);
    const scrolling = await page.locator('#modal .modal-body').evaluate(el => {
      el.scrollTop = el.scrollHeight;
      const result = { top: el.scrollTop, max: el.scrollHeight - el.clientHeight };
      el.scrollTop = 0; return result;
    });
    assert.ok(Math.abs(scrolling.top - scrolling.max) <= 1, `${label}: all detail content must be vertically reachable`);
    assert.ok(await button('closeModal').count());
  }
}

try {
  log(`RUN ${base}; isolated NEW context; HMR blocked; artifacts ${prefix}`);
  assert.equal(EQUIPMENT_CATALOG.length, 17766);
  assert.deepEqual(['ordinary', 'special', 'high'].map(kind => EQUIPMENT_CATALOG.filter(entry => kind === 'special' ? !['ordinary', 'high'].includes(entry.series) : entry.series === kind).length), [17640, 121, 5]);
  await page.goto(base); await page.locator('#char-name').fill('目录只读回归');
  await page.getByRole('button', { name: '进入完美大陆' }).click(); await idle();
  baseline = await dbContents(); assert.equal(baseline.saves.values[0].snapshot.player.cls, 'blademaster');
  assert.equal(baseline.saves.values[0].snapshot.player.lv, 1);
  const instrumentPurity = () => {
    window.__catalogPurity = { writes: 0, random: 0, uuid: 0 };
    const transaction = IDBDatabase.prototype.transaction, random = Math.random, uuid = crypto.randomUUID.bind(crypto);
    IDBDatabase.prototype.transaction = function (...args) { if (args[1] === 'readwrite') window.__catalogPurity.writes++; return transaction.apply(this, args); };
    Math.random = function () { window.__catalogPurity.random++; return random(); };
    crypto.randomUUID = function () { window.__catalogPurity.uuid++; return uuid(); };
  };
  await page.evaluate(instrumentPurity);
  await context.addInitScript(instrumentPurity);
  log(`BASELINE saves/requests/meta SHA256 ${hash(baseline)}; revision ${baseline.saves.values[0].revision}`);
  await nav('bag'); await click('bagTab', '[data-id="arsenal"]');
  await page.evaluate(ids => { window.__catalogNodes = ids.map(id => document.getElementById(id)); }, Object.values(fields));

  await stage('closed primary filters expose first equipment above mobile navigation', async () => {
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await click('bagTab', '[data-id="arsenal"]');
      await page.evaluate(async () => { await document.fonts.ready; });
      const geometry = await page.evaluate(() => ({ row: document.querySelector('.gear-catalog-row').getBoundingClientRect().toJSON(), nav: document.querySelector('.mobile-nav').getBoundingClientRect().toJSON() }));
      assert.ok(geometry.row.y >= 0 && geometry.row.bottom <= geometry.nav.y, `First row hidden at ${width}px: ${JSON.stringify(geometry)}`);
      await layout(`first viewport ${width}`);
      await page.screenshot({ path: `${prefix}-first-viewport-${width}.png`, animations: 'disabled' });
      log(`FIRST VIEWPORT ${width}: row bottom ${geometry.row.bottom}, nav top ${geometry.nav.y}`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await click('bagTab', '[data-id="arsenal"]');
    await page.evaluate(ids => { window.__catalogNodes = ids.map(id => document.getElementById(id)); }, Object.values(fields));
  });

  await stage('default/current profile; exact controls; folded cultivation/source/legacy', async () => {
    assert.equal(await page.locator('#catalog-class').inputValue(), 'blademaster');
    await checkResults('default blademaster');
    const options = { cls: Object.keys(CLASSES), slot: Object.keys(SLOTS).filter(id => id !== 'ring2'), type: Object.keys(CATALOG_TYPES), q: QUALITY.map((_, q) => String(q)), stars: ['1', '2', '3'], grade: Array.from({ length: 19 }, (_, i) => String(i + 1)), series: [...GEAR_RULES.series, 'high'] };
    for (const [key, values] of Object.entries(options)) {
      assert.deepEqual(await page.locator(`#${fields[key]} option`).evaluateAll(nodes => nodes.map(node => node.value)), ['all', ...values]);
      assert.equal(await page.locator(`label[for="${fields[key]}"]`).count(), 1);
    }
    assert.match(await page.locator('#catalog-filter-note').innerText(), /常用制式.*实际穿戴/);
    assert.ok(!await page.locator('.gear-catalog-advanced').evaluate(node => node.open), 'Secondary filters start folded');
    for (const id of ['catalog-class', 'catalog-slot', 'catalog-min-level', 'catalog-max-level']) assert.ok(await page.locator(`#${id}`).isVisible());
    const folds = page.locator('.equipment-catalog > .rules-boundary'); assert.equal(await folds.count(), 3);
    assert.ok(await folds.evaluateAll(nodes => nodes.every(node => !node.open)));
    assert.equal(await page.locator('.cultivation-reference article').count(), 3);
    for (let i = 0; i < 3; i++) { await folds.nth(i).locator('summary').click(); assert.ok(await folds.nth(i).evaluate(el => el.open)); await folds.nth(i).locator('summary').click(); }
    for (const set of Object.values(EQUIPMENT_SETS)) assert.ok(await folds.nth(2).textContent().then(text => text.includes(set.name)));
    await set('cls', 'all'); const all = await checkResults('all'); assert.equal(all.total, 17766); assert.equal(all.pageCount, 297); assert.equal(all.entries.length, 60);
    await shot('all-first-1440');
  });

  await stage('every class/slot/type/grade/quality/star/series independently; combinations', async () => {
    for (const [key, values] of Object.entries({ cls: Object.keys(CLASSES), slot: Object.keys(SLOTS).filter(id => id !== 'ring2'), type: Object.keys(CATALOG_TYPES), grade: Array.from({ length: 19 }, (_, i) => i + 1), q: [0, 1, 2, 3, 4], stars: [1, 2, 3], series: [...GEAR_RULES.series, 'high'] })) {
      await reset();
      for (const value of values) {
        await set(key, value); const result = await checkResults(`${key}=${value}`);
        const raw = EQUIPMENT_CATALOG.filter(entry => key === 'cls' ? entry.classes.includes(value) : entry[key] === value);
        assert.equal(result.total, raw.length, `${key}: independent full count`);
        log(`FILTER ${key}=${value}: ${result.total}`);
      }
    }
    await reset({ cls: 'wizard', slot: 'head', type: 'heavy' }); assert.equal((await checkResults('usual profile is not wearability')).total, 0);
    await set('cls', 'all'); assert.equal((await checkResults('all heavy heads')).total, 630);
    await reset({ series: 'ordinary', slot: 'weapon', type: 'blade', minLv: '1', maxLv: '1', q: '1', stars: '1', grade: '1' });
    assert.equal((await checkResults('q1 one star')).total, 1);
    await set('stars', '2'); assert.equal((await checkResults('q1 two stars')).total, 1);
    await set('q', '0'); assert.equal((await checkResults('q0 two stars')).total, 1);
    await set('stars', '3'); assert.equal((await checkResults('independent contradictory filters')).total, 0);
    assert.equal(await button('catalogEquipmentJump').isDisabled(), true);
    await reset({ cls: 'psychic', minLv: '55', maxLv: '100', q: '3', stars: '3', sort: 'grade-level' }); await checkResults('combined profile bounds/quality/stars/sort');
  });

  await stage('level endpoints/blank bounds; invalid integers/range/bad numeric input', async () => {
    for (const [minLv, maxLv] of [['1', '105'], ['1', '1'], ['105', '105'], ['', '10'], ['99', ''], ['10', '99'], ['', '']]) {
      await reset({ minLv, maxLv }); const result = await checkResults(`bounds ${minLv}..${maxLv}`); assert.ok(result.total > 0);
    }
    for (const key of ['minLv', 'maxLv']) for (const value of ['-1', '0', '106', '1.5']) {
      await reset(); await set(key, value); assert.ok((await checkResults(`${key} invalid ${value}`)).error);
      assert.equal(await page.locator(`#${fields[key]}`).getAttribute('aria-invalid'), 'true');
      assert.equal(await page.locator('.gear-catalog-row').count(), 0, 'Invalid bounds must remove stale results');
    }
    await reset({ minLv: '80', maxLv: '10' }); assert.match((await checkResults('reversed bounds')).error, /最低等级不能高于/);
    await reset(); const input = page.locator('#catalog-min-level'); await input.focus(); await input.press('e');
    assert.ok(await input.evaluate(el => el.validity.badInput), 'Chrome must exercise actual badInput, not sanitized blank');
    await input.dispatchEvent('change'); filters.minLv = 'invalid'; assert.ok((await checkResults('numeric badInput')).error);
    await shot('invalid-level');
    await set('minLv', ''); assert.equal((await checkResults('blank recovery')).total, 17766);
    assert.equal(await input.getAttribute('aria-invalid'), 'false');
  });

  await stage('numeric ordering/full 297-page browser traversal for both sorts', async () => {
    const idOrder = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    for (const sort of ['level-grade', 'grade-level']) {
      await reset({ sort }); const seen = [];
      const ordered = [...EQUIPMENT_CATALOG].sort((a, b) => (sort === 'level-grade' ? a.lv - b.lv || a.grade - b.grade : a.grade - b.grade || a.lv - b.lv) || a.q - b.q || (a.stars ?? 0) - (b.stars ?? 0) || idOrder(a, b));
      for (let p = 1; p <= 297; p++) {
        const result = p === 1 ? await checkResults(sort) : await pageButton('下一页', p);
        seen.push(...await page.locator('.gear-catalog-row').evaluateAll(nodes => nodes.map(node => node.dataset.id)));
        assert.equal(result.entries.length, p === 297 ? 6 : 60); await unchanged(`${sort} page ${p}`);
        if (p % 50 === 0 || p === 297) log(`PAGES ${sort}: ${p}/297; ${seen.length} actual DOM IDs`);
      }
      assert.deepEqual(seen, ordered.map(entry => entry.id), 'Every entry exactly once; no lexical grade/level sort');
      assert.equal(new Set(seen).size, 17766);
      assert.ok(await page.getByRole('navigation', { name: '装备目录分页' }).getByRole('button', { name: '末页', exact: true }).isDisabled());
      await pageButton('首页', 1);
    }
  });

  await stage('first/last/previous/jump clamp and invalid/recovery/filter reset/focus', async () => {
    await reset(); await pageButton('末页', 297); await pageButton('上一页', 296); await pageButton('首页', 1);
    await jump(150); assert.equal((await jump(9999)).page, 297); await shot('last-page');
    for (const value of ['', '0', '-1', '1.5']) { assert.ok((await jump(value)).error); assert.equal(await page.locator('.gear-catalog-row').count(), 0); }
    await pageButton('首页', 1);
    await jump(297);
    await page.locator('#catalog-quality').focus(); await set('q', '2'); await checkResults('filter reset from page 297');
    assert.equal(filters.page, 1); assert.equal(await page.evaluate(() => document.activeElement.id), 'catalog-quality');
    await reset(); await jump(2);
    const input = page.locator('#catalog-min-level'); await input.focus(); await input.fill('105'); await input.press('Tab');
    filters.minLv = '105'; filters.page = 1; await checkResults('real input + keyboard change commit');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'catalog-max-level');
  });

  await stage('clickable exact base/wear/ranges and expanded random budgets; q0; shared rings', async () => {
    for (const id of ['ordinary:weapon:blade:1:1:2', 'ordinary:weapon:wand:59:2:3', 'ordinary:weapon:soulsphere:60:3:3', 'ordinary:body:heavy:105:3:3', 'ordinary:ring1:magicRing:35:1:1', 'ordinary:weapon:blade:1:0:2']) {
      await ordinaryDetails(id);
      if (id.includes(':ring1:')) assert.match(await page.locator('#modal').innerText(), /主戒 \/ 副戒穿戴同一种戒指，不重复登记/);
      await shot(`detail-${id.replaceAll(':', '-')}`); await close();
    }
  });

  await stage('actual current recipe vs other-class read-only vs unsupported pure sources', async () => {
    for (const id of ['ordinary:weapon:blade:1:1:1', 'ordinary:weapon:blade:1:1:2', 'ordinary:weapon:blade:1:2:3', 'twilight:weapon:blade:60:3:3', 'lunar:body:heavy:95:3:3', 'nirvana1:weapon:blade:100:3:3', 'nirvana2:weapon:blade:100:3:3']) {
      await ordinaryDetails(id); const recipe = catalogRecipes(id, 'blademaster')[0]; assert.ok(recipe, id);
      const acquisition = page.locator('#modal .catalog-recipe'); const text = await acquisition.innerText();
      assert.ok(text.includes(`配方ID：${recipe.id}`)); assert.ok(text.includes(`人物${recipe.playerLv}级 · ${PRODUCTION_SKILLS[recipe.skill].name}${recipe.skillLevel}级 · ${n(recipe.gold)}金币`));
      assert.deepEqual(await acquisition.locator('li').allTextContents(), Object.entries(recipe.materials).map(([id, quantity]) => `${ITEMS[id].name} ×${n(quantity)}`));
      assert.equal(await acquisition.locator('[data-action="productionGo"]').getAttribute('data-id'), recipe.id);
      if (recipe.from) assert.match(text, /必须消耗同类型行囊前件.*继承.*另付费/);
      await click('productionGo', `[data-id="${recipe.id}"]`);
      assert.equal(await page.locator('#production-recipe').inputValue(), recipe.id);
      assert.equal(await page.locator('#production-series').inputValue(), recipe.series);
      await unchanged(`productionGo ${recipe.id}`);
      await nav('bag'); await click('bagTab', '[data-id="arsenal"]');
      await page.evaluate(ids => { window.__catalogNodes = ids.map(id => document.getElementById(id)); }, Object.values(fields));
    }
    await ordinaryDetails('ordinary:weapon:axe:1:1:2');
    assert.equal(catalogRecipes('ordinary:weapon:axe:1:1:2', 'blademaster').length, 0);
    assert.match(await page.locator('#modal .catalog-recipe').innerText(), /其他职业配方 · 只读成本/);
    assert.equal(await page.locator('#modal [data-action="productionGo"]').count(), 0); await shot('other-class-readonly'); await close();
    for (const id of ['ordinary:weapon:blade:1:0:1', 'ordinary:weapon:blade:2:1:2', 'ordinary:weapon:blade:1:3:3', 'twilight:body:heavy:60:3:3', 'frost:weapon:blade:85:2:3', 'frost:body:robe:85:2:3']) {
      await ordinaryDetails(id); assert.deepEqual(catalogRecipes(id), []);
      assert.match(await page.locator('#modal').innerText(), /规则规格 · 无对应制造配方/);
      assert.equal(await page.locator('#modal [data-action="productionGo"]').count(), 0); await close();
    }
    for (const [lv, type] of [[55, 'blade'], [65, 'wand']]) {
      await ordinaryDetails(`frost:weapon:${type}:${lv}:2:3`);
      assert.match(await page.locator('#modal .catalog-recipe').innerText(), /副本最终首领波通关奖励.*不是制造配方/);
      assert.equal(await page.locator('#modal [data-action="dungeonDetail"]').getAttribute('data-id'), `d${lv}`);
      assert.equal(await page.locator('#modal [data-action="productionGo"]').count(), 0);
      if (type === 'wand') assert.match(await page.locator('#modal').innerText(), /当前职业通关不会获得此武器制式/);
      await close();
    }
  });

  await stage('all five fixed high templates exact values/effects/source; stars != stage', async () => {
    for (const template of Object.values(HIGH_EQUIPMENT)) {
      await detail(`high:${template.id}`); const root = page.locator('#modal .high-template-details');
      assert.equal(await page.locator('#dialog-title').innerText(), '固定神铸 · 目录详情');
      assert.equal(await page.locator('#modal .spec-affixes').count(), 0);
      assert.deepEqual(await root.locator('.raw-stat-grid section').nth(0).locator('.item-stats span').allTextContents(), Object.entries(template.base).map(([key, value]) => rawStat(key, value)));
      assert.deepEqual(await root.locator('.raw-stat-grid section').nth(1).locator('.item-stats span').allTextContents(), Object.entries(template.addons).map(([key, value]) => rawStat(key, value)));
      const text = await root.innerText();
      for (const [key, range] of Object.entries(template.attackRanges)) assert.ok(text.includes(`${STAT_NAMES[key]} ${n(range[0])}—${n(range[1])}`));
      for (const [key, value] of Object.entries(template.requirements)) assert.ok(text.includes(`${STAT_NAMES[key]} ${n(value)}`));
      assert.deepEqual(await root.locator('.fixed-effects p strong').allTextContents(), template.effects.map(effect => effect.name));
      assert.deepEqual(await root.locator('.fixed-effects p span').allTextContents(), template.effects.map(effect => effect.description));
      assert.deepEqual(await root.locator('a').evaluateAll(nodes => nodes.map(node => node.href)), template.source);
      const recipe = HIGH_RECIPES[template.id], recipeText = await page.locator('#modal .catalog-recipe').innerText();
      assert.ok(recipeText.includes(`${n(recipe.gold)}金币`));
      for (const [id, quantity] of Object.entries(recipe.materials)) assert.ok(recipeText.includes(`${ITEMS[id].name} ×${n(quantity)}`));
      if (recipe.from) assert.ok(recipeText.includes(`消耗行囊前阶：${HIGH_EQUIPMENT[recipe.from].name}`));
      else assert.match(recipeText, /独立根配方，需空余行囊格/);
      assert.match(await page.locator('#modal').innerText(), /固定附加属性，不随机抽取词条/);
      if (template.id === 'sword18b') assert.match(await page.locator('#modal').innerText(), /星级未核；阶段不代替星级/);
      await shot(`high-${template.id}`); await close();
    }
  });

  await stage('keyboard row activation/modal trap/Escape focus restoration', async () => {
    await reset({ minLv: '1', maxLv: '1', type: 'blade', q: '1', stars: '2' }); await checkResults('keyboard row');
    const row = page.locator('.gear-catalog-row').first(); const id = await row.getAttribute('data-id');
    await row.focus(); await row.press('Enter'); await idle();
    assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'closeModal');
    const focusables = page.locator('#modal button:not(:disabled), #modal input:not(:disabled), #modal select:not(:disabled), #modal a, #modal summary, #modal [tabindex="0"]');
    await focusables.first().press('Shift+Tab'); assert.ok(await focusables.last().evaluate(el => el === document.activeElement));
    await focusables.last().press('Tab'); assert.ok(await focusables.first().evaluate(el => el === document.activeElement));
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#modal:not(.hidden)').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.id), id);
    await row.press('Space'); await page.getByRole('dialog').waitFor(); await close(); assert.ok(await row.evaluate(el => el === document.activeElement));
  });

  for (const width of [1440, 768, 390, 320]) await stage(`layout list + expanded random/q0/fixed modal ${width}px`, async () => {
    await page.setViewportSize({ width, height: 1000 }); await reset(); await checkResults(`layout ${width}`); await layout(`list ${width}`); await shot(`list-${width}`);
    for (const [id, name] of [['ordinary:weapon:soulsphere:105:3:3', 'random'], ['ordinary:body:robe:105:0:2', 'q0'], ['high:axe19c', 'high']]) {
      if (name === 'high') await detail(id); else await ordinaryDetails(id);
      await layout(`${name} modal ${width}`); await shot(`modal-${name}-${width}`); await close();
    }
  });

  await stage('browse reload preserves full database and runtime has no errors', async () => {
    await unchanged('before reload'); await page.reload(); await idle(); assert.deepEqual(await dbContents(), baseline);
    assert.deepEqual(errors, [], 'Browser exceptions/console errors');
  });
  log(`RESULT ${failures.length ? 'FAIL' : 'PASS'} ${tag}: ${checks} exact result assertions; 17,640 ordinary + 121 special + 5 high = 17,766; 60/page; 297 pages; ${failures.length} failed stages; full DB SHA256 ${hash(await dbContents())}`);
  assert.deepEqual(failures, [], `See ${logPath}; regression assertions are never silently skipped or weakened`);
} catch (error) {
  log(`FATAL ${error.stack}`); process.exitCode = 1;
} finally {
  await context.close(); await browser.close(); log(`LOG ${logPath}`);
}
