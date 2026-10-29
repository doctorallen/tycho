// Opening and exporting towns: a setup file run and recorded (and checked
// to build the same world as the file), and a town written out as a setup
// file (and checked by loading it back).
import { writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { exportCode, record, replay, sameAsFile } from './recorder';
import { Sandbox } from './sandbox';
import { loadSetup, type TyrellLib } from './tyrell';

/** Opens a setup file with options: a sandbox running it, and what didn't record cleanly. */
export async function openTown(Tyrell: TyrellLib, path: string, options: Record<string, unknown> = {}, seed = 'eros'): Promise<{ sandbox: Sandbox; warnings: string[] }> {
  const setup = await loadSetup(path);
  const model = record(setup, Tyrell, options, basename(path).replace(/\.(c|m)?js$/, ''));
  model.file = resolve(path);
  const differs = sameAsFile(model, setup, Tyrell, 1);
  if (differs) model.warnings.push(differs);
  return { sandbox: new Sandbox(Tyrell, model, seed), warnings: model.warnings };
}

/** Writes a sandbox's town as a setup file, loads it back, and checks it builds the same world: what to say. */
export async function exportTown(Tyrell: TyrellLib, sb: Sandbox, path: string): Promise<string> {
  const full = resolve(path);
  writeFileSync(full, exportCode(sb.model));
  const setup = await loadSetup(full);
  const a = setup(Tyrell, { seed: sb.seed });
  const { world: b } = replay(sb.model, Tyrell, { seed: sb.seed });
  a.advance(1440);
  b.advance(1440);
  return a.hash() === b.hash()
    ? `Wrote ${full}: ${sb.model.calls.length} calls, and it builds the same world as the town here.`
    : `Wrote ${full}, but loaded back it builds a different world (hash ${a.hash()}, not ${b.hash()}): a function may name something only Eros had.`;
}
