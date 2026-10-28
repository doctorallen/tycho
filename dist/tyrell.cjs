/* Tyrell 2.0.0 (tyrell): a minds engine for games full of people. Built from tyrell/src/ by scripts/build.mjs; don't edit. MIT license. */
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
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// tyrell/src/index.ts
var index_exports = {};
__export(index_exports, {
  Athelas: () => Athelas,
  Bree: () => Bree,
  CORE_KNOBS: () => CORE_KNOBS,
  Ceres: () => Ceres,
  Cityspeak: () => Cityspeak,
  Cradle: () => Cradle,
  DAY: () => DAY,
  DEFAULT_CONFIG: () => DEFAULT_CONFIG,
  Delos: () => Delos,
  Fellowship: () => Fellowship,
  Gaff: () => Gaff,
  HOUR: () => HOUR,
  Joi: () => Joi,
  MIGRATIONS: () => MIGRATIONS,
  MODULES: () => MODULES,
  MODULE_DEFAULTS: () => MODULE_DEFAULTS,
  Mentat: () => Mentat,
  OUTCOMES: () => OUTCOMES,
  Reverie: () => Reverie,
  SCHEMA: () => SCHEMA,
  Stream: () => Stream,
  VERSION: () => VERSION,
  Voice: () => Voice,
  VoightKampff: () => VoightKampff,
  World: () => World,
  Wormtongue: () => Wormtongue,
  breeStarter: () => breeStarter,
  clamp: () => clamp,
  create: () => create,
  curveAt: () => curveAt,
  dayOf: () => dayOf,
  hash: () => hash,
  hash01: () => hash01,
  hourOf: () => hourOf,
  inHours: () => inHours
});
module.exports = __toCommonJS(index_exports);

// tyrell/src/core/conds.ts
var OPS = [">=", "<=", "!=", "==", "+=", "-=", "*=", ">", "<", "="];
function literal(raw) {
  const s = raw.trim();
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null") return null;
  if (s !== "" && !isNaN(Number(s))) return Number(s);
  if (s.startsWith('"') && s.endsWith('"') || s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  return s;
}
function splitOp(s) {
  let best = -1, op = "";
  for (const o of OPS) {
    const i = s.indexOf(o);
    if (i > 0 && (best < 0 || i < best || i === best && o.length > op.length)) {
      best = i;
      op = o;
    }
  }
  if (best < 0) return [s.trim(), "", ""];
  return [s.slice(0, best).trim(), op, s.slice(best + op.length).trim()];
}
function splitTerm(term) {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)[.:](.*)$/.exec(term);
  return m ? [m[1], m[2]] : [term, ""];
}
var truthy = (v) => !(v === void 0 || v === null || v === false || v === 0 || v === "");
function compare(a, op, b) {
  switch (op) {
    case ">=":
      return Number(a ?? 0) >= Number(b);
    case "<=":
      return Number(a ?? 0) <= Number(b);
    case ">":
      return Number(a ?? 0) > Number(b);
    case "<":
      return Number(a ?? 0) < Number(b);
    case "!=":
      return (a ?? null) !== b;
    case "==":
    case "=":
      return (a ?? null) === b || typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-9;
    default:
      return truthy(a);
  }
}
var Lang = class {
  constructor() {
    this.terms = /* @__PURE__ */ new Map();
    this.effects = /* @__PURE__ */ new Map();
    this.condCache = /* @__PURE__ */ new Map();
    this.effCache = /* @__PURE__ */ new Map();
  }
  /** Registers a term: `name` matches 'name.arg', 'name:arg' or bare 'name'. */
  term(name, fn) {
    this.terms.set(name, fn);
    this.condCache.clear();
  }
  /** Registers an effect. */
  effect(name, fn) {
    this.effects.set(name, fn);
    this.effCache.clear();
  }
  hasTerm(name) {
    return this.terms.has(name);
  }
  /** The value of a term in a context ('need.hunger', 'target.trait.honesty'). */
  value(term, ctx) {
    const [name, arg] = splitTerm(term);
    const fn = this.terms.get(name);
    if (fn) return fn(ctx, arg);
    return ctx.world.s.facts[term];
  }
  /** Compiles a condition string. */
  compile(cond) {
    let fn = this.condCache.get(cond);
    if (fn) return fn;
    let s = cond.trim(), neg = false;
    if (s.startsWith("!")) {
      neg = true;
      s = s.slice(1).trim();
    } else if (s.startsWith("not ")) {
      neg = true;
      s = s.slice(4).trim();
    }
    const [lhs, op, rhs] = splitOp(s);
    const rv = op ? literal(rhs) : null;
    fn = (ctx) => {
      const r = compare(this.value(lhs, ctx), op, rv);
      return neg ? !r : r;
    };
    this.condCache.set(cond, fn);
    return fn;
  }
  /** Tests one condition. */
  test(cond, ctx) {
    return typeof cond === "function" ? !!cond(ctx) : this.compile(cond)(ctx);
  }
  /** Tests all conditions; returns the first that failed, or null. */
  failing(conds, ctx) {
    if (!conds) return null;
    for (const c of conds) if (!this.test(c, ctx)) return c;
    return null;
  }
  /** True when every condition holds. */
  all(conds, ctx) {
    return this.failing(conds, ctx) === null;
  }
  /** Applies one effect. */
  apply(effect, ctx) {
    if (typeof effect === "function") {
      effect(ctx);
      return;
    }
    let fn = this.effCache.get(effect);
    if (!fn) {
      const [lhs, op, rhs] = splitOp(effect.trim());
      const [name, arg] = splitTerm(lhs);
      const value = op ? literal(rhs) : null;
      const handler = this.effects.get(name);
      if (!handler) {
        const v = this.effects.get("var");
        if (!v) throw new Error(`Tyrell: unknown effect '${effect}'`);
        fn = (ctx2) => v(ctx2, lhs, op, value);
      } else fn = (ctx2) => handler(ctx2, arg, op, value);
      this.effCache.set(effect, fn);
    }
    fn(ctx);
  }
  applyAll(effects, ctx) {
    if (effects) for (const e of effects) this.apply(e, ctx);
  }
};
function combine(cur, op, value) {
  switch (op) {
    case "+=":
      return Number(cur ?? 0) + Number(value);
    case "-=":
      return Number(cur ?? 0) - Number(value);
    case "*=":
      return Number(cur ?? 0) * Number(value);
    case "=":
    case "==":
      return value;
    default:
      return value ?? true;
  }
}
function itemCount(arg) {
  const m = /^(.*?)\*(\d+(?:\.\d+)?)$/.exec(arg);
  return m ? [m[1], Number(m[2])] : [arg, 1];
}

// tyrell/src/core/util.ts
var clamp = (x, lo = 0, hi = 1) => x < lo ? lo : x > hi ? hi : x;
var lerp = (a, b, t) => a + (b - a) * t;
var round = (x, places = 4) => {
  const k = 10 ** places;
  return Math.round(x * k) / k;
};
function hashString(str, seed = 0) {
  let h1 = 3735928559 ^ seed;
  let h2 = 1103547991 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
  return (h1 ^ h2) >>> 0;
}
function hash(...parts) {
  return hashString(parts.join("␟"));
}
var hash01 = (...parts) => hash(...parts) / 4294967296;
function sfc32(a, b, c, d) {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = a + b | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = c << 21 | c >>> 11;
    d = d + 1 | 0;
    t = t + d | 0;
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}
function rngFrom(...parts) {
  const key2 = parts.join("␟");
  const r = sfc32(hashString(key2, 1), hashString(key2, 2), hashString(key2, 3), hashString(key2, 4));
  for (let i = 0; i < 12; i++) r();
  return r;
}
var Stream = class {
  constructor(...parts) {
    this.r = rngFrom(...parts);
  }
  /** A float in [0, 1). */
  next() {
    return this.r();
  }
  /** A float in [lo, hi). */
  range(lo, hi) {
    return lo + (hi - lo) * this.r();
  }
  /** An integer in [0, n). */
  int(n) {
    return Math.floor(this.r() * n);
  }
  /** True with probability p. */
  chance(p) {
    return this.r() < p;
  }
  /** One item, picked uniformly. */
  pick(items) {
    return items.length ? items[this.int(items.length)] : void 0;
  }
  /** One item, picked with probability proportional to its weight. */
  weighted(items, weight) {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) return items[0];
    let x = this.r() * total;
    for (const it of items) {
      x -= Math.max(0, weight(it));
      if (x < 0) return it;
    }
    return items[items.length - 1];
  }
  /** A copy of the list in a random order. */
  shuffle(items) {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
};
var clone = (x) => x === void 0 ? x : JSON.parse(JSON.stringify(x));
function heapPush(heap, item) {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const p = i - 1 >> 1;
    if (less(heap[p], heap[i])) break;
    [heap[p], heap[i]] = [heap[i], heap[p]];
    i = p;
  }
}
function heapPop(heap) {
  if (!heap.length) return void 0;
  const top = heap[0];
  const last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    let i = 0;
    for (; ; ) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      if (l < heap.length && less(heap[l], heap[m])) m = l;
      if (r < heap.length && less(heap[r], heap[m])) m = r;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]];
      i = m;
    }
  }
  return top;
}
var heapPeek = (heap) => heap[0];
function less(a, b) {
  return a.t < b.t || a.t === b.t && a.seq < b.seq;
}
var HOUR = 60;
var DAY = 1440;
var hourOf = (t) => (t % DAY + DAY) % DAY / HOUR;
var dayOf = (t) => Math.floor(t / DAY);
function clockOf(t) {
  const m = Math.floor((t % DAY + DAY) % DAY + 1e-6) % DAY;
  return `${String(Math.floor(m / HOUR)).padStart(2, "0")}:${String(m % HOUR).padStart(2, "0")}`;
}
function inHours(h, span) {
  if (!span) return true;
  const [a, b] = span;
  if (a === b) return true;
  return a < b ? h >= a && h < b : h >= a || h < b;
}
function stableStringify(x) {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(stableStringify).join(",") + "]";
  const obj = x;
  const keys = Object.keys(obj).filter((k) => obj[k] !== void 0 && typeof obj[k] !== "function").sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

// tyrell/src/core/ring.ts
var Ring = class {
  constructor(w) {
    this.w = w;
    this.defs = /* @__PURE__ */ new Map();
    this.links = /* @__PURE__ */ new Map();
    this.cache = /* @__PURE__ */ new Map();
    this.byTag = /* @__PURE__ */ new Map();
  }
  /** Declares a place. */
  place(def) {
    this.defs.set(def.id, def);
    for (const tag of def.tags || []) {
      const list = this.byTag.get(tag) || [];
      if (!list.includes(def.id)) list.push(def.id);
      this.byTag.set(tag, list);
    }
    if (!this.w.s.places[def.id]) this.w.s.places[def.id] = this.fresh(def);
    this.cache.clear();
  }
  fresh(def) {
    const st = { claims: {} };
    if (def.stock) st.stock = { ...def.stock };
    return st;
  }
  /** Joins two places with a walk of this many minutes (both ways unless oneWay). */
  link(a, b, minutes, oneWay = false) {
    const add = (x, y) => {
      const m = this.links.get(x) || /* @__PURE__ */ new Map();
      m.set(y, minutes);
      this.links.set(x, m);
    };
    add(a, b);
    if (!oneWay) add(b, a);
    this.cache.clear();
  }
  get(id) {
    return id ? this.defs.get(id) : void 0;
  }
  state(id) {
    let st = this.w.s.places[id];
    if (!st) {
      const def = this.defs.get(id);
      st = this.w.s.places[id] = def ? this.fresh(def) : { claims: {} };
    }
    return st;
  }
  /** Every place with a tag. */
  tagged(tag) {
    return this.byTag.get(tag) || [];
  }
  hasTag(id, tag) {
    let cur = this.get(id);
    while (cur) {
      if (cur.tags && cur.tags.includes(tag)) return true;
      cur = this.get(cur.in);
    }
    return false;
  }
  /** The region a place is in: its own, or its parent's, or 'world'. */
  region(id) {
    let cur = this.get(id);
    while (cur) {
      if (cur.region) return cur.region;
      cur = this.get(cur.in);
    }
    return "world";
  }
  /** The outermost place containing this one. */
  root(id) {
    let cur = this.get(id);
    let last = id;
    while (cur && cur.in) {
      last = cur.in;
      cur = this.get(cur.in);
    }
    return last;
  }
  /** Is `inner` the place `outer` or somewhere inside it? */
  within(inner, outer) {
    let cur = inner || void 0;
    while (cur) {
      if (cur === outer) return true;
      cur = this.get(cur)?.in;
    }
    return false;
  }
  /** Is the place open at a time (its own hours and every parent's)? */
  open(id, t = this.w.now) {
    const h = hourOf(t);
    let cur = this.get(id);
    while (cur) {
      if (cur.hours && !inHours(h, cur.hours)) return false;
      if (this.w.s.facts["closed:" + cur.id] === true) return false;
      cur = this.get(cur.in);
    }
    return this.w.s.facts["closed:" + id] !== true;
  }
  /** The capacity of a slot (0 if the place has no such slot). */
  capacity(id, slot) {
    const def = this.get(id);
    const sd = def?.slots?.[slot];
    if (sd === void 0) return 0;
    return typeof sd === "number" ? sd : sd.count;
  }
  /** Who holds a slot. */
  holders(id, slot) {
    return this.state(id).claims[slot] || [];
  }
  /** Free places in a slot (Infinity when the place doesn't limit it). */
  free(id, slot) {
    if (!slot) return Infinity;
    const cap = this.capacity(id, slot);
    if (cap <= 0) return Infinity;
    return cap - this.holders(id, slot).length;
  }
  /** May this person take the slot (its `who` conditions)? */
  allowed(id, slot, p) {
    if (!slot || !p) return true;
    const sd = this.get(id)?.slots?.[slot];
    if (!sd || typeof sd !== "object" || !sd.who) return true;
    return this.w.lang.all(sd.who, { world: this.w, person: p, place: id });
  }
  /** Takes a slot. False if it's full or the person may not use it. */
  claim(id, slot, who) {
    if (!slot) return true;
    const cap = this.capacity(id, slot);
    if (cap <= 0) return true;
    const st = this.state(id);
    const list = st.claims[slot] || (st.claims[slot] = []);
    if (list.includes(who)) return true;
    if (list.length >= cap) return false;
    if (!this.allowed(id, slot, this.w.s.people[who])) return false;
    list.push(who);
    return true;
  }
  /** Lets go of a slot. */
  release(id, slot, who) {
    if (!id || !slot) return;
    const st = this.w.s.places[id];
    const list = st?.claims[slot];
    if (!list) return;
    const i = list.indexOf(who);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) delete st.claims[slot];
  }
  /** Everyone at a place right now (doing something there, not walking through). */
  present(id) {
    const out = [];
    for (const pid in this.w.s.people) {
      const p = this.w.s.people[pid];
      if (p.status === "active" && p.doing?.kind !== "travel" && p.place && this.within(p.place, id)) out.push(pid);
    }
    return out;
  }
  /** Share of a place's capacity in use (0..1). */
  crowd(id) {
    const def = this.get(id);
    if (!def?.slots) return 0;
    let cap = 0, used = 0;
    for (const k in def.slots) {
      cap += this.capacity(id, k);
      used += this.holders(id, k).length;
    }
    return cap ? used / cap : 0;
  }
  /** Travel time in minutes from a to b, for a person. */
  travel(a, b, person) {
    if (!a || !b || a === b) return 0;
    if (this.w.shell.travel) return this.w.shell.travel(a, b, person);
    const ra = this.root(a), rb = this.root(b);
    if (ra === rb) return 0;
    const key2 = ra + "" + rb;
    const hit = this.cache.get(key2);
    if (hit !== void 0) return hit;
    const d = this.dijkstra(ra, rb);
    this.cache.set(key2, d);
    return d;
  }
  dijkstra(a, b) {
    const dist = /* @__PURE__ */ new Map([[a, 0]]);
    const done = /* @__PURE__ */ new Set();
    for (; ; ) {
      let cur = null, best = Infinity;
      for (const [k, v] of dist) if (!done.has(k) && v < best) {
        best = v;
        cur = k;
      }
      if (cur === null) return Infinity;
      if (cur === b) return best;
      done.add(cur);
      const edges = this.links.get(cur);
      if (!edges) continue;
      for (const [n, m] of edges) {
        const nd = best + m;
        if (nd < (dist.get(n) ?? Infinity)) dist.set(n, nd);
      }
    }
  }
  /**
   * The candidate places for an action's place spec, for a person: nearest
   * first. 'here' and null mean where they are.
   */
  resolve(spec, person, target) {
    const specs = Array.isArray(spec) ? spec : [spec === void 0 ? null : spec];
    const out = [];
    const add = (id) => {
      if (id && !out.includes(id)) out.push(id);
    };
    for (const sp of specs) {
      if (sp === null || sp === "here") add(person.place || person.def.home);
      else if (sp === "home") add(person.def.home);
      else if (sp === "work") add(person.def.job?.place);
      else if (sp === "target") {
        const t = target ? this.w.s.people[target] : void 0;
        add(t?.place);
      } else if (sp.startsWith("tag:")) for (const id of this.tagged(sp.slice(4))) add(id);
      else if (sp.startsWith("person:")) add(this.w.s.people[sp.slice(7)]?.place);
      else add(sp);
    }
    if (out.length > 1) {
      const from = person.place;
      const d = new Map(out.map((id) => [id, this.travel(from, id, person)]));
      out.sort((x, y) => d.get(x) - d.get(y) || (x < y ? -1 : 1));
    }
    return out;
  }
};

// tyrell/src/core/bicameral.ts
function curveAt(curve, x) {
  x = clamp(x);
  if (!curve || curve === "linear") return x;
  if (typeof curve === "function") return clamp(curve(x));
  if (Array.isArray(curve)) {
    if (!curve.length) return x;
    if (x <= curve[0][0]) return curve[0][1];
    for (let i = 1; i < curve.length; i++) {
      const [x1, y1] = curve[i];
      if (x <= x1) {
        const [x0, y0] = curve[i - 1];
        return x1 === x0 ? y1 : lerp(y0, y1, (x - x0) / (x1 - x0));
      }
    }
    return curve[curve.length - 1][1];
  }
  switch (curve) {
    case "inverse":
      return 1 - x;
    case "quadratic":
      return x * x;
    case "cubic":
      return x * x * x;
    case "sqrt":
      return Math.sqrt(x);
    case "pow1.5":
      return Math.pow(x, 1.5);
    case "smooth":
      return x * x * (3 - 2 * x);
    case "logistic":
      return 1 / (1 + Math.exp(-12 * (x - 0.5)));
    case "step":
      return x >= 0.5 ? 1 : 0;
    default:
      return x;
  }
}
var mid = (r) => Array.isArray(r) ? (r[0] + r[1]) / 2 : r;
var backoffKey = (action, place) => `@fail:${action}@${place ?? ""}`;
var Bicameral = class {
  constructor(w) {
    this.w = w;
    /** The modules that change how fast needs rise (found on first use). */
    this.rateHooks = null;
  }
  /** How fast a need rises for someone now, as a multiplier on its `rise` (modules' `rate`; 1 with none). */
  riseMul(p, need) {
    const hooks = this.rateHooks ?? (this.rateHooks = this.w.hooks.filter((m2) => m2.rate));
    let m = 1;
    for (const h of hooks) m *= h.rate(p, need);
    return m * this.w.cfg.needs * this.w.own(p, "core", "needs");
  }
  // -------------------------------------------------------------------------
  // Needs
  // -------------------------------------------------------------------------
  /** A need's level at time t (default now), counting any relief in progress. */
  level(p, need, t = this.w.s.now) {
    const ns = p.needs[need];
    const def = this.w.needs.get(need);
    if (!ns || !def) return 0;
    const d = p.doing;
    const a = d && d.kind === "act" ? this.w.actions.get(d.action) : void 0;
    const rate = a?.rates?.[need];
    const rise = def.rise * this.riseMul(p, need);
    let v;
    if (rate !== void 0 && d && t > d.start) {
      const from = Math.max(ns.t, d.start);
      v = ns.v + rise * Math.max(0, d.start - ns.t) / HOUR + rise * rate * (t - from) / HOUR;
    } else v = ns.v + rise * (t - ns.t) / HOUR;
    if (a && d) {
      const r = a.relieves?.[need];
      if (r !== void 0 && t > d.start) {
        const f = clamp((t - d.start) / Math.max(1, d.end - d.start));
        v -= mid(r) * this.quality(d.place) * f;
      }
    }
    return clamp(v);
  }
  /**
   * Folds a finished (or stopped) action's effect on needs' rise into their
   * stored levels, for needs it changed the rate of. Called before relief.
   */
  settle(p, d) {
    if (d.kind !== "act") return;
    const a = this.w.actions.get(d.action);
    if (!a?.rates) return;
    const now2 = this.w.s.now;
    for (const need in a.rates) {
      const ns = p.needs[need], def = this.w.needs.get(need);
      if (!ns || !def) continue;
      const rise = def.rise * this.riseMul(p, need);
      const from = Math.max(ns.t, d.start);
      const v = ns.v + rise * Math.max(0, d.start - ns.t) / HOUR + rise * a.rates[need] * Math.max(0, now2 - from) / HOUR;
      p.needs[need] = { v: clamp(v), t: now2 };
    }
  }
  /**
   * Keeps the rise so far in every need's stored level (relief in progress
   * aside), so how fast needs rise can change from now on. Modules call it
   * before their `rate` answer changes.
   */
  settleRise(p) {
    const now2 = this.w.s.now;
    const d = p.doing;
    const a = d && d.kind === "act" ? this.w.actions.get(d.action) : void 0;
    for (const [need, def] of this.w.needs) {
      const ns = p.needs[need];
      if (!ns || ns.t >= now2) continue;
      const rise = def.rise * this.riseMul(p, need);
      const rate = a?.rates?.[need];
      let v;
      if (rate !== void 0 && d && now2 > d.start) {
        const from = Math.max(ns.t, d.start);
        v = ns.v + rise * Math.max(0, d.start - ns.t) / HOUR + rise * rate * (now2 - from) / HOUR;
      } else v = ns.v + rise * (now2 - ns.t) / HOUR;
      p.needs[need] = { v: clamp(v), t: now2 };
    }
  }
  /** Sets a need's level now. */
  setLevel(p, need, v) {
    if (!this.w.needs.has(need)) return;
    p.needs[need] = { v: clamp(v), t: this.w.s.now };
  }
  /** Makes sure a person has every declared need. */
  ensureNeeds(p) {
    for (const [id, def] of this.w.needs) if (!p.needs[id]) p.needs[id] = { v: def.start ?? this.w.cfg.needStart, t: this.w.s.now };
  }
  quality(place) {
    return this.w.ring.get(place)?.quality ?? 1;
  }
  /** The urgency of a need: its level through its curve. */
  urgency(p, need, t = this.w.s.now) {
    return curveAt(this.w.needs.get(need)?.curve ?? this.w.cfg.needCurve, this.level(p, need, t));
  }
  /**
   * When the next need will cross a line that matters: urgent, desperate, or
   * at its worst (Infinity if none will). Each can lift an option's rank.
   */
  urgentAt(p) {
    let best = Infinity;
    const a = p.doing?.kind === "act" ? this.w.actions.get(p.doing.action) : void 0;
    const relieving = a?.relieves;
    const cfg = this.w.cfg;
    for (const [id, def] of this.w.needs) {
      if (relieving && relieving[id] !== void 0) continue;
      const u = def.urgent ?? cfg.urgent;
      const rise = def.rise * this.riseMul(p, id) * (a?.rates?.[id] ?? 1);
      if (u > 1 || rise <= 0) continue;
      const v = this.level(p, id);
      for (const line of [u, Math.max(u, cfg.desperate), 1]) {
        if (v >= line - 1e-9) continue;
        const t = this.w.s.now + (line - v) / rise * HOUR;
        if (t < best) best = t;
        break;
      }
    }
    return best;
  }
  /** Applies an action's relief: frac of it, for a person, at the end. Returns realized vs expected. */
  relieve(p, d, frac) {
    const a = this.w.actions.get(d.action);
    let got = 0, expected = 0;
    if (!a?.relieves) return { got, expected };
    const q = this.quality(d.place);
    const r = this.w.stream(p);
    for (const need in a.relieves) {
      if (!this.w.needs.has(need)) continue;
      const before = this.levelRaw(p, need);
      const range = a.relieves[need];
      const amount = (Array.isArray(range) ? r.range(range[0], range[1]) : range) * q * frac;
      const after = clamp(before - amount);
      const weight = this.urgencyAt(need, before);
      got += weight * (before - after);
      expected += weight * mid(range) * q * frac;
      p.needs[need] = { v: after, t: this.w.s.now };
    }
    return { got, expected };
  }
  /** The level now ignoring relief in progress (the doing is ending). */
  levelRaw(p, need) {
    const ns = p.needs[need];
    const def = this.w.needs.get(need);
    if (!ns || !def) return 0;
    return clamp(ns.v + def.rise * this.riseMul(p, need) * (this.w.s.now - ns.t) / HOUR);
  }
  urgencyAt(need, v) {
    return curveAt(this.w.needs.get(need)?.curve ?? this.w.cfg.needCurve, v);
  }
  // -------------------------------------------------------------------------
  // Habits
  // -------------------------------------------------------------------------
  habit(p, id) {
    const h = p.habits[id];
    return h ? round((h[0] + h[1]) / 2, 4) : 1;
  }
  /** Learns from how an action went: realized relief against what was expected. */
  learn(p, id, got, expected, bonus = 0) {
    const c = this.w.cfg;
    const k = c.habits * this.w.own(p, "core", "habits");
    const h = p.habits[id] || [1, 1];
    let fast = h[0], slow = h[1];
    const ratio = expected > 1e-6 ? clamp(got / expected, 0, c.habitBest) : 1;
    fast += c.habitFast * k * (ratio - 1) + bonus;
    fast += c.habitDrift * k * (1 - fast);
    fast = clamp(fast, c.habitMin, c.habitMax);
    slow = clamp(slow + c.habitSlow * k * (fast - slow), c.habitMin, c.habitMax);
    p.habits[id] = [round(fast, 5), round(slow, 5)];
  }
  /** A reward or a telling-off: nudges the habit directly. */
  nudge(p, id, amount) {
    const c = this.w.cfg;
    const h = p.habits[id] || [1, 1];
    const fast = clamp(h[0] + amount, c.habitMin, c.habitMax);
    p.habits[id] = [round(fast, 5), round(clamp(h[1] + amount * c.nudgeSlow, c.habitMin, c.habitMax), 5)];
  }
  // -------------------------------------------------------------------------
  // The layered stack
  // -------------------------------------------------------------------------
  /** The routine plan for the day a time falls on (first matching variant). */
  routineFor(p, t = this.w.s.now) {
    const r = p.def.routine;
    if (!r || !r.length) return null;
    if (Array.isArray(r[0])) return r;
    const day = dayOf(t);
    const weekday = day % this.w.cfg.week;
    for (const v of r) {
      if (v.days && !v.days.includes(weekday)) continue;
      if (v.when && !this.w.lang.all(v.when, this.w.ctx(p))) continue;
      return v.plan;
    }
    return null;
  }
  /** The routine entry in force at time t, and when it ends. */
  routineAt(p, t = this.w.s.now) {
    const plan = this.routineFor(p, t);
    if (!plan || !plan.length) return null;
    const h = hourOf(t);
    const sorted = plan.slice().sort((a, b) => a[0] - b[0]);
    let idx = -1;
    for (let i = 0; i < sorted.length; i++) if (sorted[i][0] <= h + 1e-9) idx = i;
    const entry = idx >= 0 ? sorted[idx] : sorted[sorted.length - 1];
    const next = idx + 1 < sorted.length ? sorted[idx + 1][0] : sorted[0][0] + 24;
    const dayStart = t - h * HOUR;
    const until = dayStart + next * HOUR;
    return { entry, until: until > t ? until : until + DAY };
  }
  /** Is the person on shift at time t, and until when? */
  shiftAt(p, t = this.w.s.now) {
    const job = p.def.job;
    if (!job) return null;
    const h = hourOf(t);
    const dayStart = t - h * HOUR;
    for (const [a, b] of job.shifts) {
      if (!inHours(h, [a, b])) continue;
      const startedToday = a <= b || h >= a;
      const startDay = startedToday ? dayOf(t) : dayOf(t) - 1;
      if (job.days && !job.days.includes(startDay % this.w.cfg.week)) continue;
      let end = dayStart + b * HOUR;
      if (end <= t) end += DAY;
      return { until: end };
    }
    return null;
  }
  /** What the stack requires of a person now, highest layer first. */
  required(p) {
    const out = [];
    const now2 = this.w.s.now;
    const cfg = this.w.cfg;
    const d = p.directive;
    if (d && !(d.done && !d.repeat) && !(d.until !== void 0 && d.until <= now2)) {
      out.push({ do: d.do, at: d.at, rank: d.rank ?? cfg.storyRank, layer: "story", until: d.until ?? Infinity, target: d.target });
    }
    const shift = this.shiftAt(p);
    if (shift && p.def.job) out.push({ do: p.def.job.action, at: p.def.job.place, rank: cfg.jobRank, layer: "job", until: shift.until });
    const r = this.routineAt(p);
    if (r) {
      const [, at, act, extra] = r.entry;
      const free = (act === "*" || act === "free") && (at === null || at === void 0 || at === "here");
      if (!free) out.push({ do: act, at, rank: extra?.rank ?? cfg.routineRank, layer: "routine", until: r.until, with: extra?.with, any: act === "*" });
    }
    return out;
  }
  /** The next time something in the stack changes for a person (routine entry, shift, directive). */
  nextBoundary(p) {
    const now2 = this.w.s.now;
    let best = Infinity;
    const r = this.routineAt(p);
    if (r) best = Math.min(best, r.until);
    const job = p.def.job;
    if (job) {
      const h = hourOf(now2);
      const dayStart = now2 - h * HOUR;
      for (const [a, b] of job.shifts) {
        for (const hh of [a, b]) {
          let t = dayStart + hh * HOUR;
          if (t <= now2 + 1e-6) t += DAY;
          best = Math.min(best, t);
        }
      }
    }
    if (p.directive?.until !== void 0 && p.directive.until > now2) best = Math.min(best, p.directive.until);
    return best;
  }
  // -------------------------------------------------------------------------
  // Options and their worth
  // -------------------------------------------------------------------------
  /** Every option a person has now, weighed. */
  options(p) {
    const out = [];
    const reqs = this.required(p);
    const reqIds = /* @__PURE__ */ new Set();
    for (const r of reqs) {
      if (r.any) {
        const places2 = this.w.ring.resolve(r.at ?? null, p);
        const place = places2[0] ?? null;
        for (const a of this.w.actions.values()) {
          if (a.target) continue;
          if (!this.offeredAt(a, place, p)) continue;
          this.addOption(p, out, { id: a.id, kind: "action", place, rank: r.rank, layer: r.layer, until: r.until, fill: false }, true);
          reqIds.add(a.id + "@" + place);
        }
        continue;
      }
      const kind = this.w.tasks.has(r.do) ? "task" : "action";
      if (kind === "action" && !this.w.actions.has(r.do)) continue;
      const def = kind === "task" ? this.w.tasks.get(r.do) : this.w.actions.get(r.do);
      const at = r.at !== void 0 ? r.at : def.at;
      const places = this.w.ring.resolve(at, p, r.target);
      const target = r.target;
      for (const place of places.slice(0, this.w.cfg.placesPerAction)) {
        this.addOption(p, out, { id: r.do, kind, place, target, rank: r.rank, layer: r.layer, until: r.until }, true);
        reqIds.add(r.do + "@" + place);
      }
      if (!places.length) this.addOption(p, out, { id: r.do, kind, place: null, target, rank: r.rank, layer: r.layer, until: r.until }, true);
    }
    for (const a of this.w.actions.values()) {
      if (a.job && a.job !== p.def.job?.id) continue;
      if (a.rank !== void 0 && a.rank < 0) continue;
      if (!a.relieves && !a.base) continue;
      const places = this.w.ring.resolve(a.at ?? null, p);
      for (const place of places.slice(0, this.w.cfg.placesPerAction)) {
        if (reqIds.has(a.id + "@" + place)) continue;
        if (a.at !== void 0 && a.at !== null && !this.offeredAt(a, place, p)) continue;
        if (a.target === "person") {
          for (const t of this.targetsFor(p, a, place)) this.addOption(p, out, { id: a.id, kind: "action", place, target: t, rank: a.rank ?? 0, layer: "need" }, false);
        } else this.addOption(p, out, { id: a.id, kind: "action", place, rank: a.rank ?? 0, layer: "need" }, false);
      }
    }
    for (const t of this.w.tasks.values()) {
      if (!t.relieves && !t.base) continue;
      if (t.rank !== void 0 && t.rank < 0) continue;
      const places = t.at !== void 0 ? this.w.ring.resolve(t.at, p) : [null];
      for (const place of places.slice(0, this.w.cfg.placesPerAction)) {
        if (reqIds.has(t.id + "@" + place)) continue;
        this.addOption(p, out, { id: t.id, kind: "task", place, rank: t.rank ?? 0, layer: "need" }, false);
      }
    }
    for (const m of this.w.hooks) m.candidates?.(p, out);
    for (const c of out) if (!c.parts.length && !c.blocked) this.weigh(p, c, true);
    return out;
  }
  /** Does a place offer an action? (the action asks for the place, its tag, or the place lists it) */
  offeredAt(a, place, p) {
    if (a.at === void 0 || a.at === null || a.at === "here") return true;
    if (!place) return false;
    const specs = Array.isArray(a.at) ? a.at : [a.at];
    for (const sp of specs) {
      if (sp === null || sp === "here") return true;
      if (sp === place) return true;
      if (sp === "home" && p.def.home && this.w.ring.within(place, p.def.home)) return true;
      if (sp === "work" && p.def.job && this.w.ring.within(place, p.def.job.place)) return true;
      if (typeof sp === "string" && sp.startsWith("tag:") && this.w.ring.hasTag(place, sp.slice(4))) return true;
      if (typeof sp === "string" && (sp.startsWith("person:") || sp === "target")) return true;
    }
    return !!this.w.ring.get(place)?.offers?.includes(a.id);
  }
  /** Who an action aimed at someone could be aimed at, from a place. */
  targetsFor(p, a, place) {
    const out = [];
    const where = place || p.place;
    if (!where) return out;
    for (const id of this.w.ring.present(this.w.ring.root(where))) {
      if (id === p.id) continue;
      const ctx = this.w.ctx(p, { target: id, place: where, action: a.id });
      if (a.targetIf && !this.w.lang.all(a.targetIf, ctx)) continue;
      out.push(id);
    }
    return out.slice(0, this.w.cfg.targets);
  }
  addOption(p, out, base, required) {
    const c = { ...base, weight: 0, parts: [] };
    this.weigh(p, c, required);
    out.push(c);
  }
  /** Why an option is ruled out for a person now, or null if it isn't. */
  blockedReason(p, c) {
    const isTask = c.kind === "task";
    const def = isTask ? this.w.tasks.get(c.id) : this.w.actions.get(c.id);
    if (!def) return "not declared";
    const w = this.w;
    const ctx = w.ctx(p, { place: c.place, target: c.target ?? null, action: c.id });
    const a = def;
    if (!isTask && a.job && a.job !== p.def.job?.id) return `needs the job '${a.job}'`;
    const who = w.lang.failing(def.who, ctx);
    if (who) return `not for them (${String(who)})`;
    if (p.cool[c.id] && p.cool[c.id] > w.s.now) return `cooling down, ${Math.ceil(p.cool[c.id] - w.s.now)} min`;
    const backoff = p.cool[backoffKey(c.id, c.place ?? p.place)];
    if (backoff !== void 0 && backoff > w.s.now) return `failed recently, ${Math.ceil(backoff - w.s.now)} min`;
    const travel = c.place ? w.ring.travel(p.place, c.place, p) : 0;
    if (!isFinite(travel)) return `can't get to ${c.place}`;
    const arrive = w.s.now + travel;
    if (!isTask && a.hours && !inHours(hourOf(arrive), a.hours)) return "not at this hour";
    const staffWork = !isTask && !!a.job && p.def.job?.id === a.job && !!p.def.job && w.ring.within(c.place, p.def.job.place);
    if (c.place && !staffWork && !w.ring.open(c.place, arrive)) return `${c.place} is closed then`;
    if (c.place && !isTask && a.slot && !w.ring.allowed(c.place, a.slot, p)) return `the ${a.slot} isn't for them`;
    if (c.place && !isTask && a.slot && w.ring.free(c.place, a.slot) <= 0 && !w.ring.holders(c.place, a.slot).includes(p.id)) return `no free ${a.slot}`;
    const fail = w.lang.failing(def.if, ctx);
    if (fail) return `needs ${String(fail)}`;
    if (c.target) {
      const t = w.s.people[c.target];
      if (!t || t.status !== "active") return "they are not around";
    }
    for (const m of w.hooks) {
      const why = m.block?.(p, c);
      if (why) return why;
    }
    return null;
  }
  /** Weighs one option: fills in weight, parts and rank (or blocked). */
  weigh(p, c, required) {
    const w = this.w, cfg = w.cfg;
    c.parts = [];
    const why = this.blockedReason(p, c);
    if (why) {
      c.blocked = why;
      c.weight = 0;
      return;
    }
    const isTask = c.kind === "task";
    const def = isTask ? w.tasks.get(c.id) : w.actions.get(c.id);
    const travel = c.place ? w.ring.travel(p.place, c.place, p) : 0;
    const arrive = w.s.now + travel;
    let base = def.base ?? 0;
    let lift = 0;
    const q = w.ring.get(c.place)?.quality ?? 1;
    if (def.relieves) {
      for (const need in def.relieves) {
        const nd = w.needs.get(need);
        if (!nd) continue;
        const r = mid(def.relieves[need]) * q;
        const lvl = this.level(p, need, arrive);
        base += curveAt(nd.curve ?? cfg.needCurve, lvl) * Math.min(r, Math.max(lvl, cfg.reliefFloor));
        if (r >= cfg.liftRelief) {
          const u = nd.urgent ?? cfg.urgent;
          if (lvl >= Math.max(u, cfg.desperate)) lift = Math.max(lift, cfg.desperateRank + (lvl - cfg.desperate) * cfg.desperateSlope);
          else if (lvl >= u) lift = Math.max(lift, cfg.urgentRank);
        }
      }
    }
    if (required) base = Math.max(base, 0) + 1;
    if (base <= 0) {
      c.blocked = "nothing in it for them";
      c.weight = 0;
      return;
    }
    c.parts.push(["base", round(base)]);
    let weight = base;
    const mul = (name, f) => {
      if (f === 1 || !isFinite(f)) return;
      weight *= f;
      c.parts.push([name, round(f)]);
    };
    const cons = def.considerations || [];
    if (cons.length) {
      const ctx = w.ctx(p, { place: c.place, target: c.target ?? null, action: c.id });
      const n = cons.length;
      for (const k of cons) {
        let v = this.consider(k, ctx, travel);
        if (cfg.compensate && n > 1 && v < 1 && v > 0) v = v + (1 - v) * (1 - 1 / n) * v;
        mul(k.name || (typeof k.input === "string" ? k.input : "consideration"), v);
        if (v <= 0) break;
      }
    }
    mul("habit", this.habit(p, c.id));
    const instinct = p.def.instincts?.[c.id];
    if (instinct !== void 0) mul("instinct", instinct);
    const kind = isTask ? null : this.pallKind(def);
    if (kind) {
      const tol = this.tolerance(p, kind);
      if (tol > cfg.pallFrom) {
        const pd = w.pastimes.get(kind);
        mul(`had enough of ${pd?.label ?? kind}`, round(1 - (pd?.penalty ?? cfg.pallPenalty) * tol, 4));
      }
    }
    if (p.wishes?.length) for (const [name, f] of this.wishPull(p, c, def.tags)) mul(name, f);
    if (travel > 0) mul("travel", 1 / (1 + travel / cfg.travelScale));
    const sleepy = def.tags?.includes("sleep");
    if (!required && p.last === c.id && !sleepy && !kind && p.lastEnd !== void 0 && w.s.now - p.lastEnd < cfg.repeatWindow) mul("did it last", cfg.repeat);
    if (p.doing && p.doing.action === c.id && p.doing.place === c.place) mul("carrying on", cfg.inertia);
    for (const m of w.hooks) {
      const parts = m.consider?.(p, c);
      if (parts) for (const [name, f] of parts) mul(name, f);
    }
    c.weight = round(Math.max(0, weight), 6);
    if (c.weight <= 0) {
      c.blocked = c.blocked || "weighed nothing";
      return;
    }
    if (!required && lift > c.rank) {
      c.rank = round(lift, 3);
      c.parts.push(["urgent", c.rank]);
    }
  }
  /** Evaluates one consideration to a factor. */
  consider(k, ctx, travel = 0) {
    let x;
    if (typeof k.input === "function") x = k.input(ctx);
    else if (k.input === "travel") x = travel;
    else x = Number(this.w.lang.value(k.input, ctx) ?? 0);
    const [lo, hi] = k.range || [0, 1];
    const nx = hi === lo ? x >= hi ? 1 : 0 : (x - lo) / (hi - lo);
    const y = curveAt(k.curve, nx);
    const [o0, o1] = k.out || [0, 1];
    return lerp(o0, o1, y);
  }
  // -------------------------------------------------------------------------
  // Pastimes that pall
  // -------------------------------------------------------------------------
  /** The kind of pastime an action is (its `palls`), or null. */
  pallKind(a) {
    if (!a?.palls) return null;
    return a.palls === true ? a.id : a.palls;
  }
  /** How much of a pastime someone has had lately, 0..1 (it wears off by the hour). */
  tolerance(p, kind, t = this.w.s.now) {
    const rec = p.tol?.[kind];
    if (!rec) return 0;
    const decay = this.w.pastimes.get(kind)?.decay ?? this.w.cfg.pallDecay;
    return round(Math.max(0, rec[0] - decay * Math.max(0, t - rec[1]) / HOUR), 4);
  }
  /** One more go at a pastime (inside the simulation). */
  applyPall(p, kind) {
    const now2 = this.w.s.now;
    const tol = p.tol || (p.tol = {});
    const before = this.tolerance(p, kind);
    for (const k of Object.keys(tol)) if (this.tolerance(p, k) <= 0) delete tol[k];
    tol[kind] = [round(Math.min(1, before + (this.w.pastimes.get(kind)?.gain ?? this.w.cfg.pallGain)), 4), now2];
  }
  // -------------------------------------------------------------------------
  // Wishes and dreams
  // -------------------------------------------------------------------------
  matches(list, id, tags) {
    for (const x of list) {
      if (x === id) return true;
      if (x.startsWith("tag:") && tags?.includes(x.slice(4))) return true;
    }
    return false;
  }
  isPerson(x) {
    return typeof x === "string" && !!this.w.s.people[x];
  }
  /** The context a held wish's conditions and effects see: what it's about in data.x (and as the target, if a person). */
  wishCtx(p, h) {
    return this.w.ctx(p, { target: this.isPerson(h.x) ? h.x : null, data: { x: h.x ?? null, wish: h.id } });
  }
  aboutOf(def, ctx) {
    if (def.about === void 0) return void 0;
    const v = typeof def.about === "function" ? def.about(ctx) : this.w.lang.value(def.about, ctx);
    return v === void 0 ? void 0 : v;
  }
  /** How far along a wish with `progress` is (0..1). */
  progressOf(p, h) {
    const def = this.w.wishes.get(h.id);
    if (!def || def.progress === void 0) return null;
    const ctx = this.wishCtx(p, h);
    const v = typeof def.progress === "function" ? def.progress(ctx) : Number(this.w.lang.value(def.progress, ctx) ?? 0);
    return round(clamp(Number(v) || 0), 4);
  }
  /** The wishes (and the dream) someone holds now, with what they're about. */
  wishesOf(p) {
    const now2 = this.w.s.now;
    const out = [];
    for (const h of p.wishes || []) {
      if (h.until !== void 0 && h.until <= now2) continue;
      const def = this.w.wishes.get(h.id);
      const e = { ...h, label: def?.label ?? h.id };
      const pr = this.progressOf(p, h);
      if (pr !== null) e.progress = pr;
      out.push(e);
    }
    return out;
  }
  /** The pull of the wishes someone holds on an option: at most one wish and one dream count. */
  wishPull(p, c, tags) {
    const out = [];
    const now2 = this.w.s.now;
    let wish = false, dream = false;
    for (const h of p.wishes || []) {
      if (h.until !== void 0 && h.until <= now2) continue;
      if (h.dream ? dream : wish) continue;
      const def = this.w.wishes.get(h.id);
      if (!def?.toward || !this.matches(def.toward, c.id, tags)) continue;
      if (this.isPerson(h.x) && c.target && c.target !== h.x) continue;
      out.push([`${h.dream ? "dream" : "wish"}: ${def.label ?? def.id}`, def.pull ?? this.w.cfg.wishPull]);
      if (h.dream) dream = true;
      else wish = true;
    }
    return out;
  }
  /** Gives someone a wish (inside the simulation). Returns false if they can't wish it now. */
  applyWish(p, id, about2) {
    const w = this.w;
    const def = w.wishes.get(id);
    if (!def) return false;
    const held = p.wishes || [];
    if (held.some((h2) => h2.id === id)) return false;
    let x = about2 === null ? void 0 : about2;
    if (x === void 0 && def.about !== void 0) {
      x = this.aboutOf(def, w.ctx(p));
      if (x === void 0 || x === null) return false;
    }
    const now2 = w.s.now;
    const h = { id, t: now2 };
    const minutes = def.dream ? 0 : def.minutes ?? w.cfg.wishMinutes;
    if (minutes > 0) h.until = now2 + minutes;
    if (x !== void 0) h.x = x;
    if (def.dream) h.dream = true;
    p.wishes = [...held.filter((o) => !(def.dream && o.dream)), h];
    w.log("wished", p.id, { wish: id, ...x !== void 0 ? { x } : {} });
    w.emit("wished", { id: p.id, wish: id, x: x ?? null, label: def.label ?? id, dream: !!def.dream });
    return true;
  }
  dropWish(p, h) {
    p.wishes = (p.wishes || []).filter((o) => o !== h);
    if (!p.wishes.length) delete p.wishes;
  }
  /** A wish comes true (inside the simulation). */
  applyGrant(p, h) {
    const w = this.w;
    const def = w.wishes.get(h.id);
    this.dropWish(p, h);
    (p.granted || (p.granted = {}))[h.id] = (p.granted[h.id] || 0) + 1;
    w.log("granted", p.id, { wish: h.id, ...h.x !== void 0 ? { x: h.x } : {} });
    w.emit("granted", { id: p.id, wish: h.id, x: h.x ?? null, label: def?.label ?? h.id, dream: !!h.dream });
    if (def?.then) w.lang.applyAll(def.then, this.wishCtx(p, h));
    if (def?.next) this.applyWish(p, def.next);
  }
  fade(p, h) {
    const w = this.w;
    const def = w.wishes.get(h.id);
    this.dropWish(p, h);
    w.log("faded", p.id, { wish: h.id });
    w.emit("faded", { id: p.id, wish: h.id, x: h.x ?? null, label: def?.label ?? h.id });
    if (def?.fades) w.lang.applyAll(def.fades, this.wishCtx(p, h));
  }
  /** Grants any wish whose `by` the doing was, or whose `when` holds now. */
  checkWishes(p, d, hourly) {
    const w = this.w, now2 = w.s.now;
    for (const h of (p.wishes || []).slice()) {
      const def = w.wishes.get(h.id);
      if (!def) continue;
      if (h.until !== void 0 && h.until <= now2) {
        if (hourly) this.fade(p, h);
        continue;
      }
      if (d && d.kind === "act" && def.by && this.matches(def.by, d.action, w.actions.get(d.action)?.tags) && (!this.isPerson(h.x) || d.target === h.x)) {
        this.applyGrant(p, h);
        continue;
      }
      if (def.when?.length && w.lang.all(def.when, this.wishCtx(p, h))) {
        this.applyGrant(p, h);
        continue;
      }
      if (hourly && def.progress !== void 0 && (this.progressOf(p, h) ?? 0) >= 1) this.applyGrant(p, h);
    }
  }
  /** The wishes someone could wish now, each with its weight and what it would be about. */
  wishable(p, dream) {
    const w = this.w;
    const held = p.wishes || [];
    const ctx = w.ctx(p);
    const out = [];
    for (const id of [...w.wishes.keys()].sort()) {
      const def = w.wishes.get(id);
      if (!!def.dream !== dream || held.some((h) => h.id === id)) continue;
      if ((def.once ?? !!def.dream) && p.granted?.[id]) continue;
      if (def.if && !w.lang.all(def.if, ctx)) continue;
      const x = this.aboutOf(def, ctx);
      if (def.about !== void 0 && (x === void 0 || x === null)) continue;
      let weight = 1;
      if (typeof def.weight === "number") weight = def.weight;
      else if (typeof def.weight === "function") weight = Number(def.weight(ctx)) || 0;
      else if (def.weight) for (const k of def.weight) weight *= this.consider(k, ctx);
      if (weight > 0) out.push({ id, x, w: weight });
    }
    return out;
  }
  /** Now and then, a new wish (and a dream, for someone without one). */
  rollWishes(p) {
    const w = this.w, c = w.cfg;
    const k = c.wishes * w.own(p, "core", "wishes");
    const held = p.wishes || [];
    for (const dream of [false, true]) {
      if (dream ? held.some((h) => h.dream) : held.filter((h) => !h.dream).length >= c.wishMax) continue;
      const pool = this.wishable(p, dream);
      if (!pool.length) continue;
      const r = w.stream(p);
      if (!r.chance(c.wishChance * k)) continue;
      const pick = r.weighted(pool, (o) => o.w);
      if (pick) this.applyWish(p, pick.id, pick.x === void 0 ? void 0 : pick.x);
    }
  }
  /** An action ended (Entmoot calls this): a pastime palls, and wishes it grants come true. */
  finished(p, d, frac, interrupted) {
    const kind = this.pallKind(this.w.actions.get(d.action));
    if (kind && frac > this.w.cfg.pallDone) this.applyPall(p, kind);
    if (!interrupted && p.wishes?.length) this.checkWishes(p, d, false);
  }
  /** Every hour (Entmoot calls this): wishes are checked, fade, and new ones come at the wish hours. */
  hour(t) {
    const w = this.w;
    if (!w.wishes.size) return;
    const h = hourOf(t);
    const rolling = w.cfg.wishHours.some((x) => Math.abs(x - h) < 1e-6);
    for (const id in w.s.people) {
      const p = w.s.people[id];
      if (p.status !== "active") continue;
      if (p.wishes?.length) this.checkWishes(p, null, true);
      if (rolling) this.rollWishes(p);
    }
  }
  /** The terms, effects and inputs for pastimes and wishes (World calls this once). */
  register() {
    const w = this.w, L = w.lang;
    const held = (p, id) => p?.wishes?.find((h) => h.id === id && (h.until === void 0 || h.until > w.s.now));
    L.term("wish", (c, a) => {
      const h = held(c.person, a);
      return h ? h.x ?? true : false;
    });
    L.term("wishes", (c) => c.person ? this.wishesOf(c.person).filter((h) => !h.dream).length : 0);
    L.term("dream", (c) => c.person ? this.wishesOf(c.person).find((h) => h.dream)?.id ?? null : null);
    L.term("granted", (c, a) => c.person?.granted?.[a] ?? 0);
    L.term("tolerance", (c, a) => c.person ? this.tolerance(c.person, a) : 0);
    L.effect("wish", (c, a) => {
      if (c.person) this.applyWish(c.person, a);
    });
    L.effect("grant", (c, a) => {
      const h = held(c.person, a);
      if (c.person && h) this.applyGrant(c.person, h);
    });
    w.defineInput("wish", (id, wish, x) => {
      const p = w.s.people[id];
      return p ? this.applyWish(p, wish, x === null ? void 0 : x) : false;
    });
    w.defineInput("grant", (id, wish) => {
      const p = w.s.people[id];
      const h = held(p, wish);
      if (p && h) this.applyGrant(p, h);
    });
  }
  // -------------------------------------------------------------------------
  // The pick
  // -------------------------------------------------------------------------
  /** Picks from options: top rank, cut the weak, a weighted draw. */
  pick(p, options) {
    const valid = options.filter((c) => !c.blocked && c.weight > 0);
    if (!valid.length) return { picked: null, reason: "nothing to do" };
    let top = -Infinity;
    for (const c of valid) top = Math.max(top, c.rank);
    let pool = valid.filter((c) => c.rank === top);
    const best = Math.max(...pool.map((c) => c.weight));
    const cfg = this.w.cfg;
    pool = pool.filter((c) => c.weight >= best * cfg.cut).sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : 1)).slice(0, cfg.top);
    const r = this.w.stream(p);
    const picked = r.weighted(pool, (c) => Math.pow(c.weight, cfg.power)) || pool[0];
    const others = pool.filter((c) => c !== picked).map((c) => c.id).join(", ");
    const reason = `${picked.layer} at rank ${picked.rank}` + (others ? `; beat ${others}` : "") + (valid.length > pool.length ? `; ${valid.length - pool.length} more ruled out by rank or weight` : "");
    return { picked, reason };
  }
  /** Thinks: weighs every option, picks one, and records the decision. */
  decide(p) {
    const options = this.options(p);
    const { picked, reason } = this.pick(p, options);
    const dec = { t: this.w.s.now, who: p.id, picked, candidates: options, reason };
    this.w.palantir.record(dec);
    return dec;
  }
  /** Weighs one action or task now for the inspector, even if it wasn't considered. Changes nothing. */
  explain(p, id) {
    return this.w.peek(() => this.explainNow(p, id));
  }
  explainNow(p, id) {
    const kind = this.w.tasks.has(id) ? "task" : "action";
    const def = kind === "task" ? this.w.tasks.get(id) : this.w.actions.get(id);
    if (!def) return [];
    const places = this.w.ring.resolve(def.at ?? null, p);
    const out = [];
    for (const place of places.length ? places : [null]) {
      const c = { id, kind, place, rank: def.rank ?? 0, layer: "need", weight: 0, parts: [] };
      if (kind === "action" && place && !this.offeredAt(def, place, p)) c.blocked = `${place} doesn't offer it`;
      else this.weigh(p, c, false);
      out.push(c);
    }
    return out;
  }
};

// tyrell/src/core/entmoot.ts
var now = () => typeof performance !== "undefined" ? performance.now() : Date.now();
var MAX_FAILS = 10;
var Entmoot = class {
  constructor(w) {
    this.w = w;
    /** Regions the game has loaded (not saved: the game says it again after a load). */
    this.regions = /* @__PURE__ */ new Set();
    /** Who has a body right now. */
    this.near = /* @__PURE__ */ new Set();
    this.started = false;
    /** The seq of the event being handled, or null (World defers inputs made meanwhile). */
    this.handling = null;
  }
  /** Called once at creation: starts the hourly tick. */
  boot() {
    if (this.started) return;
    this.started = true;
    const t = this.w.s.now;
    const next = Math.floor(t / HOUR) * HOUR + HOUR;
    this.schedule({ t: next, k: "hour" });
  }
  /** Forgets transient things (after a load or a seek). */
  reset() {
    for (const id of this.near) this.w.emit("disembody", { id });
    this.near.clear();
  }
  /** Puts something on the queue. */
  schedule(item) {
    const seq = this.w.nextSeq();
    heapPush(this.w.s.q, { ...item, seq });
    return seq;
  }
  /** Queues the end of someone's current doing; the doing carries the same seq. */
  scheduleEnd(p, t) {
    const seq = this.w.nextSeq();
    heapPush(this.w.s.q, { t, seq, k: "end", who: p.id, ref: seq });
    return seq;
  }
  // -------------------------------------------------------------------------
  // Running time
  // -------------------------------------------------------------------------
  /**
   * Runs events up to time `target`. Inputs Esper still has in its future
   * (after a rewind) are applied at their times. With a budget, stops early
   * (at a whole timestamp) and returns false; the rest runs next frame.
   */
  advanceTo(target, budgetMs) {
    const w = this.w, q = w.s.q, esper = w.esper;
    const t0 = budgetMs < Infinity ? now() : 0;
    esper.ensureBase();
    for (; ; ) {
      const ev = heapPeek(q);
      const inp = esper.pending();
      if (inp && inp.after === void 0 && !inp.chain && inp.t <= target && (!ev || ev.t > inp.t)) {
        esper.passMarks(inp.t);
        if (inp.t > w.s.now) w.s.now = inp.t;
        esper.applyNext();
        continue;
      }
      if (ev && ev.t <= target) {
        esper.passMarks(ev.t);
        heapPop(q);
        if (ev.t > w.s.now) w.s.now = ev.t;
        this.run(ev);
        if (budgetMs < Infinity && now() - t0 > budgetMs) {
          let more = heapPeek(q);
          while (more && more.t === ev.t) {
            heapPop(q);
            this.run(more);
            more = heapPeek(q);
          }
          return false;
        }
        continue;
      }
      break;
    }
    esper.passMarks(target);
    if (target > w.s.now) w.s.now = target;
    return true;
  }
  /** Handles one event, then the inputs that came in while it was handled. */
  run(ev) {
    const w = this.w;
    this.handling = ev.seq;
    try {
      this.handle(ev);
    } finally {
      this.handling = null;
    }
    w.flushDeferred(ev.seq);
    for (let inp = w.esper.pending(); inp && inp.after === ev.seq; inp = w.esper.pending()) w.esper.applyNext();
  }
  handle(ev) {
    const w = this.w;
    switch (ev.k) {
      case "end": {
        const p = ev.who ? w.s.people[ev.who] : void 0;
        if (!p || p.status !== "active" || !p.doing || p.doing.seq !== ev.ref) return;
        this.finish(p);
        return;
      }
      case "think": {
        const p = ev.who ? w.s.people[ev.who] : void 0;
        if (!p || p.status !== "active") return;
        const mode = String(ev.data?.mode ?? "free");
        if (mode === "free") {
          if (p.doing) return;
          this.think(p);
        } else this.reconsider(p, mode);
        return;
      }
      case "hour": {
        const t = ev.t;
        w.mind.hour(t);
        for (const m of w.hooks) m.hour?.(t);
        if (Math.round(hourOf(t) * 60) % (24 * 60) === 0) {
          const day = Math.round(t / DAY);
          for (const m of w.hooks) m.day?.(day);
          w.log("day", void 0, { day });
        }
        this.schedule({ t: t + HOUR, k: "hour" });
        return;
      }
      case "timer": {
        const name = String(ev.ref ?? "");
        w.log("timer", void 0, { name });
        w.emit("timer", { name, data: ev.data ?? {}, t: ev.t });
        w.emit("timer:" + name, { name, data: ev.data ?? {}, t: ev.t });
        return;
      }
      case "module": {
        const m = w.modules.get(String(ev.ref));
        m?.timer?.(ev);
        return;
      }
      case "back": {
        const p = ev.who ? w.s.people[ev.who] : void 0;
        if (p && p.status === "away") this.comeBack(p);
        return;
      }
    }
  }
  // -------------------------------------------------------------------------
  // Thinking
  // -------------------------------------------------------------------------
  /** Has someone think after a delay (minutes). */
  wake(p, delay, mode = "free") {
    this.schedule({ t: this.w.s.now + Math.max(0, delay), k: "think", who: p.id, data: { mode } });
  }
  /** Thinks and starts whatever wins. */
  think(p) {
    const w = this.w;
    w.mind.ensureNeeds(p);
    const dec = w.mind.decide(p);
    let pick = dec.picked;
    const mentat = w.mentat;
    if (mentat && p.suspended.length) {
      const next = mentat.resume(p, pick);
      if (next) pick = next;
    }
    if (!pick) {
      this.idle(p);
      return;
    }
    this.begin(p, pick);
  }
  /**
   * Thinks again while busy (a routine boundary, an urgent need): switches
   * only if something now outranks what they're doing.
   */
  reconsider(p, mode) {
    const w = this.w;
    if (!p.doing) {
      this.think(p);
      return;
    }
    if (p.doing.kind === "travel" && mode !== "boundary") return;
    const dec = w.mind.decide(p);
    const pick = dec.picked;
    const cur = p.doing;
    const outranks = pick && pick.rank > cur.rank;
    const stale = mode === "boundary" && (cur.layer === "routine" || cur.layer === "job" || cur.layer === "story") && cur.until !== void 0 && cur.until <= w.s.now + 1e-6;
    if (outranks || stale || cur.kind === "wait" && pick) {
      if (pick && pick.id === cur.action && pick.place === (cur.kind === "travel" ? cur.to : cur.place) && !stale) return;
      this.interrupt(p, outranks ? "something mattered more" : "time for something else", !!outranks);
      if (pick) this.begin(p, pick);
      else this.idle(p);
    } else {
      this.scheduleChecks(p);
    }
  }
  /** Interrupts and thinks again now. */
  rethink(p, why) {
    if (p.status !== "active") return;
    if (p.doing) this.interrupt(p, why, true);
    this.think(p);
  }
  /** Nothing to do: wait where they are, then think again. */
  idle(p) {
    const w = this.w;
    const end = w.s.now + w.cfg.idle;
    const seq = this.scheduleEnd(p, end);
    p.doing = { kind: "wait", action: "wait", place: p.place, start: w.s.now, end, rank: -1, layer: "idle", seq };
    this.announce(p);
  }
  // -------------------------------------------------------------------------
  // Doing things
  // -------------------------------------------------------------------------
  /** Starts an option: walks there first if it's somewhere else. */
  begin(p, c) {
    const w = this.w;
    if (c.kind === "task") {
      const mentat = w.mentat;
      const step = mentat ? mentat.begin(p, c) : null;
      if (!step) {
        this.idle(p);
        return;
      }
      c = step;
    }
    if (c.id.startsWith("@go:")) {
      this.travelTo(p, c, c.place);
      return;
    }
    if (c.id.startsWith("@wait:")) {
      const minutes = Number(c.id.slice(6)) || w.cfg.idle;
      const end = w.s.now + minutes;
      const seq = this.scheduleEnd(p, end);
      p.doing = { kind: "wait", action: "wait", place: p.place, start: w.s.now, end, rank: c.rank, layer: c.layer, seq, task: p.plan?.task };
      this.announce(p);
      return;
    }
    const dest = c.place ?? p.place;
    if (dest && p.place && dest !== p.place && w.ring.travel(p.place, dest, p) > 0) {
      this.travelTo(p, c, dest);
      return;
    }
    if (dest && !p.place) {
      this.travelTo(p, c, dest);
      return;
    }
    if (dest && dest !== p.place) p.place = dest;
    this.act(p, c);
  }
  travelTo(p, c, dest) {
    const w = this.w;
    if (!dest) {
      this.act(p, c);
      return;
    }
    const minutes = w.ring.travel(p.place, dest, p);
    if (!isFinite(minutes)) {
      this.fail(p, `can't get to ${dest}`, true, { action: c.id, place: dest });
      return;
    }
    w.ring.release(p.place, p.slot, p.id);
    delete p.slot;
    const end = w.s.now + Math.max(0.5, minutes);
    const seq = this.scheduleEnd(p, end);
    p.doing = {
      kind: "travel",
      action: c.id,
      place: null,
      from: p.place,
      to: dest,
      start: w.s.now,
      end,
      rank: c.rank,
      layer: c.layer,
      seq,
      target: c.target,
      until: c.until,
      slot: c.slot
    };
    if (c.fill === false) p.doing.fill = false;
    if (c.minutes !== void 0) p.doing.minutes = c.minutes;
    if (p.plan) p.doing.task = p.plan.task;
    p.place = null;
    w.log("set-out", p.id, { to: dest, for: c.id });
    for (const m of w.hooks) m.started?.(p, p.doing);
    this.announce(p);
    this.carryFollowers(p);
    this.scheduleChecks(p);
  }
  /** Starts the action itself, here. */
  act(p, c) {
    const w = this.w;
    const a = w.actions.get(c.id);
    if (!a) {
      this.idle(p);
      return;
    }
    const place = c.place ?? p.place;
    if (a.slot && place) {
      if (p.slot && p.place && p.slot !== a.slot) w.ring.release(p.place, p.slot, p.id);
      if (!w.ring.claim(place, a.slot, p.id)) {
        const why = w.ring.allowed(place, a.slot, p) ? `no free ${a.slot} at ${place}` : `the ${a.slot} at ${place} isn't for them`;
        this.fail(p, why, true, { action: a.id, place });
        return;
      }
      p.slot = a.slot;
    } else if (p.slot && p.place) {
      w.ring.release(p.place, p.slot, p.id);
      delete p.slot;
    }
    const r = w.stream(p);
    let minutes = c.minutes ?? (Array.isArray(a.minutes) ? r.range(a.minutes[0], a.minutes[1]) : a.minutes);
    if (c.until !== void 0 && isFinite(c.until) && (c.layer === "routine" || c.layer === "job" || c.layer === "story") && a.fill !== false && c.fill !== false) {
      minutes = Math.max(c.until - w.s.now, Math.min(minutes, 5));
    }
    minutes = Math.max(0.5, minutes);
    const end = w.s.now + minutes;
    const seq = this.scheduleEnd(p, end);
    p.place = place;
    p.doing = { kind: "act", action: a.id, place, slot: a.slot, target: c.target, start: w.s.now, end, rank: c.rank, layer: c.layer, seq, until: c.until };
    if (p.plan) p.doing.task = p.plan.task;
    w.log("started", p.id, { action: a.id, place, layer: c.layer, ...c.target ? { target: c.target } : {} });
    for (const m of w.hooks) m.started?.(p, p.doing);
    if (!p.doing || p.doing.seq !== seq) return;
    if (p.directive && p.directive.do === a.id && c.layer === "story") p.directive.done = true;
    this.announce(p);
    this.carryFollowers(p);
    this.meet(p);
    this.scheduleChecks(p);
  }
  /** The action or walk ran its course. */
  finish(p) {
    const w = this.w;
    const d = p.doing;
    if (d.kind === "travel") {
      p.place = d.to ?? null;
      p.doing = null;
      w.log("arrived", p.id, { place: p.place });
      for (const m of w.hooks) m.arrived?.(p, p.place);
      w.emit("arrive", { id: p.id, place: p.place });
      if (d.action.startsWith("@go:")) {
        this.afterStep(p, d, true);
        return;
      }
      const c = { id: d.action, kind: "action", place: p.place, target: d.target, rank: d.rank, layer: d.layer, weight: 1, parts: [], until: d.until, slot: d.slot };
      if (d.fill === false) c.fill = false;
      if (d.minutes !== void 0) c.minutes = d.minutes;
      const why = w.mind.blockedReason(p, c);
      if (why) {
        this.fail(p, why, true, { action: d.action, place: p.place });
        return;
      }
      this.act(p, c);
      return;
    }
    p.doing = null;
    if (d.kind === "act") this.complete(p, d, 1, false);
    this.afterStep(p, d, true);
  }
  /** Applies what finishing (some of) an action does: relief, effects, learning. */
  complete(p, d, frac, interrupted) {
    const w = this.w;
    const a = w.actions.get(d.action);
    w.mind.settle(p, d);
    const { got, expected } = w.mind.relieve(p, d, frac);
    if (a && !interrupted) {
      const ctx = w.ctx(p, { place: d.place, target: d.target ?? null, action: a.id });
      w.lang.applyAll(a.then, ctx);
      if (a.deed && d.target) {
        const data = { for: d.target };
        if (d.place) data.place = d.place;
        w.log("did", p.id, { verb: a.deed, for: d.target });
        for (const m of w.hooks) m.did?.(p.id, a.deed, data);
      }
    }
    if (a && frac > w.cfg.habitDone) w.mind.learn(p, a.id, got, expected);
    if (a?.trains) w.skills.practiced(p, a.trains, d.start);
    w.mind.finished(p, d, frac, interrupted);
    if (a?.cooldown) p.cool[a.id] = w.s.now + a.cooldown;
    p.last = d.action;
    p.lastEnd = w.s.now;
    if (d.slot && d.place) {
      w.ring.release(d.place, d.slot, p.id);
      if (p.slot === d.slot) delete p.slot;
    }
    for (const m of w.hooks) m.ended?.(p, d, frac, interrupted);
    w.log(interrupted ? "stopped" : "finished", p.id, { action: d.action, place: d.place, frac: Math.round(frac * 100) / 100 });
  }
  /** What happens after a step: the plan goes on, or they think again. */
  afterStep(p, d, ok) {
    const w = this.w;
    if (p.status !== "active") return;
    if (p.plan && w.mentat && d.layer === "plan") {
      const next = w.mentat.stepDone(p, ok);
      if (next) {
        this.begin(p, next);
        return;
      }
    }
    this.think(p);
  }
  /** Stops what they're doing, keeping what they got from it so far. */
  interrupt(p, why, suspendPlan) {
    const w = this.w;
    const d = p.doing;
    if (!d) return;
    p.doing = null;
    const frac = clamp((w.s.now - d.start) / Math.max(1e-6, d.end - d.start));
    if (d.kind === "act") this.complete(p, d, frac, true);
    else if (d.kind === "travel") {
      p.place = frac >= 0.5 ? d.to ?? null : d.from ?? d.to ?? null;
      for (const m of w.hooks) m.ended?.(p, d, frac, true);
    } else for (const m of w.hooks) m.ended?.(p, d, frac, true);
    if (p.plan && w.mentat && d.layer === "plan") {
      if (suspendPlan) w.mentat.suspend(p);
    }
    w.log("interrupted", p.id, { action: d.action, why });
  }
  /**
   * Something went wrong: the slot was taken, the door was shut. The action
   * is ruled out at that place for config.backoff minutes, and they think
   * again. `what` names what failed when it never became their doing.
   */
  fail(p, why, alreadyStopped = false, what) {
    const w = this.w;
    const d = p.doing;
    const now2 = w.s.now;
    const n = p.fails && p.fails[0] === now2 ? p.fails[1] + 1 : 1;
    p.fails = [now2, n];
    if (n > MAX_FAILS && d?.kind === "wait" && !alreadyStopped) return;
    const failed = what ?? (d && d.kind !== "wait" ? { action: d.action, place: d.kind === "travel" ? d.to ?? null : d.place } : null);
    if (d && !alreadyStopped) {
      p.doing = null;
      const frac = clamp((now2 - d.start) / Math.max(1e-6, d.end - d.start));
      if (d.kind === "act") this.complete(p, d, frac, true);
      else if (d.kind === "travel") p.place = frac >= 0.5 ? d.to ?? null : d.from ?? null;
    } else if (alreadyStopped) p.doing = null;
    w.log("failed", p.id, { why });
    w.emit("failed", { id: p.id, why });
    for (const m of w.hooks) m.failed?.(p, why);
    if (failed) {
      for (const k in p.cool) if (k.startsWith("@fail:") && p.cool[k] <= now2) delete p.cool[k];
      p.cool[backoffKey(failed.action, failed.place)] = now2 + w.cfg.backoff;
    }
    if (n >= MAX_FAILS) {
      if (p.plan && w.mentat) w.mentat.suspend(p);
      this.idle(p);
      return;
    }
    if (p.plan && w.mentat) {
      const next = w.mentat.stepFailed(p, why);
      if (next) {
        this.begin(p, next);
        return;
      }
    }
    this.think(p);
  }
  /** The game says they're done early. */
  finishNow(p) {
    const d = p.doing;
    if (!d) return;
    d.end = this.w.s.now;
    this.finish(p);
  }
  /** Re-checks for urgent needs and stack changes while busy. */
  scheduleChecks(p) {
    const w = this.w;
    const d = p.doing;
    if (!d) return;
    const queued = (t, mode) => w.cfg.checksOnce && w.s.q.some((e) => e.k === "think" && e.who === p.id && e.t === t && e.data?.mode === mode);
    const boundary = w.mind.nextBoundary(p);
    if (boundary < d.end - 0.01 && !queued(boundary, "boundary")) this.schedule({ t: boundary, k: "think", who: p.id, data: { mode: "boundary" } });
    const urge = w.mind.urgentAt(p);
    const at = Math.max(w.s.now + 1, urge);
    if (urge < d.end - 0.01 && !queued(at, "urge")) this.schedule({ t: at, k: "think", who: p.id, data: { mode: "urge" } });
  }
  /** People at the same place meet: modules hear about it (regard, gossip, talk). */
  meet(p) {
    const w = this.w;
    const d = p.doing;
    if (!d || d.kind !== "act" || !d.place) return;
    const others = w.ring.present(d.place).filter((id) => id !== p.id);
    if (!others.length) return;
    const r = w.stream(p);
    const cfg = w.cfg;
    const chosen = others.length <= cfg.meetMax ? others : r.shuffle(others).slice(0, cfg.meetMax);
    for (const id of chosen) {
      const o = w.s.people[id];
      if (!o.doing || o.doing.kind !== "act") continue;
      const minutes = Math.min(d.end, o.doing.end) - w.s.now;
      if (minutes < cfg.meetMinutes) continue;
      for (const m of w.hooks) m.met?.(p, o, d.place, minutes);
    }
  }
  /** Followers do what their leader does. */
  carryFollowers(leader) {
    const w = this.w;
    const d = leader.doing;
    if (!d) return;
    for (const id in w.s.people) {
      const f = w.s.people[id];
      if (f.follow !== leader.id || f.status !== "active" || f === leader) continue;
      if (f.doing && f.doing.rank > d.rank) continue;
      if (f.doing) this.interrupt(f, "following " + leader.name, false);
      const seq = this.scheduleEnd(f, d.end);
      f.doing = { ...d, seq, layer: "follow", slot: void 0 };
      if (d.kind === "travel") {
        w.ring.release(f.place, f.slot, f.id);
        delete f.slot;
        f.place = null;
      } else if (d.slot && d.place && w.ring.claim(d.place, d.slot, f.id)) {
        f.doing.slot = d.slot;
        f.slot = d.slot;
        f.place = d.place;
      } else f.place = d.place;
      this.announce(f);
    }
  }
  /** A fact changed: places that closed turn people away when they get there. */
  factChanged(_key) {
  }
  // -------------------------------------------------------------------------
  // Away and gone
  // -------------------------------------------------------------------------
  sendAway(id, until, summary, place) {
    const w = this.w;
    const p = w.s.people[id];
    if (!p || p.status !== "active") return;
    if (p.doing) this.interrupt(p, "went away", false);
    w.ring.release(p.place, p.slot, p.id);
    delete p.slot;
    p.status = "away";
    p.away = { until, summary, ...place ? { place } : {} };
    p.place = null;
    p.doing = null;
    p.plan = null;
    this.schedule({ t: until, k: "back", who: p.id });
    w.log("away", id, { until, summary });
  }
  comeBack(p) {
    const w = this.w;
    const away = p.away;
    p.status = "active";
    p.place = away?.place ?? p.def.home ?? null;
    const most = w.cfg.awayNeeds;
    for (const id in p.needs) p.needs[id] = { v: Math.min(p.needs[id].v, most), t: w.s.now };
    delete p.away;
    w.log("back", p.id, { summary: away?.summary ?? "" });
    w.emit("back", { id: p.id, summary: away?.summary ?? "" });
    this.think(p);
  }
  removePerson(id, why) {
    const w = this.w;
    const p = w.s.people[id];
    if (!p || p.status === "gone") return;
    if (p.doing) this.interrupt(p, why, false);
    w.ring.release(p.place, p.slot, p.id);
    p.status = "gone";
    p.doing = null;
    p.plan = null;
    for (const m of w.hooks) m.removed?.(p, why);
    for (const o of Object.values(w.s.people)) if (o.follow === id) delete o.follow;
    w.log("gone", id, { why });
    w.emit("gone", { id, why });
  }
  // -------------------------------------------------------------------------
  // Bodies: the hand-over to the game
  // -------------------------------------------------------------------------
  focus(regions) {
    this.regions = new Set(regions);
    this.refreshBodies();
  }
  regionsInFocus() {
    return [...this.regions];
  }
  /** Is someone in a focused region (or does the shell say they're visible)? */
  isNear(p) {
    if (p.status !== "active") return false;
    const w = this.w;
    if (w.shell.near) {
      const b = this.body(p.id);
      return !!b && w.shell.near(b, w);
    }
    const d = p.doing;
    if (d && d.kind === "travel") return this.regions.has(w.ring.region(d.from)) || this.regions.has(w.ring.region(d.to));
    return !!p.place && this.regions.has(w.ring.region(p.place));
  }
  /**
   * Emits embody and disembody for whoever came into or left view. After a
   * seek, given what the bodies were before it (shown()), also a step for
   * each body that stayed in view but changed.
   */
  refreshBodies(before) {
    const w = this.w;
    if (w.replaying) return;
    const now2 = /* @__PURE__ */ new Set();
    for (const id in w.s.people) if (this.isNear(w.s.people[id])) now2.add(id);
    for (const id of this.near) if (!now2.has(id)) w.emit("disembody", { id });
    for (const id of now2) {
      if (!this.near.has(id)) w.emit("embody", this.body(id));
      else if (before && before.get(id) !== this.sig(id)) w.emit("step", this.body(id));
    }
    this.near = now2;
  }
  /** What each near body is now, to tell after a seek which of them changed. */
  shown() {
    const out = /* @__PURE__ */ new Map();
    for (const id of this.near) out.set(id, this.sig(id));
    return out;
  }
  /** The parts of a body that say what it's doing (not how far through it is). */
  sig(id) {
    const b = this.body(id);
    return b ? [b.action, b.next, b.place, b.slot, b.target, b.pose, b.start, b.end].join("|") : "";
  }
  /** Tells the game a near person started something new. */
  announce(p) {
    const w = this.w;
    if (w.replaying) return;
    if (!this.near.has(p.id) && !this.isNear(p)) return;
    w.emit("step", this.body(p.id));
  }
  /** Is this person embodied right now? */
  embodied(id) {
    return this.near.has(id);
  }
  bodies() {
    const out = [];
    for (const id of this.near) {
      const b = this.body(id);
      if (b) out.push(b);
    }
    return out;
  }
  body(id) {
    const w = this.w;
    const p = w.s.people[id];
    if (!p || p.status !== "active") return null;
    const d = p.doing;
    const t = w.s.now;
    const progress = d ? clamp((t - d.start) / Math.max(1e-6, d.end - d.start)) : 0;
    const reverie = w.reverie;
    const b = {
      id,
      name: p.name,
      place: p.place,
      slot: p.slot,
      action: d ? d.kind === "travel" ? "travel" : d.action : "wait",
      pose: "idle",
      progress,
      start: d?.start ?? t,
      end: d?.end ?? t
    };
    if (d?.target) b.target = d.target;
    if (d?.kind === "travel") {
      b.pose = "walk";
      b.next = d.action;
      b.travel = { from: d.from ?? null, to: d.to ?? null, start: d.start, end: d.end, f: progress };
    } else if (d?.kind === "act") b.pose = w.actions.get(d.action)?.pose ?? "idle";
    const r = w.mind.routineAt(p);
    if (r?.entry[3]?.with) b.with = r.entry[3].with;
    if (reverie) {
      b.emotion = reverie.emotion(p.id);
      b.mood = reverie.mood(p.id);
    }
    if (p.def.data) b.data = p.def.data;
    return b;
  }
};

// tyrell/src/core/esper.ts
var DEFAULT_ESPER = { on: true, every: 15, keep: 1440, sparseAfter: 240, sparseEvery: 60 };
var Esper = class {
  constructor(w, cfg) {
    this.w = w;
    this.snaps = [];
    this.inputs = [];
    /** The absolute index of inputs[0] (older inputs are pruned). */
    this.base = 0;
    /** The absolute index of the next input to apply (equals the end when there's no future). */
    this.cursor = 0;
    this.nextMark = Infinity;
    this.seeking = false;
    this.marks = /* @__PURE__ */ new Map();
    this.config = { ...DEFAULT_ESPER, ...cfg || {} };
  }
  /** Is time walk recording? */
  get on() {
    return this.config.on;
  }
  /** Forgets all history (after a load). */
  reset() {
    this.snaps = [];
    this.inputs = [];
    this.base = 0;
    this.cursor = 0;
    this.nextMark = Infinity;
  }
  /** Takes the first snapshot, the earliest point to rewind to. */
  ensureBase() {
    if (!this.config.on || this.snaps.length || this.seeking) return;
    this.snapshot();
    const e = this.config.every;
    this.nextMark = Math.floor(this.w.s.now / e) * e + e;
  }
  /**
   * Records an input from outside (called by World.input before applying it).
   * `after` is the seq of the event it came in during, if any.
   */
  record(name, args, after, chain = false) {
    if (!this.config.on) return;
    if (this.cursor < this.base + this.inputs.length || this.snaps.length && this.snaps[this.snaps.length - 1].t > this.w.s.now) this.branch();
    const inp = { t: this.w.s.now, name, args: clone(args) };
    if (after !== void 0) inp.after = after;
    if (chain) inp.chain = true;
    this.inputs.push(inp);
    this.cursor = this.base + this.inputs.length;
  }
  /**
   * Is this call the very input the recorded future holds next? (After a
   * rewind, a game that reacts to replayed events the same way as before
   * repeats itself; those repeats don't start a new timeline.)
   */
  echo(name, args, after, chain = false) {
    const inp = this.pending();
    if (!inp || inp.name !== name || inp.after !== after || !!inp.chain !== chain) return false;
    if (Math.abs(inp.t - this.w.s.now) > 1e-9) return false;
    return JSON.stringify(inp.args) === JSON.stringify(args);
  }
  /** The next recorded input still ahead of the world (after a rewind), if any. */
  pending() {
    const i = this.cursor - this.base;
    return i >= 0 && i < this.inputs.length ? this.inputs[i] : void 0;
  }
  /** Applies the next recorded input, and any chained to it. */
  applyNext() {
    let inp = this.pending();
    if (!inp) return;
    for (; ; ) {
      this.cursor++;
      this.w.replay(inp.name, clone(inp.args));
      inp = this.pending();
      if (!inp || !inp.chain) break;
    }
  }
  /** Takes snapshots for every mark the clock is about to pass (marks strictly before t). */
  passMarks(t) {
    if (!this.config.on || this.seeking) return;
    while (this.nextMark < t) {
      const keep = this.w.s.now;
      this.w.s.now = this.nextMark;
      if (!this.snaps.some((s) => s.t === this.nextMark)) this.snapshot();
      this.w.s.now = Math.max(keep, this.nextMark);
      this.nextMark += this.config.every;
      this.prune();
    }
  }
  snapshot() {
    const snap = { t: this.w.s.now, input: this.cursor, s: JSON.stringify(this.w.s) };
    let i = this.snaps.length;
    while (i > 0 && this.snaps[i - 1].t > snap.t) i--;
    this.snaps.splice(i, 0, snap);
  }
  /** Drops history older than `keep`, and thins what's older than `sparseAfter`. */
  prune() {
    const c = this.config, now2 = this.w.s.now;
    if (this.snaps.length < 2) return;
    const oldest = now2 - c.keep;
    this.snaps = this.snaps.filter((s, i) => {
      if (i === this.snaps.length - 1) return true;
      if (s.t < oldest) return false;
      if (s.t < now2 - c.sparseAfter && Math.round(s.t) % c.sparseEvery !== 0) return false;
      return true;
    });
    const first = this.snaps[0].input;
    const drop = first - this.base;
    if (drop > 0) {
      this.inputs.splice(0, drop);
      this.base = first;
    }
  }
  /** The earliest time Esper can go back to. */
  earliest() {
    return this.snaps.length ? this.snaps[0].t : this.w.s.now;
  }
  /** The latest time it knows (the end of the recorded future, or now). */
  latest() {
    const lastInput = this.inputs.length ? this.inputs[this.inputs.length - 1].t : -Infinity;
    const lastSnap = this.snaps.length ? this.snaps[this.snaps.length - 1].t : -Infinity;
    return Math.max(this.w.s.now, lastInput, lastSnap);
  }
  /** The span of history: [earliest, latest]. */
  span() {
    return [this.earliest(), this.latest()];
  }
  /** How many snapshots and inputs are held (for a memory readout). */
  size() {
    let bytes = 0;
    for (const s of this.snaps) bytes += s.s.length;
    return { snapshots: this.snaps.length, inputs: this.inputs.length, bytes };
  }
  /** Goes to time t (clamped to what's remembered): back by restoring and replaying, forward by running. */
  seek(t) {
    const w = this.w;
    if (!this.config.on || !this.snaps.length) {
      if (t > w.s.now) w.clock.advanceTo(t, Infinity);
      return;
    }
    if (t >= w.s.now) {
      w.clock.advanceTo(t, Infinity);
      return;
    }
    const target = Math.max(t, this.earliest());
    let snap = this.snaps[0];
    for (const s of this.snaps) if (s.t <= target) snap = s;
    const from = w.s.now;
    w.s = JSON.parse(snap.s);
    this.cursor = snap.input;
    this.seeking = true;
    w.replaying = true;
    try {
      w.clock.advanceTo(target, Infinity);
    } finally {
      w.replaying = false;
      this.seeking = false;
    }
    const e = this.config.every;
    this.nextMark = Math.floor(w.s.now / e) * e + e;
    w.palantir.clear();
    w.emit("seek", { from, to: w.s.now });
  }
  /** Drops the recorded future (a new input in the past starts a new timeline). */
  branch() {
    const now2 = this.w.s.now;
    const keepInputs = this.cursor - this.base;
    const dropped = this.inputs.length - keepInputs;
    this.inputs.length = Math.max(0, keepInputs);
    this.snaps = this.snaps.filter((s) => s.t <= now2);
    this.w.emit("branch", { t: now2, dropped });
  }
  /** Names the present moment, to come back to later. */
  mark(name) {
    this.marks.set(name, this.w.s.now);
  }
  /** Goes back (or forward) to a named moment. Returns false if it's been forgotten. */
  seekMark(name) {
    const t = this.marks.get(name);
    if (t === void 0 || t < this.earliest()) return false;
    this.w.seek(t);
    return true;
  }
  /** History as plain data, for a save that keeps it. */
  export() {
    return { snaps: this.snaps, inputs: this.inputs, base: this.base, cursor: this.cursor, nextMark: this.nextMark, marks: [...this.marks] };
  }
  import(h) {
    if (!h) return;
    this.snaps = (h.snaps || []).slice();
    this.inputs = (h.inputs || []).slice();
    this.base = h.base || 0;
    this.cursor = h.cursor ?? this.base + this.inputs.length;
    this.nextMark = h.nextMark ?? Infinity;
    this.marks = new Map(h.marks || []);
  }
};

// tyrell/src/core/westmarch.ts
function about(e, who) {
  if (e.who === who) return true;
  const d = e.d;
  if (!d) return false;
  return d.target === who || d.for === who || d.to === who && e.k !== "set-out" && e.k !== "report";
}
var Westmarch = class {
  constructor(w) {
    this.w = w;
  }
  /** Writes an entry and tells the game. */
  write(k, who, d) {
    const w = this.w;
    const e = { t: w.s.now, k };
    if (who !== void 0) e.who = who;
    if (d !== void 0) e.d = d;
    const log = w.s.log;
    log.push(e);
    const over = log.length - w.cfg.logSize;
    if (over > 0) log.splice(0, over);
    w.emit("log", e);
  }
  /** Entries matching a filter, oldest first. */
  find(f = {}) {
    const kinds = f.k === void 0 ? null : new Set(Array.isArray(f.k) ? f.k : [f.k]);
    return this.w.s.log.filter((e) => (!kinds || kinds.has(e.k)) && (f.who === void 0 || about(e, f.who)) && (f.since === void 0 || e.t >= f.since) && (f.until === void 0 || e.t <= f.until));
  }
  /** Everything since a time. */
  since(t, k) {
    return this.find({ since: t, k });
  }
  /**
   * A short chronicle of someone's day since a time, in plain sentences:
   * "08:10 set out for the cafe", "08:24 started eat_bread at cafe".
   */
  chronicle(who, since) {
    const w = this.w;
    const out = [];
    const at = (id) => id ? w.ring.get(id)?.name ?? id : id;
    for (const e of this.find({ who, since })) {
      const clock2 = clockOf(e.t);
      const d = e.d || {};
      if (e.who !== who) {
        const other = w.s.people[e.who ?? ""]?.name ?? e.who ?? "someone";
        if (e.k === "started") out.push(`${clock2} ${other}: ${w.actions.get(d.action)?.label ?? d.action} with them`);
        else if (e.k === "did") out.push(`${clock2} ${other} ${d.verb} them`);
        else if (e.k === "told") out.push(`${clock2} heard about ${d.key} from ${other}`);
        else if (e.k === "met") out.push(`${clock2} spent time with ${other}`);
        continue;
      }
      let line;
      switch (e.k) {
        case "set-out":
          line = `set out for ${at(d.to)}`;
          break;
        case "arrived":
          line = `got to ${at(d.place)}`;
          break;
        case "started":
          line = `${w.actions.get(d.action)?.label ?? d.action}${d.place ? " at " + at(d.place) : ""}`;
          break;
        case "failed":
          line = `couldn't: ${d.why}`;
          break;
        case "felt":
          line = `felt ${d.label ?? d.feeling}`;
          break;
        case "told":
          line = `told ${w.s.people[d.to]?.name ?? d.to} about ${d.key}`;
          break;
        case "broke":
          line = `broke down: ${d.kind}`;
          break;
        case "met":
          line = `spent time with ${w.s.people[d.target]?.name ?? d.target}`;
          break;
        case "did": {
          const t = d.for ?? d.to ?? d.target;
          line = `${d.verb} ${w.s.people[t]?.name ?? t ?? ""}`.trim();
          break;
        }
        default:
          continue;
      }
      out.push(`${clock2} ${line}`);
    }
    return out;
  }
};

// tyrell/src/tools/palantir.ts
var clock = (t) => `day ${Math.floor((t + 1e-6) / DAY)} ${clockOf(t)}`;
var Palantir = class {
  constructor(w) {
    this.w = w;
    this.decisions = /* @__PURE__ */ new Map();
    /** Turn off to save a little time in big headless runs. */
    this.enabled = true;
  }
  record(d) {
    if (!this.enabled || this.w.replaying) return;
    const list = this.decisions.get(d.who) || [];
    const cands = d.candidates.slice().sort((a, b) => b.rank - a.rank || b.weight - a.weight);
    d.candidates = cands.filter((c, i) => i < 16 || c.layer !== "need");
    list.push(d);
    if (list.length > this.w.cfg.decisions) list.shift();
    this.decisions.set(d.who, list);
    this.w.emit("decided", { who: d.who, picked: d.picked?.id ?? null, place: d.picked?.place ?? null });
  }
  clear() {
    this.decisions.clear();
  }
  /** The latest decision for a person. */
  why(id) {
    const list = this.decisions.get(id);
    return list && list.length ? list[list.length - 1] : null;
  }
  /** A person's recent decisions, oldest first. */
  history(id) {
    return this.decisions.get(id)?.slice() ?? [];
  }
  /** Why someone isn't doing something: weighs it now and says what stops it or what beat it. */
  whyNot(id, action) {
    return this.w.peek(() => this.whyNotNow(id, action));
  }
  whyNotNow(id, action) {
    const w = this.w;
    const p = w.s.people[id];
    if (!p) return `${id} isn't in the world`;
    if (p.status !== "active") return `${p.name} is ${p.status}`;
    if (!w.actions.has(action) && !w.tasks.has(action)) return `${action} isn't declared`;
    if (p.doing?.action === action) return `${p.name} is doing it now`;
    const options = w.mind.explain(p, action);
    if (!options.length) return `nowhere offers ${action} to ${p.name}`;
    const open = options.filter((c) => !c.blocked);
    if (!open.length) return options.map((c) => `${c.place ?? "here"}: ${c.blocked}`).join("; ");
    const best = open.sort((a, b) => b.rank - a.rank || b.weight - a.weight)[0];
    const last = this.why(id);
    const picked = last?.picked;
    if (!picked) return `${action} at ${best.place ?? "here"} weighs ${round(best.weight, 3)} (${this.parts(best)}), but they haven't decided anything yet`;
    if (picked.rank > best.rank) return `${picked.id} outranks it (${picked.layer}, rank ${picked.rank} against ${best.rank})`;
    return `${action} at ${best.place ?? "here"} weighs ${round(best.weight, 3)} (${this.parts(best)}); ${picked.id} weighed ${round(picked.weight, 3)} (${this.parts(picked)})`;
  }
  /** "base 0.4 x habit 1.2 x travel 0.6" */
  parts(c) {
    return c.parts.map(([n, v]) => `${n} ${round(v, 3)}`).join(" x ");
  }
  /** A readable account of a person: what they're doing and why, needs, mood, plan, beliefs. */
  describe(id) {
    return this.w.peek(() => this.describeNow(id));
  }
  describeNow(id) {
    const w = this.w;
    const p = w.s.people[id];
    if (!p) return `${id}: not in the world`;
    const lines = [];
    lines.push(`${p.name} (${p.id}), ${p.status}, ${clock(w.s.now)}`);
    const d = p.doing;
    if (d) {
      const what = d.kind === "travel" ? `walking from ${d.from} to ${d.to} to ${d.action}` : d.kind === "wait" ? `waiting at ${d.place}` : `${d.action} at ${d.place}`;
      lines.push(`doing: ${what}, until ${clock(d.end)} (${d.layer}, rank ${d.rank})`);
    } else lines.push("doing: nothing");
    const needs = [...w.needs.keys()].map((n) => `${n} ${round(w.mind.level(p, n), 2)}`).join(", ");
    if (needs) lines.push(`needs: ${needs}`);
    const money = p.vars.money;
    if (money !== void 0) lines.push(`money: ${money}`);
    const inv = Object.entries(p.inv).map(([k, v]) => `${w.ceres?.goods.get(k)?.label ?? k} x${v}`).join(", ");
    if (inv) lines.push(`carrying: ${inv}`);
    const skills = Object.entries(w.skills.of(p)).map(([k, v]) => {
      const named = w.skills.named(p, k);
      return `${w.skills.defs.get(k)?.label ?? k} ${round(v, 2)}${named ? ` (${named})` : ""}`;
    }).join(", ");
    if (skills) lines.push(`skills: ${skills}`);
    const wishes = w.mind.wishesOf(p).map((h) => `${h.dream ? "dream: " : ""}${h.label}${h.x !== void 0 && h.x !== null ? ` (${String(h.x)})` : ""}${h.progress !== void 0 ? ` ${Math.round(h.progress * 100)}%` : ""}`).join(", ");
    if (wishes) lines.push(`wishes: ${wishes}`);
    const tol = Object.keys(p.tol || {}).sort().map((k) => [k, w.mind.tolerance(p, k)]).filter(([, v]) => v > 0.05).map(([k, v]) => `${w.pastimes.get(k)?.label ?? k} ${round(v, 2)}`).join(", ");
    if (tol) lines.push(`had enough of: ${tol}`);
    const under = w.athelas?.of(id).map((c) => `${c.label} (${c.phaseLabel || c.phase}, until ${clock(c.until)})`).join(", ");
    if (under) lines.push(`under: ${under}`);
    const rv = w.reverie;
    if (rv) {
      lines.push(`mood: ${round(rv.mood(id), 2)} (${rv.emotion(id)}), stress ${round(rv.stress(id), 2)}`);
      const feelings = rv.feelings(id).map((f) => `${f.label} ${f.weight > 0 ? "+" : ""}${round(f.weight, 2)}`).join(", ");
      if (feelings) lines.push(`feelings: ${feelings}`);
      const beliefs = rv.beliefs(id).slice(0, 6).map((b) => `${b.key}=${String(b.v)} (${b.src}${b.from ? " from " + b.from : ""})`).join(", ");
      if (beliefs) lines.push(`believes: ${beliefs}`);
    }
    if (p.plan) {
      const top = p.plan.stack[p.plan.stack.length - 1];
      lines.push(`plan: ${p.plan.task}${top ? `, step ${top.i + 1} of ${top.steps.length} of ${top.task}` : ""}`);
    }
    if (p.directive) lines.push(`directed to: ${p.directive.do}${p.directive.label ? ` (${p.directive.label})` : ""}${p.directive.done ? " (done)" : ""}`);
    const req = w.mind.required(p).map((r) => `${r.layer}: ${r.do}${r.at ? " at " + r.at : ""}`).join("; ");
    if (req) lines.push(`expected: ${req}`);
    const last = this.why(id);
    if (last?.picked) {
      lines.push(`chose ${last.picked.id}${last.picked.place ? " at " + last.picked.place : ""}: ${last.reason}`);
      lines.push(`  ${this.parts(last.picked)}`);
    }
    return lines.join("\n");
  }
  /** The full state of a person as JSON-ready data. */
  inspect(id) {
    const w = this.w;
    const p = w.s.people[id];
    if (!p) return null;
    return {
      person: p,
      needs: Object.fromEntries([...w.needs.keys()].map((n) => [n, round(w.mind.level(p, n), 3)])),
      mood: w.reverie?.mood(id),
      emotion: w.reverie?.emotion(id),
      decision: this.why(id),
      body: w.body(id)
    };
  }
};

// tyrell/src/core/strangers.ts
var Strangers = class {
  constructor(w) {
    this.w = w;
    this.defs = /* @__PURE__ */ new Map();
    w.defineInput("promote", (sid, given, def) => {
      var _a;
      const id = given ?? `p${++w.s.ids}`;
      const b = this.find(sid);
      ((_a = w.s.mod)["@strangers"] || (_a["@strangers"] = {}))[sid] = id;
      const p = w.input("person", [id, { ...def, place: def.place ?? b?.place ?? b?.travel?.to ?? void 0, data: { ...b?.data || {}, ...def.data || {} }, tags: [...def.tags || [], "promoted"] }]);
      w.log("promoted", id, { stranger: sid });
      return p.id;
    });
  }
  /** Who's been promoted (read only: looking at strangers changes nothing). */
  store() {
    return this.w.s.mod["@strangers"] ?? {};
  }
  /** Declares the passers-by of a region. */
  define(region, def) {
    this.defs.set(region, def);
  }
  /** The strangers in a region at a time (default now), as bodies. */
  at(region, t = this.w.s.now) {
    const def = this.defs.get(region);
    if (!def || !def.errands.length) return [];
    const out = [];
    const H = Math.floor(t / HOUR);
    const crowds = this.w.cfg.crowds;
    for (let k = 4; k >= 0; k--) {
      const hh = H - k;
      const hourOfDay = (hh % 24 + 24) % 24;
      const count = Array.isArray(def.perHour) ? def.perHour[hourOfDay] ?? 0 : def.perHour;
      for (let i = 0; i < count * crowds; i++) {
        const b = this.make(region, def, hh, i, t);
        if (b) out.push(b);
      }
    }
    return out;
  }
  /** One stranger by id ('~region:hour:i'), as a body at a time. */
  find(sid, t = this.w.s.now) {
    const m = /^~(.*):(-?\d+):(\d+)$/.exec(sid);
    if (!m) return null;
    const def = this.defs.get(m[1]);
    return def ? this.make(m[1], def, Number(m[2]), Number(m[3]), t, true) : null;
  }
  make(region, def, hh, i, t, any = false) {
    const w = this.w;
    const sid = `~${region}:${hh}:${i}`;
    if (this.store()[sid]) return null;
    const r = new Stream(w.s.seed, "stranger", region, hh, i);
    const setOut = hh * HOUR + r.range(0, HOUR);
    const hour = (hh % 24 + 24) % 24;
    const errands = def.errands.filter((e2) => !e2.hours || (e2.hours[0] <= e2.hours[1] ? hour >= e2.hours[0] && hour < e2.hours[1] : hour >= e2.hours[0] || hour < e2.hours[1]));
    const e = r.weighted(errands, (x) => x.weight ?? 1);
    if (!e) return null;
    const inMin = Math.max(1, w.ring.travel(e.from, e.to));
    const stay = e.minutes === void 0 ? 0 : Array.isArray(e.minutes) ? r.range(e.minutes[0], e.minutes[1]) : e.minutes;
    const outMin = stay > 0 ? Math.max(1, w.ring.travel(e.to, e.from)) : 0;
    const arrive = setOut + inMin, leave = arrive + stay, gone = leave + outMin;
    const data = def.data ? def.data(r, sid) : void 0;
    const base = { id: sid, name: "", slot: void 0, data };
    if (t >= setOut && t < arrive) {
      const f = clamp((t - setOut) / inMin);
      return { ...base, place: null, action: "travel", next: e.action ?? "pass", pose: "walk", progress: f, start: setOut, end: arrive, travel: { from: e.from, to: e.to, start: setOut, end: arrive, f } };
    }
    if (stay > 0 && t >= arrive && t < leave) {
      return { ...base, place: e.to, action: e.action ?? "idle", pose: e.action && w.actions.get(e.action)?.pose || "idle", progress: clamp((t - arrive) / stay), start: arrive, end: leave };
    }
    if (outMin > 0 && t >= leave && t < gone) {
      const f = clamp((t - leave) / outMin);
      return { ...base, place: null, action: "travel", next: "leave", pose: "walk", progress: f, start: leave, end: gone, travel: { from: e.to, to: e.from, start: leave, end: gone, f } };
    }
    return any ? { ...base, place: null, action: "gone", pose: "idle", progress: 1, start: setOut, end: gone } : null;
  }
  /** Turns a stranger into a person with a mind. Returns the new person's id. */
  promote(sid, def = {}, id) {
    return this.w.input("promote", [sid, id ?? null, def]);
  }
  /** Has this stranger been promoted, and to whom? */
  promoted(sid) {
    return this.store()[sid];
  }
};

// tyrell/src/core/skills.ts
var Skills = class {
  constructor(w) {
    this.w = w;
    this.defs = /* @__PURE__ */ new Map();
  }
  /** A skill's definition, or the defaults for one that was never declared. */
  def(id) {
    return this.defs.get(id) ?? { id };
  }
  /** A person's level in a skill at time t (default now), forgetting included. */
  level(p, id, t = this.w.s.now) {
    const rec = p.skills?.[id];
    const def = this.defs.get(id);
    if (!rec) return p.def.skills?.[id] ?? def?.start ?? 0;
    const [v, since] = rec;
    if (!def?.decay) return v;
    const idle = (t - since) / DAY - (def.grace ?? this.w.cfg.skillGrace);
    if (idle <= 0) return v;
    return round(Math.max(Math.min(v, def.floor ?? 0), v - def.decay * idle), 5);
  }
  /** How fast a person learns a skill: their talent for it (default 1). */
  talent(p, id) {
    return p.def.talents?.[id] ?? 1;
  }
  /** Every skill a person has practiced or started with, and its level now. */
  of(p) {
    const out = {};
    const ids = /* @__PURE__ */ new Set([...Object.keys(p.def.skills || {}), ...Object.keys(p.skills || {})]);
    for (const id of [...ids].sort()) out[id] = this.level(p, id);
    return out;
  }
  /** The name of the highest level reached (from the skill's `levels`), or null. */
  named(p, id) {
    const v = this.level(p, id);
    let out = null;
    for (const [at, name] of this.def(id).levels || []) if (v >= at - 1e-9) out = name;
    return out;
  }
  /**
   * Practice, inside the simulation: `hours` of it at the person's pace,
   * times `mul`. The progress is worked out exactly over the hours (eight
   * hours at once is the same as eight one-hour goes). Returns the new level.
   */
  applyTrain(p, id, hours, mul = 1) {
    const before = this.level(p, id);
    if (!(hours > 0) || !(mul > 0)) return before;
    const def = this.def(id);
    const max = def.max ?? 1;
    const pace = this.w.cfg.learning * this.w.own(p, "core", "learning");
    let rate = (def.rate ?? this.w.cfg.skillRate) * this.talent(p, id) * mul * pace;
    if (def.learn?.length) {
      const ctx = this.w.ctx(p);
      for (const k2 of def.learn) rate *= this.w.mind.consider(k2, ctx);
    }
    const d = def.diminish ?? 1;
    const u0 = clamp(1 - before / max);
    const k = rate * hours / max;
    let u;
    if (d === 1) u = u0 * Math.exp(-k);
    else {
      const b = Math.pow(u0, 1 - d) - (1 - d) * k;
      u = b <= 0 || !isFinite(b) ? 0 : Math.pow(b, 1 / (1 - d));
    }
    const after = round(Math.max(before, clamp(max * (1 - u), 0, max)), 5);
    this.store(p, id, after, before);
    return after;
  }
  /** Sets a level outright, inside the simulation. */
  applySet(p, id, level) {
    const before = this.level(p, id);
    const max = this.def(id).max ?? 1;
    this.store(p, id, round(clamp(level, 0, max), 5), before);
  }
  /** Keeps a new level, and marks any named level reached on the way up. */
  store(p, id, after, before) {
    const w = this.w;
    (p.skills || (p.skills = {}))[id] = [after, w.s.now];
    const def = this.def(id);
    for (const [at, name] of def.levels || []) {
      if (before < at - 1e-9 && after >= at - 1e-9) {
        w.log("skill", p.id, { skill: id, level: name });
        w.emit("skill", { id: p.id, skill: id, level: name, value: after });
        if (def.then) w.lang.applyAll(def.then, w.ctx(p, { data: { skill: id, level: name } }));
      }
    }
  }
  /** An action ended: the skills it trains get the time spent on it. */
  practiced(p, trains, start) {
    const hours = Math.max(0, this.w.s.now - start) / HOUR;
    if (hours <= 0) return;
    for (const id of Object.keys(trains).sort()) this.applyTrain(p, id, hours, trains[id]);
  }
  /** The terms, effects and inputs (World calls this once). */
  register() {
    const w = this.w, L = w.lang;
    L.term("skill", (c, a) => c.person ? this.level(c.person, a) : 0);
    L.term("talent", (c, a) => c.person ? this.talent(c.person, a) : 1);
    L.term("instinct", (c, a) => c.person?.def.instincts?.[a || c.action || ""] ?? 1);
    L.effect("skill", (c, a, op, v) => {
      if (!c.person) return;
      const id = a.startsWith("skill.") ? a.slice(6) : a;
      const cur = this.level(c.person, id);
      const next = op === "+=" ? cur + Number(v) : op === "-=" ? cur - Number(v) : op === "*=" ? cur * Number(v) : Number(v);
      this.applySet(c.person, id, next);
    });
    L.effect("train", (c, a, _op, v) => {
      if (c.person) this.applyTrain(c.person, a, v === null || v === true ? 1 : Number(v));
    });
    w.defineInput("train", (id, skill, hours) => {
      const p = w.s.people[id];
      return p ? this.applyTrain(p, skill, hours) : 0;
    });
    w.defineInput("skill", (id, skill, level) => {
      const p = w.s.people[id];
      if (p) this.applySet(p, skill, level);
    });
  }
};

// tyrell/src/core/world.ts
var SCHEMA = 2;
var DEFAULT_CONFIG = {
  minutesPerSecond: 1,
  week: 7,
  urgent: 0.85,
  urgentRank: 1.5,
  desperateRank: 2.5,
  storyRank: 3,
  jobRank: 2,
  routineRank: 1,
  cut: 0.25,
  top: 3,
  power: 2,
  inertia: 1.15,
  repeat: 0.75,
  travelScale: 30,
  placesPerAction: 4,
  idle: 20,
  backoff: 15,
  budgetMs: 4,
  logSize: 1e3,
  decisions: 12,
  checksOnce: false,
  habitFast: 0.25,
  habitSlow: 0.05,
  habitDrift: 0.02,
  habitMin: 0.25,
  habitMax: 4,
  compensate: true,
  pallGain: 0.35,
  pallDecay: 0.08,
  pallPenalty: 0.6,
  wishMax: 2,
  wishHours: [8, 13, 17],
  wishChance: 0.5,
  wishMinutes: 2160,
  wishPull: 1.35,
  needs: 1,
  habits: 1,
  learning: 1,
  wishes: 1,
  crowds: 1,
  traitDefault: 0.5,
  needStart: 0.2,
  needCurve: "pow1.5",
  reliefFloor: 0.05,
  liftRelief: 0.3,
  desperate: 0.97,
  desperateSlope: 10,
  habitBest: 2,
  habitDone: 0.2,
  nudgeSlow: 0.25,
  pallFrom: 0.05,
  pallDone: 0.2,
  repeatWindow: 90,
  targets: 6,
  meetMax: 3,
  meetMinutes: 3,
  awayNeeds: 0.4,
  skillRate: 0.02,
  skillGrace: 3
};
var CORE_KNOBS = { needs: "person", habits: "person", learning: "person", wishes: "person", crowds: "world" };
var UNTUNED = /* @__PURE__ */ new Set(["minutesPerSecond", "budgetMs"]);
var CURVES = /* @__PURE__ */ new Set(["needCurve"]);
var World = class {
  constructor(opts, modules) {
    this.lang = new Lang();
    this.needs = /* @__PURE__ */ new Map();
    this.actions = /* @__PURE__ */ new Map();
    this.tasks = /* @__PURE__ */ new Map();
    this.deeds = /* @__PURE__ */ new Map();
    this.pastimes = /* @__PURE__ */ new Map();
    this.wishes = /* @__PURE__ */ new Map();
    this.modules = /* @__PURE__ */ new Map();
    /** The modules in the order their hooks run. */
    this.hooks = [];
    /** True while Esper replays history: the game hears nothing then. */
    this.replaying = false;
    this.listeners = /* @__PURE__ */ new Map();
    this.inputs = /* @__PURE__ */ new Map();
    this.depth = 0;
    this.deferred = [];
    /** Listeners being called (game code): inputs they make wait their turn. */
    this.listening = 0;
    /** The input depth the innermost listener was called at (deeper is engine code it set off). */
    this.listenDepth = -1;
    /** Clock calls running (tick, advanceTo, seek, load). */
    this.moving = 0;
    /** Clock calls made while the engine was busy, waiting their turn. */
    this.later = [];
    /** Calls that only look (choosing a line, explaining a choice): chance: draws change nothing then. */
    this.looking = 0;
    this._speed = 1;
    /** The settings in force, by module, made from the overrides they were made from (s.tune's, kept whole: a new tune makes a new object). */
    this.tunedCache = /* @__PURE__ */ new Map();
    this.config = { ...DEFAULT_CONFIG, ...opts.config || {} };
    this.shell = opts.shell || {};
    const seed = String(opts.seed ?? "tyrell");
    const start = opts.start ?? 0;
    this.s = {
      v: SCHEMA,
      seed,
      now: start,
      seq: 0,
      people: {},
      places: {},
      facts: {},
      q: [],
      log: [],
      mod: {},
      game: {},
      n: 0,
      ids: 0
    };
    this.ring = new Ring(this);
    this.westmarch = new Westmarch(this);
    this.mind = new Bicameral(this);
    this.clock = new Entmoot(this);
    this.esper = new Esper(this, opts.esper);
    this.palantir = new Palantir(this);
    this.strangers = new Strangers(this);
    this.skills = new Skills(this);
    this.registerCore();
    this.skills.register();
    this.mind.register();
    for (const m of modules) {
      this.modules.set(m.name, m);
      this.hooks.push(m);
      m.attach(this);
      if (m.init) this.s.mod[m.name] = m.init();
    }
    this.clock.boot();
  }
  // -------------------------------------------------------------------------
  // The clock
  // -------------------------------------------------------------------------
  /** Minutes since the world began. */
  get now() {
    return this.s.now;
  }
  /** The hour of the day, 0 to 24 (fractional). */
  get hour() {
    return hourOf(this.s.now);
  }
  /** The day number. */
  get day() {
    return dayOf(this.s.now);
  }
  /** The day of the week, 0 to config.week - 1. */
  get weekday() {
    return this.day % this.cfg.week;
  }
  /** How fast time runs: 1 normal, 4 four times as fast, 0 paused, negative runs backward. */
  get speed() {
    return this._speed;
  }
  set speed(v) {
    this._speed = v;
  }
  // Calls that move time or replace the state (tick, advance, advanceTo,
  // seek, rewind, load) can't run in the middle of the engine's work: the
  // queue being run would be swapped out from under it. Made from a listener
  // (or a storylet, an effect, an input handler), they wait until the call
  // that's running returns, then run in order.
  /**
   * Moves the world on by a frame: `seconds` of real time at the current
   * speed and config.minutesPerSecond. A negative speed plays history backward.
   */
  tick(seconds) {
    this.whenFree(() => this.runTick(seconds));
  }
  /** Jumps forward this many minutes at once (sleeping, a cut scene). No frame budget. */
  advance(minutes) {
    this.whenFree(() => this.runTo(this.s.now + minutes));
  }
  /** Runs the world up to time t (minutes). Use this when the game owns the clock. */
  advanceTo(t) {
    this.whenFree(() => this.runTo(t));
  }
  /** Goes to any time Esper still remembers, back or forward. */
  seek(t) {
    this.whenFree(() => this.runSeek(t));
  }
  /** Goes back this many minutes. */
  rewind(minutes) {
    this.whenFree(() => this.runSeek(this.s.now - minutes));
  }
  runTick(seconds) {
    const minutes = seconds * this.config.minutesPerSecond * this._speed;
    if (minutes > 0) this.clock.advanceTo(this.s.now + minutes, this.config.budgetMs);
    else if (minutes < 0) {
      const to = Math.max(this.esper.earliest(), this.s.now + minutes);
      if (to >= this.s.now) {
        this._speed = 0;
        this.emit("esper:start", { t: this.s.now });
      } else {
        const before = this.clock.shown();
        this.esper.seek(to);
        this.clock.refreshBodies(before);
        return;
      }
    }
    this.clock.refreshBodies();
  }
  runTo(t) {
    if (t < this.s.now) {
      this.runSeek(t);
      return;
    }
    this.clock.advanceTo(t, Infinity);
    this.clock.refreshBodies();
  }
  runSeek(t) {
    if (t >= this.s.now) {
      this.runTo(t);
      return;
    }
    const before = this.clock.shown();
    this.esper.seek(t);
    this.clock.refreshBodies(before);
  }
  /** Is the engine in the middle of something: moving time, an event, an input, a listener, a replay? */
  busy() {
    return this.moving > 0 || this.listening > 0 || this.depth > 0 || this.clock.handling !== null || this.replaying;
  }
  /** Runs a call that moves time or replaces the state now, or after the engine's current work if it's busy. */
  whenFree(fn) {
    if (this.busy()) {
      this.later.push(fn);
      return;
    }
    this.moving++;
    try {
      fn();
    } finally {
      this.moving--;
    }
    this.runLater();
  }
  /** Runs the clock calls that waited, in order, once the engine is free. */
  runLater() {
    while (this.later.length && !this.busy()) {
      const fn = this.later.shift();
      this.moving++;
      try {
        fn();
      } finally {
        this.moving--;
      }
    }
  }
  /** Calls the game back at time t: listen with on('timer', ...) or on('timer:' + name, ...). */
  at(t, name, data = {}) {
    this.input("at", [t, name, data]);
  }
  // -------------------------------------------------------------------------
  // Declaring the world
  // -------------------------------------------------------------------------
  need(def) {
    this.needs.set(def.id, def);
    return this;
  }
  place(def) {
    this.ring.place(def);
    return this;
  }
  link(a, b, minutes, oneWay = false) {
    this.ring.link(a, b, minutes, oneWay);
    return this;
  }
  action(def) {
    this.actions.set(def.id, def);
    return this;
  }
  task(def) {
    this.tasks.set(def.id, def);
    return this;
  }
  /** Says what a deed (world.did) means: feelings, memories, regard, standing, crime. */
  deed(verb, def) {
    this.deeds.set(verb, def);
    return this;
  }
  /** A skill: levels that grow with practice (actions' `trains`), read as `skill.<id>`. */
  skill(def) {
    this.skills.defs.set(def.id, def);
    return this;
  }
  /** A kind of pastime that palls (actions' `palls`): its label, and how fast it palls and recovers. */
  pastime(def) {
    this.pastimes.set(def.id, def);
    return this;
  }
  /** A wish (or, with `dream`, a dream) people may come to hold. */
  wish(def) {
    this.wishes.set(def.id, def);
    return this;
  }
  /**
   * Adds a person, or returns them if they already exist (after a load the
   * saved person wins, so declaring everyone on every start is safe).
   */
  person(id, def = {}) {
    const have = this.s.people[id];
    if (have) return have;
    return this.input("person", [id, def]);
  }
  /** Extends the condition language with a term. */
  term(name, fn) {
    this.lang.term(name, fn);
    return this;
  }
  /** Extends the effect language. */
  effect(name, fn) {
    this.lang.effect(name, fn);
    return this;
  }
  /** A module by name, or undefined if it's switched off. */
  module(name) {
    return this.modules.get(name);
  }
  /** Moods, memories, beliefs and the file on the player. */
  get reverie() {
    return this.modules.get("reverie");
  }
  /** Regard, sentiments, compatibility, groups and standing. */
  get fellowship() {
    return this.modules.get("fellowship");
  }
  /** Gossip, witnesses, heat, secrets and favors. */
  get wormtongue() {
    return this.modules.get("wormtongue");
  }
  /** Practices, social acts and lines. */
  get cityspeak() {
    return this.modules.get("cityspeak");
  }
  /** Planning: HTN tasks and getting hold of things. */
  get mentat() {
    return this.modules.get("mentat");
  }
  /** The director. */
  get gaff() {
    return this.modules.get("gaff");
  }
  /** Money, goods, wages, prices and stock. */
  get ceres() {
    return this.modules.get("ceres");
  }
  /** Ages, households, births and departures. */
  get cradle() {
    return this.modules.get("cradle");
  }
  /** The optional language-model voice. */
  get joi() {
    return this.modules.get("joi");
  }
  /** Conditions that run a course: ale, colds, toxins. */
  get athelas() {
    return this.modules.get("athelas");
  }
  /** Genomes: looks, traits, talents and instincts, inherited. */
  get delos() {
    return this.modules.get("delos");
  }
  /** Branching conversations: threads of beats, answers with approaches, promises. */
  get voice() {
    return this.modules.get("voice");
  }
  /** Interactions between people: exchanges by degrees, conversations over turns, quarrels, grudges, feuds and making up. */
  get bree() {
    return this.modules.get("bree");
  }
  // -------------------------------------------------------------------------
  // Talking to the world while it runs
  // -------------------------------------------------------------------------
  /** Sets a fact (the truth of the world), or reads it if no value is given. */
  fact(key2, value) {
    if (value === void 0) return this.s.facts[key2];
    if (this.s.facts[key2] === value) return value;
    this.input("fact", [key2, value]);
    return value;
  }
  /** The places that are loaded and visible: people there get bodies. */
  focus(regions) {
    this.clock.focus(regions);
    this.runLater();
  }
  /** Everyone the game should show now. */
  bodies() {
    return this.clock.bodies();
  }
  /** Anyone's body as it would be shown now (whether or not they're near). */
  body(id) {
    return this.clock.body(id);
  }
  /** The game reports what was seen or heard. */
  sense(stim) {
    this.input("sense", [stim]);
  }
  /** The game reports a deed: someone did something to or for someone. */
  did(actor, verb, data = {}) {
    this.input("did", [actor, verb, data]);
  }
  /** A body reports back: 'failed' (couldn't get there, the slot was taken), or 'done' early. */
  report(id, what, reason = "") {
    this.input("report", [id, what, reason]);
  }
  /** The story layer: tell someone to do something, above their job and routine. */
  direct(id, directive) {
    this.input("direct", [id, directive]);
  }
  /** Rewards or discourages a choice: nudges the habit behind it. */
  reward(id, action, amount) {
    this.input("reward", [id, action, amount]);
  }
  /** Sets a person's variable (money, anything). */
  setVar(id, name, value) {
    this.input("setVar", [id, name, value]);
  }
  /** Gives (or with a negative count, takes) goods. */
  give(id, item, count = 1) {
    this.input("give", [id, item, count]);
  }
  /** Practice from outside the simulation (a lesson, a book): hours of it at the person's own pace. */
  train(id, skill, hours) {
    this.input("train", [id, skill, hours]);
  }
  /** Sets a skill's level outright. */
  setSkill(id, skill, level) {
    this.input("skill", [id, skill, level]);
  }
  /** Gives someone a wish (or a dream), about something if it's given (a dish, a friend's id). */
  wishFor(id, wish, about2) {
    this.input("wish", [id, wish, about2 ?? null]);
  }
  /** Makes a wish someone holds come true. */
  grant(id, wish) {
    this.input("grant", [id, wish]);
  }
  /** The wishes (and the dream) someone holds now. */
  wishesOf(id) {
    const p = this.s.people[id];
    return p ? this.mind.wishesOf(p) : [];
  }
  /** A person's level in a skill now (0 if they've never practiced it and didn't start with it). */
  skillOf(id, skill) {
    const p = this.s.people[id];
    return p ? this.skills.level(p, skill) : 0;
  }
  /** Sends someone away until a time (dormant): they come back with a summary of what they did. */
  away(id, until, summary = "", place) {
    this.input("away", [id, until, summary, place ?? null]);
  }
  /** Has someone follow another (walk together, sit together), or stop (null). */
  follow(id, leader) {
    this.input("follow", [id, leader]);
  }
  /** Removes someone for good ('left', 'died'...). */
  remove(id, why = "left") {
    this.input("remove", [id, why]);
  }
  /** Keeps a piece of the game's own state with the world, so it rewinds with it. */
  keep(key2, value) {
    this.input("keep", [key2, value === void 0 ? null : JSON.parse(JSON.stringify(value))]);
  }
  kept(key2) {
    return this.s.game[key2];
  }
  // -------------------------------------------------------------------------
  // Tuning: settings changed during play
  // -------------------------------------------------------------------------
  /**
   * Changes settings during play (a slider in the game's options). It's an
   * input, so time walk replays the change at the moment it was made, and
   * the overrides are kept in the state, so a save keeps them. `module` is a
   * module's name, or 'core' for the config; `values` are fields of its
   * settings (any of them, not only the headline knobs), each over what was
   * declared. A field set to null goes back to what was declared, and
   * `values` null puts the whole module back. With `person`, it's that
   * person's own headline knobs instead (their `tune`). See docs/tuning.md.
   */
  tune(module2, values, person) {
    const base = this.tuneBase(module2);
    const knobs = this.knobsOf(module2);
    if (values !== null && (typeof values !== "object" || Array.isArray(values))) throw new Error(`Tyrell: tune ${module2} with an object of settings, or null`);
    if (person !== void 0 && !this.s.people[person]) throw new Error(`Tyrell: can't tune '${person}': there's nobody by that id`);
    for (const key2 of Object.keys(values || {})) {
      const v = values[key2];
      if (person !== void 0) {
        if (knobs[key2] !== "person") throw new Error(`Tyrell: '${key2}' isn't a knob of ${module2}'s a person can have their own of`);
        if (v !== null && !(typeof v === "number" && isFinite(v) && v >= 0)) throw new Error(`Tyrell: a person's '${key2}' must be a number, 0 or more, or null`);
        continue;
      }
      if (module2 === "core" && UNTUNED.has(key2)) throw new Error(`Tyrell: set world.config.${key2} directly: it changes nothing that happens`);
      if (!(key2 in base)) throw new Error(`Tyrell: ${module2} has no setting '${key2}'`);
      if (v === null) continue;
      const want = base[key2];
      if (!plain(v)) throw new Error(`Tyrell: '${key2}' must be plain data (numbers, strings, true or false, lists and objects of them)`);
      const curve = CURVES.has(key2) && (typeof v === "string" || Array.isArray(v));
      if (!curve && want !== null && want !== void 0 && kindOf(v) !== kindOf(want)) throw new Error(`Tyrell: '${key2}' is a ${kindOf(want)} in ${module2}, not a ${kindOf(v)}`);
    }
    this.input("tune", [module2, values === null ? null : clone(values), person ?? null]);
  }
  /**
   * The settings in force for a module (or 'core'): a copy of what was
   * declared with any overrides from tune() over it. With a person, their
   * headline knobs as they apply to them: the world's times their own.
   */
  tuning(module2, person) {
    const now2 = { ...this.tuneBase(module2), ...this.s.tune?.[module2] || {} };
    if (person === void 0) return now2;
    const p = this.s.people[person];
    const out = {};
    const knobs = this.knobsOf(module2);
    for (const k of Object.keys(knobs)) if (knobs[k] === "person") out[k] = Number(now2[k]) * this.own(p, module2, k);
    return out;
  }
  /** The core config in force: what was declared (world.config), under any overrides made with tune(). */
  get cfg() {
    return this.tuned("core", this.config);
  }
  /**
   * A module's settings in force (or the core's, as 'core'): `base`, what was
   * declared, under any overrides made with tune(). Untuned, it's `base`
   * itself; tuned, an object whose own fields are the overrides and whose
   * prototype is `base` (so a field the game sets on `base` still shows).
   */
  tuned(name, base) {
    const t = this.s.tune;
    if (t === void 0) return base;
    const o = t[name];
    if (o === void 0) return base;
    const c = this.tunedCache.get(name);
    if (c && c.src === o && c.base === base) return c.out;
    const out = Object.assign(Object.create(base), o);
    this.tunedCache.set(name, { src: o, base, out });
    return out;
  }
  /** A person's own multiplier for one of a module's headline knobs (their `tune`): 1 if they have none. */
  own(p, module2, knob) {
    const v = p?.def.tune?.[module2]?.[knob];
    return typeof v === "number" ? v : 1;
  }
  /** What tune() works over: the config for 'core', else the module's declared settings. */
  tuneBase(module2) {
    if (module2 === "core") return this.config;
    const m = this.modules.get(module2);
    if (!m) throw new Error(`Tyrell: can't tune '${module2}': no module by that name is switched on`);
    if (!m.config) throw new Error(`Tyrell: ${module2} has no settings to tune`);
    return m.config;
  }
  knobsOf(module2) {
    return module2 === "core" ? CORE_KNOBS : this.modules.get(module2)?.knobs ?? {};
  }
  /** Applies a tune (the input): the overrides kept whole, a new object each time, so what's made from them is made again. */
  applyTune(module2, values, person) {
    const p = person !== null ? this.s.people[person] : void 0;
    if (person !== null && !p) return;
    const held = (p ? p.def.tune : this.s.tune) || {};
    const cur = held[module2] || {};
    const next = values === null ? {} : { ...cur };
    for (const k of Object.keys(values || {})) {
      const v = values[k];
      if (v === null) delete next[k];
      else next[k] = v;
    }
    const rising = module2 === "core" && ("needs" in cur || "needs" in next) && cur.needs !== next.needs;
    const who = [];
    if (rising) for (const id in this.s.people) {
      const q = this.s.people[id];
      if (q.status !== "gone" && (!p || q === p)) who.push(q);
    }
    for (const q of who) this.mind.settleRise(q);
    const all = { ...held };
    if (Object.keys(next).length) all[module2] = next;
    else delete all[module2];
    if (p) {
      if (Object.keys(all).length) p.def.tune = all;
      else delete p.def.tune;
    } else if (Object.keys(all).length) this.s.tune = all;
    else delete this.s.tune;
    for (const q of who) if (q.status === "active" && q.doing) this.clock.scheduleChecks(q);
    this.log("tuned", person ?? void 0, { module: module2, values });
  }
  // -------------------------------------------------------------------------
  // Asking about people
  // -------------------------------------------------------------------------
  /** A person's state (read it, don't change it: go through the API). */
  get(id) {
    return this.s.people[id];
  }
  /** Everyone active. */
  people() {
    return Object.values(this.s.people).filter((p) => p.status === "active");
  }
  /** How many of an item a person can use: their own, plus their household's pantry (Ceres). */
  have(p, item) {
    return (p.inv[item] || 0) + (this.ceres ? this.ceres.pantryCount(p.id, item) : 0);
  }
  /** Takes items from a person: their own first, then the household's pantry. */
  takeItem(p, item, n) {
    const own = Math.min(n, p.inv[item] || 0);
    if (own > 0) {
      p.inv[item] -= own;
      if (!p.inv[item]) delete p.inv[item];
    }
    if (n - own > 0 && this.ceres) this.ceres.takeFromPantry(p.id, item, n - own);
  }
  /** A need's level now (0 calm, 1 desperate). */
  needOf(id, need) {
    const p = this.s.people[id];
    return p ? this.mind.level(p, need) : 0;
  }
  /** Why someone is doing what they're doing. */
  why(id) {
    return this.palantir.why(id);
  }
  /** Why someone isn't doing something. */
  whyNot(id, action) {
    return this.palantir.whyNot(id, action);
  }
  /** A readable account of a person: needs, mood, doing, plan, beliefs. */
  describe(id) {
    return this.palantir.describe(id);
  }
  // -------------------------------------------------------------------------
  // Events for the game
  // -------------------------------------------------------------------------
  /**
   * Listens for an event: 'embody', 'disembody', 'step', 'say', 'report'...
   * or '*' for all, which get `{ kind, ...payload, event }`: `event` is
   * always the event's name (`kind` is too, unless the payload has its own).
   */
  on(kind, fn) {
    const list = this.listeners.get(kind) || [];
    list.push(fn);
    this.listeners.set(kind, list);
    return () => this.off(kind, fn);
  }
  off(kind, fn) {
    const list = this.listeners.get(kind);
    if (list) this.listeners.set(kind, list.filter((f) => f !== fn));
  }
  /** Tells the game something happened (silent while Esper replays). */
  emit(kind, data = {}) {
    if (this.replaying) return;
    const a = this.listeners.get(kind), b = kind !== "*" ? this.listeners.get("*") : void 0;
    if (!a?.length && !b?.length) return;
    const outer = this.listenDepth;
    this.listening++;
    this.listenDepth = this.depth;
    try {
      for (const fn of a || []) fn(data);
      for (const fn of b || []) fn({ kind, ...data, event: kind });
    } finally {
      this.listening--;
      this.listenDepth = outer;
    }
  }
  // -------------------------------------------------------------------------
  // Saving
  // -------------------------------------------------------------------------
  /** The whole world as plain JSON. With history, Esper's memory goes too. */
  save(withHistory = false) {
    const out = { tyrell: "world", v: SCHEMA, s: JSON.parse(JSON.stringify(this.s)) };
    if (withHistory) out.history = this.esper.export();
    return out;
  }
  /**
   * Loads a saved world (migrating older saves). Declare places and actions
   * before or after. From a listener, it waits until the running call returns.
   */
  load(data) {
    this.whenFree(() => this.runLoad(data));
  }
  runLoad(data) {
    const d = typeof data === "string" ? JSON.parse(data) : data;
    const v = d.v ?? d.s.v ?? 1;
    if (v > SCHEMA) throw new Error(`Tyrell: save version ${v} is newer than this engine (${SCHEMA})`);
    const s = migrate(typeof data === "string" ? d.s : clone(d.s), v);
    this.s = s;
    for (const m of this.hooks) {
      if (m.init && this.s.mod[m.name] === void 0) this.s.mod[m.name] = m.init();
      m.loaded?.();
    }
    for (const def of this.ring.defs.values()) this.ring.state(def.id);
    this.esper.reset();
    if (d.history) {
      const h = d.history;
      this.esper.import(v < SCHEMA && h.snaps ? { ...h, snaps: h.snaps.map((sn) => ({ ...sn, s: JSON.stringify(migrate(JSON.parse(sn.s), v)) })) } : h);
    }
    this.palantir.clear();
    this.clock.reset();
    this.clock.refreshBodies();
  }
  /** A hash of the whole state: two worlds with the same hash are the same. */
  hash() {
    return hash(stableStringify(this.s)).toString(16);
  }
  // -------------------------------------------------------------------------
  // Randomness
  // -------------------------------------------------------------------------
  /** A random stream for one person's next decision (advances their counter). */
  stream(p) {
    return new Stream(this.s.seed, p.id, p.n++);
  }
  /** A random stream for the world itself (directors, strangers, events). */
  worldStream(name) {
    return new Stream(this.s.seed, "world", name, this.s.n++);
  }
  /** A random stream that changes nothing (for choices that only look, like a line to show). */
  worldStreamPeek(...parts) {
    return new Stream(this.s.seed, "peek", ...parts);
  }
  /**
   * Runs fn as a look: `chance:` conditions inside it draw from a stream
   * that changes nothing, so looking leaves the world as it was. The
   * engine's own looks (cityspeak.choose, whyNot, describe, Joi...) do this.
   */
  peek(fn) {
    this.looking++;
    try {
      return fn();
    } finally {
      this.looking--;
    }
  }
  // -------------------------------------------------------------------------
  // Inputs (recorded for Esper)
  // -------------------------------------------------------------------------
  /** Registers an input handler: a change from outside that Esper records and replays. */
  defineInput(name, fn) {
    this.inputs.set(name, fn);
  }
  /**
   * Applies an input and records it for Esper, so a rewind can replay it.
   *
   *  - A plain call from the game is recorded at the current time.
   *  - A call the game makes from inside a listener, while the engine is in
   *    the middle of something (handling an event, applying another input),
   *    waits until that's finished and is recorded to replay at exactly that
   *    point (after that event, or chained to that input).
   *  - Calls the engine makes itself, or that a storylet makes while the
   *    engine runs it (world.internally), are applied but not recorded:
   *    a replay makes them again.
   */
  input(name, args) {
    const fn = this.inputs.get(name);
    if (!fn) throw new Error(`Tyrell: unknown input '${name}'`);
    if (this.replaying) return this.applyInput(fn, args);
    const fromGame = this.fromListener();
    if (this.depth > 0 && !fromGame) return this.applyInput(fn, args);
    const handling = this.clock.handling;
    if (this.depth > 0 || handling !== null) {
      if (IMMEDIATE.has(name)) {
        this.deferred.push([name, args, true]);
        return this.applyInput(fn, args);
      }
      this.deferred.push([name, args, false]);
      return void 0;
    }
    if (this.esper.echo(name, args)) return void 0;
    this.esper.record(name, args);
    const out = this.applyInput(fn, args);
    this.flushDeferred(void 0);
    this.runLater();
    return out;
  }
  /** Is the code running now a listener's own (game code), not engine work it set off? */
  fromListener() {
    return this.listening > 0 && this.depth === this.listenDepth;
  }
  applyInput(fn, args) {
    this.depth++;
    try {
      return fn(...args);
    } finally {
      this.depth--;
    }
  }
  /**
   * Applies the calls that waited (Entmoot calls this after each event, with
   * its seq; input() calls it after each input, with none: they chain).
   */
  flushDeferred(after) {
    let first = true;
    while (this.deferred.length) {
      const [name, args, applied] = this.deferred.shift();
      const fn = this.inputs.get(name);
      if (!fn) continue;
      const a = first && after !== void 0 ? after : void 0;
      const chain = !(first && after !== void 0);
      first = false;
      if (this.esper.echo(name, args, a, chain)) continue;
      this.esper.record(name, args, a, chain);
      if (!applied) this.applyInput(fn, args);
    }
  }
  /**
   * Runs engine-driven code (a director's storylet, a module's callback into
   * the game): inputs it makes are applied but not recorded, because a replay
   * runs the same code again.
   */
  internally(fn) {
    this.depth++;
    try {
      return fn();
    } finally {
      this.depth--;
    }
  }
  /** Replays a recorded input (Esper only). */
  replay(name, args) {
    const fn = this.inputs.get(name);
    if (fn) this.applyInput(fn, args);
  }
  // -------------------------------------------------------------------------
  // Internals shared by the parts
  // -------------------------------------------------------------------------
  /** A context for conditions about a person. */
  ctx(p, extra = {}) {
    return { world: this, person: p, ...extra };
  }
  /** The next sequence number (for queue items and doings). */
  nextSeq() {
    return ++this.s.seq;
  }
  /**
   * Writes to the log and tells the game. Inside the simulation (modules,
   * effects, input handlers) it writes at once; from the game it's an input,
   * so the entry is recorded for time walk.
   */
  log(k, who, d) {
    const engine = !this.fromListener() && (this.depth > 0 || this.clock.handling !== null || this.replaying || this.moving > 0);
    if (engine) this.westmarch.write(k, who, d);
    else this.input("log", [k, who ?? null, d === void 0 ? null : JSON.parse(JSON.stringify(d))]);
  }
  makePerson(id, def) {
    const needs = {};
    for (const [nid, nd] of this.needs) needs[nid] = { v: clamp(def.needs?.[nid] ?? nd.start ?? this.cfg.needStart), t: this.s.now };
    const p = {
      id,
      name: def.name || id,
      def: JSON.parse(JSON.stringify(def)),
      status: "active",
      needs,
      vars: { money: 0, ...def.vars || {} },
      inv: { ...def.inv || {} },
      place: def.place || def.home || null,
      doing: null,
      habits: {},
      cool: {},
      n: 0,
      plan: null,
      suspended: [],
      directive: null
    };
    if (def.born !== void 0) p.born = def.born;
    return p;
  }
  registerCore() {
    const L = this.lang;
    const person = (ctx, arg) => {
      if (arg.startsWith("target.")) return ctx.target ? this.s.people[ctx.target] : void 0;
      return ctx.person;
    };
    void person;
    L.term("need", (c, a) => c.person ? this.mind.level(c.person, a) : void 0);
    L.term("var", (c, a) => c.person?.vars[a]);
    L.term("money", (c) => Number(c.person?.vars.money ?? 0));
    L.term("trait", (c, a) => c.person?.def.traits?.[a] ?? this.cfg.traitDefault);
    L.term("value", (c, a) => c.person?.def.values?.[a] ?? 0);
    L.term("has", (c, a) => c.person ? this.have(c.person, a) : 0);
    L.term("hour", () => this.hour);
    L.term("day", () => this.day);
    L.term("weekday", () => this.weekday);
    L.term("fact", (c, a) => {
      const v = this.s.facts[a];
      if (v !== void 0) return v;
      return this.shell.check ? this.shell.check(a, c) ?? null : null;
    });
    L.term("game", (_c, a) => this.s.game[a]);
    L.term("at", (c, a) => {
      const p = c.person;
      if (!p || !p.place || p.doing?.kind === "travel") return false;
      if (a.startsWith("tag:")) return this.ring.hasTag(p.place, a.slice(4));
      if (a === "home") return !!p.def.home && this.ring.within(p.place, p.def.home);
      if (a === "work") return !!p.def.job && this.ring.within(p.place, p.def.job.place);
      return this.ring.within(p.place, a);
    });
    L.term("open", (_c, a) => this.ring.open(a));
    L.term("free", (_c, a) => {
      const [pl, slot] = a.split(".");
      return this.ring.free(pl, slot);
    });
    L.term("is", (c, a) => !!c.person?.def.tags?.includes(a));
    L.term("job", (c, a) => a ? c.person?.def.job?.id === a : c.person?.def.job?.id ?? null);
    L.term("in", (c, a) => c.person?.place ? this.ring.region(c.person.place) === a : false);
    L.term("doing", (c, a) => a ? c.person?.doing?.action === a : c.person?.doing?.action ?? null);
    L.term("with", (c, a) => {
      const o = this.s.people[a];
      return !!(c.person?.place && o?.place && o.doing?.kind !== "travel" && this.ring.root(o.place) === this.ring.root(c.person.place));
    });
    L.term("topic", (c, a) => c.topic === a);
    L.term("chance", (c, a) => {
      if (this.looking > 0) return this.worldStreamPeek("chance", c.person?.id ?? "world", c.person?.n ?? this.s.n, this.s.now, c.action ?? "", c.place ?? "", a).chance(Number(a));
      return c.person ? this.stream(c.person).chance(Number(a)) : this.worldStream("chance").chance(Number(a));
    });
    L.term("target", (c, a) => {
      if (!c.target) return null;
      if (!a) return c.target;
      const t = this.s.people[c.target];
      return t ? this.lang.value(a, { ...c, person: t, target: c.person?.id ?? null }) : null;
    });
    L.term("person", (c) => c.person?.id ?? null);
    L.term("place", (c, a) => a ? c.place === a : c.place ?? null);
    L.term("home", (c) => c.person?.def.home ?? null);
    L.term("habit", (c, a) => c.person ? this.mind.habit(c.person, a || c.action || "") : 1);
    L.term("crowd", (c, a) => {
      const pl = a || c.place || c.person?.place;
      return pl ? this.ring.crowd(pl) : 0;
    });
    L.effect("var", (c, a, op, v) => {
      if (!c.person) return;
      const name = a.startsWith("var.") ? a.slice(4) : a;
      c.person.vars[name] = combine(c.person.vars[name], op, v);
    });
    L.effect("money", (c, _a, op, v) => {
      if (c.person) c.person.vars.money = combine(c.person.vars.money ?? 0, op, v);
    });
    L.effect("need", (c, a, op, v) => {
      if (c.person) this.mind.setLevel(c.person, a, Number(combine(this.mind.level(c.person, a), op, v)));
    });
    L.effect("give", (c, a) => {
      if (c.person) {
        const [item, n] = itemCount(a);
        c.person.inv[item] = (c.person.inv[item] || 0) + n;
      }
    });
    L.effect("take", (c, a) => {
      if (!c.person) return;
      const [item, n] = itemCount(a);
      this.takeItem(c.person, item, n);
    });
    L.effect("fact", (_c, a, op, v) => {
      this.s.facts[a] = combine(this.s.facts[a], op, v);
    });
    L.effect("game", (_c, a, op, v) => {
      this.s.game[a] = combine(this.s.game[a], op, v);
    });
    L.effect("log", (c, a) => this.log(a, c.person?.id));
    this.defineInput("person", (id, def) => {
      if (this.s.people[id]) return this.s.people[id];
      const p = this.makePerson(id, def);
      this.s.people[id] = p;
      for (const m of this.hooks) m.added?.(p);
      this.clock.wake(p, 0);
      this.log("joined", id);
      return p;
    });
    this.defineInput("fact", (key2, value) => {
      this.s.facts[key2] = value;
      this.log("fact", void 0, { key: key2, value });
      this.clock.factChanged(key2);
    });
    this.defineInput("sense", (stim) => {
      const s = { ...stim };
      if (!s.seenBy) s.seenBy = s.place ? this.ring.present(s.place).filter((id) => id !== s.actor) : [];
      this.log("sensed", s.actor, { kind: s.kind, what: s.what ?? null, place: s.place ?? null, by: s.seenBy });
      for (const m of this.hooks) m.sensed?.(s);
    });
    this.defineInput("did", (actor, verb, data) => {
      this.log("did", actor, { verb, ...data });
      for (const m of this.hooks) m.did?.(actor, verb, data);
    });
    this.defineInput("report", (id, what, reason) => {
      const p = this.s.people[id];
      if (!p || p.status !== "active") return;
      if (what === "failed") this.clock.fail(p, reason || "the body could not do it");
      else this.clock.finishNow(p);
    });
    this.defineInput("direct", (id, d) => {
      const p = this.s.people[id];
      if (!p) return;
      p.directive = d ? { ...d } : null;
      this.log(d ? "directed" : "released", id, d ? { do: d.do, ...d.label ? { label: d.label } : {} } : void 0);
      this.clock.rethink(p, "directive");
    });
    this.defineInput("reward", (id, action, amount) => {
      const p = this.s.people[id];
      if (p) this.mind.nudge(p, action, amount);
    });
    this.defineInput("setVar", (id, name, value) => {
      const p = this.s.people[id];
      if (p) p.vars[name] = value;
    });
    this.defineInput("give", (id, item, count) => {
      const p = this.s.people[id];
      if (!p) return;
      p.inv[item] = Math.max(0, (p.inv[item] || 0) + count);
      if (!p.inv[item]) delete p.inv[item];
    });
    this.defineInput("away", (id, until, summary, place) => this.clock.sendAway(id, until, summary, place));
    this.defineInput("follow", (id, leader) => {
      const p = this.s.people[id];
      if (!p) return;
      if (leader) p.follow = leader;
      else delete p.follow;
    });
    this.defineInput("remove", (id, why) => this.clock.removePerson(id, why));
    this.defineInput("keep", (key2, value) => {
      this.s.game[key2] = value;
    });
    this.defineInput("log", (k, who, d) => this.westmarch.write(k, who ?? void 0, d ?? void 0));
    this.defineInput("at", (t, name, data) => {
      this.clock.schedule({ t, k: "timer", ref: name, data });
    });
    this.defineInput("tune", (module2, values, person2) => this.applyTune(module2, values, person2));
  }
};
function plain(v) {
  if (v === null || typeof v === "string" || typeof v === "boolean") return true;
  if (typeof v === "number") return isFinite(v);
  if (Array.isArray(v)) return v.every(plain);
  if (typeof v === "object") {
    const proto = Object.getPrototypeOf(v);
    return (proto === Object.prototype || proto === null) && Object.values(v).every(plain);
  }
  return false;
}
var kindOf = (v) => Array.isArray(v) ? "list" : v === null ? "null" : typeof v;
var IMMEDIATE = /* @__PURE__ */ new Set(["person", "promote", "say", "birth", "recollect", "social", "draw", "afflict", "voice.start", "voice.answer", "bree.start"]);
var MIGRATIONS = {
  // 1 -> 2: Cityspeak remembers lines said by their key, not their index. The
  // old records are kept apart (it takes the line definitions to read them).
  1: (s) => {
    const cs = s.mod?.cityspeak;
    if (cs?.said && Object.keys(cs.said).length) {
      cs.byIndex = cs.said;
      cs.said = {};
    }
    return s;
  }
};
function migrate(s, v) {
  for (; v < SCHEMA; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`Tyrell: no migration from save version ${v}`);
    s = step(s);
  }
  s.v = SCHEMA;
  return s;
}

// tyrell/src/modules/reverie.ts
var DEFAULT_REVERIE = {
  base: 0.6,
  needWeight: 0.25,
  emotionFloor: 0.08,
  minor: [0.35, 4],
  major: [0.2, 0.8],
  extreme: [0.08, 0.5],
  memoryCap: 24,
  coreCap: 8,
  memoryDecay: 0.995,
  beliefFloor: 0.05,
  beliefDecay: 0.97,
  stressShort: 12 * HOUR,
  stressLong: 7 * DAY,
  breaks: 1,
  forgetting: 1,
  feelings: 1,
  stress: 1,
  stackMul: 0.8,
  feelingStress: 0.5,
  needEmotion: 0.7,
  needEmotionWeight: 0.8,
  stressShortWeight: 0.6,
  stressLongWeight: 0.6,
  stressCarry: 0.15,
  strainAt: 0.6,
  strain: 0.02,
  memoryImportance: 5,
  memoryFloor: 0.5,
  coreRecalls: 3,
  coreImportance: 7,
  coreChance: 1 / 3,
  sawDecay: null,
  breakRank: 4,
  breakDone: 0.5,
  catharsisKeep: 0.7,
  againstPull: 0.8,
  againstFloor: 0.05,
  againstStress: 0.3
};
var BUILTIN_FEELINGS = [
  { id: "catharsis", label: "Got it out of my system", weight: 0.25, minutes: 2 * DAY, emotion: "relieved" },
  { id: "conscience", label: "A guilty conscience", weight: -0.1, minutes: DAY, stack: 3, emotion: "guilty" },
  { id: "witnessed", label: "Saw something bad", weight: -0.06, minutes: 12 * HOUR, stack: 2, emotion: "tense" },
  { id: "frustrated", label: "Nothing went right", weight: -0.06, minutes: 6 * HOUR, stack: 3, emotion: "angry" },
  { id: "grief", label: "Grieving", weight: -0.3, minutes: 7 * DAY, emotion: "sad" },
  { id: "scared", label: "Frightened", weight: -0.15, minutes: DAY, stack: 2, emotion: "scared" },
  { id: "helped", label: "Someone helped me", weight: 0.1, minutes: DAY, stack: 3, emotion: "happy" },
  { id: "wronged", label: "Someone did me wrong", weight: -0.12, minutes: 2 * DAY, stack: 3, emotion: "angry" }
];
var Reverie = class {
  constructor(cfg = {}) {
    this.name = "reverie";
    this.knobs = { breaks: "person", forgetting: "person", feelings: "person", stress: "person" };
    this.feelingDefs = /* @__PURE__ */ new Map();
    this.breakDefs = /* @__PURE__ */ new Map();
    this.memoryKinds = /* @__PURE__ */ new Map();
    this.config = { ...DEFAULT_REVERIE, ...cfg };
    for (const f of BUILTIN_FEELINGS) this.feelingDefs.set(f.id, f);
  }
  init() {
    return { f: {}, m: {}, b: {}, files: {}, st: {}, checked: {}, shifts: {} };
  }
  get st() {
    return this.w.s.mod.reverie;
  }
  /** The config in force: as declared, under any world.tune. */
  get c() {
    return this.w.tuned(this.name, this.config);
  }
  /** A headline knob for someone: the world's, times their own. */
  knob(name, id) {
    return this.c[name] * this.w.own(id === void 0 ? void 0 : this.w.s.people[id], this.name, name);
  }
  attach(w) {
    this.w = w;
    const L = w.lang;
    L.term("mood", (c) => c.person ? this.mood(c.person.id) : 0.5);
    L.term("stress", (c) => c.person ? this.stress(c.person.id) : 0);
    L.term("emotion", (c, a) => c.person ? a ? this.emotion(c.person.id) === a : this.emotion(c.person.id) : null);
    L.term("felt", (c, a) => c.person ? this.feelings(c.person.id).some((f) => f.id === a) : false);
    L.term("believes", (c, a) => {
      if (!c.person) return null;
      const [key2, want] = splitEq(a);
      const v = this.belief(c.person.id, key2);
      return want === void 0 ? v ?? null : v === want;
    });
    L.term("knows", (c, a) => c.person ? this.belief(c.person.id, a) !== void 0 : false);
    L.term("thinks", (c, a) => c.person ? this.thinks(c.person.id, a) : w.s.facts[a] ?? null);
    L.term("file", (c, a) => {
      if (!c.person) return 0;
      const [subject, verb] = a.split(".");
      const file = this.file(c.person.id, subject === "target" ? c.target ?? "" : subject);
      if (!file) return 0;
      return verb ? file.tally[verb] ?? 0 : file.met;
    });
    L.term("memories", (c, a) => c.person ? (this.st.m[c.person.id] || []).filter((m) => !a || m.k === a).length : 0);
    L.effect("feel", (c, a) => {
      if (c.person) this.applyFeel(c.person.id, a);
    });
    L.effect("believe", (c, a, _op, v) => {
      if (c.person) this.applyBelieve(c.person.id, a, v ?? true, "knew");
    });
    L.effect("forget", (c, a) => {
      if (c.person) delete this.st.b[c.person.id]?.[a];
    });
    L.effect("remember", (c, a) => {
      if (c.person) this.applyRemember(c.person.id, { k: a, place: c.place ?? void 0, about: c.target ?? void 0 });
    });
    w.defineInput("feel", (id, f, cause) => this.applyFeel(id, f, cause));
    w.defineInput("believe", (id, key2, v, src, from, str) => this.applyBelieve(id, key2, v, src, from, str));
    w.defineInput("remember", (id, m) => this.applyRemember(id, m));
    w.defineInput("forget", (id, key2) => {
      delete this.st.b[id]?.[key2];
    });
    w.defineInput("recollect", (id, match, n) => this.applyRecall(id, match, n));
    w.defineInput("hush", (id, key2, on) => this.applySilence(id, key2, on));
  }
  // -------------------------------------------------------------------------
  // Declaring
  // -------------------------------------------------------------------------
  feeling(def) {
    this.feelingDefs.set(def.id, def);
    return this;
  }
  breakdown(def) {
    this.breakDefs.set(def.id, def);
    return this;
  }
  memoryKind(def) {
    this.memoryKinds.set(def.id, def);
    return this;
  }
  // -------------------------------------------------------------------------
  // Feelings and mood
  // -------------------------------------------------------------------------
  /** Gives someone a feeling (from the game: recorded for time walk). */
  feel(id, feeling, cause) {
    this.w.input("feel", [id, feeling, cause ?? null]);
  }
  /** Gives a feeling inside the simulation (modules use this; the game uses feel()). */
  applyFeel(id, feeling, cause) {
    var _a;
    const def = this.feelingDefs.get(feeling);
    const p = this.w.s.people[id];
    if (!def || !p) return;
    const now2 = this.w.s.now;
    const list = ((_a = this.st.f)[id] || (_a[id] = [])).filter((f) => f.until > now2);
    const same = list.filter((f) => f.id === feeling);
    const cap = def.stack ?? 1;
    let w = def.weight;
    if (same.length >= cap) {
      const oldest = same.sort((a, b) => a.t - b.t)[0];
      oldest.t = now2;
      oldest.until = now2 + def.minutes;
      if (cause) oldest.cause = cause;
    } else {
      w = def.weight * Math.pow(def.stackMul ?? this.c.stackMul, same.length);
      const f = { id: feeling, t: now2, until: now2 + def.minutes, w: round(w, 4) };
      if (cause) f.cause = cause;
      list.push(f);
    }
    this.st.f[id] = list;
    const stress = def.stress ?? (def.weight < 0 ? -def.weight * this.c.feelingStress : 0);
    if (stress) this.addStress(id, stress);
    this.w.log("felt", id, { feeling, label: def.label ?? feeling, ...cause ? { cause } : {} });
    this.w.emit("felt", { id, feeling, label: def.label ?? feeling, emotion: def.emotion ?? null });
  }
  /** Active feelings with their labels and weights. */
  feelings(id) {
    const now2 = this.w.s.now;
    return (this.st.f[id] || []).filter((f) => f.until > now2).map((f) => {
      const def = this.feelingDefs.get(f.id);
      return { id: f.id, label: def?.label ?? f.id, weight: f.w, until: f.until, emotion: def?.emotion, cause: f.cause };
    });
  }
  /** Mood, 0 (miserable) to 1 (elated): feelings, less unmet needs. */
  mood(id) {
    const p = this.w.s.people[id];
    if (!p) return 0.5;
    const c = this.c;
    const k = this.knob("feelings", id);
    let m = c.base;
    for (const f of this.feelings(id)) m += f.weight * k;
    let pen = 0, n = 0;
    for (const need of this.w.needs.keys()) {
      pen += this.w.mind.urgency(p, need);
      n++;
    }
    if (n) m -= pen / n * c.needWeight * 2;
    return round(clamp(m), 4);
  }
  /** The one named emotion showing now ('fine' when nothing stands out). */
  emotion(id) {
    const sums = /* @__PURE__ */ new Map();
    for (const f of this.feelings(id)) if (f.emotion) sums.set(f.emotion, (sums.get(f.emotion) || 0) + Math.abs(f.weight));
    const p = this.w.s.people[id];
    const c = this.c;
    if (p) for (const [nid, nd] of this.w.needs) {
      if (!nd.emotion) continue;
      const lvl = this.w.mind.level(p, nid);
      if (lvl > c.needEmotion) sums.set(nd.emotion, (sums.get(nd.emotion) || 0) + (lvl - c.needEmotion) * c.needEmotionWeight);
    }
    let best = "fine", top = c.emotionFloor;
    for (const [e, v] of sums) if (v > top || v === top && e < best) {
      best = e;
      top = v;
    }
    return best;
  }
  // -------------------------------------------------------------------------
  // Stress
  // -------------------------------------------------------------------------
  /** Stress now: short-term and long-term together, 0..1. */
  stress(id) {
    const [s, l] = this.stressParts(id);
    const c = this.c;
    return round(clamp(s * c.stressShortWeight + l * c.stressLongWeight), 4);
  }
  stressParts(id) {
    const cur = this.st.st[id];
    if (!cur) return [0, 0];
    const dt = this.w.s.now - cur[2];
    const c = this.c;
    const s = cur[0] * Math.pow(0.5, dt / c.stressShort);
    const l = cur[1] * Math.pow(0.5, dt / c.stressLong);
    return [s, l];
  }
  addStress(id, amount) {
    const [s, l] = this.stressParts(id);
    const c = this.c;
    const a = amount * this.knob("stress", id);
    const ns = clamp(s + a);
    const nl = clamp(l + a * c.stressCarry + (ns > c.strainAt ? c.strain : 0));
    this.st.st[id] = [round(ns, 5), round(nl, 5), this.w.s.now];
  }
  // -------------------------------------------------------------------------
  // Memories
  // -------------------------------------------------------------------------
  /** Remembers something (from the game: recorded for time walk). */
  remember(id, m) {
    this.w.input("remember", [id, m]);
  }
  /** Remembers inside the simulation (modules use this). */
  applyRemember(id, m) {
    var _a;
    if (!this.w.s.people[id]) return;
    const kind = this.memoryKinds.get(m.k);
    const mem = { k: m.k, t: this.w.s.now, imp: clamp(m.imp ?? kind?.importance ?? this.c.memoryImportance, 1, 10), recalls: 0 };
    if (m.about) mem.about = m.about;
    if (m.place) mem.place = m.place;
    if (m.text) mem.text = m.text;
    const list = (_a = this.st.m)[id] || (_a[id] = []);
    list.push(mem);
    const loose = list.filter((x) => !x.core);
    if (loose.length > this.c.memoryCap) {
      let worst = loose[0];
      for (const x of loose) if (this.strength(x, id) < this.strength(worst, id)) worst = x;
      list.splice(list.indexOf(worst), 1);
    }
  }
  /** How strongly a memory is held now (by whom, for their own pace of forgetting): importance, faded by time. Core memories don't fade. */
  strength(m, id) {
    if (m.core) return m.imp;
    const hours = (this.w.s.now - m.t) / HOUR;
    return m.imp * Math.pow(this.c.memoryDecay, hours * this.knob("forgetting", id));
  }
  /** Someone's memories, strongest first. */
  memories(id) {
    return (this.st.m[id] || []).slice().sort((a, b) => this.strength(b, id) - this.strength(a, id));
  }
  /**
   * Brings memories to mind: the strongest matching ones (about someone, of
   * a kind). Recalling an important memory often enough can make it a core
   * memory that changes them. From the game: recorded for time walk.
   */
  recall(id, match = {}, n = 3) {
    return this.w.input("recollect", [id, match, n]) ?? [];
  }
  /** Recalls inside the simulation (copies of the memories recalled). */
  applyRecall(id, match = {}, n = 3) {
    const list = (this.st.m[id] || []).filter((m) => (!match.about || m.about === match.about) && (!match.k || m.k === match.k) && (!match.place || m.place === match.place));
    const out = list.sort((a, b) => this.strength(b, id) - this.strength(a, id)).slice(0, n);
    const c = this.c;
    for (const m of out) {
      m.recalls++;
      if (!m.core && m.recalls >= c.coreRecalls && m.imp >= c.coreImportance) this.maybeCore(id, m);
    }
    return out.map((m) => ({ ...m }));
  }
  maybeCore(id, m) {
    var _a, _b;
    const p = this.w.s.people[id];
    if (!p) return;
    const cores = (this.st.m[id] || []).filter((x) => x.core).length;
    if (cores >= this.c.coreCap) return;
    if (!this.w.stream(p).chance(this.c.coreChance)) return;
    m.core = true;
    const kind = this.memoryKinds.get(m.k);
    const shifts = kind?.shifts || {};
    (_a = p.def).traits || (_a.traits = {});
    for (const trait in shifts) {
      const before = p.def.traits[trait] ?? this.w.cfg.traitDefault;
      const after = clamp(before + shifts[trait]);
      p.def.traits[trait] = round(after, 4);
      ((_b = this.st.shifts)[id] || (_b[id] = [])).push({ trait, by: round(after - before, 4), cause: m.text ?? m.k, t: this.w.s.now });
    }
    this.w.log("changed", id, { memory: m.k, shifts });
    this.w.emit("changed", { id, memory: m.k, shifts });
  }
  /** How a person's traits have shifted, and why. */
  shifts(id) {
    return this.st.shifts[id]?.slice() ?? [];
  }
  // -------------------------------------------------------------------------
  // Beliefs
  // -------------------------------------------------------------------------
  /** Gives someone a belief (from the game: recorded for time walk). */
  believe(id, key2, v, src = "knew", from, str = 1) {
    this.w.input("believe", [id, key2, v, src, from ?? null, str]);
  }
  /** Changes a belief inside the simulation (modules use this). */
  applyBelieve(id, key2, v, src, from, str = 1, hops = 0) {
    var _a;
    if (!this.w.s.people[id]) return;
    const map = (_a = this.st.b)[id] || (_a[id] = {});
    const cur = map[key2];
    const strength = clamp(str);
    if (cur && cur.v === v) {
      cur.str = round(Math.max(cur.str, strength), 4);
      cur.t = this.w.s.now;
      if (src === "saw") cur.src = "saw";
      return;
    }
    if (cur && cur.src === "saw" && src !== "saw" && cur.str >= strength) return;
    if (cur && src !== "saw" && cur.str > strength) return;
    const b = { v, src, t: this.w.s.now, str: round(strength, 4), hops };
    if (from) b.from = from;
    map[key2] = b;
  }
  forget(id, key2) {
    this.w.input("forget", [id, key2]);
  }
  /** What someone believes about a key (undefined if they don't know or have forgotten). */
  belief(id, key2) {
    const b = this.st.b[id]?.[key2];
    return b && b.str >= this.c.beliefFloor ? b.v : void 0;
  }
  /** The full belief record. */
  beliefRecord(id, key2) {
    const b = this.st.b[id]?.[key2];
    return b ? { key: key2, ...b } : void 0;
  }
  /** What someone takes to be true: their belief, or the world's fact if they have none. */
  thinks(id, key2) {
    const b = this.belief(id, key2);
    if (b !== void 0) return b;
    const f = this.w.s.facts[key2];
    if (f !== void 0) return f;
    const p = this.w.s.people[id];
    const v = this.w.lang.value(key2, this.w.ctx(p));
    return v === void 0 ? null : v;
  }
  /** All of someone's beliefs, strongest and newest first. */
  beliefs(id) {
    const map = this.st.b[id] || {};
    const floor = this.c.beliefFloor;
    return Object.keys(map).map((key2) => ({ key: key2, ...map[key2] })).filter((b) => b.str >= floor).sort((a, b) => b.str - a.str || b.t - a.t || (a.key < b.key ? -1 : 1));
  }
  /** Is someone's belief true? (null when the world has no fact to check it against) */
  accurate(id, key2) {
    const f = this.w.s.facts[key2];
    if (f === void 0) return null;
    return this.belief(id, key2) === f;
  }
  /** Marks a belief as one they won't pass on (a promise kept; from the game: recorded). */
  silence(id, key2, on = true) {
    this.w.input("hush", [id, key2, on]);
  }
  /** Marks a belief as one they won't pass on, inside the simulation (paid or scared off). */
  applySilence(id, key2, on = true) {
    const b = this.st.b[id]?.[key2];
    if (b) {
      if (on) b.silenced = true;
      else delete b.silenced;
    }
  }
  // -------------------------------------------------------------------------
  // Files
  // -------------------------------------------------------------------------
  /** Someone's file on someone else (the player, usually). */
  file(id, subject) {
    return this.st.files[id]?.[subject];
  }
  /** Notes a deed in someone's file on someone, inside the simulation (the game reports deeds with world.did). */
  applyNote(id, subject, verb, what) {
    var _a;
    const files = (_a = this.st.files)[id] || (_a[id] = {});
    const now2 = this.w.s.now;
    const f = files[subject] || (files[subject] = { met: 0, first: now2, last: now2, tally: {}, notes: [] });
    f.last = now2;
    f.tally[verb] = (f.tally[verb] || 0) + 1;
    const e = { verb, t: now2 };
    if (what) e.what = what;
    f.notes.push(e);
    if (f.notes.length > 12) f.notes.shift();
  }
  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------
  candidates(p, out) {
    if (!this.breakDefs.size) return;
    const st = this.st, now2 = this.w.s.now;
    const last = st.checked[p.id] ?? now2;
    st.checked[p.id] = now2;
    const dt = Math.min(DAY, Math.max(0, now2 - last));
    if (dt <= 0) return;
    if (p.doing && p.doing.layer === "break") return;
    const mood = this.mood(p.id);
    const c = this.c;
    const level = mood < c.extreme[0] ? "extreme" : mood < c.major[0] ? "major" : mood < c.minor[0] ? "minor" : null;
    if (!level) return;
    const mtbDays = c[level][1];
    const r = this.w.stream(p);
    if (!r.chance(1 - Math.exp(-dt * this.knob("breaks", p.id) / (mtbDays * DAY)))) return;
    const order = ["extreme", "major", "minor"];
    let defs = [];
    for (const lv of order.slice(order.indexOf(level))) {
      defs = [...this.breakDefs.values()].filter((d) => d.level === lv);
      if (defs.length) break;
    }
    const ctx = this.w.ctx(p);
    const pick = r.weighted(defs, (d) => (d.weight || []).reduce((acc, k) => acc * this.w.mind.consider(k, ctx), 1));
    if (!pick) return;
    const kind = this.w.tasks.has(pick.do) ? "task" : "action";
    const places = this.w.ring.resolve(pick.at ?? (this.w.actions.get(pick.do)?.at ?? null), p);
    out.push({ id: pick.do, kind, place: places[0] ?? null, rank: c.breakRank, layer: "break", weight: 1, parts: [["break", 1]] });
    st.checked[p.id] = now2;
    this.w.log("broke", p.id, { kind: pick.id, level, mood });
    this.w.emit("broke", { id: p.id, kind: pick.id, level, label: pick.label ?? pick.id });
  }
  consider(p, c) {
    const out = [];
    const a = c.kind === "action" ? this.w.actions.get(c.id) : void 0;
    const tags = a?.tags || this.w.tasks.get(c.id)?.tags;
    if (tags) {
      for (const f of this.feelings(p.id)) {
        const boost = this.feelingDefs.get(f.id)?.boost;
        if (!boost) continue;
        for (const t of tags) if (boost[t] !== void 0) out.push([f.label, boost[t]]);
      }
    }
    if (a?.against) {
      const cfg = this.c;
      for (const v of a.against) {
        const held = p.def.values?.[v] ?? 0;
        if (held > 0) out.push([`against ${v}`, clamp(1 - held * cfg.againstPull, cfg.againstFloor, 1)]);
      }
    }
    return out;
  }
  started(p, d) {
    if (d.kind !== "act") return;
    const a = this.w.actions.get(d.action);
    if (!a?.against) return;
    let s = 0;
    for (const v of a.against) s += p.def.values?.[v] ?? 0;
    if (s > 0) {
      this.addStress(p.id, s * this.c.againstStress);
      if (this.feelingDefs.has("conscience")) this.applyFeel(p.id, "conscience", a.id);
    }
  }
  ended(p, d, frac, interrupted) {
    if (d.kind !== "act") return;
    const a = this.w.actions.get(d.action);
    if (a?.feels && !interrupted) for (const f of a.feels) this.applyFeel(p.id, f, a.id);
    if (d.layer === "break" && frac > this.c.breakDone) {
      const def = [...this.breakDefs.values()].find((b) => b.do === d.action);
      this.applyFeel(p.id, def?.after ?? "catharsis", "a break");
      const [, l] = this.stressParts(p.id);
      this.st.st[p.id] = [0, round(l * this.c.catharsisKeep, 5), this.w.s.now];
    }
  }
  did(actor, verb, data) {
    const target = data.for ?? data.to ?? data.target;
    const deed = this.w.deeds.get(verb);
    if (target && this.w.s.people[target]) {
      this.applyNote(target, actor, verb, data.what === void 0 ? void 0 : String(data.what));
      if (deed?.feeling) this.applyFeel(target, deed.feeling, `${actor} ${verb}`);
      if (deed?.memory) this.applyRemember(target, { k: verb, about: actor, imp: deed.memory, text: `${actor} ${verb}${data.what ? " " + data.what : ""}` });
    }
    const seen = Array.isArray(data.seenBy) ? data.seenBy : [];
    for (const wid of seen) {
      if (wid === target || !this.w.s.people[wid]) continue;
      this.applyNote(wid, actor, verb, data.what === void 0 ? void 0 : String(data.what));
      if (deed?.witnessFeeling) this.applyFeel(wid, deed.witnessFeeling, `saw ${actor} ${verb}`);
    }
  }
  met(a, b) {
    var _a, _b;
    for (const [x, y] of [[a, b], [b, a]]) {
      const files = (_a = this.st.files)[_b = x.id] || (_a[_b] = {});
      const f = files[y.id];
      if (f) {
        f.met++;
        f.last = this.w.s.now;
      }
    }
  }
  day() {
    const st = this.st, now2 = this.w.s.now, c = this.c;
    for (const id in st.f) {
      st.f[id] = st.f[id].filter((f) => f.until > now2);
      if (!st.f[id].length) delete st.f[id];
    }
    for (const id in st.b) {
      const map = st.b[id];
      const k = this.knob("forgetting", id);
      const sawBase = c.sawDecay ?? Math.sqrt(c.beliefDecay);
      const told = k === 1 ? c.beliefDecay : Math.pow(c.beliefDecay, k), saw = k === 1 ? sawBase : Math.pow(sawBase, k);
      for (const key2 in map) {
        map[key2].str = round(map[key2].str * (map[key2].src === "saw" ? saw : told), 4);
        if (map[key2].str < c.beliefFloor) delete map[key2];
      }
    }
    for (const id in st.m) {
      st.m[id] = st.m[id].filter((m) => m.core || this.strength(m, id) >= c.memoryFloor);
    }
  }
  removed(p) {
    const st = this.st;
    delete st.checked[p.id];
  }
};
function splitEq(a) {
  const i = a.indexOf("=");
  if (i < 0) return [a, void 0];
  const raw = a.slice(i + 1);
  const v = raw === "true" ? true : raw === "false" ? false : raw !== "" && !isNaN(Number(raw)) ? Number(raw) : raw;
  return [a.slice(0, i), v];
}

// tyrell/src/modules/fellowship.ts
var DEFAULT_FELLOWSHIP = {
  meetGain: 0.03,
  compatSpread: 0.6,
  decay: 4e-3,
  sentiments: 4,
  imitation: 0.03,
  forget: 14,
  forgetBelow: 0.05,
  friendship: 1,
  romance: 1,
  fading: 1,
  friendAt: 0.5,
  foeAt: -0.4,
  likeAbove: 0.2,
  compatValues: 0.3,
  meetMin: -0.05,
  meetMax: 0.08,
  meetCompat: 1,
  meetMood: 1,
  attractAt: 0.3,
  attractGain: 0.5,
  imitateAt: 0.3,
  socialRegard: 0.8,
  socialCompat: 0.2,
  socialMin: 0.1,
  socialMax: 2,
  deedSentiment: 0.1,
  witnessRegard: 0.4,
  bands: [0.15, 0.4, 0.7],
  labels: [
    ["unknown", "suspect", "trouble", "menace"],
    ["familiar", "mixed", "rough edges", "feared"],
    ["liked", "complicated", "loved and feared", "dangerous hero"],
    ["beloved", "tolerated", "wild card", "legend"]
  ]
};
var key = (a, b) => a + ">" + b;
var Fellowship = class {
  constructor(cfg = {}) {
    this.name = "fellowship";
    this.knobs = { friendship: "person", romance: "person", fading: "person" };
    this.groups = /* @__PURE__ */ new Map();
    this.config = { ...DEFAULT_FELLOWSHIP, ...cfg };
  }
  init() {
    return { rel: {}, standing: {}, partners: {}, joined: {} };
  }
  get st() {
    return this.w.s.mod.fellowship;
  }
  /** The config in force: as declared, under any world.tune. */
  get c() {
    return this.w.tuned(this.name, this.config);
  }
  /** A headline knob for someone: the world's, times their own. */
  knob(name, p) {
    return this.c[name] * this.w.own(p, this.name, name);
  }
  attach(w) {
    this.w = w;
    const L = w.lang;
    const other = (c, a) => a && a !== "target" ? a : c.target ?? null;
    L.term("regard", (c, a) => {
      const o = other(c, a);
      return c.person && o ? this.regard(c.person.id, o) : 0;
    });
    L.term("attraction", (c, a) => {
      const o = other(c, a);
      return c.person && o ? this.attraction(c.person.id, o) : 0;
    });
    L.term("compat", (c, a) => {
      const o = other(c, a);
      return c.person && o ? this.compat(c.person.id, o) : 0;
    });
    L.term("friend", (c, a) => {
      const o = other(c, a);
      return !!(c.person && o && this.regard(c.person.id, o) >= this.c.friendAt);
    });
    L.term("foe", (c, a) => {
      const o = other(c, a);
      return !!(c.person && o && this.regard(c.person.id, o) <= this.c.foeAt);
    });
    L.term("member", (c, a) => c.person ? this.groupsOf(c.person.id).includes(a) : false);
    L.term("partner", (c, a) => c.person ? a ? this.partner(c.person.id) === a : this.partner(c.person.id) ?? null : null);
    L.term("fame", (c, a) => {
      const [g, s] = a.split(".");
      return this.standing(g, s || c.person?.id || "player").fame;
    });
    L.term("infamy", (c, a) => {
      const [g, s] = a.split(".");
      return this.standing(g, s || c.person?.id || "player").infamy;
    });
    L.effect("regard", (c, a, op, v) => {
      const o = other(c, a);
      if (!c.person || !o) return;
      const cur = this.record(c.person.id, o);
      cur.r = round(clamp(op === "=" ? Number(v) : cur.r + (op === "-=" ? -1 : 1) * Number(v), -1, 1), 4);
    });
    L.effect("fame", (c, a, op, v) => {
      const [g, s] = a.split(".");
      this.applyStanding(g, s || c.person?.id || "player", (op === "-=" ? -1 : 1) * Number(v), 0);
    });
    L.effect("infamy", (c, a, op, v) => {
      const [g, s] = a.split(".");
      this.applyStanding(g, s || c.person?.id || "player", 0, (op === "-=" ? -1 : 1) * Number(v));
    });
    w.defineInput("regard", (a, b, by, why) => this.applyRegard(a, b, by, why ?? void 0));
    w.defineInput("attraction", (a, b, by) => this.applyAttraction(a, b, by));
    w.defineInput("sentiment", (a, b, label, by, minutes) => this.applySentiment(a, b, label, by, minutes ?? void 0));
    w.defineInput("standing", (g, subject, fame, infamy) => this.applyStanding(g, subject, fame, infamy));
    w.defineInput("join", (g, id, on) => this.applyJoin(g, id, on));
    w.defineInput("partners", (a, b) => this.applyPartners(a, b));
  }
  // -------------------------------------------------------------------------
  // Groups
  // -------------------------------------------------------------------------
  group(def) {
    this.groups.set(def.id, def);
    return this;
  }
  /** Everyone in a group. */
  members(g) {
    const out = new Set(this.groups.get(g)?.members || []);
    for (const id of this.st.joined[g] || []) out.add(id);
    for (const p of Object.values(this.w.s.people)) if (p.status !== "gone" && p.def.groups?.includes(g)) out.add(p.id);
    return [...out];
  }
  /** The groups a person belongs to. */
  groupsOf(id) {
    const p = this.w.s.people[id];
    const out = new Set(p?.def.groups || []);
    for (const g of this.groups.values()) if (g.members?.includes(id)) out.add(g.id);
    for (const g in this.st.joined) if (this.st.joined[g].includes(id)) out.add(g);
    return [...out];
  }
  /** The household a person belongs to, if any. */
  household(id) {
    return this.groupsOf(id).find((g) => this.groups.get(g)?.kind === "household");
  }
  join(g, id, on = true) {
    this.w.input("join", [g, id, on]);
  }
  applyJoin(g, id, on) {
    var _a;
    const list = (_a = this.st.joined)[g] || (_a[g] = []);
    if (on && !list.includes(id)) list.push(id);
    if (!on) this.st.joined[g] = list.filter((x) => x !== id);
  }
  // -------------------------------------------------------------------------
  // Relationships
  // -------------------------------------------------------------------------
  /** The relationship record a -> b, or undefined if there's none (a copy: change it through the inputs). */
  rel(a, b) {
    const r = this.st.rel[key(a, b)];
    return r ? { ...r, s: r.s.map((s) => ({ ...s })) } : void 0;
  }
  /** The relationship record a -> b, made if missing (inside the simulation). */
  record(a, b) {
    const k = key(a, b);
    let r = this.st.rel[k];
    if (!r) r = this.st.rel[k] = { r: 0, a: 0, s: [], met: 0, last: this.w.s.now };
    return r;
  }
  /** Has a met b (is there a record)? */
  knows(a, b) {
    return !!this.st.rel[key(a, b)];
  }
  /** a's regard for b, -1..1, sentiments included. */
  regard(a, b) {
    const r = this.st.rel[key(a, b)];
    if (!r) return 0;
    const now2 = this.w.s.now;
    let v = r.r;
    for (const s of r.s) if (s.until === void 0 || s.until > now2) v += s.by;
    return round(clamp(v, -1, 1), 4);
  }
  attraction(a, b) {
    return this.st.rel[key(a, b)]?.a ?? 0;
  }
  /** Changes a's attraction to b (from the game: recorded). */
  attract(a, b, by) {
    this.w.input("attraction", [a, b, by]);
  }
  applyAttraction(a, b, by) {
    const r = this.record(a, b);
    r.a = round(clamp(r.a + by, -1, 1), 4);
  }
  /** Hidden compatibility of a pair, -1..1 (the same both ways). */
  compat(a, b) {
    const [x, y] = a < b ? [a, b] : [b, a];
    const cfg = this.c;
    let c = (hash01(this.w.s.seed, "compat", x, y) * 2 - 1) * cfg.compatSpread;
    const va = this.w.s.people[a]?.def.values, vb = this.w.s.people[b]?.def.values;
    if (va && vb) {
      let shared = 0, n = 0;
      for (const k in va) if (vb[k] !== void 0) {
        shared += 1 - Math.abs(va[k] - vb[k]) * 2;
        n++;
      }
      if (n) c += shared / n * cfg.compatValues;
    }
    return round(clamp(c, -1, 1), 4);
  }
  /** Everyone a person has a relationship with, best regard first. */
  relations(a) {
    const out = [];
    const pre = a + ">";
    for (const k in this.st.rel) if (k.startsWith(pre)) {
      const b = k.slice(pre.length);
      out.push({ id: b, regard: this.regard(a, b), attraction: this.st.rel[k].a, met: this.st.rel[k].met });
    }
    return out.sort((x, y) => y.regard - x.regard || (x.id < y.id ? -1 : 1));
  }
  /** The people a person likes most. */
  friends(a, n = 3) {
    const above = this.c.likeAbove;
    return this.relations(a).filter((r) => r.regard > above).slice(0, n).map((r) => r.id);
  }
  /** Changes a's regard for b (from the game: recorded). */
  adjust(a, b, by, why) {
    this.w.input("regard", [a, b, by, why ?? null]);
  }
  applyRegard(a, b, by, why) {
    const r = this.record(a, b);
    r.r = round(clamp(r.r + by, -1, 1), 4);
    if (why) this.w.log("regard", a, { target: b, by, why });
  }
  /** Adds a sentiment a holds about b (replaces the weakest past the limit). */
  sentiment(a, b, label, by, minutes) {
    this.w.input("sentiment", [a, b, label, by, minutes ?? null]);
  }
  applySentiment(a, b, label, by, minutes) {
    const r = this.record(a, b);
    const now2 = this.w.s.now;
    r.s = r.s.filter((s2) => (s2.until === void 0 || s2.until > now2) && s2.label !== label);
    const s = { label, by: round(by, 4) };
    if (minutes !== void 0) s.until = now2 + minutes;
    r.s.push(s);
    const most = this.c.sentiments;
    if (r.s.length > most) {
      r.s.sort((x, y) => Math.abs(y.by) - Math.abs(x.by));
      r.s.length = most;
    }
    this.w.log("sentiment", a, { target: b, label, by });
  }
  sentiments(a, b) {
    const now2 = this.w.s.now;
    return (this.st.rel[key(a, b)]?.s || []).filter((s) => s.until === void 0 || s.until > now2);
  }
  partner(a) {
    return this.st.partners[a];
  }
  /** Makes two people partners (or, with null, ends a's partnership). */
  setPartner(a, b) {
    this.w.input("partners", [a, b]);
  }
  applyPartners(a, b) {
    const old = this.st.partners[a];
    if (old) delete this.st.partners[old];
    delete this.st.partners[a];
    if (b) {
      const prev = this.st.partners[b];
      if (prev) delete this.st.partners[prev];
      this.st.partners[a] = b;
      this.st.partners[b] = a;
    }
  }
  // -------------------------------------------------------------------------
  // Standing
  // -------------------------------------------------------------------------
  /** A subject's standing with a group: fame and infamy (0..1 each) and a label. */
  standing(g, subject) {
    const [fame, infamy] = this.st.standing[g]?.[subject] || [0, 0];
    const c = this.c, [b1, b2, b3] = c.bands;
    const band = (x) => x < b1 ? 0 : x < b2 ? 1 : x < b3 ? 2 : 3;
    return { fame, infamy, label: c.labels[band(fame)][band(infamy)] };
  }
  /** Changes standing (from the game: recorded). */
  changeStanding(g, subject, fame, infamy) {
    this.w.input("standing", [g, subject, fame, infamy]);
  }
  applyStanding(g, subject, fame, infamy) {
    var _a;
    const map = (_a = this.st.standing)[g] || (_a[g] = {});
    const [f0, i0] = map[subject] || [0, 0];
    map[subject] = [round(clamp(f0 + fame), 4), round(clamp(i0 + infamy), 4)];
  }
  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------
  met(a, b, _place, minutes) {
    const rv = this.w.reverie;
    const c = this.c, core = this.w.cfg;
    for (const [x, y] of [[a, b], [b, a]]) {
      const r = this.record(x.id, y.id);
      const mood = rv ? rv.mood(x.id) - 0.5 : 0;
      const gain = c.meetGain * (minutes / 30) * (1 + this.compat(x.id, y.id) * c.meetCompat + mood * c.meetMood);
      r.r = round(clamp(r.r + clamp(gain, c.meetMin, c.meetMax) * this.knob("friendship", x), -1, 1), 4);
      if (this.compat(x.id, y.id) > c.attractAt && this.partner(x.id) === void 0) r.a = round(clamp(r.a + gain * c.attractGain * this.knob("romance", x), -1, 1), 4);
      r.met++;
      r.last = this.w.s.now;
      if (y.doing && y.doing.kind === "act" && this.regard(x.id, y.id) > c.imitateAt) {
        const h = x.habits[y.doing.action] || [1, 1];
        x.habits[y.doing.action] = [round(clamp(h[0] + c.imitation, core.habitMin, core.habitMax), 5), h[1]];
      }
    }
    this.w.log("met", a.id, { target: b.id, minutes: Math.round(minutes) });
  }
  consider(p, c) {
    if (!c.target) return;
    const a = this.w.actions.get(c.id);
    if (!a?.tags?.includes("social")) return;
    const cfg = this.c;
    return [["regard", round(clamp(1 + this.regard(p.id, c.target) * cfg.socialRegard + this.compat(p.id, c.target) * cfg.socialCompat, cfg.socialMin, cfg.socialMax), 4)]];
  }
  did(actor, verb, data) {
    const deed = this.w.deeds.get(verb);
    if (!deed) return;
    const target = data.for ?? data.to ?? data.target;
    if (target) {
      if (deed.regard) this.applyRegard(target, actor, deed.regard);
      if (deed.sentiment) this.applySentiment(target, actor, deed.sentiment, deed.regard ?? this.c.deedSentiment);
      if (deed.fame || deed.infamy) for (const g of this.groupsOf(target)) this.applyStanding(g, actor, deed.fame ?? 0, deed.infamy ?? 0);
    }
    const seen = Array.isArray(data.seenBy) ? data.seenBy : [];
    for (const wid of seen) if (wid !== target && deed.regard) this.applyRegard(wid, actor, deed.regard * this.c.witnessRegard);
  }
  day() {
    const c = this.c, now2 = this.w.s.now, below = c.forgetBelow;
    for (const k in this.st.rel) {
      const r = this.st.rel[k];
      const f = this.knob("fading", this.w.s.people[k.slice(0, k.indexOf(">"))]);
      const d = c.decay * f, gone = c.forget / f * DAY;
      if (Math.abs(r.r) <= d) r.r = 0;
      else r.r = round(r.r - Math.sign(r.r) * d, 4);
      r.s = r.s.filter((s) => s.until === void 0 || s.until > now2);
      if (gone > 0 && now2 - r.last > gone && Math.abs(r.r) < below && Math.abs(r.a) < below && !r.s.length) delete this.st.rel[k];
    }
  }
  removed(p) {
    const partner = this.st.partners[p.id];
    if (partner) {
      delete this.st.partners[partner];
      delete this.st.partners[p.id];
    }
  }
};

// tyrell/src/modules/wormtongue.ts
var DEFAULT_WORMTONGUE = {
  reportChance: 0.6,
  reportDelay: [10, 90],
  recognizeStranger: 0.5,
  gossipChance: 0.45,
  maxHops: 3,
  heatDecay: 0.85,
  lieChance: 0.5,
  gossip: 1,
  reporting: 1,
  heat: 1,
  cooling: 1,
  lies: 1,
  heatPerSeverity: 10,
  heatFloor: 0.05,
  sawStrength: 0.3,
  crimeMemory: 4,
  severityMemory: 6,
  plainMemory: 3,
  fearWeight: 0.3,
  loyalty: 0.8,
  crimeSeen: 0.8,
  infamyAuthority: 0.2,
  infamyGroups: 0.1,
  toldAuthority: 0.8,
  bribeGreed: 0.6,
  bribeFull: 100,
  bribeMoney: 0.5,
  bribeHonesty: 0.4,
  bribeBase: 0.1,
  scareFear: 0.8,
  scareHonesty: 0.2,
  scareBase: 0.1,
  scareRegard: -0.3,
  secretSpite: -0.3,
  juicyCrime: 3,
  juicyDeed: 1.5,
  gossipRecency: 0.99,
  liarBelow: 0.3,
  lieSpite: -0.3,
  scapegoat: -0.2,
  trustBase: 0.6,
  trustRegard: 0.4,
  trustMin: 0.2,
  trustMax: 1,
  trustAlone: 0.7,
  toldKeep: 0.9,
  exposedAt: 4
};
var Wormtongue = class {
  constructor(cfg = {}) {
    this.name = "wormtongue";
    this.knobs = { gossip: "person", reporting: "person", heat: "person", cooling: "person", lies: "person" };
    this.crimes = /* @__PURE__ */ new Map();
    this.config = { ...DEFAULT_WORMTONGUE, ...cfg };
  }
  init() {
    return { heat: {}, reports: [], secrets: {}, favors: {} };
  }
  get st() {
    return this.w.s.mod.wormtongue;
  }
  /** The config in force: as declared, under any world.tune. */
  get c() {
    return this.w.tuned(this.name, this.config);
  }
  /** A headline knob for someone (a person's id, or anyone else: the player): the world's, times their own. */
  knob(name, id) {
    return this.c[name] * this.w.own(this.w.s.people[id], this.name, name);
  }
  attach(w) {
    this.w = w;
    w.lang.term("heat", (c, a) => this.heat(a || c.person?.id || "player"));
    w.lang.term("owes", (c, a) => c.person ? this.owes(c.person.id, a || c.target || "") : 0);
    w.lang.term("owed", (c, a) => c.person ? this.owes(a || c.target || "", c.person.id) : 0);
    w.lang.term("saw", (c, a) => {
      if (!c.person || !w.reverie) return false;
      const [actor, kind] = a.split(".");
      return w.reverie.belief(c.person.id, `did:${actor}:${kind}`) !== void 0;
    });
    w.defineInput("silence", (witness, actor, how, amount) => this.applySilence(witness, actor, how, amount));
    w.defineInput("secret", (id, s) => {
      this.st.secrets[id] = { ...s, knownBy: [...s.knownBy] };
      for (const k of s.knownBy) w.reverie?.applyBelieve(k, s.key, s.value, "knew");
    });
    w.defineInput("owe", (debtor, creditor, n) => this.applyOwe(debtor, creditor, n));
    w.defineInput("heat", (actor, by) => {
      this.st.heat[actor] = round(Math.max(0, (this.st.heat[actor] || 0) + by), 4);
    });
  }
  crime(def) {
    this.crimes.set(def.kind, def);
    return this;
  }
  // -------------------------------------------------------------------------
  // Heat and reports
  // -------------------------------------------------------------------------
  /** Heat on someone: the weight of reports against them, fading by day. */
  heat(actor) {
    return round(this.st.heat[actor] || 0, 3);
  }
  /** Changes heat directly (from the game: recorded). */
  addHeat(actor, by) {
    this.w.input("heat", [actor, by]);
  }
  /** Recent reports, newest last. */
  reports(actor) {
    return this.st.reports.filter((r) => !actor || r.actor === actor);
  }
  /** Everyone who believes they saw the actor do something criminal and hasn't been silenced. */
  witnesses(actor, kind) {
    const rv = this.w.reverie;
    if (!rv) return [];
    const out = [];
    for (const p of Object.values(this.w.s.people)) {
      if (p.status !== "active") continue;
      for (const b of rv.beliefs(p.id)) {
        if (b.silenced || !b.key.startsWith(`did:${actor}:`)) continue;
        const k = b.key.split(":")[2];
        if (kind && k !== kind) continue;
        if (!this.crimes.has(k)) continue;
        out.push(p.id);
        break;
      }
    }
    return out;
  }
  // -------------------------------------------------------------------------
  // Witnessing
  // -------------------------------------------------------------------------
  sensed(stim) {
    const w = this.w, rv = w.reverie, c = this.c;
    const crime = this.crimes.get(stim.kind);
    const strength = clamp(stim.strength ?? 1);
    for (const wid of stim.seenBy || []) {
      const p = w.s.people[wid];
      if (!p || p.status !== "active" || wid === stim.actor) continue;
      const r = w.stream(p);
      const knows = !!w.fellowship?.knows(wid, stim.actor) || !!rv?.file(wid, stim.actor);
      const chance = strength * (1 - clamp(stim.disguise ?? 0)) * (knows ? 1 : c.recognizeStranger);
      const recognized = r.chance(chance);
      const actor = recognized ? stim.actor : "someone";
      const key2 = `did:${actor}:${stim.kind}`;
      rv?.applyBelieve(wid, key2, stim.what ?? true, "saw", null, Math.max(c.sawStrength, strength));
      rv?.applyRemember(wid, { k: "saw:" + stim.kind, about: recognized ? stim.actor : void 0, place: stim.place ?? void 0, imp: crime ? c.crimeMemory + crime.severity * c.severityMemory : c.plainMemory, text: `saw ${actor} ${stim.kind}${stim.what ? " " + stim.what : ""}` });
      if (crime && rv) rv.applyFeel(wid, crime.feeling ?? "witnessed", key2);
      w.log("witnessed", wid, { actor, kind: stim.kind, what: stim.what ?? null, recognized });
      w.emit("witnessed", { id: wid, actor, kind: stim.kind, recognized });
      if (crime && recognized) {
        const mid2 = w.cfg.traitDefault;
        const lawful = p.def.traits?.lawful ?? p.def.values?.law ?? mid2;
        const fear = p.def.traits?.courage !== void 0 ? 1 - p.def.traits.courage : 1 - mid2;
        const regard = w.fellowship ? w.fellowship.regard(wid, stim.actor) : 0;
        const pReport = clamp((crime.report ?? c.reportChance) * (0.5 + lawful) * (1 - fear * c.fearWeight) * (1 - Math.max(0, regard) * c.loyalty) * this.knob("reporting", wid));
        if (r.chance(pReport)) {
          const [a, b] = c.reportDelay;
          w.clock.schedule({ t: w.s.now + r.range(a, b), k: "module", ref: this.name, who: wid, data: { actor: stim.actor, kind: stim.kind, what: stim.what ?? null } });
        }
      }
    }
  }
  timer(item) {
    const w = this.w;
    const wid = item.who;
    const actor = String(item.data?.actor);
    const kind = String(item.data?.kind);
    const p = w.s.people[wid];
    if (!p || p.status !== "active") return;
    const b = w.reverie?.beliefRecord(wid, `did:${actor}:${kind}`);
    if (!b || b.silenced) return;
    this.report(wid, actor, kind, item.data?.what);
  }
  report(wid, actor, kind, what) {
    const w = this.w, c = this.c;
    const crime = this.crimes.get(kind);
    if (!crime) return;
    let to = crime.reportTo;
    if (!to && w.fellowship) {
      for (const g of w.fellowship.groups.values()) if (g.kind === "authority") {
        to = g.id;
        break;
      }
    }
    const rep = { t: w.s.now, witness: wid, actor, kind };
    if (what) rep.what = what;
    if (to) rep.to = to;
    this.st.reports.push(rep);
    if (this.st.reports.length > 200) this.st.reports.shift();
    this.st.heat[actor] = round((this.st.heat[actor] || 0) + (crime.heat ?? crime.severity * c.heatPerSeverity) * this.knob("heat", actor), 4);
    if (w.fellowship) {
      if (to) w.fellowship.applyStanding(to, actor, 0, crime.severity * c.infamyAuthority);
      for (const g of w.fellowship.groupsOf(wid)) w.fellowship.applyStanding(g, actor, 0, crime.severity * c.infamyGroups);
    }
    if (to && w.fellowship && w.reverie) for (const m of w.fellowship.members(to)) w.reverie.applyBelieve(m, `did:${actor}:${kind}`, what ?? true, "told", wid, c.toldAuthority, 1);
    w.log("report", wid, { actor, kind, to: to ?? null });
    w.emit("report", { ...rep, heat: this.heat(actor) });
  }
  /** Pays or scares a witness off. Returns nothing; check witnesses() or listen for 'silenced'. */
  silence(witness, actor, how, amount = 0) {
    this.w.input("silence", [witness, actor, how, amount]);
  }
  applySilence(witness, actor, how, amount) {
    const w = this.w;
    const p = w.s.people[witness];
    const rv = w.reverie;
    if (!p || !rv) return;
    const r = w.stream(p);
    const c = this.c;
    const mid2 = w.cfg.traitDefault;
    const greed = p.def.traits?.greed ?? mid2, courage = p.def.traits?.courage ?? mid2, honesty = p.def.traits?.honesty ?? mid2;
    const pAccept = how === "pay" ? clamp(greed * c.bribeGreed + Math.min(1, amount / c.bribeFull) * c.bribeMoney - honesty * c.bribeHonesty + c.bribeBase) : clamp((1 - courage) * c.scareFear - honesty * c.scareHonesty + c.scareBase);
    const ok = r.chance(pAccept);
    if (ok) {
      for (const b of rv.beliefs(witness)) if (b.key.startsWith(`did:${actor}:`)) rv.applySilence(witness, b.key);
    }
    if (how === "pay" && ok) p.vars.money = Number(p.vars.money ?? 0) + amount;
    if (how === "scare") {
      rv.applyFeel(witness, "scared", actor);
      w.fellowship?.applyRegard(witness, actor, c.scareRegard);
    }
    w.log("silenced", witness, { actor, how, ok });
    w.emit("silenced", { witness, actor, how, ok });
  }
  // -------------------------------------------------------------------------
  // Gossip
  // -------------------------------------------------------------------------
  met(a, b) {
    this.gossip(a, b);
    this.gossip(b, a);
  }
  /** a may tell b one thing worth telling. */
  gossip(a, b) {
    const w = this.w, rv = w.reverie;
    if (!rv) return;
    const c = this.c;
    const r = w.stream(a);
    const talkative = a.def.traits?.talkative ?? w.cfg.traitDefault;
    if (!r.chance(c.gossipChance * (0.5 + talkative) * this.knob("gossip", a.id))) return;
    const now2 = w.s.now;
    let best = null;
    for (const bl of rv.beliefs(a.id)) {
      if (bl.silenced || bl.hops >= c.maxHops) continue;
      if (bl.key.startsWith("@")) continue;
      const theirs = rv.belief(b.id, bl.key);
      if (theirs === bl.v) continue;
      const secret = this.secretFor(bl.key);
      if (secret && !(secret.about !== a.id && w.fellowship && w.fellowship.regard(a.id, secret.about) < c.secretSpite)) continue;
      const subject2 = subjectOf(bl.key);
      if (subject2 === b.id) continue;
      const juicy = bl.key.startsWith("did:") ? this.crimes.has(bl.key.split(":")[2]) ? c.juicyCrime : c.juicyDeed : 1;
      const recency = Math.pow(c.gossipRecency, (now2 - bl.t) / HOUR);
      const score = juicy * bl.str * recency;
      if (!best || score > best.score) best = { key: bl.key, v: bl.v, str: bl.str, hops: bl.hops, score };
    }
    if (!best) return;
    let key2 = best.key, lie = false;
    const v = best.v;
    const subject = subjectOf(key2);
    const honesty = a.def.traits?.honesty ?? w.cfg.traitDefault;
    if (subject && v !== false && v !== null && honesty < c.liarBelow && w.fellowship && w.fellowship.regard(a.id, subject) < c.lieSpite && r.chance(c.lieChance * this.knob("lies", a.id))) {
      const foes = w.fellowship.relations(a.id).filter((x) => x.regard < c.scapegoat && x.id !== subject && x.id !== b.id);
      if (foes.length) {
        key2 = key2.replace(`did:${subject}:`, `did:${foes[0].id}:`);
        lie = true;
      }
    }
    const trust = w.fellowship ? clamp(c.trustBase + w.fellowship.regard(b.id, a.id) * c.trustRegard, c.trustMin, c.trustMax) : c.trustAlone;
    rv.applyBelieve(b.id, key2, v, "told", a.id, best.str * trust * c.toldKeep, best.hops + 1);
    const sec = this.secretFor(key2);
    if (sec && !sec.knownBy.includes(b.id)) {
      sec.knownBy.push(b.id);
      if (sec.knownBy.length === c.exposedAt) {
        w.log("exposed", sec.about, { key: key2 });
        w.emit("exposed", { about: sec.about, key: key2 });
      }
    }
    w.log("told", a.id, { to: b.id, key: key2, v, ...lie ? { lie: true } : {} });
    w.emit("told", { from: a.id, to: b.id, key: key2, v, lie });
    if (key2.startsWith("did:") && v !== false && v !== null && w.fellowship) {
      const [, actor, kind] = key2.split(":");
      const crime = this.crimes.get(kind);
      if (crime && actor !== "someone") {
        const to = crime.reportTo;
        const authority = to ? [to] : [...w.fellowship.groups.values()].filter((g) => g.kind === "authority").map((g) => g.id);
        const what = typeof v === "string" ? v : typeof v === "number" ? String(v) : void 0;
        if (authority.some((g) => w.fellowship.groupsOf(b.id).includes(g))) this.report(a.id, actor, kind, what);
      }
    }
  }
  // -------------------------------------------------------------------------
  // Secrets and favors
  // -------------------------------------------------------------------------
  /** Declares a secret: a belief that only some people hold, which they pass on reluctantly. */
  secret(id, s) {
    this.w.input("secret", [id, s]);
  }
  secrets() {
    return this.st.secrets;
  }
  secretFor(key2) {
    for (const id in this.st.secrets) if (this.st.secrets[id].key === key2) return this.st.secrets[id];
    return void 0;
  }
  /** Records a favor: debtor now owes creditor (n can be negative to settle). */
  owe(debtor, creditor, n = 1) {
    this.w.input("owe", [debtor, creditor, n]);
  }
  applyOwe(debtor, creditor, n) {
    const k = debtor + ">" + creditor;
    const v = round((this.st.favors[k] || 0) + n, 4);
    if (v <= 0) delete this.st.favors[k];
    else this.st.favors[k] = v;
    this.w.log("owes", debtor, { target: creditor, n: v });
  }
  /** How much debtor owes creditor. */
  owes(debtor, creditor) {
    return this.st.favors[debtor + ">" + creditor] || 0;
  }
  // -------------------------------------------------------------------------
  // Crimes people commit
  // -------------------------------------------------------------------------
  started(p, d) {
    if (d.kind !== "act" || !d.place) return;
    const a = this.w.actions.get(d.action);
    if (!a?.crime) return;
    const seenBy = this.w.ring.present(this.w.ring.root(d.place)).filter((id) => id !== p.id);
    this.sensed({ kind: a.crime, actor: p.id, place: d.place, seenBy, strength: this.c.crimeSeen });
  }
  // -------------------------------------------------------------------------
  // Upkeep
  // -------------------------------------------------------------------------
  did(actor, verb, data) {
    const deed = this.w.deeds.get(verb);
    if (deed?.crime && Array.isArray(data.seenBy)) {
      this.sensed({ kind: deed.crime, actor, what: data.what === void 0 ? void 0 : String(data.what), place: data.place ?? null, seenBy: data.seenBy });
    }
  }
  day() {
    const c = this.c;
    for (const k in this.st.heat) {
      const f = this.knob("cooling", k);
      const v = round(this.st.heat[k] * (f === 1 ? c.heatDecay : Math.pow(c.heatDecay, f)), 4);
      if (v < c.heatFloor) delete this.st.heat[k];
      else this.st.heat[k] = v;
    }
    const cutoff = this.w.s.now - 14 * DAY;
    this.st.reports = this.st.reports.filter((r) => r.t >= cutoff);
  }
};
function subjectOf(key2) {
  if (key2.startsWith("did:")) {
    const s = key2.split(":")[1];
    return s === "someone" ? null : s;
  }
  return null;
}

// tyrell/src/modules/cityspeak.ts
var DEFAULT_CITYSPEAK = { chatter: 1, barkGap: 2.2, barkLength: 3, barkCooldown: 60, practiceBoost: 1.5, socialDone: 0.5, roomEmpty: 0.5 };
var lineKey = (l, i) => l.key !== void 0 && l.key !== "" ? l.key : String(i);
var Cityspeak = class {
  constructor(cfg = {}) {
    this.name = "cityspeak";
    this.knobs = { chatter: "person" };
    this.lines = [];
    this.practices = /* @__PURE__ */ new Map();
    this.acts = /* @__PURE__ */ new Map();
    /** Bark cooldowns are kept outside the state: barks only happen near the player, so they mustn't change the world. */
    this.barkSaid = /* @__PURE__ */ new Map();
    this.config = { ...DEFAULT_CITYSPEAK, ...cfg };
  }
  /** Seconds between lines in a bark exchange (config.barkGap: setting it here sets the config). */
  get barkGap() {
    return this.w ? this.c.barkGap : this.config.barkGap;
  }
  set barkGap(v) {
    this.config.barkGap = v;
  }
  /** Most lines in one exchange (config.barkLength: setting it here sets the config). */
  get barkLength() {
    return this.w ? this.c.barkLength : this.config.barkLength;
  }
  set barkLength(v) {
    this.config.barkLength = v;
  }
  init() {
    return { said: {}, acts: [] };
  }
  get st() {
    return this.w.s.mod.cityspeak;
  }
  /** The config in force: as declared, under any world.tune. */
  get c() {
    return this.w.tuned(this.name, this.config);
  }
  /** How chatty two people are together: the world's chatter, times each one's own. */
  chatter(a, b) {
    const w = this.w;
    return this.c.chatter * w.own(w.s.people[a], this.name, "chatter") * w.own(w.s.people[b], this.name, "chatter");
  }
  attach(w) {
    this.w = w;
    w.lang.term("room", (c) => c.person?.place ? this.room(c.person.place) : 0.5);
    w.lang.term("said", (c, a) => c.person ? this.hasSaid(c.person.id, a) : false);
    w.lang.term("practice", (c, a) => c.person?.place ? this.activeAt(c.person.place).some((p) => p.id === a) : false);
    w.lang.term("role", (c, a) => c.person ? this.roleOf(c.person, a) : false);
    w.defineInput("say", (who, opts) => this.applySay(who, opts));
    w.defineInput("social", (act, from, to) => this.applyResolve(act, from, to));
  }
  // -------------------------------------------------------------------------
  // Declaring
  // -------------------------------------------------------------------------
  line(def) {
    this.lines.push(def);
    return this;
  }
  addLines(defs) {
    for (const d of defs) this.lines.push(d);
    return this;
  }
  practice(def) {
    this.practices.set(def.id, def);
    return this;
  }
  act(def) {
    this.acts.set(def.id, def);
    return this;
  }
  // -------------------------------------------------------------------------
  // Lines
  // -------------------------------------------------------------------------
  /** When someone last said a line (undefined if never). */
  lastSaid(who, l, i) {
    return this.st.said[who]?.[lineKey(l, i)] ?? this.st.byIndex?.[who]?.[String(i)];
  }
  /** Has someone said a line with this key (or, as before 1.1, at this index)? */
  hasSaid(who, key2) {
    if (this.st.said[who]?.[key2] !== void 0) return true;
    return this.lines.some((l, i) => (lineKey(l, i) === key2 || String(i) === key2) && this.lastSaid(who, l, i) !== void 0);
  }
  /**
   * What a person would say now, without saying it (nothing changes). The
   * most specific matching line wins; ties go by weight. Options: `to` (the
   * listener), `topic`; `exact` leaves out lines without a topic; `avoid`
   * passes over lines by key (said lately) unless every line at the most
   * specific level is avoided, when the most specific fresh line at any
   * level wins, and only then a repeat; `salt` varies the draw among equals
   * (Voice passes the talk's counter).
   */
  choose(who, opts = {}) {
    return this.pick(who, opts)?.said ?? null;
  }
  /** The line choose() would pick, with its index. Looking only: chance: conditions peek. */
  pick(who, opts) {
    return this.w.peek(() => this.pickNow(who, opts));
  }
  pickNow(who, opts) {
    const w = this.w;
    const p = w.s.people[who];
    if (!p) return null;
    const ctx = w.ctx(p, { target: opts.to ?? null, topic: opts.topic, place: p.place });
    const now2 = w.s.now;
    let best = [];
    let bestSpec = -1;
    const all = opts.avoid ? [] : null;
    this.lines.forEach((l, i) => {
      if (opts.topic !== void 0 && l.topic !== void 0 && l.topic !== opts.topic) return;
      if (opts.topic === void 0 && l.topic !== void 0) return;
      if (opts.exact && l.topic === void 0) return;
      if (opts.skip?.(l, i)) return;
      let spec = (l.topic !== void 0 ? 1 : 0) + (l.pri ?? 0);
      if (l.who !== void 0) {
        if (typeof l.who === "string") {
          if (!this.whoMatches(p, l.who)) return;
          spec += 2;
        } else {
          if (!w.lang.all(l.who, ctx)) return;
          spec += l.who.length;
        }
      }
      if (l.when) {
        if (!w.lang.all(l.when, ctx)) return;
        spec += l.when.length;
      }
      if (l.to) {
        if (!opts.to) return;
        const t = w.s.people[opts.to];
        const tctx = t ? { ...ctx } : ctx;
        if (!w.lang.all(l.to, tctx)) return;
        spec += l.to.length;
      }
      const last = this.lastSaid(who, l, i);
      if (l.once && last !== void 0) return;
      if (l.cooldown && last !== void 0 && now2 - last < l.cooldown) return;
      if (all) all.push({ l, i, spec });
      if (spec > bestSpec) {
        bestSpec = spec;
        best = [{ l, i }];
      } else if (spec === bestSpec) best.push({ l, i });
    });
    if (!best.length) return null;
    if (all && opts.avoid) {
      const avoid = opts.avoid;
      const levels = [...new Set(all.map((x) => x.spec))].sort((a, b) => b - a);
      for (const lv of levels) {
        const fresh = all.filter((x) => x.spec === lv && !avoid(lineKey(x.l, x.i)));
        if (fresh.length) {
          best = fresh.map(({ l, i }) => ({ l, i }));
          break;
        }
      }
    }
    const r = w.worldStreamPeek(who, "line", now2, ...opts.salt || []);
    const pick = r.weighted(best, (x) => x.l.weight ?? 1) || best[0];
    const out = { who, key: pick.l.key };
    if (pick.l.text !== void 0) out.text = Array.isArray(pick.l.text) ? r.pick(pick.l.text) : pick.l.text;
    if (opts.to) out.to = opts.to;
    if (opts.topic) out.topic = opts.topic;
    if (pick.l.reply) out.reply = pick.l.reply;
    return { said: out, i: pick.i };
  }
  /** Says something on purpose (the game asks): chosen, remembered, its effects applied. */
  say(who, opts = {}) {
    return this.w.input("say", [who, opts]);
  }
  applySay(who, opts) {
    var _a;
    const picked = this.pick(who, opts);
    if (!picked) return null;
    const { said, i } = picked;
    const l = this.lines[i];
    ((_a = this.st.said)[who] || (_a[who] = {}))[lineKey(l, i)] = this.w.s.now;
    if (this.st.byIndex?.[who]) delete this.st.byIndex[who][String(i)];
    const p = this.w.s.people[who];
    if (l.then && p) this.w.lang.applyAll(l.then, this.w.ctx(p, { target: opts.to ?? null, topic: opts.topic }));
    this.w.log("said", who, { key: said.key, ...opts.to ? { to: opts.to } : {} });
    this.w.emit("say", said);
    return said;
  }
  /** The answer someone gives to a line. */
  answer(to, by) {
    return this.reply(to, by)?.said ?? null;
  }
  reply(to, by) {
    if (!to.reply) return null;
    if (to.reply.startsWith("topic:")) return this.pick(by, { to: to.who, topic: to.reply.slice(6) });
    const i = this.lines.findIndex((l2) => l2.key === to.reply);
    if (i < 0) return null;
    const l = this.lines[i];
    const out = { who: by, key: l.key, to: to.who };
    if (l.text !== void 0) out.text = Array.isArray(l.text) ? l.text[0] : l.text;
    return { said: out, i };
  }
  whoMatches(p, who) {
    if (who === p.id) return true;
    if (who.startsWith("tag:")) return !!p.def.tags?.includes(who.slice(4));
    if (who.startsWith("job:")) return p.def.job?.id === who.slice(4);
    if (who.startsWith("group:")) return !!p.def.groups?.includes(who.slice(6));
    return false;
  }
  /**
   * A short exchange between two people near the player: lines that don't
   * change the world (barks). Returns the lines with a delay for each.
   */
  converse(a, b, topic = "chat") {
    const out = [];
    const now2 = this.w.s.now;
    const c = this.c;
    const k = this.chatter(a, b);
    if (!(k > 0)) return out;
    const most = k === 1 ? c.barkLength : Math.max(1, Math.round(c.barkLength * k));
    const skip = (who) => (l, i) => {
      const last = this.barkSaid.get(who + "|" + lineKey(l, i));
      return last !== void 0 && now2 - last < (l.cooldown ?? c.barkCooldown);
    };
    let speaker = a, listener = b;
    let line = this.pick(speaker, { to: listener, topic, skip: skip(speaker) });
    for (let n = 0; line && n < most; n++) {
      this.barkSaid.set(speaker + "|" + lineKey(this.lines[line.i], line.i), now2);
      out.push({ ...line.said, after: n * c.barkGap });
      const reply = this.reply(line.said, listener);
      [speaker, listener] = [listener, speaker];
      line = reply;
    }
    return out;
  }
  // -------------------------------------------------------------------------
  // Practices and the room
  // -------------------------------------------------------------------------
  /** Practices going on at a place now. */
  activeAt(place) {
    const w = this.w, h = hourOf(w.s.now);
    const out = [];
    for (const pr of this.practices.values()) {
      if (pr.hours && !inHours(h, pr.hours)) continue;
      const at = pr.at;
      const ok = at.startsWith("tag:") ? w.ring.hasTag(place, at.slice(4)) : w.ring.within(place, at);
      if (ok) out.push(pr);
    }
    return out;
  }
  /** Does a person fill a role at their place? */
  roleOf(p, role) {
    if (!p.place) return false;
    for (const pr of this.activeAt(p.place)) {
      const r = pr.roles[role];
      if (r && this.fills(p, r)) return true;
    }
    return false;
  }
  fills(p, r) {
    if (r.job && p.def.job?.id !== r.job) return false;
    if (r.who && !this.w.lang.all(r.who, this.w.ctx(p, { place: p.place }))) return false;
    return true;
  }
  /** The mood of the room: everyone at the place, plus the practices' tone. */
  room(place) {
    const w = this.w;
    const ids = w.ring.present(w.ring.root(place));
    let m = this.c.roomEmpty;
    if (ids.length && w.reverie) m = ids.reduce((acc, id) => acc + w.reverie.mood(id), 0) / ids.length;
    for (const pr of this.activeAt(place)) m += pr.tone ?? 0;
    return round(clamp(m), 4);
  }
  consider(p, c) {
    const place = c.place ?? p.place;
    if (!place) return;
    const out = [];
    for (const pr of this.activeAt(place)) {
      for (const role in pr.roles) {
        const r = pr.roles[role];
        if (!r.actions.includes(c.id) || !this.fills(p, r)) continue;
        out.push([`${pr.id}: ${role}`, pr.boost ?? this.c.practiceBoost]);
        break;
      }
    }
    return out;
  }
  // -------------------------------------------------------------------------
  // Social acts
  // -------------------------------------------------------------------------
  /** An action that says something on starting (its `says` topic) says it. */
  started(p, d) {
    if (d.kind !== "act") return;
    const topic = this.w.actions.get(d.action)?.says;
    if (topic) this.applySay(p.id, d.target ? { topic, to: d.target } : { topic });
  }
  ended(p, d, frac, interrupted) {
    if (d.kind !== "act" || interrupted || frac < this.c.socialDone || !d.target) return;
    const a = this.w.actions.get(d.action);
    if (!a?.social) return;
    this.applyResolve(a.social, p.id, d.target);
  }
  /** Resolves a social act now (from the game: recorded): does the target accept? Applies the outcome. */
  resolve(actId, from, to) {
    return this.w.input("social", [actId, from, to]) === true;
  }
  /** Resolves a social act inside the simulation. */
  applyResolve(actId, from, to) {
    const w = this.w;
    const def = this.acts.get(actId);
    const asker = w.s.people[from], target = w.s.people[to];
    if (!def || !asker || !target) return false;
    const tctx = w.ctx(target, { target: from });
    let score = 1;
    for (const k of def.accept || []) score *= w.mind.consider(k, tctx);
    if (def.acceptIf && !w.lang.all(def.acceptIf, tctx)) score = 0;
    const r = w.stream(target);
    const ok = def.threshold !== void 0 ? score >= def.threshold : r.chance(clamp(score));
    const actx = w.ctx(asker, { target: to });
    w.lang.applyAll(ok ? def.onAccept : def.onRefuse, actx);
    const rv = w.reverie;
    if (rv && def.feelings) {
      const f = ok ? def.feelings.accepted : def.feelings.refused;
      if (f) rv.applyFeel(from, f, to);
      if (def.feelings.target) rv.applyFeel(to, def.feelings.target, from);
    }
    if (def.regard && w.fellowship) w.fellowship.applyRegard(to, from, ok ? def.regard[0] : def.regard[1]);
    this.st.acts.push({ t: w.s.now, act: actId, from, to, ok });
    if (this.st.acts.length > 100) this.st.acts.shift();
    w.log("social", from, { act: actId, target: to, ok });
    w.emit("social", { act: actId, from, to, ok });
    return ok;
  }
  // -------------------------------------------------------------------------
  // Barks between people near the player
  // -------------------------------------------------------------------------
  met(a, b) {
    const w = this.w;
    if (w.replaying) return;
    if (!w.clock.embodied(a.id) && !w.clock.embodied(b.id)) return;
    const k = this.chatter(a.id, b.id);
    if (k < 1 && !(k > 0 && w.worldStreamPeek("bark", a.id, b.id, w.s.now).chance(k))) return;
    const lines = this.converse(a.id, b.id);
    if (lines.length) w.emit("bark", { a: a.id, b: b.id, lines });
  }
  // -------------------------------------------------------------------------
  // ink
  // -------------------------------------------------------------------------
  /**
   * Binds Tyrell to an ink story (inkjs): the story can call
   * tyrell_fact(key), tyrell_thinks(who, key), tyrell_regard(a, b),
   * tyrell_mood(who), tyrell_test(who, condition) and tyrell_did(actor, verb, target).
   */
  bindInk(story) {
    const w = this.w;
    story.BindExternalFunction("tyrell_fact", (k) => w.s.facts[k] ?? null, true);
    story.BindExternalFunction("tyrell_thinks", (who, k) => w.peek(() => w.reverie?.thinks(who, k) ?? w.s.facts[k] ?? null), true);
    story.BindExternalFunction("tyrell_regard", (a, b) => w.fellowship?.regard(a, b) ?? 0, true);
    story.BindExternalFunction("tyrell_mood", (who) => w.reverie?.mood(who) ?? 0.5, true);
    story.BindExternalFunction("tyrell_test", (who, cond) => {
      const p = w.s.people[who];
      return p ? w.peek(() => w.lang.test(cond, w.ctx(p))) : false;
    }, true);
    story.BindExternalFunction("tyrell_did", (actor, verb, target) => {
      w.did(actor, verb, target ? { for: target } : {});
      return true;
    }, false);
  }
};

// tyrell/src/modules/mentat.ts
var DEFAULT_MENTAT = {
  maxTries: 3,
  depth: 3,
  priceWeight: 1,
  persistence: 1,
  scruples: 1,
  giveUp: 120,
  setAside: 2,
  stale: 24 * 60,
  honestNever: 0.8,
  riskBase: 60,
  riskHonesty: 300,
  riskHeat: 20,
  valuesNever: 0.9,
  valuesCost: 200
};
var Mentat = class {
  constructor(cfg = {}) {
    this.name = "mentat";
    this.knobs = { persistence: "person", scruples: "person" };
    this.config = { ...DEFAULT_MENTAT, ...cfg };
  }
  /** The config in force: as declared, under any world.tune. */
  get c() {
    return this.w.tuned(this.name, this.config);
  }
  /** A headline knob for someone: the world's, times their own. */
  knob(name, p) {
    return this.c[name] * this.w.own(p, this.name, name);
  }
  attach(w) {
    this.w = w;
    w.lang.term("planning", (c, a) => c.person?.plan ? a ? c.person.plan.task === a : c.person.plan.task : a ? false : null);
  }
  // -------------------------------------------------------------------------
  // Plans
  // -------------------------------------------------------------------------
  /** Starts a task: picks a method and returns the first step to do. */
  begin(p, c) {
    const task = this.w.tasks.get(c.id);
    if (!task) return null;
    p.plan = { task: task.id, stack: [], failed: {}, tries: 0, started: this.w.s.now, rank: c.rank, layer: c.layer };
    if (!this.push(p, task.id)) {
      this.w.log("no-plan", p.id, { task: task.id });
      p.plan = null;
      return null;
    }
    this.w.log("planned", p.id, { task: task.id, method: this.methodName(task.id, p.plan.stack[0].method) });
    return this.next(p);
  }
  methodName(task, i) {
    const def = this.w.tasks.get(task);
    return def?.methods[i]?.name ?? (i >= 0 ? `way ${i + 1}` : "get");
  }
  /** Chooses a method for a task (the first not yet failed whose conditions hold) and pushes it. */
  push(p, taskId) {
    const plan = p.plan;
    const def = this.w.tasks.get(taskId);
    if (!def) return false;
    const failed = plan.failed[taskId] || [];
    const ctx = this.w.ctx(p, { action: taskId });
    for (let i = 0; i < def.methods.length; i++) {
      if (failed.includes(i)) continue;
      const m = def.methods[i];
      if (!this.w.lang.all(m.if, ctx)) continue;
      plan.stack.push({ task: taskId, method: i, steps: m.do.slice(), i: 0 });
      return true;
    }
    return false;
  }
  /** The next step of the plan as an option to start, or null when it's over. */
  next(p) {
    const w = this.w;
    for (let guard = 0; guard < 64; guard++) {
      const plan = p.plan;
      if (!plan) return null;
      const frame = plan.stack[plan.stack.length - 1];
      if (!frame) return this.complete(p);
      if (frame.i >= frame.steps.length) {
        plan.stack.pop();
        continue;
      }
      const step = frame.steps[frame.i++];
      if (typeof step === "string") {
        if (step.startsWith("go:")) {
          const dest = this.destination(p, step.slice(3));
          if (!dest) return this.fail(p, `can't get to ${step.slice(3)}`);
          return this.cand(p, "@go:" + dest, dest);
        }
        if (step.startsWith("wait:")) return this.cand(p, "@wait:" + step.slice(5), p.place);
        if (step.startsWith("get:")) {
          const item = step.slice(4);
          if (w.have(p, item) > 0) continue;
          const route = this.route(p, item, this.c.depth, /* @__PURE__ */ new Set());
          if (!route) return this.fail(p, `no way to get ${item}`);
          plan.stack.push({ task: "get:" + item, method: -1, steps: route.steps, i: 0 });
          w.log("route", p.id, { item, steps: route.steps.map((s) => typeof s === "string" ? s : s.action), cost: round(route.cost, 1) });
          continue;
        }
        if (w.tasks.has(step)) {
          if (!this.push(p, step)) return this.fail(p, `no way to ${step}`);
          continue;
        }
        if (w.actions.has(step)) {
          const c2 = this.actionStep(p, { action: step });
          if (!c2) return this.fail(p, `can't ${step} now`);
          return c2;
        }
        return this.fail(p, `unknown step ${step}`);
      }
      const c = this.actionStep(p, step);
      if (!c) return this.fail(p, `can't ${step.action} now`);
      if (step.minutes !== void 0) c.minutes = step.minutes;
      return c;
    }
    return this.fail(p, "the plan went round in circles");
  }
  cand(p, id, place) {
    const plan = p.plan;
    return { id, kind: "action", place, rank: plan.rank, layer: "plan", weight: 1, parts: [["plan", 1]] };
  }
  /** Where a go: step walks to: the nearest declared place its spec names that they can get to. */
  destination(p, spec) {
    const w = this.w;
    for (const id of w.ring.resolve(spec, p)) if (w.ring.get(id) && isFinite(w.ring.travel(p.place, id, p))) return id;
    return null;
  }
  /** An action step: the nearest place where it can be done now. */
  actionStep(p, step) {
    const w = this.w;
    const a = w.actions.get(step.action);
    if (!a) return null;
    const plan = p.plan;
    const places = w.ring.resolve(step.at !== void 0 ? step.at : a.at ?? null, p, step.target);
    for (const place of places.length ? places : [null]) {
      const c = { id: a.id, kind: "action", place, target: step.target, rank: plan.rank, layer: "plan", weight: 1, parts: [["plan", 1]] };
      const why = w.mind.blockedReason(p, c);
      if (!why) return c;
      if (place && /is closed then$/.test(why) && w.reverie?.belief(p.id, "open:" + place) === true) return c;
    }
    return null;
  }
  complete(p) {
    const plan = p.plan;
    this.w.log("done-plan", p.id, { task: plan.task, minutes: Math.round(this.w.s.now - plan.started) });
    this.w.emit("planned", { id: p.id, task: plan.task, ok: true });
    if (p.directive && p.directive.do === plan.task) p.directive.done = true;
    const def = this.w.tasks.get(plan.task);
    if (def?.cooldown) p.cool[plan.task] = this.w.s.now + def.cooldown;
    p.plan = null;
    return null;
  }
  /** The step went fine: the next one. */
  stepDone(p, ok) {
    if (!p.plan) return null;
    if (!ok) return this.stepFailed(p, "step failed");
    return this.next(p);
  }
  /** The step failed: the method is marked failed and the task replanned. */
  stepFailed(p, why) {
    var _a, _b;
    const w = this.w;
    const plan = p.plan;
    if (!plan) return null;
    const closed = /^(.*) is closed then$/.exec(why);
    if (closed && w.reverie) w.reverie.applyBelieve(p.id, "open:" + closed[1], false, "saw");
    plan.tries++;
    if (plan.tries > this.c.maxTries * this.knob("persistence", p)) return this.giveUp(p, why);
    while (plan.stack.length) {
      const frame = plan.stack.pop();
      if (frame.method < 0) continue;
      ((_a = plan.failed)[_b = frame.task] || (_a[_b] = [])).push(frame.method);
      if (this.push(p, frame.task)) {
        w.log("replanned", p.id, { task: frame.task, why });
        return this.next(p);
      }
    }
    return this.giveUp(p, why);
  }
  fail(p, why) {
    return this.stepFailed(p, why);
  }
  giveUp(p, why) {
    const w = this.w;
    const plan = p.plan;
    w.log("gave-up", p.id, { task: plan.task, why });
    w.emit("planned", { id: p.id, task: plan.task, ok: false, why });
    if (w.reverie?.feelingDefs.has("frustrated")) w.reverie.applyFeel(p.id, "frustrated", plan.task);
    const def = w.tasks.get(plan.task);
    p.cool[plan.task] = w.s.now + Math.max(def?.cooldown ?? 0, this.c.giveUp);
    p.plan = null;
    return null;
  }
  /** Sets a plan aside (something urgent came up). */
  suspend(p) {
    const plan = p.plan;
    if (!plan) return;
    const frame = plan.stack[plan.stack.length - 1];
    if (frame && frame.i > 0) frame.i--;
    p.suspended.unshift(plan);
    const most = this.c.setAside;
    if (p.suspended.length > most) p.suspended.length = most;
    p.plan = null;
    this.w.log("set-aside", p.id, { task: plan.task });
  }
  /** Picks a set-aside plan back up, unless the new choice outranks it. */
  resume(p, pick) {
    const plan = p.suspended[0];
    if (!plan) return null;
    if (pick && pick.rank > plan.rank) return null;
    if (pick && pick.kind === "task" && pick.id === plan.task) {
      p.suspended.shift();
      return null;
    }
    p.suspended.shift();
    if (this.w.s.now - plan.started > this.c.stale) return null;
    p.plan = plan;
    this.w.log("resumed", p.id, { task: plan.task });
    return this.next(p);
  }
  // -------------------------------------------------------------------------
  // get: a backward search over the ways of getting hold of something
  // -------------------------------------------------------------------------
  /** Every action that gives an item. */
  providers(item) {
    const out = [];
    for (const a of this.w.actions.values()) if ((a.gives?.[item] ?? 0) > 0 || (a.buys?.[item] ?? 0) > 0) out.push(a);
    return out;
  }
  /** The cheapest way for a person to get an item: steps and cost, or null. Changes nothing. */
  acquire(p, item, depth, seen) {
    return this.w.peek(() => this.route(p, item, depth, seen));
  }
  route(p, item, depth, seen) {
    if (depth <= 0 || seen.has(item)) return null;
    seen = new Set(seen).add(item);
    const w = this.w;
    let best = null;
    for (const a of this.providers(item)) {
      if (a.job && a.job !== p.def.job?.id) continue;
      const ctx = w.ctx(p, { action: a.id });
      if (!w.lang.all(a.who, ctx)) continue;
      const needs = /* @__PURE__ */ new Set();
      let ok = true;
      for (const c of a.if || []) {
        if (typeof c === "string") {
          const m = /^has[.:]([A-Za-z0-9_\-]+)$/.exec(c.trim());
          if (m && !(w.have(p, m[1]) > 0)) {
            needs.add(m[1]);
            continue;
          }
        }
        if (!w.lang.test(c, ctx)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (const used in a.uses || {}) if (!(w.have(p, used) > 0)) needs.add(used);
      const places = w.ring.resolve(a.at ?? null, p);
      let place = null, travel = Infinity;
      for (const pl of places.length ? places : [null]) {
        if (pl && !w.mind.offeredAt(a, pl, p)) continue;
        if (pl && !w.ring.open(pl)) continue;
        if (pl && a.buys) {
          const stock = w.s.places[pl]?.stock;
          if (stock && Object.keys(a.buys).some((k) => (stock[k] ?? 0) < a.buys[k])) continue;
        }
        place = pl;
        travel = pl ? w.ring.travel(p.place, pl, p) : 0;
        break;
      }
      if (!isFinite(travel)) continue;
      let cost = this.cost(p, a) + travel;
      if (!isFinite(cost)) continue;
      const steps = [];
      let subOk = true;
      for (const n of needs) {
        const sub = this.route(p, n, depth - 1, seen);
        if (!sub) {
          subOk = false;
          break;
        }
        steps.push(...sub.steps);
        cost += sub.cost;
      }
      if (!subOk) continue;
      steps.push(place ? { action: a.id, at: place } : a.id);
      if (!best || cost < best.cost) best = { steps, cost };
    }
    return best;
  }
  /** What an action costs a person, in minutes of effort: time, money by thrift, risk by honesty. */
  cost(p, a) {
    const w = this.w, c = this.c;
    const minutes = Array.isArray(a.minutes) ? (a.minutes[0] + a.minutes[1]) / 2 : a.minutes;
    let cost = minutes + (a.cost ?? 0);
    const price = a.price ?? 0;
    if (price) {
      const money = Number(p.vars.money ?? 0);
      if (price > money) return Infinity;
      const thrift = p.def.traits?.thrift ?? w.cfg.traitDefault;
      cost += price * c.priceWeight * (0.5 + thrift) * (1 + clamp(price / Math.max(1, money)));
    }
    const scruples = a.tags?.includes("illegal") || a.against?.length ? this.knob("scruples", p) : 1;
    if (a.tags?.includes("illegal")) {
      const honesty = p.def.traits?.honesty ?? w.cfg.traitDefault;
      if (honesty >= c.honestNever) return Infinity;
      cost += (c.riskBase + honesty * c.riskHonesty + (w.wormtongue ? w.wormtongue.heat(p.id) * c.riskHeat : 0)) * scruples;
    }
    for (const v of a.against || []) {
      const held = p.def.values?.[v] ?? 0;
      if (held >= c.valuesNever) return Infinity;
      cost += held * c.valuesCost * scruples;
    }
    return cost;
  }
};

// tyrell/src/modules/gaff.ts
var DEFAULT_GAFF = { peakAt: 0.7, peakMinutes: 4 * HOUR, relaxMinutes: 12 * HOUR, decay: 0.04, events: 1, intensity: 1, bump: 0.2, relaxAt: 0.4 };
var Gaff = class {
  constructor(cfg = {}) {
    this.name = "gaff";
    this.knobs = { events: "world", intensity: "world" };
    this.storylets = /* @__PURE__ */ new Map();
    this.deckCards = /* @__PURE__ */ new Map();
    this.metricFns = /* @__PURE__ */ new Map();
    this.config = { ...DEFAULT_GAFF, ...cfg };
  }
  init() {
    return { last: {}, decks: {}, intensity: {}, fired: [] };
  }
  get st() {
    return this.w.s.mod.gaff;
  }
  /** The config in force: as declared, under any world.tune. */
  get c() {
    return this.w.tuned(this.name, this.config);
  }
  attach(w) {
    this.w = w;
    w.lang.term("metric", (_c, a) => this.metric(a));
    w.lang.term("intensity", (_c, a) => this.intensity(a || "world"));
    w.lang.term("phase", (_c, a) => this.phase(a.includes(".") ? a.split(".")[0] : "world") === (a.includes(".") ? a.split(".")[1] : a));
    w.defineInput("trigger", (id, place) => this.fire(id, place));
    w.defineInput("bump", (subject, by) => this.applyBump(subject, by));
    w.defineInput("draw", (deck) => this.applyDraw(deck) ?? null);
    this.metricFns.set("mood", (ww) => {
      const people = ww.people();
      if (!people.length || !ww.reverie) return 0.5;
      return people.reduce((a, p) => a + ww.reverie.mood(p.id), 0) / people.length;
    });
    this.metricFns.set("people", (ww) => ww.people().length);
  }
  // -------------------------------------------------------------------------
  // Declaring
  // -------------------------------------------------------------------------
  storylet(def) {
    this.storylets.set(def.id, def);
    return this;
  }
  /** A deck of storylet ids, drawn without repeating back to back. */
  deck(id, cards) {
    this.deckCards.set(id, cards.slice());
    return this;
  }
  /** A number Gaff can read ('metric:<name>' in conditions). */
  defineMetric(name, fn) {
    this.metricFns.set(name, fn);
    return this;
  }
  metric(name) {
    if (name.startsWith("heat.")) return this.w.wormtongue?.heat(name.slice(5)) ?? 0;
    const fn = this.metricFns.get(name);
    return fn ? fn(this.w) : 0;
  }
  // -------------------------------------------------------------------------
  // Intensity
  // -------------------------------------------------------------------------
  /** A subject's intensity, made if missing (inside the simulation). */
  int(subject) {
    var _a;
    return (_a = this.st.intensity)[subject] || (_a[subject] = { v: 0, phase: "build", since: this.w.s.now });
  }
  /** A subject's intensity for reading: one never bumped is building from 0 (and isn't made). */
  look(subject) {
    return this.st.intensity[subject] ?? { v: 0, phase: "build", since: this.w.s.now };
  }
  intensity(subject = "world") {
    return round(this.look(subject).v, 4);
  }
  phase(subject = "world") {
    return this.look(subject).phase;
  }
  /** Raises (or lowers) a subject's intensity (from the game: recorded). */
  bump(subject, by) {
    this.w.input("bump", [subject, by]);
  }
  applyBump(subject, by) {
    const i = this.int(subject);
    i.v = round(clamp(i.v + by), 4);
  }
  stepPhases() {
    const c = this.c, now2 = this.w.s.now;
    for (const subject in this.st.intensity) {
      const i = this.st.intensity[subject];
      i.v = round(clamp(i.v - c.decay), 4);
      if (i.phase === "build" && i.v >= c.peakAt) {
        i.phase = "peak";
        i.since = now2;
      } else if (i.phase === "peak" && now2 - i.since >= c.peakMinutes) {
        i.phase = "fade";
        i.since = now2;
      } else if (i.phase === "fade" && i.v < c.peakAt * c.relaxAt) {
        i.phase = "relax";
        i.since = now2;
      } else if (i.phase === "relax" && now2 - i.since >= c.relaxMinutes) {
        i.phase = "build";
        i.since = now2;
      }
    }
  }
  // -------------------------------------------------------------------------
  // Storylets
  // -------------------------------------------------------------------------
  /** Could a storylet fire now? (Looking only: changes nothing.) */
  eligible(def) {
    return this.w.peek(() => this.ready(def));
  }
  ready(def) {
    const w = this.w, now2 = w.s.now;
    const last = this.st.last[def.id];
    if (def.cooldown && last !== void 0 && now2 - last < def.cooldown) return false;
    if (def.phase) {
      const phases = Array.isArray(def.phase) ? def.phase : [def.phase];
      if (!phases.includes(this.phase(def.subject ?? "world"))) return false;
    }
    if (typeof def.when === "function") return !!def.when(w);
    if (def.when && !w.lang.all(def.when, w.ctx())) return false;
    return true;
  }
  hour() {
    const w = this.w;
    this.stepPhases();
    const r = w.worldStream("gaff");
    const events = this.c.events;
    for (const def of this.storylets.values()) {
      if (!this.ready(def)) continue;
      if (!r.chance(1 - Math.exp(-HOUR * events / Math.max(1, def.mtb)))) continue;
      let id = def.id;
      if (def.deck) {
        const drawn = this.applyDraw(def.deck);
        if (!drawn) continue;
        const d = this.storylets.get(drawn);
        if (!d || !this.ready(d)) continue;
        id = drawn;
      }
      this.fire(id, null);
      if (id !== def.id) this.st.last[def.id] = w.s.now;
    }
  }
  /** Draws a card from a deck (from the game: recorded): shuffled, no repeat of the last one. */
  draw(deck) {
    return this.w.input("draw", [deck]) ?? void 0;
  }
  /** Draws a card inside the simulation. */
  applyDraw(deck) {
    var _a;
    const st = this.st;
    const d = (_a = st.decks)[deck] || (_a[deck] = { cards: [] });
    if (!d.cards.length) {
      const all = this.deckCards.get(deck) || [];
      let cards = this.w.worldStream("deck:" + deck).shuffle(all);
      if (cards.length > 1 && cards[0] === d.last) cards = [...cards.slice(1), cards[0]];
      d.cards = cards;
    }
    const card = d.cards.shift();
    if (card) d.last = card;
    return card;
  }
  /** Makes a storylet fire now (the game can force one: recorded). */
  trigger(id, place = null) {
    this.w.input("trigger", [id, place]);
  }
  fire(id, place) {
    const w = this.w;
    const def = this.storylets.get(id);
    if (!def) return;
    let where = place;
    if (!where && def.unseen) where = this.emptyPlace(def.unseen);
    const subject = def.subject ?? "world";
    this.st.last[id] = w.s.now;
    this.st.fired.push({ t: w.s.now, id, place: where });
    if (this.st.fired.length > 100) this.st.fired.shift();
    const c = this.c;
    this.applyBump(subject, (def.bump ?? c.bump) * c.intensity);
    w.log("director", void 0, { storylet: id, place: where });
    w.emit("director", { id, place: where, label: def.label ?? id });
    w.internally(() => def.fire(w, { place: where, subject, id }));
  }
  /**
   * A place with a tag that nobody is at, for a storylet firing without a
   * place. It doesn't read focus: focus isn't state, so a replay (which may
   * run with any focus) couldn't make the same choice.
   */
  emptyPlace(tag) {
    const w = this.w;
    const options = w.ring.tagged(tag).filter((id) => !w.ring.present(id).length);
    return w.worldStream("unseen").pick(options) ?? null;
  }
  /**
   * A place with a tag that nobody is at and the game isn't showing (not in
   * a focused region). Looking only: it changes nothing. To fire a storylet
   * there, pass it to trigger(id, place), which records the place.
   */
  unseenPlace(tag) {
    const w = this.w;
    const focus = new Set(w.clock.regionsInFocus());
    const options = w.ring.tagged(tag).filter((id) => !focus.has(w.ring.region(id)) && !w.ring.present(id).length);
    return w.worldStreamPeek("unseen", tag, w.s.now, w.s.n).pick(options) ?? null;
  }
  /** What's fired recently. */
  history() {
    return this.st.fired.slice();
  }
};

// tyrell/src/modules/ceres.ts
var DEFAULT_CERES = { prices: 1, priceShare: 0.4, priceThrift: 0.8, priceFloor: 0.05 };
var Ceres = class {
  constructor(cfg = {}) {
    this.name = "ceres";
    this.knobs = { prices: "person" };
    this.goods = /* @__PURE__ */ new Map();
    this.chains = /* @__PURE__ */ new Map();
    /** Whether anything makes goods or works from a store (worked out from the definitions, kept until they change). */
    this.producingCache = null;
    this.config = { ...DEFAULT_CERES, ...cfg };
  }
  init() {
    return { purses: {}, pantry: {}, rent: {}, ledger: [] };
  }
  get st() {
    return this.w.s.mod.ceres;
  }
  /** The config in force: as declared, under any world.tune. */
  get c() {
    return this.w.tuned(this.name, this.config);
  }
  attach(w) {
    this.w = w;
    w.lang.term("purse", (c) => c.person ? this.money(c.person.id) : 0);
    w.lang.term("price", (c, a) => a ? this.goods.get(a)?.price ?? 0 : w.actions.get(c.action ?? "")?.price ?? 0);
    w.lang.term("stock", (c, a) => {
      const [pl, item] = a.includes(".") ? a.split(".") : [c.place ?? "", a];
      return this.stock(pl, item);
    });
    w.lang.term("afford", (c, a) => c.person ? this.money(c.person.id) >= Number(a) : false);
    w.lang.term("goods", (c, a) => c.person ? this.ofKind(c.person, a) : 0);
    w.lang.effect("pay", (c, a, _op, v) => {
      if (c.person) this.applyPay(c.person.id, a || "world", Number(v ?? 0), "pay");
    });
    w.defineInput("pay", (from, to, amount, why) => this.applyPay(from, to, amount, why));
    w.defineInput("rent", (id, amount, everyDays, to) => {
      this.st.rent[id] = { amount, every: everyDays, next: Math.ceil((w.s.now + everyDays * DAY) / DAY) * DAY, ...to ? { to } : {} };
    });
    w.defineInput("income", (id, amount, everyDays, from) => {
      var _a;
      ((_a = this.st).income || (_a.income = {}))[id] = { amount, every: everyDays, next: Math.ceil((w.s.now + 1) / DAY) * DAY, ...from ? { to: from } : {} };
    });
    w.defineInput("stock", (place, item, n) => {
      const st = w.ring.state(place);
      st.stock || (st.stock = {});
      const before = st.stock[item] || 0;
      st.stock[item] = Math.max(0, before + n);
      this.flow(place, item, st.stock[item] - before);
    });
  }
  good(def) {
    this.goods.set(def.id, def);
    return this;
  }
  /** A production chain, for the daily report's bottlenecks. */
  chain(def) {
    this.chains.set(def.id, def);
    this.producingCache = null;
    return this;
  }
  /** How many goods of a kind a person can use (their own and their household's pantry). */
  ofKind(p, kind) {
    let n = 0;
    for (const g of this.goods.values()) if (g.kind === kind) n += this.w.have(p, g.id);
    return n;
  }
  // -------------------------------------------------------------------------
  // Money
  // -------------------------------------------------------------------------
  /** The purse a person spends from: their household's if it shares one, else their own. */
  purseOf(id) {
    const f = this.w.fellowship;
    const h = f?.household(id);
    if (h && f?.groups.get(h)?.purse) return { kind: "household", id: h };
    return { kind: "person", id };
  }
  /** How much a person can spend. */
  money(id) {
    const purse = this.purseOf(id);
    if (purse.kind === "household") return round(this.st.purses[purse.id] ?? 0, 2);
    return round(Number(this.w.s.people[id]?.vars.money ?? 0), 2);
  }
  add(id, amount) {
    if (id === "world") return;
    const purse = this.w.s.people[id] ? this.purseOf(id) : { kind: "household", id };
    if (purse.kind === "household" || !this.w.s.people[id]) {
      this.st.purses[purse.id] = round((this.st.purses[purse.id] ?? 0) + amount, 2);
      return;
    }
    const p = this.w.s.people[id];
    p.vars.money = round(Number(p.vars.money ?? 0) + amount, 2);
  }
  /** Moves money inside the simulation (from the game, call pay()). 'world' is outside the simulation. */
  applyPay(from, to, amount, why) {
    if (!amount) return;
    this.add(from, -amount);
    this.add(to, amount);
    this.st.ledger.push({ t: this.w.s.now, from, to, amount: round(amount, 2), why });
    if (this.st.ledger.length > 200) this.st.ledger.shift();
  }
  /** Pays money from one to another (or 'world'): recorded for time walk. */
  pay(from, to, amount, why = "paid") {
    this.w.input("pay", [from, to, amount, why]);
  }
  /** Sets up rent: amount every so many days, paid to someone (or the world). */
  rent(id, amount, everyDays = 7, to) {
    this.w.input("rent", [id, amount, everyDays, to ?? null]);
  }
  /** Sets up an income (a pension, an allowance): amount every so many days, from someone (or the world). */
  income(id, amount, everyDays = 7, from) {
    this.w.input("income", [id, amount, everyDays, from ?? null]);
  }
  /** Recent payments. */
  ledger(id) {
    return this.st.ledger.filter((e) => !id || e.from === id || e.to === id);
  }
  // -------------------------------------------------------------------------
  // The household pantry: goods bought by anyone in a household that shares a purse
  // -------------------------------------------------------------------------
  /** How many of an item are in a person's household pantry. */
  pantryCount(id, item) {
    const purse = this.purseOf(id);
    if (purse.kind !== "household") return 0;
    return this.st.pantry?.[purse.id]?.[item] ?? 0;
  }
  /** What's in a household's pantry. */
  pantry(household) {
    return { ...this.st.pantry?.[household] || {} };
  }
  takeFromPantry(id, item, n) {
    var _a, _b, _c;
    const purse = this.purseOf(id);
    if (purse.kind !== "household") return;
    const pan = (_b = (_a = this.st).pantry || (_a.pantry = {}))[_c = purse.id] || (_b[_c] = {});
    pan[item] = Math.max(0, (pan[item] || 0) - n);
    if (!pan[item]) delete pan[item];
  }
  store(p, item, n) {
    var _a, _b, _c;
    const purse = this.purseOf(p.id);
    if (purse.kind === "household") {
      const pan = (_b = (_a = this.st).pantry || (_a.pantry = {}))[_c = purse.id] || (_b[_c] = {});
      pan[item] = (pan[item] || 0) + n;
    } else p.inv[item] = (p.inv[item] || 0) + n;
  }
  // -------------------------------------------------------------------------
  // Stock
  // -------------------------------------------------------------------------
  stock(place, item) {
    return this.w.s.places[place]?.stock?.[item] ?? 0;
  }
  /** Adds (or removes) stock at a place: recorded. */
  restock(place, item, n) {
    this.w.input("stock", [place, item, n]);
  }
  // -------------------------------------------------------------------------
  // Production
  // -------------------------------------------------------------------------
  /** Does anything make goods or work from a store, or is there a chain? Then stock flows are counted. */
  producing() {
    const w = this.w;
    const n = w.actions.size * 1e3 + this.chains.size;
    if (this.producingCache && this.producingCache.n === n) return this.producingCache.on;
    let on = this.chains.size > 0;
    if (!on) {
      for (const a of w.actions.values()) if (a.makes || a.store) {
        on = true;
        break;
      }
    }
    this.producingCache = { n, on };
    return on;
  }
  /** The place an action's `store` names, from the place it's done. */
  storeOf(a, place) {
    if (!a.store || a.store === "here") return place ?? null;
    return a.store;
  }
  /** Counts a change in a place's stock as made (more) or used (less), when production is on. */
  flow(place, item, n) {
    var _a;
    if (!n || !this.producing()) return;
    const st = this.st;
    const prod = st.prod || (st.prod = { day: Math.floor(this.w.s.now / DAY), today: {}, yesterday: {} });
    const f = (_a = prod.today)[place] || (_a[place] = {});
    const side = n > 0 ? f.made || (f.made = {}) : f.used || (f.used = {});
    side[item] = round((side[item] || 0) + Math.abs(n), 4);
  }
  /** Takes goods out of a place's stock (not below none), counting them as used. */
  takeStock(place, item, n) {
    const st = this.w.ring.state(place);
    const before = st.stock?.[item] ?? 0;
    if (!st.stock) return;
    st.stock[item] = round(Math.max(0, before - n), 4);
    this.flow(place, item, st.stock[item] - before);
  }
  /** Adds goods to a place's stock, counting them as made. */
  addStock(place, item, n) {
    const st = this.w.ring.state(place);
    st.stock || (st.stock = {});
    st.stock[item] = round((st.stock[item] || 0) + n, 4);
    this.flow(place, item, n);
  }
  stockAt(item, store) {
    if (store) return this.stock(store, item);
    let n = 0;
    for (const id in this.w.s.places) n += this.w.s.places[id].stock?.[item] ?? 0;
    return round(n, 4);
  }
  flowAt(side, item, store) {
    const y = this.st.prod?.yesterday;
    if (!y) return 0;
    if (store) return y[store]?.[side]?.[item] ?? 0;
    let n = 0;
    for (const id in y) n += y[id][side]?.[item] ?? 0;
    return round(n, 4);
  }
  /**
   * The production report: for each store (or the one asked for), every good
   * with its stock now, what was made and used yesterday, and how many days
   * it would last if yesterday repeated; and the bottleneck links of every
   * chain, where a good piles up while the next one runs short.
   */
  production(place) {
    const w = this.w;
    const prod = this.st.prod;
    const y = prod?.yesterday ?? {};
    const out = { day: Math.floor(w.s.now / DAY) - 1, places: {}, bottlenecks: [] };
    const places = new Set(place ? [place] : Object.keys(y));
    if (!place) {
      for (const c of this.chains.values()) if (c.store) places.add(c.store);
    }
    for (const pl of [...places].sort()) {
      const items = /* @__PURE__ */ new Set([...Object.keys(w.s.places[pl]?.stock || {}), ...Object.keys(y[pl]?.made || {}), ...Object.keys(y[pl]?.used || {})]);
      const goods = {};
      for (const item of [...items].sort()) {
        const stock = this.stock(pl, item), made = y[pl]?.made?.[item] ?? 0, used = y[pl]?.used?.[item] ?? 0;
        const net = round(made - used, 4);
        goods[item] = { stock, made, used, net, days: net < 0 && stock > 0 ? round(stock / -net, 2) : null };
      }
      out.places[pl] = goods;
    }
    for (const c of this.chains.values()) {
      if (place && c.store !== place) continue;
      for (let i = 0; i + 1 < c.goods.length; i++) {
        const from = c.goods[i], to = c.goods[i + 1];
        const fromStock = this.stockAt(from, c.store), toStock = this.stockAt(to, c.store);
        const plenty = c.plenty ?? Math.max(2, 2 * this.flowAt("used", from, c.store));
        const short = c.short !== void 0 ? toStock <= c.short : toStock < Math.max(1, this.flowAt("used", to, c.store));
        if (fromStock >= plenty && short) out.bottlenecks.push({ chain: c.id, from, to, store: c.store ?? null, fromStock, toStock });
      }
    }
    return out;
  }
  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------
  block(p, c) {
    if (c.kind !== "action") return null;
    const a = this.w.actions.get(c.id);
    if (!a) return null;
    const price = a.price ?? 0;
    if (price > 0 && this.money(p.id) < price) return `can't afford ${price}`;
    if (a.buys && c.place) {
      for (const item in a.buys) if (this.stock(c.place, item) < a.buys[item]) return `${item} sold out`;
    }
    if (a.uses) {
      const store = a.store ? this.storeOf(a, c.place ?? p.place) : null;
      if (store) {
        for (const item in a.uses) if (this.stock(store, item) < a.uses[item]) return `no ${item} left at ${store}`;
      } else for (const item in a.uses) if (this.w.have(p, item) < a.uses[item]) return `needs ${item}`;
    }
    return null;
  }
  consider(p, c) {
    if (c.kind !== "action") return;
    const a = this.w.actions.get(c.id);
    const price = a?.price ?? 0;
    if (!price) return;
    const money = Math.max(0.01, this.money(p.id));
    const thrift = p.def.traits?.thrift ?? this.w.cfg.traitDefault;
    const share = clamp(price / money);
    const cfg = this.c;
    const k = cfg.prices * this.w.own(p, this.name, "prices");
    return [["price", round(clamp(1 - share * (cfg.priceShare + thrift * cfg.priceThrift) * k, cfg.priceFloor, 1), 4)]];
  }
  started(p, d) {
    if (d.kind !== "act") return;
    const w = this.w;
    const a = w.actions.get(d.action);
    if (!a) return;
    const owner = d.place && w.ring.get(d.place)?.owner || "world";
    if (a.price) this.applyPay(p.id, owner, a.price, a.id);
    if (a.buys && d.place) {
      const st = w.ring.state(d.place);
      for (const item in a.buys) {
        const n = a.buys[item];
        if (st.stock) {
          const before = st.stock[item] || 0;
          st.stock[item] = Math.max(0, before - n);
          this.flow(d.place, item, st.stock[item] - before);
        }
        this.store(p, item, n);
      }
    }
    const store = a.store ? this.storeOf(a, d.place) : null;
    if (a.uses && store) {
      for (const item in a.uses) this.takeStock(store, item, a.uses[item]);
    } else if (a.uses) {
      for (const item in a.uses) {
        w.takeItem(p, item, a.uses[item]);
        const g = this.goods.get(item);
        if (g?.satisfies) for (const need in g.satisfies) w.mind.setLevel(p, need, w.mind.level(p, need) - g.satisfies[need] * a.uses[item]);
      }
    }
  }
  ended(p, d, frac, interrupted) {
    if (d.kind !== "act") return;
    const w = this.w;
    const a = w.actions.get(d.action);
    if (!a) return;
    const job = p.def.job;
    const wage = a.wage ?? (job && job.action === a.id ? job.wage : void 0);
    if (wage) {
      const hours = (d.end - d.start) * frac / HOUR;
      const payer = d.place && w.ring.get(d.place)?.owner || "world";
      if (payer !== p.id) this.applyPay(payer, p.id, round(wage * hours, 2), "wages");
    }
    if (a.gives && !interrupted) for (const item in a.gives) p.inv[item] = (p.inv[item] || 0) + a.gives[item];
    if (a.makes && frac > 0) {
      let f = interrupted ? frac : 1;
      if (a.yields?.length) {
        const ctx = w.ctx(p, { place: d.place, action: a.id });
        for (const k of a.yields) f *= w.mind.consider(k, ctx);
      }
      const place = this.storeOf(a, d.place);
      for (const item of Object.keys(a.makes)) {
        const n = round(a.makes[item] * f, 4);
        if (n <= 0) continue;
        if (place) this.addStock(place, item, n);
        else this.store(p, item, n);
      }
    }
  }
  hour(t) {
    const w = this.w;
    const hourIndex = Math.round(t / HOUR);
    for (const def of w.ring.defs.values()) {
      if (!def.restock) continue;
      const st = w.ring.state(def.id);
      st.stock || (st.stock = {});
      for (const item in def.restock) {
        const [n, every] = def.restock[item];
        if (every > 0 && hourIndex % every === 0) {
          const cap = def.stock?.[item] ?? n;
          const before = st.stock[item] || 0;
          st.stock[item] = Math.min(cap, before + n);
          this.flow(def.id, item, st.stock[item] - before);
        }
      }
    }
  }
  day() {
    const w = this.w, now2 = w.s.now;
    const prod = this.st.prod;
    if (prod) {
      prod.yesterday = prod.today;
      prod.today = {};
      prod.day = Math.floor(now2 / DAY);
      w.emit("production", this.production());
    }
    for (const id in this.st.income || {}) {
      const inc = this.st.income[id];
      if (inc.next > now2 + 1e-6) continue;
      inc.next += inc.every * DAY;
      if (w.s.people[id]?.status === "active") this.applyPay(inc.to ?? "world", id, inc.amount, "income");
    }
    for (const id in this.st.rent) {
      const r = this.st.rent[id];
      if (r.next > now2 + 1e-6) continue;
      r.next += r.every * DAY;
      const p = w.s.people[id];
      if (!p || p.status === "gone") continue;
      if (this.money(id) >= r.amount) {
        this.applyPay(id, r.to ?? "world", r.amount, "rent");
        w.log("rent", id, { paid: r.amount });
      } else {
        w.log("rent", id, { missed: r.amount });
        w.emit("rent-missed", { id, amount: r.amount });
        if (w.reverie) {
          if (!w.reverie.feelingDefs.has("behind_on_rent")) w.reverie.feeling({ id: "behind_on_rent", label: "Behind on the rent", weight: -0.15, minutes: 7 * DAY, emotion: "tense" });
          w.reverie.applyFeel(id, "behind_on_rent");
          if (r.to && w.s.people[r.to]) w.reverie.applyBelieve(r.to, `behind:${id}`, true, "saw");
        }
      }
    }
  }
  did(_actor, _verb, _data) {
  }
};

// tyrell/src/modules/cradle.ts
var DEFAULT_CRADLE = {
  year: 365 * DAY,
  stages: [["baby", 0], ["child", 3], ["teen", 13], ["adult", 18], ["elder", 65]],
  lifespan: [72, 96],
  fertility: 0.25,
  fertile: [20, 42],
  autoPair: { regard: 0.6, attraction: 0.5 },
  courtship: 1,
  births: 1,
  deaths: 1,
  ageUnknown: 30,
  pairStages: ["adult", "elder"],
  partnerSentiment: 0.3,
  childSentiment: 0.5,
  traitSpread: 0.12,
  griefAt: 0.35,
  pastLifespan: 0.2
};
var Cradle = class {
  constructor(cfg = {}) {
    this.name = "cradle";
    this.knobs = { courtship: "person", births: "person", deaths: "person" };
    /** Names a newborn: set this to your game's namer. */
    this.namer = (r) => "Baby " + "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[r.int(26)];
    /** Fills in a newborn's definition (look, home): set this for your game. */
    this.template = () => ({});
    this.config = { ...DEFAULT_CRADLE, ...cfg };
  }
  init() {
    return { stage: {}, parents: {}, departed: {}, next: 0 };
  }
  get st() {
    return this.w.s.mod.cradle;
  }
  /** The config in force: as declared, under any world.tune. */
  get c() {
    return this.w.tuned(this.name, this.config);
  }
  /** A headline knob for someone: the world's, times their own. */
  knob(name, p) {
    return this.c[name] * this.w.own(p, this.name, name);
  }
  attach(w) {
    this.w = w;
    w.lang.term("age", (c) => c.person ? this.age(c.person.id) : 0);
    w.lang.term("stage", (c, a) => c.person ? a ? this.stage(c.person.id) === a : this.stage(c.person.id) : null);
    w.lang.term("married", (c) => !!(c.person && w.fellowship?.partner(c.person.id)));
    w.defineInput("birth", (parents, def, id) => this.applyBirth(parents, def ?? {}, id));
    w.defineInput("pair", (a, b) => this.applyPair(a, b));
    w.defineInput("depart", (id, why) => this.applyDepart(id, why));
  }
  // -------------------------------------------------------------------------
  // Ages
  // -------------------------------------------------------------------------
  /** Age in years (fractional). */
  age(id) {
    const p = this.w.s.people[id];
    if (!p || p.born === void 0) return this.c.ageUnknown;
    return round((this.w.s.now - p.born) / this.c.year, 3);
  }
  stage(id) {
    const age = this.age(id);
    const stages = this.c.stages;
    let out = stages[0]?.[0] ?? "adult";
    for (const [name, from] of stages) if (age >= from) out = name;
    return out;
  }
  /** Who someone's parents are. */
  parents(id) {
    return this.st.parents[id]?.slice() ?? [];
  }
  /** Who someone's children are. */
  children(id) {
    return Object.keys(this.st.parents).filter((c) => this.st.parents[c].includes(id));
  }
  /** Everyone who has left, and why. */
  departed() {
    return this.st.departed;
  }
  // -------------------------------------------------------------------------
  // Couples, births, departures
  // -------------------------------------------------------------------------
  /** Pairs two people up (from the game: recorded). */
  pair(a, b) {
    this.w.input("pair", [a, b]);
  }
  applyPair(a, b) {
    const f = this.w.fellowship;
    if (!f) return;
    f.applyPartners(a, b);
    const by = this.c.partnerSentiment;
    f.applySentiment(a, b, "my partner", by);
    f.applySentiment(b, a, "my partner", by);
    this.w.log("paired", a, { target: b });
    this.w.emit("paired", { a, b });
  }
  /** A child is born to these parents. Returns the child's id. */
  birth(parents, def = {}, id) {
    return this.w.input("birth", [parents, def, id ?? null]);
  }
  applyBirth(parentIds, def, given) {
    const w = this.w;
    const parents = parentIds.map((id2) => w.s.people[id2]).filter(Boolean);
    const id = given ?? `born${++this.st.next}`;
    const r = new Stream(w.s.seed, "birth", id);
    const delos = w.delos;
    const genome = delos?.active() ? delos.applyInherit(parents.map((p) => p.id), id) : null;
    const traits = genome ? { ...genome.traits } : {};
    const keys = /* @__PURE__ */ new Set();
    for (const p of parents) for (const k in p.def.traits || {}) if (!genome || genome.traits[k] === void 0) keys.add(k);
    for (const k of [...keys].sort()) {
      const vals = parents.map((p) => p.def.traits?.[k]).filter((v) => v !== void 0);
      const avg = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
      const spread = this.c.traitSpread;
      traits[k] = round(clamp(avg + r.range(-spread, spread)), 3);
    }
    const tpl = this.template(r, parents);
    const home = def.home ?? tpl.home ?? parents[0]?.def.home;
    const groups = [.../* @__PURE__ */ new Set([...def.groups || [], ...tpl.groups || [], ...parents.flatMap((p) => w.fellowship?.household(p.id) ? [w.fellowship.household(p.id)] : [])])];
    const child = {
      ...tpl,
      ...def,
      name: def.name ?? tpl.name ?? this.namer(r, parents),
      traits: { ...traits, ...tpl.traits || {}, ...def.traits || {} },
      home,
      groups,
      born: w.s.now,
      place: home,
      tags: [...tpl.tags || [], ...def.tags || [], "born"]
    };
    if (genome) {
      child.talents = { ...genome.talents, ...tpl.talents || {}, ...def.talents || {} };
      child.instincts = { ...genome.instincts, ...tpl.instincts || {}, ...def.instincts || {} };
    }
    w.input("person", [id, child]);
    this.st.parents[id] = parents.map((p) => p.id);
    this.st.stage[id] = this.stage(id);
    if (w.fellowship) for (const p of parents) {
      w.fellowship.applySentiment(p.id, id, "my child", this.c.childSentiment);
    }
    w.log("born", id, { parents: parents.map((p) => p.id) });
    w.emit("born", { id, parents: parents.map((p) => p.id) });
    return id;
  }
  /** Someone leaves for good ('died', 'moved away'...). Money passes on; those who cared grieve. */
  depart(id, why = "left") {
    this.w.input("depart", [id, why]);
  }
  applyDepart(id, why) {
    const w = this.w;
    const p = w.s.people[id];
    if (!p || p.status === "gone") return;
    if (w.reverie && w.fellowship) {
      for (const o of w.people()) {
        if (o.id === id) continue;
        const regard = w.fellowship.regard(o.id, id);
        if (regard >= this.c.griefAt) {
          w.reverie.applyFeel(o.id, "grief", p.name);
          w.reverie.applyRemember(o.id, { k: "loss", about: id, imp: clamp(Math.round(regard * 10), 5, 10), text: `${p.name} ${why}` });
        }
      }
    }
    const money = Number(p.vars.money ?? 0);
    if (money > 0) {
      const heirs = [w.fellowship?.partner(id), ...this.children(id)].filter((h) => !!h && w.s.people[h]?.status === "active");
      if (heirs.length) {
        const share = round(money / heirs.length, 2);
        for (const h of heirs) w.s.people[h].vars.money = round(Number(w.s.people[h].vars.money ?? 0) + share, 2);
      } else if (w.ceres) {
        const hh = w.fellowship?.household(id);
        if (hh) w.ceres.applyPay(id, hh, money, "inheritance");
      }
      p.vars.money = 0;
    }
    this.st.departed[id] = { name: p.name, ...p.born !== void 0 ? { born: p.born } : {}, left: w.s.now, why };
    w.clock.removePerson(id, why);
  }
  // -------------------------------------------------------------------------
  // Daily
  // -------------------------------------------------------------------------
  day() {
    const w = this.w, c = this.c, st = this.st;
    const yearDays = c.year / DAY;
    const people = w.people();
    for (const p of people) {
      if (p.born === void 0) continue;
      const stage = this.stage(p.id);
      if (st.stage[p.id] !== stage) {
        const was = st.stage[p.id];
        st.stage[p.id] = stage;
        if (was) {
          w.log("stage", p.id, { from: was, to: stage });
          w.emit("stage", { id: p.id, from: was, to: stage });
        }
      }
      const age = this.age(p.id);
      if (age >= c.lifespan[0]) {
        const span = Math.max(1, c.lifespan[1] - c.lifespan[0]);
        const pDie = clamp((age - c.lifespan[0]) / span) * 2 / (span * yearDays) + (age >= c.lifespan[1] ? c.pastLifespan : 0);
        if (w.stream(p).chance(pDie * this.knob("deaths", p))) this.applyDepart(p.id, "died");
      }
    }
    const f = w.fellowship;
    if (!f) return;
    if (c.autoPair) {
      const pairs = (id) => c.pairStages.includes(this.stage(id));
      for (const p of people) {
        if (p.status !== "active" || f.partner(p.id) || !pairs(p.id)) continue;
        const kp = this.knob("courtship", p);
        for (const r of f.relations(p.id)) {
          const o = w.s.people[r.id];
          if (!o || o.status !== "active" || f.partner(o.id) || o.id === p.id) continue;
          if (!pairs(o.id)) continue;
          const ko = this.knob("courtship", o);
          if (r.regard >= c.autoPair.regard / kp && r.attraction >= c.autoPair.attraction / kp && f.regard(o.id, p.id) >= c.autoPair.regard / ko && f.attraction(o.id, p.id) >= c.autoPair.attraction / ko) {
            this.applyPair(p.id, o.id);
            break;
          }
        }
      }
    }
    const seen = /* @__PURE__ */ new Set();
    for (const p of people) {
      const q = f.partner(p.id);
      if (!q || seen.has(p.id) || p.status !== "active") continue;
      seen.add(p.id);
      seen.add(q);
      const o = w.s.people[q];
      if (!o || o.status !== "active") continue;
      const ages = [this.age(p.id), this.age(q)];
      if (ages.some((a) => a < c.fertile[0] || a > c.fertile[1])) continue;
      if (w.stream(p).chance(c.fertility * this.knob("births", p) * this.w.own(o, this.name, "births") / yearDays)) this.applyBirth([p.id, q], {}, null);
    }
  }
  removed(p, why) {
    if (!this.st.departed[p.id]) this.st.departed[p.id] = { name: p.name, ...p.born !== void 0 ? { born: p.born } : {}, left: this.w.s.now, why };
  }
};

// tyrell/src/modules/joi.ts
var DEFAULT_JOI = { wants: 0.6, memories: 3, timeoutMs: 2500 };
var Joi = class {
  constructor(cfg = {}) {
    this.name = "joi";
    /** The game's voice, in a sentence: 'neon noir, clipped' or 'cozy, folksy'. */
    this.voice = "Speak as this person would, in one or two short sentences.";
    this.provider = null;
    this.allowed = /* @__PURE__ */ new Set();
    this.config = { ...DEFAULT_JOI, ...cfg };
  }
  attach(w) {
    this.w = w;
  }
  /** The config in force: as declared, under any world.tune. */
  get c() {
    return this.w.tuned(this.name, this.config);
  }
  /** Sets the function that calls a model (async). */
  setProvider(fn) {
    this.provider = fn;
    return this;
  }
  /** Flags a reply may suggest (anything else is dropped). */
  allow(flags) {
    for (const f of flags) this.allowed.add(f);
    return this;
  }
  /** The prompt for a person speaking (useful to look at, or to send yourself). */
  prompt(who, opts = {}) {
    return this.w.peek(() => this.promptNow(who, opts));
  }
  promptNow(who, opts) {
    const w = this.w;
    const p = w.s.people[who];
    if (!p) return "";
    const lines = [];
    lines.push(`You are ${p.name}.`);
    const traits = Object.entries(p.def.traits || {}).map(([k, v]) => `${k} ${round(v, 2)}`).join(", ");
    if (traits) lines.push(`Temperament (0 to 1): ${traits}.`);
    const d = p.doing;
    if (d) lines.push(`Right now: ${d.kind === "travel" ? `walking to ${d.to}` : `${w.actions.get(d.action)?.label ?? d.action} at ${d.place}`}.`);
    const c = this.c;
    const needs = [...w.needs.keys()].map((n) => [n, w.mind.level(p, n)]).filter(([, v]) => v > c.wants).map(([n]) => n);
    if (needs.length) lines.push(`You badly want: ${needs.join(", ")}.`);
    if (w.reverie) {
      lines.push(`Mood: ${round(w.reverie.mood(who), 2)} (${w.reverie.emotion(who)}).`);
      const feelings = w.reverie.feelings(who).map((f) => f.label);
      if (feelings.length) lines.push(`On your mind: ${feelings.join("; ")}.`);
      const mem = w.reverie.memories(who).slice(0, c.memories).map((m) => m.text ?? m.k);
      if (mem.length) lines.push(`You remember: ${mem.join("; ")}.`);
    }
    if (opts.to) {
      const t = w.s.people[opts.to];
      const name = t?.name ?? opts.to;
      const parts = [];
      if (w.fellowship) parts.push(`your regard for them is ${round(w.fellowship.regard(who, opts.to), 2)} (-1 to 1)`);
      const file = w.reverie?.file(who, opts.to);
      if (file) parts.push(`what they've done: ${Object.entries(file.tally).map(([k, v]) => `${k} x${v}`).join(", ")}`);
      lines.push(`You're talking to ${name}${parts.length ? ": " + parts.join("; ") : ""}.`);
    }
    if (opts.topic) lines.push(`The subject: ${opts.topic}.`);
    const fallback = w.cityspeak?.choose(who, opts);
    if (fallback?.text) lines.push(`What you'd usually say: "${fallback.text}"`);
    lines.push("Reply with only the words you say.");
    return lines.join("\n");
  }
  /**
   * Speaks: asks the provider, or falls back to the written line. Never
   * changes the world.
   */
  async speak(who, opts = {}) {
    const w = this.w;
    const line = w.cityspeak?.choose(who, opts) ?? null;
    const fallback = { text: line?.text ?? "", key: line?.key ?? null, flags: [], fromModel: false };
    if (!this.provider) return fallback;
    const req = { prompt: this.prompt(who, opts), system: this.voice, who, line, ...opts.to ? { to: opts.to } : {} };
    const timeout = opts.timeoutMs ?? this.c.timeoutMs;
    try {
      const reply = await Promise.race([
        this.provider(req),
        new Promise((res) => setTimeout(() => res(null), timeout))
      ]);
      if (reply === null) return fallback;
      const text = typeof reply === "string" ? reply : reply.text;
      const flags = typeof reply === "string" ? [] : (reply.flags || []).filter((f) => this.allowed.has(f));
      if (!text || !text.trim()) return fallback;
      return { text: text.trim(), key: line?.key ?? null, flags, fromModel: true };
    } catch {
      return fallback;
    }
  }
};

// tyrell/src/modules/athelas.ts
var DEFAULT_ATHELAS = { contagion: 1, duration: 1 };
var Athelas = class {
  constructor(cfg = {}) {
    this.name = "athelas";
    this.knobs = { contagion: "person", duration: "person" };
    this.courses = /* @__PURE__ */ new Map();
    this.config = { ...DEFAULT_ATHELAS, ...cfg };
  }
  /** A headline knob for someone: the world's (as tuned), times their own. */
  knob(name, p) {
    return this.w.tuned(this.name, this.config)[name] * this.w.own(p, this.name, name);
  }
  /** The state for reading: undefined until someone is first afflicted. */
  get st() {
    return this.w.s.mod.athelas;
  }
  /** The state for writing (inside the simulation): made when first needed. */
  mut() {
    var _a;
    return (_a = this.w.s.mod).athelas || (_a.athelas = { on: {}, immune: {}, k: 0 });
  }
  attach(w) {
    this.w = w;
    const L = w.lang;
    L.term("under", (c, a) => {
      if (!c.person) return a ? false : 0;
      const on = this.st?.on[c.person.id];
      if (!a) return on ? Object.keys(on).length : 0;
      if (a.startsWith("tag:")) return !!on && Object.keys(on).some((id) => this.courses.get(id)?.tags?.includes(a.slice(4)));
      const r = on?.[a];
      return r ? this.courses.get(a)?.phases[r.p]?.id ?? true : false;
    });
    L.term("immune", (c, a) => c.person ? this.immune(c.person.id, a) : false);
    L.effect("afflict", (c, a) => {
      if (c.person) this.applyAfflict(c.person.id, a, c.target ?? void 0);
    });
    L.effect("cure", (c, a) => {
      if (c.person) this.applyCure(c.person.id, a || void 0);
    });
    L.effect("hasten", (c, a, _op, v) => {
      if (c.person) this.applyHasten(c.person.id, a, Number(v ?? 0));
    });
    w.defineInput("afflict", (id, course, from) => this.applyAfflict(id, course, from ?? void 0));
    w.defineInput("cure", (id, course) => this.applyCure(id, course ?? void 0));
    w.defineInput("hasten", (id, course, minutes) => this.applyHasten(id, course, minutes));
  }
  // -------------------------------------------------------------------------
  // Declaring and asking
  // -------------------------------------------------------------------------
  course(def) {
    this.courses.set(def.id, def);
    return this;
  }
  /** The courses running for someone: which phase, since and until when. */
  of(id) {
    const on = this.st?.on[id];
    if (!on) return [];
    return Object.keys(on).map((course) => {
      const r = on[course], def = this.courses.get(course), ph = def?.phases[r.p];
      const out = {
        course,
        label: def?.label ?? course,
        phase: ph?.id ?? String(r.p),
        phaseLabel: ph?.label ?? ph?.id ?? "",
        since: r.since,
        until: r.until
      };
      if (r.from) out.from = r.from;
      return out;
    });
  }
  /** Is someone immune to a course now? */
  immune(id, course) {
    return (this.st?.immune[id]?.[course] ?? -Infinity) > this.w.s.now;
  }
  /** Afflicts someone with a course (from the game: recorded). Returns whether it took. */
  afflict(id, course, from) {
    return this.w.input("afflict", [id, course, from ?? null]) === true;
  }
  /** Cures someone of a course, or of every course (from the game: recorded). */
  cure(id, course) {
    this.w.input("cure", [id, course ?? null]);
  }
  /** Brings the end of the phase someone's in sooner by some minutes (a visit, a remedy that helps): recorded. */
  hasten(id, course, minutes) {
    this.w.input("hasten", [id, course, minutes]);
  }
  // -------------------------------------------------------------------------
  // Running a course
  // -------------------------------------------------------------------------
  phaseMinutes(p, ph) {
    let m = Array.isArray(ph.minutes) ? this.w.stream(p).range(ph.minutes[0], ph.minutes[1]) : ph.minutes;
    if (ph.scale?.length) {
      const ctx = this.w.ctx(p);
      for (const k of ph.scale) m *= this.w.mind.consider(k, ctx);
    }
    m *= this.knob("duration", p);
    return round(Math.max(1, m), 4);
  }
  schedule(id, course, r) {
    r.k = ++this.mut().k;
    this.w.clock.schedule({ t: r.until, k: "module", ref: this.name, who: id, data: { c: course, k: r.k } });
  }
  label(def, ph) {
    return (def.label ?? def.id) + (ph?.label ? `: ${ph.label}` : "");
  }
  /** Afflicts someone, inside the simulation. */
  applyAfflict(id, course, from) {
    var _a;
    const w = this.w;
    const p = w.s.people[id];
    const def = this.courses.get(course);
    if (!p || p.status === "gone" || !def || !def.phases.length) return false;
    const now2 = w.s.now;
    const cur = this.st?.on[id]?.[course];
    if (cur) {
      const again = def.again ?? "ignore";
      if (again === "ignore") return false;
      if (again === "extend") {
        cur.until = round(cur.until + this.phaseMinutes(p, def.phases[cur.p]), 4);
        this.schedule(id, course, cur);
      } else {
        w.mind.settleRise(p);
        this.enter(p, course, 0);
      }
      w.log("afflicted", id, { course, again });
      w.emit("afflicted", { id, course, from: from ?? null, label: def.label ?? course, again });
      return true;
    }
    if (this.immune(id, course)) return false;
    const st = this.mut();
    if (st.immune[id]) {
      delete st.immune[id][course];
      if (!Object.keys(st.immune[id]).length) delete st.immune[id];
    }
    w.mind.settleRise(p);
    const r = { p: 0, since: now2, until: now2, k: 0 };
    if (from) r.from = from;
    ((_a = st.on)[id] || (_a[id] = {}))[course] = r;
    w.log("afflicted", id, { course, ...from ? { from } : {} });
    w.emit("afflicted", { id, course, from: from ?? null, label: def.label ?? course });
    this.enter(p, course, 0);
    return true;
  }
  /** Starts a phase (needs settled by the caller). */
  enter(p, course, i) {
    const w = this.w;
    const def = this.courses.get(course);
    const r = this.st.on[p.id][course];
    const ph = def.phases[i];
    r.p = i;
    r.since = w.s.now;
    r.until = round(w.s.now + this.phaseMinutes(p, ph), 4);
    this.schedule(p.id, course, r);
    w.log("course", p.id, { course, phase: ph.id });
    w.emit("course", { id: p.id, course, phase: ph.id, label: this.label(def, ph) });
    if (ph.feel && w.reverie) w.reverie.applyFeel(p.id, ph.feel, def.label ?? course);
    if (ph.then) w.lang.applyAll(ph.then, w.ctx(p));
    if (p.doing) w.clock.scheduleChecks(p);
    if (ph.stop) w.clock.schedule({ t: w.s.now, k: "module", ref: this.name, who: p.id, data: { c: course, stop: true } });
  }
  /** A course passes, or is cured (needs settled by the caller). */
  end(p, course, cured) {
    var _a, _b;
    const w = this.w;
    const st = this.st;
    const def = this.courses.get(course);
    delete st.on[p.id][course];
    if (!Object.keys(st.on[p.id]).length) delete st.on[p.id];
    if (def?.immunity) ((_a = st.immune)[_b = p.id] || (_a[_b] = {}))[course] = w.s.now + def.immunity;
    w.log("recovered", p.id, { course, ...cured ? { cured } : {} });
    w.emit("recovered", { id: p.id, course, cured, label: def?.label ?? course });
    if (def?.then && !cured) w.lang.applyAll(def.then, w.ctx(p));
    if (p.doing) w.clock.scheduleChecks(p);
  }
  /** Brings a phase's end sooner (or, with a negative number, later), inside the simulation. */
  applyHasten(id, course, minutes) {
    const r = this.st?.on[id]?.[course];
    if (!r || !minutes) return;
    r.until = round(Math.max(this.w.s.now, r.until - minutes), 4);
    this.schedule(id, course, r);
  }
  /** Cures someone of a course (or all of them), inside the simulation. */
  applyCure(id, course) {
    const p = this.w.s.people[id];
    const on = this.st?.on[id];
    if (!p || !on) return;
    const which = course ? on[course] ? [course] : [] : Object.keys(on);
    if (!which.length) return;
    this.w.mind.settleRise(p);
    for (const c of which) this.end(p, c, true);
  }
  timer(item) {
    const w = this.w;
    const p = item.who ? w.s.people[item.who] : void 0;
    if (!p || p.status === "gone") return;
    const course = String(item.data?.c ?? "");
    if (item.data?.stop) {
      if (p.status === "active" && this.st?.on[p.id]?.[course]) {
        const def2 = this.courses.get(course);
        w.clock.rethink(p, this.label(def2, def2?.phases[this.st.on[p.id][course].p]));
      }
      return;
    }
    const r = this.st?.on[p.id]?.[course];
    if (!r || r.k !== item.data?.k) return;
    w.mind.settleRise(p);
    const def = this.courses.get(course);
    if (def && r.p + 1 < def.phases.length) this.enter(p, course, r.p + 1);
    else this.end(p, course, false);
  }
  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------
  rate(p, need) {
    const on = this.st?.on[p.id];
    if (!on) return 1;
    let m = 1;
    for (const course in on) {
      const r = this.courses.get(course)?.phases[on[course].p]?.rates?.[need];
      if (r !== void 0) m *= r;
    }
    return m;
  }
  /** The phase's `weigh` entry for an option: its id, else a tag it has, else '*'. */
  weighFor(weigh, c) {
    if (weigh[c.id] !== void 0) return weigh[c.id];
    const tags = (c.kind === "task" ? this.w.tasks.get(c.id)?.tags : this.w.actions.get(c.id)?.tags) || [];
    for (const key2 of Object.keys(weigh)) if (key2.startsWith("tag:") && tags.includes(key2.slice(4))) return weigh[key2];
    return weigh["*"];
  }
  consider(p, c) {
    const on = this.st?.on[p.id];
    if (!on) return;
    const out = [];
    for (const course in on) {
      const def = this.courses.get(course);
      const ph = def?.phases[on[course].p];
      if (!def || !ph?.weigh) continue;
      const f = this.weighFor(ph.weigh, c);
      if (f !== void 0) out.push([this.label(def, ph), f]);
    }
    return out;
  }
  block(p, c) {
    const on = this.st?.on[p.id];
    if (!on) return null;
    for (const course in on) {
      const def = this.courses.get(course);
      const ph = def?.phases[on[course].p];
      if (!def || !ph?.blocks) continue;
      const tags = (c.kind === "task" ? this.w.tasks.get(c.id)?.tags : this.w.actions.get(c.id)?.tags) || [];
      if (ph.blocks.some((b) => b === c.id || b.startsWith("tag:") && tags.includes(b.slice(4)))) return this.label(def, ph);
    }
    return null;
  }
  /** Someone with a catching course passes it on, now and then, to whoever they spend time with. */
  spread(from, to, minutes) {
    const on = this.st?.on[from.id];
    if (!on || to.status !== "active") return;
    for (const course of Object.keys(on)) {
      const def = this.courses.get(course);
      const cg = def?.contagion;
      if (!def || !cg || def.phases[on[course].p]?.spreads === false) continue;
      if (this.st?.on[to.id]?.[course] || this.immune(to.id, course)) continue;
      let chance = 1 - Math.pow(1 - Math.min(1, Math.max(0, cg.chance * this.knob("contagion", to))), minutes / 60);
      if (cg.resist?.length) {
        const ctx = this.w.ctx(to, { target: from.id });
        for (const k of cg.resist) chance *= this.w.mind.consider(k, ctx);
      }
      if (chance > 0 && this.w.stream(to).chance(chance)) this.applyAfflict(to.id, course, from.id);
    }
  }
  met(a, b, _place, minutes) {
    if (!this.st) return;
    this.spread(a, b, minutes);
    this.spread(b, a, minutes);
  }
  /** Immunities that have run out are let go. */
  day() {
    const st = this.st;
    if (!st) return;
    const now2 = this.w.s.now;
    for (const id of Object.keys(st.immune)) {
      for (const c of Object.keys(st.immune[id])) if (st.immune[id][c] <= now2) delete st.immune[id][c];
      if (!Object.keys(st.immune[id]).length) delete st.immune[id];
    }
  }
  removed(p) {
    const st = this.st;
    if (!st) return;
    delete st.on[p.id];
    delete st.immune[p.id];
  }
};

// tyrell/src/modules/delos.ts
var DEFAULTS = {
  traits: { founders: [0.1, 0.9], bounds: [0, 1], cross: 0.65, noise: 0.1 },
  talents: { founders: [0.6, 1.4], bounds: [0.2, 2], cross: 0.7, noise: 0.08 },
  instincts: { founders: [0.8, 1.25], bounds: [0.5, 1.5], cross: 0, noise: 0.1 },
  looks: { founders: [0, 1], bounds: [0, 1], cross: 0.65, noise: 0.1 }
};
var DEFAULT_DELOS = {
  jump: { chance: 0.12, by: 0.35 },
  gift: { chance: 0.1, by: 0.4 },
  mutation: 1,
  variation: 1,
  traitBlend: { ...DEFAULTS.traits },
  talentBlend: { ...DEFAULTS.talents },
  instinctBlend: { ...DEFAULTS.instincts },
  lookBlend: { ...DEFAULTS.looks }
};
var BLEND = { traits: "traitBlend", talents: "talentBlend", instincts: "instinctBlend", looks: "lookBlend" };
var Delos = class {
  constructor(cfg = {}) {
    this.name = "delos";
    this.knobs = { mutation: "world", variation: "world" };
    this.genes = /* @__PURE__ */ new Map();
    this.blends = { traits: /* @__PURE__ */ new Map(), talents: /* @__PURE__ */ new Map(), instincts: /* @__PURE__ */ new Map(), looks: /* @__PURE__ */ new Map() };
    this.config = { ...DEFAULT_DELOS, ...cfg };
  }
  get st() {
    return this.w.s.mod.delos;
  }
  /** The config in force: as declared, under any world.tune. */
  get c() {
    return this.w.tuned(this.name, this.config);
  }
  mut() {
    var _a;
    return (_a = this.w.s.mod).delos || (_a.delos = { g: {} });
  }
  attach(w) {
    this.w = w;
    w.lang.term("gene", (c, a) => c.person ? this.express(c.person.id, a) ?? null : null);
    w.lang.term("carries", (c, a) => {
      if (!c.person) return false;
      const i = a.indexOf(".");
      return i > 0 ? this.carries(c.person.id, a.slice(0, i), a.slice(i + 1)) : false;
    });
    w.defineInput("genome", (id, part) => this.applySet(id, part));
  }
  // -------------------------------------------------------------------------
  // Declaring
  // -------------------------------------------------------------------------
  gene(def) {
    this.genes.set(def.id, def);
    return this;
  }
  /** A personality trait carried in the genome (written to PersonDef.traits). */
  trait(def) {
    this.blends.traits.set(def.id, def);
    return this;
  }
  /** A talent for a skill: how fast it's learned (written to PersonDef.talents). */
  talent(def) {
    this.blends.talents.set(def.id, def);
    return this;
  }
  /** An inborn taste for an action or task (written to PersonDef.instincts). */
  instinct(def) {
    this.blends.instincts.set(def.id, def);
    return this;
  }
  /** A continuous look, like a skin tone (read with looks()). */
  look(def) {
    this.blends.looks.set(def.id, def);
    return this;
  }
  /** Is anything declared? Without, Delos does nothing (and Cradle blends traits its own way). */
  active() {
    return this.genes.size > 0 || this.blends.traits.size > 0 || this.blends.talents.size > 0 || this.blends.instincts.size > 0 || this.blends.looks.size > 0;
  }
  // -------------------------------------------------------------------------
  // Asking
  // -------------------------------------------------------------------------
  /** Someone's genome (a copy), or undefined if they have none. */
  genome(id) {
    const g = this.st?.g[id];
    return g ? JSON.parse(JSON.stringify(g)) : void 0;
  }
  /** What a gene shows for someone (undefined without a genome or the gene). */
  express(id, gene) {
    const copies = this.st?.g[id]?.genes[gene];
    const def = this.genes.get(gene);
    if (!copies || !def) return void 0;
    if (def.express) return def.express(copies.slice());
    for (const a of def.alleles) if (copies.includes(a)) return a;
    return copies[0];
  }
  /** Does someone carry an allele (showing or not)? */
  carries(id, gene, allele) {
    return !!this.st?.g[id]?.genes[gene]?.includes(allele);
  }
  /** Everything someone looks like: each gene as it shows, and the continuous looks. */
  looks(id) {
    const g = this.st?.g[id];
    const out = {};
    if (!g) return out;
    for (const gene of [...this.genes.keys()].sort()) {
      const v = this.express(id, gene);
      if (v !== void 0) out[gene] = v;
    }
    for (const k of [...this.blends.looks.keys()].sort()) if (g.looks[k] !== void 0) out[k] = this.expressed("looks", k, g.looks[k]);
    return out;
  }
  // -------------------------------------------------------------------------
  // Making genomes
  // -------------------------------------------------------------------------
  settings(kind, def) {
    const d = DEFAULTS[kind], g = this.c[BLEND[kind]];
    return { founders: def.founders ?? g.founders ?? d.founders, bounds: def.bounds ?? g.bounds ?? d.bounds, cross: def.cross ?? g.cross ?? d.cross, noise: def.noise ?? g.noise ?? d.noise };
  }
  fit(kind, def, v) {
    const { bounds } = this.settings(kind, def);
    const x = clamp(v, bounds[0], bounds[1]);
    return def.round ? Math.round(x) : round(x, 4);
  }
  expressed(kind, id, v) {
    const def = this.blends[kind].get(id);
    return def?.express ? round(def.express(v), 4) : v;
  }
  allele(def, r) {
    const w = def.weights;
    return w && w.length === def.alleles.length ? r.weighted(def.alleles, (a) => w[def.alleles.indexOf(a)]) : r.pick(def.alleles);
  }
  /** A founder's genome: drawn from the founders' ranges, keeping any value their definition already gives. */
  founder(p, id) {
    const r = new Stream(this.w.s.seed, "delos", id);
    const g = { genes: {}, traits: {}, talents: {}, instincts: {}, looks: {} };
    for (const gid of [...this.genes.keys()].sort()) {
      const def = this.genes.get(gid);
      const n = def.copies === 1 ? 1 : 2;
      g.genes[gid] = Array.from({ length: n }, () => this.allele(def, r));
    }
    const given = { traits: p?.def.traits, talents: p?.def.talents, instincts: p?.def.instincts, looks: void 0 };
    for (const kind of ["traits", "talents", "instincts", "looks"]) {
      for (const k of [...this.blends[kind].keys()].sort()) {
        const def = this.blends[kind].get(k);
        const { founders } = this.settings(kind, def);
        const drawn = r.range(founders[0], founders[1]);
        const have = given[kind]?.[k];
        g[kind][k] = have !== void 0 ? have : this.fit(kind, def, drawn);
      }
    }
    return g;
  }
  /** Writes what a genome means (traits, talents, instincts) into the person's definition, keeping what it already says. */
  writeDef(p, g, overwrite) {
    const set = (field) => {
      var _a;
      const keys = Object.keys(g[field]).sort();
      if (!keys.length) return;
      const out = (_a = p.def)[field] || (_a[field] = {});
      for (const k of keys) if (overwrite || out[k] === void 0) out[k] = this.expressed(field, k, g[field][k]);
    };
    set("traits");
    set("talents");
    set("instincts");
  }
  /** Gives someone a founder's genome if they have none (inside the simulation). Returns it. */
  applyFounder(id) {
    const st = this.mut();
    const have = st.g[id];
    if (have) return have;
    const p = this.w.s.people[id];
    const g = this.founder(p, id);
    st.g[id] = g;
    if (p) this.writeDef(p, g, false);
    return g;
  }
  /**
   * A child's genome from its parents' (inside the simulation; Cradle calls
   * it for a birth before the child joins). Parents without a genome get a
   * founder's first. Returns what it means for the child's definition.
   */
  applyInherit(parentIds, child) {
    const w = this.w;
    const ps = parentIds.filter((id) => w.s.people[id] || this.st?.g[id]).map((id) => this.applyFounder(id));
    if (!ps.length) {
      const g2 = this.applyFounder(child);
      return this.meaning(g2);
    }
    const [a, b] = [ps[0], ps[1] ?? ps[0]];
    const r = new Stream(w.s.seed, "delos", "birth", child);
    const g = { genes: {}, traits: {}, talents: {}, instincts: {}, looks: {} };
    const mut = [];
    const cfg = this.c;
    for (const gid of [...this.genes.keys()].sort()) {
      const def = this.genes.get(gid);
      const from = (x) => {
        const c = x.genes[gid];
        return c && c.length ? r.pick(c) : this.allele(def, r);
      };
      const copies = def.copies === 1 ? [from(r.chance(0.5) ? a : b)] : [from(a), from(b)];
      if (def.mutate && r.chance(def.mutate * cfg.mutation)) {
        const i = r.int(copies.length);
        const to = this.allele(def, r);
        if (to !== copies[i]) {
          copies[i] = to;
          mut.push({ kind: "gene", id: gid, to });
        }
      }
      g.genes[gid] = copies;
    }
    for (const kind of ["traits", "talents", "instincts", "looks"]) {
      for (const k of [...this.blends[kind].keys()].sort()) {
        const def = this.blends[kind].get(k);
        const { founders, cross, noise } = this.settings(kind, def);
        const va = a[kind][k] ?? r.range(founders[0], founders[1]);
        const vb = b[kind][k] ?? r.range(founders[0], founders[1]);
        const one = r.chance(0.5) ? va : vb;
        const n = noise * cfg.variation;
        g[kind][k] = this.fit(kind, def, one * cross + (va + vb) / 2 * (1 - cross) + r.range(-n, n));
      }
    }
    const traits = [...this.blends.traits.keys()].sort();
    if (traits.length && r.chance(cfg.jump.chance * cfg.mutation)) {
      const k = traits[r.int(traits.length)];
      const by = r.chance(0.5) ? cfg.jump.by : -cfg.jump.by;
      const before = g.traits[k];
      g.traits[k] = this.fit("traits", this.blends.traits.get(k), before + by);
      mut.push({ kind: "trait", id: k, by: round(g.traits[k] - before, 4) });
    }
    const talents = [...this.blends.talents.keys()].sort();
    if (talents.length && r.chance(cfg.gift.chance * cfg.mutation)) {
      const k = talents[r.int(talents.length)];
      const before = g.talents[k];
      g.talents[k] = this.fit("talents", this.blends.talents.get(k), before + cfg.gift.by);
      mut.push({ kind: "talent", id: k, by: round(g.talents[k] - before, 4) });
    }
    if (mut.length) g.mut = mut;
    this.mut().g[child] = g;
    for (const m of mut) {
      const d = { kind: m.kind, what: m.id, ...m.by !== void 0 ? { by: m.by } : {}, ...m.to !== void 0 ? { to: m.to } : {} };
      w.log("mutated", child, d);
      w.emit("mutated", { id: child, ...d });
    }
    return this.meaning(g);
  }
  /** What a genome means for a definition: its traits, talents and instincts, expressed. */
  meaning(g) {
    const out = { traits: {}, talents: {}, instincts: {} };
    for (const kind of ["traits", "talents", "instincts"]) for (const k of Object.keys(g[kind]).sort()) out[kind][k] = this.expressed(kind, k, g[kind][k]);
    return out;
  }
  /** Sets parts of someone's genome (an imported traveler, a game's own founders): from the game, recorded. */
  set(id, part) {
    this.w.input("genome", [id, JSON.parse(JSON.stringify(part))]);
  }
  /** Sets parts of a genome inside the simulation, and writes what they mean into the definition. */
  applySet(id, part) {
    var _a;
    const g = this.applyFounder(id);
    for (const gid in part.genes || {}) g.genes[gid] = part.genes[gid].slice();
    for (const kind of ["traits", "talents", "instincts", "looks"]) for (const k in part[kind] || {}) g[kind][k] = part[kind][k];
    const p = this.w.s.people[id];
    if (!p) return;
    const m = this.meaning(g);
    for (const kind of ["traits", "talents", "instincts"]) {
      const given = part[kind];
      if (!given) continue;
      const out = (_a = p.def)[kind] || (_a[kind] = {});
      for (const k in given) out[k] = m[kind][k] ?? given[k];
    }
  }
  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------
  /** A founder gets a genome when they join (a child born through Cradle already has one). */
  added(p) {
    if (!this.active() || this.st?.g[p.id]) return;
    this.applyFounder(p.id);
  }
};

// tyrell/src/modules/landing.ts
function landing(lang, base, lands, ctx) {
  let d = base;
  if (typeof lands === "function") d += Number(lands(ctx)) || 0;
  else for (const r of lands || []) if (!r.if || lang.all(r.if, ctx)) d += r.by;
  return round(d, 4);
}

// tyrell/src/modules/voice.ts
var DEFAULT_VOICE = {
  offers: 3,
  choices: 3,
  theirs: 0.3,
  patience: 8,
  fresh: 7 * DAY,
  strong: 2,
  onWell: [],
  onBadly: [],
  greet: "greet",
  bye: "bye",
  close: "close",
  react: "react",
  deed: null,
  chatter: 1,
  warmthRegard: 3,
  warmthMin: -1,
  warmthMax: 3,
  familiarTalk: 0.5,
  familiarLearned: 1,
  cooldown: 3 * DAY,
  soreDays: 2,
  soreWeight: 0.1,
  revealPull: 1.5,
  salientFloor: 0.05,
  variety: 0.2,
  promiseDays: 3,
  promiseKeep: 30
};
var bondKey = (who, by) => who + ">" + by;
var Voice = class {
  constructor(cfg = {}) {
    this.name = "voice";
    this.knobs = { chatter: "person" };
    this.approaches = /* @__PURE__ */ new Map();
    this.threads = /* @__PURE__ */ new Map();
    this.promiseDefs = /* @__PURE__ */ new Map();
    /** The warmth a talk starts with (a definition: set it on every start). Default: regard times config.warmthRegard (3), rounded, from warmthMin to warmthMax (-1 to 3; with Fellowship), else 0. */
    this.warmth = (ctx) => {
      const f = ctx.world.fellowship;
      const c = this.c;
      return f && ctx.person && ctx.target ? Math.round(clamp(f.regard(ctx.person.id, ctx.target) * c.warmthRegard, c.warmthMin, c.warmthMax)) : 0;
    };
    /** How many beats they'll talk for (a definition), before `chatter`. Default config.patience. */
    this.patience = () => this.c.patience;
    /** The talk being worked on inside an input (effects add their notes to it). */
    this.live = null;
    this.config = { ...DEFAULT_VOICE, ...cfg };
  }
  get st() {
    return this.w.s.mod.voice;
  }
  /** The config in force: as declared, under any world.tune. */
  get c() {
    return this.w.tuned(this.name, this.config);
  }
  /** How chatty the one talked to is: the world's chatter, times their own. */
  chatter(who) {
    return this.c.chatter * this.w.own(this.w.s.people[who], this.name, "chatter");
  }
  mut() {
    var _a;
    return (_a = this.w.s.mod).voice || (_a.voice = { talks: {}, bonds: {}, promises: [] });
  }
  bond(who, by) {
    var _a, _b;
    return (_a = this.mut().bonds)[_b = bondKey(who, by)] || (_a[_b] = { talks: 0, seen: {} });
  }
  peekBond(who, by) {
    return this.st?.bonds[bondKey(who, by)];
  }
  attach(w) {
    this.w = w;
    const L = w.lang;
    const by = (c) => c.target ?? null;
    const talkOf = (c) => {
      const t = by(c);
      const talk = t ? this.st?.talks[t] : void 0;
      return talk && c.person && talk.who === c.person.id ? talk : void 0;
    };
    L.term("talks", (c) => c.person && by(c) ? this.peekBond(c.person.id, by(c))?.talks ?? 0 : 0);
    L.term("familiar", (c) => c.person && by(c) ? this.familiarity(c.person.id, by(c)) : 0);
    L.term("talking", (c, a) => {
      if (!c.person) return false;
      const talks = this.st?.talks || {};
      return a ? talks[a]?.who === c.person.id : Object.values(talks).some((t) => t.who === c.person?.id);
    });
    L.term("warmth", (c) => talkOf(c)?.warmth ?? 0);
    L.term("patience", (c) => talkOf(c)?.patience ?? 0);
    L.term("landed", (c) => talkOf(c)?.landed ?? null);
    L.term("learned", (c, a) => c.person && by(c) ? this.peekBond(c.person.id, by(c))?.known?.[a] ?? false : false);
    L.term("sore", (c, a) => c.person && by(c) ? (this.peekBond(c.person.id, by(c))?.sore?.[a] ?? -1) > w.s.now : false);
    L.term("talked", (c, a) => {
      if (!c.person || !by(c)) return a ? false : null;
      const b = this.peekBond(c.person.id, by(c));
      if (a) return b?.seen[a] !== void 0;
      return b?.last !== void 0 ? round(w.s.now - b.last, 2) : null;
    });
    L.term("promise", (c, a) => {
      if (!c.person) return null;
      const list = (this.st?.promises || []).filter((x) => x.who === c.person?.id && x.id === a && (!by(c) || x.by === by(c)));
      return list.length ? list[list.length - 1].state : null;
    });
    L.effect("learn", (c, a, _op, v) => {
      if (c.person && c.target) this.applyLearn(c.person.id, c.target, a, v === null ? true : v);
    });
    L.effect("promise", (c, a, _op, v) => {
      if (c.person && c.target) this.applyPromise(c.person.id, c.target, a, v === null || v === true ? void 0 : Number(v));
    });
    L.effect("sore", (c, a, _op, v) => {
      if (!c.person || !c.target) return;
      const talk = this.st?.talks[c.target];
      const thread = a || talk?.thread?.id;
      if (!thread) return;
      const b = this.bond(c.person.id, c.target);
      (b.sore || (b.sore = {}))[thread] = this.w.s.now + (v === null || v === true ? this.c.soreDays : Number(v)) * DAY;
    });
    L.effect("warmth", (c, _a, op, v) => {
      const talk = c.target ? this.st?.talks[c.target] : void 0;
      if (!talk || !c.person || talk.who !== c.person.id) return;
      const n = Number(v);
      talk.warmth = round(op === "+=" ? talk.warmth + n : op === "-=" ? talk.warmth - n : op === "*=" ? talk.warmth * n : n, 4);
    });
    w.defineInput("voice.start", (who, by2) => this.applyStart(who, by2));
    w.defineInput("voice.answer", (by2, i, id) => this.applyAnswer(by2, i, id));
    w.defineInput("voice.end", (by2) => this.applyEnd(by2, "left"));
  }
  // -------------------------------------------------------------------------
  // Declaring
  // -------------------------------------------------------------------------
  approach(def) {
    this.approaches.set(def.id, def);
    return this;
  }
  thread(def) {
    this.threads.set(def.id, def);
    return this;
  }
  promise(def) {
    this.promiseDefs.set(def.id, def);
    return this;
  }
  // -------------------------------------------------------------------------
  // The game's side
  // -------------------------------------------------------------------------
  /** Starts a talk with someone (from the game: recorded). Returns what to show, or null if they can't talk. */
  start(who, by = "player") {
    return this.w.input("voice.start", [who, by]) ?? null;
  }
  /** Chooses one of the talk's answers by its index in current().answers (recorded). Returns what to show next. */
  answer(i, by = "player") {
    const opt = this.st?.talks[by]?.options[i];
    return this.w.input("voice.answer", [by, i, opt?.id ?? null]) ?? null;
  }
  /** Ends a talk without a goodbye (walked off; recorded). */
  end(by = "player") {
    this.w.input("voice.end", [by]);
  }
  /** The talk in progress, as the game shows it, or null. */
  current(by = "player") {
    const talk = this.st?.talks[by];
    return talk ? this.view(talk, false) : null;
  }
  /** How well someone knows the speaker: half a point a talk, a point for each thing learned about them. */
  familiarity(who, by = "player") {
    const b = this.peekBond(who, by);
    const c = this.c;
    return b ? round(b.talks * c.familiarTalk + Object.keys(b.known || {}).length * c.familiarLearned, 2) : 0;
  }
  /** What the speaker has learned about someone. */
  learned(who, by = "player") {
    return { ...this.peekBond(who, by)?.known || {} };
  }
  /** Talks so far between them, and when the last ended. */
  history(who, by = "player") {
    const b = this.peekBond(who, by);
    return { talks: b?.talks ?? 0, last: b?.last ?? null, lastThread: b?.lastThread ?? null, seen: { ...b?.seen || {} } };
  }
  /** Promises made to someone (or everyone), newest last. */
  promises(who) {
    return (this.st?.promises || []).filter((p) => !who || p.who === who).map((p) => ({ ...p }));
  }
  // -------------------------------------------------------------------------
  // Running a talk (inside inputs)
  // -------------------------------------------------------------------------
  ctx(talk) {
    return this.w.ctx(this.w.s.people[talk.who], { target: talk.by });
  }
  /** A stream of this talk's own: the same talk draws the same on a replay. */
  stream(talk) {
    return new Stream(this.w.s.seed, "voice", talk.who, talk.by, talk.t, talk.n++);
  }
  applyStart(who, by) {
    const w = this.w;
    const p = w.s.people[who];
    if (!p || p.status !== "active" || who === by) return null;
    const st = this.mut();
    const old = st.talks[by];
    if (old && old.who === who) return this.view(old, false);
    if (old) this.applyEnd(by, "left");
    const talk = { who, by, t: w.s.now, n: 0, warmth: 0, patience: 0, done: [], said: [], lines: [], options: [] };
    const ctx = this.ctx(talk);
    talk.warmth = round(Number(this.warmth(ctx)) || 0, 4);
    talk.patience = Math.max(1, Math.round((Number(this.patience(ctx)) || this.c.patience) * this.chatter(who)));
    st.talks[by] = talk;
    this.live = talk;
    try {
      w.log("talk", who, { by });
      w.emit("voice:start", { who, by });
      this.say(talk, "them", this.c.greet);
      if (!this.theirTurn(talk)) this.refresh(talk);
    } finally {
      this.live = null;
    }
    return this.view(talk, false);
  }
  applyAnswer(by, i, id) {
    const talk = this.st?.talks[by];
    if (!talk) return null;
    const opt = (id !== null ? talk.options.find((o) => o.id === id) : void 0) ?? talk.options[i];
    if (!opt || !opt.ok) return this.view(talk, false);
    talk.lines = [];
    this.live = talk;
    try {
      if (opt.kind === "bye") return this.bye(talk);
      if (opt.kind === "drop") this.finishThread(talk, false);
      else if (opt.kind === "thread") {
        const def = this.threads.get(opt.id);
        if (def) this.enter(talk, def, false);
      } else if (opt.kind === "answer") {
        const where = this.chosen(talk, opt);
        if (where === "bye") return this.bye(talk);
      }
      if (!this.st?.talks[by]) return this.view(talk, true);
      if (!talk.thread && !talk.over && this.theirTurn(talk)) return this.view(talk, false);
      this.refresh(talk);
    } finally {
      this.live = null;
    }
    return this.view(talk, false);
  }
  /** An answer is chosen: said, its approach lands, its effects, and where it leads. Returns where. */
  chosen(talk, opt) {
    const def = talk.thread ? this.threads.get(talk.thread.id) : void 0;
    const beat = def && talk.thread ? def.beats[talk.thread.beat] : void 0;
    const a = beat?.answers?.[Number(opt.id.slice(1))];
    if (!def || !a) {
      this.finishThread(talk, false);
      return "end";
    }
    this.say(talk, "you", a.say, true);
    if (a.approach) this.land(talk, a.approach);
    const ctx = this.ctx(talk);
    if (a.then) this.w.lang.applyAll(a.then, ctx);
    let to = "end";
    if (typeof a.to === "string") to = a.to;
    else if (Array.isArray(a.to)) {
      const pick = a.to.find((x) => (!x.if || this.w.lang.all(x.if, ctx)) && (!x.landed || x.landed === talk.landed) && (x.warmth === void 0 || talk.warmth >= x.warmth));
      to = pick?.to ?? a.to[a.to.length - 1]?.to ?? "end";
    }
    if (to === "bye") return "bye";
    if (to.startsWith("thread:")) {
      this.finishThread(talk, true);
      const next = this.threads.get(to.slice(7));
      if (next && !talk.over) this.enter(talk, next, false, true);
      return to;
    }
    if (to === "end" || !def.beats[to]) this.finishThread(talk, true);
    else this.runBeat(talk, to);
    return to;
  }
  /** Starts on a subject: the speaker opens it (unless it's theirs, or the answer before was the way in), then its first beat. */
  enter(talk, def, theirs, door = false) {
    const ctx = this.ctx(talk);
    const label = typeof def.label === "function" ? def.label(ctx) : def.label ?? def.id;
    talk.thread = { id: def.id, beat: def.start ?? "start", label };
    if (theirs) talk.thread.theirs = true;
    if (!talk.done.includes(def.id)) talk.done.push(def.id);
    if (!theirs && !door) {
      const open = typeof def.open === "string" ? def.open : def.open ? def.approach && def.open[def.approach] || def.open[Object.keys(def.open)[0]] : label;
      if (open) this.say(talk, "you", open, true);
      if (def.approach) this.land(talk, def.approach);
    }
    this.runBeat(talk, def.start ?? "start");
  }
  runBeat(talk, name) {
    const def = talk.thread ? this.threads.get(talk.thread.id) : void 0;
    const beat = def?.beats[name];
    if (!def || !beat || !talk.thread) {
      this.finishThread(talk, true);
      return;
    }
    talk.thread.beat = name;
    talk.patience--;
    if (beat.then) this.w.lang.applyAll(beat.then, this.ctx(talk));
    const who = beat.who ?? "them";
    if (beat.line) this.say(talk, who, beat.line, false, beat.text);
    else if (beat.text !== void 0) this.sayText(talk, who, beat.text);
    if (beat.end || !beat.answers?.length) this.finishThread(talk, true);
  }
  /** A subject is done: talked through (its effects run) or let lie. */
  finishThread(talk, reached) {
    const th = talk.thread;
    if (!th) return;
    const def = this.threads.get(th.id);
    const b = this.bond(talk.who, talk.by);
    b.seen[th.id] = this.w.s.now;
    b.lastThread = th.id;
    talk.thread = void 0;
    if (reached && def?.then) this.w.lang.applyAll(def.then, this.ctx(talk));
    if (talk.patience <= 0 && !talk.over) {
      talk.over = true;
      this.say(talk, "them", this.c.close);
    }
  }
  /** How an approach lands: added to the warmth, and remembered for the lines and answers that follow. */
  land(talk, id) {
    const def = this.approaches.get(id);
    if (!def) return 0;
    const ctx = this.ctx(talk);
    const d = landing(this.w.lang, def.base ?? 0, def.lands, ctx);
    talk.warmth = round(talk.warmth + d, 4);
    talk.landed = d > 0 ? "well" : d < 0 ? "badly" : "even";
    const c = this.c;
    if (Math.abs(d) >= c.strong) {
      this.w.lang.applyAll(d > 0 ? c.onWell : c.onBadly, ctx);
      const how = d > 0 ? "well" : "badly";
      if (!this.say(talk, "them", `${c.react}.${id}.${how}`, false, void 0, true)) this.say(talk, "them", `${c.react}.${how}`, false, void 0, true);
    }
    return d;
  }
  /** Now and then they raise something of their own. Returns whether they did. */
  theirTurn(talk) {
    if (talk.over || talk.thread) return false;
    const w = this.w, now2 = w.s.now;
    const b = this.peekBond(talk.who, talk.by);
    const ctx = this.ctx(talk);
    const c = this.c;
    const cands = [...this.threads.values()].filter((def2) => {
      if (!def2.theirs || talk.done.includes(def2.id)) return false;
      const seen = b?.seen[def2.id];
      if (seen !== void 0 && now2 - seen < (def2.cooldown ?? c.cooldown)) return false;
      return !def2.if || w.peek(() => w.lang.all(def2.if, ctx));
    }).sort((x, y) => x.id < y.id ? -1 : 1);
    if (!cands.length) return false;
    const r = this.stream(talk);
    if (!r.chance(c.theirs * this.chatter(talk.who))) return false;
    const def = r.weighted(cands, (d) => Math.max(0, this.weightOf(d, ctx)));
    if (!def) return false;
    this.enter(talk, def, true);
    this.refresh(talk);
    return true;
  }
  weightOf(def, ctx) {
    return typeof def.weight === "function" ? Number(this.w.peek(() => def.weight(ctx))) || 0 : def.weight ?? 1;
  }
  /** The subjects worth raising now, best first. */
  salient(talk) {
    const w = this.w, now2 = w.s.now;
    const b = this.peekBond(talk.who, talk.by);
    const ctx = this.ctx(talk);
    const c = this.c;
    const scored = [];
    for (const def of this.threads.values()) {
      if (def.theirs || talk.done.includes(def.id)) continue;
      if (def.if && !w.lang.all(def.if, ctx)) continue;
      const seen = b?.seen[def.id];
      const fresh = seen === void 0 ? 1 : 1 - Math.exp(-(now2 - seen) / Math.max(1, def.cooldown ?? c.cooldown));
      let s = this.weightOf(def, ctx) * fresh;
      if ((b?.sore?.[def.id] ?? -1) > now2) s *= c.soreWeight;
      if (def.reveals && b?.known?.[def.reveals] === void 0) s *= c.revealPull;
      if (s < c.salientFloor) continue;
      s += w.worldStreamPeek("voice", talk.who, talk.by, Math.floor(now2 / DAY), def.id).next() * c.variety;
      scored.push([s, def]);
    }
    return scored.sort((x, y) => y[0] - x[0] || (x[1].id < y[1].id ? -1 : 1)).slice(0, c.offers).map(([, d]) => d);
  }
  /** Works out what can be said now (kept with the talk, so a replay offers the same). */
  refresh(talk) {
    const w = this.w;
    w.peek(() => {
      const out = [];
      const ctx = this.ctx(talk);
      if (talk.over) {
        talk.options = [{ kind: "bye", id: "bye", ok: true }];
        return;
      }
      if (talk.thread) {
        const beat = this.threads.get(talk.thread.id)?.beats[talk.thread.beat];
        const choices = this.c.choices;
        (beat?.answers || []).forEach((a, i) => {
          if (out.length >= choices) return;
          const ok = (!a.if || w.lang.all(a.if, ctx)) && (a.warmth === void 0 || talk.warmth >= a.warmth);
          if (!ok && !a.soft) return;
          if (ok && !this.isTopic(talk.by, a.say) && talk.said.includes(a.say)) return;
          const o = { kind: "answer", id: "a" + i, ok, say: a.say };
          if (a.label) o.label = a.label;
          if (a.approach) o.approach = a.approach;
          out.push(o);
        });
        out.push({ kind: "drop", id: "drop", ok: true });
      } else {
        for (const def of this.salient(talk)) {
          const o = { kind: "thread", id: def.id, ok: true, label: typeof def.label === "function" ? def.label(ctx) : def.label ?? def.id };
          if (def.approach) o.approach = def.approach;
          out.push(o);
        }
      }
      out.push({ kind: "bye", id: "bye", ok: true });
      talk.options = out;
    });
  }
  bye(talk) {
    this.say(talk, "them", this.c.bye);
    const view = this.view(talk, true);
    this.applyEnd(talk.by, "bye");
    return view;
  }
  /** Ends a talk: what it leaves (a talk counted, when, a deed). */
  applyEnd(by, why) {
    const w = this.w;
    const st = this.st;
    const talk = st?.talks[by];
    if (!st || !talk) return;
    if (talk.thread) this.finishThread(talk, false);
    delete st.talks[by];
    const b = this.bond(talk.who, by);
    b.talks++;
    b.last = w.s.now;
    w.log("talked", talk.who, { by, threads: talk.done.slice(), why });
    w.emit("voice:end", { who: talk.who, by, threads: talk.done.slice(), why });
    const deed = this.c.deed;
    if (deed) {
      const data = { for: talk.who };
      w.log("did", by, { verb: deed, for: talk.who });
      for (const m of w.hooks) m.did?.(by, deed, data);
    }
  }
  // -------------------------------------------------------------------------
  // Words
  // -------------------------------------------------------------------------
  /** Does the speaker have lines on this topic (so it's a topic, not words)? */
  isTopic(speaker, s) {
    const cs = this.w.cityspeak;
    return !!cs && !!this.w.s.people[speaker] && cs.lines.some((l) => l.topic === s);
  }
  /**
   * Says something in the talk: a line on a topic, chosen by Cityspeak for
   * the speaker (passing over what they've said to this listener lately), or
   * the words given. Returns whether anything was said.
   */
  say(talk, who, topicOrWords, words = false, fallback, onlyLine = false) {
    var _a;
    const w = this.w;
    const speaker = who === "them" ? talk.who : who === "you" ? talk.by : null;
    const listener = who === "them" ? talk.by : talk.who;
    const cs = w.cityspeak;
    if (speaker && cs && w.s.people[speaker] && (!words || this.isTopic(speaker, topicOrWords))) {
      const b = this.peekBond(talk.who, talk.by);
      const now2 = w.s.now;
      const fresh = this.c.fresh;
      const said = cs.choose(speaker, {
        to: listener,
        topic: topicOrWords,
        exact: true,
        salt: [talk.t, talk.n++],
        avoid: (key2) => talk.said.includes(key2) || b?.said?.[key2] !== void 0 && now2 - b.said[key2] < fresh
      });
      if (said) {
        const line = { who, key: said.key };
        if (said.text !== void 0) line.text = said.text;
        talk.lines.push(line);
        talk.said.push(said.key);
        if (who === "them") ((_a = this.bond(talk.who, talk.by)).said || (_a.said = {}))[said.key] = now2;
        return true;
      }
    }
    if (onlyLine) return false;
    if (fallback !== void 0) return this.sayText(talk, who, fallback);
    if (words) {
      talk.lines.push({ who, text: topicOrWords });
      talk.said.push(topicOrWords);
      return true;
    }
    if (topicOrWords) {
      talk.lines.push({ who, key: topicOrWords });
      return true;
    }
    return false;
  }
  sayText(talk, who, text) {
    const list = (Array.isArray(text) ? text : [text]).filter((t2) => t2);
    if (!list.length) return false;
    const fresh = list.filter((t2) => !talk.said.includes(t2));
    const t = this.stream(talk).pick(fresh.length ? fresh : list);
    talk.lines.push({ who, text: t });
    talk.said.push(t);
    return true;
  }
  view(talk, ended) {
    return {
      who: talk.who,
      by: talk.by,
      thread: talk.thread ? { id: talk.thread.id, label: talk.thread.label, beat: talk.thread.beat, theirs: !!talk.thread.theirs } : null,
      lines: talk.lines.map((l) => ({ ...l })),
      answers: ended ? [] : talk.options.map((o, i) => ({ ...o, i })),
      warmth: talk.warmth,
      patience: talk.patience,
      landed: talk.landed ?? null,
      over: !!talk.over,
      ended
    };
  }
  // -------------------------------------------------------------------------
  // What a talk leaves: things learned, sore subjects, promises
  // -------------------------------------------------------------------------
  /** The speaker learns something about someone (inside the simulation). */
  applyLearn(who, by, key2, value) {
    const b = this.bond(who, by);
    const had = b.known?.[key2] !== void 0;
    (b.known || (b.known = {}))[key2] = value;
    const talk = this.live && this.live.who === who && this.live.by === by ? this.live : this.st?.talks[by]?.who === who ? this.st?.talks[by] : void 0;
    if (talk && !had) talk.lines.push({ who: "note", learned: key2, value });
    this.w.log("learned", who, { by, key: key2 });
  }
  /** A promise is made to someone (inside the simulation). */
  applyPromise(who, by, id, days) {
    const st = this.mut();
    if (st.promises.some((p) => p.who === who && p.by === by && p.id === id && p.state === "open")) return;
    const def = this.promiseDefs.get(id);
    const now2 = this.w.s.now;
    st.promises.push({ who, by, id, t: now2, due: now2 + (days ?? def?.days ?? this.c.promiseDays) * DAY, state: "open" });
    this.w.log("promised", who, { by, promise: id });
    this.w.emit("promise", { who, by, id, state: "open" });
  }
  settle(p, state) {
    const w = this.w;
    p.state = state;
    p.settled = w.s.now;
    w.log("promise", p.who, { by: p.by, promise: p.id, state });
    w.emit("promise", { who: p.who, by: p.by, id: p.id, state });
    const def = this.promiseDefs.get(p.id);
    const fx = state === "kept" ? def?.onKept : state === "broken" ? def?.onBroken : def?.onLapsed;
    const person = w.s.people[p.who];
    if (fx && person) w.lang.applyAll(fx, w.ctx(person, { target: p.by }));
  }
  /** Each hour, open promises are checked: kept, broken, or come due. */
  hour() {
    const st = this.st;
    if (!st?.promises.length) return;
    const w = this.w, now2 = w.s.now;
    for (const p of st.promises) {
      if (p.state !== "open") continue;
      const person = w.s.people[p.who];
      const def = this.promiseDefs.get(p.id);
      if (person && def) {
        const ctx = w.ctx(person, { target: p.by });
        if (def.kept?.length && w.lang.all(def.kept, ctx)) {
          this.settle(p, "kept");
          continue;
        }
        if (def.broken?.length && w.lang.all(def.broken, ctx)) {
          this.settle(p, "broken");
          continue;
        }
      }
      if (now2 >= p.due) this.settle(p, def?.lapse ?? "lapsed");
    }
  }
  /** Each day, old marks are let go: lines said long ago, promises long settled. */
  day() {
    const st = this.st;
    if (!st) return;
    const now2 = this.w.s.now, c = this.c;
    for (const k of Object.keys(st.bonds)) {
      const said = st.bonds[k].said;
      if (said) {
        for (const key2 of Object.keys(said)) if (now2 - said[key2] > 2 * c.fresh) delete said[key2];
      }
      const sore = st.bonds[k].sore;
      if (sore) {
        for (const t of Object.keys(sore)) if (sore[t] <= now2) delete sore[t];
      }
    }
    st.promises = st.promises.filter((p) => p.state === "open" || now2 - (p.settled ?? now2) < c.promiseKeep * DAY);
  }
  removed(p) {
    const st = this.st;
    if (!st) return;
    for (const by of Object.keys(st.talks)) if (st.talks[by].who === p.id || by === p.id) this.applyEnd(by, "gone");
  }
};

// tyrell/src/modules/bree.ts
var OUTCOMES = ["warm", "good", "fine", "awkward", "sour", "row"];
var DEFAULT_BREE = {
  warmth: 1,
  quarrels: 1,
  escalation: 1,
  grudges: 1,
  forgiveness: 1,
  talk: 1,
  strike: 0.3,
  quiet: ["sleep"],
  needPull: 2,
  traits: { temper: "trait.temper", warmth: "trait.warmth", humor: "trait.humor", patience: "trait.patience", courage: "trait.courage", forgiveness: "trait.forgiveness", talkative: "trait.talkative" },
  scale: [2, 0.75, -0.75, -1.75, -3],
  spread: 1.5,
  regardWeight: 2,
  compatWeight: 1,
  moodWeight: 1,
  stressWeight: 1,
  needWeight: 2,
  attractWeight: 3,
  grudgeWeight: 3,
  rowWeight: 2,
  rowMinutes: 1440,
  roomWeight: 0.5,
  topicWeight: 1,
  mannerWeight: 1,
  sway: 0.4,
  regard: { warm: 0.04, good: 0.02, fine: 5e-3, awkward: -0.01, sour: -0.03, row: -0.08 },
  attraction: { warm: 0.05, good: 0.025, fine: 0, awkward: -0.01, sour: -0.03, row: -0.06 },
  grudge: { warm: 0, good: 0, fine: 0, awkward: 0, sour: 0.1, row: 0.25 },
  mends: { warm: 1.5, good: 1, fine: 0.5, awkward: 0, sour: 0, row: 0 },
  feel: { warm: "good_talk", sour: "had_words", row: "had_words", long: "long_chat", left: "snubbed" },
  memory: { row: 5 },
  groupShare: 0.5,
  longTurns: 6,
  leftRegard: -0.03,
  teachOver: 0.2,
  turns: { partner: 8, kin: 6, close: 8, friend: 5, acquaintance: 3, stranger: 2, rival: 4, sour: 2 },
  bonds: [0.6, 0.3, 0.05, -0.15],
  rivalAt: 0.3,
  talkativeTurns: 2,
  lowMood: 0.35,
  lowMoodTurns: 2,
  turnsJitter: 1,
  minTurns: 2,
  maxTurns: 12,
  quickTurns: 2,
  groupTurns: 3,
  turnGap: [2, 4],
  topicPull: 0.5,
  topicCooldown: DAY,
  topicMemory: 8,
  tellAt: "fine",
  trust: 0.7,
  shareWindow: HOUR,
  likeAbove: 1.1,
  mannerJitter: 0.1,
  groupMax: 5,
  joinChance: 0.5,
  joinRegard: 0,
  escalateAt: "sour",
  escalateBase: 0.25,
  escalateTemper: 0.5,
  escalateStress: 0.5,
  escalateGrudge: 0.6,
  escalateRegard: 0.5,
  calmBase: 0.1,
  calmPatience: 0.6,
  calmRegard: 0.3,
  stepInBase: 0.05,
  stepInRegard: 0.5,
  stepInCourage: 0.3,
  stepInFrom: 0.2,
  mediateRegard: 0.03,
  mediateMends: 0.1,
  leaveBase: 0.3,
  leaveTemper: 0.35,
  leaveRegard: 0.3,
  leaveSour: 0.2,
  grudgeTemper: 0.5,
  grudgeForgive: 0.5,
  fade: 0.04,
  forgiveBase: 0.5,
  forgiveTrait: 1,
  grudgeFloor: 0.02,
  feudAt: 0.5,
  feudFade: 0.01,
  feudSpread: 0,
  feudMends: 0.5,
  avoidFrom: 0.05,
  avoidPlace: 0.6,
  avoidTarget: 0.8,
  avoidFloor: 0.1,
  hostilePull: 1,
  reconcileLabel: "made it up",
  reconcileSentiment: 0.05,
  reconcileFeeling: "made_up",
  reconcileMemory: 5,
  seenAt: "sour",
  witnessStrength: 0.8,
  witnessMemory: 3,
  witnessRegard: 0.5,
  witnessFeeling: "saw_row",
  recent: 50
};
var BREE_FEELINGS = [
  { id: "good_talk", label: "A good talk", weight: 0.05, minutes: 4 * HOUR, emotion: "happy" },
  { id: "long_chat", label: "A proper long talk", weight: 0.07, minutes: 7 * HOUR, emotion: "happy" },
  { id: "had_words", label: "Had words with someone", weight: -0.1, minutes: 6 * HOUR, stack: 2, emotion: "angry" },
  { id: "snubbed", label: "Brushed off", weight: -0.05, minutes: 4 * HOUR, stack: 2, emotion: "sad" },
  { id: "fought", label: "In a fight", weight: -0.2, minutes: DAY, stack: 2, emotion: "angry" },
  { id: "made_up", label: "Made it up", weight: 0.1, minutes: DAY, emotion: "relieved" },
  { id: "saw_row", label: "Saw a row", weight: -0.04, minutes: 4 * HOUR, emotion: "tense" },
  { id: "comforted", label: "Someone was kind", weight: 0.08, minutes: 6 * HOUR, emotion: "happy" }
];
var pairKey = (a, b) => a < b ? a + "|" + b : b + "|" + a;
function breeStarter(opts = {}) {
  const co = opts.company ?? "company", fun = opts.fun ?? "fun";
  const nature = (role, lo, hi) => ({ name: role, input: "nature." + role, out: [lo, hi] });
  const kinds = [
    {
      id: "chat",
      label: "a chat",
      tags: ["talk", "friendly"],
      topics: ["*"],
      group: true,
      relieves: { [co]: 0.15, [fun]: 0.05 },
      escalates: "argue",
      weight: [nature("talkative", 0.5, 1.5)]
    },
    {
      id: "deep_talk",
      label: "a heart to heart",
      tags: ["talk", "friendly"],
      topics: ["tag:deep", "*"],
      to: ["regard>0.3"],
      relieves: { [co]: 0.3 },
      base: 0.25,
      traits: { warmth: 0.5 },
      regard: 1.5,
      escalates: "argue",
      weight: [nature("warmth", 0.2, 1)],
      on: { long: { memory: 4 } }
    },
    {
      id: "joke",
      label: "a joke",
      tags: ["friendly"],
      relieves: { [fun]: 0.1 },
      base: 0.25,
      traits: { humor: 1.5, temper: -0.5 },
      skill: { humor: 1 },
      escalates: "argue",
      weight: [nature("humor", 0.1, 1.2)]
    },
    {
      id: "compliment",
      label: "a compliment",
      tags: ["friendly"],
      to: ["regard>0"],
      base: 1,
      traits: { warmth: 0.5 },
      weight: 0.4,
      on: { warm: { sentiment: { label: "said something kind", by: 0.05, minutes: 2 * DAY } } }
    },
    {
      id: "tease",
      label: "some teasing",
      tags: ["friendly"],
      to: ["regard>0.2"],
      relieves: { [fun]: 0.1 },
      traits: { humor: 1, temper: -1.5 },
      skill: { humor: 0.5 },
      escalates: "argue",
      weight: [nature("humor", 0.1, 0.8)]
    },
    {
      id: "flirt",
      label: "flirting",
      tags: ["romantic", "talk"],
      topics: ["tag:romantic", "small_talk"],
      who: ["!is:child"],
      to: ["attraction>0.1", "!target.is:child"],
      traits: { warmth: 0.5 },
      skill: { humor: 0.5, warmth: 0.5 },
      weight: [{ name: "attraction", input: "attraction", range: [0, 1], out: [0.2, 2.5] }]
    },
    {
      id: "comfort",
      label: "a word of comfort",
      tags: ["friendly"],
      to: ["target.mood<0.4", "regard>0"],
      relieves: { [co]: 0.2 },
      base: 0.5,
      lands: [{ if: ["mood<0.35"], by: 1 }],
      skill: { warmth: 1 },
      weight: [nature("warmth", 0.2, 1.5)],
      on: { warm: { feel: [null, "comforted"] }, good: { feel: [null, "comforted"] } }
    },
    { id: "favor", label: "asking a favor", to: ["regard>0.1"], base: -0.25, traits: { warmth: 1 }, lands: [{ if: ["regard>0.4"], by: 1 }], owes: 1, weight: 0.2 },
    {
      id: "gift",
      label: "a gift",
      tags: ["friendly"],
      to: ["regard>0"],
      base: 1.5,
      regard: 2,
      mends: 0.2,
      weight: 0.1,
      on: { warm: { sentiment: { label: "gave me a present", by: 0.1, minutes: 7 * DAY } } }
    },
    { id: "help", label: "a hand", tags: ["friendly"], to: ["regard>0.1"], base: 1, regard: 1.5, mends: 0.1, deed: "helped", weight: 0.2 },
    { id: "teach", label: "a lesson", tags: ["friendly"], turns: 3, base: 0.5, traits: { patience: 0.5 }, skill: { patience: 1 }, teaches: 1, weight: 0.15 },
    {
      id: "argue",
      label: "an argument",
      tags: ["hostile", "talk"],
      topics: ["grievance", "*"],
      turns: [3, 5],
      base: -1,
      traits: { temper: -1, patience: 1 },
      regard: 1.5,
      escalates: "fight",
      weight: [{ name: "grudge", input: "grudge", out: [0.05, 2] }, { name: "regard", input: "regard", range: [-1, 0.5], out: [1.5, 0.2] }],
      on: { row: { memory: 5 } }
    },
    {
      id: "insult",
      label: "an insult",
      tags: ["hostile"],
      to: ["regard<-0.2"],
      base: -2.5,
      traits: { temper: -1, forgiveness: 0.5 },
      skill: { humor: 0.5 },
      regard: 1.5,
      grudge: 1.5,
      escalates: "fight",
      weight: [{ name: "dislike", input: "regard", range: [-1, -0.2], out: [1, 0.1] }]
    },
    {
      id: "fight",
      label: "a fight",
      tags: ["hostile"],
      turns: 2,
      base: -4,
      traits: { courage: 0.5 },
      regard: 2,
      grudge: 2,
      crime: "fight",
      weight: 0,
      on: { sour: { feel: "fought", memory: 6 }, row: { feel: "fought", memory: 7 } }
    },
    {
      id: "apologize",
      label: "an apology",
      tags: ["friendly"],
      to: ["grudged>0.05"],
      base: 0.5,
      traits: { forgiveness: 1.5, temper: -0.5 },
      skill: { warmth: 0.5 },
      mends: 0.5,
      weight: [{ name: "their grudge", input: "grudged", out: [0.3, 3] }, nature("warmth", 0.3, 1.5)],
      on: { sour: { feel: ["snubbed", null] }, row: { feel: ["snubbed", null] } }
    },
    {
      id: "make_up",
      label: "making up",
      tags: ["friendly"],
      to: ["grudge>0.05", "grudged>0.05"],
      turns: 3,
      base: 0.5,
      traits: { forgiveness: 1.5 },
      mends: 0.6,
      mutual: true,
      weight: [nature("forgiveness", 0.3, 2)]
    },
    {
      id: "avoid",
      label: "the cold shoulder",
      tags: ["hostile"],
      to: ["grudge>0.3"],
      turns: 1,
      base: -1,
      regard: 0.5,
      grudge: 0,
      weight: [{ name: "grudge", input: "grudge", out: [0, 2] }],
      on: { end: { feel: [null, "snubbed"] } }
    }
  ];
  const topics = [
    { id: "small_talk", label: "this and that" },
    { id: "news", label: "the news", from: "beliefs", weight: 1.5 },
    { id: "old_times", label: "old times", from: "memories", tags: ["deep"], fit: [{ if: ["regard>0.3"], by: 0.5 }] },
    { id: "pastimes", label: "what they love doing", from: "likes" },
    { id: "here", label: "this place", from: "place", weight: 0.6 },
    { id: "the_moment", label: "what they're at", from: "doing", weight: 0.8 },
    { id: "troubles", label: "their troubles", tags: ["deep"], if: ["mood<0.45"], fit: [{ if: ["nature.warmth>0.6"], by: 0.5 }], kinds: ["deep_talk", "comfort"] },
    { id: "sweet_nothings", label: "sweet nothings", tags: ["romantic"], kinds: ["flirt"], fit: [{ if: ["attraction>0.3"], by: 1 }] },
    { id: "grievance", label: "what's wrong between them", from: "grudge", kinds: ["argue"], weight: 3 }
  ];
  const manners = [
    { id: "plain", label: "plain", base: 0.1 },
    { id: "warm", label: "warm", traits: { warmth: 2 }, fits: [{ if: ["mood>0.6"], by: 0.3 }], lands: [{ by: 0.25 }] },
    { id: "witty", label: "witty", traits: { humor: 2 }, lands: [{ if: ["nature.humor>0.6"], by: 0.75 }, { if: ["nature.temper>0.7"], by: -0.5 }] },
    { id: "ornery", label: "ornery", traits: { temper: 2 }, fits: [{ if: ["mood<0.4"], by: 0.5 }, { if: ["stress>0.5"], by: 0.5 }], lands: [{ by: -0.75 }] },
    { id: "shy", label: "shy", traits: { talkative: -2 } },
    { id: "gloomy", label: "gloomy", base: -0.6, fits: [{ if: ["mood<0.35"], by: 1.2 }], lands: [{ by: -0.25 }, { if: ["nature.warmth>0.6"], by: 0.25 }] }
  ];
  const keep = (list, ids) => ids ? list.filter((d) => ids.includes(d.id)) : list;
  return { kinds: keep(kinds, opts.kinds), topics: keep(topics, opts.topics), manners: keep(manners, opts.manners) };
}
var Bree = class {
  constructor(cfg = {}) {
    this.name = "bree";
    this.knobs = { warmth: "person", quarrels: "person", escalation: "person", grudges: "person", forgiveness: "person", talk: "person" };
    this.kinds = /* @__PURE__ */ new Map();
    this.topics = /* @__PURE__ */ new Map();
    this.manners = /* @__PURE__ */ new Map();
    this.config = { ...DEFAULT_BREE, ...cfg };
  }
  get st() {
    return this.w.s.mod.bree;
  }
  mut() {
    var _a;
    return (_a = this.w.s.mod).bree || (_a.bree = { n: 0, ids: 0, v: 0, ex: {}, of: {}, g: {}, feuds: {}, pairs: {}, recent: [] });
  }
  /** The config in force: as declared, under any world.tune. */
  get c() {
    return this.w.tuned(this.name, this.config);
  }
  /** A headline knob for someone: the world's, times their own. */
  knob(name, id) {
    return this.c[name] * this.w.own(id === void 0 ? void 0 : this.w.s.people[id], this.name, name);
  }
  /** How chatty people are together: the world's talk, times each one's own. */
  talkOf(ids) {
    let k = this.c.talk;
    for (const id of ids) k *= this.w.own(this.w.s.people[id], this.name, "talk");
    return k;
  }
  attach(w) {
    this.w = w;
    const L = w.lang;
    const other = (c, a) => a && a !== "target" ? a : c.target ?? null;
    L.term("nature", (c, a) => c.person ? this.nature(c.person, a) : w.cfg.traitDefault);
    L.term("grudge", (c, a) => {
      const o = other(c, a);
      return c.person && o ? this.grudge(c.person.id, o) : 0;
    });
    L.term("grudged", (c, a) => {
      const o = other(c, a);
      return c.person && o ? this.grudge(o, c.person.id) : 0;
    });
    L.term("feud", (c, a) => {
      const o = other(c, a);
      return c.person && o ? this.feudBetween(c.person.id, o) : 0;
    });
    L.term("bond", (c, a) => {
      const o = c.target ?? null;
      if (!c.person || !o) return a ? false : null;
      const b = this.bond(c.person.id, o);
      return a ? b === a : b;
    });
    L.term("rowed", (c, a) => {
      const o = other(c, a);
      const row = c.person && o ? this.st?.pairs[pairKey(c.person.id, o)]?.row : void 0;
      return row === void 0 ? null : round(w.s.now - row, 2);
    });
    L.term("exchanges", (c, a) => {
      const o = other(c, a);
      return c.person && o ? this.st?.pairs[pairKey(c.person.id, o)]?.n ?? 0 : 0;
    });
    const rv = w.reverie;
    if (rv) {
      for (const f of BREE_FEELINGS) if (!rv.feelingDefs.has(f.id)) rv.feelingDefs.set(f.id, f);
    }
    L.term("exchange", (c, a) => {
      const ex = c.person ? this.exOf(c.person.id) : void 0;
      return a ? ex?.kind === a : ex?.kind ?? null;
    });
    L.term("outcome", (c, a) => {
      if (!c.person) return a ? false : null;
      const ex = this.exOf(c.person.id);
      const o = ex ? ex.score === null ? null : this.outcome(ex.score) : c.target ? this.st?.pairs[pairKey(c.person.id, c.target)]?.outcome ?? null : null;
      return a ? o === a : o;
    });
    L.term("turn", (c, a) => {
      const o = (c.person ? this.exOf(c.person.id)?.last : void 0) ?? null;
      return a ? o === a : o;
    });
    L.effect("exchange", (c, a) => {
      if (c.person && c.target && this.kinds.has(a) && !this.exOf(c.person.id) && !this.exOf(c.target)) this.begin(a, [c.person.id, c.target], "game");
    });
    w.defineInput("bree.start", (kind, a, others, opts) => this.applyStart(kind, a, others, opts ?? {}));
    w.defineInput("bree.end", (which) => this.applyEnd(which));
    w.defineInput("bree.grudge", (a, b, by, why) => this.applyGrudge(a, b, by, why ?? "the game"));
    w.defineInput("bree.feud", (a, b, s, why) => this.applyFeud(a, b, s, why ?? "the game"));
  }
  // -------------------------------------------------------------------------
  // Declaring
  // -------------------------------------------------------------------------
  kind(def) {
    this.kinds.set(def.id, def);
    return this;
  }
  topic(def) {
    this.topics.set(def.id, def);
    return this;
  }
  manner(def) {
    this.manners.set(def.id, def);
    return this;
  }
  /** Declares the starter set (or some of it): kinds, topics and manners. Declare your own with the same ids after, to change them. */
  starter(opts = {}) {
    const s = breeStarter(opts);
    for (const d of s.topics) this.topic(d);
    for (const d of s.manners) this.manner(d);
    for (const d of s.kinds) this.kind(d);
    return this;
  }
  // -------------------------------------------------------------------------
  // Reading people
  // -------------------------------------------------------------------------
  /** Someone's nature in a role (temper, warmth, humor, patience, courage, forgiveness, talkative), read from the term the config maps it to. */
  nature(p, role) {
    const term = this.c.traits[role];
    const mid2 = this.w.cfg.traitDefault;
    if (!term) return mid2;
    const v = this.w.lang.value(term, this.w.ctx(p));
    return typeof v === "number" && isFinite(v) ? v : mid2;
  }
  /** How a stands with b: 'partner', 'kin', 'rival', or by regard: 'close', 'friend', 'acquaintance', 'stranger', 'sour'. */
  bond(a, b) {
    const w = this.w, fs = w.fellowship, c = this.c;
    if (fs?.partner(a) === b) return "partner";
    if (fs) {
      const h = fs.household(a);
      if (h && h === fs.household(b)) return "kin";
    }
    const cr = w.cradle;
    if (cr && (cr.parents(a).includes(b) || cr.parents(b).includes(a))) return "kin";
    if (Math.min(this.animosity(a, b), this.animosity(b, a)) >= c.rivalAt) return "rival";
    const r = fs ? fs.regard(a, b) : 0;
    const [close, friend, acq, stranger] = c.bonds;
    return r >= close ? "close" : r >= friend ? "friend" : r >= acq ? "acquaintance" : r >= stranger ? "stranger" : "sour";
  }
  /** Where a score falls on the scale. */
  outcome(score) {
    const s = this.c.scale;
    for (let i = 0; i < s.length && i < OUTCOMES.length - 1; i++) if (score >= s[i]) return OUTCOMES[i];
    return "row";
  }
  /** Is an outcome bad enough to escalate, send someone off, or be seen (config.escalateAt or worse)? */
  bad(o) {
    return OUTCOMES.indexOf(o) >= OUTCOMES.indexOf(this.c.escalateAt);
  }
  /** Is outcome x at least as good as y? */
  atLeast(x, y) {
    return OUTCOMES.indexOf(x) <= OUTCOMES.indexOf(y);
  }
  // -------------------------------------------------------------------------
  // Grudges and feuds
  // -------------------------------------------------------------------------
  /** How readily someone forgives: their knob times their nature. */
  forgiving(id) {
    const p = this.w.s.people[id];
    const c = this.c;
    return this.knob("forgiveness", id) * (c.forgiveBase + c.forgiveTrait * (p ? this.nature(p, "forgiveness") : this.w.cfg.traitDefault));
  }
  /** a's grudge against b now, 0..1 (it fades from when it was last set). */
  grudge(a, b) {
    const g = this.st?.g[a]?.[b];
    if (!g) return 0;
    const days = (this.w.s.now - g[1]) / DAY;
    return round(Math.max(0, g[0] - this.c.fade * this.forgiving(a) * days), 4);
  }
  /** Everyone a bears a grudge against: { id, strength, why }, strongest first. */
  grudges(a) {
    const out = [];
    const g = this.st?.g[a];
    if (g) for (const b of Object.keys(g)) {
      const s = this.grudge(a, b);
      if (s > 0) out.push({ id: b, strength: s, why: g[b][2] });
    }
    return out.sort((x, y) => y.strength - x.strength || (x.id < y.id ? -1 : 1));
  }
  /** Changes a's grudge against b (from the game: recorded). Negative eases it. */
  grudgeAgainst(a, b, by, why) {
    this.w.input("bree.grudge", [a, b, by, why ?? null]);
  }
  /** Changes a grudge inside the simulation. */
  applyGrudge(a, b, by, why) {
    var _a;
    if (a === b || !this.w.s.people[a]) return;
    const st = this.mut();
    const now2 = this.w.s.now;
    const s = clamp(this.grudge(a, b) + by);
    const map = (_a = st.g)[a] || (_a[a] = {});
    st.v++;
    if (s <= 0) {
      delete map[b];
      if (!Object.keys(map).length) delete st.g[a];
    } else map[b] = [round(s, 4), now2, by > 0 ? why : map[b]?.[2] ?? why];
    this.w.log("grudge", a, { against: b, by: round(by, 4), strength: round(s, 4), why });
    if (by > 0) this.w.emit("bree:grudge", { id: a, against: b, strength: round(s, 4), why });
    const c = this.c;
    if (by > 0 && s >= c.feudAt && this.grudge(b, a) >= c.feudAt && !st.feuds[pairKey(a, b)]) this.applyFeud(a, b, Math.min(s, this.grudge(b, a)), why);
  }
  /** A feud's strength now (it fades from when it was last set). */
  feudStrength(f) {
    const days = (this.w.s.now - f.t) / DAY;
    return round(Math.max(0, f.s - this.c.feudFade * this.c.forgiveness * days), 4);
  }
  /** Is a person in a party (themselves, or a group they belong to)? */
  inParty(id, party) {
    return id === party || !!this.w.fellowship?.groupsOf(id).includes(party);
  }
  /** The feud between two people, as people or through their groups: its strength, 0 if none. */
  feudBetween(a, b) {
    const feuds = this.st?.feuds;
    if (!feuds) return 0;
    let best = 0;
    for (const k of Object.keys(feuds)) {
      const f = feuds[k];
      if (this.inParty(a, f.a) && this.inParty(b, f.b) || this.inParty(a, f.b) && this.inParty(b, f.a)) best = Math.max(best, this.feudStrength(f));
    }
    return best;
  }
  /** Every feud: { a, b, strength, since, why }. */
  feuds() {
    const feuds = this.st?.feuds || {};
    return Object.keys(feuds).sort().map((k) => ({ a: feuds[k].a, b: feuds[k].b, strength: this.feudStrength(feuds[k]), since: feuds[k].t, why: feuds[k].why })).filter((f) => f.strength > 0);
  }
  /** How much a has against b: their grudge or their feud, whichever is stronger. */
  animosity(a, b) {
    return Math.max(this.grudge(a, b), this.feudBetween(a, b));
  }
  /** Declares a feud between two people or two groups (from the game: recorded); a strength of 0 or null ends it. */
  feud(a, b, strength, why) {
    this.w.input("bree.feud", [a, b, strength, why ?? null]);
  }
  /** Sets a feud inside the simulation. */
  applyFeud(a, b, s, why) {
    if (a === b) return;
    const st = this.mut();
    const k = pairKey(a, b);
    st.v++;
    if (s === null || s <= 0) {
      if (!st.feuds[k]) return;
      delete st.feuds[k];
      this.w.log("feud", a, { with: b, strength: 0, why });
      this.w.emit("bree:feud", { a, b, strength: 0, why });
      return;
    }
    const [x, y] = a < b ? [a, b] : [b, a];
    st.feuds[k] = { a: x, b: y, s: round(clamp(s), 4), t: this.w.s.now, why };
    this.w.log("feud", a, { with: b, strength: round(clamp(s), 4), why });
    this.w.emit("bree:feud", { a, b, strength: round(clamp(s), 4), why });
  }
  // -------------------------------------------------------------------------
  // Exchanges: starting one
  // -------------------------------------------------------------------------
  /** A stream of Bree's own: its draws leave people's own streams as they were. */
  stream() {
    const st = this.mut();
    return new Stream(this.w.s.seed, "bree", st.n++);
  }
  /** Is someone free to talk: about, not walking, not doing something quiet (asleep)? */
  free(p) {
    if (!p || p.status !== "active" || !p.place || p.doing?.kind === "travel") return false;
    const d = p.doing;
    if (d && d.kind === "act") {
      const tags = this.w.actions.get(d.action)?.tags;
      if (tags && this.c.quiet.some((t) => tags.includes(t))) return false;
    }
    return true;
  }
  /** The exchange someone is in, or undefined. */
  exOf(id) {
    const st = this.st;
    const n = st?.of[id];
    return n === void 0 ? void 0 : st?.ex[n];
  }
  /**
   * Starts an exchange of a kind (from the game: recorded, and it applies at
   * once): `a` starts it with `b` (or several, a group). Anyone already in
   * one leaves it. Returns it as it stands after the first turn, or null.
   * `minutes`: the time they have (no turn after it); `turns`: how many.
   */
  start(kind, a, b, opts = {}) {
    return this.w.input("bree.start", [kind, a, Array.isArray(b) ? b : [b], opts]) ?? null;
  }
  /** Ends an exchange now (by its id, or someone in it): someone walked away on screen (recorded). */
  end(which) {
    this.w.input("bree.end", [which]);
  }
  /** Starts an exchange inside the simulation (see start). */
  applyStart(kind, a, others, opts = {}) {
    const w = this.w;
    const who = [a, ...others.filter((o, i) => o !== a && others.indexOf(o) === i)];
    if (who.length < 2 || !this.kinds.has(kind) || who.some((id) => w.s.people[id]?.status !== "active")) return null;
    for (const id of who) {
      const ex2 = this.exOf(id);
      if (ex2) this.finish(ex2, "interrupted");
    }
    const ex = this.begin(kind, who, "game", opts.minutes, opts.turns);
    return ex ? this.view(ex) : null;
  }
  /** Ends an exchange inside the simulation. */
  applyEnd(which) {
    const ex = typeof which === "number" ? this.st?.ex[which] : this.exOf(which);
    if (ex) this.finish(ex, "ended", typeof which === "string" ? which : void 0);
  }
  /** Begins an exchange: the turns it'll run to, the first turn now, the next on the clock. */
  begin(kind, who, why, minutes, turns) {
    const w = this.w;
    const def = this.kinds.get(kind);
    const p = w.s.people[who[0]];
    if (!def || !p) return null;
    const st = this.mut();
    const r = this.stream();
    const ex = {
      id: ++st.ids,
      kind,
      first: kind,
      who: who.slice(),
      place: p.place ?? p.doing?.to ?? null,
      t: w.s.now,
      why,
      n: 0,
      turns: 1,
      score: null,
      heard: {},
      sour: 0,
      manners: {},
      topics: [],
      said: [],
      next: w.s.now
    };
    if (minutes !== void 0 && isFinite(minutes)) ex.until = round(w.s.now + Math.max(0, minutes), 4);
    if (def.tags?.includes("hostile")) ex.by = who[0];
    ex.turns = turns !== void 0 ? Math.max(1, Math.round(turns)) : this.plan(def, who, r, minutes);
    st.ex[ex.id] = ex;
    for (const id of who) st.of[id] = ex.id;
    w.log("exchange", who[0], { id: ex.id, kind, with: who.slice(1), why });
    w.emit("bree:start", this.view(ex));
    this.turn(ex);
    return ex;
  }
  /** The turns an exchange runs to: its own, or by how they stand, how talkative and how low they are; times talk; within the time they have. */
  plan(def, who, r, minutes) {
    const w = this.w, c = this.c;
    const [a, b] = who;
    const pa = w.s.people[a], pb = w.s.people[b];
    let n;
    if (typeof def.turns === "number") n = def.turns;
    else if (Array.isArray(def.turns)) n = def.turns[0] + r.int(Math.max(0, def.turns[1] - def.turns[0]) + 1);
    else if (def.topics?.length) {
      n = c.turns[this.bond(a, b)] ?? c.turns.stranger ?? c.minTurns;
      const talk = (pa ? this.nature(pa, "talkative") : 0.5) + (pb ? this.nature(pb, "talkative") : 0.5) - 1;
      n += Math.round(talk * c.talkativeTurns);
      const rv = w.reverie;
      if (rv && (rv.mood(a) < c.lowMood || rv.mood(b) < c.lowMood)) n -= c.lowMoodTurns;
      const j = Math.max(0, Math.round(c.turnsJitter));
      if (j) n += r.int(2 * j + 1) - j;
      n = clamp(n, c.minTurns, c.maxTurns);
      if (def.group) n += Math.max(0, who.length - 2) * c.groupTurns;
    } else n = c.quickTurns;
    const k = this.talkOf(who);
    if (k !== 1) n = Math.round(n * k);
    n = Math.max(1, Math.round(n));
    if (minutes !== void 0 && isFinite(minutes)) {
      const gap = (c.turnGap[0] + (c.turnGap[1] ?? c.turnGap[0])) / 2;
      n = Math.min(n, Math.max(1, Math.floor(minutes / Math.max(0.5, gap)) + 1));
    }
    return n;
  }
  /** The kinds the starter might strike up with someone, each with its weight. */
  choices(s, o) {
    const w = this.w, c = this.c;
    const ctx = w.ctx(s, { target: o.id, place: s.place });
    const out = [];
    w.peek(() => {
      for (const def of this.kinds.values()) {
        if (def.weight === 0) continue;
        if (!w.lang.all(def.who, ctx) || !w.lang.all(def.to, ctx) || !w.lang.all(def.if, ctx)) continue;
        if (def.gives && !(w.have(s, def.gives) > 0)) continue;
        if (def.teaches && !this.lesson(s, o)) continue;
        let weight = 1;
        if (typeof def.weight === "number") weight = def.weight;
        else if (typeof def.weight === "function") weight = Number(def.weight(ctx)) || 0;
        else if (def.weight) for (const k of def.weight) weight *= w.mind.consider(k, ctx);
        if (def.relieves) {
          let pull = 0;
          for (const need in def.relieves) if (w.needs.has(need)) pull += def.relieves[need] * w.mind.urgency(s, need);
          weight *= 1 + pull * c.needPull;
        }
        if (def.tags?.includes("hostile")) weight *= this.knob("quarrels", s.id);
        if (weight > 0) out.push({ def, weight: round(weight, 6) });
      }
    });
    return out;
  }
  /** The skill a teacher could teach someone: their best, well enough over the other's. */
  lesson(t, o) {
    const w = this.w;
    let best = null, gap = this.c.teachOver;
    for (const skill of Object.keys(w.skills.of(t))) {
      const g = w.skills.level(t, skill) - w.skills.level(o, skill);
      if (g >= gap) {
        gap = g;
        best = skill;
      }
    }
    return best;
  }
  // -------------------------------------------------------------------------
  // Exchanges: how a turn lands
  // -------------------------------------------------------------------------
  /**
   * How words of a kind from the speaker land with the listener now: the
   * score from the listener's side with its parts, and where it falls,
   * before the luck of the turn. A look: it changes nothing.
   */
  weigh(kind, speaker, listener, opts = {}) {
    const def = this.kinds.get(kind);
    const s = this.w.s.people[speaker], l = this.w.s.people[listener];
    if (!def || !s || !l) return null;
    const parts = this.w.peek(() => this.parts(def, s, l, opts.place ?? s.place, opts.topic, opts.subject, opts.manner));
    const score = round(parts.reduce((a, [, v]) => a + v, 0), 4);
    return { score, outcome: this.outcome(score), parts };
  }
  /** The parts of how words land with the listener (the speaker is the target), each a setting's weight. */
  parts(def, s, l, place, _topic, _subject, _manner) {
    const w = this.w, c = this.c, L = w.lang;
    const out = [];
    const add = (name, v) => {
      if (v && isFinite(v)) out.push([name, round(v, 4)]);
    };
    const lctx = w.ctx(l, { target: s.id, place: place ?? null });
    const sctx = w.ctx(s, { target: l.id, place: place ?? null });
    add("base", def.base ?? 0);
    if (def.lands) add("lands", landing(L, 0, def.lands, lctx));
    const ap = def.approach ? w.voice?.approaches.get(def.approach) : void 0;
    if (ap) add("approach", landing(L, ap.base ?? 0, ap.lands, lctx));
    if (def.knack) add("knack", landing(L, 0, def.knack, sctx));
    let nat = 0, skill = 0;
    for (const role in def.traits || {}) nat += def.traits[role] * (this.nature(l, role) - 0.5) * 2;
    for (const role in def.skill || {}) skill += def.skill[role] * (this.nature(s, role) - 0.5) * 2;
    add("nature", nat);
    add("skill", skill);
    const fs = w.fellowship, rv = w.reverie;
    if (fs) {
      add("regard", c.regardWeight * fs.regard(l.id, s.id));
      add("compat", c.compatWeight * fs.compat(l.id, s.id));
      if (def.tags?.includes("romantic")) add("attraction", c.attractWeight * fs.attraction(l.id, s.id));
    }
    if (rv) {
      add("mood", c.moodWeight * (rv.mood(l.id) - 0.5) * 2);
      add("stress", -c.stressWeight * rv.stress(l.id));
    }
    if (def.relieves) {
      let need = 0;
      for (const n in def.relieves) if (w.needs.has(n)) need += def.relieves[n] * w.mind.urgency(l, n);
      add("need", c.needWeight * need);
    }
    add("grudge", -c.grudgeWeight * this.animosity(l.id, s.id));
    const row = this.st?.pairs[pairKey(l.id, s.id)]?.row;
    if (row !== void 0) add("row", -c.rowWeight * Math.exp(-(w.s.now - row) / Math.max(1, c.rowMinutes)));
    const cs = w.cityspeak;
    if (cs && place) add("room", c.roomWeight * (cs.room(place) - 0.5) * 2);
    return out;
  }
  /** The luck of a turn: two draws, so mostly near nothing. */
  luck(r) {
    return (r.next() + r.next() - 1) * this.c.spread;
  }
  // -------------------------------------------------------------------------
  // Exchanges: turns
  // -------------------------------------------------------------------------
  /** Are they all still together and awake, where it began? */
  together(ex) {
    const w = this.w;
    const root = ex.place ? w.ring.root(ex.place) : null;
    for (const id of ex.who) {
      const p = w.s.people[id];
      if (!this.free(p)) return id;
      if (root && w.ring.root(p.place) !== root) return id;
    }
    return null;
  }
  /** Who speaks to whom next, and the step. */
  nextStep(ex) {
    const steps = ["open", "reply", "more", "back"];
    const [a, b] = ex.who;
    const who = ex.n % 2 === 0 ? a : b;
    return { who, to: who === a ? b : a, step: steps[ex.n % steps.length] };
  }
  /** One turn: who speaks, how it lands, what it changes, and when the next comes. */
  turn(ex) {
    const w = this.w, c = this.c;
    const def = this.kinds.get(ex.kind);
    if (!def) {
      this.finish(ex, "ended");
      return;
    }
    const gone = this.together(ex);
    if (gone !== null) {
      this.finish(ex, "parted", gone);
      return;
    }
    if (ex.until !== void 0 && w.s.now > ex.until + 1e-6) {
      this.finish(ex, "parted");
      return;
    }
    const r = this.stream();
    const { who, to, step } = this.nextStep(ex);
    const s = w.s.people[who], l = w.s.people[to];
    const parts = this.parts(def, s, l, ex.place);
    const score = round(parts.reduce((acc, [, v]) => acc + v, 0) + this.luck(r), 4);
    const landed = this.outcome(score);
    ex.heard[to] = ex.heard[to] === void 0 ? score : round(ex.heard[to] + (score - ex.heard[to]) * c.sway, 4);
    ex.score = ex.score === null ? score : round(ex.score + (score - ex.score) * c.sway, 4);
    ex.last = landed;
    if (this.bad(landed)) ex.sour++;
    ex.n++;
    const last = ex.n >= ex.turns;
    this.tell(ex, { who, to, step, landed, end: last });
    if (last) {
      this.finish(ex, "done");
      return;
    }
    this.schedule(ex, r);
  }
  /** Puts the next turn on the clock. */
  schedule(ex, r) {
    const [lo, hi] = this.c.turnGap;
    ex.next = round(this.w.s.now + Math.max(0.5, r.range(lo, hi ?? lo)), 4);
    this.w.clock.schedule({ t: ex.next, k: "module", ref: this.name, data: { ex: ex.id, n: ex.n } });
  }
  /** Tells the game about a turn. */
  tell(ex, t) {
    const line = `${this.kinds.get(ex.kind)?.line ?? ex.kind}.${t.step}`;
    const turn = {
      id: ex.id,
      kind: ex.kind,
      n: ex.n,
      who: t.who,
      to: t.to,
      step: t.step,
      topic: null,
      landed: t.landed,
      outcome: ex.score === null ? null : this.outcome(ex.score),
      line,
      end: t.end
    };
    this.w.emit("bree:turn", turn);
  }
  /** The exchange as the game sees it. */
  view(ex) {
    const v = {
      id: ex.id,
      kind: ex.kind,
      first: ex.first,
      who: ex.who.slice(),
      place: ex.place,
      t: ex.t,
      why: ex.why,
      turn: ex.n,
      turns: ex.turns,
      outcome: ex.score === null ? null : this.outcome(ex.score),
      score: ex.score,
      topic: ex.topic ? { id: ex.topic.id, ...ex.topic.subject !== void 0 ? { subject: ex.topic.subject } : {} } : null,
      manners: { ...ex.manners }
    };
    if (ex.by) v.by = ex.by;
    return v;
  }
  /** The exchange someone's in (by its id, or someone in it), as the game sees it, or null. */
  exchange(which) {
    const ex = typeof which === "number" ? this.st?.ex[which] : this.exOf(which);
    return ex ? this.view(ex) : null;
  }
  /** Every exchange in progress. */
  exchanges() {
    const st = this.st;
    return st ? Object.keys(st.ex).map((k) => this.view(st.ex[k])) : [];
  }
  /** Finished exchanges (the last config.recent), newest last; those of a pair, with both given. */
  history(a, b) {
    return (this.st?.recent || []).filter((f) => (!a || f.who.includes(a)) && (!b || f.who.includes(b))).map((f) => ({ ...f, who: f.who.slice(), outcomes: { ...f.outcomes } }));
  }
  // -------------------------------------------------------------------------
  // Exchanges: the end, and what it leaves
  // -------------------------------------------------------------------------
  /** Ends an exchange: what each outcome does, for each of them. */
  finish(ex, why, left) {
    var _a;
    const w = this.w, c = this.c, st = this.mut();
    delete st.ex[ex.id];
    for (const id of ex.who) if (st.of[id] === ex.id) delete st.of[id];
    const def = this.kinds.get(ex.kind);
    const outcome = this.outcome(ex.score ?? 0);
    const outcomes = {};
    for (const id of ex.who) outcomes[id] = ex.heard[id] === void 0 ? outcome : this.outcome(ex.heard[id]);
    if (def && ex.n > 0) this.leave(ex, def, outcomes, why === "left" ? left : void 0);
    const [a, b] = ex.who;
    const pk = pairKey(a, b);
    const pair = (_a = st.pairs)[pk] || (_a[pk] = { n: 0, last: w.s.now });
    pair.n++;
    pair.last = w.s.now;
    pair.outcome = outcome;
    if (!this.atLeast(outcome, "awkward")) {
      pair.row = w.s.now;
      if (ex.by) pair.by = ex.by;
      else delete pair.by;
    }
    const done = { id: ex.id, kind: ex.kind, first: ex.first, who: ex.who.slice(), place: ex.place, t: ex.t, end: w.s.now, outcome, outcomes, n: ex.n, why };
    if (ex.by) done.by = ex.by;
    if (left) done.left = left;
    if (ex.mediator) done.mediator = ex.mediator;
    st.recent.push(done);
    while (st.recent.length > Math.max(0, c.recent)) st.recent.shift();
    w.log("exchanged", a, { id: ex.id, kind: ex.kind, with: ex.who.slice(1), outcome, turns: ex.n, why });
    w.emit("bree:end", { ...done, who: done.who.slice(), outcomes: { ...outcomes } });
  }
  /** What an exchange leaves each of them: regard, attraction, feelings, memories, sentiments, relief, and what the kind does. */
  leave(ex, def, outcomes, left) {
    const w = this.w, c = this.c, fs = w.fellowship, rv = w.reverie;
    const who = ex.who, starter = who[0];
    const group = who.length > 2;
    const share = group ? c.groupShare : 1;
    const romantic = !!def.tags?.includes("romantic");
    const frac = clamp(ex.n / Math.max(1, ex.turns));
    const long = ex.n >= c.longTurns;
    for (const x of who) {
      const p = w.s.people[x];
      if (!p) continue;
      const o = outcomes[x];
      const y = x === starter ? who[1] : starter;
      if (fs) for (const z of who) {
        if (z === x || !group && z !== y) continue;
        let d = (c.regard[o] ?? 0) * (def.regard ?? 1) * share;
        d *= d > 0 ? this.knob("warmth", x) : this.knob("quarrels", x);
        if (d) fs.applyRegard(x, z, round(d, 4));
        if (romantic && z === y) {
          let a = (c.attraction[o] ?? 0) * (def.attraction ?? 1);
          a *= a > 0 ? this.knob("warmth", x) : this.knob("quarrels", x);
          if (a) fs.applyAttraction(x, z, round(a, 4));
        }
      }
      const does = [];
      const own = def.on?.[o];
      does.push({ feel: own && "feel" in own ? own.feel : c.feel[o] ?? null, memory: own?.memory ?? c.memory[o] ?? 0, sentiment: own?.sentiment, then: own?.then });
      if (long && this.atLeast(o, "fine")) {
        const lg = def.on?.long;
        does.push({ feel: lg && "feel" in lg ? lg.feel : c.feel.long ?? null, memory: lg?.memory ?? c.memory.long ?? 0, sentiment: lg?.sentiment, then: lg?.then });
      }
      if (left === x) {
        const lf = def.on?.left;
        does.push({ feel: lf && "feel" in lf ? lf.feel : c.feel.left ?? null, memory: lf?.memory ?? c.memory.left ?? 0, sentiment: lf?.sentiment, then: lf?.then });
        if (fs && c.leftRegard) fs.applyRegard(x, y, round(c.leftRegard * (c.leftRegard > 0 ? this.knob("warmth", x) : this.knob("quarrels", x)), 4));
      }
      if (def.on?.end) does.push(def.on.end);
      const ctx = w.ctx(p, { target: y, place: ex.place });
      for (const d of does) {
        const f = Array.isArray(d.feel) ? d.feel[x === starter ? 0 : 1] : d.feel;
        if (f && rv) rv.applyFeel(x, f, y);
        if (rv && (d.memory ?? 0) >= 1) rv.applyRemember(x, { k: `${ex.kind}:${o}`, about: group ? void 0 : y, place: ex.place ?? void 0, imp: d.memory, text: `${def.label ?? ex.kind} with ${w.s.people[y]?.name ?? y}` });
        if (d.sentiment && fs && (x !== starter || d.sentiment.both)) fs.applySentiment(x, y, d.sentiment.label, d.sentiment.by ?? c.regard[o] ?? 0, d.sentiment.minutes);
        if (d.then) w.lang.applyAll(d.then, ctx);
      }
      if (def.relieves) for (const need in def.relieves) {
        if (!w.needs.has(need)) continue;
        w.mind.setLevel(p, need, w.mind.level(p, need) - def.relieves[need] * frac);
      }
    }
    const other = w.s.people[who[1]];
    const s = w.s.people[starter];
    if (s && other && this.atLeast(outcomes[who[1]], "fine")) {
      if (def.deed) {
        const data = { for: other.id };
        if (ex.place) data.place = ex.place;
        w.log("did", starter, { verb: def.deed, for: other.id });
        for (const m of w.hooks) m.did?.(starter, def.deed, data);
      }
      if (def.gives && w.have(s, def.gives) > 0) {
        w.takeItem(s, def.gives, 1);
        other.inv[def.gives] = (other.inv[def.gives] || 0) + 1;
      }
      if (def.owes && w.wormtongue) w.wormtongue.applyOwe(starter, other.id, def.owes);
      if (def.teaches) {
        const skill = this.lesson(s, other);
        if (skill) w.skills.applyTrain(other, skill, def.teaches * frac);
      }
    }
  }
  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------
  /** Two people spend time together: now and then one strikes up an exchange. */
  met(a, b, _place, minutes) {
    if (!this.kinds.size) return;
    const c = this.c;
    const k = c.strike * this.talkOf([a.id, b.id]);
    if (!(k > 0) || this.exOf(a.id) || this.exOf(b.id) || !this.free(a) || !this.free(b)) return;
    const r = this.stream();
    if (!r.chance(k)) return;
    const ta = this.nature(a, "talkative"), tb = this.nature(b, "talkative");
    const [s, o] = r.chance((0.5 + ta) / Math.max(1e-6, 1 + ta + tb)) ? [a, b] : [b, a];
    const pick = r.weighted(this.choices(s, o), (x) => x.weight);
    if (pick) this.begin(pick.def.id, [s.id, o.id], "meet", minutes);
  }
  /** An action that interacts (its `interact`) begins its exchange with its target, over its length. */
  started(p, d) {
    if (d.kind !== "act" || !d.target) return;
    const kind = this.w.actions.get(d.action)?.interact;
    if (!kind || !this.kinds.has(kind) || this.exOf(p.id) || this.exOf(d.target)) return;
    const o = this.w.s.people[d.target];
    if (!this.free(o) || !p.place || this.w.ring.root(o.place) !== this.w.ring.root(p.place)) return;
    this.begin(kind, [p.id, o.id], "action", d.end - this.w.s.now);
  }
  /** The next turn of an exchange comes due. */
  timer(item) {
    const id = Number(item.data?.ex);
    const ex = this.st?.ex[id];
    if (!ex || ex.n !== Number(item.data?.n)) return;
    this.turn(ex);
  }
  day() {
    const st = this.st;
    if (!st) return;
    const floor = this.c.grudgeFloor;
    for (const a of Object.keys(st.g)) {
      for (const b of Object.keys(st.g[a])) if (this.grudge(a, b) < floor) delete st.g[a][b];
      if (!Object.keys(st.g[a]).length) delete st.g[a];
    }
    for (const k of Object.keys(st.feuds)) if (this.feudStrength(st.feuds[k]) < floor) delete st.feuds[k];
  }
  removed(p) {
    const st = this.st;
    if (!st) return;
    const ex = this.exOf(p.id);
    if (ex) this.finish(ex, "gone", p.id);
    delete st.g[p.id];
    for (const a of Object.keys(st.g)) {
      delete st.g[a][p.id];
      if (!Object.keys(st.g[a]).length) delete st.g[a];
    }
    for (const k of Object.keys(st.feuds)) if (st.feuds[k].a === p.id || st.feuds[k].b === p.id) delete st.feuds[k];
  }
};

// tyrell/src/tools/voightkampff.ts
var builtins = {
  "nobody-starves": {
    name: "nobody-starves",
    sample(w, acc, fail) {
      const since = acc.starve || (acc.starve = {});
      const vital = [...w.needs.values()].filter((d) => (d.urgent ?? w.cfg.urgent) <= 1).map((d) => d.id);
      for (const p of w.people()) for (const n of vital) {
        const k = p.id + ":" + n;
        if (w.mind.level(p, n) >= 0.999) {
          since[k] ?? (since[k] = w.now);
          if (w.now - since[k] > 12 * HOUR && !acc["starved:" + k]) {
            acc["starved:" + k] = true;
            fail(`${p.id}'s ${n} has been at its worst for over 12 hours (day ${w.day})`);
          }
        } else delete since[k];
      }
    }
  },
  capacity: {
    name: "capacity",
    sample(w, _acc, fail) {
      for (const def of w.ring.defs.values()) for (const slot in def.slots || {}) {
        const cap = w.ring.capacity(def.id, slot);
        const n = w.ring.holders(def.id, slot).length;
        if (cap > 0 && n > cap) fail(`${def.id}.${slot} holds ${n} (capacity ${cap}) at ${w.now}`);
      }
    }
  },
  "everyone-sleeps": {
    name: "everyone-sleeps",
    end(w, _acc, fail) {
      const sleepy = [...w.actions.values()].filter((a) => a.tags?.includes("sleep")).map((a) => a.id);
      if (!sleepy.length) return;
      const started = w.westmarch.find({ k: "started" });
      const days = /* @__PURE__ */ new Map();
      for (const e of started) if (e.who && sleepy.includes(String(e.d?.action))) {
        const set = days.get(e.who) || /* @__PURE__ */ new Set();
        set.add(Math.floor(e.t / DAY));
        days.set(e.who, set);
      }
      const first = started.length ? Math.floor(started[0].t / DAY) : 0;
      const last = Math.floor(w.now / DAY) - 1;
      for (const p of w.people()) {
        for (let d = first + 1; d <= last; d++) {
          const s = days.get(p.id);
          if (!s || !s.has(d) && !s.has(d - 1)) {
            fail(`${p.id} didn't sleep around day ${d}`);
            break;
          }
        }
      }
    }
  },
  "no-stuck": {
    name: "no-stuck",
    sample(w, acc, fail) {
      var _a;
      const idle = acc.idle || (acc.idle = {});
      for (const p of w.people()) {
        if (!p.doing) {
          fail(`${p.id} is doing nothing at all at ${w.now}`);
          continue;
        }
        if (p.doing.layer === "idle") {
          idle[_a = p.id] ?? (idle[_a] = w.now);
          if (w.now - idle[p.id] > 4 * HOUR && !acc["stuck:" + p.id]) {
            acc["stuck:" + p.id] = true;
            fail(`${p.id} has been idle for over 4 hours (day ${w.day})`);
          }
        } else delete idle[p.id];
      }
    }
  }
};
function run(opts) {
  const seed = opts.seed ?? "voight-kampff";
  const days = opts.days ?? 3;
  const every = opts.every ?? 30;
  const names = opts.checks ?? ["nobody-starves", "capacity", "everyone-sleeps", "no-stuck", "deterministic", "esper", "save-load"];
  const checks = [];
  const special = /* @__PURE__ */ new Set();
  for (const c of names) {
    if (typeof c !== "string") {
      checks.push(c);
      continue;
    }
    if (builtins[c]) checks.push(builtins[c]);
    else special.add(c);
  }
  const failures = [];
  const fail = (msg) => {
    if (failures.length < 200) failures.push(msg);
  };
  const t0 = Date.now();
  const w = opts.build(seed);
  const start = w.now;
  const end = start + days * DAY;
  const acc = {};
  const moods = [];
  const places = {};
  const needMax = {};
  let decisions = 0;
  w.on("decided", () => {
    decisions++;
  });
  for (let t = start + every; t <= end + 1e-6; t += every) {
    w.advanceTo(t);
    for (const c of checks) c.sample?.(w, acc, fail);
    const h = Math.floor(hourOf(w.now));
    const day = w.day;
    let rec = moods.find((m) => m.day === day);
    if (!rec) {
      rec = { day, vals: [] };
      moods.push(rec);
    }
    for (const p of w.people()) {
      if (w.reverie) rec.vals.push(w.reverie.mood(p.id));
      const where = p.doing?.kind === "travel" ? "(walking)" : p.place ?? "(nowhere)";
      const slot = places[h] || (places[h] = {});
      slot[where] = (slot[where] || 0) + 1;
      for (const n of w.needs.keys()) needMax[n] = Math.max(needMax[n] ?? 0, round(w.mind.level(p, n), 3));
    }
  }
  for (const c of checks) c.end?.(w, acc, fail);
  const hash2 = w.hash();
  const decided = decisions;
  const counts = {};
  let total = 0;
  for (const e of w.westmarch.find({ k: "started" })) {
    const a = String(e.d?.action);
    counts[a] = (counts[a] || 0) + 1;
    total++;
  }
  const actions = {};
  for (const k of Object.keys(counts).sort()) actions[k] = round(counts[k] / Math.max(1, total), 4);
  const mood = moods.map((m) => {
    const mean = m.vals.reduce((a, b) => a + b, 0) / Math.max(1, m.vals.length);
    const sd = Math.sqrt(m.vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, m.vals.length));
    return { day: m.day, mean: round(mean, 4), sd: round(sd, 4) };
  });
  if (special.has("deterministic")) {
    const again = opts.build(seed);
    again.advanceTo(end);
    if (again.hash() !== hash2) fail(`the same seed gave a different world (${again.hash()} vs ${hash2})`);
  }
  if (special.has("esper") && w.esper.on) {
    const back = Math.max(w.esper.earliest(), w.now - 6 * HOUR);
    const before = w.hash();
    w.seek(back);
    w.seek(end);
    if (w.hash() !== before) fail(`going back to ${back} and forward again changed the world`);
  }
  if (special.has("save-load")) {
    const saved = JSON.stringify(w.save());
    const copy = opts.build(seed);
    copy.load(saved);
    if (copy.hash() !== w.hash()) fail("a saved and loaded world differs from the original");
    w.advance(3 * HOUR);
    copy.advance(3 * HOUR);
    if (copy.hash() !== w.hash()) fail("a loaded world ran differently from the original");
  }
  return {
    seed,
    days,
    passed: failures.length === 0,
    failures,
    checks: names.map((c) => typeof c === "string" ? c : c.name),
    stats: { actions, mood, places, needs: needMax, decisions: decided, ms: Date.now() - t0 },
    hash: hash2
  };
}
function compare2(report, baseline, tolerance = 0.05) {
  const out = [];
  const keys = /* @__PURE__ */ new Set([...Object.keys(report.stats.actions), ...Object.keys(baseline.stats.actions)]);
  for (const k of [...keys].sort()) {
    const a = report.stats.actions[k] ?? 0, b = baseline.stats.actions[k] ?? 0;
    if (Math.abs(a - b) > tolerance) out.push(`${k}: ${round(a, 3)} against ${round(b, 3)}`);
  }
  const mean = (r) => r.stats.mood.reduce((acc, m) => acc + m.mean, 0) / Math.max(1, r.stats.mood.length);
  if (Math.abs(mean(report) - mean(baseline)) > tolerance) out.push(`mood: ${round(mean(report), 3)} against ${round(mean(baseline), 3)}`);
  return out;
}

// tyrell/src/index.ts
var VERSION = "2.0.0";
var MODULES = ["reverie", "fellowship", "wormtongue", "cityspeak", "mentat", "gaff", "ceres", "cradle", "joi", "athelas", "delos", "voice", "bree"];
function create(opts = {}) {
  const names = opts.modules ?? [...MODULES];
  const cfg = opts.moduleConfig || {};
  const make = {
    reverie: () => new Reverie(cfg.reverie),
    fellowship: () => new Fellowship(cfg.fellowship),
    wormtongue: () => new Wormtongue(cfg.wormtongue),
    cityspeak: () => new Cityspeak(cfg.cityspeak),
    mentat: () => new Mentat(cfg.mentat),
    gaff: () => new Gaff(cfg.gaff),
    ceres: () => new Ceres(cfg.ceres),
    cradle: () => new Cradle(cfg.cradle),
    joi: () => new Joi(cfg.joi),
    athelas: () => new Athelas(cfg.athelas),
    delos: () => new Delos(cfg.delos),
    voice: () => new Voice(cfg.voice),
    bree: () => new Bree(cfg.bree)
  };
  const modules = [];
  for (const n of MODULES) if (names.includes(n)) modules.push(make[n]());
  for (const n of names) if (!MODULES.includes(n)) throw new Error(`Tyrell: no module named '${n}'`);
  if (opts.extra) modules.push(...opts.extra);
  return new World(opts, modules);
}
var VoightKampff = { run, compare: compare2 };
var MODULE_DEFAULTS = {
  reverie: DEFAULT_REVERIE,
  fellowship: DEFAULT_FELLOWSHIP,
  wormtongue: DEFAULT_WORMTONGUE,
  cityspeak: DEFAULT_CITYSPEAK,
  mentat: DEFAULT_MENTAT,
  gaff: DEFAULT_GAFF,
  ceres: DEFAULT_CERES,
  cradle: DEFAULT_CRADLE,
  joi: DEFAULT_JOI,
  athelas: DEFAULT_ATHELAS,
  delos: DEFAULT_DELOS,
  voice: DEFAULT_VOICE,
  bree: DEFAULT_BREE
};
