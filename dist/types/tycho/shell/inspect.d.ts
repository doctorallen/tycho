/** A person as the inspector reads them. */
export interface MindsPerson {
    id: string;
    name?: string;
    place: string | null;
    needs: Record<string, unknown>;
    vars?: Record<string, unknown>;
    doing: {
        kind: string;
        action: string;
        place?: string | null;
        from?: string | null;
        to?: string | null;
        end: number;
        rank?: number;
        layer?: string;
    } | null;
    directive?: {
        do: string;
        label?: string;
        done?: boolean;
    } | null;
}
/** An option weighed in a decision. */
export interface MindsCandidate {
    id: string;
    place: string | null;
    target?: string;
    rank: number;
    weight: number;
    layer?: string;
    parts?: [string, number][];
    blocked?: string;
}
export interface MindsDecision {
    t: number;
    picked: MindsCandidate | null;
    candidates: MindsCandidate[];
    reason?: string;
}
/** A routine's entry: [hour, place, activity, extra]. */
export type MindsEntry = [number, unknown, string, {
    rank?: number;
    [k: string]: unknown;
}?];
/** What the inspector reads of a world (Tyrell's World has all of it). */
export interface MindsWorld {
    readonly now: number;
    get(id: string): MindsPerson | undefined;
    needOf(id: string, need: string): number;
    why(id: string): MindsDecision | null;
    mind: {
        routineAt(p: MindsPerson, t?: number): {
            entry: MindsEntry;
            until: number;
        } | null;
        routineFor(p: MindsPerson, t?: number): MindsEntry[] | null;
        options?(p: MindsPerson): MindsCandidate[];
    };
    westmarch: {
        chronicle(who: string, since: number): string[];
    };
    readonly fellowship?: {
        relations(id: string): {
            id: string;
            regard: number;
        }[];
    } | null;
    readonly reverie?: {
        mood(id: string): number;
    } | null;
    readonly esper?: {
        earliest(): number;
    } | null;
    /** The pick's settings (its cut, how many it draws from, and the power of
     * the weights), for the chances. */
    readonly cfg?: {
        cut: number;
        top: number;
        power: number;
    };
    /** Runs fn changing nothing (for the options weighed now). */
    peek?<T>(fn: () => T): T;
    /** Irulan, the narrator (for `story`): the log told as beats, and the
     * storylines running through it. */
    readonly irulan?: MindsNarrator | null;
}
/** A piece of a told sentence: its words, and the person or place it names. */
export interface MindsPart {
    text: string;
    person?: string;
    place?: string;
}
/** A beat Irulan tells: when, how much it matters, and its sentence in parts. */
export interface MindsBeat {
    t: number;
    end?: number;
    who?: string[];
    with?: string[];
    score: number;
    text: string;
    parts: MindsPart[];
}
/** A storyline: its title, its beats, and whether it's still going. */
export interface MindsThread {
    id: string;
    title: string;
    parts: MindsPart[];
    beats: MindsBeat[];
    active: boolean;
    score: number;
}
/** What the inspector reads of Irulan (Tyrell's world.irulan has all of it). */
export interface MindsNarrator {
    beats(entries?: number | unknown[], opts?: Record<string, unknown>): MindsBeat[];
    threads(entries?: number | unknown[], opts?: Record<string, unknown>): {
        threads: MindsThread[];
    };
}
/** HH:MM of a time in minutes (the time of day). */
export declare function hhmm(m: number): string;
/** Text made safe for HTML (&, < and >). */
export declare function esc(t: unknown): string;
/** How a mind is shown. */
export interface MindOptions {
    /** The prefix of every class and data attribute (`tm`: .tmneeds,
     * data-tmsel). */
    prefix?: string;
    /** A person's name (else the world's, else their id). */
    name?(id: string): string;
    /** A line under the name: who they are. */
    who?(id: string): string;
    /** A place's label; null is anywhere. */
    place?(pid: unknown, id: string): string;
    /** Said after "Walking" (" (off screen)", say). */
    walking?(id: string): string;
    /** What follows the mood on its line (money, hobbies). */
    about?(id: string, p: MindsPerson): string;
    /** Whether someone they know can be picked (a button), or is only named. */
    selectable?(id: string): boolean;
    /** The game's buttons for this mind (HTML), before Close. */
    buttons?(id: string): string;
    /** The needs' bars: [low, high (over 0.6), worst (over 0.85)]. */
    needColors?: [string, string, string];
    /** Options of the last decision shown (9), the chronicle's span in minutes
     * (12 hours) and lines (10), and people they know (4). */
    options?: number;
    lately?: number;
    lines?: number;
    known?: number;
    /** Dense, for a dev drawer: each need's value beside its bar (numbers),
     * the chance each option had of being drawn (chances, from the world's
     * cfg), the options as a table (table), and what they'd choose if they
     * chose now, every option weighed again without changing anything, with
     * what's ruled out by reason (now: the world's peek and mind.options). */
    numbers?: boolean;
    chances?: boolean;
    table?: boolean;
    now?: boolean;
    /** Lately told as a story by Irulan, when the world has it: their beats
     * since `lately`, a sentence each with its time, the people in them
     * buttons to their own minds; then the storylines they're in (Irulan's
     * threads, from the story kept or the whole log). Only the beats that are
     * theirs or that they took part in, unless `around` (those they were only
     * about for too); `min` leaves out the beats that score under it (0.1:
     * what's routine), `threads` how many storylines (3, 0 for none), and
     * `weights` is Irulan's, by kind of entry. Without it, or without Irulan,
     * Westmarch's chronicle as it was. */
    story?: boolean | {
        min?: number;
        threads?: number;
        around?: boolean;
        weights?: Record<string, number>;
    };
}
/** The chance each option had of being picked: Tyrell's pick, worked out
 * (the top rank only, the weak cut, a draw from the best few by weight to
 * the power). Those it couldn't draw aren't in the map. */
