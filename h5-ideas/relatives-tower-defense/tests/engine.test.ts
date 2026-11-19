import { describe, expect, it } from 'vitest';
import { dinner, nodeById, PILE_LIMIT } from '../src/content';
import { Game, preview, type State } from '../src/engine';

function play(ids: string[]): Game {
  const g = new Game();
  for (const id of ids) {
    expect(g.choose(id), `应能选择 ${id}`).not.toBeNull();
    expect(g.advance()).toBe(true);
  }
  return g;
}
const option = (g: Game, id: string) => g.options().find(item => item.id === id)!;
const said = (g: Game) => g.last!.beats.map(beat => `${beat.who}:${beat.text}`);

describe('开局与非法操作', () => {
  it('从三姑催婚开局：只有三姑盯着你，奶奶可以帮一次', () => {
    const g = new Game();
    expect(g.node.id).toBe('cold-sangu');
    expect(g.scene).toBe(0);
    expect(g.state).toEqual({ watching: ['sangu'], allies: ['nainai'], used: [], flags: [] });
    expect(g.options().map(item => [item.id, item.available])).toEqual([['ask-nainai', true], ['ask-sangu', true], ['honest-sangu', true]]);
  });

  it('未知动作、反应阶段重复选择、未选就推进都会被拒绝且不改状态', () => {
    const g = new Game();
    expect(g.choose('nope')).toBeNull();
    expect(g.advance()).toBe(false);
    expect(g.turns).toHaveLength(0);
    g.choose('ask-sangu');
    expect(g.phase).toBe('react');
    expect(g.choose('ask-nainai')).toBeNull();
    expect(g.turns).toHaveLength(1);
  });

  it('不可用动作点了无效，且给出具体原因', () => {
    const g = play(['ask-nainai', 'fishpond']);
    const helpAfterFish = option(play(['ask-nainai', 'fishpond', 'ask-erjiu']), 'ask-help');
    expect(helpAfterFish.available).toBe(true);
    expect(helpAfterFish.spent).toEqual(['erjiu']);
    expect(helpAfterFish.spent).not.toContain('nainai');
    const help = option(g, 'biaojie-help');
    expect(help.available).toBe(false);
    expect(help.lock).toBe('表姐还没站到你这边：第一道替她说句话才行');
    expect(g.choose('biaojie-help')).toBeNull();
    expect(g.phase).toBe('choose');
  });

  it('重开就是全新的一桌', () => {
    const old = play(['ask-sangu', 'cover-biaojie']);
    const fresh = new Game();
    expect(old.state).not.toEqual(fresh.state);
    expect(fresh.state).toEqual({ watching: ['sangu'], allies: ['nainai'], used: [], flags: [] });
    expect(fresh.turns).toEqual([]);
    expect(fresh.report).toBeNull();
  });
});

