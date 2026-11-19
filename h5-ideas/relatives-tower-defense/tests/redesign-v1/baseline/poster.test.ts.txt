import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Report, TurnResult } from '../src/engine';
import { BUBBLE, createPoster, POSTER, secondStat } from '../src/poster';
import { questions, relatives } from '../src/content';

// 两个实际结果标题；长称号仅作布局边界 fixture，非游戏实际称号。
const titles = ['这桌饭，吃完了', '先去厨房歇一歇'];
const fontProfiles = [
  { name: '常规中文字形', ascent: 0.84, descent: 0.08, advance: 1, left: -0.025, right: -0.065 },
  { name: '含左右出锋的字形', ascent: 0.91, descent: 0.15, advance: 1.04, left: 0.045, right: 0.015 },
  { name: '较高的回退字形', ascent: 0.98, descent: 0.18, advance: 1, left: 0.02, right: -0.035 },
];
type FontProfile = typeof fontProfiles[number];
type GlyphMetrics = Pick<TextMetrics, 'width' | 'actualBoundingBoxLeft' | 'actualBoundingBoxRight' | 'actualBoundingBoxAscent' | 'actualBoundingBoxDescent'>;
type TextDraw = { value: string; x: number; y: number; font: string; size: number; metrics: GlyphMetrics; rotated: boolean; align: string; baseline: string };
const longQuote = '能认真把日子过好，就已经是很好的答案了，大家也放心吧，我会照顾好自己的每一天';

function turnFor(turn: number, changes: Partial<TurnResult> = {}): TurnResult {
  const question = changes.question ?? (turn === 8 ? questions.find(value => value.kind === 'boss')! : questions[0]);
  const card = changes.card ?? 'taiji';
  const quote = changes.quote ?? question.answers[card];
  return {
    turn, question, asker: question.askers[0], basePressure: 2, pressure: 2,
    incoming: null, card, quote, reply: quote, blocked: 2, loss: 0,
    moodBefore: 5, moodAfter: 5, next: null, ...changes,
  };
}

function reportFor(title = titles[0], won = true, quote = questions[0].answers.taiji): Report {
  const history: TurnResult[] = [
    turnFor(1, { quote, reply: quote, blocked: 1, loss: 1, moodBefore: 6 }),
    turnFor(2, { card: 'sincere', next: { kind: 'ally', asker: 'erjiu', amount: 1 } }),
    turnFor(3, { incoming: { kind: 'ally', asker: 'erjiu', amount: 1 }, pressure: 1, blocked: 1 }),
    turnFor(4),
    turnFor(5),
    turnFor(6, { card: 'counter', next: { kind: 'followup', asker: questions[0].askers[0], amount: 1 } }),
    turnFor(7, { incoming: { kind: 'followup', asker: questions[0].askers[0], amount: 1 }, basePressure: 1, blocked: 1, loss: 1, moodAfter: 4 }),
    turnFor(8, { basePressure: 4, pressure: 4, blocked: won ? 4 : 0, loss: won ? 0 : 4, moodBefore: 4, moodAfter: won ? 4 : 0 }),
  ];
  return {
    won, reason: '海报单测', title, identity: 'single', mood: history[7].moodAfter, turns: history.length,
    blocked: history.filter(turn => turn.loss === 0).length, counters: 1, sincere: 1, allies: 1,
    history, highlights: [history[2], history[5], history[7]], quotes: history.map(turn => turn.quote),
    lines: ['完成问数 8/8', `心态 ${history[7].moodAfter}/6`],
  };
}

function unplayedReport(): Report {
  return {
    won: false, reason: '尚未出牌就离席', title: titles[1], identity: 'single', mood: 6, turns: 0,
    blocked: 0, counters: 0, sincere: 0, allies: 0, history: [], highlights: [], quotes: [], lines: [],
  };
}

