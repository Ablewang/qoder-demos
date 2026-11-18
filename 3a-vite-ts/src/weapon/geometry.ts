import type {
  BoxGeometry,
  BufferGeometryEventMap,
  NormalBufferAttributes,
  TubeGeometry,
} from "three";
import {
  BufferAttribute,
  BufferGeometry,
  Euler,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Matrix4,
  Path,
  Quaternion,
  Shape,
  Vector2,
  Vector3,
} from "three";
import { mergeGeos, roundedBoxGeo, tubeGeo } from "../utils/geometry";

const hash3w = (i: number, e: number, t: number) => {
  let n = Math.sin(i * 12.9898 + e * 78.233 + t * 37.719) * 43758.5453;
  return n - Math.floor(n);
};
const isBevelNormal = (i: number, e: number, t: number) =>
  Math.max(Math.abs(i), Math.abs(e), Math.abs(t)) < 0.95;
const isExtrudeBevelNormal = (i: any, e: any, t: number) => {
  let n = Math.abs(t);
  return n > 0.15 && n < 0.95;
};
function uvProject(
  i: BoxGeometry | ExtrudeGeometry | TubeGeometry,
  e: number[],
  t = 0,
  n: any = null,
) {
  let s = i.attributes.position,
    o = i.attributes.normal,
    r = s.count,
    a = new Float32Array(r * 3);
  for (let l = 0; l < r; l++) {
    let c = s.getX(l),
      u = s.getY(l),
      h = s.getZ(l),
      f =
        0.9 +
        0.2 *
          hash3w(Math.round(c * 70), Math.round(u * 70), Math.round(h * 70));
    if (t > 0 && n && n(o.getX(l), o.getY(l), o.getZ(l))) {
      let p = hash3w(
        Math.round(c * 300),
        Math.round(u * 300),
        Math.round(h * 300),
      );
      {
        let d = Math.max(0, p - 0.84) / 0.16;
        f *= 1 + t * 1.6 * d * d;
      }
    }
    a[l * 3] = e[0] * f;
    a[l * 3 + 1] = e[1] * f;
    a[l * 3 + 2] = e[2] * f;
  }
  i.setAttribute("color", new BufferAttribute(a, 3));
  return i;
}
const _wBoxEuler = new Euler();
const _wBoxRotMatrix = new Matrix4();
function wBox(
  i: number,
  e: number,
  t: number,
  n: number,
  s: number,
  o: number,
  r: number,
  a: number[],
  l = 0,
  c: number[] | null = null,
) {
  let u = roundedBoxGeo(i, e, t, n);
  uvProject(u, a, l, isBevelNormal);
  if (c) {
    _wBoxEuler.set(c[0], c[1], c[2]);
    u.applyMatrix4(_wBoxRotMatrix.makeRotationFromEuler(_wBoxEuler));
  }
  u.translate(s, o, -r);
  return u;
}
function shapeFromPoints(i: number[][], e: number[][][] | null) {
  let t = new Shape();
  i.forEach((n, s) => (s ? t.lineTo(n[0], n[1]) : t.moveTo(n[0], n[1])));
  t.closePath();
  if (e) {
    for (let n of e)
      t.holes.push(new Path(n.map((s) => new Vector2(s[0], s[1]))));
  }
  return t;
}
function extrudeShape(
  i: number[][],
  e: number,
  t: number,
  n: null | number[][][],
) {
  return new ExtrudeGeometry(shapeFromPoints(i, n), {
    depth: Math.max(1e-4, e - 2 * t),
    bevelEnabled: t > 0,
    bevelThickness: t,
    bevelSize: t,
    bevelOffset: -t,
    bevelSegments: 1,
    steps: 1,
    curveSegments: 6,
  });
}
function planarUvZ(i: ExtrudeGeometry) {
  i.computeBoundingBox();
  let e = i.boundingBox!.min.z,
    t = i.boundingBox!.max.z,
    n = i.attributes.position,
    s = i.attributes.normal;
  for (let o = 0; o < n.count; o++) {
    let r = s.getZ(o),
      a = Math.abs(r);
    if (a < 0.15 || a > 0.95) {
      continue;
    }
    let l = n.getZ(o);
    if (Math.abs(l - e) < 1e-6 || Math.abs(l - t) < 1e-6) {
      s.setXYZ(o, 0, 0, Math.sign(r));
    } else {
      let c = Math.hypot(s.getX(o), s.getY(o)) || 1;
      s.setXYZ(o, s.getX(o) / c, s.getY(o) / c, 0);
    }
  }
  return i;
}
function wExtrude(
  i: number[][],
  e: number,
  t: number,
  n: number,
  s: number[],
  o = 0,
  r: number[][][] | null = null,
) {
  let a = extrudeShape(i, t - e, n, r);
  uvProject(a, s, o, isExtrudeBevelNormal);
  planarUvZ(a);
  a.translate(0, 0, e + n);
  a.rotateY(Math.PI / 2);
  return a;
}
function wExtrudeAlt(
  i: number[][],
  e: number,
  t: number,
  n: number,
  s: number[],
  o = 0,
  r: number[][][] | null = null,
) {
  let a = extrudeShape(i, t - e, n, r);
  uvProject(a, s, o, isExtrudeBevelNormal);
  planarUvZ(a);
  a.translate(0, 0, -t + n);
  return a;
}
function wLathe(
  i: number[][],
  e: number,
  t: number[],
  n = 0,
  s = 0,
  o = 0,
  r: any = null,
) {
  let a: number[] = [],
    l: number[] = [],
    c: number[] = [],
    u: number[] = [],
    h = 0;
  for (let p = 0; p < i.length - 1; p++) {
    let [d, v] = i[p],
      [g, x] = i[p + 1],
      y = g - d,
      b = x - v,
      m = Math.hypot(y, b);
    if (m < 1e-7) {
      continue;
    }
    let A = b / m,
      _ = -y / m,
      M = Math.abs(A) > 0.25 && Math.abs(_) > 0.25;
    for (let E = 0; E <= e; E++) {
      let w = (E / e) * Math.PI * 2,
        S = Math.cos(w),
        z = Math.sin(w);
      for (let H = 0; H < 2; H++) {
        let O = H ? g : d,
          q = H ? x : v,
          U = s + O * S,
          T = o + O * z,
          D = -q;
        a.push(U, T, D);
        l.push(A * S, A * z, -_);
        let C = 0.9 + 0.2 * hash3w(Math.round(q * 150), Math.round(w * 3), p);
        if (M && n > 0) {
          let j = hash3w(E * 7.1, p * 3.3, q * 100);
          {
            let N = Math.max(0, j - 0.84) / 0.16;
            C *= 1 + n * 1.6 * N * N;
          }
        }
        let G = r ? r(O, q, t) : t;
        c.push(G[0] * C, G[1] * C, G[2] * C);
      }
    }
    for (let E = 0; E < e; E++) {
      let w = h + E * 2,
        S = w + 2,
        z = w + 1,
        H = w + 3;
      u.push(w, z, S, S, z, H);
    }
    h += (e + 1) * 2;
  }
  let f = new BufferGeometry();
  f.setAttribute("position", new Float32BufferAttribute(a, 3));
  f.setAttribute("normal", new Float32BufferAttribute(l, 3));
  f.setAttribute("color", new Float32BufferAttribute(c, 3));
  f.setAttribute(
    "uv",
    new Float32BufferAttribute(new Float32Array((a.length / 3) * 2), 2),
  );
  f.setIndex(u);
  return f;
}
function wRoundedTube(
  i: number,
  e: number,
  t: number,
  n: number,
  s: number,
  o: number[],
  r = 12,
  a = 0,
) {
  let l = Math.min(i * 0.25, e * 0.25),
    c = e / 2,
    u = wLathe(
      [
        [0, -c],
        [i - l, -c],
        [i, -c + l],
        [i, c - l],
        [i - l, c],
        [0, c],
      ],
      r,
      o,
      a,
    );
  u.rotateY(Math.PI / 2);
  u.translate(t, n, -s);
  return u;
}
function slotPath(i: number, e: number, t: number, n: number, s = 4) {
  let o: number[][] = [],
    r = n / 2,
    a = t / 2 - r;
  for (let l = 0; l <= s; l++) {
    let c = -Math.PI / 2 + (l / s) * Math.PI;
    o.push([i + a + Math.cos(c) * r, e + Math.sin(c) * r]);
  }
  for (let l = 0; l <= s; l++) {
    let c = Math.PI / 2 + (l / s) * Math.PI;
    o.push([i - a + Math.cos(c) * r, e + Math.sin(c) * r]);
  }
  return o;
}
const chamferRect = (i: number, e: number, t: number, n: number, s: number) => [
  [i + s, e],
  [t - s, e],
  [t, e + s],
  [t, n - s],
  [t - s, n],
  [i + s, n],
  [i, n - s],
  [i, e + s],
];
export const RIFLE = {
  name: "几猫九式突击步枪",
  muzzle: [0, 0, -0.531],
  eject: [0.023, 0.004, -0.028],
  sightY: 0.069,
  lensF: 0.0285,
  window: [
    [-0.016, 0.057],
    [0.016, 0.057],
    [0.016, 0.0772],
    [0.0122, 0.081],
    [-0.0122, 0.081],
    [-0.016, 0.0772],
  ],
  magPos: [0, -0.02, -0.0665],
  boltTravel: 0.062,
  railTop: 0.0435,
  grip: [0, -0.1, 0.073],
  handguard: [0, 0, -0.255],
  handguardR: 0.021,
  handlePos: [-0.026, 0.007, -0.078],
  squeeze: 0.86,
};
export function buildRifleGeometry() {
  let i = [1, 1, 1],
    e = [1, 1, 1],
    t = [5.5, 5.5, 5.7],
    n = [0.4, 0.4, 0.42],
    s = [1, 1, 1],
    o = [0.022, 0.022, 0.023],
    r: (
      | ExtrudeGeometry
      | BoxGeometry
      | BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>
    )[] = [],
    a: (
      | BoxGeometry
      | BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>
      | ExtrudeGeometry
    )[] = [],
    l: (ExtrudeGeometry | BoxGeometry)[] = [],
    c: (
      | BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>
      | BoxGeometry
    )[] = [],
    u: (ExtrudeGeometry | BoxGeometry)[] = [],
    h: BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>[] = [],
    f: (BoxGeometry | ExtrudeGeometry | TubeGeometry)[] = [],
    p = 9,
    d = 5,
    v = 0.6,
    g = [
      [-0.1, -0.02],
      [0.1, -0.02],
      [0.1, 0.027],
      [0.093, 0.034],
      [-0.088, 0.034],
      [-0.1, 0.024],
    ];
  r.push(
    wExtrude(g, 0, 0.0205, 0.0014, i, p, [
      chamferRect(-0.012, -0.01, 0.06, 0.012, 0.003),
    ]),
  );
  r.push(
    wExtrude(g, -0.0205, 0, 0.0014, i, p, [
      slotPath(0.032, 0.007, 0.112, 0.0075, 4),
    ]),
  );
  a.push(wBox(0.004, 0.036, 0.19, 5e-4, -0.0135, 0.006, 0, n));
  a.push(wBox(0.004, 0.012, 0.19, 5e-4, 0.0145, 0.022, 0, n));
  a.push(wBox(0.004, 0.008, 0.19, 5e-4, 0.0145, -0.014, 0, n));
  a.push(
    wLathe(
      [
        [0, 0.058],
        [0.0128, 0.058],
        [0.0128, 0.099],
        [0, 0.099],
      ],
      16,
      [0.8, 0.8, 0.82],
    ),
  );
  r.push(
    wBox(0.009, 0.02, 0.018, 0.003, 0.0225, 0.004, -0.026, i, p, [0, -0.35, 0]),
  );
  r.push(
    wLathe(
      [
        [0, -0.086],
        [0.0062, -0.086],
        [0.0072, -0.084],
        [0.0072, -0.06],
        [0.0045, -0.057],
        [0, -0.057],
      ],
      12,
      i,
      p,
      0.0215,
      0.012,
    ),
  );
  a.push(
    wLathe(
      [
        [0, -0.094],
        [0.0048, -0.094],
        [0.0055, -0.092],
        [0.0055, -0.086],
        [0, -0.086],
      ],
      12,
      t,
      0,
      0.0215,
      0.012,
    ),
  );
  r.push(wBox(0.004, 0.012, 0.05, 0.0015, -0.0212, -0.006, -0.055, i, p));
  r.push(wBox(0.004, 0.006, 0.15, 0.0015, -0.0212, 0.0215, 0.012, i, p));
  r.push(wBox(0.003, 0.01, 0.03, 0.001, 0.0212, 0.022, 0.075, i, p));
  r.push(
    wExtrudeAlt(
      [
        [-0.0078, 0.0335],
        [0.0078, 0.0335],
        [0.0106, 0.0402],
        [-0.0106, 0.0402],
      ],
      -0.096,
      0.397,
      5e-4,
      i,
      0,
    ),
  );
  let x = [
    [-0.0102, 0.0398],
    [0.0102, 0.0398],
    [0.0106, 0.0408],
    [0.0084, 0.0435],
    [-0.0084, 0.0435],
    [-0.0106, 0.0408],
  ];
  for (let F = 0; F < 49; F++) {
    let X = -0.094 + F * 0.01;
    r.push(wExtrudeAlt(x, X, X + 0.0048, 8e-4, i, p));
  }
  let y = [
    [-0.1, -0.021],
    [0.099, -0.021],
    [0.101, -0.03],
    [0.098, -0.088],
    [0.036, -0.082],
    [0.031, -0.058],
    [-0.03, -0.058],
    [-0.04, -0.066],
    [-0.078, -0.055],
    [-0.1, -0.044],
  ];
  l.push(wExtrude(y, -0.019, 0.019, 0.0014, s, v));
  l.push(
    wBox(0.043, 0.01, 0.066, 0.002, 0, -0.0835, 0.0668, s, v, [-0.095, 0, 0]),
  );
  l.push(wBox(0.0405, 0.052, 0.005, 8e-4, 0, -0.052, 0.0975, s, v));
  l.push(wBox(0.0405, 0.04, 0.005, 8e-4, 0, -0.048, 0.0345, s, v));
  a.push(wRoundedTube(0.0038, 0.0396, 0, -0.031, -0.086, t, 12));
  a.push(wRoundedTube(0.0038, 0.0396, 0, -0.029, 0.087, t, 12));
  a.push(wRoundedTube(0.0022, 0.0392, 0, -0.04, -0.012, t, 8));
  a.push(wRoundedTube(0.0022, 0.0392, 0, -0.032, -0.032, t, 8));
  for (let F of [-1, 1]) {
    a.push(wRoundedTube(0.0068, 0.004, F * 0.0205, -0.036, -0.048, e, 14, d));
    a.push(
      wBox(
        0.004,
        0.006,
        0.024,
        0.0015,
        F * 0.0228,
        -0.036,
        -0.036,
        e,
        d,
        [0.5, 0, 0],
      ),
    );
  }
  a.push(wBox(0.0045, 0.024, 0.013, 0.0015, -0.0212, -0.03, 0.022, e, d));
  for (let F = 0; F < 4; F++)
    a.push(
      wBox(
        0.0012,
        0.002,
        0.012,
        5e-4,
        -0.0238,
        -0.021 - F * 0.0045,
        0.022,
        e,
        d,
      ),
    );
  a.push(wRoundedTube(0.0058, 0.005, 0.0205, -0.042, 0.016, e, 12, d));
  l.push(wBox(0.004, 0.004, 0.026, 8e-4, 0.0205, -0.051, 0.016, s, v));
  l.push(wBox(0.004, 0.02, 0.004, 8e-4, 0.0205, -0.043, 0.027, s, v));
  l.push(
    wExtrude(
      [
        [0.033, -0.056],
        [0.033, -0.093],
        [0.024, -0.1005],
        [-0.031, -0.1005],
        [-0.041, -0.09],
        [-0.041, -0.06],
      ],
      -0.0085,
      0.0085,
      8e-4,
      s,
      v,
      [
        [
          [0.028, -0.059],
          [0.028, -0.091],
          [0.022, -0.096],
          [-0.029, -0.096],
          [-0.036, -0.088],
          [-0.036, -0.061],
        ],
      ],
    ),
  );
  a.push(
    wExtrude(
      [
        [-0.006, -0.057],
        [0.004, -0.057],
        [0.003, -0.069],
        [0.0065, -0.079],
        [0.01, -0.086],
        [0.0065, -0.088],
        [0.001, -0.081],
        [-0.004, -0.07],
      ],
      -0.0032,
      0.0032,
      8e-4,
      t,
      0,
    ),
  );
  l.push(
    wExtrude(
      [
        [-0.038, -0.05],
        [-0.045, -0.074],
        [-0.049, -0.086],
        [-0.049, -0.1],
        [-0.054, -0.112],
        [-0.057, -0.13],
        [-0.064, -0.158],
        [-0.11, -0.152],
        [-0.102, -0.112],
        [-0.096, -0.082],
        [-0.095, -0.064],
        [-0.103, -0.046],
        [-0.08, -0.044],
      ],
      -0.0165,
      0.0165,
      0.005,
      s,
      v,
    ),
  );
  for (let F = 0; F < 9; F++) {
    let X = -0.078 - F * 0.0082,
      ne = -0.073 + (X + 0.078) * 0.26;
    l.push(wBox(0.0345, 0.0028, 0.03, 0.001, 0, X, ne, s, v, [-0.25, 0, 0]));
  }
  for (let F = 0; F < 7; F++) {
    let X = -0.078 - F * 0.01,
      ne = -0.098 + (X + 0.078) * 0.14;
    l.push(wBox(0.022, 0.0045, 0.006, 0.0015, 0, X, ne, s, v, [-0.14, 0, 0]));
  }
  l.push(
    wBox(0.035, 0.006, 0.05, 0.002, 0, -0.157, -0.087, s, v, [0.13, 0, 0]),
  );
  a.push(wRoundedTube(0.003, 0.034, 0, -0.15, -0.085, t, 8));
  let b = RIFLE.handguardR,
    m = 0.00885,
    A = 0.0028,
    _ = 0.101,
    M = 0.398,
    E = [
      [_, -m],
      [M, -m],
      [M, m],
      [_, m],
    ];
  for (let F = 0; F < 8; F++) {
    let X: number[][][] = [];
    if (F === 0 || F === 4 || F === 6) {
      for (let $ = 0; $ < 6; $++)
        X.push(slotPath(0.13 + $ * 0.047, 0, 0.032, 0.007, 4));
    } else if (F !== 2) {
      for (let $ = 0; $ < 10; $++) {
        let ue = 0.124 + $ * 0.027;
        if (!(F === 3 && ue > 0.3)) {
          X.push(slotPath(ue, 0, 0.013, 0.0052, 3));
        }
      }
    }
    let ne = wExtrude(E, b - A, b, 9e-4, i, p, X);
    ne.rotateZ((F * Math.PI) / 4);
    r.push(ne);
    let re = ((F + 0.5) * Math.PI) / 4;
    r.push(
      wLathe(
        [
          [0, _],
          [0.003, _],
          [0.003, M],
          [0, M],
        ],
        8,
        i,
        0,
        Math.cos(re) * 0.0197,
        Math.sin(re) * 0.0197,
      ),
    );
  }
  r.push(
    wExtrudeAlt(
      [
        [-0.0088, 0.02],
        [0.0088, 0.02],
        [0.0106, 0.029],
        [0.0082, 0.0338],
        [-0.0082, 0.0338],
        [-0.0106, 0.029],
      ],
      0.1012,
      0.3978,
      0.0012,
      i,
      p,
    ),
  );
  r.push(
    wLathe(
      [
        [0.016, 0.096],
        [0.0238, 0.096],
        [0.0243, 0.0966],
        [0.0243, 0.106],
        [0.0232, 0.1075],
        [0.016, 0.1075],
      ],
      24,
      i,
      p,
    ),
  );
  r.push(
    wLathe(
      [
        [0.018, 0.3985],
        [0.0224, 0.3985],
        [0.0224, 0.4003],
        [0.0218, 0.401],
        [0.018, 0.401],
        [0.018, 0.3985],
      ],
      8,
      i,
      p,
    ),
  );
  for (let F of [-1, 1])
    for (let X of [0.112, 0.126])
      a.push(wRoundedTube(0.0024, 0.0024, F * 0.0212, -0.004, X, t, 10));
  for (let F of [0.115, 0.215, 0.3, 0.385])
    for (let X of [-1, 1])
      a.push(
        wLathe(
          [
            [0, -8e-4],
            [0.0017, -8e-4],
            [0.002, -4e-4],
            [0.002, 6e-4],
            [0, 6e-4],
          ],
          8,
          t,
          0,
          0,
          0,
        )
          .rotateX(Math.PI / 2)
          .translate(X * 0.0098, 0.0312, -F),
      );
  {
    let X = [
      wExtrudeAlt(
        [
          [-0.0078, 0.0206],
          [0.0078, 0.0206],
          [0.0106, 0.0242],
          [-0.0106, 0.0242],
        ],
        0.318,
        0.396,
        5e-4,
        i,
        0,
      ),
    ];
    for (let ne = 0; ne < 8; ne++) {
      let re = 0.319 + ne * 0.01;
      X.push(
        wExtrudeAlt(
          x.map(($) => [$[0], $[1] - 0.016]),
          re,
          re + 0.0048,
          5e-4,
          i,
          p,
        ),
      );
    }
    for (let ne of X) {
      ne.rotateZ(Math.PI / 4);
      r.push(ne);
    }
  }
  {
    let F: ExtrudeGeometry[] = [];
    for (let X = 0; X < 4; X++) {
      let ne = 0.352 + X * 0.01;
      F.push(
        wExtrudeAlt(
          x.map((re) => [re[0], re[1] - 0.016]),
          ne,
          ne + 0.0048,
          5e-4,
          i,
          p,
        ),
      );
    }
    F.push(
      wExtrudeAlt(
        [
          [-0.0078, 0.0206],
          [0.0078, 0.0206],
          [0.0106, 0.0242],
          [-0.0106, 0.0242],
        ],
        0.35,
        0.392,
        5e-4,
        i,
        0,
      ),
    );
    for (let X of F) {
      X.rotateZ(Math.PI);
      r.push(X);
    }
  }
  l.push(
    wExtrude(
      [
        [0.35, -0.026],
        [0.392, -0.026],
        [0.388, -0.036],
        [0.372, -0.05],
        [0.362, -0.05],
        [0.354, -0.036],
      ],
      -0.011,
      0.011,
      0.003,
      s,
      v,
    ),
  );
  l.push(
    wExtrude(
      [
        [0.2395, -0.0215],
        [0.2725, -0.0215],
        [0.2725, -0.03],
        [0.27, -0.092],
        [0.2665, -0.0965],
        [0.2455, -0.0975],
        [0.242, -0.093],
        [0.2395, -0.03],
      ],
      -0.014,
      0.014,
      0.0045,
      s,
      v,
    ),
  );
  for (let F = 0; F < 6; F++)
    l.push(
      wBox(
        0.0292,
        0.0022,
        0.0315,
        8e-4,
        0,
        -0.04 - F * 0.0085,
        0.256 - F * 3e-4,
        s,
        v,
      ),
    );
  l.push(wBox(0.03, 0.005, 0.04, 0.0015, 0, -0.024, 0.256, s, v));
  a.push(wRoundedTube(0.003, 0.031, 0, -0.025, 0.256, t, 10));
  a.push(
    wLathe(
      [
        [0.0115, 0.095],
        [0.0115, 0.15],
        [0.0095, 0.153],
        [0.0095, 0.285],
        [0.009, 0.288],
        [0.009, 0.322],
        [0.0086, 0.326],
        [0.0086, 0.435],
        [0.0092, 0.437],
        [0.0092, 0.453],
        [0.0075, 0.455],
        [0.0075, 0.461],
      ],
      20,
      e,
      d,
    ),
  );
  a.push(
    wLathe(
      [
        [0.0092, 0.286],
        [0.0135, 0.286],
        [0.0142, 0.2875],
        [0.0142, 0.3165],
        [0.0135, 0.318],
        [0.0092, 0.318],
      ],
      16,
      e,
      d,
    ),
  );
  a.push(wBox(0.014, 0.009, 0.03, 0.002, 0, 0.0145, 0.302, e, d));
  a.push(
    wLathe(
      [
        [0, 0.1],
        [0.0026, 0.1],
        [0.0026, 0.3],
        [0, 0.3],
      ],
      8,
      t,
      0,
      0,
      0.0172,
    ),
  );
  a.push(wRoundedTube(0.002, 0.0145, 0, 0.012, 0.308, t, 6));
  a.push(
    wLathe(
      [
        [0.0075, 0.459],
        [0.0108, 0.459],
        [0.0116, 0.4605],
        [0.0116, 0.477],
        [0.011, 0.478],
        [0.0052, 0.478],
      ],
      20,
      e,
      d,
    ),
  );
  a.push(
    wLathe(
      [
        [0.0052, 0.477],
        [0.0052, 0.517],
      ],
      12,
      n,
    ),
  );
  for (let F of [0.4865, 0.4965, 0.5065])
    a.push(
      wLathe(
        [
          [0.0052, F - 0.0019],
          [0.011, F - 0.0019],
          [0.0116, F - 0.0012],
          [0.0116, F + 0.0012],
          [0.011, F + 0.0019],
          [0.0052, F + 0.0019],
        ],
        20,
        e,
        d,
      ),
    );
  a.push(
    wLathe(
      [
        [0.0052, 0.5145],
        [0.011, 0.5145],
        [0.0116, 0.5155],
        [0.0116, 0.527],
        [0.0102, 0.5305],
        [0.0048, 0.5305],
        [0.0036, 0.526],
        [0.0036, 0.495],
      ],
      20,
      e,
      d,
      0,
      0,
      (F: number, X: any, ne: any) => (F < 0.0047 ? [0.25, 0.25, 0.25] : ne),
    ),
  );
  for (let F of [-1, 1])
    a.push(wBox(0.0125, 0.0042, 0.042, 0.0012, 0, F * 0.0096, 0.496, e, d));
  for (let F = 0; F < 3; F++)
    a.push(wRoundedTube(0.0016, 0.0236, 0, 0, 0.4675 + F * 0.0035, n, 6));
  r.push(
    wLathe(
      [
        [0, -0.292],
        [0.0142, -0.292],
        [0.0148, -0.2905],
        [0.0148, -0.1],
      ],
      20,
      i,
      p,
    ),
  );
  r.push(
    wLathe(
      [
        [0.0148, -0.122],
        [0.0185, -0.122],
        [0.0195, -0.1205],
        [0.0195, -0.1115],
        [0.0185, -0.11],
        [0.0148, -0.11],
      ],
      12,
      i,
      p * 1.5,
    ),
  );
  {
    let F = [
        [-0.019, -0.024],
        [0.019, -0.024],
        [0.021, -0.018],
        [0.021, 0.018],
        [0.016, 0.024],
        [-0.016, 0.024],
        [-0.021, 0.018],
        [-0.021, 0.006],
        [-0.036, 0.004],
        [-0.04, -0.002],
        [-0.04, -0.014],
        [-0.034, -0.02],
        [-0.021, -0.02],
      ],
      X = [
        [-0.025, -0.014],
        [-0.025, -0.002],
        [-0.033, -5e-4],
        [-0.036, -0.004],
        [-0.036, -0.012],
        [-0.032, -0.016],
      ];
    a.push(wExtrudeAlt(F, -0.1095, -0.1045, 8e-4, [1.6, 1.6, 1.65], d, [X]));
  }
  l.push(
    wExtrude(
      [
        [-0.146, 0.024],
        [-0.3, 0.024],
        [-0.331, 0.014],
        [-0.334, -0.086],
        [-0.318, -0.101],
        [-0.29, -0.096],
        [-0.232, -0.04],
        [-0.146, -0.024],
      ],
      -0.019,
      0.019,
      0.004,
      s,
      v,
      [
        [
          [-0.262, -0.036],
          [-0.306, -0.036],
          [-0.306, -0.074],
          [-0.292, -0.074],
        ],
      ],
    ),
  );
  l.push(wBox(0.033, 0.016, 0.118, 0.006, 0, 0.031, -0.232, s, v));
  for (let F of [-0.196, -0.268])
    a.push(wRoundedTube(0.0032, 0.035, 0, 0.03, F, t, 8));
  l.push(wBox(0.012, 0.012, 0.04, 0.003, 0, -0.033, -0.19, s, v, [0.2, 0, 0]));
  f.push(wBox(0.037, 0.12, 0.011, 0.004, 0, -0.04, -0.3395, o, 0));
  for (let F = 0; F < 9; F++)
    f.push(
      wBox(0.031, 0.004, 0.003, 0.001, 0, 0.004 - F * 0.011, -0.3455, o, 0),
    );
  for (let F of [-1, 1])
    a.push(wRoundedTube(0.0065, 0.003, F * 0.0195, -0.06, -0.318, t, 12));
  let w = RIFLE.sightY,
    S = RIFLE.window,
    z = [0.012, 0.012, 0.013];
  r.push(wBox(0.03, 0.0092, 0.04, 0.0016, 0, 0.048, 0.021, i, p));
  r.push(wBox(0.0045, 0.0085, 0.034, 0.001, -0.0162, 0.0452, 0.021, i, p));
  for (let F of [0.009, 0.033]) {
    a.push(wRoundedTube(0.004, 0.0042, -0.02, 0.0452, F, t, 6));
    a.push(wRoundedTube(0.003, 0.0022, 0.016, 0.0452, F, t, 10));
  }
  let H = [
    [-0.0192, 0.0525],
    [0.0192, 0.0525],
    [0.0192, 0.0788],
    [0.0138, 0.0842],
    [-0.0138, 0.0842],
    [-0.0192, 0.0788],
  ];
  r.push(wExtrudeAlt(H, 0.008, 0.034, 0.001, i, p, [S]));
  f.push(
    wExtrudeAlt(
      S.map((F) => [F[0] * 1.004, (F[1] - w) * 1.004 + w]),
      0.0078,
      0.0342,
      0,
      z,
      0,
      [S.map((F) => [F[0] * 0.982, (F[1] - w) * 0.982 + w])],
    ),
  );
  let O = [
    [-0.0204, 0.06],
    [-0.0204, 0.0792],
    [-0.0143, 0.0854],
    [0.0143, 0.0854],
    [0.0204, 0.0792],
    [0.0204, 0.06],
    [0.0193, 0.06],
    [0.0193, 0.0788],
    [0.0138, 0.0843],
    [-0.0138, 0.0843],
    [-0.0193, 0.0788],
    [-0.0193, 0.06],
  ];
  r.push(wExtrudeAlt(O, 0.029, 0.038, 3e-4, i, p));
  a.push(
    wLathe(
      [
        [0, -0.006],
        [0.0052, -0.006],
        [0.0058, -0.0054],
        [0.0058, 0.0036],
        [0.0052, 0.0042],
        [0, 0.0042],
      ],
      14,
      e,
      d,
      0,
      0,
    )
      .rotateY(Math.PI / 2)
      .translate(0.0222, 0.0625, -0.021),
  );
  for (let F of [0.0165, 0.0245])
    f.push(wBox(0.0022, 0.0055, 0.0055, 9e-4, -0.0196, 0.064, F, o, 0));
  for (let F of [0.012, 0.03])
    for (let X of [-1, 1])
      a.push(wRoundedTube(0.0016, 0.0012, X * 0.0195, 0.0555, F, t, 8));
  f.push(wBox(0.009, 0.0026, 0.006, 6e-4, 0, 0.058, 0.0115, z));
  for (let [F, X] of [
    [0.0128, 0.0548],
    [-0.0128, 0.0548],
  ])
    a.push(
      wLathe(
        [
          [0, -6e-4],
          [0.0019, -6e-4],
          [0.0022, -2e-4],
          [0.0022, 7e-4],
          [0, 7e-4],
        ],
        10,
        t,
        0,
        F,
        X,
      )
        .translate(0, 0, -0.008 + 1e-4)
        .rotateY(0),
    );
  a.push(
    wLathe(
      [
        [0, -0.001],
        [0.0026, -0.001],
        [0.003, -5e-4],
        [0.003, 0.0012],
        [0, 0.0012],
      ],
      12,
      t,
      0,
      0,
      0,
    )
      .rotateX(Math.PI / 2)
      .translate(0.009, 0.0842, -0.014),
  );
  f.push(wBox(0.0012, 2e-4, 0.0044, 5e-5, 0.009, 0.0855, 0.014, z));
  f.push(
    wExtrudeAlt(S, 0.0304, 0.0318, 0, z, 0, [
      S.map((F) => [F[0] * 0.955, (F[1] - w) * 0.955 + w]),
    ]),
  );
  for (let [F, X] of [
    [-0.03, 1],
    [0.372, -1],
  ]) {
    a.push(wBox(0.021, 0.0075, 0.03, 0.0015, 0, 0.0472, F, e, d));
    a.push(wBox(0.0125, 0.004, 0.036, 0.001, 0, 0.0527, F + X * 0.004, e, d));
    a.push(wRoundedTube(0.0028, 0.024, 0, 0.0505, F - X * 0.013, e, 8));
    a.push(wBox(0.004, 0.006, 0.006, 0.001, X * 0.0125, 0.0475, F, e, d));
    a.push(wRoundedTube(0.0042, 0.0045, -0.0125, 0.0475, F + 0.006, t, 8));
  }
  a.push(
    wLathe(
      [
        [0.0016, -0.0012],
        [0.0034, -0.0012],
        [0.0038, -8e-4],
        [0.0038, 8e-4],
        [0.0034, 0.0012],
        [0.0016, 0.0012],
        [0.0016, -0.0012],
      ],
      12,
      e,
      d,
      0,
      0,
    )
      .rotateX(Math.PI / 2)
      .translate(0, 0.0553, 0.016),
  );
  a.push(wRoundedTube(0.0048, 0.005, 0.015, 0.049, -0.036, e, 12, d));
  for (let F = 0; F < 6; F++)
    a.push(
      wBox(
        0.0044,
        0.001,
        0.001,
        3e-4,
        0.015,
        0.049 + Math.sin(F * 1.047) * 0.0046,
        -0.036 + Math.cos(F * 1.047) * 0.0046,
        e,
        d,
      ),
    );
  r.push(wBox(0.016, 0.005, 0.02, 0.0012, 0, 0.0355, -0.098, i, p));
  a.push(wBox(0.01, 0.003, 0.008, 8e-4, 0, 0.0392, -0.0985, e, d));
  for (let F = 0; F < 4; F++)
    a.push(
      wBox(0.0092, 8e-4, 0.001, 3e-4, 0, 0.0409, -0.0958 - F * 0.0018, e, d),
    );
  let q = -0.0267,
    U = 0.0267;
  a.push(
    wLathe(
      [
        [0, 0.308],
        [0.0095, 0.308],
        [0.0108, 0.3095],
        [0.0108, 0.322],
        [0.0118, 0.323],
        [0.0118, 0.378],
        [0.0128, 0.38],
        [0.0142, 0.382],
        [0.0142, 0.404],
        [0.0136, 0.406],
        [0.0142, 0.408],
        [0.0142, 0.412],
        [0.0128, 0.4135],
        [0.0118, 0.4135],
        [0.0112, 0.409],
      ],
      18,
      e,
      d,
      q,
      U,
    ),
  );
  a.push(
    wLathe(
      [
        [0.0112, 0.409],
        [0, 0.409],
      ],
      18,
      [0.35, 0.4, 0.45],
      0,
      q,
      U,
    ),
  );
  for (let F = 0; F < 5; F++)
    a.push(
      wLathe(
        [
          [0.0118, 0.33 + F * 0.008],
          [0.0124, 0.3305 + F * 0.008],
          [0.0124, 0.3335 + F * 0.008],
          [0.0118, 0.334 + F * 0.008],
        ],
        18,
        e,
        d,
        q,
        U,
      ),
    );
  {
    let F = wBox(0.02, 0.008, 0.04, 0.0012, 0, 0.028, 0.352, e, d);
    F.rotateZ(Math.PI / 4);
    a.push(F);
  }
  {
    let F = wRoundedTube(0.004, 0.006, 0.0135, 0.028, 0.352, t, 8);
    F.rotateZ(Math.PI / 4);
    a.push(F);
  }
  f.push(wBox(0.0185, 0.0065, 0.07, 0.0025, 0, 0.0468, 0.214, o, 0));
  for (let F = 0; F < 6; F++)
    f.push(
      wBox(0.014, 0.0012, 0.004, 5e-4, 0, 0.0503, 0.192 + F * 0.009, o, 0),
    );
  let T = tubeGeo(
    [
      [q, U, -0.308],
      [q - 0.001, U + 0.002, -0.296],
      [-0.0265, 0.0235, -0.284],
      [-0.0255, 0.0215, -0.272],
      [-0.0235, 0.027, -0.262],
      [-0.016, 0.04, -0.256],
      [-0.007, 0.0465, -0.252],
      [-0.002, 0.047, -0.247],
    ],
    0.0018,
    6,
  );
  uvProject(T, o, 0);
  f.push(T);
  for (let F of [
    [-0.0262, 0.0228, 0.28],
    [-0.0242, 0.0255, 0.265],
  ]) {
    let X = wBox(0.0065, 0.0026, 0.0035, 8e-4, 0, 0, 0, [0.03, 0.03, 0.03], 0);
    X.rotateZ(Math.PI / 4);
    X.translate(F[0], F[1], -F[2]);
    f.push(X);
  }
  c.push(
    wLathe(
      [
        [0, -0.058],
        [0.0118, -0.058],
        [0.0124, -0.057],
        [0.0124, -0.01],
        [0.0116, -0.008],
        [0.0116, -0.002],
        [0.0124, 0],
        [0.0124, 0.046],
        [0.0105, 0.048],
        [0.0105, 0.056],
        [0.0062, 0.056],
        [0.0062, 0.06],
        [0, 0.06],
      ],
      16,
      [7, 7, 7.2],
      0,
      0,
      0.001,
    ),
  );
  for (let F = 0; F < 5; F++)
    c.push(
      wBox(
        0.0015,
        0.008,
        0.003,
        5e-4,
        0.0122,
        0.001,
        0.01 + F * 0.007,
        [1.2, 1.2, 1.2],
        0,
      ),
    );
  c.push(wBox(0.012, 0.0055, 0.014, 0.0015, -0.0165, 0.007, 0.078, e, d));
  {
    let F = wLathe(
      [
        [0, -0.009],
        [0.0045, -0.009],
        [0.0056, -0.0078],
        [0.0056, -0.003],
        [0.0048, -0.002],
        [0.0048, 0.002],
        [0.0056, 0.003],
        [0.0056, 0.0078],
        [0.0045, 0.009],
        [0, 0.009],
      ],
      12,
      e,
      d,
    );
    F.rotateY(Math.PI / 2);
    F.translate(-0.031, 0.007, -0.078);
    c.push(F);
  }
  let D = (F: number) => 1.5 * Math.pow(Math.max(0, F - 0.07), 2),
    C = (F: number) => 3 * Math.max(0, F - 0.07),
    G = [1, 1, 1],
    j: number[][] = [],
    N = 0.212,
    Q = 12;
  for (let F = 0; F <= Q; F++) {
    let X = -0.004 + ((N + 0.004) * F) / Q;
    j.push([D(X) + 0.0298, -X]);
  }
  for (let F = Q; F >= 0; F--) {
    let X = -0.004 + ((N + 0.004) * F) / Q;
    j.push([D(X) - 0.0298, -X]);
  }
  u.push(wExtrude(j, -0.0113, 0.0113, 0.002, G, 0.25));
  for (let F = 0; F < 8; F++) {
    let X = 0.082 + F * 0.0155;
    u.push(
      wBox(0.0246, 0.0058, 0.05, 0.0016, 0, -X, D(X), G, 0.3, [
        Math.atan(C(X)),
        0,
        0,
      ]),
    );
  }
  for (let F = 0; F < 10; F++) {
    let X = 0.078 + F * 0.013;
    u.push(
      wBox(0.012, 0.011, 0.004, 0.001, 0, -X, D(X) + 0.0302, G, 0.3, [
        Math.atan(C(X)),
        0,
        0,
      ]),
    );
  }
  u.push(
    wBox(0.027, 0.009, 0.068, 0.003, 0, -N - 0.003, D(N) + 0.001, G, 0.3, [
      Math.atan(C(N)),
      0,
      0,
    ]),
  );
  u.push(
    wBox(
      0.01,
      0.004,
      0.012,
      0.001,
      0,
      -N - 0.008,
      D(N) - 0.01,
      [0.6, 0.6, 0.6],
      0,
      [Math.atan(C(N)), 0, 0],
    ),
  );
  u.push(wBox(0.003, 0.006, 0.04, 0.001, -0.0085, 0.0045, 0.004, G, 0.3));
  u.push(wBox(0.003, 0.006, 0.04, 0.001, 0.0085, 0.0045, 0.004, G, 0.3));
  let K = [1.25, 0.72, 0.5];
  h.push(
    wLathe(
      [
        [0, -0.02],
        [0.004, -0.02],
        [0.0047, -0.019],
        [0.0047, 0.01],
        [0.0034, 0.014],
        [0.0034, 0.018],
      ],
      12,
      [1, 1, 1],
      0,
      0.002,
      0.0062,
    ),
  );
  h.push(
    wLathe(
      [
        [0.003, 0.018],
        [0.0029, 0.024],
        [0.0022, 0.03],
        [0.001, 0.0345],
        [0, 0.0352],
      ],
      12,
      K,
      0,
      0.002,
      0.0062,
    ),
  );
  h.push(
    wLathe(
      [
        [0, -0.02],
        [0.004, -0.02],
        [0.0047, -0.019],
        [0.0047, 0.01],
      ],
      10,
      [0.8, 0.8, 0.8],
      0,
      -0.003,
      5e-4,
    ),
  );
  let ie: Record<
    string,
    BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>
  > = {
    ano: mergeGeos(r),
    gun: mergeGeos(a),
    poly: mergeGeos(l),
    plain: mergeGeos(f),
    bolt: mergeGeos(c),
    mag: mergeGeos(u),
    round: mergeGeos(h),
  };
  for (let F of ["ano", "gun", "poly", "plain", "bolt"]) {
    let X = ie[F].attributes.position;
    for (let ne = 0; ne < X.count; ne++) {
      if (X.getZ(ne) > -0.1002 && X.getY(ne) < 0.0341) {
        X.setX(ne, X.getX(ne) * RIFLE.squeeze);
      }
    }
  }
  for (let F in ie) ie[F].computeBoundingSphere();
  return ie;
}
export const triCount = (
  i: BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>,
) => (i.index ? i.index.count : i.attributes.position.count) / 3;
const GLOVE_BACK = [31, 21.5, 12.5];
export const GLOVE_PAD = [5.6, 5.3, 5];
export const GLOVE_GUARD = [3.2, 3.1, 3];
const GLOVE_UNDERSIDE = [12.5, 10, 7.6];
const GLOVE_SIDE = [16, 11, 6.6];
const GLOVE_PAD_EDGE = [3, 2.6, 2.2];
export const GLOVE_STITCH = [36, 27, 16];
export const GLOVE_CUFF = [20, 14, 8.4];
export const GLOVE_CUFF_DARK = [4.8, 4.5, 4.2];
export const GLOVE_PULL_TAB = [30, 9.5, 2.2];
export const SLEEVE_BASE = [5, 6.9, 9];
export const SLEEVE_STRIPE = [30, 9.5, 2.2];
export const SLEEVE_REFLECTIVE = [26, 26, 25];
const wClamp01 = (i: number) => (i < 0 ? 0 : i > 1 ? 1 : i);
export const wSmoothstep = (i: number, e: number, t: number) => (
  (t = wClamp01((t - i) / (e - i))),
  t * t * (3 - 2 * t)
);
export const signedPow = (i: number, e: number) =>
  Math.sign(i) * Math.pow(Math.abs(i), e);
