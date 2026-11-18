import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const label = process.argv[2];
if (!label) throw new Error('usage: node scripts/capture-polish.mjs <label>');
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5213/';
const outDir = new URL(`../screenshots/polish-2026-11-18/${label}/`, import.meta.url);
if (existsSync(outDir)) throw new Error(`refusing to overwrite ${outDir.pathname}`);
mkdirSync(outDir, { recursive: true });
const out = (name) => new URL(name, outDir).pathname;
const key = 'opening-line:achievements:v1';

// 130% text is simulated as 130% browser zoom: CSS viewport divided by 1.3.
const viewports = [
  { name: '320x740', width: 320, height: 740, scale: 2, mobile: true },
  { name: '390x844', width: 390, height: 844, scale: 2, mobile: true },
  { name: '1280x800', width: 1280, height: 800, scale: 1, mobile: false },
  { name: '320x740-zoom130', width: 246, height: 569, scale: 2.6, mobile: true },
  { name: '390x844-zoom130', width: 300, height: 649, scale: 2.6, mobile: true },
  { name: '1280x800-zoom130', width: 985, height: 615, scale: 1.3, mobile: false },
];

const audit = (page) => page.evaluate(async () => {
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const scope = document.querySelector('dialog[open]') ?? document;
  const result = { overflowX: document.documentElement.scrollWidth > innerWidth, clipped: [], small: [], blocked: [], targets: 0 };
  for (const el of document.querySelectorAll('main p, main h1, main h2, header h1, button, .help-bar p')) {
    if (el.offsetParent !== null && el.scrollWidth > el.clientWidth + 1) result.clipped.push(el.textContent.trim().slice(0, 16));
  }
  const opening = document.querySelector('#opening-line');
  if (opening) {
    const rect = opening.getBoundingClientRect();
    const copy = document.querySelector('[data-action="copy-opening"]').getBoundingClientRect();
    const bar = document.querySelector('.help-bar')?.getBoundingClientRect().top ?? innerHeight;
    result.openingFont = getComputedStyle(opening).fontSize;
    result.openingAndCopyFirstScreen = rect.top >= 0 && copy.bottom <= Math.min(innerHeight, bar);
  }
  for (const el of scope.querySelectorAll('button:not(:disabled), a[href]')) {
    if (el.offsetParent === null || el.closest('dialog:not([open])')) continue;
    el.scrollIntoView({ block: 'center' });
    await frame();
    const rect = el.getBoundingClientRect();
    result.targets += 1;
    result.minTarget = Math.min(result.minTarget ?? Infinity, Math.round(Math.min(rect.width, rect.height) * 10) / 10);
    const name = el.dataset.action ?? el.textContent.trim().slice(0, 12);
    if (rect.width < 43.5 || rect.height < 43.5) result.small.push(name);
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (!hit || !el.contains(hit)) result.blocked.push(name);
  }
  window.scrollTo(0, 0);
  await frame();
  return result;
});

const rows = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const vp of viewports) {
  for (const large of vp.name === '1280x800' || vp.name.endsWith('zoom130') ? [false] : [false, true]) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale, isMobile: vp.mobile, hasTouch: vp.mobile, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const tag = `${vp.name}${large ? '-large' : ''}`;
    const shot = async (state) => {
      const metrics = await audit(page);
      await page.screenshot({ path: out(`${state}-${tag}.png`) });
      await page.screenshot({ path: out(`${state}-${tag}-full.png`), fullPage: true });
      rows.push({ state, viewport: tag, cssViewport: `${vp.width}x${vp.height}`, ...metrics, pageErrors: [...errors] });
    };
    await page.goto(base);
    if (large) await page.locator('[data-action="large"]').click();
    await shot('home');
    await page.locator('[data-action="quick"][data-scene="refund"]').click();
    await shot('refund-natural');
    await page.locator('[data-action="copy-opening"]').click();
    await page.locator('.copy-status').waitFor();
    await shot('refund-copied');
    await page.locator('[data-action="tier"][data-id="very_nervous"]').click();
    await shot('refund-short');
    await page.locator('[data-action="back"]').click();
    await page.locator('[data-action="recipient"][data-id="partner"]').click();
    await page.locator('[data-action="scene"][data-id="after_argument"]').click();
    await shot('argument-natural');
    await page.locator('[data-action="tier"][data-id="very_nervous"]').click();
    await shot('argument-short');
    await page.locator('[data-action="back"]').click();
    await page.locator('[data-action="back"]').click();
    await page.locator('[data-action="badges"]').click();
    await shot('records-empty');
    await page.evaluate((storageKey) => localStorage.setItem(storageKey, JSON.stringify({ schemaVersion: 1, completions: [{ attemptId: 'polish-sample', completedDate: '2026-11-18' }] })), key);
    await page.reload();
    if (large) await page.locator('[data-action="large"]').click();
    await shot('records-one');
    await page.locator('[data-action="show-clear"]').click();
    await shot('records-clear-dialog');
    await page.locator('[data-action="cancel-clear"]').click();
    await page.locator('[data-action="home"]').click();
    await page.locator('[data-action="recipient"][data-id="friend"]').click();
    await page.locator('[data-action="scene"][data-id="help_chat"]').click();
    await shot('help-chat');
    await context.close();
  }
}
await browser.close();
writeFileSync(out('measurements.json'), JSON.stringify(rows, null, 2));
const issues = rows.filter((row) => row.overflowX || row.clipped.length || row.small.length || row.blocked.length || row.pageErrors.length || row.openingAndCopyFirstScreen === false);
console.log(JSON.stringify({ states: rows.length, issues: issues.map(({ state, viewport, overflowX, clipped, small, blocked, openingAndCopyFirstScreen, pageErrors }) => ({ state, viewport, overflowX, clipped, small, blocked, openingAndCopyFirstScreen, pageErrors })) }, null, 2));
