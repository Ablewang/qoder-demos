import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { ZONES } from '../src/data/world.js';
import { WORLD_TERRITORIES } from '../src/data/territories.js';
import { ATLAS_NODES, routeTo } from '../src/data/atlas.js';
import { Game, validateSave } from '../src/core/game.js';

const base = process.env.GAME_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:(5183|5176)$/);
const tag = base.endsWith('5176') ? 'production' : 'development';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
await page.route('**/@vite/client', r => r.fulfill({ contentType: 'application/javascript', body: `
export const createHotContext=()=>({accept(){},prune(){},dispose(){},invalidate(){},on(){},off(){}});
export function updateStyle(id,content){let s=[...document.querySelectorAll('style[data-vite-dev-id]')].find(s=>s.dataset.viteDevId===id);if(!s){s=document.createElement('style');s.dataset.viteDevId=id;document.head.append(s)}s.textContent=content}
export function removeStyle(id){document.querySelectorAll('style[data-vite-dev-id]').forEach(s=>{if(s.dataset.viteDevId===id)s.remove()})}
` }));
page.setDefaultTimeout(20000);
const errors = [], external = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== base) external.push(r.url()); });
const visible = s => page.locator(s).filter({ visible: true }).first();
const idle = () => page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
async function click(action, attrs = '', root = '') { await idle(); await visible(`${root} [data-action="${action}"]${attrs}`.trim()).click(); await idle(); }
async function nav(id) {
  const s = `:is(.sidebar .nav, .mobile-nav) [data-action="page"][data-id="${id}"]`;
  if (!await visible(s).count()) await page.locator('.mobile-nav-more > summary').click();
  await visible(s).click(); await idle();
}
async function record() {
  return page.evaluate(async () => {
    if (!(await indexedDB.databases()).some(db => db.name === 'pwi-text-backend')) throw new Error('Read cannot create database');
    return new Promise((resolve, reject) => {
      const r = indexedDB.open('pwi-text-backend');
      r.onupgradeneeded = () => { r.transaction.abort(); reject(new Error('Cannot create database')); };
      r.onerror = () => reject(r.error);
      r.onsuccess = () => { const db = r.result, tx = db.transaction('saves', 'readonly'), get = tx.objectStore('saves').get('current'); tx.oncomplete = () => { db.close(); resolve(get.result); }; tx.onabort = () => { db.close(); reject(tx.error); }; };
    });
  });
}
async function select(id) { await page.locator('#atlas-place').selectOption(id); await expect(page.locator('.atlas-detail h2')).toHaveText(ZONES[id].name); }
async function shot(name, width) {
  await page.setViewportSize({ width, height: width > 760 ? 1000 : 844 });
  await page.evaluate(() => { document.querySelector('.modal-body').scrollTop = 0; });
  await page.waitForFunction(() => [...document.querySelectorAll('.atlas-source-map')].every(i => i.complete && i.naturalWidth === 436));
  await page.waitForFunction(() => !document.querySelector('#toast')?.classList.contains('show'));
  const dimensions = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, modal: document.querySelector('.atlas-modal').getBoundingClientRect().toJSON(), scroll: document.querySelector('.atlas-scroll').getBoundingClientRect().toJSON(), map: document.querySelector('.atlas-canvas').getBoundingClientRect().toJSON(), scrollHeight: document.querySelector('.atlas-scroll').scrollHeight, clientHeight: document.querySelector('.atlas-scroll').clientHeight }));
  assert.ok(dimensions.documentWidth <= width + 1, `${width}: document overflow`);
  assert.ok(dimensions.map.width <= dimensions.scroll.width + 1 && dimensions.scrollHeight <= dimensions.clientHeight + 1, `${width}: full atlas fits map viewport ${JSON.stringify(dimensions)}`);
  if (width <= 760) { assert.ok(dimensions.modal.x <= 1 && dimensions.modal.y <= 1 && dimensions.modal.width >= width - 1, 'Mobile dialog is full screen'); }
  await page.screenshot({ path: `artifacts/atlas-${tag}-${name}-${width}.png`, animations: 'disabled' });
}
let browsing = 0, travelHops = 0;
try {
  await page.goto(base); await idle();
  await page.locator('#char-name').fill('地图自然试玩');
  await page.getByRole('button', { name: '进入完美大陆' }).click(); await idle();
  await click('map');
  await expect(page.locator('.atlas-territory')).toHaveCount(47);
  await expect(page.locator('.territory-primary')).toHaveCount(47);
  const initial = await record(); assert.equal(initial.snapshot.player.lv, 1);
  await select('wl_city'); await expect(visible('[data-action="atlasStep"]')).toBeDisabled();
  for (const width of [1440, 390, 320]) {
    await shot('whole-map', width);
    await page.locator(`.territory-primary[data-id="${WORLD_TERRITORIES[5].primary}"]`).click();
    await expect(page.locator('.atlas-detail h2')).toHaveText('万劫城');
    if (width <= 760) await expect(page.locator('.atlas-detail h2')).toBeInViewport();
    await expect(page.locator('.atlas-supplements .map-place')).toHaveCount(6);
    await page.locator('.atlas-supplements > summary').click();
    for (const id of ['lingyuan', 'g_f1', 'g_f2', 'wl_cangmang', 'wl_jimo', 'f_kuangkeng']) {
      await click('mapPick', `[data-id="${id}"]`, '.atlas-supplements');
      await expect(page.locator('.atlas-detail h2')).toHaveText(ZONES[id].name);
      await expect(page.locator(`.atlas-canvas [data-id="${id}"]`)).toHaveCount(0);
      if (width <= 760) {
        try { await expect(page.locator('.atlas-detail h2')).toBeInViewport(); }
        catch (error) {
          console.error('Supplement scroll', await page.evaluate(() => Object.fromEntries(['.modal-body', '.atlas-detail', '.atlas-detail h2', '.atlas-supplements'].map(s => { const el = document.querySelector(s); return [s, { bounds: el.getBoundingClientRect().toJSON(), scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }]; }))));
          await page.screenshot({ path: `artifacts/atlas-${tag}-supplement-scroll-${width}.png`, animations: 'disabled' });
          throw error;
        }
      }
    }
    await click('atlasLayer', '[data-id="islands"]'); await expect(page.locator('.atlas-territory')).toHaveCount(0);
    await expect(page.locator('.atlas-canvas')).toHaveClass(/islands/);
    await click('atlasLayer', '[data-id="otherworld"]'); await expect(page.locator('.atlas-canvas')).toHaveClass(/otherworld/);
    await click('atlasLayer', '[data-id="mainland"]'); await expect(page.locator('.atlas-territory')).toHaveCount(47);
    await click('atlasZoom', '[data-delta="0.25"]');
    await click('atlasZoom', '[data-delta="0.25"]');
    const dimensions = await page.locator('.atlas-scroll').evaluate(el => ({ width: el.clientWidth, height: el.clientHeight, contentWidth: el.scrollWidth, contentHeight: el.scrollHeight }));
    assert.ok(dimensions.contentWidth > dimensions.width && dimensions.contentHeight > dimensions.height, `${width}: magnified map can scroll in both axes`);
    await page.locator('.atlas-scroll').evaluate(el => el.scrollTo(0, 0));
    await page.locator('.atlas-scroll').focus(); await page.keyboard.press('PageDown');
    await expect.poll(() => page.locator('.atlas-scroll').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => page.locator('.atlas-scroll').evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    await page.locator('#atlas-place').selectOption('wl_city');
    const centered = await page.locator('.atlas-scroll').evaluate(el => { const box = el.getBoundingClientRect(), marker = el.querySelector('.atlas-node.selected').getBoundingClientRect(); return marker.x + marker.width / 2 >= box.x && marker.x + marker.width / 2 <= box.right && marker.y + marker.height / 2 >= box.y && marker.y + marker.height / 2 <= box.bottom; });
    assert.ok(centered, `${width}: selected destination stays within magnified map viewport`);
    await click('atlasFit');
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const query of ['万劫城', '北屏镇', '通天湖', '不存在的地点', '<img src=x onerror=alert(1)>']) {
    await page.locator('#atlas-search').fill(query);
    if (query.includes('不存在') || query.startsWith('<')) await expect(page.locator('.map-hierarchy')).toContainText('没有匹配');
    else await expect(page.locator('.map-hierarchy .map-region')).toHaveCount(1);
    assert.equal(await page.locator('.map-hierarchy img').count(), 0);
  }
  await page.locator('#atlas-search').fill('');
  for (const [id, zone] of Object.entries(ZONES)) {
    await select(id); browsing++;
    await expect(page.locator('.atlas-territory')).toHaveCount(ATLAS_NODES[id].layer === 'mainland' ? 47 : 0);
    await expect(page.locator('.atlas-landmark strong')).toHaveText(zone.name);
  }
  await select('wanliu');
  for (const territory of WORLD_TERRITORIES) {
    await page.locator(`.territory-primary[data-id="${territory.primary}"]`).click();
    await expect(page.locator('.atlas-detail h2')).toHaveText(ZONES[territory.primary].name);
    await expect(page.locator(`.atlas-territory[data-territory="${territory.id}"]`)).toHaveClass(/selected/);
  }
  await select('wanliu');
  await click('atlasRoads'); assert.ok(await page.locator('.atlas-roads path').count() > 50);
  await click('atlasRoads'); await expect(page.locator('.atlas-roads path')).toHaveCount(0);
  await click('atlasZoom', '[data-delta="0.25"]'); await expect(page.locator('.atlas-scroll')).not.toHaveClass(/atlas-fit/);
  await click('atlasFit');
  assert.deepEqual(await record(), initial, 'Map selection, searches, layers, zoom and roads do not write save');
  await select('h_f1'); await click('atlasStep');
  const natural = await record(); assert.equal(natural.snapshot.player.location, 'h_f1'); assert.equal(natural.snapshot.player.lv, 1);
  await click('closeModal'); await expect(page.locator('#world-scene-host canvas')).toBeVisible();
  await expect(page.locator('.scene-mob')).toHaveCount(ZONES.h_f1.mobs.length);
  await page.reload(); await idle(); assert.equal((await record()).snapshot.player.location, 'h_f1');

  const fixture = new Game(); fixture.start('地图高等级夹具', 'blademaster'); fixture.p.lv = 105; fixture.p.cult = 11; fixture.p.gold = 100000;
  const snapshot = validateSave(fixture.state);
  await nav('guide'); const chooser = page.waitForEvent('filechooser'); await click('importPicker');
  await (await chooser).setFiles({ name: 'explicit-atlas-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(snapshot)) });
  await page.getByRole('button', { name: '确认替换', exact: true }).click(); await idle(); await nav('world');
  const destinations = ['北屏镇', '万劫城', '通天湖', '桃源镇', '碎梦岛', '英雄冢地宫'];
  for (const name of destinations) {
    const id = Object.keys(ZONES).find(id => ZONES[id].name === name); assert.ok(id, `Actual ${name} exists`);
    await click('map'); await select(id);
    let current = (await record()).snapshot.player;
    while (current.location !== id) {
      const path = routeTo(current.location, id, current); assert.ok(path?.length > 1);
      await click('atlasStep'); current = (await record()).snapshot.player; travelHops++;
      assert.equal(current.location, path[1]);
    }
    await click('closeModal'); await expect(page.locator('#world-scene-host canvas')).toBeVisible();
    await expect(page.locator('.scene-mob')).toHaveCount((ZONES[id].mobs || []).length);
    await page.reload(); await idle(); assert.equal((await record()).snapshot.player.location, id);
  }
  await click('map'); await select('wl_city');
  for (const width of [1440, 390, 320]) {
    await select('wl_city'); await shot('wanliu-settlements', width);
    await page.locator('.atlas-selected-places').scrollIntoViewIfNeeded();
    await expect(page.locator('.atlas-selected-places')).toContainText('北屏镇');
    await expect(page.locator('.atlas-selected-places')).toContainText('东屏镇');
    await expect(page.locator('.atlas-selected-places')).toContainText('南屏镇');
    await page.screenshot({ path: `artifacts/atlas-${tag}-wanliu-town-list-${width}.png`, animations: 'disabled' });
    const before = await record();
    for (const id of ['t_beiping', 't_dongping', 't_nanping']) {
      await click('mapPick', `[data-id="${id}"]`, '.atlas-selected-places');
      await expect(page.locator('.atlas-detail h2')).toHaveText(ZONES[id].name);
      if (width <= 760) await expect(page.locator('.atlas-detail h2')).toBeInViewport();
    }
    assert.deepEqual(await record(), before, 'Town selection does not travel or write save');
    await page.screenshot({ path: `artifacts/atlas-${tag}-wanliu-town-detail-${width}.png`, animations: 'disabled' });
  }
  let persistedDestinations = 0;
  if (tag === 'development') {
    const report = await page.evaluate(async ({ snapshot, ids }) => {
      const { LocalBackend } = await import('/src/core/api.js');
      const { routeTo } = await import('/src/data/atlas.js');
      const databaseName = `atlas-route-fixture-${crypto.randomUUID()}`;
      let api = await LocalBackend.open({ databaseName, legacyStorage: null }); let destinations = 0, hops = 0;
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      try {
        await api.request('POST', '/v1/save/import', { snapshot, confirm: true });
        for (const id of ids) {
          const path = routeTo(api.game.p.location, id, api.game.p); check(path, `${id}: backend route`);
          for (const next of path.slice(1)) {
            await api.request('POST', '/v1/world/travel', { id: next }); hops++;
            check((await api.store.current()).snapshot.player.location === next, `${next}: persisted step`);
          }
          api.close(); api = await LocalBackend.open({ databaseName, legacyStorage: null });
          check(!api.loadError && api.game.p.location === id, `${id}: reopen database and validate`); destinations++;
        }
        return { destinations, hops };
      } finally {
        api.close();
        await new Promise((resolve, reject) => { const r = indexedDB.deleteDatabase(databaseName); r.onsuccess = resolve; r.onerror = () => reject(r.error); r.onblocked = () => reject(new Error('Fixture database close failed')); });
      }
    }, { snapshot, ids: Object.keys(ZONES) });
    persistedDestinations = report.destinations;
    console.log('Independent fixture database', JSON.stringify(report));
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log(JSON.stringify({ tag, territories: 47, destinationsBrowsed: browsing, actualUiTravelHops: travelHops, persistedDestinations, result: 'PASS full-map fit at 1440/390/320; 47 clicks, search/XSS, read-only browsing, gates, natural Lv1 travel, explicit fixture route steps, reload and actual scenes', errors, external }, null, 2));
} finally { await browser.close(); }
