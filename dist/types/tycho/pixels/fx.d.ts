/** Anything with time left. */
export interface Timed {
    t: number;
}
/** Counts each one's time down by dt and drops those run out (t <= 0), in
 * place. Returns the list. */
export declare function tick<E extends Timed>(list: E[], dt: number): E[];
/** Counts each one's age (t) up by dt and drops those past their life
 * (`life`, or the one given for all), in place. Returns the list. */
export declare function age<E extends Timed & {
    life?: number;
}>(list: E[], dt: number, life?: number): E[];
/** A particle: where it is, how it moves, its time left. Gravity `g` (px/s²),
 * `drag` (the share of speed lost a second, as e^(-drag·dt)), and a `floor`
 * it bounces off (y down). Anything else it carries is the game's. */
export interface Particle extends Timed {
    x: number;
    y: number;
    vx: number;
    vy: number;
    g?: number;
    drag?: number;
    floor?: number;
}
/** How a particle bounces off its floor: how much of its fall it keeps
 * (0.35) and of its slide (0.6). */
export interface Bounce {
    bounce?: number;
    slide?: number;
}
/** Moves a particle by dt: drag, then gravity, then motion; landing on its
 * floor while falling, it bounces. */
export declare function move(q: Particle, dt: number, o?: Bounce): void;
/** A list of particles that move and run out, kept under a size: past `max`
 * the oldest go until `keep` are left (260 and 200, the White Dragon's). */
export declare class Particles<P extends Particle = Particle> {
    list: P[];
    max: number;
    keep: number;
    bounce: Bounce;
    constructor(o?: {
        max?: number;
        keep?: number;
    } & Bounce);
    add(p: P): P;
    /** The oldest let go if there are too many. */
    cap(): void;
    /** Each moves by dt and loses dt of its time; those run out go. */
    step(dt: number): void;
    get length(): number;
}
/** A random source for an emitter: the k-th particle's s-th draw, 0..1 (the
 * White Dragon's is hash(frame, k, s); fxRand.f() ignores both). */
export type Draw = (k: number, s: number) => number;
/** Sparks thrown up and falling: n of them from (x, y), each its own speed,
 * life and a hot color from orange to yellow (the White Dragon's). */
export declare function sparks(x: number, y: number, n: number, draw: Draw, o?: {
    spread?: number;
    up?: number;
    upMore?: number;
    life?: number;
    lifeMore?: number;
    g?: number;
}): (Particle & {
    c: number[];
})[];
/** A ring of n flying out from (x, y) in one color, each a little off its
 * place round the ring and its own speed and life (the White Dragon's). */
export declare function burst<C>(x: number, y: number, c: C, n: number, draw: Draw, o?: {
    speed?: number;
    speedMore?: number;
    life?: number;
    lifeMore?: number;
}): (Particle & {
    c: C;
})[];
/** How rising lines of text go. */
export interface RiseOpts {
    /** Px a second it rises (12). */
    speed?: number;
    /** Px between the lines of one rising (21). */
    line?: number;
    /** When it starts to fade (1.8 s), how long the fade takes (0.6 s), and
     * when it's gone (2.4 s). */
    fade?: number;
    out?: number;
    life?: number;
}
/** Where the i-th of `of` lines rising together is at an age (seconds): how
 * far above where it started its line sits (`stack`: the first highest) and
 * how far it has risen (`up`), and its opacity; null before it starts or
 * once it's gone. (Its place is start - stack - up.) */
export declare function rise(age: number, i?: number, of?: number, o?: RiseOpts): {
    stack: number;
    up: number;
    alpha: number;
} | null;
