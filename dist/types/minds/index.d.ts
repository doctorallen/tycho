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
export {};
