import * as THREE from 'three';
import type { AreaState, Point, WorldObject } from '../types';
import { getShrine } from '../rules';
import { box, cyl, cone, rock, ball, merge, hash } from './geo';

const GROUND_ART: Record<string, string> = { grass: 'earth', town: 'flagstone', jungle: 'earth', desert: 'sand', snow: 'snow', hell: 'volcanic', cave: 'basalt', dungeon: 'flagstone' };
const TAU = Math.PI * 2;
const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), vector = new THREE.Vector3(), scale = new THREE.Vector3();
interface Instance { x: number; z: number; yaw: number; size: number; cut: number }
interface Batch { mesh: THREE.InstancedMesh; entries: Instance[]; offset?: Point }
interface Prop { source: WorldObject; group: THREE.Group; lid?: THREE.Group; glow?: THREE.Mesh; orbs?: THREE.Mesh[]; phase: number; flames: THREE.Vector3[] }
export interface ViewBounds { minX: number; minY: number; maxX: number; maxY: number }
interface RegionContext {
  def: AreaState['def']; x: number; y: number; width: number; height: number; seed: number; spawn: Point;
  roads: Set<string>; templates: Map<string, THREE.BufferGeometry>; ground?: THREE.MeshLambertMaterial;
  preparation?: Generator<void>; ready: boolean; town: THREE.Group; batches: Batch[]; flames: THREE.Vector3[];
}
interface Chunk { key: string; bounds: ViewBounds; group: THREE.Group; batches: Batch[] }
// Leave headroom for the final non-preemptible row/template unit within the 2ms preparation target.
const CHUNK = 16, BUDGET_MS = 1.5;
const intersects = (a: ViewBounds, b: ViewBounds) => a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
const regionBounds = (r: RegionContext): ViewBounds => ({ minX: r.x, minY: r.y, maxX: r.x + r.width, maxY: r.y + r.height });

