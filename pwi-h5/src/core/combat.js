import { CLASSES, SKILLS, skillResources } from '../data/classes.js';
import { ITEMS, equippedWeaponType } from '../data/items.js';
import { GEAR_RULES } from '../data/gear-specs.js';
import { stats, makeMonster, clamp } from './model.js';
import { combatDamage, defenseRating, hitChance } from './combat-math.js';

const alive = (b) => b.monsters.filter((m) => m.hp > 0);
const skillOf = (p, id) => (SKILLS[p.cls] || []).find((s) => s.id === id);
const skillLevel = (p, s) => clamp(Math.floor(p.skills?.[s.id] || 0), 0, s.maxLv);
const multiplier = (p, s) => (s.mult || 0) + s.per * (skillLevel(p, s) - 1);
const buffValue = (b, key) => b.buffs.reduce((n, x) => n + (x.values[key] || 0), 0);
const damageType = (p, s) => s?.elem ? 'magic' : CLASSES[p.cls].atkType;
const attackKey = (s) => s?.attackBasis === 'phys' ? 'patk' : s?.attackBasis === 'magic' ? 'matk' : 'atk';
const attackMean = (st, s) => st[attackKey(s)];
const dotElement = (s) => Object.hasOwn(s, 'dotElem') ? s.dotElem : s.elem || null;
const dotType = (p, s) => s.dotType || damageType(p, s);
const skillBuffValues = (p, s) => Object.fromEntries(Object.entries(s.buff || {}).map(([key, value]) => [key, value * (s.buffPerRank ? skillLevel(p, s) : 1)]));
function attackDamage(p, b, st, s, m, amount) {
  const components = s?.components || [{ type: damageType(p, s), elem: s?.elem || null, share: 1 }];
  return components.reduce((total, c) => total + combatDamage(amount * c.share, st, m, c.type, c.elem,
    enemyDefense(m, c.type, c.elem), b.context.type !== 'arena'), 0);
}
const hasBuff = (b, id) => b.buffs.some((x) => x.id === id);
const highWeapon = (p) => p.equipment?.weapon?.durability > 0 ? p.equipment.weapon.templateId : null;
const doubleStrike = (p) => ['axe19c', 'sword18b'].includes(highWeapon(p));
export const INTENTS = ['attack', 'heavy', 'exposed'];
const intentOf = (m) => INTENTS.includes(m.intent) ? m.intent : 'attack';
const exposedBonus = (m) => intentOf(m) === 'exposed' ? 1.5 : 1;
const stunned = (m) => m.statuses.some((x) => x.kind === 'stun');
export function rollIntent(m) {
  const last = intentOf(m);
  const r = Math.random();
  // 重击后有一半概率力竭露出破绽，形成“格挡→反击”的节奏。
  if (last === 'heavy') return r < 0.5 ? 'exposed' : 'attack';
  const heavy = m.rank === 'boss' ? 0.35 : m.rank === 'elite' ? 0.3 : 0.25;
  return r < heavy ? 'heavy' : r < heavy + 0.2 ? 'exposed' : 'attack';
}
function announceIntent(b, m) {
  if (m.intent === 'heavy') log(b, `${m.name}${m.type === 'magic' ? '开始吟唱' : '开始蓄力'}——下回合将发动重击！可「防御调息」完美格挡，或用眩晕打断。`, 'danger');
  else if (m.intent === 'exposed') log(b, `${m.name}露出破绽——下回合受到的伤害+50%，正是全力出手的时机！`, 'victory');
}
export function skillCooldown(p, b, id) {
  const s = skillOf(p, id);
  if (!s?.cd) return 0;
  return Math.max(1, Math.round(s.cd * (1 - stats(p, b).channel)));
}

const charmRecovery = (p, st, type, realtime = false) => {
  const stored = p.charms?.[type];
  if (!Number.isSafeInteger(stored) || stored <= 0 || p.hp <= 0) return 0;
  const threshold = st[type] * (type === 'hp' ? 0.5 : 0.75);
  if (realtime ? p[type] >= threshold || p.charmCooldowns[type] > 0 : p[type] > threshold) return 0;
  return Math.max(0, Math.min(st[type] - p[type], stored));
};

function activateCharms(p, b) {
  const st = stats(p, b);
  for (const type of ['hp', 'mp']) {
    const amount = charmRecovery(p, st, type, !!b.rt);
    if (!amount) continue;
    p.charms[type] -= amount;
    p[type] += amount;
    if (b.rt) p.charmCooldowns[type] = type === 'hp' ? REALTIME_RULES.hpCharmTicks : REALTIME_RULES.mpCharmTicks;
    rtEvent(b, 'heal', 'player', 'player', amount, `${type}护符`, null);
    log(b, `${type === 'hp' ? '生命' : '真气'}护符恢复${amount}点${type === 'hp' ? '生命' : '真气'}，消耗${amount}点储量，剩余${p.charms[type]}点。`, 'heal');
  }
}

function recoverRound(p, b) {
  if (p.hp <= 0) return;
  activateCharms(p, b);
  const st = stats(p, b);
  if (st.hpRegen) heal(p, b, st.hpRegen, '自然恢复');
  const before = p.mp;
  p.mp = clamp(p.mp + st.mpRegen, 0, st.mp);
  if (p.mp > before) {
    log(b, `自然恢复了${p.mp - before}点真气。`, 'heal');
    rtEvent(b, 'heal', 'player', 'player', p.mp - before, '真气自然恢复');
  }
}

export function expectedAttack(p, b, st, s, m) {
  const crit = b.stealth ? st.critDamage : 1 + st.crit * (st.critDamage - 1);
  const boost = b.stealth ? 1.5 * (1 + (s?.stealthBonus || 0)) : 1;
  const hits = s ? s.hits || 1 : st.speed;
  return attackDamage(p, b, st, s, m, attackMean(st, s) * (s ? multiplier(p, s) : 1) * hits * crit * boost
    * (doubleStrike(p) ? 1.2 : 1) * exposedBonus(m)) * hitChance(st, m);
}

function resourceCost(p, b, s) {
  if (!s) return 0;
  const st = stats(p, b);
  const cost = skillResources(s, skillLevel(p, s));
  const manaPressure = p.mp - cost.mp < Math.max(0, cost.mp - st.mpRegen) ? 0.35 : 0.18;
  return cost.mp * manaPressure + cost.chi * 0.05 + skillCooldown(p, b, s.id) * st.atk * 0.01;
}

function log(b, text, kind = 'system') {
  b.logs.push({ text, kind });
  if (b.logs.length > 80) b.logs.splice(0, b.logs.length - 80);
}

export function createBattle(p, monsters, context = {}) {
  const ids = new Set();
  const enemies = monsters.map((input, index) => {
    const data = typeof input === 'string' ? { name: input } : structuredClone(input);
    const m = { ...makeMonster(data.name, data.lv ?? p.lv, data.rank, data.type, index), ...data };
    // 保留外部目标ID，同时消除重复ID，战斗不修改传入的怪物或上下文。
    if (m.id == null || ids.has(m.id)) {
      m.id = `m${index}`;
      while (ids.has(m.id)) m.id += '_';
    }
    ids.add(m.id);
    m.maxHp = Math.max(1, m.maxHp);
    m.hp = clamp(m.hp, 0, m.maxHp);
    m.statuses = data.statuses || [];
    m.intent = context.ambush ? 'exposed' : 'attack';
    return m;
  });
  return {
    monsters: enemies, context: structuredClone(context), round: 0, buffs: [],
    cooldowns: {}, pet: null, logs: [], result: null, shield: 0,
    stealth: false, revived: false,
  };
}

export function canUseSkill(p, b, id) {
  if (b.result) return '战斗已经结束';
  if (p.hp <= 0) return '已经阵亡，无法施放技能';
  const s = skillOf(p, id);
  if (!s) return '本职业没有这个技能';
  if (!skillLevel(p, s)) return '尚未学习这个技能';
  if (p.lv < s.lv) return `需要达到${s.lv}级`;
  if ((p.cult || 0) < (s.cult || 0)) return '修为不足，无法施放此技能';
  if (s.kind === 'passive') return '被动技能会自动生效';
  const restriction = s.source?.weapons;
  const type = equippedWeaponType(p);
  if (!restriction?.tokens.length) return '技能武器来源限制未知，不能施放';
  if (!type) return '当前武器类型未知，不能确认源技能武器限制';
  if (!restriction.supportedTypes.includes(type)) {
    const names = restriction.supportedTypes.map((key) => key === 'unarmed' ? '空手' : GEAR_RULES.weapons[key].name);
    const unresolved = [...restriction.unsupportedTokens, ...restriction.unknownTokens];
    return `当前武器不支持此技能，源限制：${restriction.raw}；已支持${names.join('或') || '无'}${unresolved.length ? `；未支持或未知：${unresolved.join('、')}` : ''}`;
  }
  if ((b.cooldowns[id] || 0) > 0) return `技能冷却中，还需${b.cooldowns[id]}回合`;
  if (s.kind === 'summon' && b.pet?.hp > 0) return '宠物仍然存活，不能重复召唤';
  if (s.kind === 'petheal' && !(b.pet?.hp > 0)) return '没有存活的宠物';
  if (s.kind === 'petheal' && b.pet.hp >= b.pet.maxHp) return '宠物生命已满';
  if (s.kind === 'stealth' && b.stealth) return '已经处于潜行状态';
  const cost = skillResources(s, skillLevel(p, s));
  if (p.mp < cost.mp) return '真气不足';
  if ((p.chi || 0) < cost.chi) return '元气不足';
  return null;
}

