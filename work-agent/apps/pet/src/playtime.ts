import type { Point } from './geometry.ts';

export type PlayKind = 'ball' | 'box';
type Phase = 'ready' | 'flight' | 'caught' | 'missed' | 'peek' | 'hide' | 'pop' | 'result';
export interface PlayFrame { action: string; phase: string; hint: string; round: number; caught: number; side: number }

export function touchReaction(point: Point, double = false): string {
  if (double) return point.y >= 105 ? 'roll_over' : point.y < 70 || point.x < 60 || point.x > 100 ? 'face_rub' : 'happy_bounce';
  if ((point.x < 43 || point.x > 122) && point.y < 100) return 'ear_twitch';
  if ((point.x < 60 || point.x > 100) && point.y >= 70 && point.y < 105) return 'cheek_squish';
  return point.y >= 105 ? 'belly_giggle' : 'poke_wobble';
}

export function reactionFrames(id: string, now: number): Array<{ action: string; until: number }> {
  const stages: Array<[string, number]> = id === 'poke_pout' ? [['poke_pout', 600], ['poke_guard', 700], ['face_rub', 700]]
    : id === 'drop_land' ? [['drop_land', 500], ['drop_rub', 700]]
    : id === 'eat_snack' ? [['eat_snack', 1500], ['happy_bounce', 1200]]
    : [[id, ({ pet_squint: 1500, poke_wobble: 600, happy_bounce: 1200, drag_hold: 86400000, look_at_cursor: 1000, ear_twitch: 800, cheek_squish: 900, belly_giggle: 1200, face_rub: 1200, roll_over: 1400, play_ball: 7000, music_nod: 20000, read_notebook: 5000 } as Record<string, number>)[id] ?? 2000]];
  return stages.map(([action, duration]) => ({ action, until: now += duration }));
}

export class Playtime {
  kind?: PlayKind;
  private phase: Phase = 'ready';
  private startedAt = 0;
  private phaseAt = 0;
  private round = 1;
  private caught = 0;
  private teases = 0;

  start(kind: PlayKind, now: number): void {
    this.kind = kind; this.startedAt = this.phaseAt = now;
    this.phase = kind === 'ball' ? 'ready' : 'peek';
    this.round = 1; this.caught = this.teases = 0;
  }
  stop(): void { this.kind = undefined; }
  tap(now: number): void {
    const frame = this.tick(now);
    if (!frame) return;
    if (this.kind === 'ball') {
      if (this.phase === 'ready') { this.phase = 'flight'; this.phaseAt = now; }
      else if (this.phase === 'flight' && now - this.phaseAt >= 700) { this.phase = 'caught'; this.phaseAt = now; this.caught++; }
    } else if (this.phase === 'peek') { this.teases++; this.phase = 'hide'; this.phaseAt = now; }
  }
  tick(now: number): PlayFrame | undefined {
    if (!this.kind) return;
    if (now - this.startedAt >= 30000) { this.stop(); return; }
    for (;;) {
      const age = now - this.phaseAt;
      if (this.kind === 'ball' && this.phase === 'flight' && age >= 1400) { this.phase = 'missed'; this.phaseAt += 1400; continue; }
      if (this.phase === 'caught' && age >= 700 || this.phase === 'missed' && age >= 900) {
        this.phaseAt += this.phase === 'caught' ? 700 : 900;
        if (this.round === 3) this.phase = 'result';
        else { this.round++; this.phase = 'ready'; }
        continue;
      }
      if (this.phase === 'hide' && age >= 450) {
        this.phaseAt += 450;
        this.phase = this.teases === 3 ? 'pop' : 'peek'; this.round = Math.min(3, this.teases + 1); continue;
      }
      if (this.phase === 'pop' && age >= 700) { this.phase = 'result'; this.phaseAt += 700; continue; }
      if (this.phase === 'result' && age >= 1800) { this.stop(); return; }
      break;
    }
    const falling = this.phase === 'flight' && now - this.phaseAt >= 700;
    const actions: Record<Phase, string> = { ready: 'ball_ready', flight: 'ball_toss', caught: 'ball_catch', missed: 'ball_miss', peek: 'box_peek', hide: 'box_hide', pop: 'box_pop', result: 'happy_bounce' };
    const hint = this.phase === 'ready' ? `第 ${this.round}/3 球 · 点一下抛球`
      : this.phase === 'flight' ? falling ? '现在点一下，接住！' : '等球落下来…'
      : this.phase === 'caught' ? '接住啦！' : this.phase === 'missed' ? '我捡回来，再来一次'
      : this.phase === 'peek' ? `第 ${this.round}/3 次 · 点纸箱逗我`
      : this.phase === 'hide' ? '藏起来啦…' : this.phase === 'pop' ? '被你找到啦！'
      : this.kind === 'ball' ? `接住 ${this.caught}/3 球 · 玩得开心` : '纸箱真好玩';
    return { action: actions[this.phase], phase: falling ? 'catch' : this.phase, hint, round: this.round, caught: this.caught, side: this.round % 2 ? 1 : -1 };
  }
}
