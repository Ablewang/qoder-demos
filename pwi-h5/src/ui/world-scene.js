import * as THREE from '../vendor/three.module.js';
import { CLASSES } from '../data/classes.js';
import { ZONES } from '../data/world.js';
import { ZONE_LANDMARKS } from '../data/landmarks.js';

// One context for the mounted view, including main's full-DOM replacements.
let live = null;
let systemFailed = false;
const TAU = Math.PI * 2;
const WEAPONS = new Set(['blade', 'sword', 'axe', 'bow', 'dagger', 'wand', 'soulsphere', 'glaive']);
const FRAME_MS = 1000 / 30;

function snapshot(input = {}) {
  const cls = Object.hasOwn(CLASSES, input.cls) ? input.cls : 'blademaster';
  const profession = CLASSES[cls];
  const weapon = input.equipment?.weapon?.weaponType;
  const location = String(input.location ?? 'wanliu');
  const monsters = Array.isArray(input.monsters) ? input.monsters : [];
  const explorable = Boolean(input.explorable);
  const roster = monsters.slice(0, explorable ? 12 : 4);
  const selected = monsters.find(monster => monster.id === input.targetId);
  if (selected && !roster.includes(selected)) roster[explorable ? 11 : 3] = selected;
  return {
    cls, location, race: input.race ?? profession.race,
    city: input.city === undefined ? ZONES[location]?.type === 'city' : Boolean(input.city),
    active: Boolean(input.active),
    explorable, movementEnabled: Boolean(input.movementEnabled),
    weapon: WEAPONS.has(weapon) ? weapon : profession.weapon,
    armor: profession.armor,
    round: Number.isFinite(input.round) ? input.round : 0,
    rt: input.rt ? structuredClone(input.rt) : null,
    hp: Number.isFinite(input.hp) ? input.hp : null,
    showcase: !explorable && !input.rt && monsters.length === 0,
    targetId: input.targetId ?? null,
    monsters: roster.map((m) => ({
      id: m.id, name: String(m.name ?? ''), rank: m.rank ?? '', intent: m.intent ?? 'attack',
      hp: Number.isFinite(m.hp) ? m.hp : 1,
      maxHp: Number.isFinite(m.maxHp) ? m.maxHp : 1,
      lv: Number.isFinite(m.lv) ? m.lv : 1,
      aggro: Number.isFinite(m.aggro) ? m.aggro : 0,
      ambient: Boolean(m.ambient),
    })),
  };
}

function hash(text) {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

// Each independently replaceable layer owns its GPU resources. Geometry/material
// pooling is local to that layer, so rebuilding a roster cannot dispose the map.
function kit() {
  const geometries = new Map();
  const materials = new Map();
  return {
    geometry(key, create) {
      if (!geometries.has(key)) geometries.set(key, create());
      return geometries.get(key);
    },
    material(color, options = {}) {
      const key = `${color}:${JSON.stringify(options)}`;
      if (!materials.has(key)) {
        const material = new THREE.MeshStandardMaterial({
          color, roughness: 0.78, metalness: 0.025, flatShading: false, ...options,
        });
        material.userData.baseEmission = material.emissive.clone();
        material.userData.baseIntensity = material.emissiveIntensity;
        materials.set(key, material);
      }
      return materials.get(key);
    },
    eachMaterial(fn) { materials.forEach(fn); },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      geometries.clear();
      materials.clear();
    },
  };
}

function group(parent, position = [0, 0, 0]) {
  const result = new THREE.Group();
  result.position.set(...position);
  parent.add(result);
  return result;
}

function mesh(parent, resources, geometry, color, position, scale = [1, 1, 1], options) {
  const result = new THREE.Mesh(geometry, resources.material(color, options));
  result.position.set(...position);
  result.scale.set(...scale);
  parent.add(result);
  return result;
}

function box(parent, k, color, position, size) {
  return mesh(parent, k, k.geometry('box', () => new THREE.BoxGeometry()), color, position, size);
}

function stone(parent, k, color, position, size) {
  return mesh(parent, k, k.geometry('stone', () => new THREE.IcosahedronGeometry(1, 2)), color, position, size);
}

function sphere(parent, k, color, position, size, options) {
  return mesh(parent, k, k.geometry('sphere', () => new THREE.SphereGeometry(1, 20, 14)), color, position, size, options);
}

function cylinder(parent, k, color, position, top, bottom, height, segments = 16) {
  const geo = k.geometry(`cylinder:${top}:${bottom}:${segments}`, () => new THREE.CylinderGeometry(top, bottom, 1, segments));
  return mesh(parent, k, geo, color, position, [1, height, 1]);
}

function rod(parent, k, color, start, end, radius = 0.035) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const result = cylinder(parent, k, color, a.clone().add(b).multiplyScalar(0.5).toArray(), radius, radius, a.distanceTo(b), 10);
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return result;
}

