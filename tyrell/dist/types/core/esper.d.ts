import type { EsperConfig, Minutes } from './types';
import type { World } from './world';
interface Input {
    t: Minutes;
    name: string;
    args: unknown[];
    after?: number;
    chain?: boolean;
}
export declare const DEFAULT_ESPER: EsperConfig;
export declare class Esper {
    private w;
    readonly config: EsperConfig;
    private snaps;
    private inputs;
    /** The absolute index of inputs[0] (older inputs are pruned). */
    private base;
    /** The absolute index of the next input to apply (equals the end when there's no future). */
    private cursor;
    private nextMark;
    private seeking;
    private marks;
    constructor(w: World, cfg?: Partial<EsperConfig>);
    /** Is time walk recording? */
    get on(): boolean;
    /** Forgets all history (after a load). */
    reset(): void;
    /** Takes the first snapshot, the earliest point to rewind to. */
    ensureBase(): void;
    /**
     * Records an input from outside (called by World.input before applying it).
     * `after` is the seq of the event it came in during, if any.
     */
    record(name: string, args: unknown[], after?: number, chain?: boolean): void;
    /**
     * Is this call the very input the recorded future holds next? (After a
     * rewind, a game that reacts to replayed events the same way as before
     * repeats itself; those repeats don't start a new timeline.)
     */
    echo(name: string, args: unknown[], after?: number, chain?: boolean): boolean;
    /** The next recorded input still ahead of the world (after a rewind), if any. */
    pending(): Input | undefined;
    /** Applies the next recorded input, and any chained to it. */
    applyNext(): void;
    /** Takes snapshots for every mark the clock is about to pass (marks strictly before t). */
    passMarks(t: Minutes): void;
    private snapshot;
    /** Drops history older than `keep`, and thins what's older than `sparseAfter`. */
    private prune;
    /** The earliest time Esper can go back to. */
    earliest(): Minutes;
    /** The latest time it knows (the end of the recorded future, or now). */
    latest(): Minutes;
    /** The span of history: [earliest, latest]. */
    span(): [Minutes, Minutes];
    /** How many snapshots and inputs are held (for a memory readout). */
    size(): {
        snapshots: number;
        inputs: number;
        bytes: number;
    };
    /** Goes to time t (clamped to what's remembered): back by restoring and replaying, forward by running. */
    seek(t: Minutes): void;
    /** Drops the recorded future (a new input in the past starts a new timeline). */
    private branch;
    /** Names the present moment, to come back to later. */
    mark(name: string): void;
    /** Goes back (or forward) to a named moment. Returns false if it's been forgotten. */
    seekMark(name: string): boolean;
    /** History as plain data, for a save that keeps it. */
    export(): unknown;
    import(h: any): void;
}
export {};
