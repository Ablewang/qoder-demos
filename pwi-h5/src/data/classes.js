import { CULTIVATION } from './world.js';
import { CLASS_SOURCES, SKILL_SOURCES, SKILL_ADAPTATION, ATTRIBUTE_SOURCE } from './skill-sources.js';

// 五大种族 · 十大职业；数值成长与推荐加点仍为本作规则。
export const ELEMENTS = {
  metal: '金', wood: '木', water: '水', fire: '火', earth: '土',
};

export const RACES = {
  human: {
    name: '人族', desc: '盘古血脉，剑仙城的守护者。擅长刀剑与五行法术，均衡而坚韧。',
    home: 'wanliu', classes: ['blademaster', 'wizard'],
  },
  elf: {
    name: '羽族', desc: '生有双翼的天空之民，栖居积羽城。擅长弓术与辅助神术。',
    home: 'jiyu', classes: ['archer', 'cleric'],
  },
  untamed: {
    name: '兽族', desc: '世居万化城。妖兽可化身白虎，妖精擅长驯兽与毒蛊。',
    home: 'wanhua', classes: ['barbarian', 'venomancer'],
  },
  tideborn: {
    name: '汐族', desc: '深海归来的族群，身怀潮汐之力。擅长暗杀与灵魂秘术。',
    home: 'xidao', classes: ['assassin', 'psychic'],
  },
  earthguard: {
    name: '灵族', desc: '承大地灵气而生的守护者，运用剑意与自然之灵。',
    home: 'lingyuan', classes: ['seeker', 'mystic'],
  },
};

