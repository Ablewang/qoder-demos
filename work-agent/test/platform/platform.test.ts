import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SqliteStorage, sqlMigration } from '../../src/platform/storage.ts';
import { createAuditWriter } from '../../src/platform/audit.ts';
import { createSecretStore } from '../../src/platform/secrets.ts';
import { createLogger } from '../../src/platform/logger.ts';
import { acquireLock, atomicWrite, writeDaemonInfo, removeDaemonInfo } from '../../src/platform/files.ts';
import { loadConfig } from '../../src/platform/config.ts';
import { OWNER_ACTOR, ContractError } from '../../src/contracts/index.ts';
import { ulid } from '../../src/platform/ids.ts';
import { startDaemon } from '../../src/daemon.ts';

function directory(t: TestContext) {
  const dir = mkdtempSync(path.join(tmpdir(), 'wa-platform-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('platform config uses repository location and environment; monotonic ULIDs', () => {
  const config = loadConfig({}, '/repo');
  assert.equal(config.dataDir, '/repo/data');
  assert.deepEqual(config.portRange, [8787, 8797]);
  assert.deepEqual(loadConfig({ WORK_AGENT_PORT: '8790', WORK_AGENT_DATA_DIR: '/tmp/wa', WORK_AGENT_DEV_ORIGINS: 'http://localhost:1420' }).portRange, [8790, 8797]);
  assert.throws(() => loadConfig({ WORK_AGENT_PORT: 'bogus' }));
  const first = ulid(1234); const second = ulid(1234);
  assert.match(first, /^[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.ok(first < second);
});

test('SQLite WAL, migration checksums/order/DDL prefixes, synchronous rollback and audit append-only', (t) => {
  const dir = directory(t);
  const storage = new SqliteStorage(path.join(dir, 'work-agent.db'));
  t.after(() => storage.close());
  assert.equal(storage.db.prepare('PRAGMA journal_mode').get()!.journal_mode, 'wal');
  const migration = sqlMigration(1, 'CREATE TABLE comp_test (id INTEGER PRIMARY KEY);');
  storage.registerMigrations('test', ['comp_'], [migration]);
  storage.registerMigrations('test', ['comp_'], [migration]);
  assert.equal(storage.transaction((tx) => tx.all("SELECT * FROM platform_migrations WHERE module_id = 'test'")).length, 1);
  assert.ok(existsSync(path.join(dir, 'work-agent.db.migration.bak')));
  assert.throws(() => storage.registerMigrations('test', ['comp_'], [{ ...migration, checksum: 'changed' }]), { code: 'conflict' });
  for (const [i, sql] of ['CREATE TABLE "mem_wrong" (id INTEGER)', 'CREATE UNIQUE INDEX [mem_wrong_index] ON comp_test(id)', 'CREATE VIRTUAL TABLE mem_wrong_fts USING fts5(text)', 'CREATE TABLE main.mem_wrong_again (id INTEGER)'].entries()) {
    assert.throws(() => storage.registerMigrations(`wrong${i}`, ['comp_'], [sqlMigration(1, sql)]), { code: 'bad_request' });
  }
  assert.throws(() => storage.transaction((tx) => { tx.run('INSERT INTO comp_test VALUES (?)', [1]); throw new Error('rollback'); }));
  assert.equal(storage.transaction((tx) => tx.all('SELECT * FROM comp_test')).length, 0);
  assert.throws(() => storage.transaction(async (tx) => { tx.run('INSERT INTO comp_test VALUES (?)', [2]); }), { code: 'bad_request' });
  assert.equal(storage.transaction((tx) => tx.all('SELECT * FROM comp_test')).length, 0);
  storage.transaction((tx) => { tx.run('INSERT INTO comp_test VALUES (?)', [3]); assert.throws(() => storage.transaction((inner) => { inner.run('INSERT INTO comp_test VALUES (?)', [4]); throw new Error(); })); });
  assert.deepEqual(storage.transaction((tx) => tx.all('SELECT id FROM comp_test')).map((r) => r.id), [3]);
  const audit = createAuditWriter(storage);
  audit.append({ id: 'a1', at: 1, actor: OWNER_ACTOR, kind: 'config', refs: {}, summary: 'config.updated', outcome: 'ok', detail: { text: 'private input' } });
  assert.throws(() => storage.transaction((tx) => tx.run('DELETE FROM audit_records')));
  assert.throws(() => storage.transaction((tx) => tx.run('UPDATE audit_records SET at = 2')));
  assert.doesNotMatch(JSON.stringify(storage.transaction((tx) => tx.all('SELECT * FROM audit_records'))), /private input/);
});

test('caught SQL failures make the whole transaction rollback-only', (t) => {
  const storage = new SqliteStorage(':memory:'); t.after(() => storage.close());
  storage.registerMigrations('sticky', ['comp_'], [sqlMigration(1, 'CREATE TABLE comp_sticky (id INTEGER PRIMARY KEY);')]);
  assert.throws(() => storage.transaction((tx) => {
    tx.run('INSERT INTO comp_sticky VALUES (1)');
    assert.throws(() => tx.run('INSERT INTO comp_sticky VALUES (1)'));
    assert.throws(() => tx.run('INSERT INTO comp_sticky VALUES (2)'));
  }));
  assert.deepEqual(storage.transaction((tx) => tx.all('SELECT * FROM comp_sticky')), []);
  assert.throws(() => storage.transaction((tx) => {
    tx.run('INSERT INTO comp_sticky VALUES (3)');
    assert.throws(() => storage.transaction((inner) => inner.run('INSERT INTO comp_sticky VALUES (3)')));
  }));
  assert.deepEqual(storage.transaction((tx) => tx.all('SELECT * FROM comp_sticky')), []);
});

test('async migration callbacks and delayed SQL never become successful migration history', async (t) => {
  const storage = new SqliteStorage(':memory:'); t.after(() => storage.close());
  let escaped: Parameters<Parameters<SqliteStorage['transaction']>[0]>[0] | undefined;
  assert.throws(() => storage.registerMigrations('async', ['comp_'], [{
    version: 1, checksum: 'async-test', async apply(tx) {
      escaped = tx;
      tx.run('CREATE TABLE comp_async (id INTEGER)');
      await Promise.resolve();
      tx.run('INSERT INTO comp_async VALUES (1)');
    },
  }]), { code: 'bad_request' });
  await Promise.resolve();
  assert.throws(() => escaped!.run('CREATE TABLE comp_delayed (id INTEGER)'), { code: 'bad_request' });
  assert.deepEqual(storage.transaction((tx) => tx.all("SELECT * FROM platform_migrations WHERE module_id = 'async'")), []);
  assert.deepEqual(storage.transaction((tx) => tx.all("SELECT name FROM sqlite_master WHERE name IN ('comp_async', 'comp_delayed')")), []);
});

test('migration validates foreign key structure before recording success', (t) => {
  const storage = new SqliteStorage(':memory:'); t.after(() => storage.close());
  assert.throws(() => storage.registerMigrations('invalid_fk', ['comp_'], [sqlMigration(1, 'CREATE TABLE comp_parent (id INTEGER); CREATE TABLE comp_child (parent INTEGER REFERENCES comp_parent(id));')]));
  assert.deepEqual(storage.transaction((tx) => tx.all("SELECT * FROM platform_migrations WHERE module_id = 'invalid_fk'")), []);
  assert.deepEqual(storage.transaction((tx) => tx.all("SELECT name FROM sqlite_master WHERE name IN ('comp_parent', 'comp_child')")), []);
});

test('SecretStore writes only stdin, never credential argv, fails closed and never accesses real keychain', async () => {
  const calls: { file: string; args: string[]; input?: string }[] = [];
  const secret = 'very-private-credential';
  const store = createSecretStore(async (file, args, input) => { calls.push({ file, args, input }); return { code: 0, stdout: secret + '\n' }; }, 'darwin');
  await store.set('local-api-token', secret);
  assert.deepEqual(calls[0].args, ['-i']);
  assert.match(calls[0].input!, /add-generic-password -U -s work-agent/);
  assert.ok(calls[0].input!.includes(secret));
  assert.ok(!calls[0].args.join(' ').includes(secret));
  assert.equal(await store.get('local-api-token'), secret);
  await store.delete('local-api-token');
  assert.equal(calls[1].args[0], 'find-generic-password');
  assert.equal(calls[2].args[0], 'delete-generic-password');
  assert.equal(calls[0].file, '/usr/bin/security');
  await assert.rejects(store.set('key', 'credential\ncommand'), { code: 'bad_request' });
  const missing = createSecretStore(async () => ({ code: 44, stdout: '' }), 'darwin');
  assert.equal(await missing.get('missing'), undefined);
  const denied = createSecretStore(async () => ({ code: 1, stdout: '' }), 'darwin');
  await assert.rejects(denied.get('key'), { code: 'internal' });
  const unsupported = createSecretStore(async () => { throw new Error('must not execute'); }, 'win32');
  await assert.rejects(unsupported.get('key'), (e) => e instanceof ContractError && e.code === 'unsupported');
});

test('unsupported credential store refuses daemon startup and releases instance lock', async (t) => {
  const dir = directory(t);
  const config = loadConfig({ WORK_AGENT_DATA_DIR: dir });
  config.portRange = [0, 0];
  const secrets = createSecretStore(async () => { throw new Error('must not run'); }, 'win32');
  await assert.rejects(startDaemon({ config, secrets, log: createLogger({ write: () => {} }) }), { code: 'unsupported' });
  assert.equal(existsSync(path.join(config.runDir, 'daemon.lock')), false);
  assert.equal(existsSync(path.join(config.runDir, 'daemon.json')), false);
});

test('JSON logs redact sensitive nested fields and invalid event names', () => {
  const lines: string[] = [];
  const log = createLogger({ write: (line) => lines.push(line), now: () => 123 });
  log.info('http.request', { status: 200, authorization: 'Bearer private-token', nested: [{ text: 'chat original', title: 'notice original', body: 'memory original', message: 'private input', facts: [{ value: 'private fact' }] }] });
  log.warn('not an event body');
  assert.doesNotMatch(lines.join(''), /private-token|chat original|notice original|memory original|private input|private fact|not an event body/);
  assert.equal(JSON.parse(lines[0]).at, 123);
  assert.match(lines[1], /invalid_event/);
});

test('single-instance lock rejects active PID, takes stale lock, daemon.json atomic and credential-free', (t) => {
  const dir = directory(t);
  const release = acquireLock(dir);
  assert.throws(() => acquireLock(dir), { code: 'conflict' });
  release();
  writeFileSync(path.join(dir, 'daemon.lock'), '998877');
  const releaseStale = acquireLock(dir, process.pid, () => false);
  assert.equal(readFileSync(path.join(dir, 'daemon.lock'), 'utf8'), String(process.pid));
  const info = { pid: process.pid, port: 8790, startedAt: 123, version: '0.1.0', protocol: 1 as const };
  writeDaemonInfo(dir, info);
  assert.deepEqual(JSON.parse(readFileSync(path.join(dir, 'daemon.json'), 'utf8')), info);
  atomicWrite(path.join(dir, 'daemon.json'), JSON.stringify(info));
  assert.equal(readdirSync(dir).filter((f) => f.endsWith('.tmp')).length, 0);
  removeDaemonInfo(dir); releaseStale();
  assert.equal(readdirSync(dir).length, 0);
});
