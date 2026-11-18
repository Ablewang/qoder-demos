import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const library = path.join(root, 'official-library');
const defaultUrl = pathToFileURL(path.join(library, 'index.html')).href;
const target = process.env.OFFICIAL_LIBRARY_URL || defaultUrl;
assert([defaultUrl, 'http://127.0.0.1:5177/official-library/index.html'].includes(target), 'Only the isolated reference reader can be tested.');
const label = target.startsWith('file:') ? 'offline' : 'development';
const manifest = JSON.parse(await fs.readFile(path.join(library, 'index.json'), 'utf8'));
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await context.addInitScript(() => {
  window.__archiveStorageWrites = [];
  for (const name of ['setItem', 'removeItem', 'clear']) {
    const original = Storage.prototype[name];
    Storage.prototype[name] = function (...args) {
      window.__archiveStorageWrites.push('Storage.' + name);
      return original.apply(this, args);
    };
  }
  const transaction = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (...args) {
    if (args[1] && args[1] !== 'readonly') window.__archiveStorageWrites.push('IndexedDB.' + args[1]);
    return transaction.apply(this, args);
  };
  for (const [type, name] of [[IDBFactory, 'deleteDatabase'], [IDBDatabase, 'createObjectStore'], [IDBDatabase, 'deleteObjectStore']]) {
    const original = type.prototype[name];
    type.prototype[name] = function (...args) {
      window.__archiveStorageWrites.push('IndexedDB.' + name);
      return original.apply(this, args);
    };
  }
});
const page = await context.newPage();
const errors = [];
const external = [];
const storageWrites = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  const url = request.url();
  if (!url.startsWith('file:') && !url.startsWith('data:') && !url.startsWith('http://127.0.0.1:5177/') && !url.startsWith('ws://127.0.0.1:5177/')) external.push(url);
});
await page.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
const checks = [];
const check = message => { checks.push(message); console.log('PASS', message); };
const reset = async () => {
  storageWrites.push(...await page.evaluate(() => window.__archiveStorageWrites || []));
  await page.goto(target);
  await page.locator('#workspace').waitFor({ state: 'visible' });
};
const openRecord = async record => {
  await page.evaluate(id => { location.hash = '#page=' + id; }, record.id);
  await page.locator('#reader-view').waitFor({ state: 'visible' });
  await page.waitForFunction(title => document.querySelector('#reader-title').textContent === title, record.title);
};
const assertWidth = async () => {
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth }));
  assert(widths.scroll <= widths.inner + 1, JSON.stringify(widths));
};
try {
  await reset();
  assert.equal(await page.locator('#entry-list > .entry').count(), Math.min(50, manifest.pages.length));
  assert.equal(await page.locator('#stat-pages').innerText(), manifest.counts.sourcePagesOk.toLocaleString('zh-CN'));
  check('real corpus loads; source pages and derived documents are counted separately');

  const firstIds = await page.locator('#entry-list .entry-title').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  assert.deepEqual(firstIds, manifest.pages.slice(0, 50).map(record => '#page=' + record.id));
  if (manifest.pages.length > 50) {
    await page.locator('#list-pagination').getByRole('button', { name: '下一页', exact: true }).click();
    const secondIds = await page.locator('#entry-list .entry-title').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
    assert.deepEqual(secondIds, manifest.pages.slice(50, 100).map(record => '#page=' + record.id));
    const before = await page.locator('#result-range').innerText();
    await page.locator('#entry-list .entry-title').first().click();
    await page.locator('#reader-view').waitFor({ state: 'visible' });
    await page.locator('#reader-view').getByRole('link', { name: '← 返回目录', exact: true }).click();
    assert.equal(await page.locator('#result-range').innerText(), before);
  }
  check('50-row pagination and return preserve the actual page');

  await reset();
  await page.locator('#category-nav button').filter({ hasText: '装备道具' }).click();
  const equipmentPages = manifest.pages.filter(record => record.category === '装备道具');
  assert((await page.locator('#result-count').innerText()).includes(equipmentPages.length.toLocaleString('zh-CN')));
  check('category filtering matches archived records');

  await page.locator('#clear-filters').click();
  await page.locator('#query').fill('亡骨刀');
  await page.locator('#search-form').getByRole('button', { name: '查询', exact: true }).click();
  const expectedSearch = await page.evaluate(() => window.OFFICIAL_LIBRARY.pages.filter(record => (record.title + ' ' + (record.text || '')).toLowerCase().includes('亡骨刀')).length);
  assert(expectedSearch > 0);
  assert((await page.locator('#result-count').innerText()).includes(expectedSearch.toLocaleString('zh-CN')));
  await page.locator('#search-mode').selectOption('title');
  const expectedTitles = manifest.pages.filter(record => record.title.includes('亡骨刀')).length;
  assert.equal(await page.locator('#entry-list > .entry').count(), expectedTitles);
  check('full-text and title queries differ and use real named equipment');

  const xml = manifest.pages.find(record => record.bodyMode === 'data-derived' && record.url.endsWith('/items.xml'));
  assert(xml);
  await openRecord(xml);
  assert((await page.locator('#reader-body').innerText()).includes('亡骨刀'));
  assert((await page.locator('#reader-body').innerText()).includes('uint是精炼加值单位'));
  assert.equal(await page.locator('#reader-body table tr').count(), 745);
  assert(await page.locator('#reader-downloads').getByRole('link', { name: '下载原始数据资源（不执行）', exact: true }).count());
  check('744 XML records remain original material/refinement data, not fabricated base stats');

  const skills = manifest.pages.filter(record => record.bodyMode === 'data-derived' && record.url.includes('/imitator/js/'));
  assert.equal(skills.length, 10);
  const seeker = skills.find(record => record.url.endsWith('/jianling.js'));
  await openRecord(seeker);
  const skillText = await page.locator('#reader-body').innerText();
  assert(skillText.includes('玄武剑诀') && skillText.includes('10+2*level') && skillText.replace(/\s/g, '').includes('[13,18,23,28,33,38,43,48,53,58]'));
  check('ten classes of literal skill data load; source formulas are retained without execution');

  const weapon = manifest.pages.find(record => record.url.includes('/29859.shtml'));
  assert(weapon);
  await openRecord(weapon);
  assert((await page.locator('#reader-body').innerText()).includes('长兵'));
  const internal = page.locator('#reader-body a[href^="#page="]').first();
  const internalHref = await internal.getAttribute('href');
  await internal.click();
  await page.waitForFunction(hash => location.hash === hash, internalHref);
  check('real weapon category navigation resolves to archived pages');

  await page.evaluate(() => { location.hash = '#gaps'; });
  await page.locator('#gaps-view').waitFor({ state: 'visible' });
  await page.locator('#gap-kind').selectOption('source-conflict');
  assert((await page.locator('#gap-list').innerText()).includes('大地之石'));
  await page.locator('#gap-kind').selectOption('');
  await page.locator('#gap-scope').selectOption('excluded');
  const excludedCount = manifest.excluded.length;
  assert((await page.locator('#gap-count').innerText()).includes(excludedCount.toLocaleString('zh-CN')));
  check('source conflict and intentional account/payment exclusions remain visible');

  const illustrated = manifest.pages.find(record => record.url.includes('/36701.shtml') && record.status === 'ok');
  assert(illustrated);
  await openRecord(illustrated);
  const image = page.locator('#reader-body img').first();
  await image.scrollIntoViewIfNeeded();
  await image.focus();
  await image.press('Enter');
  await page.waitForFunction(() => document.querySelector('#image-dialog').open);
  await page.waitForFunction(() => document.querySelector('#zoom-image').complete && document.querySelector('#zoom-image').naturalWidth > 0);
  await page.locator('#zoom-size').click();
  assert.equal(await page.locator('#zoom-size').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#image-dialog').open);
  assert(await image.evaluate(node => node === document.activeElement));
  check('archived source image opens from keyboard, native-size mode works, Escape restores focus');

  const rawLink = page.locator('#reader-downloads a[download]').first();
  const downloadEvent = page.waitForEvent('download');
  await rawLink.click();
  const download = await downloadEvent;
  assert(download.suggestedFilename().endsWith('.html.txt'));
  const downloadedPath = await download.path();
  assert(downloadedPath && (await fs.stat(downloadedPath)).size > 0);
  assert.deepEqual(await fs.readFile(downloadedPath), await fs.readFile(path.join(library, illustrated.rawPath)));
  const jsonDownloadEvent = page.waitForEvent('download');
  await page.locator('#reader-downloads').getByRole('link', { name: '条目 JSON', exact: true }).click();
  const jsonDownload = await jsonDownloadEvent;
  assert.deepEqual(JSON.parse(await fs.readFile(await jsonDownload.path(), 'utf8')), JSON.parse(await fs.readFile(path.join(library, illustrated.dataPath), 'utf8')));
  check('raw bytes and full entry JSON download offline and are not executed');

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await reset();
    await assertWidth();
    await page.screenshot({ path: path.join(root, 'artifacts', `official-library-${label}-${width}.png`), fullPage: false });
    await openRecord(xml);
    await assertWidth();
    const table = page.locator('#reader-body .table-scroll').last();
    await table.scrollIntoViewIfNeeded();
    const bounds = await table.evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth }));
    assert(bounds.width > 0 && bounds.scroll >= bounds.width);
    await page.screenshot({ path: path.join(root, 'artifacts', `official-library-${label}-table-${width}.png`), fullPage: false });
  }
  check('1440/768/390/320 layouts have no whole-page overflow; tables scroll independently');

  await reset();
  await page.locator('#query').fill('<img src=x onerror=window.__bad=1>');
  await page.locator('#search-form').getByRole('button', { name: '查询', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__bad), undefined);
  assert.equal(await page.locator('#result-count img').count(), 0);
  await page.evaluate(() => { location.hash = '#page=not-found'; });
  await page.waitForFunction(() => document.querySelector('#reader-title').textContent === '未找到这条归档资料');
  check('unknown IDs and unsafe query text do not fabricate records or inject markup');

  storageWrites.push(...await page.evaluate(() => window.__archiveStorageWrites || []));
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(storageWrites, []);
  check('reading makes no external requests, runtime errors, game-save writes or account calls');
  console.log(JSON.stringify({ label, checks: checks.length, errors, external, counts: manifest.counts }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
