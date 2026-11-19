import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ headless: true });
const errors = [];
const output = new URL('../docs/screenshots/', import.meta.url).pathname;

async function run(mobile) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'reduce' });
  await context.addInitScript(() => { Date.now = () => 1794902400000; });
  const page = await context.newPage();
  const touch = mobile ? await context.newCDPSession(page) : null;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const activate = node => mobile ? node.tap() : node.click();
  const state = () => page.evaluate(() => {
    const { engine, renderer } = window.sanctuary, s = engine.state;
    return { area: s.area.def.id, player: structuredClone(s.player), stats: s.stats, control: engine.control, events: s.events, draw: renderer.gl.info.render };
  });
  const hold = async (target, seconds = .55) => {
    if (mobile) {
      const button = page.locator('.touch-action.cast'), bounds = await button.boundingBox();
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, id: 71 }] });
      await page.waitForTimeout(seconds * 1000);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      const point = await page.evaluate(p => window.sanctuary.renderer.worldToScreen(p, .8), target);
      await page.mouse.move(point.x, point.y); await page.mouse.down({ button: 'right' }); await page.waitForTimeout(seconds * 1000); await page.mouse.up({ button: 'right' });
    }
  };
  try {
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    await activate(page.getByRole('button', { name: '新建角色', exact: true }));
    await activate(page.locator('[data-class="sor"]')); await page.locator('#hero-name').fill(mobile ? '触屏三维验收' : '桌面三维验收');
    await activate(page.getByRole('button', { name: '开启旅程', exact: true }));
    await page.waitForFunction(() => window.sanctuary.renderer.groundArea === window.sanctuary.engine.state.area);
    const start = await state();
    if (!mobile) {
      await page.keyboard.down('d'); await page.waitForTimeout(350); await page.keyboard.up('d');
      const moved = await state(); assert.ok(moved.player.x > start.player.x && moved.player.y < start.player.y, 'D moves to screen right');
      const stopped = moved.player; await page.waitForTimeout(160); const after = await state();
      assert.ok(Math.hypot(after.player.x - stopped.x, after.player.y - stopped.y) < .01, 'released key stops movement');
    } else {
      const joystick = page.locator('.joystick'), bounds = await joystick.boundingBox();
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2 + 30, y: bounds.y + bounds.height / 2, id: 70 }] });
      await page.waitForTimeout(350);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const moved = await state(); assert.ok(moved.player.x > start.player.x && moved.player.y < start.player.y, 'touch joystick moves to screen right');
    }
    if (mobile) await activate(page.locator('.game-hud [data-panel="inventory"]')); else await page.keyboard.press('i');
    assert.deepEqual((await state()).control.move, { x: 0, y: 0 });
    if (mobile) await activate(page.locator('.panel-inventory .close-button')); else await page.keyboard.press('Escape');
    const surface = await page.evaluate(() => { window.__shortSurface = window.sanctuary.engine.state.area; return window.__shortSurface.regions.find(region => region.def.id === 2).spawn; });
    for (let i = 0; i < 240 && (await state()).area !== 2; i++) {
      const route = await page.evaluate(async target => {
        const { findPath } = await import('/src/engine.ts'), { area, player } = window.sanctuary.engine.state;
        const point = findPath(area, player, target)[0]; if (!point) throw new Error('No legal surface route');
        const dx = point.x - player.x, dy = point.y - player.y; return { horizontal: dx - dy, vertical: dx + dy };
      }, surface);
      if (mobile) {
        const bounds = await page.locator('.joystick').boundingBox(), length = Math.hypot(route.horizontal, route.vertical);
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 72, x: bounds.x + bounds.width / 2 + route.horizontal / length * 32, y: bounds.y + bounds.height / 2 + route.vertical / length * 32 }] });
        try { await page.waitForTimeout(90); } finally { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
      } else {
        const keys = [route.horizontal > .25 ? 'd' : route.horizontal < -.25 ? 'a' : null, route.vertical > .25 ? 's' : route.vertical < -.25 ? 'w' : null].filter(Boolean);
        for (const key of keys) await page.keyboard.down(key);
        try { await page.waitForTimeout(90); } finally { for (const key of keys) await page.keyboard.up(key); }
      }
    }
    assert.equal((await state()).area, 2, 'normal surface route crosses by walking');
    assert.equal(await page.evaluate(() => window.__shortSurface === window.sanctuary.engine.state.area), true, 'surface walking retains world identity');
    await page.waitForFunction(() => window.sanctuary.renderer.groundArea === window.sanctuary.engine.state.area);
    for (let i = 0; i < 50; i++) {
      const approach = await page.evaluate(async () => {
        const { findPath } = await import('/src/engine.ts');
        const { area, player } = window.sanctuary.engine.state;
        const enemy = area.monsters.filter(m => !m.dead).sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
        if (!enemy || Math.hypot(enemy.x - player.x, enemy.y - player.y) < 7.5 && Array.from({ length: 30 }, (_, j) => { const k = (j + 1) / 30; return area.tiles[Math.floor(player.y + (enemy.y - player.y) * k)]?.[Math.floor(player.x + (enemy.x - player.x) * k)] === 0; }).every(Boolean)) return null;
        const path = findPath(area, player, enemy), point = path[0];
        if (!point) throw new Error('Enemy has no reachable approach');
        const dx = point.x - player.x, dy = point.y - player.y;
        return { dx, dy, horizontal: dx - dy, vertical: dx + dy };
      });
      if (!approach) break;
      if (mobile) {
        const bounds = await page.locator('.joystick').boundingBox(), length = Math.hypot(approach.horizontal, approach.vertical);
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2 + approach.horizontal / length * 30, y: bounds.y + bounds.height / 2 + approach.vertical / length * 30, id: 72 }] });
        await page.waitForTimeout(100); await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        const keys = [approach.horizontal > .2 ? 'd' : approach.horizontal < -.2 ? 'a' : null, approach.vertical > .2 ? 's' : approach.vertical < -.2 ? 'w' : null].filter(Boolean);
        for (const key of keys) await page.keyboard.down(key); await page.waitForTimeout(100); for (const key of keys) await page.keyboard.up(key);
      }
    }
    const enemy = await page.evaluate(() => {
      const { area, player } = window.sanctuary.engine.state;
      return area.monsters.filter(m => !m.dead && Math.hypot(m.x - player.x, m.y - player.y) < 9 && Array.from({ length: 30 }, (_, i) => {
        const k = (i + 1) / 30; return area.tiles[Math.floor(player.y + (m.y - player.y) * k)]?.[Math.floor(player.x + (m.x - player.x) * k)] === 0;
      }).every(Boolean)).sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
    });
    assert.ok(enemy, 'starting enemy visible with clear trajectory');
    const beforeFight = await state();
    const retreat = await page.evaluate(async () => {
      const { hasLineOfSight } = await import('/src/world.ts');
      const { area, player } = window.sanctuary.engine.state;
      const isWalkable = (map, x, y) => map.tiles[Math.floor(y)]?.[Math.floor(x)] === 0;
      for (const [x, y] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) {
        const end = { x: player.x + x * 4.5, y: player.y + y * 4.5 };
        if (!hasLineOfSight(area, player, end)) continue;
        if (!Array.from({ length: 20 }, (_, i) => isWalkable(area, player.x + x * 4.5 * i / 19, player.y + y * 4.5 * i / 19)).every(Boolean)) continue;
        return { horizontal: x - y, vertical: x + y };
      }
      throw new Error('No collision-free movement/cast test route');
    });
    if (mobile) {
      const joy = await page.locator('.joystick').boundingBox(), cast = await page.locator('.touch-action.cast').boundingBox(), length = Math.hypot(retreat.horizontal, retreat.vertical);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 91, x: joy.x + joy.width / 2 + retreat.horizontal / length * 32, y: joy.y + joy.height / 2 + retreat.vertical / length * 32 }, { id: 92, x: cast.x + cast.width / 2, y: cast.y + cast.height / 2 }] });
    } else {
      const point = await page.evaluate(p => window.sanctuary.renderer.worldToScreen(p, .8), enemy);
      await page.mouse.move(point.x, point.y); await page.mouse.down({ button: 'right' });
      await page.keyboard.down(retreat.horizontal > 0 ? 'd' : 'a'); await page.keyboard.down(retreat.vertical > 0 ? 's' : 'w');
    }
    await page.waitForTimeout(560);
    const movingCast = await state();
    assert.ok(Math.hypot(movingCast.player.x - beforeFight.player.x, movingCast.player.y - beforeFight.player.y) > 1.2, 'holding cast cannot lock actual retreat displacement');
    assert.ok(movingCast.events.some(e => e.actor === 'player' && e.kind === 'cast'), 'the movement test must include a real cast');
    assert.equal(movingCast.control.right, true);
    if (mobile) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else { await page.mouse.up({ button: 'right' }); await page.keyboard.up(retreat.horizontal > 0 ? 'd' : 'a'); await page.keyboard.up(retreat.vertical > 0 ? 's' : 'w'); }
    const released = await state(); await page.waitForTimeout(160);
    const afterRelease = await state();
    assert.ok(Math.hypot(afterRelease.player.x - released.player.x, afterRelease.player.y - released.player.y) < .01);
    assert.equal(afterRelease.control.right, false);
    for (let i = 0; i < 16; i++) {
      const target = await page.evaluate(uid => window.sanctuary.engine.state.area.monsters.find(m => m.uid === uid), enemy.uid);
      if (target.dead) break;
      assert.equal((await state()).player.dead, false, 'starter character survives combat');
      await hold(target, .58);
      if ((await state()).player.life < 20) await activate(page.locator('.belt-cell').first());
    }
    const fight = await state();
    assert.ok(fight.player.experience > beforeFight.player.experience, 'real combat awards XP');
    assert.ok(fight.events.some(e => e.kind === 'cast' && e.actor === 'player'), 'spell event consumed by real rig');
    assert.equal(fight.control.right, false, 'release stops casting');
    await page.screenshot({ path: output + (mobile ? '32-3d-touch-combat.png' : '31-3d-desktop-combat.png') });
    const frames = await page.evaluate(() => new Promise(resolve => {
      const deltas = []; let previous = 0;
      const sample = now => { if (previous) deltas.push(now - previous); previous = now; if (deltas.length < 120) requestAnimationFrame(sample); else { deltas.sort((a, b) => a - b); resolve({ median: deltas[60], p95: deltas[114], maximum: deltas[119] }); } }; requestAnimationFrame(sample);
    }));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    if (mobile) {
      const joy = await page.locator('.joystick').boundingBox(), cast = await page.locator('.touch-action.cast').boundingBox();
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 81, x: joy.x + joy.width / 2 + 28, y: joy.y + joy.height / 2 }, { id: 82, x: cast.x + cast.width / 2, y: cast.y + cast.height / 2 }] });
      await page.waitForTimeout(160);
      const held = await state(); assert.ok(Math.hypot(held.control.move.x, held.control.move.y) > .5); assert.equal(held.control.right, true, 'native two-finger movement and cast are both held');
      await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      const canceled = await state(); assert.deepEqual(canceled.control.move, { x: 0, y: 0 }); assert.equal(canceled.control.right, false, 'native touch cancel releases all holds');
    } else {
      const point = await page.evaluate(() => window.sanctuary.renderer.worldToScreen(window.sanctuary.engine.state.player, .2));
      await page.mouse.move(point.x, point.y); await page.mouse.down({ button: 'right' }); await page.mouse.down({ button: 'left' });
      let held = await state(); assert.equal(held.control.right, true); assert.equal(held.control.left, true);
      await page.mouse.up({ button: 'left' }); held = await state(); assert.equal(held.control.left, false); assert.equal(held.control.right, true, 'releasing the second button preserves the first');
      await page.keyboard.press('i'); held = await state(); assert.equal(held.control.right, false, 'opening a panel clears a physically held mouse button');
      await page.mouse.up({ button: 'right' }); await page.keyboard.press('Escape');
      await page.keyboard.press('h'); assert.ok(await page.locator('.help-row').filter({ hasText: /^E/ }).count(), 'E interaction is documented in current help'); await page.keyboard.press('Escape');
    }
    await activate(page.locator('.game-hud [data-panel="inventory"]')); await activate(page.locator('.panel-inventory').getByRole('button', { name: '回城卷轴', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.area.objects.some(o => o.kind === 'portal'));
    if (mobile) await activate(page.locator('.panel-inventory .close-button')); else await page.keyboard.press('Escape');
    const portal = await page.evaluate(() => { const {engine,renderer}=window.sanctuary;return renderer.worldToScreen(engine.state.area.objects.find(o=>o.kind==='portal'), .6); });
    if (mobile) await page.touchscreen.tap(portal.x, portal.y); else await page.keyboard.press('e');
    await page.waitForFunction(() => window.sanctuary.engine.state.area.def.id === 1);
    const beforePotion = (await state()).player.belt.filter(Boolean).length;
    assert.ok(beforePotion >= 2, 'starter belt must retain potions for panel safety checks');
    await activate(page.locator('.game-hud [data-panel="inventory"]'));
    if (mobile) {
      await activate(page.locator('.belt-cell').first());
      assert.equal((await state()).player.belt.filter(Boolean).length, beforePotion - 1, 'touch belt remains usable with a panel open');
      await activate(page.locator('.panel-inventory .close-button'));
    } else {
      await page.keyboard.press('q');
      assert.equal((await state()).player.belt.filter(Boolean).length, beforePotion - 1, 'Q drinks a real potion while inventory is open');
      const column = (await state()).player.belt.slice(0, 4).findIndex(Boolean);
      await page.keyboard.press(`Shift+Digit${column + 1}`);
      assert.equal((await state()).player.belt.filter(Boolean).length, beforePotion - 2, 'Shift+1–4 also works with inventory open');
      await page.keyboard.press('f');
      assert.equal((await state()).player.belt.filter(Boolean).length, beforePotion - 2, 'F with no mana potion cannot consume a healing potion');
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      const pausedBelt = (await state()).player.belt;
      for (const key of ['q', 'f', 'Shift+Digit3']) await page.keyboard.press(key);
      assert.deepEqual((await state()).player.belt, pausedBelt, 'paused shortcut keys cannot consume potions');
      await page.keyboard.press('Escape');
    }
    await activate(page.locator('.save-button')); await page.waitForFunction(() => window.sanctuary.engine.state.saved && !window.sanctuary.engine.state.loadingSave);
    const saved = await state(), id = await page.evaluate(() => window.sanctuary.engine.state.activeSaveId);
    await page.reload({ waitUntil: 'networkidle' }); await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    await activate(page.locator(`[data-save-id="${id}"]`)); await activate(page.getByRole('button', { name: '进入', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.screen === 'game');
    const restored = await state(); assert.equal(await page.evaluate(() => window.sanctuary.engine.state.activeSaveId), id);
    assert.equal(restored.player.experience, saved.player.experience); assert.deepEqual(restored.player.equipment, saved.player.equipment); assert.deepEqual(restored.player.belt, saved.player.belt);
    console.log(JSON.stringify({ platform: mobile ? 'touch' : 'desktop', area: fight.area, level: fight.player.level, xp: fight.player.experience, mana: fight.player.mana, life: fight.player.life, draw: fight.draw, frames, checks: 'movement, sustained moving casts with real displacement, release, panel reset, native exit, held spell, XP, two-button/two-finger cancel, portal/E, panel potions and paused safety, IndexedDB reload, no overflow' }));
  } finally { await context.close(); }
}
async function checkSkillPresses(mobile, width = mobile ? 390 : 1440) {
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage(), activate = node => mobile ? node.tap() : node.click();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    await activate(page.getByRole('button', { name: '新建角色', exact: true }));
    await activate(page.locator('[data-class="sor"]')); await page.locator('#hero-name').fill('短按技能隔离回归');
    await activate(page.getByRole('button', { name: '开启旅程', exact: true }));
    await page.waitForFunction(() => window.sanctuary.renderer.groundArea === window.sanctuary.engine.state.area);
    const casts = () => page.evaluate(() => window.sanctuary.engine.state.events.filter(e => e.actor === 'player' && e.kind === 'cast').map(e => e.seq));
    const ready = () => page.waitForFunction(() => window.sanctuary.engine.cooldown === 0);
    const mousePoint = () => page.evaluate(() => { const { engine, renderer } = window.sanctuary, p = engine.state.player; return renderer.worldToScreen({ x: p.x + 3, y: p.y }, 0); });
    const press = async (right = true) => {
      if (mobile) await activate(page.locator(right ? '.touch-action.cast' : '.touch-action.attack'));
      else { const p = await mousePoint(); await page.mouse.click(p.x, p.y, { button: right ? 'right' : 'left' }); }
    };
    const bindFire = async right => {
      if (mobile) {
        await activate(page.locator('.game-hud [data-panel="skills"]'));
        await activate(page.locator(`.skill-bind-bar [data-focus="skill-bind:${right ? 1 : 0}"]`));
      } else await activate(page.locator(right ? '.right-skill' : '.left-skill'));
      const tree = await page.evaluate(async () => (await import('/src/catalog.ts')).getSkill(36).tree);
      await activate(page.locator('.panel-skills .panel-tabs button').nth(tree));
      await activate(page.locator('[data-focus="skill:36"]'));
      await activate(page.getByRole('button', { name: right ? '绑定右键' : '绑定左键', exact: true }));
      await page.waitForFunction(() => window.sanctuary.engine.state.panel === 'none');
      assert.equal(await page.evaluate(right => window.sanctuary.engine.state.player[right ? 'rightSkill' : 'leftSkill'], right), 36);
      assert.equal(await page.evaluate(() => window.sanctuary.engine.state.paused), false);
    };
    await bindFire(true);
    if (mobile) assert.equal(await page.locator('.touch-action.cast').isDisabled(), true, 'town keeps cast disabled');
    else { await press(); assert.deepEqual(await casts(), []); assert.match(await page.evaluate(() => window.sanctuary.engine.state.messages.at(-1).text), /营地内不能.*野外/); }
    // Isolated input fixture removes enemies, not a campaign traversal or combat proof.
    await page.evaluate(() => { const e = window.sanctuary.engine; e.enterArea(2, undefined, true); e.state.area.monsters = []; });
    await page.waitForFunction(() => window.sanctuary.renderer.groundArea === window.sanctuary.engine.state.area && !document.querySelector('.touch-action.cast').disabled);
    for (let i = 0; i < 5; i++) {
      await ready(); const before = await casts(); await press(); await page.waitForTimeout(100);
      assert.equal((await casts()).length, before.length + 1, 'every quick right click/native tap releases one real spell');
      assert.equal(await page.evaluate(() => window.sanctuary.engine.control.right), false);
    }
    await ready(); const beforeHold = await casts();
    if (mobile) {
      const cdp = await context.newCDPSession(page), b = await page.locator('.touch-action.cast').boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 94, x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
      await page.waitForTimeout(150); await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    } else {
      const p = await mousePoint(); await page.mouse.move(p.x, p.y); await page.mouse.down({ button: 'right' });
      await page.waitForTimeout(150); await page.mouse.up({ button: 'right' });
    }
    assert.equal((await casts()).length, beforeHold.length + 1, 'press plus a short hold cannot double-cast');
    const released = await casts(); await ready(); await page.waitForTimeout(100); assert.deepEqual(await casts(), released, 'release/cancel cannot queue another cast');
    await page.evaluate(() => { window.sanctuary.engine.state.player.mana = 0; });
    await press(); assert.deepEqual(await casts(), released);
    assert.match(await page.evaluate(() => window.sanctuary.engine.state.messages.at(-1).text), /法力不足/);
    await page.evaluate(() => { const e = window.sanctuary.engine; e.state.player.mana = e.state.stats.maxMana; });
    const owned = () => page.evaluate(() => { const p = window.sanctuary.engine.state.player; return { inventory: p.inventory, equipment: p.equipment, gold: p.gold }; });
    const ownedBeforeSwap = await owned(), beforeUnavailable = await casts();
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.player.skills[36] ?? 0), 0);
    await page.keyboard.press('KeyX');
    await page.waitForFunction(() => document.querySelector('.right-skill')?.classList.contains('skill-unavailable'));
    assert.equal(await page.evaluate(async () => (await import('/src/rules.ts')).skillLevel(window.sanctuary.engine.state.player, 36)), 0);
    assert.equal(await page.locator('.right-skill').isDisabled(), false, 'unavailable binding remains selectable');
    const statusNode = page.locator(mobile ? '.touch-action.cast .action-skill' : '.right-skill');
    assert.match(await statusNode.innerText(), mobile ? /不可用 · 火弹/ : /火弹（不可用）/);
    if (mobile) assert.equal(await statusNode.evaluate(node => node.scrollWidth <= node.clientWidth), true, 'short unavailable label fits the touch button');
    assert.equal(await statusNode.evaluate(node => getComputedStyle(node).color), 'rgb(255, 98, 98)');
    if (mobile) assert.equal(await page.locator('.touch-action.cast').isDisabled(), true);
    else {
      await ready();
      const unavailableMana = await page.evaluate(() => { const e = window.sanctuary.engine; e.state.player.mana = e.state.stats.maxMana; return e.state.player.mana; });
      await press();
      assert.match(await page.evaluate(() => window.sanctuary.engine.state.messages.at(-1).text), /未获得火弹.*武器组/);
      const point = await mousePoint(); await page.mouse.move(point.x, point.y); await page.mouse.down({ button: 'right' });
      await page.waitForTimeout(700); await page.mouse.up({ button: 'right' });
      assert.deepEqual(await casts(), beforeUnavailable, 'unavailable right skill cannot cast even while held');
      assert.equal(await page.evaluate(() => window.sanctuary.engine.state.player.mana), unavailableMana);
      assert.equal(await page.evaluate(() => window.sanctuary.engine.cooldown), 0);
      assert.equal(await page.evaluate(() => window.sanctuary.engine.control.right), false);
    }
    assert.deepEqual(await owned(), ownedBeforeSwap);
    await page.screenshot({ path: output + `77-right-skill-unavailable-${width}.png` });
    await page.keyboard.press('KeyX');
    await page.waitForFunction(() => !document.querySelector('.right-skill')?.classList.contains('skill-unavailable'));
    await ready(); const beforeRecovered = await casts(); await press();
    assert.equal((await casts()).length, beforeRecovered.length + 1, 'switching back restores native casting without learning or rerolling items');
    assert.deepEqual(await owned(), ownedBeforeSwap);
    await page.screenshot({ path: output + `77-right-cast-recovered-${width}.png` });
    await bindFire(false); await ready(); const beforeLeft = await casts(); await press(false);
    assert.equal((await casts()).length, beforeLeft.length + 1, 'quick left click/native attack tap uses the bound active skill');
    await page.screenshot({ path: output + `77-left-cast-${width}.png` });
    await ready(); const beforePanel = await casts();
    await activate(page.locator('.game-hud [data-panel="inventory"]'));
    await page.locator('.panel-inventory').waitFor();
    if (mobile) assert.equal(await page.locator('.touch-action.cast').isDisabled(), true);
    else await press();
    assert.deepEqual(await casts(), beforePanel, 'open panel cannot cast');
    await activate(page.locator('.panel-inventory .close-button'));
    await page.locator('.panel-inventory').waitFor({ state: 'hidden' });
    if (mobile) {
      await page.locator('.touch-action.cast').focus(); await page.keyboard.press('Enter');
      assert.equal((await casts()).length, beforePanel.length + 1, 'keyboard activation of touch cast also responds to a short press');
    }
    console.log(`${width}px ${mobile ? 'Touch' : 'Desktop'} isolated skill input fixture PASS: 5 quick casts, left binding, automatic panel close, hold/release/cancel, mana, town/panel gates, unavailable staff skill after swap, red status, restored native casting, unchanged items${mobile ? ', keyboard press' : ', explicit rejection reason'}`);
  } finally { await context.close(); }
}
async function checkPauseSaveExit(width) {
  const mobile = width < 1000, context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage(), activate = node => mobile ? node.tap() : node.click();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const create = async name => {
      await activate(page.getByRole('button', { name: '新建角色', exact: true }));
      await activate(page.locator('[data-class="sor"]')); await page.locator('#hero-name').fill(name);
      await activate(page.getByRole('button', { name: '开启旅程', exact: true }));
      await page.waitForFunction(() => window.sanctuary.engine.state.screen === 'game');
      await page.evaluate(() => window.sanctuary.engine.save(false));
    };
    const pause = async () => {
      if (mobile) await activate(page.locator('.pause-button')); else await page.keyboard.press('Escape');
      await page.locator('.modal-layer .modal-card').waitFor();
    };
    const exit = () => page.getByRole('button', { name: '保存并返回角色菜单', exact: true });
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    await create(`保留旅人${width}`); await pause(); await activate(exit());
    await page.waitForFunction(() => window.sanctuary.engine.state.screen === 'title' && !window.sanctuary.engine.state.savingAndExiting);
    const other = await page.evaluate(async () => { const e = window.sanctuary.engine; return e.store.get(e.state.activeSaveId); });
    await create(`暂停返回隔离${width}`);
    const baseline = await page.evaluate(async () => { const e = window.sanctuary.engine; return e.store.get(e.state.activeSaveId); });
    await activate(page.locator('.game-hud [data-panel="inventory"]')); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.panel), 'none');
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.paused), false);
    await pause();
    assert.match(await page.locator('#save-exit-note').innerText(), /保存当前角色进度到本机.*成功后返回角色菜单.*营地.*怪物会刷新/);
    assert.equal(await exit().getAttribute('aria-describedby'), 'save-exit-note');
    await page.screenshot({ path: output + `78-pause-menu-${width}.png` });
    await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => window.sanctuary.engine.state.paused), false);
    await pause();
    await page.evaluate(() => {
      const e = window.sanctuary.engine, put = e.store.put.bind(e.store);
      e.state.player.gold = 321; window.__exitFail = true; window.__exitWrites = 0;
      e.store.put = async record => { window.__exitWrites++; if (window.__exitFail) throw new Error('isolated quota fixture'); if (window.__exitGate) await window.__exitGate; await put(record); };
    });
    await activate(exit()); await page.locator('.modal-card [role="alert"]').waitFor();
    assert.match(await page.locator('.modal-card [role="alert"]').innerText(), /写入失败.*未返回角色菜单.*重试/);
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.screen), 'game');
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.paused), true);
    assert.deepEqual(await page.evaluate(async () => { const e = window.sanctuary.engine; return e.store.get(e.state.activeSaveId); }), baseline);
    assert.equal(await exit().isEnabled(), true);
    await page.screenshot({ path: output + `78-save-failed-${width}.png` });
    await page.evaluate(() => { window.__exitFail = false; window.__exitWrites = 0; window.__exitGate = new Promise(resolve => { window.__exitRelease = resolve; }); });
    await activate(exit()); await page.getByRole('button', { name: '正在保存，请稍候…', exact: true }).waitFor();
    assert.equal(await page.locator('.modal-card').getAttribute('aria-busy'), 'true');
    assert.equal(await page.locator('.modal-card button:enabled').count(), 0);
    assert.equal(await page.locator('.modal-card [role="alert"]').count(), 0, 'retry hides the previous failure while saving');
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.screen), 'game');
    const savingButton = page.getByRole('button', { name: '正在保存，请稍候…', exact: true }), b = await savingButton.boundingBox();
    if (mobile) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.paused), true);
    assert.deepEqual(await page.evaluate(async () => { const e = window.sanctuary.engine; return e.store.get(e.state.activeSaveId); }), baseline);
    assert.equal(await page.evaluate(() => window.__exitWrites), 1);
    await page.screenshot({ path: output + `78-save-waiting-${width}.png` });
    await page.evaluate(() => window.__exitRelease());
    await page.waitForFunction(() => window.sanctuary.engine.state.screen === 'title' && !window.sanctuary.engine.state.savingAndExiting);
    await page.locator('.character-screen').waitFor();
    const records = await page.evaluate(() => window.sanctuary.engine.store.list());
    assert.equal(records.length, 2);
    const saved = records.find(r => r.id === baseline.id);
    assert.equal(saved.player.gold, 321); assert.deepEqual(saved.player.equipment, baseline.player.equipment); assert.deepEqual(saved.player.inventory, baseline.player.inventory);
    assert.deepEqual(records.find(r => r.id === other.id), other);
    await page.screenshot({ path: output + `78-returned-roster-${width}.png` });
    await page.reload({ waitUntil: 'networkidle' }); await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    await activate(page.locator(`[data-save-id="${baseline.id}"]`)); await activate(page.getByRole('button', { name: '进入', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.screen === 'game' && !window.sanctuary.engine.state.loadingSave);
    const reloaded = await page.evaluate(() => { const e = window.sanctuary.engine; return { player: e.state.player, town: e.state.area.def.town }; });
    assert.equal(reloaded.player.gold, 321); assert.deepEqual(reloaded.player.equipment, baseline.player.equipment); assert.deepEqual(reloaded.player.inventory, baseline.player.inventory); assert.equal(reloaded.town, true);
    console.log(`${width}px isolated pause menu PASS: native Esc/touch, explicit save-and-return note, failure stays paused, delayed save/duplicate guards, IndexedDB v1 persistence/reload, other character unchanged`);
  } finally { await context.close(); }
}
async function checkCameraFraming(mobile) {
  const sizes = mobile ? [[390, 844], [320, 568], [844, 390]] : [[1440, 900], [1920, 1080], [1280, 500]];
  const context = await browser.newContext({ viewport: { width: sizes[0][0], height: sizes[0][1] }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage(), activate = node => mobile ? node.tap() : node.click();
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    await activate(page.getByRole('button', { name: '新建角色', exact: true }));
    await activate(page.locator('[data-class="sor"]')); await page.locator('#hero-name').fill(mobile ? '手机镜头隔离' : '高视角隔离');
    await activate(page.getByRole('button', { name: '开启旅程', exact: true }));
    await page.waitForFunction(() => { const { renderer, engine } = window.sanctuary; return engine.state.screen === 'game' && renderer.groundArea === engine.state.area; });
    const owned = () => page.evaluate(() => { const p = window.sanctuary.engine.state.player; return { inventory: p.inventory, equipment: p.equipment, belt: p.belt, gold: p.gold, experience: p.experience }; });
    const before = await owned();
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.waitForFunction(({ width, height }) => { const r = window.sanctuary.renderer; return r.width === width && r.height === height; }, { width, height });
      const frame = await page.evaluate(async () => {
        await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
        const { renderer: r, engine: e } = window.sanctuary, camera = r.camera, target = r.target, p = e.state.player;
        const dx = camera.position.x - target.x, dy = camera.position.y - target.y, dz = camera.position.z - target.z;
        const points = [[0, 0], [3, -2], [-2, 3], [.25, -.5]].map(([dx, dy]) => {
          const world = { x: p.x + dx, y: p.y + dy }, screen = r.worldToScreen(world), restored = r.screenToWorld(screen.x, screen.y);
          return { error: Math.hypot(world.x - restored.x, world.y - restored.y), finite: Number.isFinite(screen.x) && Number.isFinite(screen.y) };
        });
        return { coarse: r.coarse, fov: camera.fov, distance: r.distance, actualDistance: Math.hypot(dx, dy, dz), elevation: Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI,
          height: dy, diagonalError: Math.abs(dx - dz), points, fogNear: r.scene.fog.near, fogFar: r.scene.fog.far, calls: r.gl.info.render.calls,
          hero: r.worldToScreen(p, 1), contextLost: r.gl.getContext().isContextLost() };
      });
      const expected = (mobile ? 28 : 32) * Math.max(1, (1.3 / (width / height)) ** .6);
      assert.equal(frame.coarse, mobile); assert.equal(frame.fov, 34);
      assert.ok(Math.abs(frame.distance - expected) < 1e-6 && Math.abs(frame.actualDistance - expected) < 1e-6);
      assert.ok(Math.abs(frame.elevation - 65) < 1e-6 && frame.diagonalError < 1e-6, 'diagonal orientation and elevation remain unchanged');
      assert.ok(Math.abs(frame.height - expected * Math.sin(65 * Math.PI / 180)) < 1e-6);
      assert.ok(frame.points.every(point => point.finite && point.error < 1e-6), 'resized camera preserves world/screen click projection');
      assert.ok(Math.abs(frame.fogNear - (expected + 6)) < 1e-6 && Math.abs(frame.fogFar - (expected + 26)) < 1e-6, 'fog follows camera distance');
      assert.ok(frame.calls > 0 && !frame.contextLost && frame.hero.x > 0 && frame.hero.x < width && frame.hero.y > 0 && frame.hero.y < height - 112, 'live hero remains above the HUD');
      assert.deepEqual(await owned(), before, 'camera resize does not change owned items, gold or XP');
      await page.screenshot({ path: output + `82-camera-${mobile ? 'touch-unchanged' : 'pc-higher'}-${width}x${height}.png` });
      console.log(`${width}x${height} isolated camera PASS: base distance ${mobile ? 28 : 32}, 65-degree elevation, diagonal, click roundtrip, fog, live hero, unchanged owned items`);
    }
  } finally { await context.close(); }
}

