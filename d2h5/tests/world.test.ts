import test from 'node:test';
import assert from 'node:assert/strict';
import type { AreaState, Difficulty, Player } from '../src/types';
import {
  AREAS, NPCS, QUESTS, WORLD_GATES, WORLD_LIMITATIONS, canTravel, createArea,
  createMonster, getArea, getConnections, monsterStats, onEnterArea, onKill,
  questKey, talkNPC, townForAct, worldRng,
} from '../src/world';

function player(difficulty: Difficulty = 'normal'): Player {
  return {
    classId:'pal',name:'世界测试',level:1,experience:0,difficulty,
    strength:25,dexterity:20,vitality:25,energy:15,statPoints:0,skillPoints:0,skills:{},
    life:55,mana:15,stamina:89,gold:0,inventory:[],stash:[],cube:[],equipment:{},belt:[null,null,null,null],
    weaponSwap:false,quests:{},waypoints:[1],unlockedActs:1,unlockedDifficulties:1,
    bonusLife:0,bonusResist:0,leftSkill:0,rightSkill:0,running:false,dead:false,x:10,y:14,
  };
}
function flood(area: AreaState): Set<string> {
  const queue=[area.spawn],seen=new Set([`${area.spawn.x},${area.spawn.y}`]);
  for (let i=0;i<queue.length;i++) for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const x=queue[i].x+dx,y=queue[i].y+dy,key=`${x},${y}`;
    if (area.tiles[y]?.[x] !== 0 || seen.has(key)) continue;
    seen.add(key);queue.push({x,y});
  }
  return seen;
}
function kill(p: Player, area: AreaState, index: number): string[] {
  const monster=area.monsters[index];monster.life=0;monster.dead=true;
  return onKill(p,area,monster);
}

test('catalogue has all 136 real IDs, 39 correct waypoints and 27 scoped quest IDs', () => {
  assert.equal(AREAS.length,136);
  assert.deepEqual(AREAS.map(a=>a.id),Array.from({length:136},(_,i)=>i+1));
  const waypointIds=[1,3,4,5,6,27,29,32,35,40,42,43,44,48,57,52,74,46,75,76,77,78,79,80,81,83,101,103,106,107,109,111,112,113,115,117,118,123,129].sort((a,b)=>a-b);
  assert.deepEqual(AREAS.filter(a=>a.waypoint).map(a=>a.id),waypointIds);
  assert.deepEqual([1,2,3,4,5].map(act=>AREAS.filter(a=>a.act===act&&a.waypoint).length),[9,9,9,3,9]);
  assert.equal(QUESTS.length,27);
  assert.deepEqual(QUESTS.map(q=>q.id),[1,2,3,4,5].flatMap(act=>Array.from({length:act===4?3:6},(_,i)=>`a${act}q${i+1}`)));
  for (const area of AREAS) {
    assert.match(area.name,/[\u4e00-\u9fff]/);assert.ok(area.english.length>2);
    for (const target of area.connections) {
      assert.equal(getArea(target).act,area.act);
      assert.ok(getArea(target).connections.includes(area.id),`${area.id}–${target} must be bidirectional`);
    }
  }
  for (const quest of QUESTS) { assert.match(quest.description,/[\u4e00-\u9fff]/);assert.match(quest.reward,/[\u4e00-\u9fff]/); }
  assert.equal(getArea(111).english,'Frigid Highlands');
  assert.equal(getArea(123).english,'Halls of Pain');
  assert.equal(getArea(84).english,'Arachnid Lair');
  assert.equal(getArea(108).english,'Chaos Sanctuary');
  assert.ok(AREAS.slice(65,72).every(a=>a.english==="Tal Rasha's Tomb"));
  assert.deepEqual([1,2,3,4,5].map(townForAct),[1,40,75,103,109]);
  assert.throws(()=>getArea(0),RangeError);assert.throws(()=>getArea(137),RangeError);assert.throws(()=>townForAct(6),RangeError);
});

