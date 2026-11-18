import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('./', import.meta.url));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const results = {
  run: stamp,
  environment: 'Local Chrome via Playwright, real keyboard events, real RAF clock and DOM clicks',
  checks: [], focus: [], pauseFold: [], posterFlow: [], wrapAudit: {}, zeroCards: null, screenshots: [], errors: [],
  limits: [
    'Poster failures are induced by stubbing HTMLCanvasElement.toDataURL and getContext in the page, not actual browser memory/permission failures',
    'Large text is emulated by scaling every rendered element font size 1.3x (similar to Android WebView text zoom), not OS/WeChat font settings',
    'Wrap sweep reaches later waves by calling Game.tick() faster than real time; cards and rewards are still clicked through the DOM. Natural-clock evidence is the zero-card run only',
    'No physical phone, WeChat, screen reader or listening test',
  ],
};
const note = text => { results.checks.push(text); console.log(text); };
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const sizes = [{ label: '320', width: 320, height: 740, mobile: true }, { label: '390', width: 390, height: 844, mobile: true }, { label: '1280', width: 1280, height: 900, mobile: false }];
const short = { label: '320x568', width: 320, height: 568, mobile: true };

async function open(size, seed, zoom = 1) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.mobile ? 2 : 1, isMobile: size.mobile, hasTouch: size.mobile });
  const page = await context.newPage();
  page.on('pageerror', e => results.errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') results.errors.push(e.text()); });
  await page.goto(`http://127.0.0.1:5211/?probe=1&seed=${seed}`);
  await page.locator('[data-action="start"]').waitFor();
  if (zoom !== 1) await page.evaluate(scale => {
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
  }, zoom);
  return { context, page, tag: zoom === 1 ? size.label : `${size.label}-text130` };
}
async function shot(page, name, fullPage = false) {
  await page.waitForTimeout(250);
  const file = `${stamp}-${name}.png`;
  await page.screenshot({ path: out + file, fullPage });
  results.screenshots.push(file);
}

// Character ranges catch orphaned CJK labels that element bounds miss.
async function audit(page, tag, state) {
  const issues = await page.evaluate(() => {
    const found = [];
    const walker = document.createTreeWalker(document.querySelector('#app'), NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.data;
      const el = n.parentElement;
      if (!text.trim() || !el || el.closest('svg') || !el.getClientRects().length) continue;
      const lines = [];
      for (let i = 0; i < text.length; i++) {
        if (/\s/.test(text[i])) continue;
        range.setStart(n, i); range.setEnd(n, i + 1);
        const r = range.getClientRects()[0];
        if (!r || !r.width) continue;
        const line = lines.find(l => Math.abs(l.top - r.top) < r.height / 2);
        if (line) line.text += text[i]; else lines.push({ top: r.top, text: text[i] });
      }
      if (lines.length < 2) continue;
      const control = el.closest('button:not(.answer-card):not(.question), a, summary, .card-effect > span, .charges, .card-name, .result-tag, .seat-note, .mood, .kicker, .fold-tag, .said-stamp, .stamp, .question-name em');
      const free = el.closest('.answer-text, .question-text, .identity-options small');
      const orphan = lines.slice(1).some(l => l.text.replace(/[。，、；：！？…）」』”’,.!?)\]]/g, '').length <= 1);
      if ((control && !free) || orphan) found.push({ kind: control && !free ? 'control-wrap' : 'orphan', cls: String(el.className || el.tagName), lines: lines.map(l => l.text) });
    }
    return found;
  });
  const bucket = results.wrapAudit[tag] ??= { states: [], issues: [] };
  bucket.states.push(state);
  for (const issue of issues) {
    const key = JSON.stringify(issue);
    if (!bucket.issues.some(i => JSON.stringify({ kind: i.kind, cls: i.cls, lines: i.lines }) === key)) bucket.issues.push({ state, ...issue });
  }
  return issues;
}

