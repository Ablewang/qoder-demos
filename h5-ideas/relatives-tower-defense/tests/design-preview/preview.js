import { person, table, emptySeat, openingSign, cardIcon, speechOutline, toolIcon } from './art.js';

const root = document.querySelector('#preview');
const params = new URLSearchParams(location.search);
const view = ['home', 'single', 'double', 'report', 'long'].includes(params.get('view')) ? params.get('view') : 'home';
const questions = await fetch('../../src/content/questions.json').then(response => response.json());
const getQuestion = id => questions.find(question => question.id === id);
const esc = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const identities = { single: '未婚打工人', married: '已婚未育', graduate: '刚毕业', exam: '考研考公中' };
let identity = identities[params.get('identity')] ? params.get('identity') : 'single';
const cardNames = { taiji: '太极', counter: '反问', crazy: '发疯', sincere: '真心' };
const effects = { taiji: '1伤害 · 无限', counter: '3伤害 · 下问+1血', crazy: '随机 · 可能翻车', sincere: '化解 · 可以结盟' };
const cards = Object.keys(cardNames);
let selected = 'right';
let rightQuestion = getQuestion(view === 'long' ? 'followup-03' : 'income-04');
const leftQuestion = getQuestion('warm-03');
const label = number => `<div class="review-label"><span>静态设计评审 · 合成示例</span><span>${number} / 04 · 未接引擎</span></div>`;

function home() {
  root.innerHTML = `${label('01')}<main class="home-page"><section class="home-scene" aria-label="奶奶和大姨在饭桌旁给玩家留了一个空席"><h1 class="home-title">过年亲戚防御塔</h1><div class="opening-sign">${openingSign()}</div><p class="welcome">来，给你留了个座。</p><div class="home-people"><div class="home-person">${person('nainai')}<small>奶奶</small></div><div class="home-person">${person('dayi')}<small>大姨</small></div></div><div class="home-table">${table()}</div><div class="empty-seat">${emptySeat()}</div></section><section class="place-card" aria-label="玩家自己的身份席签"><div class="place-heading"><b>你的座位</b><span>选一个自己的身份</span></div><div class="identity-options">${Object.entries(identities).map(([id, name]) => `<button data-identity="${id}" aria-pressed="${id === identity}">${name}</button>`).join('')}</div></section><div class="entry-actions"><a class="start" href="?view=single&identity=${identity}"><span>坐下开席</span><span aria-hidden="true">↗</span></a><p class="entry-note"><span>一桌饭 · 四种回答</span><a href="#" data-rules>看玩法</a></p></div></main>`;
  root.querySelectorAll('[data-identity]').forEach(button => button.addEventListener('click', () => { identity = button.dataset.identity; home(); }));
  root.querySelector('[data-rules]').addEventListener('click', event => { event.preventDefault(); rules(); });
}

function questionMarkup(question, side) {
  const isWarm = question.kind === 'warm';
  const isFollowup = question.kind === 'followup';
  const name = side === 'left' ? '奶奶' : '大姨';
  return `<button class="question" data-question="${question.id}" data-seat="${side}" aria-pressed="${selected === side}">${speechOutline(view === 'single' ? 104 : 76)}<span class="question-name"><span>${name}</span><span class="target-mark">当前</span></span><strong class="question-text">${esc(question.text)}</strong><span class="question-meta"><span class="pips" aria-label="问题强度 ${isWarm || isFollowup ? 1 : 2}">${'<i></i>'.repeat(isWarm || isFollowup ? 1 : 2)}</span><span>${isWarm ? '暖心 · ' : ''}耐心 ${isWarm ? 24 : isFollowup ? 16 : 18} 秒</span></span><span class="patience" aria-hidden="true"><i></i></span></button>`;
}

function handMarkup(question) {
  return cards.map(card => `<button class="answer-card" data-card="${card}" aria-label="${cardNames[card]}卡：${esc(question.answers[card])}"><span class="card-top"><span class="card-icon">${cardIcon(card)}</span><b class="card-name">${cardNames[card]}</b><span class="charges">${card === 'taiji' ? '<b>∞</b>' : '余 <b>3</b>'}</span></span><span class="answer-text">${esc(question.answers[card])}</span><small class="card-effect">${effects[card]}</small></button>`).join('');
}

