import { createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { countChars, requestSchema, responseSchema } from '../src/contract.js';
import { ApiError, callModel, readModelConfig, type Environment } from './model.js';
import { ambiguousThreat, localSafety } from './safety.js';

export type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
export interface Limits { perMinute: number; perDay: number; modelAttemptsPerDay: number; concurrency: number }
export interface AppOptions {
  env?: Environment;
  fetch?: typeof fetch;
  now?: () => number;
  limits?: Partial<Limits>;
  timeoutMs?: number;
  fallback?: Middleware;
}

const messages: Record<string, string> = {
  BAD_REQUEST: '请求格式不正确，请检查输入后重试。',
  TEXT_EMPTY: '写一句你想说的话。',
  TEXT_TOO_LONG: '请控制在 300 字以内。',
  BODY_TOO_LARGE: '请求内容过大，请控制在 300 字以内。',
  UNSUPPORTED_MEDIA_TYPE: '请使用 JSON 格式提交。',
  FORBIDDEN: '仅允许本机同源访问。',
  NOT_FOUND: '没有这个接口或资源。',
  METHOD_NOT_ALLOWED: '不支持此请求方法。',
  RATE_LIMITED: '请求太频繁，请稍后再试。',
  SERVER_BUSY: '翻译服务正忙，请稍后再试。',
  DAILY_QUOTA: '今天的模型额度已用完，请明天再试。',
  AI_NOT_CONFIGURED: 'AI 未配置，暂时无法实时翻译。',
  MODEL_REFUSED: '模型未能处理这段内容，本次不提供改写。若涉及伤害，请先寻求安全支持。',
  MODEL_BAD_OUTPUT: '模型返回内容未通过校验，本次不展示改写。',
  MODEL_UNAVAILABLE: '模型服务暂时不可用，请稍后再试。',
  MODEL_TIMEOUT: '模型响应超时，请稍后再试。',
  REQUEST_TIMEOUT: '请求超时，请重新提交。',
  REQUEST_CANCELLED: '请求已取消。',
  INTERNAL_ERROR: '服务暂时不可用，请稍后再试。',
};

export function sendJson(res: ServerResponse, status: number, value: unknown): void {
  if (res.destroyed || res.writableEnded) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.removeHeader('Access-Control-Allow-Origin');
  res.end(JSON.stringify(value));
}

export function sendError(res: ServerResponse, error: ApiError): void {
  sendJson(res, error.status, { error: { code: error.code, message: messages[error.code] ?? messages.INTERNAL_ERROR } });
}

function singleHeader(req: IncomingMessage, name: string): boolean {
  let count = 0;
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    if (req.rawHeaders[i]?.toLowerCase() === name) count++;
  }
  return count <= 1;
}

export function allowedRequest(req: IncomingMessage): boolean {
  if (!singleHeader(req, 'host') || !singleHeader(req, 'origin') || !singleHeader(req, 'sec-fetch-site')) return false;
  const host = req.headers.host;
  if (!host || !/^(?:127\.0\.0\.1|localhost|\[::1\]):[1-9]\d{0,4}$/iu.test(host)) return false;
  if (Number(host.slice(host.lastIndexOf(':') + 1)) !== req.socket.localPort) return false;
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== `http://${host}`) return false;
  const site = req.headers['sec-fetch-site'];
  return site === undefined || site === 'same-origin' || site === 'none';
}

