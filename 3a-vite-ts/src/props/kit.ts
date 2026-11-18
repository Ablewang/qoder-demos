import type {
  BufferGeometryEventMap,
  NormalBufferAttributes,
  Object3DEventMap,
} from "three";
import {
  BufferAttribute,
  BufferGeometry,
  Euler,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import {
  boxGeo,
  cylinderGeo,
  mergeGeos,
  tubeGeo,
  vertexColorGeo,
} from "../utils/geometry";

export function propRng(i: number) {
  let e = ((i | 0) * 2654435761) | 0;
  return () => {
    e = (e + 1831565813) | 0;
    let t = Math.imul(e ^ (e >>> 15), 1 | e);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(i: number, e: number) {
  let t = Math.sin(i * 127.1 + e * 311.7) * 43758.5453;
  return t - Math.floor(t);
}
export function valueNoise2(i: number, e: number) {
  let t = Math.floor(i),
    n = Math.floor(e),
    s = i - t,
    o = e - n,
    r = s * s * (3 - 2 * s),
    a = o * o * (3 - 2 * o),
    l = hash2(t, n),
    c = hash2(t + 1, n),
    u = hash2(t, n + 1),
    h = hash2(t + 1, n + 1);
  return l + (c - l) * r + (u - l) * a + (l - c - u + h) * r * a;
}
const clamp01 = (i: number) => Math.max(0, Math.min(1, i));
export const smoothstep01 = (i: number, e: number, t: number) => {
  let n = clamp01((t - i) / (e - i));
  return n * n * (3 - 2 * n);
};
export const lerp3 = (i: number[], e: number[], t: number) => [
  i[0] + (e[0] - i[0]) * t,
  i[1] + (e[1] - i[1]) * t,
  i[2] + (e[2] - i[2]) * t,
];
function bevelBoxGeo(i: number, e: number, t: number, n = 0.01, s = "center") {
  n = Math.max(5e-4, Math.min(n, i / 2 - 1e-4, e / 2 - 1e-4, t / 2 - 1e-4));
  let o = i / 2,
    r = e / 2,
    a = t / 2,
    l = new Float32Array(72),
    c = new Float32Array(72),
    u = new Float32Array(48),
    h = (x: number, y: number, b: number, m: number) =>
      ((x > 0 ? 1 : 0) + (y > 0 ? 2 : 0) + (b > 0 ? 4 : 0)) * 3 + m;
  for (let x of [-1, 1])
    for (let y of [-1, 1])
      for (let b of [-1, 1]) {
        let m = [
            [x * o, y * (r - n), b * (a - n)],
            [x * (o - n), y * r, b * (a - n)],
            [x * (o - n), y * (r - n), b * a],
          ],
          A = [
            [x, 0, 0],
            [0, y, 0],
            [0, 0, b],
          ];
        for (let _ = 0; _ < 3; _++) {
          let M = h(x, y, b, _);
          l.set(m[_], M * 3);
          c.set(A[_], M * 3);
          if (_ === 0) {
            u[M * 2] = m[_][2];
            u[M * 2 + 1] = m[_][1];
          } else if (_ === 1) {
            u[M * 2] = m[_][0];
            u[M * 2 + 1] = m[_][2];
          } else {
            u[M * 2] = m[_][0];
            u[M * 2 + 1] = m[_][1];
          }
        }
      }
  let f: number[] = [],
    p = (x: number, y: number, b: number) => {
      let m = l[x * 3],
        A = l[x * 3 + 1],
        _ = l[x * 3 + 2],
        M = l[y * 3] - m,
        E = l[y * 3 + 1] - A,
        w = l[y * 3 + 2] - _,
        S = l[b * 3] - m,
        z = l[b * 3 + 1] - A,
        H = l[b * 3 + 2] - _,
        O = E * H - w * z,
        q = w * S - M * H,
        U = M * z - E * S,
        T = m + (M + S) / 3,
        D = A + (E + z) / 3,
        C = _ + (w + H) / 3;
      if (O * T + q * D + U * C >= 0) {
        f.push(x, y, b);
      } else {
        f.push(x, b, y);
      }
    },
    d = (x: number, y: number, b: number, m: number) => {
      p(x, y, b);
      p(x, b, m);
    },
    v = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
  for (let x of [-1, 1]) {
    d(
      ...(v.map(([y, b]) => h(x, y, b, 0)) as [number, number, number, number]),
    );
    d(
      ...(v.map(([y, b]) => h(y, x, b, 1)) as [number, number, number, number]),
    );
    d(
      ...(v.map(([y, b]) => h(y, b, x, 2)) as [number, number, number, number]),
    );
  }
  for (let x of [-1, 1])
    for (let y of [-1, 1]) {
      d(h(-1, x, y, 1), h(1, x, y, 1), h(1, x, y, 2), h(-1, x, y, 2));
      d(h(x, -1, y, 0), h(x, 1, y, 0), h(x, 1, y, 2), h(x, -1, y, 2));
      d(h(x, y, -1, 0), h(x, y, 1, 0), h(x, y, 1, 1), h(x, y, -1, 1));
    }
  for (let x of [-1, 1])
    for (let y of [-1, 1])
      for (let b of [-1, 1]) p(h(x, y, b, 0), h(x, y, b, 1), h(x, y, b, 2));
  let g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(l, 3));
  g.setAttribute("normal", new BufferAttribute(c, 3));
  g.setAttribute("uv", new BufferAttribute(u, 2));
  g.setIndex(f);
  if (s === "bottom") {
    g.translate(0, e / 2, 0);
  }
  return g;
}
function orientLoftWinding(
  i: any,
  e: number[],
  t: number,
  n: number,
  s: number[],
  o: boolean,
) {
  let r = 0;
  for (let a = t; a < n; a += 9) {
    let l = i[a + 3] - i[a],
      c = i[a + 4] - i[a + 1],
      u = i[a + 5] - i[a + 2],
      h = i[a + 6] - i[a],
      f = i[a + 7] - i[a + 1],
      p = i[a + 8] - i[a + 2],
      d = c * p - u * f,
      v = u * h - l * p,
      g = l * f - c * h;
    r +=
      d * ((i[a] + i[a + 3] + i[a + 6]) / 3 - s[0]) +
      v * ((i[a + 1] + i[a + 4] + i[a + 7]) / 3 - s[1]) +
      g * ((i[a + 2] + i[a + 5] + i[a + 8]) / 3 - s[2]);
  }
  if (r < 0 != !!o) {
    for (let a = t; a < n; a += 9) {
      for (let c = 0; c < 3; c++) {
        let u = i[a + 3 + c];
        i[a + 3 + c] = i[a + 6 + c];
        i[a + 6 + c] = u;
      }
      let l = (a / 3) * 2;
      for (let c = 0; c < 2; c++) {
        let u = e[l + 2 + c];
        e[l + 2 + c] = e[l + 4 + c];
        e[l + 4 + c] = u;
      }
    }
  }
}
export function loftGeo(
  i: number[][],
  e: number[],
  t: any,
  {
    closed: n = false,
    center: s = null,
    inward: o = false,
    caps: r = false,
  }: {
    closed?: boolean;
    center?: number[] | null;
    inward?: boolean;
    caps?: boolean;
  } = {},
) {
  let a: any[] = [],
    l: number[] = [],
    c = i.length,
    u = n ? c : c - 1,
    h = [0];
  for (let g = 0; g < u; g++) {
    let x = i[g],
      y = i[(g + 1) % c];
    h.push(h[g] + Math.hypot(y[0] - x[0], y[1] - x[1]));
  }
  for (let g = 0; g < e.length - 1; g++) {
    let x = e[g],
      y = e[g + 1];
    for (let b = 0; b < u; b++) {
      let m = i[b],
        A = i[(b + 1) % c],
        _ = t(m[0], m[1], x, g),
        M = t(A[0], A[1], x, g),
        E = t(A[0], A[1], y, g + 1),
        w = t(m[0], m[1], y, g + 1);
      a.push(..._, ...M, ...E, ..._, ...E, ...w);
      l.push(h[b], x, h[b + 1], x, h[b + 1], y, h[b], x, h[b + 1], y, h[b], y);
    }
  }
  let f = a.length,
    p: number[] | null = null,
    d = () => {
      if (s) {
        return s;
      }
      if (!p) {
        p = [0, 0, 0];
        for (let x = 0; x < f; x += 3) {
          p[0] += a[x];
          p[1] += a[x + 1];
          p[2] += a[x + 2];
        }
        let g = 3 / f;
        p[0] *= g;
        p[1] *= g;
        p[2] *= g;
      }
      return p;
    };
  orientLoftWinding(a, l, 0, f, d(), o);
  if (r && n) {
    let g = 0,
      x = 0;
    for (let y of i) {
      g += y[0];
      x += y[1];
    }
    g /= c;
    x /= c;
    for (let y of [0, e.length - 1]) {
      let b = a.length,
        m = e[y],
        A = t(g, x, m, y);
      for (let _ = 0; _ < c; _++) {
        let M = i[_],
          E = i[(_ + 1) % c];
        a.push(...A, ...t(M[0], M[1], m, y), ...t(E[0], E[1], m, y));
        l.push(g, x, M[0], M[1], E[0], E[1]);
      }
      orientLoftWinding(a, l, b, a.length, d(), o);
    }
  }
  let v = new BufferGeometry();
  v.setAttribute("position", new BufferAttribute(new Float32Array(a), 3));
  v.setAttribute("uv", new BufferAttribute(new Float32Array(l), 2));
  v.computeVertexNormals();
  return v;
}
function corrugationDepthAt(
  i: number,
  e: number,
  t: number,
  n: number,
  s: number,
) {
  let o = i % e;
  if (o < 0) {
    o += e;
  }
  let r = e - n - 2 * s;
  return o <= n
    ? 0
    : o < n + s
      ? (-t * (o - n)) / s
      : o <= n + s + r
        ? -t
        : -t * (1 - (o - n - s - r) / s);
}
export function corrugationProfile(
  i: number,
  e: number,
  t: number,
  n: number,
  s: number,
  o: number,
  r = i,
) {
  let a = t - s - 2 * o,
    l = [0, s, s + o, s + o + a],
    c = [i],
    u = Math.floor((i - r) / t) - 1,
    h = Math.ceil((e - r) / t) + 1;
  for (let f = u; f <= h; f++)
    for (let p of l) {
      let d = r + f * t + p;
      if (d > i + 1e-4 && d < e - 1e-4) {
        c.push(d);
      }
    }
  c.push(e);
  return c.map((f) => [f, corrugationDepthAt(f - r, t, n, s, o)]);
}
export function roundedRectPath(i: number, e: number, t = 5) {
  let n: number[][] = [],
    s = Math.min(i, e) / 2,
    o = i / 2 - s,
    r = e / 2 - s;
  for (let u = 0; u < 4; u++)
    for (let h = 0; h <= t; h++) {
      let f = ((u + h / t) * Math.PI) / 2;
      n.push([
        Math.cos(f) * s + (u === 0 || u === 3 ? o : -o),
        Math.sin(f) * s + (u < 2 ? r : -r),
      ]);
    }
  let a: number[] = [],
    l: number[] = [];
  for (let u = 0; u < n.length; u++) {
    let h = n[u],
      f = n[(u + 1) % n.length];
    a.push(0, 0, 0, h[0], h[1], 0, f[0], f[1], 0);
    l.push(
      0.5,
      0.5,
      h[0] / i + 0.5,
      h[1] / e + 0.5,
      f[0] / i + 0.5,
      f[1] / e + 0.5,
    );
  }
  let c = new BufferGeometry();
  c.setAttribute("position", new BufferAttribute(new Float32Array(a), 3));
  c.setAttribute("uv", new BufferAttribute(new Float32Array(l), 2));
  c.computeVertexNormals();
  return c;
}
export function planeGeo(i: number, e: number) {
  return new PlaneGeometry(i, e);
}
export function planeGeoUv(i: number, e: number) {
  let t = new PlaneGeometry(i, e),
    n = t.attributes.uv;
  for (let s = 0; s < n.count; s++) n.setXY(s, n.getX(s) * i, n.getY(s) * e);
  return t;
}
function flatShade(i: BufferGeometry) {
  let e = i.index ? i.toNonIndexed() : i;
  e.computeVertexNormals();
  return e;
}
export function sphereGeo(
  i: number,
  e = 10,
  t = 6,
  n = Math.PI * 2,
  s = 0,
  o = Math.PI,
) {
  return new SphereGeometry(i, e, t, 0, n, s, o);
}
export function latheGeo(i: number[][], e = 16) {
  return new LatheGeometry(
    i.map((t) => new Vector2(t[0], t[1])),
    e,
  );
}
const _placeEuler = new Euler();
const _placeQuat = new Quaternion();
const _placeGeoMat = new Matrix4();
const _placePos = new Vector3();
const _propUnitScale = new Vector3(1, 1, 1);
export function placeGeo(
  i: BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>,
  e = 0,
  t = 0,
  n = 0,
  s: any = null,
) {
  if (s) {
    _placeEuler.set(s[0], s[1], s[2]);
    _placeQuat.setFromEuler(_placeEuler);
  } else {
    _placeQuat.identity();
  }
  _placePos.set(e, t, n);
  _placeGeoMat.compose(_placePos, _placeQuat, _propUnitScale);
  i.applyMatrix4(_placeGeoMat);
  return i;
}
export function placeMatrix(i = 0, e = 0, t = 0, n: number[] | null = null) {
  if (n) {
    _placeEuler.set(n[0], n[1], n[2]);
    _placeQuat.setFromEuler(_placeEuler);
  } else {
    _placeQuat.identity();
  }
  _placePos.set(i, e, t);
  return new Matrix4().compose(_placePos, _placeQuat, _propUnitScale);
}
export const PropBuilder = class {
  declare defCol: any;
  declare m: any;
  declare stack: any;
  declare buckets: any;
  declare G: any;
  constructor(e: any) {
    this.G = e;
    this.buckets = new Map();
    this.stack = [];
    this.m = null;
    this.defCol = new Map();
  }
  M(e: string, t?: { vertexColors: boolean } | { doubleSide: boolean }) {
    return this.G.mats.get(e, t);
  }
  push(e: Matrix4) {
    this.stack.push(this.m);
    this.m = this.m ? this.m.clone().multiply(e) : e.clone();
    return this;
  }
  pop() {
    this.m = this.stack.pop();
    return this;
  }
  add(
    e: { body?: boolean; em?: boolean },
    t: BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>,
    n?: any,
    s?: boolean,
  ) {
    if (this.m) {
      t.applyMatrix4(this.m);
    }
    let o = n || this.defCol.get(e);
    if (o) {
      vertexColorGeo(t, o);
    }
    let r = this.buckets.get(e);
    if (!r) {
      r = {
        mat: e,
        geos: [],
        cast: !s,
      };
      this.buckets.set(e, r);
    }
    r.geos.push(t);
    return t;
  }
  box(
    e: { body: boolean },
    t: number,
    n: number,
    s: number,
    o: number,
    r: number,
    a: number,
    l: { r?: any; rot?: any; col?: any } = {},
  ) {
    return this.add(
      e,
      placeGeo(
        l.r === 0
          ? boxGeo(t, n, s)
          : bevelBoxGeo(
              t,
              n,
              s,
              l.r || Math.min(0.012, Math.min(t, n, s) * 0.25),
            ),
        o,
        r,
        a,
        l.rot,
      ),
      l.col,
    );
  }
  cyl(
    e: { body?: boolean; em?: boolean },
    t: number,
    n: number,
    s: number,
    o: number,
    r: number,
    a: number,
    l: {
      seg?: number;
      open?: boolean;
      flat?: boolean;
      rot?: number[];
      col?: ((d: number, v: number, g: number) => number[]) | number[];
    } = {},
  ) {
    let c: BufferGeometry = cylinderGeo(t, n, s, l.seg || 12, !!l.open);
    if (l.flat) {
      c = flatShade(c);
    }
    return this.add(e, placeGeo(c, o, r, a, l.rot), l.col);
  }
  tube(
    e: { body?: boolean; em?: boolean },
    t: number[][],
    n: number,
    s: { seg?: number; tension?: number; col?: any } = {},
  ) {
    return this.add(
      e,
      tubeGeo(
        t,
        n,
        s.seg || 6,
        false,
        s.tension === undefined ? 0.5 : s.tension,
      ),
      s.col,
    );
  }
  bar(
    e: { body?: boolean; em?: boolean },
    t: number[],
    n: number[],
    s: number,
    o: { caps?: boolean; seg?: number; r2?: number; col?: any } = {},
  ) {
    let r = new Vector3(n[0] - t[0], n[1] - t[1], n[2] - t[2]),
      a = r.length(),
      l = cylinderGeo(o.r2 === undefined ? s : o.r2, s, a, o.seg || 6, !o.caps),
      c = new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        r.normalize(),
      );
    l.applyMatrix4(
      new Matrix4().compose(
        new Vector3((t[0] + n[0]) / 2, (t[1] + n[1]) / 2, (t[2] + n[2]) / 2),
        c,
        _propUnitScale,
      ),
    );
    return this.add(e, l, o.col);
  }
  beam(
    e: { body?: boolean; em?: boolean },
    t: number[],
    n: number[],
    s: number,
    o: number,
    r: { r?: number; twist?: any; col?: any } = {},
  ) {
    let a = new Vector3(n[0] - t[0], n[1] - t[1], n[2] - t[2]),
      l = a.length(),
      c =
        r.r === 0
          ? boxGeo(s, l, o)
          : bevelBoxGeo(s, l, o, r.r || Math.min(s, o) * 0.2),
      u = new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        a.normalize(),
      );
    if (r.twist) {
      u.multiply(
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), r.twist),
      );
    }
    c.applyMatrix4(
      new Matrix4().compose(
        new Vector3((t[0] + n[0]) / 2, (t[1] + n[1]) / 2, (t[2] + n[2]) / 2),
        u,
        _propUnitScale,
      ),
    );
    return this.add(e, c, r.col);
  }
  decal(
    e: { material: { body?: boolean; em?: boolean }; aspect: number },
    t: number,
    n: number,
    s: number,
    o: number,
    r: null | number[],
    a?: number,
  ) {
    return this.add(
      e.material,
      placeGeo(planeGeo(a || t * e.aspect, t), n, s, o, r),
      null,
      true,
    );
  }
  parts() {
    let e: any[] = [];
    for (let t of this.buckets.values())
      e.push({
        mat: t.mat,
        geo: mergeGeos(t.geos),
        cast: t.cast,
      });
    return e;
  }
  group(e?: any) {
    return groupFromParts(this.parts(), e);
  }
};
export function groupFromParts(i: any, e: any) {
  let t = new Group();
  for (let n of i) {
    let s = new Mesh(n.geo, (e && e.get(n.mat)) || n.mat);
    s.castShadow = n.cast;
    s.receiveShadow = true;
    t.add(s);
  }
  return t;
}
export function tagProp(
  i: Group<Object3DEventMap>,
  e: string,
  t: any,
  n: (
    | { min: number[]; max: number[]; surface: string; bulletOnly?: undefined }
    | { min: number[]; max: number[]; surface: string; bulletOnly: boolean }
  )[],
) {
  i.userData.size = t;
  i.userData.colliders = n;
  i.name = e;
  return i;
}
const labelDecalCache = new WeakMap();
export function labelMaterial(
  i: any,
  e: any,
  t: { color: string; font: string; distress: number },
) {
  let n = labelDecalCache.get(i.mats);
  if (!n) {
    n = new Map();
    labelDecalCache.set(i.mats, n);
  }
  let s = "L|" + e + "|" + JSON.stringify(t || {});
  if (!n.has(s)) {
    let o: any;
    try {
      o = i.mats.label(e, t || {});
    } catch {
      o = null;
    }
    n.set(
      s,
      o && o.material
        ? o
        : {
            material: i.mats.get("paint_white"),
            aspect: Math.max(1, e.length * 0.6),
          },
    );
  }
  return n.get(s);
}
export function decalMaterial(i: any, e: string) {
  let t = labelDecalCache.get(i.mats);
  if (!t) {
    t = new Map();
    labelDecalCache.set(i.mats, t);
  }
  let n = "D|" + e;
  if (!t.has(n)) {
    let s: any;
    try {
      s = i.mats.decal(e);
    } catch {
      s = null;
    }
    t.set(
      n,
      s && s.material
        ? s
        : {
            material: i.mats.get("paint_white"),
            aspect: 1,
          },
    );
  }
  return t.get(n);
}
