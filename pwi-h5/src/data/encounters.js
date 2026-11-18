// 野外奇遇：每个选项由 game.chooseEncounter 通过受限的辅助对象 h 结算。
// h: lv, zone, mob, roll(), gold(n), exp(frac), sp(n), item(id, qty), heal(frac), hurt(frac), boost(n), pay(n), fight(name, lv, rank, opts), say(text)
const potion = (lv) => lv >= 15 ? ['hp2', 'mp2'] : ['hp1', 'mp1'];

export const ENCOUNTERS = {
  merchant: {
    title: '受伤的行商',
    text: (z) => `${z}的小路边倒着一位行商，腿上满是狼咬的伤口，货担散落一地。他抬头望着你，眼里满是哀求。`,
    choices: [
      { id: 'help', label: '送他一瓶药', hint: '消耗1瓶生命药 · 善有善报',
        require: (p) => (p.items.hp1 || 0) + (p.items.hp2 || 0) > 0 ? null : '身上没有生命药',
        resolve: (h) => { h.item(h.p.items.hp1 > 0 ? 'hp1' : 'hp2', -1); h.say('行商千恩万谢，塞给你一袋碎银，还教了你几招对付野兽的诀窍。'); h.gold(80 + h.lv * 25); h.exp(0.3); } },
      { id: 'rob', label: '趁火打劫', hint: '可能抢到大笔金币……也可能惹上麻烦',
        resolve: (h) => {
          if (h.roll() < 0.5) { h.say('你抢走了行商的钱袋，他只能眼睁睁看着你离开。良心……有点痛。'); h.gold(120 + h.lv * 40); }
          else { h.say('“站住！”行商的护卫恰好赶了回来，拔刀向你冲来！'); h.fight('行商护卫', h.lv + 1, 'elite'); }
        } },
      { id: 'leave', label: '默默离开', hint: '什么也不会发生', resolve: (h) => h.say('你移开视线，继续赶路。') },
    ],
  },
  chest: {
    title: '林间宝箱',
    text: (z) => `${z}的藤蔓间半埋着一只生锈的铁箱，锁扣已经松动。箱盖缝隙里，隐约透出一点微光。`,
    choices: [
      { id: 'open', label: '直接撬开', hint: '可能有装备与幻仙石 · 也可能有机关',
        resolve: (h) => {
          if (h.roll() < 0.65) { h.say('咔哒一声，箱盖弹开——里面的东西没让你失望！'); h.gold(40 + h.lv * 15); h.item('huanxian', 1 + Math.floor(h.roll() * 2)); h.equip(h.roll() < 0.5 ? 1 : 0); }
          else { h.say('机关弹出一排毒针！你狼狈地躲开，还是被扎中了几根。'); h.hurt(0.2); h.gold(20 + h.lv * 5); }
        } },
      { id: 'careful', label: '仔细检查机关', hint: '稳妥，收获较少',
        resolve: (h) => { h.say('你小心拆掉了机关，箱子里还剩一些碎银和药品。'); h.gold(30 + h.lv * 10); h.item(potion(h.lv)[0], 1); } },
      { id: 'leave', label: '不去碰它', hint: '谨慎为上', resolve: (h) => h.say('来历不明的箱子，还是别碰为好。') },
    ],
  },
  spring: {
    title: '灵泉',
    text: (z) => `${z}深处有一汪清泉，泉水泛着淡淡灵光，靠近就能感觉到经脉微微发热。`,
    choices: [
      { id: 'drink', label: '捧水饮下', hint: '生命与真气全部恢复',
        resolve: (h) => { h.say('清冽的泉水入喉，疲惫一扫而空。'); h.heal(1); } },
      { id: 'bottle', label: '装瓶带走', hint: '获得生命药与真气药',
        resolve: (h) => { const [hp, mp] = potion(h.lv); h.say('你把泉水装进药瓶，留着路上用。'); h.item(hp, 2); h.item(mp, 2); } },
      { id: 'meditate', label: '在泉边打坐', hint: '获得元神与经验 · 可能被打扰',
        resolve: (h) => {
          h.say('你闭目调息，灵气缓缓汇入丹田。'); h.sp(60 + h.lv * 20); h.exp(0.2);
          if (h.roll() < 0.3 && h.mob) { h.say(`正当你入定之时，一只${h.mob}循着灵气摸了过来！`); h.fight(h.mob, null, '', { surprise: true }); }
        } },
    ],
  },
  beast: {
    title: '沉睡的妖兽',
    needsElite: true,
    text: (z, mob) => `前方树下，一头${mob}正在酣睡，鼾声如雷。它身后的石缝里，有什么东西在闪闪发光。`,
    choices: [
      { id: 'ambush', label: '趁它睡着偷袭', hint: '精英战斗 · 敌人开局露出破绽',
        resolve: (h) => { h.say(`你屏住呼吸，悄悄摸到${h.mob}身后……`); h.fight(h.mob, null, 'elite', { ambush: true }); } },
      { id: 'steal', label: '悄悄取走宝物', hint: '六成把握 · 失手会惊醒它',
        resolve: (h) => {
          if (h.roll() < 0.6) { h.say('你蹑手蹑脚地取走了石缝里的宝物，它翻了个身，继续打鼾。'); h.item('huanxian', 2); h.gold(60 + h.lv * 20); }
          else { h.say(`脚下一根枯枝“啪”地断了——${h.mob}猛地睁开眼，怒吼着扑来！`); h.fight(h.mob, null, 'elite', { surprise: true }); }
        } },
      { id: 'leave', label: '绕道而行', hint: '少量经验', resolve: (h) => { h.say('你决定不冒这个险，绕了个远路，倒也看了不少风景。'); h.exp(0.08); } },
    ],
  },
  stele: {
    title: '古修士残碑',
    text: (z) => `${z}的荒草中立着一块残破石碑，碑上刻着模糊的剑诀，笔画间仍残留着一丝剑意。`,
    choices: [
      { id: 'study', label: '静心参悟', hint: '获得元神与经验',
        resolve: (h) => { h.say('你盯着碑文看了许久，忽然心有所悟。'); h.sp(100 + h.lv * 30); h.exp(0.15); } },
      { id: 'rub', label: '拓印下来', hint: '城里的书商愿意出高价',
        resolve: (h) => { h.say('你把碑文拓了下来，能卖个好价钱。'); h.gold(80 + h.lv * 25); } },
    ],
  },
  child: {
    title: '迷路的孩童',
    text: (z) => `一个孩童蹲在${z}的路边抽泣，说是追蝴蝶迷了路，天快黑了，怎么也找不到回家的方向。`,
    choices: [
      { id: 'escort', label: '护送他回家', hint: '较多经验 · 路上可能遇敌',
        resolve: (h) => {
          h.say('你牵着孩子走回村口，他的爹娘连声道谢，硬塞给你一包干粮和几枚铜钱。'); h.exp(0.35); h.gold(30 + h.lv * 8);
          if (h.roll() < 0.3 && h.mob) { h.say(`回程路上，一只${h.mob}拦住了去路！`); h.fight(h.mob, null, ''); }
        } },
      { id: 'point', label: '给他指个方向', hint: '少量经验', resolve: (h) => { h.say('你给他指了回村的路，他抹抹眼泪跑远了。'); h.exp(0.1); } },
    ],
  },
  taoist: {
    title: '游方道士',
    text: () => '一位白发道士拦住你，捋着胡须笑道：“小友骨骼清奇，贫道这里有一枚聚灵丹，只收个药材钱，要不要试试？”',
    choices: [
      { id: 'buy', label: '买下丹药', hint: (lv) => `花费${50 + lv * 30}金币 · 接下来3场战斗双倍经验`,
        require: (p) => p.gold >= 50 + p.lv * 30 ? null : '金币不足',
        resolve: (h) => { h.pay(50 + h.lv * 30); h.say('丹药入口即化，一股暖流涌遍全身。'); h.boost(3); } },
      { id: 'refuse', label: '婉言谢绝', hint: '江湖骗子也说不定', resolve: (h) => h.say('道士也不恼，哈哈一笑，飘然而去。') },
    ],
  },
  bandit: {
    title: '山贼拦路',
    text: () => '几个蒙面人从路旁跳了出来，领头的扛着一把鬼头刀：“此路是我开！留下买路钱！”',
    choices: [
      { id: 'fight', label: '拔剑迎战', hint: '精英战斗 · 击败可得赏金',
        resolve: (h) => { h.say('“找死！”山贼头子挥刀冲了上来。'); h.fight('拦路山贼', h.lv, 'elite'); } },
      { id: 'pay', label: '破财消灾', hint: (lv) => `交出${30 + lv * 15}金币`,
        require: (p) => p.gold >= 30 + p.lv * 15 ? null : '金币不足',
        resolve: (h) => { h.pay(30 + h.lv * 15); h.say('山贼掂了掂钱袋，满意地让开了路。'); } },
    ],
  },
};
export const ENCOUNTER_IDS = Object.keys(ENCOUNTERS);
export const choiceHint = (choice, lv) => typeof choice.hint === 'function' ? choice.hint(lv) : choice.hint;
