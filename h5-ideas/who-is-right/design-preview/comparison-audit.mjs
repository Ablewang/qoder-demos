import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = new URL('./', import.meta.url);
const base = 'http://127.0.0.1:5219/design-preview/';
const unchanged = ['thanks-note.png', 'claim-note.png', 'audit.json', '../src/main.ts', '../src/style.css', '../src/content/sayings.json', '../src/content/thanks.ts', '../tests/browser.e2e.ts'];
const digest = async () => Object.fromEntries(await Promise.all(unchanged.map(async (name) => [name, createHash('sha256').update(await readFile(new URL(name, root))).digest('hex')])));
const before = await digest();
const thanksSource = await readFile(new URL('../src/content/thanks.ts', root), 'utf8');
assert.ok(thanksSource.includes("lines: ['{称呼}，谢谢惦记', '我都记着呢', '会照顾好自己']"));
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const report = { browser: browser.version(), errors: [], text: [], screens: [], limitations: ['Static composition comparison only. No production size, download, native long-press or system-font validation.'] };
try {
  const render = await browser.newPage();
  await render.route('**/@vite/client', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await render.goto(`${base}render.html`);
  const data = await render.evaluate(async () => {
    const { drawShortThanksNote } = await import('./notes.js');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const original = context.fillText.bind(context);
    const records = [];
    context.fillText = (value, x, y) => {
      const metrics = context.measureText(value);
      records.push({ text: value, font: context.font, canvasFontPixels: Number(context.font.match(/([\d.]+)px/)[1]), left: x - metrics.actualBoundingBoxLeft, top: y - metrics.actualBoundingBoxAscent, right: x + metrics.actualBoundingBoxRight, bottom: y + metrics.actualBoundingBoxDescent });
      original(value, x, y);
    };
    drawShortThanksNote(canvas);
    return { url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, records };
  });
  assert.equal(data.width, 1080);
  assert.equal(data.height, 720);
  for (const item of data.records) assert.ok(item.left >= 0 && item.top >= 0 && item.right <= 1080 && item.bottom <= 720, `clipped: ${item.text}`);
  assert.ok(data.records.some((item) => item.text === '奶奶，'));
  assert.ok(data.records.some((item) => item.text === '谢谢惦记'));
  assert.ok(data.records.some((item) => item.text === '我都记着呢'));
  assert.ok(data.records.some((item) => item.text === '会照顾好自己'));
  assert.ok(data.records.some((item) => item.text === '静态评审样卡 · 虚构称呼'));
  assert.ok(data.records.some((item) => item.text === '本地内测，非医疗建议'));
  const png = Buffer.from(data.url.split(',')[1], 'base64');
  assert.equal(png.readUInt32BE(16), 1080);
  assert.equal(png.readUInt32BE(20), 720);
  await writeFile(new URL('thanks-note-short.png', root), png);
  report.text = data.records;
  report.shortPng = { width: 1080, height: 720, bytes: png.length };
  await render.close();
  for (const { width, height, tier } of [
    { width: 1100, height: 900, tier: 'std' },
    { width: 390, height: 844, tier: 'std' },
    { width: 320, height: 740, tier: 'std' },
    { width: 320, height: 740, tier: 'xl' },
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.route('**/@vite/client', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }));
    page.on('pageerror', (error) => report.errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
    await page.goto(`${base}index.html#thanks`);
    await page.locator('a[href="#thanks-compare"]').waitFor();
    await page.locator('a[href="#thanks-compare"]').click();
    await page.locator('.comparison-grid').waitFor();
    if (tier === 'xl') {
      await page.locator('.font-control summary').click();
      await page.locator('[data-font="xl"]').click();
    }
    await page.locator('[data-comparison="short"] img').evaluate((image) => image.decode());
    await page.locator('[data-comparison="long"] img').evaluate((image) => image.decode());
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => scrollTo(0, 0));
    const prefix = `compare-${width}x${height}-${tier === 'xl' ? '25px' : '18px'}`;
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      font: getComputedStyle(document.documentElement).fontSize,
      gridColumns: getComputedStyle(document.querySelector('.comparison-grid')).gridTemplateColumns,
      images: [...document.querySelectorAll('.comparison-grid img')].map((image) => ({ variant: image.closest('figure').dataset.comparison, displayedWidth: image.getBoundingClientRect().width, displayedHeight: image.getBoundingClientRect().height, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight })),
    }));
    assert.ok(metrics.documentWidth <= width);
    assert.equal(metrics.font, tier === 'xl' ? '25px' : '18px');
    assert.equal(metrics.images[0].displayedWidth, metrics.images[1].displayedWidth);
    assert.equal(metrics.images[0].naturalHeight, 1440);
    assert.equal(metrics.images[1].naturalHeight, 720);
    await page.screenshot({ path: new URL(`screenshots/${prefix}-viewport.png`, root).pathname });
    await page.screenshot({ path: new URL(`screenshots/${prefix}-full.png`, root).pathname, fullPage: true });
    for (const variant of ['long', 'short']) {
      const figure = page.locator(`[data-comparison="${variant}"]`);
      await figure.scrollIntoViewIfNeeded();
      await page.screenshot({ path: new URL(`screenshots/${prefix}-${variant}-viewport.png`, root).pathname });
      await figure.screenshot({ path: new URL(`screenshots/${prefix}-${variant}-same-width.png`, root).pathname });
    }
    const displayedWidth = metrics.images[1].displayedWidth;
    metrics.shortTextDisplayPixels = data.records.map((item) => ({ text: item.text, px: Number((item.canvasFontPixels * displayedWidth / 1080).toFixed(2)) }));
    metrics.longTextDisplayPixels = [78, 150, 86, 100, 36, 32].map((size) => Number((size * displayedWidth / 1080).toFixed(2)));
    await page.locator('.comparison-main > a.action').click();
    await page.locator('.article-head').waitFor();
    await page.evaluate(() => { location.hash = 'pending'; });
    await page.locator('.pending-header').waitFor();
    assert.equal(await page.locator('.article-actions button').isDisabled(), true);
    await page.evaluate(() => { location.hash = 'export'; });
    await page.locator('[data-note-image][src="./claim-note.png"]').waitFor();
    await page.locator('[data-toggle-state]').click();
    assert.equal(await page.locator('[data-note-image]').isVisible(), false);
    assert.equal(await page.locator('[data-save-hint]').isVisible(), false);
    assert.equal(await page.locator('[data-mock-save]').isDisabled(), true);
    report.screens.push({ width, height, tier, ...metrics });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  const after = await digest();
  assert.deepEqual(after, before);
  report.unchangedHashes = after;
  await writeFile(new URL('comparison-audit.json', root), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ browser: report.browser, png: report.shortPng, screenshots: report.screens.length * 6, phone320: report.screens.filter((item) => item.width === 320), errors: report.errors, retainedOriginalAssetsAndSources: true }, null, 2));
} finally {
  await browser.close();
}
