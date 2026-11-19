import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { startDaemon } from '../../../src/daemon.ts';
import { loadConfig } from '../../../src/platform/config.ts';
import { createLogger } from '../../../src/platform/logger.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'test-results', 'real-daemon');
const cached = path.join(homedir(), 'Library', 'Caches', 'ms-playwright', 'chromium_headless_shell-1254', 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');

test('real daemon and headless client', { timeout: 90000 }, async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'wa-client-integration-'));
  const token = randomBytes(32).toString('base64url');
  const logs = [];
  let now = Date.now();
  let daemon, vite, browser;
  t.after(async () => {
    await browser?.close();
    await vite?.close();
    await daemon?.stop();
    rmSync(dir, { recursive: true, force: true });
  });
  mkdirSync(output, { recursive: true });
  const config = loadConfig({ WORK_AGENT_DATA_DIR: dir, WORK_AGENT_DEV_ORIGINS: 'http://127.0.0.1:1421' });
  config.portRange = [0, 0];
  daemon = await startDaemon({ config, eventRetention: 8, now: () => now, random: () => 0, secrets: { get: async () => token, set: async () => { throw new Error('unexpected secret write'); }, delete: async () => {} }, log: createLogger({ write: line => logs.push(line) }) });
  const streams = new Set();
  const streamFrames = [];
  const connect = daemon.events.connect;
  daemon.events.connect = (req, res) => {
    streams.add(res); res.on('close', () => streams.delete(res));
    const write = res.write.bind(res);
    res.write = (chunk, ...args) => {
      const frame = String(chunk);
      if (/event: (hello|resync_required|memory.changed)/.test(frame)) streamFrames.push({ checkpoint: req.headers['last-event-id'], frame });
      return write(chunk, ...args);
    };
    connect(req, res);
  };
  const base = `http://127.0.0.1:${daemon.info.port}/api/v1`;
  const call = async (endpoint, method = 'GET', value) => {
    const response = await fetch(base + endpoint, { method, headers: { Authorization: `Bearer ${token}`, ...(value === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
    const data = await response.json();
    assert.equal(response.status, 200, `HTTP ${method} ${endpoint}`);
    return data;
  };
  await call('/pet/settings', 'PUT', { offworkReminder: false, acceptDevNotices: true });
  vite = await createServer({ root, configFile: path.join(root, 'vite.config.ts'), server: { host: '127.0.0.1', port: 1421, strictPort: true, open: false } });
  await vite.listen();
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(cached) ? cached : undefined), args: ['--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await t.test('development Origin connects; default backend rejects it with visible connection feedback', async () => {
    const productionConfig = loadConfig({ WORK_AGENT_DATA_DIR: path.join(dir, 'origin-default') });
    productionConfig.portRange = [0, 0];
    let production = await startDaemon({ config: productionConfig, secrets: { get: async () => token, set: async () => { throw new Error('unexpected secret write'); }, delete: async () => {} }, log: createLogger({ write: line => logs.push(line) }) });
    const blocked = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    blocked.on('pageerror', error => errors.push(error.message));
    try {
      const origin = 'http://127.0.0.1:1421';
      const productionBase = `http://127.0.0.1:${production.info.port}/api/v1`;
      assert.equal((await fetch(productionBase + '/health')).status, 200);
      for (const [url, method, status] of [[productionBase + '/health', 'GET', 403], [productionBase + '/health', 'OPTIONS', 403], [base + '/health', 'GET', 200], [base + '/pet/state', 'GET', 401]]) {
        const response = await fetch(url, { method, headers: { Origin: origin, ...(method === 'OPTIONS' ? { 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } : {}) } });
        assert.equal(response.status, status);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), status === 403 ? null : origin);
      }
      const preflight = await fetch(base + '/pet/state', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
      assert.ok(preflight.ok);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
      assert.equal((await fetch(base + '/pet/state', { headers: { Origin: origin, Authorization: `Bearer ${token}` } })).status, 200);
      assert.equal((await fetch(base + '/health', { headers: { Origin: 'http://127.0.0.1:1420' } })).status, 403);
      await blocked.addInitScript(({ info, token }) => { window.__PET_TEST__ = { info, token }; }, { info: production.info, token });
      await blocked.goto(origin);
      await blocked.getByRole('button', { name: '唤醒', exact: true }).click();
      await expect(blocked.getByRole('alert')).toHaveText('本机连接失败，请重启后台和团子', { timeout: 15000 });
      await expect(blocked.getByRole('button', { name: '唤醒', exact: true })).toBeEnabled();
      await blocked.screenshot({ path: path.join(output, 'development-origin-error.png') });
      await production.stop();production = undefined;
      const recoveredConfig = loadConfig({ WORK_AGENT_DATA_DIR: productionConfig.dataDir, WORK_AGENT_DEV_ORIGINS: origin });
      recoveredConfig.portRange = [0, 0];
      production = await startDaemon({ config: recoveredConfig, secrets: { get: async () => token, set: async () => { throw new Error('unexpected secret write'); }, delete: async () => {} }, log: createLogger({ write: line => logs.push(line) }) });
      await blocked.evaluate(info => { window.__PET_TEST__.info = info; }, production.info);
      await expect(blocked.getByRole('button', { name: '先用默认', exact: true })).toBeVisible({ timeout: 10000 });
      await expect(blocked.locator('.wake-error')).toHaveCount(0);
      await expect(blocked.getByRole('button', { name: '唤醒', exact: true })).toBeHidden();
      await blocked.screenshot({ path: path.join(output, 'development-origin-recovered.png') });
    } finally { await blocked.close();await production?.stop(); }
  });
  await page.addInitScript(({ info, token }) => { window.__PET_TEST__ = { info, token }; }, { info: daemon.info, token });
  let gapNotice;
  await page.route('**/api/v1/stream', async route => {
    if (!gapNotice) gapNotice = await call('/notices', 'POST', { kind: 'dev.integration', title: '订阅空窗通知', facts: [], sensitivity: 'normal', evidence: [], tone: 'neutral', urgency: 'low', dedupeKey: 'subscription-gap' });
    await route.continue();
  });
  await page.goto('http://127.0.0.1:1421');
  const nav = page.locator('.browser-tools');
  const closeBubble = async () => { if (await page.locator('.bubble-close').isVisible()) await page.locator('.bubble-close').click(); };
  const send = async (message) => {
    await page.getByRole('textbox', { name: '聊天输入' }).fill(message);
    await page.getByRole('button', { name: '发送', exact: true }).click();
  };
  const notice = (title, sensitivity = 'normal') => ({ kind: 'dev.integration', title, facts: [{ label: '数量', value: '3' }, { label: '负责人', value: '张三' }, { label: '时间', value: '15:30' }, { label: '原文', value: '<script>window.injected=1</script>' }], sensitivity, evidence: [], tone: 'neutral', urgency: 'normal', dedupeKey: title });

  await t.test('onboarding writes real persona', async () => {
    await page.getByRole('button', { name: '先用默认', exact: true }).click();
    await expect(page.getByRole('button', { name: '全部标为已读' })).toBeVisible();
    assert.equal((await call('/pet/persona')).firstRun, false);
    await expect(page.getByRole('button', { name: '订阅空窗通知', exact: true })).toBeVisible();
    await call(`/notices/${gapNotice.id}/dismiss`, 'POST');
    await page.locator('.panel header button').click();
    await closeBubble();
  });
  const placementRegression = async () => {
    const placementConfig = loadConfig({ WORK_AGENT_DATA_DIR: path.join(dir, 'free-placement'), WORK_AGENT_DEV_ORIGINS: 'http://127.0.0.1:1421' });
    placementConfig.portRange = [0, 0];
    const isolated = await startDaemon({ config: placementConfig, secrets: { get: async () => token, set: async () => { throw new Error('unexpected secret write'); }, delete: async () => {} }, log: createLogger({ write: line => logs.push(line) }) });
    const client = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    client.on('pageerror', error => errors.push(error.message));
    let restored;
    try {
      await client.addInitScript(({ info, token }) => { window.__PET_TEST__ = { info, token }; }, { info: isolated.info, token });
      await client.route('**/src/bridge.ts', async route => {
        const response = await route.fetch();
        const body = await response.text();
        await route.fulfill({ response, body: body + `
const control = window.__FREE_POSITION__ = {
  geometry: { pet: { x: 420.25, y: 260.5, width: 160, height: 160 }, work: { x: 0, y: 0, width: 1100, height: 800 }, screenId: 'screen-a', scale: 1 },
  positions: [], frameQueries: 0, saves: [], frames: [{ id: 1, pid: 8, x: 100, y: 378, width: 800, height: 300 }]
};
bridge.geometry = async () => structuredClone(control.geometry);
bridge.frames = async () => { control.frameQueries++; return structuredClone(control.frames); };
bridge.position = async p => { control.positions.push(structuredClone(p)); Object.assign(control.geometry.pet, p); };
const saveSettings = bridge.save.bind(bridge);
bridge.save = async settings => { control.saves.push(structuredClone(settings)); await saveSettings(settings); };
${restored ? `bridge.settings = async () => (${JSON.stringify(restored)});` : ''}
` });
      });
      await client.goto('http://127.0.0.1:1421');
      await client.getByRole('button', { name: '先用默认', exact: true }).click();
      await expect(client.getByRole('button', { name: '全部标为已读', exact: true })).toBeVisible();
      await client.locator('.panel header button').click();
      if (await client.locator('.bubble-close').isVisible()) await client.locator('.bubble-close').click();
      assert.deepEqual(await client.evaluate(() => window.__FREE_POSITION__.positions), []);
      assert.equal(await client.evaluate(() => window.__FREE_POSITION__.frameQueries), 0);
      const points = [{ screenId: 'screen-a', x: 420.25, y: 260.5 }, { screenId: 'screen-a', x: 5, y: 640 }, { screenId: 'screen-left', x: -820.25, y: 240.5 }];
      for (const point of points) {
        await client.evaluate(point => {
          const control = window.__FREE_POSITION__;
          Object.assign(control.geometry.pet, { x: point.x, y: point.y });
          control.geometry.screenId = point.screenId;
          control.geometry.work = point.screenId === 'screen-left' ? { x: -1440, y: 0, width: 1440, height: 900 } : { x: 0, y: 0, width: 1100, height: 800 };
        }, point);
        const rect = await client.locator('.pet').boundingBox();
        assert.ok(rect);
        const dropped = client.waitForResponse(response => response.url().endsWith('/pet/interactions') && response.request().postDataJSON()?.kind === 'drop');
        await client.mouse.move(rect.x + 80, rect.y + 90);
        await client.mouse.down();
        await client.mouse.move(rect.x + 110, rect.y + 90, { steps: 5 });
        await client.mouse.up();
        const response = await dropped;
        assert.equal(response.status(), 200);
        assert.deepEqual(response.request().postDataJSON(), { kind: 'drop' });
        await expect.poll(async () => client.evaluate(id => window.__FREE_POSITION__.saves.at(-1)?.positions[id], point.screenId)).toEqual({ x: point.x, y: point.y });
        await expect(client.locator('.panel')).toBeHidden();
      }
      await client.evaluate(() => { window.__FREE_POSITION__.frames[0].x += 200; window.__FREE_POSITION__.frames[0].y += 150; });
      await client.waitForTimeout(850);
      await client.evaluate(() => { window.__FREE_POSITION__.frames = []; });
      await client.waitForTimeout(850);
      const control = await client.evaluate(() => window.__FREE_POSITION__);
      assert.equal(control.frameQueries, 0);
      assert.deepEqual(control.positions, []);
      assert.deepEqual({ x: control.geometry.pet.x, y: control.geometry.pet.y }, { x: -820.25, y: 240.5 });
      restored = control.saves.at(-1);
      await client.locator('.browser-tools').getByRole('button', { name: '设置', exact: true }).click();
      await client.locator('.settings-groups summary').filter({ hasText: /^外观$/ }).click();
      await expect(client.getByText('拖到哪里就留在哪里，不自动吸附或跟随窗口。', { exact: true })).toBeVisible();
      await expect(client.getByLabel('固定位置', { exact: true })).toHaveCount(0);
      await client.screenshot({ path: path.join(output, 'free-position-settings.png'), fullPage: true });
      await client.reload();
      await expect.poll(async () => client.evaluate(() => window.__FREE_POSITION__?.positions)).toEqual([restored.positions['screen-a']]);
      assert.equal(await client.evaluate(() => window.__FREE_POSITION__.frameQueries), 0);
    } finally { await client.close(); await isolated.stop(); }
  };
  await t.test('chat memory, exact facts and confirmed deletion use real files', async () => {
    await nav.getByRole('button', { name: '聊天', exact: true }).click();
    await send('记住 周五下午不排会');
    await expect(page.locator('.local-card').last()).toContainText('周五下午不排会');
    const items = (await call('/memory')).items;
    assert.equal(items[0].kind, 'rule');
    assert.match(readFileSync(path.join(dir, 'companion', 'user.md'), 'utf8'), /周五下午不排会/);
    await page.locator('.local-card').last().getByRole('button', { name: '改成事实', exact: true }).click();
    await expect.poll(async () => (await call('/memory')).items.find(item=>item.id===items[0].id)?.kind).toBe('fact');
    await expect(page.locator('.local-card').last().locator('dd').filter({ hasText: /^fact$/ })).toHaveCount(1);
    const retyped = (await call('/memory')).items.find(item=>item.id===items[0].id);
    assert.equal(retyped.id, items[0].id); assert.equal(retyped.layer, 'profile');
    assert.equal(retyped.text, items[0].text); assert.equal(retyped.file, items[0].file);
    await nav.getByRole('button', { name: '记忆', exact: true }).click();
    await expect(page.locator('.memory-text')).toHaveText('周五下午不排会');
    await page.locator('.memory-item').getByRole('button', { name: '删除', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
    assert.equal((await call('/memory')).items.length, 1);
    await page.locator('.memory-item').getByRole('button', { name: '删除', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.locator('.memory-item')).toHaveCount(0);
    assert.doesNotMatch(readFileSync(path.join(dir, 'companion', 'user.md'), 'utf8'), /周五下午不排会/);
    await nav.getByRole('button', { name: '聊天', exact: true }).click();
    await expect(page.locator('.chat-history')).not.toContainText('周五下午不排会');
    await expect(page.locator('.chat-history')).toContainText('相关记忆输入已删除');
  });
  await t.test('reindex button imports manual Markdown through authenticated backend', async () => {
    const seed = await call('/memory', 'POST', { layer: 'long_term', kind: 'fact', text: '会议室在二楼' });
    appendFileSync(path.join(dir, 'companion', 'memory.md'), '\n- 手写的评审安排在周四\n');
    await nav.getByRole('button', { name: '设置', exact: true }).click();
    await page.locator('.settings-groups > details').filter({ has: page.locator('summary', { hasText: /^记忆$/ }) }).locator('summary').click();
    await page.getByRole('button', { name: '重建索引', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('索引已重建');
    assert.equal((await call('/memory?q=手写的评审')).items[0].kind, 'fact');
    assert.equal((await call('/memory')).items.some(item => item.id === seed.id), true);
  });
  await t.test('notice facts are exact text and secret details reveal only on explicit read', async () => {
    await page.locator('.panel header button').click();
    await closeBubble();
    await call('/notices', 'POST', notice('真实后端评审'));
    await expect(page.locator('.bubble')).toBeVisible();
    await expect(page.locator('.bubble dd')).toHaveText(['真实后端评审', '3', '张三', '15:30']);
    assert.equal(await page.evaluate(() => window.injected), undefined);
    await closeBubble();
    const secret = await call('/notices', 'POST', notice('私密评审内容', 'secret'));
    await nav.getByRole('button', { name: '通知中心', exact: true }).click();
    await expect(page.locator('.panel')).not.toContainText('私密评审内容');
    await page.getByRole('button', { name: '一条机密通知', exact: true }).click();
    await expect(page.locator('.panel h2')).toHaveText('私密评审内容');
    await expect(page.locator('.panel dd')).toHaveText(['3', '张三', '15:30', '<script>window.injected=1</script>']);
    assert.equal((await call('/notices')).items.find(item => item.id === secret.id).status, 'read');
    await page.screenshot({ path: path.join(output, 'secret-detail.png'), fullPage: true });
  });
  await t.test('quiet suppresses actual SSE bubbles and restores one summary', async () => {
    await nav.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByText('打扰', { exact: true }).click();
    await page.getByRole('button', { name: '勿扰 30 分钟', exact: true }).click();
    await expect(page.locator('.pet')).toHaveAttribute('data-action', 'quiet_curl');
    for (let i = 0; i < 3; i++) await call('/notices', 'POST', notice(`安静测试 ${i}`));
    await expect(page.locator('.bubble')).toBeHidden();
    await page.getByRole('button', { name: '取消勿扰', exact: true }).click();
    await expect(page.locator('.bubble')).toContainText('3');
    await page.screenshot({ path: path.join(output, 'quiet-summary.png'), fullPage: true });
    await closeBubble();
  });
  await t.test('cancel clears real reminder card and fired bubble original', async () => {
    await nav.getByRole('button', { name: '聊天', exact: true }).click();
    await send('30 分钟后提醒我整理评审清单');
    const card = page.locator('.local-card').last();
    await expect(card).toContainText('整理评审清单');
    const reminder = (await call('/reminders?status=scheduled')).items[0];
    now = reminder.dueAt;
    await daemon.reminders.scan();
    await expect(page.locator('.bubble')).toContainText('整理评审清单');
    await card.getByRole('button', { name: '取消', exact: true }).click();
    await expect(card).toHaveText('提醒已取消');
    await expect(page.locator('.bubble')).not.toContainText('整理评审清单');
    const stored = daemon.storage.transaction(tx => tx.all('SELECT notice_json FROM rt_notices'));
    assert.ok(!JSON.stringify(stored).includes('整理评审清单'));
    await page.screenshot({ path: path.join(output, 'cancelled-reminder.png'), fullPage: true });
  });
  // Faults affect only a fresh headless client and this fixture's HTTP/SSE responses.
  const faultClient = async () => {
    const existing = new Set(streams);
    const client = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    client.on('pageerror', error => errors.push(error.message));
    await client.addInitScript(({ info, token }) => { window.__PET_TEST__ = { info, token }; }, { info: daemon.info, token });
    let blocked = false, hello = false;
    await client.route('**/api/v1/health', route => blocked ? route.abort('connectionfailed') : route.continue());
    await client.route('**/api/v1/stream', route => {
      const headers = { ...route.request().headers() };
      if (hello) delete headers['last-event-id'];
      return route.continue({ headers });
    });
    await client.goto('http://127.0.0.1:1421');
    await client.locator('.browser-tools').getByRole('button', { name: '通知中心', exact: true }).click();
    await expect(client.getByRole('button', { name: '全部标为已读' })).toBeVisible();
    await expect.poll(() => [...streams].filter(res => !existing.has(res)).length).toBe(1);
    const stream = [...streams].find(res => !existing.has(res));
    return {
      client, nav: client.locator('.browser-tools'),
      async send(message) { await client.getByRole('textbox', { name: '聊天输入' }).fill(message); await client.getByRole('button', { name: '发送', exact: true }).click(); },
      async disconnect() { blocked = true; stream.end(); await expect(client.locator('.pet')).toHaveAttribute('data-action', 'offline_sleep'); },
      async reconnect(mode) {
        hello = mode === 'hello'; blocked = false;
        // Activate wake without the outside pointerdown intentionally closing the visible panel.
        await client.getByRole('button', { name: '唤醒', exact: true }).evaluate(button => button.click());
        await expect(client.getByRole('button', { name: '唤醒', exact: true })).toBeHidden();
      },
    };
  };
  for (const mode of ['resync_required', 'hello']) await t.test(`${mode} invalidates detached memory history and refreshes visible memory`, async () => {
    const fault = await faultClient(), client = fault.client;
    let releaseAction;
    try {
      const removedText = `${mode} 周三下午不排会`, keptText = `${mode} 每次先看评审清单`;
      await fault.nav.getByRole('button', { name: '聊天', exact: true }).click();
      await fault.send('你会什么'); await expect(client.locator('.local-card').last()).toContainText('关于团子');
      await fault.send(`30 分钟后提醒我${mode}保留提醒`); await expect(client.locator('.local-card').last()).toContainText(`${mode}保留提醒`);
      await fault.send(`记住 ${removedText}`); await expect(client.locator('.local-card').last()).toContainText(removedText);
      const removed = (await call(`/memory?q=${encodeURIComponent(removedText)}`)).items[0];
      await fault.send(`记住 ${keptText}`); await expect(client.locator('.local-card').last()).toContainText(keptText);
      const kept = (await call(`/memory?q=${encodeURIComponent(keptText)}`)).items[0];
      // Lookup has items/actions but no memory chunk: its original input must also be cleared.
      await fault.send(`忘掉 ${removedText}`); await expect(client.locator('.local-card').last()).toContainText('确认忘掉');
      await fault.send(`你记得${keptText}`); await expect(client.locator('.local-card').last()).toContainText(keptText);
      const detached = await client.evaluateHandle(() => [...document.querySelectorAll('.chat-history > *')]);
      if (mode === 'resync_required') {
        const gate = new Promise(resolve => { releaseAction = resolve; });
        let accepted = false;
        await client.route('**/api/v1/memory/*/retype', async route => { const response = await route.fetch(); accepted = true; await gate; await route.fulfill({ response }); });
        await client.locator('.local-card').filter({ hasText: removedText }).first().getByRole('button', { name: '改成事实', exact: true }).click();
        await expect.poll(() => accepted).toBe(true);
        assert.equal((await call(`/memory?q=${encodeURIComponent(removedText)}`)).items[0].kind, 'fact');
      }
      await fault.nav.getByRole('button', { name: '记忆', exact: true }).click();
      await expect(client.locator('.memory-list')).toContainText(removedText);
      if (mode === 'hello') {
        await client.locator('.panel header button').click();
        await fault.nav.getByRole('button', { name: '记忆', exact: true }).click();
        await expect(client.locator('.memory-list')).toContainText(removedText);
      }
      assert.equal(await detached.evaluate(nodes => nodes.every(node => !node.isConnected)), true);
      await fault.disconnect();
      await call(`/memory/${removed.id}`, 'DELETE');
      if (mode === 'resync_required') {
        const state = await call('/pet/state');
        for (let i = 0; i < 10; i++) daemon.events.emit({ type: 'pet.state', data: { state } });
        assert.equal(daemon.storage.transaction(tx => tx.all("SELECT id FROM ui_events WHERE type = 'memory.changed' AND data_json LIKE '%forgotten%'" )).length, 0);
      }
      const frameStart = streamFrames.length;
      await fault.reconnect(mode);
      await expect.poll(() => streamFrames.slice(frameStart).some(record => record.frame.includes(`event: ${mode}\n`) && (mode === 'hello' ? record.checkpoint === undefined : record.checkpoint !== undefined))).toBe(true);
      await expect(client.locator('.memory-list')).not.toContainText(removedText);
      await expect(client.locator('.memory-list')).toContainText(keptText);
      if (releaseAction) {
        const delivered = client.waitForResponse(response => response.url().endsWith('/retype'));
        releaseAction(); await delivered;
      }
      await expect.poll(() => detached.evaluate(nodes => nodes.filter(node => JSON.parse(node.dataset.memoryIds || '[]').length).length)).toBe(0);
      assert.equal(await detached.evaluate((nodes, text) => nodes.some(node => node.textContent.includes(text)), removedText), false);
      await fault.nav.getByRole('button', { name: '聊天', exact: true }).click();
      if (releaseAction) { await fault.send('你会什么'); await expect(client.locator('.local-card').last()).toContainText('关于团子'); }
      const history = client.locator('.chat-history');
      await expect(history).not.toContainText(removedText); await expect(history).not.toContainText(keptText);
      await expect(history).toContainText('连接已刷新，记忆请重新查询');
      await expect(history).toContainText('关于团子'); await expect(history).toContainText(`${mode}保留提醒`);
      await expect(history.getByRole('button', { name: /撤销|改成事实|改成规则|忘掉这条/ })).toHaveCount(0);
      await expect(client.locator('.local-card').filter({ hasText: '连接已刷新，记忆请重新查询' }).locator('dl, button')).toHaveCount(0);
      assert.ok((await call('/memory')).items.some(item => item.id === kept.id && item.text === keptText));
      assert.ok((await call('/reminders?status=scheduled')).items.some(item => item.text === `${mode}保留提醒`));
      await detached.dispose();
    } finally { releaseAction?.(); await client.close(); }
  });
  await t.test('late accepted real chat cannot restore deleted text or retry after resync', async () => {
    const fault = await faultClient(), client = fault.client;
    let release;
    try {
      await fault.nav.getByRole('button', { name: '聊天', exact: true }).click();
      const text = '迟到回复每次先核对测试清单';
      const gate = new Promise(resolve => { release = resolve; });
      let accepted, requests = 0;
      await client.route('**/api/v1/chat', async route => {
        if (route.request().postDataJSON().message !== `记住 ${text}`) { await route.continue(); return; }
        requests++; const response = await route.fetch(); accepted = await response.json();
        await gate; await route.fulfill({ response });
      });
      const started = Date.now();
      await fault.send(`记住 ${text}`); await expect.poll(() => !!accepted).toBe(true);
      const item = (await call(`/memory?q=${encodeURIComponent(text)}`)).items[0];
      assert.ok(item); assert.ok(JSON.stringify(accepted).includes(text));
      await fault.disconnect(); await call(`/memory/${item.id}`, 'DELETE');
      const tombstones = () => daemon.storage.transaction(tx => tx.all('SELECT * FROM mem_tombstones ORDER BY hash'));
      const deleted = tombstones();
      await fault.reconnect('hello');
      await expect(client.locator('.chat-user').last()).toHaveText('连接已刷新，本次回复未展示，请先查看记忆或提醒');
      assert.ok(Date.now() - started < 4500, 'release accepted response before client 5000ms timeout');
      const delivered = client.waitForResponse(response => response.url().endsWith('/api/v1/chat') && response.request().postDataJSON().message === `记住 ${text}`);
      release(); await delivered;
      await fault.send('你会什么'); await expect(client.locator('.local-card').last()).toContainText('关于团子');
      await expect(client.locator('.chat-history')).not.toContainText(text);
      assert.equal(requests, 1); assert.deepEqual(tombstones(), deleted);
      assert.equal((await call(`/memory?q=${encodeURIComponent(text)}`)).items.length, 0);
    } finally { release?.(); await client.close(); }
  });
  await t.test('left pet interaction never opens panels or pulls low notices; right menu remains actionable', async () => {
    const fault = await faultClient(), client = fault.client;
    try {
      await client.locator('.panel header button').click();
      if (await client.locator('.bubble').isVisible()) await client.locator('.bubble-close').click();
      const title = '低优先通知不打断左键养成';
      const low = await call('/notices', 'POST', { ...notice(title), urgency: 'low' });
      const checkpoint = daemon.events.seq();
      const pet = client.locator('.pet'), point = { x: 80, y: 90 };
      const responseFor = kind => client.waitForResponse(response => response.url().endsWith('/pet/interactions') && response.request().postDataJSON()?.kind === kind && response.status() === 200);
      let response = responseFor('click');
      await pet.click({ position: point }); assert.equal((await (await response).json()).utterance, null);
      await expect(pet).toHaveAttribute('data-action', 'poke_wobble'); await expect(client.locator('.panel')).toBeHidden();
      response = responseFor('double_click');
      await pet.dblclick({ position: point }); assert.equal((await (await response).json()).utterance, null);
      await expect(pet).toHaveAttribute('data-action', 'happy_bounce'); await expect(client.locator('.panel')).toBeHidden();
      const rect = await pet.boundingBox(); assert.ok(rect);
      response = responseFor('pet');
      for (const x of [70, 105, 65, 105, 65]) await client.mouse.move(rect.x + x, rect.y + 50);
      const touched = (await (await response).json()).utterance;
      if (touched) { assert.equal(touched.ref, undefined); assert.equal(touched.facts, undefined); }
      await expect(client.locator('.panel')).toBeHidden(); await expect(client.locator('.bubble')).not.toContainText(title);
      assert.equal((await call('/notices')).items.find(item => item.id === low.id).status, 'unread');
      const interactionUtterances = daemon.storage.transaction(tx => tx.all("SELECT data_json FROM ui_events WHERE id > ? AND type = 'pet.utterance'", [checkpoint])).map(row => JSON.parse(row.data_json).utterance);
      assert.ok(interactionUtterances.every(utterance => utterance.ref?.noticeId !== low.id));
      await pet.click({ button: 'right', position: point }); const menu = client.locator('.context-menu');
      await expect(menu).toBeVisible(); await client.screenshot({ path: path.join(output, 'right-menu-interaction-separation.png'), fullPage: true });
      await menu.getByRole('button', { name: '通知中心', exact: true }).click();
      await expect(client.locator('.panel header strong')).toHaveText('通知中心'); await expect(client.locator('.panel-content')).toContainText(title);
      await client.locator('.panel header button').click();
      response = responseFor('feed'); await pet.click({ button: 'right', position: point }); await menu.getByRole('button', { name: '喂零食', exact: true }).click(); await response;
      await expect(client.locator('.panel')).toBeHidden(); await expect(pet).toHaveAttribute('data-action', 'eat_snack');
    } finally { await client.close(); }
  });
  await t.test('native-sized bubble clips decoration while long content and controls stay accessible', async () => {
    const client = await browser.newPage({ viewport: { width: 280, height: 100 }, deviceScaleFactor: 2 });
    const pageErrors = [];
    client.on('pageerror', error => pageErrors.push(error.message));
    try {
      await client.addInitScript(({ info, token }) => { window.__PET_TEST__ = { info, token }; }, { info: daemon.info, token });
      await client.goto('http://127.0.0.1:1421/?view=bubble');
      await expect(client.locator('body')).toHaveClass('native-bubble');
      const publish = entry => client.evaluate(async entry => {
        const { bridge } = await import('/src/bridge.ts');
        await bridge.send('bubble-data', entry);
      }, entry);
      const metrics = () => client.locator('.bubble').evaluate(bubble => {
        const content = bubble.querySelector('.bubble-content');
        const outer = getComputedStyle(bubble), inner = getComputedStyle(content);
        return { outerX: outer.overflowX, outerY: outer.overflowY, innerX: inner.overflowX,
          contentWidth: content.clientWidth, contentScrollWidth: content.scrollWidth,
          contentHeight: content.clientHeight, contentScrollHeight: content.scrollHeight,
          pageWidth: document.documentElement.clientWidth, pageScrollWidth: document.documentElement.scrollWidth,
          pageHeight: document.documentElement.clientHeight, pageScrollHeight: document.documentElement.scrollHeight };
      });
      for (const direction of ['top', 'bottom', 'left', 'right']) {
        await publish({ direction, priority: 0, utterance: { id: `layout-${direction}`, text: '这儿视野不错。', sensitivity: 'normal' } });
        await expect(client.locator('.utterance-text')).toHaveText('这儿视野不错。');
        const size = await metrics();
        assert.equal(size.outerX, 'hidden'); assert.equal(size.outerY, 'hidden'); assert.equal(size.innerX, 'hidden');
        assert.ok(size.contentScrollWidth <= size.contentWidth);
        assert.ok(size.contentScrollHeight <= size.contentHeight);
        assert.equal(size.pageScrollWidth, size.pageWidth); assert.equal(size.pageScrollHeight, size.pageHeight);
        await expect(client.getByRole('button', { name: '×', exact: true })).toBeInViewport();
      }
      await publish({ direction: 'left', priority: 0, utterance: { id: 'layout-short', text: '这儿视野不错。', sensitivity: 'normal' } });
      await client.screenshot({ path: path.join(output, 'bubble-overflow-after.png') });
      await client.setViewportSize({ width: 280, height: 240 });
      const actionLabel = '查看'.repeat(10) + '详情';
      await publish({ direction: 'top', priority: 1, title: '长通知仍能完整查看', utterance: {
        id: 'layout-long', text: '这是一条需要核对完整事实的通知', sensitivity: 'normal',
        facts: Array.from({ length: 4 }, (_, i) => ({ label: `字段${i + 1}`, value: '可核对的详细内容'.repeat(12) })),
        quickActions: [{ label: actionLabel, open: 'notice' }, { label: '查看详情', open: 'notice' }],
      } });
      const size = await metrics();
      assert.ok(size.contentScrollHeight > size.contentHeight);
      assert.ok(size.contentScrollWidth <= size.contentWidth);
      assert.equal(size.pageScrollWidth, size.pageWidth); assert.equal(size.pageScrollHeight, size.pageHeight);
      await client.locator('.bubble-content').evaluate(content => { content.scrollTop = content.scrollHeight; });
      await expect(client.getByRole('button', { name: actionLabel, exact: true })).toBeInViewport();
      await expect(client.getByRole('button', { name: '查看详情', exact: true })).toBeInViewport();
      await expect(client.getByRole('button', { name: '×', exact: true })).toBeInViewport();
      await client.screenshot({ path: path.join(output, 'bubble-long-content.png') });
      await client.evaluate(async () => {
        const { bridge } = await import('/src/bridge.ts');
        await bridge.on('bubble-control', action => { document.body.dataset.bubbleControl = action; });
      });
      await client.getByRole('button', { name: '×', exact: true }).click();
      await expect(client.locator('body')).toHaveAttribute('data-bubble-control', 'dismiss');
      assert.deepEqual(pageErrors, []);
    } finally { await client.close(); }
  });
  await t.test('wake errors use a visible host and fit the desktop-sized preview', async () => {
    const fault = await faultClient(), client = fault.client;
    try {
      await client.evaluate(async () => { const { showError } = await import('/src/dom.ts'); showError('面板内错误提示'); });
      await expect(client.locator('.panel').getByRole('alert')).toHaveText('面板内错误提示');
      await client.locator('.panel .error').evaluate(node => node.remove());
      await client.locator('.panel header button').click();
      await fault.disconnect();
      await client.setViewportSize({ width: 160, height: 160 });
      await client.evaluate(async () => {
        document.body.classList.remove('browser-preview'); document.body.classList.add('native-pet');
        document.querySelector('.browser-tools')?.remove();
        const { showError } = await import('/src/dom.ts'); showError('后台尚未醒来，请检查启动状态');
      });
      const alert = client.locator('#app > .error');
      await expect(alert).toBeVisible(); await expect(alert).toHaveText('后台尚未醒来，请检查启动状态');
      const rect = await alert.boundingBox();
      assert.ok(rect && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 160 && rect.y + rect.height <= 130);
      await expect(client.getByRole('button', { name: '唤醒', exact: true })).toBeVisible();
      await client.screenshot({ path: path.join(output, 'wake-error-feedback.png') });
    } finally { await client.close(); }
  });
  await t.test('free placement keeps release coordinates, never reads external windows and restores saved positions', placementRegression);
  await t.test('real interactive ball and box use one start event, interrupt cleanly and keep placement free', async () => {
    const gameConfig = loadConfig({ WORK_AGENT_DATA_DIR: path.join(dir, 'playtime'), WORK_AGENT_DEV_ORIGINS: 'http://127.0.0.1:1421' });
    gameConfig.portRange = [0, 0];
    const isolated = await startDaemon({ config: gameConfig, secrets: { get: async () => token, set: async () => { throw new Error('unexpected secret write'); }, delete: async () => {} }, log: createLogger({ write: line => logs.push(line) }) });
    const client = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    client.on('pageerror', error => errors.push(error.message));
    const requests = [];
    client.on('request', request => { if (request.url().endsWith('/pet/interactions')) requests.push(request.postDataJSON()); });
    const gameCall = async (endpoint, method = 'GET', value) => {
      const response = await fetch(`http://127.0.0.1:${isolated.info.port}/api/v1${endpoint}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
      assert.equal(response.status, 200); return response.json();
    };
    try {
      await gameCall('/pet/settings', 'PUT', { offworkReminder: false, acceptDevNotices: true });
      await client.addInitScript(({ info, token }) => { window.__PET_TEST__ = { info, token }; }, { info: isolated.info, token });
      await client.route('**/src/bridge.ts', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: await response.text() + `
window.__PLAY_PLACEMENT__ = { positions: [], frames: 0 };
bridge.position = async point => { window.__PLAY_PLACEMENT__.positions.push(point); };
bridge.frames = async () => { window.__PLAY_PLACEMENT__.frames++; return []; };
` });
      });
      await client.goto('http://127.0.0.1:1421');
      await client.getByRole('button', { name: '先用默认', exact: true }).click();
      await expect(client.getByRole('button', { name: '全部标为已读', exact: true })).toBeVisible();
      await client.locator('.panel header button').click();
      if (await client.locator('.bubble-close').isVisible()) await client.locator('.bubble-close').click();
      const pet = client.locator('.pet'), point = { x: 80, y: 90 }, hint = client.locator('.play-hint');
      const play = async label => { await pet.click({ button: 'right', position: point }); const menu = client.locator('.context-menu'); await menu.getByText('玩一会儿', { exact: true }).click(); await menu.getByRole('button', { name: label, exact: true }).click(); };
      await pet.click({ position: point, clickCount: 6, delay: 80 });
      await expect(pet).toHaveAttribute('data-action', 'poke_pout'); await expect(pet).toHaveAttribute('data-action', 'poke_guard'); await expect(pet).toHaveAttribute('data-action', 'face_rub');
      await pet.click({ position: { x: 30, y: 80 } }); await expect(pet).toHaveAttribute('data-action', 'ear_twitch');
      await client.waitForTimeout(1100); await expect(pet).not.toHaveAttribute('data-action', 'poke_pout');
      if (await client.locator('.bubble-close').isVisible()) await client.locator('.bubble-close').click();
      const baseline = requests.length, affinity = (await gameCall('/pet/state')).growth.stats.affinity || 0;
      await play('抛接球'); await expect(pet).toHaveAttribute('data-action', 'ball_ready');
      await expect.poll(() => requests.filter(request => request.kind === 'play').length).toBe(1);
      for (let round = 1; round <= 3; round++) {
        await expect(hint).toHaveText(`第 ${round}/3 球 · 点一下抛球`); await pet.click({ position: point });
        if (round === 1) { await pet.click({ position: point }); await expect(pet).toHaveAttribute('data-play-phase', 'flight'); }
        await expect(pet).toHaveAttribute('data-play-phase', 'catch'); await pet.click({ position: point });
        await expect(pet).toHaveAttribute('data-action', 'ball_catch');
        if (round === 1) await client.screenshot({ path: path.join(output, 'play-ball-caught.png') });
      }
      await expect(hint).toHaveText('接住 3/3 球 · 玩得开心'); await expect(hint).toBeHidden();
      assert.deepEqual(requests.slice(baseline).filter(request => !['hover', 'utterance_dismissed'].includes(request.kind)), [{ kind: 'play', activityId: 'play_ball' }]);
      assert.equal((await gameCall('/pet/state')).growth.stats.affinity, affinity + 1);
      await play('抛接球'); await pet.click({ position: point }); await expect(pet).toHaveAttribute('data-action', 'ball_miss');
      await client.screenshot({ path: path.join(output, 'play-ball-missed.png') }); await play('结束玩耍');
      await expect(pet).not.toHaveAttribute('data-play'); await expect(hint).toBeHidden();
      await client.locator('.browser-tools').getByRole('button', { name: '聊天', exact: true }).click();
      const draft = client.getByRole('textbox', { name: '聊天输入' }); await draft.fill('玩完再处理的本机草稿');
      await play('纸箱躲猫猫'); await expect(draft).toHaveValue('玩完再处理的本机草稿');
      for (let round = 1; round <= 3; round++) {
        await expect(hint).toHaveText(`第 ${round}/3 次 · 点纸箱逗我`);
        await expect(pet.locator('.box-front')).toBeVisible();
        if (round === 1) await client.screenshot({ path: path.join(output, 'play-box-peek.png') });
        await pet.click({ position: point }); await expect(pet).toHaveAttribute('data-action', 'box_hide');
        if (round === 1) await client.screenshot({ path: path.join(output, 'play-box-hide.png') });
      }
      await expect(pet).toHaveAttribute('data-action', 'box_pop'); await client.screenshot({ path: path.join(output, 'play-box-pop.png') });
      await expect(hint).toHaveText('纸箱真好玩'); await expect(hint).toBeHidden(); await expect(pet.locator('.box-front')).toBeHidden();
      await expect(draft).toHaveValue('玩完再处理的本机草稿'); await expect(client.locator('.panel')).toBeVisible();
      for (const label of ['抛接球', '纸箱躲猫猫']) { await play(label); await client.keyboard.press('Escape'); await expect(hint).toBeHidden(); await expect(pet).not.toHaveAttribute('data-play'); }
      await play('纸箱躲猫猫'); await gameCall('/pet/quiet', 'POST', { mode: 'dnd', minutes: 30 });
      await expect(pet).toHaveAttribute('data-action', 'quiet_curl'); await expect(hint).toBeHidden();
      await pet.click({ button: 'right', position: point }); await client.locator('.context-menu').getByText('玩一会儿', { exact: true }).click();
      await expect(client.locator('.context-menu').getByRole('button', { name: '抛接球', exact: true })).toBeDisabled();
      await client.keyboard.press('Escape'); await gameCall('/pet/quiet', 'POST', { mode: 'off' });
      await expect(pet).not.toHaveAttribute('data-play');
      await play('纸箱躲猫猫'); await client.evaluate(async () => { const { bridge } = await import('/src/bridge.ts'); await bridge.send('render-visibility', false); });
      await expect(hint).toBeHidden(); await client.evaluate(async () => { const { bridge } = await import('/src/bridge.ts'); await bridge.send('render-visibility', true); });
      await expect(pet).not.toHaveAttribute('data-play');
      await play('抛接球');
      const dropped = client.waitForResponse(response => response.url().endsWith('/pet/interactions') && response.request().postDataJSON()?.kind === 'drop');
      const rect = await pet.boundingBox(); await client.mouse.move(rect.x + 80, rect.y + 90); await client.mouse.down(); await client.mouse.move(rect.x + 110, rect.y + 90, { steps: 5 }); await client.mouse.up();
      assert.equal((await dropped).status(), 200); await expect(hint).toBeHidden(); await expect(pet).not.toHaveAttribute('data-play');
      await expect(client.locator('.bubble')).toContainText('抱紧耳麦！');
      await play('纸箱躲猫猫'); await expect(pet).toHaveAttribute('data-play', 'box');
      await gameCall('/notices', 'POST', { ...notice('玩耍中的真实通知'), urgency: 'high' });
      await expect(hint).toBeHidden(); await expect(pet).not.toHaveAttribute('data-play'); await expect(client.locator('.bubble')).toContainText('抱紧耳麦！');
      await client.locator('.bubble-close').click(); await expect(client.locator('.bubble')).toContainText('玩耍中的真实通知');
      await client.waitForTimeout(2000); await expect(pet).not.toHaveAttribute('data-play');
      assert.deepEqual(await client.evaluate(() => window.__PLAY_PLACEMENT__), { positions: [], frames: 0 });
      assert.equal((await gameCall('/pet/state')).audio.enabled, false);
      assert.ok(!requests.some(request => ['audio_play', 'audio_pause'].includes(request.kind)));
      assert.equal((await gameCall('/memory')).items.length, 0);
      assert.ok(!JSON.stringify(await client.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)])).includes(token));
    } finally { await client.close(); await isolated.stop(); }
  });
  await t.test('no page errors, credential reads, token storage or private logs', async () => {
    assert.deepEqual(errors, []);
    const persisted = await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)]);
    assert.ok(!JSON.stringify(persisted).includes(token));
    assert.ok(!logs.join('').includes(token));
    assert.doesNotMatch(logs.join(''), /周五下午不排会|私密评审内容|整理评审清单/);
  });
});
