import type { ClassDef, ClassId, RawRow, SkillDef } from './types';
import charstats from './data/raw/charstats.json';
import skills from './data/raw/skills.json';
import skilldesc from './data/raw/skilldesc.json';
import experience from './data/raw/experience.json';
import weapons from './data/raw/weapons.json';
import armor from './data/raw/armor.json';
import misc from './data/raw/misc.json';
import ItemStatCost from './data/raw/ItemStatCost.json';
import MagicPrefix from './data/raw/MagicPrefix.json';
import MagicSuffix from './data/raw/MagicSuffix.json';
import MonLvl from './data/raw/MonLvl.json';
import Runes from './data/raw/Runes.json';
import SetItems from './data/raw/SetItems.json';
import Sets from './data/raw/Sets.json';
import SuperUniques from './data/raw/SuperUniques.json';
import TreasureClassEx from './data/raw/TreasureClassEx.json';
import UniqueItems from './data/raw/UniqueItems.json';
import difficultylevels from './data/raw/difficultylevels.json';
import hireling from './data/raw/hireling.json';
import itemratio from './data/raw/itemratio.json';
import monstats from './data/raw/monstats.json';
import Missiles from './data/raw/Missiles.json';
import LvlMaze from './data/raw/LvlMaze.json';
import ItemTypes from './data/raw/ItemTypes.json';
import Properties from './data/raw/Properties.json';
import Levels from './data/raw/Levels.json';
import belts from './data/raw/belts.json';
import cubemain from './data/raw/cubemain.json';
import gamble from './data/raw/gamble.json';
import gems from './data/raw/gems.json';
import objects from './data/raw/objects.json';
import automagic from './data/raw/automagic.json';
import shrines from './data/raw/shrines.json';

