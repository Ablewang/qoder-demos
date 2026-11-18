import './style.css';
import { countChars, errorSchema, relations, relationLabels, responseSchema, safetyContent, statusSchema, tones, toneLabels, type AssistResponse, type Relation, type Tone, type Translation } from './contract.js';
import { demos } from './demos.js';
import { createShareCard, humorNotice } from './share.js';

function get<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
}
function button(text: string, className: string, action: () => void): HTMLButtonElement {
  const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', action); return node;
}
const home = get<HTMLElement>('#home');
const loading = get<HTMLElement>('#loading');
const resultView = get<HTMLElement>('#result');
const message = get<HTMLTextAreaElement>('#message');
const submit = get<HTMLButtonElement>('#translate');
const errorBox = get<HTMLElement>('#message-error');
const count = get<HTMLElement>('#char-count');
const shareDialog = get<HTMLDialogElement>('#share-dialog');
const shareImage = get<HTMLImageElement>('#share-image');
const hideOriginal = get<HTMLInputElement>('#hide-original');
const download = get<HTMLAnchorElement>('#download-card');
let selectedRelation: Relation = 'partner';
let controller: AbortController | undefined;
let current: { original: string; relation: Relation; result: Translation; demo: boolean } | undefined;
let currentTone: Tone = 'gentle';
let toastTimer: ReturnType<typeof setTimeout>;
let copyOperation = 0;
let shareOperation = 0;
let capability: 'checking' | 'configured' | 'local' | 'offline' = 'checking';

function notify(text: string): void {
  const node = get<HTMLElement>('#toast'); node.textContent = text; node.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 3000);
}
// A pending clipboard write may settle after the tone, result or view changed; its feedback must then be dropped.
function invalidateCopy(): void {
  copyOperation++; clearTimeout(toastTimer); get<HTMLElement>('#toast').hidden = true;
}
function show(view: 'home' | 'loading' | 'result'): void {
  invalidateCopy();
  home.hidden = view !== 'home'; loading.hidden = view !== 'loading'; resultView.hidden = view !== 'result';
  fitMessage();
  get<HTMLElement>('#main').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' });
}
function fitMessage(): void {
  if (home.hidden) return;
  message.style.height = 'auto'; message.style.height = `${message.scrollHeight}px`;
}
window.addEventListener('resize', fitMessage);
get('#safety-check').addEventListener('toggle', fitMessage);
function validate(): void {
  const length = countChars(message.value); count.textContent = `${length} / 300`;
  count.classList.toggle('over', length > 300);
  message.setAttribute('aria-invalid', String(length > 300));
  submit.disabled = (capability !== 'configured' && capability !== 'local') || !message.value.trim() || length > 300;
  fitMessage();
  if (length > 300) { errorBox.textContent = '最多 300 字。挑出你最想表达的那一段。'; errorBox.hidden = false; }
}
for (const relation of relations) {
  const label = el('label', 'relation-choice'); const radio = el('input');
  radio.type = 'radio'; radio.name = 'relation'; radio.value = relation; radio.checked = relation === selectedRelation;
  radio.addEventListener('change', () => { selectedRelation = relation; });
  label.append(radio, el('span', '', relationLabels[relation])); get('#relations').append(label);
}
message.addEventListener('input', () => { errorBox.hidden = true; validate(); });

