import { describe, expect, it } from 'vitest';
import { Game, MAX_MOOD, TOTAL_TURNS, type Carry, type Reward, type TurnResult } from '../src/engine';
import { identities, questions, relatives, type Card, type Identity, type Question } from '../src/content';

const identityIds = identities.map(identity => identity.id);
const seeds = [0, 1, 2, 8, 42, 2026, 20261118, -1, 0xffffffff];
const realCases = identityIds.flatMap(identity => seeds.map(seed => ({ identity, seed })));
const fixturePressures = [1, 2, 2, 5, 2, 5, 2, 6];
const cards: Card[] = ['taiji', 'counter', 'sincere', 'crazy'];
const rewards: Reward[] = ['soup', 'counter', 'sincere', 'crazy'];
const referenceRoute: ArithmeticRoute = {
  cards: ['taiji', 'taiji', 'counter', 'crazy', 'sincere', 'crazy', 'sincere', 'crazy'],
  rewards: ['crazy', 'crazy', 'soup'], mood: 3,
};

function sourceFor(identity: Identity = 'single'): Question[] {
  const template = questions.find(q => q.kind === 'normal' && q.identities.includes(identity))!;
  return [
    { ...template, id: 'special', identities: [identity], askers: ['erjiu'] },
    ...Array.from({ length: 4 }, (_, i): Question => ({
      ...template, id: `ordinary-${i}`, kind: i % 2 ? 'fast' : 'normal',
      identities: [...identityIds], askers: ['gufu'],
    })),
    ...Array.from({ length: 2 }, (_, i): Question => ({
      ...template, id: `tough-${i}`, kind: 'tough', identities: [...identityIds], askers: ['dayi'],
    })),
    { ...template, id: 'boss', kind: 'boss', identities: [identity], askers: ['table'] },
  ];
}

function plannedPressures(game: Game): number[] {
  return Array.from({ length: 4 }, (_, wave) => game.mealPressures(wave)).flat();
}

const fixtureSeeds = new Map<number, number>();
// WHY: 只通过公开 mealPressures 找合法 V3 题序，不改 Game 内部或引入生产开关。
function fixture(seed = 1): Game {
  const cached = fixtureSeeds.get(seed);
  if (cached !== undefined) return new Game('single', cached, sourceFor());
  for (let candidate = seed; candidate < seed + 10000; candidate++) {
    const game = new Game('single', candidate, sourceFor());
    if (plannedPressures(game).join() === fixturePressures.join()) {
      fixtureSeeds.set(seed, candidate);
      return game;
    }
  }
  throw new Error('找不到静态种子 fixture');
}

interface ArithmeticState {
  index: number;
  mood: number;
  charges: Record<Card, number>;
  carry: number;
  used: number;
}
interface ArithmeticRoute {
  cards: Card[];
  rewards: Reward[];
  mood: number;
}
interface RouteConstraints {
  prefixCards?: Card[];
  prefixRewards?: Reward[];
  rewardChoices?: Reward[];
  requireAllCards?: boolean;
}

function initialArithmeticState(): ArithmeticState {
  return { index: 0, mood: 6, charges: { taiji: Infinity, counter: 2, sincere: 2, crazy: 1 }, carry: 0, used: 0 };
}

// WHY: 路线搜索只用已知基础压力和独立算术，不试出业务函数或修改 Game。
function arithmeticPlay(state: ArithmeticState, plan: number[], card: Card): ArithmeticState | null {
  if (state.index >= 8 || state.mood <= 0 || state.charges[card] <= 0) return null;
  const pressure = Math.max(0, plan[state.index] + state.carry);
  const capacity = card === 'taiji' ? 1 : card === 'counter' ? 3 : card === 'crazy' ? pressure
    : plan[state.index] >= 5 ? 1 : 2;
  const loss = Math.max(0, pressure - capacity) + Number(card === 'crazy');
  return {
    index: state.index + 1, mood: Math.max(0, state.mood - loss),
    charges: { ...state.charges, [card]: state.charges[card] - Number(card !== 'taiji') },
    carry: state.index === 7 ? 0 : card === 'counter' ? 1 : card === 'sincere' ? -1 : 0,
    used: state.used | (1 << cards.indexOf(card)),
  };
}

function arithmeticReward(state: ArithmeticState, reward: Reward): ArithmeticState | null {
  if (![2, 4, 6].includes(state.index) || state.mood <= 0) return null;
  if (reward === 'soup') return state.mood < 6 ? { ...state, mood: state.mood + 1 } : null;
  return state.charges[reward] < 3 ? { ...state, charges: { ...state.charges, [reward]: state.charges[reward] + 1 } } : null;
}

function analyzePlan(plan: number[], constraints: RouteConstraints = {}) {
  const memo = new Map<string, ArithmeticRoute | null>();
  const signatureMemo = new Map<string, Set<number>>();
  const key = (state: ArithmeticState) => JSON.stringify([
    state.index, state.mood, state.charges.counter, state.charges.sincere, state.charges.crazy,
    state.carry, constraints.requireAllCards ? state.used : 0,
  ]);
  function transitions(state: ArithmeticState) {
    const transitions: { card: Card; reward?: Reward; state: ArithmeticState }[] = [];
    const fixedCard = constraints.prefixCards?.[state.index];
    for (const card of fixedCard ? [fixedCard] : cards) {
      const played = arithmeticPlay(state, plan, card);
      if (!played || played.mood === 0) continue;
      if (![2, 4, 6].includes(played.index)) {
        transitions.push({ card, state: played });
        continue;
      }
      const fixedReward = constraints.prefixRewards?.[played.index / 2 - 1];
      for (const reward of fixedReward ? [fixedReward] : constraints.rewardChoices ?? rewards) {
        const supplied = arithmeticReward(played, reward);
        if (supplied) transitions.push({ card, reward, state: supplied });
      }
    }
    return transitions;
  }
  function solve(state: ArithmeticState = initialArithmeticState()): ArithmeticRoute | null {
    const stateKey = key(state);
    if (memo.has(stateKey)) return memo.get(stateKey)!;
    if (state.index === 8) {
      const result = state.mood > 0 && (!constraints.requireAllCards || state.used === 15)
        ? { cards: [], rewards: [], mood: state.mood } : null;
      memo.set(stateKey, result);
      return result;
    }
    let best: ArithmeticRoute | null = null;
    for (const transition of transitions(state)) {
      const suffix = solve(transition.state);
      if (suffix && (!best || suffix.mood > best.mood)) {
        best = {
          cards: [transition.card, ...suffix.cards],
          rewards: [...(transition.reward ? [transition.reward] : []), ...suffix.rewards],
          mood: suffix.mood,
        };
      }
    }
    memo.set(stateKey, best);
    return best;
  }
  // 两位编码一张牌，共享后缀避免逐串重跑奖励搜索。
  function allWinningCards(state: ArithmeticState = initialArithmeticState()): Set<number> {
    const stateKey = key(state);
    const cached = signatureMemo.get(stateKey);
    if (cached) return cached;
    const signatures = new Set<number>();
    if (solve(state)) {
      if (state.index === 8) signatures.add(0);
      else for (const transition of transitions(state)) {
        const prefix = cards.indexOf(transition.card) * 4 ** (7 - state.index);
        for (const suffix of allWinningCards(transition.state)) signatures.add(prefix + suffix);
      }
    }
    signatureMemo.set(stateKey, signatures);
    return signatures;
  }
  return { solve, allWinningCards };
}