function mockCanvas(profile: FontProfile = fontProfiles[0]) {
  const texts: TextDraw[] = [];
  const paths: string[] = [];
  const fills: { x: number; y: number; width: number; height: number; color: string; rotated: boolean }[] = [];
  const exports: { mime: string; width: number; height: number }[] = [];
  let depth = 0;
  let turns = 0;
  const turnStack: number[] = [];
  const sizeOf = (font: string) => {
    const match = / (\d+(?:\.\d+)?)px /.exec(font);
    if (!match) throw new Error(`Unexpected canvas font: ${font}`);
    return Number(match[1]);
  };
  const metricsFor = (value: string, size: number): GlyphMetrics => {
    const width = Array.from(value).reduce((total, char) => total + size * (char.codePointAt(0)! > 255 ? profile.advance : 0.55), 0);
    return { width, actualBoundingBoxLeft: size * profile.left, actualBoundingBoxRight: width + size * profile.right, actualBoundingBoxAscent: size * profile.ascent, actualBoundingBoxDescent: size * profile.descent };
  };
  const ctx = {
    font: '400 10px sans-serif', fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, lineCap: 'butt', lineJoin: 'miter',
    textAlign: 'start', textBaseline: 'alphabetic',
    measureText: vi.fn((value: string) => metricsFor(value, sizeOf(ctx.font))),
    fillText: vi.fn((value: string, x: number, y: number) => {
      const size = sizeOf(ctx.font);
      texts.push({ value, x, y, font: ctx.font, size, metrics: metricsFor(value, size), rotated: turns > 0, align: ctx.textAlign, baseline: ctx.textBaseline });
    }),
    fillRect: vi.fn((x: number, y: number, width: number, height: number) => fills.push({ x, y, width, height, color: ctx.fillStyle, rotated: turns > 0 })),
    strokeRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
    save: vi.fn(() => { depth++; turnStack.push(turns); }),
    restore: vi.fn(() => { depth--; turns = turnStack.pop()!; }),
    translate: vi.fn(), scale: vi.fn(),
    rotate: vi.fn((angle: number) => { if (angle) turns++; }),
    drawImage: vi.fn(),
  };
  const dataUrl = 'data:image/png;base64,cG9zdGVyLW1vY2s=';
  const canvas = {
    width: 300, height: 150,
    getContext: vi.fn((kind: string) => kind === '2d' ? ctx : null),
    toDataURL: vi.fn((mime: string) => { exports.push({ mime, width: canvas.width, height: canvas.height }); return dataUrl; }),
  };
  const createElement = vi.fn((tag: string) => {
    if (tag !== 'canvas') throw new Error(`Unexpected element: ${tag}`);
    return canvas;
  });
  vi.stubGlobal('document', { createElement });
  vi.stubGlobal('Path2D', class { constructor(d: string) { paths.push(d); } });
  return { ctx, canvas, createElement, texts, paths, fills, exports, dataUrl, depth: () => depth };
}

function bounds(draw: TextDraw) {
  return { left: draw.x - draw.metrics.actualBoundingBoxLeft, right: draw.x + draw.metrics.actualBoundingBoxRight, top: draw.y - draw.metrics.actualBoundingBoxAscent, bottom: draw.y + draw.metrics.actualBoundingBoxDescent };
}
const find = (mock: ReturnType<typeof mockCanvas>, value: string) => mock.texts.filter(draw => draw.value === value);
const summaryDraws = (mock: ReturnType<typeof mockCanvas>) => mock.texts.filter(draw => !draw.rotated && draw.y > 1212 && draw.y < 1370);
function summaries(mock: ReturnType<typeof mockCanvas>): string[] {
  const values: string[] = [];
  for (const draw of summaryDraws(mock)) {
    if (/^第\d+问：/.test(draw.value)) values.push(draw.value);
    else values[values.length - 1] += draw.value;
  }
  return values;
}

afterEach(() => vi.unstubAllGlobals());

const cases = fontProfiles.flatMap(profile => titles.map((title, index) => ({ profile, fontName: profile.name, title, won: index % 2 === 0 })));