describe('行动 → 人物接话 → 局势变化', () => {
  it('请奶奶接话：三姑被引开，二舅顺着“吃”插进来，奶奶本局不能再请', () => {
    const g = new Game();
    const turn = g.choose('ask-nainai')!;
    expect(turn.before).toEqual(['sangu']);
    expect(turn.after).toEqual(['erjiu']);
    expect(turn.spent).toEqual(['nainai']);
    expect(turn.risk).toContain('奶奶用掉去厨房');
    expect(said(g)).toEqual([
      'nainai:加虾仁了！他三姑先尝，我去煮下一锅。',
      'sangu:哟，真鲜……行，那我回头再问。',
      'erjiu:说到吃，我倒想问问——',
    ]);
    g.advance();
    expect(g.node.id).toBe('cold-erjiu');
    expect(g.node.speaker).toBe('erjiu');
  });

  it('三个开局选择走向三个不同的后续节点和问话人', () => {
    const next = ['ask-nainai', 'ask-sangu', 'honest-sangu'].map(id => { const g = play([id]); return [g.node.id, g.node.speaker, g.node.target]; });
    expect(next).toEqual([['cold-erjiu', 'erjiu', 'you'], ['cold-biaojie', 'sangu', 'biaojie'], ['cold-dayi', 'dayi', 'you']]);
  });

  it('热菜上桌时二舅入座并盯上你', () => {
    const g = play(['honest-sangu', 'own-plan']);
    expect(g.node.id).toBe('hot-erjiu');
    expect(g.state.watching).toEqual(['erjiu', 'dayi']);
  });

  it('早先跟三姑说了实话，热菜反问二舅时三姑会替你挡；否则三姑会开始盯你', () => {
    const helped = play(['honest-sangu', 'ask-dayi']);
    expect(option(helped, 'ask-erjiu').risk).toContain('三姑支持你');
    helped.choose('ask-erjiu');
    expect(helped.state.watching).toEqual([]);
    expect(said(helped)).toContain('sangu:孩子自己有安排，咱不催。');
    const alone = play(['ask-nainai', 'enough']);
    expect(option(alone, 'ask-erjiu').risk).toContain('开始盯你');
    alone.choose('ask-erjiu');
    expect(alone.state.watching).toEqual(['sangu']);
    expect(said(alone)).toContain('sangu:所以说，你也得早点攒首付了。');
  });

  it('替表姐说话解锁帮腔；晾着表姐则她会盯你，给出记仇原因', () => {
    const friend = play(['ask-sangu', 'cover-biaojie']);
    expect(friend.state.allies).toEqual(['nainai', 'biaojie']);
    expect(option(friend, 'biaojie-help').available).toBe(true);
    const cold = play(['ask-sangu', 'eat-quietly']);
    expect(cold.state.watching).toEqual(['erjiu', 'biaojie']);
    expect(option(cold, 'biaojie-help').lock).toContain('还记着你第一道没帮她');
  });

  it('表姐热菜帮过一次后，压轴不会再被使用；奶奶仍能选', () => {
    const g = play(['ask-sangu', 'cover-biaojie', 'biaojie-help']);
    const help = option(g, 'ask-help');
    expect(help.available).toBe(true);
    expect(help.line).toContain('奶奶');
    expect(help.spent).toEqual(['nainai']);
    expect(help.ending).toBe('won');
  });

  it('二舅帮腔按来源换台词：鱼塘与碰杯都留下大姨的真实追问', () => {
    const fish = play(['ask-nainai', 'fishpond', 'ask-erjiu']);
    expect(option(fish, 'ask-help').line).toContain('增氧机');
    expect(fish.choose('ask-help')!.ending).toBeNull();
    expect(fish.state.watching).toEqual(['dayi']);
    fish.advance();
    expect(fish.node.id).toBe('one-thing');
    const toast = play(['honest-sangu', 'ask-dayi', 'lottery', 'ask-help']);
    expect(toast.node.id).toBe('helper-pick');
    expect(option(toast, 'erjiu-help').line).toBe('二舅，刚才那杯还没碰呢！');
    toast.choose('erjiu-help');
    expect(toast.last!.ending).toBeNull();
    expect(toast.state.watching).toEqual(['dayi']);
    expect(said(toast)).toContain('dayi:杯碰完了，说件今年想做的事吧？');
  });

  it('多交二舅与表姐不会锁掉未用奶奶，三人都是真正可选帮手', () => {
    const g = play(['ask-sangu', 'cover-biaojie', 'lottery', 'ask-help']);
    expect(g.options().filter(o => o.available).map(o => o.id)).toEqual(['coin-dumpling', 'erjiu-help', 'biaojie-team']);
    expect(option(g, 'coin-dumpling').spent).toEqual(['nainai']);
    g.choose('coin-dumpling');
    expect(g.state.used).toEqual(['nainai']);
    expect(g.last!.ending).toBe('won');
  });
});

