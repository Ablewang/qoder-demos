import { describe, expect, it } from 'vitest';
import { availableScenes, categories, fullMessage, matchingTemplates, recipients, scenes, states, templates } from './content';

describe('内测模板库', () => {
  it('19个场景38套四段台词，六类均有代表性内容', () => {
    expect(scenes).toHaveLength(19);
    expect(templates).toHaveLength(38);
    expect(new Set(templates.map((item) => item.id)).size).toBe(38);
    for (const category of categories) expect(scenes.some((scene) => scene.categoryId === category.id)).toBe(true);
    for (const template of templates) {
      expect(scenes.some((scene) => scene.id === template.sceneId)).toBe(true);
      expect(Object.keys(template.lines).sort()).toEqual(['closing', 'ifDeclined', 'main', 'opening']);
      for (const line of Object.values(template.lines)) {
        expect(line.length).toBeGreaterThan(0);
        expect(line).not.toMatch(/<[^>]+>|\{.*\}/);
      }
    }
  });

  it('对象、场景、状态严格取交集，不跨关系凑数', () => {
    expect(matchingTemplates('teacher_leave', 'partner', 'awkward')).toEqual([]);
    expect(matchingTemplates('teacher_leave', 'teacher', 'unknown')).toEqual([]);
    expect(matchingTemplates('unknown', 'teacher', 'awkward')).toEqual([]);
    expect(availableScenes('relative')).toEqual([]);
    expect(availableScenes('teacher', 'partner')).toEqual([]);
    expect(matchingTemplates('teacher_leave', 'teacher', 'very_nervous')[0].variant).toBe('short');
    expect(matchingTemplates('teacher_leave', 'teacher', 'awkward')[0].variant).toBe('natural');
  });

  it('每个展示的对象状态均有两套可以真实换说法', () => {
    for (const recipient of recipients) {
      for (const scene of availableScenes(recipient.id)) {
        for (const state of states) {
          const items = matchingTemplates(scene.id, recipient.id, state.id);
          expect(items).toHaveLength(2);
          expect(items[0].lines.opening).not.toBe(items[1].lines.opening);
        }
      }
    }
  });

  it('完整表达只拼开场+正事，求助与当面场景只给开场', () => {
    for (const template of templates) {
      const scene = scenes.find((item) => item.id === template.sceneId)!;
      const text = fullMessage(template);
      if (text === null) continue;
      expect(scene.help).toBe(false);
      expect(text).toBe(`${template.lines.opening}\n${template.lines.main}`);
      expect(text).not.toContain(template.lines.ifDeclined);
      expect(text).not.toContain(template.lines.closing);
    }
    for (const template of templates.filter((item) => scenes.find((scene) => scene.id === item.sceneId)!.help)) expect(fullMessage(template)).toBeNull();
    for (const id of ['directions.short', 'boba.natural', 'refund.short', 'after_argument.natural']) expect(fullMessage(templates.find((item) => item.id === id)!)).toBeNull();
    expect(templates.filter((item) => fullMessage(item) !== null)).toHaveLength(26);
  });

  it('吵架后两版不预设过错、不强迫道歉、不编造昨天的具体经过，并保留安全边界', () => {
    const argument = templates.filter((template) => template.sceneId === 'after_argument');
    expect(argument).toHaveLength(2);
    for (const template of argument) {
      for (const line of Object.values(template.lines)) expect(line).not.toMatch(/道歉|对不起|我错|太冲|说重|重的话|昨天/);
      expect(template.lines.main).toMatch(/我的想法/);
    }
    expect(scenes.find((scene) => scene.id === 'after_argument')!.hint).toContain('安全、愿意沟通');
    for (const template of templates) for (const line of Object.values(template.lines)) expect(line).not.toMatch(/道歉|对不起|我错了|太冲|昨天/);
  });

  it('求助6套与普通32套分离，状态过滤不是装饰', () => {
    const helpScenes = scenes.filter((scene) => scene.help);
    expect(helpScenes).toHaveLength(3);
    expect(templates.filter((template) => helpScenes.some((scene) => scene.id === template.sceneId))).toHaveLength(6);
    const item = templates.find((template) => template.id === 'teacher_leave.short')!;
    const original = item.stateIds;
    try {
      item.stateIds = ['very_nervous'];
      expect(matchingTemplates('teacher_leave', 'teacher', 'okay').some((template) => template.id === item.id)).toBe(false);
    } finally { item.stateIds = original; }
  });
});
