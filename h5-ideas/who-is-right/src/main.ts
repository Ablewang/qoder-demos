import './style.css';
import { library } from './content/library';
import { canExportClaimCard } from './content/gate';
import { THANKS_TEMPLATES } from './content/thanks';
import { buildIndex, search } from './search';
import { drawCard, canvasToBlob, CARD_WIDTH, CARD_HEIGHT, COMMUNICATION_CARD_HEIGHT, type CardSpec } from './card/render';
import { fillSalutation, sanitizeSalutation } from './card/layout';
import { MAX_SALUTATION_CHARS } from './content/gate';
import type { Category, Saying } from './types';
import { CATEGORY_LABEL, VERDICT_LABEL, VERDICT_CARD_LABEL, esc, sayingItem } from './ui/dom';

const sayings = [...library.sayings].sort((a, b) => {
  const cat = (a.category === 'parenting' ? 0 : 1) - (b.category === 'parenting' ? 0 : 1);
  if (cat !== 0) return cat;
  return (a.status === 'source-checked' ? 0 : 1) - (b.status === 'source-checked' ? 0 : 1);
});
const byId = new Map(sayings.map((s) => [s.id, s]));
const index = buildIndex(sayings);
const checkedCount = sayings.filter((s) => s.status === 'source-checked').length;
const pendingCount = sayings.length - checkedCount;

const SALUTATIONS = ['妈', '爸', '奶奶', '爷爷', '外婆', '外公'];
const FONT_KEY = 'laohua-font-size';
const FONT_SIZES = [
  { id: 'std', label: '标准' },
  { id: 'lg', label: '大' },
  { id: 'xl', label: '特大' },
] as const;

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <a class="skip-link" href="#view">跳到正文</a>
  <header class="top">
    <div class="top-row">
      <a class="logo" href="#/">老话查一查<span>家庭常识核验手册</span></a>
      <details class="font-menu">
        <summary>字号<span data-current-font>标准</span></summary>
        <div class="font-switch" role="group" aria-label="字号">
          ${FONT_SIZES.map((f) => `<button type="button" data-font="${f.id}">${f.label}</button>`).join('')}
        </div>
      </details>
    </div>
  </header>
  <main id="view" tabindex="-1"></main>
  <footer class="foot">
    <p class="foot-state">本地内测 · 非医疗建议</p>
    <p>未发布、未经医生审核。身体不适请及时就医。</p>
    <a href="#/about">核验与隐私说明 ↗</a>
  </footer>`;
const view = document.querySelector<HTMLElement>('#view')!;
app.querySelector<HTMLAnchorElement>('.skip-link')!.addEventListener('click', (event) => {
  event.preventDefault();
  view.focus();
});

function applyFont(id: string) {
  const valid = FONT_SIZES.some((f) => f.id === id) ? id : 'std';
  document.documentElement.dataset.font = valid;
  app.querySelector('[data-current-font]')!.textContent = FONT_SIZES.find((font) => font.id === valid)!.label;
  app.querySelectorAll<HTMLButtonElement>('[data-font]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.font === valid));
  });
  try {
    localStorage.setItem(FONT_KEY, valid);
  } catch {
    /* 隐私模式下无法保存，不影响使用 */
  }
}
app.querySelectorAll<HTMLButtonElement>('[data-font]').forEach((b) => {
  b.addEventListener('click', () => {
    applyFont(b.dataset.font!);
    const menu = app.querySelector<HTMLDetailsElement>('.font-menu')!;
    menu.open = false;
    menu.querySelector<HTMLElement>('summary')!.focus();
  });
});
let savedFont = 'std';
try {
  savedFont = localStorage.getItem(FONT_KEY) ?? 'std';
} catch {
  /* ignore */
}
applyFont(savedFont);

function searchForm(value = ''): string {
  return `<form class="search" role="search" data-search>
    <label for="q" class="sr-only">输入长辈说的那句话</label>
    <input id="q" name="q" type="search" enterkeyhint="search" autocomplete="off"
      placeholder="如：少吃盐、别久坐" value="${esc(value)}" />
    <button type="submit">查一查</button>
  </form>`;
}

function bindSearch() {
  view.querySelector<HTMLFormElement>('[data-search]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget as HTMLFormElement).get('q')?.toString().trim() ?? '';
    location.hash = q ? `#/search/${encodeURIComponent(q)}` : '#/';
  });
}

