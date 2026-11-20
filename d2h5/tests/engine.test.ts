import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, findPath, seededRandom, validSave } from '../src/engine';
import { LEGACY_CHARACTER_ID } from '../src/storage';
import type { SaveRecord } from '../src/storage';
import { createPlayer, deriveStats, manaRegeneration, skillLevel, skillEffect, SHRINES, getShrine } from '../src/rules';
import type { Rng, WorldObject } from '../src/types';
import { consumePotion, createItem, createStartingItems, insertSocket, rollLoot, STASH_HEIGHT, STASH_WIDTH, GEMS, itemSellPrice } from '../src/items';
import { containsRegion, createArea, getArea, getSurfaceRegion, hasLineOfSight, questKey, surfaceRegionAt } from '../src/world';

const memoryStore = () => {
  const values = new Map<string, SaveRecord>();
  let legacyDeleted = false;
  return {
    values,
    list: async () => structuredClone([...values.values()]),
    get: async (id: string) => structuredClone(values.get(id)),
    put: async (record: SaveRecord) => { if (legacyDeleted && record.id === LEGACY_CHARACTER_ID) throw new Error('deleted'); values.set(record.id, structuredClone(record)); },
    delete: async (id: string) => { values.delete(id); if (id === LEGACY_CHARACTER_ID) legacyDeleted = true; },
    importLegacy: async (record: SaveRecord) => { if (!legacyDeleted && !values.has(record.id)) values.set(record.id, structuredClone(record)); },
  };
};

function inventoryUseFixture(town = true) {
  const engine = new Engine(); engine.dispatch({ type: 'new', classId: 'sor', name: '行囊使用测试' });
  const p = engine.state.player!; p.inventory = [];
  if (!town) { engine.state.area = createArea(2, 'normal', 123, p); engine.state.area.monsters = []; Object.assign(p, engine.state.area.spawn); }
  const add = (code: string, quantity = 1) => {
    const item = createItem(code, 1, () => .5); Object.assign(item, { quantity, x: p.inventory.length % 10, y: 0 }); p.inventory.push(item); return item;
  };
  const target = () => { const item = add('cm1'); item.quality = 'magic'; item.identified = false; item.mods = { life: 20, mana: 25 }; return item; };
  return { engine, p, add, target };
}

for (const [scrollCode, tomeCode] of [['tsc', 'tbk'], ['isc', 'ibk']]) test(`fill-tome dispatch fills ${tomeCode} atomically and uses the resulting charge`, () => {
  const {engine, p, add, target} = inventoryUseFixture(false), scroll = add(scrollCode), tome = add(tomeCode, 0);
  const before = structuredClone(p.equipment); engine.state.saved = true;
  engine.state.identifySource = scroll.uid; engine.state.selectedItem = scroll.uid;
  engine.dispatch({type: 'fill-tome', uid: scroll.uid, tomeUid: tome.uid});
  assert.equal(tome.quantity, 1); assert.ok(!p.inventory.includes(scroll)); assert.equal(engine.state.saved, false);
  assert.equal(engine.state.selectedItem, tome.uid); assert.equal(engine.state.identifySource, null);
  assert.match(engine.state.messages.at(-1)!.text, /已填充/); assert.deepEqual(p.equipment, before);
  engine.dispatch({type: 'fill-tome', uid: scroll.uid, tomeUid: tome.uid}); assert.equal(tome.quantity, 1);
  if (tomeCode === 'tbk') engine.dispatch({type: 'use-item', uid: tome.uid});
  else { const unidentified = target(); engine.dispatch({type: 'use-item', uid: tome.uid, targetUid: unidentified.uid}); assert.equal(unidentified.identified, true); }
  assert.equal(tome.quantity, 0); assert.ok(p.inventory.includes(tome));
});
for (const gate of ['paused', 'dead', 'title', 'full', 'mismatch', 'stash', 'missing'] as const) test(`fill-tome dispatch rejects ${gate} without dirtying or changing selection`, () => {
  const {engine, p, add} = inventoryUseFixture(), scroll = add('isc'), tome = add(gate === 'mismatch' ? 'tbk' : 'ibk', gate === 'full' ? 20 : 0);
  if (gate === 'paused') engine.state.paused = true;
  if (gate === 'dead') p.dead = true;
  if (gate === 'title') engine.state.screen = 'title';
  if (gate === 'stash') { p.inventory.splice(p.inventory.indexOf(tome), 1); p.stash.push(tome); }
  engine.state.saved = true; engine.state.selectedItem = scroll.uid; engine.state.identifySource = scroll.uid;
  const before = structuredClone(p);
  engine.dispatch({type: 'fill-tome', uid: gate === 'missing' ? 'missing-scroll' : scroll.uid, tomeUid: tome.uid});
  assert.deepEqual(p, before); assert.equal(engine.state.saved, true); assert.equal(engine.state.selectedItem, scroll.uid); assert.equal(engine.state.identifySource, scroll.uid);
});
test('fill-tome preserves a remaining legacy scroll stack and version-1 quantities through reload', async () => {
  const store = memoryStore(), engine = new Engine(store); await engine.initialize(); engine.dispatch({type:'new', classId:'sor', name:'装书存档'});
  const p = engine.state.player!, scroll = createItem('isc', 1, () => .5), tome = createItem('ibk', 1, () => .5);
  Object.assign(scroll, {quantity: 2, x:0, y:0}); Object.assign(tome, {quantity:18, x:1, y:0}); p.inventory = [scroll, tome];
  engine.state.identifySource = scroll.uid;
  engine.dispatch({type:'fill-tome', uid:scroll.uid, tomeUid:tome.uid});
  assert.equal(scroll.quantity, 1); assert.equal(tome.quantity, 19); assert.equal(engine.state.identifySource, scroll.uid);
  await engine.save(false); const id = engine.state.activeSaveId!, record = await store.get(id);
  assert.ok(validSave(record)); assert.equal(record!.version, 1);
  await engine.load(id); assert.deepEqual(engine.state.player!.inventory, record!.player.inventory); assert.equal(engine.state.identifySource, null);
});
test('engine selling pays exactly the shared itemSellPrice quote and never sells quest items', () => {
  const {engine,p,add} = inventoryUseFixture(), npc = engine.state.area!.objects.find(o => o.npcId === 'akara')!;
  Object.assign(p, npc); engine.dispatch({type:'interact', uid:npc.uid});
  for (const difficulty of ['normal', 'nightmare', 'hell'] as const) {
    p.difficulty = difficulty; const item = add('rin'); item.price = 999999; const gold = p.gold, price = itemSellPrice(item, difficulty, 1)!;
    engine.dispatch({type:'sell', uid:item.uid}); assert.equal(p.gold, gold + price); assert.ok(!p.inventory.includes(item));
  }
  const cube = add('box'), gold = p.gold; assert.equal(itemSellPrice(cube, p.difficulty, 1), null);
  engine.dispatch({type:'sell', uid:cube.uid}); assert.ok(p.inventory.includes(cube)); assert.equal(p.gold, gold);
});

function shrineFixture() {
  const engine = new Engine(), p = createPlayer('sor', '神龛与金币');
  const area = createArea(2, 'normal', 421, p); area.width = area.height = 20;
  area.tiles = Array.from({length:20}, () => Array(20).fill(0)); area.revealed = Array.from({length:20}, () => Array(20).fill(false));
  area.monsters = []; area.objects = []; area.drops = []; Object.assign(p, {x:5.5, y:5.5, running:false, skills:{36:1}, rightSkill:36});
  Object.assign(engine.state, {player:p, area, stats:deriveStats(p), screen:'game', saved:true});
  const activate = (code?:number) => {
    const object: WorldObject = {uid:`shrine-${area.objects.length}`,kind:'shrine',name:getShrine(code ?? 1)?.name ?? '旧神龛',x:p.x,y:p.y,shrineCode:code};
    area.objects.push(object); engine.dispatch({type:'interact',uid:object.uid}); return object;
  };
  const pile = (quantity:number, x=p.x, y=p.y, code='gld') => { const item = createItem(code,1,()=>.5); item.quantity=quantity; const drop={item,x,y}; area.drops.push(drop); return drop; };
  return {engine,p,area,activate,pile};
}
test('nearby gold picks two piles once at the exact radius while ignoring gear, distant gold and walls even with a full inventory', () => {
  const {engine,p,area,pile} = shrineFixture();
  p.inventory = Array.from({length:80}, (_,i) => { const item = createItem('cm1',1,()=>.5); Object.assign(item,{x:i%10,y:Math.floor(i/10)}); return item; });
  const a=pile(11), b=pile(23,p.x-2), distant=pile(99,p.x-2.001), wall=pile(77,p.x+1.5), gear=pile(1,p.x,p.y,'rin'); area.tiles[5][6]=1;
  engine.step(); assert.equal(p.gold,34); assert.deepEqual(area.drops,[distant,wall,gear]); assert.equal(engine.state.saved,false);
  assert.equal(engine.state.messages.filter(m=>m.kind==='loot').length,1); assert.match(engine.state.messages.at(-1)!.text,/34 金币/);
  engine.dispatch({type:'pickup',uid:a.item.uid}); engine.dispatch({type:'pickup',uid:b.item.uid}); engine.step(); assert.equal(p.gold,34);
});
for (const gate of ['paused','dead','title'] as const) test(`automatic gold does not run while ${gate}`, () => {
  const {engine,p,area,pile} = shrineFixture(); pile(50);
  if (gate==='paused') engine.state.paused=true; if (gate==='dead') p.dead=true; if (gate==='title') engine.state.screen='title';
  const tick=engine.state.tick; engine.step(); assert.equal(p.gold,0); assert.equal(area.drops.length,1); assert.equal(engine.state.tick,tick); assert.equal(engine.state.saved,true);
});
test('automatic gold preserves click routes, attack intent and pending equipment pickup', () => {
  const {engine,p,area,pile} = shrineFixture(); pile(50); engine.dispatch({type:'move',point:{x:14.5,y:5.5}});
  const access=engine as unknown as {path:unknown[];attackTarget:unknown;pendingInteraction:unknown};
  const path=access.path, attack={point:{x:15,y:5},right:false}; access.attackTarget=attack;
  // Existing recovery prevents a new attack from consuming its route.
  (engine as unknown as {cooldown:number}).cooldown=10;
  const gear=pile(1,14.5,5.5,'rin'), pending={uid:gear.item.uid,pickup:true}; access.pendingInteraction=pending;
  engine.step(); assert.equal(p.gold,50); assert.ok(p.x>5.5); assert.equal(access.path,path); assert.equal(access.attackTarget,attack); assert.equal(access.pendingInteraction,pending);
  for(let frame=0;frame<5;frame++) engine.step(); assert.ok(p.x>6.5); assert.ok(area.drops.includes(gear));
});

for (const shrine of SHRINES.filter(s=>s.duration)) test(`shrine code ${shrine.code} applies one real blessing, expires in raw frames and recharges on raw reset`, () => {
  const {engine,p,activate} = shrineFixture(); const original=structuredClone(p), base=deriveStats(p), object=activate(shrine.code);
  assert.equal(object.used,true); assert.deepEqual(engine.state.shrineBuff,{code:shrine.code,name:shrine.name,frames:shrine.duration});
  const stats=engine.state.stats!;
  if(shrine.code===6) assert.equal(stats.defense,Math.floor(base.defense*(100+shrine.arg0)/100));
  if(shrine.code===7) { assert.equal(stats.attackRating,Math.floor(base.attackRating*(100+shrine.arg0)/100)); assert.ok(stats.maxDamage>base.maxDamage); }
  for(const [code,key] of [[8,'resFire'],[9,'resCold'],[10,'resLightning'],[11,'resPoison']] as const) if(shrine.code===code) assert.equal(stats[key],75);
  if(shrine.code===12) { assert.equal(skillLevel(p,36),3); assert.equal(stats.allSkills,2); }
  if(shrine.code===13) { p.mana=1; engine.step(); assert.equal(p.mana,1+manaRegeneration(stats.maxMana,400)); }
  if(shrine.code===14) { p.stamina=1; p.running=true; engine.setControl({move:{x:1,y:0}}); engine.step(); assert.equal(p.stamina,1); engine.setControl({move:{x:0,y:0}}); }
  assert.deepEqual(p.equipment,original.equipment); assert.deepEqual(p.skills,original.skills); assert.equal(p.strength,original.strength);
  const frames=engine.state.shrineBuff!.frames; engine.state.paused=true; for(let i=0;i<25;i++) engine.step(); assert.equal(engine.state.shrineBuff!.frames,frames);
  engine.state.paused=false; for(let i=1;i<frames;i++) engine.step(); assert.equal(engine.state.shrineBuff!.frames,1);
  engine.step(); assert.equal(engine.state.shrineBuff,undefined); assert.deepEqual(engine.state.stats,deriveStats(structuredClone(p))); assert.equal(object.used,true);
  if(shrine.resetFrames) { engine.state.tick=object.shrineReadyTick!-1; engine.step(); assert.equal(object.used,false); }
  else { engine.state.tick+=100000; engine.step(); assert.equal(object.used,true); }
});
test('legacy code-less shrine restores life/mana, has a two-minute recharge and cannot be spammed', () => {
  const {engine,p,activate}=shrineFixture(); p.life=p.mana=1; const shrine=activate();
  assert.equal(p.life,engine.state.stats!.maxLife); assert.equal(p.mana,engine.state.stats!.maxMana); assert.equal(shrine.shrineReadyTick,3000);
  p.life=p.mana=1; engine.dispatch({type:'interact',uid:shrine.uid}); assert.equal(p.life,1); assert.equal(p.mana,1);
  engine.state.tick=2999; engine.step(); engine.dispatch({type:'interact',uid:shrine.uid}); assert.equal(p.life,engine.state.stats!.maxLife);
  assert.equal(engine.state.shrineBuff,undefined);
});
test('skill shrine changes actual Fire Bolt casting and impact damage, then replacement restores its prior level', () => {
  const {engine,p,area,activate}=shrineFixture(), ordinary=skillEffect(p,36); activate(12); const boosted=skillEffect(p,36);
  assert.ok(boosted.min>ordinary.min); assert.equal(boosted.min,6); assert.equal(boosted.max,9);
  const monster=createArea(2,'normal',1,p).monsters[0]; Object.assign(monster,{x:p.x+.7,y:p.y,life:100,maxLife:100,cooldown:1000,resists:{physical:0,fire:0,cold:0,lightning:0,poison:0,magic:0}}); area.monsters.push(monster);
  (engine as unknown as {rng:Rng}).rng=()=>0;
  engine.dispatch({type:'attack',point:monster,right:true}); assert.equal(engine.state.projectiles[0].min,boosted.min); assert.equal(p.mana,35-boosted.mana);
  engine.step(); assert.equal(monster.life,94); activate(6);
  assert.equal(engine.state.shrineBuff!.code,6); assert.equal(skillLevel(p,36),1); assert.equal(engine.state.stats!.allSkills,0); assert.equal(skillEffect(p,36).min,ordinary.min);
});
test('experience shrine increases actual kill reward exactly once and replacing it removes the bonus', () => {
  const {engine,p,area,activate}=shrineFixture(); activate(15);
  const m=createArea(2,'normal',1,p).monsters[0]; Object.assign(m,{x:15,y:15,experience:100,level:1}); area.monsters.push(m);
  const access=engine as unknown as {kill(monster:typeof m):void}; access.kill(m); assert.equal(p.experience,150); access.kill(m); assert.equal(p.experience,150);
  activate(13); const next=structuredClone(m); next.uid='next-xp'; next.dead=false; area.monsters.push(next); access.kill(next); assert.equal(p.experience,250);
});
for(const gate of ['paused','dead','title','wall'] as const) test(`shrine interaction respects ${gate}`,()=>{
  const {engine,p,area}=shrineFixture(); const shrine={uid:'blocked-shrine',kind:'shrine' as const,name:'技能神龛',shrineCode:12,x:7,y:p.y,used:false}; area.objects.push(shrine);
  if(gate==='paused') engine.state.paused=true; if(gate==='dead') p.dead=true; if(gate==='title') engine.state.screen='title'; if(gate==='wall') area.tiles[5][6]=1;
  engine.dispatch({type:'interact',uid:shrine.uid}); assert.equal(shrine.used,false); assert.equal(engine.state.shrineBuff,undefined); assert.equal(skillLevel(p,36),1);
});
test('death and new character clear the blessing without collecting death gold; save/load never serializes buffs',async()=>{
  const {engine,p,area,activate}=shrineFixture(); activate(12); p.gold=100;
  (engine as unknown as {die():void}).die(); assert.equal(engine.state.shrineBuff,undefined); assert.equal(skillLevel(p,36),1);
  const drops=structuredClone(area.drops); engine.step(); assert.equal(p.gold,0); assert.deepEqual(area.drops,drops);
  p.dead=false; activate(13); engine.dispatch({type:'new',classId:'sor',name:'新角色'}); assert.equal(engine.state.shrineBuff,undefined); assert.equal(engine.state.stats!.manaRegenPercent,0);
  const store=memoryStore(), saved=new Engine(store); await saved.initialize(); saved.dispatch({type:'new',classId:'sor',name:'神龛存档'});
  const player=saved.state.player!, field=createArea(2,'normal',3,player); field.monsters=[]; Object.assign(player,field.spawn); saved.state.area=field;
  const shrine={uid:'save-shrine',kind:'shrine' as const,name:'技能神龛',shrineCode:12,x:player.x,y:player.y}; field.objects.push(shrine);
  saved.dispatch({type:'interact',uid:shrine.uid}); assert.equal(saved.state.stats!.allSkills,2); await saved.save(false);
  const id=saved.state.activeSaveId!, record=await store.get(id); assert.ok(validSave(record)); assert.ok(!JSON.stringify(record).includes('shrineBuff'));
  await saved.load(id); assert.equal(saved.state.shrineBuff,undefined); assert.equal(saved.state.stats!.allSkills,0); assert.deepEqual(saved.state.player!.equipment,record!.player.equipment);
});
test('portal shrine consumes neither books nor scrolls, uses the shared return lifecycle and cannot reopen when used',()=>{
  const {engine,p,area,activate}=shrineFixture(); p.inventory=[createItem('tbk',1,()=>.5),createItem('tsc',1,()=>.5)]; const inventory=structuredClone(p.inventory), shrine=activate(17);
  assert.deepEqual(p.inventory,inventory); const portal=area.objects.find(o=>o.kind==='portal')!; assert.ok(portal);
  engine.dispatch({type:'interact',uid:shrine.uid}); assert.equal(area.objects.filter(o=>o.kind==='portal').length,1);
  engine.dispatch({type:'interact',uid:portal.uid}); assert.equal(engine.state.area!.def.town,true);
  const back=engine.state.area!.objects.find(o=>o.kind==='portal'&&o.targetArea===2)!; Object.assign(p,{x:back.x,y:back.y}); engine.dispatch({type:'interact',uid:back.uid});
  assert.equal(engine.state.area!.def.id,2); assert.deepEqual(p.inventory,inventory); assert.equal((engine as unknown as {portal:unknown}).portal,null);
});
test('gem shrine upgrades the highest non-perfect inventory gem canonically and is single-use',()=>{
  const {engine,p,activate}=shrineFixture(), lower=GEMS.find(g=>g.grade===1)!, higher=GEMS.find(g=>g.grade===3)!, perfect=GEMS.find(g=>g.type===higher.type&&g.grade===4)!;
  const a=createItem(lower.code,1,()=>.5), b=createItem(higher.code,1,()=>.5), c=createItem(perfect.code,1,()=>.5); Object.assign(b,{x:3,y:2}); p.inventory=[a,b,c];
  const shrine=activate(18), upgraded=p.inventory.find(i=>i.uid===b.uid)!;
  assert.equal(upgraded.code,perfect.code); assert.equal(upgraded.name,createItem(perfect.code,1,()=>.5).name); assert.deepEqual(upgraded.mods,createItem(perfect.code,1,()=>.5).mods); assert.equal(upgraded.x,3); assert.equal(upgraded.y,2);
  assert.equal(p.inventory[0],a); assert.equal(p.inventory[2],c); const after=structuredClone(p.inventory); engine.dispatch({type:'interact',uid:shrine.uid}); assert.deepEqual(p.inventory,after);
});
for(const packed of [false,true]) test(`gem shrine with no upgrade candidate produces a chipped gem without loss (packed=${packed})`,()=>{
  const {engine,p,area,activate}=shrineFixture();
  if(packed) p.inventory=Array.from({length:80},(_,i)=>{const item=createItem('cm1',1,()=>.5); Object.assign(item,{x:i%10,y:Math.floor(i/10)}); return item;});
  else p.inventory=[createItem(GEMS.find(g=>g.grade===4)!.code,1,()=>.5)];
  activate(18); const item=packed?area.drops[0].item:p.inventory.at(-1)!; assert.equal(GEMS.find(g=>g.code===item.code)!.grade,0); assert.equal(area.drops.length,packed?1:0);
});

