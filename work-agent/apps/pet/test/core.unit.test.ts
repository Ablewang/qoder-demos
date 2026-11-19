import { afterEach, describe, expect, it, vi } from 'vitest';
import { actionIds, Entertainer, skin, stateAction } from '../src/pet.ts';
import { offlineState } from '../src/settings.ts';
import { Gestures } from '../src/gestures.ts';
import { Playtime, reactionFrames, touchReaction } from '../src/playtime.ts';
import { bubblePlacement, hitTest } from '../src/geometry.ts';
import { BubbleQueue, bubbleDuration } from '../src/bubbles.ts';
import { EventCursor, SSEParser } from '../src/stream.ts';
import { factsNode, showError } from '../src/dom.ts';
import { Panels } from '../src/panels.ts';
import type { PanelModel } from '../src/panels.ts';
import { clientDefaults, companionDefaults, personaDefaults } from '../src/settings.ts';
vi.mock('../src/bridge.ts',()=>({bridge:{info:vi.fn(),token:vi.fn(),wake:vi.fn()}}));
import { bridge } from '../src/bridge.ts';
import { Api } from '../src/api.ts';
import type { PetActivity, PetInteraction, PetUtterance } from '../../../src/contracts/index.ts';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
const utterance=(id:string,extras:Partial<PetUtterance>={}):PetUtterance=>({id,text:id,sensitivity:'normal',...extras});
describe('skin and activity',()=>{
  const map:Record<PetActivity,string>={idle:'idle_breathe',sleeping:'sleep',working:'working',alert:'sign_hold',waiting_auth:'wait_auth',happy:'happy_bounce',concerned:'worried',caring:'caring',quiet:'quiet_curl',offline:'offline_sleep'};
  for(const [activity,action]of Object.entries(map))it(`${activity} → ${action}`,()=>{expect(stateAction({...offlineState(),activity:activity as PetActivity})).toBe(action);});
  it('quiet preempts user gestures; gestures preempt alerts; perch only idle',()=>{
    expect(stateAction({...offlineState(),activity:'quiet'},true,'pet_squint','play_ball')).toBe('quiet_curl');
    expect(stateAction({...offlineState(),activity:'alert'},false,'drag_hold')).toBe('drag_hold');
    expect(stateAction({...offlineState(),activity:'idle'},true)).toBe('perch_edge');
  });
  it('manifest declares all render actions and SHA256 matches material',()=>{
    expect(Object.keys(skin.animations).sort()).toEqual([...actionIds].sort());
    const bytes=readFileSync(new URL('../public/skins/tuanzi-default/mochi.svg',import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(skin.assets[0].sha256);
    expect(skin.activities.map(a=>a.id)).toContain('read_notebook');
  });
  it('entertainment is purely local and suppressed by quiet/bubble/recent interaction',()=>{
    const random=()=>0,fun=new Entertainer(random,0),idle={...offlineState(),activity:'idle' as const};
    const opts={now:180000,lastInteraction:0,state:idle,bubble:false,dragging:false,frequency:'medium' as const,work:true};
    expect(fun.tick({...opts,bubble:true})).toBeUndefined();expect(fun.tick({...opts,lastInteraction:170000})).toBeUndefined();
    expect(fun.tick(opts)).toBe('play_ball');expect(fun.tick({...opts,state:{...idle,activity:'quiet'}})).toBeUndefined();
    expect(fun.interval('low')).toBe(600000);expect(fun.interval('off')).toBe(Infinity);
  });
});
describe('gestures with simulated time',()=>{
  const setup=()=>{vi.useFakeTimers();vi.setSystemTime(0);const events:PetInteraction[]=[],reactions:string[]=[];const g=new Gestures(e=>events.push(e),id=>reactions.push(id));return{g,events,reactions};};
  const click=(g:Gestures,x=0,y=0)=>{g.press({x,y});vi.advanceTimersByTime(20);g.release({x,y});};
  it('single waits 300ms after a valid ≤250ms ≤4px click',()=>{const{g,events}=setup();click(g);expect(events).toEqual([]);vi.advanceTimersByTime(299);expect(events).toEqual([]);vi.advanceTimersByTime(1);expect(events).toEqual([{kind:'click'}]);});
  it('double waits for no third click',()=>{const{g,events}=setup();click(g);vi.advanceTimersByTime(100);click(g);vi.advanceTimersByTime(299);expect(events).toEqual([]);vi.advanceTimersByTime(1);expect(events).toEqual([{kind:'double_click'}]);});
  it('three clicks suppress single/double and report poke at end',()=>{const{g,events,reactions}=setup();for(let i=0;i<3;i++){click(g);vi.advanceTimersByTime(100);}vi.advanceTimersByTime(400);expect(events).toEqual([{kind:'poke',times:3}]);expect(reactions).toContain('poke_wobble');});
  it('six pokes in 3 seconds visibly pout',()=>{const{g,events,reactions}=setup();for(let i=0;i<6;i++){click(g);vi.advanceTimersByTime(100);}vi.advanceTimersByTime(400);expect(events).toEqual([{kind:'poke',times:6}]);expect(reactions).toContain('poke_pout');});
  it('head reversal two gives feedback, third reports pet without press',()=>{const{g,events,reactions}=setup();for(const x of [50,65,50,65,50]){g.move({x,y:50},true,false);vi.advanceTimersByTime(100);}expect(reactions).toContain('pet_squint');expect(events).toEqual([{kind:'pet'}]);});
  it('head movements while global button held do not pet',()=>{const{g,events}=setup();for(const x of [50,65,50,65,50])g.move({x,y:50},true,true);expect(events).toEqual([]);});
  it('old reversals expire after 1.5 seconds',()=>{const{g,events}=setup();for(const x of [50,65,50,65,50]){g.move({x,y:50},true,false);vi.advanceTimersByTime(1600);}expect(events).toEqual([]);});
  it('moves of 6px are not drags, greater than 6px startDragging and drop',()=>{const{g,events}=setup();g.press({x:0,y:0});g.move({x:6,y:0},false,true);expect(events).toEqual([]);g.move({x:7,y:0},false,true);g.release({x:7,y:0});vi.advanceTimersByTime(500);expect(events).toEqual([{kind:'drag_start'},{kind:'drop'}]);});
  it('long press and 5px displacement are not clicks',()=>{const{g,events}=setup();g.press({x:0,y:0});vi.advanceTimersByTime(251);g.release({x:0,y:0});g.press({x:0,y:0});g.release({x:5,y:0});vi.advanceTimersByTime(1000);expect(events).toEqual([]);});
  it('cancel clears pending clicks and hover; subsequent gestures still work',()=>{const{g,events}=setup();click(g);g.enter();g.cancel();vi.advanceTimersByTime(1000);expect(events).toEqual([]);click(g);vi.advanceTimersByTime(300);expect(events).toEqual([{kind:'click'}]);g.dispose();});
  it('hover 300ms, cancelled on leave and suppressed with button',()=>{const{g,events}=setup();g.enter(true);vi.advanceTimersByTime(500);g.enter();vi.advanceTimersByTime(200);g.leave();vi.advanceTimersByTime(200);expect(events).toEqual([]);g.enter();vi.advanceTimersByTime(300);expect(events).toEqual([{kind:'hover'}]);});
});
describe('local playtime and linked reactions',()=>{
  it('touch regions preserve central clicks and distinguish ears, cheeks and belly',()=>{
    expect(touchReaction({x:80,y:90})).toBe('poke_wobble');expect(touchReaction({x:80,y:90},true)).toBe('happy_bounce');
    expect(touchReaction({x:30,y:80})).toBe('ear_twitch');expect(touchReaction({x:52,y:85})).toBe('cheek_squish');
    expect(touchReaction({x:80,y:115})).toBe('belly_giggle');expect(touchReaction({x:80,y:50},true)).toBe('face_rub');
    expect(touchReaction({x:80,y:115},true)).toBe('roll_over');
  });
  it('pout, drop and feed use contiguous deadlines, not late callbacks',()=>{
    expect(reactionFrames('poke_pout',100)).toEqual([{action:'poke_pout',until:700},{action:'poke_guard',until:1400},{action:'face_rub',until:2100}]);
    expect(reactionFrames('drop_land',100)).toEqual([{action:'drop_land',until:600},{action:'drop_rub',until:1300}]);
    expect(reactionFrames('eat_snack',0)).toEqual([{action:'eat_snack',until:1500},{action:'happy_bounce',until:2700}]);
  });
  it.each([700,1399])('falling ball can be caught at %sms exactly once',at=>{
    const game=new Playtime();game.start('ball',0);game.tap(0);game.tap(699);
    expect(game.tick(699)?.phase).toBe('flight');expect(game.tick(700)?.phase).toBe('catch');
    game.tap(at);game.tap(at);expect(game.tick(at)).toMatchObject({action:'ball_catch',caught:1,round:1});
    expect(game.tick(at+699)?.phase).toBe('caught');expect(game.tick(at+700)).toMatchObject({phase:'ready',round:2,side:-1});
  });
  it('expired toss cannot be caught and a miss advances without a penalty',()=>{
    const game=new Playtime();game.start('ball',0);game.tap(0);game.tap(1400);
    expect(game.tick(1400)).toMatchObject({action:'ball_miss',caught:0});
    expect(game.tick(2299)?.phase).toBe('missed');expect(game.tick(2300)).toMatchObject({round:2,phase:'ready'});
  });
  it('three real catches finish and expire; no fourth toss',()=>{
    const game=new Playtime();game.start('ball',0);
    for(let round=0;round<3;round++){game.tap(round*1400);game.tap(round*1400+700);}
    expect(game.tick(4200)).toMatchObject({phase:'result',caught:3,hint:'接住 3/3 球 · 玩得开心'});
    game.tap(4300);expect(game.tick(5999)?.caught).toBe(3);expect(game.tick(6000)).toBeUndefined();
  });
  it('three misses also finish, including large elapsed jumps',()=>{
    const game=new Playtime();game.start('ball',0);
    for(let round=0;round<3;round++){game.tap(round*2300);expect(game.tick(round*2300+2300)?.phase).toBe(round===2?'result':'ready');}
    expect(game.tick(8700)).toBeUndefined();
  });
  it('box alternates peek sides and only the third tease pops out',()=>{
    const game=new Playtime();game.start('box',0);expect(game.tick(0)).toMatchObject({action:'box_peek',side:1});
    game.tap(0);game.tap(100);expect(game.tick(449)?.action).toBe('box_hide');
    expect(game.tick(450)).toMatchObject({action:'box_peek',round:2,side:-1});game.tap(450);
    expect(game.tick(900)).toMatchObject({action:'box_peek',round:3,side:1});game.tap(900);
    expect(game.tick(1350)?.action).toBe('box_pop');expect(game.tick(2050)?.phase).toBe('result');
    expect(game.tick(3850)).toBeUndefined();
  });
  it.each(['ball','box'] as const)('%s expires at 30 seconds without interaction',kind=>{
    const game=new Playtime();game.start(kind,10);expect(game.tick(30009)).toBeDefined();expect(game.tick(30010)).toBeUndefined();
  });
  it('stop and switch cannot resurrect earlier frames',()=>{
    const game=new Playtime();game.start('ball',0);game.tap(0);game.stop();game.tap(800);expect(game.tick(900)).toBeUndefined();
    game.start('ball',1000);game.tap(1000);game.start('box',1100);expect(game.tick(2000)).toMatchObject({action:'box_peek',round:1,caught:0});
  });
});
describe('hit regions and bubble direction',()=>{
  it('transparent corners miss; ears and body hit',()=>{expect(hitTest({x:0,y:0},skin.hitAreas)).toBe(false);expect(hitTest({x:50,y:45},skin.hitAreas)).toBe(true);expect(hitTest({x:80,y:90},skin.hitAreas)).toBe(true);});
  const work={x:0,y:0,width:1000,height:800},size={width:280,height:150};
  it('up then larger side then down, always clamped to work area',()=>{
    expect(bubblePlacement({x:400,y:400,width:160,height:160},size,work).direction).toBe('top');
    expect(bubblePlacement({x:10,y:5,width:160,height:160},size,work).direction).toBe('right');
    expect(bubblePlacement({x:830,y:5,width:160,height:160},size,work).direction).toBe('left');
    const result=bubblePlacement({x:5,y:1,width:160,height:160},size,{x:0,y:0,width:200,height:400});expect(result.direction).toBe('bottom');expect(result.x).toBe(0);expect(result.width).toBe(200);
  });
});
describe('SSE and cursor',()=>{
  it('parses fragmented CRLF frames, comments, multiline data and retry',()=>{
    const messages:unknown[]=[],retries:number[]=[];const parser=new SSEParser(m=>messages.push(m),n=>retries.push(n));
    parser.push(': ping\r\nretry: 700\r\nid: 4\r\nevent: pet.');parser.push('state\r\ndata: {"x":\r\ndata: 1}\r\n\r\n');
    expect(messages).toEqual([{event:'pet.state',data:'{"x":\n1}',id:'4'}]);expect(retries).toEqual([700]);
  });
  it('Last-Event-ID and Authorization are headers only; resync refreshes snapshots',async()=>{
    const cursor=new EventCursor(),event=vi.fn().mockResolvedValue(undefined),resync=vi.fn().mockResolvedValue(undefined);
    await cursor.receive({event:'hello',data:'{"seq":10}'},event,resync);expect(cursor.headers('test').get('Last-Event-ID')).toBe('10');expect(cursor.headers('test').get('Authorization')).toBe('Bearer test');
    expect(resync).toHaveBeenCalledOnce();expect(event).not.toHaveBeenCalled();
    await cursor.receive({event:'resync_required',data:'{}'},event,resync);expect(resync).toHaveBeenCalledTimes(2);expect(cursor.lastId).toBeUndefined();
    await cursor.receive({event:'pet.state',data:'{"state":{}}',id:'18'},event,resync);expect(cursor.lastId).toBe('18');
  });
  it('deduplicates SSE and synchronous utterance ids and drops expired messages',()=>{const c=new EventCursor();expect(c.accept(utterance('1'),10)).toBe(true);expect(c.accept(utterance('1'),10)).toBe(false);expect(c.accept(utterance('2',{expiresAt:10}),10)).toBe(false);});
});
describe('bubble queue',()=>{
  it('types use 8/15/20 second timers, hover restarts timer',()=>{vi.useFakeTimers();const queue=new BubbleQueue(()=>{});queue.push({priority:1,utterance:utterance('1')});vi.advanceTimersByTime(7000);queue.hover(true);vi.advanceTimersByTime(30000);expect(queue.current?.utterance.id).toBe('1');queue.hover(false);vi.advanceTimersByTime(8000);expect(queue.current).toBeUndefined();expect(bubbleDuration(utterance('2',{facts:[{label:'a',value:'3'}]}))).toBe(15000);expect(bubbleDuration(utterance('3',{quickActions:[{label:'查看',open:'notice'}]}))).toBe(20000);});
  it('one visible; over two pending notices merge and preserve ids for dismissal',()=>{vi.useFakeTimers();const queue=new BubbleQueue(()=>{});for(let i=0;i<4;i++)queue.push({priority:1,utterance:utterance(String(i))});expect(queue.pending()).toBe(1);queue.close();expect(queue.current?.utterance.text).toBe('有 3 条新通知');expect(queue.current?.merged?.length).toBe(3);});
  it('merges inherit sensitivity and erased reminder leaves no queue copy',()=>{
    vi.useFakeTimers();const queue=new BubbleQueue(()=>{});
    for(let i=0;i<4;i++)queue.push({priority:1,utterance:utterance(String(i),{ref:{noticeId:String(i)},sensitivity:i===2?'confidential':'normal',facts:[{label:'原话',value:`提醒 ${i}`}]})});
    queue.close();expect(queue.current?.utterance.sensitivity).toBe('confidential');
    queue.removeNotice('2');expect(queue.current?.merged?.some(e=>e.utterance.ref?.noticeId==='2')).toBe(false);expect(queue.current?.utterance.sensitivity).toBe('normal');
    queue.removeNotice('1');queue.removeNotice('3');expect(queue.current).toBeUndefined();expect(queue.pending()).toBe(0);
  });
  it('idle chatter drops, user replies take priority, dedupe does not re-popup',()=>{vi.useFakeTimers();const queue=new BubbleQueue(()=>{});queue.push({priority:1,dedupeKey:'a',utterance:utterance('0')});queue.push({priority:1,dedupeKey:'a',utterance:utterance('1')});queue.push({priority:0,utterance:utterance('2')});queue.push({priority:1,utterance:utterance('3')});queue.push({priority:3,utterance:utterance('4')});expect(queue.pending()).toBe(2);queue.close();expect(queue.current?.utterance.id).toBe('4');});
});
describe('panel display generation barriers',()=>{
  // Minimal local DOM, without a browser or an additional DOM dependency.
  class Node {
    className='';dataset:Record<string,string>={};children:Node[]=[];value='';private text='';
    listeners=new Map<string,(()=>void)[]>();classList={contains:(name:string)=>this.className.split(' ').includes(name),add:(name:string)=>{this.className+=` ${name}`;}};
    constructor(readonly tag:string){}
    set textContent(value:string){this.text=value;this.children=[];}get textContent():string{return this.text+this.children.map(node=>node.textContent).join('');}
    append(...nodes:Node[]){this.children.push(...nodes);}replaceChildren(...nodes:Node[]){this.text='';this.children=nodes;}
    setAttribute(){}addEventListener(type:string,callback:()=>void){this.listeners.set(type,[...(this.listeners.get(type)||[]),callback]);}
    querySelector(selector:string):Node|undefined{return this.children.find(node=>selector.startsWith('.')?node.classList.contains(selector.slice(1)):node.tag===selector)||this.children.flatMap(node=>node.querySelector(selector)||[])[0];}
    click(){for(const callback of this.listeners.get('click')||[])callback();}
  }
  const setup=async(request=vi.fn().mockResolvedValue({conversationId:'current',chunks:[]}))=>{
    const root=new Node('aside');vi.stubGlobal('document',{createElement:(tag:string)=>new Node(tag),querySelector:()=>root});
    const model={api:{request},state:{...offlineState(),activity:'idle'},persona:{persona:personaDefaults,firstRun:false},settings:companionDefaults,local:clientDefaults,notices:[],localUtterances:[],open:vi.fn(),close:vi.fn(),quiet:vi.fn(),saveLocal:vi.fn()} as unknown as PanelModel;
    const panels=new Panels(root as unknown as HTMLElement,model);await panels.show('chat');
    const send=(text:string)=>{root.querySelector('input')!.value=text;root.querySelector('form')!.children.find(node=>node.tag==='button')!.click();};
    return {root,panels,send,request};
  };
  it.each(['chunk','items','actions'])('clears detached input, raw answer and card linked via %s, not unrelated help',async(source)=>{
    const chunks=source==='chunk'?[{kind:'memory',itemId:'memory-1'}]:[];
    const card={title:'旧记忆原文',sensitivity:'normal',...(source==='items'?{items:[{id:'memory-1',text:'旧记忆原文'}]}:{}),...(source==='actions'?{actions:[{label:'撤销',action:'memory_undo',memoryId:'memory-1'}]}:{})};
    const request=vi.fn().mockResolvedValueOnce({conversationId:'current',chunks:[{kind:'card',card:{title:'关于团子',sensitivity:'normal'}}]}).mockResolvedValueOnce({conversationId:'current',chunks:[...chunks,{kind:'text',text:'旧记忆原文'},{kind:'card',card}]});
    const {root,panels,send}=await setup(request);send('你会什么');await vi.waitFor(()=>expect(root.textContent).toContain('关于团子'));
    send('记住 旧记忆原文');await vi.waitFor(()=>expect(root.querySelector('.chat-history')!.children).toHaveLength(5));
    const detached=root.querySelector('.chat-history')!;await panels.show('help');panels.invalidateMemoryDisplay();
    expect(detached.textContent).not.toContain('旧记忆原文');expect(detached.textContent).toContain('关于团子');
    expect(detached.querySelector('button')).toBeUndefined();await panels.show('chat');expect(root.textContent).not.toContain('旧记忆原文');
  });
  it('clears unknown pending input and drops a late non-memory response without retry or conversation backfill',async()=>{
    let resolve!:(value:unknown)=>void;const request=vi.fn().mockImplementationOnce(()=>new Promise(done=>{resolve=done;})).mockResolvedValue({conversationId:'new',chunks:[]});
    const {root,panels,send}=await setup(request);send('尚未关联的原输入');await vi.waitFor(()=>expect(request).toHaveBeenCalledOnce());
    panels.invalidateMemoryDisplay();resolve({conversationId:'stale',chunks:[{kind:'text',text:'迟到原文'},{kind:'card',card:{title:'迟到卡片',sensitivity:'normal'}}]});
    await panels.show('chat');expect(root.textContent).toContain('连接已刷新，本次回复未展示，请先查看记忆或提醒');expect(root.textContent).not.toContain('尚未关联的原输入');
    send('你会什么');await vi.waitFor(()=>expect(request).toHaveBeenCalledTimes(2));expect(request.mock.calls[1][2].conversationId).toBeUndefined();expect(root.textContent).not.toContain('迟到');
  });
  it('does not repaint an old memory list after display invalidation',async()=>{
    let resolve!:(value:unknown)=>void;const request=vi.fn().mockImplementation(()=>new Promise(done=>{resolve=done;}));
    const {root,panels}=await setup(request);const pending=panels.show('memory');await vi.waitFor(()=>expect(request).toHaveBeenCalledOnce());
    panels.invalidateMemoryDisplay();resolve({items:[{id:'memory-1',text:'迟到列表原文'}]});await pending;
    expect(root.textContent).not.toContain('迟到列表原文');expect(root.textContent).toContain('连接已刷新，记忆请重新查询');
  });
});
describe('error visibility',()=>{
  it.each([true,false])('uses a visible host when panel hidden is %s',(hidden)=>{
    const panel={hidden,querySelector:vi.fn(),append:vi.fn()},root={querySelector:vi.fn(),append:vi.fn()};
    const note={textContent:'',setAttribute:vi.fn()};
    vi.stubGlobal('document',{querySelector:(selector:string)=>selector==='.panel'?panel:root,createElement:()=>note});
    showError('后台唤醒失败');
    expect((hidden?root:panel).append).toHaveBeenCalledWith(note);
    expect((hidden?panel:root).append).not.toHaveBeenCalled();
    expect(note.textContent).toBe('后台唤醒失败');expect(note.setAttribute).toHaveBeenCalledWith('role','alert');
  });
});
describe('wake connection diagnostics',()=>{
  const setup=()=>{
    vi.useFakeTimers();vi.setSystemTime(0);
    const info={pid:1,port:18787,startedAt:1,version:'0.1.0',protocol:1 as const};
    vi.mocked(bridge.info).mockReset().mockResolvedValue(info);
    vi.mocked(bridge.token).mockReset().mockResolvedValue('A'.repeat(43));
    vi.mocked(bridge.wake).mockReset().mockResolvedValue(undefined);
    const healthy=()=>new Response(JSON.stringify({ok:true,...info}));
    const fetcher=vi.fn(async(url:string)=>url.endsWith('/health')?healthy():new Response('{}'));
    vi.stubGlobal('fetch',fetcher);
    const snapshot=vi.fn(),api=new Api(snapshot,async()=>{},()=>{});
    return {api,fetcher,snapshot,healthy};
  };
  it.each(['discovery','network','origin','stale','credential','authentication','request-origin','snapshot'])('reports safe %s failure, not a nonexistent daemon.log',async(stage)=>{
    const {api,fetcher,snapshot}=setup();
    const messages:Record<string,string>={discovery:'后台启动信息不可用，请重新启动后台',network:'本机连接失败，请重启后台和团子',origin:'后台拒绝桌宠连接，请重启后台后再唤醒',stale:'后台启动信息已失效，请重新启动后台',credential:'本机凭证读取失败，请检查系统授权提示',authentication:'本机认证失败，办公功能离线','request-origin':'后台拒绝桌宠连接，请重启后台后再唤醒',snapshot:'后台连接失败，请重启后台和团子'};
    if(stage==='discovery')vi.mocked(bridge.info).mockRejectedValue('raw-secret');
    if(stage==='network')fetcher.mockRejectedValue(new TypeError('raw-secret'));
    if(stage==='origin')fetcher.mockResolvedValue(new Response('{}',{status:403}));
    if(stage==='stale')fetcher.mockResolvedValue(new Response(JSON.stringify({ok:true,protocol:1,startedAt:2})));
    if(stage==='credential')vi.mocked(bridge.token).mockRejectedValue('raw-secret');
    if(stage==='authentication'||stage==='request-origin')fetcher.mockImplementation(async(url:string)=>url.endsWith('/health')?new Response(JSON.stringify({ok:true,protocol:1,startedAt:1})):new Response('{}',{status:stage==='authentication'?401:403}));
    if(stage==='snapshot')snapshot.mockImplementation(()=>{throw new Error('raw-secret');});
    const result=expect(api.wake()).rejects.toThrow(messages[stage]);
    await vi.advanceTimersByTimeAsync(10000);await result;
    expect(bridge.wake).toHaveBeenCalledOnce();
  });
  it('does not expose a native spawn rejection',async()=>{
    const {api}=setup();vi.mocked(bridge.wake).mockRejectedValue('raw-secret');
    await expect(api.wake()).rejects.toThrow('无法启动本机后台，请检查桌宠启动终端');
  });
  it('recovers after one failed health request and applies the authenticated snapshot',async()=>{
    const {api,fetcher,snapshot}=setup();fetcher.mockRejectedValueOnce(new TypeError('offline'));
    const result=api.wake();await vi.advanceTimersByTimeAsync(250);await result;
    expect(snapshot).toHaveBeenCalledOnce();expect(bridge.wake).toHaveBeenCalledOnce();expect(bridge.token).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls.slice(2)).toHaveLength(4);
    for(const [,options]of fetcher.mock.calls.slice(2) as unknown as [string,RequestInit][])expect(options.headers).toEqual({Authorization:`Bearer ${'A'.repeat(43)}`});
  });
});
describe('structured facts renderer',()=>{
  it('renders exact strings including script text through textContent, never HTML',()=>{
    class Node {tag:string;className='';children:Node[]=[];value='';constructor(tag:string){this.tag=tag;}set textContent(s:string){this.value=s;}get textContent():string{return this.value+this.children.map(c=>c.textContent).join('');}append(...n:Node[]){this.children.push(...n);}set innerHTML(_:string){throw Error('unsafe HTML');}}
    vi.stubGlobal('document',{createElement:(tag:string)=>new Node(tag)});
    const node=factsNode([{label:'数量',value:'3'},{label:'负责人',value:'张三'},{label:'时间',value:'15:30'},{label:'测试',value:'<script>alert(1)</script>'}]) as unknown as Node;
    expect(node.children.filter(n=>n.tag==='dd').map(n=>n.textContent)).toEqual(['3','张三','15:30','<script>alert(1)</script>']);
  });
});
