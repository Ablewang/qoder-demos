import type { NoticeFact } from '../../../src/contracts/index.ts';
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
}
export function button(text: string, action: () => void | Promise<void>, className?: string): HTMLButtonElement {
  const node = el('button', text, className); node.type = 'button';
  node.addEventListener('click', () => { Promise.resolve().then(action).catch(() => { showError('操作失败，请检查后台状态'); }); });
  return node;
}
export function showError(message: string, className = 'error'): void {
  const panel = document.querySelector<HTMLElement>('.panel');
  const host = panel && !panel.hidden ? panel : document.querySelector('#app'); if (!host) return;
  host.querySelector('.error')?.remove(); const note = el('p', message, className); note.setAttribute('role', 'alert'); host.append(note);
}
export function factsNode(facts: NoticeFact[], limit = Infinity): HTMLElement {
  const list = el('dl', undefined, 'facts');
  for (const fact of facts.slice(0, limit)) {
    list.append(el('dt', fact.label), el('dd', String(fact.value) + (fact.unit === undefined ? '' : fact.unit)));
  }
  return list;
}
export function field(label: string, input: HTMLElement): HTMLElement { const row = el('label', undefined, 'field'); input.setAttribute('aria-label', label); row.append(el('span', label), input); return row; }
export function input(value: string, maxLength = 200, type = 'text'): HTMLInputElement { const node = el('input'); node.type = type; node.value = value; node.maxLength = maxLength; return node; }
export function select(options: [string, string][], value: string): HTMLSelectElement {
  const node = el('select'); for (const [id, label] of options) { const opt = el('option', label); opt.value = id; node.append(opt); } node.value = value; return node;
}
export function check(value: boolean): HTMLInputElement { const node = input('', 1, 'checkbox'); node.checked = value; return node; }
export function dialog(message: string, yes: string, action: () => Promise<void>): void {
  const modal = el('dialog', undefined, 'confirm'); modal.setAttribute('aria-label', '删除确认');
  modal.append(el('p', message), button(yes, async () => { await action(); modal.close(); modal.remove(); }, 'danger'), button('取消', () => { modal.close(); modal.remove(); }));
  document.body.append(modal); modal.showModal();
}
