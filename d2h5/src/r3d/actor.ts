import * as THREE from 'three';
import { actorMaterial, instantiate, type RigInstance } from './geo';
import { rigTemplate, releaseRig, specKey, type Spec } from './rigs';

const FPS = 25;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (k: number) => { const t = clamp(k, 0, 1); return t * t * (3 - 2 * t); };
function angleTo(from: number, to: number, k: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2;
  return from + d * k;
}

export type ActionKind = 'melee' | 'bow' | 'cast';
const shadowGeometry = new THREE.CircleGeometry(.42, 18).rotateX(-Math.PI / 2);
const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .38, depthWrite: false });
let shadowUsers = 0;

export class Actor {
  readonly group = new THREE.Group();
  readonly inner = new THREE.Group();
  readonly key: string;
  private readonly rig: RigInstance;
  private readonly material: THREE.MeshLambertMaterial;
  private readonly shadow: THREE.Mesh;
  private prevX = 0; private prevY = 0; private curX = 0; private curY = 0; private lastTick = -1; private fresh = true;
  x = 0; y = 0; speed = 0;
  yaw = 0;
  private phase = 0; private walk = 0;
  private action: { kind: ActionKind; t: number; dur: number } | null = null;
  private hurt = 0; private fall = 0; private time = Math.random() * 10;
  dead = false;

  constructor(readonly spec: Spec) {
    this.key = specKey(spec);
    this.material = actorMaterial(spec.ghost);
    this.rig = instantiate(rigTemplate(spec), this.material);
    this.rig.mesh.castShadow = !spec.ghost;
    this.inner.add(this.rig.mesh);
    this.inner.scale.setScalar(spec.scale);
    shadowUsers++;
    this.shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    this.shadow.position.y = .02; this.shadow.renderOrder = 1;
    this.shadow.scale.setScalar(spec.scale * (spec.body === 'quad' ? 1.2 : spec.bulk));
    this.group.add(this.shadow, this.inner);
  }

  sync(x: number, y: number, tick: number): void {
    if (this.fresh || Math.hypot(x - this.curX, y - this.curY) > 2) {
      this.prevX = this.curX = x; this.prevY = this.curY = y; this.lastTick = tick; this.fresh = false; return;
    }
    if (tick !== this.lastTick) { this.prevX = this.curX; this.prevY = this.curY; this.curX = x; this.curY = y; this.lastTick = tick; }
  }

  trigger(kind: ActionKind, seconds = .42): void {
    const k = this.spec.weapon === 'bow' ? 'bow' : kind;
    this.action = { kind: k, t: 0, dur: clamp(seconds, .25, .55) };
  }
  hit(): void { this.hurt = .25; }

  update(dt: number, alpha: number, faceYaw: number | null): void {
    this.time += dt;
    const dx = this.curX - this.prevX, dy = this.curY - this.prevY;
    this.x = this.prevX + dx * alpha; this.y = this.prevY + dy * alpha;
    this.group.position.set(this.x, 0, this.y);
    const speed = Math.hypot(dx, dy) * FPS;
    this.speed = lerp(this.speed, speed, clamp(dt * 12, 0, 1));
    const target = faceYaw ?? (speed > .4 ? Math.atan2(dx, dy) : null);
    if (target !== null && !this.dead) this.yaw = angleTo(this.yaw, target, clamp(dt * 14, 0, 1));
    this.group.rotation.y = this.yaw;
    const moving = !this.dead && this.speed > .5 ? 1 : 0;
    this.walk = lerp(this.walk, moving, clamp(dt * 10, 0, 1));
    this.phase += dt * Math.max(this.speed, 1.5) / (1.3 * this.spec.scale) * Math.PI * 2 * (this.walk > .05 ? 1 : 0);
    if (this.action) { this.action.t += dt; if (this.action.t >= this.action.dur) this.action = null; }
    this.hurt = Math.max(0, this.hurt - dt);
    this.fall = this.dead ? Math.min(1, this.fall + dt / .6) : Math.max(0, this.fall - dt / .5);
    this.pose();
    const h = this.hurt / .25;
    this.material.emissive.setRGB(.55 * h, .04 * h, .02 * h);
    const shade = 1 - .55 * this.fall;
    this.material.color.setRGB(shade, shade, shade);
    if (this.spec.ghost) this.material.opacity = (.55 + Math.sin(this.time * 3) * .12) * (1 - this.fall);
    this.shadow.visible = this.fall < .9 || this.spec.body !== 'bird';
  }

