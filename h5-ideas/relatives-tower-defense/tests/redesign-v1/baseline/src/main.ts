import './style.css';
import { cardIcon, coatOf, emptySeat, openingSign, person, svg, table, toolIcon, type Seated } from './art';
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
const AUTO_MS = 5000;
let auto: { key: number; deadline: number; timer: number } | null = null;
let autoStopped = -1;
const autoKey = (g: Game) => games * 100 + g.resolved;
function autoLeft(g: Game): number | null {
  return auto && auto.key === autoKey(g) ? Math.max(0, auto.deadline - Date.now()) : null;
}
function clearAuto(): void {
  if (auto) clearInterval(auto.timer);
  auto = null;
}
function paintAuto(): void {
  const button = app.querySelector<HTMLElement>('.auto-next');
  if (!button || !game) return;
  const left = autoLeft(game);
  button.querySelector('.auto-count')!.textContent = left === null ? '↗' : `${Math.ceil(left / 1000)} 秒后自动`;
  button.querySelector<HTMLElement>('.auto-bar')!.style.setProperty('--auto-left', String(left === null ? 0 : left / AUTO_MS));
}
function stopAuto(): void {
  if (!auto) return;
  autoStopped = auto.key;
  clearAuto();
  paintAuto();
}
function tickAuto(): void {
  if (!auto) return;
  if (Date.now() < auto.deadline) { paintAuto(); return; }
  clearAuto();
  goNext();
}
function syncAuto(): void {
  const g = game;
  if (!g || screen !== 'game' || g.phase !== 'feedback' || g.mood === 0 || g.resolved === TOTAL_TURNS) { clearAuto(); return; }
  if (menu || document.hidden) { stopAuto(); return; }
  const key = autoKey(g);
  if (autoStopped === key || auto?.key === key) return;
  clearAuto();
  auto = { key, deadline: Date.now() + AUTO_MS, timer: window.setInterval(tickAuto, 200) };
}
function goNext(): void {
  if (!game?.next()) return;
  if (game.phase === 'finished') { screen = 'result'; audio.play('end'); render('#result-heading'); window.scrollTo(0, 0); }
  else render('#question-heading', true);
}

