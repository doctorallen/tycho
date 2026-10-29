// Tyrell for Eros: the repository's own build (dist/tyrell.mjs), loaded at
// run time as a game loads it, and the setup files Eros opens (Rocinante
// first), whether they're CommonJS (Rocinante's way) or ES modules.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Tyrell's exports, as far as Eros uses them. */
export type TyrellLib = Record<string, any> & { create(opts: Record<string, unknown>): any };

/** A setup file's function: (Tyrell, options) => world. */
export type Setup = (Tyrell: TyrellLib, opts: Record<string, unknown>) => any;

const require = createRequire(import.meta.url);

/** Where the repository is, from out/ (or src/ when run unbundled). */
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Rocinante, the sample town Eros opens first. */
export const ROCINANTE = resolve(ROOT, 'tyrell/examples/rocinante.js');

let lib: TyrellLib | null = null;

/** Tyrell, from dist/ (loaded once). */
export async function loadTyrell(): Promise<TyrellLib> {
  if (!lib) lib = (await import(pathToFileURL(resolve(ROOT, 'dist/tyrell.mjs')).href)) as TyrellLib;
  return lib;
}

/** A setup file's function, read afresh (an edited file reads as it is now). */
export async function loadSetup(file: string): Promise<Setup> {
  const path = resolve(file);
  // (a script in Rocinante's shape, read as an ES module, defines its function as a global instead)
  const before = new Set(Object.keys(globalThis));
  let mod: any;
  if (/\.mjs$/.test(path)) mod = await import(pathToFileURL(path).href + '?t=' + Date.now());
  else {
    delete require.cache[require.resolve(path)];
    try { mod = require(path); } catch (e: any) {
      if (e?.code !== 'ERR_REQUIRE_ESM') throw e;
      mod = await import(pathToFileURL(path).href + '?t=' + Date.now());
    }
  }
  const global = Object.keys(globalThis).find((k) => !before.has(k) && typeof (globalThis as any)[k] === 'function');
  const fn = typeof mod === 'function' ? mod : typeof mod?.default === 'function' ? mod.default : global ? (globalThis as any)[global] : null;
  if (!fn) throw new Error(`${file} doesn't export a setup function (Tyrell, options) => world`);
  return fn as Setup;
}
