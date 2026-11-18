// AABB collision world, nav grid and raycasts.
import type { Vector3Like } from "three";
import { Vector3 } from "three";
import type { GameContext } from "../types/context";
import { WORLD } from "../config/world";

const STEP_HEIGHT = 0.42;
const NAV_CELL_SIZE = 0.5;
const NAV_MIN_X = -40;
const NAV_MAX_X = 31;
const NAV_MIN_Z = -32;
const NAV_MAX_Z = 30;
const NAV_GRID_W = Math.round((NAV_MAX_X - NAV_MIN_X) / NAV_CELL_SIZE);
const NAV_GRID_H = Math.round((NAV_MAX_Z - NAV_MIN_Z) / NAV_CELL_SIZE);
const NAV_OBSTACLE_PAD = 0.5;
export function createPhysics(i: GameContext) {
  let e: any[] = [],
    t = true,
    n = new Uint8Array(NAV_GRID_W * NAV_GRID_H),
    s = new Vector3(),
    o = {
      boxes: e,
      bounds: {
        min: WORLD.min.clone(),
        max: WORLD.max.clone(),
      },
      addBox(
        _: any,
        M: any,
        E: {
          surface?: any;
          tag?: any;
          noNav?: any;
          bulletOnly?: any;
          playerOnly?: any;
        } = {},
      ) {
        let w = toVec3(_),
          S = toVec3(M),
          z = {
            min: new Vector3(
              Math.min(w.x, S.x),
              Math.min(w.y, S.y),
              Math.min(w.z, S.z),
            ),
            max: new Vector3(
              Math.max(w.x, S.x),
              Math.max(w.y, S.y),
              Math.max(w.z, S.z),
            ),
            surface: E.surface || "concrete",
            tag: E.tag || "",
            noNav: !!E.noNav,
            bulletOnly: !!E.bulletOnly,
            playerOnly: !!E.playerOnly,
          };
        e.push(z);
        t = true;
        return z;
      },
      removeBox(_: any) {
        let M = e.indexOf(_);
        if (M >= 0) {
          e.splice(M, 1);
          t = true;
        }
      },
      build() {
        a();
      },
      raycast(_: any, M: any, E = 500) {
        let w = E,
          S: any = null,
          z = -1,
          H = 0,
          O = 0,
          q = _.x,
          U = _.y,
          T = _.z,
          D = M.x,
          C = M.y,
          G = M.z;
        if (C < -1e-6) {
          let F = (WORLD.groundY - U) / C;
          if (F > 0 && F < w) {
            if (q + D * F <= WORLD.quayX) {
              w = F;
              O = 1;
            } else {
              let ne = (WORLD.seaY - U) / C;
              if (ne > 0 && ne < w) {
                w = ne;
                O = 2;
              }
            }
          }
        }
        let j = D === 0 ? 1 / 0 : 1 / D,
          N = C === 0 ? 1 / 0 : 1 / C,
          Q = G === 0 ? 1 / 0 : 1 / G;
        for (let F = 0; F < e.length; F++) {
          let X = e[F];
          if (X.playerOnly) {
            continue;
          }
          let ne = 0,
            re = w,
            $ = -1,
            ue = 0,
            me: number | undefined,
            ee: number | undefined;
          if (D !== 0) {
            me = (X.min.x - q) * j;
            ee = (X.max.x - q) * j;
            let B = -1;
            if (me > ee) {
              let P = me;
              me = ee;
              ee = P;
              B = 1;
            }
            if (me > ne) {
              ne = me;
              $ = 0;
              ue = B;
            }
            if (ee < re) {
              re = ee;
            }
            if (ne > re) {
              continue;
            }
          } else if (q < X.min.x || q > X.max.x) {
            continue;
          }
          if (C !== 0) {
            me = (X.min.y - U) * N;
            ee = (X.max.y - U) * N;
            let B = -1;
            if (me > ee) {
              let P = me;
              me = ee;
              ee = P;
              B = 1;
            }
            if (me > ne) {
              ne = me;
              $ = 1;
              ue = B;
            }
            if (ee < re) {
              re = ee;
            }
            if (ne > re) {
              continue;
            }
          } else if (U < X.min.y || U > X.max.y) {
            continue;
          }
          if (G !== 0) {
            me = (X.min.z - T) * Q;
            ee = (X.max.z - T) * Q;
            let B = -1;
            if (me > ee) {
              let P = me;
              me = ee;
              ee = P;
              B = 1;
            }
            if (me > ne) {
              ne = me;
              $ = 2;
              ue = B;
            }
            if (ee < re) {
              re = ee;
            }
            if (ne > re) {
              continue;
            }
          } else if (T < X.min.z || T > X.max.z) {
            continue;
          }
          if (!($ < 0)) {
            w = ne;
            S = X;
            z = $;
            H = ue;
            O = 0;
          }
        }
        if (!S && !O) {
          return null;
        }
        let K = new Vector3(q + D * w, U + C * w, T + G * w);
        if (O) {
          return {
            dist: w,
            point: K,
            normal: new Vector3(0, 1, 0),
            surface:
              O === 2
                ? "water"
                : i.level && i.level.groundSurfaceAt
                  ? i.level.groundSurfaceAt(K.x, K.z)
                  : "concrete",
            box: null,
          };
        }
        let ie = new Vector3();
        ie.setComponent(z, H);
        return {
          dist: w,
          point: K,
          normal: ie,
          surface: S.surface,
          box: S,
        };
      },
      lineOfSight(_: Vector3Like, M: Vector3) {
        s.subVectors(M, _);
        let E = s.length();
        return E < 1e-4
          ? true
          : (s.multiplyScalar(1 / E), !o.raycast(_, s, E - 0.05));
      },
      groundHeight(_: number, M: number, E = 50) {
        let w = _ <= WORLD.quayX ? WORLD.groundY : WORLD.seaY;
        for (let S = 0; S < e.length; S++) {
          let z = e[S];
          if (!z.bulletOnly) {
            if (
              _ >= z.min.x &&
              _ <= z.max.x &&
              M >= z.min.z &&
              M <= z.max.z &&
              z.max.y <= E &&
              z.max.y > w
            ) {
              w = z.max.y;
            }
          }
        }
        return w;
      },
      moveCapsule(
        _: Vector3,
        M: Vector3,
        E: number,
        w = 0.32,
        S = 1.8,
        z = true,
      ) {
        let H = {
            onGround: false,
            hitWall: false,
            hitCeil: false,
            surface: "concrete",
          },
          O = M.x * E,
          q = M.z * E,
          U = Math.max(1, Math.ceil(Math.hypot(O, q) / (w * 0.6))),
          T = _.y;
        for (let K = 0; K < U; K++) {
          _.x += O / U;
          _.z += q / U;
          for (let ie = 0; ie < 3; ie++) {
            let F = false;
            for (let X = 0; X < e.length; X++) {
              let ne = e[X];
              if (
                ne.bulletOnly ||
                ne.max.y <= _.y + (z ? STEP_HEIGHT : 0.08) ||
                ne.min.y >= _.y + S
              ) {
                continue;
              }
              let re = Math.max(ne.min.x, Math.min(ne.max.x, _.x)),
                $ = Math.max(ne.min.z, Math.min(ne.max.z, _.z)),
                ue = _.x - re,
                me = _.z - $,
                ee = ue * ue + me * me;
              if (!(ee >= w * w)) {
                if (ee > 1e-10) {
                  let B = Math.sqrt(ee),
                    P = w - B;
                  ue /= B;
                  me /= B;
                  _.x += ue * P;
                  _.z += me * P;
                  let V = M.x * ue + M.z * me;
                  if (V < 0) {
                    M.x -= ue * V;
                    M.z -= me * V;
                  }
                } else {
                  let B = _.x - ne.min.x,
                    P = ne.max.x - _.x,
                    V = _.z - ne.min.z,
                    Y = ne.max.z - _.z,
                    L = Math.min(B, P, V, Y);
                  if (L === B) {
                    _.x = ne.min.x - w;
                    if (M.x > 0) {
                      M.x = 0;
                    }
                  } else if (L === P) {
                    _.x = ne.max.x + w;
                    if (M.x < 0) {
                      M.x = 0;
                    }
                  } else if (L === V) {
                    _.z = ne.min.z - w;
                    if (M.z > 0) {
                      M.z = 0;
                    }
                  } else {
                    _.z = ne.max.z + w;
                    if (M.z < 0) {
                      M.z = 0;
                    }
                  }
                }
                F = true;
                H.hitWall = true;
              }
            }
            if (!F) {
              break;
            }
          }
        }
        let D = _.y + M.y * E,
          C = w * 0.7,
          G = _.x <= WORLD.quayX + C ? WORLD.groundY : -50,
          j: any = null,
          N = 1 / 0,
          Q = T + (z ? STEP_HEIGHT : 0.08) + 1e-4;
        for (let K = 0; K < e.length; K++) {
          let ie = e[K];
          if (!(
            ie.bulletOnly ||
            _.x + C < ie.min.x ||
            _.x - C > ie.max.x ||
            _.z + C < ie.min.z ||
            _.z - C > ie.max.z
          )) {
            if (ie.max.y <= Q && ie.max.y > G) {
              G = ie.max.y;
              j = ie.surface;
            }
            if (ie.min.y >= T + S - 0.05 && ie.min.y < N) {
              N = ie.min.y;
            }
          }
        }
        if (M.y > 0 && D + S > N) {
          _.y = N - S;
          M.y = 0;
          H.hitCeil = true;
        } else if (D <= G) {
          _.y = G;
          if (M.y < 0) {
            M.y = 0;
          }
          H.onGround = true;
        } else if (z && M.y <= 0 && D - G < STEP_HEIGHT) {
          _.y = G;
          M.y = 0;
          H.onGround = true;
        } else {
          _.y = D;
        }
        if (H.onGround) {
          H.surface =
            j ||
            (i.level && i.level.groundSurfaceAt
              ? i.level.groundSurfaceAt(_.x, _.z)
              : "concrete");
        }
        return H;
      },
      nav: {
        cell: NAV_CELL_SIZE,
        isWalkable(_: number, M: number) {
          r();
          let E = l(_, M);
          return E >= 0 && !n[E];
        },
        findPath(_: { x: number; z: number }, M: { x: number; z: number }) {
          r();
          let E = u(_.x, _.z),
            w = u(M.x, M.z);
          if (E < 0 || w < 0) {
            return null;
          }
          if (E === w) {
            return [new Vector3(M.x, 0, M.z)];
          }
          let S = A(E, w);
          if (!S) {
            return null;
          }
          let z: Vector3[] = [],
            H = 0;
          for (; H < S.length - 1;) {
            let O = H + 1;
            for (let q = S.length - 1; q > H + 1; q--)
              if (h(S[H], S[q])) {
                O = q;
                break;
              }
            z.push(c(S[O]));
            H = O;
          }
          if (l(M.x, M.z) === w && z.length) {
            z[z.length - 1].set(M.x, 0, M.z);
          }
          return z;
        },
        randomPoint(
          _: { x: number | undefined; z: number | undefined },
          M: number,
        ) {
          r();
          for (let w = 0; w < 24; w++) {
            let S = Math.random() * 6.2832,
              z = Math.sqrt(Math.random()) * M,
              H = _.x! + Math.cos(S) * z,
              O = _.z! + Math.sin(S) * z,
              q = l(H, O);
            if (q >= 0 && !n[q]) {
              return new Vector3(H, 0, O);
            }
          }
          let E = u(_.x, _.z);
          return E >= 0 ? c(E) : new Vector3(_.x, 0, _.z);
        },
        clearLine(_: { x: number; z: number }, M: { x: number; z: number }) {
          r();
          let E = l(_.x, _.z),
            w = l(M.x, M.z);
          return E >= 0 && w >= 0 && h(E, w);
        },
        _grid: () => (
          r(),
          {
            blocked: n,
            w: NAV_GRID_W,
            h: NAV_GRID_H,
            minX: NAV_MIN_X,
            minZ: NAV_MIN_Z,
            cell: NAV_CELL_SIZE,
          }
        ),
      },
    };
  function r() {
    if (t) {
      a();
    }
  }
  function a() {
    n = new Uint8Array(NAV_GRID_W * NAV_GRID_H);
    t = false;
    for (let _ of e) {
      if (
        _.noNav ||
        _.bulletOnly ||
        _.max.y < STEP_HEIGHT + 0.05 ||
        _.min.y > 1.5
      ) {
        continue;
      }
      let M = Math.max(
          0,
          Math.floor((_.min.x - NAV_OBSTACLE_PAD - NAV_MIN_X) / NAV_CELL_SIZE),
        ),
        E = Math.min(
          NAV_GRID_W - 1,
          Math.floor((_.max.x + NAV_OBSTACLE_PAD - NAV_MIN_X) / NAV_CELL_SIZE),
        ),
        w = Math.max(
          0,
          Math.floor((_.min.z - NAV_OBSTACLE_PAD - NAV_MIN_Z) / NAV_CELL_SIZE),
        ),
        S = Math.min(
          NAV_GRID_H - 1,
          Math.floor((_.max.z + NAV_OBSTACLE_PAD - NAV_MIN_Z) / NAV_CELL_SIZE),
        );
      for (let z = w; z <= S; z++)
        for (let H = M; H <= E; H++) n[z * NAV_GRID_W + H] = 1;
    }
    for (let _ = 0; _ < NAV_GRID_H; _++)
      for (let M = 0; M < NAV_GRID_W; M++) {
        if (
          NAV_MIN_X + (M + 0.5) * NAV_CELL_SIZE >
            WORLD.quayX - NAV_OBSTACLE_PAD ||
          M === 0 ||
          _ === 0 ||
          M === NAV_GRID_W - 1 ||
          _ === NAV_GRID_H - 1
        ) {
          n[_ * NAV_GRID_W + M] = 1;
        }
      }
  }
  function l(_: any, M: any) {
    let E = Math.floor((_ - NAV_MIN_X) / NAV_CELL_SIZE),
      w = Math.floor((M - NAV_MIN_Z) / NAV_CELL_SIZE);
    return E < 0 || w < 0 || E >= NAV_GRID_W || w >= NAV_GRID_H
      ? -1
      : w * NAV_GRID_W + E;
  }
  function c(_: number) {
    return new Vector3(
      NAV_MIN_X + ((_ % NAV_GRID_W) + 0.5) * NAV_CELL_SIZE,
      0,
      NAV_MIN_Z + (Math.floor(_ / NAV_GRID_W) + 0.5) * NAV_CELL_SIZE,
    );
  }
  function u(_: any, M: any) {
    let E = Math.floor((_ - NAV_MIN_X) / NAV_CELL_SIZE),
      w = Math.floor((M - NAV_MIN_Z) / NAV_CELL_SIZE);
    E = Math.max(0, Math.min(NAV_GRID_W - 1, E));
    w = Math.max(0, Math.min(NAV_GRID_H - 1, w));
    if (!n[w * NAV_GRID_W + E]) {
      return w * NAV_GRID_W + E;
    }
    for (let S = 1; S <= 12; S++) {
      let z = -1,
        H = 1e9;
      for (let O = -S; O <= S; O++)
        for (let q = -S; q <= S; q++) {
          if (Math.max(Math.abs(q), Math.abs(O)) !== S) {
            continue;
          }
          let U = E + q,
            T = w + O;
          if (
            !(U < 0 || T < 0 || U >= NAV_GRID_W || T >= NAV_GRID_H) &&
            !n[T * NAV_GRID_W + U]
          ) {
            let D = q * q + O * O;
            if (D < H) {
              H = D;
              z = T * NAV_GRID_W + U;
            }
          }
        }
      if (z >= 0) {
        return z;
      }
    }
    return -1;
  }
  function h(_: number, M: number) {
    let E = _ % NAV_GRID_W,
      w = Math.floor(_ / NAV_GRID_W),
      S = M % NAV_GRID_W,
      z = Math.floor(M / NAV_GRID_W),
      H = Math.abs(S - E),
      O = Math.abs(z - w),
      q = E < S ? 1 : -1,
      U = w < z ? 1 : -1,
      T = H - O;
    for (let D = 0; D < 600; D++) {
      if (n[w * NAV_GRID_W + E]) {
        return false;
      }
      if (E === S && w === z) {
        return true;
      }
      let C = 2 * T;
      if (C > -O && C < H) {
        if (n[w * NAV_GRID_W + E + q] || n[(w + U) * NAV_GRID_W + E]) {
          return false;
        }
        T += H - O;
        E += q;
        w += U;
      } else {
        if (C > -O) {
          T -= O;
          E += q;
        } else {
          T += H;
          w += U;
        }
      }
    }
    return false;
  }
  let f = new Float32Array(NAV_GRID_W * NAV_GRID_H),
    p = new Int32Array(NAV_GRID_W * NAV_GRID_H),
    d = new Uint32Array(NAV_GRID_W * NAV_GRID_H),
    v = new Uint32Array(NAV_GRID_W * NAV_GRID_H),
    g = 0,
    x: number[] = [],
    y: number[] = [];
  function b(_: number, M: number) {
    let E = x.length;
    for (x.push(_), y.push(M); E > 0;) {
      let w = (E - 1) >> 1;
      if (y[w] <= M) {
        break;
      }
      x[E] = x[w];
      y[E] = y[w];
      E = w;
    }
    x[E] = _;
    y[E] = M;
  }
  function m() {
    let _ = x[0],
      M = x.pop(),
      E = y.pop(),
      w = x.length;
    if (w) {
      let S = 0;
      for (;;) {
        let z = 2 * S + 1;
        if (z >= w || (z + 1 < w && y[z + 1] < y[z] && z++, y[z] >= E!)) {
          break;
        }
        x[S] = x[z];
        y[S] = y[z];
        S = z;
      }
      x[S] = M!;
      y[S] = E!;
    }
    return _;
  }
  function A(_: number, M: number) {
    g++;
    x.length = 0;
    y.length = 0;
    let E = M % NAV_GRID_W,
      w = Math.floor(M / NAV_GRID_W),
      S = (O: number) => {
        let q = Math.abs((O % NAV_GRID_W) - E),
          U = Math.abs(Math.floor(O / NAV_GRID_W) - w);
        return q + U + (1.4142 - 2) * Math.min(q, U);
      };
    f[_] = 0;
    d[_] = g;
    p[_] = -1;
    b(_, S(_));
    let z = 0;
    for (; x.length;) {
      let O = m();
      if (O === M) {
        break;
      }
      if (v[O] === g) {
        continue;
      }
      v[O] = g;
      if (++z > 9e3) {
        return null;
      }
      let q = O % NAV_GRID_W,
        U = Math.floor(O / NAV_GRID_W);
      for (let T = -1; T <= 1; T++)
        for (let D = -1; D <= 1; D++) {
          if (!D && !T) {
            continue;
          }
          let C = q + D,
            G = U + T;
          if (C < 0 || G < 0 || C >= NAV_GRID_W || G >= NAV_GRID_H) {
            continue;
          }
          let j = G * NAV_GRID_W + C;
          if (
            n[j] ||
            v[j] === g ||
            (D && T && (n[U * NAV_GRID_W + C] || n[G * NAV_GRID_W + q]))
          ) {
            continue;
          }
          let N = f[O] + (D && T ? 1.4142 : 1);
          if (d[j] !== g || N < f[j]) {
            f[j] = N;
            d[j] = g;
            p[j] = O;
            b(j, N + S(j));
          }
        }
    }
    if (d[M] !== g) {
      return null;
    }
    let H: number[] = [];
    for (let O = M; O !== -1; O = p[O]) H.push(O);
    H.reverse();
    return H;
  }
  return o;
}
function toVec3(i: number[] | Vector3) {
  return (i as Vector3).isVector3
    ? (i as Vector3).clone()
    : new Vector3((i as number[])[0], (i as number[])[1], (i as number[])[2]);
}
