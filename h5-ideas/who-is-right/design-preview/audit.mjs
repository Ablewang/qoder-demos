import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = new URL('./', import.meta.url);
const base = 'http://127.0.0.1:5219/design-preview/';
const library = JSON.parse(await readFile(new URL('content.json', root), 'utf8'));
const original = await readFile(new URL('../src/content/sayings.json', root), 'utf8');
assert.equal(await readFile(new URL('content.json', root), 'utf8'), original);
const salt = library.sayings.find((item) => item.id === 'salt-less');
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const report = { browser: browser.version(), scenarios: [], errors: [], originalSource: {}, pngs: [] };
try {
  const render = await browser.newPage();
  await render.route('**/@vite/client', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await render.goto(`${base}render.html`);
  for (const [name, thanks] of [['claim-note', false], ['thanks-note', true]]) {
    const data = await render.evaluate(async ({ salt, thanks }) => {
      const { drawNote } = await import('./notes.js');
      await document.fonts.ready;
      const canvas = drawNote(document.createElement('canvas'), salt, thanks);
      return { url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
    }, { salt, thanks });
    const png = Buffer.from(data.url.split(',')[1], 'base64');
    assert.equal(png.readUInt32BE(16), 1080);
    assert.equal(png.readUInt32BE(20), 1440);
    await writeFile(new URL(`${name}.png`, root), png);
    report.pngs.push({ file: `${name}.png`, width: data.width, height: data.height, bytes: png.length });
  }
  await render.close();
  for (const { width, height, tier } of [
    { width: 390, height: 844, tier: 'std' },
    { width: 320, height: 740, tier: 'std' },
    { width: 320, height: 740, tier: 'xl' },
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') report.errors.push({ message: message.text(), location: message.location() }); });
    page.on('response', (response) => { if (response.status() >= 400) console.log('HTTP', response.status(), response.url()); });
    await page.goto(`${base}index.html#home`);
    await page.locator('.directory li').first().waitFor();
    if (tier === 'xl') {
      await page.locator('.font-control > summary').click();
      await page.locator('button[data-font="xl"]').click();
    }
    const prefix = `${width}x${height}-${tier === 'xl' ? '25px' : '18px'}`;
    const captures = [];
    const capture = async (name) => {
      await page.evaluate(() => scrollTo(0, 0));
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(() => ({
        rootFont: getComputedStyle(document.documentElement).fontSize,
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        visibleOverflow: [...document.querySelectorAll('main *')].filter((element) => {
          if (!element.checkVisibility()) return false;
          const rect = element.getBoundingClientRect();
          return rect.width && (rect.right > innerWidth + 1 || rect.left < -1);
        }).map((element) => element.tagName + '.' + element.className),
      }));
      assert.equal(metrics.rootFont, tier === 'xl' ? '25px' : '18px');
      assert.equal(metrics.documentWidth, width, `${prefix}/${name} horizontal overflow`);
      assert.deepEqual(metrics.visibleOverflow, [], `${prefix}/${name} content overflow`);
      await page.screenshot({ path: new URL(`screenshots/${prefix}-${name}-viewport.png`, root).pathname });
      await page.screenshot({ path: new URL(`screenshots/${prefix}-${name}-full.png`, root).pathname, fullPage: true });
      captures.push({ name, ...metrics });
    };
    const route = async (hash, selector) => {
      await page.evaluate((hash) => { location.hash = hash; }, hash);
      await page.locator(selector).waitFor();
    };
    await capture('home');
    assert.equal(await page.locator('main > .directory li').count(), 8);
    assert.equal(await page.locator('.pending-directory .directory li').count(), 9);
    assert.equal(await page.locator('.pending-directory').getAttribute('open'), null);
    await page.locator('.pending-directory > summary').click();
    await capture('home-pending-expanded');
    await page.locator('#query').fill('少放盐');
    await page.locator('.search button').click();
    await page.locator('.directory-heading h2').filter({ hasText: '静态搜索结果' }).waitFor();
    await capture('results');
    await page.locator('.entry-title').click();
    await page.locator('.article-head').waitFor();
    assert.equal(await page.locator('.scope p').textContent(), salt.scopeNote);
    await capture('evidence');
    for (let index = 0; index < salt.sources.length; index++) {
      const record = page.locator('[data-source-record]').nth(index);
      await record.locator('summary').click();
      assert.equal(await record.locator('blockquote').textContent(), salt.sources[index].quote);
      assert.equal(await record.locator('a').getAttribute('href'), salt.sources[index].url);
    }
    await capture('evidence-expanded');
    if (tier === 'std' && width === 390) {
      const [sourcePage] = await Promise.all([
        page.waitForEvent('popup'),
        page.locator('[data-source-record] a').first().click(),
      ]);
      try {
        await sourcePage.waitForLoadState('domcontentloaded', { timeout: 25000 });
        report.originalSource = { url: sourcePage.url(), title: await sourcePage.title(), opened: true };
      } catch (error) {
        report.originalSource = { url: sourcePage.url(), opened: false, reason: error.message };
      }
      await sourcePage.close();
    }
    await route('pending-results', '.entry-state');
    await capture('pending-results');
    await page.locator('.entry-title').click();
    await page.locator('.pending-header').waitFor();
    assert.equal(await page.locator('.article-actions button').isDisabled(), true);
    assert.equal(await page.locator('.article-actions a[href="#export"]').count(), 0);
    await capture('pending');
    await route('export', '[data-note-preview]');
    await page.locator('[data-note-image]').evaluate((image) => image.decode());
    await capture('export-ready');
    const previewGeometry = () => page.locator('[data-note-preview]').evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x: x + scrollX, y: y + scrollY, width, height };
    });
    const ready = await previewGeometry();
    await page.locator('[data-toggle-state]').click();
    assert.equal(await page.locator('[data-note-image]').isVisible(), false);
    assert.equal(await page.locator('[data-save-hint]').isVisible(), false);
    assert.equal(await page.locator('[data-mock-save]').isDisabled(), true);
    assert.deepEqual(await previewGeometry(), ready);
    await capture('export-updating');
    await page.locator('[data-toggle-state]').click();
    assert.equal(await page.locator('[data-note-image]').isVisible(), true);
    await page.locator('[data-mock-save]').click();
    assert.equal(await page.locator('[data-save-feedback]').isVisible(), true);
    await page.locator('[data-open-settings]').click();
    assert.equal(await page.locator('[data-settings]').getAttribute('open'), '');
    assert.equal(await page.locator('[data-settings] input').isChecked(), false);
    await route('thanks', '[data-note-image][src="./thanks-note.png"]');
    await page.locator('[data-note-image]').evaluate((image) => image.decode());
    await capture('thanks-ready');
    await page.locator('[data-toggle-state]').click();
    assert.equal(await page.locator('[data-note-image]').isVisible(), false);
    await capture('thanks-updating');
    report.scenarios.push({ width, height, tier, captures, staticInteractions: 'passed; not a production download or native long-press test' });
    await context.close();
  }
  const luminance = (hex) => {
    const channels = hex.match(/[a-f0-9]{2}/gi).map((part) => parseInt(part, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  report.contrast = [['#293432', '#fafbf8'], ['#53635e', '#fafbf8'], ['#285d54', '#fafbf8'], ['#735226', '#f2eadb'], ['#53635e', '#eeefea']].map(([foreground, background]) => {
    const a = luminance(foreground);
    const b = luminance(background);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(ratio >= 4.5);
    return { foreground, background, ratio: Number(ratio.toFixed(2)) };
  });
  assert.deepEqual(report.errors, []);
  report.limitations = ['Explicit 18px/25px prototype font tiers, not real-device system font validation.', 'Static interactions and actual visual PNG assets; no production download-chain verification.', 'Production sources, rendering, gates, tests and documents unchanged.'];
  await writeFile(new URL('audit.json', root), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ scenarios: report.scenarios.length, screenshots: report.scenarios.reduce((sum, item) => sum + item.captures.length * 2, 0), pngs: report.pngs, originalSource: report.originalSource, errors: report.errors, contrast: report.contrast }, null, 2));
} finally {
  await browser.close();
}