test('expansion area level anchors retain Normal, Nightmare and Hell distinctions', () => {
  const expected: Record<number,number[]>={
    1:[0,0,0],2:[1,36,67],8:[1,36,79],10:[4,37,69],12:[7,39,85],16:[7,40,85],
    19:[3,37,85],20:[0,0,0],25:[7,42,79],35:[11,42,73],37:[12,43,73],39:[28,64,81],
    50:[0,0,0],60:[13,45,82],64:[17,46,85],65:[17,46,85],66:[17,49,80],73:[17,49,80],74:[14,48,79],
    85:[21,50,79],93:[24,53,85],94:[23,53,84],101:[25,55,83],108:[28,58,85],
    110:[24,58,80],120:[37,68,87],123:[34,64,84],128:[39,65,85],132:[43,66,85],
    133:[50,75,83],134:[50,75,83],135:[50,75,83],136:[50,75,83],
  };
  for (const [id,levels] of Object.entries(expected)) assert.deepEqual(getArea(Number(id)).levels,levels,id);
  assert.deepEqual(getArea(2).monsters,['zombie1','fallen1','quillrat1']);
  assert.deepEqual(getArea(8).monsters,['zombie1','brute1','fallenshaman1']);
});

test('seeded RNG and complete maps are reproducible without consuming player state', () => {
  const a=worldRng(123),b=worldRng(123);
  for (let i=0;i<100;i++) {const n=a();assert.equal(n,b());assert.ok(n>=0&&n<1);}
  const p=player(),snapshot=structuredClone(p);
  for (const id of [1,2,8,10,37,77,113]) {
    p.unlockedActs=5;
    assert.deepEqual(createArea(id,'normal',123,p),createArea(id,'normal',123,p));
    if (id!==1) assert.notDeepEqual(createArea(id,'normal',123,p).tiles,createArea(id,'normal',124,p).tiles);
  }
  p.unlockedActs=1;assert.deepEqual(p,snapshot);
});

test('all 136 areas in all difficulties have reachable exits, objects, monsters and floor', () => {
  for (const difficulty of ['normal','nightmare','hell'] as const) for (const seed of [0,92831]) {
    const p=player(difficulty);p.unlockedActs=5;
    for (const def of AREAS) {
      const area=createArea(def.id,difficulty,seed,p),seen=flood(area),prefix=`${difficulty}:${seed}:${def.id}`;
      assert.equal(area.tiles[area.spawn.y][area.spawn.x],0,prefix);
      assert.ok(area.revealed.every(row=>row.every(value=>value===false)),prefix);
      for (const object of [...area.objects,...area.monsters]) assert.ok(seen.has(`${object.x},${object.y}`),`${prefix}: ${object.uid}`);
      for (let y=0;y<area.height;y++) for (let x=0;x<area.width;x++) {
        assert.ok(area.tiles[y][x]===0||area.tiles[y][x]===1,prefix);
        if (area.tiles[y][x]===0) assert.ok(seen.has(`${x},${y}`),prefix);
      }
      assert.equal(new Set([...area.objects,...area.monsters].map(o=>o.uid)).size,area.objects.length+area.monsters.length,prefix);
      assert.equal(area.objects.filter(o=>o.kind==='waypoint').length,def.waypoint?1:0,prefix);
      assert.deepEqual(area.objects.filter(o=>o.kind==='exit'||o.kind==='portal').map(o=>o.targetArea).sort((a,b)=>a!-b!),getConnections(p,def.id),prefix);
      if (def.town) {assert.equal(area.width,34);assert.equal(area.height,28);assert.equal(area.monsters.length,0);assert.ok(area.objects.some(o=>o.kind==='stash'));}
    }
  }
});

test('first golden path has a nearby town exit and Blood Moor enemies six to twelve tiles away', () => {
  const p=player(),town=createArea(1,'normal',12,p),moor=createArea(2,'normal',12,p),den=createArea(8,'normal',12,p);
  const exit=town.objects.find(o=>o.targetArea===2)!;
  assert.equal(Math.hypot(exit.x-town.spawn.x,exit.y-town.spawn.y),5);
  assert.ok(moor.objects.some(o=>o.targetArea===8));
  for (const m of moor.monsters.slice(0,3)) {
    const distance=Math.hypot(m.x-moor.spawn.x,m.y-moor.spawn.y);assert.ok(distance>=6&&distance<=12);
  }
  assert.equal(den.monsters.length,24);assert.ok(den.width<=40);
  assert.equal(den.monsters.filter(m=>m.modifiers.includes('superunique:Corpsefire')).length,1);
  assert.equal(den.monsters.filter(m=>m.modifiers.includes('minion')).length,5);
  assert.ok(den.monsters.some(m=>m.ai==='shaman'));
});

