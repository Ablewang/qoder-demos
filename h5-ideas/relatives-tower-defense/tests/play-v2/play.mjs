import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('./', import.meta.url));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const results = { run: stamp, environment: 'Chrome mobile/touch emulation and desktop, real RAF clock and DOM clicks', checks: [], games: [], layouts: [], screenshots: [], errors: [], limits: ['No physical phone, WeChat or listening test', 'True OS background-hidden auto-pause is not verified'] };
const note = text => { results.checks.push(text); console.log(text); };
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const contexts = [];
async function open(width, height, seed, mobile = true) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, acceptDownloads: true });
  contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', e => results.errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') results.errors.push(e.text()); });
  await page.goto(`http://127.0.0.1:5211/?probe=1&seed=${seed}`);
  await page.locator('[data-action="start"]').waitFor();
  return page;
}
async function click(page, selector) {
  await page.waitForFunction(s => { const el = document.querySelector(s); return el && !el.disabled; }, selector, { timeout: 20000 });
  await page.locator(selector).click();
}
async function shot(page, label, fullPage = true) {
  await page.waitForTimeout(280);
  const name = `${stamp}-${label}.png`;
  await page.screenshot({ path: out + name, fullPage });
  results.screenshots.push(name);
}
async function state(page) {
  return page.evaluate(() => {
    const g = window.__rtdGame;
    if (!g) return null;
    return { phase: g.phase, wave: g.wave, mood: g.mood, elapsed: g.elapsed, reading: g.reading, paused: g.paused, freeze: g.freeze, cooldown: g.cooldown, lock: g.lock, targetUid: g.targetUid, target: g.target ? { uid: g.target.uid, asker: g.target.asker, kind: g.target.question.kind, hp: g.target.hp, question: g.target.question.text, answers: g.target.question.answers } : null, active: g.active.map(q => ({ uid: q.uid, asker: q.asker, remaining: q.remaining, readShown: q.readShown, hp: q.hp })), charges: { ...g.charges, taiji: 'Infinity' }, logLength: g.log.length, report: g.report, lastEffect: g.lastEffect };
  });
}
async function layout(page, label, requireCards = true) {
  const data = await page.evaluate(() => {
    const bounds = el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
    const controls = [...document.querySelectorAll('button, .start')].filter(e => e.getBoundingClientRect().height > 0).map(e => ({ action: e.dataset.action || e.dataset.card || e.dataset.target || e.dataset.identity || e.dataset.reward || 'download', ...bounds(e) }));
    const text = [...document.querySelectorAll('.question-text,.answer-text,.card-effect,.question-name,.question-meta')].map(e => ({ value: e.textContent, width: e.clientWidth, scrollWidth: e.scrollWidth, height: e.clientHeight, scrollHeight: e.scrollHeight }));
    const hits = [...document.querySelectorAll('.question:not(:disabled),.answer-card:not(:disabled)')].filter(e => { const r = e.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0 && !document.querySelector('.modal'); }).map(e => { const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { value: e.textContent, okay: hit === e || e.contains(hit) }; });
    return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight, app: bounds(document.querySelector('#app')), people: [...document.querySelectorAll('.person')].map(bounds), controls, text, hits, cards: [...document.querySelectorAll('.answer-card')].map(bounds) };
  });
  assert(data.scrollWidth <= data.width, label + ' horizontal overflow');
  for (const c of data.controls) assert(c.height >= 44 - 0.1, `${label}: short control ${c.action}: ${c.height}`);
  for (const t of data.text) { assert(t.scrollWidth <= t.width + 1, `${label}: text width clipped: ${t.value}`); assert(t.scrollHeight <= t.height + 1, `${label}: text height clipped: ${t.value}`); }
  for (const hit of data.hits) assert(hit.okay, `${label}: hit stolen: ${hit.value}`);
  for (const person of data.people) assert(person.left >= data.app.left - 1 && person.right <= data.app.right + 1, label + ' person outside frame');
  if (requireCards && data.cards.length) assert(data.cards.every(c => c.top >= 0 && c.bottom <= data.height), label + ' cards do not fit first viewport: ' + JSON.stringify(data.cards));
  results.layouts.push({ label, ...data });
  return data;
}
async function pauseCheck(page, label) {
  await click(page, '[data-action="pause"]');
  const before = await state(page);
  await page.waitForTimeout(1400);
  const after = await state(page);
  for (const key of ['elapsed', 'reading', 'cooldown', 'freeze', 'mood', 'targetUid']) assert.deepEqual(after[key], before[key], `${label}: pause ${key}`);
  assert.deepEqual(after.active, before.active);
  await layout(page, `${label}-pause`, false);
  await shot(page, `${label}-pause`);
  await click(page, '[data-action="resume"]');
  assert.equal((await state(page)).paused, false);
  note(label + ': pause freezes elapsed, free-read, patience, cooldown and freeze; resume works');
}
async function entryChecks(page, label) {
  await layout(page, `${label}-home`, false);
  await shot(page, `${label}-home`);
  await click(page, '[data-action="rules"]');
  assert.match(await page.locator('.modal-box').innerText(), /8 秒免费读牌/);
  await shot(page, `${label}-rules`);
  await click(page, '[data-action="close-rules"]');
  for (const identity of ['single', 'married', 'graduate', 'exam']) {
    await click(page, `[data-identity="${identity}"]`);
    await click(page, '[data-action="start"]');
    assert((await state(page)).target);
    await click(page, '[data-action="pause"]');
    const current = await state(page);
    await click(page, '[data-action="finish"]');
    const ended = await state(page);
    assert.equal(ended.report.won, false);
    assert.equal(ended.report.reason, '主动收席，自己的节奏自己定');
    assert.equal(ended.report.score, current.mood * 3);
    await page.locator('.result-page').waitFor();
    if (identity === 'exam') await shot(page, `${label}-active-exit`);
    await click(page, '[data-action="home"]');
  }
  note(label + ': all four identities start; active leave settles real score and does not pretend to win');
}
async function soundCheck(page, label) {
  assert.match(await page.locator('[data-action="sound"]').getAttribute('aria-label'), /音效已关/);
  await click(page, '[data-action="sound"]');
  assert.equal(await page.evaluate(() => localStorage.getItem('relatives-sound')), 'on');
  await click(page, '[data-action="sound"]');
  assert.equal(await page.evaluate(() => localStorage.getItem('relatives-sound')), 'off');
  assert.equal(await page.locator('[data-action="sound"]').getAttribute('aria-pressed'), 'false');
  note(label + ': sound enabled then disabled; only UI/persistence tested, not human listening');
}
async function mixedSetup(page) {
  await click(page, '[data-action="read"]');
  const before = await state(page);
  await click(page, '[data-card="crazy"]');
  const after = await state(page);
  assert.equal(after.charges.crazy, before.charges.crazy - 1);
  await shot(page, '320-crazy-feedback');
  note(`320: real crazy card played, outcome ${after.lastEffect}, charge decremented`);
}
async function doubleCheck(page, label) {
  await page.waitForFunction(() => window.__rtdGame.active.length === 2, null, { timeout: 20000 });
  const before = await state(page);
  const other = before.active.find(q => q.uid !== before.targetUid);
  await click(page, `[data-target="${other.uid}"]`);
  const selected = await state(page);
  assert.equal(selected.targetUid, other.uid);
  assert.equal(selected.reading > 7, true);
  const patience = selected.active.map(q => q.remaining);
  await page.waitForTimeout(1100);
  assert.deepEqual((await state(page)).active.map(q => q.remaining), patience);
  await layout(page, label + '-double');
  await shot(page, label + '-double');
  await pauseCheck(page, label + '-double-read');
  await click(page, `[data-target="${before.targetUid}"]`);
  assert.equal((await state(page)).reading, 0);
  await click(page, `[data-target="${other.uid}"]`);
  assert.equal((await state(page)).reading, 0);
  const target = (await state(page)).target;
  for (const card of ['taiji', 'counter', 'crazy', 'sincere']) assert.equal(await page.locator(`[data-card="${card}"] .answer-text`).innerText(), target.answers[card]);
  note(label + ': two actual questions, target switching updates all answers, free read freezes both patience timers, reread does not grant another 8 seconds');
}
async function fullGame(page, label, mode) {
  const started = Date.now();
  const seen = new Set();
  let doubleDone = mode !== 'mixed';
  let normalSincere = false;
  let counterPlays = 0;
  let lastUid = null;
  let lastFeedbackSequence = 0;
  let bossShot = false;
  while (Date.now() - started < 300000) {
    let g = await state(page);
    if (g.phase === 'finished') {
      await page.locator('.result-page').waitFor();
      assert(g.report.won, `${label}: full match must win`);
      assert.equal(await page.locator('.score').innerText(), `${g.report.score} 分\n心态剩余 ${g.report.mood}`);
      await layout(page, label + '-result', false);
      await shot(page, label + '-result');
      results.games.push({ label, mode, realSeconds: (Date.now() - started) / 1000, report: g.report });
      note(`${label}: naturally finished; ${g.report.score} points, ${g.report.title}, ${g.report.grade}, mood ${g.report.mood}`);
      return;
    }
    if (g.phase === 'reward') {
      if (!seen.has('reward' + g.wave)) {
        await layout(page, label + '-reward-' + g.wave);
        await shot(page, label + '-reward-' + g.wave);
        seen.add('reward' + g.wave);
        const elapsed = g.elapsed;
        await page.waitForTimeout(700);
        assert.equal((await state(page)).elapsed, elapsed);
      }
      await click(page, mode === 'mixed' ? '[data-reward="sincere"]' : '[data-reward="soup"]');
      continue;
    }
    if (!g.target || g.lock > 0) { await page.waitForTimeout(100); continue; }
    if (g.target.uid !== lastUid) {
      lastUid = g.target.uid;
      await layout(page, `${label}-question-${lastUid}`);
      const displayed = await page.locator(`[data-target="${lastUid}"] .question-text`).innerText();
      assert.equal(displayed, g.target.question);
    }
    if (!doubleDone && g.wave === 1 && g.target.kind === 'warm') {
      if (g.reading > 0) await click(page, '[data-action="read"]');
      await doubleCheck(page, label);
      doubleDone = true;
      g = await state(page);
    }
    if (g.target.kind === 'boss' && !bossShot) {
      bossShot = true;
      await shot(page, label + '-long-boss');
      await pauseCheck(page, label + '-boss');
      if (label === '320') {
        await page.setViewportSize({ width: 320, height: 568 });
        const data = await layout(page, '320-short-568-scroll', false);
        assert(data.pageHeight > data.height);
        await shot(page, '320-short-568-scroll');
        await page.setViewportSize({ width: 320, height: 740 });
        note('320×568: page scrolls, no text shrink or clip; controls remain touch-sized');
      }
      g = await state(page);
    }
    if (g.reading > 0) await click(page, '[data-action="read"]');
    g = await state(page);
    let card;
    if (mode === 'mixed' && g.charges.sincere > 0 && (g.target.kind === 'warm' || g.target.kind === 'boss' || (!normalSincere && g.wave >= 1))) {
      card = 'sincere';
      if (g.target.kind !== 'warm' && g.target.kind !== 'boss') normalSincere = true;
    } else if (counterPlays < 3 && g.charges.counter > 0 && g.target.kind !== 'warm') card = 'counter';
    else if (g.cooldown <= 0) card = 'taiji';
    if (!card) { await page.waitForTimeout(100); continue; }
    const oldUid = g.targetUid;
    const oldCharge = g.charges[card];
    await click(page, `[data-card="${card}"]`);
    const after = await state(page);
    if (card === 'counter') counterPlays++;
    if (card !== 'taiji' && !(card === 'sincere' && g.target.kind === 'warm')) assert.equal(after.charges[card], oldCharge - 1);
    if (card === 'sincere' && g.target.kind === 'warm') { assert.equal(after.charges.sincere, oldCharge); note(label + ': sincere warm charge returned'); }
    if (after.phase === 'playing') {
      assert.equal(await page.locator('.read-row').getAttribute('data-feedback-uid'), String(oldUid));
      if (after.targetUid !== null && oldUid !== after.targetUid) assert.equal(await page.locator('.read-row').getAttribute('data-feedback-relation'), 'previous');
      if (!seen.has('feedback-' + card)) { await shot(page, label + '-feedback-' + card); seen.add('feedback-' + card); }
      const seq = after.logLength;
      assert(seq > lastFeedbackSequence); lastFeedbackSequence = seq;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(label + ' full match timed out');
}
async function passiveLoss(page) {
  await click(page, '[data-action="start"]');
  const began = Date.now();
  while (Date.now() - began < 300000) {
    const g = await state(page);
    if (g.phase === 'finished') {
      assert.equal(g.report.mood, 0);
      assert.equal(g.report.title, '厨房避难者');
      assert.equal(g.report.won, false);
      await shot(page, '390-natural-loss');
      results.games.push({ label: '390-passive-loss', realSeconds: (Date.now() - began) / 1000, report: g.report });
      note('390: no card played, natural mood-zero settlement reached');
      return;
    }
    if (g.phase === 'reward') await click(page, '[data-reward="crazy"]');
    if (g.reading > 0) await click(page, '[data-action="read"]');
    await page.waitForTimeout(250);
  }
  throw new Error('passive loss timed out');
}
async function posterCheck(page) {
  const before = await page.locator('.result-speech blockquote').innerText();
  if (await page.locator('[data-action="quote"]').count()) { await click(page, '[data-action="quote"]'); assert.notEqual(await page.locator('.result-speech blockquote').innerText(), before); }
  await click(page, '[data-action="poster"]');
  await page.locator('.poster-image').evaluate(img => img.decode());
  const png = await page.locator('.poster-image').evaluate(img => ({ w: img.naturalWidth, h: img.naturalHeight, length: img.src.length }));
  assert.equal(png.w, 1080); assert.equal(png.h, 1440); assert(png.length > 50000);
  await shot(page, '390-poster-page');
  const pending = page.waitForEvent('download');
  await page.locator('a[download]').click();
  const downloaded = await pending;
  const pngName = `${stamp}-real-battle-report.png`;
  await downloaded.saveAs(out + pngName);
  assert.equal(await downloaded.failure(), null);
  results.poster = { ...png, file: pngName };
  await click(page, '[data-action="back"]');
  await click(page, '[data-action="restart"]');
  const g = await state(page);
  assert.equal(g.wave, 0); assert.equal(g.mood, 100); assert.equal(g.charges.sincere, 3); assert.equal(g.charges.crazy, 3); assert.equal(g.charges.counter, 3);
  await click(page, '[data-action="pause"]');
  await click(page, '[data-action="restart"]');
  assert.equal((await state(page)).paused, false);
  note('390: quote switch, real 1080×1440 PNG download, result restart and pause-menu restart passed');
}
try {
  const [p390, p320, desktop, loss] = await Promise.all([open(390,844,318), open(320,740,775), open(1280,900,990,false), open(390,844,110)]);
  await Promise.all([entryChecks(p390,'390'), entryChecks(p320,'320'), entryChecks(desktop,'desktop')]);
  await click(p390, '[data-identity="single"]'); await click(p390, '[data-action="start"]');
  await click(p320, '[data-identity="graduate"]'); await click(p320, '[data-action="start"]');
  await click(desktop, '[data-identity="exam"]'); await click(desktop, '[data-action="start"]');
  await Promise.all([pauseCheck(p390,'390-single-read'), pauseCheck(p320,'320-single-read'), pauseCheck(desktop,'desktop-single-read')]);
  const read = await state(p390);
  await click(p390, `[data-target="${read.targetUid}"]`);
  const reread = await state(p390);
  assert(reread.reading <= read.reading && reread.reading > 0);
  await soundCheck(p390, '390');
  await mixedSetup(p320);
  await Promise.all([fullGame(p390,'390','boundary'), fullGame(p320,'320','mixed'), fullGame(desktop,'desktop','boundary'), passiveLoss(loss)]);
  await posterCheck(p390);
  await p390.reload(); await click(p390, '[data-action="start"]');
  assert.equal(await p390.locator('[data-action="sound"]').getAttribute('aria-pressed'), 'false');
  note('Muted preference survives full reload');
  assert.deepEqual(results.errors, []);
  results.passed = true;
} catch (error) {
  results.passed = false;
  results.failure = String(error.stack || error);
  console.error(results.failure);
  for (let i = 0; i < contexts.length; i++) for (const page of contexts[i].pages()) await shot(page, `failure-${i}`).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(out + `${stamp}-results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
