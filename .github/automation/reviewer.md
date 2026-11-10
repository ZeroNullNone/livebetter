# 独立内容复核任务（ChatGPT 网页云端）

配置时填入唯一目标仓库 `OWNER/REPO`。每次在新聊天中从默认分支读取本文件、AUTOMATION.md、CONTINUATION_GUIDE.md。不要继续改写任务的聊天，不把作者总结或 CI 绿灯当作事实依据。

1. 每次最多检查一个同仓库的 `sync/upstream-<完整SHA>` 未合并 PR。读取其 `<!-- sync-pr:v1 -->` 对应的 checker-created Issue。固定 PR 当前完整 head SHA 和 base SHA；不要只检查分支名或缩写。
2. 阅读真实 diff、旧原文、新原文、当前马来西亚正文及迁移记录。自行打开来源，核对数字、制度、身份、宗教、地域、时效及例外。检查所有变动是否覆盖原作者更新且保留本地已有正确内容。
3. 读取当前提交的 Content checks 和迁移记录验证结果。检查稳定条号、交叉引用、相关摘要/更新记录、文件范围及来源覆盖。审查过程中不修改正文或证据文件。
4. 发现问题时输出 REQUEST_CHANGES 及可执行意见。工具或检索不可用、额度不足、来源无法核实、CI 未完成/失败时也不得 APPROVE；说明原因后结束。作者下一次运行负责修复。
5. 确认通过前重新读取 head/base。变动则不为旧版批准，留待下次复核。只在所有核对成功且 findings 为空时输出 APPROVE、sourcesChecked=true。
6. 在 PR Conversation 发表如下标识的 JSON 评论。更新自己已有的复核评论或新增一条；合并程序使用最近更新的可信复核记录。不要作 GitHub 正式 approving review（作者/复核者可能是同一 GitHub 账户）。不要合并或关闭 Issue。

<!-- localization-review:v1 -->
```json
{
  "version": 1,
  "issue": 123,
  "headSha": "填写当前完整40位PR提交SHA",
  "baseSha": "填写当前完整40位基分支SHA",
  "verdict": "REQUEST_CHANGES",
  "sourcesChecked": false,
  "summary": "说明实际核对范围、来源和结论",
  "findings": ["指出条目、问题及需要的修改"]
}
```

通过时 verdict 为 APPROVE、sourcesChecked 为 true、findings 为 []。不把未执行的核对报告为通过。此记录是 AI 的判断，程序只能验证其身份、结构和提交版本，不能证明事实正确或两项任务真正相互独立。
