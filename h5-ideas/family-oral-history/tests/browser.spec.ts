import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdirSync, mkdtempSync } from 'node:fs';

const origin = process.env.TEST_ORIGIN!;
const fixture = join(import.meta.dirname, '../.test-data/browser/tone.wav');
const evidenceRoot = join(import.meta.dirname, '../.test-data/site-redesign-20261118');
mkdirSync(evidenceRoot, { recursive: true });
const output = process.env.REDESIGN_EVIDENCE_DIR || mkdtempSync(join(evidenceRoot, 'browser-'));
function tone(seconds = 3) {
  const samples = 48000 * seconds;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / 48000) * 6000), 44 + i * 2);
  return wav;
}
test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
  await mkdir(join(fixture, '..'), { recursive: true });
  // The fake-microphone launch configuration uses this fixture; never overwrite prior evidence.
  await writeFile(fixture, tone(), { flag: 'wx' }).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error; });
});

async function enterElder(page: Page, link: string) {
  await page.goto(link);
  await page.getByLabel('同意家族保存与分享说明').check();
  await page.getByRole('button', { name: '我知道了，进入说故事' }).click();
  await expect(page.getByRole('button', { name: '我愿意，开始说' })).toBeVisible();
}
async function createFamily(page: Page) {
  await page.goto('/');
  await page.getByLabel('家族名', { exact: true }).fill(`合成音频测试-${Date.now()}`);
  await page.getByLabel('你的称呼', { exact: true }).fill('测试管理者');
  await page.getByLabel('讲述人的称呼').fill('测试讲述人');
  await page.getByRole('button', { name: '创建家族，保存原声' }).click();
  await expect(page.getByRole('heading', { name: '想问测试讲述人什么？' })).toBeVisible();
  await page.getByRole('button', { name: '家族权限', exact: true }).click();
  await expect(page.getByLabel('讲述人邀请链接')).toBeVisible();
  const elderLink = await page.getByLabel('讲述人邀请链接').inputValue();
  const listenerLink = await page.getByLabel('收听邀请链接').inputValue();
  const passcode = await page.locator('.passcode').textContent();
  return { elderLink, listenerLink, passcode: passcode! };
}
async function playAndVerify(page: Page, label: string) {
  const audio = page.getByLabel(label, { exact: true });
  const player = page.locator('.voice-player').filter({ has: audio });
  await player.locator('.play-button').click();
  await expect(page.getByLabel(`${label}播放位置`, { exact: true })).toBeEnabled();
  await expect.poll(() => audio.evaluate((element) => (element as HTMLAudioElement).currentTime)).toBeGreaterThan(0.15);
  await expect.poll(() => audio.evaluate((element) => (element as HTMLAudioElement).duration)).toBeGreaterThan(0.1);
  await audio.evaluate((element) => (element as HTMLAudioElement).pause());
}

