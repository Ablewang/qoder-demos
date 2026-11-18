import { describe, expect, it } from 'vitest';
import { library } from '../src/content/library';
import {
  BANNED_PHRASES,
  MAX_CARD_LINE_CHARS,
  canExportClaimCard,
  cardLineChars,
  checkLibrary,
  formatIssues,
} from '../src/content/gate';
import { THANKS_TEMPLATES } from '../src/content/thanks';
import { badges, sayingItem } from '../src/ui/dom';

describe('待核验呈现优先级', () => {
  it('列表先显示核验状态和非医疗建议说明，不显示定论样式', () => {
    for (const saying of library.sayings.filter((s) => s.status === 'pending')) {
      const html = sayingItem(saying);
      expect(html.indexOf('status-pending')).toBeLessThan(html.indexOf('item-title'));
      expect(html).toContain('不能作为医疗建议');
      expect(html).not.toContain('verdict-');
    }
  });

  it('已核对条目仍保留三档结论，且不改成医生审核', () => {
    for (const saying of library.sayings.filter((s) => s.status === 'source-checked')) {
      expect(badges(saying)).toContain(`verdict-${saying.verdict}`);
      expect(badges(saying)).toContain('来源原文已核对');
      expect(badges(saying)).not.toMatch(/医生审核|医学审核/);
    }
  });
});

describe('通用回应不冒充已知事实', () => {
  it.each(THANKS_TEMPLATES)('$id 不预设健康、经历、行为承诺或赞同', template => {
    expect(template.text + template.lines.join('')).not.toMatch(/孩子|身体|挺好|放心|记着|照顾|我会|我们再查|听到了|说得对|没问题/);
    expect(template.text).not.toContain('{称呼}');
  });
  it('默认只给中性回应，感谢必须主动选择', () => {
    expect(THANKS_TEMPLATES[0].text).toBe('知道了。');
    expect(THANKS_TEMPLATES[0].lines.join('')).not.toMatch(/谢谢|同意|赞同/);
    expect(THANKS_TEMPLATES.find(t => t.id === 'remind')!.text).toBe('谢谢提醒。');
  });
});

describe('剩菜卡独立转发的必要前提', () => {
  it('正文写明尽快冷藏和吃前热透，时限句不能脱离冷藏', () => {
    const lines = library.sayings.find(s => s.id === 'leftovers')!.bigCard!.lines;
    expect(lines.join('')).toContain('趁热分装，尽快冷藏');
    expect(lines.join('')).toContain('吃前要热透');
    const deadlines = lines.filter(line => /一两天|1[～-]2天/.test(line));
    expect(deadlines).toHaveLength(1);
    expect(deadlines[0]).toMatch(/冷藏.*一两天/);
  });

  it('图内条件独立说明储存和菜类限制，不让读者寻找不存在的原文', () => {
    const scope = library.sayings.find(s => s.id === 'leftovers')!.scopeNote!;
    expect(scope).toContain('尽快冷藏、妥善储存');
    expect(scope).toContain('不含常温放置');
    expect(scope).toContain('绿叶菜、海鲜水产、豆制品不要剩');
    expect(scope).toContain('菌菇、薯类、肉类、米饭冷藏也限1～2天');
    expect(scope).not.toMatch(/见下方|详见|见原文/);
  });
});

describe('真实内容库的发布门槛', () => {
  it('全部条目通过门槛', () => {
    const issues = checkLibrary(library);
    expect(issues, formatIssues(issues)).toEqual([]);
  });

  it('育儿为主、少量养生', () => {
    const parenting = library.sayings.filter((s) => s.category === 'parenting').length;
    const health = library.sayings.filter((s) => s.category === 'health').length;
    expect(parenting).toBeGreaterThan(health);
    expect(health).toBeGreaterThan(0);
  });

  it('待核验条目一律没有大字卡，也不能导出', () => {
    for (const s of library.sayings.filter((x) => x.status === 'pending')) {
      expect(s.bigCard, s.id).toBeUndefined();
      expect(canExportClaimCard(s), s.id).toBe(false);
    }
  });

  it('医疗类条目一律处于待核验', () => {
    for (const s of library.sayings.filter((x) => x.risk === 'medical')) {
      expect(s.status, s.id).toBe('pending');
    }
  });

  it('已核对条目的来源都是 https 链接且带原文摘录', () => {
    const checked = library.sayings.filter((s) => s.status === 'source-checked');
    expect(checked.length).toBeGreaterThan(0);
    for (const s of checked) {
      for (const src of s.sources) {
        expect(src.url, s.id).toMatch(/^https:\/\//);
        expect(src.quote?.length, s.id).toBeGreaterThan(0);
      }
    }
  });

  it('“谢谢惦记”模板也遵守大字卡字数限制，并且有不煽情的选项', () => {
    for (const t of THANKS_TEMPLATES) {
      for (const line of t.lines) expect(cardLineChars(line), line).toBeLessThanOrEqual(MAX_CARD_LINE_CHARS);
      for (const line of t.lines) for (const b of BANNED_PHRASES) expect(line.includes(b)).toBe(false);
    }
    expect(THANKS_TEMPLATES[0].lines.join('')).not.toMatch(/惦记|爱|想你/);
  });
});
