import { fork } from 'node:child_process';
import { createServer as httpServer } from 'node:http';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

if (!process.argv.includes('--worker')) {
  const child = fork(fileURLToPath(import.meta.url), ['--worker'], { detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  await new Promise((resolve, reject) => {
    child.once('message', message => { console.log(JSON.stringify(message)); child.disconnect(); child.unref(); resolve(); });
    child.once('error', reject);
    child.once('exit', code => { if (code) reject(new Error(`Worker failed: ${code}`)); });
  });
} else {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const output = await mkdtemp(path.join(root, 'tests/redesign-v1/visible-'));
  const vite = await createServer({ root, configFile: false, envDir: false, logLevel: 'silent', server: { host: '127.0.0.1', port: 0, open: false } });
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  const env = { ...process.env }; delete env.PWDEBUG;
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', env });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  const page = await context.newPage();
  const report = { complete: false, headless: true, noProbe: true, output, routes: [], errors: [], external: [] };
  page.on('pageerror', e => report.errors.push(String(e)));
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (/^https?:/.test(url) && new URL(url).origin !== origin) { report.external.push(url); await route.abort(); } else await route.continue();
  });
  let current;
  const save = async () => writeFile(path.join(output, 'visible-results.json'), JSON.stringify(report, null, 2));
  const snapshot = async () => {
    const phase = await page.evaluate(() => document.querySelector('.game-page')?.dataset.phase ?? 'result');
    const name = `${current?.label ?? 'home'}-${current?.steps.length ?? 0}-${phase}`;
    const screenshot = path.join(output, `${name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    const view = await page.evaluate(() => {
      const rect = el => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, width: r.width, height: r.height }; };
      return { phase: document.querySelector('.game-page')?.dataset.phase ?? 'result', node: document.querySelector('.game-page')?.dataset.node, ask: document.querySelector('.ask-copy')?.textContent,
        header: document.querySelector('.game-header')?.innerText,
        choices: [...document.querySelectorAll('.choice')].map(el => ({ id: el.dataset.choice, line: el.querySelector('.choice-line').textContent, risk: el.querySelector('.choice-risk').textContent, change: el.querySelector('.choice-watch').innerText, ...rect(el) })),
        reaction: document.querySelector('.reaction')?.innerText, replies: document.querySelector('.table-replies')?.innerText, ending: document.querySelector('.result-page')?.innerText,
        boxes: Object.fromEntries(['.ask-bubble', '.reaction', '.continue-row .primary'].flatMap(s => document.querySelector(s) ? [[s, rect(document.querySelector(s))]] : [])),
        pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, pageHeight: document.body.scrollHeight,
        probe: '__rtdGame' in window };
    });
    assert.equal(view.probe, false);
    assert.equal(view.pageWidth, view.viewportWidth);
    await save();
    return { screenshot, ...view };
  };
  const api = httpServer(async (req, res) => {
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const data = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      let result;
      if (req.url === '/begin') {
        assert(['direct', 'friend', 'risk', 'followup-risk'].includes(data.label));
        await page.goto(origin);
        current = { label: data.label, steps: [] }; report.routes.push(current);
        await page.locator('[data-action="start"]').tap();
        result = await snapshot(); current.start = result;
      } else if (req.url === '/view') result = await snapshot();
      else if (req.url === '/say') {
        assert.equal(typeof data.line, 'string'); assert.equal(typeof data.why, 'string');
        const before = await snapshot();
        const chosen = before.choices.find(o => o.line === data.line);
        assert(chosen, 'Choose one of the full visible utterances');
        await page.locator('.choice').filter({ has: page.locator('.choice-line', { hasText: data.line }) }).tap();
        const step = { before, chosen, why: data.why }; current.steps.push(step);
        step.after = await snapshot(); result = step.after;
      } else if (req.url === '/next') {
        await page.locator('[data-action="next"]').tap(); result = await snapshot();
        if (result.ending) { current.ending = result.ending; current.result = result.screenshot; }
      } else if (req.url === '/poster') {
        await page.locator('[data-action="poster"]').tap();
        await page.locator('.poster-image').waitFor();
        const promise = page.waitForEvent('download'); await page.locator('a[download]').tap();
        const download = await promise; assert.equal(await download.failure(), null);
        current.poster = path.join(output, `${current.label}-poster.png`); await download.saveAs(current.poster);
        await page.locator('[data-action="back"]').tap(); result = { poster: current.poster }; await save();
      } else if (req.url === '/close') {
        assert.deepEqual(report.errors, []); assert.deepEqual(report.external, []);
        report.complete = true; await save();
        await browser.close(); await vite.close();
        result = { complete: true, output, routes: report.routes.map(r => ({ label: r.label, path: r.steps.map(s => s.chosen.id), result: r.result, poster: r.poster })), errors: report.errors, external: report.external };
        api.close();
      } else throw new Error('Unsupported action');
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: String(error) }));
    }
  });
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  process.send({ control: `http://127.0.0.1:${api.address().port}`, output, pid: process.pid });
}
