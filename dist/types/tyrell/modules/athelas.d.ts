import type { Module } from '../core/module';
import type { Candidate, Cond, Consideration, Effect, Id, PersonState, QueueItem } from '../core/types';
import type { World } from '../core/world';
/** Where a phase goes next, chosen by conditions: the first branch whose conditions hold. */
export interface CourseBranch {
    /** Conditions on the person (ctx.data.course is the course): 'tended:cut', 'sev:cut>0.5'. None: always. */
    if?: Cond[];
    /** The phase it goes to, by id; null: the course passes. */
    to: Id | null;
}
/** One phase of a course. */
export interface CoursePhase {
    id: string;
    label?: string;
    /**
     * Only for some: conditions on the person (ctx.data.course is the course),
     * read as the phase would start. One whose conditions don't hold is passed
     * over, as if it had run out at once (to its `next`), with nothing logged:
     * ale past a pint or two, 'sev:ale>0.6'. None: always.
     */
    if?: Cond[];
    /** How long it lasts: minutes, or [min, max] (drawn from the person's stream). */
    minutes: number | [number, number];
    /** Longer or shorter for some (hardiness): considerations on the person, multiplied into the minutes. */
    scale?: Consideration[];
    /** Needs rise this much faster or slower while it lasts: { energy: 1.6, hunger: 0.3 }. */
    rates?: Record<Id, number>;
    /** Options weigh this much more or less while it lasts: by action or task id, 'tag:<tag>', or '*' for the rest. */
    weigh?: Record<string, number>;
    /** Actions or tasks ruled out while it lasts: ids, or 'tag:<tag>'. */
    blocks?: string[];
    /** A feeling given when it starts (Reverie). Not in a quiet phase. */
    feel?: Id;
    /** Effects when it starts. */
    then?: Effect[];
    /** Stops what they're doing when it starts, so they choose again (laid up in bed). */
    stop?: boolean;
    /** Whether it can be caught from someone in this phase (with the course's `contagion`). Default true. */
    spreads?: boolean;
    /**
     * Where it goes when it runs out: a phase's id, null (the course passes),
     * or branches tried in order, the first whose conditions hold (a tended cut
     * heals, an untended one festers). Default, or when no branch holds: the
     * next phase in order, and after the last, the course passes.
     */
    next?: Id | null | CourseBranch[];
    /**
     * It ends in death: when it runs out they die (Cradle's departure, why
     * this or 'died'). Without Cradle, or spared (a wound's, by Morgul's
     * lethality), they pull through and it goes on as `next` says.
     */
    dies?: boolean | string;
    /**
     * Nobody notices it (poison working): it gives no feeling, and `under:`
     * reads it as not there, so lines and choices can't know of it. Its rates,
     * weights and blocks still work.
     */
    quiet?: boolean;
    /** The harm shows when it starts: the 'shows' event, and Morgul's onlookers and suspicion begin then. */
    tells?: boolean;
    /** How much of the course's severity it still counts toward Morgul's `hurt`: 1 at first, less as a wound heals. Default 1 (a quiet phase 0). */
    hurts?: number;
}
/** How severity changes a course (over the config's sevAt, sevStretch and sevDepth). */
export interface CourseSeverity {
    /** The severity its numbers are written for. */
    at?: number;
    /** How much severity stretches its phases. */
    stretch?: number;
    /** How much severity deepens what its phases do. */
    depth?: number;
}
/** A course: something that comes on, runs through its phases, and passes. */
export interface CourseDef {
    id: Id;
    label?: string;
    /**
     * Its words in a story (Irulan), as they'd follow the person's name: when
     * it comes on ('caught a cold') and when it's over ('shook off the cold').
     * Without them, 'came down with <label>' and 'got over <label>'. A list is
     * variants, one drawn for each telling.
     */
    tell?: {
        on?: string | string[];
        over?: string | string[];
    };
    /** Free labels ('illness'): `under:tag:<tag>` asks whether any course with the tag is running. */
    tags?: string[];
    /** The phases, in order. */
    phases: CoursePhase[];
    /** Caught from others: the chance per hour spent together, and considerations on the catcher (and the carrier as their target), multiplied in. */
    contagion?: {
        chance: number;
        resist?: Consideration[];
    };
    /** Minutes after it passes when it can't come on again. Default 0. */
    immunity?: number;
    /**
     * Afflicted again while it runs: 'ignore' (default), 'extend' (the phase
     * runs on as long again: another pint), 'restart', or 'worsen' (the new
     * severity adds to the old, up to 1: a second beating).
     */
    again?: 'ignore' | 'extend' | 'restart' | 'worsen';
    /** Its own numbers for how severity changes it, over the config's. */
    severity?: CourseSeverity;
    /** Effects when it passes (not when it's cured). */
    then?: Effect[];
}
export interface AthelasConfig {
    /**
     * The headline knobs: plain multipliers, 1 changing nothing. A person's own
     * (PersonDef.tune.athelas) multiplies these for them alone: the catcher's
     * for contagion, the sufferer's for duration.
     */
    /** How catching courses are: every course's contagion chance per hour together. 0: nothing spreads. Default 1. */
    contagion: number;
    /** How long courses last: every phase's minutes (when it starts). Default 1. */
    duration: number;
    /** The severity a course's numbers are written for: at it, its phases run as written. Default 0.5. */
    sevAt: number;
    /** How much severity stretches the phases: each lasts sevStretch^((severity - sevAt) × 2) times as long (2: twice as long at 1, half at 0). 1: severity doesn't change how long. Default 2. */
    sevStretch: number;
    /** How much severity deepens what a phase does: its rates and weights are raised to the power 1 + sevDepth × (severity - sevAt) / sevAt (twice as deep at 1, nothing at 0). 0: severity doesn't change them. Default 1. */
    sevDepth: number;
    /** How good a tending is, 0..1: tendBase, plus the rest by the tender's share of tendSkill. Default 0.5. */
    tendBase: number;
    /** The skill that makes a tending better (null: none, every tending is tendBase). Default null. */
    tendSkill: string | null;
    /** A tending brings the end of the phase they're in sooner by this share of what's left, times how good it was. Default 0.25. */
    tendHasten: number;
}
export declare const DEFAULT_ATHELAS: AthelasConfig;
/** A course running for someone, as the game sees it. */
export interface CourseView {
    course: Id;
    label: string;
    phase: string;
    phaseLabel: string;
    since: number;
    until: number;
    from?: Id;
    /** Its severity, if it was given one. */
    severity?: number;
    /** How well it's been tended, once tended. */
    tended?: number;
    /** In a quiet phase: nobody has noticed it. */
    quiet?: boolean;
}
export declare class Athelas implements Module {
    readonly name = "athelas";
    readonly config: AthelasConfig;
    readonly knobs: {
        readonly contagion: "person";
        readonly duration: "person";
    };
    readonly courses: Map<string, CourseDef>;
    private w;
    constructor(cfg?: Partial<AthelasConfig>);
    /** The config in force: as declared, under any world.tune. */
    private get c();
    /** A headline knob for someone: the world's (as tuned), times their own. */
    private knob;
    /** The state for reading: undefined until someone is first afflicted. */
    private get st();
    /** The state for writing (inside the simulation): made when first needed. */
    private mut;
    attach(w: World): void;
    course(def: CourseDef): this;
    /** The courses running for someone: which phase, since and until when, and how bad, tended and noticed. */
    of(id: Id): CourseView[];
    /** Is someone immune to a course now? */
    immune(id: Id, course: Id): boolean;
    /** A course's severity for someone: its own, or the severity its numbers are written for; undefined if it isn't running. */
    severityOf(id: Id, course: Id): number | undefined;
    /** The phase a course is in for someone, if it's running (the truth: quiet or not). */
    phaseOf(id: Id, course: Id): CoursePhase | undefined;
    /**
     * Afflicts someone with a course (from the game: recorded), at a severity
     * (0..1) if it's given one. Returns whether it took.
     */
    afflict(id: Id, course: Id, from?: Id, severity?: number): boolean;
    /** Cures someone of a course, or of every course (from the game: recorded). */
    cure(id: Id, course?: Id): void;
    /** Brings the end of the phase someone's in sooner by some minutes (a visit, a remedy that helps): recorded. */
    hasten(id: Id, course: Id, minutes: number): void;
    /** Someone tends someone's course (or every course they have), by someone if given (their skill counts): recorded. */
    tend(id: Id, course?: Id, by?: Id): void;
    /** The severity a course's numbers are written for, how much severity stretches it, and how much it deepens it. */
    private sevOf;
    private severity;
    /** How much longer a phase runs at a severity: stretch^((severity - at) × 2). */
    private stretch;
    /** How much deeper what a phase does goes at a severity: rates and weights are raised to this power. */
    private depth;
    /** Is a course in a quiet phase (nobody notices it)? */
    private quiet;
    private phaseMinutes;
    private schedule;
    private label;
    /** Afflicts someone, inside the simulation (at a severity, 0..1, if given). */
    applyAfflict(id: Id, course: Id, from?: Id, sev?: number): boolean;
    /** Starts a phase (needs settled by the caller); one whose `if` doesn't hold is passed over, and with none left the course passes. */
    private enter;
    /** A course passes, or is cured (needs settled by the caller). */
    private end;
    /** Where a course goes from a phase that ran out: a phase's index, or -1 to pass. */
    private nextOf;
    /** Does a phase that ends in death take them? Only through Cradle, and (a wound) only as often as Morgul's lethality says. */
    private dies;
    /** Brings a phase's end sooner (or, with a negative number, later), inside the simulation. */
    applyHasten(id: Id, course: Id, minutes: number): void;
    /** Cures someone of a course (or all of them), inside the simulation. */
    applyCure(id: Id, course?: Id): void;
    /**
     * Someone's course is tended (or every course they have), inside the
     * simulation: a mark of how well (tendBase, the rest by the tender's skill
     * in tendSkill), which the branches read, and the phase they're in ends
     * sooner by tendHasten of what's left, times that. Returns how well, or 0
     * if there was nothing to tend.
     */
    applyTend(id: Id, course?: Id, by?: Id): number;
    timer(item: QueueItem): void;
    rate(p: PersonState, need: Id): number;
    /** The phase's `weigh` entry for an option: its id, else a tag it has, else '*'. */
    private weighFor;
    consider(p: PersonState, c: Candidate): Array<[string, number]> | void;
    block(p: PersonState, c: Candidate): string | null;
    /** Someone with a catching course passes it on, now and then, to whoever they spend time with. */
    private spread;
    met(a: PersonState, b: PersonState, _place: Id, minutes: number): void;
    /** Immunities that have run out are let go. */
    day(): void;
    removed(p: PersonState): void;
}
