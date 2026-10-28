import { type Box } from '../world/collide';
/** A random source: Tycho.seed's Rng, or anything shaped like it. */
export interface Stream {
    f(a?: number, b?: number): number;
    chance?(p: number): boolean;
}
/** A blow: how much, of what, from whom, and anything the game's stages read. */
export interface Blow {
    amount: number;
    /** What it's of: elements, kinds of harm (`blunt`, `cut`, `burn`...); null for none. */
    kinds?: readonly string[] | null;
    /** Who struck: a body, `'player'`, or nothing (a rockfall). */
    by?: unknown;
    /** The knock it gives, px/s, before the body's weight. */
    knock?: {
        x: number;
        y: number;
    } | null;
    /** A heavy blow staggers. */
    heavy?: boolean;
    /** Statuses it leaves (the `afflict` stage). */
    statuses?: readonly string[];
    [field: string]: unknown;
}
/** A blow landing on a body, as the stages see it; and, once it's landed, what came of it. */
export declare class Hit<B = any> {
    readonly pipe: Pipeline<B>;
    readonly to: B;
    readonly blow: Blow;
    /** The amount as it stands. */
    amount: number;
    /** The blow's kinds (or null). */
    readonly kinds: readonly string[] | null;
    /** The random source the game passed (all a stage draws, it draws from this). */
    readonly rng: Stream | null;
    /** Whatever else the game passed. */
    readonly ctx: any;
    /** What `resist` made of it: 'W' weak, 'R' resisted, or null. */
    verdict: string | null;
    /** A flat amount reactions add as `react` ends. */
    extra: number;
    /** Stopped: no stage after it ran. */
    stopped: boolean;
    /** Names to show: reactions fired, and anything a stage marks. */
    readonly marks: string[];
    /** The blows sent on from it (each a Hit, landed). */
    readonly follow: Hit[];
    /** The knock the body took (after its weight), if any. */
    knock: {
        x: number;
        y: number;
    } | null;
    /** Staggered (a heavy blow), or flinched out of a wind-up. */
    stagger: boolean;
    flinch: boolean;
    /** How long the body was held still (`hold`). */
    hold: number;
    constructor(pipe: Pipeline<B>, to: B, blow: Blow, rng: Stream | null, ctx: any);
    /** No stage after this one runs (the blow turned, soaked whole, the body gone). */
    stop(): void;
    /** A name to show over it. */
    mark(name: string): void;
    /** A blow sent on to another body (a shock that arcs, a chain that shares the hit), landed now through this pipeline or another, with the same random source and context. */
    send(to: unknown, blow: Blow, pipe?: Pipeline): Hit;
}
/** A stage: a function of the hit, or an object with a name and `land`. */
export type Stage<B = any> = ((h: Hit<B>) => void) | {
    name?: string;
    land(h: Hit<B>): void;
};
/** The hit: stages in the order the game lists them, each given the hit in turn until one stops it. */
export declare class Pipeline<B = any> {
    readonly stages: Stage<B>[];
    rng: Stream | null;
    ctx: any;
    constructor(stages: Stage<B>[], o?: {
        rng?: Stream | null;
        ctx?: unknown;
    });
    /** Lands a blow on a body: returns the hit, with what came of it. */
    land(to: B, blow: Blow, o?: {
        rng?: Stream | null;
        ctx?: unknown;
    }): Hit<B>;
}
/** Lets the blow through only while `open(h)` (a body that's gone, or out of reach, isn't struck). */
export declare function gate<B = any>(open: (h: Hit<B>) => boolean): Stage<B>;
/** The amount times what `by(h)` says (1 changes nothing). */
export declare function scale<B = any>(by: (h: Hit<B>) => number, name?: string): Stage<B>;
/**
 * Weak, resistant or neither, by kind: the amount times `of(body, kinds)`
 * (1 for a blow of no kind), and the verdict: 'W' over `weak` (1.01), 'R'
 * under `strong` (0.99), or `verdict(m)`. `shape(h, m)` has the last say on
 * the multiplier (a shell that stands in for a resistance) before it's
 * applied, once.
 */
