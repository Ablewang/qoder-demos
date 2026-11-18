import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('./', import.meta.url));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const results = { run: stamp, environment: 'Local Chrome via Playwright, real keyboard events, real RAF clock and DOM clicks', checks: [], focus: [], posterFlow: [], zeroCards: null, screenshots: [], errors: [], limits: ['Poster failure is induced by stubbing HTMLCanvasElement.toDataURL in the page, simulating a browser canvas failure', 'Large text is emulated by scaling every rendered element font size 1.3x at 320px (similar to Android WebView text zoom), not OS/WeChat font settings', 'No physical phone, WeChat, screen reader or listening test'] };
const note = text => { results.checks.push(text); console.log(text); };
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const sizes = [{ label: '320', width: 320, height: 740, mobile: true }, { label: '390', width: 390, height: 844, mobile: true }, { label: '1280', width: 1280, height: 900, mobile: false }];

async function open(size, seed) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.mobile ? 2 : 1, isMobile: size.mobile, hasTouch: size.mobile });
  const page = await context.newPage();
  page.on('pageerror', e => results.errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') results.errors.push(e.text()); });
  await page.goto(`http://127.0.0.1:5211/?probe=1&seed=${seed}`);
  await page.locator('[data-action="start"]').waitFor();
  return { context, page };
}
async function shot(page, name, fullPage = false) {
  await page.waitForTimeout(250);
  const file = `${stamp}-${name}.png`;
  await page.screenshot({ path: out + file, fullPage });
  results.screenshots.push(file);
}
const active = page => page.evaluate(() => {
  const el = document.activeElement;
  const box = document.querySelector('.modal-box');
  return { tag: el?.tagName, action: el?.dataset?.action ?? null, text: (el?.textContent ?? '').trim().slice(0, 16), inModal: !!box && box.contains(el), modal: !!box };
});
const background = page => page.evaluate(() => { const main = document.querySelector('main'); return { inert: main.inert, hidden: main.getAttribute('aria-hidden') }; });

async function tabCycle(page, label) {
  const forward = [];
  for (let i = 0; i < 9; i++) { await page.keyboard.press('Tab'); const a = await active(page); assert(a.inModal, `${label}: Tab ${i + 1} left the dialog: ${JSON.stringify(a)}`); forward.push(a.action ?? a.tag); }
  const backward = [];
  for (let i = 0; i < 9; i++) { await page.keyboard.press('Shift+Tab'); const a = await active(page); assert(a.inModal, `${label}: Shift+Tab ${i + 1} left the dialog`); backward.push(a.action ?? a.tag); }
  return { forward, backward };
}

async function focusChecks(size) {
  const { context, page } = await open(size, 21);
  const rulesButton = page.locator('[data-action="rules"]');
  await rulesButton.focus();
  await page.keyboard.press('Enter');
  await page.locator('.modal-box').waitFor();
  const opened = await active(page);
  assert(opened.inModal && opened.action === 'close-rules', `${size.label}: rules focus not inside dialog`);
  assert.deepEqual(await background(page), { inert: true, hidden: 'true' });
  const rulesCycle = await tabCycle(page, `${size.label}-rules`);
  await shot(page, `${size.label}-rules-focus`);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.modal').count(), 0);
  assert.equal((await active(page)).action, 'rules', `${size.label}: Esc did not return focus to rules`);
  await page.keyboard.press('Enter');
  await page.locator('.modal-box').waitFor();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.modal').count(), 0);
  assert.equal((await active(page)).action, 'rules', `${size.label}: button close did not return focus`);
  assert.deepEqual(await background(page), { inert: false, hidden: null });
  note(`${size.label}: rules dialog takes focus, background inert+aria-hidden, Tab/Shift+Tab stay inside, Esc and close button return focus to 看玩法`);

  await page.locator('[data-action="start"]').click();
  await page.locator('.answer-card').first().waitFor();
  const pauseButton = page.locator('[data-action="pause"]');
  await pauseButton.focus();
  await page.keyboard.press('Enter');
  await page.locator('.modal-box').waitFor();
  const pauseOpened = await active(page);
  assert(pauseOpened.inModal && pauseOpened.action === 'resume', `${size.label}: pause focus`);
  assert.deepEqual(await background(page), { inert: true, hidden: 'true' });
  const before = await page.evaluate(() => window.__rtdGame.elapsed);
  const clickedBehind = await page.evaluate(() => { const card = document.querySelector('.answer-card'); const r = card.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return card.contains(hit); });
  assert.equal(clickedBehind, false, `${size.label}: background card reachable through pause dialog`);
  const pauseCycle = await tabCycle(page, `${size.label}-pause`);
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__rtdGame.elapsed), before, `${size.label}: time moved while paused`);
  await shot(page, `${size.label}-pause-focus`);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.modal').count(), 0);
  assert.equal(await page.evaluate(() => window.__rtdGame.paused), false);
  assert.equal((await active(page)).action, 'pause', `${size.label}: Esc did not return focus to pause`);
  await page.keyboard.press('Enter');
  await page.locator('[data-action="resume"]').waitFor();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.__rtdGame.paused), false);
  assert.equal((await active(page)).action, 'pause', `${size.label}: 回桌继续 did not return focus`);
  await page.waitForTimeout(700);
  assert.equal((await active(page)).action, 'pause', `${size.label}: focus lost after live re-render`);
  note(`${size.label}: pause dialog takes focus, freezes time, blocks background, Tab cycles inside, Esc/回桌继续 resume and return focus to pause; focus survives later re-renders`);
  results.focus.push({ size: size.label, rulesCycle, pauseCycle });
  await context.close();
}

