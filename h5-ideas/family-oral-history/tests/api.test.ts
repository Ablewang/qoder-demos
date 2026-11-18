import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, readdirSync, readFileSync, statSync, writeFileSync, renameSync, unlinkSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server/app.ts';
import type { CreatedFamily, Snapshot, Story } from '../src/shared.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'http://127.0.0.1:5215';
// Only locally synthesized, non-empty, valid 16-bit mono PCM: no microphone or external audio.
function wav(seconds = 0.25, hz = 440, rate = 8000): Buffer {
  const count = Math.floor(seconds * rate), bytes = count * 2;
  const out = Buffer.alloc(44 + bytes);
  out.write('RIFF', 0); out.writeUInt32LE(36 + bytes, 4); out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24); out.writeUInt32LE(rate * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
  out.write('data', 36); out.writeUInt32LE(bytes, 40);
  for (let i = 0; i < count; i++) out.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * hz / rate) * 3000), 44 + i * 2);
  return out;
}
class Client {
  cookie = '';
  constructor(readonly base: () => string) {}
  async request(path: string, method = 'GET', body?: unknown, options: { origin?: string | null; headers?: Record<string, string>; raw?: boolean } = {}) {
    const headers: Record<string, string> = { ...options.headers };
    if (options.origin !== null) headers.Origin = options.origin ?? origin;
    if (this.cookie) headers.Cookie = this.cookie;
    if (body !== undefined && !options.raw) headers['Content-Type'] = 'application/json';
    const response = await fetch(this.base() + path, { method, headers, body: body === undefined ? undefined : options.raw ? body as BodyInit : JSON.stringify(body) });
    const cookie = response.headers.get('set-cookie');
    if (cookie) this.cookie = cookie.split(';')[0]!;
    const buffer = Buffer.from(await response.arrayBuffer());
    const data = buffer.length && response.headers.get('content-type')?.includes('application/json') ? JSON.parse(buffer.toString()) : undefined;
    return { response, status: response.status, data, buffer };
  }
  async ok(path: string, method = 'GET', body?: unknown, status = 200) {
    const result = await this.request(path, method, body);
    assert.equal(result.status, status, `${method} ${path}: ${JSON.stringify(result.data)}`);
    return result.data;
  }
  async audio(buffer = wav(), submissionId = randomUUID(), askId = '', mime = 'audio/wav') {
    return this.request('/api/stories/audio', 'POST', buffer, { raw: true, headers: { 'Content-Type': mime, 'X-Ask-Id': askId, 'X-Submission-Id': submissionId, 'X-Consent': 'true' } });
  }
}
async function harness(t: TestContext) {
  const testRoot = join(root, '.test-data'); mkdirSync(testRoot, { recursive: true, mode: 0o700 });
  const dataDir = mkdtempSync(join(testRoot, 'api-'));
  let running: ReturnType<typeof createApp> | undefined;
  let server: Server | undefined;
  let base = '';
  async function start() {
    running = createApp({ dataDir, origin });
    server = await new Promise<Server>((resolve, reject) => {
      const value = running!.app.listen(0, '127.0.0.1', () => resolve(value)); value.once('error', reject);
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }
  async function stop() {
    if (server) await new Promise<void>((resolve, reject) => server!.close(e => e ? reject(e) : resolve()));
    running?.close(); server = undefined; running = undefined;
  }
  await start();
  t.after(async () => { await stop(); rmSync(dataDir, { recursive: true, force: true }); });
  const client = () => new Client(() => base);
  const organizer = client();
  const family: CreatedFamily = await organizer.ok('/api/families', 'POST', { name: '王家往事', organizerName: '小王', storytellerName: '奶奶' }, 201);
  const storyteller = client();
  const storytellerSnapshot: Snapshot = await storyteller.ok('/api/storyteller-session', 'POST', { token: family.storyteller.token, consent: true });
  const listener = client();
  const listenerSnapshot: Snapshot = await listener.ok('/api/join', 'POST', { ...family.invite, name: '孙女', role: 'organizer', memberId: family.snapshot.member.id });
  const db = () => new DatabaseSync(join(dataDir, 'archive.sqlite'));
  async function story(author = storyteller, askId: string | null = null, value = '小时候村口有一棵大树。'): Promise<Story> {
    return author.ok('/api/stories/text', 'POST', { askId, submissionId: randomUUID(), consent: true, text: value }, 201);
  }
  async function ask(author = listener, value = '小时候最喜欢去哪里玩？') {
    return author.ok('/api/asks', 'POST', { text: value, stage: '童年', depth: 'gentle' }, 201);
  }
  return { dataDir, client, organizer, family, storyteller, storytellerSnapshot, listener, listenerSnapshot, db, story, ask, stop, start };
}

test('创建合同、私有权限、凭据仅存哈希、新加入者不能提升角色', async t => {
  const h = await harness(t);
  assert.equal(h.family.snapshot.member.role, 'organizer');
  assert.equal(h.listenerSnapshot.member.role, 'listener');
  assert.equal(h.storytellerSnapshot.member.role, 'storyteller');
  assert.equal(h.family.invite.token.length, 43); assert.equal(h.family.recoveryCode.length, 43);
  assert.match(h.organizer.cookie, /^family_session=[A-Za-z0-9_-]{43}$/);
  const response = await h.client().request('/api/families', 'POST', { name: '另一家', organizerName: '小李', storytellerName: '爷爷' });
  const cookie = response.response.headers.get('set-cookie')!;
  assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Strict/i); assert.doesNotMatch(cookie, /Secure/i);
  assert.equal(statSync(h.dataDir).mode & 0o777, 0o700);
  assert.equal(statSync(join(h.dataDir, 'archive.sqlite')).mode & 0o777, 0o600);
  assert.equal(statSync(join(h.dataDir, 'audio')).mode & 0o777, 0o700);
  const database = h.db();
  const rows = JSON.stringify(database.prepare('SELECT * FROM families').all()) + JSON.stringify(database.prepare('SELECT * FROM sessions').all()); database.close();
  for (const value of [h.family.invite.token, h.family.invite.passcode!, h.family.storyteller.token, h.family.recoveryCode, h.organizer.cookie.split('=')[1]!]) assert.ok(!rows.includes(value));
  assert.equal((await h.listener.request('/api/invites/new', 'POST', { kind: 'listener' })).status, 403);
  assert.equal((await h.listener.request('/api/stories/text', 'POST', { askId: null, submissionId: randomUUID(), consent: true, text: '伪装讲述者' })).status, 403);
});

test('精确 Origin、Host、无宽松 CORS、安全响应与预览仅最少信息', async t => {
  const h = await harness(t);
  for (const source of [null, 'null', 'http://localhost:5215', 'http://127.0.0.1:5215.evil.test', 'https://evil.test']) {
    const result = await h.organizer.request('/api/logout', 'POST', {}, { origin: source });
    assert.equal(result.status, 403); assert.equal(result.response.headers.get('access-control-allow-origin'), null);
  }
  // Node fetch normalizes Host to the URL authority; use raw HTTP for this one header check.
  const badHost = await new Promise<number | undefined>((resolve, reject) => {
    const req = httpRequest(h.organizer.base() + '/api/session', { headers: { Host: 'evil.test', Cookie: h.organizer.cookie } }, res => { res.resume(); resolve(res.statusCode); });
    req.once('error', reject); req.end();
  });
  assert.equal(badHost, 403);
  const valid = await h.organizer.request('/api/session');
  assert.equal(valid.response.headers.get('cache-control'), 'no-store');
  assert.equal(valid.response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(valid.response.headers.get('access-control-allow-origin'), origin);
  assert.equal(valid.response.headers.get('access-control-allow-credentials'), 'true');
  assert.equal(valid.response.headers.get('x-powered-by'), null);
  for (const inviteKind of ['listener', 'storyteller']) {
    const result = await h.client().ok('/api/preview-invite', 'POST', { kind: inviteKind, token: inviteKind === 'listener' ? h.family.invite.token : h.family.storyteller.token });
    assert.deepEqual(result, { familyName: '王家往事', storytellerName: '奶奶' });
  }
  assert.equal((await h.client().request('/api/preview-invite', 'POST', { kind: 'listener', token: randomUUID() })).status, 404);
  const options = await h.client().request('/api/stories/audio', 'OPTIONS'); assert.equal(options.status, 204);
  assert.equal((await h.client().request('/api/stories/audio', 'OPTIONS', undefined, { origin: null })).status, 403);
});

test('两家族资源隔离统一404及幂等查询作用域', async t => {
  const h = await harness(t), other = h.client();
  const created: CreatedFamily = await other.ok('/api/families', 'POST', { name: '李家', organizerName: '小李', storytellerName: '爷爷' }, 201);
  const question = await h.ask(), story = await h.story(h.storyteller, question.id);
  for (const [path, method, body] of [
    [`/api/stories/${story.id}/audio`, 'GET', undefined],
    [`/api/stories/${story.id}/then`, 'PUT', { active: true }],
    [`/api/stories/${story.id}/followups`, 'POST', { text: '别家的追问' }],
    [`/api/stories/${story.id}`, 'DELETE', undefined],
    [`/api/asks/${question.id}/skip`, 'POST', {}],
    [`/api/members/${h.listenerSnapshot.member.id}/revoke`, 'POST', {}],
  ] as const) assert.equal((await other.request(path, method, body)).status, 404);
  assert.equal((await other.request('/api/stories/text', 'POST', { askId: question.id, submissionId: randomUUID(), consent: true, text: '越族作答' })).status, 404);
  assert.equal((await other.ok('/api/session')).family.id, created.snapshot.family.id);
  assert.deepEqual((await other.ok('/api/session')).stories, []);
  const submissionId = randomUUID();
  await h.storyteller.ok('/api/stories/text', 'POST', { askId: null, submissionId, consent: true, text: '原文' }, 201);
  assert.deepEqual(await other.ok(`/api/submissions/${submissionId}`), { story: null });
  assert.deepEqual(await h.listener.ok(`/api/submissions/${submissionId}`), { story: null });
});

test('邀请码错误5次锁定15分钟且匿名预览有限流', async t => {
  const h = await harness(t), guest = h.client();
  const wrong = h.family.invite.passcode === '000000' ? '111111' : '000000';
  for (let i = 1; i <= 5; i++) assert.equal((await guest.request('/api/join', 'POST', { token: h.family.invite.token, passcode: wrong, name: '访客' })).status, i === 5 ? 429 : 404);
  assert.equal((await guest.request('/api/join', 'POST', { ...h.family.invite, name: '访客' })).status, 429);
  const database = h.db(); const row = database.prepare('SELECT * FROM attempts').get()!;
  assert.ok(Number(row.expires) - Date.now() > 14 * 60 * 1000);
  database.prepare('UPDATE attempts SET expires=?').run(Date.now() - 1); database.close();
  assert.equal((await guest.request('/api/join', 'POST', { ...h.family.invite, name: '访客' })).status, 200);
  for (let i = 0; i < 60; i++) assert.equal((await guest.request('/api/preview-invite', 'POST', { token: h.family.invite.token, kind: 'listener' })).status, 200);
  const limited = await guest.request('/api/preview-invite', 'POST', { token: h.family.invite.token, kind: 'listener' });
  assert.equal(limited.status, 429); assert.ok(Number(limited.response.headers.get('retry-after')) > 0);
});

test('撤成员、会话过期、登出与精确角色限制', async t => {
  const h = await harness(t);
  assert.equal((await h.client().request('/api/session')).status, 401);
  const question = await h.ask();
  assert.equal((await h.listener.request(`/api/asks/${question.id}/skip`, 'POST', {})).status, 403);
  assert.equal((await h.storyteller.request('/api/asks', 'POST', { text: '问题', stage: '童年', depth: 'gentle' })).status, 403);
  await h.organizer.ok(`/api/members/${h.listenerSnapshot.member.id}/revoke`, 'POST', {});
  assert.equal((await h.listener.request('/api/session')).status, 401);
  assert.equal((await h.organizer.request(`/api/members/${h.family.snapshot.member.id}/revoke`, 'POST', {})).status, 403);
  const database = h.db(); database.prepare('UPDATE sessions SET expires=? WHERE memberId=?').run(Date.now() - 1, h.storytellerSnapshot.member.id); database.close();
  assert.equal((await h.storyteller.request('/api/session')).status, 401);
  await h.organizer.ok('/api/logout', 'POST', {});
  assert.equal((await h.organizer.request('/api/session')).status, 401);
});

test('listener邀请轮换不注销已加入；老人轮换撤会话；撤老人禁旧链接，新链接保留身份再激活', async t => {
  const h = await harness(t);
  const listenerLink = await h.organizer.ok('/api/invites/new', 'POST', { kind: 'listener' });
  assert.equal((await h.client().request('/api/join', 'POST', { ...h.family.invite, name: '迟到者' })).status, 404);
  await h.listener.ok('/api/session');
  await h.client().ok('/api/join', 'POST', { ...listenerLink, name: '新成员' });
  const oldCookie = h.storyteller.cookie;
  const elderLink = await h.organizer.ok('/api/invites/new', 'POST', { kind: 'storyteller' });
  assert.equal((await h.storyteller.request('/api/session')).status, 401);
  assert.equal((await h.client().request('/api/storyteller-session', 'POST', { token: h.family.storyteller.token, consent: true })).status, 404);
  const rejoined = await h.storyteller.ok('/api/storyteller-session', 'POST', { ...elderLink, consent: true });
  assert.equal(rejoined.member.id, h.storytellerSnapshot.member.id); assert.notEqual(h.storyteller.cookie, oldCookie);
  await h.organizer.ok(`/api/members/${rejoined.member.id}/revoke`, 'POST', {});
  assert.equal((await h.storyteller.request('/api/session')).status, 401);
  assert.equal((await h.storyteller.request('/api/storyteller-session', 'POST', { ...elderLink, consent: true })).status, 404);
  const next = await h.organizer.ok('/api/invites/new', 'POST', { kind: 'storyteller' });
  assert.equal((await h.storyteller.request('/api/storyteller-session', 'POST', { ...next, consent: false })).status, 400);
  const activated = await h.storyteller.ok('/api/storyteller-session', 'POST', { ...next, consent: true });
  assert.equal(activated.member.id, rejoined.member.id); assert.equal(activated.member.revoked, false);
});

test('输入边界：stage/depth/ID、空文本、长度、待普通问题409但续讲独立', async t => {
  const h = await harness(t);
  for (const body of [{ text: '', stage: '童年', depth: 'gentle' }, { text: '题', stage: '无效', depth: 'gentle' }, { text: '题', stage: '童年', depth: 'invalid' }, { text: '题', stage: '童年', depth: 'gentle', parentStoryId: '../../secret' }]) assert.equal((await h.listener.request('/api/asks', 'POST', body)).status, 400);
  const question = await h.ask();
  assert.equal((await h.listener.request('/api/asks', 'POST', { text: '另一个题', stage: '童年', depth: 'gentle' })).status, 409);
  const parent = await h.story();
  const continuation = await h.listener.ok('/api/asks', 'POST', { text: '后来怎样？', stage: '童年', depth: 'deep', parentStoryId: parent.id }, 201);
  assert.equal(continuation.parentStoryId, parent.id);
  assert.equal((await h.storyteller.request('/api/stories/text', 'POST', { askId: null, submissionId: randomUUID(), consent: true, text: '  ' })).status, 400);
  assert.equal((await h.storyteller.request('/api/stories/text', 'POST', { askId: null, submissionId: randomUUID(), consent: true, text: '字'.repeat(10001) })).status, 413);
  assert.equal((await h.storyteller.request('/api/stories/text', 'POST', { askId: null, submissionId: 'bad', consent: true, text: '字' })).status, 400);
  assert.equal((await h.storyteller.request('/api/stories/text', 'POST', { askId: null, submissionId: randomUUID(), consent: false, text: '字' })).status, 400);
  assert.equal((await h.listener.request(`/api/stories/${parent.id}/followups`, 'POST', { text: '字'.repeat(121) })).status, 413);
  await h.organizer.ok(`/api/asks/${question.id}/skip`, 'POST', {});
  assert.equal((await h.storyteller.request('/api/stories/text', 'POST', { askId: question.id, submissionId: randomUUID(), consent: true, text: '字' })).status, 409);
});

test('拒绝空/伪造/截断/类型不匹配音频、超20MiB和超过5分钟，不信任上传元数据', async t => {
  const h = await harness(t);
  for (const buffer of [Buffer.alloc(0), Buffer.from('<html>not audio</html>'), wav(0), wav().subarray(0, 100), Buffer.from('RIFFxxxxWAVE<script>'), Buffer.from('OggSfake'), Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0])]) assert.equal((await h.storyteller.audio(buffer)).status, 400);
  assert.equal((await h.storyteller.audio(wav(), randomUUID(), '', 'audio/mpeg')).status, 400);
  assert.equal((await h.storyteller.audio(wav(), randomUUID(), '', 'text/plain')).status, 400);
  assert.equal((await h.storyteller.audio(wav(301))).status, 413);
  assert.equal((await h.storyteller.audio(Buffer.alloc(20 * 1024 * 1024 + 1))).status, 413);
  assert.equal((await h.listener.audio()).status, 403);
  const maliciousHeaders = await h.storyteller.request('/api/stories/audio', 'POST', wav(), { raw: true, headers: { 'Content-Type': 'application/octet-stream', 'X-Ask-Id': '', 'X-Submission-Id': randomUUID(), 'X-Consent': 'true', 'X-File-Name': '../../public/evil.html', 'X-Duration': '0' } });
  assert.equal(maliciousHeaders.status, 201); assert.equal(maliciousHeaders.data.mime, 'audio/wav'); assert.equal(maliciousHeaders.data.duration, 0.25);
  assert.ok(readdirSync(join(h.dataDir, 'audio')).every(name => /^[0-9a-f-]+\.wav$/.test(name)));
});