function soundButton(): string {
  return `<button class="tool" data-action="sound" aria-pressed="${!audio.muted}" aria-label="${audio.muted ? '开启音效' : '关闭音效'}">${toolIcon(audio.muted ? 'mute' : 'sound')}</button>`;
}
function hearts(mood: number): string {
  return `<span class="hearts" aria-hidden="true">${Array.from({ length: MAX_MOOD }, (_, i) => `<i class="${i < mood ? 'filled' : ''}"></i>`).join('')}</span>`;
}
function home(): string {
  return `<main class="home-page"><section class="home-scene" aria-label="奶奶和大姨在饭桌对面，给你留了一个座"><h1 class="home-title">过年亲戚防御塔</h1><div class="opening-sign" aria-label="开席">${svg(openingSign())}</div><p class="welcome">来，给你留了个座。</p><div class="home-people"><div class="home-person">${svg(person('nainai', { gesture: 'hold', gaze: 'you', face: 'smile' }))}</div><div class="home-person">${svg(person('dayi', { gesture: 'ask', gaze: 'you', face: 'ask' }), true)}</div></div><div class="home-table">${svg(table())}</div><div class="empty-seat">${svg(emptySeat())}</div></section><section class="opening-goal" aria-labelledby="goal-heading"><span class="little-label">这桌的目标</span><h2 id="goal-heading">接完八次问话，<br>心态还剩一格就赢。</h2><span class="little-label how-label">每一问都这么算</span><ol class="how-math"><li><small>亲戚发问</small><b>压力 2</b><span>每问 1–6 点</span></li><li><small>你出一张牌</small><b>太极挡 1</b><span>换牌挡更多</span></li><li class="cost"><small>没挡住的</small><b>心态 −1</b><span>1 点扣 1 格</span></li></ol><p>不计时，一问出一张牌。太极随便用，别的牌有限，每两问补一份。</p></section><section class="place-card" aria-label="你的座位"><div class="place-heading"><b>你这次是什么身份？</b><span>问话跟着变</span></div><div class="identity-options" role="radiogroup" aria-label="选择身份">${identities.map(item => `<button role="radio" data-identity="${item.id}" aria-checked="${selected === item.id}" tabindex="${selected === item.id ? 0 : -1}"><b>${item.name}</b><small>${item.note}</small></button>`).join('')}</div></section><div class="entry-actions"><button class="primary" data-action="start">坐下开席 <span aria-hidden="true">↗</span></button><div class="entry-note"><span>6 格心态入席 · 四种牌进席再细看</span><button class="link" data-action="menu">看玩法</button></div></div></main>`;
}
function carryLine(carry: Carry | null, first = false): string {
  if (!carry) return `<span class="context-label">不用抢答</span><p>${first ? '第一问压力小，太极能接住。也可以试别的。' : '每问只选一句。先看心态代价，再挑你想说的话。'}</p>`;
  return carry.kind === 'ally'
    ? `<span class="context-label">${nameOf(carry.asker)}兑现帮腔 · 压力 −1</span><p>「${esc(relatives[carry.asker].line)}」</p>`
    : `<span class="context-label">上一问的反问有了后续 · 压力 +1</span><p>${nameOf(carry.asker)}插话：「等一下，这还没说清呢。」</p>`;
}
const futureLabels = ['压力不变', '追问 · 压力 +1', '帮腔 · 压力 −1', '八问接完', '心态归零 · 本局结束', '无法出牌'];
function futureLabel(g: Game, next: Carry | null, loss: number): string {
  if (loss >= g.mood) return futureLabels[4];
  if (g.index === TOTAL_TURNS - 1) return futureLabels[3];
  if (!next) return futureLabels[0];
  return next.kind === 'followup' ? futureLabels[1] : futureLabels[2];
}
function dinnerScene(g: Game): string {
  const q = g.target;
  const answered = g.phase !== 'question';
  const left: Seated = q.asker === 'table' ? 'erjiu' : q.asker;
  const right: Seated = q.incoming?.kind === 'ally' && q.incoming.asker !== 'table' && q.incoming.asker !== left ? q.incoming.asker : 'nainai';
  const crew: Seated[] = q.asker === 'table' ? ['sangu', 'erjiu', 'dayi'] : [left, right];
  return `<section class="dinner-scene${q.asker === 'table' ? ' whole-table' : ''}" aria-label="${q.asker === 'table' ? '全桌一起看着你' : `${nameOf(q.asker)}在饭桌对面`}"><div class="dinner-cast">${crew.map((who, i) => {
    const speaking = q.asker === 'table' || i === 0;
    return `<div class="dinner-person${speaking ? ' speaking' : ''}" style="--speaker-coat:${coatOf(who)}">${svg(person(who, { gesture: answered ? g.lastResult?.card === 'counter' && i === 0 ? 'cross' : 'reply' : speaking ? 'ask' : q.incoming?.kind === 'ally' ? 'cheer' : 'hold', gaze: 'you', face: answered ? 'smile' : speaking ? 'ask' : 'smile' }), i === crew.length - 1)}<span class="seat-name">${nameOf(who)}${speaking && q.asker !== 'table' ? `<i aria-hidden="true">${answered ? '接话' : '正在问'}</i>` : ''}</span>${speaking ? '<span class="voice-marks" aria-hidden="true">〃</span>' : ''}</div>`;
  }).join('')}</div><div class="dinner-table">${svg(table())}</div></section>`;
}
function questionContent(g: Game): string {
  const q = g.target;
  const kind = ['tough', 'boss'].includes(q.question.kind) ? '直球盘问' : '普通问话';
  return `<article class="question-sheet${q.asker === 'table' ? ' whole-table' : ''}" style="--speaker-coat:${q.asker === 'table' ? 'var(--red)' : coatOf(q.asker)}"><div class="question-byline"><div class="speaker-credit"><strong>${nameOf(q.asker)}</strong><small>问起${esc(q.question.category)}</small></div><b class="question-kind${q.basePressure >= 5 ? ' intense' : ''}">${kind}</b></div><h2 class="question-copy" id="question-heading" tabindex="-1">「${esc(q.question.text)}」</h2><div class="pressure-line"><b>这问压力 <strong>${q.pressure}</strong></b><span>基础 ${q.basePressure}${q.incoming ? ` ${q.incoming.kind === 'ally' ? '−' : '+'} 1` : ''}</span></div></article><aside class="carry-note ${q.incoming?.kind ?? ''}">${carryLine(q.incoming, g.index === 0)}</aside><section class="answer-previews" aria-label="选一句回答"><h3 class="section-label">你回哪一句？ <small>点卡片就出牌 · 不计时</small></h3><div class="quote-grid">${cards.map(card => {
    const p = g.preview(card);
    const out = g.charges[card] === 0;
    const tone = out ? 'spent' : p.loss >= g.mood ? 'fatal' : p.loss ? 'hurt' : 'safe';
    const cost = out ? '已用完' : p.loss ? `心态 −${p.loss}` : '不扣心态';
    const stock = card === 'taiji'
      ? '<span class="stock-value unlimited">不限次</span><small>不消耗牌</small>'
      : `<span class="stock-value"><small>余</small><strong>${g.charges[card]}</strong><small>张</small></span>${out ? '<small>等待补牌</small>' : ''}`;
    const detail = out ? '补到牌后才能选' : `${card === 'crazy' ? '全挡自耗' : `挡 ${p.blocked} 点`} · 余 ${Math.max(0, g.mood - p.loss)} 格`;
    const nextTone = out ? '' : tone === 'fatal' ? 'fatal' : g.index === TOTAL_TURNS - 1 ? '' : p.next?.kind ?? '';
    return `<button class="quote-card ${card}" data-card="${card}"${p.available ? '' : ' disabled'}><span class="quote-top"><span class="quote-name"><span class="card-icon">${svg(cardIcon(card))}</span><b>${cardNames[card]}</b></span><span class="card-stock" aria-label="${card === 'taiji' ? '不限次数，不消耗牌' : `剩余 ${g.charges[card]} 张${out ? '，等待补牌' : ''}`}">${stock}</span></span><span class="preview-quote">「${esc(q.question.answers[card])}」</span><span class="preview-effect"><span class="preview-cost"><span class="effect-label">这问</span><b class="${tone}">${cost}</b></span><small class="preview-detail">${detail}</small><span class="preview-next ${nextTone}"><span class="effect-label">${out ? '状态' : tone === 'fatal' || g.index === TOTAL_TURNS - 1 ? '之后' : '下问'}</span><b>${out ? futureLabels[5] : futureLabel(g, p.next, p.loss)}</b></span></span></button>`;
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
  const next = g.phase === 'reward' ? `<aside class="meal-preview"><span class="little-label">${waveNames[g.wave]}，吃完两问了</span><h3>选一份补给，再上${waveNames[g.wave + 1]}。</h3><p>${nextMealHint(g)}</p></aside>` : '';
  return `<article class="resolution"><span class="little-label">第 ${r.turn} 问 · ${nameOf(r.asker)}的${esc(r.question.category)}问题</span><h2 id="feedback-heading" tabindex="-1">${headline}</h2><p class="settled-math">压力 ${r.pressure} · 挡住 ${r.blocked}${r.card === 'crazy' ? ' · 自耗 1 格' : ''}<strong>心态 ${r.moodBefore} → ${r.moodAfter}</strong></p><div class="spoken-panel"><span>你 · ${cardNames[r.card]}${r.card === 'taiji' ? '，不花牌' : '，用掉 1 张'}</span><blockquote class="spoken-copy">「${esc(r.quote)}」</blockquote></div><div class="relative-panel"><b>${nameOf(r.asker)}接话</b><p>${esc(r.reply)}</p></div><p class="next-effect ${r.next?.kind ?? ''}">${consequence(r)}</p></article>${next}`;
}
function hand(g: Game): string {
  if (g.phase === 'question') return `<footer class="action-panel question-panel"><p class="sound-notice" role="status">${esc(soundNotice)}</p></footer>`;
  if (g.phase === 'feedback') return `<footer class="action-panel">${continueSlot(g)}<p class="sound-notice" role="status">${esc(soundNotice)}</p></footer>`;
  const hint = '选一份，再上菜';
  let buttons = '';
  if (g.phase === 'reward') buttons = `<div class="action-grid reward-grid">${(['soup', 'counter', 'sincere', 'crazy'] as Reward[]).map(choice => `<button class="reward-card ${choice}" data-reward="${choice}"${g.canReward(choice) ? '' : ' disabled'}><b>${choice === 'soup' ? '喝口热汤' : `补张${cardNames[choice]}`}</b><span class="loss">${choice === 'soup' ? g.mood === MAX_MOOD ? '心态已满' : '心态 +1 格' : g.charges[choice] >= 3 ? '已满 3 张' : `${cardNames[choice]} +1 张`}</span><small class="future">${choice === 'soup' ? '留牌给后面' : `现有 ${g.charges[choice]} 张`}</small></button>`).join('')}</div>`;
  return `<footer class="action-panel"><p class="action-hint">${hint}</p>${buttons}<p class="sound-notice" role="status">${esc(soundNotice)}</p></footer>`;
}
function continueSlot(g: Game): string {
  if (g.mood === 0) return `<div class="continue-slot"><p><b>心态用完了，这局先收席</b><span>不是对家人的评判。回看一下，是哪一句开始吃力。</span></p><button class="primary" data-action="next">回看这一局 <span aria-hidden="true">↗</span></button></div>`;
  if (g.resolved === TOTAL_TURNS) return `<div class="continue-slot"><p><b>八问全接完 · 心态还剩 ${g.mood} 格</b><span>这一桌，你撑下来了。</span></p><button class="primary" data-action="next">看看这一桌 <span aria-hidden="true">↗</span></button></div>`;
  const base = g.mealPressures(g.wave)[1];
  const carry = g.lastResult!.next;
  const pressure = Math.max(0, base + (carry ? carry.kind === 'ally' ? -1 : 1 : 0));
  const left = autoLeft(g);
  return `<div class="continue-slot"><p><b>下一问 · 压力 ${pressure}</b><span>${base >= 5 ? '直球盘问' : '普通问话'}${carry ? ` · ${nameOf(carry.asker)}${carry.kind === 'ally' ? '帮腔 −1' : '追问 +1'}` : ''}</span></p><button class="primary auto-next" data-action="next" aria-label="接第 ${g.index + 2} 问"><span>接第 ${g.index + 2} 问</span><span class="auto-count" aria-hidden="true">${left === null ? '↗' : `${Math.ceil(left / 1000)} 秒后自动`}</span><i class="auto-bar" aria-hidden="true" style="--auto-left:${left === null ? 0 : left / AUTO_MS}"></i></button></div>`;
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
  const how = app.querySelector<HTMLElement>('.how-math');
  if (how) {
    how.classList.remove('stacked');
    how.classList.toggle('stacked', [...how.querySelectorAll('b')].some(value => value.scrollWidth > value.clientWidth));
  }
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
  const stackedCards = width < 320 && fontSize > 21;
  frame.classList.toggle('stacked-cards', stackedCards);
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
  const columns = fontSize > 24 || stackedCards ? 1 : innerWidth >= 650 ? 4 : 2;
  const cardWidth = (width - (columns - 1) * 8) / columns - 21;
  app.style.setProperty('--byline-h', `${measure('measure-byline', Object.values(relatives).map(r => r.name), width - 78 - fontSize * 11 / 18 * 4)}px`);
  app.style.setProperty('--context-label-h', `${measure('measure-context-label', ['不用抢答', '上一问的反问有了后续 · 压力 +1', ...Object.values(relatives).map(r => `${r.name}兑现帮腔 · 压力 −1`)], width - 40)}px`);
  app.style.setProperty('--question-h', `${measure('measure-question', questions.map(q => `「${q.text}」`), width - 36)}px`);
  app.style.setProperty('--quote-h', `${measure('measure-quote', questions.flatMap(q => Object.values(q.answers).map(text => `「${text}」`)), cardWidth)}px`);
  const losses = Array.from({ length: MAX_MOOD }, (_, i) => `心态 −${i + 1}`);
  const labelWidth = 24 * Number(getComputedStyle(document.documentElement).getPropertyValue('--text-scale')) + 6;
  app.style.setProperty('--cost-h', `${measure('measure-cost', ['已用完', '不扣心态', ...losses], cardWidth - labelWidth)}px`);
  app.style.setProperty('--detail-h', `${measure('measure-detail', ['补到牌后才能选', ...Array.from({ length: MAX_MOOD + 1 }, (_, remaining) => ['全挡自耗', ...Array.from({ length: MAX_MOOD + 2 }, (_, blocked) => `挡 ${blocked} 点`)].map(block => `${block} · 余 ${remaining} 格`)).flat()], cardWidth)}px`);
  app.style.setProperty('--next-h', `${measure('measure-next', futureLabels, cardWidth - labelWidth)}px`);
  app.style.setProperty('--spoken-h', `${measure('measure-question', questions.flatMap(q => Object.values(q.answers).map(text => `「${text}」`)), width - 28)}px`);
  const full = [...Object.values(relatives).map(r => `「${r.line}」`), '每问只选一句。先看心态代价，再挑你想说的话。', '第一问压力小，太极能接住。也可以试别的。', ...Object.values(relatives).map(r => `${r.name}插话：「等一下，这还没说清呢。」`)];
  app.style.setProperty('--context-h', `${measure('measure-context', full, width - 40)}px`);
  meter.remove();
}
function render(focusTarget = '', resetReader = false): void {
  const oldReader = app.querySelector('.battle-reader')?.scrollTop ?? 0;
  const oldMenu = app.querySelector('.menu-box')?.scrollTop ?? 0;
  syncAuto();
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
    case 'next': clearAuto(); goNext(); break;
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
const interruptAuto = (event: Event) => { if (auto && (event.target as Element).closest?.('.battle-reader')) stopAuto(); };
for (const type of ['pointerdown', 'wheel', 'touchstart', 'keydown']) app.addEventListener(type, interruptAuto, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAuto(); });
new MutationObserver(() => { budgetKey = ''; fitLayout(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
void document.fonts.ready.then(() => { budgetKey = ''; fitLayout(); });
render();
