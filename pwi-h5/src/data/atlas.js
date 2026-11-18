import { ZONES, DUNGEONS } from './world.js';

export const ATLAS_ADAPTATION = '地名与已核实入口、NPC 坐标参照端游资料；坐标锚点不是城市中心。图上 x/y 为 0—100 的避让示意布局，仅保留大致相对方位，不是游戏坐标投影。所有连线均为本作 H5 压缩行程，不声称是原版完整或相邻地面道路；仅乘风原→破浪营地、云梦岭→怨灵沼泽、寻梦港→夜哭岛→秘宝窟等前后关系有所列攻略支持。历练等级、怪物生态、剧情、城镇服务和副本波次为本作适配。夜哭岛、秘宝窟、蛇岛、龙宫使用独立地图示意层，不把岛内坐标混入大陆；仙魔两界为集合示意。未核实的连接与副本入口只标为适配，不补写真实道路或精确入口。';

// evidence 说明地名/锚点的依据，不意味着示意 x/y 或 H5 连线经原版地图验证。
// anchor 为资料中的游戏坐标：城市项是 NPC 参照，入口项是入口参照，均不是图上坐标。
export const ATLAS_NODES = {
  wanliu: { x: 43, y: 17, layer: 'mainland', evidence: 'official', regionLabel: '大陆北偏西·人族',
    anchor: { x: 429, y: 890, npc: '剑仙城 NPC 地理参照（非城中心）' } },
  h_f1: { x: 53, y: 8, layer: 'mainland', evidence: 'official', regionLabel: '人族出生地·周边布局示意' },
  h_f2: { x: 39, y: 4, layer: 'mainland', evidence: 'official', regionLabel: '万木岭·火岩洞穴入口',
    anchor: { x: 403, y: 1000, npc: '火岩洞穴入口参照（非 NPC 坐标）' } },
  jiyu: { x: 32, y: 66, layer: 'mainland', evidence: 'official', regionLabel: '大陆西南·羽族',
    anchor: { x: 323, y: 423, npc: '积羽城 NPC 地理参照（非城中心）' } },
  e_f1: { x: 20, y: 76, layer: 'mainland', evidence: 'official', regionLabel: '羽族出生地·周边布局示意' },
  e_f2: { x: 20, y: 61, layer: 'mainland', evidence: 'official', regionLabel: '无忧河西岸·蛇蝎洞入口',
    anchor: { x: 282, y: 447, npc: '蛇蝎洞入口参照（非 NPC 坐标）' } },
  wanhua: { x: 25, y: 42, layer: 'mainland', evidence: 'official', regionLabel: '大陆西部·兽族',
    anchor: { x: 245, y: 647, npc: '万化城 NPC 地理参照（非城中心）' } },
  u_f1: { x: 15, y: 33, layer: 'mainland', evidence: 'official', regionLabel: '兽族出生地·周边布局示意' },
  u_f2: { x: 39, y: 45, layer: 'mainland', evidence: 'official', regionLabel: '盘丝岭·狂狼巢穴入口',
    anchor: { x: 372, y: 621, npc: '狂狼巢穴入口参照（非 NPC 坐标）' } },
  xidao: { x: 82, y: 91, layer: 'mainland', evidence: 'official', regionLabel: '东南海域·汐族方位示意',
    anchor: { x: 663, y: 132, npc: '惊涛城 NPC 地理参照（非城中心）' } },
  t_f1: { x: 90, y: 78, layer: 'mainland', evidence: 'official', regionLabel: '汐族出生地·海域布局示意' },
  t_f2: { x: 76, y: 77, layer: 'mainland', evidence: 'adapted', regionLabel: '龙牙村外围·本作抽象' },
  lingyuan: { x: 48, y: 82, layer: 'mainland', evidence: 'official', regionLabel: '大陆南偏西·灵族',
    anchor: { x: 382, y: 230, npc: '灵犀城 NPC 地理参照（非城中心）' } },
  g_f1: { x: 37, y: 91, layer: 'mainland', evidence: 'official', regionLabel: '灵族出生地·周边布局示意' },
  g_f2: { x: 50, y: 71, layer: 'mainland', evidence: 'adapted', regionLabel: '灵犀城外围·本作抽象' },
  zulong: { x: 63, y: 40, layer: 'mainland', evidence: 'official', regionLabel: '大陆中部·服务枢纽',
    anchor: { x: 528, y: 650, npc: '祖龙城 NPC 地理参照（非城中心）' } },
  f_kuangkeng: { x: 64, y: 19, layer: 'mainland', evidence: 'official', regionLabel: '祭旗坡·入口路线示意' },
  taoyuan: { x: 23, y: 14, layer: 'mainland', evidence: 'official', regionLabel: '落日镇·未核实精确坐标的示意点' },
  f_taoyuan: { x: 74, y: 27, layer: 'mainland', evidence: 'official', regionLabel: '英雄冢地宫·入口路线示意（非地面投影）' },
  jifeng: { x: 8, y: 25, layer: 'mainland', evidence: 'secondary', regionLabel: '飞来镇·镇外黄昏入口参照',
    anchor: { x: 131, y: 699, npc: '黄昏圣殿入口（飞来镇外；非镇中心或 NPC 坐标）' } },
  f_jifeng: { x: 82, y: 43, layer: 'mainland', evidence: 'official', regionLabel: '乘风原→破浪营地·攻略关系示意' },
  f_fengsha: { x: 91, y: 53, layer: 'mainland', evidence: 'official', regionLabel: '乘风原→破浪营地·攻略关系示意' },
  f_bingfeng: { x: 56, y: 57, layer: 'mainland', evidence: 'official', regionLabel: '云梦岭→怨灵沼泽·攻略关系示意' },
  f_shangqi: { x: 73, y: 63, layer: 'mainland', evidence: 'official', regionLabel: '大陆东南·怨灵之门入口',
    anchor: { x: 589, y: 447, npc: '怨灵之门入口参照（非 NPC 坐标）' } },
  wanjie: { x: 89, y: 67, layer: 'mainland', evidence: 'official', regionLabel: '东南海港·夜哭岛跨图入口',
    anchor: { x: 676, y: 362, npc: '寻梦港→夜哭岛入口参照（非港口中心）' } },
  f_wanjie: { x: 24, y: 30, layer: 'islands', evidence: 'official', regionLabel: '夜哭岛·独立地图示意' },
  f_tongtian: { x: 57, y: 30, layer: 'islands', evidence: 'official', regionLabel: '秘宝窟·经夜哭岛跨图抵达' },
  f_shedao: { x: 28, y: 75, layer: 'islands', evidence: 'adapted', regionLabel: '蛇岛·未核实连接的独立示意点' },
  f_longgong: { x: 70, y: 75, layer: 'islands', evidence: 'adapted', regionLabel: '龙宫·未核实连接的水下示意点' },
  f_xianmo: { x: 50, y: 50, layer: 'otherworld', evidence: 'adapted', regionLabel: '仙魔两界·本作集合示意' },
};