test('合法PCM WAV实际长度/时长/私有文件、鉴权GET与HEAD、单Range及坏Range416', async t => {
  const h = await harness(t), buffer = wav();
  const saved = await h.storyteller.audio(buffer); assert.equal(saved.status, 201, JSON.stringify(saved.data));
  const story: Story = saved.data;
  assert.equal(story.type, 'audio'); assert.equal(story.bytes, buffer.length); assert.equal(story.duration, 0.25); assert.equal(story.mime, 'audio/wav');
  const files = readdirSync(join(h.dataDir, 'audio')); assert.equal(files.length, 1);
  assert.equal(statSync(join(h.dataDir, 'audio', files[0]!)).mode & 0o777, 0o600);
  assert.deepEqual(readFileSync(join(h.dataDir, 'audio', files[0]!)), buffer);
  for (const method of ['GET', 'HEAD']) assert.equal((await h.client().request(`/api/stories/${story.id}/audio`, method)).status, 401);
  const full = await h.listener.request(`/api/stories/${story.id}/audio`); assert.equal(full.status, 200); assert.deepEqual(full.buffer, buffer);
  assert.equal(full.response.headers.get('content-type'), 'audio/wav'); assert.equal(full.response.headers.get('content-length'), String(buffer.length));
  const head = await h.listener.request(`/api/stories/${story.id}/audio`, 'HEAD'); assert.equal(head.status, 200); assert.equal(head.buffer.length, 0); assert.equal(head.response.headers.get('content-length'), String(buffer.length));
  for (const [range, start, end] of [['bytes=0-9', 0, 9], ['bytes=10-', 10, buffer.length - 1], ['bytes=-12', buffer.length - 12, buffer.length - 1], ['bytes=0-999999', 0, buffer.length - 1]] as const) {
    const result = await h.listener.request(`/api/stories/${story.id}/audio`, 'GET', undefined, { headers: { Range: range } });
    assert.equal(result.status, 206); assert.deepEqual(result.buffer, buffer.subarray(start, end + 1));
    assert.equal(result.response.headers.get('content-range'), `bytes ${start}-${end}/${buffer.length}`);
  }
  const rangeHead = await h.listener.request(`/api/stories/${story.id}/audio`, 'HEAD', undefined, { headers: { Range: 'bytes=0-9' } }); assert.equal(rangeHead.status, 206); assert.equal(rangeHead.buffer.length, 0); assert.equal(rangeHead.response.headers.get('content-length'), '10');
  for (const range of ['bytes=999999-', 'bytes=10-2', 'bytes=-0', 'bytes=0-1,4-5', 'bytes=-', 'items=0-1', 'bytes=9007199254740992-']) {
    const result = await h.listener.request(`/api/stories/${story.id}/audio`, 'GET', undefined, { headers: { Range: range } }); assert.equal(result.status, 416); assert.equal(result.response.headers.get('content-range'), `bytes */${buffer.length}`); assert.equal(typeof result.data.error, 'string');
  }
  assert.equal((await h.listener.request(`/audio/${files[0]}`)).status, 404);
});

