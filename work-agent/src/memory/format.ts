import { createHash } from 'node:crypto';
import { ContractError } from '../contracts/common.ts';
import type { Sensitivity } from '../contracts/common.ts';
import { MEMORY_TEXT_LIMITS } from '../contracts/memory.ts';
import type { MemoryItem, MemoryLayer, MemoryOrigin, UserEvidenceType } from '../contracts/memory.ts';

export const JOURNAL_TEXT_MAX = 500;
export const PROFILE_FILE = 'user.md';
export const LONG_TERM_FILE = 'memory.md';
export const JOURNAL_DIR = 'journal';

const KINDS: ReadonlyArray<MemoryItem['kind']> = ['rule', 'fact', 'episode'];
const SENSITIVITIES: ReadonlyArray<Sensitivity> = ['normal', 'confidential', 'secret'];
const EVIDENCE_TYPES: ReadonlyArray<UserEvidenceType> = ['message', 'decision', 'local_edit'];
const LAYERS: ReadonlyArray<MemoryLayer> = ['profile', 'long_term', 'journal'];

const CREDENTIAL_WORDS = /密码|token|密钥|sk-/i;
const CREDENTIAL_RUN = /[A-Za-z0-9]{20,}/;
const FORBIDDEN_CHARS = /[\u0000-\u001f\u007f\u2028\u2029]/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const JOURNAL_FILE_RE = /^journal\/(\d{4}-\d{2}-\d{2})\.md$/;

export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export function normalizeForTombstone(text: string): string {
  return text.trim().replace(/\s+/gu, ' ').toLowerCase();
}

export function tombstoneHash(text: string): string {
  return sha256(normalizeForTombstone(text));
}

export function charLength(text: string): number {
  return [...text].length;
}

export type TextProblem = 'format' | 'length' | 'credential';

export function looksLikeCredential(text: string): boolean {
  return CREDENTIAL_WORDS.test(text) || CREDENTIAL_RUN.test(text);
}

export function checkText(text: string, max: number): TextProblem | null {
  if (looksLikeCredential(text)) return 'credential';
  if (FORBIDDEN_CHARS.test(text) || text.includes('<!--') || text.includes('-->')) return 'format';
  const n = charLength(text);
  if (n < MEMORY_TEXT_LIMITS.min || n > max) return 'length';
  return null;
}

export function cleanText(input: unknown, max: number): string {
  if (typeof input !== 'string') throw new ContractError('bad_request', 'memory text must be a string');
  if (looksLikeCredential(input)) throw new ContractError('rejected', 'memory text looks like a credential');
  if (FORBIDDEN_CHARS.test(input) || input.includes('<!--') || input.includes('-->')) {
    throw new ContractError('bad_request', 'memory text contains line breaks, control characters or comment markers');
  }
  if (charLength(input) > max) throw new ContractError('bad_request', `memory text must be ${MEMORY_TEXT_LIMITS.min}-${max} characters`);
  const text = input.trim();
  const problem = checkText(text, max);
  if (problem === 'credential') throw new ContractError('rejected', 'memory text looks like a credential');
  if (problem === 'format') throw new ContractError('bad_request', 'memory text contains line breaks, control characters or comment markers');
  if (problem === 'length') throw new ContractError('bad_request', `memory text must be ${MEMORY_TEXT_LIMITS.min}-${max} characters`);
  return text;
}

export function isKind(v: unknown): v is MemoryItem['kind'] {
  return typeof v === 'string' && (KINDS as readonly string[]).includes(v);
}

export function isSensitivity(v: unknown): v is Sensitivity {
  return typeof v === 'string' && (SENSITIVITIES as readonly string[]).includes(v);
}

export function isLayer(v: unknown): v is MemoryLayer {
  return typeof v === 'string' && (LAYERS as readonly string[]).includes(v);
}

export function isEvidenceType(v: unknown): v is UserEvidenceType {
  return typeof v === 'string' && (EVIDENCE_TYPES as readonly string[]).includes(v);
}

export function isTimestamp(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
}