export declare function resist<B = any>(o: {
    of: (body: B, kinds: readonly string[], h: Hit<B>) => number;
    verdict?: (m: number) => string | null;
    weak?: number;
    strong?: number;
    shape?: (h: Hit<B>, m: number) => number;
}): Stage<B>;
/** Armor: the amount times k / (k + armor), the body's armor from `of`. */
export declare function armor<B = any>(o: {
    k: number | (() => number);
    of: (body: B, h: Hit<B>) => number;
}): Stage<B>;
/** What armor lets through of a drain that isn't a blow (a burn, spores): x × k / (k + armor). */
export declare function armored(x: number, k: number, a: number): number;
/**
 * A shield takes the blow first: what's in the body's `field` (while it's
 * above 0, or while `when(h)`) soaks as much of the amount as it can;
 * `first(h)` runs as it does (what strikes a shield is struck back), and
 * `gone(body, h)` once it's spent.
 */
export declare function soak<B = any>(field: string, o?: {
    when?: (h: Hit<B>) => boolean;
    first?: (h: Hit<B>) => void;
    gone?: (body: B, h: Hit<B>) => void;
}): Stage<B>;
/** Which two kinds react, and as what: pairs by either order ('frost|force' and 'force|frost' alike). */
export declare class Reactions {
    private readonly map;
    constructor(pairs: Record<string, string>);
    /** What a and b make when they meet, or null. */
    of(a: string, b: string): string | null;
}
/**
 * Statuses that meet: a blow of two kinds reacts with itself, and each of its
 * kinds with every status of another kind the body carries (asked in the
 * order of `kinds`), each reaction once. Each one fired that's `ready` runs
 * its `do(h)`, which returns the amount's multiplier (or null: nothing for
 * it to do, and it doesn't count); it's marked and `fired` is told. Then the
 * amount is amount × the multipliers + `h.extra` (what reactions added flat).
 */
export declare function react<B = any>(o: {
    table: Reactions | ((a: string, b: string) => string | null);
    kinds: readonly string[];
    carries: (body: B, kind: string, h: Hit<B>) => boolean;
    do: Record<string, (h: Hit<B>) => number | null>;
    ready?: (body: B, id: string, h: Hit<B>) => boolean;
    fired?: (body: B, id: string, h: Hit<B>) => void;
    when?: (h: Hit<B>) => boolean;
}): Stage<B>;
/** The statuses the blow leaves (its `statuses`, and `of(kind)` for each of its kinds), each by its own stacking. */
export declare function afflict<B = any>(S: Statuses, o?: {
    of?: (kind: string, h: Hit<B>) => string | null;
    amount?: (id: string, h: Hit<B>) => number;
    scale?: (id: string, h: Hit<B>) => number;
}): Stage<B>;
/** Knockback: the blow's knock times the body's weight (`weight`, 1), added to its knock velocity (`vx`, `vy`: 'kvx', 'kvy'). */
export declare function knock<B = any>(o?: {
    weight?: (body: B, h: Hit<B>) => number;
    vx?: string;
    vy?: string;
}): Stage<B>;
/**
 * Stagger, flinch and steady. A heavy blow staggers a body that `can` be
 * (and is `open` to it now): its `state` to `into` ('stagger') for `heavy` s
 * (times the blow's `scale` field, if it has one). Else a body in its
 * wind-up (`windup`) struck for at least `flinch.share` of its health
 * (`flinch.of`: 'maxHp') breaks it off, staggered for `flinch.time`, once
 * every `flinch.gap` by `flinch.clock` (kept in `flinch.at`: 'flinchAt'). A
 * body `steady` shrugs off both.
 */
