import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createArea } from '../src/world';
import { createPlayer, SHRINES } from '../src/rules';
import { Terrain, type ViewBounds } from '../src/r3d/terrain';
import { Overlay } from '../src/r3d/overlay';
import { Engine } from '../src/engine';
import type { AreaState, Point } from '../src/types';

function meshes(terrain: Terrain, name?: string): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  terrain.group.traverse(node => { if (node instanceof THREE.Mesh && (!name || node.name === name)) result.push(node); });
  return result;
}

function load(terrain: Terrain, player = terrain.area.spawn, view: ViewBounds = { minX: 0, minY: 0, maxX: terrain.area.width, maxY: terrain.area.height }): void {
  const internals = terrain as unknown as { wanted: Set<string>; chunks: Map<string, unknown>; props: Map<string, unknown> };
  for (let i = 0; i < 2000; i++) {
    terrain.update(player, .04, i * .04, view);
    assert.ok(terrain.metrics.committed <= 1, 'at most one chunk is committed per update');
    const pendingProps = terrain.area.objects.some(o => o.kind !== 'npc' && o.kind !== 'corpse' && Math.hypot(o.x - player.x, o.y - player.y) <= 30 && !internals.props.has(o.uid));
    if (terrain.visibleGroundReady && [...internals.wanted].every(key => internals.chunks.has(key)) && !pendingProps) return;
  }
  assert.fail('bounded work must eventually fill the required viewport and one prefetch ring');
}

function fixture(width = 62, height = 50, id = 7, town = false): AreaState {
  return {
    def: { id, name: '固定渲染地图', english: 'Render fixture', act: 1, town, waypoint: false, levels: [1, 1, 1], connections: [], style: town ? 'town' : id === 7 ? 'grass' : 'cave', monsters: [] },
    width, height, seed: 12345 + id, spawn: { x: 17, y: 12 },
    tiles: Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => Number(x === 0 || y === 0 || x === width - 1 || y === height - 1 || (town ? x >= 5 && x < 10 && y >= 5 && y < 10 : x >= 8 && x < 25 && y >= 8 && y < 26)))),
    revealed: [], monsters: [], drops: [], objects: [],
  };
}

function surfaceFixture(): AreaState {
  const world = fixture(334, 162, 1, true); world.tiles = Array.from({ length: 162 }, () => Array(334).fill(1)); world.regions = [];
  for (let i = 0; i < 11; i++) {
    const source = fixture(62, 50, i === 0 ? 1 : i === 1 ? 7 : 8 + i, i === 0), x = (i % 4) * 82, y = Math.floor(i / 4) * 56;
    world.regions.push({ def: source.def, x, y, width: source.width, height: source.height, spawn: { x: x + 17, y: y + 12 }, seed: source.seed });
    for (let row = 0; row < source.height; row++) for (let col = 0; col < source.width; col++) world.tiles[y + row][x + col] = source.tiles[row][col];
  }
  for (let x = 0; x < world.width; x++) world.tiles[27][x] = 0;
  return world;
}

const nearView = (p: Point): ViewBounds => ({ minX: p.x - 12, minY: p.y - 12, maxX: p.x + 12, maxY: p.y + 12 });

test('outdoor scenery differs in geometry rather than only ground color', () => {
  const texture = new THREE.Texture(), signatures = new Set<string>();
  let sourceDisposals = 0;
  texture.addEventListener('dispose', () => sourceDisposals++);
  for (const id of [2, 3, 4, 5, 6, 7, 17, 27]) {
    const area = createArea(id, 'normal', 12345, createPlayer('sor', '地形验证'));
    const before = JSON.stringify({ tiles: area.tiles, monsters: area.monsters, objects: area.objects });
    const terrain = new Terrain(area, () => texture);
    assert.equal(meshes(terrain).length, 0); load(terrain);
    const instances: string[] = [];
    terrain.group.traverse(node => {
      if (node instanceof THREE.InstancedMesh) instances.push(`${node.count}:${node.geometry.getAttribute('position').count}`);
    });
    signatures.add(instances.sort().join(','));
    assert.equal(JSON.stringify({ tiles: area.tiles, monsters: area.monsters, objects: area.objects }), before, 'rendering cannot mutate gameplay or consume its RNG');
    terrain.dispose();
  }
  assert.equal(signatures.size, 8);
  assert.equal(sourceDisposals, 0, 'terrain owns texture clones, not renderer cache textures');
  texture.dispose();
});

