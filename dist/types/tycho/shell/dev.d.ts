/** Is `name` a flag in the address (?name or &name)? */
export declare function query(name: string, search?: string): boolean;
/** A set of dev switches: `s` holds them (over `defaults`), `load()` reads
 * them (and, with ?dev in the address, remembers that they're shown),
 * `save()` keeps them, `shown()` says whether the dev settings show. */
export declare class Flags<S extends Record<string, unknown> = Record<string, unknown>> {
    key: string;
    s: S & {
        shown?: boolean;
    };
    constructor(key: string, defaults: S);
    load(): this;
    save(): void;
    shown(): boolean;
}
/** Something that happened, as the events show it. `impact` (0 to 1, how
 * much it matters to the story of the place) is room for the events by
 * impact (docs/events.md): shown when an event has one. */
export interface DevEvent {
    t: number;
    kind: string;
    text: string;
    who?: string | string[];
    place?: string;
    impact?: number;
    html?: boolean;
    data?: unknown;
}
export interface NotesOptions {
    /** Kept, newest first (600). */
    most?: number;
    /** A note's time (else seconds since the page opened). */
    clock?: () => number;
}
/** A log any game can write to (a game without a drawer too): `note(kind,
 * text)` from anywhere; the newest first in `list`, the last `most` kept;
 * nothing's noted while `paused`. `count` rises with every note. */
export declare class Notes {
    o: NotesOptions;
    list: DevEvent[];
    paused: boolean;
    count: number;
    constructor(o?: NotesOptions);
    note(kind: string, text: string, more?: Partial<DevEvent>): DevEvent | null;
    clear(): void;
    /** Drops what's later than t (the clock went back). */
    rewind(t: number): void;
}
export interface StepperOptions {
    /** The setting it changes (data-<prefix>set): what the drawer's `set` hears. */
    key: string;
    value: number | string;
    label?: string;
    /** The values to step through, in order; else numbers by `step` (1, or
     * several steps, each its own pair of buttons, the biggest outermost),
     * between min and max, or round them with `wrap`. */
    values?: (number | string)[];
    step?: number | number[];
    min?: number;
    max?: number;
    wrap?: boolean;
    /** Its default: off it, it's marked, with a button back (else the
     * drawer's `play` table's, if it's there). */
    def?: unknown;
    /** The value as words, and a step's (for several steps). */
    fmt?(v: number | string): string;
    stepWord?(s: number): string;
    title?: string;
}
export interface ToggleOptions {
    key: string;
    on: boolean;
    label: string;
    title?: string;
    def?: boolean;
}
export interface ChoiceOptions {
    key: string;
    value: unknown;
    options: (unknown | [unknown, string])[];
    label?: string;
    def?: unknown;
}
export interface ButtonOptions {
    arg?: string;
    title?: string;
    on?: boolean;
    disabled?: boolean;
    cls?: string;
}
/** The small pieces of HTML a dev tab is made of, with their prefix. Bars,
 * a grid of bars, sections, lines, hints, rows of chips, tables, buttons
 * (data-<prefix>act), links to someone (data-<prefix>sel), and the controls
 * that change a setting (data-<prefix>set with its new value in
 * data-<prefix>to): steppers (never sliders: a thumb scrolling past can't
 * move one), toggles and choices, each marked while it's off its default. */
export declare class Bits {
    readonly P: string;
    /** Each setting's default where one's known (steppers, toggles and
     * choices off theirs are marked): the drawer fills it from its `play`. */
    defaults: Record<string, unknown>;
    constructor(prefix?: string);
    esc(t: unknown): string;
    attr(t: unknown): string;
    /** A number to d places, or – if it isn't one. */
    num(v: unknown, d?: number): string;
    /** Is v off its default (def, or the known one)? */
    off(key: string, v: unknown, def?: unknown): boolean;
    /** A bar 0..max (1): warm over 0.4 and hot over 0.7 if `hot`, or a color. */
    bar(v: number, o?: {
        hot?: boolean;
        color?: string;
        max?: number;
    }): string;
    /** A grid of bars: each row its label, its bar and its number (or text). */
    bars(rows: [string, number, {
        hot?: boolean;
        color?: string;
        max?: number;
        text?: string;
    }?][]): string;
    section(title: string, small?: string): string;
    kv(html: string): string;
    hint(html: string): string;
    chips(html: string): string;
    /** A table: its heads, and rows of cells (HTML), each row with a class if
     * it's given as { cells, cls }; the columns in `nums` are numbers. */
    table(heads: string[], rows: (string[] | {
        cells: string[];
        cls?: string;
    })[], o?: {
        nums?: number[];
    }): string;
    /** A button that runs one of the drawer's acts, with its argument. */
    button(act: string, label: string, o?: ButtonOptions): string;
    /** Someone's name, a link that picks them. */
    who(id: string, label: string): string;
    private setter;
    /** A stepper: − value + (or several steps a side), and ↺ back to its
     * default when it's off it. */
    stepper(o: StepperOptions): string;
    /** A switch: a button that turns a setting on or off. */
    toggle(o: ToggleOptions): string;
    /** One of a few values: a button each, the one in force marked. */
    choice(o: ChoiceOptions): string;
}
/** A tab: its body's HTML, how often it's drawn again while it's showing
 * (seconds; 0 only when something's done in it), and what to wire after
 * each draw. `events: true` makes it the drawer's own events. */