export const hash1 = (i: number) => {
  let e = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return e - Math.floor(e);
};
const _skinPoint = new Vector3();
const FINGER_AXIS = new Vector3(0, 0, -1);
export const SkinBuilder = class {
  declare weld: any;
  declare C: any;
  declare P: any;
  declare N: number;
  constructor(e: number) {
    this.N = e;
    this.P = [];
    this.C = [];
    this.weld = [];
  }
  v(e: Vector3, t: number[], n: any = 1) {
    this.P.push(e.x, e.y, e.z);
    this.C.push(t[0] * n, t[1] * n, t[2] * n);
  }
  rings() {
    return this.P.length / 3 / this.N;
  }
  collapse() {
    this.weld.push(this.rings() - 1);
  }
  geo(e = false) {
    let t = this.N,
      n = this.rings(),
      s: number[] = [];
    for (let a = 0; a < n - 1; a++)
      for (let l = 0; l < t; l++) {
        let c = a * t + l,
          u = a * t + ((l + 1) % t),
          h = c + t,
          f = u + t;
        if (e) {
          s.push(c, u, h, u, f, h);
        } else {
          s.push(c, h, u, u, h, f);
        }
      }
    let o = new BufferGeometry();
    o.setAttribute("position", new Float32BufferAttribute(this.P, 3));
    o.setAttribute("color", new Float32BufferAttribute(this.C, 3));
    o.setAttribute(
      "uv",
      new Float32BufferAttribute(new Float32Array((this.P.length / 3) * 2), 2),
    );
    o.setIndex(s);
    o.computeVertexNormals();
    let r = o.attributes.normal;
    for (let a of this.weld) {
      let l = 0,
        c = 0,
        u = 0;
      for (let f = 0; f < t; f++) {
        l += r.getX(a * t + f);
        c += r.getY(a * t + f);
        u += r.getZ(a * t + f);
      }
      let h = Math.hypot(l, c, u) || 1;
      for (let f = 0; f < t; f++) r.setXYZ(a * t + f, l / h, c / h, u / h);
    }
    return o;
  }
};
export function gridSurface(
  i: number[],
  e: number[],
  t:
    | ((h: number, f: number, p: Vector3) => number[])
    | ((
        v: number,
        g: number,
        x: { set: (arg0: number, arg1: number, arg2: number) => void },
      ) => number[]),
) {
  let n: number[] = [],
    s: any[] = [],
    o: number[] = [],
    r = i.length,
    a = e.length;
  for (let c = 0; c < a; c++)
    for (let u = 0; u < r; u++) {
      let h = t(i[u], e[c], _skinPoint);
      n.push(_skinPoint.x, _skinPoint.y, _skinPoint.z);
      s.push(h[0], h[1], h[2]);
    }
  for (let c = 0; c < a - 1; c++)
    for (let u = 0; u < r - 1; u++) {
      let h = c * r + u,
        f = h + 1,
        p = h + r,
        d = p + 1;
      o.push(h, f, p, f, d, p);
    }
  let l = new BufferGeometry();
  l.setAttribute("position", new Float32BufferAttribute(n, 3));
  l.setAttribute("color", new Float32BufferAttribute(s, 3));
  l.setAttribute(
    "uv",
    new Float32BufferAttribute(new Float32Array((n.length / 3) * 2), 2),
  );
  l.setIndex(o);
  l.computeVertexNormals();
  return l;
}
export const SEGMENT_GRID_STEPS = [-1, -0.9, -0.5, 0, 0.5, 0.9, 1];
export const gridEdgeProfile = (i: number) =>
  Math.abs(i) > 0.95 ? -1 : Math.abs(i) > 0.8 ? 0.82 : 1;
