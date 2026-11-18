import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { ITEMS, SLOTS, EQUIPMENT_SETS } from '../src/data/items.js';
import { GEAR_RULES } from '../src/data/gear-specs.js';
import { getProductionRecipes, PRODUCTION_SKILLS } from '../src/data/production.js';
import { DUNGEONS, ZONES } from '../src/data/world.js';

const base = process.env.GAME_URL;
assert.match(base || '', /^http:\/\/(?:localhost|127\.0\.0\.1):517[67]$/, 'Use explicit isolated localhost/127.0.0.1 port 5177 or 5176 in a fresh Chrome context');
const artifacts = fileURLToPath(new URL('../artifacts/', import.meta.url));
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
// The independent app work must not HMR-reset navigation in this isolated test context.
await page.route('**/@vite/client', (route) => route.fulfill({ contentType: 'application/javascript', body: '' }));
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(30000);
const errors = [];
const sourceDefects = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', async (dialog) => {
  errors.push(`Unexpected ${dialog.type()} dialog: ${dialog.message()}`);
  await dialog.dismiss();
});
let tag = new URL(base).port === '5176' ? 'production' : 'development';

const slots = Object.keys(SLOTS);
const tabs = ['equipment', 'items', 'catalog', 'arsenal'];
const allIds = Object.keys(ITEMS);
const groupOf = ({ type }) => ['hp', 'mp'].includes(type) ? 'potions'
  : ['mat', 'material'].includes(type) ? 'materials' : type === 'gem' ? 'gems'
    : ['chest', 'event'].includes(type) ? 'activities' : type === 'charm' ? 'charms' : 'other';
const groups = Object.fromEntries(['potions', 'materials', 'gems', 'activities', 'charms', 'other']
  .map((group) => [group, allIds.filter((id) => groupOf(ITEMS[id]) === group)]));
const gemIds = groups.gems;
const levelOf = (id) => ITEMS[id].lv;
const sorted = (values) => [...values].sort();
const compact = (text) => text.replace(/[,，\s]/g, '');
const visible = (selector) => page.locator(selector).filter({ visible: true }).first();
const action = (name, attrs = '', root = '') => visible(`${root} [data-action="${name}"]${attrs}`.trim());
const modalBody = () => page.locator('#modal .modal-body').filter({ visible: true }).first();

