// contracts.md §1.1、§5.1（子集）
import type { Actor, EntityId, ProposalId, Timestamp } from './common.ts';

export type SqlValue = string | number | bigint | Uint8Array | null;

export interface Tx {
  run(sql: string, params?: SqlValue[]): { changes: number };
  get(sql: string, params?: SqlValue[]): Record<string, SqlValue> | undefined;
  all(sql: string, params?: SqlValue[]): Array<Record<string, SqlValue>>;
}
export interface Migration { version: number; checksum: string; apply(tx: Tx): void }
export interface StorageService {
  registerMigrations(moduleId: string, tablePrefixes: string[], migrations: Migration[]): void;
  transaction<T>(work: (tx: Tx) => T): T;
}

export interface SecretStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface KeyValueStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  delete(key: string): void;
}

export interface Logger {
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}

export interface AuditRecord {
  id: string; at: Timestamp; actor: Actor;
  kind: 'decision' | 'tool_write' | 'tool_read_content' | 'llm_call' | 'auth' | 'share' | 'config' | 'memory';
  refs: { proposalId?: ProposalId; decisionId?: string; executionId?: string; stepId?: string; entityIds?: EntityId[]; tool?: string; provider?: string };
  summary: string;
  outcome: 'started' | 'ok' | 'error' | 'unknown';
  detail?: Record<string, unknown>;
}
export interface AuditWriter { append(record: AuditRecord, tx?: Tx): void }
