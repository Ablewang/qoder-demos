import { CLASSES } from './classes.js';

// 仅录入已核官方原图的具名装备；获取成本与回合制参数均为本作适配。
const AXE_CLASSES = ['blademaster', 'wizard', 'psychic', 'venomancer', 'barbarian', 'assassin', 'archer', 'cleric'];
for (const id of [...AXE_CLASSES, 'mystic']) {
  if (!Object.hasOwn(CLASSES, id)) throw new Error(`高阶装备职业不存在：${id}`);
}
const AXE_SOURCE = [
  'https://w2i.games.wanmei.com/news/bulletin/20260522/88911.shtml',
  'https://w2i.games.wanmei.com/news/bulletin/20260608/88940.shtml',
];

export const HIGH_ADAPTATION = {
  source: '名称、品阶、阶段、等级、属性需求、武器职业限制、攻击区间、固定附加属性来自所列官方原图；未核数据不冒称官方。',
  attackRanges: '保留官方攻击上下限；base.patk/matk为区间算术平均值，供属性模型使用，战斗攻击区间由本作模型处理。',
  time: '端游秒制不能直接等同回合制；持续特效采用所列本作回合时长，不模拟端游8秒、10秒或5秒计时。',
  effects: '本作触发率均20%：蚀心斩破双防90%至下一合法回合结束；重霄劫暴击率+30个百分点、暴伤倍率+0.3两回合（含本轮）；狂天神/炽灭魂单次双倍。受击太清咒免暴减伤50%且连击系数+2延续至下一合法回合结束、风残影使后续攻击无伤、磐龙甲抵消后续强攻额外50%伤害、婆娑体使后续敌人失去目标，防御效果均到下回合开始。无玩家负面状态净化或秒制计时。所有概率和换算为本作适配。',
  huntLevel: '猎魔等级保留原图数值；其对副本伤害的具体换算为本作规则，不代表端游公式。',
  spirit: '气魄保留原图数值；攻防换算为本作规则，不代表端游公式。',
  creation: '创世等级保留原图数值；实际作用采用本作规则，不猜测端游公式或额外特殊效果。',
  defense: '本作将五行防御合并为法术防御；通天者法袍五行防御各2515，记录mdef=2515，不相加。',
  sockets: '武器原图初始2孔，本作最多4孔；法袍初始4孔及100耐久为本作适配，原图耐久未核。',
  cultivation: '城镇105级神铸兑换与逐阶培养、神铸凭证及金币成本均为本作获取规则，不是官方配方。升阶仅限行囊，保留精炼、孔位、绑定和当前耐久。',
};

function axe(id, name, stage, range, huntLevel, attackLevel, str, spirit, patk, effects = []) {
  return {
    id, name, grade: 19, stage, slot: 'weapon', armorType: null, lv: 105,
    requirements: { str: 300, dex: 50 }, classes: [...AXE_CLASSES],
    attackRanges: { patk: range }, base: { patk: (range[0] + range[1]) / 2, huntLevel },
    addons: { attackLevel, defenseLevel: 80, str, spirit, patk, crit: 0.05, creation: 1 },
    maxDurability: 430, socketLimit: 4, initialSockets: 2, effects, source: [...AXE_SOURCE],
    adaptation: '武器基础攻击采用官方区间均值；初始2孔与430耐久来自原图，最多4孔为本作适配。未列出的特殊效果尚未核实，无额外战斗效果；已列效果采用HIGH_ADAPTATION中的本作参数。',
  };
}

