import type { Module } from '../core/module';
import type { Candidate, Consideration, Effect, Id, PersonState, QueueItem } from '../core/types';
import type { World } from '../core/world';
/** One phase of a course. */
export interface CoursePhase {
    id: string;
    label?: string;
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
    /** A feeling given when it starts (Reverie). */
    feel?: Id;
    /** Effects when it starts. */
    then?: Effect[];
    /** Stops what they're doing when it starts, so they choose again (laid up in bed). */
    stop?: boolean;
    /** Whether it can be caught from someone in this phase (with the course's `contagion`). Default true. */
    spreads?: boolean;
}
/** A course: something that comes on, runs through its phases, and passes. */
export interface CourseDef {
    id: Id;
    label?: string;
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
    /** Afflicted again while it runs: 'ignore' (default), 'extend' (the phase runs on as long again: another pint), 'restart'. */
    again?: 'ignore' | 'extend' | 'restart';
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
}
export declare const DEFAULT_ATHELAS: AthelasConfig;
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
    /** A headline knob for someone: the world's (as tuned), times their own. */
    private knob;
    /** The state for reading: undefined until someone is first afflicted. */
    private get st();
    /** The state for writing (inside the simulation): made when first needed. */
    private mut;
    attach(w: World): void;
    course(def: CourseDef): this;
    /** The courses running for someone: which phase, since and until when. */
    of(id: Id): Array<{
        course: Id;
        label: string;
        phase: string;
        phaseLabel: string;
        since: number;
        until: number;
        from?: Id;
    }>;
    /** Is someone immune to a course now? */
    immune(id: Id, course: Id): boolean;
    /** Afflicts someone with a course (from the game: recorded). Returns whether it took. */
    afflict(id: Id, course: Id, from?: Id): boolean;
    /** Cures someone of a course, or of every course (from the game: recorded). */
    cure(id: Id, course?: Id): void;
    /** Brings the end of the phase someone's in sooner by some minutes (a visit, a remedy that helps): recorded. */
    hasten(id: Id, course: Id, minutes: number): void;
    private phaseMinutes;
    private schedule;
    private label;
    /** Afflicts someone, inside the simulation. */
    applyAfflict(id: Id, course: Id, from?: Id): boolean;
    /** Starts a phase (needs settled by the caller). */
    private enter;
    /** A course passes, or is cured (needs settled by the caller). */
    private end;
    /** Brings a phase's end sooner (or, with a negative number, later), inside the simulation. */
    applyHasten(id: Id, course: Id, minutes: number): void;
    /** Cures someone of a course (or all of them), inside the simulation. */
    applyCure(id: Id, course?: Id): void;
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
