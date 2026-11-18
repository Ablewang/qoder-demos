import { test as base, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Ask, CreatedFamily, Snapshot, Story } from '../src/shared';

const origin = process.env.TEST_ORIGIN!;
const mobile = { width: 390, height: 844 };
const narrow = { width: 320, height: 740 };
const desktop = { width: 1100, height: 850 };
const consentLabel = '同意保存并在家族内分享';
const sendName = '确认发送给家人';
type Viewport = typeof mobile;
type Archive = {
  version: number;
  family: Snapshot['family'];
  member: Snapshot['member'];
  stories: (Story & { audioBase64?: string })[];
  asks: Ask[];
  followups: { id: string; storyId: string; memberId: string; text: string; answered: boolean }[];
};

// No visual/session fixtures: each actor has separate cookies and IndexedDB, using the real /api.
const test = base.extend<{
  actor: (viewport: Viewport) => Promise<Page>;
  evidence: string;
}>({
  actor: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (viewport) => {
      const context = await browser.newContext({ baseURL: origin, viewport });
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
  evidence: async ({}, use) => {
    const parent = join(process.env.REDESIGN_EVIDENCE_DIR || join(import.meta.dirname, '../.test-data/site-redesign-20261118'), 'redesign');
    await mkdir(parent, { recursive: true });
    // A unique directory per test/run preserves previously captured screenshots.
    await use(await mkdtemp(join(parent, 'run-')));
  },
});

function syntheticTone(seconds = 2) {
  const rate = 16000;
  const samples = rate * seconds;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / rate) * 6000), 44 + i * 2);
  return wav;
}
async function post<T>(page: Page, path: string, data: unknown): Promise<T> {
  const response = await page.request.post(`/api${path}`, { data, headers: { Origin: origin } });
  expect(response.ok()).toBe(true);
  return response.json();
}
async function snapshot(page: Page): Promise<Snapshot> {
  const response = await page.request.get('/api/session');
  expect(response.status()).toBe(200);
  return response.json();
}
async function capture(page: Page, evidence: string, view: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: join(evidence, `${view}-${page.viewportSize()!.width}.png`), fullPage: false });
}
async function hitTest(locator: Locator) {
  await expect(locator).toBeVisible();
  expect(await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth
      && element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
  })).toBe(true);
}
async function createFamily(page: Page): Promise<CreatedFamily> {
  await page.goto('/');
  await page.getByLabel('家族名', { exact: true }).fill(`虚构改版-${randomUUID().slice(0, 8)}`);
  await page.getByLabel('你的称呼', { exact: true }).fill('合成管理者');
  await page.getByLabel('讲述人的称呼').fill('合成讲述人');
  const created = page.waitForResponse((response) => response.url().endsWith('/api/families') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '创建家族，保存原声' }).click();
  const response = await created; expect(response.status()).toBe(201);
  const family: CreatedFamily = await response.json();
  await expect(page.getByRole('heading', { name: '想问合成讲述人什么？' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '家族权限', exact: true })).toHaveCount(0);
  await expect(page.locator('.keep-code')).toHaveText(family.recoveryCode);
  await expect(page.locator('.keep-family-id')).toHaveText(family.snapshot.family.id);
  await page.getByRole('button', { name: '家族权限', exact: true }).click();
  await expect(page.getByLabel('讲述人邀请链接')).toHaveValue(`${origin}/#s=${family.storyteller.token}`);
  await expect(page.getByLabel('收听邀请链接')).toHaveValue(`${origin}/#j=${family.invite.token}`);
  await expect(page.locator('.keep-code')).toHaveText(family.recoveryCode);
  expect((await snapshot(page)).member.role).toBe('organizer');
  return family;
}
for (const screen of [
  { viewport: narrow, root: 17 }, { viewport: mobile, root: 17 },
  { viewport: { width: 1280, height: 800 }, root: 17 },
  { viewport: narrow, root: 22.1 }, { viewport: mobile, root: 22.1 },
]) {
  test(`${screen.viewport.width} root${screen.root}：首问直达、恢复信息保管与知情代录续讲`, async ({ actor, evidence }) => {
    const page = await actor(screen.viewport); await rootFont(page, screen.root);
    const family = await createFamily(page);
    await page.getByRole('button', { name: '问一件事', exact: true }).click();
    await expect(page.getByLabel('想问的问题')).toBeHidden();
    await expect(page.locator('.keep-code')).toHaveText(family.recoveryCode);
    await expect(page.locator('.keep-family-id')).toHaveText(family.snapshot.family.id);
    expect(await page.locator('.keep-values dd').evaluateAll((elements) => elements.every((el) => el.scrollWidth <= el.clientWidth + 1))).toBe(true);
    await page.getByRole('button', { name: '记好了，先收起' }).click();
    await expect(page.getByRole('button', { name: '再看一次' })).toBeFocused();
    await page.getByRole('button', { name: '再看一次' }).click();
    await expect(page.getByRole('button', { name: '记好了，先收起' })).toBeFocused();
    await expect(page.locator('.keep-code')).toHaveText(family.recoveryCode);
    await capture(page, evidence, 'first-question-keep');
    const first = page.locator('.starter-questions .question-option').first();
    await first.click(); await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.ask-editor')).not.toHaveAttribute('open');
    await expect(page.locator('.question-library')).not.toHaveAttribute('open');
    const asked = page.waitForResponse((response) => response.url().endsWith('/api/asks') && response.request().method() === 'POST');
    await page.getByRole('button', { name: '把这个问题送给家人' }).click();
    const response = await asked; expect(response.status()).toBe(201);
    const ask: Ask = await response.json(); expect(ask.depth).toBe('gentle'); expect(ask.stage).toBe('童年');
    await expect(page.getByRole('status')).toContainText('问题已放');
    await page.getByRole('button', { name: '在合成讲述人身边？去当面代录' }).click();
    await expect(page.locator('.elder-question h1')).toHaveText(ask.text);
    await expect(page.locator('.proxy-note')).toContainText('先征得合成讲述人同意');
    await page.getByRole('button', { name: '写一点', exact: true }).click();
    await page.getByLabel('想说的话').fill('全新虚构首段：小时候想当火车司机。');
    const parent = await sendDraft(page, 'text');
    expect(parent.askId).toBe(ask.id); expect(parent.recordedById).toBe(family.snapshot.member.id);
    await page.getByRole('button', { name: '故事目录', exact: true }).click();
    await expect(entry(page, parent).locator('.story-meta')).toContainText('合成管理者问');
    await expect(entry(page, parent).locator('.story-attribution')).toHaveText('合成讲述人 · 亲述文字 · 童年 · 合成管理者知情代录');
    await entry(page, parent).getByRole('button', { name: '写一个具体追问' }).click();
    await entry(page, parent).getByLabel('还想问什么').fill('虚构追问：后来坐上火车了吗？');
    await entry(page, parent).getByRole('button', { name: '送去一个追问' }).click();
    await expect(page.getByRole('status')).toContainText('追问已送去');
    await page.getByRole('button', { name: '当面代录', exact: true }).click();
    await expect(page.locator('.elder-question h1')).toHaveText('虚构追问：后来坐上火车了吗？');
    await expect(page.locator('.continuation-context')).toContainText(ask.text);
    await page.getByRole('button', { name: '写一点', exact: true }).click();
    await page.getByLabel('想说的话').fill('全新虚构续讲：长大后坐火车去过海边。');
    const child = await sendDraft(page, 'text'); expect(child.parentStoryId).toBe(parent.id);
    await page.getByRole('button', { name: '故事目录', exact: true }).click();
    await assertTree(page, [parent, child]); await capture(page, evidence, 'first-story-continuation');
    await page.reload(); await expect(page.getByRole('heading', { name: '合成讲述人的讲述', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '家族权限', exact: true }).click();
    await expect(page.locator('.keep-code')).toHaveCount(0);
  });
}

test('次级自写保留阶段深浅语义，复制拒绝或接口缺失不丢恢复信息', async ({ actor }) => {
  const page = await actor(mobile); const family = await createFamily(page);
  await page.getByRole('button', { name: '问一件事', exact: true }).click();
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { Reflect.set(window, 'copiedRecovery', text); } } }));
  await page.getByRole('button', { name: '复制这两项' }).click();
  await expect(page.getByRole('status')).toContainText('请存在只有你能看的地方');
  expect(await page.evaluate(() => Reflect.get(window, 'copiedRecovery'))).toBe(`家族编号：${family.snapshot.family.id}\n管理者恢复码：${family.recoveryCode}`);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new DOMException('Synthetic denial', 'NotAllowedError'); } } }));
  await page.getByRole('button', { name: '复制这两项' }).click();
  await expect(page.getByRole('alert')).toContainText('请长按上面的编号和恢复码');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await page.getByRole('button', { name: '复制这两项' }).click();
  await expect(page.getByRole('alert')).toContainText('请长按上面的编号和恢复码');
  await expect(page.locator('.keep-code')).toHaveText(family.recoveryCode);
  await page.locator('.question-library > summary').click();
  await page.getByLabel('按阶段翻题').selectOption('心里话');
  await expect(page.locator('.question-library')).toContainText('这个阶段还没有现成的题');
  await expect(page.locator('.starter-questions .question-option')).toHaveCount(6);
  await page.locator('.ask-editor > summary').click();
  await page.getByLabel('想问的问题').fill('全新虚构自写：第一次离家时在想什么？');
  await page.getByLabel('问题阶段').selectOption('恋爱结婚');
  await page.locator('.ask-editor input[type=checkbox]').check();
  const asked = page.waitForResponse((response) => response.url().endsWith('/api/asks') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '把这个问题送给家人' }).click();
  const response = await asked; expect(response.status()).toBe(201);
  const ask: Ask = await response.json(); expect(ask.stage).toBe('恋爱结婚'); expect(ask.depth).toBe('deep');
});