export function fingerSegment(
  i: number,
  e: number,
  t: number,
  n: number,
  s: number,
  o: any,
  r:
    | ((i: number, e: number) => number)
    | ((d: number) => number)
    | (() => number),
  a: any = null,
  l = false,
  c = SEGMENT_GRID_STEPS,
  u = SEGMENT_GRID_STEPS,
) {
  return gridSurface(c, u, (h: number, f: number, p: Vector3) => {
    let d = i + h * t,
      v = e + (l ? f : -f) * n,
      g = Math.min(gridEdgeProfile(h), gridEdgeProfile(f)),
      x = r(d, v) + (g < 0 ? -0.0022 : s * g);
    p.set(d, l ? -x : x, v);
    if (a) {
      a(p);
    }
    let y = typeof o == "function" ? o(h, f) : o,
      b = g < 0 ? 0.5 : g < 1 ? 0.8 : 1;
    return [y[0] * b, y[1] * b, y[2] * b];
  });
}
export const FINGERS = [
  {
    base: [-0.031, 0, -0.094],
    len: [0.044, 0.026, 0.022],
    rad: [0.0096, 0.009, 0.0083, 0.0076],
  },
  {
    base: [-0.0105, 0.001, -0.099],
    len: [0.049, 0.03, 0.023],
    rad: [0.0097, 0.0091, 0.0084, 0.0077],
  },
  {
    base: [0.0105, 0, -0.095],
    len: [0.045, 0.028, 0.022],
    rad: [0.0094, 0.0088, 0.0081, 0.0074],
  },
  {
    base: [0.03, -0.002, -0.086],
    len: [0.035, 0.021, 0.02],
    rad: [0.0084, 0.0078, 0.0072, 0.0066],
  },
];
const FINGER_RING_ANGLES = [
  12, 34, 44, 68, 90, 112, 136, 146, 168, 192, 220, 245, 270, 295, 320, 348,
].map((i) => (i * Math.PI) / 180);
const FINGER_RING_SEGS = FINGER_RING_ANGLES.length;
const FINGER_PAD_BULGE = 0.0012;
const PHALANX_RING_STOPS = [0.14, 0.22, 0.27, 0.73, 0.78, 0.88];
const DEFAULT_FINGER_BUMP = [0.1, 0.17, 0.1];
interface FingerDef {
  base: Vector3;
  qs: Quaternion[];
  len: number[];
  rad: number[];
  pads?: number[];
  patchJ?: number;
  bump?: number[];
  tipW?: number;
  tipH?: number;
  saddle?: number;
  rootBack?: number;
  rootK?: number;
  rootAo?: number;
}
function buildFinger(i: FingerDef) {
  let e = new SkinBuilder(FINGER_RING_SEGS),
    { base: t, qs: n, len: s, rad: o } = i,
    r = i.pads || [1, 1, 0],
    a = i.patchJ ?? 1,
    l = i.bump || DEFAULT_FINGER_BUMP,
    c = i.tipW || 1,
    u = i.tipH || 1,
    h: Vector3[] = [],
    f: Vector3[] = [],
    p = t.clone();
  for (let M = 0; M < 3; M++) {
    h.push(p.clone());
    f.push(FINGER_AXIS.clone().applyQuaternion(n[M + 1]));
    p.addScaledVector(f[M], s[M]);
  }
  let d = FINGER_AXIS.clone().applyQuaternion(n[0]),
    v = (M: number) => (M ? f[M - 1] : d),
    g = [0, 1, 2].map((M) => new Vector3().addVectors(v(M), f[M]).normalize()),
    x = (M: Vector3, E: number) =>
      (M.x - h[E].x) * g[E].x +
      (M.y - h[E].y) * g[E].y +
      (M.z - h[E].z) * g[E].z,
    y = (M: Vector3, E: number) => {
      let w = x(M, E);
      if (w > 0) {
        M.addScaledVector(v(E), -w / v(E).dot(g[E]));
      }
    },
    b = (M: Vector3, E: number) => {
      let w = x(M, E);
      if (w < 0) {
        M.addScaledVector(f[E], -w / f[E].dot(g[E]));
      }
    },
    m = new Vector3(),
    A = new Quaternion(),
    _ = (M: Quaternion, E: Vector3, w: number, S: any) => {
      let z = S.kD || 1,
        H = S.kP || 1,
        O = S.ao || 1;
      for (let q = 0; q < FINGER_RING_SEGS; q++) {
        let U = Math.cos(FINGER_RING_ANGLES[q]),
          T = Math.sin(FINGER_RING_ANGLES[q]),
          D = q >= 1 && q <= 7,
          C = q >= 2 && q <= 6,
          G = w * U,
          j =
            T > 0
              ? w * 0.96 * T * (C ? z : 1 + (z - 1) * 0.4)
              : w * 0.98 * T * H;
        if (S.pad && C) {
          G += U * FINGER_PAD_BULGE;
          j += T * FINGER_PAD_BULGE;
        }
        G *= S.wx || 1;
        j *= S.wy || 1;
        m.set(G, j, 0).applyQuaternion(M).add(E);
        if (S.a >= 0) {
          y(m, S.a);
        }
        if (S.b >= 0) {
          b(m, S.b);
        }
        let N = D
            ? GLOVE_BACK
            : q >= 10 && q <= 14
              ? GLOVE_UNDERSIDE
              : GLOVE_SIDE,
          Q = O;
        if (S.pad && C) {
          N = GLOVE_PAD;
        } else if (S.patch && C) {
          N = GLOVE_SIDE;
          Q *= 0.9;
        }
        if ((S.pad && D && !C) || (S.edge && D)) {
          N = GLOVE_PAD_EDGE;
        }
        if (S.saddle && q >= 8) {
          N = GLOVE_UNDERSIDE;
          Q *= 0.9;
        }
        if (S.stitch && D) {
          N = GLOVE_STITCH;
          Q *= 0.8;
        }
        if (q === 0 || q === 8 || q === 9 || q === 15) {
          Q *= 0.72;
        }
        if (q >= 9) {
          Q *= S.aoP || 1;
        }
        e.v(m, N, Q);
      }
    };
  _(
    n[0],
    _skinPoint.copy(h[0]).addScaledVector(d, -(i.rootBack || 0.012) - 0.002),
    1e-5,
    {
      a: 0,
      b: -1,
      ao: i.rootAo || 0.5,
    },
  );
  e.collapse();
  _(
    n[0],
    _skinPoint.copy(h[0]).addScaledVector(d, -(i.rootBack || 0.012)),
    o[0] * (i.rootK || 1),
    {
      a: 0,
      b: -1,
      ao: i.rootAo || 0.5,
      saddle: i.saddle,
    },
  );
  for (let M = 0; M < 3; M++) {
    for (let E = 0; E < 4; E++) {
      let w = E / 3;
      A.slerpQuaternions(n[M], n[M + 1], w);
      _(
        A,
        _skinPoint
          .copy(h[M])
          .addScaledVector(E < 2 ? v(M) : f[M], (E - 1.5) * 4e-4),
        o[M],
        {
          a: w < 0.5 ? M : -1,
          b: w < 0.5 ? -1 : M,
          kD: 1 + l[M] * (E === 0 || E === 3 ? 0.55 : 1),
          patch: M === a,
          saddle: i.saddle && M < 2,
          wx: M === 2 ? 1 + (c - 1) * 0.5 : 1,
          wy: M === 2 ? 1 + (u - 1) * 0.5 : 1,
          ao: M === 0 && !i.rootAo ? 0.62 + 0.1 * E : 1,
          aoP: E === 1 || E === 2 ? 0.55 : 0.8,
        },
      );
    }
    if (M < 2) {
      for (let E = 0; E < PHALANX_RING_STOPS.length; E++) {
        let w = PHALANX_RING_STOPS[E],
          S =
            (o[M] + (o[M + 1] - o[M]) * w) * (1 - 0.06 * Math.sin(Math.PI * w));
        _(n[M + 1], _skinPoint.copy(h[M]).addScaledVector(f[M], s[M] * w), S, {
          a: M + 1,
          b: M,
          pad: r[M] && (E === 2 || E === 3),
          edge: r[M] && (E === 1 || E === 4),
          saddle: i.saddle && M === 0,
          ao: M === 0 && !i.rootAo ? 0.86 + 0.14 * wSmoothstep(0, 0.5, w) : 1,
        });
      }
    } else {
      let E = o[3],
        w = s[2] - E;
      _(
        n[3],
        _skinPoint.copy(h[2]).addScaledVector(f[2], s[2] * 0.2),
        o[2] * 0.97,
        {
          a: -1,
          b: 2,
          stitch: 1,
          wx: c,
          wy: u,
        },
      );
      _(
        n[3],
        _skinPoint.copy(h[2]).addScaledVector(f[2], s[2] * 0.42),
        (o[2] + E) * 0.5,
        {
          a: -1,
          b: 2,
          kP: 1.08,
          wx: c,
          wy: u,
        },
      );
      for (let S of [0, 0.6, 1.05, 1.36])
        _(
          n[3],
          _skinPoint
            .copy(h[2])
            .addScaledVector(f[2], w + E * 1.08 * Math.sin(S)),
          E * Math.cos(S),
          {
            a: -1,
            b: -1,
            kP: 1.06,
            wx: c,
            wy: u,
          },
        );
      _(n[3], _skinPoint.copy(h[2]).addScaledVector(f[2], w + E * 1.08), 1e-5, {
        a: -1,
        b: -1,
      });
      e.collapse();
    }
  }
  return e.geo();
}
const quatYaw = (i: number) =>
  new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), i);