function winningRoute(game: Game, constraints: RouteConstraints = {}): ArithmeticRoute {
  const route = analyzePlan(plannedPressures(game), constraints).solve();
  expect(route).not.toBeNull();
  return route!;
}

function arithmeticMoods(plan: number[], choices: Card[], supplies: Reward[]): number[] {
  let state = initialArithmeticState();
  const moods: number[] = [];
  let supplyIndex = 0;
  for (const card of choices) {
    const played = arithmeticPlay(state, plan, card);
    expect(played).not.toBeNull();
    state = played!;
    moods.push(state.mood);
    if (state.mood === 0) break;
    if ([2, 4, 6].includes(state.index)) {
      const supplied = arithmeticReward(state, supplies[supplyIndex++]);
      expect(supplied).not.toBeNull();
      state = supplied!;
    }
  }
  return moods;
}

const sequenceCases = Array.from({ length: 5 }, (_, first) =>
  Array.from({ length: 4 - first }, (_, offset) => {
    const second = first + offset + 1;
    const plan = [1, 2, ...Array.from({ length: 5 }, (_, i) => i === first || i === second ? 5 : 2), 6];
    return { name: plan.join('-'), plan };
  })).flat();
const sequenceSeeds = new Map<string, number>();
function gameForPlan(plan: number[]): Game {
  const name = plan.join('-');
  const cached = sequenceSeeds.get(name);
  if (cached !== undefined) return new Game('single', cached);
  for (let seed = 1; seed <= 10000 && sequenceSeeds.size < 10; seed++) {
    const game = new Game('single', seed);
    const key = plannedPressures(game).join('-');
    if (!sequenceSeeds.has(key)) sequenceSeeds.set(key, seed);
  }
  const seed = sequenceSeeds.get(name);
  if (seed === undefined) throw new Error(`找不到压力序列 ${name}`);
  return new Game('single', seed);
}

function visibleCard(pressure: number, basePressure: number, charges: Record<Card, number>): Card {
  if (pressure <= 1) return 'taiji';
  if (basePressure >= 5 && charges.crazy > 0) return 'crazy';
  if (basePressure < 5 && charges.sincere > 0) return 'sincere';
  return charges.counter > 0 ? 'counter' : 'taiji';
}

function visibleReward(mood: number, charges: Record<Card, number>, nextMeal: number[], lastMeal: boolean): Reward {
  const h = nextMeal.filter(pressure => pressure >= 5).length;
  const crazyTarget = Math.min(2, h + Number(!lastMeal));
  if (charges.crazy < crazyTarget) return 'crazy';
  return (['soup', 'sincere', 'counter', 'crazy'] as Reward[])
    .find(reward => reward === 'soup' ? mood < 6 : charges[reward] < 3)!;
}

// WHY: 只按本问与下一菜公开预告作决策，规则回归不冒充浏览器自然局。
function visibleArithmeticRoute(plan: number[]): ArithmeticRoute {
  let state = initialArithmeticState();
  const choices: Card[] = [];
  const supplies: Reward[] = [];
  while (state.index < 8 && state.mood > 0) {
    const card = visibleCard(Math.max(0, plan[state.index] + state.carry), plan[state.index], state.charges);
    choices.push(card);
    state = arithmeticPlay(state, plan, card)!;
    if (state.mood > 0 && [2, 4, 6].includes(state.index)) {
      const reward = visibleReward(state.mood, state.charges, plan.slice(state.index, state.index + 2), state.index === 6);
      supplies.push(reward);
      state = arithmeticReward(state, reward)!;
    }
  }
  return { cards: choices, rewards: supplies, mood: state.mood };
}

function snapshot(game: Game): string {
  return JSON.stringify({
    identity: game.identity, phase: game.phase, mood: game.mood, charges: game.charges,
    history: game.history, report: game.report, index: game.index, wave: game.wave,
    target: game.target, lastResult: game.lastResult, resolved: game.resolved,
    meals: Array.from({ length: 4 }, (_, wave) => game.mealPressures(wave)),
    previews: cards.map(card => game.preview(card)),
  }, (_key, value) => value === Infinity ? 'Infinity' : value);
}

function expectedPlay(game: Game, card: Card) {
  const { pressure, question, asker } = game.target;
  const blocked = Math.min(pressure, { taiji: 1, counter: 3, sincere: ['tough', 'boss'].includes(question.kind) ? 1 : 2, crazy: pressure }[card]);
  const loss = Math.max(0, pressure - blocked) + Number(card === 'crazy');
  const next: Carry | null = game.index === 7 || !['counter', 'sincere'].includes(card)
    ? null : { kind: card === 'counter' ? 'followup' : 'ally', asker, amount: 1 };
  return { blocked, loss, cost: Number(card === 'crazy'), next };
}

function answer(game: Game, card: Card): TurnResult {
  const target = game.target;
  const oldTarget = JSON.stringify(target);
  const mood = game.mood;
  const charges = { ...game.charges };
  const oracle = expectedPlay(game, card);
  const before = snapshot(game);
  expect(game.preview(card)).toEqual({ card, available: true, ...oracle });
  expect(snapshot(game)).toBe(before);
  expect(game.play(card)).toBe(true);
  expect(game.lastResult).toEqual({
    turn: target.index + 1, question: target.question, asker: target.asker,
    basePressure: target.basePressure, pressure: target.pressure, incoming: target.incoming,
    card, quote: target.question.answers[card], reply: expect.any(String),
    blocked: oracle.blocked, loss: oracle.loss, moodBefore: mood, moodAfter: Math.max(0, mood - oracle.loss), next: oracle.next,
  });
  expect(game.mood).toBe(Math.max(0, mood - oracle.loss));
  expect(game.charges).toEqual({ ...charges, [card]: charges[card] - Number(card !== 'taiji') });
  expect(game.resolved).toBe(target.index + 1);
  expect(game.target).toBe(target);
  expect(JSON.stringify(target)).toBe(oldTarget);
  expect(game.lastResult!.question).toBe(target.question);
  expect(game.history[target.index]).toBe(game.lastResult);
  if (target.incoming) expect(game.lastResult!.incoming).not.toBe(target.incoming);
  if (card === 'sincere') expect(game.lastResult!.reply).toBe(relatives[target.asker].line);
  if (game.phase === 'reward') {
    expect(game.next()).toBe(false);
    expect(game.target).toBe(target);
  }
  const played = snapshot(game);
  for (const other of cards) {
    expect(game.canPlay(other)).toBe(false);
    expect(game.preview(other).available).toBe(false);
    expect(game.play(other)).toBe(false);
  }
  expect(snapshot(game)).toBe(played);
  return game.lastResult!;
}