function itemReason(p, b, id) {
  const item = ITEMS[id];
  if (!item || !['hp', 'mp'].includes(item.type)) return '此物品不能在战斗中使用';
  if (!Number.isFinite(p.items?.[id]) || p.items[id] < 1) return '没有足够的药品';
  if (p.lv < item.lv) return `需要达到${item.lv}级才能使用此药品`;
  const st = stats(p, b);
  if (p[item.type] >= st[item.type]) return item.type === 'hp' ? '生命已满，无需用药' : '真气已满，无需用药';
  return null;
}

function heal(p, b, amount, name) {
  const before = p.hp;
  p.hp = clamp(p.hp + Math.max(0, Math.round(amount)), 0, stats(p, b).hp);
  if (p.hp > before) {
    log(b, `${name}恢复了${p.hp - before}点生命。`, 'heal');
    rtEvent(b, 'heal', 'player', 'player', p.hp - before, name);
  }
  return p.hp - before;
}

function syncShield(b) {
  b.shield = b.buffs.reduce((n, x) => n + (x.shield || 0), 0);
}

function addBuff(b, buff) {
  if (b.rt) buff.nextEffectAt = b.rt.tick + REALTIME_RULES.effectTicks;
  b.buffs = b.buffs.filter((x) => x.id !== buff.id);
  b.buffs.push(buff);
  syncShield(b);
}

function statusValue(m, kind) {
  return m.statuses.reduce((n, x) => n + (x.kind === kind ? x.value || 0 : 0), 0);
}

function enemyDefense(m, type, elem = null) {
  return defenseRating(m, type, elem) * (1 - clamp(statusValue(m, 'armorBreak'), 0, 0.9));
}

function enemyAttack(m) {
  const reduction = statusValue(m, 'weaken') + statusValue(m, 'slow');
  return m.atk * (1 - clamp(reduction, 0, 0.9));
}

function hurtMonster(b, m, amount, name, suffix = '', actor = 'player', element = null) {
  const damage = Math.min(m.hp, Math.max(1, Math.round(amount * exposedBonus(m))));
  if (exposedBonus(m) > 1) suffix += '（破绽）';
  m.hp -= damage;
  log(b, `${name}对${m.name}造成${damage}点伤害${suffix}。`, 'damage');
  rtEvent(b, 'damage', actor, m.id, damage, name, element);
  if (m.hp <= 0) {
    log(b, `${m.name}被击败了。`, 'victory');
    rtEvent(b, 'death', actor, m.id, 0, m.name);
  }
  return damage;
}

function addStatus(m, status, b) {
  if (b?.rt) status.nextEffectAt = b.rt.tick + REALTIME_RULES.effectTicks;
  // 同一技能的同种效果刷新，不无限叠毒；不同技能可同时生效。
  if (status.kind === 'stun') {
    const old = m.statuses.find((x) => x.kind === 'stun');
    if (old) {
      old.turns = Math.max(old.turns, status.turns);
      if (b?.rt) old.nextEffectAt = status.nextEffectAt;
      return;
    }
  }
  m.statuses = m.statuses.filter((x) => x.kind !== status.kind || x.source !== status.source);
  m.statuses.push(status);
}

function applyEffects(p, b, m, s, st) {
  for (const [kind, effect] of Object.entries(s.fx || {})) {
    if (kind === 'lifesteal') continue;
    const [value, turns] = effect;
    if ((kind === 'stun' || kind === 'slow') && Math.random() >= value) continue;
    const status = { kind, source: s.id, name: s.name, value, turns };
    if (kind === 'slow') status.value = 0.2;
    if (kind === 'dot') {
      status.attack = attackMean(st, s) * value;
      status.type = dotType(p, s);
      status.elem = dotElement(s);
      status.attacker = { attackLevel: st.attackLevel, penetrationP: st.penetrationP, penetrationM: st.penetrationM,
        huntLevel: b.context.type === 'arena' ? 0 : st.huntLevel, spirit: st.spirit, creation: st.creation };
    }
    addStatus(m, status, b);
    const labels = { dot: '持续伤害', stun: '眩晕', slow: '减速', weaken: '虚弱', armorBreak: '破甲' };
    log(b, `${m.name}受到${labels[kind]}，持续${turns}回合。`, 'system');
  }
}

function finish(b, result) {
  b.result = result;
  const messages = { win: ['战斗胜利！', 'victory'], lose: ['你在战斗中倒下了。', 'danger'], escape: ['你成功脱离了战斗。', 'system'] };
  log(b, ...messages[result]);
  return result;
}

function checkDeath(p, b) {
  if (p.hp > 0) return null;
  const passive = (SKILLS[p.cls] || []).find((s) => s.kind === 'passive' && s.revive && skillLevel(p, s) && p.lv >= s.lv && (p.cult || 0) >= (s.cult || 0));
  if (!b.revived && passive) {
    b.revived = true;
    p.hp = Math.max(1, Math.round(stats(p, b).hp * passive.revive));
    log(b, `${passive.name}生效，以${p.hp}点生命复活！`, 'heal');
    rtEvent(b, 'heal', 'player', 'player', p.hp, passive.name);
    return null;
  }
  p.hp = 0;
  return finish(b, 'lose');
}

function startRound(p, b) {
  // 数值buff包含施放当轮的敌人阶段：下一轮开始才减时长。
  // HOT、DOT、regen从下一轮开始跳，先跳再减，确保最后一跳不丢失。
  for (const buff of b.buffs) {
    if (buff.hot) heal(p, b, stats(p, b).hp * buff.hot, buff.name);
    if (buff.values.regen) heal(p, b, stats(p, b).hp * buff.values.regen, buff.name);
    if (buff.turns != null) buff.turns = Math.max(0, buff.turns - 1);
  }
  b.buffs = b.buffs.filter((x) => x.turns == null || x.turns > 0);
  syncShield(b);
  for (const m of alive(b)) {
    for (const status of m.statuses) {
      // 眩晕只在敌人真正获得行动机会时消耗，不能在回合开始提前消失。
      if (status.kind === 'stun') continue;
      if (status.kind === 'dot' && m.hp > 0) {
        hurtMonster(b, m, combatDamage(status.attack, status.attacker || {}, m, status.type, status.elem, enemyDefense(m, status.type, status.elem)), `${status.name}的持续伤害`);
      }
      status.turns = Math.max(0, status.turns - 1);
    }
    m.statuses = m.statuses.filter((x) => x.turns > 0);
  }
}

function playerAttack(p, b, target, s) {
  const st = stats(p, b);
  const hidden = b.stealth;
  b.stealth = false; // 只有玩家的普通攻击/伤害技能消耗潜行，宠物和DOT不消耗。
  const targets = s?.aoe ? alive(b) : [target];
  const whole = Math.floor(st.speed);
  const hits = s ? s.hits || 1 : b.rt ? 1 : whole + (st.speed > whole && Math.random() < st.speed - whole ? 1 : 0);
  if (!s) rtEvent(b, 'attack', 'player', target.id, 0, '普通攻击');
  const mult = s ? multiplier(p, s) : 1;
  const stealthMult = hidden ? 1.5 * (1 + (s?.stealthBonus || 0)) : 1;
  const lifesteal = clamp(buffValue(b, 'lifesteal') + (s?.fx?.lifesteal || 0), 0, 1);
  for (const m of targets) {
    let total = 0;
    let critical = false;
    let landed = 0;
    for (let i = 0; i < hits && m.hp > 0; i++) {
      const chance = hitChance(st, m);
      if (chance < 1 && Math.random() < 1 - chance) {
        log(b, `${m.name}闪避了${s?.name || '普通攻击'}。`);
        rtEvent(b, 'miss', 'player', m.id, 0, s?.name || '普通攻击', s?.elem || null);
        continue;
      }
      landed++;
      const crit = hidden || Math.random() < st.crit;
      critical ||= crit;
      const key = attackKey(s), min = st[`${key}Min`], max = st[`${key}Max`];
      const attack = min !== max ? min + Math.random() * (max - min) : attackMean(st, s);
      const empowered = doubleStrike(p) && Math.random() < 0.2;
      if (empowered) log(b, `${highWeapon(p) === 'axe19c' ? '狂天神' : '炽灭魂'}触发：本次命中双倍伤害（本作20%回合适配）。`, 'system');
      const damage = attackDamage(p, b, st, s, m, attack * mult * stealthMult * (crit ? st.critDamage : 1)
        * (empowered ? 2 : 1) * exposedBonus(m) * (0.9 + Math.random() * 0.2));
      const actual = Math.min(m.hp, Math.max(1, Math.round(damage)));
      m.hp -= actual;
      total += actual;
    }
    if (landed && ['axe19a', 'axe19b'].includes(highWeapon(p)) && Math.random() < 0.2) {
      if (highWeapon(p) === 'axe19a' && m.hp > 0) {
        addStatus(m, { kind: 'armorBreak', source: 'equip:axe19a', name: '蚀心斩', value: 0.9, turns: 2 }, b);
        log(b, '蚀心斩触发：目标双防降低90%，持续至下一合法回合结束（本作适配）。');
      } else if (highWeapon(p) === 'axe19b') {
        addBuff(b, { id: 'gear:axe19b:crit', name: '重霄劫', values: { crit: 0.3, critDamage: 0.3 }, turns: 2 });
        log(b, '重霄劫触发：暴击率+30个百分点、暴伤倍率+0.3，持续2回合（含本轮，本作适配）。');
      }
    }
    if (landed) log(b, `${s?.name || '普通攻击'}对${m.name}造成${total}点伤害${hits > 1 ? `（${landed}/${hits}连击命中）` : ''}${exposedBonus(m) > 1 ? '（击中破绽）' : ''}${critical ? '，暴击！' : '。'}`, 'damage');
    if (landed) rtEvent(b, 'damage', 'player', m.id, total, s?.name || '普通攻击', s?.elem || null);
    if (lifesteal) heal(p, b, total * lifesteal, '吸血');
    if (m.hp <= 0) {
      log(b, `${m.name}被击败了。`, 'victory');
      rtEvent(b, 'death', 'player', m.id, 0, m.name);
    } else if (s && landed) applyEffects(p, b, m, s, st);
  }
}

