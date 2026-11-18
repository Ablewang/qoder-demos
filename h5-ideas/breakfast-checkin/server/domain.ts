import { randomUUID } from 'node:crypto';
import type { Arrival, CareTask, DailyStatus, Day, Leave, Principal, Resident, RosterRow, StaffView } from '../src/types.ts';

export const SHOP_ID = 'demo-breakfast';
export const FIXTURES = [
  { id: 'elder-a', name: '演示熟客甲', guardianName: '演示联系人甲' },
  { id: 'elder-b', name: '演示熟客乙', guardianName: '演示联系人乙' },
  { id: 'elder-c', name: '演示熟客丙', guardianName: '演示联系人丙' },
  { id: 'elder-d', name: '演示熟客丁', guardianName: '演示联系人丁' },
] as const;
export type State = {
  today: string; version: number; paused: boolean; residents: Resident[]; arrivals: Arrival[]; leaves: Leave[];
  days: Day[]; tasks: CareTask[]; receipts: Record<string, { fingerprint: string; result: unknown }>;
};
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function ensure(condition: unknown, status: number, message: string): asserts condition {
  if (!condition) throw new ApiError(status, message);
}
export function businessDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function plusDays(date: string, amount: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + amount * 86400000).toISOString().slice(0, 10);
}
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function weekday(date: string): number { return new Date(`${date}T00:00:00Z`).getUTCDay(); }
export function initialState(today = businessDate()): State {
  return { today, version: 0, paused: false, residents: [], arrivals: [], leaves: [], tasks: [], receipts: {}, days: [{ date: today, open: true, revision: 0, reviewedRevision: null, reviewer: null }] };
}
export function staff(principal: Principal): void {
  ensure(principal.shopId === SHOP_ID && ['owner', 'backup'].includes(principal.role), 403, '只有本店授权店员可操作');
}
export function accessResident(state: State, principal: Principal, id: string, guardian = false): Resident {
  ensure(principal.shopId === SHOP_ID, 403, '不可跨店访问');
  const allowed = principal.role === 'owner' || principal.role === 'backup' || (principal.residentId === id && (principal.role === 'resident' || (guardian && principal.role === 'guardian')));
  ensure(allowed, 403, '不可访问其他角色或熟客资料');
  const resident = state.residents.find(item => item.id === id);
  ensure(resident, 404, '该模拟参与关系已不存在');
  return resident;
}
export function currentDay(state: State): Day { return state.days.find(item => item.date === state.today)!; }
export function invalidate(state: State, from = state.today, to = state.today): void {
  for (const day of state.days) if (day.date >= from && day.date <= to) day.revision += 1;
}
export function statusOn(state: State, resident: Resident, date: string): DailyStatus {
  if (resident.status === 'waiting') return 'waiting';
  if (resident.status === 'paused' || state.paused) return 'paused';
  if (state.arrivals.some(item => item.residentId === resident.id && item.date === date)) return 'arrival';
  if (date < resident.startDate) return 'not_started';
  if (state.leaves.some(item => item.residentId === resident.id && item.start <= date && item.end >= date)) return 'leave';
  const day = state.days.find(item => item.date === date);
  if (day && !day.open) return 'closed';
  if (!resident.weekdays.includes(weekday(date))) return 'unscheduled';
  if (!day || day.reviewedRevision !== day.revision) return 'unknown';
  return 'missing';
}
export function absence(state: State, resident: Resident): { dates: string[]; unknownDates: string[] } {
  const dates: string[] = [];
  const unknownDates: string[] = [];
  for (let date = state.today; date >= resident.startDate; date = plusDays(date, -1)) {
    const status = statusOn(state, resident, date);
    if (status === 'closed' || status === 'unscheduled') continue;
    if (status === 'unknown') { if (dates.length < resident.threshold) unknownDates.push(date); break; }
    if (status !== 'missing') break;
    dates.unshift(date);
  }
  return { dates, unknownDates };
}
export function reconcile(state: State): void {
  for (const resident of state.residents) {
    const { dates } = absence(state, resident);
    const actionable = resident.status === 'active' && !state.paused && dates.length >= resident.threshold;
    const relevant = state.tasks.filter(task => task.residentId === resident.id && !['cancelled', 'corrected'].includes(task.state));
    for (const task of relevant) {
      if (task.outcome === 'fake_pause' && resident.status === 'paused') { task.actionable = false; continue; }
      const basisStatuses = task.dates.map(date => statusOn(state, resident, date));
      const currentStatus = statusOn(state, resident, state.today);
      const waitingForReview = resident.status === 'active' && !state.paused && basisStatuses.every(status => status === 'missing' || status === 'unknown') && (basisStatuses.includes('unknown') || absence(state, resident).unknownDates.length > 0);
      task.actionable = actionable && task.dates.every(date => dates.includes(date));
      if (waitingForReview) { task.actionable = false; continue; }
      if (!task.actionable || ['arrival', 'leave', 'paused'].includes(currentStatus)) {
        const sameEpisode = actionable && task.dates.some(date => dates.includes(date));
        if (sameEpisode) {
          if (task.attempts > 0) { task.previousDates = task.previousDates ?? [...task.dates]; task.state = 'correction'; }
          task.dates = dates; task.actionable = true;
        } else task.state = task.attempts > 0 ? 'correction' : 'cancelled';
      }
    }
    if (actionable && !state.tasks.some(task => task.residentId === resident.id && task.state !== 'cancelled' && task.dates.some(date => dates.includes(date)))) {
      state.tasks.push({ id: randomUUID(), residentId: resident.id, dates, state: 'pending', assignee: null, attempts: 0, nextDate: null, outcome: null });
    }
  }
}
export function roster(state: State): RosterRow[] {
  return state.residents.map(resident => ({ resident, status: statusOn(state, resident, state.today), streak: absence(state, resident).dates.length, unknownDates: absence(state, resident).unknownDates, arrival: state.arrivals.find(item => item.residentId === resident.id && item.date === state.today) }));
}
export function staffView(state: State): StaffView {
  return { today: state.today, version: state.version, paused: state.paused, day: currentDay(state), residents: state.residents, roster: roster(state), tasks: state.tasks, days: state.days, leaves: state.leaves };
}
export function enroll(state: State, principal: Principal, input: { fixtureId: unknown; threshold: unknown; weekdays: unknown; simulatedElderConsent: unknown }): Resident {
  staff(principal);
  ensure(input.simulatedElderConsent === true, 400, '必须明确选择模拟本人同意；这不是真人同意');
  const fixture = FIXTURES.find(item => item.id === input.fixtureId);
  ensure(fixture, 400, '仅允许预置虚构角色，不接收真实信息');
  ensure(!state.residents.some(item => item.id === fixture.id), 409, '该演示角色已登记');
  ensure(typeof input.threshold === 'number' && [1, 2, 3].includes(input.threshold), 400, '阈值仅限数字 1/2/3');
  ensure(Array.isArray(input.weekdays) && input.weekdays.length > 0 && input.weekdays.length <= 7 && input.weekdays.every(item => Number.isInteger(item) && item >= 0 && item <= 6) && new Set(input.weekdays).size === input.weekdays.length, 400, '请选择有效且不重复的约定到店日');
  const resident: Resident = { ...fixture, threshold: Number(input.threshold), weekdays: input.weekdays as number[], elderConsent: true, guardianConsent: false, status: 'waiting', startDate: plusDays(state.today, 1) };
  state.residents.push(resident); invalidate(state); return resident;
}
export function guardianConsent(state: State, principal: Principal, accepted: unknown): void {
  ensure(principal.role === 'guardian' && principal.residentId, 403, '仅指定模拟联系人可接受或撤回自己的约定');
  ensure(typeof accepted === 'boolean', 400, '必须明确模拟接受或撤回');
  const resident = accessResident(state, principal, principal.residentId, true);
  if (resident.guardianConsent === accepted) return;
  resident.guardianConsent = accepted;
  if (!accepted) {
    state.arrivals = state.arrivals.filter(item => item.residentId !== resident.id);
    state.leaves = state.leaves.filter(item => item.residentId !== resident.id);
    state.receipts = {};
  }
  resident.status = accepted && resident.elderConsent ? 'active' : 'waiting';
  resident.startDate = plusDays(state.today, 1);
  invalidate(state, state.days[0].date, state.today);
  state.tasks = state.tasks.filter(item => item.residentId !== resident.id);
}
export function recordArrival(state: State, principal: Principal, id: string, witnessed: unknown): Arrival {
  const resident = accessResident(state, principal, id);
  ensure(resident.status === 'active' && !state.paused, 409, '模拟联系约定未生效或服务已暂停');
  if (principal.role === 'owner' || principal.role === 'backup') ensure(witnessed === true, 400, '店员代点须确认当面见到（模拟）');
  else ensure(principal.role === 'resident', 403, '该角色不能记录到店');
  const existing = state.arrivals.find(item => item.residentId === id && item.date === state.today);
  if (existing) return existing;
  const record: Arrival = { residentId: id, date: state.today, source: principal.role === 'resident' ? 'self' : 'staff', operator: principal.id };
  state.arrivals.push(record); invalidate(state); return record;
}
export function removeArrival(state: State, principal: Principal, id: string): void {
  staff(principal); accessResident(state, principal, id);
  state.arrivals = state.arrivals.filter(item => !(item.residentId === id && item.date === state.today)); invalidate(state);
}
export function addLeave(state: State, principal: Principal, id: string, start: unknown, end: unknown): Leave {
  accessResident(state, principal, id);
  ensure(principal.role !== 'guardian', 403, '联系人不能修改请假');
  ensure(validDate(start) && validDate(end) && start <= end && start >= state.days[0].date && end <= plusDays(state.today, 30), 400, '请假仅选演示开始日起至未来 30 天内的日期');
  ensure(!state.leaves.some(item => item.residentId === id && item.start <= end && item.end >= start), 409, '请假日期重叠，请先撤销已有请假');
  const leave = { id: randomUUID(), residentId: id, start, end };
  state.leaves.push(leave); invalidate(state, start, end); return leave;
}
export function cancelLeave(state: State, principal: Principal, id: string, leaveId: unknown): void {
  accessResident(state, principal, id);
  const leave = state.leaves.find(item => item.id === leaveId && item.residentId === id);
  ensure(leave, 404, '请假不存在');
  state.leaves = state.leaves.filter(item => item !== leave); invalidate(state, leave.start, leave.end);
}
export function withdraw(state: State, principal: Principal, id: string): void {
  accessResident(state, principal, id);
  ensure(principal.role !== 'guardian', 403, '联系人只能撤回自己的联系约定');
  state.residents = state.residents.filter(item => item.id !== id);
  state.arrivals = state.arrivals.filter(item => item.residentId !== id);
  state.leaves = state.leaves.filter(item => item.residentId !== id);
  state.tasks = state.tasks.filter(item => item.residentId !== id);
  state.receipts = {};
  invalidate(state, state.days[0].date, state.today);
}
export function review(state: State, principal: Principal, date: unknown): void {
  staff(principal);
  ensure(!state.paused, 409, '暂停期间不能伪造每日核对');
  const day = state.days.find(item => item.date === date);
  ensure(day, 400, '只能核对已存在的模拟日期');
  day.reviewedRevision = day.revision; day.reviewer = principal.id;
}
export function changeDay(state: State, principal: Principal, open: unknown): void {
  staff(principal); ensure(typeof open === 'boolean', 400, '营业状态须明确');
  currentDay(state).open = open; invalidate(state);
}
export function advanceDay(state: State, principal: Principal): void {
  staff(principal);
  ensure(state.days.length < 90, 409, '演示最多 90 天，请清空夹具重新演练');
  state.today = plusDays(state.today, 1);
  state.days.push({ date: state.today, open: true, revision: 0, reviewedRevision: null, reviewer: null });
}
export function claimTask(state: State, principal: Principal, id: string): void {
  staff(principal); reconcile(state);
  const task = state.tasks.find(item => item.id === id);
  ensure(task && ['pending', 'followup', 'claimed', 'correction'].includes(task.state) && (task.actionable !== false || task.state === 'correction'), 409, '事项依据已失效、待补核资料或已结束');
  ensure(!task.assignee || task.assignee === principal.id, 409, '事项已由其他授权人员领取');
  task.assignee = principal.id;
  if (task.state !== 'correction') task.state = 'claimed';
}
export function releaseTask(state: State, principal: Principal, id: string): void {
  staff(principal);
  const task = state.tasks.find(item => item.id === id);
  ensure(task && task.assignee === principal.id && ['claimed', 'followup', 'correction'].includes(task.state), 403, '只能交接自己负责的未结事项');
  task.assignee = null;
  if (task.state !== 'correction') task.state = 'pending';
}
export function contactResult(state: State, principal: Principal, id: string, outcome: unknown, nextDate: unknown): void {
  staff(principal); reconcile(state);
  const task = state.tasks.find(item => item.id === id);
  ensure(task && task.actionable !== false && ['claimed', 'followup'].includes(task.state) && task.assignee === principal.id, 409, '请先领取仍有效且已核对的事项');
  ensure(typeof outcome === 'string' && ['fake_handoff', 'fake_no_answer', 'fake_pause'].includes(outcome), 400, '仅允许字符串形式的假数据联系结果');
  ensure(task.attempts < 3 || outcome === 'fake_pause', 409, '已达三次模拟尝试，请暂停约定，不自动重试');
  if (outcome === 'fake_no_answer') ensure(validDate(nextDate) && nextDate >= state.today && nextDate <= plusDays(state.today, 7), 400, '未接通须选择未来 7 天内的下次处理日期');
  task.attempts += 1; task.outcome = outcome as CareTask['outcome'];
  task.nextDate = outcome === 'fake_no_answer' ? nextDate as string : null;
  task.state = outcome === 'fake_no_answer' ? 'followup' : 'closed';
  if (outcome === 'fake_pause') {
    const resident = state.residents.find(item => item.id === task.residentId)!;
    resident.status = 'paused'; task.state = 'closed';
  }
}
export function correctTask(state: State, principal: Principal, id: string): void {
  staff(principal);
  const task = state.tasks.find(item => item.id === id);
  ensure(task && task.state === 'correction' && task.assignee === principal.id, 409, '仅负责人员可记录模拟更正');
  task.state = 'corrected';
}
