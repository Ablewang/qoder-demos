import type { Persona } from '../contracts/index.ts';
import { LINES, EVENT_EMOJI, FALLBACK_LINES } from './lines/templates.ts';
import type { LineEvent, LineTemplate } from './lines/templates.ts';

export function safeAssistantText(text: string, persona: Persona): string {
  return persona.taboos.some((taboo) => text.includes(taboo)) ? '' : text;
}

export function createLineSelector(random: () => number = Math.random) {
  const recent: string[] = [];
  return (event: LineEvent, persona: Persona, options: { tone?: string; card?: boolean; values?: Record<string, string | number> } = {}): string => {
    const style = persona.speakingStyle;
    const noSnark = ['concern', 'care'].includes(options.tone ?? '') || ['remember', 'forgotten'].includes(event);
    const resolve = (template: LineTemplate) => template.text.replace(/\{(name|addressUser|count|unread|duration|time)\}/g, (_, key: string) => String(key === 'name' || key === 'addressUser' ? persona[key] : options.values?.[key] ?? '')).replace('{catchphrase}', '');
    const eligible = (template: LineTemplate) => {
      const tags = template.tags ?? [];
      return (!template.tone || template.tone === options.tone) && (!noSnark || !tags.some((t) => ['毒舌', '傲娇'].includes(t))) && (style.formality !== 'neutral' || !tags.includes('俏皮')) && (tags.filter((t) => t !== '俏皮').length === 0 || tags.some((t) => persona.traits.includes(t))) && !persona.taboos.some((t) => resolve(template).includes(t));
    };
    let choices = LINES[event][style.verbosity].filter((t) => eligible(t) && !recent.includes(t.text));
    if (!choices.length) choices = LINES[event].terse.filter((t) => !t.tags?.length && eligible(t) && !recent.includes(t.text));
    if (!choices.length) choices = FALLBACK_LINES[event].map((text) => ({ text })).filter((t) => eligible(t) && !recent.includes(t.text));
    if (!choices.length) return '';
    const weighted = choices.flatMap((t) => t.tags?.some((tag) => persona.traits.includes(tag)) ? [t, t] : [t]);
    const template = weighted[Math.min(weighted.length - 1, Math.max(0, Math.floor(random() * weighted.length)))];
    recent.push(template.text);
    if (recent.length > 5) recent.shift();
    let text = resolve(template);
    if (!options.card && style.verbosity !== 'terse' && persona.catchphrases.length && random() < 0.25) {
      const safe = persona.catchphrases.filter((phrase) => !persona.taboos.some((taboo) => phrase.includes(taboo)));
      if (safe.length) text += safe[Math.min(safe.length - 1, Math.floor(random() * safe.length))];
    }
    if (style.emoji) text += EVENT_EMOJI[event];
    return safeAssistantText(text, persona);
  };
}
