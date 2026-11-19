import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ContractError, PERSONA_LIMITS, OWNER } from '../contracts/index.ts';
import type { Persona, PersonaView, Actor, AuditWriter } from '../contracts/index.ts';

export const DEFAULT_PERSONA: Persona = { formatVersion: 1, name: '团子', skin: 'tuanzi-default', addressUser: '你', traits: ['靠谱', '元气'], speakingStyle: { verbosity: 'normal', emoji: false, formality: 'casual' }, catchphrases: [], taboos: [], description: '' };

export function validatePersona(persona: Persona): void {
  const bad = () => { throw new ContractError('bad_request', 'invalid persona fields'); };
  for (const field of ['name', 'addressUser'] as const) {
    const value = persona[field];
    if (typeof value !== 'string' || [...value].length < PERSONA_LIMITS[field][0] || [...value].length > PERSONA_LIMITS[field][1] || !value.trim()) bad();
  }
  for (const field of ['traits', 'catchphrases', 'taboos'] as const) {
    const value = persona[field];
    if (!Array.isArray(value) || value.length > PERSONA_LIMITS[field].items || value.some((item) => typeof item !== 'string' || !item.trim() || [...item].length > PERSONA_LIMITS[field].chars)) bad();
  }
  if (typeof persona.description !== 'string' || [...persona.description].length > PERSONA_LIMITS.description || persona.formatVersion !== 1 || persona.skin !== 'tuanzi-default') bad();
  const style = persona.speakingStyle;
  if (!style || !['terse', 'normal', 'chatty'].includes(style.verbosity) || !['casual', 'neutral'].includes(style.formality) || typeof style.emoji !== 'boolean') bad();
}

export function serializePersona(persona: Persona): string {
  const { description, speakingStyle, ...head } = persona;
  return '---\n' + Object.entries(head).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n') + '\nspeakingStyle:\n' + Object.entries(speakingStyle).map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`).join('\n') + '\n---\n' + description;
}

export function parsePersona(source: string): Persona {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (!match) throw new ContractError('bad_request', 'invalid persona format');
  const head: Record<string, unknown> = {};
  const style: Record<string, unknown> = {};
  let inStyle = false;
  try {
    for (const line of match[1].split(/\r?\n/)) {
      if (line === 'speakingStyle:') { inStyle = true; continue; }
      const entry = /^(\s*)(\w+):\s*(.+)$/.exec(line);
      if (!entry) throw new Error();
      const target = entry[1] && inStyle ? style : head;
      target[entry[2]] = JSON.parse(entry[3]);
    }
  } catch { throw new ContractError('bad_request', 'invalid persona format'); }
  const persona = { ...head, speakingStyle: style, description: match[2] } as unknown as Persona;
  validatePersona(persona);
  return persona;
}

export function createPersonaStore(deps: { companionDir: string; audit: AuditWriter; now(): number; newId(prefix: string): string }) {
  const file = path.join(deps.companionDir, 'persona.md');
  let firstRun = !existsSync(file);
  let current = firstRun ? structuredClone(DEFAULT_PERSONA) : parsePersona(readFileSync(file, 'utf8'));
  return {
    view(): PersonaView { return { persona: structuredClone(current), firstRun }; },
    update(patch: Partial<Persona>, by: Actor): Persona {
      if (by.kind !== 'user' || by.personId !== OWNER) throw new ContractError('rejected', 'persona requires owner');
      const allowed = new Set(Object.keys(DEFAULT_PERSONA));
      if (!patch || typeof patch !== 'object' || Object.keys(patch).some((k) => !allowed.has(k))) throw new ContractError('bad_request', 'invalid persona fields');
      const next = { ...current, ...patch };
      validatePersona(next);
      mkdirSync(deps.companionDir, { recursive: true, mode: 0o700 });
      const temp = `${file}.${randomBytes(8).toString('hex')}.tmp`;
      try { writeFileSync(temp, serializePersona(next), { flag: 'wx', mode: 0o600 }); renameSync(temp, file); }
      finally { try { unlinkSync(temp); } catch {} }
      current = structuredClone(next);
      firstRun = false;
      deps.audit.append({ id: deps.newId('audit'), at: deps.now(), actor: by, kind: 'config', refs: {}, summary: 'persona.updated', outcome: 'ok' });
      return structuredClone(current);
    },
  };
}
