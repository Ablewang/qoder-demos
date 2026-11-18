import type { Vector3Like } from "three";
import { Mesh, PlaneGeometry, Vector3 } from "three";
import { skinRig, solveTwoBone } from "./rig";
import { HOUND_LEGS } from "./models";

export const HOUND = {
  hp: 140,
  shotDamage: 5,
  burst: 4,
  burstGap: 0.11,
  telegraph: 0.5,
  cooldown: [1.8, 3],
  runSpeed: 4.5,
  stalkSpeed: 2,
  patrolSpeed: 1.5,
  accel: 7,
  turnRate: 2.5,
  rangeMin: 8,
  rangeMax: 18,
  spreadFar: 0.12,
  spreadNear: 0.045,
  lungeRange: 3,
  lungeDamage: 15,
  lungeCooldown: 3.5,
  lungeSpeed: 9.5,
  replan: 0.6,
  smokeBelow: 0.4,
};
const _houndTmpA = new Vector3();
const _houndTmpB = new Vector3();
const _houndShotDir = new Vector3();
const _houndOrigin = new Vector3();
const _houndTracerEnd = new Vector3();
const _houndTargetPos = new Vector3();
const HOUND_UP = new Vector3(0, 1, 0);
const _houndIkAngles = {
  abd: 0,
  hip: 0,
  knee: 0,
  reach: 0,
};
const HOUND_LENS_IDLE = [8, 4, 0.7];
const HOUND_LENS_ENGAGE = [14, 1, 0.35];
const houndWrapAngle = (i: number, e: number) => {
  let t = (i - e) % (Math.PI * 2);
  if (t > Math.PI) {
    t -= Math.PI * 2;
  } else if (t < -Math.PI) {
    t += Math.PI * 2;
  }
  return t;
};
const houndClamp = (i: number, e: number, t: number) =>
  i < e ? e : i > t ? t : i;
