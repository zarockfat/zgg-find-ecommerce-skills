"""Inspect public repository snapshots without executing or installing their content.
Uses public Git HEAD + commit-pinned archives to avoid GitHub API quota dependency.
"""
import json,pathlib,urllib.request,concurrent.futures,subprocess,os,io,tarfile,hashlib,re,argparse
from datetime import datetime
from zoneinfo import ZoneInfo
ROOT=pathlib.Path(__file__).resolve().parents[1]
NOW=datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(timespec='seconds')
CONFIG=json.loads((ROOT/'data/sources.json').read_text())
CACHE=ROOT/'.cache/repository-snapshots';CACHE.mkdir(parents=True,exist_ok=True)
def license_id(text):
 t=text.lower()
 if 'permission is hereby granted, free of charge' in t and 'the software is provided' in t:return 'MIT'
 if 'apache license' in t and 'version 2.0' in t:return 'Apache-2.0'
 if 'gnu affero general public license' in t:return 'AGPL-3.0'
 if 'gnu general public license' in t and 'version 3' in t:return 'GPL-3.0'
 if 'redistribution and use in source and binary forms' in t and 'neither the name' in t:return 'BSD-3-Clause'
 return 'UNKNOWN'
def scan(repo):
 r={'requested_repo':repo,'repo':repo,'repo_url':'https://github.com/'+repo,'checked_at':NOW,'status':'failed','transport':'public-git-and-commit-archive'}
 try:
  if not re.fullmatch(r'[\w.-]+/[\w.-]+',repo):raise ValueError('invalid repository')
  head=subprocess.run(['git','ls-remote','https://github.com/'+repo+'.git','HEAD'],capture_output=True,text=True,timeout=45,env={**os.environ,'GIT_TERMINAL_PROMPT':'0'})
  if head.returncode:raise ValueError('Public Git HEAD unavailable')
  commit=head.stdout.split()[0]
  if not re.fullmatch(r'[a-f0-9]{40}',commit):raise ValueError('Invalid Git HEAD')
  dest=CACHE/repo.replace('/','--')/commit;dest.mkdir(parents=True,exist_ok=True)
  saved=dest/'metadata.json'
  if saved.exists():
   cached=json.loads(saved.read_text());cached['checked_at']=NOW;print(repo+': cached '+str(cached['candidate_count']),flush=True);return cached
  req=urllib.request.Request('https://codeload.github.com/'+repo+'/tar.gz/'+commit,headers={'User-Agent':'CommerceSkillsHub-source-audit'})
  with urllib.request.urlopen(req,timeout=60) as response:
   content=response.read(40*1024*1024+1)
  if len(content)>40*1024*1024:raise ValueError('Archive exceeds 40 MiB limit')
  candidates=[];licenses={};readmes={}
  with tarfile.open(fileobj=io.BytesIO(content),mode='r:gz') as archive:
   members=archive.getmembers()
   if sum(m.size for m in members)>250*1024*1024:raise ValueError('Unpacked size exceeds limit')
   for m in members:
    if not m.isfile() or m.size>700000:continue
    parts=pathlib.PurePosixPath(m.name).parts[1:]
    if not parts or '..' in parts:continue
    path='/'.join(parts);base=parts[-1]
    if base.lower()=='skill.md' or base.upper() in ['LICENSE','LICENSE.MD','LICENSE.TXT','COPYING'] or (len(parts)==1 and base.upper().startswith('README')):
     text=archive.extractfile(m).read().decode('utf8',errors='replace')
     local=dest/path;local.parent.mkdir(parents=True,exist_ok=True);local.write_text(text)
     if base.lower()=='skill.md':candidates.append({'repo':repo,'path':path,'source_commit':commit,'content_sha256':hashlib.sha256(text.encode()).hexdigest(),'source_url':'https://github.com/'+repo+'/blob/'+commit+'/'+path,'status':'pending-review'})
     elif base.upper().startswith('README'):readmes[path]=True
     else:licenses[path]=license_id(text)
  root_license=next((v for k,v in licenses.items() if '/' not in k),'UNKNOWN')
  r.update(status='scanned',source_commit=commit,license=root_license,licenses=licenses,candidate_count=len(candidates),candidates=candidates)
  saved.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
 except Exception as e:r['error']=str(e)
 print(repo+': '+r['status']+' '+str(r.get('candidate_count',0)),flush=True)
 return r
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--new-only',action='store_true',help='Scan new repositories; retain existing records and their original checked_at');args=parser.parse_args()
 previous={}
 if args.new_only and (ROOT/'data/collection-report.json').exists():
  previous={r['repo']:r for r in json.loads((ROOT/'data/collection-report.json').read_text())['repositories']}
 pending=[repo for repo in CONFIG['repositories'] if repo not in previous]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:fresh=list(pool.map(scan,pending))
 merged={**previous,**{r['repo']:r for r in fresh}}
 results=[merged[repo] for repo in CONFIG['repositories']]
 report={'version':1,'collected_at':NOW,'method':'公开网页检索发现来源；Git HEAD 与固定提交归档扫描；仅读取 SKILL.md、README 与许可证，不执行第三方代码。','queries':CONFIG['queries'],'scope_complete':False,'limitations':['仅覆盖本轮查询定位的公开仓库，不代表全网','扫描和许可识别不表示安装或业务已测试','候选需审核后才能加入发布目录；未识别许可保留待核实','GitHub 匿名 API 限流，改用公开 Git 与提交归档；单仓库压缩文件上限 40 MiB'],'repositories':results}
 report['incremental']=bool(args.new_only);report['newly_scanned_repositories']=pending
 (ROOT/'data/collection-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'repositories':len(results),'scanned':sum(r['status']=='scanned' for r in results),'candidates':sum(r.get('candidate_count',0) for r in results)},ensure_ascii=False))
