import { checkOrigin, checkText, isKind, isLayer, isSensitivity, isTimestamp, sha256, textMaxFor, tombstoneHash } from './format.ts';
import type { StorageService, Tx } from '../contracts/platform.ts';
import type { MemoryItem } from '../contracts/memory.ts';

const SQL = [
  `CREATE TABLE mem_items (
    id TEXT PRIMARY KEY, layer TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL,
    origin_json TEXT NOT NULL, sens TEXT NOT NULL, created INTEGER NOT NULL,
    until INTEGER, file TEXT NOT NULL, line INTEGER NOT NULL, about_json TEXT
  )`,
  `CREATE VIRTUAL TABLE mem_fts USING fts5(id UNINDEXED, text, tokenize='trigram')`,
  `CREATE TABLE mem_tombstones (hash TEXT PRIMARY KEY, id TEXT NOT NULL, at INTEGER NOT NULL, by_kind TEXT NOT NULL)`,
  `CREATE TABLE mem_files (path TEXT PRIMARY KEY, sha256 TEXT NOT NULL)`,
  `CREATE INDEX mem_items_file ON mem_items(file)`,
  `CREATE INDEX mem_items_layer ON mem_items(layer, created)`,
];

const PROVENANCE_SQL = [
  `CREATE TABLE mem_provenance (
    id TEXT PRIMARY KEY, layer TEXT NOT NULL, kind TEXT NOT NULL,
    origin_json TEXT NOT NULL, about_json TEXT, hash TEXT NOT NULL, file TEXT NOT NULL
  )`,
  `CREATE INDEX mem_provenance_file ON mem_provenance(file)`,
];

export interface Provenance extends Pick<MemoryItem, 'id' | 'layer' | 'kind' | 'origin' | 'about' | 'file'> {
  hash: string;
}

export function migrate(storage: StorageService): void {
  storage.registerMigrations('memory', ['mem_'], [{
    version: 1,
    checksum: sha256(SQL.join(';\n')),
    apply(tx) { for (const sql of SQL) tx.run(sql); },
  }, {
    version: 2,
    checksum: sha256(PROVENANCE_SQL.join(';\n')),
    apply(tx) {
      for (const sql of PROVENANCE_SQL) tx.run(sql);
      for (const row of tx.all('SELECT * FROM mem_items')) {
        let item: MemoryItem;
        try {
          item = toItem(row);
          item.origin = checkOrigin(item.origin);
        } catch { continue; }
        if (!isLayer(item.layer) || !isKind(item.kind) || !isSensitivity(item.sensitivity)
          || !isTimestamp(item.createdAt) || (item.validUntil !== undefined && !isTimestamp(item.validUntil))
          || checkText(item.text, textMaxFor(item.layer)) || (item.kind === 'rule' && item.origin.kind !== 'user')) continue;
        // These are already admitted v1 rows, not self-reported Markdown markers.
        // Accepted rules retain their admission history after short-lived proof expires.
        storeProvenance(tx, { ...item, hash: tombstoneHash(item.text) });
      }
    },
  }]);
}

export function allProvenance(tx: Tx): Provenance[] {
  return tx.all('SELECT * FROM mem_provenance ORDER BY file, id').map((row) => ({
    id: String(row.id), layer: row.layer as MemoryItem['layer'], kind: row.kind as MemoryItem['kind'],
    origin: JSON.parse(String(row.origin_json)), hash: String(row.hash), file: String(row.file),
    ...(row.about_json === null ? {} : { about: JSON.parse(String(row.about_json)) }),
  }));
}

function storeProvenance(tx: Tx, item: Provenance): void {
  tx.run(`INSERT INTO mem_provenance (id, layer, kind, origin_json, about_json, hash, file)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET layer=excluded.layer, kind=excluded.kind,
      origin_json=excluded.origin_json, about_json=excluded.about_json, hash=excluded.hash, file=excluded.file`, [
    item.id, item.layer, item.kind, JSON.stringify(item.origin),
    item.about === undefined ? null : JSON.stringify(item.about), item.hash, item.file,
  ]);
}

export function removeProvenance(tx: Tx, id: string): void {
  tx.run('DELETE FROM mem_provenance WHERE id = ?', [id]);
}

export function toItem(row: NonNullable<ReturnType<Tx['get']>>): MemoryItem {
  const item: MemoryItem = {
    id: String(row.id), layer: row.layer as MemoryItem['layer'], kind: row.kind as MemoryItem['kind'],
    text: String(row.text), origin: JSON.parse(String(row.origin_json)),
    sensitivity: row.sens as MemoryItem['sensitivity'], createdAt: Number(row.created),
    file: String(row.file), line: Number(row.line),
  };
  if (row.until !== null) item.validUntil = Number(row.until);
  if (row.about_json !== null) item.about = JSON.parse(String(row.about_json));
  return item;
}

export function allItems(tx: Tx): MemoryItem[] {
  return tx.all('SELECT * FROM mem_items ORDER BY file, line').map(toItem);
}

export function storeItem(tx: Tx, item: MemoryItem): void {
  storeProvenance(tx, { ...item, hash: tombstoneHash(item.text) });
  tx.run(`INSERT INTO mem_items (id, layer, kind, text, origin_json, sens, created, until, file, line, about_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET layer=excluded.layer, kind=excluded.kind, text=excluded.text,
      origin_json=excluded.origin_json, sens=excluded.sens, created=excluded.created, until=excluded.until,
      file=excluded.file, line=excluded.line, about_json=excluded.about_json`, [
    item.id, item.layer, item.kind, item.text, JSON.stringify(item.origin), item.sensitivity,
    item.createdAt, item.validUntil ?? null, item.file, item.line ?? 1,
    item.about === undefined ? null : JSON.stringify(item.about),
  ]);
  tx.run('DELETE FROM mem_fts WHERE id = ?', [item.id]);
  tx.run('INSERT INTO mem_fts(id, text) VALUES (?, ?)', [item.id, item.text]);
}

export function removeItem(tx: Tx, id: string): void {
  tx.run('DELETE FROM mem_fts WHERE id = ?', [id]);
  tx.run('DELETE FROM mem_items WHERE id = ?', [id]);
}
