#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {github, UPSTREAM, SHA, ISSUE_MARKER, markerBody, readMarker, repoPath} from './github-api.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
export const relevant = name => name === 'README.md' || /^(book|docs)\/.*\.md$/.test(name);
export function validateState(state, initialized = true) {
  if (state.version !== 1 || state.repo !== UPSTREAM || (state.lastAppliedSha !== null && !SHA.test(state.lastAppliedSha))) throw new Error('Invalid .upstream_sync.json');
  if (initialized && !SHA.test(state.lastAppliedSha ?? '')) throw new Error('Set a verified upstream baseline first: node scripts/check-upstream.mjs --init-sha <full-sha>');
  return state;
}

export async function compareUpstream(api, base, target) {
  if (!SHA.test(base) || !SHA.test(target)) throw new Error('Compare requires full commit SHAs');
  if (base === target) return [];
  const route = `${repoPath(UPSTREAM)}/compare/${base}...${target}`;
  const first = await api.request(`${route}?per_page=100&page=1`);
  if (first.status !== 'ahead' || first.merge_base_commit?.sha !== base) throw new Error('Upstream diverged or baseline is not an ancestor; reconcile before continuing');
  // Compare caps its file list at 300. Walk all commits and their paginated
  // file lists instead; refuse GitHub's 3000-file commit ceiling.
  const commits = [...first.commits];
  for (let page = 2; commits.length < first.total_commits; page++) {
    const next = await api.request(`${route}?per_page=100&page=${page}`);
    if (!next.commits?.length) throw new Error('Incomplete upstream commit comparison');
    commits.push(...next.commits);
  }
  if (commits.length !== first.total_commits) throw new Error('Unexpected upstream commit count');
  const changed = new Map();
  for (const commit of commits) {
    if (!SHA.test(commit.sha)) throw new Error('Invalid upstream commit SHA');
    for (let page = 1; ; page++) {
      const detail = await api.request(`${repoPath(UPSTREAM)}/commits/${commit.sha}?per_page=100&page=${page}`);
      if (!Array.isArray(detail.files)) throw new Error('Missing upstream file list');
      for (const file of detail.files) {
        if (relevant(file.filename) || relevant(file.previous_filename ?? '')) changed.set(`${file.previous_filename ?? ''}\0${file.filename}`, {
          filename: file.filename, ...(file.previous_filename ? {previous_filename: file.previous_filename} : {}), status: file.status,
        });
      }
      if (detail.files.length < 100) break;
      if (page >= 30) throw new Error('Commit file limit reached; refusing a potentially truncated diff');
    }
  }
  return [...changed.values()].sort((a, b) => a.filename.localeCompare(b.filename));
}

export async function checkUpstream(api, state) {
  validateState(state);
  const [latest] = await api.request(`${repoPath(UPSTREAM)}/commits?per_page=1`);
  if (!SHA.test(latest?.sha ?? '')) throw new Error('Missing upstream HEAD');
  return {version: 1, repo: UPSTREAM, baseSha: state.lastAppliedSha, targetSha: latest.sha,
    files: await compareUpstream(api, state.lastAppliedSha, latest.sha)};
}

export async function upsertIssue(api, repo, report) {
  const route = repoPath(repo);
  // Freeze one open batch's target. A later upstream push must not change
  // the task underneath its author/reviewer.
  const issues = (await api.list(`${route}/issues?state=open&creator=github-actions%5Bbot%5D`))
    .filter(issue => !issue.pull_request && issue.body?.includes(ISSUE_MARKER));
  if (issues.length > 1) throw new Error('Multiple open sync batches; resolve duplicates first');
  if (issues.length) {
    const existing = readMarker(issues[0].body, ISSUE_MARKER);
    if (existing.baseSha !== report.baseSha) throw new Error('Open sync issue has a stale baseline; verify publication and reconcile it first');
    console.log(`Continue existing batch: ${issues[0].html_url}`);
    return issues[0];
  }
  if (!report.files.length) return null;
  const body = `${markerBody(ISSUE_MARKER, report)}\n\n## 迁移任务\n\n比较 [上游变化](https://github.com/${UPSTREAM}/compare/${report.baseSha}...${report.targetSha})，按 AUTOMATION.md、.github/automation/author.md 完成本地化并创建 PR。\n\n不要直接覆盖本地内容；不要在 PR 中使用 Closes/Fixes，发布验证成功后才关闭本 Issue。\n\n## 验收\n\n- 保持现有条号、文件与交叉引用稳定\n- 保存迁移来源记录，无法核实则停止\n- 当前提交通过 CI 和独立 AI 复核\n- 线上 version.json 与合并提交一致后才完成\n`;
  return api.request(`${route}/issues`, {method: 'POST', body: {title: `[Upstream] ${report.targetSha.slice(0, 12)}：马来西亚内容迁移`, body}});
}

async function main() {
  const stateFile = path.join(ROOT, '.upstream_sync.json');
  const state = validateState(JSON.parse(fs.readFileSync(stateFile, 'utf8')), false);
  if (process.argv.includes('--init-sha')) {
    const sha = process.argv[process.argv.indexOf('--init-sha') + 1];
    if (state.lastAppliedSha !== null || !SHA.test(sha ?? '')) throw new Error('Initialization requires an empty baseline and a full, independently verified SHA');
    const commit = await github().request(`${repoPath(UPSTREAM)}/commits/${sha}`);
    if (commit.sha !== sha) throw new Error('Upstream did not confirm the baseline');
    fs.writeFileSync(stateFile, JSON.stringify({...state, lastAppliedSha: sha}, null, 2) + '\n');
    console.log('Baseline initialized. This verifies the commit exists, not that its content was migrated.');
    return;
  }
  const api = github();
  const report = await checkUpstream(api, state);
  console.log(JSON.stringify(report, null, 2));
  if (process.argv.includes('--issue')) {
    if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) throw new Error('Issue mode requires GITHUB_TOKEN and GITHUB_REPOSITORY');
    const issue = await upsertIssue(api, process.env.GITHUB_REPOSITORY, report);
    if (issue) console.log(issue.html_url);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {console.error(error.message); process.exitCode = 1;});
}
