// The pixels' parts that run without a browser (the sprite painter, the
// pixel buffer and its strokes, the chunks, the letter-grid scalers, the
// discs), against the games' own copies, which they replaced: for the same
// inputs they must give the same pixels, bit for bit, or a game would look
// different after the move. The games' versions are kept here as they were
// (the core functions they called are Tycho's, held to the originals by
// core.test.mjs). Pictures go through a stand-in canvas that keeps pixels
// and fills single pixels; test/browser.js compares the parts that need a
// real one (tinting, flipping, enlarging) in a page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Tycho from '../dist/tycho.mjs';

const { sprite, paint } = Tycho;
const { hash, noise, Rng } = Tycho.seed;
const { clamp, lerp } = Tycho.math;
const { rgb, mixRgb, tone, rampOf, hexToRgb } = Tycho.color;

// ---- a stand-in canvas: pixels, putImageData, getImageData, 1 px fills, drawImage at an offset
class FakeImageData {
  constructor(a, b, c) { if (typeof a === 'number') { this.width = a; this.height = b; this.data = new Uint8ClampedArray(a * b * 4); } else { this.data = a; this.width = b; this.height = c; } }
}
class FakeCtx {
  constructor(c, opts) { this.canvas = c; this.opts = opts; this.fillStyle = '#000000'; this.imageSmoothingEnabled = true; this.globalCompositeOperation = 'source-over'; }
  createImageData(w, h) { return new FakeImageData(w, h); }
  putImageData(img, x, y) { const c = this.canvas; for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) { const X = x + i, Y = y + j; if (X < 0 || Y < 0 || X >= c.width || Y >= c.height) continue; for (let k = 0; k < 4; k++) c.data[(Y * c.width + X) * 4 + k] = img.data[(j * img.width + i) * 4 + k]; } }
  getImageData(x, y, w, h) { const c = this.canvas, img = new FakeImageData(w, h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) for (let k = 0; k < 4; k++) img.data[(j * w + i) * 4 + k] = c.data[((y + j) * c.width + x + i) * 4 + k]; return img; }
  fillRect(x, y, w, h) { const c = this.canvas, [r, g, b] = hexToRgb(this.fillStyle); for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { if (i < 0 || j < 0 || i >= c.width || j >= c.height) continue; const o = (j * c.width + i) * 4; c.data[o] = r; c.data[o + 1] = g; c.data[o + 2] = b; c.data[o + 3] = 255; } }
  drawImage(src, dx, dy) { const c = this.canvas; for (let j = 0; j < src.height; j++) for (let i = 0; i < src.width; i++) { const X = dx + i, Y = dy + j, s = (j * src.width + i) * 4; if (X < 0 || Y < 0 || X >= c.width || Y >= c.height || !src.data[s + 3]) continue; for (let k = 0; k < 4; k++) c.data[(Y * c.width + X) * 4 + k] = src.data[s + k]; } }
}
class FakeCanvas {
  constructor() { this._w = 0; this._h = 0; this.data = new Uint8ClampedArray(0); this.ctx = null; }
  get width() { return this._w; } set width(v) { this._w = v >>> 0; this.data = new Uint8ClampedArray(this._w * this._h * 4); }
  get height() { return this._h; } set height(v) { this._h = v >>> 0; this.data = new Uint8ClampedArray(this._w * this._h * 4); }
  getContext(kind, opts) { if (!this.ctx) this.ctx = new FakeCtx(this, opts); return this.ctx; }
}
globalThis.document = { createElement: () => new FakeCanvas() };
globalThis.ImageData = FakeImageData;
const pic = (c) => (c ? c.width + 'x' + c.height + ':' + Buffer.from(c.data).toString('base64') : '-');

