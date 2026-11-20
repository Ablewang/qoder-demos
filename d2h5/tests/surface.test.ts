import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, findPath, seededRandom } from '../src/engine';
import { createPlayer, deriveStats, getShrine, skillLevel } from '../src/rules';
import { createItem, createStartingItems, getBase, rollLoot } from '../src/items';
import { SURFACE_IDS, containsRegion, createArea, createSurfaceWorld, getArea, getConnections, getSurfaceRegion, isTownPoint, onKill, questKey, surfaceRegionAt } from '../src/world';
import type { AreaState, Monster, Point, Rng, WorldObject } from '../src/types';
import type { SaveRecord } from '../src/storage';

const seed = 92831;
type EngineAccess = { enterArea(id: number, position?: Point, atSpawn?: boolean): void; kill(monster: Monster): void; damagePlayer(monster: Monster, damage: number, element?: 'fire' | 'physical'): void; moveToward(unit: Point, target: Point, speed: number): void; die(): void; rng: Rng; areas: Map<number, AreaState> };
const access = (engine: Engine) => engine as unknown as EngineAccess;
function fixture(id = 1, quiet = true) {
  const engine = new Engine(), p = createPlayer('sor', '地表测试'); createStartingItems(p); p.running = false;
  engine.state.seed = seed; engine.state.player = p; engine.state.stats = deriveStats(p);
  access(engine).rng = seededRandom(seed); access(engine).enterArea(id, undefined, true);
  const area = engine.state.area!;
  if (quiet) area.monsters = []; // Geometry-only fixtures; combat/stats are tested with the original monsters below.
  return { engine, p, area };
}
test('surface and dungeon transitions preserve a timed shrine while cached used/charging objects cannot be reset by reentry',()=>{
  const {engine,p,area}=fixture(2); p.skills[36]=1; const initialLevel=skillLevel(p,36);
  const source=area.objects.find(o=>o.kind==='shrine'&&o.regionId===2)!; source.shrineCode=12; source.name=getShrine(12)!.name;
  Object.assign(p,{x:source.x,y:source.y}); engine.dispatch({type:'interact',uid:source.uid});
  assert.equal(skillLevel(p,36),initialLevel+2); assert.equal(source.used,true); const buff=engine.state.shrineBuff!,ready=source.shrineReadyTick;
  access(engine).enterArea(8,undefined,true); engine.state.area!.monsters=[]; engine.step(); assert.equal(engine.state.shrineBuff,buff); assert.equal(buff.frames,2399);
  access(engine).enterArea(2,{x:source.x,y:source.y}); assert.equal(engine.state.area,area); assert.equal(source.used,true); assert.equal(source.shrineReadyTick,ready);
  engine.dispatch({type:'interact',uid:source.uid}); assert.equal(buff.frames,2399,'reentry cannot refresh duration'); assert.equal(source.shrineReadyTick,ready);
  const cold=getSurfaceRegion(area,3)!; Object.assign(p,cold.spawn); engine.step(); assert.equal(area.def.id,3); assert.equal(engine.state.shrineBuff,buff); assert.equal(buff.frames,2398);
  engine.state.tick=ready!-1; engine.step(); assert.equal(source.used,false,'charging finishes even in another active region');
});

function openShop(engine: Engine, npcId = 'akara') {
  const npc = engine.state.area!.objects.find(o => o.kind === 'npc' && o.npcId === npcId)!;
  assert.ok(npc);
  Object.assign(engine.state.player!, { x: npc.x, y: npc.y });
  engine.dispatch({ type: 'interact', uid: npc.uid });
  assert.equal(engine.state.panel, 'vendor');
  assert.ok(engine.state.vendorItems.length > 0);
  return engine.state.vendorItems;
}
function sign(area: AreaState, source: number, target: number): WorldObject {
  const object = area.objects.find(o => o.kind === 'exit' && o.regionId === source && o.targetArea === target);
  assert.ok(object, `${source} -> ${target} exit`); return object;
}
function walk(engine: Engine, destination: Point, expectedRegion: number, limit = 1000) {
  const p = engine.state.player!, area = engine.state.area!;
  let changes = 0, previousRegion = area.def.id, arrived = false;
  for (let frame = 0; frame < limit; frame++) {
    const before = { x: p.x, y: p.y }; engine.step();
    assert.equal(engine.state.area, area, 'walking keeps the same world reference');
    assert.ok(Math.hypot(p.x - before.x, p.y - before.y) <= 6 / 25 + 1e-9, `no teleport at frame ${frame}`);
    assert.equal(p.dead, false);
    if (area.def.id !== previousRegion) { changes++; previousRegion = area.def.id; }
    if (Math.hypot(p.x - destination.x, p.y - destination.y) < .2) { arrived = true; break; }
  }
  assert.ok(arrived, 'the original click path must finish without a new movement command');
  assert.equal(area.def.id, expectedRegion); return changes;
}
function reachable(area: AreaState, from: Point): Set<number> {
  const x = Math.floor(from.x), y = Math.floor(from.y), queue = [y * area.width + x], seen = new Set(queue);
  for (let i = 0; i < queue.length; i++) {
    const x = queue[i] % area.width, y = Math.floor(queue[i] / area.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, key = ny * area.width + nx;
      if (area.tiles[ny]?.[nx] === 0 && !seen.has(key)) { seen.add(key); queue.push(key); }
    }
  }
  return seen;
}

