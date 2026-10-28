/** A toast shown (in the list that's redrawn whole). */
export interface ToastItem {
    text: string;
    kind: string;
    t: number;
}
export interface ToastOptions {
    /** Where they go. */
    box(): HTMLElement | null;
    /** At most this many on screen; the oldest goes for a new one. */
    most?: number | (() => number);
    /** Seconds on screen (by its words and kind). */
    life?: number | ((text: string, kind: string) => number);
    /** The clock (seconds) a redrawn list keeps time by; real time without it. */
    clock?: () => number;
    /** A toast's class. */
    cls?: (kind: string) => string;
    /** The words are HTML (else text). */
    html?: boolean;
    /** Redraw the whole list on each change, timed by `tick()` (the White
     * Dragon's); else each toast is an element of its own on its own timer
     * (Lodestar's). */
    redraw?: boolean;
    /** Redrawn: shown fully until this many seconds old, then faded (opacity
     * 0, the CSS easing it). */
    fadeAt?: number;
    /** Redrawn: the same words as the last within this many seconds keep the
     * last one instead (its time renewed). */
    merge?: number;
    /** Elements: the same words already on screen give way to the new. */
    replace?: boolean;
    /** Elements: the life set as the element's animation-duration (the CSS
     * fades it). */
    animate?: boolean;
    /** Kinds that wait their turn for room on screen (hints). */
    waits?: (kind: string) => boolean;
    /** While true, none of those waiting is shown (a screen is open). */
    held?: () => boolean;
    /** One that waited is never shown twice (until `forget()`). */
    once?: boolean;
    /** After each is shown. */
    after?: () => void;
}
/** Toasts. `show(text, kind)` from anywhere; `tick()` every frame (a
 * redrawn list's time, and the queue); `clear(fresh)` when a screen opens. */
export declare class Toasts {
    o: ToastOptions;
    /** A redrawn list's toasts, oldest first. */
    list: ToastItem[];
    /** Those waiting their turn. */
    queue: {
        text: string;
        kind: string;
    }[];
    /** Words that waited and have been shown. */
    seen: Set<string>;
    private kinds;
    constructor(o: ToastOptions);
    now(): number;
    most(): number;
    life(text: string, kind: string): number;
    cls(kind: string): string;
    /** A toast: shown now, or (a kind that waits) queued, unless it's waiting
     * already or (once) has been shown. */
    show(text: string, kind?: string): void;
    /** Shown now, whatever its kind. */
    put(text: string, kind?: string): void;
    /** A redrawn list, drawn. */
    draw(): void;
    /** Every frame: a redrawn list fades and lets go of its oldest when its
     * time's up; and any waiting are shown if there's room. */
    tick(): void;
    /** Those waiting, shown while there's room (and nothing holds them). */
    pump(): void;
    /** Everything on screen goes (a screen opened): news is dropped; one of
     * the kinds that wait, shown less than `fresh` seconds ago, goes back to
     * the front of the queue to be shown after, and the rest count as read. */
    clear(fresh?: number): void;
    /** Forgets which have been shown (a new world: its hints again). */
    forget(): void;
}
/** A rising line: where, when, which of how many, and the game's own fields. */
export interface RisingLine {
    x: number;
    y: number;
    t: number;
    i: number;
    of: number;
    kind?: string;
    [k: string]: unknown;
}
export interface RisingOptions {
    /** The line's inner HTML. */
    line: (g: RisingLine) => string;
    /** The clock, in seconds. */
    clock: () => number;
    /** Seconds a line lasts (2.4), when it starts to fade (1.8) and how long it
     * takes (0.6). */
    life?: number;
    fadeAt?: number;
    fadeFor?: number;
    /** px a second it rises (12), px between lines (21), seconds between them
     * coming (0.12), px left of the point (34). */
    rise?: number;
    gap?: number;
    stagger?: number;
    left?: number;
    /** The class of each (its kind added). */
    cls?: string;
}
/** What came out of something, a line each, stacked over it (the first on
 * top), rising and fading. `add(x, y, lines)` where; `html(at)` every frame,
 * with `at(x, y)` the screen's px for a world point. */
export declare class Rising {
    o: RisingOptions;
    list: RisingLine[];
    constructor(o: RisingOptions);
    add(x: number, y: number, lines: Record<string, unknown>[]): void;
    html(at: (x: number, y: number) => [number, number]): string;
}
/** Wires buttons by their data attributes: for each key, every `tag` under
 * root with data-<key> runs handler(its value, the element) when clicked. A
 * key may go on with more of a selector (`'job:not([data-say])'`). Keys are
 * wired in order, so a later one takes a button that has both. */
export declare function bind(root: ParentNode, handlers: Record<string, (value: string, el: HTMLElement) => void>, tag?: string): void;
export interface ActsOptions {
    /** The acts, by the name in data-act (or a function giving them, if the
     * game fills them in later). */
    acts: Record<string, (arg: string | undefined, el: HTMLElement) => void> | (() => Record<string, (arg: string | undefined, el: HTMLElement) => void>);
    /** While true taps are ignored (a screen just opened). */
    guard?: () => boolean;
    /** A confirming button was armed (by its first tap). */
    armed?: (el: HTMLElement) => void;
    /** Before an act runs (a tap's sound, say). */
    onAct?: (name: string, el: HTMLElement) => void;
}
/** A screen's buttons, from one handler: a tap on anything with data-act
 * runs that act with its data-arg (unless it's disabled, or the guard's
 * up). One with data-confirm asks once: the first tap arms it (its words
 * become data-confirm's, any other armed button goes back), the second runs
 * it. */
export declare class Acts {
    o: ActsOptions;
    constructor(o: ActsOptions);
    /** Listens for taps on el (a screen, or the document). */
    listen(el: EventTarget, type?: string): this;
    tap(e: Event): void;
}
