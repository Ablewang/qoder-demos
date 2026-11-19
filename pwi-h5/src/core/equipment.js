import { CLASSES } from '../data/classes.js';
import { ZONES } from '../data/world.js';
import { EQUIPMENT_DEFAULTS, ITEMS, SLOTS, REFINE_MAX, makeHighEquip, rollAddons } from '../data/items.js';
import { NAMED_EQUIPMENT, matchesNamedEquip } from '../data/named-equipment.js';
import { HIGH_EQUIPMENT, HIGH_RECIPES, matchesHighEquip } from '../data/high-equipment.js';
import { matchesGearSpec, gearSpec } from '../data/gear-specs.js';
import { PRODUCTION_MATERIALS, QIANKUN_TRANSFER_COSTS, productionTier, gemRequiredGrade } from '../data/production.js';
import { BAG_LIMIT, MAX_LEVEL, stats } from './model.js';

const own = (o, key) => Object.hasOwn(o, key);
const finite = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const ACTION_PARAMS = {
  repair: ['uid'], socket: ['uid', 'gemId', 'index'], unsocket: ['uid', 'index'],
  reroll: ['uid'], upgrade: ['uid'], decompose: ['uid', 'confirm'], bind: ['uid', 'confirm'],
  craft: ['templateId', 'confirm'], ascend: ['uid', 'confirm'], punch: ['uid'],
  transfer: ['fromUid', 'toUid', 'confirm'],
};
const ARMOR_SLOTS = ['head', 'body', 'legs', 'feet', 'wrist'];
const GENERATED_FIELDS = ['ruleVersion', 'series', 'weaponType', 'wear', 'ranges', 'stars', 'attackType', 'origin'];
const NAMED_FIELDS = ['sourceRecord', 'sourceStats', 'status', 'adaptedFields', 'runtimeAdaptation', 'affixes', 'affixRolls', 'addonBudget', 'referenceOnly', 'nameColor', 'materials'];
const generatedSocketLimit = (it) => it.slot === 'weapon' ? 2 : ARMOR_SLOTS.includes(it.slot) ? 4 : 0;
function gemFits(it, id) {
  const gem = ITEMS[id];
  const allowed = it.slot === 'weapon' ? ['patk', 'matk', 'crit', 'attackLevel', 'atkLevel']
    : ARMOR_SLOTS.includes(it.slot) ? ['hp', 'mp', 'def', 'mdef', 'defenseLevel', 'defLevel'] : [];
  return gem?.type === 'gem' && allowed.includes(gem.stat) && it.grade >= gemRequiredGrade(id, gem);
}

export function ensureEquipment(p) {
  if (!p) return p;
  for (const it of [...Object.values(p.equipment || {}), ...(p.bag || [])]) {
    if (!it || it.kind !== 'equip') continue;
    for (const [key, value] of Object.entries(EQUIPMENT_DEFAULTS)) {
      if (!own(it, key)) it[key] = Array.isArray(value) ? [] : value;
    }
  }
  return p;
}

function capResources(p) {
  const st = stats(p);
  p.hp = Math.min(p.hp, st.hp);
  p.mp = Math.min(p.mp, st.mp);
}

export function wearEquipment(p) {
  ensureEquipment(p);
  let count = 0;
  for (const it of Object.values(p.equipment || {})) {
    if (!it || !finite(it.durability) || it.durability <= 0) continue;
    it.durability = Math.max(0, it.durability - 1);
    count++;
  }
  capResources(p);
  return count;
}

