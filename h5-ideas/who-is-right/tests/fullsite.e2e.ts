import { test, expect } from '@playwright/test';
import { library } from '../src/content/library';
import { THANKS_TEMPLATES } from '../src/content/thanks';

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket('**', socket => socket.send(JSON.stringify({ type: 'connected' })));
});

for (const route of ['/#/card/salt-less', '/#/thanks']) {
for (const failure of ['blob', 'decode']) {
  test(`${route} ${failure} 失败撤掉旧图与保存入口，重试只恢复新图`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(route);
    if (route.includes('/thanks')) await page.locator('[data-reply-image]').click();
    await expect(page.locator('[data-card-download]')).toHaveAttribute('href', /^blob:/);
    const old = await page.locator('[data-card-img]').getAttribute('src');
    await page.evaluate((mode) => {
      if (mode === 'blob') {
        const original = HTMLCanvasElement.prototype.toBlob;
        let fail = true;
        HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
          if (fail) { fail = false; callback(null); }
          else original.call(this, callback, ...args);
        };
      } else {
        const original = HTMLImageElement.prototype.decode;
        let fail = true;
        HTMLImageElement.prototype.decode = function () {
          if (fail) { fail = false; return Promise.reject(new Error('controlled decode failure')); }
          return original.call(this);
        };
      }
    }, failure);
    await page.locator('[data-card-settings] > summary').click();
    await page.locator('input[name="brand"]').check();
    await expect(page.locator('[data-export-state]')).toContainText('尚不能保存');
    await expect(page.locator('[data-card-img]')).not.toBeVisible();
    await expect(page.locator('[data-card-img]')).not.toHaveAttribute('src');
    await expect(page.locator('[data-card-download]')).not.toHaveAttribute('href');
    await expect(page.locator('[data-card-original]')).not.toHaveAttribute('href');
    await expect(page.locator('[data-card-original]')).not.toBeVisible();
    await expect(page.locator('[data-card-save-hint]')).not.toBeVisible();
    await page.screenshot({ path: info.outputPath(`${failure}-failure.png`), fullPage: true });
    await page.locator('[data-export-retry]').click();
    await expect(page.locator('[data-card-download]')).toHaveAttribute('href', /^blob:/);
    await expect(page.locator('[data-card-img]')).toBeVisible();
    await expect(page.locator('[data-card-img]')).not.toHaveAttribute('src', old!);
    await expect(page.locator('[data-export-retry]')).not.toBeVisible();
    expect(errors).toEqual([]);
  });
}
}

test('所有 17 条默认与展开状态、修改页、附页都有真实 44px 触区', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.locator('.font-menu summary').click();
  await page.locator('button[data-font="xl"]').click();
  const check = async () => {
    const defects = await page.evaluate(() => {
      const controls = [...document.querySelectorAll<HTMLElement>('a,button,summary,input,label')].filter(el => {
        if (!el.checkVisibility() || el.matches('.skip-link,.sr-only,[disabled],[aria-disabled="true"]')) return false;
        const closed = el.closest('details:not([open])');
        if (closed && !(el.matches('summary') && el.parentElement === closed)) return false;
        if (el.matches('input[type="radio"],input[type="checkbox"]') && el.closest('label')) return false;
        return true;
      });
      return controls.filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44 || rect.left < -1 || rect.right > innerWidth + 1;
      }).map(el => `${el.tagName} ${el.textContent?.slice(0, 50)}`);
    });
    expect(defects).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  };
  await check();
  await page.locator('[data-pending-library] > summary').click();
  await check();
  for (const saying of library.sayings) {
    await page.goto(`/#/s/${saying.id}`);
    await check();
    await page.locator('[data-sources] > summary').click();
    await page.locator(saying.status === 'pending' ? '[data-demo-content] > summary' : '.reasoning > summary').click();
    await check();
    if (saying.bigCard) {
      await page.getByRole('link', { name: '做一张大字卡', exact: true }).click();
      await expect(page.locator('[data-card-download]')).toHaveAttribute('href', /^blob:/);
      await check();
      await page.locator('[data-card-settings] > summary').click();
      await check();
      await page.locator('.card-context > summary').click();
      await check();
    }
  }
  for (const route of ['/#/thanks', '/#/about', '/#/search/没有这句话']) {
    await page.goto(route);
    if (route.includes('thanks')) {
      await check();
      await page.locator('[data-reply-image]').click();
      await expect(page.locator('[data-card-download]')).toHaveAttribute('href', /^blob:/);
      await page.locator('[data-card-settings] > summary').click();
    }
    await check();
  }
});

