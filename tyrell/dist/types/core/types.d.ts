import type { World } from './world';
export type Id = string;
/** Tyrell's clock counts minutes since the world began. */
export type Minutes = number;
/** A value a fact, a belief or a variable can hold. */
export type Value = string | number | boolean | null;
/** What a condition or effect can see. */
export interface Ctx {
    world: World;
    /** The person thinking, acting or speaking. */
    person?: PersonState;
    /** The place in question (where the action happens). */
    place?: Id | null;
    /** The other person, for actions and lines aimed at someone. */
    target?: Id | null;
    /** The action or task being judged. */
    action?: Id;
    /** A topic, for lines. */
    topic?: string;
    /** Anything else a caller wants to pass along. */
    data?: Record<string, unknown>;
}
/**
 * A condition: a string in Tyrell's small condition language (see
 * docs/conditions.md), or a function. Strings save and rewind; functions are
 * for definitions only.
 */
export type Cond = string | ((ctx: Ctx) => boolean);
/** An effect: a string in the effect language, or a function. */
export type Effect = string | ((ctx: Ctx) => void);
/** A response curve: maps a normalized input in [0, 1] to an output in [0, 1]. */
export type Curve = 'linear' | 'inverse' | 'quadratic' | 'sqrt' | 'cubic' | 'smooth' | 'logistic' | 'step' | 'pow1.5' | Array<[number, number]> | ((x: number) => number);
/**
 * One consideration: take an input, normalize it over a range, pass it
 * through a curve, map the result to an output range, and multiply it into
 * the option's weight. A zero vetoes the option.
 */
