// The core (seed, math, color, loop) against the games' own copies, which it
// replaced: for the same inputs it must give the same outputs, bit for bit,
// or a world would paint differently after the move. The games' versions are
// kept here as they were.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as Tycho from '../dist/tycho.mjs';

const { seed, math, color, loop } = Tycho;

// ---- the games' originals --------------------------------------------------
const WD = {
  smooth: (t) => t * t * (3 - 2 * t),
  hash(x, y, s) {
    let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  },
  noise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), u = WD.smooth(x - xi), v = WD.smooth(y - yi);
    const a = WD.hash(xi, yi, s), b = WD.hash(xi + 1, yi, s), c = WD.hash(xi, yi + 1, s), d = WD.hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  },
  Rng: class {
    constructor(seed) { this.s = seed >>> 0; }
    f() { let t = (this.s += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    i(a, b) { return a + Math.floor(this.f() * (b - a + 1)); }
    pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  },
};
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashInts(...xs) {
  let h = 0x811c9dc5 | 0;
  for (const x of xs) { h = Math.imul(h ^ (x | 0), 0x01000193); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; }
  return h >>> 0;
}
function hashString(s) { let h = 0x811c9dc5 | 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return h >>> 0; }
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const lerp = (a, b, t) => a + (b - a) * t;
function makeNoise(seed) {
  const rng = mulberry32(seed);
  const P = new Float32Array(256 * 256);
  for (let i = 0; i < P.length; i++) P[i] = rng();
  const g = (i, j) => P[((j & 255) << 8) | (i & 255)];
  const sm = (t) => t * t * (3 - 2 * t);
  function v(x, y) { const xi = Math.floor(x), yi = Math.floor(y); const u = sm(x - xi), w = sm(y - yi); return lerp(lerp(g(xi, yi), g(xi + 1, yi), u), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), u), w); }
  return (x, y) => v(x, y) * 0.6 + v(x * 2.1 + 17, y * 2.1 + 9) * 0.3 + v(x * 4.3 + 3, y * 4.3 + 41) * 0.1;
}
class LodeRng {
  constructor(seed) { this.seed = seed >>> 0; this.next = mulberry32(this.seed); }
  f(a = 1, b) { return b === undefined ? this.next() * a : a + this.next() * (b - a); }
  i(a, b) { return Math.floor(a + this.next() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  weighted(list) { let total = 0; for (const [w] of list) total += Math.max(0, w); let r = this.next() * total; for (const [w, v] of list) { r -= Math.max(0, w); if (r < 0) return v; } return list[list.length - 1][1]; }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  fork() { return Math.floor(this.next() * 4294967296) >>> 0; }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
const SOOT = [8, 6, 12], WARM = [255, 238, 200];
function rampOf(anchors, n = 9, deep = 0.55, high = 0.3) {
  const A = anchors.map((a) => (typeof a === 'string' ? rgb(a) : a));
  const path = [mixRgb(A[0], SOOT, deep)].concat(A, [mixRgb(A[A.length - 1], WARM, high)]), pts = [];
  for (let i = 0; i + 1 < path.length; i++) for (let k = 0; k < 16; k++) pts.push(mixRgb(path[i], path[i + 1], k / 16));
  pts.push(path[path.length - 1]);
  const L = []; let m = -1; for (const c of pts) { m = Math.max(m, lum(c)); L.push(m); }
  const out = [];
  for (let k = 0, j = 0; k < n; k++) {
    const want = L[0] + (L[L.length - 1] - L[0]) * (k / (n - 1));
    while (j < L.length - 2 && L[j + 1] < want) j++;
    const u = L[j + 1] > L[j] ? clamp((want - L[j]) / (L[j + 1] - L[j]), 0, 1) : 0;
    out.push(mixRgb(pts[j], pts[j + 1], u));
  }
  return out;
}
function hexToRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function shade(hex, amt) { const [r, g, b] = hexToRgb(hex); if (amt < 0) return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt)); return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt); }
function mix(h1, h2, t) { const a = hexToRgb(h1), b = hexToRgb(h2); return rgbToHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)); }

// a spread of inputs: small, negative, large, fractional
const R = mulberry32(12345);
const ints = []; for (let i = 0; i < 400; i++) ints.push(Math.floor((R() - 0.5) * (i < 200 ? 4000 : 2e9)));
const reals = []; for (let i = 0; i < 400; i++) reals.push((R() - 0.5) * 900);

test('hash and noise are the White Dragon\'s', () => {
  for (let i = 0; i + 2 < ints.length; i++) assert.equal(seed.hash(ints[i], ints[i + 1], ints[i + 2]), WD.hash(ints[i], ints[i + 1], ints[i + 2]));
  for (let i = 0; i + 1 < reals.length; i++) assert.equal(seed.hash(reals[i], reals[i + 1]), WD.hash(reals[i], reals[i + 1], 0));
  for (let i = 0; i + 2 < reals.length; i++) assert.equal(seed.noise(reals[i] / 7, reals[i + 1] / 7, ints[i]), WD.noise(reals[i] / 7, reals[i + 1] / 7, ints[i]));
});

test('hash2 and makeNoise are Merryfolk\'s', () => {
  for (let i = 0; i + 1 < 200; i++) assert.equal(seed.hash2(ints[i], ints[i + 1]), hash2(ints[i], ints[i + 1]));
  for (let i = 0; i + 1 < reals.length; i++) assert.equal(seed.hash2(reals[i], reals[i + 1]), hash2(reals[i], reals[i + 1]));
  const a = seed.makeNoise(99), b = makeNoise(99);
  for (let i = 0; i + 1 < reals.length; i++) assert.equal(a(reals[i] / 9, reals[i + 1] / 9), b(reals[i] / 9, reals[i + 1] / 9));
});