// ---- the White Dragon's originals (js/util.js, js/spr.js, js/paint.js) -------
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
function strokeRow(mid, jit, x0, n, y, seed) {
  const C = 8, ph = Math.floor(hash(y, 7, seed) * C);
  let c = Math.floor((x0 + ph) / C), cs = c * C - ph, i = 0;
  while (i < n) {
    const h = hash(c, y, seed + 1), h2 = hash(c, y, seed + 2), h3 = hash(c, y, seed + 3);
    let a = C, b = C;
    if (h > 0.3) { if (h < 0.7) a = 2 + ((h2 * (C - 3)) | 0); else { a = 2 + ((h2 * 3) | 0); b = Math.min(C - 2, a + 2 + ((h3 * 3) | 0)); } }
    const ja = h2 + h3 - 1, jb = hash(c, y, seed + 4) + h3 - 1, jc = hash(c, y, seed + 5) + h - 1;
    const ma = cs + ((a - 1) >> 1), mb = cs + ((a + b - 1) >> 1), mc = cs + ((b + C - 1) >> 1);
    for (let k = 0; k < C; k++) {
      if (cs + k < x0) continue;
      if (i >= n) break;
      if (k < a) { mid[i] = ma - x0; jit[i] = ja; } else if (k < b) { mid[i] = mb - x0; jit[i] = jb; } else { mid[i] = mc - x0; jit[i] = jc; }
      i++;
    }
    c++; cs += C;
  }
}
class Spr {
  constructor(w, h, seed = 1) { this.w = w; this.h = h; this.c = new Array(w * h).fill(null); this.g = new Uint8Array(w * h); this.p = new Uint8Array(w * h); this.seed = seed; this.n = 0; this.ax = w / 2; this.ay = h; this.flat = true; this.line = true; this.pid = 0; this.soft = new Set(); }
  static figure(w, h, seed) { const S = new Spr(w, h, seed); S.flat = S.line = true; return S; }
  static soft(w, h, seed) { const S = new Spr(w, h, seed); S.flat = S.line = false; return S; }
  part(cast = true) { this.pid = Math.min(255, this.pid + 1); if (!cast) this.soft.add(this.pid); }
  rnd() { return hash(this.n++, 17, this.seed); }
  band(s, lo, hi) { return lo + Math.round((hi - lo) * (s < 0.32 ? 0.18 : s < 0.7 ? 0.5 : 0.82)); }
  px(x, y, col, glow) { x = Math.round(x); y = Math.round(y); if (!col || x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = y * this.w + x; this.c[i] = typeof col === 'string' ? rgb(col) : col; this.g[i] = glow ? 1 : 0; this.p[i] = this.pid; }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.c[y * this.w + x]; }
  ell(cx, cy, rx, ry, ramp, o = {}) {
    const R = ramp.map((c) => (typeof c === 'string' ? rgb(c) : c)), lo = o.lo || 0, hi = o.hi === undefined ? R.length - 1 : o.hi;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      let run = 0, rt = 0;
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = u * u + v * v;
        if (d > 1 || (o.mask && !o.mask(x, y))) continue;
        const nz = Math.sqrt(Math.max(0, 1 - d)), s = (u * -0.55 + v * -0.8) * 0.8 + nz * 0.5 - 0.15 + (o.bias || 0);
        if (this.flat) { this.px(x, y, R[this.band(s, lo, hi)], o.glow); continue; }
        if (run <= 0) { rt = (this.rnd() + this.rnd() - 1) * 0.42; run = 2 + ((this.rnd() * 3) | 0); }
        run--;
        this.px(x, y, R[clamp(Math.round(lo + (hi - lo) * clamp(s, 0, 1) + rt), lo, hi)], o.glow);
      }
    }
  }
  box(x0, y0, x1, y1, ramp, o = {}) {
    if (this.flat) {
      const R = ramp.map((c) => (typeof c === 'string' ? rgb(c) : c)), lo = o.lo || 0, hi = o.hi === undefined ? R.length - 1 : o.hi;
      for (let y = Math.round(y0); y <= Math.round(y1); y++) for (let x = Math.round(x0); x <= Math.round(x1); x++) {
        const s = y === Math.round(y0) || (x === Math.round(x0) && y1 - y0 > 1) ? 0.9 : y === Math.round(y1) || (x === Math.round(x1) && y1 - y0 > 1) ? 0.1 : 0.5 + (o.bias || 0);
        this.px(x, y, R[this.band(s, lo, hi)], o.glow);
      }
      return;
    }
    this.ell((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + 0.7, (y1 - y0) / 2 + 0.7, ramp, Object.assign({}, o, { mask: (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1 }));
    const R = ramp.map((c) => (typeof c === 'string' ? rgb(c) : c));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!this.get(x, y) || (this.flat && this.p[y * this.w + x] !== this.pid)) this.px(x, y, R[(o.lo || 0) + 1] || R[0], o.glow);
  }
  limb(ax, ay, bx, by, w, ramp, o = {}) {
    const R = ramp.map((c) => (typeof c === 'string' ? rgb(c) : c)), L = Math.hypot(bx - ax, by - ay) || 1, n = Math.ceil(L * 3), nx = -(by - ay) / L, ny = (bx - ax) / L;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      for (let s = -w / 2; s <= w / 2; s += 0.5) { const lit = nx * s * -0.55 + ny * s * -0.8; if (this.flat) { this.px(x + nx * s, y + ny * s, R[this.band(0.5 + lit * 0.7 / Math.max(0.5, w / 2), 0, R.length - 1)], o.glow); continue; } this.px(x + nx * s, y + ny * s, R[clamp(Math.round((R.length - 1) * (0.5 + lit * 0.5 / Math.max(0.5, w / 2))), 0, R.length - 1)], o.glow); }
    }
  }
  cap(ax, ay, bx, by, ra, rb, ramp, o = {}) {
    const R = ramp.map((c) => (typeof c === 'string' ? rgb(c) : c)), lo = o.lo || 0, hi = o.hi === undefined ? R.length - 1 : o.hi;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, m = Math.max(ra, rb) + 1;
    for (let y = Math.floor(Math.min(ay, by) - m); y <= Math.ceil(Math.max(ay, by) + m); y++) {
      let run = 0, rt = 0;
      for (let x = Math.floor(Math.min(ax, bx) - m); x <= Math.ceil(Math.max(ax, bx) + m); x++) {
        const px = x + 0.5, py = y + 0.5, t = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1), qx = ax + dx * t, qy = ay + dy * t, r = ra + (rb - ra) * t;
        const ux = (px - qx) / r, uy = (py - qy) / r, d = ux * ux + uy * uy;
        if (d > 1 || (o.mask && !o.mask(x, y))) continue;
        const nz = Math.sqrt(Math.max(0, 1 - d)), sh = (ux * -0.6 + uy * -0.75) * 0.75 + nz * 0.45 - 0.1 + (o.bias || 0);
        if (this.flat) { this.px(x, y, R[this.band(sh, lo, hi)], o.glow); continue; }
        if (run <= 0) { rt = (this.rnd() + this.rnd() - 1) * 0.35; run = 2 + ((this.rnd() * 2) | 0); }
        run--;
        this.px(x, y, R[clamp(Math.round(lo + (hi - lo) * clamp(sh, 0, 1) + rt), lo, hi)], o.glow);
      }
    }
  }
  shape(pts, ramp, o = {}) {
    const R = ramp.map((c) => (typeof c === 'string' ? rgb(c) : c)), n1 = R.length - 1;
    let y0 = Infinity, y1 = -Infinity; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= yc && yc < b[1]) || (b[1] <= yc && yc < a[1])) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0])); }
      xs.sort((p, q) => p - q);
      let run = 0, rt = 0;
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) {
        const u = (x + 0.5 - xs[i]) / Math.max(1, xs[i + 1] - xs[i]), v = (yc - y0) / Math.max(1, y1 - y0);
        let sh = 0.78 - u * 0.62 - v * (o.down === undefined ? 0.18 : o.down) + (u < 0.18 ? 0.12 : 0) + (yc - y0 < 1.2 ? 0.15 : 0) + (o.bias || 0);
        if (this.flat) { const L = xs[i + 1] - xs[i], fx = x + 0.5 - xs[i]; this.px(x, y, R[this.band(fx < Math.min(1.6, L * 0.25) || yc - y0 < 1 ? 0.9 : xs[i + 1] - x - 0.5 < Math.min(1.6, L * 0.3) ? 0.1 : 0.5 - (o.down || 0) * 0.3 * v, 0, n1)], o.glow); continue; }
        if (o.folds) sh += Math.sin(x * 1.7 + y * 0.2) * 0.06;
        if (run <= 0) { rt = (this.rnd() + this.rnd() - 1) * 0.35; run = 2 + ((this.rnd() * 2) | 0); }
        run--;
        this.px(x, y, R[clamp(Math.round(n1 * clamp(sh, 0, 1) + rt), 0, n1)], o.glow);
      }
    }
  }
  poly(pts, col) {
    let y0 = Infinity, y1 = -Infinity; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= yc && yc < b[1]) || (b[1] <= yc && yc < a[1])) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0])); }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) this.px(x, y, typeof col === 'function' ? col(x, y) : col);
    }
  }
  finish() {
    const w = this.w, h = this.h, C = this.c, dk = [8, 6, 12], N = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const shade = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!C[i] || this.g[i]) continue;
      for (const [dx, dy] of N) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (C[j] && this.p[j] > this.p[i] && !this.g[j] && !this.soft.has(this.p[j])) { shade.push(i); break; } }
    }
    for (const i of shade) this.c[i] = mixRgb(this.c[i], dk, 0.45);
    const out = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (C[i]) continue; let best = null, lit = 0;
      for (const [dx, dy] of N) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (!C[j]) continue; if (this.g[j]) { lit++; continue; } const L = C[j][0] + C[j][1] + C[j][2]; if (!best || L < best[1]) best = [C[j], L]; }
      if (best) out.push([i, mixRgb(best[0], dk, 0.72)]);
    }
    for (const [i, col] of out) { this.c[i] = col; this.g[i] = 0; }
  }
  done() {
    if (this.line) this.finish();
    const [c, g] = canvasOf(this.w, this.h), img = g.createImageData(this.w, this.h);
    let glow = false; const eimg = this.g.some((q) => q) ? new ImageData(this.w, this.h) : null;
    for (let i = 0; i < this.c.length; i++) {
      const col = this.c[i]; if (!col) continue;
      img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255;
      if (this.g[i] && eimg) { glow = true; eimg.data[i * 4] = col[0]; eimg.data[i * 4 + 1] = col[1]; eimg.data[i * 4 + 2] = col[2]; eimg.data[i * 4 + 3] = 255; }
    }
    g.putImageData(img, 0, 0); let ec = null; if (glow) { const [c2, eg] = canvasOf(this.w, this.h); eg.putImageData(eimg, 0, 0); ec = c2; }
    return { c, e: ec, w: this.w, h: this.h, ax: this.ax, ay: this.ay };
  }
}
let PAINT_FLAT = true;
class Pix {
  constructor(w, h, ox = 0, oy = 0) {
    this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.n = 1; this.glowed = false;
    this.c = new Uint8ClampedArray(w * h * 4); this.g = new Uint8ClampedArray(w * h * 4);
    this.mid = new Int16Array(w + 16); this.jit = new Float32Array(w + 16);
  }
  put(x, y, col, glow = 0) {
    x = Math.floor(x) - this.ox; y = Math.floor(y) - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !col) return;
    const o = (y * this.w + x) * 4; this.c[o] = col[0]; this.c[o + 1] = col[1]; this.c[o + 2] = col[2]; this.c[o + 3] = 255;
    if (glow) { this.g[o] = col[0] * glow; this.g[o + 1] = col[1] * glow; this.g[o + 2] = col[2] * glow; this.g[o + 3] = 255; this.glowed = true; }
    else this.g[o] = this.g[o + 1] = this.g[o + 2] = this.g[o + 3] = 0;
  }
  tint(x, y, col, k) { x = Math.floor(x) - this.ox; y = Math.floor(y) - this.oy; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const o = (y * this.w + x) * 4; if (!this.c[o + 3]) return; this.c[o] = lerp(this.c[o], col[0], k); this.c[o + 1] = lerp(this.c[o + 1], col[1], k); this.c[o + 2] = lerp(this.c[o + 2], col[2], k); }
  area(ax0, ay0, ax1, ay1, ramp, v, o = {}) {
    const seed = o.seed === undefined ? this.n * 13 + 5 : o.seed; this.n++;
    ax0 = Math.floor(ax0); ay0 = Math.floor(ay0); ax1 = Math.ceil(ax1); ay1 = Math.ceil(ay1);
    const x0 = Math.max(this.ox, ax0), y0 = Math.max(this.oy, ay0), x1 = Math.min(this.ox + this.w - 1, ax1), y1 = Math.min(this.oy + this.h - 1, ay1);
    if (x1 < x0 || y1 < y0) return;
    const inside = o.inside || null, J = PAINT_FLAT ? 0 : o.jit === undefined ? 0.45 : o.jit, n = x1 - x0 + 1, glow = o.glow || 0, fog = o.fog || 0, fogc = o.fogc || [20, 16, 30];
    for (let y = y0; y <= y1; y++) {
      strokeRow(this.mid, this.jit, x0, n, y, seed);
      for (let i = 0; i < n; i++) {
        const x = x0 + i; if (inside && !inside(x, y)) continue;
        const m = x0 + this.mid[i], vx = v(x, y), vm = PAINT_FLAT ? vx : m >= ax0 && m <= ax1 && (!inside || inside(m, y)) ? v(m, y) : vx;
        let c = tone(ramp, clamp(vm * 0.6 + vx * 0.4, 0, 1), this.jit[i] * J);
        if (fog) c = mixRgb(c, fogc, fog);
        this.put(x, y, c, glow);
      }
    }
  }
  block(x0, y0, x1, y1, ramp, o = {}) { this.area(x0, y0, x1, y1, ramp, blockV(x0, y0, x1, y1, o), o); }
  sees(x0, y0, x1, y1) { return x1 >= this.ox && y1 >= this.oy && x0 < this.ox + this.w && y0 < this.oy + this.h; }
  canvases() {
    const [c, g] = canvasOf(this.w, this.h); g.putImageData(new ImageData(this.c, this.w, this.h), 0, 0);
    let e = null; if (this.glowed) { const [ec, eg] = canvasOf(this.w, this.h); eg.putImageData(new ImageData(this.g, this.w, this.h), 0, 0); e = ec; }
    return { c, e };
  }
}
function blockV(x0, y0, x1, y1, o = {}) {
  const base = o.base === undefined ? 0.5 : o.base, s = o.seed || 3, grain = o.grain === undefined ? 0.06 : o.grain, lip = o.lip === undefined ? 1 : o.lip;
  if (PAINT_FLAT) return (x, y) => {
    let v = base;
    const top = y - y0, bot = y1 - y, l = x - x0, r = x1 - x;
    if (lip && top < 1) v = 0.9; if (bot < 1) v -= 0.3; if (l < 1) v += 0.1; if (r < 1) v -= 0.12;
    if (o.drips) { const d = hash(x, 0, s + 5); if (d > 1 - o.drips && top < 3 + (d - 1 + o.drips) / o.drips * (o.dripLen || 40)) v -= 0.12; }
    if (o.bands) { if ((y - y0) % o.bands === 0) v -= 0.16; }
    if (o.panels) { const px = (x - x0) % o.panels[0], py = (y - y0) % o.panels[1]; if (px === 0 || py === 0) v -= 0.16; }
    return v;
  };
  return (x, y) => {
    let v = base + (noise(x / 40, y / 16, s) - 0.5) * 0.14 + (noise(x / 4, y / 30, s + 1) - 0.5) * grain;
    const top = y - y0, bot = y1 - y, l = x - x0, r = x1 - x;
    if (lip) { if (top < 1) v = 0.98; else if (top < 2) v = Math.max(v, 0.8); else if (top < 4) v += 0.1 * lip; }
    if (bot < 1) v -= 0.36; else if (bot < 3) v -= 0.16;
    if (l < 2) v += 0.12; if (r < 2) v -= 0.14;
    if (o.inward) v -= Math.min(o.inward, Math.min(top, bot, l, r) * 0.006);
    if (o.drips) { const d = hash(x, 0, s + 5); if (d > 1 - o.drips && top < 3 + (d - 1 + o.drips) / o.drips * (o.dripLen || 40)) v -= 0.14; }
    if (o.bands) { if ((y - y0) % o.bands === 0) v -= 0.18; else if ((y - y0) % o.bands === 1) v += 0.08; }
    if (o.panels) { const px = (x - x0) % o.panels[0], py = (y - y0) % o.panels[1]; if (px === 0 || py === 0) v -= 0.2; else if (px === 1 || py === 1) v += 0.07; }
    return v;
  };
}
const T = { chunk: 64 };
const Paint = {
  chunks: new Map(), level: null, queue: [],
  reset(level) { this.chunks.clear(); this.level = level; },
  key: (cx, cy) => cx + ',' + cy,
  has(cx, cy) { return this.chunks.has(this.key(cx, cy)); },
  get(cx, cy) { const k = this.key(cx, cy); let c = this.chunks.get(k); if (!c) { c = paintChunk(this.level, cx, cy); this.chunks.set(k, c); } return c; },
  ahead(x, y) {
    const CS = T.chunk, L = this.level, cx0 = Math.floor(x / CS), cy0 = Math.floor(y / CS);
    let best = null, bd = 1e9;
    for (let cy = cy0 - 2; cy <= cy0 + 2; cy++) for (let cx = cx0 - 3; cx <= cx0 + 3; cx++) {
      if (cx < 0 || cy < 0 || cx * CS >= L.w || cy * CS >= L.h || this.has(cx, cy)) continue;
      const d = Math.abs(cx - cx0) + Math.abs(cy - cy0); if (d < bd) { bd = d; best = [cx, cy]; }
    }
    if (best) this.get(best[0], best[1]);
    return !!best;
  },
};
function paintChunk(L, cx, cy) {
  const CS = T.chunk, P = new Pix(CS, CS, cx * CS, cy * CS);
  for (const op of L.ops) if (P.sees(op.x0, op.y0, op.x1, op.y1)) { P.n = op.seed; op.fn(P); }
  const { c, e } = P.canvases();
  return { c, e, x: cx * CS, y: cy * CS };
}

