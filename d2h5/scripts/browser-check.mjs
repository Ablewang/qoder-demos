import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({headless:true});
const output = new URL('../docs/screenshots/', import.meta.url).pathname;
assert.ok((await stat(output)).isDirectory(), 'Use the existing docs/screenshots directory');
const errors=[];
const context=await browser.newContext({viewport:{width:1440,height:900}});
await context.addInitScript(()=>{Date.now=()=>1794902400000;});
const page=await context.newPage();
await page.addInitScript(() => {
  window.__openingCanvasDraws = 0;
  for (const method of ['drawImage', 'fillRect']) {
    const original = CanvasRenderingContext2D.prototype[method];
    CanvasRenderingContext2D.prototype[method] = function (...args) {
      // Renderer3D draws 2D labels on its overlay, not the WebGL world canvas.
      if (this.canvas === window.sanctuary?.renderer.overlayCanvas) window.__openingCanvasDraws++;
      return original.apply(this, args);
    };
  }
});
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
const game = () => page.evaluate(() => {
  const {state}=window.sanctuary.engine;
  return {screen:state.screen,areaId:state.area?.def.id,player:state.player,stats:state.stats,monsters:state.area?.monsters,drops:state.area?.drops,objects:state.area?.objects,panel:state.panel,messages:state.messages};
});
const point = obj => page.evaluate(obj => window.sanctuary.renderer.worldToScreen(obj,0),obj);
const holdMouse = async (target, xy, button = 'right', until) => {
  await target.mouse.move(xy.x,xy.y);await target.mouse.down({button});
  try {
    if(until)await target.waitForFunction(until,undefined,{timeout:10000});
    else await target.waitForTimeout(620); // Longer than the 0.52s sorceress shot/cooldown.
  } finally {await target.mouse.up({button});}
};
// Town ground still supports real click-to-walk. Advance via visible clear ground
// along the engine's legal path; never teleport/grant gear or click field ground to move.
const approachTownObject = async (target, uid, mobile = false) => {
  for(let step=0;step<30;step++) {
    await target.waitForFunction(()=>window.sanctuary.renderer.groundArea===window.sanctuary.engine.state.area);
    const approach=await target.evaluate(async uid=>{
      const {engine,renderer,ui}=window.sanctuary,{area,player}=engine.state;
      if(!area.def.town)throw new Error('Town click-to-walk helper cannot move in the field');
      const object=area.objects.find(o=>o.uid===uid);if(!object)throw new Error('Missing town interaction target');
      const visible=p=>p.x>=0&&p.x<innerWidth&&p.y>=0&&p.y<innerHeight&&document.elementFromPoint(p.x,p.y)===ui.canvas;
      const stone=renderer.worldToScreen(object,0);
      if(visible(stone)&&ui.pick(stone.x,stone.y)?.uid===uid)return {done:true};
      const {findPath}=await import('/src/engine.ts'),path=findPath(area,player,object);
      const ground=path.filter(p=>Math.hypot(p.x-player.x,p.y-player.y)>.8&&Math.hypot(p.x-player.x,p.y-player.y)<6)
        .map(p=>({world:p,screen:renderer.worldToScreen(p,0)})).reverse().find(p=>visible(p.screen)&&!ui.pick(p.screen.x,p.screen.y));
      if(!ground)throw new Error('No visible clear ground along legal town approach path');
      return ground;
    },uid);
    if(approach.done)return;
    if(mobile)await target.touchscreen.tap(approach.screen.x,approach.screen.y);
    else await target.mouse.click(approach.screen.x,approach.screen.y);
    await target.waitForFunction(p=>Math.hypot(window.sanctuary.engine.state.player.x-p.x,window.sanctuary.engine.state.player.y-p.y)<.25,approach.world,{timeout:10000});
  }
  throw new Error('Town object remains inaccessible after 30 legal approach clicks');
};
const savedCharacters = target => target.evaluate(async () => {
  const db = await new Promise((resolve, reject) => { const request = indexedDB.open('sanctuary-h5', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  const records = await new Promise((resolve, reject) => { const request = db.transaction('characters').objectStore('characters').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  db.close();
  return records.filter(record => !record.deleted).map(record => ({id:record.id, name:record.player.name, classId:record.player.classId, gold:record.player.gold, inventory:record.player.inventory}));
});
const verifyArt = target => target.evaluate(async () => {
  const manifest = await (await fetch('/art/manifest.json')).json();
  await Promise.all(Object.entries(manifest).map(([key, entry]) => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => image.naturalWidth === entry.width && image.naturalHeight === entry.height ? resolve() : reject(new Error(`Asset dimensions mismatch: ${key}`));
    image.onerror = () => reject(new Error(`Missing original asset: ${key}`)); image.src = `/art/${entry.file}`;
  })));
  return Object.keys(manifest).length;
});
const enterRoster = async (page, skip = true) => {
  if (skip) await page.getByRole('button',{name:'跳过动画',exact:true}).click();
  await page.getByRole('button',{name:'开始游戏',exact:true}).click();
  await page.waitForFunction(()=>window.sanctuary.engine.state.storageStatus!=='loading');
  await page.locator('.character-screen').waitFor();
};
const verifyWaypointTabs = async mobile => {
  const ctx = await browser.newContext({viewport:mobile ? {width:390,height:844} : {width:1440,height:900},deviceScaleFactor:mobile ? 2 : 1,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  await ctx.addInitScript(()=>{Date.now=()=>1794902400000;});
  const wp = await ctx.newPage();
  wp.on('pageerror',e=>errors.push(`waypoint ${mobile ? 'mobile' : 'desktop'}: ${e.message}`));
  wp.on('console',m=>{if(m.type()==='error')errors.push(`waypoint: ${m.text()}`);});
  const activate = locator => mobile ? locator.tap() : locator.click();
  const openStone = async () => {
    await wp.waitForFunction(()=>window.sanctuary.renderer.groundArea===window.sanctuary.engine.state.area);
    const waypointUid=await wp.evaluate(()=>window.sanctuary.engine.state.area.objects.find(o=>o.kind==='waypoint').uid);
    await approachTownObject(wp,waypointUid,mobile);
    const stone = await wp.evaluate(()=>{
      const {engine,renderer}=window.sanctuary;
      const object=engine.state.area.objects.find(o=>o.kind==='waypoint');
      const point=renderer.worldToScreen(object);
      if(window.sanctuary.ui.pick(point.x,point.y)?.uid!==object.uid)throw new Error('Stone point does not target the real waypoint');
      return point;
    });
    if(mobile)await wp.touchscreen.tap(stone.x,stone.y);else await wp.mouse.click(stone.x,stone.y);
    await wp.locator('.panel-waypoint').waitFor();
  };
  const snapshot = () => wp.evaluate(async()=>{
    const {state}=window.sanctuary.engine;
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('sanctuary-h5',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const records=await new Promise((resolve,reject)=>{const r=db.transaction('characters').objectStore('characters').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();
    return {player:structuredClone(state.player),activeSaveId:state.activeSaveId,areaId:state.area.def.id,automap:state.automap,records,localStorage:{...localStorage}};
  });
  try {
    await wp.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});await enterRoster(wp,false);
    await activate(wp.getByRole('button',{name:'新建角色',exact:true}));
    await activate(wp.locator('[data-class="sor"]'));await wp.locator('#hero-name').fill('传送页签验收');
    await activate(wp.getByRole('button',{name:'开启旅程',exact:true}));
    await wp.waitForFunction(()=>window.sanctuary.engine.state.screen==='game'&&window.sanctuary.engine.state.saved);
    await openStone();
    // Persist the approach before checking that browsing does not mutate storage.
    await wp.evaluate(()=>window.sanctuary.engine.save(false));
    const labels=['第一幕','第二幕','第三幕','第四幕','第五幕'];
    assert.deepEqual(await wp.getByRole('tab').allTextContents(),labels);
    assert.equal(await wp.getByRole('tab',{name:'第一幕',selected:true}).count(),1);
    const before=await snapshot();
    assert.deepEqual(before.records.find(record=>record.id===before.activeSaveId).player,before.player);
    const expected=await wp.evaluate(async()=>{const {AREAS}=await import('/src/world.ts');return [1,2,3,4,5].map(act=>AREAS.filter(a=>a.act===act&&a.waypoint).map(a=>({id:a.id,name:a.name})));});
    assert.deepEqual(expected.map(a=>a.length),[9,9,9,3,9]);
    for(const [index,label] of labels.entries()) {
      await activate(wp.getByRole('tab',{name:label,exact:true}));
      await wp.waitForFunction(index=>document.querySelector(`[role="tab"][aria-selected="true"]`)?.id===`waypoint-tab-${index+1}`,index);
      assert.equal(await wp.getByRole('tabpanel').count(),1);
      assert.deepEqual(await wp.locator('.waypoint-button').evaluateAll(nodes=>nodes.map(node=>({id:Number(node.dataset.area),name:node.textContent.split(' · ')[0]}))),expected[index]);
      assert.equal(await wp.locator('.waypoint-button:not(:disabled)').count(),0);
      if(index>0)assert.match(await wp.getByRole('tabpanel').innerText(),/未解锁，仅可查看/);
    }
    assert.deepEqual(await snapshot(),before);
    if(!mobile) {
      await wp.getByRole('tab',{name:'第五幕'}).focus();
      for(const [key,label] of [['ArrowRight','第一幕'],['ArrowLeft','第五幕'],['Home','第一幕'],['End','第五幕']]) {
        await wp.keyboard.press(key);
        assert.equal(await wp.getByRole('tab',{name:label,selected:true}).count(),1);
        assert.equal(await wp.getByRole('tab',{name:label}).evaluate(node=>node===document.activeElement),true);
      }
      await wp.keyboard.press('Tab');
      assert.equal(await wp.getByRole('tabpanel').evaluate(node=>node===document.activeElement),true);
      assert.deepEqual(await snapshot(),before);
    }
    await activate(wp.getByRole('tab',{name:'第一幕',exact:true}));
    assert.match(await wp.locator('.waypoint-button.active').innerText(),/罗格营地\s+· 当前位置/);
    await wp.screenshot({path:output+(mobile ? '29-mobile-waypoint-tabs.png' : '28-desktop-waypoint-tabs.png')});
    if(mobile) {
      await wp.setViewportSize({width:320,height:568});
      for(const label of labels) {
        const bounds=await wp.getByRole('tab',{name:label}).boundingBox();
        assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=320&&bounds.y>=0&&bounds.y+bounds.height<=568&&bounds.height>=44);
      }
      assert.equal(await wp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await activate(wp.getByRole('tab',{name:'第五幕',exact:true}));
      assert.equal(await wp.locator('.waypoint-button').count(),9);
      await wp.setViewportSize({width:390,height:844});
    }
    await activate(wp.locator('.panel-waypoint .close-button'));
    await wp.locator('.panel-waypoint').waitFor({state:'detached'});await openStone();
    assert.equal(await wp.getByRole('tab',{name:'第一幕',selected:true}).count(),1);
    // Explicit discovery/current-act fixtures do not represent normal campaign progression.
    await wp.evaluate(()=>{window.sanctuary.engine.state.player.waypoints.push(3);});
    await wp.locator('.waypoint-button[data-area="3"]:not(:disabled)').waitFor();
    await wp.evaluate(()=>{window.sanctuary.engine.state.player.x+=8;});
    await activate(wp.locator('.waypoint-button[data-area="3"]'));
    assert.equal(await wp.evaluate(()=>window.sanctuary.engine.state.area.def.id),1);
    assert.equal(await wp.evaluate(()=>window.sanctuary.engine.state.panel),'waypoint');
    assert.match(await wp.evaluate(()=>window.sanctuary.engine.state.messages.at(-1).text),/必须站在传送点旁/);
    await wp.evaluate(position=>{Object.assign(window.sanctuary.engine.state.player,position);},{x:before.player.x,y:before.player.y});
    await activate(wp.locator('.waypoint-button[data-area="3"]'));
    await wp.waitForFunction(()=>window.sanctuary.engine.state.area.def.id===3&&window.sanctuary.engine.state.panel==='none');
    assert.equal(await wp.evaluate(()=>window.sanctuary.engine.state.activeSaveId),before.activeSaveId);
    await wp.evaluate(()=>{
      const {engine}=window.sanctuary;engine.state.player.unlockedActs=2;engine.state.player.waypoints.push(40);engine.enterArea(40);
      const stone=engine.state.area.objects.find(o=>o.kind==='waypoint');engine.state.player.x=stone.x;engine.state.player.y=stone.y+1;
    });
    await openStone();assert.equal(await wp.getByRole('tab',{name:'第二幕',selected:true}).count(),1);
    assert.match(await wp.locator('.waypoint-button.active').innerText(),/当前位置/);
    await wp.keyboard.press('Escape');await wp.locator('.panel-waypoint').waitFor({state:'detached'});
    console.log(`${mobile ? 'Mobile native touch 390×844/320×568' : 'Desktop mouse/keyboard'} waypoint tabs: five acts, 39 destinations, read-only browsing, disabled gates, close/reopen, proximity/discovered-travel/current-act fixtures PASS`);
  } catch(error) {
    console.error('Waypoint failure:',await wp.evaluate(()=>({area:window.sanctuary.engine.state.area?.def.id,panel:window.sanctuary.engine.state.panel,player:window.sanctuary.engine.state.player,selected:document.querySelector('[role="tab"][aria-selected="true"]')?.textContent})));
    await wp.screenshot({path:output+'waypoint-failure.png'});throw error;
  } finally {await ctx.close();}
};
const verifyItemSelection = async mobile => {
  const ctx = await browser.newContext({viewport:mobile ? {width:390,height:844} : {width:1440,height:900},deviceScaleFactor:mobile ? 2 : 1,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  const vp = await ctx.newPage();
  vp.on('pageerror',e=>errors.push(`item selection: ${e.message}`));
  vp.on('console',m=>{if(m.type()==='error')errors.push(`item selection: ${m.text()}`);});
  const activate = locator => mobile ? locator.tap() : locator.click();
  const selectStable = async (panel, uid, keyboard = false) => {
    if(mobile && await vp.locator('.item-popup').isVisible()) await activate(vp.getByRole('button',{name:'关闭物品浮层',exact:true}));
    const trading = await vp.locator('.trade-workspace').count() > 0;
    if(trading) {
      await activate(vp.locator(`[data-focus="trade-view:${panel}"]`));
      assert.equal(await vp.locator(`[data-focus="trade-view:${panel}"]`).getAttribute('aria-pressed'),'true');
      await vp.locator(`.panel-${panel}`).waitFor({state:'visible'});
      if(mobile)await vp.locator(`.panel-${panel==='vendor'?'inventory':'vendor'}`).waitFor({state:'hidden'});
    }
    await vp.waitForFunction(()=>{const ui=window.sanctuary.ui;return ui.panelSignature===ui.getPanelSignature();});
    const item = vp.locator(`.panel-${panel} .item-button[data-focus="item:${uid}"]`);
    // Touch trade selection intentionally reveals a newly populated detail. Exercise
    // that real tap first, then measure stable selection with the detail already in view.
    if(mobile && trading) {
      const frames=await vp.evaluate(()=>{
        window.__touchTradeReveal={workspace:document.querySelector('.trade-workspace'),nav:document.querySelector('.trade-switcher'),frames:[...document.querySelectorAll('.gothic-panel')].map(node=>({node,body:node.querySelector('.panel-body'),grid:node.querySelector('.item-grid'),stock:node.querySelector('.vendor-stock'),detail:node.querySelector('.item-detail')})),buttons:[...document.querySelectorAll('.trade-workspace .item-button')]};
        return window.__touchTradeReveal.frames.length;
      });
      assert.equal(frames,2);
      await activate(item);
      assert.equal(await vp.evaluate(uid=>window.sanctuary.ui.selectedUid===uid,uid),true);
      assert.equal(await vp.evaluate(()=>{
        const old=window.__touchTradeReveal;
        return old.workspace===document.querySelector('.trade-workspace')&&old.nav===document.querySelector('.trade-switcher')&&old.buttons.every(button=>button.isConnected)&&old.frames.every(({node,body,grid,stock,detail})=>node.isConnected&&node.querySelector('.panel-body')===body&&node.querySelector('.item-grid')===grid&&node.querySelector('.vendor-stock')===stock&&node.querySelector('.item-detail')!==detail);
      }),true,'The first revealing touch also replaces only both details, never either frame, body, grid, stock, nav or item button');
    }
    if(mobile && await vp.locator('.item-popup').isVisible()) await activate(vp.getByRole('button',{name:'关闭物品浮层',exact:true}));
    await item.scrollIntoViewIfNeeded();
    await vp.evaluate(({panel,uid})=>{
      const frame=document.querySelector(`.panel-${panel}`),body=frame.querySelector('.panel-body');
      const tradeFrames=[...document.querySelectorAll('.trade-workspace .gothic-panel')].map(node=>({node,body:node.querySelector('.panel-body'),grid:node.querySelector('.item-grid'),stock:node.querySelector('.vendor-stock'),detail:node.querySelector('.item-detail'),propertiesScroll:node.querySelector('.item-properties')?.scrollTop??0}));
      const scrolls=[...document.querySelectorAll('.trade-workspace [data-scroll]')].filter(node=>!node.closest('.item-detail')).map(node=>({node,top:node.scrollTop,left:node.scrollLeft}));
      window.__itemSelectionNodes={frame,body,grid:frame.querySelector('.item-grid'),button:frame.querySelector(`.item-button[data-focus="item:${uid}"]`),detail:frame.querySelector('.item-detail'),scroll:body.scrollTop,tick:window.sanctuary.engine.state.tick,tradeFrames,scrolls,workspace:document.querySelector('.trade-workspace'),nav:document.querySelector('.trade-switcher')};
    },{panel,uid});
    if(keyboard){await item.focus();await vp.keyboard.press('Enter');}else await activate(item);
    await vp.waitForFunction(()=>window.sanctuary.engine.state.tick>window.__itemSelectionNodes.tick+2);
    const stable=await vp.evaluate(({panel,uid})=>{
      const old=window.__itemSelectionNodes,frame=document.querySelector(`.panel-${panel}`);
      return {frame:frame===old.frame,body:frame.querySelector('.panel-body')===old.body,grid:frame.querySelector('.item-grid')===old.grid,button:old.button.isConnected,detail:frame.querySelector('.item-detail')!==old.detail,scroll:Math.abs(old.body.scrollTop-old.scroll)<1,selected:[...frame.querySelectorAll('.item-button.selected')].every(b=>b.dataset.focus===`item:${uid}`),count:frame.querySelectorAll('.item-button.selected').length,focus:document.activeElement===old.button};
    },{panel,uid});
    const {count,focus,...nodes}=stable;
    assert.deepEqual(nodes,{frame:true,body:true,grid:true,button:true,detail:true,scroll:true,selected:true});
    assert.equal(count,1);
    if(keyboard)assert.equal(focus,true,'Keyboard selection retains the focused item node');
    if(trading) {
      const dual=await vp.evaluate(({panel,uid})=>{
        const old=window.__itemSelectionNodes;
        return {workspace:old.workspace===document.querySelector('.trade-workspace'),nav:old.nav===document.querySelector('.trade-switcher'),frames:old.tradeFrames.length===2&&old.tradeFrames.every(({node,body,grid,stock,detail,propertiesScroll})=>node.isConnected&&node.querySelector('.panel-body')===body&&node.querySelector('.item-grid')===grid&&node.querySelector('.vendor-stock')===stock&&node.querySelector('.item-detail')!==detail&&Math.abs((node.querySelector('.item-properties')?.scrollTop??0)-propertiesScroll)<1),scroll:old.scrolls.every(({node,top,left})=>node.isConnected&&Math.abs(node.scrollTop-top)<1&&Math.abs(node.scrollLeft-left)<1),owners:old.tradeFrames.every(({node})=>node.querySelector('.item-detail').dataset.owner===(node.classList.contains('panel-vendor')?'vendor':'inventory')),oppositeSelection:document.querySelector(`.panel-${panel==='vendor'?'inventory':'vendor'} .item-button.selected`)===null,selected:document.querySelector(`.panel-${panel} .item-button[data-focus="item:${uid}"]`)?.getAttribute('aria-pressed')==='true'};
      },{panel,uid});
      assert.deepEqual(dual,{workspace:true,nav:true,frames:true,scroll:true,owners:true,oppositeSelection:true,selected:true},'Selection only replaces both owner-specific details, retaining both windows, stock/grid and every other scroll node');
    }
  };
  try {
    await vp.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});await enterRoster(vp,false);
    assert.equal(await vp.locator('.character-save').count(),0);
    await activate(vp.getByRole('button',{name:'新建角色',exact:true}));await activate(vp.locator('[data-class="sor"]'));
    await vp.locator('#hero-name').fill('物品选择交易回归');await activate(vp.getByRole('button',{name:'开启旅程',exact:true}));
    await vp.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
    const initial=await vp.evaluate(()=>({id:window.sanctuary.engine.state.activeSaveId,weapon:window.sanctuary.engine.state.player.equipment.weapon.uid,scroll:window.sanctuary.engine.state.player.inventory.find(i=>i.code==='isc').uid}));
    await activate(vp.locator('.game-hud [data-panel="inventory"]'));
    await selectStable('inventory',initial.weapon);
    await selectStable('inventory',initial.scroll,!mobile);
    await selectStable('inventory',initial.weapon,!mobile);
    await activate(vp.locator(mobile ? '.item-popup .item-detail' : '.panel-inventory .item-detail').getByRole('button',{name:'卸下至背包',exact:true}));
    await vp.waitForFunction(uid=>window.sanctuary.engine.state.player.inventory.some(i=>i.uid===uid),initial.weapon);
    if(mobile){await selectStable('inventory',initial.weapon);await activate(vp.locator(mobile ? '.item-popup .item-detail' : '.panel-inventory .item-detail').getByRole('button',{name:'装备',exact:true}));}
    else await vp.locator(`.panel-inventory .grid-item[data-focus="item:${initial.weapon}"]`).dblclick();
    await vp.waitForFunction(uid=>window.sanctuary.engine.state.player.equipment.weapon?.uid===uid,initial.weapon);
    await activate(vp.locator('.panel-inventory .close-button'));
    const npc=await vp.evaluate(()=>window.sanctuary.engine.state.area.objects.find(o=>o.npcId==='akara'));
    await approachTownObject(vp,npc.uid,mobile);
    const at=await vp.evaluate(npc=>window.sanctuary.renderer.worldToScreen(npc),npc);
    if(mobile)await vp.touchscreen.tap(at.x,at.y);else await vp.mouse.click(at.x,at.y);
    await vp.locator('.panel-vendor').waitFor();
    for(const code of ['isc','tsc']){
      const before=await vp.evaluate(code=>{const p=window.sanctuary.engine.state.player;return {item:p.inventory.find(i=>i.code===code),gold:p.gold};},code);
      await selectStable('inventory',before.item.uid,!mobile);
      await activate(vp.locator(mobile ? '.item-popup .item-detail' : '.panel-inventory .item-detail').getByRole('button',{name:'出售',exact:true}));
      await vp.waitForFunction(({uid,gold})=>{const p=window.sanctuary.engine.state.player;return !p.inventory.some(i=>i.uid===uid)&&p.gold>gold;},{uid:before.item.uid,gold:before.gold});
      await vp.waitForFunction(()=>!window.__itemSelectionNodes.frame.isConnected);
      assert.equal(await vp.evaluate(()=>window.__itemSelectionNodes.frame.isConnected),false,'An actual inventory transaction still rebuilds the panel');
    }
    const offer=await vp.evaluate(()=>{const s=window.sanctuary.engine.state;return {item:s.vendorItems.find(i=>i.code==='hp1'),gold:s.player.gold,count:s.player.inventory.filter(i=>i.code==='hp1').length};});
    assert.ok(offer.gold>=offer.item.price,'Real starter-item sales fund the purchase');
    await selectStable('vendor',offer.item.uid,!mobile);
    await activate(vp.locator(mobile ? '.item-popup .item-detail' : '.panel-vendor .item-detail').getByRole('button',{name:/^购买 · [\d,]+ 金币$/}));
    await vp.waitForFunction(({gold,price,count})=>{const p=window.sanctuary.engine.state.player;return p.gold===gold-price&&p.inventory.filter(i=>i.code==='hp1').length===count+1;},{gold:offer.gold,price:offer.item.price,count:offer.count});
    const bought=await vp.evaluate(()=>{const p=window.sanctuary.engine.state.player;return {item:p.inventory.find(i=>i.code==='hp1'),gold:p.gold,belt:p.belt.map(i=>i?.uid??null)};});
    assert.equal(await vp.locator('.panel-layer').getAttribute('data-trade-view'),'inventory','An inventory purchase selects the backpack window');
    if(mobile)assert.equal(await vp.locator('.panel-vendor').isVisible(),false);
    await selectStable('inventory',bought.item.uid,!mobile);
    await activate(vp.locator(mobile ? '.item-popup .item-detail' : '.panel-inventory .item-detail').getByRole('button',{name:'出售',exact:true}));
    await vp.waitForFunction(({uid,gold})=>{const p=window.sanctuary.engine.state.player;return !p.inventory.some(i=>i.uid===uid)&&p.gold>gold;},{uid:bought.item.uid,gold:bought.gold});
    assert.deepEqual(await vp.evaluate(()=>window.sanctuary.engine.state.player.belt.map(i=>i?.uid??null)),bought.belt,'Selling an inventory potion cannot consume belt reserves');
    assert.equal(await vp.evaluate(()=>window.sanctuary.engine.state.activeSaveId),initial.id);
    assert.equal((await savedCharacters(vp)).length,1);
    console.log(`${mobile ? 'Native touch' : 'Desktop keyboard/mouse'} item selection: stable panel/grid/button/scroll/focus, real unequip/equip, starter sales, purchase and inventory-potion sale with unchanged belt PASS`);
  } finally {await ctx.close();}
};
try {
  await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('.intro-scene')?.getAnimations().some(a=>a.currentTime>1800));
  await page.screenshot({path:output+'11-opening.png'});
  await page.getByRole('button',{name:'开始游戏',exact:true}).waitFor({state:'visible',timeout:10000});
  assert.equal(await page.locator('.character-screen').count(),0);
  assert.equal(await page.evaluate(() => window.__openingCanvasDraws), 0);
  await page.screenshot({path:output+'01-title.png'});
  await enterRoster(page,false);
  await page.waitForFunction(() => window.__openingCanvasDraws > 0);
  console.log('Opening animation avoids hidden Canvas redraws; roster background resumes PASS');
  assert.equal(await page.locator('.character-save').count(),0);
  await page.getByRole('button',{name:'新建角色',exact:true}).click();
  await page.locator('.class-card').first().waitFor();
  assert.equal(await page.locator('.class-card').count(),7);
  await page.locator('[data-class="sor"]').click();
  await page.locator('#hero-name').fill('伊芙');
  await page.screenshot({path:output+'02-creation.png'});
  await page.getByRole('button',{name:'开启旅程',exact:true}).click();
  await page.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
  let s=await game();
  assert.equal(s.player.classId,'sor'); assert.equal(s.stats.maxLife,40); assert.equal(s.stats.maxMana,35); assert.equal(s.player.skillPoints,0);
  await page.screenshot({path:output+'03-town.png'});
  await page.waitForFunction(()=>window.sanctuary.engine.state.saved&&!window.sanctuary.engine.state.loadingSave);
  // Isolated WebGL fixtures: cloned state only, no gameplay dispatch/item/UID generation or FPS claims.
  await page.evaluate(async () => {
    const {Renderer}=await import('/src/renderer3d.ts');
    const check=(condition,message)=>{if(!condition) throw new Error(`Renderer3D fixture: ${message}`);};
    const active=window.sanctuary, activeRenderer=active.renderer, activeState=active.engine.state;
    const activePlayer=activeState.player, activeArea=activeState.area;
    const snapshot=()=>JSON.stringify({player:activeState.player,id:activeState.activeSaveId,characters:activeState.characters,
      drops:activeState.area.drops,objects:activeState.area.objects,vendorItems:activeState.vendorItems});
    const readStorage=async () => {
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('sanctuary-h5',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      try {
        const records=await new Promise((resolve,reject)=>{const r=db.transaction('characters','readonly').objectStore('characters').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
        const entries=storage=>Array.from({length:storage.length},(_,i)=>storage.key(i)).sort().map(key=>[key,storage.getItem(key)]);
        return JSON.stringify({records,local:entries(localStorage),session:entries(sessionStorage)});
      } finally {db.close();}
    };
    const storedBefore=await readStorage(), before=snapshot(), fullBefore=JSON.stringify(activeState);
    const state=structuredClone(activeState);
    check(state.player!==activePlayer&&state.area!==activeArea&&state.player.inventory!==activePlayer.inventory,'state and item containers are cloned');
    state.paused=true;state.events=[]; // Suppress camera shake/animation only in the private fixture.
    const host=document.createElement('div'), canvas=document.createElement('canvas'), undo=[];
    host.style.cssText='position:fixed;left:-10000px;top:73px;width:640px;height:480px;pointer-events:none';
    host.setAttribute('aria-hidden','true');canvas.style.cssText='display:block;width:640px;height:480px';
    host.append(canvas);document.body.append(host);
    let renderer, disposed=false, activeDisposals=0;
    const activeTerrain=activeRenderer.terrain, activeActors=new Map(activeRenderer.actors), activeGL=activeRenderer.gl;
    const resources=new Set();
    activeRenderer.scene.traverse(node=>{
      if(node.geometry) resources.add(node.geometry);
      if(node.material) for(const material of Array.isArray(node.material)?node.material:[node.material]) resources.add(material);
      if(node.isSkinnedMesh&&node.skeleton.boneTexture) resources.add(node.skeleton.boneTexture);
    });
    for(const resource of resources) {
      const listener=()=>activeDisposals++;
      resource.addEventListener('dispose',listener);undo.push(()=>resource.removeEventListener('dispose',listener));
    }
    const draw=time=>{
      const before=JSON.stringify(state);renderer.render(state,time);
      check(JSON.stringify(state)===before,'render leaves cloned player/items/UIDs and state unchanged');
      check(renderer.gl.info.render.calls>0&&renderer.gl.info.render.triangles>0,'WebGL submits real geometry');
      check(!renderer.gl.getContext().isContextLost(),'fixture WebGL context remains live');
    };
    const roundtrip=()=>{
      const rect=canvas.getBoundingClientRect();
      check(rect.left!==0&&rect.top!==0,'projection fixture includes a nonzero canvas offset');
      for(const [dx,dy] of [[0,0],[2.25,-1.5],[-3,2],[.125,.75]]) {
        const p={x:state.player.x+dx,y:state.player.y+dy}, screen=renderer.worldToScreen(p,0);
        const implicit=renderer.worldToScreen(p), world=renderer.screenToWorld(screen.x,screen.y);
        check(Number.isFinite(screen.x)&&Number.isFinite(screen.y)&&Math.hypot(world.x-p.x,world.y-p.y)<1e-6,'ground projection roundtrip uses client coordinates');
        check(Math.hypot(implicit.x-screen.x,implicit.y-screen.y)<1e-9,'default lift is zero');
        const lifted=renderer.worldToScreen(p,1);
        check(Number.isFinite(lifted.x)&&Number.isFinite(lifted.y)&&Math.hypot(lifted.x-screen.x,lifted.y-screen.y)>1,'explicit lift projects elevated visuals');
      }
    };
    try {
      renderer=new Renderer(canvas);draw(0);
      const terrain=renderer.terrain, actors=new Map(renderer.actors), instances=[];
      terrain.group.traverse(node=>{if(node.isInstancedMesh) instances.push(node);});
      check(renderer.groundArea===state.area&&terrain.area===state.area&&terrain!==activeTerrain,'terrain belongs only to cloned area');
      check(instances.length>0&&instances.every(mesh=>mesh.count>0&&mesh.geometry.getAttribute('position').count>0&&[...mesh.instanceMatrix.array].every(Number.isFinite)),'terrain has populated finite instanced geometry');
      check(actors.has('player')&&state.area.objects.filter(o=>o.kind==='npc'&&Math.hypot(o.x-state.player.x,o.y-state.player.y)<22).every(o=>actors.has(o.uid)),'player and nearby real town NPCs have actors');
      for(const actor of actors.values()) {
        const {mesh,bones}=actor.rig;
        check(mesh.isSkinnedMesh&&mesh.skeleton.bones.length>=10&&Object.values(bones).every(bone=>bone.isBone),'actors use articulated skinned rigs');
        check(['root','hips','torso','head','armR','armL','legR','legL'].every(name=>bones[name]),'biped rig has body and limb bones');
      }
      const activeHero=activeActors.get('player'), hero=actors.get('player');
      check(activeHero.rig.mesh.skeleton.boneTexture?.isTexture,'active player has a live GPU bone texture covered by disposal checks');
      check(hero!==activeHero&&hero.rig.mesh.skeleton!==activeHero.rig.mesh.skeleton&&hero.rig.bones.root!==activeHero.rig.bones.root,'secondary rig instances do not share bones/skeletons');
      check(hero.rig.mesh.geometry===activeHero.rig.mesh.geometry,'secondary fixture exercises shared cached player geometry');
      roundtrip();draw(.04);
      check(renderer.groundArea===state.area&&renderer.terrain===terrain&&[...actors].every(([uid,actor])=>renderer.actors.get(uid)===actor),'stationary frame retains area, terrain and actor identities');
      check(instances.every(mesh=>mesh.parent),'stationary terrain instances remain attached');
      const original=renderer.worldToScreen(state.player,0);
      host.style.left='-9879px';host.style.top='114px';
      const shifted=renderer.worldToScreen(state.player,0);
      check(Math.abs(shifted.x-original.x-121)<1e-6&&Math.abs(shifted.y-original.y-41)<1e-6,'canvas offset changes screen position without changing world position');
      roundtrip();renderer.resize();draw(.08);
      check(renderer.groundArea===state.area&&renderer.terrain===terrain,'unchanged size retains terrain identity');
      const dimensions=[canvas.width,canvas.height,renderer.overlayCanvas.width,renderer.overlayCanvas.height];
      host.style.width=canvas.style.width='720px';host.style.height=canvas.style.height='520px';
      renderer.resize();draw(.12);roundtrip();
      const dpr=renderer.gl.getPixelRatio(), overlayDpr=Math.min(devicePixelRatio||1,2);
      check(canvas.width===Math.floor(720*dpr)&&canvas.height===Math.floor(520*dpr),'resized WebGL buffer uses renderer DPR');
      check(renderer.overlayCanvas.width===Math.round(720*overlayDpr)&&renderer.overlayCanvas.height===Math.round(520*overlayDpr),'resized overlay uses its physical DPR');
      check([canvas.width,canvas.height,renderer.overlayCanvas.width,renderer.overlayCanvas.height].every((n,i)=>n!==dimensions[i]),'both canvases resize');
      check(renderer.groundArea===state.area&&renderer.terrain===terrain,'resize retains world-space terrain');
      const previousArea=state.area;let terrainDisposals=0;
      for(const mesh of instances) {const listener=()=>terrainDisposals++;mesh.geometry.addEventListener('dispose',listener);undo.push(()=>mesh.geometry.removeEventListener('dispose',listener));}
      state.area=structuredClone(previousArea);draw(.16);roundtrip();
      check(state.area.def.id===previousArea.def.id&&renderer.groundArea===state.area&&renderer.terrain!==terrain,'same area ID with a new identity rebuilds terrain');
      check(!terrain.group.parent&&terrainDisposals===instances.length,'replaced terrain is detached and its instance geometry disposed');
      check(activeDisposals===0,'area rebuild never disposes active geometry/materials/skeletons');
      const overlay=renderer.overlayCanvas, lastTerrain=renderer.terrain;
      renderer.destroy();disposed=true;
      check(renderer.groundArea===null&&renderer.actors.size===0&&!lastTerrain.group.parent&&!overlay.isConnected,'destroy releases secondary area, actors, terrain and overlay');
      renderer.destroy(); // Idempotence must not release shared resources a second time.
      check(activeDisposals===0,'secondary destruction never disposes active resources');
      check(activeRenderer.terrain===activeTerrain&&activeRenderer.groundArea===activeArea&&activeRenderer.gl===activeGL&&[...activeActors].every(([uid,actor])=>activeRenderer.actors.get(uid)===actor),'active renderer identities survive secondary destruction');
      activeRenderer.render(activeState,activeRenderer.lastTime);
      check(activeGL.info.render.calls>0&&activeGL.info.render.triangles>0&&!activeGL.getContext().isContextLost(),'active renderer still submits geometry after secondary destruction');
      check(activeActors.get('player').rig.mesh.geometry===hero.rig.mesh.geometry&&activeDisposals===0,'shared active geometry stays valid after another render');
    } finally {
      try {if(!disposed)renderer?.destroy();} finally {for(const restore of undo.reverse())restore();canvas.width=canvas.height=0;host.remove();}
    }
    check(!host.isConnected&&!canvas.isConnected,'temporary canvases and host are removed');
    check(window.sanctuary===active&&active.renderer===activeRenderer&&active.engine.state===activeState&&activeState.player===activePlayer&&activeState.area===activeArea,'active game identities are untouched');
    check(JSON.stringify(activeState)===fullBefore&&snapshot()===before,'synchronous fixture leaves all active state/items/UIDs/save IDs unchanged');
    check(await readStorage()===storedBefore,'IndexedDB, localStorage and sessionStorage are unchanged');
    check(snapshot()===before,'storage verification leaves active player/items/characters unchanged (normal engine ticks excluded)');
  });
  console.log('Isolated Renderer3D fixtures: WebGL terrain instances/rig bones, stationary identities, projection offset/resize, area rebuild, shared-geometry destroy and state/storage isolation PASS');
  const exit=s.objects.find(o=>o.kind==='exit'&&o.targetArea===2);
  await approachTownObject(page,exit.uid);
  const xy=await point(exit);
  assert.equal(await page.evaluate(p=>window.sanctuary.ui.pick(p.x,p.y)?.uid,xy),exit.uid);
  await page.mouse.click(xy.x,xy.y);
  await page.waitForFunction(()=>window.sanctuary.engine.state.area?.def.id===2,{},{timeout:10000});
  // Real field movement through keyboard holds; no position/level/gear fixtures.
  const movement=await page.evaluate(()=>{
    const {area,player}=window.sanctuary.engine.state;
    const walkable=(x,y)=>x>=0&&y>=0&&x<area.width&&y<area.height&&area.tiles[Math.floor(y)]?.[Math.floor(x)]===0;
    const directions=[['w','ArrowUp',-1,-1],['d','ArrowRight',1,-1],['s','ArrowDown',1,1],['a','ArrowLeft',-1,1]];
    const direction=directions.find(([, ,dx,dy])=>[.2,.4,.6,.8].every(distance=>walkable(player.x+dx*distance/Math.SQRT2,player.y+dy*distance/Math.SQRT2)));
    if(!direction)throw new Error('No short walkable field route for real WASD/arrow input');
    return {key:direction[0],arrow:direction[1]};
  });
  await page.locator('.world-canvas').focus();
  for(const key of [movement.key,movement.arrow]) {
    const start=(await game()).player;
    await page.keyboard.down(key);
    try {await page.waitForFunction(start=>Math.hypot(window.sanctuary.engine.state.player.x-start.x,window.sanctuary.engine.state.player.y-start.y)>.25,start,{timeout:3000});}
    finally {await page.keyboard.up(key);}
    const stopped=await page.evaluate(()=>({x:window.sanctuary.engine.state.player.x,y:window.sanctuary.engine.state.player.y,tick:window.sanctuary.engine.state.tick}));
    await page.waitForFunction(tick=>window.sanctuary.engine.state.tick>=tick+3,stopped.tick);
    const current=(await game()).player;
    assert.ok(Math.hypot(current.x-stopped.x,current.y-stopped.y)<1e-6,'releasing movement stops field travel');
  }
  console.log('Real WASD and arrow holds move in the field and stop on keyup PASS');
  let mob;
  for(let encounter=0;encounter<18;encounter++) {
    s=await game(); mob=await page.evaluate(async()=>{
      const {area,player}=window.sanctuary.engine.state, {findPath}=await import('/src/engine.ts');
      return area.monsters.filter(m=>!m.dead&&findPath(area,player,m).length>0).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0];
    });
    assert.ok(mob,'an enemy has a reachable legal approach');
    for(let volley=0;volley<24;volley++) {
      s=await game();if(s.monsters.find(m=>m.uid===mob.uid).dead)break;
      assert.equal(s.player.dead,false);
      for(let i=0;i<80;i++) {
        const approach=await page.evaluate(async uid=>{
          const {engine,renderer,ui}=window.sanctuary,{area,player}=engine.state,m=area.monsters.find(m=>m.uid===uid);
          if(m.dead)return null;
          const {hasLineOfSight}=await import('/src/world.ts'),screen=renderer.worldToScreen(m,.8);
          const range=player.mana>=2.5?7.5:1.25;
          if(Math.hypot(m.x-player.x,m.y-player.y)<range&&hasLineOfSight(area,player,m)&&document.elementFromPoint(screen.x,screen.y)===ui.canvas)return null;
          const {findPath}=await import('/src/engine.ts'),next=findPath(area,player,m)[0];
          if(!next)throw new Error('Target has no legal field approach');
          const dx=next.x-player.x,dy=next.y-player.y;return {horizontal:dx-dy,vertical:dx+dy};
        },mob.uid);
        if(!approach)break;
        const keys=[approach.horizontal>.2?'d':approach.horizontal<-.2?'a':null,approach.vertical>.2?'s':approach.vertical<-.2?'w':null].filter(Boolean);
        for(const key of keys)await page.keyboard.down(key);
        try{await page.waitForTimeout(100);}finally{for(const key of keys)await page.keyboard.up(key);}
      }
      s=await game();const target=s.monsters.find(m=>m.uid===mob.uid);if(target.dead)break;
      assert.equal(s.player.dead,false);
      const xy=await page.evaluate(m=>window.sanctuary.renderer.worldToScreen(m,.8),target);await holdMouse(page,xy,s.player.mana>=2.5?'right':'left');
      await page.waitForTimeout(100);
    }
    s=await game(); assert.equal(s.monsters.find(m=>m.uid===mob.uid).dead,true);
    if(s.drops.length>0)break;
  }
  assert.ok(s.player.experience>0); assert.ok(s.player.mana<35);
  await page.screenshot({path:output+'04-combat.png'});
  assert.ok(s.drops.length>0,'normal combat produces an actual drop for the pickup regression');
  const drop=s.drops[0];
  await page.keyboard.down('Alt');
  try {
    const dropXY=await page.evaluate(drop=>window.sanctuary.renderer.worldToScreen(drop,.4),drop);
    assert.deepEqual(await page.evaluate(point=>window.sanctuary.ui.pick(point.x,point.y)?.action,dropXY),{type:'pickup',uid:drop.item.uid},'visible loot label wins over a nearby monster silhouette');
    await page.mouse.click(dropXY.x,dropXY.y);
    await page.waitForFunction(uid=>!window.sanctuary.engine.state.area.drops.some(d=>d.item.uid===uid),drop.item.uid,{timeout:10000});
  } finally { await page.keyboard.up('Alt'); }
  const potions=s.player.belt.filter(Boolean).length, rightSkill=s.player.rightSkill;
  // Unassigned 1–8 are skill shortcuts, not the old belt keys.
  for(let digit=1;digit<=8;digit++)await page.keyboard.press(`Digit${digit}`);
  assert.equal((await game()).player.belt.filter(Boolean).length,potions);
  assert.equal((await game()).player.rightSkill,rightSkill);
  await page.keyboard.press('Shift+Digit1'); await page.waitForTimeout(100);
  assert.equal((await game()).player.belt.filter(Boolean).length,potions-1);
  const portalButton=page.getByRole('button',{name:/回城|城镇传送|传送卷轴/});
  assert.ok(await portalButton.count()); await portalButton.first().click();
  s=await game(); const portal=s.objects.find(o=>o.kind==='portal'&&o.targetArea===1);
  assert.ok(portal); const portalXY=await point(portal);
  assert.deepEqual(await page.evaluate(point=>window.sanctuary.ui.pick(point.x,point.y)?.action,portalXY),{type:'interact',uid:portal.uid},'portal remains clickable near an attacking monster');
  await page.mouse.click(portalXY.x,portalXY.y);
  await page.waitForFunction(()=>window.sanctuary.engine.state.area?.def.id===1,{},{timeout:10000});
  await page.keyboard.press('i'); assert.equal((await game()).panel,'inventory');
  await page.screenshot({path:output+'05-inventory.png'});
  await page.keyboard.press('i'); await page.keyboard.press('t'); assert.equal((await game()).panel,'skills');
  await page.screenshot({path:output+'06-skills.png'});
  await page.keyboard.press('t'); await page.keyboard.press('c'); assert.equal((await game()).panel,'character');
  await page.screenshot({path:output+'07-character.png'});
  await page.keyboard.press('c');
  await page.keyboard.press('j');assert.equal((await game()).panel,'quests');
  await page.keyboard.press('j');assert.equal((await game()).panel,'none');
  await page.locator('.save-button').click();
  await page.waitForFunction(()=>window.sanctuary.engine.state.saved);
  assert.equal(await verifyArt(page),49);
  const recordsBeforeCatalog=await savedCharacters(page);
  const heroBeforeCatalog=await page.evaluate(()=>({id:window.sanctuary.engine.state.activeSaveId,gold:window.sanctuary.engine.state.player.gold,inventory:window.sanctuary.engine.state.player.inventory,equipment:window.sanctuary.engine.state.player.equipment}));
  await page.getByRole('button',{name:/^图鉴(?: · L)?$/}).click();
  await page.locator('.catalog-list').waitFor();
  assert.match(await page.locator('.catalog-baseline').innerText(),/2,971/);
  const categoryCounts={base:659,unique:388,'set-item':127,set:32,runeword:169,rune:33,gem:35,prefix:636,suffix:741,cube:151};
  for (const [kind,count] of Object.entries(categoryCounts)) {
    await page.locator(`[data-kind="${kind}"]`).click();
    assert.match(await page.locator('.catalog-summary').innerText(),new RegExp(`匹配 ${count} 项`));
    assert.equal(await page.locator('.catalog-entry').count(),Math.min(24,count));
  }
  await page.locator('[data-kind="base"]').click();
  const firstEntry=await page.locator('.catalog-entry').first().getAttribute('data-entry-id');
  await page.getByRole('button',{name:'下一页',exact:true}).click();
  assert.match(await page.locator('.catalog-summary').innerText(),/第 2 \/ 28 页/);
  assert.notEqual(await page.locator('.catalog-entry').first().getAttribute('data-entry-id'),firstEntry);
  await page.getByRole('button',{name:'上一页',exact:true}).click();
  await page.locator('[data-kind="rune"]').click();
  await page.getByRole('searchbox',{name:'搜索装备图鉴'}).fill('r33');
  assert.equal(await page.locator('.catalog-entry').count(),1);
  assert.match(await page.locator('.catalog-detail').innerText(),/佐德|Zod/i);
  await page.getByRole('button',{name:'清空',exact:true}).click();
  await page.locator('[data-kind="gem"]').click();
  await page.getByRole('searchbox',{name:'搜索装备图鉴'}).pressSequentially('蓝宝石');
  assert.equal(await page.locator('.catalog-entry').count(),5);
  assert.equal(await page.getByRole('searchbox',{name:'搜索装备图鉴'}).evaluate(element=>document.activeElement===element),true);
  await page.getByRole('button',{name:'清空',exact:true}).click();
  await page.locator('[data-kind="unique"]').click();
  await page.getByRole('searchbox',{name:'搜索装备图鉴'}).fill('Azurewrath');
  assert.equal(await page.locator('.catalog-entry').count(),2);
  await page.locator('[data-entry-id="unique:29"]').click();
  assert.match(await page.locator('.catalog-entry-status').innerText(),/原始禁用/);
  await page.locator('.catalog-raw summary').click();
  const disabledRaw=JSON.parse(await page.locator('.catalog-raw pre').innerText());
  assert.equal(disabledRaw.code,'crs'); assert.equal(disabledRaw.index,'Azurewrath'); assert.notEqual(disabledRaw.enabled,1);
  await page.getByRole('button',{name:'清空',exact:true}).click();
  await page.locator('[data-kind="runeword"]').click();
  await page.getByRole('searchbox',{name:'搜索装备图鉴'}).fill('Infinity');
  assert.equal(await page.locator('.catalog-entry').count(),1);
  assert.match(await page.locator('.catalog-entry-status').innerText(),/服务器限定.*离线匹配禁用/);
  await page.getByRole('searchbox',{name:'搜索装备图鉴'}).fill('Leaf');
  assert.match(await page.locator('.catalog-entry-status').innerText(),/离线匹配已启用/);
  await page.getByRole('searchbox',{name:'搜索装备图鉴'}).fill('Patience');
  assert.match(await page.locator('.catalog-entry-status').innerText(),/原始未完成/);
  await page.getByRole('searchbox',{name:'搜索装备图鉴'}).fill('no-match-<script>');
  assert.equal(await page.locator('.catalog-entry').count(),0);
  assert.match(await page.locator('.catalog-list').innerText(),/没有匹配/);
  await page.getByRole('button',{name:'清空',exact:true}).click();
  await page.getByRole('searchbox',{name:'搜索装备图鉴'}).fill('Leaf');
  await page.screenshot({path:output+'15-equipment-catalog.png'});
  await page.keyboard.press('Escape');
  assert.equal((await game()).panel,'none');
  assert.deepEqual(await savedCharacters(page),recordsBeforeCatalog);
  assert.deepEqual(await page.evaluate(()=>({id:window.sanctuary.engine.state.activeSaveId,gold:window.sanctuary.engine.state.player.gold,inventory:window.sanctuary.engine.state.player.inventory,equipment:window.sanctuary.engine.state.player.equipment})),heroBeforeCatalog);
  await page.keyboard.press('l'); await page.locator('.catalog-list').waitFor(); await page.keyboard.press('Escape');
  console.log('All 49 original assets, ten catalog counts, paging/search/focus, disabled/history/offline statuses, raw parameters and read-only IndexedDB PASS');
  const before=await game();
  const firstId=await page.evaluate(()=>window.sanctuary.engine.state.activeSaveId);
  await page.reload({waitUntil:'networkidle'}); await enterRoster(page);
  await page.getByRole('button',{name:'进入',exact:true}).click();
  await page.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
  s=await game(); assert.equal(s.player.name,'伊芙'); assert.equal(s.player.experience,before.player.experience); assert.equal(s.player.belt.filter(Boolean).length,before.player.belt.filter(Boolean).length);
  await page.keyboard.press('Escape'); const mana=(await game()).player.mana;
  await holdMouse(page,{x:700,y:400});assert.equal((await game()).player.mana,mana);
  console.log('Desktop golden path: opening, creation, combat, XP, loot, potion, portal, panels, IndexedDB save/reload, pause PASS');
  await page.getByRole('button',{name:'返回角色列表',exact:true}).click();
  await page.getByRole('button',{name:'新建角色',exact:true}).click();
  await page.locator('[data-class="pal"]').click(); await page.locator('#hero-name').fill('伊芙');
  await page.getByRole('button',{name:'开启旅程',exact:true}).click();
  await page.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
  const secondId=await page.evaluate(()=>window.sanctuary.engine.state.activeSaveId);
  assert.notEqual(firstId,secondId);
  await page.keyboard.press('Escape'); await page.getByRole('button',{name:'返回角色列表',exact:true}).click();
  await page.waitForFunction(()=>window.sanctuary.engine.state.characters.length===2);
  await page.locator('.character-save').nth(1).waitFor();
  assert.equal(await page.locator('.character-save').count(),2);
  await page.locator(`[data-save-id="${firstId}"]`).click();
  await page.screenshot({path:output+'12-characters.png'});
  await page.getByRole('button',{name:'进入',exact:true}).click();
  await page.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
  s=await game(); assert.equal(s.player.classId,'sor'); assert.equal(s.player.experience,before.player.experience);
  assert.equal(s.player.belt.filter(Boolean).length,before.player.belt.filter(Boolean).length);
  await page.keyboard.press('Escape'); await page.getByRole('button',{name:'返回角色列表',exact:true}).click();
  await page.reload({waitUntil:'networkidle'}); await enterRoster(page);
  assert.equal(await page.locator('.character-save').count(),2);
  await page.locator(`[data-save-id="${secondId}"]`).click(); await page.getByRole('button',{name:'进入',exact:true}).click();
  await page.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
  assert.equal((await game()).player.classId,'pal');
  const database=await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('sanctuary-h5',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const names=[...db.objectStoreNames]; const count=await new Promise((resolve,reject)=>{const tx=db.transaction('characters');const request=tx.objectStore('characters').count();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();return {names,count};
  });
  assert.deepEqual(database,{names:['characters'],count:2});
  await page.keyboard.press('c');
  assert.match(await page.locator('.derived-row').filter({hasText:'站立 / 行走格挡'}).innerText(),/75%/);
  assert.match(await page.locator('.derived-row').filter({hasText:'奔跑格挡'}).innerText(),/25%/);
  await page.keyboard.press('r');
  assert.match(await page.locator('.derived-row').filter({hasText:'站立 / 行走格挡'}).innerText(),/75%/);
  await page.keyboard.press('c');
  console.log('Two same-name characters: separate IDs, no overwrite, class/XP/belt isolation, IndexedDB records and reload PASS');
  console.log('Character sheet distinguishes full shield block from one running reduction PASS');

  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const mp=await mobile.newPage(); mp.on('pageerror',e=>errors.push('mobile: '+e.message));
  mp.on('console',message=>{if(message.type()==='error')errors.push('mobile: '+message.text());});
  await mp.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
  await enterRoster(mp);
  await mp.screenshot({path:output+'13-mobile-characters.png'});
  assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await mp.getByRole('button',{name:'新建角色',exact:true}).tap();
  await mp.screenshot({path:output+'08-mobile-creation.png'});
  await mp.getByRole('button',{name:'开启旅程',exact:true}).tap();
  await mp.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
  await mp.screenshot({path:output+'09-mobile-town.png'});
  assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const inv=mp.getByRole('button',{name:/行囊|背包|物品栏|装备/});
  if(await inv.count()) {await inv.first().tap(); await mp.screenshot({path:output+'10-mobile-inventory.png'});}
  if (await mp.evaluate(()=>window.sanctuary.engine.state.panel!=='none')) await mp.keyboard.press('Escape');
  const utilityBounds=[];
  for (const name of ['保存','图鉴','指南','暂停']) {
    const button=name==='保存'?mp.locator('.save-button'):mp.getByRole('button',{name:new RegExp(`^${name}(?: · (?:L|H|Esc))?$`)});
    const bounds=await button.boundingBox();
    assert.ok(bounds && bounds.x>=0 && bounds.x+bounds.width<=390,name);
    for (const other of utilityBounds) assert.ok(bounds.x>=other.x+other.width || other.x>=bounds.x+bounds.width || bounds.y>=other.y+other.height || other.y>=bounds.y+bounds.height,'mobile HUD utility overlap');
    utilityBounds.push(bounds);
  }
  await mp.getByRole('button',{name:/^图鉴(?: · L)?$/}).tap(); await mp.locator('.catalog-list').waitFor();
  await mp.locator('[data-kind="gem"]').tap();
  await mp.getByRole('searchbox',{name:'搜索装备图鉴'}).fill('完美的');
  assert.equal(await mp.locator('.catalog-entry').count(),7);
  await mp.locator('.catalog-entry').last().tap();
  assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.equal(await verifyArt(mp),49);
  await mp.screenshot({path:output+'16-mobile-equipment.png'});
  await mp.keyboard.press('Escape');
  console.log('Mobile original assets, non-overlapping HUD, catalog category/search/detail and no horizontal overflow PASS');
  await mp.keyboard.press('Escape'); await mp.getByRole('button',{name:'返回角色列表',exact:true}).tap();
  await mp.locator('.character-save').first().waitFor();
  await mp.getByRole('button',{name:'新建角色',exact:true}).tap(); await mp.locator('[data-class="sor"]').tap();
  await mp.getByRole('button',{name:'开启旅程',exact:true}).tap();
  await mp.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
  await mp.keyboard.press('Escape'); await mp.getByRole('button',{name:'返回角色列表',exact:true}).tap();
  await mp.locator('.character-save').nth(1).waitFor(); await mp.screenshot({path:output+'13-mobile-characters.png'});
  assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  console.log('Mobile 390×844: opening/skip, multiple characters, creation, HUD, responsive overflow check PASS');

  // All synthetic levels/items/monsters/positions below live in separate numeric
  // contexts, never in the desktop/mobile golden-path or legacy-save contexts.
  const numeric=await browser.newContext({viewport:{width:1100,height:800},reducedMotion:'reduce',hasTouch:true});
  const np=await numeric.newPage(); np.on('pageerror',e=>errors.push('numeric: '+e.message));
  np.on('console',message=>{if(message.type()==='error')errors.push('numeric: '+message.text());});
  await np.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'}); await enterRoster(np,false);
  await np.getByRole('button',{name:'新建角色',exact:true}).click(); await np.locator('[data-class="sor"]').click();
  await np.locator('#hero-name').fill('规则验收'); await np.getByRole('button',{name:'开启旅程',exact:true}).click();
  await np.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
  await np.evaluate(async()=>{
    const {createItem}=await import('/src/items.ts'), engine=window.sanctuary.engine, p=engine.state.player;
    const charm=createItem('cm1',1,()=>.5); charm.identified=true; charm.mods={life:20,mana:25};
    engine.state.area.drops.push({item:charm,x:p.x,y:p.y}); engine.dispatch({type:'pickup',uid:charm.uid});
    p.belt[0]=createItem('rvs',1,()=>.5); p.belt[1]=createItem('rvl',1,()=>.5); p.life=1; p.mana=1;
  });
  await np.keyboard.press('Shift+Digit1');
  assert.deepEqual(await np.evaluate(()=>({life:window.sanctuary.engine.state.player.life,maxLife:window.sanctuary.engine.state.stats.maxLife,maxMana:window.sanctuary.engine.state.stats.maxMana})),{life:22,maxLife:60,maxMana:60});
  await np.keyboard.press('Shift+Digit2');
  assert.equal(await np.evaluate(()=>window.sanctuary.engine.state.player.life),60);
  assert.equal(await np.evaluate(()=>window.sanctuary.engine.state.player.mana),60);
  await np.locator('.save-button').click(); await np.waitForFunction(()=>window.sanctuary.engine.state.saved);
  const numericId=await np.evaluate(()=>window.sanctuary.engine.state.activeSaveId);
  await np.reload({waitUntil:'networkidle'}); await enterRoster(np,false);
  await np.getByRole('button',{name:'进入',exact:true}).click(); await np.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
  assert.deepEqual(await np.evaluate(()=>({id:window.sanctuary.engine.state.activeSaveId,life:window.sanctuary.engine.state.player.life,maxLife:window.sanctuary.engine.state.stats.maxLife,maxMana:window.sanctuary.engine.state.stats.maxMana})),{id:numericId,life:60,maxLife:60,maxMana:60});
  assert.equal((await savedCharacters(np)).length,1);
  console.log('Keyboard rejuvenations use active charm caps and survive IndexedDB save/reload PASS');

  const warmthItems=await np.evaluate(async()=>{
    const {createItem}=await import('/src/items.ts'), {grantExperience}=await import('/src/rules.ts');
    const engine=window.sanctuary.engine, p=engine.state.player;
    grantExperience(p,p.level,500);
    const helm=createItem('cap',2,()=>.5), eth=createItem('r05',2,()=>.5);
    helm.sockets=1;
    for(const item of [helm,eth]) { engine.state.area.drops.push({item,x:p.x,y:p.y}); engine.dispatch({type:'pickup',uid:item.uid}); }
    return {helm:helm.uid,eth:eth.uid};
  });
  await np.keyboard.press('t'); await np.locator('[data-focus="skill:37"]').click();
  await np.getByRole('button',{name:'投入 1 技能点',exact:true}).click();
  assert.equal(await np.evaluate(()=>window.sanctuary.engine.state.player.skills[37]),1);
  assert.equal(await np.getByRole('button',{name:'绑定右键',exact:true}).isDisabled(),true);
  await np.keyboard.press('Escape'); await np.keyboard.press('i');
  await np.locator(`[data-focus="item:${warmthItems.helm}"]`).click();
  await np.getByRole('combobox',{name:'选择镶嵌符文或宝石'}).selectOption(warmthItems.eth);
  await np.getByRole('button',{name:'永久镶嵌',exact:true}).click();
  await np.getByRole('button',{name:'装备',exact:true}).click();
  assert.deepEqual(await np.evaluate(()=>({head:!!window.sanctuary.engine.state.player.equipment.head,regen:window.sanctuary.engine.state.stats.manaRegenPercent})),{head:false,regen:30});
  await np.evaluate(async()=>{
    const {grantExperience}=await import('/src/rules.ts'), {EXPERIENCE}=await import('/src/catalog.ts');
    const p=window.sanctuary.engine.state.player;
    grantExperience(p,p.level,EXPERIENCE[15]-p.experience);
  });
  await np.getByRole('button',{name:'装备',exact:true}).click();
  await np.keyboard.press('Escape'); await np.keyboard.press('c');
  assert.match(await np.locator('.derived-row').filter({hasText:'法力回复加成'}).innerText(),/45%/);
  const warmthFrame=await np.evaluate(()=>{
    const engine=window.sanctuary.engine, p=engine.state.player;
    p.mana=0; engine.state.paused=false; engine.step(); engine.state.paused=true;
    const amount=p.mana;
    engine.step(); const pausedAmount=p.mana;
    p.mana=engine.state.stats.maxMana; engine.state.paused=false;
    return {amount,pausedAmount,maxMana:engine.state.stats.maxMana};
  });
  assert.deepEqual(warmthFrame,{amount:10/256,pausedAmount:10/256,maxMana:88});
  await np.keyboard.press('Escape'); await np.locator('.save-button').click();
  await np.waitForFunction(()=>window.sanctuary.engine.state.saved);
  await np.reload({waitUntil:'networkidle'}); await enterRoster(np,false);
  await np.getByRole('button',{name:'进入',exact:true}).click();
  await np.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
  assert.deepEqual(await np.evaluate(()=>({id:window.sanctuary.engine.state.activeSaveId,level:window.sanctuary.engine.state.player.level,warmth:window.sanctuary.engine.state.player.skills[37],regen:window.sanctuary.engine.state.stats.manaRegenPercent,eth:window.sanctuary.engine.state.player.equipment.head.socketed[0]})),{id:numericId,level:15,warmth:1,regen:45,eth:'r05'});
  console.log('Browser rule fixture: UI learns Warmth, sockets/equips Eth, fixed-point frame/paused loop and IndexedDB recalculation PASS');

  const leafItems=await np.evaluate(async()=>{
    const {createItem,getBase,itemHasType}=await import('/src/items.ts');
    const {grantExperience}=await import('/src/rules.ts'), {EXPERIENCE,rawRows,num,text}=await import('/src/catalog.ts');
    const engine=window.sanctuary.engine, p=engine.state.player;
    while(p.level<41) grantExperience(p,p.level,EXPERIENCE[p.level+1]-p.experience);
    const staff=createItem('sst',41,()=>.5); staff.sockets=2;
    const tir=createItem('r03',41,()=>.5), ral=createItem('r08',41,()=>.5), base=getBase('cm3');
    const pool=rawRows('MagicPrefix').filter(row=>[1,100].includes(num(row,'version'))&&num(row,'spawnable')===1&&num(row,'frequency')>0&&num(row,'level')<=99&&(!num(row,'maxlevel')||num(row,'maxlevel')>=99)&&!text(row,'class')&&
      Array.from({length:7},(_,i)=>text(row,`itype${i+1}`)).filter(Boolean).some(type=>itemHasType(base,type))&&
      !Array.from({length:5},(_,i)=>text(row,`etype${i+1}`)).filter(Boolean).some(type=>itemHasType(base,type)));
    const index=pool.findIndex(row=>text(row,'Name')==='Burning'&&text(row,'mod1code')==='skilltab');
    const total=pool.reduce((sum,row)=>sum+num(row,'frequency'),0);
    const roll=(pool.slice(0,index).reduce((sum,row)=>sum+num(row,'frequency'),0)+num(pool[index],'frequency')/2)/total;
    const rolls=[.5,0,roll,.5]; let call=0;
    const charm=createItem('cm3',99,()=>rolls[call++]??.5,'magic'); charm.identified=true;
    for(const item of [staff,tir,ral,charm]) { engine.state.area.drops.push({item,x:p.x,y:p.y}); engine.dispatch({type:'pickup',uid:item.uid}); }
    return {staff:staff.uid,tir:tir.uid,ral:ral.uid,charm:charm.uid};
  });
  await np.keyboard.press('i'); await np.locator(`[data-focus="item:${leafItems.staff}"]`).click();
  for(const rune of [leafItems.tir,leafItems.ral]) {
    await np.getByRole('combobox',{name:'选择镶嵌符文或宝石'}).selectOption(rune);
    await np.getByRole('button',{name:'永久镶嵌',exact:true}).click();
    await np.waitForFunction(rune=>!window.sanctuary.engine.state.player.inventory.some(item=>item.uid===rune),rune);
    await np.locator(`.socket-row option[value="${rune}"]`).waitFor({state:'detached'});
  }
  await np.locator(`.panel-inventory .item-grid [data-focus="item:${leafItems.staff}"]`).hover();
  await np.locator('.item-tooltip').waitFor({state:'visible'});
  assert.match(await np.locator('.item-tooltip').innerText(),/\+3 火焰技能/);
  assert.match(await np.locator('.item-tooltip').innerText(),/未实现属性：ac\/lvl/);
  await np.mouse.move(0,0);
  await np.getByRole('button',{name:'装备',exact:true}).click();
  const leafLevels=()=>np.evaluate(async()=>{
    const {skillLevel}=await import('/src/rules.ts'), engine=window.sanctuary.engine, p=engine.state.player;
    return {fire:skillLevel(p,36),cold:skillLevel(p,39),warmth:skillLevel(p,37),regen:engine.state.stats.manaRegenPercent};
  });
  assert.deepEqual(await leafLevels(),{fire:6,cold:0,warmth:7,regen:117});
  await np.keyboard.press('Escape'); await np.keyboard.press('t');
  await np.locator('[data-focus="skill:36"]').click();
  assert.match(await np.locator('.skill-detail').innerText(),/当前有效等级 6/);
  // Numeric fixture already owns this supported item-granted skill: assign all
  // eight real UI shortcuts without granting additional hard points or gear.
  for(let index=0;index<8;index++)await np.locator('.hotkey-button').nth(index).click();
  await np.getByRole('button',{name:'绑定右键',exact:true}).click();
  await np.waitForFunction(()=>window.sanctuary.engine.state.panel==='none');
  await np.locator('.world-canvas').focus();
  const shortcutBelt=await np.evaluate(()=>JSON.stringify(window.sanctuary.engine.state.player.belt));
  for(let digit=1;digit<=8;digit++) {
    await np.evaluate(()=>window.sanctuary.engine.dispatch({type:'bind',skillId:0,right:true}));
    await np.keyboard.press(`Digit${digit}`);
    assert.equal(await np.evaluate(()=>window.sanctuary.engine.state.player.rightSkill),36);
    assert.equal(await np.evaluate(()=>JSON.stringify(window.sanctuary.engine.state.player.belt)),shortcutBelt);
  }
  await np.keyboard.press('t');
  console.log('Numeric fixture: supported UI skill shortcuts 1–8 bind without drinking belt potions PASS');
  await np.evaluate(async()=>{
    const {grantExperience}=await import('/src/rules.ts'), {EXPERIENCE}=await import('/src/catalog.ts');
    const engine=window.sanctuary.engine, p=engine.state.player;
    while(p.level<42) grantExperience(p,p.level,EXPERIENCE[p.level+1]-p.experience); engine.updateStats();
  });
  assert.equal(await np.evaluate(()=>window.sanctuary.engine.state.player.level),42);
  assert.deepEqual(await leafLevels(),{fire:7,cold:0,warmth:8,regen:129});
  await np.screenshot({path:output+'21-leaf-skills.png'});
  await np.keyboard.press('Escape');
  await np.evaluate(()=>{
    const engine=window.sanctuary.engine, p=engine.state.player, stash=engine.state.area.objects.find(o=>o.kind==='stash');
    p.x=stash.x; p.y=stash.y;
  });
  await np.setViewportSize({width:390,height:844}); await np.keyboard.press('i');
  await np.locator(`[data-focus="item:${leafItems.charm}"]`).tap();
  await np.locator('.item-popup').waitFor({state:'visible'});
  assert.match(await np.locator('.item-popup .item-properties').innerText(),/\+1 火焰法术（仅限法师）/);
  await np.screenshot({path:output+'22-leaf-mobile-charm.png'});
  await np.getByRole('button',{name:'存入仓库',exact:true}).tap();
  assert.deepEqual(await leafLevels(),{fire:6,cold:0,warmth:7,regen:117});
  await np.getByRole('button',{name:'取回背包',exact:true}).tap();
  assert.deepEqual(await leafLevels(),{fire:7,cold:0,warmth:8,regen:129});
  assert.equal(await np.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await np.keyboard.press('Escape'); await np.setViewportSize({width:1100,height:800});
  const leafTarget=await np.evaluate(async()=>{
    const {createArea}=await import('/src/world.ts'), {deriveStats}=await import('/src/rules.ts');
    const engine=window.sanctuary.engine, p=engine.state.player, area=createArea(2,'normal',123,p), m=area.monsters[0];
    engine.enterArea(2); area.tiles=Array.from({length:area.height},()=>Array(area.width).fill(0));
    Object.assign(m,{code:'fallen1',x:8.5,y:5.5,level:1,defense:0,life:1000,maxLife:1000,experience:0,cooldown:100000,dead:false});
    m.resists={physical:0,fire:25,cold:0,lightning:0,poison:0,magic:0}; area.monsters=[m]; area.objects=[];
    engine.state.area=area; p.x=5.5; p.y=5.5; p.mana=100; engine.state.stats=deriveStats(p); engine.rng=()=>0;
    return {x:m.x,y:m.y};
  });
  await np.waitForFunction(()=>Math.abs(window.sanctuary.renderer.worldToScreen(window.sanctuary.engine.state.player).x-550)<100);
  const leafXY=await np.evaluate(p=>window.sanctuary.renderer.worldToScreen(p),leafTarget);
  // Numeric fixture: release after the first real projectile, before a held repeat.
  await holdMouse(np,leafXY,'right',()=>window.sanctuary.engine.state.events.some(e=>e.actor==='player'&&e.kind==='cast'));
  await np.waitForFunction(()=>window.sanctuary.engine.state.area.monsters[0].life<1000);
  assert.equal(await np.evaluate(()=>{const engine=window.sanctuary.engine; engine.state.paused=true; return engine.state.area.monsters[0].life;}),991);
  await np.keyboard.press('Escape'); // Resume the exact-damage numeric pause before testing gameplay swap.
  await np.keyboard.press('x');
  assert.deepEqual(await leafLevels(),{fire:0,cold:0,warmth:2,regen:57});
  await np.keyboard.press('t'); await np.locator('[data-focus="skill:36"]').click();
  assert.equal(await np.getByRole('button',{name:'绑定右键',exact:true}).isDisabled(),true);
  await np.keyboard.press('Escape'); await np.keyboard.press('x');
  await np.evaluate(()=>{const engine=window.sanctuary.engine; engine.state.paused=false; engine.enterArea(1);});
  await np.locator('.save-button').click(); await np.waitForFunction(()=>window.sanctuary.engine.state.saved);
  await np.reload({waitUntil:'networkidle'}); await enterRoster(np,false);
  await np.getByRole('button',{name:'进入',exact:true}).click(); await np.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
  assert.deepEqual(await leafLevels(),{fire:7,cold:0,warmth:8,regen:129});
  assert.deepEqual(await np.evaluate(()=>{const engine=window.sanctuary.engine,p=engine.state.player; return {id:engine.state.activeSaveId,staff:p.equipment.weapon.uid,word:p.equipment.weapon.runeword,hardWarmth:p.skills[37],hardFire:p.skills[36]??0};}),{id:numericId,staff:leafItems.staff,word:'Leaf',hardWarmth:1,hardFire:0});
  console.log('Browser rule fixture: UI creates/equips Leaf, actual Burning charm level gate/storage, mouse spell damage, swap and IndexedDB preservation PASS');

  const attacks=await browser.newContext({viewport:{width:1100,height:800},reducedMotion:'reduce'});
  const ap=await attacks.newPage(); ap.on('pageerror',e=>errors.push('attacks: '+e.message));
  ap.on('console',message=>{if(message.type()==='error')errors.push('attacks: '+message.text());});
  await ap.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'}); await enterRoster(ap,false);
  await ap.getByRole('button',{name:'新建角色',exact:true}).click(); await ap.locator('[data-class="ama"]').click();
  await ap.locator('#hero-name').fill('暴击验收'); await ap.getByRole('button',{name:'开启旅程',exact:true}).click();
  await ap.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
  const deadlyItems=await ap.evaluate(async()=>{
    const {createItem}=await import('/src/items.ts');
    const {EXPERIENCE}=await import('/src/catalog.ts'), engine=window.sanctuary.engine, p=engine.state.player;
    p.level=80; p.experience=EXPERIENCE[80]; p.skillPoints=79; p.statPoints=395;
    const weapon=createItem('hax',80,()=>.5), lo=createItem('r28',80,()=>.5);
    weapon.sockets=1;
    for(const item of [weapon,lo]) { engine.state.area.drops.push({item,x:p.x,y:p.y}); engine.dispatch({type:'pickup',uid:item.uid}); }
    return {weapon:weapon.uid,lo:lo.uid};
  });
  await ap.keyboard.press('t'); await ap.getByRole('button',{name:'被动与魔法',exact:true}).click();
  await ap.locator('[data-focus="skill:9"]').click(); await ap.getByRole('button',{name:'投入 1 技能点',exact:true}).click();
  await ap.keyboard.press('Escape'); await ap.keyboard.press('i');
  await ap.locator(`[data-focus="item:${deadlyItems.weapon}"]`).click();
  await ap.getByRole('combobox',{name:'选择镶嵌符文或宝石'}).selectOption(deadlyItems.lo);
  await ap.getByRole('button',{name:'永久镶嵌',exact:true}).click();
  await ap.getByRole('button',{name:'装备',exact:true}).click();
  await ap.keyboard.press('Escape'); await ap.keyboard.press('c');
  assert.match(await ap.locator('.derived-row').filter({hasText:'普通攻击暴击'}).innerText(),/16%/);
  assert.match(await ap.locator('.derived-row').filter({hasText:'致命攻击'}).innerText(),/20%/);
  await ap.keyboard.press('Escape');
  const attackPoint=await ap.evaluate(async()=>{
    const {createArea}=await import('/src/world.ts'), {deriveStats}=await import('/src/rules.ts');
    const engine=window.sanctuary.engine, p=engine.state.player, area=createArea(2,'normal',123,p), m=area.monsters[0];
    engine.enterArea(2);
    area.tiles=Array.from({length:area.height},()=>Array(area.width).fill(0));
    Object.assign(m,{code:'fallen1',x:5.8,y:5.5,level:1,defense:0,life:1000,maxLife:1000,experience:0,cooldown:100000,dead:false});
    m.resists={physical:75,fire:0,cold:0,lightning:0,poison:0,magic:0};
    area.monsters=[m]; area.objects=[]; engine.state.area=area;
    p.x=5.5; p.y=5.5; p.strength=0;
    const weapon=p.equipment.weapon; weapon.minDamage=101; weapon.maxDamage=101;
    weapon.mods.minFire=10; weapon.mods.maxFire=10;
    engine.state.stats=deriveStats(p); engine.rng=()=>0;
    return {x:m.x,y:m.y};
  });
  await ap.waitForFunction(()=>Math.abs(window.sanctuary.renderer.worldToScreen(window.sanctuary.engine.state.player).x-550)<100);
  const attackXY=await ap.evaluate(p=>window.sanctuary.renderer.worldToScreen(p),attackPoint);
  await holdMouse(ap,attackXY,'left',()=>window.sanctuary.engine.state.area.monsters[0].life<1000);
  await ap.waitForFunction(()=>window.sanctuary.engine.state.area.monsters[0].life<1000);
  assert.equal(await ap.evaluate(()=>{const engine=window.sanctuary.engine; engine.state.paused=true; return engine.state.area.monsters[0].life;}),939.5);
  console.log('Browser rule fixture: UI learns Critical Strike and sockets Lo; mouse attack doubles physical once before resistance, not added fire PASS');

  for (const mobile of [false, true]) {
    const rosterContext = await browser.newContext({viewport: mobile ? {width:390,height:844} : {width:1440,height:900}, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, reducedMotion:'reduce'});
    const rp = await rosterContext.newPage();
    rp.on('pageerror',e=>errors.push('roster: '+e.message));
    rp.on('console',m=>{if(m.type()==='error')errors.push('roster: '+m.text());});
    const activate = locator => mobile ? locator.tap() : locator.click();
    await rp.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'}); await enterRoster(rp,false);
    assert.equal(await rp.getByRole('button',{name:'进入',exact:true}).isDisabled(),true);
    assert.equal(await rp.getByRole('button',{name:'删除',exact:true}).isDisabled(),true);
    const ids=[];
    for (const [classId,name] of [['sor','同名旅人'],['bar','同名旅人'],['ama','长'.repeat(24)],['pal','最后一位']]) {
      await activate(rp.getByRole('button',{name:'新建角色',exact:true}));
      await activate(rp.locator(`[data-class="${classId}"]`)); await rp.locator('#hero-name').fill(name);
      await activate(rp.getByRole('button',{name:'开启旅程',exact:true}));
      await rp.waitForFunction(()=>window.sanctuary.engine.state.screen==='game'&&window.sanctuary.engine.state.saved);
      ids.push(await rp.evaluate(()=>window.sanctuary.engine.state.activeSaveId));
      await rp.keyboard.press('Escape'); await activate(rp.getByRole('button',{name:'返回角色列表',exact:true}));
      await rp.waitForFunction(()=>window.sanctuary.engine.state.saved);
    }
    const select = async id => {
      await activate(rp.locator(`[data-save-id="${id}"]`));
      await rp.waitForFunction(id=>document.querySelector('.character-save.selected')?.getAttribute('data-save-id')===id,id);
    };
    await select(ids[2]); assert.equal(await rp.locator('.character-preview h2').innerText(),'长'.repeat(24));
    if(mobile) {
      await rp.setViewportSize({width:320,height:568});
      const longNameBounds=await rp.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect(),image=r('.character-figure .portrait-art'),name=r('.character-preview h2'),actions=r('.character-actions'),preview=r('.character-preview');return {imageInside:image.top>=preview.top,nameAboveActions:name.bottom<=actions.top,portraitAboveName:image.bottom<=name.top,overflow:document.documentElement.scrollWidth>innerWidth};});
      assert.deepEqual(longNameBounds,{imageInside:true,nameAboveActions:true,portraitAboveName:true,overflow:false});
      await rp.setViewportSize({width:390,height:844});
    }
    await select(ids[3]);
    await select(ids[0]);
    if(mobile) assert.ok(await rp.locator('.character-list').evaluate(e=>e.scrollTop)>0);
    assert.equal(await rp.locator('.character-preview h2').innerText(),'同名旅人');
    assert.match(await rp.locator('.character-preview .class-trees').innerText(),/法师/);
    assert.match(await rp.locator(`[data-save-id="${ids[0]}"] .saved-level`).innerText(),/等级 1/);
    assert.equal(await rp.locator(`[data-save-id="${ids[0]}"] .saved-class`).innerText(),'法师');
    await rp.waitForFunction(()=>{const image=document.querySelector('.character-figure .portrait-art');return image?.complete&&image.naturalWidth>0;});
    const geometry=await rp.evaluate(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect(),left=rect('.character-sidebar'),right=rect('.character-preview'),image=rect('.character-figure .portrait-art'),actions=rect('.character-actions'),cards=[...document.querySelectorAll('.character-save')].map(e=>e.getBoundingClientRect());return {sideBySide:right.left>=left.right-1,vertical:cards.every((r,i)=>!i||r.top>cards[i-1].top),buttonsBelow:actions.top>=image.bottom,buttonsInside:actions.bottom<=right.bottom,overflow:document.documentElement.scrollWidth>innerWidth};});
    assert.deepEqual(geometry,{sideBySide:true,vertical:true,buttonsBelow:true,buttonsInside:true,overflow:false});
    await rp.screenshot({path:output+(mobile?'25-mobile-roster.png':'24-desktop-roster.png')});
    const originalRecords=await savedCharacters(rp);
    rp.once('dialog',d=>d.dismiss()); await activate(rp.getByRole('button',{name:'删除',exact:true}));
    assert.deepEqual(await savedCharacters(rp),originalRecords);
    rp.once('dialog',async d=>{assert.match(d.message(),/同名旅人.*等级 1.*法师/);await d.accept();});
    await activate(rp.getByRole('button',{name:'删除',exact:true}));
    await rp.waitForFunction(()=>!window.sanctuary.engine.state.loadingSave&&window.sanctuary.engine.state.characters.length===3);
    assert.deepEqual(await savedCharacters(rp),originalRecords.filter(r=>r.id!==ids[0]));
    await select(ids[1]); await activate(rp.getByRole('button',{name:'进入',exact:true}));
    await rp.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
    assert.equal(await rp.evaluate(()=>window.sanctuary.engine.state.activeSaveId),ids[1]);
    assert.equal(await rp.evaluate(()=>window.sanctuary.engine.state.player.classId),'bar');
    await rp.keyboard.press('Escape'); await activate(rp.getByRole('button',{name:'返回角色列表',exact:true}));
    await rp.waitForFunction(()=>window.sanctuary.engine.state.saved);
    for(const id of ids.slice(1)) {
      await select(id); rp.once('dialog',d=>d.accept()); await activate(rp.getByRole('button',{name:'删除',exact:true}));
      await rp.waitForFunction(id=>!window.sanctuary.engine.state.loadingSave&&!window.sanctuary.engine.state.characters.some(c=>c.id===id),id);
    }
    assert.equal(await rp.evaluate(()=>window.sanctuary.engine.state.activeSaveId),null);
    assert.deepEqual(await savedCharacters(rp),[]);
    await rp.reload({waitUntil:'networkidle'}); await enterRoster(rp,false);
    assert.equal(await rp.locator('.character-save').count(),0);
    assert.equal(await rp.getByRole('button',{name:'进入',exact:true}).isDisabled(),true);
    assert.equal(await rp.getByRole('button',{name:'删除',exact:true}).isDisabled(),true);
    assert.equal(await rp.getByRole('button',{name:'新建角色',exact:true}).isEnabled(),true);
    await rosterContext.close();
    console.log(`${mobile?'Mobile touch':'Desktop'} roster: vertical details, right portrait/actions, long name/scroll, selected entry, cancel/delete isolation, active deletion and empty reload PASS`);
  }

  const legacy=JSON.stringify({version:1,player:before.player,seed:777,timestamp:1});
  const migration=await browser.newContext({viewport:{width:1100,height:800}});
  await migration.addInitScript(value=>{if(location.origin==='http://127.0.0.1:5173'&&!localStorage.getItem('sanctuary-h5-save-v1'))localStorage.setItem('sanctuary-h5-save-v1',value);},legacy);
  const lp=await migration.newPage(); lp.on('pageerror',e=>errors.push('migration: '+e.message));
  await lp.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'}); await enterRoster(lp);
  await lp.locator('[data-save-id="legacy-localstorage-v1"]').waitFor();
  assert.equal(await lp.locator('.character-save').count(),1);
  await lp.getByRole('button',{name:'进入',exact:true}).click(); await lp.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
  await lp.evaluate(async()=>{window.sanctuary.engine.state.player.gold=987;await window.sanctuary.engine.save(false);});
  await lp.reload({waitUntil:'networkidle'}); await enterRoster(lp);
  await lp.getByRole('button',{name:'进入',exact:true}).click(); await lp.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
  assert.equal(await lp.evaluate(()=>window.sanctuary.engine.state.player.gold),987);
  assert.equal(await lp.evaluate(()=>localStorage.getItem('sanctuary-h5-save-v1')),legacy);
  const concurrent=await migration.newPage(); concurrent.on('pageerror',e=>errors.push('concurrent migration: '+e.message));
  await concurrent.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'}); await enterRoster(concurrent);
  assert.equal(await concurrent.locator('.character-save').count(),1);
  await concurrent.getByRole('button',{name:'进入',exact:true}).click(); await concurrent.waitForFunction(()=>window.sanctuary.engine.state.screen==='game');
  assert.equal(await concurrent.evaluate(()=>window.sanctuary.engine.state.player.gold),987);
  console.log('Real IndexedDB legacy migration, stale snapshot protection across reload/tabs and retained localStorage PASS');
  await lp.keyboard.press('Escape'); await lp.getByRole('button',{name:'返回角色列表',exact:true}).click();
  await lp.waitForFunction(()=>window.sanctuary.engine.state.saved);
  lp.once('dialog',d=>d.accept()); await lp.getByRole('button',{name:'删除',exact:true}).click();
  await lp.waitForFunction(()=>!window.sanctuary.engine.state.loadingSave&&window.sanctuary.engine.state.characters.length===0);
  await concurrent.evaluate(()=>window.sanctuary.engine.save(false));
  assert.equal(await concurrent.evaluate(()=>window.sanctuary.engine.state.saved),false);
  await concurrent.reload({waitUntil:'networkidle'}); await enterRoster(concurrent);
  assert.equal(await concurrent.locator('.character-save').count(),0);
  await lp.reload({waitUntil:'networkidle'}); await enterRoster(lp);
  assert.equal(await lp.locator('.character-save').count(),0);
  assert.equal(await lp.evaluate(()=>localStorage.getItem('sanctuary-h5-save-v1')),legacy);
  const deletedLegacy=await lp.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('sanctuary-h5',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const record=await new Promise((resolve,reject)=>{const r=db.transaction('characters').objectStore('characters').get('legacy-localstorage-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return record;
  });
  assert.deepEqual(deletedLegacy,{id:'legacy-localstorage-v1',deleted:true});
  console.log('Deleted legacy character stays absent after stale-tab save and reload; backup retained without player data in marker PASS');

  const unavailable=await browser.newContext({reducedMotion:'reduce'});
  await unavailable.addInitScript(()=>Object.defineProperty(window,'indexedDB',{get(){throw new Error('storage denied');}}));
  const up=await unavailable.newPage(); up.on('pageerror',e=>errors.push('unavailable: '+e.message));
  await up.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'}); await enterRoster(up,false);
  assert.equal(await up.getByRole('button',{name:'新建角色',exact:true}).isDisabled(),true);
  assert.match(await up.locator('.storage-status').innerText(),/不支持 IndexedDB/);
  const corrupt=await browser.newContext({reducedMotion:'reduce'});
  await corrupt.addInitScript(()=>{if(location.origin==='http://127.0.0.1:5173')localStorage.setItem('sanctuary-h5-save-v1','{bad-json');});
  const cp=await corrupt.newPage(); cp.on('pageerror',e=>errors.push('corrupt legacy: '+e.message));
  await cp.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'}); await enterRoster(cp,false);
  assert.match(await cp.locator('.storage-status').innerText(),/旧.*损坏/);
  assert.equal(await cp.getByRole('button',{name:'新建角色',exact:true}).isEnabled(),true);
  assert.equal(await cp.evaluate(()=>localStorage.getItem('sanctuary-h5-save-v1')),'{bad-json');
  console.log('Reduced-motion opening, unavailable IndexedDB and corrupt legacy preservation PASS');
  await verifyWaypointTabs(false); await verifyWaypointTabs(true);
  await verifyItemSelection(false); await verifyItemSelection(true);
  assert.deepEqual(errors,[]);
  console.log('Console errors: 0');
} catch (error) {
  const failed=await game();
  console.error('Browser failure state:',JSON.stringify({screen:failed.screen,areaId:failed.areaId,panel:failed.panel,position:{x:failed.player?.x,y:failed.player?.y},messages:failed.messages}), 'Console errors:', errors);
  await page.screenshot({path:output+'browser-failure.png'});
  throw error;
} finally {await browser.close();}
