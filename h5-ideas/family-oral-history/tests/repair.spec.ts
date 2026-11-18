import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdirSync, mkdtempSync } from 'node:fs';

const origin = process.env.TEST_ORIGIN!;
const evidenceRoot = join(import.meta.dirname, '../.test-data/site-redesign-20261118');
mkdirSync(evidenceRoot, { recursive: true });
const output = process.env.REDESIGN_EVIDENCE_DIR || mkdtempSync(join(evidenceRoot, 'repair-'));
const before = process.env.REPAIR_CAPTURE === 'before';
function tone() {
  const wav = Buffer.alloc(44 + 16000 * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 0; i < 16000; i++) wav.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / 16000) * 6000), 44 + i * 2);
  return wav;
}
async function post(page: Page, path: string, data: unknown) {
  const response = await page.request.post(`/api${path}`, { data, headers: { Origin: origin } });
  expect(response.ok()).toBe(true); return response.json();
}
async function position(locator: Locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), documentTop: Math.round(rect.top + scrollY), width: Math.round(rect.width), height: Math.round(rect.height), viewportHeight: innerHeight };
  });
}
async function visibleAction(locator: Locator) {
  const box = await position(locator); expect(box.top).toBeGreaterThanOrEqual(0); expect(box.bottom).toBeLessThanOrEqual(box.viewportHeight);
  expect(await locator.evaluate((element) => { const box = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)); })).toBe(true);
  return box;
}
// A fixed bar may cover at most a quarter of the viewport; a bar returned to document flow must be reachable by scrolling.
async function reachableAction(locator: Locator) {
  const bar = await locator.evaluate((element) => { const bar = element.closest('.action-bar'); return bar && { position: getComputedStyle(bar).position, share: bar.getBoundingClientRect().height / innerHeight }; });
  if (bar?.position === 'fixed') expect(bar.share).toBeLessThanOrEqual(0.25);
  else if (bar) await locator.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  return { ...(await visibleAction(locator)), barPosition: bar?.position };
}
test.beforeAll(async () => { await mkdir(output, { recursive: true }); });

