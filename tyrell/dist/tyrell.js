/* Tyrell 1.1.0: a minds engine for games full of people. Built from src/ by scripts/build.mjs; don't edit. */
"use strict";
var Tyrell = (() => {
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

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    Ceres: () => Ceres,
    Cityspeak: () => Cityspeak,
    Cradle: () => Cradle,
    DAY: () => DAY,
    DEFAULT_CONFIG: () => DEFAULT_CONFIG,
    Fellowship: () => Fellowship,
    Gaff: () => Gaff,
    HOUR: () => HOUR,
    Joi: () => Joi,
    MIGRATIONS: () => MIGRATIONS,
    MODULES: () => MODULES,
    Mentat: () => Mentat,
    Reverie: () => Reverie,
    SCHEMA: () => SCHEMA,
    Stream: () => Stream,
    VERSION: () => VERSION,
    VoightKampff: () => VoightKampff,
    World: () => World,
    Wormtongue: () => Wormtongue,
    clamp: () => clamp,
    create: () => create,
    curveAt: () => curveAt,
    dayOf: () => dayOf,
    hash: () => hash,
    hash01: () => hash01,
    hourOf: () => hourOf,
    inHours: () => inHours
  });

  // src/core/conds.ts
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

  // src/core/util.ts
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

  // src/core/ring.ts
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

  // src/core/bicameral.ts
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
      let v;
      if (rate !== void 0 && d && t > d.start) {
        const from = Math.max(ns.t, d.start);
        v = ns.v + def.rise * Math.max(0, d.start - ns.t) / HOUR + def.rise * rate * (t - from) / HOUR;
      } else v = ns.v + def.rise * (t - ns.t) / HOUR;
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
        const from = Math.max(ns.t, d.start);
        const v = ns.v + def.rise * Math.max(0, d.start - ns.t) / HOUR + def.rise * a.rates[need] * Math.max(0, now2 - from) / HOUR;
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
      for (const [id, def] of this.w.needs) if (!p.needs[id]) p.needs[id] = { v: def.start ?? 0.2, t: this.w.s.now };
    }
    quality(place) {
      return this.w.ring.get(place)?.quality ?? 1;
    }
    /** The urgency of a need: its level through its curve. */
    urgency(p, need, t = this.w.s.now) {
      return curveAt(this.w.needs.get(need)?.curve ?? "pow1.5", this.level(p, need, t));
    }
    /**
     * When the next need will cross a line that matters: urgent, desperate, or
     * at its worst (Infinity if none will). Each can lift an option's rank.
     */
    urgentAt(p) {
      let best = Infinity;
      const a = p.doing?.kind === "act" ? this.w.actions.get(p.doing.action) : void 0;
      const relieving = a?.relieves;
      for (const [id, def] of this.w.needs) {
        if (relieving && relieving[id] !== void 0) continue;
        const u = def.urgent ?? this.w.config.urgent;
        const rise = def.rise * (a?.rates?.[id] ?? 1);
        if (u > 1 || rise <= 0) continue;
        const v = this.level(p, id);
        for (const line of [u, Math.max(u, 0.97), 1]) {
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
      return clamp(ns.v + def.rise * (this.w.s.now - ns.t) / HOUR);
    }
    urgencyAt(need, v) {
      return curveAt(this.w.needs.get(need)?.curve ?? "pow1.5", v);
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
      const c = this.w.config;
      const h = p.habits[id] || [1, 1];
      let fast = h[0], slow = h[1];
      const ratio = expected > 1e-6 ? clamp(got / expected, 0, 2) : 1;
      fast += c.habitFast * (ratio - 1) + bonus;
      fast += 0.02 * (1 - fast);
      fast = clamp(fast, c.habitMin, c.habitMax);
      slow = clamp(slow + c.habitSlow * (fast - slow), c.habitMin, c.habitMax);
      p.habits[id] = [round(fast, 5), round(slow, 5)];
    }
    /** A reward or a telling-off: nudges the habit directly. */
    nudge(p, id, amount) {
      const c = this.w.config;
      const h = p.habits[id] || [1, 1];
      const fast = clamp(h[0] + amount, c.habitMin, c.habitMax);
      p.habits[id] = [round(fast, 5), round(clamp(h[1] + amount * 0.25, c.habitMin, c.habitMax), 5)];
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
      const weekday = day % this.w.config.week;
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
        if (job.days && !job.days.includes(startDay % this.w.config.week)) continue;
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
      const d = p.directive;
      if (d && !(d.done && !d.repeat) && !(d.until !== void 0 && d.until <= now2)) {
        out.push({ do: d.do, at: d.at, rank: d.rank ?? 3, layer: "story", until: d.until ?? Infinity, target: d.target });
      }
      const shift = this.shiftAt(p);
      if (shift && p.def.job) out.push({ do: p.def.job.action, at: p.def.job.place, rank: 2, layer: "job", until: shift.until });
      const r = this.routineAt(p);
      if (r) {
        const [, at, act, extra] = r.entry;
        const free = (act === "*" || act === "free") && (at === null || at === void 0 || at === "here");
        if (!free) out.push({ do: act, at, rank: extra?.rank ?? 1, layer: "routine", until: r.until, with: extra?.with, any: act === "*" });
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
        for (const place of places.slice(0, this.w.config.placesPerAction)) {
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
        for (const place of places.slice(0, this.w.config.placesPerAction)) {
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
        for (const place of places.slice(0, this.w.config.placesPerAction)) {
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
      return out.slice(0, 6);
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
      const w = this.w;
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
          base += curveAt(nd.curve ?? "pow1.5", lvl) * Math.min(r, Math.max(lvl, 0.05));
          if (r >= 0.3) {
            const u = nd.urgent ?? w.config.urgent;
            if (lvl >= Math.max(u, 0.97)) lift = Math.max(lift, w.config.desperateRank + (lvl - 0.97) * 10);
            else if (lvl >= u) lift = Math.max(lift, w.config.urgentRank);
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
          if (w.config.compensate && n > 1 && v < 1 && v > 0) v = v + (1 - v) * (1 - 1 / n) * v;
          mul(k.name || (typeof k.input === "string" ? k.input : "consideration"), v);
          if (v <= 0) break;
        }
      }
      mul("habit", this.habit(p, c.id));
      if (travel > 0) mul("travel", 1 / (1 + travel / w.config.travelScale));
      const sleepy = def.tags?.includes("sleep");
      if (!required && p.last === c.id && !sleepy && p.lastEnd !== void 0 && w.s.now - p.lastEnd < 90) mul("did it last", w.config.repeat);
      if (p.doing && p.doing.action === c.id && p.doing.place === c.place) mul("carrying on", w.config.inertia);
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
      const cfg = this.w.config;
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

  // src/core/entmoot.ts
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
      const end = w.s.now + w.config.idle;
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
        const minutes = Number(c.id.slice(6)) || w.config.idle;
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
      if (a && frac > 0.2) w.mind.learn(p, a.id, got, expected);
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
        p.cool[backoffKey(failed.action, failed.place)] = now2 + w.config.backoff;
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
      const boundary = w.mind.nextBoundary(p);
      if (boundary < d.end - 0.01) this.schedule({ t: boundary, k: "think", who: p.id, data: { mode: "boundary" } });
      const urge = w.mind.urgentAt(p);
      if (urge < d.end - 0.01) this.schedule({ t: Math.max(w.s.now + 1, urge), k: "think", who: p.id, data: { mode: "urge" } });
    }
    /** People at the same place meet: modules hear about it (regard, gossip, talk). */
    meet(p) {
      const w = this.w;
      const d = p.doing;
      if (!d || d.kind !== "act" || !d.place) return;
      const others = w.ring.present(d.place).filter((id) => id !== p.id);
      if (!others.length) return;
      const r = w.stream(p);
      const chosen = others.length <= 3 ? others : r.shuffle(others).slice(0, 3);
      for (const id of chosen) {
        const o = w.s.people[id];
        if (!o.doing || o.doing.kind !== "act") continue;
        const minutes = Math.min(d.end, o.doing.end) - w.s.now;
        if (minutes < 3) continue;
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
      for (const id in p.needs) p.needs[id] = { v: Math.min(p.needs[id].v, 0.4), t: w.s.now };
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

  // src/core/esper.ts
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

  // src/core/westmarch.ts
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
      const over = log.length - w.config.logSize;
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

  // src/tools/palantir.ts
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
      if (list.length > this.w.config.decisions) list.shift();
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

  // src/core/strangers.ts
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
      for (let k = 4; k >= 0; k--) {
        const hh = H - k;
        const hourOfDay = (hh % 24 + 24) % 24;
        const count = Array.isArray(def.perHour) ? def.perHour[hourOfDay] ?? 0 : def.perHour;
        for (let i = 0; i < count; i++) {
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

  // src/core/world.ts
  var SCHEMA = 2;
  var DEFAULT_CONFIG = {
    minutesPerSecond: 1,
    week: 7,
    urgent: 0.85,
    urgentRank: 1.5,
    desperateRank: 2.5,
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
    habitFast: 0.25,
    habitSlow: 0.05,
    habitMin: 0.25,
    habitMax: 4,
    compensate: true
  };
  var World = class {
    constructor(opts, modules) {
      this.lang = new Lang();
      this.needs = /* @__PURE__ */ new Map();
      this.actions = /* @__PURE__ */ new Map();
      this.tasks = /* @__PURE__ */ new Map();
      this.deeds = /* @__PURE__ */ new Map();
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
      this.registerCore();
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
      return this.day % this.config.week;
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
      for (const [nid, nd] of this.needs) needs[nid] = { v: clamp(def.needs?.[nid] ?? nd.start ?? 0.2), t: this.s.now };
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
      L.term("trait", (c, a) => c.person?.def.traits?.[a] ?? 0.5);
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
    }
  };
  var IMMEDIATE = /* @__PURE__ */ new Set(["person", "promote", "say", "birth", "recollect", "social", "draw"]);
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

  // src/modules/reverie.ts
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
    stressLong: 7 * DAY
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
        w = def.weight * Math.pow(def.stackMul ?? 0.8, same.length);
        const f = { id: feeling, t: now2, until: now2 + def.minutes, w: round(w, 4) };
        if (cause) f.cause = cause;
        list.push(f);
      }
      this.st.f[id] = list;
      const stress = def.stress ?? (def.weight < 0 ? -def.weight * 0.5 : 0);
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
      let m = this.config.base;
      for (const f of this.feelings(id)) m += f.weight;
      let pen = 0, n = 0;
      for (const need of this.w.needs.keys()) {
        pen += this.w.mind.urgency(p, need);
        n++;
      }
      if (n) m -= pen / n * this.config.needWeight * 2;
      return round(clamp(m), 4);
    }
    /** The one named emotion showing now ('fine' when nothing stands out). */
    emotion(id) {
      const sums = /* @__PURE__ */ new Map();
      for (const f of this.feelings(id)) if (f.emotion) sums.set(f.emotion, (sums.get(f.emotion) || 0) + Math.abs(f.weight));
      const p = this.w.s.people[id];
      if (p) for (const [nid, nd] of this.w.needs) {
        if (!nd.emotion) continue;
        const lvl = this.w.mind.level(p, nid);
        if (lvl > 0.7) sums.set(nd.emotion, (sums.get(nd.emotion) || 0) + (lvl - 0.7) * 0.8);
      }
      let best = "fine", top = this.config.emotionFloor;
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
      return round(clamp(s * 0.6 + l * 0.6), 4);
    }
    stressParts(id) {
      const cur = this.st.st[id];
      if (!cur) return [0, 0];
      const dt = this.w.s.now - cur[2];
      const s = cur[0] * Math.pow(0.5, dt / this.config.stressShort);
      const l = cur[1] * Math.pow(0.5, dt / this.config.stressLong);
      return [s, l];
    }
    addStress(id, amount) {
      const [s, l] = this.stressParts(id);
      const ns = clamp(s + amount);
      const nl = clamp(l + amount * 0.15 + (ns > 0.6 ? 0.02 : 0));
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
      const mem = { k: m.k, t: this.w.s.now, imp: clamp(m.imp ?? kind?.importance ?? 5, 1, 10), recalls: 0 };
      if (m.about) mem.about = m.about;
      if (m.place) mem.place = m.place;
      if (m.text) mem.text = m.text;
      const list = (_a = this.st.m)[id] || (_a[id] = []);
      list.push(mem);
      const loose = list.filter((x) => !x.core);
      if (loose.length > this.config.memoryCap) {
        let worst = loose[0];
        for (const x of loose) if (this.strength(x) < this.strength(worst)) worst = x;
        list.splice(list.indexOf(worst), 1);
      }
    }
    /** How strongly a memory is held now: importance, faded by time. Core memories don't fade. */
    strength(m) {
      if (m.core) return m.imp;
      const hours = (this.w.s.now - m.t) / HOUR;
      return m.imp * Math.pow(this.config.memoryDecay, hours);
    }
    /** Someone's memories, strongest first. */
    memories(id) {
      return (this.st.m[id] || []).slice().sort((a, b) => this.strength(b) - this.strength(a));
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
      const out = list.sort((a, b) => this.strength(b) - this.strength(a)).slice(0, n);
      for (const m of out) {
        m.recalls++;
        if (!m.core && m.recalls >= 3 && m.imp >= 7) this.maybeCore(id, m);
      }
      return out.map((m) => ({ ...m }));
    }
    maybeCore(id, m) {
      var _a, _b;
      const p = this.w.s.people[id];
      if (!p) return;
      const cores = (this.st.m[id] || []).filter((x) => x.core).length;
      if (cores >= this.config.coreCap) return;
      if (!this.w.stream(p).chance(1 / 3)) return;
      m.core = true;
      const kind = this.memoryKinds.get(m.k);
      const shifts = kind?.shifts || {};
      (_a = p.def).traits || (_a.traits = {});
      for (const trait in shifts) {
        const before = p.def.traits[trait] ?? 0.5;
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
      return b && b.str >= this.config.beliefFloor ? b.v : void 0;
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
      return Object.keys(map).map((key2) => ({ key: key2, ...map[key2] })).filter((b) => b.str >= this.config.beliefFloor).sort((a, b) => b.str - a.str || b.t - a.t || (a.key < b.key ? -1 : 1));
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
      const c = this.config;
      const level = mood < c.extreme[0] ? "extreme" : mood < c.major[0] ? "major" : mood < c.minor[0] ? "minor" : null;
      if (!level) return;
      const mtbDays = c[level][1];
      const r = this.w.stream(p);
      if (!r.chance(1 - Math.exp(-dt / (mtbDays * DAY)))) return;
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
      out.push({ id: pick.do, kind, place: places[0] ?? null, rank: 4, layer: "break", weight: 1, parts: [["break", 1]] });
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
        for (const v of a.against) {
          const held = p.def.values?.[v] ?? 0;
          if (held > 0) out.push([`against ${v}`, clamp(1 - held * 0.8, 0.05, 1)]);
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
        this.addStress(p.id, s * 0.3);
        if (this.feelingDefs.has("conscience")) this.applyFeel(p.id, "conscience", a.id);
      }
    }
    ended(p, d, frac, interrupted) {
      if (d.kind !== "act") return;
      const a = this.w.actions.get(d.action);
      if (a?.feels && !interrupted) for (const f of a.feels) this.applyFeel(p.id, f, a.id);
      if (d.layer === "break" && frac > 0.5) {
        const def = [...this.breakDefs.values()].find((b) => b.do === d.action);
        this.applyFeel(p.id, def?.after ?? "catharsis", "a break");
        const [, l] = this.stressParts(p.id);
        this.st.st[p.id] = [0, round(l * 0.7, 5), this.w.s.now];
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
      const st = this.st, now2 = this.w.s.now, c = this.config;
      for (const id in st.f) {
        st.f[id] = st.f[id].filter((f) => f.until > now2);
        if (!st.f[id].length) delete st.f[id];
      }
      for (const id in st.b) {
        const map = st.b[id];
        for (const key2 in map) {
          map[key2].str = round(map[key2].str * (map[key2].src === "saw" ? Math.sqrt(c.beliefDecay) : c.beliefDecay), 4);
          if (map[key2].str < c.beliefFloor) delete map[key2];
        }
      }
      for (const id in st.m) {
        st.m[id] = st.m[id].filter((m) => m.core || this.strength(m) >= 0.5);
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

  // src/modules/fellowship.ts
  var DEFAULT_FELLOWSHIP = {
    meetGain: 0.03,
    compatSpread: 0.6,
    decay: 4e-3,
    sentiments: 4,
    imitation: 0.03,
    forget: 14,
    forgetBelow: 0.05,
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
      this.groups = /* @__PURE__ */ new Map();
      this.config = { ...DEFAULT_FELLOWSHIP, ...cfg };
    }
    init() {
      return { rel: {}, standing: {}, partners: {}, joined: {} };
    }
    get st() {
      return this.w.s.mod.fellowship;
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
        return !!(c.person && o && this.regard(c.person.id, o) >= 0.5);
      });
      L.term("foe", (c, a) => {
        const o = other(c, a);
        return !!(c.person && o && this.regard(c.person.id, o) <= -0.4);
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
      let c = (hash01(this.w.s.seed, "compat", x, y) * 2 - 1) * this.config.compatSpread;
      const va = this.w.s.people[a]?.def.values, vb = this.w.s.people[b]?.def.values;
      if (va && vb) {
        let shared = 0, n = 0;
        for (const k in va) if (vb[k] !== void 0) {
          shared += 1 - Math.abs(va[k] - vb[k]) * 2;
          n++;
        }
        if (n) c += shared / n * 0.3;
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
      return this.relations(a).filter((r) => r.regard > 0.2).slice(0, n).map((r) => r.id);
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
      if (r.s.length > this.config.sentiments) {
        r.s.sort((x, y) => Math.abs(y.by) - Math.abs(x.by));
        r.s.length = this.config.sentiments;
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
      const band = (x) => x < 0.15 ? 0 : x < 0.4 ? 1 : x < 0.7 ? 2 : 3;
      return { fame, infamy, label: this.config.labels[band(fame)][band(infamy)] };
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
      for (const [x, y] of [[a, b], [b, a]]) {
        const r = this.record(x.id, y.id);
        const mood = rv ? rv.mood(x.id) - 0.5 : 0;
        const gain = this.config.meetGain * (minutes / 30) * (1 + this.compat(x.id, y.id) + mood);
        r.r = round(clamp(r.r + clamp(gain, -0.05, 0.08), -1, 1), 4);
        if (this.compat(x.id, y.id) > 0.3 && this.partner(x.id) === void 0) r.a = round(clamp(r.a + gain * 0.5, -1, 1), 4);
        r.met++;
        r.last = this.w.s.now;
        if (y.doing && y.doing.kind === "act" && this.regard(x.id, y.id) > 0.3) {
          const h = x.habits[y.doing.action] || [1, 1];
          x.habits[y.doing.action] = [round(clamp(h[0] + this.config.imitation, this.w.config.habitMin, this.w.config.habitMax), 5), h[1]];
        }
      }
      this.w.log("met", a.id, { target: b.id, minutes: Math.round(minutes) });
    }
    consider(p, c) {
      if (!c.target) return;
      const a = this.w.actions.get(c.id);
      if (!a?.tags?.includes("social")) return;
      return [["regard", round(clamp(1 + this.regard(p.id, c.target) * 0.8 + this.compat(p.id, c.target) * 0.2, 0.1, 2), 4)]];
    }
    did(actor, verb, data) {
      const deed = this.w.deeds.get(verb);
      if (!deed) return;
      const target = data.for ?? data.to ?? data.target;
      if (target) {
        if (deed.regard) this.applyRegard(target, actor, deed.regard);
        if (deed.sentiment) this.applySentiment(target, actor, deed.sentiment, deed.regard ?? 0.1);
        if (deed.fame || deed.infamy) for (const g of this.groupsOf(target)) this.applyStanding(g, actor, deed.fame ?? 0, deed.infamy ?? 0);
      }
      const seen = Array.isArray(data.seenBy) ? data.seenBy : [];
      for (const wid of seen) if (wid !== target && deed.regard) this.applyRegard(wid, actor, deed.regard * 0.4);
    }
    day() {
      const d = this.config.decay, now2 = this.w.s.now, gone = this.config.forget * DAY, below = this.config.forgetBelow;
      for (const k in this.st.rel) {
        const r = this.st.rel[k];
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

  // src/modules/wormtongue.ts
  var DEFAULT_WORMTONGUE = {
    reportChance: 0.6,
    reportDelay: [10, 90],
    recognizeStranger: 0.5,
    gossipChance: 0.45,
    maxHops: 3,
    heatDecay: 0.85,
    lieChance: 0.5
  };
  var Wormtongue = class {
    constructor(cfg = {}) {
      this.name = "wormtongue";
      this.crimes = /* @__PURE__ */ new Map();
      this.config = { ...DEFAULT_WORMTONGUE, ...cfg };
    }
    init() {
      return { heat: {}, reports: [], secrets: {}, favors: {} };
    }
    get st() {
      return this.w.s.mod.wormtongue;
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
      const w = this.w, rv = w.reverie;
      const crime = this.crimes.get(stim.kind);
      const strength = clamp(stim.strength ?? 1);
      for (const wid of stim.seenBy || []) {
        const p = w.s.people[wid];
        if (!p || p.status !== "active" || wid === stim.actor) continue;
        const r = w.stream(p);
        const knows = !!w.fellowship?.knows(wid, stim.actor) || !!rv?.file(wid, stim.actor);
        const chance = strength * (1 - clamp(stim.disguise ?? 0)) * (knows ? 1 : this.config.recognizeStranger);
        const recognized = r.chance(chance);
        const actor = recognized ? stim.actor : "someone";
        const key2 = `did:${actor}:${stim.kind}`;
        rv?.applyBelieve(wid, key2, stim.what ?? true, "saw", null, Math.max(0.3, strength));
        rv?.applyRemember(wid, { k: "saw:" + stim.kind, about: recognized ? stim.actor : void 0, place: stim.place ?? void 0, imp: crime ? 4 + crime.severity * 6 : 3, text: `saw ${actor} ${stim.kind}${stim.what ? " " + stim.what : ""}` });
        if (crime && rv) rv.applyFeel(wid, crime.feeling ?? "witnessed", key2);
        w.log("witnessed", wid, { actor, kind: stim.kind, what: stim.what ?? null, recognized });
        w.emit("witnessed", { id: wid, actor, kind: stim.kind, recognized });
        if (crime && recognized) {
          const lawful = p.def.traits?.lawful ?? p.def.values?.law ?? 0.5;
          const fear = p.def.traits?.courage !== void 0 ? 1 - p.def.traits.courage : 0.5;
          const regard = w.fellowship ? w.fellowship.regard(wid, stim.actor) : 0;
          const pReport = clamp((crime.report ?? this.config.reportChance) * (0.5 + lawful) * (1 - fear * 0.3) * (1 - Math.max(0, regard) * 0.8));
          if (r.chance(pReport)) {
            const [a, b] = this.config.reportDelay;
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
      const w = this.w;
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
      this.st.heat[actor] = round((this.st.heat[actor] || 0) + (crime.heat ?? crime.severity * 10), 4);
      if (w.fellowship) {
        if (to) w.fellowship.applyStanding(to, actor, 0, crime.severity * 0.2);
        for (const g of w.fellowship.groupsOf(wid)) w.fellowship.applyStanding(g, actor, 0, crime.severity * 0.1);
      }
      if (to && w.fellowship && w.reverie) for (const m of w.fellowship.members(to)) w.reverie.applyBelieve(m, `did:${actor}:${kind}`, what ?? true, "told", wid, 0.8, 1);
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
      const greed = p.def.traits?.greed ?? 0.5, courage = p.def.traits?.courage ?? 0.5, honesty = p.def.traits?.honesty ?? 0.5;
      const pAccept = how === "pay" ? clamp(greed * 0.6 + Math.min(1, amount / 100) * 0.5 - honesty * 0.4 + 0.1) : clamp((1 - courage) * 0.8 - honesty * 0.2 + 0.1);
      const ok = r.chance(pAccept);
      if (ok) {
        for (const b of rv.beliefs(witness)) if (b.key.startsWith(`did:${actor}:`)) rv.applySilence(witness, b.key);
      }
      if (how === "pay" && ok) p.vars.money = Number(p.vars.money ?? 0) + amount;
      if (how === "scare") {
        rv.applyFeel(witness, "scared", actor);
        w.fellowship?.applyRegard(witness, actor, -0.3);
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
      const r = w.stream(a);
      const talkative = a.def.traits?.talkative ?? 0.5;
      if (!r.chance(this.config.gossipChance * (0.5 + talkative))) return;
      const now2 = w.s.now;
      let best = null;
      for (const bl of rv.beliefs(a.id)) {
        if (bl.silenced || bl.hops >= this.config.maxHops) continue;
        if (bl.key.startsWith("@")) continue;
        const theirs = rv.belief(b.id, bl.key);
        if (theirs === bl.v) continue;
        const secret = this.secretFor(bl.key);
        if (secret && !(secret.about !== a.id && w.fellowship && w.fellowship.regard(a.id, secret.about) < -0.3)) continue;
        const subject2 = subjectOf(bl.key);
        if (subject2 === b.id) continue;
        const juicy = bl.key.startsWith("did:") ? this.crimes.has(bl.key.split(":")[2]) ? 3 : 1.5 : 1;
        const recency = Math.pow(0.99, (now2 - bl.t) / HOUR);
        const score = juicy * bl.str * recency;
        if (!best || score > best.score) best = { key: bl.key, v: bl.v, str: bl.str, hops: bl.hops, score };
      }
      if (!best) return;
      let key2 = best.key, lie = false;
      const v = best.v;
      const subject = subjectOf(key2);
      const honesty = a.def.traits?.honesty ?? 0.5;
      if (subject && v !== false && v !== null && honesty < 0.3 && w.fellowship && w.fellowship.regard(a.id, subject) < -0.3 && r.chance(this.config.lieChance)) {
        const foes = w.fellowship.relations(a.id).filter((x) => x.regard < -0.2 && x.id !== subject && x.id !== b.id);
        if (foes.length) {
          key2 = key2.replace(`did:${subject}:`, `did:${foes[0].id}:`);
          lie = true;
        }
      }
      const trust = w.fellowship ? clamp(0.6 + w.fellowship.regard(b.id, a.id) * 0.4, 0.2, 1) : 0.7;
      rv.applyBelieve(b.id, key2, v, "told", a.id, best.str * trust * 0.9, best.hops + 1);
      const sec = this.secretFor(key2);
      if (sec && !sec.knownBy.includes(b.id)) {
        sec.knownBy.push(b.id);
        if (sec.knownBy.length === 4) {
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
      this.sensed({ kind: a.crime, actor: p.id, place: d.place, seenBy, strength: 0.8 });
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
      for (const k in this.st.heat) {
        const v = round(this.st.heat[k] * this.config.heatDecay, 4);
        if (v < 0.05) delete this.st.heat[k];
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

  // src/modules/cityspeak.ts
  var lineKey = (l, i) => l.key !== void 0 && l.key !== "" ? l.key : String(i);
  var Cityspeak = class {
    constructor() {
      this.name = "cityspeak";
      this.lines = [];
      this.practices = /* @__PURE__ */ new Map();
      this.acts = /* @__PURE__ */ new Map();
      /** Bark cooldowns are kept outside the state: barks only happen near the player, so they mustn't change the world. */
      this.barkSaid = /* @__PURE__ */ new Map();
      /** Seconds between lines in a bark exchange. */
      this.barkGap = 2.2;
      /** Most lines in one exchange. */
      this.barkLength = 3;
    }
    init() {
      return { said: {}, acts: [] };
    }
    get st() {
      return this.w.s.mod.cityspeak;
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
     * most specific matching line wins; ties go by weight.
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
      this.lines.forEach((l, i) => {
        if (opts.topic !== void 0 && l.topic !== void 0 && l.topic !== opts.topic) return;
        if (opts.topic === void 0 && l.topic !== void 0) return;
        if (opts.skip?.(l, i)) return;
        let spec = l.topic !== void 0 ? 1 : 0;
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
        if (spec > bestSpec) {
          bestSpec = spec;
          best = [{ l, i }];
        } else if (spec === bestSpec) best.push({ l, i });
      });
      if (!best.length) return null;
      const r = w.worldStreamPeek(who, "line", now2);
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
      const skip = (who) => (l, i) => {
        const last = this.barkSaid.get(who + "|" + lineKey(l, i));
        return last !== void 0 && now2 - last < (l.cooldown ?? 60);
      };
      let speaker = a, listener = b;
      let line = this.pick(speaker, { to: listener, topic, skip: skip(speaker) });
      for (let n = 0; line && n < this.barkLength; n++) {
        this.barkSaid.set(speaker + "|" + lineKey(this.lines[line.i], line.i), now2);
        out.push({ ...line.said, after: n * this.barkGap });
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
      let m = 0.5;
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
          out.push([`${pr.id}: ${role}`, pr.boost ?? 1.5]);
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
      if (d.kind !== "act" || interrupted || frac < 0.5 || !d.target) return;
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

  // src/modules/mentat.ts
  var DEFAULT_MENTAT = { maxTries: 3, depth: 3, priceWeight: 1 };
  var Mentat = class {
    constructor(cfg = {}) {
      this.name = "mentat";
      this.config = { ...DEFAULT_MENTAT, ...cfg };
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
            const route = this.route(p, item, this.config.depth, /* @__PURE__ */ new Set());
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
      if (plan.tries > this.config.maxTries) return this.giveUp(p, why);
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
      p.cool[plan.task] = w.s.now + Math.max(def?.cooldown ?? 0, 120);
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
      if (p.suspended.length > 2) p.suspended.length = 2;
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
      if (this.w.s.now - plan.started > 24 * 60) return null;
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
      const w = this.w;
      const minutes = Array.isArray(a.minutes) ? (a.minutes[0] + a.minutes[1]) / 2 : a.minutes;
      let cost = minutes + (a.cost ?? 0);
      const price = a.price ?? 0;
      if (price) {
        const money = Number(p.vars.money ?? 0);
        if (price > money) return Infinity;
        const thrift = p.def.traits?.thrift ?? 0.5;
        cost += price * this.config.priceWeight * (0.5 + thrift) * (1 + clamp(price / Math.max(1, money)));
      }
      if (a.tags?.includes("illegal")) {
        const honesty = p.def.traits?.honesty ?? 0.5;
        if (honesty >= 0.8) return Infinity;
        cost += 60 + honesty * 300 + (w.wormtongue ? w.wormtongue.heat(p.id) * 20 : 0);
      }
      for (const v of a.against || []) {
        const held = p.def.values?.[v] ?? 0;
        if (held >= 0.9) return Infinity;
        cost += held * 200;
      }
      return cost;
    }
  };

  // src/modules/gaff.ts
  var DEFAULT_GAFF = { peakAt: 0.7, peakMinutes: 4 * HOUR, relaxMinutes: 12 * HOUR, decay: 0.04 };
  var Gaff = class {
    constructor(cfg = {}) {
      this.name = "gaff";
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
      const c = this.config, now2 = this.w.s.now;
      for (const subject in this.st.intensity) {
        const i = this.st.intensity[subject];
        i.v = round(clamp(i.v - c.decay), 4);
        if (i.phase === "build" && i.v >= c.peakAt) {
          i.phase = "peak";
          i.since = now2;
        } else if (i.phase === "peak" && now2 - i.since >= c.peakMinutes) {
          i.phase = "fade";
          i.since = now2;
        } else if (i.phase === "fade" && i.v < c.peakAt * 0.4) {
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
      for (const def of this.storylets.values()) {
        if (!this.ready(def)) continue;
        if (!r.chance(1 - Math.exp(-HOUR / Math.max(1, def.mtb)))) continue;
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
      this.applyBump(subject, def.bump ?? 0.2);
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

  // src/modules/ceres.ts
  var Ceres = class {
    constructor() {
      this.name = "ceres";
      this.goods = /* @__PURE__ */ new Map();
    }
    init() {
      return { purses: {}, pantry: {}, rent: {}, ledger: [] };
    }
    get st() {
      return this.w.s.mod.ceres;
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
        st.stock[item] = Math.max(0, (st.stock[item] || 0) + n);
      });
    }
    good(def) {
      this.goods.set(def.id, def);
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
        for (const item in a.uses) if (this.w.have(p, item) < a.uses[item]) return `needs ${item}`;
      }
      return null;
    }
    consider(p, c) {
      if (c.kind !== "action") return;
      const a = this.w.actions.get(c.id);
      const price = a?.price ?? 0;
      if (!price) return;
      const money = Math.max(0.01, this.money(p.id));
      const thrift = p.def.traits?.thrift ?? 0.5;
      const share = clamp(price / money);
      return [["price", round(clamp(1 - share * (0.4 + thrift * 0.8), 0.05, 1), 4)]];
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
          if (st.stock) st.stock[item] = Math.max(0, (st.stock[item] || 0) - n);
          this.store(p, item, n);
        }
      }
      if (a.uses) {
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
            st.stock[item] = Math.min(cap, (st.stock[item] || 0) + n);
          }
        }
      }
    }
    day() {
      const w = this.w, now2 = w.s.now;
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

  // src/modules/cradle.ts
  var DEFAULT_CRADLE = {
    year: 365 * DAY,
    stages: [["baby", 0], ["child", 3], ["teen", 13], ["adult", 18], ["elder", 65]],
    lifespan: [72, 96],
    fertility: 0.25,
    fertile: [20, 42],
    autoPair: { regard: 0.6, attraction: 0.5 }
  };
  var Cradle = class {
    constructor(cfg = {}) {
      this.name = "cradle";
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
      if (!p || p.born === void 0) return 30;
      return round((this.w.s.now - p.born) / this.config.year, 3);
    }
    stage(id) {
      const age = this.age(id);
      let out = this.config.stages[0]?.[0] ?? "adult";
      for (const [name, from] of this.config.stages) if (age >= from) out = name;
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
      f.applySentiment(a, b, "my partner", 0.3);
      f.applySentiment(b, a, "my partner", 0.3);
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
      const traits = {};
      const keys = /* @__PURE__ */ new Set();
      for (const p of parents) for (const k in p.def.traits || {}) keys.add(k);
      for (const k of [...keys].sort()) {
        const vals = parents.map((p) => p.def.traits?.[k]).filter((v) => v !== void 0);
        const avg = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
        traits[k] = round(clamp(avg + r.range(-0.12, 0.12)), 3);
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
      w.input("person", [id, child]);
      this.st.parents[id] = parents.map((p) => p.id);
      this.st.stage[id] = this.stage(id);
      if (w.fellowship) for (const p of parents) {
        w.fellowship.applySentiment(p.id, id, "my child", 0.5);
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
          if (regard >= 0.35) {
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
      const w = this.w, c = this.config, st = this.st;
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
          const pDie = clamp((age - c.lifespan[0]) / span) * 2 / (span * yearDays) + (age >= c.lifespan[1] ? 0.2 : 0);
          if (w.stream(p).chance(pDie)) this.applyDepart(p.id, "died");
        }
      }
      const f = w.fellowship;
      if (!f) return;
      if (c.autoPair) {
        for (const p of people) {
          if (p.status !== "active" || f.partner(p.id) || this.stage(p.id) !== "adult" && this.stage(p.id) !== "elder") continue;
          for (const r of f.relations(p.id)) {
            const o = w.s.people[r.id];
            if (!o || o.status !== "active" || f.partner(o.id) || o.id === p.id) continue;
            if (this.stage(o.id) !== "adult" && this.stage(o.id) !== "elder") continue;
            if (r.regard >= c.autoPair.regard && r.attraction >= c.autoPair.attraction && f.regard(o.id, p.id) >= c.autoPair.regard && f.attraction(o.id, p.id) >= c.autoPair.attraction) {
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
        if (w.stream(p).chance(c.fertility / yearDays)) this.applyBirth([p.id, q], {}, null);
      }
    }
    removed(p, why) {
      if (!this.st.departed[p.id]) this.st.departed[p.id] = { name: p.name, ...p.born !== void 0 ? { born: p.born } : {}, left: this.w.s.now, why };
    }
  };

  // src/modules/joi.ts
  var Joi = class {
    constructor() {
      this.name = "joi";
      /** The game's voice, in a sentence: 'neon noir, clipped' or 'cozy, folksy'. */
      this.voice = "Speak as this person would, in one or two short sentences.";
      this.provider = null;
      this.allowed = /* @__PURE__ */ new Set();
    }
    attach(w) {
      this.w = w;
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
      const needs = [...w.needs.keys()].map((n) => [n, w.mind.level(p, n)]).filter(([, v]) => v > 0.6).map(([n]) => n);
      if (needs.length) lines.push(`You badly want: ${needs.join(", ")}.`);
      if (w.reverie) {
        lines.push(`Mood: ${round(w.reverie.mood(who), 2)} (${w.reverie.emotion(who)}).`);
        const feelings = w.reverie.feelings(who).map((f) => f.label);
        if (feelings.length) lines.push(`On your mind: ${feelings.join("; ")}.`);
        const mem = w.reverie.memories(who).slice(0, 3).map((m) => m.text ?? m.k);
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
      const timeout = opts.timeoutMs ?? 2500;
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

  // src/tools/voightkampff.ts
  var builtins = {
    "nobody-starves": {
      name: "nobody-starves",
      sample(w, acc, fail) {
        const since = acc.starve || (acc.starve = {});
        const vital = [...w.needs.values()].filter((d) => (d.urgent ?? w.config.urgent) <= 1).map((d) => d.id);
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

  // src/index.ts
  var VERSION = "1.1.0";
  var MODULES = ["reverie", "fellowship", "wormtongue", "cityspeak", "mentat", "gaff", "ceres", "cradle", "joi"];
  function create(opts = {}) {
    const names = opts.modules ?? [...MODULES];
    const cfg = opts.moduleConfig || {};
    const make = {
      reverie: () => new Reverie(cfg.reverie),
      fellowship: () => new Fellowship(cfg.fellowship),
      wormtongue: () => new Wormtongue(cfg.wormtongue),
      cityspeak: () => new Cityspeak(),
      mentat: () => new Mentat(cfg.mentat),
      gaff: () => new Gaff(cfg.gaff),
      ceres: () => new Ceres(),
      cradle: () => new Cradle(cfg.cradle),
      joi: () => new Joi()
    };
    const modules = [];
    for (const n of MODULES) if (names.includes(n)) modules.push(make[n]());
    for (const n of names) if (!MODULES.includes(n)) throw new Error(`Tyrell: no module named '${n}'`);
    if (opts.extra) modules.push(...opts.extra);
    return new World(opts, modules);
  }
  var VoightKampff = { run, compare: compare2 };
  return __toCommonJS(index_exports);
})();
