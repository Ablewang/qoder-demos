import type { AuditWriter, StorageService, AuditRecord, Tx } from '../contracts/index.ts';
import { sqlMigration } from './storage.ts';
import { redact } from './logger.ts';

export function createAuditWriter(storage: StorageService): AuditWriter {
  storage.registerMigrations('audit', ['audit_'], [sqlMigration(1, `
    CREATE TABLE audit_records (id TEXT PRIMARY KEY, at INTEGER NOT NULL, actor_json TEXT NOT NULL, kind TEXT NOT NULL, refs_json TEXT NOT NULL, summary TEXT NOT NULL, outcome TEXT NOT NULL, detail_json TEXT);
    CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_records BEGIN SELECT RAISE(ABORT, 'append only'); END;
    CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_records BEGIN SELECT RAISE(ABORT, 'append only'); END;
  `)]);
  const append = (record: AuditRecord, tx: Tx) => {
    tx.run('INSERT INTO audit_records VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [record.id, record.at, JSON.stringify(record.actor), record.kind, JSON.stringify(record.refs), record.summary, record.outcome, record.detail ? JSON.stringify(redact(record.detail)) : null]);
  };
  return { append(record, tx) { if (tx) append(record, tx); else storage.transaction((inner) => append(record, inner)); } };
}