function shapeGeometry(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function contact(parent, k, radius, opacity = 0.18) {
  const result = mesh(parent, k, k.geometry('contact', () => new THREE.CircleGeometry(1, 24)), 0x050c17,
    [0, 0.029, 0], [radius, radius * 0.72, 1], { transparent: true, opacity, depthWrite: false });
  result.rotation.x = -Math.PI / 2;
  return result;
}

function ring(parent, k, radius, color = 0xdcbf87) {
  const result = mesh(parent, k, k.geometry(`ring:${radius}`, () => new THREE.RingGeometry(radius, radius + 0.04, 32)),
    color, [0, 0.034, 0], [1, 1, 1], { emissive: color, emissiveIntensity: 0.2, side: THREE.DoubleSide });
  result.rotation.x = -Math.PI / 2;
  return result;
}

function roofGeometry() {
  // Upturned corners and layered eaves, not a reconstruction of any official map.
  const positions = [];
  const levels = [[1.12, 0], [0.98, 0.12], [0.7, 0.43], [0.04, 0.85]];
  const point = (level, corner) => {
    const [r, y] = levels[level];
    const x = corner === 0 || corner === 3 ? -r : r;
    const z = corner < 2 ? -r : r;
    return [x, y + (level === 0 ? 0.13 : 0), z];
  };
  for (let level = 0; level < levels.length - 1; level++) {
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      positions.push(...point(level, i), ...point(level + 1, i), ...point(level, next));
      positions.push(...point(level, next), ...point(level + 1, i), ...point(level + 1, next));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function lantern(parent, k, position, palette, size = 1) {
  const lamp = group(parent, position);
  lamp.scale.setScalar(size);
  rod(lamp, k, palette.wood, [0, 0.08, 0], [0, 0.35, 0], 0.025);
  modelingSphere(lamp, k, 0xffd295, [0, 0, 0], [0.14, 0.18, 0.14], { emissive: 0xffbc65, emissiveIntensity: 0.3 });
  for (const y of [-0.17, 0.17]) cylinder(lamp, k, palette.trim, [0, y, 0], 0.11, 0.11, 0.04, 10);
  rod(lamp, k, 0xb5654c, [0, -0.19, 0], [0, -0.29, 0], 0.017);
  cylinder(lamp, k, palette.trim, [0, -0.32, 0], 0.023, 0.037, 0.09, 6);
}

function layeredRoof(parent, k, position, size, palette) {
  for (let tier = 0; tier < 2; tier++) {
    mesh(parent, k, k.geometry('roof', roofGeometry), tier ? palette.roof : palette.trim,
      [position[0], position[1] + tier * 0.09, position[2]],
      [size[0] * (tier ? 0.94 : 1), size[1], size[2] * (tier ? 0.94 : 1)], { side: THREE.DoubleSide });
  }
  modelingSphere(parent, k, palette.trim, [position[0], position[1] + size[1] * 0.85 + 0.15, position[2]], [0.1, 0.16, 0.1]);
  const seams = group(parent, position);
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    rod(seams, k, palette.trim, [x * size[0] * 1.08, size[1] * 0.17, z * size[2] * 1.08], [x * size[0] * 0.69, size[1] * 0.44 + 0.1, z * size[2] * 0.69], 0.025);
    rod(seams, k, palette.trim, [x * size[0] * 0.69, size[1] * 0.44 + 0.1, z * size[2] * 0.69], [x * size[0] * 0.04, size[1] * 0.85 + 0.1, z * size[2] * 0.04], 0.025);
  }
  seams.userData.modelingBatch = true;
}

function pavilion(parent, k, position, size, palette, enclosed = false) {
  const building = group(parent, position);
  building.scale.setScalar(size);
  building.userData.navigationFootprint = [1.12, 1.02];
  contact(building, k, 1.4, 0.15);
  box(building, k, palette.stone, [0, 0.12, 0], [2.2, 0.24, 2]);
  box(building, k, palette.stone, [0, 0.27, 0], [1.9, 0.12, 1.7]);
  if (enclosed) {
    box(building, k, 0xefe1c5, [0, 1.14, 0], [1.64, 1.65, 1.42]);
    box(building, k, palette.wood, [0, 0.9, 0.725], [0.48, 1.16, 0.07]);
    sphere(building, k, palette.trim, [0.15, 0.91, 0.776], [0.035, 0.035, 0.025]);
    for (const x of [-0.55, 0.55]) {
      box(building, k, palette.wood, [x, 1.32, 0.736], [0.34, 0.46, 0.06]);
      box(building, k, 0xffdba1, [x, 1.32, 0.774], [0.25, 0.35, 0.025]);
      box(building, k, palette.wood, [x, 1.32, 0.792], [0.025, 0.35, 0.025]);
      box(building, k, palette.wood, [x, 1.32, 0.792], [0.25, 0.025, 0.025]);
    }
  }
  for (const x of [-0.76, 0.76]) for (const z of [-0.66, 0.66]) {
    cylinder(building, k, palette.wood, [x, 1.18, z], 0.075, 0.1, 1.76);
    cylinder(building, k, palette.trim, [x, 0.42, z], 0.12, 0.12, 0.17);
  }
  box(building, k, palette.wood, [0, 2, 0], [1.85, 0.17, 1.7]);
  layeredRoof(building, k, [0, 2.02, 0], [1.12, 0.8, 1.02], palette);
  for (const x of [-0.75, 0.75]) lantern(building, k, [x, 1.7, 0.78], palette, 0.8);
  return building;
}

function buildEnvironment(state) {
  const k = kit();
  const root = new THREE.Group();
  const landmark = ZONE_LANDMARKS[state.location] ?? ZONE_LANDMARKS.wanliu;
  const p = { ...landmark.palette };
  for (const key of ['ground', 'stone', 'wood']) p[key] = new THREE.Color(p[key]).lerp(new THREE.Color(0xf0d6b5), 0.055).getHex();
  const sphere = modelingSphere;
  const { motif, biome } = landmark;
  // A finite, bevel-like toy island: no endless plane or interchangeable forest.
  const base = cylinder(root, k, p.stone, [0, -0.32, -1.6], 1, 0.96, 0.6, 64);
  const radiusX = state.explorable ? 18 : 7.3;
  const radiusZ = state.explorable ? 15 : 5.9;
  base.scale.set(radiusX, 0.6, radiusZ);
  const turf = cylinder(root, k, p.ground, [0, -0.055, -1.6], 1, 1, 0.13, 64);
  turf.scale.set(radiusX - 0.1, 0.13, radiusZ - 0.1);
  const dressing = group(root);
  const focal = group(dressing, [0, 0, -4.35]);

  const hill = (parent, x, z, width, height) => {
    stone(parent, k, p.stone, [x, height * 0.42, z], [width, height * 0.65, width * 0.68]);
    sphere(parent, k, p.foliage, [x - width * 0.1, height * 0.65, z], [width * 0.78, height * 0.24, width * 0.57]);
  };
  const tree = (parent, position, size = 1, color = p.foliage, bare = false) => {
    const t = group(parent, position);
    t.scale.setScalar(size);
    contact(t, k, 0.9, 0.12);
    cylinder(t, k, p.wood, [0, 0.85, 0], 0.13, 0.22, 1.7);
    for (const side of [-1, 1]) {
      rod(t, k, p.wood, [0, 0.9, 0], [side * 0.65, 1.8, 0], 0.085);
      rod(t, k, p.wood, [side * 0.65, 1.8, 0], [side * 0.92, 2.12, -0.12], 0.045);
    }
    if (!bare) {
      const shade = new THREE.Color(color).lerp(new THREE.Color(0x345d4b), 0.18).getHex();
      const light = new THREE.Color(color).lerp(new THREE.Color(0xffe8bc), 0.18).getHex();
      sphere(t, k, shade, [0, 1.98, -0.08], [1.04, 0.52, 0.79]);
      for (const side of [-1, 1]) {
        sphere(t, k, color, [side * 0.66, 2.14, 0.13], [0.69, 0.5, 0.65]);
        sphere(t, k, light, [side * 0.33, 2.66, -0.07], [0.6, 0.48, 0.55]);
      }
      sphere(t, k, color, [-0.21, 2.43, 0.32], [0.77, 0.54, 0.56]);
    }
    return t;
  };
  const patch = (parent, color, position, size) => {
    const m = mesh(parent, k, k.geometry('patch', () => new THREE.CircleGeometry(1, 48)), color,
      position, [size[0], size[1], 1], { roughness: 0.56 });
    m.rotation.x = -Math.PI / 2;
    return m;
  };
  const water = (position, size) => {
    patch(dressing, p.water, position, size);
    for (let i = 0; i < 5; i++) {
      const ripple = mesh(dressing, k, k.geometry('ripple', () => new THREE.TorusGeometry(1, 0.012, 6, 32, Math.PI * 1.3)),
        0xd6f0ec, [position[0] - size[0] * 0.5 + i * size[0] * 0.22, position[1] + 0.012, position[2] + (i % 2 ? 0.3 : -0.32)],
        [0.35 + i * 0.07, 0.17, 1]);
      ripple.rotation.x = -Math.PI / 2;
    }
  };
  const steps = (parent, width = 2, count = 4) => {
    for (let i = 0; i < count; i++) box(parent, k, p.stone, [0, 0.06 + i * 0.1, 1.3 - i * 0.22], [width, 0.12 + i * 0.2, 0.33]);
  };
  const arch = (parent, width = 1.6, height = 2.5, ruined = false) => {
    for (const side of [-1, 1]) {
      cylinder(parent, k, p.stone, [side * width, height * 0.45, 0], 0.32, 0.42, height * 0.9);
      cylinder(parent, k, p.trim, [side * width, 0.3, 0], 0.46, 0.46, 0.16);
    }
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-width, height * 0.85, 0), new THREE.Vector3(-width * 0.65, height * 1.1, 0),
      new THREE.Vector3(0, height * 1.22, 0), new THREE.Vector3(width * 0.65, height * 1.1, 0), new THREE.Vector3(width, height * 0.85, 0),
    ]);
    mesh(parent, k, k.geometry(`arch:${width}:${height}:${ruined}`, () => new THREE.TubeGeometry(curve, 24, 0.3, 12, false)),
      p.stone, [0, 0, 0], ruined ? [1, 1, 0.72] : [1, 1, 1]);
    if (ruined) {
      box(parent, k, p.roof, [0.34, height * 1.2, 0.01], [0.15, 0.62, 0.64]).rotation.z = -0.3;
      stone(parent, k, p.stone, [width * 0.6, 0.24, 0.8], [0.5, 0.25, 0.4]);
    } else lantern(parent, k, [0, height, 0.12], p, 1.3);
  };
  const banner = (parent, position, color = p.roof, size = 1) => {
    const b = group(parent, position);
    b.scale.setScalar(size);
    cylinder(b, k, p.wood, [0, 1.4, 0], 0.045, 0.075, 2.8);
    sphere(b, k, p.trim, [0, 2.85, 0], [0.09, 0.1, 0.09]);
    mesh(b, k, k.geometry('banner', () => shapeGeometry([[0, 0], [0.8, -0.08], [0.68, -0.65], [0, -0.56]])),
      color, [0.02, 2.58, 0], [1, 1, 1], { side: THREE.DoubleSide });
    sphere(b, k, p.trim, [0.37, 2.25, 0.025], [0.12, 0.14, 0.025]);
  };
  const crystal = (parent, position, size = 1, color = p.roof) => {
    const c = group(parent, position);
    c.scale.setScalar(size);
    cylinder(c, k, color, [0, 0.6, 0], 0.23, 0.3, 1.2, 6);
    cylinder(c, k, color, [0, 1.37, 0], 0, 0.23, 0.34, 6);
    cylinder(c, k, p.trim, [0, 0.12, 0], 0.34, 0.36, 0.16, 6);
    return c;
  };
  const lotus = (parent, position, size = 1) => {
    const l = group(parent, position);
    l.scale.setScalar(size);
    patch(l, p.foliage, [0, 0.04, 0], [0.7, 0.55]);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU;
      const petal = sphere(l, k, 0xf1bfd4, [Math.sin(a) * 0.34, 0.26, Math.cos(a) * 0.34], [0.17, 0.42, 0.23]);
      petal.rotation.z = -Math.sin(a) * 0.5;
      petal.rotation.x = Math.cos(a) * 0.5;
    }
    sphere(l, k, p.trim, [0, 0.28, 0], [0.23, 0.2, 0.23]);
    return l;
  };
  const coral = (parent, position, size = 1) => {
    const c = group(parent, position);
    c.scale.setScalar(size);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.3;
      rod(c, k, 0xe9aaa7, [0, 0, 0], [x, 0.8 + i * 0.18, 0], 0.09);
      for (const side of [-1, 1]) {
        rod(c, k, 0xe9aaa7, [x, 0.57 + i * 0.14, 0], [x + side * 0.23, 0.89 + i * 0.18, 0.08], 0.055);
        sphere(c, k, 0xf5c8ba, [x + side * 0.23, 0.89 + i * 0.18, 0.08], [0.065, 0.08, 0.065]);
      }
    }
  };
  const boat = (parent, position, size = 1, wreck = false) => {
    const b = group(parent, position);
    b.scale.setScalar(size);
    b.rotation.y = -0.35;
    if (wreck) b.rotation.z = -0.25;
    sphere(b, k, p.wood, [0, 0.19, 0], [0.52, 0.28, 1.26]);
    box(b, k, p.trim, [0, 0.35, 0], [0.78, 0.1, 1.7]);
    cylinder(b, k, p.wood, [0, 1.25, 0], 0.045, 0.06, 2);
    const sail = k.geometry('sail', () => shapeGeometry([[0, 0], [0.85, -0.98], [0, -1.08]]));
    mesh(b, k, sail, 0xffefd0, [0.06, 2.18, 0], [1, 1, 1], { side: THREE.DoubleSide });
    if (!wreck) mesh(b, k, sail, p.roof, [-0.05, 1.98, 0], [-0.7, 0.8, 1], { side: THREE.DoubleSide });
    return b;
  };
  const bridge = (position, size = 1, wooden = false) => {
    const b = group(dressing, position);
    b.scale.setScalar(size);
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * 0.38;
      const y = 0.2 + Math.cos((i - 4) / 4 * Math.PI / 2) * 0.45;
      box(b, k, wooden ? p.wood : p.stone, [x, y, 0], [0.4, 0.16, 1]);
      for (const side of [-1, 1]) {
        cylinder(b, k, p.trim, [x, y + 0.3, side * 0.5], 0.035, 0.05, 0.6);
        if (i < 8) rod(b, k, p.wood, [x, y + 0.56, side * 0.5], [x + 0.38, 0.76 + Math.cos((i - 3) / 4 * Math.PI / 2) * 0.45, side * 0.5], 0.03);
      }
    }
    return b;
  };
  const cave = (treasure = false) => {
    // Open-front cutaway instead of a giant solid rock hiding a cave door.
    for (const side of [-1, 1]) {
      stone(focal, k, p.stone, [side * 2, 1.55, 0], [1.2, 2, 1.25]);
      stone(focal, k, p.stone, [side * 1.9, 3.1, -0.4], [1.05, 1.35, 1.2]);
    }
    stone(focal, k, p.stone, [0, 3.8, -0.5], [2.1, 0.9, 1.3]);
    box(focal, k, 0x686779, [0, 1.45, -0.9], [3.6, 2.9, 0.3]);
    arch(focal, 1.25, 2.35);
    steps(focal, 2.5);
    for (const side of [-1, 1]) lantern(focal, k, [side * 1.4, 1.3, 0.4], p, 1.3);
    if (treasure) {
      for (const x of [-1.2, 0.2, 1.15]) crystal(focal, [x, 0.2, -0.35], x === 0.2 ? 1.5 : 0.9);
      box(focal, k, p.wood, [0.15, 0.46, 0.65], [0.9, 0.65, 0.62]);
      sphere(focal, k, p.wood, [0.15, 0.8, 0.65], [0.46, 0.2, 0.32]);
      for (const x of [-0.13, 0.43]) box(focal, k, p.trim, [x, 0.6, 0.99], [0.07, 0.67, 0.03]);
      for (let i = 0; i < 7; i++) cylinder(focal, k, p.trim, [-0.7 + i * 0.17, 0.06 + (i % 3) * 0.025, 1.4], 0.12, 0.12, 0.045);
    }
  };
  const dragon = (parent, position, side = 1, color = p.trim) => {
    const d = group(parent, position);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.2, 0, 0), new THREE.Vector3(side * 0.5, 0.75, -0.12),
      new THREE.Vector3(-side * 0.15, 1.55, 0), new THREE.Vector3(0, 2.15, 0.12),
    ]);
    mesh(d, k, k.geometry(`dragon:${side}`, () => new THREE.TubeGeometry(curve, 24, 0.18, 12, false)), color, [0, 0, 0]);
    sphere(d, k, color, [0, 2.25, 0.22], [0.32, 0.28, 0.38]);
    sphere(d, k, p.stone, [0, 2.18, 0.53], [0.25, 0.17, 0.26]);
    for (const s of [-1, 1]) {
      sphere(d, k, 0x445560, [s * 0.21, 2.32, 0.43], [0.05, 0.055, 0.04]);
      rod(d, k, p.trim, [s * 0.18, 2.42, 0.05], [s * 0.32, 2.8, -0.03], 0.055);
    }
    for (let i = 0; i < 4; i++) sphere(d, k, p.roof, [side * 0.1, 0.3 + i * 0.43, -0.18], [0.16, 0.13, 0.12]);
  };

  // Broad playable foreground; tall props begin behind z=-2.4, well away
  // from the encounter positions and their limited +/-0.45 yaw orbit.
  patch(dressing, new THREE.Color(p.ground).lerp(new THREE.Color(0xffe7c2), 0.3).getHex(), [0, 0.012, 0.3], [4.1, 2.85]);
  const paved = state.city || ['underground-tomb', 'treasure-cavern', 'coral-palace'].includes(motif);
  for (let i = 0; i < 10; i++) {
    const x = Math.sin(i * 0.45) * (paved ? 0.1 : 0.65) - 0.35;
    box(dressing, k, p.stone, [x, 0.018, 2.5 - i * 0.62], [paved ? 1.65 : 0.95, 0.015, 0.53]);
  }
  const coastal = ['coral-coast', 'coastal-village', 'rocky-coast', 'beach', 'harbor', 'haunted-island', 'jungle-island', 'underwater'].includes(biome);
  if (coastal) water([3.9, 0.031, -3.5], [2.45, 2.75]);
  if (['river-city', 'riverbank'].includes(biome)) {
    water([0, 0.029, -3.1], [5.65, 1.1]);
    bridge([0, 0.02, -3.05], 0.75);
  }
  if (['steep-hills', 'wooded-valley', 'misty-mountains', 'cliff-town', 'spirit-foothills'].includes(biome)) {
    hill(dressing, -4.7, -4.4, 1.7, biome === 'misty-mountains' ? 4.3 : 3.3);
    hill(dressing, 4.1, -5, 1.75, biome === 'steep-hills' ? 4.5 : 3.3);
  }

  switch (motif) {
    case 'sword-monument': {
      cylinder(focal, k, p.stone, [0, 0.55, 0], 1.1, 1.4, 1.1, 12);
      steps(focal, 2.2);
      const sword = buildWeapon(focal, k, 'sword');
      sword.position.set(0, 1.3, 0);
      sword.scale.setScalar(3.05);
      sword.rotation.z = 0;
      ring(focal, k, 1.65, p.trim);
      for (const side of [-1, 1]) pavilion(dressing, k, [side * 4.15, 0, -2.8], 0.68, p, true);
      break;
    }
    case 'ancient-tree': {
      const t = tree(focal, [0, 0, -0.4], 1.75);
      t.scale.set(1.85, 1.8, 1.55);
      // A substantial inhabitable trunk, with a door and branch-mounted homes.
      cylinder(focal, k, p.wood, [0, 1.6, -0.3], 0.68, 0.95, 3.2);
      sphere(focal, k, 0x66513f, [0, 0.92, 0.48], [0.35, 0.72, 0.05]);
      box(focal, k, p.trim, [0, 0.86, 0.54], [0.04, 1.1, 0.04]);
      for (const side of [-1, 1]) {
        rod(focal, k, p.wood, [0, 2.6, -0.1], [side * 2.1, 2, 0], 0.2);
        pavilion(focal, k, [side * 2.05, 1.8, 0], 0.62, p, true);
        for (const x of [side * 1.6, side * 2.45]) rod(focal, k, p.trim, [x, 2, 0], [x * 0.55, 4.1, -0.3], 0.025);
        lantern(focal, k, [side * 1.35, 2.8, 0.45], p);
      }
      bridge([-3.45, 0, -2.75], 0.65, true);
      break;
    }
    case 'beast-stronghold':
    case 'beach-fort': {
      const beach = motif === 'beach-fort';
      arch(focal, 1.2, 2.35);
      for (const side of [-1, 1]) {
        const tower = group(focal, [side * 2.25, 0, -0.2]);
        cylinder(tower, k, p.stone, [0, 1.2, 0], 0.8, 1, 2.4, 12);
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * TAU;
          box(tower, k, p.stone, [Math.sin(a) * 0.7, 2.55, Math.cos(a) * 0.7], [0.35, 0.45, 0.35]);
        }
        box(tower, k, p.wood, [0, 1.5, 0.88], [0.22, 0.52, 0.06]);
        banner(tower, [0, 2.5, 0], p.roof, 0.65);
        if (!beach) {
          sphere(tower, k, p.trim, [0, 2.95, 0.55], [0.54, 0.46, 0.3]);
          for (const s of [-1, 1]) {
            sphere(tower, k, p.wood, [s * 0.19, 3.05, 0.8], [0.055, 0.07, 0.04]);
            cylinder(tower, k, p.trim, [s * 0.34, 3.34, 0.53], 0, 0.16, 0.35, 10);
          }
          sphere(tower, k, p.stone, [0, 2.84, 0.84], [0.25, 0.18, 0.14]);
        }
      }
      for (const side of [-1, 1]) for (let i = 0; i < 6; i++) cylinder(dressing, k, p.wood, [side * (3.3 + i * 0.25), 0.7, -2.7], 0.035, 0.07, 1.4);
      if (beach) boat(dressing, [4.8, 0.06, -2.8], 0.7);
      break;
    }
    case 'shell-tide-gate':
    case 'coral-palace': {
      const palace = motif === 'coral-palace';
      arch(focal, 1.5, 2.6);
      for (let i = 0; i < 9; i++) {
        const a = (i - 4) * 0.18;
        const rib = sphere(focal, k, i % 2 ? p.stone : p.trim, [Math.sin(a) * 1.8, 3.3 + Math.cos(a) * 0.6, -0.15], [0.17, 1.12, 0.25]);
        rib.rotation.z = -a;
      }
      sphere(focal, k, 0xfff2d9, [0, 2.65, 0.35], [0.3, 0.3, 0.3], { roughness: 0.3 });
      for (const side of [-1, 1]) {
        coral(dressing, [side * 4.3, 0, -3.4], 1.4);
        if (palace) pavilion(focal, k, [side * 2.7, 0.1, -0.2], 0.73, p, true);
      }
      steps(focal, 2.8);
      if (palace) for (let i = 0; i < 7; i++) sphere(dressing, k, 0xe0f1f2, [-4.8 + i * 1.5, 1.6 + (i % 3) * 0.9, -4.9], [0.12, 0.12, 0.12], { transparent: true, opacity: 0.48, depthWrite: false, roughness: 0.2 });
      break;
    }
    case 'lotus-crystal-shrine': {
      contact(focal, k, 2.4, 0.12);
      const l = lotus(focal, [0, 0.65, 0], 2.15);
      cylinder(l, k, p.stone, [0, 0.4, 0], 0.63, 0.8, 0.3);
      crystal(l, [0, 0.65, 0], 1.15);
      for (const side of [-1, 1]) {
        stone(focal, k, p.stone, [side * 2.45, 1.3, 0], [0.65, 0.38, 0.6]);
        pavilion(focal, k, [side * 2.45, 1.45, 0], 0.5, p);
      }
      water([-3.7, 0.031, -2.8], [1.65, 1.4]);
      break;
    }
    case 'twin-dragon-arch':
      arch(focal, 1.6, 2.9);
      for (const side of [-1, 1]) {
        dragon(focal, [side * 1.7, 1.15, 0.25], side);
        pavilion(dressing, k, [side * 4.4, 0, -4.25], 0.85, p, true);
      }
      break;
    case 'harbor-lighthouse': {
      const lighthouse = group(focal, [-1.25, 0, -0.3]);
      cylinder(lighthouse, k, p.stone, [0, 1.85, 0], 0.48, 0.77, 3.7, 20);
      for (const y of [1.1, 2.5]) cylinder(lighthouse, k, p.roof, [0, y, 0], y === 1.1 ? 0.7 : 0.6, y === 1.1 ? 0.7 : 0.6, 0.22, 20);
      box(lighthouse, k, p.wood, [0, 0.7, 0.73], [0.36, 1.12, 0.07]);
      for (const y of [1.8, 3]) box(lighthouse, k, p.roof, [0, y, 0.64], [0.23, 0.32, 0.07]);
      cylinder(lighthouse, k, p.trim, [0, 3.9, 0], 0.74, 0.74, 0.16);
      lantern(lighthouse, k, [0, 4.2, 0], p, 2);
      layeredRoof(lighthouse, k, [0, 4.5, 0], [0.7, 0.55, 0.7], p);
      const pier = group(dressing, [2.85, 0, -3.5]);
      for (let i = 0; i < 11; i++) box(pier, k, p.wood, [0, 0.17, (i - 5) * 0.32], [1.12, 0.12, 0.28]);
      for (const z of [-1.4, 0, 1.4]) for (const side of [-1, 1]) cylinder(pier, k, p.wood, [side * 0.52, 0.3, z], 0.065, 0.08, 0.65);
      boat(dressing, [4.3, 0.08, -3.35], 0.92);
      boat(dressing, [1.55, 0.06, -4.8], 0.62);
      pavilion(dressing, k, [-4.3, 0, -3.1], 0.75, p, true);
      break;
    }
    case 'roadside-inn':
    case 'sunset-bell-town':
    case 'cliff-teahouse': {
      const cliff = motif === 'cliff-teahouse';
      if (cliff) hill(focal, 0, -0.4, 2.1, 1.3);
      pavilion(focal, k, [0, cliff ? 0.9 : 0, 0], 1.2, p, true);
      pavilion(focal, k, [0, cliff ? 3.1 : 2.2, 0], 0.72, p, true);
      box(focal, k, p.wood, [1.75, 1.5, 0.5], [0.6, 0.9, 0.14]);
      box(focal, k, p.trim, [1.75, 1.5, 0.59], [0.43, 0.64, 0.03]);
      pavilion(dressing, k, [-3.9, 0, -3], 0.67, p);
      if (motif === 'sunset-bell-town') {
        cylinder(focal, k, p.trim, [-2.3, 2.1, 0], 0.25, 0.4, 0.6);
        arch(focal, 2.35, 1.65, true);
        sphere(dressing, k, 0xffd49a, [3.4, 3.7, -5.4], [0.65, 0.65, 0.28]);
      } else tree(dressing, [4.5, 0, -3.2], 0.95);
      break;
    }
    case 'blossom-grove':
      tree(focal, [0, 0, -0.1], 1.55);
      for (const side of [-1, 1]) {
        tree(dressing, [side * 4.25, 0, -4], 1.15, side < 0 ? 0xf5cdd6 : p.foliage);
        pavilion(dressing, k, [side * 3.4, 0, -2.6], 0.58, p, true);
      }
      for (let i = 0; i < 12; i++) patch(dressing, 0xf3c4d5, [-3.2 + i * 0.55, 0.033, -1.7 + (i % 3) * 0.27], [0.085, 0.05]);
      break;
    case 'banner-camp':
      for (const side of [-1, 1]) {
        const tent = group(focal, [side * 1.8, 0, 0]);
        const roof = cylinder(tent, k, p.roof, [0, 1, 0], 0, 1.3, 2, 4);
        roof.rotation.y = Math.PI / 4;
        box(tent, k, p.wood, [0, 0.6, 0.91], [0.46, 1.1, 0.06]);
        banner(focal, [side * 2.8, 0, 0.4], p.roof, 1.15);
        lantern(tent, k, [0.7, 0.9, 0.6], p);
      }
      box(focal, k, p.wood, [0, 2.25, 0.7], [2.2, 0.18, 0.2]);
      for (const side of [-1, 1]) cylinder(focal, k, p.wood, [side, 1.1, 0.7], 0.09, 0.12, 2.2);
      break;
    case 'coastal-cottages':
      for (const side of [-1, 1]) pavilion(focal, k, [side * 1.5, 0, 0], 0.84, p, true);
      boat(dressing, [4.5, 0.06, -3.25], 0.65);
      for (const x of [-4.8, -3.6]) cylinder(dressing, k, p.wood, [x, 0.9, -3], 0.04, 0.07, 1.8);
      for (let i = 0; i < 6; i++) rod(dressing, k, p.trim, [-4.8 + i * 0.24, 1.6, -3], [-4.8 + i * 0.24, 0.4, -3], 0.012);
      for (let i = 0; i < 5; i++) rod(dressing, k, p.trim, [-4.8, 0.4 + i * 0.3, -3], [-3.6, 0.4 + i * 0.3, -3], 0.012);
      break;
    case 'reef-beacon':
      for (let i = 0; i < 5; i++) stone(focal, k, p.stone, [-2 + i, 1.1 + (i % 2) * 0.5, -0.2], [0.55, 1.5 + (i % 2) * 0.7, 0.7]);
      banner(focal, [0, 2.5, 0], p.roof, 0.7);
      coral(dressing, [-4.3, 0, -2.75], 1.2);
      break;
    case 'lotus-mushrooms':
      water([0, 0.031, -4], [3.3, 1.8]);
      lotus(focal, [0, 0.04, 0], 1.75);
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
        const x = side * (2.5 + i * 0.6);
        const h = 1 + (i % 2) * 0.5;
        cylinder(dressing, k, p.stone, [x, h * 0.5, -4 + i * 0.35], 0.15, 0.24, h);
        sphere(dressing, k, p.roof, [x, h, -4 + i * 0.35], [0.7, 0.43, 0.65]);
        for (const s of [-1, 1]) sphere(dressing, k, p.trim, [x + s * 0.23, h + 0.3, -3.85 + i * 0.35], [0.09, 0.05, 0.08]);
      }
      break;
    case 'crystal-terraces':
      for (let i = 0; i < 3; i++) {
        cylinder(focal, k, p.stone, [-1.7 + i * 1.7, 0.25 + i * 0.3, -i * 0.2], 0.9, 1.1, 0.5 + i * 0.6, 12);
        crystal(focal, [-1.7 + i * 1.7, 0.55 + i * 0.6, -i * 0.2], 1 + i * 0.18);
      }
      arch(focal, 2.65, 2.6);
      break;
    case 'valley-cave':
      cave();
      tree(dressing, [-4.8, 0, -2.8], 1.05);
      tree(dressing, [4.8, 0, -3], 0.8);
      break;
    case 'river-bridge':
      pavilion(focal, k, [0, 0, -0.15], 0.9, p);
      for (const side of [-1, 1]) {
        tree(dressing, [side * 4.5, 0, -4.5], 1.1);
        for (let i = 0; i < 4; i++) sphere(dressing, k, p.foliage, [side * 4.5 + (i - 1.5) * 0.35, 1.5, -4], [0.13, 0.7, 0.15]);
      }
      break;
    case 'webbed-rocks':
      for (const side of [-1, 1]) stone(focal, k, p.stone, [side * 1.65, 1.4, 0], [0.9, 1.9, 0.85]);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU;
        rod(focal, k, 0xe9dfec, [0, 1.85, 0.7], [Math.cos(a) * 1.85, 1.85 + Math.sin(a) * 1.45, 0.6], 0.013);
      }
      for (const radius of [0.42, 0.8, 1.2]) mesh(focal, k, k.geometry(`web:${radius}`, () => new THREE.TorusGeometry(radius, 0.012, 5, 8)),
        0xe9dfec, [0, 1.85, 0.68], [1.3, 1, 1]);
      tree(dressing, [-4.65, 0, -3.4], 0.9, p.foliage, true);
      break;
    case 'flags-barrows':
      for (let i = 0; i < 3; i++) {
        sphere(focal, k, p.ground, [-2.1 + i * 2.1, 0.35, -0.2], [1.25, 0.7, 1.1]);
        box(focal, k, p.stone, [-2.1 + i * 2.1, 0.8, 0.7], [0.55, 1.2, 0.23]);
        box(focal, k, p.trim, [-2.1 + i * 2.1, 0.9, 0.83], [0.09, 0.55, 0.025]);
        banner(focal, [-2.4 + i * 2.3, 0.5, -0.4], i % 2 ? p.wood : p.roof, 1.05);
      }
      steps(focal, 1.8);
      break;
    case 'underground-tomb':
      cave();
      box(focal, k, p.stone, [0, 0.45, -0.1], [1.4, 0.7, 1.4]);
      box(focal, k, p.trim, [0, 0.84, -0.1], [1.58, 0.15, 1.6]);
      for (const side of [-1, 1]) {
        // Side alcoves, not a roof/wall across the playable foreground.
        arch(group(dressing, [side * 4.15, 0, -3.9]), 0.65, 1.8);
        lantern(dressing, k, [side * 4.1, 2.15, -3], p, 1.1);
      }
      break;
    case 'windmill-plains': {
      const mill = group(focal, [-0.5, 0, -0.15]);
      cylinder(mill, k, 0xe9dfc5, [0, 1.6, 0], 0.6, 0.95, 3.2, 20);
      layeredRoof(mill, k, [0, 3.1, 0], [0.85, 0.75, 0.85], p);
      box(mill, k, p.wood, [0, 0.7, 0.85], [0.4, 1.2, 0.07]);
      const rotor = group(mill, [0, 2.8, 0.85]);
      rotor.rotation.z = 0.45;
      sphere(rotor, k, p.trim, [0, 0, 0.1], [0.2, 0.2, 0.15]);
      for (let i = 0; i < 4; i++) {
        const vane = group(rotor);
        vane.rotation.z = i * Math.PI / 2;
        rod(vane, k, p.wood, [0, 0, 0], [0, 1.65, 0], 0.055);
        box(vane, k, p.trim, [0.15, 1.13, 0], [0.38, 0.9, 0.07]);
        for (let j = 0; j < 3; j++) box(vane, k, p.wood, [0.15, 0.85 + j * 0.25, 0.05], [0.39, 0.035, 0.025]);
      }
      for (const side of [-1, 1]) sphere(dressing, k, p.foliage, [side * 4.3, 0.32, -3.3], [1.7, 0.6, 1.6]);
      break;
    }
    case 'mist-mountains':
      hill(focal, -0.8, -0.5, 1.5, 4.9);
      pavilion(focal, k, [1.3, 1.6, 0.5], 0.65, p);
      for (let i = 0; i < 5; i++) sphere(dressing, k, 0xecf0e9, [-4.8 + i * 2.1, 1.7 + (i % 2) * 0.65, -4.6], [1.45, 0.19, 0.43], { transparent: true, opacity: 0.5, depthWrite: false });
      break;
    case 'ruined-swamp-gate':
      arch(focal, 1.65, 2.7, true);
      water([-3.5, 0.031, -3.2], [1.7, 1.65]);
      for (const side of [-1, 1]) {
        tree(dressing, [side * 4.5, 0, -3.9], 1.2, p.foliage, true);
        sphere(focal, k, p.foliage, [side * 1.7, 0.25, 0.3], [0.6, 0.25, 0.7]);
      }
      break;
    case 'shipwreck-tomb':
      arch(focal, 1.25, 2.4, true);
      boat(dressing, [3.7, 0.1, -3.6], 1.5, true);
      for (const side of [-1, 1]) {
        box(focal, k, p.stone, [side * 2.1, 0.55, 0.4], [0.5, 1.1, 0.25]).rotation.z = side * 0.15;
        lantern(focal, k, [side * 1.25, 1.3, 0.3], p, 1.1);
      }
      tree(dressing, [-4.6, 0, -3.6], 1, p.foliage, true);
      break;
    case 'treasure-cavern':
      cave(true);
      for (const side of [-1, 1]) crystal(dressing, [side * 4.4, 0, -3.1], 1.4);
      break;
    case 'serpent-ruin':
      arch(focal, 1.65, 2.55, true);
      for (const side of [-1, 1]) {
        dragon(focal, [side * 2, 0.4, 0.4], side, p.foliage);
        tree(dressing, [side * 4.5, 0, -4], 1.05);
      }
      break;
    case 'yin-yang-shrines': {
      for (const side of [-1, 1]) {
        const q = side < 0 ? p : { ...p, stone: 0x9b8fae, roof: 0x796387, trim: 0xe6b1a2 };
        const island = group(focal, [side * 2, 0.9, 0]);
        contact(focal, k, 1.3, 0.1).position.x = side * 2;
        stone(island, k, q.stone, [0, 0, 0], [1.6, 0.5, 1.3]);
        pavilion(island, k, [0, 0.3, 0], 0.86, q);
        crystal(island, [0, 0.6, 0], 0.8, q.roof);
      }
      const disc = mesh(focal, k, k.geometry('yin-yang', () => new THREE.CircleGeometry(0.95, 48)),
        p.stone, [0, 2.3, -0.4], [1, 1, 1], { side: THREE.DoubleSide });
      mesh(disc, k, k.geometry('yin-half', () => new THREE.CircleGeometry(0.95, 32, -Math.PI / 2, Math.PI)),
        p.roof, [0, 0, 0.01], [1, 1, 1], { side: THREE.DoubleSide });
      for (const side of [-1, 1]) {
        sphere(disc, k, side < 0 ? p.stone : p.roof, [0, side * 0.47, 0.02], [0.47, 0.47, 0.035]);
        sphere(disc, k, side < 0 ? p.roof : p.stone, [0, side * 0.47, 0.06], [0.1, 0.1, 0.025]);
      }
      break;
    }
  }

  // Curated edge accents: a few rounded rocks, shrubs or reeds, never a forest
  // stamped across every biome. All construction uses static coordinates.
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (4.7 + (i % 3) * 0.38);
    const z = -1.8 + Math.floor(i / 2) * 0.62;
    stone(dressing, k, p.stone, [x, 0.16, z], [0.38, 0.27, 0.34]);
    if (biome !== 'underground') {
      for (let j = 0; j < 3; j++) {
        const leaf = sphere(dressing, k, p.foliage, [x - 0.28 + j * 0.13, 0.22, z - 0.28], [0.07, 0.27, 0.09]);
        leaf.rotation.z = -0.3 + j * 0.25;
      }
    }
  }
  if (state.explorable) {
    const pathColor = new THREE.Color(p.ground).lerp(new THREE.Color(p.stone), 0.46).getHex();
    const path = (points) => {
      for (let i = 1; i < points.length; i++) {
        const [ax, az] = points[i - 1];
        const [bx, bz] = points[i];
        const strip = box(dressing, k, pathColor, [(ax + bx) / 2, 0.016, (az + bz) / 2],
          [1.35, 0.018, Math.hypot(bx - ax, bz - az) + 0.6]);
        strip.rotation.y = Math.atan2(bx - ax, bz - az);
      }
    };
    path([[-13, 2], [-8, 3], [-3, 2.2], [0, 1], [6, 3], [13, 1]]);
    path([[0, 10.2], [0, 5], [0, 1], [6.8, -1], [8, -6], [4, -10], [0, -11.5], [-7, -8], [-8, -2], [-8, 3]]);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      const x = Math.sin(a) * (13.6 + i % 2);
      const z = -1.6 + Math.cos(a) * (10.6 + i % 2);
      const tint = new THREE.Color(p.ground).lerp(new THREE.Color(coastal ? p.stone : p.foliage), 0.14 + (i % 3) * 0.035).getHex();
      patch(dressing, tint, [x, 0.013, z], [2.5, 1.8]);
      if (coastal && i % 3 === 0) water([x, 0.027, z], [1.3, 0.8]);
      else if (biome !== 'underground' && i % 3 === 1) tree(dressing, [x, 0, z], 0.72, p.foliage, biome === 'haunted-island');
      else stone(dressing, k, p.stone, [x, 0.36, z], [0.62, 0.55, 0.54]);
    }
  }
  root.updateMatrixWorld(true);
  // Cache scenery corners once; dragging/resizing does not traverse the map.
  // Fit the curved rim itself, not the oversized rectangular box around it.
  const framePoints = [];
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * TAU;
    framePoints.push(new THREE.Vector3(Math.sin(a) * radiusX, -0.62, -1.6 + Math.cos(a) * radiusZ));
  }
  dressing.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry.computeBoundingBox();
    const bounds = object.geometry.boundingBox;
    for (let corner = 0; corner < 8; corner++) framePoints.push(new THREE.Vector3(
      corner & 1 ? bounds.max.x : bounds.min.x, corner & 2 ? bounds.max.y : bounds.min.y,
      corner & 4 ? bounds.max.z : bounds.min.z).applyMatrix4(object.matrixWorld));
  });
  const focalPoints = [];
  focal.traverse((object) => {
    if (!object.isMesh) return;
    const bounds = object.geometry.boundingBox;
    for (let corner = 0; corner < 8; corner++) focalPoints.push(new THREE.Vector3(
      corner & 1 ? bounds.max.x : bounds.min.x, corner & 2 ? bounds.max.y : bounds.min.y,
      corner & 4 ? bounds.max.z : bounds.min.z).applyMatrix4(object.matrixWorld));
  });
  const navigation = state.explorable ? buildNavigation(dressing, radiusX, radiusZ) : null;
  const occluders = [];
  if (state.explorable) dressing.traverse((object) => {
    if (!object.isMesh) return;
    const bounds = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
    if (bounds.min.y < 1.2 || bounds.max.y < 2.3 || Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) < 0.6) return;
    const normal = object.material;
    const faded = k.material(normal.color.getHex(), { transparent: true, opacity: 0.18, depthWrite: false, roughness: normal.roughness, metalness: normal.metalness, side: normal.side });
    occluders.push({ object, bounds, normal, faded });
  });
  if (state.rt && !state.explorable) {
    const arena = new THREE.Box3(new THREE.Vector3(-4.2, 0, -2.9), new THREE.Vector3(4.2, 3, 2.9));
    dressing.children.forEach(object => { if (new THREE.Box3().setFromObject(object).intersectsBox(arena)) object.visible = false; });
    const corners = [[-4, 0.025, -2.8], [4, 0.025, -2.8], [4, 0.025, 2.8], [-4, 0.025, 2.8]];
    corners.forEach((from, i) => rod(root, k, 0xc8b98b, from, corners[(i + 1) % 4], 0.018));
  }
  const detailGroups = [];
  const occlusionMeshes = new Set(occluders.map(cover => cover.object));
  dressing.traverse(object => { if (object.userData.modelingBatch) detailGroups.push(object); });
  detailGroups.forEach(detail => modelingBatch(detail, k, object => !occlusionMeshes.has(object)));
  modelingBatch(dressing, k, object => object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld).max.y < 0.6);
  return { root, k, palette: p, framePoints, focalPoints, motif, navigation, occluders };
}

