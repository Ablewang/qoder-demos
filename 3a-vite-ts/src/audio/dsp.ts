export const TAU = Math.PI * 2;
export function audioRng(i: number) {
  let e = i >>> 0;
  return () => {
    e |= 0;
    e = (e + 1831565813) | 0;
    let t = Math.imul(e ^ (e >>> 15), 1 | e);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(i: any) {
  let e = 2166136261;
  for (let t = 0; t < i.length; t++) {
    e ^= i.charCodeAt(t);
    e = Math.imul(e, 16777619);
  }
  return e >>> 0;
}
export const buffer = (i: number, e: number) =>
  new Float32Array(Math.max(1, Math.round(i * e)));
export const randRange = (i: any, e: number, t: number) => e + (t - e) * i();
export const midiToHz = (i: number) => 440 * Math.pow(2, (i - 69) / 12);
export function noiseBuffer(i: number, e: number, t: any) {
  let n = buffer(i, e);
  for (let s = 0; s < n.length; s++) n[s] = t() * 2 - 1;
  return n;
}
export function biquadCoefs(i: string, e: number, t: number, n: number) {
  let s = (TAU * Math.max(10, Math.min(e, n * 0.47))) / n,
    o = Math.cos(s),
    r = Math.sin(s),
    a = r / (2 * t),
    l: number | undefined,
    c: number | undefined,
    u: number | undefined,
    h = 1 + a,
    f = -2 * o,
    p = 1 - a;
  if (i === "lp") {
    l = (1 - o) / 2;
    c = 1 - o;
    u = l;
  } else if (i === "hp") {
    l = (1 + o) / 2;
    c = -(1 + o);
    u = l;
  } else {
    l = a;
    c = 0;
    u = -a;
  }
  return [l / h, c / h, u / h, f / h, p / h];
}
export function biquad(i: any, e: string, t: number, n: number, s: number) {
  let [o, r, a, l, c] = biquadCoefs(e, t, n, s),
    u = 0,
    h = 0;
  for (let f = 0; f < i.length; f++) {
    let p = i[f],
      d = o * p + u;
    u = r * p - l * d + h;
    h = a * p - c * d;
    i[f] = d;
  }
  return i;
}
type SweepFilterState = { z1: number; z2: number };
export function sweepFilter(
  i: Float32Array<ArrayBuffer>,
  e: string,
  t: (x: number) => number,
  n: number | ((x: number) => number),
  s: number,
  o = 1,
) {
  let r = i.length;
  for (let a = 0; a < o; a++) {
    let l = 0,
      c = 0,
      u: number[] | null = null;
    if (a > 0) {
      l = (sweepFilter as unknown as SweepFilterState).z1;
      c = (sweepFilter as unknown as SweepFilterState).z2;
    }
    let h = a === o - 1 ? i : null;
    for (let f = 0; f < r; f++) {
      if ((f & 31) === 0) {
        u = biquadCoefs(e, t(f / r), typeof n == "function" ? n(f / r) : n, s);
      }
      let p = i[f],
        d = u![0] * p + l;
      l = u![1] * p - u![3] * d + c;
      c = u![2] * p - u![4] * d;
      if (h) {
        h[f] = d;
      }
    }
    (sweepFilter as unknown as SweepFilterState).z1 = l;
    (sweepFilter as unknown as SweepFilterState).z2 = c;
  }
  return i;
}
export const expSweep =
  (i: number, e: number, t = 1) =>
  (n: number) =>
    i * Math.pow(e / i, Math.pow(n, t));
export function applyEnvelope(
  i: Float32Array<ArrayBuffer>,
  e: number,
  t: (t: number) => number,
) {
  for (let n = 0; n < i.length; n++) i[n] *= t(n / e);
  return i;
}
export const expEnvelope = (i: number, e = 0) =>
  e > 0
    ? (t: number) => (1 - Math.exp(-t / e)) * Math.exp(-t / i)
    : (t: number) => Math.exp(-t / i);
export function mixInto(
  i: Float32Array<ArrayBuffer>,
  e: any,
  t: number,
  n: number,
  s: number,
) {
  let o = Math.round(t * s),
    r = Math.min(e.length, i.length - o);
  for (let a = Math.max(0, -o); a < r; a++) i[o + a] += e[a] * n;
  return i;
}
export function mixWrap(
  i: Float32Array<ArrayBuffer>,
  e: any,
  t: number,
  n: number,
  s: number,
) {
  let o = i.length,
    r = Math.round(t * s) % o;
  if (r < 0) {
    r += o;
  }
  for (let a = 0; a < e.length; a++) {
    i[r] += e[a] * n;
    if (++r >= o) {
      r = 0;
    }
  }
  return i;
}
export function peakOf(i: any) {
  let e = 0;
  for (let t = 0; t < i.length; t++) {
    let n = Math.abs(i[t]);
    if (n > e) {
      e = n;
    }
  }
  return e;
}
export function gain(i: any, e: number) {
  for (let t = 0; t < i.length; t++) i[t] *= e;
  return i;
}
export function saturateTanh(i: any, e: number) {
  let t = 1 / Math.tanh(e);
  for (let n = 0; n < i.length; n++) i[n] = Math.tanh(i[n] * e) * t;
  return i;
}
export function fadeEdges(i: any, e: number, t: number, n: number) {
  let s = Math.min(i.length >> 1, Math.round(t * e)),
    o = Math.min(i.length >> 1, Math.round(n * e));
  for (let r = 0; r < s; r++) i[r] *= r / s;
  for (let r = 0; r < o; r++) {
    let a = r / o;
    i[i.length - 1 - r] *= a * a;
  }
  return i;
}
export function noiseBurst(
  i: number,
  e: any,
  t: number,
  n: number,
  s: { lp?: number; bp?: number; q?: number; hp?: number; att?: number } = {},
) {
  let o = noiseBuffer(i, t, e);
  if (s.hp) {
    biquad(o, "hp", s.hp, 0.707, i);
  }
  if (s.lp) {
    biquad(o, "lp", s.lp, 0.707, i);
  }
  if (s.bp) {
    biquad(o, "bp", s.bp, s.q || 1, i);
  }
  applyEnvelope(o, i, expEnvelope(n, s.att || 0));
  let r = peakOf(o);
  return r > 0 ? gain(o, 1 / r) : o;
}
export function pitchDropTone(
  i: number,
  e: number,
  t: number,
  n: number,
  s: number,
  o: number,
  r = 6e-4,
) {
  let a = buffer(i, e),
    l = 0;
  for (let c = 0; c < a.length; c++) {
    let u = c / i;
    l += (TAU * (n + (t - n) * Math.exp(-u / s))) / i;
    a[c] = Math.sin(l) * Math.exp(-u / o) * (1 - Math.exp(-u / r));
  }
  return a;
}
export function chirp(i: number, e: number, t: number, n: number, s = true) {
  let o = buffer(i, e),
    r = 0,
    a = o.length;
  for (let l = 0; l < a; l++) {
    let c = l / a;
    r += (TAU * t * Math.pow(n / t, c)) / i;
    o[l] = Math.sin(r) * (s ? Math.sin(Math.PI * c) : 1);
  }
  return o;
}
export function modalRing(
  i: number,
  e: number,
  t: number[][],
  n?: (() => number) | undefined,
) {
  let s = buffer(i, e);
  for (let [r, a, l] of t) {
    if (r > i * 0.46) {
      continue;
    }
    let c = (TAU * r) / i,
      u = n ? n() * TAU : 0,
      h = Math.exp(-1 / (a * i)),
      f = l;
    for (
      let p = 0;
      p < s.length &&
      ((s[p] += Math.sin(c * p + u) * f), (f *= h), !(f < 1e-5));
      p++
    );
  }
  let o = Math.min(s.length, Math.round(4e-4 * i));
  for (let r = 0; r < o; r++) s[r] *= r / o;
  return s;
}
export function crackles(
  i: number,
  e: any,
  t: number,
  n: number,
  s: {
    from?: number;
    fall?: number;
    hp?: number;
    ampFall?: number;
    bp?: number;
    q?: number;
    maxLen?: number;
    lp?: number;
    minLen?: any;
  } = {},
) {
  let o = buffer(i, t),
    r = s.from || 0,
    a = s.fall || 1;
  for (let l = 0; l < n; l++) {
    let c = r + (t - r - 0.02) * Math.pow(e(), a),
      u = Math.round(c * i),
      h = Math.round(randRange(e, s.minLen || 0.001, s.maxLen || 0.004) * i),
      f = randRange(e, 0.2, 1) * (s.ampFall ? Math.exp(-c / s.ampFall) : 1);
    for (let p = 0; p < h && u + p < o.length; p++)
      o[u + p] += (e() * 2 - 1) * f * Math.exp((-4 * p) / h);
  }
  if (s.hp) {
    biquad(o, "hp", s.hp, 0.707, i);
  }
  if (s.lp) {
    biquad(o, "lp", s.lp, 0.707, i);
  }
  if (s.bp) {
    biquad(o, "bp", s.bp, s.q || 1, i);
  }
  return o;
}
export function loopCrossfade(
  i: Float32Array<ArrayBuffer>,
  e: number,
  t: boolean,
) {
  let n = i.length - e,
    s = new Float32Array(e);
  s.set(i.subarray(0, e));
  for (let o = 0; o < n; o++) {
    let r = (o + 0.5) / n,
      a = t ? Math.sin((r * Math.PI) / 2) : r,
      l = t ? Math.cos((r * Math.PI) / 2) : 1 - r;
    s[o] = i[o] * a + i[e + o] * l;
  }
  return s;
}
export function loopedNoise(
  i: number,
  e: number,
  t: () => number,
  n: any,
  s = 0.4,
) {
  let o = noiseBuffer(i, e + s, t);
  n(o);
  return loopCrossfade(o, Math.round(i * e), true);
}
export function sumBuffers(i: number, ...e: [Float32Array, number][]) {
  let t = new Float32Array(i);
  for (let [n, s] of e)
    for (let o = 0; o < Math.min(i, n.length); o++) t[o] += n[o] * s;
  return t;
}
