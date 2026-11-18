import { chromium } from '@playwright/test';
import { createServer, build } from 'vite';
import assert from 'node:assert/strict';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = await mkdtemp(path.join(tmpdir(), 'relatives-eight-turns-'));
const evidence = { complete: false, headless: false, output, cases: [], checks: [], errors: [], external: [], fixtures: [], geometry: [], sourceBinding: null };
const sha = data => createHash('sha256').update(data).digest('hex');
async function fingerprints() {
  const files = ['index.html', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json'];
  async function collect(dir) {
    for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
      const name = path.join(dir, entry.name);
      if (entry.isDirectory()) await collect(name);
      else files.push(name);
    }
  }
  await collect('src');
  files.push('tests/browser.mjs');
  return Object.fromEntries(await Promise.all(files.sort().map(async name => [name, sha(await readFile(path.join(root, name)))])));
}
const before = await fingerprints();
const reservation = createNetServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const server = await createServer({ root, configFile: false, envDir: false, server: { host: '127.0.0.1', port, strictPort: true, open: false } });
let browser;
const origin = `http://127.0.0.1:${port}`;
const env = { ...process.env };
delete env.PWDEBUG;
const identities = ['single', 'married', 'graduate', 'exam'];
const views = [[390, 844, 1], [320, 568, 1], [320, 568, 2], [320, 740, 1.3], [320, 740, 2], [740, 320, 1], [740, 320, 2], [1280, 800, 1.3]];
const questions = JSON.parse(await readFile(path.join(root, 'src/content/questions.json'), 'utf8'));
const closeEnough = (a, b, label) => assert(Math.abs(a - b) < 0.75, `${label}: ${a} != ${b}`);
async function capture(page, name, fullPage = false) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage });
}
async function tap(page, selector) {
  const target = page.locator(selector);
  await target.waitFor({ state: 'visible' });
  assert(await target.isEnabled(), `${selector} must be enabled`);
  await target.tap();
}
async function state(page) {
  return page.evaluate(() => {
    const g = window.__rtdGame;
    return { phase: g.phase, mood: g.mood, index: g.index, charges: { ...g.charges }, target: g.target, history: g.history, report: g.report };
  });
}
async function measure(page, label) {
  const value = await page.evaluate(() => {
    const box = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
    const frame = document.querySelector('.battle-page');
    const reader = document.querySelector('.battle-reader');
    return {
      phase: frame.dataset.phase, turn: frame.dataset.turn, width: innerWidth, height: innerHeight,
      overflow: document.documentElement.scrollWidth - innerWidth,
      header: box(document.querySelector('.game-header')), footer: box(document.querySelector('.action-panel')), reader: box(reader),
      questionBox: document.querySelector('.question-sheet') ? box(document.querySelector('.question-sheet')) : null,
      quoteGrid: document.querySelector('.quote-grid') ? box(document.querySelector('.quote-grid')) : null,
      controls: [...document.querySelectorAll('.action-panel button, .game-header button')].map(el => {
        const r = el.getBoundingClientRect();
        const center = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { ...box(el), key: el.dataset.card ?? el.dataset.reward ?? el.dataset.action, disabled: el.disabled,
          hit: center === el || el.contains(center), overflowX: el.scrollWidth - el.clientWidth, overflowY: el.scrollHeight - el.clientHeight };
      }),
    };
  });
  assert(value.overflow <= 1, `${label} page overflow: ${JSON.stringify(value)}`);
  assert(value.reader.height >= 85, `${label} reader too small: ${value.reader.height}`);
  for (const control of value.controls) {
    assert(control.width >= 44 && control.height >= 44, `${label} small control: ${JSON.stringify(control)}`);
    assert(control.x >= -0.5 && control.y >= -0.5 && control.x + control.width <= value.width + 0.5 && control.bottom <= value.height + 0.5, `${label} offscreen control: ${JSON.stringify(control)}`);
    assert(control.overflowX <= 1 && control.overflowY <= 1, `${label} control text clipped: ${JSON.stringify(control)}`);
    assert(control.hit, `${label} control center blocked: ${JSON.stringify(control)}`);
  }
  evidence.geometry.push({ label, ...value });
  return value;
}
function sameFrame(first, next, label) {
  for (const part of ['header', 'footer', 'reader', ...(next.phase === 'question' ? ['questionBox', 'quoteGrid'] : [])]) for (const property of ['x', 'y', 'width', 'height']) closeEnough(first[part][property], next[part][property], `${label} ${part}.${property}`);
}
async function readable(page, selector, expected) {
  const target = page.locator(selector);
  if (expected !== undefined) assert((await target.innerText()).includes(expected), `${selector} lacks complete text: ${expected}`);
  const dimensions = await target.evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    const r = el.getBoundingClientRect();
    const frame = el.closest('.quote-card, .question-sheet, .resolution');
    const bounds = frame.getBoundingClientRect();
    const fragments = [...range.getClientRects()];
    return { height: r.height, readerHeight: document.querySelector('.battle-reader').clientHeight,
      overflow: frame.scrollWidth - frame.clientWidth, paragraphOverflow: el.scrollWidth - el.clientWidth, text: el.textContent, rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, fragments: fragments.map(line => ({ left: line.left, right: line.right, top: line.top, bottom: line.bottom })),
      clipped: fragments.some(line => line.width > 0 && (line.left < bounds.left + 1 || line.right > bounds.right - 1 || line.top < r.top - 1 || line.bottom > r.bottom + 1)) };
  });
  assert(dimensions.overflow <= 1 && !dimensions.clipped, `${selector} text overflow: ${JSON.stringify(dimensions)}`);
  await target.evaluate(el => {
    const reader = document.querySelector('.battle-reader');
    const r = reader.getBoundingClientRect(); const e = el.getBoundingClientRect();
    reader.scrollTop += e.top - r.top;
  });
  assert(await target.evaluate(el => {
    const reader = document.querySelector('.battle-reader').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return r.top < reader.bottom && r.bottom > reader.top;
  }), `${selector} cannot be read by scrolling`);
}
async function newPage(view, identity, seed) {
  const [width, height, scale] = view;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 1000, hasTouch: true, acceptDownloads: true });
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(`${origin}/`) || /^(data:|blob:)/.test(url)) return route.continue();
    evidence.external.push(url); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => evidence.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') evidence.errors.push(message.text()); });
  page.on('popup', popup => { evidence.errors.push('unexpected popup'); void popup.close(); });
  await page.goto(`${origin}/?probe&seed=${seed}`);
  await page.locator('[data-action=start]').waitFor();
  await page.evaluate(value => document.documentElement.style.setProperty('--text-scale', String(value)), scale);
  await tap(page, `[data-identity=${identity}]`);
  const home = await page.evaluate(() => {
    const title = document.querySelector('.home-title').getBoundingClientRect();
    const welcome = document.querySelector('.welcome').getBoundingClientRect();
    return { titleBottom: title.bottom, welcomeTop: welcome.top, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  assert(home.titleBottom <= home.welcomeTop && home.overflow <= 1, `home text overlaps: ${JSON.stringify(home)}`);
  if (identity === 'single') await capture(page, `home-${view.join('-')}`, true);
  return { context, page };
}
async function drive(page, label, fail = false, screenshots = false) {
  await tap(page, '[data-action=start]');
  let frame;
  const route = [], supplies = [];
  for (let turn = 1; turn <= 8; turn++) {
    const current = await measure(page, `${label}/question-${turn}`);
    if (frame) sameFrame(frame, current, `${label}/question-${turn}`); else frame = current;
    assert.equal(await page.evaluate(() => document.activeElement.id), 'question-heading');
    assert(await page.locator('.question-copy').evaluate(el => {
      const range = document.createRange(); range.selectNodeContents(el);
      const line = range.getClientRects()[0], reader = document.querySelector('.battle-reader').getBoundingClientRect();
      return line.top >= reader.top - 1 && line.bottom <= reader.bottom + 1;
    }), `${label} opening question line must be visible`);
    if (screenshots && (turn === 1 || turn === 4 || turn === 8)) await capture(page, `${label}-question-${turn}`);
    const beforeTurn = await state(page);
    if (page.__nextBase?.index === turn - 1) { assert.equal(beforeTurn.target.basePressure, page.__nextBase.pressure); page.__nextBase = null; }
    await readable(page, '.question-copy', beforeTurn.target.question.text);
    for (const card of ['taiji', 'counter', 'crazy', 'sincere']) await readable(page, `#quote-${card}`, beforeTurn.target.question.answers[card]);
    if (beforeTurn.target.incoming) {
      const carry = await page.locator('.carry-note').innerText();
      assert.match(carry, beforeTurn.target.incoming.kind === 'ally' ? /兑现帮腔/ : /反问有了后续/);
      const previous = beforeTurn.history[beforeTurn.history.length - 1];
      assert.deepEqual(beforeTurn.target.incoming, previous.next);
      assert.equal(beforeTurn.target.pressure, beforeTurn.target.basePressure + (previous.next.kind === 'ally' ? -1 : 1));
      if (previous.next.kind === 'ally') assert(carry.includes(previous.reply));
      await readable(page, '.carry-note p');
    }
    const visible = await page.evaluate(() => ({ pressure: Number(document.querySelector('.pressure-line>b').textContent.match(/\d+/)[0]), ordinary: document.querySelector('.question-byline>b').textContent === '普通问话', stock: Object.fromEntries([...document.querySelectorAll('[data-card]')].map(el => [el.dataset.card, !el.disabled])) }));
    const card = fail ? 'taiji' : visible.pressure <= 1 ? 'taiji' : !visible.ordinary && visible.stock.crazy ? 'crazy' : visible.ordinary && visible.stock.sincere ? 'sincere' : visible.stock.counter ? 'counter' : 'taiji';
    const lossText = await page.locator(`[data-card=${card}] .loss`).innerText();
    if (fail && visible.pressure - 1 >= beforeTurn.mood) assert.equal(lossText, '会收席');
    await tap(page, `[data-card=${card}]`); route.push(card);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'feedback-heading');
    const settled = await state(page);
    assert.equal(settled.history.length, turn);
    assert.equal(settled.history[turn - 1].quote, beforeTurn.target.question.answers[card]);
    if (screenshots && (turn === 1 || settled.phase === 'reward' && turn === 2)) await capture(page, `${label}-${settled.phase}-${turn}`);
    await readable(page, '.spoken-copy', beforeTurn.target.question.answers[card]);
    await readable(page, '.relative-panel p', settled.history[turn - 1].reply);
    await readable(page, '.next-effect');
    const feedback = await measure(page, `${label}/${settled.phase}-${turn}`);
    sameFrame(frame, feedback, `${label}/${settled.phase}-${turn}`);
    if (settled.phase === 'reward') {
      assert([2, 4, 6].includes(turn));
      const preview = await page.locator('.meal-preview').innerText();
      const nextPressure = preview.match(/基础压力 (\d+) \/ (\d+)/);
      assert(nextPressure, `${label} missing next meal preview`);
      const predicted = nextPressure.slice(1).map(Number);
      for (const reward of ['soup', 'counter', 'sincere', 'crazy']) {
        const enabled = await page.locator(`[data-reward=${reward}]`).isEnabled();
        assert.equal(enabled, reward === 'soup' ? settled.mood < 6 : settled.charges[reward] < 3);
        if (!enabled) {
          const unchanged = JSON.stringify(await state(page));
          await page.locator(`[data-reward=${reward}]`).evaluate(el => el.click());
          assert.equal(JSON.stringify(await state(page)), unchanged);
        }
      }
      const highQuestions = predicted.filter(pressure => pressure >= 5).length;
      const reserve = Math.min(2, highQuestions + (turn < 6 ? 1 : 0));
      const enabled = Object.fromEntries(await page.locator('[data-reward]').evaluateAll(buttons => buttons.map(el => [el.dataset.reward, !el.disabled])));
      const reward = fail ? 'soup' : settled.charges.crazy < reserve && enabled.crazy ? 'crazy' : enabled.soup ? 'soup' : enabled.sincere ? 'sincere' : enabled.counter ? 'counter' : 'crazy';
      await tap(page, `[data-reward=${reward}]`); supplies.push(reward);
      const nextState = await state(page);
      assert.equal(nextState.target.basePressure, predicted[0]);
      assert.equal(nextState.index, turn);
      page.__nextBase = { index: turn + 1, pressure: predicted[1] };
    } else {
      await tap(page, '[data-action=next]');
    }
    if (await page.locator('.result-page').count()) break;
  }
  await page.locator('.result-page').waitFor();
  const finished = (await state(page)).report;
  assert.equal(finished.won, !fail, `${label} unexpected result: ${JSON.stringify({ route, supplies, mood: finished.mood })}`);
  assert(fail ? finished.turns >= 2 && finished.turns <= 8 : finished.turns === 8);
  assert(fail ? finished.mood === 0 : finished.mood > 0);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'result-heading');
  const highlights = await page.locator('.memories .memory-panel').allInnerTexts();
  assert.equal(highlights.length, finished.highlights.length);
  for (const [index, turn] of finished.highlights.entries()) {
    assert(highlights[index].includes(turn.quote));
    assert(highlights[index].includes(turn.question.text));
    if (turn.next && finished.history[turn.turn]) assert(highlights[index].includes(`第 ${turn.turn + 1} 问`));
  }
  await page.locator('.full-replay summary').tap();
  assert.equal(await page.locator('.full-replay .memory-panel').count(), finished.turns);
  await page.locator('.full-replay summary').tap();
  if (screenshots) await capture(page, `${label}-result`, true);
  evidence.cases.push({ label, type: 'real DOM taps, visible-information policy; probe only checks outcomes', won: finished.won, mood: finished.mood, route, supplies, questions: finished.history.map(turn => turn.question.id) });
  return finished;
}
async function staticTextFixture(page, label) {
  const result = await page.evaluate(data => {
    const question = document.querySelector('.question-copy'), quotes = [...document.querySelectorAll('.preview-quote')];
    const original = [question, ...quotes].map(el => el.textContent);
    const panels = [question.parentElement, ...quotes.map(el => el.parentElement)];
    const baseline = panels.map(el => el.getBoundingClientRect().height);
    let observations = 0, delta = 0;
    const issues = [];
    for (const q of data) {
      question.textContent = `「${q.text}」`;
      for (const el of quotes) el.textContent = `「${q.answers[el.id.slice(6)]}」`;
      panels.forEach((el, index) => { delta = Math.max(delta, Math.abs(el.getBoundingClientRect().height - baseline[index])); });
      for (const el of [question, ...quotes]) {
        const range = document.createRange(); range.selectNodeContents(el); const r = el.getBoundingClientRect(); const bounds = el.parentElement.getBoundingClientRect();
        if ([...range.getClientRects()].some(line => line.width > 0 && (line.left < bounds.left + 1 || line.right > bounds.right - 1 || line.bottom > r.bottom + 1))) issues.push(`${q.id}:${el.id}`);
        observations++;
      }
    }
    [question, ...quotes].forEach((el, index) => { el.textContent = original[index]; });
    return { observations, delta, issues };
  }, questions);
  evidence.fixtures.push({ label, type: 'synthetic text-only DOM fixture, no business state changes', ...result });
  assert(result.delta < 0.75 && !result.issues.length, `${label} unstable text fixture: ${JSON.stringify(result)}`);
}
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, env });
  const mainSource = await readFile(path.join(root, 'src/main.ts'), 'utf8');
  const served = await (await fetch(`${origin}/src/main.ts`)).text();
  const mapping = served.match(/sourceMappingURL=data:application\/json;base64,([^\s]+)/);
  assert(mapping, 'Vite inline source map missing');
  const sourceMap = JSON.parse(Buffer.from(mapping[1], 'base64').toString());
  assert(sourceMap.sourcesContent.includes(mainSource), 'served main.ts does not match source');
  const css = await (await fetch(`${origin}/src/style.css?direct`)).text();
  assert.equal(css.trim(), (await readFile(path.join(root, 'src/style.css'), 'utf8')).trim());
  evidence.sourceBinding = { main: sha(mainSource), css: sha(css.trim()), inlineSourceMapMatches: true, cssPayloadMatches: true };
  for (const [viewIndex, view] of views.entries()) {
    for (const [identityIndex, identity] of identities.entries()) {
      const label = `${identity}-${view.join('-')}`;
      const { context, page } = await newPage(view, identity, 27 + 97 * viewIndex + 13 * identityIndex);
      try {
        if (!evidence.headless) {
          const cdp = await context.newCDPSession(page);
          evidence.headless = (await cdp.send('Browser.getVersion')).userAgent.includes('HeadlessChrome');
          await cdp.detach(); assert(evidence.headless);
        }
        await drive(page, label, false, identityIndex === 0);
        await tap(page, '[data-action=restart]');
        assert.equal((await state(page)).mood, 6);
        assert.equal((await state(page)).history.length, 0);
        if (identityIndex === 0) await staticTextFixture(page, label);
      } catch (error) { await capture(page, `${label}-failure`, true); throw error; }
      finally { await context.close(); }
    }
  }
  for (const identity of identities) {
    const { context, page } = await newPage([390, 844, 1], identity, 72);
    try { await drive(page, `failure-${identity}`, true, identity === 'single'); } finally { await context.close(); }
  }
  const { context, page } = await newPage([390, 844, 1], 'single', 27);
  try {
    const radios = page.locator('[role=radio]');
    await radios.first().focus();
    await page.keyboard.press('End'); assert.equal(await page.locator('[role=radio][aria-checked=true]').getAttribute('data-identity'), 'exam');
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[role=radio][aria-checked=true]').getAttribute('data-identity'), 'married');
    await page.keyboard.press('ArrowLeft');
    await tap(page, '[data-action=start]');
    const unchanged = JSON.stringify(await state(page));
    await page.waitForTimeout(1300); assert.equal(JSON.stringify(await state(page)), unchanged);
    await page.locator('.battle-reader').evaluate(el => { el.scrollTop = 80; });
    const scroll = await page.locator('.battle-reader').evaluate(el => el.scrollTop);
    await tap(page, '[data-action=menu]');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'close-menu');
    assert(await page.locator('.battle-page').getAttribute('inert') !== null);
    await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'leave');
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'close-menu');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'menu');
    closeEnough(await page.locator('.battle-reader').evaluate(el => el.scrollTop), scroll, 'menu preserves scroll');
    assert.equal(JSON.stringify(await state(page)), unchanged);
    await tap(page, '[data-action=sound]');
    await page.waitForFunction(() => localStorage.getItem('relatives-sound') === 'on');
    await tap(page, '[data-action=sound]');
    await page.waitForFunction(() => localStorage.getItem('relatives-sound') === 'off');
    await tap(page, '[data-action=menu]'); await tap(page, '[data-action=leave]');
    assert.equal((await state(page)).report.won, false); assert.equal((await state(page)).report.turns, 0);
    await tap(page, '[data-action=home]');
    await drive(page, 'export-golden-path', false, true);
    await tap(page, '[data-action=poster]');
    await page.locator('.poster-image').waitFor(); await page.locator('.poster-image').evaluate(img => img.decode());
    const image = await page.locator('.poster-image').evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight, src: img.src }));
    assert.equal(image.width, 1080); assert.equal(image.height, 1440); assert(image.src.startsWith('data:image/png;base64,'));
    const downloadReady = page.waitForEvent('download'); await page.locator('a[download]').tap();
    const download = await downloadReady; const file = path.join(output, 'actual-downloaded-report.png');
    await download.saveAs(file); assert.equal(await download.failure(), null);
    assert.deepEqual(await readFile(file), Buffer.from(image.src.split(',')[1], 'base64'));
    await capture(page, 'poster-page');
    await tap(page, '[data-action=back]');
    await page.evaluate(() => {
      window.__originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      window.__remainingFailures = 2;
      HTMLCanvasElement.prototype.toDataURL = function (...args) {
        if (window.__remainingFailures-- > 0) throw new Error('synthetic canvas fixture');
        return window.__originalToDataURL.apply(this, args);
      };
    });
    for (let attempt = 1; attempt <= 2; attempt++) {
      await tap(page, attempt === 1 ? '.result-actions [data-action=poster]' : '.export-feedback [data-action=poster]');
      await page.locator('.export-feedback[role=alert]').waitFor();
      assert.equal(await page.locator('.poster-image, a[download]').count(), 0);
      assert.equal((await state(page)).report.turns, 8);
      await capture(page, `synthetic-export-failure-${attempt}`, true);
    }
    await tap(page, '.export-feedback [data-action=poster]');
    await page.locator('.poster-image').waitFor(); await page.locator('.poster-image').evaluate(img => img.decode());
    await page.evaluate(() => { HTMLCanvasElement.prototype.toDataURL = window.__originalToDataURL; });
    evidence.fixtures.push({ type: 'synthetic Canvas toDataURL failure twice, then UI retry success; not a naturally observed failure', passed: true });
    evidence.checks.push('Identity arrow/Home/End keyboard, menu Tab/ShiftTab/Escape and focus/scroll restoration, no automatic countdown, sound preference, intentional early exit, actual PNG byte-identical download, export failure recovery');
  } finally { await context.close(); }
  await build({ root, configFile: false, envDir: false, build: { outDir: path.join(output, 'build'), emptyOutDir: false, sourcemap: true } });
  evidence.after = await fingerprints(); assert.deepEqual(evidence.after, before, 'source changed during acceptance');
  assert.deepEqual(evidence.errors, []); assert.deepEqual(evidence.external, []);
  evidence.complete = true;
} catch (error) {
  evidence.failure = error.stack; throw error;
} finally {
  evidence.before = before;
  await writeFile(path.join(output, 'results.json'), JSON.stringify(evidence, null, 2));
  if (browser) await browser.close();
  await server.close();
  console.log(JSON.stringify({ output, complete: evidence.complete, cases: evidence.cases.length, fixtures: evidence.fixtures.length, observations: evidence.geometry.length, errors: evidence.errors, external: evidence.external, failure: evidence.failure }));
}
