import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, seededRandom } from '../src/engine';
import { createPlayer } from '../src/rules';
import { createItem, getBase, placeItem, insertSocket } from '../src/items';
import { GAMBLING_CODES, gamblingBaseCost, gamblingCost, gamblingDiscount, gamblingItemLevel, gamblingQuality, gamblingStock, gamblingUpgrade, refillGamblingOffer, rollGamblingItem } from '../src/gambling';
import type { Rng } from '../src/types';
import { createArea } from '../src/world';
import type { SaveRecord } from '../src/storage';

const sequence = (...values: number[]): Rng => () => values.shift() ?? .5;

function fixture() {
  const engine = new Engine(); engine.dispatch({ type: 'new', classId: 'sor', name: '赌博隔离测试' });
  const p = engine.state.player!; p.inventory = []; p.gold = 1000000; p.level = 50;
  const npc = engine.state.area!.objects.find(o => o.npcId === 'gheed')!;
  Object.assign(p, { x: npc.x, y: npc.y });
  engine.dispatch({ type: 'interact', uid: npc.uid });
  (engine as unknown as { rng: Rng }).rng = seededRandom(11);
  engine.dispatch({ type: 'gamble-refresh' });
  assert.equal(engine.state.panel, 'gamble');
  return { engine, p, npc };
}

test('talking to Gheed opens gambling by default without charging or changing owned items', () => {
  const engine = new Engine(); engine.dispatch({ type: 'new', classId: 'sor', name: '基德默认界面' });
  const p = engine.state.player!, npc = engine.state.area!.objects.find(o => o.npcId === 'gheed')!;
  Object.assign(p, { x: npc.x, y: npc.y });
  const gold = p.gold, inventory = structuredClone(p.inventory), equipment = structuredClone(p.equipment);
  engine.dispatch({ type: 'interact', uid: npc.uid });
  assert.equal(engine.state.panel, 'gamble'); assert.equal(engine.state.npc, 'gheed');
  assert.equal(engine.state.gamblingOffers.length, 14); assert.ok(engine.state.vendorItems.length > 0);
  assert.equal(engine.state.gamblingOffers[0].code, 'rin'); assert.equal(engine.state.gamblingOffers[1].code, 'amu');
  assert.equal(p.gold, gold); assert.deepEqual(p.inventory, inventory); assert.deepEqual(p.equipment, equipment);
});

test('other camp NPCs retain their normal trade and dialogue panels', () => {
  const engine = new Engine(); engine.dispatch({ type: 'new', classId: 'sor', name: '营地交互' });
  const p = engine.state.player!;
  for (const npcId of ['akara', 'charsi', 'kashya', 'warriv']) {
    const npc = engine.state.area!.objects.find(o => o.npcId === npcId)!;
    Object.assign(p, { x: npc.x, y: npc.y }); engine.dispatch({ type: 'interact', uid: npc.uid });
    assert.equal(engine.state.panel, 'vendor'); assert.equal(engine.state.npc, npcId);
    assert.equal(engine.state.gamblingOffers.length, 0);
  }
});

test('Gheed shop remains accessible and reentry defaults to fresh gambling offers', () => {
  const { engine, p, npc } = fixture(), stock = structuredClone(engine.state.vendorItems), before = structuredClone(p);
  const expired = engine.state.gamblingOffers[0].uid;
  engine.dispatch({ type: 'panel', panel: 'vendor' }); assert.equal(engine.state.gamblingOffers.length, 0);
  engine.dispatch({ type: 'gamble-open' }); assert.equal(engine.state.panel, 'gamble');
  engine.dispatch({ type: 'panel', panel: 'none' }); assert.equal(engine.state.panel, 'none'); assert.equal(engine.state.gamblingOffers.length, 0);
  engine.dispatch({ type: 'gamble-buy', uid: expired }); assert.deepEqual(p, before);
  engine.dispatch({ type: 'interact', uid: npc.uid }); assert.equal(engine.state.panel, 'gamble');
  assert.equal(engine.state.gamblingOffers.length, 14); assert.ok(engine.state.gamblingOffers.every(offer => offer.uid !== expired));
  assert.deepEqual(engine.state.vendorItems, stock); assert.deepEqual(p, before);
});

