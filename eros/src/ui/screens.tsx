// Eros's screens: the Story (Irulan's telling, with every setting), the
// Components (everything the town is made of, to see, add, change and
// remove), the Catalog (the living documentation), Inspect (Palantír's
// account of anyone) and the Log (Westmarch's entries, in plain words).
// Every one filters with `/`: type words, and what holds them all stays,
// the matches picked out.
import { Box, Text, useInput } from 'ink';
import React, { useEffect, useMemo, useState } from 'react';
import type { Catalog, Kind } from '../catalog';
import { kindOf } from '../catalog';
import { readArgs, type Scope } from '../code';
import { callName, type Call } from '../recorder';
import { LAYOUTS, when, type Line, type Sandbox, type StorySettings } from '../sandbox';
import type { TyrellLib } from '../tyrell';
import { apiRows, erosPage, kindPage, modulePage, settingRows, signature } from './pages';
import { highlight, matchRows, matches, queryWords } from './filter';
import { codeRows, dedent, partsSegs, wrap, wrapText, type Row } from './text';
import { Hints, List, Panel, RowView, Rows, scrollNote } from './widgets';

/** What every screen gets. */
export interface Ctx {
  sb: Sandbox;
  cat: Catalog;
  examples: Map<string, { code: string; from: string }>;
  Tyrell: TyrellLib;
  width: number;
  height: number;
  /** Whether it has the keys (no dialog open, and it's the screen shown). */
  active: boolean;
  /** Whether it's drawn: every screen stays mounted (keeping its place) but only the one shown draws. */
  visible: boolean;
  version: number;
  bump: () => void;
  say: (text: string, color?: string) => void;
  /** Edits a call (a form when the kind has one, else code); adds one of a kind when there's no call. */
  edit: (kind: Kind, call: Call | null, code: string, asCode?: boolean) => void;
  confirm: (text: string, onYes: () => void) => void;
  scope: () => Scope;
  /** Whether a screen is taking typed text (a filter): the keys that work everywhere wait. */
  typing: (on: boolean) => void;
}

// ---------------------------------------------------------------------------
// Filtering: `/`, words, enter to keep, esc to clear
// ---------------------------------------------------------------------------

function useFilter(ctx: Ctx) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const stop = (keep: boolean) => { setEditing(false); ctx.typing(false); if (!keep) setQuery(''); };
  /** The filter's keys: true when it took the key. */
  const keys = (input: string, key: any): boolean => {
    if (editing) {
      if (key.return) stop(true);
      else if (key.escape) stop(false);
      else if (key.backspace || key.delete) setQuery((q) => q.slice(0, -1));
      else if (key.ctrl && input === 'u') setQuery('');
      else if (input && !key.ctrl && !key.meta && !key.tab && !key.upArrow && !key.downArrow && !key.leftArrow && !key.rightArrow) setQuery((q) => q + input.replace(/[\r\n]/g, ''));
      return true;
    }
    if (input === '/') { setEditing(true); ctx.typing(true); return true; }
    if (key.escape && query) { setQuery(''); return true; }
    return false;
  };
  return { query, editing, words: queryWords(query), keys, on: editing || !!query };
}

/** The foot of a screen: its keys, or, filtering, the filter (what's typed, how many match). */
function Foot({ f, count, width, hints, jump }: { f: ReturnType<typeof useFilter>; count: number; width: number; hints: Array<[string, string]>; jump?: boolean }) {
  if (!f.on) return <Hints width={width} hints={[['/', 'filter'], ...hints]} />;
  return (
    <RowView width={width} row={[
      { text: '/', bold: true, color: 'yellow' }, { text: f.query, bold: true }, ...(f.editing ? [{ text: ' ', inverse: true }] : []),
      { text: `  ${count} match${count === 1 ? '' : 'es'}`, color: count ? 'green' : 'red' },
      { text: f.editing ? '  · enter keep · esc clear · words in any order' : `  · / change · esc clear${jump ? ' · ] [ next / previous' : ''} · ${hints.map(([k, v]) => `${k} ${v}`).join(' · ')}`, dim: true },
    ]} />
  );
}

// ---------------------------------------------------------------------------
// Scrolling: an offset, and following the end
// ---------------------------------------------------------------------------

function useScroll(total: number, height: number, follow0 = false) {
  const [offset, setOffset] = useState(0);
  const [follow, setFollow] = useState(follow0);
  const max = Math.max(0, total - height);
  const at = follow ? max : Math.min(offset, max);
  const keys = (input: string, key: any): boolean => {
    const by = (n: number) => { setFollow(false); setOffset(Math.max(0, Math.min(max, at + n))); };
    if (input === 'j') { by(1); return true; }
    if (input === 'k') { by(-1); return true; }
    if (key.pageDown || input === ' ' && false) { by(height - 2); return true; }
    if (key.pageUp) { by(-(height - 2)); return true; }
    if (input === 'g') { setFollow(false); setOffset(0); return true; }
    if (input === 'G') { setFollow(true); return true; }
    return false;
  };
  return { at, follow, setFollow, setOffset, keys };
}

