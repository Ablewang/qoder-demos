import { describe, expect, it } from 'vitest';
import raw from '../src/content/questions.json';
import { dinner, nodeById, relatives, strategyNames, type Cast } from '../src/content';

const cast: Cast[] = ['sangu', 'erjiu', 'nainai', 'dayi', 'biaojie'];
const len = (text: string) => Array.from(text).length;
const actions = dinner.nodes.flatMap(node => node.actions.map(action => ({ node, action })));

describe('饭桌剧情数据', () => {
  it('运行时导出等于 JSON；三道菜、五位入席亲戚、开局只有三姑盯着你', () => {
    expect(dinner).toEqual(raw);
    expect(dinner.scenes).toEqual(['凉菜开席', '热菜上桌', '饺子压轴']);
    expect(dinner.cast).toEqual(cast);
    expect(dinner.watching).toEqual(['sangu']);
    expect(dinner.allies).toEqual(['nainai']);
    expect(nodeById(dinner.start).scene).toBe(0);
    expect(() => nodeById('missing')).toThrow('未知节点');
  });

  it('节点 ID、动作 ID 全局唯一；每道菜都有节点', () => {
    expect(new Set(dinner.nodes.map(node => node.id)).size).toBe(dinner.nodes.length);
    expect(new Set(actions.map(item => item.action.id)).size).toBe(actions.length);
    for (const scene of [0, 1, 2]) expect(dinner.nodes.some(node => node.scene === scene)).toBe(true);
  });

  it.each(dinner.nodes.map(node => [node.id, node] as const))('%s：说话人、话题和问句完整', (_id, node) => {
    expect([...cast, 'table']).toContain(node.speaker);
    expect([...cast, 'you']).toContain(node.target);
    expect(len(node.ask)).toBeGreaterThan(4);
    expect(len(node.ask)).toBeLessThanOrEqual(24);
    expect(len(node.situation)).toBeLessThanOrEqual(32);
    expect(node.actions.length).toBeGreaterThanOrEqual(2);
    expect(node.actions.length).toBeLessThanOrEqual(5);
    for (const who of node.enter ?? []) expect(cast).toContain(who);
  });

  it.each(actions.map(({ node, action }) => [`${node.id}/${action.id}`, node, action] as const))('%s：台词、意图、后果与去向', (_key, node, action) => {
    expect(Object.keys(strategyNames)).toContain(action.strategy);
    expect(len(action.line)).toBeLessThanOrEqual(28);
    expect(len(action.intent)).toBeLessThanOrEqual(18);
    expect(action.outcomes.length).toBeGreaterThan(0);
    expect(action.outcomes[action.outcomes.length - 1].when).toBeUndefined();
    if (action.requires.length) expect(action.locks.some(lock => !lock.when)).toBe(true);
    for (const outcome of action.outcomes) {
      expect(len(outcome.risk)).toBeLessThanOrEqual(18);
      if (outcome.line) expect(len(outcome.line)).toBeLessThanOrEqual(28);
      expect(outcome.beats.length).toBeGreaterThanOrEqual(2);
      for (const beat of outcome.beats) {
        expect([...cast, 'table']).toContain(beat.who);
        expect(len(beat.text)).toBeLessThanOrEqual(26);
      }
      for (const who of [...outcome.add ?? [], ...outcome.remove ?? [], ...outcome.allies ?? [], ...outcome.use ?? []]) expect(cast).toContain(who);
      expect(Boolean(outcome.next) !== Boolean(outcome.ending)).toBe(true);
      if (outcome.ending) {
        expect(node.scene).toBe(2);
        expect(outcome.title).toBeTruthy();
        expect(outcome.summary).toBeTruthy();
      } else {
        expect(nodeById(outcome.next!).scene).toBeGreaterThanOrEqual(node.scene);
      }
    }
  });

  it('五位亲戚都有名字和性格，并且都在剧情里开口', () => {
    const speakers = new Set(dinner.nodes.flatMap(node => node.actions.flatMap(action => action.outcomes.flatMap(outcome => outcome.beats.map(beat => beat.who)))));
    for (const who of cast) {
      expect(relatives[who].name).toBeTruthy();
      expect(relatives[who].trait).toBeTruthy();
      expect(speakers.has(who)).toBe(true);
    }
  });

  it('没有旧的数值规则字样（心态、压力、余几张）', () => {
    const text = JSON.stringify(raw);
    for (const word of ['心态', '压力', '余', '张牌', '格']) expect(text).not.toContain(word);
  });
});
