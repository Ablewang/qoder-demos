import { cardIcon, ink, paint, paper, person, red, table, type Seated } from './art';
import { cardNames, relatives, type Card } from './content';
import type { Report, TurnResult } from './engine';
export function secondStat(report: Report): { label: string; value: number; unit: string } {
  if (report.counters && report.counters >= report.sincere) return { label: '反问', value: report.counters, unit: '次' };
  if (report.sincere) return { label: '真心', value: report.sincere, unit: '次' };
  return { label: '帮腔兑现', value: report.allies, unit: '次' };
}

function highlightSummary(turn: TurnResult, history: TurnResult[]): string {
  const parts: string[] = [];
  if (turn.incoming) {
    const { kind, asker, amount } = turn.incoming;
    parts.push(kind === 'ally'
      ? `${relatives[asker].name}兑现帮腔，少${amount}点压力`
      : `${relatives[asker].name}追问兑现，压力+${amount}`);
  }
  if (turn.loss > 0) parts.push(`${cardNames[turn.card]}回应，心态扣${turn.loss}格、剩${turn.moodAfter}格`);
  else if (turn.turn === 8) parts.push(`压轴接完，心态还剩${turn.moodAfter}格`);
  else if (!parts.length || turn.next) parts.push(`${cardNames[turn.card]}接住`);
  if (turn.next) {
    const { kind, asker, amount } = turn.next;
    const applied = history.find(item => item.turn === turn.turn + 1 && item.incoming?.kind === kind && item.incoming.asker === asker);
    parts.push(applied
      ? `第${applied.turn}问已${kind === 'ally' ? '帮腔-' : '追问+'}${amount}压力`
      : kind === 'ally' ? `下一问${relatives[asker].name}帮腔-${amount}压力（待兑现）` : `下一问追问+${amount}（待兑现）`);
  }
  return `第${turn.turn}问：${parts.join('；')}`;
}

export interface PosterOptions { cast?: Seated[]; identity?: string; card?: Card; spoken?: boolean }
export const POSTER = { width: 1080, height: 1440, left: 64, right: 1016, titleLeft: 58, titleBaseline: 300, titleMax: 104, titleMin: 72 };
export const BUBBLE = { x: 250, y: 576, width: 580, padding: 28, label: 36, size: 44, lineHeight: 60, maxLines: 3 };
const muted = '#625246';

