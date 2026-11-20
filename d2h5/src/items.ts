import type { BaseItem, ClassId, Difficulty, Item, ItemMods, Monster, Player, Quality, RawRow, Rng, Slot } from './types';
import { getClass, getSkill, num, rawRows, text } from './catalog';
import { activeEquipment, deriveStats, equipmentModifiers } from './rules';
import zhCN from './data/item-zhCN.json';

const ITEM_NAMES: Readonly<Record<string, string>> = zhCN;
export const itemName = (key: string): string => ITEM_NAMES[key] ?? `未收录译名（${key}）`;

/** Executable subset, not a claim of bit-exact legacy item generation. */
export const ITEM_LIMITATIONS: string[] = [
  '掉落仅支持单人 players1；不处理首杀任务 TC、女伯爵双 TC、超级暗金专用 TC、暗黑破坏神克隆或同局暗金唯一生成限制。',
  '自动 weap/armo/bow/mele TC 使用底材等级、类型继承和 rarity 权重；职业底材概率修正、自然孔概率、金币数量公式及负 Picks 嵌套截断仍需原版验证。',
  '稀有词缀数量暂用研究中的 3/4/4/5/5/6 分布（未验证）；随机 staffmod、AutoMagic、稀有名称及完整品质强制规则未实现。',
  '套装组合和每级属性动态计算；触发技能、聚气、装备光环、oskill仍未实现。标注“仅保存”的战斗属性尚无执行器；旧存档缺失的随机套装奖励不会补随机。',
  '毒素保留原始每帧定点速率和时长；多毒源聚合、持续时间、技能专属伤害及攻击模式由战斗引擎验证。',
  '方块仅支持宝石/符文升级、三小紫合大紫、普通装备打孔、Hel 清孔及 Ort/Ral 维修；无通用合成兜底。',
  '商店为第一幕基础库存加改编便利商品（大紫、33种符文、35种宝石与骷髅、乔丹之石、3种事件钥匙），并非原版商店；钥匙仅可购买保存，出售乔丹不会召唤黑毛。普通商品取原始底价，乔丹按戒指底价×暗金倍率＋附加价报价；维修为耐久比例估算，未实现原版完整价格/折扣/聚气费用。',
  '药水返回职业基础回复量和持续秒数（原始帧数/25），不包含属性双倍概率、混合药效叠加及解毒/解冻/耐力状态；引擎负责实际回复。',
  '镶嵌的可变符文之语属性及方块打孔使用 Math.random（接口未提供 RNG）；掉落和生成使用调用方 RNG。',
  '55 个原版离线符文之语加重制版边缘覆盖可匹配；其余 22 个 server 限定定义禁用；符文与宝石镶嵌已实现。',
];

const CLASS_IDS: ClassId[] = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass'];
const CLASS_NAMES: Record<string, ClassId> = { amazon: 'ama', sorceress: 'sor', necromancer: 'nec', paladin: 'pal', barbarian: 'bar', druid: 'dru', assassin: 'ass' };
const CN: Record<string, string> = {
  hax: '手斧', axe: '斧', '2ax': '双刃斧', mpi: '军用锹', wax: '战斧', lax: '巨斧', bax: '阔斧', btx: '战斗斧', gax: '卓越之斧', gix: '大斧',
  wnd: '法杖', ywn: '紫杉之杖', bwn: '骨杖', gwn: '冷酷之杖', clb: '木棒', spc: '狼牙棒', scp: '权杖', gsc: '雄伟权杖', wsp: '战争权杖',
  mac: '钉头锤', mst: '流星锤', fla: '连枷', whm: '战锤', mau: '大木棍', gma: '卓越巨棍',
  ssd: '短剑', scm: '弯刀', sbr: '军刀', flc: '弯形大刀', crs: '水晶剑', bsd: '阔剑', lsd: '长剑', wsd: '巨战之剑', '2hs': '双手剑', clm: '双刃大刀', gis: '大剑', bsw: '巨剑', flb: '双手饰剑', gsd: '卓越之剑',
  dgr: '匕首', dir: '长匕首', kri: '波形刀', bld: '短刀', tkf: '飞刀', tax: '飞斧', bkf: '平衡飞刀', bal: '平衡斧',
  jav: '标枪', pil: '短标枪', ssp: '短矛', glv: '大长刀', tsp: '飞矛', spr: '长矛', tri: '三叉戟', brn: '叉', spt: '大战戟', pik: '矛',
  ob1: '鹰之法珠', ob2: '神圣天球', ob3: '烟雾之球', ob4: '握扣法珠', ob5: '杰瑞德之石', bar: '大砍刀', hal: '长柄战斧', vou: '钩镰枪', scy: '镰刀', pax: '长柄战斧', wsc: '巨战镰刀',
  sst: '短棍', lst: '长棍', cst: '多节棍', bst: '战斗法杖', wst: '巨战法杖',
  sbw: '短弓', hbw: '猎弓', lbw: '长弓', cbw: '组合弓', sbb: '短战斗弓', lbb: '长战斗弓', swb: '短战争弓', lwb: '长战争弓', lxb: '轻十字弓', mxb: '十字弓', hxb: '重十字弓', rxb: '连射十字弓',
  ktr: '拳剑', wrb: '腕刃', axf: '斧手', ces: '腰刀', clw: '爪', btl: '刃爪', skr: '剪咬剑',
  cap: '帽子', skp: '骷髅帽', hlm: '头盔', fhl: '高级头盔', ghm: '卓越头盔', crn: '皇冠', msk: '面具', bhm: '白骨头盔', ci0: '头环', ci1: '宝冠', ci2: '三重冠', ci3: '权冠',
  qui: '布甲', lea: '皮甲', hla: '硬皮甲', stu: '镶嵌甲', rng: '环甲', scl: '鳞甲', chn: '锁子甲', brs: '胸甲', spl: '板甲', plt: '铠甲', fld: '实战铠甲', gth: '哥德战甲', ful: '高级战甲', aar: '古代装甲', ltp: '轻型装甲',
  buc: '小圆盾', sml: '小盾牌', lrg: '大盾牌', kit: '轻盾', tow: '塔盾', gts: '哥德盾牌', bsh: '白骨盾牌', spk: '尖刺盾牌',
  lgl: '皮手套', vgl: '重手套', mgl: '锁链手套', tgl: '轻型铁手套', hgl: '铁手套', lbt: '皮靴', vbt: '重靴', mbt: '锁链靴', tbt: '轻型金属靴', hbt: '护胫',
  lbl: '饰带', vbl: '轻扣带', mbl: '扣带', tbl: '重扣带', hbl: '金属扣带', rin: '戒指', amu: '项链', jew: '珠宝',
  hp1: '微型治疗药水', hp2: '轻型治疗药水', hp3: '治疗药水', hp4: '强效治疗药水', hp5: '超级治疗药水',
  mp1: '微型法力药水', mp2: '轻型法力药水', mp3: '法力药水', mp4: '强效法力药水', mp5: '超级法力药水', rvs: '回复活力药水', rvl: '全面回复活力药水',
  tsc: '城镇传送卷轴', isc: '辨识卷轴', tbk: '城镇传送之书', ibk: '辨识之书', box: '赫拉迪克方块', key: '钥匙', gld: '金币', aqv: '箭矢', cqv: '弩矢',
  yps: '解毒药水', wms: '解冻药水', vps: '耐力药水', cm1: '小护身符', cm2: '大护身符', cm3: '超大型护身符',
  pk1: '恐惧之钥', pk2: '憎恨之钥', pk3: '毁灭之钥',
};
const GEM_TYPES = ['gema', 'gems', 'geme', 'gemr', 'gemd', 'gemt', 'gemz'];
function baseName(row: RawRow): string {
  return itemName(text(row, 'namestr', text(row, 'code')));
}

const TYPES = new Map(rawRows('ItemTypes').map(row => [text(row, 'Code').toLowerCase(), row]));
function typeRow(type: string): RawRow | undefined { return TYPES.get(type.toLowerCase()); }
/** ItemTypes Equiv1/Equiv2 inheritance, including a base's secondary type. */
export function itemHasType(base: BaseItem, wanted: string): boolean {
  const pending = [base.type, text(base.raw, 'type2')];
  const seen = new Set<string>();
  while (pending.length) {
    const type = pending.pop()!.toLowerCase();
    if (!type || seen.has(type)) continue;
    if (type === wanted.toLowerCase()) return true;
    seen.add(type);
    const row = typeRow(type);
    if (row) pending.push(text(row, 'Equiv1'), text(row, 'Equiv2'));
  }
  return false;
}
function beltRows(row: RawRow): number {
  if (text(row, 'type') !== 'belt') return 1;
  // Belt.txt codes are not row counts. All exceptional/elite belts have four rows.
  if (text(row, 'normcode') && text(row, 'normcode') !== text(row, 'code')) return 4;
  return ({ lbl: 2, vbl: 2, mbl: 3, tbl: 3, hbl: 4 } as Record<string, number>)[text(row, 'code')] ?? 1;
}
function makeBase(row: RawRow, table: string): BaseItem {
  const type = text(row, 'type');
  const definition = typeRow(type);
  const className = definition ? text(definition, 'Class').toLowerCase() : '';
  const classId = CLASS_IDS.includes(className as ClassId) ? className as ClassId : CLASS_NAMES[className];
  const slots: Record<string, Slot> = { tors: 'body', helm: 'head', circ: 'head', pelt: 'head', phlm: 'head', shie: 'offhand', ashd: 'offhand', head: 'offhand', glov: 'gloves', boot: 'boots', belt: 'belt', ring: 'ring1', amul: 'neck', bowq: 'offhand', xboq: 'offhand' };
  const twoHanded = num(row, '2handed') === 1;
  return {
    code: text(row, 'code'), name: baseName(row), english: text(row, 'name'), type,
    slot: table === 'weapons' ? 'weapon' : slots[type], width: num(row, 'invwidth', 1), height: num(row, 'invheight', 1),
    minDamage: num(row, twoHanded ? '2handmindam' : 'mindam'), maxDamage: num(row, twoHanded ? '2handmaxdam' : 'maxdam'),
    defenseMin: num(row, 'minac'), defenseMax: num(row, 'maxac'), strength: num(row, 'reqstr'), dexterity: num(row, 'reqdex'),
    requiredLevel: num(row, 'levelreq'), qlvl: num(row, 'level'), maxSockets: num(row, 'gemsockets'),
    durability: num(row, 'nodurability') ? 0 : num(row, 'durability'), twoHanded, classId,
    beltRows: beltRows(row), raw: row,
  };
}
// Rejuvenations are explicit TC/recipe items but have no spawnable flag in Misc.
const REFERENCED_CODES = new Set([
  ...rawRows('TreasureClassEx').flatMap(r => Array.from({ length: 10 }, (_, i) => text(r, `Item${i + 1}`).split(',')[0])),
  ...rawRows('cubemain').filter(r => num(r, 'enabled') === 1).map(r => text(r, 'output').split(',')[0]),
]);
function realRow(row: RawRow): boolean {
  const code = text(row, 'code');
  return !!code && !!text(row, 'name') && num(row, 'invwidth') > 0 && num(row, 'invheight') > 0 &&
    num(row, 'enabled', 1) !== 0 && (num(row, 'spawnable') === 1 || num(row, 'quest') > 0 || !text(row, 'spawnable') && REFERENCED_CODES.has(code)) &&
    !['xxx', '0sc', '0bk'].includes(code);
}
export const BASE_ITEMS: BaseItem[] = ['weapons', 'armor', 'misc'].flatMap(table => rawRows(table).filter(realRow).map(r => makeBase(r, table)));
const BASE_BY_CODE = new Map(BASE_ITEMS.map(base => [base.code, base]));
export function getBase(code: string): BaseItem | undefined { return BASE_BY_CODE.get(code); }
export const RUNES: { code: string; name: string; level: number; number: number }[] = BASE_ITEMS.filter(b => /^r\d{2}$/.test(b.code)).map(b => ({ code: b.code, name: b.name, level: b.requiredLevel, number: Number(b.code.slice(1)) })).sort((a, b) => a.number - b.number);
export const GEMS: { code: string; name: string; type: string; grade: number }[] = GEM_TYPES.flatMap(type => BASE_ITEMS.filter(base => base.type === type && /^gem[0-4]$/.test(text(base.raw, 'type2'))).map(base => ({ code: base.code, name: base.name, type, grade: Number(text(base.raw, 'type2').slice(3)) })).sort((a, b) => a.grade - b.grade));
const WORD_NAMES: Record<string, string> = { 'Bound by Duty': 'Chains of Honor', Doomsayer: 'Doom', "Exile's Path": 'Exile', 'The Beast': 'Beast', Widowmaker: 'Grief', Winter: 'Voice of Reason' };
export const RUNEWORDS: { name: string; runes: string[]; types: string[]; raw: RawRow }[] = rawRows('Runes').filter(r => num(r, 'complete') === 1 && (num(r, 'server') !== 1 || text(r, 'Rune Name') === 'Edge')).map(raw => {
  const name = text(raw, 'Rune Name', text(raw, 'Name'));
  return { name: WORD_NAMES[name] ?? name, runes: Array.from({ length: 6 }, (_, i) => text(raw, `Rune${i + 1}`)).filter(Boolean), types: Array.from({ length: 6 }, (_, i) => text(raw, `itype${i + 1}`)).filter(Boolean), raw };
}).filter(word => word.runes.length >= 2 && word.runes.every(r => !!getBase(r)) && word.types.length > 0);

