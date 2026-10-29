// The code editor: a call's arguments as JavaScript, edited in place, with
// the kind's documentation and an example beside it. Saving reads the code
// back (so a mistake shows here, before the town changes) and applies it.
import { Box, Text, useInput } from 'ink';
import React, { useMemo, useRef, useState } from 'react';
import { bufferOf, press, textOf, type Buffer } from './edit';
import { codeSegs, type Row } from './text';
import { Hints, Panel, RowView, Rows, scrollNote } from './widgets';

export interface EditorProps {
  title: string;
  code: string;
  /** The documentation beside it. */
  docs: (width: number) => Row[];
  width: number;
  height: number;
  /** Applies the code: an error to show, or null when it's done. */
  onSave: (code: string) => string | null;
  onCancel: () => void;
  /** Switches to the form, with the code as it is. */
  onForm?: (code: string) => void;
}

export function Editor({ title, code, docs, width, height, onSave, onCancel, onForm }: EditorProps) {
  const [buf, setBuf] = useState<Buffer>(() => bufferOf(code));
  const [, setV] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [docOffset, setDocOffset] = useState(0);
  const top = useRef(0);
  const docWidth = Math.max(30, Math.floor(width * 0.4));
  const edWidth = width - docWidth;
  const bodyH = height - 4;
  const docRows = useMemo(() => docs(docWidth - 4), [docs, docWidth]);

  useInput((input, key) => {
    if (key.escape) { onCancel(); return; }
    if (key.ctrl && (input === 's' || input === 'x')) { const err = onSave(textOf(buf)); setError(err); return; }
    if (key.ctrl && input === 'f' && onForm) { onForm(textOf(buf)); return; }
    if (key.ctrl && input === 'p') { setDocOffset((o) => Math.max(0, o - 5)); return; }
    if (key.ctrl && input === 'n') { setDocOffset((o) => Math.min(Math.max(0, docRows.length - bodyH + 2), o + 5)); return; }
    if (press(buf, { input, ...key })) { setBuf(buf); setV((v) => v + 1); setError(null); }
  });

  // keep the cursor's line in view
  const view = bodyH - 3 - (error ? 1 : 0);
  let from = top.current;
  if (buf.line < from) from = buf.line;
  if (buf.line >= from + view) from = buf.line - view + 1;
  top.current = from;
  const gutter = String(buf.lines.length).length + 1;
  const textW = edWidth - 4 - gutter - 1;
  const rows = buf.lines.slice(from, from + view).map((l, i) => {
    const n = from + i, at = n === buf.line;
    // a long line shows the part around the cursor
    const shift = at && buf.col > textW - 4 ? buf.col - textW + 8 : 0;
    const shown = l.slice(shift, shift + textW);
    const segs = codeSegs(shown);
    let row: Row = [{ text: String(n + 1).padStart(gutter - 1) + ' ', dim: true }];
    if (at) {
      const c = buf.col - shift;
      const before = shown.slice(0, c), ch = shown[c] ?? ' ', after = shown.slice(c + 1);
      row = [...row, ...codeSegs(before), { text: ch, inverse: true }, ...codeSegs(after)];
    } else row = [...row, ...segs];
    return row;
  });

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box>
        <Panel title={title} width={edWidth} height={bodyH} focused note={`line ${buf.line + 1}, col ${buf.col + 1}`}>
          <Box flexDirection="column">
            {rows.map((r, i) => <RowView key={i} row={r} width={edWidth - 4} />)}
          </Box>
          {error ? <Text color="red" wrap="truncate">{'! ' + error}</Text> : null}
        </Panel>
        <Panel title="Docs" width={docWidth} height={bodyH} note={scrollNote(docOffset, bodyH - 3, docRows.length)}>
          <Rows rows={docRows} height={bodyH - 3} offset={docOffset} width={docWidth - 4} />
        </Panel>
      </Box>
      <Hints width={width} hints={[['ctrl+s', 'apply'], ['esc', 'cancel'], ...(onForm ? [['ctrl+f', 'form'] as [string, string]] : []), ['ctrl+p/n', 'scroll docs'], ['ctrl+a/e', 'line start/end'], ['ctrl+k', 'cut to end'], ['tab', 'indent']]} />
      <Text dimColor wrap="truncate">{'The arguments of the call, as JavaScript. `w` is the world; HOUR, DAY and Tyrell are there too. Functions are kept by their source.'}</Text>
    </Box>
  );
}
