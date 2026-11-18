import * as THREE from 'three';
import type { Effect, Element, GameEvent, Projectile } from '../types';
import { srgb, box, cone, merge } from './geo';

export const ELEMENT: Record<Element, string> = { physical: '#d8c7a2', fire: '#ff873b', cold: '#82d8ff', lightning: '#c9b3ff', poison: '#8bdf55', magic: '#82a9ff' };
interface Emit {
  x: number; y: number; z: number; color: string; count?: number; speed?: number; up?: number; spread?: number;
  life?: number; size?: number; gravity?: number; drag?: number; ring?: number; alpha?: number;
}
interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; life: number; size: number; gravity: number; drag: number; color: [number, number, number]; alpha: number }

class Pool {
  readonly mesh: THREE.Points;
  private particles: Particle[] = [];
  private positions = new Float32Array(1600 * 3);
  private colors = new Float32Array(1600 * 4);
  private sizes = new Float32Array(1600);
  private material: THREE.ShaderMaterial;
  constructor(additive: boolean) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage)); geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 } },
      vertexShader: 'attribute vec4 aColor; attribute float aSize; varying vec4 vColor; uniform float uScale; void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uScale/max(0.1,-mv.z),1.0,96.0);vColor=aColor;}',
      fragmentShader: 'varying vec4 vColor; void main(){float d=length(gl_PointCoord-vec2(0.5))*2.0;if(d>1.0)discard;float a=(1.0-smoothstep(0.1,1.0,d))*vColor.a;gl_FragColor=vec4(vColor.rgb,a);}',
    });
    this.mesh = new THREE.Points(geometry, this.material); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 3 : 2;
  }
  emit(e: Emit): void {
    const color = srgb(e.color);
    for (let i = 0; i < (e.count ?? 12) && this.particles.length < 1600; i++) {
      const a = Math.random() * Math.PI * 2, speed = (e.speed ?? 2) * (.3 + Math.random() * .7), radius = e.ring ?? 0, spread = e.spread ?? .15;
      this.particles.push({ x: e.x + Math.sin(a) * radius + (Math.random() - .5) * spread, y: e.y + Math.random() * spread, z: e.z + Math.cos(a) * radius + (Math.random() - .5) * spread,
        vx: Math.sin(a) * speed, vy: (e.up ?? 1.5) * (.5 + Math.random()), vz: Math.cos(a) * speed, t: 0, life: (e.life ?? .45) * (.65 + Math.random() * .7), size: (e.size ?? .15) * (.7 + Math.random() * .6), gravity: e.gravity ?? 2, drag: e.drag ?? 1, color, alpha: e.alpha ?? .85 });
    }
  }
  update(dt: number, camera: THREE.PerspectiveCamera, bufferHeight: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.t += dt;
      if (p.t >= p.life) { this.particles[i] = this.particles[this.particles.length - 1]; this.particles.pop(); continue; }
      p.vy -= p.gravity * dt; const drag = Math.exp(-p.drag * dt); p.vx *= drag; p.vz *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    this.particles.forEach((p, i) => {
      this.positions.set([p.x, p.y, p.z], i * 3); this.colors.set([...p.color, p.alpha * Math.sin(Math.PI * Math.min(1, p.t / p.life + .15))], i * 4); this.sizes[i] = p.size * (1 - p.t / p.life * .5);
    });
    for (const name of ['position', 'aColor', 'aSize']) this.mesh.geometry.getAttribute(name).needsUpdate = true;
    this.mesh.geometry.setDrawRange(0, this.particles.length); this.material.uniforms.uScale.value = bufferHeight * .5 * camera.projectionMatrix.elements[5];
  }
  clear(): void { this.particles = []; this.mesh.geometry.setDrawRange(0, 0); }
  dispose(): void { this.mesh.geometry.dispose(); this.material.dispose(); this.mesh.removeFromParent(); }
}

interface Transient { object: THREE.Mesh | THREE.Line; t: number; duration: number; radius: number }
interface Missile { source: Projectile; mesh: THREE.Mesh; trail: number }
export class Effects {
  readonly group = new THREE.Group();
  private additive = new Pool(true);
  private normal = new Pool(false);
  private seen = new WeakSet<Effect>();
  private transients: Transient[] = [];
  private missiles = new Map<string, Missile>();
  constructor() { this.group.add(this.additive.mesh, this.normal.mesh); }
  emit(e: Emit, additive = true): void { (additive ? this.additive : this.normal).emit(e); }

  event(event: GameEvent): void {
    const e = { x: event.x, y: 1, z: event.y, color: ELEMENT[event.element] };
    if (event.kind === 'hurt') {
      this.emit({ ...e, color: event.element === 'physical' ? '#b64025' : e.color, count: 13, speed: 2.4, size: .09, gravity: 5 }, event.element !== 'physical');
    } else if (event.kind === 'block') this.emit({ ...e, color: '#fff3c4', count: 14, speed: 3, life: .25, size: .06 });
    else if (event.kind === 'revive') this.emit({ ...e, color: '#ff9d43', count: 22, up: 3, gravity: 0, life: .6 });
    else if (event.kind === 'cast') this.emit({ ...e, count: 8, size: .12, speed: .6, up: .4, gravity: 0, life: .3 });
    else if (event.kind === 'death') this.emit({ ...e, color: '#7b3220', count: 14, speed: 1.4, gravity: 6, size: .1 }, false);
  }

