import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { availableScenes, fullMessage, matchingTemplates, recipients } from '../src/content';

const key = 'opening-line:achievements:v1';
const inView = async (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => {
  const rect = el.getBoundingClientRect();
  const bar = document.querySelector('.help-bar')?.getBoundingClientRect().top ?? innerHeight;
  return rect.top >= 0 && rect.bottom <= Math.min(innerHeight, bar);
});
const toHome = async (page: Page) => {
  for (let i = 0; i < 3 && !(await page.locator('.masthead').count()); i += 1) await page.locator('[data-action="back"]').click();
  await expect(page.locator('.masthead')).toBeVisible();
};
const reachable = async (page: Page, selector: string) => {
  await page.locator(selector).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
  expect(await inView(page, selector), selector).toBe(true);
};
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
const accessibleTargets = async (page: Page) => {
  const issues = await page.evaluate(async () => {
    const issues: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')) {
      if (el.offsetParent === null || el.closest('dialog:not([open])')) continue;
      el.scrollIntoView({ block: 'center' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const r = el.getBoundingClientRect();
      const name = el.dataset.action ?? el.textContent;
      if (r.width < 43.5 || r.height < 43.5) issues.push(`small: ${name}`);
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit || !el.contains(hit)) issues.push(`blocked: ${name}`);
    }
    window.scrollTo(0, 0);
    return issues;
  });
  expect(issues).toEqual([]);
};

test('黄金路径：一件事直达、分开复制、换说法、真实尝试自报、刷新记录', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('[data-action="recipient"][data-id="roommate"]').click();
  await expect(page.locator('.script')).toBeVisible();
  await expect(page.locator('.main-part')).toHaveCount(1);
  await expect(page.locator('.script-part')).toHaveCount(2);
  const opening = await page.locator('#opening-line').innerText();
  const main = await page.locator('#main-line').innerText();
  const declined = await page.locator('.script-part').first().locator('p').innerText();
  await expect(page.locator('.copy-range #opening-line')).toHaveCount(1);
  await expect(page.locator('.copy-range #main-line')).toHaveCount(1);
  await expect(page.locator('.copy-range .script-part')).toHaveCount(0);
  await page.locator('[data-action="copy-opening"]').click();
  await expect(page.locator('.opening-actions .copy-status.ok')).toHaveText('已复制开场。由你自己粘贴、发送。');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(opening);
  await page.locator('[data-action="copy-full"]').click();
  await expect(page.locator('.opening-actions .copy-status')).toHaveCount(0);
  await expect(page.locator('.full-action + .status-slot .copy-status.ok')).toContainText('开场＋正事');
  const full = await page.evaluate(() => navigator.clipboard.readText());
  expect(full).toBe(`${opening}\n${main}`);
  expect(full).not.toContain(declined);
  await page.locator('[data-action="tier"][data-id="very_nervous"]').click();
  await expect(page.locator('#opening-line')).not.toHaveText(opening);
  await expect(page.locator('[data-action="tier"][data-id="very_nervous"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.copy-status')).toHaveCount(0);
  const shortOpening = await page.locator('#opening-line').innerText();
  await page.locator('[data-action="copy-opening"]').click();
  await expect(page.locator('.copy-status.ok')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shortOpening);
  await expect(page.locator('.record')).toContainText('读完不算');
  await page.locator('[data-action="complete"]').click();
  await expect(page.locator('[data-action="complete"]')).toHaveCount(0);
  await expect(page.locator('.done-row')).toContainText('本机共记下 1 次');
  await expect(page.locator('.done-row')).not.toContainText('已发送');
  await expect(page.locator('.copy-status')).toHaveCount(0);
  const persisted = await page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)!), key);
  expect(persisted.completions).toHaveLength(1);
  expect(Object.keys(persisted.completions[0]).sort()).toEqual(['attemptId', 'completedDate']);
  await page.locator('[data-action="tier"][data-id="awkward"]').click();
  await expect(page.locator('[data-action="complete"]')).toHaveCount(0);
  await page.locator('.record [data-action="badges"]').click();
  await expect(page.locator('.count-number')).toHaveText('1');
  await page.reload();
  await expect(page.locator('.count-number')).toHaveText('1');
  await expect(page.locator('.milestone, .milestones')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/勋章|越来越像|再勇敢|还差/);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([key]);
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 320, height: 740 }, { width: 375, height: 812 }, { width: 390, height: 844 }]) {
  for (const large of [false, true]) {
    test(`${viewport.width}×${viewport.height}${large ? ' 大字' : ''}：首屏开场与复制优先，后续可达，触区达标`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      if (large) await page.locator('[data-action="large"]').click();
      await noOverflow(page);
      expect(await inView(page, '[data-action="quick"]')).toBe(true);
      await accessibleTargets(page);
      await page.locator('[data-action="quick"]').first().click();
      for (const selector of ['#opening-line', '[data-action="copy-opening"]', '[data-action="tier"]']) expect(await inView(page, selector), selector).toBe(true);
      for (const selector of ['[data-action="copy-full"]', '[data-action="complete"]']) await reachable(page, selector);
      await noOverflow(page);
      await accessibleTargets(page);
      await toHome(page);
      await page.locator('[data-action="recipient"][data-id="friend"]').click();
      await page.locator('[data-action="scene"][data-id="help_chat"]').click();
      for (const selector of ['.notice', '#opening-line', '[data-action="copy-opening"]', '[data-action="tier"]']) expect(await inView(page, selector), selector).toBe(true);
      await expect(page.locator('.notice')).toContainText('未经专业复核');
      await reachable(page, '[data-action="end-help"]');
      await noOverflow(page);
      await accessibleTargets(page);
    });
  }
}