// ---- Lodestar's originals (js/util.js, js/art.js) --------------------------
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = false; return [c, x]; }
function spriteFrom(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const [c, x] = makeCanvas(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (ch === '.' || ch === ' ' || !pal[ch]) continue; x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1); }
  return c;
}
function outlined(src, ink = '#000000') {
  const w = src.width + 2, h = src.height + 2;
  const [c, x] = makeCanvas(w, h);
  x.drawImage(src, 1, 1);
  const img = x.getImageData(0, 0, w, h), d = img.data;
  const solid = (i, j) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 100;
  const mark = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!solid(i, j) && (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1))) mark.push(j * w + i);
  const [r, g, b] = hexToRgb(ink);
  for (const k of mark) { d[k * 4] = r; d[k * 4 + 1] = g; d[k * 4 + 2] = b; d[k * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  return c;
}
function scale3xRows(rows, fixed) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= w ? '.' : rows[y][x] || '.');
  const out = Array.from({ length: h * 3 }, () => new Array(w * 3).fill('.'));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const A = at(x - 1, y - 1), B = at(x, y - 1), C = at(x + 1, y - 1), D = at(x - 1, y), E = at(x, y), F = at(x + 1, y), G = at(x - 1, y + 1), H = at(x, y + 1), I = at(x + 1, y + 1);
      const o = fixed && fixed.has(E) ? (i, j) => { out[3 * y + j][3 * x + i] = E; } : fixed ? (i, j, v) => { out[3 * y + j][3 * x + i] = fixed.has(v) ? E : v; } : (i, j, v) => { out[3 * y + j][3 * x + i] = v; };
      if (B !== H && D !== F) {
        o(0, 0, D === B ? D : E); o(1, 0, (D === B && E !== C) || (B === F && E !== A) ? B : E); o(2, 0, B === F ? F : E);
        o(0, 1, (D === B && E !== G) || (D === H && E !== A) ? D : E); o(1, 1, E); o(2, 1, (B === F && E !== I) || (H === F && E !== C) ? F : E);
        o(0, 2, D === H ? D : E); o(1, 2, (D === H && E !== I) || (H === F && E !== G) ? H : E); o(2, 2, H === F ? F : E);
      } else for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) o(i, j, E);
    }
  return out.map((r) => r.join(''));
}
function scale15Rows(rows, fixed) { return scale3xRows(rows, fixed).filter((_, y) => y % 2 === 0).map((r) => [...r].filter((_, x) => x % 2 === 0).join('')); }
function artScaleRows(rows, k, fixed) {
  const whole = (v) => Math.abs(v - Math.round(v)) < 1e-6;
  if (Math.abs(k - 1) < 1e-6) return rows;
  if (whole(k / 3)) return artScaleRows(scale3xRows(rows, fixed), k / 3, fixed);
  if (whole(k / 2)) return artScaleRows(scale2xRows(rows), k / 2, fixed);
  if (Math.abs(k - 1.5) < 1e-6) return scale15Rows(rows, fixed);
  if (whole(k / 1.5)) return scale15Rows(artScaleRows(rows, k / 1.5, fixed), fixed);
  const h = rows.length, w = Math.max(...rows.map((r) => r.length)), W = Math.round(w * k), H = Math.round(h * k);
  return Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => rows[Math.floor(y / k)][Math.floor(x / k)] || '.').join(''));
}
function scale2xRows(rows) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= w ? '.' : rows[y][x] || '.');
  const out = Array.from({ length: h * 2 }, () => new Array(w * 2).fill('.'));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      out[2 * y][2 * x] = C === A && C !== D && A !== B ? A : P;
      out[2 * y][2 * x + 1] = A === B && A !== C && B !== D ? B : P;
      out[2 * y + 1][2 * x] = D === C && D !== B && C !== A ? C : P;
      out[2 * y + 1][2 * x + 1] = B === D && B !== A && D !== C ? D : P;
    }
  return out.map((r) => r.join(''));
}

