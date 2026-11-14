process.env.ZGG_SKILLS_OFFLINE='1';
import {fileURLToPath} from 'node:url';
import {test,after} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,mkdtempSync,rmSync} from 'node:fs';import {execFileSync,spawnSync} from 'node:child_process';import {searchCatalog,installationCommand,installationGuide,summarizePlatforms} from '../src/search.mjs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const searchTestCache=mkdtempSync(path.join(tmpdir(),'zgg-search-tests-'));process.env.ZGG_SKILLS_CACHE_DIR=searchTestCache;after(()=>rmSync(searchTestCache,{recursive:true,force:true}));
const skills=JSON.parse(readFileSync(new URL('../data/catalog.json',import.meta.url))).skills;
test('Chinese natural-language task ranks TikTok research first',()=>{const r=searchCatalog(skills,{q:'帮我找TikTok选品的技能'});assert(r.length);assert.equal(r[0].name,'tiktok-shop-product-research');assert(r.every(s=>s.category==='选品调研'))});
test('platform and category intersect strictly',()=>{const r=searchCatalog(skills,{platform:'Amazon',category:'经营分析'});assert(r.length);assert(r.every(s=>s.platforms.includes('Amazon')&&s.category==='经营分析'))});
test('unknown keywords and unsupported strict platform return no results',()=>{assert.equal(searchCatalog(skills,{q:'nonesuchxyz'}).length,0);assert.equal(searchCatalog(skills,{platform:'UnsupportedPlatform'}).length,0)});
test('favorites do not leak non-favorite results',()=>{const selected=skills.at(-1);assert.deepEqual(searchCatalog(skills,{favorites:new Set([selected.id])}),[selected]);assert.equal(searchCatalog(skills,{favorites:new Set()}).length,0)});
test('new platform and capability filters separate data from store operations',()=>{
 const data=searchCatalog(skills,{platform:'Temu',capability:'数据查询'});
 const operations=searchCatalog(skills,{platform:'Temu',capability:'店铺操作'});
 assert(data.length>0&&operations.length>0);
 assert(data.every(s=>s.platforms.includes('Temu')&&s.capability==='数据查询'));
 assert(operations.every(s=>s.capability==='店铺操作'));
 assert(data.every(s=>!operations.includes(s)));
});
test('Chinese local and cross-border platform queries stay distinct',()=>{
 for(const [q,platform] of [['抖音主图','抖音小店'],['虾皮选品','Shopee'],['1688找货','1688'],['速卖通图片','AliExpress'],['拼多多选品','拼多多'],['美客多选品','Mercado Libre'],['野莓开发','Wildberries']]){
  const results=searchCatalog(skills,{q});assert(results.length>0,q);
  assert(results.some(s=>s.platforms.includes(platform)),q);
  assert(results.every(s=>s.platforms.includes(platform)||s.platforms.includes('通用')),q);
 }
});
test('collection counts reconcile and published sources remain traceable',()=>{
 const report=JSON.parse(readFileSync(new URL('../data/review-summary.json',import.meta.url)));
 assert.equal(report.scope_complete,false);
 assert.equal(report.published_skills,skills.length);
 assert.equal(report.raw_candidate_files,Object.values(report.candidate_dispositions).reduce((a,b)=>a+b,0));
 assert.equal(report.published_repositories,new Set(skills.map(s=>s.repo)).size);
 assert.equal(new Set(skills.map(s=>s.content_sha256)).size,skills.length);
 for(const s of skills){assert.notEqual(s.license,'UNKNOWN');assert.match(s.content_sha256,/^[a-f0-9]{64}$/);assert(s.source_url.includes(s.source_commit));assert.equal(s.tested,false)}
});
test('packaged AI search accepts capability filters with the same catalog',()=>{
 const script=fileURLToPath(new URL('../skills/zgg-find-ecommerce-skills/scripts/search.mjs',import.meta.url));
 const output=JSON.parse(execFileSync(process.execPath,[script,'--platform','Temu','--capability','数据查询','--limit','100'],{cwd:'/tmp',encoding:'utf8'}));
 assert.deepEqual(output.results.map(s=>s.id),searchCatalog(skills,{platform:'Temu',capability:'数据查询'}).map(s=>s.id));
});
test('untrusted installation target cannot become shell code',()=>{assert.throws(()=>installationCommand({...skills[0],repo:'a/b;curl bad'}));assert.throws(()=>installationCommand({...skills[0],name:'$(bad)'}));assert.throws(()=>installationCommand(skills[0],'codex;bad'));assert.match(installationCommand(skills[0],'cursor'),/-a cursor$/)});
test('CLI bundle works outside repository working directory',()=>{const script=new URL('../skills/zgg-find-ecommerce-skills/scripts/search.mjs',import.meta.url);const out=JSON.parse(execFileSync(process.execPath,[fileURLToPath(script),'--platform','Amazon','--limit','2','--agent','claude-code'],{cwd:'/tmp',encoding:'utf8'}));assert.equal(out.results.length,2);assert(out.results.every(s=>s.platforms.includes('Amazon')));assert.match(out.results[0].install_command,/-a claude-code$/)});
test('CLI rejects invalid flags and limits',()=>{const script=new URL('../skills/zgg-find-ecommerce-skills/scripts/search.mjs',import.meta.url);assert.notEqual(spawnSync(process.execPath,[fileURLToPath(script),'--limit','0']).status,0);assert.notEqual(spawnSync(process.execPath,[fileURLToPath(script),'--unknown','x']).status,0)});
test('offline preview has an independent valid module with embedded catalog',()=>{const html=readFileSync(new URL('../dist/preview.html',import.meta.url),'utf8');const scripts=[...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);assert(!scripts[0][1].includes("fetch('./data/catalog.json')"));const checked=spawnSync(process.execPath,['--input-type=module','--check'],{input:scripts[0][1],encoding:'utf8'});assert.equal(checked.status,0,checked.stderr)});
test('offline stylesheet keeps root palette intact after removing font imports containing semicolons',()=>{
 const html=readFileSync(new URL('../dist/preview.html',import.meta.url),'utf8');
 const css=html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
 assert.ok(css,'Embedded stylesheet must exist');
 assert.ok(css.trimStart().startsWith(':root{'),'No font URL fragments may precede the root rule');
 assert.ok(!css.includes('fonts.googleapis.com')&&!css.includes('display=swap'));
 const root=css.match(/^\s*:root\{([^}]+)\}/)?.[1];
 assert.ok(root,'Root palette must be a valid standalone rule');
 assert.match(root,/--orange:#e9693c;/);
 assert.match(root,/--ink:#202923;/);
 assert.match(css,/\.brandmark\{[^}]*background:var\(--orange\)/);
 assert.match(css,/\.primary\{[^}]*background:var\(--ink\)/);
});

test('platform navigation includes every catalog platform with independent counts',()=>{
 const groups=summarizePlatforms(skills);
 assert.deepEqual(new Set(groups.map(g=>g.name)),new Set(skills.flatMap(s=>s.platforms)));
 for(const group of groups){
  const filtered=searchCatalog(skills,{platform:group.name});
  assert.equal(group.count,filtered.length,group.name);
  assert(group.count>0);
 }
 for(const p of ['Lazada','Ozon','SHOPLINE','PrestaShop','Magento','Wildberries','拼多多'])assert(groups.some(g=>g.name===p),p);
});
test('new platform tags appear automatically and repeated tags never inflate counts',()=>{
 const groups=summarizePlatforms([{platforms:['NewMarketplace','Amazon','Amazon']},{platforms:['NewMarketplace']}]);
 assert.equal(groups.find(g=>g.name==='NewMarketplace').count,2);
 assert.equal(groups.find(g=>g.name==='Amazon').count,1);
});

test('client guides distinguish supported commands from package imports',()=>{
 for(const agent of ['trae-cn','trae','codebuddy','kimi-code-cli','qwen-code','openclaw'])assert.match(installationGuide(skills[0],agent).command,new RegExp(' -a '+agent+'$'));
 for(const agent of ['workbuddy','doubao']){const g=installationGuide(skills[0],agent);assert.equal(g.command,null);assert(g.steps.length>0);assert.equal(g.tested,false);assert.throws(()=>installationCommand(skills[0],agent));}
 const generic=installationGuide(skills[0],'other');assert.equal(generic.mode,'interactive');assert(!generic.command.includes(' -a '));
 assert.throws(()=>installationGuide({...skills[0],repo:'a/b;bad'},'workbuddy'));
});
test('packaged CLI returns import guidance instead of an invalid client command',()=>{
 const script=fileURLToPath(new URL('../skills/zgg-find-ecommerce-skills/scripts/search.mjs',import.meta.url));
 for(const agent of ['workbuddy','doubao']){const output=JSON.parse(execFileSync(process.execPath,[script,'--query','TikTok 选品','--agent',agent,'--limit','1'],{cwd:'/tmp',encoding:'utf8'}));assert(output.results.length);const r=output.results[0];assert.equal(r.install_command,null);assert.equal(r.installation_guide.client,agent);assert(r.installation_guide.steps.length>0);}
});
