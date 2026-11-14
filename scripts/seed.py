import json, urllib.request, concurrent.futures, pathlib, hashlib, re
from datetime import datetime
from zoneinfo import ZoneInfo
CHECKED_AT=datetime.now(ZoneInfo("Asia/Shanghai")).date().isoformat()
ROOT=pathlib.Path(__file__).resolve().parents[1]
rows='''tiktok-shop-product-research|TikTok 爆品选品|TikTok Shop|选品调研|从需求、竞争与内容潜力梳理选品方向。
tiktok-shop-listing-optimization|TikTok 商品页优化|TikTok Shop|Listing 优化|整理商品标题、卖点和详情页的优化思路。
tiktok-shop-content-strategy|TikTok 内容策略|TikTok Shop|内容创作|围绕商品卖点规划短视频选题与内容节奏。
tiktok-influencer-marketing|TikTok 达人合作|TikTok Shop|达人营销|规划达人筛选、合作方式与效果评估。
tiktok-shop-ads|TikTok 广告策略|TikTok Shop|广告投放|梳理商品广告结构、创意与优化方向。
tiktok-shop-analytics|TikTok 经营分析|TikTok Shop|经营分析|根据经营指标寻找转化和增长机会。
tiktok-shop-inventory|TikTok 库存管理|TikTok Shop|库存履约|梳理库存计划与补货决策。
tiktok-shop-customer-service|TikTok 客服指南|TikTok Shop|客户服务|设计买家咨询与售后处理流程。
product-differentiation/product-differentiation-amazon|Amazon 产品差异化|Amazon|选品调研|从竞品与用户需求提炼产品差异化方向。
profit-margin-calculator/profit-margin-calculator-amazon|Amazon 利润测算|Amazon|经营分析|基于你提供的售价与成本拆解利润结构。
supply-chain-optimization/supply-chain-optimization-amazon|Amazon 供应链优化|Amazon|库存履约|梳理备货、供应链效率和库存安排。
review-checker/amazon-review-checker|Amazon 评论分析|Amazon|选品调研|检查评论信息，辅助理解用户反馈。
shopify-store-setup|Shopify 建店指南|Shopify|独立站建设|梳理独立站从准备到上线的基本流程。
shopify-seo|Shopify SEO 优化|Shopify|Listing 优化|规划独立站的页面结构与搜索优化。
shopify-email-flows|Shopify 邮件流程|Shopify|客户服务|设计欢迎、购物车召回与复购邮件流程。
shopify-conversion-optimization|Shopify 转化优化|Shopify|独立站建设|从商品页到结账流程寻找转化阻力。
shopify-product-photography-guide|Shopify 商品摄影指南|Shopify|图片设计|规划拍摄角度、场景与商品图片表达。
shopify-analytics-guide|Shopify 数据分析|Shopify|经营分析|梳理店铺核心指标与分析方法。
ecommerce-competitor-analysis|电商竞品分析|通用|选品调研|结构化比较竞品的定位、商品与营销表现。
product-description-generator|商品描述写作|通用|Listing 优化|根据商品资料组织清晰、有说服力的描述。
product-title-optimization|商品标题优化|通用|Listing 优化|优化标题结构、关键词和可读性。
ecommerce-video-marketing|电商视频营销|通用|内容创作|规划商品视频内容与营销使用场景。
influencer-outreach|达人邀约策略|通用|达人营销|设计达人触达、邀约文案与跟进节奏。
ecommerce-ppc-strategy-planner|电商 PPC 策略|通用|广告投放|整理付费广告目标、预算与投放思路。
customer-feedback-analysis|客户反馈分析|通用|客户服务|从用户反馈中归纳问题与改进机会。
warehouse-optimization|仓储流程优化|通用|库存履约|分析仓储作业与履约效率的改进空间。
ebay-product-research|eBay 选品研究|eBay|选品调研|梳理 eBay 的商品机会与市场竞争。
etsy-product-description|Etsy 商品描述|Etsy|Listing 优化|围绕商品特色与买家需求组织描述。
walmart-listing-optimization|Walmart Listing 优化|Walmart|Listing 优化|规划沃尔玛商品页信息与优化方向。
woocommerce-seo|WooCommerce SEO|WooCommerce|独立站建设|梳理 WooCommerce 商店搜索优化。'''
seeds=[]
for row in rows.splitlines():
 p,title,platform,category,summary=row.split('|'); seeds.append(dict(repo='nexscope-ai/eCommerce-Skills',path=p+'/SKILL.md',title=title,platforms=[platform],category=category,summary=summary))
