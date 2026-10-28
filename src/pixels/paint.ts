// The painter: a world (a level, a far layer) painted from a list of
// operations, lazily, in chunks. Each operation has a box in world px, its
// own seed and a function that paints into a pixel buffer (Pix); a chunk runs
// only the operations whose box touches it, each starting from its own seed,
// so strokes meet across chunk edges without seams and anything painted
// twice matches itself. Chunks are kept in a cache (Chunks), made when first
// asked for and painted ahead of the camera when a frame has time to spare.
//
// Two styles, as an option on the buffer: flat (`flat: true`, the White
// Dragon's: each surface one tone from its value, a crisp lit top edge and a
// shaded bottom, panel lines and drips, no noise and no brushwork), or the
// strokes (an area laid in short horizontal strokes of close tones, each
// read at its middle with a little jitter, and blocks with beveled lips and
// grain). A game's own painters (railings, laundry, water...) are written on
// top, against Pix's put, tint, area and block.
//
// The White Dragon's, bit for bit (test/pixels.test.mjs holds Pix, strokeRow,
// blockV and the chunks to its originals, and its golden test pins every
// level it paints).
import { hash, noise } from '../core/seed';
import { clamp, lerp } from '../core/math';
import { mixRgb, tone } from '../core/color';
import { canvas } from './sprite';

// ---- strokes ---------------------------------------------------------------
/** One row of strokes. A row is cut into 8 px cells (each row set off by its
 * own phase), each cell into one to three strokes at hashed places; for each
 * of the n pixels from x0, `mid` gets its stroke's middle (as an offset from
 * x0: where its tone is read) and `jit` the stroke's jitter. It depends only
 * on the place and the seed. */
export function strokeRow(mid: Int16Array | number[], jit: Float32Array | number[], x0: number, n: number, y: number, seed: number): void {
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

// ---- the pixel buffer --------------------------------------------------------
/** How a buffer paints. */
export interface PixOpts {
  /** Flat (each surface one tone, crisp edges) rather than strokes. */
  flat?: boolean;
}

/** An area's options. */
export interface AreaOpts {
  /** The strokes' seed (from the operation's otherwise). */
  seed?: number;
  /** Only where this says (x, y) is in. */
  inside?: ((x: number, y: number) => boolean) | null;
  /** How far a stroke's tone jitters (0.45; none when flat). */
  jit?: number;
  /** It lights itself, this much (0..1). */
  glow?: number;
  /** Mixed toward a fog color ([20, 16, 30]) this much. */
  fog?: number; fogc?: readonly number[];
}

/** A block's options: its shading (see blockV), and an area's. */
export interface BlockOpts extends AreaOpts {
  /** Its value (0.5). */
  base?: number;
  /** The lit lip on top (1; 0 for none). */
  lip?: number;
  /** Fine grain (0.06, strokes only). */
  grain?: number;
  /** Darker toward its middle, at most this (strokes only). */
  inward?: number;
  /** The share of columns with grime running down from the top, and how far. */
  drips?: number; dripLen?: number;
  /** A dark line every this many rows. */
  bands?: number;
  /** Panel lines every [x, y] px. */
  panels?: readonly [number, number] | readonly number[];
}

/** A pixel buffer over a piece of the world: (ox, oy) is its top left, in
 * world px. A color picture and a glow picture, RGBA. */
export class Pix {
  w: number; h: number; ox: number; oy: number;
  /** The seed the next area takes when it's given none (an operation sets it). */
  n: number;
  /** Whether anything glows. */
  glowed: boolean;
  flat: boolean;
  c: Uint8ClampedArray; g: Uint8ClampedArray;
  mid: Int16Array; jit: Float32Array;
  constructor(w: number, h: number, ox = 0, oy = 0, o: PixOpts = {}) {
    this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.n = 1; this.glowed = false; this.flat = !!o.flat;
    this.c = new Uint8ClampedArray(w * h * 4); this.g = new Uint8ClampedArray(w * h * 4);
    this.mid = new Int16Array(w + 16); this.jit = new Float32Array(w + 16);
  }
  /** One pixel, in world px; glow 0..1 puts it on the glow picture that bright. */
  put(x: number, y: number, col: readonly number[] | null | undefined, glow = 0): void {
    x = Math.floor(x) - this.ox; y = Math.floor(y) - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !col) return;
    const o = (y * this.w + x) * 4; this.c[o] = col[0]; this.c[o + 1] = col[1]; this.c[o + 2] = col[2]; this.c[o + 3] = 255;
    if (glow) { this.g[o] = col[0] * glow; this.g[o + 1] = col[1] * glow; this.g[o + 2] = col[2] * glow; this.g[o + 3] = 255; this.glowed = true; }
    else this.g[o] = this.g[o + 1] = this.g[o + 2] = this.g[o + 3] = 0;
  }
  /** What's there mixed toward a color, k of the way (haze, steam). */
  tint(x: number, y: number, col: readonly number[], k: number): void {
    x = Math.floor(x) - this.ox; y = Math.floor(y) - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 4; if (!this.c[o + 3]) return;
    this.c[o] = lerp(this.c[o], col[0], k); this.c[o + 1] = lerp(this.c[o + 1], col[1], k); this.c[o + 2] = lerp(this.c[o + 2], col[2], k);
  }
  /** A painted area: v(x, y) its value (0..1), read from the ramp. Flat, each
   * pixel its own tone; otherwise read at each stroke's middle with a little
   * jitter, so the area reads as brushwork. */
  area(ax0: number, ay0: number, ax1: number, ay1: number, ramp: readonly (readonly number[])[], v: (x: number, y: number) => number, o: AreaOpts = {}): void {
    const seed = o.seed === undefined ? this.n * 13 + 5 : o.seed; this.n++;
    ax0 = Math.floor(ax0); ay0 = Math.floor(ay0); ax1 = Math.ceil(ax1); ay1 = Math.ceil(ay1);
    const x0 = Math.max(this.ox, ax0), y0 = Math.max(this.oy, ay0), x1 = Math.min(this.ox + this.w - 1, ax1), y1 = Math.min(this.oy + this.h - 1, ay1);
    if (x1 < x0 || y1 < y0) return;
    const flat = this.flat, inside = o.inside || null, J = flat ? 0 : o.jit === undefined ? 0.45 : o.jit, n = x1 - x0 + 1, glow = o.glow || 0, fog = o.fog || 0, fogc = o.fogc || [20, 16, 30];
    const mid = this.mid, jit = this.jit;
    for (let y = y0; y <= y1; y++) {
      // (flat, the strokes aren't read: jit stays 0 and the middle unused)
      if (!flat) strokeRow(mid, jit, x0, n, y, seed);
      for (let i = 0; i < n; i++) {
        const x = x0 + i; if (inside && !inside(x, y)) continue;
        const m = x0 + mid[i], vx = v(x, y), vm = flat ? vx : m >= ax0 && m <= ax1 && (!inside || inside(m, y)) ? v(m, y) : vx;
        let c: readonly number[] = tone(ramp, clamp(vm * 0.6 + vx * 0.4, 0, 1), jit[i] * J);
        if (fog) c = mixRgb(c, fogc, fog);
        this.put(x, y, c, glow);
      }
    }
  }
  /** A block, lit side-on (blockV). */
  block(x0: number, y0: number, x1: number, y1: number, ramp: readonly (readonly number[])[], o: BlockOpts = {}): void { this.area(x0, y0, x1, y1, ramp, blockV(x0, y0, x1, y1, o, this.flat), o); }
  /** Does a world box touch this buffer? */
  sees(x0: number, y0: number, x1: number, y1: number): boolean { return x1 >= this.ox && y1 >= this.oy && x0 < this.ox + this.w && y0 < this.oy + this.h; }
  /** The buffer as canvases: the picture, and the glow (null if nothing glows). */
  canvases(): { c: HTMLCanvasElement; e: HTMLCanvasElement | null } {
    const [c, g] = canvas(this.w, this.h); g.putImageData(new ImageData(this.c as Uint8ClampedArray<ArrayBuffer>, this.w, this.h), 0, 0);
    let e: HTMLCanvasElement | null = null;
    if (this.glowed) { const [ec, eg] = canvas(this.w, this.h); eg.putImageData(new ImageData(this.g as Uint8ClampedArray<ArrayBuffer>, this.w, this.h), 0, 0); e = ec; }
    return { c, e };
  }
}

