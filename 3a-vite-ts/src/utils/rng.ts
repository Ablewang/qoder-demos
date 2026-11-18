// Seeded PRNG (mulberry32) with helpers.

export interface Rng {
  (): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  pick<T>(items: ArrayLike<T>): T;
  sign(): number;
  fork(): Rng;
}

export function createRng(seed = 1337): Rng {
  let state = seed >>> 0;
  const t = (() => {
    state |= 0;
    state = (state + 1831565813) | 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  }) as Rng;
  t.range = (min, max) => min + (max - min) * t();
  t.int = (min, max) => Math.floor(min + (max - min + 1) * t());
  t.pick = (items) => items[Math.floor(t() * items.length)];
  t.sign = () => (t() < 0.5 ? -1 : 1);
  t.fork = () => createRng(Math.floor(t() * 4294967296));
  return t;
}