export interface Consideration {
    /** A label for the inspector. */
    name?: string;
    /**
     * The input. Strings: 'need.<id>', 'var.<name>', 'trait.<name>',
     * 'value.<name>', 'hour', 'travel' (minutes), 'mood', 'stress', 'habit',
     * 'regard' (toward the target), 'money', 'price', 'heat', 'crowd' (share of
     * the place's slots taken), 'room' (mood of the room), or a function.
     */
    input: string | ((ctx: Ctx) => number);
    /** The input range that maps to 0..1. Default [0, 1]. */
    range?: [number, number];
    /** Default 'linear'. */
    curve?: Curve;
    /** The output range the curve's 0..1 maps to. Default [0, 1]. */
    out?: [number, number];
}
export interface NeedDef {
    id: Id;
    /** How much the need rises per game hour (0..1 scale, 1 is desperate). */
    rise: number;
    /** Starting value for new people. Default 0.2. */
    start?: number;
    /** How the need's level turns into urgency when weighing relief. Default 'pow1.5'. */
    curve?: Curve;
    /**
     * Above this level the need is urgent: something that meets it (by 0.3 or
     * more) is lifted above routines, and at 0.97 above work. Default
     * config.urgent (0.85). Set it above 1 for needs that should never break
     * a routine (fun, company).
     */
    urgent?: number;
    /** A label for the inspector. */
    label?: string;
    /** The emotion it shows as when it's high (Reverie): 'tired', 'lonely', 'irritable'. */
    emotion?: string;
}
export interface SlotDef {
    /** How many people can hold this slot at once. */
    count: number;
    /** Who may take it. */
    who?: Cond[];
}
export interface PlaceDef {
    id: Id;
    name?: string;
    /** Tags actions can ask for: 'food', 'social', 'home', 'outdoors'... */
    tags?: string[];
    /** The place this one is inside (a till inside a bar). Travel between them is free. */
    in?: Id;
    /** A region: what the game loads at once (a level, a map). Defaults to the parent's, or 'world'. */
    region?: string;
    /** Opening hours [open, close), wrapping past midnight. Omit for always open. */
    hours?: [number, number];
    /** Named slots with a capacity: stools, beds, a counter. */
    slots?: Record<string, number | SlotDef>;
    /** Actions this place offers (in addition to actions that ask for its tags). */
    offers?: Id[];
    /** Whose place it is (a person, a household or a group): wages and prices go there. */
    owner?: Id;
    /** A multiplier on the relief its actions give. Default 1. */
    quality?: number;
    /** Goods on sale and their stock (Ceres). */
    stock?: Record<Id, number>;
    /** Restocking: item -> [amount, every N hours] (Ceres). */
    restock?: Record<Id, [number, number]>;
    /** Anything the game wants to keep with the place (coordinates, a level id). */
    data?: Record<string, unknown>;
}
/** How an action names its place. */
export type PlaceSpec = Id | `tag:${string}` | 'home' | 'work' | 'here' | `person:${string}` | 'target' | null;
export interface ActionDef {
    id: Id;
    label?: string;
    /** How much each need drops when the action is done: a number or [min, max]. */
    relieves?: Record<Id, number | [number, number]>;
    /** A flat appeal added to the relief, for actions people do for their own sake. */
    base?: number;
    /** While doing it, needs rise at these rates instead (sleeping: { hunger: 0.4 }). */
    rates?: Record<Id, number>;
    /** Where it happens. Default null: wherever the person is. */
    at?: PlaceSpec | PlaceSpec[];
    /** The slot it needs at that place. */
    slot?: string;
    /** How long it takes: minutes, or [min, max]. */
    minutes: number | [number, number];
    /**
     * When chosen by a routine or job, last until that entry ends (sitting at
     * the bar all evening). Default true for routine and job choices.
     */
    fill?: boolean;
    /** Conditions to start it. */
    if?: Cond[];
    /** Effects when it ends. */
    then?: Effect[];
    /** Who may do it at all. */
    who?: Cond[];
    /** Only during these hours. */
    hours?: [number, number];
    /** Only for people with this job. */
    job?: Id;
    /** Dual-utility rank: higher ranks are always preferred. Default 0. */
    rank?: number;
    /** Extra considerations multiplied into the weight. */
    considerations?: Consideration[];
    /** Minutes before the same person may choose it again. */
    cooldown?: number;
    /** Tags: 'social', 'sleep', 'work', 'illegal', 'together'... */
    tags?: string[];
    /** Aimed at another person: 'person' (anyone suitable), with conditions on who. */
    target?: 'person';
    /** Conditions on the target (the ctx's target is the candidate). */
    targetIf?: Cond[];
    /** What the game should show: a pose name ('sit', 'work', 'walk'...). */
    pose?: string;
    /** A line key to say on starting. */
    says?: string;
    /** Values this action goes against: doing it adds stress to those who hold them (Reverie). */
    against?: string[];
    /** A price paid at the start (Ceres). */
    price?: number;
    /** Goods bought from the place's stock (Ceres). */
    buys?: Record<Id, number>;
    /** Goods used up (Ceres). */
    uses?: Record<Id, number>;
    /** Goods gained (Ceres and Mentat's 'get:' planning). */
    gives?: Record<Id, number>;
    /** Wage paid per hour at the end (Ceres). */
    wage?: number;
    /** A social act resolved with the target at the end (Cityspeak). */
    social?: Id;
    /** Feelings the person gets at the end (Reverie). */
    feels?: Id[];
    /** A deed recorded in the target's file on the person (Reverie, Fellowship): see world.deed(). */
    deed?: string;
    /** Doing it is this crime: anyone at the place may witness it (Wormtongue). */
    crime?: string;
    /** Planning cost override (Mentat). */
    cost?: number;
    /** Anything the game wants to attach. */
    data?: Record<string, unknown>;
}
/** A step in a task's method. */
export type Step = Id | `go:${string}` | `wait:${number}` | `get:${string}` | {
    action: Id;
    at?: PlaceSpec;
    minutes?: number;
    target?: Id;
};
export interface MethodDef {
    name?: string;
    if?: Cond[];
    do: Step[];
}
/** A compound task: Mentat breaks it into steps by its methods, tried in order. */
export interface TaskDef {
    id: Id;
    label?: string;
    relieves?: Record<Id, number | [number, number]>;
    base?: number;
    at?: PlaceSpec | PlaceSpec[];
    if?: Cond[];
    who?: Cond[];
    rank?: number;
    considerations?: Consideration[];
    cooldown?: number;
    tags?: string[];
    methods: MethodDef[];
}
/**
 * One entry of a routine: from this hour, be at this place doing this, until
 * the next entry. The activity '*' at a place means "anything there"; '*'
 * with no place (null) means free time: nothing is required.
 */
