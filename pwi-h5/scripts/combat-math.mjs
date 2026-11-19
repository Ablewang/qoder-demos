import assert from 'node:assert/strict';
import { COMBAT_MATH_RULES, combatDamage, damageBreakdown, defenseRating, hitChance } from '../src/core/combat-math.js';

let groups = 0;
let comparisons = 0;
const test = (name, fn) => { fn(); groups++; console.log(`PASS ${name}`); };
const originalRandom = Math.random;
const originalNow = Date.now;
Math.random = () => { throw new Error('Pure combat math cannot use RNG'); };
Date.now = () => { throw new Error('Pure combat math cannot use wall time'); };

function previousDamage(amount, attacker, defender, type, elem = null, defense = null, pve = true) {
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const magic = type === 'magic';
  const selected = magic ? (elem ? defender[`${elem}Def`] ?? defender.mdef : defender.mdef) : defender.def;
  const effective = (defense ?? selected) * (1 - clamp(attacker[magic ? 'penetrationM' : 'penetrationP'] || 0, 0, 0.8));
  const gap = clamp((attacker.attackLevel || 0) - (defender.defenseLevel || 0), -300, 300);
  const level = gap >= 0 ? 1 + gap * 0.01 : 1 / (1 - gap * 0.01);
  const resistance = elem ? clamp(defender[`${elem}Res`] || 0, 0, 0.8) : 0;
  const reduction = magic ? 0 : clamp(defender.physicalReduction || 0, 0, 0.8);
  const spirit = (1 + (attacker.spirit || 0) * 0.0005) / (1 + (defender.spirit || 0) * 0.0005);
  const hunt = pve ? 1 + (attacker.huntLevel || 0) * 0.001 : 1;
  return amount * 100 / (100 + Math.max(0, effective) * 0.32) * level * (1 - resistance) * (1 - reduction)
    * spirit * hunt * (1 + (attacker.creation || 0) * 0.05);
}