for (const code of ['hp1', 'hp2', 'hp3', 'hp4', 'hp5', 'mp1', 'mp2', 'mp3', 'mp4', 'mp5', 'rvs', 'rvl']) test(`inventory use ${code} applies real potion results and never shifts the belt`, () => {
  const { engine, p, add } = inventoryUseFixture(), item = add(code), belt = structuredClone(p.belt);
  const charm = add('cm1'); charm.identified = true; charm.mods = { life: 1000, mana: 1000 }; engine.state.stats = deriveStats(p);
  p.life = p.mana = 1;
  const reference = structuredClone(p); reference.belt[0] = structuredClone(item);
  const result = consumePotion(reference, 0); assert.equal(result.ok, true);
  const frames = Math.round(result.duration * 25), stats = engine.state.stats!;
  engine.dispatch({ type: 'use-item', uid: item.uid });
  assert.ok(!p.inventory.some(i => i.uid === item.uid)); assert.deepEqual(p.belt, belt);
  assert.equal(p.life, frames ? 1 : Math.min(stats.maxLife, 1 + result.life));
  assert.equal(p.mana, frames ? 1 : Math.min(stats.maxMana, 1 + result.mana));
  assert.equal(engine.state.effects.at(-1)!.kind, 'heal');
  const effects = engine.state.effects.length, snapshot = structuredClone(p);
  engine.dispatch({ type: 'use-item', uid: item.uid }); assert.deepEqual(p, snapshot); assert.equal(engine.state.effects.length, effects);
  if (frames) {
    engine.dispatch({ type: 'pause' }); engine.step(); assert.equal(p.life, 1); assert.equal(p.mana, 1); engine.dispatch({ type: 'pause' });
    engine.step(); assertClose(p.life, 1 + result.life / frames, 'inventory life regeneration');
    assertClose(p.mana, 1 + result.mana / frames + manaRegeneration(stats.maxMana, stats.manaRegenPercent), 'inventory mana regeneration');
    for (let frame = 1; frame < frames; frame++) engine.step();
    assertClose(p.life, Math.min(stats.maxLife, 1 + result.life), 'complete inventory life regeneration');
    assertClose(p.mana, Math.min(stats.maxMana, 1 + result.mana + frames * manaRegeneration(stats.maxMana, stats.manaRegenPercent)), 'complete inventory mana regeneration');
  }
  assert.deepEqual(p.belt, belt);
});

test('private stash accepts a 10 by 10 grid while preserving existing item coordinates', () => {
  const { engine, p } = inventoryUseFixture(), existing = createItem('cm1', 1, () => .5);
  Object.assign(existing, { uid: 'existing-stash-item', x: 5, y: 7 }); p.inventory = []; p.stash = [existing];
  engine.dispatch({ type: 'panel', panel: 'stash' });
  for (let index = 0; index < STASH_WIDTH * STASH_HEIGHT - 1; index++) {
    const item = createItem('cm1', 1, () => .5); item.uid = `expanded-stash-${index}`; p.inventory = [item];
    engine.dispatch({ type: 'storage', uid: item.uid, destination: 'stash' }); assert.equal(p.inventory.length, 0);
  }
  assert.equal(p.stash.length, 100); assert.deepEqual({ x: existing.x, y: existing.y }, { x: 5, y: 7 });
  assert.equal(new Set(p.stash.map(item => `${item.x}:${item.y}`)).size, 100);
  assert.ok(p.stash.every(item => item.x >= 0 && item.x < STASH_WIDTH && item.y >= 0 && item.y < STASH_HEIGHT));
  const overflow = createItem('cm1', 1, () => .5); overflow.uid = 'expanded-stash-overflow'; p.inventory = [overflow];
  engine.dispatch({ type: 'storage', uid: overflow.uid, destination: 'stash' });
  assert.deepEqual(p.inventory, [overflow]); assert.equal(p.stash.length, 100); assert.match(engine.state.messages.at(-1)!.text, /空间不足/);
});

test('talking to Akara automatically heals to current equipment caps without consuming gold or owned items', () => {
  const { engine, p, add } = inventoryUseFixture();
  const charm = add('cm1'); charm.identified = true; charm.mods = { life: 20, mana: 25 }; engine.state.stats = deriveStats(p);
  p.life = 1; engine.dispatch({ type: 'use-item', uid: add('hp1').uid });
  p.life = p.mana = p.stamina = 1;
  const owned = structuredClone({ inventory: p.inventory, equipment: p.equipment, belt: p.belt, gold: p.gold });
  const akara = engine.state.area!.objects.find(o => o.npcId === 'akara')!; Object.assign(p, { x: akara.x, y: akara.y });
  engine.dispatch({ type: 'interact', uid: akara.uid });
  assert.equal(p.life, engine.state.stats!.maxLife); assert.equal(p.mana, engine.state.stats!.maxMana); assert.equal(p.stamina, engine.state.stats!.maxStamina);
  assert.equal(engine.state.npc, 'akara'); assert.equal(engine.state.panel, 'vendor'); assert.ok(engine.state.vendorItems.length > 0);
  assert.match(engine.state.messages.at(-1)!.text, /生命和法力已恢复/);
  assert.equal((engine as unknown as { regeneration: unknown[] }).regeneration.length, 0);
  assert.deepEqual({ inventory: p.inventory, equipment: p.equipment, belt: p.belt, gold: p.gold }, owned);
  const skillPoints = p.skillPoints; engine.dispatch({ type: 'panel', panel: 'none' }); engine.dispatch({ type: 'interact', uid: akara.uid });
  assert.equal(p.skillPoints, skillPoints); assert.deepEqual({ inventory: p.inventory, equipment: p.equipment, belt: p.belt, gold: p.gold }, owned);
});
test('a distant click heals only after the player approaches and talks to Akara', () => {
  const { engine, p } = inventoryUseFixture(), area = engine.state.area!, akara = area.objects.find(o => o.npcId === 'akara')!;
  Object.assign(p, area.spawn); p.life = p.mana = 1;
  assert.ok(Math.hypot(p.x - akara.x, p.y - akara.y) > 2);
  engine.dispatch({ type: 'interact', uid: akara.uid }); assert.equal(p.life, 1); assert.equal(p.mana, 1); assert.equal(engine.state.npc, null);
  for (let frame = 0; frame < 500 && engine.state.panel !== 'vendor'; frame++) engine.step();
  assert.equal(engine.state.npc, 'akara'); assert.ok(Math.hypot(p.x - akara.x, p.y - akara.y) <= 2);
  assert.equal(p.life, engine.state.stats!.maxLife); assert.equal(p.mana, engine.state.stats!.maxMana);
});
for (const gate of ['paused', 'dead', 'missing', 'non-healer', 'outside-town'] as const) test(`Akara automatic healing respects the ${gate} interaction gate`, () => {
  const { engine, p } = inventoryUseFixture(), area = engine.state.area!;
  const npc = area.objects.find(o => o.npcId === (gate === 'non-healer' ? 'charsi' : 'akara'))!;
  Object.assign(p, { x: npc.x, y: npc.y });
  if (gate === 'paused') engine.state.paused = true;
  if (gate === 'dead') p.dead = true;
  if (gate === 'outside-town') {
    const field = createArea(2, 'normal', 123, p); field.monsters = []; Object.assign(p, field.spawn);
    field.objects.push({ ...npc, x: p.x, y: p.y, regionId: 2 }); engine.state.area = field;
  }
  p.life = p.mana = 1; const gold = p.gold;
  engine.dispatch({ type: 'interact', uid: gate === 'missing' ? 'missing-npc' : npc.uid });
  assert.equal(p.life, 1); assert.equal(p.mana, 1); assert.equal(p.gold, gold);
});
for (const code of ['tsc', 'tbk']) test(`inventory portal uses exact ${code} UID instead of another scroll or book`, () => {
  const { engine, p, add } = inventoryUseFixture(false), otherBook = add('tbk', 9), otherScroll = add('tsc'), source = add(code, 3);
  const before = structuredClone([otherBook, otherScroll]);
  engine.dispatch({ type: 'use-item', uid: source.uid });
  assert.deepEqual([otherBook, otherScroll], before);
  assert.equal(engine.state.area!.objects.filter(o => o.kind === 'portal').length, 1);
  if (code === 'tbk') { assert.equal(source.quantity, 2); assert.ok(p.inventory.includes(source)); }
  else { assert.ok(!p.inventory.includes(source)); assert.equal(source.quantity, 3); }
});

for (const gate of ['town', 'empty', 'dead', 'paused'] as const) test(`inventory portal rejects ${gate} without consumption or automatic fallback`, () => {
  const { engine, p, add } = inventoryUseFixture(gate === 'town'), source = add('tbk', gate === 'empty' ? 0 : 2);
  add('tbk', 8); add('tsc');
  if (gate === 'dead') p.dead = true;
  if (gate === 'paused') engine.state.paused = true;
  const before = structuredClone(p), portals = engine.state.area!.objects.filter(o => o.kind === 'portal').length;
  engine.dispatch({ type: 'use-item', uid: source.uid });
  assert.deepEqual(p, before); assert.equal(engine.state.area!.objects.filter(o => o.kind === 'portal').length, portals);
  assert.equal(engine.state.identifySource, null);
});

test('inventory scroll in town rejects before removing that exact scroll', () => {
  const { engine, p, add } = inventoryUseFixture(), scroll = add('tsc'); add('tbk', 10);
  const before = structuredClone(p); engine.dispatch({ type: 'use-item', uid: scroll.uid }); assert.deepEqual(p, before);
});

for (const code of ['isc', 'ibk']) test(`exact ${code} arms without cost and identifies one inventory target even beside Cain`, () => {
  const { engine, p, add, target } = inventoryUseFixture(), otherBook = add('ibk', 10), otherScroll = add('isc'), source = add(code, 3), first = target(), second = target();
  engine.state.npc = 'cain'; (engine as unknown as { npcServices: string[] }).npcServices = ['identify'];
  const before = structuredClone(p), messages = structuredClone(engine.state.messages); engine.dispatch({ type: 'use-item', uid: source.uid });
  assert.deepEqual(p, before); assert.equal(engine.state.identifySource, source.uid); assert.deepEqual(engine.state.messages, messages);
  engine.dispatch({ type: 'use-item', uid: source.uid, targetUid: first.uid });
  assert.equal(first.identified, true); assert.equal(second.identified, false); assert.equal(engine.state.identifySource, null);
  assert.match(engine.state.messages.at(-1)!.text, /^鉴定成功：/);
  assert.equal(engine.state.stats!.maxLife, 60); assert.equal(engine.state.stats!.maxMana, 60);
  assert.equal(otherBook.quantity, 10); assert.ok(p.inventory.includes(otherScroll));
  if (code === 'ibk') assert.equal(source.quantity, 2); else assert.ok(!p.inventory.includes(source));
  const after = structuredClone(p); engine.dispatch({ type: 'use-item', uid: source.uid, targetUid: first.uid }); assert.deepEqual(p, after);
});

for (const location of ['stash', 'cube', 'belt', 'equipment', 'vendor', 'missing'] as const) test(`use-item rejects ${location} source UIDs without spending owned books or potions`, () => {
  const { engine, p, add, target } = inventoryUseFixture(false), owned = add('ibk', 10), unidentified = target();
  for (const code of ['hp1', 'rvl', 'tsc', 'tbk', 'isc', 'ibk']) {
    const foreign = createItem(code, 1, () => .5); foreign.quantity = 5;
    if (location === 'equipment') p.equipment.head = foreign;
    else if (location === 'vendor') engine.state.vendorItems = [foreign];
    else if (location !== 'missing') p[location].push(foreign);
    const before = structuredClone(p), stock = structuredClone(engine.state.vendorItems);
    engine.dispatch({ type: 'use-item', uid: foreign.uid });
    engine.dispatch({ type: 'use-item', uid: foreign.uid, targetUid: unidentified.uid });
    assert.deepEqual(p, before); assert.deepEqual(engine.state.vendorItems, stock); assert.equal(engine.state.identifySource, null);
  }
  assert.equal(owned.quantity, 10);
});

for (const scenario of ['identified', 'stash', 'cube', 'equipment', 'vendor', 'missing'] as const) test(`armed identification rejects ${scenario} target without consuming exact source`, () => {
  const { engine, p, add, target } = inventoryUseFixture(), source = add('ibk', 2), item = target(); add('ibk', 9);
  if (scenario === 'identified') item.identified = true;
  else { p.inventory.splice(p.inventory.indexOf(item), 1); if (scenario === 'equipment') p.equipment.head = item; else if (scenario === 'vendor') engine.state.vendorItems = [item]; else if (scenario !== 'missing') p[scenario].push(item); }
  engine.dispatch({ type: 'use-item', uid: source.uid }); const before = structuredClone(p), stock = structuredClone(engine.state.vendorItems);
  engine.dispatch({ type: 'use-item', uid: source.uid, targetUid: item.uid });
  assert.deepEqual(p, before); assert.deepEqual(engine.state.vendorItems, stock); assert.equal(engine.state.identifySource, source.uid);
});

for (const scenario of ['removed', 'moved', 'empty', 'changed-code'] as const) test(`stale armed ${scenario} identification source cannot fall back to another book or Cain`, () => {
  const { engine, p, add, target } = inventoryUseFixture(), source = add('ibk', 2), fallback = add('ibk', 9), item = target();
  engine.state.npc = 'cain'; (engine as unknown as { npcServices: string[] }).npcServices = ['identify'];
  engine.dispatch({ type: 'use-item', uid: source.uid });
  if (scenario === 'empty') source.quantity = 0;
  else if (scenario === 'changed-code') source.code = 'hp1';
  else { p.inventory.splice(p.inventory.indexOf(source), 1); if (scenario === 'moved') p.stash.push(source); }
  const before = structuredClone(p); engine.dispatch({ type: 'use-item', uid: source.uid, targetUid: item.uid });
  assert.deepEqual(p, before); assert.equal(item.identified, false); assert.equal(fallback.quantity, 9);
});

test('empty identification book cannot arm or consume another source', () => {
  const { engine, p, add, target } = inventoryUseFixture(), empty = add('ibk', 0), item = target(); add('ibk', 8); add('isc');
  const before = structuredClone(p); engine.dispatch({ type: 'use-item', uid: empty.uid }); engine.dispatch({ type: 'use-item', uid: empty.uid, targetUid: item.uid });
  assert.deepEqual(p, before); assert.equal(engine.state.identifySource, null);
});

for (const gate of ['dead', 'paused'] as const) test(`${gate} blocks inventory potions and identify but allows cancelling identification`, () => {
  const { engine, p, add, target } = inventoryUseFixture(), source = add('ibk', 2), potion = add('rvl'), item = target();
  engine.dispatch({ type: 'use-item', uid: source.uid }); p.life = p.mana = 1;
  if (gate === 'dead') p.dead = true; else engine.state.paused = true;
  const before = structuredClone(p);
  engine.dispatch({ type: 'use-item', uid: potion.uid }); engine.dispatch({ type: 'use-item', uid: source.uid, targetUid: item.uid });
  assert.deepEqual(p, before); assert.equal(engine.state.identifySource, source.uid);
  engine.dispatch({ type: 'cancel-identify' }); assert.equal(engine.state.identifySource, null); assert.deepEqual(p, before);
});

test('unsupported inventory items cannot fake a potion effect or identify', () => {
  const { engine, p, add, target } = inventoryUseFixture(), item = target();
  for (const code of ['hp6', 'mp6', 'vps', 'yps', 'wms', 'r01', 'cm1']) {
    const source = add('hp1'); source.code = code; p.life = p.mana = 1;
    const before = structuredClone(p), effects = structuredClone(engine.state.effects);
    engine.dispatch({ type: 'use-item', uid: source.uid }); engine.dispatch({ type: 'use-item', uid: source.uid, targetUid: item.uid });
    assert.deepEqual(p, before); assert.deepEqual(engine.state.effects, effects); assert.equal(engine.state.identifySource, null);
  }
});

test('automatic portal and identification still consume available sources and Cain still identifies freely', () => {
  const { engine, p, add, target } = inventoryUseFixture(false), portal = add('tbk', 2), book = add('ibk', 2), first = target();
  engine.dispatch({ type: 'portal' }); assert.equal(portal.quantity, 1);
  engine.dispatch({ type: 'identify', uid: first.uid }); assert.equal(first.identified, true); assert.equal(book.quantity, 1);
  p.quests[questKey(p, 'a1q3')] = 3; engine.state.area = createArea(1, 'normal', 123, p);
  const cain = engine.state.area.objects.find(o => o.npcId === 'cain')!; Object.assign(p, { x: cain.x, y: cain.y }); engine.dispatch({ type: 'interact', uid: cain.uid });
  const second = target(), third = target(); engine.dispatch({ type: 'identify' });
  assert.equal(second.identified, true); assert.equal(third.identified, true); assert.equal(book.quantity, 1);
});

