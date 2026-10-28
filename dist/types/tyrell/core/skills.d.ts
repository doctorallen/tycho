import type { Id, PersonState, SkillDef } from './types';
import type { World } from './world';
export declare class Skills {
    private w;
    readonly defs: Map<string, SkillDef>;
    constructor(w: World);
    /** A skill's definition, or the defaults for one that was never declared. */
    def(id: Id): SkillDef;
    /** A person's level in a skill at time t (default now), forgetting included. */
    level(p: PersonState, id: Id, t?: number): number;
    /** How fast a person learns a skill: their talent for it (default 1). */
    talent(p: PersonState, id: Id): number;
    /** Every skill a person has practiced or started with, and its level now. */
    of(p: PersonState): Record<Id, number>;
    /** The name of the highest level reached (from the skill's `levels`), or null. */
    named(p: PersonState, id: Id): string | null;
    /**
     * Practice, inside the simulation: `hours` of it at the person's pace,
     * times `mul`. The progress is worked out exactly over the hours (eight
     * hours at once is the same as eight one-hour goes). Returns the new level.
     */
    applyTrain(p: PersonState, id: Id, hours: number, mul?: number): number;
    /** Sets a level outright, inside the simulation. */
    applySet(p: PersonState, id: Id, level: number): void;
    /** Keeps a new level, and marks any named level reached on the way up. */
    private store;
    /** An action ended: the skills it trains get the time spent on it. */
    practiced(p: PersonState, trains: Record<Id, number>, start: number): void;
    /** The terms, effects and inputs (World calls this once). */
    register(): void;
}
