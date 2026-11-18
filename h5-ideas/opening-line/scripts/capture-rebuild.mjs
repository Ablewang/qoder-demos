import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const label = process.argv[2] ?? 'after';
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5213/';
const outDir = new URL(`../screenshots/rebuild-2026-11-18/${label}/`, import.meta.url);
mkdirSync(outDir, { recursive: true });
const out = (name) => new URL(name, outDir).pathname;

const viewports = [
  { name: '390x844', width: 390, height: 844, mobile: true },
  { name: '320x740', width: 320, height: 740, mobile: true },
  { name: 'desktop-1440x900', width: 1440, height: 900, mobile: false },
];

const audit = (page) => page.evaluate(async () => {
  const sleep = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const scope = document.querySelector('dialog[open]') ?? document;
  const bar = scope === document ? document.querySelector('.help-bar') : null;
  const result = { overflowX: document.documentElement.scrollWidth > innerWidth, small: [], blocked: [], targets: 0 };
  const targets = [...scope.querySelectorAll('button:not(:disabled), a[href]')].filter((el) => el.offsetParent !== null && !el.closest('dialog:not([open])'));
  for (const el of targets) {
    if (el.closest('.help-bar')) continue;
    el.scrollIntoView({ block: 'center' });
    await sleep();
    const rect = el.getBoundingClientRect();
    result.targets += 1;
    result.minTargetWidth = Math.min(result.minTargetWidth ?? Infinity, rect.width);
    result.minTargetHeight = Math.min(result.minTargetHeight ?? Infinity, rect.height);
    const name = `${el.dataset.action ?? el.getAttribute('href')}:${el.textContent.trim().slice(0, 14)}`;
    if (rect.width < 44 - 0.5 || rect.height < 44 - 0.5) result.small.push(`${name} ${rect.width.toFixed(1)}×${rect.height.toFixed(1)}`);
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (!hit || !el.contains(hit)) result.blocked.push(`${name} -> ${hit?.className || hit?.tagName}`);
  }
  if (bar) {
    const b = bar.getBoundingClientRect();
    if (b.width < 1) result.bar = 'hidden';
    const button = bar.querySelector('button').getBoundingClientRect();
    result.barHeight = Math.round(b.height);
    result.barButton = `${button.width.toFixed(1)}×${button.height.toFixed(1)}`;
    result.targets += 1;
    result.minTargetWidth = Math.min(result.minTargetWidth ?? Infinity, button.width);
    result.minTargetHeight = Math.min(result.minTargetHeight ?? Infinity, button.height);
    if (button.width < 43.5 || button.height < 43.5) result.small.push(`help-bar ${result.barButton}`);
    const barHit = document.elementFromPoint(button.left + button.width / 2, button.top + button.height / 2);
    if (!barHit || !bar.querySelector('button').contains(barHit)) result.blocked.push('help-bar');
    window.scrollTo(0, document.documentElement.scrollHeight);
    await sleep();
    const content = [...document.querySelectorAll('main *, .site-foot *')].filter((el) => el.children.length === 0 && el.getBoundingClientRect().height > 0);
    const lowest = Math.max(...content.map((el) => el.getBoundingClientRect().bottom));
    result.endClearance = Math.round(bar.getBoundingClientRect().top - lowest);
  }
  window.scrollTo(0, 0);
  return result;
});

const rows = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function session(vp, large, init) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 2, permissions: ['clipboard-read', 'clipboard-write'] });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  if (large) await page.locator('[data-action="large"]').click();
  return { context, page, errors };
}

async function shot(page, name, { full = false, metrics = true } = {}) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const row = metrics ? await audit(page) : {};
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: out(`${name}.png`), fullPage: full });
  rows.push({ name, ...row });
}

const toHome = async (page) => {
  for (let i = 0; i < 3 && !(await page.locator('.masthead').count()); i += 1) await page.locator('[data-action="back"]').click();
};

