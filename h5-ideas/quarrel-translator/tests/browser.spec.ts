import { test, expect } from '@playwright/test';
import { demos } from '../src/demos.js';
import { safetyCategories, safetyContent, toneLabels, tones, translationSchema, type Tone } from '../src/contract.js';
import { demoNotice, hiddenOriginalNotice, humorNotice, shareTextWidth } from '../src/share.js';
import { startLocalServer, type LocalServer } from '../server/index.js';
import { resolve } from 'node:path';

let local: LocalServer;
test.beforeAll(async () => { local = await startLocalServer({ root: resolve(import.meta.dirname, '..'), production: true, initialPort: 0, env: {} }); });
test.afterAll(async () => { await local?.close(); });
const evidence = (name: string) => test.info().outputPath(name);

test('mobile home, empty/long input, selection, honest missing-AI failure and plain-text safety', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(local.url);
  await expect(page.locator('#ai-status')).toContainText('AI 未配置');
  await expect(page.locator('#message')).toBeHidden();
  await expect(page.locator('.demo-button').first()).toBeVisible();
  await page.locator('#safety-check summary').click();
  await expect(page.locator('#translate')).toContainText('不生成改写');
  await expect(page.locator('#translate')).toBeDisabled();
  await expect(page.locator('#relations input')).toHaveCount(5);
  await page.locator('#message').fill('字'.repeat(301));
  await expect(page.locator('#char-count')).toHaveText('301 / 300');
  await expect(page.locator('#translate')).toBeDisabled();
  await expect(page.locator('#message-error')).toContainText('最多 300 字');
  const literal = '<img src=x onerror="window.__xss=true">你总是不听我的意见！';
  await page.locator('#message').fill(literal);
  await page.getByRole('radio', { name: '同事', exact: true }).check();
  const sent = page.waitForRequest((request) => request.url().endsWith('/api/assist'));
  await page.locator('#translate').click();
  expect((await sent).postDataJSON()).toEqual({ version: 1, mode: 'soften', relation: 'colleague', text: literal });
  await expect(page.locator('#message-error')).toContainText('AI 未配置');
  await expect(page.locator('#message')).toHaveValue(literal);
  await expect(page.locator('#result')).toBeHidden();
  expect(await page.evaluate(() => Reflect.get(window, '__xss'))).toBeUndefined();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: evidence('mobile-home.png'), fullPage: true });
});

test('fixed sample, all tones, actual clipboard, hidden original and PNG export', async ({ page }) => {
  let modelRequests = 0;
  page.on('request', (request) => { if (request.url().endsWith('/api/assist')) modelRequests++; });
  await page.addInitScript(() => {
    Reflect.set(window, '__drawn', []);
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
      (Reflect.get(window, '__drawn') as string[]).push(text);
      if (maxWidth === undefined) original.call(this, text, x, y); else original.call(this, text, x, y, maxWidth);
    };
  });
  await page.goto(local.url);
  await page.getByRole('button', { name: '伴侣 · 等不到回复 查看演示' }).click();
  await expect(page.locator('#source-banner')).toContainText('固定演示 · 非实时 AI');
  await expect(page.locator('.heard-text')).toContainText('可能');
  await expect(page.locator('.meaning-tile')).toHaveCount(4);
  await page.getByRole('tab', { name: '坚定', exact: true }).click();
  await expect(page.locator('#rewrite-text')).toHaveText(demos[0]!.result.rewrites.firm);
  await page.getByRole('tab', { name: '幽默', exact: true }).click();
  await expect(page.locator('#rewrite-text')).toHaveText(demos[0]!.result.rewrites.humor);
  await page.getByRole('tab', { name: '温和', exact: true }).click();
  await page.getByRole('button', { name: '复制这句，自己决定发不发' }).click();
  await expect(page.getByRole('button', { name: '已复制 · 去真实的对话里说吧' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(demos[0]!.result.rewrites.gentle);
  await page.getByRole('tab', { name: '坚定', exact: true }).click();
  await expect(page.getByRole('button', { name: '复制这句，自己决定发不发' })).toBeVisible();
  await page.getByRole('button', { name: '复制这句，自己决定发不发' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(demos[0]!.result.rewrites.firm);
  await page.screenshot({ path: evidence('mobile-result.png'), fullPage: true });
  await page.getByRole('button', { name: '生成可说句分享卡' }).click();
  await expect(page.locator('#hide-original')).toBeChecked();
  await expect(page.locator('#share-image')).toHaveJSProperty('complete', true);
  const size = () => page.locator('#share-image').evaluate((image: HTMLImageElement) => ({ width: image.naturalWidth, height: image.naturalHeight }));
  const hidden = await size();
  expect(hidden.width).toBe(1080);
  const drawn = await page.evaluate(() => Reflect.get(window, '__drawn') as string[]);
  expect(drawn).toContain('原话已隐藏 · 不在卡片中展示');
  expect(drawn).toContain('固定演示 · 非实时 AI 结果');
  expect(drawn).toContain('换个说法 · 坚定版');
  expect(drawn).not.toContain('我本来想说');
  expect(drawn.join('')).not.toContain(demos[0]!.original);
  expect(drawn.join('')).not.toContain(demos[0]!.result.heard_as);
  for (const value of Object.values(demos[0]!.result.real_meaning)) expect(drawn.join('')).not.toContain(value);
  await page.screenshot({ path: evidence('mobile-share.png'), fullPage: true });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载 PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('吵架翻译器-固定演示-坚定-可说句.png');
  await download.saveAs(evidence('demo-card-hidden.png'));
  const png = await import('node:fs/promises').then((fs) => fs.readFile(evidence('demo-card-hidden.png')));
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([hidden.width, hidden.height]);
  await page.evaluate(() => Reflect.set(window, '__drawn', []));
  await page.locator('#hide-original').uncheck();
  expect((await page.evaluate(() => Reflect.get(window, '__drawn') as string[])).join('')).toContain(demos[0]!.original);
  await expect(page.locator('#share-image')).toHaveJSProperty('complete', true);
  const shown = await size();
  expect(shown.height).toBeGreaterThan(hidden.height);
  const shownDownload = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载 PNG' }).click();
  await (await shownDownload).saveAs(evidence('demo-card-shown.png'));
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.locator('#share-dialog')).not.toBeVisible();
  await expect(page.locator('#share-image')).not.toHaveAttribute('src');
  expect(modelRequests).toBe(0);
});

test('checking and offline capability never invite input; demos and emergency resources remain reachable', async ({ page }) => {
  let status: import('@playwright/test').Route | undefined;
  let assists = 0;
  page.on('request', (request) => { if (request.url().endsWith('/api/assist')) assists++; });
  await page.route('**/api/status', (route) => { status = route; });
  await page.goto(local.url);
  await expect(page.locator('#ai-status')).toContainText('正在检查');
  await expect(page.locator('#message')).toBeHidden();
  await expect(page.locator('#local-tools a[href="tel:110"]')).toBeVisible();
  await expect(page.locator('#local-tools a[href="tel:120"]')).toBeVisible();
  await status?.abort('internetdisconnected');
  await expect(page.locator('#ai-status')).toContainText('无法确认 AI 能力');
  await expect(page.locator('#safety-check')).toBeHidden();
  await expect(page.locator('#message')).toBeHidden();
  await page.screenshot({ path: evidence('offline-capability.png'), fullPage: true });
  await page.locator('.demo-button').first().click();
  await expect(page.locator('#source-banner')).toContainText('固定演示');
  expect(assists).toBe(0);
});

test('copy denial exposes selectable manual copy rather than false success', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true });
    document.execCommand = () => false;
  });
  await page.goto(local.url);
  await page.getByRole('button', { name: '父母 · 被反复催婚 查看演示' }).click();
  await page.getByRole('button', { name: '复制这句，自己决定发不发' }).click();
  await expect(page.locator('.manual-copy')).toHaveValue(demos[1]!.result.rewrites.gentle);
  await expect(page.locator('#toast')).toContainText('自动复制不可用');
  await expect(page.getByRole('button', { name: '已复制 · 去真实的对话里说吧' })).toHaveCount(0);
});