export function validateEquipment(it) {
  if (!it || typeof it !== 'object' || Array.isArray(it)) throw new Error('装备数据无效。');
  const named = it.ruleVersion === 2 || own(NAMED_EQUIPMENT, it.templateId) || /^(official:|local-tutorial:)/.test(it.templateId || '');
  const high = !named && (own(it, 'templateId') || it.q === 4 || it.grade > 16);
  const generated = own(it, 'ruleVersion');
  if (named && !matchesNamedEquip(it)) throw new Error('具名装备身份、来源、基础属性或原文词条与模板不符。');
  if (!named && (NAMED_FIELDS.some((key) => own(it, key)) || Object.values(NAMED_EQUIPMENT).some((t) => t.name === it.name))) throw new Error('具名装备不能删除templateId或ruleVersion绕过校验。');
  if (high && (!matchesHighEquip(it) || GENERATED_FIELDS.some((key) => own(it, key)))) throw new Error('高阶装备与官方固定模板不符。');
  if (!named && !high && ['stage', 'id', 'requirements', 'classes', 'attackRanges', 'effects', 'source', 'adaptation', 'initialSockets'].some((key) => own(it, key))) throw new Error('普通装备不能伪造高阶模板身份。');
  if (!named && !high && !generated && GENERATED_FIELDS.some((key) => own(it, key))) throw new Error('新装备元数据不能通过删除ruleVersion降级为旧装备。');
  if (!named && generated && !matchesGearSpec(it)) throw new Error('新装备身份、基础属性或词条与制造规格不符。');
  if (it.kind !== 'equip' || typeof it.uid !== 'string' || !/^[a-z0-9]+$/i.test(it.uid) || !own(SLOTS, it.slot)
    || !Number.isInteger(it.lv) || it.lv < 1 || it.lv > MAX_LEVEL
    || (!(named && it.grade === null) && (!Number.isInteger(it.grade) || it.grade < 1 || it.grade > (high || named ? 19 : 16)))
    || (named && it.grade === null && (it.refine !== 0 || it.sockets?.length !== 0))
    || (named && (!finite(it.price) || it.rerolls !== 0 || it.upgrades !== 0
      || (own(it, 'origin') && (typeof it.origin !== 'string' || !it.origin || it.origin.length > 80))
      || (own(it, 'locked') && typeof it.locked !== 'boolean')))
    || !Number.isInteger(it.refine) || it.refine < 0 || it.refine > REFINE_MAX
    || !Number.isInteger(it.q) || it.q < 0 || it.q > (high ? 4 : 3) || (!high && it.maxDurability !== 100)
    || !Number.isInteger(it.durability) || it.durability < 0 || it.durability > it.maxDurability
    || typeof it.bound !== 'boolean' || !Number.isInteger(it.socketLimit) || it.socketLimit < 0 || it.socketLimit > 4
    || !Array.isArray(it.sockets) || it.sockets.length > it.socketLimit
    || it.sockets.some((id) => id !== null && (typeof id !== 'string' || !own(ITEMS, id) || ITEMS[id].type !== 'gem'))
    || !Number.isInteger(it.rerolls) || it.rerolls < 0 || !Number.isInteger(it.upgrades) || it.upgrades < 0
    || (generated && (it.socketLimit !== generatedSocketLimit(it) || it.rerolls !== 0 || it.upgrades !== 0
      || it.sockets.filter(Boolean).some((id) => !gemFits(it, id))))) {
    throw new Error('装备扩展数据、已开孔位或宝石适配无效。');
  }
  return true;
}

function pay(p, gold, materials = {}) {
  if (!finite(p.gold) || p.gold < gold) throw new Error(`金币不足，需要${gold}金币。`);
  for (const [id, qty] of Object.entries(materials)) {
    if (!Number.isSafeInteger(p.items?.[id]) || p.items[id] < qty) throw new Error(`${PRODUCTION_MATERIALS[id]?.name || ITEMS[id]?.name || id}不足，需要${qty}份。`);
  }
  p.gold -= gold;
  for (const [id, qty] of Object.entries(materials)) p.items[id] -= qty;
}

function canReturn(p, rewards) {
  for (const [id, qty] of Object.entries(rewards)) {
    const before = p.items?.[id] ?? 0;
    if (!Number.isSafeInteger(before) || before < 0 || before + qty > 1e7) throw new Error('材料数量已达上限或数据无效。');
  }
}

function give(p, rewards) {
  for (const [id, qty] of Object.entries(rewards)) p.items[id] = (p.items[id] || 0) + qty;
}