async function posterChecks(size, textZoom = 1) {
  const { context, page } = await open(size, 33);
  if (textZoom !== 1) await page.evaluate(scale => {
    const app = document.querySelector('#app');
    const enlarge = () => {
      observer.disconnect();
      const all = [...app.querySelectorAll('*')].filter(el => !el.dataset.zoomed && !(el instanceof SVGElement));
      const sizes = all.map(el => parseFloat(getComputedStyle(el).fontSize));
      all.forEach((el, i) => { el.style.fontSize = `${sizes[i] * scale}px`; el.dataset.zoomed = '1'; });
      observer.observe(app, { childList: true, subtree: true });
    };
    const observer = new MutationObserver(enlarge);
    enlarge();
  }, textZoom);
  const tag = textZoom === 1 ? size.label : `${size.label}-text130`;
  await page.locator('[data-action="start"]').click();
  await page.locator('.answer-card[data-card="taiji"]:not(:disabled)').click();
  await page.locator('[data-action="pause"]').click();
  await page.locator('[data-action="finish"]').click();
  await page.locator('[data-action="poster"]').waitFor();
  await page.evaluate(() => { const real = HTMLCanvasElement.prototype.toDataURL; window.__restoreCanvas = () => { HTMLCanvasElement.prototype.toDataURL = real; }; HTMLCanvasElement.prototype.toDataURL = () => 'data:,'; });
  const flow = [];
  const inspect = () => page.evaluate(() => {
    const retry = document.querySelector('[data-retry]');
    const text = document.querySelector('.poster-error p');
    const bounds = el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
    if (!retry) return { errors: document.querySelectorAll('.poster-error').length, notices: document.querySelectorAll('.notice').length };
    retry.scrollIntoView({ block: 'center' });
    const r = bounds(retry); const t = bounds(text);
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { errors: document.querySelectorAll('.poster-error').length, notices: document.querySelectorAll('.notice').length, alerts: document.querySelectorAll('[role=alert]').length, retry: r, text: t, overlap: !(t.bottom <= r.top || t.top >= r.bottom || t.right <= r.left || t.left >= r.right), hit: retry.contains(hit), inViewport: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, focused: document.activeElement === retry, scrollWidth: document.documentElement.scrollWidth, width: innerWidth };
  });
  await page.locator('.start[data-action="poster"]').click();
  let s = await inspect();
  flow.push({ step: 'fail-1', ...s });
  assert.equal(s.errors, 1); assert.equal(s.notices, 0); assert.equal(s.overlap, false, `${tag}: error text overlaps retry`);
  assert(s.hit && s.inViewport && s.retry.height >= 44 - 0.1, `${tag}: retry not visible/clickable/44px ${JSON.stringify(s)}`);
  assert(s.focused, `${tag}: retry not focused after failure`);
  assert(s.scrollWidth <= s.width, `${tag}: horizontal overflow`);
  await shot(page, `${tag}-poster-fail`);
  await page.locator('[data-retry]').click();
  s = await inspect();
  flow.push({ step: 'fail-2-retry', ...s });
  assert.equal(s.errors, 1, `${tag}: errors stacked after repeated failure`);
  await page.evaluate(() => window.__restoreCanvas());
  await page.locator('[data-retry]').click();
  await page.locator('.poster-image').waitFor();
  s = await inspect();
  flow.push({ step: 'success', ...s });
  assert.equal(s.errors, 0, `${tag}: stale error still shown after success`);
  assert.equal(s.notices, 0, `${tag}: stale notice after success`);
  const img = await page.evaluate(async () => { const i = document.querySelector('.poster-image'); await i.decode(); return { w: i.naturalWidth, h: i.naturalHeight, png: i.src.startsWith('data:image/png;base64,') }; });
  assert.deepEqual(img, { w: 1080, h: 1440, png: true });
  await shot(page, `${tag}-poster-success`);
  await page.locator('[data-action="back"]').click();
  s = await inspect();
  flow.push({ step: 'back-to-result', ...s });
  assert.equal(s.errors, 0, `${tag}: stale error on returning to result`);
  results.posterFlow.push({ size: tag, flow });
  note(`${tag}: poster fail→fail→success shows one current error at a time, retry ≥44px visible/clickable/not overlapped/focused, success clears it and decodes a 1080×1440 PNG`);
  await context.close();
}