const active = page => page.evaluate(() => {
  const el = document.activeElement;
  const box = document.querySelector('.modal-box');
  return { tag: el?.tagName, action: el?.dataset?.action ?? null, inModal: !!box && box.contains(el), modal: !!box };
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
  const { context, page, tag } = await open(size, 21);
  await audit(page, tag, 'home');
  await page.locator('[data-action="rules"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('.modal-box').waitFor();
  const opened = await active(page);
  assert(opened.inModal && opened.action === 'close-rules', `${tag}: rules focus not inside dialog`);
  assert.deepEqual(await background(page), { inert: true, hidden: 'true' });
  const rulesCycle = await tabCycle(page, `${tag}-rules`);
  await audit(page, tag, 'rules');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.modal').count(), 0);
  assert.equal((await active(page)).action, 'rules', `${tag}: Esc did not return focus to rules`);
  await page.keyboard.press('Enter');
  await page.locator('.modal-box').waitFor();
  await page.keyboard.press('Enter');
  assert.equal((await active(page)).action, 'rules', `${tag}: close button did not return focus`);
  assert.deepEqual(await background(page), { inert: false, hidden: null });

  await page.locator('[data-action="start"]').click();
  await page.locator('.answer-card').first().waitFor();
  await page.locator('[data-action="pause"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('.modal-box').waitFor();
  assert.equal((await active(page)).action, 'resume', `${tag}: pause focus`);
  assert.deepEqual(await background(page), { inert: true, hidden: 'true' });
  const before = await page.evaluate(() => window.__rtdGame.elapsed);
  const pauseCycle = await tabCycle(page, `${tag}-pause`);
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__rtdGame.elapsed), before, `${tag}: time moved while paused`);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.__rtdGame.paused), false);
  assert.equal((await active(page)).action, 'pause', `${tag}: Esc did not return focus to pause`);
  await page.keyboard.press('Enter');
  await page.locator('[data-action="resume"]').waitFor();
  await page.keyboard.press('Enter');
  assert.equal((await active(page)).action, 'pause', `${tag}: 回桌继续 did not return focus`);
  await page.waitForTimeout(700);
  assert.equal((await active(page)).action, 'pause', `${tag}: focus lost after live re-render`);
  note(`${tag}: rules + pause dialogs trap focus (Tab/Shift+Tab ×9), background inert+aria-hidden, Esc/close return focus to trigger, pause freezes time`);
  results.focus.push({ size: tag, rulesCycle, pauseCycle });
  await context.close();
}

