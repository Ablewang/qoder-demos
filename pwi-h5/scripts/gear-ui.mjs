import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { Game } from '../src/core/game.js';
import { ITEMS, makeEquip, refinePlan } from '../src/data/items.js';
import { stats } from '../src/core/model.js';
import { getProductionCatalog } from '../src/core/production.js';
import { MACHINE_RECIPE } from '../src/data/production.js';
import { matchesGearSpec } from '../src/data/gear-specs.js';
import { ZONES, DUNGEONS } from '../src/data/world.js';

const base = process.env.GAME_URL;
if (!/^http:\/\/127\.0\.0\.1:517[67]$/.test(base || '')) throw new Error('Use isolated 127.0.0.1 port 5177 or 5176 explicitly');
const tag = new URL(base).port === '5176' ? 'production' : 'development';
const artifacts = new URL('../artifacts/', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const initialWidth = Number(process.env.W || 1440);
const context = await browser.newContext({ viewport: { width: initialWidth, height: 1000 } });
await context.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
const page = await context.newPage();
const catalogRun = process.env.CATALOG_RUN || `${Date.now()}-${process.pid}`;
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const idle = () => page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
const visible = selector => page.locator(selector).filter({ visible: true }).first();
async function click(action, attrs = '') {
  await visible(`[data-action="${action}"]${attrs}`).click(); await idle();
}
const nav = id => click('page', `[data-id="${id}"]`);
const close = () => click('closeModal');
async function select(id, value) { await page.locator(`#${id}`).selectOption(value); await idle(); }
const record = () => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('pwi-text-backend');
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result, tx = db.transaction('saves', 'readonly'), get = tx.objectStore('saves').get('current');
    tx.oncomplete = () => { db.close(); resolve(get.result); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  };
}));
const player = async () => (await record()).snapshot.player;
async function screenshot(name) {
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: `${artifacts}catalog-gear-${tag}-${catalogRun}-${name}.png`, fullPage: true, animations: 'disabled' });
}
async function noOverflow() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  if (await visible('#modal:not(.hidden)').count()) {
    const box = await page.locator('#modal .modal-card').boundingBox();
    assert.ok(box.x >= -1 && box.x + box.width <= (await page.viewportSize()).width + 1);
  }
}
async function importFixture(snapshot) {
  await nav('guide'); const chooser = page.waitForEvent('filechooser'); await click('importPicker');
  await (await chooser).setFiles({ name: 'controlled-gear-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(snapshot)) });
  await page.locator('#dialog-title').filter({ hasText: '导入存档' }).waitFor();
  await click('confirmModal'); assert.deepEqual((await record()).snapshot.player, snapshot.player);
}
async function finishBattle() {
  for (let turn = 0; turn < 100; turn++) {
    const battle = (await record()).snapshot.battle;
    if (battle.result) return battle.result;
    const recommended = visible('[data-action="turn"].recommended:not(:disabled)');
    assert.ok(await recommended.count(), 'No executable recommended battle action');
    await recommended.click(); await idle();
  }
  throw new Error('Battle exceeded 100 rounds');
}
try {
  await page.goto(base); await page.locator('#char-name').fill('装备自然试玩');
  await page.getByRole('button', { name: '进入完美大陆' }).click(); await idle();
  const created = await record(); assert.equal(created.snapshot.player.lv, 1);
  await click('map');
  assert.equal(await page.locator('.atlas-node.city').count(), Object.values(ZONES).filter(z => z.type === 'city').length);
  await select('atlas-place', 'jifeng');
  assert.ok(await visible('[data-action="atlasStep"]').isDisabled());
  await select('atlas-place', 'h_f1'); await screenshot(`natural-atlas-${initialWidth}`);
  assert.deepEqual(await record(), created, 'Map browsing charged or moved player');
  await click('atlasStep'); assert.equal((await player()).location, 'h_f1'); await close();
  let fights = 0, wins = 0;
  while ((await player()).lv < 2 && fights < 10) {
    await click('hunt', '[data-index="0"]'); fights++;
    if (await finishBattle() === 'win') wins++;
    await click('leaveBattle');
    const current = await player();
    if (current.hp < stats(current).hp * .5) {
      await nav('bag'); await click('bagTab', '[data-id="items"]'); await click('useItem', '[data-id="hp1"]'); await nav('world');
    }
  }
  assert.ok((await player()).lv >= 2); assert.ok(wins > 0);
  await nav('quests'); await click('claim', '[data-bounty="false"]');
  const claimed = await player(); assert.equal(claimed.mainIndex, 1);
  for (const id of ['ore1', 'wood1', 'fiber1', 'hide1']) assert.ok(claimed.items[id] >= 3);
  await nav('character'); if (await visible('[data-action="allocateAuto"]:not(:disabled)').count()) await click('allocateAuto');
  await nav('world');
  const gatheredBefore = await player(); await click('gather', '[data-id="ore"]');
  assert.ok((await player()).items.ore1 > gatheredBefore.items.ore1);
  assert.ok(await visible('[data-action="gather"][data-id="wood"]').isDisabled());
  await page.waitForFunction(() => !document.querySelector('[data-action="gather"][data-id="wood"]')?.disabled);
  await click('gather', '[data-id="wood"]');
  await click('map'); await select('atlas-place', 'wanliu'); await click('atlasStep'); await close();
  await nav('town'); await click('townTab', '[data-id="activities"]'); await click('sign');
  await click('townTab', '[data-id="forge"]'); await select('production-recipe', 'ordinary-1-weapon');
  const beforeProduce = await record();
  await click('produceConfirm'); await close(); assert.deepEqual(await record(), beforeProduce);
  await click('produceConfirm'); await click('confirmModal');
  await page.locator('#dialog-title').filter({ hasText: '行囊装备详情' }).waitFor();
  let natural = await player(); const made = natural.bag.find(it => it.origin === 'production:ordinary-1-weapon');
  assert.ok(made && matchesGearSpec(made));
  assert.equal(natural.gold, beforeProduce.snapshot.player.gold - 40);
  assert.equal(natural.items.ore1, beforeProduce.snapshot.player.items.ore1 - 2);
  assert.equal(natural.items.wood1, beforeProduce.snapshot.player.items.wood1 - 1);
  assert.equal(await page.locator('#modal [data-op="reroll"],#modal [data-op="upgrade"]').count(), 0);
  await click('equip', `[data-id="${made.uid}"]`);
  await click('townTab', '[data-id="shop"]');
  await click('buy', '[data-id="socketStone"][data-qty="1"]');
  await click('buy', '[data-id="gemPatk1"][data-qty="1"]');
  await nav('character'); await click('equipped', '[data-id="weapon"]');
  if (!(await player()).equipment.weapon.sockets.includes(null)) await click('equipmentAction', '[data-op="punch"]');
  await select('socket-gem', 'gemPatk1'); await click('equipmentAction', '[data-op="socket"]');
  assert.deepEqual((await player()).equipment.weapon.sockets, ['gemPatk1']); await screenshot(`natural-detail-${initialWidth}`);
  await close(); await nav('town'); await click('townTab', '[data-id="refine"]');
  const beforeRefine = await player(), plan = refinePlan(beforeRefine.equipment.weapon);
  await click('refineConfirm', '[data-id="weapon"]'); await close(); assert.deepEqual(await player(), beforeRefine);
  await click('refineConfirm', '[data-id="weapon"]'); await click('confirmModal');
  natural = await player(); assert.equal(natural.gold, beforeRefine.gold - plan.cost);
  assert.equal(natural.items.huanxian, beforeRefine.items.huanxian - plan.stones);
  await nav('world'); await click('map'); await select('atlas-place', 'h_f1'); await click('atlasStep'); await close();
  await click('hunt', '[data-index="0"]'); assert.equal(await finishBattle(), 'win'); await click('leaveBattle');
  const naturalCheckpoint = await record(); await page.reload(); await idle(); assert.deepEqual(await record(), naturalCheckpoint);
  console.log(`Natural UI: level ${naturalCheckpoint.snapshot.player.lv}, ${fights + 1} fights, ${wins + 1} wins, quest kit, gathering, production, actual equip/socket/refine/combat/reload; no imported levels or resources.`);

  const g = new Game(); g.start('装备高阶夹具', 'blademaster');
  g.p.lv = 105; g.p.attrs = { str: 400, dex: 200, mag: 5, con: 400 }; g.p.gold = 1000000;
  g.p.items = Object.fromEntries(Object.keys(ITEMS).map(id => [id, 1000]));
  g.p.production = { blacksmith: { level: 6, exp: 0 }, tailor: { level: 6, exp: 0 }, craftsman: { level: 6, exp: 0 } };
  g.p.bag = [makeEquip('weapon', 95, 3, g.p.cls, { series: 'lunar' }), makeEquip('body', 100, 2, g.p.cls)];
  const source = g.p.bag[0], transferTarget = g.p.bag[1]; source.refine = 3; source.sockets = ['gemPatk1', null]; source.durability = 70;
  g.p.hp = stats(g.p).hp; g.p.mp = stats(g.p).mp;
  const training = structuredClone(g.state); training.player.production.blacksmith = { level: 3, exp: 5 };
  await importFixture(training); await nav('town'); await click('townTab', '[data-id="forge"]');
  const beforeTraining = await record(); await click('productionTrain', '[data-id="blacksmith"]'); await close();
  assert.deepEqual(await record(), beforeTraining);
  await click('productionTrain', '[data-id="blacksmith"]'); await click('confirmModal');
  assert.deepEqual((await player()).production.blacksmith, { level: 4, exp: 0 });
  assert.equal((await player()).gold, beforeTraining.snapshot.player.gold - 4000);
  await importFixture(g.state);
  const fixtureCheckpoint = await record(); await nav('bag'); await click('bagTab', '[data-id="arsenal"]');
  for (const cls of ['wizard', 'assassin', 'psychic', 'mystic', 'blademaster']) await select('catalog-class', cls);
  await select('catalog-slot', 'ring1'); await select('catalog-slot', 'weapon');
  for (const id of ['catalog-min-level', 'catalog-max-level']) {
    await page.locator(`#${id}`).fill('105'); await page.locator(`#${id}`).press('Tab'); await idle();
  }
  if (!await page.locator('.gear-catalog-advanced').evaluate(node => node.open)) await page.locator('.gear-catalog-advanced > summary').click();
  await select('catalog-quality', '2');
  const catalogRow = page.locator('.gear-catalog-row').first();
  assert.ok(await catalogRow.count(), 'Catalog filters must return an actual descriptor row');
  assert.match(await catalogRow.innerText(), /12品/);
  const catalogId = await catalogRow.getAttribute('data-id');
  assert.match(catalogId, /^ordinary:weapon:blade:105:2:3$/);
  assert.deepEqual(await record(), fixtureCheckpoint, 'Catalog browser altered full save record');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await noOverflow(); await screenshot(`catalog-list-${width}`);
    await click('catalogEquipmentDetail', `[data-id="${catalogId}"]`);
    assert.match(await page.locator('#modal .spec-preview').innerText(), /12品/);
    assert.ok(await page.locator('#modal .spec-affixes').evaluate(el => el.open));
    await noOverflow(); await screenshot(`catalog-modal-${width}`); await close();
    assert.deepEqual(await record(), fixtureCheckpoint, `Catalog detail at ${width}px altered full save record`);
  }
  await nav('town'); await click('townTab', '[data-id="forge"]'); await select('production-series', 'nirvana1');
  await select('production-predecessor', source.uid); await page.locator('#production-inherit').check(); await idle();
  const recipe = getProductionCatalog(await player()).recipes.find(r => r.id === 'nirvana1-100-weapon');
  const inheritance = recipe.candidates.find(c => c.uid === source.uid).inherit;
  await screenshot('inheritance-320');
  const beforeInheritance = await record(); await click('produceConfirm'); await close(); assert.deepEqual(await record(), beforeInheritance);
  await click('produceConfirm'); await click('confirmModal');
  const evolved = (await player()).bag.find(it => it.uid === source.uid);
  assert.equal(evolved.series, 'nirvana1'); assert.equal(evolved.refine, 3); assert.equal(evolved.durability, 70);
  assert.deepEqual(evolved.sockets, ['gemPatk1', null]); assert.ok(matchesGearSpec(evolved));
  assert.equal((await player()).items.qiankun, beforeInheritance.snapshot.player.items.qiankun - inheritance.qiankun);
  await close(); await click('townTab', '[data-id="refine"]'); await click('transferOpen'); await select('transfer-to', transferTarget.uid);
  const beforeTransfer = await record(); await click('transferConfirm'); await close(); assert.deepEqual(await record(), beforeTransfer);
  await click('transferOpen'); await select('transfer-to', transferTarget.uid); await click('transferConfirm'); await click('confirmModal');
  assert.equal((await player()).bag.find(it => it.uid === source.uid).refine, 0);
  assert.equal((await player()).bag.find(it => it.uid === transferTarget.uid).refine, 3);
  assert.equal((await player()).items.qiankun, beforeTransfer.snapshot.player.items.qiankun - 12);
  await click('townTab', '[data-id="forge"]'); await page.locator('.machine-workbench').evaluate(el => el.open = true);
  const beforeMachine = await player(); await click('machineConfirm'); await click('confirmModal');
  const machine = await player(); assert.equal(machine.items.ttMachine, beforeMachine.items.ttMachine + 1);
  for (const [id, count] of Object.entries(MACHINE_RECIPE.materials)) assert.equal(machine.items[id], beforeMachine.items[id] - count);
  await nav('world'); await click('map'); await select('atlas-place', 'jifeng');
  for (const width of [1440, 390, 320]) { await page.setViewportSize({ width, height: 1000 }); await noOverflow(); await screenshot(`atlas-${width}`); }
  await click('atlasZoom', '[data-delta="0.25"]'); await click('atlasLayer', '[data-id="islands"]');
  assert.ok(await page.locator('.atlas-node').count()); await click('atlasLayer', '[data-id="mainland"]');
  const beforeRoute = await player(); await click('atlasStep'); assert.notEqual((await player()).location, beforeRoute.location);
  await close();
  await nav('world'); await click('map'); await select('atlas-place', 'jifeng');
  while ((await player()).location !== 'jifeng') await click('atlasStep');
  await close(); await nav('town'); await click('townTab', '[data-id="dungeon"]');
  const beforeDungeon = await player(); await click('dungeon', '[data-id="d75"]');
  const waves = DUNGEONS.find(d => d.id === 'd75').waves;
  for (let wave = 0; wave <= waves; wave++) {
    assert.equal(await finishBattle(), 'win');
    assert.equal((await player()).bag.length, beforeDungeon.bag.length, 'Material dungeon awarded a finished equipment item');
    if (wave < waves) await click('nextWave');
  }
  const dungeon = await player();
  assert.equal(dungeon.items.tt1, beforeDungeon.items.tt1 + 4);
  assert.equal(dungeon.daily.dungeons.d75, (beforeDungeon.daily.dungeons.d75 || 0) + 1);
  await screenshot('twilight-real-materials-320'); await click('leaveBattle');
  console.log('Controlled UI: traveled to the registered Twilight entry and manually cleared every wave including the final boss; actual tt1 +4, no finished equipment, one daily entry consumed.');
  await nav('town'); await click('townTab', '[data-id="forge"]'); await select('production-series', 'twilight');
  await select('production-recipe', 'twilight-60-weapon');
  const beforeTwilight = await player(); await click('produceConfirm'); await click('confirmModal'); await close();
  const twilight = (await player()).bag.find(it => it.origin === 'production:twilight-60-weapon');
  assert.ok(twilight && matchesGearSpec(twilight)); assert.equal((await player()).items.tt1, beforeTwilight.items.tt1 - 3);
  await select('production-series', 'nirvana2'); await select('production-predecessor', source.uid);
  assert.equal(await page.locator('#production-inherit').isChecked(), false);
  const beforeLoss = await player(); await click('produceConfirm');
  assert.match(await page.locator('.modal-body').innerText(), /精炼和宝石永久丢失/);
  await click('confirmModal'); await close();
  const withoutInheritance = (await player()).bag.find(it => it.uid === source.uid);
  assert.equal(withoutInheritance.series, 'nirvana2'); assert.equal(withoutInheritance.refine, 0);
  assert.deepEqual(withoutInheritance.sockets, [null]);
  assert.equal((await player()).items.gemPatk1, beforeLoss.items.gemPatk1, 'No-inheritance incorrectly returned a gem');
  const poor = (await record()).snapshot; poor.player.gold = 0; poor.player.items.rapture = 0;
  await importFixture(poor); await nav('town'); await click('townTab', '[data-id="forge"]');
  assert.ok(await visible('[data-action="produceConfirm"]').isDisabled());
  assert.deepEqual(errors, []);
  console.log(`PASS ${tag} new gear UI: pure previews, layered gated atlas, 1440/768/390/320 layout, actual ordinary production, cultivation, cancellation, precursor/paid inheritance, refinement overwrite, machine resources, insufficient costs. High levels are controlled imported fixtures.`);
} finally { await browser.close(); }