function categoryChips(active: Category | null): string {
  const chip = (href: string, label: string, on: boolean) =>
    `<a class="chip" href="${href}" ${on ? 'aria-current="page"' : ''}>${label}</a>`;
  return `<nav class="chips" aria-label="分类">
    ${chip('#/', '全部', active === null)}
    ${chip('#/cat/parenting', CATEGORY_LABEL.parenting, active === 'parenting')}
    ${chip('#/cat/health', CATEGORY_LABEL.health, active === 'health')}
  </nav>`;
}

function thanksEntry(fromId?: string): string {
  const href = fromId ? `#/thanks/${esc(fromId)}` : '#/thanks';
  return `<a class="thanks-entry" href="${href}">
    <strong>只说“知道了”，也可以</strong>
    <span>先取一句文字，图片可选，不必表达感谢</span>
  </a>`;
}

function recordNumber(s: Saying): string {
  return String(library.sayings.findIndex((item) => item.id === s.id) + 1).padStart(2, '0');
}

function directoryItem(s: Saying): string {
  return sayingItem(s, recordNumber(s));
}

function articleHead(s: Saying): string {
  return `<div class="article-head"><p class="record-id">${CATEGORY_LABEL[s.category]} / 条目 ${recordNumber(s)}</p>
    <h1 class="saying-title">“${esc(s.title)}”</h1></div>`;
}

function renderHome(cat: Category | null) {
  const list = cat ? sayings.filter((s) => s.category === cat) : sayings;
  const checked = list.filter((s) => s.status === 'source-checked');
  const pending = list.filter((s) => s.status === 'pending');
  view.innerHTML = `
    <div class="home-intro"><p class="eyebrow">一句叮嘱，一份依据</p><h1>家里的老话，<br>翻到出处再说。</h1></div>
    ${searchForm()}
    <p class="library-status">育儿 / 养生 · ${sayings.length} 条记录 · ${checkedCount} 条原文已核对 · ${pendingCount} 条待核验</p>
    <p class="scope-intro">只查现有目录里的说法，不提供自由问答。</p>
    <div class="directory-heading"><h2>查证目录</h2></div>
    ${categoryChips(cat)}
    <ul class="list" data-checked-list>${checked.map(directoryItem).join('')}</ul>
    <details class="pending-library" data-pending-library>
      <summary>待核验演示（${pending.length}）</summary>
      <p class="pending-context">以下未完成核验，不能作为医疗建议，也不能生成建议卡片。</p>
      <ul class="list">${pending.map(directoryItem).join('')}</ul>
    </details>
    ${thanksEntry()}`;
  bindSearch();
}

function renderSearch(q: string) {
  const hits = search(index, q, 8);
  const body = hits.length
    ? `<p class="muted">找到 ${hits.length} 条相近的说法：</p><ul class="list">${hits.map((h) => directoryItem(h.saying)).join('')}</ul>`
    : `<section class="empty" data-empty>
        <h2>库里还没有这句话</h2>
        <p>现有育儿、养生 ${sayings.length} 条没有覆盖这句，不据此判断对错。请查看现有目录，或换个说法查找。</p>
        ${categoryChips(null)}
        <p class="muted">涉及孩子或家人身体情况，请咨询医生。</p>
      </section>`;
  view.innerHTML = `<a class="back" href="#/">← 查证目录</a><h1 class="page-title">查找这句话</h1>${searchForm(q)}${body}${thanksEntry()}`;
  bindSearch();
}

