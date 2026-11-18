const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('zh', { granularity: 'word' }) : null;
const trailing = /^[\s，。？！、；：）」』”’…—,.?!;:)]+$/u;
const leading = /^[（「『“‘(]+$/u;
const MAX_GROUP = 5;

// Groups runs of single-character segments so short phrases like “一会儿” are never split across lines.
export function phraseChunks(text: string): string[] | null {
  if (!segmenter) return null;
  const chunks: string[] = [];
  let carry = '';
  let grouping = false;
  for (const { segment } of segmenter.segment(text)) {
    if (trailing.test(segment) && chunks.length) {
      chunks[chunks.length - 1] += segment;
      grouping = false;
      continue;
    }
    if (leading.test(segment)) {
      carry += segment;
      continue;
    }
    const piece = carry + segment;
    carry = '';
    const last = chunks.length - 1;
    if (segment.length === 1 && grouping && chunks[last]!.length < MAX_GROUP) chunks[last] += piece;
    else {
      chunks.push(piece);
      grouping = segment.length === 1;
    }
  }
  if (carry) chunks.push(carry);
  const tail = chunks.at(-1);
  if (chunks.length > 1 && tail && tail.replace(/[\p{P}\s]/gu, '').length <= 1) chunks.splice(-2, 2, chunks.at(-2)! + tail);
  return chunks;
}