test('discrete gambling qualities have exact classic counts without MF or difficulty inputs', () => {
  const counts: Record<string, number> = {};
  for (let value = 0; value < 100000; value++) {
    const quality = gamblingQuality(() => (value + .5) / 100000); counts[quality] = (counts[quality] ?? 0) + 1;
  }
  assert.deepEqual(counts, { unique: 50, set: 100, rare: 10000, magic: 89850 });
});

test('gamble ilvl is clvl minus five through plus four with 5 and 99 clamps', () => {
  assert.deepEqual(Array.from({ length: 10 }, (_, n) => gamblingItemLevel(50, () => (n + .1) / 10)), [45,46,47,48,49,50,51,52,53,54]);
  assert.equal(gamblingItemLevel(1, () => 0), 5);
  assert.equal(gamblingItemLevel(99, () => .999), 99);
});

test('stock uses the actual gamble table, 14 slots and mandatory ring/amulet without charging', () => {
  const stock = gamblingStock(1, seededRandom(33));
  assert.equal(GAMBLING_CODES.length, 125); assert.equal(stock.length, 14);
  assert.equal(stock[0].code, 'rin'); assert.equal(stock[1].code, 'amu');
  for (const offer of stock) {
    assert.ok(GAMBLING_CODES.includes(offer.code)); assert.ok(offer.item.ilvl >= 5);
    assert.ok(getBase(offer.code)!.qlvl <= offer.item.ilvl);
    assert.equal(offer.item.identified, true); assert.notEqual(offer.uid, offer.item.uid);
  }
  assert.equal(new Set(stock.map(o => o.uid)).size, 14);
});

test('classic upgrade +1 threshold and exceptional-first ordering have deterministic boundaries', () => {
  const q = getBase('9ha')!.qlvl, i = 54, threshold = 90 * (i - q) + 1;
  assert.equal(threshold, 2071);
  assert.equal(gamblingUpgrade('hax', i, sequence((threshold - .5) / 10000)), '9ha');
  assert.equal(gamblingUpgrade('hax', i, sequence((threshold + .5) / 10000, .00005)), '7ha');
  assert.equal(gamblingUpgrade('hax', i, sequence((threshold + .5) / 10000, .00015)), 'hax');
  let draws = 0;
  assert.equal(gamblingUpgrade('hax', q - 1, () => { draws++; return 0; }), 'hax'); assert.equal(draws, 0);
  assert.equal(gamblingUpgrade('rin', 99, () => 0), 'rin');
});

test('upgrade family dimensions preserve atomic bag-space preflight', () => {
  for (const code of GAMBLING_CODES) {
    const base = getBase(code)!;
    for (const key of ['ubercode', 'ultracode']) {
      const upgraded = getBase(String(base.raw[key] ?? ''));
      if (upgraded) assert.deepEqual([upgraded.width, upgraded.height], [base.width, base.height], code);
    }
  }
});

test('gambling identifies new results and never randomly creates ethereal items', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const item = rollGamblingItem('hax', 90, seededRandom(seed));
    assert.equal(item.identified, true);
    if (!item.mods.forcedEthereal) assert.equal(item.ethereal, false);
  }
  const drop = createItem('hax', 50, () => 0, 'magic'); assert.equal(drop.ethereal, true); assert.equal(drop.identified, false);
  const gamble = createItem('hax', 50, () => 0, 'magic', undefined, 'gambling'); assert.equal(gamble.ethereal, false); assert.equal(gamble.identified, true);
});

test('named quality failures and forced-ethereal definitions retain their generation rules', () => {
  const rare = createItem('hax', 5, () => .5, 'unique', undefined, 'gambling');
  const magic = createItem('hax', 5, () => .5, 'set', undefined, 'gambling');
  assert.equal(rare.quality, 'rare'); assert.equal(rare.maxDurability, getBase('hax')!.durability * 3);
  assert.equal(magic.quality, 'magic'); assert.equal(magic.maxDurability, getBase('hax')!.durability * 2);
  for (const [code, name] of [['7ba','Ethereal Edge'],['7bl','Ghostflame']]) {
    const item = createItem(code, 99, () => .5, 'unique', name, 'gambling');
    assert.equal(item.ethereal, true); assert.equal(item.mods.forcedEthereal, 1); assert.equal(item.identified, true);
  }
});

