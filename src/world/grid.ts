// Tycho.grid: a world's tiles. A grid is w × h tiles in layers (the ground,
// the walls, the ore...), each a number of 8 or 16 bits a tile, all under one
// lookup that answers an edge value outside. The tiles are kept in chunks
// (32 × 32 by default), each made the first time it's touched (filled, or
// made from the seed by the game's `make`), so a world of millions of tiles
// holds only the parts that have been reached; or, for a world that's
// generated whole, as one flat array a layer, which can be the game's own
// arrays, wrapped as they are. Either way the chunks keep the bookkeeping:
// the rectangles changed since they were last taken (for repainting), and,
// once the grid is sealed, every tile changed from what the seed made, so a
// save keeps only the changes and a load makes the world again and puts
// them back.

/** A layer's tiles, row by row. */
export type Cells = Uint8Array | Uint16Array;

export interface LayerDef {
  name: string;
  /** Bits a tile: 8 (the default) or 16. */
  bits?: 8 | 16;
  /** What a tile starts as (0). */
  fill?: number;
  /** What `get` answers outside the grid (the fill). */
  edge?: number;
  /** A flat grid's tiles, w × h row by row: used as they are, never copied. */
  data?: Cells;
}

export interface GridDef {
  w: number;
  h: number;
  layers: LayerDef[];
  /** The chunks' side in tiles, a power of two (32). */
  chunk?: number;
  /** Each layer as one w × h array (always so when a layer brings its data). */
  flat?: boolean;
  /** A chunked grid's chunk made the first time it's touched: fill its cells from the seed. */
  make?: (chunk: Chunk, grid: Grid) => void;
}

/** A chunk of a chunked grid: its place, and a layer's cells each (side × side, row by row). */
export interface Chunk {
  cx: number;
  cy: number;
  /** Its first tile. */
  x0: number;
  y0: number;
  cells: Cells[];
}

/** Tiles from x0, y0 up to (not including) x1, y1. */
export interface Rect { x0: number; y0: number; x1: number; y1: number }

/** The changes from what the seed made, by layer name: x, y, value, x, y, value... in rows. */
export type Changes = Record<string, number[]>;

export class Grid {
  readonly w: number;
  readonly h: number;
  /** The chunks' side in tiles. */
  readonly chunk: number;
  /** Chunks across and down. */
  readonly cw: number;
  readonly ch: number;
  readonly flat: boolean;
  readonly names: string[];
  readonly edges: number[];
  private readonly defs: LayerDef[];
  private readonly shift: number;
  private readonly mask: number;
  private readonly make?: (chunk: Chunk, grid: Grid) => void;
  private readonly data: Cells[] = []; // flat
  private readonly chunks: (Chunk | undefined)[] = []; // chunked
  // a chunk's dirty box (by chunk index): x0, y0, x1, y1 in tiles
  private readonly dirtyBox = new Map<number, Rect>();
  // once sealed: by chunk index, the cells changed (layer × side² + cell) and what the seed made them
  private sealed = false;
  private readonly orig = new Map<number, Map<number, number>>();

