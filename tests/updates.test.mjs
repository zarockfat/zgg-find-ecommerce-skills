import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadCatalog,validateCatalog} from '../skills/zgg-find-ecommerce-skills/scripts/updates.mjs';
const DAY=86400000;
const actual=JSON.parse(await readFile(new URL('../data/catalog.json',import.meta.url),'utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex');
function release(c,{version='0.2.0',fingerprint='a'.repeat(64)}={}){const text=JSON.stringify(c);return {schema_version:1,skill:'zgg-find-ecommerce-skills',skill_version:version,skill_sha256:fingerprint,catalog:{schema_version:1,updated_at:c.updated_at,count:c.skills.length,bytes:Buffer.byteLength(text),sha256:hash(text)}}}
async function fixture(t){
 const dir=await mkdtemp(path.join(tmpdir(),'zgg-updates-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const skillRoot=path.join(dir,'skill'),cacheDir=path.join(dir,'cache');await mkdir(path.join(skillRoot,'references'),{recursive:true});
 const c={version:1,coverage:actual.coverage,updated_at:'2026-11-14',skills:[actual.skills[0]]},r=release(c);
 await writeFile(path.join(skillRoot,'references/catalog.json'),JSON.stringify(c));await writeFile(path.join(skillRoot,'references/release.json'),JSON.stringify(r));
 return {dir,skillRoot,cacheDir,c,r,now:Date.now(),offline:false};
}
function server(c,r=release(c)){
 const calls=[];return {calls,fetcher:async(url,options)=>{calls.push(url);assert.equal(options.redirect,'error');assert(url.startsWith('https://raw.githubusercontent.com/zarockfat/zgg-find-ecommerce-skills/main/'));return new Response(JSON.stringify(url.endsWith('updates.json')?r:c))}};
}
test('new directory syncs once a day, persists offline and never modifies the bundled skill',async t=>{
 const f=await fixture(t),newer={...f.c,updated_at:'2026-11-15',skills:[actual.skills[0],actual.skills[1]]},s=server(newer);
 const first=await loadCatalog({...f,...s});assert.equal(first.catalog.skills.length,2);assert.equal(first.update.catalog_updated,true);assert.equal(s.calls.length,2);
 const cached=await loadCatalog({...f,...s,now:f.now+100});assert.equal(cached.update.status,'cached');assert.equal(cached.catalog.skills.length,2);assert.equal(s.calls.length,2);
 const offline=await loadCatalog({...f,...s,offline:true});assert.equal(offline.catalog.skills.length,2);assert.equal(s.calls.length,2);
 await loadCatalog({...f,...s,now:f.now+DAY});assert.equal(s.calls.length,3,'Next day only the manifest is needed when directory hash matches');
 assert.deepEqual(JSON.parse(await readFile(path.join(f.skillRoot,'references/catalog.json'),'utf8')),f.c);
});
test('network failure uses local data, is throttled, and explicit check retries',async t=>{
 const f=await fixture(t);let calls=0;const fetcher=async()=>{calls++;throw Error('No network')};
 const first=await loadCatalog({...f,fetcher});assert.equal(first.update.status,'failed');assert.equal(first.catalog.skills.length,1);
 assert.equal((await loadCatalog({...f,fetcher,now:f.now+1})).update.status,'failed_cached');assert.equal(calls,1);
 await loadCatalog({...f,fetcher,force:true});assert.equal(calls,2);
});
test('bad checksums, schema changes and older data preserve the last valid directory',async t=>{
 const f=await fixture(t),good={...f.c,updated_at:'2026-11-15',skills:[actual.skills[0],actual.skills[1]]};await loadCatalog({...f,...server(good)});
 for(const [c,r] of [[{...good,coverage:'tampered'},release({...good,coverage:'expected new content'})],[{...good,version:2},release({...good,version:2})],[f.c,release(f.c)]]){
  const result=await loadCatalog({...f,...server(c,r),force:true,now:f.now+DAY});assert.equal(result.update.status,'failed');assert.equal(result.catalog.skills.length,2);
 }
 const malicious=structuredClone(good);malicious.skills[0].repo='a/b;curl bad';assert.throws(()=>validateCatalog(malicious));
});
test('functional update only offers guidance and never fetches or replaces scripts',async t=>{
 const f=await fixture(t),r=release(f.c,{version:'0.3.0',fingerprint:'b'.repeat(64)}),s=server(f.c,r);
 const result=await loadCatalog({...f,...s});assert.equal(result.update.skill_update.available,true);assert.equal(result.update.skill_update.latest_version,'0.3.0');assert.equal(s.calls.length,1);assert(s.calls[0].endsWith('data/updates.json'));
 assert.equal(JSON.parse(await readFile(path.join(f.skillRoot,'references/release.json'),'utf8')).skill_version,'0.2.0');
});
test('corrupt cached data and timestamps cannot break offline lookup or suppress fresh checks',async t=>{
 const f=await fixture(t);await mkdir(f.cacheDir);await writeFile(path.join(f.cacheDir,'updates.json'),'{broken');
 assert.equal((await loadCatalog({...f,offline:true})).catalog.skills.length,1);
 for(const attempt_at of ['bad',f.now+DAY]){await writeFile(path.join(f.cacheDir,'updates.json'),JSON.stringify({baseline_skill:f.r.skill_sha256,baseline_catalog:f.r.catalog.sha256,attempt_at,release:f.r,catalog_text:JSON.stringify(f.c)}));const s=server(f.c);await loadCatalog({...f,...s});assert.equal(s.calls.length,1)}
});
test('parallel lookups share a lock, and read-only cache still allows bundled search',async t=>{
 const f=await fixture(t);await mkdir(f.cacheDir);await writeFile(path.join(f.cacheDir,'check.lock'),'');const s=server(f.c);
 const parallel=await loadCatalog({...f,...s});assert.equal(parallel.update.status,'checking_elsewhere');assert.equal(s.calls.length,0);
 const occupied=path.join(f.dir,'not-a-directory');await writeFile(occupied,'x');const unavailable=await loadCatalog({...f,...s,cacheDir:occupied});assert.equal(unavailable.update.status,'cache_unavailable');assert.equal(unavailable.catalog.skills.length,1);assert.equal(s.calls.length,0);
});
test('slow update checks time out and do not prevent search',async t=>{
 const f=await fixture(t),fetcher=async(_,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
 // Keep an event-loop handle alive while AbortSignal.timeout fires.
 const handle=setTimeout(()=>{},1000);try{const r=await loadCatalog({...f,fetcher,timeoutMs:25});assert.equal(r.update.status,'failed');assert.equal(r.catalog.skills.length,1)}finally{clearTimeout(handle)}
});
test('a custom catalog never runs automatic updates',async t=>{
 const f=await fixture(t),script=fileURLToPath(new URL('../skills/zgg-find-ecommerce-skills/scripts/search.mjs',import.meta.url));
 const out=JSON.parse(execFileSync(process.execPath,[script,'--catalog',path.join(f.skillRoot,'references/catalog.json'),'--check-updates','--limit','1'],{encoding:'utf8',env:{...process.env,ZGG_SKILLS_OFFLINE:'0',ZGG_SKILLS_CACHE_DIR:f.cacheDir}}));
 assert.equal(out.update.status,'custom');assert.equal(out.results.length,1);
});
