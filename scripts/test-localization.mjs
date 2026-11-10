import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {audit, scanText} from './status-my.mjs';
import {entries, digest, checkReferences} from './validate-sync.mjs';
import {SHA} from './github-api.mjs';
const root = process.env.SITE_ROOT || path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
for (const text of [
  '- 收益：马来西亚读者照民法典办理，材料不需要另外准备。',
  '- 来源：全国人大. 民法典. <https://www.spp.gov.cn/>',
  '### 1. 有人倒下打 999 和 120',
  '- 来源：房地产经纪管理办法。',
  '- 收益：适用 Electronic Trade Transactions) Regulations 2012。',
  '- 备注：待核实：马来西亚适用性。',
]) assert.ok(scanText(text, 'book/01-fixture.md').hits.length, text);
assert.equal(scanText('- 来源：医学研究（中国样本）. <https://doi.org/10.1234/example>', 'docs/study.md').hits.length, 0);
const report = audit(root);
// This MVP preserves numbering: reader state and self-check questions use it.
assert.equal(report.chapters, 34); assert.equal(report.essays, 9); assert.equal(report.entries, 772);
assert.deepEqual(report.formatErrors, []); assert.deepEqual(report.findings, []);
const texts = Object.fromEntries(['book', 'docs'].flatMap(dir => fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.md')).map(f => [`${dir}/${f}`, read(`${dir}/${f}`)])));
checkReferences({...texts, 'README.md': read('README.md')});
for (const [file, text] of Object.entries(texts)) {
  assert.ok(!text.includes('\u5927\u9a6c'), file);
  if (!file.startsWith('book/')) continue;
  for (const entry of entries(text)) {
    assert.match(entry.text, /^- 证据等级：[ABC](?![A-Z])/m, `${file}:${entry.number} grade`);
    assert.match(entry.text, /^- 来源：\S.+/m, `${file}:${entry.number} source`);
    const tags = /^<!-- 成本标签: (.+) -->$/m.exec(entry.text)?.[1];
    for (const tag of [/钱=(0|少|多)(?: |$)/, /时间=(少|中|多)(?: |$)/, /毅力=(否|些|是)(?: |$)/, /收益=(大|中|小)(?: |$)/, /口径=(死亡率|金钱|时间|自由)(?: |$)/]) assert.match(tags, tag, `${file}:${entry.number} cost tag`);
  }
}
JSON.parse(read('updates.json'));
const history = JSON.parse(read('artifacts/localization-verification-20261110.json'));
assert.equal(history.baselineCount, 156); assert.equal(history.resolvedCount, 156);
assert.equal(history.entries.length, 156); assert.equal(new Set(history.entries.map(e => e.id)).size, 156);
const syncDir = path.join(root, 'artifacts/sync');
const migrations = fs.existsSync(syncDir) ? fs.readdirSync(syncDir).filter(f => /^[a-f0-9]{40}\.json$/.test(f)).map(f => JSON.parse(read(`artifacts/sync/${f}`))) : [];
// Original review evidence remains immutable. A new factual revision needs a
// separate record matching the exact current text, rather than an old title or
// amount being hardcoded forever into a regression test.
for (const row of history.entries) {
  assert.equal(row.status, 'reviewed-and-rewritten'); assert.match(row.contentSha256, /^[a-f0-9]{64}$/);
  assert.ok(row.sourceIds.length && row.sourceIds.every(id => history.sources[id]?.url));
  const number = Number(row.id.split('-')[1]);
  const current = entries(texts[row.file]).find(e => e.number === number);
  assert.ok(current, row.id);
  if (digest(current.text) === row.contentSha256) continue;
  const revision = migrations.flatMap(m => SHA.test(m.targetSha ?? '') ? m.entries ?? [] : [])
    .find(e => e.file === row.file && e.number === number && e.sha256 === digest(current.text));
  assert.ok(revision?.sources?.length && revision.sources.every(url => current.text.includes(url)), `${row.id}: changed historical content needs current evidence`);
}
console.log(`Localization checks passed: ${report.entries} stable entries, citations, references and immutable historical evidence.`);
console.log('Structural checks and migration records do not independently establish factual correctness.');
