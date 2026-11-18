import type { AreaState, GameState, Monster, Point, WorldObject, Quality } from './types';
import { artUrl, heroArtKey, itemArtKey } from './art';

const TW = 96, TH = 48;
const GROUND_ART: Record<string, string> = { grass: 'earth', town: 'flagstone', jungle: 'earth', desert: 'sand', snow: 'snow', hell: 'volcanic', cave: 'basalt', dungeon: 'flagstone' };
const GROUND_IMAGES = new Set(Object.values(GROUND_ART));
interface LoadedArt { image: HTMLImageElement; ready: boolean }
const QUALITY: Record<Quality, string> = { low: '#b5aca1', normal: '#eee8d9', superior: '#eee8d9', magic: '#7c9dff', rare: '#f2dc72', set: '#78d88b', unique: '#cfa65c', crafted: '#ed9b59' };
const ELEMENT: Record<string, string> = { physical: '#c5b99c', fire: '#c9965f', cold: '#98b6c0', lightning: '#beb9cd', poison: '#8b9a66', magic: '#929db5' };
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
function hash(x: number, y: number, seed = 0): number {
  let n = Math.imul(x + 7919, 374761393) ^ Math.imul(y + 104729, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function path(c: CanvasRenderingContext2D, points: number[], fill: string, stroke?: string) {
  c.beginPath(); c.moveTo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i]!, points[i + 1]!);
  c.closePath(); c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.stroke(); }
}
function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string | CanvasGradient) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = color; c.fill();
}
interface Drawable { depth: number; paint: () => void }

