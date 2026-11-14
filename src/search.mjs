export const aliases = {
 '找货采购':['货源','采购','找货','工厂','供应商','sourcing'],
 '合规检查':['政策','合规','policy'],
 '选品调研':['选品','竞品','爆品','市场','research','competitor','review','评论'],
 'Listing 优化':['listing','标题','描述','关键词','seo','商品页'],
 '内容创作':['视频','短视频','文案','内容','脚本','video','copywriting','social'],
 '图片设计':['图片','摄影','主图','拍摄','photo','image'],
 '达人营销':['达人','网红','邀约','influencer','creator'],
 '广告投放':['广告','投放','ppc','ads'],
 '独立站建设':['建站','建店','转化','落地页','独立站','cro','store'],
 '客户服务':['客服','售后','邮件','反馈','客户','email'],
 '库存履约':['库存','仓储','物流','供应链','补货','inventory','warehouse'],
 '经营分析':['利润','数据','经营','分析报表','profit','analytics']
};
const platforms={Amazon:['amazon','亚马逊'], 'TikTok Shop':['tiktok','tk'],Shopify:['shopify'],eBay:['ebay'],Etsy:['etsy'],Walmart:['walmart','沃尔玛'],WooCommerce:['woocommerce'],SHOPLINE:['shopline'],PrestaShop:['prestashop'],Magento:['magento','mage-os','hyvä','hyva'],Temu:['temu'],拼多多:['拼多多','pinduoduo','pdd'],Shopee:['shopee','虾皮'],'1688':['1688'],淘宝:['淘宝','天猫'],Lazada:['lazada','来赞达'],Ozon:['ozon'],Wildberries:['wildberries','野莓'],'Mercado Libre':['mercado','美客多'],AliExpress:['aliexpress','速卖通'],京东:['京东','jd'],'抖音小店':['抖音','douyin'],'Google Shopping':['google shopping','merchant center']};
export function inferPlatforms(q){const t=q.toLowerCase();return Object.entries(platforms).filter(([,a])=>a.some(x=>t.includes(x))).map(([k])=>k)}
export function summarizePlatforms(skills){
 const counts=new Map();
 for(const skill of skills)for(const platform of new Set(skill.platforms))counts.set(platform,(counts.get(platform)||0)+1);
 return [...counts].sort(([a,ac],[b,bc])=>(a==='通用')-(b==='通用')||bc-ac||a.localeCompare(b,'zh-CN')).map(([name,count])=>({name,count}));
}
export function searchCatalog(skills,{q='',platform='全部',category='全部',capability='全部',favorites=null,sort='recommended'}={}){
 const query=q.toLowerCase().trim();const inferred=inferPlatforms(query);const cats=Object.entries(aliases).filter(([,words])=>words.some(w=>query.includes(w))).map(([k])=>k);
 let out=skills.filter(s=>(platform==='全部'||s.platforms.includes(platform))&&(category==='全部'||s.category===category)&&(capability==='全部'||s.capability===capability)&&(!favorites||favorites.has(s.id))).map(s=>{
 let score=s.featured?1:0;if(!query)return {s,score};
 const hay=[s.title,s.name,s.summary,s.author,...s.tags].join(' ').toLowerCase();
 const exact=hay.includes(query);let match=exact;
 if(cats.length){match=cats.includes(s.category);score+=match?6:0;}
 if(inferred.length){const specific=s.platforms.some(p=>inferred.includes(p));const general=s.platforms.includes('通用');match=(cats.length?match:true)&&(specific||general);score+=specific?8:0;}
 if(!cats.length&&!inferred.length&&!exact){const tokens=query.split(/\s+/).filter(Boolean);match=tokens.every(t=>hay.includes(t));}
 if(exact)score+=20;
 return {s,score,match};
 }).filter(x=>!query||x.match);
 out.sort((a,b)=>sort==='name'?a.s.title.localeCompare(b.s.title,'zh-CN'):sort==='updated'?b.s.checked_at.localeCompare(a.s.checked_at)||a.s.title.localeCompare(b.s.title,'zh-CN'):b.score-a.score||a.s.title.localeCompare(b.s.title,'zh-CN'));
 return out.map(x=>x.s);
}
export function installationCommand(s,agent='codex'){
 if(!/^[\w.-]+\/[\w.-]+$/.test(s.repo)||!s.name||!/^[a-z0-9-]+$/.test(s.name))throw new Error('Invalid install target');
 if(!['codex','claude-code','cursor'].includes(agent))throw new Error('Unknown client');
 return `npx skills add ${s.repo} --skill ${s.name} -a ${agent}`;
}
