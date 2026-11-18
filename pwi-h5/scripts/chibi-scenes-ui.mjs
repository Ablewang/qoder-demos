import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ZONES } from '../src/data/world.js';
import { CLASSES, RACES } from '../src/data/classes.js';
import { ZONE_LANDMARKS } from '../src/data/landmarks.js';

const base = 'http://127.0.0.1:5183';
assert.deepEqual(Object.keys(ZONE_LANDMARKS).sort(), Object.keys(ZONES).sort());
assert.equal(new Set(Object.values(ZONE_LANDMARKS).map(entry => entry.name)).size, Object.keys(ZONES).length);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 900, height: 510 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [], external = [], regions = [], portraits = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== base) external.push(request.url()); });
try {
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
  await page.evaluate(async () => {
    const scene = await import('/src/ui/world-scene.js');
    scene.unmountWorldScene();
    document.querySelector('#app').innerHTML = '<main style="padding:20px;background:#1b191d;color:#e7ded0"><h1 id="fixture-title" style="font:18px serif;margin:0 0 8px">独立场景测试 · 不写入角色存档</h1><div id="fixture-scene" style="position:relative;width:860px;height:390px;border:1px solid #756047"></div><p id="fixture-description" style="font-size:12px;margin-top:8px"></p></main>';
    window.__sceneFixture = scene;
  });
  for (const [id, zone] of Object.entries(ZONES)) {
    const race = Object.values(RACES).find(entry => entry.home === id);
    const cls = race?.classes[0] || 'blademaster';
    const state = {
      cls, race: CLASSES[cls].race, location: id, city: zone.type === 'city', active: false,
      equipment: { weapon: { weaponType: CLASSES[cls].weapon } },
      monsters: (zone.mobs || []).map(([name, lv, rank], index) => ({ id: `fixture-${index}`, name, lv, rank, hp: 1, maxHp: 1 })),
      targetId: 'fixture-0',
    };
    const mounted = await page.evaluate(({ state, title, description }) => {
      document.querySelector('#fixture-title').textContent = `${title} · 独立美术测试`;
      document.querySelector('#fixture-description').textContent = description;
      return window.__sceneFixture.mountWorldScene(document.querySelector('#fixture-scene'), state);
    }, { state, title: `${zone.name} / ${ZONE_LANDMARKS[id].name}`, description: ZONE_LANDMARKS[id].description });
    assert.equal(mounted, true, `Region ${id} must render with WebGL`);
    const image = await page.locator('#fixture-scene canvas').screenshot({ path: `artifacts/chibi-region-${id}.png`, animations: 'disabled' });
    const hash = createHash('sha256').update(image).digest('hex');
    assert.ok(!regions.some(entry => entry.hash === hash), `${id} duplicates an earlier region image`);
    regions.push({ id, name: zone.name, landmark: ZONE_LANDMARKS[id].name, hash });
  }
  for (const [id, cls] of Object.entries(CLASSES)) {
    const mounted = await page.evaluate(state => window.__sceneFixture.mountWorldScene(document.querySelector('#fixture-scene'), state), {
      cls: id, race: cls.race, location: 'zulong', city: true, active: false, monsters: [], equipment: { weapon: { weaponType: cls.weapon } },
    });
    assert.equal(mounted, true);
    const image = await page.locator('#fixture-scene canvas').screenshot({ path: `artifacts/chibi-class-${id}.png`, animations: 'disabled' });
    const hash = createHash('sha256').update(image).digest('hex');
    assert.ok(!portraits.some(entry => entry.hash === hash), `${id} duplicates an earlier class appearance`);
    portraits.push({ id, name: cls.name, hash });
  }
  await page.evaluate(() => window.__sceneFixture.unmountWorldScene());
  assert.equal(await page.locator('#fixture-scene canvas').count(), 0);
  const contact = await context.newPage();
  for (const [kind, entries] of [['region', regions], ['class', portraits]]) {
    const tiles = await Promise.all(entries.map(async entry => {
      const image = await readFile(`artifacts/chibi-${kind}-${entry.id}.png`);
      return `<figure style="margin:0;border:1px solid #51464a;background:#242126"><img style="display:block;width:100%" src="data:image/png;base64,${image.toString('base64')}" alt=""><figcaption style="padding:7px;font:13px sans-serif">${entry.name}${entry.landmark ? ` · ${entry.landmark}` : ''}</figcaption></figure>`;
    }));
    await contact.setViewportSize({ width: 1720, height: 900 });
    await contact.setContent(`<body style="margin:0;padding:12px;background:#1b191d;color:#e7ded0"><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px">${tiles.join('')}</div></body>`);
    await contact.locator('img').last().waitFor();
    await contact.screenshot({ path: `artifacts/chibi-${kind}-contact-sheet.png`, fullPage: true });
  }
  await contact.close();
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile('artifacts/chibi-scene-results.json', JSON.stringify({ regions, portraits, errors, external, scope: 'Standalone render fixtures only; no gameplay completion or save modification' }, null, 2));
  console.log(`PASS ${regions.length} distinct region renderings, ${portraits.length} distinct class appearances, unmount cleanup; no external requests or runtime errors.`);
} finally {
  await context.close(); await browser.close();
}
