import type { Category, CheckStatus, Saying, Verdict } from '../types';

export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  right: '说得对',
  half: '有一半在理',
  outdated: '现在有新建议',
};

export const VERDICT_CARD_LABEL: Record<Verdict, string> = {
  right: '这句老话说得对',
  half: '这句老话有一半在理',
  outdated: '这件事现在有新建议',
};

export const STATUS_LABEL: Record<CheckStatus, string> = {
  'source-checked': '来源原文已核对',
  pending: '待核验 · 仅演示',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  parenting: '育儿',
  health: '养生',
};

export function badges(s: Saying): string {
  const status = `<span class="badge status-${s.status}">${STATUS_LABEL[s.status]}</span>`;
  return s.status === 'pending'
    ? status
    : status + `<span class="badge verdict-${s.verdict}">${VERDICT_LABEL[s.verdict]}</span>`;
}

export function sayingItem(s: Saying, number = ''): string {
  const pending = s.status === 'pending';
  return `<li><a class="item${pending ? ' item-pending' : ''}" href="#/s/${esc(s.id)}">
    <span class="entry-number" aria-hidden="true">${esc(number)}</span>
    <span class="entry-content">
      ${pending ? `<span class="item-badges">${badges(s)}</span>` : ''}
      <span class="item-title">“${esc(s.title)}”</span>
      ${pending
        ? '<span class="pending-context">未核验，不能作为医疗建议</span>'
        : `<span class="item-badges"><span class="verdict-${s.verdict}">${VERDICT_LABEL[s.verdict]}</span><span>${s.sources.length} 段来源原文</span></span>`}
    </span>
    <span class="entry-arrow" aria-hidden="true">↗</span>
  </a></li>`;
}
