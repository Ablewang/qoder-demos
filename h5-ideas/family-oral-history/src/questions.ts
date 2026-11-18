import type { Stage } from './shared';

export interface Question { id: string; text: string; stage: Stage; depth: 'gentle' | 'deep' }
export const stages: Stage[] = ['童年', '求学', '工作', '恋爱结婚', '养孩子', '那个年代', '心里话'];
const groups: [Stage, [string, boolean][]][] = [
  ['童年', [
    ['你小时候最想长大当什么？', false],
    ['小时候过年，你最盼着的是什么？', false],
    ['小时候住的房子是什么样的？你睡在哪儿？', false],
    ['小时候最常跟谁一起玩？玩什么？', false],
    ['如果愿意说，小时候家里有过吃不饱的时候吗？怎么过来的？', true],
  ]],
  ['求学', [
    ['上学要走多远的路？路上是什么样子？', false],
    ['印象最深的一位老师是谁？为什么？', false],
    ['那时候考试考砸了，回家会怎么样？', false],
    ['上学时有没有特别要好的同学？现在还联系吗？', false],
    ['有没有想读却没读成的学校或学问？不想说也没关系。', true],
  ]],
  ['工作', [
    ['第一份工作是干什么的？第一天还记得吗？', false],
    ['第一份工资是多少？花在哪儿了？', false],
    ['工作这些年，最得意的一件事是什么？', false],
    ['如果愿意说，有过差点干不下去的时候吗？后来怎么撑过去的？', true],
    ['换工作或者退休那天，心里是怎么想的？', true],
  ]],
  ['恋爱结婚', [
    ['和爱人第一次见面是什么场景？不适用可以换一题。', false],
    ['那时候谈对象，通常去哪儿约会？', false],
    ['结婚那天是什么样子？有哪些让你笑的事？', false],
    ['如果愿意说，当初家里同意你们在一起吗？', true],
    ['如果愿意说，一起生活最难的一段是什么时候？', true],
  ]],
  ['养孩子', [
    ['孩子出生那天，你在干什么？', false],
    ['孩子小时候最让你头疼的一件事是什么？', false],
    ['孩子小时候说过什么话，让你记到现在？', false],
    ['如果愿意说，养孩子那几年最缺的是什么？', true],
    ['有没有一直想跟孩子说，但还没说出口的话？可以不说。', true],
  ]],
  ['那个年代', [
    ['家里第一台电视或第一辆自行车，是怎么买到的？', false],
    ['如果经历过粮票、布票的年代，你们家是怎么用的？', false],
    ['如果记得1977年恢复高考，那会儿你在干什么？', false],
    ['搬过几次家？哪一次变化最大？', false],
    ['如果愿意说，有没有现在想起来仍心疼的往事？可以跳过。', true],
  ]],
];
export const questions: Question[] = groups.flatMap(([stage, list], group) => list.map(([text, deep], index) => ({
  id: `${group + 1}-${index + 1}`, text, stage, depth: deep ? 'deep' : 'gentle',
})));
const starterIds = ['1-1', '1-2', '2-1', '3-1', '6-1', '6-4'];
export const starters = starterIds.map((id) => questions.find((q) => q.id === id)!);
