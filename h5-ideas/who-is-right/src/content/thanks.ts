export interface ThanksTemplate {
  id: string;
  tone: string;
  text: string;
  lines: string[];
}

export const THANKS_TEMPLATES: ThanksTemplate[] = [
  { id: 'plain', tone: '简单一句', text: '知道了。', lines: ['{称呼}，知道了'] },
  { id: 'discuss', tone: '商量着来', text: '这件事，咱们再商量商量。', lines: ['{称呼}，这件事', '咱们再商量商量'] },
  { id: 'remind', tone: '谢谢提醒', text: '谢谢提醒。', lines: ['{称呼}，谢谢提醒'] },
  { id: 'warm', tone: '暖一点', text: '咱们慢慢说。', lines: ['{称呼}，咱们慢慢说'] },
];
