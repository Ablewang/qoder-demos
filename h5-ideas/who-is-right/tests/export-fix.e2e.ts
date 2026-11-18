import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { library } from '../src/content/library';
import { THANKS_TEMPLATES } from '../src/content/thanks';

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket('**', socket => socket.send(JSON.stringify({ type: 'connected' })));
});

async function ready(page: Page, height: number) {
  const image = page.locator('[data-card-img]');
  await expect(image).toBeVisible();
  await expect(page.locator('[data-card-download]')).toHaveAttribute('aria-disabled', 'false');
  expect(await image.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1080, height]);
  const url = await image.getAttribute('src');
  await expect(page.locator('[data-card-download]')).toHaveAttribute('href', url!);
  await expect(page.locator('[data-card-original]')).toHaveAttribute('href', url!);
}

test('实际剩菜 PNG 有冷藏前提、热透与菜类时限，不依赖网页原文', async ({ page }, info) => {
  await page.addInitScript(() => {
    const batches: { text: string; font: string; x: number; y: number; width: number }[][] = [];
    Object.assign(window, { cardTextBatches: batches });
    const fill = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
      if (x === 0 && y === 0 && width === 1080 && height === 1440) batches.push([]);
      fill.call(this, x, y, width, height);
    };
    const text = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (value, x, y, ...args) {
      batches.at(-1)?.push({ text: value, font: this.font, x, y, width: this.measureText(value).width });
      text.call(this, value, x, y, ...args);
    };
  });
  await page.goto('/#/card/leftovers');
  await ready(page, 1440);
  await page.locator('[data-card-settings] > summary').click();
  await page.locator('input[name="custom"]').fill('合成外婆');
  await expect(page.locator('[data-card-img]')).toHaveAttribute('alt', /^合成外婆/);
  await ready(page, 1440);
  const drawn = await page.evaluate(() => (window as unknown as { cardTextBatches: { text: string; font: string; x: number; y: number; width: number }[][] }).cardTextBatches.at(-1)!);
  const text = drawn.map(line => line.text).join('');
  expect(text).toContain('趁热分装，尽快冷藏');
  expect(text).toContain('吃前要热透');
  expect(text).toContain('冷藏后也限一两天');
  expect(text).toContain('只适用于尽快冷藏、妥善储存的剩菜，不含常温放置');
  expect(text).toContain('绿叶菜、海鲜水产、豆制品不要剩');
  expect(text).toContain('菌菇、薯类、肉类、米饭冷藏也限1～2天');
  expect(text).not.toMatch(/见下方|详见|见原文/);
  expect(text).toContain('原文核对 2026-11-17');
  for (const line of drawn) {
    const size = Number(line.font.match(/(\d+)px/)?.[1]);
    expect(line.y + size).toBeLessThanOrEqual(1440);
    if (line.y < 1370) expect(line.y + size).toBeLessThanOrEqual(1348);
  }
  const scopeLabel = drawn.findIndex(line => line.text === '适用条件');
  const sourceLabel = drawn.findIndex(line => line.text === '出处');
  for (const line of drawn.slice(scopeLabel + 1, sourceLabel)) expect(line.font).toContain('56px');
  await writeFile(info.outputPath('leftovers-drawn-text.json'), JSON.stringify(drawn, null, 2));
});

for (const width of [320, 390]) {
  test(`${width} 四模板四字称呼：真实短 PNG、预览与下载一致、设置可关闭`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 320 ? 740 : 844 });
    await page.goto('/#/thanks');
    await page.locator('[data-reply-image]').click();
    await ready(page, 720);
    await expect(page.locator('.bitmap-note')).toContainText('1080 × 720');
    expect(await page.locator('input[name="brand"]').isChecked()).toBe(false);
    await page.locator('[data-card-settings] > summary').click();
    await page.locator('input[name="custom"]').fill('合成外婆');
    await expect(page.locator('[data-card-img]')).toHaveAttribute('alt', /^合成外婆/);
    const observations = [];
    for (const template of THANKS_TEMPLATES) {
      await page.locator(`input[name="tpl"][value="${template.id}"]`).check();
      const expectedText = template.lines.map(line => line.replaceAll('{称呼}', '合成外婆'));
      await expect(page.locator('[data-card-img]')).toHaveAttribute('alt', [...expectedText, '本地内测样卡'].join('；'));
      await ready(page, 720);
      const rect = await page.locator('[data-card-preview]').boundingBox();
      expect(rect!.height / rect!.width).toBeCloseTo(2 / 3, 2);
      const downloadEvent = page.waitForEvent('download');
      await page.locator('[data-card-download]').click();
      const download = await downloadEvent;
      const path = info.outputPath(`actual-thanks-${template.id}.png`);
      await download.saveAs(path);
      const bytes = await readFile(path);
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1080, 720]);
      const preview = await page.locator('[data-card-img]').evaluate(async (img: HTMLImageElement) => Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer())));
      expect(hash(bytes)).toBe(hash(Buffer.from(preview)));
      observations.push({ template: template.id, dimensions: [1080, 720], previewDownloadSHA256: hash(bytes), rect });
    }
    await page.locator('input[name="brand"]').check();
    await ready(page, 720);
    await page.locator('[data-preview-jump]').click();
    await expect(page.locator('[data-card-settings]')).not.toHaveAttribute('open', '');
    await expect(page.locator('[data-card-img]')).toBeInViewport();
    await writeFile(info.outputPath('communication-dimensions-hashes.json'), JSON.stringify(observations, null, 2));
  });
}

