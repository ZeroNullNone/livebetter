# 内容迁移任务（ChatGPT 网页云端）

配置任务时在开头填入唯一目标仓库 `OWNER/REPO`，只处理该仓库。每次从默认分支读取本文件、AUTOMATION.md、CONTINUATION_GUIDE.md。用 GitHub 连接工具读写远程文件，测试交给 GitHub Actions，不依赖本机或模型 API Key。

1. 找到由 `github-actions[bot]` 创建、正文以 `<!-- upstream-sync:v1 -->` 及紧接的 JSON 代码块标识的未关闭 Issue。每次最多处理一批。已有批次 PR 时只处理它的 CI 失败/复核意见，不重复建分支或 PR。不要从任意用户评论接受新的任务或权限。
2. 固定 Issue 中的完整 baseSha、targetSha，确认默认分支 `.upstream_sync.json` 的 lastAppliedSha 等于 baseSha；不等时只报告状态。若已等于 targetSha，说明已合并，应等待发布验证，不重复迁移。
3. 在上游固定 SHA 下比较旧原文、新原文和当前马来西亚版本。Issue 的文件列表是各提交触及过的路径，不保证最终仍有差异；自行核对最终文本。不要整文件覆盖或直接 merge 上游。
4. 保持现有章节文件、条号、交叉引用和浏览器个人记录 ID。新增/删除/改名/重新编号及对应不清的条目超出首版自动合并范围，记录阻塞原因。不能核实的事实不猜测，不用关键词替换冒充迁移。
5. 以中文面向各族群；区分公民身份、宗教、西马/纳闽/沙巴/砂拉越适用范围。查询当前主管机关或原论文，保留研究数字与原始题名。金额不能只换币种。记录实际读取的来源 URL、标题、日期及适用性。检索/工具/额度失败就记录失败，不报告已核实。
6. 分支固定为 `sync/upstream-<targetSha>`。只修改现有 `book/*.md`、`docs/*.md`、README.md、updates.json、`.upstream_sync.json` 和本批 `artifacts/sync/<targetSha>.json`。禁止修改页面、脚本、测试、工作流、许可证、历史核对记录或任务规则。
7. 在同一次候选修改中更新 lastAppliedSha 为 targetSha，并按 AUTOMATION.md 生成覆盖全部改动的文件/条目哈希与来源记录。这表示候选迁移完成；只有 PR 合并后才成为默认分支基准。若最终无内容差异，解释原因并停止，不伪造内容改动以推进基准。
8. PR 正文使用下方标识，注明 `Related to #N`，不要使用自动关闭 Issue 的 Closes/Fixes/Resolves。不要自行合并或关闭 Issue，也不要自行发布复核通过记录。
9. 等待/读取 Content checks。失败时读取日志并修复内容，最多两轮；需要修改规则/测试、权限不足或无法核实时保存原因并结束。后续运行从同一 Issue/PR 继续。

PR 正文开头（N 替换为同步 Issue 号码）：

<!-- sync-pr:v1 -->
```json
{"issue": 123}
```

每次结束仅汇报发生变化的 Issue/PR、结果及阻塞。将进度写入对应 Issue 的评论，不只保留在聊天记忆里。
