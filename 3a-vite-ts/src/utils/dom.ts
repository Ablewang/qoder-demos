// DOM element factory.

export function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string | null,
  html?: string | null,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (html != null) {
    el.innerHTML = html;
  }
  return el;
}
