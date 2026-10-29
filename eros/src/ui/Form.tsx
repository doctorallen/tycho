// The form: a call's definition as fields, one per line, each a JavaScript
// value (a number, 'a string', ['a', 'list'], { an: 'object' }, a function),
// with the field's type, default and meaning shown as you move through them.
// Built from the catalog for any kind with a definition, so every kind gets
// one; anything that won't fit on a line is edited as code instead.
import { Box, Text, useInput } from 'ink';
import React, { useMemo, useState } from 'react';
import type { Kind } from '../catalog';
import { argsCode, readArgs, toCode, type Scope } from '../code';
import { bufferOf, press, textOf, type Buffer } from './edit';
import { codeSegs, fit, wrapText, type Row } from './text';
import { Hints, Panel, RowView, Rows } from './widgets';

interface FieldRow {
  name: string;
  type: string;
  required: boolean;
  /** Its value as code ('' for unset). */
  value: string;
  /** Which argument of the call it is, or the definition's field. */
  arg: number;
  field?: boolean;
  doc: string;
  def: string;
}

/** A call's code as form rows, or null when it can't be shown as fields (it won't read, or its definition isn't an object). */
export function formRows(kind: Kind, code: string, scope: Scope): FieldRow[] | null {
  const defAt = kind.params.findIndex((p) => kind.def && p.type.replace(/\[\]$/, '') === kind.def);
  if (defAt < 0 || kind.params[defAt].type.endsWith('[]')) return null;
  let args: unknown[];
  try { args = code.trim() ? readArgs(code, scope) : []; } catch { return null; }
  const def = (args[defAt] ?? {}) as Record<string, unknown>;
  if (typeof def !== 'object' || Array.isArray(def)) return null;
  const line = (v: unknown) => (v === undefined ? '' : toCode(v, '', new Set(), Infinity));
  const rows: FieldRow[] = [];
  kind.params.forEach((p, i) => {
    if (i === defAt) return;
    rows.push({ name: p.name, type: p.type, required: !p.optional, value: line(args[i]), arg: i, doc: `The call's ${i === 0 ? 'first' : i === 1 ? 'second' : 'next'} argument.`, def: '' });
  });
  for (const f of kind.fields) {
    rows.push({ name: f.name, type: f.type, required: !f.optional, value: line(def[f.name]), arg: defAt, field: true, doc: f.meaning || f.doc, def: f.default });
  }
  // what it holds that the catalog doesn't know (a game's own field)
  for (const k of Object.keys(def)) if (!kind.fields.some((f) => f.name === k)) rows.push({ name: k, type: 'unknown', required: false, value: line(def[k]), arg: defAt, field: true, doc: 'Not a field Tyrell declares: kept as it is.', def: '' });
  return rows;
}

/** Form rows back as a call's code (tidied), or throws what reading it throws. */
export function formCode(kind: Kind, rows: FieldRow[], scope: Scope): string {
  const defAt = kind.params.findIndex((p) => kind.def && p.type.replace(/\[\]$/, '') === kind.def);
  const n = Math.max(defAt + 1, ...rows.map((r) => r.arg + 1));
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    if (i === defAt) {
      const set = rows.filter((r) => r.field && r.value.trim());
      parts.push(`{ ${set.map((r) => `${/^[A-Za-z_$][\w$]*$/.test(r.name) ? r.name : JSON.stringify(r.name)}: ${r.value}`).join(', ')} }`);
    } else parts.push(rows.find((r) => r.arg === i && !r.field)?.value || 'undefined');
  }
  while (parts.length && parts[parts.length - 1] === 'undefined') parts.pop();
  const args = readArgs(parts.join(', '), scope);
  return argsCode(args);
}

export interface FormProps {
  title: string;
  kind: Kind;
  rows: FieldRow[];
  scope: Scope;
  width: number;
  height: number;
  onSave: (code: string) => string | null;
  onCancel: () => void;
  /** Switches to the code editor with the form's code. */
  onCode: (code: string) => void;
}