// hpCon/mpMag/accuracyDex/evasionDex 来自官方属性说明442–490行。
// base/auto/hpLv/mpLv及后续公式、上限、取整、推荐加点仍为本作适配。
// desc/role 为官方职业介绍与普通技能记录支持的玩法摘要及本作建议。
export const CLASSES = {
  blademaster: {
    name: '武侠', race: 'human', role: '近战物理 · 控制与群攻', weapon: 'blade', atkType: 'phys', atkStat: 'str',
    base: { str: 7, con: 6, dex: 5, mag: 2 }, auto: { str: 3, con: 1, dex: 1, mag: 0 },
    hpCon: 15, mpMag: 9, accuracyDex: 10, evasionDex: 10, hpLv: 30, mpLv: 18, armor: 'heavy',
    desc: '精于兵器与御气，近身伤敌；凌风控制、狂龙斩群攻、金钟罩护体。建议担任近战控制与群体输出。',
  },
  wizard: {
    name: '法师', race: 'human', role: '远程法术 · 水火土输出', weapon: 'wand', atkType: 'magic', atkStat: 'mag',
    base: { str: 3, con: 5, dex: 4, mag: 8 }, auto: { str: 0, con: 1, dex: 0, mag: 4 },
    hpCon: 10, mpMag: 14, accuracyDex: 5, evasionDex: 2, hpLv: 18, mpLv: 30, armor: 'robe',
    desc: '掌握水、火、土的攻击法术，体魄较弱、不善肉搏。建议用烈火符输出、涌泉牵制，留蓝防护。',
  },
  archer: {
    name: '羽芒', race: 'elf', role: '远程物理 · 箭术与金系攻击', weapon: 'bow', atkType: 'phys', atkStat: 'dex',
    base: { str: 5, con: 5, dex: 8, mag: 2 }, auto: { str: 1, con: 0, dex: 4, mag: 0 },
    hpCon: 13, mpMag: 11, accuracyDex: 8, evasionDex: 6, hpLv: 22, mpLv: 18, armor: 'light',
    desc: '擅长弓弩远程攻击，箭术之外还有落雷等金系技能。建议担任远程输出，以羽之守护提高生存。',
  },
  cleric: {
    name: '羽灵', race: 'elf', role: '治疗辅助 · 金系输出', weapon: 'wand', atkType: 'magic', atkStat: 'mag',
    base: { str: 3, con: 5, dex: 4, mag: 8 }, auto: { str: 0, con: 1, dex: 0, mag: 4 },
    hpCon: 10, mpMag: 14, accuracyDex: 5, evasionDex: 2, hpLv: 20, mpLv: 30, armor: 'robe',
    desc: '精于辅助法术、法阵与诅咒，不善近身肉搏。建议用清心咒、静心咒续航，龙卷风与神雷补充输出。',
  },
  barbarian: {
    name: '妖兽', race: 'untamed', role: '近战承伤 · 白虎变身', weapon: 'axe', atkType: 'phys', atkStat: 'str',
    base: { str: 6, con: 8, dex: 4, mag: 2 }, auto: { str: 1, con: 4, dex: 0, mag: 0 },
    hpCon: 17, mpMag: 14, accuracyDex: 8, evasionDex: 8, hpLv: 36, mpLv: 16, armor: 'heavy',
    desc: '强悍的近身战士，白虎变提升生命，玄武附体提供防护。建议承担伤害，用千斤锤控制敌人。',
  },
  venomancer: {
    name: '妖精', race: 'untamed', role: '驯养宠物 · 木系毒蛊', weapon: 'wand', atkType: 'magic', atkStat: 'mag',
    base: { str: 3, con: 5, dex: 5, mag: 7 }, auto: { str: 0, con: 1, dex: 0, mag: 4 },
    hpCon: 12, mpMag: 12, accuracyDex: 7, evasionDex: 6, hpLv: 20, mpLv: 28, armor: 'robe',
    desc: '可驯服动物为宠，精于木系毒蛊与妖狐变化。建议以宠物承伤、治疗宠物维持续航，毒蛊辅助输出。',
  },
  assassin: {
    name: '刺客', race: 'tideborn', role: '近战爆发 · 遁隐与流血', weapon: 'dagger', atkType: 'phys', atkStat: 'dex',
    base: { str: 5, con: 5, dex: 8, mag: 2 }, auto: { str: 1, con: 1, dex: 3, mag: 0 },
    hpCon: 13, mpMag: 10, accuracyDex: 8, evasionDex: 6, hpLv: 24, mpLv: 18, armor: 'light',
    desc: '近身伤害与机动性出众，具有遁隐和暴击伤害技巧。建议担任单体爆发输出，以放血和深刺压制敌人。',
  },
  psychic: {
    name: '巫师', race: 'tideborn', role: '水土法术 · 灵魂防护与控制', weapon: 'soulsphere', atkType: 'magic', atkStat: 'mag',
    base: { str: 3, con: 5, dex: 4, mag: 8 }, auto: { str: 0, con: 1, dex: 0, mag: 4 },
    hpCon: 10, mpMag: 14, accuracyDex: 5, evasionDex: 2, hpLv: 18, mpLv: 30, armor: 'robe',
    desc: '运用灵魂祝福与负面状态，水土法术兼具输出与控制。建议控制型输出；自身脆弱，善用镜像防护。',
  },
  seeker: {
    name: '剑灵', race: 'earthguard', role: '近战剑技 · 金系剑气与群攻', weapon: 'sword', atkType: 'phys', atkStat: 'str',
    base: { str: 6, con: 6, dex: 6, mag: 2 }, auto: { str: 2, con: 2, dex: 1, mag: 0 },
    hpCon: 15, mpMag: 9, accuracyDex: 10, evasionDex: 10, hpLv: 30, mpLv: 18, armor: 'heavy',
    desc: '剑技与法术双修，可附金元素于剑身、以心御剑。建议近战群攻，用三才剑咒强化武器、剑气打击敌人。',
  },
  mystic: {
    name: '魅灵', race: 'earthguard', role: '召唤支援 · 治疗与木系控制', weapon: 'glaive', atkType: 'magic', atkStat: 'mag',
    base: { str: 3, con: 5, dex: 4, mag: 8 }, auto: { str: 0, con: 1, dex: 0, mag: 4 },
    hpCon: 10, mpMag: 14, accuracyDex: 8, evasionDex: 6, hpLv: 20, mpLv: 28, armor: 'robe',
    desc: '召唤自然伙伴、以诅咒伤敌，灵光普照与落英缤纷提供治疗。建议召唤支援兼治疗，木系法术补充控制。',
  },
};
for (const [id, cls] of Object.entries(CLASSES)) {
  cls.source = CLASS_SOURCES[id];
  cls.attributeSource = ATTRIBUTE_SOURCE;
  cls.recommendedRole = cls.role;
  cls.adaptation = '已核体质生命、灵力真气及敏捷命中/闪避度系数；初始属性、等级成长、推荐职责与加点、攻击防御及概率换算仍为本作设计，不表示已实现全部职业机制。';
}

