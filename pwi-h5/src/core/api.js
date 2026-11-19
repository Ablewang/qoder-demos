import { Game, validateSave } from './game.js';
import { IndexedStore } from './storage.js';
import { stats, SAVE_KEY } from './model.js';
import { CLASSES, SKILLS } from '../data/classes.js';
import { ZONES, DUNGEONS, CULTIVATION } from '../data/world.js';
import { ATLAS_NODES, ATLAS_SOURCES, ATLAS_ADAPTATION } from '../data/atlas.js';
import { ITEMS, SLOTS, QUALITY } from '../data/items.js';
import { HIGH_EQUIPMENT, HIGH_RECIPES, HIGH_ADAPTATION } from '../data/high-equipment.js';
import { OFFICIAL_EQUIPMENT, OFFICIAL_EQUIPMENT_TYPES, OFFICIAL_EQUIPMENT_NOTE } from '../data/official-equipment.js';
import { equipmentAction } from './equipment.js';
import { GEAR_RULES } from '../data/gear-specs.js';
import { PRODUCTION_MATERIALS, PRODUCTION_SKILLS, PRODUCTION_LEVELS, ORDINARY_RECIPE_LEVELS, PRODUCTION_ADAPTATION, QIANKUN_TRANSFER_COSTS } from '../data/production.js';
import { productionAction, getProductionCatalog } from './production.js';
import { economyAction, queryEconomy } from './economy.js';
import { NAMED_EQUIPMENT, NAMED_EQUIPMENT_NOTE, equipmentForShop } from '../data/named-equipment.js';
import { ITEM_COLOR_PALETTE, VERIFIED_ITEM_COLORS, ITEM_COLOR_NOTE } from '../data/item-colors.js';
import officialGear from '../data/official-gear.json' with { type: 'json' };

