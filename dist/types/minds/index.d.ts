/** The bridge's version (Tycho's). */
export declare const VERSION: string;
/** What someone is doing, as Tyrell keeps it (its Doing). */
export interface DoingLike {
    kind: 'act' | 'travel' | 'wait';
    action: string;
    place: string | null;
    start: number;
    end: number;
    from?: string | null;
    to?: string | null;
}
/** A person, as Tyrell keeps them (its PersonState). */
export interface PersonLike {
    id: string;
    status: 'active' | 'away' | 'gone';
    place: string | null;
    doing: DoingLike | null;
    last?: string;
}
/** The world: the few calls the bridge makes on a Tyrell World. */
export interface WorldLike {
    readonly now: number;
    s: {
        v: number;
        [k: string]: unknown;
    };
    esper: {
        earliest(): number;
    };
    advanceTo(t: number): void;
    load(data: unknown): void;
    get(id: string): PersonLike | undefined | null;
    on(kind: string, fn: (data: any) => void): unknown;
    /** A fact of the world's (read, or set: an input). */
    fact?(key: string, value?: unknown): unknown;
    /** How many of an item someone has (their own, and their household's). */
    have?(p: PersonLike, item: string): number;
    /** Harm, when it's on (the Morgul module). */
    morgul?: MorgulLike;
    /** What passes between people, when it's on (the Bree module). */
    bree?: BreeLike;
}
type Get<T> = () => T;
/** Game minutes from a day number and an hour of the day (Tyrell's time is minutes). */
export declare function minutes(day: number, hour: number): number;
/** The hour of the day (0 to 24) at a time in minutes, before midnight too. */
export declare function hourOf(t: number): number;
/** How far along something running from start to end is at now, 0 to 1. */
export declare function progress(d: {
    start: number;
    end: number;
}, now: number): number;
export interface ClockOptions {
    /** The world now (a getter, since the game may make a new one). */
    world: Get<WorldLike | null | undefined>;
    /** The game's clock, in minutes. */
    minutes: Get<number>;
    /**
     * Called for a time further back than Esper remembers, to make the world
     * over from that moment. Without it the world is only ever run forward.
     */
    remake?: (t: number) => void;
    /**
     * Whether a game time behind the world's walks the world back (true, the
     * default: Esper's time walk). False for a game with time walk off: a time
     * behind the world's is left, and the world waits for the game to catch up.
     */
    back?: boolean;
    /** How close counts as the same moment (minutes; 1e-6). */
    eps?: number;
}
/** What a clock's sync did. */
export type Synced = 'off' | 'same' | 'ran' | 'remade';
/**
 * The game's clock driving the minds': each sync runs the world to the
 * game's time, forward, or back through Esper's time walk (Tyrell's
 * advanceTo seeks back), and further back than Esper remembers, remakes it.
 */
export declare function clock(o: ClockOptions): {
    sync(): Synced;
};
/** What goes in the game's save: Tyrell's save shape, with anything of the game's beside it. */
export interface Stash {
    tyrell: 'world';
    v: number;
    s: unknown;
    [k: string]: unknown;
}
/**
 * The minds as they are, for the game's save: the state itself (not a copy:
 * the save writes it out), with the game's own fields (a population size, a
 * version of its own) beside it, which restore can check.
 */
export declare function stash(world: WorldLike, extra?: Record<string, unknown>): Stash;
export interface RestoreOptions {
    /** Whether a saved world is one this game can use (the same people, say). */
    accept?: (saved: Stash) => boolean;
    /** Where to run a world that wasn't restored to (a new world runs to now). */
    now?: number;
    /** Told when a saved world couldn't be read (it's started over all the same). */
    onError?: (e: unknown) => void;
}
/**
 * Reads the minds back from the save into a world just made: true if they
 * were. A saved world this game won't take (accept), or one Tyrell can't
 * read, leaves the new world, run to now if given.
 */
