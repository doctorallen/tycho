import type { ActionDef, Candidate, Consideration, Ctx, Curve, Decision, Doing, Id, PersonState, PlaceSpec, RoutineEntry } from './types';
import type { World } from './world';
/** What a layer of the stack requires right now. */
export interface Requirement {
    do: Id;
    at: PlaceSpec | undefined;
    rank: number;
    layer: 'story' | 'job' | 'routine';
    /** When the requirement ends (minutes). */
    until: number;
    target?: Id;
    with?: Id;
    /** '*' activities: anything at this place. */
    any?: boolean;
}
/** Evaluates a response curve at x in [0, 1]. */
export declare function curveAt(curve: Curve | undefined, x: number): number;
export declare class Bicameral {
    private w;
    constructor(w: World);
    /** A need's level at time t (default now), counting any relief in progress. */
    level(p: PersonState, need: Id, t?: number): number;
    /** Sets a need's level now. */
    setLevel(p: PersonState, need: Id, v: number): void;
    /** Makes sure a person has every declared need. */
    ensureNeeds(p: PersonState): void;
    private quality;
    /** The urgency of a need: its level through its curve. */
    urgency(p: PersonState, need: Id, t?: number): number;
    /**
     * When the next need will cross a line that matters: urgent, desperate, or
     * at its worst (Infinity if none will). Each can lift an option's rank.
     */
    urgentAt(p: PersonState): number;
    /** Applies an action's relief: frac of it, for a person, at the end. Returns realized vs expected. */
    relieve(p: PersonState, d: Doing, frac: number): {
        got: number;
        expected: number;
    };
    /** The level now ignoring relief in progress (the doing is ending). */
    private levelRaw;
    private urgencyAt;
    habit(p: PersonState, id: Id): number;
    /** Learns from how an action went: realized relief against what was expected. */
    learn(p: PersonState, id: Id, got: number, expected: number, bonus?: number): void;
    /** A reward or a telling-off: nudges the habit directly. */
    nudge(p: PersonState, id: Id, amount: number): void;
    /** The routine plan for the day a time falls on (first matching variant). */
    routineFor(p: PersonState, t?: number): RoutineEntry[] | null;
    /** The routine entry in force at time t, and when it ends. */
    routineAt(p: PersonState, t?: number): {
        entry: RoutineEntry;
        until: number;
    } | null;
    /** Is the person on shift at time t, and until when? */
    shiftAt(p: PersonState, t?: number): {
        until: number;
    } | null;
    /** What the stack requires of a person now, highest layer first. */
    required(p: PersonState): Requirement[];
    /** The next time something in the stack changes for a person (routine entry, shift, directive). */
    nextBoundary(p: PersonState): number;
    /** Every option a person has now, weighed. */
    options(p: PersonState): Candidate[];
    /** Does a place offer an action? (the action asks for the place, its tag, or the place lists it) */
    offeredAt(a: ActionDef, place: Id | null, p: PersonState): boolean;
    /** Who an action aimed at someone could be aimed at, from a place. */
    targetsFor(p: PersonState, a: ActionDef, place: Id | null): Id[];
    private addOption;
    /** Why an option is ruled out for a person now, or null if it isn't. */
    blockedReason(p: PersonState, c: Candidate): string | null;
    /** Weighs one option: fills in weight, parts and rank (or blocked). */
    weigh(p: PersonState, c: Candidate, required: boolean): void;
    /** Evaluates one consideration to a factor. */
    consider(k: Consideration, ctx: Ctx, travel?: number): number;
    /** Picks from options: top rank, cut the weak, a weighted draw. */
    pick(p: PersonState, options: Candidate[]): {
        picked: Candidate | null;
        reason: string;
    };
    /** Thinks: weighs every option, picks one, and records the decision. */
    decide(p: PersonState): Decision;
    /** Weighs one action or task now for the inspector, even if it wasn't considered. */
    explain(p: PersonState, id: Id): Candidate[];
}