// Stable playable IDs/kinds are shared with combat, storage and UI.
// Multipliers/hits/cooldowns/turns/default chi gain are local. Selected sourced
// costs and damage channels are marked explicitly; no generic source formulas run.
const S = (o) => ({ per: 0.08, cd: 0, chi: 0, gain: 15, mp: 10, ...o });
const COMBAT_SKILLS = {
  blademaster: [
    S({ id: 'bm1', kind: 'dmg', mult: 1.3, mp: 8, desc: '奋力一击，造成物理伤害。' }),
    S({ id: 'bm2', kind: 'dmg', mult: 1.0, mp: 14, cd: 3, fx: { stun: [0.5, 1] }, desc: '凌空砸击，几率眩晕1回合。' }),
    S({ id: 'bm3', kind: 'dmg', mult: 0.7, hits: 3, mp: 22, cd: 2, aoe: true, desc: '物理群攻，本作拆为三次连斩。', mappingNote: '源记录为扇形一击；三连击与全体目标为本作适配。' }),
    S({ id: 'bm4', kind: 'buff', buff: { def: 0.35 }, turns: 4, mp: 30, cd: 6, desc: '提高35%物理防御，持续4回合。' }),
    S({ id: 'bm5', kind: 'dmg', mult: 2.2, mp: 30, chi: 200, cd: 3, fx: { weaken: [0.3, 3] }, desc: '消耗200元气，需刀剑；重击降低目标30%攻击3回合。', mappingNote: '刀剑限制与200元气消耗来自普通记录；源范围攻击及双攻击削弱简化为单体、本地数值。默认获得15元气仍为本作规则。' }),
    S({ id: 'bm6', kind: 'dmg', mult: 1.2, hits: 2, mp: 35, chi: 0, gain: 0, aoe: true, desc: '需斧锤，不消耗元气；本作横扫全体两次。', mappingNote: '斧锤限制及0元气消耗来自普通记录；范围一击适配为两连击，耗蓝与元气获得为本作规则。' }),
    S({ id: 'bm7', kind: 'buff', buff: { crit: 0.2 }, turns: 5, mp: 50, chi: 200, gain: 0, cd: 10, desc: '暴击提升20%，持续5回合；本作未模拟攻击代价。', mappingNote: '源记录降低50%攻击并提升暴击；现有存档增益结构不支持负值，故只保留暴击方向，不反转为攻击强化。' }),
    S({ id: 'bm8', kind: 'dmg', mult: 5.0, mp: 80, chi: 300, gain: 0, cd: 4, desc: '消耗3格元气，强力单体剑击。', mappingNote: '源记录使用损失生命值参与伤害；本作固定倍率，不复现该公式。' }),
  ],
  wizard: [
    S({ id: 'wz1', kind: 'dmg', elem: 'fire', mult: 1.4, mp: 6, desc: '烈火符造成火伤；耗蓝按已核数值为15×技能等级−9，空手或法器可施放。' }),
    S({ id: 'wz2', kind: 'dmg', elem: 'water', mult: 1.2, mp: 12, fx: { slow: [1, 2] }, desc: '水柱攻击；减速在本作适配为降低攻击2回合。' }),
    S({ id: 'wz3', kind: 'buff', buff: { equipmentDefPct: 0.1, equipmentEarthDefPct: 0.1 }, buffPerRank: true, turns: 5, mp: 28, chi: 30, cd: 6, desc: '消耗30元气，每级增加装备物防及装备土系防御10%；本作持续5回合，不吸收伤害。', mappingNote: '普通记录181：装备物防/土防加成10%×技能等级及30元气来自来源；装备分项缺失时按通用法防本地回退，不加成裸属性或修真防御。源15分钟改为5回合，耗蓝/冷却/元气获得仍为本作规则；旧存档吸收护盾不迁移。' }),
    S({ id: 'wz4', kind: 'dmg', elem: 'earth', mult: 1.8, mp: 26, cd: 2, fx: { stun: [0.35, 1] }, desc: '土系重击，几率眩晕1回合。', mappingNote: '源记录为范围攻击；本作保留单体控制槽位。' }),
    S({ id: 'wz5', kind: 'dmg', elem: 'fire', mult: 1.3, mp: 40, cd: 3, aoe: true, fx: { dot: [0.3, 3] }, desc: '火阵攻击全体，并持续灼烧。', mappingNote: '持续引导与逐秒耗蓝被简化为一次施放及回合持续伤害。' }),
    S({ id: 'wz6', kind: 'dmg', elem: 'water', mult: 1.6, mp: 55, chi: 100, gain: 0, aoe: true, fx: { slow: [0.6, 1] }, desc: '水龙攻击全体，几率减速1回合。' }),
    S({ id: 'wz7', kind: 'dmg', attackBasis: 'magic', elem: 'fire', components: [{ type: 'magic', elem: 'fire', share: 0.5 }, { type: 'phys', elem: null, share: 0.5 }], mult: 5.0, mp: 100, chi: 300, gain: 0, cd: 4, desc: '法术攻击为基础，等量火系与物理伤害；本作消耗3格元气。', mappingNote: '普通记录87正文支持法术攻击基础、等量火伤/物伤；倍率、单体、命中、各分量减伤及资源（源消耗200元气，暂未适配）仍为本作规则。' }),
  ],
  archer: [
    S({ id: 'ar1', kind: 'dmg', mult: 1.3, mp: 8, desc: '蓄力箭术在本作简化为一次物理射击。' }),
    S({ id: 'ar2', kind: 'dmg', attackBasis: 'phys', elem: 'metal', mult: 1.4, mp: 14, desc: '以物理攻击为基础的金系雷电箭击。', mappingNote: '普通记录241以物理攻击力计算金伤；物攻基础和金系通道保留，倍率、命中与金防/抗性减伤换算为本作规则。' }),
    S({ id: 'ar3', kind: 'dmg', mult: 0.65, hits: 3, mp: 22, cd: 2, desc: '快速箭术，本作适配为三连射。', mappingNote: '源连射是一发快速射击；三连射不代表源公式。' }),
    S({ id: 'ar4', kind: 'buff', buff: { dodge: 0.25 }, turns: 5, mp: 25, cd: 6, desc: '闪避提升25%，持续5回合。' }),
    S({ id: 'ar5', kind: 'dmg', mult: 1.8, mp: 30, cd: 3, fx: { armorBreak: [0.35, 3] }, desc: '利齿射击；削弱生命上限在本作替换为破甲。', mappingNote: '源记录为范围伤害、降低生命上限；引擎无生命上限削弱，本作明确替换为单体破甲。' }),
    S({ id: 'ar6', kind: 'dmg', mult: 0.8, hits: 4, mp: 50, chi: 200, gain: 0, aoe: true, desc: '消耗200元气，四段箭雨攻击全体。', mappingNote: '普通记录240消耗200元气；源持续耗蓝和弹药简化为一次四段攻击，耗蓝与元气获得为本作规则。' }),
    S({ id: 'ar7', kind: 'dmg', mult: 5.2, mp: 80, chi: 0, gain: 0, cd: 4, desc: '不消耗元气，强力单体射击。', mappingNote: '普通记录239的0元气消耗保留；倍率、耗蓝、冷却与元气获得仍为本作规则。' }),
  ],
  cleric: [
    S({ id: 'cl1', kind: 'dmg', elem: 'metal', mult: 1.3, mp: 10, desc: '唤出旋风，造成金系伤害。', mappingNote: '源记录附带减速；本作新手攻击未实现该附加效果。' }),
    S({ id: 'cl2', kind: 'heal', mult: 1.8, mp: 14, desc: '施加符咒，立即恢复生命。' }),
    S({ id: 'cl3', kind: 'buff', buff: { def: 0.25, mdef: 0.25 }, turns: 6, mp: 25, cd: 7, desc: '物防祝福在本作扩展为双防提升25%。', mappingNote: '源坚甲符只增加装备物防；魔防加成为本作扩展。' }),
    S({ id: 'cl4', kind: 'dmg', elem: 'metal', mult: 1.9, mp: 30, cd: 2, fx: { dot: [0.3, 1] }, desc: '球形闪电攻击，并追加1回合金系持续伤害。' }),
    S({ id: 'cl5', kind: 'heal', mult: 1.0, hot: [0.08, 4], mp: 35, cd: 5, desc: '施加持续恢复符咒，并立即回复生命。', mappingNote: '源记录为持续治疗；立即治疗与每回合生命比例为本作适配。' }),
    S({ id: 'cl6', kind: 'dmg', elem: 'metal', mult: 1.4, mp: 45, chi: 100, gain: 0, aoe: true, desc: '消耗1格元气，金系和风攻击全体。', mappingNote: '源记录可能定身；本作此槽位只实现范围伤害。' }),
    S({ id: 'cl7', kind: 'passive', revive: 0.5, desc: '本作被动适配：每战首次阵亡，以50%生命复起。', mappingNote: '源还魂咒是主动复活队友，并非自身被动；单人引擎将其适配为一次自救，不复现源复活损失规则。' }),
    S({ id: 'cl8', kind: 'dmg', elem: 'metal', mult: 4.6, mp: 90, chi: 300, gain: 0, cd: 4, desc: '消耗3格元气，以天雷重击目标。', mappingNote: '源记录为群攻并减速；本作保留单体终结槽位。' }),
  ],
  barbarian: [
    S({ id: 'bb1', kind: 'dmg', mult: 1.3, mp: 8, desc: '奋力锤击，造成物理伤害。' }),
    S({ id: 'bb2', kind: 'transform', buff: { hp: 0.3, def: 0.2 }, mp: 10, desc: '白虎形：生命+30%、物防+20%；再用变回。', mappingNote: '源白虎变提升生命与移速、降低装备攻击；现有增益结构不支持负值，本作不模拟攻击代价，另加物防，不换算装备值或模拟形态技能限制。' }),
    S({ id: 'bb3', kind: 'dmg', mult: 0.9, mp: 18, cd: 3, aoe: true, fx: { weaken: [0.2, 3] }, desc: '气浪攻击全体；本作另加攻击削弱。', mappingNote: '源巨浪为扇形物理攻击；攻击削弱为本作扩展。' }),
    S({ id: 'bb4', kind: 'dmg', mult: 1.6, mp: 25, cd: 3, fx: { stun: [0.45, 1] }, desc: '强力物理锤击，几率眩晕1回合。' }),
    S({ id: 'bb5', kind: 'buff', buff: { atk: 0.35, lifesteal: 0.15 }, turns: 5, mp: 30, cd: 7, desc: '攻击+35%，本作另加15%吸血。', mappingNote: '源巨灵神力增加武器物攻；吸血为本作扩展，不是源技能效果。' }),
    S({ id: 'bb6', kind: 'dmg', mult: 1.3, hits: 2, mp: 45, chi: 100, gain: 0, aoe: true, desc: '真气团物理攻击，本作扩展为全体两连击。', mappingNote: '源记录为单体伤害并降低闪避；本作扩展为群体连击，无闪避削弱。' }),
    S({ id: 'bb7', kind: 'buff', buff: { def: 0.8, mdef: 0.8, regen: 0.1 }, turns: 4, mp: 60, chi: 300, gain: 0, cd: 10, desc: '玄武防护：双防+80%，每回合恢复10%生命。', mappingNote: '源记录是全伤害减免与移速下降；本作改为双防并加恢复，不宣称等效减伤。' }),
  ],
  venomancer: [
    S({ id: 'vm1', kind: 'dmg', elem: 'wood', mult: 1.3, mp: 10, fx: { dot: [0.15, 2] }, desc: '木系毒蛊攻击，本作另加2回合毒伤。', mappingNote: '源剧毒蛊为直接木伤；此槽位持续毒伤为本作扩展。' }),
    S({ id: 'vm2', kind: 'summon', pet: { name: '驯养伙伴（本作）', atk: 0.6, hp: 1.2 }, mp: 20, desc: '本作简化驯养：唤出固定伙伴协战。', mappingNote: '源记录尝试驯服可捕获怪物；本作不实现捕获、宠物栏或成功率，改为固定伙伴召唤。' }),
    S({ id: 'vm3', kind: 'petheal', mult: 0.5, mp: 15, desc: '本作治疗宠物50%最大生命。' }),
    S({ id: 'vm4', kind: 'dmg', attackBasis: 'magic', elem: 'wood', dotElem: 'fire', dotType: 'magic', mult: 1.2, mp: 28, cd: 2, fx: { dot: [0.4, 4] }, desc: '直接木系伤害，随后持续火伤4回合。', mappingNote: '普通记录301的直接木伤与后续火伤通道保留；倍率、命中、减伤与4回合时长仍为本作适配，不复现源逐秒公式。' }),
    S({ id: 'vm5', kind: 'buff', buff: { def: 0.3, accuracy: 0.15 }, turns: 6, mp: 25, cd: 7, desc: '妖狐祝福：物防+30%、命中+15%，持续6回合。', mappingNote: '源为狐形切换、物防与命中提升及真气上限下降；本作保留临时祝福槽位，无狐形技能限制。' }),
    S({ id: 'vm6', kind: 'dmg', elem: 'wood', mult: 1.1, mp: 45, chi: 100, gain: 0, aoe: true, fx: { dot: [0.3, 3] }, desc: '木系蛊毒攻击全体，并持续3回合。' }),
    S({ id: 'vm7', kind: 'summon', pet: { name: '复苏伙伴（本作）', atk: 1.4, hp: 2.5 }, mp: 80, chi: 300, gain: 0, desc: '本作复苏适配：唤出一名强化伙伴。', mappingNote: '源记录复活已有宠物，不召唤新物种；本作战斗没有持久宠物栏，改为固定强化伙伴，数值不是源宠物数据。' }),
  ],
  assassin: [
    S({ id: 'as1', kind: 'dmg', mult: 1.3, mp: 8, desc: '迅捷刺杀，造成物理伤害。' }),
    S({ id: 'as2', kind: 'stealth', mp: 12, cd: 4, desc: '本作战斗遁隐：下一击必暴击、伤害+50%，闪避提高。', mappingNote: '源遁隐术只可非战斗施放，按遁隐等级隐藏且逐秒耗蓝；战斗内隐身、必暴击为本作适配。' }),
    S({ id: 'as3', kind: 'dmg', mult: 2.0, mp: 20, cd: 2, stealthBonus: 1.0, desc: '物理重刺；本作遁隐时伤害翻倍。', mappingNote: '源斩杀没有遁隐增伤；该联动为本作扩展。' }),
    S({ id: 'as4', kind: 'dmg', mult: 1.2, mp: 22, fx: { dot: [0.3, 3] }, desc: '割伤目标，造成物理流血伤害。' }),
    S({ id: 'as5', kind: 'dmg', mult: 0.6, hits: 4, mp: 32, cd: 3, desc: '疯狂攻击，本作适配为四连斩。', mappingNote: '源记录为一击并降低移速；本作四连斩，未实现源减速。' }),
    S({ id: 'as6', kind: 'dmg', mult: 2.6, mp: 45, chi: 100, gain: 0, fx: { stun: [0.5, 1] }, desc: '深刺要害，几率控制1回合。', mappingNote: '源控制为昏睡；本作无睡眠状态，简化为眩晕。' }),
    S({ id: 'as7', kind: 'dmg', mult: 5.5, mp: 80, chi: 300, gain: 0, cd: 4, desc: '消耗3格元气，强力要害刺击。', mappingNote: '源斩首附带眩晕；本作此终结槽位仅实现伤害。' }),
  ],
  psychic: [
    S({ id: 'ps1', kind: 'dmg', elem: 'earth', mult: 1.35, mp: 10, desc: '引土之力，造成土系伤害。' }),
    S({ id: 'ps2', kind: 'dmg', elem: 'water', mult: 1.1, mp: 14, fx: { slow: [0.5, 2] }, desc: '水系冲击；减速适配为降低攻击2回合。' }),
    S({ id: 'ps3', kind: 'dmg', elem: 'earth', mult: 0.9, mp: 20, cd: 3, fx: { weaken: [0.3, 3], armorBreak: [0.2, 3] }, desc: '土系沙暴；本作将命中削弱替换为攻防削弱。', mappingNote: '源记录为范围土伤并降低命中；本作单体攻防削弱，不宣称源公式等效。' }),
    S({ id: 'ps4', kind: 'buff', buff: { shield: 3.5 }, turns: 5, mp: 30, cd: 6, desc: '灵魂镜像在本作简化为吸收伤害的护盾。', mappingNote: '源记录抵消并反弹伤害和状态；本作不实现魂力值、反射或共享冷却。' }),
    S({ id: 'ps5', kind: 'dmg', elem: 'water', mult: 1.4, mp: 40, cd: 3, aoe: true, desc: '水系气场攻击全体。', mappingNote: '源记录还可能减速；本作此槽位仅实现范围伤害。' }),
    S({ id: 'ps6', kind: 'dmg', elem: 'earth', mult: 1.8, mp: 50, chi: 100, gain: 0, fx: { stun: [0.8, 2] }, desc: '土灵重击，几率眩晕2回合。', mappingNote: '源记录为范围控制；本作保留单体控制槽位。' }),
    S({ id: 'ps7', kind: 'dmg', elem: 'water', mult: 5.0, mp: 100, chi: 300, gain: 0, cd: 4, desc: '消耗3格元气，以汪洋之力重击目标。', mappingNote: '源记录为水系群攻并可能附带魂力流血；本作单体水伤，无魂力公式。' }),
  ],
  seeker: [
    S({ id: 'sk1', kind: 'dmg', mult: 1.3, mp: 8, desc: '势大力沉的物理剑斩。' }),
    S({ id: 'sk2', kind: 'dmg', elem: 'metal', mult: 1.4, mp: 14, desc: '流光剑气，造成金系伤害。', mappingNote: '源记录以物理攻击力参与金伤计算；本作使用统一元素伤害通道。' }),
    S({ id: 'sk3', kind: 'dmg', elem: 'metal', mult: 0.8, hits: 2, mp: 22, cd: 2, aoe: true, desc: '金系剑影攻击全体，本作适配为两段。', mappingNote: '源分类为祝福，但正文明确为周期金系范围伤害；本作按正文映射伤害槽位，无周期引导。' }),
    S({ id: 'sk4', kind: 'buff', buff: { atk: 0.25, def: 0.15 }, turns: 5, mp: 28, cd: 7, desc: '武器祝福，本作简化为攻击+25%、物防+15%。', mappingNote: '源为武器暴击、攻击等级与防御等级；本作不转换等级数值，采用明确的本地攻防祝福。' }),
    S({ id: 'sk5', kind: 'dmg', mult: 2.1, mp: 30, cd: 3, fx: { stun: [0.35, 1] }, desc: '物理剑气；本作简化剑眼控制为几率眩晕。', mappingNote: '源分类为祝福、正文为攻击；定身与降防需先激活玄武剑眼，本作未实现剑眼前置与联动公式。' }),
    S({ id: 'sk6', kind: 'dmg', mult: 1.0, hits: 3, mp: 45, chi: 100, gain: 0, aoe: true, desc: '物理剑阵攻击全体，本作适配为三段。', mappingNote: '源为持续引导、逐段耗蓝；本作一次三段攻击。' }),
    S({ id: 'sk7', kind: 'dmg', mult: 5.2, mp: 80, chi: 300, gain: 0, cd: 4, desc: '消耗3格元气，巨龙般的物理剑击。', mappingNote: '源记录另有九尊剑眼联动；本作只实现固定倍率伤害。' }),
  ],
  mystic: [
    S({ id: 'my1', kind: 'dmg', elem: 'wood', mult: 1.3, mp: 10, desc: '新绿藤气，造成木系伤害。', mappingNote: '源记录有特殊减速及摄魂咒双倍联动；本作新手攻击未实现该状态链。' }),
    S({ id: 'my2', kind: 'summon', pet: { name: '幻境武神', atk: 0.5, hp: 1.5 }, mp: 20, desc: '召唤幻境武神协助作战。', mappingNote: '伙伴属性按角色系数适配；不实现召唤物耗蓝、独立技能与偷天换日吸取。' }),
    S({ id: 'my3', kind: 'heal', mult: 1.5, mp: 14, desc: '灵光如泉，立即恢复生命。' }),
    S({ id: 'my4', kind: 'dmg', elem: 'wood', mult: 1.3, mp: 24, cd: 3, fx: { stun: [0.5, 1] }, desc: '植物之力造成木伤，几率控制1回合。', mappingNote: '源为植物范围伤害并封印、定身；本作单体伤害与眩晕，无植物实体。' }),
    S({ id: 'my5', kind: 'dmg', elem: 'wood', mult: 1.3, mp: 38, cd: 3, aoe: true, desc: '自然之风席卷全体，造成木系伤害。', mappingNote: '源记录可能封印、定身；本作只实现范围伤害。' }),
    S({ id: 'my6', kind: 'heal', mult: 1.2, hot: [0.1, 4], mp: 50, chi: 100, gain: 0, desc: '本作治疗适配：立即恢复，并持续治疗4回合。', mappingNote: '源落英缤纷为受击后触发治疗的祝福；本作改为立即及持续治疗，不复现受击触发。' }),
    S({ id: 'my7', kind: 'summon', pet: { name: '幻境魔神', atk: 1.3, hp: 3.0 }, mp: 80, chi: 300, gain: 0, desc: '召唤幻境魔神协助作战。', mappingNote: '源魔神以金系攻击为主；本作伙伴共用物理攻击、固定角色系数，不复现召唤物技能。' }),
  ],
};