test('then去重、具体追问加入同一pending续讲、回答闭环及再次追问产生下一轮', async t => {
  const h = await harness(t), parent = await h.story();
  for (let i = 0; i < 2; i++) {
    const result = await h.listener.ok(`/api/stories/${parent.id}/then`, 'PUT', { active: true }); assert.equal(result.thenCount, 1); assert.deepEqual(result.thenNames, ['孙女']); assert.equal(result.myThen, true);
  }
  let snap: Snapshot = await h.storyteller.ok('/api/session');
  const first = snap.asks.find(a => a.parentStoryId === parent.id)!; assert.equal(snap.asks.filter(a => a.parentStoryId === parent.id && a.status === 'pending').length, 1);
  const one = await h.listener.ok(`/api/stories/${parent.id}/followups`, 'POST', { text: '村里的大树是哪一年种的？' }, 201);
  const two = await h.organizer.ok(`/api/stories/${parent.id}/followups`, 'POST', { text: '树下还有谁一起玩？' }, 201);
  snap = await h.storyteller.ok('/api/session');
  assert.deepEqual(snap.asks.find(a => a.id === first.id)!.followupIds, two.followups.map((f: { id: string }) => f.id));
  const answer = await h.story(h.storyteller, first.id, '树是爷爷种的，姐姐也来玩。'); assert.equal(answer.parentStoryId, parent.id);
  snap = await h.storyteller.ok('/api/session'); assert.ok(snap.stories.find(s => s.id === parent.id)!.followups.every(f => f.answered));
  await h.listener.ok(`/api/stories/${parent.id}/then`, 'PUT', { active: true });
  assert.equal((await h.storyteller.ok('/api/session')).asks.filter((a: { status: string }) => a.status === 'pending').length, 0);
  const three = await h.listener.ok(`/api/stories/${parent.id}/followups`, 'POST', { text: '姐姐后来去了哪里？' }, 201);
  snap = await h.storyteller.ok('/api/session'); const next = snap.asks.find(a => a.parentStoryId === parent.id && a.status === 'pending')!;
  assert.notEqual(next.id, first.id); assert.deepEqual(next.followupIds, [three.followups.at(-1).id]);
  assert.equal(three.followups[0].answered, true); assert.equal(three.followups.at(-1).answered, false);
  await h.story(h.organizer, next.id, '姐姐去城里工作了。');
  assert.ok((await h.storyteller.ok('/api/session')).stories.find((s: Story) => s.id === parent.id).followups.every((f: { answered: boolean }) => f.answered));
  assert.equal((await h.storyteller.request(`/api/stories/${parent.id}/then`, 'PUT', { active: true })).status, 403);
  assert.equal(one.followups[0].text, '村里的大树是哪一年种的？');
});

