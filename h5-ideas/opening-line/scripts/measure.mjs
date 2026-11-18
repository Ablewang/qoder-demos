import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const label = process.argv[2] ?? 'after';
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5213/';
const out = new URL(`../screenshots/${label}/`, import.meta.url);
mkdirSync(out, { recursive: true });

const viewports = [
  { name: '320x740', width: 320, height: 740 },
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
];

const box = async (page, selector, last = false) => {
  const all = page.locator(selector);
  const el = last ? all.last() : all.first();
  if (!(await el.count())) return null;
  const b = await el.boundingBox();
  if (!b) return null;
  const scroll = await page.evaluate(() => window.scrollY);
  return `${Math.round(b.y + scroll)}-${Math.round(b.y + b.height + scroll)}`;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = [];
for (const vp of viewports) {
  for (const large of [false, true]) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(base);
    if (large) await page.locator('[data-action="large"]').click();
    const tag = `${vp.name}${large ? '-large' : ''}`;
    const home = {
      pageHeight: await page.evaluate(() => document.documentElement.scrollHeight),
      firstQuick: await box(page, '[data-action="quick"]'),
      lastQuick: await box(page, '[data-action="quick"]', true),
      firstRecipient: await box(page, '[data-action="recipient"]'),
    };
    await page.screenshot({ path: new URL(`home-${tag}.png`, out).pathname });
    await page.locator('[data-action="quick"]').first().click();
    const statesPage = {
      cta: await box(page, '[data-action="default-card"]'),
      state: await box(page, '[data-action="state"]'),
    };
    if (statesPage.cta) await page.locator('[data-action="default-card"]').click();
    const card = {
      opening: await box(page, '#opening-line'),
      copy: await box(page, '[data-action^="copy"]'),
      nextVariant: await box(page, '[data-action="next-variant"]'),
      complete: await box(page, '[data-action="complete"]'),
    };
    await page.screenshot({ path: new URL(`card-${tag}.png`, out).pathname });
    await page.locator('.brand').click();
    await page.locator('[data-action="recipient"][data-id="friend"]').click();
    await page.locator('[data-action="scene"][data-id="help_chat"]').click();
    const helpCard = {
      notice: await box(page, '.notice'),
      opening: await box(page, '#opening-line'),
      copy: await box(page, '[data-action^="copy"]'),
      endHelp: await box(page, '[data-action="end-help"]'),
      helpBarTop: await page.evaluate(() => Math.round(document.querySelector('.help-bar')?.getBoundingClientRect().top ?? -1)),
    };
    await page.screenshot({ path: new URL(`help-card-${tag}.png`, out).pathname });
    rows.push({ tag, viewportHeight: vp.height, home, statesPage, card, helpCard });
    await context.close();
  }
}
await browser.close();
console.log(JSON.stringify(rows, null, 1));
