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
  Presence: () => Presence,
  Seats: () => Seats,
  VERSION: () => VERSION,
  clock: () => clock,
  collect: () => collect,
  hourOf: () => hourOf,
  minutes: () => minutes,
  progress: () => progress,
  restore: () => restore,
  stash: () => stash,
  travelTimes: () => travelTimes,
  witnesses: () => witnesses
});
module.exports = __toCommonJS(index_exports);
var VERSION = "2.0.0";
function minutes(day, hour) {
  return (day * 24 + hour) * 60;
}
function hourOf(t) {
  return (t / 60 % 24 + 24) % 24;
}
function progress(d, now) {
  const f = (now - d.start) / Math.max(1e-6, d.end - d.start);
  return f < 0 ? 0 : f > 1 ? 1 : f;
}
function clock(o) {
  const eps = o.eps ?? 1e-6;
  return {
    sync() {
      const w = o.world();
      if (!w) return "off";
      const t = o.minutes();
      if (o.remake && t < w.esper.earliest() - eps) {
        o.remake(t);
        return "remade";
      }
      if (Math.abs(t - w.now) > eps) {
        w.advanceTo(t);
        return "ran";
      }
      return "same";
    }
  };
}
function stash(world, extra) {
  return Object.assign({ tyrell: "world", v: world.s.v }, extra, { s: world.s });
}
function restore(world, saved, o = {}) {
  const sv = saved;
  let loaded = false;
  if (sv && typeof sv === "object" && sv.s && (!o.accept || o.accept(sv))) {
    try {
      world.load(sv);
      loaded = true;
    } catch (e) {
    }
  }
  if (!loaded && o.now !== void 0) world.advanceTo(o.now);
  return loaded;
}
var Seats = class {
  constructor(world) {
    this.world = world;
    this.m = /* @__PURE__ */ new Map();
  }
  /** The seat (0 to n-1) for id doing act at place since start, given n seats and the one they'd pick first. */
  take(id, place, act, start, n, first) {
    const k = place + "|" + act;
    let m = this.m.get(k);
    if (!m) this.m.set(k, m = /* @__PURE__ */ new Map());
    const mine = m.get(id);
    if (mine && mine.start === start) return mine.i;
    const w = this.world();
    for (const [q] of m) {
      const p = w && w.get(q);
      if (!p || p.place !== place || !p.doing || p.doing.kind === "travel" || p.doing.action !== act) m.delete(q);
    }
    const used = /* @__PURE__ */ new Set();
    for (const v of m.values()) used.add(v.i);
    let i = first;
    for (let t = 0; t < n; t++) {
      const j = (first + t) % n;
      if (!used.has(j)) {
        i = j;
        break;
      }
    }
    m.set(id, { i, start });
    return i;
  }
  /** Everyone stands up (a new world). */
  clear() {
    this.m.clear();
  }
};
var Presence = class {
  constructor(world, regions) {
    this.world = world;
    this.regions = regions;
    this.c = /* @__PURE__ */ new Map();
  }
  /** Whether id might be in region now (false for anyone not about). */
  may(id, region) {
    const w = this.world(), p = w && w.get(id);
    if (!p || p.status !== "active") return false;
    const d = p.doing, key = d ? d.kind + d.start + "|" + d.to + "|" + d.place : "idle|" + p.place;
    let c = this.c.get(id);
    if (!c || c.key !== key) {
      c = { key, set: new Set(this.regions(p)) };
      this.c.set(id, c);
    }
    return c.set.has(region);
  }
  /** Forgets every doing (a new world). */
  clear() {
    this.c.clear();
  }
};
function travelTimes(f) {
  const pts = /* @__PURE__ */ new Map();
  const t = (a, b) => {
    if (a === b) return 0;
    let row = pts.get(a);
    if (!row) pts.set(a, row = /* @__PURE__ */ new Map());
    let m = row.get(b);
    if (m === void 0) {
      m = f(a, b);
      row.set(b, m);
    }
    return m;
  };
  return Object.assign(t, { clear: () => pts.clear() });
}
function witnesses(at, people, o = {}) {
  const [rx, ry] = o.reach ?? [180, 40], far = o.far ?? ((n, p) => Math.abs(n.x - p.x));
  const near = (n) => o.room || Math.abs(n.x - at.x) < rx && Math.abs(n.y - at.y) < ry;
  return people.filter((n) => (!o.can || o.can(n)) && near(n)).sort((a, b) => far(a, at) - far(b, at));
}
function collect(world, kind, keep) {
  const c = { list: [], take() {
    const l = c.list;
    c.list = [];
    return l;
  } };
  world.on(kind, (d) => {
    if (!keep || keep(d)) c.list.push(d);
  });
  return c;
}
var g = globalThis;
if (g.Tycho && typeof g.Tycho === "object" && !Object.isFrozen(g.Tycho)) {
  try {
    g.Tycho.minds = { VERSION, minutes, hourOf, progress, clock, stash, restore, Seats, Presence, travelTimes, witnesses, collect };
  } catch (e) {
  }
}
