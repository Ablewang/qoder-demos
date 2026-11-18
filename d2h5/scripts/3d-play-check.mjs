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
async function checkSkillPresses(mobile) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
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
    else { await press(); assert.deepEqual(await casts(), []); }
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
    await bindFire(false); await ready(); const beforeLeft = await casts(); await press(false);
    assert.equal((await casts()).length, beforeLeft.length + 1, 'quick left click/native attack tap uses the bound active skill');
    await page.screenshot({ path: output + (mobile ? '44-skill-touch-press.png' : '43-skill-desktop-press.png') });
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
    console.log(`${mobile ? 'Touch' : 'Desktop'} isolated skill input fixture PASS: 5 quick casts, left binding, automatic panel close, hold/release/cancel, mana, town/panel gates${mobile ? ', keyboard press' : ''}`);
  } finally { await context.close(); }
}
try { await checkSkillPresses(false); await checkSkillPresses(true); await run(false); await run(true); assert.deepEqual(errors, []); console.log('3D isolated play smoke PASS; no production saves used.'); } finally { await browser.close(); }