test('文本与音频幂等：同key同payload同Story，不同payload/ask409，查询可恢复；并行请求不重复', async t => {
  const h = await harness(t), submissionId = randomUUID();
  const body = { askId: null, submissionId, consent: true, text: '相同故事' };
  const [one, two] = await Promise.all([h.storyteller.request('/api/stories/text', 'POST', body), h.storyteller.request('/api/stories/text', 'POST', body)]);
  assert.equal(one.status, 201); assert.equal(two.status, 201); assert.equal(one.data.id, two.data.id);
  assert.equal((await h.storyteller.request('/api/stories/text', 'POST', { ...body, text: '不同故事' })).status, 409);
  assert.equal((await h.storyteller.ok(`/api/submissions/${submissionId}`)).story.id, one.data.id);
  const audioId = randomUUID();
  const [audio1, audio2] = await Promise.all([h.storyteller.audio(wav(), audioId), h.storyteller.audio(wav(), audioId)]);
  assert.equal(audio1.status, 201); assert.equal(audio2.status, 201); assert.equal(audio1.data.id, audio2.data.id);
  assert.equal((await h.storyteller.audio(wav(0.25, 880), audioId)).status, 409);
  const ask = await h.ask(); assert.equal((await h.storyteller.audio(wav(), audioId, ask.id)).status, 409);
  assert.equal((await h.storyteller.ok(`/api/submissions/${audioId}`)).story.id, audio1.data.id);
  assert.equal(readdirSync(join(h.dataDir, 'audio')).length, 1);
  const proxy = await h.organizer.ok('/api/stories/text', 'POST', body, 201); assert.notEqual(proxy.id, one.data.id);
});

