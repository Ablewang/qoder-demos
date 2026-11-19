// contracts.md §11、§12 + v1.1（tuanzi-v1-protocol §2–§6）
import type { Sensitivity, Timestamp } from './common.ts';
import type { MemoryItem, MemoryLayer } from './memory.ts';
import type { NoticeRecord, Reminder } from './notice.ts';
import type { ChatChunk, CompanionSettings, PetActivity, PetState, PetUtterance, Persona, QuietReason } from './companion.ts';

export const LOCAL_API_PROTOCOL = 1;
export const LOCAL_API_PREFIX = '/api/v1';
export const DEFAULT_PORT = 8787;
export const PORT_FALLBACK_LAST = 8797;
export const KEYCHAIN_SERVICE = 'work-agent';
export const KEYCHAIN_TOKEN_ACCOUNT = 'local-api-token';
export const TAURI_ORIGINS = ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'] as const;

/** <data>/run/daemon.json；不含令牌 */
export interface DaemonInfo { pid: number; port: number; startedAt: Timestamp; version: string; protocol: 1 }

export interface HealthResponse { ok: true; version: string; protocol: 1; startedAt: Timestamp }

export interface ApiError { error: { code: string; message: string } }

export type QuietRequest = { mode: 'dnd' | 'demo' | 'off'; minutes?: number };
export type ClientQuietRequest = { reasons: QuietReason[]; detection: 'known' | 'unknown'; ttlMs: number };
export type AudioRequest = { enabled: boolean; volume: number };

export interface MemoryCreateRequest {
  layer: Exclude<MemoryLayer, 'journal'>;
  kind: 'rule' | 'fact';
  text: string;
  sensitivity?: Exclude<Sensitivity, 'secret'>;
  validUntil?: Timestamp;
}
export interface MemoryPatchRequest { text?: string; sensitivity?: Exclude<Sensitivity, 'secret'>; validUntil?: Timestamp | null }
export interface MemoryReindexResponse { ok: true }

export interface ChatRequest { message: string; conversationId?: string }
export interface ChatResponse { conversationId: string; chunks: ChatChunk[] }

export interface ListResponse<T> { items: T[] }
export type MemoryListResponse = ListResponse<MemoryItem>;
export type NoticeListResponse = ListResponse<NoticeRecord>;
export type ReminderListResponse = ListResponse<Reminder>;

export type StreamEvent =
  | { type: 'hello'; data: { seq: number } }
  | { type: 'pet.state'; data: { state: PetState } }
  | { type: 'pet.utterance'; data: { utterance: PetUtterance } }
  | { type: 'notice.created' | 'notice.updated'; data: { notice: NoticeRecord } }
  | { type: 'memory.changed'; data: { id?: string; layer?: MemoryLayer; change: 'created' | 'updated' | 'forgotten' | 'reindexed' | 'issue' } }
  | { type: 'persona.updated'; data: { persona: Persona } }
  | { type: 'settings.updated'; data: { settings: CompanionSettings } }
  | { type: 'reminder.changed'; data: { reminder: Reminder } }
  | { type: 'resync_required'; data: Record<string, never> }
  | { type: 'bye'; data: Record<string, never> };

export const STREAM_RETENTION = { maxEvents: 1000, maxAgeMs: 24 * 3600_000, heartbeatMs: 15_000, retryMs: 3000 } as const;

export interface SkinManifest {
  id: string; formatVersion: 1; version: string;
  assets: Array<{ path: string; sha256: string; mediaType: string }>;
  anchor: { x: number; y: number };
  hitAreas: Array<{ x: number; y: number; width: number; height: number }>;
  animations: Record<string, string[]>;
  semanticMap: Partial<Record<PetActivity, string>>;
  activities: Array<{ id: string; animationId: string; minIntervalMs: number; audioAsset?: string }>;
}

export interface WindowAnchor {
  kind: 'window_edge' | 'desktop_edge';
  screenId: string; windowHandle?: string; edge: 'left' | 'right' | 'top' | 'bottom'; offset: number;
}
