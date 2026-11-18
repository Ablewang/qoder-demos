import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const preview = fileURLToPath(new URL('.', import.meta.url));
const project = fileURLToPath(new URL('../../', import.meta.url));
const evidenceRoot = preview + 'shots-round2/';
const editable = ['art.js', 'style.css', 'preview.js'];
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
async function walk(directory, excluded = []) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.includes(entry.name)) continue;
    const path = directory + entry.name;
    if (entry.isDirectory()) paths.push(...await walk(path + '/', excluded));
    else if (entry.isFile()) paths.push(path);
  }
  return paths;
}
async function protectedHashes() {
  const paths = [
    ...await walk(project + 'src/'),
    ...await walk(project + 'tests/', ['design-preview']),
    ...await walk(preview, [...editable, 'shots-round2', 'review-round2.mjs']),
    ...['PRD.md', 'PLAN.md', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'index.html'].map(name => project + name),
  ];
  return Object.fromEntries(await Promise.all(paths.map(async path => [path.slice(project.length), hash(await readFile(path))])));
}
assert(!process.argv.includes('--baseline'), '已有修改前基线必须保留，本脚本仅验证，不重建基线');
const existingEvidence = Object.fromEntries(await Promise.all((await walk(evidenceRoot)).map(async path => [path, hash(await readFile(path))])));
const output = await mkdtemp(evidenceRoot + 'verification-') + '/';
console.log(`本次新证据目录：${output}`);
const baseline = JSON.parse(await readFile(evidenceRoot + 'baseline.json', 'utf8'));
assert.deepEqual(await protectedHashes(), baseline.protected, '本轮保护文件不得变化');
const art = await readFile(preview + 'art.js', 'utf8');
assert.equal(art.split('export function openingSign()')[0], baseline.editableBefore['art.js'].split('export function openingSign()')[0]);
assert.equal(art.split('export function cardIcon')[1], baseline.editableBefore['art.js'].split('export function cardIcon')[1]);
const css = (await readFile(preview + 'style.css', 'utf8')).split('\n');
const cssBefore = baseline.editableBefore['style.css'].split('\n');
for (const index of [0, 1, 2, 4, 5]) assert.equal(css[index], cssBefore[index], '非战斗CSS保持不变');
const script = await readFile(preview + 'preview.js', 'utf8');
assert.equal(script.split('function battle()')[0], baseline.editableBefore['preview.js'].split('function battle()')[0]);
assert.equal(script.split("root.querySelectorAll('[data-seat]')")[1], baseline.editableBefore['preview.js'].split("root.querySelectorAll('[data-seat]')")[1], '静态事件处理与战报保持不变');
const originals = JSON.parse(await readFile(project + 'src/content/questions.json', 'utf8'));
const byId = id => originals.find(question => question.id === id);
let browser;
const clicks = [];
const results = [];
const errors = [];
const net = [];
async function inspect(page, name) {
  const data = await page.evaluate(name => {
    const luminance = color => { const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return values[0] * .2126 + values[1] * .7152 + values[2] * .0722; };
    const reply = document.querySelector('.reply-to');
    const a = reply ? luminance(getComputedStyle(reply).color) : 0;
    const b = reply ? luminance(getComputedStyle(document.querySelector('.read-row')).backgroundColor) : 0;
    const box = element => { const r = element.getBoundingClientRect(); return { x: r.x, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    const read = document.querySelector('.read-row');
    let readHeightBefore;
    if (read) {
      const before = read.cloneNode(true);
      before.querySelector('.reading-copy').replaceWith(before.querySelector('[data-reading]'));
      before.style.cssText = `position:absolute;visibility:hidden;width:${read.getBoundingClientRect().width}px`;
      document.body.append(before);
      readHeightBefore = before.getBoundingClientRect().height;
      before.remove();
    }
    return {
      name, viewport: [innerWidth, innerHeight], visible: document.visibilityState, scrollY,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      target: document.querySelector('.question[aria-pressed=true]')?.dataset.seat,
      responseTo: document.querySelector('.reply-to')?.textContent,
      replyContrast: reply ? (Math.max(a, b) + .05) / (Math.min(a, b) + .05) : null,
      controls: [...document.querySelectorAll('button, a')].map(element => ({ label: element.textContent || element.getAttribute('aria-label'), ...box(element) })),
      questions: [...document.querySelectorAll('.question')].map(element => ({ id: element.dataset.question, selected: element.getAttribute('aria-pressed'), text: element.querySelector('.question-text').textContent, stroke: getComputedStyle(element.querySelector('.speech-outline')).stroke, strokeWidth: parseFloat(getComputedStyle(element.querySelector('.speech-outline')).strokeWidth), ...box(element) })),
      texts: [...document.querySelectorAll('.answer-text, .question-text')].map(element => ({ text: element.textContent, font: parseFloat(getComputedStyle(element).fontSize), clipped: element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1 })),
      cards: [...document.querySelectorAll('[data-card]')].map(element => { const r = element.getBoundingClientRect(); return { card: element.dataset.card, text: element.querySelector('.answer-text').textContent, ...box(element), hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[data-card]')?.dataset.card }; }),
      readHeight: read?.getBoundingClientRect().height,
      readHeightBefore,
      readingText: document.querySelector('[data-reading]')?.textContent,
      staticLabel: document.querySelector('.review-label')?.textContent,
      cardBackgrounds: [...document.querySelectorAll('[data-card]')].map(element => getComputedStyle(element).backgroundColor),
      animations: document.getAnimations().length,
    };
  }, name);
  assert(!data.horizontalOverflow);
  assert(data.controls.every(control => control.width >= 44 && control.height >= 44), '触控区≥44');
  assert(data.texts.every(text => text.font >= 14 && !text.clipped), '原文不能缩字或裁切');
  results.push(data);
  await writeFile(output + name + '.png', await page.screenshot({ fullPage: false }), { flag: 'wx' });
  assert.equal(data.animations, 0);
  assert.equal(data.visible, 'visible');
  assert(data.staticLabel.includes('静态设计评审') && data.staticLabel.includes('合成示例') && data.staticLabel.includes('未接引擎'));
  if (data.cards.length) {
    assert.equal(data.cards.length, 4);
    assert(data.cards.every(card => card.bottom <= data.viewport[1] && card.hit === card.card));
    assert(data.questions.every(question => question.bottom <= data.cards[0].top));
    for (const question of data.questions) assert.equal(question.text, byId(question.id).text);
    const selectedQuestion = data.questions.find(question => question.selected === 'true');
    for (const card of data.cards) assert.equal(card.text, byId(selectedQuestion.id).answers[card.card]);
    assert(data.responseTo.includes(data.target === 'left' ? '奶奶' : '大姨'));
    if (data.questions.length === 2) assert(selectedQuestion.strokeWidth > data.questions.find(question => question.selected !== 'true').strokeWidth);
    assert.equal(data.readHeight, data.readHeightBefore, '接话提示不增加原读窗高度');
    assert(data.readHeight >= 44);
    assert.equal(new Set(data.cardBackgrounds).size, 1);
    assert(data.replyContrast >= 4.5);
  }
}
try {
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: !process.argv.includes('--headed') });
  for (const [width, height] of [[320, 740], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.method() !== 'GET' || !request.url().startsWith('http://127.0.0.1:5211/')) net.push({ method: request.method(), url: request.url() }); });
    await page.goto('http://127.0.0.1:5211/tests/design-preview/?view=home');
    await page.waitForFunction(() => !!window.designPreview);
    await inspect(page, `home-${width}x${height}`);
    await writeFile(output + `sign-${width}x${height}.png`, await page.locator('.opening-sign').screenshot(), { flag: 'wx' });
    await page.locator('.start').click();
    clicks.push({ width, action: '入席' });
    await page.waitForFunction(() => window.designPreview?.view === 'single');
    await inspect(page, `entry-single-${width}x${height}`);
    await page.goto('http://127.0.0.1:5211/tests/design-preview/?view=double');
    await page.waitForFunction(() => !!window.designPreview);
    await inspect(page, `double-right-${width}x${height}`);
    await page.locator('[data-seat="left"]').click();
    clicks.push({ width, action: '切到奶奶' });
    await inspect(page, `double-left-${width}x${height}`);
    for (const side of ['left', 'right']) {
      await page.locator(`[data-seat="${side}"]`).click();
      clicks.push({ width, action: '选择发问者', side });
      for (const card of ['taiji', 'counter', 'crazy', 'sincere']) {
        await page.locator(`[data-card="${card}"]`).click();
        assert((await page.locator(`[data-person="${side}"] .seat-note`).textContent()).includes({ taiji: '太极', counter: '反问', crazy: '发疯', sincere: '真心' }[card]));
        assert.equal(await page.locator('.mood b').textContent(), '100');
        clicks.push({ width, action: '原位静态接话', side, card, mood: 100 });
      }
      await inspect(page, `reply-${side}-${width}x${height}`);
    }
    await page.locator('[data-read]').click();
    assert.equal(await page.locator('[data-reading]').textContent(), '读好了 · 仅静态状态演示');
    clicks.push({ width, action: '读好了', staticOnly: true });
    await inspect(page, `read-done-${width}x${height}`);
    await page.goto('http://127.0.0.1:5211/tests/design-preview/?view=long');
    await page.waitForFunction(() => !!window.designPreview);
    await inspect(page, `long-${width}x${height}`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(net, []);
  assert.deepEqual(await protectedHashes(), baseline.protected);
  const changed = editable.filter(name => baseline.editableBefore[name] !== { 'art.js': art, 'style.css': css.join('\n'), 'preview.js': script }[name]);
  for (const [path, before] of Object.entries(existingEvidence)) assert.equal(hash(await readFile(path)), before, '已有本轮证据不得覆盖');
  for (const [name, before] of Object.entries({ 'art.js': art, 'style.css': css.join('\n'), 'preview.js': script })) assert.equal(await readFile(preview + name, 'utf8'), before, '验证期间源码保持不变');
  const report = { outcome: 'passed', staticOnly: true, browser: browser.version(), headed: process.argv.includes('--headed'), dpr: 2, touch: true, reducedMotion: 'reduce', productionGameVerified: false, visualApproval: '待主会话复审', existingArtifactsPreserved: true, existingRoundEvidence: existingEvidence, protectedFiles: Object.keys(baseline.protected).length, protectedHashes: baseline.protected, changed, errors, externalOrWriteRequests: net, clicks, results };
  await writeFile(output + 'report.json', JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ protectedFiles: report.protectedFiles, changed, errors, externalOrWriteRequests: net, results: results.map(r => ({ name: r.name, target: r.target, responseTo: r.responseTo, bottom: r.cards.length ? Math.max(...r.cards.map(c => c.bottom)) : null })) }, null, 2));
} catch (error) {
  await writeFile(output + 'failure.json', JSON.stringify({ outcome: 'failed', error: { name: error.name, message: error.message, stack: error.stack }, errors, externalOrWriteRequests: net, clicks, results }, null, 2), { flag: 'wx' });
  throw error;
} finally { await browser?.close(); }