test('shared surface roads have continuous ground UVs and visible solid banks without changing gameplay', () => {
  const area = surfaceFixture();
  const before = JSON.stringify({ tiles: area.tiles, monsters: area.monsters, objects: area.objects });
  const texture = new THREE.Texture(), terrain = new Terrain(area, () => texture);
  load(terrain, area.spawn, nearView(area.spawn));
  const ground = [...meshes(terrain, 'underlay'), ...meshes(terrain, 'roads')] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>[];
  assert.ok(ground.length >= 2, 'underlay and roads are real bounded ground meshes');
  assert.ok(ground.every(mesh => mesh.material.map && mesh.material.map !== texture && mesh.material.map.wrapS === THREE.RepeatWrapping));
  for (const roads of meshes(terrain, 'roads')) {
    const positions = roads.geometry.getAttribute('position'), uvs = roads.geometry.getAttribute('uv'), normals = roads.geometry.getAttribute('normal');
    assert.ok(positions.count > 0);
    for (let i = 0; i < positions.count; i++) {
      assert.equal(positions.getY(i), 0); assert.ok(normals.getY(i) > .999);
      assert.equal(uvs.getX(i), positions.getX(i) / 4); assert.equal(uvs.getY(i), positions.getZ(i) / 4);
    }
  }
  const banks = meshes(terrain, 'banks') as THREE.InstancedMesh[];
  assert.ok(banks.length > 0);
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  for (const bank of banks) for (let i = 0; i < bank.count; i++) {
    bank.getMatrixAt(i, matrix); point.setFromMatrixPosition(matrix);
    const x = Math.floor(point.x), y = Math.floor(point.z);
    assert.notEqual(area.tiles[y][x], 0);
    assert.ok([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => area.tiles[y + dy]?.[x + dx] === 0));
  }
  assert.equal(JSON.stringify({ tiles: area.tiles, monsters: area.monsters, objects: area.objects }), before);
  let sourceDisposals = 0, cloneDisposals = 0;
  texture.addEventListener('dispose', () => sourceDisposals++);
  for (const map of new Set(ground.map(mesh => mesh.material.map!))) map.addEventListener('dispose', () => cloneDisposals++);
  terrain.dispose();
  assert.equal(sourceDisposals, 0); assert.equal(cloneDisposals, 2, 'shared ground maps are released once by the area owner');
  texture.dispose();
});

test('raised rocky banks leave all walkable floor corners on the gameplay plane', () => {
  const area = fixture();
  const texture = new THREE.Texture(), terrain = new Terrain(area, () => texture); load(terrain);
  let raised = false;
  for (const ground of meshes(terrain, 'ground')) {
    const positions = ground.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const x = Math.floor(positions.getX(i)), y = Math.floor(positions.getZ(i)), height = positions.getY(i);
      raised ||= height > .1;
      if ([[x, y], [x - 1, y], [x, y - 1], [x - 1, y - 1]].some(([tx, ty]) => area.tiles[ty]?.[tx] === 0)) assert.ok(Math.abs(height) < 1e-6);
    }
  }
  assert.equal(raised, true);
  terrain.dispose(); texture.dispose();
});

test('55k surface constructor is empty, moving views unload chunks and wide views are not clipped to 5x5', () => {
  const world = surfaceFixture(), texture = new THREE.Texture(); let requests = 0;
  const terrain = new Terrain(world, () => { requests++; return texture; });
  assert.equal(world.width * world.height, 54108); assert.equal(meshes(terrain).length, 0); assert.equal(requests, 0); assert.equal(terrain.visibleGroundReady, false);
  load(terrain, world.spawn, nearView(world.spawn));
  assert.ok(terrain.chunkCount < 50); assert.ok(meshes(terrain, 'ground').every(mesh => mesh.parent!.position.x < 82));
  const oldChunks = terrain.group.children.filter(n => n.name.startsWith('chunk-'));
  let instancesDisposed = 0, ownedDisposed = 0, sharedDisposed = 0;
  const shared = new Set<THREE.BufferGeometry>();
  for (const chunk of oldChunks) chunk.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    if (node instanceof THREE.InstancedMesh) { node.addEventListener('dispose', () => instancesDisposed++); shared.add(node.geometry); }
    else node.geometry.addEventListener('dispose', () => ownedDisposed++);
  });
  for (const geometry of shared) geometry.addEventListener('dispose', () => sharedDisposed++);
  const far = { x: 285, y: 135 };
  assert.equal(terrain.isReadyFor(far, nearView(far)), false);
  load(terrain, far, nearView(far));
  assert.ok(oldChunks.every(chunk => chunk.parent === null)); assert.ok(instancesDisposed > 0); assert.ok(ownedDisposed > 0); assert.equal(sharedDisposed, 0);
  assert.ok(meshes(terrain, 'ground').some(mesh => mesh.parent!.position.x === 246));
  const wide = { minX: 35, minY: 60, maxX: 305, maxY: 100 }, p = { x: 170, y: 80 };
  load(terrain, p, wide);
  const chunks = terrain.group.children.filter(n => n.name.startsWith('chunk-') && n.visible);
  for (let y = 64; y <= 96; y += 16) for (let x = 48; x <= 304; x += 16) assert.ok(chunks.some(chunk => { const b = chunk.userData.bounds as ViewBounds; return x >= b.minX && x < b.maxX && y >= b.minY && y < b.maxY; }));
  assert.ok(chunks.length > 25);
  terrain.dispose(); terrain.dispose(); assert.equal(terrain.group.children.length, 0); assert.equal(terrain.flames.length, 0); assert.ok(sharedDisposed > 0);
  texture.dispose();
});

