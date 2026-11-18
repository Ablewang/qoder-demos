// LAN multiplayer wire protocol shared by the Node server and the browser client.
export const PROTOCOL_VERSION = 2;
export const WS_PATH = "/ws";
export const MAX_ROOM_PLAYERS = 4;
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const MAX_NAME_LENGTH = 24;
export const SNAPSHOT_HZ = 20;
export const MAX_MESSAGE_BYTES = 1024;
export const MISSION_COUNTDOWN_MS = 3000;

/** idle = in menus (avatar hidden), field = on the quay, down = player died. */
export type PeerMode = "idle" | "field" | "down";

export interface PeerState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  crouch: boolean;
  /** Fired at least once since the previous state message. */
  fire: boolean;
  mode: PeerMode;
}

export interface PeerInfo {
  id: string;
  name: string;
  slot: number;
  ready: boolean;
}

/** lobby = waiting for the host; mission = host launched a squad deployment. */
export type RoomPhase = "lobby" | "mission";

export interface PeerSnapshot extends PeerState {
  id: string;
}

export type ClientMessage =
  | { t: "create"; v: number; name: string }
  | { t: "join"; v: number; room: string; name: string }
  | { t: "leave" }
  | { t: "rename"; name: string }
  | { t: "state"; s: PeerState }
  | { t: "ping"; at: number }
  | { t: "ready"; ready: boolean }
  | { t: "start" }
  | { t: "kick"; id: string }
  | { t: "host"; id: string };

export type ErrorCode =
  | "bad-message"
  | "version"
  | "bad-name"
  | "bad-room"
  | "room-not-found"
  | "room-full"
  | "server-full"
  | "not-in-room"
  | "already-in-room"
  | "not-host"
  | "not-ready"
  | "bad-target";

export type ServerMessage =
  | {
      t: "welcome";
      v: number;
      id: string;
      room: string;
      host: string;
      phase: RoomPhase;
      peers: PeerInfo[];
    }
  | { t: "peer-joined"; peer: PeerInfo }
  | { t: "peer-left"; id: string; kicked: boolean }
  | { t: "peer-renamed"; id: string; name: string }
  | { t: "peer-ready"; id: string; ready: boolean }
  | { t: "host-changed"; id: string }
  | { t: "mission"; by: string; delay: number }
  | { t: "phase"; phase: RoomPhase }
  | { t: "kicked" }
  | { t: "left" }
  | { t: "snapshot"; at: number; peers: PeerSnapshot[] }
  | { t: "pong"; at: number }
  | { t: "error"; code: ErrorCode; message: string };

export function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const name = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  const length = [...name].length;
  return length >= 1 && length <= MAX_NAME_LENGTH ? name : null;
}

export function normalizeRoomCode(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const code = value.trim().toUpperCase();
  if (code.length !== ROOM_CODE_LENGTH) {
    return null;
  }
  for (const ch of code) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) {
      return null;
    }
  }
  return code;
}
