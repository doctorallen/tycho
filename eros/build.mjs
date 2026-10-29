// Builds Eros: the catalog (the living documentation, generated from
// Tyrell's own source, so it can't drift from the engine) and the app,
// bundled with the repository's esbuild into out/. Ink and React stay
// packages, loaded from eros/node_modules; Tyrell is loaded at run time
// from the repository's dist/, as a game loads it.
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeCatalog } from './catalog.mjs';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
writeCatalog(join(here, '..'), join(here, 'out', 'catalog.json'));
await build({
  entryPoints: { eros: join(here, 'src/main.tsx'), lib: join(here, 'src/lib.ts') },
  outdir: join(here, 'out'),
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  jsx: 'automatic',
  packages: 'external',
  logLevel: 'warning',
});
