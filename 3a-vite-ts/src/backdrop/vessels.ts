import type { GameContext } from "../types/context";
import type {
  BoxGeometry,
  BufferGeometryEventMap,
  CylinderGeometry,
  NormalBufferAttributes,
  Vector3,
} from "three";
import {
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  TorusGeometry,
  TubeGeometry,
} from "three";
import { vertexColorGeo } from "../utils/geometry";
import {
  GeoBucket,
  axisCylinder,
  backdropMaterial,
  boxBetween,
  catenary,
  girder,
  grimeColor,
  lampGeo,
  lcgRng,
  panelGeo,
  polyStrut,
  railLine,
  strut,
  valueNoise3b,
  vec3,
} from "./kit";
import {
  SHIP_BILGE_Y,
  SHIP_BOW_Z,
  SHIP_CENTER_X,
  SHIP_DECK_Y,
  SHIP_KEEL_Y,
  SHIP_LENGTH,
  buildCrane,
  buildCraneLights,
  hullNormal,
  hullPoint,
  hullStrip,
  shipBulwarkHeightAt,
  shipBulwarkTopAt,
  shipDeckYAt,
} from "./cranes";

const MeshAccum = class {
  declare c: any;
  declare u: any;
  declare n: any;
  declare p: any;
  constructor() {
    this.p = [];
    this.n = [];
    this.u = [];
    this.c = [];
  }
  v(e: Vector3, t: Vector3, n: number, s: number, o: number[]) {
    this.p.push(e.x, e.y, e.z);
    this.n.push(t.x, t.y, t.z);
    this.u.push(n, s);
    this.c.push(o[0], o[1], o[2]);
  }
  quad(e: Vector3[], t: Vector3[], n: number[][], s: number[][]) {
    let o = e[1].clone().sub(e[0]),
      r = e[3].clone().sub(e[0]),
      a = o.cross(r).dot(t[0]) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (let l of a) this.v(e[l], t[l], n[l][0], n[l][1], s[l]);
  }
  geo() {
    let e = new BufferGeometry();
    e.setAttribute("position", new Float32BufferAttribute(this.p, 3));
    e.setAttribute("normal", new Float32BufferAttribute(this.n, 3));
    e.setAttribute("uv", new Float32BufferAttribute(this.u, 2));
    e.setAttribute("color", new Float32BufferAttribute(this.c, 3));
    return e;
  }
};
const vesselHash = (i: number, e: number) => {
  let t = Math.imul(i + 31, 374761393) ^ Math.imul(e + 17, 668265263);
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967295;
};
export function buildShip(i: GameContext, e: any) {
  let t = new GeoBucket(),
    n = backdropMaterial(i, "hull_paint"),
    s = backdropMaterial(i, "hull_red"),
    o = backdropMaterial(i, "paint_white"),
    r = i.mats.get("steel_dark"),
    a = i.mats.get("steel_galv"),
    l = i.mats.get("rope"),
    c = i.mats.get("rubber"),
    u = [2.6, 1.75, 0.95],
    h = ($: BoxGeometry) => e.add($, u, 0),
    f = (
      $: any,
      ue:
        | BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>
        | CylinderGeometry[]
        | null,
      me?: number[],
    ) => t.add($, ue, me),
    p = [0, 0.35, 0.9, 1.8, 3, 4.5, 6, 8, 10, 12, 14.5, 17, 20];
  for (let $ = 23; $ < SHIP_LENGTH - 0.5; $ += 3) p.push($);
  p.push(SHIP_LENGTH);
  let d = [0, 0.17, 0.34, 0.5, 0.66, 0.83, 1],
    v = ($: number) => {
      let ue = shipDeckYAt($),
        me = [SHIP_KEEL_Y, -2.3, -0.4, 1];
      for (let ee = 1; ee < d.length; ee++) me.push(1 + (ue - 1) * d[ee]);
      me.push(shipBulwarkTopAt($));
      return me;
    },
    g = 10,
    x = 3,
    y = new MeshAccum(),
    b = new MeshAccum(),
    m = ($: Vector3, ue: number, me: boolean, ee: number) => {
      let B = grimeColor($.x * 0.6, $.y, $.z * 0.6, undefined, 0.8),
        P = [B[0] * ee, B[1] * ee, B[2] * ee];
      if (ue < x) {
        if ($.y < -0.2) {
          P[0] *= 0.55;
          P[1] *= 0.72;
          P[2] *= 0.55;
        } else if (me) {
          P[0] *= 1.12;
          P[1] *= 1;
          P[2] *= 0.92;
        }
      } else if ($.y < 1.1) {
        P[0] *= 1.7;
        P[1] *= 1.62;
        P[2] *= 1.45;
      }
      return P;
    };
  for (let $ of [-1, 1])
    for (let ue = 0; ue < p.length - 1; ue++) {
      let me = p[ue],
        ee = p[ue + 1],
        B = v(me),
        P = v(ee);
      for (let V = 0; V < g; V++) {
        if (
          V === g - 1 &&
          shipBulwarkHeightAt(me) < 0.02 &&
          shipBulwarkHeightAt(ee) < 0.02
        ) {
          continue;
        }
        let Y =
            (V < x ? 0.8 : 0.58) +
            0.36 * vesselHash(ue * 7 + ($ > 0 ? 100 : 0), V),
          L = [
            hullPoint(me, B[V], $),
            hullPoint(ee, P[V], $),
            hullPoint(ee, P[V + 1], $),
            hullPoint(me, B[V + 1], $),
          ],
          Z = [
            hullNormal(me, B[V], $),
            hullNormal(ee, P[V], $),
            hullNormal(ee, P[V + 1], $),
            hullNormal(me, B[V + 1], $),
          ],
          J = [
            [me, B[V]],
            [ee, P[V]],
            [ee, P[V + 1]],
            [me, B[V + 1]],
          ],
          oe = [
            m(L[0], V, false, Y),
            m(L[1], V, false, Y),
            m(L[2], V, true, Y),
            m(L[3], V, true, Y),
          ];
        if (me > 1.5 && V >= 2 && V < g - 1) {
          let fe = L[0]
            .clone()
            .add(L[1])
            .add(L[2])
            .add(L[3])
            .multiplyScalar(0.25);
          for (let le = 0; le < 4; le++)
            Z[le]
              .addScaledVector(fe.clone().sub(L[le]).normalize(), 0.075)
              .normalize();
        }
        (V < x ? y : b).quad(L, Z, J, oe);
      }
    }
  {
    let $ = v(0),
      ue = v(SHIP_LENGTH),
      me = vec3(0, 0.2, 1).normalize(),
      ee = vec3(0, 0, -1),
      B = vec3(0, 1, 0);
    for (let P = 0; P < g; P++) {
      let V = P < x ? [0.8, 0.8, 0.8] : [0.9, 0.9, 0.9];
      (P < x ? y : b).quad(
        [
          hullPoint(0, $[P], -1),
          hullPoint(0, $[P], 1),
          hullPoint(0, $[P + 1], 1),
          hullPoint(0, $[P + 1], -1),
        ],
        [me, me, me, me],
        [
          [0, $[P]],
          [0.4, $[P]],
          [0.4, $[P + 1]],
          [0, $[P + 1]],
        ],
        [V, V, V, V],
      );
      (P < x ? y : b).quad(
        [
          hullPoint(SHIP_LENGTH, ue[P], -1),
          hullPoint(SHIP_LENGTH, ue[P], 1),
          hullPoint(SHIP_LENGTH, ue[P + 1], 1),
          hullPoint(SHIP_LENGTH, ue[P + 1], -1),
        ],
        [ee, ee, ee, ee],
        [
          [0, ue[P]],
          [14, ue[P]],
          [14, ue[P + 1]],
          [0, ue[P + 1]],
        ],
        [V, V, V, V],
      );
    }
    for (let P = 0; P < p.length - 1; P++) {
      let V = hullPoint(p[P], shipDeckYAt(p[P]), -1),
        Y = hullPoint(p[P], shipDeckYAt(p[P]), 1),
        L = hullPoint(p[P + 1], shipDeckYAt(p[P + 1]), 1),
        Z = hullPoint(p[P + 1], shipDeckYAt(p[P + 1]), -1),
        J = [0.75, 0.72, 0.7];
      y.quad(
        [V, Y, L, Z],
        [B, B, B, B],
        [
          [V.x, V.z],
          [Y.x, Y.z],
          [L.x, L.z],
          [Z.x, Z.z],
        ],
        [J, J, J, J],
      );
    }
  }
  f(s, y.geo());
  f(n, b.geo());
  {
    let $ = (me: number, ee: number) =>
        hullPoint(me, ee, -1).addScaledVector(hullNormal(me, ee, -1), 0.012),
      ue = [1.05, 0.92, 0.8];
    for (let me = 2; me < p.length - 1; me++) {
      let ee = v(p[me]),
        B = v(p[me + 1]);
      for (let P = 4; P <= 9; P++)
        f(n, girder($(p[me], ee[P]), $(p[me + 1], B[P]), 0.03, 0.045), ue);
      for (let P = 3; P < 9; P++) {
        if ((me + P) % 2 === 0) {
          f(n, girder($(p[me], ee[P]), $(p[me], ee[P + 1]), 0.035, 0.03), ue);
        }
      }
    }
  }
  for (let $ of [-1, 1]) {
    for (let Y = 3; Y < p.length - 1; Y++) {
      let L = (Z: number, J: number) =>
        hullPoint(Z, J, $).addScaledVector(hullNormal(Z, J, $), 0.07);
      f(
        n,
        girder(L(p[Y], 9.6), L(p[Y + 1], 9.6), 0.16, 0.3),
        [0.55, 0.55, 0.55],
      );
      if (
        shipBulwarkHeightAt(p[Y]) > 0.6 &&
        shipBulwarkHeightAt(p[Y + 1]) > 0.6
      ) {
        f(
          r,
          strut(
            hullPoint(p[Y], shipBulwarkTopAt(p[Y]), $),
            hullPoint(p[Y + 1], shipBulwarkTopAt(p[Y + 1]), $),
            0.07,
            6,
          ),
        );
      }
    }
    for (let Y = 0; Y < 3; Y++)
      f(
        r,
        strut(
          hullPoint(p[Y], shipBulwarkTopAt(p[Y]), $),
          hullPoint(p[Y + 1], shipBulwarkTopAt(p[Y + 1]), $),
          0.07,
          6,
        ),
      );
    let ue: Vector3[] = [];
    for (let Y = 18; Y <= SHIP_LENGTH - 10.4; Y += 3)
      ue.push(hullPoint(Y, shipDeckYAt(Y), $).add(vec3(-$ * 0.12, 0, 0)));
    railLine(t, r, ue, {
      h: 1.05,
      post: 1.5,
      r: 0.028,
    });
    let me = 4.6,
      ee = shipDeckYAt(me) - 2.3,
      B = hullPoint(me, ee, $),
      P = hullNormal(me, ee, $);
    f(
      r,
      strut(
        B.clone().addScaledVector(P, -0.3),
        B.clone().addScaledVector(P, 0.22),
        0.5,
        12,
        true,
      ),
    );
    let V = (Y: number, L: number, Z: number) =>
      hullPoint(Y, L, $).addScaledVector(hullNormal(Y, L, $), Z);
    f(r, girder(V(me, ee - 0.1, 0.34), V(me, ee - 2.3, 0.3), 0.22, 0.22, 0.03));
    f(
      r,
      girder(
        V(me - 0.95, ee - 2.45, 0.34),
        V(me + 0.95, ee - 2.45, 0.34),
        0.42,
        0.42,
        0.05,
      ),
    );
    for (let Y of [-0.8, 0.8])
      f(
        r,
        girder(
          V(me + Y, ee - 2.4, 0.3),
          V(me + Y * 1.1, ee - 1.1, 0.34),
          0.5,
          0.12,
          0.02,
        ),
      );
  }
  let A = i.mats.label("几猫撤离艇", {
    color: "white",
    font: "sans",
    distress: 0.3,
  });
  {
    let ue = Math.min(12, 1.7 * Math.max(2, A.aspect || 6));
    f(
      A.material,
      hullStrip(7.6, 7.6 + ue, 10.25, 10.25 + 1.7, -1, 0.014, 10, 1),
    );
    f(
      A.material,
      hullStrip(7.6, 7.6 + ue, 10.25, 10.25 + 1.7, 1, 0.014, 10, 1),
    );
  }
  let _ = i.mats.decal("rust_run");
  f(
    _.material,
    hullStrip(
      4.6 - 0.8,
      4.6 + 0.8,
      shipDeckYAt(4.6) - 9.5,
      shipDeckYAt(4.6) - 2.6,
      -1,
      0.012,
      2,
      3,
    ),
  );
  for (let $ = 21.5; $ < SHIP_LENGTH - 11; $ += 5.5) {
    let ue = hullPoint($, SHIP_DECK_Y - 0.45, -1);
    f(
      r,
      boxBetween(
        ue.x - 0.04,
        ue.y - 0.09,
        ue.z - 0.3,
        ue.x + 0.01,
        ue.y + 0.09,
        ue.z + 0.3,
      ),
    );
    let me = 2.6 + 3.2 * vesselHash(Math.round($ * 10), 5);
    f(
      _.material,
      hullStrip(
        $ - 0.45,
        $ + 0.45,
        SHIP_DECK_Y - 0.5 - me,
        SHIP_DECK_Y - 0.5,
        -1,
        0.012,
        1,
        1,
      ),
    );
  }
  for (let $ of [6.4, SHIP_LENGTH - 7])
    for (let ue = 0; ue < 9; ue++) {
      let me = 1.6 + ue * 0.62;
      f(
        o,
        hullStrip($, $ + (ue % 2 ? 0.28 : 0.5), me, me + 0.13, -1, 0.01, 1, 1),
        [1.1, 1.1, 1.05],
      );
    }
  f(o, hullStrip(33, 33.9, 3.2, 3.3, -1, 0.01, 1, 1), [1.1, 1.1, 1.05]);
  f(o, hullStrip(33.4, 33.5, 2.4, 4.1, -1, 0.01, 1, 1), [1.1, 1.1, 1.05]);
  let M = shipDeckYAt(7);
  for (let $ of [-1, 1]) {
    f(
      r,
      axisCylinder(
        0.55,
        0.55,
        0.9,
        "x",
        SHIP_CENTER_X + $ * 1.5,
        M + 0.75,
        SHIP_BOW_Z - 6.2,
        12,
      ),
    );
    f(
      r,
      boxBetween(
        SHIP_CENTER_X + $ * 0.5,
        M,
        SHIP_BOW_Z - 6.9,
        SHIP_CENTER_X + $ * 2.6,
        M + 0.5,
        SHIP_BOW_Z - 5.5,
        0.04,
      ),
    );
    for (let ue of [0, 0.7])
      f(
        r,
        axisCylinder(
          0.16,
          0.16,
          0.7,
          "y",
          SHIP_CENTER_X + $ * 4.2,
          M + 0.35,
          SHIP_BOW_Z - 8.5 - ue,
          8,
        ),
      );
  }
  let E = SHIP_BOW_Z - 10.5,
    w = M + 15;
  f(
    o,
    axisCylinder(0.26, 0.42, 15, "y", SHIP_CENTER_X, M + 7.5, E, 10),
    [0.85, 0.8, 0.7],
  );
  f(
    o,
    boxBetween(
      SHIP_CENTER_X - 2.6,
      M + 10,
      E - 0.12,
      SHIP_CENTER_X + 2.6,
      M + 10.24,
      E + 0.12,
    ),
    [0.85, 0.8, 0.7],
  );
  f(r, strut([SHIP_CENTER_X, w, E], [SHIP_CENTER_X, w + 2.4, E], 0.03, 5));
  for (let $ of [-1, 1]) {
    f(
      r,
      strut(
        [SHIP_CENTER_X + $ * 2.5, M + 10.2, E],
        [SHIP_CENTER_X + $ * 5.6, M + 0.6, E - 1.2],
        0.022,
        4,
      ),
    );
    f(
      r,
      strut(
        [SHIP_CENTER_X + $ * 2.5, M + 10.2, E],
        [SHIP_CENTER_X, w, E],
        0.02,
        4,
      ),
    );
  }
  f(
    r,
    strut(
      [SHIP_CENTER_X, w, E],
      [SHIP_CENTER_X, shipBulwarkTopAt(0) + 0.3, SHIP_BOW_Z - 0.4],
      0.022,
      4,
    ),
  );
  f(
    r,
    strut(
      [SHIP_CENTER_X, shipBulwarkTopAt(0), SHIP_BOW_Z - 0.3],
      [SHIP_CENTER_X, shipBulwarkTopAt(0) + 2.6, SHIP_BOW_Z - 0.15],
      0.03,
      5,
    ),
  );
  let S = vec3(SHIP_CENTER_X, M + 2.2, E - 0.5),
    z = vec3(SHIP_CENTER_X + 1.2, M + 9.5, E - 11.5);
  f(o, strut(S, z, 0.2, 8, true), [0.85, 0.8, 0.7]);
  f(r, strut(z, [SHIP_CENTER_X, w - 0.4, E], 0.022, 4));
  f(r, strut(z, [z.x, SHIP_DECK_Y + 4, z.z], 0.018, 4));
  f(
    r,
    boxBetween(
      z.x - 0.18,
      SHIP_DECK_Y + 3.4,
      z.z - 0.18,
      z.x + 0.18,
      SHIP_DECK_Y + 4,
      z.z + 0.18,
      0.04,
    ),
  );
  e.add(lampGeo(SHIP_CENTER_X, w - 0.6, E + 0.5, 0.14), [5, 4.6, 3.8], 0);
  let H = [
    [0.62, 0.17, 0.13],
    [0.17, 0.29, 0.5],
    [0.2, 0.42, 0.3],
    [0.78, 0.36, 0.12],
    [0.8, 0.62, 0.16],
    [0.82, 0.83, 0.8],
    [0.4, 0.43, 0.47],
    [0.16, 0.42, 0.45],
  ];
  [
    [-45.6, 12.19],
    [-32.7, 12.19],
    [-22.8, 6.06],
  ].forEach(([$, ue], me) => {
    f(
      s,
      boxBetween(
        SHIP_CENTER_X - 7.7,
        SHIP_DECK_Y,
        $ - ue / 2 - 0.2,
        SHIP_CENTER_X + 7.7,
        SHIP_DECK_Y + 0.42,
        $ + ue / 2 + 0.2,
        0.04,
      ),
      [0.6, 0.6, 0.62],
    );
    for (let ee = 0; ee < 6; ee++) {
      let B = SHIP_CENTER_X + (ee - 2.5) * 2.52,
        P = me === 2 ? 2 : 2 + (vesselHash(ee * 3 + me, 9) > 0.4 ? 1 : 0);
      for (let V = 0; V < P; V++) {
        let Y = SHIP_DECK_Y + 0.44 + V * 2.61,
          L =
            H[Math.floor(vesselHash(ee * 5 + V * 13 + me * 29, 2) * H.length)];
        f(
          o,
          boxBetween(
            B - 1.22,
            Y,
            $ - ue / 2,
            B + 1.22,
            Y + 2.59,
            $ + ue / 2,
            0.035,
          ),
          L,
        );
        if (ee === 0) {
          for (let Z = $ - ue / 2 + 0.5; Z < $ + ue / 2 - 0.3; Z += 0.58)
            f(
              o,
              boxBetween(
                B - 1.24,
                Y + 0.15,
                Z - 0.1,
                B - 1.21,
                Y + 2.45,
                Z + 0.1,
              ),
              L,
            );
        }
      }
    }
    for (let ee of [$ - ue / 2 - 0.45, $ + ue / 2 + 0.45]) {
      for (let B = 0; B <= 6; B++)
        f(
          r,
          boxBetween(
            SHIP_CENTER_X + (B - 3) * 2.52 - 0.05,
            SHIP_DECK_Y,
            ee - 0.05,
            SHIP_CENTER_X + (B - 3) * 2.52 + 0.05,
            SHIP_DECK_Y + 5.6,
            ee + 0.05,
          ),
        );
      for (let B of [SHIP_DECK_Y + 2.9, SHIP_DECK_Y + 5.6])
        f(
          r,
          boxBetween(
            SHIP_CENTER_X - 7.6,
            B - 0.05,
            ee - 0.12,
            SHIP_CENTER_X + 7.6,
            B + 0.05,
            ee + 0.12,
          ),
        );
    }
  });
  let q = [0.92, 0.93, 0.92],
    U = -53,
    T = -66.5;
  [
    [7.2, 13, 15.9, 0],
    [6.7, 15.9, 18.7, 0.5],
    [6.3, 18.7, 21.5, 1],
    [6.5, 21.5, 24.4, 1.5],
  ].forEach(([$, ue, me, ee], B) => {
    f(
      o,
      boxBetween(
        SHIP_CENTER_X - $,
        ue,
        T + ee * 0.4,
        SHIP_CENTER_X + $,
        me,
        U - ee,
        0.08,
      ),
      q,
    );
    f(
      o,
      boxBetween(
        SHIP_CENTER_X - $ - 0.7,
        me - 0.06,
        T + ee * 0.4 - 0.3,
        SHIP_CENTER_X + $ + 0.7,
        me + 0.06,
        U - ee + 1,
      ),
      [0.7, 0.72, 0.72],
    );
    let P = me + 0.06,
      V = SHIP_CENTER_X - $ - 0.67,
      Y = SHIP_CENTER_X + $ + 0.67,
      L = U - ee + 0.97,
      Z = T + ee * 0.4 - 0.27;
    railLine(
      t,
      a,
      [
        [V, P, Z],
        [V, P, L],
        [Y, P, L],
        [Y, P, Z],
      ],
      {
        h: 1.05,
        post: 1.6,
        r: 0.026,
      },
    );
    if (B < 3) {
      for (let J = U - ee - 1.2, oe = 0; J > T + 1.5; J -= 1.45, oe++) {
        let fe = vesselHash(oe * 3 + B * 11, 4) > 0.8;
        for (let le of [-1, 1]) {
          let R = boxBetween(
            SHIP_CENTER_X + le * ($ + 0.012) - 0.012,
            ue + 1.25,
            J - 0.33,
            SHIP_CENTER_X + le * ($ + 0.012) + 0.012,
            ue + 1.85,
            J + 0.33,
          );
          if (fe && le < 0) {
            h(R);
          } else {
            f(r, R);
          }
        }
      }
    }
    if (B < 3) {
      for (
        let J = SHIP_CENTER_X - $ + 1, oe = 0;
        J < SHIP_CENTER_X + $ - 0.6;
        J += 1.5, oe++
      ) {
        let fe = boxBetween(
          J - 0.33,
          ue + 1.25,
          U - ee - 0.01,
          J + 0.33,
          ue + 1.85,
          U - ee + 0.014,
        );
        if (vesselHash(oe + B * 7, 8) > 0.84) {
          h(fe);
        } else {
          f(r, fe);
        }
      }
    }
  });
  let C = 21.5,
    G = U - 1.5,
    j = 6.5;
  f(
    r,
    boxBetween(
      SHIP_CENTER_X - j + 0.2,
      C + 1.3,
      G - 0.01,
      SHIP_CENTER_X + j - 0.2,
      C + 2.25,
      G + 0.02,
    ),
  );
  for (
    let $ = SHIP_CENTER_X - j + 0.75, ue = 0;
    $ < SHIP_CENTER_X + j - 0.4;
    $ += 1.05, ue++
  ) {
    if (vesselHash(ue, 21) > 0.62) {
      h(boxBetween($ - 0.44, C + 1.36, G + 0.02, $ + 0.44, C + 2.19, G + 0.03));
    }
    f(o, boxBetween($ + 0.48, C + 1.3, G, $ + 0.57, C + 2.25, G + 0.04), q);
  }
  for (let $ of [-1, 1]) {
    f(
      r,
      boxBetween(
        SHIP_CENTER_X + $ * j - 0.02,
        C + 1.3,
        G - 5,
        SHIP_CENTER_X + $ * j + 0.02,
        C + 2.25,
        G - 0.2,
      ),
    );
    f(
      o,
      boxBetween(
        SHIP_CENTER_X + $ * 6.4,
        C - 0.12,
        G - 3.4,
        SHIP_CENTER_X + $ * 8.3,
        C + 0.02,
        G + 0.9,
        0.03,
      ),
      q,
    );
    f(
      o,
      boxBetween(
        SHIP_CENTER_X + $ * 8.22,
        C,
        G - 3.4,
        SHIP_CENTER_X + $ * 8.3,
        C + 1.1,
        G + 0.9,
      ),
      q,
    );
    f(
      o,
      boxBetween(
        SHIP_CENTER_X + $ * 6.5,
        C,
        G + 0.82,
        SHIP_CENTER_X + $ * 8.3,
        C + 1.1,
        G + 0.9,
      ),
      q,
    );
    f(
      r,
      girder(
        [SHIP_CENTER_X + $ * 6.6, C - 2.6, G - 1.2],
        [SHIP_CENTER_X + $ * 8.1, C - 0.1, G - 1.2],
        0.12,
        0.12,
      ),
    );
    e.add(
      lampGeo(SHIP_CENTER_X + $ * 8.25, C + 1.35, G - 0.4, 0.13),
      $ < 0 ? [0.3, 5, 1.6] : [6, 0.4, 0.3],
      0,
    );
  }
  h(
    boxBetween(
      SHIP_CENTER_X - 2.2,
      24.42,
      G + 0.6,
      SHIP_CENTER_X - 1.6,
      24.52,
      G + 0.9,
    ),
  );
  h(
    boxBetween(
      SHIP_CENTER_X + 1.6,
      24.42,
      G + 0.6,
      SHIP_CENTER_X + 2.2,
      24.52,
      G + 0.9,
    ),
  );
  let N = vec3(SHIP_CENTER_X, 24.46, -57.5);
  f(o, axisCylinder(0.16, 0.28, 8.5, "y", N.x, N.y + 4.25, N.z, 8), q);
  f(
    o,
    boxBetween(
      N.x - 2.4,
      N.y + 5.2,
      N.z - 0.08,
      N.x + 2.4,
      N.y + 5.36,
      N.z + 0.08,
    ),
    q,
  );
  f(
    o,
    boxBetween(
      N.x - 1.3,
      N.y + 7.3,
      N.z - 0.06,
      N.x + 1.3,
      N.y + 7.42,
      N.z + 0.06,
    ),
    q,
  );
  f(
    o,
    boxBetween(N.x - 0.5, N.y + 3.2, N.z, N.x + 0.5, N.y + 3.3, N.z + 1.2),
    q,
  );
  for (let $ of [-2.3, -1.2, 1.2, 2.3])
    f(
      r,
      strut(
        [N.x + $, N.y + 5.36, N.z],
        [N.x + $, N.y + 5.36 + (Math.abs($) > 2 ? 3.2 : 1.2), N.z],
        0.012,
        4,
      ),
    );
  f(r, strut([N.x, N.y + 8.5, N.z], [N.x, N.y + 10.8, N.z], 0.015, 4));
  for (let $ of [-1, 1])
    f(
      r,
      strut(
        [N.x + $ * 2.3, N.y + 5.3, N.z],
        [SHIP_CENTER_X + $ * 6, 24.5, T + 2],
        0.014,
        4,
      ),
    );
  e.add(lampGeo(N.x, N.y + 8.7, N.z + 0.3, 0.14), [5, 4.6, 3.8], 0);
  e.add(lampGeo(N.x, N.y + 7.6, N.z, 0.12), [8, 0.4, 0.25], 3.4, 0.6, 0.4);
  let Q = -62.6;
  f(
    o,
    boxBetween(
      SHIP_CENTER_X - 1.7,
      24.4,
      Q - 2.3,
      SHIP_CENTER_X + 1.7,
      29.3,
      Q + 2.1,
      0.25,
    ),
    [0.2, 0.34, 0.5],
  );
  f(
    o,
    boxBetween(
      SHIP_CENTER_X - 1.72,
      27.2,
      Q - 2.32,
      SHIP_CENTER_X + 1.72,
      28.1,
      Q + 2.12,
      0.1,
    ),
    [0.9, 0.88, 0.8],
  );
  f(
    o,
    boxBetween(
      SHIP_CENTER_X - 1.75,
      29.3,
      Q - 2.35,
      SHIP_CENTER_X + 1.75,
      30.3,
      Q + 2.15,
      0.2,
    ),
    [0.07, 0.07, 0.08],
  );
  for (let $ of [-0.9, 0.5])
    f(r, axisCylinder(0.28, 0.28, 1.1, "y", SHIP_CENTER_X, 30.7, Q + $, 10));
  let K = i.mats.decal("logo_b");
  f(
    K.material,
    panelGeo(
      2.6,
      2.6 / Math.max(1, K.aspect || 1),
      SHIP_CENTER_X - 1.705,
      26.1,
      Q - 0.1,
      -Math.PI / 2,
    ),
  );
  {
    let $ = SHIP_CENTER_X - 7.9,
      ue = 17.5,
      me = -61,
      ee = [1.25, 0.42, 0.1],
      B = new CapsuleGeometry(1.15, 3.6, 4, 12);
    B.rotateX(Math.PI / 2);
    B.scale(0.95, 0.82, 1);
    B.translate($, ue, me);
    f(o, B, ee);
    f(
      o,
      boxBetween(
        $ - 0.6,
        ue + 0.7,
        me - 1.2,
        $ + 0.6,
        ue + 1.25,
        me + 0.9,
        0.12,
      ),
      ee,
    );
    for (let P of [-2.1, 2.1]) {
      f(
        r,
        girder(
          [SHIP_CENTER_X - 6.9, 15.9, me + P],
          [$ - 0.2, ue + 2.3, me + P],
          0.16,
          0.22,
        ),
      );
      f(
        r,
        strut(
          [$ - 0.2, ue + 2.2, me + P],
          [$, ue + 0.9, me + P * 0.8],
          0.02,
          4,
        ),
      );
    }
  }
  f(
    r,
    strut(
      [
        SHIP_CENTER_X,
        shipBulwarkTopAt(SHIP_LENGTH),
        SHIP_BOW_Z - SHIP_LENGTH + 0.4,
      ],
      [
        SHIP_CENTER_X,
        shipBulwarkTopAt(SHIP_LENGTH) + 3.4,
        SHIP_BOW_Z - SHIP_LENGTH - 0.3,
      ],
      0.03,
      5,
    ),
  );
  e.add(
    lampGeo(
      SHIP_CENTER_X,
      shipBulwarkTopAt(SHIP_LENGTH) + 0.6,
      SHIP_BOW_Z - SHIP_LENGTH - 0.1,
      0.1,
    ),
    [4, 3.7, 3],
    0,
  );
  {
    let $ = vec3(32.55, 13, -51.5),
      ue = vec3(31.4, 1.25, -38.5);
    for (let me of [-0.4, 0.4]) {
      f(
        a,
        girder(
          [$.x + me, $.y - 0.1, $.z],
          [ue.x + me, ue.y - 0.1, ue.z],
          0.05,
          0.3,
        ),
      );
      f(
        a,
        strut([$.x + me, $.y + 1, $.z], [ue.x + me, ue.y + 1, ue.z], 0.025, 5),
      );
      f(
        a,
        strut(
          [$.x + me, $.y + 0.5, $.z],
          [ue.x + me, ue.y + 0.5, ue.z],
          0.02,
          4,
        ),
      );
    }
    for (let me = 0; me <= 8; me++) {
      let ee = $.clone().lerp(ue, me / 8);
      for (let B of [-0.4, 0.4])
        f(
          a,
          strut(
            [ee.x + B, ee.y - 0.1, ee.z],
            [ee.x + B, ee.y + 1, ee.z],
            0.02,
            4,
          ),
        );
    }
    for (let me = 1; me < 44; me++) {
      let ee = $.clone().lerp(ue, me / 44);
      f(
        a,
        boxBetween(
          ee.x - 0.38,
          ee.y - 0.02,
          ee.z - 0.12,
          ee.x + 0.38,
          ee.y,
          ee.z + 0.12,
        ),
      );
    }
    f(a, boxBetween(31, 1.15, -38.5, 32, 1.2, -37.3));
    f(a, girder([31.2, 1.2, -37.9], [29.2, 0.12, -37.9], 0.8, 0.06));
    railLine(
      t,
      a,
      [
        [31, 1.2, -37.32],
        [32, 1.2, -37.32],
        [32, 1.2, -38.5],
      ],
      {
        post: 1.1,
      },
    );
    f(
      r,
      strut(
        [$.x, $.y + 3.2, $.z + 4],
        [ue.x, ue.y + 1.2, ue.z + 0.3],
        0.014,
        4,
      ),
    );
    f(r, girder([33.2, 13.2, $.z + 4], [32.2, 16.4, $.z + 4], 0.14, 0.14));
  }
  let ie = ($: number, ue: number, me: Vector3, ee: number) => {
    let B = hullPoint($, ue, -1);
    B.x -= 0.1;
    f(l, polyStrut(catenary(B, me, ee, 12), 0.042, 5));
    let P = catenary(B, me, ee, 12)[3],
      V = catenary(B, me, ee, 12)[4].clone().sub(P).normalize(),
      Y = axisCylinder(0.42, 0.42, 0.012, "y", 0, 0, 0, 12);
    Y.applyQuaternion(new Quaternion().setFromUnitVectors(vec3(0, 1, 0), V));
    Y.translate(P.x, P.y, P.z);
    f(a, Y);
    f(
      r,
      boxBetween(
        B.x - 0.12,
        B.y - 0.28,
        B.z - 0.35,
        B.x + 0.12,
        B.y + 0.28,
        B.z + 0.35,
        0.05,
      ),
    );
  };
  ie(4.4, shipDeckYAt(4.4) + 0.55, vec3(29.2, 0.5, -12), 1.3);
  ie(4.9, shipDeckYAt(4.9) + 0.55, vec3(29.2, 0.36, -12.1), 1.7);
  ie(1.6, shipDeckYAt(1.6) + 0.6, vec3(29.2, 0.5, -2), 1.6);
  ie(2.2, shipDeckYAt(2.2) + 0.6, vec3(29.2, 0.36, -2.1), 2.2);
  ie(
    SHIP_LENGTH - 5,
    shipDeckYAt(SHIP_LENGTH - 5) + 0.6,
    vec3(29.2, 0.5, -82),
    1.6,
  );
  ie(
    SHIP_LENGTH - 9,
    shipDeckYAt(SHIP_LENGTH - 9) + 0.6,
    vec3(29.2, 0.45, -58),
    1.2,
  );
  for (let $ of [-82, -58]) {
    f(r, axisCylinder(0.2, 0.26, 0.55, "y", 29.2, 0.27, $, 10));
    f(r, axisCylinder(0.34, 0.3, 0.14, "y", 29.2, 0.6, $, 10));
  }
  for (let $ of [-17.6, -37, -54]) {
    f(c, axisCylinder(1.25, 1.25, 2.2, "z", 31.55, SHIP_BILGE_Y + 0.35, $, 14));
    f(
      c,
      axisCylinder(
        0.45,
        1.25,
        0.5,
        "z",
        31.55,
        SHIP_BILGE_Y + 0.35,
        $ + 1.35,
        14,
      ),
    );
    f(
      c,
      axisCylinder(
        1.25,
        0.45,
        0.5,
        "z",
        31.55,
        SHIP_BILGE_Y + 0.35,
        $ - 1.35,
        14,
      ),
    );
    f(l, strut([31.55, SHIP_BILGE_Y + 1.6, $], [29.9, 0.1, $ + 0.6], 0.03, 4));
  }
  let F = t.build({
    cast: true,
    recv: true,
  });
  F.name = "ship";
  let X = new GeoBucket();
  X.add(o, boxBetween(-1.25, -0.07, -0.1, 1.25, 0.07, 0.1, 0.02), q);
  X.add(o, axisCylinder(0.1, 0.12, 0.25, "y", 0, -0.18, 0, 8), q);
  let ne = X.build({
    cast: false,
  });
  ne.position.set(N.x, N.y + 3.62, N.z + 0.8);
  ne.userData.noMerge = true;
  F.add(ne);
  let re = [
    {
      min: [33, -5, SHIP_BOW_Z - SHIP_LENGTH],
      max: [49, 15, -17.5],
    },
    {
      min: [34.9, -5, -17.5],
      max: [47.1, 15.5, -13],
    },
    {
      min: [37.7, -5, -13],
      max: [44.3, 16, -9.3],
    },
    {
      min: [SHIP_CENTER_X - 7.2, 13, T],
      max: [SHIP_CENTER_X + 7.2, 24.4, U],
    },
  ];
  return {
    root: F,
    radar: ne,
    colliders: re,
    tris: t.tris,
    name: "几猫撤离艇",
  };
}
export function buildTugboat(i: GameContext, e: any) {
  let t = new GeoBucket(),
    n = backdropMaterial(i, "plastic_grey"),
    s = backdropMaterial(i, "paint_orange"),
    o = i.mats.get("polymer_black"),
    r = i.mats.get("steel_galv"),
    a = i.mats.get("glass"),
    l = (
      U: any,
      T:
        | BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>
        | CylinderGeometry[]
        | null,
      D?: number[],
    ) => t.add(U, T, D),
    c = [2, 2.02, 2.08],
    u = [0.5, 0.5, 0.52],
    h = [1.9, 1.7, 1.2],
    f = [
      [-3.35, 0.5, 1.03],
      [-1.6, 0.5, 1.06],
      [0.5, 0.52, 1.05],
      [1.8, 0.58, 0.93],
      [2.75, 0.68, 0.6],
      [3.3, 0.78, 0.22],
    ],
    p = [
      ...f.map((U) => vec3(U[0], U[1], U[2])),
      vec3(3.43, 0.8, 0),
      ...f
        .slice()
        .reverse()
        .map((U) => vec3(U[0], U[1], -U[2])),
    ],
    d = new CatmullRomCurve3(p, false, "centripetal"),
    v = new TubeGeometry(d, 60, 0.27, 12, false);
  {
    let U = v.attributes.uv,
      T = d.getLength();
    for (let D = 0; D < U.count; D++)
      U.setXY(D, U.getX(D) * T, U.getY(D) * 1.7);
  }
  l(n, v, c);
  for (let U of [-1, 1])
    l(n, axisCylinder(0.07, 0.27, 0.42, "x", -3.56, 0.5, U * 1.03, 12), c);
  let g = 11,
    x: Vector3[] = [];
  for (let U = 0; U < g; U++) {
    let T = 0.04 + (0.92 * U) / (g - 1),
      D = d.getPointAt(T),
      C = d.getTangentAt(T),
      G = new TorusGeometry(0.276, 0.016, 5, 14);
    G.applyQuaternion(new Quaternion().setFromUnitVectors(vec3(0, 0, 1), C));
    G.translate(D.x, D.y, D.z);
    l(n, G, u);
    let j = vec3(D.x, 0, D.z)
      .sub(vec3(Math.min(D.x, 2.2), 0, 0))
      .normalize();
    x.push(
      D.clone()
        .addScaledVector(j, 0.2)
        .add(vec3(0, 0.2, 0)),
    );
  }
  for (let U = 0; U < g - 1; U++)
    l(n, polyStrut(catenary(x[U], x[U + 1], 0.1, 4), 0.012, 4), h);
  let y = [-3.4, -2, -0.5, 1, 2, 2.8, 3.3],
    b = [0.9, 0.93, 0.93, 0.85, 0.62, 0.34, 0.08],
    m = [0.22, 0.22, 0.24, 0.3, 0.42, 0.56, 0.7],
    A = [-0.3, -0.32, -0.33, -0.3, -0.15, 0.15, 0.62],
    _: number[] = [],
    M = (U: Vector3, T: Vector3, D: Vector3) => {
      let C = T.clone().sub(U).cross(D.clone().sub(U)),
        G = U.clone()
          .add(T)
          .add(D)
          .multiplyScalar(1 / 3),
        j = vec3(0, G.y - 0.45, G.z);
      if (Math.abs(G.x) > 3.39) {
        j.set(G.x, 0, 0);
      }
      if (C.dot(j) < 0) {
        _.push(U.x, U.y, U.z, D.x, D.y, D.z, T.x, T.y, T.z);
      } else {
        _.push(U.x, U.y, U.z, T.x, T.y, T.z, D.x, D.y, D.z);
      }
    };
  for (let U of [-1, 1]) {
    for (let T = 0; T < y.length - 1; T++) {
      let D = vec3(y[T], A[T], 0),
        C = vec3(y[T + 1], A[T + 1], 0),
        G = vec3(y[T], m[T], U * b[T]),
        j = vec3(y[T + 1], m[T + 1], U * b[T + 1]),
        N = vec3(y[T], 0.5 + Math.max(0, m[T] - 0.22) * 0.6, U * (b[T] + 0.1)),
        Q = vec3(
          y[T + 1],
          0.5 + Math.max(0, m[T + 1] - 0.22) * 0.6,
          U * (b[T + 1] + 0.1),
        );
      M(D, C, j);
      M(D, j, G);
      M(G, j, Q);
      M(G, Q, N);
    }
    M(
      vec3(-3.4, A[0], 0),
      vec3(-3.4, m[0], U * b[0]),
      vec3(-3.4, 0.78, U * (b[0] + 0.1)),
    );
    M(
      vec3(-3.4, A[0], 0),
      vec3(-3.4, 0.78, U * (b[0] + 0.1)),
      vec3(-3.4, 0.78, 0),
    );
  }
  let E = new BufferGeometry();
  E.setAttribute("position", new Float32BufferAttribute(_, 3));
  E.computeVertexNormals();
  l(o, E);
  l(n, boxBetween(-3.38, 0.2, -0.86, 2.1, 0.26, 0.86), u);
  l(n, boxBetween(2, 0.26, -0.62, 2.85, 0.56, 0.62, 0.05), u);
  l(o, boxBetween(-3.46, 0.1, -0.92, -3.34, 0.8, 0.92, 0.02));
  l(r, strut([3.2, 0.95, -0.12], [3.2, 0.95, 0.12], 0.02, 5));
  l(r, strut([3.2, 0.8, 0], [3.2, 0.95, 0], 0.018, 5));
  l(s, boxBetween(0.3, 0.26, -0.4, 1, 1.12, 0.4, 0.05), [1, 0.9, 0.85]);
  l(o, girder([0.28, 1.14, 0], [0.86, 1.3, 0], 0.76, 0.05));
  let w = boxBetween(-0.012, 0, -0.42, 0.012, 0.5, 0.42);
  w.rotateZ(0.42);
  w.translate(0.95, 1.2, 0);
  l(a, w);
  for (let U of [-0.43, 0.43])
    l(
      r,
      strut(
        [0.95, 1.2, U],
        [0.95 - Math.sin(0.42) * 0.52, 1.2 + Math.cos(0.42) * 0.52, U],
        0.016,
        5,
      ),
    );
  l(
    r,
    strut(
      [0.95 - Math.sin(0.42) * 0.52, 1.2 + Math.cos(0.42) * 0.52, -0.43],
      [0.95 - Math.sin(0.42) * 0.52, 1.2 + Math.cos(0.42) * 0.52, 0.43],
      0.016,
      5,
    ),
  );
  let S = new TorusGeometry(0.18, 0.017, 6, 18);
  S.rotateY(Math.PI / 2);
  S.rotateZ(-0.5);
  S.translate(0.2, 1.12, -0.12);
  l(o, S);
  l(r, strut([0.2, 1.12, -0.12], [0.36, 1.03, -0.12], 0.02, 5));
  for (let U of [0, 2.1, 4.2])
    l(
      r,
      strut(
        [0.2, 1.12, -0.12],
        [
          0.2 + Math.sin(-0.5) * Math.cos(U) * -0.17,
          1.12 + Math.cos(-0.5) * Math.cos(U) * 0.17,
          -0.12 + Math.sin(U) * 0.17,
        ],
        0.01,
        4,
      ),
    );
  l(o, boxBetween(0.34, 1.16, 0.16, 0.5, 1.34, 0.3, 0.02));
  l(r, strut([0.42, 1.34, 0.23], [0.36, 1.48, 0.23], 0.012, 4));
  l(r, strut([0.35, 0.3, -0.46], [0.35, 1, -0.46], 0.02, 5));
  l(r, strut([0.35, 1, -0.46], [0.95, 1, -0.46], 0.02, 5));
  l(r, strut([0.35, 0.3, 0.46], [0.35, 1, 0.46], 0.02, 5));
  l(r, strut([0.35, 1, 0.46], [0.95, 1, 0.46], 0.02, 5));
  for (let U of [-0.75, -1.75]) {
    l(
      s,
      boxBetween(U - 0.28, 0.26, -0.2, U + 0.28, 0.82, 0.2, 0.05),
      [1, 0.9, 0.85],
    );
    l(o, boxBetween(U - 0.3, 0.82, -0.22, U + 0.3, 0.93, 0.22, 0.04));
    l(o, boxBetween(U - 0.34, 0.93, -0.2, U - 0.26, 1.2, 0.2, 0.03));
    l(r, strut([U + 0.3, 0.6, -0.22], [U + 0.3, 1.02, 0], 0.014, 4));
    l(r, strut([U + 0.3, 0.6, 0.22], [U + 0.3, 1.02, 0], 0.014, 4));
  }
  l(s, boxBetween(-2.9, 0.26, -0.3, -2.45, 0.58, 0.3, 0.04), [1.1, 0.5, 0.4]);
  for (let U of [-1, 1]) {
    l(r, strut([-2.95, 0.55, U * 0.9], [-2.75, 2, U * 0.55], 0.03, 6));
    l(r, strut([-2.3, 0.55, U * 0.9], [-2.75, 1.3, U * 0.7], 0.022, 5));
  }
  l(r, strut([-2.75, 2, -0.55], [-2.75, 2, 0.55], 0.03, 6));
  l(r, boxBetween(-2.88, 2, -0.2, -2.62, 2.04, 0.2));
  l(o, axisCylinder(0.05, 0.06, 0.1, "y", -2.75, 2.09, 0, 8));
  l(o, strut([-2.75, 2, 0.42], [-2.9, 3.7, 0.46], 0.011, 5));
  l(o, axisCylinder(0.16, 0.16, 0.07, "y", -2.75, 2.1, -0.36, 10));
  for (let U of [-0.36, 0.36]) {
    l(r, boxBetween(-3.6, 0.42, U - 0.16, -3.44, 0.78, U + 0.16, 0.02));
    l(o, boxBetween(-4.1, 0.78, U - 0.23, -3.48, 1.4, U + 0.23, 0.09));
    l(
      n,
      boxBetween(-4.11, 1, U - 0.235, -3.47, 1.05, U + 0.235),
      [1.4, 1.4, 1.4],
    );
    l(o, boxBetween(-3.92, -0.05, U - 0.085, -3.62, 0.8, U + 0.085, 0.03));
    l(o, boxBetween(-4.02, -0.52, U - 0.04, -3.6, -0.05, U + 0.04, 0.015));
    l(o, axisCylinder(0.07, 0.03, 0.42, "x", -3.9, -0.3, U, 8));
  }
  for (let U of [-1.8, 0.4, 1.7]) {
    l(
      s,
      axisCylinder(0.11, 0.11, 0.42, "y", U, 0.42, 1.36, 10),
      [1.2, 0.8, 0.7],
    );
    l(n, strut([U, 0.63, 1.36], [U, 0.78, 1.12], 0.01, 4), h);
  }
  let z = new TorusGeometry(0.26, 0.07, 6, 16);
  z.rotateY(Math.PI / 2);
  z.translate(1.02, 0.72, 0);
  l(s, z, [1.3, 0.6, 0.45]);
  let H = t.build({
    cast: true,
    recv: true,
  });
  e.add(lampGeo(-2.75, 2.2, 0, 0.075), [1.2, 11, 3.2], 1.5, 0, 0.1);
  e.add(lampGeo(-2.75, 2.2, 0, 0.074), [1.2, 11, 3.2], 1.5, 0.2, 0.08);
  let O = e.build();
  if (O) {
    O.frustumCulled = false;
    H.add(O);
  }
  let q = new Group();
  q.name = "boat";
  q.add(H);
  q.userData.noMerge = true;
  return {
    root: q,
    hullGrp: H,
    tris: t.tris,
  };
}
const SKYLINE_BASE_PAINT = new Color(12172214);
const skylineTint = (i: number, e = 1) => {
  let t = new Color(i);
  return [
    (e * t.r) / SKYLINE_BASE_PAINT.r,
    (e * t.g) / SKYLINE_BASE_PAINT.g,
    (e * t.b) / SKYLINE_BASE_PAINT.b,
  ];
};
const SKYLINE_CONTAINER_TINTS = [
  8200729, 8200729, 6957596, 2047846, 2047846, 2307146, 2906692, 2906692,
  11751962, 9062946, 5922920, 5922920, 4146764, 2055523, 10121752, 8093308,
  6962468, 6962468,
].map((i) => skylineTint(i));
const DISTANT_SHIP_CONTAINER_COLORS = [
  [0.6, 0.17, 0.13],
  [0.17, 0.29, 0.5],
  [0.2, 0.42, 0.3],
  [0.76, 0.35, 0.12],
  [0.78, 0.6, 0.16],
  [0.8, 0.81, 0.78],
  [0.4, 0.43, 0.47],
  [0.16, 0.42, 0.45],
  [0.55, 0.2, 0.15],
  [0.2, 0.3, 0.45],
];
const skylineSmoothstep = (i: number, e: number, t: number) => {
  let n = Math.min(1, Math.max(0, (t - i) / (e - i)));
  return n * n * (3 - 2 * n);
};
const skylineDistanceShade = (i: number, e: number) =>
  1 - 0.6 * skylineSmoothstep(38, 160, Math.hypot(i + 5, e));
