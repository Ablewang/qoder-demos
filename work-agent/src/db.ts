import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Category, Item, Kind, Source } from './types.ts';

export type Db = DatabaseSync;

export function openDb(file: string): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      start_at INTEGER NOT NULL,
      end_at INTEGER,
      actor TEXT,
      url TEXT,
      meta TEXT NOT NULL DEFAULT '{}',
      category TEXT
    );
    CREATE INDEX IF NOT EXISTS items_start ON items(start_at);
  `);
  return db;
}

// Items of `source` in [from, to) that are no longer returned upstream get removed; a changed title drops its category.
export function replaceRange(db: Db, source: Source, from: number, to: number, items: Item[]): void {
  const keep = new Set(items.map((i) => i.id));
  const existing = db
    .prepare('SELECT id FROM items WHERE source = ? AND start_at >= ? AND start_at < ?')
    .all(source, from, to) as { id: string }[];
  const del = db.prepare('DELETE FROM items WHERE id = ?');
  const upsert = db.prepare(`
    INSERT INTO items (id, source, kind, title, start_at, end_at, actor, url, meta, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      kind = excluded.kind,
      start_at = excluded.start_at,
      end_at = excluded.end_at,
      actor = excluded.actor,
      url = excluded.url,
      meta = excluded.meta,
      category = COALESCE(excluded.category, CASE WHEN items.title = excluded.title THEN items.category ELSE NULL END),
      title = excluded.title
  `);
  db.exec('BEGIN');
  try {
    for (const { id } of existing) if (!keep.has(id)) del.run(id);
    for (const i of items) {
      upsert.run(i.id, i.source, i.kind, i.title, i.startAt, i.endAt, i.actor, i.url, JSON.stringify(i.meta), i.category ?? null);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

interface Row {
  id: string;
  source: Source;
  kind: Kind;
  title: string;
  start_at: number;
  end_at: number | null;
  actor: string | null;
  url: string | null;
  meta: string;
  category: Category | null;
}

const toItem = (r: Row): Item => ({
  id: r.id,
  source: r.source,
  kind: r.kind,
  title: r.title,
  startAt: r.start_at,
  endAt: r.end_at,
  actor: r.actor,
  url: r.url,
  meta: JSON.parse(r.meta),
  category: r.category,
});

export function itemsInRange(db: Db, from: number, to: number): Item[] {
  const rows = db
    .prepare('SELECT * FROM items WHERE start_at >= ? AND start_at < ? ORDER BY start_at')
    .all(from, to) as unknown as Row[];
  return rows.map(toItem);
}

export function setCategories(db: Db, categories: Map<string, Category>): void {
  const stmt = db.prepare('UPDATE items SET category = ? WHERE id = ?');
  db.exec('BEGIN');
  for (const [id, cat] of categories) stmt.run(cat, id);
  db.exec('COMMIT');
}
