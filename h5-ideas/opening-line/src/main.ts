import './style.css';
import { availableScenes, categories, fullMessage, matchingTemplates, quickScenes, recipients, scenes } from './content';
import type { RecipientId, Scene, StateId, Template } from './content';
import { clearRecords, completeAttempt, localDate, readRecords } from './achievements';
import type { Completion, StoragePort } from './achievements';
import { phraseChunks } from './phrase';

type Page = 'home' | 'scenes' | 'card' | 'badges' | 'help' | 'help-done';
type CopySource = 'opening' | 'full' | 'help';
type CopyStatus = { kind: 'ok' | 'fail'; text: string; source: CopySource } | null;
const root = document.querySelector<HTMLDivElement>('#app')!;
let storage: StoragePort | null = null;
try { storage = window.localStorage; } catch { storage = null; }
const initialRecords = readRecords(storage);
let records: Completion[] = initialRecords.records;
let storageError = initialRecords.error;
let page: Page = window.location.hash === '#badges' ? 'badges' : window.location.hash === '#help' ? 'help' : 'home';
let recipientId: RecipientId | null = null;
let sceneId: string | null = null;
let stateId: StateId = 'awkward';
let attemptId: string | null = null;
let cardFrom: 'home' | 'scenes' = 'home';
let copyStatus: CopyStatus = null;
let feedback = '';
let copyPending = false;
let viewSeq = 0;
let large = false;
let returnPage: Page = 'home';
let barObserver: ResizeObserver | null = null;

const tiers = [
  { stateId: 'very_nervous', label: '短一点' },
  { stateId: 'awkward', label: '自然一点' },
] as const satisfies readonly { stateId: StateId; label: string }[];

const escape = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const words = (value: string): string => phraseChunks(value)?.map((chunk) => `<span class="w">${escape(chunk)}</span>`).join('') ?? escape(value);
const selectedScene = () => scenes.find((scene) => scene.id === sceneId);
const currentTemplate = (): Template | undefined => recipientId && sceneId ? matchingTemplates(sceneId, recipientId, stateId)[0] : undefined;
const recipientLabel = (id: RecipientId | null) => recipients.find((recipient) => recipient.id === id)?.label ?? '';
const coveredRecipients = () => recipients.filter((recipient) => availableScenes(recipient.id).length > 0);
const uncoveredRecipients = () => recipients.filter((recipient) => availableScenes(recipient.id).length === 0);
const glimpse = (scene: string, recipient: RecipientId) => matchingTemplates(scene, recipient, 'awkward')[0]?.lines.opening ?? '';

function go(next: Page): void {
  page = next;
  viewSeq += 1;
  feedback = '';
  copyStatus = null;
  const hash = next === 'badges' ? '#badges' : next === 'help' ? '#help' : '#';
  window.history.replaceState(null, '', hash);
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  root.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
}

function resetHome(): void {
  recipientId = null;
  sceneId = null;
  attemptId = null;
  go('home');
}

function openCard(id: string, recipient: RecipientId, from: 'home' | 'scenes'): void {
  if (!availableScenes(recipient).some((scene) => scene.id === id)) return;
  recipientId = recipient;
  sceneId = id;
  stateId = 'awkward';
  attemptId = crypto.randomUUID();
  cardFrom = from;
  go('card');
}

function typeToggle(): string {
  return `<button type="button" class="type-toggle" data-action="large" aria-pressed="${large}">${large ? '标准字' : '大字'}</button>`;
}

function detailHeader(title: string, qualifier = ''): string {
  return `<header class="detail-header"><button type="button" class="back" data-action="back" aria-label="返回"><span aria-hidden="true">←</span></button><h1 tabindex="-1">${words(title)}${qualifier ? `<span class="qualifier">${escape(qualifier)}</span>` : ''}</h1>${typeToggle()}</header>`;
}

function helpWarning(): string {
  return '<aside class="notice"><h2>求助样稿 · 未经专业复核</h2><p>不是心理咨询或治疗建议；不替你发送，不保存记录。</p></aside>';
}

function statusSlot(source: CopySource): string {
  const status = copyStatus?.source === source ? `<p class="copy-status ${copyStatus.kind}">${escape(copyStatus.text)}</p>` : '';
  return `<div class="status-slot" role="status" aria-live="polite">${status}</div>`;
}

