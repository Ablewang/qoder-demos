import type { AreaState, Effect, GameState, Monster, Point, Quality } from '../types';
import { artUrl } from '../art';
import { itemLabel } from '../items';

export const QUALITY: Record<Quality, string> = {
  low: '#b5aca1', normal: '#eee8d9', superior: '#eee8d9', magic: '#7c9dff',
  rare: '#f2dc72', set: '#78d88b', unique: '#cfa65c', crafted: '#ed9b59',
};
export const ELEMENT: Record<string, string> = {
  physical: '#c5b99c', fire: '#c9965f', cold: '#98b6c0',
  lightning: '#beb9cd', poison: '#8b9a66', magic: '#929db5',
};

const EFFECT_COLOR: Record<Effect['kind'], string> = {
  fire: '#c99765', cold: '#9cb8c0', lightning: '#c0bacd', poison: '#94a473',
  heal: '#bd947b', level: '#cabb91', hit: '#c7af8b', nova: '#96adb6',
  summon: '#9caa82', portal: '#96afb8', text: '#eee0b8',
};
// Approximate rig heights without coupling this Canvas2D module to Three.js.
const MONSTER_SCALE: Record<string, number> = {
  fallen: 0.62, fallenshaman: 0.66, quillrat: 0.7, brute: 1.3,
  goatman: 1.1, crownest: 0.7, bighead: 0.8, fetish: 0.55,
  andariel: 1.9, bloodraven: 1.05, smith: 1.55,
};
type Project = (point: Point, lift?: number) => Point;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function hash(x: number, y: number, seed = 0): number {
  let n = Math.imul(x + 7919, 374761393) ^ Math.imul(y + 104729, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = color; c.fill();
}

export class Overlay {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private destroyed = false;
  private gate: HTMLImageElement | null = null;
  private gateReady = false;
  private readonly mapCanvas = document.createElement('canvas');
  private mapArea: AreaState | null = null;
  private mapAreaId: number | null = null;
  private mapTick = -Infinity;
  private lastTick = -Infinity;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('浏览器不支持 Canvas 2D');
    this.ctx = context;
    const gate = this.gate = new Image();
    gate.decoding = 'async';
    gate.onload = () => {
      if (!this.destroyed) this.gateReady = gate.naturalWidth > 0 && gate.naturalHeight > 0;
    };
    gate.onerror = () => {
      if (!this.destroyed) console.error(`[Overlay] Artwork failed to load: gate (${gate.src})`);
    };
    gate.src = artUrl('gate');
  }

  resize(w: number, h: number, dpr: number): void {
    if (this.destroyed) return;
    this.width = Number.isFinite(w) ? Math.max(1, w) : 1;
    this.height = Number.isFinite(h) ? Math.max(1, h) : 1;
    this.dpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
    const pixelWidth = Math.max(1, Math.round(this.width * this.dpr));
    const pixelHeight = Math.max(1, Math.round(this.height * this.dpr));
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  render(state: GameState, time: number, project: Project, hover: string | null): void {
    if (this.destroyed) return;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.shadowBlur = 0; c.filter = 'none'; c.lineWidth = 1;
    c.textBaseline = 'alphabetic';
    if (state.tick < this.lastTick) this.mapTick = -Infinity;
    this.lastTick = state.tick;
    if (state.screen === 'intro') return;
    const area = state.area, player = state.player;
    if (state.screen !== 'game' || !area || !player) {
      this.titleScene(time);
      return;
    }

    for (const object of area.objects) {
      if (Math.hypot(object.x - player.x, object.y - player.y) > 7) continue;
      const lift = object.kind === 'npc' ? 2.05 : object.kind === 'exit' ? 1.5 : 0.8;
      const p = project(object, lift);
      this.label(p.x, p.y, object.name, object.kind === 'exit' ? '#d3c58b' : '#e0d4ad', hover === object.uid);
    }
    for (const monster of area.monsters) {
      const selected = state.selectedMonster === monster.uid, hovered = hover === monster.uid;
      const distance = Math.hypot(monster.x - player.x, monster.y - player.y);
      if (monster.dead || monster.life <= 0 || distance > 18 || !area.revealed[Math.floor(monster.y)]?.[Math.floor(monster.x)] || !(distance < 7 || monster.life < monster.maxLife || monster.boss || selected || hovered)) continue;
      const scale = this.monsterScale(monster);
      const p = project(monster, 1.9 * scale);
      this.smallBar(p.x, p.y, monster.life / monster.maxLife, monster.boss ? '#b28343' : '#a44636', hovered || selected);
    }
    for (const summon of state.summons) {
      if (summon.life <= 0) continue;
      const p = project(summon, 1.9 * 0.9);
      this.smallBar(p.x, p.y, summon.life / summon.maxLife, '#75ae89', hover === summon.uid);
    }
    for (const effect of state.effects) {
      // World particles and non-text effects belong to the WebGL renderer.
      if (effect.life > 0 && (effect.kind === 'text' || effect.text)) this.floatingText(effect, project);
    }
    for (const drop of area.drops) {
      if (!state.showLoot && Math.hypot(drop.x - player.x, drop.y - player.y) >= 2.8) continue;
      const p = project(drop, 0.4);
      this.label(p.x, p.y, itemLabel(drop.item), QUALITY[drop.item.quality], hover === drop.item.uid);
    }
    if (player.corpse && (player.corpse.areaId === area.def.id || area.regions?.some(r => r.def.id === player.corpse!.areaId))) {
      const p = project(player.corpse, 0.4);
      this.label(p.x, p.y, '你的遗体', '#d5d0c2');
    }
    this.refreshMap(state, area);
    this.minimap(area, player);
    if (state.automap) this.automap(area, player);
  }

  private fits(x: number, y: number, w: number, h: number): boolean {
    return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x + w <= this.width && y + h <= this.height;
  }

  private label(x: number, y: number, text: string, color: string, highlighted = false): void {
    if (!text || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const c = this.ctx;
    c.save(); c.font = '13px "Microsoft YaHei", "PingFang SC", sans-serif'; c.textAlign = 'center';
    const w = Math.min(260, c.measureText(text).width + 16);
    if (this.fits(x - w / 2 - 0.5, y - 13.5, w + 1, 22)) {
      c.fillStyle = '#0a100ddb'; c.fillRect(x - w / 2, y - 13, w, 21);
      c.strokeStyle = highlighted ? '#f3d79bdc' : `${color}80`;
      c.strokeRect(x - w / 2, y - 13, w, 21);
      c.fillStyle = color; c.fillRect(x - w / 2 + 1, y - 12, 2, 19);
      c.fillStyle = color; c.fillText(text, x, y + 2, w - 16);
    }
    c.restore();
  }

  private monsterScale(monster: Monster): number {
    const base = monster.code.replace(/\d+$/, '');
    return (MONSTER_SCALE[base] ?? 1) * (monster.boss ? 1.15 : monster.champion ? 1.1 : 1);
  }

  private smallBar(x: number, y: number, ratio: number, color: string, highlighted = false): void {
    if (!this.fits(x - 22, y - 1, 44, 7)) return;
    const c = this.ctx;
    c.save(); c.fillStyle = '#0b100c'; c.fillRect(x - 21, y, 42, 5);
    c.fillStyle = color; c.fillRect(x - 20, y + 1, 40 * clamp(ratio || 0, 0, 1), 3);
    if (highlighted) {
      c.strokeStyle = '#d8c17abb'; c.strokeRect(x - 21.5, y - 0.5, 43, 6);
    }
    c.restore();
  }

  private floatingText(effect: Effect, project: Project): void {
    const text = effect.text || '';
    if (!text) return;
    const progress = 1 - clamp(effect.life / (effect.maxLife || 1), 0, 1);
    const p = project(effect, 1.6 + 0.6 * progress), c = this.ctx;
    c.save(); c.font = '600 15px "Noto Serif SC", "Songti SC", serif'; c.textAlign = 'center';
    const metrics = c.measureText(text), w = metrics.width;
    const ascent = metrics.actualBoundingBoxAscent || 15, descent = metrics.actualBoundingBoxDescent || 4;
    if (this.fits(p.x - w / 2 - 2, p.y - ascent - 2, w + 4, ascent + descent + 4)) {
      c.globalAlpha = clamp(effect.life / Math.max(1, effect.maxLife * 0.25), 0, 1);
      c.lineWidth = 3; c.strokeStyle = '#111c16'; c.strokeText(text, p.x, p.y);
      c.fillStyle = effect.color || EFFECT_COLOR[effect.kind]; c.fillText(text, p.x, p.y);
    }
    c.restore();
  }

  private refreshMap(state: GameState, area: AreaState): void {
    if (this.mapArea === area && this.mapAreaId === area.def.id && state.tick - this.mapTick < 15
      && this.mapCanvas.width === area.width * 3 && this.mapCanvas.height === area.height * 3) return;
    this.mapArea = area; this.mapAreaId = area.def.id; this.mapTick = state.tick;
    this.mapCanvas.width = area.width * 3; this.mapCanvas.height = area.height * 3;
    const c = this.mapCanvas.getContext('2d');
    if (!c) return;
    for (let y = 0; y < area.height; y++) for (let x = 0; x < area.width; x++) {
      if (!area.revealed[y]?.[x]) continue;
      c.fillStyle = (area.tiles[y]?.[x] ?? 0) === 1 ? '#69705d99' : '#bab99266';
      c.fillRect(x * 3, y * 3, 2.5, 2.5);
    }
  }

  private mapMarkers(area: AreaState, player: Point, expanded: boolean): void {
    const c = this.ctx;
    for (const object of area.objects) {
      if (!area.revealed[Math.floor(object.y)]?.[Math.floor(object.x)]) continue;
      c.fillStyle = object.kind === 'exit' ? '#e7c37a' : object.kind === 'waypoint' || object.kind === 'portal' ? '#7fcef0' : '#b3b9a5';
      const size = expanded ? 4 : 5, x = (object.x - player.x) * 3, y = (object.y - player.y) * 3;
      c.strokeStyle = c.fillStyle; c.lineWidth = 1;
      if (object.seam) { c.beginPath(); c.moveTo(x - size, y + size); c.lineTo(x + size, y - size); c.lineTo(x + size, y + 1); c.moveTo(x + size, y - size); c.lineTo(x - 1, y - size); c.stroke(); }
      else if (object.kind === 'exit') c.strokeRect(x - size / 2, y - size / 2, size, size);
      else if (object.kind === 'waypoint') { c.beginPath(); c.moveTo(x, y - size); c.lineTo(x + size, y); c.lineTo(x, y + size); c.lineTo(x - size, y); c.closePath(); c.stroke(); }
      else c.fillRect(x - size / 2, y - size / 2, size, size);
    }
    const size = expanded ? 3 : 5;
    c.fillStyle = expanded ? '#fff1b8' : '#f6e9bd'; c.fillRect(-size / 2, -size / 2, size, size);
  }

  private minimap(area: AreaState, player: Point): void {
    const c = this.ctx, size = this.width < 700 ? 96 : 140;
    const x = this.width - size - 12, y = 76;
    c.save(); c.fillStyle = '#09100ddd'; c.fillRect(x, y, size, size);
    c.strokeStyle = '#8f7b4c88'; c.strokeRect(x, y, size, size);
    c.beginPath(); c.rect(x + 4, y + 4, size - 8, size - 8); c.clip();
    c.translate(x + size / 2, y + size / 2); c.scale(1, 0.8); c.rotate(Math.PI / 4);
    c.drawImage(this.mapCanvas, -player.x * 3, -player.y * 3);
    this.mapMarkers(area, player, false); c.restore();
    c.save(); c.font = '11px "PingFang SC", sans-serif'; c.fillStyle = '#c8bc97'; c.textAlign = 'right';
    c.fillText('已探索区域 · TAB', x + size - 4, y + size + 17); c.restore();
  }

  private automap(area: AreaState, player: Point): void {
    const c = this.ctx, mapHeight = Math.max(0, this.height - 135);
    const scale = Math.min(8, Math.max(1, this.width - 70) / Math.max(1, area.width, area.height));
    c.save(); c.fillStyle = '#050b0c9c'; c.fillRect(0, 0, this.width, mapHeight);
    c.beginPath(); c.rect(0, 0, this.width, mapHeight); c.clip();
    c.translate(this.width / 2, Math.max(0, this.height - 130) / 2);
    c.scale(scale / 3, scale / 3); c.scale(1, 0.8); c.rotate(Math.PI / 4);
    c.drawImage(this.mapCanvas, -player.x * 3, -player.y * 3);
    this.mapMarkers(area, player, true); c.restore();
    this.label(this.width / 2, 130, '探索地图 · 再按 Tab 关闭', '#d6c896');
  }

  private titleScene(time: number): void {
    const c = this.ctx, w = this.width, h = this.height, gate = this.gateReady ? this.gate : null;
    c.fillStyle = '#181714'; c.fillRect(0, 0, w, h);
    if (gate) {
      const scale = Math.max(w / gate.naturalWidth, h / gate.naturalHeight);
      const iw = gate.naturalWidth * scale, ih = gate.naturalHeight * scale;
      c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(gate, (w - iw) / 2, (h - ih) / 2, iw, ih); c.restore();
    } else {
      const bg = c.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#30312d'); bg.addColorStop(1, '#0e0e0c'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    }
    const mist = c.createLinearGradient(0, h * 0.35, 0, h);
    mist.addColorStop(0, '#aaa79c00'); mist.addColorStop(0.5, '#aaa79c08'); mist.addColorStop(1, '#0908068c');
    c.fillStyle = mist; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const t = (time * 0.035 + hash(i, 76)) % 1;
      ellipse(c, hash(i, 77) * w + Math.sin(time * 0.3 + i) * 14, h * (0.83 - t * 0.5), 0.8, 1.4,
        `rgba(194,150,93,${Math.sin(t * Math.PI) * 0.42})`);
    }
    const radius = Math.max(w, h) * 0.75;
    const shade = c.createRadialGradient(w / 2, h * 0.44, radius * 0.1, w / 2, h * 0.5, radius);
    shade.addColorStop(0, '#09080608'); shade.addColorStop(1, '#090806b0');
    c.fillStyle = shade; c.fillRect(0, 0, w, h);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.gate) { this.gate.onload = null; this.gate.onerror = null; }
    this.gate = null; this.gateReady = false;
    this.mapArea = null; this.mapAreaId = null; this.mapTick = this.lastTick = -Infinity;
    this.mapCanvas.width = 0; this.mapCanvas.height = 0;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