test('快捷场景、当面短句复制范围、应用内返回、大字与长场景名', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action="quick"][data-scene="refund"]').click();
  await expect(page.locator('h1')).toContainText('问一下怎么退货');
  await expect(page.locator('[data-action="copy-full"]')).toHaveCount(1);
  await page.locator('[data-action="tier"][data-id="very_nervous"]').click();
  await expect(page.locator('[data-action="copy-full"]')).toHaveCount(0);
  await expect(page.locator('.copy-scope')).toHaveCount(0);
  await expect(page.locator('.copy-range #main-line')).toHaveCount(0);
  await expect(page.locator('.outside #main-line')).toHaveCount(1);
  await expect(page.locator('.range-end')).toHaveText('以下不在复制范围内');
  await page.locator('[data-action="large"]').click();
  await expect(page.locator('html')).toHaveClass(/large-type/);
  await toHome(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.locator('[data-action="recipient"][data-id="friend"]').click();
  await page.locator('[data-action="scene"][data-id="old_friend"]').click();
  await expect(page.locator('h1')).toContainText('找好久没联系的朋友');
  await expect(page.locator('.back')).toHaveAccessibleName('返回');
  await noOverflow(page);
  await accessibleTargets(page);
  await page.locator('[data-action="back"]').click();
  await expect(page.locator('h1')).toHaveText('想跟朋友说哪件事？');
});

test('已覆盖关系与场景目录不跨关系凑数；每行展示真实开场', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-action="recipient"]')).toHaveCount(12);
  await expect(page.locator('[data-action="recipient"][data-id="relative"]')).toHaveCount(0);
  await expect(page.locator('#uncovered-note')).toContainText('亲戚：暂未覆盖');
  await expect(page.locator('#uncovered-note')).toContainText('不拿别的关系换个称呼来凑');
  await expect(page.locator('[data-action="recipient"][data-id="parent"]')).toContainText('仅求助样稿');
  for (const recipient of recipients.filter((item) => availableScenes(item.id).length)) {
    await page.locator(`[data-action="recipient"][data-id="${recipient.id}"]`).click();
    const items = availableScenes(recipient.id);
    if (items.length === 1) await expect(page.locator('h1')).toContainText(items[0]!.label);
    else {
      await expect(page.locator('[data-action="scene"]')).toHaveCount(items.length);
      for (const scene of items) await expect(page.locator(`[data-action="scene"][data-id="${scene.id}"] .glimpse`)).toHaveText(matchingTemplates(scene.id, recipient.id, 'awkward')[0]!.lines.opening);
      await expect(page.locator('.empty')).toHaveCount(0);
    }
    await toHome(page);
  }
});

