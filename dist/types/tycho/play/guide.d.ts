export interface Step {
    /** Done now? Asked every frame while the step is current. */
    done?: () => boolean;
    /** The last word: it waits until the game calls finish(). */
    end?: boolean;
    /** The chapter it belongs to (for "Parts · 2/6"). */
    ch?: string;
    [field: string]: unknown;
}
/** Where a guide stands, as kept in a save. */
export interface Place {
    i: number;
    off?: boolean;
}
export interface GuideOptions<S extends Step> {
    steps: S[];
    /** Where it stands: the object in the save (read each time, since a save
     * loaded replaces it), or null for a game that has none. */
    state: () => Place | null | undefined;
}
/** A guide's place at the start, to keep in a new game's save. */
export declare function fresh(): Place;
export declare class Guide<S extends Step = Step> {
    steps: S[];
    o: GuideOptions<S>;
    constructor(o: GuideOptions<S>);
    /** Where it stands (the save's object), or null. */
    get s(): Place | null;
    /** Running: there's a place, it wasn't skipped, and it isn't past the end. */
    active(): boolean;
    /** The step it's on. */
    get step(): S;
    /** Every frame: moves on past whatever is done, more than one step if the
     * player is ahead (never past an `end`). Returns the steps passed, oldest
     * first (none, mostly). */
    tick(): S[];
    /** Skipped: it never shows again. */
    skip(): void;
    /** Read to the end: past the last step. */
    finish(): void;
    /** A field of a step that may be a function (called) or a value. */
    read(field: string, step?: S): unknown;
    /** Where a step is in its chapter: its chapter, which it is (from 1) and of how many. */
    place(step?: S): {
        ch: string | undefined;
        at: number;
        of: number;
    };
}