test('vendor stock stays stable across reopen, other NPCs and same-town waypoint travel without consuming extra RNG', () => {
  const { engine, p, area } = fixture();
  let rolls = 0; const rng = seededRandom(seed);
  access(engine).rng = () => { rolls++; return rng(); };
  const akara = openShop(engine), snapshot = structuredClone(akara), afterAkara = rolls;
  engine.dispatch({ type: 'panel', panel: 'vendor' });
  assert.equal(openShop(engine), akara); assert.deepEqual(akara, snapshot); assert.equal(rolls, afterAkara);
  const charsi = openShop(engine, 'charsi'), afterCharsi = rolls;
  assert.notEqual(charsi, akara); assert.ok(afterCharsi > afterAkara);
  assert.ok(charsi.length > 0); assert.ok(charsi.every(item => getBase(item.code)?.slot === 'weapon'));
  assert.equal(openShop(engine), akara); assert.equal(openShop(engine, 'charsi'), charsi);
  assert.equal(rolls, afterCharsi);
  const waypoint = area.objects.find(o => o.kind === 'waypoint' && o.regionId === 1)!;
  Object.assign(p, { x: waypoint.x, y: waypoint.y });
  engine.dispatch({ type: 'interact', uid: waypoint.uid }); engine.dispatch({ type: 'travel', areaId: 1 });
  assert.equal(openShop(engine), akara); assert.equal(rolls, afterCharsi);
});

test('walking out and back refreshes every camp merchant while preserving owned items and world identity', () => {
  const { engine, p, area } = fixture();
  const akara = openShop(engine), charsi = openShop(engine, 'charsi');
  p.gold = 10000; engine.dispatch({ type: 'buy', uid: charsi[0]!.uid });
  const owned = () => structuredClone({ inventory: p.inventory, equipment: p.equipment, belt: p.belt, stash: p.stash, gold: p.gold });
  const snapshot = owned(), destination = sign(area, 2, 1), town = getSurfaceRegion(area, 1)!.spawn;
  engine.dispatch({ type: 'panel', panel: 'vendor' });
  engine.dispatch({ type: 'move', point: destination }); walk(engine, destination, 2);
  engine.dispatch({ type: 'move', point: town }); walk(engine, town, 1);
  assert.equal(engine.state.area, area); assert.deepEqual(owned(), snapshot);
  const refreshedAkara = openShop(engine), refreshedCharsi = openShop(engine, 'charsi');
  assert.notEqual(refreshedAkara, akara); assert.notEqual(refreshedCharsi, charsi);
  assert.notDeepEqual(refreshedAkara.map(i => i.uid), akara.map(i => i.uid));
  assert.equal(openShop(engine), refreshedAkara); assert.deepEqual(owned(), snapshot);
});

for (const via of ['portal', 'waypoint'] as const) test(`${via} return refreshes camp stock without rerolling purchased or equipped items`, () => {
  const { engine, p, area } = fixture();
  const stock = openShop(engine);
  const tome = createItem('tbk', 1, seededRandom(3)); tome.quantity = 3; p.inventory.push(tome);
  access(engine).enterArea(3, undefined, true);
  if (via === 'portal') {
    engine.dispatch({ type: 'portal' });
    const portal = area.objects.find(o => o.kind === 'portal' && o.regionId === 3)!;
    engine.dispatch({ type: 'interact', uid: portal.uid });
  } else {
    const waypoint = area.objects.find(o => o.kind === 'waypoint' && o.regionId === 3)!;
    Object.assign(p, { x: waypoint.x, y: waypoint.y });
    engine.dispatch({ type: 'interact', uid: waypoint.uid }); engine.dispatch({ type: 'travel', areaId: 1 });
  }
  assert.equal(area.def.id, 1);
  const inventory = structuredClone(p.inventory), equipment = structuredClone(p.equipment);
  const refreshed = openShop(engine);
  assert.notEqual(refreshed, stock); assert.equal(openShop(engine), refreshed);
  assert.deepEqual(p.inventory, inventory); assert.deepEqual(p.equipment, equipment);
});

