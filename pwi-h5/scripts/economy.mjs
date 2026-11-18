import assert from 'node:assert/strict';
import { ITEMS, makeEquip } from '../src/data/items.js';
import { CLASSES } from '../src/data/classes.js';
import { matchesGearSpec, allowedWeaponClasses } from '../src/data/gear-specs.js';
import { validateEquipment } from '../src/core/equipment.js';
import { HIGH_EQUIPMENT, matchesHighEquip } from '../src/data/high-equipment.js';
import { createPlayer, stats } from '../src/core/model.js';
import { createBattle, takeTurn } from '../src/core/combat.js';
import { ensureEconomy, economyAction, queryEconomy, validateEconomyData } from '../src/core/economy.js';
import {
  SHOP_PRODUCTS, SHOP_CATEGORIES, COSMETICS, CHARM_CONFIG, HONGYUN_POOL,
  ACTIVITY_POOLS, MILESTONES, ECONOMY_RULES, ECONOMY_ACTIONS, ECONOMY_LIMITS,
} from '../src/data/economy.js';

// Real module imports and initialized mechanics fixtures, not organically earned
// level/currency/items, a natural playthrough, or proof of IndexedDB/API/UI behavior.
// No dependency stubs, application patches, files, storage, payment or network.
const originalRandom = Math.random;
const OriginalDate = Date;
let tests = 0;
let passed = 0;
const failures = [];
function fixture(cls = 'blademaster', level = 105) {
  const p = createPlayer('经济配置测试', cls);
  ensureEconomy(p);
  p.lv = level;
  p.attrs = Object.fromEntries(Object.entries(CLASSES[cls].base).map(([key, amount]) =>
    [key, amount + CLASSES[cls].auto[key] * (level - 1)]));
  p.gold = 5_000_000; p.sp = 1_000_000;
  p.wallet = { yuanbao: 1_000_000, boundYuanbao: 1_000_000 };
  p.items.treasureKey = 1000;
  const st = stats(p); p.hp = st.hp; p.mp = st.mp;
  return { p, state: { player: p, battle: null }, busy: false, battle: null };
}
const act = (game, action, params = {}) => economyAction(game, action, params);
function unchanged(game, fn, pattern) {
  const before = structuredClone(game);
  assert.throws(fn, pattern);
  assert.deepEqual(game, before, 'rejection changed currency/items/pity/history/daily counters');
}
function random(value, fn) {
  const previous = Math.random; Math.random = () => value;
  try { return fn(); } finally { Math.random = previous; }
}
function date(timestamp, fn) {
  const previous = globalThis.Date;
  globalThis.Date = class extends OriginalDate {
    constructor(...args) { super(...(args.length ? args : [timestamp])); }
    static now() { return timestamp; }
  };
  try { return fn(); } finally { globalThis.Date = previous; }
}
function test(name, fn) {
  tests++;
  try { random(0.1, fn); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, error }); console.error(`FAIL ${name}: ${error.message}`); }
}
function delivered(game, before, definitions, actual, multiplier = 1) {
  for (const reward of definitions) {
    if (reward.type === 'item') assert.equal(game.p.items[reward.itemId], (before.items[reward.itemId] || 0) + reward.quantity * multiplier);
    else if (reward.type === 'gold' || reward.type === 'sp') assert.equal(game.p[reward.type], before[reward.type] + reward.quantity * multiplier);
    else if (reward.type === 'boundYuanbao') assert.equal(game.p.wallet.boundYuanbao, before.wallet.boundYuanbao + reward.quantity * multiplier);
    else if (reward.type === 'cosmetic') {
      if (before.cosmetics.owned.includes(reward.cosmeticId)) {
        assert.ok(actual.some((entry) => entry.duplicateOf === reward.cosmeticId && entry.quantity === 120));
        assert.equal(game.p.wallet.boundYuanbao, before.wallet.boundYuanbao + 120);
      } else assert.ok(game.p.cosmetics.owned.includes(reward.cosmeticId));
    } else if (reward.type === 'equip') {
      const equipment = actual.filter((entry) => entry.type === 'equip');
      assert.equal(equipment.length, reward.quantity * multiplier);
      assert.equal(game.p.bag.length, before.bag.length + equipment.length);
      for (const entry of equipment) {
        if (reward.templateId) {
          assert.equal(entry.equipment.templateId, reward.templateId);
          assert.ok(matchesHighEquip(entry.equipment));
          assert.equal(entry.equipment.lv, 105);
        } else {
          assert.equal(entry.equipment.q, reward.quality);
          assert.equal(entry.equipment.lv, game.p.lv);
          assert.equal(entry.equipment.slot, reward.slot);
          assert.ok(matchesGearSpec(entry.equipment), 'Economy must deliver canonical new-rule equipment');
          validateEquipment(entry.equipment);
          assert.equal(entry.equipment.refine, 0); assert.equal(entry.equipment.rerolls, 0); assert.equal(entry.equipment.upgrades, 0);
          const cap = entry.equipment.slot === 'weapon' ? 2 : ['head', 'body', 'legs', 'feet', 'wrist'].includes(entry.equipment.slot) ? 4 : 0;
          assert.equal(entry.equipment.socketLimit, cap);
          assert.deepEqual(entry.equipment.sockets, Array(cap && reward.quality >= 2 ? 1 : 0).fill(null));
        }
        assert.ok(game.p.bag.some((owned) => owned.uid === entry.equipment.uid));
      }
    }
  }
}

