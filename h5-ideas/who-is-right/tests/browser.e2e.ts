import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { library } from '../src/content/library';
import { THANKS_TEMPLATES } from '../src/content/thanks';
import { fillSalutation } from '../src/card/layout';
import type { CardSpec } from '../src/card/render';
import { VERDICT_CARD_LABEL } from '../src/ui/dom';

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket('**', socket => socket.send(JSON.stringify({ type: 'connected' })));
});

async function expectImage(page: Page) {
  const image = page.locator('[data-card-img]');
  await expect(image).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1080);
  expect(await image.evaluate((img: HTMLImageElement) => img.naturalHeight)).toBe(page.url().includes('/thanks') ? 720 : 1440);
  await expect(image).toBeVisible();
  await expect(page.locator('[data-card-download]')).toHaveAttribute('aria-disabled', 'false');
  await expect(page.locator('[data-card-save-hint]')).toBeVisible();
}

async function setFont(page: Page, font: string) {
  await page.locator('.font-menu summary').click();
  await page.locator(`button[data-font="${font}"]`).click();
  await expect(page.locator('.font-menu')).not.toHaveAttribute('open', '');
}

async function openCardSettings(page: Page) {
  await page.locator('[data-card-settings] > summary').click();
}

async function expectNoOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    viewport: innerWidth,
    content: document.documentElement.scrollWidth,
    overflowing: Array.from(document.querySelectorAll<HTMLElement>('#app *')).filter((element) => {
      const rect = element.getBoundingClientRect();
      return element.checkVisibility() && rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
    }).map((element) => element.className),
  }));
  expect(sizes.viewport).toBe(page.viewportSize()!.width);
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
  expect(sizes.overflowing).toEqual([]);
}

async function holdDecodes(page: Page) {
  await page.evaluate(() => {
    let count = 0;
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () {
      await decode.call(this);
      const id = ++count;
      await new Promise<void>((resolve) => {
        document.addEventListener(`release-decode-${id}`, () => resolve(), { once: true });
        document.documentElement.dataset[`decodeUrl${id}`] = this.src;
        document.documentElement.dataset.decodeCount = String(id);
      });
    };
    const revoke = URL.revokeObjectURL;
    const revoked: string[] = [];
    URL.revokeObjectURL = (url) => {
      revoked.push(url);
      document.documentElement.dataset.revokedUrls = JSON.stringify(revoked);
      revoke(url);
    };
  });
}

async function expectPendingPreview(page: Page) {
  await expect(page.locator('[data-card-preview]')).toBeVisible();
  await expect(page.locator('[data-card-img]')).not.toBeVisible();
  await expect(page.locator('[data-card-img]')).not.toHaveAttribute('src');
  await expect(page.locator('[data-card-save-hint]')).not.toBeVisible();
  await expect(page.locator('[data-card-download]')).not.toHaveAttribute('href');
  await expect(page.locator('[data-card-original]')).not.toBeVisible();
  await expect(page.locator('[data-card-original]')).not.toHaveAttribute('href');
  await expect(page.locator('[data-card-download]')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('[data-export-state]')).toBeVisible();
  await expect(page.locator('[data-export-state]')).toHaveText('图片正在更新…');
}

async function expectPreviewPixels(page: Page, spec: CardSpec) {
  const matches = await page.evaluate(async (expected) => {
    const renderPath = '/src/card/render.ts';
    const { drawCard } = await import(renderPath);
    const canvas = document.createElement('canvas');
    drawCard(canvas, expected);
    const context = canvas.getContext('2d')!;
    const height = expected.sourceLine ? 1440 : 720;
    const expectedPixels = context.getImageData(0, 0, 1080, height).data;
    context.clearRect(0, 0, 1080, height);
    context.drawImage(document.querySelector<HTMLImageElement>('[data-card-img]')!, 0, 0);
    const actualPixels = context.getImageData(0, 0, 1080, height).data;
    return actualPixels.every((pixel, index) => pixel === expectedPixels[index]);
  }, spec);
  expect(matches).toBe(true);
}

