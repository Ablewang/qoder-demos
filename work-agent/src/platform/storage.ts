import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import type { Migration, SqlValue, StorageService, Tx } from '../contracts/index.ts';
import { ContractError } from '../contracts/index.ts';

export function sqlMigration(version: number, sql: string): Migration {
  return {
    version,
    checksum: createHash('sha256').update(sql).digest('hex'),
    apply: (tx) => { tx.run(sql); },
  };
}

export function assertCreatedNames(sql: string, prefixes: string[]): void {
  const clean = sql.replace(/--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\//g, ' ');
  const pattern = /\bCREATE\s+(?:(?:UNIQUE\s+)?INDEX|(?:(?:TEMP|TEMPORARY)\s+)?(?:VIRTUAL\s+)?TABLE)\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[\w]+)(?:\s*\.\s*(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[\w]+))?)/gi;
  for (const match of clean.matchAll(pattern)) {
    const raw = match[1].split('.').at(-1)!.trim();
    const name = raw.replace(/^["`\[]|["`\]]$/g, '');
    if (!prefixes.some((prefix) => name.startsWith(prefix))) {
      throw new ContractError('bad_request', 'migration object is outside registered prefixes');
    }
  }
}

export class SqliteStorage implements StorageService {
  readonly db: DatabaseSync;
  readonly filename: string;
  private readonly frames: Array<{ active: boolean; failed: boolean; error?: unknown }> = [];
  private savepoint = 0;

  constructor(filename: string) {
    this.filename = filename;
    if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    this.db.exec('CREATE TABLE IF NOT EXISTS platform_migrations (module_id TEXT NOT NULL, version INTEGER NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL, PRIMARY KEY (module_id, version));');
  }

  private tx(check?: (sql: string) => void): Tx {
    const frame = this.frames.at(-1)!;
    const execute = <T>(sql: string, operation: () => T): T => {
      if (!frame.active) throw new ContractError('bad_request', 'transaction is no longer active');
      if (frame.failed) throw frame.error;
      try {
        if (!this.db.isTransaction) throw new ContractError('internal', 'SQLite transaction has ended');
        check?.(sql);
        return operation();
      } catch (error) {
        for (const active of this.frames) {
          if (!active.failed) { active.failed = true; active.error = error; }
        }
        throw error;
      }
    };
    return {
      run: (sql, params = []) => execute(sql, () => {
        if (params.length === 0 && sql.includes(';')) {
          this.db.exec(sql);
          return { changes: 0 };
        }
        return { changes: Number(this.db.prepare(sql).run(...params).changes) };
      }),
      get: (sql, params = []) => execute(sql, () => this.db.prepare(sql).get(...params) as Record<string, SqlValue> | undefined),
      all: (sql, params = []) => execute(sql, () => this.db.prepare(sql).all(...params) as Array<Record<string, SqlValue>>),
    };
  }

  transaction<T>(work: (tx: Tx) => T): T {
    return this.inTransaction(() => work(this.tx()));
  }

  private inTransaction<T>(work: () => T): T {
    const parent = this.frames.at(-1);
    if (parent?.failed) throw parent.error;
    const nested = parent !== undefined;
    const name = `platform_sp_${++this.savepoint}`;
    this.db.exec(nested ? `SAVEPOINT ${name}` : 'BEGIN IMMEDIATE');
    const frame: { active: boolean; failed: boolean; error?: unknown } = { active: true, failed: false };
    this.frames.push(frame);
    try {
      const result = work();
      if (result && typeof (result as { then?: unknown }).then === 'function') {
        void Promise.resolve(result).catch(() => {});
        throw new ContractError('bad_request', 'transaction callback must be synchronous');
      }
      if (frame.failed) throw frame.error;
      this.db.exec(nested ? `RELEASE SAVEPOINT ${name}` : 'COMMIT');
      return result;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec(nested ? `ROLLBACK TO SAVEPOINT ${name}; RELEASE SAVEPOINT ${name}` : 'ROLLBACK');
      throw error;
    } finally {
      frame.active = false;
      this.frames.pop();
    }
  }

  registerMigrations(moduleId: string, prefixes: string[], migrations: Migration[]): void {
    if (!moduleId || !prefixes.length || prefixes.some((p) => !/^[a-z][a-z0-9]*_$/.test(p))) {
      throw new ContractError('bad_request', 'invalid migration registration');
    }
    const versions = new Set<number>();
    const sorted = migrations.slice().sort((a, b) => a.version - b.version);
    const existing = this.db.prepare('SELECT version, checksum FROM platform_migrations WHERE module_id = ?').all(moduleId);
    for (const migration of sorted) {
      if (!Number.isInteger(migration.version) || migration.version < 1 || versions.has(migration.version) || !migration.checksum) {
        throw new ContractError('bad_request', 'invalid migration version');
      }
      versions.add(migration.version);
      const old = existing.find((r) => r.version === migration.version);
      if (old && old.checksum !== migration.checksum) throw new ContractError('conflict', 'migration checksum changed');
      if (!old && existing.some((r) => Number(r.version) > migration.version)) throw new ContractError('conflict', 'migration order changed');
    }
    if (sorted.some((m) => !existing.some((r) => r.version === m.version)) && this.filename !== ':memory:' && existsSync(this.filename)) {
      this.db.exec('PRAGMA wal_checkpoint(FULL)');
      copyFileSync(this.filename, `${this.filename}.migration.bak`);
    }
    for (const migration of sorted) {
      if (existing.some((r) => r.version === migration.version)) continue;
      this.inTransaction(() => {
        const result: unknown = migration.apply(this.tx((sql) => assertCreatedNames(sql, prefixes)));
        if (result && typeof (result as { then?: unknown }).then === 'function') {
          void Promise.resolve(result).catch(() => {});
          throw new ContractError('bad_request', 'migration callback must be synchronous');
        }
        if (this.db.prepare('PRAGMA quick_check').all().some((row) => row.quick_check !== 'ok') || this.db.prepare('PRAGMA foreign_key_check').all().length) {
          throw new ContractError('internal', 'migration integrity check failed');
        }
        this.db.prepare('INSERT INTO platform_migrations (module_id, version, checksum, applied_at) VALUES (?, ?, ?, ?)')
          .run(moduleId, migration.version, migration.checksum, Date.now());
      });
    }
  }

  close(): void {
    this.db.close();
  }
}
