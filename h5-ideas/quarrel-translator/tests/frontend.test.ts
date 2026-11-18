import test from 'node:test';
import assert from 'node:assert/strict';
import { countChars, requestSchema, responseSchema, resultSchema, translationSchema } from '../src/contract.js';
import { demos } from '../src/demos.js';
import { createShareCard, demoNotice, hiddenOriginalNotice, shareTextWidth, wrapText } from '../src/share.js';

test('five explicit fixed demos conform to the output contract', () => {
  assert.equal(demos.length, 5);
  for (const demo of demos) {
    assert.ok(translationSchema.safeParse(demo.result).success);
    assert.ok(demo.result.heard_as.includes('可能'));
    assert.ok(requestSchema.safeParse({ version: 1, mode: 'soften', relation: demo.relation, text: demo.original }).success);
  }
});
test('Unicode character limit counts codepoints, not UTF-16 units', () => {
  assert.equal(countChars('你😀'), 2);
  assert.ok(requestSchema.safeParse({ version: 1, mode: 'soften', relation: 'friend', text: '😀'.repeat(300) }).success);
  assert.equal(requestSchema.safeParse({ version: 1, mode: 'soften', relation: 'friend', text: '😀'.repeat(301) }).success, false);
});
test('output does not accept missing tones, unknown content or unsafe partial crisis results', () => {
  const base = demos[0]!.result;
  assert.equal(resultSchema.safeParse({ ...base, rewrites: { gentle: '你好' } }).success, false);
  assert.equal(resultSchema.safeParse({ ...base, code: '<script>bad()</script>' }).success, false);
  assert.equal(resultSchema.safeParse({ kind: 'safety', category: 'self_harm', rewrites: base.rewrites }).success, false);
  assert.equal(resultSchema.safeParse({ ...base, risk: 'caution', note: '' }).success, false);
  assert.equal(responseSchema.safeParse({ version: 1, mode: 'soften', source: 'local_safety', result: base }).success, false);
});
test('share text wrapping preserves long content, graphemes and newlines', () => {
  const text = '原话'.repeat(150);
  const wrapped = wrapText(text, (s) => [...s].length * 10, 100);
  assert.equal(wrapped.join(''), text);
  assert.ok(wrapped.every((s) => [...s].length <= 10));
  assert.deepEqual(wrapText('a\n\nb', (s) => s.length, 10), ['a', '', 'b']);
  assert.deepEqual(wrapText('👍🏽你好', (s) => [...s].length * 10, 20), ['👍🏽', '你好']);
});

test('natural wrapping moves the preceding grapheme with closing punctuation, including the real demo boundary', () => {
  const heard = demos[0]!.result.heard_as;
  const prefix = heard.slice(0, heard.indexOf('。'));
  const measure = (text: string) => [...text].length * 48;
  const lines = wrapText(heard, measure, measure(prefix));
  assert.equal(lines[0], prefix.slice(0, -1));
  assert.equal(lines.join(''), heard);
  assert.ok(lines.every((line) => measure(line) <= measure(prefix) && !/^[。，、；：！？]/u.test(line)));
  const sentence = '甲'.repeat(12) + '。';
  const ending = wrapText(sentence, (text) => [...text].length * 72, shareTextWidth);
  assert.equal(ending.join(''), sentence);
  assert.ok(ending.every((line) => [...line].length * 72 <= shareTextWidth && line !== '。'));
});