function buildWeapon(parent, k, type) {
  const grip = group(parent);
  const steel = 0xd7dce0;
  const gold = 0xc5a873;
  const dark = 0x554c46;
  if (type === 'soulsphere') {
    sphere(grip, k, 0xa4b6d6, [0.08, 0.28, 0.06], [0.23, 0.23, 0.23], { emissive: 0x6582ba, emissiveIntensity: 0.38 });
    const hoop = mesh(grip, k, k.geometry('orb-hoop', () => new THREE.TorusGeometry(0.3, 0.025, 5, 16)),
      gold, [0.08, 0.28, 0.06]);
    hoop.rotation.x = 0.7;
    hoop.rotation.y = 0.5;
  } else if (type === 'glaive') {
    mesh(grip, k, k.geometry('glaive', () => new THREE.TorusGeometry(0.34, 0.055, 5, 16)), steel, [0, 0.28, 0]);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      const blade = cylinder(grip, k, gold, [Math.sin(angle) * 0.38, 0.28 + Math.cos(angle) * 0.38, 0], 0, 0.085, 0.23, 4);
      blade.rotation.z = -angle;
    }
    box(grip, k, dark, [0, 0, 0], [0.07, 0.2, 0.08]);
  } else if (type === 'bow') {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.1, -0.76, 0), new THREE.Vector3(0.62, 0, 0), new THREE.Vector3(-0.1, 0.76, 0));
    mesh(grip, k, k.geometry('bow', () => new THREE.TubeGeometry(curve, 14, 0.045, 5, false)), gold, [0, 0.04, 0]);
    rod(grip, k, 0xdbd5c9, [-0.1, -0.72, 0], [-0.1, 0.8, 0], 0.009);
    rod(grip, k, dark, [-0.34, 0.04, 0.015], [0.58, 0.04, 0.015], 0.015);
    const tip = cylinder(grip, k, steel, [0.64, 0.04, 0.015], 0, 0.04, 0.16, 4);
    tip.rotation.z = -Math.PI / 2;
  } else if (type === 'wand') {
    cylinder(grip, k, dark, [0, 0.38, 0], 0.04, 0.055, 1.65);
    cylinder(grip, k, gold, [0, 1.13, 0], 0.065, 0.08, 0.25);
    stone(grip, k, 0xaebed7, [0, 1.38, 0], [0.15, 0.24, 0.15]);
    for (const side of [-1, 1]) rod(grip, k, gold, [0, 1.16, 0], [side * 0.16, 1.42, 0], 0.025);
  } else if (type === 'axe') {
    cylinder(grip, k, dark, [0, 0.35, 0], 0.045, 0.055, 1.45);
    modelingSolid(grip, k, steel, [[-0.44, 0.28], [-0.18, 0.13], [0.18, 0.13], [0.44, 0.28], [0.53, 0.08], [0.48, -0.23], [0.17, -0.11], [-0.17, -0.11], [-0.48, -0.23], [-0.53, 0.08]], [0, 0.92, 0], 0.09);
    box(grip, k, gold, [0, 0.92, 0], [0.13, 0.35, 0.14]);
  } else {
    const dagger = type === 'dagger';
    const length = dagger ? 0.52 : 1.14;
    cylinder(grip, k, dark, [0, 0, 0], 0.045, 0.045, 0.24);
    box(grip, k, gold, [0, 0.15, 0], [dagger ? 0.21 : 0.32, 0.055, 0.07]);
    const blade = modelingSolid(grip, k, steel, type === 'blade'
      ? [[-0.055, 0], [0.11, 0], [0.17, length * 0.72], [0.085, length], [-0.055, length * 0.8]]
      : [[-0.075, 0], [0.075, 0], [0.075, length * 0.82], [0, length], [-0.075, length * 0.82]], [0, 0.18, 0], 0.045);
    blade.material = k.material(steel, { metalness: 0.4, roughness: 0.38 });
    rod(grip, k, 0xf1ece2, [0, 0.2, 0.033], [0, length * 0.83, 0.033], 0.01);
    stone(grip, k, gold, [0, -0.16, 0], [0.055, 0.055, 0.055]);
  }
  grip.rotation.z = -0.12;
  return grip;
}

// Authored silhouettes and palettes, independent of equipment statistics.
const CLASS_LOOKS = {
  blademaster: { coat: 0xb95151, trim: 0xf5d49c, hair: 0x302b39, accent: 0xe9977c, iris: 0x925743, style: 'topknot' },
  wizard: { coat: 0x7776bc, trim: 0xffe4b5, hair: 0x393451, accent: 0xb8c8ee, iris: 0x7666a6, style: 'ribbon' },
  archer: { coat: 0x599f8e, trim: 0xf4eedc, hair: 0x536f69, accent: 0xb8dfca, iris: 0x448e78, style: 'ponytail' },
  cleric: { coat: 0xf2eddf, trim: 0xa3cebf, hair: 0xc4d9db, accent: 0x78b5a7, iris: 0x529b98, style: 'feather' },
  barbarian: { coat: 0x597b86, trim: 0xefce96, hair: 0xf6f2e8, accent: 0x96b6b7, iris: 0xc28c3b, style: 'tiger' },
  venomancer: { coat: 0xae8ac3, trim: 0xf7dfce, hair: 0x986778, accent: 0xd9b6dc, iris: 0x9971b5, style: 'fox' },
  assassin: { coat: 0x325e7b, trim: 0x91d8d5, hair: 0x284b68, accent: 0x639fb5, iris: 0x30879b, style: 'wave-short' },
  psychic: { coat: 0x6688b8, trim: 0xc0efea, hair: 0x507dac, accent: 0xb7c6ee, iris: 0x6973bc, style: 'wave-long' },
  seeker: { coat: 0x548a7b, trim: 0xe2d8a9, hair: 0x345954, accent: 0xa4d6b9, iris: 0x408d74, style: 'leaf' },
  mystic: { coat: 0x94b995, trim: 0xf6e6c8, hair: 0x79658d, accent: 0xe8b5d0, iris: 0x9377af, style: 'flower' },
};

// Rounded, tapering volumes for designed locks, plumes, ribbons and feathers.
// Every custom geometry belongs to the avatar kit and is disposed with it.
function avatarSweep(parent, k, color, points, width, depth, tipColor) {
  const colored = tipColor !== undefined;
  const key = `avatar-sweep:${JSON.stringify(points)}:${width}:${depth}:${colored ? `${color}:${tipColor}` : ''}`;
  const geo = k.geometry(key, () => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const positions = [], colors = [], indices = [];
    const length = 12, sides = 8;
    for (let i = 0; i <= length; i++) {
      const t = i / length;
      const center = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
      const lateral = new THREE.Vector3(tangent.y, -tangent.x, 0);
      if (lateral.lengthSq() < 0.0001) lateral.set(1, 0, 0);
      lateral.normalize();
      const normal = new THREE.Vector3().crossVectors(lateral, tangent).normalize();
      const taper = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.65);
      const tint = colored ? new THREE.Color(t > 0.69 ? tipColor : color) : null;
      for (let j = 0; j <= sides; j++) {
        const a = j / sides * TAU;
        const vertex = center.clone().addScaledVector(lateral, Math.cos(a) * width * taper)
          .addScaledVector(normal, Math.sin(a) * depth * taper);
        positions.push(vertex.x, vertex.y, vertex.z);
        if (tint) colors.push(tint.r, tint.g, tint.b);
        if (i < length && j < sides) {
          const n = i * (sides + 1) + j;
          indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2);
        }
      }
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (colored) result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    result.setIndex(indices);
    result.computeVertexNormals();
    return result;
  });
  return mesh(parent, k, geo, colored ? 0xffffff : color, [0, 0, 0], [1, 1, 1], colored ? { vertexColors: true } : undefined);
}

function avatarStroke(parent, k, color, points, radius = 0.01) {
  const geo = k.geometry(`avatar-stroke:${JSON.stringify(points)}:${radius}`, () =>
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 12, radius, 5, false));
  return mesh(parent, k, geo, color, [0, 0, 0]);
}

function avatarPetal(parent, k, color, position, size, kind = 'leaf') {
  const geo = k.geometry(`avatar-petal:${kind}`, () => {
    const s = new THREE.Shape();
    if (kind === 'ear') {
      s.moveTo(-0.42, -0.42);
      s.quadraticCurveTo(-0.44, -0.05, 0, 0.53);
      s.quadraticCurveTo(0.44, -0.05, 0.42, -0.42);
      s.quadraticCurveTo(0, -0.56, -0.42, -0.42);
    } else if (kind === 'fin') {
      s.moveTo(0, -0.43);
      s.quadraticCurveTo(0.25, -0.39, 0.5, -0.15);
      s.lineTo(0.26, -0.08); s.lineTo(0.58, 0.1);
      s.lineTo(0.29, 0.13); s.lineTo(0.46, 0.43);
      s.quadraticCurveTo(0.13, 0.35, 0, 0.19);
      s.lineTo(0, -0.43);
    } else {
      s.moveTo(0, -0.5);
      s.bezierCurveTo(-0.46, -0.21, -0.43, 0.16, 0, 0.5);
      s.bezierCurveTo(0.43, 0.16, 0.46, -0.21, 0, -0.5);
    }
    return new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.035, bevelSegments: 1, steps: 1, curveSegments: 8 });
  });
  return mesh(parent, k, geo, color, position, size);
}

