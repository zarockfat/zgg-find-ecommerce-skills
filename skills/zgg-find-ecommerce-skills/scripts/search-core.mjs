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
// Client support checked against official documentation on 2026-11-15.
const installerDocs='https://github.com/vercel-labs/skills/blob/main/docs/agents.md';
export const installationClients=[
 {id:'codex',label:'Codex',mode:'command'},
 {id:'claude-code',label:'Claude Code',mode:'command'},
 {id:'cursor',label:'Cursor',mode:'command'},
 {id:'workbuddy',label:'WorkBuddy',mode:'import',docs:'https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market'},
 {id:'doubao',label:'豆包 / 豆包工作',mode:'conditional',docs:'https://open.doubao.com/document/doubao-developer-guide/skill-integration-guide'},
 {id:'trae-cn',label:'TRAE 国内版',mode:'command'},
 {id:'trae',label:'TRAE 国际版',mode:'command'},
 {id:'codebuddy',label:'CodeBuddy',mode:'command'},
 {id:'kimi-code-cli',label:'Kimi Code CLI',mode:'command'},
 {id:'qwen-code',label:'Qwen Code',mode:'command'},
 {id:'openclaw',label:'OpenClaw',mode:'command'},
 {id:'other',label:'其他 Agent',mode:'interactive'}
];
function installationTarget(s){
 if(!/^[\w.-]+\/[\w.-]+$/.test(s.repo)||!s.name||!/^[a-z0-9-]+$/.test(s.name))throw new Error('Invalid install target');
 return `npx skills add ${s.repo} --skill ${s.name}`;
}
export function installationCommand(s,agent='codex'){
 const base=installationTarget(s);const client=installationClients.find(c=>c.id===agent);
 if(!client||!['command','interactive'].includes(client.mode))throw new Error('This client requires installation guidance, not a CLI command');
 return client.mode==='interactive'?base:`${base} -a ${agent}`;
}
export function installationGuide(s,agent='codex'){
 installationTarget(s);const client=installationClients.find(c=>c.id===agent);if(!client)throw new Error('Unknown client');
 const packet=`下载仓库 ZIP，解压后找到 ${s.path||s.name+'/SKILL.md'} 所在的技能文件夹。保留 SKILL.md、脚本、参考资料等配套文件，将这个技能文件夹单独打包成 ZIP。`;
 let steps=[],note='',command=null;
 if(client.mode==='command'){
  command=installationCommand(s,agent);steps=['在项目目录打开终端，执行下面的安装命令。','重新加载 AI 工具，确认已安装列表中能找到这个技能，再描述你的任务。'];
  note='需要 Node.js 22.20+ 及网络；命令安装到当前项目。安装后仍需准备该技能要求的账号、接口或软件。安装器支持此客户端不代表本站已实测业务效果。';
 }else if(agent==='workbuddy'){
  steps=[packet,'打开 WorkBuddy 的“专家·技能·连接器”，进入“技能”，选择“添加技能 → 上传技能”，导入刚打包的 ZIP。','在“已安装”中确认技能已启用，然后在对话里点名使用它。'];
  note='本目录中的技能不一定已上架 WorkBuddy 技能市场。通过聊天搜索市场，并不能保证找到这里的每个技能；此处使用本地技能包导入。WorkBuddy 与 CodeBuddy 使用各自的安装方式。';
 }else if(agent==='doubao'){
  steps=['先确认你使用的豆包产品与版本，是否有“技能管理”以及上传、导入或新建技能的入口。',packet,'有本地导入入口时，按界面要求导入完整技能包，并检查脚本及外部工具依赖能否运行。没有该入口时，先在网页选好技能；方法指导类可阅读其 SKILL.md，将相关工作步骤作为聊天资料使用。'];
  note='导入入口和执行能力以你的客户端为准，本站尚未验证豆包的本地导入。豆包应用插件有单独的接入流程，不等于普通聊天能执行 npx 或运行本地脚本。粘贴说明仅供参考，不等于安装，也不会自动获得接口或店铺能力。';
 }else{
  command=installationCommand(s,agent);steps=['如果你的 Agent 支持本地 Skill 且能使用终端，执行下面的命令，再从安装器显示的列表选择你的 Agent。','若安装器没有列出它，先查看该 Agent 的官方导入说明，使用完整技能文件夹或 ZIP 导入；不要猜安装目录。','只有普通聊天入口时，可以阅读方法类技能作为资料；需要脚本、接口或连接器的功能还需对应的执行环境。'];
  note='此命令会让你选择客户端。只有安装器列出的客户端才能使用这条安装路径；支持同一模型不等于支持同一技能安装方式。';
 }
 return {client:client.id,label:client.label,mode:client.mode,command,steps,note,docs:client.docs||installerDocs,checked_at:'2026-11-15',tested:false};
}
