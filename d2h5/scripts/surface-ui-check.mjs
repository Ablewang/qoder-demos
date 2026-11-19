import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ headless: true });
const output = new URL('../docs/screenshots/', import.meta.url).pathname;
const results = [];

async function run(mobile) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: mobile ? 'reduce' : 'no-preference' });
  await context.addInitScript(() => { Date.now = () => 1794902400000; });
  const page = await context.newPage(), touch = mobile ? await context.newCDPSession(page) : null;
  const errors = [], mode = mobile ? 'touch' : 'desktop';
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const activate = locator => mobile ? locator.tap() : locator.click();
  const snapshot = () => page.evaluate(() => {
    const { engine, renderer } = window.sanctuary, { area, player } = engine.state;
    return { area: area.def.id, x: player.x, y: player.y, dead: player.dead, life: player.life, experience: player.experience, control: engine.control, saveId: engine.state.activeSaveId, rigs: renderer.actors.size, draw: renderer.gl.info.render };
  });
  const steer = async (horizontal, vertical, milliseconds) => {
    if (mobile) {
      const bounds = await page.locator('.joystick').boundingBox(), length = Math.hypot(horizontal, vertical);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 71, x: bounds.x + bounds.width / 2 + horizontal / length * 32, y: bounds.y + bounds.height / 2 + vertical / length * 32 }] });
      try { await page.waitForTimeout(milliseconds); } finally { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    } else {
      const keys = [horizontal > .25 ? 'd' : horizontal < -.25 ? 'a' : null, vertical > .25 ? 's' : vertical < -.25 ? 'w' : null].filter(Boolean);
      for (const key of keys) await page.keyboard.down(key);
      try { await page.waitForTimeout(milliseconds); } finally { for (const key of keys) await page.keyboard.up(key); }
    }
  };
  const walk = async (target, until) => {
    for (let i = 0; i < 240; i++) {
      if (until && await page.evaluate(until)) return;
      const next = await page.evaluate(async target => {
        const { findPath } = await import('/src/engine.ts');
        const { area, player } = window.sanctuary.engine.state;
        if (player.dead) throw new Error('Normal walking character died');
        if (Math.hypot(player.x - target.x, player.y - target.y) < .45) return null;
        const path = findPath(area, player, target);
        const point = path.find(point => Math.hypot(point.x - player.x, point.y - player.y) > .55) ?? path[0];
        if (!point) throw new Error('No legal walking route');
        const dx = point.x - player.x, dy = point.y - player.y;
        return { horizontal: dx - dy, vertical: dx + dy };
      }, target);
      if (!next) return;
      await steer(next.horizontal, next.vertical, mobile ? 110 : 90);
    }
    throw new Error('Native walking exceeded its directed route budget');
  };
  const checkLayout = async label => {
    const layout = await page.evaluate(() => {
      const footer = document.querySelector('.bottom-hud');
      const panels = [...document.querySelectorAll('.gothic-panel')].filter(node => node.getClientRects().length).map(node => {
        const box = node.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      });
      return { width: document.documentElement.scrollWidth, viewport: innerWidth, footer: footer?.getBoundingClientRect().height, panels, height: innerHeight, veil: getComputedStyle(document.querySelector('.panel-layer')).backgroundColor };
    });
    if (!layout.panels.length) assert.equal(layout.veil, 'rgba(0, 0, 0, 0)', `${label}: closed panels do not dim gameplay`);
    assert.ok(layout.width <= layout.viewport + 1, `${label}: no document overflow`);
    assert.ok(layout.footer <= 120, `${label}: compact footer`);
    for (const panel of layout.panels) {
      assert.ok(panel.left >= -1 && panel.right <= layout.viewport + 1, `${label}: panel width fits`);
      assert.ok(panel.top >= -1 && panel.bottom <= layout.height + 1, `${label}: panel height fits`);
    }
    if (layout.panels.length === 2) {
      const [shop, inventory] = layout.panels;
      assert.ok(shop.right <= inventory.left || inventory.right <= shop.left || shop.bottom <= inventory.top || inventory.bottom <= shop.top, `${label}: independent trade windows never overlap`);
    }
  };
  const checkNotice = async name => {
    await page.waitForFunction(name => { const notice = document.querySelector('.area-notice'); return notice && !notice.hidden && notice.textContent === name; }, name);
    const notice = await page.locator('.area-notice-name').evaluate(node => {
      const box = node.getBoundingClientRect(), style = getComputedStyle(node);
      return { color: style.color, animation: style.animationName, pointer: getComputedStyle(node.parentElement).pointerEvents, left: box.left, right: box.right, top: box.top, bottom: box.bottom, hudTop: document.querySelector('.bottom-hud').getBoundingClientRect().top, width: innerWidth, count: document.querySelectorAll('.area-notice-name').length };
    });
    assert.equal(notice.color, 'rgb(239, 87, 80)'); assert.equal(notice.pointer, 'none'); assert.equal(notice.count, 1);
    assert.equal(notice.animation, mobile ? 'none' : 'area-notice-drift');
    assert.ok(notice.left >= 0 && notice.right <= notice.width && notice.top > 0 && notice.bottom < notice.hudTop, 'map notice fits above HUD');
  };
  const closePanel = async () => {
    if (await page.locator('.trade-workspace').count()) {
      await activate(page.locator('[data-focus="trade-view:vendor"]'));
      await activate(page.locator('[data-focus="trade-close:vendor"]'));
      await page.locator('.panel-vendor').waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => window.sanctuary.engine.state.panel), 'none');
    } else await activate(page.locator('.gothic-panel .close-button'));
    await page.locator('.gothic-panel').waitFor({ state: 'hidden' });
  };
  const openShop = async npcId => {
    const npc = await page.evaluate(npcId => window.sanctuary.engine.state.area.objects.find(object => object.kind === 'npc' && object.npcId === npcId && object.regionId === 1), npcId);
    await walk(npc);
    const point = await page.evaluate(object => window.sanctuary.renderer.worldToScreen(object, 1.85), npc);
    if (mobile) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    await page.locator('.panel-vendor').waitFor();
    return page.evaluate(() => window.sanctuary.engine.state.vendorItems);
  };
  const ownedItems = () => page.evaluate(() => {
    const p = window.sanctuary.engine.state.player;
    return { inventory: p.inventory, equipment: p.equipment, belt: p.belt, stash: p.stash, gold: p.gold };
  });
  try {
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    if (await page.getByRole('button', { name: '跳过动画', exact: true }).isVisible()) await activate(page.getByRole('button', { name: '跳过动画', exact: true }));
    await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.storageStatus !== 'loading');
    await activate(page.getByRole('button', { name: '新建角色', exact: true }));
    await activate(page.locator('[data-class="sor"]'));
    await page.locator('#hero-name').fill(`地表界面${mode}`);
    await activate(page.getByRole('button', { name: '开启旅程', exact: true }));
    await page.waitForFunction(() => window.sanctuary.renderer.groundArea === window.sanctuary.engine.state.area && window.sanctuary.engine.state.saved);
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.area.regions.length), 11);
    await checkNotice('罗格营地');
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.area-notice-name')).opacity) > .8);
    await page.screenshot({ path: `${output}40-map-${mode}-entry.png` });
    await page.locator('.area-notice').waitFor({ state: 'hidden' });
    const initialStock = await openShop('akara'); await closePanel();
    assert.deepEqual(await openShop('akara'), initialStock, 'closing and reopening a shop keeps all offers unchanged'); await closePanel();
    const initialCharsi = await openShop('charsi'); await closePanel();
    assert.deepEqual(await openShop('akara'), initialStock, 'another merchant does not reroll the first merchant'); await closePanel();
    const ownedBeforeWalk = await ownedItems();
    await checkLayout('town');
    await page.screenshot({ path: `${output}33-ui-${mode}-town.png` });
    for (const panel of ['inventory', 'character', 'skills', 'quests']) {
      await activate(page.locator(`.game-hud [data-panel="${panel}"]`));
      await page.locator(`.panel-${panel}`).waitFor();
      await checkLayout(panel);
      if (panel === 'inventory') {
        const before = await page.evaluate(() => {
          window.__stableFrame = document.querySelector('.gothic-panel');
          window.__stableGrid = document.querySelector('.panel-inventory .item-grid');
          return window.sanctuary.engine.state.player.inventory.map(item => item.uid);
        });
        const item = page.locator('.panel-inventory .item-grid .item-button').first();
        await activate(item);
        assert.equal(await page.evaluate(() => window.__stableFrame === document.querySelector('.gothic-panel') && window.__stableGrid === document.querySelector('.panel-inventory .item-grid')), true);
        assert.deepEqual(await page.evaluate(() => window.sanctuary.engine.state.player.inventory.map(item => item.uid)), before);
      }
      if (panel === 'skills') assert.ok(await page.locator('.skill-node').count() > 0);
      await page.screenshot({ path: `${output}34-ui-${mode}-${panel}.png` });
      await activate(page.locator(`.panel-${panel} .close-button`));
      await page.locator('.gothic-panel').waitFor({ state: 'hidden' });
    }
    const waypoint = await page.evaluate(() => window.sanctuary.engine.state.area.objects.find(object => object.kind === 'waypoint' && object.regionId === 1));
    await walk(waypoint);
    const point = await page.evaluate(object => window.sanctuary.renderer.worldToScreen(object, .8), waypoint);
    if (mobile) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    await page.locator('.panel-waypoint').waitFor();
    assert.equal(await page.getByRole('tab').count(), 5);
    await activate(page.getByRole('tab', { name: '第五幕', exact: true }));
    assert.equal(await page.locator('.waypoint-button:not(:disabled)').count(), 0);
    await activate(page.getByRole('tab', { name: '第一幕', exact: true }));
    await checkLayout('waypoint');
    await page.screenshot({ path: `${output}35-ui-${mode}-waypoint.png` });
    await activate(page.locator('.panel-waypoint .close-button'));
    await page.locator('.gothic-panel').waitFor({ state: 'hidden' });
    await page.evaluate(() => {
      window.__surfaceArea = window.sanctuary.engine.state.area; window.__surfaceTerrain = window.sanctuary.renderer.terrain;
      window.__surfaceMaxStep = 0; window.__surfaceMaxPerTick = 0; window.__surfacePrevious = null; window.__surfaceTracking = true; window.__surfaceCrossControls = [];
      const track = () => {
        if (!window.__surfaceTracking) return;
        const { engine } = window.sanctuary, { player, area, tick } = engine.state, previous = window.__surfacePrevious;
        if (previous) {
          const distance = Math.hypot(player.x - previous.x, player.y - previous.y);
          window.__surfaceMaxStep = Math.max(window.__surfaceMaxStep, distance);
          window.__surfaceMaxPerTick = Math.max(window.__surfaceMaxPerTick, distance / Math.max(1, tick - previous.tick));
          if (area.def.id !== previous.area) window.__surfaceCrossControls.push({ from: previous.area, to: area.def.id, move: { ...engine.control.move } });
        }
        window.__surfacePrevious = { x: player.x, y: player.y, area: area.def.id, tick };
        requestAnimationFrame(track);
      };
      requestAnimationFrame(track);
    });
    const region = await page.evaluate(() => window.sanctuary.engine.state.area.regions.find(region => region.def.id === 2));
    const beforeCross = await snapshot();
    await walk(region.spawn, () => window.sanctuary.engine.state.area.def.id === 2);
    const afterCross = await snapshot();
    assert.equal(afterCross.area, 2);
    await checkNotice('鲜血荒地');
    assert.equal(afterCross.dead, false);
    assert.equal(afterCross.saveId, beforeCross.saveId);
    assert.equal(await page.evaluate(() => window.__surfaceArea === window.sanctuary.engine.state.area && window.__surfaceTerrain === window.sanctuary.renderer.terrain), true, 'surface crossing must not rebuild world or terrain');
    const displacement = await page.evaluate(() => ({ rawMaximum: window.__surfaceMaxStep, perTickMaximum: window.__surfaceMaxPerTick }));
    assert.ok(displacement.perTickMaximum <= 9 / 25 + .001, `surface crossing respects normal per-tick speed: ${JSON.stringify(displacement)}`);
    const crossingControls = await page.evaluate(() => window.__surfaceCrossControls);
    assert.ok(crossingControls.some(crossing => crossing.to === 2 && Math.hypot(crossing.move.x, crossing.move.y) > .5), 'held native input must survive the region boundary');
    assert.deepEqual(afterCross.control.move, { x: 0, y: 0 });
    await page.waitForTimeout(180);
    await page.screenshot({ path: `${output}36-surface-${mode}-boundary.png` });
    const town = await page.evaluate(() => window.sanctuary.engine.state.area.regions.find(region => region.def.id === 1));
    await walk(town.spawn, () => window.sanctuary.engine.state.area.def.id === 1);
    assert.equal(await page.evaluate(() => window.__surfaceArea === window.sanctuary.engine.state.area), true);
    await page.evaluate(() => { window.__surfaceTracking = false; });
    await checkNotice('罗格营地');
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.area-notice-name')).opacity) > .8);
    await page.screenshot({ path: `${output}41-map-${mode}-return.png` });
    assert.deepEqual(await ownedItems(), ownedBeforeWalk, 'normal camp return leaves owned items unchanged');
    const walkingStock = await openShop('akara');
    assert.notDeepEqual(walkingStock.map(item => item.uid), initialStock.map(item => item.uid), 'walking back refreshes Akara');
    await closePanel();
    const walkingCharsi = await openShop('charsi');
    assert.notDeepEqual(walkingCharsi.map(item => item.uid), initialCharsi.map(item => item.uid), 'walking back refreshes every camp shop'); await closePanel();
    assert.deepEqual(await openShop('akara'), walkingStock, 'new offers remain stable on reopen'); await closePanel();
    await walk(region.spawn, () => window.sanctuary.engine.state.area.def.id === 2);
    await checkNotice('鲜血荒地');
    await activate(page.locator('.game-hud').getByRole('button', { name: '回城', exact: true }));
    const portal = await page.evaluate(() => { const { engine, renderer } = window.sanctuary; return renderer.worldToScreen(engine.state.area.objects.find(object => object.kind === 'portal' && object.regionId === 2), 2.04); });
    if (mobile) await page.touchscreen.tap(portal.x, portal.y); else await page.mouse.click(portal.x, portal.y);
    await page.waitForFunction(() => window.sanctuary.engine.state.area.def.id === 1);
    await checkNotice('罗格营地');
    const portalOwned = await ownedItems(), portalStock = await openShop('akara');
    assert.notDeepEqual(portalStock.map(item => item.uid), walkingStock.map(item => item.uid), 'real portal return refreshes camp shop');
    await checkLayout('refreshed shop'); await page.screenshot({ path: `${output}42-shop-${mode}-refreshed.png` }); await closePanel();
    assert.deepEqual(await openShop('akara'), portalStock, 'portal refreshed stock is stable on reopen'); await closePanel();
    assert.deepEqual(await ownedItems(), portalOwned, 'viewing refreshed offers never rewrites owned items');
    if (mobile) {
      await page.setViewportSize({ width: 320, height: 640 });
      await activate(page.locator('.game-hud [data-panel="inventory"]')); await checkLayout('320px inventory');
      await page.screenshot({ path: `${output}37-ui-touch-small-inventory.png` });
      await activate(page.locator('.panel-inventory .close-button'));
      await page.setViewportSize({ width: 844, height: 390 });
      await activate(page.locator('.game-hud [data-panel="skills"]')); await checkLayout('landscape skills');
      await activate(page.locator('.panel-skills .close-button'));
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await activate(page.locator('.save-button'));
    await page.waitForFunction(() => window.sanctuary.engine.state.saved);
    const savedId = (await snapshot()).saveId;
    await page.reload({ waitUntil: 'networkidle' });
    if (await page.getByRole('button', { name: '跳过动画', exact: true }).isVisible()) await activate(page.getByRole('button', { name: '跳过动画', exact: true }));
    await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.storageStatus !== 'loading');
    await activate(page.locator(`[data-save-id="${savedId}"]`));
    await page.screenshot({ path: `${output}38-ui-${mode}-roster.png` });
    await activate(page.getByRole('button', { name: '进入', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.screen === 'game');
    assert.equal((await snapshot()).saveId, savedId);
    const frameTimes = await page.evaluate(() => new Promise(resolve => {
      const samples = []; let last = 0;
      const frame = now => { if (last) samples.push(now - last); last = now; if (samples.length < 90) requestAnimationFrame(frame); else { samples.sort((a, b) => a - b); resolve({ median: samples[45], p95: samples[85] }); } }; requestAnimationFrame(frame);
    }));
    const normal = await snapshot();
    const fixtures = [];
    for (const id of [3, 4, 5, 6, 7, 17, 27]) {
      const camera = await page.evaluate(id => new Promise(resolve => {
        const { engine, renderer } = window.sanctuary; engine.enterArea(id);
        requestAnimationFrame(() => requestAnimationFrame(() => resolve({ x: renderer.target.x, y: renderer.target.z, player: { x: engine.state.player.x, y: engine.state.player.y } })));
      }), id);
      assert.ok(Math.hypot(camera.x - camera.player.x, camera.y - camera.player.y) < .05, 'real region-entry transition snaps camera without panning across the shared world');
      await page.waitForTimeout(350);
      const fixture = await snapshot();
      assert.equal(fixture.area, id); assert.ok(fixture.rigs < 90, 'distant monsters must not allocate rigs');
      await checkNotice(await page.evaluate(() => window.sanctuary.engine.state.area.def.name));
      await page.screenshot({ path: `${output}39-terrain-fixture-${mode}-${id}.png` });
      fixtures.push({ id, rigs: fixture.rigs, draw: fixture.draw });
    }
    assert.deepEqual(errors, []);
    results.push({ mode, normalWalking: { to: afterCross.area, returned: normal.area, noWorldRebuild: true, noPositionJump: true, displacement }, ui: 'panels/waypoint/selection/roster/save tested', mapNotice: 'entry/walking/portal/region fixtures, fade timeout, non-blocking red banner and reduced motion', shops: 'stable reopen/NPC switching, every merchant refresh on native walking return and portal return, owned items preserved', frameTimes, fixtures: { classification: 'render-only region-entry fixtures, not campaign progress', regions: fixtures }, errors });
  } catch (error) {
    await page.screenshot({ path: `${output}surface-ui-${mode}-failure.png` }).catch(() => {});
    throw new AggregateError([error], `${mode} surface UI check failed: ${error.message}`);
  } finally { await context.close(); }
}
async function checkConvenienceShop(mobile) {
  const mode = mobile ? 'touch' : 'desktop';
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const activate = locator => mobile ? locator.tap() : locator.click();
  const view = async kind => {
    await activate(page.locator(`[data-focus="trade-view:${kind}"]`));
    assert.equal(await page.locator(`[data-focus="trade-view:${kind}"]`).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.panel-layer').getAttribute('data-trade-view'), kind);
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.panel), 'vendor');
    await page.locator(`.panel-${kind}`).waitFor({ state: 'visible' });
    if (mobile) await page.locator(`.panel-${kind === 'vendor' ? 'inventory' : 'vendor'}`).waitFor({ state: 'hidden' });
  };
  const filter = async key => {
    await view('vendor');
    await activate(page.locator(`[data-focus="vendor-filter:${key}"]`));
    assert.equal(await page.locator(`[data-focus="vendor-filter:${key}"]`).getAttribute('aria-pressed'), 'true');
  };
  const buy = async code => {
    await view('vendor'); // Inventory purchases automatically switch touch layouts away from the shop.
    const before = await page.evaluate(code => {
      const s = window.sanctuary.engine.state, p = s.player;
      return { gold: p.gold, uids: p.inventory.map(item => item.uid), stock: structuredClone(s.vendorItems), offer: structuredClone(s.vendorItems.find(item => item.code === code)) };
    }, code);
    assert.ok(before.offer, `Offer ${code} exists`);
    await activate(page.locator(`.vendor-row[data-code="${code}"]`).getByRole('button', { name: /金币 · 购买$/ }));
    await page.waitForFunction(gold => window.sanctuary.engine.state.player.gold === gold, before.gold - before.offer.price);
    assert.deepEqual(await page.evaluate(() => window.sanctuary.engine.state.vendorItems), before.stock, 'A purchase does not reroll or consume any merchant offer');
    const purchased = await page.evaluate(uids => window.sanctuary.engine.state.player.inventory.find(item => !uids.includes(item.uid)), before.uids);
    if (purchased) {
      assert.equal(purchased.code, code); assert.notEqual(purchased.uid, before.offer.uid);
      assert.deepEqual(purchased.mods, before.offer.mods);
      assert.equal(await page.locator('.panel-layer').getAttribute('data-trade-view'), 'inventory');
      assert.equal(await page.locator('[data-focus="trade-view:inventory"]').getAttribute('aria-pressed'), 'true');
      await page.locator('.panel-inventory.trade-inventory').waitFor({ state: 'visible' });
      if (mobile) await page.locator('.panel-vendor').waitFor({ state: 'hidden' });
    }
    return purchased;
  };
  const checkTradeLayout = async (label, bagOpen = true) => {
    const layout = await page.evaluate(() => {
      const panels = [...document.querySelectorAll('.gothic-panel')].filter(node => node.getClientRects().length).map(node => {
        const b = node.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
      });
      const nav = [...document.querySelectorAll('.trade-switcher button')].map(node => { const b = node.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, height: b.height }; });
      return { width: document.documentElement.scrollWidth, viewport: innerWidth, height: innerHeight, panels, nav };
    });
    assert.ok(layout.width <= layout.viewport + 1, `${label}: no horizontal overflow`);
    assert.equal(layout.panels.length, mobile || !bagOpen ? 1 : 2, `${label}: only the selected touch window is visible`);
    for (const b of [...layout.panels, ...layout.nav]) assert.ok(b.left >= -1 && b.right <= layout.viewport + 1 && b.top >= -1 && b.bottom <= layout.height + 1, `${label}: windows and nav fit`);
    for (const b of layout.nav) assert.ok(b.height >= 44, `${label}: real touch-size navigation`);
    if (layout.panels.length === 2) {
      const [shop, bag] = layout.panels;
      assert.ok(shop.right <= bag.left || bag.right <= shop.left || shop.bottom <= bag.top || bag.bottom <= shop.top, `${label}: desktop window boxes do not overlap`);
    }
  };
  const selectInventory = async uid => {
    await view('inventory');
    await activate(page.locator(`.panel-inventory .item-button[data-focus="item:${uid}"]`));
    assert.equal(await page.locator(`.panel-inventory .item-button[data-focus="item:${uid}"]`).getAttribute('aria-pressed'), 'true');
  };
  const sellInventory = async uid => {
    await selectInventory(uid);
    const before = await page.evaluate(() => {
      const s = window.sanctuary.engine.state, p = s.player;
      return { gold: p.gold, inventory: structuredClone(p.inventory), belt: structuredClone(p.belt), stock: structuredClone(s.vendorItems), monsters: structuredClone(s.area.monsters), objects: structuredClone(s.area.objects), drops: structuredClone(s.area.drops) };
    });
    const item = before.inventory.find(item => item.uid === uid);
    assert.ok(item);
    const sell = page.locator('.panel-inventory .item-detail').getByRole('button', { name: '出售', exact: true });
    assert.equal(await sell.isEnabled(), true); await activate(sell);
    await page.waitForFunction(uid => !window.sanctuary.engine.state.player.inventory.some(item => item.uid === uid), uid);
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.player.gold), before.gold + Math.min(5000, Math.max(1, Math.floor(item.price / 4))));
    assert.deepEqual(await page.evaluate(() => window.sanctuary.engine.state.player.inventory), before.inventory.filter(item => item.uid !== uid), 'Selling preserves every other owned item, UID and roll');
    assert.deepEqual(await page.evaluate(() => window.sanctuary.engine.state.player.belt), before.belt);
    assert.deepEqual(await page.evaluate(() => window.sanctuary.engine.state.vendorItems), before.stock);
    assert.deepEqual(await page.evaluate(() => { const a = window.sanctuary.engine.state.area; return { monsters: a.monsters, objects: a.objects, drops: a.drops }; }), { monsters: before.monsters, objects: before.objects, drops: before.drops }, 'Selling, including SoJ, cannot summon black Diablo or create an event portal');
  };
  const jordanWarning = async () => {
    const warning = page.locator('.panel-vendor .warning, .panel-vendor .item-property').filter({ hasText: /黑毛|超级暗黑破坏神|Uber Diablo/i }).first();
    await warning.waitFor({ state: 'visible' });
    await warning.scrollIntoViewIfNeeded();
    assert.match(await warning.innerText(), /尚未(?:开放|实现)|未(?:开放|实现)|不会(?:触发|召唤)|不能(?:触发|召唤)/);
    assert.equal(await warning.evaluate(node => { const b = node.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth; }), true, 'The SoJ event warning is on-screen before purchase');
  };
  try {
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    if (await page.getByRole('button', { name: '跳过动画', exact: true }).isVisible()) await activate(page.getByRole('button', { name: '跳过动画', exact: true }));
    await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.storageStatus !== 'loading');
    await activate(page.getByRole('button', { name: '新建角色', exact: true }));
    await activate(page.locator('[data-class="sor"]'));
    await page.locator('#hero-name').fill(`便利商店${mode}`);
    await activate(page.getByRole('button', { name: '开启旅程', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.saved);
    // Gold, NPC proximity and low resources are isolated purchase fixtures, not earned campaign progress.
    const initial = await page.evaluate(() => {
      const { engine } = window.sanctuary, { player, area } = engine.state;
      const npc = area.objects.find(object => object.npcId === 'akara');
      Object.assign(player, { gold: 1_000_000, x: npc.x + 1, y: npc.y + 1, life: 1, mana: 1 }); player.belt[0] = null;
      return { npc, equipment: structuredClone(player.equipment), inventory: structuredClone(player.inventory), id: engine.state.activeSaveId };
    });
    await page.waitForFunction(() => { const { renderer, engine } = window.sanctuary, p = engine.state.player; return Math.hypot(renderer.target.x - p.x, renderer.target.z - p.y) < .1; });
    const point = await page.evaluate(npc => window.sanctuary.renderer.worldToScreen(npc, 1.85), initial.npc);
    if (mobile) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    await page.locator('.panel-vendor').waitFor();
    const shopWarning = page.locator('.panel-vendor .vendor-warning');
    assert.equal(await shopWarning.isVisible(), true);
    assert.match(await shopWarning.innerText(), /改编便利商店/);
    assert.match(await shopWarning.innerText(), /钥匙.*(?:不能开启|不能用来开门)/);
    await checkTradeLayout('initial dual shop');
    await page.screenshot({ path: `${output}48-shop-${mode}-dual.png` });
    await view('inventory'); await checkTradeLayout('backpack navigation');
    await activate(page.locator('[data-focus="trade-close:inventory"]'));
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.panel), 'vendor', 'Closing the backpack does not end trading');
    assert.equal(await page.locator('.panel-inventory').count(), 0);
    await page.locator('.panel-vendor').waitFor({ state: 'visible' });
    await checkTradeLayout('closed backpack shop', false);
    await filter('keys'); await filter('all'); // The shop still accepts real controls with its backpack closed.
    const offer = await page.evaluate(() => window.sanctuary.engine.state.vendorItems.find(item => item.code === 'rvl'));
    await buy('rvl');
    await page.waitForFunction(() => window.sanctuary.engine.state.player.belt[0]?.code === 'rvl');
    const boughtPotion = await page.evaluate(() => window.sanctuary.engine.state.player.belt[0]);
    assert.notEqual(boughtPotion.uid, offer.uid);
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.player.gold), 1_000_000 - offer.price);
    assert.deepEqual(await page.evaluate(() => window.sanctuary.engine.state.player.inventory), initial.inventory);
    await view('inventory');
    assert.equal(await page.locator('.panel-inventory.trade-inventory').count(), 1, 'The closed backpack reopens through its real nav button');
    await checkTradeLayout('reopened backpack'); await view('vendor');
    await page.screenshot({ path: `${output}45-shop-${mode}-supplies.png` });
    await activate(page.locator('.belt-grid [data-column="0"]'));
    await page.waitForFunction(() => { const s = window.sanctuary.engine.state; return !s.player.belt[0] && s.player.life === s.stats.maxLife && s.player.mana === s.stats.maxMana; });
    await filter('gems'); await page.waitForFunction(() => document.querySelectorAll('.vendor-row').length === 68);
    const runeNames = ['艾尔', '艾德', '提尔', '奈夫', '艾斯', '伊司', '塔尔', '拉尔', '欧特', '图尔', '安姆', '索尔', '沙伊', '多尔', '海尔', '艾欧', '卢姆', '科', '法尔', '兰姆', '普尔', '乌姆', '玛尔', '伊司特', '古尔', '伐克斯', '欧姆', '罗', '瑟', '贝', '扎哈', '查姆', '佐德'];
    const runeRows = runeNames.map((name, i) => ({ code: `r${String(i + 1).padStart(2, '0')}`, name: `${i + 1}号 · ${name}符文`, rank: String(i + 1) }));
    const gemFamilies = [
      ['紫宝石', ['gcv', 'gfv', 'gsv', 'gzv', 'gpv']], ['蓝宝石', ['gcb', 'gfb', 'gsb', 'glb', 'gpb']],
      ['绿宝石', ['gcg', 'gfg', 'gsg', 'glg', 'gpg']], ['红宝石', ['gcr', 'gfr', 'gsr', 'glr', 'gpr']],
      ['钻石', ['gcw', 'gfw', 'gsw', 'glw', 'gpw']], ['黄宝石', ['gcy', 'gfy', 'gsy', 'gly', 'gpy']],
      ['头骨宝石', ['skc', 'skf', 'sku', 'skl', 'skz']],
    ];
    const gemNames = ['碎裂的', '有瑕疵的', '', '无瑕的', '完美的'];
    const definitions = await page.evaluate(async () => { const { RUNES, GEMS } = await import('/src/items.ts'); return { runes: RUNES, gems: GEMS }; });
    assert.equal(definitions.runes.length, 33); assert.equal(definitions.gems.length, 35);
    assert.deepEqual(definitions.runes.map(rune => ({ code: rune.code, number: rune.number, name: rune.name })), runeRows.map((rune, i) => ({ code: rune.code, number: i + 1, name: `${runeNames[i]}符文` })));
    const gemRows = gemFamilies.flatMap(([name, codes]) => gemNames.map((prefix, grade) => {
      const definition = definitions.gems.find(gem => gem.code === codes[grade]);
      assert.ok(definition, `Gem/skull ${codes[grade]} is defined`);
      const label = (codes[grade] === 'skl' ? '无瑕疵的' : prefix) + name;
      assert.equal(definition.name, label); assert.equal(definition.grade, grade);
      return { code: codes[grade], name: label, rank: `${grade + 1}/5` };
    }));
    assert.equal(new Set(gemRows.map(gem => gem.code)).size, 35);
    assert.equal(new Set(definitions.gems.map(gem => gem.grade)).size, 5);
    assert.deepEqual(await page.locator('.vendor-row').evaluateAll(rows => rows.map(row => ({ code: row.dataset.code, name: row.querySelector('.vendor-item-name').textContent, rank: row.querySelector('.item-rank')?.textContent }))), [...runeRows, ...gemRows], 'All 68 sorted codes, localized names and visible rune numbers/gem grades are present');
    assert.deepEqual(await page.locator('.vendor-row').evaluateAll(rows => rows.filter(row => /^r\d{2}$/.test(row.dataset.code)).map(row => row.dataset.code)), Array.from({ length: 33 }, (_, i) => `r${String(i + 1).padStart(2, '0')}`));
    assert.deepEqual(await page.locator('.vendor-row').evaluateAll(rows => rows.filter(row => /^sk/.test(row.dataset.code)).map(row => row.dataset.code)), ['skc', 'skf', 'sku', 'skl', 'skz']);
    await page.screenshot({ path: `${output}49-shop-${mode}-gems.png` });
    for (const code of ['r01', 'r33']) {
      await buy(code); await page.waitForFunction(code => window.sanctuary.engine.state.player.inventory.some(item => item.code === code), code);
    }
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.player.inventory.find(item => item.code === 'r33').requiredLevel), 69);
    await view('vendor'); await page.screenshot({ path: `${output}46-shop-${mode}-runes.png` });
    for (const code of ['gcv', 'gpv', 'skc', 'skz']) {
      const gem = await buy(code);
      assert.ok(gem); assert.equal(gem.identified, true);
      assert.equal(gem.name, gemRows.find(row => row.code === code).name);
      assert.match(await page.locator('.panel-inventory .item-detail').innerText(), new RegExp(gem.name));
    }
    await page.screenshot({ path: `${output}49-shop-${mode}-gems-inventory.png` });
    await filter('keys'); await page.waitForFunction(() => document.querySelectorAll('.vendor-row').length === 4);
    assert.deepEqual(await page.locator('.vendor-row').evaluateAll(rows => rows.map(row => row.dataset.code)), ['pk1', 'pk2', 'pk3', 'rin']);
    for (const [code, name] of [['pk1', '恐惧之钥'], ['pk2', '憎恨之钥'], ['pk3', '毁灭之钥']]) {
      await view('vendor');
      assert.match(await page.locator(`.vendor-row[data-code="${code}"]`).innerText(), new RegExp(name));
      assert.match(await page.locator(`.vendor-row[data-code="${code}"] .item-sprite`).getAttribute('src'), /^data:image\/svg\+xml,/);
      await activate(page.locator(`.vendor-row[data-code="${code}"] .item-button`));
      assert.match(await page.locator('.panel-vendor .item-detail').innerText(), /事件尚未开放.*不能合成事件传送门/);
      await buy(code); await page.waitForFunction(code => window.sanctuary.engine.state.player.inventory.some(item => item.code === code), code);
    }
    const firstKey = await page.evaluate(() => window.sanctuary.engine.state.player.inventory.find(item => item.code === 'pk1'));
    await buy('pk1'); await page.waitForFunction(() => window.sanctuary.engine.state.player.inventory.filter(item => item.code === 'pk1').length === 2);
    const keys = await page.evaluate(() => window.sanctuary.engine.state.player.inventory.filter(item => item.code === 'pk1'));
    assert.equal(new Set(keys.map(item => item.uid)).size, 2); assert.deepEqual(keys[0], firstKey);
    await view('vendor'); await page.screenshot({ path: `${output}47-shop-${mode}-keys.png` });
    const jordanOffer = await page.evaluate(() => window.sanctuary.engine.state.vendorItems.find(item => item.name === 'The Stone of Jordan'));
    assert.ok(jordanOffer);
    assert.equal(jordanOffer.code, 'rin'); assert.equal(jordanOffer.quality, 'unique');
    assert.equal(jordanOffer.identified, true); assert.equal(jordanOffer.price, 14000); assert.equal(jordanOffer.requiredLevel, 29);
    const jordanRow = page.locator('.vendor-row[data-code="rin"]');
    assert.equal(await jordanRow.locator('.vendor-item-name').innerText(), '乔丹之石');
    assert.equal(await jordanRow.locator('.item-button.quality-unique').count(), 1);
    assert.match(await jordanRow.getByRole('button', { name: /金币 · 购买$/ }).innerText(), /^14,000 金币 · 购买$/);
    await activate(jordanRow.locator('.item-button'));
    assert.match(await page.locator('.panel-vendor .item-detail').innerText(), /需要等级：29/);
    await jordanWarning();
    await page.screenshot({ path: `${output}50-shop-${mode}-jordan.png` });
    const jordan = await buy('rin');
    assert.ok(jordan); assert.notEqual(jordan.uid, jordanOffer.uid);
    assert.equal(jordan.name, 'The Stone of Jordan'); assert.equal(jordan.identified, true); assert.equal(jordan.quality, 'unique');
    assert.equal(jordan.requiredLevel, 29); assert.equal(jordan.price, 14000);
    assert.deepEqual(Object.fromEntries(['mana', 'maxManaPercent', 'allSkills', 'minLightning', 'maxLightning'].map(key => [key, jordan.mods[key]])), { mana: 20, maxManaPercent: 25, allSkills: 1, minLightning: 1, maxLightning: 12 });
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.player.inventory.filter(item => item.name === 'The Stone of Jordan').length), 1);
    await selectInventory(jordan.uid);
    assert.equal(await page.locator('.panel-inventory .item-detail h3').innerText(), '乔丹之石');
    const jordanDetail = await page.locator('.panel-inventory .item-detail').innerText();
    for (const property of ['+20 法力', '+25 最大法力%', '+1 所有技能', '增加 1–12 闪电伤害', '需要等级：29']) assert.ok(jordanDetail.includes(property), `SoJ detail displays ${property}`);
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.player.level), 1);
    await activate(page.locator('.panel-inventory .item-detail').getByRole('button', { name: '装备', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.messages.at(-1)?.text.includes('需要等级 29'));
    assert.deepEqual(await page.evaluate(() => window.sanctuary.engine.state.player.equipment), initial.equipment, 'A level-one character cannot wear the level-29 ring');
    assert.deepEqual(await page.evaluate(uid => window.sanctuary.engine.state.player.inventory.find(item => item.uid === uid), jordan.uid), jordan, 'A failed equip never changes or rerolls SoJ');
    await page.screenshot({ path: `${output}50-shop-${mode}-jordan-inventory.png` });
    if (mobile) {
      await checkTradeLayout('390px purchased backpack');
      await view('vendor'); await checkTradeLayout('390px return to shop');
      const lockedKey = await buy('pk1'); await selectInventory(lockedKey.uid);
      const beforeKeySale = await page.evaluate(() => structuredClone(window.sanctuary.engine.state.player));
      await activate(page.locator('.panel-inventory .item-detail').getByRole('button', { name: '出售', exact: true }));
      await page.waitForFunction(() => window.sanctuary.engine.state.messages.at(-1)?.text === '不能出售任务物品。');
      assert.deepEqual(await page.evaluate(() => window.sanctuary.engine.state.player), beforeKeySale, 'Event keys retain the existing quest-item sale restriction');
      await filter('gems'); const disposableGem = await buy('gcv'); await sellInventory(disposableGem.uid);
      await view('vendor');
      await page.setViewportSize({ width: 320, height: 640 }); await filter('gems');
      await checkTradeLayout('320px shop');
      await page.screenshot({ path: `${output}51-shop-touch-small-dual.png` });
      await view('inventory'); await checkTradeLayout('320px backpack nav');
      await view('vendor');
      const disposableRune = await buy('r01');
      await checkTradeLayout('320px purchase automatically reveals backpack');
      await sellInventory(disposableRune.uid);
      await view('vendor'); await checkTradeLayout('320px return after sale');
      // Buy again after returning to the shop, rather than attempting a hidden/forced click.
      const extraGem = await buy('gcv');
      await selectInventory(extraGem.uid);
      await page.screenshot({ path: `${output}52-shop-touch-small-gems-inventory.png` });
      await view('vendor');
    }
    await checkTradeLayout('expanded shop');
    await filter('all');
    const beforeFailure = await page.evaluate(() => { const p = window.sanctuary.engine.state.player; p.gold = 1; return { inventory: structuredClone(p.inventory), belt: structuredClone(p.belt) }; });
    await page.waitForFunction(() => document.querySelector('.vendor-row[data-code="rvl"] .small-button').disabled);
    assert.equal(await page.locator('.vendor-row[data-code="rvl"] .small-button').isDisabled(), true);
    assert.deepEqual(await page.evaluate(() => { const p = window.sanctuary.engine.state.player; return { inventory: p.inventory, belt: p.belt }; }), beforeFailure);
    await selectInventory(jordan.uid); await view('vendor');
    await activate(page.locator('[data-focus="trade-close:vendor"]')); await page.locator('.panel-vendor').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.panel), 'none', 'Closing the merchant returns to the scene without opening the backpack');
    await page.locator('.panel-inventory').waitFor({ state: 'hidden' });
    await activate(page.locator('.quick-button[data-panel="inventory"]'));
    await page.locator('.panel-inventory').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.panel-inventory.trade-inventory').count(), 0);
    assert.equal(await page.locator('.panel-inventory .item-detail').getByRole('button', { name: '出售', exact: true }).isDisabled(), true, 'Backpack selling is disabled after trading ends');
    assert.deepEqual(await page.evaluate(() => window.sanctuary.engine.state.player.equipment), initial.equipment);
    assert.deepEqual(await page.evaluate(uids => window.sanctuary.engine.state.player.inventory.filter(item => uids.includes(item.uid)), initial.inventory.map(item => item.uid)), initial.inventory, 'Original inventory items retain every UID and roll');
    assert.deepEqual(await page.evaluate(uid => window.sanctuary.engine.state.player.inventory.find(item => item.uid === uid), firstKey.uid), firstKey);
    await activate(page.locator('.panel-inventory .close-button')); await page.locator('.panel-inventory').waitFor({ state: 'hidden' });
    const saved = await page.evaluate(() => { const p = window.sanctuary.engine.state.player; return { inventory: structuredClone(p.inventory), belt: structuredClone(p.belt), equipment: structuredClone(p.equipment), gold: p.gold }; });
    await activate(page.locator('.save-button')); await page.waitForFunction(() => window.sanctuary.engine.state.saved);
    const database = await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('sanctuary-h5'); request.onerror = () => reject(request.error);
      request.onsuccess = () => { const db = request.result, read = db.transaction('characters').objectStore('characters').getAll(); read.onerror = () => reject(read.error); read.onsuccess = () => { resolve({ version: db.version, ids: read.result.map(record => record.id) }); db.close(); }; };
    }));
    assert.equal(database.version, 1); assert.deepEqual(database.ids, [initial.id]);
    await page.reload({ waitUntil: 'networkidle' });
    if (await page.getByRole('button', { name: '跳过动画', exact: true }).isVisible()) await activate(page.getByRole('button', { name: '跳过动画', exact: true }));
    await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.storageStatus !== 'loading');
    await activate(page.locator(`[data-save-id="${initial.id}"]`)); await activate(page.getByRole('button', { name: '进入', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.screen === 'game');
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.activeSaveId), initial.id);
    assert.deepEqual(await page.evaluate(() => { const p = window.sanctuary.engine.state.player; return { inventory: p.inventory, belt: p.belt, equipment: p.equipment, gold: p.gold }; }), saved);
    assert.deepEqual(await page.evaluate(uid => window.sanctuary.engine.state.player.inventory.find(item => item.uid === uid), jordan.uid), jordan, 'The genuine identified SoJ survives IndexedDB v1 reload without rerolling');
    await page.waitForFunction(() => { const { renderer, engine } = window.sanctuary, p = engine.state.player; return renderer.groundArea === engine.state.area && Math.hypot(renderer.target.x - p.x, renderer.target.z - p.y) < .1; });
    const restoredNpcPoint = await page.evaluate(npc => window.sanctuary.renderer.worldToScreen(npc, 1.85), initial.npc);
    if (mobile) await page.touchscreen.tap(restoredNpcPoint.x, restoredNpcPoint.y); else await page.mouse.click(restoredNpcPoint.x, restoredNpcPoint.y);
    await page.locator('.panel-vendor').waitFor({ state: 'visible' });
    await sellInventory(jordan.uid);
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.player.inventory.some(item => item.name === 'The Stone of Jordan')), false);
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.activeSaveId), initial.id);
    assert.deepEqual(errors, []);
    console.log(`${mode} isolated shop fixture PASS: full rejuvenation buy/drink, all 33 numbered runes + 35 gems/five skulls, three disclosed keys/repeat UID, genuine SoJ buy/level gate/v1 reload/sale without summon, independent window close/reopen, gold gate, native 390/320px navigation/sales, original items unchanged`);
  } catch (error) {
    await page.screenshot({ path: `${output}shop-${mode}-failure.png` }).catch(() => {}); throw error;
  } finally { await context.close(); }
}
try { await checkConvenienceShop(false); await checkConvenienceShop(true); await run(false); await run(true); console.log(JSON.stringify({ status: 'PASS', results }, null, 2)); }
finally { await browser.close(); }