function avatarScalpGeometry() {
  const positions = [], indices = [];
  const sides = 24, rows = 12;
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= sides; j++) {
    const phi = j / sides * TAU;
    // A raised front hairline leaves the eyes (and earthguard third eye) open.
    const rim = 1.55 - Math.max(0, Math.sin(phi)) * 0.57 + Math.max(0, -Math.sin(phi)) * 0.4;
    const theta = i / rows * rim;
    positions.push(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
    if (i < rows && j < sides) {
      const n = i * (sides + 1) + j;
      indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildAvatar(state) {
  const k = kit();
  const root = new THREE.Group();
  root.position.set(-1.65, 0, 0.55);
  const shadow = contact(root, k, 0.59, 0.21);
  const body = group(root);
  body.rotation.y = 0.24;
  const look = CLASS_LOOKS[state.cls];
  const heavy = state.armor === 'heavy', robe = state.armor === 'robe';
  const tiger = state.cls === 'barbarian', fox = state.cls === 'venomancer';
  const elf = state.race === 'elf', tide = state.race === 'tideborn', earth = state.race === 'earthguard';
  const broad = tiger ? 1.22 : 1;
  const skin = tiger ? 0xf6f2e8 : tide ? 0xa5d9e0 : earth ? 0xeee0cc : 0xffdfce;
  const ink = 0x343645, cream = 0xfff5e5;
  const boot = tiger ? skin : tide ? 0x355b77 : earth ? 0x52776b : 0x585367;

  const sphere = modelingSphere;
  const torso = group(body, [0, 0.99, 0]);
  sphere(torso, k, look.coat, [0, 0, 0], [0.3 * broad, 0.3, 0.225]);
  for (const side of [-1, 1]) {
    const collar = avatarPetal(torso, k, cream, [side * 0.075, 0.15, 0.207], [0.12, 0.31, 0.04]);
    collar.rotation.z = side * 0.5;
  }
  if (heavy) {
    const plate = modelingSolid(torso, k, look.trim, [[-0.23, 0.18], [-0.11, 0.23], [0, 0.13], [0.11, 0.23], [0.23, 0.18], [0.25, -0.1], [0, -0.24], [-0.25, -0.1]], [0, 0, 0.223], 0.06); plate.scale.x = broad;
    for (const side of [-1, 1]) {
      modelingSolid(torso, k, look.coat, [[0, 0.08], [side * 0.19, 0.14], [side * 0.2, -0.08], [0, -0.19]], [0, 0, 0.266], 0.025);
      rod(torso, k, look.accent, [side * 0.05, 0.12, 0.291], [side * 0.18, 0.04, 0.291], 0.018);
    }
    if (tiger) avatarPetal(torso, k, cream, [0, 0.09, 0.291], [0.28, 0.28, 0.06]);
  } else if (robe) {
    for (const side of [-1, 1]) avatarSweep(torso, k, look.trim,
      [[side * 0.15, 0.22, 0.17], [side * 0.12, 0.07, 0.24], [-side * 0.12, -0.21, 0.235]], 0.028, 0.012);
    avatarPetal(torso, k, look.accent, [0, 0.065, 0.255], [0.15, 0.19, 0.035]);
  } else {
    avatarSweep(torso, k, look.trim, [[-0.19, 0.2, 0.17], [0, 0, 0.245], [0.2, -0.2, 0.16]], 0.04, 0.018);
    avatarPetal(torso, k, look.accent, [0.03, 0, 0.267], [0.12, 0.16, 0.035]);
  }
  cylinder(body, k, look.trim, [0, 0.76, 0], 0.28 * broad, 0.28 * broad, 0.075, 24).scale.z = 0.8;
  avatarPetal(body, k, look.accent, [0, 0.76, 0.238], [0.19, 0.13, 0.045]);
  const hem = group(body, [0, 0.73, 0]);
  const hemLength = robe ? 0.44 : 0.27, hemWidth = robe ? 0.4 : 0.34;
  const hemGeo = k.geometry(`avatar-hem:${robe}`, () => new THREE.LatheGeometry([
    new THREE.Vector2(hemWidth, -hemLength), new THREE.Vector2(hemWidth - 0.01, -hemLength + 0.025),
    new THREE.Vector2(0.31, -0.13), new THREE.Vector2(0.27, 0),
  ], 28, 0.24, TAU - 0.48));
  mesh(hem, k, hemGeo, look.coat, [0, 0, 0], [broad, 1, 0.8], { side: THREE.DoubleSide });
  cylinder(hem, k, look.trim, [0, -hemLength + 0.017, 0], hemWidth, hemWidth, 0.034, 28).scale.set(broad, 0.034, 0.8);
  avatarSweep(hem, k, look.accent, [[-0.13, 0.02, 0.24], [-0.18, -0.15, 0.29], [-0.11, -hemLength - 0.03, 0.32]], 0.065, 0.018);
  if (look.style === 'flower') for (const side of [-1, 0, 1]) {
    const petal = avatarPetal(hem, k, side ? look.accent : 0xc4ddaf, [side * 0.21, -0.24, 0.27], [0.34, 0.46, 0.055]);
    petal.rotation.z = -side * 0.22;
  }
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = group(body, [side * 0.165 * broad, 0.65, 0]);
    legs.push(leg);
    sphere(leg, k, look.coat, [0, -0.13, 0], [0.12, 0.17, 0.125]);
    const knee = group(leg, [0, -0.25, 0]);
    sphere(knee, k, boot, [0, -0.08, 0.015], [0.125, 0.15, 0.13]);
    sphere(knee, k, boot, [0, -0.26, 0.09], [tiger ? 0.175 : 0.15, 0.115, 0.205]);
    cylinder(knee, k, look.trim, [0, 0.005, 0.015], 0.127, 0.127, 0.045, 20);
    if (heavy && !tiger) avatarPetal(knee, k, look.accent, [0, -0.075, 0.14], [0.2, 0.19, 0.035]);
  }
  cylinder(body, k, skin, [0, 1.27, 0], 0.105, 0.11, 0.13, 20);
  const head = group(body, [0, 1.66, 0]);
  head.scale.set(1.075, 1.06, 1.05);
  const hx = tiger ? 0.545 : 0.475, hz = tiger ? 0.425 : 0.4;
  mesh(head, k, k.geometry('sphere', () => new THREE.SphereGeometry(1, 20, 14)), skin, [0, 0, 0], [hx, 0.5, hz]);
  const faceZ = (x, y) => hz * Math.sqrt(Math.max(0, 1 - (x / hx) ** 2 - (y / 0.5) ** 2));

  // Shallow eye layers follow the face, not protruding ball eyes. No human nose.
  for (const side of [-1, 1]) {
    const x = side * (tiger ? 0.205 : 0.18), y = tiger ? 0.025 : -0.015;
    const eye = group(head, [x, y, faceZ(x, y) + 0.012]);
    eye.rotation.y = side * 0.32;
    eye.rotation.z = side * (state.cls === 'assassin' ? 0.14 : fox ? -0.1 : 0);
    eye.scale.y = state.cls === 'assassin' || tiger ? 0.85 : robe ? 1.05 : 0.96;
    sphere(eye, k, ink, [0, 0.006, 0], [0.105, 0.128, 0.025]);
    sphere(eye, k, cream, [0, 0, 0.018], [0.095, 0.116, 0.013]);
    sphere(eye, k, look.iris, [0.004, -0.012, 0.031], [0.067, 0.087, 0.009], { roughness: 0.4 });
    sphere(eye, k, ink, [0.005, -0.002, 0.039], [0.032, 0.063, 0.007]);
    sphere(eye, k, 0xffffff, [-0.025, 0.042, 0.05], [0.025, 0.029, 0.005], { emissive: 0xffffff, emissiveIntensity: 0.12 });
    sphere(eye, k, cream, [0.027, -0.046, 0.048], [0.01, 0.012, 0.004]);
    avatarStroke(eye, k, tiger ? ink : look.hair, [[-0.067, 0.16, -0.012], [0, 0.172, 0], [0.07, 0.155, -0.012]], 0.012);
    if (!tiger) {
      const blush = group(head, [side * 0.295, -0.16, faceZ(0.295, -0.16) + 0.01]);
      blush.rotation.y = side * 0.53;
      blush.rotation.x = 0.25;
      sphere(blush, k, tide ? 0x8cbdcf : 0xf0b4b5, [0, 0, 0], [0.069, 0.029, 0.007]);
    }
  }
  if (!tiger) avatarStroke(head, k, 0xaa747e, [[-0.045, -0.207, 0.367], [0, -0.222, 0.367], [0.045, -0.207, 0.367]], 0.009);

  if (tiger) {
    // A feline skull, cheek ruff and broad muzzle, with no human hair or ears.
    for (const side of [-1, 1]) {
      sphere(head, k, ink, [side * 0.385, 0.38, -0.015], [0.153, 0.16, 0.085]);
      sphere(head, k, skin, [side * 0.385, 0.385, 0.038], [0.124, 0.127, 0.055]);
      sphere(head, k, 0xd6b3b6, [side * 0.385, 0.385, 0.089], [0.065, 0.071, 0.019]);
      avatarSweep(head, k, skin, [[side * 0.4, -0.1, 0.02], [side * 0.535, -0.16, 0.1], [side * 0.44, -0.31, 0.12]], 0.1, 0.11);
      sphere(head, k, cream, [side * 0.125, -0.195, 0.38], [0.17, 0.115, 0.125]);
      for (let i = 0; i < 2; i++) {
        avatarSweep(head, k, ink, [[side * 0.48, 0.04 - i * 0.13, 0.2], [side * 0.39, -0.015 - i * 0.13, 0.303], [side * 0.32, -0.04 - i * 0.13, 0.342]], 0.023, 0.009);
        avatarStroke(head, k, 0x73727d, [[side * 0.22, -0.18 - i * 0.055, 0.48], [side * 0.32, -0.17 - i * 0.06, 0.435], [side * 0.38, -0.15 - i * 0.07, 0.394]], 0.006);
      }
    }
    mesh(head, k, k.geometry('avatar-tiger-nose', () => shapeGeometry([[-0.063, 0.027], [0.063, 0.027], [0.035, -0.015], [0, -0.039], [-0.035, -0.015]])),
      0x5d4a59, [0, -0.135, 0.511], [1, 1, 1], { side: THREE.DoubleSide });
    avatarStroke(head, k, ink, [[0, -0.173, 0.513], [0, -0.222, 0.505], [-0.06, -0.244, 0.493]], 0.008);
    avatarStroke(head, k, ink, [[0, -0.222, 0.505], [0.035, -0.243, 0.5], [0.06, -0.244, 0.493]], 0.008);
    for (const x of [-0.125, 0, 0.125]) {
      avatarSweep(head, k, ink, [[x * 0.7, 0.425, faceZ(x * 0.7, 0.425) + 0.008], [x, 0.34, faceZ(x, 0.34) + 0.01], [x * 0.8, 0.235, faceZ(x * 0.8, 0.235) + 0.012]], 0.023, 0.01);
    }
    const tailPoints = [[0, 0.64, -0.2], [-0.45, 0.48, -0.46], [-0.68, 0.68, -0.4], [-0.64, 0.99, -0.34]];
    avatarStroke(body, k, skin, tailPoints, 0.095);
    const tailCurve = new THREE.CatmullRomCurve3(tailPoints.map((p) => new THREE.Vector3(...p)));
    for (const t of [0.24, 0.48, 0.72, 0.93]) {
      const band = mesh(body, k, k.geometry('avatar-tail-band', () => new THREE.TorusGeometry(0.096, 0.014, 6, 16)), ink, tailCurve.getPoint(t).toArray());
      band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tailCurve.getTangent(t).normalize());
    }
    sphere(body, k, ink, tailPoints[3], [0.099, 0.1, 0.099]);
  } else {
    mesh(head, k, k.geometry('avatar-scalp', avatarScalpGeometry), look.hair, [0, 0.018, -0.016], [hx + 0.016, 0.514, 0.425]);
    for (const side of [-1, 1]) {
      avatarSweep(head, k, look.hair, [[side * 0.33, 0.32, 0.05], [side * 0.46, 0.04, 0.03], [side * 0.395, -0.27, 0.1]], 0.07, 0.09);
      if (fox) {
        const ear = avatarPetal(head, k, look.hair, [side * 0.34, 0.365, -0.01], [0.32, 0.48, 0.12], 'ear');
        ear.rotation.z = -side * 0.24;
        avatarPetal(ear, k, 0xf2c6cf, [0, 0.025, 0.63], [0.65, 0.68, 0.1], 'ear');
      } else if (elf) {
        const ear = avatarPetal(head, k, skin, [side * 0.465, -0.025, 0], [0.18, 0.34, 0.085], 'ear');
        ear.rotation.z = -side * 0.95;
        avatarPetal(ear, k, 0xe4bdb6, [0, -0.03, 0.64], [0.55, 0.65, 0.1], 'ear');
      } else if (tide) {
        avatarPetal(head, k, 0x70b4c9, [side * 0.455, -0.01, 0.015], [side * 0.43, 0.53, 0.08], 'fin');
        for (const tip of [[0.5, -0.15], [0.58, 0.1], [0.46, 0.43]]) avatarStroke(head, k, look.trim,
          [[side * 0.465, -0.11, 0.074], [side * 0.53, 0, 0.074], [side * (0.455 + tip[0] * 0.43), -0.01 + tip[1] * 0.53, 0.074]], 0.007);
      } else sphere(head, k, skin, [side * 0.465, -0.04, 0], [0.064, 0.095, 0.065]);
    }
    if (earth || ['ribbon', 'feather', 'fox'].includes(look.style)) {
      for (const side of [-1, 1]) avatarSweep(head, k, look.hair,
        [[side * 0.04, 0.4, 0.255], [side * 0.22, 0.32, 0.354], [side * 0.37, 0.095, 0.266]], 0.095, 0.035);
    } else if (!tide) {
      avatarSweep(head, k, look.hair, [[-0.34, 0.32, 0.28], [-0.1, 0.3, 0.399], [0.16, 0.17, 0.371]], 0.105, 0.04);
      avatarSweep(head, k, look.hair, [[0.15, 0.4, 0.24], [0.31, 0.27, 0.3], [0.38, 0.1, 0.224]], 0.075, 0.035);
    }
    if (look.style === 'topknot' || look.style === 'ribbon') {
      avatarSweep(head, k, look.hair, [[-0.1, 0.39, -0.11], [-0.1, 0.6, -0.1], [0.1, 0.61, -0.12], [0.11, 0.42, -0.13]], 0.105, 0.095);
      cylinder(head, k, look.accent, [0, 0.45, -0.115], 0.13, 0.13, 0.055, 24);
      rod(head, k, look.trim, [-0.23, 0.5, -0.11], [0.23, 0.5, -0.11], 0.016);
      if (look.style === 'ribbon') for (const side of [-1, 1]) avatarSweep(head, k, look.accent,
        [[side * 0.12, 0.47, -0.13], [side * 0.5, 0.2, -0.23], [side * 0.56, -0.27, -0.15], [side * 0.42, -0.56, -0.06]], 0.07, 0.016);
    }
    if (look.style === 'ponytail') {
      avatarSweep(head, k, look.hair, [[0.07, 0.35, -0.31], [0.32, 0.05, -0.41], [0.4, -0.43, -0.28], [0.25, -0.59, -0.17]], 0.135, 0.12);
      avatarPetal(head, k, look.accent, [0.16, 0.26, -0.36], [0.19, 0.2, 0.06]);
    }
    if (['feather', 'fox', 'flower'].includes(look.style)) for (const side of [-1, 1]) {
      avatarSweep(head, k, look.hair, [[side * 0.35, 0.16, -0.18], [side * 0.41, -0.19, -0.28], [side * 0.3, -0.54, -0.17], [side * 0.43, -0.64, -0.1]], 0.115, 0.09);
    }
    if (fox) avatarSweep(body, k, 0xb48caa,
      [[0, 0.64, -0.24], [-0.5, 0.43, -0.51], [-0.82, 0.76, -0.42], [-0.72, 1.15, -0.31], [-0.52, 1.2, -0.3]], 0.24, 0.19, cream);
    if (tide) {
      for (let i = 0; i < 3; i++) avatarSweep(head, k, i === 1 ? look.accent : look.hair,
        [[-0.38 + i * 0.11, 0.17 + i * 0.05, 0.22], [-0.26 + i * 0.12, 0.43 + i * 0.055, 0.25], [0.15 + i * 0.09, 0.37 + i * 0.025, 0.28], [0.28 + i * 0.055, 0.2, 0.28]], 0.073, 0.045);
      if (look.style === 'wave-long') avatarSweep(head, k, look.hair,
        [[0.2, 0.28, -0.29], [0.4, -0.12, -0.31], [0.22, -0.49, -0.23], [0.38, -0.58, -0.16]], 0.15, 0.1);
      const coral = group(head, [0.37, 0.24, 0.24]);
      avatarStroke(coral, k, 0xe5aebc, [[0, -0.08, 0], [0.025, 0.05, 0], [0.005, 0.18, 0]], 0.019);
      avatarStroke(coral, k, 0xe5aebc, [[0.02, 0.035, 0], [0.11, 0.07, 0], [0.13, 0.14, 0]], 0.015);
      sphere(coral, k, look.trim, [0, -0.075, 0.018], [0.037, 0.039, 0.025]);
    }
    if (earth) {
      // An actual third eye, including sclera, iris and highlight, not a gem.
      const thirdEye = group(head, [0, 0.205, faceZ(0, 0.205) + 0.012]);
      thirdEye.rotation.x = -0.36;
      sphere(thirdEye, k, look.trim, [0, 0, 0], [0.092, 0.058, 0.013]);
      sphere(thirdEye, k, ink, [0, 0, 0.012], [0.076, 0.046, 0.009]);
      sphere(thirdEye, k, cream, [0, 0, 0.021], [0.064, 0.034, 0.006]);
      sphere(thirdEye, k, look.iris, [0, 0, 0.027], [0.027, 0.031, 0.005]);
      sphere(thirdEye, k, ink, [0, 0, 0.032], [0.012, 0.023, 0.004]);
      sphere(thirdEye, k, 0xffffff, [-0.009, 0.012, 0.038], [0.009, 0.01, 0.003]);
    }
    if (earth || elf) for (const side of [-1, 1]) {
      const leaf = avatarPetal(head, k, elf ? cream : look.accent, [side * 0.245, 0.355, 0.235], [0.19, 0.32, 0.05]);
      leaf.rotation.z = -side * 0.52;
    }
    if (look.style === 'flower') {
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * TAU;
        const petal = avatarPetal(head, k, look.accent, [Math.sin(a) * 0.07, 0.45 + Math.cos(a) * 0.07, 0.23], [0.16, 0.2, 0.04]);
        petal.rotation.z = -a;
      }
      sphere(head, k, look.trim, [0, 0.45, 0.263], [0.056, 0.055, 0.022]);
    }
  }

  const arms = [-1, 1].map((side) => {
    const arm = group(body, [side * 0.335 * broad, 1.15, 0]);
    arm.rotation.z = side * 0.2;
    sphere(arm, k, look.coat, [0, -0.12, 0], [robe ? 0.145 : 0.12, 0.17, 0.13]);
    if (heavy) {
      const plate = avatarPetal(arm, k, look.accent, [side * 0.04, -0.01, 0.075], [tiger ? 0.42 : 0.32, 0.23, 0.14]);
      plate.rotation.z = side * 0.22;
    }
    const forearm = group(arm, [0, -0.235, 0]);
    forearm.rotation.x = -0.28;
    sphere(forearm, k, look.coat, [0, -0.085, 0], [robe ? 0.145 : 0.105, 0.13, 0.115]);
    cylinder(forearm, k, look.trim, [0, -0.16, 0], robe ? 0.145 : 0.11, robe ? 0.15 : 0.115, 0.05, 20);
    sphere(forearm, k, skin, [0, -0.225, 0.025], [tiger ? 0.115 : 0.09, 0.09, 0.085]);
    const hand = group(forearm, [0, -0.225, 0.06]);
    return { arm, forearm, hand, rest: arm.rotation.z };
  });
  const weaponScale = state.weapon === 'bow' ? 0.68 : state.weapon === 'wand' ? 0.67 : state.weapon === 'axe' ? 0.68 : 0.76;
  const weapon = buildWeapon(arms[1].hand, k, state.weapon);
  weapon.scale.setScalar(weaponScale);
  weapon.rotation.z = state.weapon === 'bow' ? -0.25 : state.weapon === 'wand' ? -0.48 : state.weapon === 'soulsphere' ? -0.55 : -0.88;
  weapon.rotation.y = -0.08;
  arms[1].forearm.rotation.x = state.weapon === 'bow' || state.weapon === 'soulsphere' ? -0.85 : -0.46;
  if (state.weapon === 'bow') weapon.position.x = -0.18;
  if (state.weapon === 'soulsphere') weapon.position.set(0.06, 0.1, 0.08);
  if (state.weapon === 'dagger') {
    const offhand = buildWeapon(arms[0].hand, k, 'dagger');
    offhand.scale.setScalar(0.76); offhand.rotation.z = 1.08;
    arms[0].forearm.rotation.x = -0.46;
  }
  if (state.weapon === 'bow') {
    const quiver = cylinder(body, k, boot, [-0.2, 1.05, -0.265], 0.08, 0.075, 0.36);
    quiver.rotation.z = -0.2;
    for (let i = 0; i < 3; i++) rod(body, k, look.trim, [-0.23 + i * 0.045, 1.12, -0.28], [-0.28 + i * 0.045, 1.42, -0.28], 0.012);
  }
  const wings = [];
  if (elf) for (const side of [-1, 1]) {
    const wing = group(body, [side * 0.26, 1.15, -0.28]);
    wing.rotation.y = -side * 0.22;
    wing.scale.setScalar(state.cls === 'cleric' ? 1.05 : 0.94);
    // Long primary fan behind a shorter overlapping row of mint coverts.
    for (let i = 0; i < 6; i++) avatarSweep(wing, k, i % 2 ? 0xe7eee4 : 0xfff4e2,
      [[side * (0.1 + i * 0.024), 0.12 - i * 0.024, -0.025], [side * (0.48 + i * 0.025), 0.29 - i * 0.075, -0.015], [side * (0.97 - i * 0.073), 0.46 - i * 0.155, 0]], 0.083, 0.035);
    avatarSweep(wing, k, cream, [[0, 0, 0.025], [side * 0.33, 0.29, 0.025], [side * 0.75, 0.39, 0.015]], 0.12, 0.045);
    for (let i = 0; i < 4; i++) avatarSweep(wing, k, i % 2 ? 0xd1e5d7 : look.trim,
      [[side * 0.12, 0.1, 0.072], [side * (0.3 + i * 0.065), 0.18 - i * 0.04, 0.074], [side * (0.47 + i * 0.055), 0.18 - i * 0.095, 0.06]], 0.063, 0.024);
    wings.push({ wing, rest: wing.rotation.y, side });
  }
  const outfitParts = body.children.filter(part => part !== head);
  const outfit = group(body);
  outfitParts.forEach(part => outfit.add(part));
  outfit.scale.y = 0.91;
  modelingBatch(head, k);
  modelingBatch(torso, k);
  legs.forEach(leg => modelingBatch(leg, k));
  root.updateMatrixWorld(true);
  return { root, k, body, torso, head, hem, legs, arms, wings, shadow };
}

