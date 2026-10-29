// What Eros's tests share: Tyrell, Rocinante's setup, the catalog with its
// examples, a sandbox, a folder for files they write (removed afterward), and
// the app drawn headless with keys to press.
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { render } from 'ink-testing-library';
import * as Eros from '../out/lib.mjs';
import { App } from '../out/app.mjs';

export { Eros };
export const Tyrell = await Eros.loadTyrell();
export const rocinante = await Eros.loadSetup(Eros.ROCINANTE);
export const ALL = { bree: true, harm: true, together: true, tuned: true };
export const cat = Eros.loadCatalog();
export const examples = Eros.examples(cat, Tyrell, Eros.record(rocinante, Tyrell, ALL, 'rocinante'));

/** A folder for files a test writes, in out/ (ignored by git), removed when the process ends. */
export function folder() {
  const dir = mkdtempSync(join(fileURLToPath(new URL('../out/', import.meta.url)), 'test-'));
  process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** Rocinante as a sandbox, with options, run on some days. */
export function sandbox(options = {}, days = 0, seed = 'eros') {
  const model = Eros.record(rocinante, Tyrell, options, 'rocinante');
  const sb = new Eros.Sandbox(Tyrell, model, seed);
  if (days) sb.step(days * 1440);
  return sb;
}

const KEYS = { enter: '\r', down: '\x1b[B', up: '\x1b[A', right: '\x1b[C', left: '\x1b[D', esc: '\x1b', save: '\x13', backspace: '\x7f', pagedown: '\x1b[6~', tab: '\t' };
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** The app, drawn headless at a size, with a way to press keys (names or text) and read the screen. */
export async function app(sb, size = { columns: 130, rows: 34 }) {
  const view = render(React.createElement(App, {
    sandbox: sb, Tyrell, cat, examples, size, tickMs: 40,
    open: (p, o, s) => Eros.openTown(Tyrell, p, o, s), exportTo: (s, p) => Eros.exportTown(Tyrell, s, p),
  }));
  await wait(150);
  return {
    view,
    frame: () => view.lastFrame() ?? '',
    async press(...keys) {
      for (const k of keys) { view.stdin.write(KEYS[k] ?? k); await wait(120); }
    },
    /** Waits until the screen shows something (slow work runs after a short delay). */
    async until(re, ms = 15000) {
      const end = Date.now() + ms;
      while (Date.now() < end) { if (re.test(view.lastFrame() ?? '')) return true; await wait(100); }
      throw new Error(`the screen never showed ${re}:\n${view.lastFrame()}`);
    },
    done: () => view.unmount(),
  };
}
