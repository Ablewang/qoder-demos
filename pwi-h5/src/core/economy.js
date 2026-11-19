import { ITEMS, SLOTS, makeEquipmentFor, makeNamedEquip, makeHighEquip } from '../data/items.js';
import { NAMED_EQUIPMENT } from '../data/named-equipment.js';
import { HIGH_EQUIPMENT } from '../data/high-equipment.js';
import { CLASSES } from '../data/classes.js';
import {
  ECONOMY_LIMITS, SHOP_CATEGORIES, SHOP_PRODUCTS, COSMETICS, CHARM_CONFIG,
  HONGYUN_POOL, ACTIVITY_POOLS, MILESTONES, ECONOMY_RULES, ECONOMY_ACTIONS,
} from '../data/economy.js';

const own = (object, key) => Object.hasOwn(object, key);
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value))
  && !Object.keys(value).some((key) => ['__proto__', 'constructor', 'prototype'].includes(key));
const today = () => new Date().toLocaleDateString('sv-SE');
const int = (value, min, max, label) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label}必须为${min}—${max}的整数。`);
  return value;
};
const productById = (id) => typeof id === 'string' ? SHOP_PRODUCTS.find((entry) => entry.id === id) : undefined;
const cosmeticById = (id) => typeof id === 'string' ? COSMETICS.find((entry) => entry.id === id) : undefined;
const valueOr = (params, key, fallback) => own(params, key) ? params[key] : fallback;

// Migration only: never reset an existing date, balance, count, array or slot.
// Malformed existing fields are rejected rather than silently repaired/refunded.
export function ensureEconomy(p) {
  if (!record(p)) throw new Error('角色结构无效。');
  const day = today();
  const defaults = {
    wallet: { yuanbao: 300, boundYuanbao: 0 },
    mall: { daily: { day, counts: {} }, orders: [] },
    events: { hongyun: { pity: 0, draws: 0 }, chestsOpened: 0, zongziOpened: 0,
      festival: { day, claimed: false }, milestones: [] },
    drawHistory: [], cosmetics: { owned: [], outfit: null, mount: null, flyer: null },
    charms: { hp: 0, mp: 0 },
  };
  const fill = (target, source) => {
    for (const [key, value] of Object.entries(source)) {
      if (!own(target, key)) target[key] = structuredClone(value);
      else if (record(value)) {
        if (!record(target[key])) throw new Error(`经济字段${key}结构无效。`);
        fill(target[key], value);
      }
    }
  };
  fill(p, defaults);
  return p;
}

function checkPlayer(p) {
  if (!record(p) || !record(p.wallet) || !record(p.mall) || !record(p.mall.daily)
    || !record(p.mall.daily.counts) || !record(p.events) || !record(p.events.hongyun)
    || !record(p.events.festival) || !record(p.cosmetics) || !record(p.charms) || !record(p.items)) {
    throw new Error('经济存档尚未初始化或结构无效，请在迁移/新建角色时调用ensureEconomy。');
  }
  for (const key of ['yuanbao', 'boundYuanbao']) int(p.wallet[key], 0, ECONOMY_LIMITS.balance, key);
  for (const key of ['gold', 'sp']) int(p[key], 0, ECONOMY_LIMITS.balance, key);
  int(p.lv, 1, 105, '角色等级');
  if (!own(CLASSES, p.cls)) throw new Error('职业无效。');
  for (const [id, amount] of Object.entries(p.items)) {
    if (!own(ITEMS, id)) throw new Error(`未知物品${id}。`);
    int(amount, 0, ECONOMY_LIMITS.itemStack, '物品数量');
  }
  for (const amount of Object.values(p.mall.daily.counts)) int(amount, 0, ECONOMY_LIMITS.balance, '日计数');
  if (typeof p.mall.daily.day !== 'string' || typeof p.events.festival.day !== 'string'
    || typeof p.events.festival.claimed !== 'boolean') throw new Error('每日经济字段无效。');
  int(p.events.hongyun.pity, 0, ECONOMY_LIMITS.pity - 1, '连续未传说计数');
  int(p.events.hongyun.draws, 0, ECONOMY_LIMITS.balance, '累计抽签');
  for (const key of ['chestsOpened', 'zongziOpened']) int(p.events[key], 0, ECONOMY_LIMITS.balance, key);
  for (const key of ['hp', 'mp']) int(p.charms[key], 0, ECONOMY_LIMITS.balance, '神符储备');
  for (const [array, max] of [[p.mall.orders, ECONOMY_LIMITS.orders], [p.drawHistory, ECONOMY_LIMITS.history],
    [p.bag, ECONOMY_LIMITS.bag], [p.events.milestones, MILESTONES.length], [p.cosmetics.owned, COSMETICS.length]]) {
    if (!Array.isArray(array) || array.length > max) throw new Error('经济记录或背包越界。');
  }
  if (new Set(p.events.milestones).size !== p.events.milestones.length
    || p.events.milestones.some((id) => !MILESTONES.some((entry) => entry.id === id))) throw new Error('里程碑记录无效。');
  if (new Set(p.cosmetics.owned).size !== p.cosmetics.owned.length
    || p.cosmetics.owned.some((id) => !cosmeticById(id))) throw new Error('外观持有记录无效。');
  for (const slot of ['outfit', 'mount', 'flyer']) {
    const id = p.cosmetics[slot];
    if (id !== null && (!p.cosmetics.owned.includes(id) || cosmeticById(id)?.slot !== slot)) throw new Error('外观栏位记录无效。');
  }
}
function refreshDaily(p) {
  const day = today();
  if (p.mall.daily.day !== day) { p.mall.daily.day = day; p.mall.daily.counts = {}; }
  if (p.events.festival.day !== day) { p.events.festival.day = day; p.events.festival.claimed = false; }
}
function knownItem(id) {
  if (typeof id !== 'string' || !own(ITEMS, id) || !record(ITEMS[id])) throw new Error(`物品${String(id)}尚不可用。`);
  int(ITEMS[id].lv, 1, 105, '物品需求等级');
  if (own(CHARM_CONFIG, id) && (ITEMS[id].type !== 'charm' || ITEMS[id].resource !== CHARM_CONFIG[id].slot
    || ITEMS[id].value !== CHARM_CONFIG[id].charge)) throw new Error(`神符${id}与实际储量配置不一致，暂不可用。`);
  return ITEMS[id];
}
function checkRewards(rewards) {
  if (!Array.isArray(rewards) || !rewards.length) throw new Error('奖励配置为空。');
  for (const reward of rewards) {
    if (!record(reward)) throw new Error('奖励配置无效。');
    int(reward.quantity, 1, ECONOMY_LIMITS.itemStack, '奖励数量');
    if (reward.type === 'item') knownItem(reward.itemId);
    else if (reward.type === 'cosmetic') {
      if (!cosmeticById(reward.cosmeticId) || reward.quantity !== 1) throw new Error('外观奖励配置无效。');
    } else if (reward.type === 'equip') {
      if (own(reward, 'templateId')) {
        if ((!own(HIGH_EQUIPMENT, reward.templateId) && (!own(NAMED_EQUIPMENT, reward.templateId)
          || NAMED_EQUIPMENT[reward.templateId].referenceOnly || !['ordinary', 'local-tutorial'].includes(NAMED_EQUIPMENT[reward.templateId].series))) || reward.quantity !== 1
          || Object.keys(reward).some((key) => !['type', 'templateId', 'quantity'].includes(key))) throw new Error('具名装备奖励配置无效。');
      } else {
        if (!own(SLOTS, reward.slot) || reward.slot === 'ring2' || reward.level !== 'player') throw new Error('装备奖励配置无效。');
        int(reward.quality, 0, 3, '装备品质');
      }
    } else if (!['gold', 'sp', 'boundYuanbao'].includes(reward.type)) throw new Error('奖励类型无效。');
  }
}
function checkPool(pool) {
  if (!Array.isArray(pool) || !pool.length || new Set(pool.map((entry) => entry.id)).size !== pool.length) throw new Error('奖池配置无效。');
  let total = 0;
  for (const entry of pool) {
    int(entry.weight, 1, 10000, '概率权重'); total += entry.weight;
    if (!['common', 'uncommon', 'rare', 'legendary'].includes(entry.rarity)) throw new Error('奖池品质无效。');
    checkRewards(entry.rewards);
  }
  if (total !== 10000) throw new Error('基础奖池概率必须合计100%。');
}
function productLevel(product) {
  if (!product || !product.enabled || !['yuanbao', 'boundYuanbao'].includes(product.currency)) throw new Error('商品不可用或不存在。');
  checkRewards(product.rewards);
  return Math.max(product.minLevel, ...product.rewards.map((reward) => reward.type === 'item'
    ? knownItem(reward.itemId).lv : reward.type === 'cosmetic' ? cosmeticById(reward.cosmeticId).minLevel : 1));
}
function capacity(p, rewards, quantity = 1) {
  const required = rewards.reduce((sum, reward) => sum + (reward.type === 'equip' ? reward.quantity * quantity : 0), 0);
  if (p.bag.length + required > ECONOMY_LIMITS.bag) throw new Error(`背包空间不足，需要预留${required}个装备格；奖励与保底均未消耗。`);
}
function poolCapacity(p, pool, count) {
  const worst = Math.max(...pool.map((entry) => entry.rewards.reduce((sum, reward) =>
    sum + (reward.type === 'equip' ? reward.quantity : 0), 0)));
  capacity(p, [{ type: 'equip', quantity: worst }], count);
}
function add(p, key, amount, max = ECONOMY_LIMITS.balance) {
  p[key] = int(p[key] + amount, 0, max, key);
}
function grant(p, rewards, multiplier = 1, allowDuplicate = true) {
  capacity(p, rewards, multiplier);
  const delivered = [];
  for (const reward of rewards) {
    const quantity = reward.quantity * multiplier;
    if (reward.type === 'item') {
      const previous = own(p.items, reward.itemId) ? p.items[reward.itemId] : 0;
      p.items[reward.itemId] = int(previous + quantity, 0, ECONOMY_LIMITS.itemStack, '物品堆叠');
      delivered.push({ ...reward, quantity, name: ITEMS[reward.itemId].name });
    } else if (reward.type === 'equip') {
      for (let i = 0; i < quantity; i++) {
        const equipment = own(NAMED_EQUIPMENT, reward.templateId) ? makeNamedEquip(reward.templateId, { origin: 'event' })
          : reward.templateId ? makeHighEquip(reward.templateId) : makeEquipmentFor(reward.slot, p.lv, reward.quality, p.cls, { origin: 'event' });
        p.bag.push(equipment);
        delivered.push({ type: 'equip', quantity: 1, equipment: structuredClone(equipment), name: equipment.name });
      }
    } else if (reward.type === 'cosmetic') {
      if (quantity !== 1) throw new Error('外观每次只能获得一件。');
      if (p.cosmetics.owned.includes(reward.cosmeticId)) {
        if (!allowDuplicate) throw new Error('已经拥有该外观，不能重复购买。');
        add(p.wallet, 'boundYuanbao', 120);
        delivered.push({ type: 'boundYuanbao', quantity: 120, duplicateOf: reward.cosmeticId, name: '重复外观补偿' });
      } else {
        p.cosmetics.owned.push(reward.cosmeticId);
        delivered.push({ ...reward, name: cosmeticById(reward.cosmeticId).name });
      }
    } else if (reward.type === 'boundYuanbao' || reward.type === 'yuanbao') {
      add(p.wallet, reward.type, quantity); delivered.push({ ...reward, quantity });
    } else {
      add(p, reward.type, quantity); delivered.push({ ...reward, quantity });
    }
  }
  return delivered;
}
function hasItems(p, id, quantity) {
  if ((own(p.items, id) ? p.items[id] : 0) < quantity) throw new Error(`${knownItem(id).name}不足，需要${quantity}个。`);
}
function useDaily(p, key, quantity, limit) {
  const previous = own(p.mall.daily.counts, key) ? p.mall.daily.counts[key] : 0;
  if (previous + quantity > limit) throw new Error('今日次数/兑换额度已达上限。');
  p.mall.daily.counts[key] = previous + quantity;
}
function roll(pool) {
  const random = Math.random();
  if (!Number.isFinite(random) || random < 0 || random >= 1) throw new Error('随机数源无效。');
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let accumulated = 0;
  for (const entry of pool) {
    accumulated += entry.weight;
    if (random < accumulated / total) return entry;
  }
  throw new Error('奖池配置无法命中。');
}
function appendHistory(p, result) {
  p.drawHistory.push(structuredClone(result));
  p.drawHistory = p.drawHistory.slice(-ECONOMY_LIMITS.history);
}
function draw(p, source, poolId, pool, count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    const isHongyun = source === 'hongyun';
    const pityBefore = isHongyun ? p.events.hongyun.pity : null;
    const guaranteed = isHongyun && pityBefore === ECONOMY_LIMITS.pity - 1;
    const entry = roll(guaranteed ? pool.filter((prize) => prize.rarity === 'legendary') : pool);
    const rewards = grant(p, entry.rewards);
    let sequence;
    if (isHongyun) {
      p.events.hongyun.pity = entry.rarity === 'legendary' ? 0 : pityBefore + 1;
      add(p.events.hongyun, 'draws', 1); sequence = p.events.hongyun.draws;
    } else {
      const counter = ACTIVITY_POOLS[poolId].counter;
      add(p.events, counter, 1); sequence = p.events[counter];
    }
    const time = new Date().toISOString();
    const result = { id: `${poolId}-${sequence}`, source, poolId, sequence, time,
      prizeId: entry.id, name: rewards.length === 1 && rewards[0].type === 'equip' ? rewards[0].name : entry.name, rarity: entry.rarity, guaranteed,
      pityBefore, pityAfter: isHongyun ? p.events.hongyun.pity : null, rewards };
    appendHistory(p, result); results.push(result);
  }
  return results;
}
function progress(p, entry) { return entry.counter === 'draws' ? p.events.hongyun.draws : p.events[entry.counter]; }

// No persistence, game.save(), payment or network effects. The main API should
// serialize operations on a cloned Game and commit to IndexedDB once. This extra
// player staging also makes direct rejected calls completely side-effect free.
export function economyAction(game, action, params = {}) {
  if (!game?.p) throw new Error('请先创建角色。');
  if (game.busy || (game.battle && !game.battle.result) || (game.state?.battle && !game.state.battle.result)) throw new Error('战斗中无法进行经济操作。');
  if (typeof action !== 'string' || !own(ECONOMY_ACTIONS, action)) throw new Error('未知经济操作。');
  if (!record(params) || Object.keys(params).some((key) => !ECONOMY_ACTIONS[action].params.includes(key))) throw new Error('参数结构或字段无效。');
  const p = structuredClone(game.p);
  checkPlayer(p);
  refreshDaily(p);
  let result;
  if (action === 'shop.buy') {
    const quantity = int(valueOr(params, 'quantity', 1), 1, ECONOMY_LIMITS.purchaseQuantity, '购买份数');
    const product = productById(params.productId);
    const level = productLevel(product);
    if (p.lv < level) throw new Error(`购买需要${level}级。`);
    if (product.rewards.some((reward) => reward.type === 'cosmetic' && (quantity !== 1 || p.cosmetics.owned.includes(reward.cosmeticId)))) throw new Error('外观只能购买一份，且不能重复购买。');
    const cost = product.price * quantity;
    int(cost, 1, ECONOMY_LIMITS.balance, '订单成本');
    if (p.wallet[product.currency] < cost) throw new Error(`${product.currency === 'yuanbao' ? '元宝' : '绑定元宝'}不足。`);
    capacity(p, product.rewards, quantity);
    useDaily(p, `shop:${product.id}`, quantity, product.dailyLimit);
    const rewards = grant(p, product.rewards, quantity, false);
    p.wallet[product.currency] -= cost;
    const time = new Date().toISOString();
    const prefix = `local-${Date.now()}-${product.id}`;
    let serial = 1;
    while (p.mall.orders.some((order) => order.id === `${prefix}-${serial}`)) serial++;
    const order = { id: `${prefix}-${serial}`, time, productId: product.id, name: product.name,
      quantity, unitPrice: product.price, currency: product.currency, cost, rewards };
    p.mall.orders.push(order); p.mall.orders = p.mall.orders.slice(-ECONOMY_LIMITS.orders);
    result = { order, rewards, message: `购买${product.name}×${quantity}份，实扣${cost}${product.currency === 'yuanbao' ? '元宝' : '绑定元宝'}，奖励已到账。` };
  } else if (action === 'wallet.exchange') {
    const quantity = int(valueOr(params, 'quantity', 1), 1, ECONOMY_LIMITS.exchangeQuantity, '兑换份数');
    const rule = ECONOMY_RULES.exchange;
    if (p.lv < rule.minLevel) throw new Error(`兑换需要${rule.minLevel}级。`);
    const cost = quantity * rule.goldPerUnit;
    if (p.gold < cost) throw new Error('金币不足。');
    useDaily(p, rule.counter, quantity, rule.dailyLimit);
    add(p.wallet, 'yuanbao', quantity * rule.yuanbaoPerUnit); p.gold -= cost;
    result = { quantity, cost, currency: 'gold', rewards: [{ type: 'yuanbao', quantity: quantity * rule.yuanbaoPerUnit }], message: `金币换得${quantity * rule.yuanbaoPerUnit}本地元宝。` };
  } else if (action === 'wallet.daily') {
    // yuanbao is permitted only for this declared, non-random daily entitlement.
    checkRewards(ECONOMY_RULES.daily.rewards.filter((reward) => reward.type !== 'yuanbao'));
    useDaily(p, ECONOMY_RULES.daily.counter, 1, 1);
    const rewards = grant(p, ECONOMY_RULES.daily.rewards);
    result = { rewards, message: '每日虚拟元宝与体验物品已领取。' };
  } else if (action === 'treasure.draw') {
    const count = int(valueOr(params, 'count', 1), 1, 10, '抽签次数');
    if (count !== 1 && count !== 10) throw new Error('秘宝只支持1抽或10抽。');
    checkPool(HONGYUN_POOL); knownItem('treasureKey');
    hasItems(p, 'treasureKey', count); poolCapacity(p, HONGYUN_POOL, count);
    p.items.treasureKey -= count;
    const results = draw(p, 'hongyun', 'hongyun', HONGYUN_POOL, count);
    result = { count, keyCost: count, results, pity: p.events.hongyun.pity, draws: p.events.hongyun.draws, message: `鸿运秘宝${count}抽完成，逐次奖励已到账。` };
  } else if (action === 'activity.open') {
    const count = int(valueOr(params, 'count', 1), 1, ECONOMY_LIMITS.openCount, '开启次数');
    if (typeof params.itemId !== 'string' || !own(ACTIVITY_POOLS, params.itemId)) throw new Error('不是可开启的宝箱或粽子。');
    const definition = ACTIVITY_POOLS[params.itemId];
    const itemDefinition = knownItem(params.itemId);
    if (p.lv < Math.max(definition.minLevel, itemDefinition.lv)) throw new Error('等级不足，无法开启。');
    checkPool(definition.pool); hasItems(p, params.itemId, count);
    const keyCost = definition.keyCost * count;
    if (keyCost) { knownItem('treasureKey'); hasItems(p, 'treasureKey', keyCost); }
    poolCapacity(p, definition.pool, count);
    p.items[params.itemId] -= count;
    if (keyCost) p.items.treasureKey -= keyCost;
    const results = draw(p, definition.counter === 'chestsOpened' ? 'chest' : 'zongzi', params.itemId, definition.pool, count);
    result = { itemId: params.itemId, count, keyCost, results, message: `${definition.name}×${count}已开启，逐次奖励已到账。` };
  } else if (action === 'activity.claim') {
    if (params.milestoneId === ECONOMY_RULES.festivalDaily.id) {
      if (p.events.festival.claimed) throw new Error('今日常驻粽礼已领取。');
      checkRewards(ECONOMY_RULES.festivalDaily.rewards);
      const rewards = grant(p, ECONOMY_RULES.festivalDaily.rewards);
      p.events.festival.claimed = true;
      result = { milestoneId: params.milestoneId, rewards, message: '常驻粽礼每日体验已到账（非官方正在举行的节日）。' };
    } else {
      const entry = typeof params.milestoneId === 'string' ? MILESTONES.find((milestone) => milestone.id === params.milestoneId) : undefined;
      if (!entry) throw new Error('未知里程碑。');
      if (p.events.milestones.includes(entry.id)) throw new Error('里程碑已领取，不能重复领取。');
      if (progress(p, entry) < entry.target) throw new Error('里程碑进度不足。');
      checkRewards(entry.rewards);
      const rewards = grant(p, entry.rewards); p.events.milestones.push(entry.id);
      result = { milestoneId: entry.id, rewards, message: `${entry.name}奖励已到账。` };
    }
  } else if (action === 'cosmetic.equip') {
    if (!['outfit', 'mount', 'flyer'].includes(params.slot)) throw new Error('未知外观栏位。');
    if (params.cosmeticId === null) {
      p.cosmetics[params.slot] = null;
      result = { cosmeticId: null, slot: params.slot, message: '已卸下文字外观；卸下飞行外观不撤销已有飞行资格。' };
    } else {
      const definition = cosmeticById(params.cosmeticId);
      if (!definition || !p.cosmetics.owned.includes(definition.id)) throw new Error('未拥有该外观。');
      if (definition.slot !== params.slot) throw new Error('外观栏位不匹配。');
      if (p.lv < definition.minLevel) throw new Error(`佩戴需要${definition.minLevel}级。`);
      p.cosmetics[params.slot] = definition.id;
      if (params.slot === 'flyer') p.flight = true;
      result = { cosmeticId: definition.id, slot: params.slot, message: `佩戴${definition.name}文字外观。` };
    }
  } else if (action === 'charm.equip') {
    const count = int(valueOr(params, 'count', 1), 1, 99, '神符数量');
    if (typeof params.itemId !== 'string' || !own(CHARM_CONFIG, params.itemId)) throw new Error('不是可装填的生命/真气神符。');
    const definition = CHARM_CONFIG[params.itemId];
    const itemDefinition = knownItem(params.itemId);
    if (p.lv < Math.max(definition.minLevel, itemDefinition.lv)) throw new Error('装填神符等级不足。');
    hasItems(p, params.itemId, count);
    const charge = count * definition.charge;
    add(p.charms, definition.slot, charge); p.items[params.itemId] -= count;
    result = { itemId: params.itemId, count, slot: definition.slot, charge, reserve: p.charms[definition.slot], message: `消耗${itemDefinition.name}×${count}，装填${charge}储备（不直接治疗、不实际充值）。` };
  }
  checkPlayer(p);
  Object.assign(game.p, p);
  return structuredClone({ action, ...result });
}

// Pure detached views; reads neither refresh persisted dates nor grant anything.
export function queryEconomy(game, section = 'all') {
  if (!['all', 'shop', 'wallet', 'treasure', 'activity', 'cosmetics', 'charms', 'history'].includes(section)) throw new Error('未知经济查询分区。');
  if (!game?.p) throw new Error('请先创建角色。');
  const p = structuredClone(game.p); checkPlayer(p); refreshDaily(p);
  const busy = !!(game.busy || (game.battle && !game.battle.result) || (game.state?.battle && !game.state.battle.result));
  const views = {
    wallet: { ...p.wallet, gold: p.gold, dailyClaimed: (p.mall.daily.counts[ECONOMY_RULES.daily.counter] || 0) > 0,
      exchangeUsed: p.mall.daily.counts[ECONOMY_RULES.exchange.counter] || 0, daily: ECONOMY_RULES.daily, exchange: ECONOMY_RULES.exchange },
    shop: { categories: SHOP_CATEGORIES, orders: p.mall.orders, day: p.mall.daily.day,
      products: SHOP_PRODUCTS.map((product) => {
        let effectiveMinLevel = product.minLevel; let unavailable = '';
        try { effectiveMinLevel = productLevel(product); } catch (error) { unavailable = error.message; }
        const boughtToday = p.mall.daily.counts[`shop:${product.id}`] || 0;
        const owned = product.rewards.some((reward) => reward.type === 'cosmetic' && p.cosmetics.owned.includes(reward.cosmeticId));
        const remaining = Math.max(0, product.dailyLimit - boughtToday);
        return { ...product, effectiveMinLevel, boughtToday, remaining, owned,
          available: !unavailable && !busy && !owned && p.lv >= effectiveMinLevel && remaining > 0 && p.wallet[product.currency] >= product.price,
          unavailableReason: unavailable || (busy ? '战斗中' : owned ? '已拥有外观' : p.lv < effectiveMinLevel ? '等级不足' : !remaining ? '已达日限' : p.wallet[product.currency] < product.price ? '货币不足' : '') };
      }) },
    treasure: { ...p.events.hongyun, keys: p.items.treasureKey || 0, pool: HONGYUN_POOL, pityLimit: ECONOMY_LIMITS.pity, counts: [1, 10] },
    activity: { pools: ACTIVITY_POOLS, chestsOpened: p.events.chestsOpened, zongziOpened: p.events.zongziOpened,
      festival: { ...p.events.festival, ...ECONOMY_RULES.festivalDaily },
      milestones: MILESTONES.map((entry) => ({ ...entry, progress: progress(p, entry), claimed: p.events.milestones.includes(entry.id),
        ready: !busy && !p.events.milestones.includes(entry.id) && progress(p, entry) >= entry.target })) },
    cosmetics: { ...p.cosmetics, catalogue: COSMETICS, flight: p.flight },
    charms: { ...p.charms, config: CHARM_CONFIG, items: { charmHp: p.items.charmHp || 0, charmMp: p.items.charmMp || 0 } },
    history: p.drawHistory,
  };
  return structuredClone(section === 'all' ? { ...views, rules: ECONOMY_RULES, actions: ECONOMY_ACTIONS, busy, day: p.mall.daily.day } : views[section]);
}

// Integration/test preflight: fails on genuinely absent dependencies, no stubs.
export function validateEconomyData() {
  if (SHOP_PRODUCTS.length !== new Set(SHOP_PRODUCTS.map((entry) => entry.id)).size) throw new Error('重复商品ID。');
  for (const product of SHOP_PRODUCTS) {
    int(product.price, 1, ECONOMY_LIMITS.balance, '商品价格');
    int(product.quantity, 1, ECONOMY_LIMITS.itemStack, '每份数量');
    int(product.dailyLimit, 1, 99, '商品日限');
    int(product.minLevel, 1, 105, '商品等级');
    if (!SHOP_CATEGORIES.some((category) => category.id === product.category)) throw new Error('未知商品分类。');
    productLevel(product);
  }
  checkPool(HONGYUN_POOL);
  for (const [id, definition] of Object.entries(ACTIVITY_POOLS)) {
    knownItem(id); checkPool(definition.pool); int(definition.keyCost, 0, 2, '开箱钥匙');
  }
  for (const entry of MILESTONES) checkRewards(entry.rewards);
  checkRewards(ECONOMY_RULES.daily.rewards.filter((reward) => reward.type !== 'yuanbao'));
  checkRewards(ECONOMY_RULES.festivalDaily.rewards);
  return { products: SHOP_PRODUCTS.length, pools: 1 + Object.keys(ACTIVITY_POOLS).length,
    milestones: MILESTONES.length, cosmetics: COSMETICS.length, probabilityTotal: 10000 };
}
