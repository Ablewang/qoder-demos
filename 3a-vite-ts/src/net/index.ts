// LAN multiplayer client (new feature, not in the original): room membership and pose sync.
import type { GameContext } from "../types/context";
import {
  PROTOCOL_VERSION,
  WS_PATH,
  normalizeRoomCode,
} from "../../server/protocol";
import type {
  ClientMessage,
  PeerInfo,
  PeerMode,
  PeerState,
  RoomPhase,
  ServerMessage,
} from "../../server/protocol";
import { createAvatars } from "./avatars";

export type NetStatus = "offline" | "connecting" | "online";

export interface NetPeer extends PeerInfo {
  self: boolean;
  host: boolean;
}

export interface NetMission {
  by: string;
  startsAt: number;
}

const SEND_HZ = 15;
const PING_MS = 2000;
const CONNECT_TIMEOUT_MS = 5000;

export function serverUrl(params: Record<string, string>): string | null {
  const custom = params.server?.trim();
  if (custom) {
    const base = /^wss?:\/\//i.test(custom) ? custom : `ws://${custom}`;
    try {
      const url = new URL(base);
      if (url.pathname === "/" || url.pathname === "") {
        url.pathname = WS_PATH;
      }
      return url.href;
    } catch {
      return null;
    }
  }
  if (location.protocol !== "http:" && location.protocol !== "https:") {
    return null;
  }
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${WS_PATH}`;
}

export function createNet(i: GameContext) {
  const listeners = new Set<() => void>();
  const peers = new Map<string, NetPeer>();
  const avatars = createAvatars(i);
  let ws: WebSocket | null = null;
  let status: NetStatus = "offline";
  let room: string | null = null;
  let selfId: string | null = null;
  let error: string | null = null;
  let latency: number | null = null;
  let host: string | null = null;
  let phase: RoomPhase = "lobby";
  let mission: NetMission | null = null;
  let firedSinceSend = false;
  let sentName = "";
  let sendAcc = 0;
  let lastPing = 0;

  i.events.on("weapon:fire", () => {
    firedSinceSend = true;
  });

  function nameOf(id: string) {
    return peers.get(id)?.name ?? "队员";
  }

  function announce(text: string) {
    const state = i.game?.state;
    if (state === "playing" || state === "intro") {
      i.hud.message(text, 3);
    }
  }

  function setHost(id: string) {
    host = id;
    for (const peer of peers.values()) {
      peer.host = peer.id === id;
      avatars.label(peer.id, peer.name, peer.host);
    }
  }

  function launch() {
    mission = null;
    const game = i.game;
    if (!game) {
      return;
    }
    try {
      i.audio.resume();
    } catch {}
    // A remote start has no user gesture, so pointer lock waits for the player's first click.
    game.start({});
  }

  function notify() {
    for (const listener of listeners) listener();
  }

  function send(message: ClientMessage) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function reset(nextError: string | null) {
    status = "offline";
    room = null;
    selfId = null;
    latency = null;
    host = null;
    phase = "lobby";
    mission = null;
    error = nextError;
    peers.clear();
    avatars.clear();
    notify();
  }

  function onMessage(message: ServerMessage) {
    switch (message.t) {
      case "welcome":
        status = "online";
        room = message.room;
        selfId = message.id;
        host = message.host;
        phase = message.phase;
        error = null;
        peers.clear();
        for (const peer of message.peers) {
          peers.set(peer.id, {
            ...peer,
            self: peer.id === message.id,
            host: peer.id === message.host,
          });
        }
        break;
      case "peer-joined":
        peers.set(message.peer.id, {
          ...message.peer,
          self: false,
          host: false,
        });
        announce(`${message.peer.name} 加入了房间`);
        break;
      case "peer-left":
        announce(
          `${nameOf(message.id)} ${message.kicked ? "被房主移出房间" : "离开了房间"}`,
        );
        peers.delete(message.id);
        avatars.remove(message.id);
        break;
      case "peer-renamed": {
        const peer = peers.get(message.id);
        if (peer) {
          peer.name = message.name;
          avatars.label(message.id, message.name, peer.host);
        }
        break;
      }
      case "peer-ready": {
        const peer = peers.get(message.id);
        if (peer) {
          peer.ready = message.ready;
        }
        break;
      }
      case "host-changed":
        setHost(message.id);
        announce(
          message.id === selfId
            ? "你已成为房主"
            : `${nameOf(message.id)} 成为房主`,
        );
        break;
      case "mission":
        phase = "mission";
        for (const peer of peers.values()) peer.ready = false;
        mission = {
          by: message.by,
          startsAt: performance.now() + Math.max(0, message.delay),
        };
        break;
      case "phase":
        phase = message.phase;
        break;
      case "kicked":
        disconnect("你已被房主移出房间");
        return;
      case "snapshot":
        for (const state of message.peers) {
          const peer = peers.get(state.id);
          if (peer && !peer.self) {
            avatars.push(peer, peer.host, state);
          }
        }
        return;
      case "pong":
        latency = Math.max(0, Math.round(performance.now() - message.at));
        break;
      case "left":
        return;
      case "error":
        error = message.message;
        if (status === "connecting") {
          disconnect(message.message);
          return;
        }
        break;
    }
    notify();
  }

  function connect(first: ClientMessage) {
    if (ws) {
      return;
    }
    const url = serverUrl(i.params);
    if (!url) {
      reset(
        "无法确定联机服务地址：请通过 http 访问页面，或使用 ?server=主机:端口",
      );
      return;
    }
    status = "connecting";
    error = null;
    notify();
    const socket = new WebSocket(url);
    ws = socket;
    const timeout = setTimeout(() => {
      if (ws === socket && socket.readyState !== WebSocket.OPEN) {
        disconnect(
          "连接联机服务超时，请确认已运行 pnpm server 且处于同一局域网",
        );
      }
    }, CONNECT_TIMEOUT_MS);
    socket.addEventListener("open", () => {
      clearTimeout(timeout);
      sentName = i.userData.profile.name;
      send(first);
    });
    socket.addEventListener("message", (event) => {
      if (ws !== socket || typeof event.data !== "string") {
        return;
      }
      try {
        onMessage(JSON.parse(event.data) as ServerMessage);
      } catch (err) {
        console.warn("[net] 无法解析服务器消息", err);
      }
    });
    socket.addEventListener("close", () => {
      clearTimeout(timeout);
      if (ws !== socket) {
        return;
      }
      ws = null;
      const wasOnline = status === "online";
      reset(
        error ??
          (wasOnline
            ? "与联机服务的连接已断开"
            : "无法连接联机服务，请确认已运行 pnpm server 且处于同一局域网"),
      );
    });
  }

  function disconnect(nextError: string | null = null) {
    const socket = ws;
    ws = null;
    if (socket) {
      socket.close(1000);
    }
    reset(nextError);
  }

  function localState(): PeerState {
    const p = i.player;
    const state = i.game.state;
    let mode: PeerMode = "idle";
    if (state === "playing" || state === "paused") {
      mode = p.alive ? "field" : "down";
    } else if (state === "dead") {
      mode = "down";
    }
    return {
      x: p.pos.x,
      y: p.pos.y,
      z: p.pos.z,
      yaw: p.yaw,
      pitch: p.pitch,
      crouch: p.crouching,
      fire: firedSinceSend,
      mode,
    };
  }

  i.userData.subscribe(() => {
    const name = i.userData.profile.name;
    if (status === "online" && name !== sentName) {
      sentName = name;
      send({ t: "rename", name });
      const self = selfId ? peers.get(selfId) : null;
      if (self) {
        self.name = name;
        notify();
      }
    }
  });

  return {
    get status() {
      return status;
    },
    get room() {
      return room;
    },
    get selfId() {
      return selfId;
    },
    get error() {
      return error;
    },
    get latency() {
      return latency;
    },
    get peers(): NetPeer[] {
      return [...peers.values()].sort((a, b) => a.slot - b.slot);
    },
    get hostId() {
      return host;
    },
    get isHost() {
      return status === "online" && host !== null && host === selfId;
    },
    get phase() {
      return phase;
    },
    get mission() {
      return mission;
    },
    get ready() {
      return (selfId && peers.get(selfId)?.ready) || false;
    },
    get waiting() {
      return [...peers.values()].filter((p) => !p.host && !p.ready).length;
    },
    setReady(ready: boolean) {
      send({ t: "ready", ready });
    },
    startMission() {
      send({ t: "start" });
    },
    kick(id: string) {
      send({ t: "kick", id });
    },
    transferHost(id: string) {
      send({ t: "host", id });
    },
    createRoom() {
      connect({
        t: "create",
        v: PROTOCOL_VERSION,
        name: i.userData.profile.name,
      });
    },
    joinRoom(code: string) {
      const normalized = normalizeRoomCode(code);
      if (!normalized) {
        error = "房间号为 4 位字母或数字";
        notify();
        return;
      }
      connect({
        t: "join",
        v: PROTOCOL_VERSION,
        room: normalized,
        name: i.userData.profile.name,
      });
    },
    leave() {
      disconnect(null);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(dt: number) {
      avatars.update(dt);
      if (status !== "online") {
        return;
      }
      if (mission && performance.now() >= mission.startsAt) {
        launch();
        notify();
      }
      sendAcc += dt;
      if (sendAcc >= 1 / SEND_HZ) {
        sendAcc %= 1 / SEND_HZ;
        send({ t: "state", s: localState() });
        firedSinceSend = false;
      }
      const now = performance.now();
      if (now - lastPing >= PING_MS) {
        lastPing = now;
        send({ t: "ping", at: now });
      }
    },
  };
}
