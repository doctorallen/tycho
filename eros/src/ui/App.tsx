// Eros on screen: a status line (the file, the seed, the time, playing or
// not, the checks), the tabs, a line for messages, and the screen; the keys
// that work everywhere (play, step, rewind, restart, seed, checks, undo,
// open, export, help, quit); the dialogs (the form, the code editor, a
// prompt, a question); and the clock that plays the town.
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import React, { useCallback, useEffect, useState } from 'react';
import type { Catalog, Kind } from '../catalog';
import { readArgs } from '../code';
import { callName, type Call } from '../recorder';
import { DEFAULT_STORY, when, type Sandbox, type StorySettings } from '../sandbox';
import type { TyrellLib } from '../tyrell';
import { Editor } from './Editor';
import { Form, formRows, hasForm } from './Form';
import { erosPage, kindPage, signature } from './pages';
import { CatalogScreen, ComponentsScreen, InspectScreen, LogScreen, Prompt, StoryScreen, type Ctx } from './screens';
import type { Row } from './text';
import { Hints, Panel, RowView, Rows, scrollNote } from './widgets';

const SCREENS = ['Story', 'Components', 'Catalog', 'Inspect', 'Log'];
const SPEEDS = [10, 30, 60, 180, 360, 720, 1440];
const speedName = (m: number) => (m < 60 ? `${m}m/s` : m < 1440 ? `${m / 60}h/s` : `${m / 1440}d/s`);

export interface AppProps {
  sandbox: Sandbox;
  Tyrell: TyrellLib;
  cat: Catalog;
  examples: Map<string, { code: string; from: string }>;
  /** Opens a setup file with options: the sandbox for it, and what didn't record cleanly. */
  open: (path: string, options: Record<string, unknown>, seed: string) => Promise<{ sandbox: Sandbox; warnings: string[] }>;
  /** Writes the town to a file and checks it: what to say. */
  exportTo: (sandbox: Sandbox, path: string) => Promise<string>;
  /** The terminal's size, when it can't be read (tests). */
  size?: { columns: number; rows: number };
  /** Milliseconds between clock ticks while playing. */
  tickMs?: number;
}

type Modal =
  | { kind: 'editor'; title: string; code: string; k: Kind; call: Call | null }
  | { kind: 'form'; title: string; k: Kind; call: Call | null; code: string }
  | { kind: 'prompt'; title: string; value: string; hint?: string; onSubmit: (v: string) => void }
  | { kind: 'confirm'; text: string; onYes: () => void }
  | { kind: 'help' };

/** Options as typed ('bree, harm' or 'seed=x'), and back. */
export const parseOptions = (s: string): Record<string, unknown> => Object.fromEntries(s.split(/[,\s]+/).filter(Boolean).map((o) => {
  const [k, v] = o.split('=');
  return [k, v === undefined ? true : v === 'false' ? false : v === 'true' ? true : isNaN(Number(v)) ? v : Number(v)];
}));
export const optionsText = (o: Record<string, unknown>) => Object.entries(o).map(([k, v]) => (v === true ? k : `${k}=${v}`)).join(', ');

