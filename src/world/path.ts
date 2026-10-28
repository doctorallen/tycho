// Tycho.path: ways through a world.
//
//   distances  steps on foot from one tile to every tile it can reach,
//              breadth first, four ways round (Lodestar's floorDistances):
//              a field a crowd follows downhill to whoever they're after
//   AStar      the least-cost way between two tiles, eight ways round and
//              never cutting a corner, the game saying where's walkable
//              and what a step costs (Merryfolk's findPath)
//   Routes     the cheapest way between places over a graph of links,
//              each a leg the game describes (a walk along a street, a
//              ride between bands) with what it costs, for people who
//              travel off screen as well as on

/** A layer's tiles (any typed array or list of numbers). */
export type CellsLike = ArrayLike<number>;

/**
 * Steps on foot from tile x, y to every tile (-1 where it can't be reached),
 * moving four ways round onto tiles that aren't `solid` (by tile value)
 * and aren't marked in `avoid` (non-zero), if given. Into `out` if given
 * (an Int16Array or Int32Array of w × h), else a new Int16Array.
 */
let QUEUE = new Int32Array(0); // (the search's queue, kept between searches)
export function distances(cells: CellsLike, w: number, h: number, x: number, y: number, solid: ArrayLike<unknown>, avoid?: ArrayLike<number> | null, out?: Int16Array | Int32Array): Int16Array | Int32Array {
  const n = w * h, d = out || new Int16Array(n);
  if (QUEUE.length < n) QUEUE = new Int32Array(n);
  const q = QUEUE;
  d.fill(-1);
  const s = y * w + x;
  if (x < 0 || y < 0 || x >= w || y >= h) return d;
  d[s] = 0; q[0] = s;
  let tail = 1;
  for (let qi = 0; qi < tail; qi++) {
    const i = q[qi], cx = i % w, cy = (i - cx) / w, next = d[i] + 1;
    // right, left, down, up
    if (cx + 1 < w) { const j = i + 1; if (d[j] < 0 && !solid[cells[j]] && !(avoid && avoid[j])) { d[j] = next; q[tail++] = j; } }
    if (cx > 0) { const j = i - 1; if (d[j] < 0 && !solid[cells[j]] && !(avoid && avoid[j])) { d[j] = next; q[tail++] = j; } }
    if (cy + 1 < h) { const j = i + w; if (d[j] < 0 && !solid[cells[j]] && !(avoid && avoid[j])) { d[j] = next; q[tail++] = j; } }
    if (cy > 0) { const j = i - w; if (d[j] < 0 && !solid[cells[j]] && !(avoid && avoid[j])) { d[j] = next; q[tail++] = j; } }
  }
  return d;
}

export interface AStarFind {
  /** Can a body stand on tile x, y? (Asked only inside the grid.) */
  walkable: (x: number, y: number) => boolean;
  /** What stepping onto x, y from fx, fy costs before the diagonal's share (1). */
  cost?: (x: number, y: number, fx: number, fy: number) => number;
  /** A start or goal that isn't walkable moves to the nearest walkable tile within this many (7; 0 for none). */
  snap?: number;
}

/**
 * A* over a w × h grid, eight ways round, never cutting a corner past a
 * tile that isn't walkable; a diagonal step costs `diag` (1.414) times a
 * straight one; the estimate is the octile distance at the same rate; at
 * most `cap` tiles are taken from the open list a search. Its buffers are
 * kept between searches (g and f as 32-bit floats, as Merryfolk keeps them).
 */
export class AStar {
  readonly w: number;
  readonly h: number;
  cap: number;
  readonly diag: number;
  private readonly g: Float32Array;
  private readonly f: Float32Array;
  private readonly from: Int32Array;
  private readonly stamp: Uint32Array;
  private readonly closed: Uint32Array;
  private gen = 0;
  private readonly heap: number[] = [];

  constructor(w: number, h: number, o: { cap?: number; diag?: number } = {}) {
    const n = w * h;
    this.w = w; this.h = h; this.cap = o.cap || n; this.diag = o.diag || 1.414;
    this.g = new Float32Array(n); this.f = new Float32Array(n); this.from = new Int32Array(n);
    this.stamp = new Uint32Array(n); this.closed = new Uint32Array(n);
  }

