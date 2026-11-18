import { ZONES } from '../data/world.js';
import { ITEMS, makeEquip } from '../data/items.js';
import { gearSpec, matchesGearSpec } from '../data/gear-specs.js';
import {
  PRODUCTION_MATERIALS, PRODUCTION_SKILLS, PRODUCTION_LEVELS, PRODUCTION_ADAPTATION,
  MACHINE_RECIPE, QIANKUN_TRANSFER_COSTS, productionState, getProductionRecipes,
  getProductionRecipe, gemRequiredGrade,
} from '../data/production.js';
import { BAG_LIMIT } from './model.js';
import { validateEquipment } from './equipment.js';

const own = (o, key) => Object.hasOwn(o, key);
const object = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const actions = {
  produce: ['recipeId', 'uid', 'inherit', 'confirm'], train: ['skill'], manufactureMachine: [],
};
const itemName = (id) => PRODUCTION_MATERIALS[id]?.name || ITEMS[id]?.name || id;

function skillsFor(p) {
  if (p.production !== undefined && (!object(p.production) || Object.entries(p.production).some(([skill, state]) =>
    !own(PRODUCTION_SKILLS, skill) || !object(state) || Object.keys(state).length !== 2
    || !own(state, 'level') || !own(state, 'exp') || !Number.isInteger(state.level) || state.level < 1 || state.level > 6
    || !Number.isSafeInteger(state.exp) || state.exp < 0 || state.exp > 1e7))) throw new Error('生产技能数据无效。');
  return productionState(p);
}
function checkPayment(p, gold, materials) {
  if (!Number.isSafeInteger(p.gold) || p.gold < gold) throw new Error(`金币不足，需要${gold}金币。`);
  if (!object(p.items)) throw new Error('材料背包数据无效。');
  for (const [id, qty] of Object.entries(materials)) {
    if (!Number.isSafeInteger(p.items[id]) || p.items[id] < qty) throw new Error(`${itemName(id)}不足，需要${qty}份。`);
  }
}
function commitPayment(p, gold, materials) {
  p.gold -= gold;
  for (const [id, qty] of Object.entries(materials)) p.items[id] -= qty;
}
function matchesPredecessor(it, recipe) {
  const from = recipe.from;
  return Boolean(from && matchesGearSpec(it) && !own(it, 'templateId') && it.q === 3
    && it.slot === from.slot && it.weaponType === from.weaponType && it.armorType === from.armorType
    && from.alternatives.some((entry) => it.series === entry.series && it.lv === entry.lv));
}
function ownedPredecessor(p, recipe, uid) {
  if (typeof uid !== 'string' || !uid) throw new Error('请选择行囊中匹配的前阶装备UID。');
  const packed = p.bag.filter((it) => it?.uid === uid);
  const worn = Object.values(p.equipment || {}).filter((it) => it?.uid === uid);
  if (packed.length + worn.length !== 1) throw new Error('前阶装备不存在或UID重复。');
  if (worn.length) throw new Error('不能消耗穿戴中的装备，请先卸下至行囊。');
  const it = packed[0];
  validateEquipment(it);
  if (!matchesPredecessor(it, recipe)) throw new Error('前阶装备必须是同武器/护甲类型、匹配系列等级的真实配方装备。');
  if (it.locked) throw new Error('锁定装备不能作为制造前身。');
  return it;
}
function inheritanceCost(it) {
  validateEquipment(it);
  return QIANKUN_TRANSFER_COSTS[it.refine]
    + it.sockets.length * 2
    + it.sockets.filter(Boolean).reduce((total, id) => total + gemRequiredGrade(id, ITEMS[id]), 0);
}
function optionsFor(recipe) {
  return { series: recipe.series,
    ...(recipe.weaponType ? { weaponType: recipe.weaponType } : {}),
    ...(recipe.armorType ? { armorType: recipe.armorType } : {}),
  };
}
function missingPayment(p, gold, materials) {
  return { gold: Math.max(0, gold - (p.gold || 0)), materials: Object.fromEntries(
    Object.entries(materials).filter(([id, qty]) => (p.items?.[id] || 0) < qty)
      .map(([id, qty]) => [id, qty - (p.items?.[id] || 0)])),
  };
}

