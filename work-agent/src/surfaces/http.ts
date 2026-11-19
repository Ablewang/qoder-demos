import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { ContractError, LOCAL_API_PREFIX, LOCAL_API_PROTOCOL, OWNER_ACTOR } from '../contracts/index.ts';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { CompanionService, CompanionSettings, Logger, MemoryModule, Notice, NoticeRecord, NoticeStatus, Persona, PetInteraction, QuietReason, Reminder, UserEvidenceType, ChatChunk } from '../contracts/index.ts';
import { noticeSummary } from './events.ts';
import type { EventHub } from './events.ts';

interface CompanionAccess extends CompanionService {
  personaView(): { persona: Persona; firstRun: boolean };
  onClientConnected(): void;
  settings(): CompanionSettings;
  updateSettings(patch: Partial<CompanionSettings>, by: typeof OWNER_ACTOR): CompanionSettings;
}
interface NoticeAccess {
  submit(notice: Notice, from: { kind: 'system'; component: string }): Promise<NoticeRecord>;
  list(opts?: { status?: NoticeStatus; limit?: number }): NoticeRecord[];
  read(id: string): Promise<NoticeRecord>;
  snooze(id: string, minutes?: number): Promise<NoticeRecord>;
  dismiss(id: string): Promise<NoticeRecord>;
}
interface ReminderAccess { list(status?: Reminder['status']): Reminder[]; create(text: string, dueAt: number): Reminder; cancel(id: string): Reminder }
interface SurfaceDeps {
  token: string; origins: string[]; version: string; startedAt: number;
  log: Logger; companion: CompanionAccess; memory: MemoryModule; notices: NoticeAccess; reminders: ReminderAccess;
  evidence: { register(type: UserEvidenceType): string };
  events: EventHub;
  now(): number;
}

const bad = (message = 'invalid request fields'): never => { throw new ContractError('bad_request', message); };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return bad();
  return value as Record<string, unknown>;
}
function string(value: unknown, max?: number): string {
  if (typeof value !== 'string' || (max !== undefined && [...value].length > max)) return bad();
  return value;
}
function memoryText(value: unknown): string {
  const text = string(value, 200);
  if ([...text.trim()].length < 2) bad('invalid memory text length');
  if (/密码|token|密钥|sk-|[a-zA-Z0-9]{20,}/i.test(text)) throw new ContractError('rejected', 'credential-like text is not allowed');
  return text;
}
function number(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value)) return bad(); return value; }
function keys(value: Record<string, unknown>, allowed: string[]): void { if (Object.keys(value).some((key) => !allowed.includes(key))) bad(); }
function limit(raw: string | null, fallback = 100): number {
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 1000) bad('invalid limit');
  return Number(raw);
}
function sensitivity(value: unknown): 'normal' | 'confidential' {
  if (value !== undefined && value !== 'normal' && value !== 'confidential') bad();
  return value === 'confidential' ? 'confidential' : 'normal';
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  if (Number(req.headers['content-length'] ?? 0) > 65536) bad('request body exceeds 64 KB');
  return new Promise((resolve, reject) => {
    let finished = false;
    const fail = (message: string) => { if (!finished) { finished = true; reject(new ContractError('bad_request', message)); } };
    req.on('data', (chunk: Buffer) => {
      if (finished) return;
      size += chunk.length;
      if (size > 65536) { fail('request body exceeds 64 KB'); return; }
      chunks.push(chunk);
    });
    req.on('aborted', () => fail('request interrupted'));
    req.on('error', () => fail('request interrupted'));
    req.on('end', () => {
      if (finished) return;
      try { const parsed = size ? object(JSON.parse(Buffer.concat(chunks).toString('utf8'))) : {}; finished = true; resolve(parsed); }
      catch { fail('invalid JSON body'); }
    });
  });
}
function validInteraction(value: Record<string, unknown>): PetInteraction {
  const kind = value.kind;
  const simple = ['click', 'double_click', 'pet', 'drag_start', 'hover', 'feed', 'audio_pause', 'audio_play'];
  if (typeof kind !== 'string') bad();
  if (simple.includes(kind as string)) { keys(value, ['kind']); return value as unknown as PetInteraction; }
  if (kind === 'poke') { keys(value, ['kind', 'times']); if (!Number.isInteger(value.times) || number(value.times) < 3 || number(value.times) > 1000) bad(); }
  else if (kind === 'drop') { keys(value, ['kind', 'screenEdge']); if (value.screenEdge !== undefined && !['left', 'right', 'top', 'bottom'].includes(string(value.screenEdge))) bad(); }
  else if (kind === 'play') { keys(value, ['kind', 'activityId']); if (!['play_ball', 'stretch', 'music_nod', 'read_notebook', 'box_peek'].includes(string(value.activityId))) bad(); }
  else if (kind === 'utterance_dismissed') { keys(value, ['kind', 'id']); string(value.id, 100); }
  else bad();
  return value as unknown as PetInteraction;
}

