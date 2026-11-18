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
    targetId: input.targetId ?? null,
    monsters: roster.map((m) => ({
      id: m.id, name: String(m.name ?? ''), rank: m.rank ?? '',
      hp: Number.isFinite(m.hp) ? m.hp : 1,
      maxHp: Number.isFinite(m.maxHp) ? m.maxHp : 1,
      lv: Number.isFinite(m.lv) ? m.lv : 1,
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
  sphere(lamp, k, 0xffdda2, [0, 0, 0], [0.14, 0.18, 0.14], { emissive: 0xffbc65, emissiveIntensity: 0.3 });
  for (const y of [-0.17, 0.17]) cylinder(lamp, k, palette.trim, [0, y, 0], 0.11, 0.11, 0.04);
}

function layeredRoof(parent, k, position, size, palette) {
  for (let tier = 0; tier < 2; tier++) {
    mesh(parent, k, k.geometry('roof', roofGeometry), tier ? palette.roof : palette.trim,
      [position[0], position[1] + tier * 0.09, position[2]],
      [size[0] * (tier ? 0.94 : 1), size[1], size[2] * (tier ? 0.94 : 1)], { side: THREE.DoubleSide });
  }
  sphere(parent, k, palette.trim, [position[0], position[1] + size[1] * 0.85 + 0.15, position[2]], [0.12, 0.14, 0.12]);
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
  const p = landmark.palette;
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
      sphere(t, k, color, [0, 2.15, -0.08], [0.97, 0.83, 0.83]);
      for (const side of [-1, 1]) {
        sphere(t, k, color, [side * 0.72, 1.95, 0.12], [0.65, 0.58, 0.66]);
        sphere(t, k, color, [side * 0.38, 2.65, -0.05], [0.57, 0.48, 0.55]);
      }
      sphere(t, k, new THREE.Color(color).lerp(new THREE.Color(0xffe8bc), 0.15).getHex(), [-0.32, 2.53, 0.5], [0.48, 0.35, 0.33]);
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
    const axeGeo = k.geometry('axe', () => shapeGeometry([
      [-0.42, 0.23], [-0.13, 0.12], [0.12, 0.12], [0.47, 0.28],
      [0.45, -0.2], [0.16, -0.1], [-0.13, -0.1], [-0.39, -0.2],
    ]));
    mesh(grip, k, axeGeo, steel, [0, 0.92, 0], [1, 1, 1], { side: THREE.DoubleSide });
    box(grip, k, gold, [0, 0.92, 0], [0.11, 0.32, 0.12]);
  } else {
    const dagger = type === 'dagger';
    const length = dagger ? 0.52 : 1.14;
    cylinder(grip, k, dark, [0, 0, 0], 0.045, 0.045, 0.24);
    box(grip, k, gold, [0, 0.15, 0], [dagger ? 0.21 : 0.32, 0.055, 0.07]);
    const swordGeo = k.geometry(`blade:${type}`, () => shapeGeometry(type === 'blade'
      ? [[-0.04, 0], [0.1, 0], [0.14, length * 0.72], [0.045, length], [-0.055, length * 0.8]]
      : [[-0.065, 0], [0.065, 0], [0.065, length * 0.82], [0, length], [-0.065, length * 0.82]]));
    mesh(grip, k, swordGeo, steel, [0, 0.18, 0], [1, 1, 1], { side: THREE.DoubleSide, metalness: 0.35 });
    rod(grip, k, 0xf1ece2, [0, 0.2, 0.005], [0, length * 0.83, 0.005], 0.01);
    stone(grip, k, gold, [0, -0.16, 0], [0.055, 0.055, 0.055]);
  }
  grip.rotation.z = -0.12;
  return grip;
}

// Deliberately authored profession costumes, independent of equipment statistics.
const CLASS_LOOKS = {
  blademaster: { coat: 0xb75449, trim: 0xffd48e, hair: 0x3e353b, accent: 0xe88369, style: 'topknot' },
  wizard: { coat: 0x6279be, trim: 0xf8d99c, hair: 0x454161, accent: 0x9aabe2, style: 'crown' },
  archer: { coat: 0x588d78, trim: 0xead298, hair: 0x705747, accent: 0x9bd5b1, style: 'ponytail' },
  cleric: { coat: 0xe5dcca, trim: 0xd8b776, hair: 0xabb7ce, accent: 0x85bed1, style: 'twintail' },
  barbarian: { coat: 0xa57a53, trim: 0xf4cf88, hair: 0xe5dfcc, accent: 0xc86647, style: 'tiger' },
  venomancer: { coat: 0xa775ad, trim: 0xf6d49b, hair: 0x744855, accent: 0xb4cc89, style: 'fox' },
  assassin: { coat: 0x4a7389, trim: 0xbee0df, hair: 0x3f5369, accent: 0x85c9c5, style: 'swept' },
  psychic: { coat: 0x8274b5, trim: 0xf5d1a2, hair: 0x7085ab, accent: 0xa4d4e5, style: 'wave' },
  seeker: { coat: 0x65969c, trim: 0xf0d19a, hair: 0x475b62, accent: 0xa8d4c3, style: 'crest' },
  mystic: { coat: 0x91ae75, trim: 0xffe2ac, hair: 0x6d667e, accent: 0xe4a5c2, style: 'flower' },
};

function buildAvatar(state) {
  const k = kit();
  const root = new THREE.Group();
  root.position.set(-1.65, 0, 0.55);
  const shadow = contact(root, k, 0.6, 0.23);
  const body = group(root);
  body.rotation.y = 0.24;
  const look = CLASS_LOOKS[state.cls];
  const heavy = state.armor === 'heavy';
  const robe = state.armor === 'robe';
  const tiger = state.cls === 'barbarian';
  const broad = tiger ? 1.15 : 1;
  const skin = tiger ? 0xf2e7cf : state.race === 'tideborn' ? 0xd4e6e3 : 0xf5d5bd;
  const dark = 0x455064;
  // ~2.3 units, with a 0.88-unit face: a little 2.6-head-tall adventurer.
  const torso = group(body, [0, 1.06, 0]);
  sphere(torso, k, look.coat, [0, 0.02, 0], [0.33 * broad, 0.36, 0.25]);
  for (const side of [-1, 1]) {
    const collar = box(torso, k, 0xffecd2, [side * 0.1, 0.19, 0.225], [0.085, 0.31, 0.04]);
    collar.rotation.z = side * 0.48;
  }
  if (heavy) {
    sphere(torso, k, look.accent, [0, 0.01, 0.22], [0.26 * broad, 0.25, 0.09]);
    box(torso, k, look.trim, [0, 0.04, 0.31], [0.06, 0.3, 0.04]);
  } else sphere(torso, k, look.accent, [0, 0.08, 0.25], [0.08, 0.09, 0.035]);
  cylinder(body, k, look.trim, [0, 0.85, 0], 0.3 * broad, 0.3 * broad, 0.1, 20).scale.z = 0.82;
  sphere(body, k, look.accent, [0, 0.85, 0.265], [0.1, 0.085, 0.04]);
  const sash = box(body, k, look.accent, [-0.2, 0.64, 0.265], [0.12, 0.4, 0.035]);
  sash.rotation.z = -0.16;
  const hem = group(body, [0, 0.79, 0]);
  const hemGeo = k.geometry('hem', () => new THREE.CylinderGeometry(0.28, robe ? 0.44 : 0.36, robe ? 0.55 : 0.3, 24, 1, true, 0.25, TAU - 0.5));
  mesh(hem, k, hemGeo, look.coat, [0, robe ? -0.22 : -0.12, 0], [broad, 1, 0.84], { side: THREE.DoubleSide });
  cylinder(hem, k, look.trim, [0, robe ? -0.48 : -0.26, 0], robe ? 0.43 : 0.35, robe ? 0.43 : 0.35, 0.045, 24).scale.z = 0.84;
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = group(body, [side * 0.17, 0.73, 0]);
    legs.push(leg);
    sphere(leg, k, look.coat, [0, -0.15, 0], [0.12, 0.22, 0.13]);
    const knee = group(leg, [0, -0.32, 0]);
    cylinder(knee, k, dark, [0, -0.1, 0.02], 0.12, 0.13, 0.3, 16);
    sphere(knee, k, dark, [0, -0.27, 0.11], [0.15, 0.14, 0.23]);
    cylinder(knee, k, look.trim, [0, 0.01, 0.02], 0.135, 0.135, 0.05, 16);
    if (heavy) sphere(leg, k, look.accent, [0, -0.25, 0.12], [0.14, 0.14, 0.08]);
  }
  cylinder(body, k, skin, [0, 1.43, 0], 0.1, 0.1, 0.14);
  const head = group(body, [0, 1.81, 0]);
  sphere(head, k, skin, [0, 0, 0], [0.4 * broad, 0.44, 0.35]);
  sphere(head, k, look.hair, [0, 0.19, -0.07], [0.42 * broad, 0.3, 0.35]);
  for (const side of [-1, 1]) {
    sphere(head, k, skin, [side * 0.39 * broad, -0.02, 0], [0.075, 0.11, 0.065]);
    sphere(head, k, dark, [side * 0.145, 0.015, 0.328], [0.069, 0.098, 0.04]);
    sphere(head, k, 0xfff9eb, [side * 0.145 - 0.02, 0.052, 0.365], [0.021, 0.027, 0.012]);
    sphere(head, k, 0xefb5a7, [side * 0.24, -0.12, 0.287], [0.071, 0.036, 0.021]);
    const fringe = sphere(head, k, look.hair, [side * 0.19, 0.25, 0.23], [0.18, 0.17, 0.14]);
    fringe.rotation.z = side * 0.32;
    sphere(head, k, look.hair, [side * 0.37 * broad, 0.03, -0.04], [0.085, 0.23, 0.18]);
  }
  sphere(head, k, skin, [0, -0.1, 0.348], [0.038, 0.045, 0.037]);
  sphere(head, k, 0xb77d76, [0, -0.22, 0.297], [0.047, 0.019, 0.015]);
  if (['topknot', 'crest', 'crown'].includes(look.style)) {
    sphere(head, k, look.hair, [0, 0.49, -0.06], [0.16, 0.15, 0.15]);
    cylinder(head, k, look.accent, [0, 0.43, -0.06], 0.16, 0.16, 0.065);
    rod(head, k, look.trim, [-0.23, 0.5, -0.04], [0.23, 0.5, -0.04], 0.025);
    if (look.style === 'crown') for (const side of [-1, 1]) crystalCrest(head, k, [side * 0.17, 0.32, 0.16], look.trim);
  }
  if (['ponytail', 'twintail', 'fox', 'flower', 'wave'].includes(look.style)) {
    const sides = ['twintail', 'flower'].includes(look.style) ? [-1, 1] : [1];
    for (const side of sides) {
      const tail = sphere(head, k, look.hair, [side * 0.3, -0.16, -0.29], [0.16, 0.37, 0.19]);
      tail.rotation.z = side * 0.25;
      sphere(head, k, look.accent, [side * 0.32, 0.1, -0.2], [0.1, 0.08, 0.08]);
    }
  }
  if (look.style === 'swept') {
    const lock = sphere(head, k, look.hair, [-0.1, 0.36, 0.22], [0.3, 0.14, 0.16]);
    lock.rotation.z = -0.25;
    rod(head, k, look.accent, [-0.37, 0.21, 0.12], [0.3, 0.25, 0.24], 0.022);
  }
  if (state.race === 'untamed') {
    for (const side of [-1, 1]) {
      const ear = sphere(head, k, tiger ? skin : look.hair, [side * 0.3, 0.37, -0.01], [0.135, tiger ? 0.17 : 0.24, 0.1]);
      ear.rotation.z = -side * 0.26;
      sphere(head, k, 0xe8aca1, [side * 0.3, 0.39, 0.075], [0.065, 0.1, 0.025]);
    }
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.7, -0.2), new THREE.Vector3(-0.5, 0.5, -0.5), new THREE.Vector3(-0.6, 0.75, -0.6),
    ]);
    mesh(body, k, k.geometry('tail', () => new THREE.TubeGeometry(tailCurve, 14, tiger ? 0.075 : 0.12, 10, false)),
      tiger ? skin : look.hair, [0, 0, 0]);
    if (tiger) {
      for (const side of [-1, 1]) {
        sphere(head, k, 0xfff0d9, [side * 0.09, -0.16, 0.32], [0.12, 0.08, 0.06]);
        for (let i = 0; i < 2; i++) {
          const stripe = sphere(head, k, 0x776654, [side * 0.3, -0.03 - i * 0.12, 0.265], [0.075, 0.023, 0.025]);
          stripe.rotation.z = side * 0.22;
        }
      }
      sphere(head, k, 0x8d6b66, [0, -0.13, 0.39], [0.046, 0.03, 0.025]);
      for (const x of [-0.08, 0, 0.08]) sphere(head, k, 0x776654, [x, 0.3, 0.33], [0.025, 0.08, 0.025]);
    }
  }
  if (state.race === 'earthguard') sphere(head, k, look.accent, [0, 0.2, 0.343], [0.045, 0.067, 0.025], { emissive: look.accent, emissiveIntensity: 0.22 });
  if (look.style === 'flower') for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU;
    sphere(head, k, look.accent, [-0.33 + Math.cos(a) * 0.075, 0.33 + Math.sin(a) * 0.075, 0.2], [0.06, 0.06, 0.035]);
  }

  const arms = [-1, 1].map((side) => {
    const arm = group(body, [side * 0.36 * broad, 1.31, 0]);
    arm.rotation.z = side * 0.2;
    sphere(arm, k, look.coat, [0, -0.14, 0], [robe ? 0.15 : 0.12, 0.21, 0.14]);
    if (heavy) sphere(arm, k, look.accent, [side * 0.03, 0, 0], [0.2, 0.12, 0.18]);
    const forearm = group(arm, [0, -0.3, 0]);
    forearm.rotation.x = -0.28;
    sphere(forearm, k, look.coat, [0, -0.1, 0], [0.11, 0.16, 0.12]);
    cylinder(forearm, k, look.trim, [0, -0.21, 0], 0.115, 0.12, 0.055);
    sphere(forearm, k, skin, [0, -0.28, 0.02], [0.095, 0.1, 0.085]);
    const hand = group(forearm, [0, -0.28, 0.06]);
    return { arm, forearm, hand, rest: arm.rotation.z };
  });
  buildWeapon(arms[1].hand, k, state.weapon).scale.setScalar(0.72);
  if (state.weapon === 'dagger') buildWeapon(arms[0].hand, k, 'dagger').scale.setScalar(0.72);
  if (state.weapon === 'bow') {
    const quiver = cylinder(body, k, dark, [-0.22, 1.12, -0.27], 0.1, 0.09, 0.46);
    quiver.rotation.z = -0.2;
    for (let i = 0; i < 3; i++) rod(body, k, look.trim, [-0.25 + i * 0.055, 1.2, -0.29], [-0.32 + i * 0.055, 1.6, -0.29], 0.015);
  }
  const wings = [];
  if (state.race === 'elf') for (const side of [-1, 1]) {
    const wing = group(body, [side * 0.26, 1.22, -0.22]);
    wing.rotation.y = -side * 0.15;
    sphere(wing, k, 0xffefda, [side * 0.23, 0.12, 0], [0.32, 0.21, 0.07]);
    for (let i = 0; i < 5; i++) {
      const feather = sphere(wing, k, i % 2 ? 0xe1e9e4 : 0xfff4df,
        [side * (0.16 + i * 0.09), -0.03 + i * 0.035, -0.02], [0.07, 0.32 - i * 0.02, 0.045]);
      feather.rotation.z = -side * (0.55 + i * 0.17);
    }
    wings.push({ wing, rest: wing.rotation.y, side });
  }
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
  if (/狼|猪|熊|狮|虎|狐|兔|犀|蜥|鳄|兽|麒麟/.test(name)) return 'beast';
  if (/石|傀|巨人|魔像|树|木桩/.test(name)) return 'golem';
  if (/魂|灵|雾|风|冰晶|元素/.test(name)) return 'spirit';
  if (/兵|贼|寇|匪|将|守卫|巫|信徒|祭司|骷髅|人|鬼|女|卒|官/.test(name)) return 'humanoid';
  return ['beast', 'golem', 'humanoid'][hash(id ?? name) % 3];
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
  const tint = { humanoid: 0xa892bd, golem: 0x92afa1, beast: 0xc6a380, crawler: 0xd99788, bird: 0x8eb6c5, serpent: 0x96b881, spirit: 0xaaa7d8 }[kind];
  const pale = 0xf3dfbd;
  const dark = 0x435165;
  const amber = 0xf3ca83;
  const size = boss ? 1.15 : elite ? 1.04 : 0.92;
  model.scale.setScalar(size);
  const eyes = (position, spread = 0.13, radius = 0.065) => {
    for (const side of [-1, 1]) {
      sphere(model, k, dark, [position[0] + side * spread, position[1], position[2]], [radius, radius * 1.25, radius * 0.55]);
      sphere(model, k, 0xfff9ea, [position[0] + side * spread - radius * 0.25, position[1] + radius * 0.4, position[2] + radius * 0.48], [radius * 0.29, radius * 0.32, radius * 0.16]);
    }
  };
  if (kind === 'humanoid') {
    sphere(model, k, tint, [0, 0.87, 0], [0.31, 0.39, 0.24]);
    cylinder(model, k, tint, [0, 0.6, 0], 0.26, 0.38, 0.42, 20);
    cylinder(model, k, amber, [0, 0.74, 0], 0.31, 0.31, 0.075);
    sphere(model, k, pale, [0, 1.43, 0.02], [0.35, 0.39, 0.3]);
    sphere(model, k, dark, [0, 1.65, -0.04], [0.36, 0.2, 0.29]);
    eyes([0, 1.43, 0.297]);
    sphere(model, k, 0xcc9a8b, [0, 1.25, 0.284], [0.04, 0.017, 0.016]);
    for (const side of [-1, 1]) {
      sphere(model, k, dark, [side * 0.16, 0.19, 0.07], [0.13, 0.21, 0.19]);
      rod(model, k, tint, [side * 0.3, 1.05, 0], [side * 0.43, 0.7, 0.06], 0.105);
      sphere(model, k, pale, [side * 0.43, 0.65, 0.08], [0.1, 0.11, 0.09]);
    }
    cylinder(model, k, amber, [0, 1.8, 0], 0.21, 0.37, 0.15, 20);
    rod(model, k, dark, [0.47, 0.36, 0.1], [0.47, 1.38, 0.1], 0.035);
    cylinder(model, k, pale, [0.47, 1.48, 0.1], 0, 0.085, 0.23, 8);
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
    const boar = /猪|熊|犀/.test(monster.name);
    sphere(model, k, tint, [0, 0.65, 0], [0.46, 0.43, 0.61]);
    sphere(model, k, tint, [0, 1.03, 0.43], [0.37, 0.37, 0.34]);
    sphere(model, k, pale, [0, 0.9, 0.72], [0.23, 0.16, 0.2]);
    sphere(model, k, dark, [0, 0.94, 0.89], [0.1, 0.065, 0.04]);
    eyes([0, 1.12, 0.728], 0.16, 0.062);
    for (const side of [-1, 1]) {
      for (const z of [-0.34, 0.32]) {
        sphere(model, k, tint, [side * 0.29, 0.3, z], [0.13, 0.26, 0.13]);
        sphere(model, k, dark, [side * 0.29, 0.12, z + 0.08], [0.14, 0.12, 0.18]);
      }
      const ear = sphere(model, k, tint, [side * 0.26, 1.36, 0.38], [0.12, boar ? 0.13 : 0.23, 0.085]);
      ear.rotation.z = -side * 0.3;
      sphere(model, k, 0xe5b4a6, [side * 0.26, 1.38, 0.45], [0.055, 0.09, 0.02]);
      if (boar) cylinder(model, k, pale, [side * 0.21, 0.89, 0.79], 0, 0.05, 0.21, 10).rotation.x = 0.35;
    }
    rod(model, k, tint, [0, 0.6, -0.52], [0.13, 0.91, -0.81], 0.065);
    sphere(model, k, pale, [0.13, 0.92, -0.82], [0.1, 0.12, 0.1]);
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
  if (elite) {
    const top = { humanoid: 1.91, golem: 1.85, beast: 1.62, crawler: 0.84, bird: 1.85, serpent: 1.6, spirit: 2.01 }[kind];
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
  const shadow = contact(root, k, kind === 'crawler' || kind === 'beast' ? 0.72 : 0.46);
  const selection = ring(root, k, kind === 'crawler' || kind === 'beast' ? 0.82 : 0.61);
  selection.visible = false;
  return { root, model, k, shadow, selection, fallHeight, id: monster.id, hp: monster.hp, dead: null, hit: 0, phase: index * 1.7, baseYaw: -0.48 };
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

function findPath(nav, from, goal, radius = 0) {
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
      const g = scores[index] + Math.hypot(other.x - node.x, other.z - node.z);
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
  let best = null;
  let bestScore = Infinity;
  for (const node of nav.reachable) {
    if (Math.hypot(node.x - nav.spawn.x, node.z - nav.spawn.z) < 3.7) continue;
    if ([...s.fieldPositions.values()].some((p) => Math.hypot(node.x - p.x, node.z - p.z) < 2.6)) continue;
    const score = Math.hypot(node.x - desired.x, node.z - desired.z);
    if (score < bestScore) { best = node; bestScore = score; }
  }
  best ??= nearestNode(nav, desired);
  const position = { x: best.x, z: best.z, name: monster.name };
  s.fieldPositions.set(monster.id, position);
  return position;
}

function movementAllowed(s) {
  return Boolean(s?.state?.explorable && s.state.movementEnabled && !s.state.active && canRender(s));
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
  const path = findPath(nav, s.avatar.root.position, goal, id == null ? 0 : REACH - 0.15);
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
    haltMovement(s, true); return;
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
  if (enemy && Math.hypot(position.x - enemy.root.position.x, position.z - enemy.root.position.z) <= REACH) haltMovement(s, true);
  else if (!s.path.length && s.walkTarget != null) haltMovement(s);
  emitMovement(s);
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
  const mapKey = JSON.stringify([next.location, next.explorable, next.explorable ? next.city : next.city && !next.active]);
  const avatarKey = JSON.stringify([next.cls, next.race, next.weapon]);
  const roster = !next.explorable && next.city && !next.active ? [] : next.monsters;
  const rosterKey = JSON.stringify([next.active, roster.map((m) => [m.id, m.name, m.rank])]);
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
  if (next.explorable && next.active && !previous?.active) {
    haltMovement(s);
    s.battlePositions.clear();
    const nav = s.environment.navigation;
    let anchor = s.fieldSelected && roster[0]?.name === s.fieldSelected.name ? s.fieldSelected : [...s.fieldPositions.values()].find((p) => p.name === roster[0]?.name);
    anchor ??= nearestNode(nav, { x: s.avatar.root.position.x + 2.1, z: s.avatar.root.position.z - 0.5 });
    roster.forEach((m, i) => {
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
      return buildEnemy(m, p ? [p.x, p.z] : ENEMY_POSITIONS[roster.length][i], i);
    });
    s.enemies.forEach((enemy) => s.scene.add(enemy.root));
    s.rosterKey = rosterKey;
  }
  const advanced = sameContext && previous && next.round > previous.round && (previous.active || next.active);
  s.attack = advanced && !s.reducedMotion ? 0.52 : sameContext ? s.attack : 0;
  s.enemies.forEach((enemy, i) => {
    const current = roster[i];
    if (advanced && current.hp < enemy.hp && !s.reducedMotion) enemy.hit = 0.46;
    enemy.hp = current.hp;
    const dead = current.hp <= 0;
    if (enemy.dead !== dead) {
      enemy.dead = dead;
      enemy.k.eachMaterial((m) => {
        // The ground ring and contact shadow are not part of the fallen model.
        if (m === enemy.selection.material || m === enemy.shadow.material) return;
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
      if (recoil > 0 && m !== enemy.selection.material && m !== enemy.shadow.material) {
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
  tickMovement(s, delta);
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
  const hits = s.raycaster.intersectObjects([s.avatar.body, ...s.enemies.filter((e) => !e.dead).map((e) => e.model)], true);
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
    const alive = s.enemies.filter((e) => !e.dead && e.id != null);
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
  canvas.setAttribute('aria-label', '修真角色与地图。横向拖动旋转视角；探索时点击地面寻路、点击怪物靠近，WASD 或方向键移动，E 近身交战，Escape 停止。战斗时左右键选择目标，Enter 和空格只选择，不自动攻击。');
  canvas.setAttribute('role', 'img');
  canvas.tabIndex = 0;
  Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block', touchAction: 'pan-y', cursor: 'grab' });
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
    renderer, canvas, scene, camera: new THREE.PerspectiveCamera(36, 1, 0.1, 65),
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
