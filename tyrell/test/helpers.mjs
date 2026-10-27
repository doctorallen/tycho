// Shared helpers for the tests: the built engine, the sample town, and a
// tiny world to poke at.
import { createRequire } from 'node:module';
import * as Tyrell from '../dist/tyrell.mjs';

const require = createRequire(import.meta.url);
export const buildRocinante = require('../examples/rocinante.js');
export { Tyrell };
export const HOUR = 60, DAY = 1440;

/** The sample town. */
export function rocinante(opts = {}) { return buildRocinante(Tyrell, opts); }

/**
 * A tiny world: two homes, a cafe (7 to 22) with three seats, a park, hunger
 * and energy. Options pass through to create().
 */
export function tiny(opts = {}) {
  const w = Tyrell.create({ seed: 'tiny', start: 8 * HOUR, ...opts });
  w.need({ id: 'hunger', rise: 0.1, start: 0.3 });
  w.need({ id: 'energy', rise: 0.05, start: 0.1 });
  w.place({ id: 'home_a', tags: ['home'], region: 'homes', slots: { bed: 2 } });
  w.place({ id: 'home_b', tags: ['home'], region: 'homes', slots: { bed: 2 } });
  w.place({ id: 'cafe', tags: ['food', 'social'], region: 'main', hours: [7, 22], slots: { seat: 3 } });
  w.place({ id: 'diner', tags: ['food'], region: 'main', slots: { seat: 10 } });
  w.place({ id: 'park', tags: ['outdoors'], region: 'main' });
  w.link('home_a', 'cafe', 10); w.link('home_b', 'cafe', 12); w.link('cafe', 'park', 4); w.link('cafe', 'diner', 20); w.link('home_a', 'home_b', 3);
  w.action({ id: 'eat', at: 'tag:food', slot: 'seat', minutes: 30, relieves: { hunger: 0.7 }, pose: 'sit', tags: ['social'] });
  w.action({ id: 'sleep', at: 'home', slot: 'bed', minutes: 480, relieves: { energy: 0.95 }, tags: ['sleep'], pose: 'sleep' });
  w.action({ id: 'loaf', at: 'home', minutes: 60, base: 0.03 });
  w.action({ id: 'stroll', at: 'park', minutes: 30, base: 0.02, pose: 'walk' });
  return w;
}

/** Runs the world until a test says stop (or a limit). */
export function until(w, test, limit = 3 * DAY, step = 5) {
  const end = w.now + limit;
  while (w.now < end) {
    if (test()) return true;
    w.advanceTo(w.now + step);
  }
  return test();
}
