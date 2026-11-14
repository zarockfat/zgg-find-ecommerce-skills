import {mkdir,cp,writeFile,readFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {prepareRelease} from './prepare-release.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));process.chdir(root);
await mkdir('skills/zgg-find-ecommerce-skills/references',{recursive:true});await cp('data/catalog.json','skills/zgg-find-ecommerce-skills/references/catalog.json');await cp('src/search.mjs','skills/zgg-find-ecommerce-skills/scripts/search-core.mjs');
await prepareRelease(root);
await mkdir('dist/downloads',{recursive:true});await cp('src','dist',{recursive:true});await mkdir('dist/data',{recursive:true});await cp('data/catalog.json','dist/data/catalog.json');await cp('data/review-summary.json','dist/data/review-summary.json');
await writeFile('dist/llms.txt','# 电商技能库 · 电商 Skill 导航\n\n机器可读目录：/data/catalog.json\n导航技能下载：/downloads/zgg-find-ecommerce-skills.zip\n来源已核对不表示业务已实测。目录是精选快照，并非全网索引。\n');
execFileSync('python3',['-c',`import pathlib,zipfile
r=pathlib.Path('.')
with zipfile.ZipFile('dist/downloads/zgg-find-ecommerce-skills.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted((r/'skills/zgg-find-ecommerce-skills').rglob('*')):
  if p.is_file() and '__pycache__' not in p.parts:z.write(p,p.relative_to(r/'skills'))
with zipfile.ZipFile('dist/downloads/ecommerce-skills-hub-source.zip','w',zipfile.ZIP_DEFLATED) as z:
 for base in ['src','data','scripts','skills','tests','docs','.github','README.md','CONTRIBUTING.md','LICENSE','package.json','requirements-maintenance.txt','.gitignore']:
  p=r/base
  for f in ([p] if p.is_file() else sorted(p.rglob('*'))):
   if f.is_file():z.write(f,pathlib.Path('ecommerce-skills-hub')/f)
`],{stdio:'inherit'});
const d=JSON.parse(await readFile('data/catalog.json','utf8'));
// A portable, offline preview with the same code and catalog. Downloads remain relative.
let html=await readFile('src/index.html','utf8');
const authorPhoto=await readFile('src/assets/author/zhang-gungun.jpg');
html=html.replaceAll('./assets/author/zhang-gungun.jpg','data:image/jpeg;base64,'+authorPhoto.toString('base64'));
const css=(await readFile('src/style.css','utf8')).replace(/^@import[ \t]+url\([^\r\n]*\);[ \t]*(?:\r?\n|$)/gm,'');
const core=(await readFile('src/search.mjs','utf8')).replace(/^export /gm,'');
let brandIcons=(await readFile('src/platform-icons.mjs','utf8')).replace(/^export /gm,'');
for(const asset of JSON.parse(await readFile('src/assets/platforms/sources.json','utf8'))){
 const bytes=await readFile('src/assets/platforms/'+asset.file);
 brandIcons=brandIcons.replace('./assets/platforms/'+asset.file,'data:'+asset.mime+';base64,'+bytes.toString('base64'));
}
const app=(await readFile('src/app.mjs','utf8')).replace(/^import[^\n]+\n/gm,'').replace("const response=await fetch('./data/catalog.json');if(!response.ok)throw Error('目录请求失败');catalog=await response.json();",'catalog='+JSON.stringify(d).replace(/</g,'\\u003c')+';');
await writeFile('dist/preview.html',html.replace('<link rel="stylesheet" href="./style.css">',()=>'<style>'+css+'</style>').replace('<script type="module" src="./app.mjs"></script>','').replace('</body>',()=>'<script type="module">'+core+'\n'+brandIcons+'\n'+app+'</script></body>'));
console.log(`Built static site, ${d.skills.length} catalog entries, navigation skill ZIP and source ZIP.`);
