/** Deterministic merge/publication gates. Never executes code from a PR. */
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {github, SHA, ISSUE_MARKER, REVIEW_MARKER, readMarker, repoPath} from './github-api.mjs';
import {validateMigration, digest} from './validate-sync.mjs';

export const PR_MARKER = '<!-- sync-pr:v1 -->';
const names = value => (value || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const trusted = (login, allow) => allow.includes((login || '').toLowerCase());

export function reviewFor(comments, allow, pr, issue) {
  const candidates = comments.filter(c => trusted(c.user?.login, allow) && c.body?.includes(REVIEW_MARKER))
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || b.id - a.id);
  if (!candidates.length) throw new Error('No trusted AI review');
  const review = readMarker(candidates[0].body, REVIEW_MARKER);
  if (review.version !== 1 || review.issue !== issue || review.headSha !== pr.head.sha || review.baseSha !== pr.base.sha) throw new Error('AI review is stale or for another task');
  if (review.verdict !== 'APPROVE' || review.sourcesChecked !== true || !review.summary?.trim() || !Array.isArray(review.findings) || review.findings.length) throw new Error('AI review did not successfully approve');
  return review;
}

export function checkCI(runs, statuses) {
  const latest = new Map();
  for (const run of [...runs].sort((a, b) => a.id - b.id)) latest.set(`${run.app?.id}:${run.name}`, run);
  const required = [...latest.values()].filter(r => r.name === 'Content checks' && r.app?.slug === 'github-actions');
  if (required.length !== 1 || required[0].status !== 'completed' || required[0].conclusion !== 'success') throw new Error('Required Content checks did not succeed');
  for (const run of latest.values()) if (run.status !== 'completed' || !['success', 'neutral', 'skipped'].includes(run.conclusion)) throw new Error(`Check is not green: ${run.name}`);
  if (statuses.total_count && statuses.state !== 'success') throw new Error('Commit status is not green');
}

export async function mergeCandidate(api, repo, number, {authors, reviewers}) {
  const route = repoPath(repo);
  const pr = await api.request(`${route}/pulls/${number}`);
  const metadata = await api.request(route);
  if (pr.state !== 'open' || pr.draft || pr.base.ref !== metadata.default_branch || pr.head.repo?.full_name !== repo || !trusted(pr.user?.login, authors)) throw new Error('Not an eligible trusted sync PR');
  if (!SHA.test(pr.head.sha) || !SHA.test(pr.base.sha) || pr.mergeable !== true || pr.mergeable_state !== 'clean') throw new Error('PR is not cleanly mergeable');
  if (/\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)\s+#\d+/i.test(pr.body || '')) throw new Error('Do not close an issue before publication');
  const {issue: issueNumber} = readMarker(pr.body, PR_MARKER);
  if (!Number.isSafeInteger(issueNumber) || issueNumber < 1) throw new Error('Invalid sync issue');
  const issue = await api.request(`${route}/issues/${issueNumber}`);
  if (issue.pull_request || issue.state !== 'open' || issue.user?.login !== 'github-actions[bot]') throw new Error('Sync issue is not an open checker-created issue');
  const batch = readMarker(issue.body, ISSUE_MARKER);
  if (pr.head.ref !== `sync/upstream-${batch.targetSha}`) throw new Error('Unexpected sync branch');
  const changes = await api.list(`${route}/pulls/${number}/files`);
  if (changes.length !== pr.changed_files || changes.length >= 3000) throw new Error('Incomplete PR file list');
  const before = {}, after = {};
  for (const file of new Set([...changes.map(f => f.filename), '.upstream_sync.json'])) {
    const change = changes.find(f => f.filename === file);
    if (change?.status === 'renamed' || change?.status === 'removed') throw new Error('MVP does not merge deleted/renamed files');
    before[file] = change?.status === 'added' ? null : await api.file(repo, file, pr.base.sha);
    after[file] = await api.file(repo, file, pr.head.sha);
  }
  const record = validateMigration({files: changes.map(f => f.filename), before, after});
  if (record.issue !== issueNumber || record.baseSha !== batch.baseSha || record.targetSha !== batch.targetSha) throw new Error('PR does not implement the frozen issue batch');
  const comments = await api.list(`${route}/issues/${number}/comments`);
  reviewFor(comments, reviewers, pr, issueNumber);
  const runs = await api.list(`${route}/commits/${pr.head.sha}/check-runs`, 'check_runs');
  const statuses = await api.request(`${route}/commits/${pr.head.sha}/status`);
  checkCI(runs, statuses);
  // Demand CI from this repository's actual PR workflow, not merely a matching
  // check name. Newer queued/failed reruns must invalidate an old success.
  const workflowRuns = await api.list(`${route}/actions/runs?head_sha=${pr.head.sha}&event=pull_request`, 'workflow_runs');
  const validation = workflowRuns.filter(r => r.path === '.github/workflows/validate-pr.yml').sort((a, b) => b.id - a.id || b.run_attempt - a.run_attempt)[0];
  if (!validation || validation.status !== 'completed' || validation.conclusion !== 'success') throw new Error('Trusted PR validation workflow is missing/pending/failed');
  const fresh = await api.request(`${route}/pulls/${number}`);
  const base = await api.request(`${route}/git/ref/heads/${encodeURIComponent(metadata.default_branch)}`);
  if (fresh.head.sha !== pr.head.sha || fresh.base.sha !== pr.base.sha || base.object.sha !== pr.base.sha || fresh.mergeable !== true || fresh.mergeable_state !== 'clean') throw new Error('PR/base changed during review; revalidate');
  // Expected SHA protects against a push racing this final request. Repository
  // rules remain in force; the bot must have no bypass permission.
  const merged = await api.request(`${route}/pulls/${number}/merge`, {method: 'PUT', body: {sha: pr.head.sha, merge_method: 'squash'}});
  if (merged.merged !== true || !SHA.test(merged.sha ?? '')) throw new Error('GitHub did not confirm the merge');
  console.log(`Merged #${number} at ${merged.sha}; issue #${issueNumber} remains open until publication`);
  // GITHUB_TOKEN merges do not trigger push workflows. Explicit dispatch does;
  // verify the latest default branch, including any intervening commits.
  try {
    await api.request(`${route}/actions/workflows/verify-publication.yml/dispatches`, {method: 'POST', body: {ref: metadata.default_branch}});
  } catch (cause) {
    throw Object.assign(new Error(`PR #${number} merged, but publication dispatch failed. Run Verify publication on the latest default branch: ${cause.message}`, {cause}), {code: 'PUBLICATION_DISPATCH_FAILED'});
  }
  return merged;
}