function castSkill(p, b, s, target) {
  const st = stats(p, b);
  const cost = skillResources(s, skillLevel(p, s));
  p.mp = clamp(p.mp - cost.mp, 0, st.mp);
  p.chi = clamp((p.chi || 0) - cost.chi + cost.gain, 0, 300);
  if (s.cd) b.cooldowns[s.id] = skillCooldown(p, b, s.id);
  if (b.rt) {
    // One legacy cooldown unit is exactly two seconds in this adaptation.
    b.rt.skillReady[s.id] = b.rt.tick + (b.cooldowns[s.id] || 0) * REALTIME_RULES.effectTicks;
    rtEvent(b, 'cast', 'player', s.kind === 'dmg' ? target.id : s.kind === 'petheal' ? 'pet' : 'player', 0, s.name, s.elem || null);
  }
  switch (s.kind) {
    case 'dmg':
      playerAttack(p, b, target, s);
      break;
    case 'heal':
      heal(p, b, st.matk * multiplier(p, s), s.name);
      if (s.hot) addBuff(b, { id: `${s.id}:hot`, name: s.name, values: {}, hot: s.hot[0], turns: s.hot[1] });
      break;
    case 'buff': {
      const buff = { id: s.id, name: s.name, values: skillBuffValues(p, s), turns: s.turns };
      if (buff.values.shield) buff.shield = Math.max(1, Math.round(st.mag * buff.values.shield));
      addBuff(b, buff);
      log(b, `${s.name}生效，持续${s.turns}回合${buff.shield ? `，护盾可吸收${buff.shield}点伤害` : ''}。`);
      break;
    }
    case 'summon': {
      const hp = Math.max(1, Math.round(st.hp * s.pet.hp));
      b.pet = { name: s.pet.name, hp, maxHp: hp, atk: Math.round(st.atk * s.pet.atk), def: Math.round(st.def * 0.6), mdef: Math.round(st.mdef * 0.6),
        accuracy: st.accuracy, attackLevel: st.attackLevel, defenseLevel: st.defenseLevel, penetrationP: st.penetrationP, penetrationM: st.penetrationM,
        huntLevel: b.context.type === 'arena' ? 0 : st.huntLevel, spirit: st.spirit, creation: st.creation,
        metalRes: st.metalRes, woodRes: st.woodRes, waterRes: st.waterRes, fireRes: st.fireRes, earthRes: st.earthRes,
        metalDef: st.metalDef * 0.6, woodDef: st.woodDef * 0.6, waterDef: st.waterDef * 0.6, fireDef: st.fireDef * 0.6, earthDef: st.earthDef * 0.6 };
      log(b, `召唤了${b.pet.name}，它将协同攻击并替你承受伤害。`);
      break;
    }
    case 'petheal': {
      const before = b.pet.hp;
      b.pet.hp = clamp(before + Math.round(b.pet.maxHp * multiplier(p, s)), 0, b.pet.maxHp);
      log(b, `${s.name}为${b.pet.name}恢复了${b.pet.hp - before}点生命。`, 'heal');
      rtEvent(b, 'heal', 'player', 'pet', b.pet.hp - before, s.name);
      break;
    }
    case 'transform': {
      if (hasBuff(b, s.id)) b.buffs = b.buffs.filter((x) => x.id !== s.id);
      else addBuff(b, { id: s.id, name: s.name, values: { ...s.buff }, turns: null });
      // 仅改变战斗buff；保留受伤比例，反复变身不能免费补满生命。
      p.hp = clamp(Math.floor(p.hp * stats(p, b).hp / st.hp), 1, stats(p, b).hp);
      log(b, hasBuff(b, s.id) ? '你化身猛虎！' : '你恢复了人形。');
      break;
    }
    case 'stealth':
      b.stealth = true;
      log(b, '你隐入暗影，下次攻击必定暴击，潜行持续至下一次攻击。');
      break;
  }
}

function petTurn(b, targetId) {
  if (!(b.pet?.hp > 0)) return;
  const m = alive(b).find((x) => x.id === targetId) || alive(b)[0];
  if (!m) return;
  const chance = hitChance(b.pet, m);
  rtEvent(b, 'attack', 'pet', m.id, 0, b.pet.name);
  if (chance < 1 && Math.random() < 1 - chance) {
    log(b, `${m.name}闪避了${b.pet.name}的攻击。`);
    rtEvent(b, 'miss', 'pet', m.id, 0, b.pet.name); return;
  }
  hurtMonster(b, m, combatDamage(b.pet.atk, b.pet, m, 'phys', null, enemyDefense(m, 'phys')), b.pet.name, '', 'pet');
}

function enemyTurn(p, b, defending) {
  const acted = [];
  for (const m of alive(b)) {
    const result = enemyAct(p, b, m, defending);
    if (result) return result;
    acted.push(m);
  }
  for (const m of acted) if (m.hp > 0) { m.intent = rollIntent(m); announceIntent(b, m); }
  return null;
}

function enemyAct(p, b, m, defending) {
  const intent = intentOf(m);
  const stun = m.statuses.find((x) => x.kind === 'stun');
  if (stun) {
    log(b, intent === 'heavy' ? `${m.name}的蓄力被眩晕打断！` : `${m.name}被眩晕，无法行动。`, intent === 'heavy' ? 'victory' : 'system');
    stun.turns--;
    m.statuses = m.statuses.filter((x) => x.turns > 0);
    return null;
  }
  rtEvent(b, 'attack', m.id, b.pet?.hp > 0 ? 'pet' : 'player', 0, intent === 'heavy' ? '重击' : '攻击', m.type === 'magic' ? m.elem : null);
  if (hasBuff(b, 'gear:sword18b:guard')) {
    log(b, `${m.name}失去目标，婆娑体使${b.rt ? '持续期间' : '本轮后续'}攻击落空。`);
    rtEvent(b, 'miss', m.id, 'player', 0, '婆娑体'); return null;
  }
  if (hasBuff(b, 'gear:axe19b:guard')) {
    log(b, `风残影免疫${m.name}${b.rt ? '持续期间' : '本轮后续'}攻击伤害。`);
    rtEvent(b, 'miss', m.id, 'player', 0, '风残影'); return null;
  }
  const st = stats(p, b);
  const heavy = intent === 'heavy' && !hasBuff(b, 'gear:axe19c:guard');
  const parry = heavy && defending;
  const scale = heavy ? 2.4 : intent === 'exposed' ? 0.6 : 1;
  const atk = enemyAttack(m) * scale * (0.9 + Math.random() * 0.2);
  const magic = m.type === 'magic';
  const name = `${m.name}${heavy ? (magic ? '的蓄力法术' : '的蓄力重击') : intent === 'exposed' ? '仓促的攻击' : '的攻击'}`;
  if (b.pet?.hp > 0) {
    const damage = Math.min(b.pet.hp, Math.max(1, Math.round(combatDamage(atk, m, b.pet, m.type, magic ? m.elem : null))));
    b.pet.hp -= damage;
    log(b, `${b.pet.name}替你承受${name}，损失${damage}点生命。`, 'damage');
    rtEvent(b, 'damage', m.id, 'pet', damage, name, magic ? m.elem : null);
    if (b.pet.hp <= 0) {
      log(b, `${b.pet.name}倒下了。`, 'danger');
      rtEvent(b, 'death', m.id, 'pet', 0, b.pet.name);
    }
    return null;
  }
  if (Math.random() < 1 - hitChance(m, st, b.stealth ? 0.6 : 0)) {
    log(b, `你闪避了${name}。`);
    rtEvent(b, 'miss', m.id, 'player', 0, name, magic ? m.elem : null);
    return null;
  }
  const critical = !parry && !hasBuff(b, 'gear:axe19a:guard') && m.crit > 0 && Math.random() < clamp(m.crit, 0, 0.75);
  const guard = parry ? 0.25 / 2.4 : defending ? 0.45 : 1;
  let damage = Math.max(1, Math.round(combatDamage(atk * (critical ? clamp(m.critDamage ?? 2, 1, 5) : 1), m, st, m.type, magic ? m.elem : null) * guard * (hasBuff(b, 'gear:axe19a:guard') ? 0.5 : 1)));
  let absorbed = 0;
  for (const buff of b.buffs) {
    const amount = Math.min(buff.shield || 0, damage);
    if (!amount) continue;
    buff.shield -= amount;
    damage -= amount;
    absorbed += amount;
  }
  syncShield(b);
  if (absorbed) log(b, `护盾吸收了${absorbed}点伤害。`);
  if (damage) {
    const actual = Math.min(p.hp, damage);
    p.hp = Math.max(0, p.hp - damage);
    log(b, `${name}对你造成${actual}点伤害${parry ? '（完美格挡）' : ''}${critical ? '，暴击！' : '。'}`, p.hp <= st.hp * 0.25 ? 'danger' : 'damage');
    rtEvent(b, 'damage', m.id, 'player', actual, name, magic ? m.elem : null);
  }
  if (p.hp <= 0) rtEvent(b, 'death', m.id, 'player', 0, name);
  if (checkDeath(p, b)) return b.result;
  if (parry) {
    rtEvent(b, 'guard', 'player', m.id, absorbed, '完美格挡');
    rtEvent(b, 'attack', 'player', m.id, 0, '格挡反击');
    const type = CLASSES[p.cls].atkType;
    p.chi = clamp((p.chi || 0) + 15, 0, 300);
    log(b, '完美格挡！你顺势反击，元气+15。', 'victory');
    hurtMonster(b, m, combatDamage(st.atk * 0.7, st, m, type, null, enemyDefense(m, type), b.context.type !== 'arena'), '格挡反击');
    if (m.hp <= 0) return null;
  }
  if (damage && ['axe19a', 'axe19b', 'axe19c', 'sword18b'].includes(highWeapon(p)) && Math.random() < 0.2) {
    const templateId = highWeapon(p);
    const [name, effect] = { axe19a: ['太清咒', '本轮后续伤害减半且免暴，连击系数+2'], axe19b: ['风残影', '本轮后续敌人攻击无伤'],
      axe19c: ['磐龙甲', '免疫本轮后续蓄力重击的额外伤害'], sword18b: ['婆娑体', '本轮后续敌人失去目标'] }[templateId];
    addBuff(b, { id: `gear:${templateId}:guard`, name, values: {}, turns: 1 });
    if (templateId === 'axe19a') addBuff(b, { id: 'gear:axe19a:speed', name: '太清咒·连击', values: { speed: 2 }, turns: 2 });
    log(b, `${name}触发（本作20%回合适配）：${effect}。`);
  }
  activateCharms(p, b);
  return null;
}

