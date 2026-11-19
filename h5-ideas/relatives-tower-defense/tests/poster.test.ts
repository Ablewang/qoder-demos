import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game, type Report } from '../src/engine';
import { chainLine, createPoster, BUBBLE, CHAIN, POSTER, posterCast } from '../src/poster';

type Draw = { value: string; x: number; y: number; size: number; rotated: boolean; width: number };

function mockCanvas(advance = 1) {
  const texts: Draw[] = [];
  let turns = 0;
  const stack: number[] = [];
  const sizeOf = (font: string) => Number(/ (\d+(?:\.\d+)?)px /.exec(font)![1]);
  const widthOf = (value: string, size: number) => Array.from(value).reduce((sum, char) => sum + size * (char.codePointAt(0)! > 255 ? advance : 0.55), 0);
  const ctx = {
    font: '400 10px sans-serif', fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, lineCap: 'butt', lineJoin: 'miter', textAlign: 'start', textBaseline: 'alphabetic',
    measureText: vi.fn((value: string) => { const width = widthOf(value, sizeOf(ctx.font)); return { width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width, actualBoundingBoxAscent: sizeOf(ctx.font) * 0.85, actualBoundingBoxDescent: sizeOf(ctx.font) * 0.1 }; }),
    fillText: vi.fn((value: string, x: number, y: number) => { const size = sizeOf(ctx.font); texts.push({ value, x, y, size, rotated: turns > 0, width: widthOf(value, size) }); }),
    fillRect: vi.fn(), strokeRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
    save: vi.fn(() => stack.push(turns)), restore: vi.fn(() => { turns = stack.pop()!; }),
    translate: vi.fn(), scale: vi.fn(), rotate: vi.fn((angle: number) => { if (angle) turns++; }),
  };
  const canvas = { width: 300, height: 150, getContext: vi.fn(() => ctx), toDataURL: vi.fn(() => 'data:image/png;base64,bW9jaw==') };
  vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });
  vi.stubGlobal('Path2D', class { constructor(_d: string) { /* path recorded by stroke mocks */ } });
  return { ctx, canvas, texts };
}

function finish(ids: string[], leave = false): Report {
  const g = new Game();
  for (const id of ids) { g.choose(id); g.advance(); }
  if (leave) g.leave();
  return g.report!;
}

const routes: [string, Report][] = [
  ['鱼塘获胜', finish(['ask-nainai', 'fishpond', 'ask-erjiu', 'ask-help', 'small-goal'])],
  ['表姐同盟', finish(['ask-sangu', 'cover-biaojie', 'lottery', 'ask-help', 'biaojie-team', 'both-plan'])],
  ['被围住', finish(['ask-sangu', 'eat-quietly', 'lottery'])],
  ['厨房离席', finish(['honest-sangu', 'own-plan', 'ask-erjiu'], true)],
  ['开局即离席', finish([], true)],
  ['七步保留细节', finish(['ask-sangu', 'cover-biaojie', 'lottery', 'ask-help', 'biaojie-team', 'listen-cousin', 'keep-private'])],
];

afterEach(() => vi.unstubAllGlobals());

