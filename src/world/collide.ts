// Tycho.collide: one place to ask what's solid, over hand-placed shapes and
// tile grids alike. A Space gathers the solids of a level (boxes, ellipses,
// the sides of the world, a grid's tiles felt square or along a smooth line)
// and the surfaces that hold you only in some ways (one-way walkways and
// stairs, stood on from above; ladders), and answers the questions movement
// and play ask: is this box clear (and what's in it), is this point solid,
// does a round body here touch anything, how far into the ground is it, is
// there a walkway under x between these heights, is there a ladder here,
// and what does this ray hit first.
//
// The White Dragon's levels are boxes, walkways, stairs and ladders
// (its World.hits, World.way and World.ladderAt, bit for bit); Lodestar's
// floors are tiles felt along a smooth wall line (its rockAt), and its
// bodies round (bodyHits, bodyInRock). Lists are kept by reference, or read
// through a function each time, so a level's shapes can change under it.

import type { Grid } from './grid';

/** A box: from x0, y0 to x1, y1 (world px; x1 > x0, y1 > y0). */
export interface Box { x0: number; y0: number; x1: number; y1: number }
/** A one-way surface from (x0, y0) to (x1, y1), x0 <= x1: flat (a walkway) or sloped (stairs). */
export interface Way { x0: number; y0: number; x1: number; y1: number }
/** A ladder at x from y0 (its top) down to y1. */
export interface Ladder { x: number; y0: number; y1: number }
/** A round solid: its middle and its radii. */
export interface Ellipse { x: number; y: number; rx: number; ry: number }
/** A list kept by reference, or a function that gives the list as it is now. */
export type List<T> = readonly T[] | (() => readonly T[]);

/** What a ray hit first: how far along (0..1), where, and what (a box, a tile or an ellipse). */
export interface Hit { t: number; x: number; y: number; box?: Box; tile?: { x: number; y: number; v: number }; ellipse?: Ellipse }

export interface TilesDef {
  /** World px a tile. */
  size: number;
  /** By tile value: is it solid? (truthy for solid) */
  solid: ArrayLike<unknown>;
  /**
   * Felt along a smooth line instead of as squares (Lodestar's wall line):
   * at a point, the four nearest tiles' solidity blended, with a little of
   * `noise(x, y)` (-1..1) times `amp` added, solid past a half. Where two
   * open tiles meet only at a corner the blend is cut by `pinch` (0.55),
   * so the diagonal stays open wide enough to walk.
   */
  smooth?: { noise?: (x: number, y: number) => number; amp?: number; pinch?: number };
}

/** A grid's layer felt as solid: square tiles, or a smooth line through them. */
export class Tiles {
  readonly grid: Grid;
  readonly layer: number;
  readonly size: number;
  readonly solid: ArrayLike<unknown>;
  readonly smooth: boolean;
  private readonly noise: ((x: number, y: number) => number) | null;
  private readonly amp: number;
  private readonly pinch: number;
  // a flat grid's layer, read straight from its array where all four tiles are inside
  private readonly cells: ArrayLike<number> | null;
  private readonly w: number;
  private readonly h: number;

  constructor(grid: Grid, layer: number, def: TilesDef) {
    this.grid = grid; this.layer = layer; this.size = def.size; this.solid = def.solid;
    this.smooth = !!def.smooth;
    const s = def.smooth || {};
    this.noise = s.noise || null; this.amp = s.amp || 0; this.pinch = s.pinch === undefined ? 0.55 : s.pinch;
    this.cells = grid.flat ? grid.array(layer) : null; this.w = grid.w; this.h = grid.h;
  }

  /** The tile under world px x, y. */
  tileAt(x: number, y: number): number { return this.grid.get(this.layer, Math.floor(x / this.size), Math.floor(y / this.size)); }