function continueTurn(game: Game, choice: Reward = 'soup'): void {
  const target = game.target;
  const beforeTarget = JSON.stringify(target);
  const result = game.lastResult!;
  if (game.phase === 'reward') {
    expect([2, 4, 6]).toContain(result.turn);
    expect(game.mood).toBeGreaterThan(0);
    expect(game.canReward(choice)).toBe(true);
    const mood = game.mood;
    const charges = { ...game.charges };
    expect(game.reward(choice)).toBe(true);
    expect(game.mood).toBe(mood + Number(choice === 'soup'));
    expect(game.charges).toEqual(choice === 'soup' ? charges : { ...charges, [choice]: charges[choice] + 1 });
    const after = snapshot(game);
    for (const reward of rewards) expect(game.reward(reward)).toBe(false);
    expect(snapshot(game)).toBe(after);
  } else {
    expect(game.phase).toBe('feedback');
    expect(game.next()).toBe(true);
  }
  expect(JSON.stringify(target)).toBe(beforeTarget);
  expect(game.lastResult).toBe(result);
  if (game.phase === 'question') {
    expect(game.target).not.toBe(target);
    expect(game.target.index).toBe(target.index + 1);
    expect(game.target.incoming).toEqual(result.next);
    if (result.next) expect(game.target.incoming).not.toBe(result.next);
  } else expect(game.target).toBe(target);
}

function drive(game: Game, choices: Card[], supplies: Reward[]): number[] {
  const usedRewards: number[] = [];
  for (const card of choices) {
    if (game.phase === 'finished') break;
    expect(game.phase).toBe('question');
    answer(game, card);
    if (game.phase === 'reward') {
      usedRewards.push(game.index + 1);
      continueTurn(game, supplies[usedRewards.length - 1]);
    } else continueTurn(game);
  }
  return usedRewards;
}

function expectTaijiFailure(game: Game): void {
  const plan = plannedPressures(game);
  const choices = Array<Card>(8).fill('taiji');
  const supplies: Reward[] = ['soup', 'soup', 'soup'];
  const moods = arithmeticMoods(plan, choices, supplies);
  // 死亡时没有奖励，也不能再走剩余题；V3 会在第 4/5/6 问结束。
  expect(drive(game, choices, supplies)).toEqual([2, 4, 6].filter(turn => moods[turn - 1] > 0));
  expect(game.history.map(turn => turn.moodAfter)).toEqual(moods);
  expect([4, 5, 6]).toContain(moods.length);
  expect(game.report).toMatchObject({ won: false, mood: 0, turns: moods.length, blocked: 1, counters: 0, sincere: 0, allies: 0 });
  expectReport(game);
}

function expectReport(game: Game): void {
  const report = game.report!;
  expect(game.phase).toBe('finished');
  expect(report).toMatchObject({
    identity: game.identity, mood: game.mood, turns: game.resolved, history: game.history,
    blocked: game.history.filter(turn => turn.loss === 0).length,
    counters: game.history.filter(turn => turn.card === 'counter').length,
    sincere: game.history.filter(turn => turn.card === 'sincere').length,
    allies: game.history.filter(turn => turn.incoming?.kind === 'ally').length,
    title: report.won ? '这桌饭，吃完了' : '先去厨房歇一歇',
  });
  expect(report.history).not.toBe(game.history);
  expect(report.history.map(turn => turn.turn)).toEqual(Array.from({ length: game.resolved }, (_, i) => i + 1));
  for (const [index, turn] of report.history.entries()) {
    expect(turn).toBe(game.history[index]);
    const previous = report.history[index - 1];
    expect(turn.incoming).toEqual(previous?.next ?? null);
    expect(turn.basePressure).toBe(game.mealPressures(Math.floor(index / 2))[index % 2]);
    expect(turn.blocked).toBeGreaterThanOrEqual(0);
    expect(turn.blocked).toBeLessThanOrEqual(turn.pressure);
    expect(turn.pressure).toBe(Math.max(0, turn.basePressure + (turn.incoming?.kind === 'followup' ? 1 : turn.incoming ? -1 : 0)));
    expect(turn.quote).toBe(turn.question.answers[turn.card]);
    if (turn.card === 'sincere') expect(turn.reply).toBe(relatives[turn.asker].line);
    if (turn.incoming) expect(turn.incoming.asker).toBe(previous.asker);
    expect(turn.loss).toBe(Math.max(0, turn.pressure - turn.blocked) + Number(turn.card === 'crazy'));
    expect(turn.moodAfter).toBe(Math.max(0, turn.moodBefore - turn.loss));
    if (index > 0) {
      const recovery = turn.moodBefore - previous.moodAfter;
      expect([0, 1]).toContain(recovery);
      if (recovery) expect([2, 4, 6]).toContain(previous.turn);
    }
  }
  const spoken = [...new Set(report.history.flatMap(turn => [
    ...(turn.incoming?.kind === 'ally' ? [relatives[turn.incoming.asker].line] : []),
    turn.quote, turn.reply,
  ]))];
  expect(report.quotes).toEqual(spoken.length ? spoken : ['先去厨房歇一歇，大家慢慢吃。']);
  expect(report.lines).toEqual([
    `回答了 ${report.turns} 问 · 心态剩余 ${report.mood}/6`,
    `未扣心态 ${report.blocked} 问 · 反问 ${report.counters} 次`,
    `真心 ${report.sincere} 次 · 帮腔兑现 ${report.allies} 次`,
  ]);
  expect(report.highlights.length).toBeLessThanOrEqual(3);
  expect(new Set(report.highlights.map(turn => turn.turn)).size).toBe(report.highlights.length);
  expect(report.highlights.map(turn => turn.turn)).toEqual(report.highlights.map(turn => turn.turn).sort((a, b) => a - b));
  for (const turn of report.highlights) expect(report.history).toContain(turn);
  for (const kind of ['ally', 'followup'] as const) {
    const cause = report.history.find((turn, index) => turn.next?.kind === kind
      && report.history[index + 1]?.incoming?.kind === kind);
    if (cause) expect(report.highlights).toContain(cause);
  }
  if (report.history.length) expect(report.highlights).toContain(report.history[report.history.length - 1]);
  for (const removed of ['score', 'days', 'grade', 'criticals', 'missed', 'elapsed']) expect(report).not.toHaveProperty(removed);
}

