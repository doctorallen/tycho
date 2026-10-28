// The layers' rule, checked before every build: each part of the engine uses
// only the layers below it (core, then pixels, world, play, shell), Tyrell
// uses nothing outside tyrell/src (so the minds stay testable without a
// browser and a game without people never loads them), the bridge takes
// only types from either, and the service worker and the test kit stand
// alone. Returns a list of problems, empty when all is well.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const LAYERS = ['core', 'pixels', 'world', 'play', 'shell'];

function files(dir) {
  const out = [];
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.ts$/.test(n) && !/\.d\.ts$/.test(n)) out.push(p);
  }
  return out;
}

// where a file belongs: { zone, layer }
function zoneOf(root, p) {
  const r = relative(root, p).split(/[\\/]/);
  if (r[0] === 'tyrell') return { zone: 'tyrell' };
  if (r[0] === 'minds' || r[0] === 'sw' || r[0] === 'testkit') return { zone: r[0] };
  if (r[0] === 'src') return { zone: 'src', layer: r.length > 2 ? LAYERS.indexOf(r[1]) : LAYERS.length };
  return { zone: 'other' };
}

export function checkLayers(root) {
  const problems = [];
  const dirs = ['src', 'tyrell/src', 'minds', 'sw', 'testkit'].map((d) => join(root, d));
  for (const dir of dirs) {
    let list = [];
    try { list = files(dir); } catch (e) { continue; }
    for (const f of list) {
      const me = zoneOf(root, f), text = readFileSync(f, 'utf8');
      const re = /(^|\n)\s*(import|export)\s+(type\s+)?[^'";]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|(^|\n)\s*import\s+['"]([^'"]+)['"]/g;
      let m;
      while ((m = re.exec(text))) {
        const spec = m[4] || m[5] || m[7], typeOnly = !!m[3];
        if (!spec.startsWith('.')) continue; // a package or node builtin
        const to = zoneOf(root, resolve(dirname(f), spec));
        const at = relative(root, f) + ' imports ' + spec;
        if (me.zone === 'tyrell' && to.zone !== 'tyrell') problems.push(`${at}: Tyrell uses nothing outside tyrell/src`);
        else if (me.zone === 'minds' && to.zone !== 'minds' && !typeOnly) problems.push(`${at}: the bridge takes only types from the engine and Tyrell (import type)`);
        else if ((me.zone === 'sw' || me.zone === 'testkit') && to.zone !== me.zone) problems.push(`${at}: ${me.zone}/ stands alone`);
        else if (me.zone === 'src' && to.zone !== 'src') problems.push(`${at}: the engine uses nothing outside src/`);
        else if (me.zone === 'src' && to.layer > me.layer) problems.push(`${at}: ${LAYERS[me.layer]} may not use ${LAYERS[to.layer] || 'the index'}, a layer above it`);
      }
    }
  }
  return problems;
}
