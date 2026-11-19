import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attributeDamagePercent, DIFFICULTY_RULES, lifeBits, playerResistance, resistedDamageBits, rollDamageBits, settleDirectDamage } from '../src/combat';
import { createPlayer, deriveStats } from '../src/rules';
import type { DamageDefense } from '../src/combat';

const defense: DamageDefense = { resistances: { physical: 0, fire: 0, cold: 0, lightning: 0, magic: 0, poison: 0 } };
test('fixed bits preserve subpoint damage and inclusive random endpoints', () => {
  assert.equal(lifeBits(25.25), 6464);
  assert.equal(rollDamageBits(3, 6, () => 0), 768);
  assert.equal(rollDamageBits(3, 6, () => 1 - Number.EPSILON), 1536);
  assert.equal(rollDamageBits(1 / 256, 1 / 256, () => 0.5), 1);
});
test('RES-01: 101 at 75 resist loses exactly 25.25, not 25', () => {
  const result = settleDirectDamage([{ element: 'fire', bits: 25856 }], 100, { resistances: { ...defense.resistances, fire: 75 } });
  assert.equal(result.lifeLoss, 25.25);
  assert.equal(result.remainingLife, 74.75);
  assert.equal(result.physicalLifeLoss, 0);
  assert.deepEqual(result.stages[0], { element: 'fire', bits: 25856, afterFlatBits: 25856, afterResistanceBits: 6464, appliedBits: 6464 });
});
test('immunity and negative resist remain separate from ordinary player caps', () => {
  assert.equal(resistedDamageBits(25600, 100), 0);
  assert.equal(resistedDamageBits(25600, 185), 0);
  assert.equal(resistedDamageBits(25600, -100), 51200);
  assert.equal(resistedDamageBits(25600, -200), 51200);
  assert.equal(resistedDamageBits(3, 50), 1);
});
test('physical flat reduction precedes physical resistance', () => {
  const result = settleDirectDamage([{ element: 'physical', bits: 128000 }], 1000, { resistances: { ...defense.resistances, physical: 50 }, flatPhysical: 20 });
  assert.equal(result.stages[0].afterFlatBits, 122880);
  assert.equal(result.lifeLoss, 240);
  assert.equal(result.physicalLifeLoss, 240);
});
test('MDR applies per qualifying channel, never to poison or physical', () => {
  const result = settleDirectDamage([
    { element: 'physical', bits: 2560 }, { element: 'fire', bits: 2560 },
    { element: 'magic', bits: 2560 }, { element: 'poison', bits: 2560 },
  ], 100, { ...defense, flatMagic: 7 });
  assert.deepEqual(result.stages.map(stage => stage.appliedBits), [2560, 768, 768, 2560]);
  assert.equal(result.lifeLoss, 26);
});
test('LEECH-01: physical overkill cannot supply nonexistent life or elemental leech', () => {
  const result = settleDirectDamage([{ element: 'physical', bits: 25856 }, { element: 'fire', bits: 25600 }], 3, defense);
  assert.equal(result.physicalLifeLoss, 3);
  assert.equal(result.lifeLoss, 3);
  assert.equal(result.remainingLife, 0);
  assert.deepEqual(result.stages.map(stage => stage.appliedBits), [768, 0]);
});
test('immune physical attack can still inflict elements without physical leech', () => {
  const result = settleDirectDamage([{ element: 'physical', bits: 25600 }, { element: 'fire', bits: 2560 }], 100, { resistances: { ...defense.resistances, physical: 100, fire: 50 } });
  assert.equal(result.lifeLoss, 5);
  assert.equal(result.physicalLifeLoss, 0);
});
test('damage calculation never changes packet or monster resistance source', () => {
  const packet = [{ element: 'cold' as const, bits: 25856 }], source = { resistances: { ...defense.resistances, cold: 75 } };
  const before = structuredClone({ packet, source });
  settleDirectDamage(packet, 100, source);
  assert.deepEqual({ packet, source }, before);
});
test('stored overstack and maximum cap are retained independently', () => {
  assert.deepEqual(playerResistance(150), { stored: 150, maximum: 75, effective: 75 });
  assert.deepEqual(playerResistance(150, 10), { stored: 150, maximum: 85, effective: 85 });
  assert.deepEqual(playerResistance(150, 50), { stored: 150, maximum: 95, effective: 95 });
  assert.deepEqual(playerResistance(-200), { stored: -200, maximum: 75, effective: -100 });
});
test('weapon strength/dexterity contributions are individually truncated before ED', () => {
  assert.equal(attributeDamagePercent(20, 25, 75, 75), 33);
  assert.equal(attributeDamagePercent(21, 21, 75, 75), 30);
  assert.equal(attributeDamagePercent(30, 20, 100, 0), 30);
});
test('all three difficulty rules use independent resist, leech and cold scalars', () => {
  assert.deepEqual(DIFFICULTY_RULES.normal, { resistancePenalty: 0, leechDivisor: 1, coldLengthDivisor: 1 });
  assert.deepEqual(DIFFICULTY_RULES.nightmare, { resistancePenalty: -40, leechDivisor: 2, coldLengthDivisor: 2 });
  assert.deepEqual(DIFFICULTY_RULES.hell, { resistancePenalty: -100, leechDivisor: 3, coldLengthDivisor: 4 });
});
test('runtime derived resistances retain quest/difficulty values without touching saved player', () => {
  const player = createPlayer('bar', '抗性');
  player.bonusResist = 250; player.difficulty = 'hell';
  const before = structuredClone(player), stats = deriveStats(player);
  assert.equal(stats.resFire, 75);
  assert.deepEqual(stats.resistances.fire, { stored: 150, maximum: 75, effective: 75 });
  assert.deepEqual(player, before);
});
