# 开发与目录维护

[返回项目介绍](../README.md)

以下命令均在项目根目录执行。

## 本地启动

需要 Node.js 22+、Python 3.9+；不需要安装 npm 依赖。

```bash
npm run build
npm run validate
npm test
npm run dev
```

打开 http://127.0.0.1:4173 。构建后也可直接用浏览器打开 `dist/preview.html` 离线预览（同一份应用代码与内嵌目录，无需服务器）。静态产物位于 `dist/`，可以部署到任意静态托管服务。

## 已实现

- 中文关键词/场景别名搜索，平台和需求组合筛选，排序、分页。
- 本地收藏、技能详情、来源版本、按客户端生成安装指引、分享详情链接。
- 三个场景组合指南、导航 Skill ZIP、完整源码 ZIP 与开放目录 JSON。
- 投稿 JSON 生成器（本地下载，不上传）、公开仓库候选发现脚本。
- 统一目录用于网页和导航 Skill；来源核验与业务测试明确分开。

首版不是全网索引，没有自动联网的大模型搜索，没有投稿后台或账号系统。本仓库同时提供网页源码和导航 Skill；网页的项目源码入口指向本仓库，构建后也提供源码 ZIP。

## AI 入口

将 `skills/zgg-find-ecommerce-skills` 放入客户端支持的目录，重新加载后调用 `$zgg-find-ecommerce-skills`。该目录也被打包为 ZIP。

```bash
node skills/zgg-find-ecommerce-skills/scripts/search.mjs --query "TikTok 选品" --limit 3
```

它使用本地目录快照，不需要 API Key；自然语言理解由宿主 AI 完成。安装命令通过 `npx skills` 获取上游当前版本；与目录记录的核对版本可能不同。未逐客户端和业务实测。

## 数据维护

发布目录是 `data/catalog.json`。字段包括稳定 ID、原作者、仓库和路径、名称、中文用途、平台、需求、费用、依赖、来源版本、核对日期、内容哈希和测试状态。

```bash
node scripts/discover.mjs owner/repo
```

发现工具只读取公开 GitHub 元信息，输出 `data/candidates/`，不会执行候选代码或自动发布。GitHub 未认证请求可能限流，遇到错误会停止并保留现有目录。审核候选后再修改发布目录，运行校验、构建与测试。

`python3 scripts/seed.py` 是首批来源核对脚本，会联网并重新生成首批目录，不应用于覆盖已经人工扩展的目录。无有效名称或路径的候选会跳过。`.cache/` 保存核对原文，仅供本地维护，不进入网站或源码下载包。

## 品牌与发布

品牌、色彩、导航和介绍分别在 `src/index.html`、`src/style.css`、`src/app.mjs`。当前“电商技能库”是可替换工作名称；未填入虚构的个人履历、用户数、安装量或效果数据。

可通过仓库 Issue 提交收录线索或问题，通过 Pull Request 贡献目录与代码。网页可自行部署到静态托管服务。仓库的 `.github/workflows/ci.yml` 仅做提交检查，不安排定时抓取。

## 许可证与来源

本项目原创代码、中文目录描述和导航 Skill 采用 MIT。第三方 Skill 仍由各原作者按其许可证发布；本项目只索引元信息并链接来源，不把第三方正文打包分发。`tested: false` 表示没有业务实测，即使原作者声称测试过，也不会自动改为本站实测。

## 扩充与审核（2026-11-21，第四轮）

累计定位 128 个仓库，本轮复查原有 56 个并新增扫描 72 个。125 个仓库成功扫描，发现 10,570 个候选文件；候选包含大量通用工具、重复、许可待核实及格式不合要求的内容。发布目录从 161 增至 **245 个 Skill / 46 个仓库 / 28 个平台与通用场景**，新增 84 个；原有 161 个来源重新核对，16 个正文有变化。安装与业务均未实测，不代表全网覆盖。

- `data/sources.json`：公开仓库与检索词。
- `data/collection-report.json`：候选文件、固定提交、哈希和扫描失败记录。
- `data/curation.json`：人工筛选的用途、分类、费用与依赖；新增选择绑定提交与哈希。
- `data/source-update-reviews.json`：既有条目的本轮审核依据与前后版本。
- `data/license-reviews.json`：自动识别之外的许可证复核，绑定提交及证据哈希。
- `data/review-decisions.json`：人工暂缓原因。
- `data/review-summary.json`、`data/collection-summary.md`：候选处理统计与可读报告。
- `data/scan-history/`：历史统计和本轮检索线索。

维护者可复跑（仅下载公开文档，不执行第三方代码）：

