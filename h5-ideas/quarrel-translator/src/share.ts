import { toneLabels, type Relation, type Tone, type Translation } from './contract.js';

const noLineStart = new Set('。，、；：！？…％）］｝】〕〉》」』〗〙〛’”,.;:!?%)]}');
const noLineEnd = new Set('（［｛【〔〈《「『〖〘〚“‘([{');

export function wrapText(text: string, measure: (text: string) => number, width: number): string[] {
  const lines: string[] = [];
  const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
  for (const paragraph of text.split('\n')) {
    const segments = [...segmenter.segment(paragraph)].map(({ segment }) => segment);
    const quotes = new Set<string>();
    const punctuation = segments.map((segment, index) => {
      if ((segment === '"' || segment === "'") && !(segment === "'"
        && /^[\p{Script=Latin}\p{N}]/u.test(segments[index - 1] ?? '')
        && (/^[\p{Script=Latin}\p{N}]/u.test(segments[index + 1] ?? '') || !quotes.has(segment)))) {
        const closing = quotes.has(segment);
        if (closing) quotes.delete(segment); else quotes.add(segment);
        return { opening: !closing, closing };
      }
      return { opening: noLineEnd.has(segment[0]!), closing: noLineStart.has(segment[0]!) };
    });
    for (let index = 1; index < segments.length; index++) {
      if (/^\s+$/u.test(segments[index]!)) punctuation[index]!.opening = punctuation[index - 1]!.opening;
    }
    for (let index = segments.length - 2; index >= 0; index--) {
      if (/^\s+$/u.test(segments[index]!)) punctuation[index]!.closing = punctuation[index + 1]!.closing;
    }
    if (!segments.length) { lines.push(''); continue; }
    let start = 0;
    while (start < segments.length) {
      let end = start + 1;
      while (end < segments.length && measure(segments.slice(start, end + 1).join('')) <= width) end++;
      let split = end;
      if (end < segments.length) {
        while (split > start && (punctuation[split - 1]!.opening || punctuation[split]!.closing)) split--;
        // A tiny width may not fit any legal punctuation group; keep whole graphemes without widening the line.
        if (split === start) split = end;
      }
      lines.push(segments.slice(start, split).join(''));
      start = split;
    }
  }
  return lines;
}

export interface ShareInput {
  original: string; relation: Relation; result: Translation; tone: Tone; demo: boolean; hideOriginal: boolean;
}
export const hiddenOriginalNotice = '原话已隐藏 · 不在卡片中展示';
export const demoNotice = '固定演示 · 非实时 AI 结果';
export const shareTextWidth = 928;
export const humorNotice = '幽默不是万能修复；涉及威胁或伤害时，不用玩笑绕过边界。';

export function createShareCard(input: ShareInput): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE');
  const font = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
  const blocks = [
    { text: '吵架翻译器 / 改措辞，不改立场', size: 44, line: 66, gap: 30, color: '#2f46c7', weight: 600 },
    { text: input.demo ? demoNotice : 'AI 辅助表达 · 请核对后再使用', size: 48, line: 72, gap: 32, color: '#5c6472', weight: 500 },
    ...(input.result.risk === 'caution' ? [{ text: `风险提醒：${input.result.note}`, size: 48, line: 76, gap: 36, color: '#8e2e23', weight: 500 }] : []),
    { text: `换个说法 · ${toneLabels[input.tone]}版`, size: 44, line: 66, gap: 8, color: '#2f46c7', weight: 500 },
    { text: input.result.rewrites[input.tone], size: 72, line: 108, gap: 46, color: '#202735', weight: 550 },
    ...(input.tone === 'humor' ? [{ text: humorNotice, size: 48, line: 72, gap: 34, color: '#5c6472', weight: 400 }] : []),
    ...(input.hideOriginal
      ? [{ text: hiddenOriginalNotice, size: 48, line: 72, gap: 34, color: '#5c6472', weight: 400 }]
      : [
        { text: '我本来想说', size: 44, line: 66, gap: 8, color: '#5c6472', weight: 400 },
        { text: input.original, size: 52, line: 82, gap: 34, color: '#5c6472', weight: 400 },
      ]),
    { text: '仅供表达参考 · 不作事实判断', size: 48, line: 72, gap: 8, color: '#202735', weight: 500 },
    { text: '分享前检查整张卡片的敏感信息', size: 44, line: 66, gap: 0, color: '#5c6472', weight: 400 },
  ];
  const layouts = blocks.map((block) => {
    ctx.font = `${block.weight} ${block.size}px ${font}`;
    return { ...block, lines: wrapText(block.text, (text) => ctx.measureText(text).width, shareTextWidth) };
  });
  canvas.width = 1080;
  canvas.height = 76 + layouts.reduce((sum, block) => sum + block.lines.length * block.line + block.gap, 0) + 76;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.textAlign = 'left';
  let y = 76;
  for (const block of layouts) {
    if (block.size === 72) {
      ctx.strokeStyle = '#2f46c7'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(60, y + 12); ctx.lineTo(44, y + 12); ctx.lineTo(44, y + block.lines.length * block.line); ctx.lineTo(60, y + block.lines.length * block.line); ctx.stroke();
    }
    ctx.font = `${block.weight} ${block.size}px ${font}`; ctx.fillStyle = block.color;
    for (const line of block.lines) { ctx.fillText(line, 76, y + block.size); y += block.line; }
    y += block.gap;
  }
  const data = canvas.toDataURL('image/png');
  if (!data.startsWith('data:image/png;base64,')) throw new Error('CANVAS_EXPORT_UNAVAILABLE');
  return data;
}