function random(rng: Rng): number { const v = rng(); return Number.isFinite(v) ? Math.min(1 - Number.EPSILON, Math.max(0, v)) : 0; }
function integer(rng: Rng, min: number, max: number): number { return min + Math.floor(random(rng) * (Math.max(min, max) - min + 1)); }
function weighted<T>(rows: T[], weight: (row: T) => number, rng: Rng, noDrop = 0): T | undefined {
  const total = rows.reduce((sum, row) => sum + Math.max(0, weight(row)), Math.max(0, noDrop));
  if (!total) return undefined;
  let roll = random(rng) * total - Math.max(0, noDrop);
  if (roll < 0) return undefined;
  for (const row of rows) { roll -= Math.max(0, weight(row)); if (roll < 0) return row; }
  return undefined;
}
export function affixLevel(ilvl: number, qlvl: number, magicLevel = 0): number {
  const effective = Math.max(Math.min(99, ilvl), qlvl);
  return Math.max(0, Math.min(99, magicLevel > 0 ? effective + magicLevel : effective < 99 - Math.floor(qlvl / 2) ? effective - Math.floor(qlvl / 2) : 2 * effective - 99));
}
export function effectiveMagicFind(mf: number, quality: Quality): number {
  mf = Math.max(0, mf);
  if (mf <= 10 || !['unique', 'set', 'rare'].includes(quality)) return mf;
  const cap = quality === 'unique' ? 250 : quality === 'set' ? 500 : 600;
  return Math.floor(cap * mf / (cap + mf));
}
export function qualityDenominator(base: BaseItem, ilvl: number, quality: Quality, mf: number, factor = 0): number {
  const uber = !!text(base.raw, 'normcode') && text(base.raw, 'normcode') !== base.code;
  const row = rawRows('itemratio').find(r => num(r, 'Version') === 1 && !!num(r, 'Uber') === uber && !!num(r, 'Class Specific') === !!base.classId);
  if (!row) return Infinity;
  const key = ({ unique: 'Unique', set: 'Set', rare: 'Rare', magic: 'Magic', superior: 'HiQuality', normal: 'Normal' } as Partial<Record<Quality, string>>)[quality];
  if (!key) return Infinity;
  let denominator = (num(row, key) - Math.trunc((ilvl - base.qlvl) / Math.max(1, num(row, key + 'Divisor', 1)))) * 128;
  if (['unique', 'set', 'rare', 'magic'].includes(quality)) {
    denominator = Math.max(Math.trunc(denominator * 100 / (100 + effectiveMagicFind(mf, quality))), num(row, key + 'Min'));
    denominator -= Math.trunc(denominator * Math.max(0, Math.min(1024, factor)) / 1024);
  }
  return Math.max(1, denominator);
}
export function allowedSockets(base: BaseItem, ilvl: number): number {
  const row = typeRow(base.type);
  // Missing ItemTypes must never invent a socket band.
  return row ? Math.min(base.maxSockets, num(row, ilvl <= 25 ? 'MaxSock1' : ilvl <= 40 ? 'MaxSock25' : 'MaxSock40')) : 0;
}