// 调用方在克隆Game上执行并提交事务；本模块不保存、不创建经济字段。
export function equipmentAction(game, action, params = {}) {
  const p = game?.p;
  if (!p) throw new Error('请先创建角色。');
  if (game.busy || (game.state?.battle && !game.state.battle.result)) throw new Error('战斗中不能处理装备。');
  if (ZONES[p.location]?.type !== 'city') throw new Error('请在城镇处理装备。');
  if (!own(ACTION_PARAMS, action) || !params || typeof params !== 'object' || Array.isArray(params)
    || Object.keys(params).some((key) => !ACTION_PARAMS[action].includes(key))) throw new Error('装备操作或参数无效。');
  if (action === 'craft') {
    if (params.confirm !== true) throw new Error('神铸兑换需要明确确认。');
    if (p.lv !== 105) throw new Error('神铸兑换需要105级。');
    if (typeof params.templateId !== 'string' || !own(HIGH_EQUIPMENT, params.templateId) || !own(HIGH_RECIPES, params.templateId)) throw new Error('高阶装备模板不存在。');
    const recipe = HIGH_RECIPES[params.templateId];
    if (recipe.from !== null) throw new Error('该装备必须从前一阶段升阶，不能直接兑换。');
    if (!Array.isArray(p.bag) || p.bag.length >= BAG_LIMIT) throw new Error('背包已满。');
    const equipment = makeHighEquip(params.templateId);
    // 所有失败条件先检查；付费后只提交已经生成的固定模板。
    pay(p, recipe.gold, recipe.materials);
    p.bag.push(equipment);
    const result = {
      action, uid: equipment.uid, templateId: params.templateId, equipment: structuredClone(equipment),
      gold: recipe.gold, consumed: structuredClone(recipe.materials), received: {},
      message: `神铸兑换获得${equipment.name}，花费${recipe.gold}金币（本作成本），装备已绑定。`,
    };
    game.event?.(result.message);
    return result;
  }
  if (action === 'transfer') {
    if (params.confirm !== true) throw new Error('精炼转移会清零源精炼并覆盖目标，请明确确认。');
    if (typeof params.fromUid !== 'string' || !params.fromUid || typeof params.toUid !== 'string' || !params.toUid || params.fromUid === params.toUid) throw new Error('请选择两件不同的自有装备。');
    const owned = [...Object.values(p.equipment || {}), ...(p.bag || [])];
    const source = owned.filter((entry) => entry?.uid === params.fromUid);
    const target = owned.filter((entry) => entry?.uid === params.toUid);
    if (source.length !== 1 || target.length !== 1) throw new Error('转移装备不存在或UID重复。');
    const from = { ...structuredClone(EQUIPMENT_DEFAULTS), ...source[0] };
    const to = { ...structuredClone(EQUIPMENT_DEFAULTS), ...target[0] };
    validateEquipment(from); validateEquipment(to);
    if ([from, to].some((it) => it.ruleVersion === 2 && it.grade === null)) throw new Error('来源未载品阶，不能转移精炼。');
    if (from.refine <= to.refine) throw new Error('源装备精炼等级必须高于目标装备。');
    if (from.bound && !to.bound) throw new Error('绑定源装备只能转移到绑定目标装备。');
    const level = from.refine, cost = QIANKUN_TRANSFER_COSTS[level];
    pay(p, 0, { qiankun: cost });
    ensureEquipment(p);
    source[0].refine = 0; target[0].refine = level;
    capResources(p);
    const result = { action, fromUid: params.fromUid, toUid: params.toUid, refine: level,
      gold: 0, consumed: { qiankun: cost }, received: {},
      message: `精炼转移完成，消耗${cost}乾坤石（官方+${level}转移表）；源精炼归零，目标覆盖为+${level}，不叠加。` };
    game.event?.(result.message);
    return result;
  }
  if (typeof params.uid !== 'string' || !params.uid) throw new Error('需要有效的装备UID。');
  const worn = Object.values(p.equipment || {}).filter((it) => it?.uid === params.uid);
  const packed = (p.bag || []).filter((it) => it?.uid === params.uid);
  if (worn.length + packed.length !== 1) throw new Error('装备不存在或UID重复。');
  const it = worn[0] || packed[0];
  const migrated = { ...structuredClone(EQUIPMENT_DEFAULTS), ...it };
  validateEquipment(migrated);
  if (it.ruleVersion === 2 && it.grade === null && ['punch', 'socket', 'decompose'].includes(action)) throw new Error('来源未载品阶，不能开孔、镶嵌或分解。');
  if (it.templateId && ['reroll', 'upgrade'].includes(action)) throw new Error('固定神铸模板不能重洗或普通升级；请使用神铸升阶。');
  if (it.ruleVersion === 1 && ['reroll', 'upgrade'].includes(action)) throw new Error('新制造装备不能任意重洗或通用+5升级；请按配方制造/轮回重铸。');
  const result = { action, uid: it.uid, gold: 0, consumed: {}, received: {} };
  let change;
  switch (action) {
    case 'ascend': {
      if (params.confirm !== true) throw new Error('神铸升阶需要明确确认。');
      if (p.lv !== 105) throw new Error('神铸升阶需要105级。');
      if (!matchesHighEquip(it)) throw new Error('只有真实神铸模板装备可以升阶。');
      if (worn.length) throw new Error('请先卸下至行囊再升阶；升阶后须重新满足装备需求。');
      const targetId = Object.keys(HIGH_RECIPES).find((id) => HIGH_RECIPES[id].from === it.templateId);
      if (!targetId || !own(HIGH_EQUIPMENT, targetId)) throw new Error('该装备没有已核实的下一阶段。');
      const recipe = HIGH_RECIPES[targetId];
      const next = makeHighEquip(targetId);
      for (const key of ['uid', 'refine', 'sockets', 'bound', 'durability']) next[key] = structuredClone(it[key]);
      if (!matchesHighEquip(next)) throw new Error('现有培养状态不能保留至下一阶段。');
      result.gold = recipe.gold;
      result.consumed = structuredClone(recipe.materials);
      result.templateId = targetId;
      change = () => { Object.assign(it, next); };
      break;
    }
    case 'repair': {
      const missing = migrated.maxDurability - migrated.durability;
      if (!missing) throw new Error('装备耐久已满。');
      result.gold = Math.ceil(missing * (1 + it.lv / 20) * (1 + it.q * 0.5));
      change = () => { it.durability = it.maxDurability; };
      break;
    }
    case 'punch': {
      const limit = it.templateId ? migrated.socketLimit : it.ruleVersion === 1 ? generatedSocketLimit(it)
        : it.slot === 'weapon' ? Math.min(2, migrated.socketLimit) : ARMOR_SLOTS.includes(it.slot) ? migrated.socketLimit : 0;
      if (!limit) throw new Error('只有武器与护甲可以开孔，饰品不能开孔。');
      if (migrated.sockets.length >= limit) throw new Error('装备已达开孔上限。');
      result.consumed = { socketStone: it.grade * (migrated.sockets.length + 1) };
      result.index = migrated.sockets.length;
      change = () => { it.sockets.push(null); };
      break;
    }
    case 'socket': {
      const gem = typeof params.gemId === 'string' && own(ITEMS, params.gemId) ? ITEMS[params.gemId] : null;
      if (gem?.type !== 'gem') throw new Error('请选择有效的宝石。');
      if ([1, 2].includes(it.ruleVersion)) {
        const grade = gemRequiredGrade(params.gemId, gem);
        if (it.grade < grade) throw new Error(`宝石需要装备达到${grade}品，不以角色等级代替品阶。`);
        if (!gemFits(it, params.gemId)) throw new Error('该宝石不适配栏位：武器只镶嵌攻击类，护甲只镶嵌生命/真气/防御类。');
      } else if (p.lv < gem.lv || it.lv < gem.lv) throw new Error(`角色和装备均需达到${gem.lv}级（旧装备/固定模板规则）。`);
      const legacy = it.ruleVersion === undefined && !it.templateId;
      const empty = migrated.sockets.indexOf(null);
      const index = own(params, 'index') ? params.index : empty >= 0 ? empty : legacy ? migrated.sockets.length : -1;
      if (!Number.isInteger(index) || index < 0 || index >= migrated.socketLimit
        || (legacy ? index > migrated.sockets.length : index >= migrated.sockets.length)) throw new Error('请先开孔；新装备/固定模板镶嵌必须使用已有空孔，不能自动开孔。');
      if (legacy ? migrated.sockets[index] != null : migrated.sockets[index] !== null) throw new Error('孔位已有宝石，请先拆除。');
      result.gold = 40 + it.lv * 2;
      result.consumed = { ...(legacy ? { socketStone: 1 } : {}), [params.gemId]: 1 };
      result.index = index;
      if (legacy) result.legacy = true;
      change = () => { it.sockets[index] = params.gemId; };
      break;
    }
    case 'unsocket': {
      const index = params.index;
      if (!Number.isInteger(index) || index < 0 || index >= migrated.sockets.length || !migrated.sockets[index]) throw new Error('孔位无效或没有宝石。');
      result.gold = 30 + it.lv;
      result.received = { [migrated.sockets[index]]: 1 };
      result.index = index;
      change = () => { it.sockets[index] = null; };
      break;
    }
    case 'reroll': {
      if (!it.q) throw new Error('普通装备没有随机词条可重洗。');
      result.gold = 80 + it.lv * 4 * (1 + it.q);
      result.consumed = { reforgeStone: 1, salvage: 1 };
      change = () => { it.addons = rollAddons(it.slot, it.lv, it.q); it.rerolls++; };
      break;
    }
    case 'upgrade': {
      if (!Number.isInteger(p.lv) || p.lv < 1 || p.lv > MAX_LEVEL) throw new Error('角色等级无效。');
      const targetLv = Math.min(it.lv + 5, p.lv, MAX_LEVEL);
      if (targetLv <= it.lv) throw new Error('装备已达当前角色等级上限。');
      const accessoryType = it.base?.matk ? 'magic' : it.base?.patk ? 'phys' : null;
      const cls = it.cls || (it.armorType
        ? Object.keys(CLASSES).find((id) => CLASSES[id].armor === it.armorType)
        : accessoryType ? Object.keys(CLASSES).find((id) => CLASSES[id].atkType === accessoryType) : p.cls);
      if (!cls || !own(CLASSES, cls)) throw new Error('装备职业或护甲类别无效。');
      result.gold = 100 + targetLv * 12 * (1 + it.q);
      result.consumed = { upgradeStone: 1, salvage: 2 };
      result.lv = targetLv;
      change = () => {
        const next = gearSpec(it.slot, targetLv, it.q, cls);
        next.price = Math.round((20 + targetLv * targetLv * 0.8) * (1 + it.q * 0.8));
        for (const key of ['lv', 'grade', 'name', 'base', 'price']) it[key] = next[key];
        it.upgrades++;
      };
      break;
    }
    case 'decompose': {
      if (worn.length) throw new Error('请先卸下装备再分解。');
      if (migrated.bound || it.locked) throw new Error('绑定或锁定装备不能分解。');
      if (params.confirm !== true) throw new Error('分解不可撤销，请确认。');
      if (it.ruleVersion === 1) {
        if (it.q >= 2) result.received.huanxian = 1 + it.q + Math.floor(it.grade / 3);
        else {
          const tier = productionTier(it.lv);
          const primary = ARMOR_SLOTS.includes(it.slot) ? it.armorType === 'robe' ? 'fiber' : 'hide'
            : it.slot === 'cape' ? 'fiber' : 'ore';
          result.received[`${primary}${tier}`] = 1 + it.q;
          result.received.salvage = 1;
        }
        if (it.series === 'twilight') result.received.ttSoul = 1;
      } else result.received.salvage = 1 + it.q * 2 + Math.floor(it.lv / 15) + Math.floor((it.refine || 0) / 3);
      // 每颗实际镶嵌的宝石只返还一次；装备移除后孔位不会另行触发拆除奖励。
      for (const gemId of migrated.sockets.filter(Boolean)) result.received[gemId] = (result.received[gemId] || 0) + 1;
      change = () => { p.bag.splice(p.bag.indexOf(it), 1); };
      break;
    }
    case 'bind': {
      if (migrated.bound) throw new Error('装备已经绑定。');
      if (params.confirm !== true) throw new Error('绑定不可撤销，请确认。');
      change = () => { it.bound = true; };
      break;
    }
  }
  canReturn(p, result.received);
  pay(p, result.gold, result.consumed);
  ensureEquipment(p);
  change();
  give(p, result.received);
  capResources(p);
  const labels = { repair: '维修', punch: '开孔', socket: '镶嵌', unsocket: '拆除宝石', reroll: '旧装备重洗', upgrade: '旧装备+5升级', decompose: '分解', bind: '绑定', ascend: '神铸升阶' };
  result.message = `${it.name}${labels[action]}完成${result.gold ? `，花费${result.gold}金币` : ''}。`;
  if (action === 'bind') result.message += '绑定装备不可出售或分解。';
  if (result.legacy) result.message += '此件是无规则版本旧装备，保留旧制镶嵌/自动补孔及1镶嵌石费用；新制造装备不适用。';
  if (action === 'punch') result.message += `开下一个孔消耗${result.consumed.socketStone}镶嵌石，为品阶×新孔序号的本作适配。`;
  if (action === 'decompose' && it.ruleVersion === 1) result.message += '分解产物及用量为本作适配；q2/q3产幻仙石，黄昏另产汇总剑魂。';
  if (action === 'ascend') {
    result.equipment = structuredClone(it);
    result.message += '成本为本作设定，精炼、孔位、绑定与当前耐久已保留。';
  }
  game.event?.(result.message);
  return result;
}