test('键盘搜索与来源展开，目录编号跨分类和详情保持一致', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#view')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('searchbox')).toBeFocused();
  await page.keyboard.type('少放盐');
  await page.keyboard.press('Enter');
  await expect(page.locator('.item').first()).toHaveAttribute('href', '#/s/salt-less');
  await expect(page.locator('.entry-number').first()).toHaveText('04');
  await page.locator('.item').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.record-id').first()).toContainText('条目 04');
  await expect(page.locator('#view')).toBeFocused();
  await page.locator('[data-sources] > summary').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('[data-sources]')).toHaveAttribute('open', '');
  await page.keyboard.press('Space');
  await expect(page.locator('[data-sources]')).not.toHaveAttribute('open', '');
  await page.goto('/#/cat/health');
  await expect(page.locator('.item[href="#/s/salt-less"] .entry-number')).toHaveText('04');
});

test('真实中文画布保留所有条件与来源，最长称呼沟通模板全部不裁字', async ({ page }) => {
  await page.goto('/');
  const findings = await page.evaluate(async ({ sayings, templates }) => {
    const path = '/src/card/render.ts';
    const { drawCard } = await import(path);
    const failures: string[] = [];
    const cards = [
      ...sayings.filter(s => s.bigCard).map(s => ({ id: s.id, lines: s.bigCard!.lines, scopeNote: s.scopeNote, sourceLine: s.bigCard!.sourceLine })),
      ...templates.map(t => ({ id: t.id, lines: t.lines, scopeNote: undefined, sourceLine: undefined })),
    ];
    for (const card of cards) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const lines: string[] = [];
      const original = ctx.fillText.bind(ctx);
      ctx.fillText = (text, x, y) => {
        lines.push(text);
        const metrics = ctx.measureText(text);
        const width = metrics.width;
        const left = ctx.textAlign === 'right' ? x - width : x;
        const size = Number(ctx.font.match(/(\d+)px/)?.[1]);
        if (left < 0 || left + width > 1080 || y < 0 || y + size > canvas.height) failures.push(`${card.id}: bounds ${text}`);
        original(text, x, y);
      };
      drawCard(canvas, { ...card, lines: card.lines.map(l => l.replaceAll('{称呼}', '外婆奶奶')), footer: '本地内测样卡，非医疗建议', brand: true });
      if (card.scopeNote && !lines.join('').includes(card.scopeNote)) failures.push(`${card.id}: missing full scope`);
      if (card.sourceLine && !lines.join('').includes(card.sourceLine)) failures.push(`${card.id}: missing source`);
    }
    return failures;
  }, { sayings: library.sayings, templates: THANKS_TEMPLATES });
  expect(findings).toEqual([]);
});

test('原图放大入口与当前预览使用同一 blob，打开真实 PNG', async ({ page }, info) => {
  await page.goto('/#/thanks');
  await page.locator('[data-reply-image]').click();
  const original = page.locator('[data-card-original]');
  await expect(original).toHaveAttribute('href', /^blob:/);
  const url = await page.locator('[data-card-img]').getAttribute('src');
  await expect(original).toHaveAttribute('href', url!);
  const event = page.waitForEvent('popup');
  await original.click();
  const popup = await event;
  await popup.waitForLoadState();
  expect(popup.url()).toBe(url);
  await expect.poll(() => popup.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1080);
  expect(await popup.locator('img').evaluate((image: HTMLImageElement) => image.naturalHeight)).toBe(720);
  await popup.screenshot({ path: info.outputPath('original-png-view.png') });
  await popup.close();
});
