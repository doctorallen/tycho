// Filtering: what every screen's `/` does. A query is words; text matches
// when it holds every one of them, in any case and any order ("sam theft").
// Matches are picked out where they're shown.
import type { Row, Seg } from './text';

/** A query's words, lowered. */
export const queryWords = (q: string): string[] => q.toLowerCase().split(/\s+/).filter(Boolean);

/** Whether text holds every word. */
export const matches = (text: string, words: string[]): boolean => {
  if (!words.length) return true;
  const t = text.toLowerCase();
  return words.every((w) => t.includes(w));
};

/** Rows with every occurrence of the words picked out (yellow, inverse). */
export function highlight(rows: Row[], words: string[]): Row[] {
  if (!words.length) return rows;
  const re = new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
  return rows.map((row) => row.flatMap((s): Seg[] => {
    const out: Seg[] = [];
    let i = 0;
    re.lastIndex = 0;
    for (let m = re.exec(s.text); m; m = re.exec(s.text)) {
      if (!m[0].length) { re.lastIndex++; continue; }
      if (m.index > i) out.push({ ...s, text: s.text.slice(i, m.index) });
      out.push({ ...s, text: m[0], inverse: true, color: 'yellow', dim: false });
      i = m.index + m[0].length;
    }
    if (i < s.text.length) out.push({ ...s, text: s.text.slice(i) });
    return out.length ? out : [s];
  }));
}

/** A row's text. */
export const rowText = (r: Row) => r.map((s) => s.text).join('');

/** The rows (by index) that hold a match: where n / N jump to. */
export const matchRows = (rows: Row[], words: string[]): number[] =>
  words.length ? rows.flatMap((r, i) => (words.some((w) => rowText(r).toLowerCase().includes(w)) ? [i] : [])) : [];
