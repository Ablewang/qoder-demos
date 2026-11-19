import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = await mkdtemp(path.join(root, 'tests/redesign-v1/run-'));
const report = { complete: false, headless: true, output, routes: [], geometry: [], screenshots: [], downloads: [], checks: [], errors: [], external: [], reading: [] };
const sha = value => createHash('sha256').update(value).digest('hex');
async function fingerprints() {
  const files = ['PRD.md', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'index.html', 'tests/engine.test.ts', 'tests/content.test.ts', 'tests/poster.test.ts'];
  async function collect(dir) {
    for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
      const name = path.join(dir, entry.name);
      if (entry.isDirectory()) await collect(name); else files.push(name);
    }
  }
  await collect('src');
  return Object.fromEntries(await Promise.all(files.map(async f => [f, sha(await readFile(path.join(root, f)))])));
}
const before = await fingerprints();
const server = await createServer({ root, configFile: false, envDir: false, logLevel: 'silent', server: { host: '127.0.0.1', port: 0, open: false } });
const env = { ...process.env }; delete env.PWDEBUG;
let browser, origin;
const views = [[320, 568, 1], [390, 844, 1], [844, 390, 1], [390, 844, 1.3], [320, 568, 2], [1024, 768, 1]];
const routes = [
  { label: 'fishpond', ids: ['ask-nainai', 'fishpond', 'ask-erjiu', 'ask-help', 'small-goal'], ending: 'won' },
  { label: 'cousin', ids: ['ask-sangu', 'cover-biaojie', 'lottery', 'ask-help', 'biaojie-team', 'both-plan'], ending: 'won' },
  { label: 'own-plan', ids: ['honest-sangu', 'ask-dayi', 'ask-erjiu', 'say-plan'], ending: 'won' },
  { label: 'coin', ids: ['ask-sangu', 'eat-quietly', 'ask-erjiu', 'ask-help'], ending: 'won' },
  { label: 'toast', ids: ['honest-sangu', 'ask-dayi', 'lottery', 'ask-help', 'erjiu-help', 'keep-private'], ending: 'won' },
  { label: 'piled', ids: ['ask-sangu', 'eat-quietly', 'lottery'], ending: 'piled' },
  { label: 'kitchen', ids: ['honest-sangu', 'own-plan', 'ask-erjiu'], leave: true, ending: 'left' },
  { label: 'followup-piled', ids: ['ask-nainai', 'fishpond', 'ask-erjiu', 'say-plan', 'draw-line'], ending: 'piled' },
  { label: 'long-listen', ids: ['ask-sangu', 'cover-biaojie', 'lottery', 'ask-help', 'biaojie-team', 'listen-cousin', 'keep-private'], ending: 'won' },
];
async function open(width = 390, height = 844, scale = 1) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 500, hasTouch: true, acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (/^https?:/.test(url) && new URL(url).origin !== origin) { report.external.push(url); await route.abort(); } else await route.continue();
  });
  await page.goto(`${origin}/?probe=1`);
  await page.evaluate(s => { document.documentElement.style.setProperty('--text-scale', String(s)); Element.prototype.scrollIntoView = () => { throw new Error('scrollIntoView is forbidden'); }; }, scale);
  await page.evaluate(() => document.fonts.ready);
  return { page, context };
}
async function state(page) {
  return page.evaluate(() => { const g = window.__rtdGame; return { phase: g.phase, node: g.node, state: g.state, turns: g.turns, options: g.options(), report: g.report }; });
}
async function tap(page, selector) {
  const point = await page.evaluate(selector => {
    const el = [...document.querySelectorAll(selector)].find(e => e.getClientRects().length && !e.closest('[inert]'));
    if (!el) throw new Error(`Missing visible control: ${selector}`);
    let r = el.getBoundingClientRect();
    if (!el.closest('.game-page')) {
      const layer = el.closest('.menu-layer');
      if (layer) layer.scrollTop += r.top - 40;
      else if (r.top < 0 || r.bottom > innerHeight) window.scrollBy(0, r.top - 40);
      r = el.getBoundingClientRect();
    }
    if (r.top < -1 || r.bottom > innerHeight + 1 || r.left < -1 || r.right > innerWidth + 1 || r.height < 44) throw new Error(`Offscreen/small control ${selector}: ${JSON.stringify(r.toJSON())}`);
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    if (!el.contains(document.elementFromPoint(x, y))) throw new Error(`Covered control: ${selector}`);
    return { x, y };
  }, selector);
  await page.touchscreen.tap(point.x, point.y);
}
async function shot(page, name, fullPage = false) {
  const file = path.join(output, `${name}.png`);
  await page.screenshot({ path: file, fullPage }); report.screenshots.push(file); return file;
}
async function audit(page, label) {
  const geometry = await page.evaluate(() => {
    const frame = document.querySelector('.game-page');
    const reading = document.querySelector('#app').dataset.reading === 'true';
    const visible = el => el.getClientRects().length && !el.closest('[inert]') && !(el instanceof SVGElement);
    const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right }; };
    const problems = [], boxes = {};
    for (const el of [...document.querySelectorAll('#app *')].filter(visible)) {
      const s = getComputedStyle(el), r = rect(el);
      if (r.x < -1 || r.right > innerWidth + 1) problems.push({ type: 'horizontal', class: el.className, r });
      if (s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none') problems.push({ type: 'truncated', class: el.className });
      const reader = reading && (el.matches('.reading-copy,.ask-copy,.reaction-summary') || el.closest('.reading-copy,.ask-copy,.reaction-summary'));
      if (/hidden|clip/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) problems.push({ type: 'clipped', class: el.className });
      if (frame && !reader && /auto|scroll/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) problems.push({ type: 'inner-scroll', class: el.className });
      if (reader || !frame) continue;
      for (const child of el.childNodes) {
        if (child.nodeType !== Node.TEXT_NODE || !child.textContent.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(child);
        for (const glyph of range.getClientRects()) if (glyph.left < r.x - 2 || glyph.right > r.right + 2 || glyph.top < r.y - 2 || glyph.bottom > r.bottom + 2) problems.push({ type: 'text-outside', class: el.className, text: child.textContent, r, glyph: glyph.toJSON() });
      }
    }
    if (frame) {
      if (scrollY !== 0 || document.documentElement.scrollHeight > innerHeight + 1) problems.push({ type: 'page-scroll', scrollY, height: document.documentElement.scrollHeight });
      const selectors = ['.game-header', '.table-scene', '.stage-table', '.ask-bubble', '.response-dock', '.you-seat', ...['sangu', 'erjiu', 'nainai', 'dayi', 'biaojie'].flatMap(id => [`[data-cast="${id}"] .seat-art`, `[data-cast="${id}"] .seat-name`, `[data-cast="${id}"] .seat-tag`])];
      selectors.push(...(frame.dataset.phase === 'choose' ? reading ? ['.reading-copy', '.reading-choices .primary', '.reading-tabs'] : ['.choice[data-slot="1"]', '.choice[data-slot="2"]', '.choice[data-slot="3"]'] : ['.continue-row .primary', '.continue-row .secondary']));
      for (const selector of selectors) {
        const el = document.querySelector(selector); if (!el) continue;
        const r = rect(el); boxes[selector] = r;
        if (r.y < -1 || r.bottom > innerHeight + 1 || r.x < -1 || r.right > innerWidth + 1) problems.push({ type: 'offscreen', selector, r });
        if (el.matches('button') && r.height < 44) problems.push({ type: 'small-target', selector, r });
      }
      const bubble = boxes['.ask-bubble'];
      for (const id of ['sangu', 'erjiu', 'nainai', 'dayi', 'biaojie']) for (const part of ['seat-name', 'seat-tag']) {
        const r = boxes[`[data-cast="${id}"] .${part}`];
        if (Math.min(bubble.right, r.right) - Math.max(bubble.x, r.x) > 1 && Math.min(bubble.bottom, r.bottom) - Math.max(bubble.y, r.y) > 1) problems.push({ type: 'bubble-covers-name', id, part, r, bubble });
      }
      const speaker = document.querySelector('.table-scene').dataset.speaker;
      const active = [...document.querySelectorAll('.seat.speaking')].map(e => e.dataset.cast);
      if (speaker === 'table' ? active.length !== 5 : speaker === 'you' ? active.length !== 0 : active.length !== 1 || active[0] !== speaker) problems.push({ type: 'wrong-speaker', speaker, active });
    }
    return { width: innerWidth, height: innerHeight, reading, phase: frame?.dataset.phase, node: frame?.dataset.node, beat: frame?.dataset.beat, speaker: document.querySelector('.table-scene')?.dataset.speaker, scrollY, boxes, problems };
  });
  report.geometry.push({ label, ...geometry });
  if (geometry.problems.length) await shot(page, `${label.replaceAll('/', '-')}-failure`);
  assert.deepEqual(geometry.problems, [], `${label}: ${JSON.stringify(geometry.problems)}`);
  return geometry;
}
function anchors(geometry) {
  return Object.fromEntries(Object.entries(geometry.boxes).filter(([s]) => s === '.table-scene' || s === '.stage-table' || s === '.ask-bubble' || s === '.response-dock' || s.endsWith('.seat-art') || s === '.you-seat'));
}
async function select(page, id, label) {
  const before = await state(page), option = before.options.find(o => o.id === id);
  assert.equal(before.phase, 'choose'); assert(option?.available, id);
  const reading = await page.locator('#app').getAttribute('data-reading') === 'true';
  if (reading) {
    const i = before.options.filter(o => o.available).findIndex(o => o.id === id);
    await tap(page, `[data-read-option="${i}"]`);
    const article = page.locator('.reading-copy');
    assert((await article.innerText()).includes(option.line)); assert((await article.innerText()).includes(option.risk));
    await article.evaluate(el => { el.scrollTop = el.scrollHeight; });
    report.reading.push({ label, action: id, ...await article.evaluate(el => ({ clientHeight: el.clientHeight, scrollHeight: el.scrollHeight })) });
  } else {
    const text = await page.locator(`.choice[data-choice="${id}"]`).innerText();
    assert(text.includes(option.line)); assert(text.includes(option.risk));
    if (option.ending === 'piled') assert(text.includes('会被围住'));
  }
  const start = await audit(page, `${label}/choose`);
  await tap(page, reading ? `.reading-choices [data-choice="${id}"]` : `.choice[data-choice="${id}"]`);
  const after = await state(page), turn = after.turns.at(-1);
  assert.equal(after.phase, 'react'); assert.deepEqual(after.state.watching, option.after); assert.equal(turn.ending, option.ending);
  assert.equal(await page.locator('.ask-copy').textContent(), option.line);
  assert.deepEqual(anchors(await audit(page, `${label}/you-said`)), anchors(start));
  return turn;
}
async function listen(page, turn, label, next = true) {
  for (let i = 0; i < turn.beats.length; i++) {
    await tap(page, '[data-action="reply-next"]');
    assert.equal(await page.locator('.ask-copy').textContent(), turn.beats[i].text);
    const g = await audit(page, `${label}/beat-${i}`);
    assert.equal(g.speaker, turn.beats[i].who);
  }
  if (next) await tap(page, '[data-action="next"]');
}
async function step(page, id, label) { const turn = await select(page, id, label); await listen(page, turn, label); return turn; }
async function poster(page, label) {
  await tap(page, '[data-action="poster"]'); await page.locator('.poster-image').waitFor();
  const image = await page.locator('.poster-image').evaluate(el => ({ width: el.naturalWidth, height: el.naturalHeight, src: el.src }));
  assert.deepEqual([image.width, image.height], [1080, 1440]);
  const promise = page.waitForEvent('download'); await tap(page, 'a[download]'); const download = await promise;
  const file = path.join(output, `${label}-poster.png`); await download.saveAs(file);
  const data = await readFile(file); assert.equal(sha(data), sha(Buffer.from(image.src.split(',')[1], 'base64')));
  report.downloads.push({ file, sha256: sha(data), bytes: data.length });
  await tap(page, '[data-action="back"]');
}
async function goldenRoutes() {
  for (const view of views.slice(0, 3)) for (const route of routes) {
    const { page, context } = await open(...view), label = `${view[0]}x${view[1]}-${route.label}`;
    await tap(page, '[data-action="start"]');
    for (const id of route.ids) await step(page, id, `${label}/${id}`);
    if (route.leave) await tap(page, '[data-action="leave"]');
    const result = (await state(page)).report;
    assert.equal(result.ending, route.ending); assert.deepEqual(result.turns.map(t => t.id), route.ids);
    assert.equal(await page.locator('.replay-turn').count(), route.ids.length);
    for (const turn of result.turns) for (const beat of turn.beats) assert((await page.locator('.replay').innerText()).includes(beat.text));
    if (view[0] === 390) await poster(page, label);
    await tap(page, '[data-action="restart"]');
    assert.deepEqual((await state(page)).state, { watching: ['sangu'], allies: ['nainai'], used: [], flags: [] });
    report.routes.push({ label, ending: result.ending, dishes: result.dishes, turns: result.turns }); await context.close();
  }
}
async function viewportEvidence() {
  for (const view of views) {
    const { page, context } = await open(...view), label = `${view[0]}x${view[1]}-text${view[2]}`;
    await shot(page, `${label}-home`);
    await tap(page, '[data-action="start"]'); await audit(page, `${label}/first-choose`); await shot(page, `${label}-choose`);
    const turn = await select(page, 'honest-sangu', `${label}/honest`);
    await tap(page, '[data-action="reply-next"]'); await audit(page, `${label}/first-reply`); await shot(page, `${label}-react`);
    await tap(page, '[data-action="reply-back"]'); assert.equal(await page.locator('.ask-copy').textContent(), turn.line);
    await listen(page, turn, `${label}/honest`);
    for (const id of ['ask-dayi', 'ask-erjiu', 'say-plan']) await step(page, id, `${label}/${id}`);
    assert.equal((await state(page)).report.ending, 'won');
    await context.close();
  }
}
async function reachableStates() {
  report.anchors = [];
  for (const view of views) {
    const { page, context } = await open(...view), label = `reachable-${view.join('-')}`;
    await tap(page, '[data-action="start"]');
    const fixtures = await page.evaluate(() => {
      const Type = window.__rtdGame.constructor, seen = new Set(), fixtures = [];
      const walk = g => {
        const key = JSON.stringify([g.node.id, g.state]); if (seen.has(key)) return; seen.add(key);
        fixtures.push(structuredClone({ node: g.node, state: g.state, turns: g.turns, phase: 'choose', report: null }));
        for (const o of g.options().filter(o => o.available)) {
          const b = new Type(); b.node = g.node; b.state = structuredClone(g.state); b.turns = [...g.turns]; b.choose(o.id); b.advance();
          if (b.phase === 'choose') walk(b);
        }
      }; walk(new Type()); return fixtures;
    });
    let baseline;
    for (let i = 0; i < fixtures.length; i++) {
      const f = fixtures[i];
      await page.evaluate(f => Object.assign(window.__rtdGame, f), f); await tap(page, '[data-action="menu"]'); await page.keyboard.press('Escape');
      const options = (await state(page)).options.filter(o => o.available); assert(options.length >= 2 && options.length <= 3);
      const a = anchors(await audit(page, `${label}/${i}/choose`));
      if (!baseline) baseline = a; assert.deepEqual(a, baseline, `${label}: actor/stage anchors moved`);
      for (const o of options) {
        await page.evaluate(f => Object.assign(window.__rtdGame, f), f); await tap(page, '[data-action="menu"]'); await page.keyboard.press('Escape');
        const turn = await select(page, o.id, `${label}/${i}/${o.id}`); await listen(page, turn, `${label}/${i}/${o.id}`, false);
        assert.deepEqual(anchors(await audit(page, `${label}/${i}/${o.id}/last`)), baseline);
      }
    }
    report.anchors.push({ view, states: fixtures.length, boxes: baseline });
    await page.setViewportSize({ width: view[1], height: view[0] });
    if (view[2] === 1 && view[0] === 390) await audit(page, `${label}/rotate`);
    await page.setViewportSize({ width: view[0], height: view[1] }); await audit(page, `${label}/rotate-back`);
    await page.evaluate(() => document.documentElement.style.setProperty('--text-scale', '1')); await audit(page, `${label}/normal-font`);
    await page.evaluate(s => document.documentElement.style.setProperty('--text-scale', String(s)), view[2]); await audit(page, `${label}/font-back`);
    await context.close();
  }
}
async function edges() {
  const { page, context } = await open();
  await tap(page, '[data-action="menu"]'); await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-action="menu"]').evaluate(el => el === document.activeElement), true);
  await page.locator('[data-action="start"]').focus(); await page.keyboard.press('Enter');
  await page.locator('.choice[data-choice="ask-sangu"]').focus(); await page.keyboard.press('Enter');
  const turn = (await state(page)).turns.at(-1), stable = await state(page);
  await page.waitForTimeout(6100); assert.deepEqual(await state(page), stable); assert.equal(await page.locator('.game-page').getAttribute('data-beat'), '-1');
  const a = anchors(await audit(page, 'edge/pause'));
  await tap(page, '[data-action="menu"]'); await page.keyboard.press('Shift+Tab');
  assert.equal(await page.locator('.menu-box [data-action="leave"]').evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Tab'); assert.equal(await page.locator('[data-action="close-menu"]').evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Escape'); assert.deepEqual(anchors(await audit(page, 'edge/menu')), a);
  await tap(page, '[data-action="sound"]'); await page.waitForFunction(() => document.querySelector('[data-action="sound"]').getAttribute('aria-pressed') === 'true');
  await tap(page, '[data-action="sound"]'); await page.waitForFunction(() => document.querySelector('[data-action="sound"]').getAttribute('aria-pressed') === 'false');
  assert.deepEqual(anchors(await audit(page, 'edge/sound')), a);
  await listen(page, turn, 'edge/listen'); await step(page, 'eat-quietly', 'edge/quiet');
  assert.equal(await page.locator('.choice[data-choice="biaojie-help"]').count(), 0);
  const unchanged = await state(page); assert.equal(await page.evaluate(() => window.__rtdGame.choose('biaojie-help')), null); assert.deepEqual(await state(page), unchanged);
  await tap(page, '[data-action="menu"]'); await tap(page, '.menu-box [data-action="leave"]'); assert.equal((await state(page)).report.ending, 'left');
  await tap(page, '[data-action="home"]'); await tap(page, '[data-action="start"]'); await tap(page, '[data-action="leave"]'); assert.equal((await state(page)).report.turns.length, 0);
  await poster(page, 'early'); await tap(page, '[data-action="restart"]');
  for (const id of ['honest-sangu', 'ask-dayi', 'ask-erjiu', 'say-plan']) await step(page, id, `edge/${id}`);
  await page.evaluate(() => { const original = HTMLCanvasElement.prototype.getContext; window.__restoreCanvas = () => { HTMLCanvasElement.prototype.getContext = original; }; HTMLCanvasElement.prototype.getContext = () => null; });
  await tap(page, '[data-action="poster"]'); await page.locator('.export-feedback[role="alert"]').waitFor(); assert((await page.locator('.export-feedback').innerText()).includes('回放还在'));
  await page.evaluate(() => window.__restoreCanvas()); await tap(page, '.export-feedback [data-action="poster"]'); await page.locator('.poster-image').waitFor();
  await context.close();
  report.checks.push('Keyboard, focus trap, Escape, touch coordinates, pause without automatic advancement, rewind, menu/sound preserve anchors, invalid/locked action ignored, menu/early leave, local PNG, export failure+retry');
}
try {
  await server.listen(); origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, env });
  await viewportEvidence(); await goldenRoutes(); await edges(); await reachableStates();
  assert.deepEqual(report.errors, []); assert.deepEqual(report.external, []); assert.deepEqual(await fingerprints(), before);
  report.fingerprints = before; report.complete = true;
} catch (error) { report.failure = error.stack; console.error(error); process.exitCode = 1; }
finally {
  if (browser) await browser.close(); await server.close();
  await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ complete: report.complete, output, routes: report.routes.length, geometry: report.geometry.length, screenshots: report.screenshots.length, downloads: report.downloads.length, errors: report.errors, external: report.external, failure: report.failure }, null, 2));
}