// ---------------------------------------------------------------------------
// Story
// ---------------------------------------------------------------------------

const LAYOUT_ABOUT: Record<string, string> = {
  timeline: 'each beat, by the time of day',
  person: "each person's own day",
  thread: 'the storylines, then what else mattered',
  paragraphs: "Irulan's tell(): a paragraph a part of the day",
  recap: 'the headlines (limit)',
  recount: 'what someone would say of what\'s new (as, limit)',
  feed: 'what the feed told as it happened',
  changes: 'what the last change did to the story',
};

/** The story's lines as rows to show. */
export function storyRows(lines: Line[], width: number): Row[] {
  const rows: Row[] = [];
  const mark = (s = 0) => (s >= 0.75 ? { text: '!! ', color: 'red', bold: true } : s >= 0.55 ? { text: '!  ', color: 'yellow' } : { text: '   ' });
  for (const l of lines) {
    if (l.kind === 'head') rows.push([], [{ text: '── ', dim: true }, ...(l.parts ? partsSegs(l.parts, { bold: true, color: 'cyan' }).map((s) => ({ ...s, color: s.color === 'green' ? 'green' : 'cyan' })) : [{ text: l.text, bold: true, color: 'cyan' }]), { text: ' ' + '─'.repeat(Math.max(2, width - l.text.length - 5)), dim: true }]);
    else if (l.kind === 'sub') rows.push(...wrapText(l.text, width, 0, { dim: true }));
    else if (l.kind === 'text') rows.push(...wrap(l.parts ? partsSegs(l.parts) : [{ text: l.text }], width));
    else if (l.kind === 'added' || l.kind === 'removed') {
      const sign = l.kind === 'added' ? { text: '+ ', color: 'green', bold: true } : { text: '- ', color: 'red', bold: true };
      rows.push(...wrap([sign, ...(l.t !== undefined ? [{ text: when(l.t) + '  ', dim: true }] : []), ...(l.parts ? partsSegs(l.parts, l.kind === 'removed' ? { dim: true } : {}) : [{ text: l.text }])], width, 2));
    } else {
      const lead = l.t !== undefined ? [{ text: when(l.t).slice(-5) + ' ', dim: true }, mark(l.score)] : [mark(l.score)];
      rows.push(...wrap([...lead, ...(l.parts ? partsSegs(l.parts) : [{ text: l.text }])], width, l.t !== undefined ? 9 : 3));
    }
  }
  return rows;
}

/**
 * The story's lines that hold every word: a heading (a storyline's title)
 * that matches keeps all of its section; otherwise a section keeps its
 * heading only for the lines in it that match.
 */
export function filterStory(lines: Line[], words: string[]): Line[] {
  if (!words.length) return lines;
  const out: Line[] = [];
  let head: Line[] = [], body: Line[] = [], whole = false;
  const flush = () => { if (body.length) out.push(...head, ...body); head = []; body = []; whole = false; };
  for (const l of lines) {
    if (l.kind === 'head') { flush(); head = [l]; whole = matches(l.text, words); continue; }
    if (l.kind === 'sub') { if (body.length) body.push(l); else head.push(l); continue; }
    if (whole || matches(l.text, words)) body.push(l);
  }
  flush();
  return out;
}

