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
     * The input: any term, or a function. Some useful ones: 'need.<id>',
     * 'var.<name>', 'trait.<name>', 'value.<name>', 'hour', 'travel' (minutes),
     * 'habit' (this person's habit for this action), 'crowd' (share of the
     * place's slots taken, 0..1), 'money', 'price' (the action's price, Ceres),
     * 'mood', 'stress' (Reverie), 'regard' (toward the target, Fellowship),
     * 'heat' (Wormtongue), 'room' (mood of the room, Cityspeak).
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
    /** Starting value for new people. Default config.needStart (0.2). */
    start?: number;
    /** How the need's level turns into urgency when weighing relief. Default config.needCurve ('pow1.5'). */
    curve?: Curve;
    /**
     * Above this level the need is urgent: something that meets it (by
     * config.liftRelief, 0.3, or more) is lifted above routines, and at
     * config.desperate (0.97) above work. Default
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
    /**
     * Its words in a story (Irulan), as they'd follow the person's name: what
     * they did ('read', 'took a walk in {place}', 'chatted with {target}') and
     * what they were doing when the story ends ('was reading'). {place} and
     * {target} are named; without {place}, where comes after ('at home').
     * Without it, the label is used. A list is variants, one drawn for each
     * telling ('read', 'curled up with a book').
     */
    tell?: {
        did?: string | string[];
        doing?: string | string[];
    };
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
    /**
     * Done together: the target joins in for its length (a shower for two, a
     * dance), if they're at the same place, doing nothing that outranks it,
     * and there's room in its slot; they leave what they were doing. Without
     * it, the target is only who it's aimed at, and others there are only
     * about. Their 'started' names who they joined (`with`).
     */
    together?: boolean;
    /** What the game should show: a pose name ('sit', 'work', 'walk'...). */
    pose?: string;
    /** A line topic said on starting (Cityspeak): the person's best line on it, to the target if there is one, as with cityspeak.say. */
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
    /**
     * Goods made, added at the end to the stock of `store` (default: the place
     * it's done), scaled by `yields`, and by how much was done if it's cut
     * short (Ceres).
     */
    makes?: Record<Id, number>;
    /**
     * The place whose stock `makes` goes into: a place id, or 'here' (the place
     * it's done, the default). With a store, `uses` comes out of that stock
     * instead of the person's goods (Ceres).
     */
    store?: Id;
    /** Factors on what `makes` makes (a skilled hand makes more): considerations, multiplied (Ceres). */
    yields?: Consideration[];
    /** Wage paid per hour at the end (Ceres). */
    wage?: number;
    /** A social act resolved with the target at the end (Cityspeak). */
    social?: Id;
    /** An interaction (a Bree kind) begun with the target as it starts: a conversation over its length. */
    interact?: Id;
    /**
     * With no target, who an interaction is begun with: the first one at the
     * place (by id) who is free and for whom these hold (the person, with the
     * candidate as target), someone not in an exchange before someone in one,
     * who leaves it: the clerk at a till breaks off to serve. Without it, an
     * action with no target begins nothing.
     */
    interactWith?: Cond[];
    /** Feelings the person gets at the end (Reverie). */
    feels?: Id[];
    /** A deed recorded in the target's file on the person (Reverie, Fellowship): see world.deed(). */
    deed?: string;
    /** Doing it is this crime: anyone at the place may witness it (Wormtongue). */
    crime?: string;
    /** Planning cost override (Mentat). */
    cost?: number;
    /** Skills it trains: hours of practice per hour spent doing it ({ cooking: 1 }). */
    trains?: Record<Id, number>;
    /**
     * A pastime that palls: each go adds to a tolerance that wears off by the
     * hour, and the more of it they've had lately, the less it appeals. A kind
     * shared with other actions ('drink' for the ale and the wine), or true for
     * this action alone.
     */
    palls?: string | boolean;
    /** Anything the game wants to attach. */
    data?: Record<string, unknown>;
}
/**
 * A skill: a level per person that rises with practice at their talent's
 * pace, harder the nearer the top, and slips back slowly when let go.
 */