// ---- Merryfolk's originals (js/util.js) --------------------------------------
function mfMakeCanvas(w, h, draw = false) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', draw ? undefined : { willReadFrequently: true }); x.imageSmoothingEnabled = false; return [c, x]; }
function disc(ctx, cx, cy, r, col) { ctx.fillStyle = col; for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r + r * 0.6 - y * y)); if (w >= 0) ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); } }
function ellipseFill(ctx, cx, cy, rx, ry, col) { ctx.fillStyle = col; for (let y = -ry; y <= ry; y++) { const t = 1 - (y * y) / (ry * ry + 0.5); if (t < 0) continue; const w = Math.round(rx * Math.sqrt(t)); ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); } }
const OUTLINE_DARK = 0.42;
function outlineCanvas(c, col = '#2a1c12', alpha = 255) {
  {
    const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
    let edge = false;
    for (let x = 0; x < w && !edge; x++) edge = d[x * 4 + 3] > 100 || d[((h - 1) * w + x) * 4 + 3] > 100;
    for (let y = 0; y < h && !edge; y++) edge = d[y * w * 4 + 3] > 100 || d[(y * w + w - 1) * 4 + 3] > 100;
    if (edge) { const [p, px] = mfMakeCanvas(w + 2, h + 2); px.drawImage(c, 1, 1); c = p; }
  }
  const ctx = c.getContext('2d');
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data, w = c.width, h = c.height;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 100;
  const mark = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 100) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [i, j] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) if (solid(i, j)) { const k = (j * w + i) * 4; r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; }
      if (n) mark.push(y * w + x, r / n, g / n, b / n);
    }
  for (let m = 0; m < mark.length; m += 4) { const i = mark[m] * 4; d[i] = mark[m + 1] * OUTLINE_DARK; d[i + 1] = mark[m + 2] * OUTLINE_DARK; d[i + 2] = mark[m + 3] * OUTLINE_DARK; d[i + 3] = alpha; }
  ctx.putImageData(img, 0, 0);
  return c; // (Merryfolk then copies it for the GPU: gpuCopy)
}
function mfSpriteFrom(rows, pal) {
  const h = rows.length, w = rows[0].length;
  const [c, x] = mfMakeCanvas(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ch = rows[j][i]; if (ch === '.' || ch === ' ' || !pal[ch]) continue; x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1); }
  return c;
}