export class ApiError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = 'ApiError'; this.code = code; this.status = status; }
  toJSON() { return { ok: false, error: { code: this.code, message: this.message, status: this.status } }; }
}
function battleAction(game, action, targetId) {
  const round = game.battle?.round;
  const result = game.turn(action, targetId);
  if (game.battle.round === round && !result) throw new ApiError('INVALID_ACTION', game.battle.logs.at(-1)?.text || '战斗行动无效。');
  return result;
}
const route = (fields, run) => ({ fields, run });
const routes = {
  '/v1/character': route({ name: 'string', cls: 'string', confirm: 'boolean?' }, (g, b) => {
    if (g.p && b.confirm !== true) throw new ApiError('CONFIRM_REQUIRED', '替换角色需要明确确认。');
    g.start(b.name, b.cls);
  }),
  '/v1/character/attributes': route({ key: 'string', quantity: 'integer' }, (g, b) => g.allocate(b.key, b.quantity)),
  '/v1/character/attributes/recommended': route({}, (g) => g.autoAllocate()),
  '/v1/world/travel': route({ id: 'string', teleport: 'boolean?' }, (g, b) => g.travel(b.id, b.teleport ?? false)),
  '/v1/world/rest': route({}, (g) => g.rest()),
  '/v1/world/explore': route({}, (g) => g.explore()),
  '/v1/world/gather': route({ resource: 'string' }, (g, b) => g.gather(b.resource)),
  '/v1/equipment/produce': route({ recipeId: 'string', uid: 'string?', inherit: 'boolean?', confirm: 'boolean' }, (g, b) => productionAction(g, 'produce', b)),
  '/v1/equipment/train': route({ skill: 'string' }, (g, b) => productionAction(g, 'train', b)),
  '/v1/equipment/machine': route({}, (g) => productionAction(g, 'manufactureMachine')),
  '/v1/world/encounter': route({ choice: 'string' }, (g, b) => g.chooseEncounter(b.choice)),
  '/v1/items/use': route({ id: 'string' }, (g, b) => g.busy && !g.battle.rt ? battleAction(g, `item:${b.id}`) : g.useItem(b.id)),
  '/v1/shop/potions/buy': route({ id: 'string', quantity: 'integer' }, (g, b) => g.buy(b.id, b.quantity)),
  '/v1/shop/equipment/buy': route({ templateId: 'string' }, (g, b) => g.buyEquip(b.templateId)),
  '/v1/equipment/equip': route({ uid: 'string', slot: 'string?' }, (g, b) => g.equip(b.uid, b.slot)),
  '/v1/equipment/unequip': route({ slot: 'string' }, (g, b) => g.unequip(b.slot)),
  '/v1/equipment/sell': route({ uid: 'string' }, (g, b) => g.sell(b.uid)),
  '/v1/equipment/sell-common': route({ confirm: 'boolean' }, (g, b) => {
    if (!b.confirm) throw new ApiError('CONFIRM_REQUIRED', '批量出售需要确认。');
    g.sellCommon();
  }),
  '/v1/equipment/refine': route({ slot: 'string', aid: 'string?' }, (g, b) => g.refine(b.slot, b.aid)),
  '/v1/equipment/forge': route({ slot: 'string', quality: 'integer' }, (g, b) => g.forge(b.slot, b.quality)),
  '/v1/skills/learn': route({ id: 'string' }, (g, b) => g.learn(b.id)),
  '/v1/quests/claim': route({ bounty: 'boolean?' }, (g, b) => g.claimQuest(b.bounty ?? false)),
  '/v1/quests/bounty': route({}, (g) => g.acceptBounty()),
  '/v1/daily/sign': route({}, (g) => g.signIn()),
  '/v1/daily/cards': route({}, (g) => g.redeemCards()),
  '/v1/battle/hunt': route({ index: 'integer' }, (g, b) => g.hunt(b.index)),
  '/v1/battle/realtime': route({ layout: 'object?' }, (g, b) => g.enableRealtime(b.layout)),
  '/v1/battle/tick': route({ steps: 'integer', direction: 'string?', targetId: 'string?' }, (g, b) => g.advanceRealtime(b)),
  '/v1/battle/action': route({ action: 'string', targetId: 'string?' }, (g, b) => g.realtimeAction(b.action, b.targetId)),
  '/v1/battle/turn': route({ action: 'string', targetId: 'string?' }, (g, b) => battleAction(g, b.action, b.targetId)),
  '/v1/battle/auto': route({}, (g) => {
    if (!g.busy) throw new Error('当前没有进行中的战斗。');
    const round = g.battle.round; const result = g.autoTurn();
    if (g.battle.round === round && !result) throw new Error(g.battle.logs.at(-1)?.text || '自动行动无效。');
    return result;
  }),
  '/v1/battle/leave': route({}, (g) => {
    if (!g.battle || g.busy) throw new Error('请先撤退或结束战斗。');
    g.state.battle = null; g.event('已返回游历。');
  }),
  '/v1/dungeons/enter': route({ id: 'string' }, (g, b) => g.enterDungeon(b.id)),
  '/v1/dungeons/next': route({}, (g) => g.nextWave()),
  '/v1/cultivation/trial': route({}, (g) => g.enterTrial()),
  '/v1/cultivation/breakthrough': route({ path: 'string?' }, (g, b) => g.breakthrough(b.path)),
  '/v1/arena/enter': route({}, (g) => g.arena()),
  '/v1/save/import': route({ snapshot: 'object', confirm: 'boolean' }, (g, b) => {
    if (!b.confirm) throw new ApiError('CONFIRM_REQUIRED', '导入替换需要确认。');
    g.state = validateSave(b.snapshot); g.event('存档已导入。');
  }),
  '/v1/save': route({}, (g) => g.event('已保存到IndexedDB。')),
};
for (const [action, fields] of Object.entries({
  repair: { uid: 'string' }, socket: { uid: 'string', gemId: 'string', index: 'integer?' },
  unsocket: { uid: 'string', index: 'integer' }, reroll: { uid: 'string' },
  upgrade: { uid: 'string' }, decompose: { uid: 'string', confirm: 'boolean' }, bind: { uid: 'string', confirm: 'boolean' },
  craft: { templateId: 'string', confirm: 'boolean' }, ascend: { uid: 'string', confirm: 'boolean' },
  punch: { uid: 'string' }, transfer: { fromUid: 'string', toUid: 'string', confirm: 'boolean' },
})) routes[`/v1/equipment/${action}`] = route(fields, (g, b) => equipmentAction(g, action, b));
for (const [path, action, fields] of [
  ['/v1/mall/buy', 'shop.buy', { productId: 'string', quantity: 'integer' }],
  ['/v1/wallet/exchange', 'wallet.exchange', { quantity: 'integer' }],
  ['/v1/wallet/daily', 'wallet.daily', {}],
  ['/v1/treasure/draw', 'treasure.draw', { count: 'integer' }],
  ['/v1/activities/open', 'activity.open', { itemId: 'string', count: 'integer' }],
  ['/v1/activities/claim', 'activity.claim', { milestoneId: 'string' }],
  ['/v1/cosmetics/equip', 'cosmetic.equip', { cosmeticId: 'nullableString', slot: 'string' }],
  ['/v1/charms/equip', 'charm.equip', { itemId: 'string', count: 'integer' }],
]) routes[path] = route(fields, (g, b) => { const result = economyAction(g, action, b); g.event(result.message); return result; });