describe('胜負与完整路线', () => {
  it('鱼塘帮腔不直接赢：大姨追问后可聊小事或保留全部细节', () => {
    const prefix = ['ask-nainai', 'fishpond', 'ask-erjiu', 'ask-help'];
    const g = play([...prefix, 'small-goal']);
    expect(g.phase).toBe('over');
    expect(g.report).toMatchObject({ ending: 'won', title: '用一道拿手菜收了场', dishes: 3 });
    expect(g.report!.helpers).toEqual(['erjiu', 'nainai']);
    expect(g.report!.turns.map(turn => turn.node.speaker)).toEqual(['sangu', 'erjiu', 'erjiu', 'table', 'dayi']);
    expect(g.state.watching).toEqual([]);
    const privateGame = play([...prefix, 'keep-private']);
    expect(privateGame.report!.ending).toBe('won');
    expect(privateGame.state.watching).toEqual(['dayi']);
    expect(privateGame.state.flags).not.toContain('shared-small-goal');
    expect(g.state.flags).toContain('shared-small-goal');
  });

  it('表姐分走盘问后仍能选一起讲工作或先听她讲，不替玩家直接结算', () => {
    const prefix = ['ask-sangu', 'cover-biaojie', 'lottery', 'ask-help', 'biaojie-team'];
    const shared = play([...prefix, 'both-plan']);
    expect(shared.report).toMatchObject({ ending: 'won', title: '和表姐结成了饭桌同盟', dishes: 3 });
    expect(shared.report!.helpers).toEqual(['erjiu', 'biaojie']);
    expect(shared.state.flags).toContain('shared-project');
    const listening = play([...prefix, 'listen-cousin']);
    expect(listening.phase).toBe('choose');
    expect(listening.state.watching).toEqual(['dayi']);
    expect(listening.state.flags).not.toContain('shared-project');
    listening.choose('keep-private'); listening.advance();
    expect(listening.report!.ending).toBe('won');
  });

  it('实话 → 反问大姨 → 三姑替挡 → 自己说清，三姑在压轴仍兑现关系', () => {
    const g = play(['honest-sangu', 'ask-dayi', 'ask-erjiu']);
    expect(g.state.watching).toEqual([]);
    expect(option(g, 'say-plan').available).toBe(true);
    g.choose('say-plan');
    expect(said(g)).toContain('sangu:开席就说有安排了，咱别再追着问。');
    g.advance();
    expect(g.report).toMatchObject({ ending: 'won', title: '自己把打算说清了' });
  });

  it('晾着表姐后发疯，选前预告三人，选后读完整围问再结算', () => {
    const g = play(['ask-sangu', 'eat-quietly']);
    const joke = option(g, 'lottery');
    expect(joke.after).toEqual(['sangu', 'dayi', 'biaojie']);
    expect(joke.ending).toBe('piled');
    const turn = g.choose('lottery')!;
    expect(turn.beats.slice(-2)).toEqual(dinner.pileOn);
    expect(turn.next).toBeNull();
    g.advance();
    expect(g.report).toMatchObject({ ending: 'piled', dishes: 1 });
    expect(g.report!.summary).toContain('三姑、大姨、表姐同时盯着你');
    expect(g.report!.tips[0]).toContain('别让三个人同时盯着你');
  });

  it('两人盯着也允许认真说，风险点名；被追问后仍能选两条非离席回应', () => {
    const g = play(['ask-nainai', 'fishpond', 'ask-erjiu']);
    expect(g.state.watching).toEqual(['sangu', 'dayi']);
    const plan = option(g, 'say-plan');
    expect(plan.available).toBe(true);
    expect(plan.risk).toContain('三姑、大姨追问日期');
    g.choose('say-plan'); g.advance();
    expect(g.node.id).toBe('plan-followup');
    expect(g.options().map(o => [o.id, o.available])).toEqual([['one-step', true], ['draw-line', true]]);
    expect(option(g, 'one-step').ending).toBe('won');
    expect(option(g, 'draw-line').ending).toBe('piled');
    expect(option(g, 'draw-line').risk).toContain('会被围住');
  });

  it('同一句边界在表姐和二舅关系下有不同接话，代价是正式使用对应帮忙', () => {
    const cousin = play(['ask-sangu', 'cover-biaojie', 'lottery', 'say-plan']);
    expect(option(cousin, 'draw-line').spent).toEqual(['biaojie']);
    cousin.choose('draw-line');
    expect(said(cousin)[0]).toContain('biaojie:刚才你护我');
    const uncle = play(['ask-nainai', 'enough', 'lottery', 'say-plan']);
    expect(option(uncle, 'draw-line').spent).toEqual(['erjiu']);
    uncle.choose('draw-line');
    expect(said(uncle)[0]).toContain('erjiu:刚才都笑了');
    expect(cousin.last!.ending).toBe('won');
    expect(uncle.last!.ending).toBe('won');
  });

  it('离席在任何未结束时刻可用，不再占一张说法卡', () => {
    const kitchen = play(['honest-sangu', 'own-plan', 'ask-erjiu']);
    expect(kitchen.options().some(o => o.strategy === 'leave')).toBe(false);
    expect(kitchen.leave()).toBe(true);
    expect(kitchen.report).toMatchObject({ ending: 'left', title: '借口离席，这顿先吃到这', dishes: 2 });
    const early = new Game();
    expect(early.leave()).toBe(true);
    expect(early.report).toMatchObject({ ending: 'left', dishes: 0 });
    expect(early.leave()).toBe(false);
    expect(early.choose('ask-sangu')).toBeNull();
    expect(early.advance()).toBe(false);
  });
});