function section(title: string, text: string | undefined, cls = ''): string {
  if (!text) return '';
  return `<section class="block ${cls}"><h2>${title}</h2><p>${esc(text)}</p></section>`;
}

function sourcesPanel(s: Saying): string {
  const items = s.sources
    .map((src, i) => {
      const meta = [src.org, src.year ? `${src.year} 年` : ''].filter(Boolean).join(' · ');
      const verified = src.url && src.quote;
      return `<li class="source">
        <p class="record-id">${recordNumber(s)} / 来源 ${i + 1}</p><p class="source-title">${esc(src.title)}</p>
        <p class="muted">${esc(meta)}</p>
        ${src.quote ? `<blockquote><span class="q-label">原文摘录</span>${esc(src.quote)}</blockquote>` : ''}
        ${src.scope ? `<p><span class="q-label">适用范围</span>${esc(src.scope)}</p>` : ''}
        ${src.checkedAt ? `<p><span class="q-label">核对日期</span>${esc(src.checkedAt)}</p>` : ''}
        ${src.url ? `<p><a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">打开原页面</a></p>` : ''}
        ${verified ? '' : '<p class="warn-text">这是拟依据的来源类型，原文还没有找到并核对。</p>'}
      </li>`;
    })
    .join('');
  return `<details class="sources" data-sources>
    <summary>查看来源（${s.sources.length}）<span>原文 / 范围 / 核对日期</span></summary>
    <ul>${items}</ul>
    <p class="muted small">${s.status === 'pending'
      ? '以下仅为待核验材料，即使有原文摘录也不代表条目已审核，不能作为医疗建议。'
      : '“已核对”指编辑核对来源原文，不代表医生审核。'}</p>
  </details>`;
}

function renderSaying(s: Saying) {
  const pending = s.status === 'pending';
  if (pending) {
    view.innerHTML = `
      <a class="back" href="#/">← 首页</a>
      <section class="pending-notice" role="note" data-pending>
        <div data-pending-state><h2>待核验 · ${s.risk === 'medical' ? '医疗相关演示' : '仅演示'}</h2>
          <p><strong>不能作为医疗建议，也不要转给家人。</strong></p></div>
        ${articleHead(s)}
        <p>${esc(s.pendingNote ?? '')}</p>
        <p>身体不适请咨询医生。</p>
      </section>
      <button class="btn" type="button" disabled data-card-disabled>未核验，不能生成大字卡</button>
      ${sourcesPanel(s)}
      <details class="demo-content" data-demo-content>
        <summary>查看待核验演示内容</summary>
        <p class="demo-verdict" data-demo-verdict>演示分类（未定论）：${VERDICT_LABEL[s.verdict]}</p>
        ${section('演示解释（待核验）', s.elderRight)}
        ${section('可以理解的出发点（不代表做法对）', s.intent)}
        ${section('演示说法（待核验，非建议）', s.nowAdvice)}
        ${section('演示说明（待核验）', s.whyChanged)}
        ${section('适用范围（待核验）', s.scopeNote)}
        ${section('演示就医提示（待核验）', s.redFlags)}
      </details>
      ${thanksEntry(s.id)}`;
    return;
  }
  view.innerHTML = `
    <a class="back" href="#/">← 首页</a>
    ${articleHead(s)}
    <p class="verdict-line"><span class="verdict-${s.verdict}">${VERDICT_LABEL[s.verdict]}</span><span>来源原文已核对</span></p>
    ${section('对照现在的建议', s.nowAdvice, 'advice')}
    ${section('先看适用范围', s.scopeNote, 'scope')}
    ${sourcesPanel(s)}
    <section class="actions">
      ${canExportClaimCard(s)
        ? `<a class="btn primary" href="#/card/${esc(s.id)}">做一张大字卡</a>
           <p class="muted small">看过依据，再私下发给家人。</p>`
        : '<button class="btn" type="button" disabled data-card-disabled>暂时没有大字卡</button>'}
    </section>
    <details class="reasoning">
      <summary>为什么这么说</summary>
      ${section('长辈对在哪', s.elderRight, 'good')}
      ${section('可以理解的出发点（不代表做法对）', s.intent)}
      ${section('为什么不一样了', s.whyChanged)}
    </details>
    ${section('这些情况别等，及时就医', s.redFlags, 'danger')}
    ${thanksEntry(s.id)}`;
}

let currentUrl: string | null = null;

function cardEditor(opts: {
  backHref: string;
  title: string;
  intro: string;
  templates?: { id: string; tone: string }[];
  initialTemplate?: string;
  build: (salutation: string, templateId: string) => CardSpec;
}) {
  const communication = Boolean(opts.templates);
  const cardHeight = communication ? COMMUNICATION_CARD_HEIGHT : CARD_HEIGHT;
  view.innerHTML = `<div data-editor>
    <div class="editor-heading">
      <h1>${opts.title}</h1>
      <a class="back" href="${opts.backHref}">返回</a>
    </div>
    <p class="card-selection" tabindex="-1" data-card-selection></p><p class="bitmap-note">真实 PNG · ${CARD_WIDTH} × ${cardHeight} · 网页字号不改变图片</p>
    <div class="card-out">
      <div class="card-preview" data-card-preview data-card-format="${communication ? 'communication' : 'claim'}">
        <img alt="生成的卡片图片" hidden data-card-img />
        <div class="preview-state" role="status" data-export-status><p data-export-state>图片正在生成…</p><button class="btn" type="button" hidden data-export-retry>重新生成</button></div>
      </div>
      <div class="export-actions"><a class="btn primary" download="laohua-card.png" aria-disabled="true" data-card-download>下载图片</a>
        <a class="btn" target="_blank" rel="noopener noreferrer" hidden data-card-original>查看原图</a></div>
      <p class="muted small" hidden data-card-save-hint>也可长按图片保存，私下发送。</p>
    </div>
    <details class="card-settings" data-card-settings>
      <summary>改称呼${opts.templates ? '、说法' : ''}或品牌</summary>
      <div class="card-settings-body">
        ${opts.templates ? `<fieldset class="choices">
          <legend>选一句（沟通卡可不用）</legend>
          ${opts.templates.map((t, i) => `<label><input type="radio" name="tpl" value="${esc(t.id)}" ${(opts.initialTemplate ? t.id === opts.initialTemplate : i === 0) ? 'checked' : ''} />${esc(t.tone)}</label>`).join('')}
        </fieldset>` : ''}
        <fieldset class="choices">
          <legend>称呼（最多${MAX_SALUTATION_CHARS}字）</legend>
          ${SALUTATIONS.map((n, i) => `<label><input type="radio" name="sal" value="${n}" ${i === 0 ? 'checked' : ''} />${n}</label>`).join('')}
          <label class="custom"><input type="radio" name="sal" value="__custom" />自己填
            <input type="text" name="custom" maxlength="${MAX_SALUTATION_CHARS}" placeholder="最多${MAX_SALUTATION_CHARS}个字" aria-label="自定义称呼" /></label>
        </fieldset>
        <label class="toggle"><input type="checkbox" name="brand" /> 显示“老话查一查”品牌</label>
        <button class="btn" type="button" data-preview-jump>回到预览</button>
      </div>
    </details>
    <details class="card-context">
      <summary>${opts.templates ? '不想用沟通卡？' : '这张卡的条目'}</summary>
      <p>${opts.intro}</p>
      <a class="back" href="${opts.backHref}">${opts.templates ? '不使用，返回' : '返回查看证据'}</a>
    </details>
  </div>`;
  const editor = view.querySelector<HTMLElement>('[data-editor]')!;

  const canvas = document.createElement('canvas');
  const img = view.querySelector<HTMLImageElement>('[data-card-img]')!;
  const download = view.querySelector<HTMLAnchorElement>('[data-card-download]')!;
  const original = editor.querySelector<HTMLAnchorElement>('[data-card-original]')!;
  const customInput = editor.querySelector<HTMLInputElement>('input[name="custom"]')!;
  const selection = editor.querySelector<HTMLElement>('[data-card-selection]')!;
  const exportState = editor.querySelector<HTMLElement>('[data-export-state]')!;
  const saveHint = editor.querySelector<HTMLElement>('[data-card-save-hint]')!;
  const settings = editor.querySelector<HTMLDetailsElement>('[data-card-settings]')!;
  const exportStatus = editor.querySelector<HTMLElement>('[data-export-status]')!;
  const retry = editor.querySelector<HTMLButtonElement>('[data-export-retry]')!;

  const read = () => {
    const sal = editor.querySelector<HTMLInputElement>('input[name="sal"]:checked')?.value ?? SALUTATIONS[0];
    const custom = sanitizeSalutation(customInput.value, MAX_SALUTATION_CHARS);
    const salutation = sal === '__custom' ? custom || SALUTATIONS[0] : sal;
    const tpl = editor.querySelector<HTMLInputElement>('input[name="tpl"]:checked')?.value ?? '';
    const brand = editor.querySelector<HTMLInputElement>('input[name="brand"]')!.checked;
    const tone = opts.templates?.find((template) => template.id === tpl)?.tone;
    selection.textContent = `给${salutation}${tone ? ` · ${tone}` : ''}${brand ? ' · 有品牌' : ''}`;
    return { ...opts.build(salutation, tpl), brand };
  };

  let seq = 0;
  const regenerate = async () => {
    const mine = ++seq;
    const retrying = document.activeElement === retry;
    img.hidden = true;
    img.removeAttribute('src');
    saveHint.hidden = true;
    download.removeAttribute('href');
    original.hidden = true;
    original.removeAttribute('href');
    download.setAttribute('aria-disabled', 'true');
    exportStatus.hidden = false;
    exportState.hidden = false;
    retry.hidden = true;
    exportStatus.classList.remove('export-error');
    editor.querySelector('[data-card-preview]')!.append(exportStatus);
    exportState.textContent = '图片正在更新…';
    let nextUrl: string | null = null;
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (mine !== seq || !editor.isConnected) return;
      const spec = read();
      drawCard(canvas, spec);
      const blob = await canvasToBlob(canvas);
      if (mine !== seq || !editor.isConnected) return;
      nextUrl = URL.createObjectURL(blob);
      const preview = new Image();
      preview.src = nextUrl;
      await preview.decode();
      if (mine !== seq || !editor.isConnected) {
        URL.revokeObjectURL(nextUrl);
        return;
      }
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = nextUrl;
      img.alt = [...spec.lines, spec.scopeNote, spec.sourceLine, spec.footer].filter(Boolean).join('；');
      img.src = nextUrl;
      img.hidden = false;
      download.href = nextUrl;
      original.href = nextUrl;
      original.hidden = false;
      download.setAttribute('aria-disabled', 'false');
      exportState.hidden = true;
      exportStatus.hidden = true;
      saveHint.hidden = false;
      if (retrying) selection.focus({ preventScroll: true });
    } catch {
      if (nextUrl) URL.revokeObjectURL(nextUrl);
      if (mine !== seq || !editor.isConnected) return;
      exportState.textContent = '图片未生成成功，尚不能保存。请重新生成。';
      retry.hidden = false;
      exportStatus.classList.add('export-error');
      editor.querySelector('.card-out')!.append(exportStatus);
      retry.focus();
    }
  };

  retry.addEventListener('click', () => void regenerate());
  download.addEventListener('click', (event) => {
    if (download.getAttribute('aria-disabled') === 'true') event.preventDefault();
  });
  customInput.addEventListener('focus', () => {
    editor.querySelector<HTMLInputElement>('input[name="sal"][value="__custom"]')!.checked = true;
    void regenerate();
  });
  editor.addEventListener('input', () => void regenerate());
  editor.querySelector<HTMLButtonElement>('[data-preview-jump]')!.addEventListener('click', () => {
    settings.open = false;
    selection.focus({ preventScroll: true });
    selection.scrollIntoView({ block: 'start' });
  });
  void regenerate();
}

function renderClaimCard(s: Saying) {
  if (!canExportClaimCard(s) || !s.bigCard) {
    view.innerHTML = `<a class="back" href="#/s/${esc(s.id)}">← 返回</a>
      <section class="pending-notice" data-pending><h2>这条不能生成大字卡</h2>
      <p>只有来源原文已核对的条目才能生成对外卡片。</p></section>`;
    return;
  }
  const card = s.bigCard;
  cardEditor({
    backHref: `#/s/${esc(s.id)}`,
    title: '查证大字卡',
    intro: `“${esc(s.title)}”——字大、话短，方便长辈看。`,
    build: (salutation) => ({
      label: VERDICT_CARD_LABEL[s.verdict],
      lines: card.lines.map((l) => fillSalutation(l, salutation)),
      sourceLine: card.sourceLine,
      scopeNote: s.scopeNote,
      record: recordNumber(s),
      primaryLine: ['toddler-self-feeding', 'toddler-less-salt', 'salt-less', 'egg-yolk', 'sit-less'].includes(s.id) ? 2 : 1,
      checkedAt: s.sources[0]?.checkedAt,
      footer: '本地内测样卡，非医疗建议',
      brand: false,
    }),
  });
}