const HOUND_GAIT_PAIRS = [
  [0, 3],
  [1, 2],
];
function spring(
  i: { x: number; v: number },
  e: number,
  t: number,
  n: number,
  s: number,
) {
  i.v += ((e - i.x) * t - i.v * n) * s;
  i.x += i.v * s;
  return i.x;
}
export function createHound(i: any, e: any, t: any, n: number) {
  let s = i.G,
    o = i.rng,
    r = t.lensBase.clone(),
    a = skinRig(
      e,
      {
        shell: t.shell,
        metal: t.metal,
        glow: t.glow,
        lens: r,
      },
      {
        radius: 1.5,
        center: [0, 0.6, 0],
      },
    ),
    l = a.bones;
  a.group.visible = false;
  let c: any[] = [],
    u: any[] = [],
    h: any[] = [];
  for (let T = 0; T < 4; T++) {
    c.push(l["abd" + HOUND_LEGS.legs[T]]);
    u.push(l["thigh" + HOUND_LEGS.legs[T]]);
    h.push(l["shin" + HOUND_LEGS.legs[T]]);
  }
  let f = s.mats.label("H-" + String(n + 3).padStart(2, "0"), {
      color: "black",
      font: "stencil",
      distress: 0.3,
    }),
    p = 0.2,
    d = Math.min(0.085, p / (f.aspect || 3)),
    v = new PlaneGeometry(p, d);
  v.rotateY(Math.PI / 2);
  v.translate(0.1675, 0.03, -0.085);
  let g = new PlaneGeometry(p, d);
  g.rotateY(-Math.PI / 2);
  g.translate(-0.1675, 0.03, -0.085);
  let x = i.mergeSimple([v, g]),
    y = new Mesh(x, f.material);
  y.castShadow = false;
  y.receiveShadow = true;
  l.body.add(y);
  let b = [0, 1, 2, 3].map(() => ({
      p: new Vector3(),
      from: new Vector3(),
      to: new Vector3(),
      slide: new Vector3(),
    })),
    mInit = {
      id: 0,
      type: "hound",
      pos: a.group.position,
      alive: false,
      hp: HOUND.hp,
      active: false,
      rig: a,
      lens: r,
      feet: b,
      yaw: 0,
      speed: 0,
      yawRate: 0,
      home: new Vector3(),
      lastKnown: new Vector3(),
      goal: new Vector3(),
      firePos: new Vector3(),
      firePlayer: new Vector3(),
      sensor: new Vector3(),
      fwd: new Vector3(0, 0, 1),
      muzzle: new Vector3(),
      headPos: new Vector3(),
      push: new Vector3(),
      mode: "patrol",
      los: false,
      seeT: 0,
      noSeeT: 0,
      senseT: 0,
      exposure: 0,
      modeT: 0,
      passive: false,
      hasToken: false,
      es: "move",
      esT: 0,
      cool: 1,
      shots: 0,
      bursts: 0,
      lungeCd: 0,
      path: null as any,
      wp: 0,
      planT: 0,
      hasGoal: false,
      waitT: 0,
      moveT: 0,
      stuckT: 0,
      sw: -1,
      swT: 0,
      swDur: 0.2,
      lastPair: 1,
      idleT: 0,
      lift: 0.08,
      sY: {
        x: 0,
        v: 0,
      },
      sP: {
        x: 0,
        v: 0,
      },
      sR: {
        x: 0,
        v: 0,
      },
      sL: {
        x: 0,
        v: 0,
      },
      sA: {
        x: 0,
        v: 0,
      },
      sA2: {
        x: 0,
        v: 0,
      },
      crouch: 0,
      tyaw: 0,
      tpitch: 0,
      hyaw: 0,
      hpitch: 0,
      flare: 0,
      lensC: [HOUND_LENS_IDLE[0], HOUND_LENS_IDLE[1], HOUND_LENS_IDLE[2]],
      smokeT: 0,
      phase: 0,
      scan: 0,
      dieT: 0,
      vy: 0,
      dieRoll: 0,
      diePitch: 0,
      wreck: false,
      sink: 0,
      loop: null as any,
      prevSpeed: 0,
      maxSpeed: HOUND.patrolSpeed,
      damage(T: number, D: any, C: { x: number; z: number }, G: string) {
        if (!m.alive) {
          return false;
        }
        m.hp -= T;
        s.events.emit("enemy:hit", {
          enemy: m,
          point: D,
          part: G || "body",
        });
        if (C) {
          let j = Math.cos(m.yaw),
            N = Math.sin(m.yaw),
            Q = Math.min(1.6, T / 28),
            K = C.x * N + C.z * j,
            ie = C.x * j - C.z * N;
          m.sL.v += ie * 1.4 * Q;
          m.sR.v += -ie * 3.2 * Q;
          m.sP.v += K * 2.4 * Q * (G === "weak" ? 1.6 : 1);
          m.sY.v -= 0.5 * Q;
        }
        i.provoke(m);
        return m.hp <= 0 ? (q(C), true) : false;
      },
      _activate(
        T: Vector3Like,
        D: {
          passive?: any;
          yaw?: any;
          state?: any;
          target?: any;
          patrolRadius?: any;
          patrolLine?: any;
        } = {},
      ) {
        m.active = true;
        m.alive = true;
        m.wreck = false;
        m.hp = HOUND.hp;
        m.passive = !!D.passive;
        m.sink = 0;
        m.pos.copy(T);
        m.pos.y = s.physics.groundHeight(T.x, T.z, T.y + 1);
        m.home.copy(m.pos);
        m.yaw = D.yaw ?? o() * 6.283;
        m.speed = 0;
        m.yawRate = 0;
        m.push.set(0, 0, 0);
        m.mode = D.state === "alert" ? "investigate" : "patrol";
        m.modeT = 10;
        m.modeSeen = m.mode;
        m.lastKnown.copy(D.target || (s.player ? s.player.pos : T));
        m.los = false;
        m.seeT = m.noSeeT = 0;
        m.exposure = 0;
        m.senseT = o() * 0.2;
        m.hasToken = false;
        m.patrolR = D.patrolRadius ?? 7;
        m.patrolLine = D.patrolLine || null;
        m.patrolI = 0;
        m.es = "move";
        m.cool = 0.6 + o();
        m.lungeCd = 0.3;
        m.path = null;
        m.hasGoal = false;
        m.waitT = o() * 1.5;
        m.planT = 0;
        m.sw = -1;
        m.idleT = 0;
        m.crouch = 0;
        m.feelT = 0;
        m.blocked = false;
        m.flare = 0;
        m.phase = o() * 6.283;
        m.dieT = 0;
        m.tyaw = m.hyaw = 0;
        m.tpitch = m.hpitch = 0;
        for (let C of [m.sY, m.sP, m.sR, m.sL, m.sA, m.sA2]) {
          C.x = 0;
          C.v = 0;
        }
        for (let C = 0; C < 4; C++) A(b[C].p, C, m.pos.x, m.pos.z, m.yaw);
        l.neck.rotation.set(0, 0, 0);
        l.gun.rotation.set(0, 0, 0);
        a.group.visible = true;
        O(0.016);
        if (s.audio && s.audio.loop && !m.loop) {
          try {
            m.loop = s.audio.loop("hound_servo", {
              pos: m.pos,
              gain: 0,
            });
          } catch {
            m.loop = null;
          }
        }
      },
      _deactivate() {
        m.active = false;
        m.alive = false;
        m.wreck = false;
        a.group.visible = false;
        i.releaseToken(m);
        if (m.loop) {
          try {
            m.loop.stop();
          } catch {}
          m.loop = null;
        }
      },
      _raycast(T: Vector3Like, D: Vector3, C: number, G: any) {
        let j = false;
        if (raySphere(T, D, m.headPos, 0.155, C, G)) {
          G.part = "weak";
          G.enemy = m;
          j = true;
        }
        let N = Math.cos(m.yaw),
          Q = Math.sin(m.yaw),
          K = m.pos.y + HOUND_LEGS.stand + m.sY.x - m.crouch;
        _houndTmpA.set(m.pos.x - Q * 0.45, K + 0.03, m.pos.z - N * 0.45);
        _houndTmpB.set(m.pos.x + Q * 0.47, K + 0.03, m.pos.z + N * 0.47);
        if (rayCapsule(T, D, _houndTmpA, _houndTmpB, 0.27, C, G)) {
          G.part = "body";
          G.enemy = m;
          j = true;
        }
        _houndTmpA.y = _houndTmpB.y = m.pos.y + (K - m.pos.y) * 0.45;
        if (rayCapsule(T, D, _houndTmpA, _houndTmpB, 0.25, C, G)) {
          G.part = "body";
          G.enemy = m;
          j = true;
        }
        return j;
      },
      _update(T: number) {
        if (m.alive) {
          S(T);
        } else {
          U(T);
        }
      },
    },
    m = mInit as typeof mInit & {
      feelT: number;
      modeSeen: string;
      patrolR: any;
      patrolLine: any;
      patrolI: number;
      blocked: boolean;
      wantYaw: number;
    };
  function A(T: Vector3, D: number, C: number, G: number, j: number) {
    let N = HOUND_LEGS.side[D] * HOUND_LEGS.footX,
      Q = HOUND_LEGS.footZ[D],
      K = Math.cos(j),
      ie = Math.sin(j);
    T.set(C + N * K + Q * ie, 0, G - N * ie + Q * K);
    return T;
  }
  function _(T: Vector3Like, D?: boolean) {
    if (!(!D && m.hasGoal && m.goal.distanceToSquared(T) < 0.25)) {
      m.goal.copy(T);
      m.hasGoal = true;
      m.planT = 0;
      m.stuckT = 0;
    }
  }
  function M() {
    m.planT = HOUND.replan + o() * 0.15;
    let T: any = null;
    try {
      T = s.physics.nav.findPath(m.pos, m.goal);
    } catch {
      T = null;
    }
    m.path = T && T.length ? T : null;
    m.wp = 0;
    if (
      m.path &&
      m.path.length > 1 &&
      m.path[0].distanceToSquared(m.pos) < 0.36
    ) {
      m.wp = 1;
    }
  }
  function E(T: number, D: number) {
    if (!m.hasGoal) {
      m.maxSpeed = 0;
      return true;
    }
    m.planT -= T;
    if (m.planT <= 0) {
      M();
    }
    let C = m.goal;
    if (m.path) {
      for (
        ;
        m.wp < m.path.length - 1 &&
        Math.hypot(m.path[m.wp].x - m.pos.x, m.path[m.wp].z - m.pos.z) < 0.55;
      )
        m.wp++;
      C = m.path[Math.min(m.wp, m.path.length - 1)];
    }
    let G = m.goal.x - m.pos.x,
      j = m.goal.z - m.pos.z,
      N = Math.hypot(G, j);
    if (N < 0.45) {
      m.hasGoal = false;
      m.maxSpeed = 0;
      return true;
    }
    let Q = C.x - m.pos.x,
      K = C.z - m.pos.z;
    m.wantYaw = Math.atan2(Q, K);
    let ie = Math.abs(houndWrapAngle(m.wantYaw, m.yaw));
    m.maxSpeed = ie > 1.1 ? 0 : Math.min(D * (1 - ie * 0.5), 0.4 + N * 2.6);
    return false;
  }
  function w() {
    let T = s.player;
    if (!T) {
      return;
    }
    let D = 1 / 0,
      C = T.eye || T.pos,
      G = (Q: Vector3, K: number) => {
        let ie = Math.hypot(Q.x - T.pos.x, Q.z - T.pos.z);
        if (
          ie < HOUND.rangeMin ||
          ie > HOUND.rangeMax ||
          (s.physics.nav.isWalkable && !s.physics.nav.isWalkable(Q.x, Q.z))
        ) {
          return;
        }
        let F = Math.hypot(Q.x - m.pos.x, Q.z - m.pos.z) * 0.9 + K + o() * 3,
          X = Q.x - T.pos.x,
          ne = Q.z - T.pos.z;
        for (let re of i.list) {
          if (
            re === m ||
            !re.alive ||
            re.type !== "hound" ||
            re.mode !== "engage"
          ) {
            continue;
          }
          let $ = re.es === "move" ? re.firePos : re.pos,
            ue = $.x - T.pos.x,
            me = $.z - T.pos.z,
            ee =
              (X * ue + ne * me) /
              (Math.hypot(X, ne) * Math.hypot(ue, me) + 1e-4);
          if (ee > 0.86) {
            F += (14 * (ee - 0.86)) / 0.14;
          }
          if (Math.hypot(Q.x - $.x, Q.z - $.z) < 3) {
            F += 16;
          }
        }
        if (!(F >= D)) {
          _houndTargetPos.set(Q.x, Q.y + 0.95, Q.z);
          if (!s.physics.lineOfSight(_houndTargetPos, C)) {
            F += 22;
          }
          if (F < D) {
            D = F;
            m.firePos.set(Q.x, Q.y, Q.z);
          }
        }
      },
      j = s.level && s.level.coverPoints;
    if (j) {
      for (let Q = 0; Q < j.length; Q++) G(j[Q], -2);
    }
    for (let Q = 0; Q < 7; Q++) {
      let K = s.physics.nav.randomPoint(T.pos, HOUND.rangeMax);
      if (K) {
        G(K, 0);
      }
    }
    let N = Math.atan2(m.pos.z - T.pos.z, m.pos.x - T.pos.x);
    for (let Q = 0; Q < 5; Q++) {
      let K = N + (o() - 0.5) * 2.6,
        ie = HOUND.rangeMin + 1 + o() * (HOUND.rangeMax - HOUND.rangeMin - 2);
      _houndOrigin.set(
        T.pos.x + Math.cos(K) * ie,
        T.pos.y,
        T.pos.z + Math.sin(K) * ie,
      );
      _houndOrigin.y = s.physics.groundHeight(
        _houndOrigin.x,
        _houndOrigin.z,
        T.pos.y + 1,
      );
      G(_houndOrigin, 1);
    }
    if (D === 1 / 0) {
      m.firePos.copy(m.pos);
    }
    m.firePlayer.copy(T.pos);
    _(m.firePos, true);
    m.es = "move";
    m.esT = 0;
    m.moveT = 0;
    m.bursts = 0;
  }
  function S(T: number) {
    let D = s.player,
      C = i.t;
    m.fwd.set(Math.sin(m.yaw), 0, Math.cos(m.yaw));
    m.sensor.copy(m.headPos);
    i.think(m, T, 0.55);
    if (m.mode !== m.modeSeen) {
      m.modeSeen = m.mode;
      m.hasGoal = false;
      m.path = null;
      m.waitT = 0;
      if (m.mode === "engage") {
        w();
      } else if (m.es === "tele" || m.es === "burst") {
        i.releaseToken(m);
        m.es = "move";
      }
    }
    m.wantYaw = m.yaw;
    m.maxSpeed = 0;
    m.cool -= T;
    m.lungeCd -= T;
    let G: any = null,
      j: any = null,
      N = 0,
      Q = false,
      K = D ? Math.hypot(D.pos.x - m.pos.x, D.pos.z - m.pos.z) : 1e9;
    if (m.mode === "patrol") {
      if (m.hasGoal) {
        if (E(T, HOUND.patrolSpeed)) {
          m.waitT = 1.5 + o() * 3;
        }
      } else {
        m.waitT -= T;
        if (m.waitT <= 0) {
          if (m.patrolLine) {
            m.patrolI = (m.patrolI + 1) % m.patrolLine.length;
            _(m.patrolLine[m.patrolI], true);
          } else {
            let I = s.physics.nav.randomPoint(m.home, m.patrolR);
            if (I) {
              _(I, true);
            } else {
              m.waitT = 1;
            }
          }
        }
      }
    } else if (m.mode === "investigate" || m.mode === "search") {
      j = m.lastKnown;
      let I = Math.hypot(m.lastKnown.x - m.pos.x, m.lastKnown.z - m.pos.z);
      if (I > 2.2) {
        _(m.lastKnown);
        E(T, I < 8 ? HOUND.stalkSpeed : HOUND.runSpeed);
      } else {
        m.hasGoal = false;
        m.scan += T;
        m.wantYaw = m.yaw + Math.sin(m.scan * 0.8) * 0.9;
        j = null;
      }
    } else if (D) {
      G = D.pos;
      j = D.pos;
      let I = Math.atan2(D.pos.x - m.pos.x, D.pos.z - m.pos.z);
      switch (
        ((m.es === "move" || m.es === "aim" || m.es === "cool") &&
          K < HOUND.lungeRange &&
          m.lungeCd <= 0 &&
          D.alive &&
          ((m.es = "wind"),
          (m.esT = 0.28),
          i.releaseToken(m),
          s.events.emit("enemy:telegraph", {
            enemy: m,
            type: "hound",
            time: 0.28,
            pos: m.pos,
            melee: true,
          })),
        m.es)
      ) {
        case "move": {
          m.moveT += T;
          let se = E(T, HOUND.runSpeed),
            ae = K > HOUND.rangeMin - 1 && K < HOUND.rangeMax + 2;
          if (
            se ||
            (m.moveT > 1.4 && m.los && ae && o() < T * 0.7) ||
            m.moveT > 7
          ) {
            m.es = "aim";
            m.esT = 0;
            m.hasGoal = false;
          } else if (D.pos.distanceToSquared(m.firePlayer) > 49) {
            w();
          }
          break;
        }
        case "aim":
        case "cool": {
          m.wantYaw = I;
          m.esT += T;
          if (m.los) {
            if (K < HOUND.rangeMin - 3 && m.esT > 0.8) {
              w();
            } else if (
              m.cool <= 0 &&
              D.alive &&
              Math.abs(houndWrapAngle(I - m.yaw, m.tyaw)) < 0.14 &&
              i.requestToken(m)
            ) {
              m.es = "tele";
              m.esT = HOUND.telegraph;
              s.events.emit("enemy:telegraph", {
                enemy: m,
                type: "hound",
                time: HOUND.telegraph,
                pos: m.pos,
              });
            }
          } else if (m.noSeeT > 1.1 || m.esT > 3) {
            w();
          }
          break;
        }
        case "tele": {
          m.wantYaw = I;
          m.esT -= T;
          m.flare = Math.min(1, m.flare + T * 5);
          N = 0.05;
          if (m.esT <= 0) {
            m.es = "burst";
            m.shots = HOUND.burst;
            m.esT = 0;
          }
          break;
        }
        case "burst": {
          m.wantYaw = I;
          m.esT -= T;
          m.flare = 1;
          N = 0.05;
          if (m.esT <= 0) {
            m.esT = HOUND.burstGap;
            m.shots--;
            z(D);
          }
          if (m.shots <= 0) {
            i.releaseToken(m);
            m.cool =
              HOUND.cooldown[0] + o() * (HOUND.cooldown[1] - HOUND.cooldown[0]);
            m.bursts++;
            if (m.bursts >= 1 + (o() < 0.4 ? 1 : 0)) {
              w();
            } else {
              m.es = "cool";
              m.esT = 0;
            }
          }
          break;
        }
        case "wind": {
          m.wantYaw = I;
          m.esT -= T;
          N = 0.16;
          m.sP.v += 3 * T;
          if (m.esT <= 0) {
            m.es = "lunge";
            m.esT = 0.36;
            m.speed = HOUND.lungeSpeed;
            m.yaw = I;
          }
          break;
        }
        case "lunge": {
          Q = true;
          m.esT -= T;
          m.wantYaw = I;
          m.maxSpeed = HOUND.lungeSpeed;
          m.speed = HOUND.lungeSpeed;
          if (K < 1.35 && D.alive) {
            D.damage(HOUND.lungeDamage, m.pos);
            s.events.emit("enemy:melee", {
              enemy: m,
              pos: m.pos,
            });
            m.esT = 0;
            m.sP.v -= 4;
          }
          if (m.esT <= 0) {
            m.es = "recover";
            m.esT = 0.55;
            m.lungeCd = HOUND.lungeCooldown;
            m.speed *= 0.3;
          }
          break;
        }
        case "recover": {
          m.esT -= T;
          m.wantYaw = I;
          if (m.esT <= 0) {
            w();
          }
          break;
        }
      }
    }
    let ie = houndWrapAngle(m.wantYaw, m.yaw),
      F = houndClamp(ie * 6, -HOUND.turnRate, HOUND.turnRate) * (Q ? 2 : 1);
    m.yawRate += (F - m.yawRate) * (1 - Math.exp(-10 * T));
    m.yaw += m.yawRate * T;
    let X = m.maxSpeed > m.speed ? HOUND.accel : -HOUND.accel * 1.4;
    m.prevSpeed = m.speed;
    m.speed = Q
      ? m.speed
      : houndClamp(m.speed + X * T, 0, Math.max(m.maxSpeed, 0));
    if (!Q && X < 0 && m.speed < m.maxSpeed) {
      m.speed = m.maxSpeed;
    }
    let ne = Math.sin(m.yaw),
      re = Math.cos(m.yaw);
    for (let I of i.list) {
      if (I === m || I.type !== "hound" || !I.active) {
        continue;
      }
      let se = m.pos.x - I.pos.x,
        ae = m.pos.z - I.pos.z,
        k = Math.hypot(se, ae);
      if (k < 1.7 && k > 0.001) {
        let ce = ((1.7 - k) * 2.2) / k;
        m.push.x += se * ce * T * 6;
        m.push.z += ae * ce * T * 6;
      }
    }
    if (D && !Q && K < 1.25 && K > 0.001) {
      let I = ((1.25 - K) * 3) / K;
      m.push.x += (m.pos.x - D.pos.x) * I * T * 6;
      m.push.z += (m.pos.z - D.pos.z) * I * T * 6;
    }
    m.push.multiplyScalar(Math.exp(-5 * T));
    let $ = m.pos.x + (ne * m.speed + m.push.x) * T,
      ue = m.pos.z + (re * m.speed + m.push.z) * T,
      me = s.physics.nav;
    m.feelT -= T;
    if (m.feelT <= 0 && m.speed > 0.3) {
      m.feelT = 0.12;
      _houndOrigin.set(m.pos.x, m.pos.y + 0.55, m.pos.z);
      _houndShotDir.set(ne, 0, re);
      let I = s.physics.raycast(
        _houndOrigin,
        _houndShotDir,
        0.75 + m.speed * 0.12,
      );
      m.blocked = !!I;
    } else {
      if (m.speed <= 0.3) {
        m.blocked = false;
      }
    }
    if (
      (me.isWalkable && !me.isWalkable($, ue)) ||
      (m.blocked && !Q) ||
      (m.blocked && Q && m.esT < 0.3)
    ) {
      if (m.blocked) {
        $ = m.pos.x + m.push.x * T;
        ue = m.pos.z + m.push.z * T;
        m.yawRate += (m.phase > 3.14 ? 1 : -1) * 4 * T;
      } else if (me.isWalkable($, m.pos.z)) {
        ue = m.pos.z;
      } else if (me.isWalkable(m.pos.x, ue)) {
        $ = m.pos.x;
      } else {
        $ = m.pos.x;
        ue = m.pos.z;
      }
      m.speed *= 0.6;
      m.stuckT += T;
      if (m.stuckT > 0.5) {
        m.stuckT = 0;
        m.planT = 0;
        if (m.mode === "engage" && m.es === "move") {
          w();
        } else if (m.mode === "patrol") {
          m.hasGoal = false;
        }
      }
    }
    m.pos.x = $;
    m.pos.z = ue;
    m.pos.y +=
      (s.physics.groundHeight($, ue, m.pos.y + 0.6) - m.pos.y) *
      (1 - Math.exp(-12 * T));
    H(T);
    m.crouch += (N - m.crouch) * (1 - Math.exp(-12 * T));
    let ee = Math.cos(m.yaw),
      B = Math.sin(m.yaw),
      P = 0,
      V = 0,
      Y = 0,
      L = 0.05,
      Z = m.pos.y + HOUND_LEGS.stand + m.sY.x - m.crouch;
    if (G) {
      let I = G.x - m.pos.x,
        se = G.z - m.pos.z,
        ae = G.y + 1 - (Z + 0.25);
      P = Math.atan2(I * ee - se * B, I * B + se * ee);
      V = houndClamp(Math.atan2(-ae, Math.hypot(I, se)), -0.9, 0.35);
    } else {
      m.scan += T * 0.5;
      P = Math.sin(m.scan * 0.9 + m.phase) * 1.1;
    }
    if (j) {
      let I = j.x - m.pos.x,
        se = j.z - m.pos.z,
        ae = j.y + 1.2 - (Z + 0.2);
      Y = houndClamp(Math.atan2(I * ee - se * B, I * B + se * ee), -1.2, 1.2);
      L = houndClamp(Math.atan2(-ae, Math.hypot(I, se)), -0.6, 0.5);
    } else {
      Y =
        Math.sin(i.t * 0.7 + m.phase) * 0.5 +
        houndClamp(m.yawRate * 0.25, -0.6, 0.6);
    }
    let J = houndClamp(4.5 * T, 0, 1);
    m.tyaw += houndClamp(houndWrapAngle(P, m.tyaw), -J, J);
    m.tpitch += (V - m.tpitch) * (1 - Math.exp(-10 * T));
    let oe = 1 - Math.exp(-7 * T);
    m.hyaw += (Y - m.hyaw) * oe;
    m.hpitch += (L - m.hpitch) * oe;
    O(T);
    let fe = (i.t * (m.mode === "patrol" ? 0.8 : 2.2) + m.phase) % 1;
    l.beacon.scale.setScalar(fe < 0.12 || (fe > 0.22 && fe < 0.3) ? 1 : 1e-4);
    let le = m.mode === "engage" ? HOUND_LENS_ENGAGE : HOUND_LENS_IDLE,
      R = 1 + m.flare * 3.5;
    for (let I = 0; I < 3; I++)
      m.lensC[I] += (le[I] - m.lensC[I]) * (1 - Math.exp(-8 * T));
    r.color.setRGB(m.lensC[0] * R, m.lensC[1] * R, m.lensC[2] * R);
    m.flare = Math.max(0, m.flare - T * 2);
    if (m.hp < HOUND.hp * HOUND.smokeBelow) {
      m.smokeT -= T;
      if (m.smokeT <= 0) {
        m.smokeT = 0.2;
        _houndTmpA.set(m.pos.x - ne * 0.3, Z + 0.2, m.pos.z - re * 0.3);
        s.fx.smoke(_houndTmpA, {
          size: 0.35,
          life: 1.3,
          color: 2303272,
          rise: 0.9,
        });
        if (o() < 0.2) {
          s.fx.sparks(_houndTmpA, HOUND_UP, 3);
        }
      }
    }
    if (m.loop) {
      m.loop.setPos(m.pos);
      m.loop.setGain(
        houndClamp(0.12 + m.speed * 0.12 + Math.abs(m.yawRate) * 0.1, 0, 0.8),
      );
      m.loop.setPitch(0.8 + m.speed * 0.08);
    }
  }
  function z(T: { pos: { x: number; y: number; z: number } }) {
    let D = Math.cos(m.yaw + m.tyaw),
      C = Math.sin(m.yaw + m.tyaw);
    _houndOrigin.setFromMatrixPosition(l.gun.matrixWorld);
    if (
      _houndOrigin.lengthSq() < 1e-6 ||
      Math.abs(_houndOrigin.x - m.pos.x) > 2
    ) {
      _houndOrigin.set(m.pos.x, m.pos.y + HOUND_LEGS.stand + 0.25, m.pos.z);
    }
    _houndTargetPos.set(T.pos.x, T.pos.y + 1, T.pos.z);
    _houndShotDir.copy(_houndTargetPos).sub(_houndOrigin).normalize();
    m.muzzle.copy(_houndOrigin).addScaledVector(_houndShotDir, 0.43);
    let G =
      (HOUND.spreadFar + (HOUND.spreadNear - HOUND.spreadFar) * m.exposure) *
      (1 + i.playerSpeed * 0.3);
    _houndShotDir.x += (o() - 0.5) * 2 * G;
    _houndShotDir.y += (o() - 0.5) * 2 * G;
    _houndShotDir.z += (o() - 0.5) * 2 * G;
    _houndShotDir.normalize();
    let j = s.physics.raycast(m.muzzle, _houndShotDir, 200),
      Q = s.combat.enemyShot(m.muzzle, _houndShotDir, {
        damage: HOUND.shotDamage,
        range: 200,
      })
        ? m.muzzle.distanceTo(_houndTargetPos)
        : j
          ? j.dist
          : 90;
    _houndTracerEnd.copy(m.muzzle).addScaledVector(_houndShotDir, Q);
    s.fx.tracer(m.muzzle, _houndTracerEnd, {
      color: 16760944,
      speed: 260,
      width: 0.035,
    });
    s.fx.muzzleFlash(m.muzzle, _houndShotDir, {
      scale: 0.9,
    });
    if (s.render && s.render.lightPool) {
      s.render.lightPool.flash(m.muzzle, 16756832, 22, 7, 0.05);
    }
    s.events.emit("enemy:fire", {
      enemy: m,
      pos: m.muzzle,
      dir: _houndShotDir,
      type: "hound",
    });
    m.sP.v += 1.1;
    m.sY.v -= 0.25;
  }
  function H(T: number) {
    let D = Math.sin(m.yaw) * m.speed + m.push.x,
      C = Math.cos(m.yaw) * m.speed + m.push.z,
      G = m.speed > 0.15 || Math.abs(m.yawRate) > 0.25;
    if (m.sw < 0) {
      m.idleT = G ? 0 : m.idleT + T;
      let j = m.speed + Math.abs(m.yawRate) * 0.5,
        N = houndClamp(0.27 - j * 0.026, 0.14, 0.27),
        Q = -1,
        K = 0;
      for (let F = 0; F < 2; F++) {
        let X = 0;
        for (let ne of HOUND_GAIT_PAIRS[F]) {
          A(
            _houndTmpA,
            ne,
            m.pos.x + D * N,
            m.pos.z + C * N,
            m.yaw + m.yawRate * N,
          );
          let re = Math.hypot(
            _houndTmpA.x - b[ne].p.x,
            _houndTmpA.z - b[ne].p.z,
          );
          if (re > X) {
            X = re;
          }
        }
        if (F !== m.lastPair) {
          X *= 1.25;
        }
        if (X > K) {
          K = X;
          Q = F;
        }
      }
      let ie = G ? 0.09 : m.idleT > 0.25 ? 0.035 : 1e9;
      if (Q >= 0 && K > ie) {
        m.sw = Q;
        m.swT = 0;
        m.swDur = N;
        m.lift = 0.065 + Math.min(0.09, j * 0.02);
        for (let F of HOUND_GAIT_PAIRS[Q]) {
          let X = b[F];
          X.from.copy(X.p);
          A(
            X.to,
            F,
            m.pos.x + D * N * 1.5,
            m.pos.z + C * N * 1.5,
            m.yaw + m.yawRate * N * 1.5,
          );
          X.to.y = s.physics.groundHeight(X.to.x, X.to.z, m.pos.y + 0.6);
        }
      }
    } else {
      m.swT += T / m.swDur;
      let j = m.swT >= 1 ? 1 : m.swT,
        N = j * j * (3 - 2 * j);
      for (let Q of HOUND_GAIT_PAIRS[m.sw]) {
        let K = b[Q];
        K.p.lerpVectors(K.from, K.to, N);
        K.p.y += Math.sin(Math.PI * j) * m.lift;
      }
      if (m.swT >= 1) {
        let Q = b[HOUND_GAIT_PAIRS[m.sw][0]];
        s.events.emit("enemy:step", {
          pos: Q.p,
          type: "hound",
          enemy: m,
          speed: m.speed,
        });
        m.sY.v -= 0.12 + m.speed * 0.03;
        m.lastPair = m.sw;
        m.sw = -1;
      }
    }
  }
  function O(T: number) {
    let D = Math.cos(m.yaw),
      C = Math.sin(m.yaw),
      G = (b[0].p.y + b[1].p.y) * 0.5,
      j = (b[2].p.y + b[3].p.y) * 0.5,
      N = (b[0].p.y + b[2].p.y) * 0.5,
      Q = (b[1].p.y + b[3].p.y) * 0.5,
      K = (G + j) * 0.5 - m.pos.y,
      ie = T > 0 ? (m.speed - m.prevSpeed) / T : 0,
      F = Math.atan2(j - G, 0.8) * 0.6 + houndClamp(ie * 0.006, -0.07, 0.07),
      X =
        Math.atan2(N - Q, 0.55) * 0.6 +
        houndClamp(m.yawRate * m.speed * 0.02, -0.12, 0.12),
      ne = K * 0.45 - Math.min(0.05, m.speed * 0.011);
    if (!m.alive) {
      F = m.diePitch;
      X = m.dieRoll;
      ne = 0;
    }
    if (m.alive) {
      spring(m.sY, ne, 160, 17, T);
      spring(m.sP, F, 130, 15, T);
      spring(m.sR, X, 130, 15, T);
      spring(m.sL, 0, 110, 13, T);
    }
    let re = m.alive ? Math.sin(i.t * 1.7 + m.phase) * 0.004 : 0,
      $ = m.sL.x,
      ue = HOUND_LEGS.stand + m.sY.x - m.crouch + re,
      me = m.sP.x,
      ee = m.sR.x;
    a.group.rotation.y = m.yaw;
    l.body.position.set($, ue, 0);
    l.body.rotation.set(me, 0, ee);
    l.turret.rotation.y = m.tyaw;
    l.gun.rotation.x = m.tpitch - me * 0.5;
    l.head.rotation.set(m.hpitch, m.hyaw, 0);
    spring(m.sA, houndClamp(-ie * 0.03 - me, -0.6, 0.6), 60, 5, T);
    spring(m.sA2, houndClamp(m.yawRate * 0.12 - ee, -0.6, 0.6), 60, 5, T);
    l.antenna.rotation.set(m.sA.x, 0, m.sA2.x);
    let B = Math.cos(me),
      P = Math.sin(me),
      V = Math.cos(ee),
      Y = Math.sin(ee);
    for (let L = 0; L < 4; L++) {
      let Z = b[L].p,
        J = Z.x - m.pos.x,
        oe = Z.y + HOUND_LEGS.footR * 0.6 - m.pos.y,
        fe = Z.z - m.pos.z,
        le = J * D - fe * C - $,
        R = oe - ue,
        I = J * C + fe * D,
        se = R * B + I * P,
        ae = -R * P + I * B,
        k = le * V + se * Y,
        ce = -le * Y + se * V;
      solveTwoBone(
        _houndIkAngles,
        k - HOUND_LEGS.side[L] * HOUND_LEGS.hipX,
        ce - HOUND_LEGS.hipY,
        ae - HOUND_LEGS.fore[L] * HOUND_LEGS.hipZ,
        HOUND_LEGS.side[L],
        HOUND_LEGS.l0,
        HOUND_LEGS.L1,
        HOUND_LEGS.L2 - HOUND_LEGS.footR * 0.6,
      );
      c[L].rotation.z = _houndIkAngles.abd;
      u[L].rotation.x = _houndIkAngles.hip;
      h[L].rotation.x = _houndIkAngles.knee;
    }
    a.group.updateMatrixWorld(true);
    m.headPos.setFromMatrixPosition(l.head.matrixWorld);
  }
  function q(T: { x: number; z: number }) {
    m.alive = false;
    i.releaseToken(m);
    m.dieT = 0;
    m.vy = 0;
    m.es = "move";
    l.beacon.scale.setScalar(1e-4);
    m.dieRoll = (o() < 0.5 ? -1 : 1) * (0.25 + o() * 0.3);
    m.diePitch = (o() - 0.5) * 0.25;
    m.sR.v += m.dieRoll * 3;
    m.sP.v += (o() - 0.5) * 2;
    for (let D = 0; D < 4; D++) {
      let C = b[D];
      if (m.sw >= 0) {
        C.p.y = m.pos.y;
      }
      let G = m.yaw,
        j = HOUND_LEGS.side[D] * (0.16 + o() * 0.2),
        N = HOUND_LEGS.fore[D] * (0.05 + o() * 0.22) + (o() - 0.5) * 0.1;
      C.slide.set(
        j * Math.cos(G) + N * Math.sin(G),
        0,
        -j * Math.sin(G) + N * Math.cos(G),
      );
    }
    m.sw = -1;
    m.speed *= 0.3;
    _houndTmpA.copy(m.headPos);
    s.fx.sparks(_houndTmpA, HOUND_UP, 16);
    s.fx.debris(_houndTmpA, {
      count: 4,
    });
    s.events.emit("enemy:killed", {
      enemy: m,
      pos: m.pos,
      type: "hound",
    });
    i.addWreck(m);
  }
  function U(T: number) {
    if (m.sink > 0) {
      m.sink += T;
      m.pos.y -= 0.22 * T;
      if (m.sink > 3.2) {
        i.retire(m);
      }
      return;
    }
    m.dieT += T;
    let D = m.dieT;
    if (D < 2.2) {
      let C = 0.215 - HOUND_LEGS.stand;
      m.vy -= 9.8 * T * (D < 0.12 ? 0.3 : 1);
      m.sY.x += m.vy * T;
      if (m.sY.x < C) {
        m.sY.x = C;
        if (m.vy < -1.2) {
          s.events.emit("enemy:step", {
            pos: m.pos,
            type: "hound",
            enemy: m,
            speed: 5,
            crash: true,
          });
          s.fx.dust(m.pos, HOUND_UP);
        }
        m.vy = -m.vy * 0.22;
      }
      spring(m.sP, m.diePitch, 60, 9, T);
      spring(m.sR, m.dieRoll, 60, 9, T);
      spring(m.sL, 0, 40, 8, T);
      let G = Math.exp(-3.2 * T);
      for (let N = 0; N < 4; N++) {
        let Q = b[N];
        Q.p.x += Q.slide.x * (1 - G);
        Q.p.z += Q.slide.z * (1 - G);
        Q.slide.multiplyScalar(G);
      }
      m.pos.x += Math.sin(m.yaw) * m.speed * T;
      m.pos.z += Math.cos(m.yaw) * m.speed * T;
      m.speed *= Math.exp(-5 * T);
      m.hpitch += (0.55 - m.hpitch) * (1 - Math.exp(-5 * T));
      m.hyaw += (m.dieRoll - m.hyaw) * (1 - Math.exp(-3 * T));
      m.tpitch += (0.3 - m.tpitch) * (1 - Math.exp(-4 * T));
      let j = D < 1.2 ? (Math.sin(D * 60) > 0.2 ? 1 - D / 1.2 : 0.05) : 0.02;
      r.color.setRGB(6 * j + 0.05, 0.6 * j + 0.01, 0.2 * j);
      O(T);
    }
    if (D < 6.5) {
      m.smokeT -= T;
      if (m.smokeT <= 0) {
        m.smokeT = D < 2 ? 0.09 : 0.2;
        _houndTmpA.set(
          m.pos.x + (o() - 0.5) * 0.4,
          m.pos.y + 0.42,
          m.pos.z + (o() - 0.5) * 0.4,
        );
        s.fx.smoke(_houndTmpA, {
          size: 0.5 + o() * 0.3,
          life: 1.8,
          color: 1513499,
          rise: 1.1,
        });
        if (D < 4 && o() < 0.55) {
          _houndTmpB.set(o() - 0.5, 1, o() - 0.5).normalize();
          s.fx.sparks(_houndTmpA, _houndTmpB, D < 1 ? 8 : 3);
        }
        if (D < 3.5 && o() < 0.4) {
          s.fx.smoke(_houndTmpA, {
            size: 0.22,
            life: 0.45,
            color: 16742946,
            rise: 1.6,
          });
        }
      }
    } else if (!m.wreck && ((m.wreck = true), m.loop)) {
      try {
        m.loop.stop();
      } catch {}
      m.loop = null;
    }
    if (m.loop) {
      m.loop.setGain(Math.max(0, 0.4 - D * 0.3));
    }
  }
  return m;
}
function raySphere(
  i: { x: number; y: number; z: number },
  e: { x: number; y: number; z: number },
  t: Vector3,
  n: number,
  s: number,
  o: any,
) {
  let r = i.x - t.x,
    a = i.y - t.y,
    l = i.z - t.z,
    c = r * e.x + a * e.y + l * e.z,
    u = r * r + a * a + l * l - n * n,
    h = c * c - u;
  if (h < 0) {
    return false;
  }
  let f = -c - Math.sqrt(h);
  return f < 0 || f > s || f >= o.dist
    ? false
    : ((o.dist = f),
      o.point.copy(i).addScaledVector(e, f),
      o.normal.copy(o.point).sub(t).normalize(),
      true);
}
const _capsuleAxis = new Vector3();
const _capsuleToOrigin = new Vector3();
const _capsuleClosest = new Vector3();
function rayCapsule(
  i: Vector3Like,
  e: Vector3,
  t: Vector3,
  n: Vector3,
  s: number,
  o: number,
  r: any,
) {
  _capsuleAxis.copy(n).sub(t);
  _capsuleToOrigin.copy(i).sub(t);
  let a = _capsuleAxis.dot(_capsuleAxis),
    l = _capsuleAxis.dot(e),
    c = _capsuleAxis.dot(_capsuleToOrigin),
    u = e.dot(_capsuleToOrigin),
    h = a - l * l,
    f = h > 1e-8 ? (c - l * u) / h : 0;
  f = f < 0 ? 0 : f > 1 ? 1 : f;
  _capsuleClosest.copy(t).addScaledVector(_capsuleAxis, f);
  return raySphere(i, e, _capsuleClosest, s, o, r);
}
