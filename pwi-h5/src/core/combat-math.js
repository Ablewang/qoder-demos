export const COMBAT_MATH_RULES = Object.freeze({
  defenseBase: 100,
  defenseScale: 0.32,
  penetrationCap: 0.8,
  resistanceCap: 0.8,
  physicalReductionCap: 0.8,
  attackDefenseGapCap: 300,
  attackDefenseStep: 0.01,
  spiritStep: 0.0005,
  huntStep: 0.001,
  creationStep: 0.05,
  accuracyFloor: 0.1,
  evasionCap: 0.9,
  hitFloor: 0.1,
});

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function defenseRating(st, type, elem = null) {
  return type === 'magic' ? (elem ? st[`${elem}Def`] ?? st.mdef : st.mdef) : st.def;
}

export function hitChance(attacker, defender, extra = 0) {
  const evasion = defender.evasion ?? defender.dodge ?? 0;
  return clamp(1 - clamp(evasion + extra, 0, COMBAT_MATH_RULES.evasionCap)
    / Math.max(COMBAT_MATH_RULES.accuracyFloor, attacker.accuracy ?? 1), COMBAT_MATH_RULES.hitFloor, 1);
}

export function damageBreakdown(amount, attacker, defender, type, elem = null, defense = null, pve = true) {
  const r = COMBAT_MATH_RULES;
  const magic = type === 'magic';
  const penetration = clamp(attacker[magic ? 'penetrationM' : 'penetrationP'] || 0, 0, r.penetrationCap);
  const rating = defense ?? defenseRating(defender, type, elem);
  const effectiveDefense = Math.max(0, rating * (1 - penetration));
  const gap = clamp((attacker.attackLevel || 0) - (defender.defenseLevel || 0), -r.attackDefenseGapCap, r.attackDefenseGapCap);
  const multipliers = {
    defense: r.defenseBase / (r.defenseBase + effectiveDefense * r.defenseScale),
    attackDefenseLevel: gap >= 0 ? 1 + gap * r.attackDefenseStep : 1 / (1 - gap * r.attackDefenseStep),
    elementResistance: 1 - (elem ? clamp(defender[`${elem}Res`] || 0, 0, r.resistanceCap) : 0),
    physicalReduction: 1 - (magic ? 0 : clamp(defender.physicalReduction || 0, 0, r.physicalReductionCap)),
    spirit: (1 + (attacker.spirit || 0) * r.spiritStep) / (1 + (defender.spirit || 0) * r.spiritStep),
    hunt: pve ? 1 + (attacker.huntLevel || 0) * r.huntStep : 1,
    creation: 1 + (attacker.creation || 0) * r.creationStep,
  };
  // Preserve operation order so extracting the kernel does not change rounded combat outcomes.
  const damage = amount * r.defenseBase / (r.defenseBase + effectiveDefense * r.defenseScale)
    * multipliers.attackDefenseLevel * multipliers.elementResistance * multipliers.physicalReduction
    * multipliers.spirit * multipliers.hunt * multipliers.creation;
  return { amount, type, element: elem, defenseRating: rating, penetration, effectiveDefense, multipliers, damage };
}

export function combatDamage(amount, attacker, defender, type, elem = null, defense = null, pve = true) {
  return damageBreakdown(amount, attacker, defender, type, elem, defense, pve).damage;
}
