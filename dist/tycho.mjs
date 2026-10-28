/* Tycho 2.0.0 (tycho): an engine and a shelf of game features for small pixel games. Built from src/ by scripts/build.mjs; don't edit. MIT license. */
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

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

// src/shell/audio.ts
var audio_exports = {};
__export(audio_exports, {
  Bank: () => Bank,
  Engine: () => Engine,
  Music: () => Music,
  Rand: () => Rand,
  band: () => band,
  curve: () => curve,
  drone: () => drone,
  env: () => env,
  fm: () => fm,
  hz: () => hz,
  impulse: () => impulse,
  noise: () => noise2,
  noiseBuffer: () => noiseBuffer,
  presence: () => presence,
  quiet: () => quiet,
  setting: () => setting,
  space: () => space,
  stack: () => stack,
  tone: () => tone2,
  trem: () => trem,
  trim: () => trim,
  voiceOut: () => voiceOut,
  waves: () => waves
});
var Rand = class {
  constructor(seed = 625341585) {
    this.s = seed >>> 0;
  }
  /** 0..1. */
  next() {
    let s = this.s;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    this.s = s;
    return s / 4294967296;
  }
  /** a..b. */
  range(a, b) {
    return a + (b - a) * this.next();
  }
};
function hz(semi, root = 440) {
  return root * Math.pow(2, semi / 12);
}
function setting(v) {
  if (v === void 0 || v === true) return 1;
  if (v === false) return 0;
  const n = +v || 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
function quiet(p) {
  if (p && p.catch) p.catch(() => {
  });
}
function waves(c, recipes = {}) {
  const out = {};
  for (const [name, [n, f]] of Object.entries(recipes)) {
    let w = null;
    Object.defineProperty(out, name, { enumerable: true, get() {
      if (!w) {
        const re = new Float32Array(n + 1), im = new Float32Array(n + 1);
        for (let k = 1; k <= n; k++) im[k] = f(k);
        w = c.createPeriodicWave(re, im);
      }
      return w;
    } });
  }
  return out;
}
function env(p, t, a, g, d, hold) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(g, t + a);
  if (hold) p.setValueAtTime(g, t + a + hold);
  p.setTargetAtTime(0, t + a + (hold || 0), d);
  return t + a + (hold || 0) + d * 6;
}
function voiceOut(S, o, v, g) {
  g.connect(o.node);
  if (v.send) {
    if (!o.send) {
      o.send = S.ctx.createGain();
      o.send.gain.value = o.level;
      o.send.connect(o.sendTo);
    }
    const s = S.ctx.createGain();
    s.gain.value = v.send;
    g.connect(s);
    s.connect(o.send);
  }
}
function tone2(S, o, t, v) {
  const c = S.ctx, osc = c.createOscillator(), g = c.createGain();
  if (v.w && S.waves[v.w]) osc.setPeriodicWave(S.waves[v.w]);
  else osc.type = v.w || "sine";
  osc.frequency.setValueAtTime(v.f, t);
  if (v.f2) osc.frequency.exponentialRampToValueAtTime(v.f2, t + (v.glide || 0.1));
  if (v.det) osc.detune.value = v.det;
  let node = osc;
  if (v.lp) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = v.lp;
    f.Q.value = v.q || 0.7;
    node.connect(f);
    node = f;
  }
  node.connect(g);
  const end = env(g.gain, t, v.a || 5e-3, v.g === void 0 ? 1 : v.g, v.d || 0.1, v.hold);
  if (v.vib) {
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = v.vib[0];
    lg.gain.value = v.vib[1];
    lfo.connect(lg);
    lg.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(end);
  }
  voiceOut(S, o, v, g);
  osc.start(t);
  osc.stop(end);
  osc.stopAt = end;
  o.srcs.push(osc);
  o.end = Math.max(o.end, end);
  return end;
}
function noise2(S, o, t, v) {
  const c = S.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = S.noise;
  src.loop = true;
  f.type = v.ft || "bandpass";
  f.Q.value = v.q || 1;
  f.frequency.setValueAtTime(v.f, t);
  if (v.f2) f.frequency.exponentialRampToValueAtTime(v.f2, t + (v.glide || 0.1));
  src.connect(f);
  f.connect(g);
  const end = env(g.gain, t, v.a || 3e-3, v.g === void 0 ? 1 : v.g, v.d || 0.05, v.hold);
  voiceOut(S, o, v, g);
  src.start(t, S.rand.next() * 1.5);
  src.stop(end);
  src.stopAt = end;
  o.srcs.push(src);
  o.end = Math.max(o.end, end);
  return end;
}
function trem(S, node, t, tr) {
  if (!tr) return node;
  const c = S.ctx, g = c.createGain(), l = c.createOscillator(), lg = c.createGain();
  g.gain.value = 1 - tr[1] / 2;
  l.frequency.value = tr[0];
  lg.gain.value = tr[1] / 2;
  l.connect(lg);
  lg.connect(g.gain);
  node.connect(g);
  l.start(t);
  return g;
}
function fm(S, o, t, v) {
  const c = S.ctx, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain(), gl = v.glide || 0.1, ratio = v.ratio;
  car.frequency.setValueAtTime(v.f, t);
  mod.frequency.setValueAtTime(v.f * ratio, t);
  if (v.f2) {
    car.frequency.exponentialRampToValueAtTime(v.f2, t + gl);
    mod.frequency.exponentialRampToValueAtTime(v.f2 * ratio, t + gl);
  }
  mg.gain.setValueAtTime(v.f * v.i0, t);
  mg.gain.setTargetAtTime(v.f * (v.i1 || 0), t, v.id || 0.05);
  mod.connect(mg);
  mg.connect(car.frequency);
  let node = car;
  if (v.lp) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = v.lp;
    f.Q.value = 0.7;
    node.connect(f);
    node = f;
  }
  node = trem(S, node, t, v.trem);
  node.connect(g);
  const end = env(g.gain, t, v.a || 2e-3, v.g === void 0 ? 1 : v.g, v.d || 0.1, v.hold);
  voiceOut(S, o, v, g);
  car.start(t);
  mod.start(t);
  car.stop(end);
  mod.stop(end);
  car.stopAt = end;
  o.srcs.push(car);
  o.end = Math.max(o.end, end);
}
function stack(S, o, t, v) {
  const c = S.ctx, f = c.createBiquadFilter(), g = c.createGain(), n = v.n || 3, gl = v.glide || 0.2;
  f.type = "lowpass";
  f.Q.value = v.q || 0.9;
  f.frequency.setValueAtTime(v.lp, t);
  if (v.lp2) f.frequency.exponentialRampToValueAtTime(v.lp2, t + (v.sweep || 0.2));
  trem(S, f, t, v.trem).connect(g);
  const end = env(g.gain, t, v.a || 0.01, (v.g === void 0 ? 1 : v.g) / Math.sqrt(n), v.d || 0.2, v.hold);
  for (let i = 0; i < n; i++) {
    const osc = c.createOscillator(), k = Math.pow(2, ((n > 1 ? i / (n - 1) : 0.5) - 0.5) * (v.spread || 10) / 1200);
    if (v.w && S.waves[v.w]) osc.setPeriodicWave(S.waves[v.w]);
    else osc.type = v.w || "sine";
    osc.frequency.setValueAtTime(v.f * k, t);
    if (v.f2) osc.frequency.exponentialRampToValueAtTime(v.f2 * k, t + gl);
    osc.connect(f);
    osc.start(t);
    osc.stop(end);
    osc.stopAt = end;
    o.srcs.push(osc);
  }
  voiceOut(S, o, v, g);
  o.end = Math.max(o.end, end);
}
function noiseBuffer(c, rand, secs = 2) {
  const n = c.sampleRate * secs, buf = c.createBuffer(1, n, c.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = rand.next() * 2 - 1;
  return buf;
}
var CHAIN = { threshold: -10, knee: 6, ratio: 10, attack: 3e-3, release: 0.25, lp: 9e3, lpQ: 0.5, hp: 80, hpQ: 0.6 };
var SPACE = { taps: [[0.193, -0.6], [0.311, 0.6], [0.467, 0]], lp: 2200, fb: 0.48 };
function space(c, dest, level, o = {}) {
  const taps = o.taps || SPACE.taps, lpf = o.lp ?? SPACE.lp, fbg = o.fb ?? SPACE.fb;
  const inp = c.createGain(), out = c.createGain();
  inp.gain.value = 1;
  out.gain.value = level;
  out.connect(dest);
  taps.forEach(([dt, pan]) => {
    const dl = c.createDelay(1), lp = c.createBiquadFilter(), fb = c.createGain();
    dl.delayTime.value = dt;
    lp.type = "lowpass";
    lp.frequency.value = lpf;
    fb.gain.value = fbg;
    inp.connect(dl);
    dl.connect(lp);
    lp.connect(fb);
    fb.connect(dl);
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      lp.connect(p);
      p.connect(out);
    } else lp.connect(out);
  });
  return inp;
}
var Engine = class {
  constructor(o) {
    this.ready = false;
    this.failed = false;
    this.realtime = false;
    this.noise = null;
    this.waves = {};
    /** When each voice sounding now ends. */
    this.ends = [];
    /** When each cue last played. */
    this.last = {};
    /** The levels last applied. */
    this.levels = { music: -1, sfx: -1 };
    /** The music (built with the context, ticked with the engine), if any. */
    this.score = null;
    /** The bank the cues' rendered parts come from, if any. */
    this.bank = null;
    this.listening = false;
    this.o = o;
    this.rand = o.rand || new Rand();
    this.root = o.root ?? 440;
  }
  /** Makes the whole graph on ctx: the page's AudioContext (realtime), or a
   * test's OfflineAudioContext. */
  build(ctx, realtime) {
    const c = ctx, ch = Object.assign({}, CHAIN, this.o.chain || {}), M = this.o.mix;
    this.ctx = c;
    this.realtime = !!realtime;
    this.ends = [];
    this.last = {};
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = ch.threshold;
    lim.knee.value = ch.knee;
    lim.ratio.value = ch.ratio;
    lim.attack.value = ch.attack;
    lim.release.value = ch.release;
    lim.connect(c.destination);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = ch.lp;
    lp.Q.value = ch.lpQ;
    lp.connect(lim);
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = ch.hp;
    hp.Q.value = ch.hpQ;
    hp.connect(lp);
    this.out = c.createGain();
    this.out.gain.value = M.master;
    this.out.connect(hp);
    this.sfx = c.createGain();
    this.sfx.gain.value = 0;
    this.sfx.connect(this.out);
    this.music = c.createGain();
    this.music.gain.value = 0;
    this.music.connect(this.out);
    this.space = space(c, this.out, M.space, this.o.space);
    this.sfxSend = c.createGain();
    this.sfxSend.gain.value = 0;
    this.sfxSend.connect(this.space);
    this.musicSend = c.createGain();
    this.musicSend.gain.value = 0;
    this.musicSend.connect(this.space);
    this.noise = noiseBuffer(c, this.rand, this.o.noiseSecs ?? 2);
    this.waves = waves(c, this.o.waves);
    this.levels = { music: -1, sfx: -1 };
    this.applyLevels(true);
    this.ready = true;
  }
  /** A setting's level: 'music' or 'sfx'. */
  level(kind) {
    return this.o.level ? this.o.level(kind) : 1;
  }
  /** Whether either setting wants sound at all. */
  wanted() {
    return this.level("music") > 0 || this.level("sfx") > 0;
  }
  /** The settings onto the buses (at once with `now`, else gliding); with
   * nothing wanted the live context sleeps, and costs nothing. */
  applyLevels(now) {
    if (!this.ctx) return;
    const m = this.level("music"), e = this.level("sfx"), t = this.ctx.currentTime, M = this.o.mix;
    if (m !== this.levels.music) {
      for (const b of [this.music, this.musicSend]) b.gain.setTargetAtTime(m * M.music, t, now ? 1e-3 : 0.3);
      this.levels.music = m;
    }
    if (e !== this.levels.sfx) {
      for (const b of [this.sfx, this.sfxSend]) b.gain.setTargetAtTime(e * M.sfx, t, now ? 1e-3 : 0.05);
      this.levels.sfx = e;
    }
    if (this.realtime && this.ctx.state !== "closed" && typeof document !== "undefined") {
      const ac = this.ctx;
      if (!this.wanted()) quiet(ac.suspend());
      else if (!document.hidden && this.ctx.state !== "running") quiet(ac.resume());
    }
  }
  /** A cue's output: its voices meet in one node, its level and its pan, and
   * leave through the effects' bus (or `bus`; the space through the same
   * bus's send). */
  cueOut(t, g, pan, bus) {
    const c = this.ctx, node = c.createGain(), b = bus || this.sfx;
    node.gain.value = g;
    let last = node;
    if (pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      node.connect(p);
      last = p;
    }
    last.connect(b);
    return { node, last, send: null, sendTo: b === this.sfx ? this.sfxSend : this.musicSend, level: g, srcs: [], end: t, pan };
  }
  /** Cuts a finished cue loose once its last voice is done. */
  cueDone(o) {
    let tail = null;
    for (const s of o.srcs) if (!tail || s.stopAt > tail.stopAt) tail = s;
    if (tail) tail.onended = () => {
      try {
        o.node.disconnect();
        if (o.extra) o.extra.disconnect();
        if (o.last !== o.node) o.last.disconnect();
        if (o.send) o.send.disconnect();
      } catch (e) {
      }
    };
  }
  /** Where a cue is heard from, by its distance from the listener. */
  where(o) {
    const p = o.x === void 0 || !this.o.listener ? null : this.o.listener();
    if (!p) return { g: 1, pan: 0 };
    const M = this.o.mix, dx = o.x - p.x, dy = o.y - p.y, m = Math.hypot(dx, dy), N = M.near;
    const k = m <= N[0] ? 1 : m >= N[1] ? 0 : 1 - (m - N[0]) / (N[1] - N[0]);
    const pan = dx / M.panW;
    return { g: k * k, pan: pan < -M.panMax ? -M.panMax : pan > M.panMax ? M.panMax : pan };
  }
  /** Plays cue `name` at `when` (now, if not given). Returns whether it played. */
  play(name, opts, when) {
    const cue = this.o.cues[name];
    if (!cue || !this.ready) return false;
    const o = opts || {}, now = this.ctx.currentTime, t = Math.max(now, when || now), M = this.o.mix;
    if (cue.music) {
      if (cue.fn) cue.fn(this, null, t, o);
      return true;
    }
    if (this.levels.sfx <= 0) return false;
    if (t - (this.last[name] === void 0 ? -99 : this.last[name]) < (cue.gap === void 0 ? M.gap : cue.gap)) return false;
    this.ends = this.ends.filter((e) => e > t);
    if (this.ends.length >= M.voices && !cue.pri) return false;
    const parts = cue.bank ? cue.bank(o) : null;
    if (parts && (!this.bank || !this.bank.has(parts[0][0]))) return false;
    const w = cue.where ? cue.where(o) : this.where(o.x === void 0 && cue.at ? cue.at() : o);
    if (w.g < 0.03) return false;
    this.last[name] = t;
    const out = this.cueOut(t, (cue.g || 0.3) * w.g * (o.g || 1), w.pan);
    if (parts) this.playBank(out, t, parts, cue.spread === void 0 ? 0.04 : cue.spread, w.rate || 1, cue.lp);
    else if (cue.fn) cue.fn(this, out, t, o);
    if (cue.also) cue.also(t);
    this.cueDone(out);
    this.ends.push(out.end);
    return true;
  }
  /** A cue from the bank: each part a rendered variant, all at one speed a
   * little off true (and through a low pass somewhere in lp, if it has one),
   * so no two plays are the same. */
  playBank(out, t, parts, spread, k, lp) {
    const c = this.ctx, rate = k * (1 + this.rand.range(-spread, spread)), bank = this.bank;
    if (lp) {
      const f = c.createBiquadFilter(), was = out.node;
      f.type = "lowpass";
      f.frequency.value = this.rand.range(lp[0], lp[1]);
      f.Q.value = 0.6;
      f.connect(was);
      out.node = f;
      out.extra = was;
    }
    for (const [key, g, dt] of parts) {
      if (!bank.has(key)) continue;
      const b = bank.pick(key), src = c.createBufferSource(), at = t + (dt || 0);
      src.buffer = b;
      src.playbackRate.value = rate;
      let node = src;
      if (g !== 1) {
        const gn = c.createGain();
        gn.gain.value = g;
        src.connect(gn);
        node = gn;
      }
      node.connect(out.node);
      src.start(at);
      src.stopAt = at + b.duration / rate;
      out.srcs.push(src);
      out.end = Math.max(out.end, src.stopAt);
    }
  }
  /** Every frame: the settings, then the music. Sound never stops the game. */
  tick(dt) {
    if (!this.ready || this.ctx.state !== "running") return;
    try {
      this.applyLevels(false);
      if (this.score) this.score.tick(dt);
    } catch (e) {
    }
  }
  /** Whether a cue could sound now: its rendered parts are ready (a cue made
   * live always is). */
  canPlay(name, opts) {
    const cue = this.o.cues[name];
    if (!cue || !cue.bank || !this.ready || !this.bank) return true;
    const bank = this.bank;
    return cue.bank(opts || {}).every(([k]) => bank.has(k));
  }
  /** The hook the game calls: a cue by name, never an error, nothing before
   * the first tap. */
  cue(name, opts) {
    if (!this.ready) return;
    try {
      this.play(name, opts);
    } catch (e) {
    }
  }
  /** The first tap (or key) makes the sound, as browsers ask; later ones wake
   * it if the browser put it to sleep. */
  unlock() {
    if (this.failed) return;
    try {
      if (!this.ctx) {
        const W = window;
        const AC = W.AudioContext || W.webkitAudioContext;
        if (!AC || this.o.canStart && !this.o.canStart()) {
          this.failed = !AC;
          return;
        }
        let ctx;
        try {
          ctx = new AC({ latencyHint: "interactive" });
        } catch (e) {
          ctx = new AC();
        }
        this.build(ctx, true);
        if (this.score) this.score.build(this);
        if (this.o.onStart) this.o.onStart(ctx);
        const b = ctx.createBufferSource();
        b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        b.connect(ctx.destination);
        b.start(0);
      }
      if (this.ctx.state !== "running" && !document.hidden && this.wanted()) quiet(this.ctx.resume());
    } catch (e) {
      this.failed = true;
    }
  }
  /** Listens for the first tap or key, and sleeps while the page is hidden
   * (waking when it's back, if sound is wanted). Once. */
  listen() {
    if (this.listening || typeof window === "undefined" || !window.addEventListener || typeof document === "undefined" || !document.addEventListener) return this;
    this.listening = true;
    const unlock = () => this.unlock();
    for (const ev of ["pointerdown", "touchend", "keydown", "click"]) window.addEventListener(ev, unlock, { capture: true, passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      try {
        const ac = this.ctx;
        if (document.hidden) quiet(ac.suspend());
        else if (this.wanted()) quiet(ac.resume());
      } catch (e) {
      }
    });
    window.addEventListener("pagehide", () => {
      try {
        if (this.ctx) quiet(this.ctx.suspend());
      } catch (e) {
      }
    });
    return this;
  }
};
var BANK_CHAIN = { lp: 8e3, lpQ: 0.5, hp: 35, drive: 1.4, oversample: "2x", verbLp: 5e3, wet: 0.2 };
var BANK_VERBS = { room: { secs: 0.45, modes: [431, 1173, 1777, 2390] }, hall: { secs: 1.4 } };
function curve(k) {
  const n = 1025, a = new Float32Array(n), m = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1) * 2 - 1;
    a[i] = Math.tanh(k * x) / m;
  }
  return a;
}
function impulse(rate, secs, modes, rand) {
  const n = Math.floor(rate * secs), chs = [new Float32Array(n), new Float32Array(n)];
  for (let ch = 0; ch < 2; ch++) {
    let lp = 0;
    const d = chs[ch];
    for (let i = 0; i < n; i++) {
      const t = i / rate, env2 = Math.exp(-t * 6.5 / secs), k = 0.15 + 0.8 * Math.exp(-t * 4 / secs);
      lp += (rand.next() * 2 - 1 - lp) * k;
      let v = lp * env2;
      for (let m = 0; m < modes.length; m++) v += Math.sin(2 * Math.PI * modes[m] * (1 + ch * 3e-3) * t) * 0.05 * Math.exp(-t * (9 + m * 4));
      d[i] = t < 4e-3 ? v * (t / 4e-3) : v;
    }
  }
  return chs;
}
function trim(c, buf, floor = 5e-3, fadeSecs = 0.03) {
  const chs = [];
  let peak = 0, last = 0;
  for (let k = 0; k < buf.numberOfChannels; k++) {
    const d = buf.getChannelData(k);
    chs.push(d);
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
    }
  }
  if (peak < 1e-5) return null;
  for (const d of chs) for (let i = d.length - 1; i > last; i--) if (Math.abs(d[i]) > peak * floor) {
    last = i;
    break;
  }
  const n = Math.min(buf.length, last + 1), fade = Math.floor(buf.sampleRate * fadeSecs), out = c.createBuffer(chs.length, n, buf.sampleRate);
  chs.forEach((d, k) => {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = d[i] / peak * Math.min(1, (n - i) / fade);
    out.copyToChannel(a, k);
  });
  return out;
}
var Bank = class {
  constructor(o) {
    this.bufs = {};
    this.started = false;
    this.done = false;
    this.bytes = 0;
    this.ms = 0;
    this.irs = null;
    this.noises = null;
    this.queue = null;
    this.total = 0;
    this.first = 0;
    this.made = 0;
    this.idling = false;
    this.o = o;
    this.rand = o.rand || new Rand();
    this.rate = o.rate ?? 48e3;
  }
  has(k) {
    const b = this.bufs[k];
    return !!(b && b !== "busy" && b.length);
  }
  /** A variant, not the one just played. */
  pick(k) {
    const b = this.bufs[k];
    let i = Math.floor(this.rand.next() * b.length);
    if (b.length > 1 && i === b.last) i = (i + 1) % b.length;
    b.last = i;
    return b[i];
  }
  /** Renders everything, a buffer at a time, yielding between them: every
   * sound's first variant (in order), then each one's second, and so on, so
   * each can play as soon as possible. An offline context needs no tap, so
   * this can run while the game loads, before any; its buffers play in the
   * live context the tap makes (resampled, if its rate differs). `wait` (ms)
   * puts it off a moment (so a tap that starts it isn't slowed). */
  async start(rate, wait = 0, o = {}) {
    if (this.started) return;
    this.started = true;
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const max = this.o.rate ?? 48e3;
    this.rate = Math.min(max, rate || max);
    const t0 = performance.now(), per = [], R = this.o.recipes;
    this.irs = {};
    const f = this.o.first ? this.o.first(this, o) : null;
    if (f) await f;
    for (const k of this.o.order) {
      const B = R[k], n = this.o.count ? this.o.count(k, B) : B.n || 1;
      this.bufs[k] = this.bufs[k] || [];
      per.push([k, B, n]);
    }
    const q = this.queue = [], most = per.reduce((a, p) => Math.max(a, p[2]), 0);
    for (let v = 0; v < most; v++) for (const [k, B, n] of per) if (v < n) q.push([k, B, v]);
    this.total = q.length;
    this.first = per.length;
    this.made = 0;
    while (q.length) {
      if (this.made >= this.first && o.enough && o.enough()) break;
      await this.renderNext();
      if (o.pace) await o.pace(this.made, this.total);
      else if (q.length) await new Promise((r) => setTimeout(r, this.o.gap ?? 40));
    }
    this.ms = performance.now() - t0;
    this.done = !q.length;
  }
  async renderNext() {
    const [k, B, v] = this.queue.shift(), b = await this.renderOne(B, v);
    if (b) {
      this.bufs[k].push(b);
      this.bytes += b.length * b.numberOfChannels * 4;
    }
    this.made++;
  }
  /** What the start left, a buffer at a time, only when it can't be felt:
   * at a free moment (the game says), or when the browser says it's idle
   * with time to spare. */
  idle() {
    if (this.idling || this.done || !this.queue || !this.queue.length) return;
    this.idling = true;
    const ric = typeof requestIdleCallback === "function", ms = this.o.idleMs ?? 12;
    const free = () => this.o.free ? this.o.free() : false;
    const go = async () => {
      await this.renderNext();
      if (!this.queue.length) {
        this.done = true;
        this.idling = false;
        return;
      }
      wait();
    };
    const wait = () => {
      if (ric) requestIdleCallback((dl) => free() || dl.timeRemaining() >= ms ? go() : wait(), { timeout: 1e3 });
      else setTimeout(() => free() ? go() : wait(), 250);
    };
    wait();
  }
  /** Renders those of keys not yet rendered, in turn, one variant each,
   * while still(); pace, if given, is awaited between them instead of the
   * gap. */
  async want(keys2, still = () => true, pace = null) {
    if (!this.rate || !this.irs) return;
    for (const k of keys2) {
      if (!still()) return;
      if (this.has(k) || this.bufs[k] === "busy") continue;
      this.bufs[k] = "busy";
      const b = await this.renderOne(this.o.recipes[k], 0);
      this.bufs[k] = b ? [b] : [];
      if (b) this.bytes += b.length * b.numberOfChannels * 4;
      if (pace) await pace(0, 0);
      else await new Promise((r) => setTimeout(r, this.o.gap ?? 40));
    }
  }
  /** Lets them go. */
  drop(keys2) {
    for (const k of keys2) {
      const b = this.bufs[k];
      if (b && b.length && b !== "busy") for (const x of b) this.bytes -= x.length * x.numberOfChannels * 4;
      delete this.bufs[k];
    }
  }
  /** One variant of a sound, rendered. */
  async renderOne(B, v) {
    const ch0 = Object.assign({}, BANK_CHAIN, this.o.chain || {}), verbs = this.o.verbs || BANK_VERBS;
    const rate = Math.min(this.rate, B.rate || this.rate), ch = B.ch || 1, c = new OfflineAudioContext(ch, Math.ceil(B.dur * rate), rate);
    const nz = this.noises || (this.noises = {});
    if (!nz[rate]) nz[rate] = noiseBuffer(c, this.rand, 2);
    const R = { ctx: c, waves: waves(c, this.o.waves), noise: nz[rate], rand: this.rand };
    const out = c.createGain(), lp = c.createBiquadFilter(), hp = c.createBiquadFilter(), sh = c.createWaveShaper(), dry = c.createGain();
    out.connect(c.destination);
    lp.type = "lowpass";
    lp.frequency.value = ch0.lp;
    lp.Q.value = ch0.lpQ;
    lp.connect(out);
    hp.type = "highpass";
    hp.frequency.value = ch0.hp;
    hp.connect(lp);
    sh.curve = curve(B.drive || ch0.drive);
    sh.oversample = ch0.oversample;
    sh.connect(hp);
    dry.connect(sh);
    let verbIn = dry;
    if (B.verb) {
      const V = verbs[B.verb] || { secs: 1 }, irs = this.irs || (this.irs = {});
      const ir = irs[B.verb + rate] || (irs[B.verb + rate] = impulse(rate, V.secs, V.modes || [], this.rand)), ib = c.createBuffer(2, ir[0].length, rate);
      ib.copyToChannel(ir[0], 0);
      ib.copyToChannel(ir[1], 1);
      const cv = c.createConvolver(), vl = c.createBiquadFilter(), vg = c.createGain();
      cv.buffer = ib;
      vl.type = "lowpass";
      vl.frequency.value = ch0.verbLp;
      vg.gain.value = B.wet || ch0.wet;
      verbIn = c.createGain();
      verbIn.gain.value = 1;
      dry.connect(verbIn);
      verbIn.connect(cv);
      cv.connect(vl);
      vl.connect(vg);
      vg.connect(out);
    }
    const o = { node: dry, sendTo: verbIn, level: 1, srcs: [], end: 0, send: null };
    B.fn(R, o, 4e-3, v);
    const buf = await c.startRendering();
    return trim(c, buf, this.o.trim && this.o.trim.floor, this.o.trim && this.o.trim.fade);
  }
};
function drone(S, L, dest) {
  const c = S.ctx, out = c.createGain(), tr = c.createGain(), lp = c.createBiquadFilter();
  out.gain.value = 0;
  tr.gain.value = 1;
  lp.type = "lowpass";
  lp.frequency.value = L.lp;
  lp.Q.value = 0.6;
  lp.connect(tr);
  tr.connect(out);
  out.connect(dest);
  let head = lp;
  if (L.bp) {
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = L.bp;
    bp.Q.value = 0.7;
    bp.connect(lp);
    head = bp;
  }
  const lfo = (rate, depth, param) => {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = rate;
    g.gain.value = depth;
    o.connect(g);
    g.connect(param);
    o.start();
  };
  if (L.trem) lfo(L.trem[0], L.trem[1], tr.gain);
  if (L.lfo) lfo(L.lfo[0], L.lfo[1], lp.frequency);
  const oscs = L.notes.map(([s, det]) => {
    const o = c.createOscillator();
    if (S.waves[L.w]) o.setPeriodicWave(S.waves[L.w]);
    else o.type = L.w;
    o.frequency.value = hz(s, S.root);
    o.detune.value = det;
    o.connect(head);
    o.start();
    return o;
  });
  return { out, lp, oscs, L };
}
function band(S, dest, type) {
  const c = S.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = S.noise;
  src.loop = true;
  f.type = type || "bandpass";
  f.frequency.value = 500;
  f.Q.value = 0.8;
  g.gain.value = 0;
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(0, S.rand.next() * 1.8);
  return { f, g };
}
function presence(s, at, w = 0.2) {
  let k = (s - at + w / 2) / w;
  k = k < 0 ? 0 : k > 1 ? 1 : k;
  return k * k * (3 - 2 * k);
}
var Music = class {
  constructor(o = {}) {
    this.S = null;
    this.built = false;
    /** The layers' drones, by id. */
    this.v = {};
    this.master = null;
    this.lastUp = -9;
    /** When each kind of event is next due. */
    this.nextEv = {};
    this.targets = /* @__PURE__ */ new WeakMap();
    this.layers = o.layers || {};
    this.every = o.every ?? 0.1;
  }
  build(S) {
    this.S = S;
    const c = S.ctx;
    this.master = c.createGain();
    this.master.gain.value = 1;
    this.master.connect(S.music);
    this.v = {};
    for (const id of Object.keys(this.layers)) this.v[id] = drone(S, this.layers[id], this.master);
    if (this.setup) this.setup(S);
    this.built = true;
  }
  tick(_dt) {
    if (!this.built) return;
    const now = this.S.ctx.currentTime;
    if (this.listen) this.listen(now);
    if (now - this.lastUp < this.every) return;
    this.lastUp = now;
    if (this.update) this.update(now, this.state ? this.state() : null);
  }
  /** A param glides to v (time constant tc) from now, unless that's already
   * its target. */
  set(p, v, now, tc) {
    const was = this.targets.get(p);
    if (was !== void 0 && Math.abs(was - v) < 1e-4) return;
    this.targets.set(p, v);
    p.setTargetAtTime(v, now, tc);
  }
  /** Forgets a param's target (it was set some other way). */
  forget(p) {
    this.targets.delete(p);
  }
  /** Events now and then: each [kind, least gap, most gap, ...] is first due
   * somewhere in its gap from now, and when it comes due fn(entry) runs and
   * the next is set. Kinds no longer listed are forgotten. */
  due(now, list, fn) {
    const R = this.S.rand;
    for (const e of list) {
      const [kind, lo, hi] = e;
      if (this.nextEv[kind] === void 0) this.nextEv[kind] = now + R.range(lo, hi);
      if (now < this.nextEv[kind]) continue;
      this.nextEv[kind] = now + R.range(lo, hi);
      fn(e);
    }
    for (const kind of Object.keys(this.nextEv)) if (!list.some((e) => e[0] === kind)) delete this.nextEv[kind];
  }
  /** The music dips a moment: to k at t, back after hold. */
  duck(t, k, hold) {
    const p = this.master && this.master.gain;
    if (!p) return;
    p.cancelScheduledValues(t);
    p.setTargetAtTime(k, t, 0.04);
    p.setTargetAtTime(1, t + hold, 0.6);
  }
};

