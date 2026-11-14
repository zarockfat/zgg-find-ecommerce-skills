import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,cp,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {websiteWelcome} from '../skills/zgg-find-ecommerce-skills/scripts/welcome.mjs';
import {prepareRelease} from '../scripts/prepare-release.mjs';
const catalog={updated_at:'2026-11-15',skills:[{id:'a',title:'test'}]};
const template='<!doctype html><style>body{color:red}</style><script>let catalog=/* ZGG_CATALOG_START */{}/* ZGG_CATALOG_END */;</script>';
async function fixture(t){
 const dir=await mkdtemp(path.join(tmpdir(),'zgg-welcome-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const skillRoot=path.join(dir,'skill'),cacheDir=path.join(dir,'cache');await mkdir(path.join(skillRoot,'references'),{recursive:true});await mkdir(path.join(skillRoot,'assets'));
 await writeFile(path.join(skillRoot,'references/website.json'),JSON.stringify({schema_version:1,mode:'local',entry:'assets/ecommerce-skills.html'}));await writeFile(path.join(skillRoot,'assets/ecommerce-skills.html'),template);
 return {dir,skillRoot,cacheDir,catalog};
}
test('first search gives a real local page once; explicit request can show it again',async t=>{
 const f=await fixture(t),first=await websiteWelcome(f);assert(first.show&&first.available&&first.remembered);assert(first.url.startsWith('file:'));assert(first.message.includes(first.path));assert(first.path.startsWith(f.cacheDir));
 assert.equal((await websiteWelcome(f)).show,false);assert.equal((await websiteWelcome({...f,force:true})).show,true);
 const html=await readFile(first.path,'utf8');assert(html.includes('"updated_at":"2026-11-15"'));assert.equal(await readFile(path.join(f.skillRoot,'assets/ecommerce-skills.html'),'utf8'),template);
});
test('new data and new page templates refresh the same local link without repeating welcome',async t=>{
 const f=await fixture(t),first=await websiteWelcome(f);const next=await websiteWelcome({...f,catalog:{...catalog,skills:[...catalog.skills,{id:'b',title:'new skill'}]}});assert.equal(next.path,first.path);assert.equal(next.show,false);assert(next.page_refreshed);assert((await readFile(next.path,'utf8')).includes('new skill'));
 await writeFile(path.join(f.skillRoot,'assets/ecommerce-skills.html'),template.replace('color:red','color:blue'));const upgraded=await websiteWelcome(f);assert.equal(upgraded.path,first.path);assert.equal(upgraded.show,false);assert((await readFile(upgraded.path,'utf8')).includes('color:blue'));
});
test('silent onboarding persists and parallel calls introduce a local installation once',async t=>{
 const f=await fixture(t),hidden=await websiteWelcome({...f,silent:true});assert.equal(hidden.show,false);assert.equal((await websiteWelcome(f)).show,false);
 const separate=await fixture(t),results=await Promise.all(Array.from({length:4},()=>websiteWelcome(separate)));assert.equal(results.filter(r=>r.show).length,1);assert(results.every(r=>r.available));
});
test('missing or unsafe local-page configuration cannot produce fake or external links',async t=>{
 const f=await fixture(t);
 for(const entry of ['/etc/passwd','../secret.html','assets/missing.html']){await writeFile(path.join(f.skillRoot,'references/website.json'),JSON.stringify({schema_version:1,mode:'local',entry}));const r=await websiteWelcome(f);assert.equal(r.available,false);assert.equal(r.show,false);assert.equal(r.url,null)}
});
test('unwritable cache falls back to the actual bundled page; other clients get a file URL',async t=>{
 const f=await fixture(t),occupied=path.join(f.dir,'occupied');await writeFile(occupied,'x');const r=await websiteWelcome({...f,cacheDir:occupied,agent:'workbuddy'});assert.equal(r.path,await realpath(path.join(f.skillRoot,'assets/ecommerce-skills.html')));assert.equal(r.remembered,false);assert.equal(r.catalog_current,false);assert(r.message.includes(r.url));
});
test('catalog text is escaped and a tampered cached page is repaired',async t=>{
 const f=await fixture(t),dangerous={...catalog,skills:[{id:'x',title:'</script><script>bad()</script>'}]};const r=await websiteWelcome({...f,catalog:dangerous});assert(!(await readFile(r.path,'utf8')).includes('<script>bad()'));
 await writeFile(r.path,'tampered');const repaired=await websiteWelcome(f);assert(repaired.page_refreshed);assert((await readFile(r.path,'utf8')).startsWith('<!doctype html>'));
});
test('the shipped single HTML is complete and its embedded module parses offline',async()=>{
 const html=await readFile(new URL('../skills/zgg-find-ecommerce-skills/assets/ecommerce-skills.html',import.meta.url),'utf8');assert(html.includes('ZGG_CATALOG_START'));assert(!html.includes("fetch('./data/catalog.json')"));assert(!html.includes('fonts.googleapis.com'));assert(!/<(?:img|script)[^>]+src="\.\//.test(html));assert(!html.includes('href="./downloads/'));
 const code=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];assert(code);const r=spawnSync(process.execPath,['--input-type=module','--check'],{input:code,encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});
test('offline CLI prints first-use instructions, caches the local page, and keeps search results',async t=>{
 const f=await fixture(t),script=fileURLToPath(new URL('../skills/zgg-find-ecommerce-skills/scripts/search.mjs',import.meta.url));
 const env={...process.env,ZGG_SKILLS_OFFLINE:'1',ZGG_SKILLS_CACHE_DIR:f.cacheDir};
 const run=extra=>JSON.parse(execFileSync(process.execPath,[script,'--query','TikTok 选品','--limit','1','--offline',...extra],{encoding:'utf8',cwd:'/tmp',env}));
 const first=run([]);assert.equal(first.welcome.show,true);assert.equal(first.update.status,'offline');assert(first.results.length);assert.equal(run([]).welcome.show,false);assert.equal(run(['--show-web']).welcome.show,true);
});
test('release detects layout upgrades without treating catalog-only changes as code upgrades',async t=>{
 const f=await fixture(t),root=path.join(f.dir,'project'),skill=path.join(root,'skills/zgg-find-ecommerce-skills');await mkdir(path.join(root,'data'),{recursive:true});await cp(new URL('../skills/zgg-find-ecommerce-skills/',import.meta.url),skill,{recursive:true});
 const original=await readFile(new URL('../data/catalog.json',import.meta.url),'utf8');await writeFile(path.join(root,'data/catalog.json'),original);const first=await prepareRelease(root);
 const htmlPath=path.join(skill,'assets/ecommerce-skills.html'),html=await readFile(htmlPath,'utf8');const changed=JSON.parse(original);changed.updated_at='2026-11-15';await writeFile(path.join(root,'data/catalog.json'),JSON.stringify(changed));await writeFile(htmlPath,html.replace(/\/\* ZGG_CATALOG_START \*\/[\s\S]*?\/\* ZGG_CATALOG_END \*\//,'/* ZGG_CATALOG_START */'+JSON.stringify(changed)+'/* ZGG_CATALOG_END */'));
 const dataOnly=await prepareRelease(root);assert.equal(first.skill_sha256,dataOnly.skill_sha256);assert.notEqual(first.catalog.sha256,dataOnly.catalog.sha256);
 await writeFile(htmlPath,(await readFile(htmlPath,'utf8')).replace('</style>','body{color:blue}</style>'));assert.notEqual((await prepareRelease(root)).skill_sha256,dataOnly.skill_sha256);
});
