import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { NAMED_EQUIPMENT, namedSpec, matchesNamedEquip, equipmentForShop } from '../src/data/named-equipment.js';
import { ITEM_COLOR_PALETTE, itemColorEvidence, itemNameColor } from '../src/data/item-colors.js';
import { EQUIPMENT_CATALOG, queryEquipmentCatalog } from '../src/data/gear-catalog.js';
import { HIGH_EQUIPMENT } from '../src/data/high-equipment.js';
import { makeNamedEquip, makeHighEquip } from '../src/data/items.js';
import { PRODUCTION_SKILLS, getProductionRecipes } from '../src/data/production.js';
import { getProductionCatalog } from '../src/core/production.js';
import { Game, validateSave } from '../src/core/game.js';
import { stats } from '../src/core/model.js';
import { API_ROUTES } from '../src/core/api.js';

const base = process.env.GAME_URL || 'http://127.0.0.1:5183';
assert.match(base, /^http:\/\/127\.0\.0\.1:(5183|5176)$/, 'Only isolated local previews on 5183 or 5176 are allowed');
assert.equal(process.env.NAMED_EQUIPMENT_READY, '1', 'Set NAMED_EQUIPMENT_READY=1 only after core/API and the served UI are ready');
assert.deepEqual(API_ROUTES.find(row => row.method === 'POST' && row.path === '/v1/shop/equipment/buy')?.fields, { templateId: 'string' });
assert.equal(EQUIPMENT_CATALOG.length, Object.keys(NAMED_EQUIPMENT).length + Object.keys(HIGH_EQUIPMENT).length);
assert.notEqual(EQUIPMENT_CATALOG.length, 17766);
const artifacts = fileURLToPath(new URL('../artifacts/', import.meta.url));
await access(artifacts);
const run = `${new URL(base).port}-${Date.now()}`;
const viteClientStub = `const hot = { data: {}, accept() {}, acceptExports() {}, dispose() {}, prune() {}, invalidate() {}, decline() {}, on() {}, off() {}, send() {} };
export const createHotContext = () => hot;
export const injectQuery = (url) => url;
export function updateStyle(id, css) {
  let style = document.querySelector('style[data-vite-dev-id="' + CSS.escape(id) + '"]');
  if (!style) { style = document.createElement('style'); style.setAttribute('type', 'text/css'); style.setAttribute('data-vite-dev-id', id); document.head.appendChild(style); }
  style.textContent = css;
}
export function removeStyle(id) { document.querySelector('style[data-vite-dev-id="' + CSS.escape(id) + '"]')?.remove(); }
export class ErrorOverlay extends HTMLElement {}`;
const errors = [], external = [], checks = [], contexts = [], colorVisits = new Map();
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const idle = page => page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false', null, { timeout: 30000 });
const button = (page, action, attrs = '') => page.locator(`[data-action="${action}"]${attrs}`).filter({ visible: true }).first();
const click = async (page, action, attrs = '') => { await button(page, action, attrs).click(); await idle(page); };
const closeModal = async page => { if (await page.locator('#modal:not(.hidden)').count()) await click(page, 'closeModal'); };
const record = page => page.evaluate(async () => {
  const api = globalThis[Symbol.for('pwi-h5.main-session')]?.api;
  if (!api || api.store.db.name !== window.__namedDatabase) throw new Error('Not an isolated LocalBackend test database');
  return api.store.current();
});
const posts = page => page.evaluate(() => window.__namedRequests.filter(row => row.method === 'POST'));
const shot = async (page, label) => {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(artifacts, `named-${run}-${label}.png`), fullPage: false, animations: 'disabled' });
};
async function check(label, work) { await work(); checks.push(label); console.log(`PASS ${label}`); }
async function observe(page) {
  await page.evaluate(() => {
    const api = globalThis[Symbol.for('pwi-h5.main-session')]?.api;
    if (!api || api.store.db.name !== window.__namedDatabase) throw new Error('Backend escaped the isolated test database');
    if (api.__namedObserved) return;
    const request = api.request;
    window.__namedRequests = [];
    api.request = function(method, path, body = {}, options = {}) {
      window.__namedRequests.push({ method, path, body: structuredClone(body) });
      return request.call(this, method, path, body, options);
    };
    api.__namedObserved = true;
  });
}
async function fresh(label) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true, serviceWorkers: 'block' });
  contexts.push(context);
  const databaseName = `pwi-named-ui-${run}-${label}`;
  await context.addInitScript(({ databaseName }) => {
    window.__namedDatabase = databaseName;
    const open = indexedDB.open.bind(indexedDB);
    // Redirect only the backend database in this fresh context, never an existing save.
    indexedDB.open = (name, ...args) => open(name === 'pwi-text-backend' ? databaseName : name, ...args);
  }, { databaseName });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && url.origin !== base) {
      external.push(`${label}: ${url.href}`); await route.abort(); return;
    }
    // Offline stand-in for Vite's dev client: keeps CSS injection, never opens the HMR socket.
    if (url.pathname === '/@vite/client') { await route.fulfill({ contentType: 'application/javascript', body: viteClientStub }); return; }
    await route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(`${label}: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`${label}: ${message.text()}`); });
  page.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== base) external.push(`${label}: ${url.href}`);
  });
  page.on('websocket', socket => external.push(`${label}: unexpected websocket ${socket.url()}`));
  await page.goto(base); await idle(page); await observe(page);
  assert.equal(await record(page), null, 'Every context starts with no character/save');
  return page;
}
async function colors(page, stage) {
  const nodes = await page.locator('[data-item-name]').evaluateAll(nodes => nodes.map(node => ({
    name: node.dataset.itemName, color: node.dataset.itemColor, basis: node.dataset.colorBasis,
    css: getComputedStyle(node).color, classes: node.className, title: node.getAttribute('title'),
    accessible: node.tagName === 'OPTION' ? node.getAttribute('aria-label') : node.querySelector('.sr-only')?.textContent,
  })));
  assert.equal(await page.locator('[class*="quality-"]').count(), 0, `${stage}: no q-driven name/icon/border classes`);
  for (const node of nodes) {
    const token = itemNameColor(node.name), basis = itemColorEvidence(node.name) ? 'verified' : 'unknown';
    const hex = ITEM_COLOR_PALETTE[token].slice(1);
    const rgb = `rgb(${[0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16)).join(', ')})`;
    assert.equal(node.color, token, `${stage}: original name ${node.name}`);
    assert.equal(node.basis, basis, `${stage}: evidence basis ${node.name}`);
    assert.ok(node.classes.split(/\s+/).includes(`item-color-${token}`));
    assert.equal(node.css, rgb, `${stage}: CSS must not override source color ${node.name}`);
    assert.ok(node.title && node.accessible, `${stage}: source/accessibility information ${node.name}`);
    if (token === 'unknown') assert.match(node.title, /不认定为官方白色/);
    const visits = colorVisits.get(node.name) || new Set(); visits.add(stage); colorVisits.set(node.name, visits);
  }
}
async function mobile(page, label) {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const overflow = await page.evaluate(() => {
      const viewport = document.documentElement.scrollWidth > innerWidth + 1;
      const modal = document.querySelector('#modal:not(.hidden) .modal-card');
      const body = document.querySelector('#modal:not(.hidden) .modal-body');
      return { viewport, modal: !!modal && (modal.getBoundingClientRect().right > innerWidth + 1 || modal.getBoundingClientRect().left < -1), body: !!body && body.scrollWidth > body.clientWidth + 1 };
    });
    assert.deepEqual(overflow, { viewport: false, modal: false, body: false }, `${label} at ${width}px`);
    if (label === 'finite-catalog') {
      await page.locator('.equipment-catalog').evaluate(node => node.scrollIntoView({ block: 'start' }));
      const row = await page.locator('.gear-catalog-row').first().boundingBox();
      const nav = await page.locator('.mobile-nav').boundingBox();
      assert.ok(row && row.y >= 0 && row.y + row.height <= (nav?.y ?? 844), `${width}px: a complete equipment row must be visible above navigation`);
    }
    await colors(page, `${label}-${width}`); await shot(page, `${label}-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
