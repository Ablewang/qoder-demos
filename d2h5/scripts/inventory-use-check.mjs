import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const output = new URL('../docs/screenshots/', import.meta.url).pathname;
assert.ok((await stat(output)).isDirectory());
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 390, 320]) {
    const mobile = width < 700;
    const context = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('http://127.0.0.1:5173');
    await page.waitForFunction(() => window.sanctuary?.engine.state.storageStatus === 'ready');
    const fixture = async (field = false) => page.evaluate(async field => {
      const { engine, ui } = window.sanctuary;
      if (engine.state.screen !== 'game') engine.dispatch({ type: 'new', classId: 'sor', name: '隔离物品回归' });
      const { createItem, placeItem, INVENTORY_WIDTH, INVENTORY_HEIGHT } = await import('/src/items.ts');
      const p = engine.state.player; p.inventory = []; p.gold = 1000000; p.dead = false;
      engine.enterArea(field ? 2 : 1); engine.state.area.monsters = [];
      const add = (key, code, quantity = 1) => {
        const item = createItem(code, 99, () => .5); item.quantity = quantity;
        placeItem(p.inventory, item, INVENTORY_WIDTH, INVENTORY_HEIGHT); return [key, item.uid];
      };
      const ids = Object.fromEntries([add('portalBook', 'tbk', 4), add('otherPortal', 'tbk', 12), add('portalScroll', 'tsc'), add('identifyBook', 'ibk', 3), add('otherIdentify', 'ibk', 9), add('identifyScroll', 'isc'), add('potion', 'rvl'), add('target', 'cm1'), add('second', 'cm1')]);
      for (const key of ['target', 'second']) { const item = p.inventory.find(item => item.uid === ids[key]); item.quality = 'magic'; item.identified = false; item.name = 'Jagged Small Charm of Strength'; }
      engine.state.panel = 'inventory'; engine.state.identifySource = null; engine.state.selectedItem = null;
      ui.update(engine.state);
      return { ...ids, belt: structuredClone(p.belt), saveId: engine.state.activeSaveId };
    }, field);
    const gridItem = uid => page.locator('.panel-inventory .grid-item').filter({ has: page.locator(`[data-focus="item:${uid}"]`) });
    const button = uid => page.locator(`.panel-inventory .item-grid [data-focus="item:${uid}"]`);
    const snapshot = () => page.evaluate(() => {
      const s = window.sanctuary.engine.state;
      return { inventory: structuredClone(s.player.inventory), belt: structuredClone(s.player.belt), life: s.player.life, mana: s.player.mana, caps: s.stats, source: s.identifySource, portals: s.area.objects.filter(object => object.kind === 'portal' && object.regionId === s.area.def.id), panel: s.panel };
    });
    const activate = locator => mobile ? locator.tap() : locator.click();
    const use = async uid => {
      await page.waitForFunction(() => { const ui = window.sanctuary.ui; return ui.panelSignature === ui.getPanelSignature(); });
      if (mobile && await page.locator('.item-popup').isVisible()) await activate(page.getByRole('button', { name: '关闭物品浮层', exact: true }));
      await button(uid).scrollIntoViewIfNeeded();
      if (!mobile) { await button(uid).click({ button: 'right' }); return; }
      await button(uid).tap();
      await activate(page.locator(`[data-focus="use:${uid}"]:visible`).last());
    };
    let ids = await fixture();
    for (const [uid, color] of [[ids.portalScroll, '#367ed8'], [ids.identifyScroll, '#c54139']]) {
      await button(uid).locator('img').evaluate(image => image.decode());
      const image = await button(uid).locator('img').evaluate(image => ({ src: image.src, width: image.naturalWidth }));
      assert.ok(image.width > 0); assert.ok(decodeURIComponent(image.src.split(',')[1]).includes(color));
    }
    await button(ids.portalScroll).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}57-scroll-colors-${width}.png` });
    const beforeTown = await snapshot(); await use(ids.portalBook);
    assert.deepEqual((await snapshot()).inventory, beforeTown.inventory, 'Town refusal must not consume the clicked book or its fallback');
    ids = await fixture(true);
    await use(ids.portalBook);
    let state = await snapshot();
    assert.equal(state.inventory.find(item => item.uid === ids.portalBook).quantity, 3);
    assert.equal(state.inventory.find(item => item.uid === ids.otherPortal).quantity, 12);
    assert.equal(state.portals.length, 1);
    await use(ids.portalScroll);
    state = await snapshot(); assert.equal(state.portals.length, 1);
    assert.ok(!state.inventory.some(item => item.uid === ids.portalScroll));
    assert.equal(state.inventory.find(item => item.uid === ids.portalBook).quantity, 3);
    assert.equal(state.inventory.find(item => item.uid === ids.otherPortal).quantity, 12);
    await use(ids.identifyBook);
    state = await snapshot(); assert.equal(state.source, ids.identifyBook);
    await page.waitForFunction(() => document.querySelector('.game-shell').classList.contains('is-identifying'));
    assert.equal(await page.locator('.identify-prompt').count(), 0);
    assert.match(await button(ids.target).evaluate(node => getComputedStyle(node).cursor), /data:image\/svg\+xml/);
    assert.equal(await page.locator('.item-popup').isVisible(), false);
    assert.equal(state.inventory.find(item => item.uid === ids.identifyBook).quantity, 3);
    await button(ids.target).scrollIntoViewIfNeeded(); await activate(button(ids.target));
    state = await snapshot(); assert.equal(state.source, null);
    assert.equal(state.inventory.find(item => item.uid === ids.target).identified, true);
    assert.equal(state.inventory.find(item => item.uid === ids.second).identified, false);
    assert.equal(state.inventory.find(item => item.uid === ids.identifyBook).quantity, 2);
    assert.equal(state.inventory.find(item => item.uid === ids.otherIdentify).quantity, 9);
    await page.waitForFunction(() => !document.querySelector('.game-shell').classList.contains('is-identifying'));
    assert.match(await page.locator('.message-log').innerText(), /鉴定成功：/);
    await use(ids.identifyScroll); await page.keyboard.press('Escape');
    state = await snapshot(); assert.equal(state.source, null); assert.equal(state.panel, 'inventory');
    assert.ok(state.inventory.some(item => item.uid === ids.identifyScroll));
    await use(ids.identifyBook);
    await activate(page.locator('[data-focus="cancel-identify"]:visible').last());
    state = await snapshot(); assert.equal(state.source, null); assert.equal(state.inventory.find(item => item.uid === ids.identifyBook).quantity, 2);
    await use(ids.identifyScroll);
    if (!mobile) {
      await button(ids.second).click({ button: 'right' });
      assert.equal((await snapshot()).source, null); assert.ok((await snapshot()).inventory.some(item => item.uid === ids.identifyScroll));
      await use(ids.identifyScroll);
    }
    await button(ids.second).scrollIntoViewIfNeeded();
    if (!mobile) {
      await button(ids.second).hover(); const position = await button(ids.second).boundingBox();
      await page.mouse.move(position.x + position.width / 2, position.y + position.height / 2);
      await page.mouse.down(); await page.mouse.move(position.x + position.width / 2 + 12, position.y + position.height / 2); await page.mouse.up();
    } else await activate(button(ids.second));
    state = await snapshot(); assert.equal(state.inventory.find(item => item.uid === ids.second).identified, true);
    assert.ok(!state.inventory.some(item => item.uid === ids.identifyScroll)); assert.equal(state.source, null);
    assert.equal(state.inventory.find(item => item.uid === ids.identifyBook).quantity, 2);
    assert.equal(await page.locator('.item-drag-ghost').count(), 0);
    assert.match(await page.locator('.message-log').innerText(), /鉴定成功：/);
    await page.screenshot({ path: `${output}58-identify-success-${width}.png` });
    await page.evaluate(() => { const s = window.sanctuary.engine.state; s.player.life = s.player.mana = 1; });
    await use(ids.potion); state = await snapshot();
    assert.ok(!state.inventory.some(item => item.uid === ids.potion));
    assert.equal(state.life, state.caps.maxLife); assert.equal(state.mana, state.caps.maxMana);
    assert.deepEqual(state.belt, ids.belt);
    ids = await fixture();
    await page.evaluate(uid => {
      const { engine, ui } = window.sanctuary;
      engine.state.player.inventory.find(item => item.uid === uid).quantity = 0;
      ui.update(engine.state);
    }, ids.portalBook);
    const empty = (await snapshot()).inventory; await use(ids.portalBook); assert.deepEqual((await snapshot()).inventory, empty);
    await button(ids.otherIdentify).scrollIntoViewIfNeeded();
    if (!mobile) {
      await button(ids.otherIdentify).hover();
      await page.locator('.item-tooltip').waitFor({ state: 'visible' });
      assert.match(await page.locator('.item-tooltip').innerText(), /鉴定之书/);
      await button(ids.otherIdentify).click();
      await page.locator(`[data-focus="use:${ids.otherIdentify}"]:visible`).last().focus(); await page.keyboard.press('Enter');
      assert.equal((await snapshot()).source, ids.otherIdentify); await page.keyboard.press('Escape');
    } else {
      await button(ids.otherIdentify).tap();
      assert.ok(await page.locator('[role="dialog"]:visible').count(), 'Touch selection must display an attribute overlay');
    }
    const geometry = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(geometry.width <= geometry.viewport + 1);
    await page.screenshot({ path: `${output}53-inventory-use-${width}.png` });
    await page.evaluate(async () => { await window.sanctuary.engine.save(false); });
    const saved = await page.evaluate(async id => {
      const db = await new Promise(resolve => { const request = indexedDB.open('sanctuary-h5', 1); request.onsuccess = () => resolve(request.result); });
      const record = await new Promise(resolve => { const request = db.transaction('characters').objectStore('characters').get(id); request.onsuccess = () => resolve(request.result); });
      db.close(); return record;
    }, ids.saveId);
    assert.equal(saved.version, 1); assert.ok(!('identifySource' in saved.player));
    assert.deepEqual(errors, []);
    results.push({ width, rightClick: !mobile, touchUse: mobile, exactSource: true, noBeltConsumption: true, identifyCancel: true, version: saved.version, errors: errors.length });
    await context.close();
  }
  console.log(JSON.stringify({ isolatedContexts: true, fixturesNotCampaignProgress: true, results }, null, 2));
} finally { await browser.close(); }
