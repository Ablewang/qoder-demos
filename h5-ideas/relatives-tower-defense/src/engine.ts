import { dinner, nameOf, nodeById, PILE_LIMIT, type Action, type Beat, type Cast, type Cond, type DinnerNode, type Ending, type Outcome, type Strategy } from './content';

export interface State { watching: Cast[]; allies: Cast[]; used: Cast[]; flags: string[] }
export interface Option {
  id: string;
  strategy: Strategy;
  line: string;
  intent: string;
  available: boolean;
  lock: string;
  risk: string;
  before: Cast[];
  after: Cast[];
  gained: Cast[];
  spent: Cast[];
  ending: Ending | null;
}
export interface Turn extends Option {
  index: number;
  scene: number;
  node: DinnerNode;
  beats: Beat[];
  next: string | null;
  title: string;
  summary: string;
}
export interface Report {
  ending: Ending;
  title: string;
  summary: string;
  dishes: number;
  turns: Turn[];
  helpers: Cast[];
  tips: string[];
}
export type Phase = 'choose' | 'react' | 'over';
export const PILE_TITLE = '被全桌围住，先去厨房透口气';
export const LEAVE_TITLE = '借口离席，这顿先吃到这';

const castOrder = dinner.cast;
const sorted = (list: Cast[]): Cast[] => castOrder.filter(who => list.includes(who));
export const names = (list: Cast[]): string => list.length ? list.map(nameOf).join('、') : '没人';

export function holds(cond: Cond, state: State): boolean {
  if (cond.ally && !(state.allies.includes(cond.ally) && !state.used.includes(cond.ally))) return false;
  if (cond.used && !state.used.includes(cond.used)) return false;
  if (cond.unused && state.used.includes(cond.unused)) return false;
  if (cond.watching && !state.watching.includes(cond.watching)) return false;
  if (cond.flag && !state.flags.includes(cond.flag)) return false;
  if (cond.maxWatching !== undefined && state.watching.length > cond.maxWatching) return false;
  return true;
}

export function initialState(): State {
  return { watching: sorted(dinner.watching), allies: sorted(dinner.allies), used: [], flags: [] };
}

function outcomeOf(action: Action, state: State): Outcome {
  return action.outcomes.find(item => !item.when || holds(item.when, state)) ?? action.outcomes[action.outcomes.length - 1];
}

export function applyOutcome(outcome: Outcome, state: State): State {
  const allies = sorted([...state.allies, ...(outcome.allies ?? [])]);
  const used = sorted([...state.used, ...(outcome.use ?? [])]);
  let watching = outcome.clear ? [] : state.watching.filter(who => !outcome.remove?.includes(who));
  watching = sorted([...watching, ...(outcome.add ?? [])]).filter(who => !(outcome.allies ?? []).includes(who));
  const flags = [...new Set([...state.flags, ...(outcome.flags ?? [])])];
  return { watching, allies, used, flags };
}

export function preview(action: Action, state: State): Option {
  const available = (action.requires.length === 0 || action.requires.some(cond => holds(cond, state))) && !action.blockedBy?.some(cond => holds(cond, state));
  const fill = (text: string) => text.replace('{watching}', names(state.watching));
  const lockSource = action.locks.find(item => !item.when || holds(item.when, state));
  const outcome = outcomeOf(action, state);
  const after = applyOutcome(outcome, state);
  const piled = after.watching.length >= PILE_LIMIT;
  return {
    id: action.id,
    strategy: action.strategy,
    line: outcome.line ?? action.line,
    intent: outcome.intent ?? action.intent,
    available,
    lock: available ? '' : fill(lockSource?.text ?? '现在用不了'),
    risk: fill(outcome.risk),
    before: [...state.watching],
    after: after.watching,
    gained: after.allies.filter(who => !state.allies.includes(who)),
    spent: after.used.filter(who => !state.used.includes(who)),
    ending: piled ? 'piled' : outcome.ending ?? null,
  };
}

export class Game {
  state: State = initialState();
  node: DinnerNode = nodeById(dinner.start);
  phase: Phase = 'choose';
  turns: Turn[] = [];
  report: Report | null = null;

  get scene(): number { return this.node.scene; }
  get last(): Turn | null { return this.turns[this.turns.length - 1] ?? null; }

  options(): Option[] {
    return this.node.actions.map(action => preview(action, this.state));
  }

  choose(id: string): Turn | null {
    if (this.phase !== 'choose') return null;
    const action = this.node.actions.find(item => item.id === id);
    if (!action) return null;
    const option = preview(action, this.state);
    if (!option.available) return null;
    const outcome = outcomeOf(action, this.state);
    this.state = applyOutcome(outcome, this.state);
    const piled = option.ending === 'piled';
    const turn: Turn = {
      ...option,
      index: this.turns.length,
      scene: this.node.scene,
      node: this.node,
      beats: piled && outcome.ending !== 'piled' ? [...outcome.beats, ...dinner.pileOn] : outcome.beats,
      next: option.ending ? null : outcome.next ?? null,
      title: piled ? PILE_TITLE : outcome.title ?? '',
      summary: piled ? `${names(option.after)}同时盯着你，话头全回到了你身上。不是你答错了，是一下子被太多人围住了。` : outcome.summary ?? '',
    };
    this.turns.push(turn);
    this.phase = 'react';
    return turn;
  }

  advance(): boolean {
    if (this.phase !== 'react') return false;
    const turn = this.last!;
    if (turn.ending) { this.settle(turn.ending, turn.title, turn.summary); return true; }
    this.node = nodeById(turn.next!);
    if (this.node.enter) this.state = { ...this.state, watching: sorted([...this.state.watching, ...this.node.enter]) };
    this.phase = 'choose';
    return true;
  }

  leave(): boolean {
    if (this.phase === 'over') return false;
    this.settle('left', LEAVE_TITLE, `第 ${this.scene + 1} 道菜时你先离了席。没吃完这顿，但也没硬扛。`);
    return true;
  }

  private settle(ending: Ending, title: string, summary: string): void {
    this.phase = 'over';
    const helpers = sorted([...this.state.used, ...this.state.allies.filter(who => who !== 'nainai' || this.state.used.includes('nainai'))]);
    const done = new Set(this.turns.map(turn => turn.id));
    const tips: string[] = [];
    if (done.has('ask-nainai')) tips.push('把奶奶留到饺子压轴，她有一招“硬币饺子”。');
    if (!done.has('ask-sangu')) tips.push('第一道反问三姑，看看表姐会不会跟你站一边。');
    if (!done.has('honest-sangu')) tips.push('第一道跟三姑说句实话，热菜时她会替你挡一句。');
    if (!done.has('fishpond')) tips.push('问问二舅的鱼塘，压轴他能分走盘问；大姨还会问一件小事。');
    if (ending === 'piled') tips.unshift('别让三个人同时盯着你：选项下方会写这句话会招来谁。');
    this.report = {
      ending,
      title,
      summary,
      dishes: ending === 'won' ? dinner.scenes.length : this.scene,
      turns: [...this.turns],
      helpers,
      tips: tips.slice(0, 2),
    };
  }
}
