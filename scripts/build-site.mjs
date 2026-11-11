import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {SHA} from './github-api.mjs';

const PUBLIC = ['index.html', 'selfcheck.html', 'README.md', 'updates.json', 'LICENSE', 'LICENSE-CODE', 'assets', 'book', 'docs'];
export function buildSite(root, commit) {
  if (!SHA.test(commit ?? '')) throw new Error('Build requires the full deployment commit SHA');
  const out = path.join(root, 'dist');
  if (fs.existsSync(out) && fs.lstatSync(out).isSymbolicLink()) throw new Error('dist cannot be a symlink');
  fs.rmSync(out, {recursive: true, force: true});
  fs.mkdirSync(out);
  const hashes = {};
  function copy(relative) {
    const src = path.join(root, relative), dest = path.join(out, relative);
    const stat = fs.lstatSync(src);
    if (stat.isSymbolicLink()) throw new Error(`Public files cannot be symlinks: ${relative}`);
    if (stat.isDirectory()) {
      fs.mkdirSync(dest, {recursive: true});
      for (const name of fs.readdirSync(src).sort()) {
        if (name.startsWith('.')) continue;
        copy(`${relative}/${name}`);
      }
    } else {
      if (!/\.(html|md|json|js|css|svg|jpg|png|webp|ico|woff2?)$/.test(relative) && !['LICENSE', 'LICENSE-CODE'].includes(relative)) throw new Error(`Unexpected public asset: ${relative}`);
      let data = fs.readFileSync(src);
      // Version local JS/CSS URLs, including module imports and new URL() loaders.
      // Only the build output changes; hash the final bytes used by publication checks.
      if (/\.(html|js|css)$/.test(relative)) {
        data = Buffer.from(data.toString('utf8').replace(
          /(["'`])((?![a-z][a-z\d+.-]*:|\/\/)[^"'`\s<>?#]+?\.(?:js|css))(\?[^"'`\s<>#]*)?(#[^"'`\s<>]*)?\1/gi,
          (_, quote, asset, query, fragment) => {
            const params = new URLSearchParams(query);
            params.set('v', commit);
            return `${quote}${asset}?${params}${fragment ?? ''}${quote}`;
          },
        ));
      }
      fs.writeFileSync(dest, data);
      hashes[relative] = createHash('sha256').update(data).digest('hex');
    }
  }
  for (const file of PUBLIC) copy(file);
  // Pages consumes this control file; it is not a public resource to hash.
  // Preserve deployed bytes: Cloudflare JSD injection would break verification.
  fs.writeFileSync(path.join(out, '_headers'), '/*\n  Cache-Control: public, max-age=0, must-revalidate, no-transform\n');
  fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({version: 1, commit, files: hashes}, null, 2) + '\n');
  return hashes;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = process.env.SITE_ROOT || path.resolve(import.meta.dirname, '..');
  const commit = process.env.CF_PAGES_COMMIT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  console.log(`Built ${Object.keys(buildSite(root, commit)).length} public files in dist/`);
}
