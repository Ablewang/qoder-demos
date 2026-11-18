import * as THREE from 'three';
import type { AreaState, Point, WorldObject } from '../types';
import { box, cyl, cone, rock, ball, merge, hash } from './geo';

const GROUND_ART: Record<string, string> = { grass: 'earth', town: 'flagstone', jungle: 'earth', desert: 'sand', snow: 'snow', hell: 'volcanic', cave: 'basalt', dungeon: 'flagstone' };
const TAU = Math.PI * 2;
const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), vector = new THREE.Vector3(), scale = new THREE.Vector3();
interface Instance { x: number; z: number; yaw: number; size: number; cut: number }
interface Batch { mesh: THREE.InstancedMesh; entries: Instance[] }
interface Prop { source: WorldObject; group: THREE.Group; lid?: THREE.Group; glow?: THREE.Mesh; phase: number }

export class Terrain {
  readonly group = new THREE.Group();
  readonly flames: THREE.Vector3[] = [];
  private batches: Batch[] = [];
  private props: Prop[] = [];
  private districts: Terrain[] = [];
  private roads = new Set<string>();
  private material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private glowMaterial = new THREE.MeshBasicMaterial({ color: '#63bfff', transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

  constructor(readonly area: AreaState, texture: (key: string) => THREE.Texture, private readonly sceneryOnly = false) {
    if (area.regions) {
      const underlay = texture('earth').clone(); underlay.needsUpdate = true; underlay.wrapS = underlay.wrapT = THREE.RepeatWrapping; underlay.repeat.set(area.width / 4, area.height / 4);
      this.group.add(new THREE.Mesh(new THREE.PlaneGeometry(area.width, area.height).rotateX(-Math.PI / 2).translate(area.width / 2, -.2, area.height / 2), new THREE.MeshLambertMaterial({ map: underlay, color: '#78866b' })));
      for (const region of area.regions) {
        const local: AreaState = {
          def: region.def, width: region.width, height: region.height, seed: region.seed,
          spawn: { x: region.spawn.x - region.x, y: region.spawn.y - region.y },
          tiles: area.tiles.slice(region.y, region.y + region.height).map(row => row.slice(region.x, region.x + region.width)),
          revealed: [], monsters: [], drops: [],
          objects: area.objects.filter(o => o.regionId === region.def.id).map(o => ({ ...o, x: o.x - region.x, y: o.y - region.y })),
        };
        const district = new Terrain(local, texture, true);
        district.group.position.set(region.x, 0, region.y); this.group.add(district.group); this.districts.push(district);
        for (const flame of district.flames) this.flames.push(flame.clone().add(district.group.position));
      }
      const bridges: Point[] = [], banks: Point[] = [];
      for (let y = 0; y < area.height; y++) for (let x = 0; x < area.width; x++) {
        if (area.regions.some(r => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)) continue;
        if (area.tiles[y][x] === 0) bridges.push({ x, y });
        else if ([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => area.tiles[y + dy]?.[x + dx] === 0)) banks.push({ x, y });
      }
      if (bridges.length) {
        const positions: number[] = [], uvs: number[] = [];
        for (const p of bridges) for (const [dx, dy] of [[0, 0], [0, 1], [1, 0], [1, 0], [0, 1], [1, 1]]) { positions.push(p.x + dx, 0, p.y + dy); uvs.push((p.x + dx) / 4, (p.y + dy) / 4); }
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.computeVertexNormals();
        const map = texture('earth').clone(); map.needsUpdate = true; map.wrapS = map.wrapT = THREE.RepeatWrapping;
        this.group.add(new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map, color: '#d3c29a' })));
      }
      if (banks.length) {
        const mesh = new THREE.InstancedMesh(rock(.6, '#62694e', [0, .22, 0], [1, .7, 1]), this.material, banks.length);
        banks.forEach((p, i) => { matrix.makeRotationY(hash(p.x, p.y, area.seed) * TAU); matrix.setPosition(p.x + .5, 0, p.y + .5); mesh.setMatrixAt(i, matrix); });
        mesh.computeBoundingSphere(); this.group.add(mesh);
      }
    } else {
      this.traceRoads();
      this.ground(texture(GROUND_ART[[17, 26, 27, 32].includes(area.def.id) ? 'town' : area.def.style]));
      this.scenery();
    }
    if (!sceneryOnly) for (const object of area.objects) if (object.kind !== 'npc' && object.kind !== 'corpse') this.addProp(object);
  }

  private traceRoads(): void {
    if (!['grass', 'town'].includes(this.area.def.style)) return;
    const { width, height, tiles, spawn } = this.area;
    const start = Math.floor(spawn.y) * width + Math.floor(spawn.x), previous = new Int32Array(width * height).fill(-1), queue = [start];
    previous[start] = start;
    for (let i = 0; i < queue.length; i++) {
      const index = queue[i], x = index % width, y = Math.floor(index / width);
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy, next = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || tiles[ny][nx] !== 0 || previous[next] !== -1) continue;
        previous[next] = index; queue.push(next);
      }
    }
    for (const object of this.area.objects) {
      if (object.kind !== 'exit' && object.kind !== 'waypoint') continue;
      let index = Math.floor(object.y) * width + Math.floor(object.x);
      if (previous[index] < 0) continue;
      while (index !== start) {
        const x = index % width, y = Math.floor(index / width);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.roads.add(`${x + dx},${y + dy}`);
        index = previous[index];
      }
    }
  }

  private ground(texture: THREE.Texture): void {
    const { width: w, height: h, tiles, seed } = this.area;
    const map = texture.clone(); map.needsUpdate = true; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(w / 4, h / 4);
    const geometry = new THREE.PlaneGeometry(w, h, w * 2, h * 2).rotateX(-Math.PI / 2).translate(w / 2, 0, h / 2);
    const position = geometry.getAttribute('position'), colors = new Float32Array(position.count * 3);
    const indoor = ['dungeon', 'cave'].includes(this.area.def.style);
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), z = position.getZ(i), tx = Math.floor(x), ty = Math.floor(z);
      let walls = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tiles[ty + dy]?.[tx + dx]) walls++;
      const solid = !!tiles[ty]?.[tx];
      const brightness = (.88 + hash(Math.round(x * 2), Math.round(z * 2), seed) * .2) * (1 - walls * .04) * (solid ? indoor ? .18 : .7 : 1);
      const id = this.area.def.id, road = this.roads.has(`${tx},${ty}`);
      const tint = new THREE.Color(road ? '#dac6a0' : id === 5 ? '#829d76' : id === 6 ? '#849079' : id === 7 ? '#b7bab0' : '#c4c6b0');
      colors[i * 3] = brightness * tint.r; colors[i * 3 + 1] = brightness * tint.g; colors[i * 3 + 2] = brightness * tint.b;
      if (!indoor && !this.area.def.town && id !== 3 && id !== 6 && solid && walls >= 7 && tiles[ty - 1]?.[tx - 1] && tiles[ty - 1]?.[tx] && tiles[ty]?.[tx - 1]) position.setY(i, (id === 7 ? 1.1 : .35) * (.4 + Math.sin(x * .27 + seed) ** 2));
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map, vertexColors: true })); mesh.receiveShadow = true; this.group.add(mesh);
  }

  private mesh(geometry: THREE.BufferGeometry, parent: THREE.Object3D = this.group): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.material); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }

  private scenery(): void {
    const { width, height, tiles, seed, def } = this.area, style = def.style, id = def.id;
    const entries: Record<string, Instance[]> = { pine: [], tree: [], rock: [], wall: [], fence: [], tuft: [], grave: [], deadwood: [], water: [] };
    const add = (key: string, x: number, z: number, size: number) => entries[key].push({ x, z, size, yaw: hash(x * 17, z * 17, seed) * TAU, cut: 1 });
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const n = hash(x, y, seed), solid = !!tiles[y]?.[x];
      if (!solid) { if (n < .1 && style !== 'town' && style !== 'dungeon' && style !== 'cave') add('tuft', x + .5, y + .5, .7 + n * 4); continue; }
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const edge = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => tiles[y + dy]?.[x + dx] === 0);
      if (def.town) { if (border) add('fence', x + .5, y + .5, 1); continue; }
      if (style === 'dungeon') { if (edge || border) add('wall', x + .5, y + .5, 1); continue; }
      if (style === 'cave') { if (edge || border) add('rock', x + .5, y + .5, 1.3 + n * .7); continue; }
      if (id === 17) { if (edge) add(border ? 'fence' : 'grave', x + .5, y + .5, .75 + n * .4); continue; }
      if ([26, 27, 32].includes(id)) { if (edge || border) add(n < .75 ? 'wall' : 'deadwood', x + .5, y + .5, .7 + n * .3); continue; }
      if ((id === 3 || id === 6) && !border && Math.sin(x * .34 + seed % 7) + Math.cos(y * .3) > (id === 6 ? -.5 : .9)) { add('water', x + .5, y + .5, 1); if (edge && n < .35) add('deadwood', x + .5, y + .5, .7 + n); continue; }
      if (id === 4 && edge && n < .4) { add('grave', x + .5, y + .5, 1.4 + n); continue; }
      if (n < (id === 5 ? .92 : edge ? .78 : .42)) add(style === 'desert' || style === 'hell' || id === 7 || n < .2 ? 'rock' : id === 6 ? 'deadwood' : n < .55 ? 'pine' : 'tree', x + .3 + n * .4, y + .5, id === 7 ? 1.2 + n : .8 + n * .6);
    }
    const leaf = style === 'snow' ? '#b8c3bd' : style === 'hell' ? '#503b32' : id === 5 ? '#233b2c' : '#425439';
    const stone = style === 'desert' ? '#b49c70' : style === 'hell' ? '#493332' : id === 7 ? '#838679' : '#656860';
    const geometries: Record<string, THREE.BufferGeometry> = {
      pine: merge([cyl(.07, .13, 1.5, '#57432d', [0, .75, 0]), cone(.75, 1.6, leaf, [0, 1.5, 0]), cone(.58, 1.5, leaf, [0, 2.2, 0]), cone(.37, 1.2, leaf, [0, 2.8, 0])]),
      tree: merge([cyl(.07, .16, 1.8, '#594632', [0, .9, 0]), ball(.8, leaf, [0, 2.2, 0], [1.1, 1, .9], 1), ball(.55, leaf, [.45, 1.95, .15], 1, 0)]),
      rock: rock(.7, stone, [0, .6, 0], [1, 1.4, .9]),
      wall: merge([box(1, 2.1, 1, '#62635b', [0, 1.05, 0]), box(1.05, .15, 1.05, '#75786b', [0, 2.15, 0]), box(1.01, .06, 1.01, '#42433c', [0, 1.3, 0])]),
      fence: merge([cyl(.07, .1, 1.6, '#594530', [0, .8, 0]), cone(.1, .25, '#69553a', [0, 1.72, 0]), box(1, .08, .08, '#493824', [0, .65, 0]), box(1, .08, .08, '#493824', [0, 1.2, 0])]),
      tuft: merge([cone(.08, .35, style === 'snow' ? '#a4aba3' : id === 6 ? '#879264' : '#6b7048', [0, .17, 0], [0, 0, .2], 3), rock(.07, stone, [.16, .035, -.05], [1, .5, .7])]),
      grave: merge([box(.54, id === 17 ? .85 : 1.3, .22, '#8b897c', [0, id === 17 ? .42 : .65, 0], [0, 0, .08]), box(.67, .12, .5, '#5c5e52', [0, .06, 0]), box(.3, .045, .03, '#484b42', [0, .52, .12])]),
      deadwood: merge([cyl(.04, .13, 1.7, '#605b47', [0, .85, 0]), cyl(.03, .07, .9, '#71694f', [.26, 1.3, 0], [0, 0, -.65]), cyl(.025, .055, .7, '#71694f', [-.2, 1.05, .05], [0, 0, .7]), cone(.08, .6, '#89956a', [.2, .3, .2], [0, 0, -.2], 3)]),
      water: box(1, .04, 1, id === 6 ? '#3e5750' : '#536d6a', [0, .015, 0]),
    };
    for (const key in entries) {
      const points = entries[key], geometry = geometries[key];
      if (!points.length) { geometry.dispose(); continue; }
      const mesh = new THREE.InstancedMesh(geometry, this.material, points.length); mesh.castShadow = key !== 'tuft'; mesh.receiveShadow = true;
      points.forEach((point, i) => {
        if (key === 'wall' || key === 'water') point.yaw = 0;
        if (key === 'fence') point.yaw = point.x < 1 || point.x > width - 1 ? Math.PI / 2 : 0;
        this.instanceMatrix(point); mesh.setMatrixAt(i, matrix);
        mesh.setColorAt(i, new THREE.Color().setScalar(.82 + hash(i, 75, seed) * .3));
      });
      mesh.computeBoundingSphere(); this.group.add(mesh);
      if (key !== 'tuft' && key !== 'water') this.batches.push({ mesh, entries: points });
    }
    if (def.town) { this.buildings(); this.campfire(); }
  }

  private buildings(): void {
    const { tiles, width, height } = this.area, visited = new Set<string>();
    for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
      if (!tiles[y]?.[x] || visited.has(`${x},${y}`)) continue;
      const cells: Point[] = [], queue: Point[] = [{ x, y }]; visited.add(`${x},${y}`);
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i]; cells.push(p);
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const nx = p.x + dx, ny = p.y + dy, key = `${nx},${ny}`;
          if (nx < 2 || ny < 2 || nx >= width - 2 || ny >= height - 2 || visited.has(key) || !tiles[ny]?.[nx]) continue;
          visited.add(key); queue.push({ x: nx, y: ny });
        }
      }
      if (cells.length < 4) continue;
      const minX = Math.min(...cells.map(p => p.x)), maxX = Math.max(...cells.map(p => p.x)) + 1;
      const minZ = Math.min(...cells.map(p => p.y)), maxZ = Math.max(...cells.map(p => p.y)) + 1;
      const w = maxX - minX, d = maxZ - minZ;
      const geometry = merge([box(w, 2, d, '#6a6050', [0, 1, 0]), cone(Math.max(w, d) * .71, 1.9, '#4b3b2b', [0, 2.85, 0], [0, Math.PI / 4, 0], 4)]);
      const point = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, yaw: 0, size: 1, cut: 1 };
      const mesh = new THREE.InstancedMesh(geometry, this.material, 1); this.instanceMatrix(point); mesh.setMatrixAt(0, matrix); mesh.castShadow = true; mesh.receiveShadow = true;
      this.group.add(mesh); this.batches.push({ mesh, entries: [point] });
    }
  }

  private campfire(): void {
    const g = new THREE.Group(); g.position.set(17, 0, 12);
    this.mesh(merge([cyl(.5, .6, .1, '#444039', [0, .05, 0]), cyl(.09, .09, .7, '#35291c', [0, .17, 0], [0, 0, Math.PI / 2]), cyl(.08, .08, .7, '#35291c', [0, .22, 0], [Math.PI / 2, 0, 0])]), g);
    this.flames.push(new THREE.Vector3(17, .3, 12)); this.group.add(g);
  }

  private addProp(object: WorldObject): void {
    const g = new THREE.Group(); g.position.set(object.x, 0, object.y); this.group.add(g);
    const prop: Prop = { source: object, group: g, phase: hash(object.x, object.y, this.area.seed) * TAU }; this.props.push(prop);
    switch (object.kind) {
      case 'exit': {
        if (object.seam) {
          this.mesh(merge([cyl(.07, .11, 1.55, '#69573a', [0, .77, 0]), box(1.15, .28, .08, '#887247', [0, 1.4, 0]), cone(.2, .34, '#c0a775', [.65, 1.4, 0], [0, 0, -Math.PI / 2], 3)]), g);
          g.rotation.y = Math.PI / 4; break;
        }
        this.mesh(merge([box(.28, 2.2, .5, '#7d7464', [-.75, 1.1, 0]), box(.28, 2.2, .5, '#7d7464', [.75, 1.1, 0]), box(1.85, .32, .65, '#97907b', [0, 2.15, 0]), box(.4, .15, .65, '#97907b', [-.75, .1, 0]), box(.4, .15, .65, '#97907b', [.75, .1, 0])]), g);
        g.rotation.y = Math.atan2(this.area.width / 2 - object.x, this.area.height / 2 - object.y);
        const door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2), new THREE.MeshBasicMaterial({ color: '#080c0b', transparent: true, opacity: .78, side: THREE.DoubleSide })); door.position.set(0, 1, -.13); g.add(door);
        for (const side of [-1, 1]) { this.mesh(cyl(.07, .1, .8, '#4b4234', [side * 1.1, .4, 0]), g); const p = new THREE.Vector3(side * 1.1, .85, 0); g.updateMatrixWorld(true); this.flames.push(g.localToWorld(p)); }
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
        const glow = new THREE.Mesh(new THREE.TorusGeometry(.67, .07, 5, 40), this.glowMaterial.clone()); glow.scale.y = 1.4; glow.position.y = 1; g.add(glow); prop.glow = glow; g.rotation.y = Math.PI / 4;
        const disc = new THREE.Mesh(new THREE.CircleGeometry(.67, 40), new THREE.MeshBasicMaterial({ color: '#274d80', transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); disc.position.y = 1; disc.scale.y = 1.4; g.add(disc); break;
      }
      case 'shrine': {
        this.mesh(merge([cyl(.25, .4, .2, '#74726b', [0, .1, 0]), box(.18, 1, .18, '#929187', [0, .7, 0]), ball(.16, '#8bb69b', [0, 1.3, 0], [1, 1.4, 1], 0)]), g); break;
      }
    }
  }

  private instanceMatrix(p: Instance): void {
    quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.yaw);
    matrix.compose(vector.set(p.x, 0, p.z), quaternion, scale.set(p.size, p.size * p.cut, p.size));
  }

  update(player: Point, dt: number, time: number): void {
    for (const district of this.districts) {
      const x = district.group.position.x, y = district.group.position.z;
      const dx = Math.max(x - player.x, 0, player.x - x - district.area.width), dy = Math.max(y - player.y, 0, player.y - y - district.area.height);
      district.group.visible = Math.hypot(dx, dy) < 32;
      if (district.group.visible) district.update({ x: player.x - x, y: player.y - y }, dt, time);
    }
    for (const batch of this.batches) {
      let changed = false;
      batch.entries.forEach((p, i) => {
        const dx = p.x - player.x, dz = p.z - player.y, front = dx + dz;
        const target = front > .2 && front < 6 && Math.abs(dx - dz) < 2.7 ? .15 : 1;
        const cut = p.cut + (target - p.cut) * Math.min(1, dt * 10);
        if (Math.abs(cut - p.cut) > .001) { p.cut = cut; this.instanceMatrix(p); batch.mesh.setMatrixAt(i, matrix); changed = true; }
      });
      if (changed) batch.mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.sceneryOnly) return;
    const known = new Set(this.props.map(p => p.source.uid));
    for (const object of this.area.objects) if (!known.has(object.uid) && object.kind !== 'npc' && object.kind !== 'corpse') this.addProp(object);
    for (let i = this.props.length - 1; i >= 0; i--) {
      const p = this.props[i];
      if (!this.area.objects.some(o => o.uid === p.source.uid)) { this.disposeObject(p.group); p.group.removeFromParent(); this.props.splice(i, 1); continue; }
      p.group.visible = Math.hypot(p.source.x - player.x, p.source.y - player.y) < 30;
      if (p.lid) p.lid.rotation.x += ((p.source.used ? -1.3 : 0) - p.lid.rotation.x) * Math.min(1, dt * 8);
      if (p.glow) { const mat = p.glow.material as THREE.MeshBasicMaterial; mat.opacity = (p.source.used ? .85 : .5) + Math.sin(time * 3 + p.phase) * .12; if (p.source.kind === 'portal') p.glow.rotation.z = time * .4; }
    }
  }

  private disposeObject(group: THREE.Object3D): void {
    group.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      for (const m of Array.isArray(node.material) ? node.material : [node.material]) if (m !== this.material && m !== this.glowMaterial) {
        if (m instanceof THREE.MeshLambertMaterial) m.map?.dispose(); m.dispose();
      }
    });
  }
  dispose(): void { for (const district of this.districts) district.dispose(); this.districts = []; this.disposeObject(this.group); this.material.dispose(); this.glowMaterial.dispose(); this.group.removeFromParent(); }
}