async function idle() {
  await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
}
async function click(name, attrs = '', root = '') {
  await idle();
  await action(name, attrs, root).click();
  await idle();
}
async function navigate(id) {
  await idle();
  await visible(`.sidebar .nav [data-action="page"][data-id="${id}"], .mobile-nav [data-action="page"][data-id="${id}"]`).click();
  await idle();
}
async function bagTab(id) {
  await click('bagTab', `[data-id="${id}"]`, '.bag-tabs');
  await expect(page.locator(`.bag-tabs [data-id="${id}"]`)).toHaveClass(/\bactive\b/);
}
async function closeModal() {
  await click('closeModal', '', '#modal .modal-actions');
  await expect(page.locator('#modal')).toBeHidden();
}
async function closeIfOpen() {
  if (await page.locator('#modal').isVisible()) await closeModal();
  await idle();
}
async function record() {
  await idle();
  return page.evaluate(async () => {
    // Inspect only this newly-created context. Refuse to create a database here.
    const databases = await indexedDB.databases();
    if (!databases.some((database) => database.name === 'pwi-text-backend')) {
      throw new Error('The game has not initialized its isolated IndexedDB database');
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('pwi-text-backend');
      request.onupgradeneeded = () => {
        request.transaction.abort();
        reject(new Error('Read-only save inspection must not initialize or upgrade a database'));
      };
      request.onblocked = () => reject(new Error('Read-only save inspection was blocked'));
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('saves')) {
          db.close(); reject(new Error('Missing saves object store')); return;
        }
        const tx = db.transaction('saves', 'readonly');
        const get = tx.objectStore('saves').get('current');
        tx.oncomplete = () => { db.close(); resolve(get.result ?? null); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
  });
}
async function unchanged(checkpoint, label) {
  assert.deepEqual(await record(), checkpoint, `${label} changed the persisted save`);
}
async function reloadUnchanged(checkpoint) {
  await closeIfOpen();
  await page.reload();
  await page.locator('.profile-name').waitFor({ state: 'attached' });
  await idle();
  await unchanged(checkpoint, 'Reload');
}
async function disabledNoCharge(locator, checkpoint, label) {
  await expect(locator).toBeVisible();
  await expect(locator).toBeDisabled();
  await locator.evaluate((button) => button.click());
  await idle();
  await unchanged(checkpoint, label);
}
async function catalogIds() {
  return page.locator('#codex-results .codex-item').evaluateAll((cards) => cards.map((card) => card.dataset.item));
}
async function search(value) {
  await idle();
  await page.locator('#codex-search').fill(value);
  await idle();
  await expect(page.locator('#codex-search')).toHaveValue(value);
}
async function category(value) {
  await idle();
  await page.locator('#codex-category').selectOption(value);
  await idle();
  await expect(page.locator('#codex-category')).toHaveValue(value);
}
async function openCatalog() {
  await closeIfOpen();
  await navigate('bag');
  await bagTab('catalog');
  await search('');
  await category('all');
  await expect(page.locator('#codex-results .codex-item')).toHaveCount(allIds.length);
}
async function openItem(id, checkpoint) {
  await click('itemDetail', `[data-id="${id}"]`, '#codex-results');
  await modalSettled();
  if (checkpoint) await unchanged(checkpoint, `Viewing ${id}`);
}
async function modalSettled() {
  const card = page.locator('#modal .modal-card').filter({ visible: true }).first();
  await expect(card).toBeVisible();
  // Measure the settled animation instead of masking a broken entrance with screenshot settings.
  await page.locator('#modal').evaluate(async (element) => {
    const finite = element.getAnimations({ subtree: true }).filter((animation) =>
      animation.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await idle();
  const geometry = await card.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const opacity = [];
    for (let node = element; node; node = node.parentElement) opacity.push(Number(getComputedStyle(node).opacity));
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom,
      width: box.width, height: box.height, viewport: [innerWidth, innerHeight], opacity };
  });
  assert.ok(geometry.opacity.every((value) => value >= 0.99), `Modal opacity after animation: ${JSON.stringify(geometry)}`);
  assert.ok(geometry.width > 0 && geometry.height > 0, 'Modal must have real dimensions');
  assert.ok(geometry.left >= -1 && geometry.right <= geometry.viewport[0] + 1
    && geometry.top >= -1 && geometry.bottom <= geometry.viewport[1] + 1,
  `Modal outside viewport: ${JSON.stringify(geometry)}`);
  await noOverflow();
}
async function noOverflow() {
  await idle();
  const size = await page.evaluate(() => ({
    width: innerWidth, root: document.documentElement.scrollWidth, body: document.body.scrollWidth,
    content: document.querySelector('.page')?.scrollWidth,
    contentWidth: document.querySelector('.page')?.clientWidth,
  }));
  assert.ok(size.root <= size.width + 1 && size.body <= size.width + 1, `Horizontal overflow: ${JSON.stringify(size)}`);
  if (size.contentWidth) assert.ok(size.content <= size.contentWidth + 1, `Page content overflow: ${JSON.stringify(size)}`);
}
async function visibleWithinWidth(locator, label, scroll = false) {
  await expect(locator).toBeVisible();
  if (scroll) await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0 && box.x >= -1
    && box.x + box.width <= page.viewportSize().width + 1, `${label} clipped horizontally: ${JSON.stringify(box)}`);
}
async function screenshot(name) {
  await idle();
  await page.waitForFunction(() => !document.querySelector('#toast')?.classList.contains('show'));
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
  await page.screenshot({ path: `${artifacts}info-${tag}-${name}.png`, fullPage: page.viewportSize().width >= 1440, animations: 'disabled' });
}
async function tabContents(id) {
  if (id === 'equipment') {
    await expect(page.locator('.page .equip-slot')).toHaveCount(11);
    assert.deepEqual(sorted(await page.locator('.page .equip-slot').evaluateAll((nodes) => nodes.map((node) => node.dataset.id))), sorted(slots));
  } else if (id === 'items') {
    const held = Object.entries((await record()).snapshot.player.items).filter(([, count]) => count > 0).map(([key]) => key);
    assert.deepEqual(sorted(await page.locator('.page .codex-item').evaluateAll((nodes) => nodes.map((node) => node.dataset.item))), sorted(held));
  } else if (id === 'catalog') {
    await search(''); await category('all');
    assert.deepEqual(sorted(await catalogIds()), sorted(allIds));
  } else {
    await page.locator('#catalog-class').selectOption('all');
    await page.locator('.gear-catalog-advanced > summary').click();
    await page.locator('#catalog-series').selectOption('all');
    await idle();
    assert.deepEqual(await page.locator('#catalog-slot option').evaluateAll((nodes) => nodes.map((node) => node.value)), ['all', ...slots.filter((slot) => slot !== 'ring2')]);
    assert.deepEqual(await page.locator('#catalog-quality option').evaluateAll((nodes) => nodes.map((node) => node.value)), ['all', '0', '1', '2', '3', '4']);
    await expect(page.locator('.equipment-catalog')).toContainText('不生成装备、UID或随机词条');
    await expect(page.locator('#catalog-count')).toContainText('17,766');
    await expect(page.locator('.gear-catalog-row')).toHaveCount(60);
    await page.locator('.catalog-cultivation > summary').click();
    await expect(page.locator('.cultivation-reference article')).toHaveCount(3);
    for (const text of ['先开孔', '武器最多2孔', '品阶', '不支持通用+5升级或任意洗练', '天罡+15', '地煞+5', '乾坤']) await expect(page.locator('.cultivation-reference')).toContainText(text);
    const legacy = page.locator('.rules-boundary').filter({ hasText: '旧存档套装兼容' });
    for (const set of Object.values(EQUIPMENT_SETS)) await expect(legacy).toContainText(set.name);
    await expect(legacy).toContainText('无ruleVersion旧装备仍可旧制升级与洗练');
    await expect(page.locator('.high-forge-entry')).toHaveCount(0);
    await expect(page.locator('#equipment-high')).toHaveCount(0);
    await expect(page.locator('.rules-boundary a')).toHaveCount(3);
  }
}
async function checkHighDetail(checkpoint) {
  if (!await page.locator('.gear-catalog-advanced').evaluate((node) => node.open)) await page.locator('.gear-catalog-advanced > summary').click();
  await page.locator('#catalog-class').selectOption('all');
  await page.locator('#catalog-series').selectOption('high');
  await idle();
  await expect(page.locator('.gear-catalog-row')).toHaveCount(5);
  await click('catalogEquipmentDetail', '[data-id="high:axe19c"]');
  await modalSettled();
  const text = compact(await modalBody().innerText());
  for (const pattern of [/千古一色/, /需求/, /105/, /力量300/, /敏捷50/, /固定基础属性/, /固定附加属性/,
    /1647[—–～~-]3843/, /狂天神/, /磐龙甲/, /配方/, /120000金币/, /神铸凭证.*120/, /逝川归/]) {
    assert.match(text, pattern, `axe19c detail missing ${pattern}`);
  }
  const fixed = modalBody().locator('.raw-stat-grid section');
  await expect(fixed).toHaveCount(2);
  const baseStats = compact(await fixed.nth(0).innerText());
  const addons = compact(await fixed.nth(1).innerText());
  for (const pattern of [/物理攻击\+?2745/, /猎魔等级\+?800/]) assert.match(baseStats, pattern);
  for (const pattern of [/攻击等级\+?140/, /防御等级\+?80/, /力量\+?55/, /气魄\+?350/,
    /物理攻击\+?350/, /暴击\+?5%/, /创世等级\+?1/]) assert.match(addons, pattern);
  await unchanged(checkpoint, 'High template specification');
  await closeModal();
}