test('shared surface preserves every original region seed, monster UID, level, HP, XP and drop inputs in all difficulties', () => {
  for (const difficulty of ['normal', 'nightmare', 'hell'] as const) {
    const p = createPlayer('sor', '数值测试'); p.difficulty = difficulty;
    const snapshot = structuredClone(p), world = createSurfaceWorld(difficulty, seed, p);
    assert.deepEqual(p, snapshot); assert.deepEqual(world.regions!.map(r => r.def.id), [...SURFACE_IDS]);
    for (const region of world.regions!) {
      const localSeed = (seed ^ region.def.id * 2654435761) >>> 0, local = createArea(region.def.id, difficulty, localSeed, p);
      assert.equal(region.seed, localSeed); assert.equal(region.width, local.width); assert.equal(region.height, local.height);
      assert.deepEqual(region.spawn, { x: local.spawn.x + region.x, y: local.spawn.y + region.y });
      const monsters = world.monsters.filter(m => m.regionId === region.def.id);
      assert.equal(monsters.length, local.monsters.length);
      monsters.forEach((monster, index) => {
        const { regionId, ...translated } = monster;
        translated.x -= region.x; translated.y -= region.y;
        assert.deepEqual(translated, local.monsters[index]); assert.equal(regionId, region.def.id);
      });
      assert.deepEqual(world.objects.filter(o => o.regionId === region.def.id).map(o => o.uid), local.objects.map(o => o.uid));
      assert.deepEqual(world.objects.filter(o => o.regionId === region.def.id).map(o => o.targetArea), local.objects.map(o => o.targetArea));
    }
    assert.deepEqual(createSurfaceWorld(difficulty, seed, p), world);
  }
});

test('Flavie stands on the Blood Moor / Cold Plains connecting road in every difficulty and seed', () => {
  for (const difficulty of ['normal', 'nightmare', 'hell'] as const) for (const mapSeed of [1, seed, 12345]) {
    const p = createPlayer('sor', '边境守卫'); p.difficulty = difficulty;
    const before = structuredClone(p), area = createSurfaceWorld(difficulty, mapSeed, p);
    const guards = area.objects.filter(o => o.npcId === 'flavie');
    assert.equal(guards.length, 1);
    const flavie = guards[0], source = sign(area, 2, 3), back = sign(area, 3, 2);
    const moor = getSurfaceRegion(area, 2)!, plains = getSurfaceRegion(area, 3)!;
    assert.ok(flavie.x >= moor.x + moor.width && flavie.x < plains.x, 'the guard is in the actual gap, not inside either field');
    assert.equal(flavie.x, Math.floor((Math.floor(source.x) + Math.floor(back.x)) / 2) + .5);
    assert.equal(flavie.y, source.y + 1, 'the guard leaves the road centerline clear');
    assert.equal(area.tiles[Math.floor(flavie.y)][Math.floor(flavie.x)], 0);
    assert.equal(area.tiles[Math.floor(source.y)][Math.floor(flavie.x)], 0);
    assert.ok(findPath(area, source, flavie).length);
    assert.ok(findPath(area, back, flavie).length);
    assert.ok(findPath(area, source, back).length);
    assert.equal(flavie.regionId, 2);
    const local = createArea(2, difficulty, (mapSeed ^ 2 * 2654435761) >>> 0, p);
    assert.equal(flavie.uid, local.objects.find(o => o.npcId === 'flavie')!.uid);
    assert.deepEqual(p, before);
  }
});