for (let iteration = 0; iteration < 10; iteration++) {
  test(`快速邀请在订阅建立前已变更，不刷新 ${iteration + 1}`, async ({ page, browser }) => {
    test.skip(before, '只在返修复验运行路由回归');
    const family = await post(page, '/families', { name: `快速入口${iteration}`, organizerName: '测试小禾', storytellerName: '测试外婆' });
    const key = iteration % 2 ? 's' : 'j';
    const token = key === 's' ? family.storyteller.token : family.invite.token;
    const context = await browser.newContext();
    try {
      await context.addInitScript(({ key, token }) => {
        const subscribe = window.addEventListener;
        let changed = false;
        window.addEventListener = function (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
          if (type === 'hashchange' && !changed) {
            changed = true;
            history.replaceState(null, '', `/#${key}=${token}`);
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            document.documentElement.dataset.preSubscriptionNavigation = 'true';
          }
          return subscribe.call(this, type, listener, options);
        };
      }, { key, token });
      const entrant = await context.newPage(); await entrant.goto(origin);
      await expect(entrant.locator('html')).toHaveAttribute('data-pre-subscription-navigation', 'true');
      await expect(entrant.getByRole('heading', { name: `${family.snapshot.family.storytellerName}的讲述` })).toBeVisible();
      await expect(entrant.locator('.invitation .intro')).toHaveText(family.snapshot.family.name);
      await expect(entrant.getByRole('button', { name: key === 's' ? '我知道了，进入说故事' : '同意并加入家族' })).toBeEnabled();
      const otherKey = key === 's' ? 'j' : 's';
      const otherToken = otherKey === 's' ? family.storyteller.token : family.invite.token;
      await entrant.evaluate(({ key, token }) => { location.hash = `${key}=${token}`; }, { key: otherKey, token: otherToken });
      await expect(entrant.getByRole('button', { name: otherKey === 's' ? '我知道了，进入说故事' : '同意并加入家族' })).toBeEnabled();
      expect(await entrant.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(1);
    } finally { await context.close(); }
  });
}

for (const screen of [{ width: 320, height: 740, scale: 1 }, { width: 390, height: 844, scale: 1 }, { width: 320, height: 740, scale: 1.25 }]) {
  test(`视口操作基线与复验 ${screen.width}×${screen.height} 字号${screen.scale}`, async ({ page, browser }) => {
    await page.setViewportSize(screen);
    const family = await post(page, '/families', { name: '虚构往事', organizerName: '测试小禾', storytellerName: '测试外婆' });
    const ask = await post(page, '/asks', { text: '第一份工资买了什么？', stage: '工作', depth: 'gentle' });
    const context = await browser.newContext({ viewport: screen, permissions: ['microphone'] });
    try {
      const elder = await context.newPage();
      await elder.goto(`${origin}/#s=${family.storyteller.token}`);
      await elder.getByLabel('同意家族保存与分享说明').check();
      await elder.getByRole('button', { name: '我知道了，进入说故事' }).click();
      await expect(elder.getByRole('button', { name: '我愿意，开始说' })).toBeVisible();
      const defaultTypography = await elder.locator('.elder-question h1').evaluate((element) => ({ question: Number.parseFloat(getComputedStyle(element).fontSize), root: Number.parseFloat(getComputedStyle(document.documentElement).fontSize) }));
      if (screen.scale > 1) await elder.evaluate((root) => { document.documentElement.style.fontSize = `${root * 1.25}px`; document.documentElement.classList.add('test-large-text'); }, defaultTypography.root);
      const metrics: Record<string, unknown> = {};
      const prefix = `${before ? 'before' : 'after'}-${screen.width}-${screen.height}-${screen.scale}`;
      await elder.evaluate(() => scrollTo(0, 0));
      metrics.record = before ? await position(elder.getByRole('button', { name: '我愿意，开始说' })) : await reachableAction(elder.getByRole('button', { name: '我愿意，开始说' }));
      await elder.screenshot({ path: join(output, `${prefix}-record.png`) });
      if (!before) {
        metrics.questionFont = await elder.locator('.elder-question h1').evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
        const rootFont = await elder.locator('html').evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
        expect(rootFont).toBeCloseTo(defaultTypography.root * screen.scale, 1);
        // Preserve 1.25× text scaling while allowing the redesigned heading's genuine rem size.
        expect(metrics.questionFont).toBeCloseTo(defaultTypography.question * screen.scale, 1);
        await elder.getByRole('button', { name: '我愿意，开始说' }).click();
        await expect(elder.locator('.recording-state strong')).toHaveText(/^00:0[2-9]$/);
        metrics.stop = await reachableAction(elder.getByRole('button', { name: '说完了，先试听' }));
        await elder.screenshot({ path: join(output, `${prefix}-recording.png`) });
        await elder.getByRole('button', { name: '说完了，先试听' }).click();
        await expect(elder.getByRole('heading', { name: '先听一听这段草稿' })).toBeVisible();
        metrics.recordedSend = await reachableAction(elder.getByRole('button', { name: '确认发送给家人' }));
        const player = elder.locator('.voice-player').filter({ has: elder.getByLabel('草稿试听', { exact: true }) });
        expect(await player.locator('xpath=ancestor::*[contains(@class,"action-bar")]').count()).toBe(0);
        await player.evaluate((element) => element.scrollIntoView({ block: 'center' }));
        metrics.preview = await visibleAction(player.locator('.play-button'));
        await visibleAction(elder.getByLabel('草稿试听播放位置', { exact: true }));
        await expect(elder.getByLabel('同意保存并在家族内分享')).not.toBeChecked();
        await expect(elder.getByRole('button', { name: '确认发送给家人' })).toBeDisabled();
        await elder.getByLabel('同意保存并在家族内分享').check();
        await expect(elder.getByRole('button', { name: '确认发送给家人' })).toBeEnabled();
        await player.locator('.play-button').click();
        await expect.poll(() => elder.getByLabel('草稿试听', { exact: true }).evaluate((element) => (element as HTMLAudioElement).currentTime)).toBeGreaterThan(0.15);
        await elder.getByLabel('草稿试听', { exact: true }).evaluate((element) => (element as HTMLAudioElement).pause());
        const snapshot = await (await elder.request.get('/api/session')).json(); expect(snapshot.stories).toHaveLength(0);
        await elder.screenshot({ path: join(output, `${prefix}-recorded-preview.png`) });
        elder.once('dialog', (dialog) => dialog.accept()); await elder.getByRole('button', { name: '放弃这次草稿' }).click();
      }
      await elder.getByLabel('导入录音文件').setInputFiles({ name: 'synthetic.wav', mimeType: 'audio/wav', buffer: tone() });
      await expect(elder.getByRole('heading', { name: '先听一听这段草稿' })).toBeVisible();
      await elder.evaluate(() => scrollTo(0, 0));
      metrics.draft = before ? await position(elder.getByRole('button', { name: '确认发送给家人' })) : await reachableAction(elder.getByRole('button', { name: '确认发送给家人' }));
      if (!before) {
        await expect(elder.getByLabel('同意保存并在家族内分享')).not.toBeChecked();
        await expect(elder.getByRole('button', { name: '确认发送给家人' })).toBeDisabled();
        await reachableAction(elder.getByLabel('同意保存并在家族内分享'));
        expect(await elder.locator('.action-bar .voice-player').count()).toBe(0);
      }
      await elder.screenshot({ path: join(output, `${prefix}-draft.png`) });
      elder.once('dialog', (d) => d.accept()); await elder.getByRole('button', { name: '放弃这次草稿' }).click();
      const audio = await page.request.post('/api/stories/audio', { data: tone(), headers: { Origin: origin, 'Content-Type': 'audio/wav', 'X-Ask-Id': ask.id, 'X-Submission-Id': crypto.randomUUID(), 'X-Consent': 'true' } });
      expect(audio.ok()).toBe(true); const story = await audio.json();
      await post(page, `/stories/${story.id}/followups`, { text: '那后来，又买了什么？' });
      await elder.getByRole('button', { name: '刷新家里消息' }).click();
      await expect(elder.locator('.continuation-context')).toContainText('又买了什么');
      await elder.evaluate(() => scrollTo(0, 0));
      metrics.continuation = before ? await position(elder.getByRole('button', { name: '我愿意，开始说' })) : await reachableAction(elder.getByRole('button', { name: '我愿意，开始说' }));
      await elder.screenshot({ path: join(output, `${prefix}-continuation.png`) });
      await post(page, '/stories/text', { askId: null, submissionId: crypto.randomUUID(), consent: true, text: '这是第二段虚构测试文字。' });
      await page.goto('/'); await page.getByRole('button', { name: '故事目录', exact: true }).click();
      await expect(page.locator('.story-entry')).toHaveCount(2);
      await page.evaluate(() => scrollTo(0, 0));
      metrics.wallHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      metrics.forms = await page.locator('.followup-form').count();
      if (!before) expect(metrics.forms).toBe(0);
      await page.screenshot({ path: join(output, `${prefix}-wall.png`) });
      await page.getByRole('button', { name: '问一件事', exact: true }).click();
      await page.locator('.starter-questions .question-option').first().click();
      metrics.ask = before ? await position(page.getByRole('button', { name: '把这个问题送给家人' })) : await reachableAction(page.getByRole('button', { name: '把这个问题送给家人' }));
      await page.screenshot({ path: join(output, `${prefix}-ask.png`) });
      if (!before) {
        expect(await elder.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await writeFile(join(output, `${prefix}-positions.json`), JSON.stringify(metrics, null, 2));
      console.info(prefix, metrics);
    } finally { await context.close(); }
  });
}

test('反馈不挤页面，成功跨页清理，真正错误保留，迟到成功不串页', async ({ page }) => {
  await post(page, '/families', { name: '反馈合成测试', organizerName: '测试管理者', storytellerName: '测试讲述人' });
  await page.goto('/'); await page.getByRole('button', { name: '问一件事', exact: true }).click();
  const heading = page.getByRole('heading', { name: '想问测试讲述人什么？' });
  const top = (await position(heading)).documentTop;
  await page.getByRole('button', { name: '把这个问题送给家人' }).click();
  await expect(page.getByRole('alert')).toContainText('先选一题');
  await page.getByRole('button', { name: '故事目录', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('先选一题');
  await page.getByRole('button', { name: '问一件事', exact: true }).click();
  await page.locator('.ask-editor > summary').click();
  await page.getByLabel('想问的问题').fill('测试问题：小时候最喜欢什么？');
  await page.getByRole('button', { name: '把这个问题送给家人' }).click();
  await expect(page.getByRole('status')).toContainText('问题已放');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect((await position(heading)).documentTop).toBe(top);
  await page.getByRole('button', { name: '故事目录', exact: true }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
  await post(page, '/stories/text', { askId: null, submissionId: crypto.randomUUID(), consent: true, text: '反馈测试故事。' });
  await page.getByRole('button', { name: '刷新家里消息' }).click();
  await expect(page.locator('.story-entry')).toHaveCount(1);
  let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
  let received!: () => void; const incoming = new Promise<void>((resolve) => { received = resolve; });
  await page.route('**/api/stories/*/then', async (route) => { const response = await route.fetch(); received(); await gate; await route.fulfill({ response }); });
  await page.getByRole('button', { name: /然后呢，还想听/ }).click(); await incoming;
  await page.getByRole('button', { name: '问一件事', exact: true }).click();
  const refreshed = page.waitForResponse((response) => response.url().endsWith('/api/session'));
  release(); await refreshed;
  await expect(heading).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0); await expect(page.getByRole('alert')).toHaveCount(0);
});

test('追问编辑按条展开，收起保留文字，发送后收起并进入续讲队列', async ({ page }) => {
  await post(page, '/families', { name: '追问编辑测试', organizerName: '测试管理者', storytellerName: '测试讲述人' });
  for (let i = 0; i < 2; i++) await post(page, '/stories/text', { askId: null, submissionId: crypto.randomUUID(), consent: true, text: `第${i + 1}段合成文字。` });
  await page.goto('/'); await expect(page.locator('.story-entry')).toHaveCount(2);
  await expect(page.locator('.followup-form')).toHaveCount(0);
  const first = page.locator('.story-entry').first(); const second = page.locator('.story-entry').last();
  await first.getByRole('button', { name: '写一个具体追问' }).click();
  await expect(first.locator('.followup-form')).toHaveCount(1); await expect(second.locator('.followup-form')).toHaveCount(0);
  await first.getByLabel('还想问什么').fill('测试：后来去了哪里？');
  await first.getByRole('button', { name: '收起追问编辑' }).click(); await first.getByRole('button', { name: '写一个具体追问' }).click();
  await expect(first.getByLabel('还想问什么')).toHaveValue('测试：后来去了哪里？');
  await first.getByRole('button', { name: '送去一个追问' }).click();
  await expect(page.getByRole('status')).toContainText('追问已送去'); await expect(page.locator('.followup-form')).toHaveCount(0);
  await first.locator('.followup-history summary').click(); await expect(first.getByText('测试：后来去了哪里？')).toBeVisible();
  const snapshot = await (await page.request.get('/api/session')).json();
  expect(snapshot.asks.some((ask: { status: string; parentStoryId: string | null }) => ask.status === 'pending' && !!ask.parentStoryId)).toBe(true);
});

test('录音离页立刻返回等待尾片段保存，不自动发送且可播放恢复草稿', async ({ page, browser }) => {
  const family = await post(page, '/families', { name: '离页录音测试', organizerName: '测试管理者', storytellerName: '测试讲述人' });
  const context = await browser.newContext({ viewport: { width: 320, height: 740 }, permissions: ['microphone'] });
  try {
    const elder = await context.newPage(); await elder.goto(`${origin}/#s=${family.storyteller.token}`);
    await elder.getByLabel('同意家族保存与分享说明').check(); await elder.getByRole('button', { name: '我知道了，进入说故事' }).click();
    await elder.getByRole('button', { name: '我愿意，开始说' }).click(); await expect(elder.locator('.recording-state strong')).toHaveText(/^00:0[2-9]$/);
    await elder.getByRole('button', { name: '故事目录', exact: true }).click(); await elder.getByRole('button', { name: '说一段往事', exact: true }).click();
    await expect(elder.getByRole('heading', { name: '先听一听这段草稿' })).toBeVisible();
    await elder.getByLabel('草稿试听', { exact: true }).evaluate((element) => (element as HTMLAudioElement).play());
    await expect.poll(() => elder.getByLabel('草稿试听', { exact: true }).evaluate((element) => (element as HTMLAudioElement).currentTime)).toBeGreaterThan(0.15);
    const snapshot = await (await elder.request.get('/api/session')).json(); expect(snapshot.stories).toHaveLength(0);
    await visibleAction(elder.getByRole('button', { name: '确认发送给家人' }));
    await expect(elder.getByRole('alert')).toHaveCount(0);
  } finally { await context.close(); }
});

test('提交编号无法持久化时不发送，保留草稿并明确提示存储故障', async ({ page, browser }) => {
  const family = await post(page, '/families', { name: '存储故障测试', organizerName: '测试管理者', storytellerName: '测试讲述人' });
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
        if (this.name === 'drafts' && (value as { attempted?: boolean }).attempted) throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
        return put.call(this, value, key);
      };
    });
    const elder = await context.newPage(); await elder.goto(`${origin}/#s=${family.storyteller.token}`);
    await elder.getByLabel('同意家族保存与分享说明').check(); await elder.getByRole('button', { name: '我知道了，进入说故事' }).click();
    await elder.getByRole('button', { name: '写一点', exact: true }).click(); await elder.getByLabel('想说的话').fill('仅用于合成存储故障测试。');
    await elder.getByLabel('同意保存并在家族内分享').check();
    await elder.getByRole('button', { name: '确认发送给家人' }).click();
    await expect(elder.getByRole('alert')).toContainText('还没有发往服务端');
    await expect(elder.getByLabel('想说的话')).toHaveValue('仅用于合成存储故障测试。');
    await expect(elder.locator('.draft-storage')).toContainText('尚未完全暂存');
    const snapshot = await (await elder.request.get('/api/session')).json(); expect(snapshot.stories).toHaveLength(0);
  } finally { await context.close(); }
});

test('成功提示到期清理，但真正失败不会被计时器清掉', async ({ page }) => {
  await post(page, '/families', { name: '提示时效测试', organizerName: '测试管理者', storytellerName: '测试讲述人' });
  await page.clock.install(); await page.goto('/'); await page.getByRole('button', { name: '问一件事', exact: true }).click();
  await page.getByRole('button', { name: '把这个问题送给家人' }).click(); await expect(page.getByRole('alert')).toContainText('先选一题');
  await page.clock.fastForward(10_000); await expect(page.getByRole('alert')).toContainText('先选一题');
  await page.locator('.starter-questions .question-option').first().click(); await page.getByRole('button', { name: '把这个问题送给家人' }).click();
  await expect(page.getByRole('status')).toContainText('问题已放');
  await page.clock.fastForward(6_000); await expect(page.getByRole('status')).toHaveCount(0);
});

test('管理者恢复后轮换码留在专门页面，不放入即逝成功提示', async ({ page, browser }) => {
  const family = await post(page, '/families', { name: '恢复页面测试', organizerName: '测试管理者', storytellerName: '测试讲述人' });
  const context = await browser.newContext();
  try {
    const organizer = await context.newPage(); await organizer.goto(origin);
    await organizer.getByRole('button', { name: '管理者换设备／恢复访问' }).click();
    await organizer.getByLabel('家族编号', { exact: true }).fill(family.snapshot.family.id);
    await organizer.getByLabel('管理者恢复码', { exact: true }).fill(family.recoveryCode);
    await organizer.getByRole('button', { name: '恢复管理访问' }).click();
    await expect(organizer.getByRole('heading', { name: '家族权限', exact: true })).toBeVisible();
    const code = organizer.locator('.keep-code'); await expect(code).toBeVisible();
    expect(await code.textContent()).not.toBe(family.recoveryCode); expect((await code.textContent())!.length).toBeGreaterThan(30);
    await expect(organizer.getByRole('alert')).toHaveCount(0);
    expect((await page.request.get('/api/session')).status()).toBe(401);
  } finally { await context.close(); }
});

test('同浏览器切换身份后不沿用前一身份草稿，切回才恢复自己的草稿', async ({ page }) => {
  const familyA = await post(page, '/families', { name: '草稿家族A', organizerName: '测试A', storytellerName: '测试讲述A' });
  await page.goto('/'); await page.getByRole('button', { name: '当面代录', exact: true }).click();
  await page.getByRole('button', { name: '写一点', exact: true }).click(); await page.getByLabel('想说的话').fill('A的合成私有草稿。');
  await expect(page.locator('.draft-storage')).toContainText('已暂存');
  await post(page, '/families', { name: '草稿家族B', organizerName: '测试B', storytellerName: '测试讲述B' });
  await page.getByRole('button', { name: '刷新家里消息' }).click(); await expect(page.locator('.family-strip')).toContainText('草稿家族B');
  await page.getByRole('button', { name: '当面代录', exact: true }).click(); await expect(page.getByRole('button', { name: '我愿意，开始说' })).toBeEnabled();
  await page.getByRole('button', { name: '写一点', exact: true }).click(); await expect(page.getByLabel('想说的话')).toHaveValue('');
  await page.getByRole('button', { name: '确认发送给家人' }).click(); await expect(page.getByRole('alert')).toContainText('先写一点');
  await page.getByLabel('想说的话').fill('B的合成回答。'); await page.getByLabel('同意保存并在家族内分享').check(); await page.getByRole('button', { name: '确认发送给家人' }).click(); await expect(page.getByRole('status')).toContainText('已送到');
  const snapshotB = await (await page.request.get('/api/session')).json(); expect(snapshotB.stories.map((story: { text: string }) => story.text)).toEqual(['B的合成回答。']);
  await post(page, '/organizer/recover', { familyId: familyA.snapshot.family.id, code: familyA.recoveryCode });
  await page.getByRole('button', { name: '刷新家里消息' }).click(); await expect(page.locator('.family-strip')).toContainText('草稿家族A');
  await page.getByRole('button', { name: '当面代录', exact: true }).click(); await expect(page.getByLabel('想说的话')).toHaveValue('A的合成私有草稿。');
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('本人删除等待离页录音尾段暂存完成，删除后不重新出现草稿', async ({ page, browser }) => {
  const family = await post(page, '/families', { name: '删除尾段测试', organizerName: '测试管理者', storytellerName: '测试讲述人' });
  const context = await browser.newContext({ viewport: { width: 320, height: 740 }, permissions: ['microphone'] });
  try {
    await context.addInitScript(() => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
        if (this.name === 'drafts' && (value as { mode?: string }).mode === 'audio') {
          const tx = this.transaction;
          tx.addEventListener('complete', (event) => {
            event.stopImmediatePropagation(); document.documentElement.dataset.recordingSaveHeld = 'true';
            Reflect.set(window, 'releaseRecordingSave', () => tx.oncomplete?.call(tx, event));
          }, { once: true });
        }
        return put.call(this, value, key);
      };
    });
    const elder = await context.newPage(); await elder.goto(`${origin}/#s=${family.storyteller.token}`);
    await elder.getByLabel('同意家族保存与分享说明').check(); await elder.getByRole('button', { name: '我知道了，进入说故事' }).click();
    await elder.getByRole('button', { name: '我愿意，开始说' }).click(); await expect(elder.locator('.recording-state strong')).toHaveText(/^00:0[2-9]$/);
    await elder.getByRole('button', { name: '家族权限', exact: true }).click(); await expect(elder.locator('html')).toHaveAttribute('data-recording-save-held', 'true');
    let deleteRequests = 0; elder.on('request', (request) => { if (request.url().endsWith('/api/content/mine')) deleteRequests++; });
    elder.once('dialog', (dialog) => dialog.accept()); await elder.getByRole('button', { name: '删除本人内容与本机草稿' }).click(); expect(deleteRequests).toBe(0);
    const deleted = elder.waitForResponse((response) => response.url().endsWith('/api/content/mine'));
    await elder.evaluate(() => (Reflect.get(window, 'releaseRecordingSave') as () => void)()); await deleted;
    await expect(elder.getByRole('status')).toContainText('本人内容已删除'); expect(deleteRequests).toBe(1);
    await elder.getByRole('button', { name: '说一段往事', exact: true }).click(); await expect(elder.getByRole('button', { name: '我愿意，开始说' })).toBeEnabled();
    await expect(elder.getByRole('heading', { name: '先听一听这段草稿' })).toHaveCount(0);
    const snapshot = await (await elder.request.get('/api/session')).json(); expect(snapshot.stories).toHaveLength(0);
  } finally { await context.close(); }
});