```bash
python3 -m venv .venv-maintenance
.venv-maintenance/bin/pip install -r requirements-maintenance.txt
.venv-maintenance/bin/python scripts/collect.py
# 人工核对新增选择、许可证和既有来源的变更后：
.venv-maintenance/bin/python scripts/review_catalog.py
.venv-maintenance/bin/python -m unittest discover -s tests -p '*_test.py'
npm run build
npm run validate
npm test
```

仅扫描新增来源时使用 `scripts/collect.py --new-only`，其保留已有仓库的核对时间；完整复查不加此参数。扫描不会自动上架候选，也没有定时抓取或自动审核发布任务。

合并器保留稳定 ID。更新既有条目须先阅读当前文档和差异，再写入 `source-update-reviews.json` 的准确提交、内容哈希、日期及审核依据。仅匹配同一快照、名称且未与其他条目重复时才刷新；上游再变化而未经审核时保留发布版本。新增选择的提交或哈希不匹配时也不发布。

SHEIN、Wayfair、小红书和视频号 / 微信小店已加入分类及离线图标；导航从目录自动生成，多平台技能分别计入对应平台。费用、资质、账号授权、服务端能力和当前规则仍按供应方说明核对。Skill 开源不代表所依赖服务免费。

AI 导航支持能力筛选，例如：

```bash
node skills/zgg-find-ecommerce-skills/scripts/search.mjs --platform Temu --capability 数据查询
```


## 导航的目录与功能更新

新版导航在检索前通过固定的公开 GitHub 地址检查 `data/updates.json`；检查间隔为 24 小时，网络总等待预算 2.5 秒。仅请求公开版本信息和目录文件，不上传搜索词或店铺资料。首次网络失败也记录时间，避免每次搜索重复等待。下载校验失败、版本结构不支持或目录日期倒退时保留已有目录。

成功下载的新目录保存在用户的 `.cache/zgg-find-ecommerce-skills/updates.json`，与安装包分开。功能指纹变化只输出更新提示和当前客户端的安装指引，不下载或执行新版脚本；由用户确认后更新本导航。已安装的早期版本需先更新一次。

```bash
# 无网络请求
node skills/zgg-find-ecommerce-skills/scripts/search.mjs --query "TikTok 选品" --offline
# 不等每日检查间隔，立即重新检查
node skills/zgg-find-ecommerce-skills/scripts/search.mjs --query "TikTok 选品" --check-updates
```

`ZGG_SKILLS_OFFLINE=1` 可持续禁用检查；`ZGG_SKILLS_CACHE_DIR` 可指定可写缓存位置。自定义 `--catalog` 文件不参与自动检查与覆盖。缓存不可写时使用安装包内目录。并发调用使用短期检查锁，避免重复请求。

发布前运行 `npm run build`，自动同步 Skill 的目录、生成 SHA-256 校验信息及新版下载包。提交源码时须同时包含 `data/updates.json` 与 `skills/zgg-find-ecommerce-skills/references/release.json`，并随目录一起发布；修改导航功能时维护 `skills/zgg-find-ecommerce-skills/version.json` 的版本。功能指纹包括 Skill 正文、版本与脚本，不包含目录数据，因此目录更新不需要重新安装功能。版本清单不匹配的新旧内容会拒绝同步，下一次检查可重试。


## 首次使用的本地网页引导

Skill 自带 `assets/ecommerce-skills.html`，由同一套网页源码构建，内嵌样式、JavaScript、平台图标、头像、favicon 和目录，不需要托管或账号。`references/website.json` 指向这个包内文件。

搜索输出 `welcome.show` 为 true 时，宿主 AI 先给欢迎文案和本机链接，再继续任务。状态位于用户缓存目录。`--show-web` 再次显示入口，`--no-welcome` 静默记录已介绍。不同客户端可选用绝对路径或 file URL；无法点击时让用户复制路径到浏览器。脚本不会自行打开浏览器。

每次检索比较页面模板及当前目录指纹，在 `<缓存目录>/web/index.html` 原子生成页面。仅目录变化也会刷新列表，功能升级时应用新版模板；浏览器刷新即可看到新内容。缓存不可写时退回包内 HTML，并返回 `catalog_current: false`。缓存和欢迎记录不写进安装目录。

构建顺序为：更新目录和搜索核心 → 生成单文件网页 → 复制到 Skill → 生成版本与校验信息 → 打包 ZIP，确保用户更新 Skill 时连同页面一起更新。网页中外部仓库、安装命令和依赖服务仍可能需要联网，但浏览本地目录不需要。