function crystalCrest(parent, k, position, color) {
  const crest = cylinder(parent, k, color, position, 0, 0.075, 0.24, 6);
  crest.rotation.z = position[0] < 0 ? 0.35 : -0.35;
}

function monsterKind(name, id) {
  if (/蟹|虾|蛛|蝎|蜂|虫|刺猬/.test(name)) return 'crawler';
  if (/鸟|雕|蝠|蝶/.test(name)) return 'bird';
  if (/蛇|蛟|龙/.test(name)) return 'serpent';
  if (/狼|鬣狗|猪|熊|狮|虎|狐|兔|犀|蜥|鳄|兽|麒麟/.test(name)) return 'beast';
  if (/石|傀|巨人|魔像|树|木桩/.test(name)) return 'golem';
  if (/魂|灵|雾|风|冰晶|元素/.test(name)) return 'spirit';
  if (/兵|贼|寇|匪|将|守卫|巫|信徒|祭司|骷髅|人|鬼|女|卒|官/.test(name)) return 'humanoid';
  return ['beast', 'golem', 'humanoid'][hash(id ?? name) % 3];
}

function modelingSphere(parent, k, color, position, size, options) {
  const small = Math.max(...size.map(Math.abs)) < 0.16;
  const geometry = k.geometry(`modeling-sphere:${small}`, () => new THREE.SphereGeometry(1, small ? 10 : 16, small ? 8 : 12));
  return mesh(parent, k, geometry, color, position, size, options);
}

function modelingSolid(parent, k, color, points, position, thickness = 0.06) {
  const geometry = k.geometry(`modeling-solid:${JSON.stringify(points)}:${thickness}`, () => {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 6 });
  });
  return mesh(parent, k, geometry, color, [position[0], position[1], position[2] - thickness / 2]);
}

