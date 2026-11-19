import type { Difficulty, Element, Rng } from './types';

export const COMBAT_HZ = 25;
export const LIFE_SCALE = 256;
export const DIFFICULTY_RULES: Record<Difficulty, { resistancePenalty: number; leechDivisor: number; coldLengthDivisor: number }> = {
  normal: { resistancePenalty: 0, leechDivisor: 1, coldLengthDivisor: 1 },
  nightmare: { resistancePenalty: -40, leechDivisor: 2, coldLengthDivisor: 2 },
  hell: { resistancePenalty: -100, leechDivisor: 3, coldLengthDivisor: 4 },
};
export interface DamageComponent { element: Element; bits: number }
export interface DamageDefense {
  resistances: Record<Element, number>;
  flatPhysical?: number;
  flatMagic?: number;
}
export interface DamageStage extends DamageComponent {
  afterFlatBits: number;
  afterResistanceBits: number;
  appliedBits: number;
}
export interface DamageResolution {
  stages: DamageStage[];
  lifeLoss: number;
  physicalLifeLoss: number;
  remainingLife: number;
}
export interface ResistanceValue { stored: number; maximum: number; effective: number }

export function lifeBits(points: number): number {
  return Math.floor(Math.max(0, points) * LIFE_SCALE);
}
export function rollDamageBits(min: number, max: number, rng: Rng): number {
  const lower = Math.ceil(Math.max(0, min) * LIFE_SCALE);
  const upper = Math.max(lower, lifeBits(max));
  return lower + Math.floor(rng() * (upper - lower + 1));
}
export function resistedDamageBits(bits: number, resistance: number): number {
  return resistance >= 100 ? 0 : Math.floor(Math.max(0, bits) * (100 - Math.max(-100, resistance)) / 100);
}
export function playerResistance(stored: number, maximumBonus = 0): ResistanceValue {
  const maximum = Math.min(95, 75 + maximumBonus);
  return { stored, maximum, effective: Math.min(maximum, Math.max(-100, stored)) };
}
export function settleDirectDamage(packet: DamageComponent[], life: number, defense: DamageDefense): DamageResolution {
  let remainingBits = lifeBits(life), physicalBits = 0;
  const originalBits = remainingBits;
  const stages = packet.map(component => {
    const flat = component.element === 'physical' ? defense.flatPhysical ?? 0
      : component.element === 'poison' ? 0 : defense.flatMagic ?? 0;
    const afterFlatBits = Math.max(0, component.bits - lifeBits(flat));
    const afterResistanceBits = resistedDamageBits(afterFlatBits, defense.resistances[component.element]);
    const appliedBits = Math.min(remainingBits, afterResistanceBits);
    remainingBits -= appliedBits;
    if (component.element === 'physical') physicalBits += appliedBits;
    return { ...component, afterFlatBits, afterResistanceBits, appliedBits };
  });
  return { stages, lifeLoss: (originalBits - remainingBits) / LIFE_SCALE,
    physicalLifeLoss: physicalBits / LIFE_SCALE, remainingLife: remainingBits / LIFE_SCALE };
}
export function attributeDamagePercent(strength: number, dexterity: number, strengthBonus: number, dexterityBonus: number): number {
  return Math.floor(strength * strengthBonus / 100) + Math.floor(dexterity * dexterityBonus / 100);
}