const SCALAR: Record<string, string> = {
  str: 'strength', dex: 'dexterity', vit: 'vitality', enr: 'energy', hp: 'life', 'hp%': 'maxLifePercent', mana: 'mana', 'mana%': 'maxManaPercent', stam: 'stamina',
  att: 'attackRating', 'att%': 'attackRatingPercent', 'dmg-min': 'minDamage', 'dmg-max': 'maxDamage',
  'ac%': 'defensePercent', ac: 'defense', 'res-fire': 'resFire', 'res-cold': 'resCold', 'res-ltng': 'resLightning', 'res-pois': 'resPoison', 'res-all': 'resAll',
  'mag%': 'magicFind', 'gold%': 'goldFind', cast1: 'fcr', cast2: 'fcr', cast3: 'fcr', balance1: 'fhr', balance2: 'fhr', balance3: 'fhr',
  swing1: 'ias', swing2: 'ias', swing3: 'ias', move1: 'frw', move2: 'frw', move3: 'frw', lifesteal: 'lifeLeech', manasteal: 'manaLeech',
  'red-dmg%': 'damageReduction', 'red-dmg': 'flatReduction', 'red-mag': 'flatMagicReduction', allskills: 'allSkills', fireskill: 'fireSkills', deadly: 'deadlyStrike', 'regen-mana': 'manaRegenPercent', indestruct: 'indestructible', ethereal: 'forcedEthereal', cheap: 'vendorDiscount',
  block: 'block', block1: 'fbr', block2: 'fbr', block3: 'fbr', 'ac-hth': 'meleeDefense', 'ac-miss': 'missileDefense',
  'ignore-ac': 'ignoreTargetDefense', 'reduce-ac': 'targetDefensePercent', 'dmg-ac': 'targetDefenseReduction',
  'att-demon': 'demonAttackRating', 'att-undead': 'undeadAttackRating', 'dmg-demon': 'demonDamagePercent', 'dmg-undead': 'undeadDamagePercent',
  'res-fire-max': 'maxResFire', 'res-cold-max': 'maxResCold', 'res-ltng-max': 'maxResLightning', 'res-pois-max': 'maxResPoison', 'res-all-max': 'maxResAll',
  'extra-fire': 'fireDamagePercent', 'extra-cold': 'coldDamagePercent', 'extra-ltng': 'lightningDamagePercent', 'extra-pois': 'poisonDamagePercent',
  'pierce-fire': 'pierceFire', 'pierce-cold': 'pierceCold', 'pierce-ltng': 'pierceLightning', 'pierce-pois': 'piercePoison', pierce: 'pierceChance',
  'abs-fire': 'absorbFire', 'abs-fire%': 'absorbFirePercent', 'abs-cold': 'absorbCold', 'abs-cold%': 'absorbColdPercent',
  'abs-ltng': 'absorbLightning', 'abs-ltng%': 'absorbLightningPercent', 'abs-mag': 'absorbMagic', 'abs-mag%': 'absorbMagicPercent',
  regen: 'lifeRegen', 'regen-stam': 'staminaRegenPercent', stamdrain: 'staminaDrainPercent',
  'heal-kill': 'lifeAfterKill', 'mana-kill': 'manaAfterKill', 'demon-heal': 'lifeAfterDemonKill', 'dmg-to-mana': 'damageToMana', addxp: 'experiencePercent',
  crush: 'crushingBlow', openwounds: 'openWounds', knock: 'knockback', stupidity: 'blindTarget', howl: 'fleeChance', slow: 'slowTarget',
  freeze: 'freezeTarget', nofreeze: 'cannotBeFrozen', 'half-freeze': 'halfFreezeDuration', 'res-pois-len': 'poisonLengthResist', noheal: 'preventMonsterHeal',
  thorns: 'attackerDamage', 'light-thorns': 'attackerLightningDamage', rip: 'restInPeace', light: 'lightRadius', dmg: 'normalDamage',
  bloody: 'extraBlood', explosivearrow: 'explosiveArrow', magicarrow: 'magicArrow', stack: 'extraStack',
};
const PROPERTY_ROWS = new Map(rawRows('Properties').map(row => [text(row, 'code'), row]));
const STAT_ROWS = new Map(rawRows('ItemStatCost').map(row => [text(row, 'Stat'), row]));
const LEVEL_TARGETS: Record<string, string> = {
  armorclass: 'localDefense', maxdamage: 'localMaxDamage', tohit: 'attackRating', item_tohit_percent: 'attackRatingPercent',
  maxhp: 'lifePerLevelBonus', maxmana: 'manaPerLevelBonus', maxstamina: 'stamina', strength: 'strength', dexterity: 'dexterity', vitality: 'vitality', energy: 'energy',
  item_deadlystrike: 'deadlyStrike', item_goldbonus: 'goldFind', item_magicbonus: 'magicFind',
  coldmaxdam: 'maxCold', firemaxdam: 'maxFire', lightmaxdam: 'maxLightning', poisonmaxdam: 'poisonMaxRate',
  coldresist: 'resCold', fireresist: 'resFire', lightresist: 'resLightning', poisonresist: 'resPoison',
  item_absorbcold: 'absorbCold', item_absorbfire: 'absorbFire', item_absorblight: 'absorbLightning', item_absorbmagic: 'absorbMagic',
  staminarecoverybonus: 'staminaRegenPercent', item_attackertakesdamage: 'attackerDamage',
  item_demondamage_percent: 'demonDamagePercent', item_undeaddamage_percent: 'undeadDamagePercent',
  item_demon_tohit: 'demonAttackRating', item_undead_tohit: 'undeadAttackRating',
  item_crushingblow: 'crushingBlow', item_openwounds: 'openWounds', item_kickdamage: 'kickDamage',
};
function levelDefinition(code: string): { stat: RawRow; target: string } | undefined {
  const prop = PROPERTY_ROWS.get(code);
  if (!code.endsWith('/lvl') || !prop || num(prop, 'func1') !== 17) return;
  const stat = STAT_ROWS.get(text(prop, 'stat1'));
  if (!stat || text(stat, 'op base') !== 'level' || ![2, 4, 5].includes(num(stat, 'op'))) return;
  let target = LEVEL_TARGETS[text(stat, 'op stat1')];
  if (num(stat, 'op') === 5) target = target === 'localDefense' ? 'localDefensePercent' : target === 'localMaxDamage' ? 'localMaxDamagePercent' : '';
  return target ? { stat, target } : undefined;
}
/** Numeric keys available to consumers; descriptor and provenance keys are never stats. */
export const EQUIPMENT_SCALAR_KEYS: readonly string[] = [...new Set([
  ...Object.values(SCALAR).filter(key => key !== 'forcedEthereal'), ...Object.values(LEVEL_TARGETS),
  'localDefensePercent', 'localMaxDamagePercent', 'localDamagePercent', 'damagePercent', 'requirementsPercent', 'classSkills',
  ...['Fire', 'Cold', 'Lightning', 'Magic'].flatMap(element => ['min' + element, 'max' + element]),
  'coldLength', 'poisonLength', 'poisonMinRate', 'poisonMaxRate',
])].sort();
const SCALAR_KEYS = new Set(EQUIPMENT_SCALAR_KEYS);
const scalarKey = (key: string): boolean => SCALAR_KEYS.has(key) || /^(?:skill:\d+|classSkill:(?:ama|sor|nec|pal|bar|dru|ass)|skillTab:(?:ama|sor|nec|pal|bar|dru|ass):[0-2])$/.test(key);
function evaluateMods(saved: ItemMods, level: number): ItemMods {
  const result: ItemMods = {};
  for (const [key, value] of Object.entries(saved)) {
    if (!Number.isFinite(value)) continue;
    if (scalarKey(key)) add(result, key, value);
    else if (key.startsWith('perLevel:')) {
      const definition = levelDefinition(key.slice(9));
      if (!definition) continue;
      const { stat, target } = definition;
      const targetShift = num(STAT_ROWS.get(text(stat, 'op stat1')) ?? {}, 'ValShift');
      const shift = num(stat, 'ValShift', targetShift);
      add(result, target, Math.trunc(value * 2 ** shift * level / 2 ** num(stat, 'op param')) / 2 ** shift);
    }
  }
  return result;
}
function add(mods: ItemMods, key: string, value: number): void { mods[key] = (mods[key] ?? 0) + value; }
function skillId(parameter: string): number | undefined {
  if (/^\d+$/.test(parameter)) return Number(parameter);
  const row = rawRows('skills').find(r => text(r, 'skill').toLowerCase() === parameter.toLowerCase());
  return row ? num(row, 'Id') : undefined;
}
/** Property-specific tuple semantics; unsupported handlers retain their source tuple. */
function property(item: Item, code: string, parameter: string, min: number, max: number, rng: Rng): void {
  if (!code || code.startsWith('*')) return;
  code = code.toLowerCase(); // Raw sources include the valid case variant "Light".
  const base = getBase(item.code)!;
  const unsupported = () => add(item.mods, `unsupported:${code}:${parameter}:${min}:${max}`, 1);
  const perLevel = levelDefinition(code);
  if (perLevel) {
    if (parameter !== '' && Number.isFinite(Number(parameter))) add(item.mods, `perLevel:${code}`, Number(parameter));
    else if (parameter === '') add(item.mods, `perLevel:${code}`, integer(rng, min, max));
    else unsupported();
    return;
  }
  if (code === 'dmg%') { add(item.mods, base.slot === 'weapon' ? 'localDamagePercent' : 'damagePercent', integer(rng, min, max)); return; }
  if (SCALAR[code]) { add(item.mods, SCALAR[code], integer(rng, min, max)); return; }
  if (code === 'all-stats') { const value = integer(rng, min, max); for (const key of ['strength', 'dexterity', 'vitality', 'energy']) add(item.mods, key, value); return; }
  if (CLASS_IDS.includes(code as ClassId)) { add(item.mods, `classSkill:${code}`, integer(rng, min, max)); return; }
  if (code === 'skilltab') {
    const tab = Number(parameter);
    if (Number.isInteger(tab) && tab >= 0 && tab < CLASS_IDS.length * 3) {
      add(item.mods, `skillTab:${CLASS_IDS[Math.floor(tab / 3)]}:${tab % 3}`, integer(rng, min, max));
    } else unsupported();
    return;
  }
  if (code === 'skill' || code === 'skill-rand') {
    const id = code === 'skill-rand' ? integer(rng, min, max) : skillId(parameter);
    if (id !== undefined) add(item.mods, `skill:${id}`, code === 'skill-rand' ? Number(parameter) : integer(rng, min, max)); else unsupported();
    return;
  }
  if (code === 'randclassskill') { add(item.mods, `classSkill:${CLASS_IDS[integer(rng, min, max)]}`, 3); return; }
  if (code === 'sock') { item.sockets = Math.min(allowedSockets(base, item.ilvl), Number(parameter) || integer(rng, min, max)); return; }
  if (code === 'dur%') { add(item.mods, 'internal:durabilityPercent', integer(rng, min, max)); return; }
  if (code === 'dur') { add(item.mods, 'internal:durabilityFlat', integer(rng, min, max)); return; }
  if (code === 'ease') { add(item.mods, 'requirementsPercent', integer(rng, min, max)); return; }
  const pairs: Record<string, [string, string]> = {
    'dmg-norm': ['minDamage', 'maxDamage'], 'min-maxdmg': ['minDamage', 'maxDamage'], 'dmg-fire': ['minFire', 'maxFire'], 'dmg-cold': ['minCold', 'maxCold'],
    'dmg-ltng': ['minLightning', 'maxLightning'], 'dmg-mag': ['minMagic', 'maxMagic'], 'dmg-pois': ['poisonMinRate', 'poisonMaxRate'],
  };
  if (code === 'dmg-elem') {
    for (const element of ['Fire', 'Cold', 'Lightning']) { add(item.mods, 'min' + element, min); add(item.mods, 'max' + element, max); }
    if (parameter) add(item.mods, 'coldLength', Number(parameter));
    return;
  }
  if (pairs[code]) {
    add(item.mods, pairs[code][0], min); add(item.mods, pairs[code][1], max);
    if (code === 'dmg-cold') add(item.mods, 'coldLength', Number(parameter) || 0);
    if (code === 'dmg-pois') add(item.mods, 'poisonLength', Number(parameter) || 0);
    return;
  }
  const endpoint: Record<string, string> = { 'fire-min': 'minFire', 'fire-max': 'maxFire', 'cold-min': 'minCold', 'cold-max': 'maxCold', 'ltng-min': 'minLightning', 'ltng-max': 'maxLightning', 'pois-min': 'poisonMinRate', 'pois-max': 'poisonMaxRate', 'cold-len': 'coldLength', 'pois-len': 'poisonLength' };
  if (endpoint[code]) { add(item.mods, endpoint[code], integer(rng, min, max)); return; }
  if (code === 'aura') {
    const id = skillId(parameter);
    if (id !== undefined) add(item.mods, `aura:${id}`, integer(rng, min, max)); else unsupported();
    return;
  }
  unsupported();
}
function properties(item: Item, row: RawRow, kind: 'affix' | 'named' | 'word' | 'weapon' | 'helm' | 'shield', rng: Rng): void {
  const count = kind === 'named' ? 12 : kind === 'word' ? 7 : 3;
  for (let i = 1; i <= count; i++) {
    const keys = kind === 'affix' ? [`mod${i}code`, `mod${i}param`, `mod${i}min`, `mod${i}max`] : kind === 'named' ? [`prop${i}`, `par${i}`, `min${i}`, `max${i}`] : kind === 'word' ? [`T1Code${i}`, `T1Param${i}`, `T1Min${i}`, `T1Max${i}`] : [`${kind}Mod${i}Code`, `${kind}Mod${i}Param`, `${kind}Mod${i}Min`, `${kind}Mod${i}Max`];
    property(item, text(row, keys[0]), text(row, keys[1]), num(row, keys[2]), num(row, keys[3]), rng);
  }
}
/** Exact pinned identity for new saves, or an unambiguous real legacy line number. Never guess by name. */
export function namedItemRow(item: Item): RawRow | undefined {
  if (!['set', 'unique'].includes(item.quality)) return;
  const table = rawRows(item.quality === 'set' ? 'SetItems' : 'UniqueItems');
  const matches = (row: RawRow): boolean => text(row, 'index') === item.name && text(row, item.quality === 'set' ? 'item' : 'code') === item.code &&
    (item.quality === 'set' || num(row, 'enabled') === 1);
  if (item.mods['internal:namedTable'] === (item.quality === 'set' ? 2 : 1)) {
    const index = item.mods['internal:namedIndex'];
    return Number.isInteger(index) && index >= 0 && table[index] && matches(table[index]) ? table[index] : undefined;
  }
  const line = item.mods['internal:namedRow'];
  if (!Number.isInteger(line) || line < 0) return;
  const found = table.filter(row => num(row, 'lineNumber', -1) === line && matches(row));
  return found.length === 1 ? found[0] : undefined;
}
function setPieceId(row: RawRow): number { return rawRows('SetItems').indexOf(row); }
function setPieces(row: RawRow): RawRow[] { return rawRows('SetItems').filter(piece => text(piece, 'set') === text(row, 'set')); }
function companion(row: RawRow, index: number): RawRow | undefined {
  // The only pinned addfunc=1 row uses companion bits, not piece-count thresholds.
  const name = text(row, 'index') === "Civerb's Ward" ? index === 1 ? "Civerb's Icon" : index === 2 ? "Civerb's Cudgel" : '' : '';
  return setPieces(row).find(piece => text(piece, 'index') === name);
}
function conditionalPrefix(row: RawRow, index: number): string | undefined {
  if (num(row, 'add func') === 2) return `conditional:count${index + 1}:`;
  const required = num(row, 'add func') === 1 ? companion(row, index) : undefined;
  return required ? `conditional:piece${setPieceId(required)}:` : undefined;
}
function auxiliary(item: Item, row: RawRow, index: number, rng: Rng): void {
  for (const suffix of ['a', 'b']) property(item, text(row, `aprop${index}${suffix}`), text(row, `apar${index}${suffix}`), num(row, `amin${index}${suffix}`), num(row, `amax${index}${suffix}`), rng);
}
function wideProperties(item: Item, row: RawRow, threshold: number | 'full', rng: Rng): void {
  for (let i = threshold === 'full' ? 1 : threshold; i <= (threshold === 'full' ? 8 : threshold); i++) {
    for (const suffix of threshold === 'full' ? [''] : ['a', 'b']) {
      const stem = `${threshold === 'full' ? 'F' : 'P'}Code${i}${suffix}`;
      property(item, text(row, stem), text(row, stem.replace('Code', 'Param')), num(row, stem.replace('Code', 'Min')), num(row, stem.replace('Code', 'Max')), rng);
    }
  }
}
function saveSetBonuses(item: Item, row: RawRow, rng: Rng): void {
  const save = (prefix: string, roll: (copy: Item) => void, global = false) => {
    const copy: Item = { ...item, code: global ? 'rin' : item.code, mods: {} };
    roll(copy);
    for (const [key, value] of Object.entries(copy.mods)) item.mods[prefix + key] = value;
  };
  for (let i = 1; i <= 5; i++) {
    const prefix = conditionalPrefix(row, i);
    if (prefix) save(prefix, copy => auxiliary(copy, row, i, rng));
  }
  item.mods['internal:conditionalSaved'] = 1;
  const set = rawRows('Sets').find(set => text(set, 'index') === text(row, 'set'));
  if (!set) return;
  for (const threshold of [2, 3, 4, 5, 'full'] as const) save(`conditional:${threshold === 'full' ? 'full' : 'wide' + threshold}:`, copy => wideProperties(copy, set, threshold, rng), true);
  item.mods['internal:setWideSaved'] = 1;
}
const PAIRED_PROPERTIES = new Set(['dmg-norm', 'min-maxdmg', 'dmg-fire', 'dmg-cold', 'dmg-ltng', 'dmg-mag', 'dmg-pois', 'dmg-elem']);
function deterministicProperty(item: Item, code: string, parameter: string, min: number, max: number): ItemMods {
  if (!code || code.startsWith('*') || !(levelDefinition(code) && parameter !== '' && Number.isFinite(Number(parameter)) || PAIRED_PROPERTIES.has(code) || min === max)) return {};
  const copy = { ...item, mods: {} };
  property(copy, code, parameter, min, max, () => 0);
  return copy.mods;
}
// Staffmod codes whose per-skill expansion was already written as explicit skill:N keys
// in older save formats; restoring them again via legacyMods would double-count.
const STAFFMOD_CODES = new Set(['fireskill', 'coldskill', 'ltngskill', 'poisskill', 'magicskill']);

