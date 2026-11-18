import { ZONES, DUNGEONS, CULTIVATION, HOME_CITY } from './world.js';

// H5 authored journey, not an original quest-chain transcription. Goal types and
// reward flags use the existing Game paths; new saves may have different mainIndex values.
export const QUEST_ADAPTATION = '主线与赏金为本作编排；地名参照资料库，怪物沿用本作遭遇表。目标、奖励、行程和等级不是端游原任务数据。';
const guide = (zoneId) => `${ZONES[zoneId].name}·历练向导`;
const SHARED_ROUTE = ['f_kuangkeng', 'f_taoyuan', 'f_jifeng', 'f_fengsha', 'f_bingfeng', 'f_shangqi', 'f_wanjie', 'f_tongtian', 'f_shedao', 'f_longgong', 'f_xianmo'];
const RACE_ROUTE = {
  human: ['h_f1', 'h_f2'], elf: ['e_f1', 'e_f2'], untamed: ['u_f1', 'u_f2'], tideborn: ['t_f1', 't_f2'], earthguard: ['g_f1', 'g_f2'],
};
const ZONE_STORY = {
  f_kuangkeng: '沿祭旗坡的历练路线前行，准备探索青衣冢。',
  f_taoyuan: '青衣冢的挑战在前，先确认附近的通行安全。',
  f_jifeng: `从${ZONES.jifeng.name}出发，继续前往${ZONES.f_jifeng.name}方向。`,
  f_fengsha: `${ZONES.f_fengsha.name}的试炼更为艰险，先击退路上的敌人。`,
  f_bingfeng: '在云梦岭整顿行装，为怨灵之门的挑战做准备。',
  f_shangqi: '怨灵之门近在眼前，先完成入口一带的历练。',
  f_wanjie: `经${ZONES.wanjie.name}来到${ZONES.f_wanjie.name}，继续探索未知的道路。`,
  f_tongtian: `在${ZONES.f_tongtian.name}完成历练，准备下一段行程。`,
  f_shedao: '蛇岛的试炼等待着你，小心应对这里的敌人。',
  f_longgong: '踏入龙宫，先确认自己能应对眼前的挑战。',
  f_xianmo: '修为已深，继续挑战仙魔两界的历练。',
};

// Reduce routine early kills only. Elite/boss, dungeon and cultivation requirements
// remain separate, unchanged constraints; rewards still flow through Game.claimQuest.
const killCount = (lv) => lv <= 20 ? 2 : lv <= 40 ? 5 : 5 + Math.floor(lv / 15);
function zoneQuests(zoneId, giver, story, skipFirst = false) {
  const z = ZONES[zoneId];
  const normals = z.mobs.filter((m) => !m[2]).slice(skipFirst ? 1 : 0);
  const elite = z.mobs.find((m) => m[2] === 'elite');
  const boss = z.mobs.find((m) => m[2] === 'boss');
  const q = normals.map((m, i) => ({
    title: `清剿·${m[0]}`, zone: zoneId, giver,
    story: i === 0 ? `${story} 击败${m[0]}，清出一段安全道路。` : `继续巡查${z.name}，击退${m[0]}。`,
    goal: { type: 'kill', mob: m[0], count: killCount(m[1]) },
    rlv: m[1], rexp: 0.35, rsp: 1,
  }));
  q.push({ title: `迎战·${elite[0]}`, zone: zoneId, giver, story: `${elite[0]}拦住了去路，击败它再前行。`, goal: { type: 'kill', mob: elite[0], count: 1 }, rlv: elite[1], rexp: 0.5, rsp: 2, equip: 1 });
  q.push({ title: `讨伐·${boss[0]}`, zone: zoneId, giver, story: `前往${z.name}深处，挑战${boss[0]}。`, goal: { type: 'kill', mob: boss[0], count: 1 }, rlv: boss[1], rexp: 0.8, rsp: 3, equip: 2 });
  return q;
}

