export type Measure = (text: string, fontSize: number) => number;

export interface FitOptions {
  maxWidth: number;
  baseSize: number;
  minSize: number;
  step?: number;
}

export interface FitResult {
  fontSize: number;
  lines: string[];
  wrapped: boolean;
}

function wrapLine(line: string, size: number, maxWidth: number, measure: Measure): string[] {
  const tokens = Array.from(line.matchAll(/[A-Za-z0-9]+(?:[～~–.-][A-Za-z0-9]+)*|[\s\S]/gu), (match) => match[0]);
  const chars = tokens.flatMap((token) => measure(token, size) > maxWidth ? Array.from(token) : [token]);
  const out: string[] = [];
  let current = '';
  for (const ch of chars) {
    const next = current + ch;
    if (current && measure(next, size) > maxWidth) {
      const previous = Array.from(current);
      const tail = previous.pop()!;
      if (/^[，。；：、？！）》】]$/.test(ch) && previous.length && measure(tail + ch, size) <= maxWidth) {
        out.push(previous.join(''));
        current = tail + ch;
      } else {
        out.push(current);
        current = ch;
      }
    } else {
      current = next;
    }
  }
  if (current) out.push(current);
  return out;
}

/** 先整体缩字号到 minSize；仍超宽才逐行折行，保证每行宽度不超过 maxWidth */
export function fitLines(lines: string[], measure: Measure, opts: FitOptions): FitResult {
  const step = opts.step ?? 4;
  for (let size = opts.baseSize; size >= opts.minSize; size -= step) {
    if (lines.every((l) => measure(l, size) <= opts.maxWidth)) {
      return { fontSize: size, lines: [...lines], wrapped: false };
    }
  }
  const size = opts.minSize;
  if (lines.every((line) => measure(line, size) <= opts.maxWidth)) {
    return { fontSize: size, lines: [...lines], wrapped: false };
  }
  return {
    fontSize: size,
    lines: lines.flatMap((l) => wrapLine(l, size, opts.maxWidth, measure)),
    wrapped: true,
  };
}

export function layoutCommunication(lines: string[], measure: Measure, maxWidth: number) {
  const body = fitLines(lines, measure, { maxWidth, baseSize: lines.length <= 2 ? 112 : 96, minSize: 84 });
  const lineHeight = body.fontSize + 32;
  const startY = Math.round((124 + 574 - ((body.lines.length - 1) * lineHeight + body.fontSize)) / 2);
  const ruleY = startY + (body.lines.length - 1) * lineHeight + body.fontSize + 64;
  return { ...body, startY, lineHeight, ruleY };
}

export function fillSalutation(line: string, salutation: string): string {
  return line.split('{称呼}').join(salutation);
}

export function sanitizeSalutation(input: string, maxChars: number): string {
  return Array.from(input.replace(/[\s{}<>]/g, '')).slice(0, maxChars).join('');
}
