import { questions, relatives, type Card, type Identity, type Question, type Relative } from './content';

export const MAX_MOOD = 6;
export const TOTAL_TURNS = 8;
export type Phase = 'question' | 'feedback' | 'reward' | 'finished';
export type Reward = 'soup' | 'counter' | 'sincere' | 'crazy';
export interface Carry {
  kind: 'followup' | 'ally';
  asker: Relative;
  amount: 1;
}
export interface Encounter {
  index: number;
  question: Question;
  asker: Relative;
  basePressure: number;
  pressure: number;
  incoming: Carry | null;
}
export interface Preview {
  card: Card;
  available: boolean;
  blocked: number;
  loss: number;
  cost: number;
  next: Carry | null;
}
export interface TurnResult {
  turn: number;
  question: Question;
  asker: Relative;
  basePressure: number;
  pressure: number;
  incoming: Carry | null;
  card: Card;
  quote: string;
  reply: string;
  blocked: number;
  loss: number;
  moodBefore: number;
  moodAfter: number;
  next: Carry | null;
}
export interface Report {
  won: boolean;
  reason: string;
  title: string;
  identity: Identity;
  mood: number;
  turns: number;
  blocked: number;
  counters: number;
  sincere: number;
  allies: number;
  history: TurnResult[];
  highlights: TurnResult[];
  quotes: string[];
  lines: string[];
}

const copyCarry = (carry: Carry | null): Carry | null => carry ? { ...carry } : null;

export class Game {
  phase: Phase = 'question';
  mood = MAX_MOOD;
  charges: Record<Card, number> = { taiji: Infinity, counter: 2, sincere: 2, crazy: 1 };
  history: TurnResult[] = [];
  report: Report | null = null;
  private rngState: number;
  private readonly deck: { question: Question; asker: Relative; basePressure: number }[];
  private current: Encounter;
  private pending: Carry | null = null;

  constructor(readonly identity: Identity, seed = Date.now(), source = questions) {
    this.rngState = seed >>> 0 || 1;
    const pool = [...new Map(source.filter(q => q.identities.includes(identity)
      && ['normal', 'fast', 'tough', 'boss'].includes(q.kind)).map(q => [q.id, q])).values()];
    if (pool.some(q => !q.askers.length || q.askers.some(asker => !Object.prototype.hasOwnProperty.call(relatives, asker)))) {
      throw new Error('身份题库包含非法发问亲戚');
    }
    const normal = this.shuffle(pool.filter(q => q.kind === 'normal' || q.kind === 'fast'));
    const tough = this.shuffle(pool.filter(q => q.kind === 'tough'));
    const bosses = this.shuffle(pool.filter(q => q.kind === 'boss'));
    const first = normal.find(q => q.identities.length === 1) ?? normal[0];
    const others = normal.filter(q => q.id !== first?.id);
    const boss = bosses.find(q => q.identities.length === 1) ?? bosses[0];
    if (!first || others.length < 4 || tough.length < 2 || !boss) throw new Error('身份题库不完整');
    const middle = this.shuffle([others[1], tough[0], others[2], tough[1], others[3]]);
    this.deck = [first, others[0], ...middle, boss].map((question, index) => ({
      question, asker: question.askers[Math.floor(this.random() * question.askers.length)],
      basePressure: index === 0 ? 1 : question.kind === 'boss' ? 6 : question.kind === 'tough' ? 5 : 2,
    }));
    this.current = this.encounter(0, null);
  }

  private random(): number {
    this.rngState ^= this.rngState << 13;
    this.rngState ^= this.rngState >>> 17;
    this.rngState ^= this.rngState << 5;
    return (this.rngState >>> 0) / 4294967296;
  }