function legacyMods(item: Item): ItemMods {
  const mods = { ...item.mods };
  for (const [key, count] of Object.entries(item.mods)) {
    if (!key.startsWith('unsupported:') || !Number.isFinite(count)) continue;
    const [, code, parameter, low, high] = key.split(':');
    if (!low || !high || !Number.isFinite(Number(low)) || !Number.isFinite(Number(high))) continue;
    // Staffmod skill-type codes were already expanded to skill:N keys at item creation;
    // skip restoration to avoid double-counting fire/cold/etc skill bonuses.
    if (STAFFMOD_CODES.has(code)) continue;
    const restored = deterministicProperty(item, code, parameter, Number(low), Number(high));
    for (const [stat, value] of Object.entries(restored)) if (!stat.startsWith('unsupported:')) add(mods, stat, value * count);
  }
  return mods;
}
function descriptors(mods: ItemMods, prefix: string): ItemMods {
  return Object.fromEntries(Object.entries(mods).filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key.slice(prefix.length), value]));
}
function deterministicAuxiliary(item: Item, row: RawRow, index: number): ItemMods {
  const result: ItemMods = {};
  for (const suffix of ['a', 'b']) {
    const restored = deterministicProperty(item, text(row, `aprop${index}${suffix}`), text(row, `apar${index}${suffix}`), num(row, `amin${index}${suffix}`), num(row, `amax${index}${suffix}`));
    for (const [key, value] of Object.entries(restored)) add(result, key, value);
  }
  return result;
}
/** Intrinsic, per-level and per-piece set modifiers; saved rolls are never rewritten. */
export function effectiveItemModifiers(item: Item, level: number, equipped: Item[] = []): ItemMods {
  if (!item.identified || !getBase(item.code)) return {};
  const result = evaluateMods(legacyMods(item), level), row = namedItemRow(item);
  if (item.quality !== 'set' || !row) return result;
  const identities = new Set(equipped.filter(piece => piece.identified).map(namedItemRow).filter((piece): piece is RawRow => !!piece && text(piece, 'set') === text(row, 'set')).map(setPieceId));
  for (let i = 1; i <= 5; i++) {
    const prefix = conditionalPrefix(row, i);
    const required = companion(row, i);
    const enabled = num(row, 'add func') === 2 ? identities.size >= i + 1 : num(row, 'add func') === 1 && !!required && identities.has(setPieceId(required));
    if (!prefix || !enabled) continue;
    const saved = item.mods['internal:conditionalSaved'] === 1 ? descriptors(item.mods, prefix) : deterministicAuxiliary(item, row, i);
    for (const [key, value] of Object.entries(evaluateMods(saved, level))) add(result, key, value);
  }
  return result;
}
/** Set-wide modifiers have one deterministic persisted source owner, not one contribution per piece. */
export function setModifiers(equipped: Item[], level: number): ItemMods {
  const result: ItemMods = {}, groups = new Map<string, { item: Item; row: RawRow }[]>();
  for (const item of equipped) {
    const row = item.identified && item.quality === 'set' ? namedItemRow(item) : undefined;
    if (!row) continue;
    const name = text(row, 'set');
    groups.set(name, [...(groups.get(name) ?? []), { item, row }]);
  }
  for (const [name, pieces] of groups) {
    const set = rawRows('Sets').find(row => text(row, 'index') === name);
    if (!set) continue;
    const count = new Set(pieces.map(({ row }) => setPieceId(row))).size;
    const complete = rawRows('SetItems').filter(row => text(row, 'set') === name).length;
    const owner = pieces.filter(({ item }) => item.mods['internal:setWideSaved'] === 1).sort((a, b) => setPieceId(a.row) - setPieceId(b.row) || a.item.uid.localeCompare(b.item.uid))[0]?.item;
    for (const threshold of [2, 3, 4, 5, 'full'] as const) {
      if (threshold === 'full' ? count !== complete : count < threshold) continue;
      let saved: ItemMods;
      if (owner) saved = descriptors(owner.mods, `conditional:${threshold === 'full' ? 'full' : 'wide' + threshold}:`);
      else {
        saved = {};
        for (let i = threshold === 'full' ? 1 : threshold; i <= (threshold === 'full' ? 8 : threshold); i++) for (const suffix of threshold === 'full' ? [''] : ['a', 'b']) {
          const stem = `${threshold === 'full' ? 'F' : 'P'}Code${i}${suffix}`;
          const restored = deterministicProperty({ ...pieces[0].item, code: 'rin' }, text(set, stem), text(set, stem.replace('Code', 'Param')), num(set, stem.replace('Code', 'Min')), num(set, stem.replace('Code', 'Max')));
          for (const [key, value] of Object.entries(restored)) add(saved, key, value);
        }
      }
      for (const [key, value] of Object.entries(evaluateMods(saved, level))) add(result, key, value);
    }
  }
  return result;
}
/** Runtime local scaling. Static display fields remain unchanged, including legacy saves without base rolls. */
export function effectiveItemStats(item: Item, mods: ItemMods): { minDamage: number; maxDamage: number; defense: number } {
  const saved = item.mods, base = getBase(item.code);
  const delta = (key: string) => (mods[key] ?? 0) - (saved[key] ?? 0);
  const minDamage = Number.isFinite(saved['internal:baseMin']) ? Math.floor(saved['internal:baseMin'] * (100 + (mods.localDamagePercent ?? 0)) / 100) + (mods.minDamage ?? 0) : item.minDamage + delta('minDamage');
  const maxDamage = Number.isFinite(saved['internal:baseMax']) ? Math.floor(saved['internal:baseMax'] * (100 + (mods.localDamagePercent ?? 0) + (mods.localMaxDamagePercent ?? 0)) / 100) + (mods.maxDamage ?? 0) + (mods.localMaxDamage ?? 0) : item.maxDamage + delta('maxDamage') + (mods.localMaxDamage ?? 0) + Math.floor(item.maxDamage * (mods.localMaxDamagePercent ?? 0) / 100);
  const defensePercent = base?.defenseMax ? mods.defensePercent ?? 0 : 0;
  const defense = Number.isFinite(saved['internal:baseDefense']) ? Math.floor(saved['internal:baseDefense'] * (100 + defensePercent + (mods.localDefensePercent ?? 0)) / 100) + (mods.defense ?? 0) + (mods.localDefense ?? 0) : item.defense + delta('defense') + (mods.localDefense ?? 0) + Math.floor(item.defense * (mods.localDefensePercent ?? 0) / 100);
  return { minDamage: Math.max(0, minDamage), maxDamage: Math.max(minDamage, maxDamage), defense: Math.max(0, defense) };
}
function applyLocal(item: Item): void {
  const mods = item.mods;
  item.minDamage = Math.floor(mods['internal:baseMin'] * (100 + (mods.localDamagePercent ?? 0)) / 100) + (mods.minDamage ?? 0);
  item.maxDamage = Math.max(item.minDamage, Math.floor(mods['internal:baseMax'] * (100 + (mods.localDamagePercent ?? 0)) / 100) + (mods.maxDamage ?? 0));
  item.defense = Math.floor(mods['internal:baseDefense'] * (100 + (mods.defensePercent ?? 0)) / 100) + (mods.defense ?? 0);
}
function affixEligible(row: RawRow, base: BaseItem, alvl: number, rare: boolean): boolean {
  if (![1, 100].includes(num(row, 'version')) || num(row, 'spawnable') !== 1 || num(row, 'frequency') <= 0 || (rare && num(row, 'rare') !== 1)) return false;
  if (num(row, 'level') > alvl || (num(row, 'maxlevel') > 0 && alvl > num(row, 'maxlevel'))) return false;
  const cls = text(row, 'class').toLowerCase();
  if (cls && base.classId !== (CLASS_NAMES[cls] ?? cls)) return false;
  const includes = Array.from({ length: 7 }, (_, i) => text(row, `itype${i + 1}`)).filter(Boolean);
  const excludes = Array.from({ length: 5 }, (_, i) => text(row, `etype${i + 1}`)).filter(Boolean);
  return includes.some(t => itemHasType(base, t)) && !excludes.some(t => itemHasType(base, t));
}
function rollAffixes(item: Item, rng: Rng): void {
  const base = getBase(item.code)!;
  const rare = item.quality !== 'magic';
  const alvl = affixLevel(item.ilvl, base.qlvl, num(base.raw, 'magic lvl'));
  const groups = new Set<number>();
  const usedRows = new Set<RawRow>();
  const counts = [0, 0];
  const names: string[] = [];
  const choose = (side: number) => {
    const row = weighted(rawRows(side === 0 ? 'MagicPrefix' : 'MagicSuffix').filter(r => !usedRows.has(r) && affixEligible(r, base, alvl, rare) && (!num(r, 'group') || !groups.has(num(r, 'group')))), r => num(r, 'frequency'), rng);
    if (!row) return false;
    usedRows.add(row); if (num(row, 'group')) groups.add(num(row, 'group')); counts[side]++;
    properties(item, row, 'affix', rng); item.requiredLevel = Math.max(item.requiredLevel, num(row, 'levelreq'));
    names.push(text(row, 'Name')); return true;
  };
  if (!rare) {
    const roll = random(rng);
    if (roll < .25 || roll >= .75) choose(0);
    if (roll >= .25) choose(1);
    item.name = [names.find(n => !n.startsWith('of ')), base.name, names.find(n => n.startsWith('of '))].filter(Boolean).join(' ');
  } else {
    const target = Math.min(itemHasType(base, 'jewl') ? 4 : 6, [3, 4, 4, 5, 5, 6][integer(rng, 0, 5)]);
    for (let i = 0; i < target; i++) {
      let side = integer(rng, 0, 1);
      if (counts[side] >= 3) side = 1 - side;
      if (!choose(side) && counts[1 - side] < 3) choose(1 - side);
    }
    item.name = '稀有 ' + base.name;
  }
  item.mods['internal:prefixCount'] = counts[0]; item.mods['internal:suffixCount'] = counts[1];
  for (const group of groups) item.mods[`internal:affixGroup:${group}`] = 1;
}
function namedDefinitions(base: BaseItem, ilvl: number, quality: 'unique' | 'set'): RawRow[] {
  return rawRows(quality === 'unique' ? 'UniqueItems' : 'SetItems').filter(r =>
    text(r, quality === 'unique' ? 'code' : 'item') === base.code && num(r, 'lvl') <= ilvl &&
    (quality === 'set' || num(r, 'enabled') === 1) && num(r, 'rarity') > 0 && !!text(r, 'index'));
}
let uidSequence = 0;
const uidPrefix = Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
function nextUid(): string { return `item-${uidPrefix}-${++uidSequence}`; }
export function createItem(code: string, ilvl: number, rng: Rng, quality: Quality = 'normal', namedIndex?: string, source: 'drop' | 'gambling' = 'drop'): Item {
  const base = getBase(code);
  if (!base) throw new Error(`未知物品底材：${code}`);
  if (quality === 'crafted') throw new Error('手工品质必须由已支持的具体配方生成；目前未支持手工配方。');
  ilvl = Math.max(1, Math.min(99, Math.trunc(Number.isFinite(ilvl) ? ilvl : 1)));
  let definition: RawRow | undefined;
  let failedMultiplier = 1;
  if (namedIndex && quality !== 'unique' && quality !== 'set') throw new Error('指定身份仅适用于暗金或套装物品。');
  if (quality === 'unique' || quality === 'set') {
    const candidates = namedDefinitions(base, ilvl, quality);
    const named = namedIndex ? candidates.filter(row => text(row, 'index') === namedIndex) : [];
    if (named.length > 1) throw new Error(`物品名称身份不唯一：${namedIndex}`);
    definition = namedIndex ? named[0] : weighted(candidates, r => num(r, 'rarity'), rng);
    if (namedIndex && !definition) throw new Error(`此底材或物品等级不能生成：${namedIndex}`);
    if (!definition) { failedMultiplier = quality === 'unique' ? 3 : 2; quality = quality === 'unique' ? 'rare' : 'magic'; }
  }
  const eligible = base.durability > 0 && base.slot !== undefined && !itemHasType(base, 'bow') && !itemHasType(base, 'xbow') && num(base.raw, 'nodurability') !== 1;
  const item: Item = {
    uid: nextUid(), code, name: definition ? text(definition, 'index') : base.name, quality, ilvl, width: base.width, height: base.height,
    x: -1, y: -1, identified: source === 'gambling' || !['magic', 'rare', 'set', 'unique'].includes(quality), ethereal: source !== 'gambling' && eligible && !['set', 'low'].includes(quality) && random(rng) < .05,
    durability: base.durability, maxDurability: base.durability, minDamage: base.minDamage, maxDamage: base.maxDamage,
    defense: integer(rng, base.defenseMin, base.defenseMax), mods: {}, sockets: 0, socketed: [], requiredLevel: base.requiredLevel,
    price: num(base.raw, 'cost'), quantity: num(base.raw, 'stackable') ? integer(rng, num(base.raw, 'minstack', 1), num(base.raw, 'spawnstack', num(base.raw, 'maxstack', 1))) : 1,
  };
  if (definition) {
    properties(item, definition, 'named', rng);
    if (quality === 'set' && num(definition, 'add func') === 0) {
      for (let i = 1; i <= 5; i++) for (const suffix of ['a', 'b']) property(item, text(definition, `aprop${i}${suffix}`), text(definition, `apar${i}${suffix}`), num(definition, `amin${i}${suffix}`), num(definition, `amax${i}${suffix}`), rng);
    }
    item.requiredLevel = Math.max(item.requiredLevel, num(definition, 'lvl req'));
    item.mods['internal:namedRow'] = num(definition, 'lineNumber', -1);
    item.mods['internal:namedTable'] = quality === 'set' ? 2 : 1;
    item.mods['internal:namedIndex'] = rawRows(quality === 'set' ? 'SetItems' : 'UniqueItems').indexOf(definition);
    if (quality === 'set') saveSetBonuses(item, definition, rng);
  } else if (quality === 'magic' || quality === 'rare') rollAffixes(item, rng);
  else if (quality === 'superior') {
    const count = integer(rng, 1, 2);
    const options = base.slot === 'weapon' ? ['localDamagePercent', 'attackRating', 'internal:durabilityPercent'] : ['defensePercent', 'internal:durabilityPercent'];
    for (let i = 0; i < Math.min(count, options.length); i++) {
      const key = options.splice(integer(rng, 0, options.length - 1), 1)[0];
      add(item.mods, key, integer(rng, key === 'attackRating' ? 1 : key === 'internal:durabilityPercent' ? 10 : 5, key === 'attackRating' ? 3 : 15));
    }
  }
  if (item.mods.forcedEthereal) item.ethereal = true;
  if (item.mods.indestructible && !item.mods.forcedEthereal) item.ethereal = false;
  let min = base.minDamage, max = base.maxDamage, defense = item.defense;
  if ((item.mods.defensePercent ?? 0) > 0 && base.defenseMax > 0) defense = base.defenseMax + 1;
  if (quality === 'low') {
    min = base.slot === 'weapon' ? Math.max(1, Math.floor(min * .75)) : Math.floor(min * .75);
    max = Math.floor(max * .75); defense = Math.floor(defense * .75);
    item.maxDurability = Math.max(0, Math.floor((base.durability - 1) / 3));
  } else {
    item.maxDurability = Math.min(source === 'gambling' ? 255 : 333, Math.floor(base.durability * failedMultiplier * (100 + (item.mods['internal:durabilityPercent'] ?? 0)) / 100) + (item.mods['internal:durabilityFlat'] ?? 0));
  }
  if (item.ethereal) {
    min = Math.floor(min * 1.5); max = Math.floor(max * 1.5); defense = Math.floor(defense * 1.5);
    if (item.maxDurability) item.maxDurability = Math.floor(item.maxDurability / 2) + 1;
  }
  if (quality === 'superior' && item.mods.localDamagePercent && Math.floor(max * (100 + item.mods.localDamagePercent) / 100) === max) add(item.mods, 'maxDamage', 1);
  item.mods['internal:baseMin'] = min; item.mods['internal:baseMax'] = max; item.mods['internal:baseDefense'] = defense;
  item.durability = item.maxDurability;
  applyLocal(item);
  return item;
}