describe('八问题序与构造', () => {
  it('API 初始状态是 6 心态、8 问、四菜每两问一波，无旧计时接口（静态种子 fixture）', () => {
    const game = fixture();
    expect(MAX_MOOD).toBe(6);
    expect(TOTAL_TURNS).toBe(8);
    expect(game).toMatchObject({ identity: 'single', phase: 'question', mood: 6, index: 0, wave: 0, resolved: 0, history: [], report: null });
    expect(game.charges).toEqual({ taiji: Infinity, counter: 2, sincere: 2, crazy: 1 });
    expect(game.lastResult).toBeUndefined();
    expect(game.target).toMatchObject({ index: 0, basePressure: 1, pressure: 1, incoming: null });
    for (const removed of ['tick', 'active', 'select', 'skipReading', 'togglePause', 'elapsed', 'cooldown', 'log']) expect(game).not.toHaveProperty(removed);
    const before = snapshot(game);
    expect(game.next()).toBe(false);
    for (const reward of rewards) {
      expect(game.canReward(reward)).toBe(false);
      expect(game.reward(reward)).toBe(false);
    }
    expect(snapshot(game)).toBe(before);
  });

  it.each(realCases)('$identity / $seed：完整合法八问，首两问/末问固定，中段三普通两 tough，两问一波', ({ identity, seed }) => {
    const game = new Game(identity, seed);
    const plan = plannedPressures(game);
    const route = winningRoute(game);
    expect(plan.slice(0, 2)).toEqual([1, 2]);
    expect(plan[7]).toBe(6);
    expect(plan.slice(2, 7).sort()).toEqual([2, 2, 2, 5, 5]);
    const normal: string[] = [];
    const tough: string[] = [];
    for (const [index, card] of route.cards.entries()) {
      const target = game.target;
      expect(game.index).toBe(index);
      expect(game.wave).toBe(Math.floor(index / 2));
      expect(target.index).toBe(index);
      expect(target.basePressure).toBe(plan[index]);
      expect(game.mealPressures(game.wave)).toEqual(plan.slice(game.wave * 2, game.wave * 2 + 2));
      expect(target.question.identities).toContain(identity);
      expect(target.question.askers).toContain(target.asker);
      expect(relatives[target.asker]).toBeDefined();
      if (index === 0) expect(target.question.identities).toEqual([identity]);
      if (plan[index] === 5) {
        expect(target.question.kind).toBe('tough');
        tough.push(target.question.id);
      } else if (index === 7) expect(target.question.kind).toBe('boss');
      else {
        expect(['normal', 'fast']).toContain(target.question.kind);
        normal.push(target.question.id);
      }
      answer(game, card);
      continueTurn(game, route.rewards[Math.floor(index / 2)]);
    }
    expect(new Set(normal).size).toBe(5);
    expect(new Set(tough).size).toBe(2);
    expect(new Set(game.history.map(turn => turn.question.id)).size).toBe(8);
    expect(game.report).toMatchObject({ won: true, mood: route.mood, turns: 8 });
    expect([4, 5]).toContain(route.mood);
    expectReport(game);
  });

  it('没有身份专属普通题时回退到合法共享普通题；warm/followup 不参与八问', () => {
    const source = sourceFor().map(q => ({ ...q, identities: [...identityIds] }));
    source.push({ ...source[0], id: 'unused-warm', kind: 'warm' }, { ...source[0], id: 'unused-followup', kind: 'followup' });
    const game = new Game('single', 42, source);
    const route = winningRoute(game);
    drive(game, route.cards, route.rewards);
    expect(game.history.every(turn => !['warm', 'followup'].includes(turn.question.kind))).toBe(true);
    expect(game.report!.won).toBe(true);
  });

  it('缺普通题、两条 tough、boss 或合法 asker 时拒绝不完整题库，重复 ID 不补足题数', () => {
    const source = sourceFor();
    for (const id of ['ordinary-0', 'tough-0', 'boss']) {
      expect(() => new Game('single', 1, source.filter(q => q.id !== id))).toThrow('身份题库不完整');
    }
    expect(() => new Game('exam', 1, source)).toThrow('身份题库不完整');
    expect(() => new Game('single', 1, source.map(q => q.id === 'tough-1' ? { ...q, id: 'tough-0' } : q))).toThrow('身份题库不完整');
    for (const askers of [[], ['unknown'] as unknown as Question['askers']]) {
      expect(() => new Game('single', 1, source.map(q => q.id === 'special' ? { ...q, askers } : q))).toThrow('非法发问亲戚');
    }
  });

  it('相同种子精确复现题序与 asker，0 等效 1，xorshift 不退化为固定题序且 source 不变', () => {
    const source = questions.map(q => Object.freeze({ ...q, answers: Object.freeze({ ...q.answers }) }));
    const original = JSON.stringify(source);
    for (const seed of seeds) {
      const left = new Game('graduate', seed, source);
      const right = new Game('graduate', seed, source);
      const route = winningRoute(left);
      drive(left, route.cards, route.rewards);
      drive(right, route.cards, route.rewards);
      expect(snapshot(left)).toBe(snapshot(right));
    }
    expect(snapshot(new Game('single', 0))).toBe(snapshot(new Game('single', 1)));
    const orders = seeds.map(seed => {
      const game = new Game('single', seed);
      const route = winningRoute(game);
      drive(game, route.cards, route.rewards);
      return game.history.map(turn => `${turn.question.id}:${turn.asker}`).join('|');
    });
    expect(new Set(orders).size).toBeGreaterThan(1);
    expect(JSON.stringify(source)).toBe(original);
  });
});