test('classic pricing oracle and jewelry fixed prices use integer operation order', () => {
  assert.equal(gamblingBaseCost('hax', 50), 15239);
  for (const level of [1, 5, 50, 99]) {
    assert.equal(gamblingBaseCost('rin', level), 50000); assert.equal(gamblingBaseCost('amu', level), 63000);
  }
  assert.ok(gamblingBaseCost('hax', 90) > gamblingBaseCost('hax', 50));
  const p = createPlayer('sor', '价格测试'); p.level = 50;
  const charm = createItem('cm3', 99, () => .5); charm.identified = true; charm.mods.vendorDiscount = 30; p.inventory.push(charm);
  assert.equal(gamblingCost('hax', p), 10668);
});

test('Gheeds Fortune rolled discount and active Edge stack additively; inactive and unidentified sources do not', () => {
  const p = createPlayer('ama', '折扣测试'); p.level = 99;
  const charm = createItem('cm3', 99, () => .999, 'unique', "Gheed's Fortune"); charm.identified = true; p.inventory.push(charm);
  assert.equal(charm.mods.vendorDiscount, 15); assert.equal(gamblingDiscount(p), 15);
  const bow = createItem('sbw', 99, () => .5); bow.sockets = 3; p.inventory.push(bow);
  for (const code of ['r03', 'r07', 'r11']) {
    const rune = createItem(code, 99, () => .5); p.inventory.push(rune); assert.equal(insertSocket(p, bow.uid, rune.uid).ok, true);
  }
  assert.equal(bow.mods.vendorDiscount, 15); p.equipment.weapon = bow; p.inventory.splice(p.inventory.indexOf(bow), 1);
  assert.equal(gamblingDiscount(p), 30); assert.equal(gamblingCost('rin', p), 35000); assert.equal(gamblingCost('amu', p), 44100);
  p.weaponSwap = true; assert.equal(gamblingDiscount(p), 15);
  charm.identified = false; assert.equal(gamblingDiscount(p), 0); p.stash.push(charm); p.inventory = []; assert.equal(gamblingDiscount(p), 0);
});

test('old fixed unsupported discounts are read without rerolling unresolved variable tuples', () => {
  const p = createPlayer('sor', '旧装备'); p.level = 99;
  const charm = createItem('cm3', 99, () => .5); charm.identified = true;
  charm.mods = { 'unsupported:cheap::15:15': 1 }; p.inventory.push(charm);
  const snapshot = structuredClone(charm); assert.equal(gamblingDiscount(p), 15); assert.deepEqual(charm, snapshot);
  charm.mods = { 'unsupported:cheap::10:15': 1 }; assert.equal(gamblingDiscount(p), 0);
});

test('ordinary refill preserves base but rerolls item/offer; circlet pair has special refill', () => {
  const original = gamblingStock(50, seededRandom(11))[0], next = refillGamblingOffer(original, 50, seededRandom(12));
  assert.equal(next.code, 'rin'); assert.notEqual(next.item.uid, original.item.uid); assert.notEqual(next.uid, original.uid);
  const circlet = { uid: 'old', code: 'ci0', item: createItem('ci0', 50, () => .5) };
  assert.equal(refillGamblingOffer(circlet, 60, sequence(.1, .5, .99, .99)).code, 'ci0');
  assert.equal(refillGamblingOffer(circlet, 60, sequence(.9, .5, .99, .99)).code, 'ci1');
});

test('real Gheed context purchases exactly once and replenishes only the bought slot', () => {
  const { engine, p } = fixture(), original = structuredClone(engine.state.gamblingOffers), offer = original[0], cost = gamblingCost(offer.code, p);
  const gold = p.gold; engine.dispatch({ type: 'gamble-buy', uid: offer.uid });
  assert.equal(p.gold, gold - cost); assert.equal(p.inventory.length, 1); assert.equal(p.inventory[0].identified, true);
  assert.deepEqual({ ...p.inventory[0], x: -1, y: -1 }, offer.item);
  assert.deepEqual(engine.state.gamblingOffers.slice(1), original.slice(1));
  assert.equal(engine.state.gamblingOffers[0].code, offer.code); assert.notEqual(engine.state.gamblingOffers[0].uid, offer.uid);
  const after = structuredClone(p); engine.dispatch({ type: 'gamble-buy', uid: offer.uid }); assert.deepEqual(p, after);
  engine.dispatch({ type: 'gamble-buy', uid: engine.state.gamblingOffers[0].uid }); assert.equal(p.inventory.length, 2); assert.notEqual(p.inventory[0].uid, p.inventory[1].uid);
});

