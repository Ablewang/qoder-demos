import { describe, expect, it } from 'vitest';
import { checkLibrary, checkSaying } from '../src/content/gate';
import type { Saying } from '../src/types';

const checked = (): Saying => ({
  id: 'demo-ok',
  category: 'health',
  tags: [],
  title: '少吃盐',
  aliases: ['示例说法'],
  verdict: 'right',
  elderRight: '方向对',
  nowAdvice: '清淡饮食',
  sources: [
    {
      org: '示例机构',
      title: '示例页面',
      url: 'https://www.who.int/example',
      quote: '原文',
      scope: '成年人',
      checkedAt: '2026-11-17',
    },
  ],
  status: 'source-checked',
  risk: 'low',
  bigCard: { lines: ['{称呼}说得对', '少吃盐'], sourceLine: '示例来源' },
});

const pending = (): Saying => ({
  id: 'demo-pending',
  category: 'parenting',
  tags: [],
  title: '发烧捂汗',
  aliases: ['示例说法'],
  verdict: 'outdated',
  intent: '怕孩子着凉',
  nowAdvice: '以医生意见为准',
  sources: [{ org: '待查', title: '待查原文' }],
  status: 'pending',
  risk: 'medical',
  pendingNote: '医疗类，需专业审核',
});

function messages(s: Saying): string {
  return checkSaying(s).map((i) => i.message).join('\n');
}

describe('内容门槛规则', () => {
  it('合规样例通过', () => {
    expect(checkSaying(checked())).toEqual([]);
    expect(checkSaying(pending())).toEqual([]);
  });

  it('别名不能为空', () => {
    expect(messages({ ...checked(), aliases: [] })).toContain('别名至少 1 条');
    expect(messages({ ...checked(), aliases: [' '] })).toContain('不得为空');
  });

  it('待核验条目不得带大字卡', () => {
    const s = { ...pending(), bigCard: { lines: ['{称呼}说得对'], sourceLine: 'x' } };
    expect(messages(s)).toContain('待核验条目不得带大字卡');
  });

  it('待核验条目必须写明待核验点', () => {
    expect(messages({ ...pending(), pendingNote: undefined })).toContain('待核验点');
  });

  it('医疗类条目不得标为已核对', () => {
    expect(messages({ ...checked(), risk: 'medical' })).toContain('只有低风险条目');
  });

  it('已核对条目的来源必须有链接、摘录、范围、日期', () => {
    const base = checked();
    const src = base.sources[0];
    expect(messages({ ...base, sources: [{ ...src, quote: undefined }] })).toContain('缺少原文摘录');
    expect(messages({ ...base, sources: [{ ...src, scope: undefined }] })).toContain('缺少适用范围');
    expect(messages({ ...base, sources: [{ ...src, checkedAt: '2026/11/17' }] })).toContain('核对日期');
    expect(messages({ ...base, sources: [{ org: 'x', title: 'y' }] })).toContain('缺少链接');
  });

  it('摘录不能脱离链接', () => {
    const s = { ...pending(), sources: [{ org: 'x', title: 'y', quote: '凭空的摘录' }] };
    expect(messages(s)).toContain('摘录必须能对上原页面');
  });

  it('链接必须是白名单内的 https 官方域名', () => {
    const base = checked();
    const bad = (url: string) => messages({ ...base, sources: [{ ...base.sources[0], url }] });
    expect(bad('http://www.who.int/x')).toContain('白名单');
    expect(bad('https://example.com/x')).toContain('白名单');
    expect(bad('https://who.int.evil.com/x')).toContain('白名单');
    expect(bad('https://fakegov.cn/x')).toContain('白名单');
    expect(bad('https://www.nanchong.gov.cn/x')).toBe('');
  });

  it('“现在不这么做了”的条目不得硬写“长辈对在哪”', () => {
    expect(messages({ ...pending(), elderRight: '其实也有一半道理' })).toContain('不得填写「长辈对在哪」');
  });

  it('✅/⚠️ 条目必须写“长辈对在哪”，且不能用“出发点”代替', () => {
    expect(messages({ ...checked(), elderRight: undefined })).toContain('必须写「长辈对在哪」');
    expect(messages({ ...checked(), intent: '出发点' })).toContain('只用于结论为「现在不这么做了」');
  });

  it('大字卡：最多 5 行、每行 10 字（称呼按 4 字计）、出处行 20 字', () => {
    const base = checked();
    const card = base.bigCard!;
    expect(messages({ ...base, bigCard: { ...card, lines: ['一', '二', '三', '四', '五', '六'] } })).toContain('超过 5 行');
    expect(messages({ ...base, bigCard: { ...card, lines: ['{称呼}一二三四五六七'] } })).toContain('超过 10 字');
    expect(messages({ ...base, bigCard: { ...card, lines: ['{称呼}一二三四五六'] } })).toBe('');
    expect(messages({ ...base, bigCard: { ...card, sourceLine: '一'.repeat(21) } })).toContain('出处行超过');
    expect(messages({ ...base, bigCard: { ...card, lines: [] } })).toContain('没有正文');
  });

  it('禁用说法：仅供参考、伪称医生审核、贬低长辈', () => {
    expect(messages({ ...checked(), nowAdvice: '以上仅供参考' })).toContain('仅供参考');
    expect(messages({ ...checked(), elderRight: '经医生审核，说得对' })).toContain('经医生审核');
    expect(messages({ ...pending(), intent: '这是谣言' })).toContain('谣言');
    const card = { lines: ['医生也这么说'], sourceLine: 'x' };
    expect(messages({ ...checked(), bigCard: card })).toContain('医生也这么说');
  });

  it('id 重复会被发现', () => {
    const issues = checkLibrary({ version: 't', updatedAt: 't', sayings: [checked(), checked()] });
    expect(issues.map((i) => i.message)).toContain('id 重复');
  });
});
