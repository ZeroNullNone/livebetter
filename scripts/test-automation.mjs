import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {github, UPSTREAM, ISSUE_MARKER, REVIEW_MARKER, markerBody, readMarker} from './github-api.mjs';
import {validateState, compareUpstream, upsertIssue} from './check-upstream.mjs';
import {validateMigration, entries, digest, checkReferences} from './validate-sync.mjs';
import {reviewFor, checkCI, mergeCandidate, verifyPublished, closePublishedIssue, PR_MARKER} from './sync-automation.mjs';
import {buildSite} from './build-site.mjs';

const A = 'a'.repeat(40), B = 'b'.repeat(40), H = 'c'.repeat(40), M = 'd'.repeat(40);
const file = 'book/01-example.md', source = 'https://www.moh.gov.my/example';
const oldText = `# 1. Example\n\n### 1. Existing title\n- 来源：${source}\n- 收益：Old text\n\n`;
const newText = oldText.replace('Old text', 'New text');
const oldState = {version: 1, repo: UPSTREAM, lastAppliedSha: A};
const state = {...oldState, lastAppliedSha: B};
const recordPath = `artifacts/sync/${B}.json`;
function migration() {
  return {
    files: [file, '.upstream_sync.json', recordPath],
    before: {[file]: oldText, '.upstream_sync.json': JSON.stringify(oldState), [recordPath]: null},
    after: {[file]: newText, '.upstream_sync.json': JSON.stringify(state), [recordPath]: JSON.stringify({
      version: 1, repo: UPSTREAM, issue: 12, baseSha: A, targetSha: B,
      files: [{path: file, sha256: digest(newText), sources: [source]}],
      entries: [{file, number: 1, sha256: digest(entries(newText)[0].text), sources: [source]}],
      sources: [{url: source, title: 'Official example', checkedAt: '2026-11-10'}], notes: 'Reviewed local applicability.',
    })},
  };
}
const batch = {version: 1, repo: UPSTREAM, baseSha: A, targetSha: B, files: [{filename: file, status: 'modified'}]};
function review(overrides = {}) {
  return {id: 1, user: {login: 'reviewer'}, updated_at: '2026-11-10T01:00:00Z', body: markerBody(REVIEW_MARKER, {
    version: 1, issue: 12, headSha: H, baseSha: A, verdict: 'APPROVE', sourcesChecked: true, findings: [], summary: 'Checked changes and sources.', ...overrides,
  })};
}
const green = [{id: 1, name: 'Content checks', status: 'completed', conclusion: 'success', app: {id: 15368, slug: 'github-actions'}}];

test('REST errors cannot masquerade as an empty update; pagination is complete', async () => {
  await assert.rejects(github('', async () => new Response('', {status: 403})).request('/repos/x/y'), /403/);
  const api = github('', async url => new Response(JSON.stringify(new URL(url).searchParams.get('page') === '1' ? Array.from({length: 100}, (_, i) => i) : [100])));
  assert.equal((await api.list('/repos/x/y/issues')).length, 101);
  assert.throws(() => validateState({...oldState, lastAppliedSha: null}), /baseline/);
  assert.throws(() => validateState({...oldState, lastAppliedSha: 'abcdef0'}), /Invalid/);
});

test('upstream handles >300 files and includes README and both sides of renames', async () => {
  const all = Array.from({length: 301}, (_, i) => ({filename: `book/${i}.md`, status: 'modified'}));
  all.push({filename: 'README.md', status: 'modified'}, {filename: 'archive/old.txt', previous_filename: 'docs/old.md', status: 'renamed'});
  const api = {request: async route => route.includes('/compare/')
    ? {status: 'ahead', merge_base_commit: {sha: A}, total_commits: 1, commits: [{sha: B}], files: all.slice(0, 300)}
    : {files: all.slice((Number(new URL('https://example.org' + route).searchParams.get('page')) - 1) * 100, Number(new URL('https://example.org' + route).searchParams.get('page')) * 100)}};
  assert.equal((await compareUpstream(api, A, B)).length, 303);
  assert.deepEqual(await compareUpstream(api, A, A), []);
  await assert.rejects(compareUpstream({request: async () => ({status: 'diverged'})}, A, B), /diverged/);
});

