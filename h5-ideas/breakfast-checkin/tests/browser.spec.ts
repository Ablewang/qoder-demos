import { test, expect, type Browser, type Page, type Request } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { CareTask, Day, GuardianView, MeView, Resident, RosterRow, SessionView, StaffView } from '../src/types.ts';

// Only the throwaway accounts of tests/isolated-server.ts; never the live .local-data archive.
const PASS = { owner: 'only-fake-owner-password', backup: 'only-fake-backup-password' } as const;
const REAL = 'artifacts/site-v3-headless/real-backend';
const VISUAL = 'artifacts/site-v3-headless/visual-fixture';
mkdirSync(REAL, { recursive: true }); mkdirSync(VISUAL, { recursive: true });
test.beforeAll(async ({ browser }) => {
  const session = await browser.newBrowserCDPSession();
  const { userAgent, product } = await session.send('Browser.getVersion');
  expect(userAgent).toContain('HeadlessChrome/');
  writeFileSync(`${REAL}/headless-launch.json`, JSON.stringify({ browser: 'chromium', version: browser.version(), headless: true, product, userAgent }, null, 2));
  await session.detach();
});
const OPERABLE = /核对|领取|联系|代记|当面见到|删除|撤销|登记/;
const SERVER_ERROR = { status: 500, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ error: '本地服务异常，资料状态未知，请勿当作已核对' }) };