test('空记录、取消和确认清除准确，不持久化页面偏好', async ({ page }) => {
  await page.goto('/#badges');
  await expect(page.locator('.count-number')).toHaveText('0');
  await expect(page.locator('.empty-history')).toContainText('还没有记录');
  await page.locator('[data-action="home"]').click();
  await page.locator('[data-action="quick"]').first().click();
  await page.locator('[data-action="complete"]').click();
  await page.locator('.record [data-action="badges"]').click();
  await page.locator('[data-action="show-clear"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('[data-action="cancel-clear"]').click();
  await expect(page.locator('.count-number')).toHaveText('1');
  await page.locator('[data-action="show-clear"]').click();
  await page.locator('[data-action="confirm-clear"]').click();
  await expect(page.locator('.count-number')).toHaveText('0');
  await expect(page.locator('.feedback')).toContainText('已清除');
  await page.reload();
  await expect(page.locator('.empty-history')).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test('三类求助只复制开场、不保存、不授勋、不外发；完整资源仍在', async ({ page }) => {
  const destinations: string[] = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:5213')) destinations.push(request.url()); });
  for (const [recipient, scene] of [['friend', 'help_chat'], ['friend', 'help_money'], ['parent', 'help_counseling']]) {
    await page.goto('/');
    await page.locator(`[data-action="recipient"][data-id="${recipient}"]`).click();
    if (recipient === 'friend') {
      await expect(page.locator('.help-bar')).toContainText('时段以当地为准');
      await expect(page.locator('.notice')).toContainText('未经专业复核');
      await page.locator(`[data-action="scene"][data-id="${scene}"]`).click();
    }
    await expect(page.locator('.notice')).toContainText('未经专业复核');
    await expect(page.locator('.help-bar')).toBeVisible();
    await expect(page.locator('.help-bar a')).toHaveCount(0);
    await expect(page.locator('[data-action="complete"], [data-action="copy-full"]')).toHaveCount(0);
    await expect(page.locator('.copy-range #main-line')).toHaveCount(0);
    const opening = await page.locator('#opening-line').innerText();
    await page.locator('[data-action="copy-opening"]').click();
    await expect(page.locator('.copy-status.ok')).toContainText('已复制开场');
    await expect(page.locator('.copy-scope')).toHaveText('求助只复制开场，先确认对方方便。');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(opening);
    await page.locator('[data-action="tier"][data-id="very_nervous"]').click();
    await expect(page.locator('.notice')).toContainText('未经专业复核');
    await expect(page.locator('body')).not.toContainText('已复核');
    await page.locator('[data-action="end-help"]').click();
    await expect(page.locator('h1')).toContainText('再由你自己发');
    await expect(page.locator('.done-panel')).toContainText('不留记录');
    await expect(page.locator('body')).not.toContainText('勋');
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
    await page.reload();
    await expect(page.locator('h1')).toContainText('先借你');
  }
  await page.goto('/#help');
  await expect(page.locator('a[href="tel:12356"]')).toHaveCount(1);
  await expect(page.locator('.resource')).toContainText('服务时间以当地为准');
  await expect(page.locator('.resource')).toContainText('不保证立即接通');
  await expect(page.locator('.emergency')).toContainText('其他地区');
  await expect(page.locator('a[href="tel:120"], a[href="tel:110"]')).toHaveCount(2);
  await expect(page.locator('.safe-message')).toContainText('不要发给威胁你的人');
  await expect(page.locator('.safe-message')).toContainText('家暴或跟踪，用安全的设备');
  await expect(page.locator('.notice')).toContainText('有即时危险不要只等热线');
  await expect(page.locator('.help-bar')).toHaveCount(0);
  await page.locator('[data-action="copy-help"]').click();
  await expect(page.locator('.copy-status.ok')).toContainText('信得过');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('我现在不太安全，能陪着我一起联系专业帮助吗？');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(destinations).toEqual([]);
});

test('320大字：三类求助两种说法首屏可复制，结束与所有安全说明不被援助栏挡住', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.locator('[data-action="large"]').click();
  for (const [recipient, scene] of [['friend', 'help_chat'], ['friend', 'help_money'], ['parent', 'help_counseling']]) {
    for (const tier of ['awkward', 'very_nervous']) {
      await toHome(page);
      await page.locator(`[data-action="recipient"][data-id="${recipient}"]`).click();
      if (recipient === 'friend') await page.locator(`[data-action="scene"][data-id="${scene}"]`).click();
      await page.locator(`[data-action="tier"][data-id="${tier}"]`).click();
      await page.evaluate(() => window.scrollTo(0, 0));
      for (const selector of ['.notice', '[data-action="tier"]', '#opening-line', '[data-action="copy-opening"]']) expect(await inView(page, selector), `${scene} ${tier} ${selector}`).toBe(true);
      await reachable(page, '[data-action="end-help"]');
      if (await page.locator('.scene-note').count()) await reachable(page, '.scene-note');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const clearance = await page.evaluate(() => {
        const leaves = [...document.querySelectorAll<HTMLElement>('main *, .site-foot *')].filter((el) => !el.children.length && el.getBoundingClientRect().height);
        return document.querySelector('.help-bar')!.getBoundingClientRect().top - Math.max(...leaves.map((el) => el.getBoundingClientRect().bottom));
      });
      expect(clearance).toBeGreaterThanOrEqual(24);
      await noOverflow(page);
      await accessibleTargets(page);
    }
  }
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test('复制等待中切换说法或换卡，旧操作不归属新台词、不补写剪贴板', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { writes: string[]; release: () => void };
    w.writes = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (text: string) => new Promise<void>((resolve) => { w.writes.push(text); w.release = resolve; }) } });
  });
  const writes = () => page.evaluate(() => (window as unknown as { writes: string[] }).writes);
  const release = () => page.evaluate(() => (window as unknown as { release: () => void }).release());
  await page.goto('/');
  await page.locator('[data-action="quick"][data-scene="teacher_leave"]').click();
  const natural = await page.locator('#opening-line').innerText();
  await page.locator('[data-action="copy-opening"]').click();
  await expect(page.locator('[data-action="copy-opening"]')).toBeDisabled();
  await page.locator('[data-action="tier"][data-id="very_nervous"]').click();
  const short = await page.locator('#opening-line').innerText();
  expect(short).not.toBe(natural);
  await expect(page.locator('[data-action="copy-opening"]')).toBeDisabled();
  await release();
  await expect(page.locator('[data-action="copy-opening"]')).toBeEnabled();
  await expect(page.locator('.copy-status')).toHaveCount(0);
  expect(await writes()).toEqual([natural]);
  await page.locator('[data-action="copy-opening"]').click();
  await release();
  await expect(page.locator('.copy-status.ok')).toHaveText('已复制开场。由你自己粘贴、发送。');
  expect(await writes()).toEqual([natural, short]);
  await page.locator('[data-action="copy-full"]').click();
  await toHome(page);
  await page.locator('[data-action="quick"][data-scene="refund"]').click();
  await expect(page.locator('[data-action="copy-opening"]')).toBeDisabled();
  await release();
  await expect(page.locator('[data-action="copy-opening"]')).toBeEnabled();
  await expect(page.locator('.copy-status')).toHaveCount(0);
  expect(await writes()).toHaveLength(3);
  await page.locator('[data-action="copy-opening"]').click();
  await release();
  await expect(page.locator('.copy-status.ok')).toBeVisible();
  expect((await writes())[3]).toBe(await page.locator('#opening-line').innerText());
});

