import { CLASSES, SKILLS } from '../data/classes.js';
import { CULTIVATION, HOME_CITY } from '../data/world.js';
import { makeEquipmentFor, equipStats, setStats, STAT_NAMES, REFINE_BONUS } from '../data/items.js';
import { NAMED_EQUIPMENT, namedSpec, selectEquipmentTemplate } from '../data/named-equipment.js';
import { HIGH_EQUIPMENT } from '../data/high-equipment.js';

export const STAT_ADAPTATION = Object.freeze({
  hit: 'DEX准确/躲闪度系数来自官方；accuracyRating×0.0001转命中倍率，evasionRating×0.00005转闪避比例，概率公式/基础值/上限为本作适配。整数rating不直接作为概率。',
  defense: '五行Def是防御数值，Res是额外伤害减免比例；每件装备缺少分项Def时以该装备mdef本地回退，裸属性及修真法防换算仍为本作规则。物理伤害减免是独立比例，仅作用于物理通道。磐石护甲仅加成装备物防与装备土防，不加成裸属性、套装额外防御或修真。',
});
export const MAX_LEVEL = 105;
export const BAG_LIMIT = 80;
export const SAVE_KEY = 'pwi-text-adventure-v1';
export const expNeed = (lv) => Math.round(65 + lv * 38 + lv * lv * 5);
export const dayKey = () => new Date().toLocaleDateString('sv-SE');
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function createPlayer(name, cls) {
  const c = CLASSES[cls];
  // Local tutorial loadout, not an original birth-kit: keep a usable weapon;
  // subsequent equipment comes through ordinary quest/loot/production paths.
  const equipment = { weapon: makeEquipmentFor('weapon', 1, 0, cls, { origin: 'starter' }) };
  const p = {
    name, cls, race: c.race, lv: 1, exp: 0, sp: 0, gold: 300,
    attrs: { ...c.base }, points: 0, equipment, bag: [],
    items: { hp1: 10, mp1: 10, town: 3, huanxian: 5 },
    skills: Object.fromEntries(SKILLS[cls].filter((s) => s.tutorialUnlock).map((s) => [s.id, 1])),
    // Starting in a service city is a local onboarding adaptation. Discovery is
    // not a completed journey: record visits only on travel so returning home
    // after the field tutorial is not already satisfied at character creation.
    location: HOME_CITY[c.race], lastCity: HOME_CITY[c.race],
    discovered: [HOME_CITY[c.race]], kills: {}, visits: [], clears: {},
    mainIndex: 0, mainProgress: 0, bounty: null, bountyProgress: 0,
    cult: 0, trialReady: false, path: null, chi: 0, expBoost: 0,
    daily: { day: dayKey(), bounties: 0, dungeons: {}, signed: false },
    hp: 1, mp: 1, totals: { battles: 0, deaths: 0, earned: 0 },
    petName: '灵狐', flight: false,
  };
  const st = stats(p);
  p.hp = st.hp; p.mp = st.mp;
  return p;
}

// 只分配现有自由点：先补默认武器/护甲需求，再将剩余约4:1投入主攻属性和体质。
// 需求仅对比裸属性p.attrs，不借候选装备词条；返回稀疏{k: qty}，不改角色或补发点数。
export function recommendedAttributes(p) {
  if (!p || typeof p.cls !== 'string' || !Object.hasOwn(CLASSES, p.cls)) throw new Error('角色职业无效。');
  if (!Number.isSafeInteger(p.points) || p.points < 0) throw new Error('自由属性点无效。');
  if (!p.attrs || ['str', 'con', 'dex', 'mag'].some((key) => !Number.isSafeInteger(p.attrs[key]) || p.attrs[key] < 0)) throw new Error('角色基础属性无效。');
  const c = CLASSES[p.cls];
  const weapon = namedSpec(selectEquipmentTemplate({ slot: 'weapon', lv: p.lv, cls: p.cls }));
  const armor = namedSpec(selectEquipmentTemplate({ slot: 'body', lv: p.lv, cls: p.cls }));
  const out = {};
  let remaining = p.points;
  for (const key of ['str', 'dex', 'mag', 'con']) {
    const need = Math.max(weapon.wear[key] || 0, armor.wear[key] || 0);
    const qty = Math.min(remaining, Math.max(0, need - p.attrs[key]));
    if (qty) out[key] = qty;
    remaining -= qty;
  }
  const main = c.atkType === 'phys' ? c.atkStat : 'mag';
  const con = Math.floor(remaining / 5);
  if (remaining - con) out[main] = (out[main] || 0) + remaining - con;
  if (con) out.con = (out.con || 0) + con;
  return out;
}