test('merchant conversations cannot identify all or silently spend player scrolls', () => {
  const { engine, p, add, target } = inventoryUseFixture(); add('ibk', 5); add('isc'); target(); target();
  for (const npcId of ['akara', 'charsi', 'gheed', 'warriv']) {
    const npc = engine.state.area!.objects.find(o => o.npcId === npcId)!; Object.assign(p, { x: npc.x, y: npc.y }); engine.dispatch({ type: 'interact', uid: npc.uid });
    const owned = structuredClone({ inventory: p.inventory, equipment: p.equipment, belt: p.belt, gold: p.gold });
    engine.dispatch({ type: 'identify' });
    assert.deepEqual({ inventory: p.inventory, equipment: p.equipment, belt: p.belt, gold: p.gold }, owned);
    assert.match(engine.state.messages.at(-1)!.text, /已获救的凯恩/);
  }
});
for (const gate of ['unrescued', 'other-difficulty', 'closed', 'far', 'missing', 'field', 'paused', 'dead', 'no-service'] as const) test(`Cain identify-all respects the ${gate} gate without falling back to scrolls`, () => {
  const { engine, p, add, target } = inventoryUseFixture(); add('ibk', 5); add('isc'); target(); target();
  p.quests[questKey(p, 'a1q3')] = 3; engine.state.area = createArea(1, p.difficulty, 123, p);
  const cain = engine.state.area.objects.find(o => o.npcId === 'cain')!; Object.assign(p, { x: cain.x, y: cain.y }); engine.dispatch({ type: 'interact', uid: cain.uid });
  if (gate === 'unrescued') p.quests[questKey(p, 'a1q3')] = 1;
  if (gate === 'other-difficulty') p.difficulty = 'nightmare';
  if (gate === 'closed') engine.dispatch({ type: 'panel', panel: 'none' });
  if (gate === 'far') p.x -= 8;
  if (gate === 'missing') engine.state.area.objects = engine.state.area.objects.filter(o => o.uid !== cain.uid);
  if (gate === 'field') {
    const field = createArea(2, p.difficulty, 123, p); field.monsters = []; Object.assign(p, field.spawn);
    field.objects.push({ ...cain, x: p.x, y: p.y, regionId: 2 }); engine.state.area = field;
  }
  if (gate === 'paused') engine.state.paused = true;
  if (gate === 'dead') p.dead = true;
  if (gate === 'no-service') (engine as unknown as { npcServices: string[] }).npcServices = [];
  const before = structuredClone(p); engine.dispatch({ type: 'identify' }); assert.deepEqual(p, before);
});
test('rescued Cain identifies every inventory item for free without rerolling or changing other owned items', () => {
  const { engine, p, target } = inventoryUseFixture(), first = target(), second = target(), stored = target();
  p.inventory.splice(p.inventory.indexOf(stored), 1); p.stash.push(stored);
  p.quests[questKey(p, 'a1q3')] = 3; engine.state.area = createArea(1, p.difficulty, 123, p);
  const cain = engine.state.area.objects.find(o => o.npcId === 'cain')!; Object.assign(p, { x: cain.x, y: cain.y }); engine.dispatch({ type: 'interact', uid: cain.uid });
  const expected = structuredClone(p); expected.inventory.forEach(item => item.identified = true);
  engine.dispatch({ type: 'identify' }); assert.deepEqual(p, expected);
  assert.equal(first.identified, true); assert.equal(second.identified, true); assert.equal(stored.identified, false);
  assert.equal(engine.state.stats!.maxLife, 80); assert.equal(engine.state.stats!.maxMana, 85);
  const before = structuredClone(p); engine.dispatch({ type: 'identify' }); assert.deepEqual(p, before); assert.match(engine.state.messages.at(-1)!.text, /没有需要鉴定/);
});

for (const action of ['cancel-identify', 'panel', 'title', 'new', 'area'] as const) test(`${action} clears runtime identification without spending its source`, () => {
  const { engine, p, add } = inventoryUseFixture(), source = add('ibk', 2); engine.dispatch({ type: 'panel', panel: 'inventory' }); engine.dispatch({ type: 'use-item', uid: source.uid });
  const inventory = structuredClone(p.inventory);
  if (action === 'panel') engine.dispatch({ type: 'panel', panel: 'none' });
  else if (action === 'new') engine.dispatch({ type: 'new', classId: 'bar', name: '新旅人' });
  else if (action === 'area') (engine as unknown as { enterArea: (id: number) => void }).enterArea(2);
  else engine.dispatch({ type: action });
  assert.equal(engine.state.identifySource, null); assert.deepEqual(p.inventory, inventory); assert.equal(source.quantity, 2);
});

test('crossing a surface region clears armed identification without consuming it', () => {
  const { engine, p, add } = inventoryUseFixture(), source = add('ibk', 2), region = getSurfaceRegion(engine.state.area!, 2)!;
  engine.dispatch({ type: 'panel', panel: 'inventory' }); engine.dispatch({ type: 'use-item', uid: source.uid });
  Object.assign(p, region.spawn); engine.state.area!.monsters = []; engine.step();
  assert.equal(engine.state.area!.def.id, 2); assert.equal(engine.state.identifySource, null); assert.equal(source.quantity, 2);
});

test('using owned inventory during trade leaves stock unchanged and selling stays restricted to trade', () => {
  const { engine, p, stock } = convenienceShop(), potion = createItem('rvl', 1, () => .5), book = createItem('ibk', 1, () => .5), target = createItem('cm1', 1, () => .5);
  book.quantity = 2; target.quality = 'magic'; target.identified = false; p.inventory.push(potion, book, target); p.life = p.mana = 1;
  const offers = structuredClone(stock), gold = p.gold, belt = structuredClone(p.belt);
  engine.dispatch({ type: 'use-item', uid: potion.uid }); engine.dispatch({ type: 'use-item', uid: book.uid, targetUid: target.uid });
  assert.equal(engine.state.panel, 'vendor'); assert.equal(engine.state.vendorItems, stock); assert.deepEqual(stock, offers); assert.equal(p.gold, gold); assert.deepEqual(p.belt, belt);
  assert.equal(p.life, engine.state.stats!.maxLife); assert.equal(target.identified, true); assert.equal(book.quantity, 1);
  engine.dispatch({ type: 'panel', panel: 'inventory' }); const before = structuredClone(p); engine.dispatch({ type: 'sell', uid: target.uid }); assert.deepEqual(p, before);
});

test('inventory potion use preserves version-1 save data and load never persists armed identification', async () => {
  const store = memoryStore(), engine = new Engine(store); await engine.initialize(); engine.dispatch({ type: 'new', classId: 'sor', name: '行囊存档' });
  const p = engine.state.player!, equipment = structuredClone(p.equipment), belt = structuredClone(p.belt), source = createItem('ibk', 1, () => .5), potion = createItem('rvl', 1, () => .5);
  Object.assign(source, { quantity: 5, x: 4, y: 0 }); Object.assign(potion, { x: 6, y: 0 }); p.inventory.push(source, potion);
  p.life = p.mana = 1; engine.dispatch({ type: 'use-item', uid: potion.uid }); engine.dispatch({ type: 'use-item', uid: source.uid });
  await engine.save(false); const id = engine.state.activeSaveId!, record = (await store.get(id))!;
  assert.equal(record.version, 1); assert.ok(validSave(record)); assert.ok(!('identifySource' in record)); assert.ok(!('identifySource' in record.player));
  assert.deepEqual(record.player.equipment, equipment); assert.deepEqual(record.player.belt, belt); assert.equal(record.player.inventory.find(i => i.uid === source.uid)!.quantity, 5);
  assert.ok(!record.player.inventory.some(i => i.uid === potion.uid));
  await engine.load(id); assert.equal(engine.state.identifySource, null); assert.deepEqual(engine.state.player!.inventory, record.player.inventory);
  assert.deepEqual(await store.get(id), record); assert.deepEqual(engine.state.player!.equipment, equipment); assert.deepEqual(engine.state.player!.belt, belt);
});

test('independent seeded RNG is reproducible and bounded', () => {
  const a = seededRandom(123), b = seededRandom(123);
  for (let i=0;i<100;i++) {const value=a(); assert.equal(value,b()); assert.ok(value >= 0 && value < 1);}
});
test('new character starts in town, saves and continues without granting extra points', async () => {
  const store = memoryStore(), engine = new Engine(store); await engine.initialize();
  assert.equal(engine.state.screen, 'intro');
  engine.dispatch({type:'new',classId:'sor',name:'法师测试'});
  assert.equal(engine.state.screen,'game'); assert.equal(engine.state.area!.def.id,1);
  assert.equal(engine.state.player!.statPoints,0); assert.equal(engine.state.player!.skillPoints,0);
  await engine.save(false);
  const id = engine.state.activeSaveId!;
  assert.ok(validSave(await store.get(id)));
  const next = new Engine(store); await next.initialize(); await next.load(id);
  assert.equal(next.state.player!.name,'法师测试'); assert.equal(next.state.player!.level,1);
  assert.equal(next.state.area!.def.town,true);
});
test('loading a character starts a fresh shop visit without changing its saved equipment or schema', async () => {
  const store = memoryStore(), engine = new Engine(store); await engine.initialize();
  engine.dispatch({ type: 'new', classId: 'sor', name: '商店读档' });
  await engine.save(false); const id = engine.state.activeSaveId!, record = await store.get(id);
  const shop = () => {
    const npc = engine.state.area!.objects.find(o => o.npcId === 'akara')!;
    Object.assign(engine.state.player!, { x: npc.x, y: npc.y });
    engine.dispatch({ type: 'interact', uid: npc.uid });
    return engine.state.vendorItems;
  };
  const before = shop(); assert.ok(before.length);
  await engine.load(id); const after = shop();
  assert.notEqual(after, before); assert.ok(after.length); assert.equal(shop(), after);
  assert.deepEqual(engine.state.player!.equipment, record!.player.equipment);
  assert.deepEqual(await store.get(id), record); assert.equal(record!.version, 1);
});
function convenienceShop() {
  const engine = new Engine(); engine.dispatch({ type: 'new', classId: 'sor', name: '便利商店测试' });
  const p = engine.state.player!, npc = engine.state.area!.objects.find(object => object.npcId === 'akara')!;
  Object.assign(p, { x: npc.x, y: npc.y, gold: 1_000_000 });
  engine.dispatch({ type: 'interact', uid: npc.uid });
  return { engine, p, stock: engine.state.vendorItems };
}

test('buying event keys and runes clones each offer without rerolling owned equipment or inventory', () => {
  const { engine, p, stock } = convenienceShop(), equipment = structuredClone(p.equipment);
  const owned = structuredClone(p.inventory); let spent = 0;
  for (const code of ['r01', 'r33', 'pk1', 'pk2', 'pk3', 'pk1']) {
    const offer = stock.find(item => item.code === code)!, before = structuredClone(offer);
    engine.dispatch({ type: 'buy', uid: offer.uid }); spent += offer.price;
    const bought = p.inventory.at(-1)!; assert.notEqual(bought.uid, offer.uid);
    assert.deepEqual({ ...bought, uid: offer.uid, x: offer.x, y: offer.y }, before);
    assert.deepEqual(offer, before);
  }
  assert.equal(p.gold, 1_000_000 - spent); assert.equal(engine.state.vendorItems, stock);
  assert.equal(new Set(p.inventory.map(item => item.uid)).size, p.inventory.length);
  assert.deepEqual(p.inventory.slice(0, owned.length), owned); assert.deepEqual(p.equipment, equipment);
});

test('Jordan and all gem offers are independent purchases and selling Jordan does not fake a world event', () => {
  const { engine, p, stock } = convenienceShop(), equipment = structuredClone(p.equipment), quests = structuredClone(p.quests);
  const offer = stock.find(item => item.name === 'The Stone of Jordan')!, original = structuredClone(offer);
  engine.dispatch({ type: 'buy', uid: offer.uid }); const jordan = p.inventory.at(-1)!;
  assert.notEqual(jordan.uid, offer.uid); assert.equal(jordan.price, 14000); assert.equal(jordan.mods.maxManaPercent, 25);
  assert.deepEqual({ ...jordan, uid: offer.uid, x: offer.x, y: offer.y }, original); assert.deepEqual(offer, original);
  const bought = structuredClone(jordan), beforeEquip = structuredClone(p); engine.dispatch({ type: 'equip', uid: jordan.uid }); assert.deepEqual(p, beforeEquip);
  let spent = 14000;
  for (const code of ['gcv', 'gpv', 'skc', 'skz']) {
    const gem = stock.find(item => item.code === code)!, before = structuredClone(gem); engine.dispatch({ type: 'buy', uid: gem.uid }); spent += gem.price;
    const purchased = p.inventory.at(-1)!; assert.notEqual(purchased.uid, gem.uid); assert.deepEqual({ ...purchased, uid: gem.uid, x: gem.x, y: gem.y }, before); assert.deepEqual(gem, before);
  }
  assert.equal(p.gold, 1_000_000 - spent); const monsters = structuredClone(engine.state.area!.monsters);
  engine.dispatch({ type: 'sell', uid: jordan.uid }); assert.ok(!p.inventory.some(item => item.uid === jordan.uid)); assert.ok(p.gold > 1_000_000 - spent);
  assert.deepEqual(jordan, bought); assert.deepEqual(p.equipment, equipment); assert.deepEqual(p.quests, quests); assert.deepEqual(engine.state.area!.monsters, monsters);
  assert.equal(p.difficulty, 'normal'); assert.equal(p.unlockedDifficulties, 1);
});

test('purchased full rejuvenation fills the belt and restores current caps immediately', () => {
  const { engine, p, stock } = convenienceShop(), offer = stock.find(item => item.code === 'rvl')!;
  p.belt[0] = null; const inventory = structuredClone(p.inventory);
  engine.dispatch({ type: 'buy', uid: offer.uid });
  assert.equal(p.belt[0]!.code, 'rvl'); assert.notEqual(p.belt[0]!.uid, offer.uid);
  assert.equal(p.gold, 1_000_000 - offer.price); assert.deepEqual(p.inventory, inventory);
  p.life = p.mana = 1; engine.dispatch({ type: 'potion', column: 0 });
  assert.equal(p.life, engine.state.stats!.maxLife); assert.equal(p.mana, engine.state.stats!.maxMana);
  assert.equal(p.belt[0], null);
});

test('a full belt sends a purchased full rejuvenation to inventory', () => {
  const { engine, p, stock } = convenienceShop(), offer = stock.find(item => item.code === 'rvl')!;
  const belt = structuredClone(p.belt); engine.dispatch({ type: 'buy', uid: offer.uid });
  assert.equal(p.inventory.at(-1)!.code, 'rvl'); assert.deepEqual(p.belt, belt);
  assert.equal(p.gold, 1_000_000 - offer.price);
});

test('insufficient gold and a packed belt and inventory reject purchases transactionally', () => {
  const { engine, p, stock } = convenienceShop(), rune = stock.find(item => item.code === 'r33')!;
  p.gold = rune.price - 1; const before = structuredClone(p);
  engine.dispatch({ type: 'buy', uid: rune.uid }); assert.deepEqual(p, before);
  p.inventory = []; p.gold = 1_000_000;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 10; x++) p.inventory.push({ ...createItem('r01', 1, () => .5), x, y });
  const packed = structuredClone(p);
  for (const code of ['rvl', 'pk1', 'r33', 'gcv', 'gpv', 'skc', 'skz', 'rin']) {
    engine.dispatch({ type: 'buy', uid: stock.find(item => item.code === code)!.uid });
    assert.deepEqual(p, packed); assert.equal(engine.state.vendorItems, stock);
  }
});

test('purchased runes and event keys survive a version-1 save without changing old equipment', async () => {
  const store = memoryStore(), engine = new Engine(store); await engine.initialize();
  engine.dispatch({ type: 'new', classId: 'sor', name: '补给存档' });
  const p = engine.state.player!, npc = engine.state.area!.objects.find(object => object.npcId === 'akara')!;
  Object.assign(p, { x: npc.x, y: npc.y, gold: 1_000_000 }); engine.dispatch({ type: 'interact', uid: npc.uid });
  const equipment = structuredClone(p.equipment);
  for (const code of ['r33', 'pk1', 'pk2', 'pk3', 'gcv', 'gpv', 'skc', 'skz', 'rin']) engine.dispatch({ type: 'buy', uid: engine.state.vendorItems.find(item => item.code === code)!.uid });
  await engine.save(false); const id = engine.state.activeSaveId!, record = await store.get(id);
  assert.equal(record!.version, 1); assert.ok(validSave(record));
  const next = new Engine(store); await next.initialize(); await next.load(id);
  assert.deepEqual(next.state.player!.inventory, p.inventory); assert.deepEqual(next.state.player!.equipment, equipment);
  assert.deepEqual(await store.get(id), record);
});

test('version-1 characters recalculate corrected block and charm caps without rewriting the stored record', async () => {
  const store = memoryStore(), p = createPlayer('ama', '旧规则存档'); createStartingItems(p);
  const charm = createItem('cm1', 1, seededRandom(42)); charm.identified = true; charm.mods = { life: 20, mana: 25 };
  p.inventory.push(charm); p.belt[0] = createItem('rvl', 1, seededRandom(42)); p.life = 1; p.mana = 1;
  const record: SaveRecord = { id: 'existing-v1', version: 1, player: p, seed: 123, timestamp: 1 };
  await store.put(record); const engine = new Engine(store); await engine.initialize(); await engine.load(record.id);
  assert.equal(engine.state.stats!.block, 75); assert.equal(engine.state.stats!.maxLife, 70); assert.equal(engine.state.stats!.maxMana, 40);
  engine.dispatch({ type: 'potion', column: 0 });
  assert.equal(engine.state.player!.life, 70); assert.equal(engine.state.player!.mana, 40);
  assert.deepEqual(await store.get(record.id), record);
  assert.equal(engine.state.activeSaveId, record.id);
});

test('version-1 equipment recalculates native ownership and charm requirements without rerolling saved mods', async () => {
  const store = memoryStore(), p = createPlayer('ass', '旧装备规则'); p.level = 41; p.skills[251] = 1;
  const staff = createItem('sst', 20, () => .5);
  staff.runeword = 'Leaf'; staff.sockets = 2; staff.socketed = ['r03', 'r08'];
  staff.mods = { 'skill:36': 3, 'skill:37': 3, 'unsupported:fireskill::3:3': 1 };
  p.equipment.weapon = staff;
  const charm = createItem('cm3', 99, () => .5); charm.identified = true;
  charm.mods = { 'skillTab:ass:0': 1 }; charm.requiredLevel = 42; p.inventory.push(charm);
  const record: SaveRecord = { id: 'existing-equipment-v1', version: 1, player: p, seed: 123, timestamp: 1 };
  await store.put(record); const engine = new Engine(store); await engine.initialize(); await engine.load(record.id);
  const loaded = engine.state.player!;
  assert.equal(skillLevel(loaded, 36), 0); assert.equal(skillLevel(loaded, 37), 0); assert.equal(skillLevel(loaded, 251), 1);
  assert.equal(engine.state.stats!.manaRegenPercent, 0);
  assert.deepEqual(loaded.equipment.weapon!.mods, staff.mods); assert.deepEqual(loaded.equipment.weapon!.socketed, ['r03', 'r08']);
  assert.equal(loaded.equipment.weapon!.uid, staff.uid); assert.equal(engine.state.activeSaveId, record.id);
  assert.deepEqual(await store.get(record.id), record);
});

