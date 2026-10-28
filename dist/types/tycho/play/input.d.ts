/** The thumb on the stick: where it landed (x0, y0, at t0 ms), the stick's
 * base (bx, by: where it landed, or moved in to keep the stick inside its
 * zone) and where it is now (x, y), in CSS px. */
export interface StickState {
    id: number;
    bx: number;
    by: number;
    x: number;
    y: number;
    t0: number;
    x0: number;
    y0: number;
    flicked: boolean;
}
export interface StickOptions {
    /** How far the thumb goes for full tilt, in CSS px. */
    radius: number;
    /** A round dead zone in the middle (CSS px): inside it no tilt, and past
     * the radius the tilt is one, the direction kept. */
    dead?: number;
    /** Or a dead zone on each axis, a share of the radius ([x, y]): the
     * thumb's offset is held to a square the radius across, and an axis reads
     * nothing until it's past its share. */
    deadAxes?: [number, number];
    /** Keep the whole stick inside its zone: the base sits at least the
     * radius in from the zone's edges. */
    inside?: boolean;
    /** A second thumb landing in the zone takes the stick over (otherwise the
     * first keeps it till it lifts). */
    retake?: boolean;
    /** A quick flick as the thumb lands presses `action`, with the flick's
     * direction ({ x, y }, of length one): moved more than `px` within `ms`
     * of landing. (Read as it's needed, so it may be an object of getters.) */
    flick?: {
        action: string;
        ms: number;
        px: number;
    };
    /** Called whenever the stick changes (landed, moved, lifted, let go), to
     * draw it: the thumb, or null. */
    onChange?: (stick: StickState | null) => void;
}
export interface ControlsOptions {
    /** A key's code (KeyboardEvent.code) to the action it holds. */
    keys?: Record<string, string>;
    /** The actions the keys move with, when the stick isn't held: each axis is
     * -1, 0 or 1, both scaled to length one if `round` (so a diagonal isn't
     * quicker), and scaled by `slow`'s factors while its action is held. */
    axes?: {
        left: string;
        right: string;
        up: string;
        down: string;
        round?: boolean;
        slow?: {
            action: string;
            x?: number;
            y?: number;
        };
    };
    /** Actions whose press waits until the game takes it (take()): pressed by
     * a key going down, a button or tap landing, or a flick. */
    presses?: string[];
    /** Actions whose press and release since the game last looked are kept
     * (edges()), worked out each update(). */
    edges?: string[];
    stick?: StickOptions;
    /** The bot's fields: its axes (`x`, `y`, by default those names), the
     * actions it holds (`held`: an action to the field it's read from; by
     * default each action's own name), and the presses it makes (`press`: an
     * action to the field; a press taken clears it there; actions not named
     * take the real presses even while a bot drives). */
    bot?: {
        x?: string;
        y?: string;
        held?: Record<string, string>;
        press?: Record<string, string>;
    };
    /** While true, nothing new is pressed: the stick and the buttons ignore
     * thumbs landing, and keys press nothing (a key held is still held). */
    blocked?: () => boolean;
    /** Seconds the guard lasts (guard()). */
    guard?: number;
    /** The clock the guard is measured by, in seconds (by default the page's). */
    clock?: () => number;
    /** The clock a flick is timed by, in ms (by default performance.now). */
    now?: () => number;
}
export interface ListenOptions {
    /** Where keys are heard (window by default; null for none). */
    keyboard?: EventTarget | null;
    /** The stick's zone. */
    stick?: HTMLElement | null;
    /** On-screen buttons, each holding an action while a pointer is down on
     * it (the last pointer down holds it; it's let go when that one lifts). */
    buttons?: Record<string, HTMLElement>;
    /** On-screen buttons that only press an action as a pointer lands. */
    taps?: Record<string, HTMLElement>;
    /** The class a held button wears ('held' by default). */
    heldClass?: string;
    /** Codes whose default is stopped as the key goes down (unless blocked):
     * by default every code in `keys`. */
    prevent?: string[];
    /** Stop the default as those keys come up too. */
    preventUp?: boolean;
    /** Called when a thumb lands on the stick or a button. */
    onTouch?: () => void;
}
export interface Edge {
    down: boolean;
    pressed: boolean;
    released: boolean;
}
type Bot = Record<string, unknown>;
/** The controls: what's held, the presses waiting, the edges, the stick and
 * the axes (`move`), and the bot. Fed by listen() on a page, or by keyDown,
 * stickDown and the rest directly. */