  private reset(): Record<string, THREE.Bone> {
    const { bones, rest } = this.rig;
    for (const name in bones) { const b = bones[name]; b.rotation.set(0, 0, 0); b.position.set(...rest[name]); }
    return bones;
  }

  private pose(): void {
    const b = this.reset();
    if (this.spec.body === 'quad') return this.poseQuad(b);
    if (this.spec.body === 'bird') return this.poseBird(b);
    const w = this.walk, s = Math.sin(this.phase), c = Math.cos(this.phase);
    b.torso.rotation.x = this.spec.hunch + Math.sin(this.time * 2) * .015;
    b.legR.rotation.x = .72 * s * w; b.legL.rotation.x = -.72 * s * w;
    b.shinR.rotation.x = (.06 + Math.max(0, -c) * .9) * w; b.shinL.rotation.x = (.06 + Math.max(0, c) * .9) * w;
    b.armR.rotation.x = -.55 * s * w; b.armL.rotation.x = .55 * s * w;
    b.armR.rotation.z = -.1; b.armL.rotation.z = .1;
    b.foreR.rotation.x = -.28 - .15 * w; b.foreL.rotation.x = -.28 - .15 * w;
    b.hips.position.y += .03 * Math.cos(this.phase * 2) * w;
    b.hips.rotation.y = .08 * s * w; b.torso.rotation.y = -.12 * s * w;
    if (this.spec.weapon === 'bow') b.foreL.rotation.x = -1.2;
    if (this.spec.weapon === 'spear' || this.spec.weapon === 'staff') b.foreR.rotation.x = -.55;
    if (this.spec.float) b.root.position.y += this.spec.float + Math.sin(this.time * 2.4) * .08;
    const a = this.action;
    if (a) {
      const k = a.t / a.dur;
      if (a.kind === 'melee') {
        let arm: number, twist: number, lunge: number, fore: number;
        if (k < .35) { const e = smooth(k / .35); arm = lerp(b.armR.rotation.x, -2.6, e); twist = -.45 * e; lunge = 0; fore = -.28 - .4 * e; }
        else if (k < .6) { const e = smooth((k - .35) / .25); arm = lerp(-2.6, -.5, e); twist = lerp(-.45, .35, e); lunge = .22 * e; fore = lerp(-.68, -.1, e); }
        else { const e = smooth((k - .6) / .4); arm = lerp(-.5, 0, e); twist = lerp(.35, 0, e); lunge = lerp(.22, 0, e); fore = lerp(-.1, -.28, e); }
        b.armR.rotation.x = arm; b.armR.rotation.z = -.15; b.foreR.rotation.x = fore; b.torso.rotation.y += twist; b.root.position.z += lunge;
        if (this.spec.weapon === 'claw') { b.armL.rotation.x = lerp(0, -1.4, Math.sin(k * Math.PI)); b.foreL.rotation.x = -.2; }
        b.legR.rotation.x -= lunge * 1.5; b.legL.rotation.x += lunge * 1.2;
      } else if (a.kind === 'bow') {
        let e: number, fr: number;
        if (k < .5) { e = smooth(k / .5); fr = -2.0 * e; }
        else if (k < .65) { e = 1; fr = lerp(-2.0, -1.0, smooth((k - .5) / .15)); }
        else { e = 1 - smooth((k - .65) / .35); fr = -1.0 * e; }
        b.armL.rotation.x = -1.55 * e; b.foreL.rotation.x = lerp(-1.2, 0, e); b.armL.rotation.z = .1;
        b.armR.rotation.x = -1.5 * e; b.armR.rotation.z = -.25 * e; b.foreR.rotation.x = fr; b.torso.rotation.y += .25 * e;
      } else {
        let arm: number, spread: number, lunge = 0;
        if (k < .4) { const e = smooth(k / .4); arm = -2.3 * e; spread = .5 * e; }
        else if (k < .65) { const e = smooth((k - .4) / .25); arm = lerp(-2.3, -1.5, e); spread = lerp(.5, .15, e); lunge = .1 * e; }
        else { const e = smooth((k - .65) / .35); arm = lerp(-1.5, 0, e); spread = lerp(.15, 0, e); lunge = lerp(.1, 0, e); }
        b.armR.rotation.x = arm; b.armL.rotation.x = arm; b.armR.rotation.z = -.1 - spread; b.armL.rotation.z = .1 + spread;
        b.foreR.rotation.x = -.2; b.foreL.rotation.x = -.2; b.root.position.z += lunge; b.torso.rotation.x -= lunge;
      }
    }
    const h = this.hurt / .25;
    if (h > 0) { b.torso.rotation.x -= .35 * h; b.head.rotation.x -= .2 * h; }
    if (this.fall > 0) {
      const k = smooth(this.fall);
      b.root.rotation.x = -Math.PI / 2 * .96 * k; b.root.position.y = lerp(b.root.position.y, .12, k);
      b.armR.rotation.x = lerp(b.armR.rotation.x, -2.4, k); b.armL.rotation.x = lerp(b.armL.rotation.x, -2.6, k);
      b.armR.rotation.z = lerp(b.armR.rotation.z, -.6, k); b.armL.rotation.z = lerp(b.armL.rotation.z, .5, k);
      b.legR.rotation.x *= 1 - k; b.legL.rotation.x = lerp(b.legL.rotation.x, -.35, k); b.shinL.rotation.x = lerp(b.shinL.rotation.x, .6, k);
      b.torso.rotation.x *= 1 - k * .8;
    }
  }

