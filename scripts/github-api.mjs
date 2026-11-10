/** GitHub REST helpers shared by the non-AI automation. */
export const SHA = /^[a-f0-9]{40}$/;
export const UPSTREAM = 'eternity4719/HowToLiveBetter';
export const ISSUE_MARKER = '<!-- upstream-sync:v1 -->';
export const REVIEW_MARKER = '<!-- localization-review:v1 -->';
export const repoPath = repo => {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Expected owner/repository');
  return `/repos/${repo}`;
};

export function github(token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN, fetcher = fetch) {
  async function request(route, {method = 'GET', body} = {}) {
    if (!route.startsWith('/')) throw new Error('GitHub route must be relative');
    const response = await fetcher(`https://api.github.com${route}`, {
      method, signal: AbortSignal.timeout(30_000),
      headers: {Accept: 'application/vnd.github+json', 'User-Agent': 'HowToLiveBetter-MY',
        'X-GitHub-Api-Version': '2022-11-28', ...(token ? {Authorization: `Bearer ${token}`} : {}),
        ...(body === undefined ? {} : {'Content-Type': 'application/json'})},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    if (!response.ok) throw new Error(`GitHub ${method} ${route}: HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  }
  async function list(route, key) {
    const rows = [];
    for (let page = 1; ; page++) {
      const result = await request(`${route}${route.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      const batch = key ? result[key] : result;
      if (!Array.isArray(batch)) throw new Error(`Expected paginated list: ${route}`);
      rows.push(...batch);
      if (batch.length < 100) return rows;
      if (page >= 100) throw new Error('Pagination limit reached; refusing partial results');
    }
  }
  async function file(repo, path, ref) {
    const result = await request(`${repoPath(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`);
    if (result.type !== 'file' || result.encoding !== 'base64' || typeof result.content !== 'string') throw new Error(`Unreadable file: ${path}`);
    return Buffer.from(result.content, 'base64').toString('utf8');
  }
  return {request, list, file};
}

export function readMarker(body, marker) {
  if (typeof body !== 'string') throw new Error('Missing automation record');
  const start = body.indexOf(marker);
  if (start < 0 || body.indexOf(marker, start + marker.length) !== -1) throw new Error('Missing or duplicate automation marker');
  const match = /^\s*```json\s*\n([\s\S]*?)\n```/.exec(body.slice(start + marker.length));
  if (!match) throw new Error('Expected JSON block immediately after automation marker');
  return JSON.parse(match[1]);
}
export function markerBody(marker, data) {
  return `${marker}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}