test('shrine obelisks use code-specific glow colors, differ from waypoint/portal geometry, and go dark while charging',()=>{
  const area=createArea(2,'normal',23,createPlayer('sor','神龛外观'));
  area.objects=[...SHRINES.map((s,i)=>({uid:`visual-shrine-${s.code}`,kind:'shrine' as const,name:s.name,shrineCode:s.code,x:5+i%10,y:5+Math.floor(i/10)*3})),
    {uid:'visual-waypoint',kind:'waypoint',name:'传送点',x:5,y:8},{uid:'visual-portal',kind:'portal',name:'传送门',x:7,y:8}];
  const before=structuredClone(area.objects),texture=new THREE.Texture(),terrain=new Terrain(area,()=>texture); load(terrain,{x:10,y:5});
  const props=terrain.group.children.filter(n=>n.userData.worldObject) as THREE.Group[];
  for(const shrine of SHRINES){const group=props.find(g=>g.userData.shrineCode===shrine.code)!; assert.ok(group);
    const glow=group.children.find(n=>n instanceof THREE.Mesh&&n.material instanceof THREE.MeshBasicMaterial) as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
    assert.ok(glow); assert.equal(glow.material.color.getHexString(),shrine.color.slice(1)); assert.equal(glow.visible,true);
    const source=area.objects.find(o=>o.uid===group.userData.worldObject)!; source.used=true; terrain.update({x:10,y:5},.04,1); assert.equal(glow.visible,false);
    source.used=false; terrain.update({x:10,y:5},.04,2); assert.equal(glow.visible,true);
    assert.ok(!group.children.some(n=>n instanceof THREE.Mesh&&n.geometry.type==='SphereGeometry'));
  }
  const obelisk=props[0].children[0] as THREE.Mesh,waypoint=props.find(g=>g.userData.kind==='waypoint')!.children[0] as THREE.Mesh;
  assert.notEqual(obelisk.geometry.getAttribute('position').count,waypoint.geometry.getAttribute('position').count);
  assert.deepEqual(area.objects.map(o=>({...o,used:undefined})),before.map(o=>({...o,used:undefined}))); terrain.dispose(); texture.dispose();
});