test('窄屏搜索 → 结果 → 来源原文 → 下载真实 PNG', async ({ page }, info) => {
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:5219') && !request.url().startsWith('blob:')) {
      externalRequests.push(request.url());
    }
  });
  await page.goto('/');
  await expect(page.locator('.library-status')).toContainText('17');
  await page.getByRole('searchbox').fill('少放盐');
  await page.getByRole('button', { name: '查一查', exact: true }).click();
  await expect(page.locator('.item').first()).toHaveAttribute('href', '#/s/salt-less');
  await page.locator('.item').first().click();
  await expect(page.locator('h1')).toContainText('口味淡点');
  await page.locator('[data-sources] summary').click();
  await expect(page.locator('.source blockquote').first()).toContainText('成年人每天摄入食盐不超过5g');
  await expect(page.getByRole('link', { name: '打开原页面' }).first()).toHaveAttribute('href', /^https:\/\//);
  await expectNoOverflow(page);
  await page.getByRole('link', { name: '做一张大字卡' }).click();
  await expectImage(page);
  expect(await page.locator('input[name="brand"]').isChecked()).toBe(false);
  await openCardSettings(page);
  await page.locator('input[name="custom"]').fill('外婆奶奶');
  await expectImage(page);
  await page.screenshot({ path: info.outputPath('narrow-card-page.png'), fullPage: true });
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载图片', exact: true }).click();
  const download = await downloaded;
  const path = info.outputPath('exported-card.png');
  await download.saveAs(path);
  const png = await readFile(path);
  expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1440);
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('空结果不猜结论，并保留可选沟通卡', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill('打雷不能洗澡');
  await page.getByRole('button', { name: '查一查', exact: true }).click();
  await expect(page.locator('[data-empty]')).toContainText('库里还没有这句话');
  await expect(page.locator('.list .item')).toHaveCount(0);
  await page.locator('.thanks-entry').click();
    await expect(page.locator('[data-reply-text]')).toBeVisible();
    await page.locator('[data-reply-image]').click();
  await expectImage(page);
  await expect(page.locator('input[name="tpl"]:checked')).toHaveValue('plain');
  await openCardSettings(page);
  await page.getByLabel('暖一点', { exact: true }).check();
  await expectImage(page);
  await expectNoOverflow(page);
});

test('待核验禁止导出，直接访问卡片地址也不能绕过', async ({ page }) => {
  await page.goto('/#/s/fever-cover-sweat');
  await expect(page.locator('[data-pending]')).toContainText('具体来源原文尚未找到并核对');
  await expect(page.locator('[data-card-disabled]')).toBeDisabled();
  await expect(page.getByRole('heading', { name: '长辈对在哪', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-card-img]')).toHaveCount(0);
  await page.goto('/#/card/fever-cover-sweat');
  await expect(page.locator('[data-pending]')).toContainText('不能生成大字卡');
  await expect(page.locator('[data-card-download]')).toHaveCount(0);
});

test('分类准确、三档结论可读，特大字号下所有条目不横向溢出', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/cat/parenting');
  await expect(page.locator('.list .item')).toHaveCount(library.sayings.filter((s) => s.category === 'parenting').length);
  await setFont(page, 'xl');
  await expectNoOverflow(page);
  await page.getByRole('link', { name: '养生', exact: true }).click();
  await expect(page.locator('.list .item')).toHaveCount(library.sayings.filter((s) => s.category === 'health').length);
  await expectNoOverflow(page);
  for (const saying of library.sayings) {
    await page.goto(`/#/s/${saying.id}`);
    if (saying.status === 'pending') {
      await expect(page.locator('[data-pending]')).toBeVisible();
      await page.locator('[data-demo-content] > summary').click();
      await expect(page.locator('[data-demo-verdict]')).toContainText('未定论');
    } else {
      await expect(page.locator(`.verdict-${saying.verdict}`)).toBeVisible();
    }
    await page.locator('[data-sources] summary').click();
    await expectNoOverflow(page);
    if (saying.bigCard) {
      await page.getByRole('link', { name: '做一张大字卡' }).click();
      await openCardSettings(page);
      await page.locator('input[name="custom"]').fill('外婆奶奶');
      await expectImage(page);
      await expectNoOverflow(page);
    }
  }
  await page.goto('/#/thanks');
      await page.locator('[data-reply-image]').click();
  await openCardSettings(page);
  await page.locator('input[name="custom"]').fill('外婆奶奶');
  await expectImage(page);
  await expectNoOverflow(page);
  await page.goto('/#/search/打雷不能洗澡');
  await expect(page.locator('[data-empty]')).toBeVisible();
  await expectNoOverflow(page);
  await page.goto('/#/about');
  await expectNoOverflow(page);
  await page.goto('/#/s/leftovers');
  await page.locator('[data-sources] summary').click();
  await page.screenshot({ path: info.outputPath('extra-large-evidence.png'), fullPage: true });
  await page.reload();
  await expect(page.locator('button[data-font="xl"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-current-font]')).toHaveText('特大');
  expect(errors).toEqual([]);
});

test('真实中文字体下所有卡片文字都在画布内，正文与页脚不重叠', async ({ page }) => {
  await page.goto('/');
  const claimCards = library.sayings.filter((saying) => saying.bigCard).map((saying) => ({
    id: saying.id,
    lines: saying.bigCard!.lines.map((line) => line.replaceAll('{称呼}', '外婆奶奶')),
    sourceLine: saying.bigCard!.sourceLine,
    scopeNote: saying.scopeNote,
    checkedAt: saying.sources[0]?.checkedAt,
    record: String(library.sayings.indexOf(saying) + 1).padStart(2, '0'),
    primaryLine: ['toddler-self-feeding', 'toddler-less-salt', 'salt-less', 'egg-yolk', 'sit-less'].includes(saying.id) ? 2 : 1,
  }));
  const violations = await page.evaluate(async (cards) => {
    const renderPath = '/src/card/render.ts';
    const { drawCard } = await import(renderPath);
    const failures: string[] = [];
    for (const card of cards) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      const original = context.fillText.bind(context);
      context.fillText = (text, x, y) => {
        const width = context.measureText(text).width;
        const left = context.textAlign === 'right' ? x - width : x;
        const size = Number(context.font.match(/(\d+)px/)?.[1]);
        if (left < 0 || left + width > 1080 || y < 0 || y > 1440) failures.push(`${card.id}: ${text}`);
        if (context.textBaseline === 'top' && y < 1370 && y + size > 1348) failures.push(`${card.id}: 页脚重叠`);
        original(text, x, y);
      };
      drawCard(canvas, {
        lines: card.lines,
        label: '这件事现在有新建议',
        sourceLine: card.sourceLine,
        scopeNote: card.scopeNote,
        checkedAt: card.checkedAt,
        record: card.record,
        primaryLine: card.primaryLine,
        footer: '本地内测样卡，非医疗建议',
        brand: true,
      });
    }
    return failures;
  }, claimCards);
  expect(violations).toEqual([]);
});