function modelingBatch(parent, k, accept = () => true) {
  parent.updateWorldMatrix(true, true);
  const inverse = parent.matrixWorld.clone().invert();
  const batches = new Map();
  parent.traverse(object => {
    if (!object.isMesh || object.isInstancedMesh || object.children.length || !object.visible || object.matrixWorld.determinant() < 0 || !accept(object)) return;
    for (let ancestor = object.parent; ancestor; ancestor = ancestor.parent) if (!ancestor.visible) return;
    const key = `${object.geometry.uuid}:${object.material.uuid}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(object);
  });
  const instances = [];
  for (const objects of batches.values()) {
    if (objects.length < 3) continue;
    const first = objects[0];
    const batch = new THREE.InstancedMesh(first.geometry, first.material, objects.length);
    objects.forEach((object, i) => {
      batch.setMatrixAt(i, inverse.clone().multiply(object.matrixWorld));
      object.removeFromParent();
    });
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox(); batch.computeBoundingSphere();
    parent.add(batch); instances.push(batch);
  }
  const dispose = k.dispose.bind(k);
  k.dispose = () => { instances.forEach(instance => instance.dispose()); dispose(); };
}

function buildEnemy(monster, position, index) {
  const k = kit();
  const root = new THREE.Group();
  root.position.set(position[0], 0, position[1]);
  const model = group(root);
  model.userData.sceneTarget = monster.id;
  model.rotation.y = -0.48;
  const kind = monsterKind(monster.name, monster.id);
  const boss = monster.rank === 'boss';
  const elite = boss || monster.rank === 'elite';
  const sphere = modelingSphere;
  const boar = kind === 'beast' && /猪/.test(monster.name);
  const wolf = kind === 'beast' && /狼|鬣狗/.test(monster.name);
  const bear = kind === 'beast' && /熊/.test(monster.name);
  const rabbit = kind === 'beast' && /兔/.test(monster.name);
  const reptile = kind === 'beast' && /蜥|鳄|犀/.test(monster.name);
  const wooden = kind === 'golem' && /木|树|藤/.test(monster.name);
  const bandit = kind === 'humanoid' && /贼|寇|匪/.test(monster.name);
  const baseTint = { humanoid: bandit ? 0x785c4d : 0x827fa3, golem: wooden ? 0xa37950 : 0x92afa1, beast: boar ? 0xb48664 : wolf ? 0x7f949d : bear ? 0x987451 : rabbit ? 0xebe0c9 : reptile ? 0x7b9c7b : 0xc7a278, crawler: 0xd99788, bird: 0x8eb6c5, serpent: 0x96b881, spirit: 0xaaa7d8 }[kind];
  const tint = new THREE.Color(baseTint).lerp(new THREE.Color(boss ? 0x693c35 : 0x755f4f), elite ? 0.2 : 0).getHex();
  const pale = 0xf3dfbd;
  const dark = 0x39404b;
  const amber = 0xe8b866;
  const sash = elite ? 0xa8423e : 0xbb6954;
  const size = boss ? 1.2 : elite ? 1.06 : 0.92;
  model.scale.setScalar(size);
  const eyes = (position, spread = 0.13, radius = 0.065) => {
    for (const side of [-1, 1]) {
      sphere(model, k, dark, [position[0] + side * spread, position[1], position[2]], [radius, radius * 1.25, radius * 0.55]);
      sphere(model, k, 0xfff9ea, [position[0] + side * spread - radius * 0.25, position[1] + radius * 0.4, position[2] + radius * 0.48], [radius * 0.29, radius * 0.32, radius * 0.16]);
    }
  };
  if (kind === 'humanoid') {
    sphere(model, k, tint, [0, 0.87, 0], [0.32, 0.31, 0.23]);
    cylinder(model, k, tint, [0, 0.61, 0], 0.25, 0.33, 0.3, 12);
    cylinder(model, k, sash, [0, 0.72, 0], 0.3, 0.3, 0.1, 12).scale.z = 0.8;
    modelingSolid(model, k, pale, [[-0.2, 0.23], [-0.06, 0.16], [0.19, -0.16], [0.1, -0.18]], [0, 0.96, 0.225], 0.025);
    sphere(model, k, pale, [0, 1.43, 0.02], [0.39, 0.4, 0.32]);
    mesh(model, k, k.geometry('monster-scalp', avatarScalpGeometry), dark, [0, 1.455, 0.004], [0.404, 0.414, 0.337]);
    eyes([0, 1.43, 0.327], 0.16, 0.068);
    for (const side of [-1, 1]) {
      rod(model, k, dark, [side * 0.09, 1.55, 0.321], [side * 0.24, 1.59, 0.283], 0.025);
      sphere(model, k, pale, [side * 0.37, 1.42, 0.015], [0.06, 0.09, 0.055]);
      sphere(model, k, dark, [side * 0.16, 0.28, 0], [0.125, 0.22, 0.12]);
      sphere(model, k, dark, [side * 0.16, 0.12, 0.09], [0.15, 0.12, 0.2]);
      cylinder(model, k, sash, [side * 0.16, 0.32, 0], 0.126, 0.126, 0.075, 12);
      rod(model, k, tint, [side * 0.3, 1.04, 0], [side * 0.45, 0.78, 0.09], 0.105);
      sphere(model, k, pale, [side * 0.45, 0.72, 0.12], [0.1, 0.1, 0.085]);
    }
    sphere(model, k, 0xd59a78, [0, 1.37, 0.345], [0.045, 0.035, 0.035]);
    avatarStroke(model, k, dark, [[-0.07, 1.28, 0.299], [0, 1.26, 0.319], [0.09, 1.29, 0.289]], 0.012);
    if (bandit) {
      const band = cylinder(model, k, sash, [0, 1.65, 0.01], 0.345, 0.37, 0.1, 16); band.scale.z = 0.84;
      sphere(model, k, sash, [-0.36, 1.65, -0.03], [0.08, 0.07, 0.08]);
      avatarSweep(model, k, sash, [[-0.36, 1.65, -0.07], [-0.5, 1.52, -0.11], [-0.44, 1.31, -0.14]], 0.06, 0.02);
      const saber = buildWeapon(model, k, 'blade'); saber.position.set(0.45, 0.73, 0.15); saber.rotation.z = -0.92; saber.scale.setScalar(0.67);
      modelingSolid(model, k, sash, [[0, 0.02], [0.12, 0], [0.08, -0.35], [-0.04, -0.26]], [-0.17, 0.72, 0.245], 0.03);
      if (elite) {
        sphere(model, k, amber, [-0.34, 1.03, 0], [0.18, 0.11, 0.25]);
        sphere(model, k, dark, [-0.16, 1.43, 0.35], [0.095, 0.075, 0.025]);
        rod(model, k, dark, [-0.34, 1.53, 0.15], [0.33, 1.35, 0.21], 0.012);
        sphere(model, k, amber, [0, 0.72, 0.258], [0.07, 0.075, 0.03]);
      }
    } else {
      cylinder(model, k, amber, [0, 1.82, 0], 0.18, 0.31, 0.1, 12);
      rod(model, k, dark, [0.45, 0.25, 0.13], [0.45, 1.4, 0.13], 0.03);
      cylinder(model, k, pale, [0.45, 1.49, 0.13], 0, 0.075, 0.23, 6);
    }
  } else if (kind === 'golem' && wooden) {
    cylinder(model, k, tint, [0, 0.99, 0], 0.38, 0.46, 1.28, 10);
    cylinder(model, k, pale, [0, 1.638, 0], 0.345, 0.345, 0.035, 10);
    for (const radius of [0.12, 0.23]) {
      const grain = mesh(model, k, k.geometry(`stump-grain:${radius}`, () => new THREE.TorusGeometry(radius, 0.013, 4, 16)), 0x9e734a, [0, 1.662, 0]); grain.rotation.x = -Math.PI / 2;
    }
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU;
      rod(model, k, 0x78573d, [Math.sin(a) * 0.41, 0.5, Math.cos(a) * 0.41], [Math.sin(a) * 0.368, 1.53 - i % 3 * 0.08, Math.cos(a) * 0.368], 0.024);
    }
    eyes([0, 1.23, 0.386], 0.17, 0.078);
    avatarStroke(model, k, 0x5d4939, [[-0.11, 0.98, 0.434], [0, 0.94, 0.444], [0.11, 0.98, 0.434]], 0.019);
    for (const side of [-1, 1]) {
      rod(model, k, tint, [side * 0.27, 0.48, 0], [side * 0.38, 0.13, 0.24], 0.13);
      rod(model, k, tint, [side * 0.38, 0.13, 0.24], [side * 0.54, 0.08, 0.35], 0.085);
      rod(model, k, tint, [side * 0.38, 1.1, 0], [side * 0.62, 0.96, 0.06], 0.105);
      rod(model, k, tint, [side * 0.62, 0.96, 0.06], [side * 0.64, 0.71, 0.19], 0.085);
      rod(model, k, tint, [side * 0.62, 0.96, 0.06], [side * 0.8, 1.08, 0.09], 0.042);
      avatarPetal(model, k, 0x7fa267, [side * 0.25, 1.7, 0], [0.32, 0.32, 0.1]).rotation.z = -side * 0.6;
      sphere(model, k, 0x7fa267, [side * 0.27, 0.47, 0.31], [0.2, 0.09, 0.1]);
    }
  } else if (kind === 'golem') {
    stone(model, k, tint, [0, 0.88, 0], [0.46, 0.46, 0.33]);
    stone(model, k, pale, [0, 1.46, 0.025], [0.4, 0.36, 0.32]);
    eyes([0, 1.49, 0.32], 0.16, 0.07);
    sphere(model, k, amber, [0, 0.92, 0.326], [0.09, 0.13, 0.025], { emissive: amber, emissiveIntensity: 0.23 });
    for (const side of [-1, 1]) {
      stone(model, k, tint, [side * 0.21, 0.23, 0.05], [0.21, 0.24, 0.26]);
      stone(model, k, tint, [side * 0.46, 1.04, 0], [0.25, 0.26, 0.24]);
      stone(model, k, pale, [side * 0.52, 0.69, 0.06], [0.19, 0.23, 0.2]);
      sphere(model, k, 0x739b76, [side * 0.28, 1.72, -0.06], [0.19, 0.1, 0.17]);
    }
  } else if (kind === 'beast') {
    const squat = boar || bear || reptile;
    const headY = reptile ? 0.73 : boar ? 1.01 : rabbit ? 1.14 : 1.13;
    sphere(model, k, tint, [0, squat ? 0.65 : 0.72, -0.04], [squat ? 0.46 : 0.34, squat ? 0.4 : 0.33, rabbit ? 0.4 : 0.59]);
    sphere(model, k, tint, [0, headY, 0.43], [boar ? 0.39 : rabbit ? 0.34 : 0.31, reptile ? 0.23 : 0.34, reptile ? 0.4 : 0.32]);
    if (boar) {
      sphere(model, k, 0xdba899, [0, 0.95, 0.765], [0.235, 0.17, 0.125]);
      for (const side of [-1, 1]) {
        sphere(model, k, dark, [side * 0.084, 0.97, 0.878], [0.034, 0.044, 0.015]);
        avatarSweep(model, k, pale, [[side * 0.235, 0.79, 0.73], [side * 0.31, 0.84, 0.9], [side * (boss ? 0.34 : 0.28), boss ? 1.17 : 1.03, 0.87]], boss ? 0.083 : 0.046, boss ? 0.064 : 0.038);
        const ear = avatarPetal(model, k, tint, [side * 0.28, 1.31, 0.34], [0.24, 0.32, 0.12], 'ear'); ear.rotation.z = -side * 0.65;
        avatarPetal(ear, k, 0xdba899, [0, -0.03, 0.65], [0.6, 0.65, 0.1], 'ear');
      }
      for (let i = 0; i < 4; i++) modelingSolid(model, k, 0x604538, [[-0.055, 0], [0, 0.19], [0.055, 0]], [0, 1.02 + i * 0.055, -0.37 + i * 0.19], 0.085);
      avatarStroke(model, k, tint, [[0, 0.65, -0.61], [0.12, 0.8, -0.75], [0.24, 0.75, -0.78], [0.16, 0.65, -0.75]], 0.032);
    } else if (rabbit) {
      sphere(model, k, pale, [0, 1.03, 0.704], [0.17, 0.13, 0.075]);
      sphere(model, k, 0xc58792, [0, 1.075, 0.775], [0.043, 0.034, 0.025]);
      for (const side of [-1, 1]) {
        const ear = sphere(model, k, tint, [side * 0.18, 1.64, 0.39], [0.105, 0.36, 0.07]); ear.rotation.z = -side * 0.18;
        sphere(model, k, 0xe8afb4, [side * 0.205, 1.68, 0.455], [0.057, 0.23, 0.015]).rotation.z = -side * 0.18;
      }
      sphere(model, k, pale, [0, 0.57, -0.47], [0.16, 0.16, 0.16]);
    } else {
      sphere(model, k, pale, [0, headY - 0.13, reptile ? 0.8 : 0.737], [reptile ? 0.27 : 0.18, reptile ? 0.095 : 0.12, wolf || reptile ? 0.24 : 0.14]);
      sphere(model, k, dark, [0, headY - 0.07, wolf || reptile ? 0.951 : 0.851], [0.076, 0.053, 0.04]);
      for (const side of [-1, 1]) {
        if (bear) {
          sphere(model, k, tint, [side * 0.25, 1.42, 0.36], [0.12, 0.13, 0.08]);
          sphere(model, k, 0xd3ac92, [side * 0.25, 1.43, 0.431], [0.065, 0.07, 0.017]);
        } else if (!reptile) {
          const ear = avatarPetal(model, k, tint, [side * 0.23, 1.43, 0.35], [0.24, 0.46, 0.1], 'ear'); ear.rotation.z = -side * 0.22;
          avatarPetal(ear, k, pale, [0, -0.035, 0.64], [0.57, 0.68, 0.1], 'ear');
          avatarSweep(model, k, pale, [[side * 0.22, 1.03, 0.52], [side * 0.36, 0.98, 0.47], [side * 0.26, 0.87, 0.53]], 0.085, 0.045);
        }
      }
      if (reptile) {
        avatarSweep(model, k, tint, [[0, 0.64, -0.5], [0.3, 0.39, -0.75], [0.46, 0.2, -0.85]], 0.15, 0.13);
        for (let i = 0; i < 4; i++) crystalCrest(model, k, [0, 0.96, -0.45 + i * 0.23], amber);
        if (/犀/.test(monster.name)) cylinder(model, k, pale, [0, 0.98, 0.77], 0, 0.1, 0.35, 8);
      } else if (!bear) {
        avatarSweep(model, k, tint, [[0, 0.65, -0.53], [-0.25, 0.6, -0.72], [-0.4, 0.84, -0.81], [-0.37, 1.09, -0.73]], 0.13, 0.115, pale);
        avatarPetal(model, k, pale, [0, 0.72, 0.44], [0.4, 0.48, 0.065]);
      } else sphere(model, k, tint, [0, 0.63, -0.62], [0.13, 0.14, 0.13]);
    }
    eyes([0, headY + 0.08, reptile ? 0.745 : 0.718], boar ? 0.2 : 0.15, rabbit ? 0.075 : 0.064);
    for (const side of [-1, 1]) for (const z of [-0.34, 0.32]) {
      const hind = rabbit && z < 0;
      sphere(model, k, tint, [side * 0.28, 0.31, z], [hind ? 0.19 : 0.12, squat ? 0.23 : 0.29, hind ? 0.23 : 0.12]);
      sphere(model, k, boar ? dark : rabbit ? pale : tint, [side * 0.28, 0.11, z + 0.08], [hind ? 0.18 : 0.135, 0.11, hind ? 0.25 : 0.18]);
      if (boar) box(model, k, 0x766055, [side * 0.28, 0.1, z + 0.239], [0.022, 0.13, 0.016]);
    }
    if (elite) {
      const collar = mesh(model, k, k.geometry('beast-collar', () => new THREE.TorusGeometry(0.3, 0.055, 6, 16)), sash, [0, 0.89, 0.38]); collar.rotation.x = -0.45;
      sphere(model, k, amber, [0, 0.64, 0.52], [0.105, 0.11, 0.04]);
      if (boss && boar) {
        for (const side of [-1, 1]) sphere(model, k, amber, [side * 0.4, 0.78, -0.03], [0.065, 0.27, 0.34]);
        for (let i = 0; i < 3; i++) sphere(model, k, amber, [0, 1.15, -0.34 + i * 0.19], [0.15, 0.04, 0.09]);
      }
    }
  } else if (kind === 'crawler') {
    sphere(model, k, tint, [0, 0.44, 0], [0.49, 0.33, 0.48]);
    sphere(model, k, pale, [0, 0.43, 0.39], [0.25, 0.19, 0.23]);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const z = -0.3 + i * 0.26;
        rod(model, k, tint, [side * 0.3, 0.42, z], [side * 0.68, 0.28, z + 0.1], 0.055);
        rod(model, k, tint, [side * 0.68, 0.28, z + 0.1], [side * 0.74, 0.075, z + 0.17], 0.045);
        sphere(model, k, pale, [side * 0.68, 0.28, z + 0.1], [0.07, 0.07, 0.07]);
      }
      rod(model, k, tint, [side * 0.32, 0.44, 0.3], [side * 0.56, 0.53, 0.64], 0.09);
      sphere(model, k, tint, [side * 0.59, 0.56, 0.73], [0.18, 0.15, 0.24]);
      sphere(model, k, pale, [side * 0.58, 0.62, 0.88], [0.12, 0.04, 0.13]);
      rod(model, k, pale, [side * 0.14, 0.56, 0.4], [side * 0.16, 0.77, 0.45], 0.035);
    }
    eyes([0, 0.8, 0.484], 0.16, 0.07);
  } else if (kind === 'bird') {
    sphere(model, k, tint, [0, 0.83, 0], [0.33, 0.42, 0.33]);
    sphere(model, k, pale, [0, 0.87, 0.22], [0.23, 0.3, 0.14]);
    sphere(model, k, tint, [0, 1.36, 0.16], [0.32, 0.31, 0.3]);
    sphere(model, k, amber, [0, 1.25, 0.46], [0.12, 0.08, 0.16]);
    eyes([0, 1.41, 0.42], 0.14, 0.063);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const feather = sphere(model, k, i % 2 ? pale : tint, [side * (0.4 + i * 0.13), 1.01 + i * 0.04, -0.1], [0.27, 0.075, 0.2]);
        feather.rotation.z = side * 0.2;
      }
      rod(model, k, amber, [side * 0.13, 0.5, 0], [side * 0.15, 0.15, 0.05], 0.045);
      sphere(model, k, amber, [side * 0.15, 0.1, 0.12], [0.13, 0.075, 0.16]);
    }
    sphere(model, k, pale, [0, 1.65, 0.08], [0.08, 0.18, 0.085]).rotation.z = -0.3;
  } else if (kind === 'serpent') {
    const coil = mesh(model, k, k.geometry('coil', () => new THREE.TorusGeometry(0.38, 0.16, 14, 32)), tint, [0, 0.18, 0]);
    coil.rotation.x = Math.PI / 2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.28, 0.2, 0), new THREE.Vector3(0.16, 0.65, 0.05),
      new THREE.Vector3(-0.04, 0.98, 0.15), new THREE.Vector3(0, 1.2, 0.3),
    ]);
    mesh(model, k, k.geometry('snake-neck', () => new THREE.TubeGeometry(curve, 20, 0.16, 12, false)), tint, [0, 0, 0]);
    sphere(model, k, tint, [0, 1.29, 0.36], [0.32, 0.25, 0.32]);
    sphere(model, k, pale, [0, 1.16, 0.51], [0.25, 0.1, 0.21]);
    eyes([0, 1.35, 0.622], 0.14, 0.065);
    for (const side of [-1, 1]) sphere(model, k, amber, [side * 0.24, 1.12, 0.23], [0.13, 0.26, 0.075]);
  } else {
    sphere(model, k, tint, [0, 0.92, 0], [0.34, 0.42, 0.28]);
    sphere(model, k, pale, [0, 1.44, 0.02], [0.35, 0.34, 0.29]);
    cylinder(model, k, tint, [0, 0.43, 0], 0.3, 0.025, 0.68, 24);
    eyes([0, 1.47, 0.29], 0.13, 0.063);
    for (const side of [-1, 1]) {
      sphere(model, k, tint, [side * 0.37, 1, 0], [0.15, 0.22, 0.14]).rotation.z = side * 0.65;
      sphere(model, k, amber, [side * 0.46, 0.96, 0.1], [0.07, 0.08, 0.07], { emissive: amber, emissiveIntensity: 0.2 });
    }
    sphere(model, k, tint, [-0.06, 1.8, -0.025], [0.14, 0.22, 0.13]).rotation.z = -0.35;
  }
  if (elite && kind !== 'beast' && !(bandit && !boss)) {
    const top = { humanoid: 1.91, golem: 1.85, crawler: 0.84, bird: 1.85, serpent: 1.6, spirit: 2.01 }[kind];
    if (boss) {
      cylinder(model, k, amber, [0, top, 0], 0.23, 0.26, 0.1, 20);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * TAU;
        cylinder(model, k, amber, [Math.sin(a) * 0.22, top + 0.15, Math.cos(a) * 0.22], 0, 0.07, 0.23, 10);
        sphere(model, k, 0xe48f88, [Math.sin(a) * 0.22, top + 0.27, Math.cos(a) * 0.22], [0.04, 0.04, 0.04]);
      }
      sphere(model, k, amber, [0, kind === 'crawler' ? 0.4 : 0.85, kind === 'beast' ? 0.56 : 0.3], [0.13, 0.12, 0.055]);
    } else for (const side of [-1, 1]) {
      const horn = cylinder(model, k, amber, [side * 0.22, top, 0], 0, 0.08, 0.25, 10);
      horn.rotation.z = -side * 0.4;
    }
  }
  // After falling 90 degrees, local +X becomes the ground-facing side.
  // Lift by its actual extent instead of burying half the corpse in the terrain.
  model.rotation.y = 0;
  model.updateWorldMatrix(true, true);
  const fallHeight = new THREE.Box3().setFromObject(model).max.x - root.position.x + 0.025;
  model.rotation.y = -0.48;
  modelingBatch(model, k);
  const shadow = contact(root, k, kind === 'crawler' || kind === 'beast' ? 0.72 : 0.46);
  const selection = ring(root, k, kind === 'crawler' || kind === 'beast' ? 0.82 : 0.61);
  selection.visible = false;
  const warning = mesh(root, k, k.geometry('heavy-warning', () => new THREE.CircleGeometry(1.4, 48)), 0xe44842, [0, 0.025, 0], [1, 1, 1], { transparent: true, opacity: 0.48, depthWrite: false, side: THREE.DoubleSide, emissive: 0xf04444, emissiveIntensity: 1, toneMapped: false });
  warning.rotation.x = -Math.PI / 2;
  warning.visible = false;
  return { root, model, k, shadow, selection, warning, fallHeight, id: monster.id, hp: monster.hp, dead: null, hit: 0, phase: index * 1.7, baseYaw: -0.48 };
}

const ENEMY_POSITIONS = {
  1: [[1.55, 0.2]],
  2: [[1.15, -0.6], [2.15, 1.04]],
  3: [[1, -1.05], [2.6, -0.3], [1.5, 1.3]],
  4: [[0.85, -1.15], [2.65, -0.8], [1.05, 1.15], [2.75, 1.25]],
};

const REACH = 2.3;
const WALK_SPEED = 3.5;
const DIRECTIONS = new Set(['up', 'down', 'left', 'right']);
const KEY_DIRECTIONS = { w: 'up', s: 'down', a: 'left', d: 'right', arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right' };

function buildNavigation(dressing, rx, rz) {
  const obstacles = [];
  const bounds = new THREE.Box3();
  dressing.traverse((object) => {
    if (object.userData.navigationFootprint) {
      const [x, z] = object.userData.navigationFootprint;
      bounds.set(new THREE.Vector3(-x, 0, -z), new THREE.Vector3(x, 1.2, z)).applyMatrix4(object.matrixWorld);
      if (bounds.min.y < 2.3) obstacles.push({ minX: bounds.min.x - 0.36, maxX: bounds.max.x + 0.36, minZ: bounds.min.z - 0.36, maxZ: bounds.max.z + 0.36 });
      return;
    }
    if (!object.isMesh) return;
    for (let parent = object.parent; parent; parent = parent.parent) if (parent.userData.navigationFootprint) return;
    bounds.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
    const width = bounds.max.x - bounds.min.x;
    const depth = bounds.max.z - bounds.min.z;
    if (bounds.min.y > 0.55 || bounds.max.y < 0.32 || bounds.max.y - bounds.min.y < 0.18 || width < 0.15 || depth < 0.15) return;
    obstacles.push({ minX: bounds.min.x - 0.36, maxX: bounds.max.x + 0.36, minZ: bounds.min.z - 0.36, maxZ: bounds.max.z + 0.36 });
  });
  const inside = (x, z) => (x / (rx - 0.48)) ** 2 + ((z + 1.6) / (rz - 0.48)) ** 2 <= 1;
  const free = (x, z) => inside(x, z) && !obstacles.some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);
  const segment = (a, b) => {
    if (!free(a.x, a.z) || !free(b.x, b.z)) return false;
    return !obstacles.some((bounds) => {
      let enter = 0;
      let exit = 1;
      for (const [axis, min, max] of [['x', bounds.minX, bounds.maxX], ['z', bounds.minZ, bounds.maxZ]]) {
        const delta = b[axis] - a[axis];
        if (Math.abs(delta) < 1e-10) {
          if (a[axis] < min || a[axis] > max) return false;
        } else {
          const first = (min - a[axis]) / delta;
          const last = (max - a[axis]) / delta;
          enter = Math.max(enter, Math.min(first, last));
          exit = Math.min(exit, Math.max(first, last));
          if (enter > exit) return false;
        }
      }
      return enter <= exit;
    });
  };
  const step = 0.5;
  const cols = Math.round(rx * 2 / step) + 1;
  const rows = Math.round(rz * 2 / step) + 1;
  const nodes = new Array(cols * rows).fill(null);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = -rx + col * step;
    const z = -1.6 - rz + row * step;
    const index = row * cols + col;
    if (free(x, z)) nodes[index] = { x, z, index, neighbors: [] };
  }
  let spawn = { x: -1.65, z: 0.55 };
  const candidates = nodes.filter(Boolean);
  let start = candidates.reduce((best, node) => !best || Math.hypot(node.x - spawn.x, node.z - spawn.z) < Math.hypot(best.x - spawn.x, best.z - spawn.z) ? node : best, null);
  if (!free(spawn.x, spawn.z) || !segment(spawn, start)) spawn = { x: start.x, z: start.z };
  const queue = [start];
  const visited = new Set([start.index]);
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    const col = node.index % cols;
    const row = Math.floor(node.index / cols);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dz) || col + dx < 0 || col + dx >= cols || row + dz < 0 || row + dz >= rows) continue;
      const other = nodes[(row + dz) * cols + col + dx];
      if (!other || !segment(node, other)) continue;
      node.neighbors.push(other.index);
      if (!visited.has(other.index)) { visited.add(other.index); queue.push(other); }
    }
  }
  return { nodes, reachable: queue, spawn, free, inside, segment };
}

function nearestNode(nav, point, requireSegment = false, maxDistance = Infinity) {
  let best = null;
  let distance = maxDistance;
  for (const node of nav.reachable) {
    const d = Math.hypot(node.x - point.x, node.z - point.z);
    if (d < distance && (!requireSegment || nav.segment(point, node))) { best = node; distance = d; }
  }
  return best;
}

// Auto-walk detours around other aggressive monsters' rings when a route exists; manual movement does not.
const RING_PENALTY = 12;
function findPath(nav, from, goal, radius = 0, avoid = []) {
  const penalty = (n) => avoid.some((c) => Math.hypot(n.x - c.x, n.z - c.z) <= c.r) ? RING_PENALTY : 0;
  const start = nearestNode(nav, from, true);
  if (!start || !nav.inside(goal.x, goal.z)) return null;
  const end = radius ? null : nearestNode(nav, goal, nav.free(goal.x, goal.z), 1.8);
  if (!radius && !end) return null;
  const goals = new Set(radius ? nav.reachable.filter((n) => Math.hypot(n.x - goal.x, n.z - goal.z) <= radius).map((n) => n.index) : [end.index]);
  if (!goals.size) return null;
  const scores = new Float64Array(nav.nodes.length).fill(Infinity);
  const parents = new Int32Array(nav.nodes.length).fill(-1);
  const closed = new Uint8Array(nav.nodes.length);
  const heap = [];
  const push = (entry) => {
    let i = heap.length;
    heap.push(entry);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].f <= entry.f) break;
      heap[i] = heap[p]; i = p;
    }
    heap[i] = entry;
  };
  const pop = () => {
    const first = heap[0];
    const last = heap.pop();
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1].f < heap[child].f) child++;
        if (heap[child].f >= last.f) break;
        heap[i] = heap[child]; i = child;
      }
      heap[i] = last;
    }
    return first;
  };
  const heuristic = (n) => radius ? Math.max(0, Math.hypot(n.x - goal.x, n.z - goal.z) - radius) : Math.hypot(n.x - end.x, n.z - end.z);
  scores[start.index] = 0;
  push({ index: start.index, f: heuristic(start) });
  while (heap.length) {
    const { index } = pop();
    if (closed[index]) continue;
    closed[index] = 1;
    const node = nav.nodes[index];
    if (goals.has(index)) {
      const path = [];
      for (let cursor = index; cursor >= 0; cursor = parents[cursor]) path.push({ x: nav.nodes[cursor].x, z: nav.nodes[cursor].z });
      path.reverse();
      if (!radius && nav.free(goal.x, goal.z) && nav.segment(node, goal)) path.push({ x: goal.x, z: goal.z });
      return path;
    }
    for (const neighbor of node.neighbors) {
      if (closed[neighbor]) continue;
      const other = nav.nodes[neighbor];
      const g = scores[index] + Math.hypot(other.x - node.x, other.z - node.z) + (avoid.length ? penalty(other) : 0);
      if (g >= scores[neighbor]) continue;
      scores[neighbor] = g; parents[neighbor] = index;
      push({ index: neighbor, f: g + heuristic(other) });
    }
  }
  return null;
}

function fieldPosition(s, monster) {
  if (s.fieldPositions.has(monster.id)) return s.fieldPositions.get(monster.id);
  const nav = s.environment.navigation;
  const seed = hash(`${s.mapKey}:${monster.id}`);
  const angle = seed / 4294967296 * TAU;
  const radius = 4.6 + ((seed >>> 12) % 1000) / 1000 * 8.3;
  const desired = { x: Math.sin(angle) * radius, z: -1.6 + Math.cos(angle) * radius * 0.78 };
  const placed = [...s.fieldPositions.values()];
  const aggro = monster.aggro || 0;
  // Prefer spots where the spawn and every attack position stay outside other monsters' rings.
  const spacing = (p, strict) => strict ? Math.max(aggro, p.aggro || 0) + REACH + 0.4 : 2.6;
  let best = null;
  for (const strict of [true, false]) {
    let bestScore = Infinity;
    for (const node of nav.reachable) {
      if (Math.hypot(node.x - nav.spawn.x, node.z - nav.spawn.z) < (strict ? Math.max(3.7, aggro + 1.2) : 3.7)) continue;
      if (placed.some((p) => Math.hypot(node.x - p.x, node.z - p.z) < spacing(p, strict))) continue;
      const score = Math.hypot(node.x - desired.x, node.z - desired.z);
      if (score < bestScore) { best = node; bestScore = score; }
    }
    if (best) break;
  }
  best ??= nearestNode(nav, desired);
  const position = { x: best.x, z: best.z, name: monster.name, aggro };
  s.fieldPositions.set(monster.id, position);
  return position;
}

function movementAllowed(s) {
  return Boolean(s?.state?.explorable && s.state.movementEnabled && !s.state.active && canRender(s));
}

const rtOrigin = (state) => (state?.explorable && state.rt?.origin) || { x: 0, z: 0 };

// Passive monsters still fight back once the player walks right up to them.
const TOUCH_RADIUS = 1.6;

// Field monsters stay still; engagement fires once per entry into the radius.
function checkAggro(s) {
  const watching = movementAllowed(s);
  const { x, z } = s.avatar?.root.position ?? {};
  for (const enemy of s.enemies) {
    const radius = enemy.aggro || enemy.touch;
    if (!radius) continue;
    const distance = Math.hypot(x - enemy.root.position.x, z - enemy.root.position.z);
    if (enemy.aggroRing) enemy.aggroRing.visible = watching && !enemy.dead && distance <= enemy.aggro + 2.5;
    if (!watching || enemy.dead) continue;
    if (distance > radius + 0.4) enemy.armed = true;
    else if (enemy.armed && distance <= radius) {
      enemy.armed = false;
      haltMovement(s);
      document.dispatchEvent(new CustomEvent('scene-aggro', { detail: { id: enemy.id } }));
      return;
    }
  }
}

function arrive(s, id) {
  const approaching = s.approach;
  haltMovement(s, true);
  if (!approaching && id != null) document.dispatchEvent(new CustomEvent('scene-engage', { detail: { id } }));
}

export function getEncounterLayout(id) {
  const s = live;
  const enemy = s?.enemies.find((e) => e.id === id && !e.dead);
  if (!enemy || !s.avatar) return null;
  const a = s.avatar.root.position;
  const b = enemy.root.position;
  const round = (n) => Math.round(n * 1000) / 1000;
  let hx = THREE.MathUtils.clamp((b.x - a.x) / 2, -3.6, 3.6);
  let hz = THREE.MathUtils.clamp((b.z - a.z) / 2, -2.5, 2.5);
  if (Math.hypot(hx, hz) < 0.4) { hx = 0.4; hz = 0; }
  hx = round(hx); hz = round(hz);
  return { origin: { x: round(a.x + hx), z: round(a.z + hz) }, player: { x: -hx, z: -hz }, enemy: { x: hx, z: hz } };
}

function movementData(s) {
  if (!s?.state?.explorable || !s.avatar || s.disposed || s.lost) return null;
  const { x, z } = s.avatar.root.position;
  const selected = s.enemies.find((e) => e.id === s.state.targetId);
  let nearbyId = null;
  let closest = REACH + 0.000001;
  for (const enemy of s.enemies) {
    const distance = Math.hypot(x - enemy.root.position.x, z - enemy.root.position.z);
    if (!enemy.dead && distance < closest) { nearbyId = enemy.id; closest = distance; }
  }
  return { location: s.state.location, x, z, moving: s.moving, enabled: movementAllowed(s), overview: s.overview,
    nearbyId, distance: selected ? Math.hypot(x - selected.root.position.x, z - selected.root.position.z) : null,
    targetId: s.state.targetId, available: true };
}

function emitMovement(s, force = false) {
  const detail = movementData(s);
  if (!detail) return;
  const now = performance.now();
  const signature = JSON.stringify([detail.location, detail.moving, detail.enabled, detail.overview, detail.nearbyId, detail.targetId, detail.distance != null && detail.distance <= REACH]);
  if (!force && signature === s.movementSignature && now - s.movementEmitted < 100) return;
  s.movementSignature = signature;
  s.movementEmitted = now;
  document.dispatchEvent(new CustomEvent('scene-movement', { detail }));
}

function haltMovement(s, result = false) {
  if (!s) return;
  s.heldKeys.clear();
  s.heldDirections.clear();
  s.path = [];
  s.walkTarget = null;
  s.moving = false;
  const pending = s.approach;
  s.approach = null;
  if (s.avatar) pose(s, 0);
  s.dirty = true;
  emitMovement(s, true);
  pending?.resolve(result);
}

function startWalk(s, goal, id = null) {
  haltMovement(s);
  if (!movementAllowed(s)) return false;
  const nav = s.environment.navigation;
  const avoid = s.enemies.filter((e) => e.aggro && e.id !== id && !e.dead).map((e) => ({ x: e.root.position.x, z: e.root.position.z, r: e.aggro + 0.5 }));
  const path = findPath(nav, s.avatar.root.position, goal, id == null ? 0 : REACH - 0.15, avoid);
  if (!path) return false;
  s.path = path;
  s.walkTarget = id;
  s.moving = true;
  s.dirty = true;
  emitMovement(s, true);
  schedule(s);
  return true;
}

function tickMovement(s, delta) {
  if (!movementAllowed(s)) {
    if (s.moving || s.path.length || s.approach || s.heldKeys.size || s.heldDirections.size) haltMovement(s);
    return;
  }
  const enemy = s.walkTarget == null ? null : s.enemies.find((e) => e.id === s.walkTarget && !e.dead);
  if (s.walkTarget != null && !enemy) { haltMovement(s); return; }
  const position = s.avatar.root.position;
  if (enemy && Math.hypot(position.x - enemy.root.position.x, position.z - enemy.root.position.z) <= REACH) {
    arrive(s, enemy.id); return;
  }
  const directions = new Set([...s.heldDirections, ...[...s.heldKeys].map((key) => KEY_DIRECTIONS[key])]);
  const horizontal = Number(directions.has('right')) - Number(directions.has('left'));
  const vertical = Number(directions.has('down')) - Number(directions.has('up'));
  const nav = s.environment.navigation;
  const beforeX = position.x;
  const beforeZ = position.z;
  const move = (dx, dz, slide) => {
    const from = { x: position.x, z: position.z };
    const to = { x: from.x + dx, z: from.z + dz };
    if (nav.segment(from, to)) { position.x = to.x; position.z = to.z; return true; }
    if (!slide) return false;
    const alongX = { x: from.x + dx, z: from.z };
    if (nav.segment(from, alongX)) position.x = alongX.x;
    const alongZ = { x: position.x, z: from.z + dz };
    if (nav.segment(position, alongZ)) position.z = alongZ.z;
    return position.x !== from.x || position.z !== from.z;
  };
  if (directions.size) {
    const length = Math.hypot(horizontal, vertical);
    if (length) {
      const stride = WALK_SPEED * delta / length;
      move((horizontal * Math.cos(s.yaw) + vertical * Math.sin(s.yaw)) * stride,
        (-horizontal * Math.sin(s.yaw) + vertical * Math.cos(s.yaw)) * stride, true);
    }
  } else {
    let budget = WALK_SPEED * delta;
    while (s.path.length && budget > 0) {
      const waypoint = s.path[0];
      const dx = waypoint.x - position.x;
      const dz = waypoint.z - position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.001) { s.path.shift(); continue; }
      const stride = Math.min(budget, distance);
      if (!move(dx / distance * stride, dz / distance * stride, false)) { haltMovement(s); return; }
      budget -= stride;
      if (stride >= distance) s.path.shift();
      if (enemy && Math.hypot(position.x - enemy.root.position.x, position.z - enemy.root.position.z) <= REACH) break;
    }
  }
  const travelled = Math.hypot(position.x - beforeX, position.z - beforeZ);
  s.moving = travelled > 0.00001;
  if (s.moving) {
    s.facing = Math.atan2(position.x - beforeX, position.z - beforeZ);
    s.walkPhase += travelled * 3.2;
    if (!s.overview) positionCamera(s);
  }
  if (enemy && Math.hypot(position.x - enemy.root.position.x, position.z - enemy.root.position.z) <= REACH) arrive(s, enemy.id);
  else if (!s.path.length && s.walkTarget != null) haltMovement(s);
  emitMovement(s);
  if (s.moving) checkAggro(s);
}

export function getWorldMovement() {
  return movementData(live);
}

export function stopWorldMovement() {
  if (!live) return;
  haltMovement(live);
  schedule(live);
}

export function moveWorldDirection(direction, pressed = true) {
  const s = live;
  if (!s || !DIRECTIONS.has(direction)) return false;
  if (!pressed) {
    s.heldDirections.delete(direction);
    if (!s.heldDirections.size && !s.heldKeys.size) { s.moving = false; pose(s, 0); emitMovement(s, true); }
    s.dirty = true;
    schedule(s);
    return true;
  }
  if (!movementAllowed(s)) return false;
  if (!s.heldDirections.has(direction)) {
    const retained = [...s.heldDirections];
    haltMovement(s);
    retained.forEach((d) => s.heldDirections.add(d));
    s.heldDirections.add(direction);
  }
  schedule(s);
  return true;
}

export function toggleWorldOverview() {
  if (!live?.state?.explorable || !canRender(live)) return false;
  live.overview = !live.overview;
  positionCamera(live);
  live.dirty = true;
  emitMovement(live, true);
  schedule(live);
  return live.overview;
}

export function approachWorldTarget(id) {
  const s = live;
  if (!s) return Promise.resolve(false);
  haltMovement(s);
  const enemy = s.enemies.find((e) => e.id === id && !e.dead);
  if (!movementAllowed(s) || !enemy || id == null) return Promise.resolve(false);
  if (Math.hypot(s.avatar.root.position.x - enemy.root.position.x, s.avatar.root.position.z - enemy.root.position.z) <= REACH) return Promise.resolve(true);
  if (!startWalk(s, enemy.root.position, id)) return Promise.resolve(false);
  return new Promise((resolve) => { s.approach = { id, resolve }; });
}

function removeLayer(scene, layer) {
  if (!layer) return;
  scene.remove(layer.root);
  // InstancedMesh owns an additional per-object allocation.
  layer.root.traverse((object) => { if (object.isInstancedMesh) object.dispose(); });
  layer.k.dispose();
  layer.root.clear();
}

function updateWorld(s, next) {
  const previous = s.state;
  const mapKey = JSON.stringify([next.location, next.explorable, !next.explorable && !!next.rt, next.explorable ? next.city : next.city && !next.active]);
  const avatarKey = JSON.stringify([next.cls, next.race, next.weapon]);
  const roster = !next.explorable && next.city && !next.active ? [] : next.monsters;
  const rosterKey = JSON.stringify([next.active, roster.map((m) => [m.id, m.name, m.rank, m.ambient, m.aggro])]);
  const sameContext = s.mapKey === mapKey && s.rosterKey === rosterKey && s.avatarKey === avatarKey;
  const changedMap = s.mapKey !== mapKey;
  if (changedMap) {
    haltMovement(s);
    s.fieldPositions.clear();
    s.battlePositions.clear();
    s.fieldSelected = null;
    s.overview = false;
    s.facing = 0.24;
    removeLayer(s.scene, s.environment);
    s.environment = buildEnvironment(next);
    s.scene.add(s.environment.root);
    s.scene.background.setHex(s.environment.palette.sky);
    s.scene.fog.color.setHex(s.environment.palette.sky);
    s.mapKey = mapKey;
    s.yaw = 0.27;
  }
  const savedPosition = !changedMap && s.avatar ? { x: s.avatar.root.position.x, z: s.avatar.root.position.z } : s.environment.navigation?.spawn;
  if (s.avatarKey !== avatarKey) {
    removeLayer(s.scene, s.avatar);
    s.avatar = buildAvatar(next);
    s.scene.add(s.avatar.root);
    s.avatarKey = avatarKey;
  }
  if (savedPosition) s.avatar.root.position.set(savedPosition.x, 0, savedPosition.z);
  else if (changedMap) s.avatar.root.position.set(-1.65, 0, 0.55);
  if (next.explorable && previous?.rt && !next.rt) {
    const nav = s.environment.navigation;
    const at = s.avatar.root.position;
    if (!nav.free(at.x, at.z)) {
      const node = nearestNode(nav, at);
      if (node) at.set(node.x, 0, node.z);
    }
  }
  const origin = rtOrigin(next);
  if (next.explorable && next.active && !previous?.active) {
    haltMovement(s);
    s.battlePositions.clear();
    const nav = s.environment.navigation;
    const fighters = roster.filter((m) => !m.ambient);
    let anchor = s.fieldSelected && fighters[0]?.name === s.fieldSelected.name ? s.fieldSelected : [...s.fieldPositions.values()].find((p) => p.name === fighters[0]?.name);
    anchor ??= nearestNode(nav, { x: s.avatar.root.position.x + 2.1, z: s.avatar.root.position.z - 0.5 });
    fighters.forEach((m, i) => {
      const desired = i ? { x: anchor.x + Math.cos(i * 2.4) * 2.1, z: anchor.z + Math.sin(i * 2.4) * 2.1 } : anchor;
      let best = null;
      let distance = Infinity;
      for (const node of nav.reachable) {
        if (Math.hypot(node.x - s.avatar.root.position.x, node.z - s.avatar.root.position.z) < 1.25) continue;
        if ([...s.battlePositions.values()].some((p) => Math.hypot(node.x - p.x, node.z - p.z) < 1.55)) continue;
        const d = Math.hypot(node.x - desired.x, node.z - desired.z);
        if (d < distance) { best = node; distance = d; }
      }
      const position = i === 0 && nav.free(anchor.x, anchor.z) ? anchor : best ?? nearestNode(nav, desired);
      s.battlePositions.set(m.id, { x: position.x, z: position.z });
    });
  }
  if (s.rosterKey !== rosterKey) {
    s.enemies.forEach((enemy) => removeLayer(s.scene, enemy));
    if (next.explorable && !next.active) roster.filter((m) => !s.battlePositions.has(m.id)).sort((a, b) => String(a.id).localeCompare(String(b.id))).forEach((m) => fieldPosition(s, m));
    s.enemies = roster.map((m, i) => {
      const p = next.explorable ? s.battlePositions.get(m.id) ?? fieldPosition(s, m) : null;
      const enemy = buildEnemy(m, p ? [p.x, p.z] : ENEMY_POSITIONS[roster.length][i], i);
      enemy.ambient = m.ambient;
      enemy.aggro = next.explorable && !next.active ? m.aggro : 0;
      enemy.touch = next.explorable && !next.active && !m.ambient && m.aggro === 0 ? TOUCH_RADIUS : 0;
      if (enemy.touch) enemy.armed = Math.hypot(s.avatar.root.position.x - enemy.root.position.x, s.avatar.root.position.z - enemy.root.position.z) > enemy.touch;
      if (enemy.aggro > 0) {
        enemy.aggroRing = mesh(enemy.root, enemy.k, enemy.k.geometry(`aggro:${enemy.aggro}`, () => new THREE.RingGeometry(enemy.aggro - 0.05, enemy.aggro, 56)),
          0xd9574c, [0, 0.03, 0], [1, 1, 1], { transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide, emissive: 0xd9574c, emissiveIntensity: 0.6, toneMapped: false });
        enemy.aggroRing.rotation.x = -Math.PI / 2;
        enemy.aggroRing.visible = false;
        enemy.armed = Math.hypot(s.avatar.root.position.x - enemy.root.position.x, s.avatar.root.position.z - enemy.root.position.z) > enemy.aggro;
      }
      return enemy;
    });
    s.enemies.forEach((enemy) => s.scene.add(enemy.root));
    s.rosterKey = rosterKey;
  }
  const advanced = sameContext && previous && (next.rt ? next.rt.tick > (previous.rt?.tick || 0) : next.round > previous.round) && (previous.active || next.active);
  if (next.rt) {
    if (!previous?.rt || next.rt.tick < previous.rt.tick) { s.eventSequence = 0; s.floats.forEach(f => f.node.remove()); s.floats = []; }
    if (!previous?.rt) s.avatar.root.position.set(origin.x + next.rt.player.x, 0, origin.z + next.rt.player.z);
    for (const ev of next.rt.events) {
      if (ev.seq <= s.eventSequence) continue;
      s.eventSequence = ev.seq;
      if (ev.actor === 'player' && ['attack', 'cast'].includes(ev.kind)) s.attack = 0.52;
      if (['damage', 'heal', 'miss', 'guard'].includes(ev.kind)) {
        const node = document.createElement('span'); node.className = `scene-float ${ev.kind}`;
        node.textContent = ev.kind === 'damage' ? `−${Math.round(ev.amount)}` : ev.kind === 'heal' ? `+${Math.round(ev.amount)}` : ev.kind === 'guard' ? '守御' : '闪避';
        const target = ev.target || ev.actor;
        const lane = s.floats.filter(f => f.target === target && f.age < 0.3).length;
        s.overlay.appendChild(node); s.floats.push({ node, target, age: 0, lane });
      }
    }
  }
  if (!next.rt) s.attack = advanced && !s.reducedMotion ? 0.52 : sameContext ? s.attack : 0;
  s.enemies.forEach((enemy, i) => {
    const current = roster[i];
    const rtEnemy = next.rt?.enemies[current.id];
    if (rtEnemy) {
      if (!previous?.rt) enemy.root.position.set(origin.x + rtEnemy.x, 0, origin.z + rtEnemy.z);
      enemy.warning.visible = current.hp > 0 && current.intent === 'heavy' && rtEnemy.windupUntil > next.rt.tick && !!rtEnemy.aim;
      if (enemy.warning.visible) enemy.warning.position.set(origin.x + rtEnemy.aim.x - enemy.root.position.x, 0.04, origin.z + rtEnemy.aim.z - enemy.root.position.z);
    }
    if (advanced && current.hp < enemy.hp && !s.reducedMotion) enemy.hit = 0.46;
    enemy.hp = current.hp;
    const dead = current.hp <= 0;
    if (enemy.dead !== dead) {
      enemy.dead = dead;
      enemy.k.eachMaterial((m) => {
        // The ground ring and contact shadow are not part of the fallen model.
        if (m === enemy.selection.material || m === enemy.shadow.material || m === enemy.warning.material || m === enemy.aggroRing?.material) return;
        m.transparent = dead;
        m.opacity = dead ? 0.28 : 1;
        m.depthWrite = !dead;
        m.needsUpdate = true;
      });
      enemy.shadow.material.opacity = dead ? 0.08 : 0.18;
    }
    enemy.selection.visible = !dead && current.id != null && current.id === next.targetId;
  });
  s.state = next;
  checkAggro(s);
  if (!next.movementEnabled || next.active || !next.explorable
      || (previous && previous.targetId !== next.targetId && s.walkTarget !== next.targetId)
      || (s.walkTarget != null && !s.enemies.some((e) => e.id === s.walkTarget && !e.dead))) haltMovement(s);
  if (next.explorable && !next.active) {
    const selected = s.enemies.find((e) => e.id === next.targetId && !e.dead);
    const monster = roster.find((m) => m.id === next.targetId);
    if (selected && monster) s.fieldSelected = { id: selected.id, name: monster.name, x: selected.root.position.x, z: selected.root.position.z };
  }
  s.dirty = true;
  pose(s, 0);
  positionCamera(s);
  emitMovement(s, true);
}

function positionCamera(s) {
  const aspect = Math.max(1, s.width) / Math.max(1, s.height);
  s.camera.aspect = aspect;
  const tangent = Math.tan(THREE.MathUtils.degToRad(s.camera.fov / 2));
  if (s.state?.showcase || (s.state?.rt && !s.state.explorable)) {
    const focus = s.state.showcase ? new THREE.Vector3(s.avatar.root.position.x, 1.15, s.avatar.root.position.z) : new THREE.Vector3(0, 0.8, 0);
    const distance = s.state.showcase ? Math.max(6, 3.6 / (2 * tangent * aspect)) : Math.max(12, 10.2 / (2 * tangent * Math.max(0.55, aspect)));
    const elevation = s.state.showcase ? 0.16 : 0.65;
    s.camera.position.set(focus.x + Math.sin(s.yaw) * Math.cos(elevation) * distance, focus.y + Math.sin(elevation) * distance, focus.z + Math.cos(s.yaw) * Math.cos(elevation) * distance);
    s.camera.lookAt(focus); s.camera.far = 100;
    s.scene.fog.near = distance + 15; s.scene.fog.far = distance + 40;
    s.camera.updateProjectionMatrix(); s.camera.updateMatrixWorld(true); return;
  }
  if (s.state?.explorable && !s.overview) {
    const focus = new THREE.Vector3(s.avatar.root.position.x, 0.75, s.avatar.root.position.z - 0.7);
    const distance = Math.max(14.5, 7.2 / (2 * tangent * Math.max(0.5, aspect)));
    const elevation = 0.85;
    s.camera.position.set(focus.x + Math.sin(s.yaw) * Math.cos(elevation) * distance,
      focus.y + Math.sin(elevation) * distance, focus.z + Math.cos(s.yaw) * Math.cos(elevation) * distance);
    s.camera.lookAt(focus);
    s.camera.far = 110;
    s.scene.fog.near = distance + 18;
    s.scene.fog.far = distance + 48;
    s.camera.updateProjectionMatrix();
    s.camera.updateMatrixWorld(true);
    return;
  }
  // Scenery-first isometric landscape, never a tight humanoid portrait.
  // Full island on landscape canvases. On tall phones peripheral rim/dressing
  // may bleed horizontally; fit the complete landmark and all scenery's
  // vertical bounds so the little actors do not shrink into unreadable dots.
  const portrait = aspect < 1;
  let distance = portrait ? Math.max(12, 13.6 / (2 * tangent), 10.4 / (2 * tangent * aspect)) : 12;
  const elevation = 0.8;
  const focus = new THREE.Vector3(0, 0.9, -1.8);
  const direction = new THREE.Vector3(Math.sin(s.yaw) * Math.cos(elevation), Math.sin(elevation), Math.cos(s.yaw) * Math.cos(elevation));
  s.camera.position.copy(focus).addScaledVector(direction, distance);
  s.camera.lookAt(focus);
  s.camera.updateMatrixWorld(true);
  const right = new THREE.Vector3().setFromMatrixColumn(s.camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(s.camera.matrixWorld, 1);
  const point = new THREE.Vector3();
  const fit = (worldPoint, horizontal = true) => {
    point.copy(worldPoint).sub(focus);
    distance = Math.max(distance, point.dot(direction) + Math.max(
      horizontal ? Math.abs(point.dot(right)) / (tangent * aspect * 0.94) : 0,
      Math.abs(point.dot(up)) / (tangent * 0.92),
    ));
  };
  s.environment.framePoints.forEach((worldPoint) => fit(worldPoint, s.state.explorable || !portrait));
  s.environment.focalPoints.forEach((worldPoint) => fit(worldPoint));
  const cornerPoint = new THREE.Vector3();
  for (const actor of [s.avatar.body, ...s.enemies.map((enemy) => enemy.model)]) {
    const bounds = new THREE.Box3().setFromObject(actor);
    for (let corner = 0; corner < 8; corner++) {
      cornerPoint.set(corner & 1 ? bounds.max.x : bounds.min.x, corner & 2 ? bounds.max.y : bounds.min.y,
        corner & 4 ? bounds.max.z : bounds.min.z);
      fit(cornerPoint);
    }
  }
  s.camera.position.copy(focus).addScaledVector(direction, distance);
  s.camera.far = Math.max(80, distance + 30);
  // Fog follows fit distance; narrow phones must not fog out the whole map.
  s.scene.fog.near = distance + 8;
  s.scene.fog.far = distance + 28;
  s.camera.updateProjectionMatrix();
  s.camera.updateMatrixWorld(true);
}

function pose(s, delta) {
  const idle = s.reducedMotion || s.moving ? 0 : Math.sin(s.time * 1.55);
  const avatar = s.avatar;
  if (!avatar) return;
  const gait = s.moving ? Math.sin(s.walkPhase) : 0;
  avatar.legs.forEach((leg, i) => { leg.rotation.x = gait * (i ? -0.52 : 0.52); });
  s.attack = Math.max(0, s.attack - delta);
  const strike = s.attack > 0 ? Math.sin((1 - s.attack / 0.52) * Math.PI) : 0;
  avatar.body.position.set(strike * 0.13, idle * 0.014 + (s.moving ? Math.abs(gait) * 0.025 : 0), 0);
  avatar.body.rotation.y = (s.state?.explorable ? s.facing : 0.24) + strike * 0.19;
  avatar.torso.scale.y = 1 + idle * 0.012;
  avatar.hem.rotation.z = idle * 0.012;
  avatar.head.rotation.y = idle * 0.025;
  avatar.arms.forEach(({ arm, rest }, i) => {
    arm.rotation.z = rest + idle * 0.012 + (i === 1 ? -strike * 0.64 : strike * 0.07);
    arm.rotation.x = (i === 1 ? -strike * 0.42 : 0) + gait * (i ? 0.36 : -0.36);
  });
  avatar.wings.forEach(({ wing, rest, side }) => { wing.rotation.y = rest + side * idle * 0.025; });
  s.enemies.forEach((enemy) => {
    enemy.hit = Math.max(0, enemy.hit - delta);
    const recoil = enemy.hit > 0 ? Math.sin(enemy.hit / 0.46 * Math.PI) : 0;
    enemy.model.rotation.z = enemy.dead ? -Math.PI / 2 : -recoil * 0.12;
    enemy.model.rotation.y = enemy.baseYaw;
    enemy.model.position.y = enemy.dead ? enemy.fallHeight : s.reducedMotion ? 0 : Math.sin(s.time * 1.2 + enemy.phase) * 0.018;
    enemy.model.position.x = enemy.dead ? 0 : recoil * 0.07;
    enemy.k.eachMaterial((m) => {
      m.emissive.copy(m.userData.baseEmission);
      m.emissiveIntensity = m.userData.baseIntensity;
      if (recoil > 0 && m !== enemy.selection.material && m !== enemy.shadow.material && m !== enemy.warning.material && m !== enemy.aggroRing?.material) {
        m.emissive.setHex(0xd7a07e);
        m.emissiveIntensity = recoil * 0.38;
      }
    });
  });
}

function canRender(s) {
  return live === s && !s.disposed && !s.lost && !document.hidden && s.host?.isConnected
    && s.canvas.isConnected && s.canvas.parentNode === s.host
    && s.inView && s.width > 0 && s.height > 0 && s.hostVisible;
}

function stop(s) {
  if (s.raf) cancelAnimationFrame(s.raf);
  s.raf = 0;
  s.lastFrame = 0;
}

function systemError(s, error) {
  return s.renderer.getContext().isContextLost()
    || ['SecurityError', 'NotSupportedError', 'InvalidStateError', 'OperationError'].includes(error?.name)
    || /WebGL|GL_OUT_OF_MEMORY|context lost|shader|framebuffer/i.test(error?.message ?? '');
}

function updateOcclusion(s) {
  if (!s.state?.explorable) return;
  const actors = [s.avatar, ...s.enemies.filter((enemy) => !enemy.dead && enemy.id === s.state.targetId)];
  for (const cover of s.environment.occluders) {
    const hidden = actors.some((actor) => {
      s.occlusionTarget.copy(actor.root.position); s.occlusionTarget.y += 1.2;
      s.occlusionProjected.copy(s.occlusionTarget).project(s.camera);
      if (Math.abs(s.occlusionProjected.x) > 1.1 || Math.abs(s.occlusionProjected.y) > 1.1 || Math.abs(s.occlusionProjected.z) > 1) return false;
      s.occlusionDirection.copy(s.occlusionTarget).sub(s.camera.position);
      const distance = s.occlusionDirection.length();
      s.occlusionRay.set(s.camera.position, s.occlusionDirection.normalize());
      return s.occlusionRay.intersectBox(cover.bounds, s.occlusionHit) != null && s.occlusionHit.distanceTo(s.camera.position) < distance;
    });
    cover.object.material = hidden ? cover.faded : cover.normal;
  }
}

function draw(s) {
  for (const f of s.floats) {
    const actor = f.target === 'player' || f.target === 'pet' ? s.avatar : s.enemies.find(e => e.id === f.target);
    if (!actor) continue;
    const point = actor.root.position.clone(); point.y += 2.2 + f.age * 0.55; point.project(s.camera);
    f.node.style.left = `${(point.x + 1) * s.width / 2}px`;
    f.node.style.top = `${(1 - point.y) * s.height / 2 - f.lane * 24}px`;
    f.node.style.opacity = String(Math.max(0, 1 - f.age / 1.1));
  }
  updateOcclusion(s);
  // Do not swallow application/model errors; only the actual GPU boundary fails
  // closed, once, leaving the static portrait to the owning UI.
  try {
    s.renderer.render(s.scene, s.camera);
  } catch (error) {
    if (!systemError(s, error)) throw error;
    s.boundaryFailed = true;
  }
  if (s.boundaryFailed) {
    systemFailed = true;
    disposeSession(s);
    document.dispatchEvent(new CustomEvent('scene-availability', { detail: { available: false } }));
    return false;
  }
  return !s.lost;
}

function schedule(s) {
  if (!canRender(s)) {
    stop(s);
    if (s.moving || s.path.length || s.approach || s.heldKeys.size || s.heldDirections.size) haltMovement(s);
    else emitMovement(s);
    return;
  }
  if (!s.raf && (s.dirty || s.moving || s.path.length || s.heldKeys.size || s.heldDirections.size || !s.reducedMotion || s.attack > 0 || s.enemies.some((e) => e.hit > 0))) {
    s.raf = requestAnimationFrame((now) => frame(s, now));
  }
}

function frame(s, now) {
  s.raf = 0;
  if (!canRender(s)) { schedule(s); return; }
  if (s.lastFrame && now - s.lastFrame < FRAME_MS - 1) { schedule(s); return; }
  const delta = s.lastFrame ? Math.min((now - s.lastFrame) / 1000, 0.06) : 0;
  s.lastFrame = now;
  s.time += delta;
  if (s.state.rt) {
    const factor = 1 - Math.exp(-delta * 18);
    const origin = rtOrigin(s.state);
    const move = (actor, local) => {
      const dx = origin.x + local.x - actor.root.position.x, dz = origin.z + local.z - actor.root.position.z;
      actor.root.position.x += dx * factor; actor.root.position.z += dz * factor;
      return { dx, dz, distance: Math.hypot(dx, dz) };
    };
    const travel = move(s.avatar, s.state.rt.player);
    s.moving = travel.distance > 0.04;
    if (s.moving) { s.facing = Math.atan2(travel.dx, travel.dz); s.walkPhase += travel.distance * factor * 3.2; }
    else {
      const target = s.enemies.find(e => e.id === s.state.targetId && !e.dead);
      if (target) s.facing = Math.atan2(target.root.position.x - s.avatar.root.position.x, target.root.position.z - s.avatar.root.position.z);
    }
    if (s.state.explorable && !s.overview && travel.distance > 0.002) positionCamera(s);
    s.enemies.forEach(enemy => {
      const data = s.state.rt.enemies[enemy.id]; if (!data) return;
      if (!enemy.dead) move(enemy, data);
      enemy.baseYaw = Math.atan2(s.avatar.root.position.x - enemy.root.position.x, s.avatar.root.position.z - enemy.root.position.z);
      if (enemy.warning.visible && data.aim) enemy.warning.position.set(origin.x + data.aim.x - enemy.root.position.x, 0.04, origin.z + data.aim.z - enemy.root.position.z);
      enemy.warning.material.opacity = 0.48 + Math.sin(s.time * 10) * 0.08;
    });
  } else tickMovement(s, delta);
  s.floats = s.floats.filter(f => { f.age += delta; if (f.age <= 1.1) return true; f.node.remove(); return false; });
  pose(s, delta);
  s.dirty = false;
  if (draw(s)) schedule(s);
}

function resize(s) {
  if (s.disposed || !s.host) return;
  const rect = s.host.getBoundingClientRect();
  const width = Math.max(0, Math.round(rect.width));
  const height = Math.max(0, Math.round(rect.height));
  s.hostVisible = getComputedStyle(s.host).visibility !== 'hidden';
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  if (width !== s.width || height !== s.height || pixelRatio !== s.pixelRatio) {
    s.width = width;
    s.height = height;
    s.pixelRatio = pixelRatio;
    if (width > 0 && height > 0 && !s.lost) {
      try {
        s.renderer.setPixelRatio(pixelRatio);
        s.renderer.setSize(width, height, false);
      } catch (error) {
        if (!systemError(s, error)) throw error;
        systemFailed = true;
        disposeSession(s);
        return;
      }
      positionCamera(s);
    }
    s.dirty = true;
  }
  schedule(s);
}

function emitTarget(id) {
  if (id != null) document.dispatchEvent(new CustomEvent('scene-target', { detail: { id } }));
}

function pick(s, event) {
  if (!canRender(s)) return;
  const rect = s.canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  s.pointerNdc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  s.scene.updateMatrixWorld(true);
  s.raycaster.setFromCamera(s.pointerNdc, s.camera);
  const hits = s.raycaster.intersectObjects([s.avatar.body, ...s.enemies.filter((e) => !e.dead && !(e.ambient && s.state.active)).map((e) => e.model)], true);
  if (hits.length) {
    let object = hits[0].object;
    while (object) {
      if (Object.hasOwn(object.userData, 'sceneTarget')) {
        const id = object.userData.sceneTarget;
        haltMovement(s);
        emitTarget(id);
        if (live === s && movementAllowed(s)) {
          const enemy = s.enemies.find((e) => e.id === id && !e.dead);
          if (enemy && Math.hypot(s.avatar.root.position.x - enemy.root.position.x, s.avatar.root.position.z - enemy.root.position.z) > REACH) startWalk(s, enemy.root.position, id);
        }
        return;
      }
      object = object.parent;
    }
    return;
  }
  if (s.state.rt && s.state.active) {
    const goal = s.raycaster.ray.intersectPlane(s.groundPlane, s.groundPoint);
    const origin = rtOrigin(s.state);
    if (goal) document.dispatchEvent(new CustomEvent('scene-combat-goal', { detail: { x: goal.x - origin.x, z: goal.z - origin.z } }));
    return;
  }
  if (!movementAllowed(s)) return;
  const point = s.raycaster.ray.intersectPlane(s.groundPlane, s.groundPoint);
  if (point && s.environment.navigation.inside(point.x, point.z)) startWalk(s, point);
}

function listen(s, target, type, callback, options) {
  target.addEventListener(type, callback, options);
  s.cleanups.push(() => target.removeEventListener(type, callback, options));
}

function releasePointer(s) {
  const pointer = s.pointer;
  s.pointer = null;
  if (pointer && s.canvas.hasPointerCapture?.(pointer.id)) s.canvas.releasePointerCapture(pointer.id);
  if (s.canvas.style.cursor !== 'grab') s.canvas.style.cursor = 'grab';
}

function wire(s) {
  listen(s, s.canvas, 'pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0 || !canRender(s)) return;
    s.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: s.yaw, drag: false, scroll: false, moved: 0 };
  });
  listen(s, s.canvas, 'pointermove', (event) => {
    const p = s.pointer;
    if (!p || p.id !== event.pointerId) return;
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    p.moved = Math.max(p.moved, Math.hypot(dx, dy));
    if (!p.drag && event.pointerType === 'touch' && Math.abs(dy) > 7 && Math.abs(dy) >= Math.abs(dx)) p.scroll = true;
    if (p.scroll) return;
    if (!p.drag && Math.abs(dx) > 7 && (event.pointerType !== 'touch' || Math.abs(dx) > Math.abs(dy) * 1.2)) {
      p.drag = true;
      s.canvas.setPointerCapture(event.pointerId);
      s.canvas.style.cursor = 'grabbing';
    }
    if (!p.drag) return;
    s.yaw = s.state.explorable ? p.yaw - dx / Math.max(1, s.width) * 2.6 : THREE.MathUtils.clamp(p.yaw - dx / Math.max(1, s.width) * 1.8, -0.45, 0.45);
    positionCamera(s);
    s.dirty = true;
    schedule(s);
  });
  listen(s, s.canvas, 'pointerup', (event) => {
    const p = s.pointer;
    if (!p || p.id !== event.pointerId) return;
    const click = !p.drag && !p.scroll && Math.max(p.moved, Math.hypot(event.clientX - p.x, event.clientY - p.y)) <= 6;
    releasePointer(s);
    if (click) { s.canvas.focus({ preventScroll: true }); pick(s, event); }
  });
  listen(s, s.canvas, 'pointercancel', () => releasePointer(s));
  listen(s, s.canvas, 'lostpointercapture', () => releasePointer(s));
  listen(s, s.canvas, 'keydown', (event) => {
    if (!canRender(s) || document.activeElement !== s.canvas || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (s.state.rt) return;
    const key = event.key.toLowerCase();
    if (key === 'escape') { event.preventDefault(); stopWorldMovement(); return; }
    if (movementAllowed(s) && KEY_DIRECTIONS[key]) {
      event.preventDefault();
      if (!s.heldKeys.has(key)) {
        const retained = [...s.heldKeys];
        haltMovement(s);
        retained.forEach((k) => s.heldKeys.add(k));
        s.heldKeys.add(key);
      }
      schedule(s);
      return;
    }
    if (key === 'e' && movementAllowed(s)) {
      event.preventDefault();
      const enemy = s.enemies.find((e) => e.id === s.state.targetId && !e.dead);
      if (!event.repeat && enemy && Math.hypot(s.avatar.root.position.x - enemy.root.position.x, s.avatar.root.position.z - enemy.root.position.z) <= REACH) {
        document.dispatchEvent(new CustomEvent('scene-engage', { detail: { id: enemy.id } }));
      }
      return;
    }
    if (!['arrowleft', 'arrowright', 'enter', ' '].includes(key)) return;
    if (s.state.explorable && !s.state.active && ['arrowleft', 'arrowright'].includes(key)) return;
    event.preventDefault();
    const alive = s.enemies.filter((e) => !e.dead && e.id != null && !(e.ambient && s.state.active));
    if (!alive.length) return;
    const current = alive.findIndex((e) => e.id === s.state.targetId);
    if (movementAllowed(s) && (key === 'enter' || key === ' ')) {
      if (current >= 0) emitTarget(alive[current].id);
      return;
    }
    const step = !movementAllowed(s) && key === 'arrowleft' ? -1 : !movementAllowed(s) && key === 'arrowright' ? 1 : 0;
    const index = current < 0 ? 0 : (current + step + alive.length) % alive.length;
    emitTarget(alive[index].id);
  });
  listen(s, window, 'keyup', (event) => {
    if (!s.heldKeys.delete(event.key.toLowerCase())) return;
    if (!s.heldKeys.size && !s.heldDirections.size) { s.moving = false; pose(s, 0); emitMovement(s, true); }
    s.dirty = true;
    schedule(s);
  });
  listen(s, s.canvas, 'blur', () => {
    s.heldKeys.clear();
    s.heldDirections.clear();
    if (!s.path.length) { s.moving = false; pose(s, 0); }
    s.dirty = true;
    emitMovement(s, true);
    if (!s.reparenting) schedule(s);
  });
  listen(s, window, 'blur', () => { haltMovement(s); releasePointer(s); schedule(s); });
  listen(s, window, 'scroll', () => { if (s.pointer) s.pointer.scroll = true; }, { passive: true, capture: true });
  listen(s, document, 'visibilitychange', () => {
    haltMovement(s);
    releasePointer(s);
    stop(s);
    if (!document.hidden) { s.dirty = true; resize(s); }
  });
  listen(s, window, 'resize', () => resize(s), { passive: true });
  listen(s, window, 'pagehide', () => unmountWorldScene());
  listen(s, s.canvas, 'webglcontextlost', (event) => {
    event.preventDefault();
    s.lost = true;
    s.canvas.hidden = true;
    s.canvas.style.display = 'none';
    document.dispatchEvent(new CustomEvent('scene-availability', { detail: { available: false } }));
    haltMovement(s);
    stop(s);
    releasePointer(s);
  });
  listen(s, s.canvas, 'webglcontextrestored', () => {
    if (live !== s || s.disposed) return;
    s.lost = false;
    s.canvas.hidden = false;
    s.canvas.style.display = 'block';
    s.pixelRatio = 0;
    s.dirty = true;
    resize(s);
    if (!s.disposed && draw(s)) {
      document.dispatchEvent(new CustomEvent('scene-availability', { detail: { available: true } }));
      emitMovement(s, true);
    }
  });
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  s.reducedMotion = media.matches;
  const motionChanged = () => {
    s.reducedMotion = media.matches;
    s.attack = 0;
    s.enemies.forEach((e) => { e.hit = 0; });
    s.dirty = true;
    stop(s);
    schedule(s);
  };
  if (media.addEventListener) listen(s, media, 'change', motionChanged);
  else {
    media.addListener(motionChanged);
    s.cleanups.push(() => media.removeListener(motionChanged));
  }
  if (typeof ResizeObserver !== 'undefined') s.resizeObserver = new ResizeObserver(() => resize(s));
  if (typeof IntersectionObserver !== 'undefined') {
    s.intersectionObserver = new IntersectionObserver((entries) => {
      // An old host's queued notification must not hide the recycled canvas.
      const entry = entries.find((e) => e.target === s.host);
      if (!entry || s.disposed) return;
      s.inView = entry.isIntersecting;
      s.dirty = true;
      schedule(s);
    });
  }
  s.mutationObserver = new MutationObserver((records) => {
    if (s.disposed) return;
    const attached = s.host?.isConnected && s.canvas.isConnected && s.canvas.parentNode === s.host;
    if (!attached) { haltMovement(s); stop(s); releasePointer(s); s.wasConnected = false; }
    else if (!s.wasConnected || records.some((record) => record.type === 'attributes' && record.target.contains(s.host))) {
      s.wasConnected = true;
      s.dirty = true;
      resize(s);
    }
  });
  s.mutationObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
}

function createSession() {
  const canvas = document.createElement('canvas');
  canvas.title = '修真场景：横拖转视角，点击地面行走，点击怪物靠近；聚焦后 WASD / 方向键移动，E 近身交战，Esc 停止';
  canvas.setAttribute('aria-label', '修真角色与地图。横向拖动旋转视角；探索时点击地面寻路、点击怪物靠近，WASD 或方向键移动，E 近身交战，Escape 停止。实时交战时点击怪物选择目标，点击地面或方向键走位，空格守御；普攻与已学四格技能自动施放。');
  canvas.setAttribute('role', 'img');
  canvas.tabIndex = 0;
  Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block', touchAction: 'pan-y', cursor: 'grab' });
  const overlay = document.createElement('div'); overlay.className = 'scene-effects'; overlay.setAttribute('aria-hidden', 'true');
  const options = { alpha: false, antialias: true, depth: true, stencil: false, powerPreference: 'low-power' };
  let context;
  let renderer;
  // Preflight WebGL2 explicitly: unsupported browsers keep the portrait without
  // Three's repeated context-creation console errors or network fallback loads.
  try {
    context = canvas.getContext('webgl2', options);
    if (!context) { systemFailed = true; return null; }
    renderer = new THREE.WebGLRenderer({ canvas, context, ...options });
  } catch {
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    systemFailed = true;
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0xcbdde2, 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcbdde2);
  scene.fog = new THREE.Fog(0xcbdde2, 30, 55);
  scene.add(new THREE.HemisphereLight(0xfff2d8, 0x8c9a87, 0.95));
  const key = new THREE.DirectionalLight(0xffe5bf, 2);
  key.position.set(-3, 7, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb6dce4, 0.7);
  rim.position.set(4, 4, -5);
  scene.add(rim);
  const s = {
    renderer, canvas, overlay, floats: [], eventSequence: 0, scene, camera: new THREE.PerspectiveCamera(36, 1, 0.1, 65),
    host: null, state: null, environment: null, avatar: null, enemies: [],
    width: 0, height: 0, pixelRatio: 0, yaw: 0.27, time: 0, attack: 0,
    raf: 0, lastFrame: 0, dirty: true, inView: true, hostVisible: true,
    lost: false, disposed: false, boundaryFailed: false, wasConnected: false,
    pointer: null, raycaster: new THREE.Raycaster(), pointerNdc: new THREE.Vector2(), cleanups: [],
    groundPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02), groundPoint: new THREE.Vector3(),
    occlusionRay: new THREE.Ray(), occlusionTarget: new THREE.Vector3(), occlusionProjected: new THREE.Vector3(), occlusionDirection: new THREE.Vector3(), occlusionHit: new THREE.Vector3(),
    path: [], heldKeys: new Set(), heldDirections: new Set(), approach: null, walkTarget: null,
    moving: false, facing: 0.24, walkPhase: 0, overview: false,
    fieldPositions: new Map(), battlePositions: new Map(), fieldSelected: null,
    movementSignature: '', movementEmitted: 0,
  };
  renderer.debug.onShaderError = () => { s.boundaryFailed = true; };
  wire(s);
  return s;
}

function disposeSession(s) {
  if (!s || s.disposed) return;
  s.disposed = true;
  haltMovement(s);
  stop(s);
  releasePointer(s);
  s.resizeObserver?.disconnect();
  s.intersectionObserver?.disconnect();
  s.mutationObserver?.disconnect();
  s.cleanups.forEach((cleanup) => cleanup());
  s.cleanups.length = 0;
  removeLayer(s.scene, s.environment);
  removeLayer(s.scene, s.avatar);
  s.enemies.forEach((enemy) => removeLayer(s.scene, enemy));
  s.enemies.length = 0;
  s.scene.clear();
  s.renderer.renderLists.dispose();
  s.renderer.dispose();
  s.renderer.forceContextLoss();
  s.canvas.remove();
  s.overlay.remove();
  s.floats = [];
  s.host = null;
  if (live === s) live = null;
}

export function mountWorldScene(container, state = {}) {
  if (typeof document === 'undefined' || typeof window === 'undefined' || !container?.appendChild
      || !container.getBoundingClientRect || systemFailed) return false;
  const next = snapshot(state ?? {});
  const s = live ?? createSession();
  if (!s) return false;
  live = s;
  s.reparenting = true;
  if (s.host !== container) {
    stop(s);
    releasePointer(s);
    if (s.host) {
      s.resizeObserver?.unobserve(s.host);
      s.intersectionObserver?.unobserve(s.host);
    }
    s.host = container;
    s.inView = true;
    s.wasConnected = container.isConnected;
    s.resizeObserver?.observe(container);
    s.intersectionObserver?.observe(container);
  }
  try {
    if (s.canvas.parentNode !== container) container.appendChild(s.canvas);
    if (s.overlay.parentNode !== container) container.appendChild(s.overlay);
  } finally {
    s.reparenting = false;
  }
  updateWorld(s, next);
  resize(s);
  if (s.disposed || s.lost) return false;
  // Validate the first live frame synchronously, so the caller only suppresses
  // its portrait after the canvas really renders, not just after construction.
  if (canRender(s)) {
    s.dirty = false;
    if (!draw(s)) return false;
  }
  schedule(s);
  return true;
}

export function unmountWorldScene() {
  disposeSession(live);
  systemFailed = false;
}

if (import.meta.hot) import.meta.hot.dispose(unmountWorldScene);
