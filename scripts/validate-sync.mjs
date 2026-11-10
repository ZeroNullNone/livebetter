import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {SHA, UPSTREAM} from './github-api.mjs';
import {validateState} from './check-upstream.mjs';

export const digest = text => createHash('sha256').update(text).digest('hex');
export const allowedContent = file => file === 'README.md' || file === 'updates.json' || /^(book|docs)\/[^/]+\.md$/.test(file);
export function entries(text) {
  return [...text.matchAll(/^### (\d+)\. .*\n[\s\S]*?(?=^### \d+\. |$(?![\s\S]))/gm)]
    .map(match => ({number: Number(match[1]), text: match[0]}));
}

export function validateMigration({files, before, after}) {
  const oldState = validateState(JSON.parse(before['.upstream_sync.json']));
  const state = validateState(JSON.parse(after['.upstream_sync.json']));
  if (state.lastAppliedSha === oldState.lastAppliedSha) throw new Error('Sync PR must advance the upstream baseline');
  if (JSON.stringify(Object.keys(state).sort()) !== JSON.stringify(['lastAppliedSha', 'repo', 'version'])) throw new Error('Unexpected sync state fields');
  const recordPath = `artifacts/sync/${state.lastAppliedSha}.json`;
  const permitted = file => allowedContent(file) || file === '.upstream_sync.json' || file === recordPath;
  if (!files.every(permitted) || !files.includes(recordPath) || !files.includes('.upstream_sync.json')) throw new Error('Sync PR changes protected files or lacks state/evidence');
  if (before[recordPath] != null) throw new Error('Migration evidence must be a new immutable record');
  const record = JSON.parse(after[recordPath]);
  if (record.version !== 1 || record.baseSha !== oldState.lastAppliedSha || record.targetSha !== state.lastAppliedSha || record.repo !== UPSTREAM || !Number.isSafeInteger(record.issue) || record.issue < 1) throw new Error('Migration record does not match the baseline transition');
  if (!Array.isArray(record.sources) || !record.sources.length) throw new Error('Missing checked sources');
  const sources = new Set();
  for (const source of record.sources) {
    const url = new URL(source.url);
    if (url.protocol !== 'https:' || url.username || url.password || !source.title?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt ?? '') || sources.has(source.url)) throw new Error('Invalid or duplicate checked source');
    sources.add(source.url);
  }
  const changedContent = files.filter(allowedContent).sort();
  if (!changedContent.length || !Array.isArray(record.files) || JSON.stringify(record.files.map(row => row.path).sort()) !== JSON.stringify(changedContent)) throw new Error('Evidence must cover exactly the changed content files');
  const sourceRefs = row => Array.isArray(row.sources) && row.sources.length && row.sources.every(url => sources.has(url));
  const changedEntries = [];
  for (const file of changedContent) {
    if (before[file] == null || after[file] == null) throw new Error(`MVP cannot add/delete/rename content: ${file}`);
    const evidence = record.files.find(row => row.path === file);
    if (evidence.sha256 !== digest(after[file]) || !sourceRefs(evidence)) throw new Error(`File evidence is stale or lacks sources: ${file}`);
    if (!file.startsWith('book/')) continue;
    const oldEntries = entries(before[file]), newEntries = entries(after[file]);
    if (!oldEntries.length || JSON.stringify(oldEntries.map(e => e.number)) !== JSON.stringify(newEntries.map(e => e.number))) throw new Error(`MVP must preserve entry numbering: ${file}`);
    for (let i = 0; i < newEntries.length; i++) if (newEntries[i].text !== oldEntries[i].text) changedEntries.push({file, ...newEntries[i]});
  }
  if (!Array.isArray(record.entries) || record.entries.length !== changedEntries.length) throw new Error('Evidence must cover exactly the changed book entries');
  const covered = new Set();
  for (const row of record.entries) {
    const key = `${row.file}:${row.number}`;
    const entry = changedEntries.find(e => e.file === row.file && e.number === row.number);
    if (!entry || covered.has(key) || row.sha256 !== digest(entry.text) || !sourceRefs(row) || !row.sources.every(url => entry.text.includes(url))) throw new Error(`Entry evidence is missing, stale or has uncited sources: ${key}`);
    covered.add(key);
  }
  if (typeof record.notes !== 'string' || !record.notes.trim()) throw new Error('Explain the migration and any applicability decisions in notes');
  return record;
}

export function checkReferences(texts) {
  const targets = new Map();
  for (const [file, text] of Object.entries(texts)) {
    const chapter = /^book\/(\d+)-/.exec(file);
    if (chapter) targets.set(Number(chapter[1]), new Set(entries(text).map(e => e.number)));
  }
  for (const [file, text] of Object.entries(texts)) {
    for (const match of text.matchAll(/见第\s*(\d+)\s*节第\s*(\d+)\s*条/g)) {
      if (!targets.get(Number(match[1]))?.has(Number(match[2]))) throw new Error(`Broken cross-reference in ${file}: ${match[0]}`);
    }
  }
}

function main() {
  const root = process.env.SITE_ROOT || path.resolve(import.meta.dirname, '..');
  const base = process.argv[2];
  if (!SHA.test(base ?? '')) throw new Error('Usage: node scripts/validate-sync.mjs <full-base-sha>');
  const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
  // Compare complete candidate tree to the current base, including deletions.
  const files = git(['diff', '--name-only', '--no-renames', '-z', base, 'HEAD']).split('\0').filter(Boolean);
  const before = {}, after = {};
  const tracked = new Set(git(['ls-tree', '-r', '--name-only', base]).trim().split('\n'));
  for (const file of new Set([...files, '.upstream_sync.json'])) {
    before[file] = tracked.has(file) ? git(['show', `${base}:${file}`]) : null;
    after[file] = fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : null;
  }
  const record = validateMigration({files, before, after});
  const texts = Object.fromEntries(['book', 'docs'].flatMap(dir => fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.md')).map(f => [`${dir}/${f}`, fs.readFileSync(path.join(root, dir, f), 'utf8')])));
  checkReferences({...texts, 'README.md': fs.readFileSync(path.join(root, 'README.md'), 'utf8')});
  console.log(`Sync evidence valid for issue #${record.issue}, upstream ${record.targetSha}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
