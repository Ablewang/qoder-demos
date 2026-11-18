import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { THANKS_TEMPLATES } from '../src/content/thanks';
import { library } from '../src/content/library';

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket('**', socket => socket.send(JSON.stringify({ type: 'connected' })));
  await page.addInitScript(() => {
    const events: { phase: string; id: number; time: number; visibility: string; focus: boolean }[] = [];
    Object.assign(window, { exportTimings: events });
    const log = (phase: string, id: number) => events.push({ phase, id, time: performance.now(), visibility: document.visibilityState, focus: document.hasFocus() });
    let blobId = 0, decodeId = 0;
    const blob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      const id = ++blobId;
      log('blob-start', id);
      blob.call(this, value => { log('blob-end', id); callback(value); }, ...args);
    };
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () {
      const id = ++decodeId;
      log('decode-start', id);
      await decode.call(this);
      log('decode-end', id);
    };
  });
});

test.afterEach(async ({ page }, info) => {
  const timings = await page.evaluate(() => ({ events: (window as unknown as { exportTimings: unknown[] }).exportTimings, state: document.querySelector('[data-export-state]')?.textContent, image: document.querySelector('[data-card-img]')?.getAttribute('src'), download: document.querySelector('[data-card-download]')?.getAttribute('href') }));
  await writeFile(info.outputPath('export-timings.json'), JSON.stringify(timings, null, 2));
});

async function audit(page: Page) {
  const result = await page.evaluate(() => {
    const controls = [...document.querySelectorAll<HTMLElement>('a,button,summary,input,label,textarea')].filter(el => {
      if (!el.checkVisibility() || el.matches('.skip-link,.sr-only,[disabled],[aria-disabled="true"]')) return false;
      const closed = el.closest('details:not([open])');
      if (closed && !(el.matches('summary') && el.parentElement === closed)) return false;
      return !(el.matches('input[type="radio"],input[type="checkbox"]') && el.closest('label'));
    });
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      controls: controls.filter(el => {
        const r = el.getBoundingClientRect();
        return r.width < 44 || r.height < 44 || r.left < -1 || r.right > innerWidth + 1;
      }).map(el => `${el.tagName}: ${el.textContent?.slice(0, 40)}`),
      clippedText: [...document.querySelectorAll<HTMLTextAreaElement>('textarea')].filter(el => el.scrollHeight > el.clientHeight).map(el => el.value),
    };
  });
  expect(result).toEqual({ overflow: false, controls: [], clippedText: [] });
}

async function imageReady(page: Page, height: number) {
  await expect(page.locator('[data-card-img]')).toBeVisible();
  await expect(page.locator('[data-card-download]')).toHaveAttribute('aria-disabled', 'false');
  expect(await page.locator('[data-card-img]').evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1080, height]);
}