// ---- inputs -------------------------------------------------------------------
const HEX = ['#e8b48a', '#3a3a48', '#2a2a34', '#18161c', '#ff4a3a', '#a0f0ff', '#90a4b4', '#5a6270'];
const ramps = (r) => {
  const n = r.i(2, 9);
  if (r.chance(0.3)) return Array.from({ length: n }, () => r.pick(HEX));
  return rampOf([r.pick(HEX), r.pick(HEX)], n, r.f(0.3, 0.6), r.f(0.1, 0.4)).map((c) => (r.chance(0.5) ? c : c.map((v) => Math.round(v))));
};
const shapeOpts = (r) => {
  const o = {};
  if (r.chance(0.3)) o.lo = r.i(0, 2);
  if (r.chance(0.3)) o.hi = r.i(2, 6);
  if (r.chance(0.3)) o.bias = r.f(-0.3, 0.3);
  if (r.chance(0.2)) o.glow = true;
  if (r.chance(0.15)) { const mx = r.i(0, 30); o.mask = (x, y) => (x + y) % 3 !== 0 && x < mx + 10; }
  if (r.chance(0.3)) o.down = r.f(0, 0.4);
  if (r.chance(0.3)) o.folds = true;
  return o;
};
// a random sprite, drawn the same way on both painters
function drawRandom(r, S) {
  const W = S.w, H = S.h, n = r.i(3, 22);
  for (let k = 0; k < n; k++) {
    const what = r.i(0, 7), ramp = ramps(r), o = shapeOpts(r), x = () => r.f(-3, W + 3), y = () => r.f(-3, H + 3);
    if (what === 0) S.ell(x(), y(), r.f(0.5, 9), r.f(0.5, 9), ramp, o);
    else if (what === 1) { const x0 = x(), y0 = y(); S.box(x0, y0, x0 + r.f(0, 12), y0 + r.f(0, 12), ramp, o); }
    else if (what === 2) { const x0 = Math.round(x()), y0 = Math.round(y()); S.box(x0, y0, x0 + r.i(0, 12), y0 + r.i(0, 12), ramp, o); }
    else if (what === 3) S.limb(x(), y(), x(), y(), r.f(0.3, 4), ramp, o);
    else if (what === 4) S.cap(x(), y(), x(), y(), r.f(0.6, 4), r.f(0.6, 4), ramp, o);
    else if (what === 5) S.shape(Array.from({ length: r.i(3, 8) }, () => [x(), y()]), ramp, o);
    else if (what === 6) { const c = r.pick(HEX); S.poly(Array.from({ length: r.i(3, 6) }, () => [x(), y()]), r.chance(0.5) ? c : (px, py) => ((px * py) % 4 ? rgb(c) : null)); }
    else for (let j = 0; j < 6; j++) S.px(x(), y(), r.chance(0.5) ? r.pick(HEX) : rgb(r.pick(HEX)), r.chance(0.3));
    if (r.chance(0.4)) S.part(r.chance(0.7));
  }
}
const sprState = (S) => JSON.stringify([S.c, Array.from(S.g), Array.from(S.p), S.n, S.pid, [...S.soft]]);
const sprPic = (s) => pic(s.c) + '|' + pic(s.e) + '|' + [s.w, s.h, s.ax, s.ay].join(',');

test('the shape painter is the White Dragon\'s Spr', () => {
  for (let k = 0; k < 400; k++) {
    const r1 = new Rng(1000 + k), r2 = new Rng(1000 + k), w = r1.i(4, 48), h = r1.i(4, 56), seed = r1.i(1, 999);
    r2.i(4, 48); r2.i(4, 56); r2.i(1, 999);
    const how = k % 3, A = how === 0 ? new Spr(w, h, seed) : how === 1 ? Spr.figure(w, h, seed) : Spr.soft(w, h, seed);
    const B = how === 0 ? new sprite.Shapes(w, h, seed) : how === 1 ? sprite.Shapes.figure(w, h, seed) : sprite.Shapes.soft(w, h, seed);
    if (k % 7 === 0) { A.ax = B.ax = 3; A.ay = B.ay = h - 2; }
    drawRandom(r1, A); drawRandom(r2, B);
    assert.equal(sprState(B), sprState(A), `sprite ${k} as drawn`);
    if (k % 2) { A.finish(); B.finish(); assert.equal(sprState(B), sprState(A), `sprite ${k} finished`); A.line = B.line = false; }
    assert.equal(sprPic(B.done()), sprPic(A.done()), `sprite ${k} done`);
  }
  // a figure's default seed, and a look of its own
  assert.equal(sprite.Shapes.figure(4, 4).seed, Spr.figure(4, 4).seed);
  const L = new sprite.Shapes(9, 9, 3, { ink: [0, 0, 0], edge: 1 }); L.box(3, 3, 5, 5, ['#ff0000', '#00ff00', '#0000ff']); L.finish();
  assert.deepEqual(L.get(2, 4), [0, 0, 0]);
  assert.equal(L.look.shadow, sprite.Shapes.LOOK.shadow);
});

