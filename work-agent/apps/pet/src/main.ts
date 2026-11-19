import './style.css';
import './pet.css';
import type { PetInteraction, PetState, PetUtterance, StreamEvent, UtteranceQuickAction } from '../../../src/contracts/index.ts';
import { Api } from './api.ts';
import type { Snapshot } from './api.ts';
import { bridge, native } from './bridge.ts';
import { BubbleQueue } from './bubbles.ts';
import type { BubbleEntry } from './bubbles.ts';
import { el, button, factsNode, showError } from './dom.ts';
import { bubblePlacement, hitTest } from './geometry.ts';
import { Gestures } from './gestures.ts';
import { createPet, Entertainer, skin, stateAction } from './pet.ts';
import { clientDefaults, companionDefaults, offlineState, personaDefaults, quietExplanation } from './settings.ts';
import { Panels } from './panels.ts';
import type { PanelKind, PanelModel } from './panels.ts';
import { SoftAudio } from './audio.ts';
import { Playtime, reactionFrames, touchReaction } from './playtime.ts';

const root=document.querySelector<HTMLElement>('#app')!;
const view=new URLSearchParams(location.search).get('view') || 'pet';
const master=view==='pet';
const model:PanelModel={
  api:undefined as unknown as Api,state:offlineState(),persona:{persona:structuredClone(personaDefaults),firstRun:false},settings:structuredClone(companionDefaults),local:structuredClone(clientDefaults),notices:[],localUtterances:[],
  async open(kind){
    if(master&&native){const geometry=await bridge.geometry();const rect=bubblePlacement(geometry.pet,{width:kind==='onboarding'?420:360,height:kind==='onboarding'?560:520},geometry.work);await bridge.aux('panel',kind,rect);return;}
    if(!master&&native&&view==='bubble'){await bridge.send('open-panel',kind);return;}
    panelRoot.hidden=false;await panels.show(kind);
  },
  close(){panelRoot.hidden=true;if(native)void bridge.hide('panel');},
  async quiet(mode,minutes){
    if(mode!=='off'){stopPlay();reactionTrail=[];gestures.cancel();await audio.pause();queue.clear();}
    model.state=await api.request<PetState>('/pet/quiet','POST',{mode,minutes});applyState(model.state);await bridge.send('state-local',model.state);
  },
  async saveLocal(patch){model.local={...model.local,...patch};await bridge.save(model.local);await applyLocal();},
};
const petRoot=el('div',undefined,'pet-host'),pet=createPet(),badge=el('span',undefined,'badge'),wake=button('唤醒',async()=>{wake.disabled=true;try{await api.wake();}catch(e){showError(e instanceof Error?e.message:'唤醒失败','error wake-error');}finally{wake.disabled=false;}}),progress=el('small',undefined,'progress'),hoverLabel=el('span',undefined,'hover-label');
hoverLabel.hidden=true;
const panelRoot=el('aside');panelRoot.hidden=true;
const panels=new Panels(panelRoot,model);
const bubbleRoot=el('section',undefined,'bubble');bubbleRoot.hidden=true;bubbleRoot.setAttribute('aria-label','团子气泡');
let bubbleEntry:BubbleEntry|undefined;
let interactionAction:string|undefined,lastInteraction=Date.now(),pendingUserResponses=0;
let reactionTrail:ReturnType<typeof reactionFrames>=[];
let touchPoint={x:80,y:90},playPointer:{x:number;y:number;at:number}|undefined;
const localAnimationIds=new Set<string>();
const playtime=new Playtime(),playHint=el('span',undefined,'play-hint');
playHint.hidden=true;playHint.setAttribute('role','status');
let movingWindow=false,rendering=true;
let firstRunOpened=false,offlineEntered=false,demo=false,menu:HTMLElement|undefined;
const entertainment=new Entertainer();
const queue=new BubbleQueue(entry=>{bubbleEntry=entry;void displayBubble(entry);});
const audio=new SoftAudio(async e=>{await interact(e);});
const api=new Api(snapshot,handleEvent,goOffline);model.api=api;
const gestures=new Gestures(e=>{void interact(e).catch(()=>{});},id=>reaction(id));

