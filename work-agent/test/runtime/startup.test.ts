import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const launcher = new URL('../../scripts/start.mjs', import.meta.url).href;
type Event = { stage: string; event: string; pid: number; cwd: string; data: string; origins: string; searchPath: string };

async function until(check: () => boolean, message: string): Promise<void> {
  const end = Date.now() + 8000;
  while (!check()) {
    if (Date.now() > end) throw new Error(message);
    await delay(30);
  }
}

async function fixture(t: TestContext, mode = 'normal') {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'work-agent startup ')));
  const pet = path.join(root, 'apps', 'pet');
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`;
  const log = path.join(root, 'events.jsonl');
  mkdirSync(path.join(root, 'src'), { recursive: true });
  mkdirSync(path.join(pet, 'src-tauri'), { recursive: true });
  mkdirSync(path.join(pet, 'node_modules', 'vite', 'bin'), { recursive: true });
  mkdirSync(path.join(pet, 'node_modules', '@tauri-apps', 'cli'), { recursive: true });
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ type: 'module' }));
  writeFileSync(path.join(pet, 'src-tauri', 'tauri.conf.json'), JSON.stringify({ build: { devUrl: origin } }));
  const fake = path.join(root, 'fake.mjs');
  writeFileSync(fake, `
import { appendFileSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
export function run(stage) {
  const log = process.env.START_TEST_LOG;
  const record = (event) => appendFileSync(log, JSON.stringify({ stage, event, pid: process.pid, cwd: process.cwd(), data: process.env.WORK_AGENT_DATA_DIR, origins: process.env.WORK_AGENT_DEV_ORIGINS, searchPath: process.env.PATH }) + '\\n');
  record('start');
  const mode = process.env.START_TEST_MODE;
  if ((stage === 'daemon' && mode === 'daemon-fail') || (stage === 'vite' && mode === 'vite-fail')) process.exit(2);
  if (stage === 'tauri') {
    if (mode === 'desktop-exit') return setTimeout(() => process.exit(0), 150);
    spawn(process.execPath, ['--input-type=module', '--eval', 'import { run } from ' + JSON.stringify(${JSON.stringify(pathToFileURL(fake).href)}) + '; run("grandchild");'], { env: process.env, stdio: 'ignore' });
    setInterval(() => {}, 1000);
    process.once('SIGTERM', () => { record('stop'); process.exit(0); });
    return;
  }
  if (stage === 'grandchild') {
    setInterval(() => {}, 1000);
    process.once('SIGTERM', () => { record('stop'); process.exit(0); });
    return;
  }
  const startedAt = Date.now();
  const runDir = path.join(process.env.WORK_AGENT_DATA_DIR, 'run');
  const server = createServer((req, res) => {
    if (stage === 'daemon') {
      const origin = req.headers.origin;
      const allowed = process.env.WORK_AGENT_DEV_ORIGINS.split(',');
      if (origin && !allowed.includes(origin)) { res.writeHead(403); res.end('{}'); return; }
      if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, version: '0.1.0', protocol: 1, startedAt }));
    } else res.end('vite client ready');
  });
  server.listen(stage === 'daemon' ? 0 : Number(new URL(process.env.START_TEST_ORIGIN).port), '127.0.0.1', () => {
    if (stage === 'daemon') {
      mkdirSync(runDir, { recursive: true });
      writeFileSync(path.join(runDir, 'daemon.json'), JSON.stringify({ pid: process.pid, port: server.address().port, version: '0.1.0', protocol: 1, startedAt }));
    }
    record('ready');
  });
  process.once('SIGTERM', () => server.close(() => {
    if (stage === 'daemon') { try { unlinkSync(path.join(runDir, 'daemon.json')); } catch {} }
    record('stop');
  }));
}
`);
  for (const [file, stage] of [[path.join(root, 'src', 'daemon.ts'), 'daemon'], [path.join(pet, 'node_modules', 'vite', 'bin', 'vite.js'), 'vite'], [path.join(pet, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'), 'tauri']]) {
    writeFileSync(file!, `import { run } from ${JSON.stringify(pathToFileURL(fake).href)}; run(${JSON.stringify(stage)});\n`);
  }
  const processes: { child: ChildProcess; done: Promise<number | null> }[] = [];
  const env = { ...process.env, START_TEST_LOG: log, START_TEST_MODE: mode, START_TEST_ORIGIN: origin, WORK_AGENT_DATA_DIR: path.join(root, 'data'), WORK_AGENT_DEV_ORIGINS: 'http://127.0.0.1:19999', PRIVATE_SENTINEL: 'launcher-synthetic-private' };
  function run(args: string[], extra: Record<string, string> = {}, command = process.execPath) {
    const child = spawn(command, args, { cwd: tmpdir(), env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout!.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr!.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    const done = new Promise<number | null>((resolve) => child.once('exit', resolve));
    processes.push({ child, done });
    return { child, done, output: () => output };
  }
  t.after(async () => {
    for (const { child } of processes) if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await Promise.all(processes.map((entry) => entry.done));
    rmSync(root, { recursive: true, force: true });
  });
  const events = (): Event[] => {
    try { return readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as Event); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  };
  const start = (extra: Record<string, string> = {}) => run(['--input-type=module', '--eval', `import { start } from ${JSON.stringify(launcher)}; process.exitCode = await start(${JSON.stringify(root)});`], extra);
  const externalDaemon = (allowed = origin) => run(['--disable-warning=ExperimentalWarning', path.join(root, 'src', 'daemon.ts')], { WORK_AGENT_DEV_ORIGINS: allowed });
  const shell = () => {
    mkdirSync(path.join(root, 'scripts'));
    writeFileSync(path.join(root, 'scripts', 'start.mjs'), readFileSync(new URL(launcher)));
    writeFileSync(path.join(root, 'start.sh'), readFileSync(new URL('../../start.sh', import.meta.url)));
    return run([path.join(root, 'start.sh')], {}, '/bin/bash');
  };
  return { root, pet, origin, port, events, start, externalDaemon, shell };
}

const options = { timeout: 20_000 };

test('one-command startup sequences services, preserves environment and stops owned process groups', options, async (t) => {
  const f = await fixture(t);
  const worker = f.start({ WORK_AGENT_DATA_DIR: 'relative data' });
  await until(() => f.events().some((event) => event.stage === 'grandchild'), worker.output());
  const started = f.events().filter((event) => event.event === 'start');
  assert.deepEqual(started.map((event) => event.stage), ['daemon', 'vite', 'tauri', 'grandchild']);
  for (const event of started) {
    assert.equal(event.data, path.join(f.root, 'relative data'));
    assert.ok(event.origins.split(',').includes(f.origin));
    assert.ok(event.origins.split(',').includes('http://127.0.0.1:19999'));
    assert.equal(event.searchPath.split(path.delimiter)[0], path.dirname(process.execPath));
  }
  assert.equal(started[0]!.cwd, f.root);
  assert.equal(started[1]!.cwd, f.pet);
  assert.equal(started[2]!.cwd, f.pet);
  worker.child.kill('SIGINT');
  assert.equal(await worker.done, 0, worker.output());
  await until(() => started.every((event) => f.events().some((stopped) => stopped.pid === event.pid && stopped.event === 'stop')), 'owned children did not stop');
  assert.ok(!worker.output().includes('launcher-synthetic-private'));
});

test('compatible existing daemon is reused and survives launcher shutdown', options, async (t) => {
  const f = await fixture(t);
  const external = f.externalDaemon();
  await until(() => f.events().some((event) => event.stage === 'daemon' && event.event === 'ready'), external.output());
  const worker = f.start();
  await until(() => f.events().some((event) => event.stage === 'grandchild'), worker.output());
  assert.equal(f.events().filter((event) => event.stage === 'daemon' && event.event === 'start').length, 1);
  worker.child.kill('SIGTERM');
  assert.equal(await worker.done, 0, worker.output());
  assert.equal(external.child.exitCode, null);
  assert.ok(worker.output().includes('复用已运行的后台'));
  const info = JSON.parse(readFileSync(path.join(f.root, 'data', 'run', 'daemon.json'), 'utf8')) as { port: number };
  assert.equal((await fetch(`http://127.0.0.1:${info.port}/api/v1/health`)).status, 200);
});