function droppable(base: BaseItem): boolean { return num(base.raw, 'spawnable', 1) === 1 && num(base.raw, 'quest') === 0 && !itemHasType(base, 'ques'); }
export function rollLoot(monster: Monster, rng: Rng, difficulty: Difficulty, magicFind: number): Item[] {
  const mon = rawRows('monstats').find(r => text(r, 'Id') === monster.code);
  if (!mon || num(mon, 'enabled', 1) === 0) return [];
  const suffix = difficulty === 'normal' ? '' : difficulty === 'nightmare' ? '(N)' : '(H)';
  const tcName = text(mon, `TreasureClass${monster.champion ? 2 : monster.boss ? 3 : 1}${suffix}`) || text(mon, `TreasureClass1${suffix}`);
  const tables = rawRows('TreasureClassEx');
  const byName = new Map(tables.map(r => [text(r, 'Treasure Class'), r]));
  const drops: Item[] = [];
  let budget = 512;
  const emit = (base: BaseItem, factors: Record<string, number>, encoded: string) => {
    if (!droppable(base) || drops.length >= 6) return;
    let quality: Quality = 'normal';
    if (base.slot && !itemHasType(base, 'bowq') && !itemHasType(base, 'xboq') || itemHasType(base, 'jewl') || itemHasType(base, 'char')) {
      for (const q of ['unique', 'set', 'rare', 'magic', 'superior', 'normal'] as Quality[]) {
        if (integer(rng, 0, qualityDenominator(base, monster.level, q, magicFind, factors[q] ?? 0) - 1) < 128) { quality = q; break; }
        quality = 'low';
      }
      if (itemHasType(base, 'char') && !['unique', 'magic'].includes(quality)) quality = 'magic';
    }
    const item = createItem(base.code, monster.level, rng, quality);
    if (base.code === 'gld') {
      // Legacy gold amount server arithmetic is not recovered; no invented equipment stats.
      const multiplier = Number(/mul=(\d+)/.exec(encoded)?.[1] ?? 256);
      item.quantity = Math.max(1, Math.floor(integer(rng, 1, Math.max(1, monster.level * 5)) * multiplier / 256));
    } else if (['normal', 'superior'].includes(item.quality) && allowedSockets(base, item.ilvl) > 0 && random(rng) < 1 / 3) {
      item.sockets = integer(rng, 1, Math.min(allowedSockets(base, item.ilvl), difficulty === 'normal' ? 3 : difficulty === 'nightmare' ? 4 : 6));
    }
    drops.push(item);
  };
  const visit = (encoded: string, depth: number, inherited: Record<string, number>, path: Set<string>) => {
    if (--budget < 0 || depth > 32 || drops.length >= 6) return;
    encoded = encoded.replace(/^"|"$/g, '');
    const name = encoded.split(',')[0];
    const direct = getBase(name);
    if (direct) { emit(direct, inherited, encoded); return; }
    const generated = /^(weap|armo|bow|mele)(\d+)$/.exec(name);
    if (generated) {
      const candidates = BASE_ITEMS.filter(b => droppable(b) && Math.ceil(b.qlvl / 3) * 3 === Number(generated[2]) &&
        (generated[1] === 'armo' ? itemHasType(b, 'armo') : generated[1] === 'bow' ? itemHasType(b, 'bow') : generated[1] === 'mele' ? itemHasType(b, 'mele') : itemHasType(b, 'weap')));
      const chosen = weighted(candidates, b => num(b.raw, 'rarity', 1), rng);
      if (chosen) emit(chosen, inherited, encoded);
      return;
    }
    let row = byName.get(name);
    if (!row || path.has(name)) return;
    const group = num(row, 'group');
    if (group > 0) {
      const upgrade = tables.filter(r => num(r, 'group') === group && num(r, 'level') > num(row!, 'level') && num(r, 'level') <= monster.level).sort((a, b) => num(b, 'level') - num(a, 'level'))[0];
      if (upgrade) row = upgrade;
    }
    const nextPath = new Set(path); nextPath.add(name); nextPath.add(text(row, 'Treasure Class'));
    const factors = { ...inherited };
    for (const q of ['unique', 'set', 'rare', 'magic']) factors[q] = Math.max(factors[q] ?? 0, num(row, q[0].toUpperCase() + q.slice(1)));
    const options = Array.from({ length: 10 }, (_, i) => ({ name: text(row!, `Item${i + 1}`), probability: num(row!, `Prob${i + 1}`) })).filter(v => v.name && v.probability > 0);
    const picks = num(row, 'Picks');
    if (picks < 0) {
      let remaining = -picks;
      for (const option of options) for (let i = 0; i < option.probability && remaining-- > 0; i++) visit(option.name, depth + 1, factors, nextPath);
    } else {
      for (let i = 0; i < Math.min(picks, 32); i++) {
        const option = weighted(options, o => o.probability, rng, num(row, 'NoDrop'));
        if (option) visit(option.name, depth + 1, factors, nextPath);
      }
    }
  };
  visit(tcName, 0, {}, new Set());
  return drops;
}

export const INVENTORY_WIDTH = 10;
export const INVENTORY_HEIGHT = 8;
export const STASH_WIDTH = 10;
export const STASH_HEIGHT = 10;
export const TOME_CAPACITY = 20;

/** Family matching only: full tomes still qualify so callers can report a full-book refusal. */
export function canFillTome(scroll: Item, tome: Item): boolean {
  return scroll.uid !== tome.uid && (scroll.code === 'tsc' && tome.code === 'tbk' || scroll.code === 'isc' && tome.code === 'ibk');
}

/** Consume exactly one scroll, preserving legacy scroll stacks and all unrelated inventory data. */
export function fillTome(player: Player, uid: string, tomeUid: string): Result {
  if (uid === tomeUid) return fail('卷轴和书不能是同一物品');
  const scrolls = player.inventory.filter(item => item.uid === uid);
  const tomes = player.inventory.filter(item => item.uid === tomeUid);
  if (!scrolls.length || !tomes.length) return fail('背包中找不到卷轴或书');
  if (scrolls.length !== 1 || tomes.length !== 1) return fail('物品标识重复，未填充卷轴');
  const scroll = scrolls[0], tome = tomes[0];
  if (!canFillTome(scroll, tome)) return fail('卷轴与书的类型不匹配');
  if (!Number.isInteger(tome.quantity) || tome.quantity < 0 || tome.quantity > TOME_CAPACITY) return fail('书中卷轴数量无效');
  if (tome.quantity === TOME_CAPACITY) return fail(`此书已满（${TOME_CAPACITY}/${TOME_CAPACITY}）`);
  // Above the safe-integer range, subtracting one could leave the source quantity unchanged.
  if (!Number.isSafeInteger(scroll.quantity) || scroll.quantity < 1) return fail('卷轴数量无效');
  tome.quantity += 1;
  if (scroll.quantity > 1) scroll.quantity -= 1;
  else player.inventory.splice(player.inventory.indexOf(scroll), 1);
  return success(`已填充 ${itemLabel(tome)}（${tome.quantity}/${TOME_CAPACITY}）`);
}

export function moveInventoryItem(player: Player, uid: string, x: number, y: number): Result {
  const item = player.inventory.find(item => item.uid === uid);
  if (!item) return fail('背包中找不到此物品');
  if (!fitsItem(player.inventory, item, x, y, INVENTORY_WIDTH, INVENTORY_HEIGHT)) return fail('目标格子被占用或超出背包范围');
  item.x = x; item.y = y;
  return success('已移动 ' + itemLabel(item));
}

export function fitsItem(items: Item[], item: Item, x: number, y: number, width = INVENTORY_WIDTH, height = INVENTORY_HEIGHT): boolean {
  if (![x, y, width, height, item.width, item.height].every(Number.isInteger) || x < 0 || y < 0 || item.width <= 0 || item.height <= 0 || x + item.width > width || y + item.height > height) return false;
  return items.every(other => other.uid === item.uid || x + item.width <= other.x || other.x + other.width <= x || y + item.height <= other.y || other.y + other.height <= y);
}
export function placeItem(items: Item[], item: Item, width: number, height: number): boolean {
  if (items.some(other => other.uid === item.uid)) return false;
  for (let y = 0; y <= height - item.height; y++) for (let x = 0; x <= width - item.width; x++) {
    if (fitsItem(items, item, x, y, width, height)) { item.x = x; item.y = y; items.push(item); return true; }
  }
  return false;
}
export function createStartingItems(player: Player): void {
  const cls = getClass(player.classId);
  const row = rawRows('charstats').find(r => text(r, 'class').toLowerCase() === cls.english.toLowerCase());
  if (!row) throw new Error(`缺少职业初始装备数据：${player.classId}`);
  for (let i = 1; i <= 10; i++) {
    const code = text(row, `item${i}`), count = num(row, `item${i}count`);
    if (!code) continue;
    for (let j = 0; j < count; j++) {
      const item = createItem(code, 1, () => .5);
      const location = text(row, `item${i}loc`);
      if (location === 'rarm' || location === 'larm') {
        if (player.classId === 'sor' && code === 'sst') item.mods['skill:36'] = 1;
        if (player.classId === 'nec' && code === 'wnd') item.mods['skill:70'] = 1;
        player.equipment[location === 'rarm' ? 'weapon' : 'offhand'] = item;
      } else if (code === 'hp1') {
        while (player.belt.length < 4) player.belt.push(null);
        const cell = player.belt.slice(0, 4).findIndex(potion => !potion);
        if (cell < 0) throw new Error('初始腰带底行已满');
        player.belt[cell] = item;
      } else if (!placeItem(player.inventory, item, INVENTORY_WIDTH, INVENTORY_HEIGHT)) throw new Error('初始背包空间不足');
    }
  }
}

