import {readFile,mkdir,writeFile,rename,open,unlink,stat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('..',import.meta.url));
const ORIGIN='https://raw.githubusercontent.com/zarockfat/zgg-find-ecommerce-skills/main/';
const DAY=24*60*60*1000,MAX_CATALOG=10*1024*1024;
const digest=text=>createHash('sha256').update(text).digest('hex');
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value).toISOString().slice(0,10)===value;
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const required=(condition,message)=>{if(!condition)throw Error(message)};
export function validateCatalog(c){
 required(c?.version===1&&date(c.updated_at)&&typeof c.coverage==='string'&&Array.isArray(c.skills)&&c.skills.length>0&&c.skills.length<=20000,'Invalid catalog');
 const ids=new Set();
 for(const s of c.skills){
  for(const k of ['id','name','title','summary','author','category','capability','repo','source_commit','source_url','checked_at','license','limitations','compatibility','cost','path'])required(typeof s?.[k]==='string'&&s[k].length>0&&s[k].length<20000,'Invalid skill field');
  required(!ids.has(s.id)&&/^[a-z0-9-]+$/.test(s.name)&&/^[\w.-]+\/[\w.-]+$/.test(s.repo)&&/^[a-f0-9]{40}$/.test(s.source_commit)&&date(s.checked_at)&&s.tested===false,'Invalid skill identity');
  required(!s.path.startsWith('/')&&!s.path.includes('\\')&&!s.path.split('/').includes('..'),'Invalid skill path');
  const url=new URL(s.source_url);required(url.protocol==='https:'&&url.hostname==='github.com'&&!url.username&&!url.password&&url.pathname.includes(s.source_commit),'Invalid source URL');
  for(const k of ['platforms','tags','requirements'])required(Array.isArray(s[k])&&s[k].length<=100&&s[k].every(v=>typeof v==='string'&&v.length<2000),'Invalid skill list');
  required(s.platforms.length>0,'Missing platform');ids.add(s.id);
 }
 return c;
}
export function validateRelease(r){
 required(r?.schema_version===1&&r.skill==='zgg-find-ecommerce-skills'&&typeof r.skill_version==='string'&&/^\d+\.\d+\.\d+$/.test(r.skill_version)&&hash(r.skill_sha256),'Invalid release');
 required(r.catalog?.schema_version===1&&date(r.catalog.updated_at)&&hash(r.catalog.sha256)&&Number.isInteger(r.catalog.bytes)&&r.catalog.bytes>0&&r.catalog.bytes<=MAX_CATALOG&&Number.isInteger(r.catalog.count)&&r.catalog.count>0&&r.catalog.count<=20000,'Invalid catalog release');
 return r;
}
function validateSnapshot(text,release){
 required(Buffer.byteLength(text)===release.catalog.bytes&&digest(text)===release.catalog.sha256,'Catalog integrity check failed');
 const c=validateCatalog(JSON.parse(text));required(c.updated_at===release.catalog.updated_at&&c.skills.length===release.catalog.count,'Catalog metadata mismatch');return c;
}
function versionCompare(a,b){const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return Math.sign(x[i]-y[i]);return 0}
async function readJSON(file){try{return JSON.parse(await readFile(file,'utf8'))}catch{return null}}
async function fetchText(fetcher,url,maxBytes,signal){
 const r=await fetcher(url,{signal,redirect:'error',headers:{'Accept':'application/json','User-Agent':'zgg-find-ecommerce-skills'}});
 required(r.ok,'Update request failed');
 const size=Number(r.headers.get('content-length'));required(!size||size<=maxBytes,'Update response too large');
 const reader=r.body?.getReader();required(reader,'Missing update response');let bytes=0;const chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;required(bytes<=maxBytes,'Update response too large');chunks.push(Buffer.from(value))}}
 catch(e){await reader.cancel().catch(()=>{});throw e}finally{reader.releaseLock()}
 return Buffer.concat(chunks).toString('utf8');
}
async function persist(file,state){const tmp=file+'.'+randomUUID()+'.tmp';try{await writeFile(tmp,JSON.stringify(state),{mode:0o600});await rename(tmp,file)}finally{await unlink(tmp).catch(()=>{})}}
function report(status,local,state,source,message){
 const remote=state?.release;const newer=remote&&versionCompare(remote.skill_version,local.skill_version)>=0&&remote.skill_sha256!==local.skill_sha256;
 return {status,catalog_source:source,catalog_updated:false,checked_at:state&&!state.failed?new Date(state.attempt_at).toISOString():null,last_attempt_at:state?.attempt_at?new Date(state.attempt_at).toISOString():null,message,
  skill_update:{available:Boolean(newer),installed_version:local.skill_version,latest_version:remote?.skill_version||null,...(newer?{message:'导航有功能更新，回复“更新”即可查看并执行适合当前 AI 工具的更新步骤。',repository:'https://github.com/zarockfat/zgg-find-ecommerce-skills'}:{})}};
}
export async function loadCatalog({skillRoot=ROOT,cacheDir=process.env.ZGG_SKILLS_CACHE_DIR||path.join(homedir(),'.cache','zgg-find-ecommerce-skills'),offline=process.env.ZGG_SKILLS_OFFLINE==='1',force=false,fetcher=fetch,now=Date.now(),timeoutMs=2500}={}){
 const text=await readFile(path.join(skillRoot,'references/catalog.json'),'utf8');
 const local=validateRelease(JSON.parse(await readFile(path.join(skillRoot,'references/release.json'),'utf8')));
 let catalog=validateSnapshot(text,local),activeText=text,source='bundled';
 const stateFile=path.join(cacheDir,'updates.json'),lockFile=path.join(cacheDir,'check.lock');
 let state=await readJSON(stateFile);
 if(!Number.isSafeInteger(state?.attempt_at)||state.attempt_at<0||state.attempt_at>now)state=null;
 // A newly installed package gets a fresh baseline; its bundled data takes precedence over an older cache.
 const sameBaseline=state?.baseline_skill===local.skill_sha256&&state?.baseline_catalog===local.catalog.sha256;
 if(sameBaseline){
  try{validateRelease(state.release);const cached=validateSnapshot(state.catalog_text,state.release);required(cached.updated_at>=catalog.updated_at,'Old cache');catalog=cached;activeText=state.catalog_text;source='cache'}catch{state=null}
 }else state=null;
 if(offline)return {catalog,update:report('offline',local,state,source,'当前使用已有目录，未联网检查。')};
 const elapsed=now-state?.attempt_at;
 if(!force&&Number.isFinite(elapsed)&&elapsed>=0&&elapsed<DAY)return {catalog,update:report(state.failed?'failed_cached':'cached',local,state,source,state.failed?'今天暂未能检查更新，先使用已有目录。':'今天已检查，无需再次联网。')};
 let lock;
 try{await mkdir(cacheDir,{recursive:true,mode:0o700})}catch{return {catalog,update:report('cache_unavailable',local,state,source,'更新缓存暂不可写，先使用已有目录。')}}
 try{
  try{const info=await stat(lockFile);if(now-info.mtimeMs>30000)await unlink(lockFile)}catch{}
  lock=await open(lockFile,'wx',0o600);
 }catch(e){return {catalog,update:report(e.code==='EEXIST'?'checking_elsewhere':'cache_unavailable',local,state,source,e.code==='EEXIST'?'另一个任务正在检查更新，先使用已有目录。':'更新缓存暂不可写，先使用已有目录。')}}
 let next={baseline_skill:local.skill_sha256,baseline_catalog:local.catalog.sha256,attempt_at:now,release:state?.release||local,catalog_text:activeText,failed:false};
 try{
  const signal=AbortSignal.timeout(timeoutMs);
  const remote=validateRelease(JSON.parse(await fetchText(fetcher,ORIGIN+'data/updates.json',64000,signal)));
  required(remote.catalog.updated_at>=catalog.updated_at,'Catalog rollback rejected');
  let downloaded=activeText;
  if(remote.catalog.sha256!==digest(activeText))downloaded=await fetchText(fetcher,ORIGIN+'data/catalog.json',MAX_CATALOG,signal);
  const updated=validateSnapshot(downloaded,remote);const changed=digest(downloaded)!==digest(activeText);
  next={...next,release:remote,catalog_text:downloaded};await persist(stateFile,next);
  const result=report('checked',local,next,changed?'cache':source,changed?'电商技能目录已同步到最新版本。':'电商技能目录已是最新版本。');
  result.catalog_updated=changed;result.previous_count=catalog.skills.length;result.current_count=updated.skills.length;
  const oldIds=new Set(catalog.skills.map(s=>s.id)),newIds=new Set(updated.skills.map(s=>s.id));result.added_count=updated.skills.filter(s=>!oldIds.has(s.id)).length;result.removed_count=catalog.skills.filter(s=>!newIds.has(s.id)).length;return {catalog:updated,update:result};
 }catch{
  next.failed=true;await persist(stateFile,next).catch(()=>{});
  return {catalog,update:report('failed',local,next,source,'暂未能检查更新，先使用已有目录；一天后自动重试，也可手动检查。')};
 }finally{await lock.close().catch(()=>{});await unlink(lockFile).catch(()=>{})}
}