test('old daemon rejecting development Origin blocks startup without stopping it', options, async (t) => {
  const f = await fixture(t);
  const external = f.externalDaemon('tauri://localhost');
  await until(() => f.events().some((event) => event.event === 'ready'), external.output());
  const worker = f.start();
  assert.equal(await worker.done, 1);
  assert.ok(worker.output().includes('已有后台未允许开发来源'));
  assert.equal(external.child.exitCode, null);
  assert.deepEqual(f.events().filter((event) => event.event === 'start').map((event) => event.stage), ['daemon']);
});

test('occupied development port is left untouched and no child is launched', options, async (t) => {
  const f = await fixture(t);
  const server = createServer((_req, res) => res.end('existing service'));
  await new Promise<void>((resolve) => server.listen(f.port, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const worker = f.start();
  assert.equal(await worker.done, 1);
  assert.ok(worker.output().includes(`开发端口 ${f.port}`));
  assert.deepEqual(f.events(), []);
  assert.equal(await (await fetch(f.origin)).text(), 'existing service');
});

test('daemon startup failure aborts before frontend or desktop launch', options, async (t) => {
  const f = await fixture(t, 'daemon-fail');
  const worker = f.start();
  assert.equal(await worker.done, 1);
  assert.deepEqual(f.events().filter((event) => event.event === 'start').map((event) => event.stage), ['daemon']);
});

test('frontend failure stops the owned daemon and never opens the desktop', options, async (t) => {
  const f = await fixture(t, 'vite-fail');
  const worker = f.start();
  assert.equal(await worker.done, 1);
  assert.deepEqual(f.events().filter((event) => event.event === 'start').map((event) => event.stage), ['daemon', 'vite']);
  assert.ok(f.events().some((event) => event.stage === 'daemon' && event.event === 'stop'));
});

test('normal desktop exit stops owned services and returns success', options, async (t) => {
  const f = await fixture(t, 'desktop-exit');
  const worker = f.start();
  assert.equal(await worker.done, 0, worker.output());
  assert.deepEqual(f.events().filter((event) => event.event === 'start').map((event) => event.stage), ['daemon', 'vite', 'tauri']);
  assert.ok(f.events().some((event) => event.stage === 'daemon' && event.event === 'stop'));
  assert.ok(f.events().some((event) => event.stage === 'vite' && event.event === 'stop'));
});

test('shell entry starts from another working directory and supports a path with spaces', options, async (t) => {
  const f = await fixture(t, 'desktop-exit');
  const worker = f.shell();
  assert.equal(await worker.done, 0, worker.output());
  assert.deepEqual(f.events().filter((event) => event.event === 'start').map((event) => event.stage), ['daemon', 'vite', 'tauri']);
});

test('invalid discovery is not deleted or used to start processes', options, async (t) => {
  const f = await fixture(t);
  const runDir = path.join(f.root, 'data', 'run');
  mkdirSync(runDir, { recursive: true });
  const file = path.join(runDir, 'daemon.json');
  writeFileSync(file, '{invalid discovery}');
  const worker = f.start();
  assert.equal(await worker.done, 1);
  assert.equal(readFileSync(file, 'utf8'), '{invalid discovery}');
  assert.deepEqual(f.events(), []);
});