type Result = { ok: boolean; message: string; enterArea?: number };
const fail = (message: string): Result => ({ ok: false, message });
const success = (message: string, enterArea?: number): Result => ({ ok: true, message, enterArea });
function attributes(player: Player, equipment = player.equipment, excluded?: string): Record<string, number> {
  const proposed = { ...player, equipment: Object.fromEntries(Object.entries(equipment).filter(([, item]) => item?.uid !== excluded)), inventory: player.inventory.filter(item => item.uid !== excluded) };
  const mods = equipmentModifiers(proposed);
  return { strength: player.strength + (mods.strength ?? 0), dexterity: player.dexterity + (mods.dexterity ?? 0), vitality: player.vitality + (mods.vitality ?? 0), energy: player.energy + (mods.energy ?? 0) };
}
export function itemRequirements(base: BaseItem, item: Item): { strength: number; dexterity: number } {
  const multiplier = Math.max(0, 100 + (evaluateMods(legacyMods(item), 1).requirementsPercent ?? 0)) / 100;
  return { strength: Math.max(0, Math.floor(base.strength * multiplier) - (item.ethereal ? 10 : 0)), dexterity: Math.max(0, Math.floor(base.dexterity * multiplier) - (item.ethereal && base.slot === 'weapon' ? 10 : 0)) };
}
function requirementChecks(player: Player, item: Item, equipment = player.equipment) {
  const base = getBase(item.code);
  if (!base) return [];
  const attrs = attributes(player, equipment, item.uid), req = itemRequirements(base, item);
  const checks = [{ line: '尚未辨识', message: '请先辨识物品', met: item.identified }];
  if (item.maxDurability && !effectiveItemModifiers(item, player.level).indestructible) checks.push({ line: `耐久度：${item.durability}/${item.maxDurability}`, message: '装备已经损坏', met: item.durability > 0 });
  const requiredLevel = Math.max(base.requiredLevel, item.requiredLevel);
  if (requiredLevel) checks.push({ line: `需要等级：${requiredLevel}`, message: `需要等级 ${requiredLevel}`, met: player.level >= requiredLevel });
  if (base.classId) checks.push({ line: `仅限${getClass(base.classId).name}`, message: '职业不符', met: base.classId === player.classId });
  if (req.strength) checks.push({ line: `需要力量：${req.strength}`, message: `需要力量 ${req.strength}`, met: attrs.strength >= req.strength });
  if (req.dexterity) checks.push({ line: `需要敏捷：${req.dexterity}`, message: `需要敏捷 ${req.dexterity}`, met: attrs.dexterity >= req.dexterity });
  return checks;
}
function requirementError(player: Player, item: Item, equipment = player.equipment): string | undefined {
  if (!getBase(item.code)?.slot) return '此物品不能装备';
  return requirementChecks(player, item, equipment).find(check => !check.met)?.message;
}
export function unmetItemRequirements(player: Player, item: Item): string[] {
  const base = getBase(item.code);
  const equipment = base?.slot && !Object.values(player.equipment).some(held => held?.uid === item.uid) ? equipmentChange(player, item, base).equipment : player.equipment;
  return requirementChecks(player, item, equipment).filter(check => !check.met).map(check => check.line);
}
function oneHanded(player: Player, base: BaseItem): boolean { return !base.twoHanded || player.classId === 'bar' && num(base.raw, '1or2handed') === 1; }
function dualWield(player: Player, base: BaseItem): boolean {
  return player.classId === 'bar' && base.slot === 'weapon' && oneHanded(player, base) || player.classId === 'ass' && itemHasType(base, 'h2h');
}
function packReturns(player: Player, incomingUid: string | undefined, returned: Item[], newRows: number): { inventory: Item[]; belt: (Item | null)[] } | undefined {
  const inventory = player.inventory.filter(i => i.uid !== incomingUid).map(i => ({ ...i }));
  const belt = player.belt.slice();
  for (let i = newRows * 4; i < belt.length; i++) { if (belt[i]) returned.push(belt[i]!); belt[i] = null; }
  for (const item of returned) if (!placeItem(inventory, { ...item }, INVENTORY_WIDTH, INVENTORY_HEIGHT)) return undefined;
  return { inventory, belt };
}
function applyEquipmentDamage(player: Player): void {
  for (const [slot, item] of Object.entries(player.equipment)) {
    if (!item || !['weapon', 'offhand', 'weapon2', 'offhand2'].includes(slot)) continue;
    const base = getBase(item.code);
    if (!base || !base.twoHanded || num(base.raw, '1or2handed') !== 1) continue;
    const offSlot = slot.endsWith('2') ? 'offhand2' : 'offhand';
    const mainSlot = slot.endsWith('2') ? 'weapon2' : 'weapon';
    const single = player.classId === 'bar' && (slot.startsWith('offhand') || !!player.equipment[offSlot] && player.equipment[mainSlot]?.uid !== player.equipment[offSlot]?.uid);
    let min = single ? num(base.raw, 'mindam') : num(base.raw, '2handmindam'), max = single ? num(base.raw, 'maxdam') : num(base.raw, '2handmaxdam');
    if (item.quality === 'low') { min = Math.max(1, Math.floor(min * .75)); max = Math.floor(max * .75); }
    if (item.ethereal) { min = Math.floor(min * 1.5); max = Math.floor(max * 1.5); }
    item.mods['internal:baseMin'] = min; item.mods['internal:baseMax'] = max; applyLocal(item);
  }
}
function equipmentChange(player: Player, item: Item, base: BaseItem) {
  let slot = base.slot!;
  const weapon: Slot = player.weaponSwap ? 'weapon2' : 'weapon', offhand: Slot = player.weaponSwap ? 'offhand2' : 'offhand';
  if (slot === 'ring1') slot = !player.equipment.ring1 ? 'ring1' : !player.equipment.ring2 ? 'ring2' : 'ring1';
  if (slot === 'weapon') {
    const current = player.equipment[weapon];
    const heldBase = current && getBase(current.code);
    slot = heldBase && !player.equipment[offhand] && dualWield(player, base) && dualWield(player, heldBase) ? offhand : weapon;
  } else if (slot === 'offhand') slot = offhand;
  const equipment = { ...player.equipment }, returned: Item[] = [];
  const remove = (s: Slot) => { const old = equipment[s]; if (old) { returned.push(old); delete equipment[s]; } };
  remove(slot);
  if (slot === weapon) {
    const held = equipment[offhand], heldBase = held && getBase(held.code);
    const ammunition = heldBase && (itemHasType(heldBase, 'bowq') || itemHasType(heldBase, 'xboq'));
    const matches = heldBase && (itemHasType(heldBase, 'bowq') && itemHasType(base, 'bow') || itemHasType(heldBase, 'xboq') && itemHasType(base, 'xbow'));
    if (ammunition ? !matches : !oneHanded(player, base)) remove(offhand);
  }
  if (slot === offhand) {
    const current = equipment[weapon], main = current && getBase(current.code)!;
    const ammunition = itemHasType(base, 'bowq') || itemHasType(base, 'xboq');
    if (ammunition && (!main || itemHasType(base, 'bowq') && !itemHasType(main, 'bow') || itemHasType(base, 'xboq') && !itemHasType(main, 'xbow'))) return { equipment, returned, error: '弹药与当前武器不匹配' };
    if (main && !oneHanded(player, main) && !ammunition) remove(weapon);
  }
  equipment[slot] = item;
  return { equipment, returned, error: undefined };
}
export function equipItem(player: Player, uid: string): Result {
  const item = player.inventory.find(i => i.uid === uid), base = item && getBase(item.code);
  if (!item || !base?.slot) return fail('背包中没有可装备物品');
  const { equipment, returned, error: changeError } = equipmentChange(player, item, base);
  if (changeError) return fail(changeError);
  const after = requirementError(player, item, equipment); if (after) return fail(after);
  const belt = activeEquipment({ ...player, equipment }).find(([slot]) => slot === 'belt')?.[1];
  const rows = belt ? getBase(belt.code)!.beltRows : 1;
  const packed = packReturns(player, uid, returned, rows); if (!packed) return fail('背包空间不足，未更换装备');
  item.x = -1; item.y = -1; player.equipment = equipment; player.inventory = packed.inventory; player.belt = packed.belt;
  applyEquipmentDamage(player);
  return success('已装备 ' + itemLabel(item));
}
export function unequipItem(player: Player, slot: Slot): Result {
  const item = player.equipment[slot]; if (!item) return fail('该部位没有装备');
  const equipment = { ...player.equipment }; delete equipment[slot];
  const belt = activeEquipment({ ...player, equipment }).find(([slot]) => slot === 'belt')?.[1];
  const rows = belt ? getBase(belt.code)!.beltRows : 1;
  const packed = packReturns(player, undefined, [item], rows); if (!packed) return fail('背包空间不足，未卸下装备');
  player.equipment = equipment; player.inventory = packed.inventory; player.belt = packed.belt;
  applyEquipmentDamage(player);
  return success('已卸下装备');
}

export const isUsableItem = (item: Item): boolean => /^(?:[hm]p[1-5]|rv[sl]|[ti]sc|[ti]bk)$/.test(item.code);
type PotionResult = Result & { life: number; mana: number; duration: number };
const emptyPotion = (message: string): PotionResult => ({ ...fail(message), life: 0, mana: 0, duration: 0 });
function potionResult(player: Player, item: Item): PotionResult {
  if (!/^([hm]p[1-5]|rv[sl])$/.test(item.code)) return emptyPotion('此药水状态效果尚未实现');
  const base = getBase(item.code)!;
  let life = 0, mana = 0, duration = num(base.raw, 'len') / 25;
  if (item.code.startsWith('hp')) life = num(base.raw, 'calc1') * (player.classId === 'bar' ? 2 : ['ama', 'pal', 'ass'].includes(player.classId) ? 1.5 : 1);
  else if (item.code.startsWith('mp')) mana = num(base.raw, 'calc1') * (player.classId === 'bar' ? 1 : ['ama', 'pal', 'ass'].includes(player.classId) ? 1.5 : 2);
  else {
    const stats = deriveStats(player);
    const fraction = item.code === 'rvl' ? 1 : .35;
    life = Math.floor(stats.maxLife * fraction * 256) / 256;
    mana = Math.floor(stats.maxMana * fraction * 256) / 256;
    duration = 0;
  }
  return { ...success('使用了 ' + itemLabel(item)), life, mana, duration };
}
export function consumePotion(player: Player, column: number): PotionResult {
  if (!Number.isInteger(column) || column < 0 || column > 3) return emptyPotion('药水列无效');
  const belt = activeEquipment(player).find(([slot]) => slot === 'belt')?.[1];
  const rows = belt ? getBase(belt.code)!.beltRows : 1;
  let index = column;
  while (index < rows * 4 && !player.belt[index]) index += 4;
  const item = player.belt[index]; if (!item || index >= rows * 4) return emptyPotion('此列没有药水');
  const result = potionResult(player, item); if (!result.ok) return result;
  const remaining: Item[] = [];
  for (let i = column; i < rows * 4; i += 4) if (i !== index && player.belt[i]) remaining.push(player.belt[i]!);
  for (let row = 0; row < rows; row++) player.belt[column + row * 4] = remaining[row] ?? null;
  return result;
}
export function consumeInventoryPotion(player: Player, uid: string): PotionResult {
  const index = player.inventory.findIndex(item => item.uid === uid);
  if (index < 0) return emptyPotion('背包中找不到此药水');
  const result = potionResult(player, player.inventory[index]);
  if (result.ok) player.inventory.splice(index, 1);
  return result;
}

function socketContext(base: BaseItem): 'weapon' | 'helm' | 'shield' {
  return base.slot === 'weapon' ? 'weapon' : itemHasType(base, 'shld') ? 'shield' : 'helm';
}
export function insertSocket(player: Player, itemUid: string, runeUid: string): Result {
  const containers = [player.inventory, player.cube, player.stash];
  const item = containers.flat().find(i => i.uid === itemUid) ?? Object.values(player.equipment).find(i => i?.uid === itemUid);
  const source = containers.find(c => c.some(i => i.uid === runeUid)), rune = source?.find(i => i.uid === runeUid);
  if (!item || !rune || item.uid === rune.uid) return fail('找不到镶嵌物品');
  const base = getBase(item.code)!, inserted = getBase(rune.code)!;
  if (!base.maxSockets || !['weapon', 'body', 'head'].includes(base.slot ?? '') && !itemHasType(base, 'shld')) return fail('此底材不能镶嵌');
  if (!item.sockets || item.socketed.length >= item.sockets) return fail('没有空余凹槽');
  if (!itemHasType(inserted, 'rune') && !itemHasType(inserted, 'gem')) return fail('目前仅支持符文或宝石镶嵌');
  const row = rawRows('gems').find(r => text(r, 'code') === rune.code);
  if (!row) return fail('缺少宝石/符文属性表，未消耗物品');
  const context = socketContext(base);
  if (![1, 2, 3].some(i => !!text(row, `${context}Mod${i}Code`))) return fail('该底材没有可执行的镶嵌属性');
  const copy: Item = { ...item, mods: { ...item.mods }, socketed: [...item.socketed, rune.code] };
  if (item.socketed.length === 0 && !item.runeword) {
    for (const [key, value] of Object.entries(item.mods)) copy.mods['socketBase:' + key] = value;
    copy.mods['internal:preSocketSaved'] = 1;
    copy.mods['internal:preSocketLevel'] = item.requiredLevel;
  }
  properties(copy, row, context, Math.random); copy.requiredLevel = Math.max(copy.requiredLevel, inserted.requiredLevel);
  if (!copy.runeword && ['normal', 'superior'].includes(copy.quality) && copy.socketed.length === copy.sockets) {
    const word = RUNEWORDS.find(w => w.runes.length === copy.sockets && w.runes.every((r, i) => r === copy.socketed[i]) && w.types.some(t => itemHasType(base, t)) &&
      !Array.from({ length: 3 }, (_, i) => text(w.raw, `etype${i + 1}`)).filter(Boolean).some(t => itemHasType(base, t)));
    if (word) { copy.runeword = word.name; copy.identified = true; properties(copy, word.raw, 'word', Math.random); }
  }
  applyLocal(copy); Object.assign(item, copy); source!.splice(source!.findIndex(i => i.uid === runeUid), 1);
  return success(copy.runeword ? '制成符文之语：' + runewordName(copy.runeword) : '已镶嵌 ' + itemLabel(rune));
}