  constructor(def: GridDef) {
    const side = def.chunk || 32;
    if (side & (side - 1)) throw new Error('Tycho.grid: a chunk\'s side is a power of two');
    this.w = def.w; this.h = def.h; this.chunk = side;
    this.shift = Math.log2(side) | 0; this.mask = side - 1;
    this.cw = Math.ceil(def.w / side); this.ch = Math.ceil(def.h / side);
    this.defs = def.layers;
    this.names = def.layers.map((l) => l.name);
    this.edges = def.layers.map((l) => (l.edge !== undefined ? l.edge : l.fill || 0));
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
  layer(name: string): number {
    const i = this.names.indexOf(name);
    if (i < 0) throw new Error('Tycho.grid: no layer ' + name);
    return i;
  }

  /** The tile at x, y (whole tiles) in layer l; the layer's edge value outside. */
  get(l: number, x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this.edges[l];
    if (this.flat) return this.data[l][y * this.w + x];
    const s = this.shift, c = this.chunks[(y >> s) * this.cw + (x >> s)] || this.chunkAt(x >> s, y >> s);
    return c.cells[l][((y & this.mask) << s) | (x & this.mask)];
  }

  /** Sets a tile (false outside the grid): its chunk's rectangle is marked changed and, once sealed, the change kept. */
  set(l: number, x: number, y: number, v: number): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    const s = this.shift, ci = (y >> s) * this.cw + (x >> s);
    let cells: Cells, i: number;
    if (this.flat) { cells = this.data[l]; i = y * this.w + x; }
    else { cells = (this.chunks[ci] || this.chunkAt(x >> s, y >> s)).cells[l]; i = ((y & this.mask) << s) | (x & this.mask); }
    const was = cells[i];
    cells[i] = v;
    if (cells[i] === was) return true; // (unchanged, or the same once it's stored)
    const d = this.dirtyBox.get(ci);
    if (!d) this.dirtyBox.set(ci, { x0: x, y0: y, x1: x + 1, y1: y + 1 });
    else { if (x < d.x0) d.x0 = x; if (y < d.y0) d.y0 = y; if (x + 1 > d.x1) d.x1 = x + 1; if (y + 1 > d.y1) d.y1 = y + 1; }
    if (this.sealed) {
      const k = l * this.chunk * this.chunk + (((y & this.mask) << s) | (x & this.mask));
      let m = this.orig.get(ci);
      if (!m) this.orig.set(ci, (m = new Map()));
      if (!m.has(k)) m.set(k, was);
      else if (m.get(k) === cells[i]) m.delete(k); // (back to what the seed made)
    }
    return true;
  }

  /** Fills the tiles from x0, y0 up to x1, y1 (clipped to the grid). */
  fill(l: number, x0: number, y0: number, x1: number, y1: number, v: number): void {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(this.w, x1); y1 = Math.min(this.h, y1);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.set(l, x, y, v);
  }

  /** A flat grid's layer: its w × h tiles (the array it was given, if it was). */
  array(l: number): Cells {
    if (!this.flat) throw new Error('Tycho.grid: only a flat grid has a layer in one array');
    return this.data[l];
  }

  /** Has the chunk at cx, cy been made? (A flat grid's always have.) */
  has(cx: number, cy: number): boolean { return this.flat || !!this.chunks[cy * this.cw + cx]; }

  /** A chunked grid's chunk at cx, cy, made if it hasn't been. */
  chunkAt(cx: number, cy: number): Chunk {
    if (this.flat) throw new Error('Tycho.grid: a flat grid has no chunks of its own');
    const ci = cy * this.cw + cx;
    let c = this.chunks[ci];
    if (c) return c;
    const n = this.chunk * this.chunk;
    c = { cx, cy, x0: cx * this.chunk, y0: cy * this.chunk, cells: this.defs.map((l) => { const a = l.bits === 16 ? new Uint16Array(n) : new Uint8Array(n); if (l.fill) a.fill(l.fill); return a; }) };
    this.chunks[ci] = c;
    if (this.make) this.make(c, this);
    return c;
  }

  /** The rectangles of tiles changed since the last take, one a chunk, in rows of chunks. */
  takeDirty(): Rect[] {
    const out = [...this.dirtyBox.keys()].sort((a, b) => a - b).map((k) => this.dirtyBox.get(k)!);
    this.dirtyBox.clear();
    return out;
  }

  /** What's in the grid now is what the seed made: from here on every change from it is kept. */
  seal(): void { this.sealed = true; this.orig.clear(); }

  /** Every tile that isn't what the seed made, by layer, in rows: for a save. */
  changes(): Changes {
    const out: Changes = {}, side = this.chunk, n = side * side, all: [number, number, number, number][] = [];
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
  apply(changes: Changes): void {
    for (const name of Object.keys(changes)) {
      const l = this.names.indexOf(name), list = changes[name];
      if (l < 0) continue; // (a layer the game no longer has)
      for (let i = 0; i + 2 < list.length; i += 3) this.set(l, list[i], list[i + 1], list[i + 2]);
    }
  }
}