export function checkDate(date: unknown): string {
  if (typeof date !== 'string') throw new ContractError('bad_request', 'journal date must be YYYY-MM-DD');
  const m = DATE_RE.exec(date);
  if (!m) throw new ContractError('bad_request', 'journal date must be YYYY-MM-DD');
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(0);
  t.setUTCFullYear(y, mo - 1, d);
  t.setUTCHours(0, 0, 0, 0);
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) {
    throw new ContractError('bad_request', 'journal date is not a valid calendar date');
  }
  return date;
}

export function checkOrigin(input: unknown): MemoryOrigin {
  const bad = () => new ContractError('bad_request', 'invalid memory origin');
  if (!input || typeof input !== 'object') throw bad();
  const o = input as Record<string, unknown>;
  const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && !FORBIDDEN_CHARS.test(v);
  switch (o.kind) {
    case 'user':
      if (!nonEmpty(o.evidenceId) || !isEvidenceType(o.evidenceType)) throw bad();
      return { kind: 'user', evidenceId: o.evidenceId, evidenceType: o.evidenceType };
    case 'companion':
      if (!Array.isArray(o.evidence)) throw bad();
      return { kind: 'companion', evidence: structuredClone(o.evidence) };
    case 'consolidation':
      if (!nonEmpty(o.runId) || !Array.isArray(o.evidence)) throw bad();
      return { kind: 'consolidation', runId: o.runId, evidence: structuredClone(o.evidence) };
    case 'external':
      if (!Array.isArray(o.entityIds) || !o.entityIds.every(nonEmpty)) throw bad();
      return { kind: 'external', entityIds: [...o.entityIds] };
    default:
      throw bad();
  }
}

function encodeValue(v: string): string {
  return v.replace(/[%;=,<>"'\s\u0000-\u001f\u007f]/gu, (c) =>
    Array.from(new TextEncoder().encode(c), (b) => '%' + b.toString(16).toUpperCase().padStart(2, '0')).join(''));
}

function decodeValue(v: string): string | null {
  try {
    return decodeURIComponent(v);
  } catch {
    return null;
  }
}

export function encodeOrigin(o: MemoryOrigin): string {
  switch (o.kind) {
    case 'user': return `user:${o.evidenceType}:${encodeValue(o.evidenceId)}`;
    case 'companion': return 'companion';
    case 'consolidation': return `consolidation:${encodeValue(o.runId)}`;
    case 'external': return `external:${o.entityIds.map(encodeValue).join(',')}`;
  }
}

export function decodeOrigin(s: string): MemoryOrigin | null {
  if (s === 'companion') return { kind: 'companion', evidence: [] };
  const i = s.indexOf(':');
  if (i <= 0) return null;
  const head = s.slice(0, i);
  const rest = s.slice(i + 1);
  if (head === 'user') {
    const j = rest.indexOf(':');
    if (j <= 0) return null;
    const type = rest.slice(0, j);
    const id = decodeValue(rest.slice(j + 1));
    if (!isEvidenceType(type) || !id) return null;
    return { kind: 'user', evidenceType: type, evidenceId: id };
  }
  if (head === 'consolidation') {
    const runId = decodeValue(rest);
    return runId ? { kind: 'consolidation', runId, evidence: [] } : null;
  }
  if (head === 'external') {
    if (!rest) return { kind: 'external', entityIds: [] };
    const ids = rest.split(',').map(decodeValue);
    if (ids.length === 0 || ids.some((x) => !x)) return null;
    return { kind: 'external', entityIds: ids as string[] };
  }
  return null;
}

/** 文件与索引里的来源一致时用索引里的（带依据），否则以文件为准 */
export function mergeOrigin(fromFile: MemoryOrigin, fromIndex: MemoryOrigin | undefined): MemoryOrigin {
  if (fromIndex && encodeOrigin(fromIndex) === encodeOrigin(fromFile)) return fromIndex;
  return fromFile;
}

export interface Marker {
  id: string;
  kind: MemoryItem['kind'];
  origin: MemoryOrigin;
  sensitivity: Sensitivity;
  createdAt: number;
  validUntil?: number;
}

function parseMarkerBody(body: string): Marker | null {
  if (body.includes('-->') || body.includes('<!--')) return null;
  const fields = new Map<string, string>();
  for (const part of body.split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) return null;
    const key = part.slice(0, i).trim();
    if (fields.has(key)) return null;
    fields.set(key, part.slice(i + 1).trim());
  }
  const id = decodeValue(fields.get('id') ?? '');
  const kind = fields.get('kind');
  const origin = decodeOrigin(fields.get('origin') ?? '');
  const sens = fields.get('sens');
  const created = fields.get('created') ?? '';
  const until = fields.get('until');
  if (!id || FORBIDDEN_CHARS.test(id) || !isKind(kind) || !origin || !isSensitivity(sens)) return null;
  if (!/^\d{1,16}$/.test(created)) return null;
  if (until !== undefined && !/^\d{1,16}$/.test(until)) return null;
  if (kind === 'rule' && origin.kind !== 'user') return null;
  const marker: Marker = { id, kind, origin, sensitivity: sens, createdAt: Number(created) };
  if (until !== undefined) marker.validUntil = Number(until);
  return marker;
}