async function zeroCards() {
  const { context, page } = await open(sizes[0], 7);
  await page.locator('[data-action="start"]').click();
  const started = Date.now();
  const seen = { allDisabled: null, zeroCharges: null, blank: 0, stalls: 0, rewards: 0 };
  let lastElapsed = -1; let stuckSince = Date.now();
  while (Date.now() - started < 240000) {
    const s = await page.evaluate(() => {
      const g = window.__rtdGame;
      const cards = [...document.querySelectorAll('.answer-card')];
      return { phase: g.phase, elapsed: g.elapsed, charges: { counter: g.charges.counter, crazy: g.charges.crazy, sincere: g.charges.sincere }, cooldown: g.cooldown, active: g.active.length, cardCount: cards.length, enabled: cards.filter(c => !c.disabled).map(c => c.dataset.card), mainText: (document.querySelector('main')?.innerText ?? '').trim().length, result: !!document.querySelector('[data-action="poster"]') };
    });
    if (s.result) break;
    if (s.mainText < 20) seen.blank++;
    if (s.elapsed !== lastElapsed) { lastElapsed = s.elapsed; stuckSince = Date.now(); } else if (s.phase === 'playing' && Date.now() - stuckSince > 3000) seen.stalls++;
    const zero = s.charges.counter === 0 && s.charges.crazy === 0 && s.charges.sincere === 0;
    if (zero && !seen.zeroCharges) { seen.zeroCharges = { ...s, at: (Date.now() - started) / 1000 }; await shot(page, '320-zero-charges', true); }
    if (s.phase === 'playing' && s.cardCount === 4 && s.enabled.length === 0 && zero && !seen.allDisabled && s.active > 0) { seen.allDisabled = s; await shot(page, '320-zero-all-disabled', true); }
    if (s.phase === 'reward') { await page.locator('[data-reward="soup"]').click(); seen.rewards++; continue; }
    const pick = ['counter', 'crazy', 'sincere', 'taiji'].find(card => s.enabled.includes(card));
    if (pick && s.active > 0) await page.locator(`.answer-card[data-card="${pick}"]`).click().catch(() => {});
    await page.waitForTimeout(120);
  }
  const report = await page.evaluate(() => window.__rtdGame.report);
  assert(report, 'zero-card game did not reach settlement');
  assert(seen.zeroCharges, 'never reached zero limited charges');
  assert.equal(seen.blank, 0, 'blank screen during zero-card play');
  assert.equal(seen.stalls, 0, 'clock stalled during zero-card play');
  await shot(page, '320-zero-result', true);
  results.zeroCards = { seen, report: { score: report.score, title: report.title, grade: report.grade, mood: report.mood, won: report.won, elapsed: report.elapsed }, realSeconds: (Date.now() - started) / 1000 };
  note(`320 zero cards: limited charges hit 0 at ${seen.zeroCharges.at.toFixed(1)}s real; ${seen.allDisabled ? 'all four disabled during taiji cooldown observed, ' : ''}no blank screen or clock stall; game continued with taiji only to natural settlement (${report.title}, ${report.score} points, mood ${report.mood})`);
  await context.close();
}

try {
  for (const size of sizes) await focusChecks(size);
  for (const size of sizes) await posterChecks(size);
  await posterChecks(sizes[0], 1.3);
  await zeroCards();
  assert.deepEqual(results.errors, []);
  results.passed = true;
} catch (error) {
  results.passed = false;
  results.failure = String(error?.stack ?? error);
  throw error;
} finally {
  await writeFile(`${out}${stamp}-results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
