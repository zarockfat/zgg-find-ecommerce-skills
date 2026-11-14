#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {searchCatalog,installationGuide,installationClients} from './search-core.mjs';
import {loadCatalog,validateCatalog} from './updates.mjs';
import {websiteWelcome} from './welcome.mjs';
const options={},args=process.argv.slice(2),keys=['query','platform','category','capability','limit','catalog','agent'];
try{
 for(let i=0;i<args.length;i++){
  if(['--offline','--check-updates','--show-web','--no-welcome'].includes(args[i])){options[args[i].slice(2)]=true;continue}
  if(!args[i].startsWith('--')||!keys.includes(args[i].slice(2))||!args[i+1]||args[i+1].startsWith('--'))throw Error('Usage: node search.mjs [--query text] [--platform name] [--category name] [--capability name] [--limit 3] [--agent client-id] [--catalog path] [--offline | --check-updates] [--show-web] [--no-welcome]');
  options[args[i].slice(2)]=args[++i];
 }
 if(options.offline&&options['check-updates'])throw Error('Choose either --offline or --check-updates');
 const limit=Number(options.limit||3),agent=options.agent||'codex';
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('--limit must be 1..100');
 if(!installationClients.some(c=>c.id===agent))throw Error('Unsupported agent');
 let catalog,update;
 if(options.catalog){catalog=validateCatalog(JSON.parse(readFileSync(options.catalog,'utf8')));update={status:'custom',catalog_source:'custom',catalog_updated:false,message:'使用你指定的目录文件，不检查或覆盖它。'}}
 else({catalog,update}=await loadCatalog({offline:options.offline||process.env.ZGG_SKILLS_OFFLINE==='1',force:options['check-updates']===true}));
 if(update.skill_update?.available)update.skill_update.installation_guide=installationGuide({repo:'zarockfat/zgg-find-ecommerce-skills',name:'zgg-find-ecommerce-skills',path:'skills/zgg-find-ecommerce-skills/SKILL.md'},agent);
 const results=searchCatalog(catalog.skills,{q:options.query||'',platform:options.platform||'全部',category:options.category||'全部',capability:options.capability||'全部'});
 const welcome=await websiteWelcome({catalog,agent,force:options['show-web']===true,silent:options['no-welcome']===true});
 console.log(JSON.stringify({welcome,catalog_updated_at:catalog.updated_at,coverage:catalog.coverage,update,total_matches:results.length,results:results.slice(0,limit).map(s=>({...s,install_command:installationGuide(s,agent).command,installation_guide:installationGuide(s,agent)}))},null,2));
}catch(e){console.error(e.message);process.exitCode=1}