test('halo height, normal, UV and stable tile colors survive unloading with original region coordinates', () => {
  const world = surfaceFixture(), texture = new THREE.Texture(), terrain = new Terrain(world, () => texture), region = world.regions![1], p = region.spawn;
  load(terrain, p, nearView(p));
  const sample = () => {
    const vertices = new Map<string, number[]>(), instances = new Map<string, number[]>(); let sharedEdges = 0;
    for (const mesh of meshes(terrain, 'ground').filter(mesh => mesh.parent!.position.x === region.x && mesh.parent!.position.z === region.y)) {
      const position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal'), color = mesh.geometry.getAttribute('color'), uv = mesh.geometry.getAttribute('uv');
      for (let i = 0; i < position.count; i++) {
        const key = `${position.getX(i)},${position.getZ(i)}`, values = [position.getY(i), normal.getX(i), normal.getY(i), normal.getZ(i), color.getX(i), color.getY(i), color.getZ(i), uv.getX(i), uv.getY(i)];
        if (vertices.has(key)) { assert.deepEqual(values, vertices.get(key), 'adjacent chunk samples agree exactly'); sharedEdges++; }
        vertices.set(key, values);
      }
    }
    const matrix = new THREE.Matrix4(), color = new THREE.Color();
    for (const mesh of meshes(terrain).filter(mesh => mesh instanceof THREE.InstancedMesh && mesh.parent!.position.x === region.x && mesh.parent!.position.z === region.y) as THREE.InstancedMesh[]) {
      for (let i = 0; i < mesh.count; i++) {
        if (!mesh.instanceColor) continue;
        mesh.getMatrixAt(i, matrix); mesh.getColorAt(i, color);
        instances.set(`${mesh.name}:${matrix.elements[12]},${matrix.elements[14]}`, color.toArray());
      }
    }
    assert.ok(sharedEdges > 0); assert.ok(instances.size > 0);
    return { vertices, instances };
  };
  const before = sample(), reference = new THREE.PlaneGeometry(region.width, region.height, region.width * 2, region.height * 2).rotateX(-Math.PI / 2).translate(region.width / 2, 0, region.height / 2);
  const positions = reference.getAttribute('position');
  // Feed the original full plane with the sampled heights, then let THREE calculate its normals independently.
  assert.equal(before.vertices.size, positions.count);
  for (let i = 0; i < positions.count; i++) positions.setY(i, before.vertices.get(`${positions.getX(i)},${positions.getZ(i)}`)![0]);
  reference.computeVertexNormals();
  const normals = reference.getAttribute('normal');
  for (let i = 0; i < positions.count; i++) {
    const value = before.vertices.get(`${positions.getX(i)},${positions.getZ(i)}`)!;
    for (const [j, component] of [normals.getX(i), normals.getY(i), normals.getZ(i)].entries()) assert.ok(Math.abs(component - value[j + 1]) < 1e-6, 'halo normal matches an unsplit full-plane normal');
  }
  load(terrain, { x: 285, y: 135 }, nearView({ x: 285, y: 135 })); load(terrain, p, nearView(p));
  assert.deepEqual(sample(), before, 'reloading neither reseeds nor renumbers tile color hashes');
  reference.dispose(); terrain.dispose(); texture.dispose();
});

test('props are UID-owned, prioritize 13 tiles, synchronize replacements and do not accumulate flames or town roofs', () => {
  const area = surfaceFixture(), p = area.spawn;
  area.objects = [
    { uid: 'far', kind: 'chest', name: '30 tile chest', x: p.x + 28, y: p.y },
    { uid: 'near', kind: 'shrine', shrineCode: 1, name: 'shrine', x: p.x + 2, y: p.y },
    { uid: 'exit', kind: 'exit', name: 'exit', x: p.x + 3, y: p.y },
    { uid: 'outside', kind: 'chest', name: 'outside', x: p.x + 31, y: p.y },
    { uid: 'npc', kind: 'npc', name: 'actor-owned NPC', x: p.x, y: p.y },
    { uid: 'corpse', kind: 'corpse', name: 'actor-owned corpse', x: p.x, y: p.y },
  ];
  const texture = new THREE.Texture(), terrain = new Terrain(area, () => texture);
  terrain.update(p, .04, 0, nearView(p));
  assert.equal(terrain.group.children.find(n => n.userData.worldObject)?.userData.worldObject, 'near');
  load(terrain, p, nearView(p));
  const props = () => terrain.group.children.filter(n => n.userData.worldObject);
  assert.deepEqual(props().map(n => n.userData.worldObject).sort(), ['exit', 'far', 'near']);
  const shrine = props().find(n => n.userData.worldObject === 'near')!, glow = shrine.children.find(n => n instanceof THREE.Mesh && n.material instanceof THREE.MeshBasicMaterial)!;
  area.objects = area.objects.map(o => o.uid === 'near' ? { ...o, used: true, x: p.x + 5 } : o);
  terrain.update(p, .04, 1, nearView(p)); assert.equal(glow.visible, false); assert.equal(shrine.position.x, p.x + 5);
  const lid = (props().find(n => n.userData.worldObject === 'far') as THREE.Group).children.find(n => n instanceof THREE.Group)!;
  area.objects.find(o => o.uid === 'far')!.used = true; terrain.update(p, .04, 2, nearView(p)); assert.ok(lid.rotation.x < 0);
  area.objects.push({ uid: 'blue', kind: 'portal', name: 'blue portal', x: p.x + 1, y: p.y + 1 });
  load(terrain, p, nearView(p)); assert.ok(props().some(n => n.userData.worldObject === 'blue'));
  const roof = meshes(terrain, 'building')[0]; assert.ok(roof); assert.equal(meshes(terrain, 'building').length, 1);
  assert.equal(terrain.flames.length, 3, 'one campfire and two exit flames');
  for (let i = 0; i < 20; i++) {
    const far = { x: 285, y: 135 }; load(terrain, far, nearView(far)); assert.equal(terrain.flames.length, 0); assert.equal(props().length, 0);
    load(terrain, p, nearView(p)); assert.equal(terrain.flames.length, 3); assert.equal(meshes(terrain, 'building').length, 1); assert.equal(meshes(terrain, 'building')[0], roof);
  }
  area.objects = area.objects.filter(o => o.uid !== 'exit' && o.uid !== 'blue'); terrain.update(p, .04, 3, nearView(p));
  assert.equal(terrain.flames.length, 1); assert.ok(!props().some(n => ['exit', 'blue'].includes(n.userData.worldObject)));
  terrain.dispose(); assert.equal(terrain.flames.length, 0); texture.dispose();
});