test('Den needs ALL kills, retains corpses, and grants reward only at Akara once per difficulty', () => {
  const p=player();onEnterArea(p,createArea(1,'normal',1,p));
  assert.equal(p.quests[questKey(p,'a1q1')],1);
  const den=createArea(8,'normal',1,p);onEnterArea(p,den);
  talkNPC(p,'akara');assert.equal(p.skillPoints,0);
  const corpsefire=den.monsters.findIndex(m=>m.modifiers.includes('superunique:Corpsefire'));
  kill(p,den,corpsefire);talkNPC(p,'akara');assert.equal(p.skillPoints,0);
  for (let i=0;i<den.monsters.length-1;i++) kill(p,den,i);
  assert.equal(p.quests[questKey(p,'a1q1')],1);talkNPC(p,'akara');assert.equal(p.skillPoints,0);
  assert.match(kill(p,den,den.monsters.length-1).join(''),/清空/);
  assert.equal(p.quests[questKey(p,'a1q1')],2);assert.equal(p.skillPoints,0);
  assert.equal(den.monsters.length,24);assert.ok(den.monsters.every(m=>m.dead));
  const result=talkNPC(p,'akara');assert.equal(p.skillPoints,1);assert.ok(result.services.includes('respec'));
  assert.equal(p.quests[questKey(p,'a1q1')],3);assert.equal(p.quests[questKey(p,'respec')],1);
  talkNPC(p,'akara');onKill(p,den,den.monsters[0]);assert.equal(p.skillPoints,1);
  p.quests[questKey(p,'respec')]=2;talkNPC(p,'akara');assert.equal(p.quests[questKey(p,'respec')],2);
  p.difficulty='nightmare';const nm=createArea(8,'nightmare',1,p);onEnterArea(p,nm);
  talkNPC(p,'akara');assert.equal(p.skillPoints,1);
  for (let i=0;i<nm.monsters.length;i++) kill(p,nm,i);
  talkNPC(p,'akara');talkNPC(p,'akara');assert.equal(p.skillPoints,2);
  assert.equal(p.quests['normal:a1q1'],3);assert.equal(p.quests['nightmare:a1q1'],3);
  p.difficulty='hell';talkNPC(p,'akara');assert.equal(p.skillPoints,2);assert.equal(p.quests['hell:a1q1'],1);
});

test('a revived Fallen cancels pending Den reward and must die again', () => {
  const p=player(),den=createArea(8,'normal',2,p);onEnterArea(p,den);
  for (let i=0;i<den.monsters.length;i++) kill(p,den,i);
  const revived=den.monsters.find(m=>m.code==='fallen1')!;
  revived.dead=false;revived.life=revived.maxLife;
  talkNPC(p,'akara');assert.equal(p.skillPoints,0);assert.equal(p.quests[questKey(p,'a1q1')],1);
  revived.life=0;onKill(p,den,revived);talkNPC(p,'akara');assert.equal(p.skillPoints,1);
});

test('Blood Raven and Countess credit only the right named encounter, not generic talk', () => {
  const p=player();talkNPC(p,'kashya');assert.equal(p.quests[questKey(p,'a1q2')],1);
  const burial=createArea(17,'normal',3,p);onEnterArea(p,burial);
  kill(p,burial,burial.monsters.findIndex(m=>m.code==='bloodraven'));
  assert.equal(p.quests[questKey(p,'a1q2')],2);assert.equal(p.mercenary,undefined);
  assert.ok(talkNPC(p,'kashya').services.includes('hire'));
  assert.equal(p.quests[questKey(p,'freeRogue')],1);talkNPC(p,'kashya');assert.equal(p.skillPoints,0);
  const tower=createArea(25,'normal',4,p);onEnterArea(p,tower);kill(p,tower,0);
  assert.equal(p.quests[questKey(p,'a1q4')],1);
  kill(p,tower,tower.monsters.findIndex(m=>m.modifiers.includes('superunique:The Countess')));
  assert.equal(p.quests[questKey(p,'a1q4')],3);assert.equal(p.skillPoints,0);
});