export interface SkillDef {
    id: Id;
    label?: string;
    /** The top of the scale. Default 1. */
    max?: number;
    /** Level gained per hour of practice at talent 1, from nothing. Default config.skillRate (0.02: about fifty hours to the top of 1). */
    rate?: number;
    /**
     * How much harder each step is: progress is scaled by (1 - level / max) to
     * this power. Default 1; 0 for none, 2 for much harder near the top.
     */
    diminish?: number;
    /** Level lost per day without practice, once `grace` days have gone by. Default 0: never forgotten. */
    decay?: number;
    /** Days without practice before it starts to slip. Default config.skillGrace (3). */
    grace?: number;
    /** Forgetting never takes a level below this. Default 0. */
    floor?: number;
    /** Where people start (a person's own `skills` in their definition wins). Default 0. */
    start?: number;
    /** Named levels, lowest first: [[0.25, 'competent'], [0.5, 'skilled']]. Reaching one emits 'skill'. */
    levels?: Array<[number, string]>;
    /** Effects when someone reaches a named level (ctx.data.level is its name). */
    then?: Effect[];
    /** More factors on how fast someone learns it (schooling, wit): considerations on the learner, multiplied. */
    learn?: Consideration[];
}
/** A kind of pastime that palls (actions' `palls`): its label and how fast it palls and recovers. */
export interface PastimeDef {
    id: Id;
    /** What they've had enough of, for the inspector: 'the ale'. */
    label?: string;
    /** Tolerance one go adds (0..1). Default config.pallGain. */
    gain?: number;
    /** Tolerance lost per hour. Default config.pallDecay. */
    decay?: number;
    /** The share of appeal lost at full tolerance. Default config.pallPenalty. */
    penalty?: number;
}
/**
 * A wish: a standing goal that pulls someone toward what would grant it
 * until it comes true (or fades). A dream is a life's wish: one at a time,
 * and it never fades.
 */