test('destroying an unfinished terrain cancels row jobs and releases partial instance buffers once', t => {
  const world = surfaceFixture(), texture = new THREE.Texture(), terrain = new Terrain(world, () => texture);
  let clock = 0; t.mock.method(performance, 'now', () => clock += .5);
  terrain.update(world.spawn, .04, 0, nearView(world.spawn)); t.mock.restoreAll();
  const internals = terrain as unknown as { task?: { chunk: { group: THREE.Group }; rows: Generator<void> } };
  // Advance individual scheduled row units, without committing the unfinished group, to exercise cancellation deterministically.
  assert.ok(internals.task);
  let rowUnits = 0;
  while (!internals.task!.chunk.group.getObjectByProperty('isInstancedMesh', true)) { assert.equal(internals.task!.rows.next().done, false); rowUnits++; }
  assert.ok(rowUnits > 30, 'geometry work is split into row units rather than a synchronous chunk constructor');
  let disposals = 0;
  internals.task!.chunk.group.traverse(n => { if (n instanceof THREE.InstancedMesh) n.addEventListener('dispose', () => disposals++); });
  const far = { x: 285, y: 135 }; terrain.update(far, .04, 1, nearView(far));
  assert.ok(terrain.metrics.cancelled > 0); assert.ok(disposals > 0);
  terrain.dispose(); assert.equal(terrain.visibleGroundReady, false); assert.equal(terrain.group.children.length, 0);
  const count = disposals; terrain.update(world.spawn, .04, 2); terrain.dispose(); assert.equal(disposals, count); texture.dispose();
});

function playerBarFixture() {
  const engine = new Engine(); engine.dispatch({ type: 'new', classId: 'sor', name: '头顶状态条' });
  const state = engine.state;
  state.area!.objects = []; state.area!.monsters = []; state.area!.drops = [];
  const fills: { color: string; x: number; y: number; width: number; height: number }[] = [];
  const transforms: number[][] = [];
  const ctx = {
    fillStyle: '', save() {}, restore() {}, clearRect() {}, strokeRect() {},
    setTransform(...values: number[]) { transforms.push(values); },
    fillRect(x: number, y: number, width: number, height: number) { fills.push({ color: this.fillStyle, x, y, width, height }); },
  };
  const canvas = { width: 400, height: 300 };
  const overlay: Overlay = Object.assign(Object.create(Overlay.prototype) as Overlay, {
    ctx, canvas, width: 400, height: 300, dpr: 1, lastTick: -Infinity, destroyed: false,
    refreshMap() {}, minimap() {}, automap() {}, titleScene() {},
  });
  return { overlay, state, fills, transforms, canvas };
}

test('player overhead bars show red life and blue mana ratios without changing the player', () => {
  const { overlay, state, fills } = playerBarFixture(), p = state.player!;
  state.stats!.maxLife = 100; state.stats!.maxMana = 80; p.life = 25; p.mana = 40;
  const before = structuredClone(p);
  overlay.render(state, 0, () => ({ x: 100, y: 100 }), null);
  assert.deepEqual(fills.filter(fill => fill.color !== '#0b100c'), [
    { color: '#df5148', x: 74, y: 87, width: 13, height: 3 },
    { color: '#4f93e5', x: 74, y: 95, width: 26, height: 3 },
  ]);
  assert.deepEqual(p, before);
  p.life = 200; p.mana = -20; fills.length = 0;
  overlay.render(state, 1, () => ({ x: 100, y: 100 }), null);
  assert.deepEqual(fills.filter(fill => fill.color !== '#0b100c').map(fill => fill.width), [52, 0]);
  state.stats!.maxLife = 200; state.stats!.maxMana = 160; p.life = 100; p.mana = 80; fills.length = 0;
  overlay.render(state, 2, () => ({ x: 100, y: 100 }), null);
  assert.deepEqual(fills.filter(fill => fill.color !== '#0b100c').map(fill => fill.width), [26, 26]);
});