for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  for (const font of ['std', 'lg', 'xl', '130%']) {
    test(`${viewport.width} ${font} 范围、短句优先、复制与两条真实出图路径`, async ({ page }, info) => {
      await page.setViewportSize(viewport);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { document.documentElement.dataset.copied = text; } } });
        const toBlob = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
          document.documentElement.dataset.drawCount = String(Number(document.documentElement.dataset.drawCount || 0) + 1);
          toBlob.call(this, callback, ...args);
        };
      });
      await page.goto('/');
      if (font === '130%') await page.evaluate(() => { document.documentElement.style.fontSize = '32.5px'; });
      else {
        await page.locator('.font-menu summary').click();
        await page.locator(`button[data-font="${font}"]`).click();
      }
      const observations: unknown[] = [];
      const capture = async (name: string) => {
        await audit(page);
        await page.screenshot({ path: info.outputPath(`${name}-viewport.png`) });
        await page.screenshot({ path: info.outputPath(`${name}-full.png`), fullPage: true });
        observations.push({ name, rootFont: await page.evaluate(() => getComputedStyle(document.documentElement).fontSize) });
      };
      await expect(page.locator('.library-status')).toHaveText('育儿 / 养生 · 17 条记录 · 8 条原文已核对 · 9 条待核验');
      await expect(page.locator('.scope-intro')).toContainText('不提供自由问答');
      await capture('home');
      await page.getByRole('searchbox').fill('隔夜菜');
      await page.getByRole('button', { name: '查一查', exact: true }).click();
      await expect(page.locator('.item').first()).toHaveAttribute('href', '#/s/leftovers');
      await page.locator('.item').first().click();
      const leftovers = library.sayings.find(s => s.id === 'leftovers')!;
      await expect(page.locator('.scope p')).toHaveText(leftovers.scopeNote!);
      await page.locator('[data-sources] > summary').click();
      for (const source of leftovers.sources) await expect(page.locator('[data-sources]')).toContainText(source.quote!);
      await capture('leftovers-sources');
      await page.getByRole('link', { name: '做一张大字卡', exact: true }).click();
      await imageReady(page, 1440);
      await expect(page.locator('[data-card-img]')).toHaveAttribute('alt', /尽快冷藏.*吃前要热透.*不含常温放置.*冷藏也限1～2天/);
      await capture('claim-preview');
      await page.goto('/#/s/fever-cover-sweat');
      if (font === '130%') await page.evaluate(() => { document.documentElement.style.fontSize = '32.5px'; });
      await expect(page.locator('[data-card-disabled]')).toBeDisabled();
      await capture('pending');
      await page.locator('.thanks-entry').click();
      await expect(page.locator('[data-reply-text]')).toHaveValue('知道了。');
      const before = await page.locator('html').getAttribute('data-draw-count');
      await expect(page.locator('[data-card-img],input[name="brand"],input[name="sal"]')).toHaveCount(0);
      await capture('reply-default');
      const textBounds = () => page.locator('[data-reply-text]').evaluate(el => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, width: r.width, height: r.height }; });
      const textSlot = await textBounds();
      for (const template of THANKS_TEMPLATES) {
        await page.locator(`input[name="reply-tpl"][value="${template.id}"]`).check();
        await expect(page.locator('[data-reply-text]')).toHaveValue(template.text);
        expect(await textBounds()).toEqual(textSlot);
        await page.locator('[data-reply-copy]').click();
        await expect(page.locator('html')).toHaveAttribute('data-copied', template.text);
        await expect(page.locator('[data-copy-status]')).toContainText('已复制');
        await capture(`reply-${template.id}`);
      }
      expect(await page.locator('html').getAttribute('data-draw-count')).toBe(before);
      await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('controlled clipboard failure'); }; });
      await page.locator('[data-reply-copy]').click();
      await expect(page.locator('[data-copy-status]')).toContainText('复制未成功');
      await expect(page.locator('[data-reply-text]')).toBeFocused();
      expect(await page.locator('[data-reply-text]').evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, THANKS_TEMPLATES.at(-1)!.text.length]);
      await capture('copy-failure-selected');
      await page.locator('input[name="reply-tpl"][value="discuss"]').check();
      await page.locator('[data-reply-image]').click();
      await imageReady(page, 720);
      await expect(page.locator('input[name="tpl"]:checked')).toHaveValue('discuss');
      expect(await page.locator('input[name="brand"]').isChecked()).toBe(false);
      await page.locator('[data-card-settings] > summary').click();
      await page.locator('input[name="custom"]').fill('合成外婆');
      const hashes: unknown[] = [];
      for (const template of THANKS_TEMPLATES) {
        await page.locator(`input[name="tpl"][value="${template.id}"]`).check();
        await expect(page.locator('[data-card-img]')).toHaveAttribute('alt', [...template.lines.map(l => l.replaceAll('{称呼}', '合成外婆')), '本地内测样卡'].join('；'));
        await imageReady(page, 720);
        await capture(`image-${template.id}-settings`);
        const previewBytes = await page.locator('[data-card-img]').evaluate(async (img: HTMLImageElement) => Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer())));
        const downloadEvent = page.waitForEvent('download');
        await page.locator('[data-card-download]').click();
        const download = await downloadEvent;
        const path = info.outputPath(`actual-${template.id}.png`);
        await download.saveAs(path);
        const bytes = await readFile(path);
        expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1080, 720]);
        expect(sha256(bytes)).toBe(sha256(Buffer.from(previewBytes)));
        hashes.push({ template: template.id, dimensions: [1080, 720], previewDownloadSHA256: sha256(bytes) });
      }
      await page.locator('input[name="brand"]').check();
      await imageReady(page, 720);
      await page.locator('[data-preview-jump]').click();
      await expect(page.locator('[data-card-selection]')).toBeFocused();
      await capture('communication-preview');
      await page.getByRole('link', { name: '返回', exact: true }).click();
      await expect(page.locator('[data-reply-text]')).toHaveValue(THANKS_TEMPLATES.at(-1)!.text);
      await page.goto('/#/search/出门前剪指甲会倒霉');
      if (font === '130%') await page.evaluate(() => { document.documentElement.style.fontSize = '32.5px'; });
      await expect(page.locator('[data-empty]')).toContainText('没有覆盖这句，不据此判断对错');
      await expect(page.locator('.list .item')).toHaveCount(0);
      await capture('uncovered');
      await page.locator('.thanks-entry').click();
      await expect(page.locator('[data-card-img]')).toHaveCount(0);
      await capture('uncovered-neutral-reply');
      await page.goto('/#/card/fever-cover-sweat');
      await expect(page.locator('[data-card-download]')).toHaveCount(0);
      expect(errors).toEqual([]);
      await writeFile(info.outputPath('product-observations.json'), JSON.stringify({ viewport, font, observations, hashes, errors, simulation: font === '130%' ? '25px × 130% = 32.5px root font; not native browser zoom' : null }, null, 2));
    });
  }
}

