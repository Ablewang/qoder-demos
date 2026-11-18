// Remote teammate avatars: jointed soldier model, procedural gait/pose, name tag and buffered interpolation.
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { GameContext } from "../types/context";
import type { PeerInfo, PeerState } from "../../server/protocol";
import { mergeGeometries } from "../utils/buffer-geometry-utils";

const INTERP_DELAY_MS = 120;
const MAX_SAMPLES = 12;
export const SLOT_COLORS = ["#ffb347", "#4fc3f7", "#9ccc65", "#f06292"];

const PELVIS_Y = 0.97;
const HIP_DROP = 0.04;
const THIGH = 0.43;
const SHIN = 0.42;
const ANKLE = 0.08;
const CROUCH_HIP = 1.45;
const CROUCH_KNEE = -2.35;
const CROUCH_LEAN = -0.32;
const WALK_SPEED = 3.8;
const STRIDE_RAD_PER_M = 2.7;
const LABEL_Y = 2.08;

type Role = "fabric" | "armor" | "dark" | "metal" | "accent" | "glow";
type Bone = "pelvis" | "thigh" | "shin" | "foot" | "spine" | "head" | "aim";
type Kit = Record<Bone, Partial<Record<Role, BufferGeometry>>>;

const ROLES: Role[] = ["fabric", "armor", "dark", "metal", "accent", "glow"];

interface Sample {
  at: number;
  state: PeerState;
}

interface Leg {
  hip: Group;
  knee: Group;
  ankle: Group;
}

interface Avatar {
  root: Group;
  body: Group;
  pelvis: Group;
  spine: Group;
  head: Group;
  aim: Group;
  legs: [Leg, Leg];
  flash: Mesh;
  label: Sprite;
  color: string;
  materials: (MeshStandardMaterial | MeshBasicMaterial)[];
  samples: Sample[];
  name: string;
  host: boolean;
  crouch: number;
  down: number;
  speed: number;
  stride: number;
  phase: number;
  recoil: number;
  lastFireAt: number;
  last: Vector3 | null;
}

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpE = new Euler();
const tmpV = new Vector3();
const UP = new Vector3(0, 1, 0);

function placed(
  g: BufferGeometry,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = 1,
  sz = 1,
) {
  tmpQ.setFromEuler(tmpE.set(rx, ry, rz));
  tmpM.compose(tmpV.set(x, y, z), tmpQ, new Vector3(sx, sy, sz));
  const out = g.index ? g.toNonIndexed() : g.clone();
  out.applyMatrix4(tmpM);
  g.dispose();
  return out;
}

const box = (
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
) =>
  placed(
    new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.22),
    x,
    y,
    z,
    rx,
    ry,
    rz,
  );

const ball = (
  r: number,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
) => placed(new SphereGeometry(r, 14, 10), x, y, z, 0, 0, 0, sx, sy, sz);

const pill = (r: number, len: number, x: number, y: number, z: number) =>
  placed(new CapsuleGeometry(r, len, 4, 10), x, y, z);

const rod = (
  r: number,
  h: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  rz = 0,
) => placed(new CylinderGeometry(r, r, h, 12), x, y, z, rx, 0, rz);

function limb(
  a: [number, number, number],
  b: [number, number, number],
  r: number,
) {
  const from = new Vector3(...a);
  const dir = new Vector3(...b).sub(from);
  const len = dir.length();
  const g = new CapsuleGeometry(r, Math.max(0.001, len - r * 2), 4, 10);
  tmpQ.setFromUnitVectors(UP, dir.normalize());
  tmpM.compose(from.lerp(new Vector3(...b), 0.5), tmpQ, new Vector3(1, 1, 1));
  const out = g.index ? g.toNonIndexed() : g.clone();
  out.applyMatrix4(tmpM);
  g.dispose();
  return out;
}

let kit: Kit | null = null;
let clothTexture: CanvasTexture | null = null;

