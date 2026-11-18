import { z } from 'zod';

export const relations = ['partner', 'parent', 'friend', 'colleague', 'child'] as const;
export type Relation = typeof relations[number];
export const relationLabels: Record<Relation, string> = {
  partner: '伴侣', parent: '父母', friend: '朋友', colleague: '同事', child: '孩子',
};
export const tones = ['gentle', 'firm', 'humor'] as const;
export type Tone = typeof tones[number];
export const toneLabels: Record<Tone, string> = { gentle: '温和', firm: '坚定', humor: '幽默' };
export const countChars = (text: string): number => [...text].length;
const text = (max: number) => z.string().trim().min(1).refine((v) => countChars(v) <= max);
const optionalText = (max: number) => z.string().trim().refine((v) => countChars(v) <= max);

export const requestSchema = z.object({
  version: z.literal(1), mode: z.literal('soften'), relation: z.enum(relations), text: text(300),
}).strict();
export type AssistRequest = z.infer<typeof requestSchema>;

export const translationSchema = z.object({
  kind: z.literal('translation'),
  risk: z.enum(['none', 'caution']),
  note: optionalText(120),
  heard_as: text(120),
  real_meaning: z.object({
    observation: text(80), feeling: text(80), need: text(80), request: text(80),
  }).strict(),
  rewrites: z.object({ gentle: text(160), firm: text(160), humor: text(160) }).strict(),
  tip: optionalText(120),
}).strict().refine((v) => v.risk !== 'caution' || v.note.length > 0);
export type Translation = z.infer<typeof translationSchema>;

export const safetyCategories = [
  'self_harm', 'violence_to_user', 'threat_to_other', 'abuse', 'manipulation', 'uncertain',
] as const;
export type SafetyCategory = typeof safetyCategories[number];
export const safetySchema = z.object({
  kind: z.literal('safety'), category: z.enum(safetyCategories),
}).strict();
export const resultSchema = z.union([translationSchema, safetySchema]);
export type AssistResult = z.infer<typeof resultSchema>;
export const responseSchema = z.object({
  version: z.literal(1), mode: z.literal('soften'),
  source: z.enum(['model', 'local_safety']), result: resultSchema,
}).strict().refine((v) => v.source !== 'local_safety' || v.result.kind === 'safety');
export type AssistResponse = z.infer<typeof responseSchema>;
export const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }).strict() }).strict();
export const statusSchema = z.object({ configured: z.boolean() }).strict();

export const safetyContent: Record<SafetyCategory, { title: string; message: string }> = {
  self_harm: { title: '先照顾好此刻的你', message: '这句话可能涉及自伤风险。先不急着发消息。若能安全做到，请让一个可信赖的人陪着你，并联系专业支持。若有即时危险，请联系当地急救。' },
  violence_to_user: { title: '你的安全，比措辞更重要', message: '你有权拒绝暴力、保持距离并寻求保护。明确的边界没有错，不需要说得更软。若有即时危险，请联系当地警方；不要为了沟通而留在不安全的现场。' },
  threat_to_other: { title: '先暂停，不把威胁发出去', message: '这段话可能涉及实际伤害风险，我们不会把威胁改写成更好听的话。若能安全做到，请先与对方保持距离，联系可信赖的人或专业支持；有即时危险请联系当地警方。' },
  abuse: { title: '先停止冲突，保护孩子', message: '我们不会改写对孩子或弱者的暴力威胁。若能安全做到，先停止冲突，让可靠的成年人照顾孩子，并寻求专业支持。有即时危险请联系当地警方或急救。' },
  manipulation: { title: '可以表达需要，不帮忙操控', message: '我们不提供欺骗、愧疚绑架或控制他人的话术。你可以重新写下自己的真实感受和明确请求，让对方保有拒绝的空间。' },
  uncertain: { title: '先确认安全，再谈表达', message: '这段话的语境还不足以判断是否安全，我们暂不生成改写。若只是气话，可以补充事实和你希望发生的改变；若涉及威胁或伤害，请先寻求支持。' },
};
