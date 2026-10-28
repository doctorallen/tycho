/* Tycho 2.0.0 (tycho-minds): the bridge between Tycho and Tyrell. Built from minds/ by scripts/build.mjs; don't edit. MIT license. */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// minds/index.ts
var index_exports = {};
__export(index_exports, {
  VERSION: () => VERSION
});
module.exports = __toCommonJS(index_exports);
var VERSION = "2.0.0";
var g = globalThis;
if (g.Tycho && typeof g.Tycho === "object" && !Object.isFrozen(g.Tycho)) {
  try {
    g.Tycho.minds = { VERSION };
  } catch (e) {
  }
}