export interface DevTab {
    id: string;
    label?: string;
    html?(d: Drawer): string;
    every?: number;
    bind?(body: HTMLElement, d: Drawer): void;
    events?: boolean;
}
/** A switch for something drawn over the game: a checkbox, or a choice of
 * `options` (the first meaning off). */
export interface DevOverlay {
    id: string;
    label?: string;
    on?: boolean | string;
    options?: string[];
    title?: string;
}
/** A setting that changes play, with its default (read from the flags, or
 * by get()): while any is off its default, the tag says so. */
export interface PlaySetting {
    key: string;
    def: unknown;
    word?(v: unknown): string;
    get?(): unknown;
}
export interface EventsOptions {
    /** Kept (600) and shown (250). */
    most?: number;
    shown?: number;
    /** The kinds' chips in order (others after, as they come), and kinds left
     * out of "all" (each shown when its chip is picked). */
    kinds?: string[];
    apart?: string[];
    /** A note's time, and a time as words. */
    clock?(): number;
    when?(t: number): string;
    /** More events from elsewhere (Tyrell's log), merged in by time: oldest
     * first is cheapest. Called only while the events show. */
    from?(): DevEvent[];
    /** Each kind's color, and the words are HTML (else text). */
    colors?: Record<string, string>;
    html?: boolean;
    /** A line beside the filters, by the filter. */
    hint?(filter: string, d: Drawer): string;
    /** A box to find words in them. */
    find?: boolean;
}
export interface DrawerOptions {
    /** Where its own state is kept (open or not, the tab, the overlays, the
     * filters: flags.s[keep], 'drawer'); flags.shown() lets it open, unless
     * `always`. */
    flags: Flags;
    keep?: string;
    always?: boolean;
    /** Every class and id carries it ('dev'): #dev, .dev-body, data-devact. */
    prefix?: string;
    title?: string;
    tabs: DevTab[];
    overlays?: DevOverlay[];
    /** Overlays stay on while the drawer's closed (else only while it's open). */
    keepOverlays?: boolean;
    events?: EventsOptions;
    /** The settings that change play, with their defaults: a tag on screen
     * while any is off its default, which opens the drawer at `tagTab`. */
    play?: PlaySetting[];
    tagTab?: string;
    /** Docked at the left (the default) or the right; a bottom sheet on a
     * screen held upright. */
    side?: 'left' | 'right';
    /** Where its elements go (document.body). */
    parent?(): HTMLElement | null;
    /** The keys that open and close it (` and ~), never while typing. */
    keys?: string[] | false;
    /** A button that opens and closes it: the game's own element (shown only
     * when it may open), or true for one of the drawer's own. */
    button?: HTMLElement | (() => HTMLElement | null) | boolean;
    /** The header's line (HTML), else the frame rate and the frame times. */
    frame?(d: Drawer): string;
    /** Seconds between the header's refreshes, and a tab's by default (0.4). */
    every?: number;
    /** A setting changed (data-<prefix>set): else flags.s[key] = value, saved. */
    set?(key: string, value: unknown, d: Drawer): void;
    /** The acts (data-<prefix>act, with data-<prefix>arg; and a mind's
     * data-<prefix>do, with whoever's picked); false leaves the tab as it is. */
    acts?: Record<string, (arg: string | null | undefined, el: HTMLElement, d: Drawer) => boolean | void>;
    /** The game's own data attributes in the drawer, by name: clicks, changes
     * and typing. */
    click?: Record<string, (value: string, el: HTMLElement, e: Event, d: Drawer) => void>;
    change?: Record<string, (value: string, el: HTMLElement, e: Event, d: Drawer) => void>;
    input?: Record<string, (value: string, el: HTMLElement, e: Event, d: Drawer) => void>;
    /** While open, a tap on the game (anywhere outside the drawer) asks who's
     * there (x, y in CSS px): someone found is picked, and the tap goes no
     * further. */
    pick?(x: number, y: number, e: Event): string | null | undefined;
    /** The tab picking someone opens, by a tap or a link (else it stays). */
    selectTab?: string;
    onSelect?(id: string | null, d: Drawer): void;
    onOpen?(d: Drawer): void;
    onClose?(d: Drawer): void;
    onTab?(id: string, d: Drawer): void;
    /** A canvas over the game for the overlays (`layer()`). */
    layer?: boolean;
    /** The drawer's own look, put in the page (true). */
    style?: boolean;
    /** A class on the page's body while it's open (<prefix>-on). */
    bodyClass?: string;
    /** Its label for screen readers. */
    label?: string;
    /** Frame rates smoothed by this much a frame (0.05). */
    smooth?: number;
}
interface DrawerState {
    open?: boolean;
    tab?: string;
    ov: Record<string, boolean | string>;
    filter: string;
    find: string;
    least: number;
}
/** The dev drawer. Made when the game's scripts load; `start()` once the page
 * is ready (after the flags are loaded); `frame(dt)` every frame, with the
 * real seconds since the last. */
