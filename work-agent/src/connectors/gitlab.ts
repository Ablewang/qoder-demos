import { config } from '../config.ts';
import { NotAuthorizedError } from '../oauth.ts';
import { getJson, setJson } from '../secrets.ts';
import type { Item } from '../types.ts';
import { mapLimit } from '../util.ts';

export const GITLAB_ACCOUNT = 'gitlab.token';
const MAX_PAGES = 50;

interface Stored {
  token: string;
  username: string;
}

export const gitlabConfigured = () => Boolean(config.gitlab.baseUrl);

async function request(path: string, token: string): Promise<Response> {
  const res = await fetch(`${config.gitlab.baseUrl}/api/v4${path}`, { headers: { 'PRIVATE-TOKEN': token } });
  if (res.status === 401) throw new NotAuthorizedError('GitLab');
  if (!res.ok) throw new Error(`GitLab 接口 ${path.split('?')[0]} 返回 ${res.status}`);
  return res;
}

export async function saveGitlabToken(token: string): Promise<string> {
  const user = (await (await request('/user', token)).json()) as { username: string };
  await setJson(GITLAB_ACCOUNT, { token, username: user.username } satisfies Stored);
  return user.username;
}

export async function gitlabAccount(): Promise<string | null> {
  return (await getJson<Stored>(GITLAB_ACCOUNT))?.username ?? null;
}

interface GitlabEvent {
  id: number;
  project_id: number | null;
  action_name: string;
  target_type: string | null;
  target_iid: number | null;
  target_title: string | null;
  created_at: string;
  note?: { noteable_type?: string; noteable_iid?: number };
  push_data?: { ref?: string; commit_count?: number; commit_title?: string };
}

interface Project {
  path_with_namespace: string;
  web_url: string;
}

const ACTIONS: Record<string, string> = {
  'pushed to': '推送',
  'pushed new': '新建分支',
  'commented on': '评论',
  opened: '创建',
  closed: '关闭',
  accepted: '合并',
  approved: '批准',
  merged: '合并',
  created: '创建',
  updated: '更新',
  deleted: '删除',
  joined: '加入',
};

const TARGETS: Record<string, string> = {
  MergeRequest: 'MR',
  Issue: 'Issue',
  Milestone: '里程碑',
  WikiPage: 'Wiki',
  DesignManagement: '设计',
};

export function actionLabel(ev: GitlabEvent): string {
  if (ev.push_data) return ACTIONS[ev.action_name] ?? '推送';
  const action = ACTIONS[ev.action_name] ?? ev.action_name;
  const target = ev.note?.noteable_type ?? ev.target_type ?? '';
  return `${action} ${TARGETS[target] ?? target}`.trim();
}

function targetUrl(ev: GitlabEvent, project: Project | undefined): string | null {
  if (!project) return null;
  const type = ev.note?.noteable_type ?? ev.target_type;
  const iid = ev.note?.noteable_iid ?? ev.target_iid;
  if (type === 'MergeRequest' && iid) return `${project.web_url}/-/merge_requests/${iid}`;
  if (type === 'Issue' && iid) return `${project.web_url}/-/issues/${iid}`;
  if (ev.push_data?.ref) return `${project.web_url}/-/commits/${encodeURIComponent(ev.push_data.ref)}`;
  return project.web_url;
}

export function toGitlabItem(ev: GitlabEvent, project: Project | undefined): Item {
  const label = actionLabel(ev);
  const push = ev.push_data;
  const detail = push
    ? `${push.ref ?? ''}${push.commit_count ? `（${push.commit_count} 个提交）` : ''}${push.commit_title ? `：${push.commit_title}` : ''}`
    : (ev.target_title ?? '');
  return {
    id: `gitlab:${ev.id}`,
    source: 'gitlab',
    kind: 'gitlab_event',
    title: `${label} ${detail}`.trim(),
    startAt: Date.parse(ev.created_at),
    endAt: null,
    actor: project?.path_with_namespace ?? null,
    url: targetUrl(ev, project),
    meta: { action: label },
    category: '研发',
  };
}

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function syncGitlab(from: number, to: number): Promise<Item[]> {
  const stored = await getJson<Stored>(GITLAB_ACCOUNT);
  if (!stored) throw new NotAuthorizedError('GitLab');
  // after/before are exclusive dates; widen by a day and filter precisely below
  const q = new URLSearchParams({ after: isoDate(from - 86_400_000), before: isoDate(to + 86_400_000), per_page: '100' });
  const events: GitlabEvent[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    q.set('page', String(page));
    const res = await request(`/events?${q}`, stored.token);
    events.push(...((await res.json()) as GitlabEvent[]));
    if (!res.headers.get('x-next-page')) break;
  }

  const projectIds = [...new Set(events.map((e) => e.project_id).filter((id): id is number => id !== null))];
  const projects = new Map<number, Project>();
  await mapLimit(projectIds, 6, async (id) => {
    try {
      projects.set(id, (await (await request(`/projects/${id}?simple=true`, stored.token)).json()) as Project);
    } catch {
      // deleted or inaccessible project: keep the event without a link
    }
  });

  return events
    .map((ev) => toGitlabItem(ev, ev.project_id === null ? undefined : projects.get(ev.project_id)))
    .filter((i) => i.startAt >= from && i.startAt < to);
}