export declare function chances(cands: MindsCandidate[], cfg?: {
    cut: number;
    top: number;
    power: number;
}): Map<MindsCandidate, number>;
/** Someone's mind, as HTML: who, what now and until when, what they were
 * told to do, their needs, their mood, why (the last decision), today's
 * routine, lately, the people they know best, and buttons. */
export declare function mind(w: MindsWorld, id: string, o?: MindOptions): string;
/** A kind of doing, for the colors on the map and the legend. */
export interface Kind {
    color: string;
    word: string;
}
/** A person drawn on the view, to be picked by a tap. */
export interface Dot {
    x: number;
    y: number;
    id: string;
}
/** A tappable box on the view, with whatever the game wants to know of it. */
export interface Badge {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
    [k: string]: unknown;
}
/** The game's map, drawn on the inspector's canvas. */
export interface InspectView {
    /** The canvas's height (CSS px) for a box this high (taller scrolls). */
    height?(box: number, ins: Inspector): number;
    /** Draws it (the canvas is cleared, scaled to CSS px): people with
     * ins.dot, boxes to tap with ins.badge. */
    draw(g: CanvasRenderingContext2D, ins: Inspector): void;
    /** A tap that found nobody: the box under it, if any. */
    tap?(badge: Badge | null, x: number, y: number, ins: Inspector): void;
    /** A drag: grab() when it starts, drag(dx, dy, what grab gave) as it goes. */
    grab?(ins: Inspector): unknown;
    drag?(dx: number, dy: number, at: unknown, ins: Inspector): void;
    wheel?(e: WheelEvent, x: number, y: number, ins: Inspector): void;
}
export interface InspectorOptions extends MindOptions {
    /** The world, or null when there are no minds. */
    world(): MindsWorld | null;
    /** Everyone to show, in order. */
    people(): string[];
    /** The kinds of doing, in the legend's order. */
    kinds?: Record<string, Kind>;
    /** What someone's doing now: a key of kinds. */
    kind?(id: string): string;
    /** What someone's doing, in a list of who's somewhere. */
    note?(id: string): string;
    /** The game's clock: now (minutes, Tyrell's), set to a time (and bring the
     * minds there), and how it reads. */
    clock: {
        now(): number;
        set(minutes: number): void;
        text(): string;
    };
    /** Speeds to play at (game minutes a second) and the first. */
    speeds?: number[];
    speed?: number;
    /** Steps of the clock's buttons, minutes. */
    steps?: number[];
    /** Says something (Esper can't go back that far). */
    say?(text: string): void;
    view?: InspectView;
    /** The game's own at the bar's end (HTML); its buttons' data-<prefix>
     * keys go to act. */
    bar?(): string;
    /** The game's own, after the clock is drawn (its bar's state). */
    status?(ins: Inspector): void;
    /** The side with nobody picked (else a count and the legend). */
    summary?(ins: Inspector): string;
    /** Someone picked from a list or a mind. */
    onSelect?(id: string, ins: Inspector): void;
    /** A button of the game's (a mind's data-<prefix>do, or the bar's), with
     * whoever's picked; false leaves the panel as it is. */
    act?(key: string, id: string | null, ins: Inspector): boolean | void;
    /** Whether the panel is still showing (else it stops). */
    open?(): boolean;
    /** The view's background. */
    bg?: string;
}
/** The inspector: `html()` its markup, `attach(root)` once it's in the page
 * (it runs until the panel closes). */