for (const path of ['/#/card/leftovers', '/#/thanks-image/plain']) {
  for (const failure of ['blob', 'decode']) {
    test(`${path} 连续两次 ${failure} 失败可见且聚焦，重试不恢复旧图`, async ({ page }, info) => {
      await page.setViewportSize({ width: 320, height: 740 });
      await page.goto(path);
      const height = path.includes('thanks') ? 720 : 1440;
      await imageReady(page, height);
      const old = await page.locator('[data-card-img]').getAttribute('src');
      await page.evaluate(mode => {
        document.documentElement.style.fontSize = '32.5px';
        let failures = 2;
        if (mode === 'blob') {
          const original = HTMLCanvasElement.prototype.toBlob;
          HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
            if (failures-- > 0) callback(null);
            else original.call(this, callback, ...args);
          };
        } else {
          const original = HTMLImageElement.prototype.decode;
          HTMLImageElement.prototype.decode = function () {
            if (failures-- > 0) return Promise.reject(new Error('controlled decode failure'));
            return original.call(this);
          };
        }
      }, failure);
      await page.locator('[data-card-settings] > summary').click();
      await page.locator('input[name="brand"]').check();
      for (let attempt = 1; attempt <= 2; attempt++) {
        await expect(page.locator('[data-export-state]')).toHaveText('图片未生成成功，尚不能保存。请重新生成。');
        await expect(page.locator('[data-export-retry]')).toBeFocused();
        await expect(page.locator('[data-export-retry]')).toBeInViewport();
        await expect(page.locator('[data-card-img]')).not.toHaveAttribute('src');
        await expect(page.locator('[data-card-download]')).not.toHaveAttribute('href');
        await expect(page.locator('[data-card-download]')).toHaveAttribute('aria-disabled', 'true');
        await expect(page.locator('[data-card-original]')).not.toHaveAttribute('href');
        await expect(page.locator('[data-card-save-hint]')).not.toBeVisible();
        const boxes = await page.locator('[data-export-state],[data-export-retry]').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }));
        expect(boxes[0].bottom).toBeLessThanOrEqual(boxes[1].top);
        await audit(page);
        await page.screenshot({ path: info.outputPath(`failure-${attempt}-viewport.png`) });
        await page.screenshot({ path: info.outputPath(`failure-${attempt}-full.png`), fullPage: true });
        await page.locator('[data-export-retry]').click();
      }
      await imageReady(page, height);
      await expect(page.locator('[data-card-img]')).not.toHaveAttribute('src', old!);
      await expect(page.locator('[data-card-selection]')).toBeFocused();
      await expect(page.locator('[data-export-status]')).not.toBeVisible();
      await audit(page);
      await page.screenshot({ path: info.outputPath('retry-ready.png'), fullPage: true });
    });
  }
}