async function checkRosterFullscreen(width, height) {
  const mobile = width < 1000, context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage(), activate = node => mobile ? node.tap() : node.click();
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    const layout = async () => {
      await page.locator('.character-screen').waitFor({ state: 'visible' });
      const sizes = await page.evaluate(() => {
        const screen = document.querySelector('.character-screen'), roster = screen.querySelector('.character-roster'), list = screen.querySelector('.character-list'), layer = screen.closest('.screen-layer'), style = getComputedStyle(screen);
        const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
        return { screen: rect(screen), roster: rect(roster), padding: Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight), overflowX: screen.scrollWidth - screen.clientWidth, overflowY: screen.scrollHeight - screen.clientHeight, layerScroll: layer.scrollTop, listOverflow: list.scrollHeight > list.clientHeight,
          buttons: [...screen.querySelectorAll('.character-create, .character-actions button')].map(rect) };
      });
      assert.deepEqual(sizes.screen, { x: 0, y: 0, width, height, right: width, bottom: height }, 'character page fills the viewport');
      assert.ok(Math.abs(sizes.roster.width - (width - sizes.padding)) < 1, 'roster has no centered width cap');
      assert.ok(sizes.overflowX <= 1 && sizes.overflowY <= 1, JSON.stringify(sizes)); assert.equal(sizes.layerScroll, 0, 'only the character list may scroll');
      for (const button of sizes.buttons) assert.ok(button.x >= 0 && button.y >= 0 && button.right <= width + 1 && button.bottom <= height + 1, JSON.stringify(button));
      return sizes;
    };
    await page.waitForFunction(() => window.sanctuary.engine.state.storageStatus === 'ready');
    await layout(); assert.equal(await page.getByRole('button', { name: '进入', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: '删除', exact: true }).isDisabled(), true);
    await page.screenshot({ path: output + `81-roster-empty-${width}x${height}.png` });
    await activate(page.getByRole('button', { name: '新建角色', exact: true }));
    await activate(page.locator('[data-class="sor"]')); await page.locator('#hero-name').fill(`全屏隔离${width}`);
    await activate(page.getByRole('button', { name: '开启旅程', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.screen === 'game');
    const exit = async () => {
      if (mobile) await activate(page.locator('.pause-button')); else await page.keyboard.press('Escape');
      await activate(page.getByRole('button', { name: '保存并返回角色菜单', exact: true }));
      await page.waitForFunction(() => { const s = window.sanctuary.engine.state; return s.screen === 'title' && !s.savingAndExiting; });
    };
    await exit();
    const original = await page.evaluate(async () => { const e = window.sanctuary.engine; return e.store.get(e.state.activeSaveId); });
    await page.evaluate(async () => {
      const e = window.sanctuary.engine, record = await e.store.get(e.state.activeSaveId);
      for (let index = 1; index <= 12; index++) {
        const fixture = structuredClone(record); fixture.id = crypto.randomUUID(); fixture.timestamp -= index;
        fixture.player.name = index === 12 ? '这是一位名字很长的隔离测试旅人用于核对换行布局' : `隔离列表旅人${index}`;
        await e.store.put(fixture);
      }
      await e.refreshCharacters();
    });
    await page.waitForFunction(() => document.querySelectorAll('.character-save').length === 13);
    assert.equal((await layout()).listOverflow, true);
    const card = page.locator('.character-save').last(), selectedId = await card.getAttribute('data-save-id');
    await card.scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => document.querySelector('.character-list').scrollTop); assert.ok(scroll > 0, 'the last character scrolls the internal list');
    await activate(card);
    await page.waitForFunction(id => document.querySelector('.character-save.selected')?.getAttribute('data-save-id') === id, selectedId);
    const scrollSamples = await page.evaluate(async () => {
      const samples = [];
      for (let frame = 0; frame < 8; frame++) { await new Promise(requestAnimationFrame); samples.push(document.querySelector('.character-list').scrollTop); }
      return samples;
    });
    assert.deepEqual(scrollSamples, Array(8).fill(scroll), 'selection preserves the live list scroll across render frames');
    await page.locator('.character-figure .portrait-art').evaluate(image => image.decode());
    await layout();
    const portrait = await page.locator('.character-figure .portrait-art').boundingBox(); assert.ok(portrait.height > 10 && portrait.width > 10);
    await page.screenshot({ path: output + `81-roster-fullscreen-${width}x${height}.png` });
    await activate(page.getByRole('button', { name: '进入', exact: true }));
    await page.waitForFunction(id => { const s = window.sanctuary.engine.state; return s.screen === 'game' && s.activeSaveId === id && !s.loadingSave; }, selectedId);
    await exit(); await layout();
    await Promise.all([page.waitForEvent('dialog').then(dialog => dialog.dismiss()), activate(page.getByRole('button', { name: '删除', exact: true }))]);
    assert.equal(await page.evaluate(async id => !!await window.sanctuary.engine.store.get(id), selectedId), true, 'cancel keeps the selected fixture');
    await Promise.all([page.waitForEvent('dialog').then(dialog => dialog.accept()), activate(page.getByRole('button', { name: '删除', exact: true }))]);
    await page.waitForFunction(() => document.querySelectorAll('.character-save').length === 12);
    assert.equal(await page.evaluate(async id => !!await window.sanctuary.engine.store.get(id), selectedId), false, 'confirm deletes only the selected fixture');
    assert.deepEqual(await page.evaluate(async id => window.sanctuary.engine.store.get(id), original.id), original, 'another character and its item values remain unchanged');
    await layout();
    console.log(`${width}x${height} isolated fullscreen roster PASS: empty/populated, no width/height cap or outer overflow, internal list scroll, native selection/enter/save return/cancel and confirm delete, other record unchanged`);
  } finally { await context.close(); }
}

