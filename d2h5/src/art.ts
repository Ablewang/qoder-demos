import { getBase, itemHasType } from './items';

const HEROES = new Set(['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass']);
export const ART_KEYS = [
  'ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass', 'traveler',
  'fallen', 'skeleton', 'zombie', 'quill', 'tree', 'ruin', 'cottage', 'chest',
  'sword', 'axe', 'mace', 'bow', 'staff', 'spear', 'helm', 'armor', 'shield',
  'gloves', 'boots', 'belt', 'ring', 'amulet', 'health', 'mana', 'rejuvenation',
  'scroll', 'book', 'rune', 'gem', 'cube', 'gold', 'arrows',
  'earth', 'flagstone', 'basalt', 'sand', 'volcanic', 'snow', 'leather', 'carved-stone', 'gate',
] as const;

export function artUrl(name: string): string {
  if (name === 'town-scroll' || name === 'identify-scroll') {
    const color = name === 'town-scroll' ? '#367ed8' : '#c54139';
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="paper"><stop stop-color="#f1dfad"/><stop offset=".5" stop-color="#c6a569"/><stop offset="1" stop-color="#806039"/></linearGradient><linearGradient id="ink"><stop stop-color="${color}"/><stop offset="1" stop-color="#241a22"/></linearGradient></defs><g transform="rotate(35 32 32)"><path d="M19 12h26v40H19z" fill="url(#ink)" stroke="#241c13" stroke-width="2"/><path d="M17 10h30v9H17zM17 46h30v9H17z" fill="url(#paper)" stroke="#4a3421" stroke-width="2"/><ellipse cx="17" cy="14.5" rx="4" ry="4.5" fill="#997341" stroke="#4a3421"/><ellipse cx="47" cy="50.5" rx="4" ry="4.5" fill="#ebd59e" stroke="#4a3421"/><path d="M24 22v19M27 22v19" stroke="#e3d3ad" opacity=".45"/><path d="M19 29h26v7H19z" fill="${color}" stroke="#241c13"/><circle cx="32" cy="32" r="5" fill="${color}" stroke="#ebd59e" stroke-width="1.5"/><path d="M30 30l4 4m0-4-4 4" stroke="#f5e6b7" stroke-width="1"/></g></svg>`)}`;
  }
  if (name === 'skull') return `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="bone" cx="38%" cy="25%"><stop stop-color="#eee6c8"/><stop offset=".65" stop-color="#b4a88c"/><stop offset="1" stop-color="#746b59"/></radialGradient></defs><path d="M16 36C8 11 20 6 32 6s24 5 16 30l-6 7v12H22V43z" fill="url(#bone)" stroke="#302a22" stroke-width="2"/><path d="M19 24c-5 2-4 11 3 11 7-1 6-7 2-10zm26 0c5 2 4 11-3 11-7-1-6-7-2-10zM32 33l-5 9h10z" fill="#201c17"/><path d="M23 45h18M27 45v9m5-9v10m5-10v9M23 17l5-3m8 0 5 3" fill="none" stroke="#6c604c" stroke-width="1.5"/></svg>')}`;
  if (name === 'key') return `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="metal"><stop stop-color="#dfd0a0"/><stop offset=".5" stop-color="#95815a"/><stop offset="1" stop-color="#ccb783"/></linearGradient></defs><g transform="rotate(32 32 32)"><path d="M29 25h6v18h9v5h-9v4h8v5H29z" fill="url(#metal)" stroke="#32291d" stroke-width="1.5" stroke-linejoin="round"/><circle cx="32" cy="16" r="10" fill="none" stroke="#32291d" stroke-width="7"/><circle cx="32" cy="16" r="10" fill="none" stroke="url(#metal)" stroke-width="4"/><path d="M30 29v24" fill="none" stroke="#e1d2ab" stroke-width="1"/></g></svg>')}`;
  return `${import.meta.env?.BASE_URL ?? '/'}art/${name}.webp`;
}
export function heroArtKey(id: string): string {
  return HEROES.has(id) ? id : 'traveler';
}
export function itemArtKey(code: string): string {
  if (code === 'tsc') return 'town-scroll';
  if (code === 'isc') return 'identify-scroll';
  if (/^hp[1-5]$/.test(code)) return 'health';
  if (/^mp[1-5]$/.test(code)) return 'mana';
  if (code === 'rvs' || code === 'rvl') return 'rejuvenation';
  if (code === 'key' || /^pk[1-3]$/.test(code)) return 'key';
  if (/^r\d{2}$/.test(code)) return 'rune';
  const base = getBase(code);
  if (!base) return 'sword';
  const type = (value: string) => itemHasType(base, value);
  if (base.type === 'gemz') return 'skull';
  if (type('gem') || type('jewl')) return 'gem';
  if (type('bowq') || type('xboq')) return 'arrows';
  if (type('bow') || type('xbow')) return 'bow';
  if (type('axe') || type('taxe')) return 'axe';
  if (type('spea') || type('pole') || type('jave')) return 'spear';
  if (type('staf') || type('wand') || type('scep') || type('orb')) return 'staff';
  if (type('mace') || type('club') || type('hamm')) return 'mace';
  const slots: Record<string, string> = { head: 'helm', body: 'armor', offhand: 'shield', gloves: 'gloves', boots: 'boots', belt: 'belt', ring1: 'ring', neck: 'amulet' };
  if (base.slot && slots[base.slot]) return slots[base.slot];
  if (code === 'box') return 'cube';
  if (code === 'gld') return 'gold';
  if (type('book')) return 'book';
  if (type('scro')) return 'scroll';
  if (type('pot')) return 'health';
  if (type('char')) return 'amulet';
  return 'sword';
}