  /** Is world px x, y solid? (by `solid`, or another table, such as which tiles rise as rock) */
  at(x: number, y: number, solid: ArrayLike<unknown> = this.solid): boolean {
    const g = this.grid, l = this.layer;
    if (!this.smooth) return !!solid[g.get(l, Math.floor(x / this.size), Math.floor(y / this.size))];
    const gx = x / this.size - 0.5, gy = y / this.size - 0.5, tx = Math.floor(gx), ty = Math.floor(gy), u = gx - tx, v = gy - ty;
    let a: number, b: number, c: number, d: number;
    const C = this.cells, w = this.w;
    if (C && tx >= 0 && ty >= 0 && tx + 1 < w && ty + 1 < this.h) {
      const i = ty * w + tx;
      a = solid[C[i]] ? 1 : 0; b = solid[C[i + 1]] ? 1 : 0; c = solid[C[i + w]] ? 1 : 0; d = solid[C[i + w + 1]] ? 1 : 0;
    } else {
      a = solid[g.get(l, tx, ty)] ? 1 : 0; b = solid[g.get(l, tx + 1, ty)] ? 1 : 0;
      c = solid[g.get(l, tx, ty + 1)] ? 1 : 0; d = solid[g.get(l, tx + 1, ty + 1)] ? 1 : 0;
    }
    if (a === b && b === c && c === d) return a === 1;
    const ab = a + (b - a) * u, cd = c + (d - c) * u;
    let blend = ab + (cd - ab) * v;
    if (a === d && b === c) blend *= this.pinch;
    return blend + (this.noise ? this.amp * this.noise(x, y) : 0) > 0.5;
  }

  /** Square tiles: the first solid tile (row by row) under the box, as a box. */
  box(x0: number, y0: number, x1: number, y1: number): Box | null {
    const S = this.size, g = this.grid, l = this.layer;
    const tx0 = Math.floor(x0 / S), ty0 = Math.floor(y0 / S), tx1 = Math.ceil(x1 / S), ty1 = Math.ceil(y1 / S);
    for (let ty = ty0; ty < ty1; ty++) for (let tx = tx0; tx < tx1; tx++) if (this.solid[g.get(l, tx, ty)]) return { x0: tx * S, y0: ty * S, x1: tx * S + S, y1: ty * S + S };
    return null;
  }
}

// a round body is felt at its middle and at eight points round its edge
const RING: [number, number][] = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)]);

const read = <T>(list: List<T>): readonly T[] => (typeof list === 'function' ? (list as () => readonly T[])() : list);

export class Space {
  private readonly boxSets: { list: List<any>; pick: ((item: any) => Box | null | undefined | false) | null }[] = [];
  private readonly tileSets: Tiles[] = [];
  private readonly ellipseSets: List<Ellipse>[] = [];
  private readonly waySets: List<Way>[] = [];
  private readonly ladderSets: { list: List<Ladder>; reach: number }[] = [];
  private side: [number, number] | null = null;
  /** The points round a body's edge, as [cos, sin] (eight, evenly round). */
  readonly ring: readonly [number, number][] = RING;

  /** Solid boxes: the list's items, or what `pick` makes of each (nothing for one that isn't solid now). */
  boxes<T>(list: List<T>, pick?: (item: T) => Box | null | undefined | false): this { this.boxSets.push({ list, pick: pick || null }); return this; }
  /** Solid walls either side of the world: everything left of x0 and right of x1. */
  bounds(x0: number, x1: number): this { this.side = [x0, x1]; return this; }
  /** A grid's tiles. */
  tiles(t: Tiles): this { this.tileSets.push(t); return this; }
  /** Round solids. */
  ellipses(list: List<Ellipse>): this { this.ellipseSets.push(list); return this; }
  /** One-way surfaces: walkways and stairs. */
  ways(list: List<Way>): this { this.waySets.push(list); return this; }
  /** Ladders, taken within `reach` px of their line (6). */
  ladders(list: List<Ladder>, reach = 6): this { this.ladderSets.push({ list, reach }); return this; }