test('upstream follows commit pagination, not just the latest commit', async () => {
  const commits = Array.from({length: 101}, (_, i) => ({sha: i.toString(16).padStart(40, '0')}));
  const api = {request: async route => {
    if (route.includes('/compare/')) return {status: 'ahead', merge_base_commit: {sha: A}, total_commits: 101, commits: route.endsWith('page=1') ? commits.slice(0, 100) : commits.slice(100)};
    return {files: [{filename: route.includes(commits[100].sha) ? 'README.md' : 'code.js', status: 'modified'}]};
  }};
  assert.equal((await compareUpstream(api, A, B))[0].filename, 'README.md');
});

test('one frozen issue batch is reused; stale/duplicate state is refused', async () => {
  let writes = 0;
  const existing = {number: 12, html_url: 'https://github.com/o/r/issues/12', body: markerBody(ISSUE_MARKER, batch)};
  const api = {list: async () => [existing], request: async () => {writes++;}};
  assert.equal(await upsertIssue(api, 'o/r', {...batch, targetSha: H}), existing);
  assert.equal(writes, 0);
  await assert.rejects(upsertIssue({...api, list: async () => [existing, existing]}, 'o/r', batch), /Multiple/);
  await assert.rejects(upsertIssue(api, 'o/r', {...batch, baseSha: H}), /stale/);
  const create = {list: async () => [], request: async (_, options) => {writes++; return options.body;}};
  const made = await upsertIssue(create, 'o/r', batch);
  assert.equal(readMarker(made.body, ISSUE_MARKER).targetSha, B);
  await upsertIssue(create, 'o/r', {...batch, files: []});
  assert.equal(writes, 1);
});

test('migration binds file/entry hashes, numbering and source evidence', () => {
  assert.equal(validateMigration(migration()).issue, 12);
  let m = migration(); m.after[file] += 'unrecorded';
  assert.throws(() => validateMigration(m), /stale/);
  m = migration(); m.files.push('.github/workflows/evil.yml');
  assert.throws(() => validateMigration(m), /protected/);
  m = migration(); m.before[file] = null;
  assert.throws(() => validateMigration(m), /add\/delete/);
  m = migration(); const r = JSON.parse(m.after[recordPath]); r.entries = []; m.after[recordPath] = JSON.stringify(r);
  assert.throws(() => validateMigration(m), /entries/);
  m = migration(); m.after['.upstream_sync.json'] = JSON.stringify(oldState);
  assert.throws(() => validateMigration(m), /advance/);
  checkReferences({[file]: oldText, 'docs/example.md': '见第 1 节第 1 条'});
  assert.throws(() => checkReferences({[file]: oldText, 'README.md': '见第 1 节第 2 条'}), /Broken/);
});

test('latest trusted review must approve the exact head AND base', () => {
  const pr = {head: {sha: H}, base: {sha: A}};
  assert.equal(reviewFor([review()], ['reviewer'], pr, 12).verdict, 'APPROVE');
  assert.throws(() => reviewFor([review({headSha: B})], ['reviewer'], pr, 12), /stale/);
  assert.throws(() => reviewFor([review({baseSha: B})], ['reviewer'], pr, 12), /stale/);
  assert.throws(() => reviewFor([review()], ['someone-else'], pr, 12), /No trusted/);
  const rejection = {...review({verdict: 'REQUEST_CHANGES'}), id: 2, updated_at: '2026-11-10T02:00:00Z'};
  assert.throws(() => reviewFor([review(), rejection], ['reviewer'], pr, 12), /did not/);
  assert.throws(() => reviewFor([review({sourcesChecked: false})], ['reviewer'], pr, 12), /did not/);
  assert.throws(() => readMarker(markerBody(REVIEW_MARKER, {}) + REVIEW_MARKER, REVIEW_MARKER), /duplicate/);
});

test('CI requires a real success and rejects failed/pending reruns', () => {
  checkCI(green, {total_count: 0});
  assert.throws(() => checkCI([], {total_count: 0}), /Required/);
  assert.throws(() => checkCI([{...green[0], conclusion: 'skipped'}], {total_count: 0}), /Required/);
  assert.throws(() => checkCI([...green, {...green[0], id: 2, status: 'queued', conclusion: null}], {total_count: 0}), /Required/);
  assert.throws(() => checkCI(green, {total_count: 1, state: 'failure'}), /status/);
  assert.throws(() => checkCI([{...green[0], app: {id: 2, slug: 'fake'}}], {total_count: 0}), /Required/);
});

