import { appendFileSync } from 'node:fs';
import type { Logger } from '../contracts/index.ts';

const forbidden = /token|authorization|password|secret|credential|text|body|message|facts|title|content|description|catchphrase|taboo|why|nextstep/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) result[key] = forbidden.test(key) ? '[REDACTED]' : redact(item);
    return result;
  }
  return value;
}

export function createLogger(options: { file?: string; write?: (line: string) => void; now?: () => number } = {}): Logger {
  const write = options.write ?? (options.file
    ? (line: string) => appendFileSync(options.file!, line, { mode: 0o600 })
    : (line: string) => { process.stderr.write(line); });
  const emit = (level: string, event: string, fields?: Record<string, unknown>) => {
    const safeEvent = /^[a-zA-Z0-9_.-]{1,80}$/.test(event) ? event : 'invalid_event';
    write(JSON.stringify({ at: (options.now ?? Date.now)(), level, event: safeEvent, fields: redact(fields ?? {}) }) + '\n');
  };
  return { info: (event, fields) => emit('info', event, fields), warn: (event, fields) => emit('warn', event, fields), error: (event, fields) => emit('error', event, fields) };
}