async function shot(page: Page, name: string, fullPage = true): Promise<void> { await page.screenshot({ path: `${REAL}/${name}.png`, fullPage }); }
async function staffLogin(page: Page, account: 'owner' | 'backup' = 'owner'): Promise<void> {
  await page.getByRole('button', { name: '店员登录', exact: true }).click();
  await page.getByRole('radio', { name: account === 'owner' ? '店主' : '授权替补', exact: true }).check();
  await page.getByLabel('本机模拟口令').fill(PASS[account]);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('tablist', { name: '店员分区' })).toBeVisible();
}
async function tab(page: Page, name: RegExp): Promise<void> { await page.getByRole('tab', { name }).click(); }
async function confirm(page: Page, label: string, confirmLabel: string): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('button', { name: confirmLabel, exact: true }).click();
}
async function guardianAccept(page: Page, capture = ''): Promise<void> {
  await expect(page.getByRole('heading', { name: /是否接受这项/ })).toBeVisible();
  if (capture) await shot(page, capture);
  const consentPosts: Request[] = [];
  const track = (request: Request) => { if (request.method() === 'POST') consentPosts.push(request); };
  page.on('request', track);
  await expect(page.getByLabel('我只是在演练模拟接受，不是代表任何真人')).not.toBeChecked();
  await page.getByRole('button', { name: '模拟接受联系约定', exact: true }).click();
  await expect(page.locator('.consent-state')).toContainText('尚未模拟接受');
  expect(consentPosts).toHaveLength(0); page.off('request', track);
  await page.getByLabel('我只是在演练模拟接受，不是代表任何真人').check();
  await page.getByRole('button', { name: '模拟接受联系约定', exact: true }).click();
  await expect(page.locator('.consent-state')).toContainText('已模拟接受');
  await page.getByRole('button', { name: '拒绝 / 返回公用入口', exact: true }).click();
  await expect(page.getByRole('button', { name: '店员登录', exact: true })).toBeVisible();
}
async function reviewToday(page: Page): Promise<void> {
  await tab(page, /^今日/);
  await confirm(page, '收摊核对', '确认核对');
  await expect(page.locator('.day-state')).toHaveText('今日已核对');
}
async function advance(page: Page): Promise<void> {
  await tab(page, /^管理/);
  const old = await page.locator('.ledger-head .date').innerText();
  await page.getByRole('button', { name: '模拟下一营业日期', exact: true }).click();
  await expect(page.locator('.ledger-head .date')).not.toHaveText(old);
}
const member = (page: Page, name: string) => page.locator('.member').filter({ hasText: name });
// API-level seeding inside the isolated in-memory backend only.
async function seed(page: Page, ids: string[], days: number): Promise<void> {
  await page.goto('/');
  await page.evaluate(async ({ owner, ids, days }) => {
    let csrf = '';
    async function call(path: string, body?: Record<string, unknown>) {
      const response = await fetch(`/api${path}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}, body: body ? JSON.stringify(body) : undefined });
      const value = await response.json(); if (!response.ok) throw new Error(`${path} ${response.status} ${value.error}`);
      if (value.csrf) csrf = value.csrf; return value;
    }
    const write = async (path: string, body: Record<string, unknown> = {}, view = '/staff') => call(path, { ...body, requestId: crypto.randomUUID(), version: (await call(view)).version });
    await call('/login', { account: 'owner', password: owner }); await call('/reset', { confirmed: true });
    for (const id of ids) {
      await call('/login', { account: 'owner', password: owner });
      await write('/enroll', { fixtureId: id, threshold: 2, weekdays: [0, 1, 2, 3, 4, 5, 6], simulatedElderConsent: true });
      const { ticket } = await call('/tickets', { residentId: id, role: 'guardian' });
      await call('/pair', { ticket }); await write('/consent', { accepted: true }, '/guardian');
    }
    await call('/login', { account: 'owner', password: owner });
    for (let index = 0; index < days; index += 1) { await write('/advance'); const view = await call('/staff'); await write('/review', { date: view.today }); }
    if (days) await write('/advance');
  }, { owner: PASS.owner, ids, days });
  await page.reload();
  await expect(page.getByRole('tablist', { name: '店员分区' })).toBeVisible();
}
type Audit = { label: string; width: number; root: string; overflow: boolean; small: string[]; orphans: string[]; clipped: string[] };
// 44px targets, no horizontal overflow, no clipped button text and no button whose last line is a single orphaned character.
async function audit(page: Page, label: string): Promise<Audit> {
  return page.evaluate(({ name, viewport }) => {
    const visible = (element: Element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden'; };
    const text = (element: Element) => (element.textContent ?? element.getAttribute('name') ?? element.tagName).trim().slice(0, 24);
    const targets = [...document.querySelectorAll('button, a, summary, .choice label, .check, input:not([type=radio]):not([type=checkbox])')].filter(visible);
    const small = targets.filter(element => { const rect = element.getBoundingClientRect(); return rect.height < 43.5 || rect.width < 43.5; }).map(text);
    const buttons = [...document.querySelectorAll('button')].filter(visible);
    const orphans = buttons.filter(element => {
      const rects: DOMRect[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (walker.currentNode.parentElement?.closest('.n')) continue;
        const range = document.createRange(); range.selectNodeContents(walker.currentNode);
        rects.push(...range.getClientRects());
      }
      // Count badges aren't labels; mixed-size text rects on one line overlap vertically.
      const lines: { bottom: number; width: number }[] = [];
      for (const rect of rects.filter(r => r.width > 1).sort((a, b) => a.top - b.top)) {
        const line = lines[lines.length - 1];
        if (line && rect.top < line.bottom - 2) { line.width += rect.width; line.bottom = Math.max(line.bottom, rect.bottom); }
        else lines.push({ bottom: rect.bottom, width: rect.width });
      }
      if (lines.length < 2) return false;
      return lines[lines.length - 1].width < parseFloat(getComputedStyle(element).fontSize) * 1.6;
    }).map(text);
    const clipped = buttons.filter(element => element.scrollWidth > element.clientWidth + 1 || (element.matches('[role=tab]') && (element.getBoundingClientRect().left < -1 || element.getBoundingClientRect().right > viewport + 1))).map(text);
    const context = document.createElement('canvas').getContext('2d')!;
    for (const input of document.querySelectorAll<HTMLInputElement>('input[type=date]')) {
      if (!visible(input) || !input.value) continue;
      const style = getComputedStyle(input);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const required = context.measureText(input.value.replaceAll('-', '/')).width + parseFloat(style.fontSize) * 1.75;
      const available = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      if (required > available + 1) clipped.push(`date ${input.name}: ${input.value}`);
    }
    const overflow = innerWidth > viewport + 1 || document.documentElement.scrollWidth > viewport + 1;
    const spill = overflow ? [...document.querySelectorAll('main *')].filter(visible).filter(element => element.getBoundingClientRect().right > viewport + 1).map(element => `${element.tagName}.${element.className}: ${Math.round(element.getBoundingClientRect().right)} ${text(element)}`).slice(0, 20) : [];
    return { label: name, width: innerWidth, viewport, root: getComputedStyle(document.documentElement).fontSize, overflow, spill, small, orphans, clipped };
  }, { name: label, viewport: page.viewportSize()!.width });
}
function clean(result: Audit): void { expect(result, result.label).toMatchObject({ overflow: false, small: [], orphans: [], clipped: [] }); }
function trackPosts(page: Page): string[] {
  const posts: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname); });
  return posts;
}
async function serverView(page: Page) { return (await page.request.get('/api/staff')).json(); }
async function focusIsConfirm(page: Page): Promise<boolean> { return page.evaluate(() => document.activeElement?.matches('[data-confirm]') ?? false); }
const audits: Audit[] = [];

test('真实隔离后端 390：协助登记→联系人接受→招呼前后→收摊核对→事项→假联系→更正→退出删除；403 与隐私', async ({ page }) => {
  const errors: string[] = []; const external: string[] = []; const publicBodies: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:')) external.push(request.url()); });
  page.on('response', async response => { if (/\/api\/public$/.test(response.url())) publicBodies.push(await response.text()); });
  await page.goto('/');
  await page.evaluate(async owner => {
    const login = await (await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: 'owner', password: owner }) })).json();
    await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': login.csrf }, body: JSON.stringify({ confirmed: true }) });
  }, PASS.owner);
  await page.reload();
  await expect(page.locator('.demo')).toContainText('演示数据');
  await expect(page.locator('.demo')).toContainText('不提供安全保障');
  await expect(page.locator('main')).not.toContainText('演示熟客');
  await expect(page.locator('.terms')).toContainText('不是安全保障');
  await expect(page.locator('.terms')).toContainText('不定位、不监控');
  audits.push(await audit(page, 'real-390-home')); clean(audits.at(-1)!);
  await shot(page, '01-home-390');

  await page.getByRole('button', { name: '请店员协助登记', exact: true }).click();
  await expect(page.getByRole('heading', { name: '店员登录，协助登记', exact: true })).toBeVisible();
  await shot(page, '02-assist-login-390');
  await page.getByLabel('本机模拟口令').fill('wrong-password');
  await page.getByRole('button', { name: '登录并打开登记表', exact: true }).click();
  await expect(page.locator('.notice.error')).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await page.getByLabel('本机模拟口令').fill(PASS.owner);
  await page.getByRole('button', { name: '登录并打开登记表', exact: true }).click();
  await expect(page.getByRole('heading', { name: '登记参加打招呼', exact: true })).toBeVisible();
  await expect(page.locator('.consent')).toContainText('不是监护或安全保障');
  await expect(page.getByLabel('我在演练模拟本人自愿参加；不是记录真人同意')).not.toBeChecked();
  audits.push(await audit(page, 'real-390-register')); clean(audits.at(-1)!);
  await shot(page, '03-register-390');
  await page.getByRole('radio', { name: '演示熟客甲', exact: true }).check();
  const beforeConsent = trackPosts(page);
  await page.getByRole('button', { name: '保存模拟登记', exact: true }).click();
  await expect(page.getByRole('heading', { name: '登记参加打招呼', exact: true })).toBeVisible();
  expect(beforeConsent).toHaveLength(0);
  await page.getByLabel('我在演练模拟本人自愿参加；不是记录真人同意').check();
  await page.getByRole('button', { name: '保存模拟登记', exact: true }).click();
  await expect(page.locator('.flow .row').filter({ hasText: '演示熟客甲' })).toContainText('等待模拟联系人');
  await shot(page, '04-today-waiting-390');
  await page.locator('.flow .row').filter({ hasText: '演示熟客甲' }).getByRole('button', { name: '配对模拟联系人', exact: true }).click();
  await expect(page.getByRole('heading', { name: /是否接受这项/ })).toBeVisible();
  const guardianDenied = await page.evaluate(async () => ({ staff: (await fetch('/api/staff')).status, fixtures: (await fetch('/api/fixtures')).status }));
  expect(guardianDenied).toEqual({ staff: 403, fixtures: 403 });
  await guardianAccept(page, '05-guardian-390');

  await staffLogin(page); await tab(page, /^名册/);
  await page.getByRole('button', { name: '新增模拟登记', exact: true }).click();
  await page.getByRole('radio', { name: '演示熟客乙', exact: true }).check();
  await page.getByLabel('我在演练模拟本人自愿参加；不是记录真人同意').check();
  await page.getByRole('button', { name: '保存模拟登记', exact: true }).click();
  await page.locator('.flow .row').filter({ hasText: '演示熟客乙' }).getByRole('button', { name: '配对模拟联系人', exact: true }).click();
  await guardianAccept(page);

  await staffLogin(page); await advance(page); await tab(page, /^名册/);
  await shot(page, '06-roster-390');
  await member(page, '演示熟客甲').getByRole('button', { name: '打开本人页面（模拟配对）', exact: true }).click();
  await expect(page.getByRole('button', { name: '打个招呼', exact: true })).toBeVisible();
  audits.push(await audit(page, 'real-390-resident-before')); clean(audits.at(-1)!);
  await shot(page, '07-resident-before-390');
  await page.getByRole('button', { name: '打个招呼', exact: true }).click();
  await expect(page.locator('.record')).toContainText('招呼已记录');
  await expect(page.locator('.record')).toContainText('本人打招呼');
  await expect(page.getByRole('button', { name: '打个招呼' })).toHaveCount(0);
  await shot(page, '08-resident-after-390');
  const denied = await page.evaluate(async () => {
    const session = await (await fetch('/api/session')).json();
    const me = await (await fetch('/api/me')).json();
    const post = (path: string, body: Record<string, unknown>) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf }, body: JSON.stringify({ requestId: crypto.randomUUID(), version: me.version, ...body }) }).then(response => response.status);
    return { staff: (await fetch('/api/staff')).status, fixtures: (await fetch('/api/fixtures')).status, other: await post('/api/residents/elder-b/arrival', { witnessed: false }), enroll: await post('/api/enroll', { fixtureId: 'elder-c', threshold: 2, weekdays: [1], simulatedElderConsent: true }), void: await post('/api/residents/elder-a/void', {}), cookies: document.cookie, local: localStorage.length, session: sessionStorage.length };
  });
  expect(denied).toEqual({ staff: 403, fixtures: 403, other: 403, enroll: 403, void: 403, cookies: '', local: 0, session: 0 });
  await page.getByRole('button', { name: '交还手机（保留资料）', exact: true }).click();

  await staffLogin(page);
  const pending = page.locator('.axis .row').filter({ hasText: '演示熟客乙' });
  await expect(pending).toBeVisible();
  await expect(page.locator('.flow')).toContainText('本人打招呼已记录');
  audits.push(await audit(page, 'real-390-today-before-review')); clean(audits.at(-1)!);
  await shot(page, '09-today-before-review-390');
  const posts: Request[] = []; const track = (request: Request) => { if (request.method() === 'POST') posts.push(request); };
  page.on('request', track);
  await expect(pending.getByRole('button', { name: '现在当面见到：演示熟客乙', exact: true })).toBeVisible();
  await expect(pending.locator('.confirm')).toHaveCount(0);
  const bounds = page.locator('.bounds details');
  await expect(bounds).not.toHaveAttribute('open');
  await bounds.locator('summary').click();
  await expect(bounds).toContainText('系统不自动通知');
  await expect(bounds).toContainText('两者都不是缺席结论');
  await shot(page, '10-boundaries-expanded-390');
  await bounds.locator('summary').click();
  await expect(page.locator('.axis')).toContainText('未知不当缺席');
  await page.getByRole('button', { name: '收摊核对', exact: true }).click();
  const reviewBox = page.locator('.step .confirm');
  await expect(reviewBox).toContainText('确认收摊核对？');
  await expect(reviewBox).toContainText('演示熟客乙今天会记为“核对后无记录”');
  await expect(reviewBox).toContainText('不代表出事');
  await shot(page, '11-review-confirm-390');
  expect(posts).toHaveLength(0);
  page.off('request', track);
  await page.getByRole('button', { name: '确认核对', exact: true }).click();
  await expect(page.locator('.day-state')).toHaveText('今日已核对');
  await expect(page.getByRole('heading', { name: /核对后无记录/ })).toBeVisible();
  await shot(page, '12-today-reviewed-390');

  await advance(page); await tab(page, /^今日/);
  const beforeWitness: StaffView = await serverView(page);
  expect(beforeWitness.roster.find(row => row.resident.id === 'elder-b')?.arrival).toBeUndefined();
  const witnessRequest = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/elder-b/arrival'));
  await page.getByRole('button', { name: '现在当面见到：演示熟客乙', exact: true }).click();
  const witnessBody = (await witnessRequest).postDataJSON();
  expect(witnessBody).toMatchObject({ witnessed: true, version: beforeWitness.version });
  expect(witnessBody.requestId).toMatch(/^[a-f0-9-]{36}$/);
  await expect(page.locator('.flow')).toContainText('店员当面代记 · 模拟店主');
  const afterWitness: StaffView = await serverView(page);
  expect(afterWitness.roster.find(row => row.resident.id === 'elder-b')?.arrival).toMatchObject({ source: 'staff', operator: 'owner', date: afterWitness.today });
  await shot(page, '12-next-day-single-witness-390');
  await reviewToday(page);
  await expect(page.locator('.axis .task').filter({ hasText: '演示熟客甲' })).toHaveCount(0);
  await advance(page); await reviewToday(page);
  const task = () => page.locator('.axis .task').filter({ hasText: '演示熟客甲' });
  await expect(task()).toContainText('待人工核实');
  await shot(page, '13-today-tasks-390');
  await task().getByRole('button', { name: '领取此人工事项', exact: true }).click();
  await task().getByRole('radio', { name: '模拟未接通，保持跟进' }).check();
  audits.push(await audit(page, 'real-390-task-form')); clean(audits.at(-1)!);
  await shot(page, '14-task-form-390');
  await task().getByRole('button', { name: '记录假联系结果', exact: true }).click();
  await expect(task()).toContainText('未接通，仍待跟进');
  await task().getByRole('radio', { name: '模拟对方已接手（不等于安全）' }).check();
  await task().getByRole('button', { name: '记录假联系结果', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('没有拨号或发送消息');
  await tab(page, /^名册/);
  await member(page, '演示熟客甲').getByRole('button', { name: '现在当面见到：演示熟客甲', exact: true }).click();
  await tab(page, /^今日/);
  await expect(task().first()).toContainText('待更正');
  await expect(task().first()).toContainText('原依据');
  await shot(page, '15-correction-390');
  await task().first().getByRole('button', { name: '标记假更正已完成', exact: true }).click();
  await expect(task()).toHaveCount(0);
  await tab(page, /^记录/);
  await page.locator('summary', { hasText: '事项历史' }).click();
  await expect(page.locator('.fold .task').filter({ hasText: '演示熟客甲' })).toContainText('假更正已记录');
  audits.push(await audit(page, 'real-390-records')); clean(audits.at(-1)!);
  await shot(page, '16-records-390');
  await tab(page, /^管理/);
  audits.push(await audit(page, 'real-390-admin')); clean(audits.at(-1)!);
  await shot(page, '17-admin-390');

  await tab(page, /^名册/);
  const card = member(page, '演示熟客甲');
  await card.locator('summary', { hasText: '更正或删除' }).click();
  const withdrawPosts: Request[] = []; const trackWithdraw = (request: Request) => { if (request.method() === 'POST') withdrawPosts.push(request); };
  page.on('request', trackWithdraw);
  await card.getByRole('button', { name: '退出并删除此模拟参与', exact: true }).click();
  await expect(card.locator('.confirm')).toContainText('立即删除演示熟客甲');
  await shot(page, '18-roster-withdraw-confirm-390');
  await card.getByRole('button', { name: '保留资料', exact: true }).click();
  await expect(card.locator('.confirm')).toHaveCount(0);
  await expect(card.locator('details')).toHaveAttribute('open', '');
  expect(withdrawPosts).toHaveLength(0);
  page.off('request', trackWithdraw);
  await card.getByRole('button', { name: '打开本人页面（模拟配对）', exact: true }).click();
  await page.getByRole('button', { name: '退出参加并删除资料', exact: true }).click();
  await expect(page.locator('.confirm')).toContainText('要退出参加，并删除资料吗？');
  await expect(page.locator('.confirm')).toContainText('交还手机不会删除资料');
  await shot(page, '19-resident-withdraw-confirm-390');
  await page.getByRole('button', { name: '确认退出并删除', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('已删除');
  expect((await page.request.get('/api/me')).status()).toBe(401);
  await staffLogin(page); await tab(page, /^名册/);
  await expect(member(page, '演示熟客甲')).toHaveCount(0);
  const privacy = await page.evaluate(async () => {
    const names = ['/server/auth.ts', '/.local-data/accounts.json', '/.local-data/demo.sqlite', '/%2elocal-data/accounts.json', '/tests/isolated-server.ts'];
    const results = await Promise.all(names.map(async name => ({ name, status: (await fetch(name)).status })));
    return { results, links: [...document.querySelectorAll('a')].map(item => item.href), overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  expect(privacy.results.every(result => result.status === 403)).toBe(true);
  expect(privacy.links.some(link => link.startsWith('tel:') || link.startsWith('mailto:'))).toBe(false);
  expect(publicBodies.join('')).not.toMatch(/elder-|演示熟客|演示联系人/);
  expect(privacy.overflow).toBe(false); expect(errors).toEqual([]); expect(external).toEqual([]);
});

test.describe('真实隔离后端 320', () => {
  test.use({ viewport: { width: 320, height: 740 } });
  test('请假/店休/未知、替补越权清空被拒、大字离线恢复', async ({ page }) => {
    await seed(page, ['elder-b'], 0);
    await page.getByRole('button', { name: '退出店员登录', exact: true }).click();
    await staffLogin(page, 'backup');
    await tab(page, /^管理/);
    const reset = page.getByRole('button', { name: '清空全部演示数据', exact: true });
    await expect(reset).toBeDisabled();
    await reset.evaluate(element => element.removeAttribute('disabled'));
    await reset.click();
    await page.getByRole('button', { name: '确认清空所有假数据', exact: true }).click();
    await expect(page.locator('.notice.error')).toContainText('仅模拟店主能清空演示数据');
    await tab(page, /^名册/);
    await expect(member(page, '演示熟客乙')).toHaveCount(1);

    await advance(page); await tab(page, /^今日/);
    audits.push(await audit(page, 'real-320-today')); clean(audits.at(-1)!);
    await shot(page, '20-today-320');
    await tab(page, /^名册/);
    await member(page, '演示熟客乙').getByRole('button', { name: '打开本人页面（模拟配对）', exact: true }).click();
    audits.push(await audit(page, 'real-320-resident-before')); clean(audits.at(-1)!);
    await shot(page, '21-resident-before-320');
    await page.getByRole('button', { name: '请假', exact: true }).click();
    await expect(page.locator('.leave-form')).toContainText('不填原因');
    audits.push(await audit(page, 'real-320-leave-form')); clean(audits.at(-1)!);
    await shot(page, '22-leave-form-320');
    await page.getByRole('button', { name: '保存模拟请假', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('模拟请假已保存');
    await expect(page.locator('.leaves .row')).toHaveCount(1);
    await expect(page.locator('.meaning')).toContainText('今天在请假中');
    await shot(page, '23-on-leave-320');
    await page.getByRole('button', { name: '撤销这次请假', exact: true }).click();
    await expect(page.locator('.leaves .row')).toHaveCount(0);
    await page.getByRole('button', { name: '交还手机（保留资料）', exact: true }).click();
    await staffLogin(page, 'backup');
    await tab(page, /^管理/);
    await confirm(page, '标记今天店休', '确认标记店休');
    await tab(page, /^名册/);
    await expect(member(page, '演示熟客乙')).toContainText('店休，不计缺记录');
    await tab(page, /^今日/);
    await expect(page.locator('.axis')).toContainText('今天店休，不计缺记录');
    await shot(page, '24-today-closed-320');
    await tab(page, /^管理/);
    await confirm(page, '标记今天开店', '确认标记开店');
    await tab(page, /^名册/);
    await expect(member(page, '演示熟客乙')).toContainText('今天未核对，状态未知');

    await page.evaluate(() => { document.documentElement.style.fontSize = '28px'; });
    audits.push(await audit(page, 'real-320-root28-roster')); clean(audits.at(-1)!);
    await shot(page, '25-roster-320-root28');
    await page.route('**/api/staff', route => route.abort());
    await page.getByRole('button', { name: '刷新资料', exact: true }).click();
    await expect(page.getByRole('heading', { name: '资料状态未知', exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('资料状态未知');
    await expect(page.getByRole('button', { name: /核对/ })).toHaveCount(0);
    const retry = page.getByRole('button', { name: '重新读取资料', exact: true });
    await page.evaluate(() => scrollTo(0, 0));
    const offline = await retry.evaluate(element => ({ retry: Math.round(element.getBoundingClientRect().top + scrollY), bottom: Math.round(element.getBoundingClientRect().bottom + scrollY), viewport: innerHeight, height: document.documentElement.scrollHeight }));
    audits.push(await audit(page, 'real-320-root28-offline')); clean(audits.at(-1)!);
    await shot(page, '26-offline-320-root28', false);
    expect(offline.bottom).toBeLessThan(offline.viewport);
    await retry.click();
    await expect(page.getByRole('heading', { name: '资料状态未知', exact: true })).toBeVisible();
    await page.unroute('**/api/staff');
    await retry.click();
    await expect(page.getByRole('tablist', { name: '店员分区' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('已从本地后端重新读取');
    writeFileSync(`${REAL}/offline-320-root28.json`, JSON.stringify(offline, null, 2));
  });

  test('写入成功后读取持续失败（大字）：重试靠前、无可操作按钮，恢复后只重读', async ({ page }) => {
    await seed(page, ['elder-a'], 1);
    await page.evaluate(() => { document.documentElement.style.fontSize = '28px'; });
    const posts = trackPosts(page);
    let failing = false;
    await page.route('**/api/residents/elder-a/arrival', async route => {
      const response = await route.fetch();
      if (response.ok()) failing = true;
      await route.fulfill({ response });
    });
    await page.route('**/api/staff', route => failing ? route.fulfill(SERVER_ERROR) : route.continue());
    await tab(page, /^名册/);
    await member(page, '演示熟客甲').getByRole('button', { name: '现在当面见到：演示熟客甲', exact: true }).click();
    await expect(page.getByRole('heading', { name: '资料状态未知', exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('后端已确认：已记下演示熟客甲：店员当面代记（模拟）');
    await expect(page.getByRole('status')).not.toContainText('没有保存');
    await expect(page.getByRole('button', { name: OPERABLE })).toHaveCount(0);
    const written = posts.length;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await page.evaluate(() => scrollTo(0, 0));
      const retry = page.getByRole('button', { name: '重新读取资料', exact: true });
      const bottom = await retry.evaluate(element => element.getBoundingClientRect().bottom + scrollY);
      expect(bottom).toBeLessThan(740);
      const read = page.waitForResponse(response => response.url().endsWith('/api/staff'));
      await retry.click();
      expect((await read).status()).toBe(500);
      await expect(retry).toBeEnabled();
      await expect(page.getByRole('heading', { name: '资料状态未知', exact: true })).toBeVisible();
      await expect(page.getByRole('status')).toContainText('此前后端已确认：已记下演示熟客甲：店员当面代记（模拟）。读取最新资料失败');
      await expect(page.getByRole('button', { name: OPERABLE })).toHaveCount(0);
    }
    audits.push(await audit(page, 'real-320-root28-committed-read-fail')); clean(audits.at(-1)!);
    await shot(page, '27-committed-read-fail-320-root28', false);
    failing = false;
    await page.getByRole('button', { name: '重新读取资料', exact: true }).click();
    await expect(page.getByRole('tablist', { name: '店员分区' })).toBeVisible();
    await expect(member(page, '演示熟客甲')).toContainText('今天已记录');
    await expect(page.getByRole('status')).toContainText('此前后端已确认');
    expect(posts.length).toBe(written);
    expect(posts.filter(path => path.endsWith('/arrival'))).toHaveLength(1);
    await shot(page, '28-committed-read-recovered-320-root28', false);
  });
});

test('真实隔离后端：两名假熟客晨间首屏位置（390 / 320 / 320 大字）', async ({ page, browser }) => {
  await seed(page, ['elder-a', 'elder-b'], 2);
  const results: unknown[] = [];
  const measure = (label: string) => page.evaluate(name => {
    const top = (selector: string) => { const element = document.querySelector(selector); return element ? Math.round(element.getBoundingClientRect().top + scrollY) : null; };
    return { label: name, width: innerWidth, viewport: innerHeight, height: document.documentElement.scrollHeight, firstStep: top('.axis h2'), firstItem: top('.axis .rows > .row'), firstAction: top('.axis .rows button'), reviewToday: top('.step .process'), overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  }, label);
  for (const [width, height] of [[390, 844], [320, 740]] as const) {
    await page.setViewportSize({ width, height }); await page.evaluate(() => scrollTo(0, 0));
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const metric = await measure(`${width}`); results.push(metric);
    expect(metric.reviewToday!).toBeLessThan(height - 40); expect(metric.overflow).toBe(false);
    await shot(page, `29-morning-first-screen-${width}`, false);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '28px'; });
  const large = await measure('320-root28'); results.push(large);
  expect(large.firstItem!).toBeLessThan(740); expect(large.overflow).toBe(false);
  await shot(page, '30-morning-first-screen-320-root28', false);
  await expect(page.locator('.axis .frozen')).toHaveCount(2);
  await expect(page.locator('.axis .frozen').first()).toContainText('先核对今天');
  const guest = await browser.newContext({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true });
  const visitor = await guest.newPage(); await visitor.goto(page.url());
  const entry = await visitor.getByRole('button', { name: '请店员协助登记' }).evaluate(element => Math.round(element.getBoundingClientRect().bottom));
  results.push({ label: 'home-320-assist-button-bottom', y: entry });
  expect(entry).toBeLessThan(700);
  audits.push(await audit(visitor, 'real-320-home')); clean(audits.at(-1)!);
  await visitor.screenshot({ path: `${REAL}/31-home-320.png`, fullPage: true });
  await guest.close();
  writeFileSync(`${REAL}/first-screen-metrics.json`, JSON.stringify(results, null, 2));
});

test('真实隔离后端：写入已确认后首次读取 500，反馈已保存而非没保存，重读恢复且不重发', async ({ page }) => {
  await seed(page, ['elder-a'], 1);
  const posts = trackPosts(page);
  let failReads = 0;
  await page.route('**/api/review', async route => {
    const response = await route.fetch();
    if (response.ok()) failReads = 1;
    await route.fulfill({ response });
  });
  await page.route('**/api/staff', route => { if (failReads > 0) { failReads -= 1; return route.fulfill(SERVER_ERROR); } return route.continue(); });
  await confirm(page, '收摊核对', '确认核对');
  await expect(page.getByRole('heading', { name: '资料状态未知', exact: true })).toBeVisible();
  const status = page.getByRole('status');
  await expect(status).toContainText('后端已确认：已记录');
  await expect(status).not.toContainText('没有保存');
  await expect(page.getByRole('button', { name: OPERABLE })).toHaveCount(0);
  const saved = await serverView(page);
  expect(saved.day.reviewedRevision).toBe(saved.day.revision);
  await shot(page, '32-committed-then-read-500-390', false);
  const before = posts.length;
  await page.getByRole('button', { name: '重新读取资料', exact: true }).click();
  await expect(page.getByRole('tablist', { name: '店员分区' })).toBeVisible();
  await expect(page.locator('.day-state')).toHaveText('今日已核对');
  await expect(page.getByRole('status')).toContainText('此前后端已确认');
  await expect(page.getByRole('status')).not.toContainText('没有保存');
  await shot(page, '33-read-recovered-390', false);
  expect(posts.length).toBe(before);
  expect(posts.filter(path => path === '/api/review')).toHaveLength(1);
});

test('真实隔离后端：写入前断线结果未知、版本冲突明确拒绝没有保存，均不报成功也不重发', async ({ page }) => {
  await seed(page, ['elder-a'], 1);
  const posts = trackPosts(page);
  await page.route('**/api/review', route => route.abort());
  await confirm(page, '收摊核对', '确认核对');
  await expect(page.getByRole('heading', { name: '资料状态未知', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('不一定完成');
  await expect(page.getByRole('status')).not.toContainText(/已确认|已保存|已记录/);
  await shot(page, '34-network-unknown-390', false);
  let view = await serverView(page);
  expect(view.day.reviewedRevision).not.toBe(view.day.revision);
  await page.unroute('**/api/review');
  await page.getByRole('button', { name: '重新读取资料', exact: true }).click();
  await expect(page.locator('.day-state')).toHaveText('今日未核对');
  expect(posts.filter(path => path === '/api/review')).toHaveLength(1);

  const origin = new URL(page.url()).origin;
  const { csrf } = await (await page.request.get('/api/session')).json();
  view = await serverView(page);
  const bump = await page.request.post('/api/pause', { headers: { Origin: origin, 'X-CSRF-Token': csrf }, data: { paused: false, requestId: crypto.randomUUID(), version: view.version } });
  expect(bump.ok()).toBe(true);
  await confirm(page, '收摊核对', '确认核对');
  await expect(page.getByRole('status')).toContainText('名单已更新，请刷新后核对再操作。本次操作没有保存');
  await expect(page.getByRole('status')).not.toContainText('后端已确认');
  await expect(page.locator('.day-state')).toHaveText('今日未核对');
  await shot(page, '35-version-conflict-390', false);
  view = await serverView(page);
  expect(view.day.reviewedRevision).not.toBe(view.day.revision);
  expect(posts.filter(path => path === '/api/review')).toHaveLength(2);
});

test.describe('真实隔离后端 桌面 1280', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
  test('今日/名册/记录/管理、收摊核对、本人招呼前后', async ({ page }) => {
    await seed(page, ['elder-a', 'elder-b', 'elder-c'], 2);
    audits.push(await audit(page, 'real-1280-today')); clean(audits.at(-1)!);
    await shot(page, '40-desktop-today');
    await page.getByRole('button', { name: '收摊核对', exact: true }).click();
    expect(await focusIsConfirm(page)).toBe(true);
    await shot(page, '41-desktop-review-confirm');
    await page.getByRole('button', { name: '确认核对', exact: true }).click();
    await expect(page.locator('.day-state')).toHaveText('今日已核对');
    await expect(page.locator('.axis .task').first()).toContainText('待人工核实');
    await shot(page, '42-desktop-reviewed-tasks');
    for (const [name, file] of [[/^名册/, '43-desktop-roster'], [/^记录/, '44-desktop-records'], [/^管理/, '45-desktop-admin']] as const) {
      await tab(page, name); audits.push(await audit(page, `real-1280-${file}`)); clean(audits.at(-1)!); await shot(page, file);
    }
    await tab(page, /^名册/);
    await member(page, '演示熟客丙').getByRole('button', { name: '打开本人页面（模拟配对）', exact: true }).click();
    audits.push(await audit(page, 'real-1280-resident-before')); clean(audits.at(-1)!);
    await shot(page, '46-desktop-resident-before');
    await page.getByRole('button', { name: '打个招呼', exact: true }).click();
    await expect(page.locator('.record')).toContainText('招呼已记录');
    await shot(page, '47-desktop-resident-after');
    await page.getByRole('button', { name: '交还手机（保留资料）', exact: true }).click();
    await expect(page.getByRole('button', { name: '店员登录', exact: true })).toBeVisible();
    await expect(page.locator('.record')).toHaveCount(0);
    audits.push(await audit(page, 'real-1280-home')); clean(audits.at(-1)!);
    await shot(page, '48-desktop-home');
  });
});

test('真实隔离后端 320：全店暂停二次确认→本人停用→恢复→联系人撤回清除资料', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await seed(page, ['elder-a'], 1);
  const posts = trackPosts(page);
  await tab(page, /^管理/);
  await page.getByRole('button', { name: '暂停全店核对联系', exact: true }).click();
  await expect(page.locator('.confirm')).toContainText('暂停不等于有人接手');
  expect(posts).toHaveLength(0);
  await shot(page, '49-pause-confirm-320');
  await page.getByRole('button', { name: '先不暂停', exact: true }).click();
  expect(posts).toHaveLength(0);
  await confirm(page, '暂停全店核对联系', '确认暂停');
  await expect(page.locator('.day-state')).toHaveText('全店暂停');
  expect((await serverView(page)).paused).toBe(true);
  await tab(page, /^今日/);
  await expect(page.locator('.axis')).toContainText('全店暂停中，不能核对');
  await expect(page.getByRole('button', { name: '收摊核对', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^现在当面见到/ })).toHaveCount(0);
  await expect(page.locator('.axis')).not.toContainText('熟客都有记录了');
  clean(await audit(page, 'real-320-paused-today'));
  await shot(page, '50-paused-today-320');
  await tab(page, /^名册/);
  await member(page, '演示熟客甲').getByRole('button', { name: '打开本人页面（模拟配对）', exact: true }).click();
  await expect(page.locator('.meaning.stop')).toContainText('全店暂停中');
  await expect(page.getByRole('button', { name: '打个招呼', exact: true })).toHaveCount(0);
  clean(await audit(page, 'real-320-paused-resident'));
  await shot(page, '51-paused-resident-320');
  await page.getByRole('button', { name: '交还手机（保留资料）', exact: true }).click();
  await staffLogin(page); await tab(page, /^管理/);
  await page.getByRole('button', { name: '恢复模拟核对联系', exact: true }).click();
  await expect(page.locator('.day-state')).toHaveText('今日未核对');
  expect((await serverView(page)).paused).toBe(false);
  await tab(page, /^名册/);
  await page.evaluate(async () => {
    const session = await (await fetch('/api/session')).json();
    const response = await fetch('/api/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf }, body: JSON.stringify({ residentId: 'elder-a', role: 'guardian' }) });
    if (!response.ok) throw new Error('隔离联系人配对失败');
    const { ticket } = await response.json();
    const paired = await fetch('/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf }, body: JSON.stringify({ ticket }) });
    if (!paired.ok) throw new Error('隔离联系人身份切换失败');
  });
  await page.reload();
  await expect(page.locator('.consent-state')).toContainText('已模拟接受');
  await page.getByRole('button', { name: '撤回模拟联系约定', exact: true }).click();
  await expect(page.locator('.confirm')).toContainText('相关记录清除');
  clean(await audit(page, 'real-320-guardian-withdraw-confirm'));
  await shot(page, '52-guardian-withdraw-confirm-320');
  await page.getByRole('button', { name: '确认撤回', exact: true }).click();
  await expect(page.getByRole('button', { name: '店员登录', exact: true })).toBeVisible();
  await staffLogin(page);
  const view: StaffView = await serverView(page);
  expect(view.residents[0].status).toBe('waiting');
  expect(view.residents[0].guardianConsent).toBe(false);
  expect(view.leaves).toEqual([]); expect(view.tasks).toEqual([]);
  await tab(page, /^名册/);
  await expect(member(page, '演示熟客甲')).toContainText('等待模拟联系人接受');
  await shot(page, '53-guardian-withdrawn-roster-320');
});

test('真实隔离后端：写入已落库但响应 500、首次读也失败；结果未知仅重读，不重放 POST', async ({ page }) => {
  await seed(page, ['elder-a'], 1);
  const posts = trackPosts(page);
  let failReads = 0;
  await page.route('**/api/review', async route => {
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    failReads = 1;
    await route.fulfill(SERVER_ERROR);
  });
  await page.route('**/api/staff', route => { if (failReads > 0) { failReads -= 1; return route.fulfill(SERVER_ERROR); } return route.continue(); });
  await confirm(page, '收摊核对', '确认核对');
  await expect(page.getByRole('heading', { name: '资料状态未知', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('操作结果未知');
  await expect(page.getByRole('status')).not.toContainText(/本次操作没有保存|后端已确认/);
  await expect(page.getByRole('button', { name: OPERABLE })).toHaveCount(0);
  const view = await serverView(page);
  expect(view.day.reviewedRevision).toBe(view.day.revision);
  await shot(page, '54-committed-write-500-unknown-390', false);
  await page.getByRole('button', { name: '重新读取资料', exact: true }).click();
  await expect(page.locator('.day-state')).toHaveText('今日已核对');
  expect(posts.filter(path => path === '/api/review')).toHaveLength(1);
  await shot(page, '55-write-500-read-recovered-390', false);
});

test('单次当面记录：忙态不误报、连点一请求、服务端幂等、来源与焦点；三视口及130%字体', async ({ page }) => {
  const report: unknown[] = [];
  for (const [width, height] of [[320, 740], [390, 844], [1280, 800]] as const) {
    await page.setViewportSize({ width, height });
    await seed(page, ['elder-a', 'elder-b'], 0);
    await advance(page); await tab(page, /^今日/);
    await page.evaluate(() => { document.documentElement.style.fontSize = '23.4px'; });
    const before: StaffView = await serverView(page);
    const requests: Request[] = [];
    const track = (request: Request) => { if (request.method() === 'POST') requests.push(request); };
    page.on('request', track);
    let release!: () => void;
    const gate = new Promise<void>(done => { release = done; });
    await page.route('**/api/residents/elder-a/arrival', async route => { await gate; const response = await route.fetch(); await route.fulfill({ response }); });
    const positions = () => page.evaluate(() => ['.axis .row[data-resident="elder-a"] button', '.axis .row[data-resident="elder-b"] button', '.step .process'].map(selector => {
      const rect = document.querySelector(selector)!.getBoundingClientRect(); return { x: rect.x, y: rect.y + scrollY, width: rect.width, height: rect.height };
    }));
    const initial = await positions();
    await page.getByRole('button', { name: '现在当面见到：演示熟客甲', exact: true }).dblclick();
    await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('.notice')).toHaveCount(0);
    await expect(page.locator('[data-confirm]')).toHaveCount(0);
    await expect(page.locator('.flow .rec')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '现在当面见到：演示熟客乙', exact: true })).toBeDisabled();
    expect(await positions()).toEqual(initial);
    expect((await serverView(page)).roster.find((row: RosterRow) => row.resident.id === 'elder-a')?.arrival).toBeUndefined();
    clean(await audit(page, `single-witness-busy-${width}-font130`));
    await shot(page, `60-witness-busy-${width}-font130`);
    release();
    await expect(page.locator('.flow .rec').filter({ hasText: '演示熟客甲' })).toContainText('店员当面代记 · 模拟店主');
    await expect(page.locator('.notice')).toBeFocused();
    await expect(page.locator('.notice')).toContainText('已记下演示熟客甲');
    await page.keyboard.press('Enter');
    await expect(page.locator('.flow .rec')).toHaveCount(1);
    const arrivalRequests = requests.filter(request => request.url().endsWith('/arrival'));
    expect(arrivalRequests).toHaveLength(1);
    const body = arrivalRequests[0].postDataJSON();
    expect(body).toMatchObject({ witnessed: true, version: before.version });
    expect(body.requestId).toMatch(/^[a-f0-9-]{36}$/);
    const saved: StaffView = await serverView(page);
    expect(saved.roster.find(row => row.resident.id === 'elder-a')?.arrival).toEqual({ residentId: 'elder-a', date: saved.today, source: 'staff', operator: 'owner' });
    expect(saved.roster.find(row => row.resident.id === 'elder-b')?.arrival).toBeUndefined();
    const { csrf } = await (await page.request.get('/api/session')).json();
    const headers = { Origin: new URL(page.url()).origin, 'X-CSRF-Token': csrf };
    const replay = await page.request.post('/api/residents/elder-a/arrival', { headers, data: body });
    expect(replay.status()).toBe(200);
    expect((await serverView(page)).version).toBe(saved.version);
    const reused = await page.request.post('/api/residents/elder-a/arrival', { headers, data: { ...body, witnessed: false } });
    expect(reused.status()).toBe(409);
    const noWitness = await page.request.post('/api/residents/elder-b/arrival', { headers, data: { witnessed: false, version: saved.version, requestId: crypto.randomUUID() } });
    expect(noWitness.status()).toBe(400);
    clean(await audit(page, `single-witness-saved-${width}-font130`));
    await shot(page, `61-witness-saved-${width}-font130`);
    const count = requests.length;
    await page.getByRole('button', { name: '记错了，撤销', exact: true }).click();
    expect(await focusIsConfirm(page)).toBe(true);
    await page.getByRole('button', { name: '保留记录', exact: true }).click();
    await expect(page.getByRole('button', { name: '记错了，撤销', exact: true })).toBeFocused();
    expect(requests.length).toBe(count);
    await tab(page, /^名册/);
    await expect(member(page, '演示熟客甲').getByRole('button', { name: /^现在当面见到/ })).toHaveCount(0);
    await expect(member(page, '演示熟客乙').getByRole('button', { name: /^现在当面见到/ })).toHaveCount(1);
    report.push({ viewport: { width, height }, font: '23.4px (18px × 130%)', busyPositionsStable: true, uiArrivalPosts: 1, payload: body, arrival: saved.roster.find(row => row.resident.id === 'elder-a')?.arrival, replay: replay.status(), reused: reused.status(), noWitness: noWitness.status() });
    page.off('request', track); await page.unroute('**/api/residents/elder-a/arrival');
  }
  writeFileSync(`${REAL}/single-witness-requests.json`, JSON.stringify(report, null, 2));
});

test('单次当面记录：断网及两次重读失败只恢复读取，显式拒绝与焦点；三视口130%', async ({ page }) => {
  for (const [width, height] of [[320, 740], [390, 844], [1280, 800]] as const) {
    await page.setViewportSize({ width, height });
    await seed(page, ['elder-a'], 0); await advance(page); await tab(page, /^名册/);
    await page.evaluate(() => { document.documentElement.style.fontSize = '23.4px'; });
    const posts = trackPosts(page);
    await page.route('**/api/residents/elder-a/arrival', route => route.abort());
    await page.getByRole('button', { name: '现在当面见到：演示熟客甲', exact: true }).click();
    const retry = page.getByRole('button', { name: '重新读取资料', exact: true });
    await expect(retry).toBeFocused();
    await expect(page.getByRole('status')).toContainText('不一定完成');
    await expect(page.getByRole('status')).not.toContainText(/已记下|已保存|后端已确认|没有保存/);
    await expect(page.getByRole('button', { name: OPERABLE })).toHaveCount(0);
    await shot(page, `62-witness-unknown-${width}-font130`, false);
    await page.unroute('**/api/residents/elder-a/arrival');
    let failedReads = 2;
    await page.route('**/api/staff', route => failedReads-- > 0 ? route.fulfill(SERVER_ERROR) : route.continue());
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const read = page.waitForResponse(response => response.url().endsWith('/api/staff'));
      await retry.click(); expect((await read).status()).toBe(500);
      await expect(retry).toBeEnabled(); await expect(retry).toBeFocused();
      await expect(page.getByRole('status')).toContainText('读取最新资料失败');
      await expect(page.getByRole('button', { name: OPERABLE })).toHaveCount(0);
      const rect = await retry.boundingBox(); expect(rect!.y + rect!.height).toBeLessThan(height);
      clean(await audit(page, `witness-retry-${attempt}-${width}-font130`));
    }
    await shot(page, `63-witness-two-read-failures-${width}-font130`, false);
    await retry.click();
    await expect(page.getByRole('tablist')).toBeVisible();
    await expect(page.locator('.notice')).toBeFocused();
    await expect(page.getByRole('button', { name: /^现在当面见到/ })).toBeEnabled();
    expect(posts.filter(path => path.endsWith('/arrival'))).toHaveLength(1);
    const view: StaffView = await serverView(page);
    expect(view.roster[0].arrival).toBeUndefined();
    await page.unroute('**/api/staff');
    const { csrf } = await (await page.request.get('/api/session')).json();
    const paused = await page.request.post('/api/pause', { headers: { Origin: new URL(page.url()).origin, 'X-CSRF-Token': csrf }, data: { paused: true, version: view.version, requestId: crypto.randomUUID() } });
    expect(paused.ok()).toBe(true);
    await page.getByRole('button', { name: '现在当面见到：演示熟客甲', exact: true }).click();
    await expect(page.locator('.notice')).toContainText('本次操作没有保存');
    await expect(page.locator('.notice')).toBeFocused();
    await expect(page.getByRole('button', { name: /^现在当面见到/ })).toHaveCount(0);
    expect((await serverView(page)).roster[0].arrival).toBeUndefined();
    await shot(page, `64-witness-explicit-refusal-${width}-font130`);
  }
});

test('反馈归属：本人写入确认后连续读取失败，仅重读；交还与店员另一人的记录不串反馈', async ({ page }) => {
  await seed(page, ['elder-a', 'elder-b'], 0); await advance(page); await tab(page, /^名册/);
  await member(page, '演示熟客甲').getByRole('button', { name: '打开本人页面（模拟配对）', exact: true }).click();
  await expect(page.getByRole('button', { name: '打个招呼', exact: true })).toBeVisible();
  const posts = trackPosts(page); let fail = false;
  await page.route('**/api/residents/elder-a/arrival', async route => { const response = await route.fetch(); fail = response.ok(); await route.fulfill({ response }); });
  await page.route('**/api/me', route => fail ? route.fulfill(SERVER_ERROR) : route.continue());
  const request = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/elder-a/arrival'));
  await page.getByRole('button', { name: '打个招呼', exact: true }).click();
  expect((await request).postDataJSON().witnessed).toBe(false);
  await expect(page.getByRole('status')).toContainText('后端已确认：今天的模拟招呼已保存');
  await expect(page.getByRole('status')).not.toContainText(/当面代记|演示熟客乙|本次操作没有保存/);
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '打个招呼', exact: true })).toHaveCount(0);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.getByRole('button', { name: '重新读取资料', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('此前后端已确认：今天的模拟招呼已保存');
    await expect(page.getByRole('button', { name: '重新读取资料', exact: true })).toBeFocused();
  }
  fail = false;
  await page.getByRole('button', { name: '重新读取资料', exact: true }).click();
  await expect(page.locator('.record')).toContainText('本人打招呼');
  await expect(page.locator('.name')).toHaveText('演示熟客甲');
  expect(posts.filter(path => path.endsWith('/arrival'))).toHaveLength(1);
  await shot(page, '65-resident-confirmed-read-recovered-390');
  await page.getByRole('button', { name: '交还手机（保留资料）', exact: true }).click();
  await expect(page.getByRole('button', { name: '店员登录', exact: true })).toBeVisible();
  await expect(page.locator('.notice')).not.toContainText('此前后端已确认');
  await staffLogin(page);
  await expect(page.locator('.notice')).toHaveCount(0);
  await page.getByRole('button', { name: '现在当面见到：演示熟客乙', exact: true }).click();
  await expect(page.locator('.notice')).toContainText('已记下演示熟客乙：店员当面代记');
  await expect(page.locator('.notice')).not.toContainText(/演示熟客甲|此前后端已确认/);
  await expect(page.locator('.flow .rec')).toHaveCount(2);
  const view: StaffView = await serverView(page);
  expect(view.roster.map(row => row.arrival?.source)).toEqual(['self', 'staff']);
  await expect(page.getByRole('heading', { name: '今日招呼', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /核对后无记录/ })).toHaveCount(0);
  clean(await audit(page, 'real-feedback-two-records-390'));
  await shot(page, '66-two-source-records-390');
  await tab(page, /^名册/);
  await expect(page.locator('.notice')).toHaveCount(0);
});

test('并发已有本人招呼：单次店员请求保留第一来源，成功反馈不得改说店员代记', async ({ page, browser }) => {
  await seed(page, ['elder-a'], 0); await advance(page); await tab(page, /^今日/);
  const origin = new URL(page.url()).origin;
  const other = await browser.newContext({ baseURL: origin });
  try {
    const login = await other.request.post('/api/login', { headers: { Origin: origin }, data: { account: 'owner', password: PASS.owner } });
    const owner = await login.json(); expect(login.ok()).toBe(true);
    const ticket = await other.request.post('/api/tickets', { headers: { Origin: origin, 'X-CSRF-Token': owner.csrf }, data: { residentId: 'elder-a', role: 'resident' } });
    const paired = await other.request.post('/api/pair', { headers: { Origin: origin, 'X-CSRF-Token': owner.csrf }, data: await ticket.json() });
    const residentSession = await paired.json(); expect(paired.ok()).toBe(true);
    const me: MeView = await (await other.request.get('/api/me')).json();
    const arrived = await other.request.post('/api/residents/elder-a/arrival', { headers: { Origin: origin, 'X-CSRF-Token': residentSession.csrf }, data: { witnessed: false, version: me.version, requestId: crypto.randomUUID() } });
    expect(arrived.ok()).toBe(true);
    await expect(page.getByRole('button', { name: '现在当面见到：演示熟客甲', exact: true })).toBeVisible();
    const posts = trackPosts(page);
    await page.getByRole('button', { name: '现在当面见到：演示熟客甲', exact: true }).click();
    await expect(page.locator('.notice')).toContainText('今天已有本人招呼记录，保留原来源');
    await expect(page.locator('.notice')).not.toContainText('店员当面代记');
    await expect(page.locator('.notice')).toBeFocused();
    await expect(page.locator('.flow')).toContainText('本人打招呼已记录');
    expect(posts.filter(path => path.endsWith('/arrival'))).toHaveLength(1);
    const view: StaffView = await serverView(page);
    expect(view.roster[0].arrival).toMatchObject({ source: 'self', operator: 'resident:elder-a' });
    await shot(page, '67-witness-concurrent-self-source-390');
  } finally { await other.close(); }
});

// ---- Pure visual fixture: every GET is answered locally and every POST is aborted. Not backend, auth or storage verification. ----
const TODAY = '2026-11-20';
const LONG = '演示熟客·住在巷子最里头那户的虚构老街坊（长名测试）';
const resident = (id: string, name: string, extra: Partial<Resident> = {}): Resident => ({ id, name, guardianName: `${name}的模拟联系人`, threshold: 2, weekdays: [0, 1, 2, 3, 4, 5, 6], elderConsent: true, guardianConsent: true, status: 'active', startDate: '2026-11-17', ...extra });
const task = (id: string, residentId: string, extra: Partial<CareTask> = {}): CareTask => ({ id: `00000000-0000-4000-8000-00000000000${id}`, residentId, dates: ['2026-11-18', '2026-11-19'], state: 'pending', actionable: true, assignee: null, attempts: 0, nextDate: null, outcome: null, ...extra });
function busyView(): StaffView {
  const residents = [
    resident('v1', LONG), resident('v2', '演示熟客乙'), resident('v3', '演示熟客·丙丙丙丙丙丙丙丙丙丙丙丙丙丙丙'), resident('v4', '演示熟客丁', { weekdays: [1, 3, 5] }),
    resident('v5', '演示熟客戊'), resident('v6', '演示熟客己'), resident('v7', '演示熟客庚', { weekdays: [0, 6] }), resident('v8', '演示熟客·还在等联系人接受的长名熟客', { status: 'waiting', guardianConsent: false }),
    resident('v9', '演示熟客壬', { threshold: 3 }), resident('v10', '演示熟客癸', { threshold: 1 }), resident('v11', '演示熟客·约定已暂停的另一位', { status: 'paused' }),
  ];
  const row = (index: number, status: RosterRow['status'], streak = 0, unknownDates: string[] = [], arrival?: RosterRow['arrival']): RosterRow => ({ resident: residents[index], status, streak, unknownDates, arrival });
  const roster = [
    row(0, 'unknown', 1, ['2026-11-19', TODAY]), row(1, 'unknown', 0, [TODAY]), row(2, 'unknown', 2, [TODAY]),
    row(3, 'arrival', 0, [], { residentId: 'v4', date: TODAY, source: 'self', operator: 'resident:v4' }),
    row(4, 'arrival', 0, [], { residentId: 'v5', date: TODAY, source: 'staff', operator: 'backup' }),
    row(5, 'leave'), row(6, 'unscheduled'), row(7, 'waiting'), row(8, 'unknown', 1, [TODAY]), row(9, 'unknown', 1, [TODAY]), row(10, 'paused'),
  ];
  const days: Day[] = [
    { date: '2026-11-17', open: true, revision: 1, reviewedRevision: 1, reviewer: 'owner' },
    { date: '2026-11-18', open: false, revision: 2, reviewedRevision: 2, reviewer: 'backup' },
    { date: '2026-11-19', open: true, revision: 3, reviewedRevision: 2, reviewer: 'owner' },
    { date: TODAY, open: true, revision: 4, reviewedRevision: null, reviewer: null },
  ];
  const tasks = [
    task('1', 'v3'), task('2', 'v9', { state: 'claimed', assignee: 'owner', attempts: 1 }), task('3', 'v10', { state: 'followup', assignee: 'backup', attempts: 2, nextDate: '2026-11-21', outcome: 'fake_no_answer' }),
    task('4', 'v1', { state: 'correction', assignee: 'owner', attempts: 1, previousDates: ['2026-11-17', '2026-11-18'] }), task('5', 'v2', { actionable: false }),
    task('6', 'v6', { state: 'closed', attempts: 1, outcome: 'fake_handoff', assignee: 'owner' }), task('7', 'v7', { state: 'cancelled' }), task('8', 'v11', { state: 'corrected', attempts: 1, assignee: 'backup' }),
  ];
  return { today: TODAY, version: 42, paused: false, day: days[3], residents, roster, tasks, days, leaves: [{ id: 'leave-1', residentId: 'v6', start: '2026-11-19', end: '2026-11-23' }] };
}
function emptyView(): StaffView {
  const day: Day = { date: TODAY, open: true, revision: 0, reviewedRevision: null, reviewer: null };
  return { today: TODAY, version: 1, paused: false, day, residents: [], roster: [], tasks: [], days: [day], leaves: [] };
}
const meView = (arrival: boolean): MeView => ({ today: TODAY, version: 7, paused: false, resident: resident('v1', LONG), leaves: [{ id: 'l1', residentId: 'v1', start: '2026-11-22', end: '2026-11-24' }, { id: 'l2', residentId: 'v1', start: '2026-11-28', end: '2026-11-28' }], arrival: arrival ? { residentId: 'v1', date: TODAY, source: 'staff', operator: 'owner' } : undefined });
const guardianView: GuardianView & { version: number } = { name: LONG, guardianName: '演示联系人·长名测试', accepted: true, paused: false, version: 3 };
type Scene = { role: 'owner' | 'resident' | 'guardian' | null; staff?: StaffView; me?: MeView };
async function fixture(page: Page, scene: Scene): Promise<string[]> {
  const blocked: string[] = [];
  await page.route('**/api/**', route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') { blocked.push(path); return route.abort(); }
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });
    if (path === '/api/public') return json({ shopId: 'demo-breakfast', shopName: '暖灶早点铺 · 虚构演示店', demo: true, disclaimer: '视觉 fixture' });
    if (path === '/api/session') { if (!scene.role) return json({ error: '未登录' }, 401); const session: SessionView = { principal: { role: scene.role, id: scene.role === 'owner' ? 'owner' : `${scene.role}:v1`, residentId: scene.role === 'owner' ? undefined : 'v1', shopId: 'demo-breakfast' }, csrf: 'visual-fixture-cannot-write' }; return json(session); }
    if (path === '/api/staff') return json(scene.staff);
    if (path === '/api/fixtures') return json([]);
    if (path === '/api/me') return json(scene.me);
    if (path === '/api/guardian') return json(guardianView);
    return json({ error: 'fixture 未提供' }, 404);
  });
  return blocked;
}
async function visualContext(browser: Browser, baseURL: string, width: number) {
  const desktop = width >= 1000;
  return browser.newContext({ baseURL, viewport: { width, height: desktop ? 800 : width === 320 ? 740 : 844 }, isMobile: !desktop, hasTouch: !desktop });
}

test('纯视觉 fixture（拦截 GET、拒绝全部 POST；不是后端/鉴权/存储验证）：长名、多事项、无事项、确认滚动、390/320/1280 × 默认/130%/28px 根字号', async ({ browser, baseURL }) => {
  const report: Audit[] = []; const failures: string[] = [];
  for (const width of [390, 320, 1280]) {
    for (const root of ['', '23.4px', '28px']) {
      const tag = `${width}${root === '23.4px' ? '-font130' : root ? '-root28' : ''}`;
      const context = await visualContext(browser, baseURL!, width);
      const page = await context.newPage();
      const check = async (label: string, file: string) => { const result = await audit(page, `${label}-${tag}`); report.push(result); if (result.overflow || result.small.length || result.orphans.length || result.clipped.length) failures.push(JSON.stringify(result)); await page.screenshot({ path: `${VISUAL}/${file}-${tag}.png`, fullPage: true }); };
      const setRoot = () => page.evaluate(size => { document.documentElement.style.fontSize = size; }, root);
      let blocked = await fixture(page, { role: 'owner', staff: busyView() });
      await page.goto('/'); await setRoot();
      await expect(page.getByRole('tablist', { name: '店员分区' })).toBeVisible();
      await check('busy-today', 'busy-today');
      for (const [name, file] of [[/^名册/, 'busy-roster'], [/^记录/, 'busy-records'], [/^管理/, 'busy-admin']] as const) {
        await tab(page, name);
        if (file === 'busy-roster') await member(page, LONG).locator('summary').click();
        if (file === 'busy-records') for (const summary of await page.locator('.fold summary').all()) await summary.click();
        await check(file, file);
      }
      await tab(page, /^今日/);
      await page.evaluate(() => scrollTo(0, 0));
      const lastVoid = page.getByRole('button', { name: '记错了，撤销', exact: true }).last();
      await lastVoid.click();
      const box = page.locator('[data-confirm]');
      const placement = await box.evaluate(element => { const rect = element.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, viewport: innerHeight, focused: document.activeElement === element }; });
      expect(placement.focused, `confirm focus ${tag}`).toBe(true);
      expect(placement.bottom, `confirm visible ${tag}`).toBeLessThanOrEqual(placement.viewport + 1);
      expect(placement.top, `confirm visible ${tag}`).toBeGreaterThanOrEqual(-1);
      await page.screenshot({ path: `${VISUAL}/busy-void-confirm-${tag}.png` });
      await page.getByRole('button', { name: '保留记录', exact: true }).click();
      expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('记错了，撤销');
      expect(blocked).toEqual([]);
      await page.unrouteAll();

      blocked = await fixture(page, { role: 'owner', staff: emptyView() });
      await page.reload(); await setRoot();
      await expect(page.locator('.axis')).toContainText('还没有生效的登记');
      await expect(page.locator('.axis')).toContainText('没有待人工核实的事项');
      await check('empty-today', 'empty-today');
      await tab(page, /^名册/); await check('empty-roster', 'empty-roster');
      await page.unrouteAll();

      blocked = await fixture(page, { role: 'resident', me: meView(false) });
      await page.reload(); await setRoot();
      await expect(page.getByRole('button', { name: '打个招呼', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '请假', exact: true }).click();
      await check('resident-before-leave', 'resident-long-before');
      await page.getByRole('button', { name: '先不请假', exact: true }).click();
      await page.getByRole('button', { name: '退出参加并删除资料', exact: true }).click();
      await check('resident-withdraw-confirm', 'resident-long-withdraw-confirm');
      await page.unrouteAll();
      blocked = await fixture(page, { role: 'resident', me: meView(true) });
      await page.reload(); await setRoot();
      await expect(page.locator('.record')).toContainText('招呼已记录');
      await check('resident-after', 'resident-long-after');
      await page.unrouteAll();
      blocked = await fixture(page, { role: 'guardian' });
      await page.reload(); await setRoot();
      await page.getByRole('button', { name: '撤回模拟联系约定', exact: true }).click();
      await check('guardian-withdraw-confirm', 'guardian-long');
      await page.unrouteAll();
      blocked = await fixture(page, { role: null });
      await page.reload(); await setRoot();
      await check('home', 'home');
      await page.getByRole('button', { name: '店员登录', exact: true }).click();
      await check('login', 'login');
      expect(blocked).toEqual([]);
      await context.close();
    }
  }
  writeFileSync(`${VISUAL}/audit.json`, JSON.stringify({ note: '纯视觉 fixture：GET 由测试本地伪造，POST 全部中止；仅检查排版、触区与确认焦点，不代表后端、鉴权或存储通过。', report }, null, 2));
  expect(failures).toEqual([]);
});

test.afterAll(() => { writeFileSync(`${REAL}/layout-audit.json`, JSON.stringify({ note: '真实隔离内存后端（tests/isolated-server.ts，非 5217/5218、非 .local-data）上的排版与触区审计', audits }, null, 2)); });
