import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReport, freeGaps, mergeIntervals } from '../src/report.ts';
import type { Item } from '../src/types.ts';

const at = (s: string) => new Date(s).getTime();

const meeting = (id: string, title: string, start: string, end: string, category: Item['category'] = '研发'): Item => ({
  id,
  source: 'feishu',
  kind: 'meeting',
  title,
  startAt: at(start),
  endAt: at(end),
  actor: null,
  url: null,
  meta: {},
  category,
});

test('mergeIntervals unions overlapping meetings', () => {
  assert.deepEqual(
    mergeIntervals([
      [5, 8],
      [1, 3],
      [2, 4],
    ]),
    [
      [1, 4],
      [5, 8],
    ],
  );
});

test('freeGaps returns gaps inside the window only', () => {
  assert.deepEqual(freeGaps(0, 100, [[-10, 10], [30, 40], [90, 120]]), [20, 50]);
  assert.deepEqual(freeGaps(0, 100, []), [100]);
});

test('buildReport counts double-booked time once and finds focus blocks', () => {
  // 2026-11-16 is a Monday
  const items: Item[] = [
    meeting('a', '站会', '2026-11-16T10:00:00', '2026-11-16T10:30:00', '协作沟通'),
    meeting('b', '需求评审', '2026-11-16T14:00:00', '2026-11-16T15:00:00', '产品'),
    meeting('c', '架构讨论', '2026-11-16T14:30:00', '2026-11-16T15:30:00'),
    meeting('d', '站会', '2026-11-17T10:00:00', '2026-11-17T10:30:00', '协作沟通'),
    {
      id: 'g1',
      source: 'gitlab',
      kind: 'gitlab_event',
      title: '推送 main',
      startAt: at('2026-11-16T16:00:00'),
      endAt: null,
      actor: null,
      url: null,
      meta: { action: '推送' },
      category: '研发',
    },
    {
      id: 'm1',
      source: 'gmail',
      kind: 'email_notification',
      title: 'Pipeline failed',
      startAt: at('2026-11-16T16:10:00'),
      endAt: null,
      actor: null,
      url: null,
      meta: {},
      category: '其他',
    },
  ];
  const from = at('2026-11-16T00:00:00');
  const to = at('2026-11-18T00:00:00');
  const report = buildReport(items, from, to, { start: '10:00', end: '19:00' }, to);

  const monday = report.days[0];
  assert.equal(monday.date, '2026-11-16');
  assert.equal(monday.meetingMinutes, 120);
  assert.equal(monday.meetingCount, 3);
  // free: 10:30-14:00 (210) and 15:30-19:00 (210)
  assert.equal(monday.longestFocusMinutes, 210);
  assert.equal(monday.focusBlocks, 2);
  assert.equal(monday.gitlab, 1);

  assert.equal(report.totals.meetingMinutes, 150);
  assert.equal(report.totals.emailNotification, 1);
  assert.equal(report.topMeetings.length, 3);
  assert.deepEqual(
    report.topMeetings.find((m) => m.title === '站会'),
    { title: '站会', count: 2, minutes: 60 },
  );
  assert.deepEqual(report.gitlabActions, [{ label: '推送', count: 1 }]);
  assert.ok(!report.categories.some((c) => c.category === '其他'), 'notifications are not attributed to a category');
  assert.equal(Math.round((report.totals.meetingShare ?? 0) * 100), 14);
});

test('buildReport leaves weekend focus empty and stops the work window at now', () => {
  const sat = at('2026-11-21T00:00:00');
  const report = buildReport([], sat, at('2026-11-23T12:00:00'), { start: '10:00', end: '19:00' }, at('2026-11-23T12:00:00'));
  assert.equal(report.days[0].longestFocusMinutes, null);
  assert.equal(report.days[2].weekday, '周一');
  assert.equal(report.days[2].longestFocusMinutes, 120);
});
