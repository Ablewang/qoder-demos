import type { GameContext } from "../types/context";
import * as THREE from "three";
import { Box3, Group, Mesh, PlaneGeometry, Vector3 } from "three";
import {
  boxGeo,
  cylinderGeo,
  makeMesh,
  roundedBoxGeo,
  tubeGeo,
} from "../utils/geometry";

const LOOSE_PROPS = new Set(["traffic_cone", "jerry_can"]);
export function createStaticBuilder(i: GameContext) {
  let e = new Group();
  e.name = "level-static";
  let t = new Group();
  t.name = "level-dynamic";
  let n: any[] = [],
    s: any[] = [],
    o: any[] = [],
    r = i.rng && i.rng.fork ? i.rng.fork() : Math.random,
    a = (T: number, D: number) => T + (D - T) * r(),
    l = (T: string, D?: {} | undefined) => i.mats.get(T, D),
    c = (T: string, D?: any) =>
      i.mats.get(T, {
        interior: true,
        ...(D || {}),
      }),
    u = (T: string) => (typeof T == "string" ? l(T) : T);
  function h(
    T: THREE.BoxGeometry | THREE.CylinderGeometry | THREE.TubeGeometry,
    D: string,
    C: any = {},
  ) {
    let G = makeMesh(T, u(D), {
      cast: C.cast !== false,
      recv: C.recv !== false,
    });
    if (C.p) {
      G.position.set(C.p[0], C.p[1], C.p[2]);
    }
    if (C.r) {
      G.rotation.set(C.r[0] || 0, C.r[1] || 0, C.r[2] || 0);
    }
    (C.parent || e).add(G);
    return G;
  }
  function f(
    T: string,
    D: number,
    C: number,
    G: number,
    j: number,
    N: number,
    Q: number,
    K: { bevel?: any } = {},
  ) {
    let ie = K.bevel ? roundedBoxGeo(D, C, G, K.bevel) : boxGeo(D, C, G);
    return h(ie, T, {
      ...K,
      p: [j, N, Q],
    });
  }
  function p(
    T: string,
    D: number,
    C: number,
    G: number,
    j: number,
    N: number,
    Q: number,
    K = {},
  ) {
    return f(
      T,
      Math.abs(j - D),
      Math.abs(N - C),
      Math.abs(Q - G),
      (D + j) / 2,
      (C + N) / 2,
      (G + Q) / 2,
      K,
    );
  }
  function d(
    T: string,
    D: number | undefined,
    C: number | undefined,
    G: any,
    j: any,
    N: any,
    Q: { rTop?: any; seg?: any; open?: any; axis?: any; r?: any } = {},
  ) {
    let K = cylinderGeo(Q.rTop ?? D, D, C, Q.seg || 12, !!Q.open),
      ie =
        Q.axis === "x"
          ? [0, 0, Math.PI / 2]
          : Q.axis === "z"
            ? [Math.PI / 2, 0, 0]
            : Q.r || [0, 0, 0];
    return h(K, T, {
      ...Q,
      p: [G, j, N],
      r: ie,
    });
  }
  function v(
    T: string,
    D: number[][],
    C = 0.03,
    G: { radial?: any; tension?: any } = {},
  ) {
    return h(tubeGeo(D, C, G.radial || 6, false, G.tension ?? 0.5), T, G);
  }
  function g(T: string, D: any, C: any, G = 0.015, j: { seg?: any } = {}) {
    let N = new Vector3(...D),
      Q = new Vector3(...C),
      K = N.distanceTo(Q),
      ie = cylinderGeo(G, G, K, j.seg || 6),
      F = h(ie, T, j);
    F.position.copy(N).add(Q).multiplyScalar(0.5);
    F.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), Q.sub(N).normalize());
    return F;
  }
  function x(
    T: string,
    D: string,
    C: any,
    G: number,
    j: number,
    N: number,
    {
      depth: Q = 0.4,
      width: K = 0.2,
      tf: ie = 0.02,
      tw: F = 0.012,
      depthAxis: X = null,
      r: ne = null,
    }: {
      depth?: number;
      width?: number;
      tf?: number;
      tw?: number;
      depthAxis?: any;
      r?: any;
    } = {},
  ) {
    let re = new Group();
    re.position.set(G, j, N);
    if (ne) {
      re.rotation.set(ne[0] || 0, ne[1] || 0, ne[2] || 0);
    }
    let $ = X || (D === "y" ? "z" : "y"),
      ue = ["x", "y", "z"].find((P) => P !== D && P !== $),
      me = (P: any, V: number, Y: number) => {
        let L = {} as Record<string, any>;
        L[D] = P;
        L[$] = V;
        L[ue!] = Y;
        return [L.x, L.y, L.z] as [number, number, number];
      },
      ee = (P: number) => {
        let V: Record<string, number> = {
          x: 0,
          y: 0,
          z: 0,
        };
        V[$] = P;
        return [V.x, V.y, V.z];
      },
      B = u(T);
    for (let P of [-1, 1])
      h(boxGeo(...me(C, ie, K)), B, {
        parent: re,
        p: ee(P * (Q / 2 - ie / 2)),
      });
    h(boxGeo(...me(C, Q - 2 * ie, F)), B, {
      parent: re,
    });
    e.add(re);
    return re;
  }
  function y(
    T: any,
    D: number | undefined,
    C: number | undefined,
    G: number,
    j: number,
    N: number,
    Q = "z+",
    K = 0,
  ) {
    let ie = new PlaneGeometry(D, C),
      F = new Mesh(ie, T);
    F.castShadow = false;
    F.receiveShadow = true;
    F.position.set(G, j, N);
    if (Q === "z-") {
      F.rotation.y = Math.PI;
    } else if (Q === "x+") {
      F.rotation.y = Math.PI / 2;
    } else if (Q === "x-") {
      F.rotation.y = -Math.PI / 2;
    } else if (Q === "y+") {
      F.rotation.x = -Math.PI / 2;
      F.rotation.z = K;
    }
    e.add(F);
    return F;
  }
  function b(
    T: string,
    D: number,
    C: number,
    G: number,
    j: number,
    N: string | undefined,
    Q: number | undefined,
  ) {
    try {
      let K = i.mats.decal(T);
      return !K || !K.material
        ? null
        : y(K.material, D, D / (K.aspect || 1), C, G, j, N, Q);
    } catch {
      return null;
    }
  }
  function m(
    T: string | undefined,
    D: number,
    C: number,
    G: number,
    j: number,
    N: string | undefined,
    Q: any,
  ) {
    try {
      let K = i.mats.label(T, Q || {});
      return !K || !K.material
        ? null
        : y(K.material, D * (K.aspect || 4), D, C, G, j, N);
    } catch {
      return null;
    }
  }
  function A(
    T: any,
    D: any,
    C: any,
    G: any,
    j: any,
    N: any,
    Q = "concrete",
    K = {},
  ) {
    return i.physics.addBox([T, D, C], [G, j, N], {
      surface: Q,
      ...K,
    });
  }
  let _ = new Box3();
  function M(T: any, D: number, C: any = {}) {
    let G = T.userData.colliders || [],
      j = Math.abs(Math.sin(2 * D)) > 0.2;
    for (let N of G) {
      let Q = [N];
      if (j) {
        let K = N.max[0] - N.min[0],
          ie = N.max[2] - N.min[2],
          F = K >= ie ? 0 : 2,
          X = Math.max(K, ie),
          ne = Math.max(0.25, Math.min(K, ie)),
          re = Math.min(10, Math.max(1, Math.round(X / ne)));
        if (re > 1) {
          Q = [];
          for (let $ = 0; $ < re; $++) {
            let ue = N.min.slice(),
              me = N.max.slice();
            ue[F] = N.min[F] + (X * $) / re;
            me[F] = N.min[F] + (X * ($ + 1)) / re;
            Q.push({
              min: ue,
              max: me,
              surface: N.surface,
            });
          }
        }
      }
      for (let K of Q) {
        _.min.set(K.min[0], K.min[1], K.min[2]);
        _.max.set(K.max[0], K.max[1], K.max[2]);
        _.applyMatrix4(T.matrixWorld);
        if (!(_.max.y - _.min.y < 0.2 && _.max.y < 0.3)) {
          if (j) {
            let ie = (_.max.x - _.min.x) * 0.07,
              F = (_.max.z - _.min.z) * 0.07;
            _.min.x += ie;
            _.max.x -= ie;
            _.min.z += F;
            _.max.z -= F;
          }
          i.physics.addBox(_.min, _.max, {
            surface: K.surface || N.surface || "metal",
            ...(C.colOpts || {}),
          });
        }
      }
    }
  }
  function E(
    T: string,
    D: number,
    C: number,
    G = 0,
    j = {},
    N = 0,
    Q: { dynamic?: any; noCol?: any } = {},
  ) {
    let K = i.props.build(T, j);
    K.position.set(D, N, C);
    K.rotation.y = G;
    (Q.dynamic ? t : e).add(K);
    K.updateMatrixWorld(true);
    if (!Q.noCol && !LOOSE_PROPS.has(T)) {
      M(K, G, Q);
    }
    if (typeof K.userData.update == "function") {
      s.push((ie: any) => K.userData.update(ie));
    }
    o.push({
      name: T,
      x: D,
      y: N,
      z: C,
      yaw: G,
    });
    return K;
  }
  function w(T: number, D: number, C = 0, G = 0, j = {}) {
    let N = E("stairs_metal", T, D, C, j, G),
      Q = Math.abs(Math.cos(C)) > 0.5;
    n.push(
      Q
        ? [T - 1.5, D - 0.5, T + 1.5, D + 0.5]
        : [T - 0.5, D - 1.5, T + 0.5, D + 1.5],
    );
    return N;
  }
  function S(T: number, D: number, C = 0, G = 0, j = {}, N = [true, true]) {
    let Q = N[0] && N[1] ? "both" : N[0] ? "left" : N[1] ? "right" : "none",
      K = E(
        "catwalk",
        T,
        D,
        C,
        {
          ...j,
          rails: Q,
        },
        G,
      ),
      ie = Math.abs(Math.cos(C)) > 0.5,
      F = ie ? 1.5 : 0.6,
      X = ie ? 0.6 : 1.5;
    n.push([T - F, D - X, T + F, D + X]);
    return K;
  }
  let z: Record<string, string> = {
      20: "container20",
      40: "container40",
      hc: "container40hc",
    },
    H: Record<string, number> = {
      container20: 2.59,
      container40: 2.59,
      container40hc: 2.9,
    },
    O: Record<string, number> = {
      container20: 6.06,
      container40: 12.19,
      container40hc: 12.19,
    };
  function q(T: any, D: any, C: any, G = 0, j = 1) {
    let N = 0,
      Q: any[] = [];
    for (let K = 0; K < C.length; K++) {
      let [ie, F, X = {}] = C[K],
        ne = z[ie],
        re = (X.dx || 0) + (K ? a(-0.05, 0.05) * j : 0),
        $ = (X.dz || 0) + (K ? a(-0.04, 0.04) * j : 0),
        ue = G + a(-1, 1) * 0.022 * j * (K ? 0.6 : 1) + (X.flip ? Math.PI : 0),
        me = E(
          ne,
          T + re,
          D + $,
          ue,
          {
            color: F,
            seed: Math.floor(a(1, 99999)),
            wear: X.wear ?? a(0.2, 0.85),
            doors: X.doors || 0,
          },
          N,
        ),
        ee = O[ne],
        B = H[ne],
        P = Math.abs(Math.cos(G)) > 0.5,
        V = (P ? ee : 2.44) / 2,
        Y = (P ? 2.44 : ee) / 2;
      n.push([T + re - V, D + $ - Y, T + re + V, D + $ + Y]);
      if (X.reefer) {
        let L = -(ee / 2 + 0.2),
          Z = Math.cos(ue),
          J = Math.sin(ue);
        E(
          "reefer_unit",
          T + re + L * Z,
          D + $ - L * J,
          ue,
          {
            seed: K + 3,
          },
          N + 0.14,
        );
      }
      Q.push(me);
      N += B;
    }
    return {
      top: N,
      objs: Q,
    };
  }
  function U(T: number, D: number) {
    for (let C of n)
      if (T >= C[0] && T <= C[2] && D >= C[1] && D <= C[3]) {
        return true;
      }
    return false;
  }
  return {
    G: i,
    THREE: THREE,
    staticRoot: e,
    dynRoot: t,
    metalRects: n,
    updaters: s,
    placed: o,
    rng: r,
    rnd: a,
    M: l,
    MI: c,
    add: h,
    box: f,
    slab: p,
    cyl: d,
    tube: v,
    rod: g,
    ibeam: x,
    quad: y,
    decal: b,
    label: m,
    col: A,
    place: E,
    stairs: w,
    catwalk: S,
    stack: q,
    isMetal: U,
  };
}