test('act travel is locked until Andariel dies and Warriv receives the quest', () => {
  const p=player();talkNPC(p,'warriv');assert.equal(p.unlockedActs,1);
  assert.equal(canTravel(p,40),false);assert.deepEqual(getConnections(p,40),[]);
  assert.deepEqual(getConnections(p,1),[2]);assert.deepEqual(getConnections(p,37),[36]);
  const catacombs=createArea(37,'normal',5,p);onEnterArea(p,catacombs);
  kill(p,catacombs,catacombs.monsters.findIndex(m=>m.code==='andariel'));
  assert.equal(p.quests[questKey(p,'a1q6')],2);assert.equal(p.unlockedActs,1);assert.equal(canTravel(p,40),false);
  assert.ok(talkNPC(p,'warriv').services.includes('travel'));
  assert.equal(p.quests[questKey(p,'a1q6')],3);assert.equal(p.unlockedActs,2);assert.equal(canTravel(p,40),true);
  assert.equal(canTravel(p,75),false);assert.deepEqual(getConnections(p,1),[2]);
  talkNPC(p,'warriv');assert.equal(p.unlockedActs,2);
  p.difficulty='nightmare';p.unlockedActs=1;talkNPC(p,'warriv');assert.equal(p.unlockedActs,1);
});

test('waypoints are interaction-only and ordinary edges never become arbitrary fast travel', () => {
  const p=player(),cold=createArea(3,'normal',9,p);onEnterArea(p,cold);
  assert.deepEqual(p.waypoints,[1]);assert.equal(canTravel(p,3),false);
  p.waypoints.push(3);assert.equal(canTravel(p,3),true);
  p.waypoints.push(8,40);assert.equal(canTravel(p,8),false);assert.equal(canTravel(p,40),false);
  assert.equal(canTravel(p,2),false);assert.equal(canTravel(p,0),false);assert.equal(canTravel(p,NaN),false);
  p.unlockedActs=5;
  for (const gate of WORLD_GATES.filter(g=>!g.implemented)) assert.ok(!getConnections(p,gate.from).includes(gate.to));
  assert.ok(getConnections(p,54).includes(74));assert.ok(getConnections(p,74).includes(54));
  assert.ok(!getArea(4).connections.includes(38));assert.ok(!getArea(1).connections.includes(39));
  for (const id of [133,134,135,136]) {assert.equal(canTravel(p,id),false);assert.deepEqual(getConnections(p,id),[]);}
  p.difficulty='hell';p.waypoints=[1];assert.equal(canTravel(p,3),false);
});

test('unsupported quest chains never auto-complete or grant bonuses on NPC talk', () => {
  const p=player();p.unlockedActs=5;
  for (let i=0;i<3;i++) for (const id of Object.keys(NPCS)) talkNPC(p,id);
  assert.equal(p.skillPoints,0);assert.equal(p.statPoints,0);assert.equal(p.bonusLife,0);assert.equal(p.bonusResist,0);
  assert.equal(p.quests[questKey(p,'a1q3')]??0,0);
  assert.ok(!talkNPC(p,'cain').services.includes('identify'));
  assert.equal(p.life,55);assert.equal(p.mana,15);
  assert.ok(NPCS.akara.services.includes('heal'));assert.ok(!NPCS.elzix.services.includes('repair'));
  assert.ok(WORLD_LIMITATIONS.some(s=>s.includes('未实现')));
});

for (const difficulty of ['normal', 'nightmare', 'hell'] as const) test(`Cain appears and offers identification only after rescue in ${difficulty}`, () => {
  const p = player(); p.difficulty = difficulty;
  for (const other of ['normal', 'nightmare', 'hell'] as const) if (other !== difficulty) p.quests[questKey(other, 'a1q3')] = 3;
  p.quests.a1q3 = 3;
  for (const status of [0, 1, 2]) {
    p.quests[questKey(p, 'a1q3')] = status;
    assert.ok(!createArea(1, difficulty, 123, p).objects.some(o => o.npcId === 'cain'));
    assert.ok(!talkNPC(p, 'cain').services.includes('identify'));
    assert.equal(p.quests[questKey(p, 'a1q3')], status);
  }
  p.quests[questKey(p, 'a1q3')] = 3;
  assert.equal(createArea(1, difficulty, 123, p).objects.filter(o => o.npcId === 'cain').length, 1);
  assert.ok(talkNPC(p, 'cain').services.includes('identify'));
  assert.ok(!talkNPC(p, 'akara').services.includes('identify'));
});