const quatPitch = (i: number) =>
  new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), i);
export function fingerChain(
  i: { base: number[]; len: number[]; rad: number[] },
  e: number[] | null,
) {
  let t = [quatYaw(e![3] || 0)];
  for (let n = 0; n < 3; n++) t.push(t[n].clone().multiply(quatPitch(-e![n])));
  return buildFinger({
    base: new Vector3(i.base[0], i.base[1], i.base[2]),
    qs: t,
    len: i.len,
    rad: i.rad,
  });
}
function basisFrom(i: Vector3, e: Vector3) {
  let t = i.clone().negate(),
    n = new Vector3().crossVectors(e, t);
  if (n.lengthSq() < 1e-6) {
    n.set(1, 0, 0);
  }
  n.normalize();
  let s = new Vector3().crossVectors(t, n);
  return new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(n, s, t),
  );
}
export function palmBasis(i: number[][]) {
  let e = i.map((o) => new Vector3(o[0], o[1], o[2]).normalize()),
    t = new Vector3(-0.72, 0.69, 0),
    n: Quaternion[] = [],
    s = e[2].clone().sub(e[0]);
  if (s.length() > 0.12) {
    t.multiplyScalar(0.25).addScaledVector(s.normalize(), -1);
  }
  for (let o = 0; o < 3; o++) n.push(basisFrom(e[o], t));
  n.unshift(n[0].clone());
  return buildFinger({
    base: new Vector3(-0.028, -0.007, -0.014),
    qs: n,
    len: [0.044, 0.031, 0.026],
    rad: [0.0165, 0.0118, 0.011, 0.01],
    pads: [0, 1, 0],
    patchJ: 2,
    bump: [0, 0.2, 0.2],
    tipW: 1.12,
    tipH: 0.86,
    saddle: 1,
    rootBack: 0.01,
    rootK: 0.72,
    rootAo: 0.9,
  });
}
const PALM_WRIST_Z = 0.006;
export const palmProfile = (i: number) =>
  -0.0975 + 0.0125 * Math.pow((i + 0.008) / 0.04, 2);