// LoD 1.14d, blizzhackers/d2data commit 0edfaf6d006f2eb82857c066e07ce03614285981.
// Only data/raw is imported; source URLs/hashes remain in data/provenance.json.
// The static fallback allows tsx/node:test to load the same data without Vite.
const knownTables: Record<string, unknown> = {
  charstats, skills, skilldesc, experience, weapons, armor, misc, ItemStatCost,
  MagicPrefix, MagicSuffix, MonLvl, Runes, SetItems, Sets, SuperUniques,
  TreasureClassEx, UniqueItems, difficultylevels, hireling, itemratio, monstats,
  Missiles, LvlMaze, ItemTypes, Properties, Levels, belts, cubemain, gamble, gems, objects, automagic, shrines,
};
const importedTables = (() => {
  try {
    return import.meta.glob('./data/raw/*.json', { eager: true, import: 'default' });
  } catch {
    return Object.fromEntries(Object.entries(knownTables).map(([name, rows]) => [`./data/raw/${name}.json`, rows]));
  }
})();
export const rawTables: Record<string, RawRow[]> = Object.fromEntries(
  Object.entries(importedTables).map(([path, rows]) => [
    path.slice(path.lastIndexOf('/') + 1, -5),
    Object.values(rows as Record<string, RawRow>),
  ]),
);
export function rawRows(name: string): RawRow[] {
  const key = Object.keys(rawTables).find(key => key.toLowerCase() === name.toLowerCase());
  return key === undefined ? [] : rawTables[key];
}
export function text(row: RawRow, key: string, fallback = ''): string {
  const value = row[key];
  if (value === undefined || value === null || value === '') return fallback;
  let result = String(value).trim();
  // The pinned mirror wraps some formula strings in another pair of JSON quotes.
  if (result.startsWith('"') && result.endsWith('"')) {
    try { result = String(JSON.parse(result)); }
    catch { result = result.slice(1, -1); }
  }
  return result;
}
export function num(row: RawRow, key: string, fallback = 0): number {
  const value = text(row, key);
  if (!value) return fallback;
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

const classPresentation: [ClassId, string, string, string, string, string[]][] = [
  ['ama', 'Amazon', '亚马逊', '精通弓弩与标枪，以敏捷和战斗技巧守护群岛。', '#c7ad58', ['弓与弩', '被动与魔法', '标枪与长矛']],
  ['sor', 'Sorceress', '法师', '驾驭火焰、闪电与冰冷，以元素法术击溃敌人。', '#78b9dd', ['火焰法术', '闪电法术', '冰冷法术']],
  ['nec', 'Necromancer', '死灵法师', '掌握召唤、毒素与白骨，以诅咒维系生死的平衡。', '#88b88c', ['诅咒', '毒素与白骨', '召唤法术']],
  ['pal', 'Paladin', '圣骑士', '凭借战斗技巧与神圣光环抵御黑暗。', '#e0ce89', ['战斗技能', '攻击灵气', '防御灵气']],
  ['bar', 'Barbarian', '野蛮人', '以武器专精、战吼与强健体魄捍卫圣山。', '#c17a62', ['战斗技能', '战斗专家', '战吼']],
  ['dru', 'Druid', '德鲁伊', '召唤自然盟友，操纵元素并变身为野兽。', '#aaae65', ['召唤', '变形', '元素']],
  ['ass', 'Assassin', '刺客', '融合武学、暗影修行与陷阱，猎杀失控的魔法。', '#b291bf', ['陷阱', '暗影训练', '武学']],
];
export const CLASSES: ClassDef[] = classPresentation.map(([id, english, name, description, color, trees]) => {
  const row = rawRows('charstats').find(row => text(row, 'class') === english);
  if (!row) throw new Error(`Missing pinned CharStats record: ${english}`);
  return {
    id, english, name, description, color, trees,
    strength: num(row, 'str'), dexterity: num(row, 'dex'), vitality: num(row, 'vit'), energy: num(row, 'int'),
    life: num(row, 'vit') + num(row, 'hpadd'), mana: num(row, 'int'), stamina: num(row, 'stamina'),
    lifePerLevel: num(row, 'LifePerLevel') / 4, manaPerLevel: num(row, 'ManaPerLevel') / 4,
    staminaPerLevel: num(row, 'StaminaPerLevel') / 4, lifePerVitality: num(row, 'LifePerVitality') / 4,
    manaPerEnergy: num(row, 'ManaPerMagic') / 4, staminaPerVitality: num(row, 'StaminaPerVitality') / 4,
    blockFactor: num(row, 'BlockFactor'), arFactor: num(row, 'ToHitFactor'), weapon: text(row, 'item1'),
  };
});

const chineseNames: Record<number, string> = {};
const skillNamesByClass: [number, string][] = [
  [6, '魔法箭|火焰箭|内视|致命攻击|戳刺|冰箭|多重箭|闪避|威力一击|毒枪|爆裂箭|慢速箭|躲避|刺爆|闪电球|急冻箭|导引箭|刺入|充能一击|瘟疫标枪|炮轰|牺牲之箭|诱饵|回避|击退|冻结之箭|女武神|穿刺|闪电攻击|闪电之怒'],
  [36, '火弹|暖气|充能弹|冰弹|冰封装甲|地狱之火|静态力场|心灵传动|霜之新星|冰风暴|烈焰之径|火球|新星|闪电|碎冰甲|火墙|强化|连锁闪电|传送|冰尖柱|陨石|雷云风暴|能量护盾|暴风雪|寒冰装甲|支配火焰|九头海蛇|支配闪电|冰封球|支配冰冷'],
  [66, '伤害加深|牙|白骨装甲|骷髅支配|骷髅复生|微暗灵视|削弱|淬毒匕首|尸体爆炸|黏土石魔|攻击反噬|恐惧|骨墙|石魔支配|骷髅法师|迷乱|偷取生命|毒爆|骨矛|鲜血石魔|吸引|衰老|骨牢|召唤抵抗|钢铁石魔|降低抵抗|剧毒新星|骨魂|火焰石魔|重生'],
  [96, '牺牲|重击|力量|祈祷|抵抗火焰|圣光弹|圣火|荆棘|反抗|抵抗冰冷|白热|冲锋|祝福瞄准|净化|抵抗闪电|复仇|祝福之锤|专注|圣冰|活力|转换|神圣之盾|圣雷|庇护所|冥想|天堂之拳|狂热|信念|救赎|救助'],
  [126, '重击|剑支配|斧支配|钉头锤支配|狂嗥|寻找药剂|跳跃|双手挥击|长柄武器支配|投掷支配|长矛支配|嘲弄|大叫|击昏|双手投掷|增加耐力|寻找物品|跳跃攻击|专心|铁布衫|战嗥|狂乱|加速|战斗体制|残酷吓阻|旋风|狂战士|自然抵抗|战斗狂嗥|战斗指挥'],
  [221, '乌鸦|猛毒花藤|狼人变化|变形术|火风暴|橡木智者|召唤灵狼|熊人变化|熔浆巨岩|极地风暴|食尸藤|野性狂暴|撞锤|火山爆|飓风装甲|狼獾之心|召唤狂狼|狂犬病|焰爪|小旋风|太阳藤|饥饿|震波|火山|龙卷风|棘灵|召唤灰熊|狂怒|毁天灭地|暴风'],
  [251, '火焰爆震|利爪支配|心灵战锤|虎击|龙爪|雷电网|刃之守卫|速度爆发|焰拳|双龙爪|电能守卫|火焰复生|武器格挡|魔影斗篷|眼镜蛇攻击|刃之怒|能量消解|影子战士|雷电爪|神龙摆尾|雷光守卫|复生狱火|心灵爆震|寒冰刃|飞龙在天|亡者守卫|刀刃之盾|毒牙|影子大师|凤凰攻击'],
];
for (const [start, names] of skillNamesByClass) {
  names.split('|').forEach((name, i) => { chineseNames[start + i] = name; });
}

// Support means the effect can be represented by the current engine contract,
// not that the original animation/collision routines have been reverse engineered.
const implemented: Record<number, string> = {
  9: '普通攻击的被动双倍物理伤害；有效等级递减公式，不能与致命攻击叠成四倍。',
  37: '暖气回复加成与装备相加；按 25Hz 和 1/256 法力双重取整回复。',
  23: '被动增加命中率；已纳入角色属性。',
  36: '单枚火弹；五段成长、硬点协同及定点伤害。',
  39: '单枚冰弹；冰冷伤害与冰冷持续帧数。',
  47: '火球命中后爆炸；伤害与硬点协同，碰撞为 H5 近似。',
  54: '传送至合法目标；最低蓝耗 1，逐级减少蓝耗。',
  141: '被动增加最大耐力；已纳入角色属性。',
  145: '被动增加防御；已纳入角色属性。',
  153: '被动增加四系抗性，按整数递减公式计算。',
  251: '投掷火焰炸弹；爆炸半径 5 子格，抛物线为 H5 近似。',
};
const missingBehaviors: Record<number, string> = {
  6: '需要物理/魔法双通道转换与弓弩命中处理。',
  7: '需要武器物理伤害与火焰转换双通道。',
  10: '需要三次动作帧、逐击命中与序列回滚。',
  11: '需要武器伤害参与及物理/冰冷转换。',
  38: '需要随机曲折弹道、逐弹碰撞与散射。',
  44: '需要扩张新星弹环及 4 帧 NextDelay 碰撞限制。',
  45: '冻结、首领免冻与目标冷效规则尚未实现。',
  48: '需要扩张新星弹环及 4 帧 NextDelay 碰撞限制。',
  49: '需要穿透弹道与闪电专用施法断点。',
  56: '陨石延迟落地与持续地火为不同伤害通道。',
  59: '需要随机落冰、独立碰撞与持续区域调度。',
  61: '法术伤害计算包含支配加成，但完整火焰属性处理尚未接入角色属性。',
  63: '法术伤害计算包含支配加成，但完整闪电属性处理尚未接入角色属性。',
  64: '冰封球的旋转发射、终点爆发及多次命中未实现。',
  66: '需要物理抗性诅咒、免疫破除的五分之一效率与诅咒互斥。',
  67: '需要扇形多弹与 4 帧 NextDelay，不能用同目标多击替代。',
  70: '需要消耗尸体、骷髅上限、支配与独立召唤生命属性。',
  75: '需要石魔互斥、缓速命中、支配与难度生命成长。',
  84: '骨矛需要穿透弹道及独立碰撞目标记录。',
  96: '需要按最终物理伤害扣除施术者生命。',
  97: '需要盾击伤害、必中、击退、昏迷与特殊物品处理。',
  102: '光环脉冲与附加武器火伤尚未同时接入；伤害字段为每次脉冲。',
  106: '需要多次独立命中、序列帧回滚及首尾动作。',
  114: '圣冰需要独立缓速、脉冲与附加武器冰伤。',
  118: '圣雷需要独立脉冲与附加武器闪电伤害。',
  126: '伤害公式已提供；击退、命中加成和动作帧未接入。',
  139: '需要击昏资格、首领例外、命中加成与恢复状态。',
  148: '技能移动速度与物品 FRW 必须分开；当前属性协议只提供物品 FRW。',
  221: '需要乌鸦致盲、攻击次数与不可被攻击的宠物状态。',
  225: '需要三条随机火流与逐帧碰撞，不能用瞬时范围伤害替代。',
  227: '需要狼群上限、动物互斥及有效等级相互协同。',
  229: '需要滚动碰撞、击退和物理/火焰双通道。',
  234: '需要地裂分布、持续碰撞与 NextDelay。',
  253: '需要必中目标、物理/魔法双通道及分目标击退概率。',
};
const classIds = new Set(CLASSES.map(def => def.id));
const skillRows = rawRows('skills');
const idsByName = new Map(skillRows.map(row => [text(row, 'skill').toLowerCase(), num(row, 'Id')]));
const descriptors = new Map(rawRows('skilldesc').map(row => [text(row, 'skilldesc').toLowerCase(), row]));
export const SKILLS: SkillDef[] = skillRows
  .filter(row => classIds.has(text(row, 'charclass') as ClassId))
  .map(raw => {
    const id = num(raw, 'Id');
    const desc = descriptors.get(text(raw, 'skilldesc').toLowerCase());
    if (!desc) throw new Error(`Missing pinned SkillDesc record for skill ${id}`);
    const prerequisites = ['reqskill1', 'reqskill2', 'reqskill3'].flatMap(key => {
      const name = text(raw, key);
      if (!name) return [];
      const prerequisite = idsByName.get(name.toLowerCase());
      if (prerequisite === undefined) throw new Error(`Unknown prerequisite ${name} for skill ${id}`);
      return [prerequisite];
    });
    const reason = missingBehaviors[id] ?? (num(raw, 'passive')
      ? '被动数据已收录，但该效果尚未纳入角色属性或战斗处理。'
      : '技能数据已收录；专用服务器行为、状态与碰撞尚未实现。');
    return {
      id, key: text(raw, 'skill'), name: chineseNames[id] ?? text(raw, 'skill'),
      classId: text(raw, 'charclass') as ClassId,
      tree: Math.max(0, num(desc, 'SkillPage', 1) - 1), level: num(raw, 'reqlevel', 1),
      prerequisites, row: Math.max(0, num(desc, 'SkillRow', 1) - 1), column: Math.max(0, num(desc, 'SkillColumn', 1) - 1),
      raw, supported: id in implemented,
      description: implemented[id] ?? `未实现：${reason}`,
    };
  }).sort((a, b) => a.id - b.id);

export const EXPERIENCE: number[] = Array(100).fill(0);
for (const row of rawRows('experience')) {
  const level = num(row, 'Level', -1);
  if (level >= 1 && level <= 98) EXPERIENCE[level + 1] = num(row, 'Amazon');
}
export function getClass(id: ClassId): ClassDef {
  const def = CLASSES.find(def => def.id === id);
  if (!def) throw new Error(`Unknown class: ${id}`);
  return def;
}
const skillsById = new Map(SKILLS.map(skill => [skill.id, skill]));
export function getSkill(id: number): SkillDef | undefined {
  return skillsById.get(id);
}