test('三独立身份：提问→真实浏览器合成麦克风录音→失败恢复→试听播放→追问→续讲→导出撤销删除', async ({ page, browser }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const links = await createFamily(page);
  const elderContext = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] });
  const listenerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const elder = await elderContext.newPage(); const listener = await listenerContext.newPage();
    elder.on('pageerror', (e) => errors.push(e.message)); listener.on('pageerror', (e) => errors.push(e.message));
    await listener.goto(links.listenerLink);
    await listener.getByLabel('你的称呼', { exact: true }).fill('测试提问者');
    await listener.getByLabel('六位加入码').fill(links.passcode);
    await listener.getByLabel('同意家族保存与分享说明').check();
    await listener.getByRole('button', { name: '同意并加入家族' }).click();
    await listener.getByRole('button', { name: '问一件事', exact: true }).click();
    await listener.getByRole('button', { name: '把这个问题送给家人' }).click();
    await expect(listener.getByRole('alert')).toContainText('先选一题');
    await listener.locator('.ask-editor > summary').click();
    await listener.getByLabel('想问的问题').fill('合成测试：第一份工资买了什么？');
    await listener.getByRole('button', { name: '把这个问题送给家人' }).click();
    await expect(listener.getByRole('status')).toContainText('问题已放');
    await enterElder(elder, links.elderLink);
    await expect(elder.locator('.elder-question h1')).toContainText('第一份工资');
    await elder.evaluate(() => window.scrollTo(0, 0));
    expect(await elder.getByRole('button', { name: '我愿意，开始说' }).evaluate((element) => element.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
    await elder.screenshot({ path: join(output, 'elder.png'), fullPage: false });
    await elder.getByRole('button', { name: '我愿意，开始说' }).click();
    await expect(elder.getByRole('button', { name: '说完了，先试听' })).toBeVisible();
    await expect(elder.locator('.recording-state strong')).toHaveText(/^00:0[2-9]$/);
    await elder.getByRole('button', { name: '说完了，先试听' }).click();
    await expect(elder.getByRole('heading', { name: '先听一听这段草稿' })).toBeVisible();
    await playAndVerify(elder, '草稿试听');
    const pcmCheck = await elder.getByLabel('草稿试听', { exact: true }).evaluate(async (element) => {
      const blob = await (await fetch((element as HTMLAudioElement).src)).arrayBuffer();
      const view = new DataView(blob); let max = 0;
      for (let pos = 44; pos < blob.byteLength; pos += 2) max = Math.max(max, Math.abs(view.getInt16(pos, true)));
      return { rate: view.getUint32(24, true), max, bytes: blob.byteLength };
    });
    expect(pcmCheck.rate).toBe(16000); expect(pcmCheck.max).toBeGreaterThan(100); expect(pcmCheck.bytes).toBeGreaterThan(32_000);
    await elder.route('**/api/stories/audio', (route) => route.abort('failed'));
    await expect(elder.getByRole('button', { name: '确认发送给家人' })).toBeDisabled();
    await elder.getByLabel('同意保存并在家族内分享').check();
    await elder.getByRole('button', { name: '确认发送给家人' }).click();
    await expect(elder.getByRole('alert')).toContainText('草稿仍保留');
    await expect(elder.getByRole('heading', { name: '先听一听这段草稿' })).toBeVisible();
    await elder.unroute('**/api/stories/audio');
    await elder.reload();
    await expect(elder.getByRole('heading', { name: '先听一听这段草稿' })).toBeVisible();
    await expect(elder.getByLabel('同意保存并在家族内分享')).not.toBeChecked();
    await expect(elder.getByRole('button', { name: '确认发送给家人' })).toBeDisabled();
    await playAndVerify(elder, '草稿试听');
    await elder.getByLabel('同意保存并在家族内分享').check();
    await elder.getByRole('button', { name: '确认发送给家人' }).click();
    await expect(elder.getByRole('status')).toContainText('已送到');
    await listener.getByRole('button', { name: '刷新家里消息' }).click();
    await listener.getByRole('button', { name: '故事目录', exact: true }).click();
    await expect(listener.locator('.story-entry')).toHaveCount(1);
    await playAndVerify(listener, '故事原声');
    await listener.screenshot({ path: join(output, 'story.png'), fullPage: false });
    await listener.getByRole('button', { name: /然后呢，还想听/ }).click();
    await expect(listener.getByRole('button', { name: /1位家人想听/ })).toBeVisible();
    await listener.getByRole('button', { name: '写一个具体追问' }).click();
    await listener.getByRole('button', { name: '送去一个追问' }).click();
    await expect(listener.getByRole('alert')).toContainText('空追问不会发送');
    await listener.getByLabel('还想问什么').fill('合成测试：后来又买了什么？');
    await listener.getByRole('button', { name: '送去一个追问' }).click();
    await elder.getByRole('button', { name: '刷新家里消息' }).click();
    await expect(elder.locator('.continuation-context')).toContainText('后来又买了什么');
    await elder.getByRole('button', { name: '写一点', exact: true }).click();
    await elder.getByRole('button', { name: '确认发送给家人' }).click();
    await expect(elder.getByRole('alert')).toContainText('先写一点');
    await elder.getByLabel('想说的话').fill('这是测试文字续讲，不是真实家族资料。');
    await elder.getByLabel('同意保存并在家族内分享').check();
    await elder.getByRole('button', { name: '确认发送给家人' }).click();
    await expect(elder.getByRole('status')).toContainText('已送到');
    await listener.getByRole('button', { name: '刷新家里消息' }).click();
    await expect(listener.locator('.story-entry')).toHaveCount(2);
    await expect(listener.locator('.followup-history summary')).toContainText('已接着讲');
    await expect(listener.getByRole('button', { name: '删除这段故事' })).toHaveCount(0);
    await listener.getByRole('button', { name: '家族权限', exact: true }).click();
    const archivePromise = listener.waitForEvent('download');
    await listener.getByRole('button', { name: '导出我有权保存的内容' }).click();
    const archive = await archivePromise; expect(archive.suggestedFilename()).toContain('.json');
    await page.getByRole('button', { name: '刷新家里消息' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.members li').filter({ hasText: '测试提问者' }).getByRole('button', { name: '撤销访问' }).click();
    await expect(page.getByRole('status')).toContainText('已撤销');
    const denied = await listener.request.get('/api/session'); expect(denied.status()).toBe(401);
    await page.getByRole('button', { name: '故事目录', exact: true }).click();
    await expect(page.locator('.story-entry')).toHaveCount(2);
    page.once('dialog', (dialog) => dialog.accept());
    // Chronological entries now put the parent first; retain the parent-deletion regression.
    await page.getByRole('button', { name: '删除这段故事' }).first().click();
    await expect(page.locator('.story-entry')).toHaveCount(1);
    const parentLabel = await page.locator('.parent-label').count(); expect(parentLabel).toBe(0);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '删除这段故事' }).click();
    await expect(page.locator('.story-entry')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '尚未留下讲述' })).toBeVisible();
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: join(output, 'wall-empty.png'), fullPage: false });
  } finally { await elderContext.close(); await listenerContext.close(); }
});

