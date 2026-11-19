import { createHash } from 'node:crypto';
import type { StorageService, UserEvidenceType, UserEvidenceVerifier } from '../contracts/index.ts';

export interface EvidenceRegistry extends UserEvidenceVerifier { register(type: UserEvidenceType): string }

export function createEvidenceRegistry(deps: { storage: StorageService; now(): number; newId(prefix: string): string }): EvidenceRegistry {
  const sql = 'CREATE TABLE ui_user_evidence (id TEXT PRIMARY KEY, type TEXT NOT NULL, at INTEGER NOT NULL); CREATE INDEX ui_user_evidence_at ON ui_user_evidence(at);';
  deps.storage.registerMigrations('surfaces.evidence', ['ui_'], [{ version: 1, checksum: createHash('sha256').update(sql).digest('hex'), apply: (tx) => { tx.run(sql); } }]);
  return {
    register(type) {
      const id = deps.newId('ev');
      deps.storage.transaction((tx) => {
        tx.run('DELETE FROM ui_user_evidence WHERE at <= ?', [deps.now() - 600_000]);
        tx.run('INSERT INTO ui_user_evidence VALUES (?, ?, ?)', [id, type, deps.now()]);
      });
      return id;
    },
    verify(id, type) {
      return deps.storage.transaction((tx) => Boolean(tx.get('SELECT id FROM ui_user_evidence WHERE id = ? AND type = ? AND at > ? AND at <= ?', [id, type, deps.now() - 600_000, deps.now()])));
    },
  };
}