async function pauseFold(size, zoom = 1) {
  const { context, page, tag } = await open(size, 21, zoom);
  await audit(page, tag, 'home');
  const homeGap = await page.evaluate(() => {
    const title = document.querySelector('.home-title').getBoundingClientRect();
    const sign = document.querySelector('.opening-sign').getBoundingClientRect();
    const welcome = document.querySelector('.welcome').getBoundingClientRect();
    return { titleToSign: sign.left - title.right, titleToWelcome: welcome.top - title.bottom };
  });
  assert(homeGap.titleToSign >= 8 && homeGap.titleToWelcome >= 4, `${tag}: home title collides with sign/caption ${JSON.stringify(homeGap)}`);
  if (size !== short) await shot(page, `${tag}-home-full`, true);
  await page.locator('[data-action="start"]').click();
  await page.locator('.answer-card[data-card="taiji"]:not(:disabled)').click();
  await audit(page, tag, 'game-said-cooldown');
  if (size !== short) await shot(page, `${tag}-game-said`, true);
  await page.locator('[data-action="pause"]').click();
  await page.locator('[data-action="resume"]').waitFor();
  const measure = () => page.evaluate(() => {
    const box = document.querySelector('.modal-box');
    const details = box.querySelector('details');
    const summary = details.querySelector('summary');
    const tagEl = summary.querySelector('.fold-tag');
    const word = getComputedStyle(summary.querySelector('.fold-word'), '::before').content.replace(/"/g, '');
    const b = box.getBoundingClientRect();
    const buttons = [...box.querySelectorAll('[data-action]')].map(el => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { action: el.dataset.action, height: Math.round(r.height), insideBox: r.top >= b.top - 0.5 && r.bottom <= b.bottom + 0.5, inViewport: r.top >= 0 && r.bottom <= innerHeight, hit: el.contains(hit) };
    });
    const t = tagEl.getBoundingClientRect();
    return {
      open: details.open, word, arrow: getComputedStyle(tagEl.querySelector('svg')).transform,
      tagVisible: t.width > 20 && t.height > 12, summaryHeight: Math.round(summary.getBoundingClientRect().height),
      listStyle: getComputedStyle(summary).listStyleType,
      boxScrolls: box.scrollHeight > box.clientHeight + 1,
      detailsScroll: { scrollHeight: details.scrollHeight, clientHeight: details.clientHeight, scrollable: details.scrollHeight > details.clientHeight + 1 },
      buttons,
    };
  });
  const collapsed = await measure();
  assert.equal(collapsed.open, false);
  assert.equal(collapsed.word, '展开', `${tag}: collapsed hint`);
  assert(collapsed.tagVisible && collapsed.summaryHeight >= 44 && collapsed.listStyle === 'none', `${tag}: summary affordance ${JSON.stringify(collapsed)}`);
  assert(collapsed.buttons.every(b => b.insideBox && b.inViewport && b.hit && b.height >= 44), `${tag}: collapsed buttons ${JSON.stringify(collapsed.buttons)}`);
  await audit(page, tag, 'pause-collapsed');
  await shot(page, `${tag}-pause-collapsed`);

  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'SUMMARY', `${tag}: summary not keyboard reachable`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const expanded = await measure();
  assert.equal(expanded.open, true);
  assert.equal(expanded.word, '收起', `${tag}: expanded hint`);
  assert.notEqual(expanded.arrow, collapsed.arrow, `${tag}: arrow did not flip`);
  assert(expanded.buttons.every(b => b.insideBox && b.inViewport && b.hit && b.height >= 44), `${tag}: expanded buttons pushed out ${JSON.stringify(expanded.buttons)}`);
  assert(!expanded.boxScrolls, `${tag}: whole dialog scrolls instead of the rules area`);
  await audit(page, tag, 'pause-expanded');
  await shot(page, `${tag}-pause-expanded`);
  let scrolledToEnd = null;
  if (expanded.detailsScroll.scrollable) {
    scrolledToEnd = await page.evaluate(() => {
      const d = document.querySelector('.modal details');
      d.scrollTop = d.scrollHeight;
      const last = [...d.querySelectorAll('p')].pop().getBoundingClientRect();
      const box = d.getBoundingClientRect();
      const sticky = d.querySelector('summary').getBoundingClientRect();
      return { lastParagraphVisible: last.bottom <= box.bottom + 1 && last.top >= box.top, summaryStuck: Math.abs(sticky.top - box.top) < 2 };
    });
    assert(scrolledToEnd.lastParagraphVisible && scrolledToEnd.summaryStuck, `${tag}: rules area not scrollable to end ${JSON.stringify(scrolledToEnd)}`);
    await shot(page, `${tag}-pause-expanded-scrolled`);
  }
  const cycle = await tabCycle(page, `${tag}-pause-expanded`);
  await page.locator('.modal summary').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  const recollapsed = await measure();
  assert(!recollapsed.open && recollapsed.word === '展开', `${tag}: did not collapse`);
  results.pauseFold.push({ size: tag, viewport: `${size.width}x${size.height}`, collapsed, expanded, scrolledToEnd, cycle });
  note(`${tag} (${size.width}x${size.height}): 「四张牌怎么用」 shows 展开/收起 paper tag + hand-drawn arrow that flips; keyboard Enter toggles; expanded rules scroll inside dialog${scrolledToEnd ? ' (scrolled to end, title sticky)' : ''}; 回桌继续/重开/离席 stay inside dialog, in viewport, clickable, ≥44px`);
  await context.close();
}