export type RoutineEntry = [hour: number, place: PlaceSpec, activity: Id, extra?: {
    with?: Id;
    rank?: number;
}];
/** A routine variant: the first whose conditions hold on a day is used. */
export interface RoutineVariant {
    /** Days of the week (0..6, day number mod week length) it applies on. */
    days?: number[];
    /** Conditions checked at the start of the day ('fact:raining', 'var.money<20'). Strings only. */
    when?: string[];
    plan: RoutineEntry[];
}
export interface JobDef {
    /** The job's id, matched by actions' `job`. */
    id: Id;
    /** Where the work is. */
    place: Id;
    /** The action done on shift. */
    action: Id;
    /** Shifts as [start hour, end hour), wrapping past midnight. */
    shifts: Array<[number, number]>;
    /** Days of the week it applies (default every day). */
    days?: number[];
    /** Pay per hour (Ceres). */
    wage?: number;
}
/** Everything about a person that the game declares. Plain JSON: it is saved with the person. */
export interface PersonDef {
    name?: string;
    /** Personality, 0..1 each: 'thrift', 'honesty', 'courage', 'talkative', 'memory'... */
    traits?: Record<string, number>;
    /** Values held, 0..1 each: 'honesty', 'family', 'faith'... */
    values?: Record<string, number>;
    home?: Id;
    job?: JobDef;
    /** Routine variants; one plain plan can be given as `routine: [[...], ...]`. */
    routine?: RoutineVariant[] | RoutineEntry[];
    /** Groups the person belongs to (households, factions, the police). */
    groups?: Id[];
    /** Tags: 'resident', 'stranger', 'child'... */
    tags?: string[];
    /** Starting needs. */
    needs?: Record<Id, number>;
    /** Starting variables: money and anything else. */
    vars?: Record<string, Value>;
    /** Starting goods. */
    inv?: Record<Id, number>;
    /** Where they are at the start. Defaults to home. */
    place?: Id;
    /** Born at this time in minutes (Cradle). */
    born?: number;
    /** Anything the game wants to keep: a look, a sprite id. */
    data?: Record<string, unknown>;
}
/** What someone is doing right now. */
export interface Doing {
    kind: 'act' | 'travel' | 'wait';
    /** The action (for travel: the action they're traveling to do). */
    action: Id;
    place: Id | null;
    slot?: string;
    target?: Id;
    start: Minutes;
    end: Minutes;
    /** Travel only: from and to. */
    from?: Id | null;
    to?: Id | null;
    /** Dual-utility rank and the layer it came from: 'story', 'job', 'routine', 'need', 'plan', 'break', 'practice'. */
    rank: number;
    layer: string;
    /** The task this step belongs to, if planned. */
    task?: Id;
    /** The sequence number of the event that ends it. */
    seq: number;
    /** For actions chosen by a routine or job: when the entry ends. */
    until?: Minutes;
    /** Travel only: the action at the end shouldn't stretch to fill the entry. */
    fill?: boolean;
}
/** A plan in progress (Mentat). */
export interface PlanState {
    task: Id;
    /** The stack of compound tasks being expanded, innermost last. */
    stack: Array<{
        task: Id;
        method: number;
        steps: Step[];
        i: number;
    }>;
    /** Methods already tried and failed, per task. */
    failed: Record<Id, number[]>;
    tries: number;
    started: Minutes;
    rank: number;
    layer: string;
}
export interface NeedState {
    v: number;
    t: Minutes;
}
export interface PersonState {
    id: Id;
    name: string;
    def: PersonDef;
    status: 'active' | 'away' | 'gone';
    needs: Record<Id, NeedState>;
    vars: Record<string, Value>;
    inv: Record<Id, number>;
    place: Id | null;
    slot?: string;
    doing: Doing | null;
    /** Habit weights per action: [fast, slow]. */
    habits: Record<Id, [number, number]>;
    cool: Record<Id, Minutes>;
    last?: Id;
    lastEnd?: Minutes;
    /** Random draws taken from this person's stream. */
    n: number;
    plan: PlanState | null;
    suspended: PlanState[];
    directive: Directive | null;
    /** While away (dormant): when they come back and what to say they did. */
    away?: {
        until: Minutes;
        summary?: string;
        place?: Id;
    };
    /** Following someone (moving as one). */
    follow?: Id;
    born?: Minutes;
}
/** An order from the story layer: overrides job and routine. */
export interface Directive {
    /** An action or task to do. */
    do: Id;
    at?: PlaceSpec;
    target?: Id;
    /** Until this time (minutes); default until done once. */
    until?: Minutes;
    /** Rank; default 3. */
    rank?: number;
    /** Done once already. */
    done?: boolean;
    /** Repeat until `until`. */
    repeat?: boolean;
    label?: string;
}
/**
 * What a deed (world.did) means to the people involved. Each module reads
 * the parts it cares about.
 */
