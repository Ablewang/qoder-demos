// Muzzle flash, tracers, sparks, smoke, debris, shells and decals.
import type { BoxGeometry, ColorRepresentation, Vector3Like } from "three";
import { Color, Group, Mesh, Vector3 } from "three";
import type { GameContext } from "../types/context";
import { SKY, SUN } from "../config/world";
import { roundedBoxGeo } from "../utils/geometry";
import {
  SMOKE_COLS,
  SMOKE_ROWS,
  SPARK_COLS,
  SPARK_DROPLET,
  SPARK_FIREBALL,
  SPARK_GLOW,
  SPARK_RING,
  SPARK_ROWS,
  SPARK_STAR_A,
  SPARK_STREAK,
  SPARK_TRACER,
  bakeSmokeAtlas,
  bakeSparkAtlas,
} from "./atlases";
import {
  DebrisSystem,
  DecalSystem,
  LightPool,
  PARTICLE_FLAG_BOUNCE,
  PARTICLE_FLAG_KILL_ON_GROUND,
  ParticlePool,
  ShellSystem,
  createBillboardSystem,
} from "./systems";

const SMOKE_PARTICLE_CAP = 1400;
const SPARK_PARTICLE_CAP = 3200;
const fxRandRange = (i: number, e: number) => i + (e - i) * Math.random();
const _fxNormal = new Vector3();
const _fxDir = new Vector3();
const _fxReflectDir = new Vector3();
const _fxJitterOut = new Vector3();
const _fxProbePos = new Vector3();
const _fxGroundPos = new Vector3();
const _fxUp = new Vector3(0, 1, 0);
const _fxDown = new Vector3(0, -1, 0);
const _fxParsedColor = new Color();
const _fxRgbOut = [1, 1, 1];
function fxColorToRgb(
  i: number[] | ColorRepresentation | null,
  e: number,
  t: number,
  n: number,
) {
  if (i == null) {
    _fxRgbOut[0] = e;
    _fxRgbOut[1] = t;
    _fxRgbOut[2] = n;
  } else if (Array.isArray(i)) {
    _fxRgbOut[0] = i[0];
    _fxRgbOut[1] = i[1];
    _fxRgbOut[2] = i[2];
  } else if ((i as Color).isColor) {
    _fxRgbOut[0] = (i as Color).r;
    _fxRgbOut[1] = (i as Color).g;
    _fxRgbOut[2] = (i as Color).b;
  } else {
    _fxParsedColor.set(i);
    _fxRgbOut[0] = _fxParsedColor.r;
    _fxRgbOut[1] = _fxParsedColor.g;
    _fxRgbOut[2] = _fxParsedColor.b;
  }
  return _fxRgbOut;
}
function fxJitterDir(i: Vector3, e: number, t: Vector3) {
  let n = Math.random() * 2 - 1,
    s = Math.random() * 2 - 1,
    o = Math.random() * 2 - 1,
    r = Math.hypot(n, s, o) || 1,
    a = (e * Math.cbrt(Math.random())) / r;
  t.set(i.x + n * a, i.y + s * a, i.z + o * a);
  let l = t.length();
  if (l < 1e-4) {
    t.copy(i);
  } else {
    t.multiplyScalar(1 / l);
  }
  return t;
}
export async function createFx(i: GameContext) {
  let e = i.scene || (i.render && i.render.scene),
    t = new Vector3(-0.8, 0, 0.3),
    n = new Vector3(SUN.color.r, SUN.color.g, SUN.color.b).multiplyScalar(
      (SUN.intensity / Math.PI) * 0.9,
    ),
    s = new Vector3(
      SKY.zenith.r * 0.6 + SKY.horizonAway.r * 0.5 + SKY.fog.r * 0.25,
      SKY.zenith.g * 0.6 + SKY.horizonAway.g * 0.5 + SKY.fog.g * 0.25,
      SKY.zenith.b * 0.6 + SKY.horizonAway.b * 0.5 + SKY.fog.b * 0.25,
    ),
    o = new Vector3(
      SKY.horizonAway.r * 0.3 + SKY.fog.r * 0.14,
      SKY.horizonAway.g * 0.3 + SKY.fog.g * 0.14,
      SKY.horizonAway.b * 0.3 + SKY.fog.b * 0.14,
    ),
    r = createBillboardSystem(i, SMOKE_PARTICLE_CAP, {
      lit: true,
      tex: bakeSmokeAtlas(128),
      cols: SMOKE_COLS,
      rows: SMOKE_ROWS,
      renderOrder: 10,
      sun: n,
      sunDir: SUN.dir.clone().normalize(),
      ambLo: o,
      ambHi: s,
    }),
    a = createBillboardSystem(i, SPARK_PARTICLE_CAP, {
      lit: false,
      tex: bakeSparkAtlas(128),
      cols: SPARK_COLS,
      rows: SPARK_ROWS,
      renderOrder: 20,
    }),
    l = new ParticlePool(SMOKE_PARTICLE_CAP, true),
    c = new ParticlePool(SPARK_PARTICLE_CAP - 160, false),
    u = new LightPool(48),
    h = new DebrisSystem(i, 256),
    f = new ShellSystem(i, 60),
    p = new DecalSystem(i, 160),
    d = new Group();
  d.name = "fx";
  d.add(p.mesh, h.mesh, f.mesh, r.mesh, a.mesh);
  e.add(d);
  let v = 0,
    g = -1,
    x = -1,
    y = () => i.render && i.render.lightPool,
    b = (ee: Vector3, B: number, P: number, V: number, Y: number) => {
      let L = y();
      if (L) {
        L.flash(ee, B, P, V, Y);
      }
    };
  function m(ee: Vector3Like, B: null | Vector3) {
    let P = i.physics;
    if (!P || !P.raycast) {
      return 1;
    }
    _fxProbePos.copy(ee);
    if (B) {
      _fxProbePos.addScaledVector(B, 0.08);
    }
    _fxProbePos.y += 0.03;
    let V: any = null;
    try {
      V = P.raycast(_fxProbePos, SUN.dir, 90);
    } catch {
      V = null;
    }
    return V ? 0.2 : 1;
  }
  function A(ee: Vector3Like) {
    let B = i.physics;
    if (!B || !B.raycast) {
      return 0;
    }
    _fxProbePos.copy(ee);
    _fxProbePos.y += 0.1;
    let P: any = null;
    try {
      P = B.raycast(_fxProbePos, _fxDown, 12);
    } catch {
      P = null;
    }
    return P ? P.point.y : -50;
  }
  function _(
    ee: number,
    B: number,
    P: number,
    V: number,
    Y: number,
    L: number,
    Z: number,
    J: number,
    oe: number,
    fe: number,
    le: number,
    R: number,
    I: number,
    se: number,
    ae: number,
    k: number,
    ce: number,
    ve: number,
  ) {
    let _e = l.emit(ee, B, P, V, Y, L, Z, J, oe);
    return _e < 0
      ? -1
      : ((l.r[_e] = fe),
        (l.g[_e] = le),
        (l.b[_e] = R),
        (l.a[_e] = I),
        (l.shade[_e] = se),
        (l.drag[_e] = ae),
        (l.grav[_e] = -k),
        (l.wind[_e] = ce),
        (l.turb[_e] = 0.5),
        (l.rot[_e] = Math.random() * 6.283),
        (l.rotv[_e] = (Math.random() - 0.5) * 1.2),
        (l.frame[_e] = ve < 0 ? (Math.random() * 6) | 0 : ve),
        (l.fin[_e] = 0.06),
        (l.fout[_e] = 0.3),
        (l.sk[_e] = 2.5),
        _e);
  }
  function M(
    ee: number,
    B: number,
    P: number,
    V: number,
    Y: number,
    L: number,
    Z: number,
    J: number,
    oe: number,
    fe: number,
    le: number,
    R: number,
  ) {
    let I = c.emit(ee, B, P, V, Y, L, Z, J, J * 0.5);
    return I < 0
      ? -1
      : ((c.mode[I] = 1),
        (c.frame[I] = SPARK_STREAK),
        (c.stretch[I] = 0.03),
        (c.grav[I] = 9.81),
        (c.drag[I] = 0.9),
        (c.ramp[I] = 1),
        (c.r[I] = oe * 0.6),
        (c.g[I] = fe * 0.6),
        (c.b[I] = le * 0.6),
        (c.fout[I] = 0.55),
        (c.flags[I] = R),
        (c.sk[I] = 1),
        I);
  }
  function E(
    ee: Vector3,
    B: Vector3,
    P: number,
    V: number,
    Y: number,
    L: number,
    Z: number,
    J: number,
    oe: number,
    fe: number,
    le: number,
    R: number,
  ) {
    for (let I = 0; I < P; I++) {
      fxJitterDir(B, L, _fxJitterOut);
      let se = fxRandRange(V, Y) * (0.35 + 0.65 * Math.random());
      M(
        ee.x,
        ee.y,
        ee.z,
        _fxJitterOut.x * se,
        _fxJitterOut.y * se,
        _fxJitterOut.z * se,
        fxRandRange(Z, J),
        fxRandRange(0.01, 0.02),
        oe * fxRandRange(0.6, 1.2),
        fe * fxRandRange(0.6, 1.2),
        le,
        R,
      );
    }
  }
  function w(
    ee: number,
    B: number,
    P: number,
    V: number,
    Y: number,
    L: number,
    Z: number,
    J: number,
    oe: number,
    fe: number,
  ) {
    let le = c.emit(ee, B, P, 0, 0, 0, V, Y, L);
    return le < 0
      ? -1
      : ((c.frame[le] = fe),
        (c.r[le] = Z),
        (c.g[le] = J),
        (c.b[le] = oe),
        (c.fout[le] = 0.2),
        (c.rot[le] = Math.random() * 6.283),
        (c.sk[le] = 1.5),
        le);
  }
  function S(
    ee: number,
    B: number,
    P: number,
    V: number,
    Y: number,
    L: number,
    Z: number,
    J: number,
    oe: number,
  ) {
    let fe = c.emit(ee, B, P, 0, 0, 0, V, Y, L);
    return fe < 0
      ? -1
      : ((c.mode[fe] = 2),
        (c.frame[fe] = SPARK_RING),
        (c.r[fe] = Z),
        (c.g[fe] = J),
        (c.b[fe] = oe),
        (c.fout[fe] = 0.15),
        (c.fin[fe] = 0.08),
        (c.sk[fe] = 2.2),
        (c.rot[fe] = Math.random() * 6.283),
        fe);
  }
  function z(
    ee: any,
    B: Vector3,
    P: number,
    V: number,
    Y: number,
    L: number,
    Z: number,
    J: number,
    oe: number,
    fe: number,
    le: number,
    R: number,
    I: number,
    se: number,
    ae: number,
    k: number,
  ) {
    for (let ce = 0; ce < P; ce++) {
      fxJitterDir(B, ae, _fxJitterOut);
      let ve = fxRandRange(V, Y),
        _e = fxRandRange(0.8, 1.15);
      h.add(
        ee.x + _fxJitterOut.x * 0.02,
        ee.y + _fxJitterOut.y * 0.02,
        ee.z + _fxJitterOut.z * 0.02,
        _fxJitterOut.x * ve,
        _fxJitterOut.y * ve + 0.8,
        _fxJitterOut.z * ve,
        fxRandRange(L, Z),
        fxRandRange(J, oe),
        fxRandRange(fe, le),
        R * _e,
        I * _e,
        se * _e,
        fxRandRange(3.5, 6),
        k,
      );
    }
  }
  function H(ee: Vector3, B: any, P = 12) {
    _fxDir.copy(B || _fxUp);
    if (_fxDir.lengthSq() < 1e-6) {
      _fxDir.copy(_fxUp);
    }
    _fxDir.normalize();
    E(ee, _fxDir, P, 5, 18, 0.6, 0.15, 0.5, 36, 22, 9, PARTICLE_FLAG_BOUNCE);
    w(ee.x, ee.y, ee.z, 0.05, 0.2, 0.35, 10, 6.5, 3, SPARK_GLOW);
  }
  function O(
    ee: Vector3,
    B: {
      size?: number;
      life?: number;
      rise?: number;
      count?: number;
      alpha?: number;
      color?: any;
      vel?: any;
    } = {},
  ) {
    let P = B.size || 1,
      V = B.life || 2.5,
      Y = B.rise === undefined ? 0.6 : B.rise,
      L = fxColorToRgb(B.color, 0.32, 0.32, 0.33),
      Z = B.vel,
      J = m(ee, null),
      oe = B.count || 3;
    for (let fe = 0; fe < oe; fe++)
      _(
        ee.x + (Math.random() - 0.5) * 0.2 * P,
        ee.y + (Math.random() - 0.5) * 0.2 * P,
        ee.z + (Math.random() - 0.5) * 0.2 * P,
        (Z ? Z.x : 0) + (Math.random() - 0.5) * 0.4,
        (Z ? Z.y : 0) + Math.random() * 0.3,
        (Z ? Z.z : 0) + (Math.random() - 0.5) * 0.4,
        V * fxRandRange(0.75, 1.2),
        P * 0.3,
        P * fxRandRange(1, 1.5),
        L[0],
        L[1],
        L[2],
        B.alpha || 0.4,
        J,
        1.2,
        Y,
        1,
        -1,
      );
  }
  function q(ee: Vector3, B: Vector3, P = 1, V = 0.5, Y = 0.48, L = 0.45) {
    _fxNormal.copy(B || _fxUp);
    if (_fxNormal.lengthSq() < 1e-6) {
      _fxNormal.copy(_fxUp);
    }
    _fxNormal.normalize();
    let Z = m(ee, _fxNormal);
    for (let J = 0; J < 8; J++) {
      fxJitterDir(_fxNormal, 0.5, _fxJitterOut);
      let oe = fxRandRange(1, 4.5) * P,
        fe = fxRandRange(0.85, 1.1);
      _(
        ee.x + _fxNormal.x * 0.03,
        ee.y + _fxNormal.y * 0.03,
        ee.z + _fxNormal.z * 0.03,
        _fxJitterOut.x * oe,
        _fxJitterOut.y * oe,
        _fxJitterOut.z * oe,
        fxRandRange(0.5, 1.1),
        0.08 * P,
        fxRandRange(0.35, 0.7) * P,
        V * fe,
        Y * fe,
        L * fe,
        0.9,
        Z,
        3.5,
        0.15,
        0.6,
        J < 3 ? 7 : -1,
      );
    }
    for (let J = 0; J < 2; J++)
      _(
        ee.x + _fxNormal.x * 0.15,
        ee.y + _fxNormal.y * 0.15,
        ee.z + _fxNormal.z * 0.15,
        _fxNormal.x * 0.5 + (Math.random() - 0.5) * 0.3,
        _fxNormal.y * 0.5 + 0.1,
        _fxNormal.z * 0.5 + (Math.random() - 0.5) * 0.3,
        fxRandRange(2.2, 3.6),
        0.25 * P,
        fxRandRange(0.9, 1.5) * P,
        V,
        Y,
        L,
        0.28,
        Z,
        1.5,
        0.1,
        1,
        -1,
      );
    return Z;
  }
  function U(
    ee: Vector3Like,
    B: {
      color?: any;
      mat?: any;
      size?: any;
      speed?: any;
      normal?: any;
      count?: any;
      spread?: any;
    } = {},
  ) {
    let P: number[] | undefined;
    if (B.color !== undefined) {
      P = fxColorToRgb(B.color, 0.4, 0.4, 0.4);
    } else if (B.mat) {
      let oe: any = null;
      try {
        oe = typeof B.mat == "string" ? i.mats.get(B.mat) : B.mat;
      } catch {
        oe = null;
      }
      P = fxColorToRgb(oe && oe.color ? oe.color : null, 0.4, 0.4, 0.4);
    } else {
      P = fxColorToRgb(null, 0.4, 0.39, 0.37);
    }
    let V = P[0],
      Y = P[1],
      L = P[2],
      Z = B.size || 0.06,
      J = B.speed || 5;
    _fxNormal.copy(B.normal || _fxUp).normalize();
    z(
      ee,
      _fxNormal,
      Math.min(B.count || 6, 40),
      J * 0.4,
      J * 1.3,
      Z * 0.4,
      Z * 1.2,
      Z * 0.3,
      Z * 0.9,
      Z * 0.4,
      Z * 1.2,
      V,
      Y,
      L,
      B.spread || 1,
      A(ee),
    );
  }
  function T(ee: Vector3, B = 1) {
    let P = m(ee, _fxUp),
      V = ee.y;
    for (let fe = 0; fe < 5; fe++) {
      let le = fxRandRange(0.35, 0.6) * B,
        R = _(
          ee.x + (Math.random() - 0.5) * 0.08 * B,
          V + 0.1 * B,
          ee.z + (Math.random() - 0.5) * 0.08 * B,
          (Math.random() - 0.5) * 0.5,
          fxRandRange(1.6, 2.8) * Math.sqrt(B),
          (Math.random() - 0.5) * 0.5,
          fxRandRange(0.4, 0.65),
          le * 0.3,
          le,
          0.72,
          0.78,
          0.84,
          0.95,
          P,
          0.5,
          -7,
          0,
          6,
        );
      if (R >= 0) {
        l.rot[R] = (Math.random() - 0.5) * 0.3;
        l.rotv[R] = 0;
        l.turb[R] = 0;
        l.sk[R] = 3;
        l.fout[R] = 0.4;
      }
    }
    for (let fe = 0; fe < 2; fe++)
      _(
        ee.x,
        V + 0.15 * B,
        ee.z,
        (Math.random() - 0.5) * 0.6,
        0.5,
        (Math.random() - 0.5) * 0.6,
        fxRandRange(0.7, 1.1),
        0.2 * B,
        0.7 * B,
        0.7,
        0.75,
        0.8,
        0.14,
        P,
        2,
        0,
        0.8,
        -1,
      );
    let Y = 1.9 * P + 0.35,
      L = 1.5 * P + 0.45,
      Z = 1.05 * P + 0.55,
      J = Math.round(14 * Math.min(B, 1.6));
    for (let fe = 0; fe < J; fe++) {
      fxJitterDir(_fxUp, 0.75, _fxJitterOut);
      let le = fxRandRange(1.5, 4.8) * Math.sqrt(B),
        R = c.emit(
          ee.x,
          V + 0.03,
          ee.z,
          _fxJitterOut.x * le,
          Math.abs(_fxJitterOut.y) * le,
          _fxJitterOut.z * le,
          fxRandRange(0.5, 1),
          fxRandRange(0.012, 0.024),
          0.01,
        );
      if (R >= 0) {
        c.mode[R] = 1;
        c.frame[R] = SPARK_DROPLET;
        c.stretch[R] = 0.012;
        c.grav[R] = 9.81;
        c.drag[R] = 0.4;
        c.r[R] = Y;
        c.g[R] = L;
        c.b[R] = Z;
        c.fout[R] = 0.7;
        c.flags[R] = PARTICLE_FLAG_KILL_ON_GROUND;
        c.sk[R] = 1;
        c.gy[R] = V;
      }
    }
    S(
      ee.x,
      V + 0.012,
      ee.z,
      0.9,
      0.12 * B,
      1.5 * B,
      0.3 * P + 0.08,
      0.27 * P + 0.09,
      0.22 * P + 0.1,
    );
    let oe = S(
      ee.x,
      V + 0.012,
      ee.z,
      1.3,
      0.05 * B,
      1 * B,
      0.2 * P + 0.05,
      0.18 * P + 0.06,
      0.15 * P + 0.07,
    );
    if (oe >= 0) {
      c.fin[oe] = 0.35;
    }
  }
  let D = {
    p: new Vector3(),
  };
  function C(
    ee: Vector3Like,
    B: any,
    P: string,
    V: Vector3 | null | undefined,
    Y: any,
  ) {
    _fxNormal.copy(B || _fxUp);
    if (_fxNormal.lengthSq() < 1e-6) {
      _fxNormal.copy(_fxUp);
    }
    _fxNormal.normalize();
    if (V && V.lengthSq() > 1e-6) {
      _fxDir.copy(V).normalize();
    } else {
      _fxDir.copy(_fxNormal).negate();
    }
    _fxReflectDir
      .copy(_fxDir)
      .addScaledVector(_fxNormal, -2 * _fxDir.dot(_fxNormal))
      .normalize();
    let L = D.p.copy(ee);
    if (Y) {
      P = "enemy";
    }
    if (
      P !== "enemy" &&
      P !== "water" &&
      _fxNormal.y > 0.7 &&
      i.ground &&
      i.ground.isPuddle
    ) {
      try {
        if (i.ground.isPuddle(L.x, L.z) && L.y < 0.08) {
          P = "water";
        }
      } catch {}
    }
    let J =
        (i.camera
          ? i.camera.position
          : _fxProbePos.set(0, 0, 0)
        ).distanceToSquared(L) > 3025,
      oe = J ? 0.5 : 1,
      fe = _fxNormal.x,
      le = _fxNormal.y,
      R = _fxNormal.z;
    switch (P) {
      case "metal": {
        _fxJitterOut
          .copy(_fxReflectDir)
          .addScaledVector(_fxNormal, 0.6)
          .normalize();
        _fxDir.copy(_fxJitterOut);
        E(
          L,
          _fxDir,
          Math.round(18 * oe),
          6,
          24,
          0.55,
          0.1,
          0.38,
          40,
          25,
          10.5,
          0,
        );
        E(
          L,
          _fxDir,
          2 + ((Math.random() * 2) | 0),
          9,
          18,
          0.9,
          0.7,
          1.3,
          32,
          18,
          7,
          PARTICLE_FLAG_BOUNCE,
        );
        w(
          L.x + fe * 0.03,
          L.y + le * 0.03,
          L.z + R * 0.03,
          0.05,
          0.25,
          0.45,
          16,
          11,
          5.5,
          SPARK_GLOW,
        );
        w(
          L.x + fe * 0.04,
          L.y + le * 0.04,
          L.z + R * 0.04,
          0.04,
          0.35,
          0.5,
          9,
          6,
          2.6,
          SPARK_STAR_A + ((Math.random() * 2) | 0),
        );
        if (v - g > 0.09) {
          g = v;
          _fxProbePos.copy(L).addScaledVector(_fxNormal, 0.12);
          b(_fxProbePos, 16760944, 10, 5, 0.05);
        }
        let I = m(L, _fxNormal);
        for (let se = 0; se < 2; se++)
          _(
            L.x + fe * 0.04,
            L.y + le * 0.04,
            L.z + R * 0.04,
            fe * 0.8 + (Math.random() - 0.5) * 0.5,
            le * 0.8 + 0.2,
            R * 0.8 + (Math.random() - 0.5) * 0.5,
            fxRandRange(0.5, 0.9),
            0.06,
            fxRandRange(0.3, 0.5),
            0.4,
            0.4,
            0.41,
            0.4,
            I,
            2.5,
            0.3,
            0.8,
            -1,
          );
        if (!J) {
          z(
            L,
            _fxNormal,
            2,
            1.5,
            4,
            0.012,
            0.03,
            0.003,
            0.005,
            0.01,
            0.025,
            0.2,
            0.21,
            0.23,
            0.8,
            A(L),
          );
        }
        p.add(L, _fxNormal, "bullet_metal");
        break;
      }
      case "wood": {
        let I = q(L, _fxNormal, 0.75, 0.5, 0.42, 0.32);
        z(
          L,
          _fxNormal,
          J ? 3 : 7,
          2,
          6,
          0.004,
          0.009,
          0.03,
          0.1,
          0.004,
          0.012,
          0.62,
          0.5,
          0.33,
          0.7,
          A(L),
        );
        if (I > 0.5 && Math.random() < 0.3) {
          w(L.x, L.y, L.z, 0.04, 0.1, 0.2, 3, 2, 1, SPARK_GLOW);
        }
        p.add(L, _fxNormal, "bullet_wood");
        break;
      }
      case "water": {
        T(L, 1);
        break;
      }
      case "rubber":
      case "dirt": {
        let I = m(L, _fxNormal),
          se = P === "dirt",
          ae = se ? 0.3 : 0.14,
          k = se ? 0.25 : 0.14,
          ce = se ? 0.19 : 0.14;
        for (let ve = 0; ve < 5; ve++) {
          fxJitterDir(_fxNormal, 0.6, _fxJitterOut);
          let _e = fxRandRange(0.6, 2.6);
          _(
            L.x + fe * 0.03,
            L.y + le * 0.03,
            L.z + R * 0.03,
            _fxJitterOut.x * _e,
            _fxJitterOut.y * _e,
            _fxJitterOut.z * _e,
            fxRandRange(0.5, 1),
            0.07,
            fxRandRange(0.3, 0.55),
            ae,
            k,
            ce,
            0.85,
            I,
            3.5,
            0.1,
            0.6,
            ve < 2 ? 7 : -1,
          );
        }
        z(
          L,
          _fxNormal,
          3,
          1.5,
          4,
          0.01,
          0.03,
          0.008,
          0.02,
          0.01,
          0.03,
          ae * 0.8,
          k * 0.8,
          ce * 0.8,
          0.7,
          A(L),
        );
        p.add(L, _fxNormal, "soot", 0.2, 1, 0.8);
        break;
      }
      case "glass": {
        for (let I = 0; I < 12; I++) {
          fxJitterDir(_fxNormal, 0.9, _fxJitterOut);
          let se = fxRandRange(1.5, 6),
            ae = c.emit(
              L.x,
              L.y,
              L.z,
              _fxJitterOut.x * se,
              _fxJitterOut.y * se,
              _fxJitterOut.z * se,
              fxRandRange(0.4, 0.9),
              fxRandRange(0.012, 0.02),
              0.008,
            );
          if (ae >= 0) {
            c.mode[ae] = 1;
            c.frame[ae] = SPARK_DROPLET;
            c.stretch[ae] = 0.01;
            c.grav[ae] = 9.81;
            c.r[ae] = 2.6;
            c.g[ae] = 2.7;
            c.b[ae] = 2.8;
            c.flags[ae] = PARTICLE_FLAG_KILL_ON_GROUND;
            c.ramp[ae] = 3;
          }
        }
        z(
          L,
          _fxNormal,
          4,
          1.5,
          5,
          0.01,
          0.03,
          0.002,
          0.004,
          0.01,
          0.03,
          0.62,
          0.72,
          0.74,
          0.8,
          A(L),
        );
        _(
          L.x,
          L.y,
          L.z,
          fe * 0.6,
          le * 0.6 + 0.2,
          R * 0.6,
          0.6,
          0.08,
          0.4,
          0.75,
          0.8,
          0.82,
          0.2,
          m(L, _fxNormal),
          2.5,
          0.2,
          0.8,
          -1,
        );
        p.add(L, _fxNormal, "bullet_glass");
        break;
      }
      case "enemy": {
        _fxJitterOut
          .copy(_fxReflectDir)
          .addScaledVector(_fxNormal, 0.8)
          .normalize();
        _fxDir.copy(_fxJitterOut);
        E(
          L,
          _fxDir,
          Math.round(13 * oe),
          5,
          20,
          0.9,
          0.12,
          0.45,
          42,
          29,
          14,
          0,
        );
        E(L, _fxDir, 2, 6, 12, 1, 0.6, 1.1, 32, 18, 7, PARTICLE_FLAG_BOUNCE);
        w(L.x, L.y, L.z, 0.06, 0.3, 0.55, 18, 12, 6, SPARK_GLOW);
        w(
          L.x,
          L.y,
          L.z,
          0.04,
          0.3,
          0.45,
          8,
          5,
          2.4,
          SPARK_STAR_A + ((Math.random() * 2) | 0),
        );
        if (v - g > 0.09) {
          g = v;
          b(L, 16756832, 8, 4.5, 0.05);
        }
        let I = m(L, _fxNormal);
        for (let se = 0; se < 2; se++)
          _(
            L.x,
            L.y,
            L.z,
            fe * 0.5 + (Math.random() - 0.5) * 0.4,
            le * 0.5 + 0.3,
            R * 0.5 + (Math.random() - 0.5) * 0.4,
            fxRandRange(0.6, 1.1),
            0.06,
            fxRandRange(0.3, 0.5),
            0.13,
            0.13,
            0.14,
            0.65,
            I,
            2.2,
            0.5,
            0.9,
            -1,
          );
        if (!J) {
          let se = Math.random() < 0.35;
          z(
            L,
            _fxNormal,
            3,
            2,
            6,
            0.012,
            0.035,
            0.004,
            0.008,
            0.012,
            0.03,
            0.6,
            se ? 0.2 : 0.62,
            se ? 0.05 : 0.64,
            0.8,
            A(L),
          );
        }
        break;
      }
      default: {
        q(L, _fxNormal, 1, 0.52, 0.5, 0.47);
        z(
          L,
          _fxNormal,
          J ? 2 : 4,
          1.5,
          5.5,
          0.012,
          0.035,
          0.008,
          0.02,
          0.012,
          0.035,
          0.42,
          0.41,
          0.39,
          0.7,
          A(L),
        );
        _fxJitterOut
          .copy(_fxReflectDir)
          .addScaledVector(_fxNormal, 0.7)
          .normalize();
        _fxDir.copy(_fxJitterOut);
        for (let I = 0; I < 4; I++) {
          fxJitterDir(_fxDir, 0.5, _fxJitterOut);
          let se = fxRandRange(3, 9),
            ae = _(
              L.x,
              L.y,
              L.z,
              _fxJitterOut.x * se,
              _fxJitterOut.y * se,
              _fxJitterOut.z * se,
              fxRandRange(0.25, 0.45),
              0.03,
              0.09,
              0.6,
              0.58,
              0.54,
              0.7,
              1,
              2,
              -6,
              0.2,
              7,
            );
          if (ae >= 0) {
            l.turb[ae] = 0;
          }
        }
        if (Math.random() < 0.3) {
          E(L, _fxDir, 3, 4, 10, 0.6, 0.08, 0.2, 26, 15, 6, 0);
        }
        p.add(L, _fxNormal, "bullet_concrete");
      }
    }
  }
  function G(
    ee: Vector3,
    B: Vector3,
    P: {
      color?: any;
      intensity?: any;
      speed?: any;
      width?: any;
      trail?: any;
    } = {},
  ) {
    let V = fxColorToRgb(P.color, 1, 0.8, 0.46),
      Y = P.intensity || 16;
    u.add(
      ee,
      B,
      V[0] * Y,
      V[1] * Y,
      V[2] * Y,
      P.speed || 260,
      P.width || 0.024,
    );
    if (v - x > 0.07 && P.trail !== false) {
      x = v;
      _fxJitterOut.subVectors(B, ee);
      let L = _fxJitterOut.length();
      if (L > 2) {
        _fxJitterOut.multiplyScalar(1 / L);
        let Z = 5,
          J = Math.min(L, 7),
          oe = m(ee, null);
        for (let fe = 0; fe < Z; fe++) {
          let le = 0.6 + ((fe + Math.random()) / Z) * (J - 0.6),
            R = _(
              ee.x + _fxJitterOut.x * le,
              ee.y + _fxJitterOut.y * le,
              ee.z + _fxJitterOut.z * le,
              _fxJitterOut.x * 0.6,
              0.05,
              _fxJitterOut.z * 0.6,
              fxRandRange(0.45, 0.8),
              0.04,
              fxRandRange(0.12, 0.2),
              0.6,
              0.6,
              0.62,
              0.1,
              oe,
              2,
              0.1,
              0.7,
              -1,
            );
          if (R >= 0) {
            l.fin[R] = 0.25;
          }
        }
      }
    }
  }
  function j(ee: Vector3Like, B: any, P: { scale?: any; color?: any } = {}) {
    let V = P.scale || 1;
    _fxDir.copy(B || _fxUp);
    if (_fxDir.lengthSq() < 1e-6) {
      _fxDir.set(0, 0, -1);
    }
    _fxDir.normalize();
    let Y = fxColorToRgb(P.color, 1, 0.68, 0.32),
      L = ee.x,
      Z = ee.y,
      J = ee.z,
      oe = Y[0],
      fe = Y[1],
      le = Y[2];
    w(
      L + _fxDir.x * 0.1 * V,
      Z + _fxDir.y * 0.1 * V,
      J + _fxDir.z * 0.1 * V,
      0.045,
      0.75 * V,
      1.15 * V,
      34 * oe,
      34 * fe,
      34 * le,
      SPARK_STAR_A,
    );
    w(
      L + _fxDir.x * 0.14 * V,
      Z + _fxDir.y * 0.14 * V,
      J + _fxDir.z * 0.14 * V,
      0.035,
      0.5 * V,
      0.85 * V,
      22 * oe,
      22 * fe,
      22 * le,
      SPARK_STAR_A + 1,
    );
    w(
      L + _fxDir.x * 0.05 * V,
      Z + _fxDir.y * 0.05 * V,
      J + _fxDir.z * 0.05 * V,
      0.045,
      0.13 * V,
      0.2 * V,
      22,
      22 * (fe + 0.25),
      22 * (le + 0.3),
      SPARK_GLOW,
    );
    w(
      L,
      Z,
      J,
      0.05,
      0.8 * V,
      1.1 * V,
      0.4 * oe,
      0.4 * fe,
      0.4 * le,
      SPARK_GLOW,
    );
    let R = c.emit(
      L + _fxDir.x * 0.4 * V,
      Z + _fxDir.y * 0.4 * V,
      J + _fxDir.z * 0.4 * V,
      -_fxDir.x,
      -_fxDir.y,
      -_fxDir.z,
      0.04,
      0.11 * V,
      0.14 * V,
    );
    if (R >= 0) {
      c.mode[R] = 1;
      c.frame[R] = SPARK_TRACER;
      c.stretch[R] = 0.9 * V;
      c.r[R] = 18 * oe;
      c.g[R] = 18 * fe;
      c.b[R] = 18 * le;
      c.fout[R] = 0.3;
    }
    for (let I = 0; I < 3; I++) {
      fxJitterDir(_fxDir, 0.25, _fxJitterOut);
      let se = fxRandRange(8, 22);
      M(
        L,
        Z,
        J,
        _fxJitterOut.x * se,
        _fxJitterOut.y * se,
        _fxJitterOut.z * se,
        fxRandRange(0.08, 0.22),
        0.012,
        30,
        18,
        7,
        0,
      );
    }
    _(
      L + _fxDir.x * 0.2,
      Z + _fxDir.y * 0.2,
      J + _fxDir.z * 0.2,
      _fxDir.x * 1.5,
      _fxDir.y * 1.5 + 0.2,
      _fxDir.z * 1.5,
      fxRandRange(0.5, 0.9),
      0.08 * V,
      0.45 * V,
      0.5,
      0.5,
      0.52,
      0.16,
      1,
      3,
      0.3,
      0.8,
      -1,
    );
    _fxProbePos.copy(ee).addScaledVector(_fxDir, 0.25);
    b(_fxProbePos, 16756832, 16 * V, 7 * V, 0.05);
  }
  function N(ee: Vector3, B: Vector3) {
    f.add(ee, B);
  }
  let Q = {
    pos: new Vector3(),
    size: 1,
  };
  function K(ee: Vector3Like, B = 1) {
    let P = Math.max(0.4, Math.min(B, 4)),
      V = ee.x,
      Y = ee.y,
      L = ee.z,
      Z = Math.sqrt(P),
      J = A(ee),
      oe = Y - J < 1.4 * P,
      fe = m(ee, _fxUp);
    _fxProbePos.set(V, Y + 0.4, L);
    b(_fxProbePos, 16769712, 320 * P, 10 + 9 * P, 0.08);
    b(_fxProbePos, 16747056, 55 * P, 8 + 6 * P, 0.45);
    let le = Y + 0.35 * P;
    w(V, le, L, 0.055, 1.5 * P, 2.3 * P, 16, 13.5, 9.5, SPARK_GLOW);
    w(
      V,
      le,
      L,
      0.05,
      2.6 * P,
      4.2 * P,
      7,
      5,
      2.4,
      SPARK_STAR_A + ((Math.random() * 2) | 0),
    );
    w(V, le, L, 0.3, 3.5 * P, 5.5 * P, 0.35, 0.2, 0.08, SPARK_GLOW);
    let R = Math.round(13 + 5 * P);
    for (let ae = 0; ae < R; ae++) {
      fxJitterDir(_fxUp, 1.6, _fxJitterOut);
      if (oe && _fxJitterOut.y < -0.1) {
        _fxJitterOut.y = -_fxJitterOut.y * 0.5;
      }
      let k = fxRandRange(2.2, 7.5) * Z,
        ce = fxRandRange(0.7, 1.15),
        ve = l.emit(
          V + _fxJitterOut.x * 0.3 * P,
          le + _fxJitterOut.y * 0.3 * P,
          L + _fxJitterOut.z * 0.3 * P,
          _fxJitterOut.x * k,
          _fxJitterOut.y * k + 1.4,
          _fxJitterOut.z * k,
          fxRandRange(0.55, 1.05),
          0.85 * P,
          fxRandRange(1.8, 2.7) * P,
        );
      if (ve >= 0) {
        l.frame[ve] = ae % 4 === 0 ? 7 : (Math.random() * 6) | 0;
        l.ramp[ve] = 2;
        l.r[ve] = 5.8 * ce;
        l.g[ve] = 2.4 * ce;
        l.b[ve] = 0.5 * ce;
        l.a[ve] = 0.96;
        l.shade[ve] = 2 + fe;
        l.drag[ve] = 4;
        l.grav[ve] = -2.6;
        l.wind[ve] = 0.6;
        l.turb[ve] = 1.5;
        l.rot[ve] = Math.random() * 6.283;
        l.rotv[ve] = (Math.random() - 0.5) * 2.5;
        l.sk[ve] = 3;
        l.fin[ve] = 0;
        l.fout[ve] = 0.6;
      }
    }
    for (let ae = 0; ae < 5; ae++) {
      fxJitterDir(_fxUp, 1.4, _fxJitterOut);
      let k = fxRandRange(2, 5) * Z,
        ce = c.emit(
          V + _fxJitterOut.x * 0.3 * P,
          le + _fxJitterOut.y * 0.3 * P,
          L + _fxJitterOut.z * 0.3 * P,
          _fxJitterOut.x * k,
          Math.abs(_fxJitterOut.y) * k + 1.2,
          _fxJitterOut.z * k,
          fxRandRange(0.3, 0.55),
          0.6 * P,
          fxRandRange(1.2, 1.8) * P,
        );
      if (ce >= 0) {
        c.frame[ce] = SPARK_FIREBALL;
        c.ramp[ce] = 2;
        c.r[ce] = 2.4;
        c.g[ce] = 1.1;
        c.b[ce] = 0.3;
        c.drag[ce] = 4;
        c.grav[ce] = -2.5;
        c.rot[ce] = Math.random() * 6.283;
        c.sk[ce] = 3;
        c.fout[ce] = 0.4;
      }
    }
    let I = Math.round(11 + 5 * P);
    for (let ae = 0; ae < I; ae++) {
      let k = ae % 2 === 0;
      fxJitterDir(_fxUp, 1.4, _fxJitterOut);
      if (oe && _fxJitterOut.y < 0) {
        _fxJitterOut.y = -_fxJitterOut.y * 0.4;
      }
      let ce = (k ? fxRandRange(4.5, 9) : fxRandRange(1.5, 5)) * Z,
        ve = fxRandRange(0.04, 0.1),
        _e = k ? 0.75 : 0.3,
        Te = _(
          V + _fxJitterOut.x * _e * P,
          le + _fxJitterOut.y * _e * P,
          L + _fxJitterOut.z * _e * P,
          _fxJitterOut.x * ce,
          _fxJitterOut.y * ce + 0.8,
          _fxJitterOut.z * ce,
          fxRandRange(2.8, 4.8),
          (k ? 0.8 : 1.2) * P,
          fxRandRange(2.6, 4.2) * P,
          ve,
          ve * 0.95,
          ve * 0.9,
          k ? 0.7 : 0.8,
          fe,
          3.4,
          fxRandRange(0.8, 1.7),
          1,
          ae % 3 === 0 ? 7 : -1,
        );
      if (Te >= 0) {
        l.fin[Te] = k ? 0.025 : 0.16;
        l.fout[Te] = 0.35;
        l.turb[Te] = 1.2;
      }
    }
    X(V, Y + 0.3 * P, L, "smolder", 1.3 + 0.3 * P, P, fe);
    let se = Math.min(90, Math.round(34 * P));
    for (let ae = 0; ae < se; ae++) {
      fxJitterDir(_fxUp, 1.5, _fxJitterOut);
      if (oe && _fxJitterOut.y < 0) {
        _fxJitterOut.y = -_fxJitterOut.y;
      }
      let k = fxRandRange(6, 26) * Z,
        ce = M(
          V,
          Y + 0.05,
          L,
          _fxJitterOut.x * k,
          _fxJitterOut.y * k,
          _fxJitterOut.z * k,
          fxRandRange(0.5, 1.5),
          fxRandRange(0.014, 0.028),
          40,
          23,
          8,
          PARTICLE_FLAG_BOUNCE,
        );
      if (ce >= 0) {
        c.drag[ce] = 1.4;
        c.stretch[ce] = 0.035;
      }
    }
    for (let ae = 0; ae < 10 * P; ae++) {
      fxJitterDir(_fxUp, 1.2, _fxJitterOut);
      let k = fxRandRange(1, 5),
        ce = c.emit(
          V,
          Y + 0.3,
          L,
          _fxJitterOut.x * k,
          Math.abs(_fxJitterOut.y) * k + 1,
          _fxJitterOut.z * k,
          fxRandRange(1.4, 3),
          0.035,
          0.02,
        );
      if (ce >= 0) {
        c.frame[ce] = SPARK_GLOW;
        c.ramp[ce] = 3;
        c.r[ce] = 9;
        c.g[ce] = 4;
        c.b[ce] = 1;
        c.drag[ce] = 1.2;
        c.grav[ce] = 0.6;
        c.turb[ce] = 3;
        c.wind[ce] = 1;
        c.fout[ce] = 0.5;
      }
    }
    if (oe) {
      let ae = J + 0.015;
      S(V, ae, L, 0.32, 0.6 * P, 9 * P, 1.6, 1.2, 0.75);
      let k = Math.round(12 + 3 * P);
      for (let ce = 0; ce < k; ce++) {
        let ve = ((ce + Math.random()) / k) * 6.283,
          _e = fxRandRange(5, 10) * Z,
          Te = fxRandRange(0.42, 0.55),
          Pe = _(
            V + Math.cos(ve) * 0.4 * P,
            ae + 0.2,
            L + Math.sin(ve) * 0.4 * P,
            Math.cos(ve) * _e,
            fxRandRange(0.2, 0.9),
            Math.sin(ve) * _e,
            fxRandRange(1.2, 2.2),
            0.4 * P,
            fxRandRange(1.2, 1.9) * P,
            Te,
            Te * 0.96,
            Te * 0.9,
            0.26,
            fe,
            3,
            0.15,
            0.7,
            -1,
          );
        if (Pe >= 0) {
          l.fin[Pe] = 0.1;
        }
      }
      _fxGroundPos.set(V, J, L);
      p.add(_fxGroundPos, _fxUp, "scorch", 2.3 * P, 1, 0.92);
    }
    _fxGroundPos.set(V, Math.max(Y, J + 0.1), L);
    z(
      _fxGroundPos,
      _fxUp,
      Math.round(13 + 6 * P),
      4,
      13 * Z,
      0.04,
      0.13,
      0.025,
      0.08,
      0.04,
      0.13,
      0.07,
      0.066,
      0.062,
      1.1,
      J,
    );
    Q.pos.copy(ee);
    Q.size = B;
    i.events.emit("explosion", Q);
  }
  let ie: {
    active: boolean;
    kind: string;
    pos: Vector3;
    acc: number;
    acc2: number;
    ttl: number;
    scale: number;
    shade: number;
    t: number;
    light: any;
    drop: number;
    stop: () => void;
    setPos: (P: Vector3Like) => void;
  }[] = [];
  for (let ee = 0; ee < 24; ee++) {
    let BInit = {
        active: false,
        kind: "steam",
        pos: new Vector3(),
        acc: 0,
        acc2: 0,
        ttl: 1 / 0,
        scale: 1,
        shade: 1,
        t: 0,
        light: null as any,
        drop: -1,
      },
      B = BInit as typeof BInit & {
        stop: () => void;
        setPos: (P: Vector3Like) => void;
      };
    B.stop = () => {
      B.active = false;
      if (B.light) {
        B.light.release();
        B.light = null;
      }
    };
    B.setPos = (P: Vector3Like) => {
      B.pos.copy(P);
    };
    ie.push(B);
  }
  let F = {
    active: false,
    pos: new Vector3(),
    stop() {},
    setPos() {},
  };
  function X(
    ee: number,
    B: number,
    P: number,
    V: string,
    Y: number,
    L: number,
    Z: number | undefined,
  ) {
    let J: {
      active: boolean;
      kind: string;
      pos: Vector3;
      acc: number;
      acc2: number;
      ttl: number;
      scale: number;
      shade: number;
      t: number;
      light: any;
      drop: number;
    } | null = null;
    for (let oe = 0; oe < ie.length; oe++)
      if (!ie[oe].active) {
        J = ie[oe];
        break;
      }
    if (!J) {
      return F;
    }
    J.active = true;
    J.kind = V;
    J.pos.set(ee, B, P);
    J.acc = 0;
    J.acc2 = 0;
    J.ttl = Y;
    J.scale = L;
    J.t = 0;
    J.drop = -1;
    J.shade = Z === undefined ? m(J.pos, null) : Z;
    if (V === "fire") {
      let oe = y();
      J.light = oe && oe.acquire ? oe.acquire() : null;
      if (J.light) {
        J.light.light.color.set(16747066);
        J.light.light.distance = 9;
        J.light.light.position.set(ee, B + 0.5, P);
      }
    }
    return J;
  }
  function ne(
    ee: { x: number; y: number; z: number },
    B = "steam",
    P: { ttl?: any; scale?: any } = {},
  ) {
    return X(ee.x, ee.y, ee.z, B, P.ttl || 1 / 0, P.scale || 1, undefined);
  }
  function re(ee: number) {
    for (let B = 0; B < ie.length; B++) {
      let P = ie[B];
      if (!P.active) {
        continue;
      }
      P.t += ee;
      if (P.t > P.ttl) {
        P.stop();
        continue;
      }
      let V = P.pos.x,
        Y = P.pos.y,
        L = P.pos.z,
        Z = P.scale;
      if (P.kind === "steam") {
        for (P.acc += ee * 13; P.acc > 1;) {
          P.acc -= 1;
          let J = _(
            V + (Math.random() - 0.5) * 0.08,
            Y,
            L + (Math.random() - 0.5) * 0.08,
            (Math.random() - 0.5) * 0.4,
            fxRandRange(1.4, 2.4),
            (Math.random() - 0.5) * 0.4,
            fxRandRange(1.8, 3),
            0.12 * Z,
            fxRandRange(0.8, 1.3) * Z,
            0.8,
            0.82,
            0.85,
            0.2,
            P.shade,
            1.3,
            0.5,
            1,
            -1,
          );
          if (J >= 0) {
            l.fin[J] = 0.12;
            l.turb[J] = 0.9;
          }
        }
      } else if (P.kind === "smolder") {
        for (P.acc += ee * 9 * (1 - P.t / P.ttl); P.acc > 1;) {
          P.acc -= 1;
          let J = fxRandRange(0.05, 0.11),
            oe = _(
              V + (Math.random() - 0.5) * 0.5 * Z,
              Y,
              L + (Math.random() - 0.5) * 0.5 * Z,
              (Math.random() - 0.5) * 0.6,
              fxRandRange(1.2, 2.4),
              (Math.random() - 0.5) * 0.6,
              fxRandRange(2.4, 3.8),
              0.5 * Z,
              fxRandRange(1.6, 2.6) * Z,
              J,
              J,
              J,
              0.6,
              P.shade,
              1,
              0.9,
              1,
              -1,
            );
          if (oe >= 0) {
            l.fin[oe] = 0.12;
            l.turb[oe] = 1;
          }
        }
      } else if (P.kind === "embers") {
        for (P.acc += ee * 8; P.acc > 1;) {
          P.acc -= 1;
          let J = c.emit(
            V + (Math.random() - 0.5) * 0.4 * Z,
            Y,
            L + (Math.random() - 0.5) * 0.4 * Z,
            (Math.random() - 0.5) * 0.6,
            fxRandRange(0.6, 1.8),
            (Math.random() - 0.5) * 0.6,
            fxRandRange(1.5, 3.2),
            fxRandRange(0.02, 0.04),
            0.012,
          );
          if (J >= 0) {
            c.frame[J] = SPARK_GLOW;
            c.ramp[J] = 3;
            c.r[J] = 10;
            c.g[J] = 4.2;
            c.b[J] = 1;
            c.drag[J] = 0.8;
            c.grav[J] = -0.5;
            c.turb[J] = 3.5;
            c.wind[J] = 1;
            c.fout[J] = 0.5;
          }
        }
      } else if (P.kind === "fire") {
        for (P.acc += ee * 24; P.acc > 1;) {
          P.acc -= 1;
          let J = c.emit(
            V + (Math.random() - 0.5) * 0.3 * Z,
            Y + 0.1 * Z,
            L + (Math.random() - 0.5) * 0.3 * Z,
            (Math.random() - 0.5) * 0.5,
            fxRandRange(1.2, 2.6) * Z,
            (Math.random() - 0.5) * 0.5,
            fxRandRange(0.35, 0.65),
            0.45 * Z,
            fxRandRange(0.2, 0.35) * Z,
          );
          if (J >= 0) {
            c.frame[J] = SPARK_FIREBALL;
            c.ramp[J] = 2;
            c.r[J] = 9;
            c.g[J] = 5.5;
            c.b[J] = 2.2;
            c.drag[J] = 1;
            c.rot[J] = Math.random() * 6.283;
            c.rotv[J] = (Math.random() - 0.5) * 4;
            c.fin[J] = 0.12;
            c.fout[J] = 0.4;
            c.wind[J] = 1;
            c.turb[J] = 2;
          }
        }
        for (P.acc2 += ee * 4; P.acc2 > 1;) {
          P.acc2 -= 1;
          let J = fxRandRange(0.05, 0.1),
            oe = _(
              V,
              Y + 0.8 * Z,
              L,
              (Math.random() - 0.5) * 0.4,
              fxRandRange(1.2, 2),
              (Math.random() - 0.5) * 0.4,
              fxRandRange(2.2, 3.4),
              0.3 * Z,
              fxRandRange(1.1, 1.8) * Z,
              J,
              J,
              J,
              0.5,
              P.shade,
              0.9,
              0.8,
              1,
              -1,
            );
          if (oe >= 0) {
            l.fin[oe] = 0.2;
            l.turb[oe] = 1;
          }
          let fe = c.emit(
            V + (Math.random() - 0.5) * 0.3,
            Y + 0.3,
            L + (Math.random() - 0.5) * 0.3,
            Math.random() - 0.5,
            fxRandRange(1.5, 3),
            Math.random() - 0.5,
            fxRandRange(1, 2.2),
            0.03,
            0.012,
          );
          if (fe >= 0) {
            c.frame[fe] = SPARK_GLOW;
            c.ramp[fe] = 3;
            c.r[fe] = 10;
            c.g[fe] = 4.2;
            c.b[fe] = 1;
            c.drag[fe] = 0.8;
            c.grav[fe] = -0.6;
            c.turb[fe] = 4;
            c.wind[fe] = 1;
          }
        }
        if (P.light) {
          P.light.light.intensity =
            (14 + 6 * Math.sin(P.t * 23) + 4 * Math.sin(P.t * 37.7)) * Z;
        }
      } else if (P.kind === "drip") {
        P.acc += ee * 1.6;
        if (P.drop >= 0 && ((P.drop -= ee), P.drop < 0)) {
          let J = P.shade;
          S(
            V,
            0.014,
            L,
            0.8,
            0.05,
            0.55,
            0.4 * J + 0.14,
            0.36 * J + 0.16,
            0.3 * J + 0.18,
          );
          for (let oe = 0; oe < 3; oe++) {
            fxJitterDir(_fxUp, 0.7, _fxJitterOut);
            let fe = c.emit(
              V,
              0.03,
              L,
              _fxJitterOut.x * 1.2,
              Math.abs(_fxJitterOut.y) * 1.6,
              _fxJitterOut.z * 1.2,
              0.35,
              0.012,
              0.008,
            );
            if (fe >= 0) {
              c.mode[fe] = 1;
              c.frame[fe] = SPARK_DROPLET;
              c.stretch[fe] = 0.012;
              c.grav[fe] = 9.81;
              c.r[fe] = 1.6 * J + 0.3;
              c.g[fe] = 1.3 * J + 0.4;
              c.b[fe] = 0.9 * J + 0.5;
              c.flags[fe] = PARTICLE_FLAG_KILL_ON_GROUND;
            }
          }
        }
        for (; P.acc > 1;) {
          P.acc -= 1 + Math.random() * 0.6;
          let J = Math.sqrt((2 * Math.max(Y, 0.05)) / 9.81),
            oe = c.emit(V, Y, L, 0, -0.2, 0, J + 0.05, 0.014, 0.014);
          if (oe >= 0) {
            c.mode[oe] = 1;
            c.frame[oe] = SPARK_DROPLET;
            c.stretch[oe] = 0.02;
            c.grav[oe] = 9.81;
            c.r[oe] = 1.4 * P.shade + 0.4;
            c.g[oe] = 1.2 * P.shade + 0.5;
            c.b[oe] = 0.9 * P.shade + 0.6;
            c.flags[oe] = PARTICLE_FLAG_KILL_ON_GROUND;
            c.fout[oe] = 0.98;
          }
          P.drop = J;
        }
      }
    }
  }
  i.events.on("impact", (ee) => {
    if (!(!ee || !ee.point)) {
      C(ee.point, ee.normal, ee.surface, ee.dir, ee.enemy);
    }
  });
  let $ = (ee: number, B: number) => {
    try {
      return !!(i.ground && i.ground.isPuddle && i.ground.isPuddle(ee, B));
    } catch {
      return false;
    }
  };
  i.events.on("player:step", (ee) => {
    let B = (ee && ee.pos) || (i.player && i.player.pos);
    if (B && ((ee && ee.surface === "water") || $(B.x, B.z))) {
      _fxGroundPos.set(B.x, Math.max(0, B.y), B.z);
      T(_fxGroundPos, ee && ee.sprint ? 0.55 : 0.4);
    }
  });
  i.events.on("player:land", (ee) => {
    let B = i.player && i.player.pos;
    if (B) {
      _fxGroundPos.set(B.x, Math.max(0, B.y), B.z);
      if ((ee && ee.surface === "water") || $(B.x, B.z)) {
        T(_fxGroundPos, 0.9);
      } else if (ee && ee.speed > 5) {
        let P = m(_fxGroundPos, _fxUp);
        for (let V = 0; V < 6; V++) {
          let Y = Math.random() * 6.283;
          _(
            _fxGroundPos.x + Math.cos(Y) * 0.2,
            _fxGroundPos.y + 0.08,
            _fxGroundPos.z + Math.sin(Y) * 0.2,
            Math.cos(Y) * 1.6,
            0.3,
            Math.sin(Y) * 1.6,
            fxRandRange(0.7, 1.2),
            0.15,
            fxRandRange(0.5, 0.8),
            0.45,
            0.44,
            0.42,
            0.22,
            P,
            3,
            0.1,
            0.8,
            -1,
          );
        }
      }
    }
  });
  function ue(ee: number) {
    if (!(ee > 0)) {
      ee = 0;
    }
    v += ee;
    re(ee);
    let B = i.camera ? i.camera.position : _fxProbePos.set(0, 0, 0);
    r.begin();
    l.update(ee, r, B, t, v);
    r.end!();
    a.begin();
    c.update(ee, a, B, t, v);
    u.update(ee, a, SPARK_TRACER, SPARK_GLOW);
    a.end!();
    h.update(ee);
    f.update(ee);
  }
  function me() {
    l.clear();
    c.clear();
    u.clear();
    h.clear();
    f.clear();
    p.clear();
    for (let ee of ie) {
      if (ee.active) {
        ee.stop();
      }
    }
    r.begin();
    r.end!();
    a.begin();
    a.end!();
  }
  return {
    update: ue,
    clear: me,
    muzzleFlash: j,
    tracer: G,
    impact: C,
    sparks: H,
    smoke: O,
    dust: q,
    explosion: K,
    shell: N,
    splash: T,
    addEmitter: ne,
    debris: U,
    decal(ee: Vector3, B: any, P = "bullet_concrete", V: number | undefined) {
      _fxNormal.copy(B || _fxUp);
      p.add(ee, _fxNormal, P, V);
    },
    wind: t,
    root: d,
    stats() {
      return {
        lit: l.n,
        add: c.n,
        tracers: u.n,
        debris: h.live,
        drawCalls: 5,
      };
    },
  };
}
export function fxShowcase(i: any) {
  let e = i.fx,
    t = i.params.fxshow || "all",
    n = new Group(),
    s = (N: BoxGeometry, Q: string, K: number, ie: number, F: number) => {
      let X = new Mesh(N, i.mats.get(Q));
      X.position.set(K, ie, F);
      X.castShadow = X.receiveShadow = true;
      n.add(X);
      return X;
    };
  s(roundedBoxGeo(2.6, 2.2, 0.3, 0.02), "concrete", -3.2, 1.1, 0);
  s(roundedBoxGeo(2.2, 2, 0.08, 0.01), "paint_blue", 0, 1, 0);
  s(roundedBoxGeo(1.2, 1.2, 1.2, 0.015), "wood_pallet", 3.2, 0.6, 0);
  i.scene.add(n);
  i.physics.addBox([-4.5, 0, -0.15], [-1.9, 2.2, 0.15], {
    surface: "concrete",
  });
  i.physics.addBox([-1.1, 0, -0.04], [1.1, 2, 0.04], {
    surface: "metal",
  });
  i.physics.addBox([2.6, 0, -0.6], [3.8, 1.2, 0.6], {
    surface: "wood",
  });
  let o = (N: number, Q: number, K: number) => new Vector3(N, Q, K),
    r = o(-6.5, 1.5, 7),
    a = o(6.5, 1.4, 7),
    l = o(5.2, 1.3, 3.2),
    c = o(-4.6, 1.35, 4.2),
    u = o(0, 0, 0),
    h = o(0, 0, 0),
    f = o(0, 0, 0),
    p = o(0, 1, 0),
    d = {
      point: o(0, 0, 0),
      normal: o(0, 1, 0),
      surface: "concrete",
      dir: o(0, 0, 0),
      enemy: null as any,
      from: "player",
    },
    v = Math.random,
    g = 0,
    x = 0,
    y = 0,
    b = 0,
    m = 0,
    A = 0.2,
    _ = 0,
    M = 3.4,
    E = false,
    w = t === "all" || t === "impact",
    S = t === "all" || t === "explosion",
    z = t === "all" || t === "tracer",
    H = t === "explosion" ? 2.4 : 3.5;
  if (t === "explosion") {
    M = 0.6;
  }
  if (t === "all" || t === "impact") {
    e.addEmitter(o(-6.2, 0.05, -1.5), "steam");
    e.addEmitter(o(5.6, 0, 1.6), "fire");
    e.addEmitter(o(0.4, 2.6, 1.6), "drip");
  }
  function O(N: number) {
    let Q = y++ % 2 ? a : r;
    d.enemy = null;
    d.from = "player";
    if (N === 5) {
      d.point.set(-1.5 + v() * 0.3, 2.5 + v() * 0.3, 0.8);
      d.normal.copy(Q).sub(d.point).normalize();
      d.surface = "enemy";
      d.enemy = {};
      d.dir.copy(d.point).sub(Q).normalize();
      e.tracer(Q, d.point);
      i.events.emit("impact", d);
      return;
    }
    if (N === 0) {
      u.set(-3.2 + (v() - 0.5) * 2, 0.4 + v() * 1.5, 0);
    } else if (N === 1 || N === 7) {
      u.set((v() - 0.5) * 1.8, 0.3 + v() * 1.5, 0);
    } else if (N === 2) {
      u.set(3.2 + (v() - 0.5) * 0.9, 0.2 + v() * 0.9, 0.6);
    } else if (N === 3) {
      u.set(-1.6 + (v() - 0.5) * 1.2, 0, 2.2 + v());
    } else if (N === 4) {
      u.set(1.5 + (v() - 0.5) * 0.8, 0, 2.6 + v() * 0.8);
    } else {
      u.set(3.4 + (v() - 0.5), 0, 2.4 + v() * 0.6);
    }
    h.copy(u).sub(Q).normalize();
    let K = i.physics.raycast(Q, h, 100);
    if (K) {
      d.point.copy(K.point);
      d.normal.copy(K.normal);
      d.dir.copy(h);
      d.surface = N === 4 ? "water" : N === 6 ? "dirt" : K.surface;
      e.tracer(Q, d.point);
      i.events.emit("impact", d);
    }
  }
  let q = i.params.fxhold,
    U = o(0, 1.3, 3),
    T = o(1, 0, 0);
  function D(N: number) {
    g += N;
    if (q === "muzzle") {
      e.muzzleFlash(U, T, {
        scale: 1,
      });
      U.x = 2.5;
      T.set(-0.5, 0, 0.86);
      e.muzzleFlash(U, T, {
        scale: 1.6,
      });
      U.x = 0;
      T.set(1, 0, 0);
    }
    if (w) {
      for (m -= N; m <= 0;) {
        m += t === "impact" ? 0.09 : 0.13;
        O(x++ % 8);
      }
    }
    if (z) {
      A -= N;
      if (A <= 0) {
        A += t === "tracer" ? 0.16 : 0.45;
        f.set(-5 + v() * 3, 1.2 + v() * 0.8, 6 + v() * 2);
        h.copy(f).sub(l).normalize();
        e.muzzleFlash(l, h, {
          scale: 1,
        });
        e.tracer(l, f, {
          color: 16730658,
          speed: 120,
        });
        if (t === "tracer") {
          f.set(6, 1 + v() * 1.5, -6 - v() * 6);
          u.set(-7, 1.6, 6.5);
          e.tracer(u, f, {
            speed: 200,
          });
        }
      }
      _ -= N;
      if (_ <= 0) {
        _ += 0.22;
        f.set(1.6 + v() * 0.8, 1.6 + v() * 0.8, 0.4 + (v() - 0.5) * 0.8);
        e.shell(c, f);
      }
    }
    if (S && ((M -= N), M <= 0)) {
      M += H;
      let Q = +(i.params.fxsize || 0) || 1 + (b++ % 3);
      f.set(t === "explosion" ? 0 : 7, 0.25, t === "explosion" ? 3.5 : -3.5);
      e.explosion(f, Q);
    }
  }
  let C = false,
    G = e.update;
  e.update = (N: any) => {
    if (!C) {
      G(N);
    }
  };
  let j = window.__setShot;
  if (j) {
    window.__setShot = (N) => {
      if (N && N.fxage !== undefined) {
        e.clear();
        f.set(0, 0.25, 3.5);
        e.explosion(f, +(N.fxsize || 1.2));
        let Q = +N.fxage;
        for (let K = 0; K < Q - 1e-6; K += 1 / 60) G(1 / 60);
        G(0);
        C = true;
      }
      j(N);
    };
  }
  return {
    cam: t === "explosion" ? [0, 2, 12.5] : [0.3, 1.6, 7.2],
    target: t === "explosion" ? [0, 2.2, 3.5] : [0.2, 1, 0],
    update(N: number) {
      if (!E) {
        E = true;
        let Q = +(i.params.fxt || 0);
        for (let K = 0; K < Q; K += 1 / 30) {
          D(1 / 30);
          e.update(1 / 30);
        }
      }
      if (!C) {
        D(N);
      }
    },
  };
}
