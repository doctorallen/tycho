#!/usr/bin/env node
// Runs the Voight-Kampff behavior tests on a world from the command line.
//
//   node bin/voight-kampff.mjs examples/rocinante.js [--days 7] [--seed s] [--json] [--baseline file.json] [--save file.json]
//
// The setup file exports a function (Tyrell, { seed }) => world, as
// examples/rocinante.js does.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as Tyrell from '../../dist/tyrell.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const file = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
if (!file) { console.error('usage: voight-kampff <setup.js> [--days n] [--seed s] [--json] [--baseline file] [--save file]'); process.exit(2); }
const require = createRequire(import.meta.url);
let build = require(resolve(file));
if (build.default) build = build.default;

const report = Tyrell.VoightKampff.run({ build: (seed) => build(Tyrell, { seed }), days: Number(opt('days', 3)), seed: opt('seed', 'voight-kampff') });
if (opt('save')) writeFileSync(opt('save'), JSON.stringify(report, null, 2));
if (args.includes('--json')) { console.log(JSON.stringify(report, null, 2)); process.exit(report.passed ? 0 : 1); }

console.log(`Voight-Kampff: ${report.days} days, seed '${report.seed}', ${report.stats.decisions} decisions in ${report.stats.ms} ms`);
console.log(report.passed ? 'passed: they behave like people' : `failed (${report.failures.length}):`);
for (const f of report.failures) console.log('  - ' + f);
const top = Object.entries(report.stats.actions).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log('most chosen: ' + top.map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`).join(', '));
console.log('mood by day: ' + report.stats.mood.map((m) => m.mean.toFixed(2)).join(' '));
let failed = !report.passed;
if (opt('baseline')) {
  const base = JSON.parse(readFileSync(opt('baseline'), 'utf8'));
  const diff = Tyrell.VoightKampff.compare(report, base, Number(opt('tolerance', 0.05)));
  console.log(diff.length ? `differs from the baseline:\n  - ${diff.join('\n  - ')}` : 'matches the baseline');
  if (diff.length) failed = true;
}
process.exit(failed ? 1 : 0);
