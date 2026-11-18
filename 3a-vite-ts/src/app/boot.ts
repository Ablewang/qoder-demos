// Boot sequence: builds every subsystem in order, then runs the main loop.
import * as THREE from "three";
import type { GameContext, ShowcaseInfo, SubsystemKey } from "../types/context";
import { PlaneGeometry, Vector3 } from "three";
import { detectQuality } from "../config/quality";
import { createEventBus } from "../utils/events";
import { createRng } from "../utils/rng";
import { MODULE_STUBS } from "./stubs";
import { makeMesh } from "../utils/geometry";
import { createRender } from "../render";
import { createMaterials } from "../materials";
import { createPhysics } from "../physics";
import { createProps } from "../props/registry";
import "../props/infrastructure";
import "../props/catalog";
import { createLevel } from "../level";
import { createBackdrop } from "../backdrop";
import { createGround } from "../ground";
import { createFx } from "../fx";
import { createAudio } from "../audio";
import { createInput } from "../input";
import { createPlayer } from "../player";
import { createCombat } from "../combat";
import { createWeapon } from "../weapon";
import { createEnemies } from "../enemies";
import { createHud } from "../hud";
import { createGame } from "../game";
import {
  SHOWCASES,
  createShowcaseInput,
  createShowcasePlayer,
} from "./showcase";
import { showFatal } from "./diagnostics";
import { createBench } from "./bench";
import { createUserData } from "../data/user-data";
import { createNet } from "../net";

