// Small numeric helpers every game had its own copy of.

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Where v lies between a and b, 0..1 (not clamped). */
export const unlerp = (a: number, b: number, v: number): number => (b === a ? 0 : (v - a) / (b - a));
export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);
export const dist2 = (ax: number, ay: number, bx: number, by: number): number => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
export const angleTo = (ax: number, ay: number, bx: number, by: number): number => Math.atan2(by - ay, bx - ax);
/** v moved toward target by at most step. */
export const approach = (v: number, target: number, step: number): number => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
/** A rate-independent ease toward a target: the share of the gap closed in dt
 * at `rate` per second, as 1 - e^(-rate dt). */
export const ease = (v: number, target: number, rate: number, dt: number): number => v + (target - v) * (1 - Math.exp(-rate * dt));
/** Wraps v into 0..m. */
export const wrap = (v: number, m: number): number => ((v % m) + m) % m;
