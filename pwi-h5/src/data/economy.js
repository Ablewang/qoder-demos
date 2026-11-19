// Original single-player adaptation. Deliberately independent of ITEMS/model.
const freeze = (value) => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const item = (itemId, quantity = 1) => ({ type: 'item', itemId, quantity });
const money = (type, quantity) => ({ type, quantity });
const equip = (slot, quality) => ({ type: 'equip', slot, quality, quantity: 1, level: 'player' });
const namedEquip = (templateId) => ({ type: 'equip', templateId, quantity: 1 });
const cosmetic = (cosmeticId) => ({ type: 'cosmetic', cosmeticId, quantity: 1 });
const classicItems = new Set(['huanxian', 'tiangang', 'disha', 'qiankun', 'charmHp', 'charmMp', 'zongzi', 'julin']);
const product = (id, name, category, currency, price, quantity, dailyLimit, minLevel, rewards) =>
  ({ id, name, category, currency, price, quantity, dailyLimit, minLevel, rewards, enabled: true,
    catalog: classicItems.has(id) ? 'classic' : 'adaptation' });
const prize = (id, name, weight, rarity, rewards) => ({ id, name, weight, rarity, rewards });

export const ECONOMY_LIMITS = freeze({
  purchaseQuantity: 99, exchangeQuantity: 99, openCount: 10, history: 100,
  orders: 100, balance: 1e12, itemStack: 1e7, bag: 80, pity: 50,
});
export const SHOP_CATEGORIES = freeze([
  { id: 'supplies', name: '本作补给' }, { id: 'cultivation', name: '精炼与灵符' },
  { id: 'gems', name: '魂石·改编' }, { id: 'bundles', name: '本作礼包' },
  { id: 'outfit', name: '本作时装' }, { id: 'mount', name: '本作骑宠' },
  { id: 'flyer', name: '本作飞行器' }, { id: 'activity', name: '宝盒与粽礼' },
]);
export const COSMETICS = freeze([
  { id: 'outfitCloud', name: '流云素衣', slot: 'outfit', minLevel: 1, desc: '角色名片的流云时装文字外观。' },
  { id: 'outfitBamboo', name: '青竹雅装', slot: 'outfit', minLevel: 1, desc: '角色名片的青竹时装文字外观。' },
  { id: 'outfitLucky', name: '鸿运锦衣', slot: 'outfit', minLevel: 1, desc: '秘宝传说时装；角色名片展示，不增加属性。' },
  { id: 'mountDeer', name: '踏露灵鹿', slot: 'mount', minLevel: 1, desc: '名片展示骑乘形象，不改变地图移动或战斗。' },
  { id: 'mountJade', name: '碧玉灵驹', slot: 'mount', minLevel: 1, desc: '常驻粽礼坐骑文字外观，不提供3D骑乘。' },
  { id: 'flyerKite', name: '纸鸢飞行器', slot: 'flyer', minLevel: 30, desc: '文字飞行外观；佩戴后开启现有飞行资格。' },
  { id: 'flyerLotus', name: '莲华飞行器', slot: 'flyer', minLevel: 30, desc: '文字飞行外观；佩戴后开启现有飞行资格。' },
]);
export const CHARM_CONFIG = freeze({
  charmHp: { slot: 'hp', charge: 600000, minLevel: 1 },
  charmMp: { slot: 'mp', charge: 900000, minLevel: 1 },
});

