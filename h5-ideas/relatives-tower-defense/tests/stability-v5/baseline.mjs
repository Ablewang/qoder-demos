import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const rows=[];
for(const [w,h,scale] of [[390,844,1],[320,568,1],[320,740,1.3],[740,320,1],[320,740,2]]){
 const c=await browser.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true}); const p=await c.newPage();
 await p.goto('http://127.0.0.1:5211/?probe=1&seed=21');
 if(scale!==1)await p.addStyleTag({content:`#app{--test-scale:${scale}}`});
 await p.evaluate(s=>{if(s===1)return;const a=document.querySelector('#app');const update=()=>{obs.disconnect();const es=[...a.querySelectorAll('*')].filter(e=>!(e instanceof SVGElement)&&!e.dataset.scaled);const fs=es.map(e=>parseFloat(getComputedStyle(e).fontSize));es.forEach((e,i)=>{e.style.fontSize=fs[i]*s+'px';e.dataset.scaled='1';});obs.observe(a,{childList:true,subtree:true});};const obs=new MutationObserver(update);update();},scale);
 await p.locator('[data-action="start"]').click();await p.waitForTimeout(300);
 const measure=()=>p.evaluate(()=>Object.fromEntries(['.battle-scene','.read-row','.hand',...['taiji','counter','crazy','sincere'].map(c=>`[data-card="${c}"]`)].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return[s,{x:r.x,y:r.y,w:r.width,h:r.height}];})));
 const before=await measure();await p.screenshot({path:`tests/stability-v5/before-${w}x${h}-text${scale*100}.png`});
 await p.locator('[data-card="taiji"]').click();await p.waitForTimeout(500);const after=await measure();rows.push({w,h,scale,before,after});await c.close();
}
await writeFile('tests/stability-v5/baseline-results.json',JSON.stringify({kind:'actual DOM clicks, CSS font-size simulation',rows},null,2));await browser.close();