// a random painting operation, drawn the same way on both buffers
function paintRandom(r, P, k) {
  const W = 200, H = 160, x = () => r.f(-20, W + 20), y = () => r.f(-20, H + 20), ramp = rampOf([r.pick(HEX), r.pick(HEX)], r.i(3, 12));
  const what = r.i(0, 4);
  if (what === 0) {
    const x0 = x(), y0 = y(), o = {}, a = r.f(10, 60), b = r.f(3, 30), s = r.i(0, 99);
    if (r.chance(0.3)) o.seed = r.i(0, 500);
    if (r.chance(0.3)) { const m = r.i(2, 5); o.inside = (px, py) => (px + py * 3) % m !== 0; }
    if (r.chance(0.3)) o.jit = r.f(0, 1);
    if (r.chance(0.3)) o.glow = r.f(0.1, 1);
    if (r.chance(0.2)) o.fog = r.f(0, 0.6);
    if (r.chance(0.2)) o.fogc = [r.i(0, 255), r.i(0, 255), r.i(0, 255)];
    P.area(x0, y0, x0 + r.f(0, 120), y0 + r.f(0, 90), ramp, (px, py) => 0.5 + Math.sin(px / a + s) * 0.4 + Math.cos(py / b) * 0.3 + noise(px / 9, py / 9, s) * 0.2 - 0.1, o);
  } else if (what === 1) {
    const x0 = Math.round(x()), y0 = Math.round(y()), o = {};
    if (r.chance(0.4)) o.base = r.f(0.1, 0.9);
    if (r.chance(0.3)) o.lip = r.chance(0.5) ? 0 : r.f(0.2, 1.5);
    if (r.chance(0.3)) o.grain = r.f(0, 0.3);
    if (r.chance(0.3)) o.inward = r.f(0, 0.3);
    if (r.chance(0.3)) o.drips = r.f(0.02, 0.4);
    if (r.chance(0.3)) o.dripLen = r.i(4, 60);
    if (r.chance(0.3)) o.bands = r.i(2, 9);
    if (r.chance(0.3)) o.panels = [r.i(2, 12), r.i(2, 12)];
    if (r.chance(0.3)) o.seed = r.i(0, 99);
    if (r.chance(0.2)) o.glow = r.f(0.1, 1);
    P.block(x0, y0, x0 + r.i(0, 120), y0 + r.i(0, 90), ramp, o);
  } else if (what === 2) { for (let j = 0; j < 30; j++) P.put(x(), y(), r.chance(0.9) ? ramp[r.i(0, ramp.length - 1)] : null, r.chance(0.3) ? r.f(0, 1) : 0); }
  else if (what === 3) { const c = [r.i(0, 255), r.i(0, 255), r.i(0, 255)], kk = r.f(0, 1); for (let j = 0; j < 400; j++) P.tint(x(), y(), c, kk); }
  else P.area(x(), y(), x(), y(), ramp, () => (k % 5) / 5);
}
const pixState = (P) => Buffer.from(P.c).toString('base64') + '|' + Buffer.from(P.g).toString('base64') + '|' + P.glowed + '|' + P.n;

test('the pixel buffer, its strokes and blocks are the White Dragon\'s, flat and stroked', () => {
  for (const flat of [true, false]) {
    PAINT_FLAT = flat;
    for (let k = 0; k < 160; k++) {
      const r1 = new Rng(77 + k), r2 = new Rng(77 + k), ox = (k % 4) * 37 - 20, oy = (k % 3) * 29 - 10;
      const A = new Pix(160, 120, ox, oy), B = new paint.Pix(160, 120, ox, oy, { flat });
      const n = 1 + (k % 9); A.n = B.n = n;
      for (let j = 0; j < 8; j++) { paintRandom(r1, A, k); paintRandom(r2, B, k); }
      assert.equal(pixState(B), pixState(A), `buffer ${k} (${flat ? 'flat' : 'strokes'})`);
      const ca = A.canvases(), cb = B.canvases();
      assert.equal(pic(cb.c) + pic(cb.e), pic(ca.c) + pic(ca.e));
      // and blockV alone
      const o = { base: 0.4, drips: 0.2, bands: 5, panels: [7, 5], seed: k, inward: 0.1 };
      const fa = blockV(3, 4, 90, 60, o), fb = paint.blockV(3, 4, 90, 60, o, flat);
      for (let y = 0; y < 64; y += 3) for (let x = 0; x < 94; x += 2) assert.equal(fb(x, y), fa(x, y));
    }
  }
  PAINT_FLAT = true;
  for (let k = 0; k < 300; k++) {
    const m1 = new Int16Array(300), j1 = new Float32Array(300), m2 = new Int16Array(300), j2 = new Float32Array(300), x0 = k * 7 - 900, n = 1 + ((k * 13) % 280);
    strokeRow(m1, j1, x0, n, k * 3 - 100, k * 31 + 7); paint.strokeRow(m2, j2, x0, n, k * 3 - 100, k * 31 + 7);
    assert.deepEqual(m2, m1); assert.deepEqual(j2, j1);
  }
});