describe('随机中段的完整十种压力序列', () => {
  it('多种种子覆盖全部中段顺序；meal 预览准确、重复读取无副作用，返回数组不能改业务', () => {
    for (const { plan } of sequenceCases) gameForPlan(plan);
    const variedSeeds = [...new Set([...seeds, ...sequenceSeeds.values()])];
    const orders = new Set<string>();
    for (const seed of variedSeeds) {
      const game = new Game('single', seed);
      const untouched = new Game('single', seed);
      const plan = plannedPressures(untouched);
      orders.add(plan.slice(2, 7).join());
      const before = snapshot(game);
      const target = game.target;
      for (let read = 0; read < 3; read++) {
        for (let wave = 0; wave < 4; wave++) {
          const meal = game.mealPressures(wave);
          expect(meal).toEqual(plan.slice(wave * 2, wave * 2 + 2));
          expect(meal).not.toBe(game.mealPressures(wave));
          meal.fill(99);
          meal.push(99);
          expect(game.mealPressures(wave)).toEqual(plan.slice(wave * 2, wave * 2 + 2));
        }
        for (const card of cards) game.preview(card);
      }
      expect(game.target).toBe(target);
      expect(snapshot(game)).toBe(before);
      expect(snapshot(game)).toBe(snapshot(untouched));
      const route = winningRoute(game);
      drive(game, route.cards, route.rewards);
      drive(untouched, route.cards, route.rewards);
      expect(game.history.map(turn => turn.basePressure)).toEqual(plan);
      expect(snapshot(game)).toBe(snapshot(untouched));
      expectReport(game);
    }
    expect(orders.size).toBe(10);
  });

  it.each(sequenceCases)('$name：独立先知模型最优末心 4/5 与真实 Game 一致，全 T 加可领汤提前失败', ({ plan }) => {
    const win = gameForPlan(plan);
    const route = analyzePlan(plan).solve();
    expect(plannedPressures(win)).toEqual(plan);
    expect(route).not.toBeNull();
    expect([4, 5]).toContain(route!.mood);
    expect(drive(win, route!.cards, route!.rewards)).toEqual([2, 4, 6]);
    expect(win.report).toMatchObject({ won: true, mood: route!.mood, turns: 8 });
    expect(win.history.map(turn => turn.moodAfter)).toEqual(arithmeticMoods(plan, route!.cards, route!.rewards));
    expectReport(win);
    expectTaijiFailure(gameForPlan(plan));
  });

  it('首两问 15 种合法选牌 × 合法首补 × 10 序列：离线先知可救 495/540，仅为模型上界', () => {
    let total = 0;
    let rescued = 0;
    const perPlan: number[] = [];
    for (const { plan } of sequenceCases) {
      const analysis = analyzePlan(plan);
      let legalPrefixes = 0;
      let planTotal = 0;
      let planRescued = 0;
      for (const first of cards) for (const second of cards) {
        const one = arithmeticPlay(initialArithmeticState(), plan, first)!;
        const two = arithmeticPlay(one, plan, second);
        if (!two) continue;
        legalPrefixes++;
        const legalRewards = rewards.filter(reward => arithmeticReward(two, reward) !== null);
        expect(legalRewards.length).toBeGreaterThan(0);
        for (const reward of legalRewards) {
          total++;
          planTotal++;
          // 已知完整 plan 的最优后缀，不代表不看未来的玩家、更不代表 100% 补救。
          const suffix = analysis.solve(arithmeticReward(two, reward)!);
          if (!suffix) {
            expect(analyzePlan(plan, { prefixCards: [first, second], prefixRewards: [reward] }).solve()).toBeNull();
            continue;
          }
          rescued++;
          planRescued++;
          const game = gameForPlan(plan);
          const choices = [first, second, ...suffix.cards];
          const supplies = [reward, ...suffix.rewards];
          expect(drive(game, choices, supplies)).toEqual([2, 4, 6]);
          expect(game.history[1].moodAfter).toBe(two.mood);
          expect(game.history.map(turn => turn.moodAfter)).toEqual(arithmeticMoods(plan, choices, supplies));
          expect(game.report).toMatchObject({ won: true, mood: suffix.mood, turns: 8 });
          expectReport(game);
        }
      }
      expect(legalPrefixes).toBe(15);
      expect(planTotal).toBe(54);
      perPlan.push(planRescued);
    }
    expect(perPlan).toEqual([36, 48, 44, 47, 54, 52, 52, 54, 54, 54]);
    expect({ total, rescued, unrescuable: total - rescued }).toEqual({ total: 540, rescued: 495, unrescuable: 45 });
  });

  it('ZC 首两问后的固定首补并非万能：先知上界汤 5/10、C 5/10、S 4/10、Z 10/10', () => {
    const rescued = Object.fromEntries(rewards.map(reward => [reward, 0]));
    for (const { plan } of sequenceCases) for (const reward of rewards) {
      const route = analyzePlan(plan, { prefixCards: ['crazy', 'counter'], prefixRewards: [reward] }).solve();
      if (route) rescued[reward]++;
    }
    expect(rescued).toEqual({ soup: 5, counter: 5, sincere: 4, crazy: 10 });
  });

  it('全部 65536 固定八张串：每序列允许任意合法可赢奖励，十序列交集仍为空（非仅最优路线）', () => {
    const winningSets = sequenceCases.map(({ plan }) => {
      const analysis = analyzePlan(plan);
      const winning = analysis.allWinningCards();
      const best = analysis.solve()!;
      const signature = best.cards.reduce((id, card) => id * 4 + cards.indexOf(card), 0);
      expect(winning.has(signature)).toBe(true);
      return winning;
    });
    expect(winningSets.map(set => set.size)).toEqual([1520, 1777, 1770, 1700, 1631, 1790, 1702, 1553, 1615, 1515]);
    let checked = 0;
    const common: number[] = [];
    for (let signature = 0; signature < 4 ** 8; signature++) {
      checked++;
      if (winningSets.every(set => set.has(signature))) common.push(signature);
    }
    expect(checked).toBe(65536);
    expect(common).toEqual([]);
    // 确认收集包含非最优赢家，而不是用最优交集冒充全部赢法交集。
    const reference = referenceRoute.cards.reduce((id, card) => id * 4 + cards.indexOf(card), 0);
    const fixtureIndex = sequenceCases.findIndex(({ plan }) => plan.join() === fixturePressures.join());
    expect(winningSets[fixtureIndex].has(reference)).toBe(true);
    expect(referenceRoute.mood).toBeLessThan(analyzePlan(fixturePressures).solve()!.mood);
  });

  it.each(sequenceCases)('$name：仅本问和下一菜公开预告策略末心 3/4，独立算术与真实 Game 一致（非浏览器自然局）', ({ plan }) => {
    const route = visibleArithmeticRoute(plan);
    const game = gameForPlan(plan);
    const choices: Card[] = [];
    const supplies: Reward[] = [];
    while (game.phase !== 'finished') {
      const card = visibleCard(game.target.pressure, game.target.basePressure, game.charges);
      choices.push(card);
      answer(game, card);
      if (game.phase === 'reward') {
        const reward = visibleReward(game.mood, game.charges, game.mealPressures(game.wave + 1), game.wave + 1 === 3);
        supplies.push(reward);
        continueTurn(game, reward);
      } else continueTurn(game);
    }
    expect([3, 4]).toContain(route.mood);
    expect({ cards: choices, rewards: supplies, mood: game.mood }).toEqual(route);
    expect(game.history.map(turn => turn.moodAfter)).toEqual(arithmeticMoods(plan, route.cards, route.rewards));
    expect(game.report).toMatchObject({ won: true, mood: route.mood, turns: 8 });
    expectReport(game);
  });

  it('公开策略十序列末心分布为七个 4、三个 3；先知最优为三个 5、七个 4', () => {
    expect(sequenceCases.map(({ plan }) => visibleArithmeticRoute(plan).mood)).toEqual([4, 4, 4, 4, 4, 4, 4, 3, 3, 3]);
    expect(sequenceCases.map(({ plan }) => analyzePlan(plan).solve()!.mood)).toEqual([5, 5, 4, 4, 4, 5, 4, 4, 4, 4]);
  });
});

