import { CLASSES, findSkill } from '../data/classes.js';
import { ZONES, CULTIVATION, DUNGEONS } from '../data/world.js';
import { ITEMS, SLOTS, STAT_NAMES, REFINE_MAX, EQUIPMENT_SETS } from '../data/items.js';
import { HIGH_EQUIPMENT, matchesHighEquip } from '../data/high-equipment.js';
import { matchesGearSpec } from '../data/gear-specs.js';
import { PRODUCTION_MATERIALS, PRODUCTION_SKILLS } from '../data/production.js';
import { buildMainline } from '../data/quests.js';
import { ENCOUNTERS } from '../data/encounters.js';
import { ensureEquipment, validateEquipment } from './equipment.js';
import { ensureEconomy } from './economy.js';

import { SHOP_PRODUCTS, COSMETICS, MILESTONES, HONGYUN_POOL, ACTIVITY_POOLS, ECONOMY_LIMITS, ECONOMY_RULES } from '../data/economy.js';

export const SNAPSHOT_VERSION = 2;
const own = (o, k) => Object.hasOwn(o, k);
const object = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const num = (n, max = 1e12) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
const integer = (n, max = 1e12) => Number.isInteger(n) && num(n, max);
const string = (s, max = 100) => typeof s === 'string' && s.length > 0 && s.length <= max;
const date = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const require = (ok, message) => { if (!ok) throw new Error(message); };
const dungeon = (id) => DUNGEONS.some((d) => d.id === id);
const knownItem = (id) => own(ITEMS, id) || own(PRODUCTION_MATERIALS, id);
const GENERATED_FIELDS = ['ruleVersion', 'series', 'weaponType', 'wear', 'ranges', 'stars', 'attackType', 'origin'];
function safeTree(value, depth = 0) {
  require(depth <= 20, '存档嵌套过深。');
  if (typeof value === 'number') require(num(value, Number.MAX_SAFE_INTEGER), '存档包含非法数值。');
  else if (typeof value === 'string') require(value.length <= 4000, '存档文字过长。');
  else if (Array.isArray(value)) { require(value.length <= 1000, '存档数组过长。'); for (const v of value) safeTree(v, depth + 1); }
  else if (object(value)) {
    require(Object.keys(value).length <= 1000, '存档对象过大。');
    for (const [k, v] of Object.entries(value)) { require(!['__proto__', 'prototype', 'constructor'].includes(k), '存档字段不安全。'); safeTree(v, depth + 1); }
  } else require(value === null || typeof value === 'boolean', '存档包含非法类型。');
}
function counterMap(o, validKey = () => true, max = 1e12) {
  return object(o) && Object.entries(o).every(([k, v]) => validKey(k) && integer(v, max));
}
function equipment(it, seen, extended) {
  require(object(it) && it.kind === 'equip' && string(it.uid) && /^[a-z0-9]+$/i.test(it.uid) && !seen.has(it.uid), '装备标识无效或重复。');
  const high = own(it, 'templateId') || it.q === 4 || it.grade > 16;
  require(string(it.name, 80) && own(SLOTS, it.slot) && integer(it.lv, 105) && it.lv >= 1 && integer(it.q, high ? 4 : 3) && integer(it.refine, REFINE_MAX) && integer(it.grade, high ? 19 : 16) && num(it.price), '装备数据无效。');
  if (high) require(matchesHighEquip(it) && !GENERATED_FIELDS.some((key) => own(it, key)), '高阶装备身份、基础属性或固定词条与官方模板不符。');
  else {
    require(!['stage', 'id', 'requirements', 'classes', 'attackRanges', 'effects', 'source', 'adaptation', 'initialSockets'].some((key) => own(it, key)), '普通装备不能伪造高阶模板身份。');
    require(!Object.values(HIGH_EQUIPMENT).some((template) => template.name === it.name), '具名高阶装备必须使用真实模板。');
    if (own(it, 'ruleVersion')) {
      require(matchesGearSpec(it), '新装备身份、基础属性、需求或词条与制造规格不符。');
      validateEquipment(it);
      if (own(it, 'origin')) require(string(it.origin, 80), '装备来源标记无效。');
    } else require(!GENERATED_FIELDS.some((key) => own(it, key)), '不能删除ruleVersion保留新装备元数据以绕过校验。');
  }
  require(it.cls === null || own(CLASSES, it.cls), '装备职业无效。');
  require(it.armorType === null || ['heavy', 'light', 'robe'].includes(it.armorType), '护甲类型无效。');
  for (const o of [it.base, it.addons]) require(object(o) && Object.entries(o).every(([k, v]) => own(STAT_NAMES, k) && num(v, 1e7)), '装备词条无效。');
  if (extended || high) {
    require((high || it.maxDurability === 100) && integer(it.durability, it.maxDurability) && typeof it.bound === 'boolean', '装备耐久或绑定数据无效。');
    require(integer(it.socketLimit, 4) && Array.isArray(it.sockets) && it.sockets.length <= it.socketLimit && it.sockets.every((g) => g === null || (typeof g === 'string' && own(ITEMS, g) && ITEMS[g].type === 'gem')), '宝石孔位数据无效。');
    require(integer(it.rerolls, 1e7) && integer(it.upgrades, 105) && (it.setId === null || (own(EQUIPMENT_SETS, it.setId) && EQUIPMENT_SETS[it.setId].armor === it.armorType && it.q >= 2 && it.lv >= 30)), '装备培养数据无效。');
  }
  seen.add(it.uid);
}
function battle(b, p) {
  if (b === null) return;
  require(object(b) && integer(b.round, 1e7) && [null, 'win', 'lose', 'escape'].includes(b.result) && num(b.shield) && typeof b.stealth === 'boolean' && typeof b.revived === 'boolean', '战斗状态无效。');
  require(object(b.context) && ['field', 'dungeon', 'cult', 'arena'].includes(b.context.type), '战斗场景无效。');
  const ctx = b.context;
  if (ctx.type === 'field') require(own(ZONES, ctx.zone) && ZONES[ctx.zone].type === 'field' && (b.result !== null || ctx.zone === p.location), '战斗地图无效。');
  if (ctx.type === 'dungeon') {
    const d = DUNGEONS.find((d) => d.id === ctx.id);
    require(d && integer(ctx.wave, d.waves || 3) && typeof ctx.bossWave === 'boolean' && ctx.bossWave === (ctx.wave >= (d.waves || 3)), '副本波次无效。');
  }
  if (ctx.type === 'cult') require(integer(ctx.rank, CULTIVATION.length - 1) && ctx.rank > 0, '试炼境界无效。');
  require((ctx.noEscape === undefined || typeof ctx.noEscape === 'boolean') && (ctx.ambush === undefined || typeof ctx.ambush === 'boolean'), '战斗场景标志无效。');
  require(Array.isArray(b.monsters) && b.monsters.length > 0 && b.monsters.length <= 5, '战斗敌人无效。');
  const ids = new Set();
  for (const m of b.monsters) {
    require(object(m) && string(m.id, 80) && !ids.has(m.id) && string(m.name, 100) && integer(m.lv, 110) && m.lv >= 1 && ['', 'elite', 'boss'].includes(m.rank) && ['phys', 'magic'].includes(m.type), '怪物身份无效。');
    require(num(m.maxHp) && m.maxHp > 0 && num(m.hp, m.maxHp) && ['atk', 'def', 'mdef'].every((k) => num(m[k])), '怪物属性无效。');
    require(['metal', 'wood', 'water', 'fire', 'earth'].includes(m.elem) && ['accuracy', 'dodge', 'crit', 'critDamage', 'attackLevel', 'defenseLevel', 'penetrationP', 'penetrationM', 'metalRes', 'woodRes', 'waterRes', 'fireRes', 'earthRes'].every((k) => num(m[k], 1e7)), '怪物扩展属性无效。');
    for (const key of ['metalDef', 'woodDef', 'waterDef', 'fireDef', 'earthDef', 'accuracyRating', 'evasionRating']) require(m[key] === undefined || num(m[key], 1e7), '怪物防御值或命中躲闪度无效。');
    require(Array.isArray(m.statuses) && m.statuses.length <= 100 && (m.intent === undefined || ['attack', 'heavy', 'exposed'].includes(m.intent)), '怪物状态无效。');
    for (const s of m.statuses) require(object(s) && ['stun', 'dot', 'slow', 'weaken', 'armorBreak'].includes(s.kind) && string(s.source, 80) && (findSkill(p.cls, s.source) || (s.source === 'equip:axe19a' && s.kind === 'armorBreak' && s.value === 0.9)) && integer(s.turns, 100) && num(s.value, 100) && (s.kind !== 'dot' || (num(s.attack) && ['phys', 'magic'].includes(s.type))), '持续效果无效。');
    for (const s of m.statuses.filter((s) => s.kind === 'dot')) require((s.elem === null || ['metal', 'wood', 'water', 'fire', 'earth'].includes(s.elem)) && object(s.attacker) && ['attackLevel', 'penetrationP', 'penetrationM'].every((k) => num(s.attacker[k], 1e7)), '持续伤害快照无效。');
    ids.add(m.id);
  }
  if (b.result === null) require(p.hp > 0 && b.monsters.some((m) => m.hp > 0), '进行中的战斗必须有存活双方。');
  require(object(b.cooldowns) && Object.entries(b.cooldowns).every(([k, v]) => findSkill(p.cls, k) && integer(v, 100)), '技能冷却无效。');
  require(Array.isArray(b.buffs) && b.buffs.length <= 100, '战斗增益无效。');
  const buffKeys = [...Object.keys(STAT_NAMES), 'atk', 'shield', 'lifesteal', 'regen', 'equipmentDefPct', 'equipmentEarthDefPct'];
  for (const x of b.buffs) require(object(x) && string(x.id, 100) && string(x.name, 100) && object(x.values) && Object.entries(x.values).every(([k, v]) => buffKeys.includes(k) && num(v, 100)) && (x.turns === null || integer(x.turns, 100)) && (x.shield === undefined || num(x.shield)) && (x.hot === undefined || num(x.hot, 1)), '增益属性无效。');
  for (const x of b.buffs) {
    if (!own(x.values, 'equipmentDefPct') && !own(x.values, 'equipmentEarthDefPct')) continue;
    const coefficient = 0.1 * (p.skills.wz3 || 0);
    require(p.cls === 'wizard' && x.id === 'wz3' && coefficient > 0 && coefficient <= 1
      && x.values.equipmentDefPct === coefficient && x.values.equipmentEarthDefPct === coefficient
      && integer(x.turns, 5) && x.shield === undefined && !own(x.values, 'shield'), '磐石护甲装备加成或本作时长无效。');
  }
  // Old valid shield buffs stay valid; no persistent buff migration is performed.
  if (b.pet !== null) {
    require(object(b.pet) && string(b.pet.name, 100) && num(b.pet.maxHp) && b.pet.maxHp > 0 && num(b.pet.hp, b.pet.maxHp) && ['atk', 'def', 'mdef'].every((k) => num(b.pet[k])), '宠物状态无效。');
    for (const key of ['metalDef', 'woodDef', 'waterDef', 'fireDef', 'earthDef']) require(b.pet[key] === undefined || num(b.pet[key], 1e7), '宠物五行防御值无效。');
  }
  require(Array.isArray(b.logs) && b.logs.length <= 100 && b.logs.every((l) => object(l) && string(l.text, 1000) && ['system', 'damage', 'heal', 'victory', 'danger'].includes(l.kind)), '战斗记录无效。');
  if (b.rewards !== undefined && b.rewards !== null) {
    const r = b.rewards;
    require(b.result === 'win' && object(r) && ['exp', 'sp', 'gold', 'levelUps'].every((k) => integer(r[k])) && r.levelUps <= 105
      && Array.isArray(r.loot) && r.loot.length <= 10 && r.loot.every((x) => object(x) && string(x.name, 80) && integer(x.q, 4))
      && Array.isArray(r.items) && r.items.length <= 10 && r.items.every((x) => object(x) && knownItem(x.id) && integer(x.qty, 1e7) && x.qty > 0)
      && (r.quest === null || (object(r.quest) && string(r.quest.title, 100) && integer(r.quest.done, 1e7) && integer(r.quest.total, 1e7) && r.quest.done <= r.quest.total)), '战斗奖励记录无效。');
  }
}
const cosmetic = (id) => COSMETICS.find((c) => c.id === id);
const timestamp = (t) => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(t) && Number.isFinite(Date.parse(t));
function delivered(rewards) {
  require(Array.isArray(rewards) && rewards.length > 0 && rewards.length <= 100, '奖励结构无效。');
  for (const r of rewards) {
    require(object(r) && integer(r.quantity, 1e12) && r.quantity > 0, '奖励数量无效。');
    if (r.type === 'item') require(knownItem(r.itemId) && r.quantity <= 1e7, '奖励物品无效。');
    else if (r.type === 'equip') { require(r.quantity === 1, '装备奖励数量无效。'); equipment(r.equipment, new Set(), true); }
    else if (r.type === 'cosmetic') require(cosmetic(r.cosmeticId) && r.quantity === 1, '外观奖励无效。');
    else require(['gold', 'sp', 'yuanbao', 'boundYuanbao'].includes(r.type), '奖励类型无效。');
    if (r.duplicateOf !== undefined) require(cosmetic(r.duplicateOf) && r.type === 'boundYuanbao' && r.quantity === 120, '重复外观补偿无效。');
  }
}
function economy(p) {
  require(object(p.wallet) && integer(p.wallet.yuanbao) && integer(p.wallet.boundYuanbao), '钱包数据无效。');
  require(object(p.mall) && object(p.mall.daily) && date(p.mall.daily.day) && counterMap(p.mall.daily.counts) && Array.isArray(p.mall.orders) && p.mall.orders.length <= ECONOMY_LIMITS.orders, '商城订单数据无效。');
  for (const [key, count] of Object.entries(p.mall.daily.counts)) {
    const product = key.startsWith('shop:') && SHOP_PRODUCTS.find((entry) => `shop:${entry.id}` === key);
    const limit = product ? product.dailyLimit : key === ECONOMY_RULES.daily.counter ? 1 : key === ECONOMY_RULES.exchange.counter ? ECONOMY_RULES.exchange.dailyLimit : null;
    require(limit !== null && count <= limit, '商城每日额度无效。');
  }
  const orderIds = new Set();
  for (const order of p.mall.orders) {
    const product = object(order) && SHOP_PRODUCTS.find((entry) => entry.id === order.productId);
    require(product && string(order.id, 200) && !orderIds.has(order.id) && timestamp(order.time) && string(order.name, 100) && integer(order.quantity, 99) && order.quantity > 0 && order.unitPrice === product.price && order.currency === product.currency && order.cost === order.unitPrice * order.quantity, '商城订单字段无效。');
    delivered(order.rewards); orderIds.add(order.id);
  }
  const ev = p.events;
  require(object(ev) && object(ev.hongyun) && integer(ev.hongyun.draws) && integer(ev.hongyun.pity, ECONOMY_LIMITS.pity - 1) && ev.hongyun.pity <= ev.hongyun.draws && integer(ev.chestsOpened) && integer(ev.zongziOpened) && object(ev.festival) && date(ev.festival.day) && typeof ev.festival.claimed === 'boolean' && Array.isArray(ev.milestones) && new Set(ev.milestones).size === ev.milestones.length && ev.milestones.every((id) => MILESTONES.some((m) => m.id === id)), '活动进度无效。');
  require(Array.isArray(p.drawHistory) && p.drawHistory.length <= ECONOMY_LIMITS.history, '开奖记录无效。');
  const drawIds = new Set();
  for (const d of p.drawHistory) {
    require(object(d) && string(d.id, 100) && !drawIds.has(d.id) && timestamp(d.time) && integer(d.sequence) && d.sequence > 0 && typeof d.guaranteed === 'boolean', '开奖记录字段无效。');
    const hongyun = d.poolId === 'hongyun';
    const definition = own(ACTIVITY_POOLS, d.poolId) ? ACTIVITY_POOLS[d.poolId] : null;
    const entry = (hongyun ? HONGYUN_POOL : definition?.pool)?.find((prize) => prize.id === d.prizeId);
    require(entry && string(d.name, 100) && d.rarity === entry.rarity && d.source === (hongyun ? 'hongyun' : definition.counter === 'chestsOpened' ? 'chest' : 'zongzi'), '开奖记录奖池无效。');
    require(d.sequence <= (hongyun ? ev.hongyun.draws : ev[definition.counter]), '开奖累计次数无效。');
    if (hongyun) require(integer(d.pityBefore, 49) && integer(d.pityAfter, 49) && d.guaranteed === (d.pityBefore === 49) && (!d.guaranteed || d.rarity === 'legendary') && d.pityAfter === (d.rarity === 'legendary' ? 0 : d.pityBefore + 1), '开奖保底记录无效。');
    else require(d.pityBefore === null && d.pityAfter === null && d.guaranteed === false, '非秘宝开奖保底无效。');
    delivered(d.rewards); drawIds.add(d.id);
  }
  require(object(p.cosmetics) && Array.isArray(p.cosmetics.owned) && new Set(p.cosmetics.owned).size === p.cosmetics.owned.length && p.cosmetics.owned.every((id) => cosmetic(id)) && ['outfit', 'mount', 'flyer'].every((slot) => p.cosmetics[slot] === null || (p.cosmetics.owned.includes(p.cosmetics[slot]) && cosmetic(p.cosmetics[slot]).slot === slot)), '外观拥有或穿戴数据无效。');
  require(object(p.charms) && integer(p.charms.hp) && integer(p.charms.mp), '神符储量无效。');
}