test('chunks are painted as the White Dragon\'s, and painted ahead in its order', () => {
  // a small level of operations, each with its seed as the builder gives it
  const r = new Rng(5), L = { w: 300, h: 200, ops: [] };
  const add = (x0, y0, x1, y1, fn) => L.ops.push({ x0, y0, x1, y1, fn, seed: L.ops.length * 31 + 7 });
  for (let k = 0; k < 40; k++) {
    const x0 = r.i(-20, 300), y0 = r.i(-20, 200), x1 = x0 + r.i(0, 140), y1 = y0 + r.i(0, 90), ramp = rampOf([r.pick(HEX)], r.i(4, 10)), base = r.f(0.2, 0.8), drips = r.chance(0.5) ? 0.1 : 0;
    if (k % 3 === 0) add(x0, y0, x1, y1, (P) => P.block(x0, y0, x1, y1, ramp, { base, drips }));
    else if (k % 3 === 1) add(x0, y0, x1, y1, (P) => P.area(x0, y0, x1, y1, ramp, (x, y) => base + Math.sin(x / 11) * 0.2 + (y % 7) * 0.03, { glow: drips }));
    else add(x0, y0, x1, y1, (P) => { for (let x = x0; x < x1; x += 3) P.put(x, y0 + (x % 5), ramp[ramp.length - 1], 1); });
  }
  for (const flat of [true, false]) {
    PAINT_FLAT = flat;
    const P = new paint.Painter({ size: T.chunk, flat });
    Paint.reset(L); P.reset(L);
    for (let cy = 0; cy * T.chunk < L.h; cy++) for (let cx = 0; cx * T.chunk < L.w; cx++) {
      const a = Paint.get(cx, cy), b = P.get(cx, cy), c = paint.chunk(L.ops, cx, cy, T.chunk, { flat });
      assert.equal(pic(b.c) + pic(b.e) + b.x + ',' + b.y, pic(a.c) + pic(a.e) + a.x + ',' + a.y);
      assert.equal(pic(c.c) + pic(c.e), pic(a.c) + pic(a.e));
    }
    // ahead: the same chunks, in the same order, from the same places
    Paint.reset(L); P.reset(L);
    for (const [x, y] of [[10, 10], [10, 10], [250, 150], [-90, 40], [130, 400], [130, 90], [130, 90], [130, 90], [0, 0], [299, 199]]) {
      const a = Paint.ahead(x, y), b = P.ahead(x, y);
      assert.equal(!!b, a);
      assert.deepEqual([...P.map.keys()], [...Paint.chunks.keys()]);
    }
    // until every chunk is made
    while (Paint.ahead(150, 100)) assert.equal(P.ahead(150, 100), 1);
    assert.equal(P.ahead(150, 100), 0); assert.equal(P.count, Paint.chunks.size);
  }
  PAINT_FLAT = true;
});

test('a chunk cache paints ahead within a budget, and lets the longest unused go', () => {
  const made = [];
  const K = new paint.Chunks({ size: 10, w: 100, h: 50, make: (cx, cy) => { made.push(cx + ',' + cy); return { cx, cy }; } });
  assert.equal(K.ahead(0, 0), 1); assert.deepEqual(made, ['0,0']);
  assert.ok(K.ahead(0, 0, { budget: 50 }) > 1);
  assert.equal(K.peek(9, 9), undefined); assert.equal(K.has(9, 9), false);
  assert.deepEqual(K.over(-5, -5, 25, 5).map((c) => c.cx + ',' + c.cy), ['0,0', '1,0', '2,0']);
  const S = new paint.Chunks({ size: 10, w: 100, h: 100, max: 3, make: (cx, cy) => ({ cx, cy }) });
  S.get(0, 0); S.get(1, 0); S.get(2, 0); S.get(0, 0); S.get(3, 0);
  assert.deepEqual([...S.map.keys()].sort(), ['0,0', '2,0', '3,0']);
  S.trim(1); assert.deepEqual([...S.map.keys()], ['3,0']);
  S.reset({ w: 20, h: 20 }); assert.equal(S.count, 0); assert.equal(S.inside(2, 0), false); assert.equal(S.inside(1, 1), true);
});

test('letter grids are enlarged as Lodestar enlarges them', () => {
  const r = new Rng(9), L = '.abcE';
  const grids = [];
  for (let k = 0; k < 120; k++) { const h = r.i(1, 9), w = r.i(1, 9); grids.push(Array.from({ length: h }, () => Array.from({ length: r.chance(0.2) ? r.i(1, w) : w }, () => r.pick(L)).join(''))); }
  grids.push(['..aa..', '.abba.', 'abccba', '.abba.', '..aa..']);
  for (const rows of grids) {
    const fixed = r.chance(0.5) ? new Set(['E']) : null;
    assert.deepEqual(sprite.scale2xRows(rows), scale2xRows(rows));
    assert.deepEqual(sprite.scale3xRows(rows, fixed), scale3xRows(rows, fixed));
    assert.deepEqual(sprite.scale15Rows(rows, fixed), scale15Rows(rows, fixed));
    for (const k of [1, 1.5, 2, 3, 4, 4.5, 6, 2.25, 0.5, 5]) assert.deepEqual(sprite.scaleRows(rows, k, fixed), artScaleRows(rows, k, fixed));
  }
});

test('canvases, letter-row sprites, outlines and discs are the games\' own', () => {
  const pal = { a: '#ff0000', b: '#00ff80', c: '#123456', E: '#ffffff' };
  const r = new Rng(31);
  for (let k = 0; k < 80; k++) {
    const h = r.i(1, 10), w = r.i(1, 10), ragged = k % 3 === 0;
    const rows = Array.from({ length: h }, () => Array.from({ length: ragged ? r.i(0, w + 2) : w }, () => r.pick('..abcEx ')).join(''));
    // Lodestar's: as wide as the longest row, at least 1 px
    const a = spriteFrom(rows, pal), b = sprite.spriteFrom(rows, pal, { read: true, min: 1 });
    assert.equal(pic(b), pic(a));
    assert.equal(pic(sprite.outline(b)), pic(outlined(a)));
    assert.equal(pic(sprite.outline(b, { ink: '#3a2010' })), pic(outlined(a, '#3a2010')));
    // Merryfolk's: as wide as the first row, outlined in its own colors, growing only at need
    if (rows[0].length) {
      const m = mfSpriteFrom(rows, pal), t = sprite.spriteFrom(rows, pal, { read: true, w: rows[0].length });
      assert.equal(pic(t), pic(m));
      const mo = outlineCanvas(m, '#2a1c12', 200), to = sprite.outline(t, { own: 0.42, alpha: 200, grow: 'edge' });
      assert.equal(pic(to), pic(mo));
      assert.equal(to === t, mo === m);
    }
  }
  // the canvases: sizes as each game made them
  assert.deepEqual([sprite.canvas(0, 3, { min: 1 })[0].width, sprite.canvas(0, 3)[0].width, sprite.canvas(5, 0, { min: 1 })[0].height], [1, 0, 1]);
  assert.deepEqual(sprite.canvas(4, 4, { read: true })[1].opts, { willReadFrequently: true });
  assert.equal(sprite.canvas(4, 4)[1].opts, undefined);
  assert.equal(sprite.canvas(4, 4)[1].imageSmoothingEnabled, false);
  // discs and ellipses: the same rows
  const rec = () => { const calls = []; return { calls, set fillStyle(v) { calls.push(['style', v]); }, fillRect: (...a) => calls.push(a) }; };
  for (const [cx, cy, rr, ry] of [[5, 5, 0, 0], [10.4, 7.6, 3, 2], [0, 0, 7, 5], [-3, 2.5, 12, 1], [8, 8, 1, 9]]) {
    const A = rec(), B = rec(); disc(A, cx, cy, rr, '#abc'); sprite.disc(B, cx, cy, rr, '#abc'); assert.deepEqual(B.calls, A.calls);
    const C = rec(), D = rec(); ellipseFill(C, cx, cy, rr, ry, '#abc'); sprite.ellipse(D, cx, cy, rr, ry, '#abc'); assert.deepEqual(D.calls, C.calls);
  }
});