describe('出牌、预览、追问和帮腔因果（静态种子 fixture）', () => {
  it.each(cards)('%s 的预览、扣心态和有限卡消耗完全一致，重出无副作用', card => {
    const game = fixture();
    answer(game, card);
    expect(game.phase).toBe('feedback');
    continueTurn(game);
    expect(game.index).toBe(1);
    answer(game, 'taiji');
    expect(game.phase).toBe('reward');
    const before = snapshot(game);
    expect(game.next()).toBe(false);
    expect(snapshot(game)).toBe(before);
  });

  it('预览真实挡值不超当前压力：首问和帮腔后普通题只有 1 压力，反问/真心不能虚报容量', () => {
    const game = fixture();
    expect(game.preview('counter')).toMatchObject({ blocked: 1, loss: 0 });
    expect(game.preview('sincere')).toMatchObject({ blocked: 1, loss: 0 });
    answer(game, 'sincere');
    continueTurn(game);
    expect(game.target).toMatchObject({ basePressure: 2, pressure: 1, incoming: { kind: 'ally' } });
    const before = snapshot(game);
    expect(game.preview('counter')).toMatchObject({ blocked: 1, loss: 0 });
    expect(game.preview('sincere')).toMatchObject({ blocked: 1, loss: 0 });
    expect(snapshot(game)).toBe(before);
    expect(answer(game, 'sincere')).toMatchObject({ pressure: 1, blocked: 1, loss: 0 });
    continueTurn(game, 'crazy');
    expect(game.target).toMatchObject({ basePressure: 2, pressure: 1, incoming: { kind: 'ally' } });
    expect(answer(game, 'counter')).toMatchObject({ pressure: 1, blocked: 1, loss: 0 });
    continueTurn(game);
    expect(game.target).toMatchObject({ basePressure: 5, pressure: 6, incoming: { kind: 'followup' } });
    expect(game.preview('counter')).toMatchObject({ blocked: 3, loss: 3 });
  });

  it('反问 +1 只兑现到准确下一问，保留来源，不强行换成同亲戚，也不改当前 target', () => {
    const game = fixture();
    const first = answer(game, 'counter');
    expect(first.next).toEqual({ kind: 'followup', asker: 'erjiu', amount: 1 });
    expect(game.target).toMatchObject({ asker: 'erjiu', pressure: 1, incoming: null });
    continueTurn(game);
    expect(game.target).toMatchObject({ asker: 'gufu', basePressure: 2, pressure: 3, incoming: first.next });
    const second = answer(game, 'taiji');
    expect(second.loss).toBe(2);
    expect(second.incoming).not.toBe(first.next);
    expect(second.next).toBeNull();
    continueTurn(game);
    expect(game.target).toMatchObject({ index: 2, pressure: 2, incoming: null });
  });

  it('真心原句完整，下一问同来源亲戚帮腔 -1，只兑现一次', () => {
    const game = fixture();
    const first = answer(game, 'sincere');
    expect(first.reply).toBe(relatives.erjiu.line);
    expect(first.next).toEqual({ kind: 'ally', asker: 'erjiu', amount: 1 });
    expect(game.target.incoming).toBeNull();
    continueTurn(game);
    expect(game.target).toMatchObject({ asker: 'gufu', basePressure: 2, pressure: 1, incoming: first.next });
    const second = answer(game, 'taiji');
    expect(second.loss).toBe(0);
    expect(second.incoming!.asker).toBe('erjiu');
    continueTurn(game, 'crazy');
    expect(game.target).toMatchObject({ pressure: 2, incoming: null });
    game.finish();
    expect(game.report!.allies).toBe(1);
    expect(game.report!.quotes).toContain(relatives.erjiu.line);
    expectReport(game);
  });

  it('连续反问/真心可以接力：本题 incoming 与本题产生的 next 各自保留', () => {
    const game = fixture();
    answer(game, 'counter');
    continueTurn(game);
    const target = game.target;
    const before = JSON.stringify(target);
    const result = answer(game, 'sincere');
    expect(result).toMatchObject({ pressure: 3, blocked: 2, loss: 1, incoming: { kind: 'followup', asker: 'erjiu' }, next: { kind: 'ally', asker: 'gufu' } });
    expect(game.target).toBe(target);
    expect(JSON.stringify(target)).toBe(before);
    continueTurn(game);
    expect(game.target).toMatchObject({ pressure: 1, incoming: { kind: 'ally', asker: 'gufu' } });
    const third = answer(game, 'counter');
    expect(third).toMatchObject({ pressure: 1, incoming: { kind: 'ally', asker: 'gufu' }, next: { kind: 'followup', asker: 'gufu' } });
    continueTurn(game);
    expect(game.target).toMatchObject({ index: 3, basePressure: 5, pressure: 6, incoming: third.next });
    expect(game.history[1].pressure).toBe(3);
    expect(game.history[1].incoming).toEqual({ kind: 'followup', asker: 'erjiu', amount: 1 });
  });

  it('帮腔先减压力，再计算真心挡值：普通/fast 挡 2，tough 5/boss 6 只挡 1', () => {
    const ordinaryKinds = new Set<string>();
    for (const kind of ['normal', 'fast'] as const) {
      const source = sourceFor().map(q => ['normal', 'fast'].includes(q.kind) ? { ...q, kind } : q);
      const game = new Game('single', 1, source);
      answer(game, 'taiji');
      continueTurn(game);
      expect(game.target.question.kind).toBe(kind);
      expect(game.preview('sincere')).toMatchObject({ blocked: 2, loss: 0 });
      ordinaryKinds.add(answer(game, 'sincere').question.kind);
    }
    expect([...ordinaryKinds]).toEqual(['normal', 'fast']);

    const tough = fixture();
    drive(tough, ['taiji', 'taiji', 'counter'], ['soup']);
    expect(tough.target).toMatchObject({ basePressure: 5, pressure: 6, incoming: { kind: 'followup' } });
    expect(tough.preview('sincere')).toMatchObject({ blocked: 1, loss: 5 });
    expect(answer(tough, 'sincere')).toMatchObject({ blocked: 1, loss: 5, moodAfter: 1 });

    const ally = fixture();
    drive(ally, ['taiji', 'taiji', 'counter', 'crazy', 'sincere'], ['crazy', 'sincere']);
    expect(ally.history[4]).toMatchObject({ basePressure: 2, pressure: 2, blocked: 2, loss: 0 });
    expect(ally.target).toMatchObject({ basePressure: 5, pressure: 4, incoming: { kind: 'ally' } });
    expect(ally.preview('sincere')).toMatchObject({ blocked: 1, loss: 3 });
    expect(answer(ally, 'sincere')).toMatchObject({ basePressure: 5, pressure: 4, blocked: 1, loss: 3, moodAfter: 1 });

    const boss = fixture();
    drive(boss, referenceRoute.cards.slice(0, 7), ['crazy', 'crazy', 'sincere']);
    expect(boss.target).toMatchObject({ basePressure: 6, pressure: 5, incoming: { kind: 'ally' } });
    expect(boss.preview('sincere')).toMatchObject({ available: true, blocked: 1, loss: 4, next: null });
    expect(answer(boss, 'sincere')).toMatchObject({ blocked: 1, loss: 4, moodAfter: 0, next: null, reply: relatives.table.line });
    continueTurn(boss);
    expect(boss.report).toMatchObject({ won: false, mood: 0, turns: 8 });
    expectReport(boss);
  });

  it.each([1, 2, 42, 20261118])('发疯静态种子搜索起点=%s：全挡压力且立即自耗 1，没有冻结或追问', seed => {
    const game = fixture(seed);
    drive(game, ['taiji', 'taiji', 'counter'], ['soup']);
    const result = answer(game, 'crazy');
    expect(result).toMatchObject({ pressure: 6, blocked: 6, loss: 1, moodBefore: 6, moodAfter: 5, next: null });
    expect(game.charges.crazy).toBe(0);
    expect(game.phase).toBe('reward');
    continueTurn(game);
    expect(game.target).toMatchObject({ index: 4, pressure: 2, incoming: null });
    game.finish();
    expect(game.report!.blocked).toBe(2);
  });

  it.each(['counter', 'sincere', 'crazy'] as const)('%s 有限牌耗尽后不能出，非法操作不影响下一问 carry', card => {
    const game = fixture();
    answer(game, card);
    continueTurn(game);
    if (card !== 'crazy') {
      answer(game, card);
      continueTurn(game, card === 'sincere' ? 'crazy' : 'sincere');
    }
    expect(game.charges[card]).toBe(0);
    const before = snapshot(game);
    expect(game.canPlay(card)).toBe(false);
    expect(game.preview(card).available).toBe(false);
    expect(game.play(card)).toBe(false);
    expect(snapshot(game)).toBe(before);
    answer(game, 'taiji');
    expect(game.charges.taiji).toBe(Infinity);
  });
});

