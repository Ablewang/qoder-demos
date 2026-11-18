import {
  BufferAttribute,
  Color,
  Group,
  MathUtils,
  Mesh,
  PlaneGeometry,
} from "three";
import { boxGeo, cylinderGeo, mergeGeos } from "../utils/geometry";
import { PROP_SIZES, registerProp } from "./registry";
import {
  PropBuilder,
  corrugationProfile,
  decalMaterial,
  groupFromParts,
  labelMaterial,
  latheGeo,
  lerp3,
  loftGeo,
  placeGeo,
  placeMatrix,
  planeGeo,
  planeGeoUv,
  propRng,
  roundedRectPath,
  smoothstep01,
  sphereGeo,
  tagProp,
  valueNoise2,
} from "./kit";

const CONTAINER_WIDTH = 2.438;
const CONTAINER_SPECS: Record<
  string,
  {
    type: string;
    gross: string;
    tare: string;
    net: string;
    cu: string;
    def: string;
  }
> = {
  container20: {
    type: "22G1",
    gross: "30,480",
    tare: "2,230",
    net: "28,250",
    cu: "33.2",
    def: "red",
  },
  container40: {
    type: "42G1",
    gross: "32,500",
    tare: "3,750",
    net: "28,750",
    cu: "67.7",
    def: "blue",
  },
  container40hc: {
    type: "45G1",
    gross: "32,500",
    tare: "3,940",
    net: "28,560",
    cu: "76.3",
    def: "green",
  },
};
const CONTAINER_IDS = [
  "SLTU 482915 7",
  "HBMU 307144 2",
  "NRDU 665201 9",
  "OKTU 119873 4",
  "VSLU 850362 1",
  "TQLU 274590 6",
];
const CONTAINER_LOGOS = ["logo_a", "logo_b", "logo_c", "logo_d"];
const CONTAINER_COLORS = [
  "red",
  "blue",
  "green",
  "yellow",
  "orange",
  "white",
  "grey",
  "teal",
];
const containerPaintSlot = {
  body: true,
};
const CONTAINER_SHELL_VARIANTS = 6;
const containerShellCache = new Map();
const CORNER_CASTING_LEN = 0.178;
const CORNER_CASTING_HEIGHT = 0.118;
const CORNER_CASTING_DEPTH = 0.162;
const SIDE_WALL_CORRUGATION = {
  P: 0.278,
  d: 0.036,
  fo: 0.072,
  sl: 0.068,
};
const ROOF_CORRUGATION = {
  P: 0.209,
  d: 0.02,
  fo: 0.09,
  sl: 0.03,
};
const END_WALL_CORRUGATION = {
  P: 0.25,
  d: 0.042,
  fo: 0.07,
  sl: 0.06,
};
function buildContainerShell(
  i: any,
  e: string,
  t: number,
  n: number,
  s: number,
) {
  let o = PROP_SIZES[e][0],
    r = PROP_SIZES[e][1],
    a = CONTAINER_SPECS[e],
    l = propRng(1e3 + t * 77 + e.length * 13),
    c = new PropBuilder(i),
    u = c.M("steel_galv"),
    h = c.M("wood_pallet"),
    f = CONTAINER_WIDTH / 2,
    p = o / 2,
    d = f - 0.012,
    v = -p + 0.085,
    g = p - 0.135,
    x = 0.167,
    y = r - 0.06,
    b: { side: number; x: number; y: number; r: number; depth: number }[] = [],
    m = Math.round((1 + l() * 2.4) * (0.4 + s)),
    A = [
      [-p * 0.75, -p * 0.05],
      [p - 2.2, p],
    ];
  for (let $ = 0; $ < m; $++) {
    let ue = l() < 0.5 ? 1 : -1,
      me = 0,
      ee = 0;
    do {
      me = (l() * 2 - 1) * (p - 0.9);
      ee++;
    } while (
      ee < 8 &&
      A.some((B) => me > B[0] - 0.4 && me < B[1] + 0.4 && l() < 0.9)
    );
    b.push({
      side: ue,
      x: ue * me,
      y: 0.45 + l() * 1.3,
      r: 0.22 + l() * 0.3,
      depth: 0.025 + l() * 0.04,
    });
  }
  let _: { side: number; x: number; w: number; k: number }[] = [],
    M = Math.round((o / 2.2) * (0.5 + s) * (0.6 + l()));
  for (let $ = 0; $ < M * 2; $++)
    _.push({
      side: $ % 2 ? 1 : -1,
      x: (l() * 2 - 1) * (p - 0.3),
      w: 0.05 + l() * 0.12,
      k: 0.4 + l() * 0.6,
    });
  let E = [0.5, 0.44, 0.38],
    w = [0.62, 0.38, 0.24],
    S = t * 9.7,
    z = ($: number, ue: number, me: number) => {
      let ee =
        1 +
        (valueNoise2($ * 0.9 + S, ue * 1.7 + me * 0.4) - 0.5) *
          0.16 *
          (0.5 + s);
      ee *= 0.94 + 0.06 * valueNoise2($ * 6.1 + me * 3.3, ue * 5 + S);
      let B = [ee, ee, ee],
        P =
          smoothstep01(0.62, 0.02, ue) *
          (0.45 + 0.5 * s) *
          (0.75 + 0.5 * valueNoise2($ * 2.3 + me, S));
      B = lerp3(B, [E[0] * ee, E[1] * ee, E[2] * ee], Math.min(1, P));
      return B;
    };
  c.defCol.set(containerPaintSlot, z);
  let H = ($: number, ue: number, me: number) => {
      let ee = 0;
      for (let B of b)
        if (B.side === me) {
          let P = Math.hypot($ - B.x, (ue - B.y) * 0.9) / B.r;
          if (P < 1) {
            let V = 1 - P * P;
            ee += B.depth * V * V;
          }
        }
      return ee;
    },
    O = [0.035, 0.035, 0.04];
  for (let $ of [-1, 1])
    for (let ue of [0, 1])
      for (let me of [-1, 1]) {
        let ee = $ * (p - CORNER_CASTING_LEN / 2),
          B = ue ? r - CORNER_CASTING_HEIGHT / 2 : CORNER_CASTING_HEIGHT / 2,
          P = me * (f - CORNER_CASTING_DEPTH / 2);
        c.box(
          containerPaintSlot,
          CORNER_CASTING_LEN,
          CORNER_CASTING_HEIGHT,
          CORNER_CASTING_DEPTH,
          ee,
          B,
          P,
          {
            r: 0.012,
          },
        );
        c.add(
          containerPaintSlot,
          placeGeo(roundedRectPath(0.078, 0.052, 3), ee, B, me * (f + 0.0012), [
            0,
            me > 0 ? 0 : Math.PI,
            0,
          ]),
          O,
        );
        c.add(
          containerPaintSlot,
          placeGeo(roundedRectPath(0.064, 0.05, 3), $ * (p + 0.0012), B, P, [
            0,
            ($ * Math.PI) / 2,
            0,
          ]),
          O,
        );
        if (ue) {
          c.add(
            containerPaintSlot,
            placeGeo(roundedRectPath(0.124, 0.064, 3), ee, r + 0.0012, P, [
              -Math.PI / 2,
              0,
              0,
            ]),
            O,
          );
        }
      }
  for (let $ of [-1, 1]) {
    c.box(
      containerPaintSlot,
      0.085,
      r - 2 * CORNER_CASTING_HEIGHT + 0.01,
      0.15,
      -p + 0.0465,
      r / 2,
      $ * (f - 0.079),
      {
        r: 0.014,
      },
    );
    c.box(
      containerPaintSlot,
      0.14,
      r - 2 * CORNER_CASTING_HEIGHT + 0.01,
      0.056,
      p - 0.074,
      r / 2,
      $ * (f - 0.032),
      {
        r: 0.012,
      },
    );
    c.box(
      containerPaintSlot,
      o - 0.2,
      0.062,
      0.062,
      -0.02,
      r - 0.031,
      $ * (f - 0.035),
      {
        r: 0.008,
      },
    );
    c.box(
      containerPaintSlot,
      o - 0.2,
      0.158,
      0.05,
      -0.02,
      0.012 + 0.079,
      $ * (f - 0.029),
      {
        r: 0.008,
      },
    );
  }
  c.box(
    containerPaintSlot,
    0.062,
    0.062,
    CONTAINER_WIDTH - 0.2,
    -p + 0.035,
    r - 0.031,
    0,
    {
      r: 0.008,
    },
  );
  c.box(
    containerPaintSlot,
    0.05,
    0.158,
    CONTAINER_WIDTH - 0.2,
    -p + 0.029,
    0.091,
    0,
    {
      r: 0.008,
    },
  );
  c.box(
    containerPaintSlot,
    0.13,
    0.12,
    CONTAINER_WIDTH - 0.12,
    p - 0.072,
    r - 0.06,
    0,
    {
      r: 0.01,
    },
  );
  c.box(
    containerPaintSlot,
    0.13,
    0.158,
    CONTAINER_WIDTH - 0.12,
    p - 0.072,
    0.091,
    0,
    {
      r: 0.01,
    },
  );
  c.box(
    containerPaintSlot,
    0.03,
    0.012,
    CONTAINER_WIDTH - 0.4,
    p - 0.012,
    r - 0.125,
    0,
    {
      r: 0.003,
      rot: [0, 0, -0.5],
    },
  );
  if (e === "container20") {
    for (let $ of [-1, 1])
      for (let ue of [-1.025, 1.025]) {
        c.add(
          containerPaintSlot,
          placeGeo(planeGeo(0.36, 0.112), ue, 0.075, $ * (f - 0.0035), [
            0,
            $ > 0 ? 0 : Math.PI,
            0,
          ]),
          O,
        );
        c.box(
          containerPaintSlot,
          0.46,
          0.018,
          0.012,
          ue,
          0.142,
          $ * (f - 0.002),
          {
            r: 0.003,
          },
        );
        for (let me of [-1, 1])
          c.box(
            containerPaintSlot,
            0.018,
            0.13,
            0.01,
            ue + me * 0.19,
            0.078,
            $ * (f - 0.003),
            {
              r: 0.003,
            },
          );
      }
  }
  let q = [x, 0.44, 1.25, r - 0.5, y],
    U = corrugationProfile(
      v,
      g,
      SIDE_WALL_CORRUGATION.P,
      SIDE_WALL_CORRUGATION.d,
      SIDE_WALL_CORRUGATION.fo,
      SIDE_WALL_CORRUGATION.sl,
      v + 0.02,
    );
  for (let $ of [-1, 1]) {
    let ue = loftGeo(
      U,
      q,
      (B: number, P: number, V: number) => [B, V, $ * (d + P - H(B, V, $))],
      {
        center: [0, r / 2, 0],
      },
    );
    ue.computeVertexNormals();
    let me = ue.attributes.position,
      ee = new Float32Array(me.count * 3);
    for (let B = 0; B < me.count; B++) {
      let P = me.getX(B),
        V = me.getY(B),
        Y = me.getZ(B),
        L = z(P, V, Y),
        Z = d - Math.abs(Y),
        J = smoothstep01(0.008, 0.034, Z);
      L = [L[0] * (1 - 0.17 * J), L[1] * (1 - 0.18 * J), L[2] * (1 - 0.18 * J)];
      let oe = smoothstep01(r - 0.75, y, V);
      if (oe > 0) {
        for (let le of _)
          if (le.side === $) {
            let R = Math.abs(P - le.x) / le.w;
            if (R < 1) {
              L = lerp3(
                L,
                [L[0] * w[0], L[1] * w[1], L[2] * w[2]],
                oe * oe * le.k * (1 - R * R) * (0.45 + 0.55 * s),
              );
            }
          }
      }
      let fe = H(P, V, $);
      if (fe > 0.004) {
        L = lerp3(
          L,
          [L[0] * 0.66, L[1] * 0.46, L[2] * 0.36],
          Math.min(0.8, fe * 22),
        );
      }
      ee[B * 3] = L[0];
      ee[B * 3 + 1] = L[1];
      ee[B * 3 + 2] = L[2];
    }
    ue.setAttribute("color", new BufferAttribute(ee, 3));
    c.buckets.get(containerPaintSlot).geos.push(ue);
  }
  for (let $ of [-1, 1])
    for (let ue of o > 7 ? [-1, 1] : [1]) {
      let me = $ * ue * (p - 0.62),
        ee = r - 0.165,
        B = $ * (d - 0.004);
      c.box(containerPaintSlot, 0.24, 0.1, 0.03, me, ee, B, {
        r: 0.008,
      });
      for (let P = -1; P <= 1; P++)
        c.add(
          containerPaintSlot,
          placeGeo(
            planeGeo(0.18, 0.012),
            me,
            ee + P * 0.026,
            $ * (d + 0.0116),
            [0, $ > 0 ? 0 : Math.PI, 0],
          ),
          O,
        );
    }
  {
    let $ = corrugationProfile(
        -f + 0.155,
        f - 0.155,
        END_WALL_CORRUGATION.P,
        END_WALL_CORRUGATION.d,
        END_WALL_CORRUGATION.fo,
        END_WALL_CORRUGATION.sl,
        -f + 0.155 + 0.03,
      ),
      ue = loftGeo(
        $,
        [x, 1.25, y],
        (ee: any, B: number, P: any) => [-(p - 0.014 + B), P, ee],
        {
          center: [0, r / 2, 0],
        },
      ),
      me = -(p - 0.014);
    c.add(containerPaintSlot, ue, (ee: number, B: number, P: number) => {
      let V = z(ee, B, P),
        Y = smoothstep01(0.008, 0.038, ee - me);
      return [
        V[0] * (1 - 0.17 * Y),
        V[1] * (1 - 0.18 * Y),
        V[2] * (1 - 0.18 * Y),
      ];
    });
  }
  {
    let $ = corrugationProfile(
        -p + 0.07,
        p - 0.13,
        ROOF_CORRUGATION.P,
        ROOF_CORRUGATION.d,
        ROOF_CORRUGATION.fo,
        ROOF_CORRUGATION.sl,
        -p + 0.1,
      ),
      ue = r - 0.008,
      me = loftGeo(
        $,
        o > 7 ? [-(f - 0.066), f - 0.066] : [-(f - 0.066), 0, f - 0.066],
        (ee: any, B: number, P: number) => [
          ee,
          ue + B + (Math.abs(P) < 0.01 ? 0.006 : 0),
          P,
        ],
        {
          center: [0, r / 2, 0],
        },
      );
    c.add(containerPaintSlot, me, (ee: number, B: number, P: number) => {
      let V = 0.78 + 0.3 * valueNoise2(ee * 0.8 + S, P * 1.1),
        Y = smoothstep01(0.004, 0.018, ue - B);
      return [
        V * (1 - 0.25 * Y),
        V * (1 - 0.3 * Y) * 0.97,
        V * (1 - 0.32 * Y) * 0.94,
      ];
    });
  }
  let T = n > 0.03,
    D = 0.172;
  if (T) {
    let $ = (ee: number, B: number, P: any) => {
        let Y =
          (0.16 + 0.62 * smoothstep01(-p, p, ee) * smoothstep01(-p, p, ee)) *
          (0.8 + 0.2 * smoothstep01(0.2, 1.4, B));
        return [Y, Y, Y];
      },
      ue = corrugationProfile(
        v,
        g,
        SIDE_WALL_CORRUGATION.P,
        SIDE_WALL_CORRUGATION.d,
        SIDE_WALL_CORRUGATION.fo,
        SIDE_WALL_CORRUGATION.sl,
        v + 0.02,
      );
    for (let ee of [-1, 1])
      c.add(
        containerPaintSlot,
        loftGeo(
          ue,
          [D, y - 0.02],
          (B: any, P: number, V: any) => [B, V, ee * (d + P - 0.004)],
          {
            center: [0, r / 2, 0],
            inward: true,
          },
        ),
        $,
      );
    c.add(
      containerPaintSlot,
      placeGeo(planeGeo(g - v, 2 * d), (v + g) / 2, y - 0.03, 0, [
        Math.PI / 2,
        0,
        0,
      ]),
      $,
    );
    c.add(
      containerPaintSlot,
      placeGeo(planeGeo(2 * d, y - D), v + 0.03, (D + y) / 2, 0, [
        0,
        Math.PI / 2,
        0,
      ]),
      $,
    );
    let me = planeGeoUv(g - v + 0.1, 2 * d - 0.02);
    c.add(
      h,
      placeGeo(me, (v + g) / 2 + 0.05, D, 0, [-Math.PI / 2, 0, 0]),
      (ee: number) => {
        let B = 0.3 + 0.6 * smoothstep01(-p, p, ee) ** 2;
        return [B, B * 0.97, B * 0.93];
      },
    );
    c.box(u, 0.05, 0.006, 2 * d - 0.1, p - 0.11, D + 0.001, 0, {
      r: 0.002,
    });
  }
  let C = 0.175,
    G = r - 0.124,
    j = G - C,
    N = f - 0.058 - 0.004,
    Q = p - 0.066,
    K = ($: number, ue: number, me: number) => z($, ue, me),
    ie: any[] = [];
  for (let $ of [1, -1]) {
    let ue = n * ($ > 0 ? 1 : 0.88) * MathUtils.degToRad($ > 0 ? 112 : 100),
      me = $ * (f - 0.058);
    c.push(placeMatrix(Q, 0, me, [0, -$ * ue, 0]));
    let ee = (k: number) => -$ * k,
      B = (C + G) / 2;
    c.box(containerPaintSlot, 0.034, j, N - 0.006, 0, B, ee(N / 2), {
      r: 0.008,
      col: K,
    });
    let P = e === "container40hc" ? 7 : 6,
      V = C + 0.085,
      Y = G - 0.085,
      L = (Y - V) / P,
      Z = 0.019,
      J = 0.031,
      oe: number[][] = [];
    for (let k = 0; k < P; k++) {
      let ce = V + k * L;
      oe.push(
        [ce, Z],
        [ce + 0.022, Z],
        [ce + 0.05, J],
        [ce + L - 0.05, J],
        [ce + L - 0.022, Z],
      );
    }
    oe.push([Y, Z]);
    c.add(
      containerPaintSlot,
      loftGeo(
        oe,
        [0.075, N - 0.085],
        (k: any, ce: any, ve: number) => [ce, k, ee(ve)],
        {
          center: [-1, B, ee(N / 2)],
        },
      ),
      (k: number, ce: number, ve: number) => z(k, ce, ve),
    );
    let fe = (k: number) => V + (k + 0.5) * L,
      le = [0.05, 0.05, 0.05];
    c.box(
      containerPaintSlot,
      0.022,
      j + 0.012,
      0.018,
      0.004,
      B,
      ee(N + 0.001),
      {
        r: 0,
        col: le,
      },
    );
    c.box(containerPaintSlot, 0.022, 0.016, N, 0.004, G + 0.004, ee(N / 2), {
      r: 0,
      col: le,
    });
    c.box(containerPaintSlot, 0.022, 0.016, N, 0.004, C - 0.004, ee(N / 2), {
      r: 0,
      col: le,
    });
    let R = e === "container40hc" ? 5 : 4;
    for (let k = 0; k < R; k++) {
      let ce = C + 0.16 + (k * (j - 0.32)) / (R - 1);
      c.box(containerPaintSlot, 0.012, 0.062, 0.15, 0.021, ce, ee(0.085), {
        r: 0,
      });
      c.cyl(u, 0.013, 0.013, 0.086, 0.026, ce, ee(-0.002), {
        seg: 6,
        open: true,
      });
    }
    for (let k of [0.31, 0.83]) {
      c.cyl(u, 0.0155, 0.0155, j + 0.2, 0.052, B, ee(k), {
        seg: 7,
        open: true,
      });
      for (let Te of [-1, 1]) {
        c.add(
          u,
          placeGeo(
            boxGeo(0.03, 0.045, 0.085),
            0.052 - 0.004,
            B + Te * (j / 2 + 0.065),
            ee(k),
          ),
        );
        c.box(
          containerPaintSlot,
          0.03,
          0.05,
          0.075,
          0.052 - 0.012,
          B + Te * (j / 2 - 0.035),
          ee(k),
          {
            r: 0,
          },
        );
      }
      for (let Te of [C + j * 0.3, C + j * 0.72])
        c.box(containerPaintSlot, 0.026, 0.04, 0.07, 0.052 - 0.012, Te, ee(k), {
          r: 0,
        });
      let ve = 1.02 + (k > 0.5 ? 0 : 0.13),
        _e = k > 0.5 ? -1 : 1;
      c.box(u, 0.02, 0.05, 0.05, 0.052 + 0.008, ve, ee(k), {
        r: 0,
      });
      c.box(u, 0.011, 0.032, 0.36, 0.052 + 0.016, ve, ee(k + _e * 0.19), {
        r: 0.004,
      });
      c.box(
        containerPaintSlot,
        0.03,
        0.07,
        0.05,
        0.052 - 0.008,
        ve,
        ee(k + _e * 0.33),
        {
          r: 0,
        },
      );
      c.box(
        u,
        0.012,
        0.085,
        0.012,
        0.052 + 0.012,
        ve + 0.005,
        ee(k + _e * 0.33),
        {
          r: 0,
        },
      );
    }
    let I = 0.031 + 0.0025,
      se = [0, Math.PI / 2, 0],
      ae = (
        k: { aspect: number; material: { body?: boolean; em?: boolean } },
        ce: number,
        ve: number,
        _e: number,
        Te: number,
      ) => {
        let Pe = ce * k.aspect;
        if (Te && Pe > Te) {
          ce *= Te / Pe;
          Pe = Te;
        }
        c.add(
          k.material,
          placeGeo(planeGeo(Pe, ce), I, ve, ee(_e), se),
          null,
          true,
        );
      };
    if ($ < 0) {
      ae(
        labelMaterial(i, CONTAINER_IDS[t % CONTAINER_IDS.length], {
          color: "white",
          font: "stencil",
          distress: 0.3,
        }),
        0.115,
        fe(P - 1),
        N / 2,
        N - 0.24,
      );
      ae(
        labelMaterial(i, a.type, {
          color: "white",
          font: "stencil",
          distress: 0.3,
        }),
        0.1,
        fe(P - 2),
        N / 2 + 0.2,
        0.4,
      );
      let k = {
        color: "white",
        font: "sans",
        distress: 0.2,
      };
      ae(
        labelMaterial(i, "最大总重 " + a.gross + " 千克", k),
        0.052,
        fe(P - 3) + 0.062,
        N / 2 - 0.01,
        0.44,
      );
      ae(
        labelMaterial(
          i,
          "皮重 " + a.tare + " 千克  净重 " + a.net + " 千克",
          k,
        ),
        0.045,
        fe(P - 3),
        N / 2 - 0.01,
        0.44,
      );
      ae(
        labelMaterial(i, "容积 " + a.cu + " 立方米", k),
        0.045,
        fe(P - 3) - 0.062,
        N / 2 - 0.01,
        0.44,
      );
    } else {
      ae(
        decalMaterial(i, CONTAINER_LOGOS[t % 4]),
        0.2,
        fe(P - 1),
        N / 2,
        N - 0.36,
      );
      ae(decalMaterial(i, "csc_plate"), 0.17, fe(1), N / 2 + 0.05, 0.36);
      if (e === "container40hc") {
        ae(decalMaterial(i, "caution_stripes"), 0.1, G - 0.04, N / 2, N - 0.1);
      }
    }
    c.pop();
    if (T) {
      for (let k = 0; k < 3; k++) {
        let ce = (N * k) / 3,
          ve = (N * (k + 1)) / 3,
          _e = [Q + Math.sin(ue) * ce, me - $ * Math.cos(ue) * ce],
          Te = [Q + Math.sin(ue) * ve, me - $ * Math.cos(ue) * ve];
        ie.push({
          min: [
            Math.min(_e[0], Te[0]) - 0.03,
            C,
            Math.min(_e[1], Te[1]) - 0.03,
          ],
          max: [
            Math.max(_e[0], Te[0]) + 0.03,
            G,
            Math.max(_e[1], Te[1]) + 0.03,
          ],
          surface: "metal",
        });
      }
    }
  }
  for (let $ of [1, -1])
    for (let ue of [0.31, 0.83])
      for (let me of [-1, 1]) {
        let ee = $ * (f - 0.058) - $ * ue;
        c.add(
          containerPaintSlot,
          placeGeo(
            boxGeo(0.035, 0.05, 0.11),
            p - 0.03,
            me > 0 ? r - 0.07 : 0.115,
            ee,
          ),
        );
      }
  let F = (
      $: any,
      ue: number,
      me: number,
      ee: number,
      B: number,
      P?: number,
    ) => {
      let V = B * $.aspect;
      if (P && V > P) {
        B *= P / V;
        V = P;
      }
      let Y = me - V / 2,
        L = me + V / 2,
        Z = ue > 0 ? Y : -L,
        J = ue > 0 ? L : -Y,
        oe = corrugationProfile(
          Math.max(v, Z),
          Math.min(g, J),
          SIDE_WALL_CORRUGATION.P,
          SIDE_WALL_CORRUGATION.d,
          SIDE_WALL_CORRUGATION.fo,
          SIDE_WALL_CORRUGATION.sl,
          v + 0.02,
        ),
        fe = ee - B / 2,
        le = ee + B / 2,
        R = loftGeo(
          oe,
          [fe, le],
          (ae: number, k: number, ce: number) => [
            ae,
            ce,
            ue * (d + k + 0.003 - H(ae, ce, ue)),
          ],
          {
            center: [0, r / 2, 0],
          },
        ),
        I = R.attributes.position,
        se = R.attributes.uv;
      for (let ae = 0; ae < I.count; ae++) {
        let k = (I.getX(ae) - Z) / (J - Z);
        se.setXY(ae, ue > 0 ? k : 1 - k, (I.getY(ae) - fe) / B);
      }
      c.add($.material, R, null, true);
      return V;
    },
    X = labelMaterial(i, CONTAINER_IDS[t % CONTAINER_IDS.length], {
      color: "white",
      font: "stencil",
      distress: 0.3,
    }),
    ne = labelMaterial(i, a.type, {
      color: "white",
      font: "stencil",
      distress: 0.3,
    }),
    re = decalMaterial(i, CONTAINER_LOGOS[t % 4]);
  for (let $ of [-1, 1]) {
    let ue = Math.min(r * 0.4, 1.05),
      me = Math.min(ue * re.aspect, e === "container20" ? 2.2 : 3.4);
    F(
      re,
      $,
      e === "container20" ? -0.75 : -p * 0.42,
      r * 0.52,
      me / re.aspect,
      me,
    );
    let ee = Math.min(0.14 * X.aspect, 1.9);
    F(X, $, p - 0.3 - ee / 2, r - 0.32, 0.14, 1.9);
    let B = Math.min(0.11 * ne.aspect, 0.6);
    F(ne, $, p - 0.3 - B / 2, r - 0.52, 0.11, 0.6);
    let P = Math.round((1 + l() * 2) * (0.4 + s) * (o > 7 ? 1.6 : 1));
    for (let V = 0; V < P; V++) {
      let Y = decalMaterial(i, l() < 0.6 ? "rust_run" : "grime_streak"),
        L = 0.5 + l() * 0.7,
        Z = Math.min(0.5, Math.max(0.16, L * Y.aspect));
      F(
        {
          material: Y.material,
          aspect: Z / L,
        },
        $,
        (l() * 2 - 1) * (p - 0.6),
        y - L / 2 - 0.005,
        L,
      );
    }
  }
  if (T) {
    ie.push(
      {
        min: [-p, 0, -f],
        max: [p, D, f],
        surface: "wood",
      },
      {
        min: [-p, r - 0.09, -f],
        max: [p, r, f],
        surface: "metal",
      },
      {
        min: [-p, 0, -f],
        max: [p, r, -f + 0.07],
        surface: "metal",
      },
      {
        min: [-p, 0, f - 0.07],
        max: [p, r, f],
        surface: "metal",
      },
      {
        min: [-p, 0, -f],
        max: [-p + 0.07, r, f],
        surface: "metal",
      },
    );
  } else {
    ie.push({
      min: [-p, 0, -f],
      max: [p, r, f],
      surface: "metal",
    });
  }
  return {
    parts: c.parts(),
    colliders: ie,
  };
}
function buildContainer(
  i: any,
  e: string,
  t: { seed?: any; doors?: any; wear?: any; color?: any } = {},
) {
  let n = CONTAINER_SPECS[e],
    s = t.seed === undefined ? 0 : Math.abs(Math.floor(t.seed)),
    o = s % CONTAINER_SHELL_VARIANTS,
    r = Math.round(MathUtils.clamp(t.doors || 0, 0, 1) * 10) / 10,
    a =
      Math.round(
        MathUtils.clamp(t.wear === undefined ? 0.5 : t.wear, 0, 1) * 2,
      ) / 2,
    l = e + "|" + o + "|" + r + "|" + a,
    c = containerShellCache.get(i.mats);
  if (!c) {
    c = new Map();
    containerShellCache.set(i.mats, c);
  }
  if (!c.has(l)) {
    c.set(l, buildContainerShell(i, e, o, r, a));
  }
  let u = c.get(l),
    h = t.color;
  if (!CONTAINER_COLORS.includes(h)) {
    h =
      t.seed === undefined
        ? n.def
        : CONTAINER_COLORS[(s * 7 + 3) % CONTAINER_COLORS.length];
  }
  let f = groupFromParts(
      u.parts,
      new Map([
        [
          containerPaintSlot,
          i.mats.get("paint_" + h, {
            vertexColors: true,
          }),
        ],
      ]),
    ),
    p = PROP_SIZES[e];
  f.userData.color = h;
  f.userData.doors = r;
  return tagProp(
    f,
    e,
    [p[0], p[1], p[2]],
    u.colliders.map((d: any) => ({
      min: d.min.slice(),
      max: d.max.slice(),
      surface: d.surface,
    })),
  );
}
const yardPropDims = (i: string) => PROP_SIZES[i].slice(0, 3);
function buildJerseyBarrier(i: any, e: { seed?: any; stripe?: any } = {}) {
  let t = new PropBuilder(i),
    n = e.seed | 0,
    s = propRng(n + 11),
    o = n * 3.7,
    r = t.M("concrete", {
      vertexColors: true,
    }),
    a = [
      [-0.3, 0],
      [0.3, 0],
      [0.3, 0.076],
      [0.127, 0.33],
      [0.1, 0.57],
      [0.077, 0.79],
      [0.06, 0.81],
      [-0.06, 0.81],
      [-0.077, 0.79],
      [-0.1, 0.57],
      [-0.127, 0.33],
      [-0.3, 0.076],
    ],
    l = [-1.5, -1.47];
  for (let f = -1.25; f <= 1.26; f += 0.25) l.push(f);
  l.push(1.47, 1.5);
  let c: number[][] = [];
  for (let f = 0; f < 7; f++)
    c.push([
      (s() * 2 - 1) * 1.5,
      s() * 0.8,
      0.08 + s() * 0.14,
      s() < 0.5 ? 1 : -1,
    ]);
  let u = loftGeo(
    a,
    l,
    (f: number, p: number, d: number) => {
      let v = Math.abs(d) > 1.49 ? 1 : 0;
      return [d, p - v * 0.022 * (p / 0.81), f * (1 - v * 0.09)];
    },
    {
      closed: true,
      caps: true,
    },
  );
  t.add(r, u, (f: number, p: number, d: number) => {
    let v =
        0.86 +
        0.2 * valueNoise2(f * 1.3 + o, p * 3 + d * 2) +
        0.08 * valueNoise2(f * 7, p * 9 + o),
      g = [v, v * 0.99, v * 0.97];
    g = lerp3(g, [v * 0.5, v * 0.48, v * 0.44], smoothstep01(0.3, 0, p) * 0.8);
    let x =
      smoothstep01(0.55, 0.8, valueNoise2(f * 4.5 + o, 3.3)) *
      smoothstep01(0.25, 0.8, p);
    g = lerp3(g, [v * 0.62, v * 0.6, v * 0.56], x * 0.6);
    let y =
      smoothstep01(0.6, 0.85, valueNoise2(f * 2.1 + o * 2, d * 3)) *
      smoothstep01(0.2, 0.33, p) *
      smoothstep01(0.62, 0.4, p);
    g = lerp3(g, [0.22, 0.22, 0.22], y * 0.65);
    for (let b of c)
      if (Math.sign(d || 1) === b[3]) {
        let m = Math.hypot(f - b[0], p - b[1]) / b[2];
        if (m < 1) {
          g = lerp3(g, [1.12, 1.1, 1.05], (1 - m) * 0.7);
        }
      }
    if (Math.abs(f) > 1.4) {
      g = lerp3(g, [1.08, 1.06, 1.02], 0.4 * valueNoise2(p * 9, d * 9 + o));
    }
    return g;
  });
  let h = [0.05, 0.05, 0.05];
  for (let f of [-1, 1])
    for (let p of [-0.85, 0.85]) {
      t.add(
        r,
        placeGeo(planeGeo(0.3, 0.058), p, 0.03, f * 0.3008, [
          0,
          f > 0 ? 0 : Math.PI,
          0,
        ]),
        h,
      );
      t.box(r, 0.34, 0.012, 0.012, p, 0.064, f * 0.3, {
        r: 0.003,
        col: [0.7, 0.7, 0.68],
      });
    }
  for (let f of [-0.9, 0.9])
    t.tube(
      t.M("steel_rust"),
      [
        [f - 0.05, 0.8, 0],
        [f - 0.04, 0.85, 0],
        [f + 0.04, 0.85, 0],
        [f + 0.05, 0.8, 0],
      ],
      0.008,
      {
        seg: 5,
      },
    );
  if (e.stripe) {
    let f = t.M("hazard_stripes");
    t.add(
      f,
      placeGeo(planeGeoUv(2.9, 0.118), 0, 0.8125, 0, [-Math.PI / 2, 0, 0]),
    );
    for (let p of [-1, 1])
      t.add(
        f,
        placeGeo(planeGeoUv(2.9, 0.2), 0, 0.68, p * 0.0905, [
          p > 0 ? -0.108 : 0.108,
          p > 0 ? 0 : Math.PI,
          0,
        ]),
      );
  }
  return tagProp(t.group(), "jersey_barrier", yardPropDims("jersey_barrier"), [
    {
      min: [-1.5, 0, -0.3],
      max: [1.5, 0.33, 0.3],
      surface: "concrete",
    },
    {
      min: [-1.5, 0.33, -0.13],
      max: [1.5, 0.81, 0.13],
      surface: "concrete",
    },
  ]);
}
function addMastFloodlight(
  i: any,
  e: any,
  t: any,
  n: any,
  s: number,
  o: number,
  r: number,
  a: number,
  l: number,
) {
  i.push(placeMatrix(s, o, r, [0, a, 0]));
  i.push(placeMatrix(0, 0, 0, [0, 0, l]));
  i.box(t, 0.1, 0.34, 0.46, 0.09, 0, 0, {
    r: 0.014,
  });
  i.add(
    n,
    placeGeo(planeGeo(0.4, 0.28), 0.1415, 0, 0, [0, Math.PI / 2, 0]),
    null,
    true,
  );
  i.box(t, 0.012, 0.018, 0.47, 0.146, 0.156, 0, {
    r: 0,
  });
  i.box(t, 0.012, 0.018, 0.47, 0.146, -0.156, 0, {
    r: 0,
  });
  i.box(t, 0.012, 0.33, 0.018, 0.146, 0, 0.222, {
    r: 0,
  });
  i.box(t, 0.012, 0.33, 0.018, 0.146, 0, -0.222, {
    r: 0,
  });
  i.box(t, 0.09, 0.008, 0.48, 0.17, 0.175, 0, {
    r: 0,
    rot: [0, 0, -0.12],
  });
  for (let c = -3; c <= 3; c++)
    i.add(t, placeGeo(boxGeo(0.045, 0.3, 0.008), 0.02, 0, c * 0.062));
  i.pop();
  i.box(e, 0.03, 0.05, 0.56, 0.02, -0.02, 0, {
    r: 0.004,
  });
  for (let c of [-1, 1])
    i.box(e, 0.1, 0.05, 0.012, 0.05, -0.02, c * 0.275, {
      r: 0,
      rot: [0, 0, l * 0.5],
    });
  i.pop();
}
function buildLightMast(i: any, e: { on?: any } = {}) {
  let t = new PropBuilder(i),
    n = t.M("steel_galv"),
    s = t.M("concrete", {
      vertexColors: true,
    }),
    o = t.M("steel_dark"),
    r = i.mats.emissive(16769981, e.on === false ? 0.02 : 8);
  t.box(s, 0.8, 0.32, 0.8, 0, 0.16, 0, {
    r: 0.03,
    col: (x: number, y: number, b: number) => {
      let m =
        0.62 + 0.36 * smoothstep01(0, 0.3, y) + 0.1 * valueNoise2(x * 5, b * 5);
      return [m, m, m * 0.97];
    },
  });
  t.box(n, 0.5, 0.03, 0.5, 0, 0.335, 0, {
    r: 0.006,
  });
  for (let x = 0; x < 8; x++) {
    let y = ((x + 0.5) * Math.PI) / 4,
      b = Math.cos(y) * 0.215,
      m = Math.sin(y) * 0.215;
    t.cyl(n, 0.014, 0.014, 0.1, b, 0.38, m, {
      seg: 6,
    });
    t.cyl(n, 0.027, 0.027, 0.024, b, 0.362, m, {
      seg: 6,
      flat: true,
    });
  }
  let a = 0.35,
    l = 13.3,
    c = 0.168,
    u = 0.07,
    h = (x: number) => c + ((u - c) * (x - a)) / (l - a),
    f = [
      [a, 4.75, 0],
      [4.6, 9.15, 0.007],
      [9, l, 0.014],
    ];
  for (let [x, y, b] of f)
    t.cyl(n, h(y) + b, h(x) + b, y - x, 0, (x + y) / 2, 0, {
      seg: 8,
      flat: true,
      open: true,
      rot: [0, Math.PI / 8, 0],
    });
  for (let x = 0; x < 4; x++) {
    let y = (x * Math.PI) / 2;
    t.box(n, 0.012, 0.2, 0.12, Math.cos(y) * 0.2, 0.45, -Math.sin(y) * 0.2, {
      r: 0,
      rot: [0, y + Math.PI / 2, 0],
    });
  }
  t.cyl(n, 0.2, 0.2, 0.02, 0, 0.36, 0, {
    seg: 8,
    rot: [0, Math.PI / 8, 0],
  });
  t.cyl(n, 0.09, 0.09, 0.03, 0, l, 0, {
    seg: 8,
    rot: [0, Math.PI / 8, 0],
  });
  let p = h(1.05) * 0.924;
  t.box(n, 0.13, 0.52, 0.012, 0, 1.05, p + 0.005, {
    r: 0.004,
  });
  t.box(o, 0.03, 0.045, 0.012, 0.04, 1.05, p + 0.013, {
    r: 0.003,
  });
  t.decal(
    decalMaterial(i, "hazard_voltage"),
    0.09,
    -0.01,
    1.2,
    p + 0.0125,
    null,
  );
  t.tube(
    o,
    [
      [-0.3, 0.3, 0.28],
      [-0.3, 0.52, 0.28],
      [-0.24, 0.72, 0.2],
      [-0.1, 0.8, 0.1],
    ],
    0.024,
    {
      seg: 6,
    },
  );
  t.cyl(o, 0.034, 0.034, 0.03, -0.3, 0.335, 0.28, {
    seg: 8,
  });
  t.bar(n, [0.1, 3, -0.13], [0.42, 3, -0.13], 0.012);
  t.bar(n, [0.1, 3, 0.13], [0.42, 3, 0.13], 0.012);
  t.bar(n, [0.42, 3, -0.16], [0.42, 3, 0.16], 0.012, {
    caps: true,
  });
  t.bar(n, [0.42, 3, -0.13], [0.42, 3.09, -0.13], 0.012, {
    caps: true,
  });
  t.bar(n, [0.42, 3, 0.13], [0.42, 3.09, 0.13], 0.012, {
    caps: true,
  });
  t.cyl(n, h(3) + 0.012, h(3) + 0.012, 0.05, 0, 3, 0, {
    seg: 8,
    rot: [0, Math.PI / 8, 0],
  });
  let d = 0;
  for (let x = 3.45; x < 12.9; x += 0.38, d++) {
    let y = d % 2 ? 1 : -1;
    t.bar(n, [0, x, y * h(x) * 0.8], [0, x, y * (h(x) + 0.15)], 0.009, {
      seg: 5,
      caps: true,
    });
  }
  let v = l + 0.12;
  t.box(n, 0.1, 0.1, 1.9, 0, v, 0, {
    r: 0.012,
  });
  t.box(n, 0.5, 0.07, 0.07, 0, v + 0.085, 0.55, {
    r: 0.01,
  });
  t.box(n, 0.5, 0.07, 0.07, 0, v + 0.085, -0.55, {
    r: 0.01,
  });
  t.beam(n, [0, l - 0.5, 0.08], [0, v - 0.03, 0.7], 0.04, 0.04);
  t.beam(n, [0, l - 0.5, -0.08], [0, v - 0.03, -0.7], 0.04, 0.04);
  for (let x of [-0.55, 0.55]) {
    addMastFloodlight(t, n, o, r, 0.22, v - 0.14, x, 0, -0.62);
    addMastFloodlight(t, n, o, r, -0.22, v - 0.14, x, Math.PI, -0.62);
  }
  t.box(o, 0.16, 0.2, 0.12, 0, l - 0.25, -0.14, {
    r: 0.01,
  });
  t.bar(n, [0, v, 0], [0, 14, 0], 0.012, {
    r2: 0.003,
    seg: 5,
    caps: true,
  });
  let g = t.group();
  g.userData.lamps = [];
  for (let x of [-0.55, 0.55])
    for (let y of [-1, 1])
      g.userData.lamps.push({
        pos: [y * 0.34, v - 0.22, x],
        dir: [y * 0.81, -0.58, 0],
        color: 16769981,
      });
  return tagProp(g, "light_mast", yardPropDims("light_mast"), [
    {
      min: [-0.4, 0, -0.4],
      max: [0.4, 0.32, 0.4],
      surface: "concrete",
    },
    {
      min: [-0.17, 0.32, -0.17],
      max: [0.17, 14, 0.17],
      surface: "metal",
    },
  ]);
}
function buildFencePanel(
  i: any,
  e: { seed?: any; posts?: any; lean?: any } = {},
) {
  let t = new PropBuilder(i),
    n = propRng((e.seed | 0) + 5),
    s = t.M("steel_galv"),
    o = t.M("concrete", {
      vertexColors: true,
    }),
    r = t.M("chainlink", {
      doubleSide: true,
    }),
    a = e.posts || "both",
    l = e.lean === 1 ? 1 : -1,
    c =
      a === "both"
        ? [-1.5, 1.5]
        : a === "left"
          ? [-1.5]
          : a === "right"
            ? [1.5]
            : [];
  for (let p of c) {
    t.box(o, 0.32, 0.09, 0.32, p, 0.035, 0, {
      r: 0.02,
      col: (d: any, v: number) => {
        let g = 0.6 + 0.4 * smoothstep01(0, 0.08, v);
        return [g, g, g];
      },
    });
    t.cyl(s, 0.03, 0.03, 2.02, p, 1.05, 0, {
      seg: 8,
      open: true,
    });
    t.cyl(s, 0.05, 0.05, 0.012, p, 0.086, 0, {
      seg: 8,
    });
    t.bar(s, [p, 2.02, 0], [p, 2.4 - 0.02, l * 0.36], 0.019, {
      seg: 6,
      caps: true,
    });
    t.cyl(s, 0.034, 0.034, 0.05, p, 2.03, 0, {
      seg: 8,
    });
    for (let d of [0.2, 1.05, 1.9])
      t.cyl(s, 0.034, 0.034, 0.03, p, d, 0, {
        seg: 8,
        open: true,
      });
  }
  t.bar(s, [-1.5, 2, 0.036], [1.5, 2, 0.036], 0.021, {
    seg: 7,
  });
  for (let p of [0.09, 1.02])
    t.bar(s, [-1.5, p, 0.012], [1.5, p, 0.012], 0.0035, {
      seg: 4,
    });
  t.box(s, 0.008, 1.9, 0.02, -1.462, 1.03, 0.012, {
    r: 0,
  });
  t.box(s, 0.008, 1.9, 0.02, 1.462, 1.03, 0.012, {
    r: 0,
  });
  let u = new PlaneGeometry(2.92, 1.93, 6, 3),
    h = u.attributes.position,
    f = u.attributes.uv;
  for (let p = 0; p < h.count; p++) {
    let d = h.getX(p),
      v = h.getY(p);
    f.setXY(p, d + 1.5, v + 1);
    h.setZ(
      p,
      0.012 +
        0.02 *
          (valueNoise2(d * 1.3 + (e.seed | 0), v * 1.5) - 0.5) *
          (1 - Math.abs(d) / 1.46),
    );
  }
  u.computeVertexNormals();
  t.add(r, placeGeo(u, 0, 1.025, 0));
  for (let p = 0; p < 3; p++) {
    let d = 0.3 + p * 0.33,
      v = 2.02 + d * 0.36,
      g = l * d * 0.36;
    t.bar(s, [-1.5, v, g], [1.5, v, g], 0.0032, {
      seg: 4,
    });
    for (let x = -1.42 + (p % 2) * 0.09; x < 1.45; x += 0.18)
      t.add(
        s,
        placeGeo(boxGeo(0.004, 0.032, 0.004), x, v, g, [n() * 3, 0, 0.8 + n()]),
      );
  }
  for (let p = 0; p < 5; p++)
    t.add(s, placeGeo(boxGeo(0.012, 0.012, 0.03), -1.2 + p * 0.6, 2, 0.02));
  return tagProp(t.group(), "fence_panel", yardPropDims("fence_panel"), [
    {
      min: [-1.5, 0, -0.04],
      max: [1.5, 2.4, 0.04],
      surface: "metal",
    },
  ]);
}
function buildGuardBooth(
  i: {
    mats: {
      emissive: (
        arg0: number,
        arg1: number,
      ) => { body: boolean | undefined; em: boolean | undefined };
    };
  },
  e: { seed?: any; color?: any; on?: any } = {},
) {
  let t = new PropBuilder(i),
    n = e.seed | 0,
    s = n * 1.3,
    o = 2.6,
    r = 2.2,
    a = o / 2,
    l = r / 2,
    c = t.M(
      "paint_" +
        (["white", "grey", "teal"].includes(e.color) ? e.color : "white"),
      {
        vertexColors: true,
      },
    ),
    u = t.M("steel_dark"),
    h = t.M("steel_galv"),
    f = t.M("glass", {
      doubleSide: true,
    }),
    p = t.M("wood_dark"),
    d = t.M("polymer_black"),
    v = (H: number, O: number, q: number) => {
      let U =
        (0.9 + 0.14 * valueNoise2(H * 2 + s, O * 2 + q)) *
        (0.6 + 0.4 * smoothstep01(0.1, 0.7, O)) *
        (1 - 0.25 * smoothstep01(2.25, 2.45, O));
      return [U, U * 0.985, U * 0.96];
    };
  t.defCol.set(c, v);
  let g = 0.12,
    x = 1,
    y = 2.08,
    b = 2.42;
  t.box(u, o, 0.12, r, 0, 0.06, 0, {
    r: 0.015,
  });
  for (let H of [-0.7, 0.7])
    t.box(u, o + 0.06, 0.06, 0.1, 0, 0.03, H, {
      r: 0.01,
    });
  for (let H of [-1, 1])
    for (let O of [-1, 1])
      t.box(
        c,
        0.09,
        b - g,
        0.09,
        H * (a - 0.045),
        (b + g) / 2,
        O * (l - 0.045),
        {
          r: 0.012,
        },
      );
  let m = 0.3,
    A = 1.12,
    _ = (H: number, O: number) => {
      let q = O > 0 ? [[-a + 0.09, m - 0.04]] : [[-a + 0.09, a - 0.09]];
      for (let [U, T] of q) {
        t.box(c, T - U, x - g, 0.05, (U + T) / 2, (x + g) / 2, H, {
          r: 0.006,
        });
        t.box(c, T - U, 0.05, 0.075, (U + T) / 2, x + 0.01, H + O * 0.005, {
          r: 0.008,
        });
        t.box(
          f,
          T - U,
          y - x - 0.03,
          0.008,
          (U + T) / 2,
          (x + y) / 2 + 0.01,
          H,
          {
            r: 0,
          },
        );
        let D = T - U > 1.6 ? 2 : 1;
        for (let C = 1; C <= D; C++)
          t.box(
            c,
            0.04,
            y - x,
            0.05,
            U + ((T - U) * C) / (D + 1),
            (x + y) / 2,
            H,
            {
              r: 0.006,
            },
          );
        for (let C = 1; C < 3; C++)
          t.box(
            c,
            0.006,
            x - g - 0.04,
            0.056,
            U + ((T - U) * C) / 3,
            (x + g) / 2,
            H,
            {
              r: 0,
            },
          );
      }
      t.box(c, o - 0.18, b - y, 0.05, 0, (b + y) / 2, H, {
        r: 0.006,
      });
    };
  _(l - 0.03, 1);
  _(-l + 0.03, -1);
  for (let H of [-1, 1]) {
    let O = H * (a - 0.03);
    t.box(c, 0.05, x - g, r - 0.18, O, (x + g) / 2, 0, {
      r: 0.006,
    });
    t.box(c, 0.075, 0.05, r - 0.18, O + H * 0.005, x + 0.01, 0, {
      r: 0.008,
    });
    t.box(f, 0.008, y - x - 0.03, r - 0.18, O, (x + y) / 2 + 0.01, 0, {
      r: 0,
    });
    t.box(c, 0.05, y - x, 0.04, O, (x + y) / 2, 0, {
      r: 0.006,
    });
    t.box(c, 0.05, b - y, r - 0.18, O, (b + y) / 2, 0, {
      r: 0.006,
    });
  }
  let M = l - 0.03;
  t.box(c, 0.05, y - g, 0.07, m - 0.015, (y + g) / 2, M, {
    r: 0.006,
  });
  t.box(c, 0.05, y - g, 0.07, A + 0.015, (y + g) / 2, M, {
    r: 0.006,
  });
  t.box(
    c,
    a - 0.09 - A - 0.04,
    y - g,
    0.05,
    (a - 0.09 + A + 0.04) / 2,
    (y + g) / 2,
    M,
    {
      r: 0.006,
    },
  );
  let E = A - m - 0.02,
    w = (m + A) / 2;
  t.box(c, E, x - g - 0.01, 0.04, w, (x + g) / 2, M + 0.005, {
    r: 0.006,
  });
  t.box(c, E, 0.07, 0.04, w, y - 0.04, M + 0.005, {
    r: 0.006,
  });
  for (let H of [-1, 1])
    t.box(
      c,
      0.07,
      y - x,
      0.04,
      w + H * (E / 2 - 0.035),
      (x + y) / 2,
      M + 0.005,
      {
        r: 0.006,
      },
    );
  t.box(f, E - 0.12, y - x - 0.08, 0.008, w, (x + y) / 2 - 0.02, M + 0.005, {
    r: 0,
  });
  t.box(h, E - 0.06, 0.22, 0.004, w, g + 0.14, M + 0.027, {
    r: 0,
  });
  t.box(h, 0.03, 0.14, 0.02, m + 0.09, 1.05, M + 0.035, {
    r: 0.004,
  });
  t.bar(h, [m + 0.09, 1, M + 0.06], [m + 0.2, 1, M + 0.06], 0.009, {
    caps: true,
  });
  for (let H of [0.4, 1.75])
    t.cyl(h, 0.012, 0.012, 0.1, A + 0.002, H, M + 0.03, {
      seg: 6,
    });
  t.box(u, 0.9, 0.03, 0.3, w, 0.105, l + 0.15, {
    r: 0.006,
  });
  t.box(c, o + 0.36, 0.1, r + 0.4, 0, b + 0.05, 0, {
    r: 0.02,
    col: (H: number, O: any, q: number) => {
      let U = 0.72 + 0.2 * valueNoise2(H * 1.5, q * 1.5 + s);
      return [U, U, U * 0.97];
    },
  });
  t.box(u, o + 0.3, 0.03, r + 0.34, 0, b + 0.112, 0, {
    r: 0.01,
  });
  for (let H of [-1, 1])
    t.box(h, o + 0.36, 0.06, 0.08, 0, b - 0.005, H * (l + 0.2 + 0.03), {
      r: 0.012,
    });
  t.tube(
    h,
    [
      [-a - 0.16, b - 0.03, l + 0.23],
      [-a - 0.1, b - 0.2, l + 0.1],
      [-a - 0.03, b - 0.4, l + 0.03],
      [-a - 0.03, 0.2, l + 0.03],
      [-a - 0.1, 0.06, l + 0.1],
    ],
    0.03,
    {
      seg: 6,
      tension: 0.2,
    },
  );
  let S = -a - 0.17;
  t.box(c, 0.3, 0.52, 0.78, S, 0.62, -0.25, {
    r: 0.02,
  });
  t.add(
    c,
    placeGeo(roundedRectPath(0.44, 0.44, 6), S - 0.151, 0.62, -0.14, [
      0,
      -Math.PI / 2,
      0,
    ]),
    [0.06, 0.06, 0.06],
  );
  for (let H = -3; H <= 3; H++)
    t.add(
      u,
      placeGeo(
        boxGeo(0.006, 0.008, Math.sqrt(0.22 * 0.22 - (H * 0.06) ** 2) * 2),
        S - 0.154,
        0.62 + H * 0.06,
        -0.14,
      ),
    );
  t.cyl(u, 0.05, 0.05, 0.012, S - 0.156, 0.62, -0.14, {
    seg: 8,
    rot: [0, 0, Math.PI / 2],
  });
  for (let H of [-0.55, 0.05])
    t.beam(u, [-a, 0.32, H], [S - 0.1, 0.34, H], 0.03, 0.03, {
      r: 0,
    });
  t.tube(
    t.M("rubber"),
    [
      [S + 0.05, 0.86, 0.14],
      [S + 0.06, 1, 0.2],
      [-a - 0.02, 1.25, 0.24],
      [-a - 0.02, 2.2, 0.24],
    ],
    0.014,
    {
      seg: 5,
    },
  );
  t.add(
    t.M("floor_epoxy"),
    placeGeo(planeGeoUv(o - 0.1, r - 0.1), 0, 0.122, 0, [-Math.PI / 2, 0, 0]),
  );
  t.box(p, 0.6, 0.04, r - 0.3, -a + 0.4, 0.76, 0, {
    r: 0.008,
  });
  for (let H of [-0.85, 0.85])
    t.box(u, 0.5, 0.64, 0.03, -a + 0.4, 0.44, H, {
      r: 0.005,
    });
  t.box(d, 0.05, 0.32, 0.5, -a + 0.3, 1.02, -0.3, {
    r: 0.01,
    rot: [0, 0.25, 0],
  });
  t.add(
    i.mats.emissive(9418984, 1.6),
    placeGeo(planeGeo(0.45, 0.27), -a + 0.3 + 0.027, 1.02, -0.3 - 0.007, [
      0,
      Math.PI / 2 + 0.25,
      0,
    ]),
    null,
    true,
  );
  t.box(d, 0.05, 0.1, 0.06, -a + 0.28, 0.83, -0.3, {
    r: 0.008,
  });
  t.box(d, 0.18, 0.015, 0.22, -a + 0.28, 0.787, -0.3, {
    r: 0.004,
  });
  t.box(d, 0.14, 0.02, 0.42, -a + 0.52, 0.79, -0.25, {
    r: 0.004,
  });
  t.box(d, 0.46, 0.07, 0.46, -a + 1, 0.5, -0.2, {
    r: 0.02,
    rot: [0, 0.3, 0],
  });
  t.box(d, 0.07, 0.55, 0.42, -a + 1.22, 0.86, -0.13, {
    r: 0.02,
    rot: [0, 0.3, -0.12],
  });
  t.cyl(u, 0.025, 0.025, 0.36, -a + 1, 0.3, -0.2, {
    seg: 6,
  });
  for (let H = 0; H < 5; H++) {
    let O = H * Math.PI * 0.4;
    t.beam(
      u,
      [-a + 1, 0.16, -0.2],
      [-a + 1 + Math.cos(O) * 0.26, 0.14, -0.2 + Math.sin(O) * 0.26],
      0.03,
      0.025,
      {
        r: 0,
      },
    );
  }
  t.box(u, 0.2, 0.07, 0.1, w, y + 0.19, l + 0.03, {
    r: 0.012,
  });
  t.add(
    i.mats.emissive(16767398, e.on === false ? 0.02 : 5),
    placeGeo(planeGeo(0.17, 0.05), w, y + 0.152, l + 0.035, [
      Math.PI / 2,
      0,
      0,
    ]),
    null,
    true,
  );
  t.decal(
    labelMaterial(i, "门禁控制", {
      color: "black",
      font: "stencil",
      distress: 0.2,
    }),
    0.1,
    -0.45,
    (b + y) / 2,
    l - 0.003,
    null,
    0.9,
  );
  t.decal(decalMaterial(i, "berth4"), 0.34, a - 0.003, 0.56, 0.3, [
    0,
    Math.PI / 2,
    0,
  ]);
  t.decal(decalMaterial(i, "no_entry"), 0.2, w, 0.72, M + 0.0265, null);
  t.decal(
    decalMaterial(i, "grime_streak"),
    0.7,
    -0.6,
    0.55,
    l - 0.003,
    null,
    0.3,
  );
  t.decal(
    decalMaterial(i, "rust_run"),
    0.6,
    -a + 0.003 - 0,
    0.6,
    0.55,
    [0, -Math.PI / 2, 0],
    0.25,
  );
  let z = t.group();
  z.userData.lamps = [
    {
      pos: [w, y + 0.14, l + 0.04],
      dir: [0, -1, 0.2],
      color: 16767398,
    },
  ];
  return tagProp(z, "guard_booth", yardPropDims("guard_booth"), [
    {
      min: [-a, 0, -l],
      max: [a, 2.54, l],
      surface: "metal",
    },
  ]);
}
function buildGateArm(
  i: {
    mats: {
      emissive: (
        arg0: number,
        arg1: number,
      ) => { body: boolean | undefined; em: boolean | undefined };
    };
  },
  e: { open?: any } = {},
) {
  let t = new PropBuilder(i),
    n = MathUtils.clamp(e.open || 0, 0, 1),
    s = t.M("paint_orange", {
      vertexColors: true,
    }),
    o = t.M("paint_white"),
    r = t.M("paint_red"),
    a = t.M("steel_dark"),
    l = t.M("steel_galv"),
    c = t.M("paint_yellow"),
    u = -2.5 + 0.19,
    h = 0.92;
  t.box(t.M("concrete"), 0.5, 0.06, 0.46, u, 0.03, 0, {
    r: 0.015,
  });
  t.box(s, 0.36, 1, 0.3, u, 0.56, 0, {
    r: 0.02,
    col: (y: any, b: number) => {
      let m = 0.6 + 0.4 * smoothstep01(0.05, 0.5, b);
      return [m, m, m];
    },
  });
  t.box(a, 0.4, 0.04, 0.34, u, 1.075, 0, {
    r: 0.012,
  });
  t.box(s, 0.3, 0.6, 0.012, u, 0.5, 0.151, {
    r: 0.004,
    col: [0.9, 0.9, 0.9],
  });
  t.cyl(l, 0.012, 0.012, 0.016, u + 0.1, 0.5, 0.16, {
    seg: 6,
    rot: [Math.PI / 2, 0, 0],
  });
  t.decal(decalMaterial(i, "hazard_general"), 0.14, u, 0.9, 0.153, null);
  t.decal(
    decalMaterial(i, "caution_stripes"),
    0.08,
    u,
    0.12,
    0.153,
    null,
    0.34,
  );
  t.cyl(a, 0.03, 0.03, 0.05, u, 1.12, 0, {
    seg: 8,
  });
  t.add(
    i.mats.emissive(16734750, 2.2),
    placeGeo(cylinderGeo(0.026, 0.026, 0.045, 8), u, 1.165, 0),
    null,
    true,
  );
  t.push(placeMatrix(u, h, 0, [0, 0, n * 1.48]));
  t.cyl(a, 0.075, 0.075, 0.36, 0, 0, 0, {
    seg: 10,
    rot: [Math.PI / 2, 0, 0],
  });
  for (let y of [-1, 1])
    t.box(a, 0.62, 0.11, 0.012, 0.05, 0, y * 0.175, {
      r: 0.004,
    });
  t.box(a, 0.3, 0.16, 0.3, -0.33, -0.02, 0, {
    r: 0.02,
  });
  let f = 4.62,
    p = 0.12,
    d = 9,
    v = f / d;
  for (let y = 0; y < d; y++)
    t.box(
      y % 2 ? o : r,
      v + 0.001,
      0.1 - y * 0.003,
      0.05,
      p + v * (y + 0.5),
      0,
      0,
      {
        r: 0.008,
      },
    );
  t.box(a, 0.03, 0.11, 0.06, p + f + 0.012, 0, 0, {
    r: 0.008,
  });
  t.add(
    i.mats.emissive(16722450, 1.5),
    placeGeo(boxGeo(0.05, 0.03, 0.054), p + f - 0.5, 0.058, 0),
    null,
    true,
  );
  t.pop();
  let g = 2.5 - 0.1;
  t.box(t.M("concrete"), 0.3, 0.05, 0.3, g, 0.025, 0, {
    r: 0.012,
  });
  t.cyl(c, 0.04, 0.04, 0.8, g, 0.45, 0, {
    seg: 8,
  });
  t.box(c, 0.14, 0.02, 0.16, g, 0.855, 0, {
    r: 0.005,
  });
  for (let y of [-1, 1])
    t.box(c, 0.14, 0.14, 0.014, g, 0.93, y * 0.073, {
      r: 0.004,
    });
  t.cyl(l, 0.07, 0.07, 0.01, g, 0.055, 0, {
    seg: 8,
  });
  let x = [
    {
      min: [u - 0.2, 0, -0.17],
      max: [u + 0.2, 1.1, 0.17],
      surface: "metal",
    },
    {
      min: [g - 0.07, 0, -0.08],
      max: [g + 0.07, 1, 0.08],
      surface: "metal",
    },
  ];
  if (n < 0.5) {
    x.push({
      min: [u, h - 0.07, -0.04],
      max: [g, h + 0.07, 0.04],
      surface: "metal",
    });
  }
  return tagProp(t.group(), "gate_arm", yardPropDims("gate_arm"), x);
}
function buildBollardMooring(i: any, e: { seed?: any } = {}) {
  let t = new PropBuilder(i),
    n = (e.seed | 0) * 2.1,
    s = t.M("steel_dark", {
      vertexColors: true,
    }),
    o = t.M("steel_rust"),
    r = (a: number, l: number, c: number) => {
      let u = smoothstep01(0.3, 0.4, l) * smoothstep01(0.47, 0.4, l),
        h = 0.75 + 0.4 * valueNoise2(a * 6 + n, c * 6 + l * 4) + u * 0.9;
      return [h, h * 0.97, h * 0.93];
    };
  t.defCol.set(s, r);
  t.cyl(s, 0.34, 0.35, 0.045, 0, 0.0225, 0, {
    seg: 20,
  });
  t.cyl(o, 0.37, 0.37, 0.006, 0, 0.003, 0, {
    seg: 20,
  });
  for (let a = 0; a < 6; a++) {
    let l = (a * Math.PI) / 3 + 0.3;
    t.cyl(
      o,
      0.026,
      0.026,
      0.03,
      Math.cos(l) * 0.285,
      0.058,
      Math.sin(l) * 0.285,
      {
        seg: 6,
        flat: true,
      },
    );
    t.cyl(
      o,
      0.013,
      0.013,
      0.022,
      Math.cos(l) * 0.285,
      0.08,
      Math.sin(l) * 0.285,
      {
        seg: 6,
      },
    );
  }
  t.add(
    s,
    latheGeo(
      [
        [0.25, 0.045],
        [0.21, 0.08],
        [0.165, 0.16],
        [0.145, 0.27],
        [0.15, 0.36],
        [0.17, 0.43],
        [0.19, 0.5],
        [0.17, 0.57],
        [0.1, 0.6],
        [0, 0.602],
      ],
      18,
    ),
  );
  t.cyl(s, 0.105, 0.115, 0.5, 0, 0.485, 0, {
    seg: 14,
    open: true,
    rot: [0, 0, Math.PI / 2],
  });
  for (let a of [-1, 1]) {
    let l = sphereGeo(0.108, 14, 8);
    l.scale(0.55, 1, 1);
    t.add(s, placeGeo(l, a * 0.25, 0.485, 0));
    t.cyl(s, 0.125, 0.125, 0.03, a * 0.235, 0.485, 0, {
      seg: 14,
      rot: [0, 0, Math.PI / 2],
    });
  }
  return tagProp(
    t.group(),
    "bollard_mooring",
    yardPropDims("bollard_mooring"),
    [
      {
        min: [-0.3, 0, -0.22],
        max: [0.3, 0.6, 0.22],
        surface: "metal",
      },
    ],
  );
}
function buildBollardPost(i: any, e: { seed?: any } = {}) {
  let t = new PropBuilder(i),
    n = (e.seed | 0) * 1.7,
    s = t.M("paint_yellow", {
      vertexColors: true,
    }),
    o = t.M("steel_galv"),
    r = 0.083,
    a = (u: number) => (u > 0.6 && u < 0.69) || (u > 0.78 && u < 0.87),
    l = [
      0.012, 0.3, 0.6, 0.6001, 0.69, 0.6901, 0.78, 0.7801, 0.87, 0.8701, 0.955,
    ];
  for (let u = 0; u < l.length - 1; u++) {
    let h = l[u],
      f = l[u + 1];
    if (f - h < 0.001) {
      continue;
    }
    let p = a((h + f) / 2);
    t.cyl(s, r, r, f - h, 0, (h + f) / 2, 0, {
      seg: 14,
      open: true,
      col: (d: number, v: number, g: number) => {
        if (p) {
          return [0.05, 0.05, 0.05];
        }
        let x =
          (0.55 + 0.45 * smoothstep01(0, 0.35, v)) *
          (0.9 + 0.2 * valueNoise2(d * 30 + n, v * 6 + g * 30));
        return [x, x * 0.97, x * 0.9];
      },
    });
  }
  let c = sphereGeo(r, 14, 5, Math.PI * 2, 0, Math.PI / 2);
  c.scale(1, 0.55, 1);
  t.add(s, placeGeo(c, 0, 0.955, 0), [0.95, 0.93, 0.88]);
  t.cyl(o, 0.085, 0.085, 0.012, 0, 0.006, 0, {
    seg: 4,
    rot: [0, Math.PI / 4, 0],
  });
  t.box(o, 0.17, 0.012, 0.17, 0, 0.006, 0, {
    r: 0.004,
  });
  for (let u of [-1, 1])
    for (let h of [-1, 1])
      t.cyl(o, 0.011, 0.011, 0.012, u * 0.066, 0.017, h * 0.066, {
        seg: 6,
      });
  t.cyl(s, r + 0.006, r + 0.006, 0.02, 0, 0.022, 0, {
    seg: 14,
    open: true,
    col: [0.5, 0.48, 0.42],
  });
  return tagProp(t.group(), "bollard_post", yardPropDims("bollard_post"), [
    {
      min: [-0.085, 0, -0.085],
      max: [0.085, 1, 0.085],
      surface: "metal",
    },
  ]);
}
const SIGN_POST_DECALS = [
  "hazard_general",
  "no_entry",
  "hazard_voltage",
  "berth4",
  "arrow",
  "hazard_flammable",
];
const SIGN_POST_TEXTS = [
  "仅限授权人员",
  "禁止行人通行",
  "请穿反光服并佩戴安全帽",
  "自动作业车辆",
  "请勿靠近",
];
function buildSignPost(i: any, e: { seed?: any; sign?: any; text?: any } = {}) {
  let t = new PropBuilder(i),
    n = e.seed | 0,
    s = t.M("steel_galv"),
    o = t.M("aluminium"),
    r = t.M("paint_white"),
    a = t.M("paint_yellow"),
    l = SIGN_POST_DECALS.includes(e.sign)
      ? e.sign
      : SIGN_POST_DECALS[n % SIGN_POST_DECALS.length];
  t.box(t.M("concrete"), 0.3, 0.07, 0.3, 0, 0.03, 0, {
    r: 0.015,
  });
  t.box(s, 0.05, 2.38, 0.05, 0, 1.2, 0, {
    r: 0.006,
  });
  t.box(s, 0.058, 0.012, 0.058, 0, 2.395, 0, {
    r: 0.004,
  });
  t.box(s, 0.13, 0.012, 0.13, 0, 0.07, 0, {
    r: 0.003,
  });
  let c = ((n % 5) - 2) * 0.006;
  t.push(placeMatrix(0, 0, 0, [0, 0, c]));
  t.box(o, 0.6, 0.6, 0.004, 0, 2.02, 0.031, {
    r: 0.0015,
  });
  t.box(l.startsWith("hazard") ? a : r, 0.58, 0.58, 0.002, 0, 2.02, 0.034, {
    r: 8e-4,
  });
  t.decal(decalMaterial(i, l), 0.5, 0, 2.02, 0.0362, null, 0.5);
  t.box(o, 0.6, 0.22, 0.004, 0, 1.56, 0.031, {
    r: 0.0015,
  });
  t.box(r, 0.58, 0.2, 0.002, 0, 1.56, 0.034, {
    r: 8e-4,
  });
  t.decal(
    labelMaterial(i, e.text || SIGN_POST_TEXTS[n % SIGN_POST_TEXTS.length], {
      color: "black",
      font: "sans",
      distress: 0.15,
    }),
    0.07,
    0,
    1.56,
    0.0362,
    null,
    0.52,
  );
  for (let u of [1.85, 2.2, 1.56]) {
    t.box(s, 0.5, 0.03, 0.012, 0, u, 0.024, {
      r: 0,
    });
    t.box(s, 0.09, 0.04, 0.07, 0, u, -0.002, {
      r: 0.004,
    });
  }
  for (let [u, h] of [
    [-0.26, 2.28],
    [0.26, 2.28],
    [-0.26, 1.76],
    [0.26, 1.76],
  ])
    t.cyl(s, 0.008, 0.008, 0.004, u, h, 0.0365, {
      seg: 6,
      rot: [Math.PI / 2, 0, 0],
    });
  t.pop();
  return tagProp(t.group(), "sign_post", yardPropDims("sign_post"), [
    {
      min: [-0.03, 0, -0.03],
      max: [0.03, 2.4, 0.03],
      surface: "metal",
    },
    {
      min: [-0.3, 1.44, 0.02],
      max: [0.3, 2.33, 0.04],
      surface: "metal",
      bulletOnly: true,
    },
  ]);
}
function buildFloodlightStand(i: any, e: { seed?: any; on?: any } = {}) {
  let t = new PropBuilder(i),
    n = e.seed | 0,
    s = propRng(n + 3),
    o = t.M("paint_yellow"),
    r = t.M("steel_dark"),
    a = t.M("aluminium"),
    l = t.M("rubber"),
    c = i.mats.emissive(16773596, e.on === false ? 0.02 : 10);
  t.cyl(a, 0.021, 0.021, 1.1, 0, 0.75, 0, {
    seg: 8,
    open: true,
  });
  t.cyl(a, 0.016, 0.016, 0.9, 0, 1.6, 0, {
    seg: 8,
    open: true,
  });
  t.cyl(r, 0.03, 0.03, 0.06, 0, 1.3, 0, {
    seg: 8,
  });
  t.bar(r, [0.03, 1.3, 0], [0.085, 1.3, 0], 0.008, {
    caps: true,
  });
  t.box(r, 0.02, 0.03, 0.05, 0.09, 1.3, 0, {
    r: 0.005,
  });
  t.cyl(r, 0.032, 0.032, 0.07, 0, 0.82, 0, {
    seg: 8,
  });
  t.cyl(r, 0.03, 0.03, 0.05, 0, 0.36, 0, {
    seg: 8,
  });
  for (let d = 0; d < 3; d++) {
    let v = (d * Math.PI * 2) / 3 + 0.5,
      g = Math.cos(v),
      x = Math.sin(v);
    t.bar(a, [g * 0.035, 0.82, x * 0.035], [g * 0.5, 0.025, x * 0.5], 0.013, {
      seg: 6,
    });
    t.bar(a, [g * 0.03, 0.36, x * 0.03], [g * 0.3, 0.37, x * 0.3], 0.008, {
      seg: 5,
    });
    t.add(l, placeGeo(sphereGeo(0.028, 8, 5), g * 0.5, 0.02, x * 0.5));
  }
  t.box(r, 0.05, 0.04, 0.72, 0, 2.03, 0, {
    r: 0.008,
  });
  for (let d of [-1, 1]) {
    t.push(placeMatrix(0.03, 2.03, d * 0.2, [0, d * -0.12, 0]));
    t.push(placeMatrix(0, 0, 0, [0, 0, -0.22]));
    t.box(o, 0.075, 0.24, 0.32, 0.06, 0.02, 0, {
      r: 0.012,
    });
    t.add(
      c,
      placeGeo(planeGeo(0.28, 0.2), 0.0985, 0.02, 0, [0, Math.PI / 2, 0]),
      null,
      true,
    );
    t.box(r, 0.012, 0.25, 0.012, 0.1, 0.02, 0.157, {
      r: 0,
    });
    t.box(r, 0.012, 0.25, 0.012, 0.1, 0.02, -0.157, {
      r: 0,
    });
    t.box(r, 0.012, 0.012, 0.33, 0.1, 0.143, 0, {
      r: 0,
    });
    t.box(r, 0.012, 0.012, 0.33, 0.1, -0.103, 0, {
      r: 0,
    });
    for (let v = -3; v <= 3; v++)
      t.add(r, placeGeo(boxGeo(0.035, 0.2, 0.006), 0.008, 0.02, v * 0.043));
    t.tube(
      o,
      [
        [0.05, 0.14, -0.1],
        [0.05, 0.2, -0.06],
        [0.05, 0.2, 0.06],
        [0.05, 0.14, 0.1],
      ],
      0.008,
      {
        seg: 5,
      },
    );
    t.pop();
    t.pop();
  }
  let u = s() * Math.PI * 2,
    h = Math.cos(u),
    f = Math.sin(u);
  t.tube(
    l,
    [
      [0, 2, 0.03],
      [-0.03, 1.7, 0.04],
      [0.035, 1.25, 0.02],
      [-0.03, 0.9, 0.03],
      [0.05, 0.5, 0.06],
      [0.12, 0.08, 0.1],
      [0.25, 0.012, 0.16],
      [0.3 + h * 0.3, 0.012, 0.2 + f * 0.3],
      [0.2 + h * 0.75 - f * 0.2, 0.012, 0.1 + f * 0.75 + h * 0.2],
      [h * 1.2, 0.012, f * 1.2],
    ],
    0.011,
    {
      seg: 5,
    },
  );
  t.box(o, 0.09, 0.05, 0.06, h * 1.24, 0.026, f * 1.24, {
    r: 0.01,
    rot: [0, -u, 0],
  });
  let p = t.group();
  p.userData.lamps = [
    {
      pos: [0.14, 2.03, 0],
      dir: [0.976, -0.218, 0],
      color: 16773596,
    },
  ];
  return tagProp(p, "floodlight_stand", yardPropDims("floodlight_stand"), [
    {
      min: [-0.12, 0, -0.12],
      max: [0.12, 2.2, 0.12],
      surface: "metal",
    },
  ]);
}
const structPropDims = (i: string) => PROP_SIZES[i].slice(0, 3);
function buildStairsMetal(i: any, e = {}) {
  let t = new PropBuilder(i),
    n = t.M("diamond_plate"),
    s = t.M("steel_dark"),
    o = t.M("paint_yellow"),
    r = t.M("steel_galv"),
    a = 12,
    l = 0.2,
    c = 0.2,
    u = -1.5,
    h = 0.5,
    f = u + a * c,
    p: { min: number[]; max: number[]; surface: string }[] = [];
  for (let g = 0; g < a; g++) {
    let x = (g + 1) * l,
      y = u + g * c;
    t.box(n, 0.25, 0.03, 0.9, y + 0.125, x - 0.015, 0, {
      r: 0.005,
    });
    t.box(o, 0.035, 0.034, 0.9, y + 0.016, x - 0.015, 0, {
      r: 0.006,
    });
    for (let b of [-1, 1])
      t.box(s, 0.2, 0.05, 0.01, y + 0.13, x - 0.05, b * 0.452, {
        r: 0,
      });
    p.push({
      min: [y, 0, -h],
      max: [y + c, x, h],
      surface: "metal",
    });
  }
  for (let g of [-1, 1]) {
    t.beam(
      s,
      [u + 0.07, 0.13, g * 0.465],
      [f + 0.04, 2.5, g * 0.465],
      0.24,
      0.014,
      {
        r: 0.004,
      },
    );
    t.box(r, 0.3, 0.012, 0.12, u + 0.06, 0.006, g * 0.465, {
      r: 0,
    });
    for (let x of [-0.08, 0.1])
      t.cyl(r, 0.012, 0.012, 0.02, u + 0.06 + x, 0.02, g * 0.5, {
        seg: 6,
      });
  }
  let d = (a + 1) * l;
  t.box(n, 0.64, 0.035, 0.96, f + 0.3, d - 0.0175, 0, {
    r: 0.005,
  });
  t.box(o, 0.035, 0.038, 0.96, f + 0.016, d - 0.0175, 0, {
    r: 0.006,
  });
  for (let g of [-1, 1])
    t.box(s, 0.66, 0.16, 0.06, f + 0.3, d - 0.115, g * 0.47, {
      r: 0.008,
    });
  t.box(s, 0.06, 0.16, 0.96, 1.47, d - 0.115, 0, {
    r: 0.008,
  });
  t.box(s, 0.06, 0.12, 0.9, f + 0.02, d - 0.1, 0, {
    r: 0.008,
  });
  for (let g of [-1, 1]) {
    t.box(s, 0.08, d - 0.19, 0.08, 1.44, (d - 0.19) / 2, g * 0.45, {
      r: 0.008,
    });
    t.box(r, 0.18, 0.012, 0.18, 1.44, 0.006, g * 0.45, {
      r: 0,
    });
    t.beam(s, [1.44, 1.5, g * 0.45], [f + 0.1, d - 0.2, g * 0.45], 0.05, 0.05, {
      r: 0.006,
    });
  }
  t.beam(s, [1.44, 0.15, -0.42], [1.44, 2.2, 0.42], 0.045, 0.008, {
    r: 0,
  });
  t.beam(s, [1.44, 0.15, 0.42], [1.44, 2.2, -0.42], 0.045, 0.008, {
    r: 0,
  });
  t.box(s, 0.06, 0.06, 0.82, 1.44, 1.2, 0, {
    r: 0.006,
  });
  p.push({
    min: [f, d - 0.2, -h],
    max: [1.5, d, h],
    surface: "metal",
  });
  for (let g of [-1, 1])
    p.push({
      min: [1.4, 0, g * 0.45 - 0.04],
      max: [1.48, d - 0.2, g * 0.45 + 0.04],
      surface: "metal",
    });
  let v = (g: number) => ((g - u) / c) * l + l;
  for (let g of [-1, 1]) {
    let x = g * 0.485,
      y = [
        [u + 0.1, v(u + 0.1)],
        [u + 0.9, v(u + 0.9) - 0.1],
        [u + 1.7, v(u + 1.7) - 0.1],
        [f + 0.03, d],
        [1.47, d],
      ];
    for (let [b, m] of y) {
      t.bar(o, [b, m - 0.12, x], [b, m + 1, x], 0.019, {
        seg: 7,
      });
      t.box(s, 0.07, 0.1, 0.012, b, m - 0.1, x - g * 0.012, {
        r: 0,
      });
    }
    for (let b of [1, 0.52]) {
      let m = b === 1 ? 0.021 : 0.016;
      t.bar(o, [y[0][0], y[0][1] + b, x], [y[3][0], y[3][1] + b, x], m, {
        seg: 7,
      });
      t.bar(o, [y[3][0], y[3][1] + b, x], [y[4][0], y[4][1] + b, x], m, {
        seg: 7,
      });
      t.add(o, placeGeo(sphereGeo(m * 1.05, 7, 5), y[3][0], y[3][1] + b, x));
      t.add(o, placeGeo(sphereGeo(m * 1.05, 7, 5), y[0][0], y[0][1] + b, x));
      t.add(o, placeGeo(sphereGeo(m * 1.05, 7, 5), y[4][0], y[4][1] + b, x));
    }
    t.box(s, 0.6, 0.1, 0.008, f + 0.3, d + 0.05, g * 0.476, {
      r: 0,
    });
    p.push({
      min: [f, d, x - 0.03],
      max: [1.5, d + 1.02, x + 0.03],
      surface: "metal",
    });
  }
  return tagProp(t.group(), "stairs_metal", structPropDims("stairs_metal"), p);
}
function buildCatwalk(i: any, e: { rails?: any } = {}) {
  let t = new PropBuilder(i),
    n = t.M("steel_dark"),
    s = t.M("paint_yellow"),
    o = t.M("steel_galv"),
    r = e.rails || "both",
    a = r === "both" ? [-1, 1] : r === "left" ? [-1] : r === "right" ? [1] : [],
    l = 0.05;
  for (let u = -0.51; u <= 0.511; u += 0.034)
    t.add(o, placeGeo(boxGeo(2.98, 0.03, 0.004), 0, l - 0.015, u));
  for (let u = -1.45; u <= 1.451; u += 0.1)
    t.add(o, placeGeo(boxGeo(0.006, 0.006, 1.04), u, l - 0.004, 0));
  for (let u of [-1, 1]) {
    t.add(o, placeGeo(boxGeo(2.99, 0.032, 0.005), 0, l - 0.016, u * 0.525));
    t.add(o, placeGeo(boxGeo(0.005, 0.032, 1.05), u * 1.493, l - 0.016, 0));
  }
  for (let u of [-1, 1])
    t.box(n, 3, 0.18, 0.06, 0, l - 0.09, u * 0.565, {
      r: 0.008,
    });
  for (let u of [-1.45, -0.5, 0.5, 1.45])
    t.box(n, 0.05, 0.1, 1.08, u, l - 0.085, 0, {
      r: 0.006,
    });
  let c = [
    {
      min: [-1.5, l - 0.08, -0.6],
      max: [1.5, l, 0.6],
      surface: "metal",
    },
  ];
  for (let u of a) {
    let h = u * 0.565;
    t.box(n, 3, 0.1, 0.008, 0, l + 0.05, u * 0.535, {
      r: 0,
    });
    for (let f of [-1.42, 0, 1.42]) {
      t.box(s, 0.045, 1.07, 0.045, f, l + 0.52, h, {
        r: 0.006,
      });
      t.box(n, 0.09, 0.012, 0.09, f, l + 0.006, h, {
        r: 0,
      });
    }
    t.bar(s, [-1.5, l + 1.05, h], [1.5, l + 1.05, h], 0.021, {
      seg: 7,
      caps: true,
    });
    t.bar(s, [-1.5, l + 0.55, h], [1.5, l + 0.55, h], 0.016, {
      seg: 6,
      caps: true,
    });
    c.push({
      min: [-1.5, l, h - 0.035],
      max: [1.5, l + 1.05, h + 0.035],
      surface: "metal",
    });
  }
  return tagProp(t.group(), "catwalk", structPropDims("catwalk"), c);
}
function addRackPallet(i: any, e: any, t: number, n: number, s: number) {
  for (let o = -2; o <= 2; o++)
    i.add(
      e,
      placeGeo(
        boxGeo(0.14 + (o === 0 ? 0.02 : 0), 0.022, 1),
        t + o * 0.2525,
        n + 0.133,
        s,
      ),
    );
  for (let o of [-1, 0, 1])
    i.add(e, placeGeo(boxGeo(1.15, 0.022, 0.1), t, n + 0.111, s + o * 0.45));
  for (let o of [-1, 0, 1])
    for (let r of [-1, 0, 1])
      i.add(
        e,
        placeGeo(
          boxGeo(0.14, 0.078, 0.1),
          t + r * 0.505,
          n + 0.061,
          s + o * 0.45,
        ),
      );
  for (let o of [-1, 0, 1])
    i.add(e, placeGeo(boxGeo(1.15, 0.022, 0.1), t, n + 0.011, s + o * 0.45));
}
function addLoadedPallet(
  i: any,
  e: any,
  t: string,
  n: number,
  s: number,
  o: number,
  r: () => number,
) {
  addRackPallet(i, e.wood, n, s, o);
  let a = s + 0.144;
  if (t === "cartons") {
    let l = 2 + Math.floor(r() * 2),
      c = 0.36;
    for (let u = 0; u < l; u++)
      for (let h of [-1, 1])
        for (let f of [-1, 1]) {
          if (!(u === l - 1 && r() < 0.25)) {
            i.box(
              e.card,
              0.53,
              c - 0.006,
              0.46,
              n + h * 0.272 + (r() - 0.5) * 0.02,
              a + c * (u + 0.5),
              o + f * 0.237 + (r() - 0.5) * 0.02,
              {
                r: 0.008,
                rot: [0, (r() - 0.5) * 0.05, 0],
              },
            );
            i.add(
              e.tape,
              placeGeo(
                boxGeo(0.535, 0.002, 0.05),
                n + h * 0.272,
                a + c * (u + 1) - 0.004,
                o + f * 0.237,
              ),
            );
          }
        }
    for (let u of [-0.3, 0.3]) {
      i.add(
        e.poly,
        placeGeo(
          boxGeo(0.016, l * c + 0.004, 0.002),
          n + u,
          a + (l * c) / 2,
          o + 0.475,
        ),
      );
      i.add(
        e.poly,
        placeGeo(
          boxGeo(0.016, l * c + 0.004, 0.002),
          n + u,
          a + (l * c) / 2,
          o - 0.475,
        ),
      );
    }
  } else if (t === "wrapped") {
    let l = 0.9 + r() * 0.25;
    i.box(e.card, 1.08, l, 0.92, n, a + l / 2, o, {
      r: 0.012,
    });
    i.box(e.wrap, 1.1, l + 0.012, 0.94, n, a + l / 2 + 0.002, o, {
      r: 0.03,
    });
    for (let c of [-1, 1])
      for (let u of [-1, 1])
        i.box(
          e.card,
          0.05,
          l * 0.96,
          0.05,
          n + c * 0.535,
          a + l / 2,
          o + u * 0.455,
          {
            r: 0.004,
          },
        );
    i.decal(
      labelMaterial(i.G, "批次 " + (1e3 + Math.floor(r() * 8999)), {
        color: "black",
        font: "sans",
        distress: 0.1,
      }),
      0.06,
      n + 0.2,
      a + l * 0.7,
      o + 0.474,
      null,
      0.3,
    );
  } else if (t === "drums") {
    for (let l of [-1, 1])
      for (let c of [-1, 1]) {
        let u = n + l * 0.285,
          h = o + c * 0.24,
          f = r() < 0.3 ? e.drum2 : e.drum;
        i.cyl(f, 0.225, 0.225, 0.86, u, a + 0.43, h, {
          seg: 14,
          open: true,
        });
        for (let p of [0.29, 0.58])
          i.cyl(f, 0.233, 0.233, 0.022, u, a + p, h, {
            seg: 14,
            open: true,
          });
        i.cyl(f, 0.232, 0.232, 0.02, u, a + 0.85, h, {
          seg: 14,
          open: true,
        });
        i.cyl(f, 0.232, 0.232, 0.02, u, a + 0.01, h, {
          seg: 14,
          open: true,
        });
        i.add(
          e.dark,
          placeGeo(roundedRectPath(0.44, 0.44, 4), u, a + 0.845, h, [
            -Math.PI / 2,
            0,
            0,
          ]),
        );
        i.cyl(e.dark, 0.03, 0.03, 0.02, u + 0.13, a + 0.855, h, {
          seg: 6,
        });
      }
    i.add(e.poly, placeGeo(boxGeo(1.04, 0.03, 0.002), n, a + 0.6, o + 0.468));
    i.add(e.poly, placeGeo(boxGeo(1.04, 0.03, 0.002), n, a + 0.6, o - 0.468));
  } else if (t === "pallets") {
    let l = 2 + Math.floor(r() * 4);
    for (let c = 0; c < l; c++)
      addRackPallet(
        i,
        e.wood,
        n + (r() - 0.5) * 0.04,
        a + c * 0.146,
        o + (r() - 0.5) * 0.04,
      );
  }
}
function buildShelfRack(i: any, e: { seed?: any } = {}) {
  let t = new PropBuilder(i),
    n = e.seed | 0,
    s = propRng(n + 21),
    o = t.M("paint_blue", {
      vertexColors: true,
    }),
    r = t.M("paint_orange"),
    a = t.M("steel_galv"),
    l = {
      wood: t.M("wood_pallet"),
      card: t.M("cardboard"),
      tape: t.M("polymer_tan"),
      poly: t.M("polymer_black"),
      wrap: t.M("glass_dirty"),
      drum: t.M("plastic_blue"),
      drum2: t.M("paint_red"),
      dark: t.M("steel_dark"),
    },
    c = 4.2,
    u = 1.305,
    h = 0.5,
    f = [0.04, 0.04, 0.05];
  for (let v of [-1, 1]) {
    for (let x of [-1, 1]) {
      t.box(o, 0.09, c, 0.07, v * u, c / 2, x * h, {
        r: 0.008,
        col: (y: any, b: number) => {
          let m = 0.7 + 0.3 * smoothstep01(0, 0.5, b);
          return [m, m, m];
        },
      });
      t.box(a, 0.14, 0.01, 0.12, v * u, 0.005, x * h, {
        r: 0,
      });
      for (let y of [-0.05, 0.05])
        t.cyl(a, 0.01, 0.01, 0.02, v * u + y, 0.016, x * h, {
          seg: 6,
        });
      for (let y = 0.12; y < c - 0.05; y += 0.1)
        for (let b of [-0.022, 0.022])
          t.add(
            o,
            placeGeo(planeGeo(0.014, 0.034), v * u + b, y, x * (h + 0.0356), [
              0,
              x > 0 ? 0 : Math.PI,
              0,
            ]),
            f,
          );
    }
    let g = [0.2, 1.1, 2, 2.9, 3.8];
    for (let x = 0; x < g.length; x++) {
      t.box(o, 0.03, 0.03, 2 * h - 0.07, v * u, g[x], 0, {
        r: 0,
      });
      if (x < g.length - 1) {
        t.beam(
          o,
          [v * u, g[x], x % 2 ? h - 0.04 : -h + 0.04],
          [v * u, g[x + 1], x % 2 ? -h + 0.04 : h - 0.04],
          0.03,
          0.03,
          {
            r: 0,
          },
        );
      }
    }
    t.box(t.M("paint_yellow"), 0.14, 0.4, 0.02, v * u, 0.2, h + 0.06, {
      r: 0.006,
    });
  }
  let p = [1.45, 2.86];
  for (let v of p) {
    for (let g of [-1, 1]) {
      t.box(r, 2 * u - 0.09, 0.12, 0.05, 0, v, g * (h + 0.01), {
        r: 0.008,
      });
      for (let x of [-1, 1])
        t.box(
          r,
          0.012,
          0.2,
          0.065,
          x * (u - 0.051),
          v - 0.02,
          g * (h + 0.005),
          {
            r: 0,
          },
        );
    }
    for (let g of [-0.85, 0, 0.85])
      t.add(a, placeGeo(boxGeo(0.04, 0.025, 2 * h), g, v + 0.045, 0));
    for (let g = -0.45; g <= 0.451; g += 0.1)
      t.add(a, placeGeo(boxGeo(2 * u - 0.1, 0.005, 0.005), 0, v + 0.062, g));
    for (let g = -1.2; g <= 1.201; g += 0.2)
      t.add(a, placeGeo(boxGeo(0.005, 0.005, 2 * h + 0.04), g, v + 0.066, 0));
  }
  t.decal(
    labelMaterial(
      i,
      "货位 " + String.fromCharCode(65 + (n % 6)) + "-" + (10 + (n % 40)),
      {
        color: "black",
        font: "sans",
        distress: 0.1,
      },
    ),
    0.07,
    0,
    p[0],
    h + 0.0365,
    null,
    0.34,
  );
  t.decal(
    labelMaterial(i, "每层限重2000千克", {
      color: "black",
      font: "sans",
      distress: 0.1,
    }),
    0.045,
    0.6,
    p[1],
    h + 0.0365,
    null,
    0.5,
  );
  let d = [
    "cartons",
    "wrapped",
    "drums",
    "cartons",
    "wrapped",
    "pallets",
    "none",
  ];
  [0, p[0] + 0.068, p[1] + 0.068].forEach((v, g) => {
    for (let x of [-1, 1]) {
      let y = d[Math.floor(s() * d.length)];
      if (g === 2 && y === "drums") {
        y = "wrapped";
      }
      if (y !== "none") {
        addLoadedPallet(
          t,
          l,
          y,
          x * 0.615 + (s() - 0.5) * 0.03,
          v,
          (s() - 0.5) * 0.05,
          s,
        );
      }
    }
  });
  return tagProp(t.group(), "shelf_rack", structPropDims("shelf_rack"), [
    {
      min: [-1.35, 0, -0.55],
      max: [1.35, 4.2, 0.55],
      surface: "metal",
    },
  ]);
}
function buildReeferUnit(
  i: {
    mats: {
      emissive: (
        arg0: number,
        arg1: number,
      ) => { body: boolean | undefined; em: boolean | undefined };
    };
  },
  e: { seed?: any; flip?: any } = {},
) {
  let t = new PropBuilder(i),
    n = e.seed | 0,
    s = n * 2.3,
    o = t.M("paint_white", {
      vertexColors: true,
    }),
    r = t.M("steel_dark"),
    a = t.M("steel_galv"),
    l = t.M("paint_grey"),
    c = t.M("brass"),
    u = t.M("rubber"),
    h = t.M("aluminium"),
    f = (g: any, x: number, y: number) => {
      let b =
        (0.86 + 0.18 * valueNoise2(y * 2 + s, x * 2)) *
        (0.62 + 0.38 * smoothstep01(0, 0.6, x));
      return [b, b * 0.985, b * 0.955];
    };
  t.defCol.set(o, f);
  let p = [0.05, 0.05, 0.055];
  if (!e.flip) {
    t.push(placeMatrix(0, 0, 0, [0, Math.PI, 0]));
  }
  let d = 0.13;
  t.box(o, 0.38, 2.3, 2.3, -0.06, 1.15, 0, {
    r: 0.012,
  });
  for (let g of [-1, 1])
    t.box(o, 0.12, 2.3, 0.09, 0.19, 1.15, g * 1.105, {
      r: 0.012,
    });
  t.box(o, 0.12, 0.09, 2.12, 0.19, 2.255, 0, {
    r: 0.012,
  });
  t.box(o, 0.12, 0.1, 2.12, 0.19, 0.05, 0, {
    r: 0.012,
  });
  t.box(o, 0.1, 0.06, 2.12, 0.18, 1.42, 0, {
    r: 0.01,
  });
  t.box(o, 0.1, 0.06, 2.12, 0.18, 0.9, 0, {
    r: 0.01,
  });
  for (let g of [0.3, 0.9, 1.5, 2.1])
    for (let x of [-1, 1])
      t.cyl(a, 0.014, 0.014, 0.012, 0.255, g, x * 1.105, {
        seg: 6,
        rot: [0, 0, Math.PI / 2],
      });
  for (let g of [-0.8, -0.3, 0.3, 0.8])
    for (let x of [0.05, 2.255])
      t.cyl(a, 0.014, 0.014, 0.012, 0.255, x, g, {
        seg: 6,
        rot: [0, 0, Math.PI / 2],
      });
  for (let g of [-1, 1]) {
    let x = g * 0.53,
      y = 1.83;
    t.add(
      o,
      placeGeo(roundedRectPath(0.66, 0.66, 6), d + 0.004, y, x, [
        0,
        Math.PI / 2,
        0,
      ]),
      p,
    );
    t.cyl(o, 0.335, 0.345, 0.1, d + 0.05, y, x, {
      seg: 20,
      open: true,
      rot: [0, 0, Math.PI / 2],
    });
    t.cyl(o, 0.36, 0.36, 0.014, d + 0.006, y, x, {
      seg: 20,
      open: true,
      rot: [0, 0, Math.PI / 2],
    });
    for (let b = 0; b < 3; b++)
      t.add(
        r,
        placeGeo(boxGeo(0.012, 0.6, 0.12), d + 0.04, y, x, [
          (b * Math.PI) / 3 + g * 0.4,
          0.5,
          0,
        ]),
      );
    t.cyl(r, 0.07, 0.07, 0.06, d + 0.05, y, x, {
      seg: 10,
      rot: [0, 0, Math.PI / 2],
    });
    for (let b = 0; b < 8; b++) {
      let m = (b * Math.PI) / 4;
      t.add(
        a,
        placeGeo(boxGeo(0.005, 0.66, 0.005), d + 0.098, y, x, [m, 0, 0]),
      );
    }
    for (let b of [0.12, 0.22, 0.32])
      t.cyl(a, b, b, 0.006, d + 0.1, y, x, {
        seg: 20,
        open: true,
        rot: [0, 0, Math.PI / 2],
      });
  }
  t.decal(
    labelMaterial(i, "几猫船用制冷", {
      color: "black",
      font: "sans",
      distress: 0.2,
    }),
    0.05,
    0.2505,
    2.255,
    0,
    [0, Math.PI / 2, 0],
    1.2,
  );
  for (let g of [-1, 1]) {
    t.add(
      o,
      placeGeo(planeGeo(0.98, 0.44), d + 0.004, 1.16, g * 0.53, [
        0,
        Math.PI / 2,
        0,
      ]),
      p,
    );
    for (let x = 0; x < 9; x++)
      t.box(o, 0.06, 0.006, 0.98, d + 0.035, 0.965 + x * 0.049, g * 0.53, {
        r: 0,
        rot: [0, 0, -0.75],
      });
    t.box(o, 0.05, 0.46, 0.03, d + 0.03, 1.16, g * 0.53, {
      r: 0.005,
    });
  }
  t.add(
    o,
    placeGeo(planeGeo(1, 0.76), d + 0.004, 0.49, -0.53, [0, Math.PI / 2, 0]),
    p,
  );
  t.cyl(r, 0.15, 0.15, 0.46, d + 0.1, 0.36, -0.58, {
    seg: 14,
    open: true,
    rot: [Math.PI / 2, 0, 0],
  });
  for (let g of [-1, 1]) {
    let x = sphereGeo(0.15, 14, 6);
    x.scale(1, 1, 0.45);
    t.add(r, placeGeo(x, d + 0.1, 0.36, -0.58 + g * 0.23));
  }
  t.box(r, 0.26, 0.03, 0.5, d + 0.1, 0.19, -0.58, {
    r: 0.006,
  });
  t.cyl(h, 0.07, 0.07, 0.4, d + 0.07, 0.5, -0.17, {
    seg: 10,
  });
  t.tube(
    c,
    [
      [d + 0.1, 0.5, -0.5],
      [d + 0.1, 0.68, -0.5],
      [d + 0.08, 0.78, -0.4],
      [d + 0.08, 0.8, -0.2],
      [d + 0.07, 0.72, -0.17],
    ],
    0.012,
    {
      seg: 6,
    },
  );
  t.tube(
    c,
    [
      [d + 0.12, 0.42, -0.36],
      [d + 0.14, 0.6, -0.33],
      [d + 0.1, 0.84, -0.34],
      [d + 0.06, 0.88, -0.6],
      [d + 0.03, 0.88, -0.9],
    ],
    0.009,
    {
      seg: 6,
    },
  );
  t.tube(
    c,
    [
      [d + 0.1, 0.36, -0.82],
      [d + 0.1, 0.36, -0.93],
      [d + 0.06, 0.6, -0.96],
      [d + 0.04, 0.86, -0.96],
    ],
    0.012,
    {
      seg: 6,
    },
  );
  t.box(t.M("paint_red"), 0.04, 0.05, 0.05, d + 0.12, 0.6, -0.33, {
    r: 0.008,
  });
  let v = 0.55;
  t.box(l, 0.11, 0.56, 0.74, d + 0.055, 0.5, v, {
    r: 0.012,
  });
  t.box(l, 0.012, 0.5, 0.68, d + 0.114, 0.5, v, {
    r: 0.004,
  });
  t.add(
    r,
    placeGeo(planeGeo(0.26, 0.11), d + 0.1215, 0.66, v - 0.1, [
      0,
      Math.PI / 2,
      0,
    ]),
  );
  t.add(
    i.mats.emissive(16757850, 2.4),
    placeGeo(planeGeo(0.15, 0.05), d + 0.122, 0.665, v - 0.06, [
      0,
      Math.PI / 2,
      0,
    ]),
    null,
    true,
  );
  t.add(
    i.mats.emissive(5832570, 3),
    placeGeo(planeGeo(0.014, 0.014), d + 0.122, 0.66, v - 0.2, [
      0,
      Math.PI / 2,
      0,
    ]),
    null,
    true,
  );
  for (let g = 0; g < 4; g++)
    for (let x = 0; x < 2; x++)
      t.box(
        r,
        0.008,
        0.03,
        0.03,
        d + 0.122,
        0.5 - x * 0.045,
        v - 0.04 - g * 0.045,
        {
          r: 0.003,
        },
      );
  t.box(t.M("paint_red"), 0.03, 0.09, 0.03, d + 0.13, 0.42, v + 0.22, {
    r: 0.006,
  });
  t.cyl(a, 0.012, 0.012, 0.1, d + 0.124, 0.5, v + 0.325, {
    seg: 6,
  });
  t.decal(decalMaterial(i, "hazard_voltage"), 0.11, d + 0.1215, 0.64, v + 0.2, [
    0,
    Math.PI / 2,
    0,
  ]);
  t.tube(
    u,
    [
      [d + 0.06, 0.78, v + 0.2],
      [d + 0.06, 0.95, v + 0.25],
      [d + 0.05, 1.4, v + 0.5],
      [d + 0.05, 1.5, v - 0],
    ],
    0.012,
    {
      seg: 5,
    },
  );
  t.tube(
    u,
    [
      [d + 0.06, 0.78, v - 0.2],
      [d + 0.06, 0.92, v - 0.3],
      [d + 0.05, 0.93, -0.1],
    ],
    0.01,
    {
      seg: 5,
    },
  );
  t.cyl(a, 0.022, 0.022, 0.04, d + 0.06, 0.2, v + 0.2, {
    seg: 8,
  });
  t.tube(
    u,
    [
      [d + 0.06, 0.2, v + 0.2],
      [d + 0.08, 0.12, v + 0.1],
      [d + 0.1, 0.16, v - 0.15],
      [d + 0.1, 0.2, v - 0.3],
      [d + 0.1, 0.13, v - 0.36],
      [d + 0.09, 0.12, v - 0.1],
      [d + 0.09, 0.14, v + 0.05],
    ],
    0.016,
    {
      seg: 6,
    },
  );
  t.box(t.M("paint_blue"), 0.07, 0.07, 0.12, d + 0.09, 0.14, v + 0.1, {
    r: 0.015,
  });
  t.decal(
    decalMaterial(i, "grime_streak"),
    0.8,
    0.2512,
    0.5,
    -1.105,
    [0, Math.PI / 2, 0],
    0.08,
  );
  if (!e.flip) {
    t.pop();
  }
  return tagProp(t.group(), "reefer_unit", structPropDims("reefer_unit"), [
    {
      min: [-0.25, 0, -1.15],
      max: [0.25, 2.3, 1.15],
      surface: "metal",
    },
  ]);
}
const RELAY_LIVE_COLOR = new Color(16752680);
const RELAY_CUT_COLOR = new Color(16721940);
const RELAY_CUTTING_FLASH_COLOR = new Color(16767392);
function buildRelayNode(
  i: any,
  e: { seed?: any; id?: any; label?: any; state?: any } = {},
) {
  let t = e.seed | 0,
    n = t * 1.9,
    s = e.id || e.label || "ABC"[t % 3],
    o = new PropBuilder(i),
    r = new PropBuilder(i),
    a = new PropBuilder(i),
    l = new PropBuilder(i),
    c = o.M("paint_grey", {
      vertexColors: true,
    }),
    u = o.M("steel_dark"),
    h = o.M("steel_galv"),
    f = o.M("aluminium"),
    p = o.M("rubber"),
    d = o.M("concrete", {
      vertexColors: true,
    }),
    v = (le: number, R: number, I: number) => {
      let se =
        (0.88 + 0.2 * valueNoise2(le * 3 + n, R * 3 + I * 2)) *
        (0.6 + 0.4 * smoothstep01(0.16, 0.7, R));
      return [se, se, se * 0.98];
    };
  o.defCol.set(c, v);
  r.defCol.set(c, (le: number, R: number, I: any) => {
    let se = 0.9 + 0.14 * valueNoise2(le * 4 + n, R * 3);
    return [se, se, se];
  });
  let g = [0.035, 0.035, 0.04],
    x = {
      em: true,
    };
  o.box(d, 1.36, 0.16, 0.96, 0, 0.08, 0, {
    r: 0.025,
    col: (le: number, R: number, I: number) => {
      let se =
        0.6 +
        0.38 * smoothstep01(0, 0.15, R) +
        0.1 * valueNoise2(le * 5, I * 5);
      return [se, se, se * 0.97];
    },
  });
  o.decal(
    decalMaterial(i, "caution_stripes"),
    0.1,
    0,
    0.085,
    0.4815,
    null,
    1.2,
  );
  for (let le of [-1, 1])
    for (let R of [-1, 1]) {
      o.cyl(h, 0.016, 0.016, 0.03, le * 0.44, 0.185, R * 0.36, {
        seg: 6,
      });
      o.box(h, 0.1, 0.012, 0.1, le * 0.44, 0.166, R * 0.36, {
        r: 0,
      });
    }
  let y = -0.5,
    b = 0.5,
    m = 0.18,
    A = 1.62,
    _ = -0.3,
    M = 0.3,
    E = 0.025,
    w = (m + A) / 2,
    S = A - m;
  o.box(c, 1, S, E, 0, w, _ + E / 2, {
    r: 0.006,
  });
  for (let le of [-1, 1])
    o.box(c, E, S, 0.6, le * (0.5 - E / 2), w, 0, {
      r: 0.006,
    });
  o.box(c, 1, E, 0.6, 0, m + E / 2, 0, {
    r: 0.006,
  });
  o.box(c, 1, E, 0.6, 0, A - E / 2, 0, {
    r: 0.006,
  });
  o.box(c, E, S, 0.58, 0, w, 0, {
    r: 0.004,
  });
  o.box(c, 1, 0.12, E, 0, A - 0.06, M - E / 2, {
    r: 0.006,
  });
  o.box(c, 1, 0.07, E, 0, m + 0.035, M - E / 2, {
    r: 0.006,
  });
  o.box(u, 1.04, 0.04, 0.64, 0, m - 0.01, 0, {
    r: 0.008,
  });
  o.box(c, 1.12, 0.05, 0.74, 0, A + 0.025, 0.01, {
    r: 0.012,
  });
  for (let le of [-1, 1])
    o.tube(
      h,
      [
        [le * 0.4 - 0.04, A + 0.05, 0.2],
        [le * 0.4 - 0.03, A + 0.1, 0.2],
        [le * 0.4 + 0.03, A + 0.1, 0.2],
        [le * 0.4 + 0.04, A + 0.05, 0.2],
      ],
      0.008,
      {
        seg: 5,
      },
    );
  let z = (le: any, R: any, I: any) => [0.16, 0.16, 0.17];
  o.add(c, placeGeo(planeGeo(0.45, S - 0.06), -0.25, w, _ + E + 0.002), z);
  o.add(
    c,
    placeGeo(planeGeo(0.55, S - 0.06), y + E + 0.002, w, 0, [
      0,
      Math.PI / 2,
      0,
    ]),
    z,
  );
  o.add(
    c,
    placeGeo(planeGeo(0.55, S - 0.06), -E / 2 - 0.002, w, 0, [
      0,
      -Math.PI / 2,
      0,
    ]),
    z,
  );
  for (let le = 0; le < 5; le++) {
    let R = 0.42 + le * 0.22;
    o.box(u, 0.42, 0.17, 0.4, -0.25, R, -0.05, {
      r: 0.008,
    });
    o.box(f, 0.4, 0.02, 0.012, -0.25, R + 0.06, 0.152, {
      r: 0,
    });
    for (let I = 0; I < 4; I++)
      a.add(
        x,
        placeGeo(planeGeo(0.012, 0.012), -0.41 + I * 0.035, R - 0.04, 0.1512),
      );
    for (let I = 0; I < 3; I++)
      o.add(
        u,
        placeGeo(
          roundedRectPath(0.03, 0.022, 2),
          -0.2 + I * 0.06,
          R - 0.03,
          0.1512,
        ),
        g,
      );
  }
  let H = [p, p, p];
  for (let le = 0; le < 4; le++)
    o.tube(
      H[le % 3],
      [
        [-0.2 + (le % 3) * 0.06, 0.39 + le * 0.22, 0.15],
        [-0.14 + (le % 3) * 0.05, 0.36 + le * 0.22, 0.24],
        [-0.07, 0.55 + le * 0.22, 0.22],
        [-0.2 + ((le + 1) % 3) * 0.06, 0.61 + le * 0.22, 0.15],
      ],
      0.007,
      {
        seg: 5,
      },
    );
  let O = 0.474,
    q = 1.3,
    U = 0.9,
    T = (le: any, R: number, I: boolean) => {
      let se = R + O / 2,
        ae = 0;
      le.box(c, O, q, 0.024, se, U, ae, {
        r: 0.006,
      });
      le.box(c, O - 0.07, q - 0.07, 0.006, se, U, ae + 0.013, {
        r: 0.003,
      });
      for (let ve of [U + 0.36, U - 0.4]) {
        le.add(c, placeGeo(planeGeo(O - 0.14, 0.3), se, ve, ae + 0.0165), g);
        for (let _e = 0; _e < 7; _e++)
          le.box(
            c,
            O - 0.13,
            0.034,
            0.005,
            se,
            ve - 0.125 + _e * 0.042,
            ae + 0.027,
            {
              r: 0,
              rot: [0.75, 0, 0],
            },
          );
        le.box(c, 0.02, 0.31, 0.02, se - (O - 0.13) / 2, ve, ae + 0.022, {
          r: 0.003,
        });
        le.box(c, 0.02, 0.31, 0.02, se + (O - 0.13) / 2, ve, ae + 0.022, {
          r: 0.003,
        });
      }
      let k = I ? R + 0.07 : R + O - 0.07;
      le.box(u, 0.045, 0.2, 0.02, k, U - 0.02, ae + 0.026, {
        r: 0.006,
      });
      le.box(h, 0.028, 0.13, 0.018, k, U + 0, ae + 0.042, {
        r: 0.006,
      });
      le.cyl(h, 0.012, 0.012, 0.012, k, U - 0.09, ae + 0.04, {
        seg: 8,
        rot: [Math.PI / 2, 0, 0],
      });
      let ce = I ? R + O : R;
      for (let ve of [U - 0.5, U, U + 0.5])
        le.cyl(h, 0.011, 0.011, 0.09, ce, ve, ae + 0.016, {
          seg: 6,
        });
    };
  o.push(placeMatrix(0, 0, M - 0.004));
  T(o, 0.013, true);
  o.decal(
    labelMaterial(i, "中继 " + s, {
      color: "yellow",
      font: "stencil",
      distress: 0.15,
    }),
    0.12,
    0.013 + O / 2,
    U + 0.02,
    0.018,
    null,
    O - 0.1,
  );
  o.decal(
    labelMaterial(i, "港区主控上行链路", {
      color: "white",
      font: "sans",
      distress: 0.15,
    }),
    0.034,
    0.013 + O / 2,
    U - 0.1,
    0.018,
    null,
    O - 0.1,
  );
  o.decal(
    decalMaterial(i, "hazard_voltage"),
    0.13,
    0.013 + O / 2 + 0.1,
    U + 0.14,
    0.018,
    null,
  );
  o.pop();
  let D = [-0.487, 0, M - 0.004];
  T(r, 0, false);
  r.decal(
    decalMaterial(i, "hazard_general"),
    0.13,
    O / 2,
    U + 0.1,
    0.018,
    null,
  );
  r.box(c, O - 0.1, 0.03, 0.014, O / 2, U + 0.55, -0.018, {
    r: 0.003,
  });
  r.box(c, O - 0.1, 0.03, 0.014, O / 2, U - 0.55, -0.018, {
    r: 0.003,
  });
  r.box(c, 0.03, 1.1, 0.014, 0.07, U, -0.018, {
    r: 0.003,
  });
  r.box(c, 0.03, 1.1, 0.014, O - 0.07, U, -0.018, {
    r: 0.003,
  });
  r.box(u, 0.24, 0.3, 0.02, O / 2, U - 0.05, -0.02, {
    r: 0.004,
  });
  r.add(
    labelMaterial(i, "接线图 SLT-R4", {
      color: "white",
      font: "sans",
      distress: 0.1,
    }).material,
    placeGeo(planeGeo(0.2, 0.03), O / 2, U + 0.03, -0.0305, [0, Math.PI, 0]),
    null,
    true,
  );
  for (let le of [U + 0.36, U - 0.4])
    r.add(
      c,
      placeGeo(planeGeo(O - 0.14, 0.3), O / 2, le, -0.0125, [0, Math.PI, 0]),
      g,
    );
  r.decal(
    labelMaterial(i, "检修前请断电", {
      color: "white",
      font: "sans",
      distress: 0.15,
    }),
    0.03,
    O / 2,
    U - 0.03,
    0.018,
    null,
    O - 0.1,
  );
  for (let le of [-1, 1]) {
    o.box(f, 0.012, 0.98, 0.5, le * 0.506, 1.06, 0, {
      r: 0.003,
    });
    for (let R = -6; R <= 6; R++)
      o.add(f, placeGeo(boxGeo(0.06, 0.94, 0.007), le * 0.54, 1.06, R * 0.038));
    o.box(c, 0.075, 0.03, 0.52, le * 0.54, 1.56, 0, {
      r: 0.006,
    });
  }
  for (let le = 0; le < 3; le++) {
    let R = -0.17 + le * 0.17,
      I = 0.44 - le * 0.02,
      se = 0.86 + le * 0.07;
    o.tube(
      p,
      [
        [0.5, I, R],
        [0.6, I, R],
        [0.72 + le * 0.04, I - 0.06, R],
        [se - 0.02, 0.16, R + 0.02],
        [se, -0.03, R + 0.02],
      ],
      0.04,
      {
        seg: 8,
        tension: 0.4,
      },
    );
    o.cyl(h, 0.055, 0.055, 0.05, 0.515, I, R, {
      seg: 8,
      flat: true,
      rot: [0, 0, Math.PI / 2],
    });
    o.cyl(h, 0.06, 0.066, 0.03, se, 0.015, R + 0.02, {
      seg: 8,
    });
  }
  o.tube(
    p,
    [
      [-0.3, 0.35, _],
      [-0.3, 0.33, _ - 0.1],
      [-0.34, 0.2, _ - 0.2],
      [-0.5, 0.165, _ - 0.3],
      [-0.9, 0.02, _ - 0.36],
      [-1.5, 0.018, _ - 0.2],
    ],
    0.022,
    {
      seg: 6,
    },
  );
  o.box(u, 0.3, 0.22, 0.1, 0.2, 0.75, _ - 0.05, {
    r: 0.012,
  });
  o.tube(
    p,
    [
      [0.2, 0.86, _ - 0.06],
      [0.2, 1.2, _ - 0.04],
      [-0.1, 1.55, _ - 0.03],
      [-0.3, 1.66, -0.16],
    ],
    0.012,
    {
      seg: 5,
    },
  );
  let C = -0.3,
    G = -0.14,
    j = A + 0.05,
    N = 2.5,
    Q = [0, 1, 2].map((le) => [
      C + Math.cos(le * 2.094 + 0.52) * 0.085,
      G + Math.sin(le * 2.094 + 0.52) * 0.085,
    ]);
  o.box(h, 0.24, 0.012, 0.24, C, j + 0.006, G, {
    r: 0,
  });
  for (let le = 0; le < 3; le++) {
    let R = Q[le],
      I = Q[(le + 1) % 3];
    o.bar(h, [R[0], j, R[1]], [R[0], N, R[1]], 0.011, {
      seg: 6,
    });
    let se = 5,
      ae = (N - j) / se;
    for (let k = 0; k < se; k++) {
      o.bar(
        h,
        [R[0], j + k * ae, R[1]],
        [I[0], j + (k + 1) * ae, I[1]],
        0.005,
        {
          seg: 4,
        },
      );
      o.bar(
        h,
        [R[0], j + (k + 1) * ae, R[1]],
        [I[0], j + (k + 1) * ae, I[1]],
        0.005,
        {
          seg: 4,
        },
      );
    }
  }
  o.cyl(h, 0.11, 0.11, 0.014, C, N + 0.007, G, {
    seg: 10,
  });
  o.cyl(u, 0.05, 0.06, 0.1, C, N + 0.06, G, {
    seg: 10,
  });
  let K = (le: number, R: number, I: number) => {
    o.cyl(u, 0.016, 0.02, 0.07, le, A + 0.085, R, {
      seg: 8,
    });
    o.cyl(h, 0.011, 0.011, 0.06, le, A + 0.15, R, {
      seg: 6,
    });
    o.bar(u, [le, A + 0.17, R], [le + 0.02, I, R - 0.015], 0.005, {
      r2: 0.0018,
      seg: 5,
      caps: true,
    });
  };
  K(0.4, -0.24, 3.15);
  K(0.26, -0.24, 2.72);
  o.cyl(u, 0.03, 0.03, 0.26, 0.42, A + 0.18, 0.18, {
    seg: 8,
  });
  o.add(
    u,
    placeGeo(
      sphereGeo(0.03, 8, 4, Math.PI * 2, 0, Math.PI / 2),
      0.42,
      A + 0.31,
      0.18,
    ),
  );
  let ie = latheGeo(
    [
      [0, 0],
      [0.06, 0.006],
      [0.12, 0.024],
      [0.18, 0.054],
      [0.215, 0.078],
      [0.222, 0.078],
      [0.185, 0.05],
      [0.12, 0.016],
      [0.06, -0.003],
      [0, -0.01],
    ],
    18,
  );
  ie.computeVertexNormals();
  l.add(f, placeGeo(ie, 0, 0.3, 0.02, [Math.PI / 2 - 0.12, 0, 0]));
  l.cyl(f, 0.022, 0.03, 0.2, 0, 0.1, 0, {
    seg: 8,
  });
  l.box(f, 0.07, 0.1, 0.06, 0, 0.26, -0.02, {
    r: 0.01,
  });
  for (let le of [0.5, 2.6, 4.7])
    l.bar(
      f,
      [Math.cos(le) * 0.2, 0.3 + Math.sin(le) * 0.2, 0.09],
      [0, 0.325, 0.25],
      0.0045,
      {
        seg: 4,
      },
    );
  l.cyl(f, 0.022, 0.016, 0.05, 0, 0.325, 0.25, {
    seg: 8,
    rot: [Math.PI / 2, 0, 0],
  });
  let F = [C, N + 0.11, G];
  o.box(u, 0.9, 0.07, 0.03, 0, A - 0.06, M + 0.012, {
    r: 0.008,
  });
  a.add(x, placeGeo(planeGeo(0.84, 0.036), 0, A - 0.06, M + 0.0275));
  for (let le = 1; le < 6; le++)
    o.add(
      u,
      placeGeo(
        boxGeo(0.008, 0.05, 0.006),
        -0.42 + le * 0.14,
        A - 0.06,
        M + 0.028,
      ),
    );
  o.box(u, 0.6, 0.06, 0.03, 0, A - 0.06, _ - 0.012, {
    r: 0.008,
  });
  a.add(
    x,
    placeGeo(planeGeo(0.54, 0.03), 0, A - 0.06, _ - 0.0275, [0, Math.PI, 0]),
  );
  for (let le of [-1, 1]) {
    o.box(u, 0.03, 1.2, 0.03, le * 0.5, 0.86, M, {
      r: 0.008,
      rot: [0, Math.PI / 4, 0],
    });
    a.add(
      x,
      placeGeo(planeGeo(0.014, 1.14), le * 0.5, 0.86, M + 0.0215, [
        0,
        (le * Math.PI) / 4,
        0,
      ]).translate(le * 0.0152, 0, 0),
    );
    a.add(
      x,
      placeGeo(planeGeo(0.014, 0.9), le * 0.5715, 1.06, 0.262, [
        0,
        (le * Math.PI) / 2,
        0,
      ]),
    );
  }
  for (let le of [-1, 1]) {
    o.box(u, 0.03, 0.06, 0.46, le * 0.587, A - 0.01, 0, {
      r: 0.008,
    });
    a.add(
      x,
      placeGeo(planeGeo(0.4, 0.032), le * 0.6025, A - 0.01, 0, [
        0,
        (le * Math.PI) / 2,
        0,
      ]),
    );
  }
  o.cyl(u, 0.028, 0.028, 0.02, C + 0.2, A + 0.06, G, {
    seg: 8,
  });
  o.bar(h, [C + 0.2, A + 0.06, G], [C + 0.2, 2.64, G], 0.009, {
    seg: 6,
  });
  a.add(x, placeGeo(cylinderGeo(0.045, 0.045, 0.1, 10), C + 0.2, 2.69, G));
  o.cyl(u, 0.05, 0.05, 0.014, C + 0.2, 2.747, G, {
    seg: 10,
  });
  o.cyl(u, 0.05, 0.05, 0.014, C + 0.2, 2.633, G, {
    seg: 10,
  });
  o.decal(
    decalMaterial(i, "rust_run"),
    0.5,
    0.5135,
    0.3,
    0.2,
    [0, Math.PI / 2, 0],
    0.14,
  );
  o.decal(
    decalMaterial(i, "grime_streak"),
    0.6,
    -0.2,
    1.2,
    _ - 0.001,
    [0, Math.PI, 0],
    0.2,
  );
  let X = o.group(),
    ne = new Group();
  ne.userData.noMerge = true;
  ne.name = "relay_dynamic";
  X.add(ne);
  let re = i.mats.emissive(16752680, 4);
  re = re.clone();
  let $ = new Mesh(mergeGeos(a.buckets.get(x).geos), re);
  $.userData.noMerge = true;
  ne.add($);
  let ue = r.group().children.slice();
  for (let le of ue) {
    le.position.set(D[0], D[1], D[2]);
    le.userData.noMerge = true;
    ne.add(le);
  }
  let me = l.group().children.slice();
  for (let le of me) {
    le.position.set(F[0], F[1], F[2]);
    le.userData.noMerge = true;
    ne.add(le);
  }
  let ee = new Color(),
    B = (le: Color, R: number) => {
      if (re.userData && typeof re.userData.setEmissive == "function") {
        re.userData.setEmissive(le, R);
        return;
      }
      if (re.emissive && re.emissive.isColor && re.isMeshStandardMaterial) {
        re.emissive.copy(le);
        re.emissiveIntensity = R;
      } else if (
        re.uniforms &&
        re.uniforms.color &&
        re.uniforms.color.value &&
        re.uniforms.color.value.isColor
      ) {
        re.uniforms.color.value.copy(le).multiplyScalar(R);
        if (re.uniforms.intensity) {
          re.uniforms.intensity.value = 1;
        }
      } else if (re.color && re.color.isColor) {
        re.color.copy(le).multiplyScalar(R);
      }
    },
    P = "live",
    V = (t % 7) * 0.9,
    Y = 0,
    L = 0.7,
    Z = 0,
    J = 0,
    oe = 0,
    fe = X.userData;
  fe.state = P;
  fe.beacon = [C + 0.2, 2.68, G];
  fe.interact = [0, 1, 0.75];
  fe.emissiveMaterial = re;
  fe.level = 0;
  fe.setState = (le: string) => {
    if (!(le !== "live" && le !== "cutting" && le !== "cut")) {
      if (le !== P) {
        P = le;
        fe.state = le;
        if (le === "cut") {
          Y = 0;
          oe = 1.32;
          J = 2.5;
        }
        if (le === "live") {
          oe = 0;
        }
      }
    }
  };
  fe.update = (le: number) => {
    le = Math.min(le || 0, 0.1);
    V += le;
    let R = 0,
      I = RELAY_LIVE_COLOR,
      se = 0.7;
    if (P === "live") {
      R = 5.5 + 3 * Math.sin(V * 2.2);
    } else if (P === "cutting") {
      let ae = Math.sin(V * 2 * Math.PI * 5.5) > 0;
      R = ae ? 9 : 0.5;
      I = ae ? RELAY_CUTTING_FLASH_COLOR : RELAY_LIVE_COLOR;
      se = 2.6 + Math.sin(V * 9) * 1.5;
    } else {
      Y += le;
      I = RELAY_CUT_COLOR;
      se = 0;
      if (Y < 0.3) {
        R = 9;
      } else if (Y < 2.6) {
        let ae = 1 - (Y - 0.3) / 2.3;
        R =
          7 *
          ae *
          ae *
          (Math.sin(Y * 37) * Math.sin(Y * 13.3) > -0.2 ? 1 : 0.08);
      } else {
        R = 0;
      }
    }
    fe.level = R;
    B(ee.copy(I), R);
    L += (se - L) * Math.min(1, le * (P === "cut" ? 1.6 : 3));
    if (Math.abs(L) > 0.001) {
      for (let ae of me) ae.rotateY(L * le);
    }
    if (Math.abs(oe - Z) > 1e-4 || Math.abs(J) > 0.001) {
      J += (-(Z - oe) * 30 - J * 3.2) * le;
      let ae = Z + J * le;
      if (ae < 0) {
        ae = 0;
        J = Math.abs(J) * 0.3;
      }
      if (ae > 1.9) {
        ae = 1.9;
        J = -Math.abs(J) * 0.4;
      }
      let k = ae - Z;
      Z = ae;
      for (let ce of ue) ce.rotateY(-k);
    }
  };
  if (e.state === "cut") {
    fe.setState("cut");
    for (let le = 0; le < 80; le++) fe.update(0.05);
  } else {
    if (e.state === "cutting") {
      fe.setState("cutting");
    }
    fe.update(0);
    if (P === "live") {
      B(ee.copy(RELAY_LIVE_COLOR), 6);
    }
  }
  return tagProp(X, "relay_node", PROP_SIZES.relay_node.slice(0, 3), [
    {
      min: [-0.68, 0, -0.48],
      max: [0.68, 0.16, 0.48],
      surface: "concrete",
    },
    {
      min: [-0.57, 0.16, -0.32],
      max: [0.57, 1.67, 0.33],
      surface: "metal",
    },
    {
      min: [-0.42, 1.67, -0.26],
      max: [-0.18, 2.5, -0.02],
      surface: "metal",
      bulletOnly: true,
    },
  ]);
}
for (let i of ["container20", "container40", "container40hc"])
  registerProp(i, (e: any, t: {} | undefined) => buildContainer(e, i, t));
registerProp("jersey_barrier", buildJerseyBarrier);
registerProp("light_mast", buildLightMast);
registerProp("fence_panel", buildFencePanel);
registerProp("guard_booth", buildGuardBooth);
registerProp("gate_arm", buildGateArm);
registerProp("bollard_mooring", buildBollardMooring);
registerProp("bollard_post", buildBollardPost);
registerProp("sign_post", buildSignPost);
registerProp("floodlight_stand", buildFloodlightStand);
registerProp("stairs_metal", buildStairsMetal);
registerProp("catwalk", buildCatwalk);
registerProp("shelf_rack", buildShelfRack);
registerProp("reefer_unit", buildReeferUnit);
registerProp("relay_node", buildRelayNode);