  /**
   * The first solid that the box x0..x1, y0..y1 overlaps (edges touching
   * don't count): the boxes in the order given, square tiles, then the
   * sides (a wall 100 px thick and 2e4 tall); null when it's clear.
   */
  hits(x0: number, y0: number, x1: number, y1: number): Box | null {
    for (const set of this.boxSets) {
      const list = read(set.list), pick = set.pick;
      for (let i = 0; i < list.length; i++) {
        const r = pick ? pick(list[i]) : (list[i] as Box);
        if (r && x1 > r.x0 && x0 < r.x1 && y1 > r.y0 && y0 < r.y1) return r;
      }
    }
    for (const t of this.tileSets) if (!t.smooth) { const r = t.box(x0, y0, x1, y1); if (r) return r; }
    const s = this.side;
    if (s && (x0 < s[0] || x1 > s[1])) return { x0: x0 < s[0] ? s[0] - 100 : s[1], y0: -1e4, x1: x0 < s[0] ? s[0] : s[1] + 100, y1: 1e4 };
    return null;
  }

  /** Is the point solid in any grid's tiles? */
  inTiles(x: number, y: number): boolean {
    for (const t of this.tileSets) if (t.at(x, y)) return true;
    return false;
  }

  /** Is the point solid: in the tiles, a box (its left and top edges in, right and bottom out), an ellipse, or past the sides? */
  solidAt(x: number, y: number): boolean {
    if (this.inTiles(x, y)) return true;
    for (const set of this.boxSets) {
      const list = read(set.list), pick = set.pick;
      for (let i = 0; i < list.length; i++) { const r = pick ? pick(list[i]) : (list[i] as Box); if (r && x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1) return true; }
    }
    for (const set of this.ellipseSets) for (const o of read(set)) { const u = (x - o.x) / o.rx, v = (y - o.y) / o.ry; if (u * u + v * v < 1) return true; }
    const s = this.side;
    return !!s && (x < s[0] || x > s[1]);
  }

  /**
   * Does a round body of radius r at x, y touch anything solid? Felt in the
   * tiles at its middle and the eight points round its edge (so a smooth
   * wall line is met where it matters), and by overlap with ellipses
   * (grown by r), boxes and the sides.
   */
  circleHits(x: number, y: number, r: number): boolean {
    const ring = this.ring;
    for (const t of this.tileSets) {
      if (t.at(x, y)) return true;
      for (let k = 0; k < ring.length; k++) if (t.at(x + ring[k][0] * r, y + ring[k][1] * r)) return true;
    }
    for (const set of this.ellipseSets) for (const o of read(set)) { const u = (x - o.x) / (o.rx + r), v = (y - o.y) / (o.ry + r); if (u * u + v * v < 1) return true; }
    for (const set of this.boxSets) {
      const list = read(set.list), pick = set.pick;
      for (let i = 0; i < list.length; i++) {
        const b = pick ? pick(list[i]) : (list[i] as Box);
        if (!b) continue;
        const nx = x < b.x0 ? b.x0 : x > b.x1 ? b.x1 : x, ny = y < b.y0 ? b.y0 : y > b.y1 ? b.y1 : y;
        if ((x - nx) * (x - nx) + (y - ny) * (y - ny) < r * r) return true;
      }
    }
    const s = this.side;
    return !!s && (x - r < s[0] || x + r > s[1]);
  }

  /** How far into the tiles a round body is: its edge's points in them, its middle counting double. */
  circleDepth(x: number, y: number, r: number): number {
    const ring = this.ring;
    let n = this.inTiles(x, y) ? 2 : 0;
    for (let k = 0; k < ring.length; k++) if (this.inTiles(x + ring[k][0] * r, y + ring[k][1] * r)) n++;
    return n;
  }

  /** The height of the highest one-way surface at x between y0 and y1 (inclusive), or null. */
  way(x: number, y0: number, y1: number): number | null {
    let best: number | null = null;
    for (const set of this.waySets) for (const w of read(set)) {
      if (x < w.x0 || x > w.x1) continue;
      const y = w.y0 + (w.y1 - w.y0) * ((x - w.x0) / Math.max(1, w.x1 - w.x0));
      if (y >= y0 && y <= y1 && (best === null || y < best)) best = y;
    }
    return best;
  }

  /** The first ladder within reach of x whose span overlaps y0..y1, or null. */
  ladderAt(x: number, y0: number, y1: number): Ladder | null {
    for (const set of this.ladderSets) for (const l of read(set.list)) if (Math.abs(x - l.x) < set.reach && y1 > l.y0 && y0 < l.y1) return l;
    return null;
  }

