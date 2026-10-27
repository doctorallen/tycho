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
}
export declare const DEFAULT_MENTAT: MentatConfig;
interface Route {
    steps: Step[];
    cost: number;
}
export declare class Mentat implements Module {
    readonly name = "mentat";
    readonly config: MentatConfig;
    private w;
    constructor(cfg?: Partial<MentatConfig>);
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
    /** The cheapest way for a person to get an item: steps and cost, or null. */
    acquire(p: PersonState, item: Id, depth: number, seen: Set<Id>): Route | null;
    /** What an action costs a person, in minutes of effort: time, money by thrift, risk by honesty. */
    cost(p: PersonState, a: ActionDef): number;
}
export {};