export function validateSnapshot(raw) {
  require(object(raw) && [1, SNAPSHOT_VERSION].includes(raw.version) && object(raw.player), '不是有效的本游戏存档。');
  safeTree(raw);
  const s = structuredClone(raw);
  const p = s.player;
  const legacy = s.version === 1;
  require(own(CLASSES, p.cls) && p.race === CLASSES[p.cls].race && string(p.name, 16) && own(ZONES, p.location) && own(ZONES, p.lastCity) && ZONES[p.lastCity].type === 'city', '角色信息不完整。');
  for (const k of ['lv', 'exp', 'sp', 'gold', 'points', 'chi', 'cult', 'expBoost', 'mainIndex', 'mainProgress', 'bountyProgress']) require(integer(p[k]), '角色离散数值无效。');
  require(p.lv >= 1 && p.lv <= 105 && p.cult < CULTIVATION.length && p.chi <= 300 && [null, 'sage', 'demon'].includes(p.path) && num(p.hp) && num(p.mp), '角色等级或境界无效。');
  require(typeof p.trialReady === 'boolean' && typeof p.flight === 'boolean' && string(p.petName, 80), '角色状态标志无效。');
  require(object(p.attrs) && Object.keys(p.attrs).length === 4 && ['str', 'con', 'dex', 'mag'].every((k) => integer(p.attrs[k], 100000)), '角色属性无效。');
  require(object(p.skills) && Object.entries(p.skills).every(([id, lv]) => {
    const skill = findSkill(p.cls, id);
    return skill && integer(lv, skill.maxLv) && lv >= 1;
  }), '技能数据无效。');
  require(counterMap(p.items, knownItem, 1e7), '物品数据无效。');
  if (p.production !== undefined) require(object(p.production) && Object.entries(p.production).every(([skill, state]) =>
    own(PRODUCTION_SKILLS, skill) && object(state) && Object.keys(state).length === 2
    && own(state, 'level') && own(state, 'exp') && integer(state.level, 6) && state.level >= 1 && integer(state.exp, 1e7)), '生产技能数据无效。');
  if (p.lastGatherAt !== undefined) require(integer(p.lastGatherAt, Number.MAX_SAFE_INTEGER), '采集时间戳无效。');
  require(counterMap(p.kills, (k) => string(k, 100)) && counterMap(p.clears, dungeon) && object(p.totals) && ['battles', 'deaths', 'earned'].every((k) => integer(p.totals[k])), '统计数据无效。');
  require(Array.isArray(p.bag) && p.bag.length <= 80 && object(p.equipment), '背包结构无效。');
  const seen = new Set();
  for (const it of [...p.bag, ...Object.values(p.equipment)]) equipment(it, seen, !legacy);
  require(Object.entries(p.equipment).every(([slot, it]) => own(SLOTS, slot) && (it.slot === slot || (slot === 'ring2' && it.slot === 'ring1'))), '装备栏位无效。');
  for (const a of [p.discovered, p.visits]) require(Array.isArray(a) && a.every((id) => own(ZONES, id)), '探索记录无效。');
  require(p.mainIndex <= buildMainline(p.race).length, '主线进度无效。');
  if (p.bounty !== null) {
    const q = p.bounty;
    require(object(q) && own(ZONES, q.zone) && object(q.goal) && q.goal.type === 'kill' && ZONES[q.zone].mobs?.some((m) => m[0] === q.goal.mob) && integer(q.goal.count, 30) && q.goal.count >= 1 && integer(q.rlv, 105) && q.rlv >= 1 && num(q.rexp, 1) && num(q.rsp, 10) && string(q.title, 100) && string(q.giver, 100) && string(q.story, 1000), '悬赏目标无效。');
  }
  require(object(p.daily) && date(p.daily.day) && typeof p.daily.signed === 'boolean' && integer(p.daily.bounties, 10) && counterMap(p.daily.dungeons, dungeon, 3), '每日活动数据无效。');
  if (legacy && p.daily.arena === undefined) p.daily.arena = 0;
  require(integer(p.daily.arena, 3), '比武次数无效。');
  if (p.encounter !== undefined && p.encounter !== null) {
    const e = p.encounter;
    require(object(e) && own(ENCOUNTERS, e.id) && e.zone === p.location && ZONES[e.zone].type === 'field' && (e.mob === undefined || string(e.mob, 100)) && Object.keys(e).every((k) => ['id', 'zone', 'mob'].includes(k)), '奇遇状态无效。');
  }
  if (legacy) {
    ensureEquipment(p); ensureEconomy(p);
    const migratedSeen = new Set();
    for (const it of [...p.bag, ...Object.values(p.equipment)]) equipment(it, migratedSeen, true);
    s.battle = null;
    s.journal = Array.isArray(s.journal) ? s.journal.filter((j) => object(j) && typeof j.text === 'string' && j.text.length < 1000).slice(-60).map((j) => ({ text: j.text, kind: ['system', 'damage', 'heal', 'victory', 'danger'].includes(j.kind) ? j.kind : 'system', time: typeof j.time === 'string' ? j.time : '' })) : [];
  }
  require(Array.isArray(s.journal) && s.journal.length <= 60 && s.journal.every((j) => object(j) && typeof j.text === 'string' && j.text.length < 1000 && ['system', 'damage', 'heal', 'victory', 'danger'].includes(j.kind) && typeof j.time === 'string' && j.time.length <= 20), '纪行记录无效。');
  economy(p);
  battle(s.battle, p);
  return { version: SNAPSHOT_VERSION, player: p, journal: s.journal, battle: s.battle };
}
