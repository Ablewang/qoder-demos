import { ink, paint, paper, person, red, table, type Seated } from './art';
import { dinner, nameOf, strategyNames, type Cast, type Ending } from './content';
import type { Report, Turn } from './engine';

export const POSTER = { width: 1080, height: 1440, left: 64, right: 1016, titleLeft: 58, titleBaseline: 300, titleMax: 100, titleMin: 60 };
export const BUBBLE = { x: 230, y: 610, width: 620, padding: 28, label: 34, size: 44, maxLines: 3 };
export const CHAIN = { top: 1010, bottom: 1330, size: 34, min: 22 };
const muted = '#625246';
export const endingLabels: Record<Ending, string> = { won: '安稳吃完', piled: '被全桌围住', left: '提前离席' };

export function chainLine(turn: Turn): string {
  const speakers = [...new Set(turn.beats.map(beat => beat.who))].map(nameOf).join('、');
  return `${dinner.scenes[turn.scene]}｜${strategyNames[turn.strategy]}：${turn.intent} → ${speakers}接话`;
}

export function posterCast(report: Report): [Seated, Seated] {
  const helper: Cast = report.helpers[0] ?? 'nainai';
  const last = report.turns[report.turns.length - 1];
  const speaker = last?.beats.map(beat => beat.who).find((who): who is Cast => who !== 'table' && who !== helper);
  return [helper, speaker ?? (helper === 'sangu' ? 'erjiu' : 'sangu')];
}