test('corrupt legacy save is retained and not imported', async () => {
  const store = memoryStore(), legacy = '{bad-json';
  const engine = new Engine(store); await engine.initialize(legacy);
  assert.equal(engine.state.player,null); assert.equal(store.values.size,0);
  assert.equal(engine.state.storageStatus,'ready');
  assert.match(engine.state.storageError,/旧.*损坏/);
});
test('same-name characters have independent IDs, gold and equipment', async () => {
  const store = memoryStore(), engine = new Engine(store); await engine.initialize();
  engine.dispatch({type:'new',classId:'sor',name:'同名旅人'});
  const first = engine.state.activeSaveId!, firstWeapon = engine.state.player!.equipment.weapon!.uid;
  engine.state.player!.gold = 123; await engine.save(false);
  engine.dispatch({type:'title'}); engine.dispatch({type:'creation'});
  engine.dispatch({type:'new',classId:'pal',name:'同名旅人'});
  const second = engine.state.activeSaveId!; engine.state.player!.gold = 456; await engine.save(false);
  assert.notEqual(first,second); assert.equal(store.values.size,2);
  await engine.load(first);
  assert.equal(engine.state.player!.classId,'sor'); assert.equal(engine.state.player!.gold,123);
  assert.equal(engine.state.player!.equipment.weapon!.uid,firstWeapon);
  await engine.load(second);
  assert.equal(engine.state.player!.classId,'pal'); assert.equal(engine.state.player!.gold,456);
});
test('deleting one same-name character preserves the other record and active character', async () => {
  const store = memoryStore(), engine = new Engine(store); await engine.initialize();
  engine.dispatch({type:'new',classId:'sor',name:'同名旅人'}); await engine.save(false);
  const first = engine.state.activeSaveId!;
  engine.dispatch({type:'new',classId:'bar',name:'同名旅人'}); await engine.save(false);
  const second = engine.state.activeSaveId!;
  engine.dispatch({type:'title'}); await engine.save(false);
  const survivor = await store.get(second);
  await engine.deleteCharacter(first);
  assert.equal(await store.get(first),undefined); assert.deepEqual(await store.get(second),survivor);
  assert.equal(engine.state.activeSaveId,second); assert.equal(engine.state.player!.classId,'bar');
  assert.deepEqual(engine.state.characters.map(c=>c.id),[second]); assert.equal(engine.state.loadingSave,false);
});
test('deleting an active character waits for queued saves and cannot be resurrected by pagehide saves', async () => {
  const memory = memoryStore(); let blocked = false, release!: () => void;
  const gate = new Promise<void>(resolve=>{release=resolve;});
  const store = {...memory, put: async (record: SaveRecord)=>{if(blocked) await gate; await memory.put(record);}};
  const engine = new Engine(store); await engine.initialize();
  engine.dispatch({type:'new',classId:'sor',name:'待删除'}); await engine.save(false);
  const id = engine.state.activeSaveId!; blocked=true;
  engine.state.player!.gold=123; void engine.save(false); engine.dispatch({type:'title'});
  const deleted = engine.deleteCharacter(id);
  assert.equal(engine.state.loadingSave,true); assert.ok(await store.get(id));
  await engine.save(false); engine.dispatch({type:'new',classId:'bar',name:'不能插入'});
  assert.equal(engine.state.activeSaveId,id);
  release(); await deleted; await engine.save(false);
  assert.equal(await store.get(id),undefined); assert.equal(store.values.size,0);
  assert.equal(engine.state.activeSaveId,null); assert.equal(engine.state.player,null);
  assert.equal(engine.state.stats,null); assert.equal(engine.state.area,null); assert.equal(engine.state.screen,'title');
  const next = new Engine(store); await next.initialize(); assert.equal(next.state.characters.length,0);
});
test('failed deletion retains the character and can be retried', async () => {
  const memory = memoryStore(); let fail=true;
  const store = {...memory, delete: async (id: string)=>{if(fail) throw new Error('abort'); await memory.delete(id);}};
  const engine = new Engine(store); await engine.initialize();
  engine.dispatch({type:'new',classId:'pal',name:'删除失败'}); await engine.save(false);
  const id = engine.state.activeSaveId!; engine.dispatch({type:'title'}); await engine.save(false);
  const before = await store.get(id); await engine.deleteCharacter(id);
  assert.deepEqual(await store.get(id),before); assert.equal(engine.state.activeSaveId,id);
  assert.equal(engine.state.characters.length,1); assert.equal(engine.state.loadingSave,false); assert.match(engine.state.storageError,/删除角色失败/);
  fail=false; await engine.deleteCharacter(id); assert.equal(await store.get(id),undefined); assert.equal(engine.state.storageError,'');
});
test('deleted legacy characters are not recreated from the retained backup', async () => {
  const store = memoryStore(), p = createPlayer('bar','旧旅人'); createStartingItems(p);
  const legacy = JSON.stringify({version:1,player:p,seed:42});
  const engine = new Engine(store); await engine.initialize(legacy); engine.dispatch({type:'title'});
  const stale = new Engine(store); await stale.initialize(legacy); await stale.load(LEGACY_CHARACTER_ID);
  await engine.deleteCharacter(LEGACY_CHARACTER_ID); await stale.save(false);
  assert.equal(stale.state.saved,false);
  const next = new Engine(store); await next.initialize(legacy);
  assert.equal(next.state.characters.length,0); assert.equal(await store.get(LEGACY_CHARACTER_ID),undefined);
});
test('deletion is restricted to existing characters on the roster', async () => {
  const store = memoryStore(), engine = new Engine(store); await engine.initialize();
  engine.dispatch({type:'new',classId:'sor',name:'保护角色'}); await engine.save(false);
  const id = engine.state.activeSaveId!; await engine.deleteCharacter(id); assert.ok(await store.get(id));
  engine.dispatch({type:'title'}); await engine.deleteCharacter('missing'); assert.ok(await store.get(id));
  assert.equal(engine.state.characters.length,1); assert.equal(engine.state.loadingSave,false);
});
test('legacy migration is idempotent and never restores stale progress', async () => {
  const store = memoryStore(), p = createPlayer('bar','旧旅人'); createStartingItems(p);
  const legacy = JSON.stringify({version:1,player:p,seed:42});
  const first = new Engine(store); await first.initialize(legacy);
  assert.equal(first.state.characters.length,1); await first.load(LEGACY_CHARACTER_ID);
  first.state.player!.gold = 888; await first.save(false);
  const next = new Engine(store); await next.initialize(legacy); await next.load(LEGACY_CHARACTER_ID);
  assert.equal(store.values.size,1); assert.equal(next.state.player!.gold,888);
});
test('queued saves capture their original character before asynchronous writes', async () => {
  const memory = memoryStore(); let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const store = {...memory, put: async (record: SaveRecord) => { await gate; await memory.put(record); }};
  const engine = new Engine(store); await engine.initialize();
  engine.dispatch({type:'new',classId:'sor',name:'第一位'});
  const first = engine.state.activeSaveId!; engine.state.player!.gold = 321; void engine.save(false);
  engine.dispatch({type:'title'}); engine.dispatch({type:'creation'});
  engine.dispatch({type:'new',classId:'bar',name:'第二位'});
  const second = engine.state.activeSaveId!; engine.state.player!.gold = 654;
  const saved = engine.save(false); release(); await saved;
  assert.equal((await store.get(first))!.player.name,'第一位'); assert.equal((await store.get(first))!.player.gold,321);
  assert.equal((await store.get(second))!.player.name,'第二位'); assert.equal((await store.get(second))!.player.gold,654);
  assert.equal(engine.state.characters.length,2);
});
test('failed writes do not report saved and later writes can recover', async () => {
  const memory = memoryStore(); let fail = true;
  const store = {...memory, put: async (record: SaveRecord) => { if (fail) throw new Error('quota'); await memory.put(record); }};
  const engine = new Engine(store); await engine.initialize();
  engine.dispatch({type:'new',classId:'pal',name:'写入测试'}); await engine.save();
  assert.equal(engine.state.saved,false); assert.match(engine.state.storageError,/写入失败/);
  fail = false; await engine.save(); assert.equal(engine.state.saved,true); assert.equal(engine.state.storageError,'');
});
test('save-and-title waits for queued writes, blocks duplicate exits and refreshes the roster before returning', async () => {
  const memory = memoryStore(); let blocked = false, writes = 0, release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const store = { ...memory, put: async (record: SaveRecord) => { if (blocked) { writes++; await gate; } await memory.put(record); } };
  const engine = new Engine(store); await engine.initialize();
  engine.dispatch({ type: 'new', classId: 'pal', name: '保留旅人' }); await engine.save(false);
  const otherId = engine.state.activeSaveId!, other = await store.get(otherId);
  engine.dispatch({ type: 'new', classId: 'sor', name: '保存返回' }); await engine.save(false);
  const id = engine.state.activeSaveId!, p = engine.state.player!, owned = structuredClone({ inventory: p.inventory, equipment: p.equipment });
  const before = await store.get(id); blocked = true;
  p.gold = 321; void engine.save(false); p.gold = 789;
  const exiting = engine.saveAndReturnToTitle();
  assert.equal(engine.state.savingAndExiting, true); assert.equal(engine.state.paused, true); assert.equal(engine.state.screen, 'game');
  for (const action of [{ type: 'save-and-title' }, { type: 'save' }, { type: 'title' }, { type: 'creation' }, { type: 'pause' }, { type: 'new', classId: 'bar', name: '不能创建' }] as const) engine.dispatch(action);
  await Promise.resolve(); assert.deepEqual(await store.get(id), before); assert.equal(engine.state.activeSaveId, id); assert.equal(engine.state.paused, true);
  release(); await exiting;
  assert.equal(writes, 2); assert.equal(engine.state.screen, 'title'); assert.equal(engine.state.savingAndExiting, false); assert.equal(engine.state.saved, true);
  assert.equal((await store.get(id))!.player.gold, 789); assert.equal(engine.state.characters.find(c => c.id === id)!.name, p.name);
  assert.deepEqual({ inventory: p.inventory, equipment: p.equipment }, owned); assert.deepEqual(await store.get(otherId), other);
  await engine.load(id); assert.equal(engine.state.player!.gold, 789); assert.equal(engine.state.area!.def.town, true);
});
test('failed save-and-title stays paused, preserves the prior record and allows a successful retry', async () => {
  const memory = memoryStore(); let fail = false;
  const store = { ...memory, put: async (record: SaveRecord) => { if (fail) throw new Error('quota'); await memory.put(record); } };
  const engine = new Engine(store); await engine.initialize(); engine.dispatch({ type: 'new', classId: 'sor', name: '保存重试' }); await engine.save(false);
  const id = engine.state.activeSaveId!, p = engine.state.player!, before = await store.get(id);
  p.gold = 456; fail = true; await engine.saveAndReturnToTitle();
  assert.equal(engine.state.screen, 'game'); assert.equal(engine.state.paused, true); assert.equal(engine.state.saved, false);
  assert.equal(engine.state.savingAndExiting, false); assert.match(engine.state.storageError, /写入失败/); assert.deepEqual(await store.get(id), before);
  assert.equal(engine.state.player, p); assert.equal(p.gold, 456);
  fail = false; await engine.saveAndReturnToTitle(); assert.equal(engine.state.screen, 'title'); assert.equal(engine.state.saved, true);
  assert.equal(engine.state.storageError, ''); assert.equal((await store.get(id))!.player.gold, 456); assert.equal(memory.values.size, 1);
});
test('missing and invalid character records are not loaded or overwritten', async () => {
  const store = memoryStore(), engine = new Engine(store); await engine.initialize();
  await engine.load('missing'); assert.equal(engine.state.player,null); assert.match(engine.state.storageError,/找不到/);
  const p = createPlayer('pal','损坏角色'); createStartingItems(p); p.level = 100;
  const record: SaveRecord = {id:'corrupt',version:1,player:p,seed:1,timestamp:1}; await store.put(record);
  await engine.load(record.id); assert.equal(engine.state.player,null); assert.match(engine.state.storageError,/损坏/);
  assert.deepEqual(await store.get(record.id),record);
});
test('unavailable IndexedDB blocks character creation rather than silently losing saves', async () => {
  const memory = memoryStore(), store = {...memory, list: async (): Promise<SaveRecord[]> => { throw new Error('blocked'); }};
  const engine = new Engine(store); await engine.initialize();
  engine.dispatch({type:'new',classId:'sor',name:'不可保存'});
  assert.equal(engine.state.storageStatus,'error'); assert.equal(engine.state.player,null);
});
test('save validation rejects NaN fields, unknown classes and invalid levels', () => {
  const p = createPlayer('pal','圣骑士'); createStartingItems(p);
  assert.equal(validSave({version:1,player:p,seed:1}),true);
  assert.equal(validSave({version:1,player:{...p,level:100},seed:1}),false);
  assert.equal(validSave({version:1,player:{...p,life:NaN},seed:1}),false);
  assert.equal(validSave({version:1,player:{...p,classId:'demon'},seed:1}),false);
});
test('pathfinder reaches every town exit without crossing walls', () => {
  const p=createPlayer('bar','野蛮人'), area=createArea(1,'normal',123,p);
  for (const object of area.objects.filter(o=>o.kind==='exit')) {
    const path=findPath(area,area.spawn,object); assert.ok(path.length>0);
    for (const point of path) assert.equal(area.tiles[Math.floor(point.y)][Math.floor(point.x)],0);
  }
});
test('save rejects incomplete item price instead of accepting corrupt finance state', () => {
  const p=createPlayer('pal','存档测试'); createStartingItems(p);
  const corrupted=structuredClone(p); delete (corrupted.inventory[0] as unknown as Record<string,unknown>).price;
  assert.equal(validSave({version:1,player:corrupted,seed:1}),false);
});
test('paused engine has no time progression', () => {
  const engine = new Engine(); engine.dispatch({type:'new',classId:'ama',name:'亚马逊'});
  engine.dispatch({type:'pause'}); const tick=engine.state.tick;
  for (let i=0;i<100;i++) engine.step(); assert.equal(engine.state.tick,tick);
});
test('higher difficulty and undiscovered waypoint cannot be used as free travel', () => {
  const engine = new Engine(); engine.dispatch({type:'new',classId:'pal',name:'骑士'});
  engine.dispatch({type:'difficulty',difficulty:'hell'}); assert.equal(engine.state.player!.difficulty,'normal');
  engine.dispatch({type:'travel',areaId:35}); assert.equal(engine.state.area!.def.id,1);
});
test('walking to a town exit transitions to Blood Moor through normal interaction', () => {
  const engine=new Engine(); engine.dispatch({type:'new',classId:'pal',name:'寻路测试'});
  const exit=engine.state.area!.objects.find(o=>o.kind==='exit' && o.targetArea===2);
  assert.ok(exit);
  engine.dispatch({type:'interact',uid:exit.uid});
  for (let i=0;i<250 && engine.state.area!.def.id===1;i++) engine.step();
  assert.equal(engine.state.area!.def.id,2);
  assert.equal(engine.state.player!.dead,false);
});
for (const code of ['rvs', 'rvl']) test(`${code} pickup fills a free belt slot before the inventory`, () => {
  const engine=new Engine(); engine.dispatch({type:'new',classId:'sor',name:'药水测试'});
  const p=engine.state.player!, area=engine.state.area!, item=createItem(code,1,seededRandom(42));
  p.belt[0]=null;
  area.drops.push({item,x:p.x,y:p.y});
  engine.dispatch({type:'pickup',uid:item.uid});
  assert.ok(p.belt.some(i=>i?.uid===item.uid));
  assert.equal(p.belt.filter(Boolean).length,4);
  assert.ok(!p.inventory.some(i=>i.uid===item.uid));
  assert.ok(!area.drops.some(d=>d.item.uid===item.uid));
});
for (const scenario of [
  { name: 'standing with run toggle enabled', running: true, stamina: 84, destination: null, roll: .5, blocked: true },
  { name: 'walking', running: false, stamina: 84, destination: 6.5, roll: .5, blocked: true },
  { name: 'running blocks at 25%, not 8%', running: true, stamina: 84, destination: 6.5, roll: .2, blocked: true },
  { name: 'running does not retain 75% block', running: true, stamina: 84, destination: 6.5, roll: .5, blocked: false },
  { name: 'exhausted run toggle walks with full block', running: true, stamina: 0, destination: 6.5, roll: .5, blocked: true },
  { name: 'last movement frame still runs after the path empties', running: true, stamina: 84, destination: 5.6, roll: .5, blocked: false },
]) test(`shield block uses actual movement: ${scenario.name}`, () => {
  const engine = new Engine(); engine.dispatch({ type: 'new', classId: 'ama', name: '格挡测试' });
  const p = engine.state.player!, area = createArea(2, 'normal', 123, p), monster = area.monsters[0];
  area.tiles = Array.from({ length: area.height }, () => Array(area.width).fill(0));
  Object.assign(monster, { x: 5.8, y: 5.5, ai: 'melee', boss: false, minDamage: 10, maxDamage: 10, attackRating: 100000, cooldown: 0, dead: false });
  area.monsters = [monster]; area.objects = []; engine.state.area = area;
  p.x = 5.5; p.y = 5.5; p.running = scenario.running; p.stamina = scenario.stamina;
  (engine as unknown as { rng: Rng }).rng = () => scenario.roll;
  assert.equal(engine.state.stats!.block, 75);
  const before = p.life;
  for (let i = 0; i < 6; i++) { engine.step(); assert.equal(p.life, before, 'windup cannot deal damage before its action frame'); }
  p.stamina = scenario.stamina;
  if (scenario.destination !== null) engine.dispatch({ type: 'move', point: { x: scenario.destination, y: 5.5 } });
  engine.step();
  assert.equal(p.life, before - (scenario.blocked ? 0 : 10));
  if (scenario.destination === 5.6) {
    monster.cooldown = 0; const stoppedLife = p.life;
    for (let i = 0; i < 7; i++) engine.step();
    assert.equal(p.life, stoppedLife, 'stationary recovery and the next impact restore full block');
  }
});

for (const code of ['rvs', 'rvl']) test(`${code} heals against real caps after picking up a charm`, () => {
  const engine = new Engine(); engine.dispatch({ type: 'new', classId: 'sor', name: '上限测试' });
  const p = engine.state.player!, charm = createItem('cm1', 1, seededRandom(42));
  charm.mods = { life: 20, mana: 25 }; charm.identified = true;
  engine.state.area!.drops.push({ item: charm, x: p.x, y: p.y });
  engine.dispatch({ type: 'pickup', uid: charm.uid });
  assert.equal(engine.state.stats!.maxLife, 60); assert.equal(engine.state.stats!.maxMana, 60);
  p.belt[0] = createItem(code, 1, seededRandom(42)); p.life = 1; p.mana = 1;
  engine.dispatch({ type: 'potion', column: 0 });
  assert.equal(p.life, code === 'rvs' ? 22 : 60); assert.equal(p.mana, code === 'rvs' ? 22 : 60);
  assert.equal(p.belt[0], null);
});

function ordinaryAttackFixture() {
  const engine = new Engine(); engine.dispatch({ type: 'new', classId: 'ama', name: '伤害测试' });
  const p = engine.state.player!, area = createArea(2, 'normal', 123, p), m = area.monsters[0];
  area.tiles = Array.from({ length: area.height }, () => Array(area.width).fill(0));
  Object.assign(m, { code: 'fallen1', x: 5.8, y: 5.5, level: 1, defense: 0, life: 1000, maxLife: 1000, experience: 0, cooldown: 100, dead: false });
  m.resists = { physical: 0, fire: 0, cold: 0, lightning: 0, poison: 0, magic: 0 };
  area.monsters = [m]; area.objects = []; engine.state.area = area;
  p.x = 5.5; p.y = 5.5; p.strength = 0; p.life = 1; p.mana = 1;
  const weapon = createItem('hax', 80, () => .5); weapon.minDamage = 100; weapon.maxDamage = 100; weapon.mods = {};
  p.equipment = { weapon }; engine.state.stats = deriveStats(p);
  (engine as unknown as { rng: Rng }).rng = () => 0;
  return { engine, p, m, weapon };
}

