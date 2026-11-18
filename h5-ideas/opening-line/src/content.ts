import library from './templates.json' with { type: 'json' };

export const recipients = [
  { id: 'friend', label: '朋友', icon: '01' },
  { id: 'classmate', label: '同学', icon: '02' },
  { id: 'roommate', label: '室友', icon: '03' },
  { id: 'partner', label: '伴侣', icon: '04' },
  { id: 'parent', label: '父母', icon: '05' },
  { id: 'child', label: '子女', icon: '06' },
  { id: 'grandchild', label: '孙辈', icon: '07' },
  { id: 'relative', label: '亲戚', icon: '08' },
  { id: 'teacher', label: '老师', icon: '09' },
  { id: 'manager', label: '领导', icon: '10' },
  { id: 'colleague', label: '同事', icon: '11' },
  { id: 'service_staff', label: '店员 / 客服', icon: '12' },
  { id: 'stranger', label: '陌生人', icon: '13' },
] as const;

export const categories = [
  { id: 'social', label: '日常开口' },
  { id: 'work', label: '工作上的话' },
  { id: 'partner', label: '伴侣与家里' },
  { id: 'help', label: '找人帮帮我' },
  { id: 'elder', label: '惦记晚辈' },
  { id: 'repair', label: '重新说上话' },
] as const;

export const states = [
  { id: 'very_nervous', label: '我很紧张', detail: '先说短一点，也可以', symbol: '—' },
  { id: 'awkward', label: '有点尴尬', detail: '说得自然一点就好', symbol: '≈' },
  { id: 'okay', label: '还好', detail: '把事情清楚说出来', symbol: '+' },
] as const;

export type RecipientId = (typeof recipients)[number]['id'];
export type CategoryId = (typeof categories)[number]['id'];
export type StateId = (typeof states)[number]['id'];
export type Lines = { opening: string; main: string; ifDeclined: string; closing: string };
export type Scene = { id: string; categoryId: CategoryId; label: string; recipientIds: RecipientId[]; hint: string; help: boolean };
export type Template = { id: string; sceneId: string; recipientIds: RecipientId[]; stateIds: StateId[]; variant: 'short' | 'natural'; lines: Lines };

export const scenes = library.scenes as Scene[];
export const templates = library.templates as Template[];

export function matchingTemplates(sceneId: string, recipientId: string, stateId: string): Template[] {
  const preferred = stateId === 'very_nervous' ? 'short' : 'natural';
  const scene = scenes.find((item) => item.id === sceneId);
  if (!scene?.recipientIds.some((id) => id === recipientId)) return [];
  return templates
    .filter((item) => item.sceneId === sceneId && item.recipientIds.some((id) => id === recipientId) && item.stateIds.some((id) => id === stateId))
    .sort((a, b) => Number(b.variant === preferred) - Number(a.variant === preferred));
}

export function availableScenes(recipientId: string, categoryId = 'all'): Scene[] {
  return scenes.filter((scene) =>
    (categoryId === 'all' || scene.categoryId === categoryId) &&
    scene.recipientIds.some((id) => id === recipientId) &&
    states.some((state) => matchingTemplates(scene.id, recipientId, state.id).length > 0),
  );
}

export const quickScenes = [
  { sceneId: 'teacher_leave', recipientId: 'teacher', label: '跟老师请个假' },
  { sceneId: 'roommate_noise', recipientId: 'roommate', label: '请室友小声点' },
  { sceneId: 'refund', recipientId: 'service_staff', label: '退货怎么说' },
  { sceneId: 'reject_invite', recipientId: 'friend', label: '这次邀约不去了' },
] satisfies { sceneId: string; recipientId: RecipientId; label: string }[];

// In-person scripts, or an opening that asks a question the main line answers for the other person.
const openingOnly = new Set(['directions.short', 'directions.natural', 'boba.short', 'boba.natural', 'refund.short', 'after_argument.natural']);

export function fullMessage(template: Template): string | null {
  const scene = scenes.find((item) => item.id === template.sceneId);
  if (!scene || scene.help || openingOnly.has(template.id)) return null;
  return `${template.lines.opening}\n${template.lines.main}`;
}
