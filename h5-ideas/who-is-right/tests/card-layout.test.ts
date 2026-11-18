import { describe, expect, it } from 'vitest';
import { library } from '../src/content/library';
import { MAX_SALUTATION_CHARS } from '../src/content/gate';
import { fillSalutation, fitLines, layoutCommunication, sanitizeSalutation, type Measure } from '../src/card/layout';
import { THANKS_TEMPLATES } from '../src/content/thanks';

// 中文字近似方块：宽度 = 字数 × 字号
const measure: Measure = (text, size) => Array.from(text).length * size;
const CARD_BODY = { maxWidth: 900, baseSize: 96, minSize: 72 };

describe('fitLines', () => {
  it('放得下时保持基础字号', () => {
    const r = fitLines(['九个字九个字九个'], measure, CARD_BODY);
    expect(r).toEqual({ fontSize: 96, lines: ['九个字九个字九个'], wrapped: false });
  });

  it('放不下时先缩字号，但不低于最小字号', () => {
    const r = fitLines(['十一个字十一个字十一'], measure, CARD_BODY);
    expect(r.fontSize).toBeLessThan(96);
    expect(r.fontSize).toBeGreaterThanOrEqual(72);
    expect(r.wrapped).toBe(false);
  });

  it('缩小步长不整除时也会先尝试最小字号，不会误折行', () => {
    const result = fitLines(['一'.repeat(12)], measure, { maxWidth: 900, baseSize: 96, minSize: 73 });
    expect(result.fontSize).toBe(73);
    expect(result.wrapped).toBe(false);
  });

  it('最小字号仍放不下才折行，且每行都不超宽', () => {
    const long = '一'.repeat(30);
    const r = fitLines([long], measure, CARD_BODY);
    expect(r.fontSize).toBe(72);
    expect(r.wrapped).toBe(true);
    expect(r.lines.join('')).toBe(long);
    for (const l of r.lines) expect(measure(l, 72)).toBeLessThanOrEqual(900);
  });
});

describe('适用范围折行', () => {
  it('年龄区间保持在同一行，文字不丢失', () => {
    const text = '来源是24～36月龄，年龄2～3岁。';
    const result = fitLines([text], measure, { maxWidth: 216, baseSize: 24, minSize: 24 });
    expect(result.lines.join('')).toBe(text);
    expect(result.lines.some(line => line.includes('24～36'))).toBe(true);
    expect(result.lines.some(line => line.includes('2～3'))).toBe(true);
    for (const line of result.lines) expect(measure(line, 24)).toBeLessThanOrEqual(216);
  });

  it('句末标点不落到新行开头，仍不超宽', () => {
    const text = '一二三四五六七八九，十。';
    const result = fitLines([text], measure, { maxWidth: 216, baseSize: 24, minSize: 24 });
    expect(result.lines.join('')).toBe(text);
    for (const line of result.lines) {
      expect(line).not.toMatch(/^[，。；：、？！）》】]/);
      expect(measure(line, 24)).toBeLessThanOrEqual(216);
    }
  });
});

describe('720 高沟通便条排版', () => {
  it.each(THANKS_TEMPLATES)('$id 四字称呼保留原文且适合短画幅', template => {
    const lines = template.lines.map(line => fillSalutation(line, '合成外婆'));
    const result = layoutCommunication(lines, measure, 924);
    expect(result.lines).toEqual(lines);
    expect(result.wrapped).toBe(false);
    expect(result.fontSize).toBeGreaterThanOrEqual(84);
    expect(result.startY).toBeGreaterThan(124);
    const lastBottom = result.startY + (result.lines.length - 1) * result.lineHeight + result.fontSize;
    expect(lastBottom).toBeLessThan(result.ruleY);
    expect(result.ruleY).toBeLessThan(634);
    for (const line of result.lines) expect(measure(line, result.fontSize)).toBeLessThanOrEqual(924);
  });
});

describe('称呼', () => {
  it('过滤空白和尖括号、花括号，并按字截断', () => {
    expect(sanitizeSalutation(' 外 婆<b> ', 4)).toBe('外婆b');
    expect(sanitizeSalutation('{称呼}大舅妈妈', 4)).toBe('称呼大舅');
    expect(sanitizeSalutation('😀😀😀😀😀', 4)).toBe('😀😀😀😀');
  });

  it('替换所有占位符', () => {
    expect(fillSalutation('{称呼}，{称呼}', '妈')).toBe('妈，妈');
  });
});

describe('真实卡片在最长称呼下不缩到最小字号以下、不折行', () => {
  const longest = '一'.repeat(MAX_SALUTATION_CHARS);
  const cards = [
    ...library.sayings.filter((s) => s.bigCard).map((s) => ({ id: s.id, lines: s.bigCard!.lines })),
    ...THANKS_TEMPLATES.map((t) => ({ id: `thanks:${t.id}`, lines: t.lines })),
  ];

  it.each(cards)('$id', ({ lines }) => {
    const filled = lines.map((l) => fillSalutation(l, longest));
    const r = fitLines(filled, measure, CARD_BODY);
    expect(r.wrapped).toBe(false);
    expect(r.fontSize).toBeGreaterThanOrEqual(72);
  });
});
