import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/platform/config.ts';
import { createSecretStore } from '../src/platform/secrets.ts';
import { newId } from '../src/platform/ids.ts';
import { KEYCHAIN_TOKEN_ACCOUNT, LOCAL_API_PREFIX } from '../src/contracts/index.ts';
import type { DaemonInfo, Notice, NoticeFact } from '../src/contracts/index.ts';

export function parseFact(raw: string): NoticeFact {
  const split = raw.indexOf('=');
  if (split < 1 || split === raw.length - 1) throw new Error('invalid fact');
  const label = raw.slice(0, split);
  const rest = raw.slice(split + 1);
  const colon = rest.lastIndexOf(':');
  const value = colon > 0 ? rest.slice(0, colon) : rest;
  const unit = colon > 0 ? rest.slice(colon + 1) : undefined;
  return { label, value: /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) ? Number(value) : value, ...(unit ? { unit } : {}) };
}

export async function notify(args: string[] = process.argv.slice(2)): Promise<void> {
  const { values } = parseArgs({ args, options: { title: { type: 'string' }, fact: { type: 'string', multiple: true }, tone: { type: 'string', default: 'neutral' }, urgency: { type: 'string', default: 'normal' }, why: { type: 'string' }, 'next-step': { type: 'string' }, dedupe: { type: 'string' }, kind: { type: 'string', default: 'dev.test' }, sensitivity: { type: 'string', default: 'normal' } } });
  if (!values.title) throw new Error('title required');
  const config = loadConfig();
  const info = JSON.parse(readFileSync(path.join(config.runDir, 'daemon.json'), 'utf8')) as DaemonInfo;
  if (!Number.isInteger(info.port) || info.port < 1 || info.port > 65535 || info.protocol !== 1) throw new Error('invalid daemon discovery');
  const token = await createSecretStore().get(KEYCHAIN_TOKEN_ACCOUNT);
  if (!token) throw new Error('daemon credential missing');
  const notice: Notice = { title: values.title, facts: (values.fact ?? []).map(parseFact), tone: values.tone as Notice['tone'], urgency: values.urgency as Notice['urgency'], sensitivity: values.sensitivity as Notice['sensitivity'], dedupeKey: values.dedupe ?? newId('dev'), kind: values.kind, evidence: [], ...(values.why ? { why: values.why } : {}), ...(values['next-step'] ? { nextStep: values['next-step'] } : {}) };
  const base = `http://127.0.0.1:${info.port}${LOCAL_API_PREFIX}`;
  const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
  if (!health.ok || (await health.json() as { startedAt: number }).startedAt !== info.startedAt) throw new Error('daemon discovery stale');
  const response = await fetch(`${base}/notices`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(notice), signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`notification rejected (${response.status})`);
  const result = await response.json() as { id: string; count: number };
  process.stdout.write(JSON.stringify({ ok: true, id: result.id, count: result.count }) + '\n');
}

if (import.meta.main) {
  try { await notify(); }
  catch { process.stderr.write('notify failed: check daemon discovery, credential and notification arguments\n'); process.exitCode = 1; }
}