// 只派生 detached 规格与缺项，不创建随机装备、UID、技能状态或经济字段。
export function getProductionCatalog(p) {
  if (!p) throw new Error('请先创建角色。');
  const state = skillsFor(p);
  const recipes = getProductionRecipes(p.cls).map((recipe) => {
    const candidates = recipe.from ? (p.bag || []).filter((it) => {
      if (!matchesPredecessor(it, recipe) || it.locked) return false;
      if ([...(p.bag || []), ...Object.values(p.equipment || {})].filter((entry) => entry?.uid === it.uid).length !== 1) return false;
      try { validateEquipment(it); return true; } catch { return false; }
    }).map((it) => {
      const qiankun = inheritanceCost(it);
      const costs = { gold: recipe.gold, materials: { ...recipe.materials, ...(qiankun ? { qiankun } : {}) } };
      return { uid: it.uid, name: it.name, series: it.series, lv: it.lv, refine: it.refine,
        bound: it.bound, sockets: structuredClone(it.sockets),
        inherit: { qiankun, costs, missing: missingPayment(p, costs.gold, costs.materials) } };
    }) : [];
    const missing = { ...missingPayment(p, recipe.gold, recipe.materials),
      playerLv: Math.max(0, recipe.playerLv - p.lv),
      skillLevel: Math.max(0, recipe.skillLevel - state[recipe.skill].level),
      predecessor: Boolean(recipe.from && !candidates.length),
      bagSpace: Boolean(!recipe.from && (p.bag || []).length >= BAG_LIMIT),
      city: ZONES[p.location]?.type !== 'city',
      skillExpCap: state[recipe.skill].exp >= 1e7,
    };
    return { ...recipe, costs: { gold: recipe.gold, materials: { ...recipe.materials } }, candidates,
      previews: recipe.qualities.map((q) => gearSpec(recipe.slot, recipe.lv, q, p.cls, optionsFor(recipe))),
      missing, available: !missing.gold && !Object.keys(missing.materials).length
        && !missing.playerLv && !missing.skillLevel && !missing.predecessor && !missing.bagSpace && !missing.city && !missing.skillExpCap,
      defaultInherit: false,
    };
  });
  const skills = Object.fromEntries(Object.entries(state).map(([skill, value]) => {
    const next = PRODUCTION_LEVELS[value.level] ?? null;
    return [skill, { ...value, name: PRODUCTION_SKILLS[skill].name, next: next && { ...next },
      canTrain: Boolean(next && p.lv >= next.lv && value.exp >= next.exp && p.gold >= next.gold && ZONES[p.location]?.type === 'city'),
    }];
  }));
  const machineMissing = missingPayment(p, MACHINE_RECIPE.gold, MACHINE_RECIPE.materials);
  const machineCount = p.items?.ttMachine ?? 0;
  return structuredClone({ skills, levels: PRODUCTION_LEVELS, materials: PRODUCTION_MATERIALS,
    recipes, adaptation: PRODUCTION_ADAPTATION, transferCosts: QIANKUN_TRANSFER_COSTS,
    machine: { ...MACHINE_RECIPE, missing: machineMissing,
      available: !machineMissing.gold && !Object.keys(machineMissing.materials).length && ZONES[p.location]?.type === 'city'
        && Number.isSafeInteger(machineCount) && machineCount >= 0 && machineCount < 1e7 },
  });
}