export declare function restore(world: WorldLike, saved: unknown, o?: RestoreOptions): boolean;
/**
 * Seats at places, handed out so nobody sits in anybody: someone doing an
 * action at a place with several seats for it keeps one while they're doing
 * that there. A seat is asked for with the one they'd pick (a hash of who
 * they are, say) and they get the first free one from it. A seat comes free
 * when its sitter is somewhere else, traveling, or doing something else.
 */
export declare class Seats {
    private world;
    private m;
    constructor(world: Get<WorldLike | null | undefined>);
    /** The seat (0 to n-1) for id doing act at place since start, given n seats and the one they'd pick first. */
    take(id: string, place: string, act: string, start: number, n: number, first: number): number;
    /** Everyone stands up (a new world). */
    clear(): void;
}
/**
 * Whether someone might be in a region (a level, a room, a part of the map)
 * without working out where they are: the regions a doing can touch are
 * worked out once per doing (a walk, every region its route passes; staying
 * put, the place's), by the game's regions(), and kept until they're doing
 * something else.
 */
export declare class Presence {
    private world;
    private regions;
    private c;
    constructor(world: Get<WorldLike | null | undefined>, regions: (p: PersonLike) => Iterable<string>);
    /** Whether id might be in region now (false for anyone not about). */
    may(id: string, region: string): boolean;
    /** Forgets every doing (a new world). */
    clear(): void;
}
/**
 * A travel time between two places (Tyrell's shell.travel), worked out once
 * a pair by the game's own route and kept: 0 from a place to itself.
 */
export declare function travelTimes(f: (a: string, b: string) => number): ((a: string, b: string) => number) & {
    clear(): void;
};
export interface WitnessOptions<T> {
    /** Indoors, everyone in the room sees (true), whatever the distance. */
    room?: boolean;
    /** Out in the open, how far off sight reaches: [across, up and down]. */
    reach?: [number, number];
    /** Who can see at all (not someone hidden, say). */
    can?: (n: T) => boolean;
    /** Who's nearest, for the order: the distance across by default. */
    far?: (n: T, at: {
        x: number;
        y: number;
    }) => number;
}
/**
 * Who sees something done at a spot, nearest first: in a room, everyone in
 * it; in the open, whoever's within reach (a box, across and up and down).
 * The game then tells Tyrell what they saw (world.sense).
 */
export declare function witnesses<T extends {
    x: number;
    y: number;
}>(at: {
    x: number;
    y: number;
}, people: T[], o?: WitnessOptions<T>): T[];
/**
 * Collects what the world emits of one kind (Wormtongue's 'report') that the
 * game must act on later, in the game's own time: take() hands them over
 * and empties the list. Only those keep() passes are kept (the ones about
 * the player, say).
 */