describe('桌边漫画战报 canvas 布局（mock 的 TextMetrics，非截图验收）', () => {
  it.each(cases)('$fontName / $title：称号字形在左右边距内、位于品牌行与红线之间', ({ profile, title, won }) => {
    const mock = mockCanvas(profile);
    const report = reportFor(title, won);
    const result = createPoster(report, report.quotes[0], { cast: ['erjiu', 'nainai'], identity: '未婚打工人', card: 'counter' });
    const draws = find(mock, title);
    expect(draws).toHaveLength(1);
    const titleDraw = draws[0];
    const glyph = bounds(titleDraw);
    expect(titleDraw.rotated).toBe(false);
    expect(titleDraw.align).toBe('left');
    expect(titleDraw.baseline).toBe('alphabetic');
    expect(titleDraw.font).toMatch(/^700 /);
    expect(titleDraw.size).toBe(POSTER.titleMax);
    expect(glyph.left).toBeCloseTo(POSTER.titleLeft, 8);
    expect(glyph.right).toBeLessThanOrEqual(POSTER.right);
    const brand = mock.texts.find(draw => draw.value.startsWith('过年亲戚防御塔 / '))!;
    expect(brand.value).toBe(`过年亲戚防御塔 / ${won ? '好好吃完这顿饭' : '自己的节奏，自己定'}`);
    expect(bounds(brand).bottom).toBeLessThan(glyph.top);
    const underline = mock.fills.find(fill => fill.color === '#b94c38' && fill.height === 8)!;
    expect(underline.y).toBeGreaterThan(glyph.bottom);
    expect(result).toEqual({ dataUrl: mock.dataUrl, fileName: '亲戚防御塔-年夜饭战报.png' });
    expect(mock.exports).toEqual([{ mime: 'image/png', width: 1080, height: 1440 }]);
    expect(mock.createElement).toHaveBeenCalledExactlyOnceWith('canvas');
    expect(mock.fills[0]).toEqual({ x: 0, y: 0, width: 1080, height: 1440, color: '#fff5df', rotated: false });
    expect(mock.ctx.drawImage).not.toHaveBeenCalled();
    expect(mock.paths.length).toBeGreaterThan(50);
    expect(mock.depth()).toBe(0);
    expect(find(mock, '未婚打工人 · 入席')).toHaveLength(1);
    expect(find(mock, `完成问数 ${report.turns}/8`)).toHaveLength(1);
    const mood = find(mock, `心态 ${report.mood}/6`)[0];
    expect(bounds(mood).right).toBeCloseTo(POSTER.right, 8);
    expect(find(mock, '未扣心态')).toHaveLength(1);
    expect(find(mock, '反问')).toHaveLength(2); // 统计标签及实际出牌图标。
    for (const draw of mock.texts.filter(item => !item.rotated)) {
      const box = bounds(draw);
      expect(box.left).toBeGreaterThanOrEqual(POSTER.titleLeft - 1e-8);
      expect(box.right).toBeLessThanOrEqual(POSTER.right + 1e-8);
    }
    expect(mock.texts.some(draw => draw.value === '本地试玩 · 未发布')).toBe(true);
  });

  it('超长称号按测量缩小到不越界，且不小于下限', () => {
    const mock = mockCanvas(fontProfiles[1]);
    const report = reportFor('家族和平大使兼边界守护者');
    createPoster(report, report.quotes[0]);
    const draw = find(mock, report.title)[0];
    expect(draw.size).toBeLessThan(POSTER.titleMax);
    expect(draw.size).toBeGreaterThanOrEqual(POSTER.titleMin);
    expect(bounds(draw).left).toBeCloseTo(POSTER.titleLeft, 8);
    expect(bounds(draw).right).toBeLessThanOrEqual(POSTER.right);
  });

  it.each(fontProfiles)('$name：长引用按气泡内宽换行，最多三行，不溢出', profile => {
    const mock = mockCanvas(profile);
    const report = reportFor(titles[0], true, longQuote);
    createPoster(report, longQuote);
    const label = find(mock, '这局我这样说')[0];
    const quoteLines = mock.texts.filter(draw => draw.rotated && draw.y > label.y && draw.x === label.x);
    expect(quoteLines.length).toBeGreaterThan(1);
    expect(quoteLines.length).toBeLessThanOrEqual(BUBBLE.maxLines);
    for (const draw of quoteLines) expect(draw.metrics.width).toBeLessThanOrEqual(BUBBLE.width - BUBBLE.padding * 2 + 1e-8);
    const joined = quoteLines.map(draw => draw.value).join('');
    expect(joined).toBe(longQuote);
  });

  it('短引用布局 fixture 一行放下且原样保留', () => {
    const mock = mockCanvas();
    const quote = '先好好吃饭。';
    createPoster(reportFor(titles[0], true, quote), quote);
    expect(find(mock, quote)).toHaveLength(1);
  });

  it.each(fontProfiles)('$name：题库全部回答在气泡内完整保留，不省略引用', profile => {
    for (const quote of new Set(questions.flatMap(question => Object.values(question.answers)))) {
      const mock = mockCanvas(profile);
      createPoster(reportFor(titles[0], true, quote), quote);
      const label = find(mock, '这局我这样说')[0];
      const lines = mock.texts.filter(draw => draw.rotated && draw.y > label.y && draw.x === label.x);
      expect(lines.map(draw => draw.value).join('')).toBe(quote);
      expect(lines.length).toBeLessThanOrEqual(BUBBLE.maxLines);
      expect(lines.every(draw => draw.size === BUBBLE.size)).toBe(true);
      expect(lines.every(draw => draw.metrics.width <= BUBBLE.width - BUBBLE.padding * 2)).toBe(true);
    }
  });

  it.each([undefined, false, true])('0 问离席不伪称已出牌，spoken=%s', spoken => {
    const mock = mockCanvas();
    createPoster(unplayedReport(), '先好好吃饭。', { spoken });
    expect(find(mock, '离席时想说')).toHaveLength(1);
    expect(find(mock, '这局我这样说')).toHaveLength(0);
    expect(find(mock, '太极')).toHaveLength(0);
    expect(find(mock, '完成问数 0/8')).toHaveLength(1);
    expect(find(mock, '心态 6/6')).toHaveLength(1);
    expect(summaries(mock)).toEqual([]);
  });

  it('显式未说出口不展示出牌图标', () => {
    const mock = mockCanvas();
    createPoster(reportFor(), questions[0].answers.taiji, { spoken: false });
    expect(find(mock, '离席时想说')).toHaveLength(1);
    expect(find(mock, '这局我这样说')).toHaveLength(0);
    expect(find(mock, '太极')).toHaveLength(0);
  });

  it('出牌图标默认对应所选真实引用，而不是固定太极', () => {
    const mock = mockCanvas();
    const report = reportFor();
    const turn = report.history[5];
    createPoster(report, turn.quote);
    expect(find(mock, '反问')).toHaveLength(2);
    expect(find(mock, '太极')).toHaveLength(0);
  });

  it('第二枚标签只使用实际反问、真心及已兑现帮腔数', () => {
    expect(secondStat(reportFor())).toEqual({ label: '反问', value: 1, unit: '次' });
    expect(secondStat({ ...reportFor(), counters: 0 })).toEqual({ label: '真心', value: 1, unit: '次' });
    expect(secondStat({ ...reportFor(), counters: 0, sincere: 0 })).toEqual({ label: '帮腔兑现', value: 1, unit: '次' });
    expect(secondStat(unplayedReport())).toEqual({ label: '帮腔兑现', value: 0, unit: '次' });
  });

  it.each([true, false])('8 问显示实心态且不出现分数、签级或撑几天，won=%s', won => {
    const mock = mockCanvas();
    const report = reportFor(won ? titles[0] : titles[1], won);
    createPoster(report, report.quotes[0]);
    expect(find(mock, '完成问数 8/8')).toHaveLength(1);
    expect(find(mock, `心态 ${won ? 4 : 0}/6`)).toHaveLength(1);
    expect(mock.texts.map(draw => draw.value).join('\n')).not.toMatch(/\d+\s*分|评分|分数|上签|下签|下下签|签级|撑|\d+\s*天|暴击|被问住|undefined|NaN/);
    expect(find(mock, '本地试玩 · 未发布')).toHaveLength(1);
    expect(find(mock, '无二维码 · 不上传')).toHaveLength(1);
  });

  it('3 条关键因果来自 highlights，按原顺序且使用真实数值', () => {
    const mock = mockCanvas();
    const report = reportFor();
    report.lines = ['不可使用的故事'];
    Object.freeze(report.highlights);
    createPoster(report, report.quotes[0]);
    expect(summaries(mock)).toEqual([
      '第3问：二舅兑现帮腔，少1点压力',
      '第6问：反问接住；第7问已追问+1压力',
      '第8问：压轴接完，心态还剩4格',
    ]);
    expect(mock.texts.some(draw => draw.value.includes('不可使用的故事'))).toBe(false);
  });

  it('兑现追问与实际扣心态不写成接住，压轴失败使用实际剩余值', () => {
    const mock = mockCanvas();
    const report = reportFor(titles[1], false);
    report.highlights = [report.history[6], report.history[7]];
    createPoster(report, report.quotes[0]);
    expect(summaries(mock)).toEqual([
      `第7问：${relatives[questions[0].askers[0]].name}追问兑现，压力+1；太极回应，心态扣1格、剩4格`,
      '第8问：太极回应，心态扣4格、剩0格',
    ]);
    expect(summaries(mock).join('')).not.toContain('接住');
    expect(summaries(mock).join('')).not.toContain('压轴接完');
  });

  it('尚未兑现的追问只写下一问，不能凭 next 增加已兑现帮腔', () => {
    const mock = mockCanvas();
    const report = reportFor();
    report.history = report.history.slice(0, 6);
    report.turns = 6;
    report.won = false;
    report.title = titles[1];
    report.mood = 5;
    report.blocked = 5;
    report.highlights = [report.history[5]];
    report.quotes = report.history.map(turn => turn.quote);
    createPoster(report, report.quotes[0]);
    expect(summaries(mock)).toEqual(['第6问：反问接住；下一问追问+1（待兑现）']);
    expect(summaries(mock).join('')).not.toContain('追问兑现');
    expect(find(mock, '完成问数 6/8')).toHaveLength(1);
    expect(find(mock, '心态 5/6')).toHaveLength(1);
    expect(report.allies).toBe(1);
  });

  it.each(fontProfiles)('$name：三条长因果按测量缩字或换行，完整保留、无字形越界或互相覆盖', profile => {
    const mock = mockCanvas(profile);
    const history = Array.from({ length: 6 }, (_, index) => {
      const turn = index + 1;
      const sincere = turn % 2 === 0;
      const moodBefore = index === 0 ? 6 : 5 - Math.floor(index / 2);
      const loss = sincere || turn === 1 ? 1 : 0;
      return turnFor(turn, {
        card: sincere ? 'sincere' : 'counter',
        incoming: turn === 1 ? null : { kind: sincere ? 'followup' : 'ally', asker: 'wangayi', amount: 1 },
        next: { kind: sincere ? 'ally' : 'followup', asker: 'wangayi', amount: 1 },
        basePressure: 2, pressure: sincere ? 3 : turn === 1 ? 2 : 1,
        blocked: sincere ? 2 : 1, loss, moodBefore, moodAfter: moodBefore - loss,
      });
    });
    const report: Report = {
      won: false, reason: '主动离席', title: titles[1], identity: 'single', turns: 6, mood: 2,
      blocked: 2, counters: 3, sincere: 3, allies: 2, history,
      highlights: [history[1], history[3], history[5]], quotes: history.map(turn => turn.quote), lines: [],
    };
    createPoster(report, report.quotes[0]);
    expect(summaries(mock)).toEqual([2, 4, 6].map((turn, index) =>
      `第${turn}问：王阿姨追问兑现，压力+1；真心回应，心态扣1格、剩${4 - index}格；${turn < 6 ? `第${turn + 1}问已帮腔-1压力` : '下一问王阿姨帮腔-1压力（待兑现）'}`, 
    ));
    const draws = summaryDraws(mock);
    expect(draws.length).toBeGreaterThanOrEqual(3);
    expect(draws.length > 3 || draws.some(draw => draw.size < 30)).toBe(true);
    expect(mock.ctx.measureText).toHaveBeenCalled();
    const statsBottom = Math.max(...find(mock, '完成问数 6/8').map(draw => bounds(draw).bottom));
    const footerTop = bounds(find(mock, '本地试玩 · 未发布')[0]).top;
    for (const [index, draw] of draws.entries()) {
      const box = bounds(draw);
      expect(draw.size).toBeGreaterThanOrEqual(20);
      expect(box.left).toBeGreaterThanOrEqual(POSTER.left);
      expect(box.right).toBeLessThanOrEqual(POSTER.right);
      expect(box.top).toBeGreaterThan(statsBottom);
      expect(box.bottom).toBeLessThan(footerTop);
      if (index) expect(box.top).toBeGreaterThan(bounds(draws[index - 1]).bottom);
    }
  });

  it('canvas 无 2d 上下文时抛错，不返回假图片', () => {
    const mock = mockCanvas();
    mock.canvas.getContext.mockReturnValue(null);
    expect(() => createPoster(reportFor(), questions[0].answers.taiji)).toThrow('浏览器暂不支持图片绘制');
    expect(mock.canvas.toDataURL).not.toHaveBeenCalled();
  });

  it.each(['data:,', 'data:image/jpeg;base64,eA==', ''])('导出非 PNG dataURL 时抛错：%s', value => {
    const mock = mockCanvas();
    mock.canvas.toDataURL.mockReturnValue(value);
    expect(() => createPoster(reportFor(), questions[0].answers.taiji)).toThrow('图片生成失败，请重试');
    expect(mock.canvas.toDataURL).toHaveBeenCalledWith('image/png');
  });

  it('canvas 导出异常原样抛出，不降级成成功', () => {
    const mock = mockCanvas();
    const error = new Error('canvas export failed');
    mock.canvas.toDataURL.mockImplementation(() => { throw error; });
    expect(() => createPoster(reportFor(), questions[0].answers.taiji)).toThrow(error);
  });
});
