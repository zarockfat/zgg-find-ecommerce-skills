# 贡献与收录

欢迎提交公开仓库和具体电商使用场景。可通过网页生成候选 JSON，之后随 [Issue](https://github.com/zarockfat/zgg-find-ecommerce-skills/issues/new) 或 Pull Request 提交。

1. 通过 `scripts/discover.mjs owner/repo` 定位单个 Skill 的精确路径。
2. 核对 `SKILL.md` 前置元信息里的名称、说明及仓库许可证。无明确许可的候选留在待审核区，不声称开源可再分发。
3. 检查外部服务、API、账号、软件和费用前置条件。不要执行未知候选代码。
4. 添加中文用途、平台与需求标签；不能把方法论描述成已接入实时接口。
5. 记录完整 commit SHA、原始文档 URL、核对日期与内容哈希。没有测试证据时 `tested` 必须为 false。
6. 运行 build、validate、test。安装和业务测试要另附环境、版本、输入输出及日期，再扩展测试证据字段。

请保留原作者署名。不要上传客户数据、店铺密钥或其他敏感资料。