// src/shell/inspect.ts
var inspect_exports = {};
__export(inspect_exports, {
  Inspector: () => Inspector,
  esc: () => esc,
  hhmm: () => hhmm,
  mind: () => mind
});
function hhmm(m) {
  const h = (m / 60 % 24 + 24) % 24;
  return String(Math.floor(h)).padStart(2, "0") + ":" + String(Math.floor(h % 1 * 60)).padStart(2, "0");
}
function esc(t) {
  return String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
}
var NEED_COLORS = ["#3af0e0", "#ffb040", "#ff4a5a"];
function mind(w, id, o = {}) {
  const P = o.prefix ?? "insp", p = w.get(id);
  const name = (x) => o.name ? o.name(x) : w.get(x) && w.get(x).name || x;
  if (!p) return `<h3>${esc(name(id))}</h3><p class="dim">Not in the world.</p><div class="buttons"><button data-${P}do="close">Close</button></div>`;
  const walk = o.walking ? o.walking(id) : "";
  const d = p.doing, at = (pid) => o.place ? o.place(pid, id) : !pid ? "anywhere" : String(pid);
  let h = `<h3>${esc(name(id))}</h3>${o.who ? `<p class="sub">${esc(o.who(id))}</p>` : ""}`;
  const now = !d ? "Nothing, waiting to choose." : d.kind === "travel" ? `Walking${walk} from ${esc(at(d.from))} to ${esc(at(d.to))}, to ${d.action}, till ${hhmm(d.end)}.` : d.kind === "wait" ? `Waiting at ${esc(at(p.place))} till ${hhmm(d.end)}.` : `${d.action} at ${esc(at(d.place || p.place))}, till ${hhmm(d.end)}.`;
  h += `<p><b>Now</b> ${now}${d && d.rank !== void 0 ? ` <small class="dim">(${d.layer || "free"}, rank ${d.rank})</small>` : ""}</p>`;
  if (p.directive && !p.directive.done) h += `<p class="dim">Told to: ${p.directive.do}${p.directive.label ? " · " + esc(p.directive.label) : ""}</p>`;
  const NC = o.needColors || NEED_COLORS;
  h += `<div class="${P}needs">` + Object.keys(p.needs).map((k) => {
    const v = w.needOf(id, k), c = v < 0 ? 0 : v > 1 ? 1 : v;
    return `<div><span>${k}</span><i><b style="width:${Math.round(c * 100)}%;background:${v > 0.85 ? NC[2] : v > 0.6 ? NC[1] : NC[0]}"></b></i></div>`;
  }).join("") + "</div>";
  const rv = w.reverie;
  if (rv) h += `<p class="dim">Mood ${(rv.mood(id) || 0).toFixed(2)}${o.about ? o.about(id, p) : ""}</p>`;
  const dec = w.why(id);
  if (!dec) h += '<h3>Why</h3><p class="dim">No choice made since the last time walk: play the clock on a little.</p>';
  if (dec) {
    h += `<h3>Why · ${hhmm(dec.t)}</h3><p class="dim">${esc(dec.reason || "")}</p><div class="${P}why">`;
    const pk = dec.picked, isPick = (c) => !!pk && c.id === pk.id && c.place === pk.place && c.target === pk.target;
    const cands = dec.candidates.slice().sort((a, b) => +isPick(b) - +isPick(a) || b.rank - a.rank || b.weight - a.weight).slice(0, o.options ?? 9);
    if (pk) h += `<p>Chose <b>${pk.id}</b> at ${esc(at(pk.place))}${pk.layer ? ` <small class="dim">(${pk.layer})</small>` : ""}. It's drawn from the best few, by weight squared, so the top one doesn't always win.</p>`;
    for (const c of cands) h += `<div class="${isPick(c) ? "pick" : c.blocked ? "no" : ""}"><b>${c.id}</b> <small>${esc(at(c.place))} · rank ${c.rank}${c.blocked ? "" : " · " + c.weight.toFixed(3)}</small><br><small>${esc(c.blocked || (c.parts || []).map(([n, v]) => n + " " + (+v).toFixed(2)).join(" × "))}</small></div>`;
    h += "</div>";
  }
  const ra = w.mind.routineAt(p), plan = (w.mind.routineFor(p, w.now) || []).slice().sort((a, b) => a[0] - b[0]), cur = ra && ra.entry;
  if (plan.length) h += `<h3>Today</h3><div class="${P}day">` + plan.map((e) => `<div class="${e === cur ? "cur" : ""}"><span>${String(Math.floor(e[0])).padStart(2, "0")}:${String(Math.round(e[0] % 1 * 60)).padStart(2, "0")}</span> ${e[2] === "*" ? "free" : e[2]} <small>${e[1] === null ? "" : esc(e[1] === "home" ? "home" : at(e[1]))}${e[3] && e[3].rank ? " · holds" : ""}</small></div>`).join("") + "</div>";
  const lines = w.westmarch.chronicle(id, w.now - (o.lately ?? 12 * 60)).slice(-(o.lines ?? 10));
  if (lines.length) h += `<h3>Lately</h3><div class="${P}log">` + lines.map((l) => `<div>${esc(l)}</div>`).join("") + "</div>";
  const fs = w.fellowship ? w.fellowship.relations(id).slice(0, o.known ?? 4) : [];
  const can = (x) => o.selectable ? o.selectable(x) : !!w.get(x);
  if (fs.length) h += `<h3>People</h3><div class="${P}list">` + fs.map((f) => can(f.id) ? `<button data-${P}sel="${f.id}">${esc(name(f.id))} <small>regard ${f.regard.toFixed(2)}</small></button>` : `<span class="dim">${esc(f.id)} · ${f.regard.toFixed(2)}</span>`).join("") + "</div>";
  h += `<div class="buttons">${o.buttons ? o.buttons(id) : ""}<button data-${P}do="close">Close</button></div>`;
  return h;
}
var STEP_LABEL = (m) => (m < 0 ? "−" : "+") + (Math.abs(m) % 60 ? Math.abs(m) + "m" : Math.abs(m) / 60 + "h");
var Inspector = class {
  constructor(o) {
    /** Whoever's picked. */
    this.sel = null;
    /** Who's somewhere, listed in the side: a title and their ids. */
    this.list = null;
    this.playing = false;
    this.dots = [];
    this.badges = [];
    /** The canvas's size in CSS px, and the device pixels to one. */
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.root = null;
    this.raf = 0;
    this.last = 0;
    this.sideT = 0;
    this.o = o;
    this.P = o.prefix ?? "insp";
    this.speed = o.speed ?? 60;
  }
  /** An element of the panel, by its name (its id is the prefix and it). */
  el(name) {
    const r = this.root, id = this.P + name;
    if (r && r.querySelector) return r.querySelector("#" + id);
    return typeof document !== "undefined" ? document.getElementById(id) : null;
  }
  html() {
    const P = this.P, speeds = this.o.speeds || [1, 10, 60, 240], steps = this.o.steps || [-60, -15, 15, 60];
    const sp = speeds.map((v) => `<option value="${v}"${v === this.speed ? " selected" : ""}>×${v === 1 ? "1 (game)" : v}</option>`).join("");
    const btn = (m) => `<button data-${P}="${m}"${m === -60 ? ' title="Back an hour"' : ""}>${STEP_LABEL(m)}</button>`;
    const back = steps.filter((m) => m < 0).map(btn).join(""), on = steps.filter((m) => m > 0).map(btn).join("");
    return `<div class="${P}"><div class="${P}bar">
      <span class="${P}clock" id="${P}clock"></span>
      ${back}<button data-${P}="play" class="go" id="${P}play">Play</button>${on}
      <select id="${P}speed" aria-label="Speed">${sp}</select>
      ${this.o.bar ? this.o.bar() : ""}
    </div><div class="${P}body"><div class="${P}view" id="${P}view"><canvas id="${P}cv"></canvas></div><div class="${P}side" id="${P}side"></div></div></div>`;
  }
  /** Wires the panel in root (where html() went) and runs it. */
  attach(root) {
    this.root = root;
    const P = this.P, cv = this.el("cv");
    if (!cv) return;
    root.querySelectorAll(`button[data-${P}]`).forEach((b) => b.onclick = () => {
      const k = b.dataset[P];
      if (k === "play") {
        this.playing = !this.playing;
        this.last = performance.now();
      } else if (/^-?\d+(\.\d+)?$/.test(k)) this.step(+k);
      else if (this.o.act && this.o.act(k, null, this) === false) return;
      this.draw();
      this.side(true);
    });
    const sp = this.el("speed");
    if (sp) sp.onchange = (e) => {
      this.speed = +e.target.value;
    };
    let down = null;
    const V = this.o.view;
    cv.onpointerdown = (e) => {
      down = { x: e.clientX, y: e.clientY, at: V && V.grab ? V.grab(this) : null, moved: 0 };
      cv.setPointerCapture(e.pointerId);
    };
    cv.onpointermove = (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down.moved = Math.max(down.moved, Math.abs(dx) + Math.abs(dy));
      if (V && V.drag) V.drag(dx, dy, down.at, this);
    };
    cv.onpointerup = (e) => {
      const d = down;
      down = null;
      if (d && d.moved < 6) {
        const r = cv.getBoundingClientRect();
        this.tap(e.clientX - r.left, e.clientY - r.top);
      }
    };
    cv.onwheel = (e) => {
      if (!V || !V.wheel) return;
      const r = cv.getBoundingClientRect();
      V.wheel(e, e.clientX - r.left, e.clientY - r.top, this);
    };
    this.size();
    this.draw();
    this.side(true);
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const tick = (t) => {
      const c = this.el("cv");
      if (this.o.open && !this.o.open() || !c || !c.isConnected) {
        this.playing = false;
        return;
      }
      const dt = Math.min(0.1, (t - this.last) / 1e3);
      this.last = t;
      if (this.playing) {
        this.step(this.speed * dt, true);
        this.draw();
      }
      if (t - this.sideT > 250) {
        this.sideT = t;
        this.side();
        this.clock();
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  /** The canvas, sized to its box (or taller, as the view asks: the box scrolls). */
  size() {
    const cv = this.el("cv"), box = this.el("view");
    if (!cv || !box) return;
    const dpr = typeof window !== "undefined" && window.devicePixelRatio || 1, V = this.o.view;
    const w = box.clientWidth, h = V && V.height ? V.height(box.clientHeight, this) : box.clientHeight;
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    this.w = w;
    this.h = h;
    this.dpr = dpr;
  }
  /** Draws the view afresh (sized again if its box or its height changed). */
  draw() {
    const cv = this.el("cv"), box = this.el("view");
    if (!cv || !box) return;
    const V = this.o.view, want = V && V.height ? V.height(box.clientHeight, this) : box.clientHeight;
    if (want !== this.h || cv.width !== Math.round(box.clientWidth * this.dpr)) this.size();
    const g = cv.getContext("2d");
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = this.o.bg || "#0a0812";
    g.fillRect(0, 0, this.w, this.h);
    this.dots = [];
    this.badges = [];
    if (V) V.draw(g, this);
  }
  /** Someone on the view, at x, y (CSS px), in their color: a ring if
   * they're picked, another if they're on the move. */
  dot(g, x, y, col, id, moving, r = 2.2) {
    const sel = id === this.sel;
    if (sel) {
      g.strokeStyle = "#ffffff";
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, r + 3, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = col;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    if (moving) {
      g.strokeStyle = "rgba(255,255,255,0.7)";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x, y, r + 1.2, 0, Math.PI * 2);
      g.stroke();
    }
    this.dots.push({ x, y, id });
  }
  /** A box on the view to tap. */
  badge(b) {
    this.badges.push(b);
  }
  /** A person's color now. */
  color(id) {
    const K = this.o.kinds || {}, k = this.o.kind ? this.o.kind(id) : "";
    return (K[k] || K.other || { color: "#c8c0d8" }).color;
  }
  /** A tap at x, y (CSS px on the view): the nearest person within 9 px is
   * picked; else the view hears of it, with the box under it. */
  tap(x, y) {
    let best = null, bd = 9;
    for (const d of this.dots) {
      const dd = Math.hypot(d.x - x, d.y - y);
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    if (best) {
      this.sel = best.id;
      this.list = null;
      this.draw();
      this.side(true);
      return;
    }
    const b = this.badges.find((q) => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1) || null;
    if (this.o.view && this.o.view.tap) this.o.view.tap(b, x, y, this);
  }
  /** The clock on (or back) by `min` game minutes; back no further than
   * Esper remembers (the nearest quarter hour after, said unless quiet). */
  step(min, quiet2) {
    const w = this.o.world();
    let t = this.o.clock.now() + min;
    if (min < 0 && w && w.esper) {
      const e = w.esper.earliest();
      if (t < e) {
        t = Math.ceil(e / 15) * 15;
        if (!quiet2 && this.o.say) this.o.say("Esper only remembers back to " + hhmm(e) + ".");
      }
    }
    this.o.clock.set(t);
    this.clock();
  }
  /** The bar: the clock's text, Play or Pause, and the game's own. */
  clock() {
    const c = this.el("clock");
    if (c) c.textContent = this.o.clock.text();
    const p = this.el("play");
    if (p) p.textContent = this.playing ? "Pause" : "Play";
    if (this.o.status) this.o.status(this);
  }
  /** Picks someone (or nobody). */
  select(id) {
    this.sel = id;
    this.list = null;
    if (id && this.o.onSelect) this.o.onSelect(id, this);
    this.draw();
    this.side(true);
  }
  /** The side: someone's mind, a list, or the summary; not redrawn under
   * the pointer while it's being read, unless forced. */
  side(force) {
    const el = this.el("side");
    if (!el) return;
    if (!force && el.matches(":hover")) return;
    const w = this.o.world();
    el.innerHTML = this.sel && w ? mind(w, this.sel, Object.assign({}, this.o, { prefix: this.P })) : this.list ? this.listHtml(this.list) : this.summary();
    const P = this.P;
    el.querySelectorAll(`[data-${P}sel]`).forEach((b) => b.onclick = () => this.select(b.dataset[P + "sel"]));
    el.querySelectorAll(`[data-${P}do]`).forEach((b) => b.onclick = () => {
      const k = b.dataset[P + "do"];
      if (k === "close") {
        this.sel = null;
        this.list = null;
      } else if (this.o.act && this.o.act(k, this.sel, this) === false) return;
      this.draw();
      this.side(true);
    });
  }
  /** Counts of everyone by kind, with their colors and words. */
  legend(n) {
    const K = this.o.kinds || {};
    return `<div class="${this.P}legend">` + Object.keys(K).filter((k) => n[k]).map((k) => `<span><i style="background:${K[k].color}"></i>${K[k].word} <b>${n[k]}</b></span>`).join("") + "</div>";
  }
  summary() {
    if (this.o.summary) return this.o.summary(this);
    const n = {}, ids = this.o.people();
    for (const id of ids) {
      const k = this.o.kind ? this.o.kind(id) : "other";
      n[k] = (n[k] || 0) + 1;
    }
    return `<h3>${ids.length} people</h3><p class="dim">Tap someone to see their mind.</p>` + this.legend(n);
  }
  /** Who's somewhere: a button each, in their color, with what they're doing. */
  listHtml(L) {
    const P = this.P, name = (id) => this.o.name ? this.o.name(id) : id;
    return `<h3>${L.title}</h3><div class="${P}list">` + L.ids.map((id) => `<button data-${P}sel="${id}"><i style="background:${this.color(id)}"></i>${name(id)} <small>${this.o.note ? this.o.note(id) : ""}</small></button>`).join("") + `</div><div class="buttons"><button data-${P}do="close">Back</button></div>`;
  }
};

// src/index.ts
var VERSION = "2.0.0";
export {
  VERSION,
  audio_exports as audio,
  color_exports as color,
  dev_exports as dev,
  gpu_exports as gpu,
  inspect_exports as inspect,
  light_exports as light,
  loader_exports as loader,
  loop_exports as loop,
  math_exports as math,
  post_exports as post,
  pwa_exports as pwa,
  save_exports as save,
  seed_exports as seed
};