export interface HttpSurface { server: Server; listen(first: number, last?: number): Promise<number>; stop(): Promise<void> }

export function createHttpSurface(deps: SurfaceDeps): HttpSurface {
  let port = 0;
  const token = Buffer.from(deps.token, 'utf8');
  const json = (res: ServerResponse, value: unknown, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
  const server = createServer((req, res) => {
    const began = performance.now();
    res.on('finish', () => deps.log.info('http.request', { status: res.statusCode, durationMs: Math.round(performance.now() - began) }));
    void (async () => {
      if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host ?? '')) { json(res, { error: { code: 'forbidden', message: 'host forbidden' } }, 403); return; }
      const origin = req.headers.origin;
      if (origin && !deps.origins.includes(origin)) { json(res, { error: { code: 'forbidden', message: 'origin forbidden' } }, 403); return; }
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Last-Event-ID');
        res.writeHead(204); res.end(); return;
      }
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
      const endpoint = url.pathname.startsWith(LOCAL_API_PREFIX + '/') ? url.pathname.slice(LOCAL_API_PREFIX.length) : '';
      if (!(req.method === 'GET' && endpoint === '/health')) {
        const raw = req.headers.authorization;
        const received = typeof raw === 'string' && raw.startsWith('Bearer ') ? Buffer.from(raw.slice(7), 'utf8') : Buffer.alloc(0);
        const candidate = Buffer.alloc(token.length); received.copy(candidate, 0, 0, token.length);
        const equal = timingSafeEqual(token, candidate);
        if (received.length !== token.length || !equal) { json(res, { error: { code: 'unauthorized', message: 'authentication required' } }, 401); return; }
      }
      if (req.method === 'GET' && endpoint === '/health') { json(res, { ok: true, version: deps.version, protocol: LOCAL_API_PROTOCOL, startedAt: deps.startedAt }); return; }
      if (req.method === 'GET' && endpoint === '/stream') { deps.events.connect(req, res); deps.companion.onClientConnected(); return; }
      const write = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? '');
      const input = write ? await body(req) : {};
      const evidenceId = write && endpoint !== '/chat' ? deps.evidence.register('local_edit') : undefined;
      const operation = `${req.method} ${endpoint}`;
      let value: unknown;
      if (operation === 'GET /pet/state') value = deps.companion.state();
      else if (operation === 'GET /pet/persona') value = deps.companion.personaView();
      else if (operation === 'PUT /pet/persona') { deps.companion.updatePersona(input as Partial<Persona>, OWNER_ACTOR); value = deps.companion.personaView(); }
      else if (operation === 'POST /pet/interactions') value = { utterance: await deps.companion.onInteraction(validInteraction(input)) };
      else if (operation === 'POST /pet/quiet') {
        keys(input, ['mode', 'minutes']);
        if (!['dnd', 'demo', 'off'].includes(string(input.mode))) bad();
        const minutes = input.minutes === undefined ? undefined : number(input.minutes);
        if (minutes !== undefined && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)) bad();
        deps.companion.setQuiet({ source: 'user', reasons: input.mode === 'off' ? [] : [input.mode === 'demo' ? 'screen_share' : 'user_dnd'], detection: 'known', ...(minutes && input.mode !== 'off' ? { expiresAt: deps.now() + minutes * 60_000 } : {}) });
        value = deps.companion.state();
      } else if (operation === 'POST /pet/quiet/client') {
        keys(input, ['reasons', 'detection', 'ttlMs']);
        if (!Array.isArray(input.reasons) || input.reasons.some((r) => !['meeting', 'screen_share', 'fullscreen'].includes(String(r))) || !['known', 'unknown'].includes(string(input.detection)) || number(input.ttlMs) < 1 || number(input.ttlMs) > 120_000) bad();
        deps.companion.setQuiet({ source: 'client', reasons: input.reasons as QuietReason[], detection: input.detection as 'known' | 'unknown', expiresAt: deps.now() + number(input.ttlMs) }); value = deps.companion.state();
      } else if (operation === 'PUT /pet/audio') {
        keys(input, ['enabled', 'volume']); if (typeof input.enabled !== 'boolean') bad();
        deps.companion.setAudio({ enabled: input.enabled as boolean, volume: number(input.volume) }, OWNER_ACTOR); value = deps.companion.state();
      } else if (operation === 'GET /pet/settings') value = deps.companion.settings();
      else if (operation === 'PUT /pet/settings') value = deps.companion.updateSettings(input as Partial<CompanionSettings>, OWNER_ACTOR);
      else if (operation === 'POST /notices') {
        keys(input, ['sensitivity', 'evidence', 'kind', 'title', 'facts', 'body', 'why', 'nextStep', 'tone', 'links', 'urgency', 'dedupeKey', 'channels']);
        const notice = input as unknown as Notice;
        if (typeof notice.kind !== 'string' || !notice.kind.startsWith('dev.')) throw new ContractError('rejected', 'local API only accepts development notices');
        value = await deps.notices.submit(notice, { kind: 'system', component: 'local-api' });
      } else if (operation === 'GET /notices') value = { items: deps.notices.list({ status: (url.searchParams.get('status') || undefined) as NoticeStatus | undefined, limit: limit(url.searchParams.get('limit')) }).map(noticeSummary) };
      else if (req.method === 'POST' && /^\/notices\/[^/]+\/(read|snooze|dismiss)$/.test(endpoint)) {
        const [, , id, action] = endpoint.split('/');
        if (action === 'snooze') { keys(input, ['minutes']); value = await deps.notices.snooze(id, input.minutes === undefined ? undefined : number(input.minutes)); }
        else { keys(input, []); value = action === 'read' ? await deps.notices.read(id) : await deps.notices.dismiss(id); }
      } else if (operation === 'GET /reminders') value = { items: deps.reminders.list((url.searchParams.get('status') || undefined) as Reminder['status'] | undefined) };
      else if (operation === 'POST /reminders') { keys(input, ['text', 'dueAt']); value = deps.reminders.create(string(input.text, 100), number(input.dueAt)); }
      else if (req.method === 'DELETE' && /^\/reminders\/[^/]+$/.test(endpoint)) value = deps.reminders.cancel(endpoint.split('/')[2]);
      else if (operation === 'GET /memory/journal') {
        const date = url.searchParams.get('date');
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime()) || new Date(date).toISOString().slice(0, 10) !== date) bad('invalid journal date');
        value = { items: deps.memory.journal(date!) };
      } else if (operation === 'GET /memory') {
        const layer = url.searchParams.get('layer');
        if (layer && !['profile', 'long_term', 'journal'].includes(layer)) bad();
        const q = url.searchParams.get('q');
        const max = limit(url.searchParams.get('limit'));
        const typed = layer as 'profile' | 'long_term' | 'journal' | null;
        value = { items: q ? deps.memory.search(q, { ...(typed ? { layers: [typed] } : {}), limit: max }) : deps.memory.list({ ...(typed ? { layer: typed } : {}), includeExpired: true, limit: max }) };
      } else if (operation === 'POST /memory/reindex') {
        keys(input, []); deps.memory.reindex(); value = { ok: true };
      } else if (operation === 'POST /memory') {
        keys(input, ['layer', 'kind', 'text', 'sensitivity', 'validUntil']);
        if (!['profile', 'long_term'].includes(string(input.layer)) || !['rule', 'fact'].includes(string(input.kind))) bad();
        const until = input.validUntil === undefined ? undefined : number(input.validUntil);
        value = deps.memory.remember({ layer: input.layer as 'profile' | 'long_term', kind: input.kind as 'rule' | 'fact', text: memoryText(input.text), sensitivity: sensitivity(input.sensitivity), ...(until !== undefined ? { validUntil: until } : {}), origin: { kind: 'user', evidenceType: 'local_edit', evidenceId: evidenceId! } });
      } else if (req.method === 'POST' && /^\/memory\/[^/]+\/retype$/.test(endpoint)) {
        keys(input, ['kind']); if (!['rule', 'fact'].includes(string(input.kind))) bad();
        value = deps.memory.retype(endpoint.split('/')[2], input.kind as 'rule' | 'fact', OWNER_ACTOR, evidenceId!);
      } else if (req.method === 'PATCH' && /^\/memory\/[^/]+$/.test(endpoint)) {
        keys(input, ['text', 'sensitivity', 'validUntil']);
        const patch: { text?: string; sensitivity?: 'normal' | 'confidential'; validUntil?: number } = {};
        if (input.text !== undefined) patch.text = memoryText(input.text);
        if (input.sensitivity !== undefined) patch.sensitivity = sensitivity(input.sensitivity);
        if (input.validUntil !== undefined) patch.validUntil = input.validUntil === null ? undefined : number(input.validUntil);
        value = deps.memory.update(endpoint.split('/')[2], patch, OWNER_ACTOR, evidenceId!);
      } else if (req.method === 'DELETE' && /^\/memory\/[^/]+$/.test(endpoint)) { deps.memory.forget(endpoint.split('/')[2], OWNER_ACTOR, evidenceId); value = { ok: true }; }
      else if (operation === 'POST /chat') {
        keys(input, ['message', 'conversationId']);
        const message = string(input.message); if (!message.trim()) bad();
        const conversationId = input.conversationId === undefined ? undefined : string(input.conversationId, 100);
        const chunks: ChatChunk[] = [];
        for await (const chunk of deps.companion.chat(message, conversationId)) chunks.push(chunk);
        const done = chunks.findLast((c) => c.kind === 'done');
        value = { conversationId: done?.kind === 'done' ? done.conversationId : conversationId, chunks };
      } else { throw new ContractError('not_found', 'endpoint not found'); }
      json(res, value);
    })().catch((error: unknown) => {
      if (res.headersSent) { res.end(); return; }
      const code = error instanceof ContractError ? error.code : 'internal';
      const status = { bad_request: 400, not_found: 404, conflict: 409, rejected: 422, tombstoned: 409, unsupported: 501, internal: 500 }[code];
      const responseCode = code === 'tombstoned' ? 'conflict' : code;
      deps.log.warn('http.error', { code: responseCode, status });
      json(res, { error: { code: responseCode, message: responseCode === 'internal' ? 'request failed' : responseCode.replaceAll('_', ' ') } }, status);
    });
  });
  server.requestTimeout = 15_000; server.headersTimeout = 10_000;
  return {
    server,
    async listen(first, last = first) {
      for (let candidate = first; candidate <= last; candidate++) {
        try {
          await new Promise<void>((resolve, reject) => {
            const onError = (error: Error) => { server.off('listening', onListening); reject(error); };
            const onListening = () => { server.off('error', onError); resolve(); };
            server.once('error', onError); server.once('listening', onListening); server.listen(candidate, '127.0.0.1');
          });
          port = (server.address() as { port: number }).port;
          return port;
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || candidate === last) throw error; }
      }
      throw new ContractError('internal', 'all configured ports unavailable');
    },
    async stop() {
      deps.events.stop();
      await new Promise<void>((resolve) => { if (!server.listening) return resolve(); server.close(() => resolve()); server.closeIdleConnections(); });
    },
  };
}
