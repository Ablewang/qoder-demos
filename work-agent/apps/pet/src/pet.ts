import type { PetState, SkinManifest } from '../../../src/contracts/index.ts';
import manifestJson from '../public/skins/tuanzi-default/manifest.json';
import svgSource from '../public/skins/tuanzi-default/mochi.svg?raw';
export const skin: SkinManifest = manifestJson as SkinManifest;
export const actionIds = ['idle_breathe', 'look_at_cursor', 'pet_squint', 'poke_wobble', 'poke_pout', 'drag_hold', 'drop_land', 'perch_edge', 'doze', 'sleep', 'play_ball', 'stretch', 'music_nod', 'eat_snack', 'sign_hold', 'happy_bounce', 'worried', 'caring', 'working', 'wait_auth', 'quiet_curl', 'offline_sleep', 'read_notebook', 'ear_twitch', 'cheek_squish', 'belly_giggle', 'face_rub', 'roll_over', 'poke_guard', 'drop_rub', 'ball_ready', 'ball_toss', 'ball_catch', 'ball_miss', 'box_peek', 'box_hide', 'box_pop'] as const;
export type ActionId = typeof actionIds[number];
export function stateAction(state: PetState, perched = false, interaction?: string, entertainment?: string): string {
  if (state.activity === 'quiet') return 'quiet_curl';
  if (interaction && actionIds.includes(interaction as ActionId)) return interaction;
  if (state.activity === 'offline') return 'offline_sleep';
  if (state.expression?.animationId && actionIds.includes(state.expression.animationId as ActionId) && Date.now() - state.expression.startedAt < 8000) return state.expression.animationId;
  if (state.activity === 'idle') return entertainment || (perched ? 'perch_edge' : 'idle_breathe');
  return skin.semanticMap[state.activity] || 'idle_breathe';
}
export function createPet(): HTMLElement {
  const pet = document.createElement('div'); pet.className = 'pet'; pet.setAttribute('aria-label', '团子');
  const parsed = new DOMParser().parseFromString(svgSource, 'image/svg+xml');
  pet.append(document.importNode(parsed.documentElement, true));
  return pet;
}
export class Entertainer {
  nextAt: number;
  activeUntil = 0;
  action?: string;
  constructor(private random = Math.random, now = Date.now()) { this.nextAt = now + this.interval('medium'); }
  interval(frequency: 'off' | 'low' | 'medium'): number { return frequency === 'off' ? Infinity : frequency === 'low' ? (10 + this.random() * 5) * 60000 : (3 + this.random() * 3) * 60000; }
  schedule(frequency: 'off' | 'low' | 'medium', now = Date.now()): void { this.nextAt = now + this.interval(frequency); }
  tick(opts: { now: number; lastInteraction: number; state: PetState; bubble: boolean; dragging: boolean; frequency: 'off' | 'low' | 'medium'; work: boolean }): string | undefined {
    if (opts.state.activity !== 'idle' || opts.bubble || opts.dragging || opts.state.quietReasons.length) { this.action = undefined; this.activeUntil = 0; return; }
    if (this.action && opts.now < this.activeUntil) return this.action;
    this.action = undefined;
    if (opts.frequency === 'off') return;
    if (opts.work && opts.now - opts.lastInteraction >= 15 * 60000) return 'doze';
    if (opts.now < this.nextAt || opts.now - opts.lastInteraction < 60000) return;
    const candidates = ['play_ball', 'stretch', 'music_nod'];
    if (opts.state.growth.unlocked.includes('act_read_notebook')) candidates.push('read_notebook');
    this.action = candidates[Math.floor(this.random() * candidates.length)];
    this.activeUntil = opts.now + ({ play_ball: 7000, stretch: 2000, music_nod: 10000 + this.random() * 20000, read_notebook: 5000 }[this.action] || 2000);
    this.schedule(opts.frequency, opts.now); return this.action;
  }
}