for (const vp of viewports) {
  for (const large of vp.mobile ? [false, true] : [false, true]) {
    const tag = `${vp.name}${large ? '-large' : ''}`;
    const { context, page, errors } = await session(vp, large);
    await shot(page, `home-${tag}`);
    await shot(page, `home-${tag}-full`, { full: true, metrics: false });
    await page.locator('[data-action="quick"][data-scene="teacher_leave"]').click();
    await shot(page, `card-teacher-natural-${tag}`);
    await shot(page, `card-teacher-natural-${tag}-full`, { full: true, metrics: false });
    await page.locator('[data-action="tier"][data-id="very_nervous"]').click();
    await shot(page, `card-teacher-short-${tag}`);
    await page.locator('[data-action="copy-opening"]').click();
    await page.locator('.copy-status.ok').waitFor();
    await shot(page, `card-teacher-short-copied-${tag}`);
    await page.locator('[data-action="tier"][data-id="awkward"]').click();
    await page.locator('[data-action="copy-full"]').click();
    await page.locator('.copy-status.ok').waitFor();
    rows.push({ name: `card-teacher-full-copied-${tag}`, ...await audit(page) });
    await page.locator('.copy-status.ok').scrollIntoViewIfNeeded();
    await page.screenshot({ path: out(`card-teacher-full-copied-${tag}.png`) });
    await page.locator('[data-action="complete"]').click();
    rows.push({ name: `card-teacher-recorded-${tag}`, ...await audit(page) });
    await page.locator('.done-row').scrollIntoViewIfNeeded();
    await page.screenshot({ path: out(`card-teacher-recorded-${tag}.png`) });
    await page.locator('.record [data-action="badges"]').click();
    await shot(page, `badges-one-${tag}`, { full: true });
    await page.locator('[data-action="show-clear"]').click();
    rows.push({ name: `badges-clear-dialog-${tag}`, ...await audit(page) });
    await page.screenshot({ path: out(`badges-clear-dialog-${tag}.png`) });
    await page.locator('[data-action="cancel-clear"]').click();
    await page.locator('[data-action="back"]').click();
    await page.locator('[data-action="quick"][data-scene="refund"]').click();
    await page.locator('[data-action="tier"][data-id="very_nervous"]').click();
    await shot(page, `card-refund-short-opening-only-${tag}`, { full: true });
    await toHome(page);
    await page.locator('[data-action="recipient"][data-id="friend"]').click();
    await shot(page, `scenes-friend-${tag}`, { full: true });
    await page.locator('[data-action="scene"][data-id="old_friend"]').click();
    await shot(page, `card-old-friend-long-name-${tag}`, { full: true });
    await page.locator('[data-action="back"]').click();
    await page.locator('[data-action="scene"][data-id="help_money"]').click();
    await shot(page, `help-card-money-natural-${tag}`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.screenshot({ path: out(`help-card-money-natural-${tag}-end.png`) });
    await page.locator('[data-action="tier"][data-id="very_nervous"]').click();
    await shot(page, `help-card-money-short-${tag}`, { metrics: true });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.screenshot({ path: out(`help-card-money-short-${tag}-end.png`) });
    await page.locator('.help-bar button').click();
    await shot(page, `help-resources-${tag}`);
    await page.screenshot({ path: out(`help-resources-${tag}-full.png`), fullPage: true });
    await page.locator('[data-action="copy-help"]').click();
    await page.locator('.copy-status.ok').waitFor();
    rows.push({ name: `help-resources-copied-${tag}`, ...await audit(page) });
    await page.locator('.copy-status.ok').scrollIntoViewIfNeeded();
    await page.screenshot({ path: out(`help-resources-copied-${tag}.png`) });
    await page.locator('[data-action="help-return"]').click();
    await page.locator('[data-action="end-help"]').click();
    await shot(page, `help-done-${tag}`);
    await toHome(page);
    await page.locator('[data-action="recipient"][data-id="partner"]').click();
    await page.locator('[data-action="scene"][data-id="after_argument"]').click();
    await shot(page, `card-after-argument-${tag}`, { full: true });
    rows.push({ name: `errors-${tag}`, errors });
    await context.close();
  }
}

for (const vp of viewports.slice(0, 2)) {
  const fail = await session(vp, false, () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
  });
  await fail.page.locator('[data-action="quick"][data-scene="teacher_leave"]').click();
  await fail.page.locator('[data-action="copy-opening"]').click();
  await fail.page.locator('.copy-status.fail').waitFor();
  await shot(fail.page, `copy-fail-${vp.name}`);
  rows.push({ name: `copy-fail-errors-${vp.name}`, errors: fail.errors });
  await fail.context.close();

  const noStore = await session(vp, false, () => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new Error('denied'); } });
  });
  await shot(noStore.page, `storage-unavailable-home-${vp.name}`);
  await noStore.page.locator('[data-action="quick"]').first().click();
  await noStore.page.locator('[data-action="complete"]').click();
  rows.push({ name: `storage-unavailable-recorded-${vp.name}`, ...await audit(noStore.page), errors: noStore.errors });
  await noStore.page.locator('.done-row').scrollIntoViewIfNeeded();
  await noStore.page.screenshot({ path: out(`storage-unavailable-recorded-${vp.name}.png`) });
  await noStore.context.close();

  const empty = await session(vp, false);
  await empty.page.goto(`${base}#badges`);
  await shot(empty.page, `badges-empty-${vp.name}`);
  await empty.context.close();
}

await browser.close();
writeFileSync(out('measurements.json'), JSON.stringify(rows, null, 1));
const problems = rows.filter((row) => row.overflowX || row.small?.length || row.blocked?.length || (row.endClearance !== undefined && row.endClearance < 0) || row.errors?.length);
console.log(JSON.stringify({ states: rows.length, problems }, null, 1));