function makeCloth() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#a5aa91";
  ctx.fillRect(0, 0, 128, 128);
  for (let n = 0; n < 80; n++) {
    ctx.fillStyle = ["#7c876d", "#bbc0a4", "#929579", "#686f5c"][n % 4];
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * 128,
      Math.random() * 128,
      3 + Math.random() * 12,
      2 + Math.random() * 5,
      Math.random() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.fillStyle = "rgba(40,45,30,0.18)";
  for (let y = 0; y < 128; y += 3) ctx.fillRect(0, y, 128, 1);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function buildKit(): Kit {
  const parts: Record<Bone, Partial<Record<Role, BufferGeometry[]>>> = {
    pelvis: {},
    thigh: {},
    shin: {},
    foot: {},
    spine: {},
    head: {},
    aim: {},
  };
  const add = (bone: Bone, role: Role, ...g: BufferGeometry[]) => {
    (parts[bone][role] ??= []).push(...g);
  };

  add("pelvis", "fabric", box(0.32, 0.2, 0.2, 0, 0.01, 0));
  add(
    "pelvis",
    "dark",
    box(0.345, 0.055, 0.225, 0, 0.09, 0),
    box(0.07, 0.13, 0.11, 0.195, -0.03, 0.01),
    box(0.03, 0.035, 0.03, 0, 0.09, -0.115),
  );
  add("pelvis", "accent", box(0.012, 0.09, 0.07, 0.232, -0.03, 0.01));

  add("thigh", "fabric", pill(0.085, 0.28, 0, -0.2, 0));
  add("thigh", "armor", box(0.07, 0.135, 0.07, 0.075, -0.2, 0.015, 0, 0, 0.12));
  add("thigh", "dark", box(0.1, 0.12, 0.06, 0.07, -0.2, -0.02, 0, 0, 0.12));
  add("shin", "fabric", pill(0.066, 0.3, 0, -0.21, 0));
  add("shin", "armor", box(0.112, 0.125, 0.065, 0, -0.03, -0.065, -0.15));
  add("shin", "dark", box(0.125, 0.028, 0.125, 0, -0.06, 0));
  add(
    "foot",
    "dark",
    box(0.12, 0.1, 0.27, 0, -0.03, -0.05),
    box(0.13, 0.025, 0.29, 0, -0.07, -0.05),
    pill(0.065, 0.06, 0, 0.04, 0),
  );

  add(
    "spine",
    "fabric",
    ball(0.15, 0, 0.12, 0, 1, 1.1, 0.72),
    ball(0.18, 0, 0.32, 0, 1.04, 0.94, 0.67),
    ball(0.075, 0.2, 0.41, 0, 1, 1.13, 1),
    ball(0.075, -0.2, 0.41, 0, 1, 1.13, 1),
    rod(0.06, 0.12, 0, 0.52, 0),
  );
  add(
    "spine",
    "armor",
    box(0.345, 0.29, 0.105, 0, 0.31, -0.107),
    box(0.345, 0.29, 0.075, 0, 0.31, 0.105),
    box(0.285, 0.3, 0.16, 0, 0.31, 0.215),
    box(0.245, 0.1, 0.145, 0, 0.125, 0.215),
    box(0.08, 0.13, 0.07, 0.165, 0.33, 0.22, 0, 0, -0.14),
    box(0.13, 0.11, 0.16, 0.22, 0.42, 0, 0, 0, -0.22),
    box(0.13, 0.11, 0.16, -0.22, 0.42, 0, 0, 0, 0.22),
  );
  add(
    "spine",
    "dark",
    box(0.09, 0.13, 0.06, -0.105, 0.22, -0.183),
    box(0.09, 0.13, 0.06, 0, 0.22, -0.183),
    box(0.09, 0.13, 0.06, 0.105, 0.22, -0.183),
    box(0.048, 0.14, 0.033, -0.125, 0.455, -0.08, 0.35),
    box(0.048, 0.14, 0.033, 0.125, 0.455, -0.08, 0.35),
    box(0.06, 0.15, 0.05, -0.17, 0.41, -0.12, 0, 0, 0.1),
    rod(0.008, 0.18, -0.17, 0.55, -0.12),
    box(0.05, 0.42, 0.02, -0.1, 0.33, 0.29),
    box(0.05, 0.42, 0.02, 0.1, 0.33, 0.29),
    box(0.3, 0.035, 0.03, 0, 0.17, -0.148),
  );
  add(
    "spine",
    "accent",
    box(0.095, 0.04, 0.012, 0, 0.4, -0.166),
    box(0.014, 0.055, 0.065, 0.285, 0.42, 0),
    box(0.014, 0.055, 0.065, -0.285, 0.42, 0),
  );
  add("spine", "glow", box(0.04, 0.012, 0.012, -0.17, 0.47, -0.148));

  add("head", "dark", ball(0.105, 0, 0.1, 0, 0.95, 1.1, 1.05));
  add("head", "fabric", ball(0.095, 0, 0.053, -0.008, 0.98, 0.62, 1.1));
  add(
    "head",
    "armor",
    placed(
      new SphereGeometry(0.128, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      0,
      0.115,
      0.005,
      0,
      0,
      0,
      1,
      0.92,
      1.08,
    ),
    box(0.06, 0.04, 0.05, 0, 0.215, -0.11),
  );
  add(
    "head",
    "dark",
    box(0.175, 0.055, 0.05, 0, 0.115, -0.1),
    rod(0.045, 0.045, 0.108, 0.085, 0, 0, Math.PI / 2),
    rod(0.045, 0.045, -0.108, 0.085, 0, 0, Math.PI / 2),
    limb([-0.1, 0.06, -0.03], [-0.035, 0.03, -0.115], 0.007),
  );
  add(
    "head",
    "accent",
    placed(
      new CylinderGeometry(0.1335, 0.1335, 0.022, 20),
      0,
      0.12,
      0.005,
      0,
      0,
      0,
      1,
      1,
      1.08,
    ),
  );
  add(
    "head",
    "glow",
    box(0.062, 0.03, 0.012, 0.042, 0.115, -0.126),
    box(0.062, 0.03, 0.012, -0.042, 0.115, -0.126),
  );

  const rShoulder: [number, number, number] = [0.2, 0.02, 0];
  const rElbow: [number, number, number] = [0.245, -0.235, -0.07];
  const rHand: [number, number, number] = [0.105, -0.165, -0.23];
  const lShoulder: [number, number, number] = [-0.2, 0.02, 0];
  const lElbow: [number, number, number] = [-0.13, -0.24, -0.33];
  const lHand: [number, number, number] = [0.085, -0.115, -0.58];
  add(
    "aim",
    "fabric",
    limb(rShoulder, rElbow, 0.058),
    limb(rElbow, rHand, 0.048),
    limb(lShoulder, lElbow, 0.058),
    limb(lElbow, lHand, 0.048),
  );
  add(
    "aim",
    "dark",
    ball(0.046, ...rHand),
    ball(0.046, ...lHand),
    box(0.035, 0.1, 0.045, 0.1, -0.13, -0.24, -0.3),
    box(0.045, 0.15, 0.07, 0.1, -0.15, -0.38, 0.22),
    box(0.04, 0.05, 0.11, 0.1, 0.025, -0.38),
  );
  add(
    "aim",
    "metal",
    box(0.045, 0.1, 0.22, 0.1, -0.075, -0.06),
    box(0.06, 0.09, 0.32, 0.1, -0.05, -0.36),
    box(0.056, 0.072, 0.26, 0.1, -0.05, -0.64),
    rod(0.014, 0.2, 0.1, -0.045, -0.86, Math.PI / 2),
    rod(0.022, 0.05, 0.1, -0.045, -0.97, Math.PI / 2),
  );
  add("aim", "glow", box(0.028, 0.028, 0.01, 0.1, 0.025, -0.437));

  const out = {} as Kit;
  for (const bone of Object.keys(parts) as Bone[]) {
    out[bone] = {};
    for (const role of ROLES) {
      const list = parts[bone][role];
      if (list?.length) {
        out[bone][role] = mergeGeometries(list) as BufferGeometry;
        for (const g of list) g.dispose();
      }
    }
  }
  return out;
}

function lerpAngle(a: number, b: number, t: number) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

function makeLabel(name: string, color: string, host: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 80;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(11,13,15,0.78)";
  ctx.beginPath();
  ctx.roundRect(4, 14, 312, 52, 10);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(4, 14, 8, 52);
  ctx.font = '600 30px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textBaseline = "middle";
  let x = 28;
  if (host) {
    ctx.fillStyle = color;
    ctx.fillText("房主", x, 41);
    x += ctx.measureText("房主").width + 14;
  }
  ctx.fillStyle = "#e8e4da";
  ctx.fillText(name, x, 41, 304 - x);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createAvatars(i: GameContext) {
  const avatars = new Map<string, Avatar>();

  function build(peer: PeerInfo, host: boolean): Avatar {
    kit ??= buildKit();
    clothTexture ??= makeCloth();
    const color = SLOT_COLORS[peer.slot % SLOT_COLORS.length];
    const mats: Record<Role, MeshStandardMaterial> = {
      fabric: new MeshStandardMaterial({
        color: "#a6ae9a",
        map: clothTexture,
        roughness: 0.92,
      }),
      armor: new MeshStandardMaterial({
        color: "#807b60",
        roughness: 0.78,
        metalness: 0.08,
      }),
      dark: new MeshStandardMaterial({ color: "#34383a", roughness: 0.7 }),
      metal: new MeshStandardMaterial({
        color: "#2a2d30",
        roughness: 0.42,
        metalness: 0.65,
      }),
      accent: new MeshStandardMaterial({ color, roughness: 0.6 }),
      glow: new MeshStandardMaterial({
        color,
        emissive: new Color(color),
        emissiveIntensity: 2.2,
      }),
    };
    const bone = (name: Bone) => {
      const g = new Group();
      g.name = name;
      for (const role of ROLES) {
        const geo = kit![name][role];
        if (geo) {
          const mesh = new Mesh(geo, mats[role]);
          mesh.castShadow = role !== "glow";
          mesh.receiveShadow = true;
          g.add(mesh);
        }
      }
      return g;
    };
    const root = new Group();
    root.name = `peer:${peer.id}`;
    const body = new Group();
    body.name = "body";
    const pelvis = bone("pelvis");
    pelvis.position.y = PELVIS_Y;
    const spine = bone("spine");
    spine.position.y = 0.05;
    const head = bone("head");
    head.position.y = 0.58;
    const aim = bone("aim");
    aim.position.y = 0.42;
    spine.add(head, aim);
    pelvis.add(spine);
    const legs = [-1, 1].map((side) => {
      const hip = bone("thigh");
      hip.position.set(side * 0.1, -HIP_DROP, 0);
      const knee = bone("shin");
      knee.position.y = -THIGH;
      const ankle = bone("foot");
      ankle.position.y = -SHIN;
      knee.add(ankle);
      hip.add(knee);
      pelvis.add(hip);
      return { hip, knee, ankle };
    }) as [Leg, Leg];
    const flashMat = new MeshBasicMaterial({
      color: "#ffd27a",
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const flash = new Mesh(new SphereGeometry(0.055, 10, 8), flashMat);
    flash.scale.set(1, 1, 2.6);
    flash.position.set(0.1, -0.045, -1.06);
    flash.visible = false;
    aim.add(flash);
    body.add(pelvis);
    root.add(body);
    const label = new Sprite(
      new SpriteMaterial({
        map: makeLabel(peer.name, color, host),
        depthTest: false,
        transparent: true,
        toneMapped: false,
      }),
    );
    label.scale.set(1.2, 0.3, 1);
    label.position.y = LABEL_Y;
    label.renderOrder = 10;
    root.add(label);
    root.visible = false;
    i.scene.add(root);
    return {
      root,
      body,
      pelvis,
      spine,
      head,
      aim,
      legs,
      flash,
      label,
      color,
      materials: [...Object.values(mats), flashMat],
      samples: [],
      name: peer.name,
      host,
      crouch: 0,
      down: 0,
      speed: 0,
      stride: 0,
      phase: 0,
      recoil: 0,
      lastFireAt: 0,
      last: null,
    };
  }

  function remove(id: string) {
    const avatar = avatars.get(id);
    if (!avatar) {
      return;
    }
    avatars.delete(id);
    i.scene.remove(avatar.root);
    for (const m of avatar.materials) m.dispose();
    avatar.flash.geometry.dispose();
    avatar.label.material.map?.dispose();
    avatar.label.material.dispose();
  }

  function sample(avatar: Avatar, at: number): PeerState | null {
    const s = avatar.samples;
    if (!s.length) {
      return null;
    }
    if (at <= s[0].at) {
      return s[0].state;
    }
    for (let k = s.length - 1; k > 0; k--) {
      const a = s[k - 1];
      const b = s[k];
      if (at >= a.at && at <= b.at) {
        const t = (at - a.at) / Math.max(1, b.at - a.at);
        return {
          x: a.state.x + (b.state.x - a.state.x) * t,
          y: a.state.y + (b.state.y - a.state.y) * t,
          z: a.state.z + (b.state.z - a.state.z) * t,
          yaw: lerpAngle(a.state.yaw, b.state.yaw, t),
          pitch: a.state.pitch + (b.state.pitch - a.state.pitch) * t,
          crouch: b.state.crouch,
          fire: b.state.fire,
          mode: b.state.mode,
        };
      }
    }
    return s[s.length - 1].state;
  }

  function pose(avatar: Avatar, state: PeerState, dt: number, now: number) {
    const k = 1 - Math.exp(-dt * 12);
    const pos = avatar.root.position;
    if (avatar.last && dt > 0) {
      const dx = state.x - avatar.last.x;
      const dz = state.z - avatar.last.z;
      const fwd = -dx * Math.sin(state.yaw) - dz * Math.cos(state.yaw);
      const speed = Math.min(9, Math.hypot(dx, dz) / dt);
      avatar.speed += (speed - avatar.speed) * (1 - Math.exp(-dt * 8));
      avatar.phase +=
        (fwd >= -0.2 * Math.hypot(dx, dz) ? 1 : -1) *
        Math.hypot(dx, dz) *
        STRIDE_RAD_PER_M;
    }
    avatar.last = (avatar.last ?? new Vector3()).set(state.x, state.y, state.z);
    pos.set(state.x, state.y, state.z);
    avatar.root.rotation.y = state.yaw;

    avatar.crouch += ((state.crouch ? 1 : 0) - avatar.crouch) * k;
    avatar.down += ((state.mode === "down" ? 1 : 0) - avatar.down) * k * 0.6;
    const alive = 1 - avatar.down;
    const c = avatar.crouch;
    const moving = Math.min(1, avatar.speed / 0.6) * alive;
    const sprint = Math.max(
      0,
      Math.min(1, (avatar.speed - WALK_SPEED - 0.4) / 1.6),
    );
    avatar.stride +=
      (Math.min(1.3, avatar.speed / WALK_SPEED) * moving - avatar.stride) * k;
    const amp = avatar.stride * (0.42 - 0.22 * c + 0.12 * sprint);
    const ph = avatar.phase;

    let pelvisY = 0;
    avatar.legs.forEach((leg, n) => {
      const s = n ? Math.sin(ph) : -Math.sin(ph);
      const lift = Math.max(0, n ? Math.cos(ph) : -Math.cos(ph));
      const hip = CROUCH_HIP * c + s * amp;
      const knee = CROUCH_KNEE * c - lift * amp * 1.5 - 0.04;
      leg.hip.rotation.x = hip * alive;
      leg.knee.rotation.x = knee * alive;
      leg.ankle.rotation.x = -(hip + knee) * alive * 0.85;
      const h =
        HIP_DROP +
        THIGH * Math.cos(leg.hip.rotation.x) +
        SHIN * Math.cos(leg.hip.rotation.x + leg.knee.rotation.x) +
        ANKLE;
      pelvisY = Math.max(pelvisY, h);
    });
    avatar.pelvis.position.y =
      pelvisY + Math.abs(Math.sin(ph)) * 0.025 * avatar.stride;
    avatar.pelvis.rotation.y = Math.sin(ph) * 0.07 * avatar.stride * alive;

    const lean = (CROUCH_LEAN * c - 0.16 * sprint - 0.05 * moving) * alive;
    avatar.spine.rotation.x = lean;
    avatar.spine.rotation.y = -avatar.pelvis.rotation.y * 1.4;
    const pitch = state.pitch * alive;
    avatar.head.rotation.x = pitch * 0.65 - lean;
    avatar.aim.rotation.x = pitch - lean - 0.35 * sprint + 0.6 * avatar.down;

    if (state.fire && state.mode === "field") {
      avatar.lastFireAt = now;
    }
    const firing = now - avatar.lastFireAt < 140;
    if (firing) {
      avatar.recoil = Math.max(avatar.recoil, 0.6 + Math.random() * 0.4);
    }
    avatar.recoil *= Math.exp(-dt * 18);
    avatar.aim.position.z = avatar.recoil * 0.045;
    avatar.aim.rotation.x += avatar.recoil * 0.05;
    avatar.aim.position.y = 0.42 + Math.sin(now * 0.0018) * 0.004 * alive;
    avatar.flash.visible = firing && Math.random() > 0.35;
    avatar.flash.rotation.z = Math.random() * Math.PI;

    avatar.body.rotation.x = (Math.PI / 2) * avatar.down;
    avatar.body.position.y = 0.28 * avatar.down;
    avatar.label.position.y =
      LABEL_Y -
      (PELVIS_Y - avatar.pelvis.position.y) -
      0.1 * c -
      1.45 * avatar.down;
  }

  return {
    push(peer: PeerInfo, host: boolean, state: PeerState) {
      let avatar = avatars.get(peer.id);
      if (!avatar) {
        avatar = build(peer, host);
        avatars.set(peer.id, avatar);
      }
      avatar.samples.push({ at: performance.now(), state });
      if (avatar.samples.length > MAX_SAMPLES) {
        avatar.samples.shift();
      }
    },
    label(id: string, name: string, host: boolean) {
      const avatar = avatars.get(id);
      if (!avatar || (avatar.name === name && avatar.host === host)) {
        return;
      }
      const old = avatar.label.material.map;
      avatar.label.material.map = makeLabel(name, avatar.color, host);
      avatar.label.material.needsUpdate = true;
      old?.dispose();
      avatar.name = name;
      avatar.host = host;
    },
    remove,
    clear() {
      for (const id of [...avatars.keys()]) remove(id);
    },
    get count() {
      return avatars.size;
    },
    update(dt: number) {
      const now = performance.now();
      const at = now - INTERP_DELAY_MS;
      for (const avatar of avatars.values()) {
        const state = sample(avatar, at);
        if (!state || state.mode === "idle") {
          avatar.root.visible = false;
          avatar.last = null;
          continue;
        }
        avatar.root.visible = true;
        pose(avatar, state, dt, now);
      }
    },
  };
}