export function takeTurn(p, b, action, targetId) {
  if (b.rt) throw new Error('实时战斗不能使用回合行动。');
  if (b.result) return b.result;
  if (checkDeath(p, b)) return b.result;
  if (!alive(b).length) return finish(b, 'win');
  let s = null;
  let itemId = null;
  let reason = null;
  if (typeof action === 'string' && action.startsWith('skill:')) {
    const id = action.slice(6);
    reason = canUseSkill(p, b, id);
    s = skillOf(p, id);
  } else if (typeof action === 'string' && action.startsWith('item:')) {
    itemId = action.slice(5);
    reason = itemReason(p, b, itemId);
  } else if (!['attack', 'defend', 'escape'].includes(action)) reason = '无效的战斗行动';
  else if (action === 'escape' && b.context.noEscape) reason = '此战斗不能逃跑';
  const needsTarget = action === 'attack' || s?.kind === 'dmg';
  let target = alive(b).find((m) => m.id === targetId);
  if (needsTarget && !target) {
    if (targetId != null) reason ||= '目标不存在或已经被击败';
    else target = alive(b)[0];
  }
  // 先完整校验：无药、缺蓝、冷却和非法目标均不推进回合或任何计时器。
  if (reason) { log(b, reason, 'system'); return null; }
  const oldCooldowns = Object.keys(b.cooldowns).filter((id) => b.cooldowns[id] > 0);
  const endRound = () => {
    for (const id of oldCooldowns) b.cooldowns[id] = Math.max(0, b.cooldowns[id] - 1);
    recoverRound(p, b);
    return b.result;
  };
  b.round++;
  activateCharms(p, b);
  startRound(p, b);
  if (!alive(b).length) { finish(b, 'win'); return endRound(); }
  // 回合开始的持续伤害可能击败原目标；改选存活目标，绝不攻击尸体。
  if (needsTarget && !(target?.hp > 0)) target = alive(b)[0];
  if (b.round === 1 && b.context.ambush) log(b, '你发动偷袭，敌人措手不及，露出破绽！');
  let defending = false;
  if (s) castSkill(p, b, s, target);
  else if (itemId) {
    const item = ITEMS[itemId];
    const st = stats(p, b);
    p.items[itemId]--;
    const before = p[item.type];
    p[item.type] = clamp(before + item.value, 0, st[item.type]);
    log(b, `使用${item.name}，恢复${p[item.type] - before}点${item.type === 'hp' ? '生命' : '真气'}。`, 'heal');
  } else if (action === 'attack') {
    playerAttack(p, b, target, null);
    p.chi = clamp((p.chi || 0) + 10, 0, 300);
  } else if (action === 'defend') {
    defending = true;
    const st = stats(p, b);
    const before = p.mp;
    p.mp = clamp(p.mp + Math.max(3, Math.round(st.mp * 0.04)), 0, st.mp);
    log(b, `你凝神防御${alive(b).some((m) => intentOf(m) === 'heavy' && !stunned(m)) ? '，准备格挡重击' : '，本轮受到伤害减少55%'}，恢复${p.mp - before}点真气。`);
  } else if (action === 'escape') {
    const enemies = alive(b);
    const lv = enemies.reduce((sum, m) => sum + m.lv, 0) / enemies.length;
    if (Math.random() < clamp(0.55 + (p.lv - lv) * 0.015, 0.15, 0.9)) {
      finish(b, 'escape'); return endRound();
    }
    log(b, '逃跑失败，敌人追了上来！', 'danger');
  }
  if (!alive(b).length) { finish(b, 'win'); return endRound(); }
  petTurn(b, target?.id);
  if (!alive(b).length) { finish(b, 'win'); return endRound(); }
  enemyTurn(p, b, defending);
  if (!b.result && !alive(b).length) finish(b, 'win');
  return endRound();
}

function potionFor(p, b, type, desired) {
  const missing = stats(p, b)[type] - p[type];
  const options = Object.entries(ITEMS)
    .filter(([id, item]) => item.type === type && !itemReason(p, b, id))
    .sort((a, z) => a[1].value - z[1].value);
  if (!options.length) return null;
  const [id, item] = options.find(([, x]) => x.value >= Math.min(missing, desired)) || options[options.length - 1];
  return { action: `item:${id}`, amount: Math.min(missing, item.value) };
}

function incomingDamage(p, b, st, defending = false) {
  return alive(b).reduce((n, m) => {
    if (stunned(m)) return n;
    const intent = intentOf(m);
    const heavy = intent === 'heavy' && !hasBuff(b, 'gear:axe19c:guard');
    const scale = heavy ? (defending ? 0.25 : 2.4) : (intent === 'exposed' ? 0.6 : 1) * (defending ? 0.45 : 1);
    const crit = 1 + clamp(m.crit || 0, 0, 0.75) * (clamp(m.critDamage ?? 2, 1, 5) - 1);
    return n + combatDamage(enemyAttack(m) * scale * crit, m, st, m.type, m.type === 'magic' ? m.elem : null) * hitChance(m, st, b.stealth ? 0.6 : 0);
  }, 0);
}

function attackScore(p, b, st, s, target) {
  const targets = s?.aoe ? alive(b) : [target];
  const drain = clamp(buffValue(b, 'lifesteal') + (s?.fx?.lifesteal || 0), 0, 1);
  let total = 0;
  let dealt = 0;
  for (const m of targets) {
    const raw = expectedAttack(p, b, st, s, m);
    dealt += Math.min(m.hp, raw);
    total += Math.min(m.hp, raw);
    if (raw >= m.hp) { total += enemyAttack(m) * 0.5; continue; }
    if (s?.fx?.dot) {
      const [amount, turns] = s.fx.dot;
      const tick = combatDamage(attackMean(st, s) * amount, st, m, dotType(p, s), dotElement(s),
        enemyDefense(m, dotType(p, s), dotElement(s)), b.context.type !== 'arena');
      const horizon = Math.min(turns, Math.ceil((m.hp - raw) / Math.max(1, raw)));
      // 已有同源DOT只计算刷新增加的部分，避免为了续毒放弃高收益攻击。
      const old = m.statuses.find((x) => x.kind === 'dot' && x.source === s.id);
      total += Math.min(m.hp - raw, tick * Math.max(0, horizon - (old?.turns || 0))) * 0.65;
    }
    if (s?.fx?.stun) total += s.fx.stun[0] * Math.min(2, s.fx.stun[1]) * combatDamage(enemyAttack(m), m, st, m.type, m.type === 'magic' ? m.elem : null) * hitChance(st, m) * 0.65;
    if (s?.fx?.armorBreak && !m.statuses.some((x) => x.kind === 'armorBreak' && x.source === s.id)) total += raw * s.fx.armorBreak[0] * 0.4;
    if (s?.fx?.weaken && !m.statuses.some((x) => x.kind === 'weaken' && x.source === s.id)) total += enemyAttack(m) * s.fx.weaken[0] * 0.4;
  }
  return total + Math.min(st.hp - p.hp, dealt * drain) * 0.7 - resourceCost(p, b, s);
}

