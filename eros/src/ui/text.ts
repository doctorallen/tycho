// Text for the screen: words with colors (a segment), wrapped to a width by
// Eros itself, so every view can scroll by whole rows and knows how tall it
// is. People are bold, places green, as Irulan's parts tag them.
export interface Seg { text: string; color?: string; bold?: boolean; dim?: boolean; inverse?: boolean; underline?: boolean }
export type Row = Seg[];

/** Irulan's parts as segments: people bold, places green. */
export function partsSegs(parts: Array<{ text: string; person?: string; place?: string }>, base: Omit<Seg, 'text'> = {}): Seg[] {
  return parts.map((p) => (p.person ? { ...base, text: p.text, bold: true, color: base.color ?? 'cyan' } : p.place ? { ...base, text: p.text, color: 'green' } : { ...base, text: p.text }));
}

/** Segments wrapped at word breaks to a width; the rows after the first start with `indent` spaces. Newlines break rows. */
export function wrap(segs: Seg[], width: number, indent = 0): Row[] {
  const rows: Row[] = [];
  let row: Row = [];
  let len = 0;
  const room = (first: boolean) => Math.max(8, width - (first ? 0 : indent));
  const push = () => { rows.push(row); row = indent ? [{ text: ' '.repeat(indent) }] : []; len = 0; };
  for (const s of segs) {
    const words = s.text.split(/(\s+)/);
    for (const wd of words) {
      if (!wd) continue;
      if (wd.includes('\n')) {
        const n = wd.split('\n').length - 1;
        for (let i = 0; i < n; i++) push();
        continue;
      }
      const max = room(rows.length === 0);
      if (/^\s+$/.test(wd)) {
        if (len && len + wd.length <= max) { row.push({ ...s, text: wd }); len += wd.length; }
        continue;
      }
      let w = wd;
      if (len && len + w.length > max) push();
      // a word longer than a row is cut
      while (w.length > room(rows.length === 0) - len) {
        const cut = Math.max(1, room(rows.length === 0) - len);
        row.push({ ...s, text: w.slice(0, cut) });
        w = w.slice(cut);
        push();
      }
      row.push({ ...s, text: w });
      len += w.length;
    }
  }
  if (row.length || !rows.length) rows.push(row);
  return rows;
}

/** Plain text wrapped. */
export const wrapText = (text: string, width: number, indent = 0, base: Omit<Seg, 'text'> = {}): Row[] => wrap([{ ...base, text }], width, indent);

/** A row's length on screen. */
export const rowLength = (r: Row) => r.reduce((a, s) => a + s.text.length, 0);

/** Cut or pad text to a width. */
export function fit(text: string, width: number): string {
  if (width <= 0) return '';
  return text.length > width ? text.slice(0, Math.max(0, width - 1)) + '…' : text.padEnd(width);
}

/** JavaScript as segments, lightly colored: strings green, numbers yellow, keys and keywords picked out. */
export function codeSegs(line: string): Seg[] {
  const out: Seg[] = [];
  const re = /('(?:[^'\\]|\\.)*'?|"(?:[^"\\]|\\.)*"?|`(?:[^`\\]|\\.)*`?)|(\b\d+(?:\.\d+)?\b)|(\b(?:function|return|const|let|if|else|true|false|null|undefined|new|=>)\b|=>)|(\/\/.*$)|([A-Za-z_$][\w$]*(?=\s*:))/g;
  let i = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > i) out.push({ text: line.slice(i, m.index) });
    const t = m[0];
    out.push(m[1] ? { text: t, color: 'green' } : m[2] ? { text: t, color: 'yellow' } : m[3] ? { text: t, color: 'magenta' } : m[4] ? { text: t, dim: true } : { text: t, color: 'cyan' });
    i = m.index + t.length;
    if (!t.length) re.lastIndex++;
  }
  if (i < line.length) out.push({ text: line.slice(i) });
  return out;
}

/** Code wrapped and colored, a row per line (long lines wrap under themselves). */
export function codeRows(code: string, width: number): Row[] {
  // (wrapped as plain text first, so a break never falls inside a token, then colored a row at a time)
  return code.split('\n').flatMap((l) => {
    const lead = Math.min((/^\s*/.exec(l)?.[0].length ?? 0) + 2, Math.floor(width / 2));
    return wrap([{ text: l }], width, lead).map((r) => {
      const text = r.map((x) => x.text).join('');
      const pad = /^\s*/.exec(text)?.[0] ?? '';
      return [{ text: pad }, ...codeSegs(text.slice(pad.length))];
    });
  });
}