/** All public screen coordinates are client/CSS pixels, including the canvas rect. */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private camera: Point = { x: 0, y: 0 };
  private origin: Point = { x: 0, y: 0 };
  private readonly tiles = new Map<string, HTMLCanvasElement>();
  private readonly sprites = new Map<string, HTMLCanvasElement>();
  private readonly images = new Map<string, LoadedArt>();
  private groundCanvas = document.createElement('canvas');
  private groundSpare = document.createElement('canvas');
  private groundArea: AreaState | null = null;
  private groundCamera: Point = { x: 0, y: 0 };
  private readonly lightCanvas = document.createElement('canvas');
  private lightStyle = '';
  private destroyed = false;
  private mapCanvas = document.createElement('canvas');
  private mapArea: AreaState | null = null;
  private mapTick = -100;
  private time = 0;
  private resizeObserver: ResizeObserver | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('浏览器不支持 Canvas 2D');
    this.ctx = context;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }
    this.resize();
    for (const name of ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass', 'traveler', 'fallen', 'skeleton', 'zombie', 'quill', 'tree', 'ruin', 'cottage', 'chest', 'gate', ...GROUND_IMAGES]) this.art(name);
  }

  private art(name: string): HTMLImageElement | null {
    if (this.destroyed) return null;
    let entry = this.images.get(name);
    if (!entry) {
      const image = new Image();
      entry = { image, ready: false };
      const loaded = entry;
      this.images.set(name, loaded);
      image.decoding = 'async';
      image.onload = () => {
        loaded.ready = image.naturalWidth > 0 && image.naturalHeight > 0;
        if (GROUND_IMAGES.has(name)) { this.tiles.clear(); this.groundArea = null; }
      };
      image.onerror = () => console.error(`[Renderer] Artwork failed to load: ${name} (${image.src})`);
      image.src = artUrl(name);
    }
    return entry.ready ? entry.image : null;
  }

  /** Cropped original sprites keep their aspect ratio and their feet on the projected ground. */
  private drawArt(name: string, x: number, footY: number, height: number, filter = 'none'): boolean {
    const image = this.art(name);
    if (!image) return false;
    const c = this.ctx, ratio = image.naturalWidth / image.naturalHeight;
    const transform = c.getTransform();
    const pixelHeight = Math.ceil(height * Math.max(Math.hypot(transform.a, transform.b), Math.hypot(transform.c, transform.d)));
    const key = `${name}:${pixelHeight}:${filter}`;
    let sprite = this.sprites.get(key);
    if (!sprite) {
      const scaled = document.createElement('canvas');
      scaled.height = pixelHeight; scaled.width = Math.ceil(pixelHeight * ratio);
      const scaledContext = scaled.getContext('2d')!;
      scaledContext.imageSmoothingQuality = 'high';
      scaledContext.drawImage(image, 0, 0, scaled.width, scaled.height);
      sprite = scaled;
      if (filter !== 'none') {
        sprite = document.createElement('canvas');
        sprite.width = scaled.width; sprite.height = scaled.height;
        const filteredContext = sprite.getContext('2d')!;
        // Filtering the original large image on every draw forces costly raster work.
        filteredContext.filter = filter;
        filteredContext.drawImage(scaled, 0, 0);
      }
      if (this.sprites.size >= 256) this.sprites.delete(this.sprites.keys().next().value!);
      this.sprites.set(key, sprite);
    }
    const width = height * ratio;
    c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(sprite, x - width / 2, footY - height, width, height);
    c.restore();
    return true;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width || window.innerWidth);
    this.height = Math.max(1, rect.height || window.innerHeight);
    const dpr = this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.width * dpr), h = Math.round(this.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
      this.groundArea = null; this.lightStyle = '';
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.origin = { x: this.width / 2, y: Math.max(140, (this.height - (this.width < 700 ? 120 : 154)) / 2 + 35) };
  }

  worldToScreen(point: Point): Point {
    const p = this.project(point), rect = this.canvas.getBoundingClientRect();
    return { x: p.x + rect.left, y: p.y + rect.top };
  }

  screenToWorld(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    return this.unproject(clientX - rect.left, clientY - rect.top);
  }

  private project(point: Point): Point {
    const x = point.x - this.camera.x, y = point.y - this.camera.y;
    return { x: (x - y) * TW / 2 + this.origin.x, y: (x + y) * TH / 2 + this.origin.y };
  }

  private unproject(x: number, y: number): Point {
    x -= this.origin.x; y -= this.origin.y;
    return { x: x / TW + y / TH + this.camera.x, y: y / TH - x / TW + this.camera.y };
  }

  render(state: GameState, elapsedSeconds: number): void {
    if (state.screen === 'intro') return;
    this.time = elapsedSeconds;
    const c = this.ctx;
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (!state.area || !state.player || state.screen !== 'game') { this.titleScene(); return; }
    const area = state.area, player = state.player;
    this.camera = { x: player.x, y: player.y };
    const bg = c.createLinearGradient(0, 0, 0, this.height);
    bg.addColorStop(0, '#191a17'); bg.addColorStop(1, '#292820');
    c.fillStyle = bg; c.fillRect(0, 0, this.width, this.height);
    this.ground(area);
    const corners = [this.unproject(-180, -210), this.unproject(this.width + 180, -210), this.unproject(-180, this.height + 180), this.unproject(this.width + 180, this.height + 180)];
    const x0 = clamp(Math.floor(Math.min(...corners.map(p => p.x))), 0, area.width - 1);
    const x1 = clamp(Math.ceil(Math.max(...corners.map(p => p.x))), 0, area.width - 1);
    const y0 = clamp(Math.floor(Math.min(...corners.map(p => p.y))), 0, area.height - 1);
    const y1 = clamp(Math.ceil(Math.max(...corners.map(p => p.y))), 0, area.height - 1);
    const drawables: Drawable[] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = this.project({ x, y });
      if (p.x < -150 || p.x > this.width + 150 || p.y < -160 || p.y > this.height + 80) continue;
      const tile = area.tiles[y]?.[x] ?? 0;
      const n = hash(x, y, area.seed ^ 319);
      // Solid terrain receives large scenery; walkable terrain only small ground dressing.
      if (tile === 1 || tile === 2) {
        if (area.def.town && x > 0 && y > 0 && x < area.width - 1 && y < area.height - 1) {
          // One roof per building block rather than a house on every solid cell.
          if (x % 3 === 1 && y % 3 === 1) drawables.push({ depth: x + y + 0.1, paint: () => this.roof(p, n) });
          else if (n < 0.1) drawables.push({ depth: x + y, paint: () => this.ruin(p, n, false) });
        } else drawables.push({ depth: x + y + 0.1, paint: () => this.scenery(p, area.def.style, n, tile) });
      } else if (n < 0.012 && this.farFromObjects(area, x, y)) {
        drawables.push({ depth: x + y, paint: () => this.ruin(p, n, false) });
      }
    }
    const visible = (p: Point) => { const q = this.project(p); return q.x > -100 && q.x < this.width + 100 && q.y > -120 && q.y < this.height + 120; };
    for (const o of area.objects) if (visible(o)) drawables.push({ depth: o.x + o.y + 0.2, paint: () => this.object(o, player) });
    for (const m of area.monsters) if (visible(m)) drawables.push({ depth: m.x + m.y, paint: () => this.monster(m, state.selectedMonster === m.uid) });
    for (const summon of state.summons) if (visible(summon)) drawables.push({ depth: summon.x + summon.y, paint: () => {
      const p = this.project(summon); this.humanoid(p.x, p.y, summon.color || '#719b92', 'nec', Math.sin(this.time * 6), false, false);
      this.smallBar(p.x, p.y - 78, summon.life / summon.maxLife, '#75ae89');
    } });
    drawables.push({ depth: player.x + player.y + 0.05, paint: () => {
      const p = this.project(player);
      ellipse(c, p.x, p.y + 1, 19, 9, '#0008');
      if (player.dead) { ellipse(c, p.x, p.y - 2, 21, 8, '#5d4033'); return; }
      const moving = state.target !== null && Math.hypot(state.target.x - player.x, state.target.y - player.y) > 0.2;
      this.humanoid(p.x, p.y, this.classColor(player.classId), player.classId, moving ? Math.sin(this.time * (player.running ? 12 : 8)) : Math.sin(this.time * 2) * 0.1, true, moving);
      if (player.mercenary) this.humanoid(p.x - 34, p.y - 12, '#817658', 'traveler', Math.sin(this.time * 5) * 0.15, false, false);
    } });
    for (const drop of area.drops) if (visible(drop)) drawables.push({ depth: drop.x + drop.y + 0.3, paint: () => {
      const p = this.project(drop), color = QUALITY[drop.item.quality];
      ellipse(c, p.x, p.y - 1, 9, 3, '#0009');
      if (!this.drawArt(itemArtKey(drop.item.code), p.x, p.y + 1, 17, 'brightness(1.2) saturate(0.85)')) {
        path(c, [p.x - 5, p.y - 4, p.x + 4, p.y - 7, p.x + 7, p.y - 2, p.x - 3, p.y + 1], '#98835e', color);
      }
    } });
    drawables.sort((a, b) => a.depth - b.depth); for (const d of drawables) d.paint();
    for (const projectile of state.projectiles) {
      const p = this.project(projectile), color = ELEMENT[projectile.element] || '#ddd';
      c.save(); c.globalAlpha = 0.9; c.shadowBlur = 6; c.shadowColor = color; c.strokeStyle = color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(p.x - (projectile.dx - projectile.dy) * 22, p.y - (projectile.dx + projectile.dy) * 11 - 20); c.lineTo(p.x, p.y - 20); c.stroke();
      ellipse(c, p.x, p.y - 20, 4, 3, '#fff1d1'); c.restore();
    }
    for (const effect of state.effects) this.effect(effect);
    this.lighting(area.def.style);
    if (state.target && !player.dead) {
      const p = this.project(state.target); c.strokeStyle = '#ceb77a88'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(p.x, p.y, 11, 5, 0, 0, Math.PI * 2); c.stroke();
    }
    for (const drop of area.drops) if (visible(drop) && (state.showLoot || Math.hypot(drop.x - player.x, drop.y - player.y) < 2.8)) {
      const p = this.project(drop); this.label(p.x, p.y - 15, drop.item.name || drop.item.code, QUALITY[drop.item.quality]);
    }
    if (player.corpse && player.corpse.areaId === area.def.id) {
      const p = this.project(player.corpse); ellipse(c, p.x, p.y - 1, 18, 6, '#88745f'); this.label(p.x, p.y - 20, '你的遗体', '#d5d0c2');
    }
    this.minimap(state);
    if (state.automap) this.automap(state);
  }

  private ground(area: AreaState) {
    const margin = 192, dpr = this.pixelRatio;
    const anchor = this.project(this.groundCamera);
    let dx = anchor.x - this.origin.x, dy = anchor.y - this.origin.y;
    if (this.groundArea !== area || Math.abs(dx) > margin / 2 || Math.abs(dy) > margin / 2) {
      const old = this.groundCanvas;
      const width = Math.ceil((this.width + margin * 2) * dpr), height = Math.ceil((this.height + margin * 2) * dpr);
      const reuse = this.groundArea === area && old.width === width && old.height === height;
      const shiftX = Math.round(dx * dpr) / dpr, shiftY = Math.round(dy * dpr) / dpr;
      this.groundCamera = reuse ? {
        x: this.groundCamera.x - shiftX / TW - shiftY / TH,
        y: this.groundCamera.y - shiftY / TH + shiftX / TW,
      } : { ...this.camera };
      this.groundArea = area;
      const anchor = this.project(this.groundCamera);
      dx = anchor.x - this.origin.x; dy = anchor.y - this.origin.y;
      this.groundCanvas = this.groundSpare; this.groundSpare = old;
      if (this.groundCanvas.width !== width) this.groundCanvas.width = width;
      if (this.groundCanvas.height !== height) this.groundCanvas.height = height;
      const c = this.groundCanvas.getContext('2d')!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, width / dpr, height / dpr);
      c.save();
      if (reuse) {
        // Copy aligned pixels and rasterize only newly exposed edges during movement.
        c.drawImage(old, shiftX, shiftY, width / dpr, height / dpr);
        c.beginPath(); c.rect(0, 0, width / dpr, height / dpr);
        c.rect(shiftX, shiftY, width / dpr, height / dpr); c.clip('evenodd');
      }
      const corners = [this.unproject(-margin - TW, -margin - TH), this.unproject(this.width + margin + TW, -margin - TH), this.unproject(-margin - TW, this.height + margin + TH), this.unproject(this.width + margin + TW, this.height + margin + TH)];
      const x0 = clamp(Math.floor(Math.min(...corners.map(p => p.x))), 0, area.width - 1);
      const x1 = clamp(Math.ceil(Math.max(...corners.map(p => p.x))), 0, area.width - 1);
      const y0 = clamp(Math.floor(Math.min(...corners.map(p => p.y))), 0, area.height - 1);
      const y1 = clamp(Math.ceil(Math.max(...corners.map(p => p.y))), 0, area.height - 1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const p = this.project({ x, y });
        if (p.x < -margin - TW || p.x > this.width + margin + TW || p.y < -margin - TH || p.y > this.height + margin + TH) continue;
        const tile = area.tiles[y]?.[x] ?? 0;
        const variant = Math.floor(hash(x, y, area.seed) * 12);
        c.drawImage(this.terrain(area.def.style, tile, variant), p.x + margin - dx - TW / 2 - 1, p.y + margin - dy - TH / 2 - 1);
      }
      c.restore();
    }
    this.ctx.drawImage(this.groundCanvas, (margin - dx) * dpr, (margin - dy) * dpr, this.width * dpr, this.height * dpr, 0, 0, this.width, this.height);
  }

  private terrain(style: string, tile: number, variant: number): HTMLCanvasElement {
    const key = `${style}:${tile}:${variant}`;
    const cached = this.tiles.get(key); if (cached) return cached;
    const canvas = document.createElement('canvas'); canvas.width = TW + 2; canvas.height = TH + 2;
    const c = canvas.getContext('2d')!;
    const base = ({ grass: '#363a2c', town: '#484337', jungle: '#303a2c', desert: '#75644e', snow: '#7b8583', hell: '#42332c', cave: '#383936', dungeon: '#46433d' } as Record<string, string>)[style] || '#363a2c';
    const surface = tile === 3 && !['desert', 'snow', 'hell'].includes(style) ? 'flagstone' : GROUND_ART[style] || 'earth';
    const image = this.art(surface);
    c.save(); path(c, [49, 0, 98, 25, 49, 50, 0, 25], base); c.clip();
    if (image) {
      // Project a square of worn ground onto the same 2:1 diamond as world coordinates.
      // The source textures have mirrored edges; avoid random rotations or high-contrast tile tints.
      c.save(); c.transform(49 / 128, 25 / 128, -49 / 128, 25 / 128, 49, 0);
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(image, 0, 0, 128, 128); c.restore();
      c.fillStyle = `rgba(17,16,13,${0.035 + (variant % 4) * 0.009})`; c.fillRect(0, 0, 98, 50);
      if (style === 'jungle') { c.fillStyle = '#26382718'; c.fillRect(0, 0, 98, 50); }
      if (tile === 1 || tile === 2) { c.fillStyle = '#1817130c'; c.fillRect(0, 0, 98, 50); }
    } else {
      // A cheap cached fallback is discarded when its ground texture arrives.
      for (let i = 0; i < 32; i++) {
        c.fillStyle = i % 2 ? '#b0a48712' : '#15181330';
        c.fillRect(hash(i, variant, 55) * 98, hash(variant, i, 23) * 50, 2, 1);
      }
    }
    c.restore(); this.tiles.set(key, canvas); return canvas;
  }

  private farFromObjects(area: AreaState, x: number, y: number): boolean {
    return area.objects.every(o => Math.hypot(o.x - x, o.y - y) > 2.3) && Math.hypot(area.spawn.x - x, area.spawn.y - y) > 3;
  }

  private scenery(p: Point, style: string, n: number, tile: number) {
    if (style === 'town' && n > 0.65) { this.roof(p, n); return; }
    if (['grass', 'jungle', 'town', 'snow'].includes(style) && (tile === 1 || n > 0.35)) { this.tree(p, n, style === 'snow'); return; }
    this.ruin(p, n, true);
  }

  private tree(p: Point, n: number, snow = false) {
    const c = this.ctx, h = 112 + n * 16;
    ellipse(c, p.x + 7, p.y + 3, 30, 11, '#090b095c');
    if (this.drawArt('tree', p.x, p.y + 5, h, snow ? 'saturate(0.25) brightness(1.28)' : 'saturate(0.45) brightness(1.06)')) return;
    c.save(); c.translate(p.x, p.y);
    path(c, [-5, 3, -3, -h * 0.8, 3, -h * 0.9, 7, 3], '#494033');
    ellipse(c, -8, -h * 0.68, 26, 23, snow ? '#7e8983' : '#343d2d');
    ellipse(c, 9, -h * 0.46, 32, 21, snow ? '#747e78' : '#30382b'); c.restore();
  }

  private ruin(p: Point, n: number, large: boolean) {
    const c = this.ctx, h = large ? 55 + n * 10 : 18 + n * 5;
    ellipse(c, p.x + 4, p.y + 3, large ? 24 : 12, large ? 8 : 4, '#0005');
    if (this.drawArt('ruin', p.x, p.y + 6, h, 'saturate(0.75) brightness(1.06)')) return;
    c.save(); c.translate(p.x, p.y);
    path(c, [-h * 0.3, 0, -h * 0.3, -h, 0, -h - 3, h * 0.3, -h + 5, h * 0.3, 0, 0, 6], '#58574f', '#2e302a');
    path(c, [0, -h + 7, h * 0.3, -h + 5, h * 0.3, 0, 0, 6], '#41433c'); c.restore();
  }

  private roof(p: Point, n: number) {
    const c = this.ctx; c.save(); c.translate(p.x, p.y);
    ellipse(c, 8, 6, 55, 19, '#0006');
    if (!this.drawArt('cottage', 0, 14, 126 + n * 8, 'saturate(0.8) brightness(1.06)')) {
      path(c, [-48, 0, -48, -54, 0, -32, 48, -54, 48, 0, 0, 14], '#595245', '#2e2c26');
      path(c, [-58, -54, -4, -112, 58, -65, 0, -30], '#594638', '#29241e');
      path(c, [0, -30, 58, -65, 48, -54, 0, -32], '#70604b');
    }
    if (n > 0.8) this.brazier(46, 13, n); c.restore();
  }

  private classColor(id: string): string {
    return ({ ama: '#8d734a', sor: '#6787a4', nec: '#82958a', pal: '#bdac70', bar: '#987158', dru: '#897147', ass: '#987b98' } as Record<string, string>)[id] || '#a59b75';
  }

  private humanoid(x: number, y: number, color: string, id: string, stride: number, hero: boolean, moving: boolean) {
    const c = this.ctx, h = hero ? 80 : 70;
    ellipse(c, x + 3, y + 2, hero ? 18 : 15, 6, '#0007');
    // These are single pre-rendered poses, not directional animation frames.
    const bob = moving ? stride * 1.1 : 0;
    if (this.drawArt(heroArtKey(id), x, y + 1 + bob, h, hero ? 'brightness(1.16) saturate(0.85)' : 'brightness(1.1) saturate(0.8)')) return;
    c.save(); c.translate(x, y + bob);
    path(c, [-9, -h + 20, -15, -7, -5, -2, 0, -13, 6, -2, 15, -7, 9, -h + 20], color, '#242822');
    ellipse(c, 0, -h + 12, 7, 9, '#aa967c');
    path(c, [-9, -h + 13, -6, -h, 4, -h + 1, 9, -h + 13], '#4c4c40');
    c.strokeStyle = '#81745b'; c.lineWidth = 2; c.beginPath(); c.moveTo(17, 0); c.lineTo(20, -h + 4); c.stroke(); c.restore();
  }

  private monster(m: Monster, selected: boolean) {
    const c = this.ctx, p = this.project(m), phase = hash(m.uid.length, Math.floor(m.x * 13), 29) * 6;
    if (m.dead) { ellipse(c, p.x, p.y, m.boss ? 24 : 13, 5, '#54352b'); path(c, [p.x - 8, p.y - 3, p.x + 8, p.y - 5, p.x + 3, p.y + 4], '#73614a'); return; }
    const kind = `${m.code} ${m.name}`.toLowerCase();
    const quill = /quill|spike|rat|刺|鼠/.test(kind), skeleton = /skeleton|skel|骨/.test(kind), zombie = /zomb|undead|尸/.test(kind), fallen = /fall|imp|沉沦|魔童/.test(kind);
    // Unrepresented families (including bosses) deliberately share a fallen placeholder.
    const name = quill ? 'quill' : skeleton ? 'skeleton' : zombie ? 'zombie' : 'fallen';
    const h = quill ? 35 : skeleton || zombie ? 68 : 52, scale = m.boss ? 1.7 : 1;
    c.save(); c.translate(p.x, p.y); c.scale(scale, scale);
    ellipse(c, 3, 2, quill ? 19 : 17, 6, '#0008');
    c.lineWidth = 1;
    if (selected) { c.strokeStyle = '#d0b580'; c.beginPath(); c.ellipse(0, 1, 21, 9, 0, 0, Math.PI * 2); c.stroke(); }
    if (m.champion) { c.strokeStyle = '#8593b6'; c.beginPath(); c.ellipse(0, 1, 24, 10, 0, 0, Math.PI * 2); c.stroke(); }
    if (m.chill > 0) { c.strokeStyle = '#9cbfc9bb'; c.beginPath(); c.ellipse(0, 0, 14, 5, 0, 0, Math.PI * 2); c.stroke(); }
    if (m.poison > 0) { c.strokeStyle = '#91a969bb'; c.beginPath(); c.ellipse(0, 1, 17, 6, 0, 0, Math.PI * 2); c.stroke(); }
    const bob = Math.sin(this.time * (fallen ? 6 : 3) + phase) * 0.6;
    c.save();
    if (m.chill > 0 || m.poison > 0) { c.shadowColor = m.chill > 0 ? '#88aeba' : '#8b9c5f'; c.shadowBlur = 5; }
    const filter = m.chill > 0 ? 'saturate(0.45) brightness(1.2)' : m.poison > 0 ? 'sepia(0.35) saturate(0.7) brightness(1.12)' : 'saturate(0.85) brightness(1.14)';
    if (!this.drawArt(name, 0, 1 + bob, h, filter)) {
      const color = m.chill > 0 ? '#7895a2' : m.poison > 0 ? '#7e8b59' : skeleton ? '#b1ad95' : zombie ? '#757965' : fallen ? '#894a39' : m.color || '#866553';
      if (quill) {
        ellipse(c, 0, -11 + bob, 18, 10, color);
        for (let i = 0; i < 5; i++) path(c, [-14 + i * 6, -14 + bob, -12 + i * 6, -h + bob, -8 + i * 6, -14 + bob], '#9a9279');
      } else {
        path(c, [-8, -h + 18 + bob, -12, -9 + bob, -5, 1 + bob, 0, -10 + bob, 6, 1 + bob, 11, -9 + bob, 8, -h + 18 + bob], color, '#292a23');
        ellipse(c, 0, -h + 9 + bob, 7, 8, color);
      }
    }
    c.restore(); c.restore();
    // Never skip selection/champion cues or health bars when a sprite is ready.
    if (selected || m.life < m.maxLife || m.boss) this.smallBar(p.x, p.y - h * scale - 8, m.life / m.maxLife, m.boss ? '#b28343' : '#a44636');
  }

  private object(o: WorldObject, player: Point) {
    const p = this.project(o), c = this.ctx;
    c.save(); c.translate(p.x, p.y);
    if (o.kind === 'npc') {
      this.humanoid(0, 0, '#837b67', 'traveler', 0, false, false);
    } else if (o.kind === 'portal') {
      ellipse(c, 0, 2, 30, 10, '#71899424');
      c.save(); c.shadowColor = '#7799a7'; c.shadowBlur = 9;
      c.strokeStyle = '#9cb2b8'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, -34, 21 + Math.sin(this.time * 2), 36, 0, 0, Math.PI * 2); c.stroke();
      const g = c.createRadialGradient(0, -34, 2, 0, -34, 37); g.addColorStop(0, '#202a3266'); g.addColorStop(0.8, '#526d7c77'); g.addColorStop(1, '#9eb8c011'); ellipse(c, 0, -34, 20, 35, g);
      for (let i = 0; i < 12; i++) { const a = this.time * 1.6 + i * Math.PI / 6; ellipse(c, Math.cos(a) * 19, -34 + Math.sin(a) * 33, 1, 1.8, '#bdc8c4'); } c.restore();
    } else if (o.kind === 'waypoint') {
      path(c, [-30, 0, 0, -14, 30, 0, 0, 15], '#5c5b52', '#88816b');
      c.strokeStyle = '#819b9f'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, 20, 9, 0, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 4; i++) { c.save(); c.rotate(i * Math.PI / 2); c.fillStyle = '#a5afa5'; c.fillRect(-1, -17, 2, 9); c.restore(); }
      if (o.used) { c.save(); c.shadowColor = '#8dabb3'; c.shadowBlur = 7; ellipse(c, 0, -3, 7, 3, '#b9c6bd'); c.restore(); }
    } else if (o.kind === 'stash' || o.kind === 'chest') {
      ellipse(c, 3, 3, 22, 7, '#0006');
      if (!this.drawArt('chest', 0, 6, 40, o.used ? 'brightness(0.78) saturate(0.65)' : 'brightness(1.08) saturate(0.8)')) {
        path(c, [-19, -3, -19, -21, 0, -29, 20, -20, 20, -2, 0, 8], '#655038', '#27291f');
        path(c, [-19, -21, -16, -30, 1, -36, 20, -25, 20, -20, 0, -10], o.used ? '#544533' : '#88704e', '#33281f');
        path(c, [0, -10, 20, -20, 20, -2, 0, 8], '#443c2c');
        c.strokeStyle = '#a9956b'; c.lineWidth = 2; c.beginPath(); c.moveTo(-11, -26); c.lineTo(8, -17); c.lineTo(8, 4); c.stroke();
      }
    } else if (o.kind === 'shrine') {
      this.ruin({ x: 0, y: 0 }, 0.7, true); this.brazier(0, -40, 0.3);
    } else if (o.kind === 'exit') {
      path(c, [-27, 2, -27, -44, -20, -58, -6, -65, 12, -58, 25, -42, 25, 4, 13, 9, 13, -39, 5, -48, -5, -48, -14, -40, -14, 8], '#656553', '#2e352b');
      path(c, [-14, 8, -14, -40, -5, -48, 5, -48, 13, -39, 13, 9], '#19231f');
      this.brazier(-32, 3, 0.1); this.brazier(31, 3, 0.7);
    } else if (o.kind === 'corpse') { ellipse(c, 0, 0, 18, 6, '#816a53'); }
    c.restore();
    if (Math.hypot(o.x - player.x, o.y - player.y) < 6.5) this.label(p.x, p.y - (o.kind === 'waypoint' ? 25 : o.kind === 'stash' || o.kind === 'chest' ? 46 : 78), o.name, o.kind === 'exit' ? '#d3c58b' : '#e0d4ad');
  }

  private brazier(x: number, y: number, phase: number) {
    const c = this.ctx;
    path(c, [x - 3, y, x - 2, y - 18, x + 3, y - 18, x + 4, y], '#524637');
    path(c, [x - 9, y - 22, x + 10, y - 22, x + 5, y - 15, x - 5, y - 15], '#a48a5d', '#332b23');
    c.save(); c.shadowColor = '#cd9d62'; c.shadowBlur = 13;
    const flick = Math.sin(this.time * 9 + phase * 13);
    path(c, [x - 7, y - 23, x - 4, y - 34, x, y - 45 - flick * 3, x + 3, y - 32, x + 7, y - 25, x + 1, y - 19], '#e88839');
    path(c, [x - 3, y - 22, x, y - 35 - flick * 2, x + 4, y - 23], '#ffe1a0'); c.restore();
    for (let i = 0; i < 3; i++) { const t = (this.time * 0.6 + phase + i / 3) % 1; ellipse(c, x + Math.sin(t * 7 + i) * 5, y - 27 - t * 28, 0.8, 1, `rgba(239,187,106,${1 - t})`); }
  }

  private effect(e: GameState['effects'][number]) {
    const c = this.ctx, p = this.project(e), progress = 1 - clamp(e.life / (e.maxLife || 1), 0, 1);
    const color = e.color || ({ fire: '#c99765', cold: '#9cb8c0', lightning: '#c0bacd', poison: '#94a473', heal: '#bd947b', level: '#cabb91', hit: '#c7af8b', nova: '#96adb6', summon: '#9caa82', portal: '#96afb8', text: '#eee0b8' }[e.kind]);
    c.save(); c.globalAlpha = Math.min(1, e.life / Math.max(1, e.maxLife * 0.25));
    if (e.kind === 'text' || e.text) {
      c.font = '600 15px "Noto Serif SC", "Songti SC", serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#111c16'; c.strokeText(e.text || '', p.x, p.y - 54 - progress * 34); c.fillStyle = color; c.fillText(e.text || '', p.x, p.y - 54 - progress * 34);
    } else {
      c.globalAlpha *= 0.82; c.shadowColor = color; c.shadowBlur = 6; const r = Math.max(12, e.radius * TW / 2) * (0.2 + progress);
      if (e.kind === 'nova' || e.kind === 'level' || e.kind === 'heal' || e.kind === 'portal') { c.strokeStyle = color; c.lineWidth = 2; c.beginPath(); c.ellipse(p.x, p.y - 5, r, r / 2, 0, 0, Math.PI * 2); c.stroke(); }
      for (let i = 0; i < 11; i++) {
        const a = hash(i, e.kind.length, Math.floor(e.x * 7)) * Math.PI * 2, distance = r * (0.25 + hash(i, 61) * 0.75);
        const x = p.x + Math.cos(a) * distance, y = p.y - 20 + Math.sin(a) * distance * 0.5 - Math.sin(progress * Math.PI) * 15;
        if (e.kind === 'lightning') { c.strokeStyle = color; c.beginPath(); c.moveTo(p.x, p.y - 24); c.lineTo(x - 4, y - 7); c.lineTo(x + 3, y); c.lineTo(x, y + 8); c.stroke(); }
        else ellipse(c, x, y, e.kind === 'fire' ? 3 : 1.7, e.kind === 'fire' ? 5 : 1.7, color);
      }
    }
    c.restore();
  }

  private lighting(style: string) {
    if (this.lightStyle !== style) {
      this.lightStyle = style;
      this.lightCanvas.width = this.canvas.width; this.lightCanvas.height = this.canvas.height;
      const c = this.lightCanvas.getContext('2d')!, dark = ['cave', 'dungeon', 'hell'].includes(style);
      c.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      const g = c.createRadialGradient(this.origin.x, this.origin.y - 30, 45, this.origin.x, this.origin.y, Math.max(this.width, this.height) * 0.72);
      g.addColorStop(0, dark ? '#c1a1700e' : '#d6c4a008'); g.addColorStop(0.55, '#0c0b0908'); g.addColorStop(1, dark ? '#060605b5' : '#0b0b09aa');
      c.fillStyle = g; c.fillRect(0, 0, this.width, this.height);
      const top = c.createLinearGradient(0, 0, 0, 170); top.addColorStop(0, '#090908bb'); top.addColorStop(1, '#09090800'); c.fillStyle = top; c.fillRect(0, 0, this.width, 170);
    }
    this.ctx.drawImage(this.lightCanvas, 0, 0, this.width, this.height);
  }

  private label(x: number, y: number, text: string, color: string) {
    const c = this.ctx; c.save(); c.font = '13px "Microsoft YaHei", "PingFang SC", sans-serif'; c.textAlign = 'center';
    const w = Math.min(260, c.measureText(text).width + 16);
    c.fillStyle = '#0a100ddb'; c.fillRect(x - w / 2, y - 13, w, 21); c.strokeStyle = '#9c8b543e'; c.strokeRect(x - w / 2, y - 13, w, 21); c.fillStyle = color; c.fillText(text, x, y + 2); c.restore();
  }

  private smallBar(x: number, y: number, ratio: number, color: string) {
    const c = this.ctx; c.fillStyle = '#0b100c'; c.fillRect(x - 21, y, 42, 5); c.fillStyle = color; c.fillRect(x - 20, y + 1, 40 * clamp(ratio || 0, 0, 1), 3);
  }

  private refreshMap(state: GameState) {
    const area = state.area!;
    if (this.mapArea === area && state.tick - this.mapTick < 15) return;
    this.mapArea = area; this.mapTick = state.tick;
    this.mapCanvas.width = area.width * 3; this.mapCanvas.height = area.height * 3;
    const c = this.mapCanvas.getContext('2d')!;
    for (let y = 0; y < area.height; y++) for (let x = 0; x < area.width; x++) {
      if (!area.revealed[y]?.[x]) continue;
      c.fillStyle = (area.tiles[y]?.[x] ?? 0) === 1 ? '#69705d99' : '#bab99266'; c.fillRect(x * 3, y * 3, 2.5, 2.5);
    }
  }

  private minimap(state: GameState) {
    this.refreshMap(state);
    const c = this.ctx, area = state.area!, player = state.player!;
    const size = this.width < 700 ? 112 : 164, x = this.width - size - 18, y = 82;
    c.save(); c.fillStyle = '#09100ddd'; c.fillRect(x, y, size, size); c.strokeStyle = '#8f7b4c88'; c.strokeRect(x, y, size, size);
    c.beginPath(); c.rect(x + 4, y + 4, size - 8, size - 8); c.clip();
    c.translate(x + size / 2, y + size / 2); c.scale(1, 0.55); c.rotate(Math.PI / 4);
    c.drawImage(this.mapCanvas, -player.x * 3, -player.y * 3);
    for (const o of area.objects) if (area.revealed[Math.floor(o.y)]?.[Math.floor(o.x)]) {
      c.fillStyle = o.kind === 'exit' ? '#e7c37a' : o.kind === 'waypoint' || o.kind === 'portal' ? '#7fcef0' : '#b3b9a5'; c.fillRect((o.x - player.x) * 3 - 2, (o.y - player.y) * 3 - 2, 4, 4);
    }
    c.fillStyle = '#f6e9bd'; c.fillRect(-2.5, -2.5, 5, 5); c.restore();
    c.font = '11px "PingFang SC", sans-serif'; c.fillStyle = '#c8bc97'; c.textAlign = 'right'; c.fillText('已探索区域 · TAB', x + size - 4, y + size + 17);
  }

  private automap(state: GameState) {
    const c = this.ctx, area = state.area!, player = state.player!;
    const scale = Math.min(8, (this.width - 70) / Math.max(area.width, area.height));
    c.save(); c.fillStyle = '#050b0c9c'; c.fillRect(0, 0, this.width, this.height - 135);
    c.translate(this.width / 2, (this.height - 130) / 2); c.scale(scale / 3, scale / 6); c.rotate(Math.PI / 4);
    c.drawImage(this.mapCanvas, -player.x * 3, -player.y * 3);
    for (const o of area.objects) if (area.revealed[Math.floor(o.y)]?.[Math.floor(o.x)]) {
      c.fillStyle = o.kind === 'exit' ? '#eac274' : '#75c6e9'; c.fillRect((o.x - player.x) * 3 - 1.5, (o.y - player.y) * 3 - 1.5, 3, 3);
    }
    c.fillStyle = '#fff1b8'; c.fillRect(-1.5, -1.5, 3, 3); c.restore();
    this.label(this.width / 2, 130, '探索地图 · 再按 Tab 关闭', '#d6c896');
  }

  private titleScene() {
    const c = this.ctx, w = this.width, h = this.height, gate = this.art('gate');
    c.fillStyle = '#181714'; c.fillRect(0, 0, w, h);
    if (gate) {
      const scale = Math.max(w / gate.naturalWidth, h / gate.naturalHeight);
      const iw = gate.naturalWidth * scale, ih = gate.naturalHeight * scale;
      c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(gate, (w - iw) / 2, (h - ih) / 2, iw, ih); c.restore();
    } else {
      const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#30312d'); bg.addColorStop(1, '#0e0e0c'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    }
    const mist = c.createLinearGradient(0, h * 0.35, 0, h); mist.addColorStop(0, '#aaa79c00'); mist.addColorStop(0.5, '#aaa79c08'); mist.addColorStop(1, '#0908068c'); c.fillStyle = mist; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const t = (this.time * 0.035 + hash(i, 76)) % 1; ellipse(c, hash(i, 77) * w + Math.sin(this.time * 0.3 + i) * 14, h * (0.83 - t * 0.5), 0.8, 1.4, `rgba(194,150,93,${Math.sin(t * Math.PI) * 0.42})`);
    }
    const radius = Math.max(w, h) * 0.75;
    const shade = c.createRadialGradient(w / 2, h * 0.44, radius * 0.1, w / 2, h * 0.5, radius); shade.addColorStop(0, '#09080608'); shade.addColorStop(1, '#090806b0'); c.fillStyle = shade; c.fillRect(0, 0, w, h);
  }

  destroy(): void {
    this.destroyed = true; this.resizeObserver?.disconnect(); this.tiles.clear(); this.sprites.clear();
    for (const { image } of this.images.values()) { image.onload = null; image.onerror = null; }
    this.images.clear(); this.groundArea = null; this.mapArea = null;
    for (const canvas of [this.groundCanvas, this.groundSpare, this.lightCanvas, this.mapCanvas]) { canvas.width = 0; canvas.height = 0; }
  }
}
