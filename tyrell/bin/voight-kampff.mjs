#!/usr/bin/env node
// Runs the Voight-Kampff behavior tests on a world from the command line.
//
//   node bin/voight-kampff.mjs examples/rocinante.js [--days 7] [--seed s] [--with option]... [--check name]... [--json] [--baseline file.json] [--save file.json]
//     [--log [all | kind,kind...]] [--who id] [--chronicle id] [--story [min]] [--story-by time|person|thread|day] [--recap [n]] [--focus id]... [--feed [min]]
//     [--as id] [--voice first] [--plain] [--story-size n] [--log-size n]
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
// chronicle at the end. `--story` tells the run as a story at the end
// (Irulan), leaving out what scores under 0.3 (`--story 0` tells everything,
// `--story 0.5` only the most): a timeline by the parts of each day, or with
// `--story-by` each person's day (`person`), the storylines and the rest of
// the town (`thread`), or paragraphs (`day`). `--recap` prints the five
// headlines (`--recap 10`, ten), `--focus ruth` counts what's about Ruth
// twice over, and with `--who`, only what's about them. On a terminal, names
// are bold and places colored (NO_COLOR or `--no-color` for plain).
// `--feed` prints the story as it happens instead, each beat once it's
// complete (Irulan's feed), what scores under 0.5 left out (`--feed 0.3`).
// `--as ruth` tells only what Ruth knows, as she knows it (`--voice first`
// in her words; `--recap` then gives what she'd say of what's new), and
// `--plain` doesn't vary the words. `--story-size 600` keeps Irulan's story
// beyond the log (config.storySize) and tells from it, and `--log-size 300`
// shortens the log (config.logSize): both are passed to the setup file as
// `config`, which it must hand on to create(), as Rocinante does.
// Only the run's own world is watched: the checks that
// build more worlds with the same seed would tell it all again.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as Tyrell from '../../dist/tyrell.mjs';

const args = process.argv.slice(2);
// (--log takes a value only when one follows that reads as kinds, not a file)
const kinds = (a) => a !== undefined && /^[a-z][a-z:,-]*$/.test(a);
const score = (a) => a !== undefined && /^\d*\.?\d+$/.test(a);
const bare = (i) => args[i] === '--json' || args[i] === '--no-color' || args[i] === '--plain' || (args[i] === '--log' && !kinds(args[i + 1])) || ((args[i] === '--story' || args[i] === '--recap' || args[i] === '--feed') && !score(args[i + 1]));
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const all = (name) => args.flatMap((a, i) => (a === '--' + name && args[i + 1] !== undefined ? [args[i + 1]] : []));
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !bare(i - 1)));
if (!file) { console.error('usage: voight-kampff <setup.js> [--days n] [--seed s] [--with option]... [--check name]... [--json] [--baseline file] [--save file] [--log [all | kinds]] [--who id] [--chronicle id] [--story [min]] [--story-by time|person|thread|day] [--recap [n]] [--focus id]... [--feed [min]] [--as id] [--voice first] [--plain] [--story-size n] [--log-size n]'); process.exit(2); }
const require = createRequire(import.meta.url);
let build = require(resolve(file));
if (build.default) build = build.default;