test('普通记录存在时，求助全过程不改动历史', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action="quick"]').first().click();
  await page.locator('[data-action="complete"]').click();
  const before = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key);
  await toHome(page);
  await page.locator('[data-action="recipient"][data-id="friend"]').click();
  await page.locator('[data-action="scene"][data-id="help_chat"]').click();
  await page.locator('[data-action="end-help"]').click();
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(before);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([key]);
});

for (const unavailable of [false, true]) {
  test(`复制${unavailable ? '接口缺失' : '拒绝'}保留长按路径，不误报成功`, async ({ page }) => {
    await page.addInitScript((missing) => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: missing ? undefined : { writeText: async () => { throw new Error('denied'); } } });
    }, unavailable);
    await page.goto('/');
    await page.locator('[data-action="quick"]').first().click();
    for (const action of ['copy-opening', 'copy-full']) {
      await page.locator(`[data-action="${action}"]`).click();
      await expect(page.locator('.copy-status.fail')).toContainText('请长按');
      await expect(page.locator('.copy-status.ok')).toHaveCount(0);
    }
    await expect(page.locator('#opening-line')).toBeVisible();
  });
}

test('本地存储不可用仍能开口，完成不误报已保存', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new Error('denied'); } });
  });
  await page.goto('/');
  await expect(page.locator('.storage-error')).toContainText('暂时存不了');
  await page.locator('[data-action="quick"]').first().click();
  await page.locator('[data-action="complete"]').click();
  await expect(page.locator('[data-action="complete"]')).toHaveCount(0);
  await expect(page.locator('.done-row')).toContainText('只记在当前页面');
  await expect(page.locator('.storage-error')).toContainText('只记在当前页面');
});

