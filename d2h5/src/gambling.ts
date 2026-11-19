import type { GamblingOffer, Item, Player, Quality, Rng } from './types';
import { num, rawRows, text } from './catalog';
import { createItem, getBase, itemHasType } from './items';

export const GAMBLING_CODES = rawRows('gamble').map(row => text(row, 'code'));
const roll = (rng: Rng, count: number) => Math.floor(rng() * count);

export function gamblingItemLevel(level: number, rng: Rng): number {
  return Math.max(5, Math.min(99, level - 5 + roll(rng, 10)));
}

export function gamblingQuality(rng: Rng): Quality {
  const value = roll(rng, 100000);
  return value < 50 ? 'unique' : value < 150 ? 'set' : value < 10150 ? 'rare' : 'magic';
}

export function gamblingUpgrade(code: string, ilvl: number, rng: Rng): string {
  const base = getBase(code)!, exceptional = getBase(text(base.raw, 'ubercode'));
  if (!exceptional) return code;
  const threshold = 90 * (ilvl - exceptional.qlvl) + 1;
  if (threshold <= 0) return code;
  if (roll(rng, 10000) < threshold) return exceptional.code;
  const elite = getBase(text(base.raw, 'ultracode'));
  if (elite) {
    const eliteThreshold = 33 * (ilvl - elite.qlvl) + 1;
    if (eliteThreshold > 0 && roll(rng, 10000) < eliteThreshold) return elite.code;
  }
  return code;
}

function generate(code: string, ilvl: number, rng: Rng): Item {
  const upgraded = gamblingUpgrade(code, ilvl, rng);
  return createItem(upgraded, ilvl, rng, gamblingQuality(rng), undefined, 'gambling');
}

export function rollGamblingItem(code: string, level: number, rng: Rng): Item {
  return generate(code, gamblingItemLevel(level, rng), rng);
}

function offer(item: Item): GamblingOffer {
  const base = getBase(item.code)!;
  return { uid: `gamble-${crypto.randomUUID()}`, code: text(base.raw, 'normcode', item.code), item };
}

export function gamblingStock(level: number, rng: Rng): GamblingOffer[] {
  return Array.from({ length: 14 }, (_, index) => {
    const ilvl = gamblingItemLevel(level, rng), pool = GAMBLING_CODES.filter(code => getBase(code)!.qlvl <= ilvl);
    const candidate = pool[roll(rng, pool.length)], code = index === 0 ? 'rin' : index === 1 ? 'amu' : candidate;
    return offer(generate(code, ilvl, rng));
  });
}

export function refillGamblingOffer(previous: GamblingOffer, level: number, rng: Rng): GamblingOffer {
  const code = previous.code === 'ci0' || previous.code === 'ci1' ? roll(rng, 2) ? 'ci1' : 'ci0' : previous.code;
  return offer(rollGamblingItem(code, level, rng));
}

function discount(item: Item): number {
  if (item.mods.vendorDiscount !== undefined) return item.mods.vendorDiscount;
  let value = 0;
  for (const [key, count] of Object.entries(item.mods)) {
    const match = /^unsupported:cheap::(\d+):(\d+)$/.exec(key);
    if (match && match[1] === match[2]) value += Number(match[1]) * count;
  }
  return value;
}

export function gamblingDiscount(player: Player): number {
  const excluded = player.weaponSwap ? ['weapon', 'offhand'] : ['weapon2', 'offhand2'];
  const equipment = Object.entries(player.equipment).filter(([slot, item]) => !excluded.includes(slot) && item && (item.maxDurability === 0 || item.durability > 0)).map(([, item]) => item!);
  const charms = player.inventory.filter(item => itemHasType(getBase(item.code)!, 'char'));
  const total = [...equipment, ...charms].filter(item => item.identified && player.level >= item.requiredLevel).reduce((value, item) => value + discount(item), 0);
  return Math.min(99, Math.max(0, Math.trunc(total)));
}

export function gamblingBaseCost(code: string, level: number): number {
  const base = getBase(code)!;
  if (code === 'rin' || code === 'amu') return num(base.raw, 'gamble cost');
  const exceptional = getBase(text(base.raw, 'ubercode')), elite = getBase(text(base.raw, 'ultracode'));
  const a = exceptional ? Math.max(0, 50 * (level - exceptional.qlvl) + 1) : 0;
  const b = elite ? Math.max(0, 25 * (level - elite.qlvl) + 1) : 0;
  const stack = Math.max(1, Math.trunc((num(base.raw, 'minstack') + num(base.raw, 'maxstack')) / 2));
  const weightedCost = a * num(exceptional?.raw ?? {}, 'cost') + b * num(elite?.raw ?? {}, 'cost') + (10000 - a - b) * stack * num(base.raw, 'cost');
  const l = Math.max(5, level), multiplier = Math.trunc((2 * l + 1) / 3) + 20;
  const levelCost = Math.trunc(250 * (l + Math.max(base.qlvl - 45, 0) - Math.trunc(base.qlvl / 2)) / 3);
  return Math.trunc(multiplier * (Math.trunc(weightedCost / 10000) + levelCost) / 15);
}

export function gamblingCost(code: string, player: Player): number {
  const price = gamblingBaseCost(code, player.level);
  return price - Math.trunc(price * gamblingDiscount(player) / 100);
}