export declare function stagger<B = any>(o: {
    can?: (body: B, h: Hit<B>) => boolean;
    steady?: (body: B, h: Hit<B>) => boolean;
    open?: (body: B, h: Hit<B>) => boolean;
    state?: string;
    time?: string;
    into?: string;
    windup?: string;
    heavy: number | (() => number);
    scale?: string;
    flinch?: {
        share: number | (() => number);
        time: number | (() => number);
        gap: number | (() => number);
        clock: () => number;
        at?: string;
        of?: string;
    };
}): Stage<B>;
/** The struck body held still a moment as the blow lands: its `field` ('hitT') to at least `time` s (`heavy` for a heavy blow), if it `can` be. */
export declare function hold<B = any>(o: {
    field?: string;
    time: number | (() => number);
    heavy?: number | (() => number);
    can?: (body: B, h: Hit<B>) => boolean;
}): Stage<B>;
/**
 * A status: what a hit leaves on a body for a while. A timer is a number on
 * the body, the time left (a chill, an element's mark); a dose is an object
 * ({ t, and its amount a second in its `dose` field, n stacks, tick }), and
 * bites while it lasts (a burn, a poison). Where the body keeps it is the
 * game's: a field (`at`, by default the id) or a field's key (['st', 'frost']).
 */
export interface StatusDef {
    id: string;
    at?: string | readonly [string, string];
    /** A dose, and the name of its amount a second ('dps'); unset, a timer. */
    dose?: string;
    /** How long one lasts, s. */
    time?: number | (() => number);
    /** Its beat, s: a dose shows (and with `bite: 'beat'` bites) each beat. */
    every?: number | (() => number);
    /** A dose bites `steady` (amount × dt each step) or on its `beat` (amount × every). */
    bite?: 'steady' | 'beat';
    /**
     * Given again while it lasts: `max` the longer time (a timer); `set` the
     * time given; `count` one more (or n), back to none at `most` ('full');
     * `add` (a dose) one more stack to `most`, the amount added to `most`
     * times one, the longer time; `refresh` (a dose) a fresh one, its amount
     * the larger of the two; `keep` the one there.
     */
    stack?: 'max' | 'set' | 'count' | 'add' | 'refresh' | 'keep';
    most?: number | (() => number);
    /** How a timer wears off: `clamp` (down to 0 every step), `clear` (down while above 0; at 0, `ends`), `down` (down while above 0, past 0). */
    wear?: 'clamp' | 'clear' | 'down';
    ends?: (body: any) => void;
    /** How it spreads, by default (`spread`): r px round, measured to the other body's `edge` (r + its r) or its `middle`; `on: 'death'` for `died` (a hit's spreading, or at its most, is the game's to call). */
    spread?: {
        r: number | (() => number);
        reach?: 'edge' | 'middle';
        on?: 'death' | 'hit' | 'most';
    };
}
/** What a give did: put on fresh, again on one there, to its most, or full (a count run up and back to none). */
export type Given = 'new' | 'again' | 'most' | 'full' | 'kept';
export interface TickHooks<B = any> {
    /** Whether doses bite now (and count their beat). */
    bites?: (body: B, id: string) => boolean;
    /** A dose's bite: amount (amount a second × dt, or × every on a beat). */
    bite?: (body: B, id: string, amount: number, s: any) => void;
    /** A dose's beat (a number to show). */
    show?: (body: B, id: string, s: any) => void;
    /** After each dose: true stops the tick (the body fell). */
    after?: (body: B, id: string) => boolean | void;
}
export declare class Statuses {
    readonly defs: StatusDef[];
    private readonly byId;
    constructor(defs: readonly StatusDef[]);
    def(id: string): StatusDef;
    private slot;
    /** Its time left (a timer), its dose (or null), or undefined if the body keeps nothing for it. */
    get(body: any, id: string): any;
    /** Carried: a timer above 0, a dose there. */
    has(body: any, id: string): boolean;
    /** Puts it there as given (a time, a dose), whatever was there. */
    put(body: any, id: string, v: unknown): void;
    /** Gone: a timer to 0, a dose to null. */
    clear(body: any, id: string): void;
    /**
     * Gives it, by its stacking: `time` (its own, else the def's) times
     * `scale`; a dose's `amount` a second; `n` for a count. Returns what it did.
     */
    give(body: any, id: string, o?: {
        time?: number;
        scale?: number;
        amount?: number;
        n?: number;
    }): Given;
    /** Timers worn down by dt, each by its `wear` (doses wear in `tick`). */
    wear(body: any, dt: number): void;
    /**
     * Doses, each step: its time down by dt; while it `bites`, its bite and
     * its beat (every `every` s: `show`); gone once its time is out; then
     * `after`, which may stop the tick (the body fell).
     */
    tick<B = any>(body: B, dt: number, o?: TickHooks<B>): void;
    /**
     * Spreads what one body carries to others near (`to`): each that `who`
     * lets catch it, within `r` (the def's) of it, to its edge or middle, that
     * `take` agrees to (a weaker one, or none), gets `as(s, q)` (else a copy).
     * Returns how many caught it.
     */
    spread(from: any, id: string, to: Iterable<any>, o?: {
        r?: number;
        reach?: 'edge' | 'middle';
        who?: (q: any) => boolean;
        take?: (q: any, s: any) => boolean;
        as?: (s: any, q: any) => unknown;
    }): number;
    /** A body fell: everything it carries that spreads on a death, spread (`o` as for spread). */
    died(body: any, to: readonly any[], o?: Parameters<Statuses['spread']>[3]): void;
}
/** How a means is used: a move up close, a projectile, a spell, onto another means, into food or drink, set as a trap. */
export type Use = 'strike' | 'throw' | 'shoot' | 'cast' | 'coat' | 'dose' | 'set';
/** What using a means costs: a cooldown (s, or one a step of a combo), a charge, or an amount from a pool the game names. */
export interface Cost {
    cooldown?: number | readonly number[];
    charge?: number;
    pool?: string;
    amount?: number;
}
/**
 * A means, declared once for the player and the characters alike. Morgul
 * reads `id`, `kinds`, `use`, `severity` and `course` (off screen); Tycho
 * plays `move`, `blow`, `trigger` and `cost` (on screen). `uses`: how many
 * blows a coat lasts.
 */
