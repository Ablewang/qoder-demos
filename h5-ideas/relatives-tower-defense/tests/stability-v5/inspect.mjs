import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const results=[];
for (const [width,height,scale] of [[390,844,1],[320,568,1],[320,740,1.3],[740,320,1],[320,740,2],[1280,800,1]]) {
 const page=await browser.newPage({viewport:{width,height}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5211/?probe=1&seed=11');
 await page.evaluate(s=>document.documentElement.style.setProperty('--text-scale',s),String(scale));
 await page.locator('[data-action=start]').click();await page.waitForTimeout(1000);
 const data=await page.evaluate(()=>({mode:document.querySelector('.battle-page').dataset.layout,vars:document.querySelector('#app').getAttribute('style'),rects:Object.fromEntries(['.battle-top','.battle-scene','.talks','.read-row','.ghost-slot','.hand','.battle-footnote','.table-hand'].map(s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return[s,r?{x:r.x,y:r.y,w:r.width,h:r.height,scroll:e.scrollHeight,client:e.clientHeight}:null]})),textIssues:[...document.querySelectorAll('.question-text,.question-name,.question-meta,.answer-text,.card-effect,.card-top,.charges,.reply-to,[data-live=status]')].flatMap(e=>{const r=e.getBoundingClientRect();return e.scrollHeight>e.clientHeight+1||e.scrollWidth>e.clientWidth+1?[{class:e.className,text:e.textContent,rect:{x:r.x,y:r.y,w:r.width,h:r.height},scroll:[e.scrollWidth,e.scrollHeight],client:[e.clientWidth,e.clientHeight]}]:[]})}));
 await page.screenshot({path:`tests/stability-v5/inspect-${width}x${height}-${scale}.png`,fullPage:true});
 results.push({width,height,scale,...data,errors});await page.close();
}
await writeFile('tests/stability-v5/inspect.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close();
