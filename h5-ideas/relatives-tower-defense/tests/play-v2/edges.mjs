import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

const out = fileURLToPath(new URL('./', import.meta.url));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const results = { checks: [], screenshots: [], fixture: 'Real engine through DOM clicks. Time accelerated by repeated Game.tick(0.25) ONLY for edge reproductions, not natural full-game evidence.' };
async function page(seed) {
  const p = await browser.newPage({ viewport: { width: 320, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(`http://127.0.0.1:5211/?seed=${seed}&probe=1`);
  await p.locator('[data-action="start"]').click();
  return p;
}
async function advance(p, seconds) {
  await p.evaluate(seconds => { const g = window.__rtdGame; for (let i = 0; i < seconds * 4; i++) g.tick(0.25); }, seconds);
  await p.waitForTimeout(60);
}
async function shot(p, name) { await p.waitForTimeout(280); const file = `${stamp}-edge-${name}.png`; await p.screenshot({ path: out + file, fullPage: true }); results.screenshots.push(file); }
async function until(p, predicate) {
  for (let i = 0; i < 500; i++) {
    const g = await p.evaluate(() => { const g = window.__rtdGame; return { phase: g.phase, wave: g.wave, active: g.active.map(q => ({ uid: q.uid, asker: q.asker, remaining: q.remaining, kind: q.question.kind })), reading: g.reading, target: g.target ? { uid: g.target.uid, kind: g.target.question.kind } : null }; });
    if (predicate(g)) return g;
    if (g.phase === 'reward') await p.locator('[data-reward="crazy"]').click();
    else {
      if (g.reading > 0) await p.locator('[data-action="read"]').click();
      if (g.wave === 0 && g.target) {
        const button = p.locator('[data-card="taiji"]');
        if (!(await button.isDisabled())) await button.click();
      }
      await advance(p, 0.5);
    }
  }
  throw new Error('edge state not reached');
}
try {
  const same = await page(4);
  const shared = await until(same, g => g.wave === 1 && g.active.length === 2 && g.active[0].asker === g.active[1].asker);
  assert.equal(await same.locator('.talks.same-asker').count(), 1);
  assert.equal(await same.locator('.talks.same-asker .question').count(), 2);
  for (const q of shared.active) { await same.locator(`[data-target="${q.uid}"]`).click(); assert.equal(await same.locator(`[data-target="${q.uid}"]`).getAttribute('aria-pressed'), 'true'); }
  const geometry = await same.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, height: innerHeight, bottoms: [...document.querySelectorAll('.answer-card')].map(e => e.getBoundingClientRect().bottom), hits: [...document.querySelectorAll('.question')].map(e => { const r = e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }) }));
  assert(geometry.scroll <= geometry.width);
  assert(geometry.bottoms.every(bottom => bottom <= geometry.height), JSON.stringify(geometry));
  assert(geometry.hits.every(Boolean));
  await shot(same, 'same-asker');
  results.checks.push('Seed 4: concurrent questions retain independent UIDs inside one speaker-connected comic bubble');
  const expired = await page(1);
  const asyncState = await until(expired, g => g.wave === 1 && g.active.length === 2 && g.active.every(q => q.kind !== 'warm') && g.active[0].asker !== g.active[1].asker);
  const old = asyncState.active[0];
  await expired.locator(`[data-target="${asyncState.active[1].uid}"]`).click();
  if (await expired.locator('[data-action="read"]').count()) await expired.locator('[data-action="read"]').click();
  await advance(expired, old.remaining + 0.3);
  const label = await expired.locator('.reply-to').innerText();
  assert.match(label, /这句没接住 · /);
  assert.equal(await expired.locator('.read-row').getAttribute('data-feedback-uid'), String(old.uid));
  await shot(expired, 'async-timeout');
  results.checks.push('Timeout of a non-current UID retains the expired asker in visible feedback even after another question spawns');
  const empty = await page(2);
  await empty.locator('[data-action="pause"]').click();
  await empty.locator('[data-action="finish"]').click();
  assert.equal(await empty.locator('.result-speech small').innerText(), '离席时想说');
  await empty.locator('[data-action="poster"]').click();
  await empty.locator('.poster-image').evaluate(img => img.decode());
  await shot(empty, 'zero-answer-poster');
  results.checks.push('Zero-play result uses "离席时想说", not an invented quote claimed as spoken');
  results.passed = true;
} catch (e) { results.passed = false; results.failure = String(e.stack || e); process.exitCode = 1; console.error(results.failure); }
finally { await writeFile(`${out}${stamp}-edge-results.json`, JSON.stringify(results, null, 2)); await browser.close(); }
console.log(results);
