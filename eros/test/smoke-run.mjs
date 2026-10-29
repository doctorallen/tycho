import React from 'react';
import { render } from 'ink-testing-library';
import * as L from '../out/lib.mjs';
import { App } from '../out/app.mjs';
const T = await L.loadTyrell();
const cat = L.loadCatalog();
const ex = L.examples(cat, T, L.record(await L.loadSetup(L.ROCINANTE), T, { bree: true, harm: true, together: true, tuned: true }, 'rocinante'));
const { sandbox } = await L.openTown(T, L.ROCINANTE, {}, 'eros');
sandbox.step(1440);
const app = render(React.createElement(App, { sandbox, Tyrell: T, cat, examples: ex, open: (p, o, s) => L.openTown(T, p, o, s), exportTo: (sb, p) => L.exportTown(T, sb, p), size: { columns: 130, rows: 34 } }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(300);
const show = (label) => console.log(`\n===== ${label} =====\n` + app.lastFrame());
show('story');
const named = { ENTER: '\r', DOWN: '\x1b[B', UP: '\x1b[A', RIGHT: '\x1b[C', LEFT: '\x1b[D', ESC: '\x1b', SAVE: '\x13', BS: '\x7f', PGDN: '\x1b[6~' };
const only = process.env.SHOW ? process.env.SHOW.split(',') : null;
for (const k of process.argv.slice(2)) { app.stdin.write(named[k] ?? k); await wait(k === 'SAVE' || k === 'ENTER' || k === 'c' ? 2500 : 250); if (!only || only.includes(k)) show(k); }
app.unmount();
process.exit(0);
