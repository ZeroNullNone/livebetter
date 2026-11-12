// Focused regression for the 2026-11 fact-check patch. Not a factual-certification test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=process.env.SITE_ROOT || path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sc=read('assets/selfcheck.js');
const qs=vm.runInNewContext(sc.slice(0,sc.indexOf('const MODS ='))+'; GROUPS.flatMap(g=>g.qs)');
const glucose=qs.find(q=>q.sec===1&&q.n===8);
for(const age of [18,25,30,32,34,35,60]) assert.ok(glucose.when({ageYears:age}),`Screening guidance visible to adult ${age}`);
assert.equal(glucose.when({ageYears:17}),false);
assert.match(glucose.hint,/30 岁起每年/);
assert.match(glucose.hint,/高危成人/);
assert.equal(glucose.rev,2);
const alcohol=qs.find(q=>q.sec===34&&q.n===11);
assert.equal(alcohol.rev,2);assert.match(alcohol.text,/具体药物/);
const html=read('index.html'),reader=read('assets/reader.js');
const essays=[...html.matchAll(/href="([^"]+\/docs\/[^\"]+\.md)"/g)].map(m=>m[1]);
assert.equal(essays.length,9);
for(const href of essays) assert.ok(href.startsWith('https://github.com/ZeroNullNone/livebetter/blob/main/docs/'));
assert.match(reader,/const REPO_BLOB = 'https:\/\/github.com\/ZeroNullNone\/livebetter\/blob\/main\/'/);
assert.match(html,/原作 HowToLiveBetter/); // retain attribution
console.log('Audit regression passed: revised screening/medication prompts and localized link fallbacks.');

// Exercise the actual modal opener without Chromium: source links must be populated,
// visible and updated when another essay is opened. Existing browser CI checks rendering.
const modalCode=reader.slice(reader.indexOf('async function dmOpen('),reader.indexOf("document.addEventListener('click', ev => {",reader.indexOf('async function dmOpen(')));
const dm={mask:{hidden:true},toc:{textContent:''},heads:[],title:{textContent:''},doc:{innerHTML:'',scrollTop:0},gh:{href:'',hidden:true}};
const sandbox={DM:dm,REPO_BLOB:'https://github.com/ZeroNullNone/livebetter/blob/main/',setOverlay:()=>{},document:{getElementById:()=>({focus(){}})},readText:async()=>'',loadBook:async()=>{},dmRender:()=>({html:'<h2>Ready</h2>',heads:[]}),dmXrefs:()=>{},dmSpy:()=>{},esc:String};
vm.createContext(sandbox);vm.runInContext(modalCode,sandbox);
for(const file of ['docs/家庭应急装备清单.md','docs/刚确诊慢性病之后.md']){
  await sandbox.dmOpen(file,null);
  assert.equal(dm.gh.href,'https://github.com/ZeroNullNone/livebetter/blob/main/'+file.split('/').map(encodeURIComponent).join('/'));
  assert.equal(dm.gh.hidden,false);
}
const salt=read(fs.readdirSync(path.join(root,'book')).filter(f=>f.startsWith('02-')).map(f=>'book/'+f)[0]).split('### 9.')[1].split('### 10.')[0];
assert.match(salt,/rate ratio 0.88/);assert.match(salt,/每 1,000 人年/);
assert.doesNotMatch(salt,/死亡的概率低约 12%|死亡风险低约 12%|健康年轻人换盐得到的好处要小得多/);
assert.match(read('.github/workflows/merge-sync.yml'),/cron: '30 3 \* \* 1'/);
assert.match(read('.github/workflows/merge-sync.yml'),/vars.AUTO_MERGE_SYNC == 'enabled'/);
console.log('Follow-up regression passed: modal source links, salt rate denominator, Monday cron with unchanged enable gate.');