export interface WishDef {
    id: Id;
    label?: string;
    /** Its words in a story (Irulan) when it's wished, as they'd follow the person's name: 'dreamed of becoming an expert baker'. Without it, 'wished for <label>'. A list is variants. */
    tell?: string | string[];
    /** Who may wish it, and when: conditions on the person. */
    if?: Cond[];
    /** How likely it is to be wished, against the others that fit: a number, considerations multiplied, or a function. Default 1. */
    weight?: number | Consideration[] | ((ctx: Ctx) => number);
    /**
     * What it's about, worked out when it's wished (a favorite dish, a friend
     * to see): a term, or a function. Undefined or null means it can't be
     * wished now. Kept with the wish; when it's a person, the wish is aimed at
     * them.
     */
    about?: string | ((ctx: Ctx) => Value | undefined);
    /** What it pulls them toward while they hold it: action or task ids, or 'tag:<tag>'. */
    toward?: string[];
    /** How much more those weigh. Default config.wishPull (1.35). */
    pull?: number;
    /** What grants it: finishing one of these (ids or 'tag:<tag>'); aimed at its person, if it's about one. */
    by?: string[];
    /** Or these conditions coming true (checked each hour and whenever they finish something). */
    when?: Cond[];
    /** Or progress reaching 1: a term or a function, read each hour (a dream's progress). */
    progress?: string | ((ctx: Ctx) => number);
    /** A dream: a life's wish, held one at a time, and it never fades. */
    dream?: boolean;
    /** Minutes before it fades if it isn't granted. Default config.wishMinutes (1.5 days); 0 never fades. */
    minutes?: number;
    /** Wished at most once in a life (default: dreams yes, wishes no). */
    once?: boolean;
    /** Effects when it's granted, and when it fades. ctx.data.x is what it was about (and ctx.target, if a person). */
    then?: Effect[];
    fades?: Effect[];
    /** A wish given at once when this one is granted (the next step of a dream). */
    next?: Id;
}
/** A wish someone holds. */
export interface HeldWish {
    id: Id;
    /** When it was wished. */
    t: Minutes;
    /** When it fades (none: never). */
    until?: Minutes;
    /** What it's about. */
    x?: Value;
    dream?: boolean;
}
/** A step in a task's method. */
export type Step = Id | `go:${string}` | `wait:${number}` | `get:${string}`
/** An action at a place spec, aimed at someone, or taking these minutes instead of its own. */
 | {
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
    /**
     * Aimed at someone: chosen only when something names who (a directive's
     * target, a module's option: Morgul's revenge), never freely. The plan
     * keeps them: its methods' conditions read them as the target, its steps
     * whose action is aimed at someone are aimed at them, and 'target' as a
     * place (or a step's target) is where they are (or who they are).
     */
    target?: 'person';
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
    /** Conditions checked whenever the routine is read ('fact:raining', 'var.money<20'). Strings only. */
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
    /** Starting skill levels. */
    skills?: Record<Id, number>;
    /** How fast they learn each skill: a multiplier on its rate (default 1). Delos fills these in from a genome. */
    talents?: Record<Id, number>;
    /** Inborn tastes: a standing multiplier on an action's (or task's) weight (default 1). Delos fills these in from a genome. */
    instincts?: Record<Id, number>;
    /**
     * This person's own pace for the headline knobs, by module ('core' for
     * the minds themselves): { fellowship: { friendship: 2 }, reverie: { breaks: 0.5 } }.
     * Each multiplies the world's knob for them alone (default 1). See docs/tuning.md.
     */
    tune?: Record<string, Record<string, number>>;
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
    /** Travel only: how long the action at the end takes (a plan step's own minutes). */
    minutes?: Minutes;
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
    /** Who it's aimed at (a task with `target: 'person'`). */
    target?: Id;
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
    /** Failures at one moment: [time, how many] (a guard against failing in a loop). */
    fails?: [Minutes, number];
    /** Skill levels: [level, when last practiced]. Made on first practice. */
    skills?: Record<Id, [number, Minutes]>;
    /** Tolerance of pastimes that pall: [tolerance, when it was set]. */
    tol?: Record<string, [number, Minutes]>;
    /** Wishes and a dream held now. */
    wishes?: HeldWish[];
    /** How many times each wish has come true. */
    granted?: Record<Id, number>;
}
/** An order from the story layer: overrides job and routine. */
export interface Directive {
    /** An action or task to do. */
    do: Id;
    at?: PlaceSpec;
    target?: Id;
    /** Until this time (minutes); default until done once. */
    until?: Minutes;
    /** Rank; default config.storyRank (3). */
    rank?: number;
    /** Done once already. */
    done?: boolean;
    /** Repeat until `until`. */
    repeat?: boolean;
    /** What it's for, in words: shown by Palantír and logged. */
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
    /** Irulan: what matters, kept beyond the log (with config.storySize). */
    story?: LogEntry[];
    /** Module state, by module name. */
    mod: Record<string, any>;
    /** State the game keeps with the world so it rewinds too. */
    game: Record<string, unknown>;
    /** Draws from the world's own stream. */
    n: number;
    /** Ids handed out at runtime. */
    ids: number;
    /**
     * Settings changed during play (world.tune), by module ('core' for the
     * config): each over what was declared. Absent until something is tuned.
     */
    tune?: Record<string, Record<string, Value | Value[] | Record<string, Value>>>;
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
    /** The ranks of the layered stack: a directive (unless it says its own), a job's shift, a routine entry (unless it says its own). Defaults 3, 2 and 1. */
    storyRank: number;
    jobRank: number;
    routineRank: number;
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
    /** Minutes an action is ruled out at a place after it failed there. Default 15. */
    backoff: number;
    /** Milliseconds of thinking per frame. Default 4. */
    budgetMs: number;
    /** Westmarch log size. Default 1000. */
    logSize: number;
    /**
     * Irulan's story: entries that matter kept beyond the log, so storylines
     * can be followed for weeks (world.s.story; it saves and rewinds). This
     * many at most, the least that matters going first. Default 0: off.
     */
    storySize: number;
    /** What an entry must weigh to be kept in the story (Irulan's weights). Default 0.3. */
    storyMin: number;
    /** Palantír keeps this many decisions per person. Default 12. */
    decisions: number;
    /**
     * A check (a boundary or an urge) already queued for someone at a moment
     * isn't queued again, so each is thought over once. Default false: every
     * call queues one, and someone who keeps on with what they're doing can
     * think the same moment over several times.
     */
    checksOnce: boolean;
    /** Habit learning rates and bounds. */
    habitFast: number;
    habitSlow: number;
    /** How far the fast habit weight is pulled back toward 1 each time it learns. Default 0.02. */
    habitDrift: number;
    habitMin: number;
    habitMax: number;
    /** Compensate for the number of considerations (IAUS). Default true. */
    compensate: boolean;
    /** Pastimes that pall: tolerance one go adds, tolerance lost per hour, and the share of appeal lost at full tolerance. */
    pallGain: number;
    pallDecay: number;
    pallPenalty: number;
    /** Wishes held at once (not counting a dream). Default 2. */
    wishMax: number;
    /** The hours new wishes (and dreams) may come, each with config.wishChance. Default [8, 13, 17]. */
    wishHours: number[];
    wishChance: number;
    /** Minutes before an unmet wish fades. Default 2160 (a day and a half). */
    wishMinutes: number;
    /** How much more a wish's `toward` actions weigh. Default 1.35. */
    wishPull: number;
    /** How fast every need rises (2: twice as fast, so people eat, sleep and seek company more often). Default 1. */
    needs: number;
    /** How fast habits form and fade (habitFast, habitSlow and the pull back to neutral). 0 freezes them. Default 1. */
    habits: number;
    /** How fast skills are learned (every skill's rate, on top of talents). 0 learns nothing. Default 1. */
    learning: number;
    /** How often new wishes and dreams come (wishChance). 0 brings none. Default 1. */
    wishes: number;
    /** How many strangers pass each hour (every region's perHour). Default 1. */
    crowds: number;
    /** The trait a person has when their definition doesn't give it (the `trait` term, and every module that reads traits). Default 0.5. */
    traitDefault: number;
    /** Default starting level of a need with no `start`. Default 0.2. */
    needStart: number;
    /** Default curve a need's level goes through to make its urgency. Default 'pow1.5'. */
    needCurve: Curve;
    /** An option's relief for a need counts as no more than the need's level, but at least this. Higher: needs nearly met still pull. Default 0.05. */
    reliefFloor: number;
    /** An urgent need lifts an option's rank only if it relieves at least this much. Lower: smaller things break routines. Default 0.3. */
    liftRelief: number;
    /** A need this high (or its `urgent`, if higher) is desperate: it lifts options above work. Default 0.97. */
    desperate: number;
    /** Rank added per point of level past desperate (so starving wakes the exhausted). Default 10. */
    desperateSlope: number;
    /** A go counts as at most this many times as good as expected when habits learn. Default 2. */
    habitBest: number;
    /** The share of a go that must be done for habits to learn from it. Default 0.2. */
    habitDone: number;
    /** The share of a reward (world.reward) that reaches the slow habit. Default 0.25. */
    nudgeSlow: number;
    /** Below this tolerance a pastime doesn't pall at all. Default 0.05. */
    pallFrom: number;
    /** The share of a go at a pastime that must be done for it to add to the tolerance. Default 0.2. */
    pallDone: number;
    /** Minutes after doing something that a free choice of it again counts as 'did it last'. Default 90. */
    repeatWindow: number;
    /** Most people an action aimed at someone is weighed against at once. Default 6. */
    targets: number;
    /** Most people someone meets on starting something with others about (regard, gossip, colds). Default 3. */
    meetMax: number;
    /** The shortest time together, in minutes, that counts as meeting. Default 3. */
    meetMinutes: number;
    /** Coming back from away, needs are at most this. Default 0.4. */
    awayNeeds: number;
    /** Default level gained per hour of practice, for a skill with no `rate`. Default 0.02. */
    skillRate: number;
    /** Default days without practice before a skill with `decay` starts to slip. Default 3. */
    skillGrace: number;
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
    /** Keep this many minutes of history. Default 1440 (one day). */
    keep: number;
    /** Older than this many minutes, keep only one snapshot per `sparseEvery`. Default 240. */
    sparseAfter: number;
    /** Minutes between the snapshots kept past `sparseAfter`. Default 60. */
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
    /** 0..1: how bad it was, for a crime (Wormtongue): over the crime's own severity, for the witnesses' memories and the heat. */
    severity?: number;
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
    /** How long it takes, in place of the action's own minutes (a plan step's). */
    minutes?: Minutes;
}
export interface Decision {
    t: Minutes;
    who: Id;
    picked: Candidate | null;
    candidates: Candidate[];
    /** The best option at the top rank, and what it beat. */
    reason: string;
}
