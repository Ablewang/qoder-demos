import './style.css';
import { cardIcon, emptySeat, openingSign, person, svg, table, toolIcon, type Seated } from './art';
import { cards, cardNames, identities, questions, relatives, waveNames, type Card, type Identity, type Relative } from './content';
import { Game, MAX_MOOD, TOTAL_TURNS, type Carry, type Report, type Reward, type TurnResult } from './engine';
import { AudioPlayer } from './audio';
import { createPoster } from './poster';

type Screen = 'home' | 'game' | 'result' | 'poster';
const app = document.querySelector<HTMLDivElement>('#app')!;
const audio = new AudioPlayer();
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed'));
const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const nameOf = (who: Relative) => relatives[who].name;
const identityName = (id: Identity) => identities.find(item => item.id === id)!.name;
function nextMealHint(g: Game): string {
  const pressures = g.mealPressures(g.wave + 1);
  return `下一道两问，基础压力 ${pressures.join(' / ')}。${pressures.includes(6) ? '最后全桌齐问有 6 点压力。发疯全挡耗 1 格，记得留一张。' : pressures.includes(5) ? `有 ${pressures.filter(value => value === 5).length} 问 5 点直球，真心只能挡 1 点。发疯能全挡，看看要不要补一张。` : '都是普通问，真心能挡 2 点，还能留帮腔。发疯可以留给后面的直球。'}`;
}
const rules: Record<Card, string> = {
  taiji: '挡 1 点，不花牌。没挡住的压力，每点扣一格心态。',
  counter: '挡 3 点，花 1 张。下一问会有这位亲戚插话，压力 +1。',
  crazy: '挡住全部压力，花 1 张，也耗 1 格心态。不赌运气。',
  sincere: '普通问挡 2 点，直球和压轴挡 1 点。花 1 张，亲戚在下一问帮腔，压力 −1。',
};
let selected: Identity = 'single';
let game: Game | null = null;
let screen: Screen = 'home';
let menu = false;
let games = 0;
let poster: ReturnType<typeof createPoster> | null = null;
let posterError = '';
let generating = false;
let soundNotice = '';
let budgetKey = '';

