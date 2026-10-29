// The living documentation's pages, as rows to show: a kind (its fields,
// their types, defaults and meanings, and an example), a part of Tyrell
// (what it's for, its kinds, its settings and its methods), a group of
// settings with their defaults, a part's API, and Eros itself.
import type { Api, Catalog, Kind, Module } from '../catalog';
import { toCode } from '../code';
import { codeRows, dedent, wrap, wrapText, type Row, type Seg } from './text';

const plain = (s: string) => s.replace(/`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
const title = (text: string, sub = ''): Row[] => [[{ text, bold: true, color: 'cyan' }, ...(sub ? [{ text: '  ' + sub, dim: true }] : [])], []];
const head = (text: string): Row[] => [[], [{ text, bold: true, underline: true }]];

/** How a kind is declared: w.reverie.feeling(def). */
export const signature = (k: Pick<Kind, 'target' | 'method' | 'params'>) =>
  `${k.target === 'world' ? 'w' : `w.${k.target}`}.${k.method}(${k.params.map((p) => p.name + (p.optional ? '?' : '')).join(', ')})`;

/** A kind's page. */
export function kindPage(k: Kind, width: number, example?: { code: string; from: string }, count?: number): Row[] {
  const rows: Row[] = [...title(k.name, `${k.module}${k.input ? ' · a setup input' : ''}`)];
  rows.push([{ text: 'Declared with ', dim: true }, { text: signature(k), color: 'yellow' }]);
  for (const p of k.params) rows.push([{ text: `  ${p.name}${p.optional ? '?' : ''}`, bold: true }, { text: `: ${p.type}`, dim: true }]);
  if (k.doc) rows.push([], ...wrapText(plain(k.doc), width));
  rows.push([], ...wrap([{ text: 'Docs: ', dim: true }, { text: k.page }, ...(k.table ? [{ text: ` (fields from the table in ${k.table.replace(/^.*\//, '')})`, dim: true }] : [])], width, 6));
  if (count !== undefined) rows.push([{ text: 'In this town: ', dim: true }, { text: count ? `${count}` : 'none yet', bold: !!count }]);
  if (k.fields.length) {
    rows.push(...head(`Fields of ${k.def} (${k.fields.length})`));
    for (const f of k.fields) {
      const line: Seg[] = [{ text: f.name, bold: true, color: f.optional ? undefined : 'yellow' }, { text: f.optional ? '' : '  required', color: 'yellow', dim: true }, { text: `  ${f.type}`, dim: true }];
      if (f.default && f.default !== 'none' && f.default !== 'required') line.push({ text: `  default ${f.default}`, color: 'green' });
      rows.push(...wrap(line, width, 4));
      const about = plain(f.meaning || f.doc);
      if (about) rows.push(...wrapText(about, width - 4, 0).map((r) => [{ text: '    ' }, ...r]));
    }
  }
  if (example) {
    rows.push(...head('Example'), [{ text: example.from, dim: true }]);
    rows.push(...codeRows(`${k.target === 'world' ? 'w' : `w.${k.target}`}.${k.method}(${dedent(example.code)});`, width));
  }
  return rows;
}

/** A part's page: what it's for, its kinds, its settings, its methods. */
export function modulePage(m: Module, cat: Catalog, defaults: Record<string, unknown> | undefined, width: number): Row[] {
  const rows: Row[] = [...title(m.title, `${m.kind} · after ${plain(m.origin)}`)];
  rows.push(...wrapText(plain(m.about), width), [], [{ text: 'Docs: ', dim: true }, { text: m.page }]);
  const kinds = cat.kinds.filter((k) => k.target === m.name || (m.kind === 'core' && false));
  if (kinds.length) {
    rows.push(...head('What a town declares with it'));
    for (const k of kinds) rows.push(...wrap([{ text: k.name, bold: true }, { text: '  ' + signature(k), color: 'yellow' }], width, 4));
  }
  const cfg = m.config ? cat.config.find((c) => c.type === m.config) : null;
  if (cfg?.fields.length) {
    rows.push(...head(`Settings (moduleConfig.${m.name})`));
    rows.push(...settingRows(cfg.fields, defaults, width));
  }
  const api = cat.api.find((a) => a.target === m.name);
  if (api) rows.push(...head('Methods'), ...apiRows(api, width));
  return rows;
}

/** Settings with their defaults and meanings. */
export function settingRows(fields: Array<{ name: string; type: string; doc: string; meaning?: string }>, defaults: Record<string, unknown> | undefined, width: number): Row[] {
  const rows: Row[] = [];
  for (const f of fields) {
    const d = defaults && f.name in defaults ? toCode(defaults[f.name], '', new Set(), 60) : '';
    rows.push(...wrap([{ text: f.name, bold: true }, ...(d ? [{ text: ` = ${d.split('\n')[0]}`, color: 'green' }] : []), { text: `  ${f.type}`, dim: true }], width, 4));
    const about = plain(f.meaning || f.doc);
    if (about) rows.push(...wrapText(about, width - 4).map((r) => [{ text: '    ' }, ...r]));
  }
  return rows;
}

/** A part's methods, with what each takes and does. */
export function apiRows(api: Api, width: number): Row[] {
  const rows: Row[] = [];
  const on = api.target === 'world' ? 'w' : `w.${api.target}`;
  for (const m of api.methods) {
    rows.push(...wrap([{ text: `${on}.${m.method}`, bold: true, color: 'yellow' }, { text: `(${m.params.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ')})`, dim: true }, ...(m.returns ? [{ text: `: ${m.returns}`, dim: true }] : [])], width, 4));
    if (m.doc) rows.push(...wrapText(plain(m.doc), width - 4).map((r) => [{ text: '    ' }, ...r]));
  }
  return rows;
}

/** Eros's own page: what it is, and how to use it. */
export function erosPage(width: number): Row[] {
  const p = (t: string) => wrapText(t, width);
  const keys = (list: Array<[string, string]>) => list.flatMap(([k, v]) => wrap([{ text: k.padEnd(12), bold: true, color: 'yellow' }, { text: v }], width, 12));
  return [
    ...title('Eros', 'a sandbox for Tyrell, after the station in The Expanse that became one great experiment, watched from outside'),
    ...p('A town runs here, live: Rocinante to start with, or any setup file you open (a function of Tyrell and options that returns a world). Watch it, read its story as Irulan tells it, look inside anyone, and see, add and change everything it is made of. Every change builds the town again from the start and runs it to the same moment with the same seed, so what the change did shows in the story (the Changes view), and Voight-Kampff\'s checks can tell you whether people still behave like people.'),
    [],
    ...p('This catalog is the living documentation: every kind of thing a town can declare, every part of Tyrell, its settings and its methods, generated from Tyrell\'s own source and docs each time Eros is built, with an example of each.'),
    ...head('Everywhere'),
    ...keys([['1–5, tab', 'Story, Components, Catalog, Inspect, Log'], ['space', 'play or pause'], ['+ / -', 'faster or slower'], ['n / N', 'an hour or a day on'], ['b / B', 'an hour or a day back (time walk)'], ['r', 'start again from the start'], ['s', 'a new seed'], ['c / C', 'run the checks for a day or a week'], ['u', 'undo the last change'], ['o', 'open a setup file'], ['e', 'export the town as a setup file'], ['?', 'help'], ['q', 'quit']]),
    ...head('Story'),
    ...keys([['↑↓ ←→', 'pick a setting and change it'], ['j k, PgUp PgDn', 'scroll'], ['g / G', 'the top, or the end (and follow it)']]),
    ...head('Components'),
    ...keys([['←→ ↑↓', 'kinds, and the town\'s things of each'], ['enter', 'edit (a form, or code)'], ['x', 'edit as code'], ['a', 'add another'], ['D', 'duplicate'], ['d', 'remove']]),
    ...head('Catalog'),
    ...keys([['↑↓', 'pick a page'], ['→ / enter', 'read it (↑↓ scroll)'], ['a', 'add one of this kind to the town']]),
    ...head('Files'),
    ...p('Opening a file runs it with the options you give (bree, harm, together...) and records every call it makes to declare its town. Exporting writes the town as a setup file in the same shape, and checks it builds the same world. A file\'s comments and option branches aren\'t kept: an export is the town as it is now, functions kept by their source.'),
  ];
}
