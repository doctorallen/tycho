import { Lang } from './conds';
import type { Module } from './module';
import { Ring } from './ring';
import { Bicameral } from './bicameral';
import { Entmoot } from './entmoot';
import { Esper } from './esper';
import { Westmarch } from './westmarch';
import { Palantir } from '../tools/palantir';
import { Irulan } from '../tools/irulan';
import { Strangers } from './strangers';
import { Skills } from './skills';
import type { Reverie } from '../modules/reverie';
import type { Fellowship } from '../modules/fellowship';
import type { Wormtongue } from '../modules/wormtongue';
import type { Cityspeak } from '../modules/cityspeak';
import type { Mentat } from '../modules/mentat';
import type { Gaff } from '../modules/gaff';
import type { Ceres } from '../modules/ceres';
import type { Cradle } from '../modules/cradle';
import type { Joi } from '../modules/joi';
import type { Athelas } from '../modules/athelas';
import type { Delos } from '../modules/delos';
import type { Voice } from '../modules/voice';
import type { Bree } from '../modules/bree';
import type { Morgul } from '../modules/morgul';
import type { ActionDef, Body, Config, Ctx, DeedDef, Decision, Directive, HeldWish, Id, NeedDef, Options, PersonDef, PersonState, PastimeDef, PlaceDef, Shell, SkillDef, Stimulus, TaskDef, Value, WishDef, WorldState } from './types';
import { DAY, HOUR, Stream } from './util';
export declare const SCHEMA = 2;
export declare const DEFAULT_CONFIG: Config;
/**
 * The core's headline knobs (fields of Config): plain multipliers, 1 changing
 * nothing. 'person' ones a person's own `tune.core` multiplies for them alone;
 * 'world' ones are the world's only.
 */
