import { ZONES, DUNGEONS } from './world.js';
import { WORLD_TERRITORIES } from './territories.js';

export const ATLAS_ADAPTATION = '大陆层覆盖官方历史仙丹专题的47块领土，使用本地436×640原图及其原始image-map轮廓；这是该历史专题的完整领土覆盖，不是历代版本地区全集。领土边界不是道路、航道或副本内部地图。大陆节点x/y为原图像素归一化至0—100：领土主点取图上内部代表点，成员仅在对应polygon内作局部避让，并非NPC游戏坐标投影；anchor保留资料中的NPC或入口参照，不作城市中心定位。万流城为五族共建的中立圣城，北屏、东屏、南屏三镇可游历；刺骨之地、古长城各归独立领土，焚心之地归沐火村。出生村按相近种族领土作H5分组，精确范围未核实。灵族领地并列为资料补充，灵犀、星栖、郊外以及苍茫、寂寞、祭旗等未有确切47领土归属的节点在界面单列，不投影到官方底图；数据保留独立补充示意坐标。所有连接、历练等级、怪物生态、剧情、城镇服务和副本波次均为H5适配；有资料支持的方位或入口关系也不等于核实原版步行道。残云、海狱、碎梦三岛属于47原图领土；英雄冢地宫、夜哭岛、秘宝窟、蛇岛、龙宫在独立地图层，仙魔两界在独立集合层。';

// 保留旧 evidence / anchor；它们只证明地名和资料参照，绝不证明图上落点或 H5 道路。
// 大陆节点坐标统一在下方从原图生成，不读取 anchor 作 NPC 投影。
const REFERENCE_NODES = {
  wanliu: { evidence: 'official', anchor: { x: 429, y: 890, npc: '剑仙城 NPC 地理参照（非城中心）' } },
  h_f1: { evidence: 'official' },
  h_f2: { evidence: 'official', anchor: { x: 403, y: 1000, npc: '火岩洞穴入口参照（非 NPC 坐标）' } },
  jiyu: { evidence: 'official', anchor: { x: 323, y: 423, npc: '积羽城 NPC 地理参照（非城中心）' } },
  e_f1: { evidence: 'official' },
  e_f2: { evidence: 'official', anchor: { x: 282, y: 447, npc: '蛇蝎洞入口参照（非 NPC 坐标）' } },
  wanhua: { evidence: 'official', anchor: { x: 245, y: 647, npc: '万化城 NPC 地理参照（非城中心）' } },
  u_f1: { evidence: 'official' },
  u_f2: { evidence: 'official', anchor: { x: 372, y: 621, npc: '狂狼巢穴入口参照（非 NPC 坐标）' } },
  xidao: { evidence: 'official', anchor: { x: 663, y: 132, npc: '惊涛城 NPC 地理参照（非城中心）' } },
  t_f1: { evidence: 'official' },
  t_f2: { evidence: 'adapted' },
  lingyuan: { evidence: 'official', anchor: { x: 382, y: 230, npc: '灵犀城 NPC 地理参照（非城中心）' } },
  g_f1: { evidence: 'official' },
  g_f2: { evidence: 'adapted' },
  zulong: { evidence: 'official', anchor: { x: 528, y: 650, npc: '祖龙城 NPC 地理参照（非城中心）' } },
  f_kuangkeng: { evidence: 'official' },
  taoyuan: { evidence: 'official', anchor: { x: 128, y: 589, npc: '落日镇长老地理参照（非镇中心）' } },
  f_taoyuan: { x: 82, y: 15, layer: 'islands', evidence: 'official', regionLabel: '英雄冢地宫·独立地宫示意（非地面投影）' },
  jifeng: { evidence: 'secondary', anchor: { x: 131, y: 699, npc: '黄昏圣殿入口（飞来镇外；非镇中心或 NPC 坐标）' } },
  f_jifeng: { evidence: 'official' },
  f_fengsha: { evidence: 'official' },
  f_bingfeng: { evidence: 'official', anchor: { x: 507, y: 394, npc: '云梦村地理参照（非区域中心）' } },
  f_shangqi: { evidence: 'official', anchor: { x: 589, y: 447, npc: '怨灵之门入口参照（非 NPC 坐标）' } },
  wanjie: { evidence: 'official', anchor: { x: 676, y: 362, npc: '寻梦港→夜哭岛入口参照（非港口中心）' } },
  wl_city: { evidence: 'official', anchor: { x: 131, y: 858, npc: '万流城长老地理参照（非城中心）' } },
  wl_fenxin: { evidence: 'official', anchor: { x: 171, y: 774, npc: '修真任务炎甲妖坐标参照' } },
  wl_cangmang: { evidence: 'official', anchor: { x: 225, y: 861, npc: '修真任务藤甲妖坐标参照' } },
  wl_changcheng: { evidence: 'official', anchor: { x: 282, y: 810, npc: '修真任务岩甲妖坐标参照' } },
  wl_jimo: { evidence: 'official', anchor: { x: 267, y: 877, npc: '修真任务金甲妖坐标参照' } },
  wl_cigu: { evidence: 'official', anchor: { x: 147, y: 927, npc: '修真任务冰甲妖坐标参照' } },
  f_wanjie: { x: 24, y: 30, layer: 'islands', evidence: 'official', regionLabel: '夜哭岛·独立地图示意' },
  f_tongtian: { x: 57, y: 30, layer: 'islands', evidence: 'official', regionLabel: '秘宝窟·经夜哭岛跨图抵达' },
  f_shedao: { x: 28, y: 75, layer: 'islands', evidence: 'adapted', regionLabel: '蛇岛·未核实连接的独立示意点' },
  f_longgong: { x: 70, y: 75, layer: 'islands', evidence: 'adapted', regionLabel: '龙宫·未核实连接的水下示意点' },
  f_xianmo: { x: 50, y: 50, layer: 'otherworld', evidence: 'adapted', regionLabel: '仙魔两界·本作集合示意' },
};

function insidePolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i];
    const [bx, by] = polygon[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

function edgeDistance(x, y, polygon) {
  let distance = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const [ax, ay] = polygon[i];
    const [bx, by] = polygon[(i + 1) % polygon.length];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    distance = Math.min(distance, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return distance;
}

// 稳定、无随机的原图内避让。只为当前领土成员服务，不虚构村镇原版精确位置。
// 优先主点周围48像素内的内部网格，兼顾节点间距和边界余量，避免凹多边形质心落在外面。
function memberPoint(territory, used) {
  const candidates = [];
  const xs = territory.polygon.map(([x]) => x), ys = territory.polygon.map(([, y]) => y);
  for (let y = Math.min(...ys) + 3; y < Math.max(...ys); y += 3) {
    for (let x = Math.min(...xs) + 3; x < Math.max(...xs); x += 3) {
      const radius = Math.hypot(x - territory.x, y - territory.y);
      if (radius > 48 || !insidePolygon(x, y, territory.polygon)) continue;
      const margin = edgeDistance(x, y, territory.polygon);
      if (margin < 4) continue;
      const separation = Math.min(...used.map(([ux, uy]) => Math.hypot(x - ux, y - uy)));
      candidates.push({ point: [x, y], score: Math.min(separation, margin * 2) - radius * 0.12 });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  if (!candidates.length) throw new Error(`领土成员没有内部落点：${territory.id}`);
  return candidates[0].point;
}

export const ATLAS_NODES = {};
for (const territory of WORLD_TERRITORIES) {
  const used = [[territory.x, territory.y]];
  for (const id of territory.zones) {
    const [x, y] = id === territory.primary ? used[0] : memberPoint(territory, used);
    if (id !== territory.primary) used.push([x, y]);
    ATLAS_NODES[id] = {
      ...REFERENCE_NODES[id],
      x: x / 436 * 100, y: y / 640 * 100, layer: 'mainland',
      evidence: REFERENCE_NODES[id]?.evidence || 'official',
      territoryId: territory.id,
      regionLabel: `${territory.name}·${id === territory.primary ? '原图领土代表点' : '领土内部H5避让示意'}`,
    };
  }
}

// 无确切47领土归属的资料补充点：0—100原图归一化坐标，全部放在左下空白区域。
const SUPPLEMENT_POINTS = {
  lingyuan: [12, 86], g_f1: [7, 95], g_f2: [24, 94],
  wl_cangmang: [38, 85], wl_jimo: [50, 93], f_kuangkeng: [54, 81],
};
for (const [id, [x, y]] of Object.entries(SUPPLEMENT_POINTS)) {
  ATLAS_NODES[id] = { ...REFERENCE_NODES[id], x, y, layer: 'mainland', supplement: true,
    regionLabel: `${ZONES[id].name}·资料补充示意（47领土范围未核实）` };
}
for (const [id, node] of Object.entries(REFERENCE_NODES)) {
  if (node.layer === 'islands' || node.layer === 'otherworld') ATLAS_NODES[id] = { ...node };
}

const TERRITORY_NOTES = {
  territory_07: '万流城是五族共建的中立圣城，不属单一种族；北屏、东屏、南屏三镇均可游历。',
  territory_10: '剑仙城为人族主城；鹏程客栈按种族相近分组，出生地确切领土范围未核实。',
  territory_14: '沐火村为领土主节点，焚心之地归此组；旧焚心等级、遭遇不变。',
  territory_19: '龙战之野与飞来镇分别可游历；资料述北接沐火村、离离草原，东接万化城，H5连接不等于原版道路。',
  territory_20: '万化城为兽族主城；北关营地按种族相近分组，出生地确切领土范围未核实。',
  territory_25: '落日高原与落日镇分别可游历；旧taoyuan是落日镇，绝非桃花坞的桃源镇。',
  territory_28: '无忧河西岸按附近历练分组，其确切领土范围未核实；古风口是安全服务节点。',
  territory_29: '通天湖与镜湖居为地面地点，不是秘宝窟；悬空天泪之城未作为第48块地面领土。',
  territory_35: '积羽城为羽族主城；落缨村按种族相近分组，出生地确切领土范围未核实。',
  territory_45: '残云岛属于47原图领土；孤云礁、折戟台均为实际可游历野外节点。',
  territory_46: '海狱岛、惊涛城、破浪营地分别可游历；龙牙村及外围按汐族相近分组，出生地与乘风原确切领土范围未核实。旧破浪野外属性不变。',
  territory_47: '碎梦岛属于47原图领土；地泉河、夜火坛均为实际可游历野外节点。',
};
const REGION_COLORS = ['#4d7a8d', '#647c9e', '#5f8762', '#986844', '#846699', '#478c85'];
function territoryDirection(t) {
  if (t.number >= 45) return '原图东南海域';
  const vertical = t.y < 150 ? '北部' : t.y < 350 ? '中部' : '南部';
  const horizontal = t.x < 150 ? '西' : t.x > 350 ? '东' : '';
  return `原图大陆${horizontal}${vertical}`;
}

// 47领土各一组；其余资料、独立地图、仙魔层并列。每个ZONES恰属一组。
export const ATLAS_REGIONS = [
  ...WORLD_TERRITORIES.map((t, i) => ({
    id: t.id, name: t.name, number: t.number, territoryId: t.id, primary: t.primary,
    direction: territoryDirection(t), color: REGION_COLORS[i % REGION_COLORS.length], zones: [...t.zones],
    note: `历史官方第${String(t.number).padStart(2, '0')}领土；原图轮廓不是道路。节点等级、生态、服务与连接为H5适配。${TERRITORY_NOTES[t.id] || ''}`,
  })),
  { id: 'earthguard', name: '灵族领地', direction: '左下资料补充示意', color: '#4f7fa8', zones: ['lingyuan', 'g_f1', 'g_f2'],
    note: '灵犀城、星栖苑与郊外并列为灵族资料补充，不属于47历史polygon；精确领土范围未核实，空白区落点不是原版地理投影。' },
  { id: 'supplement', name: '未核实领土归属的资料节点', direction: '左下资料补充示意', color: '#8a7850', zones: ['wl_cangmang', 'wl_jimo', 'f_kuangkeng'],
    note: '苍茫草原、寂寞海保留修真坐标参照，祭旗坡保留地宫路线；未核实47领土范围，独立资料分组不冒充官方第48领土。' },
  { id: 'islands', name: '地宫、海岛与独立地图', direction: '跨图独立示意', color: '#6a6550', zones: ['f_taoyuan', 'f_wanjie', 'f_tongtian', 'f_shedao', 'f_longgong'],
    note: '英雄冢地宫、夜哭岛、秘宝窟、蛇岛、龙宫均使用独立地图坐标，不混入大陆原图；实例只展示入口与简化遭遇。' },
  { id: 'otherworld', name: '仙魔两界', direction: '万流城归宗塔下的跨图入口', color: '#7d4f96', zones: ['f_xianmo'],
    note: '入口参照在万流城归宗塔下；本作两界集合为一独立示意层，不表示两界相邻或属于47领土。' },
];

// 返回 zone 所属地区；所有 ZONES 都应被 ATLAS_REGIONS 覆盖。
export function regionOf(zoneId) {
  return ATLAS_REGIONS.find((r) => r.zones.includes(zoneId)) || null;
}

// 已提供且核实的资料清单；title 为内容标签，不额外推断页面未证明的道路或门槛。
export const ATLAS_SOURCES = [
  { title: '官方攻略：怨灵之门入口与乘风原、云梦岭、夜哭岛路线；万流城修真任务猎杀坐标', evidence: 'official', url: 'https://w2i.wanmei.com/intro/guide/20091027/36465.shtml' },
  { title: '官方公告：剑仙城、惊涛城、灵犀城 NPC 坐标参照', evidence: 'official', url: 'https://w2i.wanmei.com/news/gamenews/20110419/59805.shtml' },
  { title: '官方 NPC 资料：万化城、落日镇地理参照', evidence: 'official', url: 'https://w2i.wanmei.com/xtjs/npc/20091019/30113.shtml' },
  { title: '官方 NPC 资料：积羽城地理参照', evidence: 'official', url: 'https://w2i.wanmei.com/xtjs/npc/20091019/30114.shtml' },
  { title: '官方 NPC 资料：万流城地理参照', evidence: 'official', url: 'https://w2i.wanmei.com/xtjs/npc/20091019/30115.shtml' },
  { title: '官方历史仙丹专题：47领土目录与436×640原图image-map', evidence: 'official', url: 'https://w2i.wanmei.com/hd/xiandan/' },
  ...WORLD_TERRITORIES.map((t) => ({ title: `官方历史领土${String(t.number).padStart(2, '0')}：${t.name}`, evidence: 'official', url: t.url })),
  { title: '17173 二级攻略：仙魔两界入口在万流城归宗塔下', evidence: 'secondary', url: 'https://w2i.17173.com/content/2025-08-26/20250826190511214.shtml' },
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