function sceneLink(scene: Scene, recipient: RecipientId, action: 'quick' | 'scene', title: string, aside: string): string {
  const data = action === 'quick' ? `data-scene="${scene.id}" data-recipient="${recipient}"` : `data-id="${scene.id}"`;
  return `<li><button type="button" class="scene-link" data-action="${action}" ${data}><span class="scene-meta"><span class="scene-name">${escape(title)}</span>${aside ? `<span class="scene-aside">${escape(aside)}</span>` : ''}</span><span class="glimpse">${words(glimpse(scene.id, recipient))}</span></button></li>`;
}

function emptyBlock(title = '这个组合，内测暂未覆盖。'): string {
  return `<div class="empty"><h2>${title}</h2><p>不会拿别的关系换个称呼来凑。</p><button type="button" class="primary" data-action="home">回首页换一件事</button></div>`;
}

function homeView(): string {
  const uncovered = uncoveredRecipients();
  const index = coveredRecipients().map((item) => {
    const items = availableScenes(item.id);
    const onlyHelp = items.every((scene) => scene.help);
    return `<li><button type="button" class="index-row" data-action="recipient" data-id="${item.id}"><span class="index-name">${escape(item.label)}</span><span class="leader" aria-hidden="true"></span><span class="index-count">${onlyHelp ? '仅求助样稿' : `${items.length} 件`}</span></button></li>`;
  }).join('');
  return `<header class="masthead"><button type="button" class="wordmark brand" data-action="home">开口嘴替</button><nav class="masthead-nav" aria-label="页面">${typeToggle()}<button type="button" class="nav-link" data-action="badges">记录</button></nav></header>
    <main class="layout home">
      <div class="lede"><h1 tabindex="-1">${words('最难的第一句，先借你。')}</h1><p>选一件事，从下面这句开始说。说不说、怎么发，都由你。</p></div>
      <div class="body">
        <section aria-labelledby="common-heading"><h2 class="section-label" id="common-heading">常用的四件事</h2><ul class="scene-list">${quickScenes.map((item) => sceneLink(scenes.find((scene) => scene.id === item.sceneId)!, item.recipientId, 'quick', item.label, `对${recipientLabel(item.recipientId)}`)).join('')}</ul></section>
        <section class="people" aria-labelledby="people-heading"><h2 class="section-label" id="people-heading">按对象找<span>已写好 ${coveredRecipients().length} 类关系</span></h2><ul class="index">${index}</ul>
        ${uncovered.length ? `<p class="uncovered" id="uncovered-note"><strong>${uncovered.map((item) => item.label).join('、')}：暂未覆盖。</strong>内测还没写，不拿别的关系换个称呼来凑。</p>` : ''}</section>
      </div>
    </main>`;
}

function scenesView(): string {
  if (!recipientId) return `${detailHeader('还没选对象')}<main class="layout">${emptyBlock()}</main>`;
  const all = availableScenes(recipientId);
  const groups = categories.map((category) => ({ category, items: all.filter((scene) => scene.categoryId === category.id) })).filter((group) => group.items.length);
  const who = recipientLabel(recipientId);
  return `${detailHeader(`想跟${who}说哪件事？`)}
    <main class="layout">
      <div class="lede"><p>只列跟${escape(who)}已经写好的 ${all.length} 件事。下面每行是那件事的第一句。</p></div>
      <div class="body">${all.length ? groups.map((group) => `<section class="scene-group" aria-label="${group.category.label}"><h2 class="section-label">${group.category.label}<span>${group.items.length} 件</span></h2>${group.category.id === 'help' ? helpWarning() : ''}<ul class="scene-list">${group.items.map((scene) => sceneLink(scene, recipientId!, 'scene', scene.label, scene.help ? '求助样稿' : '')).join('')}</ul></section>`).join('') + '<p class="quiet">没有合适的？内测库还很小，不必硬套。</p>' : emptyBlock()}</div>
    </main>`;
}