export declare class Drawer extends Bits {
    o: DrawerOptions;
    flags: Flags;
    tabs: DevTab[];
    notes: Notes;
    /** Open now. */
    on: boolean;
    /** Whoever's picked (the game's id). */
    sel: string | null;
    /** Frames a second, smoothed; and the game's frame times (ms, smoothed). */
    fps: number;
    times: Record<string, number>;
    root: HTMLElement | null;
    body: HTMLElement | null;
    /** How much of the screen it covers now (CSS px), at each side. */
    cover: {
        left: number;
        right: number;
        bottom: number;
    };
    private started;
    private headT;
    private bodyT;
    private downs;
    private scrolled;
    private typed;
    private opened;
    private sig;
    private frozen;
    private clearedAt;
    private tagEl;
    private tagText;
    private btn;
    private cv;
    private cg;
    private layerOn;
    private ovs;
    constructor(o: DrawerOptions);
    /** Its own state (kept in the flags): open, tab, overlays, filter, find. */
    get st(): DrawerState;
    save(): void;
    /** May it open (?dev, or once shown; or always)? */
    get allowed(): boolean;
    /** The tab showing. */
    current(): DevTab | undefined;
    /** A tab added (at index `at`, else at the end). */
    addTab(t: DevTab, at?: number): void;
    /** Wires the key, the button, the tag and picking, and opens it again if it was open. */
    start(): this;
    private make;
    /** Its elements, made once (and the tabs again, `again`). */
    private build;
    private tabsHtml;
    open(tab?: string): void;
    close(): void;
    toggleOpen(force?: boolean): void;
    /** Shows a tab (from the top). */
    show(id: string): void;
    /** Where it sits, as CSS variables on the page (--<prefix>-left, -right,
     * -bottom, px) for the game's own layout, and in `cover`. */
    private measure;
    /** How much of the screen it covers (CSS px) on each side: nothing while closed. */
    covered(): {
        left: number;
        right: number;
        bottom: number;
    };
    /** Every frame, with the real seconds since the last: the frame rate, the
     * tag, and while it's open the header and the tab when they're due. */
    frame(dt: number): void;
    /** A frame time the game measured (ms), smoothed (by k, 0.1). */
    time(name: string, ms: number, k?: number): void;
    /** The default header line: the frame rate and the frame times. */
    frameText(): string;
    /** The header: which tab, the frame line, the overlays' switches. */
    head(): void;
    /** Draws the tab again: always if `full` (something was done), else only
     * if it's due and nobody's in the middle of using it (a finger down, a
     * scroll just now, a choice open); `reset` goes back to the top. */
    refresh(full?: boolean, reset?: boolean): void;
    /** Is someone in the middle of using it? */
    holding(): boolean;
    private keyOf;
    private keyed;
    private draw;
    private data;
    private near;
    private click;
    private typing;
    /** A setting changed: the game's `set`, or the flags; then the tab again. */
    set(key: string, value: unknown): void;
    /** A setting written to the flags and kept. */
    store(key: string, value: unknown): void;
    /** Picks someone (or nobody): to `tab`, if one's given. */
    select(id: string | null, tab?: string): void;
    /** An overlay's value while it shows (the drawer open, or keepOverlays):
     * true, or a choice's value; false when it's off. */
    overlay(id: string): boolean | string;
    /** Is any overlay showing? */
    overlays(): boolean;
    /** The canvas over the game for this frame's overlays, cleared and scaled
     * to CSS px, while any overlay shows; else null (and it's cleared away). */
    layer(): {
        g: CanvasRenderingContext2D;
        w: number;
        h: number;
    } | null;
    /** The settings that change play and are off their defaults, in words. */
    offPlay(): string[];
    /** The tag: on screen while any setting that changes play is off its default. */
    tag(force?: boolean): void;
    /** Something that happened, for the events. */
    note(kind: string, text: string, more?: Partial<DevEvent>): DevEvent | null;
    private fromList;
    private evSig;
    /** Every event, newest first: the notes and what `from` gives, merged by time. */
    evAll(): DevEvent[];
    /** The events: a chip a kind (with its count), pause and clear, the find
     * box, then the list, newest first. */
    eventsHtml(): string;
}
/** The drawer's own look, for a prefix: compact, dark and monospace (with a
 * mind from Tycho.inspect.mind, of the same prefix, styled to match). Its
 * colors are CSS variables on the drawer (--dv-bg, --dv-fg, --dv-dim,
 * --dv-line, --dv-hi, --dv-acc, --dv-up, --dv-down, --dv-btn) and its width
 * --dv-w. Put first in the page's head by the drawer (unless `style: false`),
 * so the game's own CSS overrides it. */
export declare function drawerCss(P?: string): string;
export {};
