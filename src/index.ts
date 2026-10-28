// Tycho: an engine and a shelf of game features for small, phone-first pixel
// games in the browser. A game brings its content (places, art recipes,
// numbers, words) and its rules; Tycho brings the rest. Load dist/tycho.js
// with a script tag and name what you use once:
//
//   const { hash, Rng } = Tycho.seed;
//
// The parts come in layers, each using only those below it: core (seed,
// math, color, loop), pixels, world, play and shell. See README.md and docs/.
import * as seed from './core/seed';
import * as math from './core/math';
import * as color from './core/color';
import * as loop from './core/loop';
import * as gpu from './pixels/gpu';
import * as light from './pixels/light';
import * as post from './pixels/post';
import * as sprite from './pixels/sprite';
import * as paint from './pixels/paint';
import * as fx from './pixels/fx';
import * as grid from './world/grid';
import * as collide from './world/collide';
import * as move from './world/move';
import * as path from './world/path';
import * as input from './play/input';
import * as items from './play/items';
import * as guide from './play/guide';
import * as save from './shell/save';
import * as pwa from './shell/pwa';
import * as dev from './shell/dev';
import * as loader from './shell/loader';

declare const __VERSION__: string;

/** Tycho's version (and Tyrell's, and the bridge's: one version for all). */
export const VERSION: string = __VERSION__;

export { seed, math, color, loop, gpu, light, post, sprite, paint, fx, grid, collide, move, path, input, items, guide, save, pwa, dev, loader };