async function source(page, template) {
  const section = page.locator('.named-source-details').filter({ visible: true }).first();
  assert.equal(await section.getAttribute('data-source-status'), template.status);
  const raw = await section.locator('.rules-boundary pre').textContent();
  assert.deepEqual(JSON.parse(raw), template.sourceRecord || {}, 'Exact source attacks, requirements, affixes and material quantities retained');
  const text = await section.textContent();
  assert.match(text, /本作运行时属性 · 非原文/);
  assert.match(text, /本作适配字段 \/ 未知边界/);
  if (template.status === 'local-tutorial') assert.match(text, /本作训练.*非官方/s);
  else {
    const url = template.sourceRecord?.source?.url;
    if (url) assert.ok((await section.locator('.source-links a').evaluateAll(nodes => nodes.map(node => node.href))).includes(url));
    if (template.series === 'ordinary' && template.status === 'partial') assert.match(text, /资料未载攻击，本作临时数值/);
  }
  for (const material of template.sourceRecord?.materials || []) {
    assert.ok(text.includes(material.name));
    assert.ok(text.includes(`数量：${material.qty}`), 'Original source material quantity is displayed');
  }
  if (template.grade == null) assert.match(await page.locator('#modal:not(.hidden), .spec-preview').filter({ visible: true }).first().textContent(), /品阶未载/);
  await colors(page, 'source-detail');
}
async function catalog(page) {
  const before = await record(page);
  await closeModal(page); await click(page, 'page', '[data-id="bag"]'); await click(page, 'bagTab', '[data-id="arsenal"]');
  assert.equal(await page.locator('#catalog-quality, #catalog-stars, #catalog-series').count(), 0);
  const historical = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: '历史744条不完整资料参考' }) }).first();
  assert.equal(await historical.getAttribute('open'), null, 'Historical references stay folded, not the main playable list');
  await page.locator('#catalog-class').selectOption('blademaster');
  await page.locator('#catalog-slot').selectOption('weapon');
  await page.locator('#catalog-min-level').fill('30'); await page.locator('#catalog-max-level').fill('95');
  await page.locator('.gear-catalog-advanced > summary').click();
  for (const sort of ['grade-level', 'level-grade']) {
    await page.locator('#catalog-sort').selectOption(sort);
    const expected = queryEquipmentCatalog({ cls: 'blademaster', slot: 'weapon', minLv: 30, maxLv: 95, sort });
    assert.equal(expected.error, '');
    assert.deepEqual(await page.locator('.gear-catalog-row').evaluateAll(nodes => nodes.map(node => node.dataset.id)), expected.entries.map(entry => entry.id), 'Class + level + slot filters and numeric ordering');
  }
  await page.locator('#catalog-min-level').fill('105'); await page.locator('#catalog-max-level').fill('30');
  assert.equal(await page.locator('.gear-catalog-row').count(), 0);
  assert.match(await page.locator('#catalog-results [role="alert"]').textContent(), /最低等级/);
  await page.locator('#catalog-class').selectOption('all'); await page.locator('#catalog-slot').selectOption('all');
  await page.locator('#catalog-min-level').fill('1'); await page.locator('#catalog-max-level').fill('105');
  const reference = EQUIPMENT_CATALOG.find(entry => entry.referenceOnly);
  assert.ok(reference, 'Unsupported equipment must remain discoverable references');
  await page.locator('#catalog-type').selectOption(reference.type);
  const referenceResult = queryEquipmentCatalog({ cls: 'all', slot: 'all', type: reference.type });
  await click(page, 'catalogEquipmentDetail', `[data-id="${referenceResult.entries[0].id}"]`);
  assert.equal(await page.locator('#modal:not(.hidden) .modal-body').count(), 1, await page.locator('#toast').textContent());
  assert.match(await page.locator('#modal .modal-body').textContent(), /仅供资料参考/);
  assert.equal(await page.locator('#modal [data-action="equip"], #modal [data-action="buyEquip"], #modal [data-action="productionGo"], #modal [data-action="highCraft"]').count(), 0);
  await source(page, namedSpec(referenceResult.entries[0].templateId)); await mobile(page, 'reference-only-detail');
  await closeModal(page); await page.locator('#catalog-type').selectOption('all');
  await page.locator('#catalog-max-level').fill('');
  for (const sort of ['grade-level', 'level-grade']) {
    await page.locator('#catalog-sort').selectOption(sort);
    const seen = [];
    const expected = queryEquipmentCatalog({ cls: 'all', sort });
    for (let index = 1; index <= expected.pageCount; index++) {
      const current = queryEquipmentCatalog({ cls: 'all', sort, page: index });
      const ids = await page.locator('.gear-catalog-row').evaluateAll(nodes => nodes.map(node => node.dataset.id));
      assert.deepEqual(ids, current.entries.map(entry => entry.id), `${sort}, page ${index}: exact finite templates`);
      seen.push(...ids);
      if (index < expected.pageCount) await click(page, 'catalogEquipmentPage', `[data-page="${index + 1}"]`);
    }
    assert.equal(new Set(seen).size, EQUIPMENT_CATALOG.length);
    await click(page, 'catalogEquipmentPage', '[data-page="1"]');
  }
  assert.match(await page.locator('#catalog-count').textContent(), new RegExp(`全目录 ${EQUIPMENT_CATALOG.length.toLocaleString('zh-CN')} 条`));
  assert.equal(await page.locator('.catalog-source-boundary').getAttribute('open'), null);
  await page.locator('.gear-catalog-advanced > summary').click();
  await colors(page, 'finite-catalog'); await mobile(page, 'finite-catalog');
  assert.deepEqual(await record(page), before, 'Filtering and browsing details cannot write saves or allocate UIDs');
}
async function purchase(page, preferredId = '') {
  await closeModal(page);
  const before = await record(page), p = before.snapshot.player;
  const listings = equipmentForShop(p);
  const spec = listings.find(entry => entry.templateId === preferredId) || listings.find(entry => entry.price <= p.gold);
  assert.ok(spec, 'Naturally earned/test-initialized balance must cover an actual named shop listing');
  await click(page, 'page', '[data-id="town"]'); await click(page, 'townTab', '[data-id="equipment"]');
  assert.deepEqual(await page.locator('.named-shop-card').evaluateAll(nodes => nodes.map(node => node.dataset.templateId)), listings.map(entry => entry.templateId));
  await colors(page, 'town-shop'); await mobile(page, 'town-shop');
  assert.deepEqual(await record(page), before, 'Shop preview is pure');
  const requestsBefore = (await posts(page)).length;
  await click(page, 'buyEquip', `[data-id="${spec.templateId}"]`);
  const newRequests = (await posts(page)).slice(requestsBefore);
  assert.deepEqual(newRequests, [{ method: 'POST', path: '/v1/shop/equipment/buy', body: { templateId: spec.templateId } }]);
  const after = await record(page), actual = after.snapshot.player.bag.find(item => !p.bag.some(old => old.uid === item.uid));
  assert.equal(after.revision, before.revision + 1);
  assert.equal(after.snapshot.player.gold, p.gold - spec.price);
  assert.equal(after.snapshot.player.bag.length, p.bag.length + 1);
  assert.equal(actual?.templateId, spec.templateId); assert.ok(matchesNamedEquip(actual));
  await click(page, 'page', '[data-id="bag"]'); await click(page, 'bagTab', '[data-id="equipment"]');
  await colors(page, 'bag'); await click(page, 'equipmentDetail', `[data-id="${actual.uid}"]`);
  await source(page, actual);
  assert.match(await page.locator('#modal .modal-body').textContent(), /星级未载/);
  if (actual.grade == null) {
    assert.match(await page.locator('#modal .modal-body').textContent(), /品阶未载，不能精炼/);
    assert.equal(await page.locator('#modal [data-op="punch"]').isDisabled(), true);
  }
  await mobile(page, 'purchased-detail'); await closeModal(page);
  return actual;
}
async function production(page, series, requireAvailable = true) {
  await closeModal(page);
  const before = await record(page), p = before.snapshot.player;
  const recipes = getProductionCatalog(p).recipes.filter(recipe => recipe.series === series && (!requireAvailable || recipe.available));
  const recipe = recipes.find(recipe => itemColorEvidence(namedSpec(recipe.templateId))) || recipes[0];
  assert.ok(recipe, `An exact ${series} recipe is available in this scenario`);
  await click(page, 'page', '[data-id="town"]'); await click(page, 'townTab', '[data-id="forge"]');
  await page.locator('#production-series').selectOption(recipe.series);
  await page.locator('#forge-slot').selectOption(recipe.slot); await page.locator('#production-recipe').selectOption(recipe.id);
  await source(page, namedSpec(recipe.templateId)); await colors(page, 'production'); await mobile(page, `production-${series}`);
  assert.deepEqual(await record(page), before, 'Named production/source preview does not allocate equipment or save');
  if (!requireAvailable) return;
  await click(page, 'produceConfirm', `[data-id="${recipe.id}"]`);
  assert.deepEqual(await record(page), before, 'Confirmation is still a pure preview');
  await colors(page, 'production-confirm'); await click(page, 'confirmModal');
  const after = await record(page), actual = after.snapshot.player.bag.find(item => !p.bag.some(old => old.uid === item.uid));
  assert.equal(after.revision, before.revision + 1); assert.equal(after.snapshot.player.gold, p.gold - recipe.gold);
  for (const [id, quantity] of Object.entries(recipe.materials)) assert.equal(after.snapshot.player.items[id], p.items[id] - quantity);
  assert.equal(actual?.templateId, recipe.templateId); assert.ok(matchesNamedEquip(actual));
  await source(page, actual); await closeModal(page);
}
async function wearAndRemove(page, templateId) {
  await closeModal(page);
  await click(page, 'page', '[data-id="bag"]'); await click(page, 'bagTab', '[data-id="equipment"]');
  const before = await record(page), actual = before.snapshot.player.bag.find(item => item.templateId === templateId);
  assert.ok(actual && Object.values(actual.requirements).includes(null), 'A source item with unrecorded requirement fields must exercise the actual UI');
  await click(page, 'equipmentDetail', `[data-id="${actual.uid}"]`);
  const wear = page.locator(`#modal [data-action="equip"][data-id="${actual.uid}"]`);
  assert.equal(await wear.isDisabled(), false, 'Known source requirements are met; unrecorded fields remain unknown rather than blocking the UI');
  await wear.click(); await idle(page);
  const equipped = await record(page), expected = structuredClone(before.snapshot.player);
  expected.bag = expected.bag.filter(item => item.uid !== actual.uid);
  if (expected.equipment[actual.slot]) expected.bag.push(expected.equipment[actual.slot]);
  expected.equipment[actual.slot] = structuredClone(actual);
  const equippedStats = stats(expected); expected.hp = Math.min(expected.hp, equippedStats.hp); expected.mp = Math.min(expected.mp, equippedStats.mp);
  assert.equal(equipped.revision, before.revision + 1);
  assert.deepEqual(equipped.snapshot.player, expected, 'Source wear moves exactly the owned UID, preserves rolls and charges no currency or materials');
  await closeModal(page); await click(page, 'equipped', `[data-id="${actual.slot}"]`);
  await colors(page, 'source-worn'); await shot(page, 'actual-source-worn');
  await page.locator(`#modal [data-action="unequip"][data-id="${actual.slot}"]`).click(); await idle(page);
  const removed = await record(page), expectedRemoved = structuredClone(expected);
  expectedRemoved.bag.push(expectedRemoved.equipment[actual.slot]); delete expectedRemoved.equipment[actual.slot];
  const removedStats = stats(expectedRemoved); expectedRemoved.hp = Math.min(expectedRemoved.hp, removedStats.hp); expectedRemoved.mp = Math.min(expectedRemoved.mp, removedStats.mp);
  assert.equal(removed.revision, equipped.revision + 1);
  assert.deepEqual(removed.snapshot.player, expectedRemoved, 'Source removal returns the same UID and unchanged source rolls without resource charges');
  await closeModal(page);
}
function fixture(level) {
  const game = new Game(); game.start(`具名${level}级夹具`, 'cleric');
  const p = game.p; p.lv = level; p.gold = 1000000; p.attrs = { str: 300, dex: 100, mag: 350, con: 100 };
  p.production = Object.fromEntries(Object.keys(PRODUCTION_SKILLS).map(id => [id, { level: 6, exp: 0 }]));
  const recipes = getProductionRecipes(p.cls).filter(recipe => recipe.series === 'lunar' && recipe.lv <= level);
  const coloredRecipe = recipes.find(recipe => itemColorEvidence(namedSpec(recipe.templateId)));
  assert.ok(coloredRecipe, 'A source-verified name is required for the controlled 95/105 fixtures');
  const colored = makeNamedEquip(coloredRecipe.templateId, { origin: `ui-fixture-${level}-not-earned` });
  p.equipment[colored.slot] = colored; p.bag.push(makeNamedEquip(colored.templateId, { origin: `ui-fixture-${level}-not-earned` }));
  const training = Object.values(NAMED_EQUIPMENT).find(template => template.status === 'local-tutorial' && template.slot === 'body' && template.lv === 30 && template.armorType === 'robe');
  const body = makeNamedEquip(training.templateId, { origin: `ui-fixture-${level}-not-earned` }); body.refine = 1; p.equipment.body = body;
  for (const recipe of recipes) for (const id of Object.keys(recipe.materials)) p.items[id] = 1000;
  Object.assign(p.items, { huanxian: 100, qiankun: 1000, socketStone: 100, gemHp1: 2 });
  const ordinary = equipmentForShop(p).find(template => template.series === 'ordinary' && template.slot === 'weapon' && template.grade == null);
  assert.ok(ordinary, 'Ordinary partial source weapon required');
  if (level === 105) {
    const axe = makeHighEquip('axe19a'); axe.refine = 1; p.equipment.weapon = axe;
    p.bag.push(makeHighEquip('axe19b'), makeHighEquip('robe17c')); p.items.highForgeSigil = 200;
  }
  const s = stats(p); p.hp = s.hp; p.mp = s.mp;
  game.event(`明确初始化${level}级UI夹具，非自然升级或战利品：${colored.name}。`, 'system');
  return { snapshot: validateSave(game.state), ordinaryId: ordinary.templateId, coloredId: colored.templateId, coloredUid: colored.uid };
}
async function initializeFixture(page, data) {
  assert.equal(await record(page), null);
  await page.evaluate(async snapshot => {
    const api = globalThis[Symbol.for('pwi-h5.main-session')].api;
    if (api.store.db.name !== window.__namedDatabase || await api.store.current()) throw new Error('Fixture initialization requires an empty isolated LocalBackend database');
    await api.request('POST', '/v1/save/import', { snapshot, confirm: true });
  }, data.snapshot);
  await page.reload(); await idle(page); await observe(page);
  const saved = await record(page);
  assert.equal(saved.snapshot.player.lv, data.snapshot.player.lv);
  assert.equal(saved.snapshot.player.totals.battles, 0, 'Fixtures are initialized, not naturally earned');
  console.log(`FIXTURE INITIALIZED ${saved.snapshot.player.lv}: isolated LocalBackend database; NOT naturally earned`);
}