export function pickAutoAction(p, b) {
  const enemies = alive(b).sort((a, z) => a.hp - z.hp || z.atk - a.atk);
  const targetId = enemies[0]?.id ?? null;
  const choice = (action, id = targetId) => ({ action, targetId: id });
  if (b.result || !enemies.length || p.hp <= 0) return choice('attack');
  const st = stats(p, b);
  const skills = (SKILLS[p.cls] || []).filter((s) => !canUseSkill(p, b, s.id));
  const eligibleManaCosts = (SKILLS[p.cls] || []).filter((s) => s.kind === 'dmg' && skillLevel(p, s)
    && !canUseSkill({ ...p, mp: Math.max(p.mp, skillResources(s, skillLevel(p, s)).mp) }, b, s.id))
    .map((s) => skillResources(s, skillLevel(p, s)).mp);
  p = { ...p, hp: p.hp + charmRecovery(p, st, 'hp'), mp: p.mp + charmRecovery(p, st, 'mp') };
  const incoming = b.pet?.hp > 0 ? 0 : Math.max(0, incomingDamage(p, b, st) - b.shield);
  const missing = st.hp - p.hp;
  const lowHp = p.hp <= st.hp * 0.4 || p.hp <= incoming * 1.25;
  const threats = b.pet?.hp > 0 || hasBuff(b, 'gear:axe19c:guard') ? [] : enemies.filter((m) => intentOf(m) === 'heavy' && !stunned(m));
  const finishing = enemies.length === 1 && expectedAttack(p, b, st, null, enemies[0]) >= enemies[0].hp;
  // 低血且有人蓄力：能扛住格挡后的伤害就先防御（完美格挡+回蓝），否则才吃药/治疗。
  if (lowHp && threats.length && !finishing && p.hp > Math.max(0, incomingDamage(p, b, st, true) - b.shield) * 1.25) return choice('defend');
  if (lowHp) {
    const potion = potionFor(p, b, 'hp', st.hp * 0.75 - p.hp);
    let recovery = potion ? { action: potion.action, score: potion.amount } : null;
    for (const s of skills.filter((x) => x.kind === 'heal')) {
      const immediate = Math.min(missing, st.matk * multiplier(p, s));
      const hot = s.hot && !hasBuff(b, `${s.id}:hot`) ? Math.min(Math.max(0, missing - immediate), st.hp * s.hot[0] * s.hot[1]) : 0;
      const score = immediate + hot * (p.hp <= incoming ? 0.1 : 0.35) - skillResources(s, skillLevel(p, s)).mp * 0.1;
      if (score > 0 && (!recovery || score > recovery.score)) recovery = { action: `skill:${s.id}`, score };
    }
    // 噬魂及狂暴的吸血也属于紧急治疗，不能被低蓝补药抢走救命回合。
    for (const s of [null, ...skills.filter((x) => x.kind === 'dmg')]) {
      const drain = clamp(buffValue(b, 'lifesteal') + (s?.fx?.lifesteal || 0), 0, 1);
      if (!drain) continue;
      for (const m of s?.aoe ? [enemies[0]] : enemies) {
        const targets = s?.aoe ? enemies : [m];
        const damage = targets.reduce((n, x) => n + Math.min(x.hp, expectedAttack(p, b, st, s, x)), 0);
        const score = Math.min(missing, damage * drain) - (s ? skillResources(s, skillLevel(p, s)).mp : 0) * 0.1;
        if (score > 0 && (!recovery || score > recovery.score)) recovery = { action: s ? `skill:${s.id}` : 'attack', score, targetId: m.id };
      }
    }
    if (recovery) return choice(recovery.action, recovery.targetId ?? targetId);
  }
  const attacks = skills.filter((s) => s.kind === 'dmg');
  const cheapest = Math.min(...eligibleManaCosts);
  if (p.mp < st.mp * 0.2 || (Number.isFinite(cheapest) && p.mp < cheapest)) {
    const potion = potionFor(p, b, 'mp', st.mp * 0.7 - p.mp);
    if (potion) return choice(potion.action);
  }
  if (threats.length && !finishing) {
    // 单个蓄力者且有高几率控制技：直接打断并造成伤害；多个蓄力者仍以防御覆盖全体。
    const control = threats.length === 1 && attacks.filter((s) => s.fx?.stun?.[0] >= AUTO_AI.interruptChance)
      .sort((a, z) => z.fx.stun[0] - a.fx.stun[0] || a.id.localeCompare(z.id))[0];
    if (control) return choice(`skill:${control.id}`, threats[0].id);
    const saved = incoming - Math.max(0, incomingDamage(p, b, st, true) - b.shield);
    if (saved > st.hp * 0.04) return choice('defend');
  }
  let best = choice('attack');
  let bestScore = attackScore(p, b, st, null, enemies[0]);
  for (const s of attacks) {
    const cost = skillResources(s, skillLevel(p, s)).mp;
    for (const m of s.aoe ? [enemies[0]] : enemies) {
      // 保留20%真气给控制/治疗，除非这一击能收掉目标。
      if (p.mp - cost < st.mp * AUTO_AI.manaReserve && expectedAttack(p, b, st, s, m) < m.hp) continue;
      let score = attackScore(p, b, st, s, m);
      if (s.aoe && enemies.length > 1 && score > 0) score *= 1.15;
      if (score > bestScore) { bestScore = score; best = choice(`skill:${s.id}`, m.id); }
    }
  }
  const remainingHp = enemies.reduce((n, m) => n + m.hp, 0);
  const basic = Math.max(1, expectedAttack(p, b, st, null, enemies[0]));
  const horizon = clamp(remainingHp / basic, 1, 6);
  for (const s of skills) {
    let score = -Infinity;
    if (s.kind === 'summon') {
      const petDamage = combatDamage(st.atk * s.pet.atk, st, enemies[0], 'phys', null, enemyDefense(enemies[0], 'phys')) * hitChance(st, enemies[0]);
      score = petDamage * Math.min(horizon, 4) + Math.min(st.hp * s.pet.hp, incoming * horizon) * 0.25 - resourceCost(p, b, s);
    } else if (s.kind === 'petheal' && b.pet.hp < b.pet.maxHp * 0.45) {
      const restored = Math.min(b.pet.maxHp - b.pet.hp, b.pet.maxHp * multiplier(p, s));
      score = restored * 0.3 + Math.min(horizon, 2) * b.pet.atk * 0.25 - skillResources(s, skillLevel(p, s)).mp * 0.18;
    } else if (b.round < 2 && horizon >= 3) {
      // 仅在开局、敌人能存活足够久时准备；不会循环补buff拖长战斗。
      if (s.kind === 'buff' && !hasBuff(b, s.id)) {
        const turns = Math.min(s.turns, horizon - 1), values = skillBuffValues(p, s);
        score = basic * ((values.atk || 0) + (values.crit || 0)) * turns;
        score += Math.min(missing, st.hp * (values.regen || 0) * turns) * 0.5;
        score += Math.min(st.mag * (values.shield || 0), incoming * turns) * 0.45;
        score += incoming * ((values.def || 0) + (values.mdef || 0) + (values.dodge || 0)) * turns * 0.2;
        if (values.equipmentDefPct || values.equipmentEarthDefPct) {
          const preview = { ...b, buffs: [...b.buffs, { id: s.id, values }] };
          const saved = incomingDamage(p, b, st) - incomingDamage(p, preview, stats(p, preview));
          score += Math.max(0, saved) * turns * 0.45;
        }
        score += basic * (values.crit || 0) * (st.critDamage - 2) * turns;
        score -= resourceCost(p, b, s);
      } else if (s.kind === 'transform' && !hasBuff(b, s.id)) {
        score = basic * (s.buff.atk || 0) * (horizon - 1) + p.hp * (s.buff.hp || 0) * 0.4 - skillResources(s, skillLevel(p, s)).mp * 0.18;
      } else if (s.kind === 'stealth' && !b.stealth) {
        const next = attacks.length ? Math.max(...attacks.map((x) => st.atk * multiplier(p, x) * (x.hits || 1) * (1 + (x.stealthBonus || 0)))) : st.atk;
        score = Math.min(remainingHp, next * 1.5 * st.critDamage) - Math.min(remainingHp, next * (1 + st.crit * (st.critDamage - 1))) - resourceCost(p, b, s);
      }
    }
    if (score > bestScore) { bestScore = score; best = choice(`skill:${s.id}`); }
  }
  return best;
}

// Fixed-step local adaptation, never driven by Date/performance or takeTurn.
export const REALTIME_RULES = Object.freeze({
  stepMs: 200, effectTicks: 10, maxSteps: 5, eventLimit: 64,
  minX: -4, maxX: 4, minZ: -2.8, maxZ: 2.8,
  playerSpeed: 3.5, meleeSpeed: 2.2, casterSpeed: 1.5,
  meleeRange: 1.25, playerMeleeRange: 1.4, rangedRange: 5, heavyRadius: 1.4,
  attackWindupTicks: 2, heavyWindupTicks: 6, enemyCooldownTicks: 9, bossCooldownTicks: 7,
  basicTicks: 6, skillGlobalTicks: 3, guardTicks: 15, guardCooldownTicks: 40,
  potionCooldownTicks: 40, hpCharmTicks: 50, mpCharmTicks: 25,
  aggroNormal: 3.2, aggroElite: 3.6, aggroBoss: 4.2, aggroLevelGap: 8, originLimit: 64,
});
// Monsters far below the player stay passive, as in the original game.
export function aggroRadius(p, lv, rank) {
  if (!p || lv < p.lv - REALTIME_RULES.aggroLevelGap) return 0;
  return rank === 'boss' ? REALTIME_RULES.aggroBoss : rank === 'elite' ? REALTIME_RULES.aggroElite : REALTIME_RULES.aggroNormal;
}
const ENEMY_POSITIONS = {
  1: [[1.55, 0.2]],
  2: [[1.15, -0.6], [2.15, 1.04]],
  3: [[1, -1.05], [2.6, -0.3], [1.5, 1.3]],
  4: [[0.85, -1.15], [2.65, -0.8], [1.05, 1.15], [2.75, 1.25]],
};
const DIRECTIONS = Object.freeze({ stop: [0, 0], up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
  'up-left': [-1, -1], 'up-right': [1, -1], 'down-left': [-1, 1], 'down-right': [1, 1] });
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const playerRange = (p) => CLASSES[p.cls].atkType === 'magic' || ['bow', 'crossbow', 'slingshot'].includes(equippedWeaponType(p))
  ? REALTIME_RULES.rangedRange : REALTIME_RULES.playerMeleeRange;
