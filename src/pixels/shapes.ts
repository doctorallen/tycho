// A sprite painted from shapes (the White Dragon's Spr, which grew from
// Lodestar's painted sprites): ellipses, boxes, capsules, limbs and polygons
// in a game's materials (ramps of tones, dark to light), flat by default:
// three hard tones a material (shadow, base, light) and no noise, a box a
// flat panel (lit along its top and left edges, shaded along its bottom and
// right), a shadow line where a later part lies over an earlier one
// (`part()`), and a dark outline round the whole, so everything reads as
// drawn pixel art. `Shapes.soft` paints the older way instead, in short runs
// of close tones with no outline.
//
// The light comes from the upper left. What's a game's own is passed in:
// the ramps with every shape, and the look of the finish (the ink the
// outline and shadow lines go toward, and how far) as `look`; the defaults
// are the White Dragon's. Bit for bit the White Dragon's (test/pixels.test.mjs).
import { hash } from '../core/seed';
import { clamp } from '../core/math';
import { rgb, mixRgb, type RGB } from '../core/color';

/** A color: '#rrggbb' or [r, g, b]. */
export type Color = string | readonly number[];
/** A material: tones from dark to light. */
export type Ramp = readonly Color[];

/** What a shape takes besides its place and ramp. */
export interface ShapeOpts {
  /** The darkest and lightest tones of the ramp it uses (0 and the last). */
  lo?: number; hi?: number;
  /** Lighter (> 0) or darker overall. */
  bias?: number;
  /** It lights itself (it goes on the glow picture too). */
  glow?: boolean;
  /** Only where this says (x, y) is in. */
  mask?: (x: number, y: number) => boolean;
  /** A polygon's shading down it (0.18; flat, 0 unless given). */
  down?: number;
  /** A soft polygon's folds of cloth. */
  folds?: boolean;
}

/** A finished sprite: its picture, what glows of it (or null), its size and
 * its anchor (the feet: the bottom middle unless moved). */
export interface Sprite { c: HTMLCanvasElement; e: HTMLCanvasElement | null; w: number; h: number; ax: number; ay: number }

/** The finish's look. */
export interface ShapesLook {
  /** What outlines and shadow lines are mixed toward ([8, 6, 12], soot). */
  ink: readonly number[];
  /** How far a shadow line goes toward the ink (0.45). */
  shadow: number;
  /** How far the outline goes toward it from the darkest pixel it borders (0.72). */
  edge: number;
}

