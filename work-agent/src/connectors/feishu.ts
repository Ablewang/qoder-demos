import { config, redirectUri } from '../config.ts';
import { postToken, validAccessToken } from '../oauth.ts';
import { getJson, setJson } from '../secrets.ts';
import type { Item } from '../types.ts';

const AUTH_URL = 'https://accounts.feishu.cn/open-apis/authen/v1/authorize';
const TOKEN_URL = 'https://accounts.feishu.cn/oauth/v3/token';
const API = 'https://open.feishu.cn/open-apis';
export const FEISHU_ACCOUNT = 'feishu.token';
// instance_view rejects ranges of 40 days or more
const MAX_RANGE = 30 * 86_400_000;

export const feishuConfigured = () => Boolean(config.feishu.appId && config.feishu.appSecret);

export function feishuAuthUrl(state: string, challenge: string): string {
  const params = new URLSearchParams({
    client_id: config.feishu.appId,
    response_type: 'code',
    redirect_uri: redirectUri('feishu'),
    scope: config.feishu.scopes,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `${AUTH_URL}?${params}`;
}

export async function feishuCallback(code: string, verifier: string): Promise<void> {
  const token = await postToken(TOKEN_URL, {
    grant_type: 'authorization_code',
    client_id: config.feishu.appId,
    client_secret: config.feishu.appSecret,
    code,
    redirect_uri: redirectUri('feishu'),
    code_verifier: verifier,
  });
  await setJson(FEISHU_ACCOUNT, token);
  const user = await api<{ name?: string }>('/authen/v1/user_info');
  await setJson('feishu.profile', { name: user.name ?? '' });
}

export async function feishuAccount(): Promise<string | null> {
  const profile = await getJson<{ name: string }>('feishu.profile');
  return profile?.name ?? null;
}

const token = () =>
  validAccessToken('飞书', FEISHU_ACCOUNT, (refreshToken) =>
    postToken(TOKEN_URL, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.feishu.appId,
      client_secret: config.feishu.appSecret,
    }),
  );

export class FeishuApiError extends Error {
  code: number;
  constructor(path: string, code: number, msg: string) {
    super(`飞书接口 ${path} 返回 ${code}：${msg}`);
    this.code = code;
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json; charset=utf-8' },
  });
  const body = (await res.json()) as { code: number; msg: string; data: T };
  if (body.code !== 0) throw new FeishuApiError(path.split('?')[0], body.code, body.msg);
  return body.data;
}

interface FeishuInstance {
  event_id: string;
  summary?: string;
  status?: string;
  free_busy_status?: string;
  start_time?: { timestamp?: string };
  end_time?: { timestamp?: string };
  recurring_event_id?: string;
  event_organizer?: { display_name?: string };
  app_link?: string;
}

export function toMeetingItem(ev: FeishuInstance): Item | null {
  if (ev.status === 'cancelled' || ev.free_busy_status === 'free') return null;
  const start = Number(ev.start_time?.timestamp);
  const end = Number(ev.end_time?.timestamp);
  // all-day events only carry `date`, they are not time blocks
  if (!start || !end || end <= start) return null;
  return {
    id: `feishu:${ev.event_id}`,
    source: 'feishu',
    kind: 'meeting',
    title: ev.summary?.trim() || '(无标题日程)',
    startAt: start * 1000,
    endAt: end * 1000,
    actor: ev.event_organizer?.display_name ?? null,
    url: ev.app_link ?? null,
    meta: { recurring: Boolean(ev.recurring_event_id) },
  };
}

export async function syncFeishu(from: number, to: number): Promise<Item[]> {
  const primary = await api<{ calendars: { calendar: { calendar_id: string } }[] }>('/calendar/v4/calendars/primary', {
    method: 'POST',
  });
  const calendarId = primary.calendars[0]?.calendar.calendar_id;
  if (!calendarId) throw new Error('没有找到你的飞书主日历');

  const items = new Map<string, Item>();
  for (let s = from; s < to; s += MAX_RANGE) {
    const e = Math.min(s + MAX_RANGE, to);
    const q = new URLSearchParams({ start_time: String(Math.floor(s / 1000)), end_time: String(Math.floor(e / 1000)) });
    const data = await api<{ items?: FeishuInstance[] }>(
      `/calendar/v4/calendars/${encodeURIComponent(calendarId)}/events/instance_view?${q}`,
    );
    for (const ev of data.items ?? []) {
      const item = toMeetingItem(ev);
      if (item && item.startAt >= from && item.startAt < to) items.set(item.id, item);
    }
  }
  return [...items.values()];
}

export interface ProbeResult {
  check: string;
  ok: boolean;
  detail: string;
}

// Message access via user_access_token is not guaranteed for a self-built app; report what actually works.
export async function probeFeishuIm(): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  let chats: { chat_id: string; name?: string }[] = [];
  try {
    const data = await api<{ items?: { chat_id: string; name?: string }[] }>('/im/v1/chats?page_size=20');
    chats = data.items ?? [];
    results.push({ check: '列出我所在的群', ok: true, detail: `读到 ${chats.length} 个群` });
  } catch (err) {
    results.push({ check: '列出我所在的群', ok: false, detail: (err as Error).message });
  }
  const chat = chats[0];
  if (chat) {
    try {
      const q = new URLSearchParams({
        container_id_type: 'chat',
        container_id: chat.chat_id,
        sort_type: 'ByCreateTimeDesc',
        page_size: '5',
      });
      const data = await api<{ items?: unknown[] }>(`/im/v1/messages?${q}`);
      results.push({ check: `读取群「${chat.name ?? chat.chat_id}」的消息`, ok: true, detail: `读到 ${data.items?.length ?? 0} 条` });
    } catch (err) {
      results.push({ check: `读取群「${chat.name ?? chat.chat_id}」的消息`, ok: false, detail: (err as Error).message });
    }
  }
  return results;
}
