import { SENSITIVITY_RANK } from '../../../src/contracts/index.ts';
import type { PetUtterance } from '../../../src/contracts/index.ts';
export interface BubbleEntry { direction?: 'top' | 'bottom' | 'left' | 'right'; utterance: PetUtterance; priority: number; dedupeKey?: string; title?: string; merged?: BubbleEntry[] }
export const bubbleDuration = (u: PetUtterance): number => u.quickActions?.length ? 20000 : u.facts?.length ? 15000 : 8000;
export class BubbleQueue {
  current?: BubbleEntry;
  private waiting: BubbleEntry[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private hovered = false;
  constructor(private changed: (e?: BubbleEntry) => void, private now = Date.now) {}
  push(entry: BubbleEntry): void {
    if (entry.utterance.expiresAt !== undefined && entry.utterance.expiresAt <= this.now()) return;
    if (entry.dedupeKey && (this.current?.dedupeKey === entry.dedupeKey || this.waiting.some(e => e.dedupeKey === entry.dedupeKey))) return;
    if (!this.current) { this.show(entry); return; }
    if (entry.priority === 0) return;
    this.waiting.push(entry); this.waiting.sort((a, b) => b.priority - a.priority);
    const notifications = this.waiting.filter(e => e.priority === 1 || e.priority === 2);
    if (notifications.length > 2) {
      this.waiting = this.waiting.filter(e => !notifications.includes(e));
      const merged = notifications.flatMap(e => e.merged || [e]);
      this.waiting.push({ priority: 2, merged, utterance: {
        id: `merged:${merged.map(e => e.utterance.id).join(':')}`, sensitivity: merged.reduce<PetUtterance['sensitivity']>((s,e)=>SENSITIVITY_RANK[e.utterance.sensitivity]>SENSITIVITY_RANK[s]?e.utterance.sensitivity:s,'normal'),
        text: `有 ${merged.length} 条新通知`, quickActions: [{ label: '查看', open: 'notice' }],
      } });
      this.waiting.sort((a, b) => b.priority - a.priority);
    }
  }
  private show(e: BubbleEntry): void { this.current = e; this.changed(e); this.arm(); }
  private arm(): void {
    clearTimeout(this.timer);
    if (this.current && !this.hovered) this.timer = setTimeout(() => this.close(), bubbleDuration(this.current.utterance));
  }
  hover(value: boolean): void { this.hovered = value; this.arm(); }
  close(): void {
    clearTimeout(this.timer); this.current = undefined; this.hovered = false; this.changed();
    let entry: BubbleEntry | undefined;
    while ((entry = this.waiting.shift())) {
      if (entry.utterance.expiresAt === undefined || entry.utterance.expiresAt > this.now()) { this.show(entry); break; }
    }
  }
  removeNotice(id: string): void {
    const keep = (entry: BubbleEntry): BubbleEntry | undefined => {
      if (!entry.merged) return entry.utterance.ref?.noticeId === id ? undefined : entry;
      const merged = entry.merged.filter(e => e.utterance.ref?.noticeId !== id);
      if (!merged.length) return undefined;
      if (merged.length === 1) return merged[0];
      return { ...entry, merged, utterance: { ...entry.utterance, id: `merged:${merged.map(e=>e.utterance.id).join(':')}`, text: `有 ${merged.length} 条新通知`, sensitivity: merged.reduce<PetUtterance['sensitivity']>((s,e)=>SENSITIVITY_RANK[e.utterance.sensitivity]>SENSITIVITY_RANK[s]?e.utterance.sensitivity:s,'normal') } };
    };
    this.waiting = this.waiting.flatMap(entry => { const safe=keep(entry); return safe ? [safe] : []; });
    if (this.current) {
      const safe = keep(this.current);
      if (!safe) this.close(); else if (safe !== this.current) this.show(safe);
    }
  }
  clear(): void { this.waiting = []; clearTimeout(this.timer); this.current = undefined; this.hovered = false; this.changed(); }
  pending(): number { return this.waiting.length; }
}