export interface Means {
    id: string;
    kinds?: readonly string[];
    use: Use;
    severity?: number;
    course?: string;
    move?: MoveDef & Record<string, unknown>;
    blow?: Partial<Blow> & Record<string, unknown>;
    trigger?: TriggerDef;
    cost?: Cost;
    uses?: number;
    [field: string]: unknown;
}
/** A lookup of means by id. */
export declare class Arsenal {
    readonly list: Means[];
    private readonly byId;
    constructor(list: readonly Means[]);
    get(id: string): Means | undefined;
    has(id: string): boolean;
    /** The means used one way. */
    of(use: Use): Means[];
}
/** A lookup of the means given. */
export declare function means(list: readonly Means[]): Arsenal;
/** Its cooldown: the cost's, or a combo's step's (by step, round). */
export declare function cooldown(m: Means | undefined, step?: number): number;
/** What it costs in charge (or in its pool), if anything. */
export declare function costOf(m: Means | undefined): number;
/** Whoever holds a means: its cooldown counting down (`cd`), its charge. */
export interface Holder {
    cd?: number;
    charge?: number;
    coat?: {
        id: string;
        uses: number;
    } | null;
    [field: string]: unknown;
}
/** Ready to use: its cooldown out. */
export declare function ready(h: Holder): boolean;
/**
 * Uses it, if it can be: ready, and its cost there to pay (charge from the
 * holder, or an amount from `pools[cost.pool]`); pays it, and starts its
 * cooldown (times `scale`). False, and nothing changed, if it can't.
 */
