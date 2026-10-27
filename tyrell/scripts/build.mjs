// Builds dist/ from src/:
//   dist/tyrell.js     a plain script that defines one global, Tyrell (for games
//                      that load scripts with <script> tags and no build step)
//   dist/tyrell.mjs    an ES module
//   dist/tyrell.cjs    a CommonJS module (Node's require)
//   dist/tyrell.d.ts   types for the module builds
//   dist/tyrell.global.d.ts  types for the global
//   dist/types/        the declarations they point to
// dist/ is committed, so a game that pulls Tyrell in as a git submodule
// loads dist/tyrell.js and needs nothing installed.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const banner = `/* Tyrell ${pkg.version}: a minds engine for games full of people. Built from src/ by scripts/build.mjs; don't edit. */`;

rmSync(join(root, 'dist'), { recursive: true, force: true });
mkdirSync(join(root, 'dist'), { recursive: true });

const common = {
  entryPoints: [join(root, 'src/index.ts')],
  bundle: true,
  target: 'es2020',
  charset: 'utf8',
  legalComments: 'none',
  banner: { js: banner },
  logLevel: 'warning',
};

await build({ ...common, format: 'iife', globalName: 'Tyrell', outfile: join(root, 'dist/tyrell.js') });
await build({ ...common, format: 'esm', outfile: join(root, 'dist/tyrell.mjs') });
await build({ ...common, format: 'cjs', outfile: join(root, 'dist/tyrell.cjs') });

// declarations
const tsc = require.resolve('typescript/bin/tsc');
execFileSync(process.execPath, [tsc, '-p', join(root, 'tsconfig.json')], { stdio: 'inherit' });
writeFileSync(join(root, 'dist/tyrell.d.ts'), `${banner}\nexport * from './types/index';\n`);
writeFileSync(join(root, 'dist/tyrell.global.d.ts'), `${banner}
// For games that load dist/tyrell.js with a <script> tag: reference this file
// (/// <reference path="vendor/tyrell/dist/tyrell.global.d.ts" />) to type the global.
declare const Tyrell: typeof import('./types/index');
`);

const size = readFileSync(join(root, 'dist/tyrell.js')).length;
console.log(`built dist/ (tyrell.js ${(size / 1024).toFixed(1)} KB)`);
