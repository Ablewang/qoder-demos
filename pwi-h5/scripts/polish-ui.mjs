import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { ITEMS } from '../src/data/items.js';
import { ZONES } from '../src/data/world.js';

const base = process.env.GAME_URL;
assert.match(base || '', /^http:\/\/(?:localhost|127\.0\.0\.1):517[67]$/, 'Use explicit isolated localhost/127.0.0.1 port 5177 or 5176 in a fresh Chrome context');
const tag = new URL(base).port === '5176' ? 'production' : 'development';
const out = fileURLToPath(new URL('../artifacts/', import.meta.url));
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext();
const page = await context.newPage();
await page.route('**/@vite/client', route => route.abort());
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const views = [{ width: 1440, height: 1000 }, { width: 768, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }];
const visible = (selector) => page.locator(selector).filter({ visible: true }).first();
async function idle() {
  await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function click(action, attrs = '', root = '') {
  await idle();
  await visible(`${root} [data-action="${action}"]${attrs}`.trim()).click();
  await idle();
}
async function navigate(id) {
  if (!await visible(`[data-action="page"][data-id="${id}"]`).count()) await page.locator('.mobile-nav-more > summary').click();
  await click('page', `[data-id="${id}"]`, ':is(.sidebar .nav, .mobile-nav)');
  await expect(page.locator('.shell')).toHaveAttribute('data-page', id);
}
async function record() {
  await idle();
  return page.evaluate(async () => {
    if (!(await indexedDB.databases()).some((db) => db.name === 'pwi-text-backend')) throw new Error('Missing initialized database');
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('pwi-text-backend');
      request.onupgradeneeded = () => { request.transaction.abort(); reject(new Error('Read-only inspection cannot create a database')); };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('saves', 'readonly');
        const get = tx.objectStore('saves').get('current');
        tx.oncomplete = () => { db.close(); resolve(get.result); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
  });
}
async function capture(name, selector) {
  for (const view of views) {
    await page.setViewportSize(view);
    await idle();
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
    const dimensions = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
    assert.ok(dimensions.content <= dimensions.width + 1, `${name} overflow ${JSON.stringify(dimensions)}`);
    assert.equal(await page.locator('vite-error-overlay').count(), 0);
    if (await page.locator('.shell').count() && view.width <= 760) {
      await expect(page.locator('.player-hud .hud-identity')).toBeVisible();
      assert.equal(await page.locator('.hud-vitals .bar').count(), 3);
      await expect(page.locator('.hud-vitals .bar.xp')).toBeVisible();
      assert.equal(await page.locator('.mobile-nav [data-action="page"]').count(), 10);
    }
    if (selector) {
      await visible(selector).scrollIntoViewIfNeeded();
      const box = await visible(selector).boundingBox();
      const nav = view.width <= 760 && await page.locator('.mobile-nav').count() ? await page.locator('.mobile-nav').boundingBox() : null;
      assert.ok(box && box.y >= 0 && box.y + box.height <= (nav?.y ?? view.height), `${name} primary control outside usable ${view.width}px viewport: ${JSON.stringify({ box, nav })}`);
    }
    await page.waitForFunction(() => !document.querySelector('#toast')?.classList.contains('show'));
    await page.screenshot({ path: `${out}polish-${tag}-${name}-${view.width}.png`, fullPage: false, animations: 'disabled' });
  }
  await page.setViewportSize(views[0]);
}
async function takeRecommendedTurn() {
  await idle();
  const action = visible('[data-action="turn"].recommended:not(:disabled)');
  await expect(action).toBeVisible();
  await action.click();
  await idle();
}
async function fight() {
  await click('hunt', '[data-index="0"]', '.world-primary');
  await expect(page.locator('.page-title')).toContainText('第1回合');
  await expect(page.locator('.intent')).toBeVisible();
  await expect(page.locator('.battle-advice')).toContainText('建议');
  const started = await record();
  await click('target');
  assert.deepEqual(await record(), started, 'Target selection must not advance a turn or write the save');
  for (let turn = 0; turn < 35 && !await page.locator('.battle-result').count(); turn++) await takeRecommendedTurn();
  await expect(page.locator('.battle-result')).toContainText('此战告捷');
  await click('leaveBattle');
}
try {
  await page.setViewportSize(views[0]);
  await page.goto(base);
  await expect(page.locator('#char-name')).toBeVisible();
  await capture('create', '.class-option');
  await page.locator('#char-name').fill('青岚<旅>');
  await page.getByRole('button', { name: '进入完美大陆' }).click();
  await idle();
  const initial = await record();
  assert.equal(initial.snapshot.player.lv, 1);
  await expect(page.locator('.journey-focus')).toContainText(`前往${ZONES.h_f1.name}`);
  await capture('city', '.journey-focus .primary');
  for (const id of ['quests', 'character', 'bag', 'skills', 'cult', 'town', 'mall', 'activities', 'guide']) {
    await navigate(id);
    if (id === 'bag') {
      assert.equal(await page.locator('.page .equip-slot').count(), 11);
      await click('bagTab', '[data-id="catalog"]');
      assert.equal(await page.locator('#codex-results .codex-item').count(), Object.keys(ITEMS).length);
      await click('bagTab', '[data-id="equipment"]');
    }
    if (id === 'town') {
      await click('townTab', '[data-id="forge"]');
      for (const selector of ['#production-series', '#forge-slot', '#production-recipe']) await expect(page.locator(selector)).toBeVisible();
      await expect(page.locator('[data-action="produceConfirm"]')).toBeDisabled();
      await expect(page.locator('.production-status')).toContainText('缺材料');
    }
    if (id === 'activities') {
      await expect(page.locator('.treasure-controls')).toBeVisible();
      assert.equal(await page.locator('.orbit-prize').count(), 36);
    }
    await capture(id, id === 'activities' ? '.draw-actions [data-count="10"]' : undefined);
    assert.deepEqual(await record(), initial, `Browsing ${id} changed the persisted save`);
  }
  assert.equal(await page.locator('旅').count(), 0, 'Character name must remain text');
  await navigate('world');
  await click('navigate', '[data-id="h_f1"]', '.journey-focus');
  assert.equal((await record()).snapshot.player.location, 'h_f1');
  await capture('field', '.world-primary [data-action="hunt"]');
  await click('claim', '[data-bounty="false"]', '.journey-focus');
  assert.equal((await record()).snapshot.player.mainIndex, 1);
  await expect(page.locator('.journey-focus')).toContainText('击败小野猪');
  await click('hunt', '[data-index="0"]', '.world-primary');
  await expect(page.locator('.battle-advice')).toBeVisible();
  await capture('battle', '[data-action="turn"].recommended');
  for (let turn = 0; turn < 35 && !await page.locator('.battle-result').count(); turn++) await takeRecommendedTurn();
  await expect(page.locator('.battle-result')).toContainText('此战告捷');
  await click('leaveBattle');
  for (let battle = 0; battle < 6 && (await record()).snapshot.player.lv < 2; battle++) await fight();
  assert.ok((await record()).snapshot.player.lv >= 2);
  await capture('ready', '.journey-focus .primary');
  const readyCheckpoint = await record();
  await page.locator('.world-detail').filter({ hasText: '采集与野外奇遇' }).locator('summary').click();
  await click('autoExplore');
  await expect(page.locator('#toast')).toContainText('任务目标已达成');
  await expect(page.locator('[data-action="autoExplore"]')).toHaveText('自动探索');
  assert.deepEqual(await record(), readyCheckpoint, 'Task-ready auto-stop must not explore or consume a turn');
  await click('claim', '[data-bounty="false"]', '.journey-focus');
  assert.equal((await record()).snapshot.player.mainIndex, 2);
  await expect(page.locator('.journey-focus')).toContainText('前往剑仙城');
  await navigate('character');
  await click('allocateAuto');
  assert.equal((await record()).snapshot.player.points, 0);
  const persisted = await record();
  await page.reload();
  await idle();
  assert.deepEqual(await record(), persisted, 'Refresh must preserve the natural progressed character');
  await expect(page.locator('.hud-identity')).toContainText('青岚<旅>');
  // Controlled encounter RNG only: all character resources/progression above are natural play.
  console.log('PASS natural-play checkpoint: Lv1→Lv2, main reward/kill objective, allocation and exact reload; BEGIN controlled encounter RNG (no imported save).');
  await page.locator('.world-detail').filter({ hasText: '采集与野外奇遇' }).locator('summary').click();
  await page.evaluate(() => { window.explorationRandom = Math.random; Math.random = () => 0.8; });
  try { await click('explore', '', '.explore-panel'); }
  finally { await page.evaluate(() => { Math.random = window.explorationRandom; delete window.explorationRandom; }); }
  await expect(visible('.encounter-head')).toContainText('游方道士');
  await capture('encounter', '.encounter-choice:not(:disabled)');
  const pendingEncounter = await record();
  await page.reload(); await idle();
  assert.deepEqual(await record(), pendingEncounter, 'Reload must preserve an unresolved encounter');
  await click('encounter', '[data-id="buy"]');
  const resolvedEncounter = await record();
  assert.equal(resolvedEncounter.snapshot.player.encounter, null);
  assert.equal(resolvedEncounter.snapshot.player.gold, pendingEncounter.snapshot.player.gold - 50 - pendingEncounter.snapshot.player.lv * 30);
  assert.equal(resolvedEncounter.snapshot.player.expBoost, pendingEncounter.snapshot.player.expBoost + 3);
  await click('travel', '[data-id="wanliu"]');
  assert.equal((await record()).snapshot.player.location, 'wanliu');
  assert.deepEqual(errors, []);
  console.log(`${tag}: PASS — natural Lv1 visit → first kill → Lv2 → task-ready auto-stop with no mutation → main reward → return objective → allocate → persisted reload; 15 screens × 4 widths, actual catalog count and production selectors/material gates, scroll-accessible controls and controlled-RNG encounter choice, pending encounter reload and exact resolution; no imported fixtures, browsing mutations or page/network errors.`);
} finally {
  await context.close();
  await browser.close();
}
