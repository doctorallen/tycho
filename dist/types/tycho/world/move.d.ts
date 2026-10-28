import type { Ladder, Space } from './collide';
/** A platform body: x is the middle of its feet, y its soles (world px). */
export interface PlatformBody {
    x: number;
    y: number;
    vx: number;
    vy: number;
    /** 1 facing right, -1 left. */
    face: number;
    ground: boolean;
    /** Seconds left to jump after leaving the ground. */
    coyote: number;
    /** Seconds left falling through walkways. */
    drop: number;
    /** The ladder it's on, or null. */
    ladder: Ladder | null;
    /** Distance walked and climbed (for the stride). */
    walked: number;
}
/** A step's controls. */
export interface PlatformControl {
    /** The stick: -1..1 across, -1 (up) ..1 (down). */
    ax: number;
    ay: number;
    /** Jump held, and pressed since the last step. */
    jump: boolean;
    jumpHit: boolean;
    /** The pace times this (1). */
    scale?: number;
    /** The pace times this too, as long as no ladder is taken this step (1): slowed while busy at something. */
    busy?: number;
}
/** The body's size and the speeds (px, px/s, px/s², s), read every step. */
export interface PlatformNumbers {
    w: number;
    h: number;
    /** Running and walking pace. */
    speed: number;
    walk: number;
    /** A sprint past the run, with the stick pushed further still (none: the run is the fastest). */
    sprint?: number;
    /** Toward the pace on the ground and in the air; slowing with the stick let go. */
    accel: number;
    airAccel: number;
    friction: number;
    jump: number;
    gravity: number;
    maxFall: number;
    coyote: number;
    /** Up and down a ladder. */
    climb: number;
}
/** The feel's finer numbers: each defaults to the White Dragon's. */
export interface PlatformOptions {
    /** Under this push of the stick, a walk; then to a run over this much more (0.62, 0.28). */
    walkUnder?: number;
    runSpan?: number;
    /** With a `sprint` pace: past this push, from the run to the sprint over this much more (0.78, 0.12). */
    sprintFrom?: number;
    sprintSpan?: number;
    /** A ladder's taken with the stick up or down past grabY and not across past grabX (0.5, 0.6). */
    grabY?: number;
    grabX?: number;
    /** How far below the feet a ladder's reached going down (3); not within grabTop of its top going up, or grabBottom of its foot going down (2, 1). */
    grabBelow?: number;
    grabTop?: number;
    grabBottom?: number;
    /** Jumping off a ladder: this share of a jump, and this fast the way it faces (0.7, 60). */
    leap?: number;
    leapKick?: number;
    /** Let go of a ladder with the stick across past letGoX and not up or down past letGoY (0.6, 0.3). */
    letGoX?: number;
    letGoY?: number;
    /** Down past dropY and jump drops through a walkway (not one over something solid within dropFoot of the feet), passing through them for dropTime (0.5, 4, 0.25). */
    dropY?: number;
    dropFoot?: number;
    dropTime?: number;
    /** Jump let go while rising faster than hop: gravity this much more (70, 0.9). */
    hop?: number;
    hopGravity?: number;
    /** Ledges from stepMin to stepMax high stepped up (2, 7). */
    stepMin?: number;
    stepMax?: number;
    /** Stairs followed this far up or down while walking on them (7). */
    follow?: number;
}
/** What a step did: ended on a ladder, and took one. */
export interface PlatformResult {
    climbing: boolean;
    grabbed: boolean;
}
export declare class Platform {
    /** The numbers, kept by reference (a game's tuning can change under it). */
    readonly n: PlatformNumbers;
    readonly o: Required<PlatformOptions>;
    private readonly res;
    constructor(numbers: PlatformNumbers, options?: PlatformOptions);
    /** The body's box at x, y: [x0, y0, x1, y1]. */
    box(x: number, y: number): [number, number, number, number];
    /** What the body's box at x, y overlaps (a hair inside its edges), or null. */
    hits(space: Space, x: number, y: number): import("./collide").Box | null;
    /** One step of dt seconds. The result is kept and reused: read it before the next step. */
    step(space: Space, b: PlatformBody, c: PlatformControl, dt: number): PlatformResult;
}
/** The finer numbers of the top-down slide: each defaults to Lodestar's. */
export interface TopdownOptions {
    /** Halvings to find how far an axis goes before it's stopped (4). */
    bisect?: number;
    /** Moved less than this share of the way: met a curve head on (0.3). */
    round?: number;
    /** The turns tried to go round it, in order (radians: 0.7, -0.7, 1.2, -1.2), at this share of the step (0.8). */
    turns?: readonly number[];
    reach?: number;
}
/**
 * Moves a round body of radius r at b.x, b.y by dx, dy against the space
 * (Lodestar's moveBody). Clear: it goes. Already wedged in something (pushed
 * onto a ragged edge): it may work its way out, or along at the same depth
 * with its middle clear, but never deeper in. Blocked: it slides along, one
 * axis at a time, as far as each goes; and if that got it less than a third
 * of the way, it tries going round, a little either side, then more.
 */
export declare function topdown(space: Space, b: {
    x: number;
    y: number;
}, dx: number, dy: number, r: number, o?: TopdownOptions): void;