test('a second denied copy clears the previous success label', async ({ page }) => {
  await page.addInitScript(() => {
    let calls = 0;
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => ++calls === 1 ? Promise.resolve() : Promise.reject(new Error('denied')) }, configurable: true });
    document.execCommand = () => false;
  });
  await page.goto(local.url);
  await page.getByRole('button', { name: '伴侣 · 等不到回复 查看演示' }).click();
  await page.getByRole('button', { name: '复制这句，自己决定发不发' }).click();
  await page.getByRole('button', { name: '已复制 · 去真实的对话里说吧' }).click();
  await expect(page.locator('.manual-copy')).toHaveValue(demos[0]!.result.rewrites.gentle);
  await expect(page.getByRole('button', { name: '复制这句，自己决定发不发' })).toBeVisible();
  await expect(page.getByRole('button', { name: '已复制 · 去真实的对话里说吧' })).toHaveCount(0);
});

type Page = import('@playwright/test').Page;
// Each clipboard write stays pending until the test settles it, so stale settlements can be reproduced deterministically.
async function delayedClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: { text: string; resolve: () => void; reject: (error: Error) => void }[] = [];
    Reflect.set(window, '__clipCalls', calls);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (text: string) => new Promise<void>((resolve, reject) => { calls.push({ text, resolve, reject }); }) }, configurable: true });
    document.execCommand = () => false;
  });
}
async function settle(page: Page, index: number, ok: boolean): Promise<void> {
  await page.evaluate(([i, success]) => {
    const call = (Reflect.get(window, '__clipCalls') as { resolve: () => void; reject: (error: Error) => void }[])[i as number]!;
    if (success) call.resolve(); else call.reject(new Error('denied'));
    return new Promise((done) => setTimeout(done, 80));
  }, [index, ok]);
}
const clipTexts = (page: Page) => page.evaluate(() => (Reflect.get(window, '__clipCalls') as { text: string }[]).map((call) => call.text));
// The toast auto-hides after 3s, so a retrying toBeHidden() would wait a stale toast out; check the instant state instead.
const toastHiddenNow = (page: Page) => page.locator('#toast').evaluate((node) => (node as HTMLElement).hidden);
async function expectNoCopyFeedback(page: Page): Promise<void> {
  expect(await toastHiddenNow(page)).toBe(true);
  expect(await page.getByRole('button', { name: '已复制 · 去真实的对话里说吧' }).count()).toBe(0);
  expect(await page.locator('.manual-copy').count()).toBe(0);
}

test('delayed copy success after a tone switch gives no stale feedback; the new copy still succeeds', async ({ page }) => {
  await delayedClipboard(page);
  await page.goto(local.url);
  await page.getByRole('button', { name: '伴侣 · 等不到回复 查看演示' }).click();
  await page.getByRole('button', { name: '复制这句，自己决定发不发' }).click();
  await page.getByRole('tab', { name: '坚定' }).click();
  await settle(page, 0, true);
  await expectNoCopyFeedback(page);
  await expect(page.locator('#rewrite-text')).toHaveText(demos[0]!.result.rewrites.firm);
  await expect(page.getByRole('button', { name: '复制这句，自己决定发不发' })).toBeVisible();
  expect(await clipTexts(page)).toEqual([demos[0]!.result.rewrites.gentle]);
  await page.getByRole('button', { name: '复制这句，自己决定发不发' }).click();
  await settle(page, 1, true);
  await expect(page.getByRole('button', { name: '已复制 · 去真实的对话里说吧' })).toBeVisible();
  await expect(page.locator('#toast')).toContainText('已复制');
  expect(await clipTexts(page)).toEqual([demos[0]!.result.rewrites.gentle, demos[0]!.result.rewrites.firm]);
});