test('音频保存失败清理自身临时文件、数据库回滚，不破坏已成功故事；启动清孤文件', async t => {
  const h = await harness(t);
  const saved = await h.storyteller.audio(); assert.equal(saved.status, 201);
  const existingFiles = readdirSync(join(h.dataDir, 'audio'));
  const database = h.db(); database.exec("CREATE TRIGGER fail_story BEFORE INSERT ON stories BEGIN SELECT RAISE(ABORT, 'test failure'); END;"); database.close();
  const failedId = randomUUID(); const failed = await h.storyteller.audio(wav(), failedId); assert.equal(failed.status, 500);
  assert.deepEqual(readdirSync(join(h.dataDir, 'audio')), existingFiles);
  assert.deepEqual(await h.storyteller.ok(`/api/submissions/${failedId}`), { story: null });
  const fresh = h.db(); fresh.exec('DROP TRIGGER fail_story'); fresh.close();
  const audioDir = join(h.dataDir, 'audio'), moved = join(h.dataDir, 'audio-held'); renameSync(audioDir, moved); writeFileSync(audioDir, 'not a directory');
  try { assert.equal((await h.storyteller.audio()).status, 500); } finally { unlinkSync(audioDir); renameSync(moved, audioDir); }
  const success = await h.storyteller.audio(wav(), failedId); assert.equal(success.status, 201);
  await h.stop(); writeFileSync(join(audioDir, `${randomUUID()}.wav`), wav()); writeFileSync(join(audioDir, `${randomUUID()}.${randomUUID()}.tmp`), 'partial');
  await h.start(); assert.equal(readdirSync(audioDir).length, 2);
  assert.equal((await h.storyteller.request(`/api/stories/${saved.data.id}/audio`)).status, 200);
});

