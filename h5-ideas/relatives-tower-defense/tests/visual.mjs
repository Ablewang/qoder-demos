import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

const output = fileURLToPath(new URL('./screenshots/', import.meta.url));
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const results = { effects: [], posters: [], errors: [] };
async function click(page, selector) {
  await page.locator(selector).waitFor({ state: 'visible' });
  await page.waitForFunction(s => { const button = document.querySelector(s); return button && !button.disabled; }, selector);
  await page.locator(selector).click();
}
try {
  const probeContext = await browser.newContext();
  const probe = await probeContext.newPage();
  await probe.goto('http://127.0.0.1:5211');
  const seeds = await probe.evaluate(async () => {
    const { Game } = await import('/src/engine.ts');
    const found = {};
    for (let seed = 1; seed < 5000 && Object.keys(found).length < 3; seed++) {
      const crazy = new Game('single', seed);
      crazy.play('crazy');
      if (crazy.lastEffect === 'flop' && !found.flop) found.flop = seed;
      if (crazy.lastEffect === 'critical' && !found.critical) found.critical = seed;
      const counter = new Game('single', seed);
      counter.play('counter');
      for (let n = 0; n < 50 && !counter.target; n++) counter.tick(.25);
      if (counter.target?.hp === 4 && !found.counter) found.counter = seed;
    }
    return found;
  });
  assert.equal(Object.keys(seeds).length, 3);
  await probeContext.close();
  for (const reducedMotion of ['no-preference', 'reduce']) {
    for (const kind of ['counter', 'flop', 'critical']) {
      const context = await browser.newContext({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true, reducedMotion });
      await context.addInitScript(seed => { Date.now = () => seed; }, seeds[kind]);
      const page = await context.newPage();
      page.on('pageerror', error => results.errors.push(error.message));
      await page.goto('http://127.0.0.1:5211');
      await page.evaluate(() => {
        window.feedbackAnimations = [];
        const animate = Element.prototype.animate;
        Element.prototype.animate = function (...args) {
          if (this.matches('.speech')) window.feedbackAnimations.push(this.dataset.feedbackSequence);
          return animate.apply(this, args);
        };
      });
      await click(page, '[data-action="start"]');
      if (kind === 'counter') {
        const oldAnswer = await page.locator('[data-card="counter"] .answer-text').innerText();
        const oldUid = await page.locator('.question-bubble').getAttribute('data-target');
        await click(page, '[data-card="counter"]');
        assert.match(await page.locator('.speech').innerText(), /反问挡下/);
        assert.equal(await page.locator('.speech').getAttribute('data-feedback-uid'), oldUid);
        assert.equal(await page.locator('.speech').getAttribute('data-feedback-relation'), 'previous');
        assert(!(await page.locator('.speech').innerText()).includes(oldAnswer));
        await page.waitForFunction(() => document.querySelector('.question-bubble') && document.querySelector('.question-bubble .asker small').innerText.startsWith('4'));
        assert.match(await page.locator('[data-live="reading"]').innerText(), /免费读牌 [78] 秒/);
        await page.evaluate(() => {
          document.querySelector('[data-card="counter"]').click();
          document.querySelector('[data-card="counter"]').click();
          document.querySelector('[data-card="counter"]').click();
        });
        assert.equal(await page.locator('[data-card="counter"] em').innerText(), '剩 1');
        assert.match(await page.locator('.speech').innerText(), /反问生效/);
        assert.equal(await page.locator('.speech').getAttribute('data-feedback-relation'), 'current');
        assert.match(await page.locator('.speech').innerText(), /本问还剩 1 血/);
      } else {
        await click(page, '[data-card="crazy"]');
        assert.equal(await page.locator('.speech').getAttribute('data-feedback-kind'), kind);
        assert.match(await page.locator('.speech').innerText(), kind === 'flop' ? /发疯翻车[\s\S]*心态 -10/ : /发疯暴击[\s\S]*安静3秒/);
        assert.equal(await page.locator('[data-card="crazy"] em').innerText(), '剩 2');
        if (kind === 'critical') assert.match(await page.locator('[data-live="reading"]').innerText(), /全桌缓 [23] 秒/);
      }
      await page.waitForTimeout(600);
      const animations = await page.evaluate(() => window.feedbackAnimations);
      assert.equal(animations.length, reducedMotion === 'reduce' ? 0 : kind === 'counter' ? 2 : 1);
      assert.equal(new Set(animations).size, animations.length);
      const cards = await page.locator('[data-card]').evaluateAll(cards => cards.map(card => card.getBoundingClientRect().bottom));
      assert(cards.every(bottom => bottom <= 740));
      const feedback = await page.locator('.speech').innerText();
      await page.screenshot({ path: `${output}after-${kind}-${reducedMotion}-320-viewport.png`, fullPage: false });
      results.effects.push({ kind, reducedMotion, seed: seeds[kind], feedback, animations, cardBottom: Math.max(...cards) });
      await context.close();
    }
  }
  const posterContext = await browser.newContext({ viewport: { width: 1080, height: 1440 } });
  const page = await posterContext.newPage();
  await page.goto('http://127.0.0.1:5211');
  const reports = await page.evaluate(async () => {
    const { Game } = await import('/src/engine.ts');
    const modes = ['loss', 'peace', 'boundary', 'crazy', 'counter', 'taiji', 'missed'];
    return modes.map(mode => {
      const g = new Game('single', 42);
      let counters = 0, crazies = 0;
      for (let steps = 0; steps < 10000 && g.phase !== 'finished'; steps++) {
        if (g.phase === 'reward') g.reward(mode === 'peace' ? 'sincere' : 'soup');
        const target = g.target;
        if (target && mode !== 'loss' && !(mode === 'missed' && g.resolved < 2)) {
          g.skipReading();
          let card = 'taiji';
          if (mode === 'peace' && g.charges.sincere > 0) card = 'sincere';
          if ((mode === 'boundary' && counters < 3 || mode === 'counter' && counters < 2) && target.hp <= 3) card = 'counter';
          if (mode === 'crazy' && crazies < 3) card = 'crazy';
          if (g.canPlay(card) && g.play(card)) { if (card === 'counter') counters++; if (card === 'crazy') crazies++; }
        }
        g.tick(.25);
      }
      if (!g.report) throw new Error(`报告未生成：${mode}`);
      return { mode, report: g.report };
    });
  });
  const titles = ['厨房避难者', '家族和平大使', '边界守护者', '发疯艺术家', '反问小能手', '太极宗师', '埋头干饭王'];
  assert.deepEqual(reports.map(item => item.report.title), titles);
  assert.equal(reports.find(item => item.mode === 'boundary').report.score, 1900);
  for (const { mode, report } of reports) {
    const measurement = await page.evaluate(async report => {
      const { createPoster } = await import('/src/poster.ts');
      const draws = [], frames = [];
      const originalText = CanvasRenderingContext2D.prototype.fillText;
      const originalRect = CanvasRenderingContext2D.prototype.strokeRect;
      CanvasRenderingContext2D.prototype.fillText = function (value, x, y, ...args) {
        if (value === report.title) {
          const m = this.measureText(value);
          draws.push({ title: value, x, y, font: this.font, left: x - m.actualBoundingBoxLeft, right: x + m.actualBoundingBoxRight, top: y - m.actualBoundingBoxAscent, bottom: y + m.actualBoundingBoxDescent });
        }
        return originalText.call(this, value, x, y, ...args);
      };
      CanvasRenderingContext2D.prototype.strokeRect = function (x, y, width, height) {
        if (this.strokeStyle === '#a62e32') frames.push({ x, y, width, height, stroke: this.lineWidth });
        return originalRect.call(this, x, y, width, height);
      };
      let poster;
      try { poster = createPoster(report, report.quotes[0]); }
      finally { CanvasRenderingContext2D.prototype.fillText = originalText; CanvasRenderingContext2D.prototype.strokeRect = originalRect; }
      document.body.innerHTML = '';
      const image = document.createElement('img'); image.src = poster.dataUrl; image.style.width = '1080px'; image.alt = report.title;
      const link = document.createElement('a'); link.href = poster.dataUrl; link.download = poster.fileName; link.id = 'actual-download'; link.textContent = '下载';
      document.body.append(link, image); await image.decode();
      const draw = draws[0], frame = frames[0];
      return { draw, frame, width: image.naturalWidth, height: image.naturalHeight, bytes: poster.dataUrl.length,
        padding: { left: draw.left - frame.x - frame.stroke / 2, right: frame.x + frame.width - frame.stroke / 2 - draw.right, top: draw.top - frame.y - frame.stroke / 2, bottom: frame.y + frame.height - frame.stroke / 2 - draw.bottom } };
    }, report);
    assert.equal(measurement.width, 1080); assert.equal(measurement.height, 1440);
    assert(Object.values(measurement.padding).every(value => value >= 20));
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#actual-download').click();
    const download = await downloadPromise;
    await download.saveAs(`${output}report-${mode}.png`);
    assert.equal(await download.failure(), null);
    results.posters.push({ mode, title: report.title, score: report.score, ...measurement });
  }
  await posterContext.close();
  assert.deepEqual(results.errors, []);
  await writeFile(fileURLToPath(new URL('./visual-results.json', import.meta.url)), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
