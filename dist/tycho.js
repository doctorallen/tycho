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
    gpu: () => gpu_exports,
    light: () => light_exports,
    loader: () => loader_exports,
    loop: () => loop_exports,
    math: () => math_exports,
    post: () => post_exports,
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

  // src/pixels/gpu.ts
  var gpu_exports = {};
  __export(gpu_exports, {
    BLEND: () => BLEND,
    Ctx: () => Ctx,
    F: () => F,
    Gpu: () => Gpu,
    Gradient: () => Gradient,
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
    constructor(canvas, o = {}) {
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
      this.canvas = canvas;
      this.o = Object.assign({ atlas: 2048, pages: 2, maxPages: 6, keep: 600, ring: 24, occlude: false }, o);
    }
    static create(canvas, o = {}) {
      if (typeof location !== "undefined" && /[?&]nogpu\b/.test(location.search)) return null;
      const g = new _Gpu(canvas, o);
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
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, w);
        gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y0);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y0, w, y1 - y0, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
        gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
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
      this.path = [x + this.m[4], y + this.m[5], x + w + this.m[4], y + h + this.m[5]];
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
      const c = this._rgba, ca = c[3] * al;
      if (!this.over && !G.drawn && G.target === "scene" && ca >= 1 && !this.clipBox && this._blend === 0 && this.plain() && x + this.tx <= 0 && y + this.ty <= 0 && x + this.tx + w >= G.w && y + this.ty + h >= G.h) {
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
    clearRect(x, y, w, h) {
      if (this.over) return;
      const G = this.gpu;
      if (this.plain() && x + this.tx <= 0 && y + this.ty <= 0 && x + this.tx + w >= G.w && y + this.ty + h >= G.h && !this.clipBox) {
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
      } else if (img.gpuOwn || img.width > G.o.atlas || img.height > G.o.atlas) {
        const t2 = G.dynTexs.get(img);
        dyn = t2 && t2.tex ? { tex: t2.tex } : G.ownTex(img, img.getContext("2d").getImageData(0, 0, img.width, img.height), 0, img.height);
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
