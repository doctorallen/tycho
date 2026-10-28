/* Tycho 2.0.0 (tycho-minds): the bridge between Tycho and Tyrell. Built from minds/ by scripts/build.mjs; don't edit. MIT license. */

// minds/index.ts
var VERSION = "2.0.0";
var g = globalThis;
if (g.Tycho && typeof g.Tycho === "object" && !Object.isFrozen(g.Tycho)) {
  try {
    g.Tycho.minds = { VERSION };
  } catch (e) {
  }
}
export {
  VERSION
};
