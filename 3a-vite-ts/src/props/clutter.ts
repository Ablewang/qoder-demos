import type { Rng } from "../utils/rng";
import { createRng } from "../utils/rng";
import * as THREE from "three";
import { Group, Matrix4, Mesh } from "three";
import {
  boxGeo,
  cylinderGeo,
  mergeGeos,
  transformGeo,
  tubeGeo,
} from "../utils/geometry";
import { PROP_SIZES } from "./registry";
import {
  HALF_PI,
  PI,
  chamferBoxGeo,
  clampRange,
  composeMatrix,
  displaceGeo,
  flipWinding,
  paintMaterial,
  pillowGeo,
  planeGeo2,
  ribbonGeo,
  ringStripGeo,
  rodGeo,
  sagPlaneGeo,
  softBoxGeo,
  tintVertexColors,
  torusGeo,
  valueNoise3,
  weldGeo,
} from "./clutter-kit";

export const ClutterBuilder = class {
  declare stack: any;
  declare b: any;
  declare G: any;
  declare rng: Rng;
  declare seed: number;
  declare name: string;
  constructor(e: any, t: string, n = 1) {
    this.G = e;
    this.name = t;
    this.seed = Math.abs(n | 0);
    this.rng = createRng((this.seed + 1) * 7919 + t.length * 131);
    this.b = new Map();
    this.stack = [new Matrix4()];
  }
  push(
    e:
      | { p: number[]; r: number[] }
      | { r: number[] }
      | { p: number[]; r: number[]; s: number[] }
      | { p: number[] },
  ) {
    this.stack.push(
      this.stack[this.stack.length - 1].clone().multiply(composeMatrix(e)),
    );
    return this;
  }
  pop() {
    this.stack.pop();
    return this;
  }
  mat(
    e: string | { color: number },
    t?: { color: number } | { doubleSide: boolean } | string,
  ) {
    return this.G.mats.get(e, {
      vertexColors: true,
      ...((t || {}) as object),
    });
  }
  add(
    e: string | number | number[] | { color: number },
    t: THREE.BufferGeometry<
      THREE.NormalBufferAttributes,
      THREE.BufferGeometryEventMap
    >,
    n: { p?: number[]; r?: number[]; s?: number | number[] } | null | undefined,
    s: any = 1,
    { raw: o = false, cast: r = true }: { raw?: boolean; cast?: boolean } = {},
  ) {
    let a = typeof e == "string" ? this.mat(e) : e;
    if (n) {
      transformGeo(t, n);
    }
    t.applyMatrix4(this.stack[this.stack.length - 1]);
    if (!o) {
      tintVertexColors(t, s);
    }
    let l = a.uuid + (r ? "c" : "n"),
      c = this.b.get(l);
    if (!c) {
      c = {
        mat: a,
        geos: [],
        raw: o,
        cast: r,
      };
      this.b.set(l, c);
    }
    c.geos.push(t);
    return this;
  }
  decal(
    e: any,
    t: number,
    n: { p: number[] } | { p: number[]; r: number[] },
    s?: any,
  ) {
    return this.add(e.material, planeGeo2(t, s || t / (e.aspect || 1)), n, 1, {
      raw: true,
      cast: false,
    });
  }
  label(
    e: string,
    t: { color: string; font: string; distress: number },
    n: number,
    s: number,
    o: { p: number[] } | { p: number[]; r: number[] },
  ) {
    let r = this.G.mats.label(e, t),
      a = Math.min(n, s * (r.aspect || 1));
    return this.add(r.material, planeGeo2(a, a / (r.aspect || 1)), o, 1, {
      raw: true,
      cast: false,
    });
  }
  cdecal(
    e: any,
    t: number,
    n: number,
    s: { p: number[]; r: number[] },
    o?: number,
  ) {
    return this.add(
      e.material,
      sagPlaneGeo(t, n, o || n / (e.aspect || 1)),
      s,
      1,
      {
        raw: true,
        cast: false,
      },
    );
  }
  finish({
    size: e,
    colliders: t,
    grime: n = 1,
    surface: s,
  }: {
    size?: number[];
    colliders?: { min: number[]; max: number[]; surface: string }[];
    grime?: number;
    surface?: string;
  } = {}) {
    let o = new Group(),
      r = this.seed * 3.71;
    for (let c of this.b.values()) {
      let u = mergeGeos(c.geos);
      if (!c.raw && n > 0 && u.attributes.color) {
        let f = u.attributes.position,
          p = u.attributes.normal,
          d = u.attributes.color.array;
        for (let v = 0; v < f.count; v++) {
          let g = f.getX(v),
            x = f.getY(v),
            y = f.getZ(v),
            b = p.getY(v),
            m = valueNoise3(g * 1.9 + r, x * 1.9, y * 1.9 + 5.3),
            A = valueNoise3(g * 9 + 2.1, x * 9 + r, y * 9),
            _ =
              (0.82 + 0.18 * m) *
              (0.92 + 0.08 * A) *
              (0.76 + 0.24 * clampRange(b * 0.6 + 0.62, 0, 1)),
            M = clampRange(1 - x / 0.2, 0, 1);
          _ *= 1 - 0.42 * M * M * (0.55 + 0.45 * A);
          _ = 1 + (_ - 1) * n;
          d[v * 3] *= _;
          d[v * 3 + 1] *= _ * (1 - 0.05 * M * n);
          d[v * 3 + 2] *= _ * (1 - 0.12 * M * n);
        }
      }
      let h = new Mesh(u, c.mat);
      h.castShadow = c.cast;
      h.receiveShadow = true;
      o.add(h);
    }
    let a = PROP_SIZES[this.name] || [1, 1, 1, "", "metal"],
      l = e || [a[0], a[1], a[2]];
    o.userData.size = l;
    o.userData.colliders = t || [
      {
        min: [-l[0] / 2, 0, -l[2] / 2],
        max: [l[0] / 2, l[1], l[2] / 2],
        surface: s || a[4],
      },
    ];
    return o;
  }
};
const CLUTTER_CACHE = new Map();
function cachedClutter(
  i: string,
  e: () => THREE.Group<THREE.Object3DEventMap>,
) {
  let t = CLUTTER_CACHE.get(i);
  if (!t) {
    t = e();
    CLUTTER_CACHE.set(i, t);
  }
  return t.clone(true);
}
const clutterSmoothstep = (i: number, e: number, t: number) => {
  let n = clampRange((t - i) / (e - i), 0, 1);
  return n * n * (3 - 2 * n);
};
function stencilPlaneGeo(i: number, e: number, t = 0, n = 0) {
  let s = new THREE.PlaneGeometry(i, e),
    o = s.attributes.uv,
    r = s.attributes.position;
  for (let a = 0; a < o.count; a++) o.setXY(a, r.getX(a) + t, r.getY(a) + n);
  return s;
}
const FACE_ROTATIONS: Record<string, number[]> = {
  pz: [0, 0, 0],
  nz: [0, PI, 0],
  px: [0, HALF_PI, 0],
  nx: [0, -HALF_PI, 0],
};
function drumProfile(i: boolean) {
  let t = [
    [0, 0.016],
    [0.262, 0.016],
    [0.262, 0.016],
    [0.268, 0.002],
    [0.288, 0],
    [0.295, 0.008],
    [0.295, 0.022],
    [0.284, 0.034],
  ];
  for (let n of [0.305, 0.595])
    t.push(
      [0.283, n - 0.03],
      [0.291, n - 0.018],
      [0.297, n],
      [0.291, n + 0.018],
      [0.283, n + 0.03],
    );
  t.push(
    [0.284, 0.866],
    [0.295, 0.878],
    [0.295, 0.892],
    [0.288, 0.9],
    [0.268, 0.898],
  );
  if (i) {
    t.push(
      [0.268, 0.898],
      [0.272, 0.888],
      [0.272, 0.03],
      [0.272, 0.03],
      [0, 0.03],
    );
  } else {
    t.push([0.262, 0.884], [0.262, 0.884], [0, 0.884]);
  }
  return t;
}
function buildBarrel(
  i: any,
  e: { color?: any; lying?: any; open?: any },
  t: number,
) {
  let n = new ClutterBuilder(i, "barrel", t),
    s = n.rng,
    o = 22,
    [r, a] = paintMaterial(e.color, "blue");
  if (e.lying) {
    n.push({
      p: [-0.45, 0.297, 0],
      r: [0, 0, -HALF_PI],
    });
  }
  let l = ringStripGeo(drumProfile(!!e.open), o),
    c: number[][] = [];
  for (let d = 0; d < 2 + (t % 2); d++)
    c.push([
      s() * PI * 2,
      s.range(0.12, 0.78),
      s.range(0.07, 0.13),
      s.range(0.006, 0.014),
    ]);
  displaceGeo(l, (d: { x: number; z: number; y: number }) => {
    let v = Math.hypot(d.x, d.z);
    if (v < 0.27) {
      return;
    }
    let g = Math.atan2(d.z, d.x);
    for (let x of c) {
      let y = Math.abs(g - x[0]) % (PI * 2);
      if (y > PI) {
        y = PI * 2 - y;
      }
      let b = Math.hypot(y * 0.285, d.y - x[1]);
      if (b < x[2]) {
        let m = 1 - (x[3] * (0.5 + 0.5 * Math.cos((PI * b) / x[2]))) / v;
        d.x *= m;
        d.z *= m;
      }
    }
  });
  l.computeVertexNormals();
  let u = l.attributes.normal,
    h = l.attributes.position.count / (o + 1);
  for (let d = 0; d < h; d++) {
    let v = d * (o + 1),
      g = v + o,
      x = u.getX(v) + u.getX(g),
      y = u.getY(v) + u.getY(g),
      b = u.getZ(v) + u.getZ(g),
      m = Math.hypot(x, y, b) || 1;
    u.setXYZ(v, x / m, y / m, b / m);
    u.setXYZ(g, x / m, y / m, b / m);
  }
  let f = t * 2.37,
    p = e.color === "rust";
  n.add(r, l, null, (d: number, v: number, g: number) => {
    let x = Math.hypot(d, g),
      y = Math.atan2(g, d);
    if (x < 0.27) {
      let w = v > 0.5 ? 0.62 + 0.3 * valueNoise3(d * 9 + f, g * 9) : 0.6;
      return [w, w, w];
    }
    let b = Math.pow(valueNoise3(y * 2.6 + f, 3.1), 2.2),
      m =
        v > 0.6
          ? (0.88 - v) / 0.28
          : v > 0.31
            ? (0.6 - v) / 0.29
            : (0.31 - v) / 0.31,
      A = 1 - 0.55 * b * (1 - 0.6 * clampRange(m, 0, 1)),
      M = (x > 0.289 ? 1 : 0) * (0.35 + 0.65 * valueNoise3(y * 7 + f, v * 20)),
      E = [A * (1 - 0.25 * M), A * (1 - 0.42 * M), A * (1 - 0.55 * M)];
    if (typeof a != "number") {
      E[0] *= a[0];
      E[1] *= a[1];
      E[2] *= a[2];
    }
    return E;
  });
  if (!e.open) {
    n.add(
      "steel_galv",
      cylinderGeo(0.036, 0.038, 0.016, 8),
      {
        p: [0.17, 0.891, 0.02],
      },
      0.8,
    );
    n.add(
      "steel_galv",
      cylinderGeo(0.017, 0.018, 0.014, 8),
      {
        p: [-0.16, 0.89, -0.08],
      },
      0.8,
    );
  }
  if (!p && t % 3 !== 2) {
    n.cdecal(i.mats.decal("hazard_flammable"), 0.2855, 0.15, {
      p: [0, 0.455, 0],
      r: [0, 0.9 + t, 0],
    });
  }
  if (t % 2 === 0) {
    n.cdecal(
      i.mats.label("UN 1202", {
        color:
          p || e.color === "white" || e.color === "yellow" ? "black" : "white",
        font: "stencil",
        distress: 0.5,
      }),
      0.2855,
      0.2,
      {
        p: [0, 0.74, 0],
        r: [0, 2.6 + t, 0],
      },
    );
  }
  return n.finish(
    e.lying
      ? {
          size: [0.9, 0.6, 0.6],
        }
      : {},
  );
}
export function buildPalletGeo(
  i: any,
  e: Rng,
  {
    broken: t = false,
    stamp: n = true,
    bevel: s = false,
  }: { broken?: boolean; stamp?: boolean; bevel?: boolean } = {},
) {
  let o = s
      ? (u: number, h: number, f: number) => chamferBoxGeo(u, h, f, 0.004)
      : (u: number | undefined, h: number | undefined, f: number | undefined) =>
          boxGeo(u, h, f),
    r = () => {
      let u = e.range(0.62, 1),
        h = e.range(0.9, 1);
      return [u, u * (0.93 + 0.07 * h), u * (0.82 + 0.18 * h)];
    },
    a = (u = 0.003) => e.range(-u, u);
  for (let [u, h] of [
    [-0.45, 0.1],
    [0, 0.145],
    [0.45, 0.1],
  ])
    i.add(
      "wood_pallet",
      o(1.2, 0.022, h),
      {
        p: [a(), 0.011, u + a()],
        r: [0, a(0.006), 0],
      },
      r(),
    );
  let l = (u: number, h: number, f = 0.012) => [
    [-u / 2 + f, -h / 2],
    [u / 2 - f, -h / 2],
    [u / 2, -h / 2 + f],
    [u / 2, h / 2 - f],
    [u / 2 - f, h / 2],
    [-u / 2 + f, h / 2],
    [-u / 2, h / 2 - f],
    [-u / 2, -h / 2 + f],
  ];
  for (let u of [-0.5275, 0, 0.5275])
    for (let h of [-0.45, 0, 0.45])
      i.add(
        "wood_pallet",
        pillowGeo(l(0.145, h === 0 ? 0.145 : 0.1), 0.078, {
          caps: false,
          soft: 0,
        }),
        {
          p: [u + a(), 0.061, h + a()],
          r: [-HALF_PI, a(0.03), 0],
        },
        r().map((f) => f * 0.8),
      );
  for (let u of [-0.5275, 0, 0.5275])
    i.add(
      "wood_pallet",
      o(0.145, 0.022, 1),
      {
        p: [u + a(), 0.111, a()],
        r: [0, a(0.006), 0],
      },
      r(),
    );
  [
    [-0.4275, 0.145],
    [-0.215, 0.1],
    [0, 0.145],
    [0.215, 0.1],
    [0.4275, 0.145],
  ].forEach(([u, h], f) => {
    if (!(t && f === 3)) {
      i.add(
        "wood_pallet",
        o(1.2, 0.022, h),
        {
          p: [a(), 0.133, u + a(0.006)],
          r: [a(0.004), a(0.008), 0],
        },
        r(),
      );
    }
  });
  if (n) {
    let u = i.G.mats.label("EUR", {
      color: "black",
      font: "sans",
      distress: 0.6,
    });
    i.decal(u, 0.085, {
      p: [-0.5275, 0.062, 0.5015],
    });
    i.decal(u, 0.085, {
      p: [0.5275, 0.062, -0.5015],
      r: [0, PI, 0],
    });
  }
}
function buildPallet(i: any, e: { broken?: any }, t: number) {
  let n = new ClutterBuilder(i, "pallet", t);
  buildPalletGeo(n, n.rng, {
    broken: !!e.broken,
    bevel: true,
  });
  return n.finish();
}
function buildPalletStack(i: any, e: { seed?: any; count?: any }) {
  let t = new ClutterBuilder(i, "pallet_stack", e.seed || 0),
    n = t.rng,
    s = clampRange(e.count | 0 || 8, 1, 12);
  for (let o = 0; o < s; o++) {
    let r = o === s - 1;
    t.push({
      p: [
        o ? n.range(-0.028, 0.028) : 0,
        o * 0.144,
        o ? n.range(-0.022, 0.022) : 0,
      ],
      r: [
        0,
        n.range(-0.035, 0.035) +
          (n() < 0.3 ? PI : 0) +
          (r ? n.range(-0.06, 0.06) : 0),
        0,
      ],
    });
    buildPalletGeo(t, n, {
      broken: !r && n() < 0.2,
      stamp: o % 3 === 0,
      bevel: r,
    });
    t.pop();
  }
  return t.finish({
    size: [1.2, s * 0.144, 1],
  });
}
function buildCrateGeo(
  i: any,
  e: number,
  t: number,
  n: number,
  {
    detail: s = true,
    label: o = "易碎物品",
    code: r = "B4-117",
    skids: a = true,
  }: { detail?: boolean; label?: any; code?: any; skids?: boolean } = {},
) {
  let l = i.rng,
    c = i.G,
    u = 0.022,
    h = 0.07,
    f = a ? 0.07 : 0,
    p = t - f,
    d = f + p / 2,
    v = (z = 1) => {
      let H = l.range(0.7, 1) * z;
      return [H, H * l.range(0.92, 1), H * l.range(0.82, 0.95)];
    },
    g = s
      ? (z: number, H: number, O: number) => chamferBoxGeo(z, H, O, 0.004)
      : (z: number | undefined, H: number | undefined, O: number | undefined) =>
          boxGeo(z, H, O);
  if (a) {
    for (let z of [-(e / 2 - 0.13), 0, e / 2 - 0.13])
      i.add(
        "wood_pallet",
        chamferBoxGeo(0.09, f, n - 0.02, 0.006),
        {
          p: [z, f / 2, 0],
        },
        v(0.6),
      );
  }
  i.add(
    "wood_dark",
    boxGeo(e - 2 * u - 0.012, p - u - 0.012, n - 2 * u - 0.012),
    {
      p: [0, f + (p - u - 0.012) / 2 + 0.002, 0],
    },
    0.25,
  );
  let x = Math.max(3, Math.round(p / 0.125)),
    y = p / x;
  for (let z = 0; z < x; z++) {
    let H = f + y * (z + 0.5);
    for (let [O, q, U] of [
      ["pz", e, n / 2 - u],
      ["nz", e, n / 2 - u],
      ["px", n, e / 2 - u],
      ["nx", n, e / 2 - u],
    ] as [string, number, number][]) {
      let T = U - l.range(0, 0.004),
        D =
          O === "pz"
            ? [0, H, T]
            : O === "nz"
              ? [0, H, -T]
              : O === "px"
                ? [T, H, 0]
                : [-T, H, 0];
      i.add(
        "wood_pallet",
        stencilPlaneGeo(q - 0.03, y - 0.005, l() * 3, l() * 3),
        {
          p: D,
          r: FACE_ROTATIONS[O],
        },
        v(),
      );
    }
  }
  let b = Math.max(3, Math.round(n / 0.13)),
    m = (n - 0.02) / b;
  for (let z = 0; z < b; z++)
    i.add(
      "wood_pallet",
      stencilPlaneGeo(e - 0.03, m - 0.005, l() * 3, l() * 3),
      {
        p: [0, t - u - l.range(0, 0.003), -n / 2 + 0.01 + m * (z + 0.5)],
        r: [-HALF_PI, 0, 0],
      },
      v(),
    );
  let A = Math.atan2(p - 2 * h, e - 2 * h),
    _ = Math.hypot(e - 2 * h, p - 2 * h);
  for (let z of [1, -1]) {
    let H = z * (n / 2 - u / 2);
    i.add(
      "wood_pallet",
      g(e, h, u),
      {
        p: [0, f + h / 2, H],
      },
      v(0.85),
    );
    i.add(
      "wood_pallet",
      g(e, h, u),
      {
        p: [0, t - h / 2, H],
      },
      v(0.85),
    );
    for (let U of [1, -1])
      i.add(
        "wood_pallet",
        g(h, p - 2 * h, u),
        {
          p: [U * (e / 2 - h / 2), d, H],
        },
        v(0.85),
      );
    if (s) {
      i.add(
        "wood_pallet",
        chamferBoxGeo(_, h * 0.85, u * 0.8, 0.004),
        {
          p: [0, d, z * (n / 2 - u * 0.6)],
          r: [0, 0, z * A],
        },
        v(0.8),
      );
    }
    let O = z * (e / 2 - u / 2),
      q = n - 2 * u;
    for (let U of [1, -1])
      i.add(
        "wood_pallet",
        g(u, p, h),
        {
          p: [O, d, U * (q / 2 - h / 2)],
        },
        v(0.85),
      );
    i.add(
      "wood_pallet",
      g(u, h, q - 2 * h),
      {
        p: [O, f + h / 2, 0],
      },
      v(0.85),
    );
    i.add(
      "wood_pallet",
      g(u, h, q - 2 * h),
      {
        p: [O, t - h / 2, 0],
      },
      v(0.85),
    );
    i.add(
      "wood_pallet",
      g(e, u, h),
      {
        p: [0, t - u / 2, z * (n / 2 - h / 2)],
      },
      v(0.85),
    );
    i.add(
      "wood_pallet",
      g(h, u, n - 2 * h),
      {
        p: [z * (e / 2 - h / 2), t - u / 2, 0],
      },
      v(0.85),
    );
  }
  if (s) {
    i.add(
      "wood_pallet",
      chamferBoxGeo(h, u, n - 2 * h, 0.004),
      {
        p: [0, t - u / 2, 0],
      },
      v(0.85),
    );
  }
  let M = 0.085,
    E = () => {
      let z = l.range(0.55, 0.9);
      return [z, z * 0.9, z * 0.8];
    };
  for (let z of [1, -1])
    for (let H of [1, -1])
      for (let O of s ? [1, 0] : [1]) {
        let q = O ? t - M / 2 : f + M / 2,
          U = E();
        i.add(
          "steel_galv",
          boxGeo(M, M, 0.003),
          {
            p: [z * (e / 2 - M / 2), q, H * (n / 2 + 0.0015)],
          },
          U,
        );
        i.add(
          "steel_galv",
          boxGeo(0.003, M, M),
          {
            p: [z * (e / 2 + 0.0015), q, H * (n / 2 - M / 2)],
          },
          U,
        );
        if (O) {
          i.add(
            "steel_galv",
            boxGeo(M, 0.003, M),
            {
              p: [z * (e / 2 - M / 2), t + 0.0015, H * (n / 2 - M / 2)],
            },
            U,
          );
        }
      }
  let w = n / 2 - u + 0.003,
    S = Math.min(0.11, p * 0.15);
  if (o) {
    i.label(
      o,
      {
        color: "black",
        font: "stencil",
        distress: 0.25,
      },
      e * 0.4,
      S,
      {
        p: [-e * 0.2, t - h - S * 0.95, w],
      },
    );
    i.label(
      o,
      {
        color: "black",
        font: "stencil",
        distress: 0.25,
      },
      e * 0.4,
      S,
      {
        p: [e * 0.2, t - h - S * 0.95, -w],
        r: [0, PI, 0],
      },
    );
    i.decal(c.mats.decal("arrow"), Math.min(0.14, p * 0.2), {
      p: [e * 0.27, f + h + p * 0.16, w],
      r: [0, 0, HALF_PI],
    });
  }
  if (r) {
    i.label(
      r,
      {
        color: "black",
        font: "stencil",
        distress: 0.3,
      },
      n * 0.5,
      S * 0.9,
      {
        p: [e / 2 - u + 0.003, d + p * 0.12, 0],
        r: FACE_ROTATIONS.px,
      },
    );
  }
  if (s) {
    i.decal(c.mats.decal("logo_b"), Math.min(0.2, p * 0.25), {
      p: [-(e / 2 - u + 0.003), d - p * 0.05, 0],
      r: FACE_ROTATIONS.nx,
    });
  }
}
function buildCrateWood(i: any, e: { seed?: any; label?: any; code?: any }) {
  let t = new ClutterBuilder(i, "crate_wood", e.seed || 0);
  buildCrateGeo(t, 1.1, 1, 0.9, {
    label:
      e.label === undefined
        ? ["易碎物品", "此面向上", "保持干燥", "机械零件"][t.seed % 4]
        : e.label,
    code: e.code || "B4-" + [117, 204, 318][t.seed % 3],
  });
  return t.finish();
}
function buildCrateStack(i: any, e: { seed?: any }) {
  let t = new ClutterBuilder(i, "crate_stack", e.seed || 0),
    n = t.rng;
  buildCrateGeo(t, 1.2, 0.95, 1, {
    label: "重物",
    code: "几猫04" + (t.seed % 2),
  });
  let s = {
    x: n.range(-0.1, 0.02),
    z: n.range(-0.05, 0.05),
    th: (n() < 0.5 ? -1 : 1) * n.range(0.1, 0.16),
    L: 0.86,
    W: 0.72,
  };
  t.push({
    p: [s.x, 0.95, s.z],
    r: [0, s.th, 0],
  });
  buildCrateGeo(t, s.L, 0.6, s.W, {
    detail: false,
    skids: false,
    label: "易碎物品",
    code: "B4-204",
  });
  t.pop();
  let o = {
    x: s.x + n.range(-0.05, 0.05),
    z: s.z + n.range(-0.04, 0.04),
    th: n.range(-0.12, 0.12),
  };
  t.push({
    p: [o.x, 1.55, o.z],
    r: [0, o.th, 0],
  });
  buildCrateGeo(t, 0.55, 0.35, 0.45, {
    detail: false,
    skids: false,
    label: "",
    code: "",
  });
  t.pop();
  let r = (
    a: number,
    l:
      | { x: number; z: number; th: number; L: number; W: number }
      | { x: number; z: number; th: number },
    c: number,
    u: number,
    h: number,
  ) => {
    let f = (a - l.x - h * u * Math.sin(c)) / Math.cos(c);
    return l.z - f * Math.sin(c) + h * u * Math.cos(c);
  };
  for (let a of [-0.2, 0.17]) {
    let c: any[] = [],
      u = (h: number) => [
        [a, 0.09, h * 0.506],
        [a, 0.956, h * 0.506],
        [a, 1.556, r(a, s, s.th, s.W / 2, h) + h * 0.006],
        [a, 1.906, r(a, o, o.th, 0.225, h) + h * 0.006],
      ];
    c.push(...u(1), ...u(-1).reverse());
    t.add("paint_orange", ribbonGeo(c, [0.02, 0, 0]), null, [1, 0.8, 0.5]);
    t.add(
      "steel_worn",
      chamferBoxGeo(0.06, 0.09, 0.025, 0.006),
      {
        p: [a, 0.62, 0.5 + 0.016],
      },
      0.8,
    );
    t.add(
      "steel_dark",
      rodGeo([a - 0.035, 0.66, 0.53], [a + 0.035, 0.66, 0.53], 0.008, 6, true),
      null,
      0.8,
    );
  }
  return t.finish();
}
function buildIbcTote(i: any, e: { seed?: any }) {
  let t = new ClutterBuilder(i, "ibc_tote", e.seed || 0),
    n = t.rng,
    s = () => n.range(0.75, 1);
  for (let y of [-0.44, 0, 0.44])
    t.add(
      "steel_galv",
      boxGeo(1.2, 0.028, 0.1),
      {
        p: [0, 0.014, y],
      },
      s(),
    );
  for (let y of [-0.54, 0, 0.54])
    for (let b of [-0.44, 0, 0.44])
      t.add(
        "steel_galv",
        chamferBoxGeo(0.12, 0.074, 0.1, 0.008),
        {
          p: [y, 0.065, b],
        },
        s() * 0.85,
      );
  for (let y of [-0.48, 0.48])
    t.add(
      "steel_galv",
      chamferBoxGeo(1.2, 0.03, 0.04, 0.006),
      {
        p: [0, 0.115, y],
      },
      s(),
    );
  for (let y of [-0.58, 0.58])
    t.add(
      "steel_galv",
      chamferBoxGeo(0.04, 0.03, 0.92, 0.006),
      {
        p: [y, 0.115, 0],
      },
      s(),
    );
  t.add(
    "steel_galv",
    boxGeo(1.12, 0.012, 0.92),
    {
      p: [0, 0.124, 0],
    },
    0.6,
  );
  let o = 1.1,
    r = 0.95,
    a = 0.9,
    l = 0.13 + r / 2,
    c = softBoxGeo(o, r, a, 0.07, 8, 6, 8);
  displaceGeo(c, (y: { x: number; y: number; z: number }) => {
    let b = y.x / (o / 2),
      m = y.y / (r / 2),
      A = y.z / (a / 2),
      _ = Math.cos(HALF_PI * m) * Math.cos(HALF_PI * A),
      M = Math.cos(HALF_PI * b) * Math.cos(HALF_PI * A),
      E = Math.cos(HALF_PI * b) * Math.cos(HALF_PI * m);
    if (Math.abs(b) > 0.9) {
      y.x +=
        Math.sign(b) *
        (0.016 * _ + 0.004 * Math.abs(Math.sin((y.y * PI) / 0.22)) * _);
    }
    if (Math.abs(A) > 0.9) {
      y.z +=
        Math.sign(A) *
        (0.016 * E + 0.004 * Math.abs(Math.sin((y.y * PI) / 0.22)) * E);
    }
    if (m > 0.9) {
      y.y += 0.012 * M - 0.01 * Math.max(0, 1 - Math.hypot(y.x, y.z) / 0.3);
    }
  });
  weldGeo(c);
  let u = 0.13 + r * n.range(0.45, 0.8),
    h = t.seed * 1.3,
    f = t.mat("plastic_grey", {
      color: 14278096,
    });
  t.add(
    f,
    c,
    {
      p: [0, l, 0],
    },
    (y: number, b: number, m: number) => {
      let A = clutterSmoothstep(
          u - 0.03,
          u + 0.03,
          b + 0.02 * valueNoise3(y * 3 + h, m * 3),
        ),
        _ = 0.9 + 0.1 * valueNoise3(y * 6, b * 6 + h, m * 6);
      return [
        _ * (0.52 + 0.48 * A),
        _ * (0.6 + 0.4 * A),
        _ * (0.66 + 0.34 * A),
      ];
    },
  );
  t.add(
    f,
    cylinderGeo(0.12, 0.125, 0.03, 14),
    {
      p: [0, 0.13 + r + 0.005, 0],
    },
    0.9,
  );
  t.add(
    "plastic_red",
    ringStripGeo(
      [
        [0.105, 0],
        [0.105, 0.042],
        [0.105, 0.042],
        [0.09, 0.05],
        [0, 0.05],
      ],
      14,
    ),
    {
      p: [0, 0.13 + r + 0.015, 0],
    },
    0.9,
  );
  for (let y = 0; y < 8; y++) {
    let b = (y * PI) / 4;
    t.add(
      "plastic_red",
      boxGeo(0.012, 0.04, 0.02),
      {
        p: [Math.cos(b) * 0.108, 0.13 + r + 0.036, Math.sin(b) * 0.108],
        r: [0, -b, 0],
      },
      0.8,
    );
  }
  let p = 0.575,
    d = 0.475,
    v = 0.13,
    g = 1.1,
    x = 0.011;
  for (let y of [0.2, 0.42, 0.64, 0.86, g]) {
    let b = y === g ? 0.014 : x;
    for (let m of [1, -1]) {
      t.add(
        "steel_galv",
        rodGeo([-p, y, m * d], [p, y, m * d], b, 5),
        null,
        s(),
      );
      t.add(
        "steel_galv",
        rodGeo([m * p, y, -d], [m * p, y, d], b, 5),
        null,
        s(),
      );
    }
  }
  for (let y of [1, -1]) {
    for (let b = -0.46; b <= 0.461; b += 0.184)
      t.add(
        "steel_galv",
        rodGeo([b, v, y * (d - 0.012)], [b, g, y * (d - 0.012)], x, 5),
        null,
        s(),
      );
    for (let b = -0.36; b <= 0.361; b += 0.18)
      t.add(
        "steel_galv",
        rodGeo([y * (p - 0.012), v, b], [y * (p - 0.012), g, b], x, 5),
        null,
        s(),
      );
    t.add(
      "steel_galv",
      rodGeo([y * 0.28, g + 0.01, -d], [y * 0.28, g + 0.01, d], 0.013, 5),
      null,
      s(),
    );
  }
  t.add(
    "aluminium",
    chamferBoxGeo(0.42, 0.3, 0.004, 0.0015),
    {
      p: [-0.1, 0.72, d + 0.014],
    },
    0.85,
  );
  t.label(
    "储液箱 1000 升",
    {
      color: "black",
      font: "sans",
      distress: 0.2,
    },
    0.36,
    0.06,
    {
      p: [-0.1, 0.8, d + 0.0175],
    },
  );
  t.decal(
    i.mats.decal(["hazard_flammable", "hazard_general"][t.seed % 2]),
    0.15,
    {
      p: [-0.19, 0.67, d + 0.0175],
    },
  );
  t.decal(i.mats.decal("numbers_0_9"), 0.2, {
    p: [0, 0.66, d + 0.0175],
  });
  t.decal(i.mats.decal("leak_stain"), 0.3, {
    p: [p + 0.004, 0.3, 0.02],
    r: FACE_ROTATIONS.px,
  });
  t.add(
    "polymer_black",
    rodGeo([0.52, 0.2, 0], [0.575, 0.2, 0], 0.05, 10, true),
    null,
    1,
  );
  t.add(
    "plastic_red",
    rodGeo([0.575, 0.2, 0], [0.598, 0.2, 0], 0.045, 10, true),
    null,
    0.9,
  );
  t.add(
    "plastic_red",
    chamferBoxGeo(0.02, 0.022, 0.13, 0.005),
    {
      p: [0.55, 0.262, 0.02],
      r: [0, 0.4, 0],
    },
    0.9,
  );
  t.add("polymer_black", cylinderGeo(0.012, 0.012, 0.03, 6), {
    p: [0.55, 0.245, 0],
  });
  return t.finish();
}
function reelFlangePlankGeos(i: number, e: number, t: Rng, n = 0) {
  let s: THREE.BufferGeometry<
      THREE.NormalBufferAttributes,
      THREE.BufferGeometryEventMap
    >[] = [],
    o = (2 * i) / e;
  for (let r = 0; r < e; r++) {
    let a = -i + r * o + 0.003,
      l = -i + (r + 1) * o - 0.003,
      c = [a, (a + l) / 2, l],
      u: number[] = [],
      h: number[] = [],
      f: number[] = [],
      p: number[] = [],
      d = (y: number) => Math.sqrt(Math.max(0, i * i - y * y)),
      v = t() * 2,
      g = t() * 2;
    for (let y of c) {
      u.push(y, -d(y), 0, y, d(y), 0);
      h.push(0, 0, 1, 0, 0, 1);
      f.push(-d(y) + v, y + g, d(y) + v, y + g);
    }
    p.push(0, 2, 3, 0, 3, 1, 2, 4, 5, 2, 5, 3);
    let x = new THREE.BufferGeometry();
    x.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(u), 3),
    );
    x.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(h), 3));
    x.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(f), 2));
    x.setIndex(p);
    s.push(x);
  }
  return s;
}
function buildCableReel(i: any, e: { seed?: any }) {
  let t = new ClutterBuilder(i, "cable_reel", e.seed || 0),
    n = t.rng,
    s = 0.65,
    o = s,
    r = 0.4,
    a = 0.045,
    l = (y = 1) => {
      let b = n.range(0.7, 1) * y;
      return [b, b * n.range(0.93, 1), b * n.range(0.85, 0.97)];
    },
    c = n.range(-0.5, 0.5);
  t.push({
    p: [0, o, 0],
    r: [0, 0, c],
  });
  for (let y of [1, -1]) {
    for (let b of reelFlangePlankGeos(s - 0.004, 9, n))
      t.add(
        "wood_dark",
        b,
        {
          p: [0, 0, y * (r + n.range(0, 0.003))],
          r: [0, y > 0 ? 0 : PI, 0],
        },
        l(),
      );
    for (let b of reelFlangePlankGeos(s - 0.004, 9, n))
      t.add(
        "wood_dark",
        b,
        {
          p: [0, 0, y * (r - a)],
          r: [0, y > 0 ? PI : 0, HALF_PI],
        },
        l(0.8),
      );
    t.add(
      "wood_dark",
      cylinderGeo(s, s, a, 24, true),
      {
        p: [0, 0, y * (r - a / 2)],
        r: [HALF_PI, 0, 0],
      },
      l(0.75),
    );
    t.add(
      "steel_dark",
      cylinderGeo(0.105, 0.105, 0.008, 12),
      {
        p: [0, 0, y * (r + 0.006)],
        r: [HALF_PI, 0, 0],
      },
      0.9,
    );
    t.add(
      "polymer_black",
      cylinderGeo(0.04, 0.04, 0.004, 10),
      {
        p: [0, 0, y * (r + 0.0105)],
        r: [HALF_PI, 0, 0],
      },
      0.3,
    );
    for (let b = 0; b < 6; b++) {
      let m = (b * PI) / 3 + 0.3;
      t.add(
        "steel_galv",
        cylinderGeo(0.017, 0.017, 0.014, 6),
        {
          p: [Math.cos(m) * 0.3, Math.sin(m) * 0.3, y * (r + 0.006)],
          r: [HALF_PI, 0, 0],
        },
        n.range(0.5, 0.9),
      );
    }
    t.label(
      y > 0 ? "NYY-J 4x95 mm2  500 m" : "几猫港区",
      {
        color: "white",
        font: "stencil",
        distress: 0.45,
      },
      0.7,
      0.085,
      {
        p: [0, 0.4, y * (r + 0.006)],
        r: [0, y > 0 ? 0 : PI, 0],
      },
    );
    if (y > 0) {
      t.decal(i.mats.decal("arrow"), 0.2, {
        p: [0.36, -0.2, r + 0.006],
        r: [0, 0, -1.2],
      });
    }
  }
  let u = 16,
    h = r - a,
    f = (2 * h) / u,
    p = 0.47,
    d: number[][] = [];
  for (let y = 0; y <= u; y++) {
    d.push([p - 0.017, -h + y * f]);
    if (y < u) {
      d.push([p, -h + (y + 0.5) * f]);
    }
  }
  let v = t.seed * 0.7;
  t.add(
    "rubber",
    ringStripGeo(d, 20),
    {
      r: [HALF_PI, 0, 0],
    },
    (y: number, b: number, m: number) =>
      0.7 + 0.5 * valueNoise3(Math.atan2(b, y) * 2 + v, m * 30),
  );
  t.pop();
  let g = 0.2,
    x: number[][] = [];
  for (let y = 1.9; y >= -0.25; y -= 0.36)
    x.push([
      Math.cos(y) * (p + 0.012),
      o + Math.sin(y) * (p + 0.012),
      g + (1.9 - y) * 0.02,
    ]);
  x.push(
    [0.53, 0.3, g + 0.05],
    [0.56, 0.08, g + 0.06],
    [0.5, 0.024, g + 0.02],
    [0.3, 0.022, g - 0.1],
    [0.05, 0.022, g - 0.02],
    [-0.2, 0.022, g + 0.06],
    [-0.38, 0.022, g - 0.05],
  );
  t.add("rubber", tubeGeo(x, 0.02, 6, false, 0.5), null, 0.9);
  t.add(
    "brass",
    rodGeo([-0.38, 0.022, g - 0.05], [-0.41, 0.022, g - 0.07], 0.014, 6, true),
    null,
    0.9,
  );
  for (let y of [r - a / 2, -(r - a / 2)]) {
    t.add(
      "wood_pallet",
      pillowGeo(
        [
          [0.14, 0],
          [0.37, 0],
          [0.37, 0.1],
        ],
        0.1,
        {
          soft: 0,
        },
      ),
      {
        p: [0, 0, y],
      },
      l(0.8),
    );
    t.add(
      "wood_pallet",
      pillowGeo(
        [
          [-0.37, 0],
          [-0.14, 0],
          [-0.37, 0.1],
        ],
        0.1,
        {
          soft: 0,
        },
      ),
      {
        p: [0, 0, y],
      },
      l(0.8),
    );
  }
  return t.finish();
}
export function tireProfile(i: number, e: number, t: number, n = 20) {
  let s = i - t,
    o = Math.min(0.011, s * 0.08),
    r = [
      [t, e * 0.18],
      [t + s * 0.45, e * 0.035],
      [i - s * 0.2, e * 0.02],
      [i - s * 0.06, e * 0.07],
      [i, e * 0.17],
      [i, e * 0.17],
      [i, e * 0.355],
      [i - o, e * 0.385],
      [i, e * 0.415],
      [i, e * 0.585],
      [i - o, e * 0.615],
      [i, e * 0.645],
      [i, e * 0.83],
      [i, e * 0.83],
      [i - s * 0.06, e * 0.93],
      [i - s * 0.2, e * 0.98],
      [t + s * 0.45, e * 0.965],
      [t, e * 0.82],
      [t, e * 0.82],
      [t, e * 0.18],
    ],
    a = ringStripGeo(r, n),
    l = a.attributes.uv,
    c = r.length,
    u = [0];
  for (let v = 1; v < c; v++)
    u.push(u[v - 1] + Math.hypot(r[v][0] - r[v - 1][0], r[v][1] - r[v - 1][1]));
  let h = (u[8] + u[9]) / 2,
    f = h - u[4],
    p = u[4] - u[0],
    d = Math.max(1, Math.round((2 * PI * i) / 0.5)) * 0.5;
  for (let v = 0; v < c; v++) {
    let g = v >= c - 2 ? -(f + p) : u[v] - h,
      x = Math.abs(g),
      y =
        Math.sign(g) *
        (x <= f + 1e-6
          ? (x / f) * 0.126
          : 0.126 + Math.min(1, (x - f) / p) * 0.022);
    for (let b = 0; b <= n; b++) l.setXY(v * (n + 1) + b, (b / n) * d, y);
  }
  return a;
}
function buildTireStack(i: any, e: { seed?: any; count?: any }) {
  let t = new ClutterBuilder(i, "tire_stack", e.seed || 0),
    n = t.rng,
    s = clampRange(e.count | 0 || 4, 1, 5);
  for (let o = 0; o < s; o++) {
    let r = tireProfile(0.39, 0.25, 0.215, s > 4 ? 16 : 20),
      a = {
        p: [
          o ? n.range(-0.022, 0.022) : 0,
          o * 0.25 - (o ? 0.004 : 0),
          o ? n.range(-0.022, 0.022) : 0,
        ],
        r: [0, n() * 6, 0],
      },
      l = n.range(0.75, 1),
      c = o * 3.1;
    t.add("tire", r, a, (u: number, h: any, f: number) => {
      let p = Math.hypot(u - a.p[0], f - a.p[2]);
      return (
        l *
        (p < 0.23
          ? 0.5
          : 0.8 + 0.2 * valueNoise3(Math.atan2(f, u) * 3 + c, p * 30))
      );
    });
  }
  return t.finish({
    size: [0.8, s * 0.25, 0.8],
  });
}
function buildJerryCan(i: any, e: { color?: any }, t: number) {
  let n = new ClutterBuilder(i, "jerry_can", t),
    [s, o] = paintMaterial(e.color, "olive"),
    r = softBoxGeo(0.336, 0.36, 0.156, 0.022, 3, 3, 3, "bottom"),
    a = (x: number, y: number) =>
      y > 0.3 && x > 0.04 ? y - (x - 0.04) * 0.5 : y;
  displaceGeo(r, (x: { y: number; x: number; z: number }) => {
    x.y = a(x.x, x.y);
    if (
      Math.abs(x.z) > 0.07 &&
      Math.abs(x.x) < 0.14 &&
      x.y > 0.04 &&
      x.y < 0.3
    ) {
      x.z *= 1.02;
    }
  });
  r.computeVertexNormals();
  n.add(s, r, null, o);
  n.add(
    s,
    pillowGeo(
      [
        [-0.172, 0],
        [0.172, 0],
        [0.172, 0.297],
        [0.045, 0.364],
        [-0.172, 0.364],
      ],
      0.007,
      {
        soft: 0,
      },
    ),
    null,
    typeof o == "number" ? 0.8 : o.map((x: number) => x * 0.8),
  );
  let l = 0.24,
    c = 0.2,
    u = -0.025,
    h = 0.165,
    f = Math.hypot(l, c) - 0.02,
    p = Math.atan2(c, l);
  for (let x of [1, -1]) {
    let y = x * 0.079;
    for (let b of [1, -1])
      n.add(
        s,
        chamferBoxGeo(l, 0.016, 0.007, 0.003),
        {
          p: [u, h + (b * c) / 2, y],
        },
        o,
      );
    for (let b of [1, -1])
      n.add(
        s,
        chamferBoxGeo(0.016, c, 0.007, 0.003),
        {
          p: [u + (b * l) / 2, h, y],
        },
        o,
      );
    for (let b of [1, -1])
      n.add(
        s,
        chamferBoxGeo(f, 0.018, 0.008, 0.003),
        {
          p: [u, h, y],
          r: [0, 0, b * p],
        },
        o,
      );
  }
  for (let x of [-0.042, 0, 0.042])
    n.add(
      s,
      tubeGeo(
        [
          [-0.135, 0.35, x],
          [-0.125, 0.42, x],
          [-0.09, 0.44, x],
          [-0.02, 0.44, x],
          [0.01, 0.42, x],
          [0.02, 0.35, x],
        ],
        0.0105,
        5,
        false,
        0.5,
      ),
      null,
      o,
    );
  let d = [0.1, 0.33, 0],
    v = [0.42, 0.9, 0],
    g = (x: number) => [d[0] + v[0] * x, d[1] + v[1] * x, 0];
  n.add(s, rodGeo(g(-0.02), g(0.07), 0.03, 8, true), null, o);
  n.add("steel_dark", rodGeo(g(0.07), g(0.1), 0.036, 8, true), null, 0.9);
  n.add(
    "steel_galv",
    chamferBoxGeo(0.07, 0.008, 0.02, 0.002),
    {
      p: g(0.108),
      r: [0, 0, -0.44],
    },
    0.8,
  );
  n.decal(i.mats.decal("hazard_flammable"), 0.055, {
    p: [0.125, 0.25, 0.0795],
  });
  n.decal(i.mats.decal("hazard_flammable"), 0.055, {
    p: [-0.125, 0.25, -0.0795],
    r: [0, PI, 0],
  });
  return n.finish();
}
function buildTrafficCone(i: any, e: { lying?: any }, t: number) {
  let n = new ClutterBuilder(i, "traffic_cone", t),
    s = n.rng,
    o = t * 4.1;
  if (e.lying) {
    n.push({
      p: [-0.34, 0.18, 0],
      r: [0, s() * 6, 0],
    });
    n.push({
      r: [0, 0, -HALF_PI + 0.16],
    });
  }
  let r = (h: number) =>
    0.128 + ((0.031 - 0.128) * (h - 0.05)) / (0.685 - 0.05);
  n.add("rubber", chamferBoxGeo(0.36, 0.03, 0.36, 0.008, "bottom"), null, 0.9);
  let a = (h: number, f: number, p: number) => {
      let d = valueNoise3(Math.atan2(p, h) * 3 + o, f * 14);
      return d > 0.68 ? 0.45 : 0.85 + 0.15 * d;
    },
    l = (
      h: number,
      f: number,
      p: number[][] | never[] = [],
      d: number[][] = [],
    ) => ringStripGeo([...p, [r(h), h], [r(f), f], ...d], 16),
    c = n.mat("plastic_red", {
      color: 12734234,
    }),
    u = n.mat("plastic_grey", {
      color: 13224386,
    });
  n.add(
    c,
    l(0.05, 0.36, [
      [0.165, 0.03],
      [0.15, 0.04],
      [0.136, 0.05],
    ]),
    null,
    a,
  );
  n.add(
    u,
    l(0.36, 0.5),
    null,
    (h: number, f: number, p: number) => 0.85 * a(h, f, p),
  );
  n.add(c, l(0.5, 0.56), null, a);
  n.add(
    u,
    l(0.56, 0.61),
    null,
    (h: number, f: number, p: number) => 0.85 * a(h, f, p),
  );
  n.add(
    c,
    l(
      0.61,
      0.685,
      [],
      [
        [0.028, 0.696],
        [0.018, 0.7],
        [0.018, 0.7],
        [0, 0.7],
      ],
    ),
    null,
    a,
  );
  if (e.lying) {
    n.pop();
    n.pop();
  }
  return n.finish(
    e.lying
      ? {
          size: [0.72, 0.36, 0.36],
        }
      : {},
  );
}
function buildGasCylinders(i: any, e: { seed?: any }) {
  let t = new ClutterBuilder(i, "gas_cylinders", e.seed || 0),
    n = t.rng,
    s = 12,
    o = () => n.range(0.6, 0.9);
  t.add(
    "diamond_plate",
    chamferBoxGeo(0.9, 0.016, 0.5, 0.004, "bottom"),
    null,
    0.8,
  );
  for (let u of [-0.43, 0.43]) {
    t.add(
      "steel_dark",
      chamferBoxGeo(0.04, 1.14, 0.04, 0.005),
      {
        p: [u, 0.585, -0.225],
      },
      o(),
    );
    t.add(
      "steel_dark",
      chamferBoxGeo(0.036, 0.036, 0.43, 0.005),
      {
        p: [u, 1.06, -0.01],
      },
      o(),
    );
    t.add(
      "steel_dark",
      chamferBoxGeo(0.036, 0.036, 0.43, 0.005),
      {
        p: [u, 0.3, -0.01],
      },
      o(),
    );
    t.add(
      "steel_dark",
      chamferBoxGeo(0.036, 0.32, 0.036, 0.005),
      {
        p: [u, 0.16, 0.19],
      },
      o(),
    );
    t.add(
      "steel_galv",
      torusGeo(0.016, 0.004, 4, 8),
      {
        p: [u - Math.sign(u) * 0, 1.06, 0.215],
        r: [0, HALF_PI, 0],
      },
      0.8,
    );
  }
  for (let u of [0.45, 1.06])
    t.add(
      "steel_dark",
      chamferBoxGeo(0.9, 0.04, 0.036, 0.005),
      {
        p: [0, u, -0.225],
      },
      o(),
    );
  t.add(
    "paint_yellow",
    chamferBoxGeo(0.3, 0.2, 0.004, 0.001),
    {
      p: [0, 0.76, -0.245],
    },
    0.9,
  );
  t.decal(i.mats.decal("hazard_flammable"), 0.15, {
    p: [0, 0.76, -0.2475],
    r: [0, PI, 0],
  });
  let r: [string, number | number[]][] = [
      ["paint_red", 1],
      ["paint_white", 1],
      ["paint_blue", 1],
      ["paint_yellow", 1],
      ["paint_grey", 0.5],
    ],
    a: [string, number | number[]][] = [
      ["paint_grey", 0.75],
      ["paint_grey", 0.55],
      ["paint_red", [0.55, 0.4, 0.4]],
      ["paint_blue", 0.8],
    ];
  for (let u = 0; u < 3; u++) {
    let h = (u - 1) * 0.272,
      f = 1 - n.range(0, 0.05),
      p = 0.115,
      d = r[(t.seed + u * 2) % r.length],
      v = a[(t.seed + u) % a.length],
      g = u * 5.3 + t.seed,
      x = n() * 6;
    t.push({
      p: [h, 0.016, 0.015 + n.range(-0.01, 0.01)],
      r: [0, x, 0],
      s: [1, f, 1],
    });
    t.add(
      v[0],
      ringStripGeo(
        [
          [0, 0.012],
          [0.095, 0.012],
          [0.095, 0.012],
          [0.1, 0],
          [0.111, 0],
          [p, 0.008],
          [p, 0.4],
          [p, 0.8],
          [p, 1.22],
        ],
        s,
      ),
      null,
      (y: number, b: number, m: number) => {
        let A = valueNoise3(Math.atan2(m, y) * 3 + g, b * 5),
          _ = A > 0.7 ? 0.55 : 1,
          M = typeof v[1] == "number" ? [v[1], v[1], v[1]] : v[1];
        return [
          M[0] * _,
          M[1] * _ * (A > 0.7 ? 0.85 : 1),
          M[2] * _ * (A > 0.7 ? 0.7 : 1),
        ];
      },
    );
    t.add(
      d[0],
      ringStripGeo(
        [
          [p, 1.22],
          [0.111, 1.285],
          [0.098, 1.34],
          [0.075, 1.385],
          [0.052, 1.41],
          [0.04, 1.42],
        ],
        s,
      ),
      null,
      d[1],
    );
    t.add(
      "steel_dark",
      ringStripGeo(
        [
          [0.04, 1.42],
          [0.057, 1.42],
          [0.057, 1.42],
          [0.057, 1.448],
          [0.057, 1.448],
          [0.05, 1.452],
          [0.053, 1.53],
          [0.046, 1.565],
          [0.026, 1.585],
          [0, 1.588],
        ],
        s,
      ),
      null,
      0.8,
    );
    for (let y of [0, PI])
      t.add(
        "polymer_black",
        cylinderGeo(0.016, 0.016, 0.004, 6),
        {
          p: [Math.cos(y) * 0.052, 1.5, Math.sin(y) * 0.052],
          r: [0, -y, HALF_PI],
        },
        0.2,
      );
    if (u !== 1) {
      t.cdecal(
        i.mats.decal(u ? "hazard_general" : "hazard_flammable"),
        p + 0.0015,
        0.1,
        {
          p: [0, 1.08, 0],
          r: [0, n.range(-0.5, 0.5) - x, 0],
        },
      );
    }
    t.cdecal(
      i.mats.label(["乙炔", "氧气", "氩气", "丙烷"][(t.seed + u) % 4], {
        color: "white",
        font: "stencil",
        distress: 0.4,
      }),
      p + 0.0015,
      0.2,
      {
        p: [0, 0.86, 0],
        r: [0, n.range(-0.4, 0.4) - x, 0],
      },
    );
    t.pop();
  }
  let l = 19,
    c = (u: number) => {
      let h = 0.215;
      for (let f = -1; f <= 1; f++) {
        let p = u - f * 0.272;
        if (Math.abs(p) < 0.115) {
          h = Math.max(h, 0.015 + Math.sqrt(0.123 * 0.123 - p * p) + 0);
        }
      }
      return Math.max(h, 0.1);
    };
  for (let u = 0; u < l; u++) {
    let h = u / (l - 1),
      f = -0.425 + 0.85 * h,
      p = Math.max(c(f), c(f - 0.03), c(f + 0.03)) + 0.004,
      d = 1.05 - 0.035 * Math.sin(PI * ((h * 3) % 1)) - 0.01;
    t.add(
      "steel_galv",
      torusGeo(0.017, 0.0045, 3, 6),
      {
        p: [f, d, p],
        r: [u % 2 ? HALF_PI : 0.15, 0, 0],
        s: [1.35, 1, 1],
      },
      n.range(0.6, 0.95),
    );
  }
  return t.finish();
}
function buildPipeStack(i: any, e: { seed?: any }) {
  let t = new ClutterBuilder(i, "pipe_stack", e.seed || 0),
    n = t.rng,
    s = 0.1365,
    o = 0.012,
    r = 0.08,
    a = 14,
    l = (h = 1) => {
      let f = n.range(0.6, 0.95) * h;
      return [f, f * 0.95, f * 0.86];
    };
  for (let h of [-2.2, 0, 2.2]) {
    t.add(
      "wood_dark",
      chamferBoxGeo(0.11, r, 1.2, 0.008),
      {
        p: [h + n.range(-0.1, 0.1), r / 2, 0],
        r: [0, n.range(-0.03, 0.03), 0],
      },
      l(),
    );
    for (let f of [1, -1])
      t.add(
        "wood_pallet",
        pillowGeo(
          f > 0
            ? [
                [0, 0],
                [0.158, 0],
                [0.158, 0.1],
              ]
            : [
                [-0.158, 0],
                [0, 0],
                [-0.158, 0.1],
              ],
          0.1,
          {
            soft: 0,
          },
        ),
        {
          p: [h, r, f * 0.44],
          r: [0, -HALF_PI, 0],
        },
        l(0.9),
      );
  }
  let c = [4, 3, 2],
    u = 2 * s * Math.sin(PI / 3);
  c.forEach((h, f) => {
    for (let p = 0; p < h; p++) {
      let d = (p - (h - 1) / 2) * 2 * s,
        v = r + s + f * u,
        g = n.range(5.78, 5.92),
        x = n.range(-3, 3 - g) * 0.999 + 0,
        y = Math.max(-3, Math.min(3 - g, x)) + g / 2,
        b = n() < 0.7 ? "steel_rust" : "steel_dark",
        m = n() * 50,
        A = n.range(0.75, 1),
        _ = new THREE.CylinderGeometry(s, s, g, a, 4, true);
      {
        let w = _.attributes.uv,
          S = _.attributes.position;
        for (let z = 0; z < w.count; z++)
          w.setXY(z, w.getX(z) * 2 * PI * s, S.getY(z));
      }
      let M = {
        p: [y, v, d],
        r: [n() * 6, 0, HALF_PI],
      };
      t.add(
        b,
        _,
        M,
        (w: number, S: number, z: number) =>
          A * (0.75 + 0.35 * valueNoise3(w * 1.3 + m, z * 9, S * 9)),
      );
      let E = flipWinding(cylinderGeo(s - o, s - o, g - 0.002, a, true));
      t.add(
        "steel_rust",
        E,
        M,
        (w: number) =>
          0.16 +
          0.5 *
            clutterSmoothstep(
              g / 2 + Math.abs(y) - 0.9,
              g / 2 + Math.abs(y) + 0.2,
              Math.abs(w - y) + Math.abs(y),
            ),
      );
      for (let w of [1, -1])
        t.add(
          b,
          ringStripGeo(
            w > 0
              ? [
                  [s, 0],
                  [s - o, 0],
                ]
              : [
                  [s - o, 0],
                  [s, 0],
                ],
            a,
          ),
          {
            p: [y + (w * g) / 2, v, d],
            r: [0, 0, -HALF_PI],
          },
          A * 1.1,
        );
    }
  });
  for (let h of [-1.35, 1.5]) {
    let p = 2 * s,
      d = r + s + 2 * u + s + 0.004,
      v: number[][] = [],
      g = [
        [-(1.5 * p + s + 0.004), r + s],
        [-(0.5 * p + s * 0.5 + 0.004), r + s + 2 * u + s * 0.87],
        [-0.5 * p, d],
        [0.5 * p, d],
        [0.5 * p + s * 0.5 + 0.004, r + s + 2 * u + s * 0.87],
        [1.5 * p + s + 0.004, r + s],
        [1.5 * p, r - 0.004],
        [-1.5 * p, r - 0.004],
        [-(1.5 * p + s + 0.004), r + s],
      ];
    for (let x of g) v.push([h, x[1], x[0]]);
    t.add("steel_dark", ribbonGeo(v, [0.016, 0, 0]), null, 0.7);
    t.add(
      "steel_galv",
      chamferBoxGeo(0.04, 0.012, 0.05, 0.003),
      {
        p: [h, d + 0.005, 0.03],
      },
      0.8,
    );
  }
  t.cdecal(
    i.mats.label("API 5L X52  273.1 x 12.5  HEAT 40719", {
      color: "white",
      font: "stencil",
      distress: 0.5,
    }),
    s + 0.002,
    0.2,
    {
      p: [0.9, r + s + 2 * u, s],
      r: [-HALF_PI + 0.9, 0, HALF_PI],
    },
    1.6,
  );
  return t.finish();
}
export function registerClutter(i: any) {
  i(
    "barrel",
    (e: any, t: { seed?: any; color?: any; lying?: any; open?: any } = {}) => {
      let n = Math.abs(t.seed | 0) % 4;
      return cachedClutter(
        `barrel|${t.color}|${!!t.lying}|${!!t.open}|${n}`,
        () => buildBarrel(e, t, n),
      );
    },
  );
  i("pallet", (e: any, t: { seed?: any; broken?: any } = {}) => {
    let n = Math.abs(t.seed | 0) % 4;
    return cachedClutter(`pallet|${!!t.broken}|${n}`, () =>
      buildPallet(e, t, n),
    );
  });
  i("pallet_stack", (e: any, t = {}) => buildPalletStack(e, t));
  i("crate_wood", (e: any, t = {}) => buildCrateWood(e, t));
  i("crate_stack", (e: any, t = {}) => buildCrateStack(e, t));
  i("ibc_tote", (e: any, t = {}) => buildIbcTote(e, t));
  i("cable_reel", (e: any, t = {}) => buildCableReel(e, t));
  i("tire_stack", (e: any, t = {}) => buildTireStack(e, t));
  i("jerry_can", (e: any, t: { seed?: any; color?: any } = {}) => {
    let n = Math.abs(t.seed | 0) % 2;
    return cachedClutter(`jerry|${t.color}|${n}`, () => buildJerryCan(e, t, n));
  });
  i("traffic_cone", (e: any, t: { seed?: any; lying?: any } = {}) => {
    let n = Math.abs(t.seed | 0) % 3;
    return cachedClutter(`cone|${!!t.lying}|${n}`, () =>
      buildTrafficCone(e, t, n),
    );
  });
  i("gas_cylinders", (e: any, t = {}) => buildGasCylinders(e, t));
  i("pipe_stack", (e: any, t = {}) => buildPipeStack(e, t));
}