test('Flavie remains approachable from both fields and walking past preserves the shared world and owned items', () => {
  for (const [source, target] of [[2, 3], [3, 2]]) {
    const { engine, p, area } = fixture(source), from = sign(area, source, target), destination = sign(area, target, source);
    const flavie = area.objects.find(o => o.npcId === 'flavie')!;
    const owned = structuredClone({ inventory: p.inventory, equipment: p.equipment, gold: p.gold });
    Object.assign(p, { x: from.x, y: from.y }); engine.step();
    engine.dispatch({ type: 'interact', uid: flavie.uid });
    for (let frame = 0; frame < 200 && engine.state.panel !== 'vendor'; frame++) engine.step();
    assert.equal(engine.state.panel, 'vendor'); assert.equal(engine.state.npc, 'flavie');
    assert.ok(engine.state.dialogue); assert.equal(engine.state.vendorItems.length, 0);
    assert.ok(Math.hypot(p.x - flavie.x, p.y - flavie.y) <= 2);
    engine.dispatch({ type: 'panel', panel: 'none' });
    engine.dispatch({ type: 'move', point: destination }); walk(engine, destination, target);
    assert.equal(engine.state.area, area); assert.equal(area.objects.find(o => o.npcId === 'flavie'), flavie);
    assert.deepEqual({ inventory: p.inventory, equipment: p.equipment, gold: p.gold }, owned);
  }
});

test('only bidirectionally legal surface roads are reachable; 4/5 and 4/32 stay disconnected', () => {
  const p = createPlayer('pal', '道路测试'), area = createSurfaceWorld('normal', seed, p);
  for (const component of [[1, 2, 3, 4, 17], [5, 6, 7, 26, 27], [32]]) {
    const seen = reachable(area, getSurfaceRegion(area, component[0])!.spawn);
    for (const region of area.regions!) {
      const point = region.spawn, key = Math.floor(point.y) * area.width + Math.floor(point.x);
      assert.equal(seen.has(key), component.includes(region.def.id));
      for (const object of [...area.objects, ...area.monsters].filter(o => o.regionId === region.def.id)) {
        const key = Math.floor(object.y) * area.width + Math.floor(object.x);
        assert.equal(seen.has(key), component.includes(region.def.id), object.uid);
      }
    }
  }
  for (const region of area.regions!) for (const target of getConnections(p, region.def.id)) {
    const source = sign(area, region.def.id, target);
    if (SURFACE_IDS.some(id => id === target)) {
      assert.equal(source.seam, true);
      assert.ok(getConnections(p, target).includes(region.def.id));
      const back = sign(area, target, region.def.id);
      assert.ok(findPath(area, source, back).length);
      assert.ok(containsRegion(region, source)); assert.ok(containsRegion(getSurfaceRegion(area, target)!, back));
    } else assert.notEqual(source.seam, true, 'dungeons still have true transitions');
  }
  assert.equal(findPath(area, getSurfaceRegion(area, 4)!.spawn, getSurfaceRegion(area, 5)!.spawn).length, 0);
  assert.equal(findPath(area, getSurfaceRegion(area, 4)!.spawn, getSurfaceRegion(area, 32)!.spawn).length, 0);
  assert.equal(area.objects.some(o => o.regionId === 4 && o.targetArea === 5), false);
  const locked = createPlayer('pal', '门禁测试'); locked.unlockedActs = 0;
  const lockedWorld = createSurfaceWorld('normal', seed, locked);
  assert.equal(lockedWorld.objects.some(o => o.seam), false);
  assert.equal(findPath(lockedWorld, getSurfaceRegion(lockedWorld, 1)!.spawn, getSurfaceRegion(lockedWorld, 2)!.spawn).length, 0);
});

for (const [source, target] of [[1, 2], [3, 17]]) test(`natural click movement crosses ${source}/${target} both ways with continuous coordinates, one notification and unchanged world identity`, () => {
  const { engine, p, area } = fixture(source), from = { x: p.x, y: p.y }, destination = sign(area, target, source);
  engine.dispatch({ type: 'move', point: { x: destination.x, y: destination.y } });
  assert.equal(walk(engine, destination, target), 1);
  assert.equal(engine.state.messages.filter(m => m.text.startsWith(`${getArea(target).name} ·`)).length, 1);
  assert.deepEqual(area.spawn, getSurfaceRegion(area, target)!.spawn);
  const marker = engine.state.events;
  engine.dispatch({ type: 'move', point: from }); assert.equal(walk(engine, from, source), 1);
  assert.equal(engine.state.events, marker, 'seams cannot reset the event buffer');
  for (const id of SURFACE_IDS) assert.equal(access(engine).areas.get(id), area);
  const identity = area.objects[0], revealed = area.revealed;
  access(engine).enterArea(target, undefined, true);
  assert.equal(engine.state.area, area); assert.equal(area.objects[0], identity); assert.equal(area.revealed, revealed);
  assert.deepEqual({ x: p.x, y: p.y }, getSurfaceRegion(area, target)!.spawn);
});

