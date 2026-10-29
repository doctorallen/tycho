// Starts Eros from the repository's root (npm run eros): installs its own
// dependencies the first time, builds it, and runs it, passing on any
// arguments (a setup file, --with options, --seed).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
if (!existsSync(join(here, 'node_modules', 'ink'))) {
  console.log('Eros: installing its dependencies (once)...');
  execFileSync(npm, ['install', '--no-audit', '--no-fund'], { cwd: here, stdio: 'inherit' });
}
execFileSync(process.execPath, [join(here, 'build.mjs')], { stdio: 'inherit' });
const run = spawnSync(process.execPath, [join(here, 'out', 'eros.mjs'), ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(run.status ?? 1);