function cardView(): string {
  const scene = selectedScene();
  const template = currentTemplate();
  if (!scene || !template) return `${detailHeader('还没找到合适的一句')}<main class="layout">${emptyBlock()}</main>`;
  const alternate = matchingTemplates(scene.id, recipientId!, stateId)[1];
  const done = records.some((record) => record.attemptId === attemptId);
  const full = fullMessage(template);
  const category = categories.find((item) => item.id === scene.categoryId)?.label ?? '';
  const sceneNote = scene.id === 'after_argument' ? '只在关系安全、对方愿意沟通时用。对方明确不想联系，就停在这里。'
    : scene.id === 'help_money' ? '如实说明金额和能做到的还款安排；热线不处理借贷，也不意味着借钱的人有心理问题。'
    : scene.id === 'help_counseling' ? '只在确实接受咨询、说出来不会更危险时用。你可以选择不告诉家人。' : '';
  const openingNote = scene.help ? '<p class="action-note copy-scope">求助只复制开场，先确认对方方便。</p>' : '';
  const tones = `<div class="tones" role="group" aria-label="同一件事的两种说法">${tiers.map((tier) => { const active = (stateId === 'very_nervous') === (tier.stateId === 'very_nervous'); return `<button type="button" class="tone" data-action="tier" data-id="${tier.stateId}" aria-pressed="${active}">${tier.label}</button>`; }).join('')}</div>`;
  const opening = `<div class="opening-controls"><h2 class="script-label">开场</h2>${tones}</div>
    <div class="opening-stack"><p class="opening" id="opening-line">${words(template.lines.opening)}</p>${alternate ? `<p class="opening opening-ghost" aria-hidden="true">${words(alternate.lines.opening)}</p>` : ''}</div>
    <div class="opening-actions"><button type="button" class="primary" data-action="copy-opening" ${copyPending ? 'disabled' : ''}>复制开场</button>${openingNote}${statusSlot('opening')}</div>`;
  const main = `<div class="main-part"><h2 class="script-label">正事</h2><p id="main-line">${words(template.lines.main)}</p></div>`;
  const range = full
    ? `<section class="copy-range" aria-label="可复制的开场与正事">${opening}${main}<div class="full-action"><button type="button" class="text-action" data-action="copy-full" ${copyPending ? 'disabled' : ''}>复制开场＋正事</button></div>${statusSlot('full')}</section><p class="range-end">以下不在复制范围内</p>`
    : `<section class="copy-range" aria-label="可复制的开场">${opening}</section><p class="range-end">以下不在复制范围内</p><section class="outside">${main}</section>`;
  const finish = scene.help
    ? '<section class="record help-end"><p>这次求助不留记录。</p><button type="button" class="text-action" data-action="end-help">结束本次 · 不留记录</button></section>'
    : done
      ? `<section class="record"><p class="done-row"><span class="done-mark">已记下这一次。</span>${storageError ? '这次只记在当前页面，刷新后不保留。' : `本机共记下 ${records.length} 次。`}</p><button type="button" class="text-action" data-action="badges">看次数记录 →</button></section>`
      : '<section class="record"><p>可选：真的说过或发过，想留个数再点。对方说不也算，读完不算。</p><button type="button" class="text-action" data-action="complete">我说过了，记一次</button></section>';
  return `${detailHeader(scene.label, `对${recipientLabel(recipientId)}`)}
    <main class="card ${scene.help ? 'help-card' : ''}">
      <aside class="card-context"><p class="context-label">对${escape(recipientLabel(recipientId))} · ${category}</p><p>${escape(scene.hint)}</p></aside>
      ${scene.help ? helpWarning() : ''}
      <article class="script" aria-label="台词">
        ${range}
        <section class="script-part"><h2 class="script-label">${scene.id.startsWith('reject_') ? '对方还劝你' : '对方说不方便时'}<span class="aside-text">等对方回了再看</span></h2><p>${words(template.lines.ifDeclined)}</p></section>
        <section class="script-part"><h2 class="script-label">收尾</h2><p>${words(template.lines.closing)}</p></section>
        ${sceneNote ? `<p class="scene-note">${sceneNote}</p>` : ''}
      </article>
      ${finish}
    </main>`;
}

function badgesView(): string {
  const month = localDate().slice(0, 7);
  const monthly = records.filter((record) => record.completedDate.startsWith(month)).length;
  return `${detailHeader('开口记录', '只在这个浏览器')}
    <main class="layout">
      <div class="lede"><p class="count"><span class="count-number">${records.length}</span><span class="count-unit">次</span></p><p>你自己选择记下的普通开口次数，本月 ${monthly} 次。只是计数，不评价说得好不好。求助不计数，也不保存。</p></div>
      <div class="body">
        ${!records.length ? '<div class="empty-history"><h2>还没有记录。</h2><p>记不记都可以。想留个数，说过后在那句话下面点“我说过了，记一次”。</p></div>' : ''}
        <button type="button" class="primary" data-action="home">再准备一句</button>
        <div class="feedback" role="status" aria-live="polite">${escape(feedback)}</div>
        <div class="storage-note"><p>只存随机尝试标识和日期，不存对象、台词或心情。换设备、换浏览器或清缓存不会同步。</p><button type="button" class="text-action" data-action="show-clear">清除本机记录</button></div>
      </div>
    </main>
    <dialog id="clear-dialog" aria-labelledby="clear-title"><h2 id="clear-title">清除这个浏览器的记录？</h2><p>清除后无法恢复。不会影响你继续使用台词。</p><div class="dialog-actions"><button type="button" class="secondary" data-action="cancel-clear">先留着</button><button type="button" class="primary" data-action="confirm-clear">确认清除</button></div></dialog>`;
}