test('seam interaction and nearby travel walk to the reciprocal sign rather than teleporting', () => {
  const { engine, p, area } = fixture(1), source = sign(area, 1, 2), back = sign(area, 2, 1);
  const initial = { x: p.x, y: p.y };
  engine.dispatch({ type: 'interact', uid: source.uid });
  assert.deepEqual({ x: p.x, y: p.y }, initial); assert.equal(area.def.id, 1);
  assert.equal(walk(engine, back, 2), 1);
  const before = { x: p.x, y: p.y };
  engine.dispatch({ type: 'travel', areaId: 1 });
  assert.deepEqual({ x: p.x, y: p.y }, before); assert.equal(area.def.id, 2);
  assert.equal(walk(engine, source, 1), 1);
});

test('held steering and Fire Bolt keep full speed, cooldown, aim and the same projectile through a region boundary', () => {
  const { engine, p, area } = fixture(3), region = getSurfaceRegion(area, 3)!;
  p.x = region.x + Math.floor(region.width / 2) + .5; p.y = region.y + region.height - 1.1;
  const start = { x: p.x, y: p.y }, aim = { x: p.x, y: p.y + 10 };
  const effect={x:p.x,y:p.y,kind:'fire' as const,life:100,maxLife:100,radius:1};
  const summon={uid:'seam-summon',name:'同行召唤物',x:p.x,y:p.y,life:30,maxLife:30,min:1,max:2,cooldown:0,duration:100,color:'#fff'};
  engine.state.effects.push(effect);engine.state.summons.push(summon);
  engine.setControl({ move: { x: 0, y: 1 }, right: true, aim }); engine.step();
  const projectile = engine.state.projectiles[0], events = engine.state.events;
  assert.ok(projectile); assert.equal(area.def.id, 3);
  for (let frame = 2; frame <= 20; frame++) {
    engine.step(); assert.ok(Math.abs(p.y - (start.y + frame * 6 / 25)) < 1e-9);
    assert.equal(p.x, start.x); assert.equal(engine.state.area, area);
    if (frame === 18) { assert.equal(area.def.id, 17); assert.ok(engine.state.projectiles.includes(projectile)); }
  }
  assert.equal(area.def.id, 17); assert.equal(engine.control.right, true); assert.deepEqual(engine.control.aim, aim);
  assert.equal(engine.state.events, events);assert.ok(engine.state.effects.includes(effect));assert.equal(effect.life,80);
  assert.ok(engine.state.summons.includes(summon));assert.equal(summon.duration,80);
  assert.deepEqual(engine.state.events.filter(e => e.actor === 'player' && e.kind === 'cast').map(e => e.tick), [1, 14]);
});

test('Blood Raven kill credit follows source region, retains identity checks and never credits an outsider', () => {
  const { engine, p, area } = fixture(3, false), raven = area.monsters.find(m => m.code === 'bloodraven')!;
  assert.equal(raven.regionId, 17); assert.equal(area.def.id, 3);
  const outsider = { ...structuredClone(raven), uid: 'foreign-raven', life: 0, dead: true };
  assert.deepEqual(onKill(p, area, outsider), []); assert.notEqual(p.quests[questKey(p, 'a1q2')], 2);
  raven.life = 0; access(engine).kill(raven);
  assert.equal(p.quests[questKey(p, 'a1q2')], 2); assert.equal(area.def.id, 3);
  const wrongRegion = { ...structuredClone(raven), uid: 'wrong-region', regionId: 3 };
  area.monsters.push(wrongRegion); p.quests[questKey(p, 'a1q2')] = 1;
  onKill(p, area, wrongRegion); assert.equal(p.quests[questKey(p, 'a1q2')], 1);
});