for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }]) {
  for (const font of ['std', 'lg', 'xl']) {
    test(`返修验收 ${viewport.width}×${viewport.height} ${font}：状态优先、任务层级与真实保存`, async ({ page }, info) => {
      await page.setViewportSize(viewport);
      const errors: string[] = [];
      const consoleErrors: string[] = [];
      const externalRequests: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('request', (request) => {
        if (!request.url().startsWith('http://127.0.0.1:5219') && !request.url().startsWith('blob:')) {
          externalRequests.push(request.url());
        }
      });
      const metrics: object[] = [];
      const capture = async (route: string) => {
        await page.evaluate(() => scrollTo(0, 0));
        const layout = await page.evaluate(() => ({
          header: document.querySelector('.top')!.getBoundingClientRect().height,
          position: getComputedStyle(document.querySelector('.top')!).position,
          page: document.documentElement.scrollHeight,
          preview: document.querySelector('[data-card-img]')?.getBoundingClientRect().top ?? null,
          download: document.querySelector('[data-card-download]')?.getBoundingClientRect().top ?? null,
          fontPixels: getComputedStyle(document.documentElement).fontSize,
        }));
        metrics.push({ width: viewport.width, height: viewport.height, font, route, ...layout });
        expect(layout.header).toBeLessThanOrEqual(120);
        expect(layout.position).toBe('static');
        expect(layout.fontPixels).toBe(font === 'std' ? '18px' : font === 'lg' ? '21px' : '25px');
        if (layout.preview !== null) expect(layout.preview).toBeLessThanOrEqual(320);
        if (layout.download !== null) expect(layout.download).toBeLessThan(viewport.height);
        await expectNoOverflow(page);
        await page.screenshot({ path: info.outputPath(`${viewport.width}-${font}-${route}.png`), fullPage: true });
        await page.screenshot({ path: info.outputPath(`${viewport.width}-${font}-${route}-viewport.png`) });
      };

      await page.goto('/');
      await page.locator('.font-menu summary').click();
      await expectNoOverflow(page);
      expect(await page.locator('button[data-font]').evaluateAll((buttons) => buttons.every((button) => button.getBoundingClientRect().height >= 44))).toBe(true);
      await page.locator(`button[data-font="${font}"]`).click();
      await expect(page.locator('.font-menu')).not.toHaveAttribute('open', '');
      await expect(page.locator('.library-status')).toContainText('8 条原文已核对');
      await expect(page.locator('.library-status')).toContainText('9 条待核验');
      await expect(page.locator('[data-checked-list] .item')).toHaveCount(8);
      await expect(page.locator('[data-pending-library]')).not.toHaveAttribute('open', '');
      await expect(page.getByRole('searchbox')).toHaveAttribute('placeholder', /少吃盐/);
      await capture('home');
      await page.locator('[data-pending-library] > summary').click();
      await expectNoOverflow(page);
      await page.getByRole('searchbox').fill('   ');
      await page.getByRole('button', { name: '查一查', exact: true }).click();
      await expect(page.locator('[data-pending-library]')).not.toHaveAttribute('open', '');
      await expect(page.getByRole('searchbox')).toHaveValue('');
      await expect(page.locator('[data-checked-list] .item')).toHaveCount(8);

      await page.getByRole('searchbox').fill('少放盐');
      await page.getByRole('button', { name: '查一查', exact: true }).click();
      await expect(page.locator('.item').first()).toHaveAttribute('href', '#/s/salt-less');
      await page.locator('.item').first().click();
      await expect(page.locator('h1')).toContainText('口味淡点');
      await page.locator('[data-sources] summary').click();
      await expect(page.locator('.source blockquote').first()).toContainText('食盐不超过5g');
      await expectNoOverflow(page);
      await page.screenshot({ path: info.outputPath(`${viewport.width}-${font}-evidence.png`), fullPage: true });
      await page.getByRole('link', { name: '做一张大字卡' }).click();
      await expectImage(page);
      await capture('card');
      await openCardSettings(page);
      await page.locator('input[name="custom"]').fill('外婆奶奶');
      await page.locator('input[name="brand"]').check();
      await expectImage(page);
      await expect(page.locator('[data-card-selection]')).toContainText('外婆奶奶');
      await expectNoOverflow(page);
      await page.locator('[data-preview-jump]').click();
      await expect(page.locator('[data-card-settings]')).not.toHaveAttribute('open', '');
      await expect(page.locator('[data-card-img]')).toBeInViewport();
      const downloaded = page.waitForEvent('download');
      await page.getByRole('link', { name: '下载图片', exact: true }).click();
      const download = await downloaded;
      const pngPath = info.outputPath(`${viewport.width}-${font}-downloaded.png`);
      await download.saveAs(pngPath);
      const png = await readFile(pngPath);
      expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(png.readUInt32BE(16)).toBe(1080);
      expect(png.readUInt32BE(20)).toBe(1440);
      await page.goto('/#/thanks');
      await page.locator('[data-reply-image]').click();
      await expectImage(page);
      await capture('thanks');
      await openCardSettings(page);
      await page.getByLabel('商量着来', { exact: true }).check();
      await expectImage(page);
      await expectNoOverflow(page);
      await page.locator('[data-preview-jump]').click();
      const thanksDownloaded = page.waitForEvent('download');
      await page.getByRole('link', { name: '下载图片', exact: true }).click();
      const thanksDownload = await thanksDownloaded;
      const thanksPath = info.outputPath(`${viewport.width}-${font}-thanks-downloaded.png`);
      await thanksDownload.saveAs(thanksPath);
      const thanksPng = await readFile(thanksPath);
      expect(Array.from(thanksPng.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(thanksPng.readUInt32BE(16)).toBe(1080);
      expect(thanksPng.readUInt32BE(20)).toBe(720);
      await page.getByRole('link', { name: '返回', exact: true }).click();
      await expect(page.locator('[data-reply-text]')).toBeVisible();
      await page.getByRole('link', { name: '← 返回', exact: true }).click();
      await expect(page.locator('[data-checked-list] .item')).toHaveCount(8);

      await page.getByRole('searchbox').fill('打雷不能洗澡');
      await page.getByRole('button', { name: '查一查', exact: true }).click();
      await expect(page.locator('[data-empty]')).toBeVisible();
      await expect(page.locator('.list .item')).toHaveCount(0);
      await expectNoOverflow(page);
      await page.getByRole('searchbox').fill('发烧要捂汗');
      await page.getByRole('button', { name: '查一查', exact: true }).click();
      await expect(page.locator('.item').first()).toHaveAttribute('href', '#/s/fever-cover-sweat');
      const firstItem = page.locator('.item').first();
      await expect(firstItem.locator('.status-pending')).toBeVisible();
      await expect(firstItem).toContainText('不能作为医疗建议');
      await expect(firstItem.locator('[class*="verdict-"]')).toHaveCount(0);
      expect(await firstItem.evaluate((element) => {
        const state = element.querySelector('.status-pending')!;
        const title = element.querySelector('.item-title')!;
        return state.getBoundingClientRect().bottom <= title.getBoundingClientRect().top;
      })).toBe(true);
      await firstItem.click();
      await expect(page.locator('[data-pending]')).toContainText('不能作为医疗建议');
      expect(await page.evaluate(() => document.querySelector('[data-pending-state]')!.getBoundingClientRect().bottom <= document.querySelector('h1')!.getBoundingClientRect().top)).toBe(true);
      await expect(page.locator('[data-demo-content]')).not.toHaveAttribute('open', '');
      await capture('pending');
      for (const saying of library.sayings) {
        await page.goto(`/#/s/${saying.id}`);
        await page.locator('[data-sources] summary').click();
        await expectNoOverflow(page);
        if (saying.status === 'pending') {
          await expect(page.locator('[data-card-disabled]')).toBeDisabled();
          await expect(page.locator('[class*="verdict-"]')).toHaveCount(0);
          await page.locator('[data-demo-content] > summary').click();
          await expect(page.locator('[data-demo-verdict]')).toContainText('未定论');
          await expectNoOverflow(page);
          await page.goto(`/#/card/${saying.id}`);
          await expect(page.locator('[data-pending]')).toContainText('不能生成大字卡');
          await expect(page.locator('[data-card-download]')).toHaveCount(0);
        } else {
          await page.locator('.reasoning > summary').click();
          await expectNoOverflow(page);
          await page.getByRole('link', { name: '做一张大字卡' }).click();
          await expectImage(page);
          await expectNoOverflow(page);
        }
      }
      await page.goto('/#/about');
      await expectNoOverflow(page);
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/');
      await expectNoOverflow(page);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(250, 251, 248)');
      await page.screenshot({ path: info.outputPath(`${viewport.width}-${font}-dark-system.png`) });
      await writeFile(info.outputPath('metrics.json'), JSON.stringify(metrics, null, 2));
      expect(errors).toEqual([]);
      expect(consoleErrors).toEqual([]);
      expect(externalRequests).toEqual([]);
    });
  }
}

test('PNG 解码完成前禁止保存旧图，完成后开放当前图片', async ({ page }) => {
  await page.goto('/#/card/salt-less');
  await expectImage(page);
  const originalUrl = await page.locator('[data-card-img]').getAttribute('src');
  await page.evaluate(() => {
    const original = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () {
      await original.call(this);
      await new Promise<void>((resolve) => {
        document.addEventListener('release-preview', () => resolve(), { once: true });
        document.documentElement.dataset.previewWaiting = 'true';
      });
    };
  });
  await openCardSettings(page);
  await page.locator('input[name="brand"]').check();
  await expect(page.locator('html')).toHaveAttribute('data-preview-waiting', 'true');
  await expectPendingPreview(page);
  await page.evaluate(() => document.dispatchEvent(new Event('release-preview')));
  await expectImage(page);
  const nextUrl = await page.locator('[data-card-img]').getAttribute('src');
  expect(nextUrl).not.toBe(originalUrl);
  await expect(page.locator('[data-card-download]')).toHaveAttribute('href', nextUrl!);
});

test.describe('更新态预览一致性', () => {
  test.use({ isMobile: true, hasTouch: true });
  const saying = library.sayings.find((item) => item.id === 'salt-less')!;
  const template = THANKS_TEMPLATES.find((item) => item.id === 'discuss')!;
  const scenarios: { name: string; route: string; input: string; selection: string; spec: CardSpec }[] = [
    {
      name: '称呼', route: '/#/card/salt-less', input: 'input[name="sal"][value="爸"]', selection: '给爸',
      spec: {
        lines: saying.bigCard!.lines.map((line) => fillSalutation(line, '爸')),
        label: VERDICT_CARD_LABEL[saying.verdict], sourceLine: saying.bigCard!.sourceLine,
        scopeNote: saying.scopeNote, record: '04', primaryLine: 2, checkedAt: saying.sources[0]?.checkedAt,
        footer: '本地内测样卡，非医疗建议', brand: false,
      },
    },
    {
      name: '沟通模板', route: '/#/thanks', input: 'input[name="tpl"][value="discuss"]', selection: '给妈 · 商量着来',
      spec: { lines: template.lines.map((line) => fillSalutation(line, '妈')), footer: '本地内测样卡', brand: false },
    },
  ];
  for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }]) {
    for (const scenario of scenarios) {
      test(`${viewport.width}×${viewport.height} 特大 ${scenario.name}：更新态无旧图，占位稳定`, async ({ page }, info) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.setViewportSize(viewport);
        await page.goto(scenario.route);
        if (scenario.route.includes('/thanks')) await page.locator('[data-reply-image]').click();
        await setFont(page, 'xl');
        await expectImage(page);
        const originalUrl = await page.locator('[data-card-img]').getAttribute('src');
        const preview = page.locator('[data-card-preview]');
        await page.evaluate(() => scrollTo(0, 0));
        const originalSlot = await preview.boundingBox();
        await holdDecodes(page);
        await openCardSettings(page);
        await page.locator(scenario.input).check();
        await expect(page.locator('html')).toHaveAttribute('data-decode-count', '1');
        const decodedUrl = await page.locator('html').getAttribute('data-decode-url1');
        await page.locator('[data-preview-jump]').click();
        await page.evaluate(() => scrollTo(0, 0));
        await expect(page.locator('[data-card-selection]')).toHaveText(scenario.selection);
        await expectPendingPreview(page);
        const pendingSlot = await preview.boundingBox();
        expect(pendingSlot).toEqual(originalSlot);
        expect(pendingSlot!.height / pendingSlot!.width).toBeCloseTo(scenario.spec.sourceLine ? 4 / 3 : 2 / 3, 2);
        expect(await preview.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.tagName;
        })).not.toBe('IMG');
        await expectNoOverflow(page);
        await page.screenshot({ path: info.outputPath(`${viewport.width}-${scenario.name}-pending-viewport.png`) });
        await page.screenshot({ path: info.outputPath(`${viewport.width}-${scenario.name}-pending.png`), fullPage: true });
        await page.evaluate(() => document.dispatchEvent(new Event('release-decode-1')));
        await expectImage(page);
        await expect(page.locator('[data-card-selection]')).toHaveText(scenario.selection);
        await expect(page.locator('[data-card-img]')).toHaveAttribute('src', decodedUrl!);
        await expect(page.locator('[data-card-download]')).toHaveAttribute('href', decodedUrl!);
        expect(decodedUrl).not.toBe(originalUrl);
        await expect(page.locator('[data-export-state]')).not.toBeVisible();
        expect(await preview.boundingBox()).toEqual(originalSlot);
        await expectPreviewPixels(page, scenario.spec);
        await expectNoOverflow(page);
        await page.screenshot({ path: info.outputPath(`${viewport.width}-${scenario.name}-ready-viewport.png`) });
        await page.screenshot({ path: info.outputPath(`${viewport.width}-${scenario.name}-ready.png`), fullPage: true });
        const downloaded = page.waitForEvent('download');
        await page.getByRole('link', { name: '下载图片', exact: true }).click();
        const download = await downloaded;
        const path = info.outputPath(`${viewport.width}-${scenario.name}-downloaded.png`);
        await download.saveAs(path);
        const png = await readFile(path);
        expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
        expect(png.readUInt32BE(16)).toBe(1080);
        expect(png.readUInt32BE(20)).toBe(scenario.spec.sourceLine ? 1440 : 720);
        await writeFile(info.outputPath('metrics.json'), JSON.stringify({
          viewport, font: 'xl', scenario: scenario.name, originalSlot, pendingSlot,
          readySlot: await preview.boundingBox(), decodedUrl, selection: scenario.selection,
          controlledDecodeDelay: true, nativeLongPressTested: false,
        }, null, 2));
        expect(errors).toEqual([]);
      });
    }
  }

  test('乱序解码不恢复旧图或旧保存入口，过期 URL 被释放', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/#/card/salt-less');
    await expectImage(page);
    const originalUrl = await page.locator('[data-card-img]').getAttribute('src');
    await holdDecodes(page);
    await openCardSettings(page);
    await page.locator('input[name="sal"][value="爸"]').check();
    await expect(page.locator('html')).toHaveAttribute('data-decode-count', '1');
    const staleUrl = await page.locator('html').getAttribute('data-decode-url1');
    await page.locator('input[name="sal"][value="奶奶"]').check();
    await expect(page.locator('html')).toHaveAttribute('data-decode-count', '2');
    const currentUrl = await page.locator('html').getAttribute('data-decode-url2');
    await expectPendingPreview(page);
    await page.evaluate(() => document.dispatchEvent(new Event('release-decode-2')));
    await expectImage(page);
    await expect(page.locator('[data-card-selection]')).toHaveText('给奶奶');
    await expect(page.locator('[data-card-img]')).toHaveAttribute('src', currentUrl!);
    await expect(page.locator('[data-card-download]')).toHaveAttribute('href', currentUrl!);
    await page.evaluate(() => document.dispatchEvent(new Event('release-decode-1')));
    await expect.poll(async () => JSON.parse(await page.locator('html').getAttribute('data-revoked-urls') ?? '[]')).toContain(staleUrl);
    await expectImage(page);
    await expect(page.locator('[data-card-img]')).toHaveAttribute('src', currentUrl!);
    await expect(page.locator('[data-card-download]')).toHaveAttribute('href', currentUrl!);
    expect(JSON.parse(await page.locator('html').getAttribute('data-revoked-urls') ?? '[]')).toContain(originalUrl);
    expect(errors).toEqual([]);
  });

  test('跨路由解码不恢复离开的预览，已用及过期 URL 均释放', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/#/card/salt-less');
    await expectImage(page);
    const originalUrl = await page.locator('[data-card-img]').getAttribute('src');
    await holdDecodes(page);
    await openCardSettings(page);
    await page.locator('input[name="sal"][value="爸"]').check();
    await expect(page.locator('html')).toHaveAttribute('data-decode-count', '1');
    const staleUrl = await page.locator('html').getAttribute('data-decode-url1');
    await page.getByRole('link', { name: '返回', exact: true }).click();
    await expect(page.locator('h1')).toContainText('口味淡点');
    await page.locator('.thanks-entry').click();
    await expect(page.locator('[data-reply-text]')).toBeVisible();
    await page.locator('[data-reply-image]').click();
    await expect(page.locator('html')).toHaveAttribute('data-decode-count', '2');
    const currentUrl = await page.locator('html').getAttribute('data-decode-url2');
    await expectPendingPreview(page);
    await page.evaluate(() => document.dispatchEvent(new Event('release-decode-1')));
    await expect.poll(async () => JSON.parse(await page.locator('html').getAttribute('data-revoked-urls') ?? '[]')).toContain(staleUrl);
    await expectPendingPreview(page);
    await expect(page.locator('[data-card-selection]')).toHaveText('给妈 · 简单一句');
    await page.evaluate(() => document.dispatchEvent(new Event('release-decode-2')));
    await expectImage(page);
    await expect(page.locator('[data-card-img]')).toHaveAttribute('src', currentUrl!);
    await expect(page.locator('[data-card-download]')).toHaveAttribute('href', currentUrl!);
    expect(JSON.parse(await page.locator('html').getAttribute('data-revoked-urls') ?? '[]')).toContain(originalUrl);
    expect(errors).toEqual([]);
  });
});

test('修改称呼、品牌、来回切换卡片后图片正常更新，畸形 hash 不崩溃', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/card/salt-less');
  await expectImage(page);
  const image = page.locator('[data-card-img]');
  const originalUrl = await image.getAttribute('src');
  await openCardSettings(page);
  await page.locator('input[name="custom"]').fill('外婆奶奶');
  await expect.poll(() => image.getAttribute('src')).not.toBe(originalUrl);
  await expectImage(page);
  const beforeBrand = await image.getAttribute('src');
  await page.locator('input[name="brand"]').check();
  await expect.poll(() => image.getAttribute('src')).not.toBe(beforeBrand);
  await page.getByRole('link', { name: '返回', exact: false }).click();
  await page.locator('.thanks-entry').click();
    await expect(page.locator('[data-reply-text]')).toBeVisible();
    await page.locator('[data-reply-image]').click();
  await openCardSettings(page);
  await page.getByLabel('商量着来', { exact: true }).check();
  await expectImage(page);
  await page.goto('/#/%E0%A4%A');
  await expect(page.locator('.list .item')).toHaveCount(17);
  expect(errors).toEqual([]);
});
