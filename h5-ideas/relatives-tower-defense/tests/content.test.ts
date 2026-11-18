import { describe, expect, it } from 'vitest';
import rawQuestions from '../src/content/questions.json';
import {
  cardNames, cards, identities, questions, relatives, waveNames,
  type Identity,
} from '../src/content';

const identityIds = ['single', 'married', 'graduate', 'exam'] as const;
const cardIds = ['taiji', 'counter', 'crazy', 'sincere'] as const;
const relativeIds = ['sangu', 'erjiu', 'dayi', 'gufu', 'ershen', 'biaojie', 'wangayi', 'nainai', 'table'];
const kindIds = ['normal', 'fast', 'tough', 'warm', 'boss', 'followup'];
const categories = ['收入', '住房', '比较', '工作', '婚恋', '生育', '考学', '暖心'];
const numbered = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);
const expectedIds = [
  ...['income', 'housing', 'compare', 'work'].flatMap(prefix => numbered(prefix, 8)),
  ...identityIds.flatMap(identity => numbered(identity, 7)),
  ...numbered('warm', 4), ...identityIds.map(identity => `boss-${identity}`),
  ...numbered('followup', 4),
];
const isRegular = (kind: string) => ['normal', 'fast', 'tough'].includes(kind);

function expectText(value: unknown, max: number) {
  expect(typeof value).toBe('string');
  const text = value as string;
  expect(text).toBe(text.trim());
  expect(Array.from(text).length).toBeGreaterThan(0);
  expect(Array.from(text).length).toBeLessThanOrEqual(max);
}

describe('题库的真实 JSON 和运行时导出', () => {
  it('完整导出 72 道题、64 道常规/暖心题、4 道 boss 和 4 道追问', () => {
    expect(questions).toEqual(rawQuestions);
    expect(questions).toHaveLength(72);
    expect(questions.filter(q => isRegular(q.kind) || q.kind === 'warm')).toHaveLength(64);
    expect(questions.filter(q => isRegular(q.kind))).toHaveLength(60);
    expect(questions.filter(q => q.kind === 'warm')).toHaveLength(4);
    expect(questions.filter(q => q.kind === 'boss')).toHaveLength(4);
    expect(questions.filter(q => q.kind === 'followup')).toHaveLength(4);
  });

  it('逐一枚举预期 ID，既不重号也不缺题', () => {
    expect(new Set(questions.map(q => q.id)).size).toBe(72);
    expect(questions.map(q => q.id).sort()).toEqual(expectedIds.sort());
  });

  it.each(questions.map(q => [q.id, q] as const))('%s：长度、枚举、四卡和提问者约束', (_id, q) => {
    expect(Object.keys(q).sort()).toEqual(['id', 'category', 'kind', 'identities', 'askers', 'text', 'answers'].sort());
    expect(kindIds).toContain(q.kind);
    expect(categories).toContain(q.category);
    expect(q.identities.length).toBeGreaterThan(0);
    expect(new Set(q.identities).size).toBe(q.identities.length);
    for (const identity of q.identities) expect(identityIds).toContain(identity);
    expect(q.askers.length).toBeGreaterThan(0);
    expect(new Set(q.askers).size).toBe(q.askers.length);
    for (const asker of q.askers) {
      expect(relativeIds).toContain(asker);
      if (asker === 'nainai') expect(q.kind).toBe('warm');
      if (asker === 'table') expect(q.kind).toBe('boss');
    }
    if (q.kind === 'boss') expect(q.askers).toEqual(['table']);
    if (q.kind === 'warm') expect(q.askers).toEqual(['nainai']);
    if (q.identities.includes('married')) expect(q.text).not.toContain('再生');
    expectText(q.text, 18);
    expect(Object.keys(q.answers).sort()).toEqual([...cardIds].sort());
    for (const card of cardIds) expectText(q.answers[card], 28);
  });
});

describe('身份池和公开内容枚举', () => {
  it.each(identityIds)('%s 池含 43 道常规/暖心，且各身份和直球压轴题完整', (identity: Identity) => {
    const pool = questions.filter(q => q.identities.includes(identity));
    expect(pool.filter(q => isRegular(q.kind) || q.kind === 'warm')).toHaveLength(43);
    expect(pool.filter(q => isRegular(q.kind))).toHaveLength(39);
    expect(pool.filter(q => q.kind === 'warm').map(q => q.id).sort()).toEqual(numbered('warm', 4));
    expect(pool.filter(q => q.kind === 'boss').map(q => q.id)).toEqual([`boss-${identity}`]);
    expect(pool.filter(q => q.kind === 'followup').map(q => q.id).sort()).toEqual(numbered('followup', 4));
    expect(pool.filter(q => q.identities.length === 1 && isRegular(q.kind)).map(q => q.id).sort())
      .toEqual(numbered(identity, 7));
    expect(pool).toHaveLength(48);
    for (const kind of kindIds) expect(pool.some(q => q.kind === kind)).toBe(true);
    for (const other of identityIds.filter(id => id !== identity)) {
      expect(pool.some(q => q.id.startsWith(`${other}-`) || q.id === `boss-${other}`)).toBe(false);
    }
  });

  it('四身份、四张卡和九位亲戚均有完整展示内容', () => {
    expect(identities.map(identity => identity.id)).toEqual(identityIds);
    for (const identity of identities) {
      expectText(identity.name, 18);
      expectText(identity.note, 28);
      expect(relativeIds).toContain(identity.icon);
    }
    expect(cards).toEqual(cardIds);
    expect(cardNames).toEqual({ taiji: '太极', counter: '反问', crazy: '发疯', sincere: '真心' });
    expect(Object.keys(relatives).sort()).toEqual([...relativeIds].sort());
    for (const relative of Object.values(relatives)) {
      expect(relative.name.trim()).not.toBe('');
      expect(relative.line.trim()).not.toBe('');
    }
    expect(waveNames).toEqual(['凉菜开席', '热菜上桌', '饺子压轴', '全桌齐问']);
  });

});