let replyTemplateId = 'plain';

function renderThanks(from?: Saying) {
  const template = THANKS_TEMPLATES.find(t => t.id === replyTemplateId)!;
  view.innerHTML = `<div class="reply-page" data-reply>
    <a class="back" href="${from ? `#/s/${esc(from.id)}` : '#/'}">← 返回</a>
    <div class="article-head"><p class="record-id">手册附页 / 一句回应</p><h1>只回一句，也可以</h1></div>
    <section class="reply-text"><label for="reply-text">可以直接说</label>
      <textarea id="reply-text" data-reply-text readonly rows="3">${esc(template.text)}</textarea>
      <div class="reply-actions"><button class="btn primary" type="button" data-reply-copy>复制这句</button><button class="btn" type="button" data-reply-select>选择文字</button></div>
      <p class="copy-status" role="status" data-copy-status></p>
    </section>
    <fieldset class="choices reply-choices"><legend>换个说法（自己选，不必感谢或赞同）</legend>
      ${THANKS_TEMPLATES.map(t => `<label><input type="radio" name="reply-tpl" value="${t.id}" ${t.id === template.id ? 'checked' : ''} />${esc(t.tone)}</label>`).join('')}
    </fieldset>
    <div class="reply-image-option"><a class="back" data-reply-image href="#/thanks-image/${template.id}${from ? `/${esc(from.id)}` : ''}">做成大字图片 →</a><p class="muted small">可选 · 真实 PNG · 1080 × 720</p></div>
  </div>`;
  const reply = view.querySelector<HTMLElement>('[data-reply]')!;
  const text = reply.querySelector<HTMLTextAreaElement>('[data-reply-text]')!;
  const status = reply.querySelector<HTMLElement>('[data-copy-status]')!;
  let copySeq = 0;
  const selectText = () => { text.focus(); text.select(); };
  reply.querySelector('[data-reply-select]')!.addEventListener('click', selectText);
  reply.querySelector('[data-reply-copy]')!.addEventListener('click', async () => {
    const mine = ++copySeq;
    try {
      await navigator.clipboard.writeText(text.value);
      if (mine === copySeq && reply.isConnected) status.textContent = '已复制，可以粘贴发送。';
    } catch {
      if (mine !== copySeq || !reply.isConnected) return;
      status.textContent = '复制未成功，请手动复制已选文字。';
      selectText();
    }
  });
  reply.addEventListener('change', () => {
    ++copySeq;
    replyTemplateId = reply.querySelector<HTMLInputElement>('input[name="reply-tpl"]:checked')!.value;
    text.value = THANKS_TEMPLATES.find(t => t.id === replyTemplateId)!.text;
    status.textContent = '';
    reply.querySelector<HTMLAnchorElement>('[data-reply-image]')!.href = `#/thanks-image/${replyTemplateId}${from ? `/${from.id}` : ''}`;
  });
}