test('损坏记录不自动覆盖，只有确认清除才移除', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((storageKey) => localStorage.setItem(storageKey, 'broken-json'), key);
  await page.reload();
  await expect(page.locator('.storage-error')).toContainText('旧数据没有被自动清除');
  await page.locator('[data-action="quick"]').first().click();
  await page.locator('[data-action="complete"]').click();
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe('broken-json');
  await page.locator('.record [data-action="badges"]').click();
  await expect(page.locator('.count-number')).toHaveText('1');
  await page.locator('[data-action="show-clear"]').click();
  await page.locator('[data-action="cancel-clear"]').click();
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe('broken-json');
  await page.locator('[data-action="show-clear"]').click();
  await page.locator('[data-action="confirm-clear"]').click();
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
});

test('保存配额失败只保留本页记录，不虚构持久化', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('quota exceeded'); }; });
  await page.goto('/');
  await page.locator('[data-action="quick"]').first().click();
  await page.locator('[data-action="complete"]').click();
  await expect(page.locator('.storage-error')).toContainText('保存失败');
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
  await page.locator('.record [data-action="badges"]').click();
  await expect(page.locator('.count-number')).toHaveText('1');
  await page.reload();
  await expect(page.locator('.count-number')).toHaveText('0');
});

test('38份台词在320大字下原文完整，复制范围与控件可达，无横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.locator('[data-action="large"]').click();
  for (const recipient of recipients.filter((item) => availableScenes(item.id).length)) {
    for (const scene of availableScenes(recipient.id)) {
      await toHome(page);
      await page.locator(`[data-action="recipient"][data-id="${recipient.id}"]`).click();
      if (availableScenes(recipient.id).length > 1) await page.locator(`[data-action="scene"][data-id="${scene.id}"]`).click();
      for (const tier of ['awkward', 'very_nervous']) {
        await page.locator(`[data-action="tier"][data-id="${tier}"]`).click();
        const template = matchingTemplates(scene.id, recipient.id, tier)[0]!;
        await expect(page.locator('#opening-line')).toHaveText(template.lines.opening);
        await expect(page.locator('#main-line')).toHaveText(template.lines.main);
        await expect(page.locator('.script-part').first().locator('p')).toHaveText(template.lines.ifDeclined);
        await expect(page.locator('.script-part').last().locator('p')).toHaveText(template.lines.closing);
        await expect(page.locator('[data-action="copy-full"]')).toHaveCount(fullMessage(template) ? 1 : 0);
        await noOverflow(page);
        await reachable(page, '[data-action="copy-opening"]');
        await reachable(page, scene.help ? '[data-action="end-help"]' : '[data-action="complete"]');
      }
    }
  }
});

