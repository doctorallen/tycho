/* Tycho 2.0.0 (tycho): an engine and a shelf of game features for small pixel games. Built from src/ by scripts/build.mjs; don't edit. MIT license. */
"use strict";
var Tycho = (() => {
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

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    VERSION: () => VERSION,
    color: () => color_exports,
    dev: () => dev_exports,
    loader: () => loader_exports,
    loop: () => loop_exports,
    math: () => math_exports,
    pwa: () => pwa_exports,
    save: () => save_exports,
    seed: () => seed_exports
  });

  // src/core/seed.ts
  var seed_exports = {};
  __export(seed_exports, {
    Rng: () => Rng,
    fxRand: () => fxRand,
    hash: () => hash,
    hash2: () => hash2,
    hashInts: () => hashInts,
    hashString: () => hashString,
    makeNoise: () => makeNoise,
    mulberry32: () => mulberry32,
    noise: () => noise,
    smooth: () => smooth
  });
  function hash(x, y, s = 0) {
    let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
    n = Math.imul(n ^ n >>> 13, 1274126177);
    return ((n ^ n >>> 16) >>> 0) / 4294967296;
  }
  function hash2(x, y) {
    let h = x * 374761393 + y * 668265263 | 0;
    h = Math.imul(h ^ h >>> 13, 1274126177);
    return ((h ^ h >>> 16) >>> 0) / 4294967296;
  }
  var smooth = (t) => t * t * (3 - 2 * t);
  function noise(x, y, s = 0) {
    const xi = Math.floor(x), yi = Math.floor(y), u = smooth(x - xi), v = smooth(y - yi);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function mulberry32(a) {
    return function() {
      a |= 0;
      a = a + 1831565813 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashInts(...xs) {
    let h = 2166136261 | 0;
    for (const x of xs) {
      h = Math.imul(h ^ (x | 0), 16777619);
      h ^= h >>> 15;
      h = Math.imul(h, 739982445);
      h ^= h >>> 12;
    }
    return h >>> 0;
  }
  function hashString(s) {
    let h = 2166136261 | 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function makeNoise(seed) {
    const rng = mulberry32(seed);
    const P = new Float32Array(256 * 256);
    for (let i = 0; i < P.length; i++) P[i] = rng();
    const g = (i, j) => P[(j & 255) << 8 | i & 255];
    const lerp2 = (a, b, t) => a + (b - a) * t;
    function v(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const u = smooth(x - xi), w = smooth(y - yi);
      return lerp2(lerp2(g(xi, yi), g(xi + 1, yi), u), lerp2(g(xi, yi + 1), g(xi + 1, yi + 1), u), w);
    }
    return (x, y) => v(x, y) * 0.6 + v(x * 2.1 + 17, y * 2.1 + 9) * 0.3 + v(x * 4.3 + 3, y * 4.3 + 41) * 0.1;
  }
  var Rng = class {
    constructor(seed) {
      this.seed = seed >>> 0;
      this.next = mulberry32(this.seed);
    }
    f(a = 1, b) {
      return b === void 0 ? this.next() * a : a + this.next() * (b - a);
    }
    i(a, b) {
      return Math.floor(a + this.next() * (b - a + 1));
    }
    pick(arr) {
      return arr[Math.floor(this.next() * arr.length)];
    }
    chance(p) {
      return this.next() < p;
    }
    weighted(list) {
      let total = 0;
      for (const [w] of list) total += Math.max(0, w);
      let r = this.next() * total;
      for (const [w, v] of list) {
        r -= Math.max(0, w);
        if (r < 0) return v;
      }
      return list[list.length - 1][1];
    }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
    fork() {
      return Math.floor(this.next() * 4294967296) >>> 0;
    }
  };
  var fxRand = {
    f: (a = 1, b) => b === void 0 ? Math.random() * a : a + Math.random() * (b - a),
    i: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    chance: (p) => Math.random() < p,
    weighted(list) {
      let total = 0;
      for (const [w] of list) total += Math.max(0, w);
      let r = Math.random() * total;
      for (const [w, v] of list) {
        r -= Math.max(0, w);
        if (r <= 0) return v;
      }
      return list.length ? list[list.length - 1][1] : null;
    }
  };

  // src/core/math.ts
  var math_exports = {};
  __export(math_exports, {
    angleTo: () => angleTo,
    approach: () => approach,
    clamp: () => clamp,
    dist: () => dist,
    dist2: () => dist2,
    ease: () => ease,
    lerp: () => lerp,
    unlerp: () => unlerp,
    wrap: () => wrap
  });
  var clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  var lerp = (a, b, t) => a + (b - a) * t;
  var unlerp = (a, b, v) => b === a ? 0 : (v - a) / (b - a);
  var dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  var dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
  var angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  var approach = (v, target, step) => v < target ? Math.min(target, v + step) : Math.max(target, v - step);
  var ease = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));
  var wrap = (v, m) => (v % m + m) % m;

  // src/core/color.ts
  var color_exports = {};
  __export(color_exports, {
    SOOT: () => SOOT,
    WARM: () => WARM,
    css: () => css,
    hexToRgb: () => hexToRgb,
    lum: () => lum,
    mix: () => mix,
    mixRgb: () => mixRgb,
    rampOf: () => rampOf,
    rgb: () => rgb,
    rgbToHex: () => rgbToHex,
    shade: () => shade,
    tone: () => tone
  });
  var rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function hexToRgb(h) {
    h = h.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
  }
  function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    if (amt < 0) return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
    return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  }
  function mix(h1, h2, t) {
    const a = hexToRgb(h1), b = hexToRgb(h2);
    return rgbToHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
  }
  var mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  var lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  var css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  var SOOT = [8, 6, 12];
  var WARM = [255, 238, 200];
  function rampOf(anchors, n = 9, deep = 0.55, high = 0.3) {
    const A = anchors.map((a) => typeof a === "string" ? rgb(a) : a);
    const path = [mixRgb(A[0], SOOT, deep)].concat(A, [mixRgb(A[A.length - 1], WARM, high)]), pts = [];
    for (let i = 0; i + 1 < path.length; i++) for (let k = 0; k < 16; k++) pts.push(mixRgb(path[i], path[i + 1], k / 16));
    pts.push(path[path.length - 1]);
    const L = [];
    let m = -1;
    for (const c of pts) {
      m = Math.max(m, lum(c));
      L.push(m);
    }
    const out = [];
    for (let k = 0, j = 0; k < n; k++) {
      const want = L[0] + (L[L.length - 1] - L[0]) * (k / (n - 1));
      while (j < L.length - 2 && L[j + 1] < want) j++;
      const u = L[j + 1] > L[j] ? clamp((want - L[j]) / (L[j + 1] - L[j]), 0, 1) : 0;
      out.push(mixRgb(pts[j], pts[j + 1], u));
    }
    return out;
  }
  var tone = (ramp, v, jit = 0) => ramp[clamp(Math.round(v * (ramp.length - 1) + jit), 0, ramp.length - 1)];

  // src/core/loop.ts
  var loop_exports = {};
  __export(loop_exports, {
    Governor: () => Governor,
    Samples: () => Samples,
    Stepper: () => Stepper
  });
  var Stepper = class {
    constructor(o = {}) {
      this.acc = 0;
      this.last = 0;
      this.dt = o.dt ?? 1 / 60;
      this.max = o.max ?? 4;
      this.longest = o.longest ?? 0.1;
    }
    /** Seconds since the last animation frame (clamped), from its timestamp. */
    since(now) {
      const d = Math.min(this.longest, (now - (this.last || now)) / 1e3 || 0);
      this.last = now;
      return d;
    }
    /** Runs the steps owed; returns how many ran. */
    advance(dt, step) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= this.dt && n < this.max) {
        step(this.dt);
        this.acc -= this.dt;
        n++;
      }
      if (n >= this.max) this.acc = 0;
      return n;
    }
    /** Forgets owed time (while paused). */
    hold() {
      this.acc = 0;
    }
  };
  var Samples = class {
    constructor(size = 180) {
      this.list = [];
      this.size = size;
    }
    add(v) {
      this.list.push(v);
      if (this.list.length > this.size) this.list.shift();
    }
    /** The p-th percentile (0..1); 0 with no samples. */
    pct(p) {
      const a = this.list;
      if (!a.length) return 0;
      const s = a.slice().sort((x, y) => x - y);
      return s[Math.min(s.length - 1, Math.floor(s.length * p))];
    }
    count(test) {
      return this.list.filter(test).length;
    }
  };
  var Governor = class {
    constructor(o) {
      this.t = 0;
      this.n = 0;
      this.window = o.window ?? 2;
      this.below = o.below ?? 40;
      this.lower = o.lower;
    }
    check(dt, active = true) {
      if (!active) {
        this.t = this.n = 0;
        return;
      }
      this.t += dt;
      this.n++;
      if (this.t < this.window) return;
      const fps = this.n / this.t;
      this.t = this.n = 0;
      if (fps < this.below) this.lower();
    }
  };

  // src/shell/save.ts
  var save_exports = {};
  __export(save_exports, {
    Store: () => Store,
    get: () => get,
    keys: () => keys,
    raw: () => raw,
    remove: () => remove,
    set: () => set
  });
  function get(key, fallback = null) {
    try {
      const raw2 = localStorage.getItem(key);
      return raw2 === null ? fallback : JSON.parse(raw2);
    } catch (e) {
      return fallback;
    }
  }
  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }
  function raw(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
    }
  }
  function keys(prefix = "") {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) out.push(k);
      }
    } catch (e) {
    }
    return out;
  }
  var Store = class {
    constructor(o) {
      this.data = null;
      /** True once wiped: nothing more is written. */
      this.wiped = false;
      /** True if a save was there but couldn't be read (and was kept aside). */
      this.unread = false;
      /** True if `load()` found this game's save. */
      this.loaded = false;
      this.refused = false;
      this.o = o;
    }
    /** The stored save as it is (renamed ids put right), or null. */
    read() {
      const r = raw(this.o.key);
      if (r === null) return null;
      return JSON.parse(this.renamed(r));
    }
    renamed(text) {
      for (const [a, b] of this.o.renamed || []) text = typeof a === "string" ? text.split(a).join(b) : text.replace(a, b);
      return text;
    }
    /** Reads the save into `data`: the stored one over a fresh one, or a fresh
     * one. Old keys are deleted first. Returns `data`. */
    load() {
      for (const k of this.o.old || []) remove(k);
      const fresh = this.o.fresh();
      let stored = null, r = null;
      try {
        r = raw(this.o.key);
        stored = r === null ? null : JSON.parse(this.renamed(r));
      } catch (e) {
        if (this.o.keepUnread && r !== null) {
          try {
            if (!raw(this.o.key + ".unread")) localStorage.setItem(this.o.key + ".unread", r);
          } catch (e2) {
          }
        }
        this.unread = r !== null;
        stored = null;
      }
      this.loaded = !!stored && (!this.o.accept || this.o.accept(stored, fresh));
      this.data = this.loaded ? Object.assign(fresh, stored) : fresh;
      if (this.o.clean) this.o.clean(this.data);
      return this.data;
    }
    /** Stores the save; false if storage refused it (said once by onRefused). */
    write(data = this.data) {
      if (this.wiped || !data) return false;
      if (set(this.o.key, data)) return true;
      if (!this.refused) {
        this.refused = true;
        if (this.o.onRefused) this.o.onRefused();
      }
      return false;
    }
    /** Writes one field into the stored save at once, leaving the rest as last
     * stored (or the whole save, if none is stored yet). */
    writeField(name) {
      if (this.wiped || !this.data) return;
      try {
        const r = raw(this.o.key);
        if (r === null) {
          this.write();
          return;
        }
        const stored = JSON.parse(r);
        stored[name] = this.data[name];
        localStorage.setItem(this.o.key, JSON.stringify(stored));
      } catch (e) {
      }
    }
    /** Deletes the save and stops writing (until the page loads again). */
    wipe() {
      this.wiped = true;
      remove(this.o.key);
    }
    /** Starting over: every key starting with `prefix` is deleted, and the
     * save becomes `next` (a fresh one, perhaps with settings kept). Nothing
     * more is written after. */
    startOver(prefix, next) {
      this.wiped = true;
      for (const k of keys(prefix)) remove(k);
      if (next) set(this.o.key, next);
    }
  };

  // src/shell/pwa.ts
  var pwa_exports = {};
  __export(pwa_exports, {
    Pwa: () => Pwa,
    start: () => start
  });
  var Pwa = class {
    constructor(o) {
      this.reg = null;
      /** The browser's install prompt, while it can be shown. */
      this.prompt = null;
      /** The live build, from version.json at start (null until known). */
      this.live = null;
      /** A newer build that has taken over, waiting for the game to load it. */
      this.newer = null;
      this.reloading = false;
      this.o = o;
    }
    /** Starts it all: the install prompt, the live build, the worker. Only
     * over http(s): opened from a file there's no worker. */
    start() {
      const o = this.o;
      addEventListener("beforeinstallprompt", (e) => {
        this.prompt = e;
        if (o.onInstallable) o.onInstallable();
      });
      if (o.canAsk) {
        const ask = () => {
          if (!this.prompt || this.installed() || !o.canAsk()) return;
          const key = o.askedKey || "tycho.installAsked";
          let last = 0;
          try {
            last = +(localStorage.getItem(key) || 0) || 0;
          } catch (e) {
          }
          if (Date.now() - last < (o.askEvery ?? 3 * 864e5)) return;
          try {
            localStorage.setItem(key, String(Date.now()));
          } catch (e) {
          }
          this.install();
        };
        addEventListener("pointerup", ask);
        addEventListener("keyup", ask);
      }
      addEventListener("appinstalled", () => {
        this.prompt = null;
        if (o.onInstalled) o.onInstalled();
      });
      if (!/^https?:$/.test(location.protocol)) return this;
      this.version().then((v) => {
        this.live = v;
      });
      if (!("serviceWorker" in navigator)) return this;
      let claimed = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!claimed) {
          claimed = true;
          return;
        }
        if (this.reloading || this.newer) return;
        this.version().then((v) => {
          if (v && v === o.build) return;
          this.newer = v || "a new version";
          if (o.onNewer) o.onNewer(this.newer);
        });
      });
      navigator.serviceWorker.register(o.sw || "sw.js", { updateViaCache: "none" }).then((reg) => {
        this.reg = reg;
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) this.check();
        });
        setInterval(() => this.check(), o.every ?? 15 * 60 * 1e3);
      }).catch(() => {
      });
      return this;
    }
    /** The live build from version.json, or null. */
    version() {
      return fetch("version.json", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((v) => v && v.build || null).catch(() => null);
    }
    /** Looks for a new deploy now. */
    check() {
      if (this.reg) this.reg.update().catch(() => {
      });
    }
    /** Loads the page again onto the new build, remembering it was an update. */
    reload() {
      this.reloading = true;
      try {
        sessionStorage.setItem(this.o.updatedKey || "tycho.updated", this.newer || "1");
      } catch (e) {
      }
      location.reload();
    }
    /** After a reload onto a new build: what it was (once), or null. */
    updated() {
      const key = this.o.updatedKey || "tycho.updated";
      let was = null;
      try {
        was = sessionStorage.getItem(key);
        sessionStorage.removeItem(key);
      } catch (e) {
      }
      return was;
    }
    installed() {
      return matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches || navigator.standalone === true;
    }
    ios() {
      return /iphone|ipad|ipod/i.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    }
    /** Shows the browser's install prompt, if it can. */
    install() {
      if (!this.prompt) return;
      const p = this.prompt;
      p.prompt();
      p.userChoice.finally(() => {
        this.prompt = null;
        if (this.o.onInstallable) this.o.onInstallable();
      });
    }
  };
  function start(o) {
    return new Pwa(o).start();
  }

  // src/shell/dev.ts
  var dev_exports = {};
  __export(dev_exports, {
    Flags: () => Flags,
    query: () => query
  });
  function query(name, search = typeof location !== "undefined" ? location.search : "") {
    return new RegExp("[?&]" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(search);
  }
  var Flags = class {
    constructor(key, defaults) {
      this.key = key;
      this.s = Object.assign({}, defaults);
    }
    load() {
      Object.assign(this.s, get(this.key, {}) || {});
      if (query("dev") && !this.s.shown) {
        this.s.shown = true;
        this.save();
      }
      return this;
    }
    save() {
      set(this.key, this.s);
    }
    shown() {
      return query("dev") || !!this.s.shown;
    }
  };

  // src/shell/loader.ts
  var loader_exports = {};
  __export(loader_exports, {
    Tasks: () => Tasks,
    afterPaint: () => afterPaint
  });
  var chan = null;
  var queue = [];
  function afterPaint(fn) {
    if (!chan && typeof MessageChannel !== "undefined" && typeof document !== "undefined") {
      chan = new MessageChannel();
      chan.port1.onmessage = () => {
        const q = queue.splice(0);
        for (const f of q) f();
      };
    }
    if (!chan) {
      setTimeout(fn, 0);
      return;
    }
    queue.push(fn);
    chan.port2.postMessage(0);
  }
  var Tasks = class {
    constructor(o = {}) {
      this.jobs = [];
      this.sliceAt = 0;
      /** True once the main lane is done (a side task may stop early then). */
      this.mainDone = false;
      this.slice = o.slice ?? 12;
      this.onError = o.onError || (() => {
      });
      this.onFrame = o.onFrame || null;
    }
    /** Runs the tasks: the side lane at once, the main lane one after another.
     * Resolves when all are done or skipped. `jobs` holds their states from
     * the moment it's called. */
    async run(tasks) {
      this.jobs = tasks.filter(Boolean).map((t) => Object.assign({ k: 0, n: 0, f: 0, line: t.label, state: "wait", ms: 0 }, t));
      this.mainDone = false;
      const side = this.jobs.filter((j) => j.side).map((j) => this.runOne(j));
      for (const j of this.jobs) if (!j.side) await this.runOne(j);
      this.mainDone = true;
      await Promise.all(side);
    }
    async runOne(j) {
      const t0 = performance.now();
      j.state = "run";
      const job = this.jobFor(j);
      try {
        await this.yield(true);
        const r = j.fn(job);
        if (typeof r === "function") {
          for (; ; ) {
            if (r(job) === true) break;
            await this.yield();
          }
        } else if (r && typeof r.then === "function") await r;
        j.state = "ok";
      } catch (e) {
        j.state = "skip";
        this.onError(e, j);
      }
      j.f = 1;
      j.ms = performance.now() - t0;
    }
    jobFor(j) {
      return {
        at(k, n, f) {
          j.k = k;
          j.n = n;
          j.f = f !== void 0 ? f : n ? Math.min(1, k / n) : 0;
        },
        say(text) {
          j.line = text;
        },
        yield: (now) => this.yield(now)
      };
    }
    /** Waits for the next frame once this slice's time is spent (or at once,
     * with `now`): the bar is drawn, and a frame shown, between slices. */
    yield(now) {
      if (!now && performance.now() - this.sliceAt < this.slice) return Promise.resolve();
      return new Promise((res) => {
        const go = () => {
          this.sliceAt = performance.now();
          if (this.onFrame) this.onFrame();
          res();
        };
        if (typeof document === "undefined" || document.hidden || typeof requestAnimationFrame === "undefined") setTimeout(go, 0);
        else requestAnimationFrame(() => afterPaint(go));
      });
    }
    /** How far, 0..1: each task's share by its weight. */
    progress() {
      let w = 0, d = 0;
      for (const j of this.jobs) {
        w += j.weight;
        d += j.weight * (j.state === "ok" || j.state === "skip" ? 1 : j.f);
      }
      return w ? d / w : 1;
    }
    /** A step function that runs fn on each of a list, a slice at a time. */
    each(job, list, fn) {
      let i = 0;
      return () => {
        const t0 = performance.now();
        while (i < list.length && performance.now() - t0 < this.slice) fn(list[i++], i - 1);
        job.at(i, list.length);
        return i >= list.length;
      };
    }
  };

  // src/index.ts
  var VERSION = "2.0.0";
  return __toCommonJS(index_exports);
})();