export function formatItemLine(item: Pick<MemoryItem, 'id' | 'kind' | 'text' | 'origin' | 'sensitivity' | 'createdAt' | 'validUntil'>): string {
  const parts = [
    `id=${encodeValue(item.id)}`,
    `kind=${item.kind}`,
    `origin=${encodeOrigin(item.origin)}`,
    `sens=${item.sensitivity}`,
    `created=${item.createdAt}`,
  ];
  if (item.validUntil !== undefined) parts.push(`until=${item.validUntil}`);
  return `- ${item.text} <!-- wa:${parts.join(';')} -->`;
}

export type LineClass =
  | { type: 'raw' }
  | { type: 'plain'; text: string }
  | { type: 'marked'; text: string; marker: Marker }
  | { type: 'broken'; looseId?: string };

const MARKERISH = /<!--\s*wa:/;
const MARKER_LINE = /^(.*?)\s*<!--\s*wa:(.*?)\s*-->\s*$/u;
const LOOSE_ID = /wa:.*?\bid=([^;\s>]+)/u;

export function classifyLine(line: string): LineClass {
  const l = line.replace(/^\uFEFF/, '');
  if (!l.startsWith('- ')) {
    if (!MARKERISH.test(l)) return { type: 'raw' };
    const loose = LOOSE_ID.exec(l);
    const looseId = loose ? decodeValue(loose[1]) ?? undefined : undefined;
    return looseId ? { type: 'broken', looseId } : { type: 'broken' };
  }
  const rest = l.slice(2);
  if (MARKERISH.test(rest)) {
    const m = MARKER_LINE.exec(rest);
    const marker = m ? parseMarkerBody(m[2]) : null;
    if (!m || !marker) {
      const loose = LOOSE_ID.exec(rest);
      const looseId = loose ? decodeValue(loose[1]) ?? undefined : undefined;
      return looseId ? { type: 'broken', looseId } : { type: 'broken' };
    }
    return { type: 'marked', text: m[1].trim(), marker };
  }
  const text = rest.trim();
  return text ? { type: 'plain', text } : { type: 'raw' };
}

export function isFence(line: string): boolean {
  return /^\s*(```|~~~)/.test(line);
}

export function layerOfFile(rel: string): MemoryLayer | null {
  if (rel === PROFILE_FILE) return 'profile';
  if (rel === LONG_TERM_FILE) return 'long_term';
  if (JOURNAL_FILE_RE.test(rel)) return 'journal';
  return null;
}

export function journalFile(date: string): string {
  return `${JOURNAL_DIR}/${date}.md`;
}

export function fileForLayer(layer: Exclude<MemoryLayer, 'journal'>): string {
  return layer === 'profile' ? PROFILE_FILE : LONG_TERM_FILE;
}

export function textMaxFor(layer: MemoryLayer): number {
  return layer === 'journal' ? JOURNAL_TEXT_MAX : MEMORY_TEXT_LIMITS.max;
}

const EDIT_HINT = '这个文件可以直接编辑：每条记忆占一行，以“- ”开头。行尾的 wa 标记是团子用来对应记录的，请不要改动；新写的行会自动导入为事实并补上标记，删掉一行就等于让团子忘掉它。';

export function headerLines(rel: string): string[] {
  const journal = JOURNAL_FILE_RE.exec(rel);
  const title = rel === PROFILE_FILE ? '# 团子记住的你' : rel === LONG_TERM_FILE ? '# 团子的长期记忆' : `# 团子日记 ${journal?.[1] ?? ''}`;
  return [title, '', EDIT_HINT, ''];
}
