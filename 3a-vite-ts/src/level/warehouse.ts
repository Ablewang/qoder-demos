import type { Object3DEventMap } from "three";
import {
  ExtrudeGeometry,
  Group,
  Mesh,
  Path,
  PointLight,
  Shape,
  TorusGeometry,
  Vector3,
} from "three";
import {
  boxGeo,
  cylinderGeo,
  makeMesh,
  roundedBoxGeo,
} from "../utils/geometry";

export const WAREHOUSE = {
  X0: -16,
  X1: 12,
  Z0: -28,
  Z1: -11,
  EAVE: 7,
  RIDGE: 9.5,
  ZR: -19.5,
  FLOOR: 0.03,
};
const WAREHOUSE_BAY_X = [-16, -11.1, -6.2, -0.8, 5.6, 12];
const WAREHOUSE_FRONT_DOOR = {
  x0: -6,
  x1: -1,
  h: 5,
};
const WAREHOUSE_SIDE_DOOR = {
  z0: -22,
  z1: -17,
  h: 4.5,
};
const ROOF_SKYLIGHT_GAPS: [string, number, number][] = [
  ["S", 1, 4],
  ["S", 2, 5],
  ["S", 1, 11],
  ["S", 2, 15],
  ["S", 3, 8],
  ["N", 2, 7],
  ["N", 1, 13],
  ["N", 3, 17],
];
const ROOF_ROW_STOPS = [-0.04, 0.25, 0.5, 0.75, 1];
const ROOF_PANEL_COLS = 20;
export function buildWarehouse(i: any) {
  let {
      M: e,
      MI: t,
      box: n,
      slab: s,
      cyl: o,
      rod: r,
      ibeam: a,
      col: l,
      add: c,
      G: u,
    } = i,
    {
      X0: h,
      X1: f,
      Z0: p,
      Z1: d,
      EAVE: v,
      RIDGE: g,
      ZR: x,
      FLOOR: y,
    } = WAREHOUSE,
    b = (d - p) / 2,
    m = g - v,
    A = Math.atan2(m, b),
    _ = Math.hypot(b, m),
    M = (L: number) => v + m * (1 - Math.abs(L - x) / b),
    E = e("corrugated_roof"),
    w = t("corrugated_roof"),
    S = e("concrete"),
    z = t("concrete_painted"),
    H = t("paint_grey"),
    O = t("steel_galv"),
    q = e("steel_galv"),
    U = t("steel_dark"),
    T = 0.25;
  s(t("floor_epoxy"), h, -0.25, p, f, y, d, {
    cast: false,
  });
  l(h, -0.5, p, f, y, d, "concrete");
  s(
    S,
    WAREHOUSE_FRONT_DOOR.x0 - 0.4,
    -0.2,
    d,
    WAREHOUSE_FRONT_DOOR.x1 + 0.4,
    0.02,
    d + 1.4,
    {
      cast: false,
    },
  );
  s(
    S,
    f,
    -0.2,
    WAREHOUSE_SIDE_DOOR.z0 - 0.4,
    f + 1.4,
    0.02,
    WAREHOUSE_SIDE_DOOR.z1 + 0.4,
    {
      cast: false,
    },
  );
  function D(
    L: number,
    Z: number,
    J: number,
    oe: number,
    fe: number,
    le: number,
  ) {
    if (oe - J < 0.02 || le - fe < 0.02) {
      return;
    }
    let R = L,
      I = L - Z * T;
    if (fe < 1.2) {
      let ae = L - Z * T * 0.5;
      s(
        S,
        J,
        y - 0.2,
        Math.min(R, ae),
        oe,
        Math.min(1.2, le),
        Math.max(R, ae),
        {
          bevel: 0.015,
        },
      );
      s(
        z,
        J,
        y - 0.2,
        Math.min(ae, I),
        oe,
        Math.min(1.2, le),
        Math.max(ae, I),
        {
          bevel: 0.015,
        },
      );
    }
    let se = Math.max(fe, 1.2);
    if (!(le <= se)) {
      s(
        E,
        J,
        se - 0.03,
        Math.min(R + Z * 0.02, R + Z * 0.06),
        oe,
        le,
        Math.max(R + Z * 0.02, R + Z * 0.06),
      );
      s(
        w,
        J,
        se,
        Math.min(R - Z * 0.1, R - Z * 0.13),
        oe,
        le,
        Math.max(R - Z * 0.1, R - Z * 0.13),
      );
    }
  }
  function C(
    L: number,
    Z: number,
    J: number,
    oe: number,
    fe: number,
    le: number,
  ) {
    if (oe - J < 0.02 || le - fe < 0.02) {
      return;
    }
    let R = L,
      I = L - Z * T;
    if (fe < 1.2) {
      let ae = L - Z * T * 0.5;
      s(
        S,
        Math.min(R, ae),
        y - 0.2,
        J,
        Math.max(R, ae),
        Math.min(1.2, le),
        oe,
        {
          bevel: 0.015,
        },
      );
      s(
        z,
        Math.min(ae, I),
        y - 0.2,
        J,
        Math.max(ae, I),
        Math.min(1.2, le),
        oe,
        {
          bevel: 0.015,
        },
      );
    }
    let se = Math.max(fe, 1.2);
    if (!(le <= se)) {
      s(
        E,
        Math.min(R + Z * 0.02, R + Z * 0.06),
        se - 0.03,
        J,
        Math.max(R + Z * 0.02, R + Z * 0.06),
        le,
        oe,
      );
      s(
        w,
        Math.min(R - Z * 0.1, R - Z * 0.13),
        se,
        J,
        Math.max(R - Z * 0.1, R - Z * 0.13),
        le,
        oe,
      );
    }
  }
  function G(
    L: number,
    Z: number,
    J: number,
    oe: number,
    fe: number,
    le: number,
    R = 0.25,
    I = 0.45,
    se = 0.26,
  ) {
    let ae = Math.max(1, Math.floor((le - fe - 0.1) / I));
    for (let k = 0; k <= ae; k++) {
      let ce = fe + 0.08 + ((le - fe - 0.16) * k) / ae;
      n(q, oe - J, 0.018, se, (J + oe) / 2, ce, L - Z * 0.06, {
        r: [Z * R, 0, 0],
      });
    }
    for (let k of [J + 0.03, oe - 0.03, (J + oe) / 2])
      s(q, k - 0.03, fe, L - Z * 0.2, k + 0.03, le, L + Z * 0.06);
    s(q, J, fe - 0.05, L - Z * 0.2, oe, fe, L + Z * 0.07);
    s(q, J, le, L - Z * 0.2, oe, le + 0.05, L + Z * 0.07);
  }
  function j(
    L: number,
    Z: number,
    J: number,
    oe: number,
    fe: number,
    le: number,
    R = 0.5,
    I = 0.45,
    se = 0.26,
  ) {
    let ae = Math.max(1, Math.floor((le - fe - 0.1) / I));
    for (let k = 0; k <= ae; k++) {
      let ce = fe + 0.08 + ((le - fe - 0.16) * k) / ae;
      n(q, se, 0.018, oe - J, L - Z * 0.06, ce, (J + oe) / 2, {
        r: [0, 0, -Z * R],
      });
    }
    for (let k of [J + 0.03, oe - 0.03, (J + oe) / 2])
      s(q, L - Z * 0.2, fe, k - 0.03, L + Z * 0.06, le, k + 0.03);
    s(q, L - Z * 0.2, fe - 0.05, J, L + Z * 0.07, fe, oe);
    s(q, L - Z * 0.2, le, J, L + Z * 0.07, le + 0.05, oe);
  }
  let N = 5.45,
    Q = 6.8;
  for (let L = 0; L < WAREHOUSE_BAY_X.length - 1; L++) {
    let Z = WAREHOUSE_BAY_X[L],
      J = WAREHOUSE_BAY_X[L + 1];
    if (L === 2) {
      D(d, 1, Z, WAREHOUSE_FRONT_DOOR.x0, 0, v);
      D(d, 1, WAREHOUSE_FRONT_DOOR.x1, J, 0, v);
      D(
        d,
        1,
        WAREHOUSE_FRONT_DOOR.x0,
        WAREHOUSE_FRONT_DOOR.x1,
        WAREHOUSE_FRONT_DOOR.h,
        v,
      );
    } else {
      D(d, 1, Z, J, 0, N - 0.05);
      D(d, 1, Z, J, Q + 0.05, v);
      G(d, 1, Z + 0.15, J - 0.15, N, Q);
    }
  }
  D(p, -1, h, f, 0, v);
  s(t("paint_grey"), 6.2, y, p + T, 7.2, 2.1, p + T + 0.04);
  s(e("paint_grey"), 6.2, 0, p - 0.09, 7.2, 2.1, p - 0.05);
  C(h, -1, p, d, 0, v);
  C(f, 1, p, WAREHOUSE_SIDE_DOOR.z0, 0, N - 0.05);
  let K = {
    z0: -15.55,
    z1: -13.35,
    y0: 3.3,
  };
  C(f, 1, WAREHOUSE_SIDE_DOOR.z1, K.z0, 0, N - 0.05);
  C(f, 1, K.z1, d, 0, N - 0.05);
  C(f, 1, K.z0, K.z1, 0, K.y0);
  n(E, 0.03, 1.5, 1.05, f + 0.2, K.y0 - 0.55, K.z0 + 0.5, {
    r: [0.25, 0.1, -0.22],
  });
  n(E, 1, 0.03, 2, f + 1.3, 0.05, K.z0 + 1.6, {
    r: [0.02, 0.5, 0.03],
  });
  for (let L of [K.z0, K.z1])
    s(O, f - 0.16, K.y0, L - 0.03, f - 0.1, N - 0.05, L + 0.03);
  C(
    f,
    1,
    WAREHOUSE_SIDE_DOOR.z0,
    WAREHOUSE_SIDE_DOOR.z1,
    WAREHOUSE_SIDE_DOOR.h,
    N - 0.05,
  );
  C(f, 1, p, d, Q + 0.05, v);
  for (let [L, Z] of [
    [p + 0.3, -22.45],
    [-22.15, -16.85],
    [-16.55, d - 0.3],
  ])
    j(f, 1, L, Z, N, Q);
  let ie = {
    y: 8.02,
    r: 0.56,
  };
  function F(L: number, Z: number, J: boolean) {
    let oe = (fe: number, le: any, R: number) => {
      let I = new Shape();
      I.moveTo(-(d + 0.05), v - 0.02);
      I.lineTo(-x, g);
      I.lineTo(-(p - 0.05), v - 0.02);
      I.closePath();
      if (J) {
        let ae = new Path();
        ae.absarc(-x, ie.y, ie.r, 0, Math.PI * 2, true);
        I.holes.push(ae);
      }
      let se = new ExtrudeGeometry(I, {
        depth: fe,
        bevelEnabled: false,
        curveSegments: 20,
      });
      se.rotateY(Math.PI / 2);
      se.translate(L + R, 0, 0);
      c(se, le);
    };
    oe(0.04, E, Z > 0 ? 0.02 : -0.06);
    oe(0.03, w, Z > 0 ? -0.13 : 0.1);
  }
  F(f, 1, true);
  F(h, -1, false);
  l(h, 0, d - T, WAREHOUSE_FRONT_DOOR.x0, v, d + 0.06, "metal");
  l(WAREHOUSE_FRONT_DOOR.x1, 0, d - T, f, v, d + 0.06, "metal");
  l(
    WAREHOUSE_FRONT_DOOR.x0,
    WAREHOUSE_FRONT_DOOR.h - 0.5,
    d - 0.6,
    WAREHOUSE_FRONT_DOOR.x1,
    v,
    d + 0.06,
    "metal",
  );
  l(h, 0, p - 0.06, f, v, p + T, "metal");
  l(h - 0.06, 0, p, h + T, g, d, "metal");
  l(f - T, 0, p, f + 0.06, g, WAREHOUSE_SIDE_DOOR.z0, "metal");
  l(f - T, 0, WAREHOUSE_SIDE_DOOR.z1, f + 0.06, g, -15.55, "metal");
  l(f - T, 0, -13.35, f + 0.06, g, d, "metal");
  l(f - T, 0, -15.55, f + 0.06, 3.3, -13.35, "metal");
  l(f - T, 5.4, -15.55, f + 0.06, g, -13.35, "metal");
  l(
    f - T,
    WAREHOUSE_SIDE_DOOR.h,
    WAREHOUSE_SIDE_DOOR.z0,
    f + 0.06,
    g,
    WAREHOUSE_SIDE_DOOR.z1,
    "metal",
  );
  let X: { x: number; y: number; z: number; w: number; d: number }[] = [],
    ne = (f - h + 0.6) / ROOF_PANEL_COLS,
    re = h - 0.3;
  for (let L of ["S", "N"]) {
    let Z = L === "S" ? 1 : -1,
      J = [Z * A, 0, 0],
      oe = Math.cos(A),
      fe = Z * Math.sin(A);
    for (let R = 0; R < 4; R++) {
      let I = ROOF_ROW_STOPS[R],
        se = ROOF_ROW_STOPS[R + 1],
        ae = (I + se) / 2,
        k = (se - I) * _,
        ce = x + Z * b * (1 - ae),
        ve = v + m * ae,
        _e = 0;
      for (; _e < ROOF_PANEL_COLS;) {
        if (
          ROOF_SKYLIGHT_GAPS.some(
            (Ne) => Ne[0] === L && Ne[1] === R && Ne[2] === _e,
          )
        ) {
          _e++;
          continue;
        }
        let Te = _e;
        for (
          ;
          Te + 1 < ROOF_PANEL_COLS &&
          !ROOF_SKYLIGHT_GAPS.some(
            (Ne) => Ne[0] === L && Ne[1] === R && Ne[2] === Te + 1,
          );
        )
          Te++;
        let Pe = re + _e * ne,
          Re = re + (Te + 1) * ne,
          Fe = (Pe + Re) / 2;
        n(E, Re - Pe, 0.04, k + 0.02, Fe, ve + oe * 0.03, ce + fe * 0.03, {
          r: J,
        });
        n(w, Re - Pe, 0.02, k + 0.02, Fe, ve - oe * 0.02, ce - fe * 0.02, {
          r: J,
        });
        let ze = x + Z * b * (1 - I),
          We = x + Z * b * (1 - se);
        l(
          Math.max(Pe, h - 0.3),
          v + m * Math.max(0, I) - 0.05,
          Math.min(ze, We),
          Re,
          v + m * se + 0.08,
          Math.max(ze, We),
          "metal",
          {
            noNav: true,
          },
        );
        _e = Te + 1;
      }
    }
    for (let R of ROOF_SKYLIGHT_GAPS)
      if (R[0] === L) {
        let I = ROOF_ROW_STOPS[R[1]],
          se = ROOF_ROW_STOPS[R[1] + 1],
          ae = re + R[2] * ne,
          k = (I + se) / 2,
          ce = x + Z * b * (1 - k),
          ve = v + m * k;
        X.push({
          x: ae + ne / 2,
          y: ve,
          z: ce,
          w: ne,
          d: (se - I) * b,
        });
        i.decal(
          "leak_stain",
          1.9,
          ae + ne / 2 + 0.2,
          y + 0.004,
          ce,
          "y+",
          R[2] * 1.7,
        );
        n(
          O,
          0.05,
          0.05,
          (se - I) * _,
          ae + 0.02,
          ve - oe * 0.06,
          ce - fe * 0.06,
          {
            r: J,
          },
        );
        n(
          O,
          0.05,
          0.05,
          (se - I) * _,
          ae + ne - 0.02,
          ve - oe * 0.06,
          ce - fe * 0.06,
          {
            r: J,
          },
        );
      }
    for (let R of [0.03, 0.2, 0.37, 0.54, 0.71, 0.88, 0.985]) {
      let I = x + Z * b * (1 - R),
        se = v + m * R;
      n(
        O,
        f - h - 0.3,
        0.17,
        0.06,
        (h + f) / 2,
        se - oe * 0.13,
        I - fe * 0.13,
        {
          r: J,
        },
      );
    }
    let le = x + Z * (b + 0.38);
    s(
      q,
      h - 0.3,
      v - 0.22,
      Math.min(le, le + Z * 0.16),
      f + 0.3,
      v - 0.08,
      Math.max(le, le + Z * 0.16),
    );
    s(
      q,
      h - 0.3,
      v - 0.22,
      Math.min(le - Z * 0.05, le + Z * 0.21),
      f + 0.3,
      v - 0.19,
      Math.max(le - Z * 0.05, le + Z * 0.21),
    );
    for (let R = 0; R < WAREHOUSE_BAY_X.length; R++) {
      if (L === "S" && (R === 2 || R === 3)) {
        continue;
      }
      let I = Math.min(f - 0.5, Math.max(h + 0.5, WAREHOUSE_BAY_X[R])) + 0.42,
        se = x + Z * (b + 0.13);
      o(q, 0.055, v - 0.4, I, (v - 0.4) / 2 + 0.2, se, {
        seg: 8,
      });
      r(q, [I, v - 0.2, se], [I, v - 0.12, le + Z * 0.08], 0.05);
      for (let ae of [1.6, 3.6, 5.6])
        n(q, 0.16, 0.04, 0.14, I, ae, se - Z * 0.02);
      r(q, [I, 0.2, se], [I + 0.02, 0.06, se + Z * 0.22], 0.055);
    }
  }
  for (let L of [-1, 1])
    n(q, f - h + 0.7, 0.03, 0.34, (h + f) / 2, g + 0.03, x + L * 0.15, {
      r: [L * A, 0, 0],
    });
  for (let L of [h - 0.31, f + 0.31])
    for (let Z of [-1, 1])
      n(q, 0.04, 0.22, _ + 0.4, L, (v + g) / 2 - 0.05, x + Z * (b / 2 + 0.1), {
        r: [Z * A, 0, 0],
      });
  let $ = [d - T - 0.24, p + T + 0.24];
  for (let L = 0; L < WAREHOUSE_BAY_X.length; L++) {
    let Z =
      L === 0
        ? h + T + 0.12
        : L === WAREHOUSE_BAY_X.length - 1
          ? f - T - 0.12
          : WAREHOUSE_BAY_X[L];
    for (let J of $) {
      a(H, "y", v - 0.35, Z, y + (v - 0.35) / 2, J, {
        depth: 0.46,
        width: 0.22,
        depthAxis: "z",
      });
      n(U, 0.36, 0.03, 0.62, Z, y + 0.015, J);
      l(Z - 0.12, 0, J - 0.24, Z + 0.12, v, J + 0.24, "metal");
    }
    for (let J of [1, -1]) {
      let oe = x + (J * b) / 2 - J * 0.14,
        fe = v + m / 2 - 0.42;
      a(H, "z", _ - 0.5, Z, fe, oe, {
        depth: 0.4,
        width: 0.2,
        depthAxis: "y",
        r: [J * A, 0, 0],
      });
      n(H, 0.014, 0.5, 1.5, Z, v - 0.55, x + J * (b - T - 0.9), {
        r: [J * (A + 0.22), 0, 0],
      });
      n(H, 0.2, 0.02, 1.55, Z, v - 0.82, x + J * (b - T - 0.95), {
        r: [J * (A + 0.42), 0, 0],
      });
    }
    n(H, 0.22, 0.5, 0.03, Z, g - 0.55, x);
  }
  for (let L of [h + T + 0.12, f - T - 0.12])
    for (let Z of [-22.3, -16.7]) {
      let J = M(Z) - 0.55;
      a(H, "y", J, L, y + J / 2, Z, {
        depth: 0.3,
        width: 0.18,
        depthAxis: "x",
      });
      l(L - 0.16, 0, Z - 0.1, L + 0.16, J, Z + 0.1, "metal");
    }
  for (let L of $) {
    let Z = L > x ? 1 : -1;
    for (let J of [2.3, 3.7, 5.15]) {
      if (Z > 0) {
        s(
          O,
          h + 0.3,
          J - 0.08,
          d - 0.2,
          WAREHOUSE_FRONT_DOOR.x0 - 0.2,
          J + 0.08,
          d - 0.14,
        );
        s(
          O,
          WAREHOUSE_FRONT_DOOR.x1 + 0.2,
          J - 0.08,
          d - 0.2,
          f - 0.3,
          J + 0.08,
          d - 0.14,
        );
      } else {
        s(O, h + 0.3, J - 0.08, p + 0.14, f - 0.3, J + 0.08, p + 0.2);
      }
    }
    n(H, f - h - 0.6, 0.14, 0.14, (h + f) / 2, v - 0.25, L);
  }
  for (let L of [h + 0.17, f - 0.17])
    for (let Z of [2.3, 3.7, 5.15]) {
      if (L > 0) {
        s(
          O,
          L - 0.03,
          Z - 0.08,
          p + 0.3,
          L + 0.03,
          Z + 0.08,
          WAREHOUSE_SIDE_DOOR.z0 - 0.2,
        );
        s(
          O,
          L - 0.03,
          Z - 0.08,
          WAREHOUSE_SIDE_DOOR.z1 + 0.2,
          L + 0.03,
          Z + 0.08,
          d - 0.3,
        );
      } else {
        s(O, L - 0.03, Z - 0.08, p + 0.3, L + 0.03, Z + 0.08, d - 0.3);
      }
    }
  for (let [L, Z] of [
    [WAREHOUSE_BAY_X[0] + 0.4, WAREHOUSE_BAY_X[1]],
    [WAREHOUSE_BAY_X[4], WAREHOUSE_BAY_X[5] - 0.4],
  ]) {
    for (let J of $) {
      r(O, [L, 1.35, J], [Z, 5.3, J], 0.016);
      r(O, [Z, 1.35, J + 0.04], [L, 5.3, J + 0.04], 0.016);
    }
    for (let J of [1, -1]) {
      let oe = x + J * (b - 0.6),
        fe = -0.3;
      r(O, [L, v + fe + 0.1, oe], [Z, g + fe - 0.1, x + J * 0.3], 0.014);
      r(O, [Z, v + fe + 0.1, oe], [L, g + fe - 0.1, x + J * 0.3], 0.014);
    }
  }
  {
    let L = d - T;
    for (let Z of [
      WAREHOUSE_FRONT_DOOR.x0 - 0.07,
      WAREHOUSE_FRONT_DOOR.x1 + 0.07,
    ]) {
      s(
        U,
        Z - 0.07,
        y,
        L - 0.16,
        Z + 0.07,
        WAREHOUSE_FRONT_DOOR.h + 0.75,
        d + 0.07,
      );
      s(e("hazard_stripes"), Z - 0.11, y, L - 0.2, Z + 0.11, 1.3, d + 0.1, {
        bevel: 0.01,
      });
    }
    s(
      U,
      WAREHOUSE_FRONT_DOOR.x0 - 0.2,
      WAREHOUSE_FRONT_DOOR.h,
      L - 0.1,
      WAREHOUSE_FRONT_DOOR.x1 + 0.2,
      WAREHOUSE_FRONT_DOOR.h + 0.14,
      d + 0.08,
    );
    s(
      O,
      WAREHOUSE_FRONT_DOOR.x0 - 0.25,
      WAREHOUSE_FRONT_DOOR.h + 0.78,
      L - 0.72,
      WAREHOUSE_FRONT_DOOR.x1 + 0.25,
      WAREHOUSE_FRONT_DOOR.h + 0.81,
      L,
    );
    s(
      O,
      WAREHOUSE_FRONT_DOOR.x0 - 0.25,
      WAREHOUSE_FRONT_DOOR.h + 0.3,
      L - 0.72,
      WAREHOUSE_FRONT_DOOR.x1 + 0.25,
      WAREHOUSE_FRONT_DOOR.h + 0.81,
      L - 0.69,
    );
    for (let Z of [
      WAREHOUSE_FRONT_DOOR.x0 - 0.24,
      WAREHOUSE_FRONT_DOOR.x1 + 0.24,
    ])
      s(
        O,
        Z - 0.012,
        WAREHOUSE_FRONT_DOOR.h + 0.05,
        L - 0.72,
        Z + 0.012,
        WAREHOUSE_FRONT_DOOR.h + 0.81,
        L,
      );
    o(
      w,
      0.3,
      WAREHOUSE_FRONT_DOOR.x1 - WAREHOUSE_FRONT_DOOR.x0 + 0.3,
      (WAREHOUSE_FRONT_DOOR.x0 + WAREHOUSE_FRONT_DOOR.x1) / 2,
      WAREHOUSE_FRONT_DOOR.h + 0.44,
      L - 0.36,
      {
        axis: "x",
        seg: 18,
      },
    );
    o(
      U,
      0.05,
      WAREHOUSE_FRONT_DOOR.x1 - WAREHOUSE_FRONT_DOOR.x0 + 0.46,
      (WAREHOUSE_FRONT_DOOR.x0 + WAREHOUSE_FRONT_DOOR.x1) / 2,
      WAREHOUSE_FRONT_DOOR.h + 0.44,
      L - 0.36,
      {
        axis: "x",
        seg: 8,
      },
    );
    s(
      w,
      WAREHOUSE_FRONT_DOOR.x0 + 0.02,
      WAREHOUSE_FRONT_DOOR.h - 0.42,
      L - 0.09,
      WAREHOUSE_FRONT_DOOR.x1 - 0.02,
      WAREHOUSE_FRONT_DOOR.h + 0.42,
      L - 0.06,
    );
    s(
      e("hazard_stripes"),
      WAREHOUSE_FRONT_DOOR.x0 + 0.02,
      WAREHOUSE_FRONT_DOOR.h - 0.52,
      L - 0.12,
      WAREHOUSE_FRONT_DOOR.x1 - 0.02,
      WAREHOUSE_FRONT_DOOR.h - 0.42,
      L - 0.03,
    );
    s(
      U,
      WAREHOUSE_FRONT_DOOR.x1 + 0.28,
      WAREHOUSE_FRONT_DOOR.h + 0.2,
      L - 0.6,
      WAREHOUSE_FRONT_DOOR.x1 + 0.7,
      WAREHOUSE_FRONT_DOOR.h + 0.7,
      L - 0.15,
      {
        bevel: 0.02,
      },
    );
    r(
      U,
      [WAREHOUSE_FRONT_DOOR.x1 + 0.5, WAREHOUSE_FRONT_DOOR.h + 0.2, L - 0.3],
      [WAREHOUSE_FRONT_DOOR.x1 + 0.5, 1.2, L - 0.3],
      0.008,
    );
    for (let Z of [
      WAREHOUSE_FRONT_DOOR.x0 - 0.45,
      WAREHOUSE_FRONT_DOOR.x1 + 0.45,
    ])
      i.place("bollard_post", Z, d + 0.55, 0, {
        seed: 5,
      });
  }
  {
    let L = f + 0.12,
      Z = WAREHOUSE_SIDE_DOOR.z0 - 0.25,
      J = Z - 5.1;
    s(E, L, 0.12, J, L + 0.05, WAREHOUSE_SIDE_DOOR.h + 0.1, Z);
    for (let oe of [J, Z, (J + Z) / 2])
      s(
        q,
        L - 0.02,
        0.1,
        oe - 0.05,
        L + 0.09,
        WAREHOUSE_SIDE_DOOR.h + 0.12,
        oe + 0.05,
      );
    for (let oe of [
      0.14,
      WAREHOUSE_SIDE_DOOR.h + 0.08,
      WAREHOUSE_SIDE_DOOR.h * 0.5,
    ])
      s(q, L - 0.02, oe - 0.05, J, L + 0.09, oe + 0.05, Z);
    r(
      q,
      [L + 0.02, 0.2, J + 0.1],
      [L + 0.02, WAREHOUSE_SIDE_DOOR.h, (J + Z) / 2],
      0.02,
    );
    r(
      q,
      [L + 0.02, 0.2, Z - 0.1],
      [L + 0.02, WAREHOUSE_SIDE_DOOR.h, (J + Z) / 2],
      0.02,
    );
    s(
      U,
      L - 0.04,
      WAREHOUSE_SIDE_DOOR.h + 0.16,
      J - 0.2,
      L + 0.12,
      WAREHOUSE_SIDE_DOOR.h + 0.3,
      WAREHOUSE_SIDE_DOOR.z1 + 0.3,
    );
    s(
      U,
      f - T - 0.02,
      y,
      WAREHOUSE_SIDE_DOOR.z0 - 0.12,
      f + 0.08,
      WAREHOUSE_SIDE_DOOR.h + 0.1,
      WAREHOUSE_SIDE_DOOR.z0,
    );
    s(
      U,
      f - T - 0.02,
      y,
      WAREHOUSE_SIDE_DOOR.z1,
      f + 0.08,
      WAREHOUSE_SIDE_DOOR.h + 0.1,
      WAREHOUSE_SIDE_DOOR.z1 + 0.12,
    );
    s(
      U,
      f - T - 0.02,
      WAREHOUSE_SIDE_DOOR.h,
      WAREHOUSE_SIDE_DOOR.z0 - 0.12,
      f + 0.08,
      WAREHOUSE_SIDE_DOOR.h + 0.12,
      WAREHOUSE_SIDE_DOOR.z1 + 0.12,
    );
    for (let oe of [
      WAREHOUSE_SIDE_DOOR.z0 - 0.06,
      WAREHOUSE_SIDE_DOOR.z1 + 0.06,
    ])
      s(
        e("hazard_stripes"),
        f - T - 0.05,
        y,
        oe - 0.1,
        f + 0.1,
        1.3,
        oe + 0.1,
        {
          bevel: 0.01,
        },
      );
    l(L - 0.05, 0, J, L + 0.12, WAREHOUSE_SIDE_DOOR.h + 0.3, Z, "metal");
    i.place("bollard_post", f + 0.6, WAREHOUSE_SIDE_DOOR.z0 - 0.4, 0, {
      seed: 6,
    });
  }
  let ue = new Group();
  ue.position.set(f - 0.05, ie.y, x);
  ue.userData.noMerge = true;
  {
    let L = new TorusGeometry(ie.r + 0.02, 0.05, 8, 28);
    L.rotateY(Math.PI / 2);
    c(L, q, {
      p: [f + 0.04, ie.y, x],
    });
    let Z = new TorusGeometry(ie.r + 0.02, 0.035, 6, 28);
    Z.rotateY(Math.PI / 2);
    c(Z, O, {
      p: [f - 0.16, ie.y, x],
    });
    for (let fe of [0.4, 0.4 + Math.PI / 2])
      r(
        q,
        [f + 0.1, ie.y - Math.sin(fe) * ie.r, x - Math.cos(fe) * ie.r],
        [f + 0.1, ie.y + Math.sin(fe) * ie.r, x + Math.cos(fe) * ie.r],
        0.012,
      );
    for (let fe of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3])
      r(
        O,
        [f - 0.18, ie.y + Math.sin(fe) * ie.r, x + Math.cos(fe) * ie.r],
        [f - 0.18, ie.y, x],
        0.014,
      );
    o(U, 0.13, 0.26, f - 0.22, ie.y, x, {
      axis: "x",
      seg: 12,
    });
    let J = t("steel_worn");
    for (let fe = 0; fe < 5; fe++) {
      let le = boxGeo(0.012, 0.42, 0.2);
      le.rotateY(0.5);
      le.translate(0, 0.3, 0);
      le.rotateX((fe / 5) * Math.PI * 2);
      let R = new Mesh(le, J);
      R.castShadow = true;
      R.receiveShadow = true;
      ue.add(R);
    }
    let oe = new Mesh(cylinderGeo(0.1, 0.1, 0.1, 12).rotateZ(Math.PI / 2), U);
    oe.castShadow = true;
    ue.add(oe);
    i.dynRoot.add(ue);
  }
  let me = u.mats.emissive(16757864, 7),
    ee = t("aluminium"),
    B: number[][] = [];
  for (let L of [-15.4, -23.6])
    for (let Z of [-13.6, -8.5, -3.5, 2.6, 8.6]) {
      if (!(L < -20 && Z < -10)) {
        B.push([Z, L]);
      }
    }
  for (let [L, Z] of B) {
    let J = M(Z) - 0.3,
      oe = 6.05;
    r(U, [L, J, Z], [L, oe + 0.3, Z], 0.012, {
      cast: false,
    });
    o(ee, 0.33, 0.3, L, oe + 0.15, Z, {
      rTop: 0.09,
      seg: 14,
    });
    o(U, 0.09, 0.14, L, oe + 0.37, Z, {
      seg: 10,
    });
    o(me, 0.24, 0.02, L, oe + 0.02, Z, {
      seg: 14,
      cast: false,
      recv: false,
    });
  }
  let P: PointLight[] = [];
  for (let [L, Z] of [
    [-8.5, -15.4],
    [2.6, -15.4],
    [-3.5, -23.6],
    [8.6, -23.6],
  ]) {
    let J = new PointLight(16761994, 34, 13, 2);
    J.position.set(L, 5.75, Z);
    J.castShadow = false;
    i.dynRoot.add(J);
    P.push(J);
  }
  {
    let Z = h + T + 0.02,
      J = -10.25,
      oe = p + T + 0.02,
      fe = -23.75;
    s(t("diamond_plate"), Z, 2.6 - 0.1, oe, J, 2.6, fe);
    for (let Te of [Z + 0.1, -13, J - 0.08])
      s(H, Te - 0.07, 2.6 - 0.3, oe, Te + 0.07, 2.6 - 0.1, fe);
    for (let [Te, Pe] of [
      [J - 0.08, fe - 0.08],
      [J - 0.08, oe + 0.3],
      [-13, fe - 0.08],
    ]) {
      n(H, 0.14, 2.6 - 0.1, 0.14, Te, (2.6 - 0.1) / 2, Pe, {
        bevel: 0.01,
      });
      l(Te - 0.08, 0, Pe - 0.08, Te + 0.08, 2.6, Pe + 0.08, "metal", {
        noNav: true,
      });
    }
    let le = t("paint_white"),
      R = e("glass_dirty"),
      I = Z + 0.05,
      se = J - 0.05,
      ae = oe + 0.05,
      k = fe - 0.05,
      ce = 5,
      ve = (Te: number, Pe: number, Re: any, Fe = 0.07) => {
        s(Re, I, Te, k - Fe, se, Pe, k);
        s(Re, se - Fe, Te, ae, se, Pe, k - Fe);
      };
    ve(2.6, 3.5, le);
    ve(4.45, ce, le);
    ve(3.5, 4.45, R, 0.02);
    for (let Te of [I + 0.04, -14.2, -12.9, -11.75, se - 0.04])
      s(le, Te - 0.04, 3.5, k - 0.07, Te + 0.04, 4.45, k);
    for (let Te of [ae + 0.04, -26.3, -25, k - 0.04])
      s(le, se - 0.07, 3.5, Te - 0.04, se, 4.45, Te + 0.04);
    s(t("paint_grey"), -11.65, 2.6, k - 0.01, -10.75, 4.6, k + 0.03);
    s(le, I, ce, ae, se + 0.1, ce + 0.08, k + 0.1);
    s(t("wood_dark"), I + 0.2, 3.3, ae + 0.3, se - 0.3, 3.36, ae + 1);
    s(U, -13.4, 3.36, ae + 0.5, -12.7, 3.8, ae + 0.56);
    n(u.mats.emissive(13624063, 2.4), 1.2, 0.04, 0.14, -13, ce - 0.05, -25.8, {
      cast: false,
      recv: false,
    });
    n(u.mats.emissive(10473727, 1.6), 0.6, 0.36, 0.01, -13.05, 3.6, ae + 0.59, {
      cast: false,
      recv: false,
    });
    l(I, 2.6 - 0.12, ae, se, ce + 0.08, k, "metal", {
      noNav: true,
    });
    l(Z, 2.6 - 0.12, oe, J, 2.6, fe, "metal", {
      noNav: true,
    });
    let _e = fe + 0.6;
    i.catwalk(
      -14.25,
      _e,
      0,
      2.6 - 0.05,
      {
        seed: 2,
      },
      [false, true],
    );
    i.catwalk(
      -11.25,
      _e,
      0,
      2.6 - 0.05,
      {
        seed: 3,
      },
      [false, true],
    );
    for (let Te of [-15.6, -12.75, -9.85])
      n(H, 0.1, 2.6 - 0.12, 0.1, Te, (2.6 - 0.12) / 2, _e + 0.5, {
        bevel: 0.01,
      });
    s(H, -15.75, 2.6 - 0.26, _e + 0.44, -9.75, 2.6 - 0.12, _e + 0.56);
    i.stairs(-8.25, _e, Math.PI, 0, {
      seed: 4,
    });
    i.metalRects.push([Z, oe, -6.7, _e + 0.6]);
  }
  {
    let J = d - T - 0.05,
      oe = J - 0.75;
    s(t("wood_dark"), 1.6, 0.88, oe, 5, 0.94, J, {
      bevel: 0.012,
    });
    for (let fe of [1.6 + 0.06, 5 - 0.06, (1.6 + 5) / 2])
      for (let le of [oe + 0.06, J - 0.06])
        n(U, 0.05, 0.86, 0.05, fe, y + 0.43, le);
    s(U, 1.6 + 0.04, 0.2, oe + 0.06, 5 - 0.04, 0.23, J - 0.04);
    s(t("paint_grey"), 1.6 + 0.1, 0.55, oe + 0.04, 1.6 + 1.3, 0.86, J - 0.05, {
      bevel: 0.01,
    });
    s(t("wood_pallet"), 1.6, 1.25, J - 0.02, 5, 2.3, J + 0.01);
    for (let fe = 0; fe < 7; fe++)
      r(
        O,
        [1.6 + 0.3 + fe * 0.42, 1.5 + (fe % 3) * 0.12, J - 0.04],
        [1.6 + 0.3 + fe * 0.42, 2.05 + (fe % 2) * 0.1, J - 0.04],
        0.012 + (fe % 2) * 0.006,
        {
          cast: false,
        },
      );
    n(U, 0.16, 0.14, 0.3, 5 - 0.5, 1.01, oe + 0.2, {
      bevel: 0.015,
    });
    n(O, 0.03, 0.03, 0.34, 5 - 0.5, 1.1, oe + 0.12);
    n(t("paint_red"), 0.45, 0.22, 0.24, 1.6 + 1.9, 1.05, oe + 0.35, {
      bevel: 0.02,
      r: [0, 0.3, 0],
    });
    s(U, 1.6, 2.5, J - 0.3, 5, 2.53, J);
    n(
      u.mats.emissive(16773328, 3),
      5 - 1.6 - 0.4,
      0.03,
      0.1,
      (1.6 + 5) / 2,
      2.48,
      J - 0.18,
      {
        cast: false,
        recv: false,
      },
    );
    l(1.6, 0, oe, 5, 0.94, J, "wood");
  }
  {
    for (let fe of [-1, 1]) {
      let le = -11.6 + (fe * 2.6) / 2;
      r(t("paint_yellow"), [le, y, -17.6 - 0.9], [le, 3.3, -17.6], 0.045);
      r(t("paint_yellow"), [le, y, -17.6 + 0.9], [le, 3.3, -17.6], 0.045);
      r(t("paint_yellow"), [le, 1, -17.6 - 0.62], [le, 1, -17.6 + 0.62], 0.03);
      for (let R of [-17.6 - 0.9, -17.6 + 0.9])
        o(U, 0.07, 0.1, le, y + 0.05, R, {
          axis: "x",
          seg: 8,
        });
    }
    a(t("paint_yellow"), "x", 2.6 + 0.5, -11.6, 3.3 + 0.1, -17.6, {
      depth: 0.22,
      width: 0.14,
    });
    n(U, 0.3, 0.26, 0.24, -11.6 + 0.2, 3.3 - 0.14, -17.6, {
      bevel: 0.02,
    });
    r(O, [-11.6 + 0.2, 3.3 - 0.26, -17.6], [-11.6 + 0.2, 1.75, -17.6], 0.012);
    r(
      O,
      [-11.6 + 0.32, 3.3 - 0.26, -17.6],
      [-11.6 + 0.34, 2.2, -17.6 + 0.02],
      0.008,
    );
    n(U, 0.85, 0.5, 0.55, -11.6 + 0.2, 1.42, -17.6, {
      bevel: 0.03,
      r: [0, 0.2, 0.05],
    });
    n(t("steel_worn"), 0.7, 0.16, 0.42, -11.6 + 0.2, 1.74, -17.6, {
      bevel: 0.02,
      r: [0, 0.2, 0.05],
    });
    o(t("steel_bare"), 0.16, 0.12, -11.6 - 0.28, 1.4, -17.6 - 0.08, {
      axis: "x",
      seg: 12,
    });
    l(
      -11.6 - 2.6 / 2 - 0.1,
      0,
      -17.6 - 0.35,
      -11.6 + 2.6 / 2 + 0.1,
      1.9,
      -17.6 + 0.35,
      "metal",
    );
  }
  let V = Math.PI / 2,
    Y = (
      L: string,
      Z: number,
      J: number,
      oe: number,
      fe: { seed: number } | { seed: number; color: string },
      le = y,
      R?: { noCol: boolean },
    ) => i.place(L, Z, J, oe, fe, le, R);
  for (let L of [-8.4, -5.6, -2.8, 2.8, 5.6, 8.4])
    Y("shelf_rack", L, p + T + 0.62, 0, {
      seed: Math.round(L * 7 + 90),
    });
  for (let L of [2.8, 5.6, 8.4])
    Y("shelf_rack", L, -23.45, 0, {
      seed: Math.round(L * 5 + 40),
    });
  Y("pallet_stack", 0, -26.9, 0.1, {
    seed: 3,
  });
  Y(
    "cardboard_boxes",
    -0.05,
    -26.9,
    0.5,
    {
      seed: 4,
    },
    y + 1.15,
    {
      noCol: true,
    },
  );
  Y("crate_stack", 2.9, -15.9, 0.12, {
    seed: 11,
  });
  Y("crate_wood", 4.15, -16.3, -0.25, {
    seed: 12,
  });
  Y("pallet_stack", 2, -17.3, 1.45, {
    seed: 13,
  });
  Y("ibc_tote", 6.9, -19.6, 0.1, {
    seed: 14,
  });
  Y("barrel", 7.9, -18.5, 0, {
    seed: 15,
    color: "blue",
  });
  Y("barrel", 6, -18.4, 0.6, {
    seed: 16,
    color: "red",
  });
  Y("ibc_tote", -7.6, -16.4, -0.08, {
    seed: 17,
  });
  Y("barrel", -8.6, -15.3, 0, {
    seed: 18,
  });
  Y("barrel", -7.9, -15, 0.9, {
    seed: 19,
    color: "yellow",
  });
  Y("sandbags", 10.2, -16.4, V + 0.05, {
    seed: 20,
  });
  Y("forklift", 8.3, -13.9, 2.75, {
    seed: 21,
  });
  Y("toolbox_cart", 6, -12.2, 0.15, {
    seed: 22,
  });
  Y("gas_cylinders", 10.9, -11.9, 0, {
    seed: 23,
  });
  Y("tarp_cargo", -13.2, -13.2, 0.12, {
    seed: 24,
  });
  Y("tire_stack", -15, -15.6, 0, {
    seed: 25,
  });
  Y("tire_stack", -14.9, -16.6, 0.4, {
    seed: 26,
  });
  Y("cardboard_boxes", -14.6, -26.6, 0.2, {
    seed: 27,
  });
  Y("crate_wood", -12.4, -26.9, -0.1, {
    seed: 28,
  });
  Y("barrel", -10.9, -27, 0, {
    seed: 29,
    color: "green",
  });
  Y("crate_wood", -14.7, -24.6, 0.3, {
    seed: 30,
  });
  Y("jerry_can", -9.3, -12, 0.4, {
    seed: 31,
  });
  Y("jerry_can", -9.7, -12.1, 1.2, {
    seed: 32,
  });
  Y("pallet", 10.6, -13.6, 0.2, {
    seed: 33,
  });
  Y(
    "cardboard_boxes",
    10.6,
    -13.6,
    0.3,
    {
      seed: 34,
    },
    0.17,
  );
  Y("traffic_cone", -6.6, -12.2, 0, {
    seed: 35,
  });
  Y("traffic_cone", -0.4, -12.3, 0, {
    seed: 36,
  });
  i.tube(
    t("rubber"),
    [
      [1.7, 0.9, -11.9],
      [1.4, 0.4, -12.3],
      [1.2, 0.06, -13.2],
      [2.4, 0.055, -14],
      [1, 0.055, -14.9],
      [-0.8, 0.055, -14.4],
      [-1.6, 0.055, -15.6],
    ],
    0.018,
    {
      cast: false,
    },
  );
  s(U, 7.2, y, -14.6, 8.4, y + 0.04, -13.6);
  i.decal("oil_stain", 2.2, 7.6, y + 0.004, -15.2, "y+", 0.6);
  i.decal("oil_stain", 1.6, -3.8, y + 0.004, -13.6, "y+", 2.1);
  i.decal("hazard_voltage", 0.5, -1.25, 1.9, d - T - 0.142, "z-");
  i.decal("caution_stripes", 2.4, -3.5, y + 0.004, -11.9, "y+", 0);
  return {
    fan: ue,
    lights: P,
    skylights: X,
    relayPos: new Vector3(-2, y, -19.5),
    update(L: number) {
      ue.rotation.x += L * 1.7;
    },
  };
}
function anchorGroup(
  i: { staticRoot: { add: (arg0: Group<Object3DEventMap>) => void } },
  e: number,
  t: number,
  n: number,
  s = 0,
) {
  let o = new Group();
  o.position.set(e, s, t);
  o.rotation.y = n;
  i.staticRoot.add(o);
  return o;
}
function addBox(
  i: any,
  e: Group<Object3DEventMap>,
  t: string,
  n: number,
  s: number,
  o: number,
  r: number,
  a: number,
  l: number,
  c = 0,
  u: number[] | null = null,
) {
  let h = makeMesh(
    c ? roundedBoxGeo(n, s, o, c) : boxGeo(n, s, o),
    typeof t == "string" ? i.M(t) : t,
  );
  h.position.set(r, a, l);
  if (u) {
    h.rotation.set(u[0], u[1], u[2]);
  }
  e.add(h);
  return h;
}
function addCylinder(
  i: any,
  e: Group<Object3DEventMap>,
  t: any,
  n: number,
  s: number,
  o: number,
  r: number,
  a: number,
  l: number[] | null = null,
  c = 8,
) {
  let u = makeMesh(cylinderGeo(n, n, s, c), typeof t == "string" ? i.M(t) : t);
  u.position.set(o, r, a);
  if (l) {
    u.rotation.set(l[0], l[1], l[2]);
  }
  e.add(u);
  return u;
}
function addBeam(
  i: {
    col: (
      arg0: number,
      arg1: number,
      arg2: number,
      arg3: number,
      arg4: number,
      arg5: number,
      arg6: string,
    ) => void;
  },
  e: number,
  t: number,
  n: number,
  s: number,
  o: number,
  r: number,
  a = "metal",
  l = 0,
) {
  let c = Math.abs(Math.cos(n)),
    u = Math.abs(Math.sin(n)),
    h = Math.abs(Math.sin(2 * n)) > 0.2 ? 0.9 : 1,
    f = ((s * c + o * u) / 2) * h,
    p = ((s * u + o * c) / 2) * h;
  i.col(e - f, l, t - p, e + f, l + r, t + p, a);
}
export function buildWorkbench(
  i: any,
  e: number,
  t: number,
  n = 0,
  s = "paint_blue",
  o = 1,
) {
  let r = anchorGroup(i, e, t, n),
    a = 2.2,
    l = 1.2,
    c = 1.25,
    u = i.M(s),
    h = i.M("steel_dark");
  addBox(i, r, h, a, 0.05, l, 0, 0.13, 0);
  for (let d of [-1, 1])
    addBox(i, r, u, 0.1, 0.1, l, d * (a / 2 - 0.25), 0.05, 0);
  for (let d of [-1, 1])
    for (let v of [-1, 1])
      addBox(
        i,
        r,
        u,
        0.07,
        c - 0.1,
        0.07,
        d * (a / 2 - 0.035),
        0.1 + (c - 0.1) / 2,
        v * (l / 2 - 0.035),
        0.008,
      );
  for (let d of [-1, 1]) {
    addBox(i, r, u, a, 0.06, 0.06, 0, c - 0.03, d * (l / 2 - 0.03), 0.008);
    addBox(i, r, u, a, 0.05, 0.05, 0, 0.62, d * (l / 2 - 0.03));
    addBox(
      i,
      r,
      i.M("chainlink"),
      a - 0.14,
      c - 0.25,
      0.012,
      0,
      0.15 + (c - 0.25) / 2,
      d * (l / 2 - 0.035),
    );
  }
  for (let d of [-1, 1]) {
    addBox(i, r, u, 0.06, 0.06, l, d * (a / 2 - 0.03), c - 0.03, 0, 0.008);
    addBox(
      i,
      r,
      i.M("chainlink"),
      0.012,
      c - 0.25,
      l - 0.14,
      d * (a / 2 - 0.035),
      0.15 + (c - 0.25) / 2,
      0,
    );
  }
  let f = i.M("steel_worn"),
    p = i.M("steel_rust");
  for (let d = 0; d < 14; d++) {
    let v = (d * 0.618 + o * 0.37) % 1,
      g = (d * 0.414 + o * 0.11) % 1,
      x = 1.5 + g * 0.9;
    addCylinder(
      i,
      r,
      d % 3 ? f : p,
      0.014,
      x,
      -a / 2 + 0.25 + v * (a - 0.9),
      0.16 + (x / 2) * 0.96,
      -l / 2 + 0.2 + g * (l - 0.4),
      [0.1 * (g - 0.5), 0, 0.28 * (v - 0.3)],
      5,
    );
  }
  for (let d = 0; d < 6; d++) {
    let v = (d * 0.37 + o * 0.2) % 1;
    addCylinder(
      i,
      r,
      p,
      0.035,
      0.42,
      a / 2 - 0.45 + (v - 0.5) * 0.3,
      0.22 + d * 0.05,
      (v - 0.5) * 0.7,
      [Math.PI / 2 + v, v * 3, 0.2],
      6,
    );
  }
  addBeam(i, e, t, n, a, l, c, "metal");
  return r;
}
export function buildHandCart(
  i: any,
  e: number,
  t: number,
  n = 0,
  s = "paint_red",
) {
  let o = anchorGroup(i, e, t, n),
    r = 1.1,
    a = 0.8,
    l = 0.75,
    c = i.M(s);
  for (let h of [-1, 1]) addBox(i, o, c, 0.09, 0.1, a, h * 0.36, 0.05, 0);
  addBox(i, o, c, r, 0.04, a, 0, 0.12, 0);
  for (let h of [-1, 1])
    addBox(
      i,
      o,
      c,
      r,
      l - 0.1,
      0.03,
      0,
      0.1 + (l - 0.1) / 2,
      h * (a / 2 - 0.015),
      0.006,
    );
  for (let h of [-1, 1])
    addBox(
      i,
      o,
      c,
      0.03,
      l - 0.1,
      a,
      h * (r / 2 - 0.015),
      0.1 + (l - 0.1) / 2,
      0,
      0.006,
    );
  for (let h of [-1, 1])
    for (let f of [-1, 1])
      addBox(
        i,
        o,
        c,
        0.06,
        l,
        0.06,
        h * (r / 2 - 0.02),
        l / 2,
        f * (a / 2 - 0.02),
        0.01,
      );
  addBox(i, o, i.M("steel_dark"), r - 0.08, 0.04, a - 0.08, 0, l - 0.22, 0);
  let u = i.M("steel_worn");
  for (let h = 0; h < 12; h++) {
    let f = (h * 0.618) % 1,
      p = (h * 0.37) % 1;
    addBox(
      i,
      o,
      u,
      0.16,
      0.11,
      0.1,
      (f - 0.5) * (r - 0.3),
      l - 0.16 + (h % 3) * 0.03,
      (p - 0.5) * (a - 0.25),
      0.012,
      [p, f * 3, f],
    );
  }
  addBeam(i, e, t, n, r, a, l, "metal");
  return o;
}
export function buildPipeBundle(i: any, e: number, t: number, n = 0, s = 9) {
  let o = anchorGroup(i, e, t, n),
    r = i.M("steel_worn"),
    a = i.M("steel_rust");
  for (let l of [-1.1, 1.1])
    addBox(i, o, "wood_dark", 0.1, 0.08, 0.7, l, 0.04, 0, 0.008);
  for (let l = 0; l < s; l++) {
    let c = l < 5 ? 0 : 1,
      u = c ? l - 5 : l;
    addCylinder(
      i,
      o,
      l % 2 ? r : a,
      0.016,
      3.4 + (l % 3) * 0.12,
      ((l % 3) - 1) * 0.06,
      0.1 + c * 0.03,
      (u - (c ? 1.5 : 2)) * 0.045 + c * 0.02,
      [0, 0.01 * (l - 4), Math.PI / 2],
      5,
    );
  }
  for (let l = 0; l < s; l += 3)
    addBox(i, o, a, 0.07, 0.05, 0.03, 1.72, 0.11, (l - 4) * 0.02);
  return o;
}
export function buildWheelChock(i: any, e: number, t: number, n = 0) {
  let s = anchorGroup(i, e, t, n),
    o = new Shape();
  o.moveTo(-0.16, 0);
  o.lineTo(0.16, 0);
  o.lineTo(0.16, 0.05);
  o.lineTo(-0.1, 0.19);
  o.lineTo(-0.16, 0.19);
  o.closePath();
  let r = new ExtrudeGeometry(o, {
    depth: 0.2,
    bevelEnabled: false,
  });
  r.translate(0, 0, -0.1);
  s.add(makeMesh(r, i.M("rubber")));
  addBox(i, s, "paint_yellow", 0.012, 0.16, 0.18, -0.166, 0.1, 0);
  return s;
}
export function buildPoleSign(
  i: any,
  e: number,
  t: number,
  n: string,
  s = "x-",
  o = 3.2,
) {
  let r = s[0] === "x";
  i.cyl("steel_galv", 0.045, o, e, o / 2, t, {
    seg: 8,
  });
  i.box("steel_dark", 0.3, 0.02, 0.3, e, 0.01, t);
  let a = 1.1,
    l = 0.62,
    c = 0.03;
  i.box("paint_yellow", r ? c : a, l, r ? a : c, e, o - l / 2 - 0.05, t, {
    bevel: 0.01,
  });
  let u = s[1] === "+" ? 1 : -1,
    h = r ? e + u * (c / 2 + 0.003) : e,
    f = r ? t : t + u * (c / 2 + 0.003);
  i.label(n, 0.4, h, o - l / 2 - 0.05, f, s, {
    color: "black",
    font: "stencil",
    distress: 0.35,
  });
  i.col(e - 0.06, 0, t - 0.06, e + 0.06, o, t + 0.06, "metal", {
    noNav: true,
  });
}
export function buildRackedDrums(
  i: any,
  e: number,
  t: number,
  n = 2,
  s = true,
  o = 0.02,
) {
  let u = ["paint_grey", "paint_teal", "paint_grey", "steel_rust"];
  for (let d = 0; d < n; d++) {
    let v = anchorGroup(
        i,
        e + (d ? 0.12 * Math.sin(d * 2.1) : 0),
        t + (d ? 0.18 * Math.cos(d * 1.7) : 0),
        (s ? Math.PI / 2 : 0) + o * (d % 2 ? -1 : 1.3),
        0,
      ),
      g = 0.1 + d * (0.5 + 0.1);
    for (let y of [-3.6, 0, 3.6])
      addBox(i, v, "wood_dark", 0.14, 0.1, 4.2 - 0.2, y, g - 0.1 / 2, 0, 0.01);
    let x = i.M(u[d % u.length]);
    addBox(i, v, x, 10.4, 0.5 - 0.08, 4.2, 0, g + (0.5 - 0.08) / 2, 0, 0.03);
    addBox(i, v, x, 10.4 - 0.5, 0.08, 4.2 - 0.5, 0, g + 0.5 - 0.04, 0, 0.02);
    for (let y of [-1.4, -0.7, 0, 0.7, 1.4])
      addBox(i, v, x, 10.4 - 0.9, 0.05, 0.09, 0, g + 0.5 + 0.02, y, 0.01);
    for (let y of [-1, 1])
      for (let b of [-1, 1]) {
        addBox(
          i,
          v,
          "steel_dark",
          0.32,
          0.12,
          0.32,
          y * (10.4 / 2 - 0.35),
          g + 0.5 - 0.02,
          b * (4.2 / 2 - 0.35),
          0.02,
        );
        addBox(
          i,
          v,
          "paint_yellow",
          0.5,
          0.5 - 0.1,
          0.02,
          y * (10.4 / 2 - 0.5),
          g + (0.5 - 0.08) / 2,
          b * (4.2 / 2 + 0.006),
        );
      }
    for (let y of [-1, 1])
      addBox(
        i,
        v,
        "rubber",
        0.04,
        0.12,
        4.2 - 0.4,
        y * (10.4 / 2 + 0.01),
        g + 0.1,
        0,
      );
  }
  let h = 0.1 + n * (0.5 + 0.1),
    f = (s ? 4.2 : 10.4) / 2 + 0.05,
    p = (s ? 10.4 : 4.2) / 2 + 0.05;
  i.col(e - f, 0, t - p, e + f, h, t + p, "metal");
  i.metalRects.push([e - f, t - p, e + f, t + p]);
  return h;
}
export function buildCableRun(
  i: any,
  e: number[][],
  t = 0.025,
  n = "rubber",
  s: number | null = null,
) {
  let o: number[][] = [];
  for (let r = 0; r < e.length; r++) {
    let a = e[r];
    o.push([a[0], a.length > 2 ? a[2] : (s ?? t * 0.9), a[1]]);
    if (r < e.length - 1) {
      let l = e[r + 1],
        c = l[0] - a[0],
        u = l[1] - a[1],
        h = Math.hypot(c, u);
      if (h > 2.2 && a.length < 3 && l.length < 3) {
        let f = Math.floor(h / 1.6);
        for (let p = 1; p < f; p++) {
          let d = p / f,
            v = Math.sin((r * 3.1 + p) * 2.3) * Math.min(0.28, h * 0.04);
          o.push([
            a[0] + c * d - (u / h) * v,
            s ?? t * 0.9,
            a[1] + u * d + (c / h) * v,
          ]);
        }
      }
    }
  }
  return i.tube(n, o, t, {
    radial: 6,
    cast: false,
  });
}
export function buildHydrantBox(i: any, e: number, t: number, n = 0) {
  let s = anchorGroup(i, e, t, n);
  addBox(i, s, "concrete", 0.7, 0.12, 0.5, 0, 0.06, 0, 0.015);
  addBox(i, s, "paint_grey", 0.55, 0.9, 0.3, 0, 0.57, 0, 0.015);
  addBox(i, s, "steel_dark", 0.5, 0.03, 0.34, 0, 1.03, 0);
  addBox(i, s, "hazard_stripes", 0.3, 0.12, 0.01, 0, 0.8, 0.156);
  addBeam(i, e, t, n, 0.7, 0.5, 1.05, "metal");
  return s;
}