test('player bars follow interpolated actor position, remain while paused and hide on death or outside gameplay', () => {
  const { overlay, state, fills } = playerBarFixture(), anchor = { x: 8.5, y: 9.5 };
  const projected: { point: Point; lift?: number }[] = [];
  const project = (point: Point, lift?: number) => { projected.push({ point, lift }); return { x: 100, y: 100 }; };
  state.paused = true; overlay.render(state, 0, project, null, anchor);
  assert.deepEqual(projected, [{ point: anchor, lift: 2.2 }]); assert.equal(fills.length, 4);
  fills.length = 0; state.player!.dead = true; overlay.render(state, 1, project, null, anchor); assert.equal(fills.length, 0);
  state.player!.dead = false;
  for (const screen of ['intro', 'title', 'creation'] as const) {
    state.screen = screen; overlay.render(state, 2, project, null, anchor); assert.equal(fills.length, 0);
  }
  state.screen = 'game'; state.stats = null; overlay.render(state, 3, project, null, anchor); assert.equal(fills.length, 0);
});

test('overhead bars keep CSS-pixel size at high DPR, clip outside the viewport and preserve monster bar width', () => {
  const { overlay, state, fills, transforms, canvas } = playerBarFixture();
  overlay.resize(320, 568, 2); assert.deepEqual(canvas, { width: 640, height: 1136 });
  overlay.render(state, 0, () => ({ x: 160, y: 280 }), null);
  assert.equal(fills[0].width, 54); assert.deepEqual(transforms.at(-1), [2, 0, 0, 2, 0, 0]);
  for (const point of [{ x: 5, y: 280 }, { x: 315, y: 280 }, { x: 160, y: -10 }, { x: NaN, y: 100 }]) {
    fills.length = 0; overlay.render(state, 1, () => point, null); assert.equal(fills.length, 0);
  }
  fills.length = 0;
  (overlay as unknown as { smallBar(x: number, y: number, ratio: number, color: string): void }).smallBar(160, 280, .5, '#a44636');
  assert.deepEqual(fills.map(fill => fill.width), [42, 20]);
});