async function snapshot(s:Snapshot):Promise<void>{
  document.querySelector('#app .wake-error')?.remove();
  panels.invalidateMemoryDisplay();
  model.persona=s.persona;model.notices=s.notices.items;model.settings=s.settings;offlineEntered=false;
  applyState(s.state);
  if(s.persona.firstRun&&!firstRunOpened&&view!=='bubble'){firstRunOpened=true;reaction('drop_land');await model.open('onboarding');}
  else if(!master&&view!=='bubble'&&!firstRunOpened){firstRunOpened=true;await model.open(view as PanelKind);}
  if(!panelRoot.hidden&&panels.kind==='notices'&&!panels.noticeDetailOpen)await panels.show('notices');
  if(!panelRoot.hidden&&panels.kind==='memory')await panels.show('memory');
}
function applyState(state:PetState):void{
  model.state=state;
  const hidden=state.quietReasons.includes('screen_share');
  if(hidden!==demo){demo=hidden;if(master)void bridge.demo(demo);}
  petRoot.hidden=demo;
  if(state.activity==='quiet'||state.quietReasons.length){queue.clear();reactionTrail=[];interactionAction=undefined;entertainment.action=undefined;stopPlay();gestures.cancel();}
  if(['working','waiting_auth','alert','offline'].includes(state.activity))stopPlay();
  audio.sync(state);
  badge.textContent=String(state.badge.notices);badge.hidden=demo||!state.badge.notices||(state.activity==='quiet'&&!model.local.badgeInQuiet);
  wake.hidden=state.activity!=='offline';
  if(master)void updateHits();
  progress.textContent=state.progress?`${state.progress.label} ${state.progress.done}/${state.progress.total}`:'';
  draw();
}
async function handleEvent(event:StreamEvent):Promise<void>{
  if(event.type==='pet.state')applyState(event.data.state);
  if(event.type==='pet.utterance')offer(event.data.utterance);
  if(event.type==='notice.created'||event.type==='notice.updated'){
    const notice=event.data.notice;
    if(notice.notice.sensitivity==='secret'||notice.notice.sensitivity==='confidential'&&!model.settings.discloseConfidentialInBubble||notice.notice.kind==='companion.reminder'&&!notice.notice.facts.some(f=>f.label==='原话'))eraseNotice(notice.id);
    model.notices=model.notices.filter(n=>n.id!==notice.id).concat(notice);
    if(!panelRoot.hidden&&panels.kind==='notices'&&(!panels.noticeDetailOpen||notice.notice.kind==='companion.reminder'&&!notice.notice.facts.some(f=>f.label==='原话')))await panels.show('notices');
  }
  if(event.type==='persona.updated')model.persona={persona:event.data.persona,firstRun:false};
  if(event.type==='settings.updated')model.settings=event.data.settings;
  if(event.type==='memory.changed'){
    if(event.data.change==='forgotten'&&event.data.id)panels.eraseMemory(event.data.id);
    if(!panelRoot.hidden&&panels.kind==='memory')await panels.show('memory');
  }
  if(event.type==='reminder.changed'&&event.data.reminder.status==='cancelled'){
    const reminder=event.data.reminder;panels.eraseReminder(reminder.id);
    for(const notice of model.notices)if(notice.id===reminder.noticeId||notice.notice.dedupeKey===`reminder:${reminder.id}`)eraseNotice(notice.id);
  }
  if(event.type==='bye')goOffline();
}
function eraseNotice(id:string):void{
  queue.removeNotice(id);model.localUtterances=model.localUtterances.filter(u=>u.ref?.noticeId!==id);
  if(!master&&bubbleEntry&&(bubbleEntry.merged||[bubbleEntry]).some(e=>e.utterance.ref?.noticeId===id)){bubbleEntry=undefined;bubbleRoot.replaceChildren();bubbleRoot.hidden=true;}
}
function goOffline():void{
  if(offlineEntered)return;offlineEntered=true;
  queue.clear();void audio.pause();applyState({...model.state,activity:'offline'});
  if(master){
    if(!demo)queue.push({priority:3,utterance:{id:`offline:${Date.now()}`,sensitivity:'normal',text:`后台没在运行，${model.persona.persona.name}先睡会儿，办公功能暂时离线。`}});
  }else if(view!=='bubble')showError('办公功能离线，请从团子上的唤醒按钮恢复');
}
function offer(u:PetUtterance,user=false):void{
  if(!master||!api.cursor.accept(u))return;
  if(model.state.activity==='quiet'||demo||u.sensitivity==='secret')return;
  const notice=model.notices.find(n=>n.id===u.ref?.noticeId);
  if(playtime.kind&&(u.ref?.noticeId||u.quickActions?.some(a=>a.open==='notice'||a.notice))){stopPlay();reactionTrail=[];}
  const safe=u.sensitivity==='confidential'&&!model.settings.discloseConfidentialInBubble?{...u,text:'有一条敏感通知',facts:undefined}:u;
  if(Array.from(safe.text).length>40){model.localUtterances.push(safe);if(model.localUtterances.length>100)model.localUtterances.shift();void bridge.send('utterance-archive',safe);}
  queue.push({utterance:safe,title:safe===u?notice?.notice.title:undefined,dedupeKey:notice?.notice.dedupeKey,priority:user||pendingUserResponses>0?3:notice?.notice.urgency==='high'?2:notice||u.quickActions?.some(a=>a.open==='notice')?1:0});
}
function stopPlay():void{
  if(playtime.kind&&!gestures.isDragging())gestures.cancel();
  playtime.stop();playPointer=undefined;playHint.hidden=true;playHint.textContent='';delete pet.dataset.play;delete pet.dataset.playPhase;
}
function reaction(id:string):void{
  if(model.state.activity==='quiet'||demo)return;
  localAnimationIds.add(id);reactionTrail=reactionFrames(id,Date.now());draw();
}
async function interact(e:PetInteraction):Promise<void>{
  if(e.kind!=='hover'&&e.kind!=='utterance_dismissed')lastInteraction=Date.now();
  if(e.kind==='drag_start'){stopPlay();queue.clear();movingWindow=true;await bridge.drag();}
  if(e.kind==='drop'){
    movingWindow=false;
    const geometry=await bridge.geometry();
    await model.saveLocal({positions:{...model.local.positions,[geometry.screenId]:{x:geometry.pet.x,y:geometry.pet.y}}});
  }
  if(e.kind==='click')reaction(touchReaction(touchPoint));
  if(e.kind==='double_click')reaction(touchReaction(touchPoint,true));
  if(model.state.activity==='offline')return;
  pendingUserResponses++;
  try{const result=await api.request<{utterance:PetUtterance|null}>('/pet/interactions','POST',e);if(result.utterance)offer(result.utterance,true);}finally{pendingUserResponses--;}
}
async function dismissBubble():Promise<void>{
  const entry=bubbleEntry;if(!entry)return;
  queue.close();
  if(!entry.utterance.id.startsWith('offline:'))for(const e of entry.merged||[entry])await interact({kind:'utterance_dismissed',id:e.utterance.id});
}
async function quickAction(action:UtteranceQuickAction):Promise<void>{
  if(action.notice){await api.request(`/notices/${encodeURIComponent(action.notice.noticeId)}/${action.notice.op}`,'POST',action.notice.op==='snooze'?{minutes:15}:undefined);await api.resync();}
  if(action.open)await model.open(action.open==='notice'?'notices':action.open==='chat'?'chat':'help');
  if(master)queue.close();else await bridge.send('bubble-control','close');
}
function renderBubble(entry:BubbleEntry):void{
  const u=entry.utterance;bubbleRoot.replaceChildren();bubbleRoot.hidden=false;bubbleRoot.dataset.direction=entry.direction||'top';
  bubbleRoot.append(button('×',()=>master?dismissBubble():bridge.send('bubble-control','dismiss'),'bubble-close'));
  const content=el('div',undefined,'bubble-content');
  content.append(el('p',Array.from(u.text).slice(0,40).join(''),'utterance-text'));
  if(entry.title)content.append(el('h3',entry.title));
  if(u.facts)content.append(factsNode(u.facts,4));
  if((u.facts?.length||0)>4)content.append(button('查看全部',()=>model.open('notices')));
  for(const action of (u.quickActions||[]).slice(0,2))content.append(button(action.label,()=>quickAction(action)));
  if(Array.from(u.text).length>40)content.append(button('查看完整台词',()=>model.open('notices')));
  bubbleRoot.append(content);
}
function isQuiet():boolean{return model.state.activity==='quiet'||demo;}
async function displayBubble(entry?:BubbleEntry):Promise<void>{
  if(entry&&(entry.utterance.ref?.noticeId||entry.utterance.quickActions?.some(action=>action.open==='notice'||action.notice))){stopPlay();reactionTrail=[];}
  if(!entry){bubbleRoot.replaceChildren();bubbleRoot.hidden=true;if(master&&native)await bridge.hide('bubble');draw();return;}
  if(master&&native){
    const geometry=await bridge.geometry();const height=entry.utterance.quickActions?.length?240:entry.utterance.facts?.length?210:100;
    const rect=bubblePlacement(geometry.pet,{width:280,height},geometry.work);entry.direction=rect.direction;
    if(bubbleEntry!==entry||isQuiet())return;
    await bridge.aux('bubble','bubble',rect);
    if(bubbleEntry!==entry||isQuiet()){await bridge.hide('bubble');return;}
    await bridge.send('bubble-data',{...entry,direction:rect.direction});
  }else renderBubble(entry);
  draw();
}
function draw():void{
  if(!master)return;
  interactionAction=reactionTrail.find(frame=>Date.now()<frame.until)?.action;
  const game=playtime.tick(Date.now());
  const hint=game&&!model.persona.persona.taboos.some(word=>game.hint.includes(word))?game.hint:'';
  if(playHint.textContent!==hint)playHint.textContent=hint;
  playHint.hidden=!hint;
  if(game){pet.dataset.play=playtime.kind;pet.dataset.playPhase=game.phase;pet.style.setProperty('--throw-side',String(game.side));pet.style.setProperty('--peek-side',String(game.side));}
  else {delete pet.dataset.play;delete pet.dataset.playPhase;}
  const work=model.settings.workHours.days.includes(new Date().getDay())&&new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})>=model.settings.workHours.start&&new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})<model.settings.workHours.end;
  const active=entertainment.tick({now:Date.now(),lastInteraction,state:model.state,bubble:!!bubbleEntry,dragging:gestures.isDragging(),frequency:model.local.entertainment,work});
  const expression=model.state.expression;
  const state=expression?.activityId==='happy'&&expression.animationId&&localAnimationIds.has(expression.animationId)?{...model.state,expression:undefined}:model.state;
  const speechAnimation=bubbleEntry?.utterance.animation&&!bubbleEntry.utterance.ref?.noticeId&&localAnimationIds.has(bubbleEntry.utterance.animation)?undefined:bubbleEntry?.utterance.animation;
  const action=stateAction(state,false,game?.action||interactionAction||speechAnimation,audio.isPlaying()?'music_nod':bubbleEntry&&model.state.activity==='idle'?'sign_hold':active);
  pet.dataset.action=action;
}
async function updateHits():Promise<void>{
  const scale=model.local.size/112;
  const areas=skin.hitAreas.map(r=>({x:r.x*scale,y:r.y*scale,width:r.width*scale,height:r.height*scale}));
  if(model.state.activity==='offline')areas.push({x:50*scale,y:134*scale,width:70*scale,height:26*scale});
  await bridge.hits(areas);
}
async function applyLocal():Promise<void>{
  if(!master)return;
  const scale=model.local.size/112;const size=Math.round(160*scale);
  pet.style.width=`${size}px`;pet.style.height=`${size}px`;await bridge.resize(size);
  await updateHits();
  pet.classList.toggle('mint',model.local.decorations.includes('headset_mint'));pet.classList.toggle('sakura',model.local.decorations.includes('headset_sakura'));pet.classList.toggle('cap-equipped',model.local.decorations.includes('nightcap'));pet.classList.toggle('yarn-equipped',model.local.decorations.includes('ball_yarn'));
  if(bubbleEntry)await displayBubble(bubbleEntry);
  entertainment.schedule(model.local.entertainment);
}
function playAvailable():boolean{
  return master&&!isQuiet()&&!model.state.quietReasons.length&&!document.hidden&&rendering&&!['working','waiting_auth','alert','offline'].includes(model.state.activity)&&!bubbleEntry?.utterance.ref?.noticeId&&!bubbleEntry?.utterance.quickActions?.some(action=>action.open==='notice'||action.notice);
}
async function menuAction(action:string):Promise<void>{
  menu?.remove();menu=undefined;
  if(['notices','memory','chat','settings'].includes(action)){await model.open(action as PanelKind);return;}
  if(action==='demo-toggle'){await model.quiet(demo?'off':'demo');return;}
  if(action==='quiet-off'){await model.quiet('off');return;}
  if(action==='dnd'){await model.quiet('dnd');return;}
  if(action.startsWith('dnd:')){await model.quiet('dnd',action==='dnd:work'?panels.untilWorkEnd():Number(action.split(':')[1]));return;}
  if(action==='play-stop'){stopPlay();draw();return;}
  if(action.startsWith('game:')){
    if(!playAvailable())return;
    stopPlay();gestures.cancel();reactionTrail=[];entertainment.action=undefined;
    const kind=action==='game:ball'?'ball':'box',animationId=kind==='ball'?'play_ball':'box_peek';localAnimationIds.add(animationId);
    playtime.start(kind,Date.now());draw();
    await interact({kind:'play',activityId:animationId});return;
  }
  if(action==='feed'){stopPlay();reaction('eat_snack');await interact({kind:'feed'});return;}
  if(action.startsWith('play:')){stopPlay();const id=action.slice(5);reaction(id);await interact({kind:'play',activityId:id});return;}
  if(action.startsWith('size:')){await model.saveLocal({size:Number(action.slice(5)) as 96|112|128});return;}
  if(action==='quit'){await audio.pause().catch(()=>{});api.stop();await bridge.quit();}
}
function contextMenu():void{
  menu?.remove();menu=el('div',undefined,'context-menu');
  for(const [label,action] of [['通知中心','notices'],['聊天','chat'],['记忆','memory'],['喂零食','feed']])menu.append(button(label,()=>menuAction(action)));
  const play=el('details');play.append(el('summary','玩一会儿'));
  for(const [label,action] of [['抛接球','game:ball'],['纸箱躲猫猫','game:box'],['结束玩耍','play-stop']]){const control=button(label,()=>menuAction(action));control.disabled=action==='play-stop'?!playtime.kind:!playAvailable();play.append(control);}
  for(const [label,id] of [['小球','play_ball'],['听歌（静音动作）','music_nod'],['伸懒腰','stretch'],['翻小本子','read_notebook']]){if(id==='read_notebook'&&!model.state.growth.unlocked.includes('act_read_notebook'))continue;play.append(button(label,()=>menuAction(`play:${id}`)));}menu.append(play);
  const quiet=el('details');quiet.append(el('summary','勿扰'));
  for(const [label,id] of [['30 分钟','30'],['1 小时','60'],['2 小时','120'],['到今天下班','work']])quiet.append(button(label,()=>menuAction(`dnd:${id}`)));
  quiet.append(button('直到我关闭',()=>menuAction('dnd')),el('p',quietExplanation,'muted'));menu.append(quiet);
  menu.append(button('演示模式（隐藏团子）',()=>menuAction('demo-toggle')),button('关闭勿扰',()=>menuAction('quiet-off')));
  const size=el('details');size.append(el('summary','大小'));for(const n of [96,112,128])size.append(button(String(n),()=>menuAction(`size:${n}`)));menu.append(size,button('设置…',()=>menuAction('settings')),button('退出团子（后台继续运行）',()=>menuAction('quit')));
  if(native){menu.remove();menu=undefined;void nativeContextMenu();}else root.append(menu);
}
async function nativeContextMenu():Promise<void>{
  const {Menu,Submenu,MenuItem}=await import('@tauri-apps/api/menu');
  const item=async(text:string,id:string)=>MenuItem.new({text,id,enabled:id.startsWith('game:')?playAvailable():id==='play-stop'?!!playtime.kind:true,action:()=>{void menuAction(id).catch(()=>showError('办公功能离线'));}});
  const playItems=await Promise.all([item('抛接球','game:ball'),item('纸箱躲猫猫','game:box'),item('结束玩耍','play-stop'),item('小球','play:play_ball'),item('听歌（静音动作）','play:music_nod'),item('伸懒腰','play:stretch')]);
  if(model.state.growth.unlocked.includes('act_read_notebook'))playItems.push(await item('翻小本子','play:read_notebook'));
  const play=await Submenu.new({text:'玩一会儿',items:playItems});
  const quietItems=await Promise.all([item('30 分钟','dnd:30'),item('1 小时','dnd:60'),item('2 小时','dnd:120'),item('到今天下班','dnd:work'),item('直到我关闭','dnd'),MenuItem.new({text:quietExplanation,enabled:false})]);
  const quiet=await Submenu.new({text:'勿扰',items:quietItems});
  const sizes=await Submenu.new({text:'大小',items:await Promise.all([item('小 96','size:96'),item('中 112','size:112'),item('大 128','size:128')])});
  const popup=await Menu.new({items:[...await Promise.all([item('通知中心','notices'),item('聊天','chat'),item('记忆','memory'),item('喂零食','feed')]),play,quiet,await item('演示模式（隐藏团子）','demo-toggle'),await item('关闭勿扰','quiet-off'),sizes,await item('设置…','settings'),await item('退出团子（后台继续运行）','quit')]});
  await popup.popup();
}
async function boot():Promise<void>{
  model.local=await bridge.settings();
  if(master){
    document.body.classList.add(native?'native-pet':'browser-preview');petRoot.append(pet,badge,wake,progress,hoverLabel,playHint);root.append(petRoot,bubbleRoot,panelRoot);
    if(!native){const tools=el('nav',undefined,'browser-tools');tools.append(el('strong','团子 · 无头联调预览'));for(const [id,label] of [['notices','通知中心'],['chat','聊天'],['memory','记忆'],['settings','设置']] as const)tools.append(button(label,()=>model.open(id)));tools.append(button('从托盘恢复',()=>model.quiet('off')));root.prepend(tools);}
    await applyLocal();const geometry=await bridge.geometry();const saved=model.local.positions[geometry.screenId];if(saved)await bridge.position(saved);
    pet.addEventListener('pointerdown',e=>{const r=pet.getBoundingClientRect();const p={x:(e.clientX-r.x)*160/r.width,y:(e.clientY-r.y)*160/r.height};if(e.button===0&&hitTest(p,skin.hitAreas)){touchPoint=p;playPointer=playtime.kind?{x:e.clientX,y:e.clientY,at:Date.now()}:undefined;gestures.press({x:e.clientX,y:e.clientY});pet.setPointerCapture(e.pointerId);}});
    pet.addEventListener('pointerup',e=>{
      if(e.button!==0)return;
      if(playPointer){
        if(playtime.kind&&Date.now()-playPointer.at<=250&&Math.hypot(e.clientX-playPointer.x,e.clientY-playPointer.y)<=4){gestures.cancel();playtime.tap(Date.now());lastInteraction=Date.now();draw();}
        else gestures.cancel();
        playPointer=undefined;return;
      }
      gestures.release({x:e.clientX,y:e.clientY});
    });
    pet.addEventListener('pointercancel',()=>{playPointer=undefined;if(!movingWindow)gestures.cancel();});
    pet.addEventListener('pointermove',e=>{if(native&&!e.buttons)return;const r=pet.getBoundingClientRect(),p={x:(e.clientX-r.x)*160/r.width,y:(e.clientY-r.y)*160/r.height};gestures.move({x:e.clientX,y:e.clientY},!playtime.kind&&p.y>=33&&p.y<=67&&p.x>=43&&p.x<=127,e.buttons!==0);});
    pet.addEventListener('pointerenter',e=>{if(!playtime.kind)gestures.enter(e.buttons!==0);hoverLabel.textContent=`${model.state.badge.notices} 条未读`;hoverLabel.hidden=!model.state.badge.notices;});pet.addEventListener('pointerleave',()=>{gestures.leave();hoverLabel.hidden=true;});
    pet.addEventListener('contextmenu',e=>{e.preventDefault();contextMenu();});
    let nearAt=0;
    await bridge.on<{x:number;y:number;pressed:boolean;released:boolean}>('global-cursor',p=>{
      if(p.released&&movingWindow){gestures.release({x:p.x,y:p.y});movingWindow=false;}
      const factor=112/model.local.size;const point={x:p.x*factor,y:p.y*factor};
      if(!p.pressed&&!playtime.kind){gestures.move(point,point.y>=33&&point.y<=67&&point.x>=43&&point.x<=127,false);
        if(Math.hypot(point.x-80,point.y-90)<200){if(!nearAt)nearAt=Date.now();if(Date.now()-nearAt>300){const angle=Math.round(Math.atan2(point.y-80,point.x-80)/(Math.PI/4))*(Math.PI/4);pet.style.setProperty('--look-x',`${Math.round(Math.cos(angle))*2}px`);pet.style.setProperty('--look-y',`${Math.round(Math.sin(angle))*2}px`);if(!interactionAction&&model.state.activity==='idle')reaction('look_at_cursor');}}else nearAt=0;
      }
    });
    setInterval(()=>{if(!document.hidden&&rendering)draw();},100);
    let blinking=false;const blink=()=>{if(!document.hidden&&rendering&&!blinking){blinking=true;pet.classList.add('blink');setTimeout(()=>{pet.classList.remove('blink');blinking=false;},130);}setTimeout(blink,3000+Math.random()*3000);};setTimeout(blink,3000);
    setInterval(()=>{if(model.state.activity!=='offline')void api.request<PetState>('/pet/quiet/client','POST',{reasons:[],detection:'unknown',ttlMs:90000}).catch(()=>{});},30000);
    await bridge.on<boolean>('render-visibility',visible=>{rendering=visible;if(!visible){stopPlay();reactionTrail=[];draw();}document.body.classList.toggle('paused',!visible);});
    await bridge.on<string>('menu-action',action=>{void menuAction(action).catch(()=>showError('办公功能离线'));});
    await bridge.on<PanelKind>('open-panel',kind=>{void model.open(kind);});
    await bridge.on<string>('bubble-control',action=>{if(action==='hover')queue.hover(true);if(action==='leave')queue.hover(false);if(action==='dismiss')void dismissBubble();if(action==='close')queue.close();});
    await bridge.on<boolean>('bubble-ready',()=>{if(bubbleEntry)void bridge.send('bubble-data',bubbleEntry);});
    await bridge.on<string>('audio-command',command=>{void (command==='play'?audio.play(model.state):command==='pause'?audio.pause():Promise.resolve(audio.mute()));});
    await bridge.on<boolean>('test-growth',()=>{if(window.__PET_TEST__)model.state.growth.unlocked=['headset_mint','headset_sakura','nightcap','ball_yarn','act_read_notebook'];});
  }else if(view==='bubble'){
    document.body.classList.add('native-bubble');root.append(bubbleRoot);
    await bridge.on<BubbleEntry>('bubble-data',entry=>{bubbleEntry=entry;renderBubble(entry);});await bridge.send('bubble-ready',true);
  }else{document.body.classList.add('native-panel');root.append(panelRoot);await model.open(view as PanelKind);await bridge.on<PanelKind>('panel-route',kind=>{void model.open(kind);});}
  bubbleRoot.addEventListener('pointerenter',()=>{if(master)queue.hover(true);else void bridge.send('bubble-control','hover');});bubbleRoot.addEventListener('pointerleave',()=>{if(master)queue.hover(false);else void bridge.send('bubble-control','leave');});
  await bridge.on<PetUtterance>('utterance-archive',u=>{if(!master)model.localUtterances.push(u);});
  await bridge.on<PetState>('state-local',state=>applyState(state));
  await bridge.on<typeof clientDefaults>('client-settings',settings=>{model.local=settings;void applyLocal();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPlay();reactionTrail=[];draw();}document.body.classList.toggle('hidden-document',document.hidden);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){stopPlay();draw();model.close();menu?.remove();}if(e.ctrlKey&&e.altKey&&e.key.toLowerCase()==='d')void menuAction('demo-toggle');});
  document.addEventListener('pointerdown',e=>{if(!native&&!document.querySelector('dialog[open]')&&!panelRoot.hidden&&!panelRoot.contains(e.target as Node)&&!document.querySelector('.browser-tools')?.contains(e.target as Node)&&!pet.contains(e.target as Node)&&!bubbleRoot.contains(e.target as Node)&&!menu?.contains(e.target as Node))model.close();});
  window.addEventListener('pagehide',()=>{stopPlay();api.stop();gestures.dispose();void audio.pause();});
  void api.start();
}
void boot().catch(()=>goOffline());
