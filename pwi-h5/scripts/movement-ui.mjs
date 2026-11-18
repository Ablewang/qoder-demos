import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const base = process.env.GAME_URL || 'http://127.0.0.1:5183';
assert.match(base, /^http:\/\/127\.0\.0\.1:(5183|5176)$/, 'Use an isolated local preview');
const tag = new URL(base).port === '5176' ? 'production' : 'development';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
const page = await context.newPage();
const errors = [], external = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== base) external.push(request.url()); });
const idle = () => page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
const button = (action, attrs = '') => page.locator(`[data-action="${action}"]${attrs}`).filter({ visible: true }).first();
const click = async (action, attrs = '') => { await button(action, attrs).click(); await idle(); };
const position = () => page.locator('[data-scene-navigation]').evaluate(node => ({ x: Number(node.dataset.x), z: Number(node.dataset.z), moving: node.dataset.moving === 'true', enabled: node.dataset.enabled === 'true', distance: node.dataset.distance === '' ? null : Number(node.dataset.distance), targetId: node.dataset.targetId }));
const displaced = (origin, minimum = .2, timeout = 10000) => page.waitForFunction(({ origin, minimum }) => { const node = document.querySelector('[data-scene-navigation]'); return node && Math.hypot(Number(node.dataset.x) - origin.x, Number(node.dataset.z) - origin.z) > minimum; }, { origin, minimum }, { timeout });
const stationary = () => page.waitForFunction(() => document.querySelector('[data-scene-navigation]')?.dataset.moving === 'false');
const record = (target = page) => target.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('pwi-text-backend');
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result, tx = db.transaction(['saves', 'requests'], 'readonly');
    const save = tx.objectStore('saves').get('current'), receipts = tx.objectStore('requests').count();
    tx.oncomplete = () => { db.close(); resolve({ save: save.result, receipts: receipts.result }); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  };
}));
const frames = count => page.evaluate(count => new Promise(resolve => { const next = () => --count <= 0 ? resolve() : requestAnimationFrame(next); requestAnimationFrame(next); }), count);
const shot = async name => { await page.evaluate(() => document.fonts.ready); await frames(2); await page.screenshot({ path: `artifacts/movement-${tag}-${name}.png`, fullPage: false, animations: 'disabled' }); };
async function check(name, work) { await work(); checks.push(name); console.log(`PASS ${name}`); }
async function overflow() { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
async function keyWalk(key, minimum = .3) {
  const origin = await position();
  await page.locator('#world-scene-host canvas').focus(); await page.keyboard.down(key);
  try { await displaced(origin, minimum); }
  finally { await page.keyboard.up(key); }
  await stationary(); return [origin, await position()];
}
try {
  await page.goto(base); await page.locator('#char-name').fill('行走验收');
  await click('race', '[data-id="elf"]'); await click('class', '[data-id="cleric"]');
  await page.getByRole('button', { name: '进入完美大陆' }).click(); await idle();
  await check('keyboard moves actual coordinates; release stops without touching the save', async () => {
    const before = await record();
    assert.equal((await position()).enabled, true);
    for (const key of ['d', 'a', 'ArrowUp', 'ArrowDown']) await keyWalk(key, .6);
    const stopped = await position(); await frames(12);
    const after = await position(); assert.ok(Math.hypot(after.x - stopped.x, after.z - stopped.z) < .02);
    assert.deepEqual(await record(), before); await shot('city-follow');
  });
  await check('clickable terrain starts walking; Escape cancels without a battle', async () => {
    const before = await record(); const canvas = page.locator('#world-scene-host canvas');
    const box = await canvas.boundingBox(); let moved = false;
    for (const [x, y] of [[.7, .65], [.25, .68], [.6, .78], [.4, .6]]) {
      const origin = await position();
      await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
      try { await displaced(origin, .15, 2500); moved = true; break; } catch { await click('sceneStop'); }
    }
    assert.equal(moved, true, 'A real ground click must cause displacement');
    await canvas.focus(); await page.keyboard.press('Escape'); await stationary();
    assert.deepEqual(await record(), before);
  });
  await check('overview and camera drag change the view, not coordinates or the save', async () => {
    await click('sceneStop'); const before = await record(), origin = await position();
    await click('sceneOverview'); assert.equal(await page.locator('[data-scene-navigation]').getAttribute('data-overview'), 'true');
    await shot('city-overview');
    const canvas = page.locator('#world-scene-host canvas'), box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * .45, box.y + box.height * .6); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .62, box.y + box.height * .6, { steps: 10 }); await page.mouse.up();
    const after = await position(); assert.ok(Math.hypot(after.x - origin.x, after.z - origin.z) < .02);
    assert.deepEqual(await record(), before); await click('sceneOverview');
  });
  await check('mobile held touch controls move and release at 390 and 320px', async () => {
    const before = await record(); const cdp = await context.newCDPSession(page);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('.world-scene').evaluate(node => node.scrollIntoView({ block: 'start' }));
      await overflow(); const pad = page.locator('[data-direction="right"]');
      await pad.scrollIntoViewIfNeeded(); const box = await pad.boundingBox(), origin = await position();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
      try { await displaced(origin, .25); }
      finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
      await stationary(); await shot(`controls-${width}`);
    }
    await cdp.detach(); assert.deepEqual(await record(), before);
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.evaluate(() => scrollTo(0, 0));
  });
  await check('opening a modal locks movement and does not move or mutate a save', async () => {
    const origin = await position(), before = await record(); await click('map');
    assert.equal((await position()).enabled, false);
    await page.locator('#world-scene-host canvas').focus(); await page.keyboard.down('w'); await frames(10); await page.keyboard.up('w');
    const after = await position(); assert.ok(Math.hypot(after.x - origin.x, after.z - origin.z) < .02);
    assert.deepEqual(await record(), before); await click('closeModal'); assert.equal((await position()).enabled, true);
  });
  await click('navigate'); assert.equal((await record()).save.snapshot.player.location, 'e_f1');
  await click('claim', '[data-bounty="false"]');
  await check('field target selection stays pure and approaching a boss can be cancelled', async () => {
    assert.equal(await page.locator('.scene-mob').count(), 6);
    await click('fieldTarget', '[data-index="5"]'); const before = await record();
    assert.ok((await position()).distance > 2.3);
    await button('hunt', '[data-index="5"]').click();
    await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'true');
    await displaced(await position(), .15);
    assert.equal((await record()).save.snapshot.battle, null);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('scene-target', { detail: { id: 'field-0' } })));
    await idle(); assert.deepEqual(await record(), before, 'Changing the scene target cancels the old challenge');
    assert.equal(await page.locator('.scene-mob.selected').getAttribute('data-index'), '0');
    await click('fieldTarget', '[data-index="5"]');
    await button('hunt', '[data-index="5"]').click();
    await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'true');
    await displaced(await position(), .15);
    await click('sceneStop'); await stationary(); assert.deepEqual(await record(), before);
    await shot('field-follow'); await click('sceneOverview'); await shot('field-overview'); await click('sceneOverview');
  });
  await check('walk-near challenge submits once; battle movement cannot advance a round', async () => {
    await click('fieldTarget', '[data-index="0"]'); const before = await record();
    await page.locator('#world-scene-host canvas').focus(); await page.keyboard.press('e');
    assert.deepEqual(await record(), before, 'Distant E interaction must not begin a battle');
    await click('sceneApproach');
    assert.deepEqual(await record(), before, 'Walking near a monster alone must not begin a battle');
    assert.ok((await position()).distance <= 2.3);
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'CANVAS');
    await page.keyboard.press('e');
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('scene-engage', { detail: { id: 'field-0' } })));
    await idle(); const battle = await record();
    assert.ok(battle.save.snapshot.battle && !battle.save.snapshot.battle.result);
    assert.equal(battle.receipts, before.receipts + 1, 'Approach must produce exactly one hunt receipt');
    assert.equal(battle.save.snapshot.battle.round, 0);
    await page.locator('#world-scene-host canvas').focus(); await page.keyboard.down('d'); await frames(12); await page.keyboard.up('d'); await page.keyboard.press('e');
    assert.deepEqual(await record(), battle, 'No free attacks or turns from movement');
    await shot('near-battle');
    await page.reload(); await idle(); assert.deepEqual(await record(), battle, 'Reload preserves the actual battle');
    await page.locator('[data-action="turn"].recommended:not(:disabled)').first().click(); await idle();
    assert.equal((await record()).save.snapshot.battle.round, 1);
    for (let round = 0; round < 50; round++) {
      if ((await record()).save.snapshot.battle.result) break;
      await page.locator('[data-action="turn"].recommended:not(:disabled)').first().click(); await idle();
    }
    assert.equal((await record()).save.snapshot.battle.result, 'win');
    await click('leaveBattle'); assert.equal((await position()).enabled, true);
  });
  await check('context loss cancels approaching without committing and restores controls', async () => {
    await click('fieldTarget', '[data-index="5"]');
    if ((await position()).distance <= 2.3) await keyWalk('a', 2);
    const before = await record(); await button('hunt', '[data-index="5"]').click();
    await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'true');
    await page.evaluate(() => { const canvas = document.querySelector('#world-scene-host canvas'); window.__movementLoss = canvas.getContext('webgl2').getExtension('WEBGL_lose_context'); window.__movementLoss.loseContext(); });
    await idle(); assert.deepEqual(await record(), before);
    await page.waitForFunction(() => document.querySelector('[data-scene-navigation]')?.hidden === true);
    await page.evaluate(() => window.__movementLoss.restoreContext());
    await page.waitForFunction(() => document.querySelector('[data-scene-navigation]')?.hidden === false);
    assert.equal((await position()).enabled, true);
  });
  await check('no-GPU fallback retains real travel and challenge commands', async () => {
    const fallback = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await fallback.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === 'webgl2' ? null : original.call(this, type, ...args); }; });
    const fp = await fallback.newPage(); fp.on('pageerror', error => errors.push(error.message));
    await fp.goto(base); await fp.locator('#char-name').fill('静态行走回退'); await fp.getByRole('button', { name: '进入完美大陆' }).click();
    await fp.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
    assert.equal(await fp.locator('#world-scene-host canvas').count(), 0);
    await fp.locator('[data-action="navigate"]').first().click(); await fp.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
    await fp.locator('.world-primary [data-action="hunt"]').click(); await fp.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
    assert.ok(await fp.locator('[data-action="turn"]').count()); await fallback.close();
  });
  await check('reduced motion still permits intentional movement and clean key release', async () => {
    const reduced = await browser.newContext({ viewport: { width: 1024, height: 900 }, reducedMotion: 'reduce' });
    const rp = await reduced.newPage(); rp.on('pageerror', error => errors.push(error.message));
    await rp.goto(base); await rp.locator('#char-name').fill('减弱动画行走'); await rp.getByRole('button', { name: '进入完美大陆' }).click();
    await rp.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
    const before = await record(rp), origin = await rp.locator('[data-scene-navigation]').evaluate(node => ({ x: Number(node.dataset.x), z: Number(node.dataset.z) }));
    await rp.locator('#world-scene-host canvas').focus(); await rp.keyboard.down('d');
    try { await rp.waitForFunction(origin => { const node = document.querySelector('[data-scene-navigation]'); return Math.hypot(Number(node.dataset.x) - origin.x, Number(node.dataset.z) - origin.z) > .3; }, origin); }
    finally { await rp.keyboard.up('d'); }
    await rp.waitForFunction(() => document.querySelector('[data-scene-navigation]')?.dataset.moving === 'false');
    assert.deepEqual(await record(rp), before); await reduced.close();
  });
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log(`SUMMARY ${tag}: ${checks.length} movement browser groups passed; actual coordinate movement and held touch, pure walking/cancellation, single near-hunt receipt, natural first victory, battle reload/lock, context loss and no-GPU fallback. Local coordinates are UI-only, not a continuous official world or real-time combat.`);
} finally { await context.close(); await browser.close(); }