function matchesCodes(items: Item[], codes: string[]): boolean {
  return items.length === codes.length && [...items.map(i => i.code)].sort().join(',') === [...codes].sort().join(',');
}
export function transmute(player: Player): Result {
  const items = player.cube;
  if (!items.length) return fail('方块是空的');
  // Uber portal recipes — hell difficulty only
  if (player.difficulty === 'hell') {
    const codes = [...items.map(i => i.code)].sort().join(',');
    if (codes === 'pk1,pk2,pk3') {
      // Randomly open one of the three key portals not yet opened
      const targets = [133, 134, 135].filter(id => !(player.quests[`hell:uberPortal:${id}`]));
      if (!targets.length) return fail('三个钥匙传送门均已开启。');
      const target = targets[Math.floor(Math.random() * targets.length)];
      player.quests[`hell:uberPortal:${target}`] = 1;
      player.cube = [];
      const names: Record<number,string> = {133:'主母之巢',134:'遗忘沙漠',135:'苦痛熔炉'};
      return success(`恐惧、憎恨、毁灭之钥消耗！${names[target]}传送门已开启。`, target);
    }
    if (codes === 'bey,dhn,mbr') {
      if (player.quests['hell:uberPortal:136']) return fail('超级崔斯特瑞姆传送门已开启。');
      player.quests['hell:uberPortal:136'] = 1;
      player.cube = [];
      return success('迪亚波罗之角、巴尔之眼、墨菲斯托之脑消耗！超级崔斯特瑞姆传送门已开启。', 136);
    }
  }
  let output: Item | undefined;
  // Same-grade, same-family gems use Misc.BetterGem, never a made-up progression.
  if (items.length === 3 && items.every(i => i.code === items[0].code)) {
    const base = getBase(items[0].code)!, next = text(base.raw, 'BetterGem');
    if (itemHasType(base, 'gem') && getBase(next)) output = createItem(next, 1, Math.random);
    else if (items[0].code === 'rvs') output = createItem('rvl', 1, Math.random);
  }
  if (!output) {
    // CubeMain is the authoritative source of rune quantities and gem requirements.
    const recipes = rawRows('cubemain').filter(r => num(r, 'enabled') === 1 && /^r\d{2}$/.test(text(r, 'output')) && text(r, 'input 1').startsWith('r'));
    for (const recipe of recipes) {
      const codes: string[] = [];
      let supported = true;
      for (let i = 1; i <= 7; i++) {
        const input = text(recipe, `input ${i}`).replace(/^"|"$/g, ''); if (!input) continue;
        const match = /^([a-z0-9]{3})(?:,qty=(\d+))?$/.exec(input);
        if (!match || !getBase(match[1])) { supported = false; break; }
        for (let j = 0; j < Number(match[2] ?? 1); j++) codes.push(match[1]);
      }
      if (supported && matchesCodes(items, codes)) { output = createItem(text(recipe, 'output'), 1, Math.random); break; }
    }
    // El..Ort have no gem. This verified subset also works while CubeMain is absent.
    if (!output && items.length === 3 && items.every(i => i.code === items[0].code) && /^r0[1-9]$/.test(items[0].code)) output = createItem(`r${String(Number(items[0].code.slice(1)) + 1).padStart(2, '0')}`, 1, Math.random);
  }
  if (!output) {
    const equipment = items.filter(i => !!getBase(i.code)?.slot && getBase(i.code)!.maxSockets > 0);
    if (equipment.length === 1) {
      const item = equipment[0], base = getBase(item.code)!, ingredients = items.filter(i => i.uid !== item.uid);
      const context = socketContext(base);
      const socketCodes = base.slot === 'weapon' ? ['r08', 'r11', 'gpv'] : base.slot === 'body' ? ['r07', 'r10', 'gpy'] : context === 'shield' ? ['r07', 'r11', 'gpr'] : base.slot === 'head' ? ['r08', 'r10', 'gpb'] : [];
      if (item.quality === 'normal' && item.sockets === 0 && socketCodes.length && matchesCodes(ingredients, socketCodes) && allowedSockets(base, item.ilvl) > 0) {
        output = { ...item, mods: { ...item.mods }, socketed: [] };
        output.sockets = Math.min(integer(Math.random, 1, 6), allowedSockets(base, item.ilvl));
        if (item.ethereal && base.slot !== 'weapon') output.mods['internal:baseDefense'] = Math.floor(output.mods['internal:baseDefense'] * 1.5); // LoD ebug, not D2R.
        applyLocal(output);
      } else if (item.sockets > 0 && matchesCodes(ingredients, ['r15', 'tsc'])) {
        // Reconstruct only content/word contributions from persisted intrinsic mods.
        const intrinsic = item.mods['internal:preSocketSaved'] === 1;
        if (!intrinsic) return fail('此物品没有保存镶嵌前属性，无法安全清孔');
        const mods: ItemMods = {};
        for (const [key, value] of Object.entries(item.mods)) if (key.startsWith('socketBase:')) mods[key.slice(11)] = value;
        output = { ...item, mods, socketed: [], runeword: undefined, requiredLevel: item.mods['internal:preSocketLevel'] ?? base.requiredLevel };
        applyLocal(output);
      }
    }
  }
  if (!output && items.length === 2) {
    const item = items.find(i => getBase(i.code)?.slot && getBase(i.code)!.durability > 0);
    if (item && !item.ethereal && matchesCodes(items.filter(i => i.uid !== item.uid), [getBase(item.code)!.slot === 'weapon' ? 'r09' : 'r08'])) output = { ...item, mods: { ...item.mods }, socketed: [...item.socketed], durability: item.maxDurability };
  }
  if (!output) return fail('没有匹配的已支持赫拉迪克配方');
  const packed: Item[] = [];
  if (!placeItem(packed, output, 3, 4)) return fail('合成物品无法放入方块');
  player.cube = packed;
  return success('合成了 ' + itemLabel(output));
}

