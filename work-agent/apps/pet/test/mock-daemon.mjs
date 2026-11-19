import http from 'node:http';
const port=18787, startedAt=17;
const streams=new Set();let seq=0, records=[],memories=[],firstRun=true,offline=false,held=[],events=[],interactions=[];
let persona,settings,state;
function reset(){
  records=[];memories=[];held=[];firstRun=true;offline=false;events=[];interactions=[];seq=0;
  persona={formatVersion:1,name:'团子',skin:'tuanzi-default',addressUser:'你',traits:['靠谱','元气'],speakingStyle:{verbosity:'normal',emoji:false,formality:'casual'},catchphrases:[],taboos:[],description:''};
  settings={workHours:{days:[1,2,3,4,5],start:'09:30',end:'18:30'},dailyBubbleCap:3,offworkReminder:true,acceptDevNotices:true,discloseConfidentialInBubble:false,sleepAfterWork:true};
  state={activity:'idle',badge:{notices:0,proposals:0,authRequests:0},quietReasons:[],audio:{enabled:false,playing:false,volume:.3},growth:{level:1,stats:{days:1},unlocked:[]},updatedAt:Date.now()};
}
reset();
function send(type,data){const event={id:String(++seq),type,data};events.push(event);for(const stream of streams)stream.write(`id: ${event.id}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`);}
function utterance(u){send('pet.utterance',{utterance:{sensitivity:'normal',id:`u_${++seq}`,expiresAt:Date.now()+60000,...u}});}
function updateState(){state.badge.notices=records.filter(r=>r.status==='unread').length;state.updatedAt=Date.now();send('pet.state',{state});}
function recordNotice(n){const existing=records.find(r=>r.notice.dedupeKey===n.dedupeKey&&['unread','snoozed'].includes(r.status));if(existing){existing.notice=n;existing.count++;send('notice.updated',{notice:existing});return existing;}
  const record={id:`n_${records.length+1}`,notice:n,from:{kind:'system',component:'local-api'},status:'unread',count:1,createdAt:Date.now(),updatedAt:Date.now()};records.push(record);send('notice.created',{notice:record});updateState();
  if(state.activity==='quiet')held.push(record);else utterance({text:'有新通知。',facts:n.facts,ref:{noticeId:record.id},quickActions:[{label:'稍后',notice:{noticeId:record.id,op:'snooze'}},{label:'忽略',notice:{noticeId:record.id,op:'dismiss'}}]});return record;
}
async function body(req){let value='';for await(const chunk of req)value+=chunk;if(value.length>65536)throw Error('large');return value?JSON.parse(value):{};}
const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin&&['http://127.0.0.1:1420','http://localhost:1420'].includes(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,Last-Event-ID');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE,OPTIONS');}
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const url=new URL(req.url,`http://127.0.0.1:${port}`),path=url.pathname.replace(/^\/api\/v1/,'');
  const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  try{
    if(path==='/__test__/reset'){for(const s of streams)s.end();streams.clear();reset();json({ok:true});return;}
    if(path==='/__test__/offline'){offline=true;for(const s of streams)s.end();streams.clear();json({ok:true});return;}
    if(path==='/__test__/online'){offline=false;json({ok:true});return;}
    if(path==='/__test__/events'){json({events,interactions});return;}
    if(path==='/__test__/state'){Object.assign(state,await body(req));updateState();json(state);return;}
    if(offline){json({error:{code:'offline',message:'offline'}},503);return;}
    if(path==='/health'){json({ok:true,version:'0.1.0',protocol:1,startedAt});return;}
    if(req.headers.authorization!=='Bearer test-only-token'){json({error:{code:'unauthorized',message:'unauthorized'}},401);return;}
    const value=await body(req),method=req.method;
    if(path==='/stream'){
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write('retry: 300\n\n');
      if(req.headers['last-event-id'])for(const e of events.filter(e=>Number(e.id)>Number(req.headers['last-event-id'])))res.write(`id: ${e.id}\nevent: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`);
      else res.write(`event: hello\ndata: ${JSON.stringify({seq})}\n\n`);
      streams.add(res);const heartbeat=setInterval(()=>res.write(': ping\n\n'),15000);req.on('close',()=>{streams.delete(res);clearInterval(heartbeat);});return;
    }
    if(path==='/pet/state'){json(state);return;}
    if(path==='/pet/persona'){if(method==='PUT'){persona={...persona,...value};firstRun=false;send('persona.updated',{persona});utterance({text:`${persona.addressUser}好，我是${persona.name}。`});}json({persona,firstRun});return;}
    if(path==='/pet/settings'){if(method==='PUT'){settings={...settings,...value};send('settings.updated',{settings});}json(settings);return;}
    if(path==='/pet/quiet'){
      state.quietReasons=value.mode==='demo'?['screen_share']:value.mode==='dnd'?['user_dnd']:[];state.activity=value.mode==='off'?'idle':'quiet';if(state.activity==='quiet')state.audio.playing=false;updateState();
      if(value.mode==='off'&&held.length){const count=new Set(held.map(r=>r.notice.dedupeKey)).size;held=[];utterance({text:`安静期间来了 ${count} 条`,quickActions:[{label:'查看',open:'notice'}]});}json(state);return;
    }
    if(path==='/pet/quiet/client'){json(state);return;}
    if(path==='/pet/audio'){state.audio={...state.audio,...value};if(!value.enabled)state.audio.playing=false;updateState();json(state);return;}
    if(path==='/pet/interactions'){interactions.push(value);let u=null;if(value.kind==='audio_play')state.audio.playing=true;if(value.kind==='audio_pause')state.audio.playing=false;if(value.kind==='pet')u={id:`pet_${++seq}`,sensitivity:'normal',text:'舒服。'};updateState();if(u)send('pet.utterance',{utterance:u});json({utterance:u});return;}
    if(path==='/notices'){if(method==='POST')json(recordNotice(value));else json({items:records.filter(r=>!url.searchParams.get('status')||r.status===url.searchParams.get('status'))});return;}
    const notice=path.match(/^\/notices\/([^/]+)\/(read|snooze|dismiss)$/);
    if(notice){const record=records.find(r=>r.id===notice[1]);if(!record){json({},404);return;}record.status={read:'read',snooze:'snoozed',dismiss:'dismissed'}[notice[2]];if(notice[2]==='snooze')record.snoozedUntil=Date.now()+(value.minutes||60)*60000;send('notice.updated',{notice:record});updateState();json(record);return;}
    if(path==='/memory'||path==='/memory/journal'){
      if(method==='POST'){const item={id:`m_${Date.now()}_${memories.length}`,createdAt:Date.now(),file:value.layer==='profile'?'user.md':'memory.md',origin:{kind:'user',evidenceType:'local_edit',evidenceId:'ev_test'},sensitivity:'normal',...value};memories.push(item);send('memory.changed',{id:item.id,layer:item.layer,change:'created'});json(item);}
      else json({items:memories.filter(m=>path.endsWith('journal')?m.layer==='journal':!url.searchParams.get('layer')||m.layer===url.searchParams.get('layer'))});return;
    }
    if(path==='/memory/reindex'){json({ok:true});return;}
    const memory=path.match(/^\/memory\/([^/]+)(\/retype)?$/);
    if(memory){const item=memories.find(m=>m.id===memory[1]);if(!item){json({},404);return;}
      if(method==='DELETE'){memories=memories.filter(m=>m.id!==item.id);send('memory.changed',{id:item.id,change:'forgotten'});json({ok:true});return;}
      if(memory[2]){item.kind=value.kind;}else Object.assign(item,value);send('memory.changed',{id:item.id,change:'updated',layer:item.layer});json(item);return;
    }
    if(path==='/chat'){
      let chunks=[{kind:'text',text:'这个我还不会，现在只会记事、提醒、勿扰和查通知'}];
      const match=value.message.match(/^记住[:： ，,]?(.{2,200})$/);
      if(match){const text=match[1].trim(),kind=/不要|别|禁止|必须|总是|每次|以后|优先|尽量|只在|不排/.test(text)?'rule':'fact';const item={id:`m_${Date.now()}_${memories.length}`,layer:kind==='rule'?'profile':'long_term',kind,text,createdAt:Date.now(),file:kind==='rule'?'user.md':'memory.md',origin:{kind:'user',evidenceType:'message',evidenceId:'ev_test'},sensitivity:'normal'};memories.push(item);send('memory.changed',{id:item.id,layer:item.layer,change:'created'});chunks=[{kind:'text',text:'记住了，不对可以点撤销。'},{kind:'card',card:{title:'记住了',facts:[{label:'原文',value:text},{label:'类型',value:kind}],items:[{id:item.id,text}],sensitivity:'normal',undoUntil:Date.now()+20000,actions:[{label:'撤销',action:'memory_undo',memoryId:item.id},{label:kind==='rule'?'改成事实':'改成规则',action:'memory_retype',memoryId:item.id,kind:kind==='rule'?'fact':'rule'}]}},{kind:'memory',itemId:item.id,change:'remembered'}];}
      json({conversationId:'conversation_test',chunks});return;
    }
    if(path==='/reminders'){json({items:[]});return;}
    json({error:{code:'not_found',message:'not_found'}},404);
  }catch{json({error:{code:'bad_request',message:'bad_request'}},400);}
});
server.listen(port,'127.0.0.1',()=>console.log(`Mock daemon listening on 127.0.0.1:${port} (test token only)`));
process.on('SIGTERM',()=>{for(const s of streams)s.end();server.close();});
