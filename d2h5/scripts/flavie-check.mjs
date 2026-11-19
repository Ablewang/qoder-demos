import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/wangyong/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true });
const output = new URL('../docs/screenshots/', import.meta.url).pathname;
const results = [];

async function run(width) {
  const mobile = width !== 1440;
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'reduce' });
  const page = await context.newPage(), touch = mobile ? await context.newCDPSession(page) : null, errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const activate = locator => mobile ? locator.tap() : locator.click();
  const snapshot = () => page.evaluate(() => {
    const { engine, renderer } = window.sanctuary, { player: p, area } = engine.state;
    const guard = area.objects.find(o => o.npcId === 'flavie');
    return { x: p.x, y: p.y, area: area.def.id, worldSame: area === window.__flavieWorld, guardSame: guard === window.__flavieGuard, guardVisible: renderer.actors.has(guard.uid), panel: engine.state.panel, npc: engine.state.npc, dialogue: engine.state.dialogue, offers: engine.state.vendorItems.length, owned: { inventory: p.inventory, equipment: p.equipment, gold: p.gold }, dead: p.dead, control: engine.control };
  });
  async function walkTo(x) {
    const before = await snapshot(), direction = Math.sign(x - before.x);
    if (mobile) {
      const box = await page.locator('.joystick').boundingBox();
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 76, x: box.x + box.width / 2 + direction * 27, y: box.y + box.height / 2 + direction * 27 }] });
    } else {
      await page.keyboard.down(direction > 0 ? 'KeyD' : 'KeyA');
      await page.keyboard.down(direction > 0 ? 'KeyS' : 'KeyW');
    }
    try {
      await page.waitForFunction(({ x, direction }) => direction * (window.sanctuary.engine.state.player.x - x) >= -.15, { x, direction }, { timeout: 10000 });
    } finally {
      if (mobile) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      else {
        await page.keyboard.up(direction > 0 ? 'KeyD' : 'KeyA');
        await page.keyboard.up(direction > 0 ? 'KeyS' : 'KeyW');
      }
    }
    const after = await snapshot();
    assert.ok(after.worldSame && after.guardSame && !after.dead);
    assert.ok(Math.abs(after.y - before.y) < .6, `native steering stays within the road: ${before.y} -> ${after.y}`);
    assert.ok(Math.abs(after.x - x) < .8, 'native walking stops near its destination');
    assert.deepEqual(after.owned, before.owned);
  }
  try {
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.sanctuary, undefined, { timeout: 60000 });
    if (await page.getByRole('button', { name: '跳过动画', exact: true }).isVisible()) await activate(page.getByRole('button', { name: '跳过动画', exact: true }));
    await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.storageStatus !== 'loading');
    await activate(page.getByRole('button', { name: '新建角色', exact: true }));
    await activate(page.locator('[data-class="sor"]'));
    await page.locator('#hero-name').fill(`边境隔离回归${width}`);
    await activate(page.getByRole('button', { name: '开启旅程', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.screen === 'game' && window.sanctuary.engine.state.saved);
    const road = await page.evaluate(() => {
      const { engine, ui } = window.sanctuary, area = engine.state.area;
      area.monsters = [];
      const source = area.objects.find(o => o.seam && o.regionId === 2 && o.targetArea === 3);
      const back = area.objects.find(o => o.seam && o.regionId === 3 && o.targetArea === 2);
      const guards = area.objects.filter(o => o.npcId === 'flavie'), guard = guards[0];
      const moor = area.regions.find(r => r.def.id === 2), plains = area.regions.find(r => r.def.id === 3);
      window.__flavieWorld = area; window.__flavieGuard = guard;
      engine.enterArea(2, source); ui.resetControls(); ui.update(engine.state);
      return { source, back, guard, count: guards.length, moor, plains, floor: area.tiles[Math.floor(guard.y)][Math.floor(guard.x)] };
    });
    assert.equal(road.count, 1); assert.equal(road.floor, 0);
    assert.ok(road.guard.x >= road.moor.x + road.moor.width && road.guard.x < road.plains.x);
    assert.equal(road.guard.y, road.source.y + 1);
    const initial = await snapshot();
    for (const [side, destination, midpoint] of [[2, road.back, road.guard.x], [3, road.source, road.guard.x + 1]]) {
      if (side === 3) assert.equal((await snapshot()).area, 3);
      await walkTo(midpoint);
      await page.waitForFunction(() => window.sanctuary.renderer.actors.has(window.__flavieGuard.uid));
      assert.equal((await snapshot()).guardVisible, true);
      if (side === 2) await page.screenshot({ path: `${output}76-flavie-border-${width}.png` });
      if (mobile) {
        await page.waitForFunction(() => document.querySelector('.touch-action.interact .target-name')?.textContent === '弗拉维');
        await activate(page.locator('.touch-action.interact'));
      } else await page.keyboard.press('KeyE');
      await page.waitForFunction(() => window.sanctuary.engine.state.panel === 'vendor' && window.sanctuary.engine.state.npc === 'flavie');
      const dialogue = await snapshot(); assert.ok(dialogue.dialogue); assert.equal(dialogue.offers, 0);
      await activate(page.locator('[data-focus="panel-close"]'));
      await page.waitForFunction(() => window.sanctuary.engine.state.panel === 'none');
      await walkTo(destination.x);
      assert.equal((await snapshot()).area, side === 2 ? 3 : 2);
    }
    const final = await snapshot();
    assert.ok(final.worldSame && final.guardSame); assert.deepEqual(final.owned, initial.owned);
    assert.deepEqual(final.control.move, { x: 0, y: 0 }); assert.deepEqual(errors, []);
    results.push({ width, passed: true, guard: { x: road.guard.x, y: road.guard.y }, nativeRoundTrip: true, nativeDialogueBothSides: true, unchangedOwnedItems: true, consoleErrors: errors.length });
  } finally { await context.close(); }
}
try { for (const width of [1440, 390, 320]) await run(width); console.log(JSON.stringify({ fixtureOnly: true, results }, null, 2)); }
finally { await browser.close(); }