const PREFIX_NAMES = [...new Set(rawRows('MagicPrefix').map(row => text(row, 'Name')).filter(Boolean))].sort((a, b) => b.length - a.length);
const SUFFIX_NAMES = [...new Set(rawRows('MagicSuffix').map(row => text(row, 'Name')).filter(Boolean))].sort((a, b) => b.length - a.length);
const WORD_KEYS = new Map(rawRows('Runes').filter(row => num(row, 'complete') === 1).flatMap(row => {
  const key = text(row, 'Name'), name = text(row, 'Rune Name');
  return [name, WORD_NAMES[name], key].filter(Boolean).map(alias => [alias, key] as const);
}));
WORD_KEYS.set('Infinity', 'Runeword60');
export const runewordName = (name: string): string => itemName(WORD_KEYS.get(name) ?? name);
export function itemLabel(item: Item): string {
  const base = getBase(item.code), name = base?.name ?? itemName(item.code);
  if (item.code === 'gld') return `${item.quantity} ${name}`;
  if (!item.identified) return `未鉴定的${name}`;
  if (/^r\d{2}$/.test(item.code)) return `${Number(item.code.slice(1))}号 · ${name}`;
  if (item.runeword) return runewordName(item.runeword);
  if (item.quality === 'unique' || item.quality === 'set') return itemName(item.name);
  if (item.quality === 'magic') {
    let remaining = item.name;
    const prefix = PREFIX_NAMES.find(key => remaining.startsWith(key + ' '));
    if (prefix) remaining = remaining.slice(prefix.length + 1);
    const suffix = SUFFIX_NAMES.find(key => remaining.endsWith(' ' + key));
    if (suffix) remaining = remaining.slice(0, -suffix.length - 1);
    if ([name, base?.english, CN[item.code]].includes(remaining)) return [suffix && itemName(suffix), prefix && itemName(prefix), name].filter(Boolean).join('');
  }
  return `${item.quality === 'low' ? itemName('Low Quality') : item.quality === 'superior' ? '超强' : item.quality === 'rare' ? '稀有' : ''}${name}`;
}
const MOD_LABELS: Record<string, string> = {
  strength: '力量', dexterity: '敏捷', vitality: '体力', energy: '精力', life: '生命', mana: '法力', stamina: '耐力', attackRating: '攻击准确率', attackRatingPercent: '攻击准确率%',
  localDamagePercent: '武器增强伤害%', damagePercent: '增强伤害%', minDamage: '最小伤害', maxDamage: '最大伤害', defense: '防御', defensePercent: '增强防御%',
  resFire: '火焰抗性%', resCold: '冰冷抗性%', resLightning: '闪电抗性%', resPoison: '毒素抗性%', resAll: '所有抗性%', magicFind: '更佳获取魔法装备几率%', goldFind: '额外金币%',
  fcr: '快速施法速度%', fhr: '快速打击恢复%', ias: '提升攻击速度%', frw: '快速跑步/行走%', lifeLeech: '击中偷取生命%', manaLeech: '击中偷取法力%',
  damageReduction: '伤害减少%', flatReduction: '伤害减少', flatMagicReduction: '魔法伤害减少', allSkills: '所有技能', fireSkills: '火焰技能', deadlyStrike: '致命攻击%', manaRegenPercent: '法力回复速度%', maxManaPercent: '最大法力%', maxLifePercent: '最大生命%', requirementsPercent: '装备需求%', indestructible: '无法破坏', vendorDiscount: '商店价格降低%',
  block: '格挡几率%', fbr: '快速格挡速度%', meleeDefense: '近战防御', missileDefense: '远程防御',
  ignoreTargetDefense: '无视目标防御', targetDefensePercent: '目标防御降低%', targetDefenseReduction: '每次击中降低目标防御',
  demonAttackRating: '对恶魔攻击准确率', undeadAttackRating: '对不死生物攻击准确率', demonDamagePercent: '对恶魔伤害%', undeadDamagePercent: '对不死生物伤害%',
  maxResFire: '最大火焰抗性%', maxResCold: '最大冰冷抗性%', maxResLightning: '最大闪电抗性%', maxResPoison: '最大毒素抗性%', maxResAll: '最大所有抗性%',
  fireDamagePercent: '火焰技能伤害%', coldDamagePercent: '冰冷技能伤害%', lightningDamagePercent: '闪电技能伤害%', poisonDamagePercent: '毒素技能伤害%',
  pierceFire: '降低敌人火焰抗性%', pierceCold: '降低敌人冰冷抗性%', pierceLightning: '降低敌人闪电抗性%', piercePoison: '降低敌人毒素抗性%', pierceChance: '穿刺攻击几率%',
  absorbFire: '火焰吸收', absorbFirePercent: '火焰吸收%', absorbCold: '冰冷吸收', absorbColdPercent: '冰冷吸收%',
  absorbLightning: '闪电吸收', absorbLightningPercent: '闪电吸收%', absorbMagic: '魔法吸收', absorbMagicPercent: '魔法吸收%',
  lifeRegen: '生命回复', staminaRegenPercent: '耐力回复速度%', staminaDrainPercent: '耐力消耗降低%',
  lifeAfterKill: '击杀回复生命', manaAfterKill: '击杀回复法力', lifeAfterDemonKill: '击杀恶魔回复生命', damageToMana: '受伤转化法力%', experiencePercent: '获得经验%',
  crushingBlow: '压碎性打击%', openWounds: '撕开伤口%', knockback: '击退', blindTarget: '致盲目标', fleeChance: '使目标逃跑%', slowTarget: '减慢目标%',
  freezeTarget: '冻结目标', cannotBeFrozen: '无法冰冻', halfFreezeDuration: '冰冻持续时间减半', poisonLengthResist: '毒素持续时间减少%', preventMonsterHeal: '防止怪物自疗',
  attackerDamage: '攻击者受到伤害', attackerLightningDamage: '攻击者受到闪电伤害', restInPeace: '杀死怪物后安息', lightRadius: '照亮范围', normalDamage: '附加伤害',
  localDefense: '防御', localDefensePercent: '增强防御%', localMaxDamage: '最大伤害', localMaxDamagePercent: '最大伤害增强%',
  lifePerLevelBonus: '生命', manaPerLevelBonus: '法力', kickDamage: '踢击伤害', extraBlood: '额外血迹', explosiveArrow: '爆炸箭', magicArrow: '魔法箭', extraStack: '额外堆叠容量',
  minFire: '最小火焰伤害', maxFire: '最大火焰伤害', minCold: '最小冰冷伤害', maxCold: '最大冰冷伤害', minLightning: '最小闪电伤害', maxLightning: '最大闪电伤害', minMagic: '最小魔法伤害', maxMagic: '最大魔法伤害',
  coldLength: '冰冷持续帧数', poisonMinRate: '最小每帧毒素速率', poisonMaxRate: '最大每帧毒素速率', poisonLength: '毒素持续帧数',
};
const PARSED_ONLY = new Set([
  'flatMagicReduction', 'fbr', 'meleeDefense', 'missileDefense', 'ignoreTargetDefense', 'targetDefensePercent', 'targetDefenseReduction',
  'demonAttackRating', 'undeadAttackRating', 'demonDamagePercent', 'undeadDamagePercent', 'fireDamagePercent', 'coldDamagePercent', 'lightningDamagePercent', 'poisonDamagePercent',
  'pierceFire', 'pierceCold', 'pierceLightning', 'piercePoison', 'pierceChance', 'absorbFire', 'absorbFirePercent', 'absorbCold', 'absorbColdPercent', 'absorbLightning', 'absorbLightningPercent', 'absorbMagic', 'absorbMagicPercent',
  'lifeRegen', 'staminaRegenPercent', 'staminaDrainPercent', 'lifeAfterKill', 'manaAfterKill', 'lifeAfterDemonKill', 'damageToMana', 'experiencePercent', 'vendorDiscount',
  'crushingBlow', 'openWounds', 'knockback', 'blindTarget', 'fleeChance', 'slowTarget', 'freezeTarget', 'cannotBeFrozen', 'halfFreezeDuration', 'poisonLengthResist', 'preventMonsterHeal',
  'attackerDamage', 'attackerLightningDamage', 'restInPeace', 'lightRadius', 'normalDamage', 'kickDamage', 'extraBlood', 'explosiveArrow', 'magicArrow', 'extraStack',
]);
export function describeItem(item: Item, player?: Player): string[] {
  const base = getBase(item.code), lines = [itemLabel(item)];
  if (!base) return [...lines, '未知底材（不支持）'];
  if (item.runeword) lines.push(base.name, item.socketed.map(code => getBase(code)?.name ?? code).join(' → '));
  if (base.slot === 'weapon') lines.push(`伤害：${item.minDamage}–${item.maxDamage}${base.twoHanded ? '（双手）' : ''}`);
  if (base.defenseMax) lines.push(`防御：${item.defense}`);
  if (item.maxDurability) lines.push(`耐久度：${item.durability}/${item.maxDurability}`);
  const req = itemRequirements(base, item);
  if (req.strength) lines.push(`需要力量：${req.strength}`);
  if (req.dexterity) lines.push(`需要敏捷：${req.dexterity}`);
  if (item.requiredLevel) lines.push(`需要等级：${item.requiredLevel}`);
  if (base.classId) lines.push(`仅限${getClass(base.classId).name}`);
  if (item.ethereal) lines.push('无形（无法修复）');
  if (item.sockets) lines.push(`凹槽：${item.socketed.length}/${item.sockets}`);
  if (item.code === 'tbk' || item.code === 'ibk') lines.push(`数量：${item.quantity}/${TOME_CAPACITY}`);
  else if (num(base.raw, 'stackable')) lines.push(`数量：${item.quantity}`);
  if (item.identified) {
    const row = namedItemRow(item), equipped = player ? activeEquipment(player).map(([, piece]) => piece) : [];
    const identities = new Set(equipped.map(namedItemRow).filter((piece): piece is RawRow => !!piece && !!row && text(piece, 'set') === text(row, 'set')).map(setPieceId));
    if (item.quality === 'set') lines.push(row ? `套装：${itemName(text(row, 'set'))}${player ? `（有效部件 ${identities.size}/${setPieces(row).length}）` : '（组合奖励按有效的不同部件计算）'}` : '套装身份未解析：不计算组合奖励');
    const display = (key: string, value: number, context = ''): void => {
      if (!value || !Number.isFinite(value) || /^(internal|socketBase|source):/.test(key) || key === 'forcedEthereal') return;
      if (key.startsWith('conditional:')) {
        const match = /^conditional:(count\d+|wide\d+|piece\d+|full):(.+)$/.exec(key);
        if (!match || !row) return;
        const [kind, effect] = [match[1], match[2]];
        const required = kind.startsWith('piece') ? rawRows('SetItems')[Number(kind.slice(5))] : undefined;
        const threshold = Number(kind.replace(/\D/g, ''));
        const condition = required ? `搭配${itemName(text(required, 'index'))}` : kind === 'full' ? '全套' : `${threshold}种部件`;
        const enabled = player && (required ? identities.has(setPieceId(required)) : kind === 'full' ? identities.size === setPieces(row).length : identities.size >= threshold);
        display(effect, value, `${kind.startsWith('wide') || kind === 'full' ? '套装整体' : '套装单件'}（${condition}${player ? enabled ? '，条件已满足' : '，条件未满足' : ''}）：`);
        return;
      }
      if (key.startsWith('perLevel:')) {
        const def = levelDefinition(key.slice(9));
        if (def) lines.push(`${context}每角色等级 +${value / 2 ** num(def.stat, 'op param')} ${MOD_LABELS[def.target]}${PARSED_ONLY.has(def.target) ? '（仅保存，效果未接入）' : ''}${player ? `（当前 ${evaluateMods({ [key]: value }, player.level)[def.target]}）` : ''}`);
        return;
      }
      if (key.startsWith('unsupported:')) {
        const [, code, parameter, min, max] = key.split(':');
        const restored = deterministicProperty(item, code, parameter, Number(min), Number(max));
        const supported = Object.entries(restored).filter(([stat]) => !stat.startsWith('unsupported:') && !stat.startsWith('internal:'));
        if (supported.length) for (const [stat, amount] of supported) display(stat, amount * value, context);
        else lines.push(`${context}未实现属性：${code}（参数 ${parameter || '—'}，${min}–${max}）`);
      } else if (/^skill:\d+$/.test(key)) { const id = Number(key.slice(6)); lines.push(`${context}+${value} ${getSkill(id)?.name ?? `技能 ${id}`}（本职业技能）`); }
      else if (key.startsWith('classSkill:') && scalarKey(key)) lines.push(`${context}+${value} ${getClass(key.slice(11) as ClassId).name}技能`);
      else if (key.startsWith('skillTab:') && scalarKey(key)) {
        const [, classId, tree] = key.split(':'), def = getClass(classId as ClassId);
        lines.push(`${context}+${value} ${def.trees[Number(tree)]}（仅限${def.name}）`);
      } else if (MOD_LABELS[key]) {
        if (!context && (/^(min|max)(Fire|Cold|Lightning|Magic)$/.test(key) || ['coldLength', 'poisonLength', 'poisonMinRate', 'poisonMaxRate'].includes(key))) return;
        lines.push(`${context}${value > 0 ? '+' : ''}${value} ${MOD_LABELS[key]}${PARSED_ONLY.has(key) ? '（仅保存，效果未接入）' : ''}`);
      } else if (!key.includes(':')) lines.push(`未实现属性：${key} ${value}`);
    };
    for (const [key, value] of Object.entries(item.mods)) display(key, value);
    if (row && item.quality === 'set' && item.mods['internal:conditionalSaved'] !== 1) {
      for (let i = 1; i <= 5; i++) {
        const prefix = conditionalPrefix(row, i);
        if (!prefix) continue;
        const deterministic = deterministicAuxiliary(item, row, i);
        for (const [key, value] of Object.entries(deterministic)) display(prefix + key, value);
      }
      lines.push('旧物品缺失的随机组合奖励保持未解析，不补随机');
    }
    for (const [key, label] of [['Fire', '火焰'], ['Cold', '冰冷'], ['Lightning', '闪电'], ['Magic', '魔法']]) if (item.mods['min' + key] || item.mods['max' + key]) lines.push(`增加 ${item.mods['min' + key] ?? 0}–${item.mods['max' + key] ?? 0} ${label}伤害`);
    if (item.mods.poisonLength) lines.push(`毒素：${item.mods.poisonMinRate ?? 0}–${item.mods.poisonMaxRate ?? 0}/256 每帧，持续 ${item.mods.poisonLength} 帧（聚合待实现）`);
  } else lines.push('尚未辨识');
  if (/^[hm]p[1-5]$/.test(item.code)) lines.push(`按职业回复，持续 ${num(base.raw, 'len')} 帧`);
  if (item.code === 'rvl') lines.push('大紫：立即恢复全部生命与法力，按当前实际资源上限计算。');
  if (item.quality === 'unique' && item.code === 'rin' && item.name === 'The Stone of Jordan') lines.push('黑毛事件尚未开放：出售乔丹之石不会召唤暗黑破坏神克隆。');
  if (/^pk[1-3]$/.test(item.code)) lines.push('地狱难度收集三把钥匙后，在赫拉迪克方块中合成可开启潘多蒙邪传事件传送门。');
  return lines;
}
/** Shared by the engine and shop UI; this is the existing sell formula, not a stack valuation. */
export function itemSellPrice(item: Item, difficulty: Difficulty, act: number): number | null {
  if (item.code === 'box' || getBase(item.code)?.type === 'ques') return null;
  return Math.min(Math.max(1, Math.floor(item.price / 4)), difficulty === 'normal' ? 5000 * act : difficulty === 'nightmare' ? 30000 : 35000);
}

export function vendorStock(player: Player, rng: Rng, npcId = 'akara'): Item[] {
  const ilvl = Math.min(12, player.level + 5);
  const stock: Item[] = [];
  if (npcId !== 'charsi') {
    const tier = player.difficulty === 'hell' ? 5 : player.difficulty === 'nightmare' ? 4 : Math.min(5, 1 + Math.floor((player.level - 1) / 8));
    for (let i = 1; i <= tier; i++) for (const prefix of ['hp', 'mp']) stock.push(createItem(prefix + i, ilvl, () => .5));
    for (const code of ['tsc', 'isc', 'tbk', 'ibk', 'key', 'rvl', ...RUNES.map(rune => rune.code), ...GEMS.map(gem => gem.code), 'pk1', 'pk2', 'pk3']) stock.push(createItem(code, ilvl, () => .5));
    const jordanRow = rawRows('UniqueItems').find(row => text(row, 'index') === 'The Stone of Jordan')!;
    const jordan = createItem('rin', num(jordanRow, 'lvl'), () => .5, 'unique', 'The Stone of Jordan');
    jordan.identified = true; jordan.price = num(getBase('rin')!.raw, 'cost') * num(jordanRow, 'cost mult') + num(jordanRow, 'cost add'); stock.push(jordan);
  }
  const vendorColumn = npcId === 'charsi' ? 'CharsiMax' : 'AkaraMax';
  const candidates = BASE_ITEMS.filter(base => base.slot && droppable(base) && base.qlvl <= ilvl && base.requiredLevel <= player.level && (!base.classId || base.classId === player.classId) &&
    (!text(base.raw, 'normcode') || text(base.raw, 'normcode') === base.code) && num(base.raw, vendorColumn) > 0 && base.code !== 'box' && (npcId !== 'charsi' || base.slot === 'weapon'));
  const available = [...candidates];
  for (let i = 0; i < 12 && available.length; i++) {
    const base = weighted(available, b => num(b.raw, 'rarity', 1), rng)!; available.splice(available.indexOf(base), 1);
    const item = createItem(base.code, ilvl, rng, player.level >= 25 ? 'magic' : 'normal');
    if (item.ethereal) { item.ethereal = false; item.mods['internal:baseMin'] = base.minDamage; item.mods['internal:baseMax'] = base.maxDamage; item.mods['internal:baseDefense'] = integer(rng, base.defenseMin, base.defenseMax); item.maxDurability = item.durability = base.durability; applyLocal(item); }
    item.identified = true; stock.push(item);
  }
  return stock;
}
function itemRepairCost(item: Item): number {
  if (item.ethereal || item.mods.indestructible || item.maxDurability <= 0 || item.durability >= item.maxDurability) return 0;
  return Math.max(1, Math.ceil(num(getBase(item.code)!.raw, 'cost') * (item.maxDurability - item.durability) / item.maxDurability / 4));
}
export function repairCost(player: Player): number { return Object.values(player.equipment).reduce((sum, item) => sum + (item ? itemRepairCost(item) : 0), 0); }
export function repairItems(player: Player): Result {
  const cost = repairCost(player);
  if (player.gold < cost) return fail(`金币不足，维修需要 ${cost}`);
  if (!cost) return success('没有可维修的装备（无形装备无法维修）');
  player.gold -= cost;
  for (const item of Object.values(player.equipment)) if (item && itemRepairCost(item)) item.durability = item.maxDurability;
  return success(`维修完成，花费 ${cost} 金币`);
}