export declare class Controls {
    o: ControlsOptions;
    /** The axes, -1..1 each: the bot's, the stick's or the keys', worked out by
     * update(). The game may write them (a scene walking the player) until the
     * next update() writes over them. */
    move: {
        x: number;
        y: number;
    };
    /** The thumb on the stick, or null. */
    stick: StickState | null;
    /** A test's controls, read over the real ones by the names in `o.bot`. */
    bot: Bot | null;
    /** Presses waiting to be taken: true, or what pressed it (a flick's
     * direction); false or missing for none. */
    presses: Record<string, unknown>;
    /** The codes of the action keys down now. */
    keys: Set<string>;
    /** The pointer holding each on-screen button, or null. */
    holders: Record<string, number | null>;
    private edgeOf;
    private els;
    private heldClass;
    private guardAt;
    private guardFor;
    constructor(o?: ControlsOptions);
    /** Is an action held: by the bot when one drives, else by a button or a key. */
    held(action: string): boolean;
    /** Is something blocking new presses now? */
    isBlocked(): boolean;
    /** Presses an action: it waits, with `value`, until taken. */
    press(action: string, value?: unknown): void;
    /** The press waiting for an action (true, or its value), cleared; false if
     * none. A bot that presses the action is read instead (and cleared). */
    take(action: string): unknown;
    /** An action's state for the game to read: held now, and pressed or
     * released since it last looked (reading clears those). For the actions
     * in `o.edges`. */
    edges(action: string): Edge;
    /** Each step, before the game reads the controls: the edges, then the axes
     * (the bot's, else the stick's while a thumb is on it, else the keys'). */
    update(): void;
    /** A screen opened (or closed): every thumb and key held lets go, and the
     * presses and edges waiting are dropped, so nothing carries over. The
     * axes are left for the next update(). */
    block(): void;
    /** Starts the guard: guarded() is true for `seconds` (o.guard by default). */
    guard(seconds?: number): void;
    /** Is the guard up (a tap now shouldn't count)? */
    guarded(): boolean;
    /** A key went down: true if it holds an action. A repeat does nothing. */
    keyDown(code: string, repeat?: boolean): boolean;
    keyUp(code: string): void;
    /** Every key let go (the page lost focus). */
    keysOff(): void;
    /** A thumb landed in the stick's zone (`zone`, its box, for `inside`):
     * true if it took the stick. */
    stickDown(id: number, x: number, y: number, zone?: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    } | null): boolean;
    stickMove(id: number, x: number, y: number): void;
    stickUp(id: number): void;
    /** A pointer landed on a button holding `action`: true if it took it. */
    buttonDown(action: string, id: number): boolean;
    buttonUp(action: string, id: number): void;
    /** Wires the controls to the page. Returns a function that unwires them. */
    listen(L?: ListenOptions): () => void;
    private botField;
    private clock;
    private nowMs;
}
export interface GestureOptions {
    /** One pointer dragged by (dx, dy). */
    onPan?: (dx: number, dy: number) => void;
    /** Two pointers moved: the zoom (the new distance between them over the
     * old; null when they were closer than `pinchMin`), about (x, y), their
     * middle now; and how far the middle moved (dx, dy; zero unless
     * `pinchPan`). */
    onPinch?: (k: number | null, x: number, y: number, dx: number, dy: number) => void;
    /** A tap at (x, y). */
    onTap?: (x: number, y: number) => void;
    /** A lift is a tap if the pointers have moved less than this, all told,
     * since one last landed (a pinch counts as far). */
    travel?: number;
    /** Or a tap is a lone pointer lifted within `near` of where it landed
     * (and within `ms` of landing, if given). */
    near?: number | (() => number);
    ms?: number;
    /** Two pointers moving together pan as well as pinch. */
    pinchPan?: boolean;
    /** Pointers closer than this don't zoom (0: any distance but none). */
    pinchMin?: number;
    /** The clock a tap is timed by, in ms (by default performance.now). */
    now?: () => number;
}
/** Drag, pinch and tap for a map view, from pointers' positions (in whatever
 * units the game feeds: the thresholds are in the same). One or two pointers
 * move the view; more do nothing until they're two again. */
export declare class Gestures {
    o: GestureOptions;
    /** The pointers down: id to where each is. */
    pts: Map<number, {
        x: number;
        y: number;
    }>;
    /** How far the pointers have moved since one last landed. */
    moved: number;
    /** A lone pointer that may be a tap: where and when it landed. */
    tap: {
        x: number;
        y: number;
        t: number;
    } | null;
    constructor(o?: GestureOptions);
    down(id: number, x: number, y: number): void;
    move(id: number, x: number, y: number): void;
    /** A pointer lifted (or cancelled: never a tap). */
    up(id: number, x: number, y: number, cancel?: boolean): void;
    /** Wires a view's element to it: `at(e)` gives a pointer's position (by
     * default its client x and y). Returns a function that unwires it. */
    listen(el: HTMLElement, at?: (e: PointerEvent) => [number, number], opt?: {
        prevent?: boolean;
    }): () => void;
    private nearPx;
    private now;
}
export {};
