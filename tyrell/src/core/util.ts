// Small helpers shared by every part of the engine: hashing, seeded random
// streams, a binary heap for the event queue, and a few numeric utilities.
// Nothing in Tyrell calls Math.random: every random draw comes from a stream
// seeded by the world's seed, so a run can be replayed exactly.

/** Clamps x to [lo, hi]. */
export const clamp = (x: number, lo = 0, hi = 1): number => (x < lo ? lo : x > hi ? hi : x);

/** Linear interpolation from a to b by t. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Rounds to a few decimals, so logs and snapshots stay readable. */
export const round = (x: number, places = 4): number => {
  const k = 10 ** places;
  return Math.round(x * k) / k;
};

/**
 * A 32-bit string hash (cyrb53, folded to 32 bits). Stable across platforms,
 * so the same seed and ids give the same city everywhere.
 */
export function hashString(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/** Hashes any mix of strings and numbers into one 32-bit integer. */
export function hash(...parts: Array<string | number>): number {
  return hashString(parts.join('␟'));
}

/** A hash turned into a float in [0, 1). */
export const hash01 = (...parts: Array<string | number>): number => hash(...parts) / 4294967296;

/**
 * sfc32: a small, fast generator that passes PractRand. Returns a function
 * that yields floats in [0, 1).
 */
export function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** A generator seeded from any mix of strings and numbers. */
export function rngFrom(...parts: Array<string | number>): () => number {
  const key = parts.join('␟');
  const r = sfc32(hashString(key, 1), hashString(key, 2), hashString(key, 3), hashString(key, 4));
  for (let i = 0; i < 12; i++) r(); // warm up
  return r;
}

/** A seeded random stream with the helpers the engine uses. */
export class Stream {
  private r: () => number;
  constructor(...parts: Array<string | number>) {
    this.r = rngFrom(...parts);
  }
  /** A float in [0, 1). */
  next(): number { return this.r(); }
  /** A float in [lo, hi). */
  range(lo: number, hi: number): number { return lo + (hi - lo) * this.r(); }
  /** An integer in [0, n). */
  int(n: number): number { return Math.floor(this.r() * n); }
  /** True with probability p. */
  chance(p: number): boolean { return this.r() < p; }
  /** One item, picked uniformly. */
  pick<T>(items: readonly T[]): T | undefined { return items.length ? items[this.int(items.length)] : undefined; }
  /** One item, picked with probability proportional to its weight. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) return items[0];
    let x = this.r() * total;
    for (const it of items) {
      x -= Math.max(0, weight(it));
      if (x < 0) return it;
    }
    return items[items.length - 1];
  }
  /** A copy of the list in a random order. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}

/** Deep copy of plain JSON data. */
export const clone = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

/** A min-heap ordered by (t, seq): the engine's event queue. Plain data, so it saves. */
export interface HeapItem { t: number; seq: number }

export function heapPush<T extends HeapItem>(heap: T[], item: T): void {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (less(heap[p], heap[i])) break;
    [heap[p], heap[i]] = [heap[i], heap[p]];
    i = p;
  }
}

export function heapPop<T extends HeapItem>(heap: T[]): T | undefined {
  if (!heap.length) return undefined;
  const top = heap[0];
  const last = heap.pop() as T;
  if (heap.length) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      if (l < heap.length && less(heap[l], heap[m])) m = l;
      if (r < heap.length && less(heap[r], heap[m])) m = r;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]];
      i = m;
    }
  }
  return top;
}

export const heapPeek = <T extends HeapItem>(heap: T[]): T | undefined => heap[0];

function less(a: HeapItem, b: HeapItem): boolean {
  return a.t < b.t || (a.t === b.t && a.seq < b.seq);
}

/** Minutes in an hour and a day. Tyrell's clock counts minutes. */
export const HOUR = 60;
export const DAY = 1440;

/** The hour of the day (0 to 24, fractional) at a time in minutes. */
export const hourOf = (t: number): number => (((t % DAY) + DAY) % DAY) / HOUR;

/** The day number at a time in minutes. */
export const dayOf = (t: number): number => Math.floor(t / DAY);

/** Is hour h inside [a, b), where the span may wrap past midnight? */
export function inHours(h: number, span: readonly [number, number] | undefined): boolean {
  if (!span) return true;
  const [a, b] = span;
  if (a === b) return true;
  return a < b ? h >= a && h < b : h >= a || h < b;
}

/** Minutes from time t until hour h next comes round (0 if it is h now). */
export function untilHour(t: number, h: number): number {
  const now = hourOf(t);
  let d = h - now;
  if (d < 0) d += 24;
  return d * HOUR;
}

/** A stable JSON string (sorted keys), for hashing state. */
export function stableStringify(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x);
  if (Array.isArray(x)) return '[' + x.map(stableStringify).join(',') + ']';
  const obj = x as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined && typeof obj[k] !== 'function').sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}
