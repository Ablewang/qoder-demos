import { CLASSES } from './classes.js';

function freezeTree(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

const material = (name, desc) => ({ name, type: 'material', price: 0, lv: 1, desc });
const gathering = '本作采集/制造资源；三档材料与用量为有限适配，不是端游完整材料表。';
export const PRODUCTION_MATERIALS = freezeTree({
  ore1: material('铁矿', gathering), wood1: material('原木', gathering),
  fiber1: material('棉线', gathering), hide1: material('动物皮毛', gathering),
  ore2: material('精铁', gathering), wood2: material('硬木', gathering),
  fiber2: material('丝线', gathering), hide2: material('粗皮', gathering),
  ore3: material('合金钢', gathering), wood3: material('高级木料', gathering),
  fiber3: material('金丝', gathering), hide3: material('高级皮料', gathering),
  tt1: material('黄昏一章材料（本作汇总）', '黄昏材料汇总适配；本作配方用量不是官方逐件配方。'),
  tt2: material('黄昏二章材料（本作汇总）', '黄昏材料汇总适配；本作配方用量不是官方逐件配方。'),
  tt3: material('黄昏三章材料（本作汇总）', '黄昏材料汇总适配；本作配方用量不是官方逐件配方。'),
  ttSoul: material('黄昏剑魂（本作汇总）', '实际分解未绑定黄昏装备获得；剑魂聚合与数量为本作适配。黄昏进阶消耗匹配前身，并需其他黄昏装备分解所得的补充剑魂；不是官方逐件配方。'),
  ttMachine: material('千机材', '以一、二档矿木材料加工；加工金币及数量为本作适配，不是端游完整配方。'),
  lunarEssence: material('神月精华（本作汇总）', '神月材料汇总适配；用于本作95级神月武器/上衣根配方。'),
  uncanny: material('灵性水晶', '本作轮回上衣配方使用；保留水晶机制，数量为适配。'),
  rapture: material('异象水晶', '本作轮回武器配方使用；保留水晶机制，数量为适配。'),
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
export const ORDINARY_RECIPE_LEVELS = freezeTree([1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99, 105]);
// 原官方精炼转移乾坤石表：目标被覆盖，不叠加。索引是源精炼等级。
export const QIANKUN_TRANSFER_COSTS = freezeTree([0, 1, 5, 12, 28, 60, 80, 100, 150, 250, 400, 650, 1000]);
export const MACHINE_RECIPE = freezeTree({ gold: 100, materials: { ore1: 2, wood1: 2, ore2: 2, wood2: 2 }, received: { ttMachine: 1 } });
export const PRODUCTION_ADAPTATION = freezeTree({
  scope: '有限可玩配方：普通十栏位、黄昏武器逐阶、神月武器/上衣、两阶段轮回；不是完整官方目录、具名装备或官方逐件配方。',
  materials: '三档采集材料、黄昏/神月汇总材料、所有制造和千机材用量及金币为本作适配；普通生产不使用幻仙石。',
  training: '三种技能初始1级，成功制造经验+1；升2—6级分别需角色20/40/60/80/99级及当前技能经验5，付费后经验归零。',
  quality: '普通制造90% q1、10% q2，特殊系列q3；q是本作品质编码，与星级/官方紫金色阶不作一一对应。',
  twilight: '官方机制参考：特殊材料、剑魂、千机材制造而非掉落成品/铸具。本作根配方用汇总材料，后续必须消耗行囊中匹配的前阶装备作为主剑魂前身，加1份其他黄昏装备分解的补充剑魂（额外聚合成本为适配）；不会把普通装备泛化升级5级。',
  nirvana: '参考黄昏99/神月95前身与水晶轮回；本作两阶段配方和用量有限适配，不宣称每次重铸与官方阶段一一对应。',
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
const slots = ['weapon', ...armorSlots, 'cape', 'neck', 'waist', 'ring1'];
const slotNames = { weapon: '武器', head: '头盔', body: '上衣', legs: '护腿', feet: '鞋子', wrist: '护腕', cape: '披风', neck: '项链', waist: '腰带', ring1: '戒指' };
function baseRecipe(cls, series, lv, slot) {
  const c = CLASSES[cls], tier = productionTier(lv), level = skillLevel(lv);
  const skill = slot === 'weapon' ? 'blacksmith' : armorSlots.includes(slot) || slot === 'cape' ? 'tailor' : 'craftsman';
  let primary = 'ore', secondary = 'wood';
  if (skill === 'tailor') {
    primary = c.armor === 'robe' || slot === 'cape' ? 'fiber' : 'hide';
    secondary = c.armor === 'heavy' && slot !== 'cape' ? 'ore' : primary === 'hide' ? 'fiber' : 'hide';
  } else if (skill === 'craftsman') secondary = 'hide';
  return {
    id: `${series}-${lv}-${slot}`, name: `${series === 'ordinary' ? '普通' : series === 'twilight' ? '黄昏' : series === 'lunar' ? '神月' : series === 'nirvana1' ? '轮回一阶' : '轮回二阶'}${lv}级${slotNames[slot]}（本作配方）`,
    series, lv, slot, skill, skillLevel: level, playerLv: lv,
    weaponType: slot === 'weapon' ? c.weapon : null,
    armorType: armorSlots.includes(slot) ? c.armor : null,
    gold: 30 + lv * level * 10,
    materials: { [`${primary}${tier}`]: 2 * level, [`${secondary}${tier}`]: level },
    from: null, inheritance: false, qualities: series === 'ordinary' ? [1, 2] : [3],
    adaptation: '材料聚合、用量、金币、品质和技能门槛均为本作适配。',
  };
}
function fromFor(recipe, alternatives, cls) {
  return { alternatives, slot: recipe.slot, cls: recipe.slot === 'weapon' ? cls : null,
    weaponType: recipe.weaponType, armorType: recipe.armorType };
}
// 即时派生小目录；不保存成百上千份按职业复制的目录或随机实例。
export function getProductionRecipes(cls) {
  if (typeof cls !== 'string' || !Object.hasOwn(CLASSES, cls)) throw new Error('生产职业无效。');
  const recipes = ORDINARY_RECIPE_LEVELS.flatMap((lv) => slots.map((slot) => baseRecipe(cls, 'ordinary', lv, slot)));
  const twilight = [60, 70, 80, 90, 99];
  twilight.forEach((lv, index) => {
    const recipe = baseRecipe(cls, 'twilight', lv, 'weapon');
    recipe.materials = { ...recipe.materials, [lv <= 70 ? 'tt1' : lv <= 90 ? 'tt2' : 'tt3']: 3 + index * 2, ttMachine: 1 + index };
    if (index) {
      recipe.materials.ttSoul = 1;
      recipe.from = fromFor(recipe, [{ series: 'twilight', lv: twilight[index - 1] }], cls);
      recipe.inheritance = true;
    }
    recipes.push(recipe);
  });
  for (const slot of ['weapon', 'body']) {
    const lunar = baseRecipe(cls, 'lunar', 95, slot);
    lunar.materials.lunarEssence = 8;
    recipes.push(lunar);
    const first = baseRecipe(cls, 'nirvana1', 100, slot);
    first.materials[slot === 'weapon' ? 'rapture' : 'uncanny'] = 10;
    first.from = fromFor(first, [{ series: 'twilight', lv: 99 }, { series: 'lunar', lv: 95 }], cls);
    first.inheritance = true;
    recipes.push(first);
    const second = baseRecipe(cls, 'nirvana2', 100, slot);
    second.materials[slot === 'weapon' ? 'rapture' : 'uncanny'] = 20;
    second.from = fromFor(second, [{ series: 'nirvana1', lv: 100 }], cls);
    second.inheritance = true;
    recipes.push(second);
  }
  return recipes;
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
