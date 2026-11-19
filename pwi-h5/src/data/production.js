import { CLASSES } from './classes.js';
import { NAMED_EQUIPMENT } from './named-equipment.js';

function freezeTree(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

const material = (name, desc) => ({ name, type: 'material', price: 0, lv: 1, desc });
const gathering = '本作采集/制造资源；三档材料与用量为有限适配，不是端游完整材料表。';
export const LUNAR_MATERIAL_IDS = freezeTree(Object.fromEntries([...new Set(Object.values(NAMED_EQUIPMENT)
  .filter((t) => t.series === 'lunar').flatMap((t) => t.materials.map((m) => m.name)))].sort().map((name) =>
  [name, `lunar-material:${Array.from(name).map((char) => char.codePointAt(0).toString(16)).join('-')}`])));
export const LUNAR_MATERIAL_DROPS = freezeTree(Object.fromEntries(Object.values(LUNAR_MATERIAL_IDS).map((id) => [id, 1])));
export const PRODUCTION_MATERIALS = freezeTree({
  ...Object.fromEntries(Object.entries(LUNAR_MATERIAL_IDS).map(([name, id]) => [id,
    material(name, '历史神月配方的原文具名材料；神月最终首领每种1份的分配与数量是明确本作适配，不是官方掉落表。')])),
  ore1: material('铁矿', gathering), wood1: material('原木', gathering),
  fiber1: material('棉线', gathering), hide1: material('动物皮毛', gathering),
  ore2: material('精铁', gathering), wood2: material('硬木', gathering),
  fiber2: material('丝线', gathering), hide2: material('粗皮', gathering),
  ore3: material('合金钢', gathering), wood3: material('高级木料', gathering),
  fiber3: material('金丝', gathering), hide3: material('高级皮料', gathering),
  tt1: material('黄昏一章材料（本作汇总）', '黄昏材料汇总适配；本作配方用量不是官方逐件配方。'),
  tt2: material('黄昏二章材料（本作汇总）', '黄昏材料汇总适配；本作配方用量不是官方逐件配方。'),
  tt3: material('黄昏三章材料（本作汇总）', '黄昏材料汇总适配；本作配方用量不是官方逐件配方。'),
  ttSoul: material('黄昏剑魂（本作汇总）', '仍可由历史v1未绑定黄昏装备分解取得；聚合与数量为本作适配。未经核实的黄昏前身链不列新具名制造配方。'),
  ttMachine: material('千机材', '以一、二档矿木材料加工；加工金币及数量为本作适配，不是端游完整配方。'),
  lunarEssence: material('神月精华（本作汇总）', '历史汇总材料栈保留；不能替代新具名神月配方的原文精确材料。'),
  uncanny: material('灵性水晶', '历史材料栈及本地副本奖励保留；未核实轮回具名前身链，不列新制造配方。'),
  rapture: material('异象水晶', '历史材料栈及本地副本奖励保留；未核实轮回具名前身链，不列新制造配方。'),
  dragonOrb1: { name: '一星龙珠', type: 'refineAid', price: 0, lv: 1,
    desc: '只保证下一目标精炼等级为+1的那次精炼成功（当前必须+0）；不会跳级，也不能保证+2或更高目标。' },
});

export const PRODUCTION_SKILLS = freezeTree({
  blacksmith: { name: '铁匠' }, tailor: { name: '裁缝' }, craftsman: { name: '巧匠' },
});
// 等级门槛、每级前置5次成功制造、金币及重置经验均为本作适配。
export const PRODUCTION_LEVELS = freezeTree([
  { level: 1, lv: 1, exp: 0, gold: 0 },
  { level: 2, lv: 20, exp: 5, gold: 500 },
  { level: 3, lv: 40, exp: 5, gold: 1500 },
  { level: 4, lv: 60, exp: 5, gold: 4000 },
  { level: 5, lv: 80, exp: 5, gold: 10000 },
  { level: 6, lv: 99, exp: 5, gold: 25000 },
]);
export const ORDINARY_RECIPE_LEVELS = freezeTree([1, 30, 60]);
// 原官方精炼转移乾坤石表：目标被覆盖，不叠加。索引是源精炼等级。
export const QIANKUN_TRANSFER_COSTS = freezeTree([0, 1, 5, 12, 28, 60, 80, 100, 150, 250, 400, 650, 1000]);
export const MACHINE_RECIPE = freezeTree({ gold: 100, materials: { ore1: 2, wood1: 2, ore2: 2, wood2: 2 }, received: { ttMachine: 1 } });
export const PRODUCTION_ADAPTATION = freezeTree({
  scope: '有限具名配方：本地训练装备与来源精确神月装备；普通来源未记材料，不列制造；高阶神铸另走独立系统。',
  materials: '神月逐件材料名称与数量逐字使用来源；旧黄昏/神月汇总材料栈仍有效，但不能抵扣具名材料。训练材料、金币和千机材用量是本作适配。',
  drops: '神月最终首领每种已接入具名材料各1份；分配、数量与保留的历史汇总奖励均为本地规则，不是官方掉落表。',
  training: '三种技能初始1级，成功制造经验+1；升2—6级分别需角色20/40/60/80/99级及当前技能经验5，付费后经验归零。可重复制作明确本地训练装备积累经验。',
  quality: '新具名装备q0仅旧界面记账，制造不随机品质或星数、不按请求q乘属性；只有原文范围字段在创建时独立掷一次。',
  twilight: '档案前身链未核全，移出实际新制造配方；不从系列/等级公式臆造具名黄昏链。旧存档保留。',
  nirvana: '未核实精确具名前身链，不列新制造；水晶和历史装备栈兼容保留，不用泛化同系列等级替代模板身份。',
  inheritance: '不默认继承。显式继承收费：官方精炼转移表的对应乾坤石数 + 已开孔数×2 + 宝石所需品阶之和；后两项是本作适配，不是官方轮回继承系数表。不继承丢失精炼/宝石并使用新生成孔位，不返还丢失宝石；前身绑定始终保留。',
  transfer: '精炼转移仅采用已核官方+1—+12乾坤石数量；源精炼大于目标，绑定源只能转至绑定目标，转后源归零、目标覆盖。',
  sources: [
    'https://w2i.wanmei.com/news/gamenews/20100316/45437.shtml',
    'https://w2i.wanmei.com/intro/guide_fb/20091103/36730.shtml',
    'https://w2i.wanmei.com/xtjs/jlxt/20091020/30166.shtml',
  ],
});

export function productionState(p) {
  return Object.fromEntries(Object.keys(PRODUCTION_SKILLS).map((skill) => [skill, {
    level: p?.production?.[skill]?.level ?? 1, exp: p?.production?.[skill]?.exp ?? 0,
  }]));
}

// 采集和制造使用同一材料分档；不是生产技能等级。
export function productionTier(lv) {
  if (!Number.isInteger(lv) || lv < 1 || lv > 105) throw new Error('材料等级必须为1—105。');
  return lv <= 20 ? 1 : lv <= 60 ? 2 : 3;
}
const skillLevel = (lv) => lv < 20 ? 1 : lv < 40 ? 2 : lv < 60 ? 3 : lv < 80 ? 4 : lv < 99 ? 5 : 6;
const armorSlots = ['head', 'body', 'legs', 'feet', 'wrist'];
function namedRecipe(template) {
  const { slot, lv } = template, tier = productionTier(lv), level = skillLevel(lv);
  const skill = slot === 'weapon' ? 'blacksmith' : armorSlots.includes(slot) || slot === 'cape' ? 'tailor' : 'craftsman';
  let primary = 'ore', secondary = 'wood';
  if (skill === 'tailor') {
    primary = template.armorType === 'robe' || slot === 'cape' ? 'fiber' : 'hide';
    secondary = template.armorType === 'heavy' ? 'ore' : primary === 'hide' ? 'fiber' : 'hide';
  } else if (skill === 'craftsman') secondary = 'hide';
  const materials = template.series === 'lunar' ? Object.fromEntries(template.materials.map(({ name, qty }) => [LUNAR_MATERIAL_IDS[name], qty]))
    : { [`${primary}${tier}`]: 2 * level, [`${secondary}${tier}`]: level };
  return {
    id: `named:${template.templateId}`, templateId: template.templateId, name: template.name,
    series: template.series, lv, slot, skill, skillLevel: level, playerLv: lv,
    weaponType: template.weaponType, armorType: template.armorType,
    gold: 30 + lv * level * 10, materials, from: null, inheritance: false, qualities: [template.q],
    adaptation: template.series === 'lunar' ? '材料名称与数量为原文逐件精确值；金币、生产技能门槛、材料获取分配及回合战斗为本作适配。'
      : '明确本作训练配方；材料、用量、金币、技能门槛均为本地规则，非官方制造。',
  };
}
export function getProductionRecipes(cls) {
  if (typeof cls !== 'string' || !Object.hasOwn(CLASSES, cls)) throw new Error('生产职业无效。');
  const c = CLASSES[cls];
  return Object.values(NAMED_EQUIPMENT).filter((t) => !t.referenceOnly
    && (t.series === 'local-tutorial' || t.series === 'lunar' && t.materials.length > 0)
    && (t.slot !== 'weapon' || t.weaponType === c.weapon && t.classes.includes(cls))
    && (!armorSlots.includes(t.slot) || t.armorType === c.armor)
    && (t.slot !== 'ring1' || t.series === 'lunar' || t.type === `${c.atkType}Ring`))
    .sort((a, b) => a.lv - b.lv || a.templateId.localeCompare(b.templateId)).map(namedRecipe);
}
export function getProductionRecipe(id, cls) {
  if (typeof id !== 'string') return null;
  return getProductionRecipes(cls).find((recipe) => recipe.id === id) ?? null;
}

export function gemRequiredGrade(id, gem) {
  if (gem?.requiredGrade !== undefined) {
    if (!Number.isInteger(gem.requiredGrade) || gem.requiredGrade < 1 || gem.requiredGrade > 19) throw new Error('宝石品阶需求无效。');
    return gem.requiredGrade;
  }
  const tier = Number(/([123])$/.exec(id)?.[1]);
  if (![1, 2, 3].includes(tier)) throw new Error('宝石品阶需求未定义。');
  return [0, 1, 5, 8][tier];
}