type DeferredClipboard = { copyWrites: string[]; resolveCopy: () => void; rejectCopy: () => void };

const installDeferredClipboard = async (page: Page) => {
  await page.addInitScript(() => {
    const probe = window as unknown as DeferredClipboard;
    probe.copyWrites = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: (text: string) => new Promise<void>((resolve, reject) => {
        probe.copyWrites.push(text);
        probe.resolveCopy = resolve;
        probe.rejectCopy = () => reject(new Error('simulated clipboard rejection'));
      }),
    } });
  });
};

const settleDeferredCopy = async (page: Page, outcome: 'resolve' | 'reject') => {
  await page.evaluate(async (result) => {
    const probe = window as unknown as DeferredClipboard;
    if (result === 'resolve') probe.resolveCopy();
    else probe.rejectCopy();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, outcome);
};

const stableCopyPage = (page: Page) => page.evaluate((storageKey) => ({
  title: document.querySelector('h1')?.textContent,
  url: location.href,
  scrollX,
  scrollY,
  focus: document.activeElement?.getAttribute('data-action'),
  record: localStorage.getItem(storageKey),
  dialogOpen: document.querySelector<HTMLDialogElement>('#clear-dialog')?.open ?? false,
}), key);

const captureCopyPatch = async (page: Page, label: string) => {
  await page.screenshot({ path: test.info().outputPath(`${label}.png`) });
  await test.info().attach(label, { body: JSON.stringify({
    ...await stableCopyPage(page),
    disabledCopyButtons: await page.locator('button[data-action^="copy-"]:disabled').count(),
    copyFeedback: await page.locator('.copy-status').allTextContents(),
  }, null, 2), contentType: 'application/json' });
};

for (const outcome of ['resolve', 'reject'] as const) {
  for (const decision of ['cancel', 'confirm'] as const) {
    test(`过期复制${outcome}保留新确认框、焦点和页面，可${decision}清除`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 740 });
      await installDeferredClipboard(page);
      await page.addInitScript((storageKey) => localStorage.setItem(storageKey, JSON.stringify({
        schemaVersion: 1,
        completions: [{ attemptId: 'copy-patch-existing', completedDate: '2026-11-18' }],
      })), key);
      await page.goto('/');
      await page.locator('[data-action="large"]').click();
      await page.locator('[data-action="quick"]').first().click();
      await page.locator('[data-action="copy-opening"]').click();
      await expect(page.locator('[data-action="copy-opening"]')).toBeDisabled();
      await toHome(page);
      await page.locator('[data-action="badges"]').click();
      await expect(page.locator('.count-number')).toHaveText('1');
      await page.locator('[data-action="show-clear"]').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.locator('[data-action="confirm-clear"]').focus();
      const dialog = await page.locator('#clear-dialog').elementHandle();
      const focused = await page.evaluateHandle(() => document.activeElement);
      const before = await stableCopyPage(page);
      const label = `dialog-${outcome}-${decision}-320-large`;
      await captureCopyPatch(page, `${label}-pending`);
      await settleDeferredCopy(page, outcome);
      await captureCopyPatch(page, `${label}-settled`);
      expect(await dialog!.evaluate((element) => element instanceof HTMLDialogElement && element.isConnected && element.open)).toBe(true);
      expect(await focused.evaluate((element) => document.activeElement === element)).toBe(true);
      expect(await stableCopyPage(page)).toEqual(before);
      await expect(page.locator('.copy-status')).toHaveCount(0);
      await expect(page.locator('.count-number')).toHaveText('1');
      await page.locator(`[data-action="${decision}-clear"]`).click();
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(page.locator('.count-number')).toHaveText(decision === 'cancel' ? '1' : '0');
      if (decision === 'cancel') expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(before.record);
      else expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
      await captureCopyPatch(page, `${label}-chosen`);
    });
  }

  for (const destination of ['card', 'help'] as const) {
    test(`过期复制${outcome}不重绘新${destination}页，解除等待后可再次复制`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 740 });
      await installDeferredClipboard(page);
      await page.goto('/');
      await page.locator('[data-action="large"]').click();
      await page.locator('[data-action="quick"]').first().click();
      await page.locator('[data-action="copy-opening"]').click();
      await toHome(page);
      if (destination === 'card') await page.locator('[data-action="quick"][data-scene="refund"]').click();
      else await page.locator('.site-foot [data-action="help"]').click();
      const copy = `[data-action="${destination === 'card' ? 'copy-opening' : 'copy-help'}"]`;
      const focus = destination === 'card' ? '[data-action="tier"][data-id="awkward"]' : '[data-action="help-return"]';
      await expect(page.locator(copy)).toBeDisabled();
      await page.locator(focus).focus();
      const main = await page.locator('main').elementHandle();
      const button = await page.locator(copy).elementHandle();
      const focused = await page.evaluateHandle(() => document.activeElement);
      const before = await stableCopyPage(page);
      const label = `${destination}-${outcome}-320-large`;
      await captureCopyPatch(page, `${label}-pending`);
      await settleDeferredCopy(page, outcome);
      await captureCopyPatch(page, `${label}-settled`);
      expect(await main!.evaluate((element) => element.isConnected)).toBe(true);
      expect(await button!.evaluate((element) => element instanceof HTMLButtonElement && element.isConnected && !element.disabled)).toBe(true);
      expect(await focused.evaluate((element) => document.activeElement === element)).toBe(true);
      expect(await stableCopyPage(page)).toEqual(before);
      await expect(page.locator(copy)).toBeEnabled();
      await expect(page.locator('.copy-status')).toHaveCount(0);
      const text = await page.locator(destination === 'card' ? '#opening-line' : '.safe-opening').innerText();
      await page.locator(copy).click();
      await expect(page.locator(copy)).toBeDisabled();
      await settleDeferredCopy(page, 'resolve');
      await expect(page.locator(copy)).toBeEnabled();
      await expect(page.locator(destination === 'card' ? '.opening-actions .copy-status.ok' : '.safe-message .copy-status.ok')).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as DeferredClipboard).copyWrites.at(-1))).toBe(text);
      await captureCopyPatch(page, `${label}-fresh-copy`);
    });
  }
}


