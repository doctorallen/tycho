// Editing text by keys, without the screen: a buffer of lines and a cursor,
// and what each key does to them. The code editor and the form's fields both
// use it, and the tests drive it directly.
export interface Buffer { lines: string[]; line: number; col: number }

export const bufferOf = (text: string): Buffer => ({ lines: text.split('\n'), line: 0, col: 0 });
export const textOf = (b: Buffer) => b.lines.join('\n');

/** What a key press is, as Ink reports it. */
export interface KeyPress {
  input: string;
  upArrow?: boolean; downArrow?: boolean; leftArrow?: boolean; rightArrow?: boolean;
  return?: boolean; backspace?: boolean; delete?: boolean; tab?: boolean; ctrl?: boolean; meta?: boolean;
  pageUp?: boolean; pageDown?: boolean; escape?: boolean;
}

const clampCol = (b: Buffer) => { b.col = Math.max(0, Math.min(b.col, b.lines[b.line].length)); };

/** Inserts text (a pasted run may hold newlines) at the cursor. */
export function insert(b: Buffer, text: string, multiline = true): void {
  const parts = text.replace(/\r\n?/g, '\n').split('\n');
  if (!multiline) { const t = parts.join(' '); const l = b.lines[b.line]; b.lines[b.line] = l.slice(0, b.col) + t + l.slice(b.col); b.col += t.length; return; }
  const l = b.lines[b.line];
  const before = l.slice(0, b.col), after = l.slice(b.col);
  if (parts.length === 1) { b.lines[b.line] = before + parts[0] + after; b.col += parts[0].length; return; }
  const lines = [before + parts[0], ...parts.slice(1, -1), parts[parts.length - 1] + after];
  b.lines.splice(b.line, 1, ...lines);
  b.line += parts.length - 1;
  b.col = parts[parts.length - 1].length;
}

/**
 * A key on a buffer: moves, typing, deleting, a new line (keeping the
 * indent). Returns false for a key it doesn't handle (saving, leaving).
 */
export function press(b: Buffer, k: KeyPress, multiline = true): boolean {
  if (k.upArrow) { if (b.line > 0) { b.line--; clampCol(b); } return true; }
  if (k.downArrow) { if (b.line < b.lines.length - 1) { b.line++; clampCol(b); } return true; }
  if (k.pageUp) { b.line = Math.max(0, b.line - 10); clampCol(b); return true; }
  if (k.pageDown) { b.line = Math.min(b.lines.length - 1, b.line + 10); clampCol(b); return true; }
  if (k.leftArrow) { if (b.col > 0) b.col--; else if (b.line > 0) { b.line--; b.col = b.lines[b.line].length; } return true; }
  if (k.rightArrow) { if (b.col < b.lines[b.line].length) b.col++; else if (b.line < b.lines.length - 1) { b.line++; b.col = 0; } return true; }
  if (k.ctrl && k.input === 'a') { b.col = 0; return true; }
  if (k.ctrl && k.input === 'e') { b.col = b.lines[b.line].length; return true; }
  if (k.ctrl && k.input === 'k') { b.lines[b.line] = b.lines[b.line].slice(0, b.col); return true; }
  if (k.ctrl && k.input === 'd') {
    const l = b.lines[b.line];
    if (b.col < l.length) b.lines[b.line] = l.slice(0, b.col) + l.slice(b.col + 1);
    else if (b.line < b.lines.length - 1) { b.lines[b.line] = l + b.lines[b.line + 1]; b.lines.splice(b.line + 1, 1); }
    return true;
  }
  // (a terminal's backspace comes as either)
  if (k.backspace || k.delete) {
    if (b.col > 0) { const l = b.lines[b.line]; b.lines[b.line] = l.slice(0, b.col - 1) + l.slice(b.col); b.col--; }
    else if (b.line > 0) { const prev = b.lines[b.line - 1]; b.lines[b.line - 1] = prev + b.lines[b.line]; b.lines.splice(b.line, 1); b.line--; b.col = prev.length; }
    return true;
  }
  if (k.return) {
    if (!multiline) return false;
    const indent = /^\s*/.exec(b.lines[b.line])?.[0] ?? '';
    insert(b, '\n' + indent);
    return true;
  }
  if (k.tab) { insert(b, '  ', multiline); return true; }
  if (k.ctrl || k.meta || k.escape) return false;
  if (k.input) { insert(b, k.input, multiline); return true; }
  return false;
}