export function App(props: AppProps) {
  const { Tyrell, cat, examples } = props;
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [sb, setSb] = useState<Sandbox>(props.sandbox);
  const [screen, setScreen] = useState(0);
  const [version, setVersion] = useState(0);
  const [settings, setSettings] = useState<StorySettings>(DEFAULT_STORY);
  const [modal, setModal] = useState<Modal | null>(null);
  const [message, setMessage] = useState<{ text: string; color?: string } | null>({ text: `Welcome to Eros. ${sb.model.name} is loaded: space plays it, ? explains everything.`, color: 'cyan' });
  const [helpOffset, setHelpOffset] = useState(0);
  const [size, setSize] = useState(() => ({ columns: stdout?.columns || props.size?.columns || 120, rows: stdout?.rows || props.size?.rows || 36 }));
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const say = useCallback((text: string, color?: string) => setMessage({ text, color }), []);

  useEffect(() => {
    if (!stdout) return;
    const on = () => setSize({ columns: stdout.columns || 120, rows: stdout.rows || 36 });
    stdout.on('resize', on);
    return () => { stdout.off('resize', on); };
  }, [stdout]);

  // the clock: while playing, the town runs on by real time
  useEffect(() => {
    const ms = props.tickMs ?? 150;
    const id = setInterval(() => { if (sb.playing && !modal) { sb.tick(ms); bump(); } }, ms);
    return () => clearInterval(id);
  }, [sb, modal, bump, props.tickMs]);

  const width = Math.max(80, size.columns);
  const height = Math.max(24, size.rows);
  const bodyH = height - 3;
  const scope = useCallback(() => ({ w: sb.world, Tyrell, opts: sb.model.options }), [sb, Tyrell]);

  /** Runs something slow after showing what's happening. */
  const later = (text: string, fn: () => void) => { say(text, 'yellow'); setTimeout(() => { fn(); bump(); }, 30); };

  /** Applies code to a call (or adds one): an error to show, or null when it's done. */
  const apply = (k: Kind, call: Call | null, code: string): string | null => {
    try { readArgs(code, scope()); } catch (e: any) { return `that doesn't read as JavaScript: ${e?.message ?? e}`; }
    let id: number;
    if (call) { sb.updateCall(call.id, code); id = call.id; } else id = sb.addCall(k.target, k.method, code);
    const failed = sb.errors.filter((x) => x.id === id);
    if (failed.length) {
      sb.undo();
      bump();
      return `the town wouldn't take it, so it's as it was: ${failed[0].message}`;
    }
    setModal(null);
    bump();
    const c = sb.change;
    say(`${call ? 'Changed' : 'Added'} ${callName(k)} #${id}. The town ran again to ${when(sb.now)}: ${c?.added.length ?? 0} beats new, ${c?.removed.length ?? 0} gone (Story, layout changes, shows them).`, 'green');
    return null;
  };

  const edit = (k: Kind, call: Call | null, code: string, asCode = false) => {
    const title = call ? `Editing ${callName(call)} #${call.id}` : `Adding ${/^[aeiou]/i.test(k.name) ? 'an' : 'a'} ${k.name.toLowerCase()}: ${signature(k)}`;
    if (!asCode && hasForm(k) && formRows(k, code, scope())) setModal({ kind: 'form', title, k, call, code });
    else setModal({ kind: 'editor', title, code, k, call });
  };
  const confirm = (text: string, onYes: () => void) => setModal({ kind: 'confirm', text, onYes });

  const openFile = () => setModal({
    kind: 'prompt', title: 'Open a setup file', value: sb.model.file ?? 'tyrell/examples/rocinante.js', hint: 'A file exporting (Tyrell, options) => world, as Rocinante does. Relative to where Eros was started.',
    onSubmit: (path) => setModal({
      kind: 'prompt', title: `Options for ${path.replace(/^.*[\\/]/, '')}`, value: optionsText(sb.model.options), hint: 'Comma separated: bree, harm, together, tuned (Rocinante\'s), or name=value.',
      onSubmit: (opts) => {
        setModal(null);
        say(`Opening ${path}…`, 'yellow');
        props.open(path, parseOptions(opts), sb.seed).then(({ sandbox, warnings }) => {
          setSb(sandbox);
          bump();
          say(warnings.length ? `Opened ${sandbox.model.name}, but: ${warnings[0]}${warnings.length > 1 ? ` (and ${warnings.length - 1} more)` : ''}` : `Opened ${sandbox.model.name}: ${sandbox.model.calls.length} calls, built the same as the file.`, warnings.length ? 'yellow' : 'green');
        }, (e) => say(`Couldn't open ${path}: ${e?.message ?? e}`, 'red'));
      },
    }),
  });
  const exportFile = () => setModal({
    kind: 'prompt', title: 'Export the town as a setup file', value: `${sb.model.name}.js`, hint: 'Written in Rocinante\'s shape, then loaded back and checked against the town.',
    onSubmit: (path) => {
      setModal(null);
      say(`Writing ${path}…`, 'yellow');
      props.exportTo(sb, path).then((m) => say(m, m.startsWith('Wrote') ? 'green' : 'yellow'), (e) => say(`Couldn't write ${path}: ${e?.message ?? e}`, 'red'));
    },
  });

  useInput((input, key) => {
    if (modal?.kind === 'confirm') {
      if (input === 'y' || key.return) { const f = modal.onYes; setModal(null); f(); bump(); } else if (input === 'n' || key.escape) setModal(null);
      return;
    }
    if (modal?.kind === 'help') {
      if (key.escape || input === '?' || input === 'q') { setModal(null); return; }
      if (key.downArrow || input === 'j') setHelpOffset((o) => o + 1);
      if (key.upArrow || input === 'k') setHelpOffset((o) => Math.max(0, o - 1));
      if (key.pageDown) setHelpOffset((o) => o + bodyH - 4);
      if (key.pageUp) setHelpOffset((o) => Math.max(0, o - bodyH + 4));
      return;
    }
    if (modal) return;
    if (/^[1-5]$/.test(input)) { setScreen(Number(input) - 1); return; }
    if (key.tab) { setScreen((s) => (s + (key.shift ? SCREENS.length - 1 : 1)) % SCREENS.length); return; }
    if (input === ' ') { sb.playing = !sb.playing; bump(); say(sb.playing ? `Playing at ${speedName(sb.speed)}.` : `Paused at ${when(sb.now)}.`); return; }
    if (input === '+' || input === '=') { sb.speed = SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(sb.speed) + 1)] ?? 60; bump(); say(`${speedName(sb.speed)}: a second of yours is ${speedName(sb.speed).replace('/s', '')} of theirs.`); return; }
    if (input === '-' || input === '_') { sb.speed = SPEEDS[Math.max(0, SPEEDS.indexOf(sb.speed) - 1)] ?? 60; bump(); say(`${speedName(sb.speed)}.`); return; }
    if (input === 'n') { sb.step(60); bump(); return; }
    if (input === 'N') { later('A day on…', () => { sb.step(1440); say(`A day on: ${when(sb.now)}.`); }); return; }
    if (input === 'b') { sb.back(60); bump(); say(`Back an hour (Esper): ${when(sb.now)}. What came after is gone from the story; it will happen again, the same, as it runs.`); return; }
    if (input === 'B') { later('A day back…', () => { sb.back(1440); say(`Back a day: ${when(sb.now)}.`); }); return; }
    if (input === 'r') { sb.restart(); bump(); say(`Started again from the start, seed '${sb.seed}'.`); return; }
    if (input === 's') { setModal({ kind: 'prompt', title: 'A seed', value: sb.seed, hint: 'The town starts again with it: the same seed always runs the same.', onSubmit: (v) => { setModal(null); sb.restart(v || sb.seed); bump(); say(`Seed '${sb.seed}': started again.`); } }); return; }
    if (input === 'c' || input === 'C') {
      const days = input === 'C' ? 7 : 1;
      later(`Running Voight-Kampff's checks for ${days === 1 ? 'a day' : 'a week'}…`, () => {
        const r = sb.runChecks(days);
        say(r.state === 'passed' ? `Checks passed: ${r.summary}. They behave like people.` : `Checks ${r.state}: ${r.failures.join('; ')}`, r.state === 'passed' ? 'green' : 'red');
      });
      return;
    }
    if (input === 'u') { if (sb.undo()) { bump(); say(`Undone: the town ran again to ${when(sb.now)}.`, 'green'); } else say('Nothing to undo.'); return; }
    if (input === 'o') { openFile(); return; }
    if (input === 'e') { exportFile(); return; }
    if (input === '?') { setHelpOffset(0); setModal({ kind: 'help' }); return; }
    if (input === 'q') { exit(); }
  });

  const ctx: Ctx = { sb, cat, examples, Tyrell, width, height: bodyH, active: !modal, visible: true, version, bump, say, edit, confirm, scope };
  const full = modal?.kind === 'editor' || modal?.kind === 'form' || modal?.kind === 'help';
  const on = (i: number): Ctx => ({ ...ctx, active: !modal && screen === i, visible: !modal && screen === i });

  // the status line
  const errors = sb.errors.length, warnings = sb.model.warnings.length;
  const status: Row = [
    { text: ' EROS ', bold: true, inverse: true, color: 'magenta' },
    { text: ` ${sb.model.name}`, bold: true }, { text: Object.keys(sb.model.options).length ? ` (${optionsText(sb.model.options)})` : '', dim: true },
    { text: '  seed ', dim: true }, { text: sb.seed },
    { text: '  ' }, { text: when(sb.now), bold: true },
    { text: '  ' }, sb.playing ? { text: `▶ ${speedName(sb.speed)}`, color: 'green', bold: true } : { text: `❚❚ ${speedName(sb.speed)}`, dim: true },
    { text: '  checks ', dim: true }, sb.checks.state === 'none' ? { text: 'not run', dim: true } : { text: `${sb.checks.state} (${sb.checks.days}d)`, color: sb.checks.state === 'passed' ? 'green' : 'red' },
    ...(errors ? [{ text: `  ${errors} failing call${errors === 1 ? '' : 's'}`, color: 'red', bold: true }] : []),
    ...(warnings ? [{ text: `  ${warnings} warning${warnings === 1 ? '' : 's'}`, color: 'yellow' }] : []),
    ...(sb.canUndo ? [{ text: '  u: undo', dim: true }] : []),
  ];
  const tabs: Row = SCREENS.flatMap((s, i) => [{ text: ` ${i + 1} ${s} `, inverse: i === screen, bold: i === screen, color: i === screen ? 'cyan' : undefined }, { text: ' ' }]);
  tabs.push({ text: '  space play · +/- speed · n/N on · b/B back · r restart · s seed · c checks · u undo · o open · e export · ? help · q quit', dim: true });

  let body: React.ReactNode;
  if (modal?.kind === 'editor') {
    const m = modal;
    body = <Editor title={m.title} code={m.code} width={width} height={bodyH} docs={(w) => kindPage(m.k, w, examples.get(m.k.key))}
      onSave={(code) => apply(m.k, m.call, code)} onCancel={() => setModal(null)}
      onForm={hasForm(m.k) ? (code) => { if (formRows(m.k, code, scope())) setModal({ kind: 'form', title: m.title, k: m.k, call: m.call, code }); else say('That code doesn\'t read as a definition the form can show.', 'yellow'); } : undefined} />;
  } else if (modal?.kind === 'form') {
    const m = modal;
    body = <Form title={m.title} kind={m.k} rows={formRows(m.k, m.code, scope()) ?? []} scope={scope()} width={width} height={bodyH}
      onSave={(code) => apply(m.k, m.call, code)} onCancel={() => setModal(null)} onCode={(code) => setModal({ kind: 'editor', title: m.title, code, k: m.k, call: m.call })} />;
  } else if (modal?.kind === 'help') {
    const rows = erosPage(width - 6);
    body = (
      <Panel title="Help" width={width} height={bodyH - 1} focused note={scrollNote(helpOffset, bodyH - 4, rows.length) + ' · esc to close'}>
        <Rows rows={rows} height={bodyH - 4} offset={helpOffset} width={width - 4} />
      </Panel>
    );
  }
  // every screen stays mounted, so each keeps its place while a dialog is open or another is shown
  const screens = (
    <>
      <StoryScreen ctx={on(0)} settings={settings} setSettings={setSettings} />
      <ComponentsScreen ctx={on(1)} />
      <CatalogScreen ctx={on(2)} />
      <InspectScreen ctx={on(3)} />
      <LogScreen ctx={on(4)} />
    </>
  );

  return (
    <Box flexDirection="column" width={width} height={height}>
      <RowView row={status} width={width} />
      <RowView row={tabs} width={width} />
      {modal?.kind === 'prompt' ? (
        <Prompt title={modal.title} value={modal.value} hint={modal.hint} width={width} onSubmit={modal.onSubmit} onCancel={() => setModal(null)} />
      ) : modal?.kind === 'confirm' ? (
        <Panel title="Sure?" width={width} height={4} focused><Text>{modal.text} <Text bold color="yellow">y</Text><Text dimColor>/n</Text></Text></Panel>
      ) : (
        <Text color={message?.color} wrap="truncate">{message ? message.text : ' '}</Text>
      )}
      {modal?.kind === 'prompt' || modal?.kind === 'confirm' ? null : full ? body : null}
      {screens}
      {modal?.kind === 'help' ? <Hints width={width} hints={[['↑↓ PgUp/Dn', 'scroll'], ['esc', 'close']]} /> : null}
    </Box>
  );
}