export declare function collect<T = any>(world: WorldLike, kind: string, keep?: (data: T) => boolean): {
    list: T[];
    take(): T[];
};
/** A means as both halves read it: Tycho.harm's Means, Morgul's MeansDef. */
export interface MeansLike {
    id: string;
    kinds?: readonly string[];
    use?: string;
    severity?: number;
    course?: string;
    /** For a means set as a trap: how many it catches (Morgul's uses); Tycho.harm's for a coat. */
    uses?: number;
    /** A trap's chance to catch someone off screen (Morgul's catch). */
    catch?: number;
    trigger?: {
        hidden?: boolean;
        once?: boolean;
        [k: string]: unknown;
    };
    [field: string]: unknown;
}
/** A harm, as Morgul takes it (its Harm). */
export interface HarmLike {
    to: string;
    by?: string | null;
    kind?: string;
    severity?: number;
    via?: string;
    intent?: string;
    cause?: string;
    what?: string;
    place?: string | null;
    seenBy?: string[];
    course?: string;
}
/** A harm as Morgul tells it (its HarmView): with the wound it left and how hurt the one struck is. */
export interface HarmViewLike {
    id: number;
    t: number;
    to: string;
    by: string | null;
    kind: string;
    severity: number;
    via: string;
    hurt: number;
    wound?: string;
    course?: string;
    shown: boolean;
    [k: string]: unknown;
}
/** A trap set, as Morgul lists it. */
export interface TrapLike {
    id: string;
    kind: string;
    place: string;
    by: string | null;
    for?: string;
    uses: number;
    t: number;
    known: string[];
}
/** A character's answer to a fight with the player (Morgul's Response, event 'morgul:respond'). */
export interface ResponseLike {
    id: string;
    to: string;
    act: 'fight' | 'flee' | 'yield' | 'help';
    odds: number;
    hurt: number;
    start: boolean;
    help?: string[];
    weights: Record<string, number>;
}
/** A blow in a fight by numbers (Morgul's Blow, a Bree turn's harm). */
export interface BlowLike {
    id: number;
    by: string;
    to: string;
    kind: string;
    severity: number;
    what?: string;
    hurt: number;
    end?: 'down' | 'yielded' | 'left';
}
/** Morgul, as the bridge reaches it (world.morgul). */
export interface MorgulLike {
    readonly config: {
        fightGap?: number;
        playerMight?: string;
    };
    readonly meansDefs?: {
        values(): Iterable<MeansLike>;
    };
    readonly trapDefs?: {
        has(id: string): boolean;
        readonly size: number;
    };
    means(def: MeansLike): unknown;
    trap(def: {
        id: string;
        [k: string]: unknown;
    }): unknown;
    harm(h: HarmLike): HarmViewLike | null;
    hurt(id: string): number;
    set(kind: string, o: {
        by?: string | null;
        place: string;
        for?: string;
        seenBy?: string[];
    }): string | null;
    spring(trap: string, id: string, seenBy?: string[]): void;
    disarm(trap: string, by?: string): void;
    near(regions?: string[]): void;
    nearPlace(place: string): boolean;
    traps(place?: string): TrapLike[];
    fights(kind: string): boolean;
    respond(id: string, against?: string): ResponseLike | null;
}
/** An exchange between people, as Bree shows it (its ExchangeView). */
export interface ExchangeLike {
    id: number;
    kind: string;
    who: string[];
    place: string | null;
    t: number;
    by?: string;
}
/** Bree, as the bridge reaches it (world.bree). */
export interface BreeLike {
    exchanges(): ExchangeLike[];
    exchange(which: number | string): ExchangeLike | null;
}
/**
 * The means, declared to both halves at once, so a game writes its weapons,
 * spells, poisons and traps once: each to the world's Morgul (which reads
 * id, kinds, use, severity and course, and keeps the rest), a means set as a
 * trap as Morgul's trap too (hidden as its trigger says, else Morgul's
 * default, hidden; catching `uses`, 1 by default; `catch` its chance off
 * screen), unless the game declared that trap itself; then the list made
 * into Tycho.harm's lookup by the maker the game passes (Tycho.harm.means),
 * or a copy of it. Declare them again on a new world, as every definition.
 */
export declare function means<A = MeansLike[]>(world: WorldLike | null | undefined, list: readonly MeansLike[], arsenal?: (list: readonly MeansLike[]) => A): A;
/** A hit Tycho.harm landed (its Hit): on whom, the blow, and the amount that got through. */
export interface HitLike<B = any> {
    to: B;
    blow: {
        amount: number;
        kinds?: readonly string[] | null;
        by?: unknown;
        [field: string]: unknown;
    };
    amount: number;
    kinds?: readonly string[] | null;
}
export interface HarmOptions<B = any> {
    /** The Tyrell id of a body: 'player' for the player, null for a body with no mind (a creature). Default: its `id`, or the body itself if it's a string. */
    id?: (body: B) => string | null | undefined;
    /** The whole of what the game measures on the one struck (a health bar's top): the severity is the hit's share of it. */
    whole?: number | ((body: B) => number);
    /** Or the severity itself, 0..1, from the hit. */
    severity?: (hit: HitLike<B>) => number;
    /** Who did it, over the blow's `by`. */
    by?: string | null;
    /** How it came: default the blow's `via`, or 'blow'. */
    via?: string;
    intent?: 'meant' | 'defense' | 'careless' | 'accident';
    /** What it was done with: default the blow's `what`, or its `means` (an id, or a means). */
    what?: string;
    cause?: string;
    course?: string;
    /** Where, a Tyrell place (default: where the one struck is). */
    place?: string | null;
    /** Who saw it land, by id; or the people about (bodies) and the game's sight, for witnesses(). */
    seenBy?: string[];
    people?: readonly B[];
    sight?: WitnessOptions<any>;
    /** Where it was seen from (default: the one struck). */
    at?: {
        x: number;
        y: number;
    };
}
/**
 * A hit Tycho.harm landed on screen, as Morgul's harm (an input, recorded):
 * to and by from the bodies (`id`), its kind from the hit's, its severity
 * the hit's share of what the game measures (`whole`), or `severity`, or the
 * blow's own severity by the share of its amount that got through, how it
 * came, why, with what, where, and who saw it (`seenBy`, or witnesses() of
 * the `people` about by the game's `sight`). Returns the harm as Morgul
 * tells it, or null: no Morgul, nobody with a mind struck, or nothing that
 * got through. Call it for a hit that landed.
 */
