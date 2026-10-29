// The pieces every screen is made of: rows of colored segments, a panel
// with a title, a list you move through, and a view of rows that scrolls.
import { Box, Text } from 'ink';
import React from 'react';
import { fit, type Row, type Seg } from './text';

/** One row of segments. */
export function RowView({ row, width }: { row: Row; width?: number }) {
  let left = width ?? Infinity;
  const segs: Seg[] = [];
  for (const s of row) {
    if (left <= 0) break;
    const text = s.text.length > left ? s.text.slice(0, left) : s.text;
    segs.push({ ...s, text });
    left -= text.length;
  }
  return (
    <Text wrap="truncate">
      {segs.length ? segs.map((s, i) => (
        <Text key={i} color={s.color} bold={s.bold} dimColor={s.dim} inverse={s.inverse} underline={s.underline}>{s.text}</Text>
      )) : ' '}
    </Text>
  );
}

/** Rows, from an offset, as many as fit a height. */
export function Rows({ rows, height, offset, width }: { rows: Row[]; height: number; offset: number; width: number }) {
  const from = Math.max(0, Math.min(offset, Math.max(0, rows.length - height)));
  const shown = rows.slice(from, from + height);
  return (
    <Box flexDirection="column" height={height}>
      {shown.map((r, i) => <RowView key={i} row={r} width={width} />)}
    </Box>
  );
}

/** Where a scrolled view is: "12–40 of 180". */
export const scrollNote = (offset: number, height: number, total: number) =>
  total > height ? `${Math.min(offset + 1, total)}–${Math.min(offset + height, total)} of ${total}` : '';

/** A titled box. */
export function Panel({ title, width, height, focused, children, note }: { title: string; width: number; height: number; focused?: boolean; children: React.ReactNode; note?: string }) {
  return (
    <Box flexDirection="column" width={width} height={height} borderStyle="round" borderColor={focused ? 'cyan' : 'gray'}>
      <Box justifyContent="space-between" height={1}>
        <Text bold color={focused ? 'cyan' : undefined} wrap="truncate">{fit(title, Math.max(4, width - 4 - (note ? note.length + 1 : 0))).trimEnd()}</Text>
        {note ? <Text dimColor>{note}</Text> : null}
      </Box>
      {children}
    </Box>
  );
}

/** A list with one item picked, scrolled to keep it in view. */
export function List({ items, selected, height, width, focused }: { items: Array<{ label: string; dim?: boolean; head?: boolean; color?: string }>; selected: number; height: number; width: number; focused?: boolean }) {
  const from = Math.max(0, Math.min(selected - Math.floor(height / 2), items.length - height));
  return (
    <Box flexDirection="column" height={height}>
      {items.slice(from, from + height).map((it, i) => {
        const at = from + i === selected;
        return (
          <Text key={from + i} wrap="truncate" inverse={at && focused} bold={it.head || at} dimColor={it.dim && !at} color={at && !focused ? 'cyan' : it.color}>
            {fit((at ? '› ' : '  ') + it.label, width)}
          </Text>
        );
      })}
    </Box>
  );
}

/** Keys, as hints: "space play · q quit". */
export function Hints({ hints, width }: { hints: Array<[string, string]>; width: number }) {
  const segs: Seg[] = [];
  hints.forEach(([k, what], i) => {
    if (i) segs.push({ text: ' · ', dim: true });
    segs.push({ text: k, bold: true, color: 'yellow' }, { text: ' ' + what, dim: true });
  });
  return <RowView row={segs} width={width} />;
}
