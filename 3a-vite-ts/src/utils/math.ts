// Scalar math helpers.

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;
export const saturate = (value: number): number =>
  Math.min(1, Math.max(0, value));
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = saturate((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
/** Frame-rate independent exponential approach of `current` towards `target`. */
export const damp = (
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number => target + (current - target) * Math.exp(-lambda * dt);
