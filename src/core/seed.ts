// Seeded randomness: hashes of integers and strings, value noise and seeded
// streams. Anything generated or painted draws from these, never Math.random,
// so a seed always makes the same world and the same picture and golden
// tests can pin them. For sparkle that nothing saves (rain, sparks) there's
// `fxRand`, which is allowed to be truly random.
//
// The functions are the ones the games already used, bit for bit, so moving
// onto them changes nothing: `hash` and `noise` are the White Dragon's,
// `mulberry32`, `hashInts`, `hashString` and `Rng` Lodestar's (the White
// Dragon's Rng is the same generator), `hash2` and `makeNoise` Merryfolk's.

/** A hash of three integers to 0..1 (non-integers are truncated first). */
export function hash(x: number, y: number, s = 0): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** A hash of two numbers to 0..1, multiplying before truncating (Merryfolk's;
 * the same as hash(x, y, 0) for integers of everyday size). */
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smoothstep: 0 at 0, 1 at 1, flat at both ends. */
export const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Value noise from `hash`, smooth between integer lattice points, 0..1. */
export function noise(x: number, y: number, s = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), u = smooth(x - xi), v = smooth(y - yi);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** A generator of 0..1 from a 32-bit seed (mulberry32). */
export function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mixes any number of integers into one 32-bit seed. */
export function hashInts(...xs: number[]): number {
  let h = 0x811c9dc5 | 0;
  for (const x of xs) {
    h = Math.imul(h ^ (x | 0), 0x01000193);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  }
  return h >>> 0;
}

/** A string to a 32-bit seed (FNV-1a). */
export function hashString(s: string): number {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Fractal value noise over a 256 x 256 table filled from a seed
 * (Merryfolk's): three octaves, 0..1. */
export function makeNoise(seed: number): (x: number, y: number) => number {
  const rng = mulberry32(seed);
  const P = new Float32Array(256 * 256);
  for (let i = 0; i < P.length; i++) P[i] = rng();
  const g = (i: number, j: number) => P[((j & 255) << 8) | (i & 255)];
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  function v(x: number, y: number) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = smooth(x - xi), w = smooth(y - yi);
    return lerp(lerp(g(xi, yi), g(xi + 1, yi), u), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), u), w);
  }
  return (x, y) => v(x, y) * 0.6 + v(x * 2.1 + 17, y * 2.1 + 9) * 0.3 + v(x * 4.3 + 3, y * 4.3 + 41) * 0.1;
}

/** A seeded stream. `f()` is 0..1, `f(a)` 0..a, `f(a, b)` a..b; `i(a, b)` an
 * integer from a to b; `pick`, `chance`, `weighted` ([[weight, value]...]),
 * `shuffle` (in place) and `fork` (a seed for a child stream). */
export class Rng {
  seed: number;
  next: () => number;
  constructor(seed: number) { this.seed = seed >>> 0; this.next = mulberry32(this.seed); }
  f(a = 1, b?: number): number { return b === undefined ? this.next() * a : a + this.next() * (b - a); }
  i(a: number, b: number): number { return Math.floor(a + this.next() * (b - a + 1)); }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p: number): boolean { return this.next() < p; }
  weighted<T>(list: readonly (readonly [number, T])[]): T {
    let total = 0;
    for (const [w] of list) total += Math.max(0, w);
    let r = this.next() * total;
    for (const [w, v] of list) { r -= Math.max(0, w); if (r < 0) return v; }
    return list[list.length - 1][1];
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  fork(): number { return Math.floor(this.next() * 4294967296) >>> 0; }
}

/** Randomness for effects nobody saves or tests (rain, sparks, a flicker):
 * Math.random, with Rng's shape. */
export const fxRand = {
  f: (a = 1, b?: number): number => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
  i: (a: number, b: number): number => Math.floor(a + Math.random() * (b - a + 1)),
  pick: <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)],
  chance: (p: number): boolean => Math.random() < p,
  weighted<T>(list: readonly (readonly [number, T])[]): T | null {
    let total = 0;
    for (const [w] of list) total += Math.max(0, w);
    let r = Math.random() * total;
    for (const [w, v] of list) { r -= Math.max(0, w); if (r <= 0) return v; }
    return list.length ? list[list.length - 1][1] : null;
  },
};
