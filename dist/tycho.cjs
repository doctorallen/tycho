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
  collide: () => collide_exports,
  color: () => color_exports,
  dev: () => dev_exports,
  fx: () => fx_exports,
  gpu: () => gpu_exports,
  grid: () => grid_exports,
  light: () => light_exports,
  loader: () => loader_exports,
  loop: () => loop_exports,
  math: () => math_exports,
  move: () => move_exports,
  paint: () => paint_exports,
  path: () => path_exports,
  post: () => post_exports,
  pwa: () => pwa_exports,
  save: () => save_exports,
  seed: () => seed_exports,
  sprite: () => sprite_exports
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

// src/pixels/gpu.ts
var gpu_exports = {};
__export(gpu_exports, {
  BLEND: () => BLEND,
  Ctx: () => Ctx,
  F: () => F,
  Gpu: () => Gpu,
  Gradient: () => Gradient,
  RadialGradient: () => RadialGradient,
  TRI_VS: () => TRI_VS,
  parseColor: () => parseColor
});
var F = { EM: 1, COL: 2, SOLID: 4, SMOOTH: 8, GROUND: 16, GROUNDEM: 32, DYN: 64, MAP: 128 };
var BLEND = { "source-over": 0, lighter: 1, "destination-out": 2, multiply: 3, copy: 0, "source-in": 0 };
var Q = 19;
var ZERO = new Float32Array([0, 0, 0, 0]);
var BLACK = new Float32Array([0, 0, 0, 1]);
var QUAD_VS = `#version 300 es
in vec4 aRect; in vec4 aUV; in float aPage; in vec4 aTint; in float aFeet; in float aFlags; in vec4 aXf;
uniform vec2 uViewF;
out vec2 vUV; flat out vec4 vBox; flat out float vPage; out vec4 vTint; flat out float vFeet; flat out int vFlags;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vec2 p = aRect.xy + mat2(aXf.x, aXf.y, aXf.z, aXf.w) * (c * aRect.zw);
  gl_Position = vec4(p.x / uViewF.x * 2.0 - 1.0, 1.0 - p.y / uViewF.y * 2.0, 0.0, 1.0);
  vUV = aUV.xy + c * (aUV.zw - aUV.xy);
  vBox = aUV; vPage = aPage; vTint = aTint; vFeet = aFeet; vFlags = int(aFlags);
}`;
function quadFS(occlude) {
  return `#version 300 es
precision highp float; precision highp int; precision highp sampler2DArray; precision highp sampler2D;
in vec2 vUV; flat in vec4 vBox; flat in float vPage; in vec4 vTint; flat in float vFeet; flat in int vFlags;
uniform sampler2DArray uAtlas;
uniform sampler2D uGroundCol, uGroundEm, uLift, uDyn, uMap;
uniform ivec2 uView, uCam, uGroundSize;
uniform int uBlend;
uniform vec2 uMapOrg; uniform float uMapCell; uniform ivec2 uMapSize;
layout(location = 0) out vec4 oCol;
layout(location = 1) out vec4 oEm;
vec4 page(vec2 t) { return texelFetch(uAtlas, ivec3(ivec2(floor(t)), int(vPage)), 0); }
vec4 dyn(vec2 t) { return texelFetch(uDyn, ivec2(floor(t)), 0); }
vec4 mapAt(vec2 t) { return texelFetch(uMap, clamp(ivec2(t), ivec2(0), uMapSize - 1), 0); }
void main() {
  vec4 c;
  bool smooth_ = (vFlags & ${F.SMOOTH}) != 0;
  if ((vFlags & ${F.SOLID}) != 0) c = vec4(1.0);
  else if ((vFlags & ${F.GROUND}) != 0) c = texelFetch(uGroundCol, ivec2(floor(vUV)), 0);
  else if ((vFlags & ${F.GROUNDEM}) != 0) c = texelFetch(uGroundEm, ivec2(floor(vUV)), 0);
  else if (smooth_) {
    // bilinear, within the picture's own box
    vec2 t = clamp(vUV - 0.5, vBox.xy, vBox.zw - 1.0), f = fract(t), t0 = floor(t);
    vec2 t1 = min(t0 + 1.0, vBox.zw - 1.0);
    if ((vFlags & ${F.DYN}) != 0) c = mix(mix(dyn(t0), dyn(vec2(t1.x, t0.y)), f.x), mix(dyn(vec2(t0.x, t1.y)), dyn(t1), f.x), f.y);
    else c = mix(mix(page(t0), page(vec2(t1.x, t0.y)), f.x), mix(page(vec2(t0.x, t1.y)), page(t1), f.x), f.y);
  }
  else if ((vFlags & ${F.DYN}) != 0) c = dyn(vUV);
  else c = page(vUV);
  c *= vTint;
  if ((vFlags & ${F.MAP}) != 0) {
    // multiplied by the light map, scaled up smooth from its cells
    vec2 p = vec2(gl_FragCoord.x, float(uView.y) - gl_FragCoord.y);
    vec2 t = (p - uMapOrg) / uMapCell - 0.5, f = fract(t), t0 = floor(t);
    vec3 m = mix(mix(mapAt(t0), mapAt(t0 + vec2(1.0, 0.0)), f.x), mix(mapAt(t0 + vec2(0.0, 1.0)), mapAt(t0 + 1.0), f.x), f.y).rgb;
    c.rgb *= m;
  }
${occlude ? `  // what stands in front of the quad's feet: its pixel instead (Lodestar's rock)
  if (vFeet > -1.5 && c.a > 0.0) {
    int px = int(gl_FragCoord.x), py = uView.y - 1 - int(gl_FragCoord.y);
    ivec2 fp = ivec2(px - uCam.x, py - uCam.y);
    if (fp.x >= 0 && fp.y >= 0 && fp.x < uGroundSize.x && fp.y < uGroundSize.y) {
      float lift = texelFetch(uLift, fp, 0).r * 255.0;
      if (lift > 0.5 && (vFeet < -0.5 || float(py) + lift - 1.0 > vFeet + 0.5)) {
        if (uBlend != 0) discard;
        oCol = (vFlags & ${F.COL}) != 0 ? texelFetch(uGroundCol, fp, 0) * c.a : vec4(0.0);
        oEm = (vFlags & ${F.EM}) != 0 ? texelFetch(uGroundEm, fp, 0) * c.a : vec4(0.0);
        return;
      }
    }
  }
` : ""}  oCol = (vFlags & ${F.COL}) != 0 ? c : vec4(0.0);
  oEm = (vFlags & ${F.EM}) != 0 ? c : vec4(0.0);
}`;
}
var TRI_VS = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID & 1) * 4) - 1.0, float((gl_VertexID & 2) * 2) - 1.0); gl_Position = vec4(p, 0.0, 1.0); }`;
var BLOOM_FS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uEm; uniform ivec2 uView; uniform ivec2 uOut; uniform float uS; uniform vec2 uOrg;
out vec4 o;
void main() {
  int i = int(gl_FragCoord.x), j = uOut.y - 1 - int(gl_FragCoord.y);
  float x0 = uOrg.x + float(i) * uS, y0 = uOrg.y + float(j) * uS;
  int xa = int(floor(x0)), xb = int(floor(x0 + uS)), ya = int(floor(y0)), yb = int(floor(y0 + uS));
  vec4 sum = vec4(0.0); float n = 0.0;
  for (int y = ya; y < yb; y++) for (int x = xa; x < xb; x++) {
    n += 1.0;
    if (x < 0 || y < 0 || x >= uView.x || y >= uView.y) continue;
    sum += texelFetch(uEm, ivec2(x, uView.y - 1 - y), 0);
  }
  o = n > 0.0 ? sum / n : vec4(0.0);
}`;
var OUT_FS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uLit, uP0, uP1, uP2, uP3;
uniform ivec2 uView; uniform int uN;
uniform vec4 uPass[4];
uniform vec2 uPassSize[4];
out vec4 o;
vec4 pass(int k, vec2 p) {
  vec2 q = (p - uPass[k].zw) / uPass[k].x - 0.5;
  vec2 uv = vec2(q.x + 0.5, uPassSize[k].y - 0.5 - q.y) / uPassSize[k];
  if (k == 0) return texture(uP0, uv); if (k == 1) return texture(uP1, uv); if (k == 2) return texture(uP2, uv); return texture(uP3, uv);
}
void main() {
  int x = int(gl_FragCoord.x), y = uView.y - 1 - int(gl_FragCoord.y);
  vec3 c = texelFetch(uLit, ivec2(x, int(gl_FragCoord.y)), 0).rgb;
  vec2 p = vec2(float(x) + 0.5, float(y) + 0.5);
  for (int k = 0; k < uN; k++) c += pass(k, p).rgb * uPass[k].y;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;
var PLAIN_FS = `#version 300 es
precision highp float; uniform sampler2D uScene; out vec4 o;
void main() { o = vec4(texelFetch(uScene, ivec2(gl_FragCoord.xy), 0).rgb, 1.0); }`;
var Gpu = class _Gpu {
  constructor(canvas2, o = {}) {
    this.on = false;
    this.w = 0;
    this.h = 0;
    /** The frame's camera: view px of the ground's origin. */
    this.ox = 0;
    this.oy = 0;
    /** The occlusion mode for the quads pushed next: -2 none, -1 flat on the
     * ground (anything lifted covers it), else the feet's view row. */
    this.feet = -2;
    this.frame = 0;
    this.stats = { quads: 0, draws: 0, uploads: 0 };
    // the batch
    this.q = new Float32Array(4096 * Q);
    this.n = 0;
    this.cap = 4096;
    this.runs = [];
    this.cur = null;
    this.target = "scene";
    this.blend = 0;
    this.clip = null;
    this.dyn = null;
    this.litDone = false;
    this.drawn = false;
    this.oq = new Float32Array(1024 * Q);
    this.on_ = 0;
    this.ocap = 1024;
    this.odyn = null;
    this.bufs = [];
    this.bi = 0;
    this.attribs = [];
    this.boundFb = void 0;
    // the atlas
    this.atlasTex = null;
    this.pages = 0;
    this.shelves = [];
    this.pics = /* @__PURE__ */ new WeakMap();
    this.entries = [];
    this.dynTexs = /* @__PURE__ */ new WeakMap();
    this.groundW = 0;
    this.groundH = 0;
    this.groundOn = false;
    this.groundX = 0;
    this.groundY = 0;
    this.groundSrc = [null, null];
    this.groundDirtyBoxes = [];
    /** Called before a frame draws from the ground, while boxes wait to go up
     * (the game calls groundSync with its pixels). */
    this.onGroundDraw = null;
    this.spare = {};
    this.shiftFb = null;
    this.box = null;
    // the light map for MAP quads (light.ts's smooth model sets it)
    this.map = { org: [0, 0], cell: 4, w: 1, h: 1 };
    this.passes = [];
    this.bloomSpec = [];
    this.plainP = null;
    this.canvas = canvas2;
    this.o = Object.assign({ atlas: 2048, pages: 2, maxPages: 6, keep: 600, ring: 24, occlude: false }, o);
  }
  static create(canvas2, o = {}) {
    if (typeof location !== "undefined" && /[?&]nogpu\b/.test(location.search)) return null;
    const g = new _Gpu(canvas2, o);
    return g.init() ? g : null;
  }
  err(e) {
    if (this.o.onError) this.o.onError(e);
  }
  /** Compiles a program from a vertex and a fragment shader, with the
   * locations of the uniforms named. */
  program(vs, fs, uniforms) {
    const gl = this.gl, shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("shader: " + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("link: " + gl.getProgramInfoLog(p));
    const u = {};
    for (const n of uniforms) u[n] = gl.getUniformLocation(p, n);
    return { p, u };
  }
  /** A texture on a unit, nearest or linear, clamped. */
  tex(unit, kind, filter) {
    const gl = this.gl, k = kind ?? gl.TEXTURE_2D, f = filter ?? gl.NEAREST, t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(k, t);
    gl.texParameteri(k, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(k, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(k, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(k, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  init() {
    try {
      const gl = this.canvas.getContext("webgl2", Object.assign({ alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false }, this.o.attributes || {}));
      if (!gl) return false;
      this.gl = gl;
      this.quad = this.program(QUAD_VS, quadFS(!!this.o.occlude), ["uViewF", "uView", "uCam", "uGroundSize", "uBlend", "uAtlas", "uGroundCol", "uGroundEm", "uLift", "uDyn", "uMap", "uMapOrg", "uMapCell", "uMapSize"]);
      this.bloomP = this.program(TRI_VS, BLOOM_FS, ["uEm", "uView", "uOut", "uS", "uOrg"]);
      this.outP = this.program(TRI_VS, OUT_FS, ["uLit", "uP0", "uP1", "uP2", "uP3", "uView", "uN", "uPass", "uPassSize"]);
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      for (let i = 0; i < this.o.ring; i++) this.bufs.push(gl.createBuffer());
      this.attribs = [["aRect", 4, 0], ["aUV", 4, 4], ["aPage", 1, 8], ["aTint", 4, 9], ["aFeet", 1, 13], ["aFlags", 1, 14], ["aXf", 4, 15]].map(([n, size, off]) => [gl.getAttribLocation(this.quad.p, n), size, off]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[0]);
      for (const [a, size, off] of this.attribs) {
        if (a < 0) continue;
        gl.enableVertexAttribArray(a);
        gl.vertexAttribPointer(a, size, gl.FLOAT, false, Q * 4, off * 4);
        gl.vertexAttribDivisor(a, 1);
      }
      gl.bindVertexArray(null);
      this.triVao = gl.createVertexArray();
      gl.useProgram(this.quad.p);
      const u = this.quad.u;
      gl.uniform1i(u.uAtlas, 0);
      gl.uniform1i(u.uGroundCol, 1);
      gl.uniform1i(u.uGroundEm, 2);
      gl.uniform1i(u.uLift, 3);
      gl.uniform1i(u.uDyn, 4);
      gl.uniform1i(u.uMap, 11);
      gl.useProgram(this.bloomP.p);
      gl.uniform1i(this.bloomP.u.uEm, 5);
      gl.useProgram(this.outP.p);
      gl.uniform1i(this.outP.u.uLit, 5);
      gl.uniform1i(this.outP.u.uP0, 6);
      gl.uniform1i(this.outP.u.uP1, 7);
      gl.uniform1i(this.outP.u.uP2, 8);
      gl.uniform1i(this.outP.u.uP3, 9);
      this.atlasInit(this.o.pages);
      for (const [unit, name, red] of [[1, "groundCol", false], [2, "groundEm", false], [3, "lift", true], [4, "dynTex", false], [11, "mapTex", false]]) {
        this[name] = this.tex(unit);
        gl.texImage2D(gl.TEXTURE_2D, 0, red ? gl.R8 : gl.RGBA8, 1, 1, 0, red ? gl.RED : gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(red ? [0] : [255, 255, 255, 255]));
      }
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      this.on = true;
      this.canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        this.on = false;
      }, false);
      this.canvas.addEventListener("webglcontextrestored", () => {
        location.reload();
      }, false);
    } catch (e) {
      this.err(e);
      this.on = false;
    }
    return this.on;
  }
  /** The framebuffers at the view's size; `bloom` the grid bloom's passes,
   * [size of a cell in view px, strength] each (at most four). */
  resize(w, h, bloom = this.bloomSpec) {
    const gl = this.gl;
    if (!this.on || this.w === w && this.h === h && (bloom === this.bloomSpec || JSON.stringify(bloom) === JSON.stringify(this.bloomSpec))) return;
    this.w = w;
    this.h = h;
    this.bloomSpec = bloom;
    const target = (texs) => {
      const fb = gl.createFramebuffer();
      this.bind(fb);
      texs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
      gl.drawBuffers(texs.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
      return { fb };
    };
    const tex2 = () => {
      const t = this.tex(5);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
      return t;
    };
    if (this.scene) for (const t of [this.sceneCol, this.sceneEm, this.litTex]) gl.deleteTexture(t);
    this.sceneCol = tex2();
    this.sceneEm = tex2();
    this.litTex = tex2();
    this.scene = target([this.sceneCol, this.sceneEm]);
    this.lit = target([this.litTex, this.sceneEm]);
    for (const p of this.passes) {
      gl.deleteTexture(p.tex);
      gl.deleteFramebuffer(p.fb);
    }
    this.passes = bloom.slice(0, 4).map(([s, a]) => {
      const pw = Math.ceil(w / s) + 2, ph = Math.ceil(h / s) + 2;
      const tex = this.tex(5, gl.TEXTURE_2D, gl.LINEAR);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, pw, ph);
      const fb = gl.createFramebuffer();
      this.bind(fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { s, a, pw, ph, tex, fb, ox: 0, oy: 0 };
    });
    this.bind(null);
    this.blank();
  }
  // ---- the atlas -----------------------------------------------------------
  // Pages of `atlas` px square, a texture array; a canvas is placed on a
  // shelf the first time it's drawn (and the pages rebuilt from the canvases
  // still about when they fill) and found by the canvas after.
  atlasInit(pages) {
    const gl = this.gl, A = this.o.atlas;
    if (this.atlasTex) gl.deleteTexture(this.atlasTex);
    this.atlasTex = this.tex(0, gl.TEXTURE_2D_ARRAY);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, A, A, pages);
    this.pages = pages;
    this.shelves = [];
    for (let p = 0; p < pages; p++) this.shelves.push({ y: 0, rows: [] });
  }
  place(w, h) {
    const A = this.o.atlas, hh = Math.min(A, h + 7 & ~7);
    for (let p = 0; p < this.pages; p++) {
      const S = this.shelves[p];
      for (const r of S.rows) if (r.h >= hh && r.h <= hh * 2 && r.x + w <= A) {
        const e = { x: r.x, y: r.y, page: p };
        r.x += w;
        return e;
      }
      if (S.y + hh <= A && w <= A) {
        const r = { y: S.y, h: hh, x: w };
        S.rows.push(r);
        S.y += hh;
        return { x: 0, y: r.y, page: p };
      }
    }
    return null;
  }
  // (from the canvas itself, which a browser can copy on the GPU, rather
  // than its pixels read back)
  upload(e, src) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlasTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, e.x, e.y, e.page, e.w, e.h, 1, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.stats.uploads++;
  }
  // The pages built again from the pictures drawn lately (the rest let go),
  // with a page more if they still don't fit.
  rebuild(need) {
    const A = this.o.atlas;
    const keep = this.entries.filter((e) => this.frame - e.used < this.o.keep && !e.dead);
    for (const e of this.entries) if (!keep.includes(e)) e.dead = true;
    const area = keep.reduce((s, e) => s + e.w * (e.h + 7 & ~7), 0) + need;
    let pages = this.pages;
    while (pages < this.o.maxPages && area > pages * A * A * 0.7) pages++;
    this.atlasInit(pages);
    this.entries = [];
    keep.sort((a, b) => b.h - a.h);
    for (const e of keep) {
      const src = e.ref.deref();
      if (!src) {
        e.dead = true;
        continue;
      }
      const at = this.place(e.w, e.h);
      if (!at) {
        e.dead = true;
        continue;
      }
      e.x = at.x;
      e.y = at.y;
      e.page = at.page;
      this.entries.push(e);
      this.upload(e, src);
    }
  }
  /** Where a canvas (or image) is on the pages, placing it the first time. */
  pic(src) {
    let e = this.pics.get(src);
    if (e && !e.dead) {
      e.used = this.frame;
      return e;
    }
    const w = src.width, h = src.height;
    if (!(w > 0 && h > 0)) return null;
    let at = this.place(w, h);
    if (!at) {
      this.flush();
      this.rebuild(w * h);
      at = this.place(w, h);
    }
    if (!at) return null;
    e = { x: at.x, y: at.y, w, h, page: at.page, ref: new WeakRef(src), used: this.frame, dead: false };
    this.pics.set(src, e);
    this.entries.push(e);
    this.upload(e, src);
    return e;
  }
  /** Pictures onto the pages ahead of their first frame (while loading). */
  warm(...srcs) {
    if (this.on) {
      for (const s of srcs) if (s) this.pic(s);
    }
  }
  /** A canvas drawn before has been painted again: read anew next time. */
  dirty(src) {
    const e = this.pics.get(src);
    if (e) {
      e.dead = true;
      this.pics.delete(src);
    }
    const t = this.dynTexs.get(src);
    if (t) {
      for (const x of t.texs) this.gl.deleteTexture(x);
      this.dynTexs.delete(src);
    }
  }
  /** A picture of its own (bigger than a page, or pixels rewritten each
   * frame): a 2D texture (a ring of three), the rows y0..y1 of `img`
   * uploaded. Returns what a run draws from. */
  ownTex(src, img, y0 = 0, y1 = src.height) {
    const gl = this.gl, w = src.width, h = src.height;
    let t = this.dynTexs.get(src);
    gl.activeTexture(gl.TEXTURE4);
    if (!t || t.w !== w || t.h !== h) {
      if (t) for (const x of t.texs) gl.deleteTexture(x);
      t = { texs: [], i: 0, tex: null, w, h };
      for (let i = 0; i < 3; i++) {
        t.texs.push(this.tex(4));
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
      }
      this.dynTexs.set(src, t);
      y0 = 0;
      y1 = h;
    }
    if (img) {
      t.i = (t.i + 1) % t.texs.length;
      t.tex = t.texs[t.i];
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      if (img instanceof ImageData) {
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, w);
        gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y0);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y0, w, y1 - y0, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
        gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
      } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      this.stats.uploads++;
    } else if (!t.tex) {
      t.tex = t.texs[0];
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
    }
    return { tex: t.tex, w, h };
  }
  // ---- the ground's textures -----------------------------------------------
  // A big painted ground (Lodestar's floor window) as textures: color, glow
  // and the lift of what stands up from it (for `occlude`). `col` and `em`
  // are the canvases that stand for them: drawImage of either draws from the
  // texture. Whole when a ground starts, else the boxes painted since.
  groundStart(W, H, col = null, em = null) {
    const gl = this.gl;
    if (!this.on) return;
    if (this.groundW !== W || this.groundH !== H) {
      for (const [unit, name, fmt] of [[1, "groundCol", gl.RGBA8], [2, "groundEm", gl.RGBA8], [3, "lift", gl.R8]]) {
        gl.deleteTexture(this[name]);
        this[name] = this.tex(unit);
        gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, W, H);
        if (this.spare[name]) {
          gl.deleteTexture(this.spare[name]);
          this.spare[name] = null;
        }
      }
      this.groundW = W;
      this.groundH = H;
    }
    this.groundOn = true;
    if (col || em) this.groundSrc = [col, em];
    this.groundDirtyBoxes = [[0, 0, W, H]];
  }
  /** The ground's window moved by (dx, dy): its textures shifted on the GPU,
   * so only the strips exposed go up as they're painted. False if it can't. */
  groundShift(dx, dy) {
    const gl = this.gl, W = this.groundW, H = this.groundH;
    if (!this.on || !W || !this.groundOn) return false;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (adx >= W || ady >= H) return false;
    for (const b of this.groundDirtyBoxes) {
      b[0] -= dx;
      b[1] -= dy;
      b[2] -= dx;
      b[3] -= dy;
    }
    if (!this.shiftFb) this.shiftFb = gl.createFramebuffer();
    this.bind(this.shiftFb);
    for (const [unit, name, fmt] of [[1, "groundCol", gl.RGBA8], [2, "groundEm", gl.RGBA8], [3, "lift", gl.R8]]) {
      if (!this.spare[name]) {
        this.spare[name] = this.tex(unit);
        gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, W, H);
      }
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this[name], 0);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, this.spare[name]);
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, Math.max(0, -dx), Math.max(0, -dy), Math.max(0, dx), Math.max(0, dy), W - adx, H - ady);
      const t = this[name];
      this[name] = this.spare[name];
      this.spare[name] = t;
    }
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    this.bind(null);
    this.stats.uploads++;
    return true;
  }
  /** A box of the ground painted since: it goes up before the ground is next drawn. */
  groundDirty(x0, y0, x1, y1) {
    if (!this.on || x1 <= x0 || y1 <= y0) return;
    const d = this.groundDirtyBoxes;
    if (d.length > 12) this.groundDirtyBoxes = [[Math.min(...d.map((b) => b[0])), Math.min(...d.map((b) => b[1])), Math.max(...d.map((b) => b[2])), Math.max(...d.map((b) => b[3]))]];
    this.groundDirtyBoxes.push([x0, y0, x1, y1]);
  }
  get groundPending() {
    return this.groundDirtyBoxes.length > 0;
  }
  /** The boxes waiting go up from the ground's pixels (whole-ground arrays:
   * color and glow RGBA, lift one byte a pixel). */
  groundSync(col, em, lift) {
    const gl = this.gl, W = this.groundW, H = this.groundH;
    const srcs = [[1, this.groundCol, gl.RGBA, col, 4], [2, this.groundEm, gl.RGBA, em, 4], [3, this.lift, gl.RED, lift, 1]];
    for (const [x0, y0, x1, y1] of this.groundDirtyBoxes) {
      const bx0 = Math.max(0, x0), by0 = Math.max(0, y0), bw = Math.min(W, x1) - bx0, bh = Math.min(H, y1) - by0;
      if (bw <= 0 || bh <= 0) continue;
      for (const [unit, tex, fmt, data, bpp] of srcs) {
        if (!data) continue;
        let box = data;
        if (bw < W) {
          const n = bw * bh * bpp;
          if (!this.box || this.box.length < n) this.box = new Uint8Array(Math.max(n, 1 << 16));
          box = this.box.subarray(0, n);
          for (let y = 0; y < bh; y++) box.set(data.subarray(((by0 + y) * W + bx0) * bpp, ((by0 + y) * W + bx0 + bw) * bpp), y * bw * bpp);
        } else box = data.subarray(by0 * W * bpp, (by0 + bh) * W * bpp);
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, bx0, by0, bw, bh, fmt, gl.UNSIGNED_BYTE, box);
      }
      this.stats.uploads++;
    }
    this.groundDirtyBoxes.length = 0;
  }
  /** The light map that MAP quads multiply by: cells (RGBA, w × h), each
   * `cell` view px, the grid's origin at view px org. */
  setMap(cells, w, h, cell, org) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE11);
    gl.bindTexture(gl.TEXTURE_2D, this.mapTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, cells);
    this.map = { org, cell, w, h };
    this.stats.uploads++;
  }
  // ---- the batch -----------------------------------------------------------
  // The quads of a phase (the scene, or what's drawn over the lit picture)
  // gather in one array, in order, as runs sharing a blend mode, a clip and
  // a picture of its own; a whole-layer clear is a run of its own. The phase
  // is drawn at once (flush): the array goes up in one upload to the next of
  // a ring of buffers, and each run is an instanced draw from its offset.
  // The overlay's quads queue apart, drawn last onto the canvas.
  bind(fb) {
    if (this.boundFb === fb) return;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb);
    this.boundFb = fb;
  }
  run() {
    const c = this.cur;
    if (c && c.blend === this.blend && c.clip === this.clip && c.dyn === this.dyn) return c;
    this.cur = { start: this.n, n: 0, blend: this.blend, clip: this.clip, dyn: this.dyn };
    this.runs.push(this.cur);
    return this.cur;
  }
  /** A quad. over: onto the overlay's queue. xf: the 2 × 2 linear part of
   * the transform (default none). */
  push(over, x, y, w, h, u0, v0, u1, v1, page, r, g, b, a, flags, xf) {
    let q, k;
    if (over) {
      if (this.on_ >= this.ocap) {
        this.ocap *= 2;
        const nq = new Float32Array(this.ocap * Q);
        nq.set(this.oq);
        this.oq = nq;
      }
      q = this.oq;
      k = this.on_++ * Q;
    } else {
      if (this.n >= this.cap) {
        this.cap *= 2;
        const nq = new Float32Array(this.cap * Q);
        nq.set(this.q);
        this.q = nq;
      }
      this.drawn = true;
      this.run().n++;
      q = this.q;
      k = this.n++ * Q;
    }
    q[k] = x;
    q[k + 1] = y;
    q[k + 2] = w;
    q[k + 3] = h;
    q[k + 4] = u0;
    q[k + 5] = v0;
    q[k + 6] = u1;
    q[k + 7] = v1;
    q[k + 8] = page;
    q[k + 9] = r;
    q[k + 10] = g;
    q[k + 11] = b;
    q[k + 12] = a;
    q[k + 13] = over ? -2 : this.feet;
    q[k + 14] = flags;
    if (xf) {
      q[k + 15] = xf[0];
      q[k + 16] = xf[1];
      q[k + 17] = xf[2];
      q[k + 18] = xf[3];
    } else {
      q[k + 15] = 1;
      q[k + 16] = 0;
      q[k + 17] = 0;
      q[k + 18] = 1;
    }
  }
  /** The state the quads pushed next are drawn with. */
  state(blend, clip, dyn) {
    this.blend = blend;
    this.clip = clip;
    this.dyn = dyn;
  }
  /** A whole-layer clear, in its place in the order. */
  clearLayer(em, x, y, w, h) {
    this.runs.push({ clear: true, em, x, y, w, h });
    this.cur = null;
  }
  blendSet(blend) {
    const gl = this.gl;
    if (blend === 1) gl.blendFunc(gl.ONE, gl.ONE);
    else if (blend === 2) gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    else if (blend === 3) gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  scissor(clip) {
    const gl = this.gl;
    if (!clip) {
      gl.disable(gl.SCISSOR_TEST);
      return;
    }
    const x0 = Math.max(0, clip[0]), y0 = Math.max(0, clip[1]), x1 = Math.min(this.w, clip[2]), y1 = Math.min(this.h, clip[3]);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x0, Math.max(0, this.h - y1), Math.max(0, x1 - x0), Math.max(0, y1 - y0));
  }
  fbOf(target) {
    return target === "scene" ? this.scene.fb : target === "lit" ? this.lit.fb : null;
  }
  // the quad program and its textures, for the target, and the array q (n
  // quads) uploaded to the ring's next buffer
  ready(q, n, target) {
    const gl = this.gl, u = this.quad.u;
    this.bind(this.fbOf(target));
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.quad.p);
    gl.uniform2f(u.uViewF, this.w, this.h);
    gl.uniform2i(u.uView, this.w, this.h);
    gl.uniform2i(u.uCam, this.ox + this.groundX, this.oy + this.groundY);
    gl.uniform2i(u.uGroundSize, this.groundW, this.groundH);
    gl.uniform2f(u.uMapOrg, this.map.org[0], this.map.org[1]);
    gl.uniform1f(u.uMapCell, this.map.cell);
    gl.uniform2i(u.uMapSize, this.map.w, this.map.h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlasTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.groundCol);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.groundEm);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.lift);
    gl.activeTexture(gl.TEXTURE11);
    gl.bindTexture(gl.TEXTURE_2D, this.mapTex);
    gl.bindVertexArray(this.vao);
    this.bi = (this.bi + 1) % this.bufs.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[this.bi]);
    gl.bufferData(gl.ARRAY_BUFFER, q.subarray(0, n * Q), gl.STREAM_DRAW);
    this.stats.uploads++;
  }
  drawRun(start2, n, blend, clip, dyn) {
    const gl = this.gl;
    gl.uniform1i(this.quad.u.uBlend, blend);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, dyn ? dyn.tex : this.dynTex);
    this.blendSet(blend);
    this.scissor(clip);
    for (const [a, size, off] of this.attribs) if (a >= 0) gl.vertexAttribPointer(a, size, gl.FLOAT, false, Q * 4, (start2 * Q + off) * 4);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    this.stats.draws++;
    this.stats.quads += n;
  }
  /** The phase drawn: its runs in order, into the target. */
  flush() {
    const gl = this.gl;
    if (!this.runs.length) return;
    if (this.n) this.ready(this.q, this.n, this.target);
    else this.bind(this.fbOf(this.target));
    for (const r of this.runs) {
      if (r.clear) {
        this.scissor([r.x, r.y, r.x + r.w, r.y + r.h]);
        gl.clearBufferfv(gl.COLOR, r.em ? 1 : 0, ZERO);
        continue;
      }
      if (r.n) this.drawRun(r.start, r.n, r.blend, r.clip, r.dyn);
    }
    gl.disable(gl.SCISSOR_TEST);
    gl.bindVertexArray(null);
    this.n = 0;
    this.runs = [];
    this.cur = null;
  }
  drop() {
    this.n = 0;
    this.runs = [];
    this.cur = null;
  }
  // ---- a frame -------------------------------------------------------------
  /** A frame begins: the scene's layers cleared (color to black, glow to
   * nothing), the contexts reset. */
  frameBegin(ctxs = []) {
    if (!this.on) return;
    this.frame++;
    this.drop();
    this.on_ = 0;
    this.target = "scene";
    this.litDone = false;
    this.feet = -2;
    this.ox = 0;
    this.oy = 0;
    this.drawn = false;
    this.stats.quads = 0;
    this.stats.draws = 0;
    this.stats.uploads = 0;
    const gl = this.gl;
    this.bind(this.scene.fb);
    gl.clearBufferfv(gl.COLOR, 0, BLACK);
    gl.clearBufferfv(gl.COLOR, 1, ZERO);
    for (const c of ctxs) if (c) c.reset();
  }
  /** Nothing to show: the lit picture and the glow black. */
  blank() {
    const gl = this.gl;
    this.drop();
    this.bind(this.lit.fb);
    gl.clearBufferfv(gl.COLOR, 0, BLACK);
    gl.clearBufferfv(gl.COLOR, 1, ZERO);
    for (const p of this.passes) {
      this.bind(p.fb);
      gl.clearBufferfv(gl.COLOR, 0, ZERO);
    }
    this.litDone = true;
  }
  /** The scene is drawn: a light pass runs from it into the lit picture
   * (bind its program after this), and what's drawn after goes over that. */
  lightBegin() {
    const gl = this.gl;
    this.flush();
    this.bind(this.lit.fb);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
    gl.viewport(0, 0, this.w, this.h);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.triVao);
  }
  lightEnd() {
    const gl = this.gl;
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    this.target = "lit";
    this.litDone = true;
  }
  /** A whole light pass: `prog`'s fragment shader over the scene (its color
   * on unit 5 as `uScene`), the uniforms set by `set`, into the lit picture. */
  lightPass(prog, set2) {
    const gl = this.gl;
    this.lightBegin();
    gl.useProgram(prog.p);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneCol);
    if (prog.u.uScene !== void 0) gl.uniform1i(prog.u.uScene, 5);
    set2(gl, prog.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.lightEnd();
  }
  /** No light this frame (a picture lit already): the scene as drawn
   * becomes the lit picture, and what's drawn after goes over it. */
  plain() {
    if (!this.plainP) this.plainP = this.program(TRI_VS, PLAIN_FS, ["uScene"]);
    this.lightPass(this.plainP, () => {
    });
  }
  /** For tests: a layer's pixels read back (rows from the top, RGBA,
   * premultiplied): 'scene', 'lit' or 'glow'. Slow; never in a frame. */
  read(which) {
    const gl = this.gl, w = this.w, h = this.h, tex = which === "scene" ? this.sceneCol : which === "lit" ? this.litTex : this.sceneEm;
    this.flush();
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const raw2 = new Uint8Array(w * h * 4), data = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    this.boundFb = void 0;
    for (let y = 0; y < h; y++) data.set(raw2.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    return { w, h, data };
  }
  /** The grid bloom's passes from the glow layer, on the world's grid; cx,
   * cy the camera in the world (view px). */
  bloom(cx, cy) {
    const gl = this.gl;
    gl.disable(gl.BLEND);
    gl.useProgram(this.bloomP.p);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneEm);
    gl.uniform2i(this.bloomP.u.uView, this.w, this.h);
    gl.bindVertexArray(this.triVao);
    for (const p of this.passes) {
      const gx = Math.floor(cx / p.s) * p.s, gy = Math.floor(cy / p.s) * p.s;
      p.ox = gx - cx;
      p.oy = gy - cy;
      this.bind(p.fb);
      gl.viewport(0, 0, p.pw, p.ph);
      gl.uniform2i(this.bloomP.u.uOut, p.pw, p.ph);
      gl.uniform1f(this.bloomP.u.uS, p.s);
      gl.uniform2f(this.bloomP.u.uOrg, p.ox, p.oy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
  }
  /** What's queued over the lit picture drawn (before a finish of the game's
   * own, post.ts); false if the frame never got as far as the light. */
  litReady() {
    if (this.litDone) {
      this.flush();
      return true;
    }
    this.drop();
    return false;
  }
  /** The frame onto the canvas: the lit picture with the grid bloom added,
   * then the overlay's quads. */
  frameEnd() {
    const gl = this.gl;
    if (!this.on || !this.w) return;
    if (this.litReady()) this.bloom(-this.ox, -this.oy);
    this.bind(null);
    gl.viewport(0, 0, this.w, this.h);
    gl.disable(gl.BLEND);
    gl.useProgram(this.outP.p);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, this.litTex);
    const pass = new Float32Array(16), size = new Float32Array(8);
    this.passes.forEach((p, k) => {
      gl.activeTexture(gl.TEXTURE6 + k);
      gl.bindTexture(gl.TEXTURE_2D, p.tex);
      pass[k * 4] = p.s;
      pass[k * 4 + 1] = p.a;
      pass[k * 4 + 2] = p.ox;
      pass[k * 4 + 3] = p.oy;
      size[k * 2] = p.pw;
      size[k * 2 + 1] = p.ph;
    });
    gl.uniform2i(this.outP.u.uView, this.w, this.h);
    gl.uniform1i(this.outP.u.uN, this.passes.length);
    gl.uniform4fv(this.outP.u.uPass, pass);
    gl.uniform2fv(this.outP.u.uPassSize, size);
    gl.bindVertexArray(this.triVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    this.overlay();
  }
  /** The overlay's quads, unlit, onto the canvas. */
  overlay() {
    const gl = this.gl;
    if (!this.on_) return;
    this.ready(this.oq, this.on_, "canvas");
    this.drawRun(0, this.on_, 0, null, this.odyn);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindVertexArray(null);
    this.on_ = 0;
    this.odyn = null;
  }
  /** A stand-in for a 2D context drawing into `layers` (F.COL, F.EM or both);
   * `over`: onto the overlay's queue, unlit over the finished frame. */
  ctx(layers, over = false) {
    return new Ctx(this, layers, over);
  }
};
var colors = /* @__PURE__ */ new Map();
function parseColor(s) {
  let c = colors.get(s);
  if (c) return c;
  let m;
  if (m = /^#([0-9a-f]{3,4})$/i.exec(s)) {
    const h = m[1];
    c = [parseInt(h[0] + h[0], 16) / 255, parseInt(h[1] + h[1], 16) / 255, parseInt(h[2] + h[2], 16) / 255, h.length > 3 ? parseInt(h[3] + h[3], 16) / 255 : 1];
  } else if (m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s)) {
    c = [parseInt(m[1].slice(0, 2), 16) / 255, parseInt(m[1].slice(2, 4), 16) / 255, parseInt(m[1].slice(4, 6), 16) / 255, m[2] ? parseInt(m[2], 16) / 255 : 1];
  } else if (m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s)) c = [+m[1] / 255, +m[2] / 255, +m[3] / 255, m[4] === void 0 ? 1 : +m[4]];
  else {
    const x = document.createElement("canvas").getContext("2d");
    x.fillStyle = s;
    x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    c = d[3] ? [d[0] / d[3], d[1] / d[3], d[2] / d[3], d[3] / 255] : [0, 0, 0, 0];
  }
  if (colors.size > 4096) colors.clear();
  colors.set(s, c);
  return c;
}
var Gradient = class {
  constructor(x0, y0, x1, y1) {
    this.stops = [];
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x1;
    this.y1 = y1;
  }
  addColorStop(t, color) {
    this.stops.push([t, parseColor(color)]);
    this.stops.sort((a, b) => a[0] - b[0]);
  }
  /** The color at t (0..1 along it), unpremultiplied [r, g, b, a]. */
  at(t) {
    const S = this.stops;
    if (!S.length) return [0, 0, 0, 0];
    if (t <= S[0][0]) return S[0][1];
    for (let i = 1; i < S.length; i++) if (t <= S[i][0]) {
      const [ta, a] = S[i - 1], [tb, b] = S[i], k = tb > ta ? (t - ta) / (tb - ta) : 0;
      return a.map((v, j) => v + (b[j] - v) * k);
    }
    return S[S.length - 1][1];
  }
};
var RadialGradient = class {
  constructor(x0, y0, r0, x1, y1, r1) {
    this.css = [];
    this.x0 = x0;
    this.y0 = y0;
    this.r0 = r0;
    this.x1 = x1;
    this.y1 = y1;
    this.r1 = r1;
  }
  addColorStop(t, color) {
    this.css.push([t, color]);
  }
  key() {
    return [this.x0 - this.x1, this.y0 - this.y1, this.r0, this.r1].join(",") + ":" + this.css.map(([t, c]) => t + c).join(";");
  }
};
var radials = /* @__PURE__ */ new Map();
var Ctx = class {
  constructor(gpu, layers, over = false) {
    this.isGpu = true;
    this.globalAlpha = 1;
    this.imageSmoothingEnabled = false;
    /** Pictures drawn are multiplied by this color ([r, g, b] 0..1), or not. */
    this.tint = null;
    /** Pictures drawn are multiplied by the light map (light.ts's smooth model). */
    this.lightMap = false;
    this._fs = "#000000";
    this._rgba = [0, 0, 0, 1];
    this._op = "source-over";
    this._blend = 0;
    // the transform: [a, b, c, d, e, f] as a 2D context's
    this.m = [1, 0, 0, 1, 0, 0];
    this.clipBox = null;
    this.path = null;
    this.stack = [];
    this.gpu = gpu;
    this.layers = layers;
    this.over = over;
    this.canvas = gpu.canvas;
    this.reset();
  }
  /** For code that checks: this is the GPU's stand-in. */
  get gpuCtx() {
    return true;
  }
  reset() {
    this.fillStyle = "#000000";
    this.globalAlpha = 1;
    this.globalCompositeOperation = "source-over";
    this.imageSmoothingEnabled = false;
    this.m = [1, 0, 0, 1, 0, 0];
    this.clipBox = null;
    this.stack = [];
    this.path = null;
    this.tint = null;
    this.lightMap = false;
  }
  get fillStyle() {
    return this._fs;
  }
  set fillStyle(v) {
    if (v !== this._fs) {
      this._fs = v;
      if (typeof v === "string") this._rgba = parseColor(v);
    }
  }
  get globalCompositeOperation() {
    return this._op;
  }
  set globalCompositeOperation(v) {
    this._op = v;
    this._blend = BLEND[v] || 0;
  }
  // (Lodestar's names for the translate, kept)
  get tx() {
    return this.m[4];
  }
  set tx(v) {
    this.m[4] = v;
  }
  get ty() {
    return this.m[5];
  }
  set ty(v) {
    this.m[5] = v;
  }
  save() {
    this.stack.push([this.m.slice(), this.clipBox, this.globalAlpha, this._fs, this._op, this.imageSmoothingEnabled, this.tint, this.lightMap]);
  }
  restore() {
    const s = this.stack.pop();
    if (!s) return;
    this.m = s[0];
    this.clipBox = s[1];
    this.globalAlpha = s[2];
    this.fillStyle = s[3];
    this.globalCompositeOperation = s[4];
    this.imageSmoothingEnabled = s[5];
    this.tint = s[6];
    this.lightMap = s[7];
  }
  translate(x, y) {
    const m = this.m;
    m[4] += m[0] * x + m[2] * y;
    m[5] += m[1] * x + m[3] * y;
  }
  scale(sx, sy) {
    const m = this.m;
    m[0] *= sx;
    m[1] *= sx;
    m[2] *= sy;
    m[3] *= sy;
  }
  rotate(a) {
    const m = this.m, c = Math.cos(a), s = Math.sin(a), [a0, b0, c0, d0] = m;
    m[0] = a0 * c + c0 * s;
    m[1] = b0 * c + d0 * s;
    m[2] = c0 * c - a0 * s;
    m[3] = d0 * c - b0 * s;
  }
  setTransform(a, b, c, d, e, f) {
    this.m = [a, b, c, d, e, f];
  }
  resetTransform() {
    this.m = [1, 0, 0, 1, 0, 0];
  }
  plain() {
    const m = this.m;
    return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1;
  }
  beginPath() {
    this.path = null;
  }
  rect(x, y, w, h) {
    this.path = this.box(x, y, w, h);
  }
  // a box in the context's space as view px [x0, y0, x1, y1] (scaled and
  // moved; a rotated transform's box is its bounds)
  box(x, y, w, h) {
    const m = this.m, xs = [x, x + w], ys = [y, y + h], px = [], py = [];
    for (const a of xs) for (const b of ys) {
      px.push(m[0] * a + m[2] * b + m[4]);
      py.push(m[1] * a + m[3] * b + m[5]);
    }
    return [Math.min(...px), Math.min(...py), Math.max(...px), Math.max(...py)];
  }
  covers(x, y, w, h) {
    const m = this.m;
    if (m[1] !== 0 || m[2] !== 0) return false;
    const b = this.box(x, y, w, h);
    return b[0] <= 0 && b[1] <= 0 && b[2] >= this.gpu.w && b[3] >= this.gpu.h;
  }
  closePath() {
  }
  clip() {
    if (this.path) {
      const p = this.path, c = this.clipBox;
      this.clipBox = c ? [Math.max(c[0], p[0]), Math.max(c[1], p[1]), Math.min(c[2], p[2]), Math.min(c[3], p[3])] : p;
    }
  }
  createLinearGradient(x0, y0, x1, y1) {
    return new Gradient(x0, y0, x1, y1);
  }
  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    return new RadialGradient(x0, y0, r0, x1, y1, r1);
  }
  setState(dyn) {
    if (!this.over) this.gpu.state(this._blend, this.clipBox, dyn);
  }
  // a quad at (x, y, w, h) in the context's own space, through its transform
  quad(x, y, w, h, u0, v0, u1, v1, page, r, g, b, a, flags) {
    const m = this.m;
    if (this.plain()) this.gpu.push(this.over, x + m[4], y + m[5], w, h, u0, v0, u1, v1, page, r, g, b, a, flags);
    else this.gpu.push(this.over, m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5], w, h, u0, v0, u1, v1, page, r, g, b, a, flags, [m[0], m[1], m[2], m[3]]);
  }
  fillRect(x, y, w, h) {
    const al = this.globalAlpha, G = this.gpu;
    if (al <= 0 || !(w > 0 && h > 0)) return;
    if (this._fs instanceof Gradient) {
      this.fillGradient(this._fs, x, y, w, h);
      return;
    }
    if (this._fs instanceof RadialGradient) {
      this.fillRadial(this._fs, x, y, w, h);
      return;
    }
    const c = this._rgba, ca = c[3] * al;
    if (!this.over && !G.drawn && G.target === "scene" && ca >= 1 && !this.clipBox && this._blend === 0 && this.covers(x, y, w, h)) {
      if (c[0] || c[1] || c[2]) {
        const gl = G.gl;
        G.bind(G.scene.fb);
        if (this.layers & F.COL) gl.clearBufferfv(gl.COLOR, 0, new Float32Array([c[0], c[1], c[2], 1]));
        if (this.layers & F.EM) gl.clearBufferfv(gl.COLOR, 1, new Float32Array([c[0], c[1], c[2], 1]));
      }
      return;
    }
    this.setState(null);
    this.quad(x, y, w, h, 0, 0, 1, 1, 0, c[0] * ca, c[1] * ca, c[2] * ca, ca, this.layers | F.SOLID);
  }
  // A linear gradient as strips across it, one view px each, each the
  // gradient's color at its middle (as the 2D canvas reads it at each pixel's).
  fillGradient(gr, x, y, w, h) {
    const dx = gr.x1 - gr.x0, dy = gr.y1 - gr.y0, len2 = dx * dx + dy * dy || 1, vertical = Math.abs(dy) >= Math.abs(dx), al = this.globalAlpha;
    this.setState(null);
    const n = Math.max(1, Math.ceil(vertical ? h : w));
    for (let i = 0; i < n; i++) {
      const px = vertical ? x + w / 2 : x + i + 0.5, py = vertical ? y + i + 0.5 : y + h / 2;
      const t = Math.min(1, Math.max(0, ((px - gr.x0) * dx + (py - gr.y0) * dy) / len2)), c = gr.at(t), ca = c[3] * al;
      if (ca <= 0) continue;
      if (vertical) this.quad(x, y + i, w, Math.min(1, h - i), 0, 0, 1, 1, 0, c[0] * ca, c[1] * ca, c[2] * ca, ca, this.layers | F.SOLID);
      else this.quad(x + i, y, Math.min(1, w - i), h, 0, 0, 1, 1, 0, c[0] * ca, c[1] * ca, c[2] * ca, ca, this.layers | F.SOLID);
    }
  }
  // A radial gradient, rasterized by a 2D canvas once (at the view's scale)
  // for its shape and the box's place in it, and drawn as a picture.
  fillRadial(gr, x, y, w, h) {
    const m = this.m, sx = Math.hypot(m[0], m[1]) || 1, sy = Math.hypot(m[2], m[3]) || 1;
    const key = [gr.key(), x - gr.x1, y - gr.y1, w, h, sx, sy].map((v) => typeof v === "number" ? Math.round(v * 100) / 100 : v).join("|");
    let c = radials.get(key);
    if (!c) {
      const cw = Math.max(1, Math.ceil(w * sx)), ch = Math.max(1, Math.ceil(h * sy));
      c = document.createElement("canvas");
      c.width = cw;
      c.height = ch;
      const g = c.getContext("2d");
      g.scale(cw / w, ch / h);
      g.translate(-x, -y);
      const rg = g.createRadialGradient(gr.x0, gr.y0, gr.r0, gr.x1, gr.y1, gr.r1);
      for (const [t, col] of gr.css) rg.addColorStop(t, col);
      g.fillStyle = rg;
      g.fillRect(x, y, w, h);
      if (radials.size > 64) radials.clear();
      radials.set(key, c);
    }
    const smooth2 = this.imageSmoothingEnabled;
    this.imageSmoothingEnabled = true;
    this.drawImage(c, x, y, w, h);
    this.imageSmoothingEnabled = smooth2;
  }
  clearRect(x, y, w, h) {
    if (this.over) return;
    const G = this.gpu;
    if (this.covers(x, y, w, h) && !this.clipBox) {
      if (!G.drawn && G.target === "scene") return;
      if (this.layers & F.EM) G.clearLayer(true, 0, 0, G.w, G.h);
      if (this.layers & F.COL) G.clearLayer(false, 0, 0, G.w, G.h);
      return;
    }
    G.state(2, this.clipBox, null);
    this.quad(x, y, w, h, 0, 0, 1, 1, 0, 0, 0, 0, 1, this.layers | F.SOLID);
  }
  // drawImage(img, dx, dy), (img, dx, dy, dw, dh), (img, sx, sy, sw, sh, dx, dy, dw, dh)
  drawImage(img, a1, a2, a3, a4, a5, a6, a7, a8) {
    const al = this.globalAlpha, G = this.gpu;
    if (al <= 0 || !img) return;
    let sx, sy, sw, sh, dx, dy, dw, dh;
    if (a5 === void 0) {
      sx = 0;
      sy = 0;
      sw = img.width;
      sh = img.height;
      dx = a1;
      dy = a2;
      dw = a3 === void 0 ? sw : a3;
      dh = a4 === void 0 ? sh : a4;
    } else {
      sx = a1;
      sy = a2;
      sw = a3;
      sh = a4;
      dx = a5;
      dy = a6;
      dw = a7;
      dh = a8;
    }
    if (!(sw > 0 && sh > 0 && dw !== 0 && dh !== 0)) return;
    if (sx < 0) {
      const k = -sx / sw;
      dx += dw * k;
      dw -= dw * k;
      sw += sx;
      sx = 0;
    }
    if (sy < 0) {
      const k = -sy / sh;
      dy += dh * k;
      dh -= dh * k;
      sh += sy;
      sy = 0;
    }
    if (sx + sw > img.width) {
      const k = (sx + sw - img.width) / sw;
      dw -= dw * k;
      sw = img.width - sx;
    }
    if (sy + sh > img.height) {
      const k = (sy + sh - img.height) / sh;
      dh -= dh * k;
      sh = img.height - sy;
    }
    if (!(sw > 0 && sh > 0)) return;
    let flags = this.layers | (this.imageSmoothingEnabled ? F.SMOOTH : 0) | (this.lightMap ? F.MAP : 0), u0, v0, page = 0, dyn = null;
    if (G.groundOn && (img === G.groundSrc[0] || img === G.groundSrc[1])) {
      if (G.groundPending && G.onGroundDraw) G.onGroundDraw();
      flags = flags & ~F.SMOOTH | (img === G.groundSrc[0] ? F.GROUND : F.GROUNDEM);
      u0 = sx;
      v0 = sy;
    } else if (img.gpuLive || img.gpuOwn || img.width > G.o.atlas || img.height > G.o.atlas) {
      const t2 = G.dynTexs.get(img);
      dyn = t2 && t2.tex && !img.gpuLive ? { tex: t2.tex } : G.ownTex(img, img, 0, img.height);
      flags |= F.DYN;
      u0 = sx;
      v0 = sy;
      if (flags & F.SMOOTH && dw === sw && dh === sh) flags &= ~F.SMOOTH;
    } else {
      const e = G.pic(img);
      if (!e) return;
      u0 = e.x + sx;
      v0 = e.y + sy;
      page = e.page;
      if (flags & F.SMOOTH && dw === sw && dh === sh) flags &= ~F.SMOOTH;
    }
    if (dyn && this.over) G.odyn = dyn;
    else this.setState(dyn);
    const t = this.tint;
    this.quad(dx, dy, dw, dh, u0, v0, u0 + sw, v0 + sh, page, t ? t[0] * al : al, t ? t[1] * al : al, t ? t[2] * al : al, al, flags);
  }
  /** Pixels rewritten each frame (an ImageData): the box sx, sy, sw, sh of
   * them at dx, dy (scaled to dw × dh if given, smoothly with
   * imageSmoothingEnabled), uploaded (the rows that changed) and drawn. */
  drawPixels(img, sx, sy, sw, sh, dx, dy, dw = sw, dh = sh) {
    const al = this.globalAlpha, G = this.gpu;
    if (al <= 0 || !(sw > 0 && sh > 0)) return;
    const scaled = dw !== sw || dh !== sh;
    const t = G.ownTex(img, img, scaled ? 0 : sy, scaled ? img.height : sy + sh);
    if (this.over) G.odyn = t;
    else this.setState(t);
    const flags = this.layers | F.DYN | (scaled && this.imageSmoothingEnabled ? F.SMOOTH : 0) | (this.lightMap ? F.MAP : 0);
    this.quad(dx, dy, dw, dh, sx, sy, sx + sw, sy + sh, 0, al, al, al, al, flags);
  }
};

