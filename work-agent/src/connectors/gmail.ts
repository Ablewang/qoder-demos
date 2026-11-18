import { config, redirectUri } from '../config.ts';
import { postToken, validAccessToken } from '../oauth.ts';
import { getJson, setJson } from '../secrets.ts';
import type { Item } from '../types.ts';
import { mapLimit } from '../util.ts';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
// headers only, no bodies; this scope does not allow the `q` search parameter
const SCOPE = 'https://www.googleapis.com/auth/gmail.metadata';
export const GMAIL_ACCOUNT = 'gmail.token';
const MAX_PAGES = 30;

export const gmailConfigured = () => Boolean(config.google.clientId && config.google.clientSecret);

export function gmailAuthUrl(state: string, challenge: string): string {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri('google'),
    response_type: 'code',
    scope: SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${AUTH_URL}?${params}`;
}

export async function gmailCallback(code: string, verifier: string): Promise<void> {
  const token = await postToken(TOKEN_URL, {
    grant_type: 'authorization_code',
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    code,
    redirect_uri: redirectUri('google'),
    code_verifier: verifier,
  });
  await setJson(GMAIL_ACCOUNT, token);
  const profile = await api<{ emailAddress: string }>('/profile');
  await setJson('gmail.profile', { email: profile.emailAddress });
}

export async function gmailAccount(): Promise<string | null> {
  const profile = await getJson<{ email: string }>('gmail.profile');
  return profile?.email ?? null;
}

const token = () =>
  validAccessToken('Gmail', GMAIL_ACCOUNT, (refreshToken) =>
    postToken(TOKEN_URL, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
    }),
  );

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await token()}` } });
  if (!res.ok) throw new Error(`Gmail 接口 ${path.split('?')[0]} 返回 ${res.status}：${await res.text()}`);
  return (await res.json()) as T;
}

interface GmailMessage {
  id: string;
  threadId: string;
  internalDate: string;
  labelIds?: string[];
  payload?: { headers?: { name: string; value: string }[] };
}

const NOISE_LABELS = ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'SPAM', 'TRASH'];
const NOTIFICATION_LABELS = ['CATEGORY_UPDATES', 'CATEGORY_FORUMS'];
const NOTIFICATION_SENDER = /no-?reply|notifications?@|mailer-daemon|gitlab|jira|calendar-notification/i;

export function toEmailItem(msg: GmailMessage, selfEmail: string | null): Item | null {
  const labels = msg.labelIds ?? [];
  if (labels.some((l) => NOISE_LABELS.includes(l))) return null;
  const header = (name: string) => msg.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? '';
  const sent = labels.includes('SENT');
  const from = header('from');
  const notification = !sent && (labels.some((l) => NOTIFICATION_LABELS.includes(l)) || NOTIFICATION_SENDER.test(from));
  const authuser = selfEmail ? `?authuser=${encodeURIComponent(selfEmail)}` : '';
  return {
    id: `gmail:${msg.id}`,
    source: 'gmail',
    kind: sent ? 'email_sent' : notification ? 'email_notification' : 'email_received',
    title: header('subject').trim() || '(无主题)',
    startAt: Number(msg.internalDate),
    endAt: null,
    actor: (sent ? header('to') : from) || null,
    url: `https://mail.google.com/mail/${authuser}#all/${msg.threadId}`,
    meta: { threadId: msg.threadId },
    category: notification ? '其他' : null,
  };
}

export async function syncGmail(from: number, to: number): Promise<Item[]> {
  const selfEmail = await gmailAccount();
  const items: Item[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = new URLSearchParams({ maxResults: '100' });
    if (pageToken) q.set('pageToken', pageToken);
    const list = await api<{ messages?: { id: string }[]; nextPageToken?: string }>(`/messages?${q}`);
    const ids = list.messages ?? [];
    const metaQuery = 'format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject';
    const messages = await mapLimit(ids, 8, (m) => api<GmailMessage>(`/messages/${m.id}?${metaQuery}`));
    for (const msg of messages) {
      const at = Number(msg.internalDate);
      if (at < from || at >= to) continue;
      const item = toEmailItem(msg, selfEmail);
      if (item) items.push(item);
    }
    // list order is newest first; once a whole page predates the range we are done
    const newest = Math.max(...messages.map((m) => Number(m.internalDate)));
    if (!list.nextPageToken || newest < from) break;
    pageToken = list.nextPageToken;
  }
  return items;
}