  /**
   * What the ray from x0, y0 to x1, y1 hits first, or null if it gets there:
   * boxes and the sides by their edges, square tiles cell by cell as the
   * line crosses them, smooth tiles felt every `step` px along it (1), and
   * ellipses exactly. A ray that starts inside something hits it at t = 0.
   */
  ray(x0: number, y0: number, x1: number, y1: number, step = 1): Hit | null {
    const dx = x1 - x0, dy = y1 - y0;
    const found: { hit: Hit | null } = { hit: null };
    const take = (h: Hit) => { if (!found.hit || h.t < found.hit.t) found.hit = h; };
    const past = (t: number) => !!found.hit && t >= found.hit.t;
    // a box by its slabs
    const slab = (b: Box): number | null => {
      let lo = 0, hi = 1;
      for (const [o, d, a, z] of [[x0, dx, b.x0, b.x1], [y0, dy, b.y0, b.y1]]) {
        if (d === 0) { if (o < a || o >= z) return null; continue; }
        let t0 = (a - o) / d, t1 = (z - o) / d;
        if (t0 > t1) { const q = t0; t0 = t1; t1 = q; }
        if (t0 > lo) lo = t0;
        if (t1 < hi) hi = t1;
        if (lo > hi) return null;
      }
      return lo;
    };
    for (const set of this.boxSets) {
      const list = read(set.list), pick = set.pick;
      for (let i = 0; i < list.length; i++) { const b = pick ? pick(list[i]) : (list[i] as Box); if (!b) continue; const t = slab(b); if (t !== null) take({ t, x: x0 + dx * t, y: y0 + dy * t, box: b }); }
    }
    const s = this.side;
    if (s) for (const b of [{ x0: s[0] - 1e9, y0: -1e9, x1: s[0], y1: 1e9 }, { x0: s[1], y0: -1e9, x1: s[1] + 1e9, y1: 1e9 }]) { const t = slab(b); if (t !== null) take({ t, x: x0 + dx * t, y: y0 + dy * t, box: b }); }
    for (const o of this.ellipseSets.flatMap((set) => read(set))) {
      // (x0 + dx t - ox)² / rx² + (...)² / ry² = 1
      const px = (x0 - o.x) / o.rx, py = (y0 - o.y) / o.ry, qx = dx / o.rx, qy = dy / o.ry;
      const A = qx * qx + qy * qy, B = 2 * (px * qx + py * qy), C = px * px + py * py - 1;
      if (C < 0) { take({ t: 0, x: x0, y: y0, ellipse: o }); continue; }
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
        for (let k = 0; k <= n; k++) { const t = k / n; if (past(t)) break; const x = x0 + dx * t, y = y0 + dy * t; if (T.at(x, y)) { take({ t, x, y, tile: { x: Math.floor(x / S), y: Math.floor(y / S), v: T.tileAt(x, y) } }); break; } }
        continue;
      }
      // cell by cell along the line (Amanatides and Woo)
      let tx = Math.floor(x0 / S), ty = Math.floor(y0 / S);
      const ex = Math.floor(x1 / S), ey = Math.floor(y1 / S), sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
      const ddx = dx ? Math.abs(S / dx) : Infinity, ddy = dy ? Math.abs(S / dy) : Infinity;
      let nx = dx ? ((dx > 0 ? (tx + 1) * S : tx * S) - x0) / dx : Infinity, ny = dy ? ((dy > 0 ? (ty + 1) * S : ty * S) - y0) / dy : Infinity, t = 0;
      for (let guard = 0; guard < 1e6; guard++) {
        if (past(t)) break;
        const v = T.grid.get(T.layer, tx, ty);
        if (T.solid[v]) { take({ t, x: x0 + dx * t, y: y0 + dy * t, tile: { x: tx, y: ty, v } }); break; }
        if (tx === ex && ty === ey) break;
        if (nx < ny) { t = nx; nx += ddx; tx += sx; } else { t = ny; ny += ddy; ty += sy; }
        if (t > 1) break;
      }
    }
    return found.hit;
  }
}
