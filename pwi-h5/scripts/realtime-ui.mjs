import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { CLASSES, SKILLS } from '../src/data/classes.js';
import { queryEquipmentCatalog } from '../src/data/gear-catalog.js';
import { Game, validateSave } from '../src/core/game.js';
import { stats, makeMonster } from '../src/core/model.js';
import { createBattle, enableRealtime } from '../src/core/combat.js';

const base = process.env.GAME_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:(5183|5176)$/);
const tag = base.endsWith('5176') ? 'production' : 'development';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
await page.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: `
export const createHotContext = () => ({ accept() {}, prune() {}, dispose() {}, invalidate() {}, on() {}, off() {} });
export function updateStyle(id, content) { let el = [...document.querySelectorAll('style[data-vite-dev-id]')].find(el => el.dataset.viteDevId === id); if (!el) { el = document.createElement('style'); el.dataset.viteDevId = id; document.head.appendChild(el); } el.textContent = content; }
export function removeStyle(id) { [...document.querySelectorAll('style[data-vite-dev-id]')].find(el => el.dataset.viteDevId === id)?.remove(); }
` }));
page.setDefaultTimeout(20000);
const errors = [], external = [], results = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== base) external.push(request.url()); });
const visible = selector => page.locator(selector).filter({ visible: true }).first();
async function idle() { await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false'); }
async function frames(count = 18) { await page.evaluate(count => new Promise(resolve => { const step = () => --count <= 0 ? resolve() : requestAnimationFrame(step); requestAnimationFrame(step); }), count); }
async function click(action, attrs = '', root = '') { await idle(); await visible(`${root} [data-action="${action}"]${attrs}`.trim()).click(); await idle(); }
async function nav(id) {
  if (!await visible(`:is(.sidebar .nav, .mobile-nav) [data-action="page"][data-id="${id}"]`).count()) await page.locator('.mobile-nav-more > summary').click();
  await click('page', `[data-id="${id}"]`, ':is(.sidebar .nav, .mobile-nav)');
  await page.waitForFunction(id => document.querySelector('.shell')?.dataset.page === id, id);
}
async function record() {
  return page.evaluate(async () => {
    if (!(await indexedDB.databases()).some(db => db.name === 'pwi-text-backend')) throw new Error('Database must already exist');
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('pwi-text-backend');
      request.onupgradeneeded = () => { request.transaction.abort(); reject(new Error('Read cannot create database')); };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('saves', 'readonly'), get = tx.objectStore('saves').get('current');
        tx.oncomplete = () => { db.close(); resolve(get.result); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
  });
}
async function shot(name) {
  await frames(4);
  const dims = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  assert.ok(dims.content <= dims.width + 1, `${name}: horizontal overflow ${JSON.stringify(dims)}`);
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  await page.screenshot({ path: `artifacts/realtime-${tag}-${name}.png`, animations: 'disabled' });
}
try {
  await page.goto(base); await idle();
  for (const [id, cls] of Object.entries(CLASSES)) {
    await click('race', `[data-id="${cls.race}"]`); await click('class', `[data-id="${id}"]`);
    await expect(page.locator('#world-scene-host canvas')).toBeVisible(); await frames(6);
    await shot(`create-${id}`);
  }
  for (const width of [390, 320]) { await page.setViewportSize({ width, height: 844 }); await shot(`create-${width}`); }
  results.push('Ten class creation previews and narrow viewport layout');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await click('race', '[data-id="human"]'); await click('class', '[data-id="blademaster"]');
  await page.locator('#char-name').fill('实时自然试玩');
  await page.getByRole('button', { name: '进入完美大陆' }).click(); await idle();
  const created = await record(); assert.equal(created.snapshot.player.lv, 1);
  await nav('bag'); await click('bagTab', '[data-id="arsenal"]');
  await expect(page.locator('.page')).toContainText('装备图鉴');
  assert.equal(await visible('[data-action="bagTab"][data-id="specs"]').count(), 0);
  await page.locator('#catalog-class').selectOption('all');
  assert.equal(await page.locator('.gear-catalog-row').count(), queryEquipmentCatalog({ cls: 'all' }).entries.length);
  await page.locator('#catalog-slot').selectOption('weapon');
  await page.locator('#catalog-max-level').fill('1');
  await click('catalogEquipmentDetail');
  const detail = await page.locator('#modal').innerText();
  assert.match(detail, /装备属性/); assert.match(detail, /穿戴需求/); assert.match(detail, /获取方式/);
  assert.doesNotMatch(detail, /具名装备|templateId|local-tutorial|\bUID\b|"base"|"ranges"|"values"/);
  for (const width of [1440, 390, 320]) { await page.setViewportSize({ width, height: 900 }); await shot(`catalog-detail-${width}`); }
  await click('closeModal');
  await page.locator('#catalog-min-level').fill('105');
  await expect(page.locator('.catalog-filter-error')).toBeVisible();
  assert.equal(await page.locator('.gear-catalog-row').count(), 0);
  assert.deepEqual(await record(), created, 'Catalog filters and modal cannot mutate the save');
  results.push('Equipment catalog details, invalid filter, read-only browsing at 1440/390/320');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav('world'); await click('navigate', '', '.journey-focus');
  assert.equal((await record()).snapshot.player.location, 'h_f1');
  await click('claim', '[data-bounty="false"]', '.journey-focus');
  await page.evaluate(() => { window.__fieldCanvas = document.querySelector('#world-scene-host canvas'); });
  const mobsBefore = await page.locator('.scene-mob').count();
  await visible('.world-primary [data-action="hunt"][data-index="0"]').click();
  await expect(page.locator('.rt-live')).toContainText('实时交战', { timeout: 30000 });
  const engaged = await record();
  assert.equal(engaged.snapshot.battle.context.type, 'field');
  assert.deepEqual(engaged.snapshot.battle.monsters.map((m) => m.name), ['小野猪'], 'Auto-walk to the quest target does not drag in other aggressive monsters');
  assert.ok(engaged.snapshot.battle.rt.origin, 'Field fight is anchored where the player met the monster');
  await expect(page.locator('.page-title h1')).toHaveText('游历');
  await expect(page.locator('.world-rail .journey-focus')).toBeVisible();
  await expect(page.locator('.scene-header .scene-label').first()).toHaveText('野外 · 交战中');
  assert.doesNotMatch(await page.locator('.page-title').innerText(), /交战中/, 'Field fight keeps the same world page instead of a battle page');
  assert.equal(await page.locator('.rt-battle').count(), 0);
  assert.equal(await page.locator('.battle-result').count(), 0);
  assert.equal(await page.locator('[data-action="turn"]').count(), 0);
  assert.equal(await page.locator('.rt-skill').count(), 4);
  await shot('natural-first-fight');
  await expect(page.locator('.field-victory')).toContainText('击败', { timeout: 60000 });
  await idle();
  const won = await record(); assert.equal(won.snapshot.battle, null, 'Field victory returns to the map automatically');
  assert.ok(Object.values(won.snapshot.player.kills).reduce((a, b) => a + b, 0) > 0, 'Aggro or approach fight records a kill');
  assert.ok(await page.evaluate(() => document.querySelector('#world-scene-host canvas') === window.__fieldCanvas), 'Scene canvas survives the fight');
  assert.equal(await page.locator('.scene-mob').count(), mobsBefore - 1, 'Defeated field monster waits to respawn');
  await frames(24); assert.deepEqual(await record(), won, 'Finished battle cannot duplicate rewards');
  await shot('natural-first-win');
  await expect.poll(() => page.locator('.scene-mob').count(), { timeout: 20000, intervals: [200] }).toBe(mobsBefore);
  await idle();
  assert.deepEqual(await record(), won, 'Timed field respawn cannot write the save or duplicate rewards');
  assert.ok(await page.evaluate(() => document.querySelector('#world-scene-host canvas') === window.__fieldCanvas), 'Timed respawn preserves the scene canvas');
  await shot('natural-first-respawn');
  const natural = await record(); await page.reload(); await idle();
  assert.deepEqual(await record(), natural, 'Natural first fight persists exactly on refresh');
  for (let fight = 0; fight < 4 && (await record()).snapshot.player.lv < 2; fight++) {
    const before = (await record()).snapshot.player.totals.battles;
    await visible('.world-primary [data-action="hunt"]').click();
    await expect(page.locator('.rt-live')).toContainText('实时交战', { timeout: 30000 });
    await expect.poll(async () => {
      const s = (await record()).snapshot;
      return !s.battle && s.player.totals.battles > before;
    }, { timeout: 60000, intervals: [500] }).toBe(true);
    await idle();
  }
  assert.ok((await record()).snapshot.player.lv >= 2, 'Natural starting character earns Lv2 from real realtime combat');
  results.push(`Seamless field combat: aggro/approach starts on the map, auto-return and respawn; Lv1 to Lv2 without imported resources`);

  const fixture = new Game(); fixture.start('独立机制夹具', 'wizard');
  fixture.p.lv = 40; fixture.p.cult = 4; fixture.p.attrs.mag += 150; fixture.p.attrs.str += 20; fixture.p.attrs.con += 25;
  fixture.p.gold = 10000; fixture.p.sp = 10000; fixture.p.charms = { hp: 600000, mp: 900000 };
  fixture.p.charmCooldowns = { hp: 0, mp: 0 };
  for (const skill of SKILLS.wizard.filter(skill => skill.learning[0].level <= 40 && (skill.cult || 0) <= 4)) fixture.p.skills[skill.id] = 1;
  const st = stats(fixture.p); fixture.p.hp = Math.floor(st.hp * 0.4); fixture.p.mp = Math.floor(st.mp * 0.4);
  fixture.p.location = 'h_f1'; fixture.p.discovered.push('h_f1'); fixture.p.visits.push('h_f1');
  const monster = makeMonster('机制测试首领', 40, 'boss', 'magic'); monster.hp = monster.maxHp = 50000; monster.atk = 80;
  fixture.state.battle = createBattle(fixture.p, [monster], { type: 'field', zone: 'h_f1' });
  fixture.battle.monsters[0].intent = 'heavy';
  enableRealtime(fixture.p, fixture.battle); fixture.battle.rt.paused = true;
  const snapshot = validateSave(fixture.state);
  await nav('guide');
  await expect(visible('[data-action="importPicker"]')).toBeEnabled();
  const chooser = page.waitForEvent('filechooser'); await click('importPicker');
  await (await chooser).setFiles({ name: 'explicit-mechanism-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(snapshot)) });
  await expect(page.locator('#modal')).toContainText('独立机制夹具');
  await page.getByRole('button', { name: '确认替换', exact: true }).click(); await idle();
  await expect(page.locator('.rt-live')).toContainText('战斗暂停');
  const paused = await record(); await frames(30); assert.deepEqual(await record(), paused);
  await click('rtAction', '[data-id="resume"]');
  await expect(page.locator('.rt-hint')).toContainText('正在蓄力');
  const hydrated = await record(); assert.ok(hydrated.snapshot.player.charms.hp < 600000); assert.ok(hydrated.snapshot.player.charmCooldowns.hp > 0);
  await expect(page.locator('.scene-float.heal').first()).toBeVisible();
  await shot('fixture-heavy-warning');
  await page.locator('#world-scene-host canvas').focus(); await page.keyboard.down('w');
  await expect(page.locator('.combat-log')).toContainText('重击落点被你避开');
  await page.keyboard.up('w');
  const avoided = await record();
  assert.ok(avoided.snapshot.battle.rt.events.some(event => event.kind === 'miss' && event.name === '重击落空'));
  await shot('fixture-heavy-avoided');
  const origin = avoided.snapshot.battle.rt.player;
  await page.locator('#world-scene-host canvas').focus(); await page.keyboard.down('d');
  await expect.poll(async () => (await record()).snapshot.battle.rt.player.x, { timeout: 10000, intervals: [200] }).toBeGreaterThan(origin.x + 0.5);
  await page.keyboard.up('d');
  await click('rtAction', '[data-id="guard"]');
  await expect(visible('[data-action="rtAction"][data-id="guard"]')).toBeDisabled();
  await shot('fixture-guard');
  await click('rtAction', '[data-id="autoskills"]');
  assert.equal((await record()).snapshot.battle.rt.autoSkills, false);
  const castBefore = await record();
  await click('rtAction', '[data-id="skill:wz1"]');
  await expect(visible('.rt-skill[data-id="skill:wz1"]')).toBeDisabled();
  const castAfter = await record();
  assert.ok(castAfter.snapshot.battle.rt.player.readyAt > castAfter.snapshot.battle.rt.tick, 'Zero-CD starter skill still starts the shared skill cooldown');
  assert.ok(castAfter.snapshot.battle.rt.events.some(event => event.kind === 'cast' && event.seq > castBefore.snapshot.battle.rt.sequence), 'Manual cast has a committed event');
  assert.ok(castAfter.snapshot.player.mp < castBefore.snapshot.player.mp, 'Manual skill consumes actual mana');
  const stock = castAfter.snapshot.player.items.mp1;
  await click('rtAction', '[data-id="item:mp1"]');
  const restored = await record();
  assert.equal(restored.snapshot.player.items.mp1, stock - 1);
  assert.ok(restored.snapshot.battle.rt.player.potionReadyAt > restored.snapshot.battle.rt.tick);
  await expect(visible('[data-action="rtAction"][data-id="item:mp1"]')).toBeDisabled();
  await expect(page.locator('.rt-actions')).toContainText(/治疗药.*秒/);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const button = page.locator('.rt-movement [data-direction="left"]'); await button.scrollIntoViewIfNeeded();
    const before = (await record()).snapshot.battle.rt.player;
    const box = await button.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await frames(30); await page.mouse.up();
    const after = (await record()).snapshot.battle.rt.player;
    assert.ok(after.x < before.x, 'Held direction survives realtime HUD updates');
    await page.locator('.rt-panel').scrollIntoViewIfNeeded(); await shot(`fixture-controls-${width}`);
  }
  await click('rtAction', '[data-id="pause"]');
  const checkpoint = await record(); await frames(30); assert.deepEqual(await record(), checkpoint);
  await nav('bag'); await frames(20); assert.deepEqual(await record(), checkpoint);
  await nav('world'); await page.reload(); await idle();
  await expect(page.locator('.rt-live')).toContainText('战斗暂停');
  await frames(30); assert.deepEqual(await record(), checkpoint, 'Pause, browse and refresh cannot clear charm cooldowns or advance combat');
  results.push('Explicit Lv40 fixture: independent charms, movement, guard cooldown, held controls, pause/browse/reload preservation');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('.field-combat')).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await shot(`single-scene-${width}`);
  }
  await click('rtAction', '[data-id="resume"]');
  await click('rtAction', '[data-id="escape"]');
  await expect.poll(async () => (await record()).snapshot.battle, { timeout: 10000 }).toBeNull();
  const defeat = new Game(); defeat.start('阵亡机制夹具', 'blademaster');
  defeat.p.location = 'h_f1'; defeat.p.discovered.push('h_f1'); defeat.p.visits.push('h_f1'); defeat.p.hp = 1;
  const fatal = makeMonster('阵亡测试敌人', 1, '', 'phys'); fatal.hp = fatal.maxHp = 50000; fatal.atk = 10000;
  defeat.state.battle = createBattle(defeat.p, [fatal], { type: 'field', zone: 'h_f1' });
  enableRealtime(defeat.p, defeat.battle); defeat.battle.rt.paused = true;
  await nav('guide');
  await expect(visible('[data-action="importPicker"]')).toBeEnabled();
  const defeatChooser = page.waitForEvent('filechooser'); await click('importPicker');
  await (await defeatChooser).setFiles({ name: 'explicit-defeat-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(validateSave(defeat.state))) });
  await page.getByRole('button', { name: '确认替换', exact: true }).click(); await idle();
  await click('rtAction', '[data-id="resume"]');
  await expect(page.locator('.world-scene .field-victory.defeat')).toContainText('阵亡，返回', { timeout: 15000 });
  await expect(page.locator('.page-title h1')).toHaveText('游历');
  assert.equal(await page.locator('.battle-result').count(), 0);
  const fallen = (await record()).snapshot;
  assert.equal(fallen.battle, null); assert.equal(fallen.player.location, fallen.player.lastCity);
  assert.equal(fallen.player.totals.deaths, 1);
  await shot('single-scene-defeat');
  results.push('Single scene at 1440/390/320; defeat auto-settles on world page and returns to city without a battle-result page');
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log(`${tag}: PASS ${JSON.stringify({ results, errors, external })}`);
} catch (error) {
  console.error(JSON.stringify({ results, errors, external }));
  await page.screenshot({ path: `artifacts/realtime-${tag}-failure.png`, fullPage: true });
  throw error;
} finally { await context.close(); await browser.close(); }
