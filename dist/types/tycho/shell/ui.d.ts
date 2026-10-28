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
export interface TyperOptions {
    /** Letters a second (40). */
    cps?: number;
    /** A breath after a word that ends a sentence (. ! ? …) and after one that ends a clause (, ; : —), in ms (260, 110). */
    stop?: number;
    pause?: number;
    /** Before a typed line: the first (160), and one after another typed line (320); before a line shown whole, after a typed one (200). */
    first?: number;
    gap?: number;
    after?: number;
    /** The classes that keep what's still to come hidden in its room: a whole line (tk-wait), and a line's letters not yet said (tk-unsaid). */
    wait?: string;
    unsaid?: string;
    /** True to show everything at once (by default, when the page asks for reduced motion). */
    reduced?: () => boolean;
    /** The clock and the frames (performance.now, requestAnimationFrame and its cancel), for a test to give its own. */
    now?: () => number;
    frame?: (fn: () => void) => number;
    cancel?: (id: number) => void;
}
/** One step of the words coming out, `t` ms from the start: line `line`
 * shown (upto -1), or its first `upto` letters said. */
export interface TypeAct {
    t: number;
    line: number;
    upto: number;
}
/** When each line shows and each letter is said: a typed line waits a beat
 * (a longer one after another typed line), then its letters come at `cps`,
 * with a breath where a word ends a sentence or a clause; a line shown whole
 * (your own words, a note) comes a beat after a typed one, or at once. */
export declare function typeTimeline(lines: {
    text: string;
    typed: boolean;
}[], o?: TyperOptions): TypeAct[];
/** Lines of a conversation said aloud. `type(els, typed, on)` hides the
 * lines given (keeping their room), then shows them in turn: the ones
 * `typed(el)` says are spoken have the words directly in them (not inside
 * a child, so a name label stays put) said a letter at a time; the rest
 * appear whole. `on.show(el)` as each line appears (to bring it into view),
 * `on.done()` when all have. `finish()` says the rest at once (a tap to
 * hurry it); `stop()` leaves it where it is. */
export declare class Typer {
    o: Required<Pick<TyperOptions, 'wait' | 'unsaid'>> & TyperOptions;
    private job;
    constructor(o?: TyperOptions);
    get busy(): boolean;
    type(els: HTMLElement[], typed: (el: HTMLElement) => boolean, on?: {
        show?: (el: HTMLElement) => void;
        done?: () => void;
    }): void;
    /** Everything still to come, said at once. */
    finish(): void;
    /** Stops where it is (the lines not yet shown stay hidden). */
    stop(): void;
    private cancel;
    private act;
    private end;
}