test('monster loot consumes original RNG and revival rewards remain once even after the player changes surface region', () => {
  const { engine, p, area } = fixture(17, false), monster = area.monsters.find(m => m.regionId === 2 && m.code === 'fallen1')!;
  const reference = seededRandom(17), expected = rollLoot(monster, reference, p.difficulty, engine.state.stats!.magicFind);
  for (const _ of expected) { reference(); reference(); }
  const rng = seededRandom(17);let calls=0;access(engine).rng=()=>{calls++;return rng();};monster.life = 0; access(engine).kill(monster);
  const omitUid = (item: typeof expected[number]) => { const { uid, ...rest } = item; return rest; };
  assert.deepEqual(area.drops.map(d => omitUid(d.item)), expected.map(omitUid)); assert.equal(rng(), reference());
  const xp = p.experience, drops = area.drops.slice();
  access(engine).enterArea(4, undefined, true);
  monster.dead = false; monster.life = monster.maxLife; monster.life = 0;
  const before=calls;access(engine).kill(monster);
  assert.equal(p.experience, xp); assert.deepEqual(area.drops, drops); assert.equal(area.def.id, 4);
  assert.equal(calls,before,'repeat kill consumes no additional loot RNG');
});

test('Underground Passage keeps bidirectional target-region return entrances between 4 and 5', () => {
  const { engine, p, area: surface } = fixture(4);
  const traverse = (target: number) => {
    const current = engine.state.area!, sourceId = current.def.id;
    const exit = current.objects.find(o => o.kind === 'exit' && o.targetArea === target && (!current.regions || o.regionId === sourceId))!;
    assert.ok(exit); assert.notEqual(exit.seam, true);
    engine.dispatch({ type: 'interact', uid: exit.uid });
    for (let frame = 0; frame < 600 && engine.state.area!.def.id !== target; frame++) engine.step();
    assert.equal(engine.state.area!.def.id, target);
    engine.state.area!.monsters = [];
    const area = engine.state.area!, entrance = area.objects.find(o => o.kind === 'exit' && o.targetArea === sourceId && (!area.regions || o.regionId === target))!;
    assert.ok(Math.hypot(p.x - entrance.x, p.y - entrance.y) < 4);
    if (area.regions) assert.ok(containsRegion(getSurfaceRegion(area, target)!, p));
    assert.deepEqual(engine.state.projectiles, []);
    return area;
  };
  const tunnel = traverse(10); assert.notEqual(tunnel, surface);
  assert.equal(traverse(5), surface); assert.equal(traverse(10), tunnel); assert.equal(traverse(4), surface);
});

for (const source of [2, 17, 27]) test(`portal from region ${source} uses town.spawn and returns to the exact global point, clearing only real transitions`, () => {
  const { engine, p, area } = fixture(source), point = { x: p.x, y: p.y };
  const tome=createItem('tbk',1,seededRandom(3));tome.quantity=3;p.inventory.push(tome);const quantity=tome.quantity;
  engine.dispatch({ type: 'portal' }); assert.equal(tome.quantity, quantity - 1); assert.equal(area.def.id, source);
  const toTown = area.objects.find(o => o.kind === 'portal' && o.regionId === source)!;
  const toField = area.objects.find(o => o.kind === 'portal' && o.regionId === 1)!;
  const townSpawn = getSurfaceRegion(area, 1)!.spawn;
  assert.deepEqual({ x: toField.x, y: toField.y }, { x: townSpawn.x + 2, y: townSpawn.y });
  assert.equal(toField.targetArea, source); assert.equal(toTown.targetArea, 1);
  engine.state.projectiles.push({ uid: 'reset-on-portal', x: p.x, y: p.y, dx: 0, dy: 0, owner: 'player', min: 1, max: 1, element: 'fire', life: 50, radius: .3, skillId: 36 });
  engine.dispatch({ type: 'interact', uid: toTown.uid });
  assert.equal(area.def.id, 1); assert.equal(engine.state.area, area); assert.deepEqual(engine.state.projectiles, []);
  assert.deepEqual({ x: p.x, y: p.y }, townSpawn);
  engine.dispatch({ type: 'interact', uid: toField.uid });
  assert.equal(area.def.id, source); assert.deepEqual({ x: p.x, y: p.y }, point);
  assert.equal(area.objects.some(o => o.kind === 'portal'), false);
});