export declare function harm<B = any>(world: WorldLike | null | undefined, hit: HitLike<B>, o?: HarmOptions<B>): HarmViewLike | null;
/**
 * The player's might in a fight, as the game reckons it (their gear, their
 * strength), as the world's fact Morgul reads (its playerMight, 'might:player'
 * by default): set (an input) only when it changes.
 */
export declare function might(world: WorldLike | null | undefined, value: number, key?: string): void;
/** A moment of a fight between characters, for the game to show. */
export interface Beat {
    /** The fight (its Bree exchange), and when (world minutes). */
    fight: number;
    t: number;
    /** 'start': they square up; 'blow': a turn of it; 'end': it's over. */
    type: 'start' | 'blow' | 'end';
    /** Bree's kind, the two in it, where, and who started it. */
    kind: string;
    who: string[];
    place: string | null;
    started?: string;
    /** A blow: whose turn it was (they swing), at whom, and whether theirs landed (if not, the other's did: a counter). */
    swing?: string;
    at?: string;
    lands?: boolean;
    /** A blow: who struck whom, of what kind, how hard (0..1, heavy past heavyAt), with what, how hurt the one struck is now, and its harm's id. */
    hit?: {
        by: string;
        to: string;
        kind: string;
        severity: number;
        heavy: boolean;
        what?: string;
        hurt: number;
        harm: number;
    };
    /** How it ends: with a blow, 'down', 'yielded' or 'left'; at the end, Bree's why ('down', 'yielded', 'left', 'stepped in', 'done', 'parted'...). */
    end?: string;
    /** Who walked off, who stepped in, and how it went (at the end). */
    left?: string;
    mediator?: string;
    outcome?: string;
}
/** A fight going on, as the scuffle keeps it. */
export interface Fight {
    id: number;
    kind: string;
    who: string[];
    place: string | null;
    started?: string;
    t: number;
    blows: number;
    hurt: Record<string, number>;
    last: Beat | null;
}
export interface ScuffleOptions {
    /** How severe a blow is heavy (a stagger, a knock), 0..1. Default 0.25. */
    heavyAt?: number;
    /** Which fights the game shows (the ones in its loaded region, say): only their beats are kept. Default all. */
    keep?: (fight: Fight) => boolean;
}
/**
 * A fight between characters, shown in step with its turns: the fights by
 * numbers (Bree's kinds that Morgul fights) as they start, each turn's blow
 * (from `bree:turn`'s harm) and how they end, as beats for the game to play
 * in order (take), and the fights going on, as the world has them now
 * (fights, of), so a rewind or a load leaves nothing stale.
 */
