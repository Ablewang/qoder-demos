// LAN lobby pane, title/pause room strip, squad countdown and in-game room badge (new feature, not in the original).
import type { GameContext, NetSystem } from "../types/context";
import type { NetPeer } from "./index";
import { MAX_ROOM_PLAYERS, ROOM_CODE_LENGTH } from "../../server/protocol";
import { SLOT_COLORS } from "./avatars";

const STATUS_TEXT = {
  offline: "未连接",
  connecting: "正在连接联机服务…",
  online: "已进入房间",
} as const;
const CONFIRM_MS = 3000;

export const LAN_PANE_HTML = `
      <div class="panel-b" data-pane="lan" hidden>
        <h3>局域网联机 · 新增功能</h3>
        <p class="panel-note">原版为单人行动；联机为新增功能。同一局域网最多 ${MAX_ROOM_PLAYERS} 人进入同一房间，由房主统一发起行动，可看到队友的动作、朝向、开火、蹲伏与倒地。敌人、射击判定与任务进度仍在各自设备独立运行。</p>
        <p class="lan-status" data-lan="status" role="status" aria-live="polite"></p>
        <p class="user-form-error" data-lan="error" role="alert"></p>
        <div class="lan-lobby" data-lan="lobby">
          <button class="btn small primary" type="button" data-act="lan-create">创建房间（成为房主）</button>
          <form class="user-profile-form lan-join" id="lan-join-form" novalidate>
            <label for="lan-code">加入房间（输入 ${ROOM_CODE_LENGTH} 位房间号）</label>
            <input id="lan-code" name="room" type="text" maxlength="${ROOM_CODE_LENGTH}" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go">
            <button class="btn small" type="submit">加入</button>
          </form>
        </div>
        <div class="lan-room" data-lan="room" hidden>
          <dl class="user-identity lan-meta">
            <div><dt>房间号</dt><dd class="lan-code" data-lan="code"></dd></div>
            <div><dt>状态</dt><dd data-lan="phase"></dd></div>
            <div><dt>延迟</dt><dd data-lan="ping"></dd></div>
          </dl>
          <h3 data-lan="members-title">房间成员</h3>
          <ol class="lan-peers" data-lan="peers"></ol>
          <p class="panel-note" data-lan="hint"></p>
          <div class="lan-actions">
            <button class="btn small primary" type="button" data-lan="main"></button>
            <button class="btn small" type="button" data-act="lan-leave">离开房间</button>
          </div>
        </div>
        <h3>如何开局</h3>
        <p class="panel-note">在一台电脑上执行 <code>pnpm lan</code>（构建并启动服务），其他设备用浏览器打开终端打印的“局域网”地址。一人创建房间成为房主，其他人输入房间号加入并点“准备”；全员准备后房主点“全员出击”，全队倒计时后同时开始任务。开发时可同时运行 <code>pnpm dev</code> 与 <code>pnpm dev:server</code>。</p>
      </div>`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Host gets "全员出击" (needs everyone ready); members toggle ready. */
function mainAction(net: NetSystem) {
  if (net.isHost) {
    const waiting = net.waiting;
    return {
      act: "lan-go",
      text: waiting ? `等待 ${waiting} 人准备` : "全员出击",
      disabled: waiting > 0 || !!net.mission,
    };
  }
  return {
    act: "lan-ready",
    text: net.ready ? "取消准备" : "准备",
    disabled: !!net.mission,
  };
}