test('本人导出与删除：listener只本人题追问；不夹带凭据；老人删除本人原声，组织者全族导出', async t => {
  const h = await harness(t), question = await h.ask(), parent = await h.story(h.storyteller, question.id);
  const audio = await h.storyteller.audio(); assert.equal(audio.status, 201);
  await h.listener.ok(`/api/stories/${parent.id}/followups`, 'POST', { text: '孙女追问' }, 201);
  await h.organizer.ok(`/api/stories/${parent.id}/followups`, 'POST', { text: '组织者追问' }, 201);
  const listenerExport = await h.listener.request('/api/export'); assert.equal(listenerExport.status, 200); assert.match(listenerExport.response.headers.get('content-disposition')!, /attachment/);
  assert.deepEqual(listenerExport.data.stories, []); assert.ok(listenerExport.data.asks.some((a: { id: string }) => a.id === question.id));
  assert.equal(listenerExport.data.followups.length, 1); assert.equal(listenerExport.data.followups[0].text, '孙女追问');
  const elderExport = await h.storyteller.ok('/api/export'); assert.equal(elderExport.stories.length, 2); assert.equal(elderExport.stories.find((s: Story) => s.id === audio.data.id).audioBase64, wav().toString('base64'));
  const organizerExport = await h.organizer.ok('/api/export'); assert.equal(organizerExport.followups.length, 2); assert.equal(organizerExport.version, 1);
  const serialized = JSON.stringify(organizerExport); assert.doesNotMatch(serialized, /listenerHash|storytellerHash|passcodeHash|recoveryHash|sessionHash|payloadHash|\.wav/);
  for (const value of [h.family.invite.token, h.family.invite.passcode!, h.family.recoveryCode]) assert.ok(!serialized.includes(value));
  assert.equal((await h.listener.request(`/api/stories/${parent.id}`, 'DELETE')).status, 404);
  const foreignFollowup = organizerExport.followups.find((f: { memberId: string }) => f.memberId === h.family.snapshot.member.id);
  assert.equal((await h.listener.request(`/api/followups/${foreignFollowup.id}`, 'DELETE')).status, 404);
  await h.listener.ok('/api/content/mine', 'DELETE');
  const remaining: Snapshot = await h.organizer.ok('/api/session'); assert.equal(remaining.stories.length, 2); assert.equal(remaining.stories.find(s => s.id === parent.id)!.askId, null); assert.equal(remaining.stories.find(s => s.id === parent.id)!.question, question.text);
  assert.equal(remaining.stories.find(s => s.id === parent.id)!.followups.length, 1);
  const pending = remaining.asks.find(a => a.parentStoryId === parent.id && a.status === 'pending')!; assert.ok(pending); assert.equal(pending.followupIds.length, 1);
  await h.story(h.storyteller, pending.id, '回答组织者的追问');
  await h.storyteller.ok('/api/content/mine', 'DELETE');
  assert.equal((await h.organizer.ok('/api/session')).stories.length, 0); assert.equal(readdirSync(join(h.dataDir, 'audio')).length, 0);
});

