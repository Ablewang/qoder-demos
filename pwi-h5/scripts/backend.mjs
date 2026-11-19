import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const gameURL = process.env.GAME_URL;
if (!gameURL || !/^http:\/\/127\.0\.0\.1:(5176|5177|5183)\/?$/.test(gameURL)) throw new Error('Set GAME_URL explicitly to an isolated local preview on port 5176, 5177 or 5183');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext();
const page = await context.newPage();
await page.route('**/@vite/client', (route) => route.fulfill({ contentType: 'application/javascript', body: '' }));
try {
  await page.goto(gameURL);
  const report = await page.evaluate(async () => {
    const { LocalBackend, API_ROUTES } = await import('/src/core/api.js');
    const { Game, validateSave } = await import('/src/core/game.js');
    const { stats, makeMonster, SAVE_KEY, dayKey } = await import('/src/core/model.js');
    const { makeEquip, ITEMS } = await import('/src/data/items.js');
    const { CLASSES, SKILLS, skillReq } = await import('/src/data/classes.js');
    const { ZONES, DUNGEONS, CULTIVATION } = await import('/src/data/world.js');
    const { getProductionRecipe, getProductionRecipes, PRODUCTION_SKILLS, QIANKUN_TRANSFER_COSTS } = await import('/src/data/production.js');
    const { NAMED_EQUIPMENT, matchesNamedEquip, equipmentForShop } = await import('/src/data/named-equipment.js');
    const tutorialRecipe = (cls, slot) => {
      const recipe = getProductionRecipes(cls).find(r => r.slot === slot && r.lv === 1 && !r.from);
      if (!recipe) throw new Error(`Missing finite tutorial recipe: ${cls}/${slot}`);
      return recipe;
    };
    const { gearSpec, matchesGearSpec } = await import('/src/data/gear-specs.js');
    const { createBattle } = await import('/src/core/combat.js');
    const { ENCOUNTERS } = await import('/src/data/encounters.js');
    const { SHOP_PRODUCTS, ACTIVITY_POOLS } = await import('/src/data/economy.js');
    const results = [];
    const names = [];
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const same = (a, b, message) => check(JSON.stringify(a) === JSON.stringify(b), message);
    const test = async (name, run) => { try { await run(); results.push({ name, ok: true }); } catch (error) { results.push({ name, ok: false, error: error.stack }); } };
    const open = async (suffix) => {
      const name = `pwi-test-${crypto.randomUUID()}-${suffix}`; names.push(name);
      return LocalBackend.open({ databaseName: name, legacyStorage: null });
    };
    const command = (api, path, body = {}, options = {}) => api.request('POST', path, body, options);
    const reject = async (run, code) => { try { await run(); } catch (error) { if (code) check(error.code === code, `Expected ${code}, got ${error.code}: ${error.message}`); return; } throw new Error('Expected rejection'); };
    const fixture = (cls = 'wizard') => {
      const g = new Game(); g.start('接口自验', cls);
      const p = g.p; p.lv = 100; p.cult = 8; p.gold = 1e8; p.sp = 1e8; p.points = 500;
      // Explicit high raw-attribute fixtures, not organically earned progression.
      p.attrs = { str: 1000, dex: 1000, mag: 1000, con: 1000 };
      p.production = Object.fromEntries(Object.keys(PRODUCTION_SKILLS).map((skill) => [skill, { level: 6, exp: 0 }]));
      p.wallet = { yuanbao: 1e8, boundYuanbao: 1e8 };
      p.items = Object.fromEntries(Object.keys(ITEMS).map((id) => [id, 100]));
      p.skills = Object.fromEntries(SKILLS[cls].map((s) => [s.id, 1]));
      p.equipment = { weapon: makeEquip('weapon', 50, 2, cls), body: makeEquip('body', 50, 2, cls) };
      p.bag = [makeEquip('head', 50, 2, cls), makeEquip('feet', 50, 0, cls)];
      const st = stats(p); p.hp = st.hp; p.mp = st.mp; p.chi = 300;
      return g.state;
    };
    const load = (api, snapshot = fixture()) => command(api, '/v1/save/import', { snapshot, confirm: true });
    const legacyEquip = (it) => {
      const copy = structuredClone(it);
      for (const key of ['ruleVersion', 'series', 'weaponType', 'wear', 'ranges', 'stars', 'attackType', 'origin']) delete copy[key];
      copy.socketLimit = 4; copy.sockets = []; return copy;
    };
    const entrance = (snapshot, id) => {
      const d = DUNGEONS.find((d) => d.id === id); snapshot.player.location = d.entrance[0]; snapshot.player.encounter = null; snapshot.battle = null;
      if (!snapshot.player.discovered.includes(snapshot.player.location)) snapshot.player.discovered.push(snapshot.player.location);
      return snapshot;
    };
    const withRandom = async (value, run) => {
      const previous = Math.random; Math.random = typeof value === 'function' ? value : () => value;
      try { return await run(); } finally { Math.random = previous; }
    };
    const worldFixture = () => {
      const snapshot = fixture('blademaster');
      snapshot.player.location = 'h_f1'; snapshot.player.discovered.push('h_f1'); snapshot.player.totals.battles = 2;
      return snapshot;
    };
    const unchangedReject = async (api, run, code) => {
      const before = structuredClone(api.game.state); const revision = api.revision; const disk = await api.store.current();
      await reject(run, code);
      same(api.game.state, before, 'Rejected world command changed memory');
      same(await api.store.current(), disk, 'Rejected world command changed persisted checkpoint');
      check(api.revision === revision, 'Rejected world command increased revision');
    };
    await test('初始化、异步查询和完整接口清单', async () => {
      const api = await open('init');
      check((await api.request('GET', '/v1/bootstrap')).data.snapshot.player === null, 'Must start empty');
      await reject(() => command(api, '/v1/daily/sign'), 'NO_CHARACTER');
      await command(api, '/v1/character', { name: '测试角色', cls: 'blademaster' });
      check(api.revision === 1 && api.game.p.wallet.yuanbao === 300, 'Creation metadata');
      check(API_ROUTES.length === 76 && API_ROUTES.filter((r) => r.method === 'GET').length === 18 && API_ROUTES.filter((r) => r.method === 'POST').length === 58, 'Expected inspected route table: 76 routes / 18 GET / 58 POST');
      check(new Set(API_ROUTES.map((r) => `${r.method}:${r.path}`)).size === 76, 'Duplicate advertised route');
      same(API_ROUTES.find((r) => r.path === '/v1/world/explore'), { method: 'POST', path: '/v1/world/explore', fields: {} }, 'Explore route contract');
      same(API_ROUTES.find((r) => r.path === '/v1/world/encounter'), { method: 'POST', path: '/v1/world/encounter', fields: { choice: 'string' } }, 'Encounter route contract');
      for (const r of API_ROUTES.filter((r) => r.method === 'GET')) check((await api.request('GET', r.path)).ok, r.path);
      const view = await api.request('GET', '/v1/character'); view.data.player.gold = 0;
      check(api.game.p.gold === 300, 'Queries must be detached');
      await reject(() => command(api, '/v1/character', { name: '替换', cls: 'wizard' }), 'CONFIRM_REQUIRED');
      await reject(() => api.request('GET', '/missing'), 'NOT_FOUND');
      api.close();
    });
    await test('IndexedDB不可用明确拒绝，损坏旧档保留且不暗中覆盖', async () => {
      const original = Object.getOwnPropertyDescriptor(window, 'indexedDB');
      Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
      try { await reject(() => LocalBackend.open({ legacyStorage: null }), 'STORAGE_UNAVAILABLE'); }
      finally { if (original) Object.defineProperty(window, 'indexedDB', original); else delete window.indexedDB; }
      const name = `pwi-test-${crypto.randomUUID()}-invalid`; names.push(name);
      const raw = '{broken-json';
      const api = await LocalBackend.open({ databaseName: name, legacyStorage: { getItem: () => raw } });
      check(api.loadError && api.game.p === null && await api.store.current() === null, 'Corrupt save overwritten');
      check((await api.request('GET', '/v1/save/backup')).data === raw, 'Corrupt backup lost');
      await load(api); const view = api.game; view.p.gold = 0;
      check(api.game.p.gold !== 0, 'UI view can mutate committed backend'); api.close();
    });
    await test('双请求防重、同编号不同参数拒绝、扣费发奖一次', async () => {
      const api = await open('replay'); await load(api);
      const before = api.game.p.gold; const qty = api.game.p.items.hp1; const revision = api.revision;
      const body = { id: 'hp1', quantity: 10 }; const options = { requestId: 'buy-once' };
      const [first, second] = await Promise.all([command(api, '/v1/shop/potions/buy', body, options), command(api, '/v1/shop/potions/buy', body, options)]);
      check(!first.meta.duplicate && second.meta.duplicate && api.revision === revision + 1, 'Duplicate metadata');
      check(api.game.p.gold === before - 100 && api.game.p.items.hp1 === qty + 10, 'Spent twice');
      await reject(() => command(api, '/v1/shop/potions/buy', { ...body, quantity: 1 }, options), 'REQUEST_ID_REUSED');
      const saved = await api.store.current(); same(saved.snapshot, api.game.state, 'Disk mismatch'); api.close();
    });
    await test('真实IndexedDB事务中止、关闭数据库失败均不修改内存或磁盘', async () => {
      const api = await open('rollback'); await load(api); const before = structuredClone(api.game.state); const rev = api.revision;
      const db = api.store.db; const transaction = db.transaction.bind(db);
      db.transaction = (...args) => { const tx = transaction(...args); if (args[1] === 'readwrite') queueMicrotask(() => tx.abort()); return tx; };
      await reject(() => command(api, '/v1/mall/buy', { productId: 'trainingBundle', quantity: 1 }), 'STORAGE_WRITE_FAILED');
      db.transaction = transaction;
      same(api.game.state, before, 'Abort changed memory'); same((await api.store.current()).snapshot, before, 'Abort changed disk'); check(api.revision === rev, 'Abort increased revision');
      api.close(); await reject(() => command(api, '/v1/daily/sign'), 'STORAGE_CLOSED'); same(api.game.state, before, 'Closed DB changed state');
    });
    await test('跨标签页CAS冲突与刷新恢复，不覆盖另一标签进度', async () => {
      const a = await open('cas'); await load(a); const dbName = a.store.db.name;
      const b = await LocalBackend.open({ databaseName: dbName, legacyStorage: null });
      const beforeB = structuredClone(b.game.state); await command(a, '/v1/daily/sign');
      await reject(() => command(b, '/v1/mall/buy', { productId: 'town', quantity: 1 }), 'REVISION_CONFLICT');
      same(b.game.state, beforeB, 'CAS modified losing state');
      const c = await LocalBackend.open({ databaseName: dbName, legacyStorage: null }); same(c.game.state, a.game.state, 'Reopen lost committed state');
      a.close(); b.close(); c.close();
    });
    await test('旧档一次迁移、原始备份保留、刷新不重赠元宝', async () => {
      const snapshot = fixture(); snapshot.version = 1; delete snapshot.battle;
      for (const key of ['wallet', 'mall', 'events', 'drawHistory', 'cosmetics', 'charms']) delete snapshot.player[key];
      delete snapshot.player.daily.arena;
      snapshot.player.equipment = Object.fromEntries(Object.entries(snapshot.player.equipment).map(([slot, it]) => [slot, legacyEquip(it)]));
      snapshot.player.bag = snapshot.player.bag.map(legacyEquip);
      for (const it of [...Object.values(snapshot.player.equipment), ...snapshot.player.bag]) for (const key of ['durability', 'maxDurability', 'bound', 'sockets', 'socketLimit', 'rerolls', 'upgrades', 'setId']) delete it[key];
      const raw = JSON.stringify(snapshot); let writes = 0;
      const legacy = { getItem: (key) => key === SAVE_KEY ? raw : null, setItem: () => { writes++; } };
      const name = `pwi-test-${crypto.randomUUID()}-legacy`; names.push(name);
      const api = await LocalBackend.open({ databaseName: name, legacyStorage: legacy });
      check(api.game.p.wallet.yuanbao === 300 && api.game.p.equipment.weapon.durability === 100, 'Migration defaults');
      check((await api.request('GET', '/v1/save/backup')).data === raw && writes === 0, 'Raw backup lost');
      await command(api, '/v1/wallet/daily'); const balance = api.game.p.wallet.yuanbao;
      const again = await LocalBackend.open({ databaseName: name, legacyStorage: legacy });
      check(again.game.p.wallet.yuanbao === balance && again.revision === api.revision, 'Migration repeated'); api.close(); again.close();
    });
    await test('参数、布尔、离散计数、订单、开奖和孔位结构边界', async () => {
      const api = await open('boundary'); await load(api); const before = structuredClone(api.game.state);
      for (const body of [{ id: 'hp1', quantity: -1 }, { id: 'hp1', quantity: 1.5 }, { id: 'hp1', quantity: 1, admin: true }, { id: 'constructor', quantity: 1 }]) await reject(() => command(api, '/v1/shop/potions/buy', body));
      for (const mutate of [s => s.player.flight = 'false', s => s.player.points = 1.5, s => s.player.daily.day = '2026-02-30', s => s.player.events.hongyun.pity = 50, s => s.player.mall.orders = [{}], s => s.player.drawHistory = [{}], s => s.player.cosmetics.owned = ['missing'], s => s.player.equipment.weapon.sockets = ['unknown']]) {
        const invalid = structuredClone(before); mutate(invalid); await reject(() => load(api, invalid));
      }
      same(api.game.state, before, 'Invalid inputs mutated state'); api.close();
    });
    await test('66件商品API实际到账、外观佩戴卸下、护符装填', async () => {
      const api = await open('products'); await load(api);
      for (const product of SHOP_PRODUCTS) {
        const prior = api.game.p.wallet[product.currency];
        await command(api, '/v1/mall/buy', { productId: product.id, quantity: 1 });
        check(api.game.p.wallet[product.currency] === prior - product.price, product.id);
        validateSave(api.game.state);
      }
      check(api.game.p.mall.orders.length === SHOP_PRODUCTS.length, 'Orders missing');
      await command(api, '/v1/cosmetics/equip', { cosmeticId: 'outfitCloud', slot: 'outfit' });
      await command(api, '/v1/cosmetics/equip', { cosmeticId: null, slot: 'outfit' }); check(api.game.p.cosmetics.outfit === null, 'Unequip failed');
      await command(api, '/v1/charms/equip', { itemId: 'charmHp', count: 1 }); check(api.game.p.charms.hp === 600000, 'Golden charm stores 600000 HP'); api.close();
    });
    await test('五种奖池、十连、保底、记录、防重复领取与袋满原子拒绝', async () => {
      const api = await open('pools'); await load(api);
      const snap = structuredClone(api.game.state); snap.player.events.hongyun = { pity: 49, draws: 49 }; await load(api, snap);
      const originalRandom = Math.random;
      Math.random = () => 0;
      try {
        const result = await command(api, '/v1/treasure/draw', { count: 1 });
        check(result.data.result.results[0].guaranteed && result.data.result.results[0].rarity === 'legendary', '50th pity not delivered');
        await command(api, '/v1/treasure/draw', { count: 10 });
        for (const itemId of Object.keys(ACTIVITY_POOLS)) await command(api, '/v1/activities/open', { itemId, count: 10 });
      } finally { Math.random = originalRandom; }
      check(api.game.p.drawHistory.length === 51 && api.game.p.events.hongyun.draws === 60, 'History/counters');
      const historical = structuredClone(api.game.state);
      historical.player.drawHistory[0].name = '旧版奖励展示名称';
      await load(api, historical);
      const reopened = await LocalBackend.open({ databaseName: api.store.db.name, legacyStorage: null });
      same(reopened.game.state, api.game.state, 'Catalog wording changes broke historical records'); reopened.close();
      for (const mutate of [record => record.name = '', record => record.prizeId = 'unknown', record => record.source = 'unknown']) {
        const invalid = structuredClone(api.game.state); mutate(invalid.player.drawHistory[0]);
        await reject(() => load(api, invalid));
      }
      await command(api, '/v1/activities/claim', { milestoneId: 'draw10' });
      await reject(() => command(api, '/v1/activities/claim', { milestoneId: 'draw10' }));
      await command(api, '/v1/activities/claim', { milestoneId: 'festival.daily' });
      await reject(() => command(api, '/v1/activities/claim', { milestoneId: 'festival.daily' }));
      const full = structuredClone(api.game.state); full.player.bag = Array.from({ length: 80 }, () => makeEquip('body', 1, 0, full.player.cls)); await load(api, full);
      const before = structuredClone(api.game.state); await reject(() => command(api, '/v1/treasure/draw', { count: 10 })); same(api.game.state, before, 'Full bag lost pity/items'); api.close();
    });
    await test('神铸目录、实际兑换升阶穿戴、固定字段校验、防重与磁盘刷新', async () => {
      const { HIGH_EQUIPMENT, HIGH_RECIPES } = await import('/src/data/high-equipment.js');
      const { makeHighEquip } = await import('/src/data/items.js');
      const api = await open('high-equipment'); const snapshot = fixture('blademaster');
      snapshot.player.lv = 105; snapshot.player.attrs = { str: 300, con: 185, dex: 50, mag: 5 };
      snapshot.player.equipment = {}; snapshot.player.bag = []; snapshot.player.items.highForgeSigil = 1000;
      await load(api, snapshot);
      const catalog = (await api.request('GET', '/v1/equipment/catalog')).data;
      same(catalog.templates, HIGH_EQUIPMENT, 'Incomplete named catalog'); same(catalog.recipes, HIGH_RECIPES, 'Incomplete recipes');
      const before = structuredClone(api.game.state); const revision = api.revision;
      const body = { templateId: 'axe19a', confirm: true }; const options = { requestId: 'high-craft-once' };
      const [first, duplicate] = await Promise.all([command(api, '/v1/equipment/craft', body, options), command(api, '/v1/equipment/craft', body, options)]);
      check(!first.meta.duplicate && duplicate.meta.duplicate && api.revision === revision + 1, 'Craft replay metadata');
      check(api.game.p.bag.length === 1 && api.game.p.bag[0].templateId === 'axe19a', 'Actual craft missing');
      check(api.game.p.items.highForgeSigil === before.player.items.highForgeSigil - 60, 'Craft double charge');
      const uid = api.game.p.bag[0].uid;
      await command(api, '/v1/equipment/ascend', { uid, confirm: true }, { requestId: 'high-stage2' });
      check(api.game.p.bag[0].templateId === 'axe19b' && api.game.p.bag[0].uid === uid, 'Ascension replaced identity');
      await command(api, '/v1/equipment/equip', { uid });
      const unchanged = structuredClone(api.game.state); const unchangedRev = api.revision;
      await reject(() => command(api, '/v1/equipment/ascend', { uid, confirm: true }));
      await reject(() => command(api, '/v1/equipment/reroll', { uid }));
      same(api.game.state, unchanged, 'Rejected fixed operations changed state'); check(api.revision === unchangedRev, 'Rejected operation committed');
      const forged = structuredClone(api.game.state); forged.player.equipment.weapon.addons.attackLevel = 300;
      await reject(() => load(api, forged)); same(api.game.state, unchanged, 'Forged template adopted');
      const poor = structuredClone(api.game.state); poor.player.equipment = {}; poor.player.bag = []; poor.player.items.highForgeSigil = 0;
      await load(api, poor); const poorBefore = structuredClone(api.game.state); const poorRev = api.revision;
      await reject(() => command(api, '/v1/equipment/craft', { templateId: 'axe19a', confirm: true }));
      same(api.game.state, poorBefore, 'Poor craft charged'); check(api.revision === poorRev, 'Poor craft committed');
      const guarded = structuredClone(unchanged); guarded.player.bag = [makeHighEquip('sword18b')];
      await load(api, guarded);
      const reopened = await LocalBackend.open({ databaseName: api.store.db.name, legacyStorage: null });
      same(reopened.game.state, api.game.state, 'High template reload lost fields');
      same((await api.store.current()).snapshot, api.game.state, 'Disk high template mismatch');
      reopened.close(); api.close();
    });
    await test('装备培养七动作、拆孔null、升级保UID、绑定禁止出售', async () => {
      const api = await open('equipment'); const snapshot = fixture();
      snapshot.player.equipment.weapon = legacyEquip(snapshot.player.equipment.weapon);
      await load(api, snapshot);
      const uid = api.game.p.equipment.weapon.uid;
      await command(api, '/v1/equipment/socket', { uid, gemId: 'gemHp1' });
      await command(api, '/v1/equipment/unsocket', { uid, index: 0 }); check(api.game.p.equipment.weapon.sockets[0] === null, 'Socket layout not preserved');
      await command(api, '/v1/equipment/reroll', { uid });
      await command(api, '/v1/equipment/upgrade', { uid }); check(api.game.p.equipment.weapon.lv === 55 && api.game.p.equipment.weapon.uid === uid, 'Upgrade lost identity');
      const damaged = structuredClone(api.game.state); damaged.player.equipment.weapon.durability = 50; await load(api, damaged);
      await command(api, '/v1/equipment/repair', { uid }); check(api.game.p.equipment.weapon.durability === 100, 'Repair failed');
      await command(api, '/v1/equipment/bind', { uid, confirm: true });
      await command(api, '/v1/equipment/unequip', { slot: 'weapon' });
      await reject(() => command(api, '/v1/equipment/sell', { uid }));
      await reject(() => command(api, '/v1/equipment/decompose', { uid, confirm: true }));
      const loose = api.game.p.bag.find((it) => !it.bound).uid; await command(api, '/v1/equipment/decompose', { uid: loose, confirm: true }); api.close();
    });
    await test('十职业全部主动技能战斗快照保存与重开一致', async () => {
      const api = await open('skills'); let turns = 0;
      for (const cls of Object.keys(CLASSES)) for (const skill of SKILLS[cls].filter((s) => s.kind !== 'passive')) {
        const snap = fixture(cls); const p = snap.player; p.location = 'h_f1';
        // Explicit eligible rank-one snapshot fixtures, not naturally earned skills/cultivation.
        p.cult = Math.max(p.cult, skill.cult);
        p.lv = Math.max(p.lv, skillReq(skill, 1).level, CULTIVATION[p.cult].lv);
        p.path = p.cult >= 9 ? 'sage' : null;
        p.skills = { [skill.id]: 1 };
        const supported = skill.source.weapons.supportedTypes;
        check(supported.length > 0, `${cls}:${skill.id} has no supported source weapon`);
        const weaponType = supported.find((type) => type !== 'unarmed');
        p.equipment.weapon = weaponType ? makeEquip('weapon', 50, 2, cls, { weaponType }) : null;
        const st = stats(p); p.hp = st.hp; p.mp = st.mp;
        const m = makeMonster('快照试炼', 100); m.hp = m.maxHp = 1e8; m.atk = 0;
        snap.battle = createBattle(p, [m], { type: 'field', zone: 'h_f1' });
        if (skill.kind === 'petheal') snap.battle.pet = { name: '测试宠物', hp: 1, maxHp: 1000, atk: 1, def: 1, mdef: 1 };
        await load(api, snap);
        await command(api, '/v1/battle/turn', { action: `skill:${skill.id}`, targetId: 'm0' });
        check(api.game.battle.round === 1, `${cls}:${skill.id} did not execute`);
        const restored = await LocalBackend.open({ databaseName: api.store.db.name, legacyStorage: null });
        same(restored.game.state, api.game.state, `${cls}:${skill.id} reload changed battle`); restored.close(); turns++;
        const released = api.game.state; released.battle.result = 'escape';
        await api.store.commit(released, api.revision, { id: crypto.randomUUID(), path: '/test/release', signature: crypto.randomUUID(), data: {} });
        api.adopt(await api.store.current());
      }
      check(turns === 71, `Expected 71 skills, got ${turns}`); api.close();
    });
    await test('成长、NPC交易、任务、日常与战斗结算接口黄金路径', async () => {
      const api = await open('commands'); const snap = fixture(); snap.player.hp = 1; snap.player.mp = 1; await load(api, snap);
      await command(api, '/v1/character/attributes', { key: 'mag', quantity: 5 });
      await command(api, '/v1/character/attributes/recommended');
      await command(api, '/v1/items/use', { id: 'hp1' }); await command(api, '/v1/world/rest');
      const stock = equipmentForShop(api.game.p).find(entry => (entry.slot || entry.equipment?.slot) === 'weapon');
      check(stock, 'No actual named weapon stock');
      await command(api, '/v1/shop/equipment/buy', { templateId: stock.templateId });
      await command(api, '/v1/equipment/forge', { slot: 'body', quality: 1 });
      await command(api, '/v1/equipment/equip', { uid: api.game.p.bag.at(-1).uid });
      await command(api, '/v1/equipment/refine', { slot: 'body', aid: 'tiangang' });
      await command(api, '/v1/equipment/sell', { uid: api.game.p.bag.find((it) => it.q === 0).uid });
      await command(api, '/v1/equipment/sell-common', { confirm: true });
      await command(api, '/v1/skills/learn', { id: SKILLS.wizard[0].id });
      // The first objective now requires a real field visit; bounty acceptance still requires a city.
      await command(api, '/v1/world/travel', { id: 'h_f1' });
      await command(api, '/v1/quests/claim', { bounty: false });
      await command(api, '/v1/world/travel', { id: 'wanliu' });
      await command(api, '/v1/quests/bounty');
      await command(api, '/v1/daily/cards'); await command(api, '/v1/daily/sign');
      await command(api, '/v1/world/travel', { id: 'h_f1' }); await command(api, '/v1/battle/hunt', { index: 0 });
      const before = structuredClone(api.game.state); await reject(() => command(api, '/v1/battle/turn', { action: 'admin' }), 'INVALID_ACTION'); same(api.game.state, before, 'Invalid turn advanced clocks');
      for (let i = 0; api.game.busy && i < 30; i++) await command(api, '/v1/battle/auto');
      check(api.game.battle.result === 'win', 'Low-level hunt failed');
      const battleCount = api.game.p.totals.battles; await reject(() => command(api, '/v1/battle/turn', { action: 'attack' })); check(api.game.p.totals.battles === battleCount, 'Rewards replayed');
      await command(api, '/v1/battle/leave'); await command(api, '/v1/items/use', { id: 'town' }); await command(api, '/v1/save'); api.close();
    });
    await test('副本波次、试炼、仙魔与比武断点及奖励次数一致', async () => {
      const api = await open('challenges'); const snap = fixture(); snap.player.attrs = { str: 1000, con: 1000, dex: 1000, mag: 1000 };
      const st = stats(snap.player); snap.player.hp = st.hp; snap.player.mp = st.mp;
      entrance(snap, 'd15'); await load(api, snap);
      await command(api, '/v1/dungeons/enter', { id: 'd15' });
      const restored = await LocalBackend.open({ databaseName: api.store.db.name, legacyStorage: null }); same(restored.game.battle, api.game.battle, 'Entry wave lost'); restored.close();
      for (let i = 0; i < 30; i++) {
        if (api.game.busy) await command(api, '/v1/battle/auto');
        else if (api.game.battle.result === 'win' && !api.game.battle.context.bossWave) await command(api, '/v1/dungeons/next');
        else break;
      }
      check(api.game.p.clears.d15 === 1 && api.game.p.daily.dungeons.d15 === 1, 'Dungeon clear/cost wrong');
      await command(api, '/v1/battle/leave'); await command(api, '/v1/world/travel', { id: 'wanliu' }); await command(api, '/v1/cultivation/trial');
      for (let i = 0; api.game.busy && i < 30; i++) await command(api, '/v1/battle/auto');
      check(api.game.p.trialReady, 'Trial not ready'); await command(api, '/v1/battle/leave');
      await command(api, '/v1/cultivation/breakthrough', { path: 'sage' }); check(api.game.p.cult === 9 && api.game.p.path === 'sage', 'Cultivation result');
      await command(api, '/v1/arena/enter'); for (let i = 0; api.game.busy && i < 30; i++) await command(api, '/v1/battle/auto');
      check(api.game.p.daily.arena === 1 && api.game.battle.result === 'win', 'Arena result'); api.close();
    });
    await test('商城买入箱粽后直接开启，日常不赠箱粽且无需秘宝钥匙', async () => {
      const api = await open('cash-boxes');
      await command(api, '/v1/character', { name: '商城箱粽', cls: 'blademaster' });
      const originalItems = structuredClone(api.game.p.items);
      await command(api, '/v1/wallet/daily');
      same(api.game.p.items, originalItems, 'Daily wallet granted boxes or keys');
      await command(api, '/v1/activities/claim', { milestoneId: 'festival.daily' });
      same(api.game.p.items, originalItems, 'Daily subsidy granted boxes or zongzi');
      check(!api.game.p.items.treasureKey, 'New character has hidden treasure keys');
      for (const itemId of Object.keys(ACTIVITY_POOLS)) {
        await reject(() => command(api, '/v1/activities/open', { itemId, count: 1 }));
        await command(api, '/v1/mall/buy', { productId: itemId, quantity: 1 });
        check(api.game.p.items[itemId] === 1, `${itemId} purchase not delivered`);
        const result = await command(api, '/v1/activities/open', { itemId, count: 1 });
        check(result.data.result.results.length === 1 && api.game.p.items[itemId] === 0 && !api.game.p.items.treasureKey, `${itemId} open did not consume only the box`);
      }
      check(api.game.p.events.chestsOpened === 2 && api.game.p.events.zongziOpened === 2 && api.game.p.events.hongyun.draws === 0, 'Cash box counters changed treasure state');
      const restored = await LocalBackend.open({ databaseName: api.store.db.name, legacyStorage: null });
      same(restored.game.state, api.game.state, 'Cash box purchase/open reload mismatch'); restored.close(); api.close();
    });
    await test('全部野外怪物经API入场、行动与IndexedDB重开保持完整快照', async () => {
      let encounters = 0;
      for (const [zoneId, zone] of Object.entries(ZONES).filter(([, zone]) => zone.type === 'field')) {
        for (let index = 0; index < zone.mobs.length; index++) {
          const api = await open('field'); let restored;
          try {
            const snap = fixture(); snap.player.location = zoneId;
            if (!snap.player.discovered.includes(zoneId)) snap.player.discovered.push(zoneId);
            await load(api, snap);
            await command(api, '/v1/battle/hunt', { index });
            const monster = api.game.battle.monsters[0];
            check(monster.name === zone.mobs[index][0] && ['', 'elite', 'boss'].includes(monster.rank), `${zoneId}:${index} monster identity`);
            check(monster.type === (zone.mobs[index][3] || 'phys'), `${zoneId}:${index} damage type changed`);
            await command(api, '/v1/battle/turn', { action: 'defend' });
            check(api.game.battle.round === 1, `${zoneId}:${index} turn did not execute`);
            restored = await LocalBackend.open({ databaseName: api.store.db.name, legacyStorage: null });
            same(restored.game.state, api.game.state, `${zoneId}:${index} reload changed snapshot`);
            encounters++;
          } finally { restored?.close(); api.close(); }
        }
      }
      check(encounters === Object.values(ZONES).reduce((sum, zone) => sum + (zone.mobs?.length || 0), 0), 'Field encounter coverage incomplete');
    });
    await test('探索接口前两胜保护及四种随机结果实际持久化', async () => {
      for (const [roll, kind] of [[0.1, 'fight'], [0.65, 'find'], [0.8, 'encounter'], [0.97, 'rare']]) {
        const api = await open(`explore-${kind}`);
        try {
          await load(api, worldFixture()); const before = structuredClone(api.game.state); const revision = api.revision;
          const result = await withRandom(roll, () => command(api, '/v1/world/explore', {}));
          check(result.data.result.kind === kind && api.revision === revision + 1, `${kind} exploration contract`);
          check(api.game.p.totals.battles === 2 && api.game.busy === (kind === 'fight'), 'Exploration changed victory count or battle state');
          if (kind === 'find') check(api.game.p.items.huanxian === before.player.items.huanxian + 1, 'Find reward missing');
          if (kind === 'rare') check(api.game.p.expBoost === before.player.expBoost + 3, 'Rare boost missing');
          if (kind === 'encounter') check(ENCOUNTERS[api.game.p.encounter.id] && api.game.p.encounter.zone === 'h_f1', 'Pending encounter missing');
          if (kind === 'fight') check(api.game.battle.monsters[0].intent === 'attack', 'Third battle normal opening changed');
          same((await api.store.current()).snapshot, api.game.state, 'Exploration checkpoint mismatch');
          if (kind === 'encounter' || kind === 'fight') await unchangedReject(api, () => command(api, '/v1/world/explore', {}), 'RULE_REJECTED');
        } finally { api.close(); }
      }
      for (const wins of [0, 1]) {
        const api = await open(`explore-gentle-${wins}`);
        try {
          const snapshot = worldFixture(); snapshot.player.totals.battles = wins;
          await load(api, snapshot);
          const result = await withRandom(0.97, () => command(api, '/v1/world/explore', {}));
          const m = api.game.battle.monsters[0];
          check(result.data.result.kind === 'fight' && m.rank === '' && m.lv <= api.game.p.lv && m.intent === 'attack', 'First two successes must force a gentle normal battle');
          check(api.game.p.totals.battles === wins, 'Entry counted as a win');
        } finally { api.close(); }
      }
    });
    await test('探索与奇遇未知字段、错误choice及规则拒绝不改版本或存档', async () => {
      const api = await open('world-boundaries');
      try {
        const snapshot = worldFixture(); snapshot.player.encounter = { id: 'merchant', zone: 'h_f1', mob: '小野猪' };
        // Candidate daily refresh must also be rolled back on a rejected command.
        snapshot.player.daily.day = '2020-01-01'; await load(api, snapshot);
        for (const body of [{ admin: true }, { choice: 'help' }]) await unchangedReject(api, () => command(api, '/v1/world/explore', body), 'INVALID_FIELD');
        for (const body of [null, []]) await unchangedReject(api, () => command(api, '/v1/world/explore', body), 'INVALID_BODY');
        for (const body of [{}, { choice: null }, { choice: 1 }, { choice: false }, { choice: [] }, { choice: {} }, { choice: 'help', admin: true }]) {
          await unchangedReject(api, () => command(api, '/v1/world/encounter', body), 'INVALID_FIELD');
        }
        for (const choice of ['missing', '']) await unchangedReject(api, () => command(api, '/v1/world/encounter', { choice }), 'RULE_REJECTED');
        await unchangedReject(api, () => command(api, '/v1/world/explore', {}), 'RULE_REJECTED');
        const noPotions = structuredClone(api.game.state); noPotions.player.items.hp1 = 0; noPotions.player.items.hp2 = 0;
        await load(api, noPotions); await unchangedReject(api, () => command(api, '/v1/world/encounter', { choice: 'help' }), 'RULE_REJECTED');
        await command(api, '/v1/world/travel', { id: 'wanliu' });
        check(api.game.p.encounter === null, 'Travel did not clear pending encounter');
        await unchangedReject(api, () => command(api, '/v1/world/explore', {}), 'RULE_REJECTED');
        await unchangedReject(api, () => command(api, '/v1/world/encounter', { choice: 'help' }), 'RULE_REJECTED');
      } finally { api.close(); }
    });
    await test('探索和奇遇requestId重放复用随机结果且奖励扣费一次', async () => {
      const api = await open('world-replay');
      const noRandom = () => { throw new Error('Duplicate request rerolled randomness'); };
      const replay = async (path, body, options, first, committed, revision) => {
        const duplicate = await withRandom(noRandom, () => command(api, path, body, options));
        same(duplicate.data, first.data, 'Duplicate returned a different random result');
        check(!first.meta.duplicate && duplicate.meta.duplicate && api.revision === revision + 1, 'Replay revision/metadata wrong');
        same(api.game.state, committed, 'Duplicate charged or rewarded again');
        same((await api.store.current()).snapshot, committed, 'Replay changed saved checkpoint');
      };
      try {
        await load(api, worldFixture());
        let before = structuredClone(api.game.state); let revision = api.revision;
        const findOptions = { requestId: 'explore-find-once' };
        const find = await withRandom(0.65, () => command(api, '/v1/world/explore', {}, findOptions));
        check(find.data.result.kind === 'find' && api.game.p.items.huanxian === before.player.items.huanxian + 1, 'Find payout wrong');
        await replay('/v1/world/explore', {}, findOptions, find, structuredClone(api.game.state), revision);
        revision = api.revision;
        const pendingOptions = { requestId: 'explore-pending-once' };
        const pending = await withRandom(0.8, () => command(api, '/v1/world/explore', {}, pendingOptions));
        check(pending.data.result.kind === 'encounter' && api.game.p.encounter.id === 'taoist', 'Controlled pending selection wrong');
        await replay('/v1/world/explore', {}, pendingOptions, pending, structuredClone(api.game.state), revision);
        before = structuredClone(api.game.state); revision = api.revision;
        const buyOptions = { requestId: 'encounter-cost-once' };
        const buy = await command(api, '/v1/world/encounter', { choice: 'buy' }, buyOptions);
        check(api.game.p.gold === before.player.gold - (50 + before.player.lv * 30) && api.game.p.expBoost === before.player.expBoost + 3 && api.game.p.encounter === null, 'Choice cost/boost not applied once');
        await replay('/v1/world/encounter', { choice: 'buy' }, buyOptions, buy, structuredClone(api.game.state), revision);
        await unchangedReject(api, () => command(api, '/v1/world/encounter', { choice: 'refuse' }, buyOptions), 'REQUEST_ID_REUSED');
        const chest = worldFixture(); chest.player.encounter = { id: 'chest', zone: 'h_f1', mob: '小野猪' }; await load(api, chest);
        before = structuredClone(api.game.state); revision = api.revision;
        const chestOptions = { requestId: 'encounter-random-once' };
        const reward = await withRandom(0.1, () => command(api, '/v1/world/encounter', { choice: 'open' }, chestOptions));
        check(reward.data.result.kind === 'resolved' && api.game.p.bag.length === before.player.bag.length + 1 && api.game.p.items.huanxian === before.player.items.huanxian + 1 && api.game.p.gold === before.player.gold + 40 + before.player.lv * 15, 'Random chest reward wrong');
        await replay('/v1/world/encounter', { choice: 'open' }, chestOptions, reward, structuredClone(api.game.state), revision);
        const restored = await LocalBackend.open({ databaseName: api.store.db.name, legacyStorage: null });
        try {
          const duplicate = await withRandom(noRandom, () => command(restored, '/v1/world/encounter', { choice: 'open' }, chestOptions));
          same(duplicate.data, reward.data, 'Reopen lost random receipt'); same(restored.game.state, api.game.state, 'Reopened replay paid again');
          check(duplicate.meta.duplicate && restored.revision === api.revision, 'Reopened replay changed revision');
        } finally { restored.close(); }
      } finally { api.close(); }
    });
    await test('未决奇遇及heavy与exposed怪物意图重开完整保存', async () => {
      for (const [id, choice, roll, intent] of [['spring', 'meditate', 0.1, 'heavy'], ['beast', 'ambush', 0.9, 'exposed']]) {
        const api = await open(`intent-${intent}`);
        try {
          const snapshot = worldFixture(); snapshot.player.encounter = { id, zone: 'h_f1', mob: id === 'beast' ? '山贼头目' : '小野猪' };
          await load(api, snapshot);
          const reopened = await LocalBackend.open({ databaseName: api.store.db.name, legacyStorage: null });
          try {
            same(reopened.game.state, api.game.state, 'Unresolved encounter changed on reopen');
            await unchangedReject(reopened, () => command(reopened, '/v1/world/explore', {}), 'RULE_REJECTED');
            const result = await withRandom(roll, () => command(reopened, '/v1/world/encounter', { choice }));
            check(result.data.result.kind === 'fight' && reopened.game.p.encounter === null && reopened.game.battle.monsters[0].intent === intent, 'Encounter opening intent wrong');
            const active = structuredClone(reopened.game.state); const revision = reopened.revision;
            reopened.close();
            const resumed = await LocalBackend.open({ databaseName: api.store.db.name, legacyStorage: null });
            try {
              same(resumed.game.state, active, 'Monster intent checkpoint changed on reopen'); check(resumed.revision === revision, 'Reopen committed a revision');
              same((await resumed.store.current()).snapshot, active, 'Intent checkpoint not persisted');
              await unchangedReject(resumed, () => command(resumed, '/v1/world/encounter', { choice }), 'RULE_REJECTED');
            } finally { resumed.close(); }
          } finally { reopened.close(); }
        } finally { api.close(); }
      }
    });
    await test('普通胜利b.rewards结算断点重开与重复请求不再发奖', async () => {
      const api = await open('battle-rewards');
      try {
        const snapshot = worldFixture(); const p = snapshot.player;
        p.mainIndex = 1; p.mainProgress = 0;
        const g = new Game(snapshot); const q = g.mainQuest;
        check(q.goal.type === 'kill' && q.goal.count === 1, 'Expected visit-first tutorial followed by kill-one objective');
        const m = makeMonster(...ZONES.h_f1.mobs[0]); m.hp = 1;
        snapshot.battle = createBattle(p, [m], { type: 'field', zone: 'h_f1' });
        await load(api, snapshot); const before = structuredClone(api.game.state); const revision = api.revision;
        const body = { action: 'attack' }; const options = { requestId: 'battle-reward-once' };
        const win = await withRandom(0.1, () => command(api, '/v1/battle/turn', body, options));
        check(win.data.result === 'win' && api.revision === revision + 1, 'Reward victory missing');
        const r = api.game.battle.rewards;
        check(r && r.exp > 0 && r.sp > 0 && r.gold > 0 && r.levelUps === 0 && r.loot.length === 1, 'Reward summary shape missing');
        same(r.quest, { title: q.title, done: 1, total: 1 }, 'Quest reward metadata lost');
        same(r.items, [{ id: 'hp1', qty: 1 }, { id: 'huanxian', qty: 1 }, { id: 'hide1', qty: 1 }], 'Item delta metadata wrong');
        check(api.game.p.gold === before.player.gold + r.gold && api.game.p.sp === before.player.sp + r.sp && api.game.p.totals.battles === before.player.totals.battles + 1, 'Reward ledger mismatch');
        const committed = structuredClone(api.game.state); api.close();
        const restored = await LocalBackend.open({ databaseName: api.store.db.name, legacyStorage: null });
        try {
          same(restored.game.state, committed, 'Completed battle rewards changed on reopen');
          same((await restored.store.current()).snapshot.battle.rewards, r, 'Rewards missing on disk');
          const duplicate = await withRandom(() => { throw new Error('Reward replay rerolled drops'); }, () => command(restored, '/v1/battle/turn', body, options));
          same(duplicate.data, win.data, 'Victory replay changed response'); check(duplicate.meta.duplicate && restored.revision === revision + 1, 'Victory replay changed revision');
          same(restored.game.state, committed, 'Victory replay paid twice');
          await unchangedReject(restored, () => command(restored, '/v1/battle/turn', body), 'RULE_REJECTED');
        } finally { restored.close(); }
      } finally { api.close(); }
    });
    await test('分页记录、版本编号与每日次数持续保存', async () => {
      const api = await open('history'); await load(api);
      await command(api, '/v1/wallet/daily'); await reject(() => command(api, '/v1/wallet/daily'));
      await command(api, '/v1/wallet/exchange', { quantity: 99 }); await command(api, '/v1/wallet/exchange', { quantity: 1 });
      await reject(() => command(api, '/v1/wallet/exchange', { quantity: 1 }));
      const first = (await api.request('GET', '/v1/history', { limit: 2 })).data;
      const second = (await api.request('GET', '/v1/history', { limit: 2, beforeRevision: first.nextBeforeRevision })).data;
      check(first.rows[1].revision > second.rows[0].revision, 'Pagination overlap');
      const old = structuredClone(api.game.state); old.player.daily.day = '2020-01-01'; old.player.daily.arena = 3; old.player.daily.signed = true; await load(api, old);
      await command(api, '/v1/daily/sign'); check(api.game.p.daily.day === dayKey() && api.game.p.daily.arena === 0, 'Daily reset failed'); api.close();
    });
    await test('新增制造采集开孔转移路由字段契约与只读目录无随机无UID', async () => {
      const api = await open('production-contract');
      try {
        await load(api);
        const fields = {
          '/v1/world/gather': { resource: 'string' },
          '/v1/equipment/produce': { recipeId: 'string', uid: 'string?', inherit: 'boolean?', confirm: 'boolean' },
          '/v1/equipment/train': { skill: 'string' }, '/v1/equipment/machine': {},
          '/v1/equipment/punch': { uid: 'string' },
          '/v1/equipment/transfer': { fromUid: 'string', toUid: 'string', confirm: 'boolean' },
        };
        for (const [path, expected] of Object.entries(fields)) same(API_ROUTES.find(r => r.path === path && r.method === 'POST').fields, expected, path);
        const before = structuredClone(api.game.state), revision = api.revision, disk = await api.store.current();
        const catalog = await withRandom(() => { throw new Error('GET created random equipment'); }, () => api.request('GET', '/v1/equipment/production'));
        check(catalog.data.recipes.length === getProductionRecipes(api.game.p.cls).length, 'Detached named recipe catalog incomplete');
        check(catalog.data.recipes.every(r => Object.hasOwn(NAMED_EQUIPMENT, r.templateId)), 'Recipe still uses generated series identity');
        check(catalog.data.recipes.every(r => r.previews.every(p => !Object.hasOwn(p, 'uid'))), 'Preview created UID');
        catalog.data.recipes[0].materials.ore1 = -99; catalog.data.skills.blacksmith.level = 1;
        same(api.game.state, before, 'GET mutated player'); same(await api.store.current(), disk, 'GET wrote checkpoint'); check(api.revision === revision, 'GET committed revision');
      } finally { api.close(); }
    });
    await test('新增POST全部类型及未知字段原子拒绝并验证新版装备伪造导入', async () => {
      const api = await open('production-boundary');
      try {
        await load(api);
        for (const [path, valid] of [
          ['/v1/equipment/produce', { recipeId: tutorialRecipe(api.game.p.cls, 'weapon').id, confirm: true }],
          ['/v1/equipment/train', { skill: 'blacksmith' }], ['/v1/equipment/machine', {}],
          ['/v1/equipment/punch', { uid: api.game.p.equipment.weapon.uid }],
          ['/v1/equipment/transfer', { fromUid: api.game.p.equipment.weapon.uid, toUid: api.game.p.equipment.body.uid, confirm: true }],
          ['/v1/world/gather', { resource: 'ore' }],
        ]) {
          for (const body of [null, []]) await unchangedReject(api, () => command(api, path, body), 'INVALID_BODY');
          await unchangedReject(api, () => command(api, path, { ...valid, admin: true }), 'INVALID_FIELD');
          for (const key of Object.keys(valid)) await unchangedReject(api, () => command(api, path, { ...valid, [key]: typeof valid[key] === 'boolean' ? 'true' : 1 }), 'INVALID_FIELD');
        }
        for (const body of [{ recipeId: tutorialRecipe(api.game.p.cls, 'weapon').id, confirm: false }, { recipeId: 'constructor', confirm: true }, { recipeId: tutorialRecipe(api.game.p.cls, 'weapon').id, uid: 'absent', confirm: true }, { recipeId: tutorialRecipe(api.game.p.cls, 'weapon').id, inherit: true, confirm: true }]) await unchangedReject(api, () => command(api, '/v1/equipment/produce', body), 'RULE_REJECTED');
        await unchangedReject(api, () => command(api, '/v1/equipment/produce', { recipeId: tutorialRecipe(api.game.p.cls, 'weapon').id, confirm: true, inherit: 'true' }), 'INVALID_FIELD');
        for (const mutate of [it => it.base.matk++, it => it.wear.mag = 0, it => it.addons.creation = 1, it => it.sockets = ['gemHp1'], it => it.socketLimit = 4, it => delete it.ruleVersion]) {
          const forged = structuredClone(api.game.state); mutate(forged.player.equipment.weapon);
          await unchangedReject(api, () => load(api, forged));
        }
      } finally { api.close(); }
    });
    await test('真实制造扣材料经验品质一次及requestId重放与结果脱离', async () => {
      const api = await open('produce-replay');
      try {
        await load(api); const before = structuredClone(api.game.state), revision = api.revision;
        const recipe = tutorialRecipe(api.game.p.cls, 'weapon'), body = { recipeId: recipe.id, confirm: true }, options = { requestId: 'produce-once' };
        const first = await withRandom(.5, () => command(api, '/v1/equipment/produce', body, options));
        const it = api.game.p.bag.at(-1); check(it.ruleVersion === 2 && it.templateId === recipe.templateId && matchesNamedEquip(it), 'Actual production output not named canonical');
        check(api.game.p.gold === before.player.gold - recipe.gold && api.game.p.production.blacksmith.exp === 1, 'Produce cost/XP mismatch');
        for (const [id, qty] of Object.entries(recipe.materials)) check(api.game.p.items[id] === before.player.items[id] - qty, `Consume ${id}`);
        const committed = structuredClone(api.game.state), copy = structuredClone(first.data);
        first.data.result.equipment.base.matk = -1; same(api.game.state, committed, 'Response references live item');
        const duplicate = await withRandom(() => { throw new Error('Replay rerolled'); }, () => command(api, '/v1/equipment/produce', body, options));
        same(duplicate.data, copy, 'Replay receipt changed'); check(duplicate.meta.duplicate && api.revision === revision + 1, 'Replay committed twice'); same(api.game.state, committed, 'Replay double charge');
        await unchangedReject(api, () => command(api, '/v1/equipment/produce', { recipeId: tutorialRecipe(api.game.p.cls, 'body').id, confirm: true }, options), 'REQUEST_ID_REUSED');
        const restored = await LocalBackend.open({ databaseName: api.store.db.name, legacyStorage: null });
        try { same(restored.game.state, committed, 'Produce checkpoint lost'); } finally { restored.close(); }
      } finally { api.close(); }
    });
    await test('新版洗练升级拒绝与武器先开孔攻击宝石上限实际持久化', async () => {
      const api = await open('new-socket');
      try {
        const snap = fixture(); snap.player.equipment.weapon = makeEquip('weapon', 60, 0, snap.player.cls); await load(api, snap);
        const uid = api.game.p.equipment.weapon.uid;
        for (const path of ['/v1/equipment/reroll', '/v1/equipment/upgrade']) await unchangedReject(api, () => command(api, path, { uid }), 'RULE_REJECTED');
        await unchangedReject(api, () => command(api, '/v1/equipment/socket', { uid, gemId: 'gemMatk1' }), 'RULE_REJECTED');
        for (let i = 0; i < 2; i++) {
          const stone = api.game.p.items.socketStone; await command(api, '/v1/equipment/punch', { uid });
          check(api.game.p.items.socketStone === stone - 8 * (i + 1), 'Punch cost must grade x index');
          await unchangedReject(api, () => command(api, '/v1/equipment/socket', { uid, gemId: 'gemHp1', index: i }), 'RULE_REJECTED');
          await command(api, '/v1/equipment/socket', { uid, gemId: 'gemMatk1', index: i }); check(api.game.p.equipment.weapon.sockets[i] === 'gemMatk1', 'Socket not delivered');
        }
        await unchangedReject(api, () => command(api, '/v1/equipment/punch', { uid }), 'RULE_REJECTED');
        const count = api.game.p.items.gemMatk1; await command(api, '/v1/equipment/unsocket', { uid, index: 0 });
        check(api.game.p.items.gemMatk1 === count + 1 && api.game.p.equipment.weapon.sockets[0] === null, 'Unsocket one-gem return');
        await unchangedReject(api, () => command(api, '/v1/equipment/unsocket', { uid, index: 0 }), 'RULE_REJECTED');
        const restored = await LocalBackend.open({ databaseName: api.store.db.name, legacyStorage: null });
        try { same(restored.game.state, api.game.state, 'Socket checkpoint mismatch'); } finally { restored.close(); }
      } finally { api.close(); }
    });
    await test('未核轮回公式链退出生产且保留旧前身全部培养状态', async () => {
      const api = await open('retired-inheritance');
      try {
        const snap = fixture('blademaster'), old = makeEquip('weapon', 99, 3, 'blademaster', { series: 'twilight' });
        old.refine = 3; old.bound = true; old.sockets = ['gemPatk2', null]; old.durability = 37; snap.player.bag = [old]; await load(api, snap);
        const recipes = (await api.request('GET', '/v1/equipment/production')).data.recipes;
        check(!recipes.some(r => r.id === 'nirvana1-100-weapon'), 'Unverified formula chain still offered');
        const body = { recipeId: 'nirvana1-100-weapon', uid: old.uid, inherit: true, confirm: true };
        await unchangedReject(api, () => command(api, '/v1/equipment/produce', body), 'RULE_REJECTED');
        same(api.game.p.bag[0], old, 'Retired chain rewrote historical predecessor');
      } finally { api.close(); }
    });
    await test('制造IndexedDB中止和CAS冲突不消耗材料经验且刷新可恢复', async () => {
      const api = await open('production-transaction');
      try {
        await load(api); const before = structuredClone(api.game.state), revision = api.revision;
        const db = api.store.db, transaction = db.transaction.bind(db);
        db.transaction = (...args) => { const tx = transaction(...args); if (args[1] === 'readwrite') queueMicrotask(() => tx.abort()); return tx; };
        try { await reject(() => command(api, '/v1/equipment/produce', { recipeId: tutorialRecipe(api.game.p.cls, 'body').id, confirm: true }), 'STORAGE_WRITE_FAILED'); }
        finally { db.transaction = transaction; }
        same(api.game.state, before, 'Produce abort changed memory'); same((await api.store.current()).snapshot, before, 'Produce abort changed disk'); check(api.revision === revision, 'Abort advanced revision');
        const other = await LocalBackend.open({ databaseName: db.name, legacyStorage: null });
        try {
          await command(api, '/v1/equipment/produce', { recipeId: tutorialRecipe(api.game.p.cls, 'body').id, confirm: true });
          await reject(() => command(other, '/v1/equipment/produce', { recipeId: tutorialRecipe(api.game.p.cls, 'weapon').id, confirm: true }), 'REVISION_CONFLICT');
          same(other.game.state, before, 'Losing producer spent resources'); same((await api.store.current()).snapshot, api.game.state, 'CAS overwrote winner');
        } finally { other.close(); }
      } finally { api.close(); }
    });
    await test('加工训练精炼转移及采集API实际成本结果与重放', async () => {
      const api = await open('production-actions');
      try {
        const snap = fixture(); snap.player.production.blacksmith = { level: 1, exp: 5 };
        snap.player.equipment.weapon.refine = 3; snap.player.equipment.body.refine = 1; await load(api, snap);
        let before = structuredClone(api.game.state);
        await command(api, '/v1/equipment/train', { skill: 'blacksmith' }); check(api.game.p.gold === before.player.gold - 500 && api.game.p.production.blacksmith.level === 2 && api.game.p.production.blacksmith.exp === 0, 'Training actual gate/cost');
        before = structuredClone(api.game.state); await command(api, '/v1/equipment/machine');
        check(api.game.p.items.ttMachine === before.player.items.ttMachine + 1 && api.game.p.items.ore1 === before.player.items.ore1 - 2, 'Machine materials/reward');
        before = structuredClone(api.game.state);
        await command(api, '/v1/equipment/transfer', { fromUid: api.game.p.equipment.weapon.uid, toUid: api.game.p.equipment.body.uid, confirm: true });
        check(api.game.p.equipment.weapon.refine === 0 && api.game.p.equipment.body.refine === 3 && api.game.p.items.qiankun === before.player.items.qiankun - QIANKUN_TRANSFER_COSTS[3], 'Transfer must overwrite not add');
        await command(api, '/v1/world/travel', { id: 'h_f1' }); before = structuredClone(api.game.state);
        const options = { requestId: 'gather-once' }, body = { resource: 'ore' };
        const gather = await withRandom(.1, () => command(api, '/v1/world/gather', body, options)); check(api.game.p.items.ore1 === before.player.items.ore1 + 2, 'Actual gather missing');
        const committed = structuredClone(api.game.state); const replay = await withRandom(() => { throw new Error('Gather replay rolled'); }, () => command(api, '/v1/world/gather', body, options));
        same(replay.data, gather.data, 'Gather receipt not reused'); same(api.game.state, committed, 'Gather replay duplicated material');
      } finally { api.close(); }
    });
    for (const d of DUNGEONS) {
      await test(`副本错误地点及未决奇遇拒绝不刷日次/不写盘/${d.id}`, async () => {
        const api = await open(`entrance-${d.id}`);
        try {
          const snap = fixture(); snap.player.daily.day = '2020-01-01';
          snap.player.location = Object.keys(ZONES).find(id => ZONES[id].type === 'city' && !d.entrance.includes(id)); await load(api, snap);
          await unchangedReject(api, () => command(api, '/v1/dungeons/enter', { id: d.id }), 'RULE_REJECTED');
          const pending = entrance(fixture(), d.id);
          // Use the actual entrance when it is a field. City entrances cannot
          // host a schema-valid pending encounter; exercise a real field then.
          const zone = ZONES[pending.player.location].type === 'field' ? pending.player.location : 'h_f1';
          pending.player.location = zone;
          pending.player.encounter = { id: 'merchant', zone, mob: ZONES[zone].mobs[0][0] }; await load(api, pending);
          await unchangedReject(api, () => command(api, '/v1/dungeons/enter', { id: d.id }), 'RULE_REJECTED');
          const correct = entrance(fixture(), d.id); await load(api, correct);
          await command(api, '/v1/dungeons/enter', { id: d.id }); check(api.game.p.daily.dungeons[d.id] === 1 && api.game.battle.context.id === d.id, 'Actual data entrance or daily charge missing');
          await unchangedReject(api, () => command(api, '/v1/dungeons/enter', { id: d.id }), 'RULE_REJECTED');
        } finally { api.close(); }
      });
    }
    for (const name of names) await new Promise((resolve) => { const request = indexedDB.deleteDatabase(name); request.onsuccess = request.onerror = request.onblocked = resolve; });
    return results;
  });
  for (const result of report) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}${result.error ? `\n${result.error}` : ''}`);
  console.log(`Backend: ${report.filter((r) => r.ok).length}/${report.length} groups passed`);
  assert.ok(report.every((r) => r.ok), 'Backend tests failed');
} finally { await context.close(); await browser.close(); }
