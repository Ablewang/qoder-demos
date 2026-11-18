import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const stamp=new Date().toISOString().replace(/[:.]/g,'-') + (process.env.GEOMETRY_GROUP ? `-group${process.env.GEOMETRY_GROUP}` : '');
const result={run:stamp,kind:'STATIC/ACCELERATED GEOMETRY FIXTURES: live probe state and event log are explicitly replaced; these are not natural games or unit-test counts',fontSimulation:'CSS --text-scale=1,1.3,2; not real operating-system text settings',cases:[],errors:[],screenshots:[],sourceHashes:{}};
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const fullMatrix=[[320,568,1],[320,740,1],[390,844,1],[1280,800,1],[320,568,1.3],[320,740,1.3],[390,844,1.3],[1280,800,1.3],[740,320,1],[740,320,1.3],[320,740,2],[740,320,2]];
const matrix=process.env.GEOMETRY_QUICK ? [[390,844,1.3],[320,740,2],[740,320,2]] : process.env.GEOMETRY_GROUP ? fullMatrix.slice(Number(process.env.GEOMETRY_GROUP)*6,Number(process.env.GEOMETRY_GROUP)*6+6) : fullMatrix;
for(const [width,height,scale] of matrix){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500,deviceScaleFactor:1});
 const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
 await page.goto('http://127.0.0.1:5211/?probe=1&seed=19');await page.evaluate(s=>document.documentElement.style.setProperty('--text-scale',String(s)),scale);
 const row={viewport:{width,height},scale,identities:[]};
 for(const identity of ['single','married','graduate','exam']){
  if(await page.locator('[data-action=start]').count()===0){await page.goto('http://127.0.0.1:5211/?probe=1&seed=19');await page.evaluate(s=>document.documentElement.style.setProperty('--text-scale',String(s)),scale);}
  await page.locator(`[data-identity=${identity}]`).click();await page.locator('[data-action=start]').click();await page.waitForTimeout(650);
  const evidence=await page.evaluate(async identity=>{
   const {questions,stats,relatives}=await import('/src/content.ts');const g=window.__rtdGame;
   const corpus=questions.filter(q=>q.identities.includes(identity));const names=Object.keys(relatives);let uid=100;let samples=0;let maxDelta=0;const issues=[];let baseline=null;const modes=new Set();const coverage={kinds:new Set(),effects:new Set(),labels:new Set(),scenarios:new Set(),questionIds:new Set()};
   let openingQuestion=null;if(innerWidth>innerHeight&&innerHeight<=480){const reader=document.querySelector('.battle-reader').getBoundingClientRect(),range=document.createRange();range.selectNodeContents(document.querySelector('.question[aria-pressed=true] .question-text'));const lines=[...range.getClientRects()].filter(r=>r.width),visible=lines.filter(r=>r.top>=reader.top-1&&r.bottom<=reader.bottom+1).length;openingQuestion={lines:lines.length,fullyVisibleLines:visible};if(visible<Math.min(2,lines.length))issues.push({type:'opening-question-not-readable',...openingQuestion});}
   const settled=async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));};
   const measure=(tag)=>{
    const mode=document.querySelector('.battle-page').dataset.layout;modes.add(mode);
    const rects=Object.fromEntries(['.battle-top','.battle-scene','.talks','.read-row','.ghost-slot','.hand','.battle-footnote',...(mode==='reader'?['.table-hand']:[]),...[...document.querySelectorAll('[data-card]')].map(e=>`[data-card=${e.dataset.card}]`)].map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return[s,[r.x,r.y,r.width,r.height]]}));
    if(!baseline)baseline=rects;for(const [s,r] of Object.entries(rects))for(let i=0;i<4;i++)maxDelta=Math.max(maxDelta,Math.abs(r[i]-baseline[s][i]));
    if(mode==='reader'){const r=document.querySelector('.battle-reader').getBoundingClientRect(),line=parseFloat(getComputedStyle(document.querySelector('.question-text')).lineHeight);if(r.height<line*2)issues.push({tag,type:'reader-too-short',height:r.height,min:line*2});}
    const range=document.createRange();const selectors='[data-action=read]:not([hidden]),.question-text,.question-name,.question-meta,.answer-text,.card-effect,.card-top,.charges,.reply-to,[data-live=status],.ghost-text,.talk-context,.battle-footnote,.dish-title';
    for(const el of document.querySelectorAll(selectors)){
     if(el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1)issues.push({tag,type:'element-overflow',class:el.className,text:el.textContent,scroll:[el.scrollWidth,el.scrollHeight],client:[el.clientWidth,el.clientHeight]});
     if(el.matches('.question-text,.answer-text,.card-effect,.reply-to,[data-live=status],.ghost-text,.talk-context,.battle-footnote')){
      const bounds=el.getBoundingClientRect();const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
      for(let n=walker.nextNode();n;n=walker.nextNode()){if(!n.data.trim())continue;range.selectNodeContents(n);for(const r of range.getClientRects())if(r.width&& (r.left<bounds.left-1||r.right>bounds.right+1||r.top<bounds.top-1||r.bottom>bounds.bottom+1))issues.push({tag,type:'text-outside-own-budget',class:el.className,text:n.data,bounds:[bounds.x,bounds.y,bounds.width,bounds.height],range:[r.x,r.y,r.width,r.height]});}
     }
    }
    for(const el of document.querySelectorAll('.player-label,.mood,.dish-title')){const owner=el.closest('.battle-scene,.battle-top').getBoundingClientRect();range.selectNodeContents(el);for(const r of range.getClientRects())if(r.width&&(r.left<owner.left-1||r.right>owner.right+1||r.top<owner.top-1||r.bottom>owner.bottom+1))issues.push({tag,type:'player-or-header-text-clipped',text:el.textContent});}
    for(const el of document.querySelectorAll('.question-text,.answer-text,.card-effect,.ghost-text')){const card=el.closest('.question,.answer-card,.reply-ghost');if(card){const r=el.getBoundingClientRect(),p=card.getBoundingClientRect();if(r.left<p.left-1||r.right>p.right+1||r.top<p.top-1||r.bottom>p.bottom+1)issues.push({tag,type:'content-outside-card',class:el.className,text:el.textContent});}}
    if(document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1)issues.push({tag,type:'outer-page-scroll'});
    if(g.phase==='playing')for(const el of document.querySelectorAll('[data-card]')){const r=el.getBoundingClientRect();if(r.width<44||r.height<44||r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1)issues.push({tag,type:'action-not-visible',card:el.dataset.card,rect:[r.x,r.y,r.width,r.height]});const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(!el.contains(hit))issues.push({tag,type:'action-overlay',card:el.dataset.card});}
    for(const el of document.querySelectorAll('.card-effect'))coverage.effects.add(el.textContent.trim());coverage.labels.add(document.querySelector('.reply-to').textContent);samples++;
   };
   const item=(question,asker=question.askers[0])=>({uid:++uid,question,asker,hp:stats[question.kind].hp,maxHp:stats[question.kind].hp,remaining:stats[question.kind].patience,total:stats[question.kind].patience,readShown:true});
   const fixture=async(active,tag,extra={})=>{
    Object.assign(g,{phase:'playing',wave:1,paused:false,active,targetUid:active[0]?.uid??null,mood:90+(samples%2),reading:8,freeze:0,cooldown:0,lock:0,charges:{taiji:Infinity,counter:3,crazy:3,sincere:3},angry:new Set(),allies:[],nextSpawn:100000,pending:[],...extra});
    await settled();measure(tag);
   };
   for(const question of corpus){coverage.kinds.add(question.kind);coverage.questionIds.add(question.id);for(const asker of question.kind==='followup'?names.filter(n=>!['nainai','table'].includes(n)):question.askers){await fixture([item(question,asker)],`${question.id}/${asker}`);}}
   const ordinary=corpus.find(q=>q.kind==='normal');const tough=corpus.find(q=>q.kind==='tough');const boss=corpus.find(q=>q.kind==='boss');const warm=corpus.find(q=>q.kind==='warm');
   for(const scenario of ['single','double','same-asker','switched-target','reading-hidden','cooldown-1.8','cooldown-1.1','all-empty','allies','anger','warm','boss','no-target','reward']){
    coverage.scenarios.add(scenario);let active=[item(tough)];let extra={};
    if(['double','same-asker','switched-target'].includes(scenario)){active.push(item(ordinary,scenario==='same-asker'?active[0].asker:ordinary.askers[0]));if(scenario==='switched-target')extra.targetUid=active[1].uid;}
    if(scenario==='reading-hidden')extra={reading:0};
    if(scenario.startsWith('cooldown'))extra={reading:0,cooldown:Number(scenario.split('-')[1])};
    if(scenario==='all-empty')extra={charges:{taiji:Infinity,counter:0,crazy:0,sincere:0},reading:0,cooldown:1.8};
    if(scenario==='allies')extra={allies:names.filter(n=>n!=='table').map(asker=>({asker,used:false}))};
    if(scenario==='anger'){active[0].hp++;active[0].maxHp++;extra.angry=new Set(names.filter(n=>!['table','nainai'].includes(n)));}
    if(scenario==='warm')active=[item(warm)];if(scenario==='boss')active=[item(boss)];if(['no-target','reward'].includes(scenario)){active=[];extra={phase:'reward'};}
    await fixture(active,scenario,extra);
   }
   for(const asker of names){
    for(const branch of ['answer-taiji','answer-counter','answer-crazy','critical','flop','blocked','sincere','calmed','ally','missed','warm-missed','sincere-boss']){
     const question=branch==='sincere-boss'?boss:branch==='warm-missed'?warm:tough;const q=item(question,asker);const next=item(ordinary,asker==='erjiu'?'gufu':'erjiu');const card=branch==='answer-counter'||branch==='blocked'?'counter':branch==='answer-crazy'||['critical','flop'].includes(branch)?'crazy':['sincere','calmed','sincere-boss'].includes(branch)?'sincere':'taiji';
     const log=[{type:'answer',qid:question.id,uid:q.uid,asker,card,text:question.answers[card],points:0}];
     if(['critical','flop'].includes(branch))log.push({type:branch,qid:question.id,uid:q.uid,asker,text:branch,points:0});
     else if(!branch.startsWith('answer'))log.push({type:'resolved',qid:question.id,uid:q.uid,asker,card,text:branch==='ally'?relatives[asker].line:question.text,outcome:branch==='sincere-boss'?'sincere':branch,points:0});
     const resolved=!branch.startsWith('answer')&&!['critical','flop'].includes(branch);coverage.scenarios.add(`feedback-${branch}`);
     if(resolved)await fixture([q],`before-${branch}/${asker}`);
     await fixture(resolved?[next]:[q],`${branch}/${asker}`,{reading:0,log:g.log.concat(log),allies:branch==='sincere'?[{asker,used:false}]:[],angry:branch==='blocked'||branch==='answer-counter'?new Set([asker]):new Set()});
    }
   }
   const reader=document.querySelector('.battle-reader');let scrollPreservation=null;
   if(modes.has('reader')){reader.scrollTop=200;const before=reader.scrollTop;g.mood=88;await settled();const after=document.querySelector('.battle-reader').scrollTop;scrollPreservation={before,after,delta:Math.abs(after-before)};}
   return {identity,corpus:corpus.length,shortestQuestion:corpus.reduce((a,b)=>a.text.length<=b.text.length?a:b).id,longestQuestion:corpus.reduce((a,b)=>a.text.length>=b.text.length?a:b).id,shortestAnswer:corpus.flatMap(q=>Object.entries(q.answers).map(([card,text])=>({qid:q.id,card,text}))).sort((a,b)=>a.text.length-b.text.length)[0],longestAnswer:corpus.flatMap(q=>Object.entries(q.answers).map(([card,text])=>({qid:q.id,card,text}))).sort((a,b)=>b.text.length-a.text.length)[0],samples,maxDelta,modes:[...modes],openingQuestion,issues:issues.slice(0,100),issueCount:issues.length,readerHeight:document.querySelector('.battle-reader').clientHeight,coverage:Object.fromEntries(Object.entries(coverage).map(([k,v])=>[k,[...v]])),scrollPreservation,vars:document.querySelector('#app').getAttribute('style')};
  },identity);
  row.identities.push(evidence);console.log(`${width}x${height} x${scale} ${identity}: ${evidence.samples} fixture observations; drift=${evidence.maxDelta}; text/action issues=${evidence.issueCount}`);
  if(identity==='single'||(width===390&&scale===1)){
   for(const [label,qid] of [['shortest',evidence.shortestAnswer.qid],['longest',evidence.longestAnswer.qid]]){
    await page.evaluate(async qid=>{const {questions,stats}=await import('/src/content.ts');const g=window.__rtdGame;const question=questions.find(q=>q.id===qid),s=stats[question.kind];const q={uid:200001,question,asker:question.askers[0],hp:s.hp,maxHp:s.hp,remaining:s.patience,total:s.patience,readShown:true};Object.assign(g,{active:[q],targetUid:q.uid,reading:8,freeze:0,mood:80+(qid.length%2),lock:0,cooldown:0,phase:'playing'});document.querySelector('.battle-reader').scrollTop=0;},qid);
    await page.waitForTimeout(100);if(width>height&&height<=480)await page.evaluate(()=>{const r=document.querySelector('.battle-reader'),q=document.querySelector('.question[aria-pressed=true] .question-text');r.scrollTop+=q.getBoundingClientRect().top-r.getBoundingClientRect().top;});const file=`${stamp}-after-${identity}-${width}x${height}-text${scale*100}-${label}.png`;await page.screenshot({path:`tests/stability-v5/${file}`,fullPage:true});result.screenshots.push(file);
    if(evidence.modes[0]==='reader'){await page.evaluate(()=>{const r=document.querySelector('.battle-reader'),h=document.querySelector('.hand');r.scrollTop+=h.getBoundingClientRect().top-r.getBoundingClientRect().top;});const answerFile=file.replace('.png','-answers.png');await page.screenshot({path:`tests/stability-v5/${answerFile}`,fullPage:true});result.screenshots.push(answerFile);}
   }
  }
 }
 result.cases.push(row);await context.close();await writeFile(`tests/stability-v5/${stamp}-geometry.json`,JSON.stringify(result,null,2));
}
for(const file of ['src/main.ts','src/style.css','src/engine.ts','src/content.ts','src/content/questions.json','src/audio.ts','src/art.ts','src/poster.ts'])result.sourceHashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
result.passed=result.errors.length===0&&result.cases.every(c=>c.identities.every(i=>i.maxDelta<=1&&i.issueCount===0&&i.modes.length===1&&(!i.scrollPreservation||i.scrollPreservation.delta<=1)));
await writeFile(`tests/stability-v5/${stamp}-geometry.json`,JSON.stringify(result,null,2));console.log(`Geometry report: tests/stability-v5/${stamp}-geometry.json; passed=${result.passed}`);await browser.close();if(!result.passed)process.exitCode=1;
