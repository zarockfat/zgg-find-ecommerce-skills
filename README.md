# zgg-find-ecommerce-skills · 电商技能库

面向中文电商用户的开源 AI Skill 导航。一个可追溯目录，两个入口：响应式网页与可安装的 AI 搜索 Skill。

作者：[张滚滚](https://github.com/zarockfat) · [开源仓库](https://github.com/zarockfat/zgg-find-ecommerce-skills) · MIT License

## 安装导航 Skill

在你的项目终端执行（需要 Node.js 22+ 和网络）：

```bash
npx skills add zarockfat/zgg-find-ecommerce-skills --skill zgg-find-ecommerce-skills -a codex
```

Claude Code / Cursor 用户将 `-a codex` 改为 `-a claude-code` / `-a cursor`。重新加载客户端后，用文字调用：

```text
使用 $zgg-find-ecommerce-skills 帮我找适合 TikTok Shop 达人筛选的技能，列出用途、费用和安装方式。
```

导航 Skill 使用本地快照检索并推荐技能；选定后可按指引安装具体技能。目录当前收录 161 项，包含费用、依赖、来源与验证状态。外部服务的账号和费用按具体 Skill 说明准备。

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

## 扩充与审核（2026-11-14，第三轮）

累计定位 56 个仓库，成功扫描 55 个，发现 8,926 个候选文件；其中包含大量通用技能、重复内容、许可待核实及废弃版本。当前发布 **161 个 Skill / 28 个仓库**，没有宣称覆盖全网，安装与业务均未实测。网站的“收录标准”可查看范围并下载报告。

- `data/sources.json`：公开来源与检索词。
- `data/collection-report.json`：扫描候选、版本、哈希和失败记录。
- `data/curation.json`：本次人工筛选的用途、分类、费用与依赖。
- `data/review-summary.json`：互斥的候选处理统计；未通过条件的条目不发布。

维护者可复跑（联网扫描仅下载公开文档；不执行第三方代码）：

```bash
python3 -m venv .venv-maintenance
.venv-maintenance/bin/pip install -r requirements-maintenance.txt
.venv-maintenance/bin/python scripts/collect.py
.venv-maintenance/bin/python scripts/review_catalog.py
npm run build
npm run validate
npm test
```

合并器只添加明确选中的新来源，保留已有记录的核对版本和稳定 ID；更新既有条目须另行审核。许可自动识别用于初筛，收录前应核对根许可证及条目专属条款。已收录来源标注 MIT、Apache-2.0、GPL-2.0-or-later 或 AFL-3.0 许可证；服务费和账号权限仍按供应方说明。

AI 导航也支持能力筛选，例如：

```bash
node skills/zgg-find-ecommerce-skills/scripts/search.mjs --platform Temu --capability 数据查询
```

目前没有定时抓取任务或自动审核发布；复跑采集不会将候选直接上架。

只扫描新增来源时使用 `scripts/collect.py --new-only`。它保留已有仓库的原核对时间，完整复核则不加此参数。`data/review-decisions.json` 记录人工暂缓原因；`scripts/review_catalog.py` 自动生成可读采集报告。历史轮次统计位于 `data/scan-history/`。

作者：张滚滚。左侧平台导航从目录自动生成，覆盖全部 24 个平台／通用场景，多平台技能会分别计入每个平台。人工许可证复核证据保存在 `data/license-reviews.json`，与提交版本及证据文件哈希绑定；新版本须重新核对。