test('删除主段清反应追问与pending，已回答续讲保留但不带已删除原文；撤销本人追问', async t => {
  const h = await harness(t), parent = await h.story(h.organizer, null, '不应残留的主段原文');
  const first = await h.listener.ok(`/api/stories/${parent.id}/followups`, 'POST', { text: '问题一' }, 201);
  await h.listener.ok(`/api/followups/${first.followups[0].id}`, 'DELETE');
  assert.equal((await h.organizer.ok('/api/session')).asks.length, 0);
  await h.listener.ok(`/api/stories/${parent.id}/then`, 'PUT', { active: true });
  const pending = (await h.storyteller.ok('/api/session')).asks[0];
  const continuation = await h.story(h.storyteller, pending.id, '后来我们搬家了');
  await h.listener.ok(`/api/stories/${parent.id}/followups`, 'POST', { text: '第二轮问题' }, 201);
  await h.organizer.ok(`/api/stories/${parent.id}`, 'DELETE');
  const snap: Snapshot = await h.listener.ok('/api/session'); assert.equal(snap.stories.length, 1); assert.equal(snap.stories[0]!.id, continuation.id); assert.equal(snap.stories[0]!.parentStoryId, null);
  assert.ok(!JSON.stringify(snap).includes('不应残留的主段原文')); assert.equal(snap.asks.filter(a => a.status === 'pending').length, 0);
  const database = h.db(); assert.equal(database.prepare('SELECT count(*) AS n FROM followups').get()!.n, 0); assert.equal(database.prepare('SELECT count(*) AS n FROM thens').get()!.n, 0); database.close();
});

test('SQLite重启持久化：故事、Cookie会话、幂等、追问与反应不丢失', async t => {
  const h = await harness(t), question = await h.ask();
  const submissionId = randomUUID(); const saved = await h.storyteller.audio(wav(), submissionId, question.id); assert.equal(saved.status, 201);
  await h.listener.ok(`/api/stories/${saved.data.id}/then`, 'PUT', { active: true });
  await h.listener.ok(`/api/stories/${saved.data.id}/followups`, 'POST', { text: '后来呢？' }, 201);
  const before = await h.listener.ok('/api/session');
  await h.stop(); await h.start();
  assert.deepEqual(await h.listener.ok('/api/session'), before);
  assert.equal((await h.storyteller.ok(`/api/submissions/${submissionId}`)).story.id, saved.data.id);
  assert.equal((await h.storyteller.audio(wav(), submissionId, question.id)).data.id, saved.data.id);
  assert.deepEqual((await h.listener.request(`/api/stories/${saved.data.id}/audio`)).buffer, wav());
});

test('取消then可清空自动续讲，但不删除明确书写的续讲问题', async t => {
  const h = await harness(t), parent = await h.story();
  await h.listener.ok(`/api/stories/${parent.id}/then`, 'PUT', { active: true });
  await h.listener.ok(`/api/stories/${parent.id}/then`, 'PUT', { active: false });
  assert.equal((await h.storyteller.ok('/api/session')).asks.length, 0);
  const explicit = await h.listener.ok('/api/asks', 'POST', { text: '搬家时您带走了什么？', stage: '童年', depth: 'gentle', parentStoryId: parent.id }, 201);
  await h.listener.ok(`/api/stories/${parent.id}/then`, 'PUT', { active: true });
  await h.listener.ok(`/api/stories/${parent.id}/then`, 'PUT', { active: false });
  const snap: Snapshot = await h.storyteller.ok('/api/session');
  assert.equal(snap.asks.length, 1); assert.equal(snap.asks[0]!.id, explicit.id);
});

