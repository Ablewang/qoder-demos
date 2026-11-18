// Game state machine: intro, objectives, extraction, death and retry.
import type { GameContext } from "../types/context";
import { Vector3 } from "three";
import { clamp, damp, saturate, smoothstep } from "../utils/math";
import { createMenus } from "../ui/menus";
import { createLocalId } from "../data/user-data";
import type { RunResult } from "../data/user-data";

const GAME = {
  introSeconds: 3.5,
  retryIntroSeconds: 1.3,
  interactRange: 2.2,
  interactFacing: 0.45,
  cutSeconds: 2.4,
  patrol: {
    gull: 2,
    hound: 1,
  } as Record<string, number>,
  waves: [
    {
      gull: 3,
      hound: 1,
    },
    {
      gull: 3,
      hound: 2,
    },
    {
      gull: 4,
      hound: 3,
    },
  ],
  maxAlive: 9,
  spawnStagger: 0.85,
  spawnFar: 18,
  pursuitEvery: 7,
  pursuitMinAlive: 4,
  pursuitExtra: 5,
  titleSpeed: 1.15,
  titleFov: 50,
};
const ALERT_DIRECTIONS = [
  "北方",
  "东北方",
  "东方",
  "东南方",
  "南方",
  "西南方",
  "西方",
  "西北方",
];
const RADIO_LINES = {
  intro:
    "几猫队员，这里是指挥中心。港区主控已封锁泊位。切断堆场、仓库、码头的三处中继。",
  contact: "你已被发现！空中有机械飞鸥，地面有机械猎犬。消灭它们。",
  cut: [
    "第一处中继已断开。敌方已察觉，机械守卫正在赶来。",
    "第二处中继已断开。敌方正全力围攻，小心应对。",
  ],
  all: "三处中继全部断开！撤离艇在码头南端的舷梯旁，快撤！",
  low: "伤势严重！找掩体躲避，稍作恢复。",
  done: "几猫队员已登船，港区封锁解除。干得漂亮！",
};
export function createGame(i: GameContext) {
  let runId = "";
  let e = (i.render && i.render.post) || {},
    t = typeof e.saturation == "number" ? e.saturation : 1,
    n = i.player,
    s = i.level,
    o = i.hud,
    r = i.input,
    a = (
      P: any,
      V: string,
      ...Y: (number | boolean | Vector3 | undefined)[]
    ) => {
      try {
        if (P && typeof P[V] == "function") {
          return P[V](...Y);
        }
      } catch (L: any) {
        console.error(`[game] ${V} threw`, L);
      }
    },
    l = createMenus(i, {
      deploy() {
        a(i.audio, "resume");
        r.requestLock();
        U({});
      },
      resume() {
        j(true);
      },
      restart() {
        a(i.audio, "resume");
        r.requestLock();
        c.retries++;
        U({
          quick: true,
          keepRetries: true,
        });
      },
      retry() {
        a(i.audio, "resume");
        r.requestLock();
        c.retries++;
        U({
          quick: true,
          keepRetries: true,
        });
      },
      redeploy() {
        a(i.audio, "resume");
        r.requestLock();
        U({
          quick: true,
        });
      },
    });
  l.applySettings();
  let c = {
      time: 0,
      retries: 0,
      relays: [] as any[],
      cut: 0,
      allCut: false,
      queue: [] as { type: string; pos: Vector3; at: number; tries?: number }[],
      waveHot: 0,
      alertT: 0,
      pursuitT: 0,
      pursuitLeft: 0,
      contactSaid: false,
      lowSaid: false,
      extractHint: 0,
      intensity: 0.15,
      used: new Map(),
    },
    u = 0,
    h = GAME.introSeconds,
    f = false,
    p = false,
    d = 0,
    v = 0,
    g = false,
    x = "",
    y = 0.8,
    b = new Vector3(),
    m = new Vector3(),
    A = () => (s && s.objectives) || [],
    _ = {
      state: "title",
      flow: GAME,
      run: c,
      menus: l,
      start(P: { skipIntro?: boolean; quick?: any } = {}) {
        U({
          skipIntro: !!P.skipIntro,
          quick: !!P.quick,
        });
      },
      pause() {
        G();
      },
      resume() {
        j(false);
      },
      update: B,
      debugCut() {
        let P = c.relays.find((V) => !V.cut);
        if (P) {
          me(P);
        }
      },
    };
  function M(P: string) {
    let V = _.state;
    if (P !== V) {
      _.state = P;
      u = 0;
      i.events.emit("game:state", {
        state: P,
        prev: V,
      });
    }
  }
  let E = {
    pos: [] as Vector3[],
    look: [] as Vector3[],
    len: 1,
    t: 0,
  };
  function w() {
    let P = (s && s.cinematicPath) || [];
    E.pos = P.map((Y) => new Vector3(...Y.pos));
    E.look = P.map((Y) => new Vector3(...Y.look));
    if (E.pos.length < 2) {
      let Y = (s && s.playerStart && s.playerStart.pos) || new Vector3();
      E.pos = [new Vector3(Y.x, 2.2, Y.z), new Vector3(Y.x + 8, 2, Y.z)];
      E.look = [
        new Vector3(Y.x + 30, 2.5, Y.z - 2),
        new Vector3(Y.x + 40, 3, Y.z - 2),
      ];
    }
    let V = 0;
    for (let Y = 1; Y < E.pos.length; Y++)
      V += E.pos[Y].distanceTo(E.pos[Y - 1]);
    E.len = Math.max(V, 4);
  }
  function S(P: any, V: number, Y: Vector3) {
    let L = P.length - 1,
      Z = clamp(V, 0, 1) * L,
      J = Math.min(L - 1, Math.floor(Z)),
      oe = Z - J,
      fe = P[Math.max(0, J - 1)],
      le = P[J],
      R = P[J + 1],
      I = P[Math.min(L, J + 2)],
      se = oe * oe,
      ae = se * oe,
      k = (ce: number, ve: number, _e: number, Te: number) =>
        0.5 *
        (2 * ve +
          (-ce + _e) * oe +
          (2 * ce - 5 * ve + 4 * _e - Te) * se +
          (-ce + 3 * ve - 3 * _e + Te) * ae);
    return Y.set(
      k(fe.x, le.x, R.x, I.x),
      k(fe.y, le.y, R.y, I.y),
      k(fe.z, le.z, R.z, I.z),
    );
  }
  function z(P: number) {
    let V = Math.max(26, E.len / GAME.titleSpeed);
    E.t += P;
    if (E.t >= V) {
      E.t = 0;
    }
    let Y = E.t / V,
      L = Y * Y * (3 - 2 * Y) * 0.25 + Y * 0.75,
      Z = i.camera,
      J = i.time.t;
    S(E.pos, L, b);
    S(E.look, L, m);
    b.x += Math.sin(J * 0.31) * 0.05;
    b.y += Math.sin(J * 0.43 + 1.7) * 0.035;
    b.z += Math.sin(J * 0.27 + 0.6) * 0.05;
    m.y += Math.sin(J * 0.19) * 0.12;
    m.x += Math.sin(J * 0.13 + 2) * 0.2;
    Z.position.copy(b);
    Z.lookAt(m);
    Z.rotation.z += Math.sin(J * 0.21) * 0.006;
    if (!i.params.fov && Math.abs(Z.fov - GAME.titleFov) > 0.01) {
      Z.fov = GAME.titleFov;
      Z.updateProjectionMatrix();
    }
    e.fade = Math.max(1 - smoothstep(0, 1.8, E.t), smoothstep(V - 1.6, V, E.t));
  }
  function saveResult(
    outcome: RunResult["outcome"],
    rating: string | null = null,
  ) {
    if (!runId || i.showcase || i.bench || i.params.shot) {
      return;
    }
    const stats = i.combat.stats;
    void i.userData
      .recordResult({
        id: runId,
        outcome,
        duration: c.time,
        shots: stats.shots,
        hits: stats.hits,
        kills: stats.kills,
        retries: c.retries,
        relays: c.cut,
        totalRelays: c.relays.length,
        rating,
      })
      .catch((error: unknown) =>
        console.warn("[user-data] 战绩保存失败", error),
      );
  }
  function H() {
    runId = createLocalId();
    a(i.enemies, "clear");
    a(i.fx, "clear");
    a(i.combat, "reset");
    a(i.weapon, "reset");
    c.time = 0;
    c.cut = 0;
    c.allCut = false;
    c.queue.length = 0;
    c.waveHot = 0;
    c.alertT = 0;
    c.pursuitT = 0;
    c.pursuitLeft = 0;
    c.contactSaid = false;
    c.lowSaid = false;
    c.extractHint = 0;
    c.used.clear();
    c.relays = A().map((P, V) => {
      let Y = (/([a-z0-9])$/i.exec(String(P.id || "")) || [
        0,
        String.fromCharCode(65 + V),
      ])[1].toUpperCase();
      O(P, "live");
      return {
        o: P,
        id: P.id || "relay_" + V,
        short: Y,
        t: 0,
        cut: false,
        cutting: false,
      };
    });
    n.reset(s.playerStart);
    if (o.reset) {
      o.reset();
    }
    e.saturation = t;
    e.flash = 0;
    q();
    if (o.setRelays) {
      o.setRelays(0, c.relays.length);
    }
    ie();
  }
  function O(P: any, V: string) {
    try {
      let Y = P && P.object && P.object.userData;
      if (Y && typeof Y.setState == "function") {
        Y.setState(V);
      }
    } catch (Y: any) {
      console.error("[game] relay setState threw", Y);
    }
  }
  function q() {
    if (!o.setMarkers) {
      return;
    }
    let P = c.relays
      .filter((V) => !V.cut)
      .map((V) => ({
        id: V.id,
        short: V.short,
        label: V.o.label || "中继 " + V.short,
        pos: V.o.pos,
        kind: "relay",
      }));
    if (c.allCut && s.extraction) {
      P.push({
        id: "extract",
        short: "撤离",
        label: "撤离艇",
        pos: s.extraction.pos,
        kind: "extract",
      });
    }
    o.setMarkers(P);
  }
  function U({
    skipIntro: P = false,
    quick: V = false,
    keepRetries: Y = false,
  }: { skipIntro?: boolean; quick?: boolean; keepRetries?: boolean } = {}) {
    if (!Y) {
      c.retries = 0;
    }
    l.show("none");
    l.locationCard(false);
    a(i.audio, "setPaused", false);
    H();
    a(i.weapon, "setVisible", true);
    g = false;
    if (P) {
      e.fade = 0;
      T();
      return;
    }
    h = V ? GAME.retryIntroSeconds : GAME.introSeconds;
    f = V;
    p = V;
    n.enabled = false;
    if (r.setGameplay) {
      r.setGameplay(false);
    }
    o.show(false);
    e.fade = 1;
    a(i.audio, "setIntensity", 0.15);
    M("intro");
  }
  function T() {
    n.enabled = true;
    o.show(true);
    if (r.setGameplay) {
      r.setGameplay(true);
    }
    o.setObjective(D());
    M("playing");
    C(true);
  }
  function D() {
    if (c.allCut) {
      return "前往撤离艇";
    }
    let P = c.relays.length - c.cut;
    return c.cut === 0
      ? "切断三处上行中继"
      : P === 1
        ? "切断最后一处中继"
        : `切断剩余 ${P} 处中继`;
  }
  function C(P: boolean) {
    let V = r.describeMode ? r.describeMode() : "";
    l.setLookMode(V);
    if (!(!P && V === x)) {
      x = V;
      if (
        _.state === "playing" &&
        (r.mode === "drag" ||
          (r.mode === "lock" &&
            !r.locked &&
            !i.params.shot &&
            !i.params.autostart))
      ) {
        o.message(V, r.mode === "drag" ? 7 : 4);
      } else if (_.state === "playing" && r.locked) {
        o.message("", 0);
      }
    }
  }
  if (r.onModeChange) {
    r.onModeChange(() => C(false));
  }
  i.events.on("input:lock", (P) => {
    if (P.locked) {
      g = true;
      C(false);
      return;
    }
    if (_.state === "playing" && g) {
      G();
    }
    g = false;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && _.state === "playing") {
      G();
    }
  });
  addEventListener("keydown", (P) => {
    if (!(
      _.state !== "title" ||
      l.panelOpen ||
      (P.code !== "Enter" && P.code !== "NumpadEnter") ||
      (P.target && (P.target as Element).tagName === "BUTTON")
    )) {
      a(i.audio, "resume");
      r.requestLock();
      U({});
    }
  });
  function G() {
    if (_.state === "playing") {
      if (r.setGameplay) {
        r.setGameplay(false);
      }
      r.exitLock();
      a(i.audio, "setPaused", true);
      l.setLookMode(
        r.mode === "drag"
          ? r.describeMode()
          : r.touch
            ? ""
            : "继续游戏后将重新捕获鼠标。",
      );
      o.show(false);
      l.show("paused");
      d = 0.35;
      M("paused");
    }
  }
  function j(P: boolean) {
    if (_.state === "paused") {
      l.show("none");
      a(i.audio, "setPaused", false);
      o.show(true);
      if (r.setGameplay) {
        r.setGameplay(true);
      }
      g = false;
      r.requestLock();
      M("playing");
      setTimeout(() => C(true), 700);
    }
  }
  function N(P: string) {
    let V = P === "gull" ? "air" : "ground",
      Y = (s && s.enemySpawns) || [],
      L = Y.filter((Z) => Z.type === V);
    return L.length ? L : Y;
  }
  function Q(
    P: string,
    {
      minDist: V = GAME.spawnFar,
      from: Y = n.pos,
      preferHidden: L = true,
    }: { minDist?: number; from?: Vector3; preferHidden?: boolean } = {},
  ) {
    let Z = N(P),
      J: { pos: Vector3; zone: string; type: string } | null = null,
      oe = -1e9;
    for (let le of Z) {
      let R = Math.hypot(le.pos.x - Y.x, le.pos.z - Y.z),
        I = i.rng() * 1.5;
      I += R >= V ? 2 + Math.min(1, (R - V) / 30) * 0.5 : -(V - R) / 4;
      if (L) {
        b.copy(le.pos);
        b.y += P === "gull" ? 0 : 1;
        let ae = true;
        try {
          ae = i.physics.lineOfSight(b, n.eye);
        } catch {}
        if (!ae) {
          I += 2.5;
        }
      }
      let se = c.used.get(le);
      if (se !== undefined && c.time - se < 6) {
        I -= 3;
      }
      if (I > oe) {
        oe = I;
        J = le;
      }
    }
    let fe = new Vector3();
    if (J) {
      c.used.set(J, c.time);
      fe.copy(J.pos);
      let le = (i.rng() - 0.5) * 2.4,
        R = (i.rng() - 0.5) * 2.4,
        I = P === "gull";
      try {
        if (!I) {
          I = i.physics.nav.isWalkable(fe.x + le, fe.z + R);
        }
      } catch {
        I = false;
      }
      if (I) {
        fe.x += le;
        fe.z += R;
      }
    } else {
      let le = i.rng() * Math.PI * 2;
      fe.set(
        clamp(Y.x + Math.cos(le) * 26, -34, 26),
        0,
        clamp(Y.z + Math.sin(le) * 26, -26, 24),
      );
    }
    if (P === "gull" && fe.y < 2.5) {
      fe.y = 6 + i.rng() * 3;
    }
    return fe;
  }
  function K(
    P: string,
    V: Vector3,
    Y: { state: string } | { state: string; target: Vector3 },
  ) {
    let L: any = null;
    try {
      L = i.enemies.spawn(P, V, Y);
    } catch (Z: any) {
      console.error("[game] enemies.spawn threw", Z);
    }
    return L;
  }
  function ie() {
    let P = (s.playerStart && s.playerStart.pos) || n.pos;
    for (let V of ["gull", "hound"])
      for (let Y = 0; Y < GAME.patrol[V]; Y++)
        K(
          V,
          Q(V, {
            minDist: 32,
            from: P,
            preferHidden: true,
          }),
          {
            state: "patrol",
          },
        );
  }
  function F(P: number) {
    let V = GAME.waves[Math.min(P, GAME.waves.length - 1)],
      Y: string[] = [];
    for (let oe = 0; oe < V.gull; oe++) Y.push("gull");
    for (let oe = 0; oe < V.hound; oe++)
      Y.splice(Math.min(Y.length, 1 + oe * 2), 0, "hound");
    let L = 0,
      Z = 0;
    Y.forEach((oe, fe) => {
      let le = Q(oe);
      L += le.x - n.pos.x;
      Z += le.z - n.pos.z;
      c.queue.push({
        type: oe,
        pos: le,
        at: c.time + 1.6 + fe * GAME.spawnStagger,
      });
    });
    c.waveHot = 30;
    let J = ((Math.atan2(L, -Z) * 180) / Math.PI + 360) % 360;
    if (o.warn) {
      o.warn("发现敌情 · " + ALERT_DIRECTIONS[Math.round(J / 45) % 8], 3.4);
    }
  }
  function X(P: number) {
    let V = ne();
    for (let Y = 0; Y < c.queue.length; Y++) {
      let L = c.queue[Y];
      if (c.time < L.at) {
        continue;
      }
      if (V >= GAME.maxAlive) {
        L.at = c.time + 1;
        continue;
      }
      if (
        !K(L.type, L.pos, {
          state: "alert",
          target: n.pos,
        }) &&
        !i.enemies.stub &&
        (L.tries = (L.tries || 0) + 1) < 6
      ) {
        L.at = c.time + 1.5;
        continue;
      }
      c.queue.splice(Y, 1);
      a(i.enemies, "alert", n.pos, 60);
      break;
    }
    if (c.allCut) {
      c.pursuitT -= P;
      if (
        c.pursuitT <= 0 &&
        c.pursuitLeft > 0 &&
        !c.queue.length &&
        V < GAME.pursuitMinAlive
      ) {
        c.pursuitT = GAME.pursuitEvery;
        c.pursuitLeft--;
        let Y = i.rng() < 0.6 ? "gull" : "hound";
        c.queue.push({
          type: Y,
          pos: Q(Y),
          at: c.time + 0.5,
        });
      }
      if (c.pursuitT <= 0) {
        c.pursuitT = 4;
        a(i.enemies, "alert", n.pos, 90);
      }
    }
  }
  function ne() {
    try {
      return i.enemies.aliveCount
        ? i.enemies.aliveCount()
        : i.enemies.list.filter((P) => P.alive).length;
    } catch {
      return 0;
    }
  }
  function re(P: number) {
    let V = (i.enemies && i.enemies.list) || [];
    for (let Y = 0; Y < V.length; Y++) {
      let L = V[Y];
      if (
        L &&
        L.alive &&
        L.pos &&
        Math.hypot(L.pos.x - n.pos.x, L.pos.z - n.pos.z) < P
      ) {
        return true;
      }
    }
    return false;
  }
  i.events.on("enemy:alert", () => {
    c.alertT = 10;
    if (_.state === "playing" && !c.contactSaid) {
      c.contactSaid = true;
      if (o.radio) {
        o.radio(RADIO_LINES.contact, 3.2);
      }
    }
  });
  i.events.on("player:hit", () => {
    c.alertT = Math.max(c.alertT, 8);
  });
  i.events.on("player:rescued", () => {
    if (_.state === "playing") {
      o.message("已从水中获救", 2.5);
    }
  });
  function $() {
    let P: any = null,
      V = GAME.interactRange;
    for (let Y of c.relays) {
      if (Y.cut) {
        continue;
      }
      let L = Y.o.pos.x - n.pos.x,
        Z = Y.o.pos.z - n.pos.z,
        J = Math.hypot(L, Z);
      if (!(
        J > V ||
        Math.abs((Y.o.pos.y || 0) - n.pos.y) > 2.5 ||
        (J > 0.9 &&
          (L * n.forward.x + Z * n.forward.z) /
            (J * Math.max(0.2, Math.hypot(n.forward.x, n.forward.z))) <
            GAME.interactFacing)
      )) {
        P = Y;
        V = J;
      }
    }
    return P;
  }
  function ue(P: number) {
    let V = n.alive ? $() : null;
    for (let L of c.relays) {
      if (!L.cut) {
        if (L === V && r.down("interact")) {
          if (!L.cutting) {
            L.cutting = true;
            O(L.o, "cutting");
          }
          L.t += P / GAME.cutSeconds;
          i.events.emit("objective:progress", {
            id: L.id,
            t: Math.min(1, L.t),
          });
          if (L.t >= 1) {
            me(L);
          }
        } else if (L.t > 0) {
          L.t = Math.max(0, L.t - P * 1.6);
          if (L.cutting) {
            L.cutting = false;
            O(L.o, "live");
            i.events.emit("objective:progress", {
              id: L.id,
              t: 0,
            });
          }
        }
      }
    }
    if (V && !V.cut) {
      if (o.setPrompt) {
        o.setPrompt("切断中继 " + V.short, saturate(V.t));
      }
    } else if (o.setPrompt) {
      o.setPrompt(null);
    }
    let Y = s.extraction;
    if (Y && Y.pos) {
      let L = Math.hypot(Y.pos.x - n.pos.x, Y.pos.z - n.pos.z),
        Z = L < (Y.radius || 2.5) && Math.abs(Y.pos.y - n.pos.y) < 3.5;
      if (Z && c.allCut && n.alive) {
        ee();
      } else if (Z && !c.allCut && c.extractHint <= 0) {
        c.extractHint = 8;
        o.message("中继尚未断开，撤离艇无法在火力下接应", 3.5);
      }
      c.extractHint = Math.max(0, c.extractHint - P);
    }
  }
  function me(P: any) {
    P.cut = true;
    P.cutting = false;
    P.t = 1;
    c.cut++;
    O(P.o, "cut");
    let V = c.relays.length;
    i.events.emit("objective:done", {
      id: P.id,
      index: c.cut,
      total: V,
    });
    if (o.setRelays) {
      o.setRelays(c.cut, V);
    }
    if (o.setPrompt) {
      o.setPrompt(null);
    }
    n.addShake(0.18);
    F(c.cut - 1);
    if (c.cut >= V) {
      c.allCut = true;
      c.pursuitLeft = GAME.pursuitExtra;
      c.pursuitT = 12;
      i.events.emit("objective:all", {});
      if (o.radio) {
        o.radio(RADIO_LINES.all, 4.5);
      }
    } else if (o.radio) {
      o.radio(
        RADIO_LINES.cut[Math.min(c.cut - 1, RADIO_LINES.cut.length - 1)],
        3.6,
      );
    }
    o.setObjective(D());
    q();
  }
  i.events.on("player:dead", () => {
    if (!(_.state !== "playing" && _.state !== "paused")) {
      if (r.setGameplay) {
        r.setGameplay(false);
      }
      r.exitLock();
      if (o.setPrompt) {
        o.setPrompt(null);
      }
      o.show(false);
      if (o.clearRadio) {
        o.clearRadio();
      }
      l.setDead({
        time: c.time,
        relays: c.cut,
        total: c.relays.length,
      });
      saveResult("death");
      M("dead");
    }
  });
  function ee() {
    n.invulnerable = true;
    n.enabled = false;
    if (r.setGameplay) {
      r.setGameplay(false);
    }
    r.exitLock();
    if (o.setPrompt) {
      o.setPrompt(null);
    }
    o.show(false);
    i.events.emit("extraction:reached", {});
    if (o.clearRadio) {
      o.clearRadio();
    }
    if (o.radio) {
      o.radio(RADIO_LINES.done, 2.2);
    }
    let P = (i.combat && i.combat.stats) || {
        shots: 0,
        hits: 0,
        kills: 0,
      },
      V = P.shots > 0 ? clamp(P.hits / P.shots, 0, 1) : null,
      Y =
        (c.time < 270 ? 2 : c.time < 400 ? 1 : 0) +
        (V! >= 0.5 ? 2 : V! >= 0.3 ? 1 : 0) +
        (c.retries === 0 ? 1 : 0),
      L = [
        "险象环生",
        "火力全开",
        "稳扎稳打",
        "干净利落",
        "精准果断",
        "完美突击",
      ][Y];
    l.setDebrief({
      time: c.time,
      accuracy: V,
      kills: P.kills || 0,
      retries: c.retries,
      rating: L,
    });
    saveResult("victory", L);
    M("complete");
  }
  function B(P: number) {
    switch (((u += P), _.state)) {
      case "title":
        z(P);
        return false;
      case "intro":
        e.fade = 1 - smoothstep(0.25, Math.min(h, 2.6), u);
        if (!f && u > 0.5) {
          f = true;
          l.locationCard(true);
        }
        if (!p && u > 1.3) {
          p = true;
          if (o.radio) {
            o.radio(RADIO_LINES.intro, 4.2);
          }
        }
        if (u > h - 0.6 && !o.root?.classList.contains("on")) {
          o.show(true);
          o.setObjective(D());
        }
        if (u >= h) {
          l.locationCard(false);
          e.fade = 0;
          T();
        }
        return true;
      case "playing": {
        c.time += P;
        e.fade = damp(e.fade || 0, 0, 6, P);
        if (d > 0) {
          d -= P;
        }
        if (r.pressed("pause")) {
          G();
          return false;
        }
        ue(P);
        if (_.state !== "playing") {
          return true;
        }
        X(P);
        c.alertT = Math.max(0, c.alertT - P);
        c.waveHot = Math.max(0, c.waveHot - P);
        let V = ne();
        if (c.waveHot > 0 && V === 0 && !c.queue.length && c.waveHot < 24) {
          c.waveHot = 0;
        }
        let Y =
          c.allCut || c.queue.length || (c.waveHot > 0 && V > 0)
            ? 1
            : c.alertT > 0 || (V > 0 && re(26))
              ? 0.6
              : 0.15;
        if (Y !== c.intensity) {
          c.intensity = Y;
          a(i.audio, "setIntensity", Y);
        }
        if (
          r.mode === "lock" &&
          !r.locked &&
          !r.touch &&
          !i.params.shot &&
          !i.params.autostart
        ) {
          y -= P;
          if (y <= 0) {
            y = 2;
            o.message(r.describeMode(), 2.6);
          }
        } else {
          y = 0.8;
        }
        if (!c.lowSaid && n.alive && n.health < 30) {
          c.lowSaid = true;
          if (o.radio) {
            o.radio(RADIO_LINES.low, 3);
          }
        }
        return true;
      }
      case "paused":
        if (d > 0) {
          d -= P;
        } else if (r.pressed("pause")) {
          if (!l.closePanel()) {
            j(false);
          }
        }
        return false;
      case "dead":
        e.saturation = damp(e.saturation ?? 1, 0.12, 2.2, P);
        e.fade = damp(e.fade || 0, 0.55, 1.4, P);
        if (u > 1.5 && l.screen !== "dead") {
          l.show("dead");
          a(i.audio, "setIntensity", 0.15);
        }
        return true;
      case "complete":
        e.fade = damp(e.fade || 0, 0.72, 0.9, P);
        e.saturation = damp(e.saturation ?? 1, t * 0.7, 1, P);
        if (u > 3.3 && l.screen !== "complete") {
          l.show("complete");
          a(i.audio, "setIntensity", 0.15);
        }
        return true;
    }
    return false;
  }
  w();
  n.enabled = false;
  o.show(false);
  a(i.weapon, "setVisible", false);
  if (r.setGameplay) {
    r.setGameplay(false);
  }
  a(i.audio, "setIntensity", 0.15);
  if (!(i.params.shot || i.params.autostart)) {
    l.show("title");
  }
  return _;
}
