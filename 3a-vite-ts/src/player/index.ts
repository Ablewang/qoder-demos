// First-person movement, collision, health and camera effects.
import type { GameContext } from "../types/context";
import { Euler, Vector3 } from "three";
import { PLAYER_DIMS, WORLD } from "../config/world";
import { clamp, damp, lerp, saturate, smoothstep } from "../utils/math";

const MOVE = {
  walk: 3.8,
  sprint: 6.4,
  crouch: 1.9,
  ads: 2.4,
  accelGround: 34,
  decelGround: 26,
  accelAir: 9,
  gravity: 21,
  jumpApex: 1,
  coyote: 0.12,
  jumpBuffer: 0.13,
  standHeight: PLAYER_DIMS.height,
  crouchHeight: 1.15,
  eyeRate: 11,
  stride: {
    walk: 1.55,
    sprint: 2.1,
    crouch: 1.05,
  },
  bobY: 0.024,
  bobX: 0.013,
  bobSprint: 1.9,
  bobAds: 0.22,
  rollStrafe: 0.02,
  landDip: 0.36,
  landDipMax: 0.2,
  fovSprint: 6,
  fovAds: 52,
  adsLook: 0.6,
  regenDelay: 4,
  regenRate: 25,
  recoilKeep: 0.35,
  recoilApply: 34,
  recoilRecover: 6.5,
  recoilHold: 0.09,
  shakeDecay: 1.7,
  shakePitch: 0.03,
  shakeYaw: 0.03,
  shakeRoll: 0.045,
  pitchLimit: 1.5,
};
const JUMP_VELOCITY = Math.sqrt(2 * MOVE.gravity * MOVE.jumpApex);
export function createPlayer(i: GameContext) {
  let e = i.camera,
    t = () => (i.render && i.render.post) || n,
    n = {},
    s = PLAYER_DIMS.eye,
    o = MOVE.standHeight,
    r = 0,
    a = 0,
    l = true,
    c = 0,
    u = 0,
    h = 0,
    f = 0,
    p = 0,
    d = 0,
    v = 0,
    g = {
      x: 0,
      v: 0,
    },
    x = 0,
    y = 0,
    b = 0,
    m = 0,
    A = 0,
    _ = 0,
    M = 0,
    E = 99,
    w = 0,
    S = 0,
    z = 0,
    H = PLAYER_DIMS.fov,
    O = 0,
    q = "concrete",
    U = new Vector3(),
    T = new Euler(0, 0, 0, "YXZ"),
    D = new Vector3(),
    C = {
      pos: new Vector3(),
      eye: new Vector3(),
      vel: new Vector3(),
      forward: new Vector3(0, 0, -1),
      yaw: 0,
      pitch: 0,
      health: 100,
      maxHealth: 100,
      alive: true,
      onGround: true,
      sprinting: false,
      crouching: false,
      ads: 0,
      speed: 0,
      enabled: true,
      invulnerable: false,
      baseFov: PLAYER_DIMS.fov,
      hurtPulse: 0,
      lookScale: 1,
      lastSafe: D,
      tuning: MOVE,
      reset(F: { pos: Vector3; yaw: number }) {
        let X = F ||
          (i.level && i.level.playerStart) || {
            pos: new Vector3(),
            yaw: 0,
          };
        C.pos.copy(X.pos);
        C.yaw = X.yaw || 0;
        C.pitch = 0;
        C.vel.set(0, 0, 0);
        C.health = C.maxHealth;
        C.alive = true;
        C.onGround = true;
        C.sprinting = false;
        C.crouching = false;
        C.invulnerable = false;
        C.speed = 0;
        s = PLAYER_DIMS.eye;
        o = MOVE.standHeight;
        r = 0;
        a = 0;
        l = true;
        c = 0;
        u = 0;
        h = 0;
        f = 0;
        p = d = 0;
        v = 0;
        g.x = g.v = 0;
        x = y = b = m = 0;
        A = 0;
        _ = 0;
        E = 99;
        w = 0;
        S = 0;
        z = 0;
        C.hurtPulse = 0;
        D.copy(C.pos);
        let ne = t();
        ne.damage = 0;
        ne.lowHealth = 0;
        ne.ads = 0;
        K(0);
      },
      damage(F: number, X: any) {
        if (!(!C.alive || C.invulnerable || !(F > 0))) {
          C.health = Math.max(0, C.health - F);
          E = 0;
          w = Math.min(1, w + 0.35 + F / 40);
          C.addShake(0.22 + F / 70);
          i.events.emit("player:hit", {
            amount: F,
            fromPos: X,
          });
          if (C.health <= 0) {
            C.alive = false;
            z = 0;
            C.sprinting = false;
            i.events.emit("player:dead", {});
          }
        }
      },
      heal(F: number) {
        if (C.alive) {
          C.health = Math.min(C.maxHealth, C.health + F);
        }
      },
      addRecoil(F = 0, X = 0) {
        let ne = MOVE.recoilKeep;
        C.pitch = clamp(C.pitch + F * ne, -MOVE.pitchLimit, MOVE.pitchLimit);
        C.yaw += X * ne;
        x += F * (1 - ne);
        y += X * (1 - ne);
        x = clamp(x, -0.3, 0.3);
        y = clamp(y, -0.2, 0.2);
        A = MOVE.recoilHold;
      },
      addShake(F = 0.3) {
        _ = Math.min(1, _ + F);
      },
      setFov(F: number) {
        C.baseFov = clamp(+F || PLAYER_DIMS.fov, 55, 100);
      },
      update: N,
    };
  i.events.on("explosion", (F) => {
    if (!F || !F.pos) {
      return;
    }
    let X = C.eye.distanceTo(F.pos),
      ne = F.size || 1,
      re = saturate(1 - X / (14 + ne * 10)) * (0.35 + 0.35 * ne);
    if (re > 0.01) {
      C.addShake(re);
    }
  });
  function G() {
    let F = i.physics && i.physics.boxes;
    if (!F) {
      return true;
    }
    let X = PLAYER_DIMS.radius * 0.9,
      ne = C.pos.y + MOVE.crouchHeight - 0.05,
      re = C.pos.y + MOVE.standHeight;
    for (let $ = 0; $ < F.length; $++) {
      let ue = F[$];
      if (
        !ue.bulletOnly &&
        !(
          C.pos.x + X < ue.min.x ||
          C.pos.x - X > ue.max.x ||
          C.pos.z + X < ue.min.z ||
          C.pos.z - X > ue.max.z
        ) &&
        ue.min.y < re &&
        ue.max.y > ne
      ) {
        return false;
      }
    }
    return true;
  }
  function j() {
    let F = C.pos.x,
      X = C.pos.z;
    try {
      if (
        i.ground &&
        i.ground.isPuddle &&
        C.pos.y < 0.05 &&
        i.ground.isPuddle(F, X)
      ) {
        return "water";
      }
    } catch {}
    if (q && q !== "concrete") {
      return q;
    }
    try {
      return (
        (i.level && i.level.groundSurfaceAt && i.level.groundSurfaceAt(F, X)) ||
        q ||
        "concrete"
      );
    } catch {
      return q || "concrete";
    }
  }
  function N(F: number) {
    let X = i.input,
      ne = i.weapon || {};
    if (ne.stub || typeof ne.ads != "number") {
      O = damp(O, C.enabled && X.ads ? 1 : 0, 14, F);
      C.ads = O;
    } else {
      C.ads = saturate(ne.ads);
    }
    if (!C.alive) {
      z += F;
      Q(F);
      K(F);
      ie(F);
      return;
    }
    let re = C.enabled;
    C.lookScale = lerp(1, MOVE.adsLook, C.ads);
    if (re) {
      C.yaw -= X.look.dx * C.lookScale;
      C.pitch = clamp(
        C.pitch - X.look.dy * C.lookScale,
        -MOVE.pitchLimit,
        MOVE.pitchLimit,
      );
      if (C.yaw > Math.PI * 4 || C.yaw < -Math.PI * 4) {
        C.yaw = C.yaw % (Math.PI * 2);
      }
    }
    if (re && X.crouch) {
      C.crouching = true;
    } else if (C.crouching && G()) {
      C.crouching = false;
    }
    o = C.crouching ? MOVE.crouchHeight : MOVE.standHeight;
    let ue = re ? X.move.x : 0,
      me = re ? X.move.y : 0,
      ee = ue * ue + me * me > 0.01,
      B =
        re &&
        X.sprint &&
        me > 0.55 &&
        Math.abs(ue) < 0.6 &&
        !C.crouching &&
        C.ads < 0.35 &&
        !X.fire;
    C.sprinting =
      (B && C.onGround && C.speed > MOVE.walk * 0.6) ||
      (B && !C.onGround && C.sprinting);
    let P = MOVE.walk;
    if (C.crouching) {
      P = MOVE.crouch;
    } else if (B) {
      P = MOVE.sprint;
    }
    P = lerp(P, Math.min(P, MOVE.ads), C.ads);
    if (me < 0) {
      P *= lerp(1, 0.82, -me);
    }
    let V = Math.sin(C.yaw),
      Y = Math.cos(C.yaw);
    U.set(ue * Y - me * V, 0, -ue * V - me * Y).multiplyScalar(P);
    let L = C.onGround
        ? ee
          ? MOVE.accelGround
          : MOVE.decelGround
        : ee
          ? MOVE.accelAir
          : 0.6,
      Z = U.x - C.vel.x,
      J = U.z - C.vel.z;
    if (!C.onGround && !ee) {
      Z = -C.vel.x;
      J = -C.vel.z;
    }
    let oe = Math.hypot(Z, J),
      fe = L * F;
    if (oe <= fe || oe < 1e-6) {
      if (C.onGround || ee) {
        C.vel.x = U.x;
        C.vel.z = U.z;
      }
    } else {
      C.vel.x += (Z / oe) * fe;
      C.vel.z += (J / oe) * fe;
    }
    r = C.onGround ? MOVE.coyote : Math.max(0, r - F);
    a = re && X.pressed("jump") ? MOVE.jumpBuffer : Math.max(0, a - F);
    if (a > 0 && r > 0 && (!C.crouching || G())) {
      C.vel.y = JUMP_VELOCITY;
      a = 0;
      r = 0;
      C.onGround = false;
      C.crouching = false;
      o = MOVE.standHeight;
      i.events.emit("player:jump", {
        pos: C.pos,
      });
    }
    C.vel.y -= MOVE.gravity * F * 0.5;
    if (C.vel.y < -40) {
      C.vel.y = -40;
    }
    let le = C.vel.y,
      R =
        i.physics.moveCapsule(C.pos, C.vel, F, PLAYER_DIMS.radius, o, l) || {};
    if (!R.onGround) {
      C.vel.y -= MOVE.gravity * F * 0.5;
    }
    let I = i.physics.bounds;
    if (I) {
      C.pos.x = clamp(C.pos.x, I.min.x + 0.4, I.max.x - 0.4);
      C.pos.z = clamp(C.pos.z, I.min.z + 0.4, I.max.z - 0.4);
    }
    C.onGround = !!R.onGround;
    if (R.surface) {
      q = R.surface;
    }
    if (C.onGround) {
      if (!l && c > 0.12) {
        let ce = Math.max(0, -le, u);
        g.v -= Math.min(ce * MOVE.landDip, 3.2);
        if (ce > 7.5) {
          C.addShake(Math.min(0.5, (ce - 7.5) * 0.06));
        }
        i.events.emit("player:land", {
          speed: ce,
          surface: j(),
          pos: C.pos,
        });
        if (ce > 13) {
          C.damage((ce - 13) * 7, null);
        }
        h = 0.35;
      }
      c = 0;
      u = 0;
      if (C.pos.x <= WORLD.quayX - 1.2 && C.pos.y > -0.5) {
        D.copy(C.pos);
      }
    } else {
      c += F;
      u = Math.max(u, -C.vel.y);
    }
    l = C.onGround;
    if (C.pos.y < WORLD.seaY - 2.2) {
      C.pos.copy(D);
      C.vel.set(0, 0, 0);
      C.onGround = true;
      l = true;
      _ = 0.6;
      C.yaw += Math.PI;
      C.damage(12, null);
      i.events.emit("player:rescued", {});
    }
    C.speed = Math.hypot(C.vel.x, C.vel.z);
    let se = C.crouching
      ? MOVE.stride.crouch
      : C.sprinting
        ? MOVE.stride.sprint
        : MOVE.stride.walk;
    if (C.onGround && C.speed > 0.5) {
      let ce = h;
      h += (C.speed * F) / se;
      if (Math.floor(h) > Math.floor(ce)) {
        i.events.emit("player:step", {
          surface: j(),
          sprint: C.sprinting,
          pos: C.pos,
        });
      }
    } else {
      if (C.onGround) {
        h = damp(h, Math.round(h), 8, F);
      }
    }
    let ae = C.onGround
      ? saturate(C.speed / MOVE.walk) *
        (C.sprinting ? MOVE.bobSprint : 1) *
        lerp(1, MOVE.bobAds, C.ads) *
        (C.crouching ? 0.7 : 1)
      : 0;
    f = damp(f, ae, 9, F);
    d = -Math.cos(h * Math.PI * 2) * MOVE.bobY * f;
    p = Math.sin(h * Math.PI) * MOVE.bobX * f;
    let k = C.vel.x * Y - C.vel.z * V;
    v = damp(
      v,
      (-k / MOVE.sprint) * MOVE.rollStrafe * lerp(1, 0.4, C.ads),
      8,
      F,
    );
    E += F;
    if (E > MOVE.regenDelay && C.health < C.maxHealth) {
      C.health = Math.min(C.maxHealth, C.health + MOVE.regenRate * F);
    }
    K(F);
    ie(F);
  }
  function Q(F: number) {
    C.vel.x = damp(C.vel.x, 0, 5, F);
    C.vel.z = damp(C.vel.z, 0, 5, F);
    C.vel.y -= MOVE.gravity * F;
    try {
      let X = i.physics.moveCapsule(
        C.pos,
        C.vel,
        F,
        PLAYER_DIMS.radius,
        0.6,
        l,
      );
      l = !!(X && X.onGround);
    } catch {}
    if (C.pos.y < WORLD.seaY - 1) {
      C.pos.y = WORLD.seaY - 1;
      C.vel.y = 0;
    }
    C.speed = 0;
    C.sprinting = false;
    f = damp(f, 0, 10, F);
    p *= 0.9;
    d *= 0.9;
  }
  function K(F: number) {
    let X = C.crouching ? PLAYER_DIMS.crouchEye : PLAYER_DIMS.eye,
      ne = 0,
      re = 0;
    if (C.alive) {
      if (F > 0) {
        s = damp(s, X, MOVE.eyeRate, F);
      } else {
        s = X;
      }
    } else {
      let Z = smoothstep(0, 0.85, z),
        J = Z * Z;
      X = lerp(PLAYER_DIMS.eye, 0.22, J);
      s = damp(s, X, 18, F);
      ne = 1.15 * J;
      re = -0.25 * Z + 0.12 * Math.sin(Z * Math.PI);
    }
    if (F > 0) {
      let Z = -g.x * 150 - g.v * 17;
      g.v += Z * F;
      g.x += g.v * F;
      g.x = clamp(g.x, -MOVE.landDipMax, 0.05);
      A -= F;
      if (A <= 0) {
        x = damp(x, 0, MOVE.recoilRecover, F);
        y = damp(y, 0, MOVE.recoilRecover, F);
      }
      b = damp(b, x, MOVE.recoilApply, F);
      m = damp(m, y, MOVE.recoilApply, F);
      _ = Math.max(0, _ - MOVE.shakeDecay * F);
      M += F;
    }
    let $ = Math.sin(C.yaw),
      ue = Math.cos(C.yaw);
    C.eye.set(C.pos.x + p * ue, C.pos.y + s + d + g.x, C.pos.z - p * $);
    let me = clamp(C.pitch + b, -1.55, 1.55),
      ee = C.yaw + m;
    T.set(me, ee, 0, "YXZ");
    C.forward.set(0, 0, -1).applyEuler(T);
    let B = _ * _,
      P = M,
      V =
        B *
        MOVE.shakePitch *
        (Math.sin(P * 43.1) + 0.6 * Math.sin(P * 71.7 + 1.3)),
      Y =
        B *
        MOVE.shakeYaw *
        (Math.sin(P * 37.3 + 2.1) + 0.6 * Math.sin(P * 83.9)),
      L =
        B *
        MOVE.shakeRoll *
        (Math.sin(P * 29.7 + 0.7) + 0.5 * Math.sin(P * 61.3 + 4));
    e.position.copy(C.eye);
    e.rotation.set(
      me + V + re + g.x * 0.12,
      ee + Y,
      v + L + ne + p * 0.35,
      "YXZ",
    );
    if (!i.params || !i.params.fov) {
      let Z = lerp(
        C.baseFov + (C.sprinting ? MOVE.fovSprint : 0),
        MOVE.fovAds,
        C.ads,
      );
      H = F > 0 ? damp(H, Z, C.ads > 0.02 && C.ads < 0.98 ? 30 : 7, F) : Z;
      if (Math.abs(e.fov - H) > 0.01) {
        e.fov = H;
        e.updateProjectionMatrix();
      }
    }
  }
  function ie(F: number) {
    w = Math.max(0, w - F * 1.9);
    C.hurtPulse = w;
    let X = C.alive ? smoothstep(0.55, 0.12, C.health / C.maxHealth) : 1;
    S = damp(S, X, 4, F);
    let ne = t();
    ne.damage = w;
    ne.lowHealth = S;
    ne.ads = C.ads;
  }
  return C;
}
