import './style.css';
import { coatOf, emptySeat, openingSign, person, strategyIcon, svg, table, toolIcon, type Pose } from './art';
import { dinner, nameOf, nodeById, PILE_LIMIT, relatives, strategyNames, type Cast, type Speaker, type Strategy } from './content';
import { Game, names, type Option, type Report, type Turn } from './engine';
import { AudioPlayer } from './audio';
import { createPoster, endingLabels, posterCast } from './poster';

type Screen = 'home' | 'game' | 'result' | 'poster';
const app = document.querySelector<HTMLDivElement>('#app')!;
const audio = new AudioPlayer();
const params = new URLSearchParams(location.search);
const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const GOAL = '把盘问引开，安稳吃完这顿饭';
const RULES = [
  '每轮挑一句话，把话头从自己身上引开；吃完三道菜就算安稳下桌。',
  '谁接话、谁帮腔、谁盯上你，都写在选项上；同时被三个人盯着就会被围住，也可以随时借口离席。',
];
const strategyNotes: Record<Strategy, string> = {
  ally: '请站你这边的人把话接走。每人只能请一次。',
  taiji: '不接这茬，也不招惹谁。问话的人往往还盯着你。',
  counter: '把问题抛回去。对方会讲开，旁人可能顺势插话。',
  crazy: '一句玩笑炸开话题。有人被逗乐，也有人要你“正经点”。',
  sincere: '认真说句实话。对方可能从此站你这边。',
  leave: '找个由头离桌，这一局到此为止。',
};

let game: Game | null = null;
let screen: Screen = 'home';
let menu = false;
let poster: ReturnType<typeof createPoster> | null = null;
let posterError = '';
let generating = false;
let soundNotice = '';
let reactionBeat = -1;
let readingOption = 0;

const who = (speaker: Speaker | 'you') => speaker === 'you' ? '你' : speaker === 'table' ? '全桌' : nameOf(speaker);
function speechOf(g: Game): { speaker: Speaker | 'you'; text: string } {
  if (g.phase !== 'react') return { speaker: g.node.speaker, text: g.node.ask };
  if (reactionBeat < 0) return { speaker: 'you', text: g.last!.line };
  return { speaker: g.last!.beats[reactionBeat].who, text: g.last!.beats[reactionBeat].text };
}

function soundButton(): string {
  return `<button class="tool" data-action="sound" aria-pressed="${!audio.muted}" aria-label="${audio.muted ? '开启音效' : '关闭音效'}">${toolIcon(audio.muted ? 'mute' : 'sound')}</button>`;
}

function home(): string {
  const cast = dinner.cast.map(id => `<li style="--coat:${coatOf(id)}"><span class="cast-face">${svg(person(id, { gesture: 'hold', gaze: 'you', face: id === 'nainai' ? 'smile' : 'flat' }))}</span><b>${nameOf(id)}</b><small>${esc(relatives[id].trait)}</small></li>`).join('');
  return `<main class="home-page"><section class="home-scene" aria-label="奶奶和三姑在饭桌对面，给你留了一个座"><h1 class="home-title">过年亲戚防御塔</h1><div class="opening-sign" aria-label="开席">${svg(openingSign())}</div><p class="welcome">来，给你留了个座。</p><div class="home-people"><div class="home-person">${svg(person('nainai', { gesture: 'hold', gaze: 'you', face: 'smile' }))}</div><div class="home-person">${svg(person('sangu', { gesture: 'ask', gaze: 'you', face: 'ask' }), true)}</div></div><div class="home-table">${svg(table())}</div><div class="empty-seat">${svg(emptySeat())}</div></section><section class="opening-goal" aria-labelledby="goal-heading"><span class="little-label">这桌的目标</span><h2 id="goal-heading">${GOAL}</h2><button class="primary" data-action="start">坐下开席 <span aria-hidden="true">↗</span></button><div class="entry-note"><span>约 3 分钟 · 三道菜 · 不计时</span><button class="link" data-action="menu">看玩法</button></div></section><details class="cast-card"><summary>今晚谁入席？</summary><h3 id="cast-heading" class="section-label">防的是盘问，不是亲人</h3><ul class="cast-list">${cast}</ul></details></main>`;
}