describe('穷举所有路径：非离席选择、预告一致、无死局', () => {
  interface Path { ids: string[]; game: Game }
  const finished: Path[] = [];
  const finals = new Map<string, { ids: string[]; game: Game }>();
  const walk = (ids: string[]) => {
    const g = play(ids);
    if (g.phase === 'over') { finished.push({ ids, game: g }); return; }
    expect(ids.length).toBeLessThan(7);
    const options = g.options();
    expect(options.length, g.node.id).toBeGreaterThanOrEqual(2);
    expect(options.length, g.node.id).toBeLessThanOrEqual(3);
    const open = options.filter(item => item.available && item.strategy !== 'leave');
    expect(open.length, `${ids.join('>')} 至少两条非离席说法`).toBeGreaterThanOrEqual(2);
    expect(open.length, `${ids.join('>')} 每节点至多三条`).toBeLessThanOrEqual(3);
    const exit = play(ids);
    expect(exit.leave()).toBe(true);
    expect(exit.report!.ending).toBe('left');
    expect(exit.report!.turns.map(t => t.id)).toEqual(ids);
    if (g.node.id === 'dumpling') finals.set(ids.join('>'), { ids, game: g });
    for (const item of options) {
      expect(item.risk).not.toContain('{');
      if (!item.available) { expect(item.lock.length).toBeGreaterThan(4); expect(item.lock).not.toContain('{'); continue; }
      const probe = play(ids);
      const before: State = structuredClone(probe.state);
      const turn = probe.choose(item.id)!;
      expect(turn.before).toEqual(before.watching);
      expect(probe.state.watching).toEqual(item.after);
      expect(turn.ending).toBe(item.ending);
      expect(turn.beats.length).toBeGreaterThanOrEqual(2);
      if (item.ending === 'piled') expect(item.after.length).toBeGreaterThanOrEqual(PILE_LIMIT);
      else expect(item.after.length).toBeLessThan(PILE_LIMIT);
      walk([...ids, item.id]);
    }
  };
  walk([]);

  it('所有路径七次开口以内结束；胜、围以及任意节点离席都有出口', () => {
    expect(finished.length).toBeGreaterThan(32);
    for (const path of finished) expect(path.ids.length).toBeLessThanOrEqual(7);
    expect(new Set(finished.map(path => path.game.report!.ending))).toEqual(new Set(['won', 'piled']));
  });

  it('十二条压轴入场路径全部有认真说与轮聊，且后果或后续节点真实不同', () => {
    expect(finals.size).toBe(12);
    for (const { game } of finals.values()) {
      expect(option(game, 'say-plan').available).toBe(true);
      expect(option(game, 'table-round').available).toBe(true);
      const effects = game.options().filter(o => o.available).map(o => {
        const g = new Game(); g.node = game.node; g.state = structuredClone(game.state);
        const turn = g.choose(o.id)!;
        return JSON.stringify([g.state, turn.next, turn.ending]);
      });
      expect(new Set(effects).size).toBe(effects.length);
    }
  });

  it('压轴每一局面都能不靠帮腔或离席完成，认真说不是作者指定的死路', () => {
    for (const { ids, game } of finals.values()) {
      const g = play([...ids, 'say-plan']);
      if (g.phase !== 'over') { g.choose('one-step'); g.advance(); }
      expect(g.report!.ending).toBe('won');
      expect(g.state.used).toEqual(game.state.used);
      const round = play([...ids, 'table-round', 'keep-private']);
      expect(round.report!.ending).toBe('won');
      expect(round.state.used).toEqual(game.state.used);
      expect(round.state.flags).not.toContain('shared-project');
    }
  });

  it('获胜方式不止一种，且每个开局都能赢', () => {
    const wins = finished.filter(path => path.game.report!.ending === 'won');
    expect(new Set(wins.map(path => path.game.report!.title)).size).toBeGreaterThanOrEqual(4);
    for (const first of ['ask-nainai', 'ask-sangu', 'honest-sangu']) expect(wins.some(path => path.ids[0] === first)).toBe(true);
  });

  it('同一开局不同选择的后果不同；预览始终是纯函数', () => {
    for (const node of dinner.nodes.filter(item => item.scene < 2)) {
      const path = finished.find(p => p.game.report!.turns.some(t => t.node.id === node.id))!;
      const index = path.game.report!.turns.findIndex(turn => turn.node.id === node.id);
      const g = play(path.ids.slice(0, index));
      const effects = g.options().filter(item => item.available).map(item => {
        const probe = play(path.ids.slice(0, index));
        const turn = probe.choose(item.id)!;
        return JSON.stringify([probe.state, turn.next, turn.ending]);
      });
      expect(new Set(effects).size, node.id).toBe(effects.length);
      const snapshot = structuredClone(g.state);
      for (const action of nodeById(node.id).actions) preview(action, g.state);
      expect(g.state).toEqual(snapshot);
    }
  });
});