export function stats(p, battle = null) {
  const c = CLASSES[p.cls];
  const a = { ...p.attrs };
  const gear = Object.fromEntries(Object.keys(STAT_NAMES).filter((key) => !(key in a)).map((key) => [key, 0]));
  const collect = (values) => {
    for (const [key, val] of Object.entries(values)) {
      if (key in a) a[key] += val;
      else if (Object.hasOwn(gear, key)) gear[key] += val;
    }
  };
  const elements = ['metal', 'wood', 'water', 'fire', 'earth'];
  const equipmentDefense = { def: 0, ...Object.fromEntries(elements.map((elem) => [`${elem}Def`, 0])) };
  for (const it of Object.values(p.equipment || {})) {
    const values = equipStats(it);
    collect(values);
    equipmentDefense.def += values.def || 0;
    for (const elem of elements) {
      const key = `${elem}Def`;
      // Explicit zero is a real element stat; only absent keys use local mdef.
      equipmentDefense[key] += Object.hasOwn(values, key) ? values[key] : values.mdef || 0;
    }
  }
  const sets = setStats(p.equipment);
  collect(sets);
  const bonus = { hp: 0, mp: 0, atkPct: 0, defPct: 0, mdefPct: 0, crit: 0 };
  for (let i = 1; i <= p.cult; i++) {
    const entry = CULTIVATION[i].bonus;
    const b = CULTIVATION[i].path ? entry[p.path || 'sage'] : entry;
    for (const [k, v] of Object.entries(b)) bonus[k] = (bonus[k] || 0) + v;
  }
  const buffs = {};
  for (const b of battle?.buffs || []) {
    for (const [k, v] of Object.entries(b.values)) buffs[k] = (buffs[k] || 0) + v;
  }
  const hp = Math.round((100 + a.con * c.hpCon + (p.lv - 1) * c.hpLv + gear.hp + bonus.hp) * (1 + (gear.hpPct || 0) + (buffs.hp || 0)));
  const mp = Math.round(60 + a.mag * c.mpMag + (p.lv - 1) * c.mpLv + gear.mp + bonus.mp);
  const patk = Math.round((12 + a[c.atkType === 'phys' ? c.atkStat : 'str'] * 2.5 + p.lv * 2 + gear.patk) * (1 + bonus.atkPct + (buffs.atk || 0)));
  const matk = Math.round((12 + a.mag * 2.5 + p.lv * 2 + gear.matk) * (1 + bonus.atkPct + (buffs.atk || 0)));
  const def = Math.round((a.str * 1.2 + a.con * 1.2 + p.lv * 2 + gear.def) * (1 + bonus.defPct + (buffs.def || 0))
    + equipmentDefense.def * (buffs.equipmentDefPct || 0));
  const mdef = Math.round((a.mag * 1.4 + a.con * 0.8 + p.lv * 2 + gear.mdef) * (1 + bonus.mdefPct + (buffs.mdef || 0)));
  const crit = clamp(0.03 + a.dex * 0.0005 + gear.crit + bonus.crit + (buffs.crit || 0) + (p.cls === 'assassin' || p.cls === 'archer' ? 0.04 : 0), 0, 0.75);
  const accuracyRating = a.dex * c.accuracyDex;
  const evasionRating = a.dex * c.evasionDex + gear.evasionRating;
  // Source ratings → the existing adapted probability model (local scales).
  const dodge = clamp(0.02 + evasionRating * 0.00005 + gear.dodge + (buffs.dodge || 0), 0, 0.5);
  const atk = c.atkType === 'phys' ? patk : matk;
  const weapon = p.equipment?.weapon;
  const named = weapon?.ruleVersion === 2 && Object.hasOwn(NAMED_EQUIPMENT, weapon.templateId);
  const template = !named && weapon?.templateId ? HIGH_EQUIPMENT[weapon.templateId] : null;
  const ranges = {};
  for (const [key, attack] of [['patk', patk], ['matk', matk]]) {
    const ordinary = !template && weapon?.ruleVersion === 1;
    const range = template?.attackRanges[key] || (ordinary || named ? weapon.ranges?.[key] : null);
    // 新普通基础区间已含等级/星级预算；精炼只加攻击均值，不能再次放大区间宽度。
    const refineScale = ordinary ? 1 : 1 + REFINE_BONUS[weapon?.refine];
    const durabilityScale = ordinary ? ((weapon.durability ?? 100) <= 0 ? 0.5 : 1) : (weapon?.durability === 0 ? 0.5 : 1);
    const scale = range ? refineScale * durabilityScale * (1 + bonus.atkPct + (buffs.atk || 0)) : 0;
    const mean = range ? (range[0] + range[1]) / 2 : 0;
    ranges[`${key}Min`] = range ? Math.max(1, Math.round(attack + (range[0] - mean) * scale)) : attack;
    ranges[`${key}Max`] = range ? Math.max(1, Math.round(attack + (range[1] - mean) * scale)) : attack;
  }
  ranges.atkMin = c.atkType === 'phys' ? ranges.patkMin : ranges.matkMin;
  ranges.atkMax = c.atkType === 'phys' ? ranges.patkMax : ranges.matkMax;
  const extra = {
    hpPct: Math.max(0, gear.hpPct || 0),
    huntLevel: clamp((gear.huntLevel || 0) + (buffs.huntLevel || 0), 0, 10000),
    spirit: clamp((gear.spirit || 0) + (buffs.spirit || 0), 0, 10000),
    creation: clamp((gear.creation || 0) + (buffs.creation || 0), 0, 100),
    accuracyRating, evasionRating,
    equipmentDef: equipmentDefense.def, equipmentEarthDef: equipmentDefense.earthDef,
    accuracy: clamp(1 + accuracyRating * 0.0001 + gear.accuracy + (buffs.accuracy || 0), 0.1, 10),
    critDamage: clamp(2 + gear.critDamage + (buffs.critDamage || 0), 1, 5),
    attackLevel: clamp(gear.attackLevel + (buffs.attackLevel || 0), 0, 300),
    defenseLevel: clamp(gear.defenseLevel + (buffs.defenseLevel || 0), 0, 300),
    physicalReduction: clamp(gear.physicalReduction + (buffs.physicalReduction || 0), 0, 0.8),
    penetrationP: clamp(gear.penetrationP + (buffs.penetrationP || 0), 0, 0.8),
    penetrationM: clamp(gear.penetrationM + (buffs.penetrationM || 0), 0, 0.8),
    channel: clamp(gear.channel + (buffs.channel || 0), 0, 0.75),
    hpRegen: Math.max(0, Math.round(1 + gear.hpRegen + (buffs.hpRegen || 0))),
    mpRegen: Math.max(0, Math.round(1 + gear.mpRegen + (buffs.mpRegen || 0))),
  };
  for (const elem of elements) {
    const key = `${elem}Res`;
    extra[key] = clamp(gear[key] + (buffs[key] || 0), 0, 0.8);
    const defenseKey = `${elem}Def`;
    const setDefense = Object.hasOwn(sets, defenseKey) ? sets[defenseKey] : sets.mdef || 0;
    extra[defenseKey] = Math.round((a.mag * 1.4 + a.con * 0.8 + p.lv * 2 + equipmentDefense[defenseKey] + setDefense)
      * (1 + bonus.mdefPct + (buffs.mdef || 0)) + (buffs[defenseKey] || 0)
      + (elem === 'earth' ? equipmentDefense[defenseKey] * (buffs.equipmentEarthDefPct || 0) : 0));
  }
  const speed = clamp(1 + gear.speed + (buffs.speed || 0), 1, 3);
  const offense = atk * (1 + crit * (extra.critDamage - 1)) * (1 + extra.attackLevel * 0.01)
    * (1 + extra.huntLevel * 0.001) * (1 + extra.spirit * 0.0005) * (1 + extra.creation * 0.05);
  const power = Math.round(offense * 4 + hp * 0.35 + (def + mdef) * (1 + extra.defenseLevel * 0.01));
  return { ...a, hp, mp, patk, matk, atk, def, mdef, crit, dodge, evasion: dodge, speed, ...ranges, ...extra, power };
}