interface Seat { text: string; tone: 'ask' | 'watch' | 'new' | 'free' | 'ally' | 'used' | 'idle' | 'target' }
function seatOf(id: Cast, g: Game): Seat {
  const { state, node } = g;
  if (g.phase === 'react') {
    const turn = g.last!;
    if (turn.after.includes(id)) return turn.before.includes(id) ? { text: '还盯着', tone: 'watch' } : { text: '开始盯你', tone: 'new' };
    if (turn.gained.includes(id)) return { text: '站你这边', tone: 'ally' };
    if (turn.before.includes(id)) return { text: '不盯了', tone: 'free' };
    if (turn.spent.includes(id)) return { text: '帮你接了', tone: 'used' };
  } else {
    if (node.speaker === id) return { text: '正在问', tone: 'ask' };
    if (node.target === id) return { text: '被问到', tone: 'target' };
    if (state.watching.includes(id)) return { text: '盯着你', tone: 'watch' };
  }
  if (state.used.includes(id)) return { text: '帮过了', tone: 'used' };
  if (state.allies.includes(id)) return { text: '站你这边', tone: 'ally' };
  return { text: '在吃菜', tone: 'idle' };
}
function poseOf(id: Cast, seat: Seat, g: Game): Pose {
  const talking = speechOf(g).speaker === id || speechOf(g).speaker === 'table';
  if (seat.tone === 'ask') return { gesture: 'ask', gaze: 'you', face: 'ask' };
  if (seat.tone === 'new' || seat.tone === 'watch') return { gesture: talking ? 'ask' : 'cross', gaze: 'you', face: talking ? 'ask' : 'huff' };
  if (seat.tone === 'ally') return { gesture: talking ? 'cheer' : 'hold', gaze: 'you', face: 'happy' };
  if (seat.tone === 'free' || seat.tone === 'used') return { gesture: talking ? 'reply' : 'hold', gaze: 'in', face: 'happy' };
  if (seat.tone === 'target') return { gesture: 'hold', gaze: 'down', face: 'flat' };
  return { gesture: talking ? 'reply' : 'hold', gaze: 'down', face: 'smile' };
}
function tableScene(g: Game): string {
  const speaker = speechOf(g).speaker;
  const seats = dinner.cast.map((id, i) => {
    const seat = seatOf(id, g);
    const speaking = speaker === id || speaker === 'table';
    return `<li class="seat ${seat.tone}${speaking ? ' speaking' : ''}" data-cast="${id}" style="--coat:${coatOf(id)}"><span class="seat-art">${svg(person(id, poseOf(id, seat, g)), i >= 3)}</span><b class="seat-name">${nameOf(id)}</b><span class="seat-tag">${seat.text}</span></li>`;
  }).join('');
  return `<section class="table-scene" data-speaker="${speaker}" data-target="${g.node.target}" aria-label="饭桌：${dinner.cast.map(id => `${nameOf(id)}${seatOf(id, g).text}`).join('，')}"><div class="stage-table" aria-hidden="true">${svg(table())}</div><ul class="seats">${seats}</ul><svg class="speech-thread" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path/></svg>${askBlock(g)}<p class="you-seat${speaker === 'you' ? ' speaking' : ''}"><b>你</b></p></section>`;
}
function header(g: Game): string {
  const watching = g.phase === 'react' ? g.last!.after : g.state.watching;
  return `<header class="game-header"><div class="dish-title"><b>${dinner.scenes[g.scene]}</b><span class="watch-meter${watching.length >= PILE_LIMIT - 1 ? ' tense' : ''}" aria-label="第 ${g.scene + 1}/3 道，盯你 ${watching.length}/3：${names(watching)}">${g.scene + 1}/3 · 盯你 ${watching.length}/3</span></div><div class="tools">${soundButton()}<button class="tool menu-tool" data-action="menu" aria-label="玩法与菜单">玩法</button><button class="link leave-tool" data-action="leave">离席</button></div></header>`;
}
const riskOf = (o: Option): string => o.ending === 'piled' && !o.risk.includes('会被围住') ? `${o.risk}，会被围住` : o.risk;
function choiceCard(o: Option, index: number): string {
  const risk = riskOf(o);
  return `<button class="choice ${o.strategy}${o.ending === 'piled' ? ' danger' : ''}" data-slot="${index + 1}" data-choice="${o.id}" aria-label="${index + 1}. ${esc(o.line)}。${esc(risk)}"><span class="choice-line">${esc(o.line)}</span><span class="choice-risk"><span class="choice-icon">${svg(strategyIcon(o.strategy))}</span>${esc(risk)}</span></button>`;
}
function askBlock(g: Game): string {
  const { speaker, text } = speechOf(g);
  const to = g.phase === 'choose' ? g.node.target === 'you' ? '问你' : `问${nameOf(g.node.target)}` : speaker === 'you' ? '你说出口' : '接话';
  return `<article class="ask-bubble" aria-live="polite" style="--coat:${speaker === 'table' || speaker === 'you' ? 'var(--red)' : coatOf(speaker)}"><span class="ask-by"><b>${who(speaker)}</b><span>${to}</span></span><h2 class="ask-copy" id="${g.phase === 'react' ? 'reaction-heading' : 'ask-heading'}" tabindex="-1">${esc(text)}</h2><small class="reading-hint">大字正文可上下阅读</small></article>`;
}
function choosing(g: Game): string {
  const options = g.options().filter(o => o.available);
  const selected = options[Math.min(readingOption, options.length - 1)];
  return `<section class="choices response-dock" aria-labelledby="choices-heading"><h3 id="choices-heading">你接哪句？</h3><div class="choice-list">${options.map(choiceCard).join('')}</div><div class="reading-choices"><nav class="reading-tabs" aria-label="大字逐句阅读回答">${options.map((o, i) => `<button data-read-option="${i}" aria-label="阅读第 ${i + 1} 句：${esc(o.line)}" aria-pressed="${i === readingOption}">${i + 1}</button>`).join('')}<span>逐句阅读</span></nav><article class="reading-copy" tabindex="0" aria-label="当前回答与后果"><p class="choice-line">${esc(selected.line)}</p><p class="choice-risk">${esc(riskOf(selected))}</p></article><button class="primary" data-choice="${selected.id}">就说这句 <span aria-hidden="true">↗</span></button></div></section>`;
}
function shiftLines(turn: Turn): string {
  const rows: string[] = [];
  const added = turn.after.filter(id => !turn.before.includes(id));
  const freed = turn.before.filter(id => !turn.after.includes(id));
  if (freed.length) rows.push(`<li class="free">${names(freed)}不再盯着你</li>`);
  if (added.length) rows.push(`<li class="new">${names(added)}开始盯着你</li>`);
  if (turn.gained.length) rows.push(`<li class="ally">${names(turn.gained)}站到了你这边</li>`);
  if (turn.spent.length) rows.push(`<li class="used">${names(turn.spent)}帮你接了话，本局不能再请</li>`);
  if (!rows.length) rows.push('<li>谁也没换位置</li>');
  return rows.join('');
}
function nextLabel(turn: Turn): string {
  if (turn.ending) return '看这一桌怎么收场';
  const next = nodeById(turn.next!);
  return next.scene > turn.scene ? `上${dinner.scenes[next.scene]}` : '接着吃';
}
function reacting(g: Game): string {
  const turn = g.last!;
  const verdict = turn.ending === 'piled' ? '被围住了' : turn.ending === 'won' ? '这顿饭，吃完了' : turn.after.length < turn.before.length ? '话头引开了' : turn.after.length > turn.before.length ? '又有人盯着你' : '暂时稳住了';
  const done = reactionBeat === turn.beats.length - 1;
  const next = done ? nextLabel(turn) : `听${who(turn.beats[reactionBeat + 1].who)}接话`;
  return `<section class="reaction response-dock" aria-label="当前反应"><div class="reaction-summary"><h3>${verdict}</h3><p>盯你 ${turn.before.length} → ${turn.after.length} · ${turn.after.length ? `${names(turn.after)}还盯着` : '没人盯着了'}</p>${turn.gained.length ? `<p>${names(turn.gained)}站你这边了</p>` : ''}${turn.spent.length ? `<p>${names(turn.spent)}已帮忙，本局不能再请</p>` : ''}<small>接话 ${Math.max(0, reactionBeat + 1)}/${turn.beats.length} · 不计时</small></div><div class="continue-row"><button class="secondary" data-action="reply-back"${reactionBeat < 0 ? ' disabled' : ''}>上一句</button><button class="primary" data-action="${done ? 'next' : 'reply-next'}">${next}<span aria-hidden="true">↗</span></button></div></section>`;
}
function playing(g: Game = game!): string {
  return `<main class="game-page" data-phase="${g.phase}" data-node="${g.node.id}" data-beat="${reactionBeat}">${header(g)}${tableScene(g)}${g.phase === 'react' ? reacting(g) : choosing(g)}</main>`;
}