async function posterChecks(size, zoom = 1) {
  const { context, page, tag } = await open(size, 33, zoom);
  await page.locator('[data-action="start"]').click();
  await page.locator('.answer-card[data-card="taiji"]:not(:disabled)').click();
  await page.locator('[data-action="pause"]').click();
  await page.locator('[data-action="finish"]').click();
  await page.locator('[data-action="poster"]').waitFor();
  await audit(page, tag, 'result');
  await page.evaluate(() => { const real = HTMLCanvasElement.prototype.toDataURL; window.__restoreCanvas = () => { HTMLCanvasElement.prototype.toDataURL = real; }; HTMLCanvasElement.prototype.toDataURL = () => 'data:,'; });
  const flow = [];
  // Measured exactly as the user sees it after the click: no scrolling by the test.
  const inspect = () => page.evaluate(() => {
    const retry = document.querySelector('[data-retry]');
    const box = document.querySelector('.poster-error');
    const text = document.querySelector('.poster-error p');
    const bounds = el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
    if (!retry) return { errors: document.querySelectorAll('.poster-error').length, notices: document.querySelectorAll('.notice').length };
    const r = bounds(retry); const t = bounds(text); const b = bounds(box);
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { scrollY: Math.round(scrollY), viewport: innerHeight, errors: document.querySelectorAll('.poster-error').length, notices: document.querySelectorAll('.notice').length, box: b, retry: r, overlap: !(t.bottom <= r.top || t.top >= r.bottom || t.right <= r.left || t.left >= r.right), hit: retry.contains(hit), boxInView: b.top >= 0 && b.bottom <= innerHeight, retryInView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, focused: document.activeElement === retry, scrollWidth: document.documentElement.scrollWidth, width: innerWidth };
  });
  const checkFail = (s, step) => {
    assert.equal(s.errors, 1, `${tag} ${step}: error count`); assert.equal(s.notices, 0);
    assert.equal(s.overlap, false, `${tag} ${step}: error text overlaps retry`);
    assert(s.boxInView && s.retryInView, `${tag} ${step}: error box/retry not fully in viewport ${JSON.stringify(s)}`);
    assert(s.box.bottom <= s.viewport - 8, `${tag} ${step}: no breathing room for the error box shadow`);
    assert(s.hit && s.retry.height >= 44 - 0.1, `${tag} ${step}: retry not clickable/44px ${JSON.stringify(s)}`);
    assert(s.focused, `${tag} ${step}: retry not focused`);
    assert(s.scrollWidth <= s.width, `${tag} ${step}: horizontal overflow`);
  };
  await page.locator('.start[data-action="poster"]').click();
  let s = await inspect(); flow.push({ step: 'fail-1', ...s }); checkFail(s, 'fail-1');
  await audit(page, tag, 'result-poster-error');
  await shot(page, `${tag}-poster-fail`);
  await page.locator('[data-retry]').click();
  s = await inspect(); flow.push({ step: 'fail-2-retry', ...s }); checkFail(s, 'fail-2');
  await shot(page, `${tag}-poster-fail-2`);
  await shot(page, `${tag}-result-full`, true);
  // Insertion above a scrolled viewport must also reveal the whole error.
  await page.evaluate(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    window.__restoreContext = () => { HTMLCanvasElement.prototype.getContext = real; };
    HTMLCanvasElement.prototype.getContext = () => null;
    scrollTo(0, document.documentElement.scrollHeight);
    document.querySelector('.start[data-action="poster"]').click();
  });
  s = await inspect(); flow.push({ step: 'fail-3-from-bottom-getContext-null', ...s }); checkFail(s, 'fail-3');
  await page.evaluate(() => window.__restoreContext());
  results.posterFlow.push({ size: tag, flow });
  await context.close();

  const second = await open(size, 33, zoom);
  const p2 = second.page;
  await p2.locator('[data-action="start"]').click();
  await p2.locator('.answer-card[data-card="taiji"]:not(:disabled)').click();
  await p2.locator('[data-action="pause"]').click();
  await p2.locator('[data-action="finish"]').click();
  await p2.evaluate(() => { const real = HTMLCanvasElement.prototype.toDataURL; window.__restoreCanvas = () => { HTMLCanvasElement.prototype.toDataURL = real; }; HTMLCanvasElement.prototype.toDataURL = () => 'data:,'; });
  await p2.locator('.start[data-action="poster"]').click();
  assert.equal(await p2.locator('.poster-error').count(), 1);
  await p2.evaluate(() => window.__restoreCanvas());
  await p2.locator('[data-retry]').click();
  await p2.locator('.poster-image').waitFor();
  assert.equal(await p2.locator('.poster-error').count(), 0, `${tag}: stale error after success`);
  assert.equal(await p2.locator('.notice').count(), 0);
  const img = await p2.evaluate(async () => { const i = document.querySelector('.poster-image'); await i.decode(); return { w: i.naturalWidth, h: i.naturalHeight, png: i.src.startsWith('data:image/png;base64,') }; });
  assert.deepEqual(img, { w: 1080, h: 1440, png: true });
  await audit(p2, tag, 'poster-page');
  await shot(p2, `${tag}-poster-success`);
  await p2.locator('[data-action="back"]').click();
  assert.equal(await p2.locator('.poster-error').count(), 0, `${tag}: stale error on back`);
  results.posterFlow.find(f => f.size === tag).success = { img, staleAfterSuccess: 0, staleAfterBack: 0 };
  note(`${tag}: poster fail→fail→fail(scrolled to bottom, getContext null): one error at a time, error box + retry fully in viewport without test scrolling, retry ≥44px/clickable/not overlapped/focused; fail→success clears error, 1080×1440 PNG, none after back`);
  await second.context.close();
}