function helpView(): string {
  return `${detailHeader('求助与紧急资源')}
    <main class="layout help-page">
      <div class="lede"><h2 class="lede-title">${words('不用先把话组织得很完美。')}</h2><p>如果你或别人现在可能受伤，请优先联系当地紧急服务，并找安全、可信的人陪着。</p></div>
      <div class="body">
        <section class="resource"><p class="resource-label">中国大陆 · 心理援助</p><p class="hotline">12356</p><p>服务时间以当地为准，可能需要等待，不保证立即接通。心理援助热线不替代急救。</p><a class="primary" href="tel:12356">由你点击联系 12356</a></section>
        <section class="emergency"><h3>有即时危险，优先紧急服务</h3><p>中国大陆：120 急救 / 110 报警。其他地区请联系当地急救、警方或就近急诊。</p><div class="emergency-actions"><a class="secondary" href="tel:120">120 急救</a><a class="secondary" href="tel:110">110 报警</a></div></section>
        <section class="safe-message"><h3>可以自己发给可信的人</h3><p class="safe-opening">${words('我现在不太安全，能陪着我一起联系专业帮助吗？')}</p><button type="button" class="secondary" data-action="copy-help" ${copyPending ? 'disabled' : ''}>复制这句求助</button>${statusSlot('help')}<p class="quiet">不要发给威胁你的人。遇到家暴或跟踪，用安全的设备或方式联系帮助。不必等一句话准备好才求助。</p></section>
        <aside class="notice"><h2>不是心理咨询，不自动识别危机</h2><p>本工具没有自由输入，不会读取你的聊天或代你发消息。热线未接通时，可以请可信的人陪同联系其他专业帮助；有即时危险不要只等热线。</p></aside>
        <button type="button" class="text-action" data-action="help-return">回到刚才的页面</button>
      </div>
    </main>`;
}

function helpDoneView(): string {
  return `${detailHeader('想好了，再由你自己发。')}
    <main class="layout">
      <div class="lede"><p>对方暂时没空，也可以换一个可信的人，或联系专业帮助。</p></div>
      <div class="body"><div class="done-panel"><h2>这一页不留记录。</h2><p>没有保存对象、台词、心情或完成记录。</p></div><button type="button" class="primary" data-action="home">回到首页</button><button type="button" class="text-action" data-action="help">看看专业求助资源 →</button></div>
    </main>`;
}

function footer(): string {
  return `<footer class="site-foot">${page === 'help' ? '' : '<button type="button" class="text-action" data-action="help">需要帮助？看紧急资源</button>'}<p>不登录 · 不读通讯录 · 不自动发送</p><p>内测样稿，不是心理咨询</p></footer>`;
}

function render(): void {
  document.documentElement.classList.toggle('large-type', large);
  const helpContext = page === 'help-done' || (page === 'scenes' && availableScenes(recipientId ?? '').some((item) => item.help)) || (page === 'card' && Boolean(selectedScene()?.help));
  const view = ({ home: homeView, scenes: scenesView, card: cardView, badges: badgesView, help: helpView, 'help-done': helpDoneView })[page]();
  document.documentElement.classList.toggle('with-help-bar', helpContext);
  const notice = storageError ? `<p class="storage-error" role="status">${escape(storageError)}</p>` : '';
  root.innerHTML = `<div class="page page-${page}">${notice}${view}${footer()}</div>${helpContext ? '<aside class="help-bar" aria-label="心理援助资源"><p class="bar-title">中国大陆 · 心理援助 12356</p><p class="bar-limit"><span class="w">时段以当地为准 ·</span> <span class="w">不替代急救</span></p><button type="button" data-action="help">紧急资源 →</button></aside>' : ''}`;
  barObserver?.disconnect();
  const bar = root.querySelector<HTMLElement>('.help-bar');
  if (bar) {
    const update = () => document.documentElement.style.setProperty('--bar-height', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    update();
    barObserver = new ResizeObserver(update);
    barObserver.observe(bar);
  }
}

async function copyText(text: string, success: string, source: CopySource): Promise<void> {
  if (copyPending) return;
  const startedView = viewSeq;
  const startedTemplate = page === 'card' ? currentTemplate()?.id : undefined;
  const stillSame = () => viewSeq === startedView && (page === 'card' ? currentTemplate()?.id : undefined) === startedTemplate;
  copyPending = true;
  copyStatus = null;
  render();
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(text);
    if (stillSame()) copyStatus = { kind: 'ok', text: success, source };
  } catch {
    if (stillSame()) copyStatus = { kind: 'fail', text: '这个浏览器不能一键复制。请长按上面的台词，选择复制。', source };
  } finally {
    copyPending = false;
    if (stillSame()) render();
    else root.querySelectorAll<HTMLButtonElement>('button[data-action^="copy-"]').forEach((button) => { button.disabled = false; });
  }
}

