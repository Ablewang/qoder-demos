import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { chmodSync, mkdirSync, readdirSync, lstatSync, unlinkSync, openSync, closeSync, readFileSync, fstatSync, constants } from 'node:fs';
import { join } from 'node:path';

// One synchronous connection and synchronous transactions: local single-process MVP only.
export type Row = Record<string, any>;
export class Store {
  readonly db: DatabaseSync;
  readonly audioDir: string;
  readonly dbPath: string;
  constructor(readonly dataDir: string) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    if (!lstatSync(dataDir).isDirectory() || lstatSync(dataDir).isSymbolicLink()) throw new Error('数据目录必须是实际目录');
    chmodSync(dataDir, 0o700);
    this.audioDir = join(dataDir, 'audio');
    mkdirSync(this.audioDir, { recursive: true, mode: 0o700 });
    if (!lstatSync(this.audioDir).isDirectory() || lstatSync(this.audioDir).isSymbolicLink()) throw new Error('音频目录必须是实际目录');
    chmodSync(this.audioDir, 0o700);
    this.dbPath = join(dataDir, 'archive.sqlite');
    try { if (lstatSync(this.dbPath).isSymbolicLink()) throw new Error('数据库不得是符号链接'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    this.db = new DatabaseSync(this.dbPath);
    chmodSync(this.dbPath, 0o600);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = DELETE;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS families (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, storytellerName TEXT NOT NULL,
        listenerHash TEXT UNIQUE NOT NULL, passcodeHash TEXT NOT NULL,
        storytellerHash TEXT UNIQUE NOT NULL, recoveryHash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY, familyId TEXT NOT NULL REFERENCES families(id), name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('organizer','storyteller','listener')), revoked INTEGER NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS family_organizer ON members(familyId) WHERE role='organizer';
      CREATE UNIQUE INDEX IF NOT EXISTS family_storyteller ON members(familyId) WHERE role='storyteller';
      CREATE TABLE IF NOT EXISTS sessions (
        hash TEXT PRIMARY KEY, memberId TEXT NOT NULL REFERENCES members(id), expires INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS asks (
        id TEXT PRIMARY KEY, familyId TEXT NOT NULL REFERENCES families(id), text TEXT NOT NULL,
        stage TEXT NOT NULL, depth TEXT NOT NULL, askedBy TEXT REFERENCES members(id),
        status TEXT NOT NULL CHECK(status IN ('pending','answered','skipped')),
        parentStoryId TEXT, createdAt TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS pending_continuation ON asks(parentStoryId) WHERE status='pending' AND parentStoryId IS NOT NULL;
      CREATE TABLE IF NOT EXISTS generatedAsks (
        id TEXT PRIMARY KEY REFERENCES asks(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY, familyId TEXT NOT NULL REFERENCES families(id), askId TEXT REFERENCES asks(id) ON DELETE SET NULL,
        question TEXT NOT NULL, stage TEXT NOT NULL, text TEXT NOT NULL, type TEXT NOT NULL,
        mime TEXT, duration REAL, bytes INTEGER NOT NULL, file TEXT UNIQUE,
        storytellerId TEXT NOT NULL REFERENCES members(id), recordedById TEXT NOT NULL REFERENCES members(id),
        parentStoryId TEXT, createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS followups (
        id TEXT PRIMARY KEY, storyId TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        memberId TEXT NOT NULL REFERENCES members(id), text TEXT NOT NULL, answered INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS askFollowups (
        askId TEXT NOT NULL REFERENCES asks(id) ON DELETE CASCADE,
        followupId TEXT NOT NULL REFERENCES followups(id) ON DELETE CASCADE,
        PRIMARY KEY(askId,followupId)
      );
      CREATE TABLE IF NOT EXISTS thens (
        storyId TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        memberId TEXT NOT NULL REFERENCES members(id), PRIMARY KEY(storyId,memberId)
      );
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT NOT NULL, familyId TEXT NOT NULL REFERENCES families(id), memberId TEXT NOT NULL REFERENCES members(id),
        payloadHash TEXT NOT NULL, storyId TEXT REFERENCES stories(id) ON DELETE SET NULL,
        PRIMARY KEY(id,familyId,memberId)
      );
      CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    `);
    const referenced = new Set(this.all('SELECT file FROM stories WHERE file IS NOT NULL').map(r => r.file));
    for (const file of readdirSync(this.audioDir)) {
      const path = join(this.audioDir, file);
      if (!referenced.has(file)) {
        if (/^[a-f0-9-]{36}\.(?:wav|mp3|m4a|ogg|webm)$/.test(file) || /^[a-f0-9-]{36}\.[a-f0-9-]{36}\.tmp$/.test(file)) unlinkSync(path);
      } else {
        if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) throw new Error('音频文件必须是实际文件');
        chmodSync(path, 0o600);
      }
    }
  }
  get<T = Row>(sql: string, ...values: SQLInputValue[]): T | undefined { return this.db.prepare(sql).get(...values) as T | undefined; }
  all<T = Row>(sql: string, ...values: SQLInputValue[]): T[] { return this.db.prepare(sql).all(...values) as T[]; }
  run(sql: string, ...values: SQLInputValue[]) { return this.db.prepare(sql).run(...values); }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  readAudio(file: string): Buffer {
    if (!/^[a-f0-9-]{36}\.(wav|mp3|m4a|ogg|webm)$/.test(file)) throw new Error('音频路径无效');
    const fd = openSync(join(this.audioDir, file), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      if (!fstatSync(fd).isFile()) throw new Error('音频文件无效');
      return readFileSync(fd);
    } finally { closeSync(fd); }
  }
  close() { this.db.close(); }
}
