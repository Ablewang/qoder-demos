import type {
  BufferGeometryEventMap,
  CylinderGeometry,
  NormalBufferAttributes,
} from "three";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Euler,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  ShapeUtils,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from "three";
import { cylinderGeo, mergeGeos } from "../utils/geometry";

export const PI = Math.PI;
export const HALF_PI = Math.PI / 2;
export const clampRange = (i: number, e: number, t: number) =>
  Math.min(t, Math.max(e, i));
function hash3(i: number, e: number, t: number) {
  let n =
    Math.imul(i, 374761393) ^
    Math.imul(e, 668265263) ^
    Math.imul(t, 2147483647);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function valueNoise3(i: number, e = 0, t = 0) {
  let n = Math.floor(i),
    s = Math.floor(e),
    o = Math.floor(t),
    r = i - n,
    a = e - s,
    l = t - o;
  r = r * r * (3 - 2 * r);
  a = a * a * (3 - 2 * a);
  l = l * l * (3 - 2 * l);
  let c = (u: number, h: number, f: number) => u + (h - u) * f;
  return c(
    c(
      c(hash3(n, s, o), hash3(n + 1, s, o), r),
      c(hash3(n, s + 1, o), hash3(n + 1, s + 1, o), r),
      a,
    ),
    c(
      c(hash3(n, s, o + 1), hash3(n + 1, s, o + 1), r),
      c(hash3(n, s + 1, o + 1), hash3(n + 1, s + 1, o + 1), r),
      a,
    ),
    l,
  );
}
function rawGeo(i: any, e: number[] | null, t: number[], n: number[]) {
  let s = new BufferGeometry();
  s.setAttribute("position", new BufferAttribute(new Float32Array(i), 3));
  if (e) {
    s.setAttribute("normal", new BufferAttribute(new Float32Array(e), 3));
  }
  s.setAttribute("uv", new BufferAttribute(new Float32Array(t), 2));
  if (n) {
    s.setIndex(n);
  }
  if (!e) {
    s.computeVertexNormals();
  }
  return s;
}
export function ringStripGeo(i: number[][], e = 16) {
  let t = i.length,
    n: number[] = [],
    s: number[] = [],
    o: number[] = [],
    r: number[] = [],
    a: number[] = [],
    l: number[] = [],
    c: number[] = [],
    u = 0,
    h = 0;
  for (let f = 0; f < t; f++) {
    let p = 0,
      d = 0;
    if (f > 0) {
      let g = i[f][0] - i[f - 1][0],
        x = i[f][1] - i[f - 1][1],
        y = Math.hypot(g, x);
      if (y > 1e-6) {
        p += g / y;
        d += x / y;
        h += y;
      }
    }
    if (f < t - 1) {
      let g = i[f + 1][0] - i[f][0],
        x = i[f + 1][1] - i[f][1],
        y = Math.hypot(g, x);
      if (y > 1e-6) {
        p += g / y;
        d += x / y;
      }
    }
    let v = Math.hypot(p, d) || 1;
    a.push(d / v);
    l.push(-p / v);
    c.push(h);
    u = Math.max(u, i[f][0]);
  }
  for (let f = 0; f < t; f++)
    for (let p = 0; p <= e; p++) {
      let d = (p / e) * PI * 2,
        v = Math.cos(d),
        g = Math.sin(d);
      n.push(i[f][0] * v, i[f][1], i[f][0] * g);
      s.push(a[f] * v, l[f], a[f] * g);
      o.push((p / e) * PI * 2 * u, c[f]);
    }
  for (let f = 0; f < t - 1; f++)
    if (!(Math.hypot(i[f + 1][0] - i[f][0], i[f + 1][1] - i[f][1]) < 1e-6)) {
      for (let p = 0; p < e; p++) {
        let d = f * (e + 1) + p,
          v = d + e + 1,
          g = v + 1,
          x = d + 1;
        if (i[f][0] > 1e-6) {
          r.push(d, v, x);
        }
        if (i[f + 1][0] > 1e-6) {
          r.push(v, g, x);
        }
      }
    }
  return rawGeo(n, s, o, r);
}
export function chamferBoxGeo(
  i: number,
  e: number,
  t: number,
  n = 0.008,
  s = "center",
) {
  let o = [i / 2, e / 2, t / 2];
  n = Math.min(n, o[0] * 0.9, o[1] * 0.9, o[2] * 0.9);
  let r: number[] = [],
    a: number[] = [],
    l: number[] = [],
    c: number[] = [];
  for (let p = 0; p < 8; p++)
    for (let d = 0; d < 3; d++) {
      let v = [p & 1 ? 1 : -1, p & 2 ? 1 : -1, p & 4 ? 1 : -1],
        g = [0, 1, 2].map((x) => v[x] * (o[x] - (x !== d ? n : 0)));
      r.push(g[0], g[1], g[2]);
      a.push(d === 0 ? v[0] : 0, d === 1 ? v[1] : 0, d === 2 ? v[2] : 0);
      if (d === 0) {
        l.push(g[2], g[1]);
      } else if (d === 1) {
        l.push(g[0], g[2]);
      } else {
        l.push(g[0], g[1]);
      }
    }
  let u = (p: number, d: number) => p * 3 + d,
    h = (p: number, d: number, v: number, g: number, x: number, y: number) => {
      let b = r[d * 3] - r[p * 3],
        m = r[d * 3 + 1] - r[p * 3 + 1],
        A = r[d * 3 + 2] - r[p * 3 + 2],
        _ = r[v * 3] - r[p * 3],
        M = r[v * 3 + 1] - r[p * 3 + 1],
        E = r[v * 3 + 2] - r[p * 3 + 2];
      if (
        (m * E - A * M) * g + (A * _ - b * E) * x + (b * M - m * _) * y >=
        0
      ) {
        c.push(p, d, v);
      } else {
        c.push(p, v, d);
      }
    };
  for (let p = 0; p < 3; p++) {
    let d = (p + 1) % 3,
      v = (p + 2) % 3;
    for (let g of [0, 1]) {
      let x = [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ].map(([b, m]) => (g << p) | (b << d) | (m << v)),
        y = [0, 0, 0];
      y[p] = g ? 1 : -1;
      h(u(x[0], p), u(x[1], p), u(x[2], p), ...(y as [number, number, number]));
      h(u(x[0], p), u(x[2], p), u(x[3], p), ...(y as [number, number, number]));
    }
    for (let g of [0, 1])
      for (let x of [0, 1]) {
        let y = (g << d) | (x << v),
          b = y | (1 << p),
          m = [0, 0, 0];
        m[d] = g ? 1 : -1;
        m[v] = x ? 1 : -1;
        h(u(y, d), u(b, d), u(b, v), ...(m as [number, number, number]));
        h(u(y, d), u(b, v), u(y, v), ...(m as [number, number, number]));
      }
  }
  for (let p = 0; p < 8; p++)
    h(
      u(p, 0),
      u(p, 1),
      u(p, 2),
      p & 1 ? 1 : -1,
      p & 2 ? 1 : -1,
      p & 4 ? 1 : -1,
    );
  let f = rawGeo(r, a, l, c);
  if (s === "bottom") {
    f.translate(0, e / 2, 0);
  }
  return f;
}
export function softBoxGeo(
  i: number,
  e: number,
  t: number,
  n = 0.03,
  s = 3,
  o = 3,
  r = 3,
  a = "center",
) {
  let l = new BoxGeometry(i, e, t, s, o, r),
    c = l.attributes.position,
    u = l.attributes.normal,
    h = l.attributes.uv,
    f = i / 2,
    p = e / 2,
    d = t / 2;
  n = Math.min(n, f * 0.95, p * 0.95, d * 0.95);
  let v = (x: number, y: number, b: number) => {
      if (Math.abs(x) > y - 1e-6 || b < 3) {
        return x;
      }
      let m = (2 * y) / b;
      return (x * (y - n)) / (y - m);
    },
    g = new Vector3();
  for (let x = 0; x < c.count; x++) {
    let y = v(c.getX(x), f, s),
      b = v(c.getY(x), p, o),
      m = v(c.getZ(x), d, r),
      A = clampRange(y, -(f - n), f - n),
      _ = clampRange(b, -(p - n), p - n),
      M = clampRange(m, -(d - n), d - n);
    g.set(y - A, b - _, m - M);
    if (
      (Math.abs(y) > f - 1e-5 ? 1 : 0) +
        (Math.abs(b) > p - 1e-5 ? 1 : 0) +
        (Math.abs(m) > d - 1e-5 ? 1 : 0) >=
        2 &&
      g.lengthSq() > 1e-12
    ) {
      g.normalize();
      y = A + g.x * n;
      b = _ + g.y * n;
      m = M + g.z * n;
      u.setXYZ(x, g.x, g.y, g.z);
    }
    c.setXYZ(x, y, b, m);
    let w = Math.abs(u.getX(x)),
      S = Math.abs(u.getY(x)),
      z = Math.abs(u.getZ(x));
    if (w >= S && w >= z) {
      h.setXY(x, m, b);
    } else if (S >= w && S >= z) {
      h.setXY(x, y, m);
    } else {
      h.setXY(x, y, b);
    }
  }
  if (a === "bottom") {
    l.translate(0, e / 2, 0);
  }
  return l;
}
export function displaceGeo(
  i:
    | BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>
    | BoxGeometry,
  e: any,
) {
  let t = i.attributes.position,
    n = new Vector3();
  for (let s = 0; s < t.count; s++) {
    n.fromBufferAttribute(t, s);
    e(n, s);
    t.setXYZ(s, n.x, n.y, n.z);
  }
  return i;
}
export function weldGeo(i: BoxGeometry) {
  let e = i.attributes.position,
    t = i.index,
    n = e.count,
    s = new Map(),
    o = (f: number) =>
      Math.round(e.getX(f) * 2e3) +
      "," +
      Math.round(e.getY(f) * 2e3) +
      "," +
      Math.round(e.getZ(f) * 2e3),
    r = new Array(n);
  for (let f = 0; f < n; f++) r[f] = o(f);
  let a = new Vector3(),
    l = new Vector3(),
    c = new Vector3(),
    u = t ? t.count : n;
  for (let f = 0; f < u; f += 3) {
    let p = t ? t.getX(f) : f,
      d = t ? t.getX(f + 1) : f + 1,
      v = t ? t.getX(f + 2) : f + 2;
    a.fromBufferAttribute(e, p);
    l.fromBufferAttribute(e, d);
    c.fromBufferAttribute(e, v);
    l.sub(a);
    c.sub(a);
    l.cross(c);
    for (let g of [p, d, v]) {
      let x = s.get(r[g]);
      if (!x) {
        x = [0, 0, 0];
        s.set(r[g], x);
      }
      x[0] += l.x;
      x[1] += l.y;
      x[2] += l.z;
    }
  }
  let h = new Float32Array(n * 3);
  for (let f = 0; f < n; f++) {
    let p = s.get(r[f]) || [0, 1, 0],
      d = Math.hypot(p[0], p[1], p[2]) || 1;
    h[f * 3] = p[0] / d;
    h[f * 3 + 1] = p[1] / d;
    h[f * 3 + 2] = p[2] / d;
  }
  i.setAttribute("normal", new BufferAttribute(h, 3));
  return i;
}
export function flipWinding(i: CylinderGeometry | PlaneGeometry) {
  if (i.index) {
    let t = i.index.array;
    for (let n = 0; n < t.length; n += 3) {
      let s = t[n + 1];
      t[n + 1] = t[n + 2];
      t[n + 2] = s;
    }
  } else {
    for (let t of Object.keys(i.attributes)) {
      let n = i.attributes[t],
        s = n.itemSize,
        o = n.array;
      for (let r = 0; r < n.count; r += 3)
        for (let a = 0; a < s; a++) {
          let l = o[(r + 1) * s + a];
          o[(r + 1) * s + a] = o[(r + 2) * s + a];
          o[(r + 2) * s + a] = l;
        }
    }
  }
  let e = i.attributes.normal.array;
  for (let t = 0; t < e.length; t++) e[t] = -e[t];
  return i;
}
export function dropGroup(i: BoxGeometry, e: number) {
  let t = i.groups[e];
  if (!t) {
    return i;
  }
  let n = Array.from(i.index!.array);
  n.splice(t.start, t.count);
  i.setIndex(n);
  for (let s of i.groups) {
    if (s.start > t.start) {
      s.start -= t.count;
    }
  }
  t.count = 0;
  return i;
}
const _rodGeoQuat = new Quaternion();
const _rodGeoUp = new Vector3(0, 1, 0);
const _rodGeoDir = new Vector3();
const _rodGeoMat = new Matrix4();
export function rodGeo(
  i: number[],
  e: number[],
  t = 0.02,
  n = 6,
  s = false,
  o = t,
) {
  _rodGeoDir.set(e[0] - i[0], e[1] - i[1], e[2] - i[2]);
  let r = _rodGeoDir.length();
  _rodGeoDir.normalize();
  let a = cylinderGeo(o, t, r, n, !s);
  _rodGeoQuat.setFromUnitVectors(_rodGeoUp, _rodGeoDir);
  _rodGeoMat.compose(
    new Vector3((i[0] + e[0]) / 2, (i[1] + e[1]) / 2, (i[2] + e[2]) / 2),
    _rodGeoQuat,
    new Vector3(1, 1, 1),
  );
  a.applyMatrix4(_rodGeoMat);
  return a;
}
export function pillowGeo(
  i: number[][],
  e: number,
  { soft: t = 0.6, caps: n = true }: { soft?: number; caps?: boolean } = {},
) {
  let s = i.length,
    o: number[] = [],
    r: number[] = [],
    a: number[] = [],
    l: number[] = [],
    c = e / 2,
    u: number[][] = [],
    h = 0,
    f = [0];
  for (let d = 0; d < s; d++) {
    let v = i[d],
      g = i[(d + 1) % s],
      x = g[0] - v[0],
      y = g[1] - v[1],
      b = Math.hypot(x, y) || 1;
    u.push([y / b, -x / b]);
    h += b;
    f.push(h);
  }
  let p = (d: number, v: number) => {
    let g = u[d],
      x = u[(v + s) % s];
    if (g[0] * x[0] + g[1] * x[1] > Math.cos(t)) {
      let y = g[0] + x[0],
        b = g[1] + x[1],
        m = Math.hypot(y, b) || 1;
      return [y / m, b / m];
    }
    return g;
  };
  for (let d = 0; d < s; d++) {
    let v = i[d],
      g = i[(d + 1) % s],
      x = p(d, d - 1),
      y = p(d, d + 1),
      b = o.length / 3;
    o.push(v[0], v[1], c, v[0], v[1], -c, g[0], g[1], -c, g[0], g[1], c);
    r.push(x[0], x[1], 0, x[0], x[1], 0, y[0], y[1], 0, y[0], y[1], 0);
    a.push(f[d], c, f[d], -c, f[d + 1], -c, f[d + 1], c);
    l.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  if (n) {
    let d = ShapeUtils.triangulateShape(
      i.map((v) => new Vector2(v[0], v[1])),
      [],
    );
    for (let v of [1, -1]) {
      let g = o.length / 3;
      for (let x of i) {
        o.push(x[0], x[1], v * c);
        r.push(0, 0, v);
        a.push(x[0], x[1]);
      }
      for (let x of d) {
        if (v > 0) {
          l.push(g + x[0], g + x[1], g + x[2]);
        } else {
          l.push(g + x[0], g + x[2], g + x[1]);
        }
      }
    }
  }
  return rawGeo(o, r, a, l);
}
export function ribbonGeo(i: any, e: number[], t = true) {
  let n = i.length,
    s: any[] = [],
    o: number[] = [],
    r: number[] = [],
    a = 0,
    l = Math.hypot(e[0], e[1], e[2]) * 2;
  for (let p = 0; p < n; p++) {
    if (p) {
      a += Math.hypot(
        i[p][0] - i[p - 1][0],
        i[p][1] - i[p - 1][1],
        i[p][2] - i[p - 1][2],
      );
    }
    s.push(
      i[p][0] - e[0],
      i[p][1] - e[1],
      i[p][2] - e[2],
      i[p][0] + e[0],
      i[p][1] + e[1],
      i[p][2] + e[2],
    );
    o.push(a, 0, a, l);
  }
  for (let p = 0; p < n - 1; p++) {
    let d = p * 2;
    r.push(d, d + 1, d + 3, d, d + 3, d + 2);
  }
  let c = rawGeo(s, null, o, r);
  if (!t) {
    return c;
  }
  let u = c.clone(),
    h = u.index!.array;
  for (let p = 0; p < h.length; p += 3) {
    let d = h[p + 1];
    h[p + 1] = h[p + 2];
    h[p + 2] = d;
  }
  let f = u.attributes.normal.array;
  for (let p = 0; p < f.length; p++) f[p] = -f[p];
  return mergeGeos([c, u]);
}
export function planeGeo2(i: number, e: number | undefined) {
  return new PlaneGeometry(i, e);
}
export function sagPlaneGeo(i: number, e: number, t: number, n = 4) {
  let s: number[] = [],
    o: number[] = [],
    r: number[] = [],
    a: number[] = [];
  for (let l = 0; l <= n; l++) {
    let c = ((l / n - 0.5) * e) / i,
      u = Math.sin(c),
      h = Math.cos(c);
    s.push(i * u, -t / 2, i * h, i * u, t / 2, i * h);
    o.push(u, 0, h, u, 0, h);
    r.push(l / n, 0, l / n, 1);
  }
  for (let l = 0; l < n; l++) {
    let c = l * 2;
    a.push(c, c + 2, c + 3, c, c + 3, c + 1);
  }
  return rawGeo(s, o, r, a);
}
export function torusGeo(i: number, e: number, t = 6, n = 12, s = PI * 2) {
  let o = new TorusGeometry(i, e, t, n, s),
    r = o.attributes.uv;
  for (let a = 0; a < r.count; a++)
    r.setXY(a, r.getX(a) * s * i, r.getY(a) * 2 * PI * e);
  return o;
}
export function sphereGeoUv(i: number, e = 8, t = 6) {
  let n = new SphereGeometry(i, e, t),
    s = n.attributes.uv;
  for (let o = 0; o < s.count; o++)
    s.setXY(o, s.getX(o) * 2 * PI * i, s.getY(o) * PI * i);
  return n;
}
export function tintVertexColors(
  i: BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>,
  e:
    | number
    | number[]
    | ((x: number, y: number, z: number) => number | number[])
    | null
    | undefined,
) {
  let t = i.attributes.position.count,
    n = i.attributes.color;
  if (!n) {
    n = new BufferAttribute(new Float32Array(t * 3).fill(1), 3);
    i.setAttribute("color", n);
  }
  if (e === 1 || e == null) {
    return i;
  }
  let s = n.array;
  if (typeof e == "function") {
    let l = i.attributes.position;
    for (let c = 0; c < t; c++) {
      let u = e(l.getX(c), l.getY(c), l.getZ(c));
      if (typeof u == "number") {
        s[c * 3] *= u;
        s[c * 3 + 1] *= u;
        s[c * 3 + 2] *= u;
      } else {
        s[c * 3] *= u[0];
        s[c * 3 + 1] *= u[1];
        s[c * 3 + 2] *= u[2];
      }
    }
    return i;
  }
  let o = typeof e == "number" ? e : e[0],
    r = typeof e == "number" ? e : e[1],
    a = typeof e == "number" ? e : e[2];
  for (let l = 0; l < t; l++) {
    s[l * 3] *= o;
    s[l * 3 + 1] *= r;
    s[l * 3 + 2] *= a;
  }
  return i;
}
const PAINT_COLORS: Record<string, [string, number | number[]]> = {
  red: ["paint_red", 1],
  blue: ["paint_blue", 1],
  green: ["paint_green", 1],
  yellow: ["paint_yellow", 1],
  orange: ["paint_orange", 1],
  white: ["paint_white", 1],
  grey: ["paint_grey", 1],
  teal: ["paint_teal", 1],
  rust: ["steel_rust", 1],
  black: ["paint_grey", [0.2, 0.2, 0.22]],
  olive: ["paint_green", [0.75, 0.8, 0.45]],
};
export function paintMaterial(i: string | number, e = "blue") {
  return PAINT_COLORS[i] || PAINT_COLORS[e];
}
const _clutterComposeMat = new Matrix4();
const _composeMatQuat = new Quaternion();
const _composeMatEuler = new Euler();
const _composeMatPos = new Vector3();
const _composeMatScale = new Vector3();
export function composeMatrix({
  p: i = [0, 0, 0],
  r: e = [0, 0, 0],
  s: t = 1,
}: { p?: number[]; r?: number[]; s?: number | number[] } = {}) {
  _composeMatEuler.set(e[0], e[1], e[2]);
  _composeMatQuat.setFromEuler(_composeMatEuler);
  _composeMatPos.set(i[0], i[1], i[2]);
  if (typeof t == "number") {
    _composeMatScale.set(t, t, t);
  } else {
    _composeMatScale.set(t[0], t[1], t[2]);
  }
  return new Matrix4().compose(
    _composeMatPos,
    _composeMatQuat,
    _composeMatScale,
  );
}