test('独立浏览器麦克风权限拒绝、非法文件、文字兜底与本人删除', async ({ page, browser }) => {
  const links = await createFamily(page);
  const deniedBrowser = await browser.browserType().launch({ headless: true, executablePath: test.info().project.use.launchOptions?.executablePath, args: ['--use-fake-device-for-media-stream'] });
  const context = await deniedBrowser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const elder = await context.newPage(); await enterElder(elder, links.elderLink);
    const cdp = await context.newCDPSession(elder);
    const target = await cdp.send('Target.getTargetInfo');
    await cdp.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'denied', origin, browserContextId: target.targetInfo.browserContextId });
    await elder.getByRole('button', { name: '我愿意，开始说' }).click();
    await expect(elder.getByRole('alert')).toContainText('麦克风没有获准');
    await elder.screenshot({ path: join(output, 'permission-denied-390.png') });
    await expect(elder.getByRole('button', { name: '说完了，先试听' })).toHaveCount(0);
    await elder.getByLabel('导入录音文件').setInputFiles({ name: 'invalid.wav', mimeType: 'audio/wav', buffer: Buffer.from('not an audio file') });
    await expect(elder.getByRole('alert')).toContainText('读不出来');
    await elder.getByLabel('导入录音文件').setInputFiles({ name: 'empty.wav', mimeType: 'audio/wav', buffer: Buffer.alloc(0) });
    await expect(elder.getByRole('alert')).toContainText('非空录音');
    await elder.getByRole('button', { name: '写一点', exact: true }).click();
    await elder.getByLabel('想说的话').fill('拒绝麦克风之后的合成测试文字。');
    await elder.getByLabel('同意保存并在家族内分享').check();
    await elder.getByRole('button', { name: '确认发送给家人' }).click();
    await expect(elder.getByRole('status')).toContainText('已送到');
    await elder.getByRole('button', { name: '故事目录', exact: true }).click();
    await expect(elder.getByText('拒绝麦克风之后的合成测试文字。', { exact: true })).toBeVisible();
    await elder.getByRole('button', { name: '家族权限', exact: true }).click();
    elder.once('dialog', (dialog) => dialog.accept());
    await elder.getByRole('button', { name: '删除本人内容与本机草稿' }).click();
    await expect(elder.getByRole('status')).toContainText('本人内容已删除');
    await elder.getByRole('button', { name: '故事目录', exact: true }).click();
    await expect(elder.locator('.story-entry')).toHaveCount(0);
  } finally { await context.close(); await deniedBrowser.close(); }
});

test('同页邀请跳转、模拟页面中断不自动发送、恢复草稿、合法文件导入实际播放', async ({ page, browser }) => {
  const links = await createFamily(page);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] });
  try {
    const elder = await context.newPage(); await elder.goto(origin); await enterElder(elder, links.elderLink);
    await elder.getByRole('button', { name: '我愿意，开始说' }).click();
    await expect(elder.locator('.recording-state strong')).toHaveText(/^00:0[2-9]$/);
    await elder.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(elder.getByRole('alert')).toContainText('页面去了后台');
    await elder.screenshot({ path: join(output, 'simulated-interruption-390.png') });
    await expect(elder.getByRole('heading', { name: '先听一听这段草稿' })).toBeVisible();
    const snapshot = await (await elder.request.get('/api/session')).json(); expect(snapshot.stories).toHaveLength(0);
    await elder.reload();
    await expect(elder.getByRole('heading', { name: '先听一听这段草稿' })).toBeVisible();
    await playAndVerify(elder, '草稿试听');
    elder.once('dialog', (dialog) => dialog.accept());
    await elder.getByRole('button', { name: '放弃这次草稿' }).click();
    await elder.getByLabel('导入录音文件').setInputFiles(fixture);
    await expect(elder.getByRole('heading', { name: '先听一听这段草稿' })).toBeVisible();
    await playAndVerify(elder, '草稿试听');
    await elder.getByLabel('同意保存并在家族内分享').check();
    await elder.getByRole('button', { name: '确认发送给家人' }).click();
    await expect(elder.getByRole('status')).toContainText('已送到');
    await elder.getByRole('button', { name: '故事目录', exact: true }).click();
    await playAndVerify(elder, '故事原声');
    const audioSource = await elder.getByLabel('故事原声', { exact: true }).getAttribute('src');
    const denied = await page.request.get(audioSource!); expect(denied.status()).toBe(200);
    await context.clearCookies();
    const anonymous = await elder.request.get(audioSource!); expect(anonymous.status()).toBe(401);
    const staticFile = await page.request.get('/.local-data/archive.sqlite'); expect(staticFile.status()).toBe(403);
    const fsFile = await page.request.get('/@fs/Users/wangyong/yong/qoder/h5-ideas/family-oral-history/.local-data/archive.sqlite'); expect(fsFile.status()).toBe(403);
  } finally { await context.close(); }
});