/** A block's value at each pixel, lit side-on. Flat: its base, a crisp lit
 * top edge, a shaded bottom, the left edge lit and the right shaded, with
 * drips, bands and panel lines. Strokes: slow noise and grain over the base,
 * a beveled lip, soot under, the west face lit and the east shaded. */
export function blockV(x0: number, y0: number, x1: number, y1: number, o: BlockOpts = {}, flat = false): (x: number, y: number) => number {
  const base = o.base === undefined ? 0.5 : o.base, s = o.seed || 3, grain = o.grain === undefined ? 0.06 : o.grain, lip = o.lip === undefined ? 1 : o.lip;
  if (flat) return (x, y) => {
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

// ---- operations and chunks -----------------------------------------------------
/** A painting operation: a box in world px (what it may touch), its seed and
 * what it paints. */
export interface Op { x0: number; y0: number; x1: number; y1: number; seed: number; fn: (P: Pix) => void }

/** Runs the operations whose box touches a buffer, in order, each from its own seed. */
export function paintOps(P: Pix, ops: readonly Op[]): Pix {
  for (const op of ops) if (P.sees(op.x0, op.y0, op.x1, op.y1)) { P.n = op.seed; op.fn(P); }
  return P;
}

/** A painted chunk: its picture and glow (null if nothing glows), and where it is. */
export interface Chunk { c: HTMLCanvasElement; e: HTMLCanvasElement | null; x: number; y: number }

/** The chunk (cx, cy), `size` px square, painted from the operations. */
export function chunk(ops: readonly Op[], cx: number, cy: number, size: number, o: PixOpts = {}): Chunk {
  const P = paintOps(new Pix(size, size, cx * size, cy * size, o), ops);
  const { c, e } = P.canvases();
  return { c, e, x: cx * size, y: cy * size };
}

/** How painting ahead looks for work. */
export interface AheadOpts {
  /** How many chunks either side of the one at (x, y) to look, across (3) and down (2). */
  rx?: number; ry?: number;
  /** Milliseconds to keep painting the nearest chunks not yet made (0: one chunk). */
  budget?: number;
}

/** A cache of chunks, `size` px square, over a world `w` × `h` px: each made
 * by `make(cx, cy)` when first asked for, kept until `reset` (or, with `max`,
 * until it's the longest unused of too many). */
export class Chunks<C> {
  size: number; w: number; h: number; max: number;
  make: (cx: number, cy: number) => C;
  map: Map<string, { v: C; used: number }>;
  stamp: number;
  constructor(o: { size: number; make: (cx: number, cy: number) => C; w?: number; h?: number; max?: number }) {
    this.size = o.size; this.make = o.make; this.w = o.w || 0; this.h = o.h || 0; this.max = o.max || Infinity;
    this.map = new Map(); this.stamp = 0;
  }
  /** Lets every chunk go, and takes the world's size anew (if given). */
  reset(world?: { w: number; h: number }): void { this.map.clear(); if (world) { this.w = world.w; this.h = world.h; } }
  key(cx: number, cy: number): string { return cx + ',' + cy; }
  has(cx: number, cy: number): boolean { return this.map.has(this.key(cx, cy)); }
  /** Whether a chunk lies in the world. */
  inside(cx: number, cy: number): boolean { return cx >= 0 && cy >= 0 && cx * this.size < this.w && cy * this.size < this.h; }
  /** The chunk, made if it's new. */
  get(cx: number, cy: number): C {
    const k = this.key(cx, cy);
    let e = this.map.get(k);
    if (!e) { e = { v: this.make(cx, cy), used: 0 }; this.map.set(k, e); }
    e.used = ++this.stamp;
    if (this.map.size > this.max) this.trim(this.max);
    return e.v;
  }
  /** The chunk if it's made, without making it. */
  peek(cx: number, cy: number): C | undefined { const e = this.map.get(this.key(cx, cy)); return e && e.v; }
  /** The chunks (made if new) a box of the world touches, row by row. */
  over(x0: number, y0: number, x1: number, y1: number): C[] {
    const S = this.size, out: C[] = [];
    for (let cy = Math.floor(y0 / S); cy <= Math.floor(y1 / S); cy++) for (let cx = Math.floor(x0 / S); cx <= Math.floor(x1 / S); cx++) if (this.inside(cx, cy)) out.push(this.get(cx, cy));
    return out;
  }
  /** The nearest chunk in the world not yet made, near the one at (x, y)
   * (fewest steps across and down; the first found in rows on a tie). */
  nearest(x: number, y: number, rx = 3, ry = 2): [number, number] | null {
    const S = this.size, cx0 = Math.floor(x / S), cy0 = Math.floor(y / S);
    let best: [number, number] | null = null, bd = 1e9;
    for (let cy = cy0 - ry; cy <= cy0 + ry; cy++) for (let cx = cx0 - rx; cx <= cx0 + rx; cx++) {
      if (!this.inside(cx, cy) || this.has(cx, cy)) continue;
      const d = Math.abs(cx - cx0) + Math.abs(cy - cy0); if (d < bd) { bd = d; best = [cx, cy]; }
    }
    return best;
  }
  /** A frame's spare work: makes the nearest chunk not yet made near (x, y),
   * and more while the budget lasts, so walking into new ground doesn't
   * stall. Returns how many it made. */
  ahead(x: number, y: number, o: AheadOpts = {}): number {
    const t0 = o.budget ? performance.now() : 0;
    let made = 0;
    for (;;) {
      const at = this.nearest(x, y, o.rx === undefined ? 3 : o.rx, o.ry === undefined ? 2 : o.ry);
      if (!at) break;
      this.get(at[0], at[1]); made++;
      if (!o.budget || performance.now() - t0 >= o.budget) break;
    }
    return made;
  }
  /** Lets go of the chunks used longest ago until there are at most `max`. */
  trim(max = this.max): void {
    if (this.map.size <= max) return;
    const all = [...this.map.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [k] of all) { if (this.map.size <= max) break; this.map.delete(k); }
  }
  get count(): number { return this.map.size; }
}

/** A level: its size in world px and its painting operations. */
export interface Level { w: number; h: number; ops: readonly Op[] }

/** The chunked lazy painter for a level: `reset(level)`, then `get(cx, cy)`
 * for a painted chunk and `ahead(x, y)` in a frame's spare time. */
export class Painter extends Chunks<Chunk> {
  level: Level | null; pix: PixOpts;
  constructor(o: { size: number; max?: number } & PixOpts) {
    super({ size: o.size, max: o.max, make: () => { throw new Error('a painter paints a level: reset(level) first'); } });
    this.level = null; this.pix = { flat: !!o.flat };
    this.make = (cx, cy) => chunk((this.level as Level).ops, cx, cy, this.size, this.pix);
  }
  /** A new level: every chunk goes. */
  override reset(level?: Level): void { if (level) this.level = level; super.reset(level); }
}
