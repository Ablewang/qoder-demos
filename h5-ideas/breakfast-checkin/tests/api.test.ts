import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { request as httpRequest } from 'node:http';
import { createApp } from '../server/app.ts';
import { Store } from '../server/store.ts';
import type { SessionView, StaffView } from '../src/types.ts';

const origin = 'http://127.0.0.1:5217';
async function fixture(t: TestContext) {
  const store = new Store(':memory:', '2026-11-17');
  const { server } = createApp({ store, accounts: { owner: 'only-fake-owner-password', backup: 'only-fake-backup-password' }, origin });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}`;
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); });
  class Client {
    cookie = ''; csrf = ''; version = 0;
    async request(path: string, input?: Record<string, unknown>, extraHeaders: Record<string, string> = {}) {
      const response = await fetch(`${url}/api${path}`, { method: input ? 'POST' : 'GET', headers: { ...(input ? { Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': this.csrf } : {}), Cookie: this.cookie, ...extraHeaders }, body: input ? JSON.stringify(input) : undefined });
      const value = await response.json();
      const setCookie = response.headers.get('set-cookie'); if (setCookie) this.cookie = setCookie.split(';')[0];
      if (value.csrf) this.csrf = (value as SessionView).csrf;
      return { response, value };
    }
    async login(account = 'owner') { const result = await this.request('/login', { account, password: account === 'owner' ? 'only-fake-owner-password' : 'only-fake-backup-password' }); assert.equal(result.response.status, 200); }
    async view() { const result = await this.request('/staff'); assert.equal(result.response.status, 200); this.version = (result.value as StaffView).version; return result.value as StaffView; }
    async write(path: string, input: Record<string, unknown> = {}) { return this.request(path, { ...input, requestId: randomUUID(), version: store.read().version }); }
    async enroll(id = 'elder-a') { return this.write('/enroll', { fixtureId: id, threshold: 2, weekdays: [0, 1, 2, 3, 4, 5, 6], simulatedElderConsent: true }); }
    async pair(id: string, role: string, target: Client) { const ticket = await this.request('/tickets', { residentId: id, role }); assert.equal(ticket.response.status, 200); const result = await target.request('/pair', { ticket: ticket.value.ticket }); assert.equal(result.response.status, 200); return ticket.value.ticket as string; }
  }
  return { store, url, Client };
}

test('公用入口无名单；匿名、伪造角色和跨 Host 被拒绝', async t => {
  const { Client, url } = await fixture(t); const client = new Client();
  const pub = await client.request('/public'); assert.equal(pub.response.status, 200); assert.equal(pub.value.demo, true); assert(!JSON.stringify(pub.value).includes('elder-a'));
  assert.equal((await client.request('/staff')).response.status, 401);
  assert.equal((await client.request('/login', { account: 'owner', password: '1234', role: 'owner' })).response.status, 400);
  assert.equal((await client.request('/login', { account: 'owner', password: '1234' })).response.status, 401);
  const hostStatus = await new Promise<number | undefined>((resolve, reject) => {
    const request = httpRequest(`${url}/api/public`, { headers: { Host: 'untrusted.example' } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    request.on('error', reject); request.end();
  });
  assert.equal(hostStatus, 403);
});
test('写入强制 Origin 与 CSRF；浏览器自报角色不能授权', async t => {
  const { Client } = await fixture(t); const client = new Client(); await client.login();
  assert.equal((await client.request('/advance', { version: 0, requestId: randomUUID() }, { Origin: 'http://other.local' })).response.status, 403);
  assert.equal((await client.request('/advance', { version: 0, requestId: randomUUID() }, { 'X-CSRF-Token': 'forged' })).response.status, 403);
  assert.equal((await client.write('/enroll', { fixtureId: 'elder-a', threshold: 2, weekdays: [1], simulatedElderConsent: true, phone: 'real contact' })).response.status, 400);
});
test('本人和联系人服务端限权，单次配对不能重放', async t => {
  const { Client } = await fixture(t); const owner = new Client(); const guardian = new Client(); const self = new Client();
  await owner.login(); await owner.enroll();
  const ticket = await owner.pair('elder-a', 'guardian', guardian);
  assert.equal((await guardian.write('/consent', { accepted: true })).response.status, 200);
  assert.equal((await guardian.request('/staff')).response.status, 403);
  assert.equal((await guardian.request('/me')).response.status, 403);
  assert.equal((await guardian.write('/residents/elder-a/arrival', { witnessed: true })).response.status, 403);
  assert.equal((await guardian.request('/pair', { ticket })).response.status, 401);
  await owner.pair('elder-a', 'resident', self);
  assert.equal((await self.request('/guardian')).response.status, 403);
  assert.equal((await self.write('/review', { date: '2026-11-17' })).response.status, 403);
  assert.equal((await self.write('/residents/elder-b/arrival', { witnessed: false })).response.status, 403);
  assert.equal((await self.request('/me')).response.status, 200);
});
test('幂等写、重复点、版本冲突和服务端日期', async t => {
  const { Client, store } = await fixture(t); const owner = new Client(); const guardian = new Client(); const self = new Client();
  await owner.login(); await owner.enroll(); await owner.pair('elder-a', 'guardian', guardian); await guardian.write('/consent', { accepted: true }); await owner.pair('elder-a', 'resident', self);
  const input = { requestId: randomUUID(), version: store.read().version, witnessed: false };
  const first = await self.request('/residents/elder-a/arrival', input); assert.equal(first.response.status, 200);
  const repeated = await self.request('/residents/elder-a/arrival', input); assert.deepEqual(repeated.value, first.value);
  assert.equal((await self.request('/residents/elder-a/arrival', { ...input, witnessed: true })).response.status, 409);
  const concurrent = await Promise.all([owner.write('/residents/elder-a/arrival', { witnessed: true }), self.write('/residents/elder-a/arrival', { witnessed: false })]);
  assert(concurrent.every(item => item.response.status === 200)); assert.equal(store.read().arrivals.length, 1); assert.equal(store.read().arrivals[0].source, 'self');
  assert.equal((await owner.request('/review', { requestId: randomUUID(), version: 0, date: '2026-11-17' })).response.status, 409);
  assert.equal((await self.write('/residents/elder-a/arrival', { witnessed: false, date: '2030-01-01' })).response.status, 400);
});
test('退出删除以及旧会话/票据拒绝；重新登记不会恢复记录', async t => {
  const { Client, store } = await fixture(t); const owner = new Client(); const guardian = new Client(); const self = new Client();
  await owner.login(); await owner.enroll(); await owner.pair('elder-a', 'guardian', guardian); await guardian.write('/consent', { accepted: true }); await owner.pair('elder-a', 'resident', self);
  await self.write('/residents/elder-a/arrival', { witnessed: false });
  const pending = await owner.request('/tickets', { residentId: 'elder-a', role: 'resident' });
  assert.equal((await self.write('/residents/elder-a/withdraw')).response.status, 200);
  assert.equal((await self.request('/me')).response.status, 401);
  assert.equal((await self.request('/pair', { ticket: pending.value.ticket })).response.status, 401);
  assert.equal(store.read().residents.length + store.read().arrivals.length + store.read().leaves.length + store.read().tasks.length, 0);
  assert.equal((await owner.enroll()).response.status, 200); assert.equal(store.read().arrivals.length, 0);
});
test('联系人撤回停止处理并撤销本人会话，拒绝真实额外信息', async t => {
  const { Client, store } = await fixture(t); const owner = new Client(); const guardian = new Client(); const self = new Client();
  await owner.login(); await owner.enroll(); await owner.pair('elder-a', 'guardian', guardian); await guardian.write('/consent', { accepted: true }); await owner.pair('elder-a', 'resident', self);
  await self.write('/residents/elder-a/arrival', { witnessed: false });
  await self.write('/residents/elder-a/leave', { start: '2026-11-17', end: '2026-11-17' });
  const otherGuardian = new Client(); await owner.pair('elder-a', 'guardian', otherGuardian);
  assert.equal((await otherGuardian.write('/consent', { accepted: false })).response.status, 200);
  assert.equal((await self.request('/me')).response.status, 401); assert.equal(store.read().residents[0].status, 'waiting');
  assert.equal(store.read().arrivals.length + store.read().leaves.length + store.read().tasks.length, 0);
  assert(!JSON.stringify(store.read().receipts).includes('演示熟客甲'));
  assert.equal((await owner.write('/residents/elder-a/leave', { start: '2026-11-17', end: '2026-11-17', reason: 'actual health' })).response.status, 400);
});
test('仅店主能清空，清空撤销替补会话；无通知或拨号 API', async t => {
  const { Client } = await fixture(t); const owner = new Client(); const backup = new Client(); await owner.login(); await backup.login('backup');
  assert.equal((await backup.request('/reset', { confirmed: true })).response.status, 403);
  assert.equal((await owner.write('/send-notification')).response.status, 404);
  assert.equal((await owner.write('/call')).response.status, 404);
  assert.equal((await owner.request('/reset', { confirmed: true })).response.status, 200);
  assert.equal((await backup.request('/staff')).response.status, 401);
});
test('SQLite 原子回滚、重启持久化与退出删除不复活', () => {
  const dir = mkdtempSync(resolve('artifacts/store-test-')); const path = resolve(dir, 'demo.sqlite');
  try {
    let store = new Store(path, '2026-11-17');
    assert.throws(() => store.write(state => { state.paused = true; throw new Error('fake failure'); })); assert.equal(store.read().paused, false);
    store.write(state => { state.paused = true; }); store.close();
    store = new Store(path); assert.equal(store.read().paused, true); store.reset('2026-11-17'); store.close();
    store = new Store(path); assert.equal(store.read().residents.length, 0); assert.equal(store.read().paused, false); store.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
