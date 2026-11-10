#!/usr/bin/env node
/**
 * 马来西亚版（zh-MY）基础用语、紧急电话与制度名词批量转换脚本
 * 可安全重复执行（幂等）。仅转换叙述文本与标题中的中国大陆特定用语，不破坏 Markdown 结构与成本标签。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

// 1. 紧急电话与求助热线精准替换
const HOTLINE_RULES = [
  // 120 / 110 / 119 -> 999
  [/打\s*110\s*[/／或和]\s*120/g, '打 999'],
  [/打\s*120\s*[/／或和]\s*119/g, '打 999'],
  [/120\s*[/／]\s*119/g, '999'],
  [/110\s*[/／]\s*120/g, '999'],
  [/(?:拨打|呼叫|快打|先打|马上打|立刻打|同时打|直接打|赶紧打|打|叫|拨)\s*\*\*120\*\*/g, '打 **999**'],
  [/(?:拨打|呼叫|快打|先打|马上打|立刻打|同时打|直接打|赶紧打|打|叫|拨)\s*120(?!\d)/g, (m) => m.replace(/120$/, '999')],
  [/(?:拨打|呼叫|快打|先打|马上打|立刻打|同时打|直接打|赶紧打|打|叫|拨)\s*119(?!\d)/g, (m) => m.replace(/119$/, '999')],
  [/(?:拨打|呼叫|快打|先打|马上打|立刻打|同时打|直接打|赶紧打|打|叫|拨)\s*110(?!\d)/g, (m) => m.replace(/110$/, '999 报警')],
  [/「120」/g, '「999」'],
  [/（120）/g, '（999）'],
  [/急救电话\s*120/g, '紧急求助电话 999'],
  // 反诈热线 96110 -> NSRC 997
  [/打\s*110\s*或\s*96110/g, '打 NSRC 997（国家诈骗应对中心）或 999'],
  [/96110/g, 'NSRC 997'],
  // 心理危机热线 12356 / 12355 -> Talian HEAL 15555 / Befrienders
  [/全国心理援助热线\s*12356/g, '卫生部心理健康热线 15555（Talian HEAL）或 Befrienders（03-7627 2929，24小时免费）'],
  [/12356\s*[和与、/]\s*12355/g, '15555（Talian HEAL）与 Befrienders（03-7627 2929）'],
  [/12356/g, '15555（Talian HEAL）或 Befrienders 03-7627 2929'],
  [/12355/g, 'Talian Kasih 15999'],
  // 领事保护 12308 -> Wisma Putra
  [/\+86-10-12308/g, '+603-8887 4570（马来西亚外交部 Wisma Putra 紧急热线）'],
  [/12308/g, '马来西亚外交部（Wisma Putra）领事保护（+603-8887 4570）'],
  // 消费投诉 12315 / 12345 / 12320
  [/12315/g, 'KPDN（内贸部）e-Aduan 或消费人索偿仲裁庭（TTPM）'],
  [/12320/g, '政府诊所（Klinik Kesihatan）戒烟门诊（Klinik Berhenti Merokok）'],
];

// 2. 马来西亚华语日常词汇与医学/生活用语替换（仅在非来源行生效）
const VOCAB_RULES = [
  ['对乙酰氨基酚', '扑热息痛（Paracetamol，俗称 Panadol）'],
  ['创可贴', '胶布（Plaster）'],
  ['便利店', '便利店（如 99 Speedmart、7-Eleven）'],
  ['网约车', '电召车（如 Grab）'],
  ['出租车', '德士或电召车（Grab）'],
  ['派出所', '警察局（Balai Polis）'],
  ['交警', '交警（Polis Trafik）'],
  ['居委会', '居民协会（RA）或地方政府'],
  ['街道办', '地方政府（市政厅/市议会）或福利局（JKM）'],
  ['物业公司', '共管公寓管理层（JMB / MC）或物业管理处'],
  ['社区卫生服务中心', '政府健康诊所（Klinik Kesihatan，简称 KK）'],
  ['三甲医院', '政府大医院或大型专科医院'],
  ['三级医院', '政府大医院或专科医院'],
  ['急诊分诊台', '急诊检伤分类站（Triage）'],
  ['急诊预检分诊台', '急诊检伤分类站（Triage）'],
  ['留服认证', '马来西亚学术资格鉴定机构（MQA）认证'],
  ['3C 认证', 'SIRIM 认证'],
  ['3C 标志', 'SIRIM 认证标签'],
  ['强制性产品认证（CCC）', 'SIRIM 强制安全认证'],
];

function processLine(line) {
  // 成本标签行保持原样（前端靠固定键名解析）
  if (line.startsWith('<!-- 成本标签:')) return line;
  // 来源行保留原始文献题录，只替换明显的错误热线引导（一般来源行不改日常词）
  const isSource = line.startsWith('- 来源：');

  let out = line;
  for (const [re, rep] of HOTLINE_RULES) {
    out = out.replace(re, rep);
  }
  if (!isSource) {
    for (const [from, to] of VOCAB_RULES) {
      // 防止重复追加括号解释
      if (out.includes(to)) continue;
      out = out.split(from).join(to);
    }
  }
  return out;
}

function convertFile(filePath) {
  const orig = fs.readFileSync(filePath, 'utf8');
  const lines = orig.split(/\r?\n/);
  const next = lines.map(processLine).join('\n');
  if (next !== orig) {
    fs.writeFileSync(filePath, next, 'utf8');
    return true;
  }
  return false;
}

let count = 0;
for (const dir of ['book', 'docs']) {
  const fullDir = path.join(ROOT, dir);
  for (const name of fs.readdirSync(fullDir)) {
    if (!name.endsWith('.md')) continue;
    if (convertFile(path.join(fullDir, name))) count++;
  }
}
if (convertFile(path.join(ROOT, 'README.md'))) count++;

console.log(`✅ 基础马来西亚用语与紧急热线转换完成，共更新 ${count} 个文件。`);
