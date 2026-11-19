import type { PetInteraction } from '../../../src/contracts/index.ts';
import type { Point } from './geometry.ts';
type Timer = ReturnType<typeof setTimeout>;
export class Gestures {
  private down?: Point & { at: number };
  private dragging = false;
  private travel = 0;
  private clicks: number[] = [];
  private pokes: number[] = [];
  private clickTimer?: Timer;
  private hoverTimer?: Timer;
  private hover = false;
  private reversals: number[] = [];
  private lastX?: number;
  private direction = 0;
  private petAt = -Infinity;
  constructor(private emit: (e: PetInteraction) => void, private reaction: (id: string) => void, private now = Date.now) {}
  press(p: Point): void { this.down = { ...p, at: this.now() }; this.travel = 0; }
  move(p: Point, head: boolean, anyButton: boolean): void {
    if (this.down) this.travel = Math.max(this.travel, Math.hypot(p.x - this.down.x, p.y - this.down.y));
    if (this.down && this.travel > 6 && !this.dragging) {
      this.dragging = true;
      this.clicks = []; clearTimeout(this.clickTimer);
      this.reaction('drag_hold'); this.emit({ kind: 'drag_start' });
    }
    if (!head || anyButton || this.down) { this.lastX = undefined; this.direction = 0; this.reversals = []; return; }
    if (this.lastX === undefined) { this.lastX = p.x; return; }
    const delta = p.x - this.lastX;
    if (Math.abs(delta) < 3) return;
    this.lastX = p.x;
    const direction = Math.sign(delta), now = this.now();
    this.reversals = this.reversals.filter(t => now - t <= 1500);
    if (this.direction && direction !== this.direction) this.reversals.push(now);
    this.direction = direction;
    if (this.reversals.length >= 2) this.reaction('pet_squint');
    if (this.reversals.length >= 3 && now - this.petAt >= 1200) {
      this.petAt = now; this.emit({ kind: 'pet' });
    }
  }
  release(p: Point): void {
    const down = this.down; this.down = undefined;
    if (this.dragging) { this.dragging = false; this.reaction('drop_land'); this.emit({ kind: 'drop' }); return; }
    if (!down || this.now() - down.at > 250 || this.travel > 4 || Math.hypot(p.x - down.x, p.y - down.y) > 4) return;
    const now = this.now();
    if (this.clicks.length && now - this.clicks[this.clicks.length - 1] >= 400) this.flush();
    this.clicks.push(now);
    this.pokes = this.pokes.filter(t => now - t <= 3000); this.pokes.push(now);
    if (this.clicks.length >= 3) this.reaction(this.pokes.length >= 6 ? 'poke_pout' : 'poke_wobble');
    clearTimeout(this.clickTimer);
    this.clickTimer = setTimeout(() => this.flush(), this.clicks.length >= 3 ? 400 : 300);
  }
  private flush(): void {
    const clicks = this.clicks; this.clicks = []; clearTimeout(this.clickTimer);
    if (clicks.length >= 3 && clicks[2] - clicks[0] <= 1200) {
      this.emit({ kind: 'poke', times: Math.max(clicks.length, this.pokes.length >= 6 ? this.pokes.length : clicks.length) });
    } else if (clicks.length === 2 && clicks[1] - clicks[0] <= 300) this.emit({ kind: 'double_click' });
    else if (clicks.length) this.emit({ kind: 'click' });
  }
  enter(anyButton = false): void {
    if (anyButton || this.hover) return;
    this.hover = true;
    this.hoverTimer = setTimeout(() => { this.reaction('look_at_cursor'); this.emit({ kind: 'hover' }); }, 300);
  }
  leave(): void { this.hover = false; clearTimeout(this.hoverTimer); this.lastX = undefined; this.reversals = []; }
  isDragging(): boolean { return this.dragging; }
  cancel(): void {
    this.down = undefined; this.dragging = false; this.travel = 0; this.clicks = []; this.pokes = [];
    this.lastX = undefined; this.direction = 0; this.reversals = []; this.hover = false;
    clearTimeout(this.clickTimer); clearTimeout(this.hoverTimer);
  }
  dispose(): void { this.cancel(); }
}
