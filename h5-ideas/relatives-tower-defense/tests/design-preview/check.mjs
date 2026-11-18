import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const project = fileURLToPath(new URL('../../', import.meta.url));
const sourceFiles = ['src/main.ts', 'src/style.css', 'src/engine.ts', 'src/content.ts', 'src/content/questions.json', 'src/art.ts', 'src/poster.ts', 'src/audio.ts', 'tests/browser.mjs', 'tests/layout.mjs', 'tests/visual.mjs', 'tests/content.test.ts', 'tests/engine.test.ts', 'tests/poster.test.ts', 'PLAN.md', 'PRD.md', 'package.json', 'pnpm-lock.yaml'];
const hashes = Object.fromEntries(await Promise.all(sourceFiles.map(async name => [name, createHash('sha256').update(await readFile(project + name)).digest('hex')])));
let baseline;
try { baseline = JSON.parse(await readFile(here + 'scope-baseline.json', 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(here + 'scope-baseline.json', JSON.stringify(hashes, null, 2)); baseline = hashes; }
assert.deepEqual(hashes, baseline, '生产文件、原测试和文档不得变化');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const results = [];
const errors = [];

async function inspect(page, name) {
  return page.evaluate(name => {
    const box = element => { const r = element.getBoundingClientRect(); return { x: r.x, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    const lum = rgb => { const channels = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722; };
    const contrast = element => {
      const color = getComputedStyle(element).color;
      let node = element;
      let bg;
      while (node) { const candidate = getComputedStyle(node).backgroundColor; if (candidate !== 'rgba(0, 0, 0, 0)' && candidate !== 'transparent') { bg = candidate; break; } node = node.parentElement; }
      const a = lum(color), b = lum(bg || 'rgb(255, 245, 223)');
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    };
    const texts = [...document.querySelectorAll('.answer-text, .question-text')].map(el => ({ text: el.textContent, font: parseFloat(getComputedStyle(el).fontSize), ...box(el), clipped: el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1 }));
    const cards = [...document.querySelectorAll('[data-card]')].map(el => { const r = el.getBoundingClientRect(); return { card: el.dataset.card, ...box(el), hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[data-card]')?.dataset.card }; });
    const controls = [...document.querySelectorAll('button, a')].map(el => ({ label: el.textContent || el.getAttribute('aria-label'), ...box(el) }));
    const small = [...document.querySelectorAll('.review-label, .review-label span, .question-name, .target-mark, .question-meta, .seat-note, .player-label, .mood, .read-row, .card-effect, .charges, .battle-footnote, .entry-note, .place-heading, .place-heading span')].map(el => ({ text: el.textContent, contrast: contrast(el) }));
    return { name, viewport: [innerWidth, innerHeight], scrollY, scrollWidth: document.documentElement.scrollWidth, texts, cards, controls, small, animations: document.getAnimations().length };
  }, name);
}

try {
  for (const [width, height] of [[320, 740], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    for (const view of ['home', 'single', 'double', 'long']) {
      await page.goto(`http://127.0.0.1:5211/tests/design-preview/?view=${view}`);
      await page.waitForFunction(() => !!window.designPreview);
      await page.evaluate(() => scrollTo(0, 0));
      const data = await inspect(page, `${view}-${width}x${height}`);
      results.push(data);
      await page.screenshot({ path: `${here}${view}-${width}x${height}.png`, fullPage: false });
      assert(data.scrollWidth <= width, `${data.name}不能横向溢出`);
      assert(data.controls.every(control => control.width >= 44 && control.height >= 44), `${data.name}触区不足44：${JSON.stringify(data.controls)}`);
      assert(data.small.every(text => text.contrast >= 4.5), `${data.name}小字对比度不足：${JSON.stringify(data.small)}`);
      assert(data.texts.every(text => text.font >= 14 && !text.clipped), `${data.name}台词不能缩字或裁切`);
      assert.equal(data.animations, 0);
      if (view === 'home') {
        const start = await page.locator('.start').boundingBox();
        assert(start.y + start.height <= height, '入席首屏可见');
        await page.locator('[data-identity="graduate"]').click();
        assert.equal(await page.locator('[data-identity="graduate"]').getAttribute('aria-pressed'), 'true');
        assert((await page.locator('.start').getAttribute('href')).includes('identity=graduate'));
      } else {
        assert.equal(data.cards.length, 4);
        assert(data.cards.every(card => card.bottom <= height && card.hit === card.card), `${data.name}四牌必须首屏完整可点：${JSON.stringify(data.cards)}`);
        const q = await page.locator('.question').last().boundingBox();
        assert(q.y + q.height <= data.cards[0].top, '牌不能遮题');
        if (view === 'double') {
          await page.locator('[data-seat="left"]').click();
          const warm = await page.evaluate(() => window.designPreview.questions.find(q => q.id === 'warm-03'));
          for (const card of ['taiji', 'counter', 'crazy', 'sincere']) assert.equal(await page.locator(`[data-card="${card}"] .answer-text`).textContent(), warm.answers[card]);
          await page.locator('[data-card="counter"]').click();
          assert((await page.locator('[data-person="left"] .seat-note').textContent()).includes('反问'));
          const after = await inspect(page, `reply-${width}x${height}`);
          assert(after.cards.every(card => card.bottom <= height));
          await page.screenshot({ path: `${here}reply-${width}x${height}.png`, fullPage: false });
        }
      }
    }
    await page.goto('http://127.0.0.1:5211/tests/design-preview/?view=double');
    await page.waitForFunction(() => !!window.designPreview);
    const original = JSON.parse(await readFile(project + 'src/content/questions.json', 'utf8'));
    let worst = { bottom: 0 };
    for (const q of original) {
      await page.evaluate(id => window.designPreview.textFixture(id), q.id);
      const texts = await page.locator('[data-card] .answer-text').allTextContents();
      assert.deepEqual(texts, ['taiji', 'counter', 'crazy', 'sincere'].map(card => q.answers[card]));
      const check = await inspect(page, q.id);
      assert(check.cards.every(card => card.bottom <= height), `${width}文本夹具${q.id}牌出屏`);
      assert(check.texts.every(text => text.font >= 14 && !text.clipped));
      const bottom = Math.max(...check.cards.map(card => card.bottom));
      if (bottom > worst.bottom) worst = { id: q.id, bottom };
    }
    results.push({ name: `text-stress-${width}`, fixtureOnly: true, questions: original.length, answers: original.length * 4, worst, note: '仅验证原文排版，不代表72局，也不展示夹具中的人物身份。' });
    await page.goto('http://127.0.0.1:5211/tests/design-preview/?view=report');
    await page.waitForFunction(() => !!window.designPreview);
    await page.screenshot({ path: `${here}report-${width}x${height}.png`, fullPage: false });
    await context.close();
  }
  const reportContext = await browser.newContext({ viewport: { width: 1080, height: 1440 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const reportPage = await reportContext.newPage();
  await reportPage.goto('http://127.0.0.1:5211/tests/design-preview/?view=report');
  await reportPage.waitForFunction(() => !!window.designPreview);
  await reportPage.locator('.report-poster').screenshot({ path: here + 'report-1080x1440.png' });
  const reportBox = await reportPage.locator('.report-poster').boundingBox();
  assert.equal(reportBox.width, 1080); assert.equal(reportBox.height, 1440);
  results.push({ name: 'report-1080x1440', ...reportBox, staticExample: true, engineConnected: false });
  await reportContext.close();
  assert.deepEqual(errors, []);
  await writeFile(here + 'review-metrics.json', JSON.stringify({ staticDesignOnly: true, errors, results, originalFilesUnchanged: true }, null, 2));
  console.log(JSON.stringify({ screenshots: 13, originalFilesUnchanged: true, states: results.length, errors, cardBottoms: results.filter(r => r.cards?.length).map(r => ({ name: r.name, bottom: Math.max(...r.cards.map(c => c.bottom)) })), worst: results.filter(r => r.fixtureOnly) }, null, 2));
} finally { await browser.close(); }