export function bindLobby(i: GameContext, net: NetSystem, root: HTMLElement) {
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const part = (key: string) => q(`[data-lan="${key}"]`);
  const form = q<HTMLFormElement>("#lan-join-form");
  const codeInput = q<HTMLInputElement>("#lan-code");
  const ui = document.getElementById("ui")!;
  const badge = el("div", "net-badge");
  badge.setAttribute("aria-hidden", "true");
  const countdown = el("div", "net-countdown");
  countdown.setAttribute("role", "status");
  countdown.setAttribute("aria-live", "assertive");
  ui.append(badge, countdown);

  const strips = ["title", "paused"].map((screen) => {
    const strip = el("div", "lan-strip");
    strip.hidden = true;
    q(`[data-s="${screen}"] .m-actions`).after(strip);
    return strip;
  });

  const launchButtons = [
    ...root.querySelectorAll<HTMLButtonElement>(
      '[data-act="deploy"], [data-act="restart"], [data-act="retry"], [data-act="redeploy"]',
    ),
  ].map((button) => ({
    button,
    act: button.dataset.act!,
    text: button.textContent,
    disabled: button.disabled,
    primary: button.classList.contains("primary"),
  }));

  let confirm: { act: string; id: string; until: number } | null = null;
  let countdownFrame = 0;
  let countdownSecond = 0;

  function act(name: string | undefined, id = "") {
    if (name === "lan-create") {
      net.createRoom();
    } else if (name === "lan-leave") {
      net.leave();
    } else if (name === "lan-go") {
      net.startMission();
    } else if (name === "lan-ready") {
      net.setReady(!net.ready);
    } else if (name === "lan-kick" || name === "lan-host") {
      if (
        confirm?.act === name &&
        confirm.id === id &&
        performance.now() < confirm.until
      ) {
        confirm = null;
        if (name === "lan-kick") net.kick(id);
        else net.transferHost(id);
      } else {
        confirm = { act: name, id, until: performance.now() + CONFIRM_MS };
        setTimeout(render, CONFIRM_MS + 50);
      }
      render();
    }
  }

  const onClick = (event: Event) => {
    const target = (event.target as Element).closest<HTMLElement>("[data-act]");
    if (target && !(target as HTMLButtonElement).disabled) {
      act(target.dataset.act, target.dataset.id);
    }
  };
  root.addEventListener("click", onClick);
  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/\s+/g, "");
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    net.joinRoom(codeInput.value);
  });

  function setMain(button: HTMLButtonElement) {
    const main = mainAction(net);
    button.dataset.act = main.act;
    button.textContent = main.text;
    button.disabled = main.disabled;
    button.classList.toggle("primary", main.act === "lan-go" || !net.ready);
  }

  function peerRow(peer: NetPeer) {
    const li = el("li");
    const swatch = el("i");
    swatch.style.background = SLOT_COLORS[peer.slot % SLOT_COLORS.length];
    const who = el("div", "lan-who");
    who.append(el("b", "", peer.name));
    if (peer.host) who.append(el("em", "lan-tag host", "房主"));
    if (peer.self) who.append(el("span", "", "（你）"));
    li.append(swatch, who);
    if (!peer.host) {
      li.append(
        el(
          "em",
          `lan-tag ${peer.ready ? "ready" : "wait"}`,
          peer.ready ? "已准备" : "未准备",
        ),
      );
    }
    if (net.isHost && !peer.self) {
      const tools = el("div", "lan-tools");
      for (const [name, label, confirmLabel] of [
        ["lan-host", "设为房主", "确认移交"],
        ["lan-kick", "移出", "确认移出"],
      ] as const) {
        const pending =
          confirm?.act === name &&
          confirm.id === peer.id &&
          performance.now() < confirm.until;
        const button = el(
          "button",
          "btn small",
          pending ? confirmLabel : label,
        );
        button.type = "button";
        button.dataset.act = name;
        button.dataset.id = peer.id;
        button.classList.toggle("warn", pending);
        tools.append(button);
      }
      li.append(tools);
    }
    return li;
  }

  function renderStrip(strip: HTMLElement) {
    strip.hidden = net.status !== "online";
    if (strip.hidden) {
      return;
    }
    const peers = net.peers;
    const others = peers.filter((p) => !p.host);
    const info = el("div", "lan-strip-info");
    info.append(
      el("em", "", net.room ?? ""),
      el(
        "span",
        "",
        `${peers.length}/${MAX_ROOM_PLAYERS} 人${others.length ? ` · ${others.length - net.waiting}/${others.length} 已准备` : ""}`,
      ),
      el("span", "", net.isHost ? "你是房主" : "等待房主发起"),
    );
    const main = el("button", "btn small");
    main.type = "button";
    setMain(main);
    const manage = el("button", "btn small", "房间");
    manage.type = "button";
    manage.dataset.act = "lan";
    strip.replaceChildren(info, main, manage);
  }

  function renderBadge() {
    const state = i.game?.state;
    const show =
      net.status === "online" &&
      (state === "playing" ||
        state === "paused" ||
        state === "dead" ||
        state === "intro");
    badge.classList.toggle("on", show);
    if (show) {
      const room = el("em", "", net.room ?? "");
      const count = el("span", "", `${net.peers.length} 人`);
      badge.replaceChildren(
        el("b", "", net.isHost ? "房主" : "联机"),
        room,
        count,
      );
      if (net.latency != null) {
        badge.append(el("span", "net-ping", `${net.latency}ms`));
      }
    }
  }

  function tickCountdown() {
    const mission = net.mission;
    if (!mission) {
      countdown.classList.remove("on");
      countdownFrame = 0;
      countdownSecond = 0;
      return;
    }
    const left = Math.max(
      1,
      Math.ceil((mission.startsAt - performance.now()) / 1000),
    );
    if (left !== countdownSecond) {
      countdownSecond = left;
      const by = net.peers.find((p) => p.id === mission.by);
      const head = el(
        "small",
        "",
        `${by?.self ? "你" : (by?.name ?? "房主")} 发起全员行动`,
      );
      countdown.replaceChildren(head, el("b", "", String(left)));
      countdown.classList.add("on");
    }
    countdownFrame = requestAnimationFrame(tickCountdown);
  }

  function render() {
    const online = net.status === "online";
    part("status").textContent = STATUS_TEXT[net.status];
    part("error").textContent = net.error ?? "";
    part("lobby").hidden = online;
    part("room").hidden = !online;
    for (const button of part("lobby").querySelectorAll<HTMLButtonElement>(
      "button",
    )) {
      button.disabled = net.status === "connecting";
    }
    if (online) {
      part("code").textContent = net.room ?? "";
      part("phase").textContent =
        net.phase === "mission" ? "行动中" : "等待出击";
      part("ping").textContent =
        net.latency == null ? "测量中" : `${net.latency} ms`;
      part("members-title").textContent =
        `房间成员 ${net.peers.length}/${MAX_ROOM_PLAYERS}`;
      part("peers").replaceChildren(...net.peers.map(peerRow));
      part("hint").textContent = net.isHost
        ? "你是房主：队员全部准备后点“全员出击”，全队倒计时 3 秒后同时开始任务。可移交房主或移出队员。"
        : "点“准备”后等待房主发起行动；房主离开时，房主自动移交给下一位队员。";
      setMain(part("main") as HTMLButtonElement);
    }
    for (const { button, act, text, disabled, primary } of launchButtons) {
      if (online) {
        setMain(button);
        button.classList.toggle("primary", primary);
      } else {
        button.dataset.act = act;
        button.textContent = text;
        button.disabled = disabled;
        button.classList.toggle("primary", primary);
      }
    }
    for (const strip of strips) renderStrip(strip);
    renderBadge();
    if (net.mission && !countdownFrame) {
      tickCountdown();
    }
  }

  net.subscribe(render);
  i.events.on("game:state", renderBadge);
  render();
}