export declare class Inspector {
    o: InspectorOptions;
    P: string;
    /** Whoever's picked. */
    sel: string | null;
    /** Who's somewhere, listed in the side: a title and their ids. */
    list: {
        title: string;
        ids: string[];
    } | null;
    playing: boolean;
    speed: number;
    dots: Dot[];
    badges: Badge[];
    /** The canvas's size in CSS px, and the device pixels to one. */
    w: number;
    h: number;
    dpr: number;
    root: ParentNode | null;
    private raf;
    private last;
    private sideT;
    constructor(o: InspectorOptions);
    /** An element of the panel, by its name (its id is the prefix and it). */
    el<T extends HTMLElement = HTMLElement>(name: string): T | null;
    html(): string;
    /** Wires the panel in root (where html() went) and runs it. */
    attach(root: ParentNode): void;
    /** The canvas, sized to its box (or taller, as the view asks: the box scrolls). */
    size(): void;
    /** Draws the view afresh (sized again if its box or its height changed). */
    draw(): void;
    /** Someone on the view, at x, y (CSS px), in their color: a ring if
     * they're picked, another if they're on the move. */
    dot(g: CanvasRenderingContext2D, x: number, y: number, col: string, id: string, moving?: boolean, r?: number): void;
    /** A box on the view to tap. */
    badge(b: Badge): void;
    /** A person's color now. */
    color(id: string): string;
    /** A tap at x, y (CSS px on the view): the nearest person within 9 px is
     * picked; else the view hears of it, with the box under it. */
    tap(x: number, y: number): void;
    /** The clock on (or back) by `min` game minutes; back no further than
     * Esper remembers (the nearest quarter hour after, said unless quiet). */
    step(min: number, quiet?: boolean): void;
    /** The bar: the clock's text, Play or Pause, and the game's own. */
    clock(): void;
    /** Picks someone (or nobody). */
    select(id: string | null): void;
    /** The side: someone's mind, a list, or the summary; not redrawn under
     * the pointer while it's being read, unless forced. */
    side(force?: boolean): void;
    /** Counts of everyone by kind, with their colors and words. */
    legend(n: Record<string, number>): string;
    summary(): string;
    /** Who's somewhere: a button each, in their color, with what they're doing. */
    listHtml(L: {
        title: string;
        ids: string[];
    }): string;
}