function mergeAPI({race = false, reject = false, badCI = false, mergeFailed = false, dispatchFailed = false} = {}) {
  const m = migration(), writes = []; let reads = 0;
  const pr = {number: 3, state: 'open', draft: false, body: markerBody(PR_MARKER, {issue: 12}),
    base: {sha: A, ref: 'main'}, head: {sha: H, ref: `sync/upstream-${B}`, repo: {full_name: 'o/r'}},
    user: {login: 'author'}, changed_files: 3, mergeable: true, mergeable_state: 'clean'};
  const route = '/repos/o/r';
  return {writes, api: {
    file: async (_, f, sha) => sha === A ? m.before[f] : m.after[f],
    list: async url => {
      if (url.includes('/files')) return m.files.map(filename => ({filename, status: filename === recordPath ? 'added' : 'modified'}));
      if (url.includes('/comments')) return [review(reject ? {verdict: 'REQUEST_CHANGES'} : {})];
      if (url.includes('/check-runs')) return green;
      if (url.includes('/actions/runs')) return [{id: 2, run_attempt: 1, path: '.github/workflows/validate-pr.yml', status: 'completed', conclusion: badCI ? 'failure' : 'success'}];
      throw new Error(url);
    },
    request: async (url, options) => {
      if (options) {
        writes.push({url, ...options});
        if (url.endsWith('/dispatches')) {
          if (dispatchFailed) throw new Error('HTTP 403');
          return null;
        }
        return {merged: !mergeFailed, sha: M};
      }
      if (url === route) return {default_branch: 'main'};
      if (url.endsWith('/pulls/3')) {reads++; return race && reads > 1 ? {...pr, head: {...pr.head, sha: B}} : pr;}
      if (url.endsWith('/issues/12')) return {state: 'open', user: {login: 'github-actions[bot]'}, body: markerBody(ISSUE_MARKER, batch)};
      if (url.endsWith('/status')) return {total_count: 0};
      if (url.endsWith('/git/ref/heads/main')) return {object: {sha: A}};
      throw new Error(url);
    },
  }};
}

test('merge gate uses expected SHA; stale/rejected/failed evidence never writes', async () => {
  const options = {authors: ['author'], reviewers: ['reviewer']};
  let mock = mergeAPI(); await mergeCandidate(mock.api, 'o/r', 3, options);
  assert.deepEqual(mock.writes, [
    {url: '/repos/o/r/pulls/3/merge', method: 'PUT', body: {sha: H, merge_method: 'squash'}},
    {url: '/repos/o/r/actions/workflows/verify-publication.yml/dispatches', method: 'POST', body: {ref: 'main'}},
  ]);
  for (const flags of [{race: true}, {reject: true}, {badCI: true}]) {
    mock = mergeAPI(flags); await assert.rejects(mergeCandidate(mock.api, 'o/r', 3, options)); assert.equal(mock.writes.length, 0);
  }
  mock = mergeAPI(); await assert.rejects(mergeCandidate(mock.api, 'o/r', 3, {...options, authors: []})); assert.equal(mock.writes.length, 0);
});

test('publication dispatch requires a confirmed merge and reports post-merge failures', async () => {
  const options = {authors: ['author'], reviewers: ['reviewer']};
  let mock = mergeAPI({mergeFailed: true});
  await assert.rejects(mergeCandidate(mock.api, 'o/r', 3, options), /did not confirm/);
  assert.equal(mock.writes.length, 1);
  mock = mergeAPI({dispatchFailed: true});
  await assert.rejects(mergeCandidate(mock.api, 'o/r', 3, options), {code: 'PUBLICATION_DISPATCH_FAILED', message: /merged, but publication dispatch failed.*HTTP 403/});
  assert.deepEqual(mock.writes.map(w => w.method), ['PUT', 'POST']); // no Issue close or second merge
});

test('publication verifies bytes, not just HTTP 200 or a version label', async () => {
  const expected = {'index.html': digest('home')};
  const response = (commit = M, page = 'home') => async url => new Response(new URL(url).pathname.endsWith('version.json') ? JSON.stringify({version: 1, commit, files: expected}) : page);
  await verifyPublished('https://guide.example/', M, expected, response());
  await assert.rejects(verifyPublished('https://guide.example/', M, expected, response(A)), /version/);
  await assert.rejects(verifyPublished('https://guide.example/', M, expected, response(M, 'SPA fallback')), /mismatch/);
  await assert.rejects(verifyPublished('http://guide.example/', M, expected, response()), /HTTPS/);
  const blocked = async () => new Response('Challenge page', {status: 403, headers: {'cf-ray': 'example-SIN', 'cf-mitigated': 'challenge'}});
  await assert.rejects(verifyPublished('https://guide.example/', M, expected, blocked), /HTTP 403.*cf-ray=example-SIN.*cf-mitigated=challenge/);
});