test('natural breaks keep common closing marks off line heads and opening marks off line ends', () => {
  const measure = (text: string) => [...text].length * 10;
  for (const mark of '。，、；：！？…％）］｝】〕〉》」』〗〙〛’”,.;:!?%)]}') {
    const text = `甲乙丙丁${mark}戊己`;
    const lines = wrapText(text, measure, 40);
    assert.equal(lines.join(''), text);
    assert.ok(lines.every((line) => measure(line) <= 40 && !line.startsWith(mark)), text);
  }
  for (const pair of ['（）', '［］', '｛｝', '【】', '〔〕', '〈〉', '《》', '「」', '『』', '〖〗', '〘〙', '〚〛', '“”', '‘’', '()', '[]', '{}', '""', "''"]) {
    const text = `甲乙丙${pair[0]}丁戊${pair[1]}己庚`;
    const lines = wrapText(text, measure, 40);
    assert.equal(lines.join(''), text);
    assert.ok(lines.every((line) => measure(line) <= 40));
    let offset = 0;
    for (const line of lines.slice(0, -1)) {
      offset += [...line].length;
      assert.notEqual(offset, 4, `opening mark hangs: ${text}`);
      assert.notEqual(offset, 6, `closing mark starts a line: ${text}`);
    }
  }
  const consecutive = '甲乙丙丁？！）】戊己';
  const lines = wrapText(consecutive, measure, 60);
  assert.equal(lines.join(''), consecutive);
  assert.ok(lines.every((line) => measure(line) <= 60 && !/^[？！）】]/u.test(line)));
  for (const text of ['甲乙（ 丁戊）己庚', '甲乙丙丁 ）戊己']) {
    const spaced = wrapText(text, measure, 40);
    assert.equal(spaced.join(''), text);
    assert.ok(spaced.every((line) => measure(line) <= 40 && !/^\s*）/u.test(line) && !/（\s*$/u.test(line)));
  }
});

test('punctuation reflow preserves emoji clusters and every explicit paragraph break', () => {
  const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
  const segments = (text: string) => [...segmenter.segment(text)].map(({ segment }) => segment);
  const measure = (text: string) => segments(text).length * 10;
  const text = '👩🏽‍💻甲乙丙（丁戊）己！\n\n👨‍👩‍👧‍👦“甲乙丙丁。”尾';
  const lines = wrapText(text, measure, 40);
  assert.deepEqual(lines.flatMap(segments), segments(text.replaceAll('\n', '')));
  assert.ok(lines.every((line) => measure(line) <= 40 && !/^[。！）”]/u.test(line) && !/[（“]$/u.test(line)));
  assert.equal(lines.filter((line) => line === '').length, 1);
  assert.deepEqual(wrapText('甲。\n，乙', measure, 20), ['甲。', '，乙']);
  assert.deepEqual(wrapText('a\n\nb\n', measure, 20), ['a', '', 'b', '']);
  const apostrophe = "can't 'say this'";
  assert.equal(wrapText(apostrophe, measure, 60).join(''), apostrophe);
  const possessive = "dogs' '甲甲甲甲甲甲甲甲甲甲'乙";
  const proportional = (value: string) => [...value].reduce((sum, char) => sum + (/[甲乙]/u.test(char) ? 72 : /[a-z]/i.test(char) ? 36 : 18), 0);
  const quotedLines = wrapText(possessive, proportional, shareTextWidth);
  assert.equal(quotedLines.join(''), possessive);
  let offset = 0;
  for (const line of quotedLines.slice(0, -1)) {
    offset += line.length;
    assert.notEqual(offset, 7);
    assert.notEqual(offset, possessive.lastIndexOf("'"));
  }
});

test('impossible tiny widths preserve whole graphemes without punctuation-group overflow or loops', () => {
  const text = '甲（乙），👩🏽‍💻！';
  const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
  const segments = (value: string) => [...segmenter.segment(value)].map(({ segment }) => segment);
  const measure = (value: string) => [...value].length * 10;
  for (const width of [0, 1, 10, 20]) {
    const lines = wrapText(text, measure, width);
    assert.deepEqual(lines.flatMap(segments), segments(text));
    assert.ok(lines.every((line) => measure(line) <= width || (segments(line).length === 1 && measure(line) > width)));
  }
});

test('all export font sizes retain complete demo text within the actual 928px text column', () => {
  for (const size of [72, 52, 48, 44]) {
    for (const demo of demos) {
      for (const text of [demo.original, demo.result.heard_as, ...Object.values(demo.result.rewrites)]) {
        const measure = (value: string) => [...value].length * size;
        const lines = wrapText(text, measure, shareTextWidth);
        assert.equal(lines.join(''), text);
        assert.ok(lines.every((line) => measure(line) <= shareTextWidth && !/^[。，、；：！？）”’]/u.test(line) && !/[（“‘]$/u.test(line)));
      }
    }
  }
});