// Map only exact documented rank names; do not infer a cultivation from learning level.
function sourceCultivation(name) {
  const names = name.split(/[、，,。；;]/).map((part) => part.trim()).filter(Boolean);
  const ranks = names.map((part) => CULTIVATION.findIndex((rank) => (Array.isArray(rank.name) ? rank.name : [rank.name]).includes(part)));
  return ranks.length && ranks.every((rank) => rank >= 0 && rank === ranks[0]) ? ranks[0] : null;
}

function playableSkill(cls, skill, first) {
  const original = SKILL_SOURCES[skill.id];
  if (!original) throw new Error(`技能缺少核实来源：${skill.id}`);
  const sourceRank = sourceCultivation(original.cultivation);
  // Unmapped cultivation must have an explicit local fallback, never an inferred conversion.
  const cult = sourceRank ?? skill.adaptedCultivation;
  if (!Number.isInteger(cult) || !CULTIVATION[cult]) throw new Error(`修真名未能安全映射：${original.cultivation}`);
  const learning = Array.from({ length: original.maxLv }, (_, i) => {
    const row = { basis: {} };
    for (const key of ['level', 'sp', 'gold']) {
      const documented = original.learning[key]?.[i];
      const known = Number.isFinite(documented) && documented >= 0;
      const value = known ? documented : skill.adaptedLearning?.[i]?.[key];
      if (!Number.isFinite(value) || value < 0) throw new Error(`缺少数值学习要求：${skill.id}/${i + 1}/${key}`);
      row[key] = value;
      row.basis[key] = known ? 'source' : 'local-explicit-fallback';
    }
    if (row.level === 0) { row.level = 1; row.basis.level = 'local-level-floor'; }
    if (first && i === 0) {
      // Creation has no SP and must have a usable attack, even when the source begins at Lv.3.
      row.level = 1; row.sp = 0; row.gold = 0;
      row.basis = { level: 'local-tutorial-unlock', sp: 'local-tutorial-unlock', gold: 'local-tutorial-unlock' };
    }
    return row;
  });
  return {
    ...skill, name: original.originalName, maxLv: original.maxLv, lv: learning[0].level, cult, learning,
    tutorialUnlock: first,
    source: { ...CLASS_SOURCES[cls], ...original, cultivationRank: sourceRank },
    adaptation: {
      combat: SKILL_ADAPTATION,
      resources: { mp: original.resources?.mp ? 'source-vetted-linear-wz1' : 'local', chi: original.resources && Object.hasOwn(original.resources, 'chi') ? 'source-normal-record' : 'local', gain: 'local' },
      weapons: '逐条普通记录wuqi映射到已支持类型；拳套、长兵、长鞭未支持，未知限制不授予通用权限。穿戴条件与施法条件独立。',
      mapping: skill.mappingNote || '按源记录的攻击、治疗或祝福方向选取；具体效果数值与回合规则为本作适配。',
      learning: first ? '初始攻击第1级由新手教学免费解锁；源学习等级与费用完整保留在 source.learning，其余技能等级采用已记录数值。' : '源等级0仅规范为本作等级1；缺失数值只能使用显式本地学习表，不能执行或强转公式。',
      cultivation: sourceRank === null ? '未识别源修真名，使用显式本地修真要求。' : '逐字匹配 world.js 修真名，不按等级推导修真。',
    },
  };
}
export const SKILLS = Object.fromEntries(Object.entries(COMBAT_SKILLS).map(([cls, skills]) => [cls, skills.map((skill, i) => playableSkill(cls, skill, i === 0))]));