test('publication paces requests and retries only the rate-limited resource', async () => {
  const files = {'first.md': 'first', 'second.md': 'second'};
  const expected = Object.fromEntries(Object.entries(files).map(([file, body]) => [file, digest(body)]));
  const requested = [], delays = [];
  const fetcher = async url => {
    const file = new URL(url).pathname.slice(1);
    requested.push(file);
    if (file === 'version.json') return new Response(JSON.stringify({version: 1, commit: M, files: expected}));
    if (file === 'second.md' && requested.filter(f => f === file).length === 1) return new Response('Slow down', {status: 429, headers: {'Retry-After': '2'}});
    return new Response(files[file]);
  };
  await verifyPublished('https://guide.example/', M, expected, fetcher, async ms => {delays.push(ms);});
  assert.deepEqual(requested, ['version.json', 'first.md', 'second.md', 'second.md']);
  assert.deepEqual(delays, [1000, 1000, 2000]);
});

test('publication honors Retry-After dates and bounds rate-limit recovery', async t => {
  const now = Date.parse('2026-11-11T00:00:00Z');
  t.mock.method(Date, 'now', () => now);
  for (const {after, failures, delays: expectedDelays, rejects} of [
    {after: new Date(now + 60_000).toUTCString(), failures: 1, delays: [60_000]},
    {after: null, failures: 2, delays: [15_000, 30_000]},
    {after: 'invalid', failures: 1, delays: [15_000]},
    {after: '0', failures: 1, delays: [1000]},
    {after: '301', failures: Infinity, delays: [], rejects: true},
    {after: null, failures: Infinity, delays: [15_000, 30_000, 60_000, 120_000], rejects: true},
  ]) {
    let requests = 0;
    const delays = [];
    const fetcher = async () => ++requests <= failures
      ? new Response('Slow down', {status: 429, headers: after === null ? {} : {'Retry-After': after}})
      : new Response(JSON.stringify({version: 1, commit: M, files: {}}));
    const run = verifyPublished('https://guide.example/', M, {}, fetcher, async ms => {delays.push(ms);});
    if (rejects) await assert.rejects(run, {code: 'RATE_LIMITED', message: /HTTP 429/});
    else await run;
    assert.deepEqual(delays, expectedDelays);
    assert.equal(requests, expectedDelays.length + 1);
  }
});

test('build exports public assets only, with version hashes; never follows symlinks', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-automation-'));
  try {
    for (const f of ['index.html', 'selfcheck.html', 'README.md', 'updates.json', 'LICENSE', 'LICENSE-CODE']) fs.writeFileSync(path.join(root, f), f);
    for (const d of ['assets', 'book', 'docs']) fs.mkdirSync(path.join(root, d));
    fs.writeFileSync(path.join(root, 'assets/style.css'), 'body{}');
    fs.writeFileSync(path.join(root, '.env'), 'secret');
    fs.writeFileSync(path.join(root, 'assets/.env'), 'secret');
    const hashes = buildSite(root, M);
    assert.equal(hashes['assets/style.css'], digest('body{}'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'dist/version.json'))).commit, M);
    assert.match(fs.readFileSync(path.join(root, 'dist/_headers'), 'utf8'), /^\/\*\n  Cache-Control: .*\bno-transform\b/m);
    assert.ok(!Object.hasOwn(hashes, '_headers')); // Pages consumes it instead of serving it
    assert.ok(!fs.existsSync(path.join(root, 'dist/.env')) && !fs.existsSync(path.join(root, 'dist/assets/.env')));
    fs.symlinkSync(path.join(root, '.env'), path.join(root, 'assets/secret.js'));
    assert.throws(() => buildSite(root, M), /symlink/);
    fs.writeFileSync(path.join(root, '.upstream_sync.json'), JSON.stringify(state));
    fs.mkdirSync(path.join(root, 'artifacts/sync'), {recursive: true});
    fs.writeFileSync(path.join(root, recordPath), migration().after[recordPath]);
    const writes = [];
    const api = {request: async (route, options) => {
      if (options) {writes.push({route, ...options}); return {};}
      return {state: 'open', user: {login: 'github-actions[bot]'}, body: markerBody(ISSUE_MARKER, batch)};
    }};
    await closePublishedIssue(api, 'o/r', M, root);
    assert.equal(writes.at(-1).body.state, 'closed');
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});
