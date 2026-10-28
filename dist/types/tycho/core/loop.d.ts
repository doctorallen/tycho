/** Fixed steps from real time: `advance(dt, step)` runs step(this.dt) as many
 * times as the time allows, at most `max` a frame (then drops the rest, so a
 * slow phone slows down rather than walking through walls). Real frames
 * longer than `longest` seconds count as that long. */
export declare class Stepper {
    dt: number;
    max: number;
    longest: number;
    acc: number;
    last: number;
    constructor(o?: {
        dt?: number;
        max?: number;
        longest?: number;
    });
    /** Seconds since the last animation frame (clamped), from its timestamp. */
    since(now: number): number;
    /** Runs the steps owed; returns how many ran. */
    advance(dt: number, step: (dt: number) => void): number;
    /** Forgets owed time (while paused). */
    hold(): void;
}
/** A rolling window of samples (frame times, gaps between frames). */
export declare class Samples {
    list: number[];
    size: number;
    constructor(size?: number);
    add(v: number): void;
    /** The p-th percentile (0..1); 0 with no samples. */
    pct(p: number): number;
    count(test: (v: number) => boolean): number;
}
/** Lowers the quality while frames run slow: every `window` seconds of play it
 * looks at the frames a second, and under `below` calls `lower()`, which
 * steps the quality down and says whether it could. `check(dt, active)`
 * each frame; inactive time (paused, hidden) starts the count over. */
export declare class Governor {
    t: number;
    n: number;
    window: number;
    below: number;
    lower: () => boolean;
    constructor(o: {
        window?: number;
        below?: number;
        lower: () => boolean;
    });
    check(dt: number, active?: boolean): void;
}
