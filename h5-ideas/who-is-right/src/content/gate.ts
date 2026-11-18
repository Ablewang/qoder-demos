import type { Library, Saying } from '../types';

export const MAX_CARD_LINES = 5;
export const MAX_CARD_LINE_CHARS = 10;
export const MAX_SOURCE_LINE_CHARS = 20;
export const MAX_SALUTATION_CHARS = 4;
export const SALUTATION_TOKEN = '{称呼}';

export const SOURCE_DOMAIN_WHITELIST = [
  'cnsoc.org',
  'nhc.gov.cn',
  'gov.cn',
  'chinacdc.cn',
  'cfsa.net.cn',
  'who.int',
];

export const BANNED_PHRASES = [
  '谣言',
  '伪科学',
  '智商税',
  '愚昧',
  '你不懂',
  '仅供参考',
  '经医生审核',
  '医生已审核',
  '医生审核通过',
  '医生也这么说',
  '医生都说',
];

export interface GateIssue {
  id: string;
  message: string;
}

export function charCount(text: string): number {
  return Array.from(text).length;
}

/** 称呼按最长 4 字计算一行的字数 */
export function cardLineChars(line: string): number {
  const placeholders = line.split(SALUTATION_TOKEN).length - 1;
  const rest = line.split(SALUTATION_TOKEN).join('');
  return charCount(rest) + placeholders * MAX_SALUTATION_CHARS;
}

function isWhitelistedUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname;
  return SOURCE_DOMAIN_WHITELIST.some((d) => host === d || host.endsWith(`.${d}`));
}

function textFields(s: Saying): string[] {
  return [
    s.elderRight,
    s.intent,
    s.nowAdvice,
    s.scopeNote,
    s.whyChanged,
    s.redFlags,
    s.pendingNote,
    ...(s.bigCard ? [...s.bigCard.lines, s.bigCard.sourceLine] : []),
  ].filter((t): t is string => typeof t === 'string');
}

export function canExportClaimCard(s: Saying): boolean {
  return s.status === 'source-checked' && s.bigCard !== undefined;
}

export function checkSaying(s: Saying): GateIssue[] {
  const issues: GateIssue[] = [];
  const fail = (message: string) => issues.push({ id: s.id, message });

  if (!/^[a-z0-9-]+$/.test(s.id)) fail('id 只能用小写字母、数字和连字符');
  if (!s.title.trim()) fail('标题为空');
  if (s.aliases.length === 0 || s.aliases.some((alias) => !alias.trim())) fail('别名至少 1 条且不得为空');
  if (!s.nowAdvice.trim()) fail('「现在的建议」为空');
  if (s.sources.length === 0) fail('至少要有 1 条来源（待核验条目也要写明拟依据的来源）');

  if (s.verdict === 'outdated') {
    if (s.elderRight) fail('结论为「现在不这么做了」的条目不得填写「长辈对在哪」，最多写「可以理解的出发点」');
  } else {
    if (!s.elderRight?.trim()) fail('结论为 ✅ 或 ⚠️ 的条目必须写「长辈对在哪」');
    if (s.intent) fail('「可以理解的出发点」只用于结论为「现在不这么做了」的条目');
  }

  for (const src of s.sources) {
    if (src.quote && !src.url) fail(`来源「${src.title}」写了摘录但没有链接：摘录必须能对上原页面`);
    if (src.url && !isWhitelistedUrl(src.url)) fail(`来源链接不是白名单内的 https 官方域名：${src.url}`);
  }

  if (s.status === 'source-checked') {
    if (s.risk !== 'low') fail('内测版只有低风险条目可以标为「来源原文已核对」，医疗类须等专业审核流程');
    for (const src of s.sources) {
      if (!src.url) fail(`已核对条目的来源「${src.title}」缺少链接`);
      if (!src.quote?.trim()) fail(`已核对条目的来源「${src.title}」缺少原文摘录`);
      if (!src.scope?.trim()) fail(`已核对条目的来源「${src.title}」缺少适用范围`);
      if (!src.checkedAt || !/^\d{4}-\d{2}-\d{2}$/.test(src.checkedAt)) {
        fail(`已核对条目的来源「${src.title}」缺少核对日期（YYYY-MM-DD）`);
      }
    }
    if (s.pendingNote) fail('已核对条目不应再有「待核验点」');
  } else {
    if (!s.pendingNote?.trim()) fail('待核验条目必须写明待核验点');
    if (s.bigCard) fail('待核验条目不得带大字卡（不能生成断言性的对外卡片）');
  }

  if (s.bigCard) {
    const { lines, sourceLine } = s.bigCard;
    if (lines.length === 0) fail('大字卡没有正文');
    if (lines.length > MAX_CARD_LINES) fail(`大字卡超过 ${MAX_CARD_LINES} 行`);
    lines.forEach((line, i) => {
      const n = cardLineChars(line);
      if (n > MAX_CARD_LINE_CHARS) fail(`大字卡第 ${i + 1} 行「${line}」按称呼 4 字计为 ${n} 字，超过 ${MAX_CARD_LINE_CHARS} 字`);
      if (!line.trim()) fail(`大字卡第 ${i + 1} 行为空`);
    });
    if (charCount(sourceLine) > MAX_SOURCE_LINE_CHARS) fail(`大字卡出处行超过 ${MAX_SOURCE_LINE_CHARS} 字`);
    if (!sourceLine.trim()) fail('大字卡缺少出处行');
  }

  for (const text of textFields(s)) {
    for (const banned of BANNED_PHRASES) {
      if (text.includes(banned)) fail(`出现禁用说法「${banned}」：${text}`);
    }
  }

  return issues;
}

export function checkLibrary(lib: Library): GateIssue[] {
  const issues: GateIssue[] = [];
  const seen = new Set<string>();
  for (const s of lib.sayings) {
    if (seen.has(s.id)) issues.push({ id: s.id, message: 'id 重复' });
    seen.add(s.id);
    issues.push(...checkSaying(s));
  }
  return issues;
}

export function formatIssues(issues: GateIssue[]): string {
  return issues.map((i) => `  - [${i.id}] ${i.message}`).join('\n');
}
