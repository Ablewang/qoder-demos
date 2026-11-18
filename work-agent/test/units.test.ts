import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { toMeetingItem } from '../src/connectors/feishu.ts';
import { toGitlabItem } from '../src/connectors/gitlab.ts';
import { toEmailItem } from '../src/connectors/gmail.ts';
import { itemsInRange, openDb, replaceRange } from '../src/db.ts';
import { extractJson, parseCategories } from '../src/llm.ts';
import { beginAuth, consumeState, pkcePair, toTokenSet } from '../src/oauth.ts';
import { esc } from '../src/render.ts';
import type { Item } from '../src/types.ts';

test('feishu: cancelled, free and all-day events are not meetings', () => {
  const base = { event_id: 'e1', summary: '评审', start_time: { timestamp: '1763258400' }, end_time: { timestamp: '1763262000' } };
  const item = toMeetingItem({ ...base, recurring_event_id: 'r' });
  assert.equal(item?.endAt! - item?.startAt!, 3_600_000);
  assert.equal(item?.meta.recurring, true);
  assert.equal(toMeetingItem({ ...base, status: 'cancelled' }), null);
  assert.equal(toMeetingItem({ ...base, free_busy_status: 'free' }), null);
  assert.equal(toMeetingItem({ event_id: 'e2', start_time: {}, end_time: {} }), null);
  assert.equal(toMeetingItem({ ...base, summary: '  ' })?.title, '(无标题日程)');
});

test('gmail: sent, notification and noise are separated', () => {
  const msg = (labelIds: string[], from = 'Alice <alice@corp.com>') => ({
    id: 'm1',
    threadId: 't1',
    internalDate: '1763258400000',
    labelIds,
    payload: { headers: [{ name: 'From', value: from }, { name: 'To', value: 'bob@corp.com' }, { name: 'Subject', value: '方案' }] },
  });
  const sent = toEmailItem(msg(['SENT']), 'me@corp.com');
  assert.equal(sent?.kind, 'email_sent');
  assert.equal(sent?.actor, 'bob@corp.com');
  assert.ok(sent?.url?.includes('authuser=me%40corp.com'));
  assert.equal(toEmailItem(msg(['INBOX']), null)?.kind, 'email_received');
  const notice = toEmailItem(msg(['INBOX'], 'GitLab <gitlab@corp.com>'), null);
  assert.equal(notice?.kind, 'email_notification');
  assert.equal(notice?.category, '其他');
  assert.equal(toEmailItem(msg(['INBOX', 'CATEGORY_UPDATES']), null)?.kind, 'email_notification');
  assert.equal(toEmailItem(msg(['CATEGORY_PROMOTIONS']), null), null);
});

test('gitlab: push and MR comment get readable titles and links', () => {
  const project = { path_with_namespace: 'team/app', web_url: 'https://git.corp/team/app' };
  const push = toGitlabItem(
    {
      id: 1,
      project_id: 9,
      action_name: 'pushed to',
      target_type: null,
      target_iid: null,
      target_title: null,
      created_at: '2026-11-16T08:00:00Z',
      push_data: { ref: 'feat/x', commit_count: 2, commit_title: 'fix login' },
    },
    project,
  );
  assert.equal(push.title, '推送 feat/x（2 个提交）：fix login');
  assert.equal(push.url, 'https://git.corp/team/app/-/commits/feat%2Fx');
  assert.equal(push.category, '研发');

  const note = toGitlabItem(
    {
      id: 2,
      project_id: 9,
      action_name: 'commented on',
      target_type: 'Note',
      target_iid: null,
      target_title: '登录改造',
      created_at: '2026-11-16T09:00:00Z',
      note: { noteable_type: 'MergeRequest', noteable_iid: 42 },
    },
    project,
  );
  assert.equal(note.title, '评论 MR 登录改造');
  assert.equal(note.url, 'https://git.corp/team/app/-/merge_requests/42');
  assert.equal(toGitlabItem({ ...note.meta, id: 3, project_id: null, action_name: 'opened', target_type: 'Issue', target_iid: 1, target_title: 'x', created_at: '2026-11-16T09:00:00Z' }, undefined).url, null);
});

test('oauth: PKCE challenge is S256 of verifier and state is single-use', () => {
  const { verifier, challenge } = pkcePair();
  assert.ok(verifier.length >= 43);
  assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'));

  const { state } = beginAuth('feishu');
  assert.equal(consumeState(state, 'google'), null, 'state is bound to its provider');
  const again = beginAuth('feishu');
  assert.ok(consumeState(again.state, 'feishu'));
  assert.equal(consumeState(again.state, 'feishu'), null);

  const t = toTokenSet({ access_token: 'a', expires_in: 7200, refresh_token: 'r' }, 1000);
  assert.deepEqual(t, { accessToken: 'a', refreshToken: 'r', expiresAt: 7_201_000, scope: undefined });
});

test('llm: tolerant JSON parsing falls back to 其他', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseCategories('{"0":"产品","1":"摸鱼"}', 3), ['产品', '其他', '其他']);
  assert.throws(() => extractJson('no json'));
});

test('db: re-sync keeps categories for unchanged titles and drops vanished items', () => {
  const db = openDb(':memory:');
  const item = (id: string, title: string, category: Item['category'] = null): Item => ({
    id,
    source: 'feishu',
    kind: 'meeting',
    title,
    startAt: 100,
    endAt: 200,
    actor: null,
    url: null,
    meta: {},
    category,
  });
  replaceRange(db, 'feishu', 0, 1000, [item('a', '周会'), item('b', '评审'), item('c', '1on1')]);
  db.prepare("UPDATE items SET category = '协作沟通'").run();
  replaceRange(db, 'feishu', 0, 1000, [item('a', '周会'), item('b', '评审（改期）')]);
  const rows = itemsInRange(db, 0, 1000);
  assert.deepEqual(
    rows.map((r) => [r.id, r.title, r.category]),
    [
      ['a', '周会', '协作沟通'],
      ['b', '评审（改期）', null],
    ],
  );
  db.close();
});

test('render: external text is escaped', () => {
  assert.equal(esc('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
});
