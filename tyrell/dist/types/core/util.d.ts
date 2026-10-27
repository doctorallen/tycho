/** Clamps x to [lo, hi]. */
export declare const clamp: (x: number, lo?: number, hi?: number) => number;
/** Linear interpolation from a to b by t. */
export declare const lerp: (a: number, b: number, t: number) => number;
/** Rounds to a few decimals, so logs and snapshots stay readable. */
export declare const round: (x: number, places?: number) => number;
/**
 * A 32-bit string hash (cyrb53, folded to 32 bits). Stable across platforms,
 * so the same seed and ids give the same city everywhere.
 */
export declare function hashString(str: string, seed?: number): number;
/** Hashes any mix of strings and numbers into one 32-bit integer. */
export declare function hash(...parts: Array<string | number>): number;
/** A hash turned into a float in [0, 1). */
export declare const hash01: (...parts: Array<string | number>) => number;
/**
 * sfc32: a small, fast generator that passes PractRand. Returns a function
 * that yields floats in [0, 1).
 */
export declare function sfc32(a: number, b: number, c: number, d: number): () => number;
/** A generator seeded from any mix of strings and numbers. */
export declare function rngFrom(...parts: Array<string | number>): () => number;
/** A seeded random stream with the helpers the engine uses. */
export declare class Stream {
    private r;
    constructor(...parts: Array<string | number>);
    /** A float in [0, 1). */
    next(): number;
    /** A float in [lo, hi). */
    range(lo: number, hi: number): number;
    /** An integer in [0, n). */
    int(n: number): number;
    /** True with probability p. */
    chance(p: number): boolean;
    /** One item, picked uniformly. */
    pick<T>(items: readonly T[]): T | undefined;
    /** One item, picked with probability proportional to its weight. */
    weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined;
    /** A copy of the list in a random order. */
    shuffle<T>(items: readonly T[]): T[];
}
/** Deep copy of plain JSON data. */
export declare const clone: <T>(x: T) => T;
/** A min-heap ordered by (t, seq): the engine's event queue. Plain data, so it saves. */
export interface HeapItem {
    t: number;
    seq: number;
}
export declare function heapPush<T extends HeapItem>(heap: T[], item: T): void;
export declare function heapPop<T extends HeapItem>(heap: T[]): T | undefined;
export declare const heapPeek: <T extends HeapItem>(heap: T[]) => T | undefined;
/** Minutes in an hour and a day. Tyrell's clock counts minutes. */
export declare const HOUR = 60;
export declare const DAY = 1440;
/** The hour of the day (0 to 24, fractional) at a time in minutes. */
export declare const hourOf: (t: number) => number;
/** The day number at a time in minutes. */
export declare const dayOf: (t: number) => number;
/** Is hour h inside [a, b), where the span may wrap past midnight? */
export declare function inHours(h: number, span: readonly [number, number] | undefined): boolean;
/** Minutes from time t until hour h next comes round (0 if it is h now). */
export declare function untilHour(t: number, h: number): number;
/** A stable JSON string (sorted keys), for hashing state. */
export declare function stableStringify(x: unknown): string;