test('hidden original is never drawn, leaves no length hint, and fixed demos are watermarked', () => {
  const drawn: { text: string; y: number }[] = [];
  const ctx = {
    fillStyle: '', strokeStyle: '', font: '', textAlign: '',
    fillText: (s: string, _x: number, y: number) => drawn.push({ text: s, y }), measureText: (s: string) => ({ width: [...s].length * 40 }),
    fillRect() {}, beginPath() {}, roundRect() {}, fill() {}, moveTo() {}, lineTo() {}, stroke() {},
  };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toDataURL: () => 'data:image/png;base64,dW5pdC10ZXN0' };
  const before = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => canvas } });
  const texts = () => drawn.map((d) => d.text);
  try {
    const original = '敏感隐私'.repeat(75);
    const input = { original, relation: 'partner' as const, result: demos[0]!.result, tone: 'gentle' as const, demo: true, hideOriginal: true };
    createShareCard(input);
    const hiddenHeight = canvas.height;
    assert.ok(texts().includes(hiddenOriginalNotice));
    assert.ok(texts().includes(demoNotice));
    assert.equal(texts().join('').includes('敏感隐私'), false);
    assert.equal(texts().includes('我本来想说'), false);
    assert.equal(texts().join('').includes(input.result.heard_as), false);
    for (const value of Object.values(input.result.real_meaning)) assert.equal(texts().join('').includes(value), false);
    assert.ok(texts().includes('仅供表达参考 · 不作事实判断'));
    assert.ok(Math.max(...drawn.map((d) => d.y)) < hiddenHeight - 40, 'footer must stay inside the card');
    drawn.length = 0;
    createShareCard({ ...input, original: '短' });
    assert.equal(canvas.height, hiddenHeight, 'hidden-card height must not depend on original length');
    drawn.length = 0;
    createShareCard({ ...input, hideOriginal: false });
    assert.equal(texts().join('').split('敏感隐私').length - 1, 75);
    assert.ok(texts().every((t) => [...t].length * 40 <= shareTextWidth), 'all card text must wrap within the card');
    assert.ok(canvas.height > hiddenHeight);
    assert.equal(texts().join('').includes(input.result.heard_as), false);
    for (const value of Object.values(input.result.real_meaning)) assert.equal(texts().join('').includes(value), false);
    const comparisonHeight = canvas.height;
    drawn.length = 0;
    createShareCard({ ...input, hideOriginal: false, result: { ...input.result, heard_as: '不要把冲突推测放进图片'.repeat(5) } });
    assert.equal(canvas.height, comparisonHeight, 'card layout must not depend on inferred thoughts');
    assert.equal(texts().join('').includes('不要把冲突推测'), false);
    assert.ok(Math.max(...drawn.map((d) => d.y)) < canvas.height - 40);
    for (const demo of demos) {
      for (const tone of ['gentle', 'firm', 'humor'] as const) {
        for (const hideOriginal of [true, false]) {
          drawn.length = 0;
          createShareCard({ ...input, original: demo.original, result: demo.result, tone, hideOriginal });
          const full = texts().join('');
          assert.ok(full.includes(demo.result.rewrites[tone]));
          assert.equal(full.includes(demo.result.heard_as), false);
          for (const value of Object.values(demo.result.real_meaning)) assert.equal(full.includes(value), false);
          assert.equal(full.includes(demo.original), !hideOriginal);
          assert.ok(texts().every((t) => [...t].length * 40 <= shareTextWidth));
        }
      }
    }
    drawn.length = 0;
    createShareCard({ ...input, demo: false });
    assert.equal(texts().includes(demoNotice), false);
    canvas.toDataURL = () => 'data:,';
    assert.throws(() => createShareCard(input), /CANVAS_EXPORT_UNAVAILABLE/);
  } finally {
    if (before) Object.defineProperty(globalThis, 'document', before);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