// Runs ahead of Vite, including ?raw/?import, @fs, encoded and traversal paths.
export function safePath(rawUrl: string): string | undefined {
  if (!rawUrl.startsWith('/') || rawUrl.startsWith('//')) return undefined;
  let pathname = rawUrl.split(/[?#]/u, 1)[0] ?? '';
  for (let i = 0; i < 5; i++) {
    let decoded: string;
    try { decoded = decodeURIComponent(pathname); } catch { return undefined; }
    if (decoded === pathname) break;
    pathname = decoded;
    if (i === 4) return undefined;
  }
  if (/[\\\u0000-\u001f\u007f?#]/u.test(pathname)) return undefined;
  const segments = pathname.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..'
    || /^\.env/iu.test(segment)
    || /^(?:server|tests|dist-server)$/iu.test(segment)
    || /^(?:PLAN|PRD)(?:\.|$)/iu.test(segment)
    || (segment.startsWith('.') && segment !== '.vite' && segment !== '.pnpm'))) return undefined;
  return pathname;
}

interface Counter { minute: number[]; daily: number }
class RateLimiter {
  private day = '';
  private salt = randomBytes(32);
  private readonly addresses = new Map<string, Counter>();
  private modelAttempts = 0;
  private active = 0;
  constructor(private readonly limits: Limits, private readonly now: () => number) {}

  private rollDay(time: number): void {
    const day = new Date(time).toISOString().slice(0, 10);
    if (day !== this.day) {
      this.day = day;
      this.salt = randomBytes(32);
      this.addresses.clear();
      this.modelAttempts = 0;
      // In-flight work still counts towards concurrency across midnight.
    }
  }

  accept(ip: string): void {
    const time = this.now();
    this.rollDay(time);
    const hash = createHash('sha256').update(this.salt).update(ip).digest('hex');
    const counter = this.addresses.get(hash) ?? { minute: [], daily: 0 };
    counter.minute = counter.minute.filter((stamp) => stamp > time - 60_000);
    if (counter.minute.length >= this.limits.perMinute || counter.daily >= this.limits.perDay) {
      throw new ApiError(429, 'RATE_LIMITED');
    }
    counter.minute.push(time);
    counter.daily++;
    this.addresses.set(hash, counter);
  }

  beginModel(): () => void {
    this.rollDay(this.now());
    if (this.modelAttempts >= this.limits.modelAttemptsPerDay) throw new ApiError(503, 'DAILY_QUOTA');
    if (this.active >= this.limits.concurrency) throw new ApiError(429, 'SERVER_BUSY');
    this.modelAttempts++;
    this.active++;
    return () => { this.active--; };
  }
}

function readBody(req: IncomingMessage, res: ServerResponse): Promise<unknown> {
  const max = 8 * 1024;
  const length = req.headers['content-length'];
  if (length && (!/^\d+$/u.test(length) || Number(length) > max)) {
    res.setHeader('Connection', 'close');
    req.resume();
    return Promise.reject(new ApiError(413, 'BODY_TOO_LARGE'));
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks: Buffer[] = [];
    const finish = (error?: ApiError, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req.removeListener('data', data);
      req.removeListener('end', end);
      req.removeListener('aborted', aborted);
      req.removeListener('error', aborted);
      if (error) { req.resume(); reject(error); } else resolve(value);
    };
    const data = (chunk: Buffer) => {
      size += chunk.length;
      if (size > max) {
        res.setHeader('Connection', 'close');
        finish(new ApiError(413, 'BODY_TOO_LARGE'));
      } else chunks.push(chunk);
    };
    const end = () => {
      try {
        finish(undefined, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))));
      } catch { finish(new ApiError(400, 'BAD_REQUEST')); }
    };
    const aborted = () => finish(new ApiError(400, 'BAD_REQUEST'));
    const timer = setTimeout(() => {
      res.setHeader('Connection', 'close');
      finish(new ApiError(408, 'REQUEST_TIMEOUT'));
    }, 10_000);
    req.on('data', data);
    req.once('end', end);
    req.once('aborted', aborted);
    req.once('error', aborted);
  });
}

export function createApp(options: AppOptions = {}): (req: IncomingMessage, res: ServerResponse) => void {
  const config = readModelConfig(options.env ?? process.env);
  const limiter = new RateLimiter({ perMinute: 5, perDay: 50, modelAttemptsPerDay: 1000, concurrency: 3, ...options.limits }, options.now ?? Date.now);
  const transport = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (!allowedRequest(req)) throw new ApiError(403, 'FORBIDDEN');
    const path = safePath(req.url ?? '');
    if (path === undefined) throw new ApiError(403, 'FORBIDDEN');
    if (path === '/api/status') {
      if (req.method !== 'GET') throw new ApiError(405, 'METHOD_NOT_ALLOWED');
      sendJson(res, 200, { configured: Boolean(config) });
      return;
    }
    if (path !== '/api/assist') {
      if (path === '/api' || path.startsWith('/api/')) throw new ApiError(404, 'NOT_FOUND');
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new ApiError(405, 'METHOD_NOT_ALLOWED');
      if (options.fallback) options.fallback(req, res, () => sendError(res, new ApiError(404, 'NOT_FOUND')));
      else throw new ApiError(404, 'NOT_FOUND');
      return;
    }
    if (req.method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED');
    if (!singleHeader(req, 'content-type')
      || !/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/iu.test(req.headers['content-type'] ?? '')
      || (req.headers['content-encoding'] !== undefined && req.headers['content-encoding'] !== 'identity')) {
      throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE');
    }
    const body = await readBody(req, res);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      if (typeof body === 'object' && body !== null && 'text' in body && typeof body.text === 'string') {
        if (!body.text.trim()) throw new ApiError(400, 'TEXT_EMPTY');
        if (countChars(body.text.trim()) > 300) throw new ApiError(400, 'TEXT_TOO_LONG');
      }
      throw new ApiError(400, 'BAD_REQUEST');
    }
    limiter.accept(req.socket.remoteAddress ?? 'unknown');
    const input = parsed.data;
    const safety = localSafety(input.text, input.relation);
    if (safety) {
      sendJson(res, 200, responseSchema.parse({ version: 1, mode: 'soften', source: 'local_safety', result: { kind: 'safety', category: safety } }));
      return;
    }
    if (!config) {
      if (ambiguousThreat(input.text)) {
        sendJson(res, 200, { version: 1, mode: 'soften', source: 'local_safety', result: { kind: 'safety', category: 'uncertain' } });
        return;
      }
      throw new ApiError(503, 'AI_NOT_CONFIGURED');
    }
    const release = limiter.beginModel();
    const disconnected = new AbortController();
    const onClose = () => { if (!res.writableEnded) disconnected.abort(); };
    res.once('close', onClose);
    try {
      const result = await callModel(config, input, transport, timeoutMs, disconnected.signal);
      sendJson(res, 200, responseSchema.parse({ version: 1, mode: 'soften', source: 'model', result }));
    } finally {
      res.removeListener('close', onClose);
      release();
    }
  };
  return (req, res) => {
    // Abrupt socket closure must not become an unhandled stream error or log.
    req.on('error', () => {});
    res.on('error', () => {});
    void handle(req, res).catch((error: unknown) => {
      sendError(res, error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR'));
    });
  };
}
