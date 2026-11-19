import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ZONES, HOME_CITY } from '../src/data/world.js';
import { WORLD_TERRITORIES } from '../src/data/territories.js';
import { ATLAS_NODES, ATLAS_REGIONS, regionOf, routeTo, entryDungeons } from '../src/data/atlas.js';
import { ZONE_LANDMARKS } from '../src/data/landmarks.js';
import { Game, validateSave } from '../src/core/game.js';

const expected = '刺骨之地 冰封古道 雪崩峡谷 万木岭 幽冥古道 万劫城 万流城 古长城 破阵平原 剑仙城 残山 四方寨 灯笼山 沐火村 离离草原 疾风草原 信风镇 碧涛林 龙战之野 万化城 盘丝岭 邻水镇 祖龙城 暗香坡 落日高原 弱水之源 绝龙坡 无忧小道 通天湖 摩天崖 幽兰谷 桃花坞 沙漠海 惊鸿岭 积羽城 禹王鼎 怨灵沼泽 迷雾丛林 埋骨之地 南屏山 白岭 黑山 云梦岭 寻梦港 残云岛 海狱岛 碎梦岛'.split(' ');
assert.deepEqual(WORLD_TERRITORIES.map(r => r.name), expected);
assert.deepEqual(WORLD_TERRITORIES.map(r => r.number), Array.from({ length: 47 }, (_, i) => i + 1));
const source = await readFile(new URL('../official-library/raw/19ab30249fb4fa5dd6d5.html', import.meta.url), 'latin1');
const areas = [...source.matchAll(/<area\b[^>]*coords\s*=\s*["']?([\d,]+)["']?[^>]*href\s*=\s*"lingtu\/(\d+)\.htm"/gi)];
assert.equal(areas.length, 47);
const manifest = JSON.parse(await readFile(new URL('../official-library/pages/19ab30249fb4fa5dd6d5.json', import.meta.url)));
const sourceUrls = new Set(manifest.links.map(link => link.url));
const inside = (x, y, polygon) => {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) result = !result;
  }
  return result;
};
for (const r of WORLD_TERRITORIES) {
  const raw = areas.find(match => Number(match[2]) === r.number)[1].split(',').map(Number);
  assert.deepEqual(r.polygon.flat(), raw, `${r.name}: use exact official image-map boundary`);
  assert.ok(sourceUrls.has(r.url), `${r.name}: source URL is present in snapshot`);
  assert.ok(inside(r.x, r.y, r.polygon), `${r.name}: primary point belongs inside territory`);
  assert.equal(ZONES[r.primary].name, r.name, `${r.name}: actual destination, not decorative region`);
  assert.ok(r.zones.includes(r.primary));
  assert.ok(r.zones.every(id => regionOf(id).id === r.id));
}
assert.ok(Object.keys(ZONES).length > 100, 'Territories and their documented settlements must be playable');
const settlements = '雪霏村 碎冰村 雪崩村 伐木场 北屏镇 东屏镇 南屏镇 远征营地 苏木尔营 侠隐村 渔村 联军营地 沐火村 胡姬村 疾风部落 信风镇 飞来镇 断桥村 邻水镇 祖龙城北 祖龙城西 祖龙城南 无为村 落日镇 古风口 镜湖居 幽兰村 桃源镇 鸣沙村 野人村 倚竹村 踏箭山庄 砥石寨 迷失村 夜郎村 南柯寨 獠牙镇 云梦村 孤云礁 折戟台 惊涛城 破浪营地 地泉河 夜火坛'.split(' ');
for (const name of settlements) assert.ok(Object.values(ZONES).some(z => z.name === name), `${name}: documented settlement must be an actual destination`);
assert.deepEqual(Object.keys(ATLAS_NODES).sort(), Object.keys(ZONES).sort());
assert.deepEqual(Object.keys(ZONE_LANDMARKS).sort(), Object.keys(ZONES).sort());
assert.deepEqual(ATLAS_REGIONS.flatMap(r => r.zones).sort(), Object.keys(ZONES).sort(), 'Every zone belongs to exactly one region');
assert.deepEqual(HOME_CITY, { human: 'wanliu', elf: 'jiyu', untamed: 'wanhua', tideborn: 'xidao', earthguard: 'lingyuan' });
for (const [id, name] of Object.entries({ wanliu: '剑仙城', wl_city: '万流城', wanjie: '寻梦港', f_tongtian: '秘宝窟', taoyuan: '落日镇', f_jifeng: '乘风原' })) assert.equal(ZONES[id].name, name);
assert.notEqual(regionOf('wl_cigu').id, regionOf('wl_city').id);
assert.notEqual(regionOf('wl_changcheng').id, regionOf('wl_city').id);
assert.equal(ATLAS_NODES.f_taoyuan.layer, 'islands');
assert.equal(ATLAS_NODES.f_xianmo.layer, 'otherworld');
assert.deepEqual(entryDungeons('f_taoyuan').map(d => d.id), ['d25']);
let hops = 0, gateChecks = 0, monsters = 0;
for (const [id, zone] of Object.entries(ZONES)) {
  assert.equal(ZONE_LANDMARKS[id].name, zone.name, `${id}: named scene`);
  assert.ok(ZONE_LANDMARKS[id].motif && ZONE_LANDMARKS[id].biome && Object.keys(ZONE_LANDMARKS[id].palette).length >= 8);
  assert.ok(zone.links.length && new Set(zone.links).size === zone.links.length);
  assert.ok(zone.links.every(next => next !== id && ZONES[next]?.links.includes(id)), `${id}: valid two-way travel`);
  const n = ATLAS_NODES[id];
  assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y) && n.x >= 0 && n.x <= 100 && n.y >= 0 && n.y <= 100);
  if (zone.type === 'field') { assert.ok(zone.mobs.length >= 4 && zone.mobs.some(m => !m[2]) && zone.mobs.some(m => m[2] === 'elite') && zone.mobs.some(m => m[2] === 'boss'), `${id}: valid encounters and bounty candidates`); monsters += zone.mobs.length; }
  else assert.ok(zone.npcs.includes('rest'));
  const game = new Game(); game.start('地图独立夹具', 'blademaster'); game.p.lv = 105; game.p.cult = 11;
  const path = routeTo(game.p.location, id, game.p);
  assert.ok(path, `${id}: reachable from starting network`);
  for (const next of path.slice(1)) { game.travel(next); hops++; }
  assert.equal(game.p.location, id);
  assert.ok(game.p.discovered.includes(id) && (path.length === 1 || game.p.visits.includes(id)));
  if (zone.type === 'city') assert.equal(game.p.lastCity, id);
  assert.equal(new Game(validateSave(game.state)).p.location, id, `${id}: save schema accepts actual travel`);
  if (zone.type === 'field') {
    for (let index = 0; index < zone.mobs.length; index++) {
      const hunter = new Game(structuredClone(game.state)); hunter.hunt(index);
      assert.equal(hunter.battle.monsters[0].name, zone.mobs[index][0]);
      assert.equal(validateSave(hunter.state).battle.context.zone, id, `${id}: actual encounter and saved battle`);
    }
  }
  const gate = Math.max(1, zone.lv[0] - 5);
  if (gate > 1 || zone.minCult) {
    const blocked = new Game(); blocked.start('门槛独立夹具', 'blademaster'); blocked.p.location = zone.links[0]; blocked.p.lv = gate > 1 ? gate - 1 : 105; blocked.p.cult = zone.minCult ? zone.minCult - 1 : 11;
    const before = structuredClone(blocked.state);
    assert.throws(() => blocked.travel(id), /需要/); assert.deepEqual(blocked.state, before);
    assert.equal(routeTo(blocked.p.location, id, blocked.p), null); gateChecks++;
  }
}
const fresh = new Game(); fresh.start('自然地图验收', 'blademaster');
const before = structuredClone(fresh.state);
assert.equal(routeTo('wanliu', 'wl_city', fresh.p), null);
assert.throws(() => fresh.travel('wl_city', true)); assert.deepEqual(fresh.state, before);
fresh.travel('h_f1'); assert.equal(fresh.p.lv, 1); assert.equal(fresh.p.location, 'h_f1');
console.log(JSON.stringify({ territories: 47, regions: ATLAS_REGIONS.length, zones: Object.keys(ZONES).length, cities: Object.values(ZONES).filter(z => z.type === 'city').length, fields: Object.values(ZONES).filter(z => z.type === 'field').length, monsters, actualTravelHops: hops, blockedGateChecks: gateChecks, result: 'PASS exact official boundaries, real destinations, two-way travel, schema and old identities' }, null, 2));