export interface DeedDef {
    /** Feeling for the person it was done to or for (Reverie). */
    feeling?: Id;
    /** Feeling for anyone who saw it (Reverie). */
    witnessFeeling?: Id;
    /** Importance of the memory it leaves, 1..10 (Reverie). */
    memory?: number;
    /** Change in the receiver's regard for the doer, -1..1 (Fellowship). */
    regard?: number;
    /** A sentiment the receiver keeps about the doer (Fellowship). */
    sentiment?: string;
    /** Change in standing with the receiver's groups (Fellowship). */
    fame?: number;
    infamy?: number;
    /** Treat as this crime when witnessed (Wormtongue). */
    crime?: string;
}
export interface QueueItem {
    t: Minutes;
    seq: number;
    /** 'end' an action, 'think' again, 'hour' tick, 'timer' (the game's), 'module' (a module's). */
    k: 'end' | 'think' | 'hour' | 'timer' | 'module' | 'back';
    who?: Id;
    /** For 'end': the doing's seq. For 'module': the module name. */
    ref?: number | string;
    data?: Record<string, Value | Value[]>;
}
export interface LogEntry {
    t: Minutes;
    k: string;
    who?: Id;
    d?: Record<string, unknown>;
}
export interface PlaceState {
    /** Slot claims: slot -> person ids. */
    claims: Record<string, Id[]>;
    stock?: Record<Id, number>;
}
export interface WorldState {
    /** Save schema version. */
    v: number;
    seed: string;
    now: Minutes;
    seq: number;
    people: Record<Id, PersonState>;
    places: Record<Id, PlaceState>;
    /** The world's facts: the truth. */
    facts: Record<string, Value>;
    /** The event queue (a heap). */
    q: QueueItem[];
    /** Westmarch: the log of what happened (a bounded list). */
    log: LogEntry[];
    /** Module state, by module name. */
    mod: Record<string, any>;
    /** State the game keeps with the world so it rewinds too. */
    game: Record<string, unknown>;
    /** Draws from the world's own stream. */
    n: number;
    /** Ids handed out at runtime. */
    ids: number;
}
/** What the engine asks the game. All optional. */
export interface Shell {
    /** Travel time in minutes between two places. Default: the place graph. */
    travel?(from: Id, to: Id, person?: PersonState): number;
    /** Is this person visible in the loaded area? Default: by focused regions. */
    near?(body: Body, world: World): boolean;
    /** Facts the game owns, answered live (not rewind-safe: prefer world.fact()). */
    check?(fact: string, ctx: Ctx): Value | undefined;
}
export interface Config {
    /** Game minutes per real second at speed 1. Default 1. */
    minutesPerSecond: number;
    /** Days in a week, for routine variants. Default 7. */
    week: number;
    /** Need level above which a need is urgent. Default 0.85. */
    urgent: number;
    /** Urgent needs lift an option to this rank (above routines). Default 1.5; desperate (>= 0.97) to 2.5. */
    urgentRank: number;
    desperateRank: number;
    /** Options under this share of the best weight are dropped. Default 0.25. */
    cut: number;
    /** At most this many options go into the final draw. Default 3. */
    top: number;
    /** The draw is weighted by weight^power. Default 2. */
    power: number;
    /** Bonus for carrying on with what you're doing. Default 1.15. */
    inertia: number;
    /** Multiplier for doing the same thing twice in a row. Default 0.75. */
    repeat: number;
    /** Travel cost: weight is multiplied by 1 / (1 + minutes / travelScale). Default 30. */
    travelScale: number;
    /** How many candidate places to weigh per action. Default 4. */
    placesPerAction: number;
    /** Minutes before someone idle thinks again. Default 20. */
    idle: number;
    /** Minutes between thoughts while traveling or busy for checking urgent needs. Default 30. */
    recheck: number;
    /** Milliseconds of thinking per frame. Default 4. */
    budgetMs: number;
    /** Westmarch log size. Default 3000. */
    logSize: number;
    /** Palantír keeps this many decisions per person. Default 12. */
    decisions: number;
    /** Habit learning rates and bounds. */
    habitFast: number;
    habitSlow: number;
    habitMin: number;
    habitMax: number;
    /** Compensate for the number of considerations (IAUS). Default true. */
    compensate: boolean;
}
export interface Options {
    /** The world's seed: the same seed and the same calls give the same world. */
    seed?: string | number;
    /** Start time in minutes. Default 0 (midnight on day 0). Use 8 * 60 for 8 am. */
    start?: Minutes;
    /** The modules to switch on. Default: all. */
    modules?: string[];
    shell?: Shell;
    config?: Partial<Config>;
    /** Esper (time walk) settings. */
    esper?: Partial<EsperConfig>;
}
export interface EsperConfig {
    /** Record history. Default true. */
    on: boolean;
    /** A snapshot every this many minutes. Default 15. */
    every: number;
    /** Keep this many minutes of history. Default 2880 (two days). */
    keep: number;
    /** Older than this many minutes, keep only one snapshot per `sparseEvery`. Default 360. */
    sparseAfter: number;
    sparseEvery: number;
}
/** A person as the game should show them right now. */
export interface Body {
    id: Id;
    name: string;
    place: Id | null;
    slot?: string;
    /** What they're doing: an action id, or 'travel'. */
    action: Id;
    /** The action they're traveling to do, while traveling. */
    next?: Id;
    pose: string;
    target?: Id;
    /** 0..1 through the current action or walk. */
    progress: number;
    start: Minutes;
    end: Minutes;
    travel?: {
        from: Id | null;
        to: Id | null;
        start: Minutes;
        end: Minutes;
        f: number;
    };
    emotion?: string;
    mood?: number;
    /** Who they're walking with. */
    with?: Id;
    data?: Record<string, unknown>;
}
/** Something perceived, reported by the game (it owns sight and sound). */
export interface Stimulus {
    /** 'strip', 'theft', 'fight', 'gift', 'shout'... */
    kind: string;
    /** Who did it ('player' for the player). */
    actor: Id;
    /** What it was done to or with. */
    what?: string;
    place?: Id | null;
    /** Who perceived it. If omitted, everyone at the place. */
    seenBy?: Id[];
    /** 0..1: how clearly. Default 1. */
    strength?: number;
    /** 0..1: how well the actor was disguised. Default 0. */
    disguise?: number;
    data?: Record<string, Value>;
}
/** One choice the inspector can explain. */
export interface Candidate {
    /** Action or task id. */
    id: Id;
    kind: 'action' | 'task';
    place: Id | null;
    target?: Id;
    rank: number;
    weight: number;
    layer: string;
    /** The parts the weight is made of: [name, value]. The first is the base. */
    parts: Array<[string, number]>;
    /** Why it was ruled out, if it was. */
    blocked?: string;
    slot?: string;
    until?: Minutes;
    /** False for options that shouldn't stretch to fill a routine entry ('*' choices). */
    fill?: boolean;
}
export interface Decision {
    t: Minutes;
    who: Id;
    picked: Candidate | null;
    candidates: Candidate[];
    /** The best option at the top rank, and what it beat. */
    reason: string;
}
