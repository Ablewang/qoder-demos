function hash2i(i: number, e: number, t: number) {
  let n =
    Math.imul(i | 0, 374761393) ^
    Math.imul(e | 0, 668265263) ^
    Math.imul(t | 0, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function gradNoise2(i: number, e: number, t: number, n?: number) {
  let s = Math.floor(i),
    o = Math.floor(e),
    r = i - s,
    a = e - o,
    l = r * r * (3 - 2 * r),
    c = a * a * (3 - 2 * a),
    u = s,
    h = s + 1,
    f = o,
    p = o + 1;
  if (n) {
    u = ((u % n) + n) % n;
    h = ((h % n) + n) % n;
    f = ((f % n) + n) % n;
    p = ((p % n) + n) % n;
  }
  let d = hash2i(u, f, t),
    v = hash2i(h, f, t),
    g = hash2i(u, p, t),
    x = hash2i(h, p, t);
  return d + (v - d) * l + (g - d) * c + (d - v - g + x) * l * c;
}
function fbm2(i: number, e: number, t: number, n = 4, s = 0) {
  let o = 0,
    r = 0.5,
    a = 0;
  for (let l = 0; l < n; l++) {
    o += r * gradNoise2(i, e, t + l * 17, s);
    a += r;
    i *= 2;
    e *= 2;
    s *= 2;
    r *= 0.5;
  }
  return o / a;
}
const groundClamp01 = (i: number) => (i < 0 ? 0 : i > 1 ? 1 : i);
const groundSmoothstep = (i: number, e: number, t: number) => {
  let n = groundClamp01((t - i) / (e - i));
  return n * n * (3 - 2 * n);
};
const PUDDLE_WATER_LEVEL = 0.385;
export const PUDDLE_FIELD = {
  x0: -44,
  z0: -40,
  size: 80,
};
const PUDDLE_BLOBS = [
  [-30.5, 6.6, 2.6, 1.7, 0.24],
  [-19.5, 5.2, 7.5, 1.5, 0.27],
  [-11.5, 7, 5, 1.2, 0.24],
  [-7.6, 5.6, 2.3, 1.7, 0.2],
  [5.6, 4.7, 3.3, 1.35, 0.26],
  [13, 6.6, 2.6, 1.2, 0.2],
  [-13, -1.3, 4.6, 1.5, 0.2],
  [1, -1.6, 3.4, 1.4, 0.18],
  [12.5, -1.4, 2.4, 1.3, 0.18],
  [-3.5, -8.2, 4.4, 1.6, 0.2],
  [-20, -8.6, 3.6, 1.6, 0.18],
  [14.6, -19.5, 2, 3.6, 0.2],
  [23.5, 6.9, 3.2, 2, 0.22],
  [23.2, -7.6, 3.4, 1.8, 0.2],
  [20.8, 1.5, 1.4, 3.6, 0.16],
  [23.5, 22.5, 3, 2, 0.2],
  [24, -25, 2.8, 2.6, 0.2],
  [-1, 16.5, 7, 1.7, 0.2],
  [11.5, 16.9, 3.6, 1.4, 0.18],
  [-17, 15.8, 3.2, 1.5, 0.18],
  [8.6, 12.3, 1.5, 3.4, 0.17],
  [-7.8, 19.5, 1.7, 3.6, 0.17],
  [-8, 25.8, 6, 1.3, 0.18],
  [9, 25.9, 4, 1.2, 0.18],
  [-32, -4, 2.6, 3.4, 0.18],
  [-31, 18, 3, 4, 0.18],
];
const PUDDLE_BLOB_SCALE = 1;
const PUDDLE_BLOB_DEPTH_BIAS = 0.02;
function puddleMask(i: number, e: number) {
  let t =
    0.5 +
    (fbm2(i / 8.5, e / 8.5, 11, 4) - 0.47) * 0.3 +
    (fbm2(i / 2.4, e / 2.4, 23, 3) - 0.5) * 0.14;
  for (let n = 0; n < PUDDLE_BLOBS.length; n++) {
    let s = PUDDLE_BLOBS[n],
      o = (i - s[0]) / (s[2] * PUDDLE_BLOB_SCALE),
      r = (e - s[1]) / (s[3] * PUDDLE_BLOB_SCALE),
      a = o * o + r * r;
    if (a < 9) {
      t -= (s[4] + PUDDLE_BLOB_DEPTH_BIAS) * Math.exp(-a * a);
    }
  }
  if (i > -37 && i < 29) {
    let n = 0.5 + 0.5 * gradNoise2(i / 6, 3.1, 5),
      s = (e - 4.9) / 0.5,
      o = (e - 7.1) / 0.5,
      r = (e - 15.4) / 0.5,
      a = (e - 17.2) / 0.5,
      l =
        groundSmoothstep(0.14, 0.34, fbm2(i / 9, 7.7, 19, 2)) *
        groundSmoothstep(-27, -24, i) *
        (1 - groundSmoothstep(14, 17, i));
    t -=
      0.22 * (0.55 + 0.45 * n) * l * (Math.exp(-s * s) + Math.exp(-o * o)) +
      0.09 *
        n *
        (1 - groundSmoothstep(0.3, 0.6, fbm2(i / 9, 7.7, 19, 2))) *
        (Math.exp(-r * r) + Math.exp(-a * a));
  }
  t += 0.25 * groundSmoothstep(28.6, 29.8, i);
  return t;
}
export function bakePuddleMap(i: number) {
  let e = new Uint8Array(i * i * 4),
    { x0: t, z0: n, size: s } = PUDDLE_FIELD,
    o = s / i;
  for (let r = 0; r < i; r++) {
    let a = n + (r + 0.5) * o;
    for (let l = 0; l < i; l++) {
      let c = t + (l + 0.5) * o,
        u = (r * i + l) * 4,
        h = puddleMask(c, a);
      e[u] = Math.round(
        groundClamp01(0.5 + (h - PUDDLE_WATER_LEVEL) * 2.5) * 255,
      );
      e[u + 1] = Math.round(
        groundClamp01(
          0.5 + (fbm2(c / 5.5, a / 5.5, 41, 3) - 0.5) * 1.5 + (0.5 - h) * 0.9,
        ) * 255,
      );
      let f =
        groundSmoothstep(0.6, 0.78, fbm2(c / 1.4, a / 1.4, 77, 4)) *
        groundSmoothstep(0.47, 0.62, fbm2(c / 9, a / 9, 91, 2));
      e[u + 2] = Math.round(groundClamp01(f) * 255);
      e[u + 3] = Math.round(
        groundClamp01(
          fbm2(c / 22, a / 0.9, 57, 3) * 0.6 +
            fbm2(c / 13, a / 13, 63, 3) * 0.4,
        ) * 255,
      );
    }
  }
  return e;
}
export function samplePuddleMap(
  i: Uint8Array<ArrayBuffer>,
  e: number,
  t: number,
  n: number,
  s: number,
) {
  let o = ((t - PUDDLE_FIELD.x0) / PUDDLE_FIELD.size) * e - 0.5,
    r = ((n - PUDDLE_FIELD.z0) / PUDDLE_FIELD.size) * e - 0.5;
  o = o < 0 ? 0 : o > e - 1.001 ? e - 1.001 : o;
  r = r < 0 ? 0 : r > e - 1.001 ? e - 1.001 : r;
  let a = o | 0,
    l = r | 0,
    c = o - a,
    u = r - l,
    h = (l * e + a) * 4 + s,
    f = e * 4;
  return (
    ((i[h] * (1 - c) + i[h + 4] * c) * (1 - u) +
      (i[h + f] * (1 - c) + i[h + f + 4] * c) * u) /
    255
  );
}
export function bakeGroundDetail(i: number) {
  let e = new Uint8Array(i * i * 4),
    t = new Uint8Array(i * i * 4),
    n = new Float32Array(i * i),
    s = new Float32Array(i * i);
  for (let r = 0; r < i; r++)
    for (let a = 0; a < i; a++) {
      let l = a / i,
        c = r / i,
        u = r * i + a,
        h =
          fbm2(l * 96, c * 96, 3, 2, 96) * 0.6 +
          fbm2(l * 40, c * 40, 9, 2, 40) * 0.4,
        f = fbm2(l * 6, c * 6, 21, 4, 6),
        p = (fbm2(l * 8, c * 8, 31, 2, 8) - 0.5) * 0.25,
        d = (fbm2(l * 8, c * 8, 37, 2, 8) - 0.5) * 0.25,
        v = 1 - Math.abs(2 * fbm2((l + p) * 5, (c + d) * 5, 43, 3, 5) - 1),
        g = fbm2(l * 28, c * 28, 51, 3, 28);
      e[u * 4] = Math.round(groundClamp01(h) * 255);
      e[u * 4 + 1] = Math.round(groundClamp01(f) * 255);
      e[u * 4 + 2] = Math.round(groundClamp01(v) * 255);
      e[u * 4 + 3] = Math.round(groundClamp01(g) * 255);
      n[u] = h;
      s[u] = fbm2(l * 9, c * 9, 71, 4, 9);
    }
  let o = (r: number) => (r + i) % i;
  for (let r = 0; r < i; r++)
    for (let a = 0; a < i; a++) {
      let l = r * i + a,
        c = (n[r * i + o(a + 1)] - n[r * i + o(a - 1)]) * 2.2,
        u = (n[o(r + 1) * i + a] - n[o(r - 1) * i + a]) * 2.2,
        h = (s[r * i + o(a + 2)] - s[r * i + o(a - 2)]) * 9,
        f = (s[o(r + 2) * i + a] - s[o(r - 2) * i + a]) * 9;
      t[l * 4] = Math.round(groundClamp01(0.5 - c) * 255);
      t[l * 4 + 1] = Math.round(groundClamp01(0.5 - u) * 255);
      t[l * 4 + 2] = Math.round(groundClamp01(0.5 - h) * 255);
      t[l * 4 + 3] = Math.round(groundClamp01(0.5 - f) * 255);
    }
  return {
    det: e,
    nrm: t,
  };
}
