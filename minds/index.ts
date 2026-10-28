// The bridge between Tycho and Tyrell (dist/tycho-minds.js): the glue every
// game with people on Tyrell writes, which moves here from the White
// Dragon's city.js and town.js in phase 10 of the move. It uses neither
// library's code directly, only their types, so it loads after both and a
// game without people (Lodestar) never loads it.
declare const __VERSION__: string;

/** The bridge's version (Tycho's). */
export const VERSION: string = __VERSION__;

// Loaded as a plain script after dist/tycho.js, the bridge hangs itself on
// the engine as Tycho.minds too.
const g = globalThis as unknown as { Tycho?: Record<string, unknown> };
if (g.Tycho && typeof g.Tycho === 'object' && !Object.isFrozen(g.Tycho)) {
  try { g.Tycho.minds = { VERSION }; } catch (e) { /* a frozen module namespace */ }
}
