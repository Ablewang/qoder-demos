import express, { type Request, type Response, type NextFunction } from 'express';
import { createHash, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, renameSync, unlinkSync, writeFileSync, openSync, closeSync, fsyncSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AccessLinks, Ask, Family, Followup, Member, Snapshot, Stage, Story } from '../src/shared.ts';
import { ApiError, inspectAudio, MAX_AUDIO_BYTES } from './audio.ts';
import { Store, type Row } from './store.ts';

const DEFAULT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.local-data');
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const COOKIE = 'family_session';
const stages: Stage[] = ['童年', '求学', '工作', '恋爱结婚', '养孩子', '那个年代', '心里话'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
const now = () => new Date().toISOString();
function passcodeHash(value: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(value, salt, 32).toString('hex')}`;
}
function matchesPasscode(value: string, stored: string) {
  const [salt, encoded] = stored.split(':');
  if (!salt || !encoded || !/^[a-f0-9]{64}$/.test(encoded)) return false;
  return timingSafeEqual(scryptSync(value, salt, 32), Buffer.from(encoded, 'hex'));
}
function text(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(400, `${label}不能为空`);
  const trimmed = value.trim();
  if ([...trimmed].length > max) throw new ApiError(413, `${label}过长，最多 ${max} 字`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(trimmed)) throw new ApiError(400, `${label}含无效字符`);
  return trimmed;
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new ApiError(400, '编号无效');
  return value;
}
function token(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new ApiError(404, '链接无效或已失效');
  return value;
}
function kind(value: unknown): 'listener' | 'storyteller' {
  if (value !== 'listener' && value !== 'storyteller') throw new ApiError(400, '邀请类型无效');
  return value;
}
const publicMember = (row: Row): Member => ({ id: row.id, name: row.name, role: row.role, revoked: !!row.revoked });
const publicFamily = (row: Row): Family => ({ id: row.id, name: row.name, storytellerName: row.storytellerName });

export function createApp({ dataDir = DEFAULT_DIR, origin = 'http://127.0.0.1:5215' }: { dataDir?: string; origin?: string } = {}) {
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.origin !== origin || parsedOrigin.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(parsedOrigin.hostname)) throw new Error('APP_ORIGIN 必须是精确的本地 HTTP origin');
  const store = new Store(resolve(dataDir));
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  const anonymous = new Set(['/api/families', '/api/join', '/api/storyteller-session', '/api/preview-invite', '/api/organizer/recover']);
  const rates = new Map<string, { count: number; expires: number }>();
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Pragma': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-site', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), geolocation=()' });
    if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::[0-9]{1,5})?$/.test(req.headers.host ?? '')) return next(new ApiError(403, '只允许回环主机'));
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.origin !== origin) return next(new ApiError(403, '请求来源不被允许'));
    if (req.headers.origin === origin) {
      res.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Vary': 'Origin' });
    }
    if (req.method === 'OPTIONS') {
      res.set({ 'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE', 'Access-Control-Allow-Headers': 'Content-Type, X-Ask-Id, X-Submission-Id, X-Consent, Range', 'Access-Control-Max-Age': '0' });
      return res.status(204).end();
    }
    if (anonymous.has(req.path)) {
      const time = Date.now();
      for (const [key, entry] of rates) if (entry.expires <= time) rates.delete(key);
      const key = `${req.socket.remoteAddress ?? 'unknown'}:${req.path}`;
      const entry = rates.get(key) ?? { count: 0, expires: time + WINDOW_MS };
      entry.count++; rates.set(key, entry);
      if (entry.count > 60) { res.set('Retry-After', String(Math.ceil((entry.expires - time) / 1000))); return next(new ApiError(429, '请求过于频繁，请稍后再试')); }
    }
    next();
  });
  app.use(express.json({ limit: '64kb', strict: true }));
  function authenticate(req: Request): Row {
    const cookie = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!cookie || !/^[A-Za-z0-9_-]{43}$/.test(cookie)) throw new ApiError(401, '登录已过期，请重新进入');
    const member = store.get('SELECT m.*, s.hash AS sessionHash FROM sessions s JOIN members m ON m.id=s.memberId WHERE s.hash=? AND s.expires>? AND m.revoked=0', hash(cookie), Date.now());
    if (!member) throw new ApiError(401, '登录已过期，请重新进入');
    return member;
  }
  function requireRole(member: Row, roles: string[]) { if (!roles.includes(member.role)) throw new ApiError(403, '没有操作权限'); }
  function issueSession(res: Response, memberId: string) {
    const value = secret();
    store.run('DELETE FROM sessions WHERE expires<=?', Date.now());
    store.run('INSERT INTO sessions(hash,memberId,expires) VALUES(?,?,?)', hash(value), memberId, Date.now() + SESSION_MS);
    res.cookie(COOKIE, value, { httpOnly: true, sameSite: 'strict', secure: false, path: '/', maxAge: SESSION_MS });
  }
  function attemptKey(req: Request, credential: unknown) { return hash(`${req.path}:${String(credential).slice(0, 256)}:${req.socket.remoteAddress ?? 'unknown'}`); }
  function checkAttempt(key: string) {
    const row = store.get('SELECT * FROM attempts WHERE key=? AND expires>?', key, Date.now());
    if (row && row.count >= 5) throw new ApiError(429, '错误次数过多，请 15 分钟后再试');
  }
  function failAttempt(key: string): never {
    store.run('DELETE FROM attempts WHERE expires<=?', Date.now());
    store.run('INSERT INTO attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1', key, Date.now() + WINDOW_MS);
    const row = store.get('SELECT count FROM attempts WHERE key=?', key)!;
    throw new ApiError(row.count >= 5 ? 429 : 404, row.count >= 5 ? '错误次数过多，请 15 分钟后再试' : '链接或凭据无效');
  }
  function familyOf(member: Row) { return store.get('SELECT * FROM families WHERE id=?', member.familyId)!; }
  function storyRow(member: Row, storyId: unknown) {
    const row = store.get('SELECT * FROM stories WHERE id=? AND familyId=?', id(storyId), member.familyId);
    if (!row || (member.role === 'storyteller' && row.storytellerId !== member.id)) throw new ApiError(404, '记录不存在');
    return row;
  }
  function askRow(member: Row, askId: unknown) {
    const row = store.get('SELECT * FROM asks WHERE id=? AND familyId=?', id(askId), member.familyId);
    if (!row) throw new ApiError(404, '问题不存在');
    return row;
  }
  function canDelete(member: Row, story: Row) { return member.role === 'organizer' || story.storytellerId === member.id || story.recordedById === member.id; }
  function followups(storyId: string): Followup[] {
    return store.all('SELECT f.*,m.name FROM followups f JOIN members m ON m.id=f.memberId WHERE f.storyId=? ORDER BY f.rowid', storyId).map(r => ({ id: r.id, memberId: r.memberId, name: r.name, text: r.text, answered: !!r.answered }));
  }
  function renderStory(member: Row, row: Row): Story {
    const reactions = store.all('SELECT m.id,m.name FROM thens t JOIN members m ON m.id=t.memberId WHERE t.storyId=? ORDER BY t.rowid', row.id);
    return { id: row.id, askId: row.askId, question: row.question, stage: row.stage, text: row.text, type: row.type, mime: row.mime, duration: row.duration, bytes: row.bytes, storytellerId: row.storytellerId, recordedById: row.recordedById, recordedBy: store.get('SELECT name FROM members WHERE id=?', row.recordedById)!.name, parentStoryId: row.parentStoryId, createdAt: row.createdAt, thenCount: reactions.length, thenNames: reactions.map(r => r.name), myThen: reactions.some(r => r.id === member.id), followups: followups(row.id), canDelete: canDelete(member, row) };
  }
  function renderAsk(row: Row): Ask {
    return { id: row.id, text: row.text, stage: row.stage, depth: row.depth, askedBy: row.askedBy ?? '', status: row.status, parentStoryId: row.parentStoryId, followupIds: store.all('SELECT followupId FROM askFollowups WHERE askId=? ORDER BY rowid', row.id).map(r => r.followupId), createdAt: row.createdAt };
  }
  function visibleAsk(member: Row, row: Row): boolean {
    return member.role !== 'listener' || row.askedBy === member.id || !!(row.parentStoryId && (store.get('SELECT 1 FROM thens WHERE storyId=? AND memberId=?', row.parentStoryId, member.id) || store.get('SELECT 1 FROM askFollowups a JOIN followups f ON f.id=a.followupId WHERE a.askId=? AND f.memberId=?', row.id, member.id)));
  }
  function snapshot(member: Row): Snapshot {
    return { family: publicFamily(familyOf(member)), member: publicMember(member), members: store.all('SELECT * FROM members WHERE familyId=? ORDER BY rowid', member.familyId).map(publicMember), asks: store.all('SELECT * FROM asks WHERE familyId=? ORDER BY rowid', member.familyId).filter(r => visibleAsk(member, r)).map(renderAsk), stories: store.all('SELECT * FROM stories WHERE familyId=? ORDER BY rowid', member.familyId).filter(r => member.role !== 'storyteller' || r.storytellerId === member.id).map(r => renderStory(member, r)) };
  }
  function pendingContinuation(member: Row, story: Row) {
    let ask = store.get('SELECT * FROM asks WHERE parentStoryId=? AND status=\'pending\'', story.id);
    if (!ask) {
      const askId = randomUUID();
      store.run('INSERT INTO asks(id,familyId,text,stage,depth,askedBy,status,parentStoryId,createdAt) VALUES(?,?,?,?,?,?,\'pending\',?,?)', askId, member.familyId, '这段往事，您还想再讲一点吗？', story.stage, 'gentle', member.id, story.id, now());
      store.run('INSERT INTO generatedAsks VALUES(?)', askId);
      ask = store.get('SELECT * FROM asks WHERE id=?', askId)!;
    }
    store.run('INSERT OR IGNORE INTO askFollowups(askId,followupId) SELECT ?,id FROM followups WHERE storyId=? AND answered=0', ask.id, story.id);
    return ask;
  }
  function clearEmptyContinuation(storyId: string) {
    if (!store.get('SELECT 1 FROM thens WHERE storyId=?', storyId) && !store.get('SELECT 1 FROM followups WHERE storyId=? AND answered=0', storyId)) store.run('DELETE FROM asks WHERE parentStoryId=? AND status=\'pending\' AND (id IN (SELECT id FROM generatedAsks) OR askedBy IS NULL)', storyId);
  }
  function deleteStories(rows: Row[], extra: () => void = () => {}) {
    // Commit first so a crash leaves only private orphan files, not broken live stories.
    store.transaction(() => {
      for (const row of rows) {
        store.run('DELETE FROM asks WHERE parentStoryId=? AND status=\'pending\'', row.id);
        store.run('UPDATE asks SET parentStoryId=NULL WHERE parentStoryId=?', row.id);
        store.run('UPDATE stories SET parentStoryId=NULL WHERE parentStoryId=?', row.id);
        store.run('DELETE FROM stories WHERE id=?', row.id);
      }
      extra();
    });
    for (const row of rows) if (row.file) unlinkSync(join(store.audioDir, row.file));
  }

  app.post('/api/families', (req, res) => {
    const name = text(req.body?.name, 60, '家庭名称');
    const organizerName = text(req.body?.organizerName, 40, '组织者称呼');
    const storytellerName = text(req.body?.storytellerName, 40, '讲述者称呼');
    const familyId = randomUUID(), organizerId = randomUUID(), storytellerId = randomUUID();
    const listenerToken = secret(), storytellerToken = secret(), recoveryCode = secret(), passcode = String(randomInt(100000, 1000000));
    store.transaction(() => {
      store.run('INSERT INTO families VALUES(?,?,?,?,?,?,?)', familyId, name, storytellerName, hash(listenerToken), passcodeHash(passcode), hash(storytellerToken), hash(recoveryCode));
      store.run('INSERT INTO members(id,familyId,name,role) VALUES(?,?,?,\'organizer\')', organizerId, familyId, organizerName);
      store.run('INSERT INTO members(id,familyId,name,role) VALUES(?,?,?,\'storyteller\')', storytellerId, familyId, storytellerName);
      issueSession(res, organizerId);
    });
    res.status(201).json({ snapshot: snapshot(store.get('SELECT * FROM members WHERE id=?', organizerId)!), invite: { token: listenerToken, passcode }, storyteller: { token: storytellerToken }, recoveryCode });
  });
  app.post('/api/preview-invite', (req, res) => {
    const inviteKind = kind(req.body?.kind);
    const family = store.get(`SELECT name,storytellerName FROM families WHERE ${inviteKind === 'listener' ? 'listenerHash' : 'storytellerHash'}=?`, hash(token(req.body?.token)));
    if (!family) throw new ApiError(404, '链接无效或已失效');
    res.json({ familyName: family.name, storytellerName: family.storytellerName });
  });
  app.post('/api/join', (req, res) => {
    const key = attemptKey(req, req.body?.token); checkAttempt(key);
    const name = text(req.body?.name, 40, '称呼');
    const value = req.body?.token;
    const family = typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value) ? store.get('SELECT * FROM families WHERE listenerHash=?', hash(value)) : undefined;
    if (!family || typeof req.body?.passcode !== 'string' || !/^\d{6}$/.test(req.body.passcode) || !matchesPasscode(req.body.passcode, family.passcodeHash)) failAttempt(key);
    const memberId = randomUUID();
    store.transaction(() => {
      store.run('INSERT INTO members(id,familyId,name,role) VALUES(?,?,?,\'listener\')', memberId, family.id, name);
      store.run('DELETE FROM attempts WHERE key=?', key); issueSession(res, memberId);
    });
    res.json(snapshot(store.get('SELECT * FROM members WHERE id=?', memberId)!));
  });
  app.post('/api/storyteller-session', (req, res) => {
    if (req.body?.consent !== true) throw new ApiError(400, '请先同意记录与家庭分享');
    const key = attemptKey(req, req.body?.token); checkAttempt(key);
    const value = req.body?.token;
    const family = typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value) ? store.get('SELECT * FROM families WHERE storytellerHash=?', hash(value)) : undefined;
    if (!family) failAttempt(key);
    const member = store.get('SELECT * FROM members WHERE familyId=? AND role=\'storyteller\'', family.id)!;
    store.transaction(() => { store.run('UPDATE members SET revoked=0 WHERE id=?', member.id); store.run('DELETE FROM attempts WHERE key=?', key); issueSession(res, member.id); });
    res.json(snapshot(store.get('SELECT * FROM members WHERE id=?', member.id)!));
  });
  app.get('/api/session', (req, res) => { res.json(snapshot(authenticate(req))); });
  app.post('/api/logout', (req, res) => {
    const member = authenticate(req); store.run('DELETE FROM sessions WHERE hash=?', member.sessionHash);
    res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'strict', secure: false, path: '/' }); res.json({ ok: true });
  });
  app.post('/api/asks', (req, res) => {
    const member = authenticate(req); requireRole(member, ['listener', 'organizer']);
    const question = text(req.body?.text, 500, '问题');
    const stage = req.body?.stage; if (!stages.includes(stage)) throw new ApiError(400, '人生阶段无效');
    const depth = req.body?.depth; if (depth !== 'gentle' && depth !== 'deep') throw new ApiError(400, '问题深度无效');
    const parent = req.body?.parentStoryId === undefined || req.body.parentStoryId === null ? null : storyRow(member, req.body.parentStoryId);
    const result = store.transaction(() => {
      if (parent && store.get('SELECT 1 FROM asks WHERE parentStoryId=? AND status=\'pending\'', parent.id)) throw new ApiError(409, '这段往事已有待回答的续讲');
      if (!parent && store.get('SELECT 1 FROM asks WHERE familyId=? AND askedBy=? AND parentStoryId IS NULL AND status=\'pending\'', member.familyId, member.id)) throw new ApiError(409, '请先等待当前问题的回答');
      const askId = randomUUID();
      store.run('INSERT INTO asks VALUES(?,?,?,?,?,?,\'pending\',?,?)', askId, member.familyId, question, stage, depth, member.id, parent?.id ?? null, now());
      if (parent) store.run('INSERT OR IGNORE INTO askFollowups SELECT ?,id FROM followups WHERE storyId=? AND answered=0', askId, parent.id);
      return renderAsk(store.get('SELECT * FROM asks WHERE id=?', askId)!);
    });
    res.status(201).json(result);
  });
  app.post('/api/asks/:id/skip', (req, res) => {
    const member = authenticate(req); const ask = askRow(member, req.params.id); requireRole(member, ['storyteller', 'organizer']);
    if (ask.status !== 'pending') throw new ApiError(409, '问题已处理');
    store.run('UPDATE asks SET status=\'skipped\' WHERE id=?', ask.id); res.json({ ok: true });
  });

  function submissionFields(member: Row, askId: unknown, submissionId: unknown, consent: unknown) {
    requireRole(member, ['storyteller', 'organizer']);
    if (consent !== true) throw new ApiError(400, '请先同意记录与家庭分享');
    return { askId: askId === null ? null : id(askId), submissionId: id(submissionId) };
  }
  function existingSubmission(member: Row, submissionId: string, payloadHash: string): Story | undefined {
    const submission = store.get('SELECT * FROM submissions WHERE id=? AND familyId=? AND memberId=?', submissionId, member.familyId, member.id);
    if (!submission) return undefined;
    if (submission.payloadHash !== payloadHash) throw new ApiError(409, '此提交编号已用于不同内容');
    if (!submission.storyId) throw new ApiError(409, '此提交的记录已删除');
    return renderStory(member, storyRow(member, submission.storyId));
  }
  function saveStory(req: Request, fields: { askId: string | null; submissionId: string }, payloadHash: string, content: { text: string; buffer?: Buffer; mime?: string; duration?: number; extension?: string }): Story {
    const member = authenticate(req); requireRole(member, ['storyteller', 'organizer']);
    const existing = existingSubmission(member, fields.submissionId, payloadHash); if (existing) return existing;
    const ask = fields.askId === null ? null : askRow(member, fields.askId);
    if (ask && ask.status !== 'pending') throw new ApiError(409, '问题已被回答或跳过');
    const storyteller = store.get('SELECT id FROM members WHERE familyId=? AND role=\'storyteller\'', member.familyId)!;
    const storyId = randomUUID();
    const file = content.buffer ? `${storyId}.${content.extension}` : null;
    const temp = file ? join(store.audioDir, `${storyId}.${randomUUID()}.tmp`) : null;
    let createdTemp = false, renamed = false;
    try {
      return store.transaction(() => {
        if (content.buffer && temp && file) {
          const fd = openSync(temp, 'wx', 0o600); createdTemp = true;
          try { writeFileSync(fd, content.buffer); fsyncSync(fd); } finally { closeSync(fd); }
          renameSync(temp, join(store.audioDir, file)); renamed = true;
          const directory = openSync(store.audioDir, 'r');
          try { fsyncSync(directory); } finally { closeSync(directory); }
        }
        store.run('INSERT INTO stories VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', storyId, member.familyId, ask?.id ?? null, ask?.text ?? '自由讲述', ask?.stage ?? '心里话', content.text, content.buffer ? 'audio' : 'text', content.mime ?? null, content.duration ?? null, content.buffer?.length ?? Buffer.byteLength(content.text), file, storyteller.id, member.id, ask?.parentStoryId ?? null, now());
        store.run('INSERT INTO submissions VALUES(?,?,?,?,?)', fields.submissionId, member.familyId, member.id, payloadHash, storyId);
        if (ask) {
          store.run('UPDATE asks SET status=\'answered\' WHERE id=?', ask.id);
          store.run('UPDATE followups SET answered=1 WHERE id IN (SELECT followupId FROM askFollowups WHERE askId=?)', ask.id);
        }
        return renderStory(member, store.get('SELECT * FROM stories WHERE id=?', storyId)!);
      });
    } catch (error) {
      if (createdTemp && temp && existsSync(temp)) unlinkSync(temp);
      if (renamed && file && existsSync(join(store.audioDir, file))) unlinkSync(join(store.audioDir, file));
      throw error;
    }
  }
  app.post('/api/stories/text', (req, res) => {
    const member = authenticate(req);
    const fields = submissionFields(member, req.body?.askId, req.body?.submissionId, req.body?.consent);
    const value = text(req.body?.text, 10000, '故事');
    const payloadHash = hash(JSON.stringify({ type: 'text', askId: fields.askId, consent: true, text: req.body.text }));
    res.status(201).json(saveStory(req, fields, payloadHash, { text: value }));
  });
  app.post('/api/stories/audio', (req, _res, next) => {
    try { requireRole(authenticate(req), ['storyteller', 'organizer']); next(); } catch (e) { next(e); }
  }, express.raw({ type: () => true, limit: MAX_AUDIO_BYTES }), async (req, res) => {
    const member = authenticate(req);
    const fields = submissionFields(member, req.headers['x-ask-id'] === '' ? null : req.headers['x-ask-id'], req.headers['x-submission-id'], req.headers['x-consent'] === 'true');
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const declared = (req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
    const payloadHash = hash(Buffer.concat([Buffer.from(JSON.stringify({ type: 'audio', askId: fields.askId, consent: true })), buffer]));
    // Validate even retries: a false MIME must never be accepted just because the bytes exist.
    const metadata = await inspectAudio(buffer, declared);
    res.status(201).json(saveStory(req, fields, payloadHash, { text: '', buffer, ...metadata }));
  });
  app.get('/api/submissions/:id', (req, res) => {
    const member = authenticate(req);
    const submission = store.get('SELECT storyId FROM submissions WHERE id=? AND familyId=? AND memberId=?', id(req.params.id), member.familyId, member.id);
    res.json({ story: submission?.storyId ? renderStory(member, storyRow(member, submission.storyId)) : null });
  });
  app.get('/api/stories/:id/audio', (req, res) => {
    const member = authenticate(req), story = storyRow(member, req.params.id);
    if (story.type !== 'audio' || !story.file) throw new ApiError(404, '音频不存在');
    const buffer = store.readAudio(story.file);
    const size = buffer.length;
    res.set({ 'Content-Type': story.mime, 'Accept-Ranges': 'bytes' });
    const range = req.headers.range;
    let start = 0, end = size - 1;
    if (range !== undefined) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) { res.set('Content-Range', `bytes */${size}`); throw new ApiError(416, '音频范围无效'); }
      if (!match[1]) {
        const suffix = Number(match[2]);
        if (!Number.isSafeInteger(suffix) || suffix <= 0) { res.set('Content-Range', `bytes */${size}`); throw new ApiError(416, '音频范围无效'); }
        start = Math.max(0, size - suffix);
      } else {
        start = Number(match[1]); end = match[2] ? Number(match[2]) : end;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) { res.set('Content-Range', `bytes */${size}`); throw new ApiError(416, '音频范围无效'); }
        end = Math.min(end, size - 1);
      }
      res.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`);
    }
    res.set('Content-Length', String(end - start + 1));
    if (req.method === 'HEAD') res.end(); else res.end(buffer.subarray(start, end + 1));
  });
  app.put('/api/stories/:id/then', (req, res) => {
    const member = authenticate(req), story = storyRow(member, req.params.id); requireRole(member, ['listener', 'organizer']);
    if (typeof req.body?.active !== 'boolean') throw new ApiError(400, '请明确是否想听续讲');
    store.transaction(() => {
      if (req.body.active) {
        const result = store.run('INSERT OR IGNORE INTO thens VALUES(?,?)', story.id, member.id);
        if (result.changes) pendingContinuation(member, story);
      } else { store.run('DELETE FROM thens WHERE storyId=? AND memberId=?', story.id, member.id); clearEmptyContinuation(story.id); }
    });
    res.json(renderStory(member, story));
  });
  app.post('/api/stories/:id/followups', (req, res) => {
    const member = authenticate(req), story = storyRow(member, req.params.id); requireRole(member, ['listener', 'organizer']);
    const value = text(req.body?.text, 120, '追问');
    store.transaction(() => {
      store.run('INSERT INTO followups(id,storyId,memberId,text) VALUES(?,?,?,?)', randomUUID(), story.id, member.id, value);
      pendingContinuation(member, story);
    });
    res.status(201).json(renderStory(member, story));
  });
  app.delete('/api/stories/:id', (req, res) => {
    const member = authenticate(req), story = storyRow(member, req.params.id);
    if (!canDelete(member, story)) throw new ApiError(404, '记录不存在');
    deleteStories([story]); res.json({ ok: true });
  });
  app.delete('/api/followups/:id', (req, res) => {
    const member = authenticate(req);
    const followup = store.get('SELECT f.* FROM followups f JOIN stories s ON s.id=f.storyId WHERE f.id=? AND s.familyId=?', id(req.params.id), member.familyId);
    if (!followup || (followup.memberId !== member.id && member.role !== 'organizer')) throw new ApiError(404, '追问不存在');
    store.transaction(() => { store.run('DELETE FROM followups WHERE id=?', followup.id); clearEmptyContinuation(followup.storyId); }); res.json({ ok: true });
  });
  app.post('/api/invites/new', (req, res) => {
    const member = authenticate(req); requireRole(member, ['organizer']);
    const inviteKind = kind(req.body?.kind), value = secret();
    const links: AccessLinks = { token: value };
    store.transaction(() => {
      if (inviteKind === 'listener') {
        links.passcode = String(randomInt(100000, 1000000));
        store.run('UPDATE families SET listenerHash=?,passcodeHash=? WHERE id=?', hash(value), passcodeHash(links.passcode), member.familyId);
      } else {
        store.run('UPDATE families SET storytellerHash=? WHERE id=?', hash(value), member.familyId);
        store.run('DELETE FROM sessions WHERE memberId IN (SELECT id FROM members WHERE familyId=? AND role=\'storyteller\')', member.familyId);
      }
    });
    res.json(links);
  });
  app.post('/api/members/:id/revoke', (req, res) => {
    const member = authenticate(req); requireRole(member, ['organizer']);
    const target = store.get('SELECT * FROM members WHERE id=? AND familyId=?', id(req.params.id), member.familyId);
    if (!target) throw new ApiError(404, '成员不存在');
    if (target.id === member.id) throw new ApiError(403, '不能撤销自己');
    store.transaction(() => {
      store.run('UPDATE members SET revoked=1 WHERE id=?', target.id); store.run('DELETE FROM sessions WHERE memberId=?', target.id);
      if (target.role === 'storyteller') store.run('UPDATE families SET storytellerHash=? WHERE id=?', hash(secret()), member.familyId);
      if (target.role === 'listener') store.run('UPDATE families SET listenerHash=?,passcodeHash=? WHERE id=?', hash(secret()), passcodeHash(String(randomInt(100000, 1000000))), member.familyId);
    }); res.json({ ok: true });
  });
  app.post('/api/organizer/recover', (req, res) => {
    const familyId = id(req.body?.familyId), key = attemptKey(req, familyId); checkAttempt(key);
    const code = req.body?.code;
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code)) failAttempt(key);
    const recoveryCode = secret();
    const member = store.transaction(() => {
      const result = store.run('UPDATE families SET recoveryHash=? WHERE id=? AND recoveryHash=?', hash(recoveryCode), familyId, hash(code));
      if (!result.changes) return null;
      const organizer = store.get('SELECT * FROM members WHERE familyId=? AND role=\'organizer\'', familyId)!;
      store.run('DELETE FROM sessions WHERE memberId=?', organizer.id); store.run('DELETE FROM attempts WHERE key=?', key); issueSession(res, organizer.id);
      return organizer;
    });
    if (!member) failAttempt(key);
    res.json({ snapshot: snapshot(member), recoveryCode });
  });
  app.get('/api/export', (req, res) => {
    const member = authenticate(req);
    const storyRows = store.all('SELECT * FROM stories WHERE familyId=? ORDER BY rowid', member.familyId).filter(r => member.role === 'organizer' || (member.role === 'storyteller' && r.storytellerId === member.id));
    const storyIds = new Set(storyRows.map(r => r.id));
    const askIds = new Set(storyRows.map(r => r.askId));
    const asks = store.all('SELECT * FROM asks WHERE familyId=? ORDER BY rowid', member.familyId).filter(r => member.role === 'organizer' || (member.role === 'listener' ? r.askedBy === member.id : askIds.has(r.id))).map(row => {
      const ask = renderAsk(row);
      if (member.role === 'listener') ask.followupIds = store.all('SELECT f.id FROM askFollowups a JOIN followups f ON f.id=a.followupId WHERE a.askId=? AND f.memberId=?', row.id, member.id).map(f => f.id);
      return ask;
    });
    const exportedFollowups = store.all('SELECT f.*,m.name FROM followups f JOIN stories s ON s.id=f.storyId JOIN members m ON m.id=f.memberId WHERE s.familyId=? ORDER BY f.rowid', member.familyId).filter(r => member.role === 'organizer' || (member.role === 'listener' ? r.memberId === member.id : storyIds.has(r.storyId))).map(r => ({ id: r.id, storyId: r.storyId, memberId: r.memberId, name: r.name, text: r.text, answered: !!r.answered }));
    const stories = storyRows.map(r => ({ ...renderStory(member, r), ...(r.file ? { audioBase64: store.readAudio(r.file).toString('base64') } : {}) }));
    res.set('Content-Disposition', 'attachment; filename="family-archive.json"').json({ version: 1, family: publicFamily(familyOf(member)), member: publicMember(member), stories, asks, followups: exportedFollowups });
  });
  app.delete('/api/content/mine', (req, res) => {
    const member = authenticate(req);
    const ownStories = store.all('SELECT * FROM stories WHERE familyId=? AND (storytellerId=? OR recordedById=?)', member.familyId, member.id, member.id);
    deleteStories(ownStories, () => {
      const affected = store.all('SELECT DISTINCT storyId FROM followups WHERE memberId=? AND storyId IN (SELECT id FROM stories WHERE familyId=?) UNION SELECT storyId FROM thens WHERE memberId=? AND storyId IN (SELECT id FROM stories WHERE familyId=?)', member.id, member.familyId, member.id, member.familyId);
      store.run('DELETE FROM followups WHERE memberId=? AND storyId IN (SELECT id FROM stories WHERE familyId=?)', member.id, member.familyId);
      store.run('DELETE FROM thens WHERE memberId=? AND storyId IN (SELECT id FROM stories WHERE familyId=?)', member.id, member.familyId);
      // A continuation requested by somebody else must survive deletion of its original asker.
      store.run('UPDATE asks SET askedBy=NULL WHERE familyId=? AND askedBy=? AND parentStoryId IS NOT NULL AND status=\'pending\'', member.familyId, member.id);
      store.run('DELETE FROM asks WHERE familyId=? AND askedBy=?', member.familyId, member.id);
      for (const row of affected) clearEmptyContinuation(row.storyId);
    }); res.json({ ok: true });
  });
  app.use((_req, _res, next) => next(new ApiError(404, '接口不存在')));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) { res.end(); return; }
    const parserError = error as { type?: string; status?: number };
    const status = error instanceof ApiError ? error.status : parserError.type === 'entity.too.large' ? 413 : parserError.type === 'entity.parse.failed' ? 400 : 500;
    res.removeHeader('Content-Length');
    res.status(status).type('application/json').json({ error: error instanceof ApiError ? error.message : status === 413 ? '请求内容过大' : status === 400 ? 'JSON 内容无效' : '本地保存失败，请稍后重试' });
  });
  return { app, close: () => store.close() };
}
