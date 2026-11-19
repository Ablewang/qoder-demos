import assert from 'node:assert/strict';

// Isolated UI fixtures exercise the running app, not campaign reachability.
// Never starts/stops Vite, uses a persistent profile, or writes screenshots/saves outside its context.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/wangyong/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true });
const results = [];

async function run(width) {
  const mobile = width !== 1440;
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const cdp = mobile ? await context.newCDPSession(page) : null;
  const activate = locator => mobile ? locator.tap() : locator.click();
  const item = uid => page.locator(`.item-grid[data-location="inventory"] [data-uid="${uid}"]`);
  const grid = page.locator('.item-grid[data-location="inventory"]');
  const actions = () => page.evaluate(() => window.__itemActions);
  const clearActions = () => page.evaluate(() => { window.__itemActions = []; });
  const snapshot = () => page.evaluate(() => {
    const { engine } = window.sanctuary;
    return { inventory: structuredClone(engine.state.player.inventory), equipment: structuredClone(engine.state.player.equipment), gold: engine.state.player.gold, source: engine.state.identifySource, panel: engine.state.panel };
  });
  async function fixture(panel = 'inventory', npcId = 'akara') {
    await page.evaluate(async ({ panel, npcId }) => {
      const { engine, ui } = window.sanctuary;
      const { createItem } = await import('/src/items.ts');
      ui.cancelItemDrag(); ui.closeItemPopup();
      const p = engine.state.player;
      const definitions = [['multi', 'qui', 0, 0], ['block', 'cap', 3, 0], ['potion', 'hp1', 6, 0], ['potion2', 'hp1', 6, 1], ['scroll', 'isc', 7, 0], ['book', 'ibk', 7, 1], ['unknown', 'cap', 8, 0], ['cube', 'box', 8, 5]];
      p.inventory = definitions.map(([uid, code, x, y]) => Object.assign(createItem(code, 20, () => .4), { uid, x, y, quantity: uid === 'book' ? 2 : 1, identified: uid !== 'unknown' }));
      p.stash = [Object.assign(createItem('cap', 1, () => .4), { uid: 'stash-item', x: 0, y: 0 })];
      p.gold = 100000; p.strength = 50; p.dead = false; engine.state.paused = false; engine.state.identifySource = null; engine.updateStats();
      if (panel === 'vendor') {
        const npc = engine.state.area.objects.find(o => o.npcId === npcId && o.regionId === 1);
        p.x = npc.x; p.y = npc.y; engine.dispatch({ type: 'interact', uid: npc.uid });
        if (npcId !== 'akara') engine.dispatch({ type: 'panel', panel: 'inventory' });
      } else if (panel === 'stash') {
        const stash = engine.state.area.objects.find(o => o.kind === 'stash' && o.regionId === 1);
        p.x = stash.x; p.y = stash.y; engine.dispatch({ type: 'interact', uid: stash.uid });
      } else if (engine.state.panel !== panel) engine.dispatch({ type: 'panel', panel });
      ui.update(engine.state); ui.selectItem(null); ui.invalidatePanel();
      window.__itemActions = [];
    }, { panel, npcId });
    if (panel === 'vendor' && mobile && npcId === 'akara') await activate(page.locator('[data-focus="trade-view:inventory"]'));
    await grid.waitFor({ state: 'visible' });
    await grid.evaluate(node => {
      node.scrollIntoView({ block: 'start' });
      const body = node.closest('.panel-body'), zone = body.querySelector('[data-sell-dropzone]');
      if (zone) body.scrollTop -= Math.max(0, zone.getBoundingClientRect().bottom + 4 - node.getBoundingClientRect().top);
    });
    await clearActions();
  }
  async function cell(x, y) {
    return grid.evaluate((node, { x, y }) => {
      const r = node.getBoundingClientRect(), unit = (r.width - 2) / 10;
      return { x: r.left + 1 + (x + .5) * unit, y: r.top + 1 + (y + .5) * unit };
    }, { x, y });
  }
  async function start(point, right = false) {
    if (mobile) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 21, x: point.x, y: point.y }] });
    else { await page.mouse.move(point.x, point.y); await page.mouse.down({ button: right ? 'right' : 'left' }); }
  }
  async function move(point) {
    if (mobile) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 21, x: point.x, y: point.y }] });
    else await page.mouse.move(point.x, point.y);
  }
  async function end(cancel = false, right = false) {
    if (mobile) await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
    else await page.mouse.up({ button: right ? 'right' : 'left' });
  }
  async function drag(from, to, check, cancellation) {
    await start(from);
    for (let step = 1; step <= 8; step++) {
      await move({ x: from.x + (to.x - from.x) * step / 8, y: from.y + (to.y - from.y) * step / 8 });
      await page.waitForTimeout(18);
    }
    await page.locator('.item-drag-ghost').waitFor();
    if (check) await check();
    if (cancellation === 'escape') await page.keyboard.press('Escape');
    if (cancellation === 'rebuild') await page.evaluate(() => window.sanctuary.ui.invalidatePanel());
    if (cancellation === 'lostcapture') await page.evaluate(() => { const drag = window.sanctuary.ui.drag; drag.node.releasePointerCapture(drag.id); });
    await end(cancellation === 'cancel');
    await page.locator('.item-drag-ghost').waitFor({ state: 'detached' });
    await page.waitForTimeout(80);
  }
  async function layout() {
    const geometry = await grid.evaluate(node => {
      const r = node.getBoundingClientRect(), parent = node.parentElement.getBoundingClientRect();
      const style = getComputedStyle(node);
      return { rows: style.getPropertyValue('--rows').trim(), columns: style.getPropertyValue('--columns').trim(), width: r.width, height: r.height, left: r.left, right: r.right, parentLeft: parent.left, parentRight: parent.right, viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, visiblePanels: [...document.querySelectorAll('.gothic-panel')].filter(n => n.getClientRects().length).map(n => { const b = n.getBoundingClientRect(); return [b.left, b.right, b.top, b.bottom]; }), screenHeight: innerHeight };
    });
    assert.equal(geometry.rows, '8'); assert.equal(geometry.columns, '10');
    assert.ok(Math.abs((geometry.height - 2) / (geometry.width - 2) - .8) < .01, 'all eight rows laid out');
    assert.ok(geometry.left >= geometry.parentLeft - 1 && geometry.right <= geometry.parentRight + 1, 'inventory has no horizontal clipping');
    assert.ok(geometry.documentWidth <= geometry.viewport, 'no document overflow');
    for (const [left, right, top, bottom] of geometry.visiblePanels) assert.ok(left >= 0 && right <= width && top >= 0 && bottom <= geometry.screenHeight, 'panels stay in viewport');
  }
  async function assertNoAccidentalActions() {
    assert.equal((await actions()).some(a => ['use-item', 'equip', 'unequip', 'identify', 'attack'].includes(a.type)), false, 'drag must never use/equip/identify/cast');
    assert.deepEqual(await page.evaluate(() => { const c = window.sanctuary.engine.control; return [c.left, c.right, c.move.x, c.move.y]; }), [false, false, 0, 0]);
  }
  try {
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.sanctuary, undefined, { timeout: 60000 });
    if (await page.getByRole('button', { name: '跳过动画', exact: true }).isVisible()) await activate(page.getByRole('button', { name: '跳过动画', exact: true }));
    await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.storageStatus !== 'loading');
    await activate(page.getByRole('button', { name: '新建角色', exact: true }));
    await activate(page.locator('[data-class="sor"]'));
    await page.locator('#hero-name').fill(`物品隔离回归${width}`);
    await activate(page.getByRole('button', { name: '开启旅程', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.screen === 'game' && window.sanctuary.engine.state.saved);
    await page.evaluate(() => {
      const { ui } = window.sanctuary, original = ui.dispatch;
      window.__itemActions = []; ui.dispatch = action => { window.__itemActions.push(structuredClone(action)); original(action); };
    });
    await fixture(); await layout();
    if (!mobile) {
      await item('multi').hover();
      await page.locator('.item-tooltip').waitFor({ state: 'visible' });
      assert.match(await page.locator('.item-tooltip').innerText(), /防御|耐久/);
      await page.mouse.move(12, 12); await page.locator('.item-tooltip').waitFor({ state: 'hidden' });
      await item('multi').focus(); await page.locator('.item-tooltip').waitFor({ state: 'visible' });
      await item('multi').evaluate(node => node.blur()); await page.locator('.item-tooltip').waitFor({ state: 'hidden' });
      await activate(item('multi'));
      assert.equal(await page.locator('.compact-item-detail .item-properties').isVisible(), false);
      const stable = await page.evaluate(() => { window.__gridNode = document.querySelector('.item-grid'); window.__panelNode = document.querySelector('.gothic-panel'); return document.querySelector('.panel-body').scrollTop; });
      await activate(item('multi'));
      assert.equal(await page.evaluate(() => window.__gridNode === document.querySelector('.item-grid') && window.__panelNode === document.querySelector('.gothic-panel')), true);
      assert.equal(await page.locator('.panel-body').evaluate(node => node.scrollTop), stable);
    } else {
      await activate(item('multi')); await page.locator('.item-popup').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.item-tooltip').isVisible(), false);
      assert.match(await page.locator('.item-popup .item-properties').innerText(), /防御/);
      const bounds = await page.locator('.item-popup').boundingBox(); assert.ok(bounds.x >= 8 && bounds.x + bounds.width <= width - 7 && bounds.y >= 8 && bounds.y + bounds.height <= (width === 320 ? 568 : 844) - 7);
      await activate(page.locator('.popup-close')); await page.locator('.item-popup').waitFor({ state: 'hidden' });
      await activate(item('multi')); await page.keyboard.press('Escape'); assert.equal(await page.locator('.item-popup').isVisible(), false); assert.equal((await snapshot()).panel, 'inventory');
      await activate(item('multi')); await page.touchscreen.tap(width - 4, 6); assert.equal(await page.locator('.item-popup').isVisible(), false);
      await activate(item('potion')); await activate(page.locator('.item-popup [data-focus="use:potion"]')); await page.locator('.item-popup').waitFor({ state: 'hidden' });
      assert.equal((await snapshot()).inventory.some(i => i.uid === 'potion'), false); assert.equal((await snapshot()).inventory.some(i => i.uid === 'potion2'), true);
      await activate(item('book')); await activate(page.locator('.item-popup [data-focus="use:book"]'));
      await page.locator('.compact-item-detail [data-focus="cancel-identify"]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.identify-prompt').count(), 0); assert.equal(await page.locator('.item-popup').isVisible(), false);
      assert.equal((await snapshot()).source, 'book');
      await page.keyboard.press('Escape'); assert.equal((await snapshot()).source, null); assert.equal(await page.locator('.item-popup').isVisible(), false);
      await activate(item('book')); await activate(page.locator('.item-popup [data-focus="use:book"]'));
      await activate(page.locator('.compact-item-detail').getByRole('button', { name: '取消鉴定', exact: true })); assert.equal((await snapshot()).source, null);
      await activate(item('unknown')); await activate(page.locator('.item-popup [data-focus="identify:unknown"]'));
      await page.waitForFunction(() => window.sanctuary.engine.state.player.inventory.find(i => i.uid === 'unknown').identified);
      await page.waitForFunction(() => !document.querySelector('.item-popup h3')?.textContent.includes('未鉴定'));
      assert.doesNotMatch(await page.locator('.item-popup h3').innerText(), /未鉴定/);
      await page.evaluate(() => { window.sanctuary.engine.state.player.inventory = window.sanctuary.engine.state.player.inventory.filter(i => i.uid !== 'unknown'); });
      await page.locator('.item-popup').waitFor({ state: 'hidden' });
      await fixture();
      await page.evaluate(() => { window.sanctuary.engine.state.player.inventory.find(i => i.uid === 'book').quantity = 0; });
      await activate(item('book')); await activate(page.locator('.item-popup [data-focus="use:book"]'));
      assert.equal((await snapshot()).source, null, 'empty book cannot begin identification');
      await activate(page.locator('.popup-close'));
      await fixture();
      const emptyCell = await cell(4, 6);
      assert.equal(await page.evaluate(point => getComputedStyle(document.elementFromPoint(point.x, point.y)).touchAction, emptyCell), 'auto', 'empty cells retain native scrolling');
      const scrollBody = page.locator('.panel-inventory .panel-body');
      const scrollBefore = await scrollBody.evaluate(node => node.scrollTop);
      await start(emptyCell);
      for (let step = 1; step <= 6; step++) { await move({ x: emptyCell.x, y: emptyCell.y + step * 12 }); await page.waitForTimeout(25); }
      await end();
      await page.waitForFunction(before => document.querySelector('.panel-inventory .panel-body').scrollTop < before, scrollBefore);
      assert.equal(await page.locator('.item-drag-ghost').count(), 0, 'blank touch pans rather than drags');
    }
    await fixture();
    const beforeMove = await snapshot();
    // Grab the second column/second row of a 2x3 item, preserving the cell anchor.
    await drag(await cell(1, 1), await cell(2, 5), async () => {
      assert.equal(await page.locator('.item-drop-preview.invalid').count(), 0);
      assert.equal(await page.locator('.item-drop-preview').count(), 1);
    });
    const moved = await snapshot();
    assert.deepEqual(moved.inventory.find(i => i.uid === 'multi'), { ...beforeMove.inventory.find(i => i.uid === 'multi'), x: 1, y: 4 });
    assert.deepEqual((await actions()).filter(a => a.type === 'move-item'), [{ type: 'move-item', uid: 'multi', x: 1, y: 4 }]);
    assert.equal(new Set(moved.inventory.map(i => i.uid)).size, moved.inventory.length);
    await assertNoAccidentalActions();
    for (const mode of ['overlap', 'edge', 'outside', 'escape', 'rebuild', 'lostcapture', ...(mobile ? ['cancel'] : [])]) {
      await fixture(); const before = await snapshot();
      const to = mode === 'overlap' ? await cell(4, 1) : mode === 'edge' ? await cell(2, 7) : mode === 'outside' ? { x: width - 2, y: 2 } : await cell(2, 5);
      await drag(await cell(1, 1), to, ['overlap', 'edge'].includes(mode) ? async () => assert.equal(await page.locator('.item-drop-preview.invalid').count(), 1) : null, mode);
      assert.deepEqual(await snapshot(), before, `${mode} leaves inventory and gold unchanged`);
      assert.equal((await actions()).filter(a => ['move-item', 'sell'].includes(a.type)).length, 0); await assertNoAccidentalActions();
    }
    await fixture(); const beforeScrollDrag = await snapshot();
    await drag(await cell(7, 0), await cell(7, 4));
    assert.equal((await snapshot()).source, null); assert.equal((await snapshot()).inventory.find(i => i.uid === 'scroll').quantity, beforeScrollDrag.inventory.find(i => i.uid === 'scroll').quantity); await assertNoAccidentalActions();
    if (!mobile) {
      await fixture(); await clearActions();
      await start(await cell(1, 1), true); await move(await cell(2, 5)); assert.equal(await page.locator('.item-drag-ghost').count(), 0); await end(false, true);
      await fixture(); await page.waitForTimeout(660); await item('multi').dblclick();
      await page.waitForFunction(() => window.sanctuary.engine.state.player.equipment.body?.uid === 'multi');
      await page.locator('.equipment-slot.slot-body .item-button').dblclick(); await item('multi').waitFor();
      await item('scroll').click({ button: 'right' }); assert.equal((await snapshot()).source, 'scroll'); await page.keyboard.press('Escape'); assert.equal((await snapshot()).source, null);
    }
    await fixture('vendor'); await layout();
    const equipped = page.locator('.equipment-slot.slot-weapon .item-button');
    await equipped.evaluate(node => node.scrollIntoView({ block: 'start' }));
    const equipmentBox = await equipped.boundingBox(), equipmentBefore = await snapshot();
    const equipmentSale = await page.locator('[data-sell-dropzone]').boundingBox(); await clearActions();
    await start({ x: equipmentBox.x + equipmentBox.width / 2, y: equipmentBox.y + equipmentBox.height / 2 });
    await move({ x: equipmentSale.x + equipmentSale.width / 2, y: equipmentSale.y + equipmentSale.height / 2 }); await end();
    assert.equal(await page.locator('.item-drag-ghost').count(), 0); assert.deepEqual(await snapshot(), equipmentBefore); assert.equal((await actions()).some(a => a.type === 'sell'), false);
    await fixture('vendor');
    const beforeSale = await snapshot();
    const destination = mobile ? page.locator('[data-sell-dropzone]') : page.locator('.panel-vendor .panel-header');
    const target = await destination.boundingBox();
    await drag(await cell(6, 0), { x: target.x + target.width / 2, y: target.y + target.height / 2 }, async () => assert.equal(await page.locator('.sell-drag-over').count(), 1));
    const sold = await snapshot();
    const expectedGold = Math.min(5000, Math.max(1, Math.floor(beforeSale.inventory.find(i => i.uid === 'potion').price / 4)));
    assert.equal(sold.gold - beforeSale.gold, expectedGold); assert.equal(sold.inventory.some(i => i.uid === 'potion'), false); assert.equal(sold.inventory.some(i => i.uid === 'potion2'), true); assert.equal(sold.panel, 'vendor');
    assert.deepEqual((await actions()).filter(a => a.type === 'sell'), [{ type: 'sell', uid: 'potion' }]); await assertNoAccidentalActions();
    if (mobile) {
      await activate(item('potion2')); await activate(page.locator('.item-popup').getByRole('button', { name: '出售', exact: true })); await page.locator('.item-popup').waitFor({ state: 'hidden' });
    } else {
      await activate(item('potion2')); await activate(page.locator('.item-detail[data-owner="inventory"]').getByRole('button', { name: '出售', exact: true }));
    }
    assert.equal((await snapshot()).inventory.some(i => i.uid === 'potion2'), false);
    await fixture('vendor');
    if (mobile) await activate(page.locator('[data-focus="trade-view:vendor"]'));
    const offer = page.locator('.vendor-row').filter({ has: page.locator('[data-uid]') }).first();
    const offerUid = await offer.locator('.item-button').getAttribute('data-uid');
    const beforeBuy = await snapshot(); await activate(offer.locator('.small-button'));
    assert.ok((await snapshot()).gold < beforeBuy.gold); assert.equal((await actions()).filter(a => a.type === 'buy' && a.uid === offerUid).length, 1);
    if (mobile) await activate(page.locator('[data-focus="trade-view:vendor"]'));
    await clearActions();
    const vendorItem = page.locator('.vendor-row .item-button').first(), vendorBox = await vendorItem.boundingBox();
    await start({ x: vendorBox.x + vendorBox.width / 2, y: vendorBox.y + 20 }); await move({ x: vendorBox.x + 60, y: vendorBox.y + 80 }); await end();
    assert.equal(await page.locator('.item-drag-ghost').count(), 0); assert.equal((await actions()).filter(a => a.type === 'sell').length, 0);
    await fixture('stash'); await layout();
    const stashItem = page.locator('.item-grid[data-location="stash"] .item-button').first();
    await stashItem.evaluate(node => node.scrollIntoView({ block: 'start' })); const stashBox = await stashItem.boundingBox(); await clearActions();
    await start({ x: stashBox.x + 10, y: stashBox.y + 10 }); await move({ x: stashBox.x + 50, y: stashBox.y + 70 }); await end(); assert.equal((await actions()).some(a => a.type === 'sell'), false); assert.equal(await page.locator('.item-drag-ghost').count(), 0);
    await fixture('vendor', 'warriv'); assert.equal(await page.locator('[data-sell-dropzone]').count(), 0);
    const noTrade = await snapshot(); await drag(await cell(1, 1), { x: width - 2, y: 2 }); assert.deepEqual(await snapshot(), noTrade); assert.equal((await actions()).filter(a => a.type === 'sell').length, 0);
    if (mobile) {
      await fixture(); await activate(item('multi')); await page.evaluate(() => window.sanctuary.engine.dispatch({ type: 'panel', panel: 'character' })); await page.locator('.item-popup').waitFor({ state: 'hidden' });
      await fixture(); await activate(item('multi')); await page.evaluate(() => window.sanctuary.engine.dispatch({ type: 'title' })); await page.locator('.item-popup').waitFor({ state: 'hidden' });
    }
    assert.deepEqual(errors, [], `${width}px console/page errors`);
    results.push({ width, passed: true, coverage: `${mobile ? 'native tap, popup use/identify/cancel/empty source/removal, blank-grid panning' : 'native hover/focus, right-click use, double-click equip/unequip, stable selection'}, anchored drag, overlap/edge/outside/escape/lostcapture/rebuild${mobile ? '/pointercancel' : ''}, exactly-once sale, equipment/vendor/stash non-sale, no accidental use/equip/identify/cast, trade guard, 10x8 layout, zero console errors` });
  } finally { await context.close(); }
}

try { for (const width of [1440, 390, 320]) await run(width); console.log(JSON.stringify({ fixtureOnly: true, results }, null, 2)); }
finally { await browser.close(); }