export function StoryScreen({ ctx, settings, setSettings }: { ctx: Ctx; settings: StorySettings; setSettings: (s: StorySettings) => void }) {
  const { sb, width, height, active } = ctx;
  const [at, setAt] = useState(0);
  const people = sb.people();
  const cycle = <T,>(list: T[], v: T, dir: number) => list[(list.indexOf(v) + dir + list.length) % list.length];
  const ids = [null, ...people.map((p) => p.id)];
  const name = (id: string | null, none: string) => (id ? people.find((p) => p.id === id)?.name ?? id : none);
  const rowsDef: Array<{ label: string; value: string; change: (dir: number) => void }> = [
    { label: 'Layout', value: settings.layout, change: (d) => setSettings({ ...settings, layout: cycle(LAYOUTS, settings.layout, d) }) },
    { label: 'Least score', value: settings.min.toFixed(2), change: (d) => setSettings({ ...settings, min: Math.round(Math.max(0, Math.min(1, settings.min + d * 0.05)) * 100) / 100 }) },
    { label: 'About', value: name(settings.who, 'everyone'), change: (d) => setSettings({ ...settings, who: cycle(ids, settings.who, d) }) },
    { label: 'Point of view', value: name(settings.as, 'nobody\'s'), change: (d) => setSettings({ ...settings, as: cycle(ids, settings.as, d) }) },
    { label: 'Voice', value: settings.voice === 'first' ? 'first (I)' : 'third', change: () => setSettings({ ...settings, voice: settings.voice === 'first' ? 'third' : 'first' }) },
    { label: 'Vary words', value: settings.vary ? 'yes' : 'no', change: () => setSettings({ ...settings, vary: !settings.vary }) },
    { label: 'Focus', value: name(settings.focus, 'nobody'), change: (d) => setSettings({ ...settings, focus: cycle(ids, settings.focus, d) }) },
    { label: 'Limit', value: String(settings.limit), change: (d) => setSettings({ ...settings, limit: Math.max(1, Math.min(40, settings.limit + d)) }) },
  ];
  const sideW = 30, outW = width - sideW;
  const bodyH = height - 3;
  const f = useFilter(ctx);
  const all = useMemo(() => (ctx.visible ? sb.story(settings) : []), [sb, settings, ctx.version, sb.entries.length, sb.now, ctx.visible]);
  const lines = useMemo(() => filterStory(all, f.words), [all, f.query]);
  const rows = useMemo(() => highlight(storyRows(lines, outW - 4), f.words), [lines, outW, f.query]);
  const count = lines.filter((l) => l.kind !== 'head' && l.kind !== 'sub').length;
  const followable = settings.layout === 'timeline' || settings.layout === 'feed';
  const scroll = useScroll(rows.length, bodyH - 2, followable);

  useInput((input, key) => {
    if (f.keys(input, key)) return;
    if (key.upArrow) { setAt((a) => Math.max(0, a - 1)); return; }
    if (key.downArrow) { setAt((a) => Math.min(rowsDef.length - 1, a + 1)); return; }
    if (key.leftArrow || key.rightArrow) {
      rowsDef[at].change(key.leftArrow ? -1 : 1);
      if (at === 0) { scroll.setOffset(0); scroll.setFollow(false); }
      return;
    }
    scroll.keys(input, key);
  }, { isActive: active });

  const sideRows: Row[] = [];
  rowsDef.forEach((r, i) => {
    sideRows.push([{ text: (i === at ? '› ' : '  ') + r.label, bold: i === at, color: i === at ? 'cyan' : undefined }]);
    sideRows.push([{ text: '    ◂ ', dim: i !== at }, { text: r.value, bold: true, color: i === at ? 'yellow' : undefined }, { text: ' ▸', dim: i !== at }]);
  });
  sideRows.push([], ...wrapText(LAYOUT_ABOUT[settings.layout] ?? '', sideW - 4, 0, { dim: true }));
  if (settings.as) sideRows.push([], ...wrapText(`Only what ${name(settings.as, '')} knows${settings.voice === 'first' ? ', in their words' : ''}.`, sideW - 4, 0, { dim: true }));
  if (!ctx.visible) return null;
  return (
    <Box flexDirection="column" height={height}>
      <Box>
        <Panel title="Telling" width={sideW} height={bodyH} focused={active}>
          <Rows rows={sideRows} height={bodyH - 3} offset={0} width={sideW - 4} />
        </Panel>
        <Panel title={`Irulan · ${settings.layout}${f.query ? ` · /${f.query}` : ''}`} width={outW} height={bodyH} note={`${scrollNote(scroll.at, bodyH - 3, rows.length)}${scroll.follow && followable ? ' · following' : ''}`}>
          <Rows rows={rows.length ? rows : [[{ text: f.query ? `Nothing told holds all of: ${f.words.join(', ')}.` : 'Nothing to tell yet: press space to play, or n to step an hour.', dim: true }]]} height={bodyH - 3} offset={scroll.at} width={outW - 4} />
        </Panel>
      </Box>
      <Foot f={f} count={count} width={width} hints={[['↑↓', 'setting'], ['←→', 'change it'], ['j/k PgUp/PgDn', 'scroll'], ['g/G', 'top / end']]} />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

// (a name already plural, like Cityspeak's Lines, stays as it is)
const plural = (s: string) => (s === 'Person' ? 'People' : /(ss|sh|ch|x|z)$/.test(s) ? s + 'es' : /s$/.test(s) ? s : /[^aeiou]y$/.test(s) ? s.slice(0, -1) + 'ies' : s + 's');

/** A call, briefly: its id or key and label, read from its code. */
function summary(call: Call, scope: Scope, cache: Map<string, string>): string {
  const key = call.target + call.method + call.code;
  const hit = cache.get(key);
  if (hit) return hit;
  let out: string;
  try {
    const args = readArgs(call.code, scope);
    const strs = args.filter((a) => typeof a === 'string' || typeof a === 'number') as Array<string | number>;
    const obj = args.find((a) => a && typeof a === 'object' && !Array.isArray(a)) as Record<string, unknown> | undefined;
    const arr = args.find(Array.isArray) as unknown[] | undefined;
    const name = obj && (obj.id ?? obj.key ?? obj.kind ?? obj.name);
    const label = obj && (obj.label ?? obj.name ?? (typeof obj.text === 'string' ? obj.text : undefined));
    if (call.method === 'link') out = `${strs[0]} ↔ ${strs[1]}, ${strs[2]} min`;
    else if (arr) out = `${arr.length} at once` + (arr[0] && typeof arr[0] === 'object' ? `: ${(arr as any[]).map((x) => x.key ?? x.id).filter(Boolean).slice(0, 3).join(', ')}${arr.length > 3 ? '…' : ''}` : '');
    else out = [...strs.map(String), name !== undefined && !strs.includes(name as any) ? String(name) : null, label && label !== name ? `“${String(label)}”` : null].filter(Boolean).join('  ') || call.code.split('\n')[0];
  } catch { out = call.code.split('\n')[0]; }
  cache.set(key, out);
  return out;
}

export function ComponentsScreen({ ctx }: { ctx: Ctx }) {
  const { sb, cat, width, height, active } = ctx;
  const [panel, setPanel] = useState(0);
  const [g, setG] = useState(0);
  const [e, setE] = useState(0);
  const [detail, setDetail] = useState(0);
  const cache = useMemo(() => new Map<string, string>(), [sb]);
  const f = useFilter(ctx);
  const scope0 = ctx.scope();
  const order = (k: Kind) => { const i = cat.modules.findIndex((m) => m.title === k.module); return k.module === 'Core' ? -1 : i < 0 ? 99 : i; };
  const groups = useMemo(() => {
    const by = new Map<string, { kind: Kind; calls: Call[]; first: number }>();
    sb.model.calls.forEach((c, i) => {
      const key = `${c.target}.${c.method}`;
      const gr = by.get(key) ?? { kind: kindOf(cat, c.target, c.method), calls: [], first: i };
      gr.calls.push(c);
      by.set(key, gr);
    });
    const sorted = [...by.values()].sort((a, b) => order(a.kind) - order(b.kind) || Number(!!a.kind.input) - Number(!!b.kind.input) || a.first - b.first);
    if (!f.words.length) return sorted.map((x) => ({ ...x, total: x.calls.length }));
    // (filtered: across every kind, by the kind, the call's number, its summary and its code)
    return sorted.map((x) => ({
      ...x, total: x.calls.length,
      calls: x.calls.filter((c) => matches(`${x.kind.name} ${plural(x.kind.name)} ${x.kind.module} ${x.kind.key} #${c.id} ${summary(c, scope0, cache)} ${c.code}`, f.words)),
    })).filter((x) => x.calls.length);
  }, [sb.model, cat, f.query]);
  const found = groups.reduce((n, x) => n + x.calls.length, 0);
  useEffect(() => { setG(0); setE(0); setDetail(0); }, [f.query]);
  const gi = Math.min(g, groups.length - 1);
  const group = groups[gi];
  const calls = group?.calls ?? [];
  const ei = Math.min(e, Math.max(0, calls.length - 1));
  const call = calls[ei];
  const gw = Math.min(36, Math.floor(width * 0.27)), ew = Math.min(40, Math.floor(width * 0.28)), dw = width - gw - ew;
  const bodyH = height - 3;
  const scope = ctx.scope();
  const detailRows: Row[] = useMemo(() => {
    if (!group) return [];
    const k = group.kind;
    const rows: Row[] = [[{ text: k.name, bold: true, color: 'cyan' }, { text: `  ${k.module}${k.input ? ' · setup input' : ''}`, dim: true }], [{ text: signature(k), color: 'yellow' }]];
    if (k.doc) rows.push(...wrapText(k.doc.replace(/`/g, ''), dw - 4, 0, { dim: true }));
    if (call) rows.push([], [{ text: `${callName(call)} #${call.id}`, bold: true }], ...codeRows(`${callName(call)}(${dedent(call.code)});`, dw - 4));
    const errs = sb.errors.filter((x) => x.id === call?.id);
    for (const er of errs) rows.push([], [{ text: '! ' + er.message, color: 'red' }]);
    return highlight(rows, f.words);
  }, [group, call, dw, sb.errors, f.query]);

  useInput((input, key) => {
    if (f.keys(input, key)) return;
    if (key.leftArrow) { setPanel(0); return; }
    if (key.rightArrow) { setPanel(1); return; }
    if (key.upArrow) { if (panel === 0) { setG(Math.max(0, gi - 1)); setE(0); } else setE(Math.max(0, ei - 1)); setDetail(0); return; }
    if (key.downArrow) { if (panel === 0) { setG(Math.min(groups.length - 1, gi + 1)); setE(0); } else setE(Math.min(calls.length - 1, ei + 1)); setDetail(0); return; }
    if (key.pageDown) { setDetail((d) => d + 8); return; }
    if (key.pageUp) { setDetail((d) => Math.max(0, d - 8)); return; }
    if (!group) return;
    if (key.return && call) { ctx.edit(group.kind, call, call.code); return; }
    if (input === 'x' && call) { ctx.edit(group.kind, call, call.code, true); return; }
    if (input === 'a') { ctx.edit(group.kind, null, ctx.examples.get(group.kind.key)?.code ?? call?.code ?? ''); return; }
    if (input === 'D' && call) { const id = sb.duplicateCall(call.id); ctx.bump(); ctx.say(`Duplicated ${callName(call)} #${call.id} as #${id}`, 'green'); return; }
    if (input === 'd' && call) {
      ctx.confirm(`Remove ${callName(call)} #${call.id} (${summary(call, scope, cache)}) from the town?`, () => {
        sb.removeCall(call.id); ctx.bump(); ctx.say(`Removed ${callName(call)} #${call.id}: the town ran again to here (Story → changes shows the difference)`, 'green');
      });
    }
  }, { isActive: active });

  const gItems = groups.map((x) => ({ label: `${x.kind.module === 'Core' ? '' : x.kind.module + ' · '}${plural(x.kind.name)} (${f.words.length ? `${x.calls.length} of ${x.total}` : x.calls.length})`, dim: x.kind.input }));
  const eItems = calls.map((c) => ({ label: `#${c.id} ${summary(c, scope, cache)}`, color: sb.errors.some((x) => x.id === c.id) ? 'red' : undefined }));
  if (!ctx.visible) return null;
  return (
    <Box flexDirection="column" height={height}>
      <Box>
        <Panel title={f.query ? `/${f.query}: ${found} of ${sb.model.calls.length}` : `The town (${sb.model.calls.length} calls)`} width={gw} height={bodyH} focused={active && panel === 0}>
          <List items={gItems.length ? gItems : [{ label: 'Nothing matches', dim: true }]} selected={gi} height={bodyH - 3} width={gw - 4} focused={active && panel === 0} />
        </Panel>
        <Panel title={group ? plural(group.kind.name) : ''} width={ew} height={bodyH} focused={active && panel === 1}>
          <List items={eItems} selected={ei} height={bodyH - 3} width={ew - 4} focused={active && panel === 1} />
        </Panel>
        <Panel title="As code" width={dw} height={bodyH} note={scrollNote(detail, bodyH - 3, detailRows.length)}>
          <Rows rows={detailRows} height={bodyH - 3} offset={detail} width={dw - 4} />
        </Panel>
      </Box>
      <Foot f={f} count={found} width={width} hints={[['←→', 'kinds / things'], ['↑↓', 'pick'], ['enter', 'edit'], ['x', 'as code'], ['a', 'add'], ['D', 'duplicate'], ['d', 'remove'], ['PgUp/Dn', 'scroll code']]} />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

interface Page { label: string; head?: boolean; render?: (w: number) => Row[]; kind?: Kind; /** What it says, for filtering. */ text?: string }

export function CatalogScreen({ ctx }: { ctx: Ctx }) {
  const { sb, cat, Tyrell, width, height, active, examples } = ctx;
  const [at, setAt] = useState(0);
  const [panel, setPanel] = useState(0);
  const [offset, setOffset] = useState(0);
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const c of sb.model.calls) m.set(`${c.target}.${c.method}`, (m.get(`${c.target}.${c.method}`) || 0) + 1); return m; }, [sb.model]);
  const f = useFilter(ctx);
  const every: Page[] = useMemo(() => {
    const out: Page[] = [{ label: 'Eros: how this works', render: erosPage }];
    out.push({ label: 'Kinds a town declares', head: true });
    const mods = ['Core', ...cat.modules.map((m) => m.title)];
    for (const mod of mods) for (const k of cat.kinds.filter((x) => x.module === mod)) out.push({ label: `${mod === 'Core' ? '' : mod + ' · '}${k.name}`, kind: k, render: (w) => kindPage(k, w, examples.get(k.key), counts.get(k.key) ?? 0) });
    const inputs = [...new Set(sb.model.calls.map((c) => `${c.target}.${c.method}`))].filter((key) => !cat.kinds.some((k) => k.key === key));
    if (inputs.length) {
      out.push({ label: 'Setup inputs this town uses', head: true });
      for (const key of inputs) { const [t, m] = key.split('.'); const k = kindOf(cat, t, m); out.push({ label: `${k.module} · ${k.name}`, kind: k, render: (w) => kindPage(k, w, examples.get(k.key), counts.get(k.key) ?? 0) }); }
    }
    out.push({ label: 'Parts of Tyrell', head: true });
    for (const m of cat.modules) out.push({ label: `${m.title} (${m.kind})`, render: (w) => modulePage(m, cat, (Tyrell.MODULE_DEFAULTS as any)?.[m.name], w) });
    out.push({ label: 'Settings', head: true });
    const core = cat.config.find((c) => c.type === 'Config');
    if (core) out.push({ label: 'Core settings (config)', render: (w) => [[{ text: 'Core settings', bold: true, color: 'cyan' }, { text: '  Tyrell.create({ config })', dim: true }], [], ...settingRows(core.fields, Tyrell.DEFAULT_CONFIG, w)] });
    for (const c of cat.config) if (c.type !== 'Config' && c.module) out.push({ label: `${c.module} settings`, render: (w) => [[{ text: `${c.module} settings`, bold: true, color: 'cyan' }, { text: `  Tyrell.create({ moduleConfig: { ${c.module}: {...} } })`, dim: true }], [], ...settingRows(c.fields, (Tyrell.MODULE_DEFAULTS as any)?.[c.module], w)] });
    out.push({ label: 'Methods (the API)', head: true });
    for (const a of cat.api) out.push({ label: `${a.target === 'world' ? 'The world' : a.target} (${a.methods.length})`, render: (w) => [[{ text: a.className, bold: true, color: 'cyan' }, { text: `  ${a.file}`, dim: true }], ...(a.doc ? wrapText(a.doc, w, 0, { dim: true }) : []), [], ...apiRows(a, w)] });
    // what each page says, for filtering: its title, and everything on it
    for (const p of out) if (p.render) p.text = `${p.label}\n${p.render(100).map((r) => r.map((s) => s.text).join('')).join('\n')}`;
    return out;
  }, [cat, examples, counts, Tyrell]);
  // (filtered: the pages that say every word, under the headings they had)
  const pages: Page[] = useMemo(() => {
    if (!f.words.length) return every;
    const out: Page[] = [];
    let head: Page | null = null;
    for (const p of every) {
      if (p.head) { head = p; continue; }
      if (!matches(p.text ?? p.label, f.words)) continue;
      if (head) { out.push(head); head = null; }
      out.push(p);
    }
    return out;
  }, [every, f.query]);
  const firstPage = Math.max(0, pages.findIndex((p) => !p.head));
  useEffect(() => { setAt(firstPage); setOffset(0); }, [f.query]);
  const page: Page = pages[Math.min(at, pages.length - 1)] ?? { label: 'Nothing matches', render: () => [[{ text: `No page says all of: ${f.words.join(', ')}.`, dim: true }]] };
  const lw = 38, rw = width - lw;
  const bodyH = height - 3;
  const rows = useMemo(() => highlight(page.render ? page.render(rw - 4) : [], f.words), [page, rw, f.query]);
  const hits = useMemo(() => matchRows(rows, f.words), [rows]);
  const max = Math.max(0, rows.length - (bodyH - 3));
  // a page found by a filter opens at its first match
  useEffect(() => { if (hits.length) setOffset(Math.max(0, Math.min(max, hits[0] - 2))); }, [page, f.query]);

  useInput((input, key) => {
    if (f.keys(input, key)) return;
    const move = (d: number) => { if (!pages.length) return; let n = Math.min(at, pages.length - 1); do { n = Math.max(0, Math.min(pages.length - 1, n + d)); } while (pages[n].head && n > 0 && n < pages.length - 1); setAt(n); setOffset(0); };
    // ] and [: the next and previous match on the page
    if ((input === ']' || input === '[') && hits.length) {
      const next = input === ']' ? hits.find((h) => h > offset + 2) ?? hits[0] : [...hits].reverse().find((h) => h < offset + 2) ?? hits[hits.length - 1];
      setOffset(Math.max(0, Math.min(max, next - 2)));
      return;
    }
    if (panel === 0) {
      if (key.upArrow) { move(-1); return; }
      if (key.downArrow) { move(1); return; }
      if (key.pageUp) { move(-10); return; }
      if (key.pageDown) { move(10); return; }
      if (key.rightArrow || key.return) { setPanel(1); return; }
    } else {
      if (key.leftArrow || key.escape) { setPanel(0); return; }
      if (key.upArrow || input === 'k') { setOffset((o) => Math.max(0, o - 1)); return; }
      if (key.downArrow || input === 'j') { setOffset((o) => Math.min(max, o + 1)); return; }
      if (key.pageUp) { setOffset((o) => Math.max(0, o - (bodyH - 4))); return; }
      if (key.pageDown) { setOffset((o) => Math.min(max, o + (bodyH - 4))); return; }
    }
    if (input === 'a' && page.kind) ctx.edit(page.kind, null, examples.get(page.kind.key)?.code ?? '');
  }, { isActive: active });

  if (!ctx.visible) return null;
  return (
    <Box flexDirection="column" height={height}>
      <Box>
        <Panel title={f.query ? `Catalog · /${f.query}` : 'Catalog'} width={lw} height={bodyH} focused={active && panel === 0} note={f.query ? `${pages.filter((p) => !p.head).length} pages` : `${cat.kinds.length} kinds`}>
          <List items={pages.length ? pages.map((p) => ({ label: p.label, head: p.head, dim: p.head, color: p.head ? 'magenta' : undefined })) : [{ label: 'Nothing matches', dim: true }]} selected={Math.min(at, Math.max(0, pages.length - 1))} height={bodyH - 3} width={lw - 4} focused={active && panel === 0} />
        </Panel>
        <Panel title={page.label} width={rw} height={bodyH} focused={active && panel === 1} note={`${hits.length ? `${hits.length} match${hits.length === 1 ? '' : 'es'} · ` : ''}${scrollNote(offset, bodyH - 3, rows.length)}`}>
          <Rows rows={rows} height={bodyH - 3} offset={offset} width={rw - 4} />
        </Panel>
      </Box>
      <Foot f={f} jump count={pages.filter((p) => !p.head).length} width={width} hints={[['↑↓', panel === 0 ? 'page' : 'scroll'], [panel === 0 ? '→/enter' : '←', panel === 0 ? 'read' : 'pages'], ['PgUp/Dn', 'faster'], ...(page.kind ? [['a', `add ${/^[aeiou]/i.test(page.kind.name) ? 'an' : 'a'} ${page.kind.name.toLowerCase()} to the town`] as [string, string]] : [])]} />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Inspect
// ---------------------------------------------------------------------------

export function InspectScreen({ ctx }: { ctx: Ctx }) {
  const { sb, cat, width, height, active } = ctx;
  const f = useFilter(ctx);
  const people = sb.people().filter((x) => matches(`${x.name} ${x.id}`, f.words));
  const [at, setAt] = useState(0);
  useEffect(() => { setAt(0); setOffset(0); }, [f.query]);
  const [offset, setOffset] = useState(0);
  const p = people[Math.min(at, people.length - 1)];
  const lw = 26, rw = width - lw;
  const bodyH = height - 3;
  const rows = useMemo(() => (p && ctx.visible ? highlight(sb.describe(p.id).split('\n').flatMap((l) => wrapText(l, rw - 4, 2)), f.words) : []), [p, rw, ctx.version, sb.now, ctx.visible, f.query]);
  useInput((input, key) => {
    if (f.keys(input, key)) return;
    if (key.upArrow) { setAt((a) => Math.max(0, a - 1)); setOffset(0); return; }
    if (key.downArrow) { setAt((a) => Math.min(people.length - 1, a + 1)); setOffset(0); return; }
    if (key.pageDown || input === 'j') { setOffset((o) => Math.min(Math.max(0, rows.length - bodyH + 3), o + (key.pageDown ? bodyH - 4 : 1))); return; }
    if (key.pageUp || input === 'k') { setOffset((o) => Math.max(0, o - (key.pageUp ? bodyH - 4 : 1))); return; }
    if (key.return && p) {
      const call = sb.callFor(p.id);
      if (call) ctx.edit(kindOf(cat, 'world', 'person'), call, call.code);
      else ctx.say(`${p.name} wasn't declared by the town (a stranger, or born in the run)`, 'yellow');
    }
  }, { isActive: active });
  if (!ctx.visible) return null;
  return (
    <Box flexDirection="column" height={height}>
      <Box>
        <Panel title="People" width={lw} height={bodyH} focused={active}>
          <List items={people.length ? people.map((x) => ({ label: x.name, dim: sb.world.s.people[x.id]?.status !== 'active' })) : [{ label: 'Nobody matches', dim: true }]} selected={Math.min(at, Math.max(0, people.length - 1))} height={bodyH - 3} width={lw - 4} focused={active} />
        </Panel>
        <Panel title={p ? `${p.name} (Palantír)` : 'Nobody'} width={rw} height={bodyH} note={scrollNote(offset, bodyH - 3, rows.length)}>
          <Rows rows={rows} height={bodyH - 3} offset={offset} width={rw - 4} />
        </Panel>
      </Box>
      <Foot f={f} count={people.length} width={width} hints={[['↑↓', 'person'], ['j/k PgUp/Dn', 'scroll'], ['enter', 'edit who they are']]} />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

export function LogScreen({ ctx }: { ctx: Ctx }) {
  const { sb, width, height, active } = ctx;
  const bodyH = height - 3;
  const nameW = Math.min(14, Math.max(6, ...sb.people().map((p) => p.name.length)));
  const f = useFilter(ctx);
  // (filtered, over every entry; unfiltered, the last 2000)
  const [rows, count] = useMemo((): [Row[], number] => {
    if (!ctx.visible) return [[], 0];
    const lines = sb.entries.map((e: any) => {
      const who = e.who !== undefined ? sb.world.s.people[e.who]?.name ?? e.who : '';
      return { e, who, text: `${when(e.t)} ${who} ${e.k} ${sb.world.westmarch.describe(e)}` };
    }).filter((l: any) => matches(l.text, f.words));
    const shown = f.words.length ? lines : lines.slice(-2000);
    return [highlight(shown.flatMap(({ e, who }: any) => wrap([{ text: when(e.t) + '  ', dim: true }, { text: who.padEnd(nameW).slice(0, nameW) + '  ', bold: true }, { text: e.k.padEnd(10) + ' ', color: 'magenta' }, { text: sb.world.westmarch.describe(e) }], width - 4, 15 + nameW + 13)), f.words), lines.length];
  }, [sb.entries.length, sb, width, ctx.version, ctx.visible, f.query]);
  const scroll = useScroll(rows.length, bodyH - 3, true);
  useInput((input, key) => {
    if (f.keys(input, key)) return;
    if (key.upArrow) { scroll.keys('k', {}); return; }
    if (key.downArrow) { scroll.keys('j', {}); return; }
    scroll.keys(input, key);
  }, { isActive: active });
  if (!ctx.visible) return null;
  return (
    <Box flexDirection="column" height={height}>
      <Panel title={f.query ? `Westmarch: the log · /${f.query}: ${count} of ${sb.entries.length} entries` : `Westmarch: the log (${sb.entries.length} entries${sb.entries.length > 2000 ? ', the last 2000 shown' : ''})`} width={width} height={bodyH} focused={active} note={`${scrollNote(scroll.at, bodyH - 3, rows.length)}${scroll.follow ? ' · following' : ''}`}>
        <Rows rows={rows.length ? rows : [[{ text: f.query ? `No entry holds all of: ${f.words.join(', ')}.` : 'Nothing written yet.', dim: true }]]} height={bodyH - 3} offset={scroll.at} width={width - 4} />
      </Panel>
      <Foot f={f} count={count} width={width} hints={[['↑↓ j/k PgUp/Dn', 'scroll'], ['g/G', 'top / end (and follow)']]} />
    </Box>
  );
}

/** A line of text to type: a path, a seed, options. */
export function Prompt({ title, value: initial, hint, width, onSubmit, onCancel }: { title: string; value: string; hint?: string; width: number; onSubmit: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const [col, setCol] = useState(initial.length);
  useInput((input, key) => {
    if (key.escape) { onCancel(); return; }
    if (key.return) { onSubmit(value); return; }
    if (key.leftArrow) { setCol((c) => Math.max(0, c - 1)); return; }
    if (key.rightArrow) { setCol((c) => Math.min(value.length, c + 1)); return; }
    if (key.ctrl && input === 'a') { setCol(0); return; }
    if (key.ctrl && input === 'e') { setCol(value.length); return; }
    if (key.ctrl && input === 'u') { setValue(''); setCol(0); return; }
    if (key.backspace || key.delete) { if (col > 0) { setValue(value.slice(0, col - 1) + value.slice(col)); setCol(col - 1); } return; }
    if (key.ctrl || key.meta || key.tab) return;
    if (input) { const t = input.replace(/[\r\n]/g, ''); setValue(value.slice(0, col) + t + value.slice(col)); setCol(col + t.length); }
  });
  return (
    <Panel title={title} width={width} height={hint ? 6 : 5} focused>
      <Text wrap="truncate">{value.slice(0, col)}<Text inverse>{value[col] ?? ' '}</Text>{value.slice(col + 1)}</Text>
      {hint ? <Text dimColor wrap="truncate">{hint}</Text> : null}
      <Text dimColor>enter: go · esc: cancel · ctrl+u: clear</Text>
    </Panel>
  );
}