const enemyRange = (m) => m.type === 'magic' ? REALTIME_RULES.rangedRange : REALTIME_RULES.meleeRange;
function rtEvent(b, kind, actor, target, amount = 0, name = '', element = null) {
  if (!b.rt) return;
  const rt = b.rt;
  rt.events.push({ seq: ++rt.sequence, tick: rt.tick, kind, actor, target, amount, name, element });
  if (rt.events.length > REALTIME_RULES.eventLimit) rt.events.splice(0, rt.events.length - REALTIME_RULES.eventLimit);
}
function rtRequired(b) {
  if (!b?.rt) throw new Error('请先启用实时战斗。');
  if (b.result) throw new Error('战斗已经结束。');
}
function validateTarget(b, targetId) {
  if (targetId !== undefined && (typeof targetId !== 'string' || !alive(b).some((m) => m.id === targetId))) {
    throw new Error('目标不存在或已经被击败。');
  }
}
function rtTarget(b, targetId) {
  return alive(b).find((m) => m.id === targetId)
    || alive(b).sort((a, z) => distance(b.rt.player, b.rt.enemies[a.id]) - distance(b.rt.player, b.rt.enemies[z.id]))[0];
}
function move(position, dx, dz, speed, stopAt = 0) {
  const length = Math.hypot(dx, dz);
  if (!length) return;
  const amount = Math.min(Math.max(0, length - stopAt), speed * REALTIME_RULES.stepMs / 1000);
  position.x = clamp(position.x + dx / length * amount, REALTIME_RULES.minX, REALTIME_RULES.maxX);
  position.z = clamp(position.z + dz / length * amount, REALTIME_RULES.minZ, REALTIME_RULES.maxZ);
}
const inArena = (v) => v && typeof v === 'object' && Number.isFinite(v.x) && Number.isFinite(v.z)
  && v.x >= REALTIME_RULES.minX && v.x <= REALTIME_RULES.maxX && v.z >= REALTIME_RULES.minZ && v.z <= REALTIME_RULES.maxZ;
function readLayout(layout) {
  if (layout === undefined || layout === null) return null;
  const limit = REALTIME_RULES.originLimit;
  const { origin, player, enemy } = layout;
  if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.z) || Math.abs(origin.x) > limit || Math.abs(origin.z) > limit
    || Object.keys(layout).some((k) => !['origin', 'player', 'enemy'].includes(k)) || (player === undefined) !== (enemy === undefined)) {
    throw new Error('实时战场布局无效。');
  }
  if (player !== undefined && (!inArena(player) || !inArena(enemy) || distance(player, enemy) < 0.5)) throw new Error('实时战场站位无效。');
  return { origin: { x: origin.x, z: origin.z }, player: player && { x: player.x, z: player.z }, enemy: enemy && { x: enemy.x, z: enemy.z } };
}
export function enableRealtime(p, b, layout) {
  if (!b || b.result || p.hp <= 0 || !alive(b).length) throw new Error('当前没有进行中的战斗。');
  if (b.rt) return b.rt; // Enabling twice cannot reset any clocks or position.
  if (!ENEMY_POSITIONS[b.monsters.length] || b.monsters.some((m) => ['player', 'pet'].includes(m.id))) {
    throw new Error('实时战场仅支持1—4名敌人及非保留目标ID。');
  }
  const place = readLayout(layout);
  if (p.charmCooldowns === undefined) p.charmCooldowns = { hp: 0, mp: 0 };
  const slots = ENEMY_POSITIONS[b.monsters.length];
  const enemies = Object.fromEntries(b.monsters.map((m, i) => {
    let [x, z] = slots[i];
    if (place?.enemy && i === 0) ({ x, z } = place.enemy);
    else if (place?.enemy) {
      x = clamp(place.enemy.x + x - slots[0][0], REALTIME_RULES.minX, REALTIME_RULES.maxX);
      z = clamp(place.enemy.z + z - slots[0][1], REALTIME_RULES.minZ, REALTIME_RULES.maxZ);
    }
    return [m.id, { x, z, readyAt: i * 2, windupUntil: 0, aim: null }];
  }));
  const start = place?.player ?? { x: -1.65, z: 0.55 };
  b.rt = { tick: 0, paused: false, autoSkills: true,
    player: { x: start.x, z: start.z, readyAt: 0, guardUntil: 0, guardReadyAt: 0, potionReadyAt: 0 },
    enemies, sequence: 0, events: [], basicReadyAt: 0, petReadyAt: 0,
    skillReady: Object.fromEntries(Object.entries(b.cooldowns).map(([id, turns]) => [id, turns * REALTIME_RULES.effectTicks])) };
  if (place) b.rt.origin = place.origin;
  for (const effect of [...b.buffs, ...b.monsters.flatMap((m) => m.statuses)]) effect.nextEffectAt = REALTIME_RULES.effectTicks;
  return b.rt;
}

