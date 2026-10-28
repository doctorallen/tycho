#!/usr/bin/env node
// Runs the Voight-Kampff behavior tests on a world from the command line.
//
//   node bin/voight-kampff.mjs examples/rocinante.js [--days 7] [--seed s] [--with option]... [--check name]... [--json] [--baseline file.json] [--save file.json]
//
// The setup file exports a function (Tyrell, { seed, ...options }) => world,
// as examples/rocinante.js does. `--with bree` passes { bree: true } (any
// option, as many as you like: `--with harm`); `--check interactions` adds a
// check to the usual ones (`--check harm`).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as Tyrell from '../../dist/tyrell.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const all = (name) => args.flatMap((a, i) => (a === '--' + name && args[i + 1] !== undefined ? [args[i + 1]] : []));
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--json'));
if (!file) { console.error('usage: voight-kampff <setup.js> [--days n] [--seed s] [--with option]... [--check name]... [--json] [--baseline file] [--save file]'); process.exit(2); }
const require = createRequire(import.meta.url);
let build = require(resolve(file));
if (build.default) build = build.default;

const options = {};
for (const name of all('with')) options[name] = true;
const extra = all('check');
const checks = extra.length ? ['nobody-starves', 'capacity', 'everyone-sleeps', 'no-stuck', 'deterministic', 'esper', 'save-load', ...extra] : undefined;
const report = Tyrell.VoightKampff.run({ build: (seed) => build(Tyrell, { ...options, seed }), days: Number(opt('days', 3)), seed: opt('seed', 'voight-kampff'), checks });
if (opt('save')) writeFileSync(opt('save'), JSON.stringify(report, null, 2));
if (args.includes('--json')) { console.log(JSON.stringify(report, null, 2)); process.exit(report.passed ? 0 : 1); }

console.log(`Voight-Kampff: ${report.days} days, seed '${report.seed}', ${report.stats.decisions} decisions in ${report.stats.ms} ms`);
console.log(report.passed ? 'passed: they behave like people' : `failed (${report.failures.length}):`);
for (const f of report.failures) console.log('  - ' + f);
const top = Object.entries(report.stats.actions).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log('most chosen: ' + top.map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`).join(', '));
console.log('mood by day: ' + report.stats.mood.map((m) => m.mean.toFixed(2)).join(' '));
const ix = report.stats.interactions;
if (ix) {
  console.log(`interactions: ${ix.exchanges} exchanges, ${ix.turns} turns; ` + Object.entries(ix.outcomes).map(([k, v]) => `${k} ${v}`).join(', '));
  console.log(`  ${ix.escalations} escalated, ${ix.walkedOff} walked off, ${ix.steppedIn} stepped in; ${ix.grudges} grudges and ${ix.feuds} feuds at the end`);
  console.log('  most: ' + Object.entries(ix.kinds).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', '));
}
const hm = report.stats.harm;
if (hm) {
  console.log(`harm: ${hm.harms} harms (` + Object.entries(hm.via).map(([k, v]) => `${k} ${v}`).join(', ') + `); ${hm.fights} fights, ${hm.blows} blows; ${hm.downs} down, ${hm.killed} killed`);
  console.log(`  ${hm.set} traps set, ${hm.sprung} sprung; ${hm.tainted} taints, ${hm.doses} doses eaten; ${hm.suspicions} suspicions (${hm.right} right, ${hm.wrong} wrong); ${hm.tended} tendings; ${hm.wounds} wounds open at the end`);
}
let failed = !report.passed;
if (opt('baseline')) {
  const base = JSON.parse(readFileSync(opt('baseline'), 'utf8'));
  const diff = Tyrell.VoightKampff.compare(report, base, Number(opt('tolerance', 0.05)));
  console.log(diff.length ? `differs from the baseline:\n  - ${diff.join('\n  - ')}` : 'matches the baseline');
  if (diff.length) failed = true;
}
process.exit(failed ? 1 : 0);