const supplies = [
  ...['hp', 'mp'].flatMap((type) => [1, 2, 3, 4, 5].map((tier) => product(
    `${type}${tier}`, `${(type === 'hp' ? ['金创药', '大还丹', '九转还魂丹', '天香续命露', '仙灵玉露'] : ['回灵散', '凝神丹', '紫府灵丹', '天心玉髓', '太清仙露'])[tier - 1]}（10份）`, 'supplies', 'boundYuanbao',
    [3, 6, 10, 15, 20][tier - 1], 10, 10, [1, 15, 35, 60, 85][tier - 1], [item(`${type}${tier}`, 10)],
  ))),
  product('town', '回城符', 'supplies', 'boundYuanbao', 2, 3, 10, 1, [item('town', 3)]),
  product('revive', '复活卷轴', 'supplies', 'yuanbao', 8, 1, 10, 1, [item('revive')]),
  product('julin', '聚灵丹', 'supplies', 'yuanbao', 12, 1, 10, 1, [item('julin')]),
];
const cultivation = [
  ['huanxian', '幻仙石', 'boundYuanbao', 5, 5, 20],
  ['tiangang', '天罡石', 'yuanbao', 15, 1, 10],
  ['disha', '地煞石', 'boundYuanbao', 8, 1, 10],
  ['qiankun', '乾坤石', 'yuanbao', 25, 1, 5],
  ['socketStone', '镶嵌石', 'yuanbao', 12, 1, 20],
  ['reforgeStone', '重铸石', 'yuanbao', 18, 1, 20],
  ['upgradeStone', '升阶石', 'yuanbao', 24, 1, 10],
  ['salvage', '装备精华（5份）', 'boundYuanbao', 6, 5, 20],
  ['charmHp', '黄金护身符', 'yuanbao', 20, 1, 10],
  ['charmMp', '黄金守神符', 'yuanbao', 16, 1, 10],
].map(([id, name, currency, price, quantity, dailyLimit]) => product(
  id, name, 'cultivation', currency, price, quantity, dailyLimit, 1, [item(id, quantity)],
));
const gemTypes = [
  ['Hp', '黄沉之石'], ['Mp', '暗青之石'], ['Patk', '火红之石'], ['Matk', '白雾之石'], ['Def', '磐甲石'],
  ['Mdef', '御灵石'], ['Crit', '暴击石'], ['AtkLevel', '斗神石'], ['DefLevel', '守神石'],
];
const gems = gemTypes.flatMap(([suffix, name]) => [1, 2, 3].map((tier) => {
  const id = `gem${suffix}${tier}`;
  return product(id, `${tier}阶${name}`, 'gems', tier === 1 ? 'boundYuanbao' : 'yuanbao',
    [8, 22, 55][tier - 1], 1, [20, 10, 5][tier - 1], [1, 15, 35][tier - 1], [item(id)]);
}));
export const SHOP_PRODUCTS = freeze([
  ...supplies, ...cultivation, ...gems,
  product('highForgeSigil', '神铸凭证·本作', 'cultivation', 'yuanbao', 40, 1, 20, 1, [item('highForgeSigil')]),
  product('starterBundle', '新手补给礼包', 'bundles', 'boundYuanbao', 12, 1, 3, 1,
    [item('hp1', 20), item('mp1', 20), item('town', 3), money('gold', 500)]),
  product('trainingBundle', '培养材料礼包', 'bundles', 'yuanbao', 75, 1, 3, 1,
    [item('huanxian', 20), item('socketStone', 2), item('reforgeStone', 2), money('sp', 2000)]),
  product('adventureBundle', '探险神符礼包', 'bundles', 'yuanbao', 45, 1, 3, 1,
    [item('revive', 2), item('charmHp'), item('charmMp')]),
  ...[
    ['outfitCloud', '流云素衣', 'outfit', 'yuanbao', 100, 1],
    ['outfitBamboo', '青竹雅装', 'outfit', 'boundYuanbao', 120, 1],
    ['mountDeer', '踏露灵鹿', 'mount', 'yuanbao', 180, 1],
    ['mountJade', '碧玉灵驹', 'mount', 'yuanbao', 220, 1],
    ['flyerKite', '纸鸢飞行器', 'flyer', 'boundYuanbao', 160, 30],
    ['flyerLotus', '莲华飞行器', 'flyer', 'yuanbao', 240, 30],
  ].map(([id, name, category, currency, price, minLevel]) =>
    product(id, name, category, currency, price, 1, 1, minLevel, [cosmetic(id)])),
  product('treasureKey', '秘宝钥匙', 'activity', 'boundYuanbao', 8, 1, 20, 1, [item('treasureKey')]),
  product('bronzeChest', '青铜宝箱', 'activity', 'boundYuanbao', 10, 1, 10, 1, [item('bronzeChest')]),
  product('goldChest', '黄金宝箱', 'activity', 'yuanbao', 25, 1, 10, 1, [item('goldChest')]),
  product('zongzi', '幸运粽子', 'activity', 'boundYuanbao', 6, 1, 10, 1, [item('zongzi')]),
  product('bigZongzi', '大粽子·本作', 'activity', 'yuanbao', 18, 1, 10, 1, [item('bigZongzi')]),
  product('festivalBundle', '常驻粽礼礼包', 'activity', 'boundYuanbao', 35, 1, 2, 1,
    [item('zongzi', 2), item('bigZongzi'), item('treasureKey', 2)]),
]);

