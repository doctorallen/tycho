export declare const clamp: (v: number, a: number, b: number) => number;
export declare const lerp: (a: number, b: number, t: number) => number;
/** Where v lies between a and b, 0..1 (not clamped). */
export declare const unlerp: (a: number, b: number, v: number) => number;
export declare const dist: (ax: number, ay: number, bx: number, by: number) => number;
export declare const dist2: (ax: number, ay: number, bx: number, by: number) => number;
export declare const angleTo: (ax: number, ay: number, bx: number, by: number) => number;
/** v moved toward target by at most step. */
export declare const approach: (v: number, target: number, step: number) => number;
/** A rate-independent ease toward a target: the share of the gap closed in dt
 * at `rate` per second, as 1 - e^(-rate dt). */
export declare const ease: (v: number, target: number, rate: number, dt: number) => number;
/** Wraps v into 0..m. */
export declare const wrap: (v: number, m: number) => number;
