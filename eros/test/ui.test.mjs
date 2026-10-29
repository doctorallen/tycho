// The screen, drawn headless and driven by keys: the editing keys, every
// screen, a change through the form, a mistake in the code editor, adding
// from the catalog, exporting, the checks, undo, play and help.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import * as UI from '../out/app.mjs';
import { Eros, Tyrell, app, cat, folder, sandbox, wait } from './helpers.mjs';

test('the editing keys: typing, new lines that keep their indent, deleting, moving, a paste', () => {
  const b = UI.bufferOf('{ a: 1 }');
  UI.press(b, { input: '', rightArrow: true });
  UI.press(b, { input: '', ctrl: true, input: 'e' });
  UI.press(b, { input: '', return: true });
  UI.press(b, { input: 'x' });
  assert.deepEqual(b.lines, ['{ a: 1 }', 'x']);
  b.lines = ['  foo'];
  b.line = 0; b.col = 5;
  UI.press(b, { input: '', return: true });
  assert.deepEqual(b.lines, ['  foo', '  ']);
  UI.press(b, { input: '', backspace: true });
  UI.press(b, { input: '', delete: true });
  UI.press(b, { input: '', backspace: true });
  assert.deepEqual(b.lines, ['  foo']);
  UI.press(b, { input: 'a\nb' });
  assert.deepEqual(b.lines, ['  fooa', 'b']);
  assert.equal(UI.press(b, { input: 's', ctrl: true }), false, 'saving is the editor\'s, not the buffer\'s');
  const one = UI.bufferOf('x');
  one.col = 1;
  assert.equal(UI.press(one, { input: '', return: true }, false), false, 'enter is the field\'s to keep');
  UI.press(one, { input: 'a\nb' }, false);
  assert.deepEqual(one.lines, ['xa b'], 'one line stays one line');
});

test('the form shows a definition\'s fields and writes them back', () => {
  const sb = sandbox();
  const kind = cat.kinds.find((k) => k.key === 'world.person');
  const call = sb.callFor('ruth');
  const scope = { w: sb.world, Tyrell };
  const rows = UI.formRows(kind, call.code, scope);
  assert.equal(rows[0].name, 'id');
  assert.equal(rows[0].value, "'ruth'");
  assert.ok(rows.find((r) => r.name === 'name').value === "'Ruth'");
  const code = UI.formCode(kind, rows.map((r) => (r.name === 'name' ? { ...r, value: "'Ruthie'" } : r)), scope);
  assert.match(code, /^'ruth', \{/);
  assert.match(code, /name: 'Ruthie'/);
  assert.ok(UI.hasForm(kind) && !UI.hasForm(cat.kinds.find((k) => k.key === 'world.link')));
});

test('every screen draws, and keeps its place', async () => {
  const sb = sandbox({}, 1);
  const a = await app(sb);
  try {
    assert.match(a.frame(), /EROS/);
    assert.match(a.frame(), /Irulan · timeline/);
    await a.press('2');
    assert.match(a.frame(), /The town \(\d+ calls\)/);
    assert.match(a.frame(), /Needs \(5\)/);
    await a.press('3');
    assert.match(a.frame(), /Catalog/);
    // (moving skips the headings: the first kind is one down)
    await a.press('down');
    assert.match(a.frame(), /Fields of NeedDef/);
    await a.press('4');
    assert.match(a.frame(), /Mara \(Palantír\)/);
    await a.press('5');
    assert.match(a.frame(), /Westmarch: the log/);
    await a.press('3');
    assert.match(a.frame(), /Fields of NeedDef/, 'the catalog kept its place');
    await a.press('?');
    assert.match(a.frame(), /Help/);
    await a.press('esc', '1', 'left');
    assert.match(a.frame(), /Irulan · changes/);
  } finally { a.done(); }
});

test('a change through the form: the town runs again to the same moment, and the story says what changed', async () => {
  const sb = sandbox({}, 1);
  const t = sb.now;
  const a = await app(sb);
  try {
    // Components → Needs → hunger → its start
    await a.press('2', 'right', 'enter');
    assert.match(a.frame(), /Editing w\.need #1/);
    await a.press('down', 'down', 'enter', 'backspace', 'backspace', 'backspace', '0.9', 'enter', 'save');
    await a.until(/Changed w\.need #1/);
    assert.equal(sb.now, t);
    assert.match(sb.model.calls.find((c) => c.id === 1).code, /start: 0\.9/);
    assert.ok(sb.canUndo);
    await a.press('u');
    await a.until(/Undone/);
    assert.match(sb.model.calls.find((c) => c.id === 1).code, /start: 0\.3/);
  } finally { a.done(); }
});

test('a mistake in the code editor is shown there, and the town is left as it was', async () => {
  const sb = sandbox();
  const before = sb.model.calls.length;
  const a = await app(sb);
  try {
    await a.press('2', 'right', 'x');
    assert.match(a.frame(), /Editing w\.need #1/);
    await a.press('(((', 'save');
    await a.until(/doesn't read as JavaScript/);
    assert.equal(sb.model.calls.length, before);
    assert.ok(!sb.canUndo);
    await a.press('esc');
    assert.match(a.frame(), /The town/);
  } finally { a.done(); }
});

test('adding a kind the town doesn\'t have, from the catalog, with its example', async () => {
  const sb = sandbox();
  const a = await app(sb);
  try {
    await a.press('3');
    // down to Effect
    // (moving skips the headings: Eros's page, then the kinds)
    const at = 1 + cat.kinds.filter((k) => k.module === 'Core').map((k) => k.name).indexOf('Effect');
    for (let i = 0; i < at; i++) await a.press('down');
    assert.match(a.frame(), /Effect  Core/);
    await a.press('a');
    assert.match(a.frame(), /Adding an effect/);
    await a.press('save');
    await a.until(/Added w\.effect/);
    assert.ok(sb.model.calls.some((c) => c.method === 'effect'));
  } finally { a.done(); }
});

test('exporting writes a setup file that builds the same world, and opening one brings it in', async () => {
  const dir = folder();
  const sb = sandbox();
  const a = await app(sb);
  const file = join(dir, 'exported.cjs');
  try {
    await a.press('e');
    assert.match(a.frame(), /Export the town/);
    await a.press('\x15', file, 'enter');
    await a.until(/Wrote /);
    assert.ok(existsSync(file));
    assert.equal(await Eros.exportTown(Tyrell, sb, file).then((m) => /builds the same world/.test(m)), true);
    await a.press('o', '\x15', file, 'enter', '\x15', 'enter');
    await a.until(/Opened exported/);
    assert.match(a.frame(), /EROS  exported/);
  } finally { a.done(); }
});

test('the checks, play and pause, a seed', async () => {
  const sb = sandbox();
  const a = await app(sb);
  try {
    await a.press('c');
    await a.until(/Checks passed/);
    assert.match(a.frame(), /checks passed \(1d\)/);
    const t = sb.now;
    await a.press('+', '+', '+', '+', ' ');
    await wait(400);
    await a.press(' ');
    assert.ok(sb.now > t, 'it ran while playing');
    assert.match(a.frame(), /Paused at/);
    await a.press('s', '\x15', 'other', 'enter');
    await a.until(/Seed 'other'/);
    assert.equal(sb.seed, 'other');
  } finally { a.done(); }
});