export declare function use(m: Means, h: Holder, o?: {
    step?: number;
    scale?: number;
    pools?: Record<string, number>;
}): boolean;
/** Coats what a holder wields with a means (a poison on a blade): its blows carry it for `uses` (the means' own) blows. */
export declare function coat(h: Holder, m: Means, uses?: number): void;
/** The coat on it, if any is left. */
export declare function coatOf(h: Holder): {
    id: string;
    uses: number;
} | null;
/** A blow struck with it: one use of the coat spent; the coat's means' id, or null if none was on. */
export declare function spendCoat(h: Holder): string | null;
/**
 * Where a move strikes, from the body: `touch` (within the two bodies'
 * radii and this much more), `r` (within r of its middle, to the other's
 * edge), `ahead` (a line that far along its aim, `w` either side, to the
 * other's edge), or `cos` with `r` (within r, inside the angle whose cosine
 * that is, or as near as `close`).
 */
export type Area = {
    touch: number;
} | {
    r: number;
    cos?: number;
    close?: number;
} | {
    ahead: number;
    w: number;
};
/** The distance from px, py to the segment x0, y0 to x1, y1. */
export declare function segDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number;
/** Does a move's area from a body (x, y, its radius br, aim dx, dy) reach a target at tx, ty of radius tr? */
export declare function reaches(a: Area, x: number, y: number, br: number, dx: number, dy: number, tx: number, ty: number, tr: number): boolean;
/** A move: its phases' times (s), what the body's state field calls each, the area it strikes. */
export interface MoveDef {
    windup?: number | (() => number);
    active?: number | (() => number);
    recover?: number | (() => number);
    /** What the body's state is in each phase ('windup', 'strike', 'recover'). */
    names?: {
        windup?: string;
        active?: string;
        recover?: string;
    };
    /** The body's fields: its state ('state') and the time left in it ('t'). */
    state?: string;
    time?: string;
    /** Struck this swing: a field holding true for its one target ('hitDone'), else a list on the body ('struck'). */
    once?: string;
    area?: Area;
}
type Phase = 'windup' | 'active' | 'recover';
/**
 * A move on a body: into its wind-up (the tell), on to the strike (the
 * frames it can hit, each target once a swing) and the recovery (the
 * opening), each phase's name and time in the body's own fields. The game
 * counts the time down and says when to go on.
 */
export declare class Move {
    readonly def: MoveDef;
    private readonly S;
    private readonly Tm;
    private readonly order;
    constructor(def: MoveDef);
    name(p: Phase): string;
    /** The phase the body is in, or null. */
    phase(body: any): Phase | null;
    private enter;
    /** Into its first phase. */
    start(body: any): void;
    /** On to the next phase; null when the move is over (and nothing is written: what it does next is the game's). */
    next(body: any): Phase | null;
    /** Struck yet this swing (a target, or its one)? */
    struck(body: any, target?: unknown): boolean;
    /** Marks a target struck this swing. */
    mark(body: any, target?: unknown): void;
    /** In its area and not struck yet this swing: marks it struck and says true. */
    hits(body: any, target: unknown, tx: number, ty: number, tr: number, dx?: number, dy?: number): boolean;
}
/**
 * A zone: `r` round its place; a box, `w` by `h` on its place or x0, y0, x1,
 * y1 in the world; a line from x0, y0 to x1, y1 with `w` either side; or
 * tiles, `tiles(x, y)` (is the point on one).
 */