test('isolated browser: real WebGL rendering, 20 area changes, ultrawide coverage and actual main loading gate', { skip: process.env.TERRAIN_BROWSER !== '1', timeout: 180000 }, async () => {
  const moduleUrl = 'file:///Users/wangyong/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
  const { chromium } = await import(moduleUrl), browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  try {
    await context.routeWebSocket(/127\.0\.0\.1:5173/, (socket: { close(): void }) => socket.close());
    await context.route('http://127.0.0.1:5173/', (route: { fulfill(options: object): Promise<void> }) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body style="margin:0"><canvas style="width:100vw;height:100vh;display:block"></canvas></body></html>' }));
    const page = await context.newPage(); page.on('pageerror', (error: Error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/');
    const surface = surfaceFixture(), cave = fixture(62, 50, 8);
    surface.objects = [
      { uid: 'fixture-exit', kind: 'exit', name: 'exit', x: 22, y: 12 },
      { uid: 'fixture-waypoint', kind: 'waypoint', name: 'waypoint', x: 17, y: 16 },
      { uid: 'fixture-shrine', kind: 'shrine', shrineCode: 7, name: 'shrine', x: 21, y: 17 },
      { uid: 'fixture-portal', kind: 'portal', name: 'portal', x: 14, y: 12 },
      ...Array.from({ length: 8 }, (_, i) => ({ uid: `fixture-chest-${i}`, kind: 'chest' as const, name: 'chest', x: 12 + i * 2, y: 20 })),
    ];
    cave.objects = [{ uid: 'fixture-cave-exit', kind: 'exit', name: 'exit', x: 25, y: 12 }];
    const result = await page.evaluate(`(async () => {
      const [{ Renderer }, { Engine }, { createPlayer, deriveStats }] = await Promise.all([import('/src/renderer3d.ts'), import('/src/engine.ts'), import('/src/rules.ts')]);
      const surface = ${JSON.stringify(surface)}, cave = ${JSON.stringify(cave)}, engine = new Engine(), state = engine.state;
      const player = createPlayer('sor', 'GPU fixture'); Object.assign(player, surface.spawn);
      Object.assign(state, { screen: 'game', player, area: surface, stats: deriveStats(player), storageStatus: 'ready', seed: 12345 });
      const renderer = new Renderer(document.querySelector('canvas')), gl = renderer.gl, gpu = gl.getContext(), debug = gpu.getExtension('WEBGL_debug_renderer_info');
      const gpuName = debug ? gpu.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gpu.getParameter(gpu.RENDERER);
      let created = 0, deleted = 0; const create = gpu.createBuffer.bind(gpu), remove = gpu.deleteBuffer.bind(gpu);
      gpu.createBuffer = () => { created++; return create(); }; gpu.deleteBuffer = buffer => { if (buffer) deleted++; return remove(buffer); };
      const renders = [], preparations = [], intervals = [], resources = [], phases = { maxUnitMs: 0, maxSetupMs: 0, maxPropMs: 0 }; let last = 0;
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const frame = () => new Promise(resolve => requestAnimationFrame(now => {
        const start = performance.now(); state.tick++; renderer.render(state, now / 1000); const ms = performance.now() - start;
        check(renderer.terrain.metrics.committed <= 1, 'more than one chunk committed');
        preparations.push(renderer.terrain.metrics.prepareMs); for (const key of Object.keys(phases)) phases[key] = Math.max(phases[key], renderer.terrain.metrics[key]);
        renders.push(ms); if (last) intervals.push(now - last); last = now; resolve(ms);
      }));
      const full = () => renderer.visibleGroundReady && [...renderer.terrain.wanted].every(key => renderer.terrain.chunks.has(key)) && state.area.objects.filter(o => Math.hypot(o.x - player.x, o.y - player.y) <= 30).every(o => renderer.terrain.props.has(o.uid));
      const settle = async () => { for (let i = 0; i < 600; i++) { await frame(); if (full()) return; } throw new Error('viewport did not finish'); };
      const started = performance.now(); await frame(); check(renderer.terrain.chunkCount <= 1, 'constructor eagerly built the surface');
      while (!renderer.visibleGroundReady) await frame(); const firstReadyMs = performance.now() - started;
      await settle(); for (let i = 0; i < 120; i++) await frame();
      const stable = renders.slice(-120).sort((a,b) => a-b), paced = intervals.slice(-120).sort((a,b) => a-b), firstCalls = gl.info.render.calls, firstTriangles = gl.info.render.triangles;
      const roundtrip = renderer.screenToWorld(...Object.values(renderer.worldToScreen({ x: 22, y: 12 })));
      check(Math.hypot(roundtrip.x - 22, roundtrip.y - 12) < 1e-5, 'global world/screen picking changed');
      const far = { x: 285, y: 135 }; Object.assign(player, far); check(!renderer.isGroundReady(surface, player), 'same-area teleport incorrectly ready'); await settle();
      Object.assign(player, surface.spawn); await settle(); check(renderer.terrain.flames.length === 3, 'stale exit flames accumulated');
      for (let i = 0; i < 20; i++) {
        state.area = i % 2 === 0 ? cave : surface; Object.assign(player, state.area.spawn);
        check(!renderer.isGroundReady(state.area, player), 'new area incorrectly ready before render');
        await settle(); for (let j = 0; j < 8; j++) await frame();
        resources.push({ area: state.area.def.id, geometry: gl.info.memory.geometries, textures: gl.info.memory.textures, buffers: created - deleted, programs: gl.info.programs.length, chunks: renderer.terrain.chunkCount, flames: renderer.terrain.flames.length });
      }
      for (const id of [surface.def.id, cave.def.id]) {
        const rows = resources.filter(r => r.area === id).slice(2), baseline = rows[0];
        for (const row of rows) for (const field of ['geometry', 'textures', 'buffers', 'programs', 'chunks', 'flames']) check(row[field] === baseline[field], 'resource growth: ' + id + ':' + field);
      }
      window.terrainProbe = { renderer, state, frame, settle, check, preparations, renders, resources, phases, liveBuffers: () => created - deleted };
      return { gpu: gpuName, webgl: gpu.getParameter(gpu.VERSION), firstReadyMs, maxPrepareMs: Math.max(...preparations), phases, stableRenderP95Ms: stable[113], frameIntervalP95Ms: paced[113], calls: firstCalls, triangles: firstTriangles, resources: resources.slice(-4), maxRenderMs: Math.max(...renders) };
    })()`);
    await page.setViewportSize({ width: 2400, height: 500 });
    const wide = await page.evaluate(`(async () => {
      const { renderer, state, frame, settle, check } = window.terrainProbe;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); renderer.resize(); Object.assign(state.player, { x: 170, y: 80 }); await settle();
      const view = renderer.terrainView, chunks = [...renderer.terrain.chunks.values()].filter(c => c.group.visible);
      for (let y = Math.max(0, view.minY); y < Math.min(state.area.height, view.maxY); y += 4) for (let x = Math.max(0, view.minX); x < Math.min(state.area.width, view.maxX); x += 4) check(chunks.some(c => x >= c.bounds.minX && x < c.bounds.maxX && y >= c.bounds.minY && y < c.bounds.maxY), 'ultrawide missing ground');
      check(chunks.length > 25, 'real ultrawide projection was restricted to 5x5');
      return { view, visibleChunks: chunks.length, prepareMax: Math.max(...window.terrainProbe.preparations), phases: window.terrainProbe.phases };
    })()`);
    await page.evaluate('window.terrainProbe.renderer.destroy()');
    const disposed = await page.evaluate('({ geometries: window.terrainProbe.renderer.gl.info.memory.geometries, textures: window.terrainProbe.renderer.gl.info.memory.textures, buffers: window.terrainProbe.liveBuffers() })');
    assert.equal(disposed.geometries, 0); assert.equal(disposed.textures, 0); assert.equal(disposed.buffers, 0);
    await context.unroute('http://127.0.0.1:5173/'); await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('http://127.0.0.1:5173/'); await page.waitForFunction('!!window.sanctuary');
    const gate = await page.evaluate(`(async () => {
      const { createPlayer, deriveStats } = await import('/src/rules.ts'), { engine, renderer } = window.sanctuary;
      const player = createPlayer('sor', 'Loading fixture'), area = ${JSON.stringify(surface)}; Object.assign(player, area.spawn);
      Object.assign(engine.state, { screen: 'game', player, area, stats: deriveStats(player), paused: false });
      const step = engine.step.bind(engine); let blockedSteps = 0, steps = 0;
      engine.step = () => { if (!renderer.isGroundReady(engine.state.area, engine.state.player)) blockedSteps++; steps++; step(); };
      let loadingFrames = 0, tick = engine.state.tick, maxCatchup = 0, previousTick = tick;
      for (let i = 0; i < 600; i++) {
        const wasReady = renderer.isGroundReady(area, player); await new Promise(resolve => requestAnimationFrame(resolve));
        if (!wasReady) { loadingFrames++; if (engine.state.tick !== tick) throw new Error('engine advanced during initial loading'); }
        maxCatchup = Math.max(maxCatchup, engine.state.tick - previousTick); previousTick = engine.state.tick;
        if (renderer.visibleGroundReady) break;
      }
      await new Promise(resolve => setTimeout(resolve, 160));
      Object.assign(player, { x: 285, y: 135 }); tick = engine.state.tick;
      if (renderer.isGroundReady(area, player)) throw new Error('same-area teleport not gated');
      let teleportFrames = 0;
      for (let i = 0; i < 600; i++) {
        const wasReady = renderer.isGroundReady(area, player); await new Promise(resolve => requestAnimationFrame(resolve));
        if (!wasReady) { teleportFrames++; if (engine.state.tick !== tick) throw new Error('engine advanced during teleport loading'); }
        if (renderer.visibleGroundReady) break;
      }
      if (blockedSteps || engine.state.paused) throw new Error('gate changed pause semantics or advanced too soon');
      return { loadingFrames, teleportFrames, blockedSteps, maxCatchup, steps, tick: engine.state.tick, ready: renderer.visibleGroundReady };
    })()`);
    assert.ok(gate.loadingFrames > 1); assert.ok(gate.teleportFrames > 1); assert.equal(gate.blockedSteps, 0); assert.equal(gate.ready, true);
    if (process.env.TERRAIN_SCREENSHOT) {
      await page.evaluate('Object.assign(window.sanctuary.engine.state.player, window.sanctuary.engine.state.area.spawn)');
      await page.waitForFunction('window.sanctuary.renderer.isGroundReady(window.sanctuary.engine.state.area, window.sanctuary.engine.state.player)');
      await page.screenshot({ path: process.env.TERRAIN_SCREENSHOT });
    }
    assert.deepEqual(errors, []);
    console.log('TERRAIN_WEBGL', JSON.stringify({ ...result, wide, disposed, gate }));
  } finally { await context.close(); await browser.close(); }
});
