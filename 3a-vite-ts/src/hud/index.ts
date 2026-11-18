// HUD: compass, ammo, health, objectives, radio and hit markers.
import type { GameContext } from "../types/context";
import { Vector3 } from "three";
import { createEl } from "../utils/dom";

const COMPASS_PX_PER_DEG = 4;
const COMPASS_TAPE_MIN_DEG = -90;
const COMPASS_TAPE_MAX_DEG = 450;
const COMPASS_LABELS: Record<string, string> = {
  0: "北",
  45: "东北",
  90: "东",
  135: "东南",
  180: "南",
  225: "西南",
  270: "西",
  315: "西北",
};
const HOLD_RING_CIRCUMFERENCE = 2 * Math.PI * 19;
export function createHud(i: GameContext) {
  let e = document.getElementById("ui"),
    t = createEl("div", "hud");
  t.setAttribute("aria-hidden", "true");
  let n = createEl("div", "h-compass"),
    s = createEl("div", "h-tape"),
    o = "";
  for (let k = COMPASS_TAPE_MIN_DEG; k <= COMPASS_TAPE_MAX_DEG; k += 5) {
    let ce = (k - COMPASS_TAPE_MIN_DEG) * COMPASS_PX_PER_DEG,
      ve = ((k % 360) + 360) % 360,
      _e = ve % 45 === 0,
      Te = ve % 15 === 0;
    o += `<i class="${_e ? "mj" : Te ? "md" : "mn"}" style="left:${ce}px"></i>`;
    if (_e) {
      o += `<b class="${ve % 90 === 0 ? "card" : "ic"}" style="left:${ce}px">${COMPASS_LABELS[ve]}</b>`;
    } else if (ve % 15 === 0) {
      o += `<b class="num" style="left:${ce}px">${String(ve).padStart(3, "0")}</b>`;
    }
  }
  s.innerHTML = o;
  let r = createEl("div", "h-tape-wrap");
  r.appendChild(s);
  let a = createEl("div", "h-cmarks"),
    l = createEl("div", "h-heading", "000");
  n.append(r, createEl("i", "h-needle"), a, l);
  let c = createEl(
      "div",
      "h-obj",
      '<div class="h-k">任务目标</div><div class="h-obj-t"></div><div class="h-relays"><span>中继</span><i></i><i></i><i></i><b>0/3</b></div>',
    ),
    u = c.querySelector(".h-obj-t"),
    h = c.querySelector(".h-relays"),
    f = h!.querySelector("b"),
    p = [...h!.querySelectorAll("i")],
    d = createEl("div", "h-warn"),
    v = createEl(
      "div",
      "h-cross",
      '<i class="c-t"></i><i class="c-b"></i><i class="c-l"></i><i class="c-r"></i><i class="c-dot"></i>',
    ),
    g = v.querySelectorAll("i"),
    x = createEl("div", "h-hit", "<i></i><i></i><i></i><i></i>"),
    y = createEl("div", "h-arcs"),
    b: {
      el: HTMLDivElement;
      life: number;
      src: Vector3;
      op: number;
      rot: number;
      max?: number;
    }[] = [];
  for (let k = 0; k < 4; k++) {
    let ce = createEl(
      "div",
      "h-arc",
      '<svg viewBox="-100 -100 200 200"><path d="M -38 -84 A 92 92 0 0 1 38 -84" /><path class="tip" d="M -7 -97 L 0 -106 L 7 -97" /></svg>',
    );
    y.appendChild(ce);
    b.push({
      el: ce,
      life: 0,
      src: new Vector3(),
      op: -1,
      rot: 1e9,
    });
  }
  let m = createEl(
      "div",
      "h-prompt",
      `<svg viewBox="-24 -24 48 48"><circle class="bg" r="19"/><circle class="fg" r="19" stroke-dasharray="${HOLD_RING_CIRCUMFERENCE.toFixed(2)}" stroke-dashoffset="${HOLD_RING_CIRCUMFERENCE.toFixed(2)}" transform="rotate(-90)"/></svg><span class="h-key">E</span><span class="h-plabel"></span>`,
    ),
    A = m.querySelector(".fg"),
    _ = m.querySelector(".h-key"),
    M = m.querySelector(".h-plabel"),
    E = createEl("div", "h-feed"),
    w = createEl("div", "h-msg"),
    S = createEl(
      "div",
      "h-health",
      '<div class="h-k">生命状态</div><div class="h-hp-row"><b class="h-hp-n">100</b><div class="h-hp-bar">' +
        "<i></i>".repeat(10) +
        "</div></div>",
    ),
    z = S.querySelector(".h-hp-n"),
    H = [...S.querySelectorAll(".h-hp-bar i")],
    O = createEl(
      "div",
      "h-ammo",
      '<div class="h-cue"></div><div class="h-ammo-row"><b class="h-ammo-n">30</b><span class="h-ammo-r">120</span></div><div class="h-pips"></div><div class="h-wname"></div>',
    ),
    q = O.querySelector(".h-ammo-n"),
    U = O.querySelector(".h-ammo-r"),
    T = O.querySelector(".h-pips"),
    D = O.querySelector(".h-wname"),
    C = O.querySelector(".h-cue"),
    G = createEl("div", "h-marks");
  t.append(G, n, c, d, y, v, x, m, E, w, S, O);
  e!.appendChild(t);
  let j = createEl(
    "div",
    "comms",
    '<span class="comms-who">指挥中心</span><span class="comms-t"></span>',
  );
  j.setAttribute("role", "status");
  j.setAttribute("aria-live", "polite");
  let N = j.querySelector(".comms-t");
  e!.appendChild(j);
  let Q = false,
    K = 420,
    ie = innerWidth,
    F = innerHeight,
    X = {
      ammo: -1,
      mag: -1,
      reserve: -1,
      name: null as string | null,
      cue: null as string | null,
      low: null as boolean | null,
      hp: -1,
      hpSeg: -1,
      hurt: null as boolean | null,
      head: -1,
      tapeX: 1e9,
      gap: -1,
      crossOn: null as boolean | null,
      promptOn: null as boolean | null,
      promptText: null as string | null,
      promptT: -1,
      promptKey: null as string | null,
      marksOn: null as boolean | null,
      done: -1,
      total: -1,
    },
    ne: Element[] = [],
    re = "",
    $ = 0,
    ue = 0,
    me: { text: string; secs: number }[] = [],
    ee: { text: string; secs: number } | undefined | null = null,
    B = 0,
    P = 0,
    V = 0,
    Y = 0,
    L = 0,
    Z: { el: HTMLDivElement; life: number; weak: boolean; out?: boolean }[] =
      [],
    J: any[] = [],
    oe = new Vector3(),
    fe: {
      el: HTMLDivElement;
      life: number;
      weak: boolean;
      out?: boolean;
    } | null = null,
    le = -1;
  function R() {
    ie = innerWidth;
    F = innerHeight;
    K = n.clientWidth || Math.min(420, ie * 0.6);
    X.tapeX = 1e9;
    X.gap = -1;
    for (let k of J) {
      k.lastC = 1e9;
      k.lastW = "";
    }
  }
  addEventListener("resize", R);
  i.events.on("player:hitEnemy", (k) => {
    I.hitmarker(
      k && k.killed
        ? "kill"
        : k && (k.weak || k.part === "weak")
          ? "weak"
          : "hit",
    );
    if (k && k.killed && k.weak && fe && le === i.time.frame && !fe.weak) {
      fe.weak = true;
      fe.el.innerHTML += "<em>弱点命中</em>";
    }
  });
  i.events.on("enemy:killed", (k) => {
    let ce =
      (
        {
          gull: "机械飞鸥",
          hound: "机械猎犬",
        } as Record<string, string>
      )[k && (k.type || (k.enemy && k.enemy.type))] || "机械守卫";
    fe = I.feed(`<b>${ce}</b> 已摧毁`);
    le = i.time.frame;
  });
  i.events.on("player:hit", (k) => {
    if (!k || !k.fromPos) {
      return;
    }
    let ce = b[0];
    for (let ve of b) {
      if (ve.life <= 0) {
        ce = ve;
        break;
      }
      if (ve.life < ce.life) {
        ce = ve;
      }
    }
    ce.src.copy(k.fromPos);
    ce.life = 1.5;
    ce.max = 1.5;
  });
  let I = {
    root: t,
    show(k: boolean) {
      k = !!k;
      if (k !== Q) {
        Q = k;
        t.classList.toggle("on", k);
        if (k) {
          R();
        }
      }
    },
    setObjective(k: string) {
      k = k || "";
      if (k !== re) {
        re = k;
        $ = 0;
        ue = 0;
        u!.textContent = "";
        c.classList.toggle("has", !!k);
        c.classList.remove("flash");
        c.offsetWidth;
        c.classList.add("flash");
      }
    },
    setRelays(k: number, ce: number) {
      if (!(k === X.done && ce === X.total)) {
        if (ce !== X.total) {
          p.forEach((ve) => ve.remove());
          p = [];
          for (let ve = 0; ve < ce; ve++) {
            let _e = document.createElement("i");
            h!.insertBefore(_e, f);
            p.push(_e);
          }
        }
        X.done = k;
        X.total = ce;
        p.forEach((ve, _e) => ve.classList.toggle("cut", _e < k));
        f!.textContent = `${k}/${ce}`;
        h!.classList.toggle("all", k >= ce && ce > 0);
      }
    },
    setMarkers(k: any) {
      for (let ce of J) {
        ce.cEl.remove();
        ce.wEl.remove();
      }
      J = (k || []).map((ce: any) => {
        let ve = createEl(
            "div",
            "h-cm " + (ce.kind || "relay"),
            `<i></i><b>${ce.short || ""}</b><span></span>`,
          ),
          _e = createEl(
            "div",
            "h-wm " + (ce.kind || "relay"),
            `<i></i><b>${ce.short || ""}</b><span></span>`,
          );
        a.appendChild(ve);
        G.appendChild(_e);
        return {
          ...ce,
          cEl: ve,
          wEl: _e,
          cDist: ve.querySelector("span"),
          wDist: _e.querySelector("span"),
          lastD: -1,
          lastC: 1e9,
          lastW: "",
          vis: null,
        };
      });
    },
    setPrompt(k: string | null, ce = 0) {
      let ve = !!k;
      if (ve !== X.promptOn) {
        X.promptOn = ve;
        m.classList.toggle("on", ve);
        if (i.input.setPrompt) {
          i.input.setPrompt(ve);
        }
      }
      if (!ve) {
        return;
      }
      let _e = i.input.touch
        ? "交互"
        : i.input.gamepad && !i.input.locked
          ? "Y"
          : "E";
      if (_e !== X.promptKey) {
        X.promptKey = _e;
        _!.textContent = _e;
        _!.classList.toggle("wide", _e.length > 1);
      }
      let Te = `按住 ${_e} · ${k}`;
      if (Te !== X.promptText) {
        X.promptText = Te;
        M!.textContent = Te;
      }
      let Pe = Math.round(ce * 200) / 200;
      if (Pe !== X.promptT) {
        X.promptT = Pe;
        A!.setAttribute(
          "stroke-dashoffset",
          (HOLD_RING_CIRCUMFERENCE * (1 - Pe)).toFixed(2),
        );
        m.classList.toggle("busy", Pe > 0);
      }
    },
    radio(k: string, ce = 4.5) {
      if (k) {
        me.push({
          text: k,
          secs: ce,
        });
      }
    },
    clearRadio() {
      me.length = 0;
      ee = null;
      j.classList.remove("on");
    },
    warn(k: string, ce = 3) {
      d.textContent = k;
      Y = ce;
      d.classList.remove("on");
      d.offsetWidth;
      d.classList.add("on");
    },
    message(k: string, ce = 3) {
      w.textContent = k || "";
      L = k ? ce : 0;
      w.classList.toggle("on", !!k);
    },
    feed(k: string) {
      let ce = createEl("div", "h-fl", k);
      E.appendChild(ce);
      let ve = {
        el: ce,
        life: 4.2,
        weak: false,
      };
      for (Z.push(ve); Z.length > 4;) Z.shift()!.el.remove();
      return ve;
    },
    hitmarker(k = "hit") {
      x.className = "h-hit " + k;
      let ce = k === "weak" || k === "kill" ? 1.5 : 1.15;
      try {
        x.animate(
          [
            {
              opacity: 1,
              transform: `translate(-50%,-50%) scale(${ce})`,
            },
            {
              opacity: 1,
              transform: "translate(-50%,-50%) scale(1)",
              offset: 0.35,
            },
            {
              opacity: 0,
              transform: "translate(-50%,-50%) scale(0.92)",
            },
          ],
          {
            duration: k === "kill" ? 420 : 240,
            easing: "ease-out",
          },
        );
      } catch {}
    },
    reset() {
      me.length = 0;
      ee = null;
      j.classList.remove("on");
      for (let k of Z) k.el.remove();
      Z.length = 0;
      for (let k of b) k.life = 0;
      Y = 0;
      d.classList.remove("on");
      I.message("");
      I.setPrompt(null);
      I.setObjective("");
      X.hp = -1;
    },
    update: se,
  };
  function se(k: number) {
    ae(k);
    if (!Q) {
      return;
    }
    let ce = i.player,
      ve = i.weapon || {},
      _e = i.camera,
      Te = ce.ads || 0,
      Pe = ((-ce.yaw * 180) / Math.PI) % 360;
    if (Pe < 0) {
      Pe += 360;
    }
    let Re =
      Math.round(
        (K / 2 - (Pe - COMPASS_TAPE_MIN_DEG) * COMPASS_PX_PER_DEG) * 2,
      ) / 2;
    if (Re !== X.tapeX) {
      X.tapeX = Re;
      s.style.transform = `translate3d(${Re}px,0,0)`;
    }
    let Fe = Math.round(Pe) % 360;
    if (Fe !== X.head) {
      X.head = Fe;
      l.textContent = String(Fe).padStart(3, "0");
    }
    let ze = Te < 0.5;
    if (ze !== X.marksOn) {
      X.marksOn = ze;
      G.classList.toggle("off", !ze);
    }
    if (J.length) {
      _e.updateMatrixWorld();
      _e.matrixWorldInverse.copy(_e.matrixWorld).invert();
      let we = K / 2 - 14;
      for (let be of J) {
        let Oe = be.pos.x - ce.pos.x,
          pt = be.pos.z - ce.pos.z,
          ut = Math.round(Math.hypot(Oe, pt));
        if (ut !== be.lastD) {
          be.lastD = ut;
          let Un = ut + "米";
          be.cDist.textContent = Un;
          be.wDist.textContent = Un;
        }
        let nn = (Math.atan2(Oe, -pt) * 180) / Math.PI - Pe;
        nn = ((nn + 540) % 360) - 180;
        let bt = Math.round(
          Math.max(-we, Math.min(we, nn * COMPASS_PX_PER_DEG)),
        );
        if (bt !== be.lastC) {
          be.lastC = bt;
          be.cEl.style.transform = `translate3d(${bt}px,0,0)`;
          be.cEl.classList.toggle("edge", Math.abs(bt) >= we);
        }
        oe.set(
          be.pos.x,
          be.pos.y + (be.kind === "extract" ? 1.2 : 1.9),
          be.pos.z,
        ).project(_e);
        let Os: number | undefined,
          pn: number | undefined,
          Ti = false;
        if (oe.z > 1) {
          Ti = true;
          oe.x = -oe.x;
          oe.y = -oe.y;
        }
        if (Ti || Math.abs(oe.x) > 0.9 || Math.abs(oe.y) > 0.82) {
          Ti = true;
          let Un = Math.max(Math.abs(oe.x) / 0.9, Math.abs(oe.y) / 0.82, 0.001);
          oe.x /= Un;
          oe.y /= Un;
          if (oe.z > 1) {
            let zo = Math.max(Math.abs(oe.x) / 0.9, Math.abs(oe.y) / 0.82);
            if (zo < 0.999) {
              oe.x /= zo;
              oe.y /= zo;
            }
          }
        }
        Os = Math.round((oe.x * 0.5 + 0.5) * ie);
        pn = Math.round((-oe.y * 0.5 + 0.5) * F);
        let ho = !Ti && Math.hypot(oe.x, oe.y * 0.6) < 0.16,
          Rs =
            Os +
            "," +
            pn +
            (Ti ? "o" : "") +
            (ut < 3 ? "n" : "") +
            (ho ? "d" : "");
        if (Rs !== be.lastW) {
          be.lastW = Rs;
          be.wEl.style.transform = `translate3d(${Os}px,${pn}px,0)`;
          be.wEl.classList.toggle("offscreen", Ti);
          be.wEl.classList.toggle("near", ut < 3);
          be.wEl.classList.toggle("dim", ho);
        }
      }
    }
    let We = Te <= 0.6 && ce.alive && ve.state !== "reloading_hidden";
    if (We !== X.crossOn) {
      X.crossOn = We;
      v.classList.toggle("off", !We);
    }
    if (We) {
      let we = typeof ve.spread == "number" ? ve.spread : 0.012,
        be = (_e.fov * Math.PI) / 360,
        Oe =
          (Math.tan(we) / Math.tan(be)) * (F / 2) + 4 + (ce.sprinting ? 10 : 0);
      Oe = Math.round(Math.max(4, Math.min(70, Oe)) * 2) / 2;
      if (Oe !== X.gap) {
        X.gap = Oe;
        g[0].style.transform = `translate3d(-50%,${-Oe}px,0) translateY(-100%)`;
        g[1].style.transform = `translate3d(-50%,${Oe}px,0)`;
        g[2].style.transform = `translate3d(${-Oe}px,-50%,0) translateX(-100%)`;
        g[3].style.transform = `translate3d(${Oe}px,-50%,0)`;
      }
    }
    let Ne = Math.max(1, Math.min(60, ve.magSize | 0 || 30)),
      dt = Math.max(0, ve.ammo | 0),
      xe = Math.max(0, ve.reserve | 0);
    if (Ne !== X.mag) {
      X.mag = Ne;
      T!.innerHTML = "<i></i>".repeat(Ne);
      ne = [...T!.children];
      X.ammo = -1;
    }
    if (dt !== X.ammo) {
      X.ammo = dt;
      q!.textContent = String(dt).padStart(2, "0");
      for (let we = 0; we < ne.length; we++)
        ne[we].className = we < dt ? "" : "off";
    }
    if (xe !== X.reserve) {
      X.reserve = xe;
      U!.textContent = String(xe).padStart(3, "0");
    }
    if (ve.name !== X.name) {
      X.name = ve.name;
      D!.textContent = ve.name || "";
    }
    let Ie = dt <= Math.ceil(Ne * 0.27),
      Be =
        ve.state === "reloading"
          ? "换弹中"
          : dt === 0
            ? xe > 0
              ? i.input.touch
                ? "换弹"
                : "R · 换弹"
              : "弹药耗尽"
            : Ie
              ? "弹药不足"
              : "";
    if (Be !== X.cue) {
      X.cue = Be;
      C!.textContent = Be;
      C!.className =
        "h-cue" +
        (Be ? " on" : "") +
        (dt === 0 && ve.state !== "reloading" ? " urgent" : "");
    }
    if (Ie !== X.low) {
      X.low = Ie;
      O.classList.toggle("low", Ie);
    }
    let Xe = Math.max(0, Math.ceil(ce.health)),
      Me = ce.health < ce.maxHealth - 0.5;
    if (Xe !== X.hp) {
      X.hp = Xe;
      z!.textContent = String(Xe);
      let we = Math.ceil((Xe / ce.maxHealth) * H.length);
      if (we !== X.hpSeg) {
        X.hpSeg = we;
        for (let be = 0; be < H.length; be++)
          H[be].className = be < we ? "" : "off";
        S.classList.toggle("crit", we <= 3);
      }
    }
    if (Me !== X.hurt) {
      X.hurt = Me;
      S.classList.toggle("on", Me);
    }
    for (let we of b) {
      if (we.life <= 0) {
        if (we.op !== 0) {
          we.op = 0;
          we.el.style.opacity = "0";
        }
        continue;
      }
      we.life -= k;
      let be = Math.atan2(we.src.x - ce.pos.x, -(we.src.z - ce.pos.z)) + ce.yaw,
        Oe = Math.round((be * 180) / Math.PI);
      if (Oe !== we.rot) {
        we.rot = Oe;
        we.el.style.transform = `translate(-50%,-50%) rotate(${Oe}deg)`;
      }
      let pt = Math.round(Math.min(1, Math.max(0, we.life / 0.6)) * 20) / 20;
      if (pt !== we.op) {
        we.op = pt;
        we.el.style.opacity = String(pt);
      }
    }
    if ($ < re.length) {
      ue += k * 46;
      let we = Math.min(re.length, Math.floor(ue));
      if (we !== $) {
        $ = we;
        u!.textContent = re.slice(0, we);
      }
    }
    if (Y > 0) {
      Y -= k;
      if (Y <= 0) {
        d.classList.remove("on");
      }
    }
    if (L > 0) {
      L -= k;
      if (L <= 0) {
        w.classList.remove("on");
      }
    }
    for (let we = Z.length - 1; we >= 0; we--) {
      let be = Z[we];
      be.life -= k;
      if (be.life <= 0) {
        be.el.remove();
        Z.splice(we, 1);
      } else if (be.life < 0.6 && !be.out) {
        be.out = true;
        be.el.classList.add("out");
      }
    }
  }
  function ae(k: number) {
    if (!ee) {
      if (!me.length) {
        return;
      }
      ee = me.shift();
      B = 0;
      P = 0;
      V = ee!.secs;
      N!.textContent = "";
      j.classList.add("on");
      i.events.emit("radio:line", {
        text: ee!.text,
      });
    }
    let ce = ee!.text;
    if (B < ce.length) {
      P += k * 58;
      let ve = Math.min(ce.length, Math.floor(P));
      if (ve !== B) {
        B = ve;
        N!.textContent = ce.slice(0, ve);
      }
    } else {
      V -= k;
      if (V <= 0) {
        ee = null;
        if (!me.length) {
          j.classList.remove("on");
        }
      }
    }
  }
  R();
  return I;
}