function battle() {
  const double = view !== 'single';
  const question = selected === 'left' ? leftQuestion : rightQuestion;
  root.innerHTML = `${label(double ? '03' : '02')}<main class="battle-page"><header class="battle-top"><div class="dish-title"><span>02 / 04</span>热菜上桌</div><div class="tools"><button class="tool" data-silent aria-label="静态示例：音效保持关闭">${toolIcon('mute')}</button><button class="tool" data-pause aria-label="暂停说明">${toolIcon('pause')}</button></div></header><section class="battle-scene" aria-label="两位有上半身与手势的亲戚坐在对面，玩家在近侧"><div class="wall-line"></div><div class="battle-table">${table()}</div><div class="cast"><div class="seat" data-person="left"><div class="person">${person('nainai')}</div><small class="seat-note" aria-live="polite">${double ? '奶奶刚才帮了 1 问' : '奶奶在给你夹菜'}</small></div><div class="seat" data-person="right"><div class="person">${person('dayi')}</div><small class="seat-note" aria-live="polite">大姨接着问你</small></div></div><div class="talks ${double ? '' : 'single'}">${double ? questionMarkup(leftQuestion, 'left') : ''}${questionMarkup(rightQuestion, 'right')}</div><div class="player-rail"><span class="player-label">你的席位<br>${identities[identity]}</span><span class="mood">心态<b>100</b></span></div></section><div class="read-row"><div class="reading-copy"><span class="reply-to">接${selected === 'left' ? '奶奶' : '大姨'}这句</span><span data-reading>读牌 8 秒 · 倒计时暂停</span></div><button data-read>读好了 ↗</button></div><section class="hand" aria-label="针对当前发问者的四张完整回答牌">${handMarkup(question)}</section><p class="battle-footnote">合成状态；点击仅演示接话，不计算出牌。</p></main>`;
  root.querySelectorAll('[data-seat]').forEach(button => button.addEventListener('click', () => { selected = button.dataset.seat; battle(); }));
  root.querySelectorAll('[data-card]').forEach(button => button.addEventListener('click', () => {
    root.querySelectorAll('[data-card]').forEach(card => card.removeAttribute('data-demo'));
    button.dataset.demo = 'played';
    root.querySelector(`[data-person="${selected}"] .seat-note`).textContent = `示例接话 · ${cardNames[button.dataset.card]}`;
    root.querySelector(`[data-person="${selected}"] .person`).innerHTML = person(selected === 'left' ? 'nainai' : 'dayi', 'reply');
  }));
  root.querySelector('[data-pause]').addEventListener('click', rules);
  root.querySelector('[data-silent]').addEventListener('click', () => modal('保持静音', '<p>这份静态稿不发实际音效，也没有运行中的游戏时钟。</p>'));
  root.querySelector('[data-read]').addEventListener('click', () => { root.querySelector('[data-reading]').textContent = '读好了 · 仅静态状态演示'; });
}

function modal(title, content) {
  const layer = document.createElement('div');
  layer.className = 'modal';
  layer.innerHTML = `<section class="modal-box" role="dialog" aria-modal="true" aria-label="${title}"><h2>${title}</h2>${content}<button>回到静态稿</button></section>`;
  document.body.append(layer);
  layer.querySelector('button').addEventListener('click', () => layer.remove());
}

function rules() {
  modal('四种回答，各有用处', '<p>太极：1伤害，无限使用；反问：3伤害，该亲戚下一问+1血。</p><p>发疯：可能暴击，也可能翻车；真心：化解关心，也能结盟。</p><p>真心不是讨好，坚定边界也能通关。新问有8秒免费读牌，正式游戏可随时暂停。</p><p>这是静态设计示例，未连接引擎、评分或计时。</p>');
}

function report() {
  document.body.classList.add('report-mode');
  root.innerHTML = `<div class="poster-wrap"><article class="report-poster" aria-label="静态战报示例，沿用已有1900分边界路线数据"><div class="poster-label"><span>静态设计评审 · 示例</span><span>2027 年夜饭</span></div><div class="poster-brand">过年亲戚防御塔 / 本局战报</div><h1 class="poster-title">边界守护者</h1><div class="poster-people"><div class="poster-person">${person('nainai')}</div><div class="poster-person">${person('dayi', 'reply')}</div></div><div class="poster-table">${table(true)}</div><div class="poster-speech"><small>这局我想说</small><p>想要合适的关系，也算合理要求吧？</p></div><div class="poster-action one">挡下<b>14</b>问</div><div class="poster-action two">反问挡下<b>3</b>次</div><div class="poster-card">${cardIcon('counter')}<span>反问</span></div><div class="poster-player">你的席位</div><div class="poster-results"><div class="poster-days"><b>7</b>天<small>今年过年能撑</small></div><div class="poster-score">1900 分<small>心态剩余 100</small></div><div class="poster-grade">上上签</div></div><footer class="poster-footer"><span>合成示例 · 本地未发布</span><span>无新增授予</span></footer></article></div>`;
  const resize = () => {
    const wrap = root.querySelector('.poster-wrap');
    const scale = wrap.clientWidth / 1080;
    root.querySelector('.report-poster').style.transform = `scale(${scale})`;
    wrap.style.height = `${1440 * scale}px`;
  };
  resize();
  addEventListener('resize', resize);
}

if (view === 'home') home();
else if (view === 'report') report();
else battle();

window.designPreview = {
  view, questions,
  textFixture(id) {
    rightQuestion = getQuestion(id);
    selected = 'right';
    battle();
  },
};
