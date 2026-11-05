// Writes the script tags at the end of each study page (docs/study/*.md) from the demos the page
// shows: the kit, then for each `data-demo` its group's shared file (if it has one) and its own
// file, then start.js. Which file registers which demo, and what it needs first, is read from the
// demos themselves: `Kit.register('name'` registers, `StudyShared.<group>` needs <group>-shared.js,
// and `window.Flora` needs flora.js. Fails on a demo no file registers.
//
//   node scripts/study-pages.mjs          rewrite the pages' script blocks
//   node scripts/study-pages.mjs --check  only report pages whose block is out of date
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const study = join(root, 'docs/study'), demos = join(study, 'demos');
const check = process.argv.includes('--check');

// each demo's file, and the files it needs before its own
const fileOf = new Map(), needs = new Map();
for (const f of readdirSync(demos).filter((f) => f.endsWith('.js')).sort()) {
  const text = readFileSync(join(demos, f), 'utf8');
  const before = [];
  for (const m of text.matchAll(/StudyShared\.(\w+)\s*;/g)) if (!f.endsWith('-shared.js')) before.push(m[1] + '-shared.js');
  if (f !== 'flora.js' && /window\.Flora\b/.test(text)) before.unshift('flora.js');
  for (const m of text.matchAll(/Kit\.register\(\s*'([^']+)'/g)) { fileOf.set(m[1], f); needs.set(f, [...new Set(before)]); }
}

let bad = 0, stale = 0;
for (const page of readdirSync(study).filter((f) => f.endsWith('.md')).sort()) {
  const path = join(study, page), text = readFileSync(path, 'utf8');
  const shown = [...text.matchAll(/data-demo="([^"]+)"/g)].map((m) => m[1]);
  const files = ['kit.js'];
  for (const name of shown) {
    const f = fileOf.get(name);
    if (!f) { console.error(`${page}: no demo file registers "${name}"`); bad++; continue; }
    for (const n of [...needs.get(f), f]) if (!files.includes(n)) files.push(n);
  }
  // the block: every demos/ script tag at the end of the page, replaced as one
  const body = text.replace(/(\n<script src="demos\/[^"]+"><\/script>)+\s*$/, '').replace(/\s+$/, '');
  const block = shown.length ? '\n\n' + files.concat('start.js').map((f) => `<script src="demos/${f}"></script>`).join('\n') : '';
  const next = body + block + '\n';
  if (next !== text) { stale++; if (check) console.log(`${page}: script block out of date`); else writeFileSync(path, next); }
}
console.log(`${check ? 'checked' : 'wrote'} the study's pages: ${stale} ${check ? 'out of date' : 'changed'}${bad ? `, ${bad} unknown demos` : ''}`);
process.exit(bad || (check && stale) ? 1 : 0);