test('另外七张查证 PNG 与上轮实际图逐像素一致', async ({ page }, info) => {
  const records = [];
  for (const saying of library.sayings.filter(s => s.bigCard && s.id !== 'leftovers')) {
    await page.goto(`/#/card/${saying.id}`);
    await ready(page, 1440);
    await page.locator('[data-card-settings] > summary').click();
    await page.locator('input[name="custom"]').fill('外婆奶奶');
    await expect(page.locator('[data-card-img]')).toHaveAttribute('alt', /^外婆奶奶/);
    await ready(page, 1440);
    const before = await readFile(new URL(`../test-results/fullsite-20261118/delivery/actual-${saying.id}.png`, import.meta.url));
    const match = await page.evaluate(async base64 => {
      const old = new Image();
      old.src = `data:image/png;base64,${base64}`;
      await old.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1080; canvas.height = 1440;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(old, 0, 0);
      const expected = ctx.getImageData(0, 0, 1080, 1440).data;
      ctx.clearRect(0, 0, 1080, 1440);
      ctx.drawImage(document.querySelector<HTMLImageElement>('[data-card-img]')!, 0, 0);
      const actual = ctx.getImageData(0, 0, 1080, 1440).data;
      return actual.every((pixel, i) => pixel === expected[i]);
    }, before.toString('base64'));
    expect(match, saying.id).toBe(true);
    records.push({ id: saying.id, identicalPixels: match, previousPNG: hash(before) });
  }
  await writeFile(info.outputPath('seven-claim-pixel-regression.json'), JSON.stringify(records, null, 2));
});

test('延迟 blob 乱序与跨尺寸导航不恢复过期图或保存链接', async ({ page }) => {
  await page.goto('/#/thanks');
    await page.locator('[data-reply-image]').click();
  await ready(page, 720);
  await page.evaluate(() => {
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    let count = 0;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      toBlob.call(this, blob => {
        const id = ++count;
        document.addEventListener(`release-blob-${id}`, () => callback(blob), { once: true });
        document.documentElement.dataset.blobCount = String(id);
      }, ...args);
    };
    const revoke = URL.revokeObjectURL;
    const revoked: string[] = [];
    URL.revokeObjectURL = url => {
      revoked.push(url);
      document.documentElement.dataset.blobRevoked = JSON.stringify(revoked);
      revoke(url);
    };
  });
  const old = await page.locator('[data-card-img]').getAttribute('src');
  await page.locator('[data-card-settings] > summary').click();
  await page.locator('input[name="tpl"][value="discuss"]').check();
  await expect(page.locator('html')).toHaveAttribute('data-blob-count', '1');
  await page.locator('input[name="tpl"][value="warm"]').check();
  await expect(page.locator('html')).toHaveAttribute('data-blob-count', '2');
  await expect(page.locator('[data-card-img]')).not.toHaveAttribute('src');
  await expect(page.locator('[data-card-download]')).not.toHaveAttribute('href');
  await expect(page.locator('[data-card-original]')).not.toHaveAttribute('href');
  await page.evaluate(() => document.dispatchEvent(new Event('release-blob-2')));
  await ready(page, 720);
  const current = await page.locator('[data-card-img]').getAttribute('src');
  await page.evaluate(() => document.dispatchEvent(new Event('release-blob-1')));
  await expect(page.locator('[data-card-img]')).toHaveAttribute('src', current!);
  await expect(page.locator('[data-card-download]')).toHaveAttribute('href', current!);
  expect(JSON.parse(await page.locator('html').getAttribute('data-blob-revoked') ?? '[]')).toContain(old);
  await page.locator('input[name="tpl"][value="remind"]').check();
  await expect(page.locator('html')).toHaveAttribute('data-blob-count', '3');
  await page.evaluate(() => { location.hash = '#/card/leftovers'; });
  await expect(page.locator('.bitmap-note')).toContainText('1080 × 1440');
  await expect(page.locator('html')).toHaveAttribute('data-blob-count', '4');
  await page.evaluate(() => document.dispatchEvent(new Event('release-blob-3')));
  await expect(page.locator('[data-card-img]')).not.toHaveAttribute('src');
  await expect(page.locator('[data-card-download]')).not.toHaveAttribute('href');
  await expect(page.locator('[data-card-original]')).not.toHaveAttribute('href');
  await page.evaluate(() => document.dispatchEvent(new Event('release-blob-4')));
  await ready(page, 1440);
  await expect(page.locator('[data-card-img]')).toHaveAttribute('alt', /尽快冷藏/);
  expect(JSON.parse(await page.locator('html').getAttribute('data-blob-revoked') ?? '[]')).toContain(current);
});