test('pending portal return stops the frame after a real transition even when source/destination share world identity', () => {
  const {engine,p,area}=fixture(27),tome=createItem('tbk',1,seededRandom(3));tome.quantity=2;p.inventory.push(tome);
  engine.dispatch({type:'portal'});
  const source=area.objects.find(o=>o.kind==='portal' && o.regionId===27)!,back=area.objects.find(o=>o.kind==='portal' && o.regionId===1)!;
  engine.dispatch({type:'interact',uid:source.uid});assert.equal(area.def.id,1);
  const townWaypoint=area.objects.find(o=>o.kind==='waypoint' && o.regionId===1)!;
  engine.dispatch({type:'move',point:{x:townWaypoint.x,y:townWaypoint.y}});walk(engine,townWaypoint,1);
  assert.ok(Math.hypot(p.x-back.x,p.y-back.y)>2);
  engine.setControl({right:true,aim:{x:getSurfaceRegion(area,27)!.spawn.x+5,y:getSurfaceRegion(area,27)!.spawn.y}});
  engine.dispatch({type:'interact',uid:back.uid});
  for (let frame=0;frame<50 && area.def.id===1;frame++) engine.step();
  assert.equal(area.def.id,27);assert.equal(engine.state.area,area);
  assert.deepEqual(engine.state.projectiles,[]);assert.equal(engine.state.events.length,0);
  assert.equal(engine.state.target,null);assert.equal(engine.state.moving,false);
  engine.step();assert.equal(engine.state.events[0].kind,'cast','held casting may resume on the next frame, not the transition frame');
});

test('waypoint activation uses object region and travel lands at the destination spawn in the same cached world', () => {
  const { engine, p, area } = fixture(3), waypoint = area.objects.find(o => o.kind === 'waypoint' && o.regionId === 3)!;
  Object.assign(p, waypoint); area.def = getArea(2); // Adjacent/stale facade must not credit the wrong source.
  engine.dispatch({ type: 'interact', uid: waypoint.uid }); assert.ok(p.waypoints.includes(3)); assert.equal(p.waypoints.includes(2), false);
  engine.state.projectiles.push({ uid: 'wp-projectile', x: p.x, y: p.y, dx: 0, dy: 0, owner: 'player', min: 1, max: 1, element: 'fire', life: 50, radius: .3, skillId: 36 });
  engine.dispatch({ type: 'travel', areaId: 1 }); assert.equal(area.def.id, 1); assert.equal(engine.state.area, area);
  assert.deepEqual({ x: p.x, y: p.y }, getSurfaceRegion(area, 1)!.spawn); assert.deepEqual(engine.state.projectiles, []);
  const townWaypoint=area.objects.find(o=>o.kind==='waypoint' && o.regionId===1)!;
  engine.dispatch({type:'move',point:{x:townWaypoint.x,y:townWaypoint.y}});walk(engine,townWaypoint,1);
  engine.dispatch({ type: 'travel', areaId: 3 }); assert.equal(area.def.id, 3);
  assert.deepEqual({ x: p.x, y: p.y }, getSurfaceRegion(area, 3)!.spawn);
  engine.dispatch({ type: 'travel', areaId: 32 }); assert.equal(area.def.id, 3, 'undiscovered waypoint remains locked');
});

test('chest item level comes from the source object region, not the current shared world facade', () => {
  const { engine, p, area } = fixture(3), chest = area.objects.find(o => o.kind === 'chest' && o.regionId === 27)!;
  Object.assign(p, { x: chest.x, y: chest.y }); access(engine).rng = () => .5;
  engine.dispatch({ type: 'interact', uid: chest.uid });
  assert.equal(area.def.id, 3); assert.equal(area.drops.at(-1)!.item.ilvl, getArea(27).levels[0]);
  assert.equal(chest.used, true);
});

test('surface corpse remains globally visible and recoverable after respawn from a different active region', () => {
  const { engine, p, area } = fixture(3), weapon = p.equipment.weapon!, point = { x: p.x, y: p.y };
  p.life = 0; access(engine).die(); assert.equal(p.corpse!.areaId, 3); assert.equal(p.corpse!.equipment.weapon, weapon);
  const corpse = area.objects.find(o => o.kind === 'corpse')!; assert.equal(corpse.regionId, 3);
  engine.dispatch({ type: 'respawn' }); assert.equal(area.def.id, 1); assert.equal(engine.state.area, area);
  assert.ok(area.objects.includes(corpse)); assert.deepEqual({ x: p.corpse!.x, y: p.corpse!.y }, point);
  // Recovery uses corpse membership/global distance, not area.def: stand just over a shared boundary.
  Object.assign(p, point); area.def = getArea(17);
  engine.dispatch({ type: 'interact', uid: corpse.uid });
  assert.equal(p.corpse, undefined); assert.equal(p.equipment.weapon, weapon); assert.equal(area.objects.some(o => o.kind === 'corpse'), false);
});