async function checkCainIdentify(width) {
  const mobile = width < 1000, context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage(), activate = node => mobile ? node.tap() : node.click();
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    await activate(page.getByRole('button', { name: '新建角色', exact: true }));
    await activate(page.locator('[data-class="sor"]')); await page.locator('#hero-name').fill(`凯恩隔离${width}`);
    await activate(page.getByRole('button', { name: '开启旅程', exact: true }));
    await page.waitForFunction(() => window.sanctuary.renderer.groundArea === window.sanctuary.engine.state.area);
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.area.objects.some(o => o.npcId === 'cain')), false, 'Cain is absent before rescue');
    await page.evaluate(async () => {
      const e = window.sanctuary.engine, p = e.state.player, { createItem } = await import('/src/items.ts');
      p.inventory = ['cm1', 'cm1', 'cm1', 'ibk', 'isc'].map((code, index) => Object.assign(createItem(code, 1, () => .5), { uid: `cain-item-${index}`, x: index, y: 0, quantity: code === 'ibk' ? 5 : 1, identified: code !== 'cm1', requiredLevel: 1, mods: code === 'cm1' ? { life: 20, mana: 25 } : {} }));
      p.gold = 123; e.updateStats(); await e.save(false);
    });
    const owned = () => page.evaluate(() => { const p = window.sanctuary.engine.state.player; return { inventory: p.inventory, equipment: p.equipment, belt: p.belt, gold: p.gold }; });
    const before = await owned();
    const place = async npcId => {
      await page.evaluate(npcId => {
        const { engine: e, ui } = window.sanctuary, npc = e.state.area.objects.find(o => o.npcId === npcId);
        e.dispatch({ type: 'panel', panel: 'none' }); Object.assign(e.state.player, { x: npc.x + 1, y: npc.y + 1 }); e.reveal(); ui.resetControls();
      }, npcId);
      await page.waitForTimeout(200);
    };
    const clickNPC = async npcId => {
      const point = await page.evaluate(npcId => { const { engine, renderer } = window.sanctuary; return renderer.worldToScreen(engine.state.area.objects.find(o => o.npcId === npcId), 1.35); }, npcId);
      assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.classList.contains('world-canvas'), point), true);
      if (mobile) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
      await page.waitForFunction(npcId => { const s = window.sanctuary.engine.state; return s.npc === npcId && ['vendor', 'gamble'].includes(s.panel); }, npcId);
    };
    for (const npcId of ['akara', 'charsi', 'gheed']) {
      await place(npcId); await clickNPC(npcId);
      assert.equal(await page.getByRole('button', { name: '鉴定全部', exact: true }).count(), 0);
      assert.deepEqual(await owned(), before, 'merchants do not identify or consume scrolls');
      if (npcId === 'akara') {
        assert.ok(await page.locator('.vendor-stock .vendor-row').count() > 0);
        await page.screenshot({ path: output + `80-akara-no-identify-${width}.png` });
      }
    }
    await page.evaluate(() => window.sanctuary.engine.dispatch({ type: 'panel', panel: 'none' }));
    if (mobile) await activate(page.locator('.game-hud [data-panel="inventory"]')); else await page.keyboard.press('KeyI');
    await activate(page.locator('.item-grid[data-location="inventory"] [data-uid="cain-item-0"]'));
    await activate(page.locator(mobile ? '.item-popup [data-focus="identify:cain-item-0"]' : '.compact-item-detail [data-focus="identify:cain-item-0"]'));
    await page.waitForFunction(() => window.sanctuary.engine.state.player.inventory.find(i => i.uid === 'cain-item-0').identified);
    const scrollExpected = structuredClone(before); scrollExpected.inventory[0].identified = true; scrollExpected.inventory[3].quantity = 4;
    assert.deepEqual(await owned(), scrollExpected, 'individual inventory identification spends one scroll without Cain');
    if (mobile) await activate(page.locator('.popup-close'));
    await page.evaluate(async () => {
      const e = window.sanctuary.engine, p = e.state.player, { createArea, questKey } = await import('/src/world.ts');
      e.dispatch({ type: 'panel', panel: 'none' }); p.quests[questKey(p, 'a1q3')] = 3; e.state.area = createArea(1, p.difficulty, e.state.seed, p);
    });
    await page.waitForFunction(() => window.sanctuary.renderer.groundArea === window.sanctuary.engine.state.area);
    await place('cain'); await clickNPC('cain');
    const identifyAll = page.getByRole('button', { name: '鉴定全部', exact: true }); await identifyAll.waitFor({ state: 'visible' });
    assert.equal(await page.locator('.vendor-stock').count(), 0, 'Cain has no merchant stock');
    await page.screenshot({ path: output + `80-cain-identify-${width}.png` });
    await activate(identifyAll);
    await page.waitForFunction(() => window.sanctuary.engine.state.player.inventory.every(i => i.identified));
    const expected = structuredClone(scrollExpected); expected.inventory.forEach(item => item.identified = true);
    assert.deepEqual(await owned(), expected, 'Cain identifies all freely without rerolling or changing gold/equipment/belt/scrolls');
    await activate(identifyAll); assert.deepEqual(await owned(), expected, 'empty repeat costs nothing');
    await page.screenshot({ path: output + `80-cain-identified-${width}.png` });
    for (const gate of ['unrescued', 'other-difficulty']) {
      await page.evaluate(async gate => {
        const e = window.sanctuary.engine, p = e.state.player, { questKey } = await import('/src/world.ts');
        if (gate === 'unrescued') p.quests[questKey(p, 'a1q3')] = 1;
        else { p.quests[questKey(p, 'a1q3')] = 3; p.difficulty = 'nightmare'; }
        p.inventory[1].identified = false;
      }, gate);
      await place('cain'); await clickNPC('cain');
      assert.equal(await page.getByRole('button', { name: '鉴定全部', exact: true }).count(), 0, `${gate} has no service`);
      assert.equal(await page.evaluate(() => window.sanctuary.engine.state.player.inventory[1].identified), false);
      assert.equal((await owned()).inventory[3].quantity, 4);
    }
    console.log(`${width}px isolated Cain PASS: merchants have no identify-all, native individual scroll identification, rescued Cain native free identify-all, no reroll/cost, unrescued and difficulty gates; rescue completion is a fixture, not campaign verification`);
  } finally { await context.close(); }
}

