import type { ActionDef, Candidate, Consideration, Ctx, Curve, Decision, Doing, HeldWish, Id, PersonState, PlaceSpec, RoutineEntry, Value } from './types';
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
/** The cooldown key that rules an action out at a place for a while after it failed there. */
export declare const backoffKey: (action: Id, place: Id | null | undefined) => string;
export declare class Bicameral {
    private w;
    /** The modules that change how fast needs rise (found on first use). */
    private rateHooks;
    constructor(w: World);
    /** How fast a need rises for someone now, as a multiplier on its `rise` (modules' `rate`; 1 with none). */
    riseMul(p: PersonState, need: Id): number;
    /** A need's level at time t (default now), counting any relief in progress. */
    level(p: PersonState, need: Id, t?: number): number;
    /**
     * Folds a finished (or stopped) action's effect on needs' rise into their
     * stored levels, for needs it changed the rate of. Called before relief.
     */
    settle(p: PersonState, d: Doing): void;
    /**
     * Keeps the rise so far in every need's stored level (relief in progress
     * aside), so how fast needs rise can change from now on. Modules call it
     * before their `rate` answer changes.
     */
    settleRise(p: PersonState): void;
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
    /** The kind of pastime an action is (its `palls`), or null. */
    pallKind(a: {
        id: Id;
        palls?: string | boolean;
    } | undefined): string | null;
    /** How much of a pastime someone has had lately, 0..1 (it wears off by the hour). */
    tolerance(p: PersonState, kind: string, t?: number): number;
    /** One more go at a pastime (inside the simulation). */
    applyPall(p: PersonState, kind: string): void;
    private matches;
    private isPerson;
    /** The context a held wish's conditions and effects see: what it's about in data.x (and as the target, if a person). */
    wishCtx(p: PersonState, h: HeldWish): Ctx;
    private aboutOf;
    /** How far along a wish with `progress` is (0..1). */
    progressOf(p: PersonState, h: HeldWish): number | null;
    /** The wishes (and the dream) someone holds now, with what they're about. */
    wishesOf(p: PersonState): Array<HeldWish & {
        label: string;
        progress?: number;
    }>;
    /** The pull of the wishes someone holds on an option: at most one wish and one dream count. */
    private wishPull;
    /** Gives someone a wish (inside the simulation). Returns false if they can't wish it now. */
    applyWish(p: PersonState, id: Id, about?: Value): boolean;
    private dropWish;
    /** A wish comes true (inside the simulation). */
    applyGrant(p: PersonState, h: HeldWish): void;
    private fade;
    /** Grants any wish whose `by` the doing was, or whose `when` holds now. */
    private checkWishes;
    /** The wishes someone could wish now, each with its weight and what it would be about. */
    private wishable;
    /** Now and then, a new wish (and a dream, for someone without one). */
    private rollWishes;
    /** An action ended (Entmoot calls this): a pastime palls, and wishes it grants come true. */
    finished(p: PersonState, d: Doing, frac: number, interrupted: boolean): void;
    /** Every hour (Entmoot calls this): wishes are checked, fade, and new ones come at the wish hours. */
    hour(t: number): void;
    /** The terms, effects and inputs for pastimes and wishes (World calls this once). */
    register(): void;
    /** Picks from options: top rank, cut the weak, a weighted draw. */
    pick(p: PersonState, options: Candidate[]): {
        picked: Candidate | null;
        reason: string;
    };
    /** Thinks: weighs every option, picks one, and records the decision. */
    decide(p: PersonState): Decision;
    /** Weighs one action or task now for the inspector, even if it wasn't considered. Changes nothing. */
    explain(p: PersonState, id: Id): Candidate[];
    private explainNow;
}