  private poseQuad(b: Record<string, THREE.Bone>): void {
    const w = this.walk, s = Math.sin(this.phase * 1.4) * .7 * w;
    b.legFR.rotation.x = s; b.legBL.rotation.x = s; b.legFL.rotation.x = -s; b.legBR.rotation.x = -s;
    b.body.position.y += Math.abs(Math.cos(this.phase * 1.4)) * .04 * w;
    b.head.rotation.x = Math.sin(this.time * 3) * .06;
    if (this.action) {
      const e = Math.sin(clamp(this.action.t / this.action.dur, 0, 1) * Math.PI);
      b.root.position.z += .25 * e; b.head.rotation.x -= .5 * e; b.body.rotation.x = -.2 * e;
    }
    const h = this.hurt / .25; if (h > 0) b.body.rotation.x += .2 * h;
    if (this.fall > 0) { const k = smooth(this.fall); b.root.rotation.z = Math.PI / 2 * .95 * k; b.root.position.y = .18 * k; }
  }

  private poseBird(b: Record<string, THREE.Bone>): void {
    const flap = Math.sin(this.time * 15) * .75 * (1 - this.fall);
    b.wingR.rotation.z = flap; b.wingL.rotation.z = -flap;
    let y = this.spec.float + Math.sin(this.time * 3) * .12, z = 0;
    if (this.action) { const e = Math.sin(clamp(this.action.t / this.action.dur, 0, 1) * Math.PI); y -= .55 * e; z += .35 * e; b.body.rotation.x = .5 * e; }
    if (this.fall > 0) { const k = smooth(this.fall); y = lerp(y, .1, k); b.root.rotation.z = Math.PI * .5 * k; }
    b.root.position.y = y; b.root.position.z = z;
  }

  dispose(): void {
    this.material.dispose();
    this.rig.mesh.skeleton.dispose();
    releaseRig(this.key);
    if (--shadowUsers === 0) { shadowGeometry.dispose(); shadowMaterial.dispose(); }
    this.group.removeFromParent();
  }
}
