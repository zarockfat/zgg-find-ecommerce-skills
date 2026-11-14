# 把技能装到不同的 AI 工具

[返回项目介绍](../README.md)

网页详情页和“在 AI 中使用导航”都可以选择客户端。核对日期：2026-11-15；下列是文档核对结果，尚未逐客户端做安装或业务实测。

## 可以使用安装命令的工具

在项目终端中使用 `npx skills add 仓库名 --skill 技能名 -a 客户端标识`。安装器当前需要 Node.js 22.20+ 及网络。

| 工具 | 客户端标识 |
| --- | --- |
| Codex | `codex` |
| Claude Code | `claude-code` |
| Cursor | `cursor` |
| TRAE 国内版 / 国际版 | `trae-cn` / `trae` |
| CodeBuddy | `codebuddy` |
| Kimi Code CLI | `kimi-code-cli` |
| Qwen Code | `qwen-code` |
| OpenClaw | `openclaw` |

网页会生成完整命令。没有列出的 Agent 可选择“其他 Agent”：省略 `-a`，从安装器的列表选客户端。若没有列出，使用该客户端自己的导入方法。标识来源：[skills 安装器官方支持列表](https://github.com/vercel-labs/skills/blob/main/docs/agents.md)。

## WorkBuddy

1. 导航技能：构建网页后下载“导航 Skill ZIP”；第三方技能：从详情页下载对应版本的仓库 ZIP，解压后找到指定 SKILL.md 所在文件夹，将它及完整配套文件单独打包成 ZIP。
2. 在 WorkBuddy 中进入“专家·技能·连接器”的技能页，从“添加技能 → 上传技能”导入。
3. 在已安装列表确认已启用，再在对话中使用。

市场的对话安装只适用于市场中的技能，本目录条目不保证已上架。WorkBuddy 和 CodeBuddy 是不同的工具，使用各自的安装入口。参见 [WorkBuddy 官方技能说明](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market)。

## 豆包 / 豆包工作

先检查具体产品、版本是否有技能上传、导入或新建入口；若有，按其要求导入完整技能包，并检查依赖。本站尚未验证豆包本地导入路径，不提供 `-a doubao` 命令。

没有导入入口时，方法类技能可以作为聊天参考资料；复制正文不等于安装，脚本、店铺接口和外部工具也不会随之可用。豆包的应用插件另有接入要求，其沙箱和工具能力不能与本地 Agent 混同。参见[豆包 Skill 接入指南](https://open.doubao.com/document/doubao-developer-guide/skill-integration-guide)及[豆包应用插件 Skill 规范](https://open.doubao.com/apps-plugin/docs/core-concepts/skill-guidelines)。

## 从导航脚本获取指引

```bash
node skills/zgg-find-ecommerce-skills/scripts/search.mjs --query "TikTok 选品" --agent workbuddy
node skills/zgg-find-ecommerce-skills/scripts/search.mjs --query "TikTok 选品" --agent doubao
node skills/zgg-find-ecommerce-skills/scripts/search.mjs --query "TikTok 选品" --agent trae-cn
```

输出中的 `installation_guide` 包含步骤、说明与官方来源。仅命令安装模式提供 `install_command`，手动或条件导入模式为 null。