export function gainExp(p, amount) {
  if (p.lv >= MAX_LEVEL) return 0;
  p.exp += Math.max(0, Math.round(amount));
  let levels = 0;
  while (p.lv < MAX_LEVEL && p.exp >= expNeed(p.lv)) {
    p.exp -= expNeed(p.lv); p.lv++; p.points += 5; levels++;
  }
  if (p.lv >= MAX_LEVEL) p.exp = 0;
  if (levels) { const s = stats(p); p.hp = s.hp; p.mp = s.mp; }
  return levels;
}

export function makeMonster(name, lv, rank = '', type = 'phys', index = 0) {
  const mul = rank === 'boss' ? 2.7 : rank === 'elite' ? 1.7 : 1;
  // 新手区敌人更耐打，让每场战斗有3—5回合可以观察意图、做出选择。
  const early = Math.max(0, (12 - lv) / 11);
  const hp = Math.round((65 + lv * 20 + lv * lv * 0.8) * mul * (1 + 1.0 * early));
  return {
    id: `m${index}`, name, lv, rank, type, hp, maxHp: hp,
    atk: Math.round((14 + lv * 5) * (rank === 'boss' ? 1.45 : rank === 'elite' ? 1.2 : 1) * (1 + 0.35 * early)),
    def: Math.round(8 + lv * 2.5), mdef: Math.round(8 + lv * 2.5),
    elem: ['metal', 'wood', 'water', 'fire', 'earth'][lv % 5], statuses: [],
    accuracy: 1, dodge: 0, crit: 0, critDamage: 2, attackLevel: 0, defenseLevel: 0,
    penetrationP: 0, penetrationM: 0, metalRes: 0, woodRes: 0, waterRes: 0, fireRes: 0, earthRes: 0,
  };
}

export function monsterReward(m) {
  const mul = m.rank === 'boss' ? 6 : m.rank === 'elite' ? 3 : 1;
  return { exp: Math.round((25 + m.lv * 14 + m.lv * m.lv * 0.85) * mul), sp: Math.round((16 + m.lv * 6) * mul), gold: Math.round((12 + m.lv * 9) * mul) };
}