export function buildMainline(race) {
  const home = HOME_CITY[race];
  const giver = guide(home);
  const firstField = RACE_ROUTE[race][0];
  const field = ZONES[firstField];
  const firstMob = field.mobs.find((m) => !m[2]);
  const list = [
    { title: `启程·${field.name}`, zone: firstField, giver, story: `打开地图，从${ZONES[home].name}前往${field.name}。先熟悉道路，再开始历练。`, goal: { type: 'visit', zone: firstField }, rlv: 1, rexp: 0.2, rsp: 1 },
    { title: `初战·${firstMob[0]}`, zone: firstField, giver, story: `在${field.name}选择${firstMob[0]}，击败一只。试试初始技能，留意敌人的蓄力。`, goal: { type: 'kill', mob: firstMob[0], count: 1 }, rlv: firstMob[1], rexp: 0.5, rsp: 1 },
    { title: `归来·${ZONES[home].name}`, zone: home, giver, story: `返回${ZONES[home].name}领取历练装备。休息后找技能导师，查看下一阶学习要求。`, goal: { type: 'visit', zone: home }, rlv: 1, rexp: 0.6, rsp: 1, equip: 1 },
  ];
  RACE_ROUTE[race].forEach((zid, i) => {
    // The tutorial already used the first normal monster; do not repeat that grind.
    list.push(...zoneQuests(zid, giver, i === 0 ? '第一次巡查顺利，接着清理城外的威胁。' : '继续向外历练，留意更强的敌人。', i === 0));
    if (i === 0) list.push({ title: '灵虚乍现', zone: null, giver: '修真导师', story: '你的修为已到瓶颈，去完成灵虚试炼吧。', goal: { type: 'cult', rank: 1 }, rlv: 10, rexp: 0.3, rsp: 2 });
  });
  const firstDungeon = DUNGEONS.find((d) => d.id === 'd15');
  const firstEntrances = firstDungeon.entrance.map((id) => ZONES[id].name).join('、');
  list.push({ title: firstDungeon.name, zone: null, giver: '副本使者', story: `准备挑战${firstDungeon.name}。可从${firstEntrances}进入；本族参照${firstDungeon.variants[race] || '共享三族历练'}。`, goal: { type: 'dungeon', id: 'd15' }, rlv: 18, rexp: 0.6, rsp: 3 });
  list.push({ title: '五族汇聚', zone: null, giver, story: `前往${ZONES.zulong.name}整顿行装，开启下一段旅程。`, goal: { type: 'visit', zone: 'zulong' }, rlv: 20, rexp: 0.3, rsp: 2 });
  list.push({ title: '和合之境', zone: null, giver: '茫茫大士', story: '调和阴阳，需降伏叛兵骷髅之魂。', goal: { type: 'cult', rank: 2 }, rlv: 20, rexp: 0.3, rsp: 3 });

  const dungeonAt = { f_kuangkeng: 'd25', f_taoyuan: 'd35', f_jifeng: 'd45', f_fengsha: 'd55', f_bingfeng: 'd65', f_shangqi: 'd75', f_wanjie: 'd85', f_shedao: 'd95', f_longgong: 'd100', f_xianmo: 'd105' };
  const cultAt = { f_kuangkeng: 3, f_taoyuan: 4, f_jifeng: 5, f_fengsha: 6, f_bingfeng: 7, f_shangqi: 8, f_wanjie: 9, f_shedao: 10, f_longgong: 11 };
  for (const zid of SHARED_ROUTE) {
    list.push(...zoneQuests(zid, guide(zid === 'f_wanjie' ? 'wanjie' : zid), ZONE_STORY[zid]));
    if (dungeonAt[zid]) {
      const d = DUNGEONS.find((x) => x.id === dungeonAt[zid]);
      const entrances = d.entrance.map((id) => ZONES[id].name).join('、');
      list.push({ title: d.name, zone: null, giver: '副本使者', story: `挑战${d.name}。入口与接引点：${entrances}；先满足旅行与副本要求。`, goal: { type: 'dungeon', id: d.id }, rlv: d.lv, rexp: 0.8, rsp: 4, equip: 2 });
    }
    if (cultAt[zid]) {
      const rank = cultAt[zid];
      const name = CULTIVATION[rank].name;
      list.push({ title: `修真·${Array.isArray(name) ? name.join(' / ') : name}`, zone: null, giver: '修真导师', story: '你的境界已可再进一步，去完成修真试炼。', goal: { type: 'cult', rank }, rlv: CULTIVATION[rank].lv, rexp: 0.4, rsp: 4 });
    }
  }
  list.push({ title: '修行未尽', zone: null, giver: '修真导师', story: '继续积累经验，修行没有终点。', goal: { type: 'level', lv: 105 }, rlv: 105, rexp: 0, rsp: 10 });
  return list.map((q, i) => ({ ...q, idx: i, adaptation: QUEST_ADAPTATION }));
}

// 每日赏金任务（虎符任务）
export const BOUNTY_DAILY = 10;
export function makeBounty(playerLv) {
  const fields = Object.entries(ZONES).filter(([, z]) => z.type === 'field' && z.lv[0] <= playerLv + 2 && z.lv[1] >= playerLv - 6);
  const [zid, z] = fields[Math.floor(Math.random() * fields.length)] || ['h_f1', ZONES.h_f1];
  const mobs = z.mobs.filter((m) => !m[2]);
  const elite = z.mobs.find((m) => m[2] === 'elite');
  const useElite = Math.random() < 0.25;
  const m = useElite ? elite : mobs[Math.floor(Math.random() * mobs.length)];
  return {
    title: `虎符·${z.name}`, zone: zid, giver: '赏金猎人',
    story: `悬赏：${useElite ? '讨伐' : '清剿'}${z.name}的${m[0]}。`,
    goal: { type: 'kill', mob: m[0], count: useElite ? 1 : m[1] <= 20 ? 2 : 5 }, rlv: m[1], rexp: useElite ? 0.4 : 0.3, rsp: 2, bounty: true,
    adaptation: QUEST_ADAPTATION,
  };
}
