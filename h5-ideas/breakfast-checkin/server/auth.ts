import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Principal } from '../src/types.ts';
import { ApiError, SHOP_ID, ensure } from './domain.ts';

export type Accounts = { owner: string; backup: string };
export function localAccounts(path: string): Accounts {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  chmodSync(dirname(path), 0o700);
  if (!existsSync(path)) writeFileSync(path, JSON.stringify({ owner: randomBytes(18).toString('base64url'), backup: randomBytes(18).toString('base64url') }), { mode: 0o600 });
  chmodSync(path, 0o600);
  return JSON.parse(readFileSync(path, 'utf8')) as Accounts;
}
function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
export type Session = { principal: Principal; csrf: string; expires: number };
export class Auth {
  private passwords: Map<string, Buffer>;
  private sessions = new Map<string, Session>();
  private tickets = new Map<string, { principal: Principal; expires: number }>();
  private failures = new Map<string, number[]>();
  constructor(accounts: Accounts) {
    this.passwords = new Map(Object.entries(accounts).map(([id, value]) => [id, scryptSync(value, id, 32)]));
  }
  login(account: unknown, password: unknown): Principal {
    ensure(account === 'owner' || account === 'backup', 401, '模拟账号或口令不正确');
    ensure(typeof password === 'string' && password.length <= 200, 401, '模拟账号或口令不正确');
    const failures = (this.failures.get(account) ?? []).filter(time => Date.now() - time < 60000);
    ensure(failures.length < 8, 429, '尝试次数过多，请稍后再试');
    const actual = scryptSync(password, account, 32);
    if (!timingSafeEqual(actual, this.passwords.get(account)!)) { failures.push(Date.now()); this.failures.set(account, failures); throw new ApiError(401, '模拟账号或口令不正确'); }
    this.failures.delete(account);
    return { role: account, id: account, shopId: SHOP_ID };
  }
  issue(principal: Principal): { token: string; session: Session } {
    const token = randomBytes(32).toString('base64url');
    const session = { principal, csrf: randomBytes(24).toString('base64url'), expires: Date.now() + 8 * 3600000 };
    this.sessions.set(digest(token), session); return { token, session };
  }
  get(token: string): Session {
    const key = digest(token); const session = this.sessions.get(key);
    if (!session || session.expires <= Date.now()) { this.sessions.delete(key); throw new ApiError(401, '请重新登录或由店员配对'); }
    return session;
  }
  revoke(token: string): void { this.sessions.delete(digest(token)); }
  revokeResident(id: string): void {
    for (const [key, value] of this.sessions) if (value.principal.residentId === id) this.sessions.delete(key);
    for (const [key, value] of this.tickets) if (value.principal.residentId === id) this.tickets.delete(key);
  }
  ticket(principal: Principal): string {
    const ticket = randomBytes(32).toString('base64url');
    this.tickets.set(digest(ticket), { principal, expires: Date.now() + 5 * 60000 }); return ticket;
  }
  exchange(ticket: unknown): Principal {
    ensure(typeof ticket === 'string', 400, '配对票据无效');
    const key = digest(ticket); const found = this.tickets.get(key);
    this.tickets.delete(key);
    ensure(found && found.expires > Date.now(), 401, '配对票据无效、过期或已使用');
    this.revokeResident(found.principal.residentId!);
    return found.principal;
  }
  clear(): void { this.sessions.clear(); this.tickets.clear(); }
}
