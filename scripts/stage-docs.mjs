// Stages the docs for the GitHub Pages site (.github/workflows/docs.yml): the
// README, docs/, Tyrell's README and tyrell/docs/, copied into a folder at the
// same paths, so their links to each other keep working and Jekyll turns each
// `.md` link into a link to its page. A link that leaves the docs (to the
// source, an example, the license) is pointed at GitHub instead. Then the
// site's layout (docs/site) goes beside them. The docs stay plain Markdown
// that reads on GitHub.
//
//   node scripts/stage-docs.mjs <out> [https://github.com/owner/repo/blob/main]
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, '_staged');
const blob = (process.argv[3] || 'https://github.com/doctorallen/tycho/blob/main').replace(/\/$/, '');
const tree = blob.replace('/blob/', '/tree/');

// what's staged: every Markdown file under these, at its own path
const SOURCES = ['README.md', 'docs', 'tyrell/README.md', 'tyrell/docs'];
const pages = [];
const walk = (p) => {
  const abs = join(root, p);
  if (statSync(abs).isDirectory()) { for (const f of readdirSync(abs).sort()) if (f !== 'site') walk(posix.join(p, f)); }
  else if (p.endsWith('.md')) pages.push(p);
};
for (const s of SOURCES) walk(s);
const staged = new Set(pages);
const isDir = (p) => existsSync(join(root, p)) && statSync(join(root, p)).isDirectory();

// a relative link from page `from` to `target`: kept if it lands on a staged
// page (or a folder whose README is staged), else pointed at GitHub
function relink(from, target) {
  if (/^([a-z]+:|#|\/)/i.test(target)) return target;
  const [path, hash = ''] = target.split('#');
  const anchor = hash ? '#' + hash : '';
  const to = posix.normalize(posix.join(posix.dirname(from), path)).replace(/\/$/, '');
  if (to === '' || to === '.') return target;
  if (staged.has(to)) return target;
  if (isDir(to) && staged.has(posix.join(to, 'README.md'))) return target;
  if (to.startsWith('..')) return target; // (outside the repository: leave it)
  return (isDir(to) ? `${tree}/${to}` : `${blob}/${to}`) + anchor;
}

let changed = 0;
for (const p of pages) {
  const text = readFileSync(join(root, p), 'utf8');
  // links outside code: fenced blocks and inline code are left as they are
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]*`)/);
  const done = parts.map((part, i) => (i % 2 ? part : part.replace(/(\]\()([^)\s]+)(\))/g, (m, a, t, b) => {
    const n = relink(p, t);
    if (n !== t) changed++;
    return a + n + b;
  }))).join('');
  // (Jekyll runs Liquid over every page: one that shows {{ or {% as text
  // is held as raw after its title, which stays the page's title)
  let body = done;
  if (/\{\{|\{%/.test(body)) body = body.replace(/^(#[^\n]*\n)?/, (h) => h + '{% raw %}\n') + '\n{% endraw %}\n';
  const dest = join(out, p);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, body);
}
// the layout, the stylesheet, the config and the pictures
cpSync(join(root, 'docs/site'), out, { recursive: true });
console.log(`staged ${pages.length} pages into ${relative(root, normalize(out)) || out}, ${changed} links pointed at GitHub`);
