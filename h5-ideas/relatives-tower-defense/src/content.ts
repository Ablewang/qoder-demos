import data from './content/questions.json';

export type Card = 'taiji' | 'counter' | 'crazy' | 'sincere';
export type Identity = 'single' | 'married' | 'graduate' | 'exam';
export type Kind = 'normal' | 'fast' | 'tough' | 'warm' | 'boss' | 'followup';
export type Relative = 'sangu' | 'erjiu' | 'dayi' | 'gufu' | 'ershen' | 'biaojie' | 'wangayi' | 'nainai' | 'table';
export interface Question {
  id: string;
  category: string;
  kind: Kind;
  identities: Identity[];
  askers: Relative[];
  text: string;
  answers: Record<Card, string>;
}
export const questions = data as Question[];
export const cards: Card[] = ['taiji', 'counter', 'crazy', 'sincere'];
export const cardNames: Record<Card, string> = { taiji: '太极', counter: '反问', crazy: '发疯', sincere: '真心' };
export const relatives: Record<Relative, { name: string; line: string }> = {
  sangu: { name: '三姑', line: '姑不催了，先给你夹个鸡腿。' },
  erjiu: { name: '二舅', line: '孩子自己有数！来，舅教你包饺子。' },
  dayi: { name: '大姨', line: '你们有打算就行，汤还热着呢。' },
  gufu: { name: '姑父', line: '日子踏实就好，先吃菜。' },
  ershen: { name: '二婶', line: '各有各的好，不比了，吃菜。' },
  biaojie: { name: '表姐', line: '有自己的想法就好，姐支持你。' },
  wangayi: { name: '王阿姨', line: '过好自己的日子就行，我来帮腔。' },
  nainai: { name: '奶奶', line: '奶奶等着你，明天一起包饺子。' },
  table: { name: '全桌齐问', line: '好，开心回来就行！碰个杯。' },
};
export const identities: { id: Identity; name: string; note: string; icon: Relative }[] = [
  { id: 'single', name: '未婚打工人', note: '对象这题，年年必考', icon: 'sangu' },
  { id: 'married', name: '已婚未育', note: '自己的日子，自己安排', icon: 'dayi' },
  { id: 'graduate', name: '刚毕业', note: '人生刚开席，慢慢来', icon: 'biaojie' },
  { id: 'exam', name: '考研考公中', note: '等成绩，也要吃热饭', icon: 'wangayi' },
];
export const waveNames = ['凉菜开席', '热菜上桌', '饺子压轴', '全桌齐问'];