test('player damage uses the common bit pipeline and does not emit hurt for fully reduced hits', () => {
  const { engine, p, m, weapon } = ordinaryAttackFixture();
  weapon.mods = { flatReduction: 10 }; p.running = false; m.cooldown = 0;
  engine.state.stats = deriveStats(p);
  for (let tick = 0; tick < 8; tick++) engine.step();
  assert.equal(p.life, 1);
  assert.equal(engine.state.events.some(event => event.actor === 'player' && event.kind === 'hurt'), false);
});
test('monster fire damage retains fractional resisted player life loss without physical block', () => {
  const { engine, p, m, weapon } = ordinaryAttackFixture();
  weapon.mods = { resFire: 75 }; p.life = 40; p.running = false;
  Object.assign(m, { ai: 'shaman', cooldown: 0, minDamage: 101, maxDamage: 101 });
  engine.state.stats = deriveStats(p); engine.step();
  assert.equal(p.life, 14.75);
  assert.equal(engine.state.events.filter(event => event.actor === 'player' && event.kind === 'hurt').length, 1);
});

for (const mode of ['critical', 'deadly', 'both', 'deadly-after-critical-fails'] as const) test(`ordinary attack resolves ${mode} once before resistance without doubling elements`, () => {
  const { engine, p, m, weapon } = ordinaryAttackFixture();
  if (mode !== 'deadly') p.skills[9] = 1;
  if (mode !== 'critical') weapon.mods.deadlyStrike = 50;
  p.inventory.push(Object.assign(createItem('cm1', 1, () => .5), { identified: true, mods: { minFire: 10, maxFire: 10 } }));
  weapon.minDamage = 101; weapon.maxDamage = 101; m.resists.physical = 75;
  engine.state.stats = deriveStats(p);
  let calls = 0;
  const rolls = mode === 'deadly-after-critical-fails' ? [0, 0, .2, .4, 0] : [0, 0, 0, 0];
  (engine as unknown as { rng: Rng }).rng = () => rolls[calls++] ?? 0;
  engine.dispatch({ type: 'attack', point: m });
  assert.equal(m.life, 939.5);
  assert.equal(calls, mode === 'deadly-after-critical-fails' ? 5 : 4);
});

test('ordinary attack resists each added channel separately and uses cold frames without elemental leech', () => {
  const { engine, p, m, weapon } = ordinaryAttackFixture();
  weapon.mods = { lifeLeech: 10, manaLeech: 10, minFire: 10, maxFire: 10, minCold: 10, maxCold: 10, coldLength: 80, minLightning: 10, maxLightning: 10, minMagic: 10, maxMagic: 10 };
  Object.assign(m.resists, { physical: 75, fire: 75, cold: 50, lightning: 100, magic: -50 });
  engine.state.stats = deriveStats(p); engine.dispatch({ type: 'attack', point: m });
  assert.equal(m.life, 952.5); assert.equal(m.chill, 80);
  assert.equal(p.life, 3.5); assert.equal(p.mana, 3.5);
});

test('ordinary attack leeches only resisted physical life loss, not charm elements', () => {
  const { engine, p, m, weapon } = ordinaryAttackFixture();
  weapon.mods = { lifeLeech: 10, manaLeech: 10 };
  p.inventory.push(Object.assign(createItem('cm1', 1, () => .5), { identified: true, mods: { minFire: 100, maxFire: 100, minMagic: 20, maxMagic: 20 } }));
  engine.state.stats = deriveStats(p); engine.dispatch({ type: 'attack', point: m });
  assert.equal(m.life, 780); assert.equal(p.life, 11); assert.equal(p.mana, 11);
});

test('ordinary attack caps leech at remaining monster life and cannot leech immune physical damage', () => {
  const { engine, p, m, weapon } = ordinaryAttackFixture();
  weapon.mods = { lifeLeech: 10, manaLeech: 10 }; m.life = 3;
  engine.state.stats = deriveStats(p); engine.dispatch({ type: 'attack', point: m });
  assert.equal(p.life, 1 + 76 / 256); assert.equal(p.mana, 1 + 76 / 256); assert.equal(m.dead, true);
  const immune = ordinaryAttackFixture(); immune.weapon.mods = { lifeLeech: 10, minFire: 10, maxFire: 10 }; immune.m.resists.physical = 100;
  immune.engine.state.stats = deriveStats(immune.p); immune.engine.dispatch({ type: 'attack', point: immune.m });
  assert.equal(immune.m.life, 990); assert.equal(immune.p.life, 1);
});

test('zero monster drain from omitted raw fields prevents skeleton life and mana leech', () => {
  const { engine, p, m, weapon } = ordinaryAttackFixture();
  m.code = 'skeleton1'; weapon.mods = { lifeLeech: 100, manaLeech: 100 };
  engine.state.stats = deriveStats(p); engine.dispatch({ type: 'attack', point: m });
  assert.equal(m.life, 900); assert.equal(p.life, 1); assert.equal(p.mana, 1);
});

test('ordinary attack ignores unidentified or broken weapon modifiers and the other hand', () => {
  for (const broken of [false, true]) {
    const { engine, p, m, weapon } = ordinaryAttackFixture();
    weapon.mods = { deadlyStrike: 100, minFire: 100, maxFire: 100 }; weapon.quality = 'magic';
    if (broken) weapon.durability = 0; else weapon.identified = false;
    const other = createItem('hax', 80, () => .5); other.mods = { deadlyStrike: 100, minMagic: 100, maxMagic: 100 };
    p.equipment.offhand = other; engine.state.stats = deriveStats(p);
    const damage = engine.state.stats.minDamage;
    engine.dispatch({ type: 'attack', point: m }); assert.equal(m.life, 1000 - damage);
  }
});

test('Warmth and socketed Eth regenerate exact bits through the live frame loop', () => {
  const engine = new Engine(); engine.dispatch({ type: 'new', classId: 'sor', name: '暖气测试' });
  const p = engine.state.player!; p.level = 20; p.skills[37] = 20;
  const helm = createItem('cap', 20, () => .5), eth = createItem('r05', 20, () => .5);
  helm.sockets = 1; helm.mods = { mana: 827 }; p.inventory.push(helm, eth);
  assert.equal(insertSocket(p, helm.uid, eth.uid).ok, true);
  engine.dispatch({ type: 'equip', uid: helm.uid }); p.mana = 0;
  assert.equal(engine.state.stats!.maxMana, 900); assert.equal(engine.state.stats!.manaRegenPercent, 273);
  engine.step(); assert.equal(p.mana, 283 / 256);
  engine.dispatch({ type: 'pause' }); engine.step(); assert.equal(p.mana, 283 / 256);
});

test('full rejuvenation reaches a fractional cap through the normal potion action', () => {
  const engine = new Engine(); engine.dispatch({ type: 'new', classId: 'nec', name: '半点上限' });
  const p = engine.state.player!; p.level = 18; p.life = 1; p.mana = 1; p.belt[0] = createItem('rvl', 1, () => .5);
  engine.state.stats = deriveStats(p); engine.dispatch({ type: 'potion', column: 0 });
  assert.equal(p.life, 70.5); assert.equal(p.mana, 59);
});

test('Fire Ball damages a target between three and four subtiles from its impact', () => {
  const { engine, p, m } = ordinaryAttackFixture(); p.classId = 'sor'; p.skills = { 47: 1 }; p.rightSkill = 47; p.mana = 100;
  const edge = structuredClone(m); edge.uid = 'radius-edge'; edge.x = m.x + 3.5;
  engine.state.area!.monsters.push(edge); engine.state.stats = deriveStats(p);
  engine.dispatch({ type: 'attack', point: m, right: true });
  assert.equal(engine.state.projectiles[0].explosionRadius, 4);
  engine.step(); assert.equal(m.life, 994); assert.equal(edge.life, 994);
});

test('foreign native staff skills cannot bind or cast and never provide Warmth', () => {
  const { engine, p, m } = ordinaryAttackFixture();
  const staff = createItem('sst', 20, () => .5);
  staff.mods = { 'skill:36': 3, 'skill:37': 3, fireSkills: 3, allSkills: 2 };
  p.equipment = { weapon: staff }; p.mana = 20; p.rightSkill = 0;
  engine.state.stats = deriveStats(p);
  engine.dispatch({ type: 'bind', skillId: 36, right: true });
  assert.equal(p.rightSkill, 0); assert.equal(engine.state.stats.manaRegenPercent, 0);
  p.rightSkill = 36;
  engine.dispatch({ type: 'attack', point: m, right: true });
  assert.equal(p.mana, 20); assert.equal(engine.state.projectiles.length, 0); assert.equal(m.life, 1000);
});

test('actual Leaf resolves native levels, exact spell damage, mana and Warmth then loses grants on swap', () => {
  const { engine, p, m } = ordinaryAttackFixture(); p.classId = 'sor'; p.skills = {}; p.level = 20;
  const staff = createItem('sst', 20, () => .5); staff.sockets = 2; staff.mods['skill:36'] = 1;
  p.inventory.push(staff);
  for (const code of ['r03', 'r08']) {
    const rune = createItem(code, 20, () => .5); p.inventory.push(rune);
    assert.equal(insertSocket(p, staff.uid, rune.uid).ok, true);
  }
  engine.dispatch({ type: 'equip', uid: staff.uid });
  assert.equal(skillLevel(p, 36), 7); assert.equal(skillLevel(p, 37), 6);
  assert.equal(engine.state.stats!.manaRegenPercent, 90);
  m.resists.fire = 25; p.mana = 20;
  engine.dispatch({ type: 'bind', skillId: 36, right: true });
  engine.dispatch({ type: 'attack', point: m, right: true });
  assert.equal(p.mana, 17.5);
  assert.deepEqual([engine.state.projectiles[0].min, engine.state.projectiles[0].max], [12, 15]);
  engine.step(); assert.equal(m.life, 991);
  engine.dispatch({ type: 'swap' });
  assert.equal(skillLevel(p, 36), 0); assert.equal(skillLevel(p, 37), 0);
  assert.equal(engine.state.stats!.manaRegenPercent, 0);
  for (let i = 0; i < 25; i++) engine.step();
  const mana = p.mana;
  engine.dispatch({ type: 'attack', point: m, right: true });
  assert.equal(p.mana, mana); assert.equal(engine.state.projectiles.length, 0); assert.equal(m.life, 991);
});

test('weapon swap updates active stats in panels without moving or rerolling owned equipment', () => {
  const engine = new Engine(); engine.dispatch({ type: 'new', classId: 'sor', name: '武器切换测试' });
  const p = engine.state.player!, first = createItem('hax', 1, () => .5), second = createItem('sst', 1, () => .5);
  first.mods = { mana: 10 }; second.mods = { mana: 40, 'skill:36': 1 };
  p.equipment = { weapon: first, weapon2: second }; engine.state.stats = deriveStats(p);
  const equipment = structuredClone(p.equipment), inventory = structuredClone(p.inventory), initialMana = engine.state.stats.maxMana;
  for (const panel of ['inventory', 'character', 'vendor', 'gamble', 'none'] as const) {
    engine.state.panel = panel;
    engine.dispatch({ type: 'swap' });
    assert.equal(p.weaponSwap, true); assert.equal(engine.state.panel, panel);
    assert.equal(engine.state.stats!.maxMana, initialMana + 30); assert.equal(skillLevel(p, 36), 1);
    assert.match(engine.state.messages.at(-1)!.text, /武器组 II$/);
    engine.dispatch({ type: 'swap' });
    assert.equal(p.weaponSwap, false); assert.equal(engine.state.stats!.maxMana, initialMana); assert.equal(skillLevel(p, 36), 0);
    assert.deepEqual(p.equipment, equipment); assert.deepEqual(p.inventory, inventory);
  }
});

for (const gate of ['paused', 'dead'] as const) test(`weapon swap rejects ${gate} without altering equipment or stats`, () => {
  const engine = new Engine(); engine.dispatch({ type: 'new', classId: 'sor', name: '武器切换门槛' });
  engine.state.panel = 'inventory';
  if (gate === 'paused') engine.state.paused = true; else engine.state.player!.dead = true;
  const before = structuredClone({ player: engine.state.player, stats: engine.state.stats, messages: engine.state.messages });
  engine.dispatch({ type: 'swap' });
  assert.deepEqual({ player: engine.state.player, stats: engine.state.stats, messages: engine.state.messages }, before);
});

test('town attacks neither consume mana nor create projectiles', () => {
  const engine=new Engine(); engine.dispatch({type:'new',classId:'sor',name:'测试法师'});
  const mana=engine.state.player!.mana;
  engine.dispatch({type:'attack',point:{x:5,y:5},right:true});
  assert.equal(engine.state.player!.mana,mana); assert.equal(engine.state.projectiles.length,0);
});

function controlFixture(kind: 'melee' | 'spell' = 'melee') {
  const fixture = ordinaryAttackFixture(), { engine, p, m, weapon } = fixture;
  if (kind === 'spell') Object.assign(p, createPlayer('sor', '持续施法测试'));
  Object.assign(p, { x: 5.5, y: 5.5, strength: 0, running: false, skills: kind === 'spell' ? { 36: 1 } : {}, leftSkill: 0, rightSkill: kind === 'spell' ? 36 : 0 });
  p.equipment = { weapon };
  Object.assign(m, { uid: 'control-target', ai: 'melee', boss: false, champion: false, life: 10000, maxLife: 10000, experience: 40, cooldown: 10000, chill: 0, poison: 0, poisonFrames: 0, modifiers: [] });
  engine.state.stats = deriveStats(p);
  p.life = engine.state.stats.maxLife; p.mana = engine.state.stats.maxMana; p.stamina = engine.state.stats.maxStamina;
  return { ...fixture, area: engine.state.area! };
}