describe('每两问奖励、封顶和 0 心态失败（静态种子 fixture）', () => {
  it('只在第 2/4/6 问存活时选奖励，选完直接下一问；不能重复领或 next 跳过', () => {
    const game = fixture();
    const rewardTurns = drive(game, referenceRoute.cards, referenceRoute.rewards);
    expect(rewardTurns).toEqual([2, 4, 6]);
    expect(game.history.map(turn => turn.moodAfter)).toEqual([6, 5, 5, 4, 4, 3, 4, 3]);
    expect(game.history.map(turn => turn.moodBefore)).toEqual([6, 6, 5, 5, 4, 4, 4, 4]);
    const before = snapshot(game);
    for (const choice of rewards) expect(game.reward(choice)).toBe(false);
    expect(game.next()).toBe(false);
    expect(snapshot(game)).toBe(before);
  });

  it('汤只恢复 1，上限 6；满心态不可浪费选择，也不能消耗这一奖励机会', () => {
    const game = fixture();
    answer(game, 'taiji');
    continueTurn(game);
    answer(game, 'sincere');
    expect(game.mood).toBe(6);
    expect(game.phase).toBe('reward');
    const before = snapshot(game);
    expect(game.canReward('soup')).toBe(false);
    expect(game.reward('soup')).toBe(false);
    expect(game.next()).toBe(false);
    expect(snapshot(game)).toBe(before);
    expect(game.reward('counter')).toBe(true);
    expect(game).toMatchObject({ phase: 'question', index: 2, mood: 6 });
    const after = snapshot(game);
    expect(game.reward('soup')).toBe(false);
    expect(snapshot(game)).toBe(after);
    const soup = fixture();
    drive(soup, ['taiji', 'taiji'], ['soup']);
    expect(soup.mood).toBe(6);
    expect(soup.history[1].moodAfter).toBe(5);
  });

  it.each(['counter', 'sincere'] as const)('%s 奖励从 2 到 3，满额不能浪费当前机会', choice => {
    const game = fixture();
    drive(game, ['taiji', 'taiji'], [choice]);
    expect(game.charges[choice]).toBe(3);
    answer(game, 'taiji');
    continueTurn(game);
    answer(game, 'crazy');
    expect(game).toMatchObject({ phase: 'reward', mood: 3 });
    const before = snapshot(game);
    expect(game.canReward(choice)).toBe(false);
    expect(game.reward(choice)).toBe(false);
    expect(snapshot(game)).toBe(before);
    expect(game.reward('soup')).toBe(true);
    expect(game.charges[choice]).toBe(3);
  });

  it('发疯奖励从 1 到 2 到 3，第六问存活时仍不能选满额卡', () => {
    const game = gameForPlan([1, 2, 2, 2, 2, 5, 5, 6]);
    drive(game, ['taiji', 'taiji'], ['crazy']);
    expect(game.charges.crazy).toBe(2);
    drive(game, ['sincere', 'taiji'], ['crazy']);
    expect(game.charges.crazy).toBe(3);
    answer(game, 'sincere');
    continueTurn(game);
    answer(game, 'counter');
    expect(game).toMatchObject({ phase: 'reward', mood: 4 });
    const before = snapshot(game);
    expect(game.canReward('crazy')).toBe(false);
    expect(game.reward('crazy')).toBe(false);
    expect(game.next()).toBe(false);
    expect(snapshot(game)).toBe(before);
    expect(game.reward('soup')).toBe(true);
    expect(game).toMatchObject({ index: 6, mood: 5, phase: 'question' });
    expect(game.charges.crazy).toBe(3);
  });

  it('0 心态即刻禁出牌/奖励：第 6 问死亡不弹奖励，反馈 next 后失败，绝不能领汤复活', () => {
    const game = fixture();
    drive(game, ['taiji', 'taiji', 'taiji', 'counter'], ['soup', 'soup']);
    expect(game.mood).toBe(4);
    answer(game, 'taiji');
    expect(game.mood).toBe(2);
    continueTurn(game);
    answer(game, 'taiji');
    expect(game).toMatchObject({ mood: 0, phase: 'feedback', index: 5, report: null });
    const before = snapshot(game);
    for (const choice of rewards) {
      expect(game.canReward(choice)).toBe(false);
      expect(game.reward(choice)).toBe(false);
    }
    for (const card of cards) expect(game.play(card)).toBe(false);
    expect(snapshot(game)).toBe(before);
    expect(game.next()).toBe(true);
    expect(game.report).toMatchObject({ won: false, mood: 0, turns: 6 });
    expectReport(game);
    expect(game.reward('soup')).toBe(false);
    expect(game.mood).toBe(0);
  });

  it('发疯也能自耗最后 1 心态而失败，即使全挡也不算无损或复活', () => {
    const game = fixture();
    drive(game, ['taiji', 'taiji', 'taiji', 'counter', 'taiji'], ['counter', 'soup']);
    expect(game).toMatchObject({ mood: 1, index: 5, phase: 'question' });
    answer(game, 'crazy');
    expect(game.lastResult).toMatchObject({ pressure: 5, blocked: 5, loss: 1, moodAfter: 0 });
    expect(game.phase).toBe('feedback');
    expect(game.canReward('soup')).toBe(false);
    expect(game.reward('soup')).toBe(false);
    continueTurn(game);
    expect(game.report).toMatchObject({ won: false, mood: 0, turns: 6, blocked: 1 });
    expectReport(game);
  });
});