// 独立调用也先检查全部条件/支付/继承容量，再生成一次并提交；失败不部分扣款。
export function productionAction(game, action, params = {}) {
  const p = game?.p;
  if (!p) throw new Error('请先创建角色。');
  if (game.busy || (game.state?.battle && !game.state.battle.result)) throw new Error('战斗中不能生产。');
  if (ZONES[p.location]?.type !== 'city') throw new Error('请在城镇生产。');
  if (!own(actions, action) || !object(params) || Object.keys(params).some((key) => !actions[action].includes(key))) throw new Error('生产操作或参数无效。');
  const skills = skillsFor(p);
  if (!Number.isInteger(p.lv) || p.lv < 1 || p.lv > 105) throw new Error('角色等级无效。');
  let result;
  if (action === 'train') {
    if (typeof params.skill !== 'string' || !own(PRODUCTION_SKILLS, params.skill)) throw new Error('请选择铁匠、裁缝或巧匠技能。');
    const state = skills[params.skill], next = PRODUCTION_LEVELS[state.level];
    if (!next) throw new Error('生产技能已达6级上限。');
    if (p.lv < next.lv) throw new Error(`学习${next.level}级生产技能需要角色${next.lv}级。`);
    if (state.exp < next.exp) throw new Error(`需要当前技能${next.exp}点成功制造经验。`);
    checkPayment(p, next.gold, {});
    commitPayment(p, next.gold, {});
    skills[params.skill] = { level: next.level, exp: 0 };
    p.production = skills;
    result = { action, skill: params.skill, level: next.level, gold: next.gold, consumed: {}, received: {},
      message: `${PRODUCTION_SKILLS[params.skill].name}升至${next.level}级，经验归零；训练门槛和${next.gold}金币为本作适配。` };
  } else if (action === 'manufactureMachine') {
    const before = p.items?.ttMachine ?? 0;
    if (!Number.isSafeInteger(before) || before < 0 || before >= 1e7) throw new Error('千机材数量已达上限或数据无效。');
    checkPayment(p, MACHINE_RECIPE.gold, MACHINE_RECIPE.materials);
    commitPayment(p, MACHINE_RECIPE.gold, MACHINE_RECIPE.materials);
    p.items.ttMachine = before + 1;
    result = { action, gold: MACHINE_RECIPE.gold, consumed: structuredClone(MACHINE_RECIPE.materials), received: { ttMachine: 1 },
      message: '加工获得1份千机材；一、二档矿木用量与金币为本作适配，不增加装备制造经验。' };
  } else {
    if (params.confirm !== true) throw new Error('制造及前身消耗需要明确确认。');
    if (own(params, 'inherit') && typeof params.inherit !== 'boolean') throw new Error('继承选项必须是布尔值。');
    const recipe = getProductionRecipe(params.recipeId, p.cls);
    if (!recipe) throw new Error('制造配方不存在。');
    if (!Array.isArray(p.bag) || p.bag.length > BAG_LIMIT) throw new Error('装备背包数据无效。');
    if (p.lv < recipe.playerLv) throw new Error(`制造需要角色${recipe.playerLv}级。`);
    if (skills[recipe.skill].level < recipe.skillLevel) throw new Error(`需要${recipe.skillLevel}级${PRODUCTION_SKILLS[recipe.skill].name}。`);
    if (skills[recipe.skill].exp >= 1e7) throw new Error('制造经验已达上限，请先训练。');
    if (!recipe.from && (own(params, 'uid') || params.inherit === true)) throw new Error('根配方没有前身，不能指定装备或继承。');
    const predecessor = recipe.from ? ownedPredecessor(p, recipe, params.uid) : null;
    if (!predecessor && p.bag.length >= BAG_LIMIT) throw new Error('背包已满。');
    const inherit = params.inherit === true;
    const target = gearSpec(recipe.slot, recipe.lv, recipe.series === 'ordinary' ? 1 : 3, p.cls, optionsFor(recipe));
    const maxHoles = target.slot === 'weapon' ? 2 : ['head', 'body', 'legs', 'feet', 'wrist'].includes(target.slot) ? 4 : 0;
    if (inherit && (predecessor.sockets.length > maxHoles || predecessor.durability > 100)) throw new Error('前身孔位或耐久无法继承至目标。');
    if (inherit && predecessor.sockets.filter(Boolean).some((id) => gemRequiredGrade(id, ITEMS[id]) > target.grade)) throw new Error('继承宝石的所需品阶高于目标装备。');
    const materials = { ...recipe.materials };
    const qiankun = inherit ? inheritanceCost(predecessor) : 0;
    if (qiankun) materials.qiankun = (materials.qiankun || 0) + qiankun;
    checkPayment(p, recipe.gold, materials);
    const q = recipe.series === 'ordinary' ? (Math.random() < 0.1 ? 2 : 1) : 3;
    const equipment = makeEquip(recipe.slot, recipe.lv, q, p.cls, { ...optionsFor(recipe), origin: `production:${recipe.id}` });
    if (predecessor) {
      equipment.uid = predecessor.uid;
      equipment.bound = predecessor.bound;
      if (inherit) for (const key of ['refine', 'sockets', 'durability']) equipment[key] = structuredClone(predecessor[key]);
    }
    validateEquipment(equipment);
    if (!matchesGearSpec(equipment)) throw new Error('生成装备与生产规格不符。');
    if (!predecessor && [...p.bag, ...Object.values(p.equipment || {})].some((it) => it?.uid === equipment.uid)) throw new Error('新装备UID冲突，请重试。');
    const index = predecessor ? p.bag.indexOf(predecessor) : p.bag.length;
    result = { action, recipeId: recipe.id, uid: equipment.uid, equipment: structuredClone(equipment),
      gold: recipe.gold, consumed: materials, consumedUid: predecessor?.uid ?? null, received: {}, inherit, inheritanceQiankun: qiankun,
      message: `制造获得${equipment.name}；材料、金币与品质为本作适配。${predecessor ? inherit
        ? `前身已消耗，培养继承消耗${qiankun}乾坤石（含本作孔/宝石适配费用）。`
        : '前身已消耗；未选择继承，精炼与宝石丢失，新孔位重新生成，不返还宝石。' : ''}` };
    commitPayment(p, recipe.gold, materials);
    if (predecessor) p.bag[index] = equipment;
    else p.bag.push(equipment);
    skills[recipe.skill].exp++;
    p.production = skills;
  }
  game.event?.(result.message);
  return result;
}