export function Form({ title, kind, rows: initial, scope, width, height, onSave, onCancel, onCode }: FormProps) {
  const [rows, setRows] = useState(initial);
  const [at, setAt] = useState(0);
  const [editing, setEditing] = useState<Buffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setV] = useState(0);
  const nameW = Math.min(22, Math.max(8, ...rows.map((r) => r.name.length + 2)));
  const docH = 7;
  const listH = height - docH - 5;

  const commit = () => {
    if (!editing) return;
    const v = textOf(editing).trim();
    setRows(rows.map((r, i) => (i === at ? { ...r, value: v } : r)));
    setEditing(null);
  };
  const code = () => formCode(kind, rows, scope);

  useInput((input, key) => {
    if (editing) {
      if (key.escape) { setEditing(null); return; }
      if (key.return) { commit(); return; }
      if (press(editing, { input, ...key }, false)) { setV((v) => v + 1); }
      return;
    }
    if (key.escape) { onCancel(); return; }
    if (key.upArrow) { setAt((a) => Math.max(0, a - 1)); return; }
    if (key.downArrow) { setAt((a) => Math.min(rows.length - 1, a + 1)); return; }
    if (key.pageUp) { setAt((a) => Math.max(0, a - 10)); return; }
    if (key.pageDown) { setAt((a) => Math.min(rows.length - 1, a + 10)); return; }
    if (key.return) {
      // (a value over several lines, a long function, is edited as code)
      if (rows[at].value.includes('\n')) { try { onCode(code()); } catch (e: any) { setError(e?.message ?? String(e)); } return; }
      const b = bufferOf(rows[at].value); b.col = rows[at].value.length; setEditing(b); return;
    }
    if ((key.backspace || key.delete) && rows[at].value) { setRows(rows.map((r, i) => (i === at ? { ...r, value: '' } : r))); return; }
    if (key.ctrl && (input === 's' || input === 'x')) {
      try { setError(onSave(code())); } catch (e: any) { setError(e?.message ?? String(e)); }
      return;
    }
    if (key.ctrl && input === 'e') {
      try { onCode(code()); } catch (e: any) { setError(e?.message ?? String(e)); }
    }
  });

  const r = rows[at];
  const from = Math.max(0, Math.min(at - Math.floor(listH / 2), rows.length - listH));
  const valW = width - 4 - nameW - 2;
  const docRows: Row[] = r ? [
    [{ text: r.name, bold: true, color: 'cyan' }, { text: `  ${r.type}`, dim: true }, ...(r.required ? [{ text: '  required', color: 'yellow' }] : []), ...(r.def && r.def !== 'none' && r.def !== 'required' ? [{ text: `  default ${r.def}`, dim: true }] : [])],
    ...wrapText(r.doc.replace(/`/g, '') || 'No description.', width - 6),
  ] : [];

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Panel title={title} width={width} height={listH + 3} focused note={`${kind.name} · ${rows.filter((x) => x.value).length} set`}>
        <Box flexDirection="column">
          {rows.slice(from, from + listH).map((row, i) => {
            const n = from + i, sel = n === at;
            const label = fit((row.required ? '*' : ' ') + row.name, nameW);
            if (sel && editing) {
              const l = editing.lines[0], c = editing.col;
              const shift = c > valW - 4 ? c - valW + 6 : 0;
              const shown = l.slice(shift, shift + valW);
              const cc = c - shift;
              return <RowView key={n} width={width - 4} row={[{ text: label + '  ', bold: true, color: 'cyan' }, ...codeSegs(shown.slice(0, cc)), { text: shown[cc] ?? ' ', inverse: true }, ...codeSegs(shown.slice(cc + 1))]} />;
            }
            const v = row.value ? (row.value.includes('\n') ? row.value.split('\n')[0] + ' …' : row.value) : '';
            return <RowView key={n} width={width - 4} row={[{ text: label + '  ', bold: sel, color: sel ? 'cyan' : undefined, inverse: sel }, ...(v ? codeSegs(fit(v, valW).trimEnd()) : [{ text: row.def && row.def !== 'none' ? `(default ${row.def})` : '·', dim: true }])]} />;
          })}
        </Box>
      </Panel>
      <Panel title="About this field" width={width} height={docH}>
        <Rows rows={docRows} height={docH - 3} offset={0} width={width - 4} />
      </Panel>
      {error ? <Text color="red" wrap="truncate">{'! ' + error}</Text> : <Text dimColor wrap="truncate">Each value is JavaScript: 3, 'text', ['a', 'b'], {'{ a: 1 }'}, (ctx) =&gt; … · empty fields are left out</Text>}
      <Hints width={width} hints={editing ? [['enter', 'keep'], ['esc', 'undo the edit']] : [['↑↓', 'field'], ['enter', 'edit'], ['backspace', 'clear'], ['ctrl+s', 'apply'], ['ctrl+e', 'as code'], ['esc', 'cancel']]} />
    </Box>
  );
}

/** The kinds a form can show: a definition that's an object. */
export const hasForm = (kind: Kind) => !!kind.def && kind.fields.length > 0 && kind.params.some((p) => p.type === kind.def);

export type { FieldRow };
export const useFormRows = (kind: Kind | null, code: string, scope: Scope) => useMemo(() => (kind ? formRows(kind, code, scope) : null), [kind, code, scope]);
