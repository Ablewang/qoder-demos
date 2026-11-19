import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { ZONES } from '../src/data/world.js';
import { CLASSES, RACES } from '../src/data/classes.js';

const base = 'http://127.0.0.1:5183';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1024, height: 650 }, reducedMotion: 'reduce' });
await context.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: `
export const createHotContext = () => ({ accept() {}, prune() {}, dispose() {}, invalidate() {}, on() {}, off() {} });
export function updateStyle(id, content) { let el = [...document.querySelectorAll('style[data-vite-dev-id]')].find(el => el.dataset.viteDevId === id); if (!el) { el = document.createElement('style'); el.dataset.viteDevId = id; document.head.appendChild(el); } el.textContent = content; }
export function removeStyle(id) { [...document.querySelectorAll('style[data-vite-dev-id]')].find(el => el.dataset.viteDevId === id)?.remove(); }
` }));
const page = await context.newPage(); const errors = [], external = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== base) external.push(request.url()); });
let approaches = 0;
try {
  await page.goto(base); await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
  await page.evaluate(async () => {
    const scene = await import('/src/ui/world-scene.js'); scene.unmountWorldScene();
    document.querySelector('#app').innerHTML = '<main style="padding:16px;background:#1b191d;color:#e7ded0"><h1 id="scene-fixture-title" style="font:18px serif;margin:0 0 8px">区域行走测试 · 不写入存档</h1><div id="scene-fixture" style="position:relative;width:980px;height:540px"></div></main>';
    window.__movingScene = scene;
  });
  for (const [id, zone] of Object.entries(ZONES)) {
    const cls = Object.values(RACES).find(race => race.home === id)?.classes[0] || 'blademaster';
    const monsters = (zone.mobs || []).map(([name, lv, rank], i) => ({ id: `field-${i}`, name, lv, rank, hp: 1, maxHp: 1, ambient: true }));
    const state = { cls, race: CLASSES[cls].race, location: id, city: zone.type === 'city', active: false, explorable: true, movementEnabled: true, monsters, targetId: monsters[0]?.id || null };
    assert.equal(await page.evaluate(state => { document.querySelector('#scene-fixture-title').textContent = `${state.location} · 区域行走测试`; return __movingScene.mountWorldScene(document.querySelector('#scene-fixture'), state); }, state), true);
    const initial = await page.evaluate(() => __movingScene.getWorldMovement());
    assert.equal(initial.location, id); assert.equal(initial.enabled, true);
    if (monsters.length) {
      for (const monster of [monsters[0], ...(monsters.length > 1 ? [monsters.at(-1)] : [])]) {
        assert.equal(await page.evaluate(id => __movingScene.approachWorldTarget(id), monster.id), true, `${id}/${monster.name} must be reachable`);
        approaches++;
      }
    } else {
      await page.locator('#scene-fixture canvas').focus(); await page.keyboard.down('d');
      try { await page.waitForFunction(initial => { const now = __movingScene.getWorldMovement(); return Math.hypot(now.x - initial.x, now.z - initial.z) > .3; }, initial); }
      finally { await page.keyboard.up('d'); }
    }
    await page.evaluate(() => __movingScene.stopWorldMovement());
    assert.equal((await page.evaluate(() => __movingScene.getWorldMovement())).moving, false);
    if (['wanliu', 'jiyu', 'zulong', 'f_jifeng', 'f_longgong'].includes(id)) {
      await page.evaluate(() => __movingScene.toggleWorldOverview());
      await page.locator('#scene-fixture canvas').screenshot({ path: `artifacts/movement-region-${id}.png`, animations: 'disabled' });
    }
    console.log(`PASS ${id}: movement and ${monsters.length ? 'first/last monster paths' : 'city key movement'}`);
  }
  await page.evaluate(async () => {
    const monster = { id: 'field-0', name: '小野猪', lv: 1, rank: 'normal', hp: 1, maxHp: 1, aggro: 0 };
    __movingScene.mountWorldScene(document.querySelector('#scene-fixture'), { cls: 'blademaster', location: 'h_f1', city: false, explorable: true, movementEnabled: true, active: false, monsters: [monster], targetId: monster.id });
    window.__touchEvents = [];
    document.addEventListener('scene-aggro', ev => __touchEvents.push(ev.detail.id));
    await __movingScene.approachWorldTarget(monster.id);
  });
  assert.deepEqual(await page.evaluate(() => __touchEvents), [], 'Passive monster does not aggro at approach range');
  await page.evaluate(() => {
    const at = __movingScene.getWorldMovement();
    const layout = __movingScene.getEncounterLayout('field-0');
    const dx = layout.origin.x + layout.enemy.x - at.x;
    const dz = layout.origin.z + layout.enemy.z - at.z;
    const horizontal = dx * Math.cos(0.27) - dz * Math.sin(0.27);
    const vertical = dx * Math.sin(0.27) + dz * Math.cos(0.27);
    __movingScene.moveWorldDirection(horizontal > 0 ? 'right' : 'left');
    __movingScene.moveWorldDirection(vertical > 0 ? 'down' : 'up');
  });
  await page.waitForFunction(() => __touchEvents.length === 1);
  assert.deepEqual(await page.evaluate(() => __touchEvents), ['field-0'], 'Manual movement into passive touch radius triggers combat without target click');
  const touch = await page.evaluate(() => __movingScene.getWorldMovement());
  assert.ok(touch.distance <= 1.6 && !touch.moving);
  console.log('PASS passive monster touch radius starts combat once on manual approach');
  const battlePosition = await page.evaluate(async () => {
    const host = document.querySelector('#scene-fixture');
    const field = { id: 'field-0', name: '啄木鸟精', lv: 1, rank: 'normal', hp: 1, maxHp: 1 };
    const state = { cls: 'cleric', location: 'e_f1', city: false, explorable: true, movementEnabled: true, active: false, monsters: [field], targetId: field.id };
    __movingScene.mountWorldScene(host, state);
    const arrived = await __movingScene.approachWorldTarget(field.id);
    const near = __movingScene.getWorldMovement();
    const enemy = { ...field, id: 'combat-fixture', hp: 10, maxHp: 10 };
    __movingScene.mountWorldScene(host, { ...state, active: true, movementEnabled: false, monsters: [enemy], targetId: enemy.id });
    const fighting = __movingScene.getWorldMovement();
    __movingScene.mountWorldScene(host, { ...state, active: false, movementEnabled: false, monsters: [{ ...enemy, hp: 0 }], targetId: enemy.id });
    return { arrived, near, fighting, ended: __movingScene.getWorldMovement() };
  });
  assert.equal(battlePosition.arrived, true);
  for (const phase of ['fighting', 'ended']) {
    assert.equal(battlePosition[phase].enabled, false);
    assert.equal(battlePosition[phase].x, battlePosition.near.x);
    assert.equal(battlePosition[phase].z, battlePosition.near.z);
    assert.equal(battlePosition[phase].distance, battlePosition.near.distance, 'Combat results must not teleport the fallen enemy');
  }
  console.log('PASS battle start and result preserve actual player and enemy positions');
  const p = await page.evaluate(() => __movingScene.getWorldMovement());
  await page.evaluate(() => __movingScene.unmountWorldScene());
  assert.equal(await page.locator('#scene-fixture canvas').count(), 0);
  assert.equal(await page.evaluate(() => __movingScene.getWorldMovement()), null);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log(`SUMMARY ${Object.keys(ZONES).length} regions, ${approaches} first/last target approaches, reduced-motion city keys and renderer cleanup passed. Standalone spatial fixtures only; no character save or progression.`);
} finally { await context.close(); await browser.close(); }