const bootEl = document.getElementById("boot");
const bootMsgEl = document.getElementById("boot-msg");
const bootFillEl = document.getElementById("boot-fill");
const nextTick = () => new Promise((i) => setTimeout(i, 0));
async function bootStep(i: string, e: number) {
  if (bootMsgEl) {
    bootMsgEl.textContent = i;
  }
  if (bootFillEl) {
    bootFillEl.style.width = Math.round(e * 100) + "%";
  }
  await nextTick();
}
export async function boot() {
  let i = Object.fromEntries(new URLSearchParams(location.search)),
    e = !!i.bench || location.hash === "#bench";
  if (e) {
    i.noaudio = "1";
    i.autostart = "1";
  }
  await bootStep("正在读取本地玩家档案", 0.01);
  const userData = await createUserData();
  let t = {
    THREE,
    userData,
    params: i,
    events: createEventBus(),
    rng: createRng(+(i.seed || 4207)),
    time: {
      t: 0,
      dt: 0,
      frame: 0,
      real: 0,
    },
    quality: detectQuality(i.q || (i.shot ? "test" : "")),
  } as GameContext;
  window.__G = t;
  let n = i.show && SHOWCASES[i.show] ? i.show : null;
  t.showcase = n;
  let s: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  function o(h: Record<string, string>) {
    if (h.cam) {
      let f = String(h.cam).split(",").map(Number);
      s = {
        pos: new Vector3(f[0], f[1], f[2]),
        look: new Vector3(f[3] ?? 0, f[4] ?? 1, f[5] ?? 0),
      };
    }
    if (h.cam === "") {
      s = null;
    }
    if (h.fov) {
      t.camera.fov = +h.fov;
      t.camera.updateProjectionMatrix();
    }
    if (h.exposure) {
      t.render.exposure = +h.exposure;
    }
  }
  window.__setShot = o;
  async function r(h: SubsystemKey, f: string, p: () => unknown, d = false) {
    let v = performance.now();
    try {
      (t as unknown as Record<string, unknown>)[h] = await p();
    } catch (x: any) {
      console.error(`[boot] module "${h}" failed: ${(x && x.stack) || x}`);
      if (d || !MODULE_STUBS[h as keyof typeof MODULE_STUBS]) {
        throw x;
      }
      (t as unknown as Record<string, unknown>)[h] =
        MODULE_STUBS[h as keyof typeof MODULE_STUBS]();
    }
    let g = performance.now() - v;
    if (g > 150) {
      console.log(`[boot] ${h} ${g.toFixed(0)}ms`);
    }
  }
  await bootStep("正在启动渲染器", 0.04);
  await r("render", "render", () => createRender(t), true);
  t.renderer = t.render.renderer;
  t.scene = t.render.scene;
  t.camera = t.render.camera;
  t.viewCamera = t.render.viewCamera;
  await bootStep("正在生成涂装、锈迹与雨水", 0.12);
  await r("mats", "materials", () => createMaterials(t));
  t.physics = createPhysics(t);
  t.props = createProps(t);
  t.input = n
    ? (createShowcaseInput() as unknown as GameContext["input"])
    : createInput(t);
  if (n) {
    let h = makeMesh(
      new PlaneGeometry(80, 80).rotateX(-Math.PI / 2),
      t.mats.get("concrete"),
      {
        cast: false,
      },
    );
    t.scene.add(h);
    t.level = {
      stub: true,
      playerStart: {
        pos: new Vector3(0, 0, 4),
        yaw: 0,
      },
      objectives: [],
      enemySpawns: [],
      zones: [],
      interiorBoxes: [],
      cinematicPath: [],
      extraction: {
        pos: new Vector3(),
        radius: 2,
      },
      groundSurfaceAt: () => "concrete",
      update() {},
    } as unknown as GameContext["level"];
    t.backdrop = MODULE_STUBS.backdrop() as unknown as GameContext["backdrop"];
    t.ground = MODULE_STUBS.ground() as unknown as GameContext["ground"];
    t.physics.build();
    if (n === "fx") {
      await r("fx", "fx", () => createFx(t));
    } else {
      try {
        t.fx = await createFx(t);
      } catch {
        t.fx = MODULE_STUBS.fx() as unknown as GameContext["fx"];
      }
    }
    t.audio = MODULE_STUBS.audio() as unknown as GameContext["audio"];
    t.hud = MODULE_STUBS.hud() as unknown as GameContext["hud"];
    t.player = createShowcasePlayer(t) as unknown as GameContext["player"];
    t.combat = createCombat(t);
    t.weapon = MODULE_STUBS.weapon() as unknown as GameContext["weapon"];
    t.enemies = MODULE_STUBS.enemies() as unknown as GameContext["enemies"];
    t.game = {
      state: "showcase",
      update: () => false,
      start() {},
    } as unknown as GameContext["game"];
    let f: ShowcaseInfo | null | undefined = null;
    try {
      f = await SHOWCASES[n as keyof typeof SHOWCASES].showcase(t);
    } catch (p: any) {
      showFatal(`showcase "${n}" threw: ${(p && p.stack) || p}`);
    }
    t.showcaseInfo = f || {};
    if (f && f.cam) {
      o({
        cam: [...f.cam, ...(f.target || [0, 1, 0])].join(","),
      });
    }
  } else {
    await bootStep("正在布置集装箱", 0.34);
    await r("level", "level", () => createLevel(t), true);
    await bootStep("正在架设起重机", 0.5);
    await r("backdrop", "backdrop", () => createBackdrop(t));
    await bootStep("正在生成港区地面", 0.58);
    await r("ground", "ground", () => createGround(t));
    if (t.ground.stub) {
      let h = makeMesh(
        new PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
        t.mats.get("asphalt"),
        {
          cast: false,
        },
      );
      t.scene.add(h);
    }
    t.physics.build();
    await bootStep("正在加载弹道与烟雾", 0.66);
    await r("fx", "fx", () => createFx(t));
    await r("audio", "audio", () =>
      i.noaudio ? MODULE_STUBS.audio() : createAudio(t),
    );
    t.player = createPlayer(t);
    t.combat = createCombat(t);
    await bootStep("正在检查几猫制式步枪", 0.74);
    await r("weapon", "weapon", () => createWeapon(t));
    await bootStep("正在启动港区主控", 0.82);
    await r("enemies", "enemies", () => createEnemies(t));
    await r("hud", "hud", () => createHud(t));
    if (!e && !i.shot) {
      t.net = createNet(t);
    }
    t.game = createGame(t);
  }
  await bootStep("正在准备首帧画面", 0.92);
  try {
    await t.render.onLevelReady();
  } catch (h: any) {
    console.error(
      "[boot] render.onLevelReady failed: " + ((h && h.stack) || h),
    );
  }
  let a = 0;
  window.__stats = () => ({
    ...(t.render.stats ? t.render.stats() : {}),
    fps: a ? +(1 / a).toFixed(1) : 0,
    state: t.game && t.game.state,
  });
  if (i.cam) {
    o(i);
  }
  if (i.fov) {
    o({
      fov: i.fov,
    });
  }
  if (!n && (i.shot || i.autostart)) {
    try {
      t.game.start({
        skipIntro: true,
      });
    } catch (h: any) {
      console.error("[boot] game.start failed", h);
    }
  }
  if (i.noweapon && t.weapon.setVisible) {
    t.weapon.setVisible(false);
  }
  if (e) {
    createBench(t);
  }
  await bootStep("准备就绪", 1);
  bootEl!.classList.add("done");
  setTimeout(() => {
    bootEl!.hidden = true;
  }, 700);
  let l = performance.now(),
    c = 1,
    u = ((h: string, f: number) => {
      let p = (
        t as unknown as Record<
          string,
          { update?: (dt: number) => void } | undefined
        >
      )[h];
      if (p && p.update) {
        try {
          p.update(f);
        } catch (d: any) {
          if (!u.err[h]) {
            u.err[h] = 1;
            console.error(`[loop] ${h}.update threw: ${(d && d.stack) || d}`);
          }
        }
      }
    }) as { (h: string, f: number): void; err: Record<string, number> };
  u.err = {};
  t.renderer.setAnimationLoop(() => {
    let h = performance.now(),
      f = (h - l) / 1e3;
    l = h;
    a = a ? a * 0.95 + f * 0.05 : f;
    let p = Math.min(f, 0.05);
    if (i.dt) {
      p = +i.dt;
    }
    t.time.dt = p;
    t.time.t += p;
    t.time.real = h / 1e3;
    t.time.frame++;
    u("input", p);
    let d = false;
    try {
      d =
        t.game.update(p) !== false &&
        t.game.state !== "title" &&
        t.game.state !== "paused";
    } catch (v: any) {
      if (!u.err.game) {
        u.err.game = 1;
        console.error("[loop] game.update threw: " + ((v && v.stack) || v));
      }
    }
    if (n) {
      if (t.showcaseInfo.update) {
        try {
          t.showcaseInfo.update(p);
        } catch (v: any) {
          if (!u.err.sc) {
            u.err.sc = 1;
            console.error(
              "[loop] showcase update threw: " + ((v && v.stack) || v),
            );
          }
        }
      }
    } else {
      if (d) {
        u("player", p);
        u("weapon", p);
        u("enemies", p);
      }
    }
    if (
      t.weapon &&
      t.weapon.setWetness &&
      t.level &&
      t.level.interiorBoxes &&
      t.level.interiorBoxes[0]
    ) {
      let v = t.level.interiorBoxes[0],
        g = t.camera.position,
        x =
          g.x > v.min.x &&
          g.x < v.max.x &&
          g.z > v.min.z &&
          g.z < v.max.z &&
          g.y < v.max.y;
      c += ((x ? 0.3 : 1) - c) * Math.min(1, p * (x ? 0.25 : 0.6));
      try {
        t.weapon.setWetness(c);
      } catch {}
    }
    if (t.game.state !== "paused") {
      u("fx", p);
      u("ground", p);
      u("level", p);
      u("backdrop", p);
      u("mats", p);
    }
    u("audio", p);
    u("hud", p);
    u("net", p);
    if (s) {
      t.camera.position.copy(s.pos);
      t.camera.lookAt(s.look);
    }
    if (t.bench) {
      t.bench.frame(f);
    }
    try {
      t.render.frame(p);
    } catch (v: any) {
      if (!u.err.render) {
        u.err.render = 1;
        console.error("[loop] render.frame threw: " + ((v && v.stack) || v));
      }
    }
    if (t.input.endFrame) {
      t.input.endFrame();
    }
    window.__frames++;
    if (window.__frames === 2) {
      window.__ready = true;
    }
  });
}
