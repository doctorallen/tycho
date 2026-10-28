/** A hash of three integers to 0..1 (non-integers are truncated first). */
export declare function hash(x: number, y: number, s?: number): number;
/** A hash of two numbers to 0..1, multiplying before truncating (Merryfolk's;
 * the same as hash(x, y, 0) for integers of everyday size). */
export declare function hash2(x: number, y: number): number;
/** Smoothstep: 0 at 0, 1 at 1, flat at both ends. */
export declare const smooth: (t: number) => number;
/** Value noise from `hash`, smooth between integer lattice points, 0..1. */
export declare function noise(x: number, y: number, s?: number): number;
/** A generator of 0..1 from a 32-bit seed (mulberry32). */
export declare function mulberry32(a: number): () => number;
/** Mixes any number of integers into one 32-bit seed. */
export declare function hashInts(...xs: number[]): number;
/** A string to a 32-bit seed (FNV-1a). */
export declare function hashString(s: string): number;
/** Fractal value noise over a 256 x 256 table filled from a seed
 * (Merryfolk's): three octaves, 0..1. */
export declare function makeNoise(seed: number): (x: number, y: number) => number;
/** A seeded stream. `f()` is 0..1, `f(a)` 0..a, `f(a, b)` a..b; `i(a, b)` an
 * integer from a to b; `pick`, `chance`, `weighted` ([[weight, value]...]),
 * `shuffle` (in place) and `fork` (a seed for a child stream). */
export declare class Rng {
    seed: number;
    next: () => number;
    constructor(seed: number);
    f(a?: number, b?: number): number;
    i(a: number, b: number): number;
    pick<T>(arr: readonly T[]): T;
    chance(p: number): boolean;
    weighted<T>(list: readonly (readonly [number, T])[]): T;
    shuffle<T>(arr: T[]): T[];
    fork(): number;
}
/** Randomness for effects nobody saves or tests (rain, sparks, a flicker):
 * Math.random, with Rng's shape. */
export declare const fxRand: {
    f: (a?: number, b?: number) => number;
    i: (a: number, b: number) => number;
    pick: <T>(arr: readonly T[]) => T;
    chance: (p: number) => boolean;
    weighted<T>(list: readonly (readonly [number, T])[]): T | null;
};