test('delayed copy rejection after a tone switch inserts no stale manual box or focus steal; new denial still offers manual copy', async ({ page }) => {
  await delayedClipboard(page);
  await page.goto(local.url);
  await page.getByRole('button', { name: '伴侣 · 等不到回复 查看演示' }).click();
  await page.getByRole('button', { name: '复制这句，自己决定发不发' }).click();
  await page.getByRole('tab', { name: '坚定' }).click();
  await settle(page, 0, false);
  await expectNoCopyFeedback(page);
  await expect(page.getByRole('tab', { name: '坚定' })).toBeFocused();
  await page.getByRole('button', { name: '复制这句，自己决定发不发' }).click();
  await settle(page, 1, false);
  await expect(page.locator('.manual-copy')).toHaveValue(demos[0]!.result.rewrites.firm);
  await expect(page.locator('.manual-copy')).toBeFocused();
  await expect(page.locator('#toast')).toContainText('自动复制不可用');
});

test('delayed copy settling after returning home or opening another demo stays silent', async ({ page }) => {
  await delayedClipboard(page);
  await page.goto(local.url);
  await page.getByRole('button', { name: '伴侣 · 等不到回复 查看演示' }).click();
  await page.getByRole('button', { name: '复制这句，自己决定发不发' }).click();
  await page.getByRole('button', { name: '← 修改原话' }).click();
  await settle(page, 0, true);
  await expect(page.locator('#home')).toBeVisible();
  expect(await toastHiddenNow(page)).toBe(true);

  await page.getByRole('button', { name: '伴侣 · 等不到回复 查看演示' }).click();
  await page.getByRole('button', { name: '复制这句，自己决定发不发' }).click();
  await page.getByRole('button', { name: '← 修改原话' }).click();
  await page.getByRole('button', { name: '父母 · 被反复催婚 查看演示' }).click();
  await settle(page, 1, true);
  await expectNoCopyFeedback(page);
  await page.getByRole('button', { name: '← 修改原话' }).click();
  await page.getByRole('button', { name: '伴侣 · 等不到回复 查看演示' }).click();
  await page.getByRole('button', { name: '复制这句，自己决定发不发' }).click();
  await page.getByRole('button', { name: '再翻一句' }).click();
  await page.getByRole('button', { name: '父母 · 被反复催婚 查看演示' }).click();
  await settle(page, 2, false);
  await expectNoCopyFeedback(page);
  await expect(page.locator('#rewrite-text')).toHaveText(demos[1]!.result.rewrites.gentle);
});

test('an older copy settling late cannot override a newer copy on the same tone', async ({ page }) => {
  await delayedClipboard(page);
  await page.goto(local.url);
  await page.getByRole('button', { name: '伴侣 · 等不到回复 查看演示' }).click();
  const copy = page.getByRole('button', { name: '复制这句，自己决定发不发' });
  await copy.click();
  await copy.click();
  await settle(page, 1, true);
  await expect(page.getByRole('button', { name: '已复制 · 去真实的对话里说吧' })).toBeVisible();
  await settle(page, 0, false);
  await expect(page.locator('.manual-copy')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '已复制 · 去真实的对话里说吧' })).toBeVisible();
  await page.getByRole('button', { name: '已复制 · 去真实的对话里说吧' }).click();
  await page.getByRole('button', { name: '复制这句，自己决定发不发' }).click();
  await settle(page, 3, false);
  await expect(page.locator('.manual-copy')).toHaveValue(demos[0]!.result.rewrites.gentle);
  await settle(page, 2, true);
  await expect(page.locator('.manual-copy')).toHaveValue(demos[0]!.result.rewrites.gentle);
  await expect(page.getByRole('button', { name: '已复制 · 去真实的对话里说吧' })).toHaveCount(0);
});

test('loading can be cancelled; synthetic network failure preserves input without substituting demo', async ({ page }) => {
  await page.route('**/api/status', (route) => route.fulfill({ json: { configured: true } }));
  await page.goto(local.url);
  let pending: import('@playwright/test').Route | undefined;
  await page.route('**/api/assist', (route) => { pending = route; });
  await page.locator('#message').fill('这件事我想认真聊一聊。');
  await page.locator('#translate').click();
  await expect(page.locator('#loading')).toBeVisible();
  await page.getByRole('button', { name: '取消，回去修改' }).click();
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#message')).toHaveValue('这件事我想认真聊一聊。');
  await pending?.abort().catch(() => {});
  await page.unroute('**/api/assist');
  await page.route('**/api/assist', (route) => route.abort('internetdisconnected'));
  await page.locator('#translate').click();
  await expect(page.locator('#message-error')).toContainText('网络中断');
  await expect(page.locator('#result')).toBeHidden();
  await expect(page.locator('#message')).toHaveValue('这件事我想认真聊一聊。');
});

