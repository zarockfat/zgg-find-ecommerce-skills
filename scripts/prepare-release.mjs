import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function prepareRelease(root){
 const skill=path.join(root,'skills/zgg-find-ecommerce-skills');
 const version=JSON.parse(await readFile(path.join(skill,'version.json'),'utf8')).version;
 const fingerprint=createHash('sha256');
 for(const name of ['SKILL.md','version.json','scripts/search.mjs','scripts/search-core.mjs','scripts/updates.mjs','scripts/welcome.mjs','references/website.json','assets/ecommerce-skills.html']){
  let bytes=await readFile(path.join(skill,name));
  if(name==='assets/ecommerce-skills.html')bytes=Buffer.from(bytes.toString('utf8').replace(/\/\* ZGG_CATALOG_START \*\/[\s\S]*?\/\* ZGG_CATALOG_END \*\//,'/* ZGG_CATALOG_START */null/* ZGG_CATALOG_END */'));
  fingerprint.update(name+'\0'+bytes.length+'\0').update(bytes);
 }
 const bytes=await readFile(path.join(root,'data/catalog.json')),catalog=JSON.parse(bytes);
 const release={schema_version:1,skill:'zgg-find-ecommerce-skills',skill_version:version,skill_sha256:fingerprint.digest('hex'),catalog:{schema_version:catalog.version,updated_at:catalog.updated_at,count:catalog.skills.length,bytes:bytes.length,sha256:hash(bytes)}};
 const text=JSON.stringify(release,null,2)+'\n';
 await writeFile(path.join(root,'data/updates.json'),text);await writeFile(path.join(skill,'references/release.json'),text);
 return release;
}
