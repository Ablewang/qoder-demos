import type { GameContext } from "../types/context";
import type {
  BufferGeometryEventMap,
  CylinderGeometry,
  NormalBufferAttributes,
} from "three";
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "../utils/buffer-geometry-utils";
import {
  boxGeo,
  cylinderGeo,
  mergeGeos,
  roundedBoxGeo,
  vertexColorGeo,
} from "../utils/geometry";

export const vec3 = (
  i: number | undefined,
  e: number | undefined,
  t: number | undefined,
) => new Vector3(i, e, t);
const toV3 = (i: number[] | Vector3): Vector3 =>
  (i as Vector3).isVector3
    ? (i as Vector3)
    : new Vector3((i as number[])[0], (i as number[])[1], (i as number[])[2]);
const _backdropUp = new Vector3(0, 1, 0);
const _strutUnitScale = new Vector3(1, 1, 1);
const _backdropStrutQuat = new Quaternion();
const _backdropBeamMat = new Matrix4();
function hash3b(i: number, e: number, t: number) {
  let n =
    Math.imul(i, 374761393) ^
    Math.imul(e, 668265263) ^
    Math.imul(t, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
export function valueNoise3b(i: number, e: number, t: number) {
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
      c(hash3b(n, s, o), hash3b(n + 1, s, o), r),
      c(hash3b(n, s + 1, o), hash3b(n + 1, s + 1, o), r),
      a,
    ),
    c(
      c(hash3b(n, s, o + 1), hash3b(n + 1, s, o + 1), r),
      c(hash3b(n, s + 1, o + 1), hash3b(n + 1, s + 1, o + 1), r),
      a,
    ),
    l,
  );
}
export function lcgRng(i: number) {
  let e = i >>> 0;
  return () => (
    (e = (Math.imul(e, 1664525) + 1013904223) >>> 0),
    e / 4294967296
  );
}
const _grimeColorOut = [1, 1, 1];
const GRIME_DEFAULT_TINT = [1, 1, 1];
export function grimeColor(
  i: number,
  e: number,
  t: number,
  n = GRIME_DEFAULT_TINT,
  s = 1,
) {
  let o = valueNoise3b(i * 0.31 + 11.3, e * 0.23 + 5.1, t * 0.31 + 3.7),
    r = valueNoise3b(i * 1.7 + 40.2, 9.5, t * 1.7 + 17.9),
    a = 1 - s * (0.3 - 0.36 * o),
    l = n[0] * a,
    c = n[1] * a,
    u = n[2] * a;
  if (r > 0.68) {
    let h =
      Math.min(1, (r - 0.68) / 0.3) *
      0.6 *
      s *
      (0.35 + 0.65 * valueNoise3b(i * 0.9, e * 0.45, t * 0.9));
    l *= 1 + 0.45 * h;
    c *= 1 - 0.3 * h;
    u *= 1 - 0.6 * h;
  }
  _grimeColorOut[0] = l;
  _grimeColorOut[1] = c;
  _grimeColorOut[2] = u;
  return _grimeColorOut;
}
const backdropTintedMats = new WeakSet();
export function backdropMaterial(i: GameContext, e: string, t = {}) {
  let n = i.mats.get(e, {
    vertexColors: true,
    ...t,
  });
  backdropTintedMats.add(n);
  return n;
}
export const GeoBucket = class {
  declare remap: any;
  declare b: any;
  declare minSize: number;
  declare dz: number;
  declare tris: number;
  constructor() {
    this.b = new Map();
    this.tris = 0;
    this.remap = null;
    this.dz = 0;
    this.minSize = 0;
  }
  add(
    e: any,
    t:
      | BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>
      | CylinderGeometry[]
      | null,
    n?: number[] | undefined,
  ) {
    if (!t) {
      return;
    }
    if (Array.isArray(t)) {
      for (let o of t) this.add(e, o, n);
      return;
    }
    if (this.remap) {
      let o = this.remap(e, n);
      if (!o) {
        return;
      }
      if (this.minSize) {
        t.computeBoundingBox();
        let r = t.boundingBox;
        if (
          Math.max(
            r!.max.x - r!.min.x,
            r!.max.y - r!.min.y,
            r!.max.z - r!.min.z,
          ) < this.minSize
        ) {
          return;
        }
      }
      e = o[0];
      n = o[1];
      if (this.dz) {
        t.translate(0, 0, this.dz);
      }
    }
    if (backdropTintedMats.has(e) && !t.attributes.color) {
      vertexColorGeo(t, (o: number, r: number, a: number) =>
        grimeColor(o, r, a, n || GRIME_DEFAULT_TINT),
      );
    }
    let s = this.b.get(e.uuid);
    if (!s) {
      s = {
        mat: e,
        geos: [],
      };
      this.b.set(e.uuid, s);
    }
    s.geos.push(t);
    this.tris += (t.index ? t.index.count : t.attributes.position.count) / 3;
  }
  build({
    cast: e = true,
    recv: t = true,
  }: { cast?: boolean; recv?: boolean } = {}) {
    let n = new Group();
    for (let s of this.b.values()) {
      let o = mergeGeos(s.geos),
        r = new Mesh(o, s.mat),
        a = s.mat.isMeshBasicMaterial || s.mat.transparent;
      r.castShadow = e && !a;
      r.receiveShadow = t && !a;
      n.add(r);
    }
    this.b.clear();
    return n;
  }
};
export function boxBetween(
  i: number,
  e: number,
  t: number,
  n: number,
  s: number,
  o: number,
  r = 0,
) {
  let a = Math.abs(n - i),
    l = Math.abs(s - e),
    c = Math.abs(o - t),
    u = r > 0 ? roundedBoxGeo(a, l, c, r) : boxGeo(a, l, c);
  u.translate((i + n) / 2, (e + s) / 2, (t + o) / 2);
  return u;
}
export function axisCylinder(
  i: number,
  e: number,
  t: number,
  n: string,
  s: number,
  o: number,
  r: number,
  a = 12,
  l = false,
) {
  let c = cylinderGeo(i, e, t, a, l);
  if (n === "x") {
    c.rotateZ(Math.PI / 2);
  } else if (n === "z") {
    c.rotateX(Math.PI / 2);
  }
  c.translate(s, o, r);
  return c;
}
export function strut(
  i: number[] | Vector3,
  e: number[] | Vector3,
  t = 0.03,
  n = 5,
  s = false,
) {
  i = toV3(i);
  e = toV3(e);
  let o = new Vector3().subVectors(e, i),
    r = o.length();
  if (r < 1e-5) {
    return null;
  }
  let a = cylinderGeo(t, t, r, n, !s);
  _backdropStrutQuat.setFromUnitVectors(_backdropUp, o.multiplyScalar(1 / r));
  _backdropBeamMat.compose(
    new Vector3().addVectors(i, e).multiplyScalar(0.5),
    _backdropStrutQuat,
    _strutUnitScale,
  );
  a.applyMatrix4(_backdropBeamMat);
  return a;
}
export function girder(
  i: number[] | Vector3,
  e: number[] | Vector3,
  t = 0.3,
  n = 0.3,
  s = 0,
) {
  i = toV3(i);
  e = toV3(e);
  let o = new Vector3().subVectors(e, i),
    r = o.length();
  o.multiplyScalar(1 / r);
  let a = new Vector3().crossVectors(o, _backdropUp);
  if (a.lengthSq() < 1e-6) {
    a.set(1, 0, 0);
  } else {
    a.normalize();
  }
  let l = new Vector3().crossVectors(a, o),
    c = s > 0 ? roundedBoxGeo(t, r, n, s) : boxGeo(t, r, n);
  _backdropBeamMat
    .makeBasis(a, o, l)
    .setPosition((i.x + e.x) / 2, (i.y + e.y) / 2, (i.z + e.z) / 2);
  c.applyMatrix4(_backdropBeamMat);
  return c;
}
export function polyStrut(i: Vector3[], e = 0.03, t = 5) {
  let n: CylinderGeometry[] = [];
  for (let s = 0; s < i.length - 1; s++) {
    let o = strut(i[s], i[s + 1], e, t);
    if (o) {
      n.push(o);
    }
  }
  return n;
}
export function catenary(i: any, e: any, t = 1, n = 10) {
  i = toV3(i);
  e = toV3(e);
  let s: Vector3[] = [];
  for (let o = 0; o <= n; o++) {
    let r = o / n,
      a = new Vector3().lerpVectors(i, e, r);
    a.y -= t * 4 * r * (1 - r);
    s.push(a);
  }
  return s;
}
export function panelGeo(
  i: number,
  e: number,
  t: number,
  n: number,
  s: number,
  o = 0,
  r = 0,
) {
  let a = new PlaneGeometry(i, e);
  if (r) {
    a.rotateX(r);
  }
  if (o) {
    a.rotateY(o);
  }
  a.translate(t, n, s);
  return a;
}
export function railLine(
  i: any,
  e: any,
  t: any,
  {
    h: n = 1.1,
    post: s = 2.2,
    r: o = 0.022,
    tint: r,
    mid: a = true,
  }: {
    h?: number;
    post?: number;
    r?: number;
    tint?: number[];
    mid?: boolean;
  } = {},
) {
  t = t.map(toV3);
  for (let l = 0; l < t.length - 1; l++) {
    let c = t[l],
      u = t[l + 1],
      h = c.distanceTo(u),
      f = Math.max(1, Math.round(h / s));
    for (let p = l === 0 ? 0 : 1; p <= f; p++) {
      let d = new Vector3().lerpVectors(c, u, p / f);
      i.add(e, strut(d, vec3(d.x, d.y + n, d.z), o, 4), r);
    }
    i.add(
      e,
      strut(vec3(c.x, c.y + n, c.z), vec3(u.x, u.y + n, u.z), o * 1.15, 5),
      r,
    );
    if (a) {
      i.add(
        e,
        strut(
          vec3(c.x, c.y + n * 0.5, c.z),
          vec3(u.x, u.y + n * 0.5, u.z),
          o * 0.9,
          4,
        ),
        r,
      );
    }
  }
}
export function createLampBatch() {
  let i = {
      value: 0,
    },
    e = new MeshBasicMaterial({
      vertexColors: true,
      fog: false,
    });
  e.onBeforeCompile = (n) => {
    n.uniforms.uTime = i;
    n.vertexShader =
      `attribute vec3 blink;
uniform float uTime;
varying float vBlink;
` +
      n.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
 float bph = fract(uTime / max(blink.x, 0.001) + blink.y);
 vBlink = blink.x <= 0.0 ? 1.0 : mix(0.02, 1.0, smoothstep(0.0, 0.06, bph) * (1.0 - smoothstep(blink.z, blink.z + 0.12, bph)));`,
      );
    n.fragmentShader =
      `varying float vBlink;
` +
      n.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
 diffuseColor.rgb *= vBlink;`,
      );
  };
  e.customProgramCacheKey = () => "saltline-blink";
  let t: BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>[] = [];
  return {
    uTime: i,
    mat: e,
    add(n: any, s: number[], o = 0, r = 0, a = 0.5) {
      if (!n) {
        return;
      }
      let l = n.index ? n.toNonIndexed() : n,
        c = l.attributes.position.count,
        u = new Float32Array(c * 3),
        h = new Float32Array(c * 3);
      for (let p = 0; p < c; p++) {
        u[p * 3] = s[0];
        u[p * 3 + 1] = s[1];
        u[p * 3 + 2] = s[2];
        h[p * 3] = o;
        h[p * 3 + 1] = r;
        h[p * 3 + 2] = a;
      }
      let f = new BufferGeometry();
      f.setAttribute("position", l.attributes.position);
      f.setAttribute("color", new BufferAttribute(u, 3));
      f.setAttribute("blink", new BufferAttribute(h, 3));
      t.push(f);
    },
    build() {
      if (!t.length) {
        return null;
      }
      let n = new Mesh(mergeGeometries(t.splice(0), false)!, e);
      n.castShadow = false;
      n.receiveShadow = false;
      return n;
    },
  };
}
export const lampGeo = (i: number, e: number, t: number, n = 0.12) => {
  let s = new OctahedronGeometry(n, 0);
  s.translate(i, e, t);
  return s;
};
