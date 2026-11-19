import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, validSave } from '../src/engine';
import { createPlayer } from '../src/rules';
import { createItem, fitsItem, INVENTORY_HEIGHT, INVENTORY_WIDTH, moveInventoryItem, placeItem } from '../src/items';

function fixture() {
  const player = createPlayer('sor', '格子测试');
  const item = createItem('qui', 1, () => .5);
  item.name = 'Historical Quilted Armor';
  item.mods.life = 19;
  assert.ok(placeItem(player.inventory, item, INVENTORY_WIDTH, INVENTORY_HEIGHT));
  return { player, item };
}

test('expanded inventory preserves old coordinates and moves only exact item coordinates', () => {
  const { player, item } = fixture(), original = structuredClone(item);
  assert.equal(INVENTORY_WIDTH, 10); assert.equal(INVENTORY_HEIGHT, 8);
  assert.ok(moveInventoryItem(player, item.uid, 8, 5).ok);
  assert.deepEqual(item, { ...original, x: 8, y: 5 });
  assert.equal(player.inventory[0], item);
  assert.ok(validSave({ version: 1, player, seed: 1 }));
  assert.ok(moveInventoryItem(player, item.uid, item.x, item.y).ok);
  assert.equal(player.inventory.length, 1);
});

for (const [x, y] of [[-1, 0], [0, -1], [9, 0], [0, 6], [1.5, 0], [0, NaN], [Infinity, 0]]) test(`invalid multi-cell move ${x},${y} leaves inventory byte-for-byte unchanged`, () => {
  const { player, item } = fixture(), before = JSON.stringify(player);
  assert.equal(moveInventoryItem(player, item.uid, x, y).ok, false);
  assert.equal(JSON.stringify(player), before);
});

test('overlap rejection permits adjacent cells and self overlap without duplication', () => {
  const { player, item } = fixture(), other = createItem('r01', 1, () => .5);
  other.x = 4; other.y = 4; player.inventory.push(other);
  const before = structuredClone(player);
  assert.equal(moveInventoryItem(player, item.uid, 3, 2).ok, false);
  assert.deepEqual(player, before);
  assert.ok(moveInventoryItem(player, item.uid, 2, 2).ok);
  assert.ok(moveInventoryItem(player, item.uid, 2, 3).ok);
  assert.equal(player.inventory.length, 2);
  assert.deepEqual(other, before.inventory[1]);
});

for (const source of ['stash', 'cube', 'equipment', 'missing'] as const) test(`moving ${source} uid never pulls an item into inventory`, () => {
  const { player, item } = fixture(); player.inventory = [];
  if (source === 'equipment') player.equipment.body = item;
  else if (source !== 'missing') player[source].push(item);
  const before = structuredClone(player);
  assert.equal(moveInventoryItem(player, item.uid, 2, 5).ok, false);
  assert.deepEqual(player, before);
});

test('all eighty cells can be occupied and the next item fails without mutation', () => {
  const player = createPlayer('sor', '满包');
  for (let n = 0; n < 80; n++) assert.ok(placeItem(player.inventory, createItem('r01', 1, () => .5), INVENTORY_WIDTH, INVENTORY_HEIGHT));
  const extra = createItem('r01', 1, () => .5), before = structuredClone(extra);
  assert.equal(placeItem(player.inventory, extra, INVENTORY_WIDTH, INVENTORY_HEIGHT), false);
  assert.deepEqual(extra, before); assert.equal(player.inventory.length, 80);
  assert.equal(fitsItem([], extra, 9, 7), true);
  assert.equal(fitsItem([], extra, 10, 7), false);
  assert.equal(fitsItem([], extra, 9, 8), false);
});

for (const gate of ['dead', 'paused'] as const) test(`engine ${gate} rejects reposition without changing item data`, () => {
  const engine = new Engine(); engine.dispatch({ type: 'new', classId: 'sor', name: '门禁' });
  const { player, item } = fixture(); engine.state.player = player;
  if (gate === 'dead') player.dead = true; else engine.state.paused = true;
  const before = structuredClone(player);
  engine.dispatch({ type: 'move-item', uid: item.uid, x: 8, y: 5 });
  assert.deepEqual(player, before);
});

test('engine reposition is persisted by existing version-one save and restore', async () => {
  let record: unknown;
  const store = { list: async () => [], get: async () => structuredClone(record) as never, put: async (value: unknown) => { record = structuredClone(value); }, delete: async () => {}, importLegacy: async () => {} };
  const engine = new Engine(store); await engine.initialize();
  engine.dispatch({ type: 'new', classId: 'sor', name: '保存坐标' });
  const p = engine.state.player!, item = p.inventory[0], original = structuredClone(item);
  engine.dispatch({ type: 'move-item', uid: item.uid, x: 8, y: 6 });
  assert.deepEqual(item, { ...original, x: 8, y: 6 });
  await engine.save(false); assert.ok(validSave(record));
  assert.equal(record.version, 1);
  await engine.load(engine.state.activeSaveId!);
  assert.deepEqual(engine.state.player!.inventory.find(i => i.uid === item.uid), item);
});