// 已提供且核实的资料清单；title 为内容标签，不额外推断页面未证明的道路或门槛。
export const ATLAS_SOURCES = [
  { title: '官方攻略：怨灵之门入口与乘风原、云梦岭、夜哭岛路线', evidence: 'official', url: 'https://w2i.wanmei.com/intro/guide/20091027/36465.shtml' },
  { title: '官方公告：剑仙城、惊涛城、灵犀城 NPC 坐标参照', evidence: 'official', url: 'https://w2i.wanmei.com/news/gamenews/20110419/59805.shtml' },
  { title: '官方 NPC 资料：万化城地理参照', evidence: 'official', url: 'https://w2i.wanmei.com/xtjs/npc/20091019/30113.shtml' },
  { title: '官方 NPC 资料：积羽城地理参照', evidence: 'official', url: 'https://w2i.wanmei.com/xtjs/npc/20091019/30114.shtml' },
  { title: '官方公告：人族、兽族、羽族、汐族出生地点', evidence: 'official', url: 'https://w2i.wanmei.com/news/gamenews/20100928/55709.shtml' },
  { title: '官方公告：灵族出生地点星栖苑', evidence: 'official', url: 'https://w2i.wanmei.com/news/gamenews/20110118/58383.shtml' },
  { title: '官方副本指引：万木岭与火岩洞穴', evidence: 'official', url: 'https://w2i.wanmei.com/intro/guide_fb/20101122/56996.shtml' },
  { title: '官方副本指引：盘丝岭与狂狼巢穴', evidence: 'official', url: 'https://w2i.wanmei.com/intro/guide_fb/20101122/56998.shtml' },
  { title: '官方副本指引：无忧河西岸与蛇蝎洞', evidence: 'official', url: 'https://w2i.wanmei.com/intro/guide_fb/20101122/56997.shtml' },
  { title: '官方攻略：祭旗坡→英雄冢地宫→青衣冢', evidence: 'official', url: 'https://w2i.wanmei.com/news/gamenews/20080409/31714.shtml' },
  { title: '官方攻略：落日镇旁幽冥居', evidence: 'official', url: 'https://w2i.wanmei.com/news/gamenews/20080416/31740.shtml' },
  { title: '52PK 二级攻略：飞来镇外黄昏圣殿入口', evidence: 'secondary', url: 'https://w2i.52pk.com/shtml/20100603/901565.shtml' },
];

// 返回包含起点/终点的最短 zone ID 数组；无效、门槛阻挡或不连通时返回 null。
// 不传 p 时只看地图连通性。传 p 时起点也须可进入，且每一跳遵守 Game.travel 的
// lv >= zone.lv[0] - 5 与 minCult 条件；不添加传送捷径、不绕过中间节点门槛。
export function routeTo(from, to, p) {
  if (!Object.hasOwn(ZONES, from) || !Object.hasOwn(ZONES, to)) return null;
  const canEnter = (id) => {
    const z = ZONES[id];
    return !p || (p.lv >= z.lv[0] - 5 && (!z.minCult || p.cult >= z.minCult));
  };
  if (!canEnter(from) || !canEnter(to)) return null;
  const previous = new Map([[from, null]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    if (id === to) {
      const path = [];
      for (let step = to; step !== null; step = previous.get(step)) path.push(step);
      return path.reverse();
    }
    for (const next of ZONES[id].links) {
      if (!previous.has(next) && canEnter(next)) {
        previous.set(next, id);
        queue.push(next);
      }
    }
  }
  return null;
}

// 返回该本作入口/接引节点对应的副本数组；不筛选等级，不代替 Game 的进本校验。
export function entryDungeons(zoneId) {
  return DUNGEONS.filter((d) => d.entrance.includes(zoneId));
}