const queries = ['/v1/bootstrap', '/v1/state', '/v1/character', '/v1/world', '/v1/inventory', '/v1/equipment/catalog', '/v1/equipment/production', '/v1/skills', '/v1/quests', '/v1/cultivation', '/v1/dungeons', '/v1/shop', '/v1/mall', '/v1/activities', '/v1/history', '/v1/save/export', '/v1/save/backup', '/v1/api'];
export const API_ROUTES = [...queries.map((path) => ({ method: 'GET', path })), ...Object.entries(routes).map(([path, r]) => ({ method: 'POST', path, fields: r.fields }))];
function validateBody(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || ![Object.prototype, null].includes(Object.getPrototypeOf(body))) throw new ApiError('INVALID_BODY', '请求参数必须是普通对象。');
  for (const key of Object.keys(body)) if (!Object.hasOwn(fields, key)) throw new ApiError('INVALID_FIELD', `未知参数：${key}`);
  for (const [key, type] of Object.entries(fields)) {
    const value = body[key];
    if (value === undefined && type.endsWith('?')) continue;
    const base = type.replace('?', '');
    const valid = base === 'nullableString' ? value === null || (typeof value === 'string' && value.length <= 1000)
      : base === 'integer' ? Number.isSafeInteger(value) && value >= 0 && value <= 1e7
      : base === 'object' ? value && typeof value === 'object' && !Array.isArray(value)
        : typeof value === base && (base !== 'string' || value.length <= 1000);
    if (!valid) throw new ApiError('INVALID_FIELD', `参数${key}类型或范围无效。`);
  }
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  return value;
}
const signatureOf = (path, body) => JSON.stringify([path, canonical(body)]);
const errorOf = (e) => e instanceof ApiError ? e : new ApiError(e.code || 'RULE_REJECTED', e.message || '操作失败。', e.code?.startsWith('STORAGE') ? 503 : e.code === 'REVISION_CONFLICT' ? 409 : 400);