async function joinListener(page: Page, family: CreatedFamily, name = '合成提问者') {
  await page.goto(`/#j=${family.invite.token}`);
  await page.getByLabel('你的称呼', { exact: true }).fill(name);
  await page.getByLabel('六位加入码').fill(family.invite.passcode!);
  await page.getByLabel('同意家族保存与分享说明').check();
  await page.getByRole('button', { name: '同意并加入家族' }).click();
  await expect(page.getByRole('button', { name: '故事目录', exact: true })).toBeVisible();
  expect((await snapshot(page)).member.role).toBe('listener');
}
async function joinStoryteller(page: Page, family: CreatedFamily) {
  await page.goto(`/#s=${family.storyteller.token}`);
  await page.getByLabel('同意家族保存与分享说明').check();
  await page.getByRole('button', { name: '我知道了，进入说故事' }).click();
  await expect(page.getByRole('button', { name: '我愿意，开始说' })).toBeEnabled();
  expect((await snapshot(page)).member.role).toBe('storyteller');
}
async function refresh(page: Page) {
  const loaded = page.waitForResponse((response) => response.url().endsWith('/api/session'));
  await page.getByRole('button', { name: '刷新家里消息' }).click();
  expect((await loaded).status()).toBe(200);
}
async function askQuestion(page: Page, text: string, stage: string): Promise<Ask> {
  await page.getByRole('button', { name: '问一件事', exact: true }).click();
  await page.locator('.ask-editor > summary').click();
  await page.getByLabel('问题阶段').selectOption(stage);
  await page.getByLabel('想问的问题').fill(text);
  const asked = page.waitForResponse((response) => response.url().endsWith('/api/asks') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '把这个问题送给家人' }).click();
  const response = await asked; expect(response.status()).toBe(201);
  await expect(page.getByRole('status')).toContainText('问题已放');
  return response.json();
}
function entry(page: Page, story: Story) {
  return page.locator(`.story-entry[data-story-id="${story.id}"]`);
}
async function playAndSeek(scope: Page | Locator, label: string) {
  const audio = scope.getByLabel(label, { exact: true });
  const player = scope.locator(`.voice-player:has(audio[aria-label="${label}"])`);
  await player.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await hitTest(player.locator('.play-button'));
  await player.locator('.play-button').click();
  await expect.poll(() => audio.evaluate((element) => (element as HTMLAudioElement).currentTime)).toBeGreaterThan(0.1);
  await expect.poll(() => audio.evaluate((element) => (element as HTMLAudioElement).duration)).toBeGreaterThan(1);
  const slider = scope.getByLabel(`${label}播放位置`, { exact: true });
  await expect(slider).toBeEnabled();
  await hitTest(slider);
  await audio.evaluate((element) => (element as HTMLAudioElement).pause());
  // Exercise the custom range control rather than assigning audio.currentTime directly.
  await slider.focus(); await slider.press('Home');
  await expect.poll(() => audio.evaluate((element) => (element as HTMLAudioElement).currentTime)).toBeLessThan(0.05);
  await slider.press('ArrowRight');
  await expect.poll(() => audio.evaluate((element) => (element as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
  expect(await audio.evaluate((element) => (element as HTMLAudioElement).currentTime)).toBeCloseTo(Number(await slider.inputValue()), 1);
}
async function importTone(page: Page) {
  await expect(page.getByRole('button', { name: '我愿意，开始说' })).toBeEnabled();
  await page.locator('.import-option > summary').click();
  await page.getByLabel('导入录音文件').setInputFiles({ name: 'redesign-synthetic.wav', mimeType: 'audio/wav', buffer: syntheticTone() });
  await expect(page.getByRole('heading', { name: '先听一听这段草稿' })).toBeVisible();
  await expect(page.getByLabel(consentLabel)).not.toBeChecked();
  await expect(page.getByRole('button', { name: sendName })).toBeDisabled();
  const player = page.locator('.voice-player').filter({ has: page.getByLabel('草稿试听', { exact: true }) });
  expect(await player.locator('xpath=ancestor::*[contains(@class,"action-bar")]').count()).toBe(0);
  await expect(page.locator('.action-bar .voice-player')).toHaveCount(0);
  await playAndSeek(page, '草稿试听');
}
async function sendDraft(page: Page, type: 'text' | 'audio'): Promise<Story> {
  await expect(page.getByLabel(consentLabel)).not.toBeChecked();
  await expect(page.getByRole('button', { name: sendName })).toBeDisabled();
  await page.getByLabel(consentLabel).check();
  await expect(page.getByRole('button', { name: sendName })).toBeEnabled();
  const sent = page.waitForResponse((response) => response.url().endsWith(`/api/stories/${type}`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: sendName }).click();
  const response = await sent; expect(response.status()).toBe(201);
  await expect(page.getByRole('status')).toContainText('已送到');
  return response.json();
}
async function assertTree(page: Page, stories: Story[]) {
  const ids = await page.locator('.story-entry').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-story-id')));
  expect(ids).toHaveLength(stories.length);
  expect(new Set(ids)).toEqual(new Set(stories.map((story) => story.id)));
  for (const story of stories) {
    const parent = stories.find((candidate) => candidate.id === story.parentStoryId);
    const depth = (current: Story): number => {
      const ancestor = stories.find((candidate) => candidate.id === current.parentStoryId);
      return ancestor ? depth(ancestor) + 1 : 0;
    };
    await expect(entry(page, story)).toHaveAttribute('data-depth', String(depth(story)));
    if (parent) {
      expect(ids.indexOf(parent.id)).toBeLessThan(ids.indexOf(story.id));
      await expect(entry(page, story)).toHaveAttribute('data-parent-id', parent.id);
      await expect(entry(page, story).locator('.parent-label')).toContainText(parent.question);
    }
  }
  const roots = stories.filter((story) => !story.parentStoryId);
  const chronologicalRoots = [...roots].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  expect(ids.filter((id) => roots.some((story) => story.id === id))).toEqual(chronologicalRoots.map((story) => story.id));
}
async function downloadArchive(page: Page): Promise<Archive> {
  await page.getByRole('button', { name: '家族权限', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出我有权保存的内容' }).click();
  const file = await download; expect(file.suggestedFilename()).toMatch(/\.json$/);
  const stream = await file.createReadStream(); expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const archive: Archive = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(archive.version).toBe(1);
  expect(archive.family.id).toBe((await snapshot(page)).family.id);
  return archive;
}

// Four coherent flows, not a viewport × role matrix.
test('390：创建、双身份加入、跳题、独立原声与文字、真实追问原声续讲闭环', async ({ actor, evidence }) => {
  const organizer = await actor(mobile); const family = await createFamily(organizer);
  await capture(organizer, evidence, 'creation-permissions');
  const listener = await actor(mobile); const elder = await actor(mobile);
  await joinListener(listener, family); await joinStoryteller(elder, family);
  expect((await snapshot(listener)).member.id).not.toBe((await snapshot(elder)).member.id);
  const skipped = await askQuestion(listener, '合成问题：这题可以不回答吗？', '童年');
  await refresh(elder); await expect(elder.locator('.elder-question h1')).toHaveText(skipped.text);
  await hitTest(elder.getByRole('button', { name: '我愿意，开始说' }));
  expect(await elder.locator('.action-bar').evaluate((element) => getComputedStyle(element).position)).toBe('fixed');
  await capture(elder, evidence, 'question-idle');
  await elder.getByRole('button', { name: '这题不想说，跳过' }).click();
  await expect(elder.getByRole('status')).toContainText('已跳过');
  expect((await snapshot(elder)).asks.find((ask) => ask.id === skipped.id)?.status).toBe('skipped');
  expect((await snapshot(elder)).stories).toHaveLength(0);

  await importTone(elder); await capture(elder, evidence, 'inline-audio-draft');
  const parent = await sendDraft(elder, 'audio');
  expect(parent).toMatchObject({ type: 'audio', askId: null, parentStoryId: null });
  await elder.getByRole('button', { name: '写一点', exact: true }).click();
  await elder.getByRole('button', { name: sendName }).click();
  await expect(elder.getByRole('alert')).toContainText('先写一点');
  const longText = '这是一段完全虚构的长文字，只用于检验故事展开，不包含真实家族资料。'.repeat(24) + '结尾标记：合成往事的最后一句。';
  await elder.getByLabel('想说的话').fill(longText);
  const independentText = await sendDraft(elder, 'text');
  expect(independentText).toMatchObject({ type: 'text', askId: null, parentStoryId: null, text: longText });
  await refresh(listener); await listener.getByRole('button', { name: '故事目录', exact: true }).click();
  await assertTree(listener, (await snapshot(listener)).stories);
  await playAndSeek(entry(listener, parent), '故事原声');
  const textEntry = entry(listener, independentText);
  const fullText = textEntry.locator('.story-fulltext');
  await expect(fullText).not.toHaveAttribute('open', '');
  await expect(fullText.locator('.story-text')).toBeHidden();
  await fullText.locator('summary').filter({ hasText: '展开讲述全文' }).click();
  await expect(fullText).toHaveAttribute('open', '');
  await expect(fullText.locator('.story-text')).toHaveText(longText);
  await expect(fullText.locator('.story-text')).toBeVisible();
  await fullText.locator('summary').click();
  await expect(fullText.locator('.story-text')).toBeHidden();
  await fullText.locator('summary').click();
  await capture(listener, evidence, 'expanded-text-directory');
  await entry(listener, parent).getByRole('button', { name: /然后呢，还想听/ }).click();
  await entry(listener, parent).getByRole('button', { name: '写一个具体追问' }).click();
  await entry(listener, parent).getByLabel('还想问什么').fill('合成追问：接下来的那一天呢？');
  await entry(listener, parent).getByRole('button', { name: '送去一个追问' }).click();
  await expect(listener.getByRole('status')).toContainText('追问已送去');
  const pending = (await snapshot(elder)).asks.filter((ask) => ask.status === 'pending' && ask.parentStoryId === parent.id);
  expect(pending).toHaveLength(1); expect(pending[0].followupIds).toHaveLength(1);
  await refresh(elder); await expect(elder.locator('.continuation-context')).toContainText('接下来的那一天');
  await expect(elder.getByRole('heading', { level: 1 })).toHaveText('合成追问：接下来的那一天呢？');
  await expect(elder.locator('.continuation-context')).toHaveAttribute('open', '');
  await elder.getByRole('button', { name: '说一段', exact: true }).click();
  await importTone(elder);
  await expect(elder.locator('.continuation-context')).not.toHaveAttribute('open', '');
  await elder.locator('.continuation-context > summary').click();
  await expect(elder.locator('.continuation-context')).toHaveAttribute('open', '');
  await expect(elder.locator('.continuation-context')).toContainText(parent.question);
  await elder.locator('.continuation-context > summary').click();
  const child = await sendDraft(elder, 'audio');
  expect(child).toMatchObject({ parentStoryId: parent.id, askId: pending[0].id, type: 'audio' });
  const final = await snapshot(elder);
  expect(final.stories).toHaveLength(3);
  expect(final.asks.find((ask) => ask.id === pending[0].id)?.status).toBe('answered');
  expect(final.stories.find((story) => story.id === parent.id)?.followups.every((followup) => followup.answered)).toBe(true);
  expect(final.asks.filter((ask) => ask.status === 'pending' && ask.parentStoryId === parent.id)).toHaveLength(0);
  await refresh(listener); await assertTree(listener, final.stories);
  expect(await listener.locator('.story-entry').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-story-id')))).toEqual([parent.id, child.id, independentText.id]);
  await expect(entry(listener, parent).locator('.followup-history summary')).toContainText('已接着讲');
  await expect(listener.getByRole('button', { name: '删除这段故事' })).toHaveCount(0);
  await capture(listener, evidence, 'continuation-directory');
});

test('320：知情代录、同意重置和试听就绪门禁、1.25倍字号与命中、跨阶段上下文及删除父段', async ({ actor, evidence }) => {
  const organizer = await actor(narrow); const family = await createFamily(organizer);
  await organizer.getByRole('button', { name: '当面代录', exact: true }).click();
  await expect(organizer.locator('.answer-box')).toContainText('知情当面代录');
  const defaultFonts = await organizer.locator('.elder-question h1').evaluate((element) => ({ question: parseFloat(getComputedStyle(element).fontSize), root: parseFloat(getComputedStyle(document.documentElement).fontSize) }));
  await organizer.evaluate((root) => { document.documentElement.style.fontSize = `${root * 1.25}px`; }, defaultFonts.root);
  const fonts = await organizer.locator('.elder-question h1').evaluate((element) => ({ question: parseFloat(getComputedStyle(element).fontSize), root: parseFloat(getComputedStyle(document.documentElement).fontSize) }));
  expect(fonts.root).toBeCloseTo(defaultFonts.root * 1.25, 1);
  expect(fonts.question).toBeCloseTo(defaultFonts.question * 1.25, 1);
  await hitTest(organizer.getByRole('button', { name: '我愿意，开始说' }));
  await capture(organizer, evidence, 'proxy-large-text-idle');
  await organizer.getByRole('button', { name: '写一点', exact: true }).click();
  await organizer.getByRole('button', { name: sendName }).click();
  await expect(organizer.getByRole('alert')).toContainText('先写一点');
  await organizer.getByLabel('想说的话').fill('虚构的管理者知情代录父段。');
  await expect(organizer.getByRole('button', { name: sendName })).toBeDisabled();
  await organizer.getByLabel(consentLabel).check();
  await expect(organizer.locator('.draft-storage')).toContainText('已暂存');
  await organizer.reload();
  await organizer.getByRole('button', { name: '当面代录', exact: true }).click();
  await expect(organizer.getByLabel('想说的话')).toHaveValue('虚构的管理者知情代录父段。');
  const parent = await sendDraft(organizer, 'text');
  expect(parent.recordedById).toBe(family.snapshot.member.id);
  expect(parent.storytellerId).not.toBe(parent.recordedById);

  // A real cross-stage continuation exposes whether the select drops its ancestor context.
  const continuation = await post<Ask>(organizer, '/asks', { text: '合成跨阶段：后来工作时呢？', stage: '工作', depth: 'gentle', parentStoryId: parent.id });
  await refresh(organizer);
  await organizer.getByRole('button', { name: '说一段', exact: true }).click();
  await importTone(organizer);
  const preview = organizer.getByLabel('草稿试听', { exact: true });
  await organizer.getByLabel(consentLabel).check();
  await expect(organizer.getByRole('button', { name: sendName })).toBeEnabled();
  // Real playable bytes already exist; dispatching a media failure tests the readiness gate, not an API fixture.
  await preview.evaluate((element) => element.dispatchEvent(new Event('error')));
  await expect(organizer.getByRole('button', { name: sendName })).toBeDisabled();
  expect((await snapshot(organizer)).stories).toHaveLength(1);
  await organizer.reload();
  await organizer.getByRole('button', { name: '当面代录', exact: true }).click();
  await expect(organizer.getByRole('heading', { name: '先听一听这段草稿' })).toBeVisible();
  await expect(organizer.getByLabel(consentLabel)).not.toBeChecked();
  await playAndSeek(organizer, '草稿试听');
  await hitTest(organizer.getByLabel(consentLabel));
  await hitTest(organizer.getByRole('button', { name: sendName }));
  await capture(organizer, evidence, 'proxy-inline-preview');
  const child = await sendDraft(organizer, 'audio');
  expect(child).toMatchObject({ parentStoryId: parent.id, askId: continuation.id, stage: '工作', recordedById: family.snapshot.member.id });
  const elder = await actor(narrow); await joinStoryteller(elder, family);
  await elder.getByRole('button', { name: '故事目录', exact: true }).click();
  await assertTree(elder, (await snapshot(elder)).stories);
  await expect(entry(elder, child)).toContainText('知情代录');
  await organizer.getByRole('button', { name: '故事目录', exact: true }).click();
  await organizer.getByLabel('筛选故事阶段').selectOption('工作');
  await assertTree(organizer, [parent, child]);
  await expect(entry(organizer, parent)).toContainText('心里话');
  await capture(organizer, evidence, 'filtered-parent-context');
  organizer.once('dialog', (dialog) => dialog.accept());
  await entry(organizer, parent).getByRole('button', { name: '删除这段故事' }).click();
  await expect(entry(organizer, parent)).toHaveCount(0);
  await expect(entry(organizer, child)).toHaveAttribute('data-depth', '0');
  await expect(entry(organizer, child)).toHaveAttribute('data-parent-id', '');
  await expect(entry(organizer, child).locator('.parent-label')).toHaveCount(0);
  const detached = await snapshot(organizer);
  expect(detached.stories).toHaveLength(1);
  expect(detached.stories[0]).toMatchObject({ id: child.id, parentStoryId: null });
  expect(detached.asks.find((ask) => ask.id === continuation.id)?.parentStoryId).toBeNull();
  await playAndSeek(entry(organizer, child), '故事原声');
  await capture(organizer, evidence, 'detached-child-directory');
});

test('1100：JSON按身份导出、收听人不可删、撤销原声GET／HEAD／Range与恢复码轮换', async ({ actor, evidence }) => {
  const organizer = await actor(desktop); const family = await createFamily(organizer);
  const listener = await actor(desktop); const elder = await actor(desktop); const other = await actor(desktop);
  await joinListener(listener, family); await joinListener(other, family, '另一个合成家人'); await joinStoryteller(elder, family);
  const ownAsk = await askQuestion(listener, '合成工作问题：第一份工资呢？', '工作');
  const otherAsk = await askQuestion(other, '合成童年问题：小时候的游戏呢？', '童年');
  await capture(other, evidence, 'custom-question');
  await refresh(organizer); await organizer.getByRole('button', { name: '当面代录', exact: true }).click();
  await organizer.getByLabel('选择待回答问题').selectOption(ownAsk.id);
  await importTone(organizer); const audio = await sendDraft(organizer, 'audio');
  await capture(organizer, evidence, 'proxy-answer');
  await organizer.getByRole('button', { name: '写一点', exact: true }).click();
  await organizer.getByLabel('想说的话').fill('桌面合成童年答案。');
  const text = await sendDraft(organizer, 'text'); expect(text.askId).toBe(otherAsk.id);
  await refresh(listener); await listener.getByRole('button', { name: '故事目录', exact: true }).click();
  await expect(listener.getByRole('button', { name: '删除这段故事' })).toHaveCount(0);
  const forbidden = await listener.request.delete(`/api/stories/${audio.id}`, { headers: { Origin: origin } });
  expect(forbidden.status()).toBe(404);
  expect((await snapshot(organizer)).stories).toHaveLength(2);
  await entry(listener, audio).getByRole('button', { name: '写一个具体追问' }).click();
  await entry(listener, audio).getByLabel('还想问什么').fill('只属于这个合成收听人的追问。');
  await entry(listener, audio).getByRole('button', { name: '送去一个追问' }).click();
  await expect(listener.getByRole('status')).toContainText('追问已送去');
  await post(other, `/stories/${audio.id}/followups`, { text: '另一个合成家人的私有追问。' });
  await capture(listener, evidence, 'listener-directory');

  const listenerArchive = await downloadArchive(listener);
  expect(listenerArchive.member.role).toBe('listener'); expect(listenerArchive.stories).toEqual([]);
  expect(listenerArchive.asks.map((ask) => ask.id)).toContain(ownAsk.id);
  expect(listenerArchive.asks.map((ask) => ask.id)).not.toContain(otherAsk.id);
  expect(listenerArchive.asks.every((ask) => ask.askedBy === listenerArchive.member.id)).toBe(true);
  expect(listenerArchive.followups).toHaveLength(1);
  expect(listenerArchive.followups.every((followup) => followup.memberId === listenerArchive.member.id)).toBe(true);
  expect(new Set(listenerArchive.asks.flatMap((ask) => ask.followupIds))).toEqual(new Set(listenerArchive.followups.map((followup) => followup.id)));
  const elderArchive = await downloadArchive(elder); const organizerArchive = await downloadArchive(organizer);
  for (const archive of [elderArchive, organizerArchive]) {
    expect(new Set(archive.stories.map((story) => story.id))).toEqual(new Set([audio.id, text.id]));
    expect(archive.followups).toHaveLength(2);
    const exportedAudio = archive.stories.find((story) => story.id === audio.id)!;
    expect(Buffer.from(exportedAudio.audioBase64!, 'base64')).toEqual(syntheticTone());
    expect(archive.stories.find((story) => story.id === text.id)?.audioBase64).toBeUndefined();
  }
  expect(elderArchive.stories.every((story) => story.storytellerId === elderArchive.member.id)).toBe(true);
  expect(elderArchive.asks.map((ask) => ask.id).sort()).toEqual([ownAsk.id, otherAsk.id].sort());
  expect(organizerArchive.asks.length).toBeGreaterThan(elderArchive.asks.length);
  await capture(organizer, evidence, 'organizer-permissions');

  const source = `/api/stories/${audio.id}/audio`;
  const get = await listener.request.get(source); expect(get.status()).toBe(200); expect(await get.body()).toEqual(syntheticTone());
  const head = await listener.request.head(source); expect(head.status()).toBe(200); expect(await head.body()).toHaveLength(0);
  expect(head.headers()['content-length']).toBe(String(syntheticTone().length));
  const range = await listener.request.get(source, { headers: { Range: 'bytes=0-43' } });
  expect(range.status()).toBe(206); expect(await range.body()).toEqual(syntheticTone().subarray(0, 44));
  expect(range.headers()['content-range']).toBe(`bytes 0-43/${syntheticTone().length}`);
  const listenerId = listenerArchive.member.id;
  await refresh(organizer); organizer.once('dialog', (dialog) => dialog.accept());
  await organizer.locator('.members li').filter({ hasText: '合成提问者' }).getByRole('button', { name: '撤销访问' }).click();
  await expect(organizer.getByRole('status')).toContainText('已撤销');
  expect((await snapshot(organizer)).members.find((member) => member.id === listenerId)?.revoked).toBe(true);
  for (const request of [
    () => listener.request.get(source),
    () => listener.request.head(source),
    () => listener.request.get(source, { headers: { Range: 'bytes=0-43' } }),
    () => listener.request.head(source, { headers: { Range: 'bytes=0-43' } }),
  ]) { const denied = await request(); expect(denied.status()).toBe(401); expect(denied.headers()['cache-control']).toContain('no-store'); }
  expect((await listener.request.get('/api/export')).status()).toBe(401);
  expect((await other.request.get(source)).status()).toBe(200);
  const staleInvite = await listener.request.post('/api/join', { data: { token: family.invite.token, passcode: family.invite.passcode, name: '不可重新加入的合成身份' }, headers: { Origin: origin } });
  expect(staleInvite.status()).toBe(404);

  const recovered = await actor(desktop); await recovered.goto('/');
  await recovered.getByRole('button', { name: '管理者换设备／恢复访问' }).click();
  await recovered.getByLabel('家族编号', { exact: true }).fill(family.snapshot.family.id);
  await recovered.getByLabel('管理者恢复码', { exact: true }).fill(family.recoveryCode);
  await recovered.getByRole('button', { name: '恢复管理访问' }).click();
  await expect(recovered.getByRole('heading', { name: '家族权限', exact: true })).toBeVisible();
  const rotated = (await recovered.locator('.keep-code').textContent())!;
  expect(rotated).not.toBe(family.recoveryCode); expect(rotated).toHaveLength(43);
  expect((await organizer.request.get('/api/session')).status()).toBe(401);
  const reused = await organizer.request.post('/api/organizer/recover', { data: { familyId: family.snapshot.family.id, code: family.recoveryCode }, headers: { Origin: origin } });
  expect(reused.status()).toBe(404);
  expect((await snapshot(recovered)).stories).toHaveLength(2);
  await capture(recovered, evidence, 'recovery-rotation');
});

test('390：服务端已提交但响应丢失，重载按原提交号核对且不重复发送', async ({ actor, evidence }) => {
  const organizer = await actor(mobile); const family = await createFamily(organizer);
  const elder = await actor(mobile); await joinStoryteller(elder, family);
  await elder.getByRole('button', { name: '写一点', exact: true }).click();
  const text = '只用于响应丢失核对的合成文字。';
  await elder.getByLabel('想说的话').fill(text);
  await elder.getByLabel(consentLabel).check();
  let submissionId = ''; let uploads = 0;
  await elder.route('**/api/stories/text', async (route) => {
    uploads++;
    submissionId = route.request().postDataJSON().submissionId;
    const response = await route.fetch(); expect(response.status()).toBe(201);
    // Commit the real backend request, then drop only its browser response.
    await route.abort('failed');
  });
  await elder.getByRole('button', { name: sendName }).click();
  await expect(elder.getByRole('alert')).toContainText('草稿仍保留');
  await expect(elder.getByLabel('想说的话')).toHaveValue(text);
  expect(submissionId).toMatch(/^[0-9a-f-]{36}$/);
  const stored = await snapshot(elder); expect(stored.stories).toHaveLength(1);
  expect(stored.stories[0].text).toBe(text);
  const reconciled = await elder.request.get(`/api/submissions/${submissionId}`);
  expect(reconciled.status()).toBe(200);
  expect((await reconciled.json()).story.id).toBe(stored.stories[0].id);
  const foreignSubmission = await organizer.request.get(`/api/submissions/${submissionId}`);
  expect((await foreignSubmission.json()).story).toBeNull();
  await capture(elder, evidence, 'lost-response-draft');
  await elder.reload();
  await expect(elder.locator('.draft-storage')).toHaveCount(0);
  await expect(elder.getByRole('status')).toContainText('上次发送已成功');
  expect(uploads).toBe(1); expect((await snapshot(elder)).stories).toHaveLength(1);
  await elder.unroute('**/api/stories/text');
  // New draft must require fresh consent, even after a previously checked successful submission.
  await elder.getByRole('button', { name: '写一点', exact: true }).click();
  await elder.getByLabel('想说的话').fill('第二份未发送的合成草稿。');
  await expect(elder.getByLabel(consentLabel)).not.toBeChecked();
  await expect(elder.getByRole('button', { name: sendName })).toBeDisabled();
  expect((await snapshot(elder)).stories).toHaveLength(1);
  await capture(elder, evidence, 'new-draft-consent-reset');
});

async function rootFont(page: Page, size: number) {
  await page.context().addInitScript({ content: `(function(){function a(){if(!document.documentElement)return false;document.documentElement.style.fontSize='${size}px';return true}if(!a()){var o=new MutationObserver(function(){if(a())o.disconnect()});o.observe(document,{childList:true})}})();` });
}
async function barState(page: Page) {
  return page.locator('.action-bar').evaluate((bar) => ({ position: getComputedStyle(bar).position, share: bar.getBoundingClientRect().height / innerHeight }));
}
async function renderedLines(locator: Locator) {
  return locator.evaluate((element) => {
    const rows: { top: number; text: string }[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (let i = 0; i < node.textContent!.length; i++) {
        const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
        const rect = range.getClientRects()[0]; if (!rect) continue;
        const row = rows.find((item) => Math.abs(item.top - rect.top) < rect.height / 2);
        if (row) row.text += node.textContent![i]; else rows.push({ top: rect.top, text: node.textContent![i] });
      }
    }
    return rows.sort((a, b) => a.top - b.top).map((row) => row.text);
  });
}

test('320大字号底栏回到文档流；1280删除与追问分开', async ({ actor, evidence }) => {
  const elder = await actor(narrow); await rootFont(elder, 26);
  const organizer = await actor({ width: 1280, height: 800 }); const family = await createFamily(organizer);
  await joinStoryteller(elder, family);
  await elder.getByRole('button', { name: '写一点', exact: true }).click();
  await elder.getByLabel('想说的话').fill('合成大字草稿：正文要始终看得见。');
  expect(await barState(elder)).toMatchObject({ position: 'static' });
  await elder.evaluate(() => scrollTo(0, 0));
  expect(await elder.getByLabel('想说的话').evaluate((element) => { const rect = element.getBoundingClientRect(); return rect.top < innerHeight * 0.85 && element === document.elementFromPoint(rect.left + rect.width / 2, Math.min(rect.top + 30, innerHeight - 4)); })).toBe(true);
  await capture(elder, evidence, 'root26-text-draft');
  for (const target of [elder.getByLabel(consentLabel), elder.getByRole('button', { name: sendName })]) {
    await target.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await hitTest(target);
  }
  expect((await elder.getByRole('button', { name: sendName }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const story = await sendDraft(elder, 'text');

  const normal = await actor(narrow); await joinStoryteller(normal, family);
  await normal.getByRole('button', { name: '写一点', exact: true }).click();
  await normal.getByLabel('想说的话').fill('合成常规字号草稿。');
  const fixed = await barState(normal);
  expect(fixed.position).toBe('fixed'); expect(fixed.share).toBeLessThanOrEqual(0.25);

  await refresh(organizer); await organizer.getByRole('button', { name: '故事目录', exact: true }).click();
  const toggle = entry(organizer, story).getByRole('button', { name: '写一个具体追问' });
  const remove = entry(organizer, story).getByRole('group', { name: '管理这段故事' }).getByRole('button', { name: '删除这段故事' });
  await remove.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await hitTest(toggle); await hitTest(remove);
  const [a, b] = [(await toggle.boundingBox())!, (await remove.boundingBox())!];
  expect(a.height).toBeGreaterThanOrEqual(44); expect(b.height).toBeGreaterThanOrEqual(44);
  expect(b.y - (a.y + a.height)).toBeGreaterThanOrEqual(24);
  await capture(organizer, evidence, 'story-actions');
  organizer.once('dialog', (dialog) => dialog.dismiss());
  await remove.click();
  await expect(entry(organizer, story)).toHaveCount(1);
});

for (const screen of [
  { viewport: narrow, root: 16 }, { viewport: narrow, root: 17 }, { viewport: narrow, root: 26 },
  { viewport: mobile, root: 16 }, { viewport: { width: 1280, height: 800 }, root: 16 },
]) {
  test(`${screen.viewport.width} root${screen.root}：发送区无孤字、同意门禁与代录说明`, async ({ actor, evidence }) => {
    const organizer = await actor(screen.viewport); const elder = await actor(screen.viewport);
    await rootFont(organizer, screen.root); await rootFont(elder, screen.root);
    const family = await createFamily(organizer); await joinStoryteller(elder, family);
    await organizer.getByRole('button', { name: '当面代录', exact: true }).click();
    for (const page of [elder, organizer]) {
      const proxy = page === organizer;
      for (const mode of ['audio', 'text'] as const) {
        if (mode === 'audio') {
          await page.getByRole('button', { name: '说一段', exact: true }).click();
          await expect(page.getByRole('button', { name: '我愿意，开始说' })).toBeEnabled();
          await importTone(page);
        } else {
          await page.getByRole('button', { name: '写一点', exact: true }).click();
          await page.getByLabel('想说的话').fill('虚构短语排版草稿，未同意时不能发送。');
        }
        const label = page.locator('.share-consent'); const button = page.getByRole('button', { name: sendName, exact: true });
        await expect(page.getByLabel(consentLabel)).not.toBeChecked(); await expect(button).toBeDisabled();
        await expect(label).toHaveText(proxy ? `已征得${family.snapshot.family.storytellerName}同意，保存并在家族内分享。` : `我同意保存这段${mode === 'text' ? '文字' : '原声'}，并在家族内分享。`);
        expect(await page.locator('html').evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))).toBe(screen.root);
        expect(await label.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(screen.root * 1.06);
        expect(await button.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(screen.root * 1.12);
        const bar = await barState(page);
        if (screen.root === 26 || screen.viewport.width > 600) expect(bar.position).toBe('static');
        else { expect(bar.position).toBe('fixed'); expect(bar.share).toBeLessThanOrEqual(0.25); }
        for (const checked of [false, true]) {
          if (checked) { await page.getByLabel(consentLabel).check(); await expect(button).toBeEnabled(); }
          for (const text of [label.locator('.phrased'), button.locator('.phrased')]) {
            const lines = await renderedLines(text);
            expect(lines.every((line) => line.replace(/[，。、；：…\s]/g, '').length >= 2)).toBe(true);
            expect(await text.evaluate((el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && (el as HTMLElement).scrollWidth <= (el as HTMLElement).clientWidth + 1; })).toBe(true);
          }
          for (const target of [label, button]) {
            await target.evaluate((el) => el.scrollIntoView({ block: 'center' })); await hitTest(target);
            expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
          }
          await capture(page, evidence, `${proxy ? 'proxy' : 'elder'}-${mode}-${checked ? 'consented' : 'unchecked'}`);
          expect((await snapshot(page)).stories).toHaveLength(0);
        }
        await page.getByLabel(consentLabel).uncheck(); await expect(button).toBeDisabled();
        if (proxy && mode === 'text') {
          const story = await sendDraft(page, 'text'); expect(story.recordedById).toBe(family.snapshot.member.id);
          expect((await snapshot(page)).stories).toHaveLength(1);
        } else {
          page.once('dialog', (dialog) => dialog.accept()); await page.getByRole('button', { name: '放弃这次草稿' }).click();
          await expect(page.getByRole('button', { name: '写一点', exact: true })).toBeEnabled();
        }
      }
    }
  });
}