export function createPoster(report: Report): { dataUrl: string; fileName: string } {
  const canvas = document.createElement('canvas');
  canvas.width = POSTER.width;
  canvas.height = POSTER.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器暂不支持图片绘制');
  const font = (size: number, weight = 400) => { ctx.font = `${weight} ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`; };
  const text = (value: string, x: number, y: number, size: number, color = ink, weight = 400) => {
    font(size, weight); ctx.fillStyle = color; ctx.fillText(value, x, y);
  };
  const rightText = (value: string, y: number, size: number, color = ink, weight = 400) => {
    font(size, weight);
    text(value, POSTER.right - ctx.measureText(value).actualBoundingBoxRight, y, size, color, weight);
  };
  const line = (x1: number, y1: number, x2: number, y2: number, w: number, color = ink) => {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  const rotated = (cx: number, cy: number, deg: number, draw: () => void) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(deg * Math.PI / 180); ctx.translate(-cx, -cy); draw(); ctx.restore();
  };
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = paper; ctx.fillRect(0, 0, POSTER.width, POSTER.height);

  text('过年亲戚防御塔', POSTER.left, 80, 42, muted);
  rightText('2027 年夜饭', 80, 42, muted);
  line(POSTER.left, 100, POSTER.right, 100, 3);
  text(`${endingLabels[report.ending]} · 吃完 ${report.dishes}/${dinner.scenes.length} 道菜`, POSTER.left, 170, 44, report.ending === 'won' ? ink : red, 650);

  let size = POSTER.titleMax;
  font(size, 700);
  let metrics = ctx.measureText(report.title);
  while (size > POSTER.titleMin && metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight > POSTER.right - POSTER.titleLeft) {
    size -= 4; font(size, 700); metrics = ctx.measureText(report.title);
  }
  if (metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight > POSTER.right - POSTER.titleLeft) throw new Error('标题过长，无法完整绘制');
  ctx.fillStyle = ink;
  ctx.fillText(report.title, POSTER.titleLeft + metrics.actualBoundingBoxLeft, POSTER.titleBaseline);
  rotated(POSTER.left + 137, 334, -2, () => { ctx.fillStyle = red; ctx.fillRect(POSTER.left, 330, 275, 8); });

  const [left, right] = posterCast(report);
  paint(ctx, table(report.ending === 'won'), 26, 560, 1027);
  paint(ctx, person(left, { gesture: report.ending === 'won' ? 'cheer' : 'hold', gaze: 'you', face: 'happy' }), 30, 370, 340);
  paint(ctx, person(right, { gesture: 'reply', gaze: 'you', face: report.ending === 'piled' ? 'ask' : 'smile' }), 710, 370, 340, true);
  for (const [who, nameX] of [[left, 112], [right, 874]] as const) {
    ctx.fillStyle = paper; ctx.fillRect(nameX - 12, 690, 98, 54);
    ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.strokeRect(nameX - 12, 690, 98, 54);
    text(nameOf(who), nameX, 730, 34, ink, 650);
  }

  const last = report.turns[report.turns.length - 1];
  const quote = last ? `「${last.line}」` : '还没开口，就先离席了。';
  const inner = BUBBLE.width - BUBBLE.padding * 2;
  let quoteSize = BUBBLE.size;
  let lines = wrap(ctx, quote, inner, quoteSize, font);
  while (lines.length > BUBBLE.maxLines && quoteSize > 24) { quoteSize -= 2; lines = wrap(ctx, quote, inner, quoteSize, font); }
  if (lines.length > BUBBLE.maxLines) throw new Error('台词过长，无法完整绘制');
  const lineHeight = Math.round(quoteSize * 1.36);
  const height = BUBBLE.padding * 2 + BUBBLE.label + 18 + lines.length * lineHeight;
  const { x, y, width: w } = BUBBLE;
  const tip = x + w * 0.42;
  rotated(x + w / 2, y + height / 2, -2, () => {
    const bubble = new Path2D(`M${x + 20} ${y}L${x + w - 28} ${y + 3}Q${x + w} ${y + 3} ${x + w - 2} ${y + 30}L${x + w - 4} ${y + height - 24}Q${x + w - 4} ${y + height} ${x + w - 30} ${y + height}L${tip + 22} ${y + height}L${tip} ${y + height + 36}L${tip - 20} ${y + height}L${x + 24} ${y + height - 2}Q${x} ${y + height - 2} ${x + 2} ${y + height - 26}L${x} ${y + 22}Q${x} ${y} ${x + 20} ${y}Z`);
    ctx.fillStyle = paper; ctx.fill(bubble);
    ctx.strokeStyle = ink; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.stroke(bubble);
    text(last ? '最后我这样说' : '这局没开口', x + BUBBLE.padding, y + BUBBLE.padding + BUBBLE.label - 4, BUBBLE.label, muted);
    lines.forEach((value, i) => text(value, x + BUBBLE.padding, y + BUBBLE.padding + BUBBLE.label + 18 + (i + 1) * lineHeight - 14, quoteSize, ink, 500));
  });

  ctx.fillStyle = paper; ctx.fillRect(0, CHAIN.top - 60, POSTER.width, CHAIN.bottom - CHAIN.top + 60);
  line(POSTER.left, CHAIN.top - 44, POSTER.right, CHAIN.top - 44, 4);
  const chains = report.turns.map(chainLine);
  const chainWidth = POSTER.right - POSTER.left;
  let chainSize = CHAIN.size;
  const layout = () => chains.map(value => wrap(ctx, value, chainWidth, chainSize, font));
  let chainLines = layout();
  const total = () => chainLines.reduce((sum, item) => sum + item.length, 0) * Math.ceil(chainSize * 1.4) + (chainLines.length - 1) * 10;
  while (total() > CHAIN.bottom - CHAIN.top && chainSize > CHAIN.min) { chainSize -= 2; chainLines = layout(); }
  if (total() > CHAIN.bottom - CHAIN.top) throw new Error('回放摘要过长，无法完整绘制');
  let cursor = CHAIN.top;
  if (!chains.length) text('还没出手就离席了。下一桌慢慢来。', POSTER.left, cursor + chainSize, chainSize, muted, 500);
  for (const values of chainLines) {
    for (const value of values) { cursor += Math.ceil(chainSize * 1.4); text(value, POSTER.left, cursor - 8, chainSize, ink, 500); }
    cursor += 10;
  }
  text('本地生成 · 未发布', POSTER.left, 1405, 34, muted);
  rightText('不上传 · 无二维码', 1405, 34, muted);

  const dataUrl = canvas.toDataURL('image/png');
  if (!dataUrl.startsWith('data:image/png;base64,')) throw new Error('图片生成失败，请重试');
  return { dataUrl, fileName: '亲戚防御塔-这一桌.png' };
}

function wrap(ctx: CanvasRenderingContext2D, value: string, max: number, size: number, font: (size: number, weight?: number) => void): string[] {
  font(size, 500);
  const lines: string[] = [];
  let current = '';
  for (const token of value.match(/.[，。！？、：；）」』】〕〉》…,.!?;:)\]}]*/gu)!) {
    if (current && ctx.measureText(current + token).width > max) { lines.push(current); current = token; } else current += token;
  }
  if (current) lines.push(current);
  return lines;
}
