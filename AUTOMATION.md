# 自动同步与发布配置

项目侧流程：GitHub Actions 检查原作者 → 网页云端任务改写 → Content checks → 独立网页云端任务复核 → 合并机器人 → Cloudflare Git integration → 线上文件验证 → 关闭 Issue。

当前只提供项目代码。没有创建远程仓库、GitHub App、ChatGPT 定时任务、Cloudflare 项目或修改账户权限。检查、合并和发布验证各有独立开关，默认关闭。没有调用模型的脚本或模型 API Key。

## 首版边界

- 仅迁移现有章节/专题内的内容；保持 34 章、9 篇专题、772 个条目及原有条号，避免破坏链接、自查问题和本地个人记录。新增/删除/改名/改号需要单独设计和验证，自动 PR 不会合并。
- 允许改动：现有 book/*.md、docs/*.md、README.md、updates.json、.upstream_sync.json、当前批次 artifacts/sync/<targetSha>.json。自动迁移不得改脚本、页面、测试、工作流、许可证和历史证据。
- 本地化与事实核实由云端任务执行，不是关键词替换。CI 验证结构、来源记录、哈希及浏览器行为，不能证明事实正确。
- 任务失败、来源不足或超出范围时在 Issue 评论记录阻塞；不虚报完成。迁移和复核分开聊天，但同一 GitHub 身份无法从技术上证明两个 AI 任务独立。
- 一次仅处理一个冻结批次；同批次复用 Issue/分支/PR。新上游提交待当前批次发布成功后再处理。

## 一次性配置顺序

1. 创建自己的公开 GitHub 仓库，默认分支 main，启用 Issues，上传当前项目。保留原作者署名及许可证。此本地目录目前没有 Git 仓库；不要把上游 HEAD 当作本地已完成版本。
2. 独立确认已完成迁移的上游完整 SHA，然后运行 `node scripts/check-upstream.mjs --init-sha <full-sha>`，检查并提交 .upstream_sync.json。命令只确认提交存在，不能确认迁移完整；基准仍不明确时不要启用上游检查。不要把最新版本直接标为已处理。
3. 在 ChatGPT 网页端确认 GitHub 连接可访问目标仓库，先手动测试读取 Issue、在测试分支提交文件、创建 PR、发表复核评论。验证后台执行不会停在登录或操作批准。当前订阅/工具可见性不构成无人值守端到端验收；若权限拒绝，保持自动合并关闭。不要仅为测试而扩大到无关仓库。
4. 配置 GitHub Actions。PR 的 `Content checks` 应成功；main 的 ruleset 要求 PR、成功的 `Content checks` 且分支保持最新。不要求人工 review/Code Owner approval，不给机器人 bypass。支持 squash merge。此实现通过带预期 head SHA 的 merge API 执行合并，不依赖 GitHub 的 Allow auto-merge 开关。
5. 创建只安装在目标仓库的 GitHub App：Contents、Pull requests 读写；Issues、Actions、Checks、Commit statuses 只读（关闭 Issue 由发布验证工作流执行）。不要授予 Workflows 或 Administration/bypass。把 App ID 放在变量 SYNC_APP_ID、私钥放在 Secret SYNC_APP_PRIVATE_KEY。合并机器人必须与测试/改写环境隔离。
6. 建立 Cloudflare Pages **Git integration**，连接该仓库：生产分支 main，preset None，根目录仓库根，构建命令 `node scripts/build-site.mjs`，输出 dist，Node.js 22。不要再配置第二条 Direct Upload 部署。构建仅导出公开文件和版本/资源哈希；不导出脚本、凭证、任务提示词或审查记录。
7. 在 Pages 的 Custom domains 添加域名并按提示配置 DNS/HTTPS。根域名需要 Cloudflare nameservers；子域名可用当前 DNS 服务商的 CNAME。先在 Pages 关联域名再添加 CNAME。
8. 设置下表变量，先不要启用 AUTO_MERGE_SYNC。手动跑一次完整测试批次，验证检查失败/旧复核/文件越界不能合并，发布错误不能关闭 Issue。
9. 在 ChatGPT **网页端 Scheduled** 建两项独立云端任务，填唯一 OWNER/REPO，并让它们每次读取默认分支的 `.github/automation/author.md` 或 `reviewer.md`。建议每天马来西亚时间 09:30 改写、10:30 复核，并选择每次新聊天。不要选择本地项目任务。09:00 上游检查可能延迟，任务按实际 Issue/PR 状态执行，空队列结束；不依赖准点或持续无限运行。
10. 验收后启用三个开关。后续只需处理持续失败或凭证/额度问题。此文件不承诺账户会无条件允许所有后台写入。

### GitHub Actions Variables / Secrets

| 名称 | 类型 | 值 |
| --- | --- | --- |
| UPSTREAM_SYNC_ENABLED | Variable | 验证基准后设为 enabled，启用每天 09:00 检查 |
| AUTO_MERGE_SYNC | Variable | 验收后设为 enabled，启用每小时四次的合并轮询 |
| SYNC_AUTHORS | Variable | 逗号分隔的可信 PR 创建者 GitHub login（使用实测身份） |
| SYNC_REVIEWERS | Variable | 逗号分隔的可信复核评论者 GitHub login，可与作者相同 |
| SYNC_APP_ID | Variable | 合并 App ID |
| SYNC_APP_PRIVATE_KEY | Secret | 合并 App 私钥，不提交到仓库 |
| PUBLIC_SITE_URL | Variable | 正式 HTTPS 地址，例如 https://guide.example.com/ |
| PUBLICATION_CHECK_ENABLED | Variable | Pages 配置成功后设为 enabled |

不需要 OPENAI_API_KEY 或 Cloudflare API token。ChatGPT 云端任务使用订阅与已连接 GitHub 工具；Cloudflare 自行从 GitHub 构建部署。真实权限/额度和后台可用性必须实测。

## 机器可读契约

检查程序仅创建带 `<!-- upstream-sync:v1 -->` 的 GitHub Actions bot Issue，并固定 repo、baseSha、targetSha、files。待发布 Issue 保持打开，后续检查不会偷偷推进 targetSha。

PR 分支固定为 `sync/upstream-<targetSha>`。PR 正文以以下格式关联 Issue，不使用 Closes/Fixes/Resolves 自动关闭：

<!-- sync-pr:v1 -->
```json
{"issue": 123}
```

改写任务同时更新 .upstream_sync.json 和新增 artifacts/sync/<targetSha>.json：

```json
{
  "version": 1,
  "repo": "eternity4719/HowToLiveBetter",
  "issue": 123,
  "baseSha": "完整40位旧SHA",
  "targetSha": "完整40位新SHA",
  "files": [
    {"path": "book/01-不要早死.md", "sha256": "完整文件UTF-8字节SHA256", "sources": ["https://官方来源"]}
  ],
  "entries": [
    {"file": "book/01-不要早死.md", "number": 4, "sha256": "该条目完整UTF-8文本SHA256", "sources": ["https://官方来源"]}
  ],
  "sources": [
    {"url": "https://官方来源", "title": "实际读取的页面或论文标题", "checkedAt": "2026-11-10"}
  ],
  "notes": "迁移内容、上游差异、本地适用范围与例外"
}
```

files 必须恰好覆盖本 PR 改动的正文/README/updates.json；entries 恰好覆盖文本变化的 book 条目。来源使用实际 HTTPS URL，条目来源 URL 必须出现在正文。哈希包含原始换行、条目后的空行；可用项目导出函数计算，或在浏览器代码工具中按同样的 UTF-8 SHA256 算法计算：

```js
import {entries, digest} from './scripts/validate-sync.mjs';
// digest(完整文件文本)
// entries(章节文本).map(e => ({number:e.number, sha256:digest(e.text)}))
```

复核任务在 PR Conversation 发布 `<!-- localization-review:v1 -->` + JSON，字段见 reviewer.md。合并程序只接受可信身份的最近一条记录，必须 APPROVE、sourcesChecked=true、findings=[]，headSha/baseSha 都匹配实时 PR。任何新提交或基分支推进都需要重新复核。

自动合并执行前再次读取 PR/base，要求同仓库、指定分支、可信作者、完整迁移证据、实际 validate-pr.yml 的成功运行、Content checks 成功、其他已报告检查没有失败/待运行。GitHub 分支规则继续生效。AI 复核记录是可信账户的声明，不是密码学意义的事实证明。

## 发布、恢复与本地检查

Cloudflare 构建输出 version.json，包含完整提交 SHA 和全部公开资源的 SHA256。发布验证等待约五分钟并校验实际资源字节，不把 HTTP 200（例如 SPA 回退页）当成功。成功后才评论并关闭同步 Issue。

部署失败或另一提交抢先发布时，Issue 保持打开。修复部署后，在最新 main 上重新运行 Verify publication；不要重新改写同一批。它会构建当前提交、确认线上资源与之匹配，再按当前已迁移状态关闭对应 Issue。校验失败不会回滚或删除线上数据。

合并轮询的拒绝原因在 Actions 日志中；未满足门禁时会跳过，不代表已完成。API/权限错误不会执行合并；不做盲目写入重试。关闭三个 enabled 开关即可停用对应自动操作。

```sh
node --test scripts/test-automation.mjs
node scripts/test-localization.mjs
node scripts/status-my.mjs --detail
node scripts/test-guide.mjs
node scripts/build-site.mjs  # 需要已初始化Git或Cloudflare提供真实提交SHA
```

校验迁移 PR：`node scripts/validate-sync.mjs <完整基分支SHA>`。CI 从基分支读取门禁代码，候选正文单独检出；不要让迁移 PR 通过修改自己的测试获取成功。
