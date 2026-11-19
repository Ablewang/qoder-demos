import assert from 'node:assert/strict';

// Isolated UI fixtures exercise the running app, not campaign reachability.
// Never starts/stops Vite, uses a persistent profile, or writes screenshots/saves outside its context.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/wangyong/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true });
const results = [];
const output = new URL('../docs/screenshots/', import.meta.url).pathname;

async function run(width) {
  const mobile = width !== 1440;
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'reduce' });
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
    return { inventory: structuredClone(engine.state.player.inventory), equipment: structuredClone(engine.state.player.equipment), weaponSwap: engine.state.player.weaponSwap, gold: engine.state.player.gold, source: engine.state.identifySource, panel: engine.state.panel };
  });
  async function fixture(panel = 'inventory', npcId = 'akara') {
    await page.evaluate(async ({ panel, npcId }) => {
      const { engine, ui } = window.sanctuary;
      const { createItem } = await import('/src/items.ts');
      ui.cancelItemDrag(); ui.closeItemPopup();
      const p = engine.state.player;
      const definitions = [['multi', 'qui', 0, 0], ['block', 'cap', 3, 0], ['potion', 'hp1', 6, 0], ['potion2', 'hp1', 6, 1], ['scroll', 'isc', 7, 0], ['book', 'ibk', 7, 1], ['unknown', 'cap', 8, 0], ['cube', 'box', 8, 5]];
      p.inventory = definitions.map(([uid, code, x, y]) => Object.assign(createItem(code, 20, () => .4), { uid, x, y, quantity: uid === 'book' ? 2 : 1, identified: uid !== 'unknown' }));
      p.stash = [Object.assign(createItem('cap', 1, () => .4), { uid: 'stash-item', x: 0, y: 0 }), Object.assign(createItem('cm1', 1, () => .4), { uid: 'stash-corner', x: 9, y: 9 })];
      p.gold = 100000; p.strength = 50; p.dead = false; engine.state.paused = false; engine.state.identifySource = null; engine.updateStats();
      if (panel === 'vendor') {
        const npc = engine.state.area.objects.find(o => o.npcId === npcId && o.regionId === 1);
        p.x = npc.x; p.y = npc.y; engine.dispatch({ type: 'interact', uid: npc.uid });
        if (!engine.state.vendorItems.length) engine.dispatch({ type: 'panel', panel: 'inventory' });
      } else if (panel === 'stash') {
        const stash = engine.state.area.objects.find(o => o.kind === 'stash' && o.regionId === 1);
        p.x = stash.x; p.y = stash.y; engine.dispatch({ type: 'interact', uid: stash.uid });
      } else if (engine.state.panel !== panel) engine.dispatch({ type: 'panel', panel });
      ui.update(engine.state); ui.selectItem(null); ui.invalidatePanel();
      window.__itemActions = [];
    }, { panel, npcId });
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
      const paperdoll = node.closest('.inventory-layout')?.querySelector('.paperdoll');
      const dollRect = paperdoll?.getBoundingClientRect(), dollStyle = paperdoll && getComputedStyle(paperdoll);
      const equipmentEdges = paperdoll && ['.weapon-set-tabs', '.slot-weapon.active-weapon, .slot-weapon2.active-weapon', '.slot-offhand.active-weapon, .slot-offhand2.active-weapon'].map(selector => {
        const rect = paperdoll.querySelector(selector).getBoundingClientRect(); return [rect.left, rect.right];
      });
      return { equipmentEdges, rows: style.getPropertyValue('--rows').trim(), columns: style.getPropertyValue('--columns').trim(), width: r.width, height: r.height, left: r.left, right: r.right, parentLeft: parent.left, parentRight: parent.right, viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, visiblePanels: [...document.querySelectorAll('.gothic-panel')].filter(n => n.getClientRects().length).map(n => { const b = n.getBoundingClientRect(); return [b.left, b.right, b.top, b.bottom]; }), screenHeight: innerHeight, paperdoll: paperdoll ? { left: dollRect.left, right: dollRect.right, border: dollStyle.borderTopWidth, background: dollStyle.backgroundImage, shadow: dollStyle.boxShadow, singleColumn: innerWidth <= 760 || !!node.closest('.trade-inventory') } : null };
    });
    assert.equal(geometry.rows, '8'); assert.equal(geometry.columns, '10');
    assert.ok(Math.abs((geometry.height - 2) / (geometry.width - 2) - .8) < .01, 'all eight rows laid out');
    assert.ok(geometry.left >= geometry.parentLeft - 1 && geometry.right <= geometry.parentRight + 1, 'inventory has no horizontal clipping');
    assert.ok(geometry.documentWidth <= geometry.viewport, 'no document overflow');
    if (geometry.paperdoll) {
      assert.equal(geometry.paperdoll.border, '0px', 'equipment has no outer border');
      assert.equal(geometry.paperdoll.background, 'none', 'equipment has no outer background');
      assert.equal(geometry.paperdoll.shadow, 'none', 'equipment has no outer shadow');
      if (geometry.paperdoll.singleColumn) {
        assert.ok(Math.abs(geometry.paperdoll.left - geometry.left) <= 1, 'equipment and inventory left edges align');
        assert.ok(Math.abs(geometry.paperdoll.right - geometry.right) <= 1, 'equipment and inventory right edges align');
        const [tabs, weapon, offhand] = geometry.equipmentEdges;
        assert.ok(Math.abs(tabs[0] - geometry.left) <= 1 && Math.abs(tabs[1] - geometry.right) <= 1, 'weapon tabs align with inventory edges');
        assert.ok(Math.abs(weapon[0] - geometry.left) <= 1 && Math.abs(offhand[1] - geometry.right) <= 1, 'visible weapon frames align with inventory edges');
      }
    }
    for (const [left, right, top, bottom] of geometry.visiblePanels) {
      assert.ok(left >= 0 && right <= width, 'panels have no horizontal clipping');
      if (!mobile) assert.ok(top >= 0 && bottom <= geometry.screenHeight, 'desktop panels stay in viewport');
    }
  }
  async function assertNoAccidentalActions() {
    assert.equal((await actions()).some(a => ['use-item', 'equip', 'unequip', 'identify', 'attack'].includes(a.type)), false, 'drag must never use/equip/identify/cast');
    assert.deepEqual(await page.evaluate(() => { const c = window.sanctuary.engine.control; return [c.left, c.right, c.move.x, c.move.y]; }), [false, false, 0, 0]);
  }
  async function playerBars() {
    await page.evaluate(() => {
      const { engine } = window.sanctuary;
      window.__barOriginalPlayer = structuredClone(engine.state.player);
      engine.state.player.life = engine.state.stats.maxLife * .25;
      engine.state.player.mana = engine.state.stats.maxMana * .75;
    });
    const read = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
      const { engine, renderer, ui } = window.sanctuary, s = engine.state, hero = renderer.actors.get('player');
      const canvas = renderer.overlayCanvas, rect = canvas.getBoundingClientRect(), dpr = canvas.width / rect.width;
      const point = renderer.worldToScreen(hero, 2.2), ctx = canvas.getContext('2d');
      const left = Math.floor((point.x - rect.left - 28) * dpr), span = Math.ceil(56 * dpr);
      const measure = (offset, color) => {
        const data = ctx.getImageData(left, Math.floor((point.y - rect.top + offset) * dpr), span, 1).data;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i] === color[0] && data[i + 1] === color[1] && data[i + 2] === color[2] && data[i + 3] >= 240) count++;
        return count / dpr;
      };
      resolve({ red: measure(-12, [223, 81, 72]), blue: measure(-4, [79, 147, 229]), life: s.player.life, mana: s.player.mana, maxLife: s.stats.maxLife, maxMana: s.stats.maxMana, point, anchor: { x: hero.x, y: hero.y }, pointer: getComputedStyle(canvas).pointerEvents, hit: document.elementFromPoint(point.x, point.y - 12) === ui.canvas, width: rect.width, height: rect.height, dpr });
    })));
    const check = async (alive = true) => {
      const bars = await read();
      for (const [kind, current, max] of [['red', bars.life, bars.maxLife], ['blue', bars.mana, bars.maxMana]]) {
        const expected = alive ? 52 * Math.max(0, Math.min(1, current / Math.max(1, max))) : 0;
        assert.ok(Math.abs(bars[kind] - expected) <= 2, `${kind} pixels ${bars[kind]} match current/max width ${expected}`);
      }
      assert.equal(bars.pointer, 'none');
      assert.ok(bars.point.x >= 28 && bars.point.x <= width - 28 && bars.point.y >= 16 && bars.point.y < bars.height - 120, 'bars fit above HUD');
      return bars;
    };
    const initial = await check(); assert.equal(initial.hit, true, 'overhead bars do not block scene interaction');
    await page.screenshot({ path: new URL(`../docs/screenshots/75-player-bars-town-${width}.png`, import.meta.url).pathname });
    if (mobile) {
      const bounds = await page.locator('.joystick').boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 81, x: bounds.x + bounds.width / 2 + 30, y: bounds.y + bounds.height / 2 }] });
      await page.waitForTimeout(250); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else { await page.keyboard.down('KeyD'); await page.waitForTimeout(250); await page.keyboard.up('KeyD'); }
    const moved = await check(); assert.ok(Math.hypot(moved.anchor.x - initial.anchor.x, moved.anchor.y - initial.anchor.y) > .1, 'bars follow native movement');
    await page.evaluate(async () => {
      const { engine, ui } = window.sanctuary, p = engine.state.player;
      const { createItem } = await import('/src/items.ts');
      p.equipment.weapon2 = Object.assign(createItem('hax', 1, () => .5), { mods: { mana: 50 } });
      p.weaponSwap = false; engine.updateStats(); ui.update(engine.state);
    });
    const primary = await check(); await page.keyboard.press('KeyX');
    const secondary = await check(); assert.ok(secondary.maxMana > primary.maxMana, 'bar uses actual swapped equipment maximum');
    await page.evaluate(async () => {
      const { engine, ui } = window.sanctuary, p = engine.state.player;
      const { createItem } = await import('/src/items.ts');
      engine.enterArea(8); engine.state.area.monsters = []; engine.state.effects = []; engine.state.projectiles = [];
      p.skills[36] = 1; p.rightSkill = 36; p.life = engine.state.stats.maxLife; p.mana = engine.state.stats.maxMana;
      p.belt[0] = Object.assign(createItem('rvl', 1, () => .5), { quantity: 1 });
      engine.updateStats(); ui.update(engine.state);
    });
    await page.waitForFunction(() => window.sanctuary.renderer.groundArea === window.sanctuary.engine.state.area);
    const full = await check();
    await page.evaluate(() => window.sanctuary.engine.damagePlayer({ attackRating: 1, level: 1 }, 10, 'magic'));
    const hurt = await check(); assert.ok(hurt.life < full.life && hurt.red < full.red, 'settled damage reduces red fill');
    if (mobile) await activate(page.locator('.touch-action.cast'));
    else await page.mouse.click(full.point.x + 60, full.point.y + 45, { button: 'right' });
    await page.waitForFunction(() => window.sanctuary.engine.state.events.some(e => e.actor === 'player' && e.kind === 'cast'));
    const cast = await check(); assert.ok(cast.mana < full.mana && cast.blue < full.blue, 'native cast reduces blue fill');
    await activate(page.locator('.belt-cell').first()); const restored = await check();
    assert.equal(restored.life, restored.maxLife); assert.ok(Math.abs(restored.mana - restored.maxMana) < .01);
    await page.evaluate(() => {
      const { engine } = window.sanctuary;
      engine.state.player.life = engine.state.stats.maxLife * .6; engine.state.player.mana = engine.state.stats.maxMana * .4;
    });
    await check(); await page.screenshot({ path: new URL(`../docs/screenshots/75-player-bars-field-${width}.png`, import.meta.url).pathname });
    await page.evaluate(() => { const { engine } = window.sanctuary; engine.state.paused = true; engine.state.player.life = 0; engine.state.player.mana = 0; });
    await check();
    await page.evaluate(() => { const { engine } = window.sanctuary; engine.state.player.life = engine.state.stats.maxLife; engine.state.player.mana = engine.state.stats.maxMana; engine.state.player.dead = true; });
    await check(false);
    await page.evaluate(() => {
      const { engine, ui } = window.sanctuary;
      engine.state.player.dead = false; engine.state.paused = false; engine.enterArea(1);
      Object.assign(engine.state.player, window.__barOriginalPlayer); delete window.__barOriginalPlayer;
      engine.state.effects = []; engine.state.projectiles = []; engine.state.events = [];
      engine.updateStats(); ui.update(engine.state); ui.resetControls();
    });
    await clearActions();
  }
  async function weaponSwap() {
    await page.evaluate(async () => {
      const { engine, ui } = window.sanctuary, p = engine.state.player;
      const { createItem } = await import('/src/items.ts');
      window.__originalSwapEquipment = structuredClone(p.equipment);
      const first = createItem('hax', 1, () => .5), second = createItem('sst', 1, () => .5);
      first.mods = { mana: 10 }; second.mods = { mana: 40, 'skill:36': 1 };
      p.equipment = { weapon: first, weapon2: second }; p.weaponSwap = false;
      engine.updateStats(); ui.update(engine.state); ui.invalidatePanel();
    });
    const equipment = (await snapshot()).equipment;
    const status = () => page.evaluate(() => {
      const s = window.sanctuary.engine.state;
      return { swap: s.player.weaponSwap, mana: s.stats.maxMana, panel: s.panel };
    });
    const initial = await status();
    await page.keyboard.press('KeyX');
    assert.deepEqual(await status(), { swap: true, mana: initial.mana + 30, panel: 'inventory' });
    await page.waitForFunction(() => document.querySelector('.slot-weapon2.active-weapon') && !document.querySelector('.slot-weapon.active-weapon'));
    const primaryWeaponTab = () => page.getByRole('tab', { name: '主武器' });
    const secondaryWeaponTab = () => page.getByRole('tab', { name: '副武器' });
    assert.equal(await secondaryWeaponTab().getAttribute('aria-selected'), 'true');
    await activate(primaryWeaponTab()); assert.deepEqual(await status(), initial);
    await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === '主武器');
    assert.equal(await primaryWeaponTab().getAttribute('aria-selected'), 'true');
    await page.keyboard.down('KeyX'); await page.keyboard.down('KeyX'); await page.keyboard.up('KeyX');
    assert.equal((await status()).swap, true, 'holding X switches only once');
    await page.keyboard.press('Shift+KeyX'); assert.equal((await status()).swap, false);
    await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', code: 'KeyX', isComposing: true, bubbles: true, cancelable: true })));
    assert.equal((await status()).swap, true, 'physical X works with an IME-style event');
    await page.keyboard.press('KeyX'); assert.equal((await status()).swap, false);
    for (const modifier of ['Control', 'Meta', 'Alt']) {
      await page.keyboard.press(`${modifier}+KeyX`); assert.equal((await status()).swap, false);
    }
    for (const tag of ['input', 'textarea', 'select', 'div']) {
      await page.evaluate(tag => {
        const node = document.createElement(tag); node.id = 'swap-input-fixture';
        if (tag === 'div') node.contentEditable = 'true';
        document.body.append(node); node.focus();
      }, tag);
      await page.keyboard.press('KeyX'); assert.equal((await status()).swap, false, `${tag} must not switch equipment`);
      await page.locator('#swap-input-fixture').evaluate(node => node.remove());
    }
    for (const gate of ['paused', 'dead']) {
      await page.evaluate(gate => {
        const { engine, ui } = window.sanctuary;
        if (gate === 'paused') engine.state.paused = true; else engine.state.player.dead = true;
        ui.update(engine.state);
      }, gate);
      await page.keyboard.press('KeyX'); assert.equal((await status()).swap, false);
      assert.equal(await primaryWeaponTab().isDisabled(), true);
      assert.equal(await secondaryWeaponTab().isDisabled(), true);
      await page.evaluate(() => window.sanctuary.engine.dispatch({ type: 'swap' })); assert.equal((await status()).swap, false);
      await page.evaluate(() => {
        const { engine, ui } = window.sanctuary; engine.state.paused = false; engine.state.player.dead = false; ui.update(engine.state);
      });
    }
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.keyboard.press('KeyX'); assert.equal((await status()).swap, false);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.keyboard.press('Escape'); assert.equal((await status()).panel, 'none');
    await page.keyboard.press('KeyX'); assert.equal((await status()).swap, true, 'scene shortcut remains functional');
    const saved = await page.evaluate(async () => {
      const engine = window.sanctuary.engine; await engine.save(false);
      const db = await new Promise(resolve => { const request = indexedDB.open('sanctuary-h5', 1); request.onsuccess = () => resolve(request.result); });
      const record = await new Promise(resolve => { const request = db.transaction('characters').objectStore('characters').get(engine.state.activeSaveId); request.onsuccess = () => resolve(request.result); });
      db.close(); return record;
    });
    assert.equal(saved.version, 1); assert.equal(saved.player.weaponSwap, true); assert.deepEqual(saved.player.equipment, equipment);
    await page.keyboard.press('KeyX'); assert.equal((await status()).swap, false);
    await page.keyboard.press('KeyW'); assert.equal((await status()).swap, false, 'W remains movement, not weapon swap');
    await page.keyboard.press('KeyI'); await grid.waitFor({ state: 'visible' });
    assert.deepEqual((await snapshot()).equipment, equipment, 'switching never rerolls or moves equipment');
    assert.deepEqual(await page.evaluate(() => { const c = window.sanctuary.engine.control; return [c.left, c.right, c.move.x, c.move.y]; }), [false, false, 0, 0]);
    await page.evaluate(() => {
      const { engine, ui } = window.sanctuary; engine.state.player.equipment = window.__originalSwapEquipment;
      engine.updateStats(); ui.update(engine.state); ui.invalidatePanel();
    });
    await clearActions();
  }
  async function requirementColors() {
    await page.evaluate(() => { window.__requirementPlayer = structuredClone(window.sanctuary.engine.state.player); });
    const surface = page.locator(mobile ? '.item-popup' : '.item-tooltip');
    const show = async () => {
      const target = item('requirement-item'); await target.scrollIntoViewIfNeeded();
      if (mobile) {
        if (await page.locator('.item-popup').isVisible()) await activate(page.locator('.popup-close'));
        await target.tap();
      } else { await page.mouse.move(5, 5); await target.hover(); }
      await surface.waitFor({ state: 'visible' });
    };
    const check = async expected => {
      await show();
      assert.deepEqual((await surface.locator('.unmet-requirement').allTextContents()).sort(), [...expected].sort());
      for (const row of await surface.locator('.unmet-requirement').all()) assert.equal(await row.evaluate(node => getComputedStyle(node).color), 'rgb(255, 98, 98)');
      assert.equal(await surface.getByText(/^需求：等级/).count(), 0, 'no contradictory raw-base summary');
    };
    const setup = async scenario => page.evaluate(async scenario => {
      const { engine, ui } = window.sanctuary, p = engine.state.player;
      const { createItem, getBase } = await import('/src/items.ts');
      ui.closeItemPopup(); ui.hideTooltip();
      Object.assign(p, { classId: 'sor', level: 1, strength: 0, dexterity: 0, weaponSwap: false, equipment: {} });
      const code = scenario === 'class' ? 'ktr' : scenario === 'broken' ? 'hax' : scenario === 'replacement' ? 'tow' : '2hs';
      const target = createItem(code, 1, () => .5); Object.assign(target, { uid: 'requirement-item', x: 0, y: 0 });
      if (scenario === 'thresholds') target.requiredLevel = 10;
      if (scenario === 'reduced') { target.ethereal = true; target.mods.requirementsPercent = -20; }
      if (scenario === 'class') { p.level = 99; p.strength = p.dexterity = 1000; }
      if (scenario === 'broken') { p.level = 99; p.strength = p.dexterity = 1000; target.identified = false; target.durability = 0; }
      if (scenario === 'replacement') {
        p.level = 99; p.dexterity = 1000; target.mods.strength = 1000;
        p.equipment.weapon = Object.assign(createItem('sst', 1, () => .5), { mods: { strength: 1000 } });
      }
      p.inventory = [target]; engine.state.panel = 'inventory'; engine.updateStats(); ui.update(engine.state); ui.selectItem(null); ui.invalidatePanel();
      return { base: getBase(code), target: structuredClone(target), player: structuredClone(p) };
    }, scenario);
    const update = async values => page.evaluate(values => {
      const { engine, ui } = window.sanctuary; Object.assign(engine.state.player, values); engine.updateStats(); ui.update(engine.state);
    }, values);
    const equip = async () => {
      if (!mobile) await activate(item('requirement-item'));
      const scope = page.locator(mobile ? '.item-popup .item-actions' : '.panel-inventory .item-actions');
      await activate(scope.getByRole('button', { name: '装备', exact: true }));
    };
    let fixture = await setup('thresholds');
    const strength = `需要力量：${fixture.base.strength}`, dexterity = `需要敏捷：${fixture.base.dexterity}`;
    await check(['需要等级：10', strength, dexterity]);
    assert.deepEqual(await page.evaluate(() => window.sanctuary.engine.state.player), fixture.player, 'reading red requirements never changes the character');
    await page.screenshot({ path: new URL(`../docs/screenshots/72-item-requirements-${width}.png`, import.meta.url).pathname });
    await equip(); assert.deepEqual((await snapshot()).equipment, {});
    await update({ level: 10, dexterity: fixture.base.dexterity }); await check([strength]);
    await update({ strength: fixture.base.strength }); await check([]); await equip();
    assert.equal((await snapshot()).equipment.weapon.uid, 'requirement-item');
    fixture = await setup('reduced');
    const reducedStrength = Math.max(0, Math.floor(fixture.base.strength * .8) - 10), reducedDexterity = Math.max(0, Math.floor(fixture.base.dexterity * .8) - 10);
    await check([`需要力量：${reducedStrength}`, `需要敏捷：${reducedDexterity}`]);
    await update({ strength: reducedStrength, dexterity: reducedDexterity }); await check([]); await equip();
    assert.equal((await snapshot()).equipment.weapon.uid, 'requirement-item');
    await setup('class'); await check(['仅限刺客']); await equip(); assert.deepEqual((await snapshot()).equipment, {});
    await update({ classId: 'ass' }); await check([]); await equip(); assert.equal((await snapshot()).equipment.weapon.uid, 'requirement-item');
    fixture = await setup('broken'); await check(['尚未辨识', `耐久度：0/${fixture.target.maxDurability}`]);
    await page.evaluate(() => { const { engine, ui } = window.sanctuary; const target = engine.state.player.inventory[0]; target.identified = true; target.mods.indestructible = 1; ui.update(engine.state); });
    await check([]); await equip(); assert.equal((await snapshot()).equipment.weapon.uid, 'requirement-item');
    fixture = await setup('replacement'); await check([`需要力量：${fixture.base.strength}`]);
    await equip(); assert.equal((await snapshot()).equipment.weapon.code, 'sst');
    await page.evaluate(async () => { const { engine, ui } = window.sanctuary; const { createItem } = await import('/src/items.ts'); engine.state.player.equipment.ring1 = Object.assign(createItem('rin', 1, () => .5), { mods: { strength: 1000 } }); engine.updateStats(); ui.update(engine.state); });
    await check([]); await equip(); assert.equal((await snapshot()).equipment.offhand.uid, 'requirement-item');
    await page.evaluate(() => {
      const { engine, ui } = window.sanctuary; ui.closeItemPopup(); ui.hideTooltip(); Object.assign(engine.state.player, window.__requirementPlayer);
      engine.updateStats(); ui.update(engine.state); ui.selectItem(null); ui.invalidatePanel();
    });
    await clearActions();
  }
  async function tradeAndPaperdoll() {
    await fixture('vendor', 'charsi');
    const state = await page.evaluate(async mobile => {
      const { engine } = window.sanctuary, { getBase } = await import('/src/items.ts');
      const workspace = document.querySelector('.trade-workspace'), nav = document.querySelector('.trade-switcher');
      const panels = [...workspace.querySelectorAll('.gothic-panel')].filter(node => getComputedStyle(node).display !== 'none');
      const emptySlots = [...document.querySelectorAll('.trade-inventory .empty-slot')];
      return {
        stock: engine.state.vendorItems.map(item => ({ code: item.code, slot: getBase(item.code)?.slot })),
        panels: panels.length,
        navDisplay: getComputedStyle(nav).display,
        workspaceOverflow: getComputedStyle(workspace).overflowY,
        slots: document.querySelectorAll('.trade-inventory .equipment-slot').length,
        shapes: new Set(emptySlots.map(node => getComputedStyle(node, '::before').clipPath)).size,
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
        mobile
      };
    }, mobile);
    assert.ok(state.stock.length > 0); assert.ok(state.stock.every(item => item.slot === 'weapon'), 'Charsi stocks weapons only');
    assert.equal(state.panels, 2); assert.equal(state.slots, 12); assert.ok(state.shapes >= 7, 'empty equipment slots use distinct silhouettes');
    assert.ok(state.width <= state.viewport, 'trade and paperdoll create no horizontal overflow');
    if (mobile) { assert.equal(state.navDisplay, 'none'); assert.ok(['auto', 'scroll'].includes(state.workspaceOverflow)); }
    else assert.notEqual(state.navDisplay, 'none');
    await layout();
    await page.locator('.panel-vendor').evaluate(node => node.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: output + `86-charsi-trade-${width}.png` });
    await page.locator('.trade-inventory .paperdoll').evaluate(node => node.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: output + `87-paperdoll-${width}.png` });
  }
  async function runewordCatalog() {
    await page.evaluate(() => {
      const { engine, ui } = window.sanctuary;
      engine.dispatch({ type: 'panel', panel: 'catalog' });
      ui.update(engine.state); ui.invalidatePanel();
    });
    await activate(page.locator('.catalog-tabs [data-kind="runeword"]'));
    const list = page.locator('.catalog-list');
    await list.waitFor({ state: 'visible' });
    assert.equal((await page.locator('.catalog-group-heading').first().innerText()).trim(), '装备类型 · 武器');
    const levels = await list.locator('.catalog-entry small').evaluateAll(nodes => nodes.map(node => {
      const match = node.textContent.match(/需求等级 (\d+)/);
      return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
    }));
    assert.ok(levels.every((level, index) => index === 0 || level >= levels[index - 1]), 'visible runewords are level-ascending within the equipment group');
    await list.evaluate(node => node.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: output + `84-runewords-${width}.png` });
    const search = page.locator('.catalog-search');
    await search.fill('Runeword133');
    await page.getByRole('button', { name: /^隐秘/ }).waitFor();
    assert.equal((await page.locator('.catalog-group-heading').innerText()).trim(), '装备类型 · 盔甲');
    assert.equal((await page.locator('.catalog-entry small').innerText()).trim(), '盔甲 · 需求等级 17');
    await search.fill('Runeword134');
    await activate(page.getByRole('button', { name: /^钢铁/ }));
    const properties = await page.locator('.catalog-detail .item-property').allInnerTexts();
    for (const expected of ['提升 25% 攻击速度', '+3 最小伤害', '+3 最大伤害', '50% 撕开伤口机会', '增强伤害 20%']) assert.ok(properties.includes(expected), expected);
    assert.doesNotMatch(properties.join('\n'), /T1Code|swing2|dmg-min|dmg-max|openwounds/);
    assert.equal((await page.locator('.catalog-detail .section-caption').innerText()).trim(), '装备属性 · 定义展示不代表全部已生效');
    await page.screenshot({ path: output + `85-property-translation-${width}.png` });
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
    await playerBars(); await runewordCatalog(); await tradeAndPaperdoll(); await fixture(); await layout();
    await page.locator('.panel-inventory .paperdoll').evaluate(node => node.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: output + `88-inventory-alignment-${width}.png` });
    await fixture(); await weaponSwap(); await requirementColors();
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
      await page.keyboard.press('KeyX'); assert.equal((await snapshot()).weaponSwap, beforeMove.weaponSwap, 'dragging must not switch weapons');
      assert.equal((await actions()).some(action => action.type === 'swap'), false);
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
    if (mobile) await destination.evaluate(node => {
      node.scrollIntoView({ block: 'start' });
      const workspace = node.closest('.trade-workspace'); workspace.scrollTop = Math.max(0, workspace.scrollTop - 64);
    });
    const target = await destination.boundingBox(), source = await cell(6, 0);
    await drag(source, { x: target.x + target.width / 2, y: target.y + target.height / 2 }, async () => assert.equal(await page.locator('.sell-drag-over').count(), 1));
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
    const offer = page.locator('.vendor-row').filter({ has: page.locator('[data-uid]') }).first();
    const offerUid = await offer.locator('.item-button').getAttribute('data-uid');
    const beforeBuy = await snapshot(); await activate(offer.locator('.small-button'));
    assert.ok((await snapshot()).gold < beforeBuy.gold); assert.equal((await actions()).filter(a => a.type === 'buy' && a.uid === offerUid).length, 1);
    await clearActions();
    const vendorItem = page.locator('.vendor-row .item-button').first(), vendorBox = await vendorItem.boundingBox();
    await start({ x: vendorBox.x + vendorBox.width / 2, y: vendorBox.y + 20 }); await move({ x: vendorBox.x + 60, y: vendorBox.y + 80 }); await end();
    assert.equal(await page.locator('.item-drag-ghost').count(), 0); assert.equal((await actions()).filter(a => a.type === 'sell').length, 0);
    await fixture('stash'); await layout();
    const stashGrid = page.locator('.item-grid[data-location="stash"]');
    const stashGeometry = await stashGrid.evaluate(node => {
      const r = node.getBoundingClientRect(), parent = node.parentElement.getBoundingClientRect(), style = getComputedStyle(node);
      return { label: node.getAttribute('aria-label'), columns: style.getPropertyValue('--columns').trim(), rows: style.getPropertyValue('--rows').trim(), width: r.width, height: r.height, left: r.left, right: r.right, parentLeft: parent.left, parentRight: parent.right, documentWidth: document.documentElement.scrollWidth };
    });
    assert.equal(stashGeometry.label, '储物箱 10 × 10'); assert.equal(stashGeometry.columns, '10'); assert.equal(stashGeometry.rows, '10');
    assert.ok(Math.abs(stashGeometry.width - stashGeometry.height) < 1, 'expanded stash is a square 10 by 10 grid');
    assert.ok(stashGeometry.left >= stashGeometry.parentLeft - 1 && stashGeometry.right <= stashGeometry.parentRight + 1, 'expanded stash has no horizontal clipping');
    assert.ok(stashGeometry.documentWidth <= width, 'expanded stash creates no document overflow');
    assert.equal(await page.locator('.item-grid[data-location="stash"] [data-uid="stash-corner"]').count(), 1, 'bottom-right cell is usable');
    await stashGrid.evaluate(node => node.scrollIntoView({ block: 'start' })); await page.screenshot({ path: output + `83-private-stash-${width}.png` });
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
    results.push({ width, passed: true, playerBars: true, coverage: `${mobile ? 'native tap, popup use/identify/cancel/empty source/removal, blank-grid panning' : 'native hover/focus, right-click use, double-click equip/unequip, stable selection'}, native X in scene/inventory, IME-style physical X, repeat/modifier/input/pause/death/focus/drag guards, mouse/touch swap button and active stats, IndexedDB v1 swap/equipment preservation, red unmet level/strength/dexterity/class/identification/durability requirements, exact thresholds, ethereal/reduced and supporting-equipment replacement, anchored drag, overlap/edge/outside/escape/lostcapture/rebuild${mobile ? '/pointercancel' : ''}, exactly-once sale, equipment/vendor/stash non-sale, no accidental use/equip/identify/cast, trade guard, 10x8 layout, zero console errors` });
  } finally { await context.close(); }
}

try { for (const width of [1440, 390, 320]) await run(width); console.log(JSON.stringify({ fixtureOnly: true, results }, null, 2)); }
finally { await browser.close(); }
