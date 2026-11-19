import data from './content/questions.json';

export type Relative = 'sangu' | 'erjiu' | 'dayi' | 'gufu' | 'ershen' | 'biaojie' | 'wangayi' | 'nainai' | 'table';
export type Cast = 'sangu' | 'erjiu' | 'nainai' | 'dayi' | 'biaojie';
export type Speaker = Cast | 'table';
export type Strategy = 'ally' | 'taiji' | 'counter' | 'crazy' | 'sincere' | 'leave';
export type Ending = 'won' | 'piled' | 'left';
export interface Beat { who: Speaker; text: string }
export interface Cond { ally?: Cast; used?: Cast; unused?: Cast; watching?: Cast; flag?: string; maxWatching?: number }
export interface Outcome {
  when?: Cond;
  line?: string;
  intent?: string;
  risk: string;
  add?: Cast[];
  remove?: Cast[];
  clear?: boolean;
  allies?: Cast[];
  use?: Cast[];
  flags?: string[];
  beats: Beat[];
  next?: string;
  ending?: Ending;
  title?: string;
  summary?: string;
}
export interface Action {
  id: string;
  strategy: Strategy;
  line: string;
  intent: string;
  requires: Cond[];
  blockedBy?: Cond[];
  locks: { when?: Cond; text: string }[];
  outcomes: Outcome[];
}
export interface DinnerNode {
  id: string;
  scene: number;
  speaker: Speaker;
  target: Cast | 'you';
  topic: string;
  situation: string;
  ask: string;
  enter?: Cast[];
  actions: Action[];
}
export interface Dinner {
  start: string;
  scenes: string[];
  cast: Cast[];
  allies: Cast[];
  watching: Cast[];
  pileOn: Beat[];
  nodes: DinnerNode[];
}

export const dinner = data as Dinner;
export const PILE_LIMIT = 3;
export const nodeById = (id: string): DinnerNode => {
  const node = dinner.nodes.find(item => item.id === id);
  if (!node) throw new Error(`未知节点 ${id}`);
  return node;
};
export const strategyNames: Record<Strategy, string> = { ally: '请人接话', taiji: '太极', counter: '反问', crazy: '发疯', sincere: '真心', leave: '离席' };
export const relatives: Record<Relative, { name: string; trait: string }> = {
  sangu: { name: '三姑', trait: '热心，最爱催婚' },
  erjiu: { name: '二舅', trait: '爱比较，更爱聊鱼塘' },
  dayi: { name: '大姨', trait: '操心工作稳不稳' },
  gufu: { name: '姑父', trait: '' },
  ershen: { name: '二婶', trait: '' },
  biaojie: { name: '表姐', trait: '同辈，也常被催' },
  wangayi: { name: '王阿姨', trait: '' },
  nainai: { name: '奶奶', trait: '向着你，能替你接一次话' },
  table: { name: '全桌', trait: '' },
};
export const nameOf = (who: Relative): string => relatives[who].name;
