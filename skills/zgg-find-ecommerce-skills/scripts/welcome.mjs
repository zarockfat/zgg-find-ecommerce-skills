import {readFile,mkdir,open,writeFile,rename,unlink,stat,realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const ROOT=fileURLToPath(new URL('..',import.meta.url));
const START='/* ZGG_CATALOG_START */',END='/* ZGG_CATALOG_END */';
const hash=text=>createHash('sha256').update(text).digest('hex');
async function atomic(file,text){const tmp=file+'.'+randomUUID()+'.tmp';try{await writeFile(tmp,text,{mode:0o600});await rename(tmp,file)}finally{await unlink(tmp).catch(()=>{})}}
async function json(file){try{return JSON.parse(await readFile(file,'utf8'))}catch{return null}}
export async function localPage({skillRoot=ROOT,cacheDir,catalog}={}){
 try{
  const config=await json(path.join(skillRoot,'references/website.json'));
  if(config?.schema_version!==1||config.mode!=='local'||typeof config.entry!=='string'||path.isAbsolute(config.entry)||config.entry.split(/[\\/]/).some(p=>p==='..'||!p))return null;
  const root=await realpath(skillRoot),bundled=await realpath(path.join(root,config.entry));
  if(!bundled.startsWith(root+path.sep)||path.extname(bundled)!=='.html')return null;
  const template=await readFile(bundled,'utf8');
  const start=template.indexOf(START),end=template.indexOf(END,start+START.length);
  if(start<0||end<0||!catalog)return {path:bundled,catalog_current:false,refreshed:false};
  const data=JSON.stringify(catalog).replace(/</g,'\\u003c');
  const content=template.slice(0,start+START.length)+data+template.slice(end);
  const folder=path.join(cacheDir,'web'),page=path.join(folder,'index.html');
  try{if(hash(await readFile(page))===hash(content))return {path:page,catalog_current:true,refreshed:false}}catch{}
  try{
   await mkdir(folder,{recursive:true,mode:0o700});await atomic(page,content);
   return {path:page,catalog_current:true,refreshed:true};
  }catch{return {path:bundled,catalog_current:false,refreshed:false}}
 }catch{return null}
}
export async function websiteWelcome({skillRoot=ROOT,cacheDir=process.env.ZGG_SKILLS_CACHE_DIR||path.join(homedir(),'.cache','zgg-find-ecommerce-skills'),catalog,agent='codex',force=false,silent=false,now=Date.now()}={}){
 const page=await localPage({skillRoot,cacheDir,catalog});
 if(!page)return {available:false,show:false,message:null,url:null,path:null};
 const url=pathToFileURL(page.path).href,target=agent==='codex'?'<'+page.path+'>':url;
 const message=`欢迎使用张滚滚的电商技能库！\n\n你可以直接告诉我需求，也可以打开本地可视化网页，按平台和用途挑选技能。\n\n这个技能库会定期更新，持续收录全球最新的电商 Skill。\n\n[打开电商技能库 ↗](${target})`;
 // Intro identity belongs to this installation, not to each directory snapshot or code version.
 const key=hash(path.resolve(skillRoot)).slice(0,16),marker=path.join(cacheDir,'welcome-seen-'+key+'.json');
 let first=true,remembered=false,handle,cacheReady=true;
 try{await mkdir(cacheDir,{recursive:true,mode:0o700})}catch{cacheReady=false}
 try{
  if(!cacheReady)throw Error('Cache unavailable');
  handle=await open(marker,'wx',0o600);remembered=true;
  await handle.writeFile(JSON.stringify({schema_version:1,shown_at:new Date(now).toISOString()}));
 }catch(e){if(e.code==='EEXIST'){first=false;remembered=true}}
 finally{await handle?.close().catch(()=>{})}
 return {available:true,show:!silent&&(force||first),message,url,path:page.path,remembered,page_refreshed:page.refreshed,catalog_current:page.catalog_current,...(!page.catalog_current?{note:'当前显示安装包内的网页目录；本地缓存可写时会同步最新搜索目录。'}:{})};
}