export const HIGH_EQUIPMENT = {
  axe19a: axe('axe19a', '★枯荣', 1, [1439, 3357], 600, 100, 45, 250, 250, [
    { id: 'shixinzhan', name: '蚀心斩', description: '本作适配：命中时20%概率令目标双防降低90%，持续至下一合法回合结束，不模拟官方8秒效果。' },
    { id: 'taiqingzhou', name: '太清咒', description: '本作适配：受击20%概率使本轮后续伤害减半且免暴，至下回合开始；连击系数+2延续至下一合法回合结束；未实现玩家负面状态净化，不模拟5秒效果。' },
  ]),
  axe19b: axe('axe19b', '★★逝川归', 2, [1525, 3558], 700, 120, 50, 300, 300, [
    { id: 'zhongxiaojie', name: '重霄劫', description: '本作适配：命中时20%概率提升暴击率30个百分点及暴伤倍率0.3，持续2回合，不模拟官方10秒效果。' },
    { id: 'fengcanying', name: '风残影', description: '本作适配：受击20%概率使本轮后续敌人攻击无伤，至下回合开始，不模拟官方5秒效果。' },
  ]),
  axe19c: axe('axe19c', '★★★千古一色', 3, [1647, 3843], 800, 140, 55, 350, 350, [
    { id: 'kuangtianshen', name: '狂天神', description: '本作适配：攻击命中时20%概率造成双倍伤害，非官方概率公式。' },
    { id: 'panlongjia', name: '磐龙甲', description: '本作适配：受击时20%概率免疫本轮后续强攻的额外50%冲击伤害，至下回合开始；不是端游全部负面效果免疫。' },
  ]),
  sword18b: {
    id: 'sword18b', name: '沉天踏绛气·浩然', grade: 18, stage: 2, slot: 'weapon', armorType: null, lv: 105,
    requirements: { str: 50, mag: 300 }, classes: [...AXE_CLASSES, 'mystic'],
    attackRanges: { patk: [972, 1457], matk: [1768, 2161] }, base: { patk: 1214.5, matk: 1964.5 },
    addons: { attackLevel: 80, defenseLevel: 80, mag: 40, spirit: 200, crit: 0.05, channel: 0.12, creation: 1 },
    maxDurability: 430, socketLimit: 4, initialSockets: 2,
    effects: [
      { id: 'chimiehun', name: '炽灭魂', description: '本作适配：攻击命中时20%概率造成双倍伤害，非官方概率公式。' },
      { id: 'posuati', name: '婆娑体', description: '本作适配：受击时20%概率使本轮后续敌人失去目标，至下回合开始；不模拟端游5秒免控效果。' },
    ],
    source: ['https://w2i.wanmei.com/news/bulletin/20201116/83189.shtml'],
    adaptation: '基础攻击为官方区间均值；初始2孔与430耐久来自原图，最多4孔为本作适配。固定具名效果采用本作20%概率及1回合时长，不等同端游规则。',
  },
  robe17c: {
    id: 'robe17c', name: '★★★通天者法袍·正气', grade: 17, stage: 3, slot: 'body', armorType: 'robe', lv: 105,
    requirements: { str: 57, mag: 161 }, classes: null, attackRanges: {}, base: { def: 349, mdef: 2515 },
    addons: { con: 20, hpPct: 0.05, hp: 250, defenseLevel: 5, crit: 0.03 },
    maxDurability: 100, socketLimit: 4, initialSockets: 4, effects: [],
    source: ['https://w2i.wanmei.com/mobile/mobilebroad/20221114/85515.shtml'],
    adaptation: '五行防御各2515合并为mdef=2515，不是五项总和；4孔和100耐久为本作适配，原图耐久未核。生命上限增幅按本作属性模型计算。未核特殊效果，无额外战斗效果。',
  },
};

export const HIGH_RECIPES = {
  axe19a: { gold: 60000, materials: { highForgeSigil: 60 }, from: null },
  axe19b: { gold: 80000, materials: { highForgeSigil: 80 }, from: 'axe19a' },
  axe19c: { gold: 120000, materials: { highForgeSigil: 120 }, from: 'axe19b' },
  sword18b: { gold: 40000, materials: { highForgeSigil: 40 }, from: null },
  robe17c: { gold: 20000, materials: { highForgeSigil: 20 }, from: null },
};

function freezeTree(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}
freezeTree(HIGH_EQUIPMENT);
freezeTree(HIGH_RECIPES);
freezeTree(HIGH_ADAPTATION);

function same(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]));
}

// 模板身份和固定数据不可变；仅精炼、宝石与当前耐久属于培养状态。
export function matchesHighEquip(it) {
  if (!it || typeof it !== 'object' || typeof it.templateId !== 'string' || !Object.hasOwn(HIGH_EQUIPMENT, it.templateId)) return false;
  const template = HIGH_EQUIPMENT[it.templateId];
  if (it.kind !== 'equip' || it.q !== 4 || it.cls !== null || it.bound !== true || it.setId !== null
    || it.price !== (template.slot === 'weapon' ? 231200 : 20000) || it.rerolls !== 0 || it.upgrades !== 0
    || typeof it.uid !== 'string' || !/^[a-z0-9]+$/i.test(it.uid)
    || !Number.isInteger(it.refine) || it.refine < 0 || it.refine > 12
    || !Number.isInteger(it.durability) || it.durability < 0 || it.durability > template.maxDurability
    || !Array.isArray(it.sockets) || it.sockets.length < template.initialSockets || it.sockets.length > template.socketLimit) return false;
  return Object.entries(template).every(([key, value]) => Object.hasOwn(it, key) && same(it[key], value));
}
