#!/usr/bin/env node
/** Structural checks and localization triage. A clean scan is not factual acceptance. */
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const ROOT = process.env.SITE_ROOT || path.resolve(import.meta.dirname, '..');
const RULES = [
  ['country-name', /大\u9a6c/u, '名称尚未统一'],
  ['foreign-law-source', /全国人大|全国人民代表大会|最高人民法院|最高人民检察院|国务院|民政部|中国人民银行|中国银保监会|中国保险监督管理|国家金融监督管理总局|中国证券监督|商务部|国家税务总局|财政部、税务总局|工信部|教育部留学服务中心|留服中心/u, '仍含境外机构或法律依据，须核对本地适用性'],
  ['foreign-policy', /民法典|治安管理处罚法|国家赔偿法|民事诉讼法|户口簿|宅基地|城镇户口|职工医保|居民医保|新农合|住房公积金|个人养老金账户|劳动仲裁|人社局|残联|国妆特字|犹豫期|交强险|七日无理由|十倍价款|三倍车款|\bLPR\b|\bQDII\b|港股通|留服中心|落户|12378|12366|12119/u, '存在待改写的境外制度或用语'],
  ['foreign-regulatory-clause', /房地产经纪管理办法|商品房屋租赁管理办法|人脸识别技术应用安全管理办法|药品经营和使用质量监督管理办法|药品网络销售监督管理办法|家用汽车产品修理更换退货责任规定|强制性产品认证管理规定|检验检测机构资质认定管理办法|医疗机构检查检验结果互认管理办法|消费者权益保护法|国家知识产权局|中国证监会/u, '仍以境外监管规则说明本地办事要求'],
  ['wrong-emergency-number', /(?:打|拨|叫|热线)[^。；\n]{0,16}(?<!\d)(?:110|119|120|96110|12356|12308)(?!\d)/u, '紧急电话可能仍为境外号码'],
  ['ethnicity-default', /默认非穆斯林|华人（非穆斯林）|华人\(非穆斯林\)/u, '把受众或宗教默认成某族群'],
  ['local-policy-version', /2012年消费者保护（电子商业交易）条例|2012年电子商务消费者保护条例|Electronic Trade Transactions\) Regulations 2012|CASP\(C\)|2023年网络服务安全法案/u, '本地电商法规版本或牌照类别仍须按当前官方文件复核'],
  ['unresolved-localization', /待核实：马来西亚适用性/u, '适用性事项仍未完成正文处理'],
];
export function scanText(text, relPath) {
  const hits = [], formatErrors = [], entries = [];
  let current = null;
  for (const [idx,line] of text.split(/\r?\n/).entries()) {
    const heading = /^### (\d+)\. (.+)$/.exec(line);
    if (heading && relPath.startsWith('book/')) {
      current = {n:Number(heading[1]),title:heading[2],line:idx+1,text:''}; entries.push(current);
    }
    if(current) current.text += line+'\n';
    // Inspect citations too: the previous check skipped the very laws that needed replacement.
    if (line.startsWith('<!--')) continue;
    for (const [rule,re,message] of RULES) {
      if(re.test(line)) hits.push({file:relPath,line:idx+1,entry:current?.n??null,title:current?.title??null,rule,message,snippet:line.trim().slice(0,220)});
    }
  }
  for (const [idx,e] of entries.entries()) {
    if(e.n!==idx+1) formatErrors.push(`${relPath}:${e.line} 条号不连续（预期 ${idx+1}）`);
    if(!/^<!-- 成本标签: .+ -->$/m.test(e.text)) formatErrors.push(`${relPath}:${e.line} 缺少成本标签`);
    for(const label of ['成本','说人话','收益','证据等级','来源','备注']) {
      const lines=e.text.split('\n').filter(l=>l.startsWith(`- ${label}：`));
      if(lines.length!==1 || !lines[0].slice(label.length+3).trim()) formatErrors.push(`${relPath}:${e.line} ${label}字段缺失、重复或为空`);
    }
  }
  return {file:relPath,entries:entries.length,hits,formatErrors};
}
export function audit(root=ROOT) {
  const book=fs.readdirSync(path.join(root,'book')).filter(f=>f.endsWith('.md')).sort().map(f=>'book/'+f);
  const docs=fs.readdirSync(path.join(root,'docs')).filter(f=>f.endsWith('.md')).sort().map(f=>'docs/'+f);
  const files=[...book,...docs,'README.md','index.html','selfcheck.html','assets/reader.js','assets/selfcheck.js'];
  const reports=files.map(f=>scanText(fs.readFileSync(path.join(root,f),'utf8'),f));
  // Pattern definitions are implementation, not reader copy; only country wording is checked in runtime JS.
  for(const r of reports.filter(r=>r.file.endsWith('.js'))) r.hits=r.hits.filter(h=>h.rule==='country-name');
  return {date:'2026-11-10',scope:'自动扫描全部正文、专题、目录及阅读／自查页面；关键词与来源风险筛查，不代表逐条法律或医学核实。',files:files.length,chapters:book.length,essays:docs.length,entries:reports.reduce((n,r)=>n+r.entries,0),formatErrors:reports.flatMap(r=>r.formatErrors),findings:reports.flatMap(r=>r.hits),affectedEntries:[...new Set(reports.flatMap(r=>r.hits).filter(h=>h.entry!==null).map(h=>`${Number(h.file.match(/^book\/(\d+)/)?.[1])}-${h.entry}`))],reports};
}
function main(){
  const report=audit();
  const detail=process.argv.includes('--detail');
  if(process.argv.includes('--write-report')) {
    fs.mkdirSync(path.join(ROOT,'artifacts'),{recursive:true});
    fs.writeFileSync(path.join(ROOT,'artifacts/localization-review-20261110.json'),JSON.stringify(report,null,2)+'\n');
  }
  console.log(`马来西亚适用性复查：${report.chapters} 章 / ${report.essays} 篇专题 / ${report.entries} 条建议`);
  for(const r of report.reports) {
    console.log(`${r.file}: ${r.entries||'—'} 条，${r.hits.length} 个待查命中，${r.formatErrors.length} 个结构错误`);
    if(detail) for(const h of r.hits) console.log(`  L${h.line}${h.entry?' 第'+h.entry+'条':''} [${h.rule}] ${h.snippet}`);
  }
  console.log(`结构错误：${report.formatErrors.length}；待查命中：${report.findings.length}；涉及正文条目：${report.affectedEntries.length}`);
  console.log('命中是人工核查线索；未命中不等于已适用或已核实。境外医学研究可保留，境外法律不得作为本地制度依据。');
  for(const e of report.formatErrors) console.error(e);
  process.exitCode = report.formatErrors.length || report.findings.length ? 1 : 0;
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) main();