function replayTurn(turn: Turn): string {
  return `<li class="replay-turn"><div class="replay-top"><span class="turn-stamp">${dinner.scenes[turn.scene]}</span><span class="replay-watch">盯着你 ${turn.before.length} → ${turn.after.length}</span></div><p class="replay-ask">${who(turn.node.speaker)}：「${esc(turn.node.ask)}」</p><blockquote>你（${strategyNames[turn.strategy]}）：「${esc(turn.line)}」</blockquote><ul class="replay-beats">${turn.beats.map(beat => `<li><b>${who(beat.who)}</b>「${esc(beat.text)}」</li>`).join('')}</ul><ul class="replay-shift">${shiftLines(turn)}</ul></li>`;
}
function result(report: Report): string {
  const [left, right] = posterCast(report);
  return `<main class="result-page"><header class="result-head"><span>这一桌回放</span>${soundButton()}</header><p class="ending-label ${report.ending}">${endingLabels[report.ending]} · 吃完 ${report.dishes}/3 道菜</p><h1 tabindex="-1" id="result-heading">${esc(report.title)}</h1><p class="result-summary">${esc(report.summary)}</p><div class="finish-scene" aria-hidden="true"><span>${svg(person(left, { gesture: 'cheer', gaze: 'in', face: 'happy' }))}</span><span>${svg(person(right, { gesture: report.ending === 'piled' ? 'ask' : 'hold', gaze: 'in', face: report.ending === 'piled' ? 'ask' : 'smile' }), true)}</span><div class="finish-table">${svg(table(report.ending === 'won'))}</div></div>${report.helpers.length ? `<p class="helpers">这桌帮过你的人：<b>${names(report.helpers)}</b></p>` : ''}<h2 class="section-label">这一桌是怎么走的 <small>${report.turns.length} 次开口</small></h2>${report.turns.length ? `<ol class="replay">${report.turns.map(replayTurn).join('')}</ol>` : '<p class="replay-empty">还没开口就离席了。下一桌可以先试试请奶奶接话。</p>'}<section class="replay-invitation"><span class="little-label">下一桌可以这样试</span><ul>${report.tips.map(tip => `<li>${esc(tip)}</li>`).join('')}</ul></section><div class="export-feedback"${posterError ? ' role="alert" tabindex="-1"' : ' aria-hidden="true"'}>${posterError ? `<p>${esc(posterError)}</p><button class="link" data-action="poster">重试生成</button>` : ''}</div><div class="result-actions"><button class="primary" data-action="restart">再吃一桌，换个走法 <span aria-hidden="true">↗</span></button><button class="secondary" data-action="poster"${generating ? ' disabled' : ''}>${generating ? '正在画这一桌…' : '把这桌存成回放图'}</button><button class="secondary" data-action="home">回到开席页</button><p class="privacy-note">只在本地玩、生成图片。不上传，没有排行榜。</p></div></main>`;
}
function posterPage(): string {
  const report = game!.report!;
  return `<main class="poster-page"><header class="result-head"><span>这一桌已画好</span><span>1080 × 1440 · PNG</span></header><img class="poster-image" src="${poster!.dataUrl}" alt="本局回放图：${esc(report.title)}，${endingLabels[report.ending]}，吃完${report.dishes}道菜" width="1080" height="1440"><p>手机长按图片保存，电脑点下载。图片只在本地生成。</p><a class="primary" href="${poster!.dataUrl}" download="${poster!.fileName}">下载 PNG 回放图 <span aria-hidden="true">↓</span></a><button class="secondary" data-action="back">回到这局回放</button></main>`;
}
function menuMarkup(): string {
  const locked = screen === 'game' ? game!.options().filter(o => !o.available) : [];
  const legend = (Object.keys(strategyNotes) as Strategy[]).map(key => `<li><span class="choice-icon">${svg(strategyIcon(key))}</span><div><b>${strategyNames[key]}</b><p>${strategyNotes[key]}</p></div></li>`).join('');
  return `<div class="menu-layer"><section class="menu-box" role="dialog" aria-modal="true" aria-labelledby="menu-title"><p class="little-label">不计时，慢慢看</p><h2 id="menu-title" tabindex="-1">这一桌怎么吃</h2><p class="menu-goal"><b>${GOAL}</b></p><ol class="rule-list">${RULES.map(rule => `<li>${rule}</li>`).join('')}</ol>${screen === 'game' ? `<p class="privacy-note">${esc(game!.node.situation)}</p>` : ''}${locked.length ? `<details><summary>暂时不能请的人</summary><ul>${locked.map(o => `<li>${esc(o.lock)}</li>`).join('')}</ul></details>` : ''}<h3 class="section-label">六种说法</h3><ul class="legend">${legend}</ul>${soundNotice ? `<p class="sound-notice" role="status">${esc(soundNotice)}</p>` : ''}<p class="privacy-note">没有标准台词，没有隐藏概率。选之前写的后果，就是选之后发生的事。</p><button class="primary" data-action="close-menu">${screen === 'game' ? '回桌继续' : '知道了'}</button>${screen === 'game' ? '<div class="menu-row"><button class="secondary" data-action="restart">重开这一桌</button><button class="secondary" data-action="leave">借口离席</button></div>' : ''}</section></div>`;
}

