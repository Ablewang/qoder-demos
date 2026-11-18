import './style.css';
import type { Arrival, CareTask, GuardianView, MeView, PublicView, RosterRow, SessionView, StaffView } from './types.ts';

type Page = 'home' | 'login' | 'register' | 'staff';
type Tab = 'today' | 'roster' | 'days' | 'admin';
const app = document.querySelector<HTMLDivElement>('#app')!;
let session: SessionView | null = null;
let shop: PublicView | null = null;
let staffView: StaffView | null = null;
let me: MeView | null = null;
let guardian: (GuardianView & { version: number }) | null = null;
let fixtures: { id: string; name: string }[] = [];
let page: Page = 'home';
let tab: Tab = 'today';
let intent: 'staff' | 'register' = 'staff';
let confirming = '';
let returnFocus = '';
let leaveOpen = false;
let notice = '';
let noticeInline = false;
let busy = false;
let failed = false;
let confirmedSave = '';
const ACTIVE = ['pending', 'claimed', 'followup', 'correction'];
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const labels = { owner: '模拟店主', backup: '授权替补（模拟）', resident: '模拟熟客本人', guardian: '模拟联系人' };
const statusLabels: Record<string, string> = { arrival: '今天已记录', leave: '请假中，不计缺记录', closed: '店休，不计缺记录', unscheduled: '非约定到店日', unknown: '今天未核对，状态未知', missing: '核对后无记录', waiting: '等待模拟联系人接受', not_started: '明日起开始核对', paused: '联系约定已暂停' };
const taskLabels: Record<string, string> = { pending: '待人工核实', claimed: '已领取，待假联系', followup: '未接通，仍待跟进', closed: '假联系结果已记录', cancelled: '依据已变化，事项撤销', correction: '已联系但依据变化，待更正', corrected: '假更正已记录' };
class ApiFailure extends Error { constructor(message: string, readonly status: number) { super(message); } }
function e(value: unknown): string { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!); }
function button(text: string, action: string, id = '', className = 'secondary', disabled = false): string {
  return `<button type="button" class="${className}" data-action="${e(action)}" data-id="${e(id)}" ${disabled ? 'disabled' : ''}>${e(text)}</button>`;
}
type Ask = { question?: string; keep?: string; tone?: 'danger' | 'plain'; trigger?: string };
// The inline confirmation is only a UI pause; the server still enforces role, CSRF and version on the real request.
function guarded(text: string, action: string, id: string, consequence: string, confirmText: string, disabled = false, ask: Ask = {}): string {
  const key = `${action}:${id}`;
  const tone = ask.tone ?? 'danger';
  if (confirming !== key) return button(text, 'ask', key, ask.trigger ?? (tone === 'danger' ? 'danger' : 'secondary'), disabled);
  return `<div class="confirm ${tone}" role="group" tabindex="-1" data-confirm="${e(key)}" aria-label="${e(text)}：需要确认"><p><strong>${e(ask.question ?? `${text}？`)}</strong></p><p>${e(consequence)}</p><div class="pair">${button(confirmText, action, id, tone === 'danger' ? 'danger solid' : 'primary')}${button(ask.keep ?? '先不做，保留', 'cancel-confirm', key)}</div></div>`;
}
function md(date: string): string { const [, month, day] = date.split('-'); return `${Number(month)}月${Number(day)}日`; }
function dayLabel(date: string): string { return `${md(date)} 周${WEEK[new Date(`${date}T00:00:00Z`).getUTCDay()]}`; }
function dateList(dates: string[]): string { return dates.map(md).join('、'); }
function weekdaysText(days: number[]): string { return days.length === 7 ? '每天' : `周${[...days].sort((a, b) => (a + 6) % 7 - (b + 6) % 7).map(day => WEEK[day]).join('、')}`; }
function mark(source: 'self' | 'staff'): string { return `<span class="mark ${source}" aria-hidden="true"></span>`; }
function sourceText(arrival: Arrival): string { return arrival.source === 'self' ? '本人打招呼已记录' : `店员当面代记 · ${labels[arrival.operator as 'owner' | 'backup'] ?? '店员'}`; }
function nameOf(id: string): string { return staffView?.residents.find(item => item.id === id)?.name ?? '已删除角色'; }
async function api<T>(path: string, input?: Record<string, unknown>, mutation = false): Promise<T> {
  const payload = input ? { ...input } : undefined;
  if (payload && mutation) { payload.version = staffView?.version ?? me?.version ?? guardian?.version; payload.requestId = crypto.randomUUID(); }
  const response = await fetch(`/api${path}`, { method: payload ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: payload ? { 'Content-Type': 'application/json', ...(session ? { 'X-CSRF-Token': session.csrf } : {}) } : {}, body: payload ? JSON.stringify(payload) : undefined });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) {
    if (response.status === 401) { session = null; staffView = null; me = null; guardian = null; }
    throw new ApiFailure(result.error ?? '操作未完成', response.status);
  }
  return result;
}
async function refresh(): Promise<void> {
  failed = false;
  staffView = null; me = null; guardian = null;
  if (!session) return;
  if (['owner', 'backup'].includes(session.principal.role)) {
    staffView = await api<StaffView>('/staff'); fixtures = await api<typeof fixtures>('/fixtures');
  } else if (session.principal.role === 'resident') me = await api<MeView>('/me');
  else guardian = await api<GuardianView & { version: number }>('/guardian');
}
function shell(content: string, home: boolean): string {
  const banner = notice && !noticeInline ? `<p class="notice ${failed ? 'error' : ''}" role="status" tabindex="-1">${e(notice)}</p>` : '';
  const role = session ? `<span class="as">${e(labels[session.principal.role])}</span>` : '';
  const footer = home ? '' : `<footer class="bounds"><details><summary>记录与演练边界</summary><p><span class="legend">${mark('self')}本人打招呼</span><span class="legend">${mark('staff')}店员当面代记</span>只说明今天点过招呼，或店员当面见到；不证明到店，不是安全判断。</p><p>“尚未记录”是今天还没核对，状态未知；“核对后无记录”只是没有记录。两者都不是缺席结论，也不代表出事。连续达到约定天数，才出现“待人工核实”，由店员人工联系；系统不自动通知。没有待核实事项，也不代表所有人都好。</p><p>不定位、不监控、不推送、不拨号、不安排上门。全部为虚构演示数据，未进行真人试点。</p></details></footer>`;
  return `<p class="demo"><span>本地演示数据 · 虚构角色</span><span>不提供安全保障</span></p><header class="bar"><a class="shop" href="#" data-action="home">${e(shop?.shopName ?? '暖灶早点铺')}</a>${role}</header>${banner}<main class="sheet">${content}</main>${footer}`;
}
function unknownPanel(title: string, after = ''): string {
  noticeInline = true;
  return `<section class="unknown-state"><h1>${e(title)}</h1><p class="notice error" role="status">${e(notice || '还没读到本地资料。')}</p>${button('重新读取资料', 'refresh', '', 'primary wide')}<p class="note">读取失败不代表名单为空、也不代表没人缺记录。重新读到最新资料前，不能据此核对或联系。</p><div class="exits">${after}</div></section>`;
}
function home(): string {
  return `<section class="door"><p class="kicker">本店熟客自愿参加</p><h1>常来吃早饭的熟客，每天在店里打个招呼</h1><p>店里只记今天你点过招呼，或店员当面见到你。约定的营业日连续几天都没记录，店员会人工联系你事先同意的联系人。</p></section><ol class="rows entries"><li class="row"><div class="who-block"><b class="who">我是熟客</b><p class="note">想参加：不用注册，请店员当面帮你登记。</p></div><div class="side">${button('请店员协助登记', 'assist', '', 'primary')}</div></li><li class="row"><div class="who-block"><b class="who">我是店员</b><p class="note">店主或授权替补，登录后看今天的名单。</p></div><div class="side">${button('店员登录', 'login')}</div></li></ol><section class="terms-block" aria-labelledby="terms"><h2 id="terms">先说清楚</h2><dl class="terms"><div><dt>自愿</dt><dd>随时可以退出并删除资料，不影响买早餐。</dd></div><div><dt>只记来没来</dt><dd><span class="legend">${mark('self')}本人打招呼</span><span class="legend">${mark('staff')}店员当面代记</span>不定位、不监控、不推送、不拨号。</dd></div><div><dt>不是安全保障</dt><dd>有记录不代表平安，没记录也不代表出事；不替代家人原来的联系。</dd></div><div><dt>名单不公开</dt><dd>这个公用页面不显示任何熟客或联系人。</dd></div><div><dt>演示</dt><dd>全部是虚构角色和假数据，请勿填写真实姓名或电话。</dd></div></dl></section>`;
}
function login(): string {
  const assist = intent === 'register';
  return `<section class="form-page"><p class="kicker">${assist ? '熟客请把手机交给店员' : '店主 / 授权替补'}</p><h1>${assist ? '店员登录，协助登记' : '店员登录'}</h1><p>${assist ? '这一步由店员完成。登录后直接打开登记表，和熟客一起读知情说明。' : '登录后先看今天的营业名单。'}</p><form data-form="login"><fieldset class="choice"><legend>模拟账号</legend><label><input type="radio" name="account" value="owner" checked />店主</label><label><input type="radio" name="account" value="backup" />授权替补</label></fieldset><label class="field">本机模拟口令<input name="password" type="password" autocomplete="off" required maxlength="200" /></label><button class="primary wide" type="submit">${assist ? '登录并打开登记表' : '登录'}</button></form><div class="exits">${button('返回', 'home', '', 'link')}</div><details class="tech"><summary>口令从哪里来（技术说明）</summary><p>每台机器自动生成独立的模拟口令，不是四位数密码。在项目终端运行 <code>pnpm credentials</code> 查看。登录状态只放在本机受保护的 Cookie，不写入网址或浏览器存储。</p></details></section>`;
}
function registration(): string {
  if (!staffView) return unknownPanel('资料状态未知', button('返回今天', 'staff', '', 'link'));
  const available = fixtures.filter(item => !staffView!.residents.some(resident => resident.id === item.id));
  const form = available.length ? `<form data-form="enroll"><fieldset class="choice list"><legend>选择虚构熟客</legend>${available.map((item, index) => `<label><input type="radio" name="fixtureId" value="${e(item.id)}" ${index ? '' : 'checked'} />${e(item.name)}</label>`).join('')}</fieldset><fieldset class="choice"><legend>约定营业日连续几天核对后无记录，才人工核实？</legend>${[1, 2, 3].map(value => `<label><input type="radio" name="threshold" value="${value}" ${value === 2 ? 'checked' : ''} />${value} 天${value === 2 ? '（默认）' : ''}</label>`).join('')}</fieldset><fieldset class="choice"><legend>约定到店日</legend>${[1, 2, 3, 4, 5, 6, 0].map(day => `<label><input type="checkbox" name="weekdays" value="${day}" checked />周${WEEK[day]}</label>`).join('')}</fieldset><label class="check"><input type="checkbox" name="consent" required />我在演练模拟本人自愿参加；不是记录真人同意</label><button class="primary wide" type="submit">保存模拟登记</button></form>` : '<p class="line">预置虚构角色都已登记。退出并删除某位的资料后，才能再演练登记。</p>';
  return `<section class="form-page"><p class="kicker">店员协助 · 全部为虚构角色</p><h1>登记参加打招呼</h1><h2 class="sub">请和熟客一起读完</h2><ol class="consent"><li>只保存预置虚构角色、约定到店日、招呼记录和请假，没有真实姓名或联系方式。</li><li>店员每天收摊人工核对。约定营业日连续核对后无记录达到约定天数，店员才人工核实；可能漏记、忙忘或延迟。</li><li>记录只说明点过招呼或店员当面见到，不证明到店。不是监护或安全保障；不定位、不监控、不推送。</li><li>联系人要在自己的受限页面选择“模拟接受”，第二天起才开始核对。当前操作不是任何真人的同意证据。</li><li>本人可随时退出，立即删除相关假数据，不影响买早餐。</li></ol>${form}<div class="exits">${button('先不参加，返回', 'staff', '', 'link')}</div></section>`;
}
function step(n: number, title: string, count: number | null, state: 'now' | 'done' | 'wait', body: string): string {
  return `<section class="step ${state}" aria-labelledby="step-${n}"><span class="step-n" aria-hidden="true">${n}</span><h2 id="step-${n}">${e(title)}${count ? ` <span class="n">${count}</span>` : ''}</h2>${body}</section>`;
}
function unrecorded(view: StaffView): RosterRow[] {
  return view.roster.filter(row => row.resident.status === 'active' && !row.arrival && ['unknown', 'missing'].includes(row.status));
}
function witnessButton(id: string, name: string, disabled: boolean): string {
  return `<button type="button" class="witness" data-action="witness" data-id="${e(id)}" aria-label="现在当面见到：${e(name)}" ${disabled ? 'disabled' : ''}>${mark('staff')}现在当面见到</button>`;
}
function witnessHint(): string {
  return `<p class="witness-hint">${mark('staff')}<span>店员当面代记，不代表平安。</span></p>`;
}
function witnessRow(row: RosterRow, view: StaffView): string {
  const older = row.unknownDates.filter(date => date !== view.today);
  const notes = [older.length ? `${dateList(older)}未核对 · 未知，不当缺席` : '', row.status === 'missing' && row.streak ? `已连续 ${row.streak} 个约定营业日核对后无记录，满 ${row.resident.threshold} 个才人工核实` : ''].filter(Boolean);
  return `<li class="row" data-resident="${e(row.resident.id)}"><b class="who">${e(row.resident.name)}</b><div class="side">${witnessButton(row.resident.id, row.resident.name, view.paused)}</div>${notes.map(text => `<p class="note">${e(text)}</p>`).join('')}</li>`;
}
function taskRow(task: CareTask, today: string): string {
  const mine = task.assignee === session?.principal.id;
  const actionable = task.actionable !== false;
  const active = ACTIVE.includes(task.state);
  let main = '';
  if (active && !task.assignee && (actionable || task.state === 'correction')) main = button('领取此人工事项', 'claim', task.id, 'primary');
  else if (mine && task.state === 'correction') main = button('标记假更正已完成', 'correct', task.id, 'primary');
  else if (mine && actionable && ['claimed', 'followup'].includes(task.state)) main = `<form data-form="result" data-id="${e(task.id)}" class="result"><fieldset class="choice list"><legend>手工记录假联系结果</legend><label><input type="radio" name="outcome" value="fake_handoff" required />模拟对方已接手（不等于安全）</label><label><input type="radio" name="outcome" value="fake_no_answer" />模拟未接通，保持跟进</label><label><input type="radio" name="outcome" value="fake_pause" />暂停此模拟联系约定</label></fieldset><label class="field">未接通时，下次处理日期<input type="date" name="nextDate" value="${e(today)}" min="${e(today)}" /></label><button type="submit" class="primary">记录假联系结果</button></form>`;
  const correcting = task.state === 'correction';
  const basis = correcting && !task.previousDates ? `原依据（已不成立，待更正）：${dateList(task.dates)}核对后无记录` : `依据：${dateList(task.dates)}核对后无记录`;
  const meta = [basis, task.previousDates ? `原依据（待更正）：${dateList(task.previousDates)}` : '', `${task.assignee ? `负责：${labels[task.assignee as 'owner' | 'backup']}` : '尚未领取'} · 假尝试 ${task.attempts} 次`, task.nextDate ? `下次处理：${md(task.nextDate)}` : '', correcting ? '之前的假联系记录需更正，不再联系' : !actionable && active ? '资料待补核，先核对相关日期，不能联系' : '', task.assignee && !mine && active ? '由对方处理中，交接后才可领取' : ''].filter(Boolean);
  return `<li class="row task ${task.state}" data-task="${e(task.id)}"><b class="who">${e(nameOf(task.residentId))}</b><span class="state">${e(taskLabels[task.state])}</span><ul class="meta">${meta.map(text => `<li>${e(text)}</li>`).join('')}</ul>${main ? `<div class="task-act">${main}</div>` : ''}${mine && active ? `<div class="task-act">${button('交接，等对方主动领取', 'release', task.id, 'link')}</div>` : ''}</li>`;
}
function frozenRow(task: CareTask, view: StaffView): string {
  const blocking = view.roster.find(row => row.resident.id === task.residentId)?.unknownDates ?? [];
  const when = blocking.length ? blocking.map(date => date === view.today ? '今天' : md(date)).join('、') : '相关日期';
  return `<li class="row task frozen"><b class="who">${e(nameOf(task.residentId))}</b><span class="state">${e(taskLabels[task.state])}</span><p class="note">先核对${e(when)}，才能处理；未知不当缺席。</p></li>`;
}
function reviewConsequence(view: StaffView, date: string, missing: RosterRow[]): string {
  const day = view.days.find(item => item.date === date);
  if (day && !day.open) return '这天店休，核对只确认不计缺记录。';
  if (date !== view.today) return '这天约定到店、却没有记录的熟客，会记为“核对后无记录”。不是缺席结论，也不代表出事。';
  if (!missing.length) return '约定今天到店的熟客都有记录，核对后今天就结清。仍不是安全判断。';
  return `${missing.map(row => row.resident.name).join('、')}今天会记为“核对后无记录”。这不是缺席结论，也不代表出事；连续达到各自约定的天数，才会出现需要人工跟进的事项。`;
}
function todayTab(view: StaffView): string {
  const reviewed = view.day.reviewedRevision === view.day.revision;
  const changed = view.day.reviewedRevision !== null && !reviewed;
  const self = session!.principal.id;
  const rank = (task: CareTask) => task.assignee === self ? 0 : !task.assignee ? 1 : 2;
  const active = view.tasks.filter(task => ACTIVE.includes(task.state)).sort((a, b) => rank(a) - rank(b));
  const ready = active.filter(task => task.actionable !== false || task.state === 'correction');
  const frozen = active.filter(task => !ready.includes(task));
  const stale = [...new Set(view.roster.flatMap(row => row.unknownDates).filter(date => date !== view.today))].sort();
  const missing = unrecorded(view);
  const live = view.residents.some(resident => resident.status === 'active');
  const step1 = view.paused ? '<p class="line">全店已暂停，今天先不记招呼，也不计缺记录。</p>' : !view.day.open ? '<p class="line">今天店休，不计缺记录。</p>' : missing.length ? `<p class="note">${reviewed ? '今天核对后无记录，不是缺席。之后见到仍可记，记后要重新核对。' : '尚未记录 · 未核对，未知不当缺席。'}</p>${witnessHint()}<ol class="rows">${missing.map(row => witnessRow(row, view)).join('')}</ol>` : `<p class="line">${live ? '约定今天到店的熟客都有记录了。' : '还没有生效的登记。登记后要联系人接受，第二天起才开始记。'}</p>`;
  const reviewToday = view.paused ? '<p class="line">全店暂停中，不能核对。</p>' : reviewed ? `<p class="line done-line"><span class="tick" aria-hidden="true"></span>今日已核对 · ${e(labels[view.day.reviewer as 'owner' | 'backup'] ?? '店员')}</p>` : `${changed ? '<p class="note warn">今天的记录在核对后有变动，需要重新核对。</p>' : ''}${guarded(view.day.open ? '收摊核对' : '店休日核对', 'review', view.today, reviewConsequence(view, view.today, missing), '确认核对', false, { tone: 'plain', question: view.day.open ? '确认收摊核对？' : '确认今天店休、不计缺记录？', keep: '先不核对', trigger: 'process' })}`;
  const staleRows = stale.length ? `<p class="note">往日还没核对的，状态未知，相关事项先不能联系：</p><ol class="rows">${stale.map(date => `<li class="row"><b class="who date-who">${e(dayLabel(date))}</b><div class="side">${guarded(`补核 ${md(date)}`, 'review', date, reviewConsequence(view, date, []), '确认补核', view.paused, { tone: 'plain', question: `确认补核${md(date)}？`, keep: '先不核对' })}</div></li>`).join('')}</ol>` : '';
  const step3 = ready.length || frozen.length ? `<ol class="rows">${ready.map(task => taskRow(task, view.today)).join('')}${frozen.map(task => frozenRow(task, view)).join('')}</ol>` : '<p class="line">没有待人工核实的事项。</p>';
  const records = view.roster.filter(row => row.arrival);
  const leave = view.roster.filter(row => row.status === 'leave');
  const skipped = view.roster.filter(row => ['closed', 'unscheduled', 'not_started', 'paused'].includes(row.status));
  const waiting = view.residents.filter(resident => resident.status === 'waiting');
  const recordRows = records.map(row => `<li class="row rec"><b class="who">${e(row.resident.name)}</b><p class="source">${mark(row.arrival!.source)}<span>${e(sourceText(row.arrival!))}</span></p><div class="fix">${guarded('记错了，撤销', 'void', row.resident.id, '删除今天这条记录，今天需要重新核对。', '确认撤销', false, { keep: '保留记录', trigger: 'link' })}</div></li>`).join('');
  const leaveTo = (id: string) => view.leaves.filter(item => item.residentId === id && item.start <= view.today && item.end >= view.today).map(item => item.end).sort().pop();
  const flow = `<section class="flow" aria-labelledby="flow"><h2 id="flow">今日流水</h2><h3>招呼记录 · ${records.length} 条</h3>${records.length ? `<ol class="rows">${recordRows}</ol>` : '<p class="line">今天还没有招呼记录。</p>'}${leave.length ? `<h3>请假 · 今天不计缺记录</h3><ol class="rows">${leave.map(row => `<li class="row rec"><b class="who">${e(row.resident.name)}</b><p class="source">${leaveTo(row.resident.id) ? `请假到 ${e(md(leaveTo(row.resident.id)!))}` : '请假中'}</p></li>`).join('')}</ol>` : ''}${skipped.length ? `<h3>今天不计</h3><ol class="rows">${skipped.map(row => `<li class="row rec"><b class="who">${e(row.resident.name)}</b><p class="source">${e(statusLabels[row.status])}</p></li>`).join('')}</ol>` : ''}${waiting.length ? `<h3>登记未生效</h3><ol class="rows">${waiting.map(resident => `<li class="row" data-resident="${e(resident.id)}"><b class="who">${e(resident.name)}</b><div class="side">${button('配对模拟联系人', 'pair-guardian', resident.id)}</div><p class="note">等待模拟联系人在自己的页面接受，接受后第二天起开始核对。</p></li>`).join('')}</ol>` : ''}</section>`;
  const pausedLine = view.paused ? `<div class="paused"><p><strong>全店已暂停核对与联系。</strong>暂停不等于有人接手。</p>${button('恢复模拟核对联系', 'pause', '', 'primary')}</div>` : '';
  return `${pausedLine}<div class="axis">${step(1, missing.length ? reviewed ? '核对后无记录' : '现在要记谁' : '今日招呼', view.day.open ? missing.length : null, reviewed ? 'done' : 'now', step1)}${step(2, '收摊核对', stale.length || null, reviewed && !stale.length ? 'done' : 'now', reviewToday + staleRows)}${step(3, '待人工核实', ready.length + frozen.length || null, ready.length ? 'now' : 'wait', step3)}</div>${flow}`;
}
function rosterRow(row: RosterRow): string {
  const resident = row.resident;
  const id = resident.id;
  const status = row.arrival ? `${mark(row.arrival.source)}<span>今天已记录 · ${e(row.arrival.source === 'self' ? '本人打招呼' : '店员当面代记')}</span>` : `<span>${e(statusLabels[row.status])}</span>`;
  const actions = resident.status === 'active' ? `${button('打开本人页面（模拟配对）', 'pair-resident', id)}${!row.arrival && !['leave', 'paused'].includes(row.status) ? witnessButton(id, resident.name, staffView!.paused) : ''}` : button('配对模拟联系人', 'pair-guardian', id);
  const risky = `${row.arrival ? guarded('撤销今日误点', 'void', id, '删除今天这条记录，今天需要重新核对。', '确认撤销', false, { keep: '保留记录' }) : ''}${guarded('退出并删除此模拟参与', 'withdraw', id, `立即删除${resident.name}的假记录、请假、联系人关系和事项，旧配对身份失效。之后要重新登记才能参加。`, '确认删除', false, { keep: '保留资料' })}`;
  const meta = [`约定${weekdaysText(resident.weekdays)} · 连续 ${resident.threshold} 个约定营业日核对后无记录才人工核实`, `目前已连续 ${row.streak} 个`, row.unknownDates.length ? `资料待补核：${dateList(row.unknownDates)}` : ''].filter(Boolean);
  return `<li class="row member" data-resident="${e(id)}"><b class="who">${e(resident.name)}</b><p class="source">${status}</p><ul class="meta">${meta.map(text => `<li>${e(text)}</li>`).join('')}</ul><div class="member-act">${actions}</div><details class="fix-zone"${[confirming, returnFocus].some(key => key.endsWith(`:${id}`) && /^(void|withdraw):/.test(key)) ? ' open' : ''}><summary>更正或删除</summary>${risky}</details></li>`;
}
function rosterTab(view: StaffView): string {
  return `<div class="tab-head"><h2>名册 <span class="n">${view.residents.length}</span></h2>${button('新增模拟登记', 'register', '', 'primary')}</div><p class="note">名单只有店员能看；公用页面不显示任何熟客或联系人。</p>${view.roster.some(row => row.resident.status === 'active' && !row.arrival) ? witnessHint() : ''}${view.roster.length ? `<ol class="rows">${view.roster.map(rosterRow).join('')}</ol>` : '<p class="line">还没有登记。先选一个虚构角色当面登记，再由模拟联系人独立接受。</p>'}`;
}
function daysTab(view: StaffView): string {
  const history = view.tasks.filter(task => !ACTIVE.includes(task.state));
  const rows = [...view.days].reverse().map(day => {
    const ok = day.reviewedRevision === day.revision;
    const state = ok ? `已核对 · ${labels[day.reviewer as 'owner' | 'backup'] ?? '店员'}` : day.reviewedRevision === null ? '未核对 · 未知，不当缺席' : '有更正，需重新核对 · 未知';
    return `<li class="row day-row ${ok ? '' : 'open'}"><b class="who date-who">${e(dayLabel(day.date))}</b><p class="source"><span>${day.open ? '营业' : '店休'}</span><span class="sep">·</span><span>${e(state)}</span></p>${ok ? '' : `<div class="side">${guarded(`核对 ${md(day.date)}`, 'review', day.date, reviewConsequence(view, day.date, day.date === view.today ? unrecorded(view) : []), '确认核对', view.paused, { tone: 'plain', question: `确认核对${md(day.date)}？`, keep: '先不核对' })}</div>`}</li>`;
  }).join('');
  return `<div class="tab-head"><h2>每日核对记录</h2></div><p class="note">更正会让相关日期重新变成“未知”，需要再核对。这里不提供全员签到表。</p><ol class="rows">${rows}</ol><details class="fold"><summary>事项历史 <span class="n">${history.length}</span></summary>${history.length ? `<ol class="rows">${history.map(task => taskRow(task, view.today)).join('')}</ol>` : '<p class="line">还没有已结束的事项。</p>'}</details><details class="fold"><summary>规则说明</summary><p>约定营业日核对后仍没有记录，才算一次“核对后无记录”；店休、非约定日跳过，请假中断计数。达到熟客自己选的天数，才生成人工核实事项。</p><p>未核对或被更正的日期是“未知”，不计缺席。最多记录 3 次假联系尝试，之后只能暂停。交接后必须由对方主动领取。</p></details>`;
}
function adminTab(view: StaffView): string {
  const owner = session!.principal.role === 'owner';
  return `<div class="tab-head"><h2>管理</h2></div><ol class="rows settings"><li class="row setting"><div class="who-block"><b class="label">演练日期</b><p class="note">仅用于演练，不是实际功能。今天是 ${e(dayLabel(view.today))} · ${view.day.open ? '营业' : '店休'}；前进后，当天未核对时仍是未知。</p></div><div class="side">${button('模拟下一营业日期', 'advance')}</div></li><li class="row setting"><div class="who-block"><b class="label">今天营业状态</b><p class="note">会改变今天是否计入缺记录，改后今天要重新核对。</p></div><div class="side">${guarded(view.day.open ? '标记今天店休' : '标记今天开店', 'day', '', '会改变今天是否计入缺记录，今天需要重新核对。', view.day.open ? '确认标记店休' : '确认标记开店', false, { tone: 'plain', keep: '先不改' })}</div></li><li class="row setting"><div class="who-block"><b class="label">全店暂停</b><p class="note">没人能接手时使用。暂停期间不能核对，也不会生成新事项。</p></div><div class="side">${view.paused ? button('恢复模拟核对联系', 'pause', '', 'primary') : guarded('暂停全店核对联系', 'pause', '', '暂停不等于有人接手已有事项，恢复前不能核对。', '确认暂停', false, { keep: '先不暂停' })}</div></li><li class="row setting"><div class="who-block"><b class="label">清空全部演示数据</b><p class="note">${owner ? '删除全部假登记、记录、请假与事项，并让所有演示登录失效。不影响其他项目。' : '仅店主可清空；即使绕过按钮，服务端也会拒绝。'}</p></div><div class="side">${guarded('清空全部演示数据', 'reset', '', '删除全部假登记、记录、请假与事项，并让所有演示登录失效。无法撤回。', '确认清空所有假数据', !owner, { keep: '先不清空' })}</div></li></ol><details class="fold tech"><summary>技术说明</summary><p>本人页和联系人页通过单次、5 分钟有效的配对票据切换，票据不写入网址或浏览器存储；切换后旧身份失效。登录只用本机受保护的 Cookie，写入需校验来源、令牌和版本。</p></details>`;
}
function staffPage(): string {
  if (!staffView) return unknownPanel('资料状态未知', button('退出店员登录', 'logout', '', 'link'));
  const view = staffView;
  const stale = new Set(view.roster.flatMap(row => row.unknownDates).filter(date => date !== view.today)).size;
  const todo = view.tasks.filter(task => ACTIVE.includes(task.state)).length + (view.day.reviewedRevision === view.day.revision ? 0 : 1) + stale + view.residents.filter(resident => resident.status === 'waiting').length;
  const tabs: [Tab, string, number | null][] = [['today', '今日', todo || null], ['roster', '名册', view.residents.length || null], ['days', '记录', null], ['admin', '管理', null]];
  const content = tab === 'roster' ? rosterTab(view) : tab === 'days' ? daysTab(view) : tab === 'admin' ? adminTab(view) : todayTab(view);
  const reviewed = view.day.reviewedRevision === view.day.revision;
  return `<header class="ledger-head"><p class="kicker">营业流水 · ${view.day.open ? '营业' : '店休'}</p><h1 class="date"><span>${e(md(view.today))}</span> <span>周${WEEK[new Date(`${view.today}T00:00:00Z`).getUTCDay()]}</span></h1><p class="day-state ${view.paused ? 'warn' : reviewed ? 'ok' : ''}">${view.paused ? '全店暂停' : reviewed ? '今日已核对' : '今日未核对'}</p></header><nav class="index" role="tablist" aria-label="店员分区">${tabs.map(([id, text, count]) => `<button type="button" role="tab" aria-selected="${tab === id}" data-action="tab" data-id="${id}">${e(text)}${count ? `<span class="n">${count}</span>` : ''}</button>`).join('')}</nav><div class="tab-body">${content}</div><div class="exits row-exits">${button('刷新资料', 'refresh', '', 'link')}${button('退出店员登录', 'logout', '', 'link')}</div>`;
}
function mePage(): string {
  if (!me) return unknownPanel('资料状态未知', button('退出当前模拟身份', 'logout', '', 'link'));
  const live = me.resident.status === 'active' && !me.paused;
  const onLeave = me.leaves.some(item => item.start <= me!.today && item.end >= me!.today);
  const ticket = me.arrival ? `<div class="record"><h2>招呼已记录</h2><p class="source">${mark(me.arrival.source)}<span>${me.arrival.source === 'self' ? '本人打招呼' : '店员当面代记（模拟）'}</span></p></div><p class="meaning">${me.arrival.source === 'self' ? '只说明你今天点过招呼' : '只说明店员记下了今天当面见到你'}；不证明到店，也不是安全判断。记错了请找店员更正。</p>` : live ? `${button('打个招呼', 'arrival', me.resident.id, 'greet')}<p class="meaning">只记下“你今天点了招呼”。不定位，不证明到店，也不是安全判断。${onLeave ? '今天在请假中，不计缺记录；来了也可以打招呼。' : ''}</p>` : `<p class="meaning stop">${me.paused ? '全店暂停中，今天先不记录招呼。' : '这项联系约定已暂停，今天不记录招呼。'}有事请找店员。</p>`;
  const leaves = me.leaves.map(leave => `<li class="row rec"><p class="source">请假 ${e(md(leave.start))}${leave.end === leave.start ? '' : ` 至 ${e(md(leave.end))}`}</p><div class="side">${button('撤销这次请假', 'cancel-leave', leave.id, 'link')}</div><p class="note">结束后下个约定开门日恢复。</p></li>`).join('');
  const leaveForm = leaveOpen ? `<form data-form="leave" data-id="${e(me.resident.id)}" class="leave-form"><p class="note">只选日期，不填原因。请假期间不计缺记录。</p><label class="field">从哪天开始<input type="date" name="start" value="${e(me.today)}" required /></label><label class="field">到哪天（含当天）<input type="date" name="end" value="${e(me.today)}" required /></label><div class="pair"><button class="primary" type="submit">保存模拟请假</button>${button('先不请假', 'leave-close')}</div></form>` : '';
  return `<section class="ticket"><header class="identity"><h1 class="name">${e(me.resident.name)}</h1><p class="today">${e(dayLabel(me.today))}</p></header>${ticket}</section><section class="exits ticket-exits" aria-label="其他">${leaves ? `<ol class="rows leaves">${leaves}</ol>` : ''}${leaveForm}<div class="other-actions">${leaveOpen ? '' : button('请假', 'leave-open', '', 'link')}${button('交还手机（保留资料）', 'logout', '', 'link')}</div>${guarded('退出参加并删除资料', 'withdraw', me.resident.id, '停止后续处理，删除你的相关记录、请假和模拟联系人关系；当前身份立即失效，之后要重新登记才能参加。交还手机不会删除资料。', '确认退出并删除', false, { question: '要退出参加，并删除资料吗？', keep: '保留资料', trigger: 'danger link' })}</section>`;
}
function guardianPage(): string {
  if (!guardian) return unknownPanel('联系约定资料未知', button('退出模拟身份', 'logout', '', 'link'));
  return `<section class="ticket letter"><header class="identity"><p class="today">${e(guardian.guardianName)} · 受限模拟联系人</p><h1 class="name">是否接受这项模拟联系约定？</h1></header><p class="meaning">${e(guardian.name)} 已选择模拟参加。本页只演练你是否接受，不是真人同意证明，也不会发消息。</p><ol class="consent"><li>每天由授权店员人工核对；缺记录可能是漏记或临时没来，也可能忙忘、延迟或无法接通。</li><li>不是监护、安全判断或急救。你看不到名单、记录或轨迹。</li><li>可以拒绝或撤回，不需要解释。</li></ol><p class="consent-state">${guardian.accepted ? `${mark('staff')}已模拟接受` : '尚未模拟接受'}</p>${guardian.accepted ? guarded('撤回模拟联系约定', 'consent-no', '', '撤回后这项联系约定暂停，相关记录清除，关联的旧身份失效。', '确认撤回', false, { keep: '先不撤回', trigger: 'danger link' }) : `<form data-form="consent"><label class="check"><input name="accepted" type="checkbox" required />我只是在演练模拟接受，不是代表任何真人</label><button class="primary wide" type="submit">模拟接受联系约定</button></form>`}</section><section class="exits ticket-exits"><div class="other-actions">${button('拒绝 / 返回公用入口', 'logout', '', 'link')}</div></section>`;
}
function render(): void {
  noticeInline = false;
  const role = session?.principal.role;
  const staffSession = role === 'owner' || role === 'backup';
  const isHome = !session && page !== 'login';
  const content = role === 'resident' ? mePage() : role === 'guardian' ? guardianPage() : staffSession && page === 'register' ? registration() : staffSession ? staffPage() : page === 'login' ? login() : home();
  app.innerHTML = shell(content, isHome);
  app.dataset.view = role === 'resident' || role === 'guardian' ? 'ticket' : 'ledger';
  app.setAttribute('aria-busy', String(busy));
  if (busy) app.querySelectorAll<HTMLButtonElement>('button').forEach(item => { item.disabled = true; });
  const box = confirming ? app.querySelector<HTMLElement>('[data-confirm]') : null;
  if (box) { box.focus({ preventScroll: true }); box.scrollIntoView({ block: 'nearest' }); }
  else if (returnFocus) { app.querySelector<HTMLElement>(`[data-action="ask"][data-id="${CSS.escape(returnFocus)}"]`)?.focus(); returnFocus = ''; }
}
async function perform(operation: () => Promise<void>, readOnly = false): Promise<void> {
  if (busy) return;
  busy = true; render();
  const earlier = confirmedSave; confirmedSave = '';
  try {
    try { await operation(); }
    catch (error) {
      failed = true; staffView = null; me = null; guardian = null;
      if (readOnly) { confirmedSave = earlier; notice = `${earlier ? `此前后端已确认：${earlier}` : ''}读取最新资料失败，资料状态未知。请稍后重新读取核实，不要当作空名单或已核对。`; return; }
      if (!(error instanceof ApiFailure)) { notice = '本地连接中断，资料状态未知；刚才的操作不一定完成，请重新读取核实，不要当作成功，也不要直接重复提交。'; return; }
      // Only a 4xx is an explicit refusal; a 5xx may come after the transaction committed.
      notice = error.status < 500 ? `${error.message}。本次操作没有保存。` : '本地服务异常，刚才的操作结果未知，请重新读取核实，不要当作成功，也不要直接重复提交。';
      try { await refresh(); failed = true; if (session) notice += ' 已重新读取，请以下方最新资料为准。'; } catch { notice += ' 重新读取也失败，资料状态未知。'; }
      return;
    }
    if (readOnly) { if (earlier) notice = `已从本地后端重新读取最新资料。此前后端已确认：${earlier}请以下方最新状态为准。`; return; }
    const saved = notice || '操作已完成。';
    try { await refresh(); }
    catch {
      failed = true; staffView = null; me = null; guardian = null; confirmedSave = saved;
      notice = `后端已确认：${saved}但随后读取最新资料失败，页面状态未知，暂不显示可操作内容。请点“重新读取资料”核实，无需重复提交。`;
    }
  }
  finally { busy = false; render(); }
}
async function pair(id: string, role: 'resident' | 'guardian'): Promise<void> {
  const { ticket } = await api<{ ticket: string }>('/tickets', { residentId: id, role });
  session = await api<SessionView>('/pair', { ticket });
  staffView = null; me = null; guardian = null; page = 'staff'; tab = 'today'; leaveOpen = false;
  notice = role === 'resident' ? '已打开模拟熟客本人页。用完请点“交还手机”。' : '已打开受限的模拟联系人页。';
}
app.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!target || busy) return;
  event.preventDefault(); const action = target.dataset.action!; const id = target.dataset.id ?? '';
  if (action === 'ask') { confirming = id; render(); return; }
  if (action === 'cancel-confirm') { confirming = ''; returnFocus = id; render(); return; }
  confirming = '';
  if (action === 'leave-open' || action === 'leave-close') { leaveOpen = action === 'leave-open'; render(); return; }
  if (action === 'tab') { tab = id as Tab; notice = ''; render(); scrollTo(0, 0); return; }
  if (['home', 'login', 'assist', 'register', 'staff'].includes(action)) {
    notice = '';
    if (action === 'home' || action === 'login') { intent = 'staff'; page = action; }
    else if (action === 'assist' || (action === 'register' && !session)) { intent = 'register'; page = 'login'; }
    else { page = action as Page; if (action === 'staff') tab = 'today'; }
    render(); scrollTo(0, 0); return;
  }
  const done = perform(async () => {
    notice = '';
    if (action === 'refresh') { await refresh(); notice = '已从本地后端重新读取。未核对的仍是未知，不当缺席。'; }
    else if (action === 'logout') { await api('/logout', {}); session = null; page = 'home'; intent = 'staff'; tab = 'today'; leaveOpen = false; notice = '已退出模拟身份。'; }
    else if (action === 'pair-resident' || action === 'pair-guardian') await pair(id, action === 'pair-resident' ? 'resident' : 'guardian');
    else if (action === 'advance') { await api('/advance', {}, true); notice = '已前进一个模拟日期；当天未核对时仍是未知。'; }
    else if (action === 'day') { await api('/day', { open: !staffView!.day.open }, true); notice = '开店/店休已更正，请重新核对今天。'; }
    else if (action === 'pause') { await api('/pause', { paused: !staffView!.paused }, true); notice = staffView!.paused ? '已恢复模拟核对联系。' : '已暂停全店，不代表有人已接手。'; }
    else if (action === 'review') { await api('/review', { date: id }, true); notice = `已记录 ${md(id)} 的人工核对（模拟），不是安全判断。`; }
    else if (action === 'arrival') { await api(`/residents/${id}/arrival`, { witnessed: false }, true); notice = '今天的模拟招呼已保存。'; }
    else if (action === 'witness') { const name = nameOf(id); const saved = await api<Arrival>(`/residents/${id}/arrival`, { witnessed: true }, true); notice = saved.source === 'staff' ? `已记下${name}：店员当面代记（模拟）。` : `${name}今天已有本人招呼记录，保留原来源（模拟）。`; }
    else if (action === 'void') { await api(`/residents/${id}/void`, {}, true); notice = '今日误点已撤销，今天需要重新核对。'; }
    else if (action === 'withdraw') { await api(`/residents/${id}/withdraw`, {}, true); if (session?.principal.role === 'resident') { session = null; page = 'home'; } notice = '相关假记录、请假、联系人关系及事项已删除，旧配对身份失效。'; }
    else if (action === 'cancel-leave') { await api(`/residents/${me!.resident.id}/cancel-leave`, { leaveId: id }, true); notice = '模拟请假已撤销，有关日期需要重新核对。'; }
    else if (action === 'consent-no') { await api('/consent', { accepted: false }, true); session = null; page = 'home'; notice = '模拟联系约定已撤回，关联旧身份已撤销。'; }
    else if (['claim', 'release', 'correct'].includes(action)) { await api(`/tasks/${id}/${action}`, {}, true); notice = action === 'release' ? '已交接，等对方主动领取；不等于已有人接手。' : '已保存模拟处理状态，不是安全判断。'; }
    else if (action === 'reset') { await api('/reset', { confirmed: true }); session = null; page = 'home'; intent = 'staff'; tab = 'today'; notice = '演示数据已清空，旧会话全部失效。'; }
  }, action === 'refresh');
  if (action === 'witness') void done.then(() => focusAfterWitness(id));
  else if (action === 'refresh') void done.then(() => {
    app.querySelector<HTMLElement>(staffView || me || guardian ? '.notice' : '.unknown-state [data-action="refresh"]')?.focus({ preventScroll: true });
  });
});
// Success parks focus on the status, never on the next person's button, so a repeated Enter can't record someone else.
function focusAfterWitness(id: string): void {
  const find = (selector: string) => app.querySelector<HTMLElement>(selector);
  if (!staffView) { find('.unknown-state [data-action="refresh"]')?.focus(); return; }
  const retry = failed ? find(`[data-action="witness"][data-id="${CSS.escape(id)}"]:not([disabled])`) : null;
  if (retry) retry.focus();
  else find('.notice')?.focus({ preventScroll: true });
}
app.addEventListener('submit', event => {
  event.preventDefault(); const form = event.target as HTMLFormElement;
  if (busy || !form.reportValidity()) return;
  const data = new FormData(form); const kind = form.dataset.form;
  void perform(async () => {
    if (kind === 'login') { session = await api<SessionView>('/login', { account: data.get('account'), password: data.get('password') }); page = intent === 'register' ? 'register' : 'staff'; tab = 'today'; notice = intent === 'register' ? '店员已登录。请和熟客一起读完下面的模拟知情说明。' : ''; intent = 'staff'; }
    else if (kind === 'enroll') { await api('/enroll', { fixtureId: data.get('fixtureId'), threshold: Number(data.get('threshold')), weekdays: data.getAll('weekdays').map(Number), simulatedElderConsent: data.get('consent') === 'on' }, true); page = 'staff'; tab = 'today'; notice = '模拟本人参加已保存。下一步：配对模拟联系人，由对方独立选择是否接受。'; }
    else if (kind === 'consent') { await api('/consent', { accepted: data.get('accepted') === 'on' }, true); notice = '已保存模拟联系人接受；不是真人同意，明日起开始核对。'; }
    else if (kind === 'leave') { await api(`/residents/${form.dataset.id}/leave`, { start: data.get('start'), end: data.get('end') }, true); leaveOpen = false; notice = '模拟请假已保存，无需填写任何原因。'; }
    else if (kind === 'result') { await api(`/tasks/${form.dataset.id}/result`, { outcome: data.get('outcome'), nextDate: data.get('nextDate') }, true); notice = '已保存假联系结果；没有拨号或发送消息，也不代表安全。'; }
  });
});
async function start(): Promise<void> {
  try { shop = await api<PublicView>('/public'); document.title = `${shop.shopName} · 本地演示`; }
  catch { failed = true; notice = '本地后端未连接：资料状态未知，不能当作空名单或已存好。'; }
  try { session = await api<SessionView>('/session'); page = 'staff'; await refresh(); } catch { session = null; }
  render();
}
void start();