test('mulberry32, hashInts, hashString and Rng are Lodestar\'s; the White Dragon\'s Rng draws the same', () => {
  for (const s of [0, 1, 42, 0xdeadbeef, 4294967295]) {
    const a = seed.mulberry32(s), b = mulberry32(s);
    for (let i = 0; i < 300; i++) assert.equal(a(), b());
    const ra = new seed.Rng(s), rb = new LodeRng(s), rw = new WD.Rng(s), rt = new seed.Rng(s);
    for (let i = 0; i < 300; i++) {
      assert.equal(ra.f(), rb.f()); assert.equal(ra.i(-5, 9), rb.i(-5, 9)); assert.equal(ra.f(2, 7), rb.f(2, 7));
      assert.equal(ra.weighted([[1, 'a'], [2, 'b'], [0, 'c'], [3, 'd']]), rb.weighted([[1, 'a'], [2, 'b'], [0, 'c'], [3, 'd']]));
      assert.equal(ra.fork(), rb.fork()); assert.equal(ra.chance(0.3), rb.chance(0.3));
      assert.equal(rt.f(), rw.f()); assert.equal(rt.i(0, 10), rw.i(0, 10)); assert.equal(rt.pick(['x', 'y', 'z']), rw.pick(['x', 'y', 'z']));
    }
    assert.deepEqual(ra.shuffle([1, 2, 3, 4, 5, 6, 7]), rb.shuffle([1, 2, 3, 4, 5, 6, 7]));
  }
  for (let i = 0; i + 3 < ints.length; i++) assert.equal(seed.hashInts(ints[i], ints[i + 1], ints[i + 2]), hashInts(ints[i], ints[i + 1], ints[i + 2]));
  for (const s of ['', 'a', 'lodestar', 'Under the White Dragon', 'ünïcödé']) assert.equal(seed.hashString(s), hashString(s));
});

test('colors are the games\' own', () => {
  const hexes = ['#000000', '#ffffff', '#e0701e', '#24365a', '#7a6a48', '#4a9aff', '#c8a080'];
  for (const h of hexes) {
    assert.deepEqual(color.rgb(h), rgb(h)); assert.deepEqual(color.hexToRgb(h), hexToRgb(h));
    for (const t of [-0.8, -0.3, 0, 0.2, 0.7]) assert.equal(color.shade(h, t), shade(h, t));
    for (const h2 of hexes) assert.equal(color.mix(h, h2, 0.37), mix(h, h2, 0.37));
  }
  for (const a of [['#2a2420'], ['#24365a', '#4a9aff'], ['#3a2a1a', '#7a6a48', '#c8a080'], [[10, 20, 30], [200, 100, 50]]])
    for (const n of [3, 6, 9, 12]) assert.deepEqual(color.rampOf(a, n), rampOf(a, n));
  assert.deepEqual(color.rampOf(['#445566'], 7, 0.3, 0.5), rampOf(['#445566'], 7, 0.3, 0.5));
  assert.equal(color.css([12.7, 200.2, 99.9]), 'rgb(12,200,99)');
  assert.equal(color.tone([1, 2, 3, 4, 5], 0.5, 0.6), 4);
});

test('math', () => {
  assert.equal(math.clamp(5, 0, 3), 3); assert.equal(math.lerp(2, 4, 0.25), 2.5); assert.equal(math.approach(1, 5, 2), 3);
  assert.equal(math.unlerp(2, 4, 3), 0.5); assert.equal(math.wrap(-1, 5), 4); assert.equal(math.dist(0, 0, 3, 4), 5);
});

test('the stepper runs fixed steps and gives up rather than spiral', () => {
  const s = new loop.Stepper({ dt: 1 / 60, max: 4 }); let n = 0;
  assert.equal(s.advance(1 / 30 + 1e-9, () => n++), 2);
  assert.equal(s.advance(1, () => n++), 4); assert.equal(s.acc, 0);
  assert.equal(s.since(1000), 0); assert.equal(s.since(1016), 0.016); assert.equal(s.since(5000), 0.1);
  const g = []; const gov = new loop.Governor({ window: 1, below: 40, lower: () => { g.push(1); return true; } });
  for (let i = 0; i < 31; i++) gov.check(1 / 30); assert.equal(g.length, 1);
  for (let i = 0; i < 70; i++) gov.check(1 / 60); assert.equal(g.length, 1);
  const sm = new loop.Samples(5); for (const v of [5, 1, 4, 2, 3, 9]) sm.add(v); assert.deepEqual(sm.list, [1, 4, 2, 3, 9]); assert.equal(sm.pct(0.5), 3);
});

test('one version, and the plain scripts define their globals', async () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(Tycho.VERSION, pkg.version);
  const Tyrell = await import('../dist/tyrell.mjs');
  assert.equal(Tyrell.VERSION, pkg.version);
  const ctx = { console, performance, setTimeout };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../dist/tycho.js', import.meta.url), 'utf8'), ctx);
  vm.runInContext(readFileSync(new URL('../dist/tycho-minds.js', import.meta.url), 'utf8'), ctx);
  assert.equal(typeof ctx.Tycho.seed.hash, 'function');
  assert.equal(ctx.Tycho.minds.VERSION, pkg.version);
  assert.equal(ctx.TychoMinds.VERSION, pkg.version);
});
