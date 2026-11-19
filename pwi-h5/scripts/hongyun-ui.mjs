import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { Game } from '../src/core/game.js';
import { validateSnapshot } from '../src/core/schema.js';

// 鸿运秘宝页面展示检查：隔离headless新上下文，只用5183开发或5176/5177静态构建，不访问5174。
const base = process.env.GAME_URL || 'http://127.0.0.1:5183';
assert.match(base, /^http:\/\/127\.0\.0\.1:(5183|5176|5177)$/, 'Use isolated 127.0.0.1 port 5183/5176/5177');
const tag = new URL(base).port === '5183' ? 'dev' : 'prod';
const out = (name) => new URL(`../artifacts/hongyun-v2-${name}-${tag}.png`, import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const errors = [];
const external = [];
const track = (page) => {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', (request) => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== base) external.push(request.url()); });
};
const viteClient = `
export const createHotContext = () => ({ accept() {}, prune() {}, dispose() {}, invalidate() {}, on() {}, off() {} });
export function updateStyle(id, content) { let el = [...document.querySelectorAll('style[data-vite-dev-id]')].find(el => el.dataset.viteDevId === id); if (!el) { el = document.createElement('style'); el.dataset.viteDevId = id; document.head.appendChild(el); } el.textContent = content; }
export function removeStyle(id) { [...document.querySelectorAll('style[data-vite-dev-id]')].find(el => el.dataset.viteDevId === id)?.remove(); }
`;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: viteClient }));
  const page = await context.newPage();
  track(page);
  const idle = () => page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
  const button = (action, attrs = '') => page.locator(`[data-action="${action}"]${attrs}`).filter({ visible: true }).first();
  async function click(action, attrs = '') {
    const target = button(action, attrs);
    if (action === 'page' && !await target.count()) await page.locator('.mobile-nav-more > summary').click();
    await target.click(); await idle();
  }
  const record = () => page.evaluate(async () => {
    if (!(await indexedDB.databases()).some((db) => db.name === 'pwi-text-backend')) throw new Error('Expected existing test save');
    return new Promise((resolve, reject) => {
    const request = indexedDB.open('pwi-text-backend');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('saves', 'readonly'), get = tx.objectStore('saves').get('current');
      tx.oncomplete = () => { db.close(); resolve(get.result); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
    });
  });
  const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
  // 浮层：role=tooltip、由 aria-describedby 关联、可见且完整处于视口（扣除移动端底栏）内。
  async function tipOf(p, trigger) {
    const id = await trigger.getAttribute('aria-describedby'); assert.ok(id, 'trigger has aria-describedby');
    const tip = p.locator(`#${id}`);
    await tip.waitFor({ state: 'visible', timeout: 3000 });
    assert.equal(await tip.getAttribute('role'), 'tooltip');
    const box = await tip.boundingBox(); const view = p.viewportSize();
    const navTop = await p.evaluate(() => { const nav = document.querySelector('.mobile-nav'); return nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : innerHeight; });
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= view.width + 0.5 && box.y + box.height <= Math.min(view.height, navTop) + 0.5, `tooltip inside viewport ${JSON.stringify(box)} / ${view.width}x${view.height}`);
    return tip;
  }
  const visibleTips = () => page.locator('[role="tooltip"]:visible').count();
  async function shot(name, full = true) {
    await page.waitForFunction(() => !document.querySelector('#toast.show'));
    await page.evaluate(async () => { await document.fonts.ready; });
    // 浮层是 fixed 定位，悬停截图只截当前视口，保证浮层与触发点同框。
    await page.screenshot({ path: out(name), fullPage: full && !(await page.locator('#modal:not(.hidden)').count()), animations: 'disabled' });
  }
  async function importFixture(snapshot) {
    validateSnapshot(snapshot);
    await click('page', '[data-id="guide"]');
    const chooser = page.waitForEvent('filechooser'); await click('importPicker');
    await (await chooser).setFiles({ name: 'hongyun-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(snapshot)) });
    await click('confirmModal');
  }

  await page.goto(base); await page.locator('#char-name').fill('鸿运展示');
  await page.getByRole('button', { name: '进入完美大陆' }).click(); await idle();
  const g = new Game(); g.start('鸿运展示夹具', 'blademaster'); g.p.items.treasureKey = 40;
  g.p.events.hongyun = { pity: 44, draws: 44 };
  await importFixture(g.state);
  await click('page', '[data-id="activities"]');

  // 浏览、切换页面、查看奖池均不写存档。
  const before = await record();
  for (const fold of await page.locator('.treasure-page details.economy-fold > summary').all()) await fold.click();
  await click('page', '[data-id="mall"]'); await click('page', '[data-id="activities"]');
  assert.deepEqual(await record(), before, 'Browsing Hongyun must not write the save');
  assert.equal(await page.locator('.orbit-prize').count(), 36);
  assert.equal(await page.locator('.sovereign-prize').count(), 3);
  assert.equal(await page.locator('.treasure-milestone').count(), 3);
  assert.equal(await page.locator('.treasure-page .treasure-to-mall').count(), 0);
  assert.equal(await page.locator('[data-action="treasureDraw"][data-count="1"]').count(), 1);
  assert.match(await page.locator('.treasure-page').innerText(), /非官方运营数据/);
  assert.match(await page.locator('.treasure-page').innerText(), /距保底还差\s*6\s*抽/);
  // v2：四档分层标题（档位色）+ 水位进度 + 三个阶礼节点。
  assert.deepEqual(await page.locator('[data-hy-tier]').evaluateAll((tiers) => tiers.map((tier) => tier.dataset.hyTier)), ['legendary', 'rare', 'uncommon', 'common']);
  const tierHeads = await page.locator('.hy-tier-head').evaluateAll((heads) => heads.map((head) => ({ text: head.innerText, color: getComputedStyle(head.querySelector('h3')).color })));
  assert.deepEqual(tierHeads.map((head) => head.text.match(/本档合计\s*([\d.]+%)/)?.[1]), ['8%', '20%', '25%', '47%'], JSON.stringify(tierHeads));
  assert.equal(new Set(tierHeads.map((head) => head.color)).size, 4, 'each tier title has its own color');
  assert.deepEqual(await page.locator('[data-hy-tier]').evaluateAll((tiers) => tiers.map((tier) => tier.querySelectorAll('.hy-cell').length)), [4, 9, 12, 11]);
  assert.equal(await page.locator('.hy-node').count(), 3);
  assert.equal(await page.locator('.hy-tube[role="progressbar"]').getAttribute('aria-valuenow'), '44');
  assert.deepEqual(await page.locator('.hy-node').evaluateAll((nodes) => nodes.map((node) => node.className.match(/is-(\w+)/)[1])), ['ready', 'locked', 'locked']);
  assert.equal(await page.locator('[data-hy-tip] [aria-describedby]').count(), 39, 'every node/item trigger is described by its tooltip');
  assert.equal(await visibleTips(), 0, 'tooltips hidden by default');

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.evaluate(() => window.scrollTo(0, 0)); await noOverflow();
    const controls = await page.locator('.treasure-controls').boundingBox();
    const oldHeight = { 1440: 411, 390: 457, 320: 499 }[width];
    assert.ok(controls.height <= oldHeight * 0.6, `${width}: controls must shrink by at least 40% (${controls.height} / ${oldHeight})`);
    const firstPrize = await page.locator('.hy-cell').first().boundingBox();
    const bottom = await page.evaluate(() => { const nav = document.querySelector('.mobile-nav'); return nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : innerHeight; });
    assert.ok(firstPrize.y + firstPrize.height <= bottom, `${width}: first prize fully visible before mobile nav (${firstPrize.y + firstPrize.height} <= ${bottom})`);
    for (const action of await page.locator('.draw-actions .btn, .key-status .hy-key-guide').all()) {
      const box = await action.boundingBox();
      assert.ok(box.height >= 44, `${width}: ${await action.innerText()} touch control must remain at least 44px (${box.height})`);
    }
    console.log('COMPACT', width, JSON.stringify({ oldHeight, controlsHeight: controls.height, poolTop: (await page.locator('.hy-pool').boundingBox()).y, firstPrizeBottom: firstPrize.y + firstPrize.height, viewportBottom: bottom }));
    await shot(`${width}-page`);
    await shot(`${width}-first-screen`, false);
    if (process.env.HY_MEASURE) console.log(width, JSON.stringify(await page.evaluate(() => Object.fromEntries(['.shop-masthead', '.economy-notice', '.treasure-palace', '.hy-stage', '.key-status', '.pity-status', '.draw-actions', '.mobile-nav'].map((s) => { const b = document.querySelector(s)?.getBoundingClientRect(); return [s, b && [Math.round(b.top), Math.round(b.bottom)]]; })))));
    if (width < 1000) {
      const draw = await page.locator('.draw-actions').boundingBox();
      const nav = await page.locator('.mobile-nav').boundingBox();
      assert.ok(draw.y + draw.height <= nav.y, `${width}: draw actions above mobile nav (${draw.y + draw.height} <= ${nav.y})`);
    } else {
      assert.ok((await page.locator('.treasure-progress').boundingBox()).x + (await page.locator('.treasure-progress').boundingBox()).width < (await page.locator('.treasure-palace').boundingBox()).x);
    }
    // 悬停节点：显示需求、奖励、状态与还差抽数；悬停物品：名称、类型、数量、单件概率、用途。
    const nodeButton = page.locator('.hy-node[data-milestone="draw50"] .hy-node-btn');
    await nodeButton.hover();
    const nodeTip = await tipOf(page, nodeButton);
    const nodeText = await nodeTip.innerText();
    for (const part of [/需求/, /累计开启 50 次/, /奖励/, /当前/, /44 \/ 50/, /还差 6 抽/]) assert.match(nodeText, part);
    assert.equal(await visibleTips(), 1);
    await noOverflow();
    await shot(`${width}-hover-node`, false);
    const cellButton = page.locator('.hy-cell[data-prize="hySovereign19"] .hy-cell-slot');
    await cellButton.hover();
    const cellTip = await tipOf(page, cellButton);
    const cellText = await cellTip.innerText();
    for (const part of [/类型/, /神铸装备/, /数量/, /单件概率/, /1%/, /穿戴需求/]) assert.match(cellText, part);
    assert.equal(await cellTip.locator('.hy-tip-title .equipment-name.item-color-red').count(), 1, 'tooltip name keeps quality color');
    assert.equal(await visibleTips(), 1, 'only one tooltip at a time');
    const stoneButton = page.locator('.hy-cell[data-prize="hyStone"] .hy-cell-slot');
    await stoneButton.hover();
    const stoneText = await (await tipOf(page, stoneButton)).innerText();
    for (const part of [/道具/, /×3/, /15%/]) assert.match(stoneText, part);
    await noOverflow();
    await shot(`${width}-hover-item`, false);
    await page.mouse.move(2, 2); await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[role="tooltip"]:not([hidden])'));
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const beforeDetails = await record();
  for (const [id, parts] of [
    ['hyCharmHp', [/黄金护身符/, /600,000/, /生命/]],
    ['hySocket', [/镶嵌石/, /×3/, /0.8%/, /开孔|打孔/]],
    ['hyGemPatk', [/2阶火红之石/, /物理攻击/, /0.8%/]],
    ['hyMount', [/踏露灵鹿/, /外观/, /1.25%/]],
    ['hyFlyer', [/纸鸢飞行器/, /30/, /1.25%/]],
  ]) {
    const trigger = page.locator(`.hy-cell[data-prize="${id}"] .hy-cell-slot`);
    await trigger.hover();
    const text = await (await tipOf(page, trigger)).innerText();
    for (const part of parts) assert.match(text, part, id);
  }
  assert.deepEqual(await record(), beforeDetails, 'new item and cosmetic tooltips only read');
  await page.mouse.move(2, 2); await page.keyboard.press('Escape');
  await click('walletModal');
  assert.match(await page.locator('#modal').innerText(), /元宝/);
  assert.deepEqual(await record(), beforeDetails, 'compact wallet entry only reads');
  await click('closeModal');
  // 键盘聚焦同样显示浮层，Esc 关闭。
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.hy-node[data-milestone="draw100"] .hy-node-btn').focus();
  assert.match(await (await tipOf(page, page.locator('.hy-node[data-milestone="draw100"] .hy-node-btn'))).innerText(), /还差 56 抽/);
  await page.keyboard.press('Escape');
  assert.equal(await visibleTips(), 0);
  // 未达成节点 aria-disabled，鼠标点击不提交领取。
  const beforeLocked = await record();
  await page.locator('.hy-node[data-milestone="draw50"] .hy-node-btn').click({ force: true }); // aria-disabled：Playwright 视为不可用，强制点击以验证不会提交
  await page.waitForTimeout(200);
  assert.deepEqual(await record(), beforeLocked, 'locked node click must not claim');
  assert.equal(await page.locator('#modal:not(.hidden)').count(), 0, 'locked node click opens nothing');

  // 触屏：首点显示浮层（不领取），点空白关闭；可领节点再点一次才领取。
  {
    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await touchContext.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: viteClient }));
    const tp = await touchContext.newPage();
    track(tp);
    const tIdle = () => tp.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
    const tRecord = () => tp.evaluate(async () => {
      if (!(await indexedDB.databases()).some((db) => db.name === 'pwi-text-backend')) throw new Error('Expected existing touch test save');
      return new Promise((resolve, reject) => {
      const request = indexedDB.open('pwi-text-backend');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { const db = request.result, tx = db.transaction('saves', 'readonly'), get = tx.objectStore('saves').get('current'); tx.oncomplete = () => { db.close(); resolve(get.result); }; tx.onabort = () => { db.close(); reject(tx.error); }; };
      });
    });
    const nav = async (id) => { const target = tp.locator(`[data-action="page"][data-id="${id}"]`).filter({ visible: true }).first(); if (!await target.count()) await tp.locator('.mobile-nav-more > summary').click(); await target.click(); await tIdle(); };
    await tp.goto(base); await tp.locator('#char-name').fill('鸿运触屏');
    await tp.getByRole('button', { name: '进入完美大陆' }).click(); await tIdle();
    validateSnapshot(g.state);
    await nav('guide');
    const chooser = tp.waitForEvent('filechooser'); await tp.locator('[data-action="importPicker"]').filter({ visible: true }).first().click();
    await (await chooser).setFiles({ name: 'hongyun-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(g.state)) });
    await tp.locator('[data-action="confirmModal"]').click(); await tIdle();
    await nav('activities');
    const locked = tp.locator('.hy-node[data-milestone="draw50"] .hy-node-btn');
    await locked.tap({ force: true }); // aria-disabled 节点仍可点按查看说明
    assert.match(await (await tipOf(tp, locked)).innerText(), /还差 6 抽/);
    await tp.locator('.hy-progress header h2').tap();
    await tp.waitForFunction(() => !document.querySelector('[role="tooltip"]:not([hidden])'));
    const ready = tp.locator('.hy-node[data-milestone="draw10"] .hy-node-btn');
    const beforeTap = await tRecord();
    await ready.tap();
    assert.match(await (await tipOf(tp, ready)).innerText(), /可领取/);
    await tp.waitForTimeout(200);
    assert.deepEqual(await tRecord(), beforeTap, 'first tap only shows the tooltip');
    await ready.tap(); await tIdle();
    await tp.locator('#modal:not(.hidden)').waitFor();
    const claimed = await tRecord();
    assert.notDeepEqual(claimed, beforeTap, 'second tap claims via the existing claim action');
    await tp.locator('[data-action="closeModal"]').filter({ visible: true }).first().click(); await tIdle();
    assert.equal(await tp.locator('.hy-node[data-milestone="draw10"].is-claimed').count(), 1);
    const cell = tp.locator('.hy-cell[data-prize="hyHeaven18"] .hy-cell-slot');
    await cell.tap();
    assert.match(await (await tipOf(tp, cell)).innerText(), /单件概率/);
    assert.equal(await tp.locator('#modal:not(.hidden)').count(), 0, 'first tap on item only shows details tooltip');
    assert.ok(await tp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await tp.screenshot({ path: out('390-tap-item'), animations: 'disabled' });
    await touchContext.close();
  }

  // 单抽：带requestId，结果来自后端，揭晓后可跳过。
  await page.setViewportSize({ width: 1440, height: 1000 });
  let state = (await record()).snapshot.player;
  await click('treasureDraw', '[data-count="1"]');
  await page.locator('#dialog-title').filter({ hasText: '鸿运揭晓' }).waitFor();
  assert.equal(await page.locator('#modal .real-prize').count(), 1);
  assert.equal(await page.locator('#modal .reward-line').count(), 1, 'summary must not reuse reward-line');
  let after = (await record()).snapshot.player;
  assert.equal(after.items.treasureKey, state.items.treasureKey - 1);
  assert.equal(after.events.hongyun.draws, state.events.hongyun.draws + 1);
  await page.waitForSelector('#modal .hy-reveal.is-done', { timeout: 10000 });
  assert.equal(await page.locator('#modal .hy-card.is-revealed').count(), 1, 'single draw revealed after animation');
  await shot('single-1440');
  await click('closeModal');

  // 十连：1440跳过动画，390完整播放，320模拟减少动态（立即全部显示）；摘要与后端记录一致。
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    if (width === 320) await page.emulateMedia({ reducedMotion: 'reduce' });
    state = (await record()).snapshot.player;
    await click('treasureDraw', '[data-count="10"]');
    await page.locator('#dialog-title').filter({ hasText: '鸿运揭晓' }).waitFor();
    if (width === 320) assert.equal(await page.locator('#modal .hy-reveal.is-done').count(), 1, 'reduced motion shows all at once');
    else if (width === 1440) {
      assert.equal(await page.locator('#modal .hy-reveal.is-done').count(), 0, 'animation runs by default');
      await page.locator('#modal [data-action="hySkip"]').click();
    }
    await page.waitForSelector('#modal .hy-reveal.is-done', { timeout: 15000 });
    assert.equal(await page.locator('#modal .real-prize').count(), 10);
    assert.equal(await page.locator('#modal .hy-card.is-revealed').count(), 10);
    after = (await record()).snapshot.player;
    assert.equal(after.items.treasureKey, state.items.treasureKey - 10);
    assert.equal(after.events.hongyun.draws, state.events.hongyun.draws + 10);
    const actual = after.drawHistory.slice(-10);
    const legendary = actual.filter((entry) => entry.rarity === 'legendary').length;
    assert.equal(Number(await page.locator('#modal .hy-summary [data-hy-tally="legendary"]').getAttribute('data-hy-count')), legendary);
    assert.equal(await page.locator('#modal .hy-summary').innerText().then((text) => text.includes(`${actual[0].pityBefore} → ${actual.at(-1).pityAfter}`)), true);
    await noOverflow();
    const card = await page.locator('.modal-card').boundingBox();
    assert.ok(card.x >= -1 && card.x + card.width <= width + 1);
    await shot(`ten-${width}`);
    await click('closeModal');
  }

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const checkpoint = await record();
  await page.reload(); await page.locator('.player-hud .hud-identity strong').waitFor(); await idle();
  assert.deepEqual(await record(), checkpoint, 'reveal rewards, consumed keys and counters survive reload');
  await click('page', '[data-id="activities"]');

  // 钥匙不足：禁用并引导去乾坤袋。
  const poor = (await record()).snapshot; poor.player.items.treasureKey = 0;
  await importFixture(poor);
  await click('page', '[data-id="activities"]');
  assert.ok(await page.locator('[data-action="treasureDraw"][data-count="1"]').isDisabled());
  assert.equal(await page.locator('.treasure-page .hy-key-guide').count(), 1);
  const beforeGuide = await record();
  await click('catalogGo', '.hy-key-guide');
  assert.match(await page.locator('#dialog-title').innerText(), /钥匙/);
  assert.deepEqual(await record(), beforeGuide, 'Key guide only navigates');
  await click('closeModal');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => scrollTo(0, 0)); await noOverflow();
    const first = await page.locator('.hy-cell').first().boundingBox();
    const nav = await page.locator('.mobile-nav').boundingBox();
    assert.ok(first.y + first.height <= nav.y, `${width}: zero-key first prize is fully visible`);
    await shot(`${width}-zero-key-first-screen`, false);
  }

  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(`PASS ${tag} Hongyun UI: browse no-write, 36-prize pool, pity text, 1-draw + 3×10-draw reveal (skip/full/reduced-motion) with backend-matching summary, key guide navigation-only, 4 tier headers, node/item hover+focus+touch tooltips in viewport, 1440/390/320 no overflow + hover screenshots, 0 page errors.`);
} finally { await browser.close(); }
