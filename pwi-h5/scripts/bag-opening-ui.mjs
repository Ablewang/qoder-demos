import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { Game } from '../src/core/game.js';
import { makeEquip, ITEMS } from '../src/data/items.js';
import { BAG_LIMIT } from '../src/core/model.js';
import { validateSnapshot } from '../src/core/schema.js';

const base = process.env.GAME_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:517[67]$/, 'Use an isolated 127.0.0.1 port 5177 or 5176');
const tag = new URL(base).port === '5176' ? 'production' : 'development';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const idle = () => page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
const button = (action, attrs = '') => page.locator(`[data-action="${action}"]${attrs}`).filter({ visible: true }).first();
async function click(action, attrs = '') {
  const target = button(action, attrs);
  if (action === 'page' && !await target.count()) await page.locator('.mobile-nav-more > summary').click();
  await target.click(); await idle();
}
const nav = id => click('page', `[data-id="${id}"]`);
const close = () => click('closeModal');
const record = () => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('pwi-text-backend');
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result, tx = db.transaction('saves', 'readonly'), get = tx.objectStore('saves').get('current');
    tx.oncomplete = () => { db.close(); resolve(get.result); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  };
}));
const player = async () => (await record()).snapshot.player;
async function bag() { await nav('bag'); await click('bagTab', '[data-id="items"]'); }
async function shot(name) {
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: new URL(`../artifacts/bag-${tag}-${name}.png`, import.meta.url).pathname, fullPage: true, animations: 'disabled' });
}
async function layout() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  if (await page.locator('#modal:not(.hidden)').count()) {
    const box = await page.locator('.modal-card').boundingBox();
    assert.ok(box.x >= -1 && box.x + box.width <= page.viewportSize().width + 1);
  }
}
async function importFixture(snapshot) {
  validateSnapshot(snapshot);
  await nav('guide');
  const chooser = page.waitForEvent('filechooser'); await click('importPicker');
  await (await chooser).setFiles({ name: 'controlled-bag-opening.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(snapshot)) });
  await click('confirmModal');
  const imported = (await record()).snapshot;
  assert.equal(imported.journal.length, snapshot.journal.length + 1);
  assert.equal(imported.journal.at(-1).text, '存档已导入。');
  assert.deepEqual({ ...imported, journal: imported.journal.slice(0, -1) }, snapshot);
}
async function buy(id) {
  await nav('mall'); await click('mallTab', '[data-id="all"]');
  const before = await player();
  await click('mallBuy', `[data-id="${id}"][data-qty="1"]`);
  assert.equal((await player()).items[id], (before.items[id] || 0) + 1);
  assert.equal((await player()).drawHistory.length, before.drawHistory.length, 'Buying cannot draw rewards');
  await page.locator('#modal [data-action="bagOpenables"]').click(); await idle();
  assert.equal(await page.locator(`.codex-item[data-item="${id}"]`).count(), 1);
}
async function open(id, count = 1) {
  const before = await player();
  await click('activityOpen', `[data-id="${id}"][data-count="${count}"]`);
  assert.match(await page.locator('#dialog-title').innerText(), /包裹物品已开启/);
  assert.equal(await page.locator('#modal .real-prize').count(), count);
  const after = await player();
  assert.equal(after.items[id], before.items[id] - count);
  assert.equal(after.drawHistory.length, before.drawHistory.length + count);
  assert.deepEqual(after.events.hongyun, before.events.hongyun);
  assert.equal(after.items.treasureKey || 0, before.items.treasureKey || 0);
  const results = after.drawHistory.slice(-count);
  for (const result of results) {
    assert.equal(result.poolId, id);
    for (const reward of result.rewards) if (reward.type === 'equip') {
      assert.ok(after.bag.some(it => it.uid === reward.equipment.uid), 'Actual reward UID must exist in equipment bag');
      assert.ok(await page.locator('#modal').innerText().then(text => text.includes(reward.equipment.name)));
    }
  }
  const gain = type => results.flatMap(result => result.rewards).filter(reward => reward.type === type).reduce((sum, reward) => sum + reward.quantity, 0);
  for (const currency of ['yuanbao', 'boundYuanbao']) assert.equal(after.wallet[currency], before.wallet[currency] + gain(currency), 'Opening cannot charge wallet');
  assert.equal(after.gold, before.gold + gain('gold'));
  await layout();
  return after;
}
try {
  await page.goto(base); await page.locator('#char-name').fill('包裹自然试玩');
  await page.getByRole('button', { name: '进入完美大陆' }).click(); await idle();
  await nav('mall'); await click('walletDetail'); await click('walletDaily'); await close();
  await page.locator('[data-fold="每日商城补贴"] summary').click();
  await click('activityClaim', '[data-id="festival.daily"]'); await close();
  assert.equal(await page.locator('.page [data-action="activityOpen"]').count(), 0);
  await nav('activities');
  assert.equal(await page.locator('.page [data-action="activityOpen"], .treasure-to-mall, #box-vault').count(), 0);
  assert.equal(await page.locator('[data-action="page"][data-id="activities"]').first().innerText(), '鸿运秘宝');
  const initial = await record();
  await nav('bag'); await click('bagTab', '[data-id="catalog"]');
  await click('itemDetail', '[data-id="bronzeChest"]');
  assert.ok(await button('activityOpen', '[data-id="bronzeChest"][data-count="1"]').isDisabled());
  await button('activityOpen', '[data-id="bronzeChest"][data-count="1"]').dispatchEvent('click');
  assert.deepEqual(await record(), initial);
  assert.match(await page.locator('#modal').innerText(), /同级稀有上衣/); await close();
  await buy('bronzeChest'); await shot('owned-390');
  const bought = await record(); await page.reload(); await idle(); assert.deepEqual(await record(), bought); await bag();
  await open('bronzeChest'); await close();
  assert.equal(await page.locator('.codex-item[data-item="bronzeChest"]').count(), 0);
  for (let i = 0; i < 5; i++) { await buy('zongzi'); await open('zongzi'); await close(); }
  await page.locator('[data-fold="物品开启累计礼"] summary').click();
  const priorClaim = await player(); await click('activityClaim', '[data-id="zongzi5"]'); await close();
  assert.equal((await player()).items.bigZongzi, (priorClaim.items.bigZongzi || 0) + 1);
  await open('bigZongzi'); await close();
  const natural = await record(); await page.reload(); await idle(); assert.deepEqual(await record(), natural);
  assert.equal(natural.snapshot.player.lv, 1);
  console.log('PASS natural: fresh Lv1, actual daily virtual funds, mall purchase → bag owned items → 1 chest/5 zongzi/earned big zongzi opening, real rewards/history/claim/reload; no imported resources or replaced RNG.');

  console.log('BEGIN controlled fixture/RNG: full capacity, guaranteed equipment outcome, batch and busy boundaries.');
  const g = new Game(); g.start('包裹边界夹具', 'blademaster');
  g.p.items.bronzeChest = 10; g.p.items.zongzi = 10; g.p.items.bigZongzi = 10; g.p.items.treasureKey = 3;
  g.p.bag = Array.from({ length: BAG_LIMIT - 1 }, () => makeEquip('head', 1, 0, g.p.cls));
  await importFixture(g.state); await bag();
  const capacity = await record();
  assert.ok(await button('activityOpen', '[data-id="bronzeChest"][data-count="10"]').isDisabled());
  await button('activityOpen', '[data-id="bronzeChest"][data-count="10"]').dispatchEvent('click');
  assert.deepEqual(await record(), capacity);
  await page.evaluate(() => { window.__originalRandom = Math.random; Math.random = () => .999; });
  const equipment = await open('bronzeChest');
  await page.evaluate(() => { Math.random = window.__originalRandom; delete window.__originalRandom; });
  assert.equal(equipment.bag.length, BAG_LIMIT); assert.equal(equipment.drawHistory.at(-1).prizeId, 'bcEquip');
  await shot('actual-equipment-390'); await close();
  assert.ok(await button('activityOpen', '[data-id="bronzeChest"][data-count="1"]').isDisabled());
  assert.ok(!await button('activityOpen', '[data-id="zongzi"][data-count="10"]').isDisabled());
  await open('zongzi', 10); await shot('batch-390'); await close();
  assert.equal(await page.locator('.codex-item[data-item="zongzi"]').count(), 0);
  const settled = await record(); await page.reload(); await idle(); assert.deepEqual(await record(), settled);
  await bag();
  for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 844 }); await layout(); await shot(`owned-${width}`); }
  await nav('activities');
  assert.equal(await page.locator('.economy-history article').count(), 0, 'Chest results must not leak into secret treasure history');
  assert.equal(await page.locator('.treasure-page .delivery-showcase').count(), 0);
  const busy = new Game(structuredClone(settled.snapshot)); busy.travel('h_f1'); busy.hunt(0);
  await importFixture(busy.state); await bag();
  const beforeDisabled = await record();
  const opening = page.locator('.page [data-action="activityOpen"]');
  assert.ok(await opening.count());
  assert.ok(await opening.evaluateAll(nodes => nodes.every(node => node.disabled)));
  await opening.first().dispatchEvent('click'); assert.deepEqual(await record(), beforeDisabled);
  await page.reload(); await idle(); assert.deepEqual(await record(), beforeDisabled);
  assert.deepEqual(errors, []);
  console.log(`PASS ${tag}: actual owned-only bag, no mall/treasure opening panels, insufficient items/capacity/busy no-charge, one equipment with exact saved UID, real 10-open batch at full equipment capacity, separate histories, 4 widths, persisted active battle; ${Object.keys(ITEMS).length} item definitions unchanged.`);
} finally { await context.close(); await browser.close(); }