export function findSkill(cls, id) {
  return SKILLS[cls]?.find((s) => s.id === id);
}

// Shared by UI and every combat/resource recommendation path. Only the vetted
// wz1 arithmetic is supported; blank/string MP costs never become zero or code.
export function skillResources(skill, rank) {
  if (!skill || !Number.isSafeInteger(rank) || rank < 1 || rank > skill.maxLv) throw new Error('技能资源等级无效。');
  const source = skill.source?.resources;
  let mp = skill.mp;
  if (source?.mp) {
    if (skill.id !== 'wz1' || skill.source.originalId !== 81 || skill.source.originalName !== '烈火符'
      || skill.source.xianmo !== '3' || source.mp.base !== -9 || source.mp.perRank !== 15) throw new Error('未核实的技能耗蓝公式。');
    mp = -9 + 15 * rank;
  }
  const chi = source && Object.hasOwn(source, 'chi') ? source.chi : skill.chi;
  const gain = skill.gain;
  if ([mp, chi, gain].some((n) => !Number.isFinite(n) || n < 0)) throw new Error('技能资源必须为明确的非负数值。');
  return { mp, chi, gain, basis: { mp: source?.mp ? 'source-vetted-linear-wz1' : 'local', chi: source && Object.hasOwn(source, 'chi') ? 'source-normal-record' : 'local', gain: 'local' } };
}

// UI asks for maxLv + 1 even for a maxed skill. Return the last finite row; Game.learn
// separately rejects ranks over maxLv. Never extrapolate or fabricate another source rank.
export function skillReq(skill, toLv) {
  if (!skill || !Number.isSafeInteger(toLv) || toLv < 1) throw new Error('技能学习等级无效。');
  const row = skill.learning?.[Math.min(toLv, skill.maxLv) - 1];
  if (!row || ['level', 'sp', 'gold'].some((key) => !Number.isFinite(row[key]) || row[key] < 0)) throw new Error('技能缺少明确的数值学习要求。');
  return { level: row.level, sp: row.sp, gold: row.gold };
}