try {
  console.log(`PREFLIGHT ${JSON.stringify(validateEconomyData())}`);
} catch (error) {
  console.error(`真实依赖/配置预检失败，不能测试；未使用stub：${error.message}`);
  process.exitCode = 1;
}
if (!process.exitCode) {
  test('contract migration only fills missing fields; starting wallet has no hidden gifts', () => {
    const p = createPlayer('新角色测试', 'wizard');
    const before = structuredClone(p); ensureEconomy(p);
    assert.deepEqual(p.wallet, { yuanbao: 300, boundYuanbao: 0 });
    assert.deepEqual(p.charms, { hp: 0, mp: 0 });
    assert.deepEqual(p.items, before.items); assert.equal(p.gold, before.gold); assert.equal(p.sp, before.sp);
    assert.deepEqual(p.events.hongyun, { pity: 0, draws: 0 });
    const g = fixture();
    g.p.wallet.yuanbao = 12; g.p.events.hongyun = { pity: 49, draws: 80 };
    g.p.mall.daily = { day: '2000-01-01', counts: { '$wallet.daily': 1, 'shop:hp1': 3 } };
    const snapshot = structuredClone(g.p); const wallet = g.p.wallet;
    ensureEconomy(g.p); assert.deepEqual(g.p, snapshot); assert.equal(g.p.wallet, wallet);
    const partial = { wallet: { boundYuanbao: 17 }, charms: { hp: 7 } }; ensureEconomy(partial);
    assert.deepEqual(partial.wallet, { boundYuanbao: 17, yuanbao: 300 }); assert.deepEqual(partial.charms, { hp: 7, mp: 0 });
    partial.wallet.yuanbao = NaN; ensureEconomy(partial); assert.ok(Number.isNaN(partial.wallet.yuanbao));
    assert.throws(() => ensureEconomy({ wallet: null }));
  });
  test('all 66 products have real dependencies, categories, prices and delivery', () => {
    assert.equal(SHOP_PRODUCTS.length, 66); assert.equal(SHOP_CATEGORIES.length, 8);
    const families = new Set();
    for (const product of SHOP_PRODUCTS) {
      const g = fixture(); const before = structuredClone(g.p);
      const result = act(g, 'shop.buy', { productId: product.id, quantity: 1 });
      assert.equal(g.p.wallet[product.currency], before.wallet[product.currency] - product.price);
      assert.equal(g.p.wallet[product.currency === 'yuanbao' ? 'boundYuanbao' : 'yuanbao'], before.wallet[product.currency === 'yuanbao' ? 'boundYuanbao' : 'yuanbao']);
      delivered(g, before, product.rewards, result.rewards);
      assert.equal(result.order.currency, product.currency); assert.equal(result.order.cost, product.price);
      assert.equal(g.p.mall.daily.counts[`shop:${product.id}`], 1);
      assert.deepEqual(g.p.mall.orders.at(-1), result.order);
      for (const reward of product.rewards) families.add(reward.type);
      result.order.cost = -1; assert.equal(g.p.mall.orders.at(-1).cost, product.price);
    }
    assert.ok(families.has('cosmetic') && families.has('item') && families.has('gold') && families.has('sp'));
  });
  test('every product quantity scales, daily limit blocks, and declared levels apply', () => {
    for (const product of SHOP_PRODUCTS) {
      const g = fixture(); const before = structuredClone(g.p);
      const count = product.rewards.some((entry) => entry.type === 'cosmetic') ? 1 : product.dailyLimit;
      const result = act(g, 'shop.buy', { productId: product.id, quantity: count });
      assert.equal(result.order.cost, product.price * count);
      delivered(g, before, product.rewards, result.rewards, count);
      unchanged(g, () => act(g, 'shop.buy', { productId: product.id, quantity: 1 }));
      const view = queryEconomy(fixture(), 'shop').products.find((entry) => entry.id === product.id);
      if (view.effectiveMinLevel > 1) {
        const low = fixture('blademaster', view.effectiveMinLevel - 1);
        unchanged(low, () => act(low, 'shop.buy', { productId: product.id, quantity: 1 }), /级/);
      }
    }
  });
  test('classic item names and charm storage are correct, extensions remain explicitly separate', () => {
    for (const [id, name] of [['charmHp', '黄金护身符'], ['charmMp', '黄金守神符'], ['zongzi', '幸运粽子']]) {
      const product = SHOP_PRODUCTS.find((entry) => entry.id === id);
      assert.equal(product.name, name); assert.equal(ITEMS[id].name, name);
      assert.equal(product.catalog, 'classic');
    }
    assert.equal(CHARM_CONFIG.charmHp.charge, 600000);
    assert.equal(CHARM_CONFIG.charmMp.charge, 900000);
    for (const entry of SHOP_PRODUCTS.filter((entry) => entry.category === 'gems')) {
      assert.equal(entry.name, ITEMS[entry.id].name);
      assert.equal(entry.catalog, 'adaptation');
    }
    for (const id of ['bronzeChest', 'goldChest', 'bigZongzi', 'socketStone', 'outfitCloud']) {
      assert.equal(SHOP_PRODUCTS.find((entry) => entry.id === id).catalog, 'adaptation');
    }
    assert.match(ECONOMY_RULES.catalog, /不是官方/);
  });
  test('all 5 base probability pools total exactly 100%, positive weights and reward quality', () => {
    const pools = [HONGYUN_POOL, ...Object.values(ACTIVITY_POOLS).map((entry) => entry.pool)];
    const rewardTypes = new Set();
    for (const pool of pools) {
      assert.equal(pool.reduce((sum, entry) => sum + entry.weight, 0), 10000);
      assert.equal(new Set(pool.map((entry) => entry.id)).size, pool.length);
      for (const entry of pool) {
        assert.ok(Number.isInteger(entry.weight) && entry.weight > 0);
        for (const reward of entry.rewards) {
          rewardTypes.add(reward.type);
          if (reward.type === 'item') assert.ok(Object.hasOwn(ITEMS, reward.itemId));
          if (reward.type === 'equip') {
            if (reward.templateId) assert.ok(Object.hasOwn(HIGH_EQUIPMENT, reward.templateId));
            else assert.equal(reward.quality, entry.rarity === 'legendary' ? 3 : 2);
          }
        }
      }
    }
    assert.deepEqual([...rewardTypes].sort(), ['boundYuanbao', 'cosmetic', 'equip', 'gold', 'item', 'sp'].sort());
    assert.equal(HONGYUN_POOL.filter((entry) => entry.rarity === 'legendary').reduce((sum, entry) => sum + entry.weight, 0), 800);
    assert.match(ECONOMY_RULES.disclaimer, /原创/); assert.match(ECONOMY_RULES.festival, /不代表官方/);
    assert.ok(Object.isFrozen(SHOP_PRODUCTS) && Object.isFrozen(HONGYUN_POOL[0].rewards));
  });
  test('each hongyun prize and every interval boundary resolves to the actual advertised reward', () => {
    let start = 0;
    for (let index = 0; index < HONGYUN_POOL.length; index++) {
      const entry = HONGYUN_POOL[index];
      for (const point of [start / 10000, (start + entry.weight / 2) / 10000, (start + entry.weight - 0.01) / 10000]) {
        const g = fixture(); const before = structuredClone(g.p);
        const result = random(point, () => act(g, 'treasure.draw', { count: 1 })).results[0];
        assert.equal(result.prizeId, entry.id); assert.equal(result.guaranteed, false);
        assert.equal(result.rarity, entry.rarity); delivered(g, before, entry.rewards, result.rewards);
        assert.equal(g.p.items.treasureKey, before.items.treasureKey - 1);
      }
      start += entry.weight;
    }
    const invalidRandom = fixture();
    unchanged(invalidRandom, () => random(NaN, () => act(invalidRandom, 'treasure.draw', { count: 1 })));
  });
  test('49 misses then 50th guaranteed legend; natural legends reset; forced high-tier distribution', () => {
    const g = fixture();
    random(0, () => {
      for (let i = 1; i <= 49; i++) {
        const result = act(g, 'treasure.draw', { count: 1 });
        assert.equal(result.results[0].guaranteed, false); assert.equal(g.p.events.hongyun.pity, i);
      }
      const result = act(g, 'treasure.draw', { count: 1 });
      assert.equal(result.results[0].guaranteed, true); assert.equal(result.results[0].rarity, 'legendary');
      assert.equal(result.results[0].rewards[0].equipment.q, 3); assert.equal(result.pity, 0);
    });
    assert.equal(g.p.events.hongyun.draws, 50); assert.equal(g.p.items.treasureKey, 950);
    g.p.events.hongyun.pity = 20;
    assert.equal(random(0.825, () => act(g, 'treasure.draw', { count: 1 })).pity, 0);
    for (const [point, expected] of [[0.37499, 'hyLegend'], [0.375, 'hyOutfit'], [0.62499, 'hyOutfit'], [0.625, 'hySovereign19'], [0.74999, 'hySovereign19'], [0.75, 'hyHeaven18'], [0.99999, 'hyHeaven18']]) {
      const forced = fixture(); forced.p.events.hongyun.pity = 49;
      const result = random(point, () => act(forced, 'treasure.draw', { count: 1 }));
      assert.equal(result.results[0].prizeId, expected); assert.equal(result.results[0].guaranteed, true);
    }
  });
  test('10-draw batch updates per draw, guarantee in the middle, detached history capped at 100', () => {
    const g = fixture(); g.p.events.hongyun.pity = 45;
    const result = random(0, () => act(g, 'treasure.draw', { count: 10 }));
    assert.equal(result.results.length, 10); assert.equal(result.keyCost, 10);
    assert.deepEqual(result.results.map((entry) => entry.guaranteed), [false, false, false, false, true, false, false, false, false, false]);
    assert.equal(result.pity, 5); assert.deepEqual(result.results.map((entry) => entry.sequence), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(g.p.drawHistory, result.results);
    result.results[0].rewards[0].quantity = -99; assert.notEqual(g.p.drawHistory[0].rewards[0].quantity, -99);
    const many = fixture();
    random(0, () => { for (let i = 0; i < 12; i++) act(many, 'treasure.draw', { count: 10 }); });
    assert.equal(many.p.events.hongyun.draws, 120); assert.equal(many.p.drawHistory.length, 100);
    assert.equal(many.p.drawHistory[0].sequence, 21); assert.equal(many.p.drawHistory.at(-1).sequence, 120);
    assert.equal(new Set(many.p.drawHistory.map((entry) => entry.id)).size, 100);
  });
  test('every chest/zongzi pool prize, item/key cost, isolation from hongyun pity', () => {
    for (const [id, definition] of Object.entries(ACTIVITY_POOLS)) {
      let start = 0;
      for (const entry of definition.pool) {
        const g = fixture(); g.p.items[id] = 1; g.p.events.hongyun.pity = 49;
        const before = structuredClone(g.p);
        const result = random((start + entry.weight / 2) / 10000, () => act(g, 'activity.open', { itemId: id, count: 1 }));
        assert.equal(result.results[0].prizeId, entry.id); assert.equal(result.results[0].rarity, entry.rarity);
        assert.equal(result.results[0].guaranteed, false); assert.equal(result.results[0].pityAfter, null);
        assert.equal(g.p.items[id], 0); assert.equal(g.p.items.treasureKey, before.items.treasureKey - definition.keyCost);
        assert.equal(g.p.events[definition.counter], 1); assert.deepEqual(g.p.events.hongyun, before.events.hongyun);
        delivered(g, before, entry.rewards, result.results[0].rewards); start += entry.weight;
      }
      const g = fixture(); g.p.items[id] = 10;
      const results = random(0, () => act(g, 'activity.open', { itemId: id, count: 10 }));
      assert.equal(results.results.length, 10); assert.equal(g.p.items[id], 0);
      assert.equal(g.p.events[definition.counter], 10); assert.equal(g.p.drawHistory.length, 10);
    }
  });
  test('all ten classes receive a real same-level class-compatible legendary weapon', () => {
    assert.equal(Object.keys(CLASSES).length, 10);
    for (const cls of Object.keys(CLASSES)) {
      const g = fixture(cls, 30); g.p.events.hongyun.pity = 49;
      const result = random(0, () => act(g, 'treasure.draw', { count: 1 }));
      const equipment = result.results[0].rewards[0].equipment;
      assert.equal(equipment.q, 3); assert.equal(equipment.lv, 30);
      assert.equal(equipment.cls, cls); assert.equal(equipment.slot, 'weapon');
      assert.ok(matchesGearSpec(equipment)); assert.ok(allowedWeaponClasses(equipment.weaponType).includes(cls));
      assert.equal(equipment.weaponType, CLASSES[cls].weapon);
      assert.ok(Object.values(equipment.base).every((amount) => Number.isFinite(amount) && amount >= 0));
      assert.deepEqual(g.p.bag.at(-1), equipment);
    }
  });
  test('duplicate prize cosmetics deliver 120 bound currency and still reset pity', () => {
    const g = fixture(); random(0.86, () => act(g, 'treasure.draw', { count: 1 }));
    const bound = g.p.wallet.boundYuanbao; g.p.events.hongyun.pity = 49;
    const result = random(0.5, () => act(g, 'treasure.draw', { count: 1 }));
    assert.equal(g.p.wallet.boundYuanbao, bound + 120); assert.equal(result.results[0].guaranteed, true);
    assert.equal(result.pity, 0); assert.equal(g.p.cosmetics.owned.filter((id) => id === 'outfitLucky').length, 1);
    assert.equal(result.results[0].rewards[0].duplicateOf, 'outfitLucky');
  });
  test('every action rejects malformed IDs, NaN, negative/fractional/string/overflow quantities atomically', () => {
    const numericActions = [
      ['shop.buy', 'quantity', { productId: 'hp1' }, 100],
      ['wallet.exchange', 'quantity', {}, 100],
      ['treasure.draw', 'count', {}, 11],
      ['activity.open', 'count', { itemId: 'zongzi' }, 11],
      ['charm.equip', 'count', { itemId: 'charmHp' }, 100],
    ];
    for (const [action, key, rest, overflow] of numericActions) {
      for (const value of [NaN, Infinity, -Infinity, -1, 0, 0.5, '1', null, undefined, overflow]) {
        const g = fixture(); unchanged(g, () => act(g, action, { ...rest, [key]: value }));
      }
    }
    for (const id of ['unknown', '__proto__', 'constructor', 'prototype', '', 1, null, NaN]) {
      for (const [action, params] of [
        ['shop.buy', { productId: id }], ['activity.open', { itemId: id }],
        ['activity.claim', { milestoneId: id }], ['charm.equip', { itemId: id }],
        ['cosmetic.equip', { cosmeticId: id, slot: 'outfit' }],
      ]) {
        // null is intentionally supported only for unequipping a valid slot.
        if (action === 'cosmetic.equip' && id === null) continue;
        const g = fixture(); unchanged(g, () => act(g, action, params));
      }
    }
    for (const params of [null, [], 1, 'bad', { unexpected: true }, JSON.parse('{"__proto__":1}')]) {
      const g = fixture(); unchanged(g, () => act(g, 'wallet.daily', params));
    }
    for (const count of [2, 3, 9]) { const g = fixture(); unchanged(g, () => act(g, 'treasure.draw', { count })); }
    const g = fixture(); unchanged(g, () => act(g, 'wallet.recharge', { quantity: 1 }));
    assert.throws(() => act({ p: null }, 'wallet.daily'));
  });
  test('noncombat restriction applies to all 8 actions, even when busy flag lies', () => {
    const cases = {
      'shop.buy': { productId: 'hp1' }, 'wallet.exchange': {}, 'wallet.daily': {}, 'treasure.draw': {},
      'activity.open': { itemId: 'zongzi' }, 'activity.claim': { milestoneId: 'festival.daily' },
      'cosmetic.equip': { cosmeticId: null, slot: 'outfit' }, 'charm.equip': { itemId: 'charmHp' },
    };
    assert.deepEqual(Object.keys(cases).sort(), Object.keys(ECONOMY_ACTIONS).sort());
    for (const [action, params] of Object.entries(cases)) {
      const g = fixture(); g.state.battle = { result: null };
      unchanged(g, () => act(g, action, params), /战斗/);
    }
  });
  test('no money, wrong currency, missing items/keys and numeric overflow do not charge or log', () => {
    const g = fixture(); g.p.wallet.yuanbao = 0; g.p.wallet.boundYuanbao = 0; g.p.gold = 0;
    unchanged(g, () => act(g, 'shop.buy', { productId: 'revive' }), /不足/);
    unchanged(g, () => act(g, 'shop.buy', { productId: 'hp1' }), /不足/);
    unchanged(g, () => act(g, 'wallet.exchange', { quantity: 1 }), /不足/);
    g.p.wallet.boundYuanbao = 1000;
    unchanged(g, () => act(g, 'shop.buy', { productId: 'revive' }), /不足/);
    g.p.items.treasureKey = 0;
    unchanged(g, () => act(g, 'treasure.draw', { count: 1 }), /不足/);
    for (const id of Object.keys(ACTIVITY_POOLS)) unchanged(g, () => act(g, 'activity.open', { itemId: id, count: 1 }), /不足/);
    g.p.items.goldChest = 1; g.p.items.treasureKey = 0;
    const chest = act(g, 'activity.open', { itemId: 'goldChest', count: 1 });
    assert.equal(chest.results.length, 1); assert.equal(g.p.items.goldChest, 0); assert.equal(g.p.items.treasureKey, 0);
    unchanged(g, () => act(g, 'charm.equip', { itemId: 'charmHp', count: 1 }), /不足/);
    const overflow = fixture(); overflow.p.items.hp1 = ECONOMY_LIMITS.itemStack;
    unchanged(overflow, () => act(overflow, 'shop.buy', { productId: 'hp1' }));
    overflow.p.wallet.yuanbao = ECONOMY_LIMITS.balance;
    unchanged(overflow, () => act(overflow, 'wallet.exchange', { quantity: 1 }));
  });
  test('cash shop chests and zongzi are bought then opened without any treasure keys', () => {
    for (const id of Object.keys(ACTIVITY_POOLS)) {
      const g = fixture(); g.p.items.treasureKey = 0; g.p.items[id] = 0;
      unchanged(g, () => act(g, 'activity.open', { itemId: id, count: 1 }), /不足/);
      const product = SHOP_PRODUCTS.find((entry) => entry.id === id);
      const balance = g.p.wallet[product.currency];
      const purchase = act(g, 'shop.buy', { productId: id, quantity: 1 });
      assert.equal(g.p.wallet[product.currency], balance - product.price);
      assert.equal(g.p.items[id], 1); assert.equal(purchase.order.productId, id);
      const result = act(g, 'activity.open', { itemId: id, count: 1 });
      assert.equal(result.results.length, 1); assert.equal(g.p.items[id], 0);
      assert.equal(g.p.items.treasureKey, 0); assert.equal(g.p.events.hongyun.draws, 0);
    }
  });
  test('full bags preserve guarantee and whole batches; non-equipment zongzi still works', () => {
    const g = fixture();
    g.p.bag = Array.from({ length: ECONOMY_LIMITS.bag }, () => makeEquip('head', 105, 0, g.p.cls));
    g.p.events.hongyun.pity = 49;
    unchanged(g, () => act(g, 'treasure.draw', { count: 1 }), /背包/);
    unchanged(g, () => act(g, 'treasure.draw', { count: 10 }), /背包/);
    g.p.items.goldChest = 10;
    unchanged(g, () => act(g, 'activity.open', { itemId: 'goldChest', count: 10 }), /背包/);
    g.p.items.zongzi = 10;
    const result = act(g, 'activity.open', { itemId: 'zongzi', count: 10 });
    assert.equal(result.results.length, 10); assert.equal(g.p.events.hongyun.pity, 49);
    g.p.bag.pop(); unchanged(g, () => act(g, 'treasure.draw', { count: 10 }), /背包/);
    const guaranteed = random(0, () => act(g, 'treasure.draw', { count: 1 }));
    assert.equal(guaranteed.results[0].guaranteed, true); assert.equal(g.p.bag.length, ECONOMY_LIMITS.bag);
    assert.equal(g.p.bag.at(-1).q, 3); assert.equal(g.p.events.hongyun.pity, 0);
  });
  test('daily welfare and gold exchange 99+1 reach cap; next day resets only contract daily fields', () => {
    const noon = new OriginalDate(2026, 10, 17, 12).getTime(); let g;
    date(noon, () => {
      g = fixture(); const before = structuredClone(g.p);
      const daily = act(g, 'wallet.daily');
      assert.equal(g.p.wallet.yuanbao, before.wallet.yuanbao + 20);
      assert.equal(g.p.wallet.boundYuanbao, before.wallet.boundYuanbao + 30);
      assert.deepEqual(g.p.items, before.items, 'wallet welfare must not grant treasure keys, chests or zongzi');
      assert.equal(daily.rewards.length, 2); unchanged(g, () => act(g, 'wallet.daily'));
      const gold = g.p.gold; const yuanbao = g.p.wallet.yuanbao;
      act(g, 'wallet.exchange', { quantity: 99 }); act(g, 'wallet.exchange', { quantity: 1 });
      assert.equal(g.p.gold, gold - 100000); assert.equal(g.p.wallet.yuanbao, yuanbao + 100);
      assert.equal(g.p.mall.daily.counts['$wallet.exchange'], 100);
      unchanged(g, () => act(g, 'wallet.exchange', { quantity: 1 }));
      act(g, 'activity.claim', { milestoneId: 'festival.daily' });
      unchanged(g, () => act(g, 'activity.claim', { milestoneId: 'festival.daily' }));
    });
    const saved = structuredClone(g.p);
    date(noon + 86400000, () => {
      const view = queryEconomy(g, 'wallet'); assert.equal(view.exchangeUsed, 0); assert.equal(view.dailyClaimed, false);
      assert.deepEqual(g.p, saved, 'read-only query refreshed live state');
      act(g, 'wallet.exchange', { quantity: 1 }); assert.equal(g.p.mall.daily.counts['$wallet.exchange'], 1);
      assert.equal(g.p.events.festival.claimed, false);
      act(g, 'wallet.daily'); act(g, 'activity.claim', { milestoneId: 'festival.daily' });
      assert.deepEqual(Object.keys(g.p.mall).sort(), ['daily', 'orders']);
      assert.deepEqual(Object.keys(g.p.mall.daily).sort(), ['counts', 'day']);
      assert.deepEqual(g.p.events.hongyun, saved.events.hongyun);
      assert.deepEqual(g.p.events.milestones, saved.events.milestones);
    });
  });
  test('all milestones require progress, deliver once, and retain claims after history truncation', () => {
    for (const milestone of MILESTONES) {
      const g = fixture(); unchanged(g, () => act(g, 'activity.claim', { milestoneId: milestone.id }), /进度/);
      if (milestone.counter === 'draws') g.p.events.hongyun.draws = milestone.target;
      else g.p.events[milestone.counter] = milestone.target;
      const before = structuredClone(g.p);
      const result = act(g, 'activity.claim', { milestoneId: milestone.id });
      delivered(g, before, milestone.rewards, result.rewards);
      assert.ok(g.p.events.milestones.includes(milestone.id));
      unchanged(g, () => act(g, 'activity.claim', { milestoneId: milestone.id }), /已领取/);
    }
    const g = fixture();
    random(0, () => act(g, 'treasure.draw', { count: 10 }));
    act(g, 'activity.claim', { milestoneId: 'draw10' });
    random(0, () => { for (let i = 0; i < 11; i++) act(g, 'treasure.draw', { count: 10 }); });
    assert.equal(g.p.drawHistory[0].sequence, 21);
    unchanged(g, () => act(g, 'activity.claim', { milestoneId: 'draw10' }), /已领取/);
  });
  test('all cosmetics equip real owned slots, wrong slots/levels reject, flyers grant existing flight', () => {
    for (const definition of COSMETICS) {
      const g = fixture(); g.p.cosmetics.owned.push(definition.id);
      act(g, 'cosmetic.equip', { cosmeticId: definition.id, slot: definition.slot });
      assert.equal(g.p.cosmetics[definition.slot], definition.id);
      if (definition.slot === 'flyer') assert.equal(g.p.flight, true);
      const wrong = definition.slot === 'outfit' ? 'mount' : 'outfit';
      unchanged(g, () => act(g, 'cosmetic.equip', { cosmeticId: definition.id, slot: wrong }));
      act(g, 'cosmetic.equip', { cosmeticId: null, slot: definition.slot });
      assert.equal(g.p.cosmetics[definition.slot], null);
      if (definition.slot === 'flyer') assert.equal(g.p.flight, true);
      if (definition.minLevel > 1) {
        const low = fixture('wizard', definition.minLevel - 1); low.p.cosmetics.owned.push(definition.id);
        unchanged(low, () => act(low, 'cosmetic.equip', { cosmeticId: definition.id, slot: definition.slot }), /级/);
      }
    }
    const g = fixture(); act(g, 'shop.buy', { productId: 'outfitCloud' });
    unchanged(g, () => act(g, 'shop.buy', { productId: 'outfitCloud' }), /重复/);
    unchanged(g, () => act(g, 'cosmetic.equip', { cosmeticId: 'mountJade', slot: 'mount' }), /未拥有/);
    unchanged(g, () => act(g, 'cosmetic.equip', { cosmeticId: null, slot: 'constructor' }));
  });
  test('charm purchase and recharge consumes actual items, adds reserves, never direct heals or real payment', () => {
    const g = fixture();
    for (const [id, definition] of Object.entries(CHARM_CONFIG)) {
      assert.equal(ITEMS[id].value, definition.charge);
      act(g, 'shop.buy', { productId: id, quantity: 3 });
      const hp = g.p.hp; const mp = g.p.mp; const wallet = structuredClone(g.p.wallet);
      const result = act(g, 'charm.equip', { itemId: id, count: 2 });
      assert.equal(result.charge, definition.charge * 2); assert.equal(g.p.items[id], 1);
      assert.equal(g.p.charms[definition.slot], definition.charge * 2);
      act(g, 'charm.equip', { itemId: id, count: 1 });
      assert.equal(g.p.charms[definition.slot], definition.charge * 3); assert.equal(g.p.items[id], 0);
      assert.equal(g.p.hp, hp); assert.equal(g.p.mp, mp); assert.deepEqual(g.p.wallet, wallet);
      unchanged(g, () => act(g, 'charm.equip', { itemId: id, count: 1 }), /不足/);
    }
    const small = fixture(); small.p.items.charmHp = 99;
    act(small, 'charm.equip', { itemId: 'charmHp', count: 99 }); assert.equal(small.p.charms.hp, 99 * CHARM_CONFIG.charmHp.charge);
  });
  test('actual combat consumes equipped HP/MP charm reserves and can then be refilled', () => {
    const g = fixture('blademaster', 20);
    for (const id of ['charmHp', 'charmMp']) {
      act(g, 'shop.buy', { productId: id, quantity: 2 }); act(g, 'charm.equip', { itemId: id, count: 1 });
    }
    const st = stats(g.p); g.p.hp = Math.max(1, Math.floor(st.hp / 4)); g.p.mp = Math.floor(st.mp / 10);
    const before = structuredClone(g.p.charms); const hp = g.p.hp; const mp = g.p.mp;
    const b = createBattle(g.p, [{ name: '神符配置靶', lv: 1, hp: 100000, maxHp: 100000, atk: 1,
      statuses: [{ kind: 'stun', turns: 10 }] }]);
    g.state.battle = b; g.battle = b;
    random(0.1, () => takeTurn(g.p, b, 'defend'));
    assert.ok(g.p.charms.hp < before.hp && g.p.hp > hp, 'real combat did not consume HP charm reserve');
    assert.ok(g.p.charms.mp < before.mp && g.p.mp > mp, 'real combat did not consume MP charm reserve');
    assert.ok(g.p.hp <= stats(g.p, b).hp && g.p.mp <= stats(g.p, b).mp);
    unchanged(g, () => act(g, 'charm.equip', { itemId: 'charmHp', count: 1 }), /战斗/);
    assert.equal(random(0, () => takeTurn(g.p, b, 'escape')), 'escape');
    for (const id of ['charmHp', 'charmMp']) {
      const reserve = g.p.charms[CHARM_CONFIG[id].slot];
      act(g, 'charm.equip', { itemId: id, count: 1 });
      assert.equal(g.p.charms[CHARM_CONFIG[id].slot], reserve + CHARM_CONFIG[id].charge);
    }
  });
  test('query sections are detached and pure; unavailable products and active combat expose honest states', () => {
    const g = fixture(); const before = structuredClone(g);
    for (const section of ['all', 'shop', 'wallet', 'treasure', 'activity', 'cosmetics', 'charms', 'history']) {
      const view = queryEconomy(g, section); assert.ok(view); assert.deepEqual(g, before);
    }
    const all = queryEconomy(g); all.wallet.yuanbao = 0; all.shop.products[0].price = 0;
    all.activity.milestones[0].claimed = true; assert.deepEqual(g, before);
    assert.throws(() => queryEconomy(g, 'unknown'));
    g.p.wallet.boundYuanbao = 0;
    assert.equal(queryEconomy(g, 'shop').products.find((entry) => entry.id === 'hp1').available, false);
    g.state.battle = { result: null };
    assert.ok(queryEconomy(g, 'shop').products.every((entry) => !entry.available));
  });
  test('local fulfilled orders retain newest 100, with no fake payment/account identifiers', () => {
    const g = fixture(); const ids = [];
    const noon = new OriginalDate(2026, 10, 17, 12).getTime();
    for (let i = 0; i < 121; i++) date(noon + Math.floor(i / 10) * 86400000, () => {
      const result = act(g, 'shop.buy', { productId: 'hp1' }); ids.push(result.order.id);
    });
    assert.equal(g.p.mall.orders.length, 100); assert.equal(new Set(ids).size, 121);
    assert.deepEqual(g.p.mall.orders.map((entry) => entry.id), ids.slice(-100));
    assert.deepEqual(Object.keys(g.p.mall).sort(), ['daily', 'orders']);
    for (const order of g.p.mall.orders) {
      assert.equal(order.cost, order.quantity * order.unitPrice);
      assert.ok(order.rewards.length > 0 && !Object.hasOwn(order, 'paymentId') && !Object.hasOwn(order, 'accountId'));
    }
  });
}
assert.equal(Math.random, originalRandom); assert.equal(globalThis.Date, OriginalDate);
console.log(`SUMMARY tests=${tests} passed=${passed} failed=${failures.length}`);
console.log('初始化fixture验证，不是自然全程升级/赚币/玩法通关；所有价格概率原创非官方，无真实充值。');
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure.name}: ${failure.error.message}`);
  process.exitCode = 1;
}
