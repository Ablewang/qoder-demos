const library = await fetch('./content.json').then((response) => response.json());
const salt = library.sayings.find((item) => item.id === 'salt-less');
const pending = library.sayings.find((item) => item.id === 'fever-cover-sweat');
const checked = [salt, ...library.sayings.filter((item) => item.status === 'source-checked' && item.id !== salt.id)];
const drafts = library.sayings.filter((item) => item.status === 'pending');
const verdicts = { right: '说得对', half: '有一半在理', outdated: '现在有新建议' };
const app = document.querySelector('#preview');
let font = 'std';
let category = 'all';
const esc = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const fontMenu = () => `<details class="font-control"><summary>页面字号 ${font === 'xl' ? '25' : font === 'lg' ? '21' : '18'}</summary><div class="font-options">${['std', 'lg', 'xl'].map((id) => `<button type="button" data-font="${id}" aria-pressed="${id === font}">${id === 'std' ? '18' : id === 'lg' ? '21' : '25'}</button>`).join('')}</div></details>`;
const header = () => `<header class="masthead"><a class="wordmark" href="#home">老话查一查<span>家庭叮嘱 · 查证手册</span></a>${fontMenu()}</header>`;
const footer = () => `<footer class="review-footer"><p>静态评审稿 · 称呼为虚构样例。<br>本地内测，非医疗建议；来源原文已核对不等于医生审核。</p><details><summary>本稿范围与页面</summary><p>内容来自现有静态库：8 条来源原文已核对，9 条待核验。此稿只演示两组搜索与核心页面，没有接入生产搜索、医疗判断或下载链路。</p><nav class="review-nav" aria-label="静态评审页面"><a href="#home">首页</a><a href="#results">搜索结果</a><a href="#evidence">盐的查证</a><a href="#pending">待核验详情</a><a href="#export">查证便条</a><a href="#thanks">沟通便条</a><a href="#updating">更新状态</a></nav></details></footer>`;
const form = (query = '') => `<form class="search" data-search><label class="sr-only" for="query">家里常说的那句话</label><input id="query" name="query" type="search" placeholder="例如：少吃盐" value="${esc(query)}" autocomplete="off" /><button type="submit">查找</button></form>`;
function directory(items, isPending = false) {
  return `<ol class="directory">${items.map((item, index) => `<li><span class="entry-number">${String(index + 1).padStart(2, '0')}</span><div>${isPending ? `<span class="entry-state">待核验 · ${item.risk === 'medical' ? '医疗相关仅演示' : '仅演示'}</span>` : ''}${item.id === salt.id || item.id === pending.id ? `<a class="entry-title" href="#${isPending ? 'pending' : 'evidence'}">${esc(item.title)}</a>` : `<span class="entry-title">${esc(item.title)}</span>`}<p class="entry-note">${isPending ? '未核验，不能作为医疗建议，也不能生成建议便条。' : `<strong>${verdicts[item.verdict]}</strong> · 来源原文已核对`}</p></div></li>`).join('')}</ol>`;
}
function home() {
  const items = category === 'all' ? checked : checked.filter((item) => item.category === category);
  app.innerHTML = `${header()}<main><h1 class="query-label">查家里常说的那句话</h1>${form()}<p class="search-note">静态样例可查「少放盐」或「发烧要捂汗」。</p><div class="directory-heading"><h2>有依据的生活常识</h2><span>8 条已核对 / 9 条待核验</span></div><nav class="category-tabs" aria-label="分类">${[['all', '全部'], ['parenting', '育儿'], ['health', '养生']].map(([id, title]) => `<button type="button" data-category="${id}" aria-pressed="${id === category}">${title}</button>`).join('')}</nav>${directory(items)}<details class="pending-directory"><summary>待核验的说法 · ${drafts.length} 条</summary><p>这些条目只作界面演示，未完成核验；不能作为医疗建议或生成建议便条。</p>${directory(drafts, true)}</details><div class="quiet-action"><span>也可以不讲道理，只回一句。</span><a href="#thanks">看看沟通便条 →</a></div></main>${footer()}`;
}
function results() {
  const query = new URLSearchParams(location.hash.split('?')[1] ?? '').get('q') ?? '少放盐';
  const isPending = /发烧|捂汗/.test(query);
  const known = isPending || /盐|咸/.test(query);
  app.innerHTML = `${header()}<main><h1 class="query-label">查家里常说的那句话</h1>${form(query)}<div class="directory-heading"><h2>${known ? '静态搜索结果' : '这组搜索未在静态稿中示范'}</h2><a class="back" href="#home">返回目录</a></div>${known ? directory([isPending ? pending : salt], isPending) : '<p>本稿只演示「少放盐」与「发烧要捂汗」，未接入生产搜索。</p>'}<p class="production-note">全库仍是 8 条来源原文已核对、9 条待核验。待核验结果不会因目录折叠而消失。</p><div class="quiet-action"><span>另一种结果</span><a href="#${isPending ? 'results' : 'pending-results'}">${isPending ? '查看已核对样例' : '查看待核验样例'} →</a></div></main>${footer()}`;
}
function sourceRecord(source, index) {
  return `<details id="record-${index}" data-source-record><summary>展开 [${index}] ${index === 1 ? '中国指南' : 'WHO'} 原文与核对记录</summary><div class="source-record"><blockquote>${esc(source.quote)}</blockquote><dl><dt>来源机构与转载说明</dt><dd>${esc(source.org)}</dd><dt>文件</dt><dd>${esc(source.title)}</dd><dt>年份</dt><dd>${source.year ? `${source.year} 年` : '现有记录未注明文件年份'}</dd><dt>适用范围</dt><dd>${esc(source.scope)}</dd><dt>编辑核对日期</dt><dd>${esc(source.checkedAt)}</dd></dl><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">打开完整原页面 ↗</a></div></details>`;
}
function evidence() {
  const sentences = salt.nowAdvice.match(/[^。]+。/g);
  const first = salt.sources[0];
  const second = salt.sources[1];
  const shortQuote = first.quote.split('，烹调油')[0];
  const whoQuote = second.quote.match(/less than 5 g\/day salt/)[0];
  app.innerHTML = `${header()}<main><a class="back" href="#results">← 查找结果</a><header class="article-head"><h1>${esc(salt.title)}</h1><p class="verdict">说得对 · 来源原文已核对</p></header><section class="current-advice"><h2>现在怎么做</h2><p>${esc(sentences[0])}<span class="reference">[1]</span></p><div class="amount-and-scope"><p>${esc(sentences[1])}<span class="reference">[1]</span></p><aside class="scope"><h2>适用范围</h2><p>${esc(salt.scopeNote)}</p></aside></div></section><nav class="reference-actions" aria-label="建议的出处跳转"><a href="#source-one" data-jump="source-one">出处 [1]</a><a href="#source-two" data-jump="source-two">对照 [2]</a></nav><section class="short-sources" aria-label="短出处"><h2>建议的依据</h2><section class="evidence" id="source-one"><h3>[1] ${esc(first.title)}</h3><p class="citation">中国营养学会 · 南充市疾控中心转载 · ${first.year} 年</p><blockquote>“${esc(shortQuote)}”</blockquote><a class="source-jump" href="#record-1" data-record="record-1">原文与核对 [1] →</a></section><section class="evidence" id="source-two"><h3>[2] ${esc(second.org)} · ${esc(second.title)}</h3><p class="citation">文件年份未记录 · ${esc(second.scope)}</p><blockquote lang="en">“${esc(whoQuote)}”</blockquote><p class="bound-note">less than 指严格小于，不等同于 [1] 的“不超过”。</p><a class="source-jump" href="#record-2" data-record="record-2">原文与核对 [2] →</a></section></section><div class="article-actions"><a class="action primary" href="#export">写成家庭便条 →</a><a class="action secondary" href="#thanks">也可以不讲道理，只回一句话</a></div><section class="source-records" aria-label="完整原文摘录与核对记录"><h2>继续查原文</h2>${sourceRecord(first, 1)}${sourceRecord(second, 2)}<p class="production-note">“已核对”指编辑核对来源原文，不代表医生审核。</p></section></main>${footer()}`;
}
function pendingDetail() {
  app.innerHTML = `${header()}<main><a class="back" href="#pending-results">← 查找结果</a><section class="pending-header" role="note"><p class="pending-kind">待核验 · 医疗相关仅演示</p><h1>${esc(pending.title)}</h1><p>不能作为医疗建议，也不要转给家人。</p></section><section class="pending-material"><h2>材料仍待核验</h2><p class="pending-note">${esc(pending.pendingNote)}</p>${pending.sources.map((source) => `<p>${esc(source.title)}</p><p class="small">${esc(source.org)}${source.year ? ` · ${source.year} 年` : ''}</p>`).join('')}<p>这是拟依据的来源类型，具体原文还未找到并核对；没有可冒充已核实出处的链接。</p></section><div class="article-actions"><button class="action primary" type="button" disabled>未核验，不能生成建议便条</button><a class="action secondary" href="#thanks">可以不使用卡片，或只回一句话</a></div></main>${footer()}`;
}
function exportPage(isThanks, updating) {
  const type = isThanks ? '沟通表达' : '查证内容';
  const asset = isThanks ? './shots-round2/thanks-note.png' : './shots-round2/claim-note.png';
  app.innerHTML = `<header class="export-head"><a class="back" href="#${isThanks ? 'evidence' : 'evidence'}">← 返回查证</a><span class="review-tag">静态评审</span>${fontMenu()}</header><main class="export-main"><p class="note-caption"><span>${type} / 1080 × 1440</span><span>虚构称呼</span></p><p class="bitmap-note">固定图片；页面字号不会改变图内文字大小。</p><div class="note-preview" data-note-preview><img src="${asset}" alt="${isThanks ? '奶奶，谢谢惦记。我都记着呢，会照顾好自己。静态评审沟通便条。' : '奶奶说得对，口味淡一点，少吃盐真没错。成人每天不超5克。附适用范围与出处。静态评审便条。'}" ${updating ? 'hidden' : ''} data-note-image /><div class="note-pending" role="status" data-update-state ${updating ? '' : 'hidden'}><p>便条正在更新</p><span>旧图已隐藏。<br>完成后再开放保存。</span></div></div>${isThanks ? '' : `<aside class="preview-scope"><h2>图内适用范围</h2><p>${esc(salt.scopeNote)}</p></aside>`}<div class="export-actions"><button class="action primary" type="button" data-mock-save ${updating ? 'disabled' : ''}>保存图片</button><button class="action secondary" type="button" data-open-settings>修改</button></div><p class="export-hint" data-save-hint ${updating ? 'hidden' : ''}>长按保存为完成态的视觉提示；本稿未验证原生长按或接入生产下载。</p><p class="mock-feedback" role="status" hidden data-save-feedback>这是静态评审稿，只示范按钮状态。<a href="${asset}" target="_blank">打开实际 1080×1440 样图</a>可检查排版，不是生产导出链路。</p><details class="mock-settings" data-settings><summary>称呼、说法与品牌</summary><p>虚构样例：奶奶。${isThanks ? '选用现有「暖一点」模板；沟通卡完全可不用。' : '沿用现有盐条目的便条正文；来源与适用范围不改。'}</p><label><input type="checkbox" disabled />显示品牌（默认关闭，此稿未接入）</label><a href="${asset}" target="_blank">查看实际样图 ↗</a></details><button class="state-toggle" type="button" data-toggle-state>${updating ? '查看完成态' : '示范更新态：隐藏旧图'}</button>${isThanks ? '<a class="action secondary" href="#thanks-compare">比较竖版与短便条候选</a><a class="action secondary" href="#evidence">不用沟通卡，返回</a>' : '<a class="action secondary" href="#thanks">也可以只说“谢谢惦记”</a>'}</main>${footer()}`;
}
function thanksComparison() {
  const alt = '奶奶，谢谢惦记。我都记着呢，会照顾好自己。静态评审样卡，虚构称呼，本地内测，非医疗建议。';
  app.innerHTML = `${header()}<main class="comparison-main"><a class="back" href="#thanks">← 原沟通预览</a><h1>同一句话，两种便条</h1><p class="comparison-intro">两版保留同一套现有短文案与静态内测标记。宽屏并排；手机上下排列、同宽显示，不把两张缩成小缩略图。</p><div class="comparison-grid"><figure data-comparison="long"><figcaption><strong>第二轮竖版</strong><span>1080 × 1440</span></figcaption><img src="./shots-round2/thanks-note.png" alt="${alt}" /><a href="./shots-round2/thanks-note.png" target="_blank">查看实际 PNG ↗</a></figure><figure data-comparison="short"><figcaption><strong>短便条候选</strong><span>1080 × 720</span></figcaption><img src="./shots-round2/thanks-note-short.png" alt="${alt}" /><a href="./shots-round2/thanks-note-short.png" target="_blank">查看实际 PNG ↗</a></figure></div><p class="production-note">只比较静态构图：两版都用同一字号的连续文本块接话，保留自然停顿；没有裁判结论，没有删去正文或内测标记。生产沟通导出仍是 1080×1440，未批准变更，也没有接入短版下载或更新链路。</p><a class="action secondary" href="#evidence">不用沟通卡，返回查证</a></main>${footer()}`;
}
function bind() {
  app.querySelectorAll('[data-font]').forEach((button) => button.addEventListener('click', () => {
    font = button.dataset.font;
    document.documentElement.dataset.font = font;
    render(false);
  }));
  app.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => {
    category = button.dataset.category;
    home();
    bind();
  }));
  app.querySelector('[data-search]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get('query').trim();
    location.hash = query ? `results?q=${encodeURIComponent(query)}` : 'home';
  });
  app.querySelectorAll('[data-jump]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById(link.dataset.jump).scrollIntoView({ block: 'start' });
  }));
  app.querySelectorAll('[data-record]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    const record = document.getElementById(link.dataset.record);
    record.open = true;
    record.scrollIntoView({ block: 'start' });
  }));
  app.querySelector('[data-open-settings]')?.addEventListener('click', () => {
    const settings = app.querySelector('[data-settings]');
    settings.open = true;
    settings.scrollIntoView({ block: 'nearest' });
  });
  app.querySelector('[data-mock-save]')?.addEventListener('click', () => {
    app.querySelector('[data-save-feedback]').hidden = false;
  });
  app.querySelector('[data-toggle-state]')?.addEventListener('click', () => {
    const image = app.querySelector('[data-note-image]');
    const state = app.querySelector('[data-update-state]');
    const hint = app.querySelector('[data-save-hint]');
    const save = app.querySelector('[data-mock-save]');
    const updating = !image.hidden;
    image.hidden = updating;
    state.hidden = !updating;
    hint.hidden = updating;
    save.disabled = updating;
    app.querySelector('[data-save-feedback]').hidden = true;
    app.querySelector('[data-toggle-state]').textContent = updating ? '查看完成态' : '示范更新态：隐藏旧图';
  });
}
function render(scroll = true) {
  const route = location.hash.slice(1).split('?')[0] || 'home';
  if (route === 'results') results();
  else if (route === 'pending-results') {
    location.replace('#results?q=%E5%8F%91%E7%83%A7%E8%A6%81%E6%8D%82%E6%B1%97');
    return;
  } else if (route === 'evidence') evidence();
  else if (route === 'pending') pendingDetail();
  else if (route === 'export' || route === 'updating') exportPage(false, route === 'updating');
  else if (route === 'thanks' || route === 'thanks-updating') exportPage(true, route === 'thanks-updating');
  else if (route === 'thanks-compare') thanksComparison();
  else home();
  document.documentElement.dataset.route = route;
  bind();
  if (scroll) scrollTo(0, 0);
}
window.addEventListener('hashchange', () => render());
render();