// Deterministic behaviour layer (never Math.random/Date): every dangerous move
// reuses intent 'heavy' + aim, so the existing red circle and HUD telegraph it.
export const ENEMY_AI = Object.freeze({
  flankSpread: 1.1, flankRadius: 0.9, kiteDistance: 2.4,
  chargeMin: 2.6, chargeMax: 6, chargeCooldownTicks: 50, chargeLanding: 0.9,
  phaseHp: 0.5, phaseWindupTicks: 5, quakeEvery: 3, enrageHp: 0.3,
});
export const AUTO_AI = Object.freeze({ guardHp: 0.5, potionHp: 0.3, potionTarget: 0.75, manaReserve: 0.2, interruptChance: 0.5 });
const enemyCooldown = (m, e) => m.rank === 'boss' || e.phase === 2 ? REALTIME_RULES.bossCooldownTicks : REALTIME_RULES.enemyCooldownTicks;
const dangerAt = (b, pos) => alive(b).some((m) => {
  const e = b.rt.enemies[m.id];
  return e.windupUntil >= b.rt.tick && e.aim && !stunned(m) && distance(pos, e.aim) <= REALTIME_RULES.heavyRadius + 1e-9;
});
function enemyPhase(b, m, e) {
  if (e.phase === 2 || m.rank === 'normal' || !m.rank) return;
  if (m.hp >= m.maxHp * (m.rank === 'boss' ? ENEMY_AI.phaseHp : ENEMY_AI.enrageHp)) return;
  e.phase = 2;
  if (m.rank === 'boss') e.combo = ENEMY_AI.quakeEvery;
  rtEvent(b, 'telegraph', m.id, 'player', 0, m.rank === 'boss' ? '狂怒' : '狂暴');
  log(b, m.rank === 'boss' ? `${m.name}进入狂怒阶段：蓄力更快，并会释放范围重击！` : `${m.name}陷入狂暴，攻击更加频繁！`, 'danger');
}
// Melee spread over bearings around the player (the lead walks straight in,
// the rest flank on alternating sides); casters back off while recovering.
function enemyMove(b, m, e, ready) {
  const P = b.rt.player, range = enemyRange(m), dist = distance(P, e);
  if (m.type === 'magic') {
    if (!ready && m.rank !== 'boss' && dist < ENEMY_AI.kiteDistance) move(e, e.x - P.x || 1, e.z - P.z, REALTIME_RULES.casterSpeed);
    else if (dist > range) move(e, P.x - e.x, P.z - e.z, REALTIME_RULES.casterSpeed, range);
    return;
  }
  const melee = alive(b).filter((x) => x.type !== 'magic');
  const k = melee.indexOf(m);
  if (k <= 0) { if (dist > range) move(e, P.x - e.x, P.z - e.z, REALTIME_RULES.meleeSpeed, range); return; }
  if (ready && dist <= range) return;
  const lead = b.rt.enemies[melee[0].id];
  const angle = Math.atan2(lead.z - P.z, lead.x - P.x) + Math.ceil(k / 2) * (k % 2 ? 1 : -1) * ENEMY_AI.flankSpread;
  const r = range * ENEMY_AI.flankRadius;
  const slot = { x: clamp(P.x + Math.cos(angle) * r, REALTIME_RULES.minX, REALTIME_RULES.maxX),
    z: clamp(P.z + Math.sin(angle) * r, REALTIME_RULES.minZ, REALTIME_RULES.maxZ) };
  move(e, slot.x - e.x, slot.z - e.z, REALTIME_RULES.meleeSpeed);
}
function enemyStart(b, m, e) {
  const rt = b.rt, P = rt.player, dist = distance(P, e);
  const telegraph = (intent, windup, aim, name, mode) => {
    if (intent === 'heavy') m.intent = 'heavy';
    e.windupUntil = rt.tick + windup; e.aim = aim;
    if (mode) e.mode = mode;
    rtEvent(b, 'telegraph', m.id, 'player', 0, name, m.type === 'magic' ? m.elem : null);
    log(b, `${m.name}${intent === 'heavy' ? `${name}，离开红圈或守御可应对` : '准备攻击'}。`, intent === 'heavy' ? 'danger' : 'system');
  };
  if (m.rank === 'elite' && m.type !== 'magic' && rt.tick >= (e.chargeAt || 0) && dist >= ENEMY_AI.chargeMin && dist <= ENEMY_AI.chargeMax) {
    e.chargeAt = rt.tick + ENEMY_AI.chargeCooldownTicks;
    return telegraph('heavy', REALTIME_RULES.heavyWindupTicks, { x: P.x, z: P.z }, '蓄力冲锋', 'charge');
  }
  if (dist > enemyRange(m) + 1e-9) return;
  const phase2 = m.rank === 'boss' && e.phase === 2;
  if (phase2 && (e.combo || 0) >= ENEMY_AI.quakeEvery) {
    e.combo = 0;
    const melee = m.type !== 'magic';
    return telegraph('heavy', ENEMY_AI.phaseWindupTicks, melee ? { x: e.x, z: e.z } : { x: P.x, z: P.z }, melee ? '震地' : '陨星', 'quake');
  }
  if (intentOf(m) === 'heavy') return telegraph('heavy', phase2 ? ENEMY_AI.phaseWindupTicks : REALTIME_RULES.heavyWindupTicks, { x: P.x, z: P.z }, '蓄力重击');
  telegraph(intentOf(m), REALTIME_RULES.attackWindupTicks, null, '攻击前摇');
}
function enemyResolve(p, b, m, e) {
  const rt = b.rt, heavy = intentOf(m) === 'heavy', mode = e.mode;
  const missed = heavy ? distance(rt.player, e.aim) > REALTIME_RULES.heavyRadius : distance(rt.player, e) > enemyRange(m) + 1e-9;
  if (mode === 'charge') {
    // The lunge ends just short of the locked point, whether or not it connects.
    const dx = e.aim.x - e.x, dz = e.aim.z - e.z, length = Math.hypot(dx, dz);
    if (length > ENEMY_AI.chargeLanding) move(e, dx, dz, length * 1000 / REALTIME_RULES.stepMs, ENEMY_AI.chargeLanding);
  }
  const label = mode === 'charge' ? '冲锋' : mode === 'quake' ? (m.type === 'magic' ? '陨星' : '震地') : '重击';
  e.windupUntil = 0; e.aim = null; delete e.mode;
  if (missed) {
    log(b, `${m.name}的${heavy ? `${label}落点` : '攻击射程'}被你避开，攻击落空。`);
    rtEvent(b, 'miss', m.id, 'player', 0, heavy ? `${label}落空` : '射程外');
  } else enemyAct(p, b, m, rt.tick < rt.player.guardUntil);
  if (m.rank === 'boss' && e.phase === 2 && mode !== 'quake') e.combo = Math.min(ENEMY_AI.quakeEvery, (e.combo || 0) + 1);
  e.readyAt = rt.tick + enemyCooldown(m, e);
}
function rtGuard(b) {
  const rt = b.rt;
  rt.player.guardUntil = rt.tick + REALTIME_RULES.guardTicks;
  rt.player.guardReadyAt = rt.tick + REALTIME_RULES.guardCooldownTicks;
  rtEvent(b, 'guard', 'player', 'player', 0, '守御');
  log(b, '守御生效3秒，普通伤害减免55%，重击可完美格挡反击；冷却8秒。');
}
function rtDrink(p, b, itemId) {
  const rt = b.rt, item = ITEMS[itemId], before = p[item.type];
  p.items[itemId]--; p[item.type] = clamp(before + item.value, 0, stats(p, b)[item.type]);
  rt.player.potionReadyAt = rt.tick + REALTIME_RULES.potionCooldownTicks;
  log(b, `使用${item.name}，恢复${p[item.type] - before}点${item.type === 'hp' ? '生命' : '真气'}。`, 'heal');
  rtEvent(b, 'heal', 'player', 'player', p[item.type] - before, item.name);
}
// Auto mode survival: guard only when low and actually about to be hit; drink
// an HP potion only in an emergency (never MP potions, never at full HP).
function autoRealtimeSurvive(p, b) {
  const rt = b.rt, st = stats(p, b);
  if (b.pet?.hp > 0) return;
  const incoming = alive(b).some((m) => {
    const e = rt.enemies[m.id];
    return e.windupUntil >= rt.tick && !stunned(m) && (e.aim ? distance(rt.player, e.aim) <= REALTIME_RULES.heavyRadius : distance(rt.player, e) <= enemyRange(m) + 1e-9);
  });
  if (incoming && p.hp < st.hp * AUTO_AI.guardHp && rt.tick >= rt.player.guardReadyAt && rt.tick >= rt.player.guardUntil) rtGuard(b);
  if (p.hp < st.hp * AUTO_AI.potionHp && rt.tick >= rt.player.potionReadyAt) {
    const potion = potionFor(p, b, 'hp', st.hp * AUTO_AI.potionTarget - p.hp);
    if (potion) rtDrink(p, b, potion.action.slice(5));
  }
}