test('real local safety protects violence boundary without rewriting or AI', async ({ page }) => {
  await page.goto(local.url);
  await expect(page.locator('#safety-check')).toBeVisible();
  await page.locator('#safety-check summary').click();
  await page.locator('#message').fill('如果你再打我，我就报警');
  await page.locator('#translate').click();
  await expect(page.locator('.safety-panel')).toContainText('明确的边界没有错');
  await expect(page.locator('#source-banner')).toContainText('没有调用 AI');
  await expect(page.locator('.tone-tabs')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '生成可说句分享卡' })).toHaveCount(0);
  await page.screenshot({ path: evidence('mobile-safety.png'), fullPage: true });
});

test('synthetic transport response renders untrusted model text without executing HTML', async ({ page }) => {
  await page.route('**/api/status', (route) => route.fulfill({ json: { configured: true } }));
  const markup = '<img src=x onerror="window.__modelXss=true">';
  await page.route('**/api/assist', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ version: 1, mode: 'soften', source: 'model', result: { ...demos[0]!.result,
      heard_as: `对方可能误会这段标记：${markup}`,
      rewrites: { gentle: markup, firm: '请认真听完我的需求。', humor: '我的话也想排队发言。' },
    } }),
  }));
  await page.goto(local.url);
  await page.locator('#message').fill(markup);
  await page.locator('#translate').click();
  await expect(page.locator('#rewrite-text')).toHaveText(markup);
  await expect(page.locator('#result-content img')).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, '__modelXss'))).toBeUndefined();
  await expect(page.locator('.original')).toContainText(markup);
});

test('longest allowed content exports a reflowed card without truncation or overflow', async ({ page }) => {
  await page.route('**/api/status', (route) => route.fulfill({ json: { configured: true } }));
  await page.addInitScript(() => {
    Reflect.set(window, '__lines', []);
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y) {
      const right = this.textAlign === 'right' ? x : x + this.measureText(text).width;
      (Reflect.get(window, '__lines') as { text: string; right: number; y: number; height: number }[]).push({ text, right, y, height: this.canvas.height });
      original.call(this, text, x, y);
    };
  });
  const original = `${'这件事我已经说了很多遍，'.repeat(20)}\nhttps://example.com/${'a'.repeat(50)}`.slice(0, 300);
  const heard = `对方可能听成：${'你一直在指责我，'.repeat(14)}`.slice(0, 120);
  const firm = `${'我需要我们把这件事说清楚，'.repeat(13)}`.slice(0, 160);
  await page.route('**/api/assist', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ version: 1, mode: 'soften', source: 'model', result: { ...demos[2]!.result, heard_as: heard, rewrites: { ...demos[2]!.result.rewrites, firm } } }),
  }));
  await page.goto(local.url);
  await page.locator('#message').fill(original);
  await page.setViewportSize({ width: 320, height: 740 });
  await expect.poll(() => page.locator('#message').evaluate((node) => node.scrollHeight <= node.clientHeight + 2)).toBe(true);
  await page.locator('#translate').click();
  await expect(page.locator('#source-banner')).toContainText('AI 辅助结果');
  await page.getByRole('tab', { name: '坚定', exact: true }).click();
  await page.getByRole('button', { name: '生成可说句分享卡' }).click();
  await expect(page.locator('#share-image')).toHaveJSProperty('complete', true);
  const hiddenHeight = await page.locator('#share-image').evaluate((image: HTMLImageElement) => image.naturalHeight);
  await page.evaluate(() => Reflect.set(window, '__lines', []));
  await page.locator('#hide-original').uncheck();
  await expect(page.locator('#share-image')).toHaveJSProperty('complete', true);
  const lines = await page.evaluate(() => Reflect.get(window, '__lines') as { text: string; right: number; y: number; height: number }[]);
  const joined = lines.map((line) => line.text).join('');
  expect(joined).toContain(original.replace('\n', ''));
  expect(joined).not.toContain(heard);
  expect(joined).toContain(firm);
  for (const line of lines) {
    expect(line.right, line.text).toBeLessThanOrEqual(1004);
    expect(line.y).toBeLessThan(line.height - 30);
  }
  expect(lines[0]!.height).toBeGreaterThan(hiddenHeight);
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载 PNG' }).click();
  expect((await download).suggestedFilename()).toBe('吵架翻译器-AI辅助-坚定-原话对照.png');
  await (await download).saveAs(evidence('long-card-shown.png'));
});

