import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const totalPlatforms=new Set(JSON.parse(readFileSync(new URL('../data/catalog.json',import.meta.url))).skills.flatMap(s=>s.platforms)).size;
// Run against an isolated Chrome instance with --remote-debugging-port=9337.
// No third-party packages or personal browser profile are needed.
const previewURL=new URL('../dist/preview.html',import.meta.url).href;
const target=(await (await fetch('http://127.0.0.1:9337/json/list')).json()).find(t=>t.type==='page');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
let seq=0;const pending=new Map();ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id&&pending.has(d.id)){const {resolve,reject}=pending.get(d.id);pending.delete(d.id);d.error?reject(Error(JSON.stringify(d.error))):resolve(d.result)}};
function send(method,params={}){return new Promise((resolve,reject)=>{pending.set(++seq,{resolve,reject});ws.send(JSON.stringify({id:seq,method,params}))})}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
async function snapshot(){return evaluate(`(()=>{const n=document.querySelector('#platform-nav'),t=document.querySelector('#platform-expand'),r=n.getBoundingClientRect();return {expanded:t.getAttribute('aria-expanded'),label:t.textContent,display:getComputedStyle(n).display,height:r.height,visibleRows:[...n.children].filter(x=>!x.hidden&&x.getBoundingClientRect().bottom>r.top&&x.getBoundingClientRect().top<r.bottom).length,unhidden:[...n.children].filter(x=>!x.hidden).length}})()`)}
for(const width of [1440,800,390]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:previewURL});
 for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,50));if(await evaluate(`document.querySelector('#platform-nav')?.children.length===${totalPlatforms}`))break}
 await evaluate("if(document.querySelector('#platform-expand').getAttribute('aria-expanded')==='true')document.querySelector('#platform-expand').click()");
 const before=await snapshot();
 const pos=await evaluate("(()=>{const b=document.querySelector('#platform-expand');b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...pos,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...pos,button:'left',clickCount:1});
 const after=await snapshot();
 assert.equal(after.expanded,'true');
 assert.notEqual(after.display,'none');
 assert.equal(after.unhidden,totalPlatforms);
 assert(after.height>before.height,`${width}: expansion must enlarge the visible list`);
 assert(after.visibleRows>before.visibleRows,`${width}: more platforms must be visible after a click`);
 // A platform outside the first seven remains discoverable after collapsing.
 await evaluate("document.querySelector('#platform-nav [data-platform=\"PrestaShop\"]').click()");
 await evaluate("document.querySelector('#platform-expand').click()");
 assert.equal(await evaluate("document.querySelector('#platform-nav [data-platform=\"PrestaShop\"]').hidden"),false);
 assert.equal(await evaluate("document.querySelector('#platform-select').value"),'PrestaShop');
 assert.equal((await snapshot()).expanded,'false');
 assert.equal(await evaluate("localStorage.getItem('commerce-platforms-expanded')"),'false');
 console.log(`PASS ${width}px: visible rows ${before.visibleRows} → ${after.visibleRows}; selection survives collapse`);

}
ws.close();