async function checkAkaraHeal(width) {
  const mobile = width < 1000, context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage(), activate = node => mobile ? node.tap() : node.click();
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    await activate(page.getByRole('button', { name: '新建角色', exact: true }));
    await activate(page.locator('[data-class="sor"]')); await page.locator('#hero-name').fill(`阿卡拉隔离${width}`);
    await activate(page.getByRole('button', { name: '开启旅程', exact: true }));
    await page.waitForFunction(() => window.sanctuary.renderer.groundArea === window.sanctuary.engine.state.area);
    await page.evaluate(async () => {
      const e = window.sanctuary.engine, { createItem } = await import('/src/items.ts');
      const charm = createItem('cm1', 1, () => .5); charm.identified = true; charm.requiredLevel = 1; charm.mods = { life: 20, mana: 25 }; charm.x = 0; charm.y = 0;
      e.state.player.inventory.push(charm); e.updateStats(); await e.save(false);
    });
    const owned = () => page.evaluate(() => { const p = window.sanctuary.engine.state.player; return { inventory: p.inventory, equipment: p.equipment, belt: p.belt, gold: p.gold }; });
    const before = await owned();
    const fixture = async (npcId, offset = 1) => {
      await page.evaluate(async ({ npcId, offset }) => {
        const { engine: e, ui } = window.sanctuary, p = e.state.player, area = e.state.area;
        const { isTownPoint } = await import('/src/world.ts'), npc = area.objects.find(o => o.npcId === npcId);
        const candidates = [[offset, offset], [-offset, -offset], [offset, -offset], [-offset, offset]].map(([dx, dy]) => ({ x: npc.x + dx, y: npc.y + dy }));
        const position = candidates.find(point => area.tiles[Math.floor(point.y)]?.[Math.floor(point.x)] === 0 && isTownPoint(area, point));
        if (!position) throw new Error('No walkable town position for isolated NPC fixture');
        e.dispatch({ type: 'panel', panel: 'none' }); Object.assign(p, position); p.life = p.mana = 1; e.state.messages = []; ui.resetControls();
      }, { npcId, offset });
      await page.waitForTimeout(200);
    };
    const nativeClick = async npcId => {
      const point = await page.evaluate(npcId => { const { engine, renderer } = window.sanctuary; return renderer.worldToScreen(engine.state.area.objects.find(o => o.npcId === npcId), 1.35); }, npcId);
      assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.classList.contains('world-canvas'), point), true, 'NPC click reaches the scene');
      if (mobile) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    };
    const checkHealed = async () => {
      const state = await page.evaluate(() => { const e = window.sanctuary.engine; return { life: e.state.player.life, mana: e.state.player.mana, maxLife: e.state.stats.maxLife, maxMana: e.state.stats.maxMana, npc: e.state.npc, panel: e.state.panel, messages: e.state.messages }; });
      assert.equal(state.npc, 'akara'); assert.equal(state.panel, 'vendor'); assert.equal(state.life, state.maxLife); assert.equal(state.mana, state.maxMana);
      assert.match(state.messages.at(-1).text, /生命和法力已恢复/); assert.deepEqual(await owned(), before);
    };
    await fixture('akara', 4);
    await page.screenshot({ path: output + `79-akara-before-${width}.png` });
    await nativeClick('akara');
    const immediate = await page.evaluate(() => { const e = window.sanctuary.engine; return { life: e.state.player.life, maxLife: e.state.stats.maxLife }; });
    assert.ok(immediate.life < immediate.maxLife, 'distant click does not heal before approaching');
    await page.waitForFunction(() => { const e = window.sanctuary.engine; return e.state.panel === 'vendor' && e.state.npc === 'akara'; });
    await checkHealed(); await page.screenshot({ path: output + `79-akara-auto-heal-${width}.png` });
    await activate(page.locator('[data-focus="trade-close:vendor"]'));
    await page.waitForFunction(() => window.sanctuary.engine.state.panel === 'none');
    await page.screenshot({ path: output + `79-akara-healed-scene-${width}.png` });
    await fixture('akara'); await nativeClick('akara');
    await page.waitForFunction(() => window.sanctuary.engine.state.panel === 'vendor'); await checkHealed();
    await activate(page.locator('[data-focus="trade-close:vendor"]')); await fixture('akara');
    if (mobile) await activate(page.locator('.touch-action.interact')); else await page.keyboard.press('KeyE');
    await page.waitForFunction(() => window.sanctuary.engine.state.panel === 'vendor'); await checkHealed();
    await activate(page.locator('[data-focus="trade-close:vendor"]')); await fixture('charsi'); await nativeClick('charsi');
    await page.waitForFunction(() => window.sanctuary.engine.state.panel === 'vendor');
    assert.equal(await page.evaluate(() => window.sanctuary.engine.state.npc), 'charsi');
    assert.ok(await page.evaluate(() => { const e = window.sanctuary.engine; return e.state.player.life < e.state.stats.maxLife && e.state.player.mana < e.state.stats.maxMana; }));
    assert.deepEqual(await owned(), before);
    console.log(`${width}px isolated Akara PASS: native NPC click/tap with approach, nearby click, E/touch interaction, current charm caps, no extra treatment click/cost/items, Charsi does not heal`);
  } finally { await context.close(); }
}
try { await checkCameraFraming(false); await checkCameraFraming(true); await checkRosterFullscreen(1920, 1080); await checkRosterFullscreen(1440, 900); await checkRosterFullscreen(390, 844); await checkRosterFullscreen(320, 568); await checkRosterFullscreen(844, 390); await checkRosterFullscreen(1280, 500); await checkCainIdentify(1440); await checkCainIdentify(390); await checkCainIdentify(320); await checkAkaraHeal(1440); await checkAkaraHeal(390); await checkAkaraHeal(320); await checkPauseSaveExit(1440); await checkPauseSaveExit(390); await checkPauseSaveExit(320); await checkSkillPresses(false); await checkSkillPresses(true); await checkSkillPresses(true, 320); await run(false); await run(true); assert.deepEqual(errors, []); console.log('3D isolated play smoke PASS; no production saves used.'); } finally { await browser.close(); }