describe('胜负路线和真实回放', () => {
  it.each(realCases)('$identity / $seed：全 T 加能领到的汤仍提前失败，不要求八问或三次奖励', ({ identity, seed }) => {
    expectTaijiFailure(new Game(identity, seed));
  });

  const scenarios: { name: string; constraints: RouteConstraints }[] = [
    { name: '四菜混用', constraints: { requireAllCards: true } },
    { name: '三次真心补给的先知适配选牌（不是固定盲套路）', constraints: { rewardChoices: ['sincere'] } },
  ];
  for (const scenario of scenarios) {
    it.each(realCases)(`${scenario.name}：$identity / $seed 独立模型规划合法可赢路线`, ({ identity, seed }) => {
      const game = new Game(identity, seed);
      const route = winningRoute(game, scenario.constraints);
      expect(drive(game, route.cards, route.rewards)).toEqual([2, 4, 6]);
      expect(game.history.map(turn => turn.moodAfter)).toEqual(arithmeticMoods(plannedPressures(game), route.cards, route.rewards));
      if (scenario.constraints.requireAllCards) expect(new Set(route.cards).size).toBe(4);
      if (scenario.constraints.rewardChoices) expect(route.rewards).toEqual(['sincere', 'sincere', 'sincere']);
      expect(game.report).toMatchObject({ won: true, mood: route.mood, turns: 8, reason: '好好吃完这顿饭', title: '这桌饭，吃完了' });
      expectReport(game);
    });
  }

  it('V3 固定回放 fixture：独立算术验证真实末心 3，替代旧 6/4/1 路线', () => {
    const game = fixture();
    expect(plannedPressures(game)).toEqual(fixturePressures);
    expect(drive(game, referenceRoute.cards, referenceRoute.rewards)).toEqual([2, 4, 6]);
    expect(game.history.map(turn => turn.moodAfter)).toEqual(arithmeticMoods(fixturePressures, referenceRoute.cards, referenceRoute.rewards));
    expect(game.report).toMatchObject({ won: true, mood: referenceRoute.mood, turns: 8 });
    expectReport(game);
  });

  it.each(sequenceCases)('$name：前五 T 加前两汤不可救，STCCCCCZ 三补 C 与旧真心补给盲串均失败', ({ plan }) => {
    expect(analyzePlan(plan, { prefixCards: Array<Card>(5).fill('taiji'), prefixRewards: ['soup', 'soup'] }).solve()).toBeNull();
    const blindRoutes: { cards: Card[]; rewards: Reward[] }[] = [
      { cards: ['sincere', 'taiji', 'counter', 'counter', 'counter', 'counter', 'counter', 'crazy'], rewards: ['counter', 'counter', 'counter'] },
      { cards: ['taiji', 'sincere', 'taiji', 'counter', 'sincere', 'taiji', 'sincere', 'counter'], rewards: ['sincere', 'sincere', 'sincere'] },
    ];
    for (const route of blindRoutes) {
      expect(analyzePlan(plan, { prefixCards: route.cards, prefixRewards: route.rewards }).solve()).toBeNull();
      const game = gameForPlan(plan);
      drive(game, route.cards, route.rewards);
      expect(game.history.map(turn => turn.moodAfter)).toEqual(arithmeticMoods(plan, route.cards, route.rewards));
      expect(game.report).toMatchObject({ won: false, mood: 0 });
      expectReport(game);
    }
  });

  it('可救不等于自动救：同一 ZC + 发疯补给前缀，先知后缀能赢，继续 T 在第四问死亡', () => {
    const recover = fixture();
    const fail = fixture();
    const route = winningRoute(recover, { prefixCards: ['crazy', 'counter'], prefixRewards: ['crazy'] });
    drive(recover, ['crazy', 'counter'], ['crazy']);
    drive(fail, ['crazy', 'counter'], ['crazy']);
    expect(snapshot(recover)).toBe(snapshot(fail));
    expect(recover).toMatchObject({ mood: 5, index: 2 });
    drive(recover, route.cards.slice(2), route.rewards.slice(1));
    drive(fail, Array<Card>(6).fill('taiji'), ['soup', 'soup']);
    expect(recover.report).toMatchObject({ won: true, mood: route.mood, turns: 8 });
    expect(fail.report).toMatchObject({ won: false, mood: 0, turns: 4 });
    expectReport(recover);
    expectReport(fail);
  });

  it.each(cards)('最后一问 %s 不产生不存在的未来；需反馈 next 才正常结算（静态种子 fixture）', card => {
    const game = fixture();
    drive(game, ['taiji', 'sincere', 'taiji', 'crazy', 'counter', 'crazy', 'taiji'], ['crazy', 'crazy', 'soup']);
    expect(game.index).toBe(7);
    const result = answer(game, card);
    expect(game.preview(card).next).toBeNull();
    expect(result.next).toBeNull();
    expect(game).toMatchObject({ phase: 'feedback', report: null });
    if (card === 'counter') expect(result.reply).not.toContain('再多问');
    const before = snapshot(game);
    for (const choice of rewards) expect(game.reward(choice)).toBe(false);
    expect(snapshot(game)).toBe(before);
    continueTurn(game);
    expect(game.report!.won).toBe(game.mood > 0);
    expect(game.index).toBe(7);
    expect(game.report!.history).toHaveLength(8);
    expectReport(game);
  });

  it('主动离席不伪造未答题/台词；无人回答给中性离席句，finish 理由无法冒充通关（静态种子 fixture）', () => {
    const empty = fixture();
    empty.finish();
    expect(empty.report).toMatchObject({ won: false, mood: 6, turns: 0, history: [], highlights: [], blocked: 0, counters: 0, sincere: 0, allies: 0 });
    expect(empty.report!.quotes).toEqual(['先去厨房歇一歇，大家慢慢吃。']);
    expectReport(empty);
    const partial = fixture();
    answer(partial, 'sincere');
    partial.finish('好好吃完这顿饭');
    expect(partial.report).toMatchObject({ won: false, turns: 1, sincere: 1, allies: 0 });
    expectReport(partial);
    const complete = fixture();
    const route = winningRoute(complete);
    drive(complete, route.cards.slice(0, 7), route.rewards);
    answer(complete, route.cards[7]);
    expect(complete.mood).toBe(route.mood);
    complete.finish('好好吃完这顿饭');
    expect(complete.report).toMatchObject({ won: false, turns: 8, title: '先去厨房歇一歇' });
    expectReport(complete);
  });

  it('finish 幂等，结束后出牌/奖励/next/finish 都无副作用，重新开局没有旧 carry/历史（静态种子 fixture）', () => {
    const game = fixture();
    drive(game, referenceRoute.cards, referenceRoute.rewards);
    const report = game.report;
    const before = snapshot(game);
    for (const card of cards) expect(game.play(card)).toBe(false);
    for (const reward of rewards) expect(game.reward(reward)).toBe(false);
    expect(game.next()).toBe(false);
    game.finish('另一个原因');
    expect(game.report).toBe(report);
    expect(snapshot(game)).toBe(before);
    const fresh = fixture();
    expect(fresh).toMatchObject({ mood: 6, resolved: 0, phase: 'question', report: null });
    expect(fresh.target.incoming).toBeNull();
    expect(fresh.charges).toEqual({ taiji: Infinity, counter: 2, sincere: 2, crazy: 1 });
    expect(snapshot(fresh)).toBe(snapshot(fixture()));
  });

  it('回放优先已兑现的帮腔/追问源选择及末问，最多三条且时间顺序真实（静态种子 fixture）', () => {
    const game = fixture();
    drive(game, referenceRoute.cards, referenceRoute.rewards);
    const highlights = game.report!.highlights;
    expect(highlights.map(turn => turn.turn)).toEqual([3, 5, 8]);
    expect(highlights[0]).toMatchObject({ card: 'counter', pressure: 2, blocked: 2, loss: 0, next: { kind: 'followup', asker: 'gufu', amount: 1 } });
    expect(highlights[1]).toMatchObject({ card: 'sincere', basePressure: 2, pressure: 2, next: { kind: 'ally', asker: 'gufu', amount: 1 } });
    expect(highlights[2]).toMatchObject({ card: 'crazy', basePressure: 6, pressure: 5, blocked: 5, loss: 1, incoming: { kind: 'ally', asker: 'gufu' }, next: null });
    for (const cause of highlights.slice(0, 2)) {
      const effect = game.history[cause.turn];
      expect(effect.incoming).toEqual(cause.next);
      expect(effect.incoming).not.toBe(cause.next);
      expect(effect.pressure).toBe(effect.basePressure + (cause.next!.kind === 'ally' ? -1 : 1));
      expect(game.report!.quotes).toContain(cause.quote);
    }
    expect(game.history[3]).toMatchObject({ card: 'crazy', pressure: 6, blocked: 6, loss: 1 });
    expect(game.history[5]).toMatchObject({ basePressure: 5, pressure: 4, incoming: { kind: 'ally' } });
    expect(highlights).not.toContain(game.history[5]);
    expect(game.report).toMatchObject({ allies: 2, sincere: 2, counters: 1, blocked: 4 });
    expectReport(game);
    expect(game.report!.quotes.length).toBeLessThan(game.history.length * 2);
    expect(game.report!.quotes).toContain(relatives.gufu.line);
    expect(game.report!.quotes).not.toContain('喝了口热汤');
    expect(game.report!.quotes).not.toContain(game.history[0].question.text);
  });
});