export declare const CORE_KNOBS: Readonly<Record<string, 'person' | 'world'>>;
/** A saved world: what world.save() returns and world.load() takes. */
export interface SaveData {
    tyrell: string;
    v: number;
    s: WorldState;
    history?: unknown;
}
type Listener = (data: any) => void;
export declare class World {
    /** The state: everything that changes. Plain JSON. */
    s: WorldState;
    readonly config: Config;
    readonly shell: Shell;
    readonly lang: Lang;
    readonly needs: Map<string, NeedDef>;
    readonly actions: Map<string, ActionDef>;
    readonly tasks: Map<string, TaskDef>;
    readonly deeds: Map<string, DeedDef>;
    readonly pastimes: Map<string, PastimeDef>;
    readonly wishes: Map<string, WishDef>;
    readonly ring: Ring;
    readonly mind: Bicameral;
    readonly clock: Entmoot;
    readonly esper: Esper;
    readonly westmarch: Westmarch;
    readonly palantir: Palantir;
    readonly irulan: Irulan;
    readonly strangers: Strangers;
    /** Skills: levels that grow with practice. */
    readonly skills: Skills;
    readonly modules: Map<string, Module>;
    /** The modules in the order their hooks run. */
    readonly hooks: Module[];
    /** True while Esper replays history: the game hears nothing then. */
    replaying: boolean;
    private listeners;
    private inputs;
    private depth;
    private deferred;
    /** Listeners being called (game code): inputs they make wait their turn. */
    private listening;
    /** The input depth the innermost listener was called at (deeper is engine code it set off). */
    private listenDepth;
    /** Clock calls running (tick, advanceTo, seek, load). */
    private moving;
    /** Clock calls made while the engine was busy, waiting their turn. */
    private later;
    /** Calls that only look (choosing a line, explaining a choice): chance: draws change nothing then. */
    private looking;
    private _speed;
    /** The settings in force, by module, made from the overrides they were made from (s.tune's, kept whole: a new tune makes a new object). */
    private tunedCache;
    constructor(opts: Options, modules: Module[]);
    /** Minutes since the world began. */
    get now(): number;
    /** The hour of the day, 0 to 24 (fractional). */
    get hour(): number;
    /** The day number. */
    get day(): number;
    /** The day of the week, 0 to config.week - 1. */
    get weekday(): number;
    /** How fast time runs: 1 normal, 4 four times as fast, 0 paused, negative runs backward. */
    get speed(): number;
    set speed(v: number);
    /**
     * Moves the world on by a frame: `seconds` of real time at the current
     * speed and config.minutesPerSecond. A negative speed plays history backward.
     */
    tick(seconds: number): void;
    /** Jumps forward this many minutes at once (sleeping, a cut scene). No frame budget. */
    advance(minutes: number): void;
    /** Runs the world up to time t (minutes). Use this when the game owns the clock. */
    advanceTo(t: number): void;
    /** Goes to any time Esper still remembers, back or forward. */
    seek(t: number): void;
    /** Goes back this many minutes. */
    rewind(minutes: number): void;
    private runTick;
    private runTo;
    private runSeek;
    /** Is the engine in the middle of something: moving time, an event, an input, a listener, a replay? */
    private busy;
    /** Runs a call that moves time or replaces the state now, or after the engine's current work if it's busy. */
    private whenFree;
    /** Runs the clock calls that waited, in order, once the engine is free. */
    private runLater;
    /** Calls the game back at time t: listen with on('timer', ...) or on('timer:' + name, ...). */
    at(t: number, name: string, data?: Record<string, Value>): void;
    need(def: NeedDef): this;
    place(def: PlaceDef): this;
    link(a: Id, b: Id, minutes: number, oneWay?: boolean): this;
    action(def: ActionDef): this;
    task(def: TaskDef): this;
    /** Says what a deed (world.did) means: feelings, memories, regard, standing, crime. */
    deed(verb: string, def: DeedDef): this;
    /** A skill: levels that grow with practice (actions' `trains`), read as `skill.<id>`. */
    skill(def: SkillDef): this;
    /** A kind of pastime that palls (actions' `palls`): its label, and how fast it palls and recovers. */
    pastime(def: PastimeDef): this;
    /** A wish (or, with `dream`, a dream) people may come to hold. */
    wish(def: WishDef): this;
    /**
     * Adds a person, or returns them if they already exist (after a load the
     * saved person wins, so declaring everyone on every start is safe).
     */
    person(id: Id, def?: PersonDef): PersonState;
    /** Extends the condition language with a term. */
    term(name: string, fn: (ctx: Ctx, arg: string) => Value | undefined): this;
    /** Extends the effect language. */
    effect(name: string, fn: (ctx: Ctx, arg: string, op: string, value: Value) => void): this;
    /** A module by name, or undefined if it's switched off. */
    module<T extends Module = Module>(name: string): T | undefined;
    /** Moods, memories, beliefs and the file on the player. */
    get reverie(): Reverie | undefined;
    /** Regard, sentiments, compatibility, groups and standing. */
    get fellowship(): Fellowship | undefined;
    /** Gossip, witnesses, heat, secrets and favors. */
    get wormtongue(): Wormtongue | undefined;
    /** Practices, social acts and lines. */
    get cityspeak(): Cityspeak | undefined;
    /** Planning: HTN tasks and getting hold of things. */
    get mentat(): Mentat | undefined;
    /** The director. */
    get gaff(): Gaff | undefined;
    /** Money, goods, wages, prices and stock. */
    get ceres(): Ceres | undefined;
    /** Ages, households, births and departures. */
    get cradle(): Cradle | undefined;
    /** The optional language-model voice. */
    get joi(): Joi | undefined;
    /** Conditions that run a course: ale, colds, toxins. */
    get athelas(): Athelas | undefined;
    /** Genomes: looks, traits, talents and instincts, inherited. */
    get delos(): Delos | undefined;
    /** Branching conversations: threads of beats, answers with approaches, promises. */
    get voice(): Voice | undefined;
    /** Interactions between people: exchanges by degrees, conversations over turns, quarrels, grudges, feuds and making up. */
    get bree(): Bree | undefined;
    /** Harm between people: wounds, down and dead, grudges and fear, traps, poison, suspicion, fights by numbers. */
    get morgul(): Morgul | undefined;
    /** Sets a fact (the truth of the world), or reads it if no value is given. */
    fact(key: string, value?: Value): Value | undefined;
    /** The places that are loaded and visible: people there get bodies. */
    focus(regions: string[]): void;
    /** Everyone the game should show now. */
    bodies(): Body[];
    /** Anyone's body as it would be shown now (whether or not they're near). */
    body(id: Id): Body | null;
    /** The game reports what was seen or heard. */
    sense(stim: Stimulus): void;
    /** The game reports a deed: someone did something to or for someone. */
    did(actor: Id, verb: string, data?: Record<string, Value>): void;
    /** A body reports back: 'failed' (couldn't get there, the slot was taken), or 'done' early. */
    report(id: Id, what: 'failed' | 'done', reason?: string): void;
    /** The story layer: tell someone to do something, above their job and routine. */
    direct(id: Id, directive: Directive | null): void;
    /** Rewards or discourages a choice: nudges the habit behind it. */
    reward(id: Id, action: Id, amount: number): void;
    /** Sets a person's variable (money, anything). */
    setVar(id: Id, name: string, value: Value): void;
    /** Gives (or with a negative count, takes) goods. */
    give(id: Id, item: Id, count?: number): void;
    /** Practice from outside the simulation (a lesson, a book): hours of it at the person's own pace. */
    train(id: Id, skill: Id, hours: number): void;
    /** Sets a skill's level outright. */
    setSkill(id: Id, skill: Id, level: number): void;
    /** Gives someone a wish (or a dream), about something if it's given (a dish, a friend's id). */
    wishFor(id: Id, wish: Id, about?: Value): void;
    /** Makes a wish someone holds come true. */
    grant(id: Id, wish: Id): void;
    /** The wishes (and the dream) someone holds now. */
    wishesOf(id: Id): Array<HeldWish & {
        label: string;
        progress?: number;
    }>;
    /** A person's level in a skill now (0 if they've never practiced it and didn't start with it). */
    skillOf(id: Id, skill: Id): number;
    /** Sends someone away until a time (dormant): they come back with a summary of what they did. */
    away(id: Id, until: number, summary?: string, place?: Id): void;
    /** Has someone follow another (walk together, sit together), or stop (null). */
    follow(id: Id, leader: Id | null): void;
    /** Removes someone for good ('left', 'died'...). */
    remove(id: Id, why?: string): void;
    /** Keeps a piece of the game's own state with the world, so it rewinds with it. */
    keep(key: string, value: unknown): void;
    kept<T = unknown>(key: string): T | undefined;
    /**
     * Changes settings during play (a slider in the game's options). It's an
     * input, so time walk replays the change at the moment it was made, and
     * the overrides are kept in the state, so a save keeps them. `module` is a
     * module's name, or 'core' for the config; `values` are fields of its
     * settings (any of them, not only the headline knobs), each over what was
     * declared. A field set to null goes back to what was declared, and
     * `values` null puts the whole module back. With `person`, it's that
     * person's own headline knobs instead (their `tune`). See docs/tuning.md.
     */
    tune(module: string, values: Record<string, unknown> | null, person?: Id): void;
    /**
     * The settings in force for a module (or 'core'): a copy of what was
     * declared with any overrides from tune() over it. With a person, their
     * headline knobs as they apply to them: the world's times their own.
     */
    tuning(module: string, person?: Id): Record<string, unknown>;
    /** The core config in force: what was declared (world.config), under any overrides made with tune(). */
    get cfg(): Config;
    /**
     * A module's settings in force (or the core's, as 'core'): `base`, what was
     * declared, under any overrides made with tune(). Untuned, it's `base`
     * itself; tuned, an object whose own fields are the overrides and whose
     * prototype is `base` (so a field the game sets on `base` still shows).
     */
    tuned<T extends object>(name: string, base: T): T;
    /** A person's own multiplier for one of a module's headline knobs (their `tune`): 1 if they have none. */
    own(p: PersonState | null | undefined, module: string, knob: string): number;
    /** What tune() works over: the config for 'core', else the module's declared settings. */
    private tuneBase;
    private knobsOf;
    /** Applies a tune (the input): the overrides kept whole, a new object each time, so what's made from them is made again. */
    private applyTune;
    /** A person's state (read it, don't change it: go through the API). */
    get(id: Id): PersonState | undefined;
    /** Everyone active. */
    people(): PersonState[];
    /** How many of an item a person can use: their own, plus their household's pantry (Ceres). */
    have(p: PersonState, item: Id): number;
    /** Takes items from a person: their own first, then the household's pantry. */
    takeItem(p: PersonState, item: Id, n: number): void;
    /** A need's level now (0 calm, 1 desperate). */
    needOf(id: Id, need: Id): number;
    /** Why someone is doing what they're doing. */
    why(id: Id): Decision | null;
    /** Why someone isn't doing something. */
    whyNot(id: Id, action: Id): string;
    /** A readable account of a person: needs, mood, doing, plan, beliefs. */
    describe(id: Id): string;
    /**
     * Listens for an event: 'embody', 'disembody', 'step', 'say', 'report'...
     * or '*' for all, which get `{ kind, ...payload, event }`: `event` is
     * always the event's name (`kind` is too, unless the payload has its own).
     */
    on(kind: string, fn: Listener): () => void;
    off(kind: string, fn: Listener): void;
    /** Tells the game something happened (silent while Esper replays). */
    emit(kind: string, data?: any): void;
    /** The whole world as plain JSON. With history, Esper's memory goes too. */
    save(withHistory?: boolean): SaveData;
    /**
     * Loads a saved world (migrating older saves). Declare places and actions
     * before or after. From a listener, it waits until the running call returns.
     */
    load(data: SaveData | string): void;
    private runLoad;
    /** A hash of the whole state: two worlds with the same hash are the same. */
    hash(): string;
    /** A random stream for one person's next decision (advances their counter). */
    stream(p: PersonState): Stream;
    /** A random stream for the world itself (directors, strangers, events). */
    worldStream(name: string): Stream;
    /** A random stream that changes nothing (for choices that only look, like a line to show). */
    worldStreamPeek(...parts: Array<string | number>): Stream;
    /**
     * Runs fn as a look: `chance:` conditions inside it draw from a stream
     * that changes nothing, so looking leaves the world as it was. The
     * engine's own looks (cityspeak.choose, whyNot, describe, Joi...) do this.
     */
    peek<T>(fn: () => T): T;
    /** Registers an input handler: a change from outside that Esper records and replays. */
    defineInput(name: string, fn: (...args: any[]) => unknown): void;
    /**
     * Applies an input and records it for Esper, so a rewind can replay it.
     *
     *  - A plain call from the game is recorded at the current time.
     *  - A call the game makes from inside a listener, while the engine is in
     *    the middle of something (handling an event, applying another input),
     *    waits until that's finished and is recorded to replay at exactly that
     *    point (after that event, or chained to that input).
     *  - Calls the engine makes itself, or that a storylet makes while the
     *    engine runs it (world.internally), are applied but not recorded:
     *    a replay makes them again.
     */
    input(name: string, args: unknown[]): unknown;
    /** Is the code running now a listener's own (game code), not engine work it set off? */
    private fromListener;
    private applyInput;
    /**
     * Applies the calls that waited (Entmoot calls this after each event, with
     * its seq; input() calls it after each input, with none: they chain).
     */
    flushDeferred(after: number | undefined): void;
    /**
     * Runs engine-driven code (a director's storylet, a module's callback into
     * the game): inputs it makes are applied but not recorded, because a replay
     * runs the same code again.
     */
    internally<T>(fn: () => T): T;
    /** Replays a recorded input (Esper only). */
    replay(name: string, args: unknown[]): void;
    /** A context for conditions about a person. */
    ctx(p?: PersonState, extra?: Partial<Ctx>): Ctx;
    /** The next sequence number (for queue items and doings). */
    nextSeq(): number;
    /**
     * Writes to the log and tells the game. Inside the simulation (modules,
     * effects, input handlers) it writes at once; from the game it's an input,
     * so the entry is recorded for time walk.
     */
    log(k: string, who?: Id, d?: Record<string, unknown>): void;
    private makePerson;
    private registerCore;
}
/** Save migrations: MIGRATIONS[v] turns a version-v state into version v+1. */
export declare const MIGRATIONS: Record<number, (s: any) => any>;
export { DAY, HOUR };