const layouts = [320, 390, 1280].flatMap((width) => [1, 1.3].map((scale) => ({ name: `${width}-${scale}`, width, height: width === 320 ? 740 : width === 390 ? 844 : 800, scale })));
async function simulateTextSize(page: Page, scale: number): Promise<void> {
  await page.evaluate((factor) => {
    const elements = [...document.querySelectorAll<HTMLElement>('body *')];
    for (const node of elements) if (node.dataset.fontSimulation) node.style.removeProperty('font-size');
    const sizes = elements.map((node) => parseFloat(getComputedStyle(node).fontSize));
    elements.forEach((node, index) => { node.style.fontSize = `${sizes[index]! * factor}px`; node.dataset.fontSimulation = 'true'; });
  }, scale);
}
async function checkTouchAndOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const small = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('button,a,summary,.relation-choice,.hide-control')].filter((node) => {
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && (rect.width < 43.9 || rect.height < 43.9);
  }).map((node) => ({ text: node.textContent, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  expect(small).toEqual([]);
}

test('task hierarchy: demos lead without AI, all analysis folds, 44px controls and three viewports at 130% text', async ({ browser }) => {
  test.setTimeout(120_000);
  const report: Record<string, unknown> = {};
  for (const layout of layouts) {
    const context = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, deviceScaleFactor: 2, isMobile: layout.width < 800, hasTouch: layout.width < 800 });
    try {
      const page = await context.newPage();
      await page.goto(local.url); await expect(page.locator('#ai-status')).toContainText('AI 未配置');
      if (layout.scale !== 1) await simulateTextSize(page, layout.scale);
      const box = async (selector: string) => page.locator(selector).first().evaluate((node) => { const r = node.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY }; });
      await expect(page.locator('#message')).toBeHidden(); await expect(page.locator('#safety-check')).not.toHaveAttribute('open', '');
      const status = await box('#ai-status'); const demo = await box('.demo-button');
      expect(status.bottom).toBeLessThanOrEqual(demo.top); expect(demo.top).toBeLessThan(layout.height);
      await checkTouchAndOverflow(page);
      await page.screenshot({ path: evidence(`home-${layout.name}.png`), fullPage: true });
      await page.locator('#jump-demos').click(); await expect(page.locator('.demo-button').first()).toBeFocused();
      await page.locator('.demo-button').first().click();
      if (layout.scale !== 1) await simulateTextSize(page, layout.scale);
      await expect(page.locator('.meaning-details')).not.toHaveAttribute('open', ''); await expect(page.locator('.heard')).not.toHaveAttribute('open', '');
      await expect(page.locator('.meaning-tile')).toHaveCount(4); await expect(page.locator('.meaning-tile p').first()).toBeHidden();
      await expect(page.locator('.annotation-heading')).toContainText('全是推测'); await expect(page.locator('.humor-hint')).toBeHidden();
      const banner = await box('#source-banner'); const rewrite = await box('#rewrite-text'); const copy = await box('.rewrite-block .button.primary');
      expect(banner.bottom).toBeLessThanOrEqual(rewrite.top);
      if (layout.width < 800) expect(copy.bottom).toBeLessThanOrEqual((await box('.annotation-column')).top);
      await checkTouchAndOverflow(page);
      await page.screenshot({ path: evidence(`result-${layout.name}.png`), fullPage: true });
      await page.getByRole('tab', { name: '幽默', exact: true }).click(); await expect(page.locator('.humor-hint')).toHaveText(humorNotice);
      await page.getByRole('tab', { name: '坚定', exact: true }).click(); await expect(page.locator('.humor-hint')).toBeHidden();
      await page.locator('.meaning-details summary').click();
      for (const value of Object.values(demos[0]!.result.real_meaning)) await expect(page.locator('.meaning-details')).toContainText(value);
      await page.locator('.heard summary').click(); await expect(page.locator('.heard-text')).toHaveText(demos[0]!.result.heard_as);
      await page.getByRole('button', { name: '生成可说句分享卡' }).click();
      await checkTouchAndOverflow(page); await expect(page.locator('#hide-original')).toBeChecked();
      await page.screenshot({ path: evidence(`share-${layout.name}.png`) });
      await page.locator('#download-card').focus(); await page.keyboard.press('Tab'); await expect(page.locator('#close-share')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: '生成可说句分享卡' })).toBeFocused();
      await page.locator('#back').click(); await page.locator('#safety-check summary').click();
      await checkTouchAndOverflow(page); await expect(page.locator('#translate')).toContainText('不生成改写');
      await page.screenshot({ path: evidence(`local-check-${layout.name}.png`), fullPage: true });
      await page.route('**/api/status', (route) => route.fulfill({ json: { configured: true } }));
      await page.goto(local.url); await expect(page.locator('#ai-status')).toContainText('AI 已配置');
      if (layout.scale !== 1) await simulateTextSize(page, layout.scale);
      await expect(page.locator('#message')).toBeVisible(); await expect(page.locator('#safety-check')).toBeHidden();
      await page.locator('#message').fill('合成输入：请先核对安排。'); await expect(page.locator('#translate')).toBeEnabled();
      await checkTouchAndOverflow(page); await page.screenshot({ path: evidence(`configured-fixture-${layout.name}.png`), fullPage: true });
      report[layout.name] = { status, demo, banner, rewrite, copy, textSimulation: layout.scale };
    } finally { await context.close(); }
  }
  await import('node:fs/promises').then((fs) => fs.writeFile(evidence('positions.json'), JSON.stringify(report, null, 1)));
});

test('five demos and desktop layout remain functional', async ({ page }) => {
  await page.goto(local.url);
  for (const demo of demos) {
    await page.getByRole('button', { name: `${demo.title} 查看演示` }).click();
    await expect(page.locator('#rewrite-text')).toHaveText(demo.result.rewrites.gentle);
    await page.getByRole('button', { name: '← 修改原话' }).click();
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: evidence('desktop-home.png'), fullPage: true });
});

test('six safety states retain full production messages, regional limits and no rewriting actions', async ({ page }) => {
  for (const category of safetyCategories) {
    await page.route('**/api/assist', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 1, mode: 'soften', source: 'local_safety', result: { kind: 'safety', category } }) }));
    await page.goto(local.url);
    await expect(page.locator('#safety-check')).toBeVisible(); await page.locator('#safety-check summary').click();
    await page.locator('#message').fill('这是合成的安全界面测试，不是真实聊天。');
    await page.locator('#translate').click();
    await expect(page.locator('.safety-panel > p')).toHaveText(safetyContent[category].message);
    await expect(page.locator('.safety-panel h2')).toHaveText(safetyContent[category].title);
    await expect(page.locator('#source-banner')).toContainText('本地安全提醒');
    await expect(page.locator('.tone-tabs')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '生成可说句分享卡' })).toHaveCount(0);
    const links = page.locator('.safety-panel .help-links');
    if (category === 'manipulation') await expect(links).toHaveCount(0);
    else {
      await expect(links).toContainText('中国大陆 · 即时危险请联系 110 / 120；其他地区请联系当地服务。');
      await expect(links).toContainText('非紧急热线的服务时段和地区覆盖可能不同。');
      for (const phone of ['110', '120', '12356', '12338']) await expect(links.locator(`a[href="tel:${phone}"]`)).toHaveCount(1);
    }
    await page.screenshot({ path: evidence(`safety-${category}.png`), fullPage: true });
    await page.unroute('**/api/assist');
  }
});