export function createPoster(report: Report, quote: string, options: PosterOptions = {}): { dataUrl: string; fileName: string } {
  const canvas = document.createElement('canvas');
  canvas.width = POSTER.width;
  canvas.height = POSTER.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器暂不支持图片绘制');
  const [left, right] = options.cast ?? ['nainai', 'dayi'];
  const spoken = report.turns > 0 && options.spoken !== false;
  const card = options.card ?? report.history.find(turn => turn.quote === quote)?.card ?? 'taiji';
  const font = (size: number, weight = 400) => { ctx.font = `${weight} ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`; };
  const text = (value: string, x: number, y: number, size: number, color = ink, weight = 400) => {
    font(size, weight); ctx.fillStyle = color; ctx.fillText(value, x, y);
    return ctx.measureText(value).width;
  };
  const width = (value: string, size: number, weight = 400) => { font(size, weight); return ctx.measureText(value).width; };
  const rightText = (value: string, y: number, size: number, color = ink, weight = 400) => {
    font(size, weight);
    return text(value, POSTER.right - ctx.measureText(value).actualBoundingBoxRight, y, size, color, weight);
  };
  const line = (x1: number, y1: number, x2: number, y2: number, w: number, color = ink) => {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  const rotated = (cx: number, cy: number, deg: number, draw: () => void) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(deg * Math.PI / 180); ctx.translate(-cx, -cy); draw(); ctx.restore();
  };
  const tag = (label: string, value: number, unit: string, x: number, y: number, deg: number, alignRight = false) => {
    const total = width(label, 42) + 10 + width(String(value), 58, 650) + 8 + width(unit, 42);
    const start = alignRight ? x - total : x;
    rotated(start + total / 2, y - 20, deg, () => {
      ctx.fillStyle = paper; ctx.fillRect(start - 12, y - 58, total + 24, 76);
      let cursor = start + text(label, start, y, 42) + 10;
      cursor += text(String(value), cursor, y, 58, ink, 650) + 8;
      text(unit, cursor, y, 42);
      line(start - 12, y + 18, start + total + 12, y + 18, 4);
    });
  };
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = paper; ctx.fillRect(0, 0, POSTER.width, POSTER.height);

  text(`${options.identity ? `${options.identity} · ` : ''}入席`, POSTER.left, 80, 42, muted);
  rightText('2027 年夜饭', 80, 42, muted);
  line(POSTER.left, 100, POSTER.right, 100, 3);
  text(`过年亲戚防御塔 / ${report.won ? '好好吃完这顿饭' : '自己的节奏，自己定'}`, POSTER.left, 170, 42);

  let size = POSTER.titleMax;
  font(size, 700);
  let metrics = ctx.measureText(report.title);
  while (size > POSTER.titleMin && metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight > POSTER.right - POSTER.titleLeft) {
    size -= 4; font(size, 700); metrics = ctx.measureText(report.title);
  }
  ctx.fillStyle = ink;
  ctx.fillText(report.title, POSTER.titleLeft + metrics.actualBoundingBoxLeft, POSTER.titleBaseline);
  rotated(POSTER.left + 137, 334, -2, () => { ctx.fillStyle = red; ctx.fillRect(POSTER.left, 330, 275, 8); });

  paint(ctx, table(true), 26, 540, 1027);
  paint(ctx, person(left, { gesture: 'hold', gaze: 'you', face: 'smile' }), 30, 350, 355);
  paint(ctx, person(right, report.won ? { gesture: 'cheer', gaze: 'you', face: 'happy' } : { gesture: 'reply', gaze: 'you', face: 'smile' }), 695, 350, 355, true);

  const inner = BUBBLE.width - BUBBLE.padding * 2;
  let quoteSize = BUBBLE.size;
  let lines = wrap(ctx, quote, inner, quoteSize, font);
  while (lines.length > BUBBLE.maxLines && quoteSize > 20) { quoteSize -= 2; lines = wrap(ctx, quote, inner, quoteSize, font); }
  if (lines.length > BUBBLE.maxLines) throw new Error('引用过长，无法完整绘制');
  const lineHeight = Math.round(quoteSize * 1.36);
  const height = BUBBLE.padding * 2 + BUBBLE.label + 18 + lines.length * lineHeight;
  const { x, y } = BUBBLE;
  const w = BUBBLE.width;
  const tip = x + w * 0.42;
  rotated(x + w / 2, y + height / 2, -2, () => {
    const bubble = new Path2D(`M${x + 20} ${y}L${x + w - 28} ${y + 3}Q${x + w} ${y + 3} ${x + w - 2} ${y + 30}L${x + w - 4} ${y + height - 24}Q${x + w - 4} ${y + height} ${x + w - 30} ${y + height}L${tip + 22} ${y + height}L${tip} ${y + height + 36}L${tip - 20} ${y + height}L${x + 24} ${y + height - 2}Q${x} ${y + height - 2} ${x + 2} ${y + height - 26}L${x} ${y + 22}Q${x} ${y} ${x + 20} ${y}Z`);
    ctx.fillStyle = paper; ctx.fill(bubble);
    ctx.strokeStyle = ink; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.stroke(bubble);
    text(spoken ? '这局我这样说' : '离席时想说', x + BUBBLE.padding, y + BUBBLE.padding + BUBBLE.label - 4, BUBBLE.label, muted);
    lines.forEach((value, i) => text(value, x + BUBBLE.padding, y + BUBBLE.padding + BUBBLE.label + 18 + (i + 1) * lineHeight - 14, quoteSize, ink, 500));
  });

  tag('未扣心态', report.blocked, '问', POSTER.left + 12, 948, -4);
  const stat = secondStat(report);
  tag(stat.label, stat.value, stat.unit, POSTER.right - 12, 1000, 3, true);
  if (spoken) {
    rotated(470, 1030, -13, () => {
      ctx.fillStyle = paper; ctx.fillRect(366, 974, 211, 114);
      ctx.strokeStyle = ink; ctx.lineWidth = 5; ctx.strokeRect(366, 974, 211, 114);
      paint(ctx, cardIcon(card), 384, 1000, 64);
      text(cardNames[card], 462, 1046, 40, ink, 650);
    });
  }
  const seat = '你的席位';
  rotated(700, 1080, 2, () => {
    const seatWidth = width(seat, 42);
    ctx.fillStyle = paper; ctx.fillRect(630, 1036, seatWidth + 20, 60);
    text(seat, 640, 1084, 42);
    line(630, 1098, 650 + seatWidth, 1098, 4);
  });

  ctx.fillStyle = paper; ctx.fillRect(0, 1124, POSTER.width, POSTER.height - 1124);
  line(POSTER.left, 1140, POSTER.right, 1140, 4);
  text(`完成问数 ${report.turns}/8`, POSTER.left, 1198, 48, ink, 650);
  rightText(`心态 ${report.mood}/6`, 1198, 48, red, 650);
  const summaries = report.highlights.slice(0, 3).map(turn => highlightSummary(turn, report.history));
  const summaryWidth = POSTER.right - POSTER.left - 4;
  let summarySize = 30;
  let summaryLines = summaries.map(value => wrap(ctx, value, summaryWidth, summarySize, font));
  const summaryHeight = () => summaryLines.reduce((total, values) => total + values.length, 0) * Math.ceil(summarySize * 1.25);
  while (summaryHeight() > 152 && summarySize > 20) {
    summarySize -= 2;
    summaryLines = summaries.map(value => wrap(ctx, value, summaryWidth, summarySize, font));
  }
  if (summaryHeight() > 152) throw new Error('关键摘要过长，无法完整绘制');
  let summaryY = 1212;
  for (const values of summaryLines) {
    for (const value of values) {
      summaryY += Math.ceil(summarySize * 1.25);
      text(value, POSTER.left + 2, summaryY, summarySize, muted, 500);
    }
  }
  text('本地试玩 · 未发布', POSTER.left, 1405, 36, muted);
  rightText('无二维码 · 不上传', 1405, 36, muted);

  const dataUrl = canvas.toDataURL('image/png');
  if (!dataUrl.startsWith('data:image/png;base64,')) throw new Error('图片生成失败，请重试');
  return { dataUrl, fileName: '亲戚防御塔-年夜饭战报.png' };
}

function wrap(ctx: CanvasRenderingContext2D, value: string, max: number, size: number, font: (size: number, weight?: number) => void): string[] {
  font(size, 500);
  const lines: string[] = [];
  let current = '';
  for (const char of value) {
    if (current && ctx.measureText(current + char).width > max) { lines.push(current); current = char; } else current += char;
  }
  if (current) lines.push(current);
  return lines;
}
