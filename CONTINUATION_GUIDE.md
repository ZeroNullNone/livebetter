# 🇲🇾《高性价比人生指南》马来西亚版 · 续写与维护指南 (CONTINUATION_GUIDE.md)

本文件专为你在**新的 AI 对话窗口（New Session）**继续深化、修改或新增马来西亚版内容而设计。

---

## 一、 如何在新对话（New Session）中继续工作？

下次打开新的 AI 会话时，只需直接复制粘贴以下这段话发给 AI 助手即可：

```text
请先阅读工作区下的 `/Users/louis/Code/HowToLiveBetter/CONTINUATION_GUIDE.md`，并运行 `node scripts/status-my.mjs --detail` 查看当前各章节的马来西亚在地化进度与格式状态。
然后帮我修改（或新增）指定章节的马来西亚本地制度、法令、政府机构与马币（RM）价格。改完后运行 `node scripts/status-my.mjs --detail` 确保 结构完整，并逐项处理本地化发现；没有关键词命中不等于事实已核实。
```

---

## 二、 如何本地预览与部署本网站？

本项目为纯静态 Web 应用设计，无需配置任何后端数据库：

1. **本地预览（本地 HTTP 服务）**：
   ```bash
   cd /Users/louis/Code/HowToLiveBetter
   python3 -m http.server 8000
   # 浏览器访问 http://localhost:8000 (主阅读站) 或 http://localhost:8000/selfcheck.html (自查问卷)
   ```
2. **公网部署（推荐 Cloudflare Pages）**：
   - 将仓库推送到 GitHub，Cloudflare Pages 使用 Git integration，生产分支 `main`，构建命令 `node scripts/build-site.mjs`，输出目录 `dist`。
   - 自动化代码与一次性账户配置见 [AUTOMATION.md](AUTOMATION.md)。云端任务、GitHub 和 Cloudflare 设置尚未创建或更改；上游基准和自动合并开关不能直接假定已配置。

---

## 三、 目录结构与常用命令

```text
/Users/louis/Code/HowToLiveBetter/
├── index.html                 # 交互式主阅读站（含搜索、多维筛选、个人打卡、私人笔记、马来西亚速查弹窗）
├── selfcheck.html             # 马来西亚版个人生活自查问卷（支持一键同步到主站待办清单）
├── updates.json               # 条目最新修订动态记录
├── README.md                  # 总目录、术语表与免责声明（前端直接异步读取本文件渲染）
├── book/                      # 34 个章节正文（01-不要早死.md ~ 34-家里的常备药别吃出事.md）
├── docs/                      # 9 篇专题长文（前端直接就地弹窗渲染）
├── scripts/
│   ├── check-upstream.mjs     # 检查原作者最新提交与差异文件的同步脚本
│   ├── convert-my.mjs         # 基础马来西亚日常用语与紧急热线批量替换脚本（幂等）
│   └── status-my.mjs          # 检查全书 Markdown 格式完整性与残留大陆制度词的诊断工具
└── .github/workflows/
    └── check-upstream.yml     # 每日检查与去重 Issue；其他流程见 AUTOMATION.md
```

### 核心 2 条维护命令：
```bash
# 1. 检查全书 Markdown 格式完整性，并列出残留制度词、来源与未完成核对的条目
node scripts/status-my.mjs --detail

# 2. 检查原作者 (eternity4719/HowToLiveBetter) 是否有新提交与更新
node scripts/check-upstream.mjs
```

---

## 四、 修改 `book/*.md` 正文时的硬性格式规范（AI 必须遵守）

前端 `index.html` 和 `selfcheck.html` 依赖正则解析 `book/*.md`，修改或改写条目时**保持以下格式**：

1. **严禁增删条目或打乱条号 `### N.`**
   - 全书有许多跨章节交叉引用（如 `见第 8 节第 16 条`）。前端通过 `第 X 节第 Y 条` 的数字编号定位。保持每节的 `### 1.`、`### 2.` 顺序不变，避免破坏交叉引用目标。
2. **每条建议的标题、成本标签和六个字段结构不可缺失，且每个字段必须写在同一行（不要在字段内部换行）**：
   ```markdown
   ### 5. 条目标题（动词开头，直白清晰）
   <!-- 成本标签: 钱=0|少|多 时间=少|中|多 毅力=否|些|是 收益=大|中|小 口径=死亡率|金钱|时间|自由 -->
   - 成本：...（使用马币 RM 与马来西亚实际场景）
   - 说人话：...（1~3句大白话总结核心结论与后果）
   - 收益：...（具体制度规定、法规条款或医学研究数据，长段会自动被前端按句号分块展示）
   - 证据等级：A / B / C
   - 来源：...（官方机构网址或论文 DOI，多条来源用全角分号「；」分隔）
   - 备注：...（注意事项、适用人群；若有争议则以「争议：」开头）
   ```
3. **私享版文风要求**：
   - 这是个人私享指南，**不要写「中国大陆是XX、马来西亚没有XX、截至某年某月核实」这种对比或免责废话**。
   - 直接写**在马来西亚该怎么做、去哪个部门、按哪条马来西亚法令、花多少马币（RM）**。

---

**受众规则**：中文是内容语言，不是族群限制。不得以华人代指非穆斯林、以马来人代指所有穆斯林、或以土著代指单一宗教；补贴须区分公民与非公民，西马／纳闽与沙巴／砂拉越须核对地区规则。保持来源原始题名，境外医学研究须写明样本范围，不能当本地法律依据。

## 五、继续核对与交付

1. 先读待改条目的六个字段、相关专题和目录说明。保持条号、成本标签及交叉引用目标稳定。
2. 法律、医疗、金融和资格事项查对应主管机关的一手资料。记录来源版本、适用地区、身份、宗教及例外；金额和期限按当前来源核对。
3. 正文写可执行的本地行动、部门入口及适用边界。缺乏本地依据的原数字或制度，移除后给出有依据的替代说明；价格按实际本地报价或明确估算依据，不直接转换货币名称。
4. 改完正文后，同步相关专题、README 摘要和 `updates.json`。核对记录写入 `artifacts/`，包含条号、修改内容与来源；境外研究保留原题名及样本地区。
5. 运行 `node scripts/status-my.mjs --detail` 和 `node scripts/test-localization.mjs`。修改了页面、导航或渲染相关内容时，再运行 `node scripts/test-guide.mjs`，使用真实 Chrome 检查阅读及自查流程。
6. 交付时分别报告正文完成范围、检查结果及是否发布。扫描无命中只是回归证据，事实结论由逐条记录和来源支持。

本轮 156 条的记录见 [逐条核对报告](artifacts/LOCALIZATION_REVIEW_20261110.md) 和 [结构化记录](artifacts/localization-verification-20261110.json)。继续改对应条目时，从记录的来源回查主管机关，不将本文件当成永久有效的法条、价格或补贴清单。