export class Terrain {
  readonly group = new THREE.Group();
  readonly flames: THREE.Vector3[] = [];
  private props = new Map<string, Prop>();
  private contexts: RegionContext[];
  private chunks = new Map<string, Chunk>();
  private required = new Set<string>();
  private wanted = new Set<string>();
  private task?: { chunk: Chunk; rows: Generator<void> };
  private sharedGeometry = new Set<THREE.BufferGeometry>();
  private sharedMaterials = new Set<THREE.Material>();
  private sharedTextures = new Set<THREE.Texture>();
  private gapMaterials?: THREE.MeshLambertMaterial[];
  private disposed = false;
  private ready = false;
  private material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private glowMaterial = new THREE.MeshBasicMaterial({ color: '#63bfff', transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  /** CPU preparation time includes selection, prop synchronization and bounded generator steps, not GL uploads. */
  readonly metrics = { prepareMs: 0, maxPrepareMs: 0, maxUnitMs: 0, maxSetupMs: 0, maxPropMs: 0, committed: 0, cancelled: 0 };
  get visibleGroundReady(): boolean { return !this.disposed && this.ready; }
  get chunkCount(): number { return this.chunks.size; }

  constructor(readonly area: AreaState, private readonly texture: (key: string) => THREE.Texture) {
    this.contexts = (area.regions ?? [{ ...area, x: 0, y: 0 }]).map(r => ({
      def: r.def, x: r.x, y: r.y, width: r.width, height: r.height, seed: r.seed,
      spawn: { x: r.spawn.x - r.x, y: r.spawn.y - r.y }, roads: new Set(), templates: new Map(),
      ready: false, town: new THREE.Group(), batches: [], flames: [],
    }));
    this.sharedMaterials.add(this.material); this.sharedMaterials.add(this.glowMaterial);
    // No tile traversal, geometry, props or texture requests until a real viewport arrives.
  }

  private tile(r: RegionContext, x: number, y: number): number | undefined {
    return x < 0 || y < 0 || x >= r.width || y >= r.height ? undefined : this.area.tiles[r.y + y]?.[r.x + x];
  }

  private groundMaterial(key: string, color?: string): THREE.MeshLambertMaterial {
    const map = this.texture(key).clone(); map.needsUpdate = true; map.wrapS = map.wrapT = THREE.RepeatWrapping;
    const material = new THREE.MeshLambertMaterial(color ? { map, color } : { map, vertexColors: true });
    this.sharedTextures.add(map); this.sharedMaterials.add(material); return material;
  }

  private *prepareRegion(r: RegionContext): Generator<void> {
    yield* this.traceRoads(r);
    if (r.def.town) { yield* this.buildings(r); this.campfire(r); yield; }
    r.ready = true;
  }

  private *buildChunk(chunk: Chunk): Generator<void> {
    for (const r of this.contexts) {
      if (!intersects(chunk.bounds, regionBounds(r))) continue;
      r.preparation ??= this.prepareRegion(r);
      while (!r.ready) { r.preparation.next(); yield; }
      const bounds = { minX: Math.max(chunk.bounds.minX - r.x, 0), minY: Math.max(chunk.bounds.minY - r.y, 0), maxX: Math.min(chunk.bounds.maxX - r.x, r.width), maxY: Math.min(chunk.bounds.maxY - r.y, r.height) };
      const local = new THREE.Group(); local.position.set(r.x, 0, r.y); chunk.group.add(local);
      yield* this.ground(r, bounds, local);
      yield* this.scenery(r, bounds, local, chunk.batches);
    }
    if (this.area.regions) yield* this.gaps(chunk);
  }

  private *traceRoads(r: RegionContext): Generator<void> {
    if (!['grass', 'town'].includes(r.def.style)) return;
    const { width, height, spawn } = r;
    const start = Math.floor(spawn.y) * width + Math.floor(spawn.x), previous = new Int32Array(width * height).fill(-1), queue = [start];
    if (start < 0 || start >= previous.length) return;
    previous[start] = start; yield;
    for (let i = 0; i < queue.length; i++) {
      const index = queue[i], x = index % width, y = Math.floor(index / width);
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy, next = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || this.tile(r, nx, ny) !== 0 || previous[next] !== -1) continue;
        previous[next] = index; queue.push(next);
      }
      if (i % 32 === 31) yield;
    }
    let steps = 0;
    for (const object of this.area.objects) {
      if (object.kind !== 'exit' && object.kind !== 'waypoint') continue;
      const ox = Math.floor(object.x - r.x), oy = Math.floor(object.y - r.y);
      if (ox < 0 || oy < 0 || ox >= width || oy >= height) continue;
      let index = oy * width + ox;
      if (previous[index] < 0) continue;
      while (index !== start) {
        const x = index % width, y = Math.floor(index / width);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) r.roads.add(`${x + dx},${y + dy}`);
        index = previous[index];
        if (++steps % 16 === 0) yield;
      }
    }
  }

  private *ground(r: RegionContext, bounds: ViewBounds, parent: THREE.Group): Generator<void> {
    const { seed, def } = r, id = def.id, indoor = ['dungeon', 'cave'].includes(def.style);
    const nx = (bounds.maxX - bounds.minX) * 2 + 1, nz = (bounds.maxY - bounds.minY) * 2 + 1;
    // A full tile halo uses the original region, never a sliced chunk. Only the inner faces are submitted.
    const hx = Math.max(0, bounds.minX - 1), hz = Math.max(0, bounds.minY - 1);
    const hn = (Math.min(r.width, bounds.maxX + 1) - hx) * 2 + 1, hm = (Math.min(r.height, bounds.maxY + 1) - hz) * 2 + 1;
    const heights = new Float32Array(hn * hm), haloNormals = new Float32Array(hn * hm * 3);
    const positions = new Float32Array(nx * nz * 3), colors = new Float32Array(nx * nz * 3), normals = new Float32Array(nx * nz * 3), uvs = new Float32Array(nx * nz * 2);
    const indices = new Uint16Array((nx - 1) * (nz - 1) * 6);
    const baseTint = new THREE.Color(id === 5 ? '#829d76' : id === 6 ? '#849079' : id === 7 ? '#b7bab0' : '#c4c6b0'), roadTint = new THREE.Color('#dac6a0');
    yield;
    for (let row = 0; row < hm; row++) {
      for (let col = 0; col < hn; col++) {
        const x = hx + col / 2, z = hz + row / 2, tx = Math.floor(x), ty = Math.floor(z);
        let walls = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.tile(r, tx + dx, ty + dy)) walls++;
        const solid = !!this.tile(r, tx, ty);
        if (!indoor && !def.town && id !== 3 && id !== 6 && solid && walls >= 7 && this.tile(r, tx - 1, ty - 1) && this.tile(r, tx, ty - 1) && this.tile(r, tx - 1, ty)) heights[row * hn + col] = (id === 7 ? 1.1 : .35) * (.4 + Math.sin(x * .27 + seed) ** 2);
        if (x < bounds.minX || x > bounds.maxX || z < bounds.minY || z > bounds.maxY) continue;
        const i = (z - bounds.minY) * 2 * nx + (x - bounds.minX) * 2;
        positions.set([x, heights[row * hn + col], z], i * 3); uvs.set([x / 4, (r.height - z) / 4], i * 2);
        const brightness = (.88 + hash(Math.round(x * 2), Math.round(z * 2), seed) * .2) * (1 - walls * .04) * (solid ? indoor ? .18 : .7 : 1);
        const tint = r.roads.has(`${tx},${ty}`) ? roadTint : baseTint;
        colors.set([brightness * tint.r, brightness * tint.g, brightness * tint.b], i * 3);
      }
      yield;
    }
    const face = (a: number, b: number, c: number, x: number, z: number) => {
      for (const i of [a, b, c]) { haloNormals[i * 3] += x; haloNormals[i * 3 + 1] += .25; haloNormals[i * 3 + 2] += z; }
    };
    for (let row = 0; row < hm - 1; row++) {
      for (let col = 0; col < hn - 1; col++) {
        const a = row * hn + col, b = a + hn, c = b + 1, d = a + 1;
        face(a, b, d, .5 * (heights[a] - heights[d]), .5 * (heights[a] - heights[b]));
        face(b, c, d, .5 * (heights[b] - heights[c]), .5 * (heights[d] - heights[c]));
      }
      yield;
    }
    for (let row = 0; row < nz; row++) {
      for (let col = 0; col < nx; col++) {
        const i = row * nx + col, h = ((bounds.minY - hz) * 2 + row) * hn + (bounds.minX - hx) * 2 + col;
        vector.fromArray(haloNormals, h * 3).normalize().toArray(normals, i * 3);
        if (row < nz - 1 && col < nx - 1) indices.set([i, i + nx, i + 1, i + nx, i + nx + 1, i + 1], (row * (nx - 1) + col) * 6);
      }
      yield;
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3)); geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    r.ground ??= this.groundMaterial(GROUND_ART[[17, 26, 27, 32].includes(id) ? 'town' : def.style]);
    const mesh = new THREE.Mesh(geometry, r.ground); mesh.name = 'ground'; mesh.receiveShadow = true; parent.add(mesh); yield;
    geometry.computeBoundingSphere(); yield;
  }

  private mesh(geometry: THREE.BufferGeometry, parent: THREE.Object3D = this.group): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.material); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }

  private *scenery(r: RegionContext, bounds: ViewBounds, parent: THREE.Group, batches: Batch[]): Generator<void> {
    const { width, height, seed, def } = r, style = def.style, id = def.id;
    const entries: Record<string, Instance[]> = { pine: [], tree: [], rock: [], wall: [], fence: [], tuft: [], grave: [], deadwood: [], water: [] };
    const add = (key: string, x: number, z: number, size: number) => entries[key].push({ x, z, size, yaw: hash(x * 17, z * 17, seed) * TAU, cut: 1 });
    for (let y = bounds.minY; y < bounds.maxY; y++) {
      yield;
      for (let x = bounds.minX; x < bounds.maxX; x++) {
      const n = hash(x, y, seed), solid = !!this.tile(r, x, y);
      if (!solid) { if (n < .1 && style !== 'town' && style !== 'dungeon' && style !== 'cave') add('tuft', x + .5, y + .5, .7 + n * 4); continue; }
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const edge = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => this.tile(r, x + dx, y + dy) === 0);
      if (def.town) { if (border) add('fence', x + .5, y + .5, 1); continue; }
      if (style === 'dungeon') { if (edge || border) add('wall', x + .5, y + .5, 1); continue; }
      if (style === 'cave') { if (edge || border) add('rock', x + .5, y + .5, 1.3 + n * .7); continue; }
      if (id === 17) { if (edge) add(border ? 'fence' : 'grave', x + .5, y + .5, .75 + n * .4); continue; }
      if ([26, 27, 32].includes(id)) { if (edge || border) add(n < .75 ? 'wall' : 'deadwood', x + .5, y + .5, .7 + n * .3); continue; }
      if ((id === 3 || id === 6) && !border && Math.sin(x * .34 + seed % 7) + Math.cos(y * .3) > (id === 6 ? -.5 : .9)) { add('water', x + .5, y + .5, 1); if (edge && n < .35) add('deadwood', x + .5, y + .5, .7 + n); continue; }
      if (id === 4 && edge && n < .4) { add('grave', x + .5, y + .5, 1.4 + n); continue; }
      if (n < (id === 5 ? .92 : edge ? .78 : .42)) add(style === 'desert' || style === 'hell' || id === 7 || n < .2 ? 'rock' : id === 6 ? 'deadwood' : n < .55 ? 'pine' : 'tree', x + .3 + n * .4, y + .5, id === 7 ? 1.2 + n : .8 + n * .6);
    }
    }
    const leaf = style === 'snow' ? '#b8c3bd' : style === 'hell' ? '#503b32' : id === 5 ? '#233b2c' : '#425439';
    const stone = style === 'desert' ? '#b49c70' : style === 'hell' ? '#493332' : id === 7 ? '#838679' : '#656860';
    const geometries: Record<string, () => THREE.BufferGeometry> = {
      pine: () => merge([cyl(.07, .13, 1.5, '#57432d', [0, .75, 0]), cone(.75, 1.6, leaf, [0, 1.5, 0]), cone(.58, 1.5, leaf, [0, 2.2, 0]), cone(.37, 1.2, leaf, [0, 2.8, 0])]),
      tree: () => merge([cyl(.07, .16, 1.8, '#594632', [0, .9, 0]), ball(.8, leaf, [0, 2.2, 0], [1.1, 1, .9], 1), ball(.55, leaf, [.45, 1.95, .15], 1, 0)]),
      rock: () => rock(.7, stone, [0, .6, 0], [1, 1.4, .9]),
      wall: () => merge([box(1, 2.1, 1, '#62635b', [0, 1.05, 0]), box(1.05, .15, 1.05, '#75786b', [0, 2.15, 0]), box(1.01, .06, 1.01, '#42433c', [0, 1.3, 0])]),
      fence: () => merge([cyl(.07, .1, 1.6, '#594530', [0, .8, 0]), cone(.1, .25, '#69553a', [0, 1.72, 0]), box(1, .08, .08, '#493824', [0, .65, 0]), box(1, .08, .08, '#493824', [0, 1.2, 0])]),
      tuft: () => merge([cone(.08, .35, style === 'snow' ? '#a4aba3' : id === 6 ? '#879264' : '#6b7048', [0, .17, 0], [0, 0, .2], 3), rock(.07, stone, [.16, .035, -.05], [1, .5, .7])]),
      grave: () => merge([box(.54, id === 17 ? .85 : 1.3, .22, '#8b897c', [0, id === 17 ? .42 : .65, 0], [0, 0, .08]), box(.67, .12, .5, '#5c5e52', [0, .06, 0]), box(.3, .045, .03, '#484b42', [0, .52, .12])]),
      deadwood: () => merge([cyl(.04, .13, 1.7, '#605b47', [0, .85, 0]), cyl(.03, .07, .9, '#71694f', [.26, 1.3, 0], [0, 0, -.65]), cyl(.025, .055, .7, '#71694f', [-.2, 1.05, .05], [0, 0, .7]), cone(.08, .6, '#89956a', [.2, .3, .2], [0, 0, -.2], 3)]),
      water: () => box(1, .04, 1, id === 6 ? '#3e5750' : '#536d6a', [0, .015, 0]),
    };
    for (const key in entries) {
      const points = entries[key];
      if (!points.length) continue;
      let geometry = r.templates.get(key);
      if (!geometry) { geometry = geometries[key](); r.templates.set(key, geometry); this.sharedGeometry.add(geometry); yield; }
      const mesh = new THREE.InstancedMesh(geometry, this.material, points.length); mesh.name = key; mesh.castShadow = key !== 'tuft'; mesh.receiveShadow = true;
      // Attach immediately so cancellation also owns/disposes partially filled instance buffers.
      parent.add(mesh); yield;
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        if (key === 'wall' || key === 'water') point.yaw = 0;
        if (key === 'fence') point.yaw = point.x < 1 || point.x > width - 1 ? Math.PI / 2 : 0;
        this.instanceMatrix(point); mesh.setMatrixAt(i, matrix);
        mesh.setColorAt(i, new THREE.Color().setScalar(.82 + hash(Math.floor(point.x), Math.floor(point.z), seed ^ 75) * .3));
        if (i % 16 === 15) yield;
      }
      mesh.computeBoundingSphere(); yield;
      if (key !== 'tuft' && key !== 'water') batches.push({ mesh, entries: points, offset: { x: r.x, y: r.y } });
    }
  }

  private *buildings(r: RegionContext): Generator<void> {
    const { width, height } = r, visited = new Set<string>();
    r.town.position.set(r.x, 0, r.y); r.town.name = `town-${r.def.id}`;
    for (let y = 2; y < height - 2; y++) {
      yield;
      for (let x = 2; x < width - 2; x++) {
      if (!this.tile(r, x, y) || visited.has(`${x},${y}`)) continue;
      const cells: Point[] = [], queue: Point[] = [{ x, y }]; visited.add(`${x},${y}`);
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i]; cells.push(p);
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const nx = p.x + dx, ny = p.y + dy, key = `${nx},${ny}`;
          if (nx < 2 || ny < 2 || nx >= width - 2 || ny >= height - 2 || visited.has(key) || !this.tile(r, nx, ny)) continue;
          visited.add(key); queue.push({ x: nx, y: ny });
        }
        if (i % 32 === 31) yield;
      }
      if (cells.length < 4) continue;
      const minX = Math.min(...cells.map(p => p.x)), maxX = Math.max(...cells.map(p => p.x)) + 1;
      const minZ = Math.min(...cells.map(p => p.y)), maxZ = Math.max(...cells.map(p => p.y)) + 1;
      const w = maxX - minX, d = maxZ - minZ;
      const geometry = merge([box(w, 2, d, '#6a6050', [0, 1, 0]), cone(Math.max(w, d) * .71, 1.9, '#4b3b2b', [0, 2.85, 0], [0, Math.PI / 4, 0], 4)]);
      const point = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, yaw: 0, size: 1, cut: 1 };
      const mesh = new THREE.InstancedMesh(geometry, this.material, 1); this.instanceMatrix(point); mesh.setMatrixAt(0, matrix); mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.name = 'building'; r.town.add(mesh); r.batches.push({ mesh, entries: [point], offset: { x: r.x, y: r.y } }); yield;
    }
    }
  }

  private campfire(r: RegionContext): void {
    const g = new THREE.Group(); g.position.set(17, 0, 12);
    this.mesh(merge([cyl(.5, .6, .1, '#444039', [0, .05, 0]), cyl(.09, .09, .7, '#35291c', [0, .17, 0], [0, 0, Math.PI / 2]), cyl(.08, .08, .7, '#35291c', [0, .22, 0], [Math.PI / 2, 0, 0])]), g);
    r.flames.push(new THREE.Vector3(r.x + 17, .3, r.y + 12)); r.town.add(g);
  }

  private *gaps(chunk: Chunk): Generator<void> {
    const underlay: number[] = [], roads: number[] = [], banks: Point[] = [], b = chunk.bounds;
    for (let y = b.minY; y < b.maxY; y++) {
      for (let x = b.minX; x < b.maxX; x++) {
        if (this.contexts.some(r => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)) continue;
        for (const [dx, dy] of [[0, 0], [0, 1], [1, 0], [1, 0], [0, 1], [1, 1]]) underlay.push(x + dx, -.2, y + dy);
        if (this.area.tiles[y][x] === 0) {
          for (const [dx, dy] of [[0, 0], [0, 1], [1, 0], [1, 0], [0, 1], [1, 1]]) roads.push(x + dx, 0, y + dy);
        } else if ([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => this.area.tiles[y + dy]?.[x + dx] === 0)) banks.push({ x, y });
      }
      yield;
    }
    if (underlay.length) {
      this.gapMaterials ??= [this.groundMaterial('earth', '#78866b'), this.groundMaterial('earth', '#d3c29a')]; yield;
      for (const [i, data] of [underlay, roads].entries()) {
        if (!data.length) continue;
        const positions = new Float32Array(data), uvs = new Float32Array(data.length / 3 * 2), normals = new Float32Array(data.length);
        for (let j = 0; j < data.length / 3; j++) { uvs.set([data[j * 3] / 4, data[j * 3 + 2] / 4], j * 2); normals[j * 3 + 1] = 1; if (j % 96 === 95) yield; }
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        const mesh = new THREE.Mesh(geometry, this.gapMaterials[i]); mesh.name = i ? 'roads' : 'underlay'; mesh.receiveShadow = true; chunk.group.add(mesh); yield;
        geometry.computeBoundingSphere(); yield;
      }
    }
    if (banks.length) {
      const templates = this.contexts[0].templates;
      let geometry = templates.get('banks');
      if (!geometry) { geometry = rock(.6, '#62694e', [0, .22, 0], [1, .7, 1]); templates.set('banks', geometry); this.sharedGeometry.add(geometry); yield; }
      const mesh = new THREE.InstancedMesh(geometry, this.material, banks.length); mesh.name = 'banks'; chunk.group.add(mesh); yield;
      for (let i = 0; i < banks.length; i++) {
        const p = banks[i]; matrix.makeRotationY(hash(p.x, p.y, this.area.seed) * TAU); matrix.setPosition(p.x + .5, 0, p.y + .5); mesh.setMatrixAt(i, matrix);
        if (i % 16 === 15) yield;
      }
      mesh.computeBoundingSphere(); yield;
    }
  }

  private addProp(object: WorldObject): void {
    const g = new THREE.Group(); g.position.set(object.x, 0, object.y); g.userData.worldObject = object.uid; g.userData.kind = object.kind; this.group.add(g);
    const region = this.contexts.find(r => object.x >= r.x && object.x < r.x + r.width && object.y >= r.y && object.y < r.y + r.height);
    const prop: Prop = { source: object, group: g, phase: hash(object.x - (region?.x ?? 0), object.y - (region?.y ?? 0), region?.seed ?? this.area.seed) * TAU, flames: [] }; this.props.set(object.uid, prop);
    switch (object.kind) {
      case 'exit': {
        if (object.seam) {
          this.mesh(merge([cyl(.07, .11, 1.55, '#69573a', [0, .77, 0]), box(1.15, .28, .08, '#887247', [0, 1.4, 0]), cone(.2, .34, '#c0a775', [.65, 1.4, 0], [0, 0, -Math.PI / 2], 3)]), g);
          g.rotation.y = Math.PI / 4; break;
        }
        this.mesh(merge([box(.28, 2.2, .5, '#7d7464', [-.75, 1.1, 0]), box(.28, 2.2, .5, '#7d7464', [.75, 1.1, 0]), box(1.85, .32, .65, '#97907b', [0, 2.15, 0]), box(.4, .15, .65, '#97907b', [-.75, .1, 0]), box(.4, .15, .65, '#97907b', [.75, .1, 0])]), g);
        g.rotation.y = Math.atan2((region ? region.x + region.width / 2 : this.area.width / 2) - object.x, (region ? region.y + region.height / 2 : this.area.height / 2) - object.y);
        const door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2), new THREE.MeshBasicMaterial({ color: '#080c0b', transparent: true, opacity: .78, side: THREE.DoubleSide })); door.position.set(0, 1, -.13); g.add(door);
        for (const side of [-1, 1]) { this.mesh(cyl(.07, .1, .8, '#4b4234', [side * 1.1, .4, 0]), g); prop.flames.push(new THREE.Vector3(side * 1.1, .85, 0)); }
        break;
      }
      case 'stash': case 'chest': {
        const size = object.kind === 'stash' ? 1 : .65;
        this.mesh(merge([box(size, .48 * size, .62 * size, '#604329', [0, .25 * size, 0]), box(size * 1.02, .05, .64 * size, '#a18a54', [0, .1, 0]), box(.12, .2, .03, '#c3a365', [0, .4 * size, .33 * size])]), g);
        const lid = new THREE.Group(); lid.position.set(0, .5 * size, -.31 * size); this.mesh(box(size, .16 * size, .62 * size, '#7b5a31', [0, .04 * size, .31 * size]), lid); g.add(lid); prop.lid = lid; break;
      }
      case 'waypoint': {
        this.mesh(cyl(.72, .85, .13, '#696c65', [0, .07, 0], undefined, 10), g);
        const glow = new THREE.Mesh(new THREE.RingGeometry(.48, .58, 40).rotateX(-Math.PI / 2), this.glowMaterial.clone()); glow.position.y = .145; g.add(glow); prop.glow = glow;
        for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; this.mesh(box(.08, .03, .25, '#a2b1b0', [Math.sin(a) * .36, .15, Math.cos(a) * .36], [0, a, 0]), g); } break;
      }
      case 'portal': {
        // fixed torus ring — no rotation, 2D view gives natural ellipse
        const glow = new THREE.Mesh(new THREE.TorusGeometry(.67, .06, 6, 48), this.glowMaterial.clone());
        glow.scale.set(1, 1.4, 1); glow.position.y = 1; glow.rotation.x = Math.PI / 2; g.add(glow); prop.glow = glow;
        const disc = new THREE.Mesh(new THREE.CircleGeometry(.67, 40), new THREE.MeshBasicMaterial({ color: '#1a3d6e', transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        disc.position.y = 1; disc.rotation.x = Math.PI / 2; disc.scale.set(1, 1.4, 1); g.add(disc);
        // light orbs that travel along the ring edge
        const orbs: THREE.Mesh[] = [];
        for (let i = 0; i < 4; i++) {
          const orb = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 6), this.glowMaterial.clone());
          g.add(orb); orbs.push(orb);
        }
        prop.orbs = orbs; break;
      }
      case 'shrine': {
        const shrine = getShrine(object.shrineCode ?? 1), color = shrine?.color ?? '#7b817b';
        g.userData.shrineCode = shrine?.code ?? 1;
        this.mesh(merge([
          box(.9, .16, .8, '#565951', [0, .08, 0]), box(.65, .12, .58, '#7d8073', [0, .22, 0]),
          cyl(.2, .32, 1.35, '#929387', [0, .94, 0], [0, Math.PI / 4, 0], 4),
          cone(.28, .65, '#bab9a5', [0, 1.92, 0], [0, Math.PI / 4, 0], 4),
          box(.09, .72, .03, '#4b5149', [0, 1.05, .27]),
        ]), g);
        const geometry = shrine?.code === 18 ? new THREE.OctahedronGeometry(.24) :
          shrine?.code === 17 ? new THREE.TorusGeometry(.22, .04, 5, 20) :
          new THREE.RingGeometry(.12, .2, shrine?.code === 12 ? 3 : shrine?.code === 7 ? 4 : 8);
        const material = this.glowMaterial.clone(); material.color.set(color);
        const glow = new THREE.Mesh(geometry, material); glow.position.set(0, 1.16, .32);
        glow.visible = !object.used; g.add(glow); prop.glow = glow; break;
      }
    }
  }

  private instanceMatrix(p: Instance): void {
    quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.yaw);
    matrix.compose(vector.set(p.x, 0, p.z), quaternion, scale.set(p.size, p.size * p.cut, p.size));
  }

  private select(player: Point, view: ViewBounds): Set<string> {
    const selected = new Set<string>();
    const rect = (b: ViewBounds, circle = false) => {
      const x0 = Math.max(0, Math.floor(b.minX / CHUNK)), y0 = Math.max(0, Math.floor(b.minY / CHUNK));
      const x1 = Math.min(Math.ceil(this.area.width / CHUNK) - 1, Math.floor((b.maxX - 1e-6) / CHUNK)), y1 = Math.min(Math.ceil(this.area.height / CHUNK) - 1, Math.floor((b.maxY - 1e-6) / CHUNK));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (circle && Math.hypot(Math.max(x * CHUNK - player.x, 0, player.x - (x + 1) * CHUNK), Math.max(y * CHUNK - player.y, 0, player.y - (y + 1) * CHUNK)) > 30) continue;
        selected.add(`${x},${y}`);
      }
    };
    rect({ minX: view.minX - 4, minY: view.minY - 4, maxX: view.maxX + 4, maxY: view.maxY + 4 });
    rect({ minX: player.x - 30, minY: player.y - 30, maxX: player.x + 30, maxY: player.y + 30 }, true);
    return selected;
  }

  private ring(keys: Set<string>, radius: number): Set<string> {
    const result = new Set(keys), width = Math.ceil(this.area.width / CHUNK), height = Math.ceil(this.area.height / CHUNK);
    for (const key of keys) {
      const [x, y] = key.split(',').map(Number);
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < width && y + dy < height) result.add(`${x + dx},${y + dy}`);
    }
    return result;
  }

  /** Checks a prospective viewport without scheduling work; used to gate same-area teleports too. */
  isReadyFor(player: Point, view: ViewBounds): boolean {
    if (this.disposed || !this.ready) return false;
    for (const key of this.select(player, view)) if (!this.chunks.has(key)) return false;
    return true;
  }

  private syncProps(player: Point): WorldObject[] {
    const nearby = new Map<string, WorldObject>();
    for (const o of this.area.objects) if (o.kind !== 'npc' && o.kind !== 'corpse' && Math.hypot(o.x - player.x, o.y - player.y) <= 30) nearby.set(o.uid, o);
    for (const [uid, prop] of this.props) {
      const source = nearby.get(uid);
      if (!source || source.kind !== prop.source.kind || source.shrineCode !== prop.source.shrineCode || source.seam !== prop.source.seam) {
        this.disposeObject(prop.group); prop.group.removeFromParent(); this.props.delete(uid); continue;
      }
      // The authoritative object is retained (including replacements), not a district-local copy.
      prop.source = source; prop.group.position.set(source.x, 0, source.y);
    }
    return [...nearby.values()].filter(o => !this.props.has(o.uid)).sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
  }

  private cancelTask(): void {
    if (!this.task) return;
    this.task.rows.return(undefined); this.disposeObject(this.task.chunk.group); this.task.chunk.group.clear(); this.task = undefined; this.metrics.cancelled++;
  }

  update(player: Point, dt: number, time: number, view: ViewBounds = { minX: player.x - 12, minY: player.y - 12, maxX: player.x + 12, maxY: player.y + 12 }): void {
    if (this.disposed) return;
    const start = performance.now(); this.metrics.committed = 0;
    this.required = this.select(player, view); this.wanted = this.ring(this.required, 1);
    const retained = this.ring(this.required, 2);
    if (this.task && (!this.wanted.has(this.task.chunk.key) || (!this.required.has(this.task.chunk.key) && [...this.required].some(key => !this.chunks.has(key))))) this.cancelTask();
    for (const [key, chunk] of this.chunks) {
      if (!retained.has(key)) { this.disposeObject(chunk.group); chunk.group.removeFromParent(); chunk.group.clear(); this.chunks.delete(key); }
      else chunk.group.visible = this.required.has(key);
    }
    const missingProps = this.syncProps(player);
    this.metrics.maxSetupMs = Math.max(this.metrics.maxSetupMs, performance.now() - start);
    if (missingProps.length && performance.now() - start < BUDGET_MS) {
      const propStart = performance.now(); this.addProp(missingProps[0]); this.metrics.maxPropMs = Math.max(this.metrics.maxPropMs, performance.now() - propStart);
    }
    if (!this.task) {
      const missing = [...this.wanted].filter(key => !this.chunks.has(key)).sort((a, b) => {
        const priority = Number(this.required.has(b)) - Number(this.required.has(a));
        if (priority) return priority;
        const [ax, ay] = a.split(',').map(Number), [bx, by] = b.split(',').map(Number);
        return Math.hypot(ax * CHUNK + 8 - player.x, ay * CHUNK + 8 - player.y) - Math.hypot(bx * CHUNK + 8 - player.x, by * CHUNK + 8 - player.y);
      });
      if (missing.length) {
        const key = missing[0], [x, y] = key.split(',').map(Number);
        const chunk: Chunk = { key, bounds: { minX: x * CHUNK, minY: y * CHUNK, maxX: Math.min((x + 1) * CHUNK, this.area.width), maxY: Math.min((y + 1) * CHUNK, this.area.height) }, group: new THREE.Group(), batches: [] };
        chunk.group.name = `chunk-${key}`; chunk.group.userData.bounds = chunk.bounds;
        this.task = { chunk, rows: this.buildChunk(chunk) };
      }
    }
    while (this.task && performance.now() - start < BUDGET_MS) {
      const unitStart = performance.now(), done = this.task.rows.next().done;
      this.metrics.maxUnitMs = Math.max(this.metrics.maxUnitMs, performance.now() - unitStart);
      if (done) {
        const chunk = this.task.chunk; chunk.group.visible = this.required.has(chunk.key); this.chunks.set(chunk.key, chunk); this.group.add(chunk.group); this.task = undefined; this.metrics.committed = 1; break;
      }
    }
    this.ready = [...this.required].every(key => this.chunks.has(key));
    const elapsed = performance.now() - start; this.metrics.prepareMs = elapsed; this.metrics.maxPrepareMs = Math.max(this.metrics.maxPrepareMs, elapsed);
    this.flames.length = 0;
    const batches: Batch[] = [];
    for (const chunk of this.chunks.values()) if (chunk.group.visible) batches.push(...chunk.batches);
    for (const r of this.contexts) {
      const b = regionBounds(r), active = intersects(b, { minX: view.minX - 4, minY: view.minY - 4, maxX: view.maxX + 4, maxY: view.maxY + 4 }) || Math.hypot(Math.max(b.minX - player.x, 0, player.x - b.maxX), Math.max(b.minY - player.y, 0, player.y - b.maxY)) <= 30;
      if (r.ready && r.def.town && !r.town.parent) this.group.add(r.town);
      r.town.visible = active && r.ready;
      if (r.town.visible) { batches.push(...r.batches); for (const flame of r.flames) if (Math.hypot(flame.x - player.x, flame.z - player.y) <= 30) this.flames.push(flame); }
    }
    for (const batch of batches) {
      let changed = false;
      batch.entries.forEach((p, i) => {
        const dx = p.x + (batch.offset?.x ?? 0) - player.x, dz = p.z + (batch.offset?.y ?? 0) - player.y, front = dx + dz;
        const target = front > .2 && front < 6 && Math.abs(dx - dz) < 2.7 ? .15 : 1;
        const cut = p.cut + (target - p.cut) * Math.min(1, dt * 10);
        if (Math.abs(cut - p.cut) > .001) { p.cut = cut; this.instanceMatrix(p); batch.mesh.setMatrixAt(i, matrix); changed = true; }
      });
      if (changed) batch.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const p of this.props.values()) {
      if (p.lid) p.lid.rotation.x += ((p.source.used ? -1.3 : 0) - p.lid.rotation.x) * Math.min(1, dt * 8);
      if (p.glow) {
        const mat = p.glow.material as THREE.MeshBasicMaterial;
        p.glow.visible = p.source.kind !== 'shrine' || !p.source.used;
        mat.opacity = (p.source.kind === 'shrine' ? .75 : p.source.used ? .85 : .5) + Math.sin(time * 3 + p.phase) * .12;
      }
      if (p.orbs) {
        for (let i = 0; i < p.orbs.length; i++) {
          const angle = time * 1.2 + p.phase + i * TAU / p.orbs.length;
          p.orbs[i].position.set(Math.sin(angle) * .67, 1 + Math.cos(angle) * .67 * 1.4, 0);
          const mat = p.orbs[i].material as THREE.MeshBasicMaterial;
          mat.opacity = .55 + Math.sin(angle * 2 + p.phase) * .3;
        }
      }
      p.group.updateMatrixWorld(true);
      for (const flame of p.flames) this.flames.push(p.group.localToWorld(flame.clone()));
    }
  }

  private disposeObject(group: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    group.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node instanceof THREE.InstancedMesh) node.dispose();
      if (!this.sharedGeometry.has(node.geometry)) geometries.add(node.geometry);
      for (const m of Array.isArray(node.material) ? node.material : [node.material]) if (!this.sharedMaterials.has(m)) {
        materials.add(m); if (m instanceof THREE.MeshLambertMaterial && m.map && !this.sharedTextures.has(m.map)) textures.add(m.map);
      }
    });
    for (const geometry of geometries) geometry.dispose(); for (const texture of textures) texture.dispose(); for (const material of materials) material.dispose();
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true; this.ready = false; this.cancelTask();
    for (const r of this.contexts) { r.preparation?.return(undefined); if (!r.town.parent) this.disposeObject(r.town); }
    this.disposeObject(this.group); this.group.clear(); this.group.removeFromParent();
    for (const geometry of this.sharedGeometry) geometry.dispose(); for (const texture of this.sharedTextures) texture.dispose(); for (const material of this.sharedMaterials) material.dispose();
    this.sharedGeometry.clear(); this.sharedTextures.clear(); this.sharedMaterials.clear(); this.chunks.clear(); this.props.clear(); this.contexts = []; this.required.clear(); this.wanted.clear(); this.flames.length = 0;
  }
}
