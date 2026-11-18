import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { getProductionRecipe } from '../src/data/production.js';
import { ZONES } from '../src/data/world.js';

const base = process.env.GAME_URL || 'http://127.0.0.1:5183';
assert.match(base, /^http:\/\/127\.0\.0\.1:(5183|5176)$/, 'Only isolated development or production previews are allowed');
const prefix = new URL(base).port === '5176' ? 'production-' : '';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  window.__glContexts = 0;
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    if (type === 'webgl2') window.__glContexts++;
    return original.call(this, type, ...args);
  };
});
const page = await context.newPage();
const errors = [], external = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== base) external.push(request.url()); });
const idle = () => page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
const button = (action, attrs = '') => page.locator(`[data-action="${action}"]${attrs}`).filter({ visible: true }).first();
async function click(action, attrs = '') { await button(action, attrs).click(); await idle(); }
async function nav(id) {
  if (!await button('page', `[data-id="${id}"]`).count()) await page.locator('.mobile-nav-more summary').click();
  await click('page', `[data-id="${id}"]`);
}
const close = () => click('closeModal');
const state = async () => {
  await idle();
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('pwi-text-backend');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('saves', 'readonly'), get = tx.objectStore('saves').get('current');
      tx.oncomplete = () => { db.close(); resolve(get.result.snapshot); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
};
async function check(name, work) { await work(); checks.push(name); console.log(`PASS ${name}`); }
async function shot(name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path: `artifacts/rebuild-${prefix}${name}.png`, fullPage: !/(320|390)$/.test(name), animations: 'disabled' });
}
async function layout() {
  const result = await page.evaluate(() => ({
    width: innerWidth, scroll: document.documentElement.scrollWidth,
    hudCount: document.querySelectorAll('.player-hud').length,
    pageCount: document.querySelectorAll('.page').length,
    overflow: [...document.querySelectorAll('.page *')].map(node => ({ node: `${node.tagName}.${node.className}`, right: node.getBoundingClientRect().right, left: node.getBoundingClientRect().left })).filter(box => box.right > innerWidth + 1 || box.left < -1).slice(0, 12),
  }));
  assert.ok(result.scroll <= result.width + 1, `Whole-page horizontal overflow: ${JSON.stringify(result)}`);
  assert.ok(result.hudCount <= 1 && result.pageCount <= 1, `Duplicate interface roots: ${JSON.stringify(result)}`);
}
async function fight() {
  await click('hunt', '[data-index="0"]');
  const starting = await state();
  await page.reload(); await idle();
  assert.deepEqual(await state(), starting, 'Reload must preserve the battle exactly');
  await shot('battle-desktop');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await layout(); await shot(`battle-${width}`);
    assert.ok(await page.locator('[data-action="turn"].recommended:not(:disabled)').filter({ visible: true }).count());
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (let round = 0; round < 50; round++) {
    if ((await state()).battle.result) break;
    await page.locator('[data-action="turn"].recommended:not(:disabled)').filter({ visible: true }).first().click();
    await idle();
  }
  assert.equal((await state()).battle.result, 'win');
}
try {
  await page.goto(base); await page.locator('#char-name').waitFor();
  await check('creation choices and empty-name rejection', async () => {
    await page.getByRole('button', { name: '进入完美大陆' }).click();
    assert.equal(await page.locator('.shell').count(), 0);
    for (const race of ['human', 'elf', 'untamed', 'tideborn', 'earthguard']) {
      await click('race', `[data-id="${race}"]`);
      assert.equal(await page.locator('.class-option').count(), 2);
      assert.equal(await page.locator('.creation-scene canvas').count(), 1);
      assert.equal(await page.locator('.creation-role h2').textContent(), await page.locator('.class-option.selected strong').textContent());
      await shot(`chibi-create-${race}`);
    }
    await click('race', '[data-id="elf"]'); await click('class', '[data-id="cleric"]');
    await shot('create-desktop');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await layout(); await shot(`create-${width}`);
      await page.locator('#char-name').scrollIntoViewIfNeeded();
      assert.ok(await page.getByRole('button', { name: '进入完美大陆' }).isVisible());
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#char-name').fill('新途验收');
    await page.getByRole('button', { name: '进入完美大陆' }).click(); await idle();
    const p = (await state()).player;
    assert.deepEqual(p.visits, []); assert.deepEqual(Object.keys(p.equipment), ['weapon']);
    assert.deepEqual(p.skills, { cl1: 1 });
  });
  await check('real 3D city and readable next action', async () => {
    assert.equal(await page.locator('#world-scene-host canvas').count(), 1);
    assert.match(await page.locator('[data-scene-status]').textContent(), /程序化 3D/);
    assert.equal(await page.locator('.player-hud .bar').count(), 3);
    assert.equal(await page.locator('.world-scene .scene-monsters').count(), 0, 'Targets must not cover the scenic canvas');
    assert.ok(await page.locator('.scene-landmark strong').textContent());
    const copy = await page.locator('.focus-copy').boundingBox(); assert.ok(copy.width > 180);
    await layout(); await shot('city-desktop');
    await click('navigate');
    assert.equal((await state()).player.location, 'e_f1');
    await click('claim', '[data-bounty="false"]');
    assert.equal((await state()).player.mainIndex, 1);
  });
  await check('landmark atlas, independent layers and pure route selection', async () => {
    const before = await state();
    await click('map');
    let total = 0;
    for (const layer of ['mainland', 'islands', 'otherworld']) {
      await click('atlasLayer', `[data-id="${layer}"]`);
      const markers = page.locator('.atlas-node');
      total += await markers.count();
      assert.equal(await markers.locator('.atlas-marker svg').count(), await markers.count());
      assert.ok(await markers.evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().width < 250)), 'Map nodes must not inherit full-width form-input styling');
      await markers.first().click(); await idle();
      assert.ok(await page.locator('.atlas-landmark strong').textContent());
      assert.match(await page.locator('.atlas-landmark').innerText(), /原创 Q 版意象/);
      await shot(`chibi-atlas-${layer}`);
    }
    assert.equal(total, Object.keys(ZONES).length);
    assert.deepEqual(await state(), before);
    await close();
  });
  await check('movement, target selection and drag do not advance or mutate a save', async () => {
    const before = await state(); const count = await page.evaluate(() => __glContexts);
    await click('fieldTarget', '[data-index="1"]');
    assert.deepEqual(await state(), before);
    assert.equal(await page.evaluate(() => __glContexts), count);
    const canvas = page.locator('#world-scene-host canvas');
    const origin = await page.locator('[data-scene-navigation]').evaluate(node => ({ x: Number(node.dataset.x), z: Number(node.dataset.z) }));
    await canvas.focus(); await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(origin => { const node = document.querySelector('[data-scene-navigation]'); return Math.hypot(Number(node.dataset.x) - origin.x, Number(node.dataset.z) - origin.z) > .2; }, origin);
    await page.keyboard.up('ArrowLeft'); await idle();
    assert.equal(await page.locator('.scene-mob.selected').getAttribute('data-index'), '1', 'Movement must not silently switch the target');
    await click('fieldTarget', '[data-index="0"]');
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .65, box.y + box.height * .5, { steps: 8 }); await page.mouse.up();
    assert.deepEqual(await state(), before);
    await click('fieldTarget', '[data-index="5"]'); await canvas.focus(); await page.keyboard.press('Space'); await idle();
    assert.equal(await page.locator('.scene-mob.selected').getAttribute('data-index'), '5', 'The selected boss must also exist in the rendered scene roster');
    assert.deepEqual(await state(), before); await shot('boss-target-desktop');
    await click('fieldTarget', '[data-index="0"]'); await shot('field-desktop');
  });
  await check('natural first battle, reload, rewards, homecoming and learning', async () => {
    await fight();
    assert.equal(await page.locator('.scene-header .scene-label').first().textContent(), '战斗已结束');
    assert.equal(await page.locator('.battle-result [data-action="explore"]').count(), 0, 'Victory must return to target selection instead of pushing random exploration');
    await shot('victory-desktop'); await click('leaveBattle');
    await click('claim', '[data-bounty="false"]'); assert.equal((await state()).player.mainIndex, 2);
    await click('navigate'); assert.equal((await state()).player.location, 'jiyu');
    await click('claim', '[data-bounty="false"]'); assert.equal((await state()).player.mainIndex, 3);
    assert.ok((await state()).player.bag.length > 0);
    await nav('character'); if ((await state()).player.points) await click('allocateAuto');
    await nav('bag'); await click('bagTab', '[data-id="equipment"]');
    const wearable = page.locator('.item-actions [data-action="equip"]:not(:disabled)').first();
    if (await wearable.count()) { await wearable.click(); await idle(); }
    await nav('skills'); await click('learn', '[data-id="cl2"]');
    assert.equal((await state()).player.skills.cl2, 1);
    await click('skillDetail', '[data-id="cl1"]');
    assert.match(await page.locator('#modal').innerText(), /教学免费解锁/); await close();
    await shot('skills-desktop');
  });
  await check('official records are pure and unknown is not fabricated', async () => {
    await nav('bag'); await click('bagTab', '[data-id="arsenal"]'); const before = await state();
    assert.match(await page.locator('#official-results').innerText(), /749/);
    await page.locator('#official-search').fill('亡骨刀');
    assert.equal(await page.locator('.official-table tbody tr').filter({ hasText: /^亡骨刀/ }).count(), 1);
    assert.match(await page.locator('.official-table tbody').innerText(), /未载/);
    await click('officialDetail');
    assert.match(await page.locator('#modal').innerText(), /秦天的刀刃5/);
    assert.match(await page.locator('#modal').innerText(), /基础攻击/); await close();
    await page.locator('#official-search').fill('');
    await page.locator('.official-filter-more summary').click();
    await page.locator('#official-minLv').fill('105'); await page.locator('#official-minLv').dispatchEvent('change');
    await page.locator('#official-includeUnknown').uncheck();
    assert.equal(await page.locator('.official-table tbody tr').count(), 5);
    await page.locator('#official-maxLv').fill('104'); await page.locator('#official-maxLv').dispatchEvent('change');
    assert.match(await page.locator('#official-results').innerText(), /最低穿戴等级/);
    await page.locator('#official-minLv').fill(''); await page.locator('#official-minLv').dispatchEvent('change');
    await page.locator('#official-maxLv').fill(''); await page.locator('#official-maxLv').dispatchEvent('change');
    await page.locator('#official-includeUnknown').check();
    await page.locator('.official-filter-more summary').click();
    assert.deepEqual(await state(), before); await shot('official-desktop');
    await click('bagTab', '[data-id="specs"]'); assert.match(await page.getByRole('heading', { name: '本作装备规格', exact: true }).textContent(), /本作装备规格/);
  });
  await check('natural root production deducts actual materials', async () => {
    const p = (await state()).player; const recipe = getProductionRecipe('ordinary-1-body', p.cls);
    assert.ok(Object.entries(recipe.materials).every(([id, qty]) => (p.items[id] || 0) >= qty), 'The earned starter materials must cover the root armor recipe');
    await nav('town'); await click('townTab', '[data-id="forge"]');
    await page.locator('#forge-slot').selectOption('body'); await idle();
    await page.locator('#production-recipe').selectOption('ordinary-1-body'); await idle();
    const before = await state(); await click('produceConfirm'); await click('confirmModal');
    const after = await state();
    assert.equal(after.player.bag.length, before.player.bag.length + 1);
    for (const [id, qty] of Object.entries(recipe.materials)) assert.equal(after.player.items[id], before.player.items[id] - qty);
    await close();
  });
  await check('virtual welfare, bought bag items, opening and hongyun', async () => {
    await nav('mall'); await click('walletDetail'); await click('walletDaily'); await close();
    await click('mallTab', '[data-id="all"]');
    for (const id of ['zongzi', 'goldChest']) {
      const before = (await state()).player;
      await click('mallBuy', `[data-id="${id}"][data-qty="1"]`);
      const bought = (await state()).player;
      assert.equal(bought.items[id], (before.items[id] || 0) + 1);
      assert.deepEqual(bought.drawHistory, before.drawHistory);
      await page.locator('#modal [data-action="bagOpenables"]').click(); await idle();
      await click('activityOpen', `[data-id="${id}"][data-count="1"]`);
      assert.equal((await state()).player.items[id] || 0, bought.items[id] - 1); await close();
      await nav('mall'); await click('mallTab', '[data-id="all"]');
    }
    await click('mallBuy', '[data-id="treasureKey"][data-qty="1"]'); await close();
    await nav('activities'); const before = (await state()).player;
    await click('treasureDraw', '[data-count="1"]'); await close();
    const after = (await state()).player; assert.equal(after.events.hongyun.draws, before.events.hongyun.draws + 1);
    assert.ok((await page.locator('.treasure-palace').boundingBox()).width > 600, 'Treasure prizes need the main column, not a narrow rail');
    assert.ok((await page.locator('.treasure-progress').boundingBox()).width < 400);
    await shot('hongyun-desktop');
    assert.equal(await page.locator('[data-action="activityOpen"]').count(), 0);
    await nav('mall'); await shot('mall-desktop');
  });
  await check('all ten pages across 1440 1024 768 390 and 320 pixels', async () => {
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
      for (const id of ['world', 'quests', 'character', 'bag', 'skills', 'cult', 'town', 'mall', 'activities', 'guide']) {
        await nav(id); await layout();
        if (['world', 'activities'].includes(id) && [390, 320].includes(width)) {
          await page.evaluate(() => scrollTo(0, 0));
          const action = page.locator(id === 'world' ? '.world-primary [data-action="navigate"]' : '.draw-actions').first();
          const box = await action.boundingBox(), navigation = await page.locator('.mobile-nav').boundingBox();
          assert.ok(box.y + box.height <= navigation.y, `${id}: primary action must be above the fixed mobile navigation`);
          await shot(`${id}-${width}`);
        }
      }
      await nav('bag'); await click('bagTab', '[data-id="arsenal"]'); await layout();
      if (width < 500) {
        await page.evaluate(() => scrollTo(0, 0));
        const first = await page.locator('.official-table tbody tr').first().boundingBox();
        const navigation = await page.locator('.mobile-nav').boundingBox();
        assert.ok(first.y + first.height <= navigation.y, 'At least one whole equipment row must be visible before the mobile navigation');
        await shot(`official-${width}`);
      }
    }
  });
  await check('wizard source costs and weapon restrictions are visible', async () => {
    const wizard = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const wp = await wizard.newPage();
    wp.on('pageerror', error => errors.push(error.message));
    wp.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== base) external.push(request.url()); });
    try {
      await wp.goto(base);
      await wp.locator('#char-name').fill('法师资源验收');
      await wp.locator('[data-action="class"][data-id="wizard"]').click();
      await wp.getByRole('button', { name: '进入完美大陆' }).click();
      await wp.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
      await wp.locator('.nav [data-action="page"][data-id="skills"]').click();
      const fire = wp.locator('.item-card').filter({ has: wp.locator('[data-action="learn"][data-id="wz1"]') });
      assert.match(await fire.innerText(), /真气 6 · 元气 0/);
      await wp.locator('[data-action="skillDetail"][data-id="wz1"]').click();
      assert.match(await wp.locator('#modal').innerText(), /空手；法器/);
      const resources = wp.locator('#modal table').first().locator('tbody tr');
      assert.equal(await resources.count(), 10);
      assert.match(await resources.nth(1).innerText(), /21.*源记录/s);
      await wp.screenshot({ path: `artifacts/rebuild-${prefix}wizard-source-cost.png`, fullPage: true, animations: 'disabled' });
    } finally { await wizard.close(); }
  });
  await check('WebGL context loss exposes fallback and restores cleanly', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 }); await nav('world');
    await page.evaluate(() => { const canvas = document.querySelector('canvas'); window.__lose = canvas.getContext('webgl2').getExtension('WEBGL_lose_context'); window.__lose.loseContext(); });
    await page.waitForFunction(() => document.querySelector('[data-scene-status]')?.textContent.includes('静态'));
    assert.ok(await page.locator('.scene-avatar').isVisible());
    await page.evaluate(() => window.__lose.restoreContext());
    await page.waitForFunction(() => document.querySelector('[data-scene-status]')?.textContent.includes('程序化'));
  });
  await check('unsupported GPU and reduced-motion still provide usable controls', async () => {
    const fallback = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await fallback.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === 'webgl2' ? null : original.call(this, type, ...args); }; });
    const fp = await fallback.newPage(); fp.on('pageerror', error => errors.push(error.message));
    await fp.goto(base); await fp.locator('#char-name').fill('降级验收'); await fp.getByRole('button', { name: '进入完美大陆' }).click();
    await fp.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
    assert.equal(await fp.locator('canvas').count(), 0); assert.ok(await fp.locator('.scene-avatar').isVisible());
    await fp.locator('[data-action="navigate"]').filter({ visible: true }).first().click();
    await fp.waitForFunction(() => document.querySelector('.world-primary')?.textContent.includes('挑战'));
    await fp.screenshot({ path: `artifacts/rebuild-${prefix}fallback-390.png`, fullPage: true }); await fallback.close();
  });
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log(`SUMMARY ${checks.length} reconstruction browser groups passed; no external requests or runtime errors. Natural onboarding and virtual welfare only; not 1→105.`);
  await writeFile(`artifacts/rebuild-${prefix}ui-result.json`, JSON.stringify({ checks, errors, external, scope: 'natural onboarding; source browsing; root production; virtual welfare/shop/bag/hongyun; 50 page-width checks; GPU fallback', natural105: false }, null, 2));
} catch (error) {
  await shot('failure'); console.error(error.stack); console.error(JSON.stringify({ errors, external, body: (await page.locator('body').innerText()).slice(-4500) })); process.exitCode = 1;
} finally { await context.close(); await browser.close(); }