export function buildSkyline(i: GameContext, e: any) {
  let t = new GeoBucket(),
    n = backdropMaterial(i, "paint_white"),
    s = lcgRng(90417),
    o = [5.5, 4.3, 2.9],
    r = [8, 0.45, 0.25],
    a = [0, 0, 0];
  function l(D: number[], C: number, G: number, j: number, N = 1) {
    let Q = valueNoise3b(C * 0.23 + 1.3, G * 0.31, j * 0.23 + 7.7),
      K = valueNoise3b(C * 1.9 + 4.1, 2.2, j * 1.9 + 9.3),
      ie = N * (0.56 + 0.52 * Q) * (0.62 + 0.38 * skylineSmoothstep(0, 5, G)),
      F = D[0] * ie,
      X = D[1] * ie,
      ne = D[2] * ie;
    if (K > 0.62) {
      let re = Math.min(1, (K - 0.62) / 0.3) * 0.55;
      F = F * (1 - re) + 0.3 * re * ie;
      X = X * (1 - re) + 0.15 * re * ie;
      ne = ne * (1 - re) + 0.08 * re * ie;
    }
    a[0] = F;
    a[1] = X;
    a[2] = ne;
    return a;
  }
  let c = (D: BoxGeometry | CylinderGeometry | null, C: number[]) => {
      if (!D) {
        return;
      }
      if (Array.isArray(D)) {
        for (let Q of D) c(Q, C);
        return;
      }
      D.computeBoundingBox();
      let G = D.boundingBox,
        j = (G!.min.x + G!.max.x) / 2,
        N = (G!.min.z + G!.max.z) / 2;
      if (j < 31) {
        let Q = skylineDistanceShade(j, N);
        vertexColorGeo(D, (K: number, ie: number, F: number) =>
          l(C, K, ie, F, Q),
        );
        t.add(n, D);
      } else {
        t.add(n, D, C);
      }
    },
    u: number[] = [],
    h: number[] = [],
    f: number[] = [],
    p: number[] = [];
  function d(D: number[][], C: number[], G: number[][]) {
    let j = D[1][0] - D[0][0],
      N = D[1][1] - D[0][1],
      Q = D[1][2] - D[0][2],
      K = D[3][0] - D[0][0],
      ie = D[3][1] - D[0][1],
      F = D[3][2] - D[0][2],
      X =
        (N * F - Q * ie) * C[0] +
          (Q * K - j * F) * C[1] +
          (j * ie - N * K) * C[2] <
        0;
    for (let ne of X ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) {
      let re = D[ne];
      u.push(re[0], re[1], re[2]);
      h.push(C[0], C[1], C[2]);
      p.push(G[ne][0], G[ne][1], G[ne][2]);
      if (Math.abs(C[0]) > 0.5) {
        f.push(re[2], re[1]);
      } else if (Math.abs(C[1]) > 0.5) {
        f.push(re[0], re[2]);
      } else {
        f.push(re[0], re[1]);
      }
    }
  }
  let v = [0.866, -0.5, 0],
    g = (D: number[], C: number[][], G: number) =>
      C.map((j) => l(D, j[0], j[1], j[2], G).slice());
  function x(
    D: number,
    C: number,
    G: number,
    j: number,
    N: number,
    Q: number,
    K: number[],
    ie: string,
    F: number,
  ) {
    for (let X of ie) {
      let ne: number[][] | undefined, re: number[] | undefined;
      if (X === "E") {
        ne = [
          [j, C, Q],
          [j, C, G],
          [j, N, G],
          [j, N, Q],
        ];
        re = v;
      } else if (X === "W") {
        ne = [
          [D, C, G],
          [D, C, Q],
          [D, N, Q],
          [D, N, G],
        ];
        re = [-1, 0, 0];
      } else if (X === "S") {
        ne = [
          [D, C, Q],
          [j, C, Q],
          [j, N, Q],
          [D, N, Q],
        ];
        re = [0, 0, 1];
      } else if (X === "N") {
        ne = [
          [j, C, G],
          [D, C, G],
          [D, N, G],
          [j, N, G],
        ];
        re = [0, 0, -1];
      } else {
        ne = [
          [D, N, Q],
          [j, N, Q],
          [j, N, G],
          [D, N, G],
        ];
        re = [0, 1, 0];
      }
      let $ = g(K, ne, X === "T" ? F * 0.8 : X === "E" ? F * 0.92 : F);
      if (C < 0.1 && X !== "T") {
        for (let ue of [0, 1]) {
          $[ue][0] *= 0.62;
          $[ue][1] *= 0.62;
          $[ue][2] *= 0.62;
        }
      }
      d(ne, re, $);
    }
  }
  function y(
    D: number[],
    C: number,
    G: number,
    {
      faceZ: j = 0,
      ribs: N = false,
      doorRows: Q = 0,
      west: K = false,
    }: {
      faceZ?: number;
      ribs?: boolean;
      doorRows?: number;
      west?: boolean;
    } = {},
  ) {
    let ie = Math.sign(G - C),
      F: { z: number; blk: number; first: boolean }[] = [];
    for (let re = C, $ = 1; ie > 0 ? re < G : re > G; re += ie * 2.62, $++) {
      if ($ % 8 >= 1 && $ % 8 <= 5) {
        F.push({
          z: re,
          blk: Math.floor($ / 8),
          first: $ === 1,
        });
      }
    }
    let X = F.map((re, $) =>
        D.map((ue, me) => {
          let ee = valueNoise3b(ue * 0.04 + 3, 0.5, re.z * 0.05 + 7),
            B = Math.round(0.2 + ee * 5.4 + (s() - 0.5) * 2.4);
          if (!re.first && s() < 0.07) {
            B = 0;
          }
          return Math.max(re.first ? 2 : 0, Math.min(5, B));
        }),
      ),
      ne = (re: number, $: number) =>
        re >= 0 && re < F.length && $ >= 0 && $ < D.length ? X[re][$] : 0;
    F.forEach((re, $) =>
      D.forEach((ue, me) => {
        let ee = X[$][me],
          B = re.z,
          P = skylineDistanceShade(ue, B),
          V = Math.max(Math.abs(ue + 5) - 40, Math.abs(B) - 30) < 55,
          Y = (L: number, Z: number) =>
            L >= 0 &&
            Z >= 0 &&
            L < D.length &&
            Z < D.length &&
            Math.abs(D[L] - D[Z]) < 12.8;
        for (let L = 0; L < ee; L++) {
          let Z =
              SKYLINE_CONTAINER_TINTS[
                Math.floor(s() * SKYLINE_CONTAINER_TINTS.length)
              ],
            J = 0.6 + s() * 0.4,
            oe = [Z[0] * J, Z[1] * J, Z[2] * J],
            fe = (s() - 0.5) * 0.22,
            le = L * 2.6,
            R = ue - 6.095 + fe,
            I = ue + 6.095 + fe,
            se = B - 1.22,
            ae = B + 1.22,
            k = L === ee - 1 ? "T" : "";
          for (let Pe of j ? [j] : [-1, 1]) {
            let Re = $ + Pe * ie;
            if (
              !(
                Re >= 0 &&
                Re < F.length &&
                F[Re].blk === re.blk &&
                Math.abs(F[Re].z - B) < 2.7
              ) ||
              ne(Re, me) <= L
            ) {
              k += Pe > 0 ? "S" : "N";
            }
          }
          let ce = !(Y(me - 1, me) && ne($, me - 1) > L),
            ve = !K && !(Y(me + 1, me) && ne($, me + 1) > L);
          if (ce) {
            k += "E";
          }
          if (ve) {
            k += "W";
          }
          x(R, le, se, I, le + 2.59, ae, oe, k, P);
          let _e = [oe[0] * 0.45, oe[1] * 0.45, oe[2] * 0.45],
            Te = re.first
              ? j
                ? [j]
                : [-ie]
              : me === 0 && K && Math.abs(B) < 42
                ? [-1, 1].filter((Pe) => k.includes(Pe > 0 ? "S" : "N"))
                : [];
          if (N && V && Te.length) {
            let Pe = Te;
            for (let Re of Pe) {
              let Fe = Re > 0 ? ae : se,
                ze = Fe + Re * 0.04,
                We = le + 0.15,
                Ne = le + 2.45,
                dt = [oe[0] * 0.7, oe[1] * 0.7, oe[2] * 0.7];
              for (let xe = R + 0.24; xe < I - 0.3; xe += 0.575) {
                let Ie = [
                  [xe, We, Fe],
                  [xe + 0.07, We, ze],
                  [xe + 0.07, Ne, ze],
                  [xe, Ne, Fe],
                ];
                d(Ie, [-0.5, 0, Re * 0.87], g(dt, Ie, P));
                Ie = [
                  [xe + 0.07, We, ze],
                  [xe + 0.2, We, ze],
                  [xe + 0.2, Ne, ze],
                  [xe + 0.07, Ne, ze],
                ];
                d(Ie, [0, 0, Re], g(oe, Ie, P));
                Ie = [
                  [xe + 0.2, We, ze],
                  [xe + 0.27, We, Fe],
                  [xe + 0.27, Ne, Fe],
                  [xe + 0.2, Ne, ze],
                ];
                d(Ie, [0.42, -0.52, Re * 0.74], g(dt, Ie, P));
              }
              for (let [xe, Ie] of [
                [le, We],
                [Ne, le + 2.59],
              ]) {
                let Be = Fe + Re * 0.05,
                  Xe = [
                    [R, xe, Be],
                    [I, xe, Be],
                    [I, Ie, Be],
                    [R, Ie, Be],
                  ];
                d(Xe, [0, 0, Re], g(_e, Xe, P));
                Xe = [
                  [R, Ie, Fe],
                  [I, Ie, Fe],
                  [I, Ie, Be],
                  [R, Ie, Be],
                ];
                d(Xe, [0, xe === le ? 1 : -1, 0], g(_e, Xe, P));
              }
            }
          }
          if (ce && me === 0 && $ < Q) {
            let Pe = I + 0.03,
              Re = I + 0.055,
              Fe = le + 0.02,
              ze = le + 2.57,
              We = [oe[0] * 0.55, oe[1] * 0.55, oe[2] * 0.55],
              Ne = [0.34, 0.35, 0.36],
              dt = [0.05, 0.05, 0.055],
              xe = (
                Ie: number,
                Be: number,
                Xe: number,
                Me: number,
                we: number,
                be: number[],
              ) => {
                let Oe = [
                    [Ie, Me, Xe],
                    [Ie, Me, Be],
                    [Ie, we, Be],
                    [Ie, we, Xe],
                  ],
                  pt = g(be, Oe, P);
                if (le < 0.1 && Me < 0.3) {
                  for (let ut of [0, 1]) {
                    pt[ut][0] *= 0.62;
                    pt[ut][1] *= 0.62;
                    pt[ut][2] *= 0.62;
                  }
                }
                d(Oe, v, pt);
              };
            xe(Pe, se, se + 0.13, Fe, ze, We);
            xe(Pe, ae - 0.13, ae, Fe, ze, We);
            xe(Pe, se + 0.13, ae - 0.13, le, le + 0.15, We);
            xe(Pe, se + 0.13, ae - 0.13, le + 2.44, le + 2.59, We);
            xe(Pe, B - 0.018, B + 0.018, le + 0.15, le + 2.44, dt);
            for (let Ie of [-0.8, -0.32, 0.32, 0.8]) {
              xe(Re, B + Ie - 0.024, B + Ie + 0.024, le + 0.1, le + 2.5, Ne);
              if ($ < 8) {
                for (let Be of [0.32, 2.2])
                  xe(
                    Re + 0.01,
                    B + Ie - 0.07,
                    B + Ie + 0.07,
                    le + Be,
                    le + Be + 0.09,
                    Ne,
                  );
              }
            }
            if ($ < 8) {
              for (let Ie of [-0.56, 0.56])
                xe(
                  Re + 0.01,
                  B + Ie - 0.1,
                  B + Ie + 0.1,
                  le + 1.02,
                  le + 1.1,
                  Ne,
                );
            }
          }
        }
      }),
    );
  }
  let b = [-48.6, -61.2, -73.8, -90.5, -103.1, -115.7, -132, -144.6],
    m = [6.3, -6.3, -18.9, -31.5];
  y(b, -4.9, -112, {
    ribs: true,
    doorRows: 15,
    west: true,
  });
  y(b, 14.9, 112, {
    ribs: true,
    doorRows: 15,
    west: true,
  });
  y(m, -36.4, -110, {
    faceZ: 1,
    ribs: true,
    doorRows: 12,
  });
  y(m, 33.9, 110, {
    faceZ: -1,
    ribs: true,
    doorRows: 12,
  });
  {
    let D = new BufferGeometry();
    D.setAttribute("position", new Float32BufferAttribute(u, 3));
    D.setAttribute("normal", new Float32BufferAttribute(h, 3));
    D.setAttribute("uv", new Float32BufferAttribute(f, 2));
    D.setAttribute("color", new Float32BufferAttribute(p, 3));
    t.add(n, D);
  }
  let A = skylineTint(5922920, 0.85),
    _ = [0.1, 0.1, 0.11],
    M = [0.36, 0.38, 0.4],
    E = skylineTint(12159516, 0.5),
    w = [0.5, 0.5, 0.48];
  function S(D: number, C: number, G: number[], j: number, N: number) {
    let K = G,
      ie = [K[0] * 0.7, K[1] * 0.7, K[2] * 0.7];
    for (let ne of [-1, 1]) {
      let re = C + ne * 9.5;
      for (let $ of [-1, 1]) {
        let ue = D + $ * 7.5;
        c(boxBetween(ue - 1.5, 0.05, re - 0.28, ue + 1.5, 0.8, re + 0.28), _);
        c(boxBetween(ue - 0.36, 0.8, re - 0.36, ue + 0.36, 19.1, re + 0.36), K);
        c(boxBetween(ue - 0.4, 6.9, re - 0.4, ue + 0.4, 7, re + 0.4), ie);
        c(boxBetween(ue - 0.4, 13, re - 0.4, ue + 0.4, 13.1, re + 0.4), ie);
        c(girder([ue, 14.6, re], [ue - $ * 3.2, 19.1, re], 0.3, 0.3), K);
      }
      c(boxBetween(D - 9.3, 0.8, re - 0.4, D + 9.3, 1.7, re + 0.4), K);
      c(boxBetween(D - 8, 19.1, re - 0.45, D + 8, 20.2, re + 0.45), K);
      c(boxBetween(D - 2.4, 1.7, re - 0.5, D + 0.8, 3.9, re + 0.5), w);
    }
    for (let ne of [-1, 1]) {
      let re = D + ne * 3.3,
        $ = C - 9.5 - 5.6,
        ue = C + 9.5 + 5.6;
      c(boxBetween(re - 0.45, 20.2, $, re + 0.45, 21.9, ue), K);
      for (let me = $ + 4.4; me < ue; me += 4.4)
        c(
          boxBetween(re - 0.48, 20.15, me - 0.03, re + 0.48, 21.95, me + 0.03),
          ie,
        );
      c(boxBetween(re + ne * 0.45, 21, $, re + ne * 1.3, 21.05, ue), M);
      railLine(
        z,
        null,
        [
          [re + ne * 1.27, 21.05, $],
          [re + ne * 1.27, 21.05, ue],
        ],
        {
          post: 3.3,
          r: 0.035,
          mid: false,
          tint: E,
        },
      );
      c(
        strut([re, 20.2, C - 9.5 + 0.5], [re, 20.2, C + 9.5 - 0.5], 0.05, 4),
        _,
      );
    }
    for (let ne of [C - 9.5 - 5.4, C + 9.5 + 5.4])
      c(boxBetween(D - 3.3, 20.4, ne - 0.25, D + 3.3, 21.7, ne + 0.25), K);
    let F = C + j;
    c(boxBetween(D - 4, 21.9, F - 2.3, D + 4, 22.5, F + 2.3), E);
    c(boxBetween(D - 2.6, 22.5, F - 1.7, D + 1.4, 24.5, F + 1.7), w);
    c(boxBetween(D + 1.8, 22.5, F - 0.9, D + 3.4, 23.3, F + 0.9), _);
    c(boxBetween(D + 4.3, 17.2, F - 1, D + 6.1, 19.5, F + 1), w);
    c(
      boxBetween(D + 4.4, 18.2, F - 1.02, D + 6.12, 19.2, F + 1.02),
      [0.08, 0.1, 0.12],
    );
    for (let ne of [-0.9, 0.9])
      c(
        boxBetween(D + 4.9, 19.5, F + ne - 0.06, D + 5.05, 21.9, F + ne + 0.06),
        E,
      );
    let X = 21.9 - N;
    for (let ne of [-2.2, 2.2])
      for (let re of [-0.8, 0.8])
        c(strut([D + ne, 21.9, F + re], [D + ne, X, F + re], 0.03, 4), _);
    c(boxBetween(D - 6.1, X - 0.4, F - 1.22, D + 6.1, X, F + 1.22), E);
    c(boxBetween(D - 2.4, X, F - 0.9, D + 2.4, X + 0.5, F + 0.9), E);
    {
      let ne = D - 7.5 - 0.5,
        re = C - 9.5,
        $ = 1.7;
      for (let ue = 0; ue < 6; ue++) {
        let me = re + (ue % 2 ? 1.9 : -1.9),
          ee = re + (ue % 2 ? -1.9 : 1.9),
          B = Math.min(20.2, $ + 3.1);
        c(girder([ne, $, me], [ne, B, ee], 0.6, 0.07), M);
        c(strut([ne - 0.3, $ + 1, me], [ne - 0.3, B + 1, ee], 0.03, 4), E);
        c(boxBetween(ne - 0.35, B - 0.04, ee - 0.5, ne + 0.35, B, ee + 0.5), M);
        $ = B;
      }
      for (let ue of [-2.4, 2.4])
        c(
          boxBetween(
            ne - 0.3,
            1.7,
            re + ue - 0.05,
            ne - 0.2,
            20.2,
            re + ue + 0.05,
          ),
          ie,
        );
      c(
        axisCylinder(1.25, 1.25, 0.5, "z", D + 7.5 + 1, 3.3, C + 9.5 + 0.9, 12),
        E,
      );
      c(
        axisCylinder(0.5, 0.5, 0.6, "z", D + 7.5 + 1, 3.3, C + 9.5 + 0.9, 8),
        _,
      );
      for (let ue of [-0.2, 0.2])
        c(
          strut(
            [D + 7.5 + 0.45, 1.7, C - 9.5 + ue],
            [D + 7.5 + 0.45, 20.2, C - 9.5 + ue],
            0.022,
            4,
          ),
          M,
        );
    }
    e.add(lampGeo(D, 24.9, F, 0.3), r, 3.1, s(), 0.4);
    e.add(lampGeo(D - 3.3, 20, C - 4, 0.24), o, 0);
    e.add(lampGeo(D + 3.3, 20, C + 4, 0.24), o, 0);
  }
  let z = {
      add: (D: any, C: BoxGeometry | CylinderGeometry | null, G: number[]) =>
        c(C, G),
    },
    H = skylineTint(6172444, 0.7);
  S(-61, -52.06, A, -3, 4.5);
  S(-61, 41.1, H, 5, 9);
  S(-103, -10.14, H, 2, 3);
  S(-6, -62.6, A, -6, 7);
  S(-12, 60.1, A, 4, 5);
  for (let [D, C, G] of [
    [-67.5, -22, 32],
    [-67.5, 31, 32],
    [-122, 4, 34],
    [-12.6, -53, 30],
    [-12.6, 51, 30],
    [-140, -84, 34],
    [-96, 96, 34],
    [0.2, -100, 30],
    [-52, -70, 28],
    [-55, 72, 28],
    [-84, -45, 34],
    [-84, 24, 34],
    [-25, -84, 30],
    [-28, 90, 30],
    [-120, 60, 34],
    [10.5, 49, 26],
  ]) {
    c(axisCylinder(0.14, 0.3, G, "y", D, G / 2, C, 6), M);
    c(axisCylinder(1.5, 1.5, 0.18, "y", D, G - 0.5, C, 8), _);
    for (let [j, N] of [
      [-1.4, 0],
      [1.4, 0],
      [0, -1.4],
      [0, 1.4],
    ]) {
      c(
        boxBetween(
          D + j - 0.25,
          G - 0.95,
          C + N - 0.25,
          D + j + 0.25,
          G - 0.6,
          C + N + 0.25,
        ),
        _,
      );
      e.add(lampGeo(D + j, G - 1.05, C + N, 0.2), o, 0);
    }
  }
  for (let [D, C, G] of [
    [-158, -30, 62],
    [-76, -128, 48],
    [-150, 104, 54],
  ]) {
    let N = [
      [-1.1, -0.638],
      [1.1, -0.638],
      [0, 1.265],
    ];
    for (let [Q, K] of N)
      c(
        strut([D + Q, 0, C + K], [D + Q * 0.3, G, C + K * 0.3], 0.07, 4),
        [0.42, 0.14, 0.1],
      );
    for (let Q = 3, K = 0; Q < G; Q += 6, K++)
      for (let ie = 0; ie < 3; ie++) {
        let F = N[ie],
          X = N[(ie + 1) % 3],
          ne = 1 - (0.7 * Q) / G,
          re = 1 - (0.7 * Math.min(G, Q + 6)) / G;
        c(
          strut(
            [D + F[0] * ne, Q, C + F[1] * ne],
            [D + X[0] * re, Math.min(G, Q + 6), C + X[1] * re],
            0.04,
            3,
          ),
          K % 2 ? w : [0.42, 0.14, 0.1],
        );
      }
    for (let Q of [0.5, 2.6, 4.7])
      c(
        strut(
          [D, G * 0.72, C],
          [D + Math.cos(Q) * G * 0.5, 0, C + Math.sin(Q) * G * 0.5],
          0.025,
          3,
        ),
        _,
      );
    c(strut([D, G, C], [D, G + 5, C], 0.04, 3), _);
    c(
      boxBetween(D - 0.9, G * 0.8, C - 0.25, D + 0.9, G * 0.8 + 1.6, C + 0.25),
      w,
    );
    e.add(lampGeo(D, G + 0.4, C, 0.35), r, 2.4, s(), 0.45);
    e.add(lampGeo(D, G * 0.55, C, 0.28), r, 0);
  }
  for (let [D, C, G] of [
    [-178, -70, 90],
    [-182, 40, 110],
    [-60, -150, 70],
    [-70, 150, 80],
  ]) {
    let j = Math.abs(C) > 120,
      N = (
        Q: number,
        K: number,
        ie: number,
        F: number,
        X: number,
        ne: number,
        re: number[],
      ) =>
        c(
          j
            ? boxBetween(D + Q, K, C + ie, D + F, X, C + ne)
            : boxBetween(D + ie, K, C + Q, D + ne, X, C + F),
          re,
        );
    N(-G / 2, 0, -16, G / 2, 9.5, 16, [0.2, 0.22, 0.24]);
    N(-G / 2, 9.5, -16.4, G / 2, 9.9, 16.4, [0.12, 0.12, 0.13]);
    N(-G / 2, 9.9, -10, G / 2, 12.2, 10, [0.17, 0.18, 0.2]);
    N(-G / 2 + 4, 12.2, -1.2, G / 2 - 4, 13.3, 1.2, [0.13, 0.13, 0.14]);
    for (let Q = -G / 2 + 6; Q < G / 2 - 5; Q += 12) {
      N(Q - 0.25, 0, -16.2, Q + 0.25, 9.5, 16.2, [0.13, 0.14, 0.15]);
      if ((Q | 0) % 3 === 0) {
        N(Q + 2, 0, -16.1, Q + 8, 6.2, 16.1, [0.06, 0.06, 0.07]);
      }
    }
  }
  buildCrane(i, e, {
    into: t,
    mat: n,
    dz: 66,
  });
  (
    [
      [-132, 1.15, true, [0.14, 0.17, 0.21]],
      [-186, 1.25, false, [0.14, 0.17, 0.21]],
      [-252, 1.35, true, [0.26, 0.12, 0.06]],
      [-336, 1.4, false, [0.26, 0.12, 0.06]],
      [128, 1.2, false, [0.14, 0.17, 0.21]],
      [182, 1.3, true, [0.24, 0.25, 0.27]],
      [250, 1.4, false, [0.24, 0.25, 0.27]],
      [330, 1.45, true, [0.26, 0.12, 0.06]],
    ] as [number, number, boolean, number[]][]
  ).forEach(([D, C, G, j], N) => {
    let Q = buildCraneLights(t, n, 23.5, D, {
      s: C,
      up: G,
      tint: j,
    });
    e.add(
      lampGeo(Q[0], Q[1], Q[2], 0.45 * C),
      r,
      2.6 + (N % 3) * 0.35,
      N * 0.37,
      0.45,
    );
  });
  c(boxBetween(-230, -1.6, -384, 30, -0.12, 425), [0.24, 0.24, 0.25]);
  function q(
    D: number,
    C: number,
    G: number,
    j: number,
    N: number,
    Q: number[],
    K: number,
  ) {
    c(boxBetween(D, -1.6, G, C, N, j), Q);
    c(boxBetween(D, -1.6, G, C, 0.8, j + 0.2), [0.42, 0.14, 0.1]);
    let ie = j - G,
      F = G + ie * K;
    c(boxBetween(D + 2, N, F - 7, C - 2, N + 17, F + 7), [0.72, 0.73, 0.7]);
    c(
      boxBetween(
        (D + C) / 2 - 3,
        N + 17,
        F - 5,
        (D + C) / 2 + 3,
        N + 24,
        F + 1,
      ),
      [0.2, 0.3, 0.45],
    );
    for (let X = G + 12; X < j - 12; X += 13.2) {
      if (Math.abs(X + 6 - F) < 14) {
        continue;
      }
      let ne = 2.6 * (2 + Math.floor(s() * 4)),
        re =
          DISTANT_SHIP_CONTAINER_COLORS[
            Math.floor(s() * DISTANT_SHIP_CONTAINER_COLORS.length)
          ];
      c(boxBetween(D + 1, N, X, (D + C) / 2 - 0.2, N + ne, X + 12.2), re);
      let $ =
        DISTANT_SHIP_CONTAINER_COLORS[
          Math.floor(s() * DISTANT_SHIP_CONTAINER_COLORS.length)
        ];
      c(
        boxBetween(
          (D + C) / 2 + 0.2,
          N,
          X,
          C - 1,
          N + ne - 2.6 * Math.floor(s() * 2),
          X + 12.2,
        ),
        $,
      );
    }
    e.add(lampGeo((D + C) / 2, N + 26, F, 0.4), [5, 4.6, 3.8], 0);
  }
  q(34, 62, 140, 345, 11, [0.1, 0.13, 0.2], 0.78);
  q(34, 58, -360, -205, 10, [0.2, 0.08, 0.07], 0.2);
  q(470, 500, -190, -40, 9, [0.12, 0.14, 0.17], 0.8);
  q(600, 626, 160, 300, 9, [0.16, 0.12, 0.1], 0.2);
  for (let D = 340; D > -66; D -= 12.5) {
    let C = 398 + Math.sin(D * 0.013) * 14 + (s() - 0.5) * 3,
      G = boxBetween(-6 - s() * 2, -1.6, -7, 6 + s() * 2, 2.2 + s() * 1.2, 7);
    G.rotateY((s() - 0.5) * 0.5);
    G.translate(C, 0, D);
    c(G, [0.2, 0.21, 0.22]);
  }
  {
    c(axisCylinder(5, 6, 3.6, "y", 399, 0.2, -72, 10), [0.3, 0.3, 0.3]);
    c(axisCylinder(1.7, 2.3, 6, "y", 399, 5, -72, 10), [0.85, 0.85, 0.82]);
    c(axisCylinder(1.5, 1.7, 4, "y", 399, 10, -72, 10), [0.62, 0.14, 0.1]);
    c(axisCylinder(1.3, 1.5, 4, "y", 399, 14, -72, 10), [0.85, 0.85, 0.82]);
    c(axisCylinder(2, 2, 0.3, "y", 399, 16.1, -72, 10), [0.3, 0.3, 0.32]);
    c(axisCylinder(0.2, 1.3, 1.2, "y", 399, 18.9, -72, 8), [0.25, 0.25, 0.27]);
    for (let G = 0; G < 6; G++) {
      let j = (G / 6) * 6.283;
      c(
        boxBetween(
          399 + Math.cos(j) * 1.1 - 0.06,
          16.2,
          -72 + Math.sin(j) * 1.1 - 0.06,
          399 + Math.cos(j) * 1.1 + 0.06,
          18.3,
          -72 + Math.sin(j) * 1.1 + 0.06,
        ),
        [0.25, 0.25, 0.27],
      );
    }
    e.add(lampGeo(399, 17.25, -72, 0.85), [16, 15, 11], 6, 0, 0.09);
  }
  let U = 300;
  c(boxBetween(U - 330, -1.6, -520, U + 330, 2.2, -430), [0.16, 0.17, 0.18]);
  for (let [D, C, G, j] of [
    [-150, -452, 17, 15],
    [-112, -458, 17, 15],
    [-76, -450, 13, 18],
    [20, -455, 20, 14],
    [64, -462, 20, 14],
    [104, -452, 14, 19],
    [136, -462, 14, 19],
    [210, -456, 22, 12],
  ]) {
    c(
      axisCylinder(G, G, j, "y", U + D, 2.2 + j / 2, C, 14),
      [0.62, 0.63, 0.62],
    );
    c(
      axisCylinder(G * 0.2, G, j * 0.12, "y", U + D, 2.2 + j * 1.06, C, 14),
      [0.52, 0.53, 0.53],
    );
  }
  for (let [D, C, G, j] of [
    [-32, -470, 96, 3.2],
    [168, -475, 70, 2.6],
  ]) {
    c(
      axisCylinder(j * 0.62, j, G, "y", U + D, 2.2 + G / 2, C, 10),
      [0.5, 0.5, 0.5],
    );
    for (let N of [0.82, 0.94])
      c(
        axisCylinder(
          j * 0.66,
          j * 0.7,
          G * 0.05,
          "y",
          U + D,
          2.2 + G * N,
          C,
          10,
        ),
        [0.6, 0.15, 0.1],
      );
    e.add(lampGeo(U + D, 3.2 + G, C, 0.9), r, 2.2, s(), 0.5);
    e.add(lampGeo(U + D + j, 2.2 + G * 0.55, C, 0.7), r, 2.2, s(), 0.5);
  }
  for (let [D, C, G, j, N] of [
    [-230, -455, 70, 16, 30],
    [-10, -445, 30, 22, 18],
    [0, -452, 8, 44, 8],
    [-18, -450, 5, 36, 5],
    [270, -450, 60, 12, 30],
    [150, -448, 26, 28, 14],
  ])
    c(
      boxBetween(
        U + D - G / 2,
        2.2,
        C - N / 2,
        U + D + G / 2,
        2.2 + j,
        C + N / 2,
      ),
      [0.34, 0.36, 0.38],
    );
  for (let D = 0; D < 26; D++)
    e.add(
      lampGeo(U - 300 + s() * 600, 6 + s() * 26, -436 + s() * 6, 0.55),
      s() > 0.3 ? o : [3, 3.4, 3.8],
      0,
    );
  let T = t.build({
    cast: false,
    recv: false,
  });
  T.name = "skyline";
  return {
    root: T,
    tris: t.tris,
  };
}
export function buildBeacons(i: GameContext, e: { value: number }, t = 12) {
  let n = lcgRng(5521),
    s: number[] = [],
    o: number[] = [],
    r: number[] = [];
  for (let u = 0; u < t; u++) {
    let f =
        u % 3 === 0
          ? [54 + n() * 30, 9 + n() * 14, -4 + n() * 56]
          : [16 + n() * 26, 33 + n() * 12, -14 + n() * 28],
      p = 9 + n() * 16,
      d = (0.16 + n() * 0.16) * (n() > 0.5 ? 1 : -1),
      v = n() * 6.283,
      g = 5 + n() * 3,
      x = [
        [0.15, 0, 0, 0],
        [-0.13, 0, 0, 0],
        [-0.24, 0, 0.8, 1],
        [0.15, 0, 0, 0],
        [-0.24, 0, -0.8, 1],
        [-0.13, 0, 0, 0],
      ];
    for (let y of x) {
      s.push(y[0], y[1] - 60, y[2]);
      o.push(f[0], f[1], f[2], p);
      r.push(d, v, g, y[3]);
    }
  }
  let a = new BufferGeometry();
  a.setAttribute("position", new Float32BufferAttribute(s, 3));
  a.setAttribute("aOrbit", new Float32BufferAttribute(o, 4));
  a.setAttribute("aPar", new Float32BufferAttribute(r, 4));
  let l = new MeshBasicMaterial({
    color: new Color(0.2, 0.21, 0.23),
    side: DoubleSide,
    fog: false,
  });
  l.onBeforeCompile = (u) => {
    u.uniforms.uTime = e;
    u.vertexShader =
      `attribute vec4 aOrbit;
attribute vec4 aPar;
uniform float uTime;
` +
      u.vertexShader.replace(
        "#include <begin_vertex>",
        `
      float ga = aPar.y + uTime * aPar.x;
      float gdir = sign(aPar.x);
      vec3 gfw = vec3(-sin(ga), 0.0, cos(ga)) * gdir;
      vec3 grt = vec3(gfw.z, 0.0, -gfw.x);
      vec3 gl = position + vec3(0.0, 60.0, 0.0);
      float glide = smoothstep(-0.2, 0.5, sin(uTime * 0.31 + aPar.y * 3.0));
      float gflap = sin(uTime * aPar.z + aPar.y * 7.0) * mix(0.12, 0.55, glide) + 0.18;
      gl.y += aPar.w * gflap * abs(gl.z);
      gl.z *= mix(1.0, 0.86, aPar.w * abs(gflap));
      vec3 gc = aOrbit.xyz + vec3(cos(ga), 0.0, sin(ga)) * aOrbit.w + vec3(0.0, sin(ga * 0.7 + aPar.y) * 2.2 + sin(uTime * 0.23 + aPar.y) * 1.5, 0.0);
      vec3 transformed = gc + gfw * gl.x + grt * gl.z + vec3(0.0, gl.y - 0.3 * gdir * gl.z, 0.0);`,
      );
  };
  l.customProgramCacheKey = () => "saltline-gulls";
  let c = new Mesh(a, l);
  c.frustumCulled = false;
  c.castShadow = false;
  c.receiveShadow = false;
  c.name = "gulls";
  return c;
}
