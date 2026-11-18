import { translationSchema, type Relation, type Translation } from './contract.js';

export interface Demo { relation: Relation; title: string; original: string; result: Translation }
export const demos: Demo[] = [
  {
    relation: 'partner', title: '伴侣 · 等不到回复', original: '你怎么又不回消息！是不是根本没把我当回事？',
    result: {
      kind: 'translation', risk: 'none', note: '',
      heard_as: '对方可能听成：你不回消息，就是不在乎我。这只是一个可能的理解。',
      real_meaning: { observation: '发出的消息还没有收到回复', feeling: '可能有些担心，也有点委屈', need: '希望自己的消息被重视', request: '忙的时候能简单说一声' },
      rewrites: { gentle: '没收到你的回复，我有点担心。忙的话简单说一声就好。', firm: '等不到回复会让我不安。忙的时候请说一声，我希望我们约定一下。', humor: '我的消息好像迷路了，方便时给它回个信号吧。' },
      tip: '想表达担心，不一定要先给对方下结论。',
    },
  },
  {
    relation: 'parent', title: '父母 · 被反复催婚', original: '能不能别再催我结婚了！我的事不用你们管！',
    result: {
      kind: 'translation', risk: 'none', note: '', heard_as: '对方可能听成：你们的关心让我很烦。这不代表对方一定这么想。',
      real_meaning: { observation: '结婚的事被反复提起', feeling: '可能有些压力，也有点烦', need: '自己的生活节奏被尊重', request: '先暂停催婚这个话题' },
      rewrites: { gentle: '我知道你们关心我，但反复聊结婚让我有压力。这件事我会自己考虑，我们先聊别的好吗？', firm: '结婚的决定我会自己负责。请先停止催促，我不想继续讨论这个话题。', humor: '我的人生不是快递，暂时没有统一到货时间。这事我会认真考虑，咱们先换个话题吧。' },
      tip: '可以接住关心，也可以把自己的边界说清楚。',
    },
  },
  {
    relation: 'colleague', title: '同事 · 第三次延期', original: '你负责的部分已经第三次延期了！能不能靠谱一点？',
    result: {
      kind: 'translation', risk: 'none', note: '', heard_as: '对方可能听成：你不只是这次延期，而是整个人不可靠。这只是一种可能。',
      real_meaning: { observation: '对方负责的部分第三次延期', feeling: '可能着急，也有些被动', need: '合作进度有明确预期', request: '确认可交付的时间并提前同步风险' },
      rewrites: { gentle: '这部分是第三次延期了，我有点着急。我们确认一个可交付的时间，卡住的地方也一起说清楚？', firm: '这部分已第三次延期。请明确交付时间，如果有风险请提前同步，避免继续影响后续安排。', humor: '这部分已经三次延后登场了，咱们给它定一个能兑现的出场时间吧。' },
      tip: '说明具体的延期和需求，不给同事贴“不靠谱”的标签。',
    },
  },
  {
    relation: 'child', title: '孩子 · 还没写作业', original: '作业还没开始写！说了多少遍了，再拖今天别想看电视！',
    result: {
      kind: 'translation', risk: 'none', note: '', heard_as: '孩子可能听成：我又做错了，正在被责怪。不一定是孩子真实的想法。',
      real_meaning: { observation: '作业还没有开始', feeling: '可能着急，也有些累', need: '希望事情按约定完成', request: '一起确认开始时间和休息安排' },
      rewrites: { gentle: '作业还没开始，我有点着急。你想先做哪一项？我们一起定好写作业和看电视的时间。', firm: '现在需要先开始写作业。我们把完成时间和看电视的安排说清楚，按约定来。', humor: '作业本还在等你开场呢。我们先定个开始时间，写完再安排电视时间，好吗？' },
      tip: '描述行为、说清安排，而不是威胁或给孩子贴标签。',
    },
  },
  {
    relation: 'friend', title: '朋友 · 不想被敷衍', original: '随便你，你每次都不听我的意见！',
    result: {
      kind: 'translation', risk: 'none', note: '', heard_as: '对方可能听成：你已经失望，不想继续聊了。但这并不是唯一解释。',
      real_meaning: { observation: '自己的意见好像没有被采纳', feeling: '可能失落，也有点生气', need: '希望意见被认真听见', request: '先听完彼此的想法再决定' },
      rewrites: { gentle: '我也想让我的意见被认真听一下。我们先把彼此的想法说完，再一起决定好吗？', firm: '我不想用“随便”结束讨论。请先听完我的想法，再决定怎么安排。', humor: '我的意见还在排队等发言呢，先给它一分钟，再决定下一步吧。' },
      tip: '“随便”可能把继续沟通的门关上，直接说想被听见更清楚。',
    },
  },
];
for (const demo of demos) translationSchema.parse(demo.result);