describe('本局回放图（mock 的文字度量，非截图验收）', () => {
  it.each(routes)('%s：1080×1440 PNG，标题、结局、台词和每一步接话都画全且不出界', (_name, report) => {
    const mock = mockCanvas();
    const result = createPoster(report);
    expect(result).toEqual({ dataUrl: 'data:image/png;base64,bW9jaw==', fileName: '亲戚防御塔-这一桌.png' });
    expect([mock.canvas.width, mock.canvas.height]).toEqual([POSTER.width, POSTER.height]);
    expect(mock.texts.filter(draw => draw.value === report.title)).toHaveLength(1);
    const label = { won: '安稳吃完', piled: '被全桌围住', left: '提前离席' }[report.ending];
    expect(mock.texts.some(draw => draw.value === `${label} · 吃完 ${report.dishes}/3 道菜`)).toBe(true);
    const chain = mock.texts.filter(draw => !draw.rotated && draw.y > CHAIN.top && draw.y <= CHAIN.bottom).map(draw => draw.value).join('');
    if (report.turns.length) {
      expect(chain).toBe(report.turns.map(chainLine).join(''));
      expect(mock.texts.some(draw => draw.rotated && draw.value === '最后我这样说')).toBe(true);
      const bubble = mock.texts.filter(draw => draw.rotated && draw.value !== '最后我这样说' && draw.y > 640).map(draw => draw.value).join('');
      expect(bubble).toBe(`「${report.turns[report.turns.length - 1].line}」`);
    } else {
      expect(chain).toBe('还没出手就离席了。下一桌慢慢来。');
      expect(mock.texts.filter(draw => draw.rotated && draw.value !== '这局没开口').map(draw => draw.value).join('')).toBe('还没开口，就先离席了。');
    }
    for (const draw of mock.texts.filter(item => !item.rotated)) {
      expect(draw.x).toBeGreaterThanOrEqual(POSTER.titleLeft);
      expect(draw.x + draw.width).toBeLessThanOrEqual(POSTER.right + 0.001);
      expect(draw.y).toBeLessThan(POSTER.height);
    }
  });

  it('台词和接话摘要的标点不单独起行，全文仍完整且不超宽', () => {
    const cases = [routes[0][1], routes[1][1], routes[3][1], finish(['honest-sangu', 'ask-dayi', 'lottery', 'ask-help', 'erjiu-help', 'keep-private'])];
    for (const report of cases) {
      const mock = mockCanvas();
      createPoster(report);
      const bubble = mock.texts.filter(draw => draw.rotated && draw.value !== '最后我这样说' && draw.y > 640);
      expect(bubble.map(draw => draw.value).join('')).toBe(`「${report.turns[report.turns.length - 1].line}」`);
      expect(bubble.length).toBeGreaterThan(1);
      for (const draw of bubble) {
        expect(draw.value).not.toMatch(/^[，。！？、：；）」』】〕〉》…,.!?;:)\]}]/u);
        expect(draw.width).toBeLessThanOrEqual(BUBBLE.width - BUBBLE.padding * 2);
      }
      const chain = mock.texts.filter(draw => !draw.rotated && draw.y > CHAIN.top && draw.y <= CHAIN.bottom);
      expect(chain.map(draw => draw.value).join('')).toBe(report.turns.map(chainLine).join(''));
      for (const draw of chain) expect(draw.value).not.toMatch(/^[，。！？、：；）」』】〕〉》…,.!?;:)\]}]/u);
      vi.unstubAllGlobals();
    }
  });

  it('摘要每步写明菜名、策略、意图和接话人', () => {
    const report = routes[0][1];
    expect(chainLine(report.turns[0])).toBe('凉菜开席｜请人接话：请奶奶接话，把话头引到年菜 → 奶奶、三姑、二舅接话');
  });

  it('画面人物取帮手与最后开口的人，且不重复', () => {
    for (const [, report] of routes) {
      const [left, right] = posterCast(report);
      expect(left).not.toBe(right);
    }
    expect(posterCast(routes[0][1])).toEqual(['erjiu', 'dayi']);
  });

  it('字体偏宽时自动缩小而不是截断；连 2 倍宽都放不下才报错', () => {
    const wide = mockCanvas(1.3);
    createPoster(routes[1][1]);
    expect(wide.texts.find(draw => draw.value === routes[1][1].title)!.size).toBeLessThan(POSTER.titleMax);
    vi.unstubAllGlobals();
    mockCanvas(3);
    expect(() => createPoster(routes[1][1])).toThrow(/无法完整绘制/);
  });

  it('不支持 2D 画布时给出可读错误', () => {
    const mock = mockCanvas();
    mock.canvas.getContext.mockReturnValue(null as never);
    expect(() => createPoster(routes[0][1])).toThrow('浏览器暂不支持图片绘制');
  });
});