  /** The nearest walkable tile to x, y within r rings of it (rings outward, rows top to bottom), or null. */
  near(x: number, y: number, walkable: (x: number, y: number) => boolean, r = 7): [number, number] | null {
    const ok = (i: number, j: number) => i >= 0 && j >= 0 && i < this.w && j < this.h && walkable(i, j);
    if (ok(x, y)) return [x, y];
    for (let k = 1; k <= r; k++) for (let j = -k; j <= k; j++) for (let i = -k; i <= k; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== k) continue;
      if (ok(x + i, y + j)) return [x + i, y + j];
    }
    return null;
  }

  /** The way from sx, sy to tx, ty: its tiles after the start, the goal last ([[tx, ty]] if they're one); null if there's none within the cap. */
  find(sx: number, sy: number, tx: number, ty: number, o: AStarFind): [number, number][] | null {
    const W = this.w, H = this.h, walkable = o.walkable, cost = o.cost, D = this.diag;
    const snap = o.snap === undefined ? 7 : o.snap;
    const s = this.near(sx, sy, walkable, snap), t = this.near(tx, ty, walkable, snap);
    if (!s || !t) return null;
    [sx, sy] = s; [tx, ty] = t;
    if (sx === tx && sy === ty) return [[tx, ty]];
    const G = this.g, F = this.f, from = this.from, stamp = this.stamp, closed = this.closed, heap = this.heap;
    const gen = ++this.gen;
    heap.length = 0;
    const push = (n: number) => {
      heap.push(n); let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (F[heap[p]] <= F[heap[i]]) break; const q = heap[p]; heap[p] = heap[i]; heap[i] = q; i = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop()!;
      if (heap.length) {
        heap[0] = last; let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1; let m = i;
          if (l < heap.length && F[heap[l]] < F[heap[m]]) m = l;
          if (r < heap.length && F[heap[r]] < F[heap[m]]) m = r;
          if (m === i) break;
          const q = heap[m]; heap[m] = heap[i]; heap[i] = q; i = m;
        }
      }
      return top;
    };
    const est = (x: number, y: number) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return (dx + dy + (D - 2) * Math.min(dx, dy)) * 1.0; };
    const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && walkable(x, y);
    const si = sy * W + sx, ti = ty * W + tx;
    G[si] = 0; F[si] = est(sx, sy); stamp[si] = gen; from[si] = -1;
    push(si);
    let found = false, iter = 0;
    while (heap.length && iter++ < this.cap) {
      const cur = pop();
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      if (cur === ti) { found = true; break; }
      const cx = cur % W, cy = (cur / W) | 0;
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
        if (stamp[ni] !== gen || g < G[ni]) { stamp[ni] = gen; G[ni] = g; F[ni] = g + est(nx, ny); from[ni] = cur; push(ni); }
      }
    }
    if (!found) return null;
    const out: [number, number][] = [];
    for (let n = ti; n !== si && n !== -1; n = from[n]) out.push([n % W, (n / W) | 0]);
    out.reverse();
    return out;
  }
}

/** A route: what it costs in all, the places it passes (the first and last included), and the links' legs in order. */
export interface Route<L> { cost: number; places: string[]; legs: L[] }

/**
 * Places joined by links, each with a cost (minutes, px at walking pace,
 * whatever the game counts in) and a leg the game describes it by. The
 * cheapest route is found by Dijkstra's search; between routes that cost
 * the same, the one whose links were added first.
 */
export class Routes<L = unknown> {
  private readonly out = new Map<string, { to: string; cost: number; leg: L | undefined; seq: number }[]>();
  private seq = 0;

  /** A link from a to b (and back, with the same leg, unless oneWay). */
  link(a: string, b: string, cost: number, leg?: L, oneWay = false): this {
    this.add(a, b, cost, leg);
    if (!oneWay) this.add(b, a, cost, leg);
    return this;
  }

  private add(a: string, b: string, cost: number, leg: L | undefined) {
    if (!(cost >= 0)) throw new Error('Tycho.path: a link costs nothing or more');
    let l = this.out.get(a);
    if (!l) this.out.set(a, (l = []));
    l.push({ to: b, cost, leg, seq: this.seq++ });
    if (!this.out.has(b)) this.out.set(b, []);
  }

  /** The places linked so far. */
  places(): string[] { return [...this.out.keys()]; }

  /** The cheapest route from a to b, or null if none joins them. */
  route(a: string, b: string): Route<L> | null {
    if (!this.out.has(a) || !this.out.has(b)) return null;
    if (a === b) return { cost: 0, places: [a], legs: [] };
    const best = new Map<string, number>([[a, 0]]), prev = new Map<string, { from: string; leg: L | undefined }>(), done = new Set<string>();
    // the open list: [cost, the link's order, place], cheapest first
    const heap: [number, number, string][] = [[0, -1, a]];
    const less = (p: [number, number, string], q: [number, number, string]) => p[0] < q[0] || (p[0] === q[0] && p[1] < q[1]);
    const push = (e: [number, number, string]) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (!less(heap[i], heap[p])) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && less(heap[l], heap[m])) m = l; if (r < heap.length && less(heap[r], heap[m])) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const [c, , p] = pop();
      if (done.has(p)) continue;
      done.add(p);
      if (p === b) break;
      for (const e of this.out.get(p)!) {
        const nc = c + e.cost;
        if (done.has(e.to)) continue;
        const was = best.get(e.to);
        if (was === undefined || nc < was) { best.set(e.to, nc); prev.set(e.to, { from: p, leg: e.leg }); push([nc, e.seq, e.to]); }
      }
    }
    if (!done.has(b)) return null;
    const places = [b], legs: L[] = [];
    for (let p = b; p !== a; ) { const s = prev.get(p)!; if (s.leg !== undefined) legs.push(s.leg); places.push(s.from); p = s.from; }
    return { cost: best.get(b)!, places: places.reverse(), legs: legs.reverse() };
  }
}