export async function verifyPublished(site, commit, expected, fetcher = fetch) {
  const root = new URL(site);
  if (root.protocol !== 'https:' || root.username || root.password || root.search || root.hash) throw new Error('PUBLIC_SITE_URL must be a credential-free HTTPS URL');
  if (!root.pathname.endsWith('/')) root.pathname += '/';
  async function read(file) {
    const url = new URL(file, root); url.searchParams.set('version', commit);
    const response = await fetcher(url, {cache: 'no-store', signal: AbortSignal.timeout(30_000)});
    if (!response.ok) throw new Error(`Publication unavailable: ${file} (HTTP ${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }
  const version = JSON.parse((await read('version.json')).toString());
  if (version.version !== 1 || version.commit !== commit || Object.keys(version.files ?? {}).length !== Object.keys(expected).length) throw new Error('Expected version is not published yet');
  for (const [file, hash] of Object.entries(expected)) {
    if (version.files[file] !== hash || digest(await read(file)) !== hash) throw new Error(`Published resource mismatch: ${file}`);
  }
}

export async function closePublishedIssue(api, repo, commit, root) {
  const state = JSON.parse(fs.readFileSync(path.join(root, '.upstream_sync.json'), 'utf8'));
  const recordFile = path.join(root, `artifacts/sync/${state.lastAppliedSha}.json`);
  if (!SHA.test(state.lastAppliedSha ?? '') || !fs.existsSync(recordFile)) return; // initial/manual publication
  const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
  const route = repoPath(repo);
  const issue = await api.request(`${route}/issues/${record.issue}`);
  if (issue.state === 'closed') return;
  if (issue.user?.login !== 'github-actions[bot]') throw new Error('Not a checker-created issue');
  const batch = readMarker(issue.body, ISSUE_MARKER);
  if (batch.targetSha !== state.lastAppliedSha || batch.baseSha !== record.baseSha) throw new Error('Published issue and migration do not match');
  await api.request(`${route}/issues/${record.issue}/comments`, {method: 'POST', body: {body: `已验证发布：${commit}\n\n${process.env.PUBLIC_SITE_URL}\n\n上游版本：${state.lastAppliedSha}`}});
  await api.request(`${route}/issues/${record.issue}`, {method: 'PATCH', body: {state: 'closed', state_reason: 'completed'}});
}

async function main() {
  const mode = process.argv[2];
  const repo = process.env.GITHUB_REPOSITORY;
  if (mode === 'merge') {
    if (process.env.AUTO_MERGE_SYNC !== 'enabled') {console.log('Automatic merging disabled'); return;}
    const authors = names(process.env.SYNC_AUTHORS), reviewers = names(process.env.SYNC_REVIEWERS);
    if (!authors.length || !reviewers.length || !(process.env.GITHUB_TOKEN || process.env.GH_TOKEN)) throw new Error('Configure trusted authors/reviewers and GITHUB_TOKEN');
    const api = github(), route = repoPath(repo);
    const pulls = await api.list(`${route}/pulls?state=open`);
    const eligible = pulls.filter(p => p.body?.includes(PR_MARKER) && trusted(p.user?.login, authors));
    for (const pr of eligible) {
      try {await mergeCandidate(api, repo, pr.number, {authors, reviewers});}
      catch (error) {
        if (error.code === 'PUBLICATION_DISPATCH_FAILED') throw error;
        console.log(`PR #${pr.number}: ${error.message}`);
      }
      // One candidate per poll: never start a second migration concurrently.
      break;
    }
  } else if (mode === 'verify') {
    const root = process.env.SITE_ROOT || path.resolve(import.meta.dirname, '..');
    const version = JSON.parse(fs.readFileSync(path.join(root, 'dist/version.json'), 'utf8'));
    if (!SHA.test(version.commit) || version.commit !== process.env.GITHUB_SHA) throw new Error('Build must match GITHUB_SHA');
    // Bounded deployment wait; failures preserve the open Issue for a rerun.
    for (let attempt = 0; ; attempt++) {
      try {await verifyPublished(process.env.PUBLIC_SITE_URL, version.commit, version.files); break;}
      catch (error) {
        if (attempt >= 19) throw error;
        console.log(`Waiting for deployment (${attempt + 1}/20): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 15_000));
      }
    }
    await closePublishedIssue(github(), repo, version.commit, root);
    console.log(`Verified publication ${version.commit}`);
  } else throw new Error('Usage: node scripts/sync-automation.mjs merge|verify');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {console.error(error.message); process.exitCode = 1;});
}
