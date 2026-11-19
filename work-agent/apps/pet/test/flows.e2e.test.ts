import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Page, APIRequestContext } from '@playwright/test';
import type { PetInteraction } from '../../../src/contracts/index.ts';
const api='http://127.0.0.1:18787/api/v1';
const auth={Authorization:'Bearer test-only-token'};
async function ready(page:Page):Promise<void>{await page.getByRole('button',{name:'先用默认',exact:true}).click();await expect(page.getByRole('button',{name:'全部标为已读'})).toBeVisible();await page.locator('.panel header button').click();if(await page.locator('.bubble').isVisible())await page.locator('.bubble-close').click();}
async function notify(request:APIRequestContext,title='评审任务',dedupe=title):Promise<void>{await request.post(`${api}/notices`,{headers:auth,data:{kind:'dev.test',title,facts:[{label:'数量',value:'3'},{label:'负责人',value:'张三'},{label:'时间',value:'15:30'},{label:'原文',value:'<script>window.injected=1</script>'}],why:'来自开发测试',nextStep:'请查看任务',evidence:[],sensitivity:'normal',tone:'neutral',urgency:'normal',dedupeKey:dedupe}});}

test.beforeEach(async({page,request})=>{
  await request.post('http://127.0.0.1:18787/__test__/reset');
  await page.addInitScript(()=>{window.__PET_TEST__={info:{pid:0,port:18787,startedAt:17,version:'0.1.0',protocol:1},token:'test-only-token'};});
  // Keep the mock's existing 1420 Origin contract while preview runs on 1421.
  // Only this headless page's static assets are proxied; no listener on 1420 is used.
  if(process.env.PET_E2E_PREVIEW_1421==='1')await page.route('http://127.0.0.1:1420/**',route=>{
    const url=new URL(route.request().url());
    return route.continue({url:`http://127.0.0.1:1421${url.pathname}${url.search}`});
  });
  await page.goto('/');await expect(page.getByRole('button',{name:'先用默认',exact:true})).toBeVisible();
});
test('首次见面：先用默认也写 PUT',async({page,request},info)=>{
  await ready(page);const response=await request.get(`${api}/pet/persona`,{headers:auth});const p=await response.json();expect(p.firstRun).toBe(false);expect(p.persona.name).toBe('团子');
  await page.screenshot({path:info.outputPath('01-default-meeting.png'),fullPage:true});
});
test('首次见面：八步自定义名字和称呼',async({page,request},info)=>{
  await page.getByRole('button',{name:'给我取名',exact:true}).click();await page.getByLabel('名字（1–8 字）').fill('雪团');await page.getByRole('button',{name:'下一步',exact:true}).click();
  await page.getByLabel('怎么称呼你').selectOption('老板');await page.getByRole('button',{name:'下一步',exact:true}).click();
  await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByLabel('说话风格',{exact:true}).selectOption('terse');await page.getByRole('button',{name:'下一步',exact:true}).click();
  await page.getByRole('button',{name:'跳过',exact:true}).click();await page.getByRole('button',{name:'跳过',exact:true}).click();await expect(page.getByText('不看屏幕内容；',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'知道了',exact:true}).click();await page.getByRole('button',{name:'完成',exact:true}).click();
  const response=await request.get(`${api}/pet/persona`,{headers:auth});const p=await response.json();expect(p.persona.name).toBe('雪团');expect(p.persona.addressUser).toBe('老板');expect(p.firstRun).toBe(false);
  await page.screenshot({path:info.outputPath('02-custom-meeting.png'),fullPage:true});
});
test('左键单击双击连戳和拖拽只做互动，不打开面板',async({page,request},info)=>{
  await ready(page);const pet=page.locator('.pet'),point={x:80,y:90};
  const recorded=async():Promise<PetInteraction[]>=>{const response=await request.get('http://127.0.0.1:18787/__test__/events');return(await response.json()).interactions;};
  await pet.click({position:point});await expect(pet).toHaveAttribute('data-action','poke_wobble');await expect(page.locator('.panel')).toBeHidden();
  await expect.poll(async()=>(await recorded()).filter(e=>e.kind==='click').length).toBe(1);
  await pet.dblclick({position:point});await expect(pet).toHaveAttribute('data-action','happy_bounce');await expect(page.locator('.panel')).toBeHidden();
  await expect.poll(async()=>(await recorded()).filter(e=>e.kind==='double_click').length).toBe(1);
  await pet.click({position:point,clickCount:3,delay:80});
  await expect.poll(async()=>(await recorded()).some(e=>e.kind==='poke')).toBe(true);await expect(page.locator('.panel')).toBeHidden();
  const rect=await pet.boundingBox();expect(rect).not.toBeNull();
  await page.mouse.move(rect!.x+80,rect!.y+90);await page.mouse.down();await page.mouse.move(rect!.x+110,rect!.y+90,{steps:5});await page.mouse.up();
  await expect.poll(async()=>(await recorded()).some(e=>e.kind==='drag_start')).toBe(true);
  await expect.poll(async()=>(await recorded()).some(e=>e.kind==='drop')).toBe(true);await expect(page.locator('.panel')).toBeHidden();
  await page.screenshot({path:info.outputPath('left-interactions-no-panel.png'),fullPage:true});
});
test('右键菜单可操作，左键互动不会切换面板或丢失编辑内容',async({page,request},info)=>{
  await ready(page);const pet=page.locator('.pet'),point={x:80,y:90},menu=page.locator('.context-menu');
  await pet.click({button:'right',position:point});await expect(menu).toBeVisible();
  for(const label of ['通知中心','聊天','记忆','喂零食','设置…'])await expect(menu.getByRole('button',{name:label,exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('right-click-actions.png'),fullPage:true});
  await menu.getByRole('button',{name:'聊天',exact:true}).click();await expect(page.locator('.panel header strong')).toHaveText('聊天');
  const draft=page.getByRole('textbox',{name:'聊天输入'});await draft.fill('还没发送的草稿');
  await pet.click({position:point});await expect(pet).toHaveAttribute('data-action','poke_wobble');
  await pet.dblclick({position:point});await expect(pet).toHaveAttribute('data-action','happy_bounce');
  await expect(page.locator('.panel header strong')).toHaveText('聊天');await expect(draft).toHaveValue('还没发送的草稿');
  await pet.click({button:'right',position:point});await menu.getByRole('button',{name:'设置…',exact:true}).click();await expect(page.locator('.panel header strong')).toHaveText('设置');
  await page.locator('.settings-groups summary').filter({hasText:'人格'}).click();const name=page.getByLabel('名字（1–8 字）');await name.fill('未保存雪团');
  await pet.click({position:point});await expect(pet).toHaveAttribute('data-action','poke_wobble');await pet.dblclick({position:point});await expect(pet).toHaveAttribute('data-action','happy_bounce');
  await expect(page.locator('.panel header strong')).toHaveText('设置');await expect(name).toHaveValue('未保存雪团');
  await pet.click({button:'right',position:point});await menu.getByRole('button',{name:'喂零食',exact:true}).click();await expect(pet).toHaveAttribute('data-action','eat_snack');await expect(page.locator('.panel header strong')).toHaveText('设置');
  await pet.click({button:'right',position:point});await menu.getByText('玩一会儿',{exact:true}).click();await menu.getByRole('button',{name:'小球',exact:true}).click();await expect(pet).toHaveAttribute('data-action','play_ball');
  await expect.poll(async()=>{const response=await request.get('http://127.0.0.1:18787/__test__/events');const{interactions}=await response.json() as {interactions:PetInteraction[]};return interactions.some(e=>e.kind==='feed')&&interactions.some(e=>e.kind==='play'&&e.activityId==='play_ball');}).toBe(true);
});
test('通知事实逐字一致，script 是纯文本，稍后与忽略',async({page,request},info)=>{
  await ready(page);await notify(request);const bubble=page.locator('.bubble');await expect(bubble).toBeVisible();await expect(bubble.locator('dd')).toHaveText(['3','张三','15:30','<script>window.injected=1</script>']);expect(await page.evaluate(()=>Reflect.get(window,'injected'))).toBeUndefined();await expect(bubble.locator('script')).toHaveCount(0);
  await page.screenshot({path:info.outputPath('03-exact-facts.png'),fullPage:true});
  await bubble.getByRole('button',{name:'稍后',exact:true}).click();await expect(bubble).toBeHidden();let response=await request.get(`${api}/notices`,{headers:auth});expect((await response.json()).items[0].status).toBe('snoozed');
  await page.getByRole('button',{name:'通知中心',exact:true}).click();await page.locator('.tabs').getByRole('button',{name:'稍后',exact:true}).click();await page.getByRole('button',{name:'评审任务',exact:true}).click();await expect(page.getByText('为什么提醒',{exact:true})).toBeVisible();await expect(page.getByText('下一步',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'打开链接'})).toBeDisabled();await page.getByRole('button',{name:'忽略',exact:true}).click();
  response=await request.get(`${api}/notices`,{headers:auth});expect((await response.json()).items[0].status).toBe('dismissed');
  await page.screenshot({path:info.outputPath('04-notice-center.png'),fullPage:true});
});
test('聊天记住卡片、记忆原文、二次删除确认',async({page,request},info)=>{
  await ready(page);await page.getByRole('button',{name:'聊天',exact:true}).click();await expect(page.getByText('本地模式：',{exact:false})).toBeVisible();await page.getByRole('textbox',{name:'聊天输入'}).fill('记住 周五下午不排会');await page.getByRole('button',{name:'发送',exact:true}).click();
  const card=page.locator('.local-card');await expect(card).toBeVisible();await expect(card.locator('.memory-text')).toHaveText('周五下午不排会');await expect(card.getByRole('button',{name:'撤销'})).toBeVisible();
  await page.screenshot({path:info.outputPath('05-chat-memory-card.png'),fullPage:true});
  await page.locator('.panel-nav').getByRole('button',{name:'记忆',exact:true}).click();await expect(page.locator('.memory-text')).toHaveText('周五下午不排会');await page.locator('.memory-item').getByRole('button',{name:'删除',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'删除确认'});await expect(modal).toBeVisible();await expect(modal).toContainText('删除后会从 user.md 和搜索索引里一起删掉，团子里没法恢复。电脑自己的备份（比如时间机器）团子管不到。');
  await page.screenshot({path:info.outputPath('06-memory-delete-confirmation.png'),fullPage:true});await modal.getByRole('button',{name:'取消',exact:true}).click();let response=await request.get(`${api}/memory`,{headers:auth});expect((await response.json()).items).toHaveLength(1);
  await page.locator('.memory-item').getByRole('button',{name:'删除',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'删除',exact:true}).click();response=await request.get(`${api}/memory`,{headers:auth});expect((await response.json()).items).toHaveLength(0);
});
test('勿扰时普通气泡为零，恢复只有合并气泡',async({page,request},info)=>{
  await ready(page);await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByText('打扰',{exact:true}).click();await expect(page.getByText('开会自动安静：暂不可用（还没接日历）。共享屏幕识别：未知。要演示请用『演示模式』。',{exact:true})).toBeVisible();await page.getByRole('button',{name:'勿扰 30 分钟',exact:true}).click();await expect(page.locator('.pet')).toHaveAttribute('data-action','quiet_curl');
  for(let i=0;i<5;i++)await notify(request,`通知 ${i}`,i<2?'same':String(i));await expect(page.locator('.bubble')).toBeHidden();await page.screenshot({path:info.outputPath('07-dnd.png'),fullPage:true});
  await page.getByRole('button',{name:'取消勿扰',exact:true}).click();await expect(page.locator('.bubble')).toContainText('安静期间来了 4 条');
});
test('离线显示 offline_sleep 与唤醒按钮，恢复健康检查',async({page,request},info)=>{
  await ready(page);await request.post('http://127.0.0.1:18787/__test__/offline');await expect(page.locator('.pet')).toHaveAttribute('data-action','offline_sleep');await expect(page.getByRole('button',{name:'唤醒',exact:true})).toBeVisible();await expect(page.locator('.bubble')).toContainText('办公功能暂时离线');await page.screenshot({path:info.outputPath('08-offline-wake.png'),fullPage:true});
  await request.post('http://127.0.0.1:18787/__test__/online');await page.getByRole('button',{name:'唤醒',exact:true}).click();await expect(page.getByRole('button',{name:'唤醒',exact:true})).toBeHidden();
});
test('音频默认关闭，主动播放，quiet 在 1 秒内停止并上报',async({page,request},info)=>{
  await ready(page);let response=await request.get(`${api}/pet/state`,{headers:auth});expect((await response.json()).audio.enabled).toBe(false);
  await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByText('音频',{exact:true}).click();await page.getByLabel('真实音频',{exact:true}).check();
  await expect.poll(async()=>{const r=await request.get(`${api}/pet/state`,{headers:auth});return(await r.json()).audio.enabled;}).toBe(true);
  await page.getByRole('button',{name:'播放',exact:true}).click();await expect.poll(async()=>{const r=await request.get('http://127.0.0.1:18787/__test__/events');return(await r.json()).interactions.some((i:{kind:string})=>i.kind==='audio_play');}).toBe(true);
  await request.post(`${api}/pet/quiet`,{headers:auth,data:{mode:'dnd',minutes:30}});
  await expect.poll(async()=>{const r=await request.get('http://127.0.0.1:18787/__test__/events');return(await r.json()).interactions.some((i:{kind:string})=>i.kind==='audio_pause');},{timeout:1000}).toBe(true);
  response=await request.get(`${api}/pet/state`,{headers:auth});const state=await response.json();expect(state.audio.playing).toBe(false);expect(state.audio.enabled).toBe(true);await page.screenshot({path:info.outputPath('10-audio-stopped.png'),fullPage:true});
});
test('改记忆类型后撤销使用返回的原条目 id',async({page,request})=>{
  await ready(page);await page.getByRole('button',{name:'聊天',exact:true}).click();await page.getByRole('textbox',{name:'聊天输入'}).fill('记住 张三负责前端');await page.getByRole('button',{name:'发送',exact:true}).click();await page.locator('.local-card').getByRole('button',{name:'改成规则',exact:true}).click();await page.locator('.local-card').getByRole('button',{name:'撤销',exact:true}).click();
  await expect.poll(async()=>{const r=await request.get(`${api}/memory`,{headers:auth});return(await r.json()).items.length;}).toBe(0);
});
async function playMenu(page:Page,label:string):Promise<void>{await page.locator('.pet').click({button:'right',position:{x:80,y:90}});const menu=page.locator('.context-menu');await menu.getByText('玩一会儿',{exact:true}).click();await menu.getByRole('button',{name:label,exact:true}).click();}
test('抛接球是三轮可玩互动，提前点无效，接球不重复上报',async({page,request},info)=>{
  await ready(page);const pet=page.locator('.pet'),point={x:80,y:90},hint=page.locator('.play-hint');
  await playMenu(page,'抛接球');await expect(pet).toHaveAttribute('data-action','ball_ready');
  for(let round=1;round<=3;round++){
    await expect(hint).toHaveText(`第 ${round}/3 球 · 点一下抛球`);await pet.click({position:point});
    if(round===1){await pet.click({position:point});await expect(pet).toHaveAttribute('data-play-phase','flight');}
    await expect(pet).toHaveAttribute('data-play-phase','catch');await pet.click({position:point});await expect(pet).toHaveAttribute('data-action','ball_catch');
  }
  await expect(hint).toHaveText('接住 3/3 球 · 玩得开心');await page.screenshot({path:info.outputPath('12-ball-result.png'),fullPage:true});await expect(hint).toBeHidden();
  const response=await request.get('http://127.0.0.1:18787/__test__/events');const{interactions}=await response.json() as {interactions:PetInteraction[]};
  expect(interactions.filter(i=>['play','click','double_click','poke','pet'].includes(i.kind))).toEqual([{kind:'play',activityId:'play_ball'}]);
  await playMenu(page,'抛接球');await pet.click({position:point});await expect(pet).toHaveAttribute('data-action','ball_miss');await playMenu(page,'结束玩耍');await expect(hint).toBeHidden();await expect(pet).not.toHaveAttribute('data-play',/./);
});
test('部位反应、连戳护脸和纸箱三次探头都有完整变化',async({page},info)=>{
  await ready(page);const pet=page.locator('.pet'),hint=page.locator('.play-hint');
  for(const [position,action] of [[{x:30,y:80},'ear_twitch'],[{x:52,y:85},'cheek_squish'],[{x:80,y:115},'belly_giggle']] as const){await pet.click({position});await expect(pet).toHaveAttribute('data-action',action);await page.waitForTimeout(1000);}
  await pet.dblclick({position:{x:80,y:115}});await expect(pet).toHaveAttribute('data-action','roll_over');await page.waitForTimeout(1500);
  await pet.click({position:{x:80,y:90},clickCount:6,delay:80});await expect(pet).toHaveAttribute('data-action','poke_pout');await expect(pet).toHaveAttribute('data-action','poke_guard');await expect(pet).toHaveAttribute('data-action','face_rub');
  await playMenu(page,'纸箱躲猫猫');
  for(let round=1;round<=3;round++){await expect(hint).toHaveText(`第 ${round}/3 次 · 点纸箱逗我`);await expect(pet.locator('.box-front')).toBeVisible();await pet.click({position:{x:80,y:90}});await expect(pet).toHaveAttribute('data-action','box_hide');}
  await expect(pet).toHaveAttribute('data-action','box_pop');await page.screenshot({path:info.outputPath('13-box-pop.png'),fullPage:true});await expect(hint).toHaveText('纸箱真好玩');await expect(hint).toBeHidden();await expect(pet.locator('.box-front')).toBeHidden();
});
test('开始玩法保留排队通知，通知出队时中断玩法',async({page,request})=>{
  await ready(page);
  await request.post(`${api}/pet/interactions`,{headers:auth,data:{kind:'pet'}});
  const bubble=page.locator('.bubble'),pet=page.locator('.pet');await expect(bubble).toContainText('舒服。');
  await notify(request,'排队通知不能丢');await expect(bubble).toContainText('舒服。');
  await playMenu(page,'抛接球');await expect(pet).toHaveAttribute('data-play','ball');await expect(bubble).toContainText('舒服。');
  await page.locator('.bubble-close').click();await expect(bubble).toContainText('排队通知不能丢');await expect(bubble.locator('dd')).toHaveText(['3','张三','15:30','<script>window.injected=1</script>']);
  await expect(pet).not.toHaveAttribute('data-play',/./);await expect(page.locator('.play-hint')).toBeHidden();
  const response=await request.get(`${api}/notices`,{headers:auth});expect((await response.json()).items[0].status).toBe('unread');
});
test('玩法随退出、拖放、通知、勿扰、隐藏与离线中断，不恢复旧玩法',async({page,request})=>{
  await ready(page);const pet=page.locator('.pet'),hint=page.locator('.play-hint'),point={x:80,y:90};
  await page.locator('.browser-tools').getByRole('button',{name:'聊天',exact:true}).click();const draft=page.getByRole('textbox',{name:'聊天输入'});await draft.fill('玩完再发的草稿');
  await playMenu(page,'纸箱躲猫猫');await pet.click({position:point});await expect(draft).toHaveValue('玩完再发的草稿');await expect(page.locator('.panel header strong')).toHaveText('聊天');
  await playMenu(page,'结束玩耍');await expect(hint).toBeHidden();await playMenu(page,'抛接球');await page.keyboard.press('Escape');await expect(hint).toBeHidden();
  await playMenu(page,'纸箱躲猫猫');const rect=(await pet.boundingBox())!;await page.mouse.move(rect.x+80,rect.y+90);await page.mouse.down();await page.mouse.move(rect.x+110,rect.y+90,{steps:5});await page.mouse.up();await expect(hint).toBeHidden();
  await playMenu(page,'抛接球');await notify(request,'玩耍中也要看到通知');await expect(hint).toBeHidden();await expect(page.locator('.bubble')).toContainText('有新通知');await page.locator('.bubble-close').click();
  await playMenu(page,'纸箱躲猫猫');await request.post(`${api}/pet/quiet`,{headers:auth,data:{mode:'dnd',minutes:30}});await expect(pet).toHaveAttribute('data-action','quiet_curl');await expect(hint).toBeHidden();
  await pet.click({button:'right',position:point});await page.locator('.context-menu').getByText('玩一会儿',{exact:true}).click();await expect(page.locator('.context-menu').getByRole('button',{name:'抛接球',exact:true})).toBeDisabled();await page.keyboard.press('Escape');
  await request.post(`${api}/pet/quiet`,{headers:auth,data:{mode:'off'}});await expect(pet).not.toHaveAttribute('data-play',/./);
  await playMenu(page,'纸箱躲猫猫');await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await expect(hint).toBeHidden();
  await page.evaluate(()=>{Reflect.deleteProperty(document,'hidden');document.dispatchEvent(new Event('visibilitychange'));});await expect(pet).not.toHaveAttribute('data-play',/./);
  await playMenu(page,'抛接球');await playMenu(page,'纸箱躲猫猫');await expect(pet).toHaveAttribute('data-play','box');await pet.click({button:'right',position:point});await page.locator('.context-menu').getByRole('button',{name:'喂零食',exact:true}).click();await expect(hint).toBeHidden();await expect(pet).toHaveAttribute('data-action','eat_snack');
  for(const activity of ['working','waiting_auth','alert']){await playMenu(page,'抛接球');await request.post('http://127.0.0.1:18787/__test__/state',{data:{activity}});await expect(hint).toBeHidden();await expect(pet).not.toHaveAttribute('data-play',/./);await request.post('http://127.0.0.1:18787/__test__/state',{data:{activity:'idle'}});}
  await playMenu(page,'纸箱躲猫猫');await request.post(`${api}/pet/quiet`,{headers:auth,data:{mode:'demo'}});await expect(page.locator('.pet-host')).toBeHidden();await expect(hint).toBeHidden();await request.post(`${api}/pet/quiet`,{headers:auth,data:{mode:'off'}});await expect(pet).not.toHaveAttribute('data-play',/./);
  await playMenu(page,'抛接球');await request.post('http://127.0.0.1:18787/__test__/offline');await expect(hint).toBeHidden();await expect(pet).toHaveAttribute('data-action','offline_sleep');
  await request.post('http://127.0.0.1:18787/__test__/online');await page.getByRole('button',{name:'唤醒',exact:true}).click();await expect(pet).not.toHaveAttribute('data-play',/./);
});
test('玩法提示遵守禁忌、适配三种尺寸，30 秒自然退出',async({page,request})=>{
  await ready(page);
  await request.put(`${api}/pet/persona`,{headers:auth,data:{taboos:['点纸箱']}});await playMenu(page,'纸箱躲猫猫');
  await expect(page.locator('.pet')).toHaveAttribute('data-play','box');await expect(page.locator('.play-hint')).toBeHidden();await page.keyboard.press('Escape');
  await request.put(`${api}/pet/persona`,{headers:auth,data:{taboos:[]}});
  for(const size of [96,112,128]){
    await page.locator('.pet').click({button:'right',position:{x:70,y:80}});const menu=page.locator('.context-menu');await menu.getByText('大小',{exact:true}).click();await menu.getByRole('button',{name:String(size),exact:true}).click();
    await playMenu(page,'抛接球');await expect(page.locator('.play-hint')).toBeVisible();
    const fits=await page.locator('.play-hint').evaluate(hint=>{const host=hint.parentElement!.getBoundingClientRect(),rect=hint.getBoundingClientRect();return rect.left>=host.left&&rect.top>=host.top&&rect.right<=host.right&&rect.bottom<=host.bottom&&hint.scrollHeight<=hint.clientHeight&&hint.scrollWidth<=hint.clientWidth;});expect(fits).toBe(true);await page.keyboard.press('Escape');
  }
  const time=new Date('2026-11-19T15:00:00+08:00');await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
  const reported:PetInteraction[]=[];page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/pet/interactions'))reported.push(request.postDataJSON() as PetInteraction);});
  await playMenu(page,'纸箱躲猫猫');await page.clock.fastForward(29900);
  const pet=page.locator('.pet'),rect=(await pet.boundingBox())!;await page.mouse.move(rect.x+80,rect.y+90);await page.mouse.down();await page.clock.fastForward(100);
  await expect(page.locator('.play-hint')).toBeHidden();await expect(pet).not.toHaveAttribute('data-play',/./);await page.mouse.up();await page.clock.fastForward(400);
  expect(reported.filter(i=>['play','click','double_click','poke','pet'].includes(i.kind))).toEqual([{kind:'play',activityId:'box_peek'}]);
});
test('37 个动作的 SVG 素材巡检（无桌面窗口）',async({page},info)=>{
  await ready(page);
  const actions=Object.keys(JSON.parse(readFileSync(new URL('../public/skins/tuanzi-default/manifest.json',import.meta.url),'utf8')).animations);
  await page.evaluate(ids=>{const source=document.querySelector('.pet')!;const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(5,180px);gap:12px;padding:15px;background:#faf5eb;';for(const id of ids){const cell=document.createElement('section');const pet=source.cloneNode(true) as HTMLElement;pet.dataset.action=id;pet.classList.add('cap-equipped','yarn-equipped');const label=document.createElement('p');label.textContent=id;cell.append(pet,label);grid.append(cell);}document.querySelector('#app')!.replaceChildren(grid);},actions);
  await expect(page.locator('.pet')).toHaveCount(37);
  const frames=await page.evaluate(()=>Array.from(document.querySelectorAll('.pet')).slice(23).map(pet=>{const animations=pet.getAnimations({subtree:true});const rates=animations.map(animation=>{const effect=animation.effect as KeyframeEffect,timing=effect.getTiming(),steps=Number(getComputedStyle(effect.target as Element).animationTimingFunction.match(/steps\((\d+)/)?.[1]);animation.pause();animation.currentTime=Number(timing.duration)*(pet.getAttribute('data-action')==='box_hide'?.95:.6);const offsets=effect.getKeyframes().map(frame=>frame.computedOffset!),segment=Math.min(...offsets.slice(1).map((offset,i)=>offset-offsets[i]).filter(delta=>delta>0));return steps/(Number(timing.duration)/1000*segment);});return{action:pet.getAttribute('data-action'),rates};}));
  for(const frame of frames){expect(frame.rates.length,frame.action!).toBeGreaterThan(0);for(const rate of frame.rates)expect(rate,frame.action!).toBeLessThanOrEqual(30.001);}
  await page.screenshot({path:info.outputPath('11-all-actions.png'),fullPage:true});
});
test('演示模式隐藏团子，模拟托盘恢复',async({page},info)=>{
  await ready(page);await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByText('打扰',{exact:true}).click();await page.getByRole('button',{name:'演示模式（隐藏团子）',exact:true}).click();await expect(page.locator('.pet-host')).toBeHidden();await expect(page.locator('.bubble')).toBeHidden();await page.getByRole('button',{name:'从托盘恢复',exact:true}).click();await expect(page.locator('.pet-host')).toBeVisible();await page.screenshot({path:info.outputPath('09-demo-restored.png'),fullPage:true});
});
