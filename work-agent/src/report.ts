import { CATEGORIES, type Item } from './types.ts';

const FOCUS_BLOCK_MINUTES = 90;
const MINUTE = 60_000;
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export interface DayStat {
  date: string;
  weekday: string;
  meetingMinutes: number;
  meetingCount: number;
  longestFocusMinutes: number | null;
  focusBlocks: number | null;
  gitlab: number;
  emailSent: number;
}

export interface CategoryStat {
  category: string;
  meetingMinutes: number;
  meetings: number;
  emailSent: number;
  emailReceived: number;
  gitlab: number;
}

export interface SourceStatus {
  label: string;
  status: string;
  ok: boolean;
}

export interface ReportData {
  from: number;
  to: number;
  generatedAt: number;
  totals: {
    meetingMinutes: number;
    meetingCount: number;
    meetingShare: number | null;
    emailSent: number;
    emailReceived: number;
    emailNotification: number;
    gitlab: number;
  };
  categories: CategoryStat[];
  days: DayStat[];
  topMeetings: { title: string; count: number; minutes: number }[];
  gitlabActions: { label: string; count: number }[];
  insights: string[];
  sources: SourceStatus[];
}

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ms: number, n: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function parseClock(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function mergeIntervals(list: [number, number][]): [number, number][] {
  const sorted = [...list].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

export function freeGaps(windowStart: number, windowEnd: number, busy: [number, number][]): number[] {
  const gaps: number[] = [];
  let cursor = windowStart;
  for (const [s, e] of busy) {
    if (e <= cursor) continue;
    if (s >= windowEnd) break;
    if (s > cursor) gaps.push(s - cursor);
    cursor = Math.max(cursor, e);
  }
  if (cursor < windowEnd) gaps.push(windowEnd - cursor);
  return gaps;
}

const minutes = (ms: number) => Math.round(ms / MINUTE);
const duration = (i: Item) => (i.endAt ?? i.startAt) - i.startAt;

export function buildReport(
  items: Item[],
  from: number,
  to: number,
  work: { start: string; end: string },
  now = Date.now(),
): ReportData {
  const meetings = items.filter((i) => i.kind === 'meeting' && i.endAt);
  const workStart = parseClock(work.start) * MINUTE;
  const workEnd = parseClock(work.end) * MINUTE;

  const days: DayStat[] = [];
  let workWindowTotal = 0;
  let meetingInWorkTotal = 0;
  for (let d = startOfDay(from); d < to; d = addDays(d, 1)) {
    const next = addDays(d, 1);
    const inDay = (i: Item) => i.startAt >= d && i.startAt < next;
    const dayMeetings = meetings.filter(inDay);
    const busy = mergeIntervals(dayMeetings.map((m) => [m.startAt, m.endAt as number]));
    const weekday = new Date(d).getDay();

    let longestFocusMinutes: number | null = null;
    let focusBlocks: number | null = null;
    if (weekday >= 1 && weekday <= 5) {
      const ws = d + workStart;
      const we = Math.min(d + workEnd, to, now);
      if (we > ws) {
        const gaps = freeGaps(ws, we, busy);
        longestFocusMinutes = minutes(Math.max(0, ...gaps));
        focusBlocks = gaps.filter((g) => g >= FOCUS_BLOCK_MINUTES * MINUTE).length;
        workWindowTotal += we - ws;
        meetingInWorkTotal += we - ws - gaps.reduce((a, b) => a + b, 0);
      }
    }

    const dayItems = items.filter(inDay);
    days.push({
      date: dateKey(d),
      weekday: WEEKDAYS[weekday],
      meetingMinutes: minutes(busy.reduce((sum, [s, e]) => sum + (e - s), 0)),
      meetingCount: dayMeetings.length,
      longestFocusMinutes,
      focusBlocks,
      gitlab: dayItems.filter((i) => i.kind === 'gitlab_event').length,
      emailSent: dayItems.filter((i) => i.kind === 'email_sent').length,
    });
  }

  const categoryNames = [...CATEGORIES, '未分类'];
  const categories = categoryNames
    .map((category): CategoryStat => {
      const own = items.filter((i) => (i.category ?? '未分类') === category && i.kind !== 'email_notification');
      const ownMeetings = own.filter((i) => i.kind === 'meeting' && i.endAt);
      return {
        category,
        meetingMinutes: minutes(ownMeetings.reduce((sum, m) => sum + duration(m), 0)),
        meetings: ownMeetings.length,
        emailSent: own.filter((i) => i.kind === 'email_sent').length,
        emailReceived: own.filter((i) => i.kind === 'email_received').length,
        gitlab: own.filter((i) => i.kind === 'gitlab_event').length,
      };
    })
    .filter((c) => c.meetings + c.emailSent + c.emailReceived + c.gitlab > 0);

  const grouped = new Map<string, { title: string; count: number; minutes: number }>();
  for (const m of meetings) {
    const g = grouped.get(m.title) ?? { title: m.title, count: 0, minutes: 0 };
    g.count += 1;
    g.minutes += minutes(duration(m));
    grouped.set(m.title, g);
  }
  const topMeetings = [...grouped.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 10);

  const actions = new Map<string, number>();
  for (const i of items.filter((i) => i.kind === 'gitlab_event')) {
    const label = String(i.meta.action ?? '其他');
    actions.set(label, (actions.get(label) ?? 0) + 1);
  }
  const gitlabActions = [...actions].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

  const count = (kind: Item['kind']) => items.filter((i) => i.kind === kind).length;
  return {
    from,
    to,
    generatedAt: now,
    totals: {
      meetingMinutes: days.reduce((sum, d) => sum + d.meetingMinutes, 0),
      meetingCount: meetings.length,
      meetingShare: workWindowTotal > 0 ? meetingInWorkTotal / workWindowTotal : null,
      emailSent: count('email_sent'),
      emailReceived: count('email_received'),
      emailNotification: count('email_notification'),
      gitlab: count('gitlab_event'),
    },
    categories,
    days,
    topMeetings,
    gitlabActions,
    insights: [],
    sources: [],
  };
}

// Aggregates only: no attendee names, no email senders.
export function insightInput(data: ReportData) {
  return {
    range: `${dateKey(data.from)} 至 ${dateKey(data.to - 1)}`,
    totals: data.totals,
    categories: data.categories,
    days: data.days,
    topMeetings: data.topMeetings,
    gitlabActions: data.gitlabActions,
  };
}