try {
  test('coefficient policy is immutable and retains the documented first-stage baseline', () => {
    assert.ok(Object.isFrozen(COMBAT_MATH_RULES));
    assert.equal(COMBAT_MATH_RULES.defenseBase, 100);
    assert.equal(COMBAT_MATH_RULES.defenseScale, 0.32);
    assert.throws(() => { COMBAT_MATH_RULES.defenseScale = 1; }, TypeError);
  });
  test('physical, generic magic and five explicit elemental defenses remain distinct', () => {
    const st = { def: 100, mdef: 200, metalDef: 0, woodDef: 310, waterDef: 320, fireDef: 330, earthDef: 340 };
    assert.equal(defenseRating(st, 'phys', 'fire'), 100);
    assert.equal(defenseRating(st, 'magic'), 200);
    for (const element of ['metal', 'wood', 'water', 'fire', 'earth']) {
      assert.equal(defenseRating(st, 'magic', element), st[`${element}Def`]);
    }
    assert.equal(defenseRating({ mdef: 77 }, 'magic', 'fire'), 77);
  });
  test('zero defense and zero raw damage do not create hidden damage or reductions', () => {
    assert.equal(combatDamage(125, {}, { def: 0 }, 'phys'), 125);
    assert.equal(combatDamage(0, {}, { def: 50 }, 'phys'), 0);
    assert.equal(damageBreakdown(125, {}, { def: 300 }, 'phys', null, 0).damage, 125);
  });
  test('armor-break defense override is applied once before penetration', () => {
    const trace = damageBreakdown(1000, { penetrationP: 0.5 }, { def: 1000 }, 'phys', null, 100);
    assert.equal(trace.defenseRating, 100);
    assert.equal(trace.penetration, 0.5);
    assert.equal(trace.effectiveDefense, 50);
    assert.equal(trace.damage, 1000 * 100 / 116);
  });
  test('physical and magic penetration do not cross channels', () => {
    const a = { penetrationP: 0.4, penetrationM: 0.7 };
    const d = { def: 100, mdef: 200 };
    assert.equal(damageBreakdown(100, a, d, 'phys').effectiveDefense, 60);
    assert.equal(damageBreakdown(100, a, d, 'magic').effectiveDefense, 200 * (1 - 0.7));
  });
  test('explicit matching elemental defense and resistance do not include unrelated five-defense values', () => {
    const d = { def: 400, mdef: 900, fireDef: 0, fireRes: 0.25, waterDef: 10000, waterRes: 0.8 };
    const fire = damageBreakdown(1000, {}, d, 'magic', 'fire');
    assert.equal(fire.defenseRating, 0);
    assert.equal(fire.multipliers.elementResistance, 0.75);
    assert.equal(fire.damage, 750);
    assert.equal(damageBreakdown(1000, {}, d, 'phys').multipliers.elementResistance, 1);
  });
  test('physical percentage reduction is independent from armor and never affects magic', () => {
    const d = { def: 100, mdef: 100, physicalReduction: 0.4 };
    const physical = damageBreakdown(1000, {}, d, 'phys');
    const magic = damageBreakdown(1000, {}, d, 'magic');
    assert.equal(physical.multipliers.defense, magic.multipliers.defense);
    assert.equal(physical.multipliers.physicalReduction, 0.6);
    assert.equal(magic.multipliers.physicalReduction, 1);
  });
  test('penetration and reduction policy caps cannot become immunity or negative damage', () => {
    const trace = damageBreakdown(1000, { penetrationM: 3 }, { mdef: 100, fireRes: 2 }, 'magic', 'fire');
    assert.equal(trace.penetration, 0.8);
    assert.equal(trace.multipliers.elementResistance, 1 - 0.8);
    assert.ok(trace.damage > 0);
    assert.equal(damageBreakdown(1000, {}, { def: 0, physicalReduction: 2 }, 'phys').multipliers.physicalReduction, 1 - 0.8);
  });
  test('attack/defense equipment levels are not character levels and retain reciprocal gap rules', () => {
    const positive = damageBreakdown(100, { lv: 1, attackLevel: 30 }, { lv: 105, def: 0, defenseLevel: 10 }, 'phys');
    const negative = damageBreakdown(100, { lv: 105, attackLevel: 10 }, { lv: 1, def: 0, defenseLevel: 30 }, 'phys');
    assert.equal(positive.multipliers.attackDefenseLevel, 1.2);
    assert.equal(negative.multipliers.attackDefenseLevel, 1 / 1.2);
    assert.equal(damageBreakdown(100, { attackLevel: 999 }, { def: 0 }, 'phys').multipliers.attackDefenseLevel, 4);
  });
  test('spirit, hunt and creation have separate trace entries; arena excludes hunt only', () => {
    const a = { spirit: 200, huntLevel: 600, creation: 1 };
    const d = { def: 0, spirit: 200 };
    const pve = damageBreakdown(100, a, d, 'phys');
    const arena = damageBreakdown(100, a, d, 'phys', null, null, false);
    assert.equal(pve.multipliers.spirit, 1);
    assert.equal(pve.multipliers.hunt, 1.6);
    assert.equal(pve.multipliers.creation, 1.05);
    assert.equal(arena.multipliers.hunt, 1);
    assert.equal(arena.damage, 105);
  });
  test('mixed channels sum without reapplying hit, crit, random variance or equipment effects', () => {
    const d = { def: 200, metalDef: 700, metalRes: 0.2 };
    const physical = combatDamage(300 * 0.4, {}, d, 'phys');
    const metal = combatDamage(300 * 0.6, {}, d, 'magic', 'metal');
    assert.equal(physical + metal, previousDamage(120, {}, d, 'phys') + previousDamage(180, {}, d, 'magic', 'metal'));
  });
  test('input identity, HP, statuses and source attributes never mutate; traces are detached', () => {
    const a = Object.freeze({ accuracy: 1.2, spirit: 50, huntLevel: 25 });
    const d = Object.freeze({ hp: 300, def: 250, mdef: 400, dodge: 0.1, statuses: Object.freeze([]) });
    const before = structuredClone({ a, d });
    const trace = damageBreakdown(100, a, d, 'phys');
    trace.multipliers.defense = -1;
    assert.deepEqual({ a, d }, before);
    assert.ok(damageBreakdown(100, a, d, 'phys').multipliers.defense > 0);
    assert.equal(hitChance(a, d), 1 - 0.1 / 1.2);
  });
  test('hit uses adapted evasion ratios, not raw evasionRating, with explicit zero and bounds', () => {
    assert.equal(hitChance({}, { dodge: 0 }), 1);
    assert.equal(hitChance({ accuracy: 2 }, { dodge: 0.2, evasionRating: 10000 }), 0.9);
    assert.equal(hitChance({ accuracy: 1 }, { evasion: 0, dodge: 0.5 }), 1);
    assert.equal(hitChance({ accuracy: 0 }, { dodge: 0.5 }), 0.1);
    assert.equal(hitChance({ accuracy: 1 }, { dodge: 0.1 }, 0.6), 1 - 0.7);
  });
  test('defense decreases and penetration increases damage monotonically', () => {
    let previous = Infinity;
    for (let defense = 0; defense <= 10000; defense += 100) {
      const damage = combatDamage(1000, {}, { def: defense }, 'phys');
      assert.ok(damage <= previous && damage > 0); previous = damage;
    }
    previous = 0;
    for (let i = 0; i <= 80; i++) {
      const damage = combatDamage(1000, { penetrationP: i / 100 }, { def: 2000 }, 'phys');
      assert.ok(damage >= previous && damage <= 1000); previous = damage;
    }
  });
  test('6000 deterministic direct/DOT/pet-style packet cases preserve exact previous raw and rounded results', () => {
    for (let i = 0; i < 500; i++) {
      const attacker = { attackLevel: i % 301, penetrationP: (i % 81) / 100, penetrationM: ((i * 7) % 81) / 100,
        spirit: (i * 13) % 10000, huntLevel: (i * 31) % 10000, creation: i % 101 };
      const defender = { def: i * 11, mdef: i * 17, fireDef: i % 2 ? i * 23 : 0, metalDef: i * 9, woodDef: i * 7,
        waterDef: i * 19, earthDef: i * 21, defenseLevel: (i * 19) % 301, spirit: (i * 23) % 10000,
        fireRes: (i % 81) / 100, waterRes: ((i * 11) % 81) / 100, physicalReduction: ((i * 3) % 81) / 100 };
      for (const pve of [true, false]) {
        for (const elem of [null, 'metal', 'wood', 'water', 'fire', 'earth']) {
          const type = elem ? 'magic' : 'phys';
          const amount = 0.125 + i * 17.71;
          const defense = i % 3 === 0 ? defender[type === 'phys' ? 'def' : `${elem}Def`] * 0.1 : null;
          const expected = previousDamage(amount, attacker, defender, type, elem, defense, pve);
          const actual = combatDamage(amount, attacker, defender, type, elem, defense, pve);
          assert.equal(actual, expected);
          assert.equal(Math.round(actual), Math.round(expected));
          comparisons++;
        }
      }
    }
    assert.equal(comparisons, 6000);
  });
} finally {
  Math.random = originalRandom;
  Date.now = originalNow;
}
console.log(JSON.stringify({ groups, comparisons, rngCalls: 0, storageWrites: 0, scope: 'First-stage arithmetic compatibility, not final balance or natural progression' }));
