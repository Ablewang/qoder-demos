// Room registry: membership, input sanitising and per-room snapshot broadcast.
import { randomInt, randomUUID } from "node:crypto";
import {
  MAX_ROOM_PLAYERS,
  MISSION_COUNTDOWN_MS,
  PROTOCOL_VERSION,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  normalizeName,
  normalizeRoomCode,
} from "./protocol.ts";
import type {
  ClientMessage,
  ErrorCode,
  PeerInfo,
  PeerMode,
  PeerState,
  RoomPhase,
  ServerMessage,
} from "./protocol.ts";

const MAX_ROOMS = 64;
const WORLD_LIMIT = 1000;
const PITCH_LIMIT = 1.5;
const MODES: readonly PeerMode[] = ["idle", "field", "down"];
// Covers the countdown plus the original 3.5 s intro, during which clients still report "idle".
const MISSION_SETTLE_MS = MISSION_COUNTDOWN_MS + 7000;

export interface Connection {
  send(message: ServerMessage): void;
}

interface Member {
  info: PeerInfo;
  conn: Connection;
  state: PeerState;
}

interface Room {
  code: string;
  host: string;
  phase: RoomPhase;
  startedAt: number;
  members: Map<string, Member>;
}

export interface RoomStats {
  rooms: number;
  players: number;
}

function finite(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : null;
}

export function sanitizeState(value: unknown): PeerState | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const s = value as Record<string, unknown>;
  const x = finite(s.x, -WORLD_LIMIT, WORLD_LIMIT);
  const y = finite(s.y, -WORLD_LIMIT, WORLD_LIMIT);
  const z = finite(s.z, -WORLD_LIMIT, WORLD_LIMIT);
  const yaw = finite(s.yaw, -1e6, 1e6);
  const pitch = finite(s.pitch, -PITCH_LIMIT, PITCH_LIMIT);
  if (
    x === null ||
    y === null ||
    z === null ||
    yaw === null ||
    pitch === null
  ) {
    return null;
  }
  if (
    typeof s.crouch !== "boolean" ||
    typeof s.fire !== "boolean" ||
    !MODES.includes(s.mode as PeerMode)
  ) {
    return null;
  }
  return {
    x,
    y,
    z,
    yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)),
    pitch,
    crouch: s.crouch,
    fire: s.fire,
    mode: s.mode as PeerMode,
  };
}

