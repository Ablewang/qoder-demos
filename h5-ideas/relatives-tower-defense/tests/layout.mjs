import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('./screenshots/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const baseline = process.argv.includes('--before');
const metrics = [];
async function click(page, selector) {
  await page.locator(selector).waitFor({ state: 'visible' });
  await page.waitForFunction(s => { const el = document.querySelector(s); return el && !el.disabled; }, selector);
  await page.locator(selector).click();
}
async function inspect(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const data = await page.evaluate(() => {
    const box = el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    return {
      viewport: [innerWidth, innerHeight], scrollY, scrollWidth: document.documentElement.scrollWidth,
      cards: [...document.querySelectorAll('[data-card]')].map(el => ({ card: el.dataset.card, ...box(el), font: getComputedStyle(el.querySelector('.answer-text')).fontSize, clipped: el.querySelector('.answer-text').scrollHeight > el.querySelector('.answer-text').clientHeight })),
      controls: [...document.querySelectorAll('[data-action="sound"], [data-action="pause"], [data-action="read"]')].map(el => ({ action: el.dataset.action, ...box(el) })),
      questions: [...document.querySelectorAll('.question-bubble')].map(el => ({ ...box(el), font: getComputedStyle(el.querySelector('strong')).fontSize })),
      feedback: document.querySelector('.speech')?.innerText,
      animation: document.querySelector('.speech')?.getAnimations().length ?? 0,
    };
  });
  metrics.push({ name, ...data });
  await page.screenshot({ path: `${output}${name}.png`, fullPage: false });
  if (!baseline) {
    assert.equal(data.cards.length, 4);
    assert(data.cards.every(card => card.top >= 0 && card.bottom <= data.viewport[1] && card.height >= 44 && !card.clipped), `${name}四牌需完整首屏：${JSON.stringify(data.cards)}`);
    assert(data.controls.every(control => control.height >= 44 && control.width >= 44), `${name}触控区至少44px`);
    assert(data.questions.every(question => question.bottom <= data.cards[0].top), `${name}题目不可被牌区覆盖`);
    assert(data.scrollWidth <= data.viewport[0]);
    assert(data.cards.every(card => Number.parseFloat(card.font) >= 14));
    for (const card of data.cards) {
      const hit = await page.evaluate(card => {
        const element = document.elementFromPoint(card.width / 2 + (card.card === 'counter' || card.card === 'sincere' ? innerWidth / 2 : 0), (card.top + card.bottom) / 2);
        return element?.closest('[data-card]')?.getAttribute('data-card');
      }, card);
      assert.equal(hit, card.card, `${name}牌区不可被遮挡`);
    }
  }
}
try {
  for (const [width, height] of baseline ? [[320, 740]] : [[320, 740], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await context.addInitScript(() => { Date.now = () => 42; });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5211');
    await click(page, '[data-action="start"]');
    await inspect(page, `${baseline ? 'before' : 'after'}-first-${width}-viewport`);
    while (!(await page.locator('[data-reward="soup"]').count())) {
      await page.evaluate(() => {
        document.querySelector('[data-action="read"]')?.click();
        document.querySelector('[data-card="taiji"]:not(:disabled)')?.click();
      });
      await page.waitForTimeout(100);
    }
    if (!baseline) {
      const reward = await page.locator('.dialog').boundingBox();
      assert(reward.y >= 0 && reward.y + reward.height <= height);
      for (const option of await page.locator('[data-reward]').all()) {
        const bounds = await option.boundingBox();
        assert(bounds.height >= 44 && bounds.y + bounds.height <= height);
      }
      await page.screenshot({ path: `${output}after-reward-${width}-viewport.png` });
    }
    await click(page, '[data-reward="soup"]');
    await click(page, '[data-action="read"]');
    await page.waitForFunction(() => document.querySelectorAll('.question-bubble').length === 2);
    await inspect(page, `${baseline ? 'before' : 'after'}-two-${width}-viewport`);
    if (!baseline) {
      assert.match(await page.locator('.speech').innerText(), /上一问/);
      assert.equal(await page.locator('.speech').getAttribute('data-feedback-relation'), 'previous');
      await click(page, '.question-bubble:not(.targeted)');
      const reading = await page.locator('[data-live="reading"]').innerText();
      assert.match(reading, /免费读牌 8 秒/);
      await click(page, '.question-bubble.targeted');
      assert.match(await page.locator('[data-live="reading"]').innerText(), /免费读牌 [78] 秒/);
      await click(page, '[data-action="pause"]');
      const frozen = await page.locator('[data-live="elapsed"]').innerText();
      await page.waitForTimeout(600);
      assert.equal(await page.locator('[data-live="elapsed"]').innerText(), frozen);
      const dialog = await page.locator('.dialog').boundingBox();
      assert(dialog.y >= 0 && dialog.y + dialog.height <= height);
      await page.screenshot({ path: `${output}after-pause-${width}-viewport.png` });
      await click(page, '.pause-rules summary');
      const expanded = await page.locator('.dialog').boundingBox();
      assert(expanded.y >= 0 && expanded.y + expanded.height <= height);
      const finish = await page.locator('[data-action="finish"]').boundingBox();
      assert(finish.height >= 44 && finish.y + finish.height <= height);
      await page.screenshot({ path: `${output}after-pause-rules-${width}-viewport.png` });
      await click(page, '.pause-rules summary');
      await click(page, '[data-action="resume"]');
      await click(page, '[data-card="sincere"]');
      await page.waitForFunction(() => document.querySelector('.speech')?.getAttribute('data-feedback-kind') === 'ally', { timeout: 20000 });
      await inspect(page, `after-ally-${width}-viewport`);
      assert.match(await page.locator('.speech').innerText(), /盟友救场/);
      assert.equal(await page.locator('.speech').evaluate(el => el.getAnimations().length), 0);
      await click(page, '[data-action="pause"]');
      await click(page, '[data-action="finish"]');
      await page.locator('.result').waitFor();
      await click(page, '[data-action="restart"]');
      assert.equal(await page.locator('[data-card="sincere"] em').innerText(), '剩 3');
    }
    await context.close();
    if (!baseline) {
      const fixtureContext = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const fixture = await fixtureContext.newPage();
      await fixture.goto('http://127.0.0.1:5211');
      await click(fixture, '[data-action="start"]');
      const stress = await fixture.evaluate(async () => {
        const { questions, cards } = await import('/src/content.ts');
        const visitors = document.querySelector('.visitors');
        visitors.append(visitors.firstElementChild.cloneNode(true));
        let maximum = 0, worst = '';
        for (const question of questions) {
          document.querySelectorAll('.question-bubble strong').forEach(el => { el.textContent = question.text; });
          for (const card of cards) document.querySelector(`[data-card="${card}"] .answer-text`).textContent = question.answers[card];
          document.querySelector('.speech p').textContent = `「${question.text}」队友已替你挡下一问`;
          const bottom = Math.max(...[...document.querySelectorAll('[data-card]')].map(el => el.getBoundingClientRect().bottom));
          if (bottom > maximum) { maximum = bottom; worst = question.id; }
          for (const el of document.querySelectorAll('.answer-text')) if (el.scrollHeight > el.clientHeight) throw new Error(`卡面截字：${question.id}`);
        }
        return { fixtureOnly: true, questionCount: questions.length, answerCount: questions.length * cards.length, maximumCardBottom: maximum, worstQuestion: worst, viewport: [innerWidth, innerHeight] };
      });
      assert(stress.maximumCardBottom <= height, `全题库静态布局压力测试：${JSON.stringify(stress)}`);
      metrics.push({ name: `all-content-layout-fixture-${width}`, ...stress });
      await fixtureContext.close();
    }
  }
  await writeFile(fileURLToPath(new URL(baseline ? './layout-before.json' : './layout-results.json', import.meta.url)), JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify(metrics, null, 2));
} finally { await browser.close(); }