more=[('seo-audit','SEO 诊断','Listing 优化','诊断网站搜索表现与页面 SEO 问题。'),('copywriting','营销文案写作','内容创作','围绕用户需求与产品价值撰写营销文案。'),('paid-ads','付费广告规划','广告投放','梳理广告策略、受众与创意方向。'),('email-sequence','营销邮件序列','客户服务','设计邮件触达节奏与转化文案。'),('social-content','社交内容规划','内容创作','规划社交媒体选题、内容形式与发布节奏。'),('page-cro','落地页转化优化','独立站建设','分析落地页信息与转化路径。')]
for p,title,cat,summary in more: seeds.append(dict(repo='coreyhaines31/marketingskills',path='skills/'+p+'/SKILL.md',title=title,platforms=['通用'],category=cat,summary=summary))
(ROOT/'data/seeds.json').write_text(json.dumps(seeds,ensure_ascii=False,indent=2)+'\n')
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'CommerceSkillsHub/0.1','Accept':'application/vnd.github+json'})
 with urllib.request.urlopen(req,timeout=35) as r:return r.read()
def repo_info(repo):
 d=json.loads(get('https://api.github.com/repos/'+repo));t=json.loads(get('https://api.github.com/repos/'+repo+'/git/trees/'+d['default_branch']+'?recursive=1'))
 return repo,dict(commit=t['sha'],license=(d.get('license') or {}).get('spdx_id','UNKNOWN'),paths={x['path']:x['sha'] for x in t['tree'] if x['type']=='blob'})
meta=dict(repo_info(repo) for repo in sorted(set(s['repo'] for s in seeds)))
# Keep exact source evidence outside distributable assets; indexed metadata remains public.
cache=ROOT/'.cache/sources';cache.mkdir(parents=True,exist_ok=True)
def fetch(s):
 m=meta[s['repo']]
 if s['path'] not in m['paths']:
  print('Excluded missing path: '+s['path'])
  return None
 raw=get('https://raw.githubusercontent.com/'+s['repo']+'/'+m['commit']+'/'+s['path']).decode()
 frontmatter=raw.split('---',2)[1] if raw.startswith('---\n') and len(raw.split('---',2))==3 else ''
 match=re.search(r'^name:\s*[\'"]?([a-z0-9-]+)',frontmatter,re.M)
 if not match:
  print('Excluded nonstandard guide: '+s['path'])
  return None
 name=match.group(1);slug=s['repo'].split('/')[0]+'--'+name
 (cache/(slug+'.md')).write_text(raw)
 return dict(s,id=slug,name=name,author=s['repo'].split('/')[0],license=m['license'],source_url='https://github.com/'+s['repo']+'/blob/'+m['commit']+'/'+s['path'],repo_url='https://github.com/'+s['repo'],source_commit=m['commit'],content_sha256=hashlib.sha256(raw.encode()).hexdigest(),checked_at=CHECKED_AT,verification='source-checked',tested=False,capability='方法指导',cost='模型及外部服务费用另计',requirements=['支持 SKILL.md 的 AI 客户端','按任务提供商品、市场或店铺资料'],compatibility='通用格式；未逐客户端实测',limitations='未进行安装和业务效果实测；实时数据与外部操作能力需按原文及所连接工具核实。',tags=[s['category'],*s['platforms']],featured=name in ['tiktok-shop-product-research','ecommerce-competitor-analysis','product-description-generator','shopify-conversion-optimization','paid-ads','product-differentiation-amazon'])
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: skills=list(pool.map(fetch,seeds))
skills=[s for s in skills if s is not None]
output=dict(version=1,updated_at=CHECKED_AT,coverage='人工选定的公开 GitHub 仓库；并非全网完整收录',skills=skills)
(ROOT/'data/catalog.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'skills':len(skills),'repositories':len(meta),'source_checked':len(skills),'business_tested':0}))