let naturalResult;
try {
  const natural = await fresh('natural');
  await check('fresh character, actual travel, E hunt, legal rounds and natural victory', async () => {
    await natural.locator('#char-name').fill('具名自然验收');
    await click(natural, 'race', '[data-id="elf"]'); await click(natural, 'class', '[data-id="cleric"]');
    await natural.getByRole('button', { name: '进入完美大陆' }).click(); await idle(natural);
    assert.ok(matchesNamedEquip((await record(natural)).snapshot.player.equipment.weapon));
    await click(natural, 'map'); await natural.locator('#atlas-place').selectOption('e_f1'); await click(natural, 'atlasStep'); await closeModal(natural);
    assert.equal((await record(natural)).snapshot.player.location, 'e_f1');
    await click(natural, 'claim', '[data-bounty="false"]'); await click(natural, 'fieldTarget', '[data-index="0"]');
    const before = await record(natural);
    await click(natural, 'sceneApproach');
    assert.deepEqual(await record(natural), before, 'Walking cannot issue new movement POSTs or begin combat');
    await natural.locator('#world-scene-host canvas').focus(); await natural.keyboard.press('e'); await idle(natural);
    assert.ok((await record(natural)).snapshot.battle && !(await record(natural)).snapshot.battle.result, 'E must initiate the real hunt');
    for (let turn = 0; turn < 60 && !(await record(natural)).snapshot.battle.result; turn++) {
      const oldRound = (await record(natural)).snapshot.battle.round;
      await natural.locator('[data-action="turn"].recommended:not(:disabled)').first().click(); await idle(natural);
      assert.equal((await record(natural)).snapshot.battle.round, oldRound + 1);
    }
    const victory = await record(natural); assert.equal(victory.snapshot.battle.result, 'win'); assert.ok(victory.snapshot.battle.round > 0);
    await colors(natural, 'battle-loot'); await shot(natural, 'natural-victory');
    await click(natural, 'leaveBattle'); await click(natural, 'claim', '[data-bounty="false"]');
    const home = (await record(natural)).snapshot.player.lastCity;
    await click(natural, 'map'); await natural.locator('#atlas-place').selectOption(home); await click(natural, 'atlasStep'); await closeModal(natural);
    naturalResult = { level: (await record(natural)).snapshot.player.lv, rounds: victory.snapshot.battle.round, wins: victory.snapshot.player.totals.battles };
  });
  await check('naturally funded exact named shop purchase and safe bag detail', () => purchase(natural));
  await check('finite catalog, class/level/slot filters, numeric sorting and unsupported reference-only types', () => catalog(natural));
  await check('actual local training production, pure named preview and exact payment', () => production(natural, 'local-tutorial'));
  await check('other-item names, town supplies, mall, rewards and history share evidence colors', async () => {
    const before = await record(natural);
    await click(natural, 'page', '[data-id="bag"]'); await click(natural, 'bagTab', '[data-id="items"]'); await colors(natural, 'owned-items');
    await click(natural, 'itemDetail', '[data-id="huanxian"]'); await colors(natural, 'item-detail'); await mobile(natural, 'item-detail'); await closeModal(natural);
    await click(natural, 'bagTab', '[data-id="catalog"]'); await colors(natural, 'item-preview');
    await click(natural, 'page', '[data-id="town"]'); await click(natural, 'townTab', '[data-id="shop"]'); await colors(natural, 'town-supplies');
    await click(natural, 'townTab', '[data-id="refine"]'); await colors(natural, 'refine');
    await click(natural, 'page', '[data-id="mall"]'); await colors(natural, 'mall'); await mobile(natural, 'mall');
    await click(natural, 'page', '[data-id="activities"]'); await colors(natural, 'reward-pool');
    await click(natural, 'page', '[data-id="guide"]'); await colors(natural, 'history');
    assert.deepEqual(await record(natural), before, 'All informational/economy/bag navigation remains read-only');
  });
  for (const level of [95, 105]) {
    const page = await fresh(`fixture-${level}`), data = fixture(level); await initializeFixture(page, data);
    await check(`initialized ${level} fixture: source-based colors in worn slots, bag, details and pure catalog`, async () => {
      const before = await record(page);
      await click(page, 'page', '[data-id="bag"]'); await click(page, 'bagTab', '[data-id="equipment"]'); await colors(page, 'worn-and-bag');
      await click(page, 'equipped', `[data-id="${namedSpec(data.coloredId).slot}"]`); await source(page, namedSpec(data.coloredId)); await closeModal(page);
      await click(page, 'equipmentDetail', `[data-id="${before.snapshot.player.bag.find(item => item.templateId === data.coloredId).uid}"]`);
      await source(page, namedSpec(data.coloredId)); await mobile(page, `fixture-${level}-colored-detail`); await closeModal(page);
      await catalog(page); assert.deepEqual(await record(page), before);
    });
    await check(`initialized ${level} fixture: partial ordinary weapon has unknown grade/stars and temporary attack`, () => purchase(page, data.ordinaryId));
    await check(`initialized ${level} fixture: exact source lunar materials and production`, () => production(page, 'lunar'));
    await check(`initialized ${level} fixture: actual source wear and removal preserve UID, rolls and exact resources`, () => wearAndRemove(page, data.coloredId));
    await check(`initialized ${level} fixture: refine and transfer names stay evidence-based`, async () => {
      const before = await record(page);
      await click(page, 'page', '[data-id="town"]'); await click(page, 'townTab', '[data-id="refine"]'); await colors(page, 'refine-fixture'); await mobile(page, `refine-${level}`);
      await click(page, 'transferOpen'); await colors(page, 'transfer-options'); await mobile(page, `transfer-${level}`); await closeModal(page);
      assert.deepEqual(await record(page), before, 'Refine/transfer inspection cannot consume resources');
    });
    if (level === 105) await check('initialized 105 fixture: independent high templates, exact attacks, source URLs and red names', async () => {
      const before = await record(page);
      await click(page, 'page', '[data-id="town"]'); await click(page, 'townTab', '[data-id="high"]'); await colors(page, 'high-forge'); await mobile(page, 'high-forge');
      for (const template of Object.values(HIGH_EQUIPMENT)) {
        await click(page, 'highDetail', `[data-id="${template.id}"]`); await colors(page, 'high-detail');
        const text = await page.locator('#modal .high-template-details').textContent();
        for (const range of Object.values(template.attackRanges || {})) for (const attack of range) assert.ok(text.includes(Math.round(attack).toLocaleString('zh-CN')));
        assert.ok(text.includes(`${template.grade}品`)); assert.match(text, /星级未载/);
        for (const url of template.source) assert.ok((await page.locator('#modal a').evaluateAll(nodes => nodes.map(node => node.href))).includes(url));
        await mobile(page, `high-${template.id}`); await closeModal(page);
      }
      await click(page, 'page', '[data-id="bag"]'); await click(page, 'bagTab', '[data-id="equipment"]');
      await click(page, 'equipped', '[data-id="weapon"]'); await colors(page, 'high-worn-detail'); await closeModal(page);
      assert.deepEqual(await record(page), before, 'High previews cannot craft, ascend or mutate existing saves');
    });
    assert.equal((await record(page)).snapshot.player.totals.battles, 0, 'Controlled 95/105 fixtures never claim natural progression');
  }
  await check('verified/unknown colors are consistent across multiple entrypoints, with no errors/external network/new movement POSTs', async () => {
    assert.ok([...colorVisits].some(([name, stages]) => itemNameColor(name) === 'unknown' && stages.size >= 4));
    assert.ok([...colorVisits].some(([name, stages]) => itemColorEvidence(name) && stages.size >= 5));
    assert.ok((colorVisits.get('幻仙石')?.size || 0) >= 3, 'Verified purple material must match in detail, preview and refine/reward contexts');
    for (const context of contexts) for (const page of context.pages()) {
      assert.ok((await posts(page)).every(row => !/\/world\/(move|walk|step|position)/.test(row.path)));
      assert.deepEqual(await page.evaluate(async () => (await indexedDB.databases()).map(db => db.name)), [await page.evaluate(() => window.__namedDatabase)]);
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
  });
  console.log(JSON.stringify({ checks: checks.length, natural: naturalResult, fixtures: '95/105 explicitly initialized, not naturally earned', errors, external, screenshots: join(artifacts, `named-${run}-*.png`) }));
} catch (error) {
  for (let index = 0; index < contexts.length; index++) for (const page of contexts[index].pages()) {
    await shot(page, `failure-${index}`).catch(() => {});
  }
  console.error(JSON.stringify({ errors, external }));
  throw error;
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