// Stable four-slot selection: ignore transient mana, cooldowns, HP, existing buffs
// and pets when ranking; eligibility still uses the real learned/source weapon gates.
export function realtimeLoadout(p, b) {
  if (!b) return [];
  const preview = { ...b, result: null, buffs: [], cooldowns: {}, pet: null, stealth: false,
    monsters: b.monsters.map((m) => ({ ...m, hp: m.maxHp, statuses: [], intent: 'attack' })) };
  const st = stats(p, preview), target = preview.monsters[0];
  if (!target) return [];
  const rankingPlayer = { ...p, hp: st.hp, mp: 1e12, chi: 300 };
  const eligible = (SKILLS[p.cls] || []).filter((s) => !canUseSkill(rankingPlayer,
    s.kind === 'petheal' ? { ...preview, pet: { hp: 1, maxHp: st.hp } } : preview, s.id));
  const utility = (s) => {
    const cost = resourceCost(rankingPlayer, preview, s);
    if (s.kind === 'dmg') return attackScore(rankingPlayer, preview, st, s, target) / (1 + skillCooldown(p, preview, s.id) * 0.08);
    if (s.kind === 'heal') return st.matk * multiplier(p, s) * 0.8 + (s.hot ? st.hp * s.hot[0] * s.hot[1] * 0.35 : 0) - cost;
    if (s.kind === 'summon') return st.atk * s.pet.atk * 3 + st.hp * s.pet.hp * 0.15 - cost;
    if (s.kind === 'petheal') return st.hp * multiplier(p, s) * 0.3 - cost;
    if (s.kind === 'stealth') return st.atk * st.critDamage * 0.7 - cost;
    const v = skillBuffValues(p, s);
    return st.atk * ((v.atk || 0) + (v.crit || 0)) * 3
      + st.hp * ((v.hp || 0) + (v.regen || 0) * 3) * 0.4
      + st.atk * ((v.def || 0) + (v.mdef || 0) + (v.dodge || 0) + (v.equipmentDefPct || 0) + (v.equipmentEarthDefPct || 0))
      + st.mag * (v.shield || 0) * 0.5 + st.atk * (v.lifesteal || 0) * 3 - cost;
  };
  const ranked = eligible.map((s) => ({ s, score: utility(s) })).sort((a, z) => z.score - a.score || a.s.id.localeCompare(z.s.id));
  // Keep one sustainable output and one recovery/summon when learned, so four
  // expensive finishers cannot exclude the class's defining support mechanic.
  const selected = [];
  const add = (s) => { if (s && !selected.includes(s)) selected.push(s); };
  add(eligible.filter((s) => s.kind === 'dmg').sort((a, z) => skillResources(a, skillLevel(p, a)).mp - skillResources(z, skillLevel(p, z)).mp)[0]);
  add(ranked.find(({ s }) => ['heal', 'summon'].includes(s.kind))?.s);
  for (const { s } of ranked) { if (selected.length >= 4) break; add(s); }
  return selected;
}
function autoRealtimeSkill(p, b, target) {
  const st = stats(p, b);
  const available = realtimeLoadout(p, b).filter((s) => !canUseSkill(p, b, s.id));
  const score = (s) => s.kind === 'dmg' ? attackScore(p, b, st, s, target) : s.kind === 'heal'
    ? Math.min(st.hp - p.hp, st.matk * multiplier(p, s)) : s.kind === 'summon' ? s.pet.atk * st.atk : 0;
  const sorted = (list) => list.sort((a, z) => score(z) - score(a) || a.id.localeCompare(z.id));
  const reach = (m) => distance(b.rt.player, b.rt.enemies[m.id]) <= playerRange(p) + 1e-9;
  // 1) Interrupt: a loaded stun on the earliest in-range heavy windup.
  const casting = alive(b).filter((m) => intentOf(m) === 'heavy' && b.rt.enemies[m.id].windupUntil >= b.rt.tick && !stunned(m) && reach(m))
    .sort((a, z) => b.rt.enemies[a.id].windupUntil - b.rt.enemies[z.id].windupUntil || a.id.localeCompare(z.id));
  const control = available.filter((s) => s.kind === 'dmg' && s.fx?.stun).sort((a, z) => z.fx.stun[0] - a.fx.stun[0] || a.id.localeCompare(z.id));
  if (casting.length && control.length) return { s: control[0], target: casting[0] };
  if (p.hp < st.hp * 0.55) {
    const healSkill = sorted(available.filter((s) => s.kind === 'heal' && (!s.hot || !hasBuff(b, `${s.id}:hot`))))[0];
    if (healSkill) return { s: healSkill, target };
  }
  const support = sorted(available.filter((s) => s.kind === 'summon' || s.kind === 'petheal' && b.pet.hp < b.pet.maxHp * 0.55
    || ['buff', 'transform'].includes(s.kind) && !hasBuff(b, s.id) && Object.values(skillBuffValues(p, s)).some((v) => v > 0)
    || s.kind === 'stealth' && !b.stealth))[0];
  if (support) return { s: support, target };
  if (!reach(target)) return null;
  // 2) Mana reserve: damage skills keep 20% MP unless they finish the target.
  const attacks = available.filter((s) => s.kind === 'dmg' && (p.mp - skillResources(s, skillLevel(p, s)).mp >= st.mp * AUTO_AI.manaReserve
    || expectedAttack(p, b, st, s, target) >= target.hp));
  if (alive(b).length > 1) {
    const aoe = sorted(attacks.filter((s) => s.aoe))[0];
    if (aoe) return { s: aoe, target };
  }
  const best = sorted(attacks)[0];
  return best ? { s: best, target } : null;
}
function cancelWindup(b, m) {
  const e = b.rt.enemies[m.id];
  if (!e.windupUntil) return;
  log(b, `${m.name}${intentOf(m) === 'heavy' ? (e.mode === 'charge' ? '的冲锋' : '的蓄力重击') : '的攻击'}被眩晕打断！`, 'victory');
  rtEvent(b, 'miss', m.id, 'player', 0, '眩晕打断');
  e.windupUntil = 0; e.aim = null; delete e.mode;
  e.readyAt = b.rt.tick + enemyCooldown(m, e);
  m.intent = rollIntent(m);
}
function rtEffects(p, b) {
  const rt = b.rt;
  for (const [id, at] of Object.entries(rt.skillReady)) b.cooldowns[id] = Math.ceil(Math.max(0, at - rt.tick) / REALTIME_RULES.effectTicks);
  for (const buff of b.buffs) {
    if (rt.tick < buff.nextEffectAt) continue;
    if (buff.hot) heal(p, b, stats(p, b).hp * buff.hot, buff.name);
    if (buff.values.regen) heal(p, b, stats(p, b).hp * buff.values.regen, buff.name);
    if (buff.turns !== null) buff.turns = Math.max(0, buff.turns - 1);
    buff.nextEffectAt += REALTIME_RULES.effectTicks;
  }
  b.buffs = b.buffs.filter((x) => x.turns === null || x.turns > 0);
  syncShield(b);
  const st = stats(p, b); p.hp = Math.min(p.hp, st.hp); p.mp = Math.min(p.mp, st.mp);
  for (const m of alive(b)) {
    for (const status of m.statuses) {
      if (rt.tick < status.nextEffectAt) continue;
      if (status.kind === 'dot' && m.hp > 0) {
        hurtMonster(b, m, combatDamage(status.attack, status.attacker || {}, m, status.type, status.elem, enemyDefense(m, status.type, status.elem)), `${status.name}的持续伤害`, '', 'player', status.elem);
        if (!alive(b).length) return finish(b, 'win');
      }
      status.turns = Math.max(0, status.turns - 1);
      status.nextEffectAt += REALTIME_RULES.effectTicks;
    }
    m.statuses = m.statuses.filter((x) => x.turns > 0);
  }
  if (rt.tick % REALTIME_RULES.effectTicks === 0) { b.round++; recoverRound(p, b); }
}
function rtCheckEnd(p, b) {
  if (b.result) return b.result;
  if (checkDeath(p, b)) return b.result;
  return alive(b).length ? null : finish(b, 'win');
}
export function advanceRealtime(p, b, { steps = 1, direction = 'stop', targetId } = {}) {
  rtRequired(b);
  if (!Number.isSafeInteger(steps) || steps < 1 || steps > REALTIME_RULES.maxSteps) throw new Error('实时步数必须为1—5。');
  if (typeof direction !== 'string' || !Object.hasOwn(DIRECTIONS, direction)) throw new Error('无效的移动方向。');
  validateTarget(b, targetId);
  if (b.rt.paused) return null;
  const rt = b.rt;
  for (let i = 0; i < steps && !b.result; i++) {
    rt.tick++;
    for (const type of ['hp', 'mp']) p.charmCooldowns[type] = Math.max(0, p.charmCooldowns[type] - 1);
    // Cancel before expiry processing: a one-unit stun really interrupts a
    // heavy instead of vanishing at a generic round boundary.
    for (const m of alive(b)) if (stunned(m)) cancelWindup(b, m);
    rtEffects(p, b);
    if (rtCheckEnd(p, b)) break;
    const target = rtTarget(b, targetId);
    const [dx, dz] = DIRECTIONS[direction];
    if (direction !== 'stop') move(rt.player, dx, dz, REALTIME_RULES.playerSpeed);
    else {
      // Auto-chase stops short rather than stepping into a live red circle.
      const e = rt.enemies[target.id], from = { x: rt.player.x, z: rt.player.z };
      move(rt.player, e.x - rt.player.x, e.z - rt.player.z, REALTIME_RULES.playerSpeed, playerRange(p));
      if (!dangerAt(b, from) && dangerAt(b, rt.player)) Object.assign(rt.player, from);
    }
    if (rt.autoSkills) autoRealtimeSurvive(p, b);
    if (rt.autoSkills && rt.tick >= rt.player.readyAt) {
      const pick = autoRealtimeSkill(p, b, target);
      if (pick) { castSkill(p, b, pick.s, pick.target); rt.player.readyAt = rt.tick + REALTIME_RULES.skillGlobalTicks; }
    }
    if (rtCheckEnd(p, b)) break;
    const basicTarget = rtTarget(b, targetId);
    if (rt.tick >= rt.basicReadyAt && distance(rt.player, rt.enemies[basicTarget.id]) <= playerRange(p) + 1e-9) {
      playerAttack(p, b, basicTarget, null); p.chi = clamp(p.chi + 10, 0, 300);
      rt.basicReadyAt = rt.tick + Math.ceil(REALTIME_RULES.basicTicks / stats(p, b).speed);
    }
    if (rtCheckEnd(p, b)) break;
    if (b.pet?.hp > 0 && rt.tick >= rt.petReadyAt) {
      petTurn(b, rtTarget(b, targetId).id); rt.petReadyAt = rt.tick + REALTIME_RULES.basicTicks;
    }
    if (rtCheckEnd(p, b)) break;
    for (const m of alive(b)) {
      const e = rt.enemies[m.id];
      if (stunned(m)) { cancelWindup(b, m); continue; }
      if (e.windupUntil) {
        if (rt.tick < e.windupUntil) continue;
        enemyResolve(p, b, m, e);
        if (rtCheckEnd(p, b)) break;
        if (m.hp > 0) m.intent = rollIntent(m);
      } else {
        enemyPhase(b, m, e);
        const ready = rt.tick >= e.readyAt;
        enemyMove(b, m, e, ready);
        if (ready) enemyStart(b, m, e);
      }
    }
    if (b.result) break;
    activateCharms(p, b);
  }
  return b.result;
}
export function realtimeAction(p, b, action, targetId) {
  rtRequired(b);
  validateTarget(b, targetId);
  const rt = b.rt;
  if (['pause', 'resume', 'autoskills'].includes(action)) {
    if (action === 'pause') rt.paused = true;
    else if (action === 'resume') rt.paused = false;
    else rt.autoSkills = !rt.autoSkills;
    return null;
  }
  if (rt.paused) throw new Error('战斗已暂停，请先继续。');
  const target = rtTarget(b, targetId);
  let s, itemId;
  if (action === 'guard') {
    if (rt.tick < rt.player.guardReadyAt) throw new Error('守御冷却中。');
  } else if (action === 'escape') {
    if (b.context.noEscape) throw new Error('此战斗不能撤退。');
  } else if (typeof action === 'string' && action.startsWith('skill:')) {
    s = skillOf(p, action.slice(6));
    const reason = canUseSkill(p, b, action.slice(6));
    if (reason) throw new Error(reason);
    if (rt.tick < rt.player.readyAt) throw new Error('技能公共冷却中。');
    if (s.kind === 'dmg' && distance(rt.player, rt.enemies[target.id]) > playerRange(p) + 1e-9) throw new Error('目标在技能射程外。');
  } else if (typeof action === 'string' && action.startsWith('item:')) {
    itemId = action.slice(5);
    const reason = itemReason(p, b, itemId);
    if (reason) throw new Error(reason);
    if (rt.tick < rt.player.potionReadyAt) throw new Error('药品共享冷却中。');
  } else throw new Error('无效的实时战斗行动。');
  // All rejection gates precede mutations (including logs and clocks).
  if (action === 'escape') return finish(b, 'escape');
  if (action === 'guard') rtGuard(b);
  else if (s) {
    castSkill(p, b, s, target); rt.player.readyAt = rt.tick + REALTIME_RULES.skillGlobalTicks;
    for (const m of alive(b)) if (stunned(m)) cancelWindup(b, m);
  } else if (itemId) rtDrink(p, b, itemId);
  return rtCheckEnd(p, b);
}
