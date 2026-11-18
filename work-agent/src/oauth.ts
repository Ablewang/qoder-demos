import { createHash, randomBytes } from 'node:crypto';
import { getJson, setJson } from './secrets.ts';

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
}

export class NotAuthorizedError extends Error {
  constructor(provider: string) {
    super(`${provider} 未授权或授权已失效，请在本地页面重新授权`);
  }
}

export function pkcePair() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

const STATE_TTL = 10 * 60_000;
const pending = new Map<string, { provider: string; verifier: string; createdAt: number }>();

export function beginAuth(provider: string) {
  const state = randomBytes(16).toString('hex');
  const { verifier, challenge } = pkcePair();
  pending.set(state, { provider, verifier, createdAt: Date.now() });
  return { state, challenge };
}

export function consumeState(state: string, provider: string): string | null {
  const entry = pending.get(state);
  pending.delete(state);
  if (!entry || entry.provider !== provider || Date.now() - entry.createdAt > STATE_TTL) return null;
  return entry.verifier;
}

export function toTokenSet(body: Record<string, unknown>, now = Date.now()): TokenSet {
  return {
    accessToken: String(body.access_token),
    refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : undefined,
    expiresAt: now + Number(body.expires_in ?? 0) * 1000,
    scope: typeof body.scope === 'string' ? body.scope : undefined,
  };
}

export async function postToken(url: string, params: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const body = (await res.json()) as Record<string, unknown>;
  const failed = !res.ok || body.error || (typeof body.code === 'number' && body.code !== 0);
  if (failed || typeof body.access_token !== 'string') {
    throw new Error(`换取凭证失败：${body.error_description ?? body.error ?? body.msg ?? res.status}`);
  }
  return toTokenSet(body);
}

// Refresh tokens may be single-use (Feishu) or never reissued (Google); keep the old one when none comes back.
export async function validAccessToken(
  provider: string,
  account: string,
  refresh: (refreshToken: string) => Promise<TokenSet>,
): Promise<string> {
  const current = await getJson<TokenSet>(account);
  if (!current) throw new NotAuthorizedError(provider);
  if (current.expiresAt - Date.now() > 60_000) return current.accessToken;
  if (!current.refreshToken) throw new NotAuthorizedError(provider);
  let next: TokenSet;
  try {
    next = await refresh(current.refreshToken);
  } catch {
    throw new NotAuthorizedError(provider);
  }
  await setJson(account, { ...next, refreshToken: next.refreshToken ?? current.refreshToken });
  return next.accessToken;
}