function fitLayout(): void {
  const scale = Number(getComputedStyle(document.documentElement).getPropertyValue('--text-scale'));
  app.dataset.largeText = String(scale > 4 / 3);
  app.dataset.reading = String(scale > 1);
  const scene = app.querySelector<HTMLElement>('.table-scene');
  if (!scene) return;
  const speaker = scene.dataset.speaker;
  const box = scene.getBoundingClientRect();
  const bubble = scene.querySelector('.ask-bubble')!.getBoundingClientRect();
  const target = scene.querySelector(speaker === 'you' ? '.you-seat' : speaker === 'table' ? '.stage-table' : `[data-cast="${speaker}"] .seat-name`)!.getBoundingClientRect();
  const fromX = bubble.x + bubble.width / 2 - box.x;
  const fromY = bubble.y + bubble.height / 2 - box.y;
  const toX = target.x + target.width / 2 - box.x;
  const toY = (speaker === 'table' ? target.y : target.y + target.height / 2) - box.y;
  scene.querySelector('.speech-thread')!.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  scene.querySelector('.speech-thread path')!.setAttribute('d', `M${fromX} ${fromY} Q${toX} ${fromY} ${toX} ${toY}`);
}
function render(focusTarget = ''): void {
  const oldMenu = app.querySelector('.menu-layer')?.scrollTop ?? 0;
  app.innerHTML = screen === 'home' ? home() : screen === 'game' ? playing() : screen === 'result' ? result(game!.report!) : posterPage();
  if (menu) {
    app.firstElementChild?.setAttribute('inert', '');
    app.firstElementChild?.setAttribute('aria-hidden', 'true');
    app.insertAdjacentHTML('beforeend', menuMarkup());
    app.querySelector<HTMLElement>('.menu-layer')!.scrollTop = oldMenu;
  }
  fitLayout();
  if (focusTarget) app.querySelector<HTMLElement>(focusTarget)?.focus({ preventScroll: true });
}
function goTo(next: Screen, focusTarget: string): void {
  screen = next; menu = false;
  render(focusTarget);
  window.scrollTo(0, 0);
}
function start(): void {
  game = new Game();
  if ((import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV && params.has('probe')) (window as unknown as { __rtdGame: Game }).__rtdGame = game;
  poster = null; posterError = ''; soundNotice = ''; reactionBeat = -1; readingOption = 0;
  goTo('game', '#ask-heading');
  void audio.resume().catch(() => { soundNotice = '音效暂不可用，仍可静音游玩。'; render(); });
}
function finish(): void {
  audio.play('end');
  goTo('result', '#result-heading');
}
function choose(id: string): void {
  const turn = game?.choose(id);
  if (!turn) return;
  audio.play(turn.ending === 'piled' ? 'flop' : turn.strategy === 'sincere' || turn.strategy === 'ally' ? 'sincere' : turn.strategy === 'crazy' ? 'critical' : 'card');
  reactionBeat = -1;
  render('#reaction-heading');
}
async function makePoster(): Promise<void> {
  if (generating) return;
  generating = true; posterError = ''; poster = null;
  render();
  try {
    await document.fonts.ready;
    poster = createPoster(game!.report!);
    generating = false;
    goTo('poster', '.poster-page a');
  } catch {
    generating = false; posterError = '这次没画成，回放还在。可以重试生成图片。';
    render('.export-feedback');
  }
}
app.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLElement>('button, a[data-action]');
  if (!button || button.hasAttribute('disabled')) return;
  if (button.dataset.choice) { choose(button.dataset.choice); return; }
  if (button.dataset.readOption !== undefined) { readingOption = Number(button.dataset.readOption); render('.reading-copy'); return; }
  switch (button.dataset.action) {
    case 'start': case 'restart': start(); break;
    case 'menu': menu = true; render('#menu-title'); break;
    case 'close-menu': menu = false; render('[data-action="menu"]'); break;
    case 'sound': void audio.toggle().then(() => render('[data-action="sound"]')).catch(() => { soundNotice = '音效暂不可用，仍可静音游玩。'; render('[data-action="sound"]'); }); break;
    case 'reply-next':
      if (game?.phase !== 'react' || reactionBeat >= game.last!.beats.length - 1) break;
      reactionBeat++; render('#reaction-heading'); break;
    case 'reply-back':
      if (game?.phase !== 'react' || reactionBeat < 0) break;
      reactionBeat--; render('#reaction-heading'); break;
    case 'next':
      if (game?.phase !== 'react' || reactionBeat !== game.last!.beats.length - 1 || !game.advance()) break;
      reactionBeat = -1; readingOption = 0;
      if (game.report) finish();
      else render('#ask-heading');
      break;
    case 'leave': if (game?.leave()) finish(); break;
    case 'home': goTo('home', '[data-action="start"]'); break;
    case 'poster': void makePoster(); break;
    case 'back': goTo('result', '[data-action="poster"]'); break;
  }
});
app.addEventListener('keydown', event => {
  if (!menu) return;
  if (event.key === 'Escape') { event.preventDefault(); menu = false; render('[data-action="menu"]'); return; }
  if (event.key !== 'Tab') return;
  const items = [...app.querySelectorAll<HTMLElement>('.menu-box button:not([disabled])')];
  if (document.activeElement?.id === 'menu-title') { event.preventDefault(); items[event.shiftKey ? items.length - 1 : 0].focus(); }
  else if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
  else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
});
new MutationObserver(fitLayout).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
window.addEventListener('resize', fitLayout);
void document.fonts.ready.then(fitLayout);
render();
