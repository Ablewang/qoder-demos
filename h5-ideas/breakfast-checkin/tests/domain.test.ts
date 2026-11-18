import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, SHOP_ID, absence, accessResident, addLeave, advanceDay, businessDate, cancelLeave, changeDay, claimTask, contactResult, correctTask, enroll, guardianConsent, initialState, plusDays, reconcile, recordArrival, releaseTask, removeArrival, review, staffView, statusOn, validDate, withdraw } from '../server/domain.ts';
import type { Principal } from '../src/types.ts';

const owner: Principal = { role: 'owner', id: 'owner', shopId: SHOP_ID };
const backup: Principal = { role: 'backup', id: 'backup', shopId: SHOP_ID };
const self: Principal = { role: 'resident', id: 'resident:elder-a', residentId: 'elder-a', shopId: SHOP_ID };
const guardian: Principal = { role: 'guardian', id: 'guardian:elder-a', residentId: 'elder-a', shopId: SHOP_ID };
function setup(threshold = 2, weekdays = [0, 1, 2, 3, 4, 5, 6]) {
  const state = initialState('2026-11-17');
  const resident = enroll(state, owner, { fixtureId: 'elder-a', threshold, weekdays, simulatedElderConsent: true });
  guardianConsent(state, guardian, true); reconcile(state);
  return { state, resident };
}
function checkedDay(state: ReturnType<typeof initialState>): void { advanceDay(state, owner); review(state, owner, state.today); reconcile(state); }
function rejects403(operation: () => unknown): void { assert.throws(operation, (error: unknown) => error instanceof ApiError && error.status === 403); }