export type Zone = {
    r: number;
} | {
    w: number;
    h: number;
} | {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    w?: number;
} | {
    tiles: (x: number, y: number) => boolean;
};
/** Is a round body (x, y, radius r) in a zone placed at cx, cy? (A box zone is felt as Tycho.collide feels a round body against a box.) */
export declare function inZone(z: Zone, cx: number, cy: number, x: number, y: number, r: number): boolean;
/** A beat: on the step its tick runs out (`every`, its own field by default), true, and the next one begins. */
export declare function beat(s: {
    tick?: number;
    every?: number;
}, dt: number, every?: number): boolean;
/** A trigger's kind: its zone, its cycle (rest, then the tell, then it bites for `bite` s at the end of each `every`) or its mark (shown for `tell` s, then it bites once), whether it's set off once, hidden, and the blow it lands. */
export interface TriggerDef {
    zone?: Zone;
    cycle?: {
        every: number | (() => number);
        tell?: number | (() => number);
        bite?: number | (() => number);
    };
    tell?: number | (() => number);
    once?: boolean;
    hidden?: boolean;
    blow?: Partial<Blow> & Record<string, unknown>;
}
/** A trigger placed: the game's own object, with what the trigger keeps on it. */
export interface Placed {
    x?: number;
    y?: number;
    ph?: number;
    t?: number;
    by?: unknown;
    armed?: boolean;
    sprung?: boolean;
    fired?: boolean;
    last?: number;
    done?: boolean;
    [field: string]: unknown;
}
export declare class Trigger {
    readonly def: TriggerDef;
    constructor(def: TriggerDef);
    private every;
    /** Seconds into its cycle at `clock`, from its offset `ph` (a share of the cycle). */
    at(clock: number, ph?: number, every?: number): number;
    /** How far into its cycle, 0..1. */
    share(clock: number, ph?: number, every?: number): number;
    /** Its phase s seconds into the cycle: resting, telling (it shows), or biting. */
    phase(s: number, every?: number): 'rest' | 'tell' | 'bite';
    /** On the step its bite begins: true, once a cycle (kept as `fired`). */
    fires(p: Placed, clock: number, every?: number): boolean;
    /** On the step its cycle begins again: true (its last share kept as `last`). */
    wraps(p: Placed, clock: number, every?: number): boolean;
    /** A mark's tell counted down by dt: true once it's run out (that step and after). */
    down(p: Placed, dt: number): boolean;
    /** True once, the first time its tell has run out (kept as `done`). */
    goes(p: Placed): boolean;
    /** Is a round body in its zone (at the placed one's x, y)? */
    inside(p: Placed, x: number, y: number, r: number): boolean;
    /** Set off, by whoever: false if it's disarmed, or sprung already and set off only once; else it's sprung. */
    spring(p: Placed, by?: unknown): boolean;
}
/**
 * Traps set in a world of boxes (a snare on a path, a tripwire across a
 * door): each placed one's box (`box(p)`) in a Tycho.collide space, so a
 * body's box is asked once against all of them.
 */
export declare class Traps {
    readonly box: (p: Placed) => Box | null;
    readonly list: Placed[];
    private readonly space;
    private readonly boxOf;
    constructor(box: (p: Placed) => Box | null);
    add(p: Placed): Placed;
    remove(p: Placed): void;
    /** The first armed one a body's box overlaps, or null. */
    entered(x0: number, y0: number, x1: number, y1: number): Placed | null;
}
/**
 * The world held still as a hit lands: `freeze(t)` holds it at least t s,
 * unless the last began within `gap` s by `clock` (only a heavy hit can
 * freeze it again so soon, so a flurry doesn't stutter); `hold(dt)` each
 * step says whether it's still held. Kept on the game's object (`state`,
 * its fields `hitstop` and `frozeAt`).
 */
