import assert from 'node:assert/strict';
import { CLASSES } from '../src/data/classes.js';
import { NAMED_EQUIPMENT, namedSpec, selectEquipmentTemplate, matchesNamedEquip } from '../src/data/named-equipment.js';
import { stats, recommendedAttributes, makeMonster } from '../src/core/model.js';
import { combatDamage } from '../src/core/combat-math.js';

const levels = [1, 10, 20, 40, 60, 80, 95, 105];
const slots = ['weapon', 'head', 'body', 'legs', 'feet', 'wrist', 'cape', 'neck', 'waist', 'ring1', 'ring2'];
const armorSlots = ['head', 'body', 'legs', 'feet', 'wrist'];
const rows = [];
const originalRandom = Math.random;
Math.random = () => { throw new Error('Equipment budget previews cannot use RNG'); };

try {
  for (const level of levels) {
    for (const [cls, definition] of Object.entries(CLASSES)) {
      const p = { cls, lv: level, attrs: { ...definition.base }, points: 5 * (level - 1), cult: 0, equipment: {}, skills: {} };
      const allocation = recommendedAttributes(p);
      assert.equal(Object.values(allocation).reduce((sum, n) => sum + n, 0), p.points);
      for (const [key, value] of Object.entries(allocation)) p.attrs[key] += value;
      p.points = 0;
      for (const slot of slots) {
        const normalized = slot === 'ring2' ? 'ring1' : slot;
        const preferred = NAMED_EQUIPMENT[selectEquipmentTemplate({ slot, lv: level, cls })];
        const candidates = Object.values(NAMED_EQUIPMENT).filter((template) => !template.referenceOnly
          && template.slot === normalized && template.lv <= level && ['ordinary', 'local-tutorial'].includes(template.series)
          && template.classes.includes(cls) && (slot !== 'weapon' || template.weaponType === definition.weapon)
          && (!armorSlots.includes(slot) || template.armorType === definition.armor)
          && (normalized !== 'ring1' || template.type === `${definition.atkType}Ring`)
          && Object.entries(template.requirements).every(([key, need]) => need === null || p.attrs[key] >= need));
        candidates.sort((a, b) => b.lv - a.lv || Number(a.status === 'local-tutorial') - Number(b.status === 'local-tutorial')
          || a.templateId.localeCompare(b.templateId));
        const chosen = candidates[0];
        assert.ok(chosen, `No legal ${cls}/${level}/${slot} budget template; do not inject attributes`);
        const item = namedSpec(chosen.templateId);
        Object.assign(item, { refine: 0, sockets: [], durability: 100, bound: false, rerolls: 0, upgrades: 0,
          affixRolls: item.affixes.filter((effect) => effect.supported).map((effect) => effect.range[0]) });
        assert.ok(matchesNamedEquip(item), 'Budget rolls and fixed source metadata must remain canonical');
        assert.equal(item.uid, undefined, 'Pure budget previews are not acquired inventory instances');
        p.equipment[slot] = item;
        if (preferred.templateId !== chosen.templateId) assert.ok(Object.entries(preferred.requirements)
          .some(([key, need]) => need !== null && p.attrs[key] < need), 'Only unmet requirements justify lower-tier selection');
      }
      const st = stats(p);
      const bare = stats({ ...p, equipment: {} });
      const boss = makeMonster('当前首领预算靶（本作）', level, 'boss');
      const outgoing = combatDamage(st.atk, st, boss, definition.atkType);
      const incoming = Math.round(combatDamage(boss.atk, boss, st, 'phys'));
      assert.ok(st.atk >= bare.atk && Number.isFinite(outgoing) && outgoing > 0 && incoming > 0);
      assert.equal(Object.keys(p.equipment).length, 11);
      rows.push({ level, cls, hp: st.hp, atk: st.atk, bareAtk: bare.atk, def: st.def, mdef: st.mdef,
        bossBasicPhysicalHit: incoming, basicAttackRoundEstimate: Math.ceil(boss.maxHp / outgoing),
        weapon: p.equipment.weapon.name, templateIds: Object.fromEntries(Object.entries(p.equipment).map(([slot, item]) => [slot, item.templateId])) });
    }
  }
} finally {
  Math.random = originalRandom;
}

assert.equal(rows.length, 80);
for (const level of levels) {
  const group = rows.filter((row) => row.level === level);
  console.log(JSON.stringify({ level, hpRange: [Math.min(...group.map((row) => row.hp)), Math.max(...group.map((row) => row.hp))],
    attackRange: [Math.min(...group.map((row) => row.atk)), Math.max(...group.map((row) => row.atk))],
    basicAttackRoundEstimate: [Math.min(...group.map((row) => row.basicAttackRoundEstimate)), Math.max(...group.map((row) => row.basicAttackRoundEstimate))] }));
}
console.log(JSON.stringify({ level105: rows.filter((row) => row.level === 105) }));
console.log(JSON.stringify({ groups: rows.length, slotsPerGroup: 11, rngCalls: 0, uidGeneration: 0, storageWrites: 0,
  scope: 'Legal lowest-affix unrefined ordinary/explicit local equipment previews; no cultivation, skills, potions, charms, crit or intent. Not acquired gear, natural play, win rates or final difficulty.' }));