async function sweep(size, zoom = 1) {
  const { context, page, tag } = await open(size, 5, zoom);
  await page.locator('[data-action="start"]').click();
  await page.locator('.answer-card').first().waitFor();
  const seen = new Set();
  for (let i = 0; i < 700; i++) {
    const s = await page.evaluate(step => {
      const g = window.__rtdGame;
      if (g.phase !== 'playing') return { phase: g.phase };
      g.tick(0.35);
      const order = ['counter', 'crazy', 'sincere', 'taiji'];
      const pick = order[(step + Math.floor(step / 4)) % 4];
      if (step % 3 === 0) document.querySelector(`.answer-card[data-card="${pick}"]`)?.click();
      return { phase: g.phase, wave: g.wave, charges: Object.values(g.charges).join(), trio: g.active.some(q => q.asker === 'table'), double: g.active.length };
    }, i);
    if (s.phase === 'finished') break;
    await page.waitForTimeout(40);
    if (s.phase === 'reward') {
      await audit(page, tag, `reward-${i}`);
      await page.locator('[data-reward="soup"]').click();
      continue;
    }
    const key = JSON.stringify(s);
    if (i % 4 === 0 || !seen.has(key)) { seen.add(key); await audit(page, tag, `sweep-${i}-w${s.wave}`); }
  }
  await page.locator('[data-action="poster"]').waitFor({ timeout: 10000 });
  await audit(page, tag, 'sweep-result');
  note(`${tag}: wrap sweep through all waves (${results.wrapAudit[tag].states.length} audited states incl. rewards, trio, double questions, empty cards)`);
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
    if (zero && !seen.zeroCharges) { seen.zeroCharges = { ...s, at: (Date.now() - started) / 1000 }; await audit(page, '320', 'zero-charges'); await shot(page, '320-zero-charges', true); }
    if (s.phase === 'playing' && s.cardCount === 4 && s.enabled.length === 0 && zero && !seen.allDisabled && s.active > 0) { seen.allDisabled = s; await audit(page, '320', 'zero-all-disabled'); await shot(page, '320-zero-all-disabled', true); }
    if (s.phase === 'reward') { await page.locator('[data-reward="soup"]').click(); seen.rewards++; continue; }
    const pick = ['counter', 'crazy', 'sincere', 'taiji'].find(card => s.enabled.includes(card));
    if (pick && s.active > 0) await page.locator(`.answer-card[data-card="${pick}"]`).click().catch(() => {});
    await page.waitForTimeout(120);
  }
  const report = await page.evaluate(() => window.__rtdGame.report);
  assert(report, 'zero-card game did not reach settlement');
  assert(seen.zeroCharges, 'never reached zero limited charges');
  assert(seen.allDisabled, 'never observed the all-disabled cooldown state');
  assert.equal(seen.blank, 0, 'blank screen during zero-card play');
  assert.equal(seen.stalls, 0, 'clock stalled during zero-card play');
  await shot(page, '320-zero-result', true);
  results.zeroCards = { seen, report: { score: report.score, title: report.title, grade: report.grade, mood: report.mood, won: report.won, elapsed: report.elapsed }, realSeconds: (Date.now() - started) / 1000 };
  note(`320 zero cards (real clock): limited charges hit 0 at ${seen.zeroCharges.at.toFixed(1)}s; ${seen.allDisabled ? 'all four disabled during taiji cooldown observed, ' : ''}no blank screen or clock stall; taiji-only play reached settlement (${report.title}, ${report.score} points, mood ${report.mood})`);
  await context.close();
}

try {
  for (const size of sizes) await focusChecks(size);
  for (const size of [...sizes, short]) await pauseFold(size);
  await pauseFold(sizes[0], 1.3);
  await pauseFold(short, 1.3);
  for (const size of sizes) await posterChecks(size);
  await posterChecks(sizes[0], 1.3);
  for (const size of sizes) await sweep(size);
  await sweep(sizes[0], 1.3);
  await zeroCards();
  const wrapIssues = Object.entries(results.wrapAudit).flatMap(([tag, b]) => b.issues.map(i => ({ tag, ...i })));
  results.wrapIssueCount = wrapIssues.length;
  assert.deepEqual(wrapIssues, [], 'wrap audit found stranded characters or wrapped controls');
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