test('share generation failure clears prior resources, supports retry and preserves dialog focus', async ({ page }) => {
  await page.goto(local.url);
  await page.locator('.demo-button').first().click();
  const share = page.getByRole('button', { name: '生成可说句分享卡' });
  await share.click();
  await expect(page.getByRole('button', { name: '关闭', exact: true })).toBeFocused();
  await page.locator('#download-card').focus(); await page.keyboard.press('Tab');
  await expect(page.locator('#close-share')).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(page.locator('#download-card')).toBeFocused();
  await page.evaluate(() => {
    const prototype = HTMLCanvasElement.prototype;
    const original = prototype.toDataURL;
    let failures = 0;
    prototype.toDataURL = function(...args) {
      if (++failures <= 2) throw new Error('synthetic export failure');
      prototype.toDataURL = original; return original.apply(this, args);
    };
  });
  await page.locator('#hide-original').uncheck();
  await expect(page.locator('#share-error')).toContainText('无法生成图片');
  await expect(page.locator('#share-image')).not.toHaveAttribute('src');
  await expect(page.locator('#download-card')).not.toHaveAttribute('href');
  await expect(page.locator('#download-card')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#share-save-hint')).toBeHidden();
  await page.screenshot({ path: evidence('share-failure.png') });
  await page.getByRole('button', { name: '重新生成图片' }).click();
  await expect(page.locator('#share-error')).toBeVisible();
  await expect(page.locator('#share-image')).not.toHaveAttribute('src');
  await expect(page.locator('#download-card')).not.toHaveAttribute('href');
  await expect(page.locator('#share-save-hint')).toBeHidden();
  await page.locator('#retry-share').focus(); await page.keyboard.press('Tab'); await expect(page.locator('#close-share')).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(page.locator('#retry-share')).toBeFocused();
  await page.screenshot({ path: evidence('share-second-failure.png') });
  await page.getByRole('button', { name: '重新生成图片' }).click();
  await expect(page.locator('#share-image')).toHaveJSProperty('complete', true);
  await expect(page.locator('#share-save-hint')).toBeVisible();
  await expect(page.locator('#close-share')).toBeFocused();
  await expect(page.locator('#share-contents')).toContainText('包含完整原话');
  await page.locator('#hide-original').check();
  await expect(page.locator('#share-contents')).toContainText('不包含原话');
  await page.keyboard.press('Escape');
  await expect(share).toBeFocused();
  await expect(page.locator('#share-image')).not.toHaveAttribute('src');
  await expect(page.locator('#download-card')).not.toHaveAttribute('href');
});

test('opening share invalidates pending copy feedback and tabs work from the keyboard', async ({ page }) => {
  await delayedClipboard(page);
  await page.goto(local.url);
  await page.locator('.demo-button').first().click();
  await page.getByRole('tab', { name: '温和', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '坚定', exact: true })).toBeFocused();
  await expect(page.locator('#rewrite-text')).toHaveText(demos[0]!.result.rewrites.firm);
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: '幽默', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: '温和', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '复制这句，自己决定发不发' }).click();
  await page.getByRole('button', { name: '生成可说句分享卡' }).click();
  await settle(page, 0, false);
  await expectNoCopyFeedback(page);
  await expect(page.getByRole('button', { name: '关闭', exact: true })).toBeFocused();
});

test('successful legacy clipboard fallback restores keyboard focus', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } });
    document.execCommand = () => true;
  });
  await page.goto(local.url);
  await page.locator('.demo-button').first().click();
  await page.getByRole('button', { name: '复制这句，自己决定发不发' }).click();
  await expect(page.getByRole('button', { name: '已复制 · 去真实的对话里说吧' })).toBeFocused();
  await expect(page.locator('.manual-copy')).toHaveCount(0);
});

test('late image decode failure cannot clear a newer preview; current failure clears resources', async ({ page }) => {
  await page.addInitScript(() => {
    const prototype = HTMLImageElement.prototype;
    Reflect.set(window, '__originalDecode', prototype.decode);
    const rejectors: ((error: Error) => void)[] = []; Reflect.set(window, '__decodeRejectors', rejectors);
    prototype.decode = () => new Promise<void>((_resolve, reject) => { rejectors.push(reject); });
  });
  await page.goto(local.url);
  await page.locator('.demo-button').first().click();
  await page.getByRole('button', { name: '生成可说句分享卡' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '生成可说句分享卡' }).click();
  await page.evaluate(() => (Reflect.get(window, '__decodeRejectors') as ((error: Error) => void)[])[0]!(new Error('old failure')));
  await expect(page.locator('#download-card')).toHaveAttribute('href', /^data:image\/png;base64,/);
  expect(await page.locator('#share-error').evaluate((node) => (node as HTMLElement).hidden)).toBe(true);
  await page.evaluate(() => (Reflect.get(window, '__decodeRejectors') as ((error: Error) => void)[])[1]!(new Error('current failure')));
  await expect(page.locator('#share-error')).toBeVisible();
  await expect(page.locator('#download-card')).not.toHaveAttribute('href');
  await expect(page.locator('#share-image')).not.toHaveAttribute('src');
  await page.evaluate(() => { HTMLImageElement.prototype.decode = Reflect.get(window, '__originalDecode'); });
  await page.locator('#retry-share').click();
  await expect(page.locator('#share-image')).toHaveJSProperty('complete', true);
  await expect(page.locator('#download-card')).toHaveAttribute('href', /^data:image\/png;base64,/);
});