test('refresh changes offers without touching gold, belt, existing items or ordinary stock', () => {
  const { engine, p } = fixture(), offers = engine.state.gamblingOffers.map(o => o.uid), before = structuredClone(p), vendor = structuredClone(engine.state.vendorItems);
  engine.dispatch({ type: 'gamble-refresh' }); assert.deepEqual(p, before); assert.deepEqual(engine.state.vendorItems, vendor);
  assert.equal(engine.state.gamblingOffers.length, 14); assert.ok(engine.state.gamblingOffers.every(o => !offers.includes(o.uid)));
  engine.dispatch({ type: 'gamble-buy', uid: offers[0] }); assert.deepEqual(p, before);
});

for (const gate of ['gold', 'full', 'fragmented', 'paused', 'dead', 'far', 'removed', 'npc', 'service', 'panel', 'field', 'vendor-uid', 'item-uid'] as const) test(`gambling rejects ${gate} without cost, inventory mutation or refill`, () => {
  const { engine, p, npc } = fixture(), offer = engine.state.gamblingOffers[0]; let uid = offer.uid;
  if (gate === 'gold') p.gold = gamblingCost(offer.code, p) - 1;
  if (gate === 'full' || gate === 'fragmented') {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 10; x++) {
      if (gate === 'fragmented' && (x + y) % 2 === 0) continue;
      const item = createItem('rin', 1, () => .5); Object.assign(item, { x, y }); p.inventory.push(item);
    }
    if (gate === 'fragmented') {
      const helm = engine.state.gamblingOffers.find(o => getBase(o.code)!.width === 2 && getBase(o.code)!.height >= 2);
      assert.ok(helm); uid = helm.uid;
    }
  }
  if (gate === 'paused') engine.state.paused = true;
  if (gate === 'dead') p.dead = true;
  if (gate === 'far') p.x += 10;
  if (gate === 'removed') engine.state.area!.objects.splice(engine.state.area!.objects.indexOf(npc), 1);
  if (gate === 'npc') engine.state.npc = 'charsi';
  if (gate === 'service') (engine as unknown as { npcServices: string[] }).npcServices = ['trade'];
  if (gate === 'panel') engine.state.panel = 'inventory';
  if (gate === 'field') engine.state.area = createArea(2, p.difficulty, 11, p);
  if (gate === 'vendor-uid') uid = engine.state.vendorItems[0].uid;
  if (gate === 'item-uid') uid = offer.item.uid;
  const before = structuredClone(p), stock = structuredClone(engine.state.gamblingOffers);
  engine.dispatch({ type: 'gamble-buy', uid }); assert.deepEqual(p, before); assert.deepEqual(engine.state.gamblingOffers, stock);
});

test('normal buy cannot purchase gambling offers and Charsi cannot open gambling', () => {
  const { engine, p } = fixture(), before = structuredClone(p);
  engine.dispatch({ type: 'buy', uid: engine.state.gamblingOffers[0].uid }); assert.deepEqual(p, before);
  engine.dispatch({ type: 'panel', panel: 'vendor' });
  const charsi = engine.state.area!.objects.find(o => o.npcId === 'charsi')!; Object.assign(p, { x: charsi.x, y: charsi.y }); engine.dispatch({ type: 'interact', uid: charsi.uid });
  engine.dispatch({ type: 'gamble-open' }); assert.equal(engine.state.panel, 'vendor'); assert.equal(engine.state.gamblingOffers.length, 0);
});

