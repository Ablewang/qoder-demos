import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/game.js';
import { stats } from '../src/core/model.js';
import { makeEquip } from '../src/data/items.js';
import { matchesHighEquip } from '../src/data/high-equipment.js';
import { ITEM_COLOR_PALETTE } from '../src/data/item-colors.js';

const base = process.env.GAME_URL || 'http://127.0.0.1:5183';
assert.match(base, /^http:\/\/127\.0\.0\.1:(5176|5177|5183)$/, 'Use an isolated local preview');
const tag = new URL(base).port === '5176' ? 'production' : 'development';
const artifacts = new URL('../artifacts/', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const click = async (action, attrs = '') => {
  const target = page.locator(`[data-action="${action}"]${attrs}`).filter({ visible: true });
  if (action === 'page' && !await target.count()) await page.locator('.mobile-nav-more > summary').click();
  await target.first().click();
  await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
};
const record = () => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('pwi-text-backend');
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result; const tx = db.transaction('saves', 'readonly');
    const get = tx.objectStore('saves').get('current');
    tx.oncomplete = () => { db.close(); resolve(get.result); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  };
}));
async function importFixture(snapshot) {
  await click('page', '[data-id="guide"]');
  const chooser = page.waitForEvent('filechooser'); await click('importPicker');
  await (await chooser).setFiles({ name: 'high-ui-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(snapshot)) });
  await page.locator('#dialog-title').filter({ hasText: '导入存档' }).waitFor();
  await click('confirmModal');
  await page.waitForFunction(() => document.querySelector('#modal')?.classList.contains('hidden'));
  assert.deepEqual((await record()).snapshot.player, snapshot.player);
}
async function noOverflow() {
  const size = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth]);
  assert.ok(size[1] <= size[0] + 1, `Overflow at ${size[0]}px: ${size[1]}`);
}
async function red(locator) {
  const hex = ITEM_COLOR_PALETTE.red.slice(1);
  const rgb = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  assert.equal(await locator.evaluate((e) => getComputedStyle(e).color), `rgb(${rgb.join(', ')})`);
}
try {
  await page.goto(base); await page.locator('#char-name').fill('神铸界面验收');
  await page.getByRole('button', { name: '进入完美大陆' }).click();
  await page.locator('.player-hud .hud-identity strong').waitFor();
  const g = new Game(); g.start('神铸界面验收', 'blademaster');
  g.p.lv = 105; g.p.attrs = { str: 300, con: 185, dex: 50, mag: 5 }; g.p.gold = 1e7;
  g.p.bag = []; g.p.equipment = {}; g.p.items.highForgeSigil = 1000;
  g.p.items.treasureKey = 20; g.p.events.hongyun = { draws: 49, pity: 49 };
  g.p.wallet.yuanbao = 10000; g.p.hp = stats(g.p).hp; g.p.mp = stats(g.p).mp;
  await importFixture(g.state);
  await click('page', '[data-id="activities"]');
  assert.equal(await page.locator('.orbit-prize').count(), 36);
  assert.equal(await page.locator('.sovereign-prize').count(), 3);
  await red(page.locator('.sovereign-prize[data-prize="hySovereign19"] .hy-cell-name .equipment-name'));
  await click('highDetail', '[data-id="axe19c"]');
  assert.match(await page.locator('.modal-body').innerText(), /1,647—3,843/);
  assert.match(await page.locator('.modal-body').innerText(), /狂天神/);
  await red(page.locator('#modal h3 .equipment-name'));
  await click('highForgeTab');
  assert.equal(await page.locator('.high-forge-entry').count(), 5);
  const beforeCancel = await record(); await click('highCraft', '[data-id="axe19a"]');
  await page.locator('#dialog-title').filter({ hasText: '确认神铸打造' }).waitFor();
  await page.locator('.modal-actions [data-action="closeModal"]').click();
  assert.deepEqual(await record(), beforeCancel);
  await click('highCraft', '[data-id="axe19a"]'); await click('confirmModal');
  await page.locator('#dialog-title').filter({ hasText: '行囊装备详情' }).waitFor();
  const crafted = (await record()).snapshot; const it = crafted.player.bag[0];
  assert.ok(matchesHighEquip(it)); assert.equal(it.templateId, 'axe19a');
  assert.equal(crafted.player.items.highForgeSigil, 940); assert.equal(crafted.player.gold, g.p.gold - 60000);
  assert.equal(await page.locator('#modal [data-op="reroll"]').count(), 0);
  assert.equal(await page.locator('#modal [data-op="upgrade"]').count(), 0);
  await click('closeModal');
  it.refine = 7; it.durability = 321; it.sockets = ['gemPatk1', null];
  await importFixture(crafted);
  await click('page', '[data-id="bag"]'); await click('equipmentDetail', `[data-id="${it.uid}"]`);
  const beforeAscend = await record(); await click('highAscend', `[data-id="${it.uid}"]`);
  await page.locator('.modal-actions [data-action="closeModal"]').click();
  assert.deepEqual(await record(), beforeAscend);
  for (const next of ['axe19b', 'axe19c']) {
    await click('page', '[data-id="bag"]'); await click('equipmentDetail', `[data-id="${it.uid}"]`);
    await click('highAscend', `[data-id="${it.uid}"]`); await click('confirmModal');
    await page.locator('#dialog-title').filter({ hasText: '行囊装备详情' }).waitFor();
    const actual = (await record()).snapshot.player.bag.find((x) => x.uid === it.uid);
    assert.equal(actual.templateId, next); assert.equal(actual.refine, 7); assert.equal(actual.durability, 321);
    assert.deepEqual(actual.sockets, ['gemPatk1', null]); assert.ok(matchesHighEquip(actual));
    await click('closeModal');
  }
  await click('equip', `[data-id="${it.uid}"]`); await click('page', '[data-id="character"]');
  await red(page.locator('.equip-slot[data-id="weapon"] .equipment-name'));
  await click('page', '[data-id="activities"]');
  await page.evaluate(() => { window.testRandom = Math.random; Math.random = () => 0.7; });
  try { await click('treasureDraw', '[data-count="1"]'); await page.locator('#dialog-title').filter({ hasText: '鸿运揭晓' }).waitFor(); }
  finally { await page.evaluate(() => { Math.random = window.testRandom; delete window.testRandom; }); }
  const awarded = (await record()).snapshot;
  assert.equal(awarded.player.events.hongyun.draws, 50); assert.equal(awarded.player.events.hongyun.pity, 0);
  assert.equal(awarded.player.drawHistory.at(-1).prizeId, 'hySovereign19');
  assert.ok(matchesHighEquip(awarded.player.bag[0]));
  await red(page.locator('#modal .real-prize > strong .equipment-name'));
  await click('closeModal');
  await click('activityClaim', '[data-id="draw50"]');
  await page.locator('#dialog-title').waitFor(); await click('closeModal');
  assert.ok((await record()).snapshot.player.events.milestones.includes('draw50'));
  const checkpoint = await record(); await page.reload(); await page.locator('.player-hud .hud-identity strong').waitFor();
  assert.deepEqual(await record(), checkpoint);
  await click('page', '[data-id="activities"]');
  for (const width of [1440, 1080, 850, 761, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await noOverflow();
    if ([1440, 390, 320].includes(width)) {
      await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
      await page.screenshot({ path: `${artifacts}${tag}-high-${width}.png`, fullPage: true, animations: 'disabled' });
    }
  }
  const poor = checkpoint.snapshot; poor.player.items.highForgeSigil = 0; poor.player.gold = 0;
  await importFixture(poor); await click('page', '[data-id="town"]'); await click('townTab', '[data-id="high"]');
  assert.ok(await page.locator('[data-action="highCraft"][data-id="axe19a"]').isDisabled());
  poor.player.gold = 1e7; poor.player.items.highForgeSigil = 1000;
  poor.player.bag = Array.from({ length: 80 }, () => makeEquip('body', 1, 0, poor.player.cls));
  await importFixture(poor); await click('page', '[data-id="town"]'); await click('townTab', '[data-id="high"]');
  assert.ok(await page.locator('[data-action="highCraft"][data-id="axe19a"]').isDisabled());
  await click('page', '[data-id="activities"]');
  assert.ok(await page.locator('[data-action="treasureDraw"][data-count="1"]').isDisabled());
  assert.deepEqual(errors, []);
  console.log(`PASS ${tag} Chrome high UI: 36 prizes, red fixed names, five catalog details, craft/ascend cancellation, exact payment, stage preservation, equipped color, actual nineteen-grade pity delivery, cumulative claim, IndexedDB reload, poor/full-bag disabling, 1440/1080/850/761/390/320px. Imported mechanics fixtures, not natural progression.`);
} finally { await browser.close(); }