  private shuffle<T>(values: T[]): T[] {
    const out = [...values];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  private encounter(index: number, incoming: Carry | null): Encounter {
    const { basePressure } = this.deck[index];
    const adjustment = incoming ? (incoming.kind === 'followup' ? incoming.amount : -incoming.amount) : 0;
    return { index, ...this.deck[index], basePressure, pressure: Math.max(0, basePressure + adjustment), incoming: copyCarry(incoming) };
  }

  get index(): number { return this.current.index; }
  get wave(): number { return Math.floor(this.index / 2); }
  get target(): Encounter { return this.current; }
  get lastResult(): TurnResult | undefined { return this.history[this.history.length - 1]; }
  get resolved(): number { return this.history.length; }

  mealPressures(wave: number): number[] {
    return this.deck.slice(wave * 2, wave * 2 + 2).map(turn => turn.basePressure);
  }

  canPlay(card: Card): boolean {
    return this.phase === 'question' && this.mood > 0 && this.charges[card] > 0;
  }

  preview(card: Card): Preview {
    const { question, asker, pressure } = this.current;
    const capacity = card === 'taiji' ? 1 : card === 'counter' ? 3 : card === 'crazy' ? pressure
      : question.kind === 'tough' || question.kind === 'boss' ? 1 : 2;
    const blocked = Math.min(pressure, capacity);
    const selfLoss = card === 'crazy' ? 1 : 0;
    const kind = card === 'counter' ? 'followup' : card === 'sincere' ? 'ally' : null;
    return {
      card, available: this.canPlay(card), blocked,
      loss: Math.max(0, pressure - blocked) + selfLoss,
      cost: selfLoss,
      next: kind && this.index < TOTAL_TURNS - 1 ? { kind, asker, amount: 1 } : null,
    };
  }

  play(card: Card): boolean {
    if (!this.canPlay(card)) return false;
    const preview = this.preview(card);
    const target = this.current;
    const moodBefore = this.mood;
    if (card !== 'taiji') this.charges[card]--;
    this.mood = Math.max(0, this.mood - preview.loss);
    const reply = card === 'sincere' ? relatives[target.asker].line
      : card === 'counter' ? (preview.next ? '那我再多问一句。' : '好，这个问题就说到这儿。')
      : card === 'crazy' ? '好家伙……先吃饭吧。' : '行，先吃菜。';
    this.history.push({
      turn: this.index + 1, question: target.question, asker: target.asker,
      basePressure: target.basePressure, pressure: target.pressure, incoming: copyCarry(target.incoming),
      card, quote: target.question.answers[card], reply, blocked: preview.blocked, loss: preview.loss,
      moodBefore, moodAfter: this.mood, next: copyCarry(preview.next),
    });
    // A future carry is separate from the encounter being displayed during feedback/reward.
    this.pending = copyCarry(preview.next);
    this.phase = this.mood > 0 && [1, 3, 5].includes(this.index) ? 'reward' : 'feedback';
    return true;
  }

  private advance(): void {
    this.current = this.encounter(this.index + 1, this.pending);
    this.pending = null;
    this.phase = 'question';
  }

  next(): boolean {
    if (this.phase !== 'feedback') return false;
    if (this.mood === 0) this.settle('心态见底，去厨房歇一歇', false);
    else if (this.resolved === TOTAL_TURNS) this.settle('好好吃完这顿饭', true);
    else this.advance();
    return true;
  }

  canReward(choice: Reward): boolean {
    if (this.phase !== 'reward' || this.mood <= 0) return false;
    return choice === 'soup' ? this.mood < MAX_MOOD
      : ['counter', 'sincere', 'crazy'].includes(choice) && this.charges[choice] < 3;
  }

  reward(choice: Reward): boolean {
    if (!this.canReward(choice)) return false;
    if (choice === 'soup') this.mood = Math.min(MAX_MOOD, this.mood + 1);
    else this.charges[choice] = Math.min(3, this.charges[choice] + 1);
    this.advance();
    return true;
  }

  finish(reason = '主动离席，先去厨房歇一歇'): void {
    this.settle(reason, false);
  }

  private settle(reason: string, complete: boolean): void {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    this.pending = null;
    const history = this.history.slice();
    const won = complete && history.length === TOTAL_TURNS && this.mood > 0;
    const blocked = history.filter(turn => turn.loss === 0).length;
    const counters = history.filter(turn => turn.card === 'counter').length;
    const sincere = history.filter(turn => turn.card === 'sincere').length;
    const allies = history.filter(turn => turn.incoming?.kind === 'ally').length;
    const highlights: TurnResult[] = [];
    const add = (turn: TurnResult | undefined) => {
      if (turn && highlights.length < 3 && !highlights.includes(turn)) highlights.push(turn);
    };
    const allyTurns = history.filter(turn => turn.incoming?.kind === 'ally');
    const dangerous = history.filter(turn => (turn.pressure >= 3 || turn.pressure >= turn.moodBefore)
      && turn.loss < turn.pressure);
    const allyCause = history.find((turn, i) => turn.next?.kind === 'ally' && history[i + 1]?.incoming?.kind === 'ally');
    const counterCause = history.find((turn, i) => turn.next?.kind === 'followup' && history[i + 1]?.incoming?.kind === 'followup');
    add(allyCause ?? allyTurns[0]);
    add(counterCause ?? dangerous[0]);
    add(history[history.length - 1]);
    for (const turn of [...allyTurns, ...dangerous, ...history]) add(turn);
    highlights.sort((a, b) => a.turn - b.turn);
    const quotes = [...new Set(history.flatMap(turn => [
      ...(turn.incoming?.kind === 'ally' ? [relatives[turn.incoming.asker].line] : []),
      turn.quote, turn.reply,
    ]))];
    this.report = {
      won, reason, title: won ? '这桌饭，吃完了' : '先去厨房歇一歇', identity: this.identity,
      mood: this.mood, turns: history.length, blocked, counters, sincere, allies, history, highlights,
      quotes: quotes.length ? quotes : ['先去厨房歇一歇，大家慢慢吃。'],
      lines: [
        `回答了 ${history.length} 问 · 心态剩余 ${this.mood}/${MAX_MOOD}`,
        `未扣心态 ${blocked} 问 · 反问 ${counters} 次`,
        `真心 ${sincere} 次 · 帮腔兑现 ${allies} 次`,
      ],
    };
  }
}
