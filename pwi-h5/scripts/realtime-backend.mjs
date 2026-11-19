import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Only this script owns these disposable databases. No app navigation, UI,
// default database, legacy saves, credentials, or organically earned fixtures.
const gameURL = process.env.GAME_URL;
if (!gameURL || !/^http:\/\/127\.0\.0\.1:5183\/?$/.test(gameURL)) {
  throw new Error('Set GAME_URL=http://127.0.0.1:5183 explicitly');
}
const origin = new URL(gameURL).origin;
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--disable-background-networking', '--no-first-run'],
});
let context;
try {
  context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const unexpectedNetwork = [];
  const appRequests = [];
  let inertNavigations = 0;
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      unexpectedNetwork.push(request.url());
      await route.abort();
      return;
    }
    if (/\/(src\/main\.js|@vite\/client)(?:\?|$)/.test(url.pathname)) appRequests.push(request.url());
    if (request.isNavigationRequest() && request.resourceType() === 'document' && url.pathname === '/') {
      inertNavigations++;
      await route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html><head><title>Isolated realtime backend mechanics test</title><link rel="icon" href="data:,"></head><body></body></html>',
      });
      return;
    }
    await route.continue();
  });
  page.on('websocket', (socket) => unexpectedNetwork.push(socket.url()));
  await page.goto(`${origin}/`, { waitUntil: 'load' });
  const report = await page.evaluate(async () => {
    const { LocalBackend, API_ROUTES } = await import('/src/core/api.js');
    const { Game, validateSave } = await import('/src/core/game.js');
    const { stats, makeMonster } = await import('/src/core/model.js');
    const { createBattle, REALTIME_RULES } = await import('/src/core/combat.js');
    const names = [];
    const handles = new Set();
    const results = [];
    const counts = { assertions: 0, commits: 0, replays: 0, unchangedRejections: 0, invalidImports: 0, realTransactionAborts: 0, abortedSavePuts: 0, abortedReceiptPuts: 0, persistedTicks: 0 };
    const gaps = ['Save import appends its documented journal entry: player/battle/version are preserved exactly, but the entire imported snapshot is not byte-identical.'];
    const check = (ok, message) => { counts.assertions++; if (!ok) throw new Error(message); };
    const same = (actual, expected, message) => check(JSON.stringify(actual) === JSON.stringify(expected), message);
    const clone = (value) => structuredClone(value);
    const post = async (api, path, body = {}, options = {}) => {
      const result = await api.request('POST', path, body, options);
      if (result.meta.duplicate) counts.replays++; else counts.commits++;
      return result;
    };
    const get = (api, path, body = {}) => api.request('GET', path, body);
    const open = async (suffix, databaseName) => {
      const name = databaseName || `pwi-realtime-backend-mechanics-${crypto.randomUUID()}-${suffix}`;
      if (!databaseName) names.push(name);
      const api = await LocalBackend.open({ databaseName: name, legacyStorage: null });
      handles.add(api);
      check(api.store.db instanceof IDBDatabase && !api.loadError, `${suffix}: real healthy IndexedDB backend required`);
      return api;
    };
    const close = (api) => { api.close(); handles.delete(api); };
    const test = async (name, run) => {
      try { await run(); results.push({ name, ok: true }); }
      catch (error) { results.push({ name, ok: false, error: error.stack || String(error) }); }
      finally { for (const api of [...handles]) close(api); }
    };
    const raw = (api) => new Promise((resolve, reject) => {
      const tx = api.store.db.transaction(['saves', 'requests', 'meta'], 'readonly');
      const requests = Object.fromEntries(['saves', 'requests', 'meta'].map((name) => [name, tx.objectStore(name).getAll()]));
      const total = tx.objectStore('requests').count();
      tx.oncomplete = () => resolve({ ...Object.fromEntries(Object.entries(requests).map(([name, request]) => [name, request.result])), receiptCount: total.result });
      tx.onabort = () => reject(new Error(`Evidence read transaction aborted: ${tx.error?.message}`));
    });
    const capture = async (api) => ({ state: api.game.state, revision: api.revision, disk: await api.store.current(), history: (await get(api, '/v1/history')).data, raw: await raw(api) });
    const persisted = async (api, message) => {
      const evidence = await capture(api);
      same(evidence.disk.snapshot, evidence.state, `${message}: checkpoint snapshot differs from memory`);
      check(evidence.disk.revision === evidence.revision, `${message}: checkpoint revision differs`);
      check(evidence.raw.saves.length === 1 && evidence.raw.receiptCount === evidence.raw.requests.length, `${message}: native receipt/save counts differ`);
      check(evidence.history.rows.length === evidence.raw.receiptCount, `${message}: API history/native receipt count differs`);
      same(evidence.history.rows, [...evidence.raw.requests].sort((a, b) => b.revision - a.revision), `${message}: history differs from native receipts`);
      return evidence;
    };
    const rejectUnchanged = async (api, path, body, options = {}, code = 'RULE_REJECTED') => {
      const before = await capture(api);
      let error;
      try { await api.request('POST', path, body, options); } catch (caught) { error = caught; }
      check(!!error, `${path}: expected rejection`);
      check(error.code === code, `${path}: expected ${code}, got ${error.code}: ${error.message}`);
      same(await capture(api), before, `${path}: failure changed original memory/revision/checkpoint/receipts/history/meta`);
      if (options.requestId) same(await api.store.receipt(options.requestId), before.raw.requests.find((receipt) => receipt.id === options.requestId) || null, `${path}: failure changed/created a receipt`);
      counts.unchangedRejections++;
      return error;
    };
    // Deliberately imported high-attribute/learned-skill/charm/monster mechanics
    // fixtures. These are NOT evidence of natural growth, rewards or gameplay.
    const mechanicsFixture = ({ battle = true, count = 2, skills = true, lowResources = true, finalEnemy = false } = {}) => {
      const g = new Game(); g.start('机械存储夹具', 'wizard');
      const p = g.p;
      p.lv = 80; p.cult = 8; p.chi = 300;
      p.attrs = { str: 200, con: 200, dex: 200, mag: 200 };
      p.skills = skills ? { wz1: 1, wz3: 1, wz4: 1 } : {};
      p.location = 'h_f1';
      if (!p.discovered.includes(p.location)) p.discovered.push(p.location);
      p.charms = { hp: 100000, mp: 100000 };
      const st = stats(p);
      p.hp = lowResources ? 1 : st.hp;
      p.mp = lowResources ? Math.floor(st.mp * 0.5) : st.mp;
      if (battle) g.state.battle = createBattle(p, Array.from({ length: count }, (_, i) => ({
        ...makeMonster(`存储机械敌人${i}`, 80, '', 'magic', i),
        hp: finalEnemy ? 1 : 1e7, maxHp: 1e7, atk: 100, accuracy: 10, dodge: 0, crit: 0,
      })), { type: 'field', zone: p.location });
      return validateSave(g.state);
    };
    const load = async (api, snapshot = mechanicsFixture(), requestId = crypto.randomUUID()) => {
      const before = await capture(api);
      const response = await post(api, '/v1/save/import', { snapshot, confirm: true }, { requestId });
      same(api.game.p, snapshot.player, 'Mechanics import changed player');
      same(api.game.battle, snapshot.battle, 'Mechanics import changed battle');
      check(api.game.state.version === snapshot.version, 'Mechanics import changed version');
      same(api.game.state.journal.slice(0, -1), snapshot.journal.slice(-59), 'Import changed existing journal');
      check(api.game.state.journal.at(-1).text === '存档已导入。', 'Import journal side effect missing');
      const after = await persisted(api, 'Mechanics import');
      check(after.revision === before.revision + 1 && after.raw.receiptCount === before.raw.receiptCount + 1, 'Import did not commit exactly one receipt');
      return response;
    };
    const enable = async (api) => {
      const response = await post(api, '/v1/battle/realtime', {});
      same(response.data.result, api.game.battle.rt, 'Enable receipt does not contain committed rt');
      await persisted(api, 'Enable');
      return response;
    };
    const withRandom = async (value, run) => {
      const original = Math.random; Math.random = typeof value === 'function' ? value : () => value;
      try { return await run(); } finally { Math.random = original; }
    };
    const noRandom = () => { throw new Error('Receipt replay rerolled battle randomness'); };
    const replay = async (api, path, body, requestId, first) => {
      const before = await capture(api);
      const duplicate = await withRandom(noRandom, () => post(api, path, body, { requestId }));
      check(duplicate.meta.duplicate && duplicate.meta.revision === before.revision, 'Replay metadata/revision wrong');
      same(duplicate.data, first.data, 'Replay changed committed response data');
      same(await capture(api), before, 'Replay changed ticks/charges/awards/checkpoint/history/receipts');
      return duplicate;
    };
    // Safe test-only wrappers invoke native put/abort. Abort happens AFTER the
    // native saves.put and requests.put success events, not a mocked throw and
    // not merely before staging writes. No application/storage changes.
    const nativeAbort = async (api, path, body, requestId) => {
      const db = api.store.db;
      const putDescriptor = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, 'put');
      const ownTransaction = Object.getOwnPropertyDescriptor(db, 'transaction');
      const transaction = db.transaction;
      const nativePut = putDescriptor.value;
      const nativeAbortMethod = IDBTransaction.prototype.abort;
      const evidence = { transactions: 0, savesSucceeded: 0, receiptsSucceeded: 0, abortCalls: 0, abortEvents: 0, completedWrites: 0 };
      db.transaction = function (...args) {
        const tx = transaction.apply(this, args);
        if (args[1] === 'readwrite') {
          check(tx instanceof IDBTransaction, 'Abort injection must use a native transaction');
          evidence.transactions++;
          tx.addEventListener('abort', () => evidence.abortEvents++);
          tx.addEventListener('complete', () => evidence.completedWrites++);
        }
        return tx;
      };
      Object.defineProperty(IDBObjectStore.prototype, 'put', { ...putDescriptor, value: function (...args) {
        const request = nativePut.apply(this, args);
        if (this.transaction.db === db && this.transaction.mode === 'readwrite') {
          const tx = this.transaction;
          if (this.name === 'saves') request.addEventListener('success', () => evidence.savesSucceeded++);
          if (this.name === 'requests') request.addEventListener('success', () => {
            evidence.receiptsSucceeded++;
            evidence.abortCalls++;
            nativeAbortMethod.call(tx);
          });
        }
        return request;
      } });
      try {
        const error = await rejectUnchanged(api, path, body, { requestId }, 'STORAGE_WRITE_FAILED');
        check(error.status === 503, 'Actual transaction abort must be a storage/503 error');
      } finally {
        Object.defineProperty(IDBObjectStore.prototype, 'put', putDescriptor);
        if (ownTransaction) Object.defineProperty(db, 'transaction', ownTransaction); else delete db.transaction;
      }
      same(evidence, { transactions: 1, savesSucceeded: 1, receiptsSucceeded: 1, abortCalls: 1, abortEvents: 1, completedWrites: 0 }, 'Expected real staged-write transaction abort evidence');
      counts.realTransactionAborts += evidence.abortEvents;
      counts.abortedSavePuts += evidence.savesSucceeded;
      counts.abortedReceiptPuts += evidence.receiptsSucceeded;
    };

    const originalRandom = Math.random;
    Math.random = () => 0.5;
    try {
      check(document.scripts.length === 0 && document.body.children.length === 0, 'Navigation was not inert');
      check(localStorage.length === 0 && sessionStorage.length === 0, 'Fresh context unexpectedly has user storage');
      check((await indexedDB.databases()).length === 0, 'Fresh context unexpectedly has databases');
      check(REALTIME_RULES.stepMs === 200, 'Backend is not the expected 200ms implementation');

      await test('Real open/import/enable, steps 1–5, persisted cooldowns/events and charge/tick receipts', async () => {
        const api = await open('mechanics');
        check((await get(api, '/v1/bootstrap')).data.snapshot.player === null && await api.store.current() === null, 'Named database did not start empty');
        same(await raw(api), { saves: [], requests: [], meta: [], receiptCount: 0 }, 'Empty open wrote records');
        for (const [path, fields] of [
          ['/v1/battle/realtime', { layout: 'object?' }],
          ['/v1/battle/tick', { steps: 'integer', direction: 'string?', targetId: 'string?' }],
          ['/v1/battle/action', { action: 'string', targetId: 'string?' }],
        ]) same(API_ROUTES.find((r) => r.method === 'POST' && r.path === path)?.fields, fields, `${path}: route contract`);
        await load(api); await enable(api);
        await post(api, '/v1/battle/action', { action: 'autoskills' });
        const beforeSkill = await capture(api);
        const skillBody = { action: 'skill:wz4', targetId: 'm1' };
        const skill = await post(api, '/v1/battle/action', skillBody, { requestId: 'mechanics-skill-once' });
        check(api.game.p.mp < beforeSkill.state.player.mp && api.game.battle.rt.skillReady.wz4 === 20, 'Skill did not charge mana/store absolute tick cooldown');
        check(api.game.battle.rt.tick === 0, 'Manual action advanced ticks');
        await replay(api, '/v1/battle/action', skillBody, 'mechanics-skill-once', skill);
        await rejectUnchanged(api, '/v1/battle/action', { action: 'skill:wz1', targetId: 'm1' }, { requestId: 'mechanics-skill-once' }, 'REQUEST_ID_REUSED');
        const hpCount = api.game.p.items.hp1;
        const potionBody = { action: 'item:hp1' };
        const potion = await post(api, '/v1/battle/action', potionBody, { requestId: 'mechanics-potion-once' });
        check(api.game.p.items.hp1 === hpCount - 1 && api.game.battle.rt.player.potionReadyAt === 40, 'Potion charge/shared cooldown not committed');
        await replay(api, '/v1/battle/action', potionBody, 'mechanics-potion-once', potion);
        await post(api, '/v1/battle/action', { action: 'guard' });
        const beforeTick = await capture(api);
        const tickBody = { steps: 1, direction: 'right', targetId: 'm1' };
        const [first, duplicate] = await Promise.all([
          post(api, '/v1/battle/tick', tickBody, { requestId: 'mechanics-tick-once' }),
          post(api, '/v1/battle/tick', tickBody, { requestId: 'mechanics-tick-once' }),
        ]);
        check(!first.meta.duplicate && duplicate.meta.duplicate && api.revision === beforeTick.revision + 1, 'Concurrent replay committed more than once');
        same(duplicate.data, first.data, 'Concurrent tick replay returned different receipt');
        check(api.game.battle.rt.tick === 1 && Math.abs(api.game.battle.rt.player.x - beforeTick.state.battle.rt.player.x - 0.7) < 1e-9, 'Actual tick/movement not persisted');
        same(api.game.p.charmCooldowns, { hp: 50, mp: 25 }, 'Charm activation did not persist remaining 50/25 ticks');
        check(api.game.p.charms.hp < beforeTick.state.player.charms.hp && api.game.p.charms.mp < beforeTick.state.player.charms.mp, 'Tick did not charge actual charm reserves');
        check((await raw(api)).receiptCount === beforeTick.raw.receiptCount + 1, 'Concurrent replay wrote extra history/receipt');
        await replay(api, '/v1/battle/tick', tickBody, 'mechanics-tick-once', first);
        await rejectUnchanged(api, '/v1/battle/tick', { ...tickBody, steps: 2 }, { requestId: 'mechanics-tick-once' }, 'REQUEST_ID_REUSED');
        const reserves = clone(api.game.p.charms);
        for (const steps of [2, 3, 4, 5]) {
          const before = await capture(api);
          await post(api, '/v1/battle/tick', { steps });
          check(api.game.battle.rt.tick === before.state.battle.rt.tick + steps, `Actual ${steps}-step request not persisted`);
          check(api.revision === before.revision + 1 && (await raw(api)).receiptCount === before.raw.receiptCount + 1, 'Multi-step request must commit once, not once per step');
          await persisted(api, `steps=${steps}`);
        }
        check(api.game.battle.rt.tick === 15 && api.game.battle.rt.skillReady.wz4 === 20 && api.game.battle.cooldowns.wz4 === 1, 'Absolute skill cooldown changed while ticking');
        same(api.game.p.charmCooldowns, { hp: 36, mp: 11 }, 'Remaining charm timers did not decrease by only actual ticks');
        same(api.game.p.charms, reserves, 'Charm reserves charged again before cooldown expiry');
        check(api.game.battle.rt.events.some((e) => e.kind === 'cast') && api.game.battle.rt.events.some((e) => e.kind === 'telegraph'), 'Real action/tick event evidence missing');
        const saved = await persisted(api, 'Live mechanics');
        const name = api.store.db.name; close(api);
        const restored = await open('mechanics-reopen', name);
        same(await capture(restored), saved, 'Close/reopen changed complete record/history/receipts/mechanics');
        await replay(restored, '/v1/battle/action', potionBody, 'mechanics-potion-once', potion);
        await replay(restored, '/v1/battle/tick', tickBody, 'mechanics-tick-once', first);
        counts.persistedTicks += 15;
      });

      await test('Paused commands/GET exact snapshots; close/reopen/export/import preserves realtime payload', async () => {
        const source = await open('roundtrip-source'); await load(source); await enable(source);
        await post(source, '/v1/battle/action', { action: 'autoskills' });
        await post(source, '/v1/battle/action', { action: 'skill:wz3' });
        await post(source, '/v1/battle/action', { action: 'guard' });
        await post(source, '/v1/battle/tick', { steps: 4, direction: 'up-right' });
        await post(source, '/v1/battle/action', { action: 'pause' });
        const frozen = await capture(source);
        const pausedBody = { steps: 5, direction: 'down-left', targetId: 'm1' };
        const paused = await post(source, '/v1/battle/tick', pausedBody, { requestId: 'paused-no-ticks' });
        same(source.game.state, frozen.state, 'Paused tick changed full snapshot/buffs/timers/events/resources');
        const committedPause = await persisted(source, 'Paused command');
        check(committedPause.revision === frozen.revision + 1 && committedPause.raw.receiptCount === frozen.raw.receiptCount + 1, 'Paused POST should still have exactly one command receipt');
        await replay(source, '/v1/battle/tick', pausedBody, 'paused-no-ticks', paused);
        for (const path of ['/v1/bootstrap', '/v1/state', '/v1/character', '/v1/world', '/v1/inventory', '/v1/skills', '/v1/save/export', '/v1/history']) {
          const response = await get(source, path);
          if (path === '/v1/state' || path === '/v1/bootstrap') same(response.data.snapshot, committedPause.state, `${path}: query lost snapshot fields`);
          if (path === '/v1/save/export') same(response.data, committedPause.state, 'Export not exact full snapshot');
          same(await capture(source), committedPause, `${path}: GET mutated checkpoint/receipts/state`);
        }
        const detached = (await get(source, '/v1/save/export')).data;
        detached.battle.rt.tick = 999; detached.player.charms.hp = 0;
        source.game.battle.rt.tick = 999;
        same(await capture(source), committedPause, 'Detached GET/view can mutate original backend');
        for (const [path, body] of [
          ['/v1/battle/action', { action: 'guard' }], ['/v1/battle/action', { action: 'skill:wz1' }],
          ['/v1/items/use', { id: 'hp1' }], ['/v1/battle/action', { action: 'escape' }],
        ]) await rejectUnchanged(source, path, body);
        const name = source.store.db.name; close(source);
        const resumed = await open('roundtrip-reopen', name);
        same(await capture(resumed), committedPause, 'Paused close/reopen not exact');
        const exported = (await get(resumed, '/v1/save/export')).data;
        same(exported, committedPause.state, 'Reopened export not exact');
        const target = await open('roundtrip-import');
        await load(target, exported, 'roundtrip-import-once');
        same(target.game.battle, resumed.game.battle, 'Import lost any realtime/cooldown/event/buff/reward field');
        same(target.game.p, resumed.game.p, 'Import lost any player/charm timer field');
        same(await capture(resumed), committedPause, 'Export/import changed original source backend');
        const imported = await capture(target);
        const targetName = target.store.db.name; close(target);
        const reopenedTarget = await open('roundtrip-import-reopen', targetName);
        same(await capture(reopenedTarget), imported, 'Imported complete committed snapshot not exact after reopen');
        await post(reopenedTarget, '/v1/battle/action', { action: 'resume' });
        const beforeTick = clone(reopenedTarget.game.state);
        same(reopenedTarget.game.battle.rt.player, imported.state.battle.rt.player, 'Resume reset timers or coordinates');
        await post(reopenedTarget, '/v1/battle/tick', { steps: 1 });
        check(reopenedTarget.game.battle.rt.tick === 5 && reopenedTarget.game.p.charmCooldowns.hp === beforeTick.player.charmCooldowns.hp - 1, 'Imported resumed tick did not continue timers');
        same(reopenedTarget.game.battle.rt.skillReady, beforeTick.battle.rt.skillReady, 'Import/resume reset absolute skill timers');
        await persisted(reopenedTarget, 'Imported resume'); counts.persistedTicks += 5;
      });

      await test('Rejected old turns/actions/invalid ticks do not write or refresh original backend', async () => {
        const api = await open('command-failures');
        const snapshot = mechanicsFixture(); snapshot.player.daily.day = '2020-01-01';
        await load(api, snapshot); await enable(api);
        // Importing an old-day active realtime fixture into a separate empty DB
        // makes failed candidate.refreshDay observable without altering app code.
        const stale = clone(api.game.state); stale.player.daily.day = '2020-01-01';
        const original = await capture(api);
        const target = await open('old-day-rejections'); await load(target, stale);
        for (const [path, body, code] of [
          ['/v1/battle/turn', { action: 'attack' }, 'RULE_REJECTED'],
          ['/v1/battle/turn', { action: 'skill:wz1' }, 'RULE_REJECTED'],
          ['/v1/battle/turn', { action: 'item:hp1' }, 'RULE_REJECTED'],
          ['/v1/battle/auto', {}, 'RULE_REJECTED'],
          ['/v1/battle/tick', { steps: 0 }, 'RULE_REJECTED'],
          ['/v1/battle/tick', { steps: 6 }, 'RULE_REJECTED'],
          ['/v1/battle/tick', { steps: 1.5 }, 'INVALID_FIELD'],
          ['/v1/battle/tick', { steps: 1, direction: 'invalid' }, 'RULE_REJECTED'],
          ['/v1/battle/tick', { steps: 1, targetId: 'missing' }, 'RULE_REJECTED'],
          ['/v1/battle/tick', { steps: 1, award: 1000 }, 'INVALID_FIELD'],
          ['/v1/battle/action', { action: 'attack' }, 'RULE_REJECTED'],
          ['/v1/battle/action', { action: 'guard', targetId: 'missing' }, 'RULE_REJECTED'],
        ]) await rejectUnchanged(target, path, body, { requestId: `failed-${crypto.randomUUID()}` }, code);
        check(target.game.p.daily.day === '2020-01-01', 'Failed commands committed candidate daily refresh');
        same(await capture(api), original, 'Failure fixtures changed original source');
      });

      await test('Two real IndexedDB backends CAS-conflict, preserve loser, then refresh and continue', async () => {
        const a = await open('cas'); await load(a); await enable(a);
        await post(a, '/v1/battle/action', { action: 'autoskills' });
        const b = await open('cas-second', a.store.db.name);
        check(a.store.db !== b.store.db, 'CAS requires independent native database connections');
        const staleState = b.game.state; const staleRevision = b.revision;
        await post(a, '/v1/battle/tick', { steps: 2 }, { requestId: 'cas-winner' });
        const winner = await capture(a);
        const error = await rejectUnchanged(b, '/v1/battle/tick', { steps: 3, direction: 'right' }, { requestId: 'cas-loser' }, 'REVISION_CONFLICT');
        check(error.status === 409 && b.revision === staleRevision, 'CAS failure status/revision wrong');
        same(b.game.state, staleState, 'CAS loser adopted uncommitted candidate');
        same(await capture(a), winner, 'CAS loser overwrote winner or wrote history');
        b.adopt(await b.store.current());
        same(await capture(b), winner, 'Refresh did not adopt exact winner checkpoint and receipts');
        const afterRefresh = await post(b, '/v1/battle/tick', { steps: 1 }, { requestId: 'cas-loser', expectedRevision: b.revision });
        check(!afterRefresh.meta.duplicate && b.game.battle.rt.tick === 3 && b.revision === winner.revision + 1, 'Failed CAS request ID could not be retried after refresh');
        await persisted(b, 'CAS refreshed continuation');
        a.adopt(await a.store.current());
        same(await capture(a), await capture(b), 'Both connections did not converge on exact persisted continuation');
        await replay(a, '/v1/battle/tick', { steps: 1 }, 'cas-loser', afterRefresh);
        counts.persistedTicks += 3;
      });

      await test('Invalid realtime timer/coordinate/event imports reach schema and leave all stores untouched', async () => {
        const source = await open('invalid-import-source'); await load(source); await enable(source);
        await post(source, '/v1/battle/action', { action: 'autoskills' });
        await post(source, '/v1/battle/action', { action: 'skill:wz4', targetId: 'm1' });
        await post(source, '/v1/battle/action', { action: 'guard' });
        await post(source, '/v1/battle/tick', { steps: 1 });
        const original = await capture(source);
        const target = await open('invalid-import-target');
        const baseline = mechanicsFixture({ battle: false }); baseline.player.daily.day = '2020-01-01';
        await load(target, baseline);
        check(!target.game.busy, 'Import rejection must reach schema, not active-battle guard');
        const mutations = [
          ['fractional tick', (s) => s.battle.rt.tick = 1.5],
          ['far guard timer', (s) => s.battle.rt.player.guardReadyAt = 10000],
          ['far enemy timer', (s) => s.battle.rt.enemies.m0.readyAt = 10000],
          ['cooldown inconsistency', (s) => s.battle.rt.skillReady.wz4 += REALTIME_RULES.effectTicks],
          ['missing cooldown', (s) => delete s.battle.rt.skillReady.wz4],
          ['x below arena', (s) => s.battle.rt.player.x = -4.01],
          ['z above arena', (s) => s.battle.rt.enemies.m0.z = 2.81],
          ['NaN coordinate', (s) => s.battle.rt.player.x = NaN],
          ['invalid aim', (s) => s.battle.rt.enemies.m0.aim = { x: 0, z: 5 }],
          ['unknown enemy', (s) => s.battle.rt.enemies.unknown = clone(s.battle.rt.enemies.m0)],
          ['HP charm timer', (s) => s.player.charmCooldowns.hp = 51],
          ['fractional MP charm timer', (s) => s.player.charmCooldowns.mp = 0.5],
          ['missing charm timers', (s) => delete s.player.charmCooldowns],
          ['string paused flag', (s) => s.battle.rt.paused = 'false'],
          ['unknown event actor', (s) => s.battle.rt.events[0].actor = 'unknown'],
          ['unknown event target', (s) => s.battle.rt.events[0].target = 'unknown'],
          ['reward event', (s) => s.battle.rt.events[0].kind = 'reward'],
          ['event award injection', (s) => s.battle.rt.events[0].gold = 1e9],
          ['event sequence zero', (s) => s.battle.rt.events[0].seq = 0],
          ['future event', (s) => s.battle.rt.events[0].tick = s.battle.rt.tick + 1],
          ['negative event amount', (s) => s.battle.rt.events[0].amount = -1],
          ['event limit', (s) => {
            const event = clone(s.battle.rt.events[0]); s.battle.rt.sequence = 65;
            s.battle.rt.events = Array.from({ length: 65 }, (_, i) => ({ ...event, seq: i + 1 }));
          }],
          ['active resolved flag', (s) => s.battle.resolved = true],
        ];
        for (const [label, mutate] of mutations) {
          const invalid = clone(original.state); mutate(invalid);
          let error;
          try { error = await rejectUnchanged(target, '/v1/save/import', { snapshot: invalid, confirm: true }, { requestId: `invalid-import-${crypto.randomUUID()}` }); }
          catch (caught) { throw new Error(`${label}: ${caught.stack || caught}`); }
          check(!error.message.includes('请先结束战斗'), `${label}: schema was not reached`);
          same(await capture(source), original, `${label}: invalid import modified original live backend`);
          counts.invalidImports++;
        }
        check(target.game.p.daily.day === '2020-01-01', 'Invalid imports committed refreshDay');
        counts.persistedTicks++;
      });

      await test('Native staged-write IndexedDB abort rolls back tick/charm and potion charge; reopen/retry once', async () => {
        const api = await open('native-abort'); await load(api); await enable(api);
        await post(api, '/v1/battle/action', { action: 'autoskills' });
        const original = await capture(api);
        await nativeAbort(api, '/v1/battle/tick', { steps: 1 }, 'abort-tick-retry');
        await nativeAbort(api, '/v1/battle/action', { action: 'item:hp1' }, 'abort-potion-retry');
        same(await capture(api), original, 'Native aborted operations leaked any writes');
        const name = api.store.db.name; close(api);
        const restored = await open('native-abort-reopen', name);
        same(await capture(restored), original, 'Native abort changed reopened checkpoint or receipt history');
        const potion = await post(restored, '/v1/battle/action', { action: 'item:hp1' }, { requestId: 'abort-potion-retry' });
        check(!potion.meta.duplicate && restored.game.p.items.hp1 === original.state.player.items.hp1 - 1, 'Aborted potion ID did not retry with exactly one actual charge');
        const tick = await post(restored, '/v1/battle/tick', { steps: 1 }, { requestId: 'abort-tick-retry' });
        check(!tick.meta.duplicate && restored.game.battle.rt.tick === 1, 'Aborted tick ID did not retry exactly once');
        same(restored.game.p.charmCooldowns, { hp: 50, mp: 25 }, 'Aborted tick retry did not charge charm timers once');
        check(restored.revision === original.revision + 2 && (await raw(restored)).receiptCount === original.raw.receiptCount + 2, 'Native abort retries did not leave exactly two receipts');
        await replay(restored, '/v1/battle/action', { action: 'item:hp1' }, 'abort-potion-retry', potion);
        await replay(restored, '/v1/battle/tick', { steps: 1 }, 'abort-tick-retry', tick);
        await persisted(restored, 'Native abort retries'); counts.persistedTicks++;
      });

      await test('150 actual persisted ticks bound events at 64; native receipts/history pagination/reopen exact', async () => {
        const api = await open('bounded-events');
        await load(api, mechanicsFixture({ skills: false, lowResources: false })); await enable(api);
        const initialCount = (await raw(api)).receiptCount;
        for (let i = 0; i < 30; i++) {
          await post(api, '/v1/battle/tick', { steps: 5 }, { requestId: `bounded-tick-${i}` });
          const rt = api.game.battle.rt;
          check(rt.tick === (i + 1) * 5 && rt.events.length <= 64, 'Persisted tick or event limit wrong');
          same((await api.store.current()).snapshot, api.game.state, 'Bounded event live checkpoint differs');
        }
        const rt = api.game.battle.rt;
        check(rt.events.length === 64 && rt.sequence > 64 && rt.events[0].seq === rt.sequence - 63 && rt.events.at(-1).seq === rt.sequence, 'Actual event eviction/sequence evidence missing');
        check(rt.events.every((e, i) => i === 0 || e.tick >= rt.events[i - 1].tick), 'Persisted events are not chronological');
        const saved = await persisted(api, 'Bounded event checkpoint');
        check(saved.raw.receiptCount === initialCount + 30 && saved.revision === saved.raw.receiptCount, '150 steps should leave exactly 30 tick receipts');
        const first = (await get(api, '/v1/history', { limit: 7 })).data;
        const second = (await get(api, '/v1/history', { limit: 7, beforeRevision: first.nextBeforeRevision })).data;
        same(first.rows, saved.history.rows.slice(0, 7), 'First history page differs from native receipts');
        same(second.rows, saved.history.rows.slice(7, 14), 'Second history page overlaps/skips native receipts');
        same(await capture(api), saved, 'History pagination mutated backend');
        const name = api.store.db.name; close(api);
        const restored = await open('bounded-events-reopen', name);
        same(await capture(restored), saved, 'Bounded event/history checkpoint changed on reopen');
        same((await get(restored, '/v1/save/export')).data, saved.state, 'Bounded events export not exact');
        counts.persistedTicks += 150;
      });

      await test('Final multi-step tick native abort/retry, reward-once receipt and reopen with resolved checkpoint', async () => {
        const api = await open('reward-once');
        await load(api, mechanicsFixture({ count: 1, skills: false, lowResources: false, finalEnemy: true }));
        await enable(api);
        const before = await capture(api);
        const body = { steps: 5 }; const requestId = 'final-tick-reward-once';
        await nativeAbort(api, '/v1/battle/tick', body, requestId);
        const win = await post(api, '/v1/battle/tick', body, { requestId });
        const state = api.game.state; const rewards = state.battle.rewards;
        check(!win.meta.duplicate && win.data.result === 'win' && state.battle.result === 'win' && state.battle.resolved === true && state.battle.rt.tick === 1, 'Final tick did not stop remaining steps and resolve once');
        check(rewards && rewards.exp > 0 && rewards.sp > 0 && rewards.gold > 0 && rewards.levelUps === 0, 'Persisted reward summary missing');
        check(state.player.gold === before.state.player.gold + rewards.gold && state.player.sp === before.state.player.sp + rewards.sp && state.player.exp === before.state.player.exp + rewards.exp, 'Reward ledger deltas wrong');
        check(state.player.totals.battles === before.state.player.totals.battles + 1 && state.player.totals.earned === before.state.player.totals.earned + rewards.gold, 'Reward totals not applied exactly once');
        check(state.player.kills[state.battle.monsters[0].name] === 1 && state.player.equipment.weapon.durability === before.state.player.equipment.weapon.durability - 1, 'Kill count or durability not once');
        for (const item of rewards.items) check(state.player.items[item.id] === (before.state.player.items[item.id] || 0) + item.qty, 'Reward item delta not once');
        const committed = await persisted(api, 'Final tick reward');
        check(committed.revision === before.revision + 1 && committed.raw.receiptCount === before.raw.receiptCount + 1, 'Aborted/final/replay tick should have one award receipt');
        same((await api.store.receipt(requestId)).data, win.data, 'Final tick receipt missing reward result');
        await replay(api, '/v1/battle/tick', body, requestId, win);
        const name = api.store.db.name; close(api);
        const restored = await open('reward-reopen', name);
        same(await capture(restored), committed, 'Resolved reward checkpoint/receipts changed on reopen');
        await replay(restored, '/v1/battle/tick', body, requestId, win);
        await rejectUnchanged(restored, '/v1/battle/tick', { steps: 1 }, { requestId }, 'REQUEST_ID_REUSED');
        for (const [path, action] of [
          ['/v1/battle/tick', body], ['/v1/battle/action', { action: 'guard' }],
          ['/v1/battle/turn', { action: 'attack' }], ['/v1/battle/auto', {}], ['/v1/battle/realtime', {}],
        ]) await rejectUnchanged(restored, path, action, { requestId: `post-win-${crypto.randomUUID()}` });
        same(await capture(restored), committed, 'Completed battle accepted another award or wore equipment again');
        counts.persistedTicks++;
      });
    } finally {
      Math.random = originalRandom;
      for (const api of [...handles]) close(api);
    }
    await test('Isolated named database cleanup and no user/default storage', async () => {
      const databases = await indexedDB.databases();
      check(databases.length === names.length && databases.every((db) => names.includes(db.name)), 'Unexpected/default database opened');
      check(localStorage.length === 0 && sessionStorage.length === 0, 'Backend tests touched browser user storage');
      for (const name of names) await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = resolve;
        request.onerror = () => reject(new Error(`Could not delete test database ${name}: ${request.error?.message}`));
        request.onblocked = () => reject(new Error(`Test database cleanup blocked: ${name}`));
      });
      check((await indexedDB.databases()).length === 0, 'Disposable database cleanup incomplete');
    });
    return { results, counts, databases: names.length, gaps };
  });
  for (const result of report.results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}${result.error ? `\n${result.error}` : ''}`);
  console.log(`Realtime IndexedDB backend: ${report.results.filter((r) => r.ok).length}/${report.results.length} groups; ${report.databases} isolated databases; ${JSON.stringify(report.counts)}`);
  for (const gap of report.gaps) console.log(`GAP ${gap}`);
  assert.equal(inertNavigations, 1, 'Expected only one inert navigation');
  assert.deepEqual(appRequests, [], 'Application/Vite runtime autoexecuted');
  assert.deepEqual(unexpectedNetwork, [], 'Unexpected non-local network or websocket');
  assert.ok(report.results.every((r) => r.ok), 'Realtime IndexedDB backend tests failed');
} finally {
  if (context) await context.close();
  await browser.close();
}