// src/pixels/light.ts
var light_exports = {};
__export(light_exports, {
  Smooth: () => Smooth
});
var SMOOTH_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D uScene, uMap;
uniform ivec2 uSize, uMapSize;
uniform vec2 uOrg; uniform float uCell, uAdd;
out vec4 o;
vec3 cell(vec2 t) { return texelFetch(uMap, clamp(ivec2(t), ivec2(0), uMapSize - 1), 0).rgb; }
void main() {
  vec3 p = texelFetch(uScene, ivec2(gl_FragCoord.xy), 0).rgb;
  vec2 v = vec2(gl_FragCoord.x, float(uSize.y) - gl_FragCoord.y);
  vec2 t = (v - uOrg) / uCell - 0.5, f = fract(t), t0 = floor(t);
  vec3 m = mix(mix(cell(t0), cell(t0 + vec2(1.0, 0.0)), f.x), mix(cell(t0 + vec2(0.0, 1.0)), cell(t0 + 1.0), f.x), f.y);
  o = vec4(clamp(p * m + m * uAdd, 0.0, 1.0), 1.0);
}`;
var Smooth = class {
  constructor(gpu) {
    this.gpu = gpu;
    this.prog = gpu.program(TRI_VS, SMOOTH_FS, ["uScene", "uMap", "uSize", "uMapSize", "uOrg", "uCell", "uAdd"]);
  }
  /** Lights the scene drawn so far into the lit picture. */
  draw(f) {
    const G = this.gpu;
    G.setMap(f.cells, f.w, f.h, f.cell, f.org);
    G.lightPass(this.prog, (gl, u) => {
      gl.uniform1i(u.uMap, 11);
      gl.uniform2i(u.uSize, G.w, G.h);
      gl.uniform2i(u.uMapSize, f.w, f.h);
      gl.uniform2f(u.uOrg, f.org[0], f.org[1]);
      gl.uniform1f(u.uCell, f.cell);
      gl.uniform1f(u.uAdd, f.add ?? 0.1);
    });
  }
};

// src/pixels/post.ts
var post_exports = {};
__export(post_exports, {
  Blur: () => Blur
});
var Blur = class {
  constructor(gpu) {
    this.fb = [];
    this.w = 0;
    this.h = 0;
    this.gpu = gpu;
    const gl = gpu.gl, fs = (s) => "#version 300 es\nprecision highp float;\n" + s;
    this.down = gpu.program(TRI_VS, fs("uniform sampler2D src; uniform vec2 size; out vec4 o; void main(){ o = vec4(texture(src, gl_FragCoord.xy / size).rgb, 1.0); }"), ["src", "size"]);
    this.blur = gpu.program(TRI_VS, fs(`uniform sampler2D src; uniform vec2 size; uniform vec2 dir; out vec4 o;
      void main(){ vec2 uv = gl_FragCoord.xy / size, d = dir / size;
        vec3 c = texture(src, uv).rgb * 0.227027;
        c += (texture(src, uv + d * 1.384615).rgb + texture(src, uv - d * 1.384615).rgb) * 0.316216;
        c += (texture(src, uv + d * 3.230769).rgb + texture(src, uv - d * 3.230769).rgb) * 0.070270;
        o = vec4(c, 1.0); }`), ["src", "size", "dir"]);
    this.comp = gpu.program(TRI_VS, fs(`uniform sampler2D scene, glow, b1, b2; uniform vec2 low, b1s, b2s; uniform float scale, screenH, fade, time, near, far;
      uniform vec4 wet[4]; uniform vec2 wetk[4]; uniform int nwet; out vec4 o;
      vec3 at(vec2 p) {
        vec2 q = vec2(p.x, low.y - p.y);
        vec2 uv = (floor(q) + 0.5) / low;
        vec3 c = texture(scene, uv).rgb + texture(glow, uv).rgb;
        c += texture(b1, q / (b1s * 2.0)).rgb * near + texture(b2, q / (b2s * 4.0)).rgb * far;
        return c;
      }
      void main() {
        vec2 p = vec2(gl_FragCoord.x, screenH - gl_FragCoord.y) / scale;
        vec3 c = at(p);
        for (int i = 0; i < 4; i++) {
          if (i >= nwet) break;
          vec4 w = wet[i]; float k = floor(p.y) - w.y;
          if (p.x >= w.x && p.x < w.z && k >= 0.0 && k < w.w && w.y - 1.0 - k >= 0.0) {
            float off = k > 2.0 ? floor(sin(k * 0.9 + time * 2.0 + k * k * 0.05) + 0.5) : 0.0;
            float a = wetk[i].x * (1.0 - k / wetk[i].y) * (mod(k, 2.0) > 0.5 ? 0.8 : 1.0);
            c += at(vec2(floor(p.x) + off + 0.5, w.y - 1.0 - k + 0.5)) * a;
          }
        }
        o = vec4(mix(min(c, vec3(1.0)), vec3(0.0), fade), 1.0);
      }`), ["scene", "glow", "b1", "b2", "low", "b1s", "b2s", "scale", "screenH", "fade", "time", "near", "far", "wet", "wetk", "nwet"]);
    for (let i = 0; i < 4; i++) {
      const t = gpu.tex(5, gl.TEXTURE_2D, gl.LINEAR), f = gl.createFramebuffer();
      this.fb.push({ t, f, w: 0, h: 0 });
    }
    this.sampler = gl.createSampler();
    gl.samplerParameteri(this.sampler, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.samplerParameteri(this.sampler, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.samplerParameteri(this.sampler, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.samplerParameteri(this.sampler, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  size(w, h) {
    const gl = this.gpu.gl;
    this.w = w;
    this.h = h;
    const half = [Math.ceil(w / 2), Math.ceil(h / 2)], quarter = [Math.ceil(w / 4), Math.ceil(h / 4)];
    [half, half, quarter, quarter].forEach(([fw, fh], i) => {
      const F2 = this.fb[i];
      F2.w = fw;
      F2.h = fh;
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, F2.t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      this.gpu.bind(F2.f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, F2.t, 0);
    });
    this.gpu.bind(null);
  }
  pass(P, target, src, smooth2, uniforms) {
    const gl = this.gpu.gl;
    gl.useProgram(P.p);
    this.gpu.bind(target.f);
    gl.viewport(0, 0, target.w, target.h);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, src);
    gl.bindSampler(5, smooth2 ? this.sampler : null);
    gl.uniform1i(P.u.src, 5);
    gl.uniform2f(P.u.size, target.w, target.h);
    if (uniforms) uniforms(P.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindSampler(5, null);
  }
  /** The frame onto the canvas, from the Gpu's lit picture and glow. */
  finish(o) {
    const G = this.gpu, gl = G.gl;
    if (!G.on || !G.w) return;
    G.litReady();
    if (this.w !== G.w || this.h !== G.h) this.size(G.w, G.h);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(G.triVao);
    const [A, B, C, D] = this.fb;
    this.pass(this.down, A, G.sceneEm, true);
    this.pass(this.blur, B, A.t, false, (u2) => gl.uniform2f(u2.dir, 1, 0));
    this.pass(this.blur, A, B.t, false, (u2) => gl.uniform2f(u2.dir, 0, 1));
    this.pass(this.down, C, A.t, false);
    this.pass(this.blur, D, C.t, false, (u2) => gl.uniform2f(u2.dir, 1.6, 0));
    this.pass(this.blur, C, D.t, false, (u2) => gl.uniform2f(u2.dir, 0, 1.6));
    const P = this.comp, u = P.u;
    gl.useProgram(P.p);
    G.bind(null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    [[G.litTex, "scene", false], [G.sceneEm, "glow", true], [A.t, "b1", false], [C.t, "b2", false]].forEach(([t, name, smooth2], i) => {
      gl.activeTexture(gl.TEXTURE5 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.bindSampler(5 + i, smooth2 ? this.sampler : null);
      gl.uniform1i(u[name], 5 + i);
    });
    gl.uniform2f(u.low, G.w, G.h);
    gl.uniform2f(u.b1s, A.w, A.h);
    gl.uniform2f(u.b2s, C.w, C.h);
    gl.uniform1f(u.scale, o.out);
    gl.uniform1f(u.screenH, gl.drawingBufferHeight);
    gl.uniform1f(u.fade, Math.min(1, Math.max(0, o.fade || 0)));
    gl.uniform1f(u.time, o.time || 0);
    gl.uniform1f(u.near, o.near ?? 0.8);
    gl.uniform1f(u.far, o.far ?? 0.55);
    const wets = o.wets || [], wv = new Float32Array(16), wk = new Float32Array(8);
    wets.slice(0, 4).forEach((w, i) => {
      wv.set([w.x0, w.y0, w.x1, w.depth], i * 4);
      wk.set([w.k, w.depth], i * 2);
    });
    gl.uniform4fv(u.wet, wv);
    gl.uniform2fv(u.wetk, wk);
    gl.uniform1i(u.nwet, Math.min(4, wets.length));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    for (let i = 0; i < 4; i++) gl.bindSampler(5 + i, null);
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    G.overlay();
  }
};

// src/pixels/sprite.ts
var sprite_exports = {};
__export(sprite_exports, {
  Shapes: () => Shapes,
  canvas: () => canvas,
  disc: () => disc,
  ellipse: () => ellipse,
  enlarged: () => enlarged,
  flipSprite: () => flipSprite,
  flipped: () => flipped,
  outline: () => outline,
  scale15Rows: () => scale15Rows,
  scale2xRows: () => scale2xRows,
  scale3xRows: () => scale3xRows,
  scaleRows: () => scaleRows,
  spriteFrom: () => spriteFrom,
  tinted: () => tinted
});

// src/pixels/shapes.ts
var toRgb = (c) => typeof c === "string" ? rgb(c) : c;
var N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
var _Shapes = class _Shapes {
  constructor(w, h, seed = 1, look) {
    this.w = w;
    this.h = h;
    this.c = new Array(w * h).fill(null);
    this.g = new Uint8Array(w * h);
    this.p = new Uint8Array(w * h);
    this.seed = seed;
    this.n = 0;
    this.ax = w / 2;
    this.ay = h;
    this.flat = true;
    this.line = true;
    this.pid = 0;
    this.soft = /* @__PURE__ */ new Set();
    this.look = look ? Object.assign({}, _Shapes.LOOK, look) : _Shapes.LOOK;
  }
  /** A flat figure, outlined (the default). */
  static figure(w, h, seed, look) {
    const S = new this(w, h, seed, look);
    S.flat = S.line = true;
    return S;
  }
  /** Soft runs of close tones, no outline. */
  static soft(w, h, seed, look) {
    const S = new this(w, h, seed, look);
    S.flat = S.line = false;
    return S;
  }
  /** The next shapes are a new part, drawn over what came before; a part
   * that doesn't cast (hair on a face) leaves no shadow line on what's under it. */
  part(cast = true) {
    this.pid = Math.min(255, this.pid + 1);
    if (!cast) this.soft.add(this.pid);
  }
  /** The sprite's own seeded stream (soft runs). */
  rnd() {
    return hash(this.n++, 17, this.seed);
  }
  /** A tone from a shading value, flat: shadow, base or light. */
  band(s, lo, hi) {
    return lo + Math.round((hi - lo) * (s < 0.32 ? 0.18 : s < 0.7 ? 0.5 : 0.82));
  }
  /** One pixel (rounded; off the sprite, or no color, it's nothing). */
  px(x, y, col, glow) {
    x = Math.round(x);
    y = Math.round(y);
    if (!col || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.c[i] = toRgb(col);
    this.g[i] = glow ? 1 : 0;
    this.p[i] = this.pid;
  }
  get(x, y) {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.c[y * this.w + x];
  }
  /** A rounded volume: its tone from how it faces the upper left. */
  ell(cx, cy, rx, ry, ramp, o = {}) {
    const R = ramp.map(toRgb), lo = o.lo || 0, hi = o.hi === void 0 ? R.length - 1 : o.hi;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      let run = 0, rt = 0;
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = u * u + v * v;
        if (d > 1 || o.mask && !o.mask(x, y)) continue;
        const nz = Math.sqrt(Math.max(0, 1 - d)), s = (u * -0.55 + v * -0.8) * 0.8 + nz * 0.5 - 0.15 + (o.bias || 0);
        if (this.flat) {
          this.px(x, y, R[this.band(s, lo, hi)], o.glow);
          continue;
        }
        if (run <= 0) {
          rt = (this.rnd() + this.rnd() - 1) * 0.42;
          run = 2 + (this.rnd() * 3 | 0);
        }
        run--;
        this.px(x, y, R[clamp(Math.round(lo + (hi - lo) * clamp(s, 0, 1) + rt), lo, hi)], o.glow);
      }
    }
  }
  /** A box: flat, a panel lit along its top and left; soft, a rounded volume filled out to its corners. */
  box(x0, y0, x1, y1, ramp, o = {}) {
    if (this.flat) {
      const R2 = ramp.map(toRgb), lo = o.lo || 0, hi = o.hi === void 0 ? R2.length - 1 : o.hi;
      for (let y = Math.round(y0); y <= Math.round(y1); y++) for (let x = Math.round(x0); x <= Math.round(x1); x++) {
        const s = y === Math.round(y0) || x === Math.round(x0) && y1 - y0 > 1 ? 0.9 : y === Math.round(y1) || x === Math.round(x1) && y1 - y0 > 1 ? 0.1 : 0.5 + (o.bias || 0);
        this.px(x, y, R2[this.band(s, lo, hi)], o.glow);
      }
      return;
    }
    this.ell((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + 0.7, (y1 - y0) / 2 + 0.7, ramp, Object.assign({}, o, { mask: (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1 }));
    const R = ramp.map(toRgb);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!this.get(x, y) || this.flat && this.p[y * this.w + x] !== this.pid) this.px(x, y, R[(o.lo || 0) + 1] || R[0], o.glow);
  }
  /** A limb from a to b, w wide: lit along its upper-left side. */
  limb(ax, ay, bx, by, w, ramp, o = {}) {
    const R = ramp.map(toRgb), L = Math.hypot(bx - ax, by - ay) || 1, n = Math.ceil(L * 3), nx = -(by - ay) / L, ny = (bx - ax) / L;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      for (let s = -w / 2; s <= w / 2; s += 0.5) {
        const lit = nx * s * -0.55 + ny * s * -0.8;
        if (this.flat) {
          this.px(x + nx * s, y + ny * s, R[this.band(0.5 + lit * 0.7 / Math.max(0.5, w / 2), 0, R.length - 1)], o.glow);
          continue;
        }
        this.px(x + nx * s, y + ny * s, R[clamp(Math.round((R.length - 1) * (0.5 + lit * 0.5 / Math.max(0.5, w / 2))), 0, R.length - 1)], o.glow);
      }
    }
  }
  /** A capsule from a (radius ra) to b (radius rb): a limb with volume, its
   * tone from how its surface faces the upper left. */
  cap(ax, ay, bx, by, ra, rb, ramp, o = {}) {
    const R = ramp.map(toRgb), lo = o.lo || 0, hi = o.hi === void 0 ? R.length - 1 : o.hi;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, m = Math.max(ra, rb) + 1;
    for (let y = Math.floor(Math.min(ay, by) - m); y <= Math.ceil(Math.max(ay, by) + m); y++) {
      let run = 0, rt = 0;
      for (let x = Math.floor(Math.min(ax, bx) - m); x <= Math.ceil(Math.max(ax, bx) + m); x++) {
        const px = x + 0.5, py = y + 0.5, t = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1), qx = ax + dx * t, qy = ay + dy * t, r = ra + (rb - ra) * t;
        const ux = (px - qx) / r, uy = (py - qy) / r, d = ux * ux + uy * uy;
        if (d > 1 || o.mask && !o.mask(x, y)) continue;
        const nz = Math.sqrt(Math.max(0, 1 - d)), sh = (ux * -0.6 + uy * -0.75) * 0.75 + nz * 0.45 - 0.1 + (o.bias || 0);
        if (this.flat) {
          this.px(x, y, R[this.band(sh, lo, hi)], o.glow);
          continue;
        }
        if (run <= 0) {
          rt = (this.rnd() + this.rnd() - 1) * 0.35;
          run = 2 + (this.rnd() * 2 | 0);
        }
        run--;
        this.px(x, y, R[clamp(Math.round(lo + (hi - lo) * clamp(sh, 0, 1) + rt), lo, hi)], o.glow);
      }
    }
  }
  /** A shape from a polygon, shaded across each row (lit on its left, shaded
   * on its right) and down it, like cloth over a body. */
  shape(pts, ramp, o = {}) {
    const R = ramp.map(toRgb), n1 = R.length - 1;
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if (a[1] <= yc && yc < b[1] || b[1] <= yc && yc < a[1]) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      let run = 0, rt = 0;
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) {
        const u = (x + 0.5 - xs[i]) / Math.max(1, xs[i + 1] - xs[i]), v = (yc - y0) / Math.max(1, y1 - y0);
        let sh = 0.78 - u * 0.62 - v * (o.down === void 0 ? 0.18 : o.down) + (u < 0.18 ? 0.12 : 0) + (yc - y0 < 1.2 ? 0.15 : 0) + (o.bias || 0);
        if (this.flat) {
          const L = xs[i + 1] - xs[i], fx = x + 0.5 - xs[i];
          this.px(x, y, R[this.band(fx < Math.min(1.6, L * 0.25) || yc - y0 < 1 ? 0.9 : xs[i + 1] - x - 0.5 < Math.min(1.6, L * 0.3) ? 0.1 : 0.5 - (o.down || 0) * 0.3 * v, 0, n1)], o.glow);
          continue;
        }
        if (o.folds) sh += Math.sin(x * 1.7 + y * 0.2) * 0.06;
        if (run <= 0) {
          rt = (this.rnd() + this.rnd() - 1) * 0.35;
          run = 2 + (this.rnd() * 2 | 0);
        }
        run--;
        this.px(x, y, R[clamp(Math.round(n1 * clamp(sh, 0, 1) + rt), 0, n1)], o.glow);
      }
    }
  }
  /** A polygon in one color (or a color a pixel, from col(x, y)). */
  poly(pts, col) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if (a[1] <= yc && yc < b[1] || b[1] <= yc && yc < a[1]) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) this.px(x, y, typeof col === "function" ? col(x, y) : col);
    }
  }
  /** A figure's finish: a shadow line on a part where a later part lies on
   * it, then a dark outline round the whole (not round glow alone). */
  finish() {
    const w = this.w, h = this.h, C = this.c, dk = this.look.ink;
    const shade2 = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!C[i] || this.g[i]) continue;
      for (const [dx, dy] of N4) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const j = Y * w + X;
        if (C[j] && this.p[j] > this.p[i] && !this.g[j] && !this.soft.has(this.p[j])) {
          shade2.push(i);
          break;
        }
      }
    }
    for (const i of shade2) this.c[i] = mixRgb(this.c[i], dk, this.look.shadow);
    const out = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (C[i]) continue;
      let best = null;
      for (const [dx, dy] of N4) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const j = Y * w + X;
        const cj = C[j];
        if (!cj) continue;
        if (this.g[j]) continue;
        const L = cj[0] + cj[1] + cj[2];
        if (!best || L < best[1]) best = [cj, L];
      }
      if (best) out.push([i, mixRgb(best[0], dk, this.look.edge)]);
    }
    for (const [i, col] of out) {
      this.c[i] = col;
      this.g[i] = 0;
    }
  }
  /** The sprite: outlined (if `line`), as a picture and, if anything glows,
   * a glow picture. */
  done() {
    if (this.line) this.finish();
    const w = this.w, h = this.h, c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    const img = g.createImageData(w, h);
    let glow = false;
    const eimg = this.g.some((q) => q) ? new ImageData(w, h) : null;
    for (let i = 0; i < this.c.length; i++) {
      const col = this.c[i];
      if (!col) continue;
      img.data[i * 4] = col[0];
      img.data[i * 4 + 1] = col[1];
      img.data[i * 4 + 2] = col[2];
      img.data[i * 4 + 3] = 255;
      if (this.g[i] && eimg) {
        glow = true;
        eimg.data[i * 4] = col[0];
        eimg.data[i * 4 + 1] = col[1];
        eimg.data[i * 4 + 2] = col[2];
        eimg.data[i * 4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    let ec = null;
    if (glow && eimg) {
      ec = document.createElement("canvas");
      ec.width = w;
      ec.height = h;
      const eg = ec.getContext("2d");
      eg.imageSmoothingEnabled = false;
      eg.putImageData(eimg, 0, 0);
    }
    return { c, e: ec, w, h, ax: this.ax, ay: this.ay };
  }
};
/** The White Dragon's finish. */
_Shapes.LOOK = { ink: [8, 6, 12], shadow: 0.45, edge: 0.72 };
var Shapes = _Shapes;

// src/pixels/sprite.ts
function canvas(w, h, o = {}) {
  const c = document.createElement("canvas");
  if (o.min === void 0) {
    c.width = w;
    c.height = h;
  } else {
    c.width = Math.max(o.min, w);
    c.height = Math.max(o.min, h);
  }
  const g = c.getContext("2d", o.read ? { willReadFrequently: true } : void 0);
  g.imageSmoothingEnabled = false;
  return [c, g];
}
function spriteFrom(rows, pal, o = {}) {
  const h = rows.length, w = o.w === void 0 ? Math.max(...rows.map((r) => r.length)) : o.w;
  const [c, x] = canvas(w, h, o);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch === "." || ch === " " || !pal[ch]) continue;
      x.fillStyle = pal[ch];
      x.fillRect(i, j, 1, 1);
    }
  return c;
}
function outline(src, o = {}) {
  let c = src;
  const grow = o.grow === void 0 ? true : o.grow;
  let big = grow === true;
  if (grow === "edge") {
    const w2 = c.width, h2 = c.height, d2 = c.getContext("2d").getImageData(0, 0, w2, h2).data;
    for (let x2 = 0; x2 < w2 && !big; x2++) big = d2[x2 * 4 + 3] > 100 || d2[((h2 - 1) * w2 + x2) * 4 + 3] > 100;
    for (let y = 0; y < h2 && !big; y++) big = d2[y * w2 * 4 + 3] > 100 || d2[(y * w2 + w2 - 1) * 4 + 3] > 100;
  }
  if (big) {
    const [p, px] = canvas(src.width + 2, src.height + 2, { read: true });
    px.drawImage(src, 1, 1);
    c = p;
  }
  const x = c.getContext("2d"), w = c.width, h = c.height;
  const img = x.getImageData(0, 0, w, h), d = img.data, alpha = o.alpha === void 0 ? 255 : o.alpha;
  const solid = (i, j) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 100;
  if (o.own === void 0) {
    const mark = [];
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++)
        if (!solid(i, j) && (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1))) mark.push(j * w + i);
    const [r, g, b] = hexToRgb(o.ink || "#000000");
    for (const k of mark) {
      d[k * 4] = r;
      d[k * 4 + 1] = g;
      d[k * 4 + 2] = b;
      d[k * 4 + 3] = alpha;
    }
  } else {
    const dark = o.own, mark = [];
    for (let y = 0; y < h; y++)
      for (let xx = 0; xx < w; xx++) {
        if (d[(y * w + xx) * 4 + 3] > 100) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (const [i, j] of [[xx - 1, y], [xx + 1, y], [xx, y - 1], [xx, y + 1]]) if (solid(i, j)) {
          const k = (j * w + i) * 4;
          r += d[k];
          g += d[k + 1];
          b += d[k + 2];
          n++;
        }
        if (n) mark.push(y * w + xx, r / n, g / n, b / n);
      }
    for (let m = 0; m < mark.length; m += 4) {
      const i = mark[m] * 4;
      d[i] = mark[m + 1] * dark;
      d[i + 1] = mark[m + 2] * dark;
      d[i + 2] = mark[m + 3] * dark;
      d[i + 3] = alpha;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}
function tinted(src, col, o = {}) {
  const [c, x] = canvas(src.width, src.height, o);
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = col;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}
function flipped(src, o = {}) {
  const [c, x] = canvas(src.width, src.height, o);
  x.translate(src.width, 0);
  x.scale(-1, 1);
  x.drawImage(src, 0, 0);
  return c;
}
function flipSprite(s, layers = ["c", "e"], o = {}) {
  const out = Object.assign({}, s), src = s;
  for (const k of layers) {
    const p = src[k];
    out[k] = p ? flipped(p, o) : null;
  }
  out.ax = s.w - s.ax;
  return out;
}
function enlarged(src, k, o = {}) {
  const [c, x] = canvas(src.width * k, src.height * k, o);
  x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0, src.width * k, src.height * k);
  return c;
}
function disc(ctx, cx, cy, r, col) {
  ctx.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r + r * 0.6 - y * y));
    if (w >= 0) ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}
function ellipse(ctx, cx, cy, rx, ry, col) {
  ctx.fillStyle = col;
  for (let y = -ry; y <= ry; y++) {
    const t = 1 - y * y / (ry * ry + 0.5);
    if (t < 0) continue;
    const w = Math.round(rx * Math.sqrt(t));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}
function scale2xRows(rows) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const at = (x, y) => y < 0 || y >= h || x < 0 || x >= w ? "." : rows[y][x] || ".";
  const out = Array.from({ length: h * 2 }, () => new Array(w * 2).fill("."));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      out[2 * y][2 * x] = C === A && C !== D && A !== B ? A : P;
      out[2 * y][2 * x + 1] = A === B && A !== C && B !== D ? B : P;
      out[2 * y + 1][2 * x] = D === C && D !== B && C !== A ? C : P;
      out[2 * y + 1][2 * x + 1] = B === D && B !== A && D !== C ? D : P;
    }
  return out.map((r) => r.join(""));
}
function scale3xRows(rows, fixed) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const at = (x, y) => y < 0 || y >= h || x < 0 || x >= w ? "." : rows[y][x] || ".";
  const out = Array.from({ length: h * 3 }, () => new Array(w * 3).fill("."));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const A = at(x - 1, y - 1), B = at(x, y - 1), C = at(x + 1, y - 1), D = at(x - 1, y), E = at(x, y), F2 = at(x + 1, y), G = at(x - 1, y + 1), H = at(x, y + 1), I = at(x + 1, y + 1);
      const o = fixed && fixed.has(E) ? (i, j) => {
        out[3 * y + j][3 * x + i] = E;
      } : fixed ? (i, j, v) => {
        out[3 * y + j][3 * x + i] = fixed.has(v) ? E : v;
      } : (i, j, v) => {
        out[3 * y + j][3 * x + i] = v;
      };
      if (B !== H && D !== F2) {
        o(0, 0, D === B ? D : E);
        o(1, 0, D === B && E !== C || B === F2 && E !== A ? B : E);
        o(2, 0, B === F2 ? F2 : E);
        o(0, 1, D === B && E !== G || D === H && E !== A ? D : E);
        o(1, 1, E);
        o(2, 1, B === F2 && E !== I || H === F2 && E !== C ? F2 : E);
        o(0, 2, D === H ? D : E);
        o(1, 2, D === H && E !== I || H === F2 && E !== G ? H : E);
        o(2, 2, H === F2 ? F2 : E);
      } else for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) o(i, j, E);
    }
  return out.map((r) => r.join(""));
}
function scale15Rows(rows, fixed) {
  return scale3xRows(rows, fixed).filter((_, y) => y % 2 === 0).map((r) => [...r].filter((_, x) => x % 2 === 0).join(""));
}
function scaleRows(rows, k, fixed) {
  const whole = (v) => Math.abs(v - Math.round(v)) < 1e-6;
  if (Math.abs(k - 1) < 1e-6) return rows;
  if (whole(k / 3)) return scaleRows(scale3xRows(rows, fixed), k / 3, fixed);
  if (whole(k / 2)) return scaleRows(scale2xRows(rows), k / 2, fixed);
  if (Math.abs(k - 1.5) < 1e-6) return scale15Rows(rows, fixed);
  if (whole(k / 1.5)) return scale15Rows(scaleRows(rows, k / 1.5, fixed), fixed);
  const h = rows.length, w = Math.max(...rows.map((r) => r.length)), W = Math.round(w * k), H = Math.round(h * k);
  return Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_2, x) => rows[Math.floor(y / k)][Math.floor(x / k)] || ".").join(""));
}

// src/pixels/paint.ts
var paint_exports = {};
__export(paint_exports, {
  Chunks: () => Chunks,
  Painter: () => Painter,
  Pix: () => Pix,
  blockV: () => blockV,
  chunk: () => chunk,
  paintOps: () => paintOps,
  strokeRow: () => strokeRow
});
function strokeRow(mid, jit, x0, n, y, seed) {
  const C = 8, ph = Math.floor(hash(y, 7, seed) * C);
  let c = Math.floor((x0 + ph) / C), cs = c * C - ph, i = 0;
  while (i < n) {
    const h = hash(c, y, seed + 1), h2 = hash(c, y, seed + 2), h3 = hash(c, y, seed + 3);
    let a = C, b = C;
    if (h > 0.3) {
      if (h < 0.7) a = 2 + (h2 * (C - 3) | 0);
      else {
        a = 2 + (h2 * 3 | 0);
        b = Math.min(C - 2, a + 2 + (h3 * 3 | 0));
      }
    }
    const ja = h2 + h3 - 1, jb = hash(c, y, seed + 4) + h3 - 1, jc = hash(c, y, seed + 5) + h - 1;
    const ma = cs + (a - 1 >> 1), mb = cs + (a + b - 1 >> 1), mc = cs + (b + C - 1 >> 1);
    for (let k = 0; k < C; k++) {
      if (cs + k < x0) continue;
      if (i >= n) break;
      if (k < a) {
        mid[i] = ma - x0;
        jit[i] = ja;
      } else if (k < b) {
        mid[i] = mb - x0;
        jit[i] = jb;
      } else {
        mid[i] = mc - x0;
        jit[i] = jc;
      }
      i++;
    }
    c++;
    cs += C;
  }
}
var Pix = class {
  constructor(w, h, ox = 0, oy = 0, o = {}) {
    this.w = w;
    this.h = h;
    this.ox = ox;
    this.oy = oy;
    this.n = 1;
    this.glowed = false;
    this.flat = !!o.flat;
    this.c = new Uint8ClampedArray(w * h * 4);
    this.g = new Uint8ClampedArray(w * h * 4);
    this.mid = new Int16Array(w + 16);
    this.jit = new Float32Array(w + 16);
  }
  /** One pixel, in world px; glow 0..1 puts it on the glow picture that bright. */
  put(x, y, col, glow = 0) {
    x = Math.floor(x) - this.ox;
    y = Math.floor(y) - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !col) return;
    const o = (y * this.w + x) * 4;
    this.c[o] = col[0];
    this.c[o + 1] = col[1];
    this.c[o + 2] = col[2];
    this.c[o + 3] = 255;
    if (glow) {
      this.g[o] = col[0] * glow;
      this.g[o + 1] = col[1] * glow;
      this.g[o + 2] = col[2] * glow;
      this.g[o + 3] = 255;
      this.glowed = true;
    } else this.g[o] = this.g[o + 1] = this.g[o + 2] = this.g[o + 3] = 0;
  }
  /** What's there mixed toward a color, k of the way (haze, steam). */
  tint(x, y, col, k) {
    x = Math.floor(x) - this.ox;
    y = Math.floor(y) - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 4;
    if (!this.c[o + 3]) return;
    this.c[o] = lerp(this.c[o], col[0], k);
    this.c[o + 1] = lerp(this.c[o + 1], col[1], k);
    this.c[o + 2] = lerp(this.c[o + 2], col[2], k);
  }
  /** A painted area: v(x, y) its value (0..1), read from the ramp. Flat, each
   * pixel its own tone; otherwise read at each stroke's middle with a little
   * jitter, so the area reads as brushwork. */
  area(ax0, ay0, ax1, ay1, ramp, v, o = {}) {
    const seed = o.seed === void 0 ? this.n * 13 + 5 : o.seed;
    this.n++;
    ax0 = Math.floor(ax0);
    ay0 = Math.floor(ay0);
    ax1 = Math.ceil(ax1);
    ay1 = Math.ceil(ay1);
    const x0 = Math.max(this.ox, ax0), y0 = Math.max(this.oy, ay0), x1 = Math.min(this.ox + this.w - 1, ax1), y1 = Math.min(this.oy + this.h - 1, ay1);
    if (x1 < x0 || y1 < y0) return;
    const flat = this.flat, inside = o.inside || null, J = flat ? 0 : o.jit === void 0 ? 0.45 : o.jit, n = x1 - x0 + 1, glow = o.glow || 0, fog = o.fog || 0, fogc = o.fogc || [20, 16, 30];
    const mid = this.mid, jit = this.jit;
    for (let y = y0; y <= y1; y++) {
      if (!flat) strokeRow(mid, jit, x0, n, y, seed);
      for (let i = 0; i < n; i++) {
        const x = x0 + i;
        if (inside && !inside(x, y)) continue;
        const m = x0 + mid[i], vx = v(x, y), vm = flat ? vx : m >= ax0 && m <= ax1 && (!inside || inside(m, y)) ? v(m, y) : vx;
        let c = tone(ramp, clamp(vm * 0.6 + vx * 0.4, 0, 1), jit[i] * J);
        if (fog) c = mixRgb(c, fogc, fog);
        this.put(x, y, c, glow);
      }
    }
  }
  /** A block, lit side-on (blockV). */
  block(x0, y0, x1, y1, ramp, o = {}) {
    this.area(x0, y0, x1, y1, ramp, blockV(x0, y0, x1, y1, o, this.flat), o);
  }
  /** Does a world box touch this buffer? */
  sees(x0, y0, x1, y1) {
    return x1 >= this.ox && y1 >= this.oy && x0 < this.ox + this.w && y0 < this.oy + this.h;
  }
  /** The buffer as canvases: the picture, and the glow (null if nothing glows). */
  canvases() {
    const [c, g] = canvas(this.w, this.h);
    g.putImageData(new ImageData(this.c, this.w, this.h), 0, 0);
    let e = null;
    if (this.glowed) {
      const [ec, eg] = canvas(this.w, this.h);
      eg.putImageData(new ImageData(this.g, this.w, this.h), 0, 0);
      e = ec;
    }
    return { c, e };
  }
};
function blockV(x0, y0, x1, y1, o = {}, flat = false) {
  const base = o.base === void 0 ? 0.5 : o.base, s = o.seed || 3, grain = o.grain === void 0 ? 0.06 : o.grain, lip = o.lip === void 0 ? 1 : o.lip;
  if (flat) return (x, y) => {
    let v = base;
    const top = y - y0, bot = y1 - y, l = x - x0, r = x1 - x;
    if (lip && top < 1) v = 0.9;
    if (bot < 1) v -= 0.3;
    if (l < 1) v += 0.1;
    if (r < 1) v -= 0.12;
    if (o.drips) {
      const d = hash(x, 0, s + 5);
      if (d > 1 - o.drips && top < 3 + (d - 1 + o.drips) / o.drips * (o.dripLen || 40)) v -= 0.12;
    }
    if (o.bands) {
      if ((y - y0) % o.bands === 0) v -= 0.16;
    }
    if (o.panels) {
      const px = (x - x0) % o.panels[0], py = (y - y0) % o.panels[1];
      if (px === 0 || py === 0) v -= 0.16;
    }
    return v;
  };
  return (x, y) => {
    let v = base + (noise(x / 40, y / 16, s) - 0.5) * 0.14 + (noise(x / 4, y / 30, s + 1) - 0.5) * grain;
    const top = y - y0, bot = y1 - y, l = x - x0, r = x1 - x;
    if (lip) {
      if (top < 1) v = 0.98;
      else if (top < 2) v = Math.max(v, 0.8);
      else if (top < 4) v += 0.1 * lip;
    }
    if (bot < 1) v -= 0.36;
    else if (bot < 3) v -= 0.16;
    if (l < 2) v += 0.12;
    if (r < 2) v -= 0.14;
    if (o.inward) v -= Math.min(o.inward, Math.min(top, bot, l, r) * 6e-3);
    if (o.drips) {
      const d = hash(x, 0, s + 5);
      if (d > 1 - o.drips && top < 3 + (d - 1 + o.drips) / o.drips * (o.dripLen || 40)) v -= 0.14;
    }
    if (o.bands) {
      if ((y - y0) % o.bands === 0) v -= 0.18;
      else if ((y - y0) % o.bands === 1) v += 0.08;
    }
    if (o.panels) {
      const px = (x - x0) % o.panels[0], py = (y - y0) % o.panels[1];
      if (px === 0 || py === 0) v -= 0.2;
      else if (px === 1 || py === 1) v += 0.07;
    }
    return v;
  };
}
function paintOps(P, ops) {
  for (const op of ops) if (P.sees(op.x0, op.y0, op.x1, op.y1)) {
    P.n = op.seed;
    op.fn(P);
  }
  return P;
}
function chunk(ops, cx, cy, size, o = {}) {
  const P = paintOps(new Pix(size, size, cx * size, cy * size, o), ops);
  const { c, e } = P.canvases();
  return { c, e, x: cx * size, y: cy * size };
}
var Chunks = class {
  constructor(o) {
    this.size = o.size;
    this.make = o.make;
    this.w = o.w || 0;
    this.h = o.h || 0;
    this.max = o.max || Infinity;
    this.map = /* @__PURE__ */ new Map();
    this.stamp = 0;
  }
  /** Lets every chunk go, and takes the world's size anew (if given). */
  reset(world) {
    this.map.clear();
    if (world) {
      this.w = world.w;
      this.h = world.h;
    }
  }
  key(cx, cy) {
    return cx + "," + cy;
  }
  has(cx, cy) {
    return this.map.has(this.key(cx, cy));
  }
  /** Whether a chunk lies in the world. */
  inside(cx, cy) {
    return cx >= 0 && cy >= 0 && cx * this.size < this.w && cy * this.size < this.h;
  }
  /** The chunk, made if it's new. */
  get(cx, cy) {
    const k = this.key(cx, cy);
    let e = this.map.get(k);
    if (!e) {
      e = { v: this.make(cx, cy), used: 0 };
      this.map.set(k, e);
    }
    e.used = ++this.stamp;
    if (this.map.size > this.max) this.trim(this.max);
    return e.v;
  }
  /** The chunk if it's made, without making it. */
  peek(cx, cy) {
    const e = this.map.get(this.key(cx, cy));
    return e && e.v;
  }
  /** The chunks (made if new) a box of the world touches, row by row. */
  over(x0, y0, x1, y1) {
    const S = this.size, out = [];
    for (let cy = Math.floor(y0 / S); cy <= Math.floor(y1 / S); cy++) for (let cx = Math.floor(x0 / S); cx <= Math.floor(x1 / S); cx++) if (this.inside(cx, cy)) out.push(this.get(cx, cy));
    return out;
  }
  /** The nearest chunk in the world not yet made, near the one at (x, y)
   * (fewest steps across and down; the first found in rows on a tie). */
  nearest(x, y, rx = 3, ry = 2) {
    const S = this.size, cx0 = Math.floor(x / S), cy0 = Math.floor(y / S);
    let best = null, bd = 1e9;
    for (let cy = cy0 - ry; cy <= cy0 + ry; cy++) for (let cx = cx0 - rx; cx <= cx0 + rx; cx++) {
      if (!this.inside(cx, cy) || this.has(cx, cy)) continue;
      const d = Math.abs(cx - cx0) + Math.abs(cy - cy0);
      if (d < bd) {
        bd = d;
        best = [cx, cy];
      }
    }
    return best;
  }
  /** A frame's spare work: makes the nearest chunk not yet made near (x, y),
   * and more while the budget lasts, so walking into new ground doesn't
   * stall. Returns how many it made. */
  ahead(x, y, o = {}) {
    const t0 = o.budget ? performance.now() : 0;
    let made = 0;
    for (; ; ) {
      const at = this.nearest(x, y, o.rx === void 0 ? 3 : o.rx, o.ry === void 0 ? 2 : o.ry);
      if (!at) break;
      this.get(at[0], at[1]);
      made++;
      if (!o.budget || performance.now() - t0 >= o.budget) break;
    }
    return made;
  }
  /** Lets go of the chunks used longest ago until there are at most `max`. */
  trim(max = this.max) {
    if (this.map.size <= max) return;
    const all = [...this.map.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [k] of all) {
      if (this.map.size <= max) break;
      this.map.delete(k);
    }
  }
  get count() {
    return this.map.size;
  }
};
var Painter = class extends Chunks {
  constructor(o) {
    super({ size: o.size, max: o.max, make: () => {
      throw new Error("a painter paints a level: reset(level) first");
    } });
    this.level = null;
    this.pix = { flat: !!o.flat };
    this.make = (cx, cy) => chunk(this.level.ops, cx, cy, this.size, this.pix);
  }
  /** A new level: every chunk goes. */
  reset(level) {
    if (level) this.level = level;
    super.reset(level);
  }
};

// src/pixels/fx.ts
var fx_exports = {};
__export(fx_exports, {
  Particles: () => Particles,
  age: () => age,
  burst: () => burst,
  move: () => move,
  rise: () => rise,
  sparks: () => sparks,
  tick: () => tick
});
function tick(list, dt) {
  let m = 0;
  for (const o of list) if ((o.t -= dt) > 0) list[m++] = o;
  list.length = m;
  return list;
}
function age(list, dt, life) {
  let m = 0;
  for (const o of list) {
    o.t += dt;
    if (o.t < (life === void 0 ? o.life : life)) list[m++] = o;
  }
  list.length = m;
  return list;
}
function move(q, dt, o = {}) {
  if (q.drag) {
    const k = Math.exp(-q.drag * dt);
    q.vx *= k;
    q.vy *= k;
  }
  q.vy += (q.g || 0) * dt;
  q.x += q.vx * dt;
  q.y += q.vy * dt;
  if (q.floor !== void 0 && q.y > q.floor && q.vy > 0) {
    q.y = q.floor;
    q.vy *= -(o.bounce === void 0 ? 0.35 : o.bounce);
    q.vx *= o.slide === void 0 ? 0.6 : o.slide;
  }
}
var Particles = class {
  constructor(o = {}) {
    this.list = [];
    this.max = o.max === void 0 ? 260 : o.max;
    this.keep = o.keep === void 0 ? 200 : o.keep;
    this.bounce = { bounce: o.bounce, slide: o.slide };
  }
  add(p) {
    this.list.push(p);
    return p;
  }
  /** The oldest let go if there are too many. */
  cap() {
    if (this.list.length > this.max) this.list.splice(0, this.list.length - this.keep);
  }
  /** Each moves by dt and loses dt of its time; those run out go. */
  step(dt) {
    const L = this.list;
    let m = 0;
    for (const q of L) {
      if ((q.t -= dt) <= 0) continue;
      move(q, dt, this.bounce);
      L[m++] = q;
    }
    L.length = m;
  }
  get length() {
    return this.list.length;
  }
};
function sparks(x, y, n, draw, o = {}) {
  const spread = o.spread === void 0 ? 160 : o.spread, up = o.up === void 0 ? 40 : o.up, upMore = o.upMore === void 0 ? 110 : o.upMore;
  const life = o.life === void 0 ? 0.25 : o.life, lifeMore = o.lifeMore === void 0 ? 0.35 : o.lifeMore, g = o.g === void 0 ? 400 : o.g, out = [];
  for (let k = 0; k < n; k++) {
    const h1 = draw(k, 1), h2 = draw(k, 2), h3 = draw(k, 3);
    out.push({ x, y, vx: (h1 - 0.5) * spread, vy: -up - h2 * upMore, t: life + h3 * lifeMore, c: [255, 160 + h3 * 90, 60 + h3 * 120], g });
  }
  return out;
}
function burst(x, y, c, n, draw, o = {}) {
  const sp = o.speed === void 0 ? 40 : o.speed, spMore = o.speedMore === void 0 ? 70 : o.speedMore, life = o.life === void 0 ? 0.3 : o.life, lifeMore = o.lifeMore === void 0 ? 0.3 : o.lifeMore, out = [];
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2 + draw(k, 4), s = sp + draw(k, 5) * spMore;
    out.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: life + draw(k, 6) * lifeMore, c, g: 0 });
  }
  return out;
}
function rise(age2, i = 0, of = 1, o = {}) {
  const life = o.life === void 0 ? 2.4 : o.life, fade = o.fade === void 0 ? 1.8 : o.fade, out = o.out === void 0 ? 0.6 : o.out;
  if (age2 < 0 || !(age2 < life)) return null;
  return { stack: (of - 1 - i) * (o.line === void 0 ? 21 : o.line), up: age2 * (o.speed === void 0 ? 12 : o.speed), alpha: age2 > fade ? Math.max(0, 1 - (age2 - fade) / out) : 1 };
}

// src/world/grid.ts
var grid_exports = {};
__export(grid_exports, {
  Grid: () => Grid
});
var Grid = class {
  constructor(def) {
    this.data = [];
    // flat
    this.chunks = [];
    // chunked
    // a chunk's dirty box (by chunk index): x0, y0, x1, y1 in tiles
    this.dirtyBox = /* @__PURE__ */ new Map();
    // once sealed: by chunk index, the cells changed (layer × side² + cell) and what the seed made them
    this.sealed = false;
    this.orig = /* @__PURE__ */ new Map();
    const side = def.chunk || 32;
    if (side & side - 1) throw new Error("Tycho.grid: a chunk's side is a power of two");
    this.w = def.w;
    this.h = def.h;
    this.chunk = side;
    this.shift = Math.log2(side) | 0;
    this.mask = side - 1;
    this.cw = Math.ceil(def.w / side);
    this.ch = Math.ceil(def.h / side);
    this.defs = def.layers;
    this.names = def.layers.map((l) => l.name);
    this.edges = def.layers.map((l) => l.edge !== void 0 ? l.edge : l.fill || 0);
    this.flat = !!def.flat || def.layers.some((l) => l.data);
    this.make = def.make;
    if (this.flat) {
      for (const l of def.layers) {
        if (l.data && l.data.length !== def.w * def.h) throw new Error(`Tycho.grid: layer ${l.name} has ${l.data.length} tiles, not ${def.w * def.h}`);
        const d = l.data || (l.bits === 16 ? new Uint16Array(def.w * def.h) : new Uint8Array(def.w * def.h));
        if (!l.data && l.fill) d.fill(l.fill);
        this.data.push(d);
      }
    }
  }
  /** A layer's index by name. */
  layer(name) {
    const i = this.names.indexOf(name);
    if (i < 0) throw new Error("Tycho.grid: no layer " + name);
    return i;
  }
  /** The tile at x, y (whole tiles) in layer l; the layer's edge value outside. */
  get(l, x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this.edges[l];
    if (this.flat) return this.data[l][y * this.w + x];
    const s = this.shift, c = this.chunks[(y >> s) * this.cw + (x >> s)] || this.chunkAt(x >> s, y >> s);
    return c.cells[l][(y & this.mask) << s | x & this.mask];
  }
  /** Sets a tile (false outside the grid): its chunk's rectangle is marked changed and, once sealed, the change kept. */
  set(l, x, y, v) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    const s = this.shift, ci = (y >> s) * this.cw + (x >> s);
    let cells, i;
    if (this.flat) {
      cells = this.data[l];
      i = y * this.w + x;
    } else {
      cells = (this.chunks[ci] || this.chunkAt(x >> s, y >> s)).cells[l];
      i = (y & this.mask) << s | x & this.mask;
    }
    const was = cells[i];
    cells[i] = v;
    if (cells[i] === was) return true;
    const d = this.dirtyBox.get(ci);
    if (!d) this.dirtyBox.set(ci, { x0: x, y0: y, x1: x + 1, y1: y + 1 });
    else {
      if (x < d.x0) d.x0 = x;
      if (y < d.y0) d.y0 = y;
      if (x + 1 > d.x1) d.x1 = x + 1;
      if (y + 1 > d.y1) d.y1 = y + 1;
    }
    if (this.sealed) {
      const k = l * this.chunk * this.chunk + ((y & this.mask) << s | x & this.mask);
      let m = this.orig.get(ci);
      if (!m) this.orig.set(ci, m = /* @__PURE__ */ new Map());
      if (!m.has(k)) m.set(k, was);
      else if (m.get(k) === cells[i]) m.delete(k);
    }
    return true;
  }
  /** Fills the tiles from x0, y0 up to x1, y1 (clipped to the grid). */
  fill(l, x0, y0, x1, y1, v) {
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(this.w, x1);
    y1 = Math.min(this.h, y1);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.set(l, x, y, v);
  }
  /** A flat grid's layer: its w × h tiles (the array it was given, if it was). */
  array(l) {
    if (!this.flat) throw new Error("Tycho.grid: only a flat grid has a layer in one array");
    return this.data[l];
  }
  /** Has the chunk at cx, cy been made? (A flat grid's always have.) */
  has(cx, cy) {
    return this.flat || !!this.chunks[cy * this.cw + cx];
  }
  /** A chunked grid's chunk at cx, cy, made if it hasn't been. */
  chunkAt(cx, cy) {
    if (this.flat) throw new Error("Tycho.grid: a flat grid has no chunks of its own");
    const ci = cy * this.cw + cx;
    let c = this.chunks[ci];
    if (c) return c;
    const n = this.chunk * this.chunk;
    c = { cx, cy, x0: cx * this.chunk, y0: cy * this.chunk, cells: this.defs.map((l) => {
      const a = l.bits === 16 ? new Uint16Array(n) : new Uint8Array(n);
      if (l.fill) a.fill(l.fill);
      return a;
    }) };
    this.chunks[ci] = c;
    if (this.make) this.make(c, this);
    return c;
  }
  /** The rectangles of tiles changed since the last take, one a chunk, in rows of chunks. */
  takeDirty() {
    const out = [...this.dirtyBox.keys()].sort((a, b) => a - b).map((k) => this.dirtyBox.get(k));
    this.dirtyBox.clear();
    return out;
  }
  /** What's in the grid now is what the seed made: from here on every change from it is kept. */
  seal() {
    this.sealed = true;
    this.orig.clear();
  }
  /** Every tile that isn't what the seed made, by layer, in rows: for a save. */
  changes() {
    const out = {}, side = this.chunk, n = side * side, all = [];
    for (const [ci, m] of this.orig) {
      const cx = ci % this.cw, cy = (ci - cx) / this.cw;
      for (const k of m.keys()) {
        const l = Math.floor(k / n), i = k - l * n, x = cx * side + (i & this.mask), y = cy * side + (i >> this.shift);
        all.push([l, y, x, this.get(l, x, y)]);
      }
    }
    all.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    for (const [l, y, x, v] of all) (out[this.names[l]] || (out[this.names[l]] = [])).push(x, y, v);
    return out;
  }
  /** Puts a save's changes back (over a world made again from its seed and sealed). */
  apply(changes) {
    for (const name of Object.keys(changes)) {
      const l = this.names.indexOf(name), list = changes[name];
      if (l < 0) continue;
      for (let i = 0; i + 2 < list.length; i += 3) this.set(l, list[i], list[i + 1], list[i + 2]);
    }
  }
};

// src/world/collide.ts
var collide_exports = {};
__export(collide_exports, {
  Space: () => Space,
  Tiles: () => Tiles
});
var Tiles = class {
  constructor(grid, layer, def) {
    this.grid = grid;
    this.layer = layer;
    this.size = def.size;
    this.solid = def.solid;
    this.smooth = !!def.smooth;
    const s = def.smooth || {};
    this.noise = s.noise || null;
    this.amp = s.amp || 0;
    this.pinch = s.pinch === void 0 ? 0.55 : s.pinch;
    this.cells = grid.flat ? grid.array(layer) : null;
    this.w = grid.w;
    this.h = grid.h;
  }
  /** The tile under world px x, y. */
  tileAt(x, y) {
    return this.grid.get(this.layer, Math.floor(x / this.size), Math.floor(y / this.size));
  }
  /** Is world px x, y solid? (by `solid`, or another table, such as which tiles rise as rock) */
  at(x, y, solid = this.solid) {
    const g = this.grid, l = this.layer;
    if (!this.smooth) return !!solid[g.get(l, Math.floor(x / this.size), Math.floor(y / this.size))];
    const gx = x / this.size - 0.5, gy = y / this.size - 0.5, tx = Math.floor(gx), ty = Math.floor(gy), u = gx - tx, v = gy - ty;
    let a, b, c, d;
    const C = this.cells, w = this.w;
    if (C && tx >= 0 && ty >= 0 && tx + 1 < w && ty + 1 < this.h) {
      const i = ty * w + tx;
      a = solid[C[i]] ? 1 : 0;
      b = solid[C[i + 1]] ? 1 : 0;
      c = solid[C[i + w]] ? 1 : 0;
      d = solid[C[i + w + 1]] ? 1 : 0;
    } else {
      a = solid[g.get(l, tx, ty)] ? 1 : 0;
      b = solid[g.get(l, tx + 1, ty)] ? 1 : 0;
      c = solid[g.get(l, tx, ty + 1)] ? 1 : 0;
      d = solid[g.get(l, tx + 1, ty + 1)] ? 1 : 0;
    }
    if (a === b && b === c && c === d) return a === 1;
    const ab = a + (b - a) * u, cd = c + (d - c) * u;
    let blend = ab + (cd - ab) * v;
    if (a === d && b === c) blend *= this.pinch;
    return blend + (this.noise ? this.amp * this.noise(x, y) : 0) > 0.5;
  }
  /** Square tiles: the first solid tile (row by row) under the box, as a box. */
  box(x0, y0, x1, y1) {
    const S = this.size, g = this.grid, l = this.layer;
    const tx0 = Math.floor(x0 / S), ty0 = Math.floor(y0 / S), tx1 = Math.ceil(x1 / S), ty1 = Math.ceil(y1 / S);
    for (let ty = ty0; ty < ty1; ty++) for (let tx = tx0; tx < tx1; tx++) if (this.solid[g.get(l, tx, ty)]) return { x0: tx * S, y0: ty * S, x1: tx * S + S, y1: ty * S + S };
    return null;
  }
};
var RING = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)]);
var read = (list) => typeof list === "function" ? list() : list;
var Space = class {
  constructor() {
    this.boxSets = [];
    this.tileSets = [];
    this.ellipseSets = [];
    this.waySets = [];
    this.ladderSets = [];
    this.side = null;
    /** The points round a body's edge, as [cos, sin] (eight, evenly round). */
    this.ring = RING;
  }
  /** Solid boxes: the list's items, or what `pick` makes of each (nothing for one that isn't solid now). */
  boxes(list, pick) {
    this.boxSets.push({ list, pick: pick || null });
    return this;
  }
  /** Solid walls either side of the world: everything left of x0 and right of x1. */
  bounds(x0, x1) {
    this.side = [x0, x1];
    return this;
  }
  /** A grid's tiles. */
  tiles(t) {
    this.tileSets.push(t);
    return this;
  }
  /** Round solids. */
  ellipses(list) {
    this.ellipseSets.push(list);
    return this;
  }
  /** One-way surfaces: walkways and stairs. */
  ways(list) {
    this.waySets.push(list);
    return this;
  }
  /** Ladders, taken within `reach` px of their line (6). */
  ladders(list, reach = 6) {
    this.ladderSets.push({ list, reach });
    return this;
  }
  /**
   * The first solid that the box x0..x1, y0..y1 overlaps (edges touching
   * don't count): the boxes in the order given, square tiles, then the
   * sides (a wall 100 px thick and 2e4 tall); null when it's clear.
   */
  hits(x0, y0, x1, y1) {
    for (const set2 of this.boxSets) {
      const list = read(set2.list), pick = set2.pick;
      for (let i = 0; i < list.length; i++) {
        const r = pick ? pick(list[i]) : list[i];
        if (r && x1 > r.x0 && x0 < r.x1 && y1 > r.y0 && y0 < r.y1) return r;
      }
    }
    for (const t of this.tileSets) if (!t.smooth) {
      const r = t.box(x0, y0, x1, y1);
      if (r) return r;
    }
    const s = this.side;
    if (s && (x0 < s[0] || x1 > s[1])) return { x0: x0 < s[0] ? s[0] - 100 : s[1], y0: -1e4, x1: x0 < s[0] ? s[0] : s[1] + 100, y1: 1e4 };
    return null;
  }
  /** Is the point solid in any grid's tiles? */
  inTiles(x, y) {
    for (const t of this.tileSets) if (t.at(x, y)) return true;
    return false;
  }
  /** Is the point solid: in the tiles, a box (its left and top edges in, right and bottom out), an ellipse, or past the sides? */
  solidAt(x, y) {
    if (this.inTiles(x, y)) return true;
    for (const set2 of this.boxSets) {
      const list = read(set2.list), pick = set2.pick;
      for (let i = 0; i < list.length; i++) {
        const r = pick ? pick(list[i]) : list[i];
        if (r && x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1) return true;
      }
    }
    for (const set2 of this.ellipseSets) for (const o of read(set2)) {
      const u = (x - o.x) / o.rx, v = (y - o.y) / o.ry;
      if (u * u + v * v < 1) return true;
    }
    const s = this.side;
    return !!s && (x < s[0] || x > s[1]);
  }
  /**
   * Does a round body of radius r at x, y touch anything solid? Felt in the
   * tiles at its middle and the eight points round its edge (so a smooth
   * wall line is met where it matters), and by overlap with ellipses
   * (grown by r), boxes and the sides.
   */
  circleHits(x, y, r) {
    const ring = this.ring;
    for (const t of this.tileSets) {
      if (t.at(x, y)) return true;
      for (let k = 0; k < ring.length; k++) if (t.at(x + ring[k][0] * r, y + ring[k][1] * r)) return true;
    }
    for (const set2 of this.ellipseSets) for (const o of read(set2)) {
      const u = (x - o.x) / (o.rx + r), v = (y - o.y) / (o.ry + r);
      if (u * u + v * v < 1) return true;
    }
    for (const set2 of this.boxSets) {
      const list = read(set2.list), pick = set2.pick;
      for (let i = 0; i < list.length; i++) {
        const b = pick ? pick(list[i]) : list[i];
        if (!b) continue;
        const nx = x < b.x0 ? b.x0 : x > b.x1 ? b.x1 : x, ny = y < b.y0 ? b.y0 : y > b.y1 ? b.y1 : y;
        if ((x - nx) * (x - nx) + (y - ny) * (y - ny) < r * r) return true;
      }
    }
    const s = this.side;
    return !!s && (x - r < s[0] || x + r > s[1]);
  }
  /** How far into the tiles a round body is: its edge's points in them, its middle counting double. */
  circleDepth(x, y, r) {
    const ring = this.ring;
    let n = this.inTiles(x, y) ? 2 : 0;
    for (let k = 0; k < ring.length; k++) if (this.inTiles(x + ring[k][0] * r, y + ring[k][1] * r)) n++;
    return n;
  }
  /** The height of the highest one-way surface at x between y0 and y1 (inclusive), or null. */
  way(x, y0, y1) {
    let best = null;
    for (const set2 of this.waySets) for (const w of read(set2)) {
      if (x < w.x0 || x > w.x1) continue;
      const y = w.y0 + (w.y1 - w.y0) * ((x - w.x0) / Math.max(1, w.x1 - w.x0));
      if (y >= y0 && y <= y1 && (best === null || y < best)) best = y;
    }
    return best;
  }
  /** The first ladder within reach of x whose span overlaps y0..y1, or null. */
  ladderAt(x, y0, y1) {
    for (const set2 of this.ladderSets) for (const l of read(set2.list)) if (Math.abs(x - l.x) < set2.reach && y1 > l.y0 && y0 < l.y1) return l;
    return null;
  }
  /**
   * What the ray from x0, y0 to x1, y1 hits first, or null if it gets there:
   * boxes and the sides by their edges, square tiles cell by cell as the
   * line crosses them, smooth tiles felt every `step` px along it (1), and
   * ellipses exactly. A ray that starts inside something hits it at t = 0.
   */
  ray(x0, y0, x1, y1, step = 1) {
    const dx = x1 - x0, dy = y1 - y0;
    const found = { hit: null };
    const take = (h) => {
      if (!found.hit || h.t < found.hit.t) found.hit = h;
    };
    const past = (t) => !!found.hit && t >= found.hit.t;
    const slab = (b) => {
      let lo = 0, hi = 1;
      for (const [o, d, a, z] of [[x0, dx, b.x0, b.x1], [y0, dy, b.y0, b.y1]]) {
        if (d === 0) {
          if (o < a || o >= z) return null;
          continue;
        }
        let t0 = (a - o) / d, t1 = (z - o) / d;
        if (t0 > t1) {
          const q = t0;
          t0 = t1;
          t1 = q;
        }
        if (t0 > lo) lo = t0;
        if (t1 < hi) hi = t1;
        if (lo > hi) return null;
      }
      return lo;
    };
    for (const set2 of this.boxSets) {
      const list = read(set2.list), pick = set2.pick;
      for (let i = 0; i < list.length; i++) {
        const b = pick ? pick(list[i]) : list[i];
        if (!b) continue;
        const t = slab(b);
        if (t !== null) take({ t, x: x0 + dx * t, y: y0 + dy * t, box: b });
      }
    }
    const s = this.side;
    if (s) for (const b of [{ x0: s[0] - 1e9, y0: -1e9, x1: s[0], y1: 1e9 }, { x0: s[1], y0: -1e9, x1: s[1] + 1e9, y1: 1e9 }]) {
      const t = slab(b);
      if (t !== null) take({ t, x: x0 + dx * t, y: y0 + dy * t, box: b });
    }
    for (const o of this.ellipseSets.flatMap((set2) => read(set2))) {
      const px = (x0 - o.x) / o.rx, py = (y0 - o.y) / o.ry, qx = dx / o.rx, qy = dy / o.ry;
      const A = qx * qx + qy * qy, B = 2 * (px * qx + py * qy), C = px * px + py * py - 1;
      if (C < 0) {
        take({ t: 0, x: x0, y: y0, ellipse: o });
        continue;
      }
      if (A === 0) continue;
      const D = B * B - 4 * A * C;
      if (D < 0) continue;
      const t = (-B - Math.sqrt(D)) / (2 * A);
      if (t >= 0 && t <= 1) take({ t, x: x0 + dx * t, y: y0 + dy * t, ellipse: o });
    }
    for (const T of this.tileSets) {
      const S = T.size;
      if (T.smooth) {
        const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / step));
        for (let k = 0; k <= n; k++) {
          const t2 = k / n;
          if (past(t2)) break;
          const x = x0 + dx * t2, y = y0 + dy * t2;
          if (T.at(x, y)) {
            take({ t: t2, x, y, tile: { x: Math.floor(x / S), y: Math.floor(y / S), v: T.tileAt(x, y) } });
            break;
          }
        }
        continue;
      }
      let tx = Math.floor(x0 / S), ty = Math.floor(y0 / S);
      const ex = Math.floor(x1 / S), ey = Math.floor(y1 / S), sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
      const ddx = dx ? Math.abs(S / dx) : Infinity, ddy = dy ? Math.abs(S / dy) : Infinity;
      let nx = dx ? ((dx > 0 ? (tx + 1) * S : tx * S) - x0) / dx : Infinity, ny = dy ? ((dy > 0 ? (ty + 1) * S : ty * S) - y0) / dy : Infinity, t = 0;
      for (let guard = 0; guard < 1e6; guard++) {
        if (past(t)) break;
        const v = T.grid.get(T.layer, tx, ty);
        if (T.solid[v]) {
          take({ t, x: x0 + dx * t, y: y0 + dy * t, tile: { x: tx, y: ty, v } });
          break;
        }
        if (tx === ex && ty === ey) break;
        if (nx < ny) {
          t = nx;
          nx += ddx;
          tx += sx;
        } else {
          t = ny;
          ny += ddy;
          ty += sy;
        }
        if (t > 1) break;
      }
    }
    return found.hit;
  }
};

// src/world/move.ts
var move_exports = {};
__export(move_exports, {
  Platform: () => Platform,
  topdown: () => topdown
});
var PLATFORM = {
  walkUnder: 0.62,
  runSpan: 0.28,
  grabY: 0.5,
  grabX: 0.6,
  grabBelow: 3,
  grabTop: 2,
  grabBottom: 1,
  leap: 0.7,
  leapKick: 60,
  letGoX: 0.6,
  letGoY: 0.3,
  dropY: 0.5,
  dropFoot: 4,
  dropTime: 0.25,
  hop: 70,
  hopGravity: 0.9,
  stepMin: 2,
  stepMax: 7,
  follow: 7
};
var Platform = class {
  constructor(numbers, options = {}) {
    this.res = { climbing: false, grabbed: false };
    this.n = numbers;
    this.o = Object.assign({}, PLATFORM, options);
  }
  /** The body's box at x, y: [x0, y0, x1, y1]. */
  box(x, y) {
    const P = this.n;
    return [x - P.w / 2, y - P.h, x + P.w / 2, y];
  }
  /** What the body's box at x, y overlaps (a hair inside its edges), or null. */
  hits(space, x, y) {
    const P = this.n;
    return space.hits(x - P.w / 2 + 0.01, y - P.h + 0.01, x + P.w / 2 - 0.01, y - 0.01);
  }
  /** One step of dt seconds. The result is kept and reused: read it before the next step. */
  step(space, b, c, dt) {
    const P = this.n, O = this.o, res = this.res;
    const ax = c.ax, ay = c.ay, jumpHit = c.jumpHit;
    let busy = c.busy === void 0 ? 1 : c.busy;
    res.climbing = false;
    res.grabbed = false;
    b.drop = Math.max(0, b.drop - dt);
    if (ax) b.face = ax > 0 ? 1 : -1;
    if (!b.ladder && Math.abs(ay) > O.grabY && Math.abs(ax) < O.grabX) {
      const l = space.ladderAt(b.x, b.y - P.h, b.y + (ay > 0 ? O.grabBelow : 0));
      if (l && (ay < 0 ? b.y > l.y0 + O.grabTop : b.y < l.y1 - O.grabBottom)) {
        b.ladder = l;
        b.x = l.x;
        b.vx = 0;
        res.grabbed = true;
        busy = 1;
      }
    }
    if (b.ladder) {
      const l = b.ladder;
      b.vy = ay * P.climb;
      b.y += b.vy * dt;
      b.vx = 0;
      if (b.y <= l.y0) {
        b.y = l.y0;
        b.ladder = null;
        b.ground = true;
        b.vy = 0;
      } else if (b.y >= l.y1) {
        b.y = l.y1;
        b.ladder = null;
        b.ground = true;
        b.vy = 0;
      } else if (jumpHit) {
        b.ladder = null;
        b.vy = -P.jump * O.leap;
        b.vx = b.face * O.leapKick;
      } else if (Math.abs(ax) > O.letGoX && Math.abs(ay) < O.letGoY) {
        b.ladder = null;
      }
      if (b.ladder) {
        b.walked += Math.abs(b.vy * dt);
        res.climbing = true;
        return res;
      }
    }
    const m = Math.abs(ax), sp = c.scale === void 0 ? 1 : c.scale;
    const pace = (m < O.walkUnder ? P.walk : lerp(P.walk, P.speed, clamp((m - O.walkUnder) / O.runSpan, 0, 1))) * sp;
    const target = Math.sign(ax) * pace * busy, acc = b.ground ? P.accel : P.airAccel;
    if (ax) b.vx += clamp(target - b.vx, -acc * dt, acc * dt);
    else b.vx -= clamp(b.vx, -P.friction * dt, P.friction * dt);
    b.coyote = b.ground ? P.coyote : Math.max(0, b.coyote - dt);
    if (jumpHit) {
      const onWay = b.ground && !space.hits(b.x - O.dropFoot, b.y, b.x + O.dropFoot, b.y + 2) && space.way(b.x, b.y - 1, b.y + 1) !== null;
      if (ay > O.dropY && onWay) {
        b.drop = O.dropTime;
        b.ground = false;
        b.y += 1;
      } else if (b.coyote > 0) {
        b.vy = -P.jump;
        b.coyote = 0;
        b.ground = false;
      }
    }
    b.vy = Math.min(b.vy + P.gravity * dt, P.maxFall);
    if (!c.jump && b.vy < -O.hop) b.vy += P.gravity * dt * O.hopGravity;
    let nx = b.x + b.vx * dt;
    const hx = this.hits(space, nx, b.y);
    if (hx) {
      let stepped = false;
      if (b.ground) {
        for (let s = O.stepMin; s <= O.stepMax; s += 1) if (!this.hits(space, nx, b.y - s)) {
          b.y -= s;
          stepped = true;
          break;
        }
      }
      if (!stepped) {
        nx = b.vx > 0 ? hx.x0 - P.w / 2 - 0.01 : hx.x1 + P.w / 2 + 0.01;
        if (this.hits(space, nx, b.y)) nx = b.x;
        b.vx = 0;
      }
    }
    b.walked += Math.abs(nx - b.x);
    b.x = nx;
    if (b.ground && b.vy >= 0 && !b.drop) {
      const s = space.way(b.x, b.y - O.follow, b.y + O.follow);
      if (s !== null && !this.hits(space, b.x, s)) b.y = s;
    }
    const wasY = b.y;
    let ny = b.y + b.vy * dt;
    b.ground = false;
    if (b.vy >= 0) {
      const hy = this.hits(space, b.x, ny);
      if (hy) {
        ny = hy.y0;
        b.vy = 0;
        b.ground = true;
      } else if (!b.drop) {
        const s = space.way(b.x, wasY - 0.5, ny + 0.5);
        if (s !== null) {
          ny = s;
          b.vy = 0;
          b.ground = true;
        }
      }
    } else {
      const hy = this.hits(space, b.x, ny);
      if (hy) {
        ny = hy.y1 + P.h + 0.01;
        b.vy = 0;
      }
    }
    b.y = ny;
    return res;
  }
};
var TURNS = [0.7, -0.7, 1.2, -1.2];
var TURN_CS = TURNS.map((t) => [Math.cos(t), Math.sin(t)]);
function topdown(space, b, dx, dy, r, o = {}) {
  if (!dx && !dy) return;
  if (!space.circleHits(b.x + dx, b.y + dy, r)) {
    b.x += dx;
    b.y += dy;
    return;
  }
  if (space.circleHits(b.x, b.y, r)) {
    const was = space.circleDepth(b.x, b.y, r), now = space.circleDepth(b.x + dx, b.y + dy, r);
    if (now < was || now === was && !space.inTiles(b.x + dx, b.y + dy)) {
      b.x += dx;
      b.y += dy;
    }
    return;
  }
  const x0 = b.x, y0 = b.y, halvings = o.bisect === void 0 ? 4 : o.bisect;
  for (let axis = 0; axis < 2; axis++) {
    const mx = axis ? 0 : dx, my = axis ? dy : 0;
    if (!mx && !my) continue;
    let lo = 0, hi = 1;
    if (!space.circleHits(b.x + mx, b.y + my, r)) lo = 1;
    else for (let k = 0; k < halvings; k++) {
      const mid = (lo + hi) / 2;
      if (space.circleHits(b.x + mx * mid, b.y + my * mid, r)) hi = mid;
      else lo = mid;
    }
    b.x += mx * lo;
    b.y += my * lo;
  }
  const m = Math.hypot(dx, dy);
  if (Math.hypot(b.x - x0, b.y - y0) < m * (o.round === void 0 ? 0.3 : o.round)) {
    const turns = o.turns ? o.turns.map((t) => [Math.cos(t), Math.sin(t)]) : TURN_CS, k = o.reach === void 0 ? 0.8 : o.reach;
    for (const [c, s] of turns) {
      const tx = (dx * c - dy * s) * k, ty = (dx * s + dy * c) * k;
      if (!space.circleHits(x0 + tx, y0 + ty, r)) {
        b.x = x0 + tx;
        b.y = y0 + ty;
        return;
      }
    }
  }
}

// src/world/path.ts
var path_exports = {};
__export(path_exports, {
  AStar: () => AStar,
  Routes: () => Routes,
  distances: () => distances
});
var QUEUE = new Int32Array(0);
function distances(cells, w, h, x, y, solid, avoid, out) {
  const n = w * h, d = out || new Int16Array(n);
  if (QUEUE.length < n) QUEUE = new Int32Array(n);
  const q = QUEUE;
  d.fill(-1);
  const s = y * w + x;
  if (x < 0 || y < 0 || x >= w || y >= h) return d;
  d[s] = 0;
  q[0] = s;
  let tail = 1;
  for (let qi = 0; qi < tail; qi++) {
    const i = q[qi], cx = i % w, cy = (i - cx) / w, next = d[i] + 1;
    if (cx + 1 < w) {
      const j = i + 1;
      if (d[j] < 0 && !solid[cells[j]] && !(avoid && avoid[j])) {
        d[j] = next;
        q[tail++] = j;
      }
    }
    if (cx > 0) {
      const j = i - 1;
      if (d[j] < 0 && !solid[cells[j]] && !(avoid && avoid[j])) {
        d[j] = next;
        q[tail++] = j;
      }
    }
    if (cy + 1 < h) {
      const j = i + w;
      if (d[j] < 0 && !solid[cells[j]] && !(avoid && avoid[j])) {
        d[j] = next;
        q[tail++] = j;
      }
    }
    if (cy > 0) {
      const j = i - w;
      if (d[j] < 0 && !solid[cells[j]] && !(avoid && avoid[j])) {
        d[j] = next;
        q[tail++] = j;
      }
    }
  }
  return d;
}
var AStar = class {
  constructor(w, h, o = {}) {
    this.gen = 0;
    this.heap = [];
    const n = w * h;
    this.w = w;
    this.h = h;
    this.cap = o.cap || n;
    this.diag = o.diag || 1.414;
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.from = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
  }
  /** The nearest walkable tile to x, y within r rings of it (rings outward, rows top to bottom), or null. */
  near(x, y, walkable, r = 7) {
    const ok = (i, j) => i >= 0 && j >= 0 && i < this.w && j < this.h && walkable(i, j);
    if (ok(x, y)) return [x, y];
    for (let k = 1; k <= r; k++) for (let j = -k; j <= k; j++) for (let i = -k; i <= k; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== k) continue;
      if (ok(x + i, y + j)) return [x + i, y + j];
    }
    return null;
  }
  /** The way from sx, sy to tx, ty: its tiles after the start, the goal last ([[tx, ty]] if they're one); null if there's none within the cap. */
  find(sx, sy, tx, ty, o) {
    const W = this.w, H = this.h, walkable = o.walkable, cost = o.cost, D = this.diag;
    const snap = o.snap === void 0 ? 7 : o.snap;
    const s = this.near(sx, sy, walkable, snap), t = this.near(tx, ty, walkable, snap);
    if (!s || !t) return null;
    [sx, sy] = s;
    [tx, ty] = t;
    if (sx === tx && sy === ty) return [[tx, ty]];
    const G = this.g, F2 = this.f, from = this.from, stamp = this.stamp, closed = this.closed, heap = this.heap;
    const gen = ++this.gen;
    heap.length = 0;
    const push = (n) => {
      heap.push(n);
      let i = heap.length - 1;
      while (i > 0) {
        const p = i - 1 >> 1;
        if (F2[heap[p]] <= F2[heap[i]]) break;
        const q = heap[p];
        heap[p] = heap[i];
        heap[i] = q;
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (; ; ) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < heap.length && F2[heap[l]] < F2[heap[m]]) m = l;
          if (r < heap.length && F2[heap[r]] < F2[heap[m]]) m = r;
          if (m === i) break;
          const q = heap[m];
          heap[m] = heap[i];
          heap[i] = q;
          i = m;
        }
      }
      return top;
    };
    const est = (x, y) => {
      const dx = Math.abs(x - tx), dy = Math.abs(y - ty);
      return (dx + dy + (D - 2) * Math.min(dx, dy)) * 1;
    };
    const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H && walkable(x, y);
    const si = sy * W + sx, ti = ty * W + tx;
    G[si] = 0;
    F2[si] = est(sx, sy);
    stamp[si] = gen;
    from[si] = -1;
    push(si);
    let found = false, iter = 0;
    while (heap.length && iter++ < this.cap) {
      const cur = pop();
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      if (cur === ti) {
        found = true;
        break;
      }
      const cx = cur % W, cy = cur / W | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!ok(nx, ny)) continue;
        if (dx && dy && (!ok(cx + dx, cy) || !ok(cx, cy + dy))) continue;
        const ni = ny * W + nx;
        if (closed[ni] === gen) continue;
        let c = cost ? cost(nx, ny, cx, cy) : 1;
        c *= dx && dy ? D : 1;
        const g = G[cur] + c;
        if (stamp[ni] !== gen || g < G[ni]) {
          stamp[ni] = gen;
          G[ni] = g;
          F2[ni] = g + est(nx, ny);
          from[ni] = cur;
          push(ni);
        }
      }
    }
    if (!found) return null;
    const out = [];
    for (let n = ti; n !== si && n !== -1; n = from[n]) out.push([n % W, n / W | 0]);
    out.reverse();
    return out;
  }
};
var Routes = class {
  constructor() {
    this.out = /* @__PURE__ */ new Map();
    this.seq = 0;
  }
  /** A link from a to b (and back, with the same leg, unless oneWay). */
  link(a, b, cost, leg, oneWay = false) {
    this.add(a, b, cost, leg);
    if (!oneWay) this.add(b, a, cost, leg);
    return this;
  }
  add(a, b, cost, leg) {
    if (!(cost >= 0)) throw new Error("Tycho.path: a link costs nothing or more");
    let l = this.out.get(a);
    if (!l) this.out.set(a, l = []);
    l.push({ to: b, cost, leg, seq: this.seq++ });
    if (!this.out.has(b)) this.out.set(b, []);
  }
  /** The places linked so far. */
  places() {
    return [...this.out.keys()];
  }
  /** The cheapest route from a to b, or null if none joins them. */
  route(a, b) {
    if (!this.out.has(a) || !this.out.has(b)) return null;
    if (a === b) return { cost: 0, places: [a], legs: [] };
    const best = /* @__PURE__ */ new Map([[a, 0]]), prev = /* @__PURE__ */ new Map(), done = /* @__PURE__ */ new Set();
    const heap = [[0, -1, a]];
    const less = (p, q) => p[0] < q[0] || p[0] === q[0] && p[1] < q[1];
    const push = (e) => {
      heap.push(e);
      let i = heap.length - 1;
      while (i > 0) {
        const p = i - 1 >> 1;
        if (!less(heap[i], heap[p])) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (; ; ) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && less(heap[l], heap[m])) m = l;
          if (r < heap.length && less(heap[r], heap[m])) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    while (heap.length) {
      const [c, , p] = pop();
      if (done.has(p)) continue;
      done.add(p);
      if (p === b) break;
      for (const e of this.out.get(p)) {
        const nc = c + e.cost;
        if (done.has(e.to)) continue;
        const was = best.get(e.to);
        if (was === void 0 || nc < was) {
          best.set(e.to, nc);
          prev.set(e.to, { from: p, leg: e.leg });
          push([nc, e.seq, e.to]);
        }
      }
    }
    if (!done.has(b)) return null;
    const places = [b], legs = [];
    for (let p = b; p !== a; ) {
      const s = prev.get(p);
      if (s.leg !== void 0) legs.push(s.leg);
      places.push(s.from);
      p = s.from;
    }
    return { cost: best.get(b), places: places.reverse(), legs: legs.reverse() };
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