function soundButton(): string {
  return `<button class="tool" data-action="sound" aria-pressed="${!audio.muted}" aria-label="${audio.muted ? '开启音效' : '关闭音效'}">${toolIcon(audio.muted ? 'mute' : 'sound')}</button>`;
}
function hearts(mood: number): string {
  return `<span class="hearts" aria-hidden="true">${Array.from({ length: MAX_MOOD }, (_, i) => `<i class="${i < mood ? 'filled' : ''}"></i>`).join('')}</span>`;
}
function home(): string {
  return `<main class="home-page"><section class="home-scene" aria-label="奶奶和大姨在饭桌对面，给你留了一个座"><h1 class="home-title">过年亲戚防御塔</h1><div class="opening-sign" aria-label="开席">${svg(openingSign())}</div><p class="welcome">来，给你留了个座。</p><div class="home-people"><div class="home-person">${svg(person('nainai', { gesture: 'hold', gaze: 'you', face: 'smile' }))}</div><div class="home-person">${svg(person('dayi', { gesture: 'ask', gaze: 'you', face: 'ask' }), true)}</div></div><div class="home-table">${svg(table())}</div><div class="empty-seat">${svg(emptySeat())}</div></section><section class="opening-goal"><span class="little-label">这桌的目标</span><h2>四道菜，八次问话。<br>散席还剩一格心态，就赢。</h2><p>一问选一句，不抢时间。亲戚记得你怎么答。</p></section><section class="place-card" aria-label="你的座位"><div class="place-heading"><b>你这次是什么身份？</b><span>问话跟着变</span></div><div class="identity-options" role="radiogroup" aria-label="选择身份">${identities.map(item => `<button role="radio" data-identity="${item.id}" aria-checked="${selected === item.id}" tabindex="${selected === item.id ? 0 : -1}"><b>${item.name}</b><small>${item.note}</small></button>`).join('')}</div></section><div class="entry-actions"><button class="primary" data-action="start">坐下开席 <span aria-hidden="true">↗</span></button><div class="entry-note"><span>6 格心态入席 · 有限牌别一次用光</span><button class="link" data-action="menu">看玩法</button></div></div></main>`;
}
function carryLine(carry: Carry | null, first = false): string {
  if (!carry) return `<span class="context-label">不用抢答</span><p>${first ? '第一问压力小，太极能接住。也可以试别的。' : '每问只选一句。先看心态代价，再挑你想说的话。'}</p>`;
  return carry.kind === 'ally'
    ? `<span class="context-label">${nameOf(carry.asker)}兑现帮腔 · 压力 −1</span><p>「${esc(relatives[carry.asker].line)}」</p>`
    : `<span class="context-label">上一问的反问有了后续 · 压力 +1</span><p>${nameOf(carry.asker)}插话：「等一下，这还没说清呢。」</p>`;
}
function futureLabel(card: Card, next: Carry | null, compact = false): string {
  if (card === 'taiji') return compact ? '不限次数' : '不花牌，不留后患';
  if (card === 'crazy') return compact ? '自耗 1 格' : '全挡，但耗 1 格力气';
  if (!next) return compact ? '最后一问' : '最后一问，不再留后续';
  return next.kind === 'followup' ? compact ? '追问 +1' : '下一问追问 +1' : compact ? '帮腔 −1' : '下一问帮腔 −1';
}
function dinnerScene(g: Game): string {
  const q = g.target;
  const answered = g.phase !== 'question';
  const left: Seated = q.asker === 'table' ? 'erjiu' : q.asker;
  const right: Seated = q.incoming?.kind === 'ally' && q.incoming.asker !== 'table' && q.incoming.asker !== left ? q.incoming.asker : 'nainai';
  const crew: Seated[] = q.asker === 'table' ? ['sangu', 'erjiu', 'dayi'] : [left, right];
  return `<section class="dinner-scene" aria-label="${q.asker === 'table' ? '全桌一起看着你' : `${nameOf(q.asker)}在饭桌对面`}"><div class="dinner-cast">${crew.map((who, i) => `<div class="dinner-person">${svg(person(who, { gesture: answered ? g.lastResult?.card === 'counter' && i === 0 ? 'cross' : 'reply' : i === 0 ? 'ask' : q.incoming?.kind === 'ally' ? 'cheer' : 'hold', gaze: 'you', face: answered ? 'smile' : i === 0 ? 'ask' : 'smile' }), i === crew.length - 1)}</div>`).join('')}</div><div class="dinner-table">${svg(table())}</div></section>`;
}
function questionContent(g: Game): string {
  const q = g.target;
  const kind = ['tough', 'boss'].includes(q.question.kind) ? '直球盘问' : '普通问话';
  return `<article class="question-sheet"><div class="question-byline"><span>${nameOf(q.asker)} · ${esc(q.question.category)}</span><b>${kind}</b></div><h2 class="question-copy" id="question-heading" tabindex="-1">「${esc(q.question.text)}」</h2><div class="pressure-line"><b>这问压力 ${q.pressure}</b><span>基础 ${q.basePressure}${q.incoming ? ` ${q.incoming.kind === 'ally' ? '−' : '+'} 1` : ''}</span></div><aside class="carry-note ${q.incoming?.kind ?? ''}">${carryLine(q.incoming, g.index === 0)}</aside></article><section class="answer-previews" aria-label="四句回答全文"><h3 class="section-label">你可以这样说 <small>下面出一张牌</small></h3><div class="quote-grid">${cards.map(card => {
    const p = g.preview(card);
    return `<article class="quote-card ${card}" data-answer="${card}"${g.charges[card] === 0 ? ' data-empty="true"' : ''}><div class="quote-top"><span class="card-icon">${svg(cardIcon(card))}</span><b>${cardNames[card]}</b><small>${card === 'taiji' ? '不限次' : `余 ${g.charges[card]} 张`}</small></div><p class="preview-quote" id="quote-${card}">「${esc(q.question.answers[card])}」</p><p class="preview-effect">${card === 'crazy' ? '全挡' : `挡 ${p.blocked} 点`} · ${futureLabel(card, p.next, true)}</p></article>`;
  }).join('')}</div></section>`;
}
function consequence(result: TurnResult, past = false, report?: Report): string {
  const next = result.next;
  if (!next) return result.turn === TOTAL_TURNS ? '这是最后一问，不再追加追问或帮腔。' : '这一句没有留下追问。';
  const applied = report?.history.find(turn => turn.turn === result.turn + 1 && turn.incoming?.kind === next.kind && turn.incoming.asker === next.asker);
  if (past && applied) return next.kind === 'ally'
    ? `第 ${applied.turn} 问，${nameOf(next.asker)}真的帮了腔：压力 ${applied.basePressure} → ${applied.pressure}。`
    : `第 ${applied.turn} 问，${nameOf(next.asker)}插话追问：压力 ${applied.basePressure} → ${applied.pressure}。`;
  return next.kind === 'ally'
    ? `${nameOf(next.asker)}站到你这边，下一问会帮你接话，压力 −1。${past ? '这局在兑现前离席了。' : ''}`
    : `${nameOf(next.asker)}还想接着问，下一问压力 +1。${past ? '这局没继续到那一问。' : ''}`;
}
function feedbackContent(g: Game): string {
  const r = g.lastResult!;
  const headline = r.moodAfter === 0 ? '力气用完了，先歇一歇。' : r.loss === 0 ? '这一问，稳稳接住。' : r.card === 'crazy' ? '话头止住了，耗一格力气。' : `接过去了，心态少了 ${r.loss} 格。`;
  const next = g.phase === 'reward' ? `<aside class="meal-preview"><span class="little-label">${waveNames[g.wave]}，吃完两问了</span><h3>选一份补给，再上${waveNames[g.wave + 1]}。</h3><p>${nextMealHint(g)}</p></aside>` : `<aside class="meal-preview"><span class="little-label">下一步</span><p>${r.moodAfter === 0 ? '心态为零，这局先收席。可以回看是哪句开始吃力，再试一桌。' : r.turn === TOTAL_TURNS ? '八问全接完了，而且还剩心态。去看看你怎么撑过这一桌。' : `还有 ${TOTAL_TURNS - r.turn} 问。接下一问时，刚才的追问或帮腔就会兑现。`}</p></aside>`;
  return `<article class="resolution"><span class="little-label">第 ${r.turn} 问 · ${nameOf(r.asker)}的${esc(r.question.category)}问题</span><h2 id="feedback-heading" tabindex="-1">${headline}</h2><p class="settled-math">压力 ${r.pressure} · 挡住 ${r.blocked}${r.card === 'crazy' ? ' · 自耗 1 格' : ''}<strong>心态 ${r.moodBefore} → ${r.moodAfter}</strong></p><div class="spoken-panel"><span>你 · ${cardNames[r.card]}${r.card === 'taiji' ? '，不花牌' : '，用掉 1 张'}</span><blockquote class="spoken-copy">「${esc(r.quote)}」</blockquote></div><div class="relative-panel"><b>${nameOf(r.asker)}接话</b><p>${esc(r.reply)}</p></div><p class="next-effect ${r.next?.kind ?? ''}">${consequence(r)}</p></article>${next}`;
}
function hand(g: Game): string {
  const hint = g.phase === 'question' ? '选一句就出牌 · 不计时' : g.phase === 'reward' ? '选一份，再上菜' : '这一问已结，下一步在这里';
  let buttons = '';
  if (g.phase === 'question') buttons = `<div class="action-grid">${cards.map(card => {
    const p = g.preview(card);
    const accessible = `${cardNames[card]}，${p.loss ? `心态扣${p.loss}格` : '心态不扣'}，${card === 'taiji' ? '不限次数' : `花1张，剩${g.charges[card]}张`}，${futureLabel(card, p.next)}`;
    return `<button class="play-card ${card}" data-card="${card}" aria-label="${accessible}" aria-describedby="quote-${card}"${p.available ? '' : ' disabled'}><b>${cardNames[card]}<small>${card === 'taiji' ? '∞' : `余${g.charges[card]}`}</small></b><span class="loss">${g.charges[card] === 0 ? '已用完' : p.loss >= g.mood ? '会收席' : p.loss ? `心态 −${p.loss}` : '心态不扣'}</span><small class="future">${futureLabel(card, p.next, true)}</small></button>`;
  }).join('')}</div>`;
  else if (g.phase === 'reward') buttons = `<div class="action-grid reward-grid">${(['soup', 'counter', 'sincere', 'crazy'] as Reward[]).map(choice => `<button class="reward-card ${choice}" data-reward="${choice}"${g.canReward(choice) ? '' : ' disabled'}><b>${choice === 'soup' ? '喝口热汤' : `补张${cardNames[choice]}`}</b><span class="loss">${choice === 'soup' ? g.mood === MAX_MOOD ? '心态已满' : '心态 +1 格' : g.charges[choice] >= 3 ? '已满 3 张' : `${cardNames[choice]} +1 张`}</span><small class="future">${choice === 'soup' ? '留牌给后面' : `现有 ${g.charges[choice]} 张`}</small></button>`).join('')}</div>`;
  else buttons = `<div class="continue-slot"><p>${g.mood === 0 ? '不是对家人的评判，只是这局的心态用完了。' : g.index === TOTAL_TURNS - 1 ? `${TOTAL_TURNS} / ${TOTAL_TURNS} 问完成 · 心态还剩 ${g.mood} 格` : `${nameOf(g.lastResult!.asker)}的这句接完了。没有自动冒出来的新问题。`}</p><button class="primary" data-action="next">${g.mood === 0 ? '先收席，回看这局' : g.index === TOTAL_TURNS - 1 ? '吃完了，看看这一桌' : `接第 ${g.index + 2} 问`} <span aria-hidden="true">↗</span></button></div>`;
  return `<footer class="action-panel"><p class="action-hint">${hint}</p>${buttons}<p class="sound-notice" role="status">${esc(soundNotice)}</p></footer>`;
}
function playing(): string {
  const g = game!;
  return `<main class="battle-page" data-phase="${g.phase}" data-turn="${g.index + 1}"><header class="game-header"><div class="battle-top"><div class="dish-title"><b><span class="course-number">${String(g.wave + 1).padStart(2, '0')} / </span>${waveNames[g.wave]}</b><small>第 ${g.index + 1} / ${TOTAL_TURNS} 问<span class="identity-tag"> · ${esc(identityName(g.identity))}</span></small></div><div class="tools">${soundButton()}<button class="tool menu-tool" data-action="menu" aria-label="饭桌菜单">玩法</button></div></div><div class="goal-rail"><span class="live-goal">8 问后 ≥1 格就赢</span><span class="mood" aria-label="心态剩余${g.mood}格，共6格"><small>心态</small>${hearts(g.mood)}<b>${g.mood}<small>/6</small></b></span></div></header><div class="battle-reader" tabindex="0" aria-label="问话、四句回答全文和亲戚反应">${dinnerScene(g)}${g.phase === 'question' ? questionContent(g) : feedbackContent(g)}</div>${hand(g)}</main>`;
}
function memoryPanel(turn: TurnResult, report: Report): string {
  return `<article class="memory-panel"><div class="memory-top"><span class="turn-stamp">第 ${turn.turn} 问</span><b>${nameOf(turn.asker)} · ${esc(turn.question.category)}</b><span>心态 ${turn.moodBefore} → ${turn.moodAfter}</span></div><p class="memory-question">「${esc(turn.question.text)}」</p><blockquote>你用${cardNames[turn.card]}：「${esc(turn.quote)}」</blockquote>${turn.incoming ? `<p class="memory-carry">${turn.incoming.kind === 'ally' ? `${nameOf(turn.incoming.asker)}帮腔：「${esc(relatives[turn.incoming.asker].line)}」` : `${nameOf(turn.incoming.asker)}把上一问的追问带了过来。`}</p>` : ''}<p class="memory-consequence">${consequence(turn, true, report)}</p></article>`;
}
function result(report: Report): string {
  const suggestion = !report.won ? '下一桌，普通问用真心，留张发疯接直球试试。' : report.counters > report.sincere ? '下一桌试试真心留帮腔，看看能不能多剩一格。' : '下一桌试试反问扛压，或换个身份听听不同的问题。';
  return `<main class="result-page"><header class="result-head"><span>${esc(identityName(report.identity))} · 这一桌回放</span>${soundButton()}</header><p class="little-label">${esc(report.reason)}</p><h1 tabindex="-1" id="result-heading">${esc(report.title)}</h1><div class="finish-scene">${svg(person('nainai', { gesture: 'hold', gaze: 'you', face: 'smile' }))}<div>${hearts(report.mood)}<strong>${report.turns} / 8 问 · 剩 ${report.mood} 格心态</strong><p>${report.won ? '饭吃完了，自己的边界也留住了。' : '没吃完也能重来。先看看哪一步开始吃力。'}</p></div></div><h2 class="section-label">这桌记住了什么</h2><div class="memories">${report.highlights.length ? report.highlights.map(turn => memoryPanel(turn, report)).join('') : '<p>这局还没出牌。下次慢慢读题，选一句适合自己的回答。</p>'}</div>${report.history.length ? `<details class="full-replay"><summary>回看全部 ${report.turns} 次回答</summary>${report.history.map(turn => memoryPanel(turn, report)).join('')}</details>` : ''}<div class="replay-invitation"><span class="little-label">下次可以换个走法</span><p>${suggestion}</p></div><div class="export-feedback"${posterError ? ' role="alert" tabindex="-1"' : ' aria-hidden="true"'}>${posterError ? `<p>${esc(posterError)}</p><button class="link" data-action="poster">重试生成</button>` : ''}</div><div class="result-actions"><button class="primary" data-action="restart">同身份再吃一桌 <span aria-hidden="true">↗</span></button><button class="secondary" data-action="home">换个身份入席</button><button class="secondary" data-action="poster"${generating ? ' disabled' : ''}>${generating ? '正在画这一桌…' : '把这桌存成回放图'}</button><p class="privacy-note">只在本地玩、生成图片。不上传，没有排行榜。</p></div></main>`;
}
function posterPage(): string {
  return `<main class="poster-page"><header class="result-head"><span>这一桌已画好</span><span>1080 × 1440 · PNG</span></header><img class="poster-image" src="${poster!.dataUrl}" alt="本局回放：${esc(game!.report!.title)}，完成${game!.report!.turns}问，心态剩${game!.report!.mood}格" width="1080" height="1440"><p>手机长按图片保存，电脑点下载。图片只在本地生成。</p><a class="primary" href="${poster!.dataUrl}" download="${poster!.fileName}">下载 PNG 回放图 <span aria-hidden="true">↓</span></a><button class="secondary" data-action="back">回到这局回放</button></main>`;
}
function menuMarkup(): string {
  return `<div class="menu-layer"><section class="menu-box" role="dialog" aria-modal="true" aria-labelledby="menu-title"><p class="little-label">不用暂停，本来就不计时</p><h2 id="menu-title">这一桌怎么吃</h2><p><b>四道菜，八次问话。最后还剩一格就赢。</b><br>一问只出一张牌。未挡住的压力扣心态，归零就收席。</p><ul class="rules">${cards.map(card => `<li><span class="card-icon">${svg(cardIcon(card))}</span><div><b>${cardNames[card]}</b><p>${rules[card]}</p></div></li>`).join('')}</ul><p>初始反问 2 张、真心 2 张、发疯 1 张。每吃完两问，只选一份补给：心态 +1 或补一张牌（最多 3 张）。最后一问没有未来追问或帮腔。</p><p class="privacy-note">防的是盘问，不是亲情。没有标准台词，也不评价真实家人。</p><button class="primary" data-action="close-menu">${screen === 'home' ? '知道了，去选座位' : '回桌继续'}</button>${screen === 'game' ? '<div class="menu-row"><button class="secondary" data-action="restart">同身份重开</button><button class="secondary" data-action="leave">主动离席</button></div>' : ''}</section></div>`;
}
function focus(selector: string): void {
  app.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
}
function fitLayout(): void {
  app.dataset.largeText = String(Number(getComputedStyle(document.documentElement).getPropertyValue('--text-scale')) > 4 / 3);
  if (screen !== 'game') return;
  const frame = app.querySelector<HTMLElement>('.battle-page')!;
  const question = frame.querySelector<HTMLElement>('.question-copy') ?? frame.querySelector<HTMLElement>('.spoken-copy');
  const fontSize = parseFloat(getComputedStyle(question!).fontSize);
  frame.classList.toggle('compact', innerHeight <= 650 || fontSize > 24);
  const source = question!;
  const style = getComputedStyle(source);
  frame.dataset.largeText = String(fontSize > 24);
  const reader = frame.querySelector<HTMLElement>('.battle-reader')!;
  const readerStyle = getComputedStyle(reader);
  const width = reader.clientWidth - parseFloat(readerStyle.paddingLeft) - parseFloat(readerStyle.paddingRight);
  const key = JSON.stringify([width, innerHeight, style.font, style.lineHeight]);
  if (key === budgetKey) return;
  budgetKey = key;
  const meter = document.createElement('div');
  meter.setAttribute('aria-hidden', 'true');
  meter.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;overflow-wrap:anywhere';
  document.body.append(meter);
  const measure = (className: string, texts: string[], textWidth: number): number => {
    meter.className = className;
    meter.style.width = `${Math.max(40, textWidth)}px`;
    let height = 0;
    for (const text of texts) { meter.textContent = text; height = Math.max(height, meter.getBoundingClientRect().height); }
    return Math.ceil(height + 2);
  };
  const columns = innerWidth >= 650 ? 4 : 2;
  app.style.setProperty('--byline-h', `${measure('measure-byline', questions.flatMap(q => q.askers.map(who => `${nameOf(who)} · ${q.category}`)), width - 28 - 8 - fontSize * 11 / 18 * 4)}px`);
  app.style.setProperty('--context-label-h', `${measure('measure-context-label', ['不用抢答', '上一问的反问有了后续 · 压力 +1', ...Object.values(relatives).map(r => `${r.name}兑现帮腔 · 压力 −1`)], width - 40)}px`);
  app.style.setProperty('--question-h', `${measure('measure-question', questions.map(q => `「${q.text}」`), width - 28)}px`);
  app.style.setProperty('--quote-h', `${measure('measure-quote', questions.flatMap(q => Object.values(q.answers).map(text => `「${text}」`)), (width - (columns - 1) * 8) / columns - 20)}px`);
  app.style.setProperty('--spoken-h', `${measure('measure-question', questions.flatMap(q => Object.values(q.answers).map(text => `「${text}」`)), width - 28)}px`);
  const full = [...Object.values(relatives).map(r => `「${r.line}」`), '每问只选一句。先看心态代价，再挑你想说的话。', '第一问压力小，太极能接住。也可以试别的。', ...Object.values(relatives).map(r => `${r.name}插话：「等一下，这还没说清呢。」`)];
  app.style.setProperty('--context-h', `${measure('measure-context', full, width - 40)}px`);
  meter.remove();
}
function render(focusTarget = '', resetReader = false): void {
  const oldReader = app.querySelector('.battle-reader')?.scrollTop ?? 0;
  const oldMenu = app.querySelector('.menu-box')?.scrollTop ?? 0;
  app.innerHTML = screen === 'home' ? home() : screen === 'game' ? playing() : screen === 'result' ? result(game!.report!) : posterPage();
  if (menu) {
    app.firstElementChild?.setAttribute('inert', '');
    app.firstElementChild?.setAttribute('aria-hidden', 'true');
    app.insertAdjacentHTML('beforeend', menuMarkup());
  }
  fitLayout();
  if (screen === 'game') {
    const reader = app.querySelector<HTMLElement>('.battle-reader')!;
    reader.scrollTop = resetReader ? 0 : oldReader;
  }
  const box = app.querySelector<HTMLElement>('.menu-box');
  if (box) box.scrollTop = oldMenu;
  if (focusTarget) focus(focusTarget);
  if (screen === 'game' && resetReader && focusTarget) {
    const reader = app.querySelector<HTMLElement>('.battle-reader')!;
    const heading = reader.querySelector<HTMLElement>(focusTarget)!;
    const bounds = reader.getBoundingClientRect();
    const text = heading.getBoundingClientRect();
    if (text.bottom > bounds.bottom - 8) reader.scrollTop += Math.max(0, text.top - bounds.top - 4);
  }
}
function start(): void {
  game = new Game(selected, Number.isFinite(seed) && seed > 0 ? seed + games : Date.now());
  games++;
  if ((import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV && params.has('probe')) (window as unknown as { __rtdGame: Game }).__rtdGame = game;
  screen = 'game'; menu = false; poster = null; posterError = ''; soundNotice = ''; budgetKey = '';
  render('#question-heading', true);
  window.scrollTo(0, 0);
  void audio.resume().catch(() => { soundNotice = '音效暂不可用，仍可静音游玩。'; render('#question-heading'); });
}
async function makePoster(): Promise<void> {
  if (generating) return;
  generating = true; posterError = ''; poster = null;
  render();
  try {
    await document.fonts.ready;
    const report = game!.report!;
    const memory = report.highlights[report.highlights.length - 1] ?? report.history[report.history.length - 1];
    poster = createPoster(report, memory?.quote ?? report.quotes[0], { identity: identityName(report.identity), card: memory?.card, spoken: !!memory });
    screen = 'poster'; generating = false;
    render('.poster-page a'); window.scrollTo(0, 0);
  } catch {
    generating = false; posterError = '这次没画成，回放还在。可以重试生成图片。';
    render('.export-feedback');
  }
}
app.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLElement>('button, a[data-action]');
  if (!button || button.hasAttribute('disabled')) return;
  const identity = button.dataset.identity as Identity | undefined;
  if (identity) { selected = identity; render(`[data-identity="${identity}"]`); return; }
  const card = button.dataset.card as Card | undefined;
  if (card && game?.play(card)) {
    audio.play(card === 'sincere' ? 'sincere' : card === 'crazy' ? 'critical' : 'card');
    render('#feedback-heading', true);
    return;
  }
  const reward = button.dataset.reward as Reward | undefined;
  if (reward && game?.reward(reward)) { audio.play('reward'); render('#question-heading', true); return; }
  switch (button.dataset.action) {
    case 'start': case 'restart': start(); break;
    case 'menu': menu = true; render('[data-action="close-menu"]'); break;
    case 'close-menu': menu = false; render('[data-action="menu"]'); break;
    case 'sound': void audio.toggle().then(() => render('[data-action="sound"]')).catch(() => { soundNotice = '音效暂不可用，仍可静音游玩。'; render('[data-action="sound"]'); }); break;
    case 'next':
      if (!game?.next()) break;
      if (game.phase === 'finished') { screen = 'result'; audio.play('end'); render('#result-heading'); window.scrollTo(0, 0); }
      else render('#question-heading', true);
      break;
    case 'leave': game!.finish('主动离席，这局先收筷子'); menu = false; screen = 'result'; render('#result-heading'); window.scrollTo(0, 0); break;
    case 'home': screen = 'home'; menu = false; render('[data-action="start"]'); window.scrollTo(0, 0); break;
    case 'poster': void makePoster(); break;
    case 'back': screen = 'result'; render('[data-action="poster"]'); window.scrollTo(0, 0); break;
  }
});
app.addEventListener('keydown', event => {
  if (menu) {
    if (event.key === 'Escape') { event.preventDefault(); menu = false; render('[data-action="menu"]'); return; }
    if (event.key !== 'Tab') return;
    const items = [...app.querySelectorAll<HTMLElement>('.menu-box button:not([disabled]), .menu-box summary')];
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1]!.focus(); }
    else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
    return;
  }
  const current = (event.target as HTMLElement).dataset.identity;
  if (current && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const index = identities.findIndex(item => item.id === current);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? identities.length - 1 : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + identities.length) % identities.length;
    selected = identities[next].id; render(`[data-identity="${selected}"]`);
  }
});
window.addEventListener('resize', () => { budgetKey = ''; fitLayout(); });
new MutationObserver(() => { budgetKey = ''; fitLayout(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
void document.fonts.ready.then(() => { budgetKey = ''; fitLayout(); });
render();