export function createRoomRegistry() {
  const rooms = new Map<string, Room>();
  const memberships = new Map<Connection, { room: Room; id: string }>();

  function fail(conn: Connection, code: ErrorCode, message: string) {
    conn.send({ t: "error", code, message });
  }

  function broadcast(room: Room, message: ServerMessage, except?: string) {
    for (const member of room.members.values()) {
      if (member.info.id !== except) {
        member.conn.send(message);
      }
    }
  }

  function newCode(): string | null {
    for (let attempt = 0; attempt < 64; attempt++) {
      let code = "";
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      }
      if (!rooms.has(code)) {
        return code;
      }
    }
    return null;
  }

  function enter(conn: Connection, room: Room, name: string) {
    const used = new Set([...room.members.values()].map((m) => m.info.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    const info: PeerInfo = { id: randomUUID(), name, slot, ready: false };
    if (!room.members.size) {
      room.host = info.id;
    }
    room.members.set(info.id, {
      info,
      conn,
      state: {
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        pitch: 0,
        crouch: false,
        fire: false,
        mode: "idle",
      },
    });
    memberships.set(conn, { room, id: info.id });
    conn.send({
      t: "welcome",
      v: PROTOCOL_VERSION,
      id: info.id,
      room: room.code,
      host: room.host,
      phase: room.phase,
      peers: [...room.members.values()].map((m) => m.info),
    });
    broadcast(room, { t: "peer-joined", peer: info }, info.id);
  }

  function leave(conn: Connection, kicked = false) {
    const membership = memberships.get(conn);
    if (!membership) {
      return false;
    }
    memberships.delete(conn);
    const { room, id } = membership;
    room.members.delete(id);
    if (room.members.size === 0) {
      rooms.delete(room.code);
      return true;
    }
    broadcast(room, { t: "peer-left", id, kicked });
    if (room.host === id) {
      const next = [...room.members.values()].sort(
        (a, b) => a.info.slot - b.info.slot,
      )[0];
      setHost(room, next);
    }
    return true;
  }

  function setHost(room: Room, member: Member) {
    room.host = member.info.id;
    if (member.info.ready) {
      member.info.ready = false;
      broadcast(room, { t: "peer-ready", id: member.info.id, ready: false });
    }
    broadcast(room, { t: "host-changed", id: member.info.id });
  }

  function hostTarget(
    conn: Connection,
    membership: { room: Room; id: string } | undefined,
    target: unknown,
  ): Member | null {
    if (!membership) {
      fail(conn, "not-in-room", "当前不在房间中");
      return null;
    }
    if (membership.room.host !== membership.id) {
      fail(conn, "not-host", "只有房主可以执行此操作");
      return null;
    }
    const member =
      typeof target === "string" ? membership.room.members.get(target) : null;
    if (!member || member.info.id === membership.id) {
      fail(conn, "bad-target", "目标队员不在房间中");
      return null;
    }
    return member;
  }

  function handle(conn: Connection, message: ClientMessage) {
    const membership = memberships.get(conn);
    switch (message.t) {
      case "create":
      case "join": {
        if (message.v !== PROTOCOL_VERSION) {
          return fail(
            conn,
            "version",
            "客户端与联机服务版本不一致，请刷新页面",
          );
        }
        if (membership) {
          return fail(conn, "already-in-room", "已在房间中，请先离开");
        }
        const name = normalizeName(message.name);
        if (!name) {
          return fail(conn, "bad-name", "昵称须为 1–24 个字符");
        }
        if (message.t === "create") {
          const code = rooms.size < MAX_ROOMS ? newCode() : null;
          if (!code) {
            return fail(conn, "server-full", "联机服务房间数已满");
          }
          const room: Room = {
            code,
            host: "",
            phase: "lobby",
            startedAt: 0,
            members: new Map(),
          };
          rooms.set(code, room);
          return enter(conn, room, name);
        }
        const code = normalizeRoomCode(message.room);
        if (!code) {
          return fail(conn, "bad-room", "房间号为 4 位字母或数字");
        }
        const room = rooms.get(code);
        if (!room) {
          return fail(conn, "room-not-found", `房间 ${code} 不存在`);
        }
        if (room.members.size >= MAX_ROOM_PLAYERS) {
          return fail(
            conn,
            "room-full",
            `房间 ${code} 已满（最多 ${MAX_ROOM_PLAYERS} 人）`,
          );
        }
        return enter(conn, room, name);
      }
      case "leave":
        if (!leave(conn)) {
          return fail(conn, "not-in-room", "当前不在房间中");
        }
        return conn.send({ t: "left" });
      case "rename": {
        if (!membership) {
          return fail(conn, "not-in-room", "当前不在房间中");
        }
        const name = normalizeName(message.name);
        if (!name) {
          return fail(conn, "bad-name", "昵称须为 1–24 个字符");
        }
        membership.room.members.get(membership.id)!.info.name = name;
        return broadcast(membership.room, {
          t: "peer-renamed",
          id: membership.id,
          name,
        });
      }
      case "state": {
        if (!membership) {
          return;
        }
        const state = sanitizeState(message.s);
        if (!state) {
          return fail(conn, "bad-message", "位置数据无效");
        }
        membership.room.members.get(membership.id)!.state = state;
        return;
      }
      case "ready": {
        if (!membership) {
          return fail(conn, "not-in-room", "当前不在房间中");
        }
        if (typeof message.ready !== "boolean") {
          return fail(conn, "bad-message", "准备状态无效");
        }
        const { room, id } = membership;
        if (room.host === id) {
          return fail(conn, "not-host", "房主无需准备，直接发起行动即可");
        }
        if (
          room.phase === "mission" &&
          Date.now() - room.startedAt < MISSION_COUNTDOWN_MS
        ) {
          return fail(conn, "not-ready", "全队正在倒计时，请等待行动开始");
        }
        const info = room.members.get(id)!.info;
        if (info.ready !== message.ready) {
          info.ready = message.ready;
          broadcast(room, { t: "peer-ready", id, ready: info.ready });
        }
        return;
      }
      case "start": {
        if (!membership) {
          return fail(conn, "not-in-room", "当前不在房间中");
        }
        const { room, id } = membership;
        if (room.host !== id) {
          return fail(conn, "not-host", "只有房主可以发起行动");
        }
        if (
          room.phase === "mission" &&
          Date.now() - room.startedAt < MISSION_COUNTDOWN_MS
        ) {
          return fail(conn, "not-ready", "全队正在倒计时，请勿重复发起");
        }
        const waiting = [...room.members.values()].filter(
          (m) => m.info.id !== id && !m.info.ready,
        ).length;
        if (waiting) {
          return fail(conn, "not-ready", `还有 ${waiting} 名队员未准备`);
        }
        for (const m of room.members.values()) m.info.ready = false;
        room.phase = "mission";
        room.startedAt = Date.now();
        return broadcast(room, {
          t: "mission",
          by: id,
          delay: MISSION_COUNTDOWN_MS,
        });
      }
      case "kick": {
        const target = hostTarget(conn, membership, message.id);
        if (target) {
          target.conn.send({ t: "kicked" });
          leave(target.conn, true);
        }
        return;
      }
      case "host": {
        const target = hostTarget(conn, membership, message.id);
        if (target) {
          setHost(membership!.room, target);
        }
        return;
      }
      case "ping":
        return conn.send({
          t: "pong",
          at: finite(message.at, -Number.MAX_VALUE, Number.MAX_VALUE) ?? 0,
        });
      default:
        return fail(conn, "bad-message", "未知消息类型");
    }
  }

  function tick() {
    const at = Date.now();
    for (const room of rooms.values()) {
      if (
        room.phase === "mission" &&
        at - room.startedAt > MISSION_SETTLE_MS &&
        [...room.members.values()].every((m) => m.state.mode === "idle")
      ) {
        room.phase = "lobby";
        broadcast(room, { t: "phase", phase: "lobby" });
      }
      broadcast(room, {
        t: "snapshot",
        at,
        peers: [...room.members.values()].map((m) => ({
          id: m.info.id,
          ...m.state,
        })),
      });
    }
  }

  function stats(): RoomStats {
    let players = 0;
    for (const room of rooms.values()) players += room.members.size;
    return { rooms: rooms.size, players };
  }

  return { handle, leave, tick, stats };
}

export type RoomRegistry = ReturnType<typeof createRoomRegistry>;
