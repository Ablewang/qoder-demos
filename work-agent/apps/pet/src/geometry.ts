export interface Point { x: number; y: number }
export interface Rect extends Point { width: number; height: number }
export interface Frame extends Rect { id: number; pid: number }
export type Edge = 'top' | 'bottom' | 'left' | 'right';
export const inside = (p: Point, r: Rect): boolean => p.x >= r.x && p.y >= r.y && p.x <= r.x + r.width && p.y <= r.y + r.height;
export const hitTest = (p: Point, areas: Rect[]): boolean => areas.some(r => inside(p, r));
export const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(n, Math.max(lo, hi)));
export function bubblePlacement(pet: Rect, size: { width: number; height: number }, work: Rect): Rect & { direction: Edge } {
  const gap = 8;
  const spaces = { top: pet.y - work.y, bottom: work.y + work.height - pet.y - pet.height, left: pet.x - work.x, right: work.x + work.width - pet.x - pet.width };
  let direction: Edge = 'top';
  if (spaces.top < size.height + gap) {
    direction = spaces.left > spaces.right ? 'left' : 'right';
    if (spaces[direction] < size.width + gap) direction = 'bottom';
  }
  let x = pet.x + (pet.width - size.width) / 2;
  let y = pet.y - size.height - gap;
  if (direction === 'left') { x = pet.x - size.width - gap; y = pet.y; }
  if (direction === 'right') { x = pet.x + pet.width + gap; y = pet.y; }
  if (direction === 'bottom') y = pet.y + pet.height + gap;
  return { x: clamp(x, work.x, work.x + work.width - size.width), y: clamp(y, work.y, work.y + work.height - size.height), width: Math.min(size.width, work.width), height: Math.min(size.height, work.height), direction };
}
