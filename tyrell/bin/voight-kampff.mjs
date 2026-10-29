#!/usr/bin/env node
// Runs the Voight-Kampff behavior tests on a world from the command line.
//
//   node bin/voight-kampff.mjs examples/rocinante.js [--days 7] [--seed s] [--with option]... [--check name]... [--json] [--baseline file.json] [--save file.json]
//     [--log [all | kind,kind...]] [--who id] [--chronicle id]
//
// The setup file exports a function (Tyrell, { seed, ...options }) => world,
// as examples/rocinante.js does. `--with bree` passes { bree: true } (any
// option, as many as you like: `--with harm`); `--check interactions` adds a
// check to the usual ones (`--check harm`).
//
// `--log` prints every log entry as it's written, in plain words (Westmarch's
// describe); `--log all` every event besides, conversations' words included;
// `--log started,arrived` only those kinds (of entry or event). `--who ruth`
// keeps what's about one person, and `--chronicle ruth` prints their
// chronicle at the end. Only the run's own world is watched: the checks that
// build more worlds with the same seed would tell it all again.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as Tyrell from '../../dist/tyrell.mjs';

const args = process.argv.slice(2);
// (--log takes a value only when one follows that reads as kinds, not a file)
const kinds = (a) => a !== undefined && /^[a-z][a-z:,-]*$/.test(a);
const bare = (i) => args[i] === '--json' || (args[i] === '--log' && !kinds(args[i + 1]));
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const all = (name) => args.flatMap((a, i) => (a === '--' + name && args[i + 1] !== undefined ? [args[i + 1]] : []));
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !bare(i - 1)));
if (!file) { console.error('usage: voight-kampff <setup.js> [--days n] [--seed s] [--with option]... [--check name]... [--json] [--baseline file] [--save file] [--log [all | kinds]] [--who id] [--chronicle id]'); process.exit(2); }
const require = createRequire(import.meta.url);
let build = require(resolve(file));
if (build.default) build = build.default;

const options = {};
for (const name of all('with')) options[name] = true;
const extra = all('check');
const checks = extra.length ? ['nobody-starves', 'capacity', 'everyone-sleeps', 'no-stuck', 'deterministic', 'esper', 'save-load', ...extra] : undefined;
const days = Number(opt('days', 3));
const logAt = args.indexOf('--log');
const logs = logAt < 0 ? null : !kinds(args[logAt + 1]) ? 'log' : args[logAt + 1] === 'all' ? 'all' : new Set(args[logAt + 1].split(','));
const who = opt('who');
const told = opt('chronicle');
let first = null;
let chronicled = [];
const report = Tyrell.VoightKampff.run({
  build: (seed) => {
    const w = build(Tyrell, { ...options, seed });
    if (!first) { first = w; watch(w); }
    return w;
  },
  days, seed: opt('seed', 'voight-kampff'), checks,
});

/** Prints what happens in the run's world as it happens, until the run's last minute. */
function watch(w) {
  const start = w.now, end = start + days * Tyrell.DAY;
  const width = Math.max(...Object.values(w.s.people).map((p) => (p.name ?? p.id).length), 8);
  const name = (id) => (typeof id === 'string' ? w.s.people[id]?.name ?? id : '');
  const when = (t) => { const m = Math.floor(t + 1e-6); return `day ${Math.floor(m / Tyrell.DAY)} ${String(Math.floor((m % Tyrell.DAY) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const line = (t, id, words) => console.log(`${when(t)}  ${name(id).padEnd(width)}  ${words}`);
  // where someone is, for an entry that doesn't say (and nowhere for walkers)
  const where = (e) => {
    const p = e.who !== undefined ? w.s.people[e.who] : undefined;
    if (!p?.place || e.d?.place !== undefined || p.doing?.kind === 'travel') return '';
    return ` · at ${w.ring.get(p.place)?.name ?? p.place}`;
  };
  // an event is about someone when any of its fields names them
  const mentions = (e) => Object.values(e).some((v) => v === who || (Array.isArray(v) && v.includes(who)));
  if (told) w.on('log', (e) => { if (w.now <= end && w.westmarch.about(e, told)) chronicled.push(e); });
  if (!logs) return;
  w.on('*', (e) => {
    if (w.now > end) return;
    const { event, kind, ...rest } = e;
    if (event === 'log') {
      if (logs instanceof Set && !logs.has(e.k)) return;
      if (who && !w.westmarch.about(e, who)) return;
      const entry = { t: e.t, k: e.k, who: e.who, d: e.d };
      line(e.t, e.who, w.westmarch.describe(entry) + where(entry));
      return;
    }
    if (logs === 'log' || (logs instanceof Set && !logs.has(event))) return;
    if (who && !mentions(e)) return;
    const data = kind === event ? rest : { kind, ...rest };
    const id = typeof data.who === 'string' ? data.who : typeof data.id === 'string' ? data.id : typeof data.from === 'string' ? data.from : undefined;
    // a conversation's turn by its words; anything else by its name and its data
    if (event === 'bree:turn') { line(w.now, data.who, `says to ${name(data.to)}: "${data.text}" (${data.kind}, ${data.step}, ${data.landed})`); return; }
    const fields = Object.entries(data).filter(([k, v]) => v !== null && v !== undefined && k !== (data.who === id ? 'who' : data.id === id ? 'id' : 'from'));
    line(w.now, id, `[${event}] ` + fields.map(([k, v]) => `${k} ${typeof v === 'string' ? (w.s.people[v] ? name(v) : v) : JSON.stringify(v)}`).join(', '));
  });
}

if (told && first) {
  // a day at a time, from what was written as it ran (the log itself keeps only its last logSize)
  const byDay = new Map();
  for (const e of chronicled) { const d = Math.floor(e.t / Tyrell.DAY); byDay.set(d, [...(byDay.get(d) || []), e]); }
  console.log(`${first.s.people[told]?.name ?? told}'s chronicle:`);
  for (const [d, list] of byDay) {
    console.log(`day ${d}`);
    for (const l of first.westmarch.chronicle(told, list)) console.log('  ' + l);
  }
}
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