for (const global of [false, true]) test(`version-1 ${global ? 'global' : 'local'} surface corpse loads at its proper global location without altering equipment/schema/stored record`, async () => {
  const p = createPlayer('sor', '旧尸体'); createStartingItems(p);
  const local = createArea(17, 'normal', (seed ^ 17 * 2654435761) >>> 0, p), region = getSurfaceRegion(createSurfaceWorld('normal', seed, p), 17)!;
  const equipment = p.equipment;
  p.corpse = { areaId: 17, x: local.spawn.x + (global ? region.x : 0), y: local.spawn.y + (global ? region.y : 0), equipment }; p.equipment = {};
  const record: SaveRecord = { id: `corpse-${global}`, version: 1, player: p, seed, timestamp: 1 }, snapshot = structuredClone(record);
  const store = { list: async () => [structuredClone(record)], get: async () => structuredClone(record), put: async () => {}, delete: async () => {}, importLegacy: async () => {} };
  const engine = new Engine(store); await engine.initialize(); await engine.load(record.id);
  const loaded = engine.state.player!, area = engine.state.area!;
  assert.equal(area.def.id, 1); assert.equal(loaded.corpse!.areaId, 17);
  assert.deepEqual({ x: loaded.corpse!.x, y: loaded.corpse!.y }, region.spawn);
  assert.deepEqual(loaded.corpse!.equipment, equipment); assert.deepEqual(record, snapshot); assert.equal(record.version, 1);
  const corpse = area.objects.find(o => o.kind === 'corpse')!; assert.deepEqual({ x: corpse.x, y: corpse.y }, region.spawn);
  Object.assign(loaded, region.spawn); engine.step(); engine.dispatch({ type: 'interact', uid: corpse.uid });
  assert.equal(loaded.corpse, undefined); assert.deepEqual(loaded.equipment, equipment);
});

test('camp bbox blocks enemy pursuit and all damage including projectiles, with unchanged damage immediately outside', () => {
  const { engine, p, area } = fixture(1, false), town = getSurfaceRegion(area, 1)!, enemy = area.monsters.find(m => m.regionId === 2)!;
  const stats = structuredClone(enemy); area.monsters = [enemy];
  p.x = town.x + town.width - .2; p.y = town.y + Math.floor(town.height / 2) + .5;
  Object.assign(enemy, { x: town.x + town.width + .1, y: p.y, cooldown: 10000 });
  assert.equal(isTownPoint(area, p), true);
  for (let frame = 0; frame < 100; frame++) { access(engine).moveToward(enemy, p, 2.2); assert.equal(isTownPoint(area, enemy), false); }
  const life = p.life; let calls = 0; access(engine).rng = () => { calls++; return 0; };
  access(engine).damagePlayer(enemy, stats.maxDamage, 'physical'); access(engine).damagePlayer(enemy, stats.maxDamage, 'fire');
  assert.equal(p.life, life); assert.equal(calls, 0, 'camp immunity does not consume combat rolls');
  engine.state.projectiles.push({ uid: 'hostile-camp-shot', ownerUid: enemy.uid, x: p.x, y: p.y, dx: 0, dy: 0, owner: 'monster', min: stats.maxDamage, max: stats.maxDamage, element: 'fire', life: 20, radius: .3, skillId: 0 });
  engine.step(); assert.equal(p.life, life); assert.equal(engine.state.projectiles.length, 0);
  p.x = town.x + town.width + .2; assert.equal(isTownPoint(area, p), false);
  access(engine).damagePlayer(enemy, stats.maxDamage, 'physical'); assert.equal(p.life, life - stats.maxDamage);
  engine.state.projectiles.push({uid:'hostile-outside-shot',ownerUid:enemy.uid,x:p.x,y:p.y,dx:0,dy:0,owner:'monster',min:stats.maxDamage,max:stats.maxDamage,element:'fire',life:20,radius:.3,skillId:0});
  engine.step();assert.equal(p.life,life-2*stats.maxDamage,'the same ranged damage resumes immediately outside the camp bbox');
  for (const key of ['level', 'maxLife', 'minDamage', 'maxDamage', 'experience', 'resists', 'defense', 'attackRating'] as const) assert.deepEqual(enemy[key], stats[key]);
  assert.equal(surfaceRegionAt(area, p)!.def.id, 1, 'bbox immunity must not extend into a road gap still labelled town');
});
