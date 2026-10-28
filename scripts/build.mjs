// Builds dist/ from the sources, one version for everything (package.json's):
//
//   dist/tycho.js        the engine: a plain script that defines one global, Tycho
//   dist/tyrell.js       the minds engine: one global, Tyrell (from tyrell/src)
//   dist/tycho-minds.js  the bridge between them: one global, TychoMinds, also
//                        hung on Tycho as Tycho.minds when the engine is loaded
//   each also as .mjs (an ES module) and .cjs (Node's require), with types:
//   dist/<name>.d.ts for the module builds, dist/<name>.global.d.ts for the
//   global, and the declarations they point to in dist/types/
//   dist/tycho-sw.js     the service worker a game's own sw.js imports
//   dist/testkit.cjs     the Node test kit (Playwright, or puppeteer-core)
//
// dist/ is committed, so a game that pulls Tycho in as a git submodule loads
// the files it needs with script tags and has nothing to install or build.
// The tool versions are pinned (package.json), so dist/ builds byte for byte
// the same everywhere and CI can tell when it's stale.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLayers } from './layers.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const tsc = require.resolve('typescript/bin/tsc');

// Each layer may use only those below it, and Tyrell nothing outside itself.
const problems = checkLayers(root);
if (problems.length) { console.error('layers:\n  ' + problems.join('\n  ')); process.exit(1); }

const LIBS = [
  { name: 'tycho', src: 'src', entry: 'src/index.ts', global: 'Tycho', tsconfig: 'tsconfig.json', what: 'an engine and a shelf of game features for small pixel games' },
  { name: 'tyrell', src: 'tyrell/src', entry: 'tyrell/src/index.ts', global: 'Tyrell', tsconfig: 'tyrell/tsconfig.json', what: 'a minds engine for games full of people' },
  { name: 'tycho-minds', src: 'minds', entry: 'minds/index.ts', global: 'TychoMinds', tsconfig: 'minds/tsconfig.json', what: 'the bridge between Tycho and Tyrell' },
];
const banner = (name, what, src) => `/* ${name === 'tyrell' ? 'Tyrell' : 'Tycho'} ${pkg.version} (${name}): ${what}. Built from ${src}/ by scripts/build.mjs; don't edit. MIT license. */`;

rmSync(join(root, 'dist'), { recursive: true, force: true });
mkdirSync(join(root, 'dist'), { recursive: true });

const common = { bundle: true, target: 'es2020', charset: 'utf8', legalComments: 'none', logLevel: 'warning', define: { __VERSION__: JSON.stringify(pkg.version) } };

for (const L of LIBS) {
  const b = { ...common, entryPoints: [join(root, L.entry)], banner: { js: banner(L.name, L.what, L.src) } };
  await build({ ...b, format: 'iife', globalName: L.global, outfile: join(root, `dist/${L.name}.js`) });
  await build({ ...b, format: 'esm', outfile: join(root, `dist/${L.name}.mjs`) });
  await build({ ...b, format: 'cjs', outfile: join(root, `dist/${L.name}.cjs`) });
  execFileSync(process.execPath, [tsc, '-p', join(root, L.tsconfig)], { stdio: 'inherit' });
  const types = `./types/${L.name === 'tycho-minds' ? 'minds' : L.name}/index`;
  writeFileSync(join(root, `dist/${L.name}.d.ts`), `${banner(L.name, L.what, L.src)}\nexport * from '${types}';\n`);
  writeFileSync(join(root, `dist/${L.name}.global.d.ts`), `${banner(L.name, L.what, L.src)}
// For games that load dist/${L.name}.js with a <script> tag: reference this file
// (/// <reference path="vendor/tycho/dist/${L.name}.global.d.ts" />) to type the global.
declare const ${L.global}: typeof import('${types}');
`);
}

// the service worker: no global, run by importScripts from the game's sw.js
await build({ ...common, entryPoints: [join(root, 'sw/sw.ts')], format: 'iife', outfile: join(root, 'dist/tycho-sw.js'), banner: { js: banner('tycho-sw', 'the service worker for an installable game', 'sw') } });

// the test kit, for Node: the browser driver is the game's own (Playwright,
// or puppeteer-core), found from where the test runs
await build({ ...common, entryPoints: [join(root, 'testkit/index.ts')], platform: 'node', target: 'node18', format: 'cjs', outfile: join(root, 'dist/testkit.cjs'), external: ['playwright', 'puppeteer-core'], banner: { js: banner('testkit', 'the test kit for games on Tycho', 'testkit') } });
execFileSync(process.execPath, [tsc, '-p', join(root, 'testkit/tsconfig.json')], { stdio: 'inherit' });
writeFileSync(join(root, 'dist/testkit.d.ts'), `${banner('testkit', 'the test kit for games on Tycho', 'testkit')}\nexport * from './types/testkit/index';\n`);

const kb = (f) => (readFileSync(join(root, 'dist', f)).length / 1024).toFixed(1) + ' KB';
console.log(`built dist/ ${pkg.version}: tycho.js ${kb('tycho.js')}, tyrell.js ${kb('tyrell.js')}, tycho-minds.js ${kb('tycho-minds.js')}, tycho-sw.js ${kb('tycho-sw.js')}, testkit.cjs ${kb('testkit.cjs')}`);