export class LocalBackend {
  constructor(store) {
    this.store = store; this._game = new Game(); this.revision = 0; this.queue = Promise.resolve();
    this.loadError = ''; this.rawBackup = null;
  }
  get game() {
    const view = new Game(structuredClone(this._game.state)); view.message = this._game.message;
    return view;
  }
  static async open({ databaseName, legacyStorage } = {}) {
    const api = new LocalBackend(await IndexedStore.open(databaseName));
    const record = await api.store.current();
    if (record) {
      api.revision = record.revision;
      try { api.adopt(record); } catch (e) { api.loadError = `存档校验失败，原始数据已保留：${e.message}`; api.rawBackup = record.snapshot; }
      return api;
    }
    let raw;
    try { raw = (legacyStorage === undefined ? globalThis.localStorage : legacyStorage)?.getItem(SAVE_KEY); } catch { api.loadError = '旧存档读取受限，可导入备份或创建角色。'; }
    if (raw) {
      api.rawBackup = raw;
      try {
        const snapshot = validateSave(JSON.parse(raw));
        const result = await api.store.commit(snapshot, 0, { id: 'legacy-migration-v2', path: '/migration', signature: signatureOf('/migration', snapshot), data: { message: '旧存档已迁移。' } }, { source: SAVE_KEY, original: raw, migratedAt: new Date().toISOString() });
        api.adopt(result.record);
      } catch (e) {
        if (e.code === 'REVISION_CONFLICT') api.adopt(await api.store.current());
        else api.loadError = `旧存档无法迁移，原始数据未删除：${e.message}`;
      }
    }
    return api;
  }
  adopt(record) {
    if (!record || record.schemaVersion !== 2 || !Number.isSafeInteger(record.revision) || record.revision < 1) throw new ApiError('INVALID_RECORD', '本地存档元数据无效。');
    const snapshot = validateSave(record.snapshot);
    this.revision = record.revision; this._game = new Game(snapshot); this.loadError = '';
  }
  response(data, requestId = null, duplicate = false) { return { ok: true, data: structuredClone(data), meta: { version: 2, requestId, revision: this.revision, duplicate } }; }
  request(method, path, body = {}, options = {}) {
    try { body = structuredClone(body); options = structuredClone(options); }
    catch { return Promise.reject(new ApiError('INVALID_BODY', '请求包含无法保存的数据类型。')); }
    const run = async () => {
      try {
        validateBody(options, { requestId: 'string?', expectedRevision: 'integer?' });
        if (method === 'GET') return await this.query(path, body);
        if (method !== 'POST' || !routes[path]) throw new ApiError('NOT_FOUND', '接口不存在。', 404);
        const r = routes[path]; validateBody(body, r.fields);
        const requestId = options.requestId ?? crypto.randomUUID();
        if (typeof requestId !== 'string' || !/^[a-z0-9_-]{1,100}$/i.test(requestId)) throw new ApiError('INVALID_REQUEST_ID', '请求编号无效。');
        const signature = signatureOf(path, body);
        const receipt = await this.store.receipt(requestId);
        if (receipt) {
          if (receipt.signature !== signature) throw new ApiError('REQUEST_ID_REUSED', '同一请求编号不能用于不同参数。', 409);
          this.adopt(await this.store.current());
          return this.response(receipt.data, requestId, true);
        }
        const expected = options.expectedRevision ?? this.revision;
        if (!Number.isSafeInteger(expected) || expected !== this.revision) throw new ApiError('REVISION_CONFLICT', '存档版本不一致，请刷新后重试。', 409);
        const candidate = new Game(structuredClone(this._game.state));
        if (!candidate.p && !['/v1/character', '/v1/save/import'].includes(path)) throw new ApiError('NO_CHARACTER', '请先创建角色。');
        if (candidate.busy && ['/v1/character', '/v1/save/import'].includes(path)) throw new Error('请先结束战斗。');
        if (candidate.p) candidate.refreshDay();
        const result = r.run(candidate, body);
        const snapshot = validateSave(candidate.state);
        const data = { result: result ?? null, message: candidate.message };
        const committed = await this.store.commit(snapshot, expected, { id: requestId, path, signature, data });
        this.adopt(committed.record); this._game.message = committed.receipt.data.message;
        return this.response(committed.receipt.data, requestId, committed.duplicate);
      } catch (error) { throw errorOf(error); }
    };
    const pending = this.queue.then(run);
    this.queue = pending.catch(() => {});
    return pending;
  }
  async query(path, body) {
    if (!queries.includes(path)) throw new ApiError('NOT_FOUND', '接口不存在。', 404);
    validateBody(body, path === '/v1/history' ? { limit: 'integer?', beforeRevision: 'integer?' } : {});
    const g = this._game; const p = g.p;
    if (path === '/v1/api') return this.response(API_ROUTES);
    if (path === '/v1/equipment/catalog') return this.response({ templates: HIGH_EQUIPMENT, recipes: HIGH_RECIPES, adaptation: HIGH_ADAPTATION,
      named: { templates: NAMED_EQUIPMENT, note: NAMED_EQUIPMENT_NOTE },
      colors: { palette: ITEM_COLOR_PALETTE, evidence: VERIFIED_ITEM_COLORS, note: ITEM_COLOR_NOTE },
      official: { records: OFFICIAL_EQUIPMENT, types: OFFICIAL_EQUIPMENT_TYPES, note: OFFICIAL_EQUIPMENT_NOTE,
        sourceRecords: officialGear.records, gaps: officialGear.gaps },
      legacyGearRules: GEAR_RULES, production: { materials: PRODUCTION_MATERIALS, skills: PRODUCTION_SKILLS,
        levels: PRODUCTION_LEVELS, ordinaryRecipeLevels: ORDINARY_RECIPE_LEVELS,
        adaptation: PRODUCTION_ADAPTATION, transferCosts: QIANKUN_TRANSFER_COSTS } });
    if (path === '/v1/bootstrap' || path === '/v1/state') return this.response({ snapshot: g.state, loadError: this.loadError, storage: { engine: 'IndexedDB', schemaVersion: 2 } });
    if (path === '/v1/save/backup') {
      const legacy = await this.store.migration();
      return this.response(this.rawBackup ?? legacy?.value.original ?? g.state);
    }
    if (path === '/v1/history') {
      const limit = body.limit ?? 100;
      if (limit < 1 || limit > 100) throw new ApiError('INVALID_FIELD', '记录分页大小为1—100。');
      const rows = await this.store.history(limit, body.beforeRevision ?? null);
      return this.response({ rows, nextBeforeRevision: rows.length === limit ? rows.at(-1).revision : null });
    }
    if (!p) throw new ApiError('NO_CHARACTER', '请先创建角色。');
    if (path === '/v1/equipment/production') return this.response(getProductionCatalog(p));
    if (path === '/v1/save/export') return this.response(g.state);
    if (path === '/v1/character') return this.response({ player: p, stats: stats(p, g.busy ? g.battle : null), class: CLASSES[p.cls] });
    if (path === '/v1/world') return this.response({ zones: ZONES, location: p.location, discovered: p.discovered, battle: g.battle,
      atlas: ATLAS_NODES, atlasSources: ATLAS_SOURCES, atlasAdaptation: ATLAS_ADAPTATION });
    if (path === '/v1/inventory') return this.response({ bag: p.bag, equipment: p.equipment, items: p.items, catalog: { ...ITEMS, ...PRODUCTION_MATERIALS }, slots: SLOTS, qualities: QUALITY, templates: HIGH_EQUIPMENT, recipes: HIGH_RECIPES, adaptation: HIGH_ADAPTATION,
      named: { templates: NAMED_EQUIPMENT, note: NAMED_EQUIPMENT_NOTE },
      colors: { palette: ITEM_COLOR_PALETTE, evidence: VERIFIED_ITEM_COLORS, note: ITEM_COLOR_NOTE } });
    if (path === '/v1/skills') return this.response({ catalog: SKILLS[p.cls], learned: p.skills });
    if (path === '/v1/quests') return this.response({ main: g.mainQuest, mainProgress: g.questProgress(g.mainQuest), bounty: p.bounty, bountyProgress: g.questProgress(p.bounty, true) });
    if (path === '/v1/cultivation') return this.response({ catalog: CULTIVATION, rank: p.cult, path: p.path, trialReady: p.trialReady });
    if (path === '/v1/dungeons') return this.response({ catalog: DUNGEONS, daily: p.daily.dungeons, clears: p.clears });
    if (path === '/v1/shop') return this.response({ catalog: ITEMS, gold: p.gold, equipment: equipmentForShop(p),
      note: NAMED_EQUIPMENT_NOTE, colors: { palette: ITEM_COLOR_PALETTE, evidence: VERIFIED_ITEM_COLORS, note: ITEM_COLOR_NOTE } });
    return this.response(queryEconomy(new Game(structuredClone(g.state)), 'all'));
  }
  close() { this.store.close(); }
}