const palmKnuckleZ = (i: number) => palmProfile(i) + 0.006;
const handHalfWidth = (i: number) => 0.029 + 0.014 * wSmoothstep(0.05, 0.85, i);
const handBackThickness = (i: number) =>
  0.0185 - 0.0065 * wSmoothstep(0.1, 1, i);
const handPalmThickness = (i: number) =>
  0.0185 +
  0.003 * Math.sin(Math.PI * wClamp01(i * 1.6)) -
  0.0055 * wSmoothstep(0.3, 1, i);
export function palmPoint(i: number, e: number) {
  let t = wClamp01((PALM_WRIST_Z - e) / (PALM_WRIST_Z - palmKnuckleZ(i))),
    n = Math.min(0.999, Math.abs(i / handHalfWidth(t)));
  return handBackThickness(t) * Math.pow(1 - Math.pow(n, 2.5), 0.4);
}
export function palmNormal(i: number, e: number) {
  let t = wClamp01((PALM_WRIST_Z - e) / (PALM_WRIST_Z - palmKnuckleZ(i))),
    n = handHalfWidth(t),
    s = Math.min(0.999, Math.abs(i / n));
  return (
    handPalmThickness(t) *
    Math.pow(1 - Math.pow(s, 2.5), 0.4) *
    (1 + 0.14 * Math.max(0, i / n) * Math.sin(Math.PI * t))
  );
}
export function buildSleeve() {
  let e = new SkinBuilder(24),
    t = new Vector3(),
    n = [
      [0, 0, 1, 1],
      [0.1, 0, 1, 1],
      [0.22, 0, 1, 1],
      [0.36, 0, 1, 1],
      [0.5, 0, 1, 1],
      [0.64, 0, 1, 1],
      [0.77, 0, 1, 1],
      [0.89, 0, 1, 1],
      [1, 0, 1, 1],
      [1, -0.005, 0.8, 1],
      [1, -0.009, 0.45, 0.985],
      [1, -0.0105, 0.04, 0.97],
    ];
  for (let [s, o, r, a] of n) {
    let l = handHalfWidth(s) * a,
      c = handBackThickness(s) * r,
      u = handPalmThickness(s) * r;
    for (let h = 0; h < 24; h++) {
      let f = ((h + 0.5) / 24) * Math.PI * 2,
        p = Math.cos(f),
        d = Math.sin(f),
        v = l * signedPow(p, 0.8),
        g =
          d >= 0
            ? c * signedPow(d, 0.8)
            : u *
              signedPow(d, 0.8) *
              (1 + 0.14 * Math.max(0, v / l) * Math.sin(Math.PI * s));
      t.set(v, g, PALM_WRIST_Z + (palmKnuckleZ(v) - PALM_WRIST_Z) * s + o);
      let x = d > 0.3 ? GLOVE_BACK : d < -0.3 ? GLOVE_UNDERSIDE : GLOVE_SIDE,
        y = 1;
      if (s === 0.1 && d > 0.3) {
        x = GLOVE_STITCH;
        y = 0.75;
      }
      if (o < 0) {
        x = GLOVE_SIDE;
        y = 0.7 + o * 30;
      }
      if (d < -0.3) {
        y *= 0.82 + 0.18 * Math.abs(p);
      }
      e.v(t, x, y);
    }
  }
  return e.geo();
}
export function buildHand(i: Vector3) {
  let t = new SkinBuilder(12),
    n = new Vector3(),
    s = new Vector3(),
    o = new Vector3(),
    r = new Vector3(),
    a = new Vector3(),
    l = new Vector3(i.x, i.y, i.z - 1).normalize(),
    c = [-0.12, 0, 0.2, 0.4, 0.6, 0.78, 0.9];
  for (let d = 0; d < c.length; d++) {
    let v = c[d],
      g = d === 0 || d === c.length - 1;
    s.set(-0.028, -0.007, -0.014).addScaledVector(i, 0.044 * v);
    o.set(-0.03, -0.003, -0.022 - 0.06 * v);
    r.subVectors(s, o);
    let x = r.length() * 0.5 + 0.005;
    r.normalize();
    a.crossVectors(r, l).normalize();
    let y = g ? 1e-5 : 0.0085 * (1 - 0.55 * v),
      b = g ? 1e-5 : x * (1 - 0.3 * v * v);
    for (let m = 0; m < 12; m++) {
      let A = ((m + 0.5) / 12) * Math.PI * 2,
        _ = Math.cos(A),
        M = Math.sin(A);
      n.copy(s)
        .add(o)
        .multiplyScalar(0.5)
        .addScaledVector(r, _ * b)
        .addScaledVector(a, M * y);
      let E = a.y * M < 0;
      t.v(n, E ? GLOVE_UNDERSIDE : GLOVE_BACK, E ? 0.85 : 0.92);
    }
    if (g) {
      t.collapse();
    }
  }
  let u = t.geo(),
    h = u.attributes.position,
    f = u.index!.array,
    p = 0;
  for (let d = 0; d < f.length; d += 3) {
    s.fromBufferAttribute(h, f[d]);
    o.fromBufferAttribute(h, f[d + 1]);
    n.fromBufferAttribute(h, f[d + 2]);
    p += s.dot(o.cross(n));
  }
  if (p < 0) {
    for (let d = 0; d < f.length; d += 3) {
      let v = f[d + 1];
      f[d + 1] = f[d + 2];
      f[d + 2] = v;
    }
    u.computeVertexNormals();
  }
  return u;
}
export function mirrorGeo(
  i: BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>,
) {
  i.scale(-1, 1, 1);
  if (!i.index) {
    let t = i.attributes.position.count,
      n = new Uint32Array(t);
    for (let s = 0; s < t; s++) n[s] = s;
    i.setIndex(new BufferAttribute(n, 1));
  }
  let e = i.index!.array;
  for (let t = 0; t < e.length; t += 3) {
    let n = e[t + 1];
    e[t + 1] = e[t + 2];
    e[t + 2] = n;
  }
  return i;
}
