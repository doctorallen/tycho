import type { Module } from '../core/module';
import type { ActionDef, Candidate, Id, PersonState, Step } from '../core/types';
import type { World } from '../core/world';
export interface MentatConfig {
    /** Replans before giving up. */
    maxTries: number;
    /** How deep 'get:' looks (getting a part to make the thing to get). */
    depth: number;
    /** Minutes of effort one unit of money is worth, before thrift. */
    priceWeight: number;
    /** How long people keep at a plan: the replans before they give up (maxTries). 0: they give up at the first failure. Default 1. */
    persistence: number;
    /** How much their scruples cost a way of getting something: the extra cost of illegal ways (risk) and of ways against their values. 0: none (the honest and the devout still never). Default 1. */
    scruples: number;
    /** Minutes, at least, before a task given up on is chosen again. Default 120. */
    giveUp: number;
    /** Plans kept set aside at once (an urgent need interrupted them). Default 2. */
    setAside: number;
    /** Minutes after it began that a plan set aside is dropped instead of picked up again. Default 1440. */
    stale: number;
    /** Illegal ways: never for honesty this high; otherwise riskBase + honesty × riskHonesty + heat × riskHeat minutes. Defaults 0.8, 60, 300 and 20. */
    honestNever: number;
    riskBase: number;
    riskHonesty: number;
    riskHeat: number;
    /** Ways against a value: never if it's held this much; otherwise held × valuesCost minutes. Defaults 0.9 and 200. */
    valuesNever: number;
    valuesCost: number;
}
export declare const DEFAULT_MENTAT: MentatConfig;
interface Route {
    steps: Step[];
    cost: number;
}
export declare class Mentat implements Module {
    readonly name = "mentat";
    readonly config: MentatConfig;
    readonly knobs: {
        readonly persistence: "person";
        readonly scruples: "person";
    };
    private w;
    constructor(cfg?: Partial<MentatConfig>);
    /** The config in force: as declared, under any world.tune. */
    private get c();
    /** A headline knob for someone: the world's, times their own. */
    private knob;
    attach(w: World): void;
    /** Starts a task: picks a method and returns the first step to do. */
    begin(p: PersonState, c: Candidate): Candidate | null;
    private methodName;
    /** Chooses a method for a task (the first not yet failed whose conditions hold) and pushes it. */
    private push;
    /** The next step of the plan as an option to start, or null when it's over. */
    private next;
    private cand;
    /** Where a go: step walks to: the nearest declared place its spec names that they can get to. */
    private destination;
    /** An action step: the nearest place where it can be done now. */
    private actionStep;
    private complete;
    /** The step went fine: the next one. */
    stepDone(p: PersonState, ok: boolean): Candidate | null;
    /** The step failed: the method is marked failed and the task replanned. */
    stepFailed(p: PersonState, why: string): Candidate | null;
    private fail;
    private giveUp;
    /** Sets a plan aside (something urgent came up). */
    suspend(p: PersonState): void;
    /** Picks a set-aside plan back up, unless the new choice outranks it. */
    resume(p: PersonState, pick: Candidate | null): Candidate | null;
    /** Every action that gives an item. */
    providers(item: Id): ActionDef[];
    /** The cheapest way for a person to get an item: steps and cost, or null. Changes nothing. */
    acquire(p: PersonState, item: Id, depth: number, seen: Set<Id>): Route | null;
    private route;
    /** What an action costs a person, in minutes of effort: time, money by thrift, risk by honesty. */
    cost(p: PersonState, a: ActionDef): number;
}
export {};
