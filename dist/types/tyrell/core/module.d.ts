import type { Candidate, Doing, Id, PersonState, QueueItem, Stimulus, Value } from './types';
import type { World } from './world';
export interface Module {
    readonly name: string;
    /** Called once, when the world is created: register terms, effects and inputs here. */
    attach(w: World): void;
    /** The module's fresh state. */
    init?(): unknown;
    /** Called after a save is loaded (state is in place). */
    loaded?(): void;
    /** Add options while someone thinks. */
    candidates?(p: PersonState, out: Candidate[]): void;
    /** Multiply factors into an option's weight: return [name, factor] pairs. */
    consider?(p: PersonState, c: Candidate): Array<[string, number]> | void;
    /** Rule an option out: return a reason, or null. */
    block?(p: PersonState, c: Candidate): string | null;
    /** Someone started doing something. */
    started?(p: PersonState, d: Doing): void;
    /** Someone finished (or stopped) doing something; frac is how much of it they did. */
    ended?(p: PersonState, d: Doing, frac: number, interrupted: boolean): void;
    /** Someone arrived at a place. */
    arrived?(p: PersonState, place: Id): void;
    /** Two people spent time together at a place. */
    met?(a: PersonState, b: PersonState, place: Id, minutes: number): void;
    /** Every game hour, on the hour. */
    hour?(t: number): void;
    /** Every midnight. */
    day?(day: number): void;
    /** A queue item addressed to this module came due. */
    timer?(item: QueueItem): void;
    /** Something was perceived. */
    sensed?(stim: Stimulus): void;
    /** Someone did something to or for someone (world.did). */
    did?(actor: Id, verb: string, data: Record<string, Value>): void;
    /** Someone joined the world. */
    added?(p: PersonState): void;
    /** Someone left the world for good. */
    removed?(p: PersonState, why: string): void;
}