async function checkStatus(): Promise<void> {
  const status = get<HTMLElement>('#ai-status'); const text = get<HTMLElement>('#ai-status-text');
  try {
    const response = await fetch('/api/status', { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    if (!response.ok) throw new Error('STATUS');
    const data = statusSchema.parse(await response.json());
    capability = data.configured ? 'configured' : 'local';
    status.classList.toggle('ready', data.configured);
    text.textContent = data.configured ? 'AI 已配置 · 输入将通过本地代理发送给模型供应商。' : 'AI 未配置 · 现在只能看固定演示，不能改写你的原话。';
    submit.textContent = data.configured ? '生成改写 →' : '仅检查本地安全 · 不生成改写';
  } catch {
    capability = 'offline';
    status.classList.remove('ready'); text.textContent = '无法确认 AI 能力 · 本地服务未连接。固定演示仍可看；安全检查暂不可用。';
    submit.textContent = '本地服务未连接';
  }
  const configured = capability === 'configured';
  home.classList.toggle('configured', configured);
  get('#home-title').textContent = configured ? '先把话写下。' : '先选一句，看看怎么说。';
  get('#home-note').textContent = configured ? '不必先整理好情绪，也不替你按发送。' : '固定演示里比较温和与坚定，不分析你的输入。';
  get('#examples-note').textContent = configured ? '预写样例，与输入和关系选择无关。' : '选一个场景，取一句合适的说法。幽默只适合没有伤害风险的轻松对话。';
  const form = get<HTMLFormElement>('#translate-form');
  const safety = get<HTMLDetailsElement>('#safety-check');
  (configured ? get('#form-slot') : safety).append(form);
  form.hidden = capability !== 'configured' && capability !== 'local';
  safety.hidden = capability !== 'local';
  const panel = get('.input-panel'); const examples = get('#examples');
  if (configured) home.append(panel, examples); else home.append(examples, panel);
  validate();
}
void checkStatus();
get('#jump-demos').addEventListener('click', () => {
  get('#examples').scrollIntoView({ behavior: 'smooth', block: 'start' });
  get<HTMLButtonElement>('.demo-button').focus({ preventScroll: true });
});

get<HTMLFormElement>('#translate-form').addEventListener('submit', async (event) => {
  event.preventDefault(); validate(); if (submit.disabled) return;
  errorBox.hidden = true; errorBox.classList.remove('local-check'); errorBox.setAttribute('role', 'alert');
  const localCheck = capability === 'local';
  get('#loading-title').textContent = localCheck ? '只检查本地安全提醒' : '正在检查并改写这段话';
  get('#loading-note').textContent = localCheck ? '安全检查不是改写，也不判断是否绝对安全。原话仍在，你可以取消。' : '先检查安全，再由已配置的 AI 改写。原话仍在，你可以取消。';
  const original = message.value.trim(); const relation = selectedRelation;
  const active = new AbortController(); controller = active; current = undefined; show('loading');
  try {
    const response = await fetch('/api/assist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: 1, mode: 'soften', text: original, relation }),
      signal: AbortSignal.any([active.signal, AbortSignal.timeout(20000)]),
    });
    const data: unknown = await response.json();
    if (!response.ok) {
      const parsed = errorSchema.safeParse(data);
      if (localCheck && parsed.success && parsed.data.error.code === 'AI_NOT_CONFIGURED') {
        show('home'); errorBox.hidden = false; errorBox.classList.add('local-check'); errorBox.setAttribute('role', 'status');
        errorBox.textContent = 'AI 未配置。本地规则未触发安全提醒；这不代表安全，也没有生成改写。涉及伤害请直接寻求支持。';
        errorBox.focus(); return;
      }
      throw new Error(parsed.success ? parsed.data.error.message : '翻译服务暂不可用，请稍后再试。');
    }
    renderResponse(responseSchema.parse(data), original, relation);
  } catch (error) {
    if (active.signal.aborted) return;
    show('home'); errorBox.hidden = false;
    errorBox.textContent = error instanceof Error && error.name !== 'ZodError' && error.name !== 'TypeError' && error.name !== 'TimeoutError'
      ? error.message : '网络中断、超时或返回格式异常。原话还在，你可以稍后重试。';
    errorBox.focus();
  } finally { if (controller === active) controller = undefined; }
});
get('#cancel').addEventListener('click', () => { controller?.abort(); controller = undefined; show('home'); });
get('#back').addEventListener('click', () => { current = undefined; show('home'); });
get('.brand').addEventListener('click', (event) => { event.preventDefault(); controller?.abort(); current = undefined; show('home'); });

function sourceBanner(demo: boolean, local = false): void {
  const node = get<HTMLElement>('#source-banner'); node.classList.toggle('live', !demo);
  node.textContent = demo ? '固定演示 · 非实时 AI：下面是预写样例，不是对你输入内容的分析。'
    : local ? '本地安全提醒 · 这次没有调用 AI，也没有生成改写。'
      : 'AI 辅助结果 · 理解与诉求只是推测，请核对后再决定是否发送。';
}
function renderResponse(data: AssistResponse, original: string, relation: Relation): void {
  if (data.result.kind === 'translation') renderTranslation(original, relation, data.result, false);
  else {
    current = undefined; sourceBanner(false, data.source === 'local_safety');
    get('#result-relation').textContent = relationLabels[relation];
    const content = get('#result-content'); content.replaceChildren(); content.className = 'result-sheet';
    const safety = safetyContent[data.result.category];
    const panel = el('section', 'panel safety-panel');
    panel.append(el('span', 'eyebrow', '先确认安全'), el('h2', '', safety.title), el('p', '', safety.message));
    if (data.result.category !== 'manipulation') {
      const links = el('div', 'help-links');
      links.append(el('small', '', '中国大陆 · 即时危险请联系 110 / 120；其他地区请联系当地服务。'));
      for (const [phone, text] of [['110', '警方 110'], ['120', '急救 120'], ['12356', '心理援助 12356'], ['12338', '妇女维权 12338']]) {
        const anchor = el('a', '', text); anchor.href = `tel:${phone}`; links.append(anchor);
      }
      links.append(el('small', '', '非紧急热线的服务时段和地区覆盖可能不同。'));
      panel.append(links);
    }
    panel.append(button('回去修改', 'button secondary full', () => show('home'))); content.append(panel); show('result');
  }
}
function detail(title: string, className: string): HTMLDetailsElement {
  const node = el('details', className); node.append(el('summary', '', title)); return node;
}
function renderTranslation(original: string, relation: Relation, result: Translation, demo: boolean): void {
  current = { original, relation, result, demo }; currentTone = 'gentle';
  get('#result-relation').textContent = relationLabels[relation]; sourceBanner(demo);
  const content = get('#result-content'); content.replaceChildren(); content.className = 'result-sheet';
  if (result.risk === 'caution') content.append(el('p', 'caution', result.note));
  const rewrite = el('section', 'rewrite-block');
  const heading = el('div', 'rewrite-heading'); heading.append(el('h2', '', '02 / 可说句'));
  const tabs = el('div', 'tone-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '改写语气');
  const rewriteText = el('p', 'rewrite', result.rewrites.gentle); rewriteText.id = 'rewrite-text'; rewriteText.setAttribute('role', 'tabpanel');
  const copyButton = button('复制这句，自己决定发不发', 'button primary full', () => { void copyRewrite(copyButton); });
  const humorHint = el('p', 'humor-hint', humorNotice); humorHint.hidden = true;
  for (const tone of tones) {
    const tab = button(toneLabels[tone], 'tone-tab', () => {
      invalidateCopy(); currentTone = tone; rewriteText.textContent = result.rewrites[tone]; copyButton.textContent = '复制这句，自己决定发不发'; humorHint.hidden = tone !== 'humor';
      for (const t of tabs.querySelectorAll<HTMLButtonElement>('button')) { t.setAttribute('aria-selected', String(t === tab)); t.tabIndex = t === tab ? 0 : -1; }
      rewriteText.setAttribute('aria-labelledby', tab.id);
      rewrite.querySelector('.manual-copy')?.remove();
    });
    tab.id = `tone-${tone}`; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', rewriteText.id);
    tab.setAttribute('aria-selected', String(tone === 'gentle')); tab.tabIndex = tone === 'gentle' ? 0 : -1;
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const index = tones.indexOf(tone); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
      const target = tabs.querySelectorAll<HTMLButtonElement>('button')[next]; target?.click(); target?.focus();
    }); tabs.append(tab);
  }
  rewriteText.setAttribute('aria-labelledby', 'tone-gentle'); heading.append(tabs); rewrite.append(heading, rewriteText, humorHint);
  if (countChars(original) <= 90) {
    const comparison = el('div', 'original comparison'); comparison.append(el('small', '', demo ? '演示原话' : '原话对照'), el('p', '', original)); rewrite.append(comparison);
  }
  rewrite.append(copyButton);
  const actions = el('div', 'result-actions'); actions.append(button('生成可说句分享卡', 'text-button', openShare), button('再翻一句', 'text-button', () => { current = undefined; show('home'); })); rewrite.append(actions);
  if (countChars(original) > 90) {
    const originalNode = detail(`${demo ? '演示原话' : '原话对照'} · 完整 ${countChars(original)} 字`, 'original original-long'); originalNode.append(el('p', '', original)); rewrite.append(originalNode);
  }
  const notes = el('aside', 'annotation-column'); const noteHeading = el('div', 'annotation-heading');
  noteHeading.append(el('h2', '', '03 / 旁注，可不看'), el('p', '', '以下全是推测，不是事实；不进入分享卡。')); notes.append(noteHeading);
  const facts = detail('感受、在乎、事实与请求 · 都是推测', 'meaning-details');
  for (const [key, label] of [['feeling', '可能的感受'], ['need', '可能在乎的'], ['observation', '可能的事实'], ['request', '可能的请求']] as const) {
    const tile = el('div', 'meaning-tile'); tile.append(el('span', '', label), el('p', '', result.real_meaning[key]));
    facts.append(tile);
  }
  const heard = detail('对方可能怎样理解 · 只是推测', 'heard'); heard.append(el('p', 'heard-text', result.heard_as), el('p', 'note', '只是可能的理解，不代表对方的真实想法。'));
  if (result.tip) facts.append(el('p', 'tip', result.tip));
  notes.append(facts, heard, button('不像你的想法？回去补充事实，不必接受推测。', 'text-button recheck', () => { current = undefined; show('home'); }));
  content.append(rewrite, notes); show('result');
}
async function copyRewrite(node: HTMLButtonElement): Promise<void> {
  if (!current) return;
  const operation = ++copyOperation;
  const owned = () => operation === copyOperation && node.isConnected;
  const value = current.result.rewrites[currentTone];
  node.textContent = '复制这句，自己决定发不发';
  node.parentElement?.querySelector('.manual-copy')?.remove();
  try { await navigator.clipboard.writeText(value); }
  catch {
    if (!owned()) return;
    const focus = document.activeElement;
    const textarea = el('textarea'); textarea.value = value; textarea.style.cssText = 'position:fixed;left:-9999px;top:0;'; document.body.append(textarea); textarea.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { copied = false; }
    finally { textarea.remove(); if (owned() && focus instanceof HTMLElement && focus.isConnected) focus.focus({ preventScroll: true }); }
    if (!copied) {
      const manual = el('textarea', 'manual-copy'); manual.value = value; manual.readOnly = true; manual.rows = 4; manual.setAttribute('aria-label', '复制失败，请长按选中这段话手动复制');
      node.parentElement?.querySelector('.manual-copy')?.remove(); node.after(manual); manual.focus(); manual.select(); notify('自动复制不可用，请长按手动复制。'); return;
    }
  }
  if (!owned()) return;
  node.textContent = '已复制 · 去真实的对话里说吧'; notify('已复制，发送前再读一遍。');
}
for (const [index, demo] of demos.entries()) {
  const node = button(demo.title, 'demo-button', () => renderTranslation(demo.original, demo.relation, demo.result, true));
  const original = el('span', 'demo-original', demo.original); original.id = `demo-original-${index}`; original.setAttribute('aria-hidden', 'true');
  node.setAttribute('aria-describedby', original.id); node.append(original, el('span', 'demo-open', '查看演示 →')); get('#demo-list').append(node);
}
function shareUnavailable(): void {
  shareImage.removeAttribute('src'); shareImage.hidden = true; download.removeAttribute('href'); download.setAttribute('aria-disabled', 'true'); download.tabIndex = -1;
  get<HTMLElement>('#share-save-hint').hidden = true;
  const error = get<HTMLElement>('#share-error'); error.hidden = false; error.textContent = '当前浏览器无法生成图片，请复制文本使用。'; get<HTMLElement>('#retry-share').hidden = false;
}
function refreshShare(): void {
  const operation = ++shareOperation;
  const retryFocused = document.activeElement === get('#retry-share');
  const shareError = get<HTMLElement>('#share-error'); shareError.hidden = true;
  get<HTMLElement>('#retry-share').hidden = true; get('#download-status').textContent = '';
  shareImage.removeAttribute('src'); shareImage.hidden = true; download.removeAttribute('href'); download.setAttribute('aria-disabled', 'true'); download.tabIndex = -1;
  if (!current) return;
  get('#share-contents').textContent = `出图：${toneLabels[currentTone]}版可说句、来源与非定论标识${current.result.risk === 'caution' ? '、完整风险提醒' : ''}${currentTone === 'humor' ? '、幽默适用提醒' : ''}。不包含心理或对方理解推测。${hideOriginal.checked ? '不包含原话。' : '你已选择包含完整原话，将公开全文，请核对隐私。'}`;
  try {
    const data = createShareCard({ ...current, tone: currentTone, hideOriginal: hideOriginal.checked });
    shareImage.src = data; shareImage.hidden = false; download.href = data; download.removeAttribute('aria-disabled'); download.tabIndex = 0; get<HTMLElement>('#share-save-hint').hidden = false;
    void shareImage.decode().catch(() => { if (operation === shareOperation) shareUnavailable(); });
    download.download = `吵架翻译器-${current.demo ? '固定演示' : 'AI辅助'}-${toneLabels[currentTone]}-${hideOriginal.checked ? '可说句' : '原话对照'}.png`;
    shareImage.alt = `${toneLabels[currentTone]}版可说句分享卡 · ${current.demo ? '固定演示，非实时 AI' : 'AI 辅助表达'} · 不含心理推测 · ${hideOriginal.checked ? '原话已隐藏' : '公开完整原话，请检查隐私'}`;
    if (retryFocused) get<HTMLButtonElement>('#close-share').focus({ preventScroll: true });
  } catch { shareUnavailable(); }
}
function openShare(): void { invalidateCopy(); hideOriginal.checked = true; refreshShare(); shareDialog.showModal(); shareDialog.scrollTop = 0; }
hideOriginal.addEventListener('change', refreshShare);
get('#close-share').addEventListener('click', () => shareDialog.close());
shareDialog.addEventListener('close', () => { shareOperation++; shareImage.removeAttribute('src'); download.removeAttribute('href'); });
get('#retry-share').addEventListener('click', refreshShare);
shareDialog.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const first = get<HTMLButtonElement>('#close-share');
  const last = download.hasAttribute('href') ? download : get<HTMLButtonElement>('#retry-share');
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
});
download.addEventListener('click', (event) => {
  if (!download.hasAttribute('href')) { event.preventDefault(); return; }
  get('#download-status').textContent = '已交给浏览器处理。若没有保存，请长按图片；本应用无法确认文件是否落盘。';
});
shareDialog.addEventListener('click', (event) => {
  if (event.target !== shareDialog) return;
  const rect = shareDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) shareDialog.close();
});
validate();
