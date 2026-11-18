import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('./', import.meta.url));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const results = { checks: [], screenshots: [], fixture: 'Engine time accelerated only to reach reproducible branches; cards, pause and resume use real DOM controls.' };
async function shot(name) { await page.waitForTimeout(280); const file = `${stamp}-effect-${name}.png`; await page.screenshot({ path: out + file, fullPage: true }); results.screenshots.push(file); }
async function state() { return page.evaluate(() => { const g = window.__rtdGame; return { phase: g.phase, wave: g.wave, paused: g.paused, reading: g.reading, freeze: g.freeze, cooldown: g.cooldown, elapsed: g.elapsed, target: g.target ? { uid: g.target.uid, kind: g.target.question.kind, asker: g.target.asker } : null, active: g.active.map(q => ({ uid: q.uid, remaining: q.remaining })), lastEffect: g.lastEffect, pending: g.pending, log: g.log }; }); }
async function advance(seconds) { await page.evaluate(s => { const g = window.__rtdGame; for (let i = 0; i < s * 4; i++) g.tick(0.25); }, seconds); await page.waitForTimeout(60); }
async function open(seed) { await page.goto(`http://127.0.0.1:5211/?probe=1&seed=${seed}`); await page.locator('[data-action="start"]').click(); }
async function click(s) { await page.waitForFunction(s => { const e = document.querySelector(s); return e && !e.disabled; }, s); await page.locator(s).click(); }
try {
  await page.goto('http://127.0.0.1:5211/?probe=1');
  const seeds = await page.evaluate(async () => {
    const { Game } = await import('/src/engine.ts');
    const found = {};
    for (let seed = 1; seed <= 200 && (!found.critical || !found.warmFlop); seed++) {
      const first = new Game('single', seed);
      first.play('crazy');
      if (first.lastEffect === 'critical' && !found.critical) found.critical = seed;
      const warm = new Game('single', seed);
      for (let i = 0; i < 1000 && warm.wave === 0; i++) {
        if (warm.phase === 'reward') warm.reward('crazy');
        else { warm.skipReading(); if (warm.canPlay('taiji')) warm.play('taiji'); warm.tick(0.25); }
      }
      if (warm.target?.question.kind === 'warm') { while (warm.lock > 0) warm.tick(0.25); warm.play('crazy'); if (warm.lastEffect === 'flop' && !found.warmFlop) found.warmFlop = seed; }
    }
    return found;
  });
  assert(seeds.critical && seeds.warmFlop);
  results.seeds = seeds;
  await open(seeds.critical);
  await click('[data-card="crazy"]');
  const crit = await state();
  assert.equal(crit.lastEffect, 'critical'); assert(crit.freeze > 2);
  await page.waitForTimeout(600);
  assert.deepEqual((await state()).active, crit.active);
  await click('[data-action="pause"]');
  const frozen = await state();
  await page.waitForTimeout(1000);
  const paused = await state();
  assert.equal(paused.elapsed, frozen.elapsed); assert.equal(paused.freeze, frozen.freeze); assert.deepEqual(paused.active, frozen.active);
  await shot('critical-paused');
  await click('[data-action="resume"]');
  await shot('critical-feedback');
  results.checks.push('Critical actually freezes patience; manual pause freezes the remaining critical freeze time and resumes correctly');
  await open(seeds.warmFlop);
  for (let i = 0; i < 300; i++) {
    const g = await state();
    if (g.wave === 1 && g.target?.kind === 'warm') break;
    if (g.phase === 'reward') await click('[data-reward="crazy"]');
    else { if (g.reading > 0) await click('[data-action="read"]'); if (g.target && await page.locator('[data-card="taiji"]').isEnabled()) await click('[data-card="taiji"]'); await advance(0.5); }
  }
  assert.equal((await state()).target.kind, 'warm');
  await click('[data-card="crazy"]');
  const flop = await state();
  assert.equal(flop.lastEffect, 'flop');
  assert.deepEqual(flop.pending[0].askers, ['erjiu']);
  assert.match(await page.locator('.reply-to').innerText(), /发疯翻车 · 奶奶/);
  assert.match(await page.locator('[data-live="status"]').innerText(), /引来追问，正在排队/);
  await shot('warm-flop');
  results.checks.push('Grandma crazy flop is attributed to grandma, but queued follow-up is not falsely assigned to grandma');
  await advance(0.5);
  await click('[data-card="sincere"]');
  for (let i = 0; i < 40; i++) { await advance(0.5); if ((await state()).log.some(e => e.outcome === 'ally')) break; }
  const ally = (await state()).log.filter(e => e.outcome === 'ally').slice(-1)[0];
  assert(ally);
  assert.equal(await page.locator('.read-row').getAttribute('data-feedback-uid'), String(ally.uid));
  assert.match(await page.locator('.reply-to').innerText(), /奶奶帮腔/);
  await shot('ally-interception');
  results.checks.push('Actual ally interception has its own resolved UID and grandma-helping label, rather than current target attribution');
  results.passed = true;
} catch (e) { results.passed = false; results.failure = String(e.stack || e); process.exitCode = 1; console.error(results.failure); await shot('failure'); }
finally { await writeFile(`${out}${stamp}-effect-results.json`, JSON.stringify(results, null, 2)); await browser.close(); }
console.log(results);
