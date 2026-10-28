/* Tycho 2.0.0 (tycho): an engine and a shelf of game features for small pixel games. Built from src/ by scripts/build.mjs; don't edit. MIT license. */
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

// src/index.ts
var index_exports = {};
__export(index_exports, {
  VERSION: () => VERSION,
  color: () => color_exports,
  loop: () => loop_exports,
  math: () => math_exports,
  seed: () => seed_exports
});
module.exports = __toCommonJS(index_exports);

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

// src/index.ts
var VERSION = "2.0.0";