test('rejected buy and refresh do not advance generation RNG or replace hidden results', () => {
  const { engine, p } = fixture(), stock = structuredClone(engine.state.gamblingOffers);
  let draws = 0; (engine as unknown as { rng: Rng }).rng = () => { draws++; return .5; };
  p.gold = 0; engine.dispatch({ type: 'gamble-buy', uid: stock[0].uid });
  engine.state.paused = true; engine.dispatch({ type: 'gamble-refresh' });
  assert.equal(draws, 0); assert.deepEqual(engine.state.gamblingOffers, stock);
});

test('closing gambling invalidates offers and generic panel actions cannot reopen it', () => {
  const { engine, p } = fixture(), uid = engine.state.gamblingOffers[0].uid, before = structuredClone(p);
  engine.dispatch({ type: 'panel', panel: 'inventory' }); assert.equal(engine.state.gamblingOffers.length, 0);
  engine.dispatch({ type: 'panel', panel: 'gamble' }); assert.equal(engine.state.panel, 'inventory');
  engine.dispatch({ type: 'gamble-buy', uid }); assert.deepEqual(p, before);
});

test('gambling can sell only owned inventory and invalid NPC proximity refuses sale', () => {
  const { engine, p } = fixture(); engine.dispatch({ type: 'gamble-buy', uid: engine.state.gamblingOffers[0].uid });
  const item = p.inventory[0], gold = p.gold, stock = structuredClone(engine.state.gamblingOffers);
  engine.dispatch({ type: 'sell', uid: stock[0].item.uid }); assert.equal(p.gold, gold);
  p.x += 10; engine.dispatch({ type: 'sell', uid: item.uid }); assert.equal(p.inventory[0], item); assert.equal(p.gold, gold);
  p.x -= 10; engine.dispatch({ type: 'sell', uid: item.uid }); assert.equal(p.inventory.length, 0); assert.ok(p.gold > gold);
  assert.deepEqual(engine.state.gamblingOffers, stock);
});

test('unqualified and broken discount equipment cannot lower a gambling quote', () => {
  const p = createPlayer('ama', '折扣资格'); const weapon = createItem('hax', 99, () => .5);
  weapon.mods.vendorDiscount = 15; weapon.requiredLevel = 25; p.equipment.weapon = weapon;
  p.level = 24; assert.equal(gamblingDiscount(p), 0);
  p.level = 25; assert.equal(gamblingDiscount(p), 15);
  assert.ok(weapon.maxDurability > 0); weapon.durability = 0; assert.equal(gamblingDiscount(p), 0);
});

test('purchased item persists in version 1 without gambling sessions or rerolling old gear', async () => {
  const records = new Map<string, SaveRecord>();
  const store = { list: async () => structuredClone([...records.values()]), get: async (id: string) => structuredClone(records.get(id)), put: async (r: SaveRecord) => { records.set(r.id, structuredClone(r)); }, delete: async (id: string) => { records.delete(id); }, importLegacy: async (r: SaveRecord) => { records.set(r.id, structuredClone(r)); } };
  const engine = new Engine(store); await engine.initialize(); engine.dispatch({ type: 'new', classId: 'sor', name: '保存隔离' });
  const p = engine.state.player!; p.level = 50; p.gold = 1000000; p.inventory = [];
  const old = createItem('hax', 50, seededRandom(66), 'rare'); assert.ok(placeItem(p.inventory, old, 10, 8)); const snapshot = structuredClone(old);
  const npc = engine.state.area!.objects.find(o => o.npcId === 'gheed')!; Object.assign(p, { x: npc.x, y: npc.y }); engine.dispatch({ type: 'interact', uid: npc.uid }); engine.dispatch({ type: 'gamble-open' });
  engine.dispatch({ type: 'gamble-buy', uid: engine.state.gamblingOffers[0].uid }); await engine.save(false);
  assert.deepEqual(old, snapshot);
  const record = records.get(engine.state.activeSaveId!)!; assert.equal(record.version, 1); assert.ok(!('gamblingOffers' in record.player)); assert.deepEqual(record.player.inventory, p.inventory);
  const restored = new Engine(store); await restored.initialize(); restored.dispatch({ type: 'continue', id: record.id });
  for (let i = 0; i < 20 && restored.state.loadingSave; i++) await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(restored.state.player!.inventory, p.inventory); assert.equal(restored.state.gamblingOffers.length, 0);
});
