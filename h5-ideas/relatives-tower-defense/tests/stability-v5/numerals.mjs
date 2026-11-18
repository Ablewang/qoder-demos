import { chromium } from '@playwright/test';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const report = { kind: 'STATIC NUMERAL FIXTURES: explicitly replace probe state/log; not natural games or unit-test counts', fontSimulation: 'CSS --text-scale; not actual OS settings', cases: [], errors: [], passed: false };
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const matrix = [[320,568,1],[320,740,1],[390,844,1],[1280,800,1],[320,568,1.3],[320,740,1.3],[390,844,1.3],[1280,800,1.3],[740,320,1],[740,320,1.3],[320,740,2],[740,320,2]];
try {
  for (const [width, height, scale] of matrix) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    for (const identity of ['single', 'married', 'graduate', 'exam']) {
      await page.goto('http://127.0.0.1:5211/?probe=1&seed=19');
      await page.evaluate(s => document.documentElement.style.setProperty('--text-scale', String(s)), scale);
      await page.locator(`[data-identity=${identity}]`).click();
      await page.locator('[data-action=start]').click();
      await page.waitForTimeout(650);
      const evidence = await page.evaluate(async () => {
        const g = window.__rtdGame;
        const q = g.active[0];
        const values = [0,1,8,9,10,18,30,99,100];
        const selectors = ['.battle-top','.battle-scene','.talks','.read-row','.ghost-slot','.hand','.battle-footnote','.mood','.mood b','.dish-title', ...[...document.querySelectorAll('[data-card]')].map(e => `[data-card=${e.dataset.card}]`)];
        let baseline = null, delta = 0;
        const issues = [], observations = [];
        for (let index = 0; index < values.length; index++) {
          const n = values[index];
          q.remaining = n <= 30 ? n : 30;
          q.hp = q.maxHp = index % 5 + 1;
          Object.assign(g, { reading: 8, cooldown: index % 2 ? 1.8 : 1.1, lock: 0, mood: n, charges: { taiji: Infinity, counter: index % 6, crazy: index % 6, sincere: index % 6 }, log: Array.from({ length: n }, (_, i) => ({ type: 'resolved', qid: q.question.id, uid: 900000 + i, asker: q.asker, card: 'taiji', text: q.question.text, outcome: 'blocked', points: 0 })) });
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          const rects = Object.fromEntries(selectors.map(selector => { const r = document.querySelector(selector).getBoundingClientRect(); return [selector, [r.x,r.y,r.width,r.height]]; }));
          if (!baseline) baseline = rects;
          for (const [selector, r] of Object.entries(rects)) for (let k = 0; k < 4; k++) delta = Math.max(delta, Math.abs(r[k] - baseline[selector][k]));
          const range = document.createRange();
          for (const el of document.querySelectorAll('.dish-title,.player-label,.mood,.question-meta,.charges')) {
            const owner = el.closest('.battle-top,.battle-scene,.question,.answer-card').getBoundingClientRect();
            range.selectNodeContents(el);
            for (const r of range.getClientRects()) if (r.width && (r.left < owner.left - 1 || r.right > owner.right + 1 || r.top < owner.top - 1 || r.bottom > owner.bottom + 1)) issues.push({ n, text: el.textContent, kind: 'numeric-text-outside-owner' });
            if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) issues.push({ n, text: el.textContent, kind: 'numeric-element-overflow' });
          }
          observations.push({ mood: n, resolved: g.resolved, seconds: q.remaining, hp: q.hp, charges: g.charges.counter });
        }
        return { delta, issues, observations, mode: document.querySelector('.battle-page').dataset.layout };
      });
      report.cases.push({ width, height, scale, identity, ...evidence });
    }
    await context.close();
  }
  report.sourceHashes = Object.fromEntries(await Promise.all(['src/main.ts','src/style.css'].map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])));
  report.passed = report.errors.length === 0 && report.cases.every(c => c.delta <= 1 && c.issues.length === 0);
} catch (e) { report.failure = String(e.stack ?? e); }
finally {
  await browser.close();
  const path = `tests/stability-v5/${stamp}-numerals.json`;
  await writeFile(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ path, passed: report.passed, cases: report.cases.length, maxDelta: Math.max(...report.cases.map(c => c.delta)), issues: report.cases.filter(c => c.issues.length), errors: report.errors, failure: report.failure }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
