import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { initialState, type State } from './domain.ts';

export class Store {
  private db: DatabaseSync;
  constructor(path: string, today?: string) {
    if (path !== ':memory:') { mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); chmodSync(dirname(path), 0o700); }
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA secure_delete = ON; CREATE TABLE IF NOT EXISTS demo_state (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL)');
    if (!this.db.prepare('SELECT id FROM demo_state WHERE id = 1').get()) this.db.prepare('INSERT INTO demo_state(id, body) VALUES(1, ?)').run(JSON.stringify(initialState(today)));
    if (path !== ':memory:') chmodSync(path, 0o600);
  }
  read(): State { return JSON.parse(this.db.prepare('SELECT body FROM demo_state WHERE id = 1').get()!.body as string) as State; }
  write<T>(operation: (state: State) => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const state = this.read();
      const result = operation(state);
      this.db.prepare('UPDATE demo_state SET body = ? WHERE id = 1').run(JSON.stringify(state));
      this.db.exec('COMMIT'); return result;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  reset(today?: string): void {
    this.db.prepare('UPDATE demo_state SET body = ? WHERE id = 1').run(JSON.stringify(initialState(today)));
    this.db.exec('VACUUM');
  }
  compact(): void { this.db.exec('VACUUM'); }
  close(): void { this.db.close(); }
}