const options = {};
for (const name of all('with')) options[name] = true;
// Irulan's story kept beyond the log, and the log's size: settings the setup file hands on to create()
const storySize = opt('story-size') !== undefined ? Number(opt('story-size')) : undefined;
const logSize = opt('log-size') !== undefined ? Number(opt('log-size')) : undefined;
if (storySize !== undefined || logSize !== undefined) options.config = { ...(storySize !== undefined ? { storySize } : {}), ...(logSize !== undefined ? { logSize } : {}) };
const extra = all('check');
const checks = extra.length ? ['nobody-starves', 'capacity', 'everyone-sleeps', 'no-stuck', 'deterministic', 'esper', 'save-load', ...extra] : undefined;
const days = Number(opt('days', 3));
const logAt = args.indexOf('--log');
const logs = logAt < 0 ? null : !kinds(args[logAt + 1]) ? 'log' : args[logAt + 1] === 'all' ? 'all' : new Set(args[logAt + 1].split(','));
const who = opt('who');
const told = opt('chronicle');
const storyAt = args.indexOf('--story');
const recapAt = args.indexOf('--recap');
const recap = recapAt < 0 ? null : score(args[recapAt + 1]) ? Number(args[recapAt + 1]) : 5;
const story = storyAt < 0 ? (recap !== null ? 0.3 : null) : score(args[storyAt + 1]) ? Number(args[storyAt + 1]) : 0.3;
const storyBy = opt('story-by', 'time');
if (!['time', 'person', 'thread', 'day'].includes(storyBy)) { console.error(`--story-by: time, person, thread or day, not '${storyBy}'`); process.exit(2); }
const feedAt = args.indexOf('--feed');
const feed = feedAt < 0 ? null : score(args[feedAt + 1]) ? Number(args[feedAt + 1]) : 0.5;
// whose point of view, in whose words, and the words not varied
const as = opt('as'), voice = opt('voice');
if (voice !== undefined && !['first', 'third'].includes(voice)) { console.error(`--voice: first or third, not '${voice}'`); process.exit(2); }
if (voice === 'first' && !as) { console.error('--voice first: whose words? Give --as too'); process.exit(2); }
const telling = { ...(as ? { as } : {}), ...(voice ? { voice } : {}), ...(args.includes('--plain') ? { vary: false } : {}) };
const focus = Object.fromEntries(all('focus').map((id) => [id, 2]));
let first = null;
let chronicled = [];
let written = [];
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
  // the esper check goes back and runs forward again: what it tells a second time isn't news
  let seen = -Infinity;
  w.on('seek', (e) => { if (e.to < e.from) seen = Math.max(seen, e.from); });
  const fresh = () => w.now <= end && w.now > seen;
  if (told) w.on('log', (e) => { if (fresh() && w.westmarch.about(e, told)) chronicled.push(e); });
  if (story !== null) w.on('log', (e) => { if (fresh()) written.push(e); });
  if (feed !== null) {
    // (as each beat completes; a sentence names its own people)
    w.irulan.feed((b) => { if (fresh()) console.log(`${when(b.t)}  ${b.text}`); },
      { min: feed, ...telling, ...(who ? { who } : {}), ...(Object.keys(focus).length ? { focus } : {}) });
  }
  if (!logs) return;
  w.on('*', (e) => {
    if (!fresh()) return;
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
if (story !== null && first) told_story(first);

/** The run told as a story (Irulan), as --story-by says, and the headlines (--recap). */
function told_story(w) {
  const opts = { min: story, ...telling, ...(who ? { who } : {}), ...(Object.keys(focus).length ? { focus } : {}) };
  // with the story kept (--story-size), told from it alone; else from everything written in the run
  const written2 = storySize ? undefined : written;
  const color = process.stdout.isTTY && !process.env.NO_COLOR && !args.includes('--no-color');
  const style = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
  const width = Math.max(60, Math.min(process.stdout.columns || 100, 120));
  const clock = (t) => { const m = Math.floor(t + 1e-6) % Tyrell.DAY; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const mark = (s) => (s >= 0.75 ? style('1;31', '!!') : s >= 0.55 ? style('33', '! ') : '  ');
  const rule = (title) => style('1', `── ${title} `) + style('2', '─'.repeat(Math.max(4, Math.min(width, 72) - title.length - 4)));
  // a sentence's parts, wrapped to the width under a margin: people bold, places colored
  const say = (parts, margin, first = margin) => {
    const words = [];
    for (const p of parts) for (const [i, piece] of p.text.split(' ').entries()) {
      if (i > 0) words.push(null);
      if (piece) words.push({ text: piece, code: p.person ? '1' : p.place ? '32' : '' });
    }
    const lines = [];
    let line = '', len = 0, space = false;
    for (const t of words) {
      if (t === null) { space = true; continue; }
      const room = (lines.length ? margin : first) + len + (space && len ? 1 : 0) + t.text.length;
      if (len && room > width) { lines.push(line); line = ''; len = 0; space = false; }
      if (space && len) { line += ' '; len++; }
      line += t.code ? style(t.code, t.text) : t.text;
      len += t.text.length;
      space = false;
    }
    lines.push(line);
    return lines.join('\n' + ' '.repeat(margin));
  };
  const timeline = (beats, at = (b) => w.irulan.when(b.t)) => {
    let head = '';
    for (const b of beats) {
      if (at(b) !== head) { head = at(b); console.log('\n' + rule(head)); }
      console.log(`${clock(b.t)} ${mark(b.score)} ${say(b.parts, 9, 9)}`);
    }
  };
  if (recap !== null) {
    if (as) {
      // what they'd say when asked what's new
      console.log(rule(`What ${w.s.people[as]?.name ?? as} would say`));
      for (const b of w.irulan.recount(as, written2, { ...opts, limit: recap, min: Math.max(story, 0.4) })) console.log(`  ${say(b.parts, 2, 2)}`);
    } else {
      console.log(rule('The headlines'));
      for (const b of w.irulan.recap(written2, { ...opts, limit: recap })) console.log(`${style('2', w.irulan.when(b.t).padEnd(24))} ${say(b.parts, 25, 25)}`);
    }
    console.log('');
    if (storyAt < 0) return;
  }
  if (storyBy === 'day') { for (const p of w.irulan.tell(written2, opts)) console.log(p + '\n'); return; }
  if (storyBy === 'time') { timeline(w.irulan.beats(written2, opts)); console.log(''); return; }
  if (storyBy === 'person') {
    const beats = w.irulan.beats(written2, opts);
    for (const p of Object.values(w.s.people)) {
      if (who && p.id !== who) continue;
      const theirs = beats.filter((b) => b.who.includes(p.id));
      if (!theirs.length) continue;
      console.log('\n' + rule(p.name));
      for (const b of theirs) {
        // their own sentence, without their name in front
        const parts = b.who.length === 1 && b.parts[0]?.person === p.id ? [{ text: b.parts[1].text.replace(/^ /, '') }, ...b.parts.slice(2)] : b.parts;
        console.log(`${style('2', `day ${Math.floor(b.t / Tyrell.DAY)}`)} ${clock(b.t)} ${mark(b.score)} ${say(parts, 15, 15)}`);
      }
    }
    console.log('');
    return;
  }
  const { threads, rest } = w.irulan.threads(written2, { ...opts, min: Math.max(story, 0.4) });
  for (const th of threads) {
    console.log('\n' + rule(th.title) + style('2', `  ${th.people.slice(0, 4).map((id) => w.s.people[id]?.name ?? id).join(', ')}${th.people.length > 4 ? ' and others' : ''}`));
    for (const b of th.beats) console.log(`${style('2', `day ${Math.floor(b.t / Tyrell.DAY)}`)} ${clock(b.t)} ${mark(b.score)} ${say(b.parts, 15, 15)}`);
  }
  if (rest.length) { console.log('\n' + style('1', 'Around town')); timeline(rest); }
  console.log('');
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
