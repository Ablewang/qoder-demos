// contracts.md §8 + v1.1（tuanzi-v1-protocol §8.3–§8.5）
import type { Actor, CapabilityId, EntityId, EvidenceRef, PersonId, Sensitivity, Timestamp } from './common.ts';
import type { AuditWriter, Logger, StorageService } from './platform.ts';

export type MemoryLayer = 'profile' | 'long_term' | 'journal';
export type UserEvidenceType = 'message' | 'decision' | 'local_edit';

export type MemoryOrigin =
  | { kind: 'user'; evidenceId: string; evidenceType: UserEvidenceType }
  | { kind: 'consolidation'; runId: string; evidence: EvidenceRef[] }
  | { kind: 'companion'; evidence: EvidenceRef[] }
  | { kind: 'external'; entityIds: EntityId[] };

export interface MemoryItem {
  id: string;
  layer: MemoryLayer;
  kind: 'rule' | 'fact' | 'episode';
  text: string;
  about?: Array<EntityId | PersonId>;
  origin: MemoryOrigin;
  sensitivity: Sensitivity;
  createdAt: Timestamp;
  validUntil?: Timestamp;
  file: string;
  line?: number;
}

export interface DecisionStat { accepted: number; edited: number; dismissed: number; snoozed: number; completed: number; sampleSize: number }

export interface MemoryReader {
  profile(): MemoryItem[];
  longTerm(opts?: { about?: Array<EntityId | PersonId>; limit?: number }): MemoryItem[];
  search(query: string, opts?: { layers?: MemoryLayer[]; limit?: number }): MemoryItem[];
  feedback(capabilityId: CapabilityId, dedupeKeyPrefix?: string): DecisionStat[];
}

export interface MemoryWriter {
  remember(item: Omit<MemoryItem, 'id' | 'createdAt' | 'file' | 'line'>): MemoryItem;
  update(id: string, patch: { text?: string; sensitivity?: Sensitivity; validUntil?: Timestamp }, by: Actor, evidenceId: string): MemoryItem;
  appendJournal(date: string, item: { text: string; about?: Array<EntityId | PersonId>; origin: MemoryOrigin; sensitivity: Sensitivity }): void;
  /** by 为用户时 evidenceId 运行时必填 */
  forget(id: string, by: Actor, evidenceId?: string): void;
}

/** v1.1：面板浏览用，返回正文，只交给本机已认证接口 */
export interface MemoryBrowser {
  get(id: string): MemoryItem | undefined;
  list(opts?: { layer?: MemoryLayer; includeExpired?: boolean; limit?: number }): MemoryItem[];
  journal(date: string): MemoryItem[];
  retype(id: string, kind: 'rule' | 'fact', by: Actor, evidenceId: string): MemoryItem;
  reindex(): void;
}

export interface UserEvidenceVerifier {
  verify(evidenceId: string, type: UserEvidenceType): boolean;
}

export type MemoryChange =
  | { change: 'created' | 'updated' | 'forgotten'; id: string; layer: MemoryLayer }
  | { change: 'reindexed' }
  | { change: 'issue'; file: string; line?: number; reason: string };   // reason 不含正文

export interface MemoryModuleDeps {
  storage: StorageService;
  audit: AuditWriter;
  log: Logger;
  evidence: UserEvidenceVerifier;
  /** <data>/companion 的绝对路径 */
  companionDir: string;
  now(): Timestamp;
  newId(prefix: string): string;
  onChange(change: MemoryChange): void;
  progress?(p: { label: string; done: number; total: number } | null): void;
}

export interface MemoryModule extends MemoryReader, MemoryWriter, MemoryBrowser {
  start(): void;
  stop(): void;
}

export type CreateMemoryModule = (deps: MemoryModuleDeps) => MemoryModule;

export const MEMORY_TEXT_LIMITS = { min: 2, max: 200 } as const;
