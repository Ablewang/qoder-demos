import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createArea, createSurfaceWorld } from '../src/world';
import { createPlayer } from '../src/rules';
import { Terrain } from '../src/r3d/terrain';
import type { AreaState } from '../src/types';

test('outdoor scenery differs in geometry rather than only ground color', () => {
  const texture = new THREE.Texture(), signatures = new Set<string>();
  let sourceDisposals = 0;
  texture.addEventListener('dispose', () => sourceDisposals++);
  for (const id of [2, 3, 4, 5, 6, 7, 17, 27]) {
    const area = createArea(id, 'normal', 12345, createPlayer('sor', '地形验证'));
    const before = JSON.stringify({ tiles: area.tiles, monsters: area.monsters, objects: area.objects });
    const terrain = new Terrain(area, () => texture);
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
  const area = createSurfaceWorld('normal', 12345, createPlayer('sor', '连接道路'));
  const before = JSON.stringify({ tiles: area.tiles, monsters: area.monsters, objects: area.objects });
  const texture = new THREE.Texture(), terrain = new Terrain(area, () => texture);
  const ground = terrain.group.children.filter(node => node instanceof THREE.Mesh && !(node instanceof THREE.InstancedMesh)) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>[];
  assert.equal(ground.length, 2, 'the shared underlay and walking roads are both real ground meshes');
  assert.ok(ground.every(mesh => mesh.material.map && mesh.material.map !== texture && mesh.material.map.wrapS === THREE.RepeatWrapping));
  const roads = ground[1], positions = roads.geometry.getAttribute('position'), uvs = roads.geometry.getAttribute('uv'), normals = roads.geometry.getAttribute('normal');
  assert.ok(positions.count > 0);
  for (let i = 0; i < positions.count; i++) {
    assert.equal(positions.getY(i), 0);
    assert.ok(normals.getY(i) > .999);
    assert.equal(uvs.getX(i), positions.getX(i) / 4);
    assert.equal(uvs.getY(i), positions.getZ(i) / 4);
  }
  const banks = terrain.group.children.find(node => node instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
  assert.ok(banks.count > 0);
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  for (let i = 0; i < banks.count; i++) {
    banks.getMatrixAt(i, matrix); point.setFromMatrixPosition(matrix);
    const x = Math.floor(point.x), y = Math.floor(point.z);
    assert.notEqual(area.tiles[y][x], 0);
    assert.ok([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => area.tiles[y + dy]?.[x + dx] === 0));
  }
  assert.equal(JSON.stringify({ tiles: area.tiles, monsters: area.monsters, objects: area.objects }), before);
  let sourceDisposals = 0, cloneDisposals = 0;
  texture.addEventListener('dispose', () => sourceDisposals++);
  for (const mesh of ground) mesh.material.map!.addEventListener('dispose', () => cloneDisposals++);
  terrain.dispose();
  assert.equal(sourceDisposals, 0); assert.equal(cloneDisposals, 2);
  texture.dispose();
});

test('raised rocky banks leave all walkable floor corners on the gameplay plane', () => {
  const area = createArea(7, 'normal', 12345, createPlayer('sor', '岩坡验证'));
  const texture = new THREE.Texture(), terrain = new Terrain(area, () => texture);
  const ground = terrain.group.children.find(node => node instanceof THREE.Mesh && !(node instanceof THREE.InstancedMesh)) as THREE.Mesh;
  const positions = ground.geometry.getAttribute('position');
  let raised = false;
  for (let i = 0; i < positions.count; i++) {
    const x = Math.floor(positions.getX(i)), y = Math.floor(positions.getZ(i)), height = positions.getY(i);
    raised ||= height > .1;
    if ([[x, y], [x - 1, y], [x, y - 1], [x - 1, y - 1]].some(([tx, ty]) => area.tiles[ty]?.[tx] === 0)) assert.ok(Math.abs(height) < 1e-6);
  }
  assert.equal(raised, true);
  terrain.dispose(); texture.dispose();
});

test('surface districts keep world offsets, cull distant scenery, and dispose owned resources', () => {
  const player = createPlayer('sor', '区块验证');
  const sources = [createArea(1, 'normal', 123, player), createArea(2, 'normal', 456, player)];
  const regions = sources.map((area, i) => ({ def: area.def, x: i * 100, y: 0, width: area.width, height: area.height, spawn: { x: area.spawn.x + i * 100, y: area.spawn.y }, seed: area.seed }));
  const world: AreaState = { def: sources[0].def, width: 150, height: 35, seed: 123, spawn: regions[0].spawn, tiles: Array.from({ length: 35 }, () => Array(150).fill(1)), revealed: [], monsters: [], drops: [], objects: [], regions };
  for (const [i, area] of sources.entries()) {
    for (let y = 0; y < area.height; y++) for (let x = 0; x < area.width; x++) world.tiles[y][x + regions[i].x] = area.tiles[y][x];
    world.objects.push(...area.objects.map(object => ({ ...object, x: object.x + regions[i].x, regionId: area.def.id })));
  }
  const texture = new THREE.Texture(), terrain = new Terrain(world, () => texture);
  const districts = terrain.group.children.filter(child => child instanceof THREE.Group).slice(0, 2);
  assert.equal(districts[1].position.x, 100);
  terrain.update(regions[0].spawn, .04, 0);
  assert.equal(districts[0].visible, true); assert.equal(districts[1].visible, false);
  terrain.update(regions[1].spawn, .04, 1);
  assert.equal(districts[0].visible, false); assert.equal(districts[1].visible, true);
  let disposals = 0;
  for (const district of districts) district.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.addEventListener('dispose', () => disposals++); });
  terrain.dispose();
  assert.ok(disposals > 2);
  assert.equal(terrain.group.parent, null); assert.equal(districts[0].parent, null); assert.equal(districts[1].parent, null);
  texture.dispose();
});
