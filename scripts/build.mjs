import {mkdir,cp,writeFile,readFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {prepareRelease} from './prepare-release.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));process.chdir(root);
await mkdir('skills/zgg-find-ecommerce-skills/references',{recursive:true});await cp('data/catalog.json','skills/zgg-find-ecommerce-skills/references/catalog.json');await cp('src/search.mjs','skills/zgg-find-ecommerce-skills/scripts/search-core.mjs');
await mkdir('dist/downloads',{recursive:true});await cp('src','dist',{recursive:true});await mkdir('dist/data',{recursive:true});await cp('data/catalog.json','dist/data/catalog.json');await cp('data/review-summary.json','dist/data/review-summary.json');
await writeFile('dist/llms.txt','# 电商技能库 · 电商 Skill 导航\n\n机器可读目录：/data/catalog.json\n导航技能下载：/downloads/zgg-find-ecommerce-skills.zip\n来源已核对不表示业务已实测。目录是精选快照，并非全网索引。\n');
const d=JSON.parse(await readFile('data/catalog.json','utf8'));
// A portable, offline preview with the same code and catalog. Downloads remain relative.
let html=await readFile('src/index.html','utf8');
const authorPhoto=await readFile('src/assets/author/zhang-gungun.jpg');
html=html.replaceAll('./assets/author/zhang-gungun.jpg','data:image/jpeg;base64,'+authorPhoto.toString('base64'));
const favicon=await readFile('src/favicon.svg');
html=html.replace('href="./favicon.svg"','href="data:image/svg+xml;base64,'+favicon.toString('base64')+'"');
const css=(await readFile('src/style.css','utf8')).replace(/^@import[ \t]+url\([^\r\n]*\);[ \t]*(?:\r?\n|$)/gm,'');
const core=(await readFile('src/search.mjs','utf8')).replace(/^export /gm,'');
let brandIcons=(await readFile('src/platform-icons.mjs','utf8')).replace(/^export /gm,'');
for(const asset of JSON.parse(await readFile('src/assets/platforms/sources.json','utf8'))){
 const bytes=await readFile('src/assets/platforms/'+asset.file);
 brandIcons=brandIcons.replace('./assets/platforms/'+asset.file,'data:'+asset.mime+';base64,'+bytes.toString('base64'));
}
const app=(await readFile('src/app.mjs','utf8')).replace(/^import[^\n]+\n/gm,'').replace("const response=await fetch('./data/catalog.json');if(!response.ok)throw Error('目录请求失败');catalog=await response.json();",'catalog=/* ZGG_CATALOG_START */'+JSON.stringify(d).replace(/</g,'\\u003c')+'/* ZGG_CATALOG_END */;');
const portable=html.replace('<link rel="stylesheet" href="./style.css">',()=>'<style>'+css+'</style>').replace('<script type="module" src="./app.mjs"></script>','').replace('</body>',()=>'<script type="module">'+core+'\n'+brandIcons+'\n'+app+'</script></body>');
await writeFile('dist/preview.html',portable);
// The installable Skill carries one complete HTML file; avoid recursive ZIP downloads.
const localHTML=portable.replaceAll('href="./downloads/zgg-find-ecommerce-skills.zip" download','href="https://github.com/zarockfat/zgg-find-ecommerce-skills/tree/main/skills/zgg-find-ecommerce-skills" target="_blank" rel="noopener noreferrer"').replaceAll('下载导航 Skill ZIP ↓','查看导航安装文件 ↗').replaceAll('点击下方“下载导航 Skill ZIP”，取得完整技能包，无需下载整个仓库。','从下方导航仓库取得完整技能文件夹，再按当前 AI 工具的方式导入。').replaceAll('href="./downloads/ecommerce-skills-hub-source.zip" download','href="https://github.com/zarockfat/zgg-find-ecommerce-skills" target="_blank" rel="noopener noreferrer"').replaceAll('下载完整项目源码 ↓','查看完整项目源码 ↗');
await mkdir('skills/zgg-find-ecommerce-skills/assets',{recursive:true});
await writeFile('skills/zgg-find-ecommerce-skills/assets/ecommerce-skills.html',localHTML);
await prepareRelease(root);
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
console.log(`Built static site, ${d.skills.length} catalog entries, navigation skill ZIP and source ZIP.`);
