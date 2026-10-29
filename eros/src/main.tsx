// Eros: a sandbox in the terminal for Tyrell, Tycho's minds engine, named for
// the station in The Expanse that became one great experiment, watched from
// outside. It opens Rocinante (or a setup file you name), runs it live, and
// shows its story, its parts and the living documentation of everything a
// town can be made of.
//
//   npm run eros [-- <setup.js>] [--with option]... [--seed s] [--days n] [--no-alt]
import { render } from 'ink';
import React from 'react';
import { examples, loadCatalog } from './catalog';
import { exportTown, openTown } from './files';
import { record } from './recorder';
import { App } from './ui/App';
import { ROCINANTE, loadSetup, loadTyrell } from './tyrell';

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const all = (name: string) => args.flatMap((a, i) => (a === '--' + name && args[i + 1] ? [args[i + 1]] : []));
const valued = new Set(['--with', '--seed', '--days']);
const file = args.find((a, i) => !a.startsWith('--') && !valued.has(args[i - 1])) ?? ROCINANTE;
const options = Object.fromEntries(all('with').map((o) => [o, true]));
const seed = flag('seed') ?? 'eros';

const Tyrell = await loadTyrell();
const cat = loadCatalog();
// an example of everything Rocinante declares, with all its options on
const ex = examples(cat, Tyrell, record(await loadSetup(ROCINANTE), Tyrell, { bree: true, harm: true, together: true, tuned: true }, 'rocinante'));
const { sandbox, warnings } = await openTown(Tyrell, file, options, seed);
if (flag('days')) sandbox.step(Number(flag('days')) * 1440);
for (const w of warnings) console.error('Eros: ' + w);

// the alternate screen, so the terminal comes back as it was
const alt = !args.includes('--no-alt') && process.stdout.isTTY;
if (alt) process.stdout.write('\x1b[?1049h\x1b[H');
const app = render(
  <App sandbox={sandbox} Tyrell={Tyrell} cat={cat} examples={ex}
    open={(path, opts, s) => openTown(Tyrell, path, opts, s)} exportTo={(sb, path) => exportTown(Tyrell, sb, path)} />,
  { exitOnCtrlC: true },
);
await app.waitUntilExit();
if (alt) process.stdout.write('\x1b[?1049l');
