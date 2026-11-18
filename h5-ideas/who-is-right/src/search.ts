import type { Saying } from './types';

const SYNONYMS: [string, string[]][] = [
  ['孩子', ['小孩子', '小孩', '宝宝', '娃娃', '小娃', '娃', '小朋友', '婴儿', '孩儿']],
  ['发烧', ['发热', '高烧']],
  ['捂', ['盖', '裹']],
  ['剩菜', ['隔夜菜', '剩饭']],
  ['鸡蛋', ['蛋']],
  ['盐', ['咸']],
  ['手机', ['电视', '屏幕', 'ipad', '平板']],
  ['外面', ['户外', '室外']],
];

const SYNONYM_MAP = new Map<string, string>();
for (const [canonical, variants] of SYNONYMS) {
  SYNONYM_MAP.set(canonical, canonical);
  for (const v of variants) SYNONYM_MAP.set(v, canonical);
}
const SYNONYM_RE = new RegExp(
  [...SYNONYM_MAP.keys()].sort((a, b) => b.length - a.length).join('|'),
  'g',
);

const STOP_CHARS = /[\s\p{P}\p{S}]/gu;

export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(STOP_CHARS, '')
    .replace(SYNONYM_RE, (m) => SYNONYM_MAP.get(m) ?? m);
}

export function bigrams(text: string): Set<string> {
  const chars = Array.from(text);
  const grams = new Set<string>();
  if (chars.length === 1) grams.add(chars[0]);
  for (let i = 0; i < chars.length - 1; i++) grams.add(chars[i] + chars[i + 1]);
  return grams;
}

interface Field {
  text: string;
  grams: Set<string>;
  weight: number;
}

interface Indexed {
  saying: Saying;
  fields: Field[];
}

export interface SearchHit {
  saying: Saying;
  score: number;
}

export const MIN_SCORE = 0.34;

function field(text: string, weight: number): Field {
  const norm = normalize(text);
  return { text: norm, grams: bigrams(norm), weight };
}

export function buildIndex(sayings: Saying[]): Indexed[] {
  return sayings.map((saying) => ({
    saying,
    fields: [
      field(saying.title, 1),
      ...saying.aliases.map((a) => field(a, 0.9)),
      ...saying.tags.map((t) => field(t, 0.6)),
    ],
  }));
}

function scoreField(query: string, qGrams: Set<string>, f: Field): number {
  if (!f.text || qGrams.size === 0) return 0;
  if (f.text === query) return 1.5 * f.weight;
  let hit = 0;
  for (const g of qGrams) if (f.grams.has(g)) hit++;
  const queryCoverage = hit / qGrams.size;
  const fieldCoverage = f.grams.size ? hit / f.grams.size : 0;
  let score = Math.max(queryCoverage, fieldCoverage * 0.9);
  if (f.text.length >= 2 && query.includes(f.text)) score = Math.max(score, 1);
  if (query.length >= 2 && f.text.includes(query)) score = Math.max(score, 1.1);
  return score * f.weight;
}

export function search(index: Indexed[], rawQuery: string, limit = 5): SearchHit[] {
  const query = normalize(rawQuery);
  if (!query) return [];
  const qGrams = bigrams(query);
  return index
    .map(({ saying, fields }) => ({
      saying,
      score: Math.max(...fields.map((f) => scoreField(query, qGrams, f))),
    }))
    .filter((h) => h.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
