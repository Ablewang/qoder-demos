import * as THREE from 'three';
import type { AreaState, GameState, Point, Quality } from './types';
import { artUrl, itemArtKey } from './art';
import { Actor } from './r3d/actor';
import { playerSpec, monsterSpec, npcSpec, summonSpec, specKey, type Spec } from './r3d/rigs';
import { Terrain } from './r3d/terrain';
import { Effects } from './r3d/effects';
import { Overlay, QUALITY } from './r3d/overlay';

interface Look { background: string; sky: string; ground: string; hemi: number; sun: string; strength: number; torch: number; near: number; far: number }
const LOOKS: Record<string, Look> = {
  town: { background: '#333936', sky: '#d9d9c5', ground: '#51452f', hemi: 1.7, sun: '#ffe4b2', strength: 2.6, torch: 0, near: 6, far: 26 },
  grass: { background: '#28302e', sky: '#bdcbd1', ground: '#4e482d', hemi: 1.65, sun: '#f3d9ac', strength: 2.5, torch: 0, near: 6, far: 25 },
  jungle: { background: '#1c3029', sky: '#b9c7a8', ground: '#243a22', hemi: 1.35, sun: '#dfd1a3', strength: 1.8, torch: 1, near: 3, far: 20 },
  cave: { background: '#101619', sky: '#7d929b', ground: '#262322', hemi: .65, sun: '#91a1ac', strength: .65, torch: 22, near: -2, far: 16 },
  dungeon: { background: '#14191b', sky: '#8a969b', ground: '#2c261f', hemi: .75, sun: '#b6aba0', strength: .75, torch: 20, near: -2, far: 16 },
  desert: { background: '#6d6658', sky: '#e4d9b9', ground: '#897446', hemi: 1.8, sun: '#ffe0a1', strength: 2.7, torch: 0, near: 6, far: 28 },
  hell: { background: '#251410', sky: '#b97755', ground: '#371b13', hemi: 1.2, sun: '#fa8d4c', strength: 1.7, torch: 14, near: 2, far: 20 },
  snow: { background: '#4c5c65', sky: '#d6e1ef', ground: '#64747f', hemi: 1.8, sun: '#e1e9ff', strength: 2.2, torch: 0, near: 6, far: 28 },
};
interface DropVisual { group: THREE.Group; sprite: THREE.Sprite; glow: THREE.Mesh; signal: THREE.Mesh; born: number; quality: Quality }
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export class Renderer {
  hover: string | null = null;
  groundArea: AreaState | null = null;
  private gl: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, .1, 150);
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private vector = new THREE.Vector3();
  private target = new THREE.Vector3();
  private hemi = new THREE.HemisphereLight();
  private sun = new THREE.DirectionalLight();
  private torch = new THREE.PointLight('#ffbf7a', 20, 12, 1.4);
  private terrain: Terrain | null = null;
  private effects = new Effects();
  private overlayCanvas: HTMLCanvasElement;
  private overlay: Overlay;
  private width = 1; private height = 1; private distance = 28;
  private textures = new Map<string, THREE.Texture>();
  private loader = new THREE.TextureLoader();
  private actors = new Map<string, Actor>();
  private actorAim = new Map<string, { yaw: number; until: number }>();
  private drops = new Map<string, DropVisual>();
  private selectedRing: THREE.Mesh;
  private hoverRing: THREE.Mesh;
  private targetRing: THREE.Mesh;
  private lastTime = 0; private lastTick = -1; private tickTime = 0; private lastSeq = 0;
  private lookId = -1;
  private shake = 0; private flameTime = 0;
  private observer: ResizeObserver;
  private destroyed = false;
  readonly coarse = matchMedia('(pointer:coarse)').matches;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.torch, this.effects.group);
    this.selectedRing = this.ring('#d84b3d', .52); this.hoverRing = this.ring('#d9cba2', .7); this.targetRing = this.ring('#d0b575', .25);
    this.scene.add(this.selectedRing, this.hoverRing, this.targetRing);
    this.overlayCanvas = document.createElement('canvas'); this.overlayCanvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.overlayCanvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '1' });
    canvas.after(this.overlayCanvas); this.overlay = new Overlay(this.overlayCanvas);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); this.resize();
  }

  private ring(color: string, radius: number): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(radius * .87, radius, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .7, depthWrite: false }));
    mesh.position.y = .04; mesh.visible = false; return mesh;
  }

  private texture(key: string): THREE.Texture {
    let texture = this.textures.get(key);
    if (!texture) { texture = this.loader.load(artUrl(key)); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, this.gl.capabilities.getMaxAnisotropy()); this.textures.set(key, texture); }
    return texture;
  }

  resize(): void {
    if (this.destroyed) return;
    const rect = this.canvas.getBoundingClientRect(); this.width = Math.max(1, Math.round(rect.width)); this.height = Math.max(1, Math.round(rect.height));
    this.gl.setSize(this.width, this.height, false); this.overlay.resize(this.width, this.height, Math.min(devicePixelRatio || 1, 2));
    const aspect = this.width / this.height; this.distance = 28 * Math.max(1, Math.pow(1.3 / aspect, .6));
    const shift = Math.max(0, 112 / 2 - 35);
    this.camera.aspect = aspect; this.camera.setViewOffset(this.width, this.height + shift * 2, 0, shift * 2, this.width, this.height); this.camera.updateProjectionMatrix();
    this.lookId = -1;
  }

  worldToScreen(point: Point, lift = 0): Point {
    this.vector.set(point.x, lift, point.y).project(this.camera); const rect = this.canvas.getBoundingClientRect();
    return { x: (this.vector.x + 1) * this.width / 2 + rect.left, y: (1 - this.vector.y) * this.height / 2 + rect.top };
  }
  screenToWorld(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2((clientX - rect.left) / this.width * 2 - 1, 1 - (clientY - rect.top) / this.height * 2), this.camera);
    const point = this.ray.ray.intersectPlane(this.plane, this.vector);
    return point ? { x: point.x, y: point.z } : { x: this.target.x, y: this.target.z };
  }

  private look(style: string): void {
    const l = LOOKS[style]; this.scene.background = new THREE.Color(l.background); this.scene.fog = new THREE.Fog(l.background, this.distance + l.near, this.distance + l.far);
    this.hemi.color.set(l.sky); this.hemi.groundColor.set(l.ground); this.hemi.intensity = l.hemi;
    this.sun.color.set(l.sun); this.sun.intensity = l.strength; this.torch.intensity = l.torch;
  }

  private changeArea(area: AreaState, point: Point): void {
    this.terrain?.dispose(); this.clearActors(); this.clearDrops(); this.effects.clear(); this.actorAim.clear(); this.hover = null;
    this.terrain = new Terrain(area, key => this.texture(key)); this.scene.add(this.terrain.group); this.groundArea = area;
    this.look(area.def.style); this.target.set(point.x, .5, point.y); this.lastTick = -1; this.shake = 0;
  }

  private actor(uid: string, spec: Spec, x: number, y: number, tick: number, dead = false): Actor {
    let actor = this.actors.get(uid);
    if (actor && actor.key !== specKey(spec)) { actor.dispose(); this.actors.delete(uid); actor = undefined; }
    if (!actor) {
      actor = new Actor(spec); this.actors.set(uid, actor); this.scene.add(actor.group);
      actor.sync(x, y, tick); actor.dead = dead;
      if (dead) actor.update(.6, 1, null);
      return actor;
    }
    actor.sync(x, y, tick); actor.dead = dead; return actor;
  }

  render(state: GameState, time: number): void {
    if (this.destroyed) return;
    const dt = Math.min(.06, Math.max(0, time - this.lastTime)); this.lastTime = time;
    if (state.screen === 'intro') return;
    if (!state.area || !state.player || state.screen !== 'game') {
      this.gl.setClearColor('#141917'); this.gl.clear(); this.overlay.render(state, time, p => p, null); return;
    }
    const area = state.area, player = state.player;
    if (this.groundArea !== area) this.changeArea(area, player);
    if (this.lookId !== area.def.id) { this.look(area.def.id === 5 || area.def.id === 6 ? 'jungle' : area.def.style); this.lookId = area.def.id; }
    if (state.tick !== this.lastTick) { this.tickTime = time; this.lastTick = state.tick; }
    const alpha = clamp((time - this.tickTime) / .04, 0, 1), step = state.paused ? 0 : dt;
    const weapon = player.equipment[player.weaponSwap ? 'weapon2' : 'weapon'], offhand = player.equipment[player.weaponSwap ? 'offhand2' : 'offhand'];
    this.actor('player', playerSpec(player.classId, weapon ? itemArtKey(weapon.code) : null, offhand ? itemArtKey(offhand.code) : null), player.x, player.y, state.tick, player.dead);
    const ids = new Set(['player']);
    for (const m of area.monsters) {
      if (Math.hypot(m.x - player.x, m.y - player.y) >= 22) continue;
      ids.add(m.uid); this.actor(m.uid, monsterSpec(m.code, m.color, m.boss, m.champion), m.x, m.y, state.tick, m.dead);
    }
    for (const o of area.objects) if (o.kind === 'npc' && Math.hypot(o.x - player.x, o.y - player.y) < 22) { ids.add(o.uid); this.actor(o.uid, npcSpec(o.npcId ?? ''), o.x, o.y, state.tick); }
    for (const s of state.summons) { ids.add(s.uid); this.actor(s.uid, summonSpec(s.color), s.x, s.y, state.tick); }
    if (player.corpse && (player.corpse.areaId === area.def.id || area.regions?.some(r => r.def.id === player.corpse!.areaId))) { ids.add('corpse'); this.actor('corpse', playerSpec(player.classId, null, null), player.corpse.x, player.corpse.y, state.tick, true); }
    for (const [uid, actor] of this.actors) if (!ids.has(uid)) { actor.dispose(); this.actors.delete(uid); this.actorAim.delete(uid); }
    if (state.eventSeq < this.lastSeq) this.lastSeq = 0;
    for (const event of state.events) if (event.seq > this.lastSeq) {
      this.lastSeq = event.seq; const a = this.actors.get(event.actor);
      if (event.kind === 'attack' || event.kind === 'cast') {
        a?.trigger(event.kind === 'attack' ? 'melee' : 'cast'); this.actorAim.set(event.actor, { yaw: Math.atan2(event.tx - event.x, event.ty - event.y), until: state.tick + 12 });
      } else if (event.kind === 'hurt') { a?.hit(); if (event.actor === 'player') this.shake = Math.max(this.shake, .12); }
      if (event.kind === 'death' && area.monsters.find(m => m.uid === event.actor)?.boss) this.shake = .45;
      this.effects.event(event);
    }
    for (const [uid, actor] of this.actors) {
      const aim = this.actorAim.get(uid); let yaw: number | null = uid === 'player' ? Math.atan2(Math.cos(state.facing), Math.sin(state.facing)) : null;
      if (uid !== 'player' && aim && aim.until >= state.tick) yaw = aim.yaw;
      else if (uid !== 'player' && actor.speed < .5 && Math.hypot(actor.x - player.x, actor.y - player.y) < 7) yaw = Math.atan2(player.x - actor.x, player.y - actor.y);
      actor.update(step, alpha, yaw);
    }
    const hero = this.actors.get('player')!;
    if (this.target.distanceTo(new THREE.Vector3(hero.x, .5, hero.y)) > 3) this.target.set(hero.x, .5, hero.y);
    else this.target.lerp(new THREE.Vector3(hero.x, .5, hero.y), Math.min(1, dt * 12));
    this.shake *= Math.exp(-dt * 9);
    const elevation = THREE.MathUtils.degToRad(65), horizontal = this.distance * Math.cos(elevation) / Math.SQRT2;
    this.camera.position.set(this.target.x + horizontal + Math.sin(time * 81) * this.shake, this.target.y + this.distance * Math.sin(elevation), this.target.z + horizontal + Math.cos(time * 63) * this.shake);
    this.camera.lookAt(this.target); this.camera.updateMatrixWorld(true);
    this.sun.position.set(this.target.x + 6, 12, this.target.z + 2); this.sun.target.position.copy(this.target);
    this.torch.position.set(hero.x - .4, 2.2, hero.y - .4); this.terrain!.update(player, dt, time);
    this.flameTime += step;
    if (this.flameTime > .06) { this.flameTime %= .06; for (const p of this.terrain!.flames) if (Math.hypot(p.x - player.x, p.z - player.y) < 14) this.effects.emit({ x: p.x, y: p.y, z: p.z, color: '#ffaf54', count: 2, speed: .15, up: 1.5, gravity: 0, life: .6, size: .22 }); }
    for (const effect of state.effects) this.effects.effect(effect);
    this.effects.update(step, this.camera, this.canvas.height, state.projectiles, alpha);
    this.updateDrops(state, time);
    const selected = area.monsters.find(m => m.uid === state.selectedMonster && !m.dead);
    this.selectedRing.visible = !!selected; if (selected) { this.selectedRing.position.set(selected.x, .035, selected.y); this.selectedRing.scale.setScalar(selected.boss ? 1.6 : 1); }
    const hover = area.monsters.find(m => m.uid === this.hover && !m.dead) ?? area.objects.find(o => o.uid === this.hover) ?? area.drops.find(d => d.item.uid === this.hover);
    this.hoverRing.visible = !!hover; if (hover) this.hoverRing.position.set(hover.x, .04, hover.y);
    this.targetRing.visible = !!state.target && !player.dead; if (state.target) this.targetRing.position.set(state.target.x, .035, state.target.y);
    this.gl.render(this.scene, this.camera);
    const rect = this.canvas.getBoundingClientRect();
    this.overlay.render(state, time, (p, lift) => { const s = this.worldToScreen(p, lift); return { x: s.x - rect.left, y: s.y - rect.top }; }, this.hover);
  }

  private updateDrops(state: GameState, time: number): void {
    const ids = new Set<string>();
    for (const drop of state.area!.drops) {
      if (Math.hypot(drop.x - state.player!.x, drop.y - state.player!.y) >= 22) continue;
      const uid = drop.item.uid; ids.add(uid); let visual = this.drops.get(uid);
      if (!visual) {
        const group = new THREE.Group();
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture(itemArtKey(drop.item.code)), transparent: true, depthWrite: false })); sprite.center.set(.5, 0); sprite.scale.set(.65, .65, 1);
        const glow = new THREE.Mesh(new THREE.CircleGeometry(.25, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: QUALITY[drop.item.quality], transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.y = .02;
        const signal = new THREE.Mesh(new THREE.CylinderGeometry(.018, .05, .9, 5), new THREE.MeshBasicMaterial({ color: QUALITY[drop.item.quality], transparent: true, opacity: .36, blending: THREE.AdditiveBlending, depthWrite: false }));
        signal.position.y = .45; signal.visible = ['rare', 'set', 'unique', 'crafted'].includes(drop.item.quality);
        group.add(glow, sprite, signal); this.scene.add(group); visual = { group, sprite, glow, signal, born: time, quality: drop.item.quality }; this.drops.set(uid, visual);
      }
      visual.group.position.set(drop.x, 0, drop.y); const age = time - visual.born;
      visual.sprite.position.y = age < .6 ? Math.abs(Math.sin(age / .6 * Math.PI * 2)) * .35 * (1 - age / .6) : .04;
      (visual.glow.material as THREE.MeshBasicMaterial).opacity = ['rare', 'set', 'unique', 'crafted'].includes(visual.quality) ? .3 + Math.sin(time * 3) * .1 : .15;
    }
    for (const [uid, drop] of this.drops) if (!ids.has(uid)) { this.disposeDrop(drop); this.drops.delete(uid); }
  }
  private disposeDrop(drop: DropVisual): void { drop.sprite.material.dispose(); drop.glow.geometry.dispose(); (drop.glow.material as THREE.Material).dispose(); drop.signal.geometry.dispose(); (drop.signal.material as THREE.Material).dispose(); drop.group.removeFromParent(); }
  private clearDrops(): void { for (const drop of this.drops.values()) this.disposeDrop(drop); this.drops.clear(); }
  private clearActors(): void { for (const actor of this.actors.values()) actor.dispose(); this.actors.clear(); }
  destroy(): void {
    if (this.destroyed) return; this.destroyed = true; this.observer.disconnect(); this.terrain?.dispose(); this.clearActors(); this.clearDrops(); this.effects.dispose(); this.overlay.destroy(); this.overlayCanvas.remove();
    for (const ring of [this.selectedRing, this.hoverRing, this.targetRing]) { ring.geometry.dispose(); (ring.material as THREE.Material).dispose(); }
    for (const texture of this.textures.values()) texture.dispose(); this.textures.clear(); this.gl.dispose(); this.groundArea = null;
  }
}