root.addEventListener('click', (event) => {
  const target = (event.target as Element).closest<HTMLElement>('[data-action]');
  if (!target || target.hasAttribute('disabled')) return;
  const action = target.dataset.action;
  if (action === 'home') resetHome();
  if (action === 'badges') go('badges');
  if (action === 'large') {
    large = !large;
    render();
    root.querySelector<HTMLElement>('[data-action="large"]')?.focus({ preventScroll: true });
  }
  if (action === 'recipient') {
    const id = target.dataset.id as RecipientId;
    const items = availableScenes(id);
    if (items.length === 1) openCard(items[0]!.id, id, 'home');
    else { recipientId = id; sceneId = null; attemptId = null; go('scenes'); }
  }
  if (action === 'quick') openCard(target.dataset.scene!, target.dataset.recipient as RecipientId, 'home');
  if (action === 'scene' && recipientId) openCard(target.dataset.id!, recipientId, 'scenes');
  if (action === 'tier') {
    stateId = target.dataset.id as StateId;
    copyStatus = null;
    render();
    root.querySelector<HTMLElement>(`[data-action="tier"][data-id="${stateId}"]`)?.focus({ preventScroll: true });
  }
  if (action === 'copy-opening') { const template = currentTemplate(); if (template) void copyText(template.lines.opening, '已复制开场。由你自己粘贴、发送。', 'opening'); }
  if (action === 'copy-full') { const template = currentTemplate(); const text = template && fullMessage(template); if (text) void copyText(text, '已复制开场＋正事，不含后面两段。由你自己发。', 'full'); }
  if (action === 'copy-help') void copyText('我现在不太安全，能陪着我一起联系专业帮助吗？', '已复制。只发给你信得过、安全的人。', 'help');
  if (action === 'complete' && attemptId && currentTemplate() && !selectedScene()?.help) {
    const fresh = readRecords(storage);
    if (fresh.error && !storageError) storageError = fresh.error;
    const union = new Map([...fresh.records, ...records].map((record) => [record.attemptId, record]));
    const result = completeAttempt(storageError ? null : storage, [...union.values()], attemptId, false);
    records = result.records;
    if (result.error) storageError = result.error;
    copyStatus = null;
    render();
    root.querySelector<HTMLElement>('.record [data-action="badges"]')?.focus({ preventScroll: true });
  }
  if (action === 'end-help') { sceneId = null; recipientId = null; attemptId = null; go('help-done'); }
  if (action === 'help') { if (page !== 'help') returnPage = page; go('help'); }
  if (action === 'help-return') go(returnPage === 'help' ? 'home' : returnPage);
  if (action === 'show-clear') root.querySelector<HTMLDialogElement>('#clear-dialog')?.showModal();
  if (action === 'cancel-clear') root.querySelector<HTMLDialogElement>('#clear-dialog')?.close();
  if (action === 'confirm-clear') {
    const error = clearRecords(storage);
    if (!error) { records = []; storageError = null; feedback = '本机记录已清除，可以重新开始。'; }
    else { storageError = error; feedback = '没有自动丢弃旧记录。'; }
    render();
  }
  if (action === 'back') {
    if (page === 'card' && cardFrom === 'scenes') { sceneId = null; attemptId = null; go('scenes'); }
    else if (page === 'help') go(returnPage === 'help' ? 'home' : returnPage);
    else resetHome();
  }
});

window.addEventListener('hashchange', () => {
  if (window.location.hash === '#badges') go('badges');
  else if (window.location.hash === '#help') {
    if (page !== 'help') returnPage = page;
    go('help');
  } else resetHome();
});

render();
