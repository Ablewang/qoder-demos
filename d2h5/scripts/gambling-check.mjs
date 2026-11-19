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
    const activate = locator => mobile ? locator.tap() : locator.click();
    const synchronized = () => page.waitForFunction(() => window.sanctuary.ui.panelSignature === window.sanctuary.ui.getPanelSignature());
    const snapshot = () => page.evaluate(() => {
      const s = window.sanctuary.engine.state;
      return { gold: s.player.gold, inventory: structuredClone(s.player.inventory), offers: structuredClone(s.gamblingOffers), selected: s.selectedItem, panel: s.panel, belt: structuredClone(s.player.belt), vendor: structuredClone(s.vendorItems) };
    });
    const card = uid => page.locator(`.gambling-slot[data-offer-uid="${uid}"]`);
    const buy = async uid => {
      await synchronized(); const target = card(uid).locator('.gambling-icon');
      await target.scrollIntoViewIfNeeded();
      if (mobile) await target.tap(); else await target.click({ button: 'right' });
      await synchronized();
    };
    const show = async view => { await activate(page.locator(`[data-focus="trade-view:${view}"]`)); await synchronized(); };
    const fixture = async (npcId = 'gheed') => {
      await page.evaluate(async npcId => {
        const { engine, ui } = window.sanctuary;
        const { createItem, placeItem } = await import('/src/items.ts');
        const { seededRandom } = await import('/src/engine.ts');
        ui.cancelItemDrag(); ui.closeItemPopup();
        const p = engine.state.player;
        p.inventory = []; p.gold = 1000000; p.level = 50; p.dead = false; p.weaponSwap = false; engine.state.paused = false;
        const old = createItem('hax', 50, seededRandom(66), 'rare'); placeItem(p.inventory, old, 10, 8);
        window.__oldGambleItem = structuredClone(old);
        const npc = engine.state.area.objects.find(o => o.npcId === npcId && o.regionId === 1);
        Object.assign(p, { x: npc.x, y: npc.y });
        engine.dispatch({ type: 'interact', uid: npc.uid }); engine.rng = seededRandom(11); engine.updateStats();
        ui.update(engine.state); ui.selectItem(null); ui.invalidatePanel();
      }, npcId);
      await synchronized();
    };
    try {
      await page.goto('http://127.0.0.1:5173');
      await page.waitForFunction(() => window.sanctuary?.engine.state.storageStatus === 'ready');
      if (await page.getByRole('button', { name: '跳过动画', exact: true }).isVisible()) await activate(page.getByRole('button', { name: '跳过动画', exact: true }));
      await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
      await activate(page.getByRole('button', { name: '新建角色', exact: true }));
      await activate(page.locator('[data-class="sor"]')); await page.locator('#hero-name').fill(`赌博隔离回归${width}`);
      await activate(page.getByRole('button', { name: '开启旅程', exact: true }));
      await page.waitForFunction(() => window.sanctuary.engine.state.screen === 'game' && window.sanctuary.engine.state.saved);
      for (const npcId of ['akara', 'charsi', 'gheed']) for (const bagState of ['hidden-tab', 'visible-tab', 'closed']) {
        await fixture(npcId);
        assert.equal((await snapshot()).panel, npcId === 'gheed' ? 'gamble' : 'vendor');
        if (bagState !== 'hidden-tab') await show('inventory');
        if (bagState === 'closed') {
          await activate(page.locator('[data-focus="trade-close:inventory"]')); await synchronized();
          assert.equal(await page.locator('.panel-inventory').count(), 0);
          assert.equal((await snapshot()).panel, npcId === 'gheed' ? 'gamble' : 'vendor');
        }
        await show('vendor'); const prior = await snapshot();
        await activate(page.locator('[data-focus="trade-close:vendor"]')); await synchronized();
        const closed = await snapshot();
        assert.equal(closed.panel, 'none'); assert.equal(closed.offers.length, 0);
        assert.deepEqual(closed.inventory, prior.inventory); assert.equal(closed.gold, prior.gold);
        assert.equal(await page.locator('.gothic-panel').count(), 0);
        assert.equal(await page.locator('.item-popup').isVisible(), false);
        assert.deepEqual(await page.evaluate(() => {
          const { engine, ui } = window.sanctuary, c = engine.control;
          return { tradeInventoryOpen: ui.tradeInventoryOpen, tradeView: ui.tradeView, hasPanel: document.querySelector('.game-shell').classList.contains('has-panel'), controls: [c.left, c.right, c.move.x, c.move.y] };
        }), { tradeInventoryOpen: false, tradeView: 'vendor', hasPanel: false, controls: [false, false, 0, 0] });
        await activate(page.locator('.quick-button[data-panel="inventory"]')); await synchronized();
        assert.equal((await snapshot()).panel, 'inventory');
        await activate(page.locator('.panel-inventory .close-button')); await synchronized();
        assert.equal((await snapshot()).panel, 'none');
      }
      if (mobile) await activate(page.locator('.touch-action.interact')); else await page.keyboard.press('KeyE');
      await synchronized(); assert.equal((await snapshot()).panel, 'gamble');
      await activate(page.locator('[data-focus="trade-close:vendor"]')); await synchronized();
      await page.screenshot({ path: `${output}74-trade-closed-${width}.png` });
      await fixture();
      let before = await snapshot(); assert.equal(before.panel, 'gamble'); assert.equal(before.offers.length, 14);
      assert.equal(before.offers[0].code, 'rin'); assert.equal(before.offers[1].code, 'amu');
      assert.equal(await page.locator('.gambling-slot').count(), 14);
      for (const offer of before.offers) {
        assert.equal(await card(offer.uid).locator('.item-properties').count(), 0);
        assert.equal(await card(offer.uid).locator('[class*="quality-"]').count(), 0);
        assert.ok(await card(offer.uid).locator('.gambling-icon').getAttribute('title').then(value => value.includes('品质未知')));
      }
      await page.locator('.gambling-stock img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      await page.screenshot({ path: `${output}73-gambling-default-${width}.png` });
      const uid = before.offers[0].uid; await buy(uid);
      let after = await snapshot(); assert.equal(after.gold, before.gold - 50000); assert.equal(after.inventory.length, before.inventory.length + 1);
      const purchased = after.inventory.find(item => item.uid === after.selected); assert.equal(purchased.identified, true);
      assert.deepEqual({ ...purchased, x: -1, y: -1 }, before.offers[0].item); assert.deepEqual(after.offers.slice(1), before.offers.slice(1));
      assert.notEqual(after.offers[0].uid, uid); assert.equal(after.offers[0].code, 'rin');
      await page.evaluate(uid => window.sanctuary.engine.dispatch({ type: 'gamble-buy', uid }), uid);
      assert.deepEqual(await snapshot(), after);
      await buy(after.offers[0].uid); after = await snapshot(); assert.equal(after.gold, before.gold - 100000);
      assert.equal(new Set(after.inventory.map(item => item.uid)).size, after.inventory.length);
      const lastUid = after.selected;
      await page.locator('.gambling-result').scrollIntoViewIfNeeded();
      if (mobile) {
        await activate(page.locator('.gambling-result .item-button')); await page.locator('.item-popup').waitFor({ state: 'visible' });
        assert.ok(await page.locator('.item-popup .item-properties').innerText()); await activate(page.locator('.popup-close'));
      } else {
        await page.locator('.gambling-result .item-button').hover(); await page.locator('.item-tooltip').waitFor({ state: 'visible' });
        assert.ok(await page.locator('.item-tooltip').innerText()); await page.mouse.move(5, 5);
      }
      await page.screenshot({ path: `${output}74-gambling-result-${width}.png` });
      before = await snapshot(); await activate(page.getByRole('button', { name: '刷新货物', exact: true })); await synchronized(); after = await snapshot();
      assert.equal(after.gold, before.gold); assert.deepEqual(after.inventory, before.inventory); assert.deepEqual(after.vendor, before.vendor); assert.deepEqual(after.belt, before.belt);
      assert.ok(after.offers.every(offer => !before.offers.some(old => old.uid === offer.uid)));
      await show('inventory'); assert.equal(await page.locator('.panel-inventory').isVisible(), true);
      await page.evaluate(() => { const { engine, ui } = window.sanctuary; ui.update(engine.state); });
      assert.equal(await page.locator('.panel-inventory').isVisible(), true);
      const owned = page.locator(`.panel-inventory .item-grid [data-focus="item:${lastUid}"]`); await owned.scrollIntoViewIfNeeded(); await activate(owned);
      const sale = mobile ? page.locator('.item-popup').getByRole('button', { name: '出售', exact: true }) : page.locator('.panel-inventory .item-actions').getByRole('button', { name: '出售', exact: true });
      assert.equal(await sale.isEnabled(), true); const gold = (await snapshot()).gold; await activate(sale); await synchronized();
      assert.ok(!(await snapshot()).inventory.some(item => item.uid === lastUid)); assert.ok((await snapshot()).gold > gold);
      if (await page.locator('.item-popup').isVisible()) await activate(page.locator('.popup-close'));
      await activate(page.locator('[data-focus="trade-close:inventory"]')); await synchronized();
      assert.equal(await page.locator('.panel-inventory').count(), 0); assert.equal((await snapshot()).panel, 'gamble');
      await show('inventory'); await show('vendor');
      await page.evaluate(async () => {
        const { engine, ui } = window.sanctuary; const { createItem, placeItem, insertSocket } = await import('/src/items.ts');
        const p = engine.state.player; p.level = 99;
        const charm = createItem('cm3', 99, () => .999, 'unique', "Gheed's Fortune"); charm.identified = true; placeItem(p.inventory, charm, 10, 8);
        const bow = createItem('sbw', 99, () => .5); bow.sockets = 3; placeItem(p.inventory, bow, 10, 8);
        for (const code of ['r03', 'r07', 'r11']) { const rune = createItem(code, 99, () => .5); placeItem(p.inventory, rune, 10, 8); insertSocket(p, bow.uid, rune.uid); }
        p.inventory.splice(p.inventory.indexOf(bow), 1); p.equipment.weapon = bow; engine.updateStats(); ui.update(engine.state);
      });
      await synchronized(); assert.match(await page.locator('.panel-vendor .gold-line').innerText(), /折扣 30%/);
      before = await snapshot(); assert.match(await card(before.offers[0].uid).locator('.small-button').innerText(), /35,000/); await buy(before.offers[0].uid);
      assert.equal((await snapshot()).gold, before.gold - 35000);
      for (const gate of ['gold', 'full', 'paused', 'dead', 'far']) {
        await page.evaluate(async gate => {
          const { engine, ui } = window.sanctuary; const p = engine.state.player;
          const npc = engine.state.area.objects.find(o => o.npcId === 'gheed' && o.regionId === 1);
          Object.assign(p, { x: npc.x, y: npc.y, gold: 1000000, dead: false }); engine.state.paused = false;
          if (gate === 'gold') p.gold = 0;
          if (gate === 'paused') engine.state.paused = true;
          if (gate === 'dead') p.dead = true;
          if (gate === 'far') p.x += 10;
          if (gate === 'full') {
            const { createItem } = await import('/src/items.ts'); p.inventory = [];
            for (let y = 0; y < 8; y++) for (let x = 0; x < 10; x++) p.inventory.push(Object.assign(createItem('rin', 1, () => .5), { x, y }));
          }
          engine.updateStats(); ui.update(engine.state);
        }, gate);
        await synchronized(); before = await snapshot();
        if (['gold', 'paused', 'dead'].includes(gate)) assert.equal(await card(before.offers[0].uid).locator('.gambling-icon').isEnabled(), false);
        else await buy(before.offers[0].uid);
        await page.evaluate(uid => window.sanctuary.engine.dispatch({ type: 'gamble-buy', uid }), before.offers[0].uid);
        assert.deepEqual(await snapshot(), before, `${gate} must not consume or refill`);
      }
      await fixture();
      await buy((await snapshot()).offers[0].uid);
      const geometry = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, panels: [...document.querySelectorAll('.gothic-panel')].filter(node => node.getClientRects().length).map(node => { const r = node.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; }) }));
      assert.ok(geometry.width <= geometry.viewport + 1); for (const [left, right, top, bottom] of geometry.panels) assert.ok(left >= 0 && right <= width + 1 && top >= 0 && bottom <= (mobile ? 844 : 900) + 1);
      const savedInventory = (await snapshot()).inventory;
      await page.evaluate(async () => { await window.sanctuary.engine.save(false); });
      const record = await page.evaluate(async () => {
        const id = window.sanctuary.engine.state.activeSaveId;
        const db = await new Promise(resolve => { const r = indexedDB.open('sanctuary-h5', 1); r.onsuccess = () => resolve(r.result); });
        const record = await new Promise(resolve => { const r = db.transaction('characters').objectStore('characters').get(id); r.onsuccess = () => resolve(r.result); }); db.close(); return record;
      });
      assert.equal(record.version, 1); assert.ok(!('gamblingOffers' in record.player)); assert.deepEqual(record.player.inventory, savedInventory);
      assert.deepEqual(record.player.inventory.find(item => item.uid === savedInventory[0].uid), await page.evaluate(() => window.__oldGambleItem));
      await fixture('charsi'); assert.equal(await page.getByRole('button', { name: '赌博', exact: true }).count(), 0);
      await fixture();
      await activate(page.getByRole('button', { name: '返回基德商店', exact: true })); await synchronized();
      assert.equal((await snapshot()).panel, 'vendor'); assert.equal((await snapshot()).offers.length, 0);
      await activate(page.getByRole('button', { name: '赌博', exact: true })); await synchronized();
      assert.equal((await snapshot()).panel, 'gamble'); assert.equal((await snapshot()).offers.length, 14);
      await activate(page.getByRole('button', { name: '返回基德商店', exact: true })); await synchronized();
      const ordinary = page.locator('.vendor-row[data-code="rvl"]'); await ordinary.scrollIntoViewIfNeeded();
      const priorGold = (await snapshot()).gold; await activate(ordinary.locator('.small-button')); assert.equal((await snapshot()).gold, priorGold - 1500);
      await page.reload(); await page.waitForFunction(() => window.sanctuary?.engine.state.storageStatus === 'ready');
      await page.evaluate(id => window.sanctuary.engine.dispatch({ type: 'continue', id }), record.id);
      await page.waitForFunction(() => window.sanctuary.engine.state.screen === 'game' && !window.sanctuary.engine.state.loadingSave);
      assert.equal((await snapshot()).offers.length, 0); assert.deepEqual((await snapshot()).inventory, savedInventory);
      assert.deepEqual(errors, []);
      results.push({ width, defaultGambling: true, nativeGheedInteraction: true, merchantCloseReturnsToScene: true, backpackCloseKeepsTrading: true, backpackCanReopen: true, unknownStock: true, immediateIdentify: true, refill: true, freeRefresh: true, discount: 30, sale: true, rejectionGuards: true, version: 1, errors: errors.length });
    } catch (error) {
      await page.screenshot({ path: `${output}gambling-failure-${width}.png` }); throw error;
    } finally { await context.close(); }
  }
  console.log(JSON.stringify({ isolatedContexts: true, fixturesNotCampaignProgress: true, results }, null, 2));
} finally { await browser.close(); }