export declare function scuffles(world: WorldLike, o?: ScuffleOptions): {
    /** The beats since the last take, in order (those at or after `since`, world minutes, if given). */
    take(since?: number): Beat[];
    /** The fights going on now, as the world has them (those the game keeps). */
    fights(): Fight[];
    /** The fight someone's in now, or null. */
    of(id: string): Fight | null;
    /** Forgets every fight and beat (a new world, or a jump the game won't show). */
    clear(): void;
    /** Stops listening. */
    stop(): void;
};
/** What a character's frame-level fighter should do in a fight with the player, from their answer. */
export interface Plan {
    id: string;
    against: string;
    /** Fight back, flee, yield, or call for help. */
    act: 'fight' | 'flee' | 'yield' | 'help';
    /** When they chose it (world minutes), and whether the fight starts with it. */
    t: number;
    start: boolean;
    /** Their odds against the player, and how hurt they are. */
    odds: number;
    hurt: number;
    /** Who they call on (act 'help'). */
    help?: string[];
    /** What they'd fight with: the strongest means they hold that arms them, or null for their fists. */
    means: MeansLike | null;
    /** How appealing each answer was. */
    weights: Record<string, number>;
}
export interface FighterOptions {
    /** The player's might, as the game reckons it, set on each sync() and ask(). */
    might?: () => number;
    /** How long an answer holds without another harm between them (minutes). Default Morgul's fightGap (30). */
    gap?: number;
}
/**
 * Fights with the player, played in frames: each answer a character gives
 * (Morgul's 'morgul:respond', after each harm between them and the player,
 * the first as the fight starts) made into what the game's fighter should
 * do (take, plan), with what they'd fight with; ask() looks before anything
 * happens (will they fight if the player squares up?). The player's might is
 * the game's (might), set as the world's fact before Morgul reads it.
 */
export declare function fighters(world: WorldLike, o?: FighterOptions): {
    /** Sets the player's might (call it before reporting the player's hits, or each frame: it's an input only when it changes). */
    sync: () => void;
    /** The answers since the last take, in order. */
    take(): Plan[];
    /** Someone's answer now: their last, unless the fight's gone quiet longer than the gap. */
    plan(id: string): Plan | null;
    /** How someone would answer now, without changing anything (Morgul's respond, a look). */
    ask(id: string): Plan | null;
    /** What someone would fight with: the strongest means they hold that arms them, or null (fists). */
    means(id: string): MeansLike | null;
    /** Forgets every answer (a new world). */
    clear(): void;
    stop(): void;
};
/** A trap at a place near the player: the game's to spring, with its means (for its trigger) and the game's own object for it. */
export interface NearTrap<T = unknown> extends TrapLike {
    means: MeansLike | null;
    obj?: T;
}
export interface TrapOptions<T> {
    /** The regions the game has loaded (its level, the rooms about it): their traps are the game's to spring. */
    regions: () => Iterable<string>;
    /** Makes the game's own trigger for a trap come near (placed at its place's spot). */
    make?: (trap: NearTrap<T>) => T;
    /** Lets one go (gone off, disarmed, or no longer near). */
    drop?: (trap: NearTrap<T>) => void;
}
/**
 * Traps handed between near and far: Morgul springs traps off screen by
 * chance, except at places near the player, which are the game's to spring
 * with its triggers, so nobody is caught twice. sync() tells Morgul which
 * regions are near (an input, only when they change) and keeps the traps at
 * near places as the game's (made and dropped as they come and go); a
 * trigger that springs is reported back with spring().
 */
export declare function traps<T = unknown>(world: WorldLike, o: TrapOptions<T>): {
    /** Tells Morgul what's near and works out the game's traps: those come near (made) and those gone (dropped). */
    sync(): {
        add: NearTrap<T>[];
        drop: NearTrap<T>[];
    };
    /** The traps that are the game's now. */
    list(): NearTrap<T>[];
    get(id: string): NearTrap<T> | null;
    /** A trigger sprang on someone (a character, or the player), seen by whoever (default everyone there): Morgul's harm follows. */
    spring(id: string, who: string, seenBy?: string[]): void;
    /** Someone (the player, a character) disarmed one on screen. */
    disarm(id: string, by?: string): void;
    /** A trap set on screen (by the player, say), at a place, for someone, seen by whoever: its id. */
    set(kind: string, s: {
        by?: string | null;
        place: string;
        for?: string;
        seenBy?: string[];
    }): string | null;
    /** Lets every trap go (a new world): the game's drop told of each. */
    clear(): void;
};
export {};