function renderThanksImage(templateId: string, from?: Saying) {
  const template = THANKS_TEMPLATES.find(t => t.id === templateId) ?? THANKS_TEMPLATES[0];
  replyTemplateId = template.id;
  cardEditor({
    backHref: from ? `#/thanks/${esc(from.id)}` : '#/thanks',
    title: '沟通大字图',
    intro: '只是一句回应，不是查证结论。也可以返回复制文字，不用图片。',
    templates: THANKS_TEMPLATES,
    initialTemplate: template.id,
    build: (salutation, tplId) => {
      const tpl = THANKS_TEMPLATES.find(t => t.id === tplId)!;
      replyTemplateId = tpl.id;
      return {
        lines: tpl.lines.map(l => fillSalutation(l, salutation)),
        footer: '本地内测样卡',
        brand: false,
      };
    },
  });
}

function renderAbout() {
  view.innerHTML = `
    <a class="back" href="#/">← 首页</a>
    <div class="article-head"><p class="record-id">手册附页 / 核验与隐私</p><h1>这本手册怎样查证</h1></div>
    <section class="block"><h2>它是什么</h2>
      <p>帮你查一查长辈常说的老话，现在的权威建议怎么说。长辈说得对的，我们直接说对；只对一半的，说清楚哪一半；做法已经更新的，先说出发点，再说现在的建议。</p></section>
    <section class="block"><h2>它不是什么</h2>
      <p>不是医疗建议服务，没有医生审核，不能代替看病。只在本机运行，没有发布。</p></section>
    <section class="block"><h2>两种状态</h2>
      <p><b>来源原文已核对</b>：编辑把结论和来源原文逐字对过，记下了适用范围和核对日期。只有低风险的生活常识能标这个状态。它不代表医生审核。</p>
      <p><b>待核验 · 仅演示</b>：来源还没对完，或者涉及孩子、疾病等医疗内容，需要专业人员审核。这类条目只用来演示界面，不能生成对外的大字卡。</p></section>
    <section class="block"><h2>现在的库</h2>
      <p>共 ${sayings.length} 条：${checkedCount} 条已核对，${pendingCount} 条待核验。距离计划中的正式内容库还差得远，正在慢慢补。</p></section>
    <section class="block"><h2>隐私</h2>
      <p>不接入 AI 自由问答，不使用第三方统计。卡片在你的手机上生成，称呼不会上传。只在本机记住你选的字号。</p></section>`;
}

function route() {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
  app.querySelector<HTMLDetailsElement>('.font-menu')!.open = false;
  let hash = location.hash.replace(/^#\/?/, '');
  try {
    hash = decodeURIComponent(hash);
  } catch {
    hash = '';
  }
  const [head, ...rest] = hash.split('/');
  const arg = rest.join('/');
  if (head === 'search' && arg) renderSearch(arg);
  else if (head === 'cat' && (arg === 'parenting' || arg === 'health')) renderHome(arg);
  else if (head === 's' && byId.has(arg)) renderSaying(byId.get(arg)!);
  else if (head === 'card' && byId.has(arg)) renderClaimCard(byId.get(arg)!);
  else if (head === 'thanks') renderThanks(byId.get(arg));
  else if (head === 'thanks-image') renderThanksImage(rest[0], byId.get(rest[1]));
  else if (head === 'about') renderAbout();
  else renderHome(null);
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