function assertClose(actual: number, expected: number, label: string) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: expected ${expected}, observed ${actual}`);
}

for (const running of [false, true]) test(`continuous WASD has equal cardinal and diagonal speed while ${running ? 'running' : 'walking'}`, () => {
  for (const move of [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }]) {
    const { engine, p, area } = controlFixture(); area.monsters = []; p.running = running;
    const start = { x: p.x, y: p.y }, length = Math.hypot(move.x, move.y), speed = (running ? 9 : 6) / 25;
    engine.setControl({ move });
    assertClose(Math.hypot(engine.control.move.x, engine.control.move.y), 1, 'normalized control length');
    for (let frame = 1; frame <= 10; frame++) {
      engine.step();
      assertClose(p.x, start.x + move.x / length * speed * frame, 'continuous x');
      assertClose(p.y, start.y + move.y / length * speed * frame, 'continuous y');
      assertClose(Math.hypot(p.x - start.x, p.y - start.y), speed * frame, 'distance is independent of direction');
      assertClose(engine.state.facing, Math.atan2(move.y, move.x), 'movement facing');
      assert.equal(engine.state.moving, true);
    }
    assertClose(p.stamina, engine.state.stats!.maxStamina - (running ? 2 : 0), 'only running drains stamina');
    engine.setControl({ move: { x: 0, y: 0 } }); const stopped = { x: p.x, y: p.y };
    for (let i = 0; i < 5; i++) engine.step();
    assert.deepEqual({ x: p.x, y: p.y }, stopped); assert.equal(engine.state.moving, false);
  }
});

test('WASD cancels a click path and releasing movement never resumes it', () => {
  const { engine, p, area } = controlFixture(); area.monsters = [];
  engine.dispatch({ type: 'move', point: { x: 12.5, y: 5.5 } });
  assert.ok(engine.state.target);
  engine.setControl({ move: { x: -1, y: 0 }, aim: { x: 9, y: 9 } }); engine.step();
  assertClose(p.x, 5.26, 'WASD overrides the eastbound click path'); assert.equal(engine.state.target, null);
  engine.setControl({ move: { x: 0, y: 0 } });
  assert.deepEqual(engine.control.aim, { x: 9, y: 9 }, 'partial updates preserve aim');
  for (let i = 0; i < 20; i++) engine.step();
  assertClose(p.x, 5.26, 'released WASD does not revive the old path'); assert.equal(p.y, 5.5);
});

for (const axis of ['x', 'y'] as const) test(`held WASD cannot enter or pass a solid ${axis === 'x' ? 'vertical' : 'horizontal'} wall`, () => {
  const { engine, p, area } = controlFixture(); area.monsters = [];
  if (axis === 'x') for (const row of area.tiles) row[6] = 1;
  else area.tiles[6].fill(1);
  engine.setControl({ move: axis === 'x' ? { x: 1, y: 0 } : { x: 0, y: 1 } });
  for (let i = 0; i < 40; i++) {
    engine.step(); assert.ok(p[axis] < 6, `frame ${i + 1}: player crossed the wall at ${p[axis]}`);
    assert.equal(area.tiles[Math.floor(p.y)][Math.floor(p.x)], 0);
  }
  assert.equal(engine.state.moving, false);
});

test('diagonal WASD slides along a wall without crossing it', () => {
  const { engine, p, area } = controlFixture(); area.monsters = [];
  for (const row of area.tiles) row[6] = 1;
  engine.setControl({ move: { x: 1, y: 1 } });
  for (let i = 0; i < 12; i++) { engine.step(); assert.ok(p.x < 6); assert.equal(area.tiles[Math.floor(p.y)][Math.floor(p.x)], 0); }
  assert.ok(p.y > 7); assert.equal(engine.state.moving, true);
});

test('diagonal WASD cannot tunnel through the corner between two blocked tiles', () => {
  const { engine, p, area } = controlFixture(); area.monsters = [];
  p.x = 5.9; p.y = 5.9; area.tiles[5][6] = 1; area.tiles[6][5] = 1;
  engine.setControl({ move: { x: 1, y: 1 } }); engine.step();
  assert.ok(p.x < 6 && p.y < 6, `expected to remain before the blocked corner (6, 6), observed (${p.x}, ${p.y})`);
});

test('fast WASD checks the swept route and cannot tunnel across a one-tile wall', () => {
  const { engine, p, area, weapon } = controlFixture(); area.monsters = [];
  weapon.mods.frw = 200; engine.state.stats = deriveStats(p); p.running = true; p.x = 5.99;
  assert.equal(engine.state.stats.frw, 200);
  for (const row of area.tiles) row[6] = 1;
  engine.setControl({ move: { x: 1, y: 0 } }); engine.step();
  assert.ok(p.x < 6, `expected to stop before wall column 6 at 200% FRW, observed x=${p.x}`);
  assert.equal(area.tiles[Math.floor(p.y)][Math.floor(p.x)], 0);
});

for (const { ias, frames } of [{ ias: 0, frames: 16 }, { ias: 100, frames: 8 }, { ias: 300, frames: 5 }]) test(`held left attack emits and damages once per ${frames}-frame cooldown at ${ias}% IAS`, () => {
  const { engine, p, m, weapon } = controlFixture(); weapon.mods.ias = ias; engine.state.stats = deriveStats(p);
  const mana = p.mana;
  engine.setControl({ aim: { x: m.x, y: m.y }, aimMonster: m.uid, left: true });
  assert.equal(engine.state.events.length, 0, 'input sampling is not an attack frame');
  for (let frame = 1; frame <= frames * 2 + 2; frame++) {
    const oldSeq = engine.state.eventSeq;
    for (let sample = 0; sample < 4; sample++) engine.setControl({ aim: { x: m.x, y: m.y } });
    assert.equal(engine.state.eventSeq, oldSeq, 'render/input samples cannot spend a cooldown');
    engine.step(); const count = Math.floor((frame - 1) / frames) + 1;
    const attacks = engine.state.events.filter(e => e.actor === 'player' && e.kind === 'attack');
    assert.equal(attacks.length, count, `attack count at frame ${frame}`);
    assert.deepEqual(attacks.map(e => e.tick), Array.from({ length: count }, (_, i) => 1 + i * frames));
    assert.equal(engine.state.events.filter(e => e.actor === m.uid && e.kind === 'hurt').length, count);
    assert.equal(m.life, 10000 - count * 100); assert.equal(p.mana, mana);
    assert.equal(p.experience, 0); assert.equal(p.statPoints, 0); assert.equal(p.skillPoints, 0);
    assert.equal(engine.state.projectiles.length, 0);
  }
});

for (const { fcr, frames } of [{ fcr: 0, frames: 13 }, { fcr: 9, frames: 12 }, { fcr: 105, frames: 8 }]) test(`held right Fire Bolt casts once per ${frames}-frame cooldown at ${fcr}% FCR`, () => {
  const { engine, p, m, weapon } = controlFixture('spell'); weapon.mods.fcr = fcr; engine.state.stats = deriveStats(p);
  assert.equal(p.mana, 35); const mana = p.mana;
  engine.setControl({ aim: { x: m.x, y: m.y }, aimMonster: m.uid, right: true });
  for (let frame = 1; frame <= frames * 2 + 2; frame++) {
    const oldSeq = engine.state.eventSeq;
    for (let sample = 0; sample < 4; sample++) engine.setControl({ right: true });
    assert.equal(engine.state.eventSeq, oldSeq);
    engine.step(); const count = Math.floor((frame - 1) / frames) + 1;
    const casts = engine.state.events.filter(e => e.actor === 'player' && e.kind === 'cast');
    assert.equal(casts.length, count, `cast count at frame ${frame}`);
    assert.deepEqual(casts.map(e => e.tick), Array.from({ length: count }, (_, i) => 1 + i * frames));
    assert.ok(casts.every(e => e.element === 'fire'));
    assert.equal(engine.state.events.filter(e => e.actor === 'player' && e.kind === 'attack').length, 0);
    assert.equal(m.life, 10000 - count * 3, 'each seeded Fire Bolt hits once for its minimum damage');
    assert.equal(p.mana, mana - count * 2.5 + frame * (2 / 256), 'only successful casts spend mana; frame regeneration remains exact');
    assert.equal(p.experience, 0); assert.equal(engine.state.projectiles.length, 0, 'impact consumes the projectile');
  }
});

for (const kind of ['melee', 'spell'] as const) {
  const right = kind === 'spell', frames = right ? 13 : 16;
  test(`single ${kind} press resolves before a tick and release cannot repeat it`, () => {
    const { engine, p, m } = controlFixture(kind), mana = p.mana;
    engine.setControl({ aim: m, left: !right, right }, right);
    assert.deepEqual(engine.state.events.filter(e => e.actor === 'player').map(e => [e.kind, e.tick]), [[right ? 'cast' : 'attack', 0]]);
    assert.equal(p.mana, mana - (right ? 2.5 : 0));
    for (let i = 0; i < 20; i++) engine.setControl({ aim: m });
    engine.setControl({ left: false, right: false });
    for (let i = 0; i < frames * 2; i++) engine.step();
    assert.equal(engine.state.events.filter(e => e.actor === 'player').length, 1);
    assert.equal(m.life, 10000 - (right ? 3 : 100));
  });
  test(`press then held ${kind} retains the existing cooldown and mana costs`, () => {
    const { engine, p, m } = controlFixture(kind), mana = p.mana;
    engine.setControl({ aim: m, left: !right, right }, right);
    for (let frame = 1; frame <= frames * 2; frame++) {
      for (let i = 0; i < 4; i++) engine.setControl({ aim: m });
      engine.step();
    }
    assert.deepEqual(engine.state.events.filter(e => e.actor === 'player').map(e => e.tick), [0, frames, frames * 2]);
    assert.equal(p.mana, mana - (right ? 7.5 : 0) + (right ? frames * 2 * (2 / 256) : 0));
  });
  test(`short ${kind} press during cooldown cannot bypass it or fire after release`, () => {
    const { engine, m } = controlFixture(kind);
    engine.setControl({ aim: m, left: !right, right }, right);
    engine.setControl({ left: false, right: false }); engine.step();
    engine.setControl({ left: !right, right }, right);
    engine.setControl({ left: false, right: false });
    for (let i = 0; i < frames * 2; i++) engine.step();
    assert.equal(engine.state.events.filter(e => e.actor === 'player').length, 1);
  });
}

for (const advanced of [false, true]) test(`released distant melee cannot retain an attack chase ${advanced ? 'after movement' : 'before a tick'}`, () => {
  const { engine, p, m } = controlFixture();
  m.x = p.x + 4;
  engine.setControl({ aim: m, aimMonster: m.uid, left: true }, false);
  if (advanced) engine.step();
  const stopped = { x: p.x, y: p.y };
  engine.setControl({ left: false, right: false });
  for (let i = 0; i < 20; i++) engine.step();
  assert.deepEqual({ x: p.x, y: p.y }, stopped);
  assert.equal(engine.state.events.length, 0);
  assert.equal(m.life, 10000);
});

test('a control reset does not clear a separate click-to-walk route', () => {
  const { engine, p } = controlFixture();
  const start = p.x;
  engine.dispatch({ type: 'move', point: { x: p.x + 3, y: p.y } });
  engine.setControl({ move: { x: 0, y: 0 }, left: false, right: false });
  engine.step();
  assert.ok(p.x > start);
});

for (const steering of [false, true]) test(`quick melee press uses directional nearby targeting while ${steering ? 'steering' : 'standing'}`, () => {
  const { engine, p, m } = controlFixture();
  engine.setControl({ aim: { x: p.x + 4, y: p.y }, move: { x: 0, y: steering ? -1 : 0 }, left: true }, false);
  assert.equal(engine.state.selectedMonster, m.uid);
  assert.equal(m.life, 9900);
  assert.equal(engine.state.events[0].tx, m.x);
});

for (const teleport of [false, true]) test(`quick ground-aimed ${teleport ? 'teleport' : 'projectile'} cannot snap to an unpicked nearby monster`, () => {
  const { engine, p, m } = controlFixture('spell');
  if (teleport) { p.skills[54] = 1; p.rightSkill = 54; }
  const aim = { x: m.x + .5, y: m.y + .5 };
  engine.setControl({ aim, aimMonster: null, right: true }, true);
  assert.equal(engine.state.selectedMonster, null);
  const cast = engine.state.events.find(e => e.actor === 'player' && e.kind === 'cast')!;
  assert.deepEqual({ x: cast.tx, y: cast.ty }, aim);
  if (teleport) assert.deepEqual({ x: p.x, y: p.y }, aim);
  else assert.equal(engine.state.projectiles.length, 1);
});

for (const gate of ['paused', 'panel', 'town', 'dead'] as const) test(`explicit quick press is gated while ${gate}`, () => {
  const { engine, p, m } = controlFixture('spell');
  const mana = p.mana;
  if (gate === 'paused') engine.state.paused = true;
  if (gate === 'panel') engine.state.panel = 'inventory';
  if (gate === 'town') engine.state.area = createArea(1, 'normal', 123, p);
  if (gate === 'dead') p.dead = true;
  engine.setControl({ aim: m, right: true }, true);
  assert.equal(engine.state.events.length, 0);
  assert.equal(engine.state.projectiles.length, 0);
  assert.equal(p.mana, mana);
});

test('a second left press cannot override a held right skill or spend its cooldown', () => {
  const { engine, m } = controlFixture('spell');
  engine.setControl({ aim: m, right: true, left: true }, false);
  assert.equal(engine.state.events.length, 0);
  engine.setControl({ right: true }, true);
  assert.deepEqual(engine.state.events.filter(e => e.actor === 'player').map(e => e.kind), ['cast']);
});

for (const kind of ['melee', 'spell'] as const) test(`releasing held ${kind === 'melee' ? 'left attack' : 'right cast'} clears intent through and beyond its cooldown`, () => {
  const { engine, p, m } = controlFixture(kind), right = kind === 'spell';
  engine.setControl({ aim: { x: m.x, y: m.y }, aimMonster: m.uid, left: !right, right }); engine.step();
  const seq = engine.state.eventSeq, life = m.life;
  engine.setControl({ left: false, right: false });
  for (let i = 0; i < 30; i++) engine.step();
  assert.equal(engine.state.eventSeq, seq); assert.equal(m.life, life); assert.equal(p.experience, 0);
  assert.equal(engine.state.projectiles.length, 0);
  engine.setControl({ left: !right, right }); engine.step();
  const events = engine.state.events.filter(e => e.actor === 'player' && e.kind === (right ? 'cast' : 'attack'));
  assert.deepEqual(events.map(e => e.tick), [1, 32], 're-press starts a fresh attack, not a stale queued one');
  assert.equal(m.life, life - (right ? 3 : 100));
});

test('both held buttons prioritize the right skill and share its cooldown when right is released', () => {
  const { engine, m } = controlFixture('spell');
  engine.setControl({ left: true, right: true, aim: { x: m.x, y: m.y }, aimMonster: m.uid }); engine.step();
  engine.setControl({ right: false }); assert.equal(engine.control.left, true);
  for (let i = 0; i < 12; i++) engine.step();
  assert.deepEqual(engine.state.events.filter(e => e.actor === 'player').map(e => [e.kind, e.tick]), [['cast', 1]]);
  engine.step();
  assert.deepEqual(engine.state.events.filter(e => e.actor === 'player').map(e => [e.kind, e.tick]), [['cast', 1], ['attack', 14]]);
  assert.equal(m.life, 9897);
  engine.setControl({ left: false }); const seq = engine.state.eventSeq;
  for (let i = 0; i < 25; i++) engine.step(); assert.equal(engine.state.eventSeq, seq);
});

for (const kind of ['melee', 'spell'] as const) test(`${kind} recovery does not block retreat or reset the spent cooldown`, () => {
  const { engine, p, m } = controlFixture(kind), right = kind === 'spell';
  engine.setControl({ left: !right, right, aim: { x: m.x, y: m.y }, aimMonster: m.uid }); engine.step();
  engine.setControl({ left: false, right: false, move: { x: 0, y: -1 } });
  engine.step(); assertClose(p.y, 5.26, 'movement responds on the next frame');
  assert.equal(engine.state.moving, true); assertClose(engine.state.facing, -Math.PI / 2, 'retreat facing');
  engine.setControl({ move: { x: 0, y: 0 }, left: !right, right });
  engine.step();
  assert.equal(engine.state.events.filter(e => e.actor === 'player' && (e.kind === 'attack' || e.kind === 'cast')).length, 1, 'movement never clears the skill cooldown');
});

test('holding movement and Fire Bolt retains full movement speed and the original cast cadence', () => {
  const { engine, p, m } = controlFixture('spell');
  engine.setControl({ move: { x: 0, y: -1 }, right: true, aim: m, aimMonster: m.uid });
  for (let i = 0; i < 20; i++) engine.step();
  assertClose(p.y, 5.5 - 20 * 6 / 25, 'steering must not collapse to one movement frame per cast');
  assert.deepEqual(engine.state.events.filter(e => e.actor === 'player' && e.kind === 'cast').map(e => e.tick), [1, 14]);
  assertClose(p.mana, 35 - 5 + 20 * (2 / 256), 'movement cannot duplicate or waive mana costs');
});

test('insufficient mana never emits a cast or deals damage and does not start a cooldown', () => {
  const { engine, p, m } = controlFixture('spell'); p.mana = 2;
  engine.setControl({ right: true, aim: { x: m.x, y: m.y }, aimMonster: m.uid });
  for (let i = 0; i < 40; i++) engine.step();
  assert.equal(p.mana, 2 + 40 * (2 / 256)); assert.equal(m.life, 10000);
  assert.equal(engine.state.eventSeq, 0); assert.equal(engine.state.projectiles.length, 0); assert.equal(p.experience, 0);
  assert.match(engine.state.messages.at(-1)!.text, /法力不足/);
  p.mana = 2.5; engine.step();
  assert.equal(engine.state.events[0].kind, 'cast'); assert.equal(engine.state.events[0].tick, 41);
  assert.equal(p.mana, 2 / 256); assert.equal(m.life, 9997);
});

test('right press explains missing staff-granted Fire Bolt after swapping and casting recovers without changing items', () => {
  const { engine, p } = inventoryUseFixture(false);
  const owned = structuredClone({ inventory: p.inventory, equipment: p.equipment, gold: p.gold });
  const aim = { x: p.x + 2, y: p.y };
  assert.equal(p.skills[36] ?? 0, 0); assert.equal(skillLevel(p, 36), 1);
  engine.setControl({ right: true, aim }, true);
  engine.setControl({ right: false });
  for (let frame = 0; frame < 13; frame++) engine.step();
  assert.equal(engine.state.events.filter(e => e.actor === 'player' && e.kind === 'cast').length, 1);
  engine.dispatch({ type: 'swap' }); assert.equal(skillLevel(p, 36), 0);
  const mana = p.mana, seq = engine.state.eventSeq;
  engine.setControl({ right: true, aim }, true);
  assert.equal(engine.state.eventSeq, seq); assert.equal(p.mana, mana);
  assert.match(engine.state.messages.at(-1)!.text, /未获得火弹.*武器组/);
  engine.setControl({ right: false });
  for (let frame = 0; frame < 13; frame++) engine.step();
  assert.equal(engine.state.eventSeq, seq);
  engine.dispatch({ type: 'swap' }); assert.equal(skillLevel(p, 36), 1);
  const restoredMana = p.mana;
  engine.setControl({ right: true, aim }, true); engine.setControl({ right: false });
  assert.equal(engine.state.events.filter(e => e.actor === 'player' && e.kind === 'cast').length, 2);
  assert.equal(p.mana, restoredMana - 2.5);
  assert.deepEqual({ inventory: p.inventory, equipment: p.equipment, gold: p.gold }, owned);
});

test('explicit right press in town explains the restriction without spending mana or emitting a spell', () => {
  const { engine, p } = inventoryUseFixture(), mana = p.mana, events = structuredClone(engine.state.events);
  engine.setControl({ right: true, aim: { x: p.x + 2, y: p.y } }, true);
  engine.setControl({ right: false });
  assert.equal(p.mana, mana); assert.deepEqual(engine.state.events, events);
  assert.match(engine.state.messages.at(-1)!.text, /营地内不能.*野外/);
});

test('held unlearned skills cannot consume mana, damage, or emit combat events', () => {
  const { engine, p, m } = controlFixture('spell'); p.skills = {}; engine.state.stats = deriveStats(p);
  const mana = p.mana;
  engine.setControl({ right: true, aim: { x: m.x, y: m.y }, aimMonster: m.uid });
  for (let i = 0; i < 30; i++) engine.step();
  assert.equal(p.mana, mana); assert.equal(m.life, 10000); assert.equal(p.experience, 0);
  assert.equal(engine.state.eventSeq, 0); assert.equal(engine.state.projectiles.length, 0);
});

test('town gates both held attack buttons without spending mana or emitting combat events', () => {
  const { engine, p } = controlFixture('spell'); engine.state.area = createArea(1, 'normal', 123, p);
  Object.assign(p, engine.state.area.spawn); const mana = p.mana;
  engine.setControl({ left: true, right: true, aim: { x: p.x + 3, y: p.y } });
  for (let i = 0; i < 30; i++) engine.step();
  assert.equal(p.mana, mana); assert.equal(engine.state.eventSeq, 0); assert.equal(engine.state.projectiles.length, 0); assert.equal(p.experience, 0);
});

test('paused and title screens gate held controls and freeze combat cooldowns', () => {
  for (const gate of ['pause', 'title'] as const) {
    const { engine, p, m } = controlFixture('spell');
    engine.setControl({ right: true, aim: { x: m.x, y: m.y }, aimMonster: m.uid }); engine.step();
    engine.dispatch({ type: gate }); engine.setControl({ move: { x: 1, y: 0 }, left: true });
    const frozen = structuredClone(engine.state);
    for (let i = 0; i < 30; i++) engine.step();
    assert.deepEqual(engine.state, frozen, `${gate} freezes movement, mana, damage, events and time`);
    engine.setControl({ move: { x: 0, y: 0 }, left: false });
    if (gate === 'pause') engine.dispatch({ type: 'pause' });
    else { engine.state.screen = 'game'; engine.state.paused = false; }
    for (let i = 0; i < 12; i++) engine.step();
    assert.equal(engine.state.events.filter(e => e.actor === 'player' && e.kind === 'cast').length, 1);
    engine.step();
    assert.deepEqual(engine.state.events.filter(e => e.actor === 'player' && e.kind === 'cast').map(e => e.tick), [1, 14]);
    assert.equal(m.life, 9994); assert.equal(p.experience, 0);
  }
});

test('explicit aimed monster determines selection, facing and immutable event endpoints', () => {
  const { engine, p, m } = controlFixture(); m.x = p.x; m.y = p.y + 1;
  const aim = { x: p.x + 4, y: p.y };
  engine.setControl({ left: true, aim, aimMonster: m.uid }); engine.step();
  assert.deepEqual(engine.control.aim, aim); assert.equal(engine.state.selectedMonster, m.uid);
  assertClose(engine.state.facing, Math.PI / 2, 'attack faces the selected monster instead of the raw cursor');
  const event = structuredClone(engine.state.events[0]);
  assert.deepEqual(event, { seq: 1, tick: 1, actor: 'player', kind: 'attack', x: 5.5, y: 5.5, tx: 5.5, ty: 6.5, element: 'physical' });
  engine.setControl({ left: false }); m.x = 6.5; m.y = 5.5;
  for (let i = 0; i < 16; i++) engine.step();
  engine.setControl({ left: true, aim: { x: 1, y: 5.5 }, aimMonster: m.uid }); engine.step();
  assertClose(engine.state.facing, 0, 'updated target position changes facing');
  assert.deepEqual(engine.state.events[0], event, 'old event positions are snapshots, not live Monster references');
  assert.deepEqual([engine.state.events.at(-2)!.tx, engine.state.events.at(-2)!.ty], [6.5, 5.5]);
});

test('steered melee ignores dead or stale aimed IDs and selects a live target in front', () => {
  const { engine, p, m, area } = controlFixture(); m.x = 6.5;
  const dead = { ...structuredClone(m), uid: 'dead-aim', x: 5.9, life: 0, dead: true };
  const behind = { ...structuredClone(m), uid: 'behind-player', x: 4.5 };
  area.monsters.push(dead, behind);
  engine.setControl({ move: { x: 1, y: 0 }, left: true, aim: { x: 10, y: 5.5 }, aimMonster: dead.uid }); engine.step();
  assertClose(p.x, 5.74, 'WASD moves before the attack starts');
  assert.equal(engine.state.selectedMonster, m.uid); assert.equal(m.life, 9900);
  assert.equal(dead.life, 0); assert.equal(behind.life, 10000); assert.equal(p.experience, 0);
});

test('held aim at empty ground clears the previous selectedMonster like a dispatched attack', () => {
  const { engine, m } = controlFixture(); m.x = 6.5;
  engine.setControl({ left: true, aim: { x: m.x, y: m.y }, aimMonster: m.uid }); engine.step();
  assert.equal(engine.state.selectedMonster, m.uid);
  engine.setControl({ left: false }); for (let i = 0; i < 16; i++) engine.step();
  engine.setControl({ left: true, aim: { x: 1, y: 5.5 }, aimMonster: null }); engine.step();
  assert.equal(engine.state.events.at(-1)!.kind, 'attack'); assert.equal(engine.state.events.at(-1)!.tx, 1);
  assert.equal(m.life, 9900, 'empty-ground swing cannot damage the former target');
  assert.equal(engine.state.selectedMonster, null, 'empty-ground aim must not leave a stale enemy selected');
});

test('held lethal melee emits ordered hurt/death once and awards XP only for the kill', () => {
  const { engine, p, m } = controlFixture(); m.life = 100; m.maxLife = 100;
  engine.setControl({ left: true, aim: { x: m.x, y: m.y }, aimMonster: m.uid }); engine.step();
  assert.deepEqual(engine.state.events.map(e => [e.actor, e.kind, e.tick]), [['player', 'attack', 1], [m.uid, 'hurt', 1], [m.uid, 'death', 1]]);
  assert.equal(m.dead, true); assert.equal(m.life, 0); assert.equal(p.experience, 40); assert.equal(p.level, 1);
  assert.equal(engine.state.selectedMonster, null);
  const drops = structuredClone(engine.state.area!.drops);
  for (let i = 0; i < 35; i++) engine.step();
  assert.equal(p.experience, 40); assert.equal(p.statPoints, 0); assert.equal(p.skillPoints, 0);
  assert.equal(engine.state.events.filter(e => e.actor === m.uid && e.kind === 'death').length, 1);
  assert.equal(engine.state.events.filter(e => e.actor === m.uid && e.kind === 'hurt').length, 1);
  assert.deepEqual(engine.state.area!.drops, drops, 'holding over a corpse cannot reroll loot');
});

for (const attacker of ['player', 'monster'] as const) test(`${attacker} melee cannot damage across a solid diagonal corner`, () => {
  const { engine, p, m, area } = controlFixture();
  p.x = p.y = 5.9; m.x = m.y = 6.1;
  area.tiles[5][6] = area.tiles[6][5] = 1;
  assert.equal(hasLineOfSight(area, p, m), false);
  assert.equal(hasLineOfSight(area, m, p), false);
  if (attacker === 'player') engine.setControl({ left: true, aim: m, aimMonster: m.uid });
  else { m.cooldown = 0; m.minDamage = m.maxDamage = 10; (engine as unknown as { rng: Rng }).rng = () => 0; }
  const life = p.life;
  engine.step();
  assert.equal(p.life, life); assert.equal(m.life, 10000);
  assert.ok(!engine.state.events.some(e => e.kind === 'attack' || e.kind === 'hurt'));
  area.tiles[5][6] = area.tiles[6][5] = 0;
  assert.equal(hasLineOfSight(area, p, m), true);
  engine.step();
  if (attacker === 'player') assert.equal(m.life, 9900);
  else {
    assert.equal(p.life, life);
    for (let i = 0; i < 6; i++) engine.step();
    assert.equal(p.life, life - 10);
  }
});

test('unalerted monsters require both nearby range and a clear line of sight', () => {
  const { engine, p, m, area } = controlFixture();
  m.x = 8.5; area.tiles[5][6] = 1;
  for (let i = 0; i < 10; i++) engine.step();
  assert.equal(m.x, 8.5); assert.equal(m.y, 5.5);
  area.tiles[5][6] = 0; m.x = 13.5;
  for (let i = 0; i < 10; i++) engine.step();
  assert.equal(m.x, 13.5, 'an unseen eight-tile target must not join the fight');
  m.x = 12.5; engine.step();
  assert.ok(m.x < 12.5, 'seven-tile visible targets can become alerted');
  assert.equal(p.life, engine.state.stats!.maxLife);
});

test('a distant monster hit by a real Fire Bolt becomes alerted without changing its stats', () => {
  const { engine, m } = controlFixture('spell'); m.x = 13.5;
  const initial = structuredClone(m);
  engine.dispatch({ type: 'attack', point: m, right: true });
  for (let i = 0; i < 40 && m.life === initial.life; i++) engine.step();
  assert.ok(m.life < initial.life, 'the projectile must actually hit outside the passive alert range');
  const hitX = m.x; engine.step();
  assert.ok(m.x < hitX);
  for (const key of ['maxLife', 'minDamage', 'maxDamage', 'defense', 'attackRating', 'experience', 'resists'] as const) assert.deepEqual(m[key], initial[key]);
});

for (const response of ['stand', 'retreat', 'wall', 'kill'] as const) test(`monster melee windup rechecks its target: ${response}`, () => {
  const { engine, p, m, area } = controlFixture();
  Object.assign(m, { cooldown: 0, minDamage: 10, maxDamage: 10, attackRating: 100000 });
  const life = p.life; engine.step();
  assert.equal(p.life, life); assert.equal(engine.state.events.at(-1)!.kind, 'attack');
  if (response === 'retreat') engine.setControl({ move: { x: -1, y: 0 } });
  if (response === 'wall') area.tiles[Math.floor(m.y)][Math.floor(m.x)] = 1;
  if (response === 'kill') { m.life = 100; engine.dispatch({ type: 'attack', point: m }); assert.equal(m.dead, true); }
  for (let i = 0; i < 5; i++) { engine.step(); assert.equal(p.life, life); }
  engine.step(); assert.equal(p.life, life - (response === 'stand' ? 10 : 0));
  if (response === 'retreat') assert.ok(Math.hypot(p.x - m.x, p.y - m.y) > 1.35);
  if (response === 'kill') {
    m.dead = false; m.life = m.maxLife; m.cooldown = 10000;
    for (let i = 0; i < 10; i++) engine.step();
    assert.equal(p.life, life, 'revival must not resume the discarded swing');
  }
});

test('approaching monsters retain spacing instead of stacking on the player', () => {
  const { engine, m, area } = controlFixture();
  area.monsters = [4.5, 5.5, 6.5, 7.5].map((y, i) => ({ ...structuredClone(m), uid: `crowd-${i}`, x: 8.5, y }));
  for (let frame = 0; frame < 100; frame++) {
    engine.step();
    for (let i = 0; i < area.monsters.length; i++) for (let j = i + 1; j < area.monsters.length; j++) {
      const a = area.monsters[i], b = area.monsters[j];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= .75 - 1e-9, 'live monsters cannot overlap while closing in');
    }
  }
  assert.ok(area.monsters.every(monster => monster.x < 8.5), 'spacing cannot freeze the entire group');
});

test('normal exit round trips use the matching entrance and preserve the visited battlefield', () => {
  const engine = new Engine(); engine.dispatch({ type: 'new', classId: 'pal', name: '往返测试' });
  const town = engine.state.area!;
  const walkExit = (targetArea: number) => {
    const exit = engine.state.area!.objects.find(o => o.kind === 'exit' && o.targetArea === targetArea)!;
    assert.ok(exit); engine.dispatch({ type: 'interact', uid: exit.uid });
    const arrival=engine.state.area!.objects.find(o=>o.kind==='exit' && o.regionId===targetArea && o.targetArea===(exit.regionId ?? engine.state.area!.def.id));
    for (let i = 0; i < 250 && (engine.state.area!.def.id !== targetArea || (exit.seam && arrival && Math.hypot(engine.state.player!.x-arrival.x,engine.state.player!.y-arrival.y)>.2)); i++) engine.step();
    assert.equal(engine.state.area!.def.id, targetArea);
    const p = engine.state.player!;
    assert.equal(p.dead, false);
  };
  walkExit(2); const moor = engine.state.area!, monster = moor.monsters[0];
  monster.life -= .5; const remaining = monster.life;
  const item = createItem('hp1', 1, seededRandom(42)); moor.drops.push({ item, x: moor.spawn.x, y: moor.spawn.y });
  walkExit(1); assert.equal(engine.state.area, town);
  walkExit(2); assert.equal(engine.state.area, moor); assert.equal(monster.life, remaining);
  assert.equal(moor.drops[0].item, item);
  const entrance = moor.objects.find(o => o.targetArea === 1)!, p = engine.state.player!;
  assert.ok(Math.hypot(p.x - entrance.x, p.y - entrance.y) < 4, 'returning from town appears beside the matching entrance');
});

test('monster drops remain reachable at walls without rerolling items or changing RNG consumption', () => {
  let dropped = 0, clamped = 0;
  for (let seed = 1; seed <= 32; seed++) {
    const { engine, p, m, area } = controlFixture();
    m.code = 'fallen1'; m.x = 6.02; m.y = 6.02;
    area.tiles[5][6] = 1; area.tiles[6][5] = 1;
    const reference = seededRandom(seed * 2654435761);
    const expected = rollLoot(m, reference, p.difficulty, engine.state.stats!.magicFind);
    for (let i = 0; i < expected.length; i++) { reference(); reference(); }
    const rng = seededRandom(seed * 2654435761);
    (engine as unknown as { rng: Rng }).rng = rng;
    m.life = 0; p.x = 6.5; p.y = 6.5;
    (engine as unknown as { kill: (monster: typeof m) => void }).kill(m);
    assert.equal(m.dead, true);
    const actual = area.drops.map(drop => drop.item);
    const omitUid = (item: typeof actual[number]) => { const { uid, ...rest } = item; return rest; };
    assert.deepEqual(actual.map(omitUid), expected.map(omitUid));
    assert.equal(rng(), reference(), 'placement consumes exactly the original two random values per item');
    for (const drop of area.drops) {
      assert.equal(area.tiles[Math.floor(drop.y)][Math.floor(drop.x)], 0);
      assert.ok(findPath(area, p, drop).length > 0, 'pickup route cannot cut through a blocked corner');
      dropped++;
      if (drop.x === m.x && drop.y === m.y) clamped++;
    }
  }
  assert.ok(dropped > 0); assert.ok(clamped > 0, 'seed set must exercise blocked placement');
});

test('a held spell kill levels up once, grants exact points and refills the newly derived caps', () => {
  const { engine, p, m } = controlFixture('spell'); p.experience = 490; p.life = 1; p.mana = 10; m.life = 3; m.maxLife = 3;
  engine.setControl({ right: true, aim: { x: m.x, y: m.y }, aimMonster: m.uid }); engine.step();
  assert.equal(m.life, 0); assert.equal(m.dead, true); assert.equal(p.experience, 530); assert.equal(p.level, 2);
  assert.equal(p.statPoints, 5); assert.equal(p.skillPoints, 1);
  assert.equal(p.life, 41); assert.equal(p.mana, 37);
  assert.equal(p.life, engine.state.stats!.maxLife); assert.equal(p.mana, engine.state.stats!.maxMana); assert.equal(p.stamina, engine.state.stats!.maxStamina);
  assert.deepEqual(engine.state.events.map(e => e.kind), ['cast', 'hurt', 'death']);
  engine.setControl({ right: false }); for (let i = 0; i < 25; i++) engine.step();
  assert.equal(p.experience, 530); assert.equal(p.level, 2); assert.equal(p.statPoints, 5); assert.equal(p.skillPoints, 1);
  assert.equal(engine.state.events.filter(e => e.kind === 'death').length, 1);
});

test('shaman revival emits revived actor and fire cast once, restoring life without granting XP', () => {
  const { engine, p, m, area } = controlFixture(); m.life = 100; m.maxLife = 100;
  const shaman = { ...structuredClone(m), uid: 'reviving-shaman', code: 'fallenshaman1', x: 8.5, ai: 'shaman' as const, cooldown: 0, minDamage: 0, maxDamage: 0, experience: 0 };
  area.monsters.push(shaman);
  engine.dispatch({ type: 'attack', point: { x: m.x, y: m.y } }); assert.equal(m.dead, true); assert.equal(p.experience, 40);
  const deathSeq = engine.state.eventSeq; engine.step();
  assert.equal(m.dead, false); assert.equal(m.life, m.maxLife); assert.equal(shaman.cooldown, 75); assert.equal(p.experience, 40);
  assert.deepEqual(engine.state.events.filter(e => e.seq > deathSeq), [
    { seq: deathSeq + 1, tick: 1, actor: m.uid, kind: 'revive', x: m.x, y: m.y, tx: m.x, ty: m.y, element: 'physical' },
    { seq: deathSeq + 2, tick: 1, actor: shaman.uid, kind: 'cast', x: shaman.x, y: shaman.y, tx: m.x, ty: m.y, element: 'fire' },
  ]);
  for (let i = 0; i < 74; i++) engine.step();
  assert.equal(engine.state.events.filter(e => e.kind === 'revive').length, 1); assert.equal(p.experience, 40);
});

test('shamans do not revive consumed, non-Fallen, shaman, champion, boss, or out-of-range corpses', () => {
  for (const scenario of ['consumed', 'non-Fallen', 'shaman', 'champion', 'boss', 'superunique-shaman', 'out-of-range'] as const) {
    const { engine, p, m, area } = controlFixture(); m.life = 0; m.dead = true;
    const shaman = { ...structuredClone(m), uid: 'ineligible-shaman', code: 'fallenshaman1', x: 8.5, ai: 'shaman' as const, dead: false, life: 100, cooldown: 0, minDamage: 0, maxDamage: 0 };
    if (scenario === 'consumed') m.poisonFrames = -1;
    if (scenario === 'non-Fallen') m.code = 'skeleton1';
    if (scenario === 'shaman' || scenario === 'superunique-shaman') { m.code = 'fallenshaman1'; m.ai = 'shaman'; }
    if (scenario === 'champion') m.champion = true;
    if (scenario === 'boss' || scenario === 'superunique-shaman') m.boss = true;
    if (scenario === 'superunique-shaman') { m.name = '毕须博须'; m.modifiers = ['superunique:Bishibosh']; }
    if (scenario === 'out-of-range') m.x = 16;
    area.monsters.push(shaman); engine.step();
    assert.equal(m.dead, true, scenario); assert.equal(m.life, 0, scenario);
    assert.equal(engine.state.events.filter(e => e.kind === 'revive').length, 0, scenario); assert.equal(p.experience, 0);
  }
});

test('each ordinary Fallen variant can revive without receiving new kill rewards', () => {
  let dropCount = 0;
  for (let variant = 1; variant <= 5; variant++) {
    const { engine, p, m, area } = controlFixture();
    m.code = `fallen${variant}`; m.life = 0;
    const shaman = { ...structuredClone(m), uid: 'reward-shaman', code: `fallenshaman${variant}`, x: 8.5, ai: 'shaman' as const, dead: false, life: 100, maxLife: 100, cooldown: 0, minDamage: 0, maxDamage: 0 };
    area.monsters.push(shaman);
    let calls = 0;
    const rng = seededRandom(variant * 92831);
    (engine as unknown as { rng: Rng }).rng = () => { calls++; return rng(); };
    const kill = () => { m.life = 0; (engine as unknown as { kill: (monster: typeof m) => void }).kill(m); };
    kill();
    const first = { experience: p.experience, level: p.level, statPoints: p.statPoints, skillPoints: p.skillPoints, drops: structuredClone(area.drops), gold: p.gold, calls };
    assert.equal(first.experience, 40); assert.ok(first.calls > 0); dropCount += first.drops.length;
    for (let repeat = 0; repeat < 3; repeat++) {
      shaman.cooldown = 0; engine.step();
      assert.equal(m.dead, false); assert.equal(m.life, m.maxLife);
      kill();
      assert.equal(m.dead, true); assert.equal(p.experience, first.experience); assert.equal(p.level, first.level);
      assert.equal(p.statPoints, first.statPoints); assert.equal(p.skillPoints, first.skillPoints);
      assert.deepEqual(area.drops.filter(d => d.item.code !== 'gld'), first.drops.filter(d => d.item.code !== 'gld'));
      assert.equal(p.gold + area.drops.filter(d => d.item.code === 'gld').reduce((sum, d) => sum + d.item.quantity, 0), first.gold + first.drops.filter(d => d.item.code === 'gld').reduce((sum, d) => sum + d.item.quantity, 0), 'automatic pickup conserves the first reward, never awards another');
      assert.equal(calls, first.calls, 'repeat deaths cannot roll loot or consume its RNG');
    }
    assert.equal(engine.state.events.filter(e => e.actor === m.uid && e.kind === 'death').length, 4);
    assert.equal(engine.state.events.filter(e => e.actor === m.uid && e.kind === 'revive').length, 3);
  }
  assert.ok(dropCount > 0, 'the seed set must cover real first-kill loot');
});

test('player death emits once, gates held controls and respawns with restored caps and preserved corpse', () => {
  const { engine, p, m, weapon, area } = controlFixture();
  p.life = 1; p.gold = 100; p.experience = 123;
  Object.assign(m, { cooldown: 0, minDamage: 10, maxDamage: 10, attackRating: 100000 });
  assert.equal(engine.state.stats!.block, 0);
  for (let i = 0; i < 6; i++) { engine.step(); assert.equal(p.dead, false); assert.equal(p.life, 1); }
  engine.step();
  assert.deepEqual(engine.state.events.map(e => [e.actor, e.kind, e.tick]), [[m.uid, 'attack', 1], ['player', 'hurt', 7], ['player', 'death', 7]]);
  assert.equal(p.life, 0); assert.equal(p.dead, true); assert.equal(p.experience, 123, 'normal death does not subtract XP');
  assert.equal(p.gold, 0); assert.deepEqual(area.drops.filter(d => d.item.code === 'gld').map(d => d.item.quantity), [99]);
  assert.deepEqual(p.equipment, {}); assert.equal(p.corpse!.equipment.weapon!.uid, weapon.uid); assert.equal(p.corpse!.areaId, 2);
  assert.equal(area.objects.filter(o => o.kind === 'corpse').length, 1);
  engine.setControl({ move: { x: 1, y: 1 }, left: true, right: true, aim: { x: m.x, y: m.y }, aimMonster: m.uid });
  const frozen = structuredClone(engine.state);
  for (let i = 0; i < 30; i++) engine.step(); assert.deepEqual(engine.state, frozen, 'dead controls cannot progress combat or regeneration');
  engine.dispatch({ type: 'attack', point: { x: m.x, y: m.y } }); assert.deepEqual(engine.state, frozen);
  engine.setControl({ move: { x: 0, y: 0 }, left: false, right: false });
  const seq = engine.state.eventSeq; engine.dispatch({ type: 'respawn' });
  assert.equal(p.dead, false); assert.equal(engine.state.area!.def.id, 1);
  assert.equal(p.life, engine.state.stats!.maxLife); assert.equal(p.mana, engine.state.stats!.maxMana); assert.equal(p.stamina, engine.state.stats!.maxStamina);
  assert.equal(p.experience, 123); assert.equal(p.corpse!.equipment.weapon!.uid, weapon.uid);
  assert.deepEqual(engine.state.events, []); assert.equal(engine.state.eventSeq, seq);
});

test('combat event buffer retains exactly the newest 64 events in monotonically increasing order', () => {
  const { engine, p, area, weapon } = controlFixture(); area.monsters = [];
  weapon.mods.ias = 300; engine.state.stats = deriveStats(p);
  engine.setControl({ left: true, aim: { x: 8.5, y: 5.5 } });
  for (let frame = 1; frame <= 326; frame++) {
    engine.step(); const emitted = Math.floor((frame - 1) / 5) + 1;
    assert.equal(engine.state.eventSeq, emitted); assert.equal(engine.state.events.length, Math.min(64, emitted));
    const first = Math.max(1, emitted - 63);
    assert.deepEqual(engine.state.events.map(e => e.seq), Array.from({ length: Math.min(64, emitted) }, (_, i) => first + i));
    assert.ok(engine.state.events.every(e => e.tick === 1 + (e.seq - 1) * 5 && e.actor === 'player' && e.kind === 'attack'));
    assert.equal(p.experience, 0);
  }
  assert.equal(engine.state.events[0].seq, 3); assert.equal(engine.state.eventSeq, 66);
});

test('area transitions clear transient combat state without resetting event sequence numbers', () => {
  const { engine, p, m, area } = controlFixture('spell'); engine.state.seed = 123;
  engine.setControl({ right: true, aim: { x: m.x, y: m.y }, aimMonster: m.uid }); engine.step();
  engine.setControl({ right: false }); for (let i = 0; i < 13; i++) engine.step();
  engine.setControl({ right: true, aim: { x: 1.5, y: 5.5 }, aimMonster: null }); engine.step();
  assert.ok(engine.state.projectiles.length > 0); assert.ok(engine.state.effects.length > 0); assert.ok(engine.state.events.length > 0);
  engine.state.summons.push({ uid: 'transient-summon', name: '测试召唤物', x: p.x, y: p.y, life: 10, maxLife: 10, min: 1, max: 1, cooldown: 0, duration: 25, color: '#fff' });
  engine.state.selectedItem = 'transient-item'; engine.dispatch({ type: 'panel', panel: 'inventory' });
  area.objects.push({ uid: 'controlled-exit', kind: 'exit', name: '返回营地', x: p.x, y: p.y, targetArea: 1 });
  engine.setControl({ right: false }); const seq = engine.state.eventSeq;
  engine.dispatch({ type: 'travel', areaId: 1 });
  assert.equal(engine.state.area!.def.id, 1); assert.equal(engine.state.events.length, 0); assert.equal(engine.state.eventSeq, seq);
  assert.deepEqual(engine.state.projectiles, []); assert.deepEqual(engine.state.effects, []); assert.deepEqual(engine.state.summons, []);
  assert.equal(engine.state.selectedMonster, null); assert.equal(engine.state.selectedItem, null); assert.equal(engine.state.target, null);
  assert.equal(engine.state.panel, 'none'); assert.equal(engine.state.moving, false);
  const exit = engine.state.area!.objects.find(o => o.kind === 'exit' && o.regionId===1 && o.targetArea === 2)!;
  const nextArea = engine.state.area!; nextArea.monsters = [];
  const arrival=nextArea.objects.find(o=>o.kind==='exit' && o.regionId===2 && o.targetArea===1)!;
  engine.dispatch({ type: 'interact', uid: exit.uid });
  assert.equal(engine.state.area!.def.id,1,'a surface sign cannot instantly teleport');
  for (let i=0;i<250 && Math.hypot(p.x-arrival.x,p.y-arrival.y)>.2;i++) engine.step();
  assert.equal(engine.state.area!.def.id,2);assert.equal(engine.state.area,nextArea);
  engine.setControl({ left: true, aim: { x: p.x+1, y: p.y }, aimMonster: null }); engine.step();
  assert.equal(engine.state.events.length, 1); assert.equal(engine.state.events[0].seq, seq + 1);
  assert.equal(engine.state.events[0].kind, 'attack'); assert.equal(engine.state.eventSeq, seq + 1);
});

function mapTravelFixture(surface = false) {
  const engine = new Engine(), p = createPlayer('sor', '隔离地图旅行');
  const town = createArea(1, 'normal', 123, p);
  const floor = (width: number, height: number) => ({width, height, tiles:Array.from({length:height},()=>Array(width).fill(0)), revealed:Array.from({length:height},()=>Array(width).fill(false))});
  Object.assign(town, floor(80, 34), {spawn:{x:50,y:16}, objects:[], monsters:[], drops:[]});
  const field = {...town, ...floor(20,20), def:getArea(8), spawn:{x:3.5,y:5.5}, objects:[], monsters:[], drops:[]} as typeof town;
  const world = {...town, ...floor(80,34), objects:[], monsters:[], drops:[], regions:[
    {def:getArea(1),x:40,y:2,width:34,height:28,spawn:{x:50,y:16},seed:123},
    {def:getArea(2),x:2,y:2,width:24,height:28,spawn:{x:4.5,y:8.5},seed:123},
  ]} as typeof town;
  const access = engine as unknown as {
    areas:Map<number,typeof town>; enterArea(id:number,position?:{x:number;y:number},atSpawn?:boolean,sourceId?:number):void;
    syncCorpse(area:typeof town):void; die():void; updateSurfaceRegion():void; runtimeRevision:number;
    path:{x:number;y:number}[]; attackTarget:unknown; pendingInteraction:unknown; vendorStocks:Map<string,unknown[]>;
    portal:{point:{x:number;y:number}}|null;
  };
  access.areas.set(1,surface?world:town); access.areas.set(2,world); access.areas.set(8,field);
  Object.assign(engine.state,{player:p,area:surface?world:field,stats:deriveStats(p),screen:'game',seed:123});
  const id=surface?2:8, area=surface?world:field;
  access.enterArea(id,undefined,true);
  const owned = (point:{x:number;y:number}, target=id) => !area.regions ? area.def.id===target : surfaceRegionAt(area,point)?.def.id===target;
  const assertReachable = (point:{x:number;y:number}, target=id) => {
    assert.ok(owned(point,target)); assert.equal(area.tiles[Math.floor(point.y)]?.[Math.floor(point.x)],0);
    assert.ok(findPath(area,getSurfaceRegion(area,target)?.spawn ?? area.spawn,point).length);
  };
  const corpse = (areaId:number, point:{x:number;y:number}) => {
    const item=createItem('jav',1,()=>.5); Object.assign(item,{uid:'fixture-corpse-weapon',quantity:17,durability:3,mods:{life:11,attackRating:19}});
    p.corpse={areaId,...point,equipment:{weapon:item}}; return {equipment:p.corpse.equipment,item,snapshot:structuredClone(p.corpse.equipment)};
  };
  return {engine,p,town,world,field,area,id,access,owned,assertReachable,corpse};
}

for (const surface of [false,true]) test(`map travel cache retains area and entity identity on town round trip (surface=${surface})`,()=>{
  const {engine,area,id,access}=mapTravelFixture(surface);
  const chest:WorldObject={uid:'used-travel-chest',kind:'chest',name:'箱子',x:6,y:6,used:true,regionId:id};
  const drop={item:createItem('cm1',1,()=>.5),x:7,y:7};
  const dead={uid:'travel-dead-monster',dead:true,x:8,y:8,life:0} as typeof area.monsters[number];
  area.objects.push(chest); area.drops.push(drop); area.monsters.push(dead);
  const objects=area.objects,drops=area.drops,monsters=area.monsters,snapshot=structuredClone({chest,drop,dead});
  access.enterArea(1,undefined,true); access.enterArea(id,undefined,true);
  assert.equal(engine.state.area,area); assert.equal(area.objects,objects); assert.equal(area.drops,drops); assert.equal(area.monsters,monsters);
  assert.equal(area.objects[0],chest); assert.equal(area.drops[0],drop); assert.equal(area.monsters[0],dead); assert.deepEqual({chest,drop,dead},snapshot);
});

for (const fault of ['valid','wall','bounds','unreachable'] as const) test(`map travel underground corpse validates ${fault} without changing equipment`,()=>{
  const {p,area,access,corpse,assertReachable}=mapTravelFixture();
  const point=fault==='bounds'?{x:200,y:-1}:{x:10.25,y:10.75};
  if(fault==='wall') area.tiles[10][10]=1;
  if(fault==='unreachable') for(let y=0;y<area.height;y++) area.tiles[y][8]=1;
  const before=corpse(8,point); access.syncCorpse(area);
  assertReachable(p.corpse!); assert.deepEqual(p.corpse!.equipment,before.snapshot); assert.equal(p.corpse!.equipment,before.equipment); assert.equal(p.corpse!.equipment.weapon,before.item);
  if(fault==='valid') assert.deepEqual({x:p.corpse!.x,y:p.corpse!.y},point);
  else assert.deepEqual({x:p.corpse!.x,y:p.corpse!.y},area.spawn);
  const object=area.objects.find(o=>o.kind==='corpse')!; access.syncCorpse(area); assert.equal(area.objects.length,1); assert.equal(area.objects[0],object);
});

for (const fault of ['valid','wall','bounds','wrong-region','unreachable'] as const) test(`map travel legacy local corpse converts once and repairs ${fault} without reroll`,()=>{
  const {p,area,access,corpse,assertReachable}=mapTravelFixture(true), region=getSurfaceRegion(area,1)!;
  const localMap=createArea(1,'normal',region.seed,p), local={x:localMap.spawn.x+1,y:localMap.spawn.y}, converted={x:local.x+region.x,y:local.y+region.y};
  assert.equal(localMap.tiles[Math.floor(local.y)][Math.floor(local.x)],0);
  if(fault==='wall') area.tiles[Math.floor(converted.y)][Math.floor(converted.x)]=1;
  if(fault==='bounds') region.x=75;
  if(fault==='wrong-region') { region.width=5; area.regions!.push({...getSurfaceRegion(area,2)!,def:getArea(3),x:48,y:14,width:8,height:8}); }
  if(fault==='unreachable') { for(let y=14;y<=18;y++) for(let x=48;x<=52;x++) if(x===48||x===52||y===14||y===18) area.tiles[y][x]=1; region.spawn={x:44.5,y:8.5}; }
  if(fault==='bounds'||fault==='wrong-region') region.spawn={x:region.x+.5,y:8.5};
  const before=corpse(1,local); access.syncCorpse(area); assertReachable(p.corpse!,1);
  assert.deepEqual(p.corpse!.equipment,before.snapshot); assert.equal(p.corpse!.equipment,before.equipment); assert.equal(p.corpse!.equipment.weapon,before.item);
  assert.deepEqual({x:p.corpse!.x,y:p.corpse!.y},fault==='valid'?converted:region.spawn);
  const point={x:p.corpse!.x,y:p.corpse!.y}; access.syncCorpse(area); assert.deepEqual({x:p.corpse!.x,y:p.corpse!.y},point);
});

test('map travel never inserts a corpse into an unrelated underground map or missing surface region',()=>{
  const {p,area,world,access,corpse}=mapTravelFixture(); corpse(9,{x:5,y:5}); const before=structuredClone(p.corpse);
  access.syncCorpse(area); access.syncCorpse(world); assert.deepEqual(p.corpse,before); assert.equal(area.objects.length,0); assert.equal(world.objects.length,0);
});

test('map travel accepts exact global road-gap corpse and explicit return positions',()=>{
  const {p,area,access,corpse,assertReachable}=mapTravelFixture(true), region=getSurfaceRegion(area,2)!;
  const point={x:26.25,y:8.75}; assert.equal(containsRegion(region,point),false); assertReachable(point);
  const before=corpse(2,point); access.syncCorpse(area); access.enterArea(2,point);
  assert.deepEqual({x:p.x,y:p.y},point); assert.deepEqual({x:p.corpse!.x,y:p.corpse!.y},point);
  assert.equal(p.corpse!.equipment,before.equipment); assert.equal(p.corpse!.equipment.weapon,before.item); assert.deepEqual(p.corpse!.equipment,before.snapshot);
});

for(const fault of ['wrong-region','wall','bounds','unreachable'] as const) test(`map travel explicit ${fault} position falls back to target spawn`,()=>{
  const {p,area,access,assertReachable}=mapTravelFixture(true), spawn=getSurfaceRegion(area,2)!.spawn;
  const point=fault==='wrong-region'?getSurfaceRegion(area,1)!.spawn:fault==='bounds'?{x:90,y:40}:{x:10.25,y:8.75};
  if(fault==='wall') area.tiles[8][10]=1;
  if(fault==='unreachable') for(let y=0;y<area.height;y++) area.tiles[y][8]=1;
  access.enterArea(2,point); assert.deepEqual({x:p.x,y:p.y},spawn); assertReachable(p);
});

for(const fault of ['valid','wrong-region','wall','unreachable','isolated-candidates'] as const) test(`map travel back gate uses only owned reachable landing ground (${fault})`,()=>{
  const {p,area,access,assertReachable}=mapTravelFixture(true), region=getSurfaceRegion(area,2)!;
  const point=fault==='wrong-region'?getSurfaceRegion(area,1)!.spawn:{x:10,y:10};
  const gate:WorldObject={uid:'travel-back-gate',kind:'exit',name:'返回',targetArea:8,regionId:2,...point}; area.objects.push(gate);
  if(fault==='wall') area.tiles[10][10]=1;
  if(fault==='unreachable') for(let y=0;y<area.height;y++) area.tiles[y][8]=1;
  if(fault==='isolated-candidates') {
    for(let y=0;y<area.height;y++) for(let x=0;x<area.width;x++) area.tiles[y][x]=1;
    for(let x=4;x<=10;x++) area.tiles[8][x]=0; area.tiles[9][10]=area.tiles[10][10]=0;
    const dx=region.x+region.width/2-gate.x,dy=region.y+region.height/2-gate.y,len=Math.hypot(dx,dy);
    for(const r of [2.2,1.6,1.1,3]) area.tiles[Math.floor(gate.y+.5+dy/len*r)][Math.floor(gate.x+.5+dx/len*r)]=0;
  }
  access.enterArea(2,undefined,false,8); assertReachable(p);
  if(fault==='valid') assert.notDeepEqual({x:p.x,y:p.y},region.spawn); else assert.deepEqual({x:p.x,y:p.y},region.spawn);
});

for(const scenario of ['preferred','narrow-wall','region-edge','road-gap','shrine'] as const) test(`map travel blue portal stays clickable and returns exact origin (${scenario})`,()=>{
  const surface=scenario==='region-edge'||scenario==='road-gap';
  const {engine,p,area,id,access,owned,assertReachable}=mapTravelFixture(surface);
  if(scenario==='narrow-wall') { Object.assign(p,{x:5.8,y:10.5}); for(let y=0;y<area.height;y++) for(let x=0;x<area.width;x++) area.tiles[y][x]=x===5?0:1; area.spawn={x:5.5,y:5.5}; }
  if(scenario==='road-gap') Object.assign(p,{x:26.25,y:8.75});
  if(scenario==='region-edge') {
    const point=Array.from({length:320},(_,i)=>({x:i/4,y:8.5})).find(point=>owned(point)&&!owned({x:point.x+.7,y:point.y})); assert.ok(point); Object.assign(p,point);
  }
  const origin={x:p.x,y:p.y}, tome=createItem('tbk',1,()=>.5); tome.quantity=3; p.inventory=[tome];
  if(scenario==='shrine') { const shrine:WorldObject={uid:'travel-free-shrine',kind:'shrine',name:'传送神龛',shrineCode:17,...origin}; area.objects.push(shrine); engine.dispatch({type:'interact',uid:shrine.uid}); }
  else engine.dispatch({type:'portal'});
  assert.equal(tome.quantity,scenario==='shrine'?3:2); assert.deepEqual(access.portal!.point,origin);
  const source=area.objects.find(o=>o.kind==='portal')!; assertReachable(source);
  assert.deepEqual({x:source.x,y:source.y},scenario==='narrow-wall'||scenario==='region-edge'?origin:{x:origin.x+.7,y:origin.y});
  Object.assign(p,area.spawn); const revision=access.runtimeRevision; engine.dispatch({type:'interact',uid:source.uid});
  for(let frame=0;frame<300&&access.runtimeRevision===revision;frame++) engine.step();
  assert.equal(engine.state.area!.def.id,1); const town=engine.state.area!, back=town.objects.find(o=>o.kind==='portal'&&o.targetArea===id)!;
  assert.equal(town.tiles[Math.floor(back.y)][Math.floor(back.x)],0); assert.equal(surfaceRegionAt(town,back)?.def.id ?? town.def.id,1); assert.ok(findPath(town,town.spawn,back).length);
  Object.assign(p,{x:back.x,y:back.y}); engine.dispatch({type:'interact',uid:back.uid});
  assert.equal(engine.state.area,area); assert.equal(area.def.id,id); assert.deepEqual({x:p.x,y:p.y},origin); assert.equal(access.portal,null);
  assert.equal(area.objects.filter(o=>o.kind==='portal').length,0); assert.equal(town.objects.filter(o=>o.kind==='portal').length,0);
});

for(const surface of [false,true]) test(`map travel death town return allows exact corpse recovery (surface=${surface})`,()=>{
  const {engine,p,area,id,access,corpse}=mapTravelFixture(surface), origin={x:p.x,y:p.y};
  const before=corpse(id,origin); p.equipment=before.equipment; p.corpse=undefined; access.die();
  const object=area.objects.find(o=>o.kind==='corpse')!; engine.dispatch({type:'respawn'}); assert.equal(engine.state.area!.def.id,1);
  access.enterArea(id,origin); assert.equal(engine.state.area,area); assert.equal(area.objects.find(o=>o.kind==='corpse'),object);
  engine.dispatch({type:'interact',uid:object.uid}); assert.equal(p.corpse,undefined); assert.equal(p.equipment.weapon,before.item); assert.deepEqual(p.equipment,before.snapshot);
  assert.equal(area.objects.filter(o=>o.kind==='corpse').length,0);
});

test('map travel continuous seam preserves route attack pending state and revision while town entry refreshes shops',()=>{
  const {engine,p,area,access}=mapTravelFixture(true), path=[{x:5,y:9}], attack={point:{x:7,y:9},right:false}, pending={uid:'route-item',pickup:true};
  access.path=path; access.attackTarget=attack; access.pendingInteraction=pending; access.vendorStocks.set('akara',[{}]);
  const revision=access.runtimeRevision; Object.assign(p,getSurfaceRegion(area,1)!.spawn); access.updateSurfaceRegion();
  assert.equal(area.def.id,1); assert.equal(engine.state.area,area); assert.equal(access.runtimeRevision,revision);
  assert.equal(access.path,path); assert.equal(access.attackTarget,attack); assert.equal(access.pendingInteraction,pending); assert.equal(access.vendorStocks.size,0);
  access.enterArea(2,undefined,true); access.vendorStocks.set('akara',[{}]); access.enterArea(1,undefined,true);
  assert.equal(access.runtimeRevision,revision+2); assert.deepEqual(access.path,[]); assert.equal(access.attackTarget,null); assert.equal(access.pendingInteraction,null); assert.equal(access.vendorStocks.size,0);
});
