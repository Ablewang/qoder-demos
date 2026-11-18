// Keyboard/mouse, pointer-lock, gamepad and touch controls.
import type { GameContext } from "../types/context";

const KEY_BINDINGS: Record<string, string> = {
  KeyW: "forward",
  KeyS: "back",
  KeyA: "left",
  KeyD: "right",
  Space: "jump",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
  KeyC: "crouch",
  ControlLeft: "crouch",
  ControlRight: "crouch",
  KeyR: "reload",
  KeyE: "interact",
  KeyF: "melee",
  KeyV: "melee",
  Escape: "pause",
  KeyP: "pause",
  KeyQ: "alt",
  Enter: "fire",
  NumpadEnter: "fire",
  ArrowLeft: "turnL",
  ArrowRight: "turnR",
  ArrowUp: "turnU",
  ArrowDown: "turnD",
  KeyJ: "turnL",
  KeyL: "turnR",
  KeyI: "turnU",
  KeyK: "turnD",
};
const MOUSE_LOOK_SENS = 0.0021;
const TOUCH_LOOK_SENS = 0.0052;
const KEY_TURN_RATE = 2.1;
const PAD_LOOK_RATE = 3;
const TOUCH_STICK_RADIUS = 58;
const ALWAYS_ACTIVE_ACTIONS: Record<string, number> = {
  pause: 1,
};
export function createInput(i: GameContext) {
  let e =
      (i.renderer && i.renderer.domElement) || document.getElementById("view"),
    t = document.getElementById("ui"),
    n = new Set<any>(),
    s = new Set<any>(),
    o: Record<string, any> = {
      key: new Set<any>(),
      mouse: new Set<any>(),
      touch: new Set<any>(),
      pad: new Set<any>(),
    },
    r = false,
    a = false,
    l = 0,
    c = 0,
    u = 0,
    h: ((mode: string) => void)[] = [],
    f = {
      move: {
        x: 0,
        y: 0,
      },
      look: {
        dx: 0,
        dy: 0,
      },
      fire: false,
      ads: false,
      sprint: false,
      crouch: false,
      locked: false,
      touch: false,
      gamepad: false,
      sensitivity: 1,
      invertY: false,
      mode: "lock",
      down(P: string) {
        return n.has(P) && (r || ALWAYS_ACTIVE_ACTIONS[P] === 1);
      },
      pressed(P: string) {
        return s.has(P) && (r || ALWAYS_ACTIVE_ACTIONS[P] === 1);
      },
      update: ee,
      endFrame: B,
      requestLock: A,
      exitLock: _,
      setGameplay(P: boolean) {
        P = !!P;
        if (P !== r) {
          r = P;
          if (!P) {
            v();
          }
          if (M) {
            M.root.classList.toggle("on", P && f.touch);
          }
        }
      },
      setPrompt(P: boolean) {
        if (M) {
          M.btn.interact!.classList.toggle("on", !!P);
        }
      },
      onModeChange(P: (mode: string) => void) {
        h.push(P);
      },
      describeMode() {
        return f.mode === "touch"
          ? "触屏操作已启用"
          : f.mode === "drag"
            ? "鼠标捕获不可用：移动鼠标调整视角，停在屏幕边缘持续转向；点击开火；方向键或 IJKL 也可转向"
            : f.locked
              ? "鼠标已捕获，按 Esc 释放"
              : "点击游戏画面以捕获鼠标";
      },
    };
  function p(P: string) {
    if (f.mode !== P) {
      f.mode = P;
      for (let V of h)
        try {
          V(P);
        } catch (Y: any) {
          console.error(Y);
        }
    }
  }
  function d(P: string, V: any, Y: boolean) {
    if (!V) {
      return;
    }
    let L = o[P];
    if (Y) {
      if (L.has(V)) {
        return;
      }
      L.add(V);
      if (!n.has(V)) {
        n.add(V);
        s.add(V);
      }
    } else {
      if (!L.delete(V)) {
        return;
      }
      if (
        !o.key.has(V) &&
        !o.mouse.has(V) &&
        !o.touch.has(V) &&
        !o.pad.has(V)
      ) {
        n.delete(V);
      }
    }
  }
  function v() {
    for (let P in o) o[P].clear();
    n.clear();
    u = 0;
    j = false;
    if (M) {
      M.btn.ads!.classList.remove("active");
      ie();
      q = -1;
      D = -1;
    }
  }
  addEventListener("keydown", (P) => {
    let V = KEY_BINDINGS[P.code];
    if (!V) {
      return;
    }
    let Y = P.target as HTMLElement | null;
    if (!(
      (Y &&
        (Y.tagName === "INPUT" ||
          Y.tagName === "SELECT" ||
          Y.tagName === "TEXTAREA")) ||
      (Y &&
        Y.tagName === "BUTTON" &&
        (P.code === "Space" || P.code === "Enter" || P.code === "NumpadEnter"))
    )) {
      if (
        r &&
        (P.code === "Space" ||
          P.code.startsWith("Arrow") ||
          P.code === "ControlLeft")
      ) {
        P.preventDefault();
      }
      if (!P.repeat) {
        d("key", V, true);
      }
    }
  });
  addEventListener("keyup", (P) => {
    d("key", KEY_BINDINGS[P.code], false);
  });
  addEventListener("blur", () => {
    v();
  });
  let g = (P: number) =>
    P === 0 ? "fire" : P === 2 ? "ads" : P === 1 ? "melee" : null;
  e.addEventListener("mousedown", (P) => {
    if (!(f.touch && performance.now() - E < 800) && r) {
      if (!f.locked && f.mode === "lock") {
        A();
        P.preventDefault();
        return;
      }
      u |= 1 << P.button;
      d("mouse", g(P.button), true);
      P.preventDefault();
    }
  });
  addEventListener("mouseup", (P) => {
    u &= ~(1 << P.button);
    d("mouse", g(P.button), false);
  });
  addEventListener("contextmenu", (P) => {
    if (P.target === e || r) {
      P.preventDefault();
    }
  });
  addEventListener("mousemove", (P) => {
    if (
      r &&
      (f.mode === "drag" &&
        ((x = P.clientX / Math.max(1, innerWidth)),
        (y = P.clientY / Math.max(1, innerHeight)),
        (b = true)),
      f.locked || f.mode === "drag")
    ) {
      let V = P.movementX || 0,
        Y = P.movementY || 0;
      if (Math.abs(V) > 400 || Math.abs(Y) > 400) {
        return;
      }
      f.look.dx += V * MOUSE_LOOK_SENS * f.sensitivity;
      f.look.dy += Y * MOUSE_LOOK_SENS * f.sensitivity * (f.invertY ? -1 : 1);
    }
  });
  document.addEventListener("pointerlockchange", () => {
    f.locked = document.pointerLockElement === e;
    if (f.locked) {
      a = true;
      l = 0;
      c = 0;
      if (!f.touch) {
        p("lock");
      }
    } else {
      o.mouse.clear();
      n.delete("fire");
      n.delete("ads");
      for (let P of o.key) n.add(P);
      u = 0;
    }
    i.events.emit("input:lock", {
      locked: f.locked,
    });
  });
  document.addEventListener("pointerlockerror", () => m());
  let x = 0.5,
    y = 0.5,
    b = false;
  document.addEventListener("mouseleave", () => {
    b = false;
  });
  function m() {
    l = 0;
    if (!(f.locked || f.touch)) {
      c++;
      if (!a) {
        p("drag");
      }
    }
  }
  function A() {
    if (!(f.touch || f.locked)) {
      if (!e.requestPointerLock) {
        m();
        return;
      }
      try {
        l = performance.now();
        let P = e.requestPointerLock();
        if (P && P.catch) {
          P.catch(() => m());
        }
      } catch {
        m();
      }
      try {
        e.focus({
          preventScroll: true,
        });
      } catch {}
    }
  }
  function _() {
    try {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    } catch {}
  }
  let M: any = null,
    E = 0,
    w = -1,
    S = 0,
    z = 0,
    H = 0,
    O = 0,
    q = -1,
    U = 0,
    T = 0,
    D = -1,
    C = 0,
    G = 0,
    j = false;
  function N() {
    let P = document.createElement("div");
    P.className = "touch";
    P.innerHTML =
      '<div class="t-stick"><i class="t-ring"></i><i class="t-nub"></i></div><button class="t-btn t-fire" data-a="fire" aria-label="开火"><span>开火</span></button><button class="t-btn t-ads" data-a="ads" aria-label="瞄准"><span>瞄准</span></button><button class="t-btn t-reload" data-a="reload" aria-label="换弹"><span>换弹</span></button><button class="t-btn t-jump" data-a="jump" aria-label="跳跃"><span>跳跃</span></button><button class="t-btn t-interact" data-a="interact" aria-label="Interact"><span>交互</span></button><button class="t-btn t-pause" data-a="pause" aria-label="暂停"><span>暂停</span></button>';
    t!.appendChild(P);
    let V = (L: string) => P.querySelector<HTMLElement>(L),
      Y = {
        root: P,
        stick: V(".t-stick"),
        nub: V(".t-nub"),
        btn: {
          fire: V(".t-fire"),
          ads: V(".t-ads"),
          reload: V(".t-reload"),
          jump: V(".t-jump"),
          interact: V(".t-interact"),
          pause: V(".t-pause"),
        } as Record<string, HTMLElement | null>,
      };
    for (let L in Y.btn) {
      let Z = Y.btn[L]!;
      Z.addEventListener(
        "touchstart",
        (oe: any) => {
          oe.preventDefault();
          oe.stopPropagation();
          E = performance.now();
          let fe = oe.changedTouches[0];
          if (L === "ads") {
            j = !j;
            Z.classList.toggle("active", j);
            return;
          }
          if (L === "fire") {
            D = fe.identifier;
            C = fe.clientX;
            G = fe.clientY;
          }
          Z.classList.add("active");
          d("touch", L, true);
        },
        {
          passive: false,
        },
      );
      let J = (oe: any) => {
        oe.preventDefault();
        oe.stopPropagation();
        if (L !== "ads") {
          if (L === "fire") {
            let fe = false;
            for (let le of oe.changedTouches) {
              if (le.identifier === D) {
                fe = true;
              }
            }
            if (!fe) {
              return;
            }
            D = -1;
          }
          Z.classList.remove("active");
          d("touch", L, false);
        }
      };
      Z.addEventListener("touchend", J, {
        passive: false,
      });
      Z.addEventListener("touchcancel", J, {
        passive: false,
      });
      Z.addEventListener(
        "touchmove",
        (oe: any) => {
          oe.preventDefault();
          if (L === "fire") {
            for (let fe of oe.changedTouches) {
              if (fe.identifier === D) {
                Q(fe.clientX - C, fe.clientY - G);
                C = fe.clientX;
                G = fe.clientY;
              }
            }
          }
        },
        {
          passive: false,
        },
      );
      Z.addEventListener("contextmenu", (oe: any) => oe.preventDefault());
    }
    return Y;
  }
  function Q(P: number, V: number) {
    f.look.dx += P * TOUCH_LOOK_SENS * f.sensitivity;
    f.look.dy += V * TOUCH_LOOK_SENS * f.sensitivity * (f.invertY ? -1 : 1);
  }
  function K() {
    if (!f.touch) {
      f.touch = true;
      _();
      if (!M) {
        M = N();
      }
      M.root.classList.toggle("on", r);
      document.documentElement.classList.add("is-touch");
      p("touch");
    }
  }
  function ie() {
    w = -1;
    H = O = 0;
    if (M) {
      M.stick!.classList.remove("on");
    }
  }
  addEventListener(
    "touchstart",
    () => {
      E = performance.now();
      K();
    },
    {
      passive: true,
      capture: true,
    },
  );
  e.addEventListener(
    "touchstart",
    (P) => {
      P.preventDefault();
      if (!!r) {
        for (let V of P.changedTouches) {
          if (V.clientX < innerWidth * 0.45 && w < 0) {
            w = V.identifier;
            S = V.clientX;
            z = V.clientY;
            H = O = 0;
            if (M) {
              M.stick!.style.transform = `translate3d(${S}px,${z}px,0)`;
              M.nub!.style.transform = "translate3d(0,0,0)";
              M.stick!.classList.add("on");
            }
          } else if (q < 0) {
            q = V.identifier;
            U = V.clientX;
            T = V.clientY;
          }
        }
      }
    },
    {
      passive: false,
    },
  );
  e.addEventListener(
    "touchmove",
    (P) => {
      P.preventDefault();
      if (!!r) {
        for (let V of P.changedTouches)
          if (V.identifier === w) {
            let Y = V.clientX - S,
              L = V.clientY - z,
              Z = Math.hypot(Y, L);
            if (Z > TOUCH_STICK_RADIUS) {
              Y *= TOUCH_STICK_RADIUS / Z;
              L *= TOUCH_STICK_RADIUS / Z;
            }
            H = Y / TOUCH_STICK_RADIUS;
            O = -L / TOUCH_STICK_RADIUS;
            if (M) {
              M.nub!.style.transform = `translate3d(${Y.toFixed(1)}px,${L.toFixed(1)}px,0)`;
            }
          } else {
            if (V.identifier === q) {
              Q(V.clientX - U, V.clientY - T);
              U = V.clientX;
              T = V.clientY;
            }
          }
      }
    },
    {
      passive: false,
    },
  );
  let F = (P: any) => {
    for (let V of P.changedTouches) {
      if (V.identifier === w) {
        ie();
      } else if (V.identifier === q) {
        q = -1;
      }
    }
  };
  e.addEventListener("touchend", F, {
    passive: false,
  });
  e.addEventListener("touchcancel", F, {
    passive: false,
  });
  let X: Record<string, string> = {
      0: "jump",
      1: "crouch",
      2: "reload",
      3: "interact",
      5: "melee",
      6: "ads",
      7: "fire",
      9: "pause",
      10: "sprint",
      11: "melee",
    },
    ne = typeof navigator < "u" && !!navigator.getGamepads,
    re = 0,
    $ = 0,
    ue = (P: number) => {
      let V = Math.abs(P);
      return V < 0.16 ? 0 : (Math.sign(P) * (V - 0.16)) / 0.84;
    };
  function me(P: number) {
    re = $ = 0;
    if (!ne) {
      return;
    }
    let V: (Gamepad | null)[] | undefined;
    try {
      V = navigator.getGamepads();
    } catch {
      ne = false;
      return;
    }
    let Y: Gamepad | null | null = null;
    for (let J = 0; V && J < V.length; J++)
      if (V[J] && V[J]!.connected && V[J]!.mapping === "standard") {
        Y = V[J];
        break;
      }
    if (!Y) {
      if (f.gamepad) {
        f.gamepad = false;
        o.pad.clear();
      }
      return;
    }
    f.gamepad = true;
    re = ue(Y.axes[0] || 0);
    $ = -ue(Y.axes[1] || 0);
    let L = ue(Y.axes[2] || 0),
      Z = ue(Y.axes[3] || 0);
    if (r) {
      f.look.dx += L * Math.abs(L) * PAD_LOOK_RATE * P * f.sensitivity;
      f.look.dy +=
        Z *
        Math.abs(Z) *
        PAD_LOOK_RATE *
        0.7 *
        P *
        f.sensitivity *
        (f.invertY ? -1 : 1);
    }
    for (let J in X) {
      let oe = Y.buttons[J as unknown as number];
      d("pad", X[J], !!oe && (oe.pressed || oe.value > 0.4));
    }
  }
  function ee(P: number) {
    me(P);
    if (l && performance.now() - l > 1200 && !f.locked) {
      m();
    }
    if (f.mode === "drag" && r && b && !f.locked) {
      let Z = x < 0.12 ? -(0.12 - x) / 0.12 : x > 0.88 ? (x - 0.88) / 0.12 : 0,
        J = y < 0.1 ? -(0.1 - y) / 0.1 : y > 0.9 ? (y - 0.9) / 0.1 : 0;
      f.look.dx += Z * 2.4 * P * f.sensitivity;
      f.look.dy += J * 1.2 * P * f.sensitivity * (f.invertY ? -1 : 1);
    }
    let V = 0,
      Y = 0,
      L = false;
    if (r) {
      V = (n.has("right") ? 1 : 0) - (n.has("left") ? 1 : 0);
      Y = (n.has("forward") ? 1 : 0) - (n.has("back") ? 1 : 0);
      L = n.has("sprint");
      if (w >= 0) {
        V += H;
        Y += O;
        if (Math.hypot(H, O) > 0.93 && O > 0.8) {
          L = true;
        }
      }
      V += re;
      Y += $;
      let Z = Math.hypot(V, Y);
      if (Z > 1) {
        V /= Z;
        Y /= Z;
      }
      let J = (n.has("turnR") ? 1 : 0) - (n.has("turnL") ? 1 : 0),
        oe = (n.has("turnD") ? 1 : 0) - (n.has("turnU") ? 1 : 0);
      if (J) {
        f.look.dx += J * KEY_TURN_RATE * P;
      }
      if (oe) {
        f.look.dy += oe * KEY_TURN_RATE * 0.6 * P;
      }
    }
    f.move.x = V;
    f.move.y = Y;
    f.fire = r && n.has("fire");
    f.ads = r && (n.has("ads") || j);
    f.sprint = r && L;
    f.crouch = r && n.has("crouch");
  }
  function B() {
    s.clear();
    f.look.dx = 0;
    f.look.dy = 0;
  }
  return f;
}