test('organizer删除本人代理故事不删除其他人故事，也不影响其他家庭', async t => {
  const h = await harness(t), other = h.client();
  await other.ok('/api/families', 'POST', { name: '独立家庭', organizerName: '家人', storytellerName: '爷爷' }, 201);
  const foreign = await h.story(other, null, '另一个家庭的故事');
  const elder = await h.story(); const proxy = await h.story(h.organizer);
  await h.organizer.ok('/api/content/mine', 'DELETE');
  const snap: Snapshot = await h.organizer.ok('/api/session');
  assert.deepEqual(snap.stories.map(s => s.id), [elder.id]); assert.ok(!snap.stories.some(s => s.id === proxy.id));
  assert.equal((await other.ok('/api/session')).stories[0].id, foreign.id);
});

test('高熵管理员恢复码单次原子轮换，撤旧会话；并发仅一次成功；短码拒绝', async t => {
  const h = await harness(t), recovery = h.client(), rival = h.client();
  assert.equal((await recovery.request('/api/organizer/recover', 'POST', { familyId: h.family.snapshot.family.id, code: '123456' })).status, 404);
  const body = { familyId: h.family.snapshot.family.id, code: h.family.recoveryCode };
  const responses = await Promise.all([recovery.request('/api/organizer/recover', 'POST', body), rival.request('/api/organizer/recover', 'POST', body)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 404]);
  const successful = responses.find(r => r.status === 200)!; assert.notEqual(successful.data.recoveryCode, h.family.recoveryCode); assert.equal(successful.data.recoveryCode.length, 43);
  assert.equal(successful.data.snapshot.member.id, h.family.snapshot.member.id);
  assert.equal((await h.organizer.request('/api/session')).status, 401); await h.listener.ok('/api/session'); await h.storyteller.ok('/api/session');
  assert.equal((await h.client().request('/api/organizer/recover', 'POST', body)).status, 404);
  const recoveredClient = responses[0]!.status === 200 ? recovery : rival;
  await recoveredClient.ok('/api/session');
  const next = h.client(); const final = await next.ok('/api/organizer/recover', 'POST', { familyId: body.familyId, code: successful.data.recoveryCode });
  assert.notEqual(final.recoveryCode, successful.data.recoveryCode); assert.equal((await recoveredClient.request('/api/session')).status, 401);
  await h.stop(); await h.start(); await next.ok('/api/session');
});

test('辅助加入码使用加盐scrypt；撤销收听成员禁止用旧邀请重新加入，其他现有成员保留', async t => {
  const h = await harness(t);
  const database = h.db();
  const row = database.prepare('SELECT passcodeHash FROM families WHERE id=?').get(h.family.snapshot.family.id) as { passcodeHash: string };
  database.close(); assert.match(row.passcodeHash, /^[a-f0-9]{32}:[a-f0-9]{64}$/);
  const other = h.client(); await other.ok('/api/join', 'POST', { ...h.family.invite, name: '另一位家人' });
  await h.organizer.ok(`/api/members/${h.listenerSnapshot.member.id}/revoke`, 'POST', {});
  assert.equal((await h.client().request('/api/join', 'POST', { ...h.family.invite, name: '换昵称也不能回来' })).status, 404);
  await other.ok('/api/session');
  const rotated = await h.organizer.ok('/api/invites/new', 'POST', { kind: 'listener' });
  await h.client().ok('/api/join', 'POST', { ...rotated, name: '新获邀请的家人' });
});

test('私有音频拒绝符号链接；启动只清理自身命名的孤文件，不删除陌生文件', async t => {
  const h = await harness(t);
  const uploaded = await h.storyteller.audio(); assert.equal(uploaded.status, 201);
  const audioDir = join(h.dataDir, 'audio');
  const file = readdirSync(audioDir)[0]!; const path = join(audioDir, file);
  const backup = join(h.dataDir, 'original.wav'); renameSync(path, backup);
  symlinkSync(backup, path);
  const denied = await h.listener.request(`/api/stories/${uploaded.data.id}/audio`);
  assert.equal(denied.status, 500); assert.ok(!denied.buffer.subarray(0, 4).equals(Buffer.from('RIFF')));
  assert.equal((await h.organizer.request('/api/export')).status, 500);
  unlinkSync(path); renameSync(backup, path);
  await h.stop(); writeFileSync(join(audioDir, 'user-owned-note.txt'), 'keep me');
  await h.start(); assert.equal(readFileSync(join(audioDir, 'user-owned-note.txt'), 'utf8'), 'keep me');
});
