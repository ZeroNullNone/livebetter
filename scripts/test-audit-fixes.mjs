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