try {
  await page.goto(base);
  await page.locator('#char-name').waitFor();
  await idle();
  tag = await page.evaluate(() => [...document.scripts].some((script) => script.src.includes('/@vite/client')) ? 'development' : 'production');
  assert.equal(await record(), null, 'A fresh isolated browser context must not contain a user save');
  await click('race', '[data-id="human"]');
  await click('class', '[data-id="blademaster"]');
  await page.locator('#char-name').fill('装备道具验收');
  await page.getByRole('button', { name: '进入完美大陆' }).click();
  await page.locator('.profile-name').waitFor({ state: 'attached' });
  await idle();
  const initial = await record();
  const starter = initial.snapshot.player;
  assert.equal(starter.lv, 1);
  assert.equal(starter.gold, 300);
  assert.equal(starter.cls, 'blademaster');
  assert.equal(starter.location, starter.lastCity);
  assert.deepEqual(sorted(Object.keys(starter.equipment)), sorted(['weapon', 'body', 'legs', 'feet']));
  assert.deepEqual(starter.bag, []);
  assert.equal(starter.items.town, 3);

  await navigate('world');
  for (const id of ['equipment', 'catalog', 'arsenal']) {
    await expect(action('catalogGo', `[data-page="bag"][data-tab="${id}"]`, '.page')).toBeVisible();
  }
  await click('catalogGo', '[data-page="bag"][data-tab="equipment"]', '.page');
  await expect(page.locator('.bag-tabs [data-id="equipment"]')).toHaveClass(/\bactive\b/);
  await tabContents('equipment');
  await expect(page.locator('.page .equip-slot .equipment-name')).toHaveCount(4);
  for (const [slot, item] of Object.entries(starter.equipment)) {
    await expect(page.locator(`.page .equip-slot[data-id="${slot}"]`)).toContainText(item.name);
  }
  assert.match(await page.locator('.page').innerText(), /行囊.*(?:尚无|没有|暂无).*装备/);
  await unchanged(initial, 'Initial equipment discovery');
  await screenshot('equipment-1440');
  await click('equipped', '[data-id="head"]', '.page');
  await modalSettled();
  assert.match(await modalBody().innerText(), /尚未装备|未装备|空栏/);
  await click('catalogGo', '[data-page="town"][data-tab="equipment"]', '#modal');
  await expect(page.locator('#modal')).toBeHidden();
  await expect(action('townTab', '[data-id="equipment"]')).toHaveClass(/\bactive\b/);
  const headBuy = action('buyEquip', '[data-id="head"]', '.page');
  await expect(headBuy).toBeEnabled();
  const displayedPrice = Number((await headBuy.innerText()).match(/([\d,，]+)\s*金币/)?.[1].replace(/[,，]/g, ''));
  assert.ok(Number.isFinite(displayedPrice) && displayedPrice > 0 && displayedPrice <= 300, 'Head purchase must be affordable with starting gold');
  await unchanged(initial, 'Empty-slot acquisition navigation');
  await click('buyEquip', '[data-id="head"]', '.page');
  await closeIfOpen();
  const purchased = await record();
  assert.equal(purchased.revision, initial.revision + 1);
  assert.equal(purchased.snapshot.player.bag.length, 1);
  const head = purchased.snapshot.player.bag[0];
  assert.equal(head.slot, 'head');
  assert.equal(head.lv, 1);
  assert.equal(head.price, displayedPrice);
  const expectedPurchase = structuredClone(starter);
  expectedPurchase.gold -= head.price; expectedPurchase.bag.push(head);
  assert.deepEqual(purchased.snapshot.player, expectedPurchase, 'Purchase must deduct exactly the displayed gold and add one real head item');
  await navigate('bag'); await bagTab('equipment');
  await click('equipmentDetail', `[data-id="${head.uid}"]`, '.page');
  await modalSettled();
  await unchanged(purchased, 'Purchased equipment detail');
  await click('equip', `[data-id="${head.uid}"]`, '#modal');
  const equipped = await record();
  assert.equal(equipped.revision, purchased.revision + 1);
  const expectedEquipped = structuredClone(expectedPurchase);
  expectedEquipped.bag = []; expectedEquipped.equipment.head = head;
  assert.deepEqual(equipped.snapshot.player, expectedEquipped, 'Equipping must move the same UID without charging resources');
  await expect(page.locator('.page .equip-slot[data-id="head"]')).toContainText(head.name);
  await expect(page.locator('.page .equip-slot .equipment-name')).toHaveCount(5);
  await reloadUnchanged(equipped);
  await navigate('bag');
  await expect(page.locator('.bag-tabs [data-id="equipment"]')).toHaveClass(/\bactive\b/);
  await click('equipped', '[data-id="head"]', '.page');
  await modalSettled();
  await click('unequip', '[data-id="head"]', '#modal');
  const browsing = await record();
  assert.equal(browsing.revision, equipped.revision + 1);
  assert.deepEqual(browsing.snapshot.player, expectedPurchase, 'Unequipping must restore the exact bag item and original four equipped items');
  await expect(page.locator('.page .equip-slot[data-id="head"]')).toContainText('尚未装备');
  await reloadUnchanged(browsing);

  for (const origin of ['world', 'guide']) {
    for (const id of ['equipment', 'catalog', 'arsenal']) {
      await navigate(origin);
      await click('catalogGo', `[data-page="bag"][data-tab="${id}"]`, '.page');
      await expect(page.locator(`.bag-tabs [data-id="${id}"]`)).toHaveClass(/\bactive\b/);
      await tabContents(id);
      await unchanged(browsing, `${origin} shortcut to ${id}`);
    }
  }
  for (let repeat = 0; repeat < 2; repeat++) {
    for (const id of tabs) { await bagTab(id); await tabContents(id); await unchanged(browsing, `Repeated ${id} tab`); }
  }
  await reloadUnchanged(browsing);
  await navigate('bag');
  await expect(page.locator('.bag-tabs [data-id="equipment"]')).toHaveClass(/\bactive\b/);

  await openCatalog();
  assert.deepEqual(sorted(await catalogIds()), sorted(allIds));
  assert.deepEqual(await page.locator('#codex-category option').evaluateAll((options) => options.map((option) => option.value)), ['all', ...Object.keys(groups)]);
  for (const id of allIds) {
    const card = page.locator(`#codex-results .codex-item[data-item="${id}"]`);
    await expect(card).toHaveCount(1);
    await expect(card.locator(`[data-action="itemDetail"][data-id="${id}"]`).first()).toBeVisible();
    await expect(card).toContainText(`Lv.${levelOf(id)}`);
    const name = (await card.locator('.codex-copy strong').innerText()).trim();
    await openItem(id, browsing);
    await expect(modalBody().locator('h3')).toContainText(name);
    const text = compact(await modalBody().innerText());
    assert.match(text, new RegExp(`需人物${levelOf(id)}级`), `${id} minimum level`);
    assert.match(text, new RegExp(`持有${browsing.snapshot.player.items[id] || 0}个`), `${id} persisted ownership count`);
    assert.ok((await modalBody().locator('.notice').first().innerText()).trim().length > 10, `${id} needs a useful effect/use description`);
    if (!await modalBody().locator('.item-source-list li').count()) {
      const defect = { item: id, name: ITEMS[id].name, evidence: compact(await modalBody().innerText()),
        selector: '#modal .item-source-list li', expected: 'At least one real acquisition source and working destination', actual: 0 };
      sourceDefects.push(defect);
      console.error('SOURCE DEFECT:', JSON.stringify(defect));
    } else {
      await expect(modalBody().locator('.item-source-list li').first()).toBeVisible();
      await expect(action('catalogGo', '', '#modal .item-source-list')).toBeVisible();
    }
    await closeModal();
  }

  for (const [group, ids] of Object.entries(groups)) {
    await search(''); await category(group);
    assert.deepEqual(sorted(await catalogIds()), sorted(ids), `${group} category contents`);
    const label = (await page.locator(`#codex-category option[value="${group}"]`).innerText()).trim();
    await category('all'); await search(label);
    const matches = await catalogIds();
    for (const id of ids) assert.ok(matches.includes(id), `Chinese usage/category search missing ${id}: ${label}`);
  }
  await search(''); await category('all');
  await page.locator('#codex-search').evaluate((input) => { input.dataset.infoFocusProbe = 'original'; });
  let typed = '';
  for (const character of '仙灵玉露') {
    typed += character;
    await page.locator('#codex-search').pressSequentially(character);
    await idle();
    await expect(page.locator('#codex-search')).toHaveValue(typed);
    await expect(page.locator('#codex-search')).toBeFocused();
    await expect(page.locator('#codex-search')).toHaveAttribute('data-info-focus-probe', 'original');
    assert.ok((await catalogIds()).includes('hp5'), `Live results missing hp5 for ${typed}`);
  }
  assert.deepEqual(await catalogIds(), ['hp5']);
  await search('5000'); assert.ok((await catalogIds()).includes('hp5'), 'Effect-value search must find the high-level healing potion');
  await search('暴击'); await category('gems');
  assert.deepEqual(sorted(await catalogIds()), sorted(['gemCrit1', 'gemCrit2', 'gemCrit3']));
  await expect(page.locator('#codex-search')).toHaveValue('暴击');
  await category('potions');
  await expect(page.locator('#codex-results .codex-item')).toHaveCount(0);
  assert.match(await page.locator('#codex-results').innerText(), /没有符合|无结果|未找到/);
  await category('gems');
  assert.deepEqual(sorted(await catalogIds()), sorted(['gemCrit1', 'gemCrit2', 'gemCrit3']));
  await search(''); await expect(page.locator('#codex-results .codex-item')).toHaveCount(gemIds.length);
  await category('all'); await search('绝不存在的道具验收词');
  await expect(page.locator('#codex-results .codex-item')).toHaveCount(0);
  assert.match(await page.locator('#codex-results').innerText(), /没有符合|无结果|未找到/);
  await page.evaluate(() => { window.__infoXssProbe = 0; });
  for (const payload of ['<b>', '<img src=x onerror="window.__infoXssProbe=1">']) {
    await search(payload);
    await expect(page.locator('#codex-search')).toBeFocused();
    await expect(page.locator('#codex-results .codex-item')).toHaveCount(0);
    await expect(page.locator('#codex-results b, #codex-results img, #codex-results script, #codex-results [onerror]')).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.__infoXssProbe), 0, 'Search input must remain text, not execute HTML');
    await unchanged(browsing, 'Literal HTML/XSS search');
  }
  await search(''); await unchanged(browsing, 'All directory searching/filtering');

  await openItem('hp5', browsing);
  assert.match(compact(await modalBody().innerText()), /恢复5000点?生命/);
  await disabledNoCharge(action('useItem', '[data-id="hp5"]', '#modal'), browsing, 'Level-85 potion disabled at level 1');
  await click('catalogGo', '[data-page="town"][data-tab="shop"]', '#modal .item-source-list');
  await expect(page.locator('#modal')).toBeHidden();
  await expect(action('townTab', '[data-id="shop"]')).toHaveClass(/\bactive\b/);
  await expect(action('buy', '[data-id="town"][data-qty="1"]', '.page')).toBeEnabled();
  assert.ok(browsing.snapshot.player.gold < 300, 'Natural purchase must leave too little gold for ten return scrolls');
  await disabledNoCharge(action('buy', '[data-id="town"][data-qty="10"]', '.page'), browsing, 'Insufficient gold must not be charged');
  await openCatalog(); await openItem('highForgeSigil', browsing);
  const sigilText = compact(await modalBody().innerText());
  assert.match(sigilText, /推荐等级[≥>=]*75.*副本最终首领波通关.*2枚/);
  assert.match(sigilText, /普通波与野外首领不掉落/);
  assert.match(sigilText, /40元宝/);
  assert.match(sigilText, /鸿运秘宝/);
  await click('catalogGo', '[data-page="mall"][data-product="highForgeSigil"]', '#modal .item-source-list');
  await modalSettled();
  await expect(page.locator('#dialog-title')).toContainText('神铸凭证');
  assert.match(compact(await modalBody().innerText()), /40元宝/);
  await expect(action('mallBuy', '[data-id="highForgeSigil"][data-qty="1"]', '#modal')).toBeVisible();
  await unchanged(browsing, 'Actual sigil mall product navigation');
  await openCatalog(); await openItem('highForgeSigil', browsing);
  await click('catalogGo', '[data-page="town"][data-tab="dungeon"]', '#modal .item-source-list');
  await expect(page.locator('#modal')).toBeHidden();
  await expect(action('townTab', '[data-id="dungeon"]')).toHaveClass(/\bactive\b/);
  for (const id of ['d75', 'd85', 'd95', 'd100', 'd105']) {
    const specification = DUNGEONS.find((dungeon) => dungeon.id === id);
    const dungeon = page.locator('.page .item-card').filter({ has: page.locator(`[data-action="dungeonDetail"][data-id="${id}"]`) });
    await expect(dungeon).toContainText(specification.name);
    await expect(dungeon).toContainText(`本作 Lv.${specification.lv}`);
    await expect(dungeon).toContainText('全程不掉成品装备');
    for (const material of specification.rewardMaterials) await expect(dungeon).toContainText(ITEMS[material].name);
    for (const entrance of specification.entrance) await expect(dungeon).toContainText(ZONES[entrance].name);
    // Town is a directory, not a remote entrance. Real level/route gating lives in the atlas.
    assert.equal(await dungeon.locator('[data-action="dungeon"]').count(), 0);
    await click('dungeonDetail', `[data-id="${id}"]`, '.page');
    await modalSettled();
    await unchanged(browsing, `${id} entry and materials detail`);
    await closeModal();
    await click('dungeonRoute', `[data-id="${id}"]`, '.page');
    await expect(page.locator('#modal .atlas-canvas')).toBeVisible();
    await expect(page.locator('#modal .atlas-detail')).toContainText('暂无可通行路线');
    await disabledNoCharge(action('atlasStep', '', '#modal'), browsing, `Unentered ${id} source must not consume an attempt or resources`);
    await closeModal();
  }
  await unchanged(browsing, 'Actual material dungeons, registered entrances and route/level gates');
  await openCatalog(); await openItem('highForgeSigil', browsing);
  await click('catalogGo', '[data-page="activities"]', '#modal .item-source-list');
  await expect(page.locator('#modal')).toBeHidden();
  await expect(page.locator('.orbit-prize[data-prize="hyForge"]')).toContainText('神铸凭证');
  await unchanged(browsing, 'Sigil source is present in the actual treasure pool');
  await openCatalog(); await openItem('gemCrit3', browsing);
  const gemText = compact(await modalBody().innerText());
  assert.match(gemText, /需人物55级/);
  assert.match(gemText, /暴击\+?2%/);
  assert.match(gemText, /新装备需8品.*武器攻击类.*护甲生命真气防御类/);
  assert.match(gemText, /旧装备与固定模板仍要求角色、装备均55级/);
  assert.match(gemText, /先开孔/);
  await click('catalogGo', '[data-page="mall"][data-product="gemCrit3"]', '#modal .item-source-list');
  await modalSettled();
  await expect(page.locator('#dialog-title')).toContainText('3阶暴击石');
  assert.match(compact(await modalBody().innerText()), /等级要求55/);
  await disabledNoCharge(action('mallBuy', '[data-id="gemCrit3"][data-qty="1"]', '#modal'), browsing, 'Low-level gem product cannot be bought');
  await openCatalog(); await openItem('goldChest', browsing);
  const chestText = compact(await modalBody().innerText());
  assert.match(chestText, /25元宝/);
  assert.match(chestText, /每次消耗本物品[×x]1/);
  assert.match(chestText, /不额外.*钥匙/);
  await click('catalogGo', '[data-page="mall"][data-product="goldChest"]', '#modal .item-source-list');
  await modalSettled();
  await expect(page.locator('#dialog-title')).toContainText('黄金宝箱');
  assert.match(compact(await modalBody().innerText()), /25元宝/);
  await expect(action('mallBuy', '[data-id="goldChest"][data-qty="1"]', '#modal')).toBeVisible();
  await unchanged(browsing, 'Actual gold-chest product navigation');
  await openCatalog(); await openItem('goldChest', browsing);
  await expect(modalBody().locator('.probability-list li')).toHaveCount(6);
  for (const count of [1, 10]) {
    await disabledNoCharge(action('activityOpen', `[data-id="goldChest"][data-count="${count}"]`, '#modal'), browsing, `Unowned chest detail ×${count} cannot open or charge a key/wallet`);
  }
  await click('catalogGo', '[data-page="bag"][data-tab="items"]', '#modal');
  await expect(page.locator('#modal')).toBeHidden();
  await expect(page.locator('.bag-tabs [data-id="items"]')).toHaveClass(/\bactive\b/);
  await expect(page.locator('#owned-items')).toBeVisible();
  await tabContents('items');
  await expect(page.locator('.page .codex-item[data-item="goldChest"]')).toHaveCount(0);
  await expect(page.locator('.page [data-action="activityOpen"][data-id="goldChest"]')).toHaveCount(0);
  await expect(page.locator('.economy-fold[data-fold="物品开启累计礼"]')).toHaveCount(1);
  await expect(page.locator('.page [data-id="festival.daily"]')).toHaveCount(0);
  await unchanged(browsing, 'Chest detail and owned-only bag opening entry');

  await navigate('bag'); await bagTab('arsenal'); await tabContents('arsenal');
  await checkHighDetail(browsing);
  await click('catalogEquipmentDetail', '[data-id="high:axe19a"]');
  await click('highForgeTab', '', '#modal');
  await disabledNoCharge(action('highCraft', '[data-id="axe19a"]', '.page'), browsing, 'Level-1 crafting is disabled in the actual town forge');
  await unchanged(browsing, 'Complete read-only directory/template browsing');
  // Natural level-1 browsing of the real catalog: all series/slot recipe lists,
  // exact materials and actual player/production-skill requirements, no fixture resources.
  await navigate('town'); await click('townTab', '[data-id="forge"]');
  const productionRecipes = getProductionRecipes(starter.cls);
  for (const series of [...new Set(productionRecipes.map((recipe) => recipe.series))]) {
    await page.locator('#production-series').selectOption(series); await idle();
    const seriesRecipes = productionRecipes.filter((recipe) => recipe.series === series);
    const productionSlots = [...new Set(seriesRecipes.map((recipe) => recipe.slot))];
    assert.deepEqual(await page.locator('#forge-slot option').evaluateAll((nodes) => nodes.map((node) => node.value)), productionSlots);
    for (const slot of productionSlots) {
      await page.locator('#forge-slot').selectOption(slot); await idle();
      const recipes = seriesRecipes.filter((recipe) => recipe.slot === slot);
      assert.deepEqual(await page.locator('#production-recipe option').evaluateAll((nodes) => nodes.map((node) => node.value)), recipes.map((recipe) => recipe.id));
      for (const recipe of [recipes[0], recipes.at(-1)]) {
        await page.locator('#production-recipe').selectOption(recipe.id); await idle();
        await expect(page.locator('#production-recipe option:checked')).toContainText(`${recipe.skillLevel}级${PRODUCTION_SKILLS[recipe.skill].name}`);
        await expect(page.locator('.recipe-chain').first()).toContainText(`${PRODUCTION_SKILLS[recipe.skill].name} ${recipe.skillLevel}级`);
        await expect(page.locator('#spec-preview, .production-workbench .spec-preview').last()).toContainText(`Lv.${recipe.playerLv}`);
        assert.equal(Number(compact(await page.locator('.production-gold').innerText()).match(/^\d+/)?.[0]), recipe.gold);
        const materials = page.locator('.production-costs .material-row');
        await expect(materials).toHaveCount(Object.keys(recipe.materials).length);
        for (const [id, quantity] of Object.entries(recipe.materials)) {
          const material = materials.filter({ hasText: ITEMS[id].name });
          await expect(material).toHaveCount(1);
          assert.match(compact(await material.innerText()), new RegExp(`${browsing.snapshot.player.items[id] || 0}/${quantity}`));
        }
        await disabledNoCharge(action('produceConfirm', `[data-id="${recipe.id}"]`), browsing, `${recipe.id} cannot produce without resources/levels/predecessor`);
        if (recipe.playerLv > starter.lv) await expect(page.locator('.production-status')).toContainText(`需人物${recipe.playerLv}级`);
        if (recipe.skillLevel > 1) await expect(page.locator('.production-status')).toContainText(`需${PRODUCTION_SKILLS[recipe.skill].name}${recipe.skillLevel}级`);
      }
    }
  }
  for (const skill of Object.keys(PRODUCTION_SKILLS)) await disabledNoCharge(action('productionTrain', `[data-id="${skill}"]`), browsing, `Untrained ${skill} cannot charge gold`);
  console.log(`PASS natural catalog checkpoint: ${allIds.length} details, real sources/fixed high specifications, ${productionRecipes.length} recipe IDs and exact endpoint costs/skill gates; no imported fixtures.`);
  await reloadUnchanged(browsing);

  await navigate('world'); await click('travel', '[data-id="h_f1"][data-teleport="false"]', '.page');
  const wilderness = await record();
  assert.equal(wilderness.revision, browsing.revision + 1);
  assert.equal(wilderness.snapshot.player.location, 'h_f1');
  assert.equal(wilderness.snapshot.player.lastCity, starter.lastCity);
  assert.equal(wilderness.snapshot.player.gold, browsing.snapshot.player.gold);
  await click('catalogGo', '[data-page="bag"][data-tab="arsenal"]', '.page');
  await tabContents('arsenal');
  await checkHighDetail(wilderness);
  await click('catalogEquipmentDetail', '[data-id="high:axe19a"]');
  await click('highForgeTab', '', '#modal');
  await expect(page.locator('.page')).toContainText('荒野不设商铺');
  await expect(page.locator('.page [data-action="highCraft"]')).toHaveCount(0);
  await unchanged(wilderness, 'Catalog source routing must not enable city-only crafting or deduct resources in wilderness');
  await openCatalog(); await openItem('town', wilderness);
  const townUse = action('useItem', '[data-id="town"]', '#modal');
  await expect(townUse).toBeEnabled();
  assert.match(compact(await modalBody().innerText()), /消耗1张.*返回.*主城/);
  await click('useItem', '[data-id="town"]', '#modal');
  await closeIfOpen();
  const returned = await record();
  assert.equal(returned.revision, wilderness.revision + 1);
  const expectedReturn = structuredClone(wilderness.snapshot.player);
  expectedReturn.location = expectedReturn.lastCity; expectedReturn.items.town -= 1;
  assert.deepEqual(returned.snapshot.player, expectedReturn, 'Catalog return-scroll use must consume exactly one scroll, return to town, and change no other player resources');
  assert.equal(returned.snapshot.battle, null);
  await navigate('world');
  await expect(page.locator('.location-hero')).toContainText('剑仙城');
  await reloadUnchanged(returned);
  await openCatalog(); await openItem('town', returned);
  assert.match(compact(await modalBody().innerText()), /持有2个/);
  await closeModal();

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : width === 390 ? 844 : 740 });
    await navigate('bag');
    for (const id of tabs) {
      await bagTab(id); await tabContents(id); await noOverflow();
      await expect(page.locator('.bag-tabs [data-action="bagTab"]')).toHaveCount(4);
      for (const tab of tabs) await visibleWithinWidth(page.locator(`.bag-tabs [data-id="${tab}"]`), `${width}px ${tab} tab`);
      if (id === 'equipment') {
        for (const slot of slots) await visibleWithinWidth(page.locator(`.page .equip-slot[data-id="${slot}"]`), `${width}px ${slot} slot`, width < 1440);
      }
      await unchanged(returned, `${width}px ${id} layout browsing`);
      if (width === 320 && id === 'catalog') await screenshot('catalog-320');
      if (width === 320 && id === 'arsenal') await screenshot('arsenal-320');
    }
    await bagTab('catalog'); await search(''); await category('all');
    await openItem('hp5', returned); await modalSettled();
    if (width === 320) await screenshot('detail-320');
    await closeModal();
    await bagTab('arsenal'); await checkHighDetail(returned);
    await reloadUnchanged(returned);
    await navigate('bag');
    await expect(page.locator('.bag-tabs [data-id="equipment"]')).toHaveClass(/\bactive\b/);
    await noOverflow();
  }
  await unchanged(returned, 'Final complete save invariant');
  assert.deepEqual(errors, [], 'Browser errors or unexpected executable search text');
  console.log(`${sourceDefects.length ? 'PASS remaining coverage (source defects below prevent overall PASS)' : 'PASS'} ${tag} Chrome info UI: isolated natural level-1 character; world/guide discovery; 11 slots and four starter equips; real head purchase/equip/unequip and reload; ${allIds.length} item details, ${gemIds.length} gems, effect/name/Chinese-category search, combined filters, no results, persistent input focus and literal HTML/XSS safety; real product/dungeon/pool sources; insufficient-resource/level/city disabling without charges; five high templates and axe19c fixed specification; catalog return scroll consumes exactly one and persists; complete IndexedDB record invariants; four tabs and settled modal opacity/bounds at 1440/390/320px.`);
  console.log(`Screenshots: ${artifacts}info-${tag}-{equipment-1440,catalog-320,arsenal-320,detail-320}.png`);
  assert.deepEqual(sourceDefects, [], 'Genuine source defects: every catalog item must disclose an actual acquisition source; remaining coverage was still executed');
} finally {
  await context.close();
  await browser.close();
}