const noClippedText = async (page: Page) => expect(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('main p, main h1, main h2, header h1, button, .help-bar p')]
  .filter((el) => el.offsetParent !== null && el.scrollWidth > el.clientWidth + 1)
  .map((el) => el.textContent?.trim().slice(0, 16)))).toEqual([]);

test('伴侣吵架后：按对象路径可达，两种说法中性、不道歉不编经过，边界可见，复制精确', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action="recipient"][data-id="partner"]').click();
  await page.locator('[data-action="scene"][data-id="after_argument"]').click();
  await expect(page.locator('h1')).toContainText('吵架后先开口');
  for (const tier of ['awkward', 'very_nervous'] as const) {
    await page.locator(`[data-action="tier"][data-id="${tier}"]`).click();
    const template = matchingTemplates('after_argument', 'partner', tier)[0]!;
    await expect(page.locator('#opening-line')).toHaveText(template.lines.opening);
    await expect(page.locator('.script')).not.toContainText(/道歉|对不起|太冲|重的话|昨天/);
    await expect(page.locator('.scene-note')).toContainText('对方明确不想联系，就停在这里');
    await page.locator('[data-action="copy-opening"]').click();
    await expect(page.locator('.opening-actions .copy-status.ok')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(template.lines.opening);
    const full = fullMessage(template);
    await expect(page.locator('[data-action="copy-full"]')).toHaveCount(full ? 1 : 0);
    if (full) {
      await page.locator('[data-action="copy-full"]').click();
      await expect(page.locator('.full-action + .status-slot .copy-status.ok')).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(full);
    }
  }
  await expect(page.locator('input, select, textarea')).toHaveCount(0);
});