test('all shareable demos and maximum synthetic content export complete punctuation-safe PNGs at three viewports', async ({ browser }) => {
  test.setTimeout(180_000);
  const { readFile, writeFile, readdir } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const root = resolve(import.meta.dirname, '..');
  const patch = resolve(test.info().project.outputDir, '..');
  const oldEvidence = async (directory: string): Promise<Record<string, string>> => {
    const hashes: Record<string, string> = {};
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (path === patch || path === test.info().outputDir) continue;
      if (entry.isDirectory()) Object.assign(hashes, await oldEvidence(path));
      else if (entry.isFile()) hashes[path] = createHash('sha256').update(await readFile(path)).digest('hex');
    }
    return hashes;
  };
  const before = await oldEvidence(resolve(root, 'test-artifacts'));
  const entries: unknown[] = [];
  const errors: string[] = []; const external: string[] = [];
  const maximumText = (prefix: string, body: string, limit: number) => prefix + [...body.repeat(limit)].slice(0, limit - [...prefix].length - 1).join('') + '。';
  const synthetic = {
    ...demos[2]!,
    original: maximumText('“这是合成原话（不是现实聊天）。”👩🏽‍💻\n\n', '我希望先核对安排，保留完整说明；不要替我补充事实！', 300),
    result: {
      ...demos[2]!.result, risk: 'caution' as const,
      heard_as: maximumText('对方可能听成：“你在否定我（只是推测）。”\n', '这只是一种可能的理解，并不代表对方真实的想法。', 120),
      note: maximumText('合成提醒：“保留拒绝的空间（不要绕过边界）。”\n', '不要用幽默替代明确同意；这些提醒需要完整保留，不能删掉限定。', 120),
      rewrites: Object.fromEntries(tones.map((tone) => [tone, maximumText("dogs' '甲甲甲甲甲甲甲甲甲甲'乙。“先核对安排（合成测试）。”😀\n", `${toneLabels[tone]}：请保留我的边界，也给对方拒绝的空间；我们只讨论已确认的内容。`, 160)])) as Record<Tone, string>,
    },
  };
  translationSchema.parse(synthetic.result);
  expect([...synthetic.original]).toHaveLength(300);
  expect([...synthetic.result.heard_as]).toHaveLength(120);
  expect([...synthetic.result.note]).toHaveLength(120);
  for (const rewrite of Object.values(synthetic.result.rewrites)) expect([...rewrite]).toHaveLength(160);
  for (const { width, scale } of layouts) {
    const suffix = scale === 1 ? `${width}` : `${width}-text130`;
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 740 : width === 390 ? 844 : 800 }, deviceScaleFactor: 2, isMobile: width < 800, hasTouch: width < 800, permissions: ['clipboard-read', 'clipboard-write'] });
    try {
      await context.route('**/*', (route) => {
        if (new URL(route.request().url()).hostname !== '127.0.0.1') { external.push(route.request().url()); return route.abort(); }
        return route.continue();
      });
      await context.addInitScript(() => {
        Reflect.set(window, '__pngDraws', []);
        const original = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
          (Reflect.get(window, '__pngDraws') as unknown[]).push({ text, x, y, font: this.font, width: this.measureText(text).width, maxWidth: maxWidth ?? null });
          if (maxWidth === undefined) original.call(this, text, x, y); else original.call(this, text, x, y, maxWidth);
        };
      });
      const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
      const checkPNG = async (item: typeof demos[number], tone: Tone, hideOriginal: boolean, demo: boolean, name: string) => {
        await page.locator('#share-image').evaluate((image: HTMLImageElement) => image.decode());
        const draws = await page.evaluate(() => Reflect.get(window, '__pngDraws') as { text: string; x: number; y: number; font: string; width: number; maxWidth: number | null }[]);
        const blocks = [
          { text: '吵架翻译器 / 改措辞，不改立场', size: 44 },
          { text: demo ? demoNotice : 'AI 辅助表达 · 请核对后再使用', size: 48 },
          ...(item.result.risk === 'caution' ? [{ text: `风险提醒：${item.result.note}`, size: 48 }] : []),
          { text: `换个说法 · ${toneLabels[tone]}版`, size: 44 },
          { text: item.result.rewrites[tone], size: 72 },
          ...(tone === 'humor' ? [{ text: humorNotice, size: 48 }] : []),
          ...(hideOriginal ? [{ text: hiddenOriginalNotice, size: 48 }] : [{ text: '我本来想说', size: 44 }, { text: item.original, size: 52 }]),
          { text: '仅供表达参考 · 不作事实判断', size: 48 },
          { text: '分享前检查整张卡片的敏感信息', size: 44 },
        ];
        let index = 0;
        for (const block of blocks) {
          for (const paragraph of block.text.split('\n')) {
            let text = '';
            do {
              const draw = draws[index++]!;
              expect(draw, name).toBeDefined();
              expect(Number(draw.font.match(/(\d+)px/)![1]), name).toBe(block.size);
              expect(draw.width, `${name}: ${draw.text}`).toBeLessThanOrEqual(shareTextWidth + .01);
              expect(draw.x).toBe(76); expect(draw.maxWidth).toBeNull();
              expect(draw.text, name).not.toMatch(/^[。，、；：！？…％）］｝】〕〉》」』〗〙〛’”,.;:!?%\)\]\}]/u);
              expect(draw.text, name).not.toMatch(/[（［｛【〔〈《「『〖〘〚“‘\(\[\{]$/u);
              text += draw.text;
              expect(paragraph.startsWith(text), `${name}: paragraph integrity`).toBe(true);
              if (paragraph.startsWith("dogs' '") && text.length < paragraph.length) {
                expect(text.length, `${name}: opening straight quote`).not.toBe(7);
                expect(text.length, `${name}: closing straight quote`).not.toBe(paragraph.indexOf("'", 7));
              }
            } while (text.length < paragraph.length);
            expect(text, name).toBe(paragraph);
          }
        }
        expect(index, name).toBe(draws.length);
        const painted = draws.map((draw) => draw.text).join('');
        expect(painted, name).not.toContain(item.result.heard_as.replaceAll('\n', ''));
        for (const value of Object.values(item.result.real_meaning)) expect(painted, name).not.toContain(value);
        await expect(page.locator('#share-contents')).toContainText('不包含心理或对方理解推测');
        await expect(page.locator('#share-image')).toHaveAttribute('alt', /不含心理推测/);
        const preview = await page.locator('#share-image').getAttribute('src');
        expect(preview).toMatch(/^data:image\/png;base64,/);
        const download = page.waitForEvent('download'); await page.locator('#download-card').click();
        const downloaded = await download;
        expect(downloaded.suggestedFilename()).toBe(`吵架翻译器-${demo ? '固定演示' : 'AI辅助'}-${toneLabels[tone]}-${hideOriginal ? '可说句' : '原话对照'}.png`);
        const path = evidence(`${name}.png`); await downloaded.saveAs(path);
        const bytes = await readFile(path);
        expect(bytes.equals(Buffer.from(preview!.split(',')[1]!, 'base64')), name).toBe(true);
        expect(bytes.readUInt32BE(16)).toBe(1080);
        const height = bytes.readUInt32BE(20);
        expect(Math.max(...draws.map((draw) => draw.y))).toBeLessThan(height - 40);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        entries.push({ name, viewport: width, textScale: scale, demo, tone, hideOriginal, width: 1080, height, bytes: bytes.length, png: path, paragraphs: blocks.map((block) => block.text), draws });
        if ((demo && item === demos[0] && tone !== 'humor') || (!demo && tone === 'firm')) await page.screenshot({ path: evidence(`preview-${name}.png`) });
        return height;
      };
      for (const [index, item] of demos.entries()) {
        await page.goto(local.url); await page.locator('.demo-button').nth(index).click();
        if (scale !== 1) await simulateTextSize(page, scale);
        for (const tone of tones) {
          await page.getByRole('tab', { name: toneLabels[tone], exact: true }).click();
          await page.evaluate(() => Reflect.set(window, '__pngDraws', []));
          await page.getByRole('button', { name: '生成可说句分享卡' }).click(); await expect(page.locator('#hide-original')).toBeChecked();
          const hiddenHeight = await checkPNG(item, tone, true, true, `demo-${index + 1}-${tone}-hidden-${suffix}`);
          await page.evaluate(() => Reflect.set(window, '__pngDraws', [])); await page.locator('#hide-original').uncheck();
          const shownHeight = await checkPNG(item, tone, false, true, `demo-${index + 1}-${tone}-shown-${suffix}`);
          expect(shownHeight).toBeGreaterThan(hiddenHeight);
          await page.keyboard.press('Escape'); await expect(page.locator('#share-image')).not.toHaveAttribute('src'); await expect(page.locator('#download-card')).not.toHaveAttribute('href');
        }
      }
      await page.route('**/api/status', (route) => route.fulfill({ json: { configured: true } }));
      await page.route('**/api/assist', (route) => route.fulfill({ json: { version: 1, mode: 'soften', source: 'model', result: synthetic.result } }));
      await page.goto(local.url); await expect(page.locator('#ai-status')).toContainText('AI 已配置');
      if (scale !== 1) await simulateTextSize(page, scale);
      await page.getByRole('radio', { name: '同事', exact: true }).check(); await page.locator('#message').fill(synthetic.original);
      expect(await page.locator('#message').evaluate((node) => node.scrollHeight <= node.clientHeight + 2)).toBe(true);
      await checkTouchAndOverflow(page); await page.screenshot({ path: evidence(`long-input-${suffix}.png`), fullPage: true });
      await page.locator('#translate').click(); await expect(page.locator('#source-banner')).toContainText('AI 辅助结果');
      if (scale !== 1) await simulateTextSize(page, scale);
      await checkTouchAndOverflow(page); await page.screenshot({ path: evidence(`long-result-${suffix}.png`), fullPage: true });
      for (const tone of tones) {
        await page.getByRole('tab', { name: toneLabels[tone], exact: true }).click();
        await page.evaluate(() => Reflect.set(window, '__pngDraws', [])); await page.getByRole('button', { name: '生成可说句分享卡' }).click();
        const hiddenHeight = await checkPNG(synthetic, tone, true, false, `long-${tone}-hidden-${suffix}`);
        await page.evaluate(() => Reflect.set(window, '__pngDraws', [])); await page.locator('#hide-original').uncheck();
        const shownHeight = await checkPNG(synthetic, tone, false, false, `long-${tone}-shown-${suffix}`);
        expect(shownHeight).toBeGreaterThan(hiddenHeight); await page.keyboard.press('Escape');
      }
    } finally { await context.close(); }
  }
  expect(entries).toHaveLength(216); expect(errors).toEqual([]); expect(external).toEqual([]);
  expect(await oldEvidence(resolve(root, 'test-artifacts'))).toEqual(before);
  await writeFile(evidence('punctuation-matrix.json'), JSON.stringify({ complete: true, browser: browser.version(), data: '固定演示及合成内容；未调用真实AI', errors, external, oldEvidenceFilesUnchanged: Object.keys(before).length, exports: entries }, null, 2));
});