test('native zombie and Fallen stats use exact integer scaling and normal monster level, not alvl', () => {
  const zombie=monsterStats('zombie1',37,'normal');
  assert.equal(zombie.baseLevel,1);assert.equal(zombie.level,1);
  assert.equal(zombie.minLife,7);assert.equal(zombie.maxLife,12);
  assert.equal(zombie.minDamage,1);assert.equal(zombie.maxDamage,3);
  assert.equal(zombie.defense,5);assert.equal(zombie.attackRating,8);assert.equal(zombie.experience,33);assert.equal(zombie.resists.poison,50);
  const fallen=monsterStats('fallen1',2,'normal');
  assert.equal(fallen.minLife,1);assert.equal(fallen.maxLife,4);assert.equal(fallen.minDamage,1);assert.equal(fallen.maxDamage,2);assert.equal(fallen.experience,18);
  const nmZombie=monsterStats('zombie1',8,'nightmare');
  assert.equal(nmZombie.level,36);assert.equal(nmZombie.minLife,551);assert.equal(nmZombie.maxLife,787);assert.equal(nmZombie.experience,2696);
  const hellFallen=monsterStats('fallen1',2,'hell');
  assert.equal(hellFallen.level,67);assert.equal(hellFallen.resists.fire,100);assert.equal(hellFallen.resists.cold,40);assert.equal(hellFallen.resists.physical,15);
  assert.equal(hellFallen.minLife,1028);assert.equal(hellFallen.maxLife,2261);assert.equal(hellFallen.defense,933);
  assert.equal(hellFallen.minDamage,34);assert.equal(hellFallen.maxDamage,68);assert.equal(hellFallen.attackRating,2451);assert.equal(hellFallen.experience,17376);
  const unique=monsterStats('fallen1',2,'hell','unique');
  assert.equal(unique.baseLevel,67);assert.equal(unique.level,70);assert.equal(unique.minLife,hellFallen.minLife*2);
  assert.equal(unique.defense,hellFallen.defense);assert.equal(unique.experience,hellFallen.experience*5);
  assert.equal(unique.attackRating,2554);assert.equal(unique.minDamage,36);assert.equal(unique.maxDamage,72);
  const champion=monsterStats('zombie1',8,'nightmare','champion');assert.equal(champion.minLife,1377.5);
  const m=createMonster('zombie1',2,'normal',worldRng(1),{x:6,y:7},'test');assert.ok(m.maxLife>=7&&m.maxLife<=12);assert.equal(m.ai,'melee');
});

test('act bosses retain native HP, physical damage, fixed levels and resistances without rebalance', () => {
  const andy=monsterStats('andariel',37,'normal');
  assert.equal(andy.level,12);assert.equal(andy.minLife,1024);assert.equal(andy.maxLife,1024);
  assert.equal(andy.minDamage,6);assert.equal(andy.maxDamage,19);assert.equal(andy.experience,1282);
  const hellAndy=monsterStats('andariel',37,'hell','unique');assert.equal(hellAndy.level,75);assert.equal(hellAndy.minLife,60031);assert.equal(hellAndy.resists.fire,-50);
  assert.equal(monsterStats('bloodraven',17,'normal').minLife,113);
  const raven=createMonster('bloodraven',17,'normal',worldRng(1),{x:6,y:7},'raven');
  assert.equal(raven.boss,true);assert.equal(raven.ai,'ranged');
  assert.equal(monsterStats('fallenshaman1',8,'normal').level,2);
  assert.equal(questKey('hell','a1q1'),'hell:a1q1');
  assert.equal(monsterStats('baalcrab',132,'hell').minLife,493701);
});
