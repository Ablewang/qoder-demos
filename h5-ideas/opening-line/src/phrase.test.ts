import { afterEach, describe, expect, it, vi } from 'vitest';
import { templates } from './content';
import { phraseChunks } from './phrase';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('Chinese phrase chunks', () => {
  it('preserves every character in all 38 scripts', () => {
    expect(templates).toHaveLength(38);
    for (const template of templates) {
      for (const text of Object.values(template.lines)) {
        const chunks = phraseChunks(text)!;
        expect(chunks.join('')).toBe(text);
        expect(chunks.every((chunk) => !/^[，。？！、；：）」』”’…,.?!;:)]/u.test(chunk))).toBe(true);
      }
    }
  });

  it('keeps 一会儿 intact and avoids a one-character final chunk', () => {
    expect(phraseChunks('现在方便听我说一会儿吗？')!.some((chunk) => chunk.includes('一会儿'))).toBe(true);
    for (const text of ['不用先把话组织得很完美。', '有件事想问问你，不方便也可以直接说。']) {
      expect(phraseChunks(text)!.at(-1)!.replace(/[\p{P}\s]/gu, '').length).toBeGreaterThan(1);
      expect(phraseChunks(text)!.join('')).toBe(text);
    }
  });

  it('attaches brackets and punctuation without changing the text', () => {
    const text = '「你好，方便说一句吗？」（不急。）';
    const chunks = phraseChunks(text)!;
    expect(chunks.join('')).toBe(text);
    expect(chunks[0]).toMatch(/^「./u);
    expect(chunks.every((chunk) => !/^[，。？）」]/u.test(chunk))).toBe(true);
  });

  it('returns plain-text fallback when Segmenter is unavailable', async () => {
    vi.stubGlobal('Intl', {});
    const { phraseChunks: withoutSegmenter } = await import('./phrase');
    expect(withoutSegmenter('老师，现在方便吗？')).toBeNull();
  });
});