  private ring(x: number, z: number, color: string, radius: number, duration: number): void {
    const object = new THREE.Mesh(new THREE.RingGeometry(.93, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    object.position.set(x, .08, z); this.group.add(object); this.transients.push({ object, t: 0, radius, duration });
  }

  effect(effect: Effect): void {
    if (this.seen.has(effect)) return; this.seen.add(effect);
    const e = { x: effect.x, y: .35, z: effect.y, color: '#fff4bd' }, duration = effect.maxLife / 25;
    if (effect.kind === 'text' || effect.kind === 'hit') return;
    if (effect.kind === 'nova') {
      this.ring(e.x, e.z, ELEMENT.cold, effect.radius, duration); this.emit({ ...e, color: ELEMENT.cold, ring: effect.radius * .3, count: 48, speed: effect.radius / Math.max(duration, .2), gravity: 0, up: .2, life: duration }); return;
    }
    if (effect.kind === 'lightning') {
      const points: THREE.Vector3[] = []; for (let i = 0; i <= 9; i++) points.push(new THREE.Vector3(e.x + (i && i < 9 ? Math.random() - .5 : 0) * .7, 5 - i * .5, e.z + (i && i < 9 ? Math.random() - .5 : 0) * .7));
      const object = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: ELEMENT.lightning, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.group.add(object); this.transients.push({ object, t: 0, radius: 0, duration: .18 }); this.emit({ ...e, color: ELEMENT.lightning, count: 20 }); return;
    }
    if (effect.kind === 'fire' || effect.kind === 'cold' || effect.kind === 'poison') {
      const color = ELEMENT[effect.kind], area = effect.radius > 1.2;
      this.emit({ ...e, color, count: area ? 55 : 16, ring: area ? effect.radius * .6 : 0, spread: area ? effect.radius * .5 : .15, speed: area ? 1 : 2, up: effect.kind === 'fire' ? 2.5 : .5, gravity: 0, size: effect.kind === 'fire' ? .3 : .16, life: Math.min(duration, 1.2) });
      if (area) this.ring(e.x, e.z, color, effect.radius, Math.min(duration, .7)); return;
    }
    const color = effect.kind === 'heal' ? '#8ae39a' : effect.kind === 'level' ? '#ffe59a' : effect.kind === 'portal' ? '#75baff' : '#83dcbd';
    this.emit({ ...e, color, ring: .5, count: effect.kind === 'level' ? 65 : 25, up: 3, speed: .2, gravity: 0, life: 1, size: .13 });
    if (effect.kind === 'level' || effect.kind === 'portal') this.ring(e.x, e.z, color, effect.kind === 'level' ? 2.5 : 1, .7);
  }

  private missile(p: Projectile): Missile {
    let geometry: THREE.BufferGeometry, material: THREE.Material;
    if (p.element === 'physical') {
      geometry = merge([box(.025, .025, .65, '#c4a975'), cone(.04, .13, '#dedbc4', [0, 0, .39], [Math.PI / 2, 0, 0], 4)]);
      material = new THREE.MeshBasicMaterial({ vertexColors: true });
    } else { geometry = new THREE.IcosahedronGeometry(.11, 1); material = new THREE.MeshBasicMaterial({ color: ELEMENT[p.element], transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }); }
    const mesh = new THREE.Mesh(geometry, material); this.group.add(mesh); return { source: p, mesh, trail: 0 };
  }

  update(dt: number, camera: THREE.PerspectiveCamera, height: number, projectiles: Projectile[], alpha: number): void {
    const active = new Set<string>();
    for (const p of projectiles) {
      active.add(p.uid); let missile = this.missiles.get(p.uid); if (!missile) { missile = this.missile(p); this.missiles.set(p.uid, missile); }
      const x = p.x + p.dx * alpha, z = p.y + p.dy * alpha; missile.mesh.position.set(x, 1, z); missile.mesh.rotation.y = Math.atan2(p.dx, p.dy); missile.trail += dt;
      if (p.element !== 'physical' && missile.trail >= .025) { missile.trail %= .025; this.emit({ x, y: 1, z, color: ELEMENT[p.element], count: 2, speed: .25, up: 0, gravity: 0, life: .25, size: .18 }); }
    }
    for (const [uid, missile] of this.missiles) if (!active.has(uid)) {
      const p = missile.mesh.position; if (missile.source.element !== 'physical') this.emit({ x: p.x, y: p.y, z: p.z, color: ELEMENT[missile.source.element], count: 8, speed: 1.8, life: .25 });
      missile.mesh.geometry.dispose(); (missile.mesh.material as THREE.Material).dispose(); missile.mesh.removeFromParent(); this.missiles.delete(uid);
    }
    for (let i = this.transients.length - 1; i >= 0; i--) {
      const t = this.transients[i]; t.t += dt; const k = t.t / t.duration;
      if (k >= 1) { t.object.geometry.dispose(); (t.object.material as THREE.Material).dispose(); t.object.removeFromParent(); this.transients.splice(i, 1); continue; }
      (t.object.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.PI * Math.min(1, k + .15)) * .8;
      if (t.radius) t.object.scale.setScalar(t.radius * (.1 + k * .9));
    }
    this.additive.update(dt, camera, height); this.normal.update(dt, camera, height);
  }
  clear(): void {
    this.additive.clear(); this.normal.clear(); this.seen = new WeakSet();
    for (const t of this.transients) { t.object.geometry.dispose(); (t.object.material as THREE.Material).dispose(); t.object.removeFromParent(); } this.transients = [];
    for (const m of this.missiles.values()) { m.mesh.geometry.dispose(); (m.mesh.material as THREE.Material).dispose(); m.mesh.removeFromParent(); } this.missiles.clear();
  }
  dispose(): void { this.clear(); this.additive.dispose(); this.normal.dispose(); this.group.removeFromParent(); }
}