export declare class Hitstop {
    readonly state: {
        hitstop: number;
        frozeAt?: number;
        [k: string]: unknown;
    };
    private readonly gap;
    private readonly clock;
    constructor(o: {
        state: {
            hitstop: number;
            frozeAt?: number;
            [k: string]: unknown;
        };
        gap?: number | (() => number);
        clock: () => number;
    });
    freeze(t: number, heavy?: boolean): void;
    hold(dt: number): boolean;
}
/** Knockback fading: a body's knock velocity (`vx`, `vy`) moves it while it's over `min` (1), and fades by e^(-decay × dt). */
export declare class Knock {
    readonly decay: number | (() => number);
    readonly vx: string;
    readonly vy: string;
    readonly min: number;
    constructor(o: {
        decay: number | (() => number);
        vx?: string;
        vy?: string;
        min?: number;
    });
    /** The fade a step of dt. */
    fade(dt: number): number;
    /** Moves the body by its knock (`move(body, dx, dy)`) and fades it, if it's knocked; true if it was. `fade` from fade(dt), if worked out already. */
    step(body: any, dt: number, move: (body: any, dx: number, dy: number) => void, fade?: number): boolean;
    stop(body: any): void;
}
/** A flash: the body's `field` ('flash') set to t s, and if `col` is given, its color (`colField`: 'flashCol') to it, as it is. */
export declare function flash(body: any, t: number, o?: {
    col?: string | null;
    field?: string;
    colField?: string;
}): void;
/** A flash (or any timer kept to 0 and up) fading by dt. */
export declare function fade(body: any, dt: number, field?: string): void;
/** Numbers and words rising over what they're about: each moves up `speed` px/s and runs out (Tycho.fx's tick: `t` its time left), in place. */
export declare function rise<N extends {
    t: number;
    y: number;
}>(list: N[], dt: number, speed: number): N[];
/** A shake for games that want one: `kick(n)` to at least n, `step(dt)` dying away by e^(-decay × dt). On the game's object (`state.shake`). */
export declare class Shake {
    readonly state: {
        shake?: number;
        [k: string]: unknown;
    };
    readonly decay: number;
    constructor(state: {
        shake?: number;
        [k: string]: unknown;
    }, decay?: number);
    kick(n: number): void;
    step(dt: number): void;
}
/** A phase of a wound: how long (minutes, or [min, max] drawn from the game's rng), and what it marks while it lasts (`has`: 'shaky', 'limping'). */
export interface WoundPhase {
    id: string;
    minutes: number | readonly [number, number];
    has?: readonly string[];
}
/** A wound: its phases in order (shaped like Athelas's), and what happens given it again: `ignore`, `extend` (the phase runs as long again) or `restart`. */
export interface WoundDef {
    id: string;
    phases: readonly WoundPhase[];
    has?: readonly string[];
    again?: 'ignore' | 'extend' | 'restart';
}
/** The wounds' state, plain JSON for the game's save: the clock (minutes), and each open wound's phase and its end. */
export interface WoundsState {
    now: number;
    on: Record<string, {
        p: number;
        since: number;
        until: number;
    }>;
}
export interface WoundEvent {
    id: string;
    phase: string | null;
    healed: boolean;
    at: number;
}
/**
 * The player's wounds: conditions on the game's clock in game minutes, in
 * phases. `give` opens one, `step` moves the clock on by minutes (each phase
 * that ends in that time goes on to the next, the last heals), `has` asks
 * for a wound, a phase or a mark. All draws from the rng the game passes.
 */
export declare class Wounds {
    readonly defs: Map<string, WoundDef>;
    constructor(defs: readonly WoundDef[]);
    fresh(now?: number): WoundsState;
    private def;
    private minutes;
    /** Opens a wound now; false if it's open already and given again is `ignore`. */
    give(s: WoundsState, id: string, rng?: Stream | null): boolean;
    /** Moves the clock on by minutes: phases end in the order they're due, the last of a wound heals it. Returns what changed. */
    step(s: WoundsState, minutes: number, rng?: Stream | null): WoundEvent[];
    /** Has a wound open (by its id), is in a phase (by its id), or carries a mark (a phase's or the wound's `has`)? */
    has(s: WoundsState, what: string): boolean;
    /** The wounds open: each one's phase and minutes left. */
    of(s: WoundsState): {
        id: string;
        phase: string;
        left: number;
    }[];
    /** Heals one wound, or all. */
    heal(s: WoundsState, id?: string): void;
}
export {};