const toRgb = (c: Color): readonly number[] => (typeof c === 'string' ? rgb(c) : c);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class Shapes {
  /** The White Dragon's finish. */
  static LOOK: ShapesLook = { ink: [8, 6, 12], shadow: 0.45, edge: 0.72 };
  w: number; h: number; seed: number; n: number;
  /** Each pixel's color (null: clear), whether it glows, and its part. */
  c: (readonly number[] | null)[]; g: Uint8Array; p: Uint8Array;
  /** The anchor. */
  ax: number; ay: number;
  /** Flat tones (or soft runs), and an outline with shadow lines. */
  flat: boolean; line: boolean;
  /** The part being drawn, and the parts that cast no shadow line. */
  pid: number; soft: Set<number>;
  look: ShapesLook;
  constructor(w: number, h: number, seed = 1, look?: Partial<ShapesLook>) {
    this.w = w; this.h = h; this.c = new Array(w * h).fill(null); this.g = new Uint8Array(w * h); this.p = new Uint8Array(w * h);
    this.seed = seed; this.n = 0; this.ax = w / 2; this.ay = h; this.flat = true; this.line = true; this.pid = 0; this.soft = new Set();
    this.look = look ? Object.assign({}, Shapes.LOOK, look) : Shapes.LOOK;
  }
  /** A flat figure, outlined (the default). */
  static figure(w: number, h: number, seed?: number, look?: Partial<ShapesLook>): Shapes { const S = new this(w, h, seed, look); S.flat = S.line = true; return S; }
  /** Soft runs of close tones, no outline. */
  static soft(w: number, h: number, seed?: number, look?: Partial<ShapesLook>): Shapes { const S = new this(w, h, seed, look); S.flat = S.line = false; return S; }
  /** The next shapes are a new part, drawn over what came before; a part
   * that doesn't cast (hair on a face) leaves no shadow line on what's under it. */
  part(cast = true): void { this.pid = Math.min(255, this.pid + 1); if (!cast) this.soft.add(this.pid); }
  /** The sprite's own seeded stream (soft runs). */
  rnd(): number { return hash(this.n++, 17, this.seed); }
  /** A tone from a shading value, flat: shadow, base or light. */
  band(s: number, lo: number, hi: number): number { return lo + Math.round((hi - lo) * (s < 0.32 ? 0.18 : s < 0.7 ? 0.5 : 0.82)); }
  /** One pixel (rounded; off the sprite, or no color, it's nothing). */
  px(x: number, y: number, col: Color | null | undefined, glow?: boolean): void {
    x = Math.round(x); y = Math.round(y);
    if (!col || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x; this.c[i] = toRgb(col); this.g[i] = glow ? 1 : 0; this.p[i] = this.pid;
  }
  get(x: number, y: number): readonly number[] | null { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.c[y * this.w + x]; }
  /** A rounded volume: its tone from how it faces the upper left. */
  ell(cx: number, cy: number, rx: number, ry: number, ramp: Ramp, o: ShapeOpts = {}): void {
    const R = ramp.map(toRgb), lo = o.lo || 0, hi = o.hi === undefined ? R.length - 1 : o.hi;
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
  /** A box: flat, a panel lit along its top and left; soft, a rounded volume filled out to its corners. */
  box(x0: number, y0: number, x1: number, y1: number, ramp: Ramp, o: ShapeOpts = {}): void {
    if (this.flat) {
      const R = ramp.map(toRgb), lo = o.lo || 0, hi = o.hi === undefined ? R.length - 1 : o.hi;
      for (let y = Math.round(y0); y <= Math.round(y1); y++) for (let x = Math.round(x0); x <= Math.round(x1); x++) {
        const s = y === Math.round(y0) || (x === Math.round(x0) && y1 - y0 > 1) ? 0.9 : y === Math.round(y1) || (x === Math.round(x1) && y1 - y0 > 1) ? 0.1 : 0.5 + (o.bias || 0);
        this.px(x, y, R[this.band(s, lo, hi)], o.glow);
      }
      return;
    }
    this.ell((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + 0.7, (y1 - y0) / 2 + 0.7, ramp, Object.assign({}, o, { mask: (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1 }));
    const R = ramp.map(toRgb);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!this.get(x, y) || (this.flat && this.p[y * this.w + x] !== this.pid)) this.px(x, y, R[(o.lo || 0) + 1] || R[0], o.glow);
  }
  /** A limb from a to b, w wide: lit along its upper-left side. */
  limb(ax: number, ay: number, bx: number, by: number, w: number, ramp: Ramp, o: ShapeOpts = {}): void {
    const R = ramp.map(toRgb), L = Math.hypot(bx - ax, by - ay) || 1, n = Math.ceil(L * 3), nx = -(by - ay) / L, ny = (bx - ax) / L;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      for (let s = -w / 2; s <= w / 2; s += 0.5) {
        const lit = nx * s * -0.55 + ny * s * -0.8;
        if (this.flat) { this.px(x + nx * s, y + ny * s, R[this.band(0.5 + lit * 0.7 / Math.max(0.5, w / 2), 0, R.length - 1)], o.glow); continue; }
        this.px(x + nx * s, y + ny * s, R[clamp(Math.round((R.length - 1) * (0.5 + lit * 0.5 / Math.max(0.5, w / 2))), 0, R.length - 1)], o.glow);
      }
    }
  }
  /** A capsule from a (radius ra) to b (radius rb): a limb with volume, its
   * tone from how its surface faces the upper left. */
  cap(ax: number, ay: number, bx: number, by: number, ra: number, rb: number, ramp: Ramp, o: ShapeOpts = {}): void {
    const R = ramp.map(toRgb), lo = o.lo || 0, hi = o.hi === undefined ? R.length - 1 : o.hi;
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
  /** A shape from a polygon, shaded across each row (lit on its left, shaded
   * on its right) and down it, like cloth over a body. */
  shape(pts: readonly (readonly number[])[], ramp: Ramp, o: ShapeOpts = {}): void {
    const R = ramp.map(toRgb), n1 = R.length - 1;
    let y0 = Infinity, y1 = -Infinity; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs: number[] = [];
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
  /** A polygon in one color (or a color a pixel, from col(x, y)). */
  poly(pts: readonly (readonly number[])[], col: Color | ((x: number, y: number) => Color | null)): void {
    let y0 = Infinity, y1 = -Infinity; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs: number[] = [];
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= yc && yc < b[1]) || (b[1] <= yc && yc < a[1])) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0])); }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) this.px(x, y, typeof col === 'function' ? col(x, y) : col);
    }
  }
  /** A figure's finish: a shadow line on a part where a later part lies on
   * it, then a dark outline round the whole (not round glow alone). */
  finish(): void {
    const w = this.w, h = this.h, C = this.c, dk = this.look.ink;
    const shade: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!C[i] || this.g[i]) continue;
      for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (C[j] && this.p[j] > this.p[i] && !this.g[j] && !this.soft.has(this.p[j])) { shade.push(i); break; } }
    }
    for (const i of shade) this.c[i] = mixRgb(this.c[i] as readonly number[], dk, this.look.shadow);
    const out: [number, RGB][] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (C[i]) continue; let best: [readonly number[], number] | null = null;
      for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; const cj = C[j]; if (!cj) continue; if (this.g[j]) continue; const L = cj[0] + cj[1] + cj[2]; if (!best || L < best[1]) best = [cj, L]; }
      if (best) out.push([i, mixRgb(best[0], dk, this.look.edge)]);
    }
    for (const [i, col] of out) { this.c[i] = col; this.g[i] = 0; }
  }
  /** The sprite: outlined (if `line`), as a picture and, if anything glows,
   * a glow picture. */
  done(): Sprite {
    if (this.line) this.finish();
    const w = this.w, h = this.h, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d') as CanvasRenderingContext2D; g.imageSmoothingEnabled = false;
    const img = g.createImageData(w, h);
    // (a glow canvas only for a sprite with something that glows)
    let glow = false; const eimg = this.g.some((q) => q) ? new ImageData(w, h) : null;
    for (let i = 0; i < this.c.length; i++) {
      const col = this.c[i]; if (!col) continue;
      img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255;
      if (this.g[i] && eimg) { glow = true; eimg.data[i * 4] = col[0]; eimg.data[i * 4 + 1] = col[1]; eimg.data[i * 4 + 2] = col[2]; eimg.data[i * 4 + 3] = 255; }
    }
    g.putImageData(img, 0, 0);
    let ec: HTMLCanvasElement | null = null;
    if (glow && eimg) { ec = document.createElement('canvas'); ec.width = w; ec.height = h; const eg = ec.getContext('2d') as CanvasRenderingContext2D; eg.imageSmoothingEnabled = false; eg.putImageData(eimg, 0, 0); }
    return { c, e: ec, w, h, ax: this.ax, ay: this.ay };
  }
}