test('上海业务日期不受客户端日期或 UTC 跨午夜影响', () => {
  assert.equal(businessDate(new Date('2026-11-17T16:01:00Z')), '2026-11-18');
  assert.equal(plusDays('2026-12-31', 1), '2027-01-01');
  assert.equal(validDate('2026-02-30'), false);
});
test('必须模拟本人同意，只接受预置角色与约定日', () => {
  const state = initialState();
  assert.throws(() => enroll(state, owner, { fixtureId: 'real-name', threshold: 2, weekdays: [1], simulatedElderConsent: true }));
  assert.throws(() => enroll(state, owner, { fixtureId: 'elder-a', threshold: 2, weekdays: [1], simulatedElderConsent: false }));
  assert.throws(() => enroll(state, owner, { fixtureId: 'elder-a', threshold: 2, weekdays: [1, 1], simulatedElderConsent: true }));
});
test('默认待接受，不由店主代替联系人接受', () => {
  const state = initialState();
  const resident = enroll(state, owner, { fixtureId: 'elder-a', threshold: 2, weekdays: [1], simulatedElderConsent: true });
  assert.equal(resident.guardianConsent, false); assert.equal(resident.status, 'waiting');
  rejects403(() => guardianConsent(state, owner, true));
  assert.throws(() => recordArrival(state, self, 'elder-a', false));
});
test('新报名不追溯，次日才开始约定核对', () => {
  const { state, resident } = setup(1);
  review(state, owner, state.today); reconcile(state);
  assert.equal(statusOn(state, resident, state.today), 'not_started'); assert.equal(state.tasks.length, 0);
  checkedDay(state); assert.equal(state.tasks.length, 1);
});
for (const threshold of [1, 2, 3]) test(`阈值 ${threshold} 只统计已核对的约定营业日`, () => {
  const { state } = setup(threshold);
  for (let index = 1; index <= threshold; index += 1) { checkedDay(state); assert.equal(state.tasks.length, index === threshold ? 1 : 0); }
});
test('闭店跳过，不累加缺记录', () => {
  const { state, resident } = setup(); checkedDay(state);
  advanceDay(state, owner); changeDay(state, owner, false); review(state, owner, state.today); reconcile(state);
  assert.equal(absence(state, resident).dates.length, 1); assert.equal(state.tasks.length, 0);
  checkedDay(state); assert.equal(state.tasks.length, 1);
});
test('非约定到店日跳过', () => {
  const { state, resident } = setup(2, [3, 5]); checkedDay(state);
  checkedDay(state); assert.equal(statusOn(state, resident, state.today), 'unscheduled');
  assert.equal(absence(state, resident).dates.length, 1); checkedDay(state); assert.equal(state.tasks.length, 1);
});
test('未知中断可靠推断，只待补核资料', () => {
  const { state, resident } = setup(); checkedDay(state); advanceDay(state, owner); advanceDay(state, owner); review(state, owner, state.today); reconcile(state);
  assert.equal(absence(state, resident).dates.length, 1); assert.deepEqual(absence(state, resident).unknownDates, ['2026-11-19']); assert.equal(state.tasks.length, 0);
});
test('补核未知日期后才可能进入事项', () => {
  const { state } = setup(); checkedDay(state); advanceDay(state, owner); advanceDay(state, owner); review(state, owner, state.today); reconcile(state);
  review(state, backup, '2026-11-19'); reconcile(state); assert.equal(state.tasks.length, 1);
});
test('请假中断而不是累计到恢复日', () => {
  const { state, resident } = setup(); checkedDay(state); advanceDay(state, owner); addLeave(state, self, resident.id, state.today, state.today); review(state, owner, state.today); reconcile(state);
  assert.equal(absence(state, resident).dates.length, 0); checkedDay(state); assert.equal(state.tasks.length, 0); checkedDay(state); assert.equal(state.tasks.length, 1);
});
test('补登记请假与撤销请假使相关核对失效', () => {
  const { state, resident } = setup(); checkedDay(state); checkedDay(state);
  const leave = addLeave(state, self, resident.id, '2026-11-18', '2026-11-18'); reconcile(state);
  assert.equal(state.tasks[0].state, 'cancelled');
  cancelLeave(state, self, resident.id, leave.id); reconcile(state);
  assert.equal(statusOn(state, resident, '2026-11-18'), 'unknown');
});
test('本人/店员重复点收敛，保留第一个来源', () => {
  const { state } = setup(); advanceDay(state, owner);
  const first = recordArrival(state, self, 'elder-a', false);
  const second = recordArrival(state, backup, 'elder-a', true);
  assert.equal(state.arrivals.length, 1); assert.equal(first, second); assert.equal(first.source, 'self');
});
test('代点须授权并确认当面见到；无全员到店', () => {
  const { state } = setup();
  assert.throws(() => recordArrival(state, owner, 'elder-a', false));
  rejects403(() => recordArrival(state, guardian, 'elder-a', true));
  rejects403(() => accessResident(state, { ...owner, shopId: 'another-shop' }, 'elder-a'));
  rejects403(() => accessResident(state, { ...self, residentId: 'elder-b' }, 'elder-a'));
});
test('撤销已核对误点后先重新核对', () => {
  const { state, resident } = setup(1); advanceDay(state, owner); recordArrival(state, self, resident.id, false); review(state, owner, state.today); reconcile(state);
  removeArrival(state, owner, resident.id); reconcile(state); assert.equal(statusOn(state, resident, state.today), 'unknown'); assert.equal(state.tasks.length, 0);
  review(state, owner, state.today); reconcile(state); assert.equal(state.tasks.length, 1);
});
test('晚到取消未联系事项', () => {
  const { state } = setup(); checkedDay(state); checkedDay(state);
  recordArrival(state, self, 'elder-a', false); reconcile(state); assert.equal(state.tasks[0].state, 'cancelled');
});
test('已假联系后晚到保留更正待办', () => {
  const { state } = setup(); checkedDay(state); checkedDay(state); const task = state.tasks[0];
  claimTask(state, owner, task.id); contactResult(state, owner, task.id, 'fake_handoff', null); reconcile(state);
  assert.equal(task.state, 'closed'); recordArrival(state, self, 'elder-a', false); reconcile(state); assert.equal(task.state, 'correction');
  correctTask(state, owner, task.id); assert.equal(task.state, 'corrected');
});
test('未知当天冻结旧事项，不虚构误报更正，也不继续联系', () => {
  const { state } = setup(); checkedDay(state); checkedDay(state); const task = state.tasks[0]; claimTask(state, owner, task.id);
  advanceDay(state, owner); reconcile(state); assert.equal(task.state, 'claimed'); assert.equal(task.actionable, false);
  assert.throws(() => contactResult(state, owner, task.id, 'fake_handoff', null));
  review(state, owner, state.today); reconcile(state); assert.equal(task.actionable, true);
});
test('连续事件重复核对仅有一个事项', () => {
  const { state } = setup(); checkedDay(state); checkedDay(state); review(state, backup, state.today); reconcile(state); checkedDay(state);
  assert.equal(state.tasks.length, 1);
});
test('未接通保留跟进日期；最多三次人工演练，然后暂停', () => {
  const { state } = setup(1); checkedDay(state); const task = state.tasks[0]; claimTask(state, owner, task.id);
  assert.throws(() => contactResult(state, owner, task.id, 'fake_no_answer', null));
  for (let index = 0; index < 3; index += 1) { contactResult(state, owner, task.id, 'fake_no_answer', state.today); reconcile(state); }
  assert.equal(task.state, 'followup'); assert.throws(() => contactResult(state, owner, task.id, 'fake_handoff', null));
  contactResult(state, owner, task.id, 'fake_pause', null); reconcile(state); assert.equal(task.state, 'closed'); assert.equal(state.residents[0].status, 'paused');
});
test('交接不自动接班，目标替补必须主动领取', () => {
  const { state } = setup(1); checkedDay(state); const task = state.tasks[0]; claimTask(state, owner, task.id);
  assert.throws(() => claimTask(state, backup, task.id)); releaseTask(state, owner, task.id); assert.equal(task.assignee, null);
  claimTask(state, backup, task.id); assert.equal(task.assignee, 'backup');
});
test('联系人撤回立即停止事项，不能悄悄换联系人', () => {
  const { state } = setup(1); checkedDay(state); guardianConsent(state, guardian, false); reconcile(state);
  assert.equal(state.residents[0].status, 'waiting'); assert.equal(state.tasks.length, 0);
  assert.throws(() => recordArrival(state, self, 'elder-a', false));
});
test('本人退出立即清除假记录、请假、联系人状态和事项', () => {
  const { state } = setup(); recordArrival(state, self, 'elder-a', false); addLeave(state, self, 'elder-a', state.today, state.today);
  withdraw(state, self, 'elder-a'); assert.equal(state.residents.length + state.arrivals.length + state.leaves.length + state.tasks.length, 0);
  assert.throws(() => accessResident(state, self, 'elder-a'));
});