// 130% text is simulated as 130% browser zoom: the CSS viewport shrinks by 1.3.
for (const viewport of [
  { name: '320×740', width: 320, height: 740 },
  { name: '390×844', width: 390, height: 844 },
  { name: '1280×800', width: 1280, height: 800 },
  { name: '320×740 @130%', width: 246, height: 569 },
  { name: '390×844 @130%', width: 300, height: 649 },
  { name: '1280×800 @130%', width: 985, height: 615 },
]) {
  for (const large of [false, true]) {
    test(`${viewport.name}${large ? ' 大字' : ''}：快捷一步可取开场，模式与反馈不跳，记录只是可选计数`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      if (large) await page.locator('[data-action="large"]').click();
      expect(await inView(page, '[data-action="quick"]')).toBe(true);
      await reachable(page, '[data-action="quick"][data-scene="refund"]');
      await noOverflow(page);
      await noClippedText(page);
      await accessibleTargets(page);
      await page.locator('[data-action="quick"][data-scene="refund"]').click();
      for (const selector of ['#opening-line', '[data-action="copy-opening"]', '[data-action="tier"]']) expect(await inView(page, selector), selector).toBe(true);
      const box = async (selector: string) => (await page.locator(selector).boundingBox())!;
      const tone = await box('[data-action="tier"][data-id="very_nervous"]');
      const copy = await box('[data-action="copy-opening"]');
      await page.locator('[data-action="copy-opening"]').click();
      await expect(page.locator('.opening-actions .copy-status.ok')).toBeVisible();
      expect(await box('[data-action="copy-opening"]')).toEqual(copy);
      await page.locator('[data-action="tier"][data-id="very_nervous"]').click();
      expect(await box('[data-action="tier"][data-id="very_nervous"]')).toEqual(tone);
      expect(await box('[data-action="copy-opening"]')).toEqual(copy);
      await expect(page.locator('.copy-status')).toHaveCount(0);
      expect(parseFloat(await page.locator('#opening-line').evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(large ? 31 : 26);
      await noOverflow(page);
      await noClippedText(page);
      await accessibleTargets(page);
      await page.locator('[data-action="back"]').click();
      await page.locator('[data-action="recipient"][data-id="partner"]').click();
      await page.locator('[data-action="scene"][data-id="after_argument"]').click();
      await reachable(page, '.scene-note');
      await reachable(page, '[data-action="complete"]');
      await noOverflow(page);
      await noClippedText(page);
      await accessibleTargets(page);
      await toHome(page);
      await page.locator('[data-action="badges"]').click();
      await expect(page.locator('.lede')).toContainText('只是计数');
      await expect(page.locator('.empty-history')).toContainText('记不记都可以');
      await expect(page.locator('main')).not.toContainText(/勋章|越来越像|再勇敢|还差|连续/);
      await noOverflow(page);
      await noClippedText(page);
      await accessibleTargets(page);
    });
  }
}
