// Shared geometry helpers (UV-normalised boxes, cylinders, tubes, merging).
import type {
  BufferGeometryEventMap,
  ExtrudeGeometry,
  InstancedMesh,
  Material,
  NormalBufferAttributes,
  Object3D,
  Object3DEventMap,
  PlaneGeometry,
  SkinnedMesh,
} from "three";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Euler,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "./buffer-geometry-utils";

const _bevelNormal = new Vector3();
export function boxGeo(i: any, e: any, t: any, n = "center") {
  let s = new BoxGeometry(i, e, t),
    o = s.attributes.uv,
    r = s.attributes.position,
    a = s.attributes.normal;
  for (let l = 0; l < o.count; l++) {
    let c = Math.abs(a.getX(l)),
      u = Math.abs(a.getY(l)),
      h = r.getX(l),
      f = r.getY(l),
      p = r.getZ(l);
    if (c > 0.5) {
      o.setXY(l, p, f);
    } else if (u > 0.5) {
      o.setXY(l, h, p);
    } else {
      o.setXY(l, h, f);
    }
  }
  if (n === "bottom") {
    s.translate(0, e! / 2, 0);
  }
  return s;
}
export function roundedBoxGeo(
  i: number,
  e: number,
  t: number,
  n = 0.02,
  s = "center",
) {
  n = Math.min(n, i / 2 - 1e-4, e / 2 - 1e-4, t / 2 - 1e-4);
  let o = new BoxGeometry(i, e, t, 3, 3, 3),
    r = o.attributes.position,
    a = o.attributes.normal,
    l = o.attributes.uv,
    c = i / 2,
    u = e / 2,
    h = t / 2,
    f = (p: number, d: number) => {
      let v = Math.abs(p),
        g = Math.sign(p);
      return v > d - 1e-5 ? g * d : g * (d - n);
    };
  for (let p = 0; p < r.count; p++) {
    let d = f(r.getX(p), c),
      v = f(r.getY(p), u),
      g = f(r.getZ(p), h),
      x = Math.max(-(c - n), Math.min(c - n, d)),
      y = Math.max(-(u - n), Math.min(u - n, v)),
      b = Math.max(-(h - n), Math.min(h - n, g));
    _bevelNormal.set(d - x, v - y, g - b);
    if (_bevelNormal.lengthSq() > 1e-10) {
      _bevelNormal.normalize();
      let M = a.getX(p),
        E = a.getY(p),
        w = a.getZ(p);
      if (
        (Math.abs(d) > c - 1e-5 ? 1 : 0) +
          (Math.abs(v) > u - 1e-5 ? 1 : 0) +
          (Math.abs(g) > h - 1e-5 ? 1 : 0) >=
        2
      ) {
        d = x + _bevelNormal.x * n;
        v = y + _bevelNormal.y * n;
        g = b + _bevelNormal.z * n;
        a.setXYZ(p, _bevelNormal.x, _bevelNormal.y, _bevelNormal.z);
      } else {
        a.setXYZ(p, M, E, w);
      }
    }
    r.setXYZ(p, d, v, g);
    let m = Math.abs(a.getX(p)),
      A = Math.abs(a.getY(p)),
      _ = Math.abs(a.getZ(p));
    if (m >= A && m >= _) {
      l.setXY(p, g, v);
    } else if (A >= m && A >= _) {
      l.setXY(p, d, g);
    } else {
      l.setXY(p, d, v);
    }
  }
  if (s === "bottom") {
    o.translate(0, e / 2, 0);
  }
  return o;
}
export function cylinderGeo(
  i: number | undefined,
  e: number | undefined,
  t: number | undefined,
  n = 16,
  s = false,
  o = "center",
) {
  let r = new CylinderGeometry(i, e, t, n, 1, s),
    a = r.attributes.uv,
    l = r.attributes.position,
    c = r.attributes.normal,
    u = Math.PI * (i! + e!);
  for (let h = 0; h < a.count; h++) {
    if (Math.abs(c.getY(h)) > 0.9) {
      a.setXY(h, l.getX(h), l.getZ(h));
    } else {
      a.setXY(h, a.getX(h) * u, l.getY(h));
    }
  }
  if (o === "bottom") {
    r.translate(0, t! / 2, 0);
  }
  return r;
}
export function tubeGeo(
  i: (number[] | Vector3)[],
  e = 0.03,
  t = 8,
  n = false,
  s = 0,
) {
  let o = i.map((h) =>
      (h as Vector3).isVector3
        ? (h as Vector3)
        : new Vector3(
            (h as number[])[0],
            (h as number[])[1],
            (h as number[])[2],
          ),
    ),
    r = new CatmullRomCurve3(o, n, "catmullrom", s),
    a = r.getLength(),
    l = Math.max(2, Math.ceil(a / Math.max(0.08, e * 3))),
    c = new TubeGeometry(r, Math.min(l, 400), e, t, n),
    u = c.attributes.uv;
  for (let h = 0; h < u.count; h++)
    u.setXY(h, u.getX(h) * a, u.getY(h) * Math.PI * 2 * e);
  return c;
}
const _xformMatrix = new Matrix4();
const _xformQuat = new Quaternion();
const _xformEuler = new Euler();
const _xformPos = new Vector3();
const _xformScale = new Vector3();
export function transformGeo(
  i: any,
  {
    p: e = [0, 0, 0],
    r: t = [0, 0, 0],
    s: n = 1,
  }: { p?: number[] | undefined; r?: number[] | undefined; s?: any } = {},
) {
  _xformEuler.set(t[0], t[1], t[2]);
  _xformQuat.setFromEuler(_xformEuler);
  _xformPos.set(e[0], e[1], e[2]);
  if (typeof n == "number") {
    _xformScale.set(n, n, n);
  } else {
    _xformScale.set(n[0], n[1], n[2]);
  }
  _xformMatrix.compose(_xformPos, _xformQuat, _xformScale);
  i.applyMatrix4(_xformMatrix);
  return i;
}
export function vertexColorGeo(
  i: BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>,
  e: any,
) {
  let t = i.attributes.position,
    n = t.count,
    s = new Float32Array(n * 3);
  for (let o = 0; o < n; o++) {
    let r = typeof e == "function" ? e(t.getX(o), t.getY(o), t.getZ(o)) : e;
    s[o * 3] = r[0];
    s[o * 3 + 1] = r[1];
    s[o * 3 + 2] = r[2];
  }
  i.setAttribute("color", new BufferAttribute(s, 3));
  return i;
}
export function mergeGeos(i: any) {
  let e = i
    .filter(Boolean)
    .map(
      (l: any) => (
        l.attributes.uv ||
          l.setAttribute(
            "uv",
            new BufferAttribute(
              new Float32Array(l.attributes.position.count * 2),
              2,
            ),
          ),
        l.attributes.normal || l.computeVertexNormals(),
        l
      ),
    );
  if (!e.length) {
    return new BufferGeometry();
  }
  let t = e.some((l: any) => l.attributes.color),
    n = e.map((l: any) => {
      let c = (l.index, l);
      if (t && !c.attributes.color) {
        let u = new Float32Array(c.attributes.position.count * 3).fill(1);
        c.setAttribute("color", new BufferAttribute(u, 3));
      }
      for (let u of Object.keys(c.attributes)) {
        if (!["position", "normal", "uv", "color"].includes(u)) {
          c.deleteAttribute(u);
        }
      }
      return c;
    }),
    s = n.every((l: any) => l.index),
    o = n.every((l: any) => !l.index),
    r = s || o ? n : n.map((l: any) => (l.index ? l.toNonIndexed() : l));
  return mergeGeometries(r, false) || new BufferGeometry();
}
export function mergeByMaterial(
  i: Group<Object3DEventMap>,
  {
    castShadow: e = true,
    receiveShadow: t = true,
  }: { castShadow?: boolean; receiveShadow?: boolean } = {},
) {
  i.updateMatrixWorld(true);
  let n = new Map(),
    s: Object3D<Object3DEventMap>[] = [];
  i.traverse((r) => {
    if (!(r as Mesh).isMesh) {
      return;
    }
    let a: Object3D | null = r,
      l = false;
    for (; a;) {
      if (a.userData && a.userData.noMerge) {
        l = true;
        break;
      }
      a = a.parent;
    }
    if (
      l ||
      (r as SkinnedMesh).isSkinnedMesh ||
      (r as InstancedMesh).isInstancedMesh ||
      Array.isArray((r as Mesh).material)
    ) {
      s.push(r);
      return;
    }
    let c =
      ((r as Mesh).material as Material).uuid +
      (r.castShadow ? "c" : "n") +
      (r.receiveShadow ? "r" : "n") +
      ":" +
      r.layers.mask;
    if (!n.has(c)) {
      n.set(c, {
        mat: (r as Mesh).material,
        geos: [],
        cast: r.castShadow,
        recv: r.receiveShadow,
        layers: r.layers.mask,
      });
    }
    let u = (r as Mesh).geometry.clone();
    u.applyMatrix4(r.matrixWorld);
    n.get(c).geos.push(u);
  });
  let o = new Group();
  for (let r of n.values()) {
    let a = new Mesh(mergeGeos(r.geos), r.mat);
    a.castShadow = r.cast && e;
    a.receiveShadow = r.recv && t;
    a.layers.mask = r.layers;
    o.add(a);
  }
  for (let r of s) {
    r.updateMatrixWorld(true);
    let a = r.matrixWorld.clone();
    o.add(r);
    r.matrix.copy(a);
    r.matrix.decompose(r.position, r.quaternion, r.scale);
  }
  return o;
}
export function makeMesh(
  i:
    | BoxGeometry
    | CylinderGeometry
    | PlaneGeometry
    | TubeGeometry
    | ExtrudeGeometry,
  e: any,
  { cast: t = true, recv: n = true }: { cast?: boolean; recv?: boolean } = {},
) {
  let s = new Mesh(i, e);
  s.castShadow = t;
  s.receiveShadow = n;
  return s;
}