test('联系人撤回同步删除假记录/请假/含内容回执', () => {
  const { state } = setup(); recordArrival(state, self, 'elder-a', false); addLeave(state, self, 'elder-a', state.today, state.today);
  state.receipts.sample = { fingerprint: 'fake', result: state.residents[0] };
  guardianConsent(state, guardian, false);
  assert.equal(state.arrivals.length + state.leaves.length + state.tasks.length + Object.keys(state.receipts).length, 0);
});
test('同意重复接受不会重新起算或清除既有事项', () => {
  const { state, resident } = setup(1); checkedDay(state); const start = resident.startDate;
  guardianConsent(state, guardian, true); reconcile(state);
  assert.equal(resident.startDate, start); assert.equal(state.tasks.length, 1);
});
test('数组/对象假结果不能绕过未接通规则结案', () => {
  const { state } = setup(1); checkedDay(state); const task = state.tasks[0]; claimTask(state, owner, task.id);
  assert.throws(() => contactResult(state, owner, task.id, ['fake_no_answer'], null));
  assert.throws(() => contactResult(state, owner, task.id, { value: 'fake_handoff' }, null));
  assert.equal(task.attempts, 0); assert.equal(task.state, 'claimed');
});
test('闭店更正同一连续段只保留原事项，更正后不再重复联系', () => {
  const { state } = setup(2); advanceDay(state, owner); checkedDay(state); checkedDay(state);
  const task = state.tasks[0]; claimTask(state, owner, task.id); contactResult(state, owner, task.id, 'fake_handoff', null); reconcile(state);
  review(state, owner, '2026-11-18'); reconcile(state); changeDay(state, owner, false); reconcile(state);
  assert.equal(state.tasks.length, 1); assert.equal(task.state, 'correction');
  assert.deepEqual(task.dates, ['2026-11-18', '2026-11-19']); assert.deepEqual(task.previousDates, ['2026-11-19', '2026-11-20']);
  correctTask(state, owner, task.id); reconcile(state); checkedDay(state);
  assert.equal(state.tasks.length, 1); assert.equal(task.state, 'corrected');
});
test('七天前失效的约定营业日仍可展示并补核', () => {
  const { state } = setup(2, [1]);
  while (state.today < '2026-11-30') checkedDay(state);
  assert.equal(state.tasks.length, 1);
  enroll(state, owner, { fixtureId: 'elder-b', threshold: 2, weekdays: [1], simulatedElderConsent: true });
  guardianConsent(state, { role: 'guardian', id: 'guardian:elder-b', residentId: 'elder-b', shopId: SHOP_ID }, true); reconcile(state);
  assert.equal(state.tasks[0].actionable, false);
  assert(staffView(state).days.some(day => day.date === '2026-11-23' && day.revision !== day.reviewedRevision));
  review(state, backup, '2026-11-23'); review(state, backup, '2026-11-30'); reconcile(state);
  assert.equal(state.tasks.length, 1); assert.equal(state.tasks[0].actionable, true);
});
