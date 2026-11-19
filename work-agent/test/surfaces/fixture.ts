import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { request } from 'node:http';
import { startDaemon } from '../../src/daemon.ts';
import { loadConfig } from '../../src/platform/config.ts';
import { createLogger } from '../../src/platform/logger.ts';
import type { TestContext } from 'node:test';
import type { PetUtterance, StreamEvent } from '../../src/contracts/index.ts';

export async function fixture(t: TestContext, retention?: number) {
  const dir = mkdtempSync(path.join(tmpdir(), 'wa-brain-test-'));
  const token = randomBytes(32).toString('base64url');
  let time = new Date('2026-11-20T12:00:00+08:00').getTime();
  const logs: string[] = [];
  const config = loadConfig({ WORK_AGENT_DATA_DIR: dir, WORK_AGENT_DEV_ORIGINS: 'http://localhost:1420' });
  config.portRange = [0, 0];
  const daemon = await startDaemon({ config, now: () => time, secrets: { get: async () => token, set: async () => { throw new Error('unexpected secret write'); }, delete: async () => {} }, log: createLogger({ write: (line) => logs.push(line) }), random: () => 0, eventRetention: retention });
  t.after(async () => { await daemon.stop(); rmSync(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${daemon.info.port}/api/v1`;
  const call = async (endpoint: string, method = 'GET', value?: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(`${base}${endpoint}`, { method, headers: { Authorization: `Bearer ${token}`, ...(value !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(value !== undefined ? { body: JSON.stringify(value) } : {}) });
    const data: unknown = res.status === 204 ? null : await res.json();
    return { status: res.status, headers: res.headers, data };
  };
  const events = (): StreamEvent[] => daemon.storage.transaction((tx) => tx.all('SELECT type, data_json FROM ui_events ORDER BY id').map((r) => ({ type: r.type, data: JSON.parse(String(r.data_json)) }) as StreamEvent));
  const bubbles = (): PetUtterance[] => events().flatMap((e) => e.type === 'pet.utterance' ? [e.data.utterance] : []);
  return { ...daemon, dir, token, base, logs, call, eventHub: daemon.events, events, bubbles, now: () => time, advance: (ms: number) => { time += ms; } };
}

export async function openStream(base: string, token: string, last?: number) {
  let source = '';
  const listeners = new Set<() => void>();
  const req = request(`${base}/stream`, { headers: { Authorization: `Bearer ${token}`, ...(last !== undefined ? { 'Last-Event-ID': String(last) } : {}) } });
  await new Promise<void>((resolve, reject) => {
    req.once('error', reject);
    req.once('response', (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => { source += chunk; for (const listen of listeners) listen(); });
      res.once('data', () => resolve());
    });
    req.end();
  });
  return {
    text: () => source,
    close: () => req.destroy(),
    until(predicate: (text: string) => boolean) {
      if (predicate(source)) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const listener = () => { if (predicate(source)) { clearTimeout(timeout); listeners.delete(listener); resolve(); } };
        const timeout = setTimeout(() => { listeners.delete(listener); reject(new Error('SSE event timeout')); }, 3000);
        listeners.add(listener);
      });
    },
  };
}