export const HONGYUN_POOL = freeze([
  prize('hyGold', '金币2500', 1200, 'common', [money('gold', 2500)]),
  prize('hySp', '元神1500', 2000, 'common', [money('sp', 1500)]),
  prize('hyBound', '绑定元宝10', 1500, 'common', [money('boundYuanbao', 10)]),
  prize('hyStone', '幻仙石3', 1500, 'uncommon', [item('huanxian', 3)]),
  prize('hyGem', '1阶暴击石', 1000, 'uncommon', [item('gemCrit1')]),
  prize('hyRare', '具名武器·稀有奖档（本作）', 1000, 'rare', [equip('weapon', 2)]),
  prize('hyLegend', '具名武器·传说奖档（本作）', 300, 'legendary', [equip('weapon', 3)]),
  prize('hyOutfit', '鸿运锦衣', 200, 'legendary', [cosmetic('outfitLucky')]),
  prize('hySovereign19', '★★★千古一色', 100, 'legendary', [namedEquip('axe19c')]),
  prize('hyHeaven18', '沉天踏绛气·浩然', 200, 'legendary', [namedEquip('sword18b')]),
  prize('hyTwilight17', '★★★通天者法袍·正气', 500, 'rare', [namedEquip('robe17c')]),
  prize('hyForge', '神铸凭证·本作12枚', 500, 'rare', [item('highForgeSigil', 12)]),
]);
export const ACTIVITY_POOLS = freeze({
  bronzeChest: { name: '青铜宝箱', keyCost: 0, minLevel: 1, counter: 'chestsOpened', pool: [
    prize('bcGold', '金币1200', 4000, 'common', [money('gold', 1200)]),
    prize('bcSp', '元神800', 2000, 'common', [money('sp', 800)]),
    prize('bcStone', '幻仙石2', 2000, 'uncommon', [item('huanxian', 2)]),
    prize('bcGem', '1阶黄沉之石', 1000, 'uncommon', [item('gemHp1')]),
    prize('bcEquip', '具名护甲·稀有奖档（本作）', 1000, 'rare', [equip('body', 2)]),
  ] },
  goldChest: { name: '黄金宝箱', keyCost: 0, minLevel: 1, counter: 'chestsOpened', pool: [
    prize('gcGold', '金币5000', 2500, 'common', [money('gold', 5000)]),
    prize('gcBound', '绑定元宝20', 2000, 'uncommon', [money('boundYuanbao', 20)]),
    prize('gcGem', '2阶火红之石', 2000, 'rare', [item('gemPatk2')]),
    prize('gcStone', '重铸石2', 1500, 'rare', [item('reforgeStone', 2)]),
    prize('gcEquip', '具名武器·稀有奖档（本作）', 1500, 'rare', [equip('weapon', 2)]),
    prize('gcLegend', '具名武器·传说奖档（本作）', 500, 'legendary', [equip('weapon', 3)]),
  ] },
  zongzi: { name: '幸运粽子', keyCost: 0, minLevel: 1, counter: 'zongziOpened', pool: [
    prize('zzGold', '金币1000', 3500, 'common', [money('gold', 1000)]),
    prize('zzSp', '元神600', 2500, 'common', [money('sp', 600)]),
    prize('zzPotion', '金创药10', 2000, 'common', [item('hp1', 10)]),
    prize('zzBound', '绑定元宝10', 1500, 'uncommon', [money('boundYuanbao', 10)]),
    prize('zzOutfit', '青竹雅装', 500, 'rare', [cosmetic('outfitBamboo')]),
  ] },
  bigZongzi: { name: '大粽子·本作', keyCost: 0, minLevel: 1, counter: 'zongziOpened', pool: [
    prize('bzGold', '金币4000', 2000, 'common', [money('gold', 4000)]),
    prize('bzSp', '元神2500', 2000, 'common', [money('sp', 2500)]),
    prize('bzGem', '2阶御灵石', 2000, 'rare', [item('gemMdef2')]),
    prize('bzStone', '升阶石1', 1500, 'rare', [item('upgradeStone')]),
    prize('bzBound', '绑定元宝25', 1500, 'uncommon', [money('boundYuanbao', 25)]),
    prize('bzMount', '碧玉灵驹', 1000, 'legendary', [cosmetic('mountJade')]),
  ] },
});
export const MILESTONES = freeze([
  { id: 'draw10', name: '秘宝十签', counter: 'draws', target: 10, rewards: [money('boundYuanbao', 20), money('sp', 1000)] },
  { id: 'draw50', name: '秘宝五十签', counter: 'draws', target: 50, rewards: [item('gemAtkLevel2'), money('boundYuanbao', 50)] },
  { id: 'draw100', name: '秘宝百签', counter: 'draws', target: 100, rewards: [cosmetic('flyerLotus'), money('sp', 5000)] },
  { id: 'chest5', name: '开箱五次', counter: 'chestsOpened', target: 5, rewards: [item('treasureKey', 2), money('boundYuanbao', 10)] },
  { id: 'chest20', name: '开箱二十次', counter: 'chestsOpened', target: 20, rewards: [item('gemDefLevel2'), money('sp', 3000)] },
  { id: 'zongzi5', name: '粽礼五次', counter: 'zongziOpened', target: 5, rewards: [item('bigZongzi'), money('boundYuanbao', 10)] },
  { id: 'zongzi20', name: '粽礼二十次', counter: 'zongziOpened', target: 20, rewards: [cosmetic('outfitBamboo'), money('boundYuanbao', 30)] },
]);
export const ECONOMY_RULES = freeze({
  disclaimer: '所有价格、概率、奖励和保底为原创单机改编，并非官方一致数据。仅本地虚拟元宝，不能实际充值、支付、提现或交易。',
  equipment: '装备奖项从有限具名模板选择；稀有/传说只表示本作奖池档，不承诺同级、固定名称色、星数或品质加倍。来源缺失属性另列本作适配。',
  festival: '宝箱与粽子在乾坤袋购买，买入后消耗物品直接打开，不额外扣秘宝钥匙。本作常驻展示，不代表官方当前上架活动。',
  appearance: '外观只展示文字角色名片；不假装3D世界、骑乘动画或空中场景。坐骑时装无数值加成，30级飞行器启用已有飞行资格。',
  probability: '权重单位为万分之一；每个基础奖池合计10000，即100%。鸿运基础传说率8%；保底条件概率：具名武器·传说奖档（本作）37.5%、鸿运锦衣25%、十九品千古一色12.5%、十八品浩然25%。十七品法袍基础概率5%，不属于传说保底档。所有概率为本作设定。',
  pity: '鸿运每次消耗1把秘宝钥匙，仅支持1抽或10抽。连续49次未得传说后，第50次必得传说；任意传说（包括重复外观补偿）清零连续计数。开箱开粽不增加或重置鸿运保底。',
  capacity: '含装备的奖池须预留本批次数的装备格；不足时整批拒绝，不消耗钥匙/物品、不扣钱、不改保底或历史，传说不会被自动出售或丢弃。消耗品使用独立堆叠，不占装备格。',
  duplicateCosmetic: '抽奖或里程碑得到已拥有外观，真实发放120绑定元宝补偿；商城拒绝重复购买外观。',
  day: '按设备本地日期刷新；离线单机不承诺防改时钟或改存档。日限按商品购买份数计，非礼包内物品数。',
  history: '逐次开奖结果和本地实际购买订单分别仅保留最近100条；里程碑认领ID独立永久记录，历史截断不允许重复领奖。',
  daily: { counter: '$wallet.daily', dailyLimit: 1, rewards: [money('yuanbao', 20), money('boundYuanbao', 30)] },
  exchange: { counter: '$wallet.exchange', goldPerUnit: 1000, yuanbaoPerUnit: 1, dailyLimit: 100, minLevel: 1 },
  festivalDaily: { id: 'festival.daily', name: '每日商城补贴', rewards: [money('boundYuanbao', 10)] },
  charm: '黄金护身符每枚600000生命储量，黄金守神符每枚900000真气储量；战斗外追加装填，不直接治疗。生命不高于50%、真气不高于75%时按储量恢复。本作回合检查，不模拟端游10秒/5秒冷却。',
  catalog: '经典道具名称参考端游旧商城；价格、概率和回合效果为本作设定。青铜/黄金宝箱、大粽子、扩展魂石及原创外观属于本作扩展；本作“鸿运秘宝”不是官方“鸿彩秘宝”或“鸿运财宝匣”。',
});
export const ECONOMY_ACTIONS = freeze({
  'shop.buy': { params: ['productId', 'quantity'], quantity: 'integer 1..99, default 1' },
  'wallet.exchange': { params: ['quantity'], quantity: 'integer 1..99, default 1' },
  'wallet.daily': { params: [] },
  'treasure.draw': { params: ['count'], count: '1 or 10, default 1' },
  'activity.open': { params: ['itemId', 'count'], count: 'integer 1..10, default 1' },
  'activity.claim': { params: ['milestoneId'] },
  'cosmetic.equip': { params: ['cosmeticId', 'slot'], slot: 'outfit|mount|flyer; null cosmeticId unequips' },
  'charm.equip': { params: ['itemId', 'count'], count: 'integer 1..99, default 1' },
});
