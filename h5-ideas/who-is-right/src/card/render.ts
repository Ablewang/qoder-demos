import { fitLines, layoutCommunication } from './layout';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1440;
export const COMMUNICATION_CARD_HEIGHT = 720;

const FONT_FAMILY =
  '"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei",sans-serif';
const PADDING_X = 78;
const BODY_MAX_WIDTH = CARD_WIDTH - PADDING_X * 2;

export interface CardSpec {
  label?: string;
  record?: string;
  primaryLine?: number;
  checkedAt?: string;
  lines: string[];
  scopeNote?: string;
  sourceLine?: string;
  footer: string;
  brand: boolean;
}

function font(size: number, weight = 500): string {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

export function drawCard(canvas: HTMLCanvasElement, spec: CardSpec): void {
  canvas.width = CARD_WIDTH;
  canvas.height = spec.sourceLine ? CARD_HEIGHT : COMMUNICATION_CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持 Canvas 绘图');
  ctx.fillStyle = '#fafbf8';
  ctx.fillRect(0, 0, CARD_WIDTH, canvas.height);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const measure = (text: string, size: number) => {
    ctx.font = font(size);
    return ctx.measureText(text).width;
  };
  const text = (line: string, y: number, size: number, weight = 500, color = '#233c3c') => {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.fillText(line, PADDING_X, y);
  };
  const rule = (y: number) => {
    ctx.fillStyle = '#c9d0c9';
    ctx.fillRect(PADDING_X, y, BODY_MAX_WIDTH, 2);
  };

  text(spec.sourceLine ? `查证便条${spec.record ? ` / 条目 ${spec.record}` : ''}` : '附页 / 沟通便条', 64, 38, 400, '#53635e');
  if (spec.checkedAt) {
    ctx.font = font(32, 400);
    ctx.fillStyle = '#53635e';
    ctx.textAlign = 'right';
    ctx.fillText(`原文核对 ${spec.checkedAt}`, CARD_WIDTH - PADDING_X, 68);
    ctx.textAlign = 'left';
  }
  rule(124);

  if (spec.sourceLine) {
    if (spec.label) text(spec.label, 154, 42, 400, '#285d54');
    const scope = fitLines(spec.scopeNote ? [spec.scopeNote] : [], measure, { maxWidth: BODY_MAX_WIDTH, baseSize: 56, minSize: 56 });
    const source = fitLines([spec.sourceLine], measure, { maxWidth: BODY_MAX_WIDTH, baseSize: 56, minSize: 56 });
    const scopeHeight = spec.scopeNote ? 80 + scope.lines.length * 70 : 0;
    const sourceHeight = 82 + source.lines.length * 70;
    const bodyBottom = 1324 - scopeHeight - sourceHeight;
    const body = fitLines(spec.lines.slice(1), measure, { maxWidth: BODY_MAX_WIDTH, baseSize: 96, minSize: 72 });
    const lineHeight = Math.min(Math.round(body.fontSize * 1.25), (bodyBottom - 310) / Math.max(body.lines.length, 1));
    const salutation = fitLines(spec.lines.slice(0, 1), measure, { maxWidth: BODY_MAX_WIDTH, baseSize: 64, minSize: 64 });
    let y = 232;
    for (const line of salutation.lines) {
      text(line, y, salutation.fontSize, 400);
      y += 78;
    }
    for (const [i, line] of body.lines.entries()) {
      const primary = i === (spec.primaryLine ?? 1) - 1;
      text(line, y, primary ? body.fontSize : Math.min(body.fontSize, 76), primary ? 600 : 400);
      y += lineHeight;
    }
    y = bodyBottom + 22;
    if (spec.scopeNote) {
      rule(y);
      text('适用条件', y + 18, 38, 400, '#285d54');
      y += 80;
      for (const line of scope.lines) {
        text(line, y, scope.fontSize, 400, '#293432');
        y += 70;
      }
    }
    text('出处', y + 14, 38, 400, '#285d54');
    y += 82;
    for (const line of source.lines) {
      text(line, y, source.fontSize, 400);
      y += 70;
    }
  } else {
    const body = layoutCommunication(spec.lines, measure, BODY_MAX_WIDTH);
    let y = body.startY;
    for (const [i, line] of body.lines.entries()) {
      text(line, y, body.fontSize, i === 0 ? 600 : 400);
      y += body.lineHeight;
    }
    rule(body.ruleY);
  }

  const footerY = spec.sourceLine ? 1370 : 634;
  text(spec.footer, footerY, 34, 400, '#53635e');
  if (spec.brand) {
    ctx.font = font(32);
    ctx.fillStyle = '#285d54';
    ctx.textAlign = 'right';
    ctx.fillText('老话查一查', CARD_WIDTH - PADDING_X, spec.sourceLine ? 1406 : footerY);
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('图片导出失败'))), 'image/png');
  });
}