// ---- effects: the White Dragon's sparks (js/player.js Fx), its gains (js/hud.js) and puffs (js/life.js), Lodestar's cast effects (js/castfx.js)
const { fx } = Tycho;
function wdFx(frame) {
  const Game = { frame, particles: [] };
  const Fx = {
    sparks(x, y, n) { for (let k = 0; k < n; k++) { const h1 = hash(Game.frame, k, 1), h2 = hash(Game.frame, k, 2), h3 = hash(Game.frame, k, 3); Game.particles.push({ x, y, vx: (h1 - 0.5) * 160, vy: -40 - h2 * 110, t: 0.25 + h3 * 0.35, c: [255, 160 + h3 * 90, 60 + h3 * 120], g: 400 }); } this.cap(); },
    burst(x, y, c, n) { for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + hash(Game.frame, k, 4), s = 40 + hash(Game.frame, k, 5) * 70; Game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.3 + hash(Game.frame, k, 6) * 0.3, c, g: 0 }); } this.cap(); },
    cap() { if (Game.particles.length > 260) Game.particles.splice(0, Game.particles.length - 200); },
    step(dt) { for (const p of Game.particles) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; } Game.particles = Game.particles.filter((p) => p.t > 0); },
  };
  return { Game, Fx };
}
function lsParticles(P, dt) {
  let n = 0;
  for (let i = 0; i < P.length; i++) {
    const q = P[i];
    if ((q.t -= dt) <= 0) continue;
    if (q.drag) { const k = Math.exp(-q.drag * dt); q.vx *= k; q.vy *= k; }
    q.vy += q.g * dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.y > q.floor && q.vy > 0) { q.y = q.floor; q.vy *= -0.35; q.vx *= 0.6; }
    P[n++] = q;
  }
  P.length = n;
}
const lsTick = (list, dt) => { let m = 0; for (const o of list) if ((o.t -= dt) > 0) list[m++] = o; list.length = m; };

test('effects move and run out as the games\' own', () => {
  // the White Dragon's sparks and bursts, frame after frame
  for (const frame of [0, 1, 77, 3001]) {
    const { Game, Fx } = wdFx(frame), P = new fx.Particles(), draw = (k, s) => hash(frame, k, s);
    for (let j = 0; j < 30; j++) {
      Fx.sparks(10 + j, 20, 9); for (const p of fx.sparks(10 + j, 20, 9, draw)) P.add(p); P.cap();
      Fx.burst(5, 5 - j, [10, 200, 90], 12); for (const p of fx.burst(5, 5 - j, [10, 200, 90], 12, draw)) P.add(p); P.cap();
      for (let i = 0; i < 3; i++) { Fx.step(1 / 60); P.step(1 / 60); }
      assert.deepEqual(P.list, Game.particles);
    }
    for (let i = 0; i < 90; i++) { Fx.step(1 / 60); P.step(1 / 60); }
    assert.deepEqual(P.list, Game.particles); assert.equal(P.length, 0);
  }
  // Lodestar's cast particles: drag, gravity, bouncing off the floor
  const r = new Rng(3), A = [], B = [];
  for (let k = 0; k < 300; k++) { const q = { x: r.f(-50, 50), y: r.f(-50, 50), vx: r.f(-200, 200), vy: r.f(-300, 100), t: r.f(0, 2), g: r.pick([0, 200, 520]), floor: r.f(-10, 40) }; if (r.chance(0.5)) q.drag = r.f(0.5, 6); A.push(q); B.push(Object.assign({}, q)); }
  const P = new fx.Particles({ max: Infinity }); P.list = B;
  for (let i = 0; i < 150; i++) { lsParticles(A, 1 / 60); P.step(1 / 60); assert.deepEqual(B, A); }
  for (const q of B) fx.move(q, 0.1, { bounce: 0.5, slide: 1 });
  // Lodestar's lists that run out, and the White Dragon's puffs, which age to their life
  const T1 = Array.from({ length: 50 }, (_, i) => ({ t: (i % 7) * 0.1 + 0.01 })), T2 = T1.map((o) => Object.assign({}, o));
  for (let i = 0; i < 40; i++) { lsTick(T1, 1 / 60); assert.equal(fx.tick(T2, 1 / 60), T2); assert.deepEqual(T2, T1); }
  const U1 = Array.from({ length: 40 }, (_, i) => ({ t: 0, life: 0.3 + (i % 5) * 0.4 })), U2 = U1.map((o) => Object.assign({}, o));
  let U = U1;
  for (let i = 0; i < 200; i++) { for (const p of U) p.t += 1 / 60; U = U.filter((p) => p.t < p.life); fx.age(U2, 1 / 60); assert.deepEqual(U2, U); }
  const S1 = Array.from({ length: 20 }, (_, i) => ({ t: i * 0.01 })), S2 = S1.map((o) => Object.assign({}, o));
  let S = S1;
  for (let i = 0; i < 20; i++) { for (const s of S) s.t += 1 / 60; S = S.filter((s) => s.t < 0.18); fx.age(S2, 1 / 60, 0.18); assert.deepEqual(S2, S); }
  // the White Dragon's gains: where each line is and how faded, from the start of its rising
  for (let a = -0.5; a < 3; a += 0.037) for (const [i, of] of [[0, 1], [0, 3], [2, 3], [1, 2]]) {
    const base = 117.3, keep = a < 2.4, r2 = fx.rise(a, i, of);
    if (!keep || a < 0) { assert.equal(r2, null); continue; }
    const y = base - (of - 1 - i) * 21 - a * 12, o = a > 1.8 ? Math.max(0, 1 - (a - 1.8) / 0.6) : 1;
    assert.equal(base - r2.stack - r2.up, y); assert.equal(r2.alpha, o);
  }
});
