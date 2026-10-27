import type { Body, Candidate, Id, PersonState, QueueItem } from './types';
import type { World } from './world';
export declare class Entmoot {
    private w;
    /** Regions the game has loaded (not saved: the game says it again after a load). */
    private regions;
    /** Who has a body right now. */
    private near;
    private started;
    /** The seq of the event being handled, or null (World defers inputs made meanwhile). */
    handling: number | null;
    constructor(w: World);
    /** Called once at creation: starts the hourly tick. */
    boot(): void;
    /** Forgets transient things (after a load or a seek). */
    reset(): void;
    /** Puts something on the queue. */
    schedule(item: Omit<QueueItem, 'seq'>): number;
    /** Queues the end of someone's current doing; the doing carries the same seq. */
    private scheduleEnd;
    /**
     * Runs events up to time `target`. Inputs Esper still has in its future
     * (after a rewind) are applied at their times. With a budget, stops early
     * (at a whole timestamp) and returns false; the rest runs next frame.
     */
    advanceTo(target: number, budgetMs: number): boolean;
    /** Handles one event, then the inputs that came in while it was handled. */
    private run;
    private handle;
    /** Has someone think after a delay (minutes). */
    wake(p: PersonState, delay: number, mode?: string): void;
    /** Thinks and starts whatever wins. */
    think(p: PersonState): void;
    /**
     * Thinks again while busy (a routine boundary, an urgent need): switches
     * only if something now outranks what they're doing.
     */
    reconsider(p: PersonState, mode: string): void;
    /** Interrupts and thinks again now. */
    rethink(p: PersonState, why: string): void;
    /** Nothing to do: wait where they are, then think again. */
    idle(p: PersonState): void;
    /** Starts an option: walks there first if it's somewhere else. */
    begin(p: PersonState, c: Candidate): void;
    private travelTo;
    /** Starts the action itself, here. */
    act(p: PersonState, c: Candidate): void;
    /** The action or walk ran its course. */
    finish(p: PersonState): void;
    /** Applies what finishing (some of) an action does: relief, effects, learning. */
    private complete;
    /** What happens after a step: the plan goes on, or they think again. */
    private afterStep;
    /** Stops what they're doing, keeping what they got from it so far. */
    interrupt(p: PersonState, why: string, suspendPlan: boolean): void;
    /**
     * Something went wrong: the slot was taken, the door was shut. The action
     * is ruled out at that place for config.backoff minutes, and they think
     * again. `what` names what failed when it never became their doing.
     */
    fail(p: PersonState, why: string, alreadyStopped?: boolean, what?: {
        action: Id;
        place: Id | null;
    }): void;
    /** The game says they're done early. */
    finishNow(p: PersonState): void;
    /** Re-checks for urgent needs and stack changes while busy. */
    scheduleChecks(p: PersonState): void;
    /** People at the same place meet: modules hear about it (regard, gossip, talk). */
    private meet;
    /** Followers do what their leader does. */
    private carryFollowers;
    /** A fact changed: places that closed turn people away when they get there. */
    factChanged(_key: string): void;
    sendAway(id: Id, until: number, summary: string, place: Id | null): void;
    private comeBack;
    removePerson(id: Id, why: string): void;
    focus(regions: string[]): void;
    regionsInFocus(): string[];
    /** Is someone in a focused region (or does the shell say they're visible)? */
    isNear(p: PersonState): boolean;
    /** Emits embody and disembody for whoever came into or left view. */
    refreshBodies(): void;
    /** Tells the game a near person started something new. */
    announce(p: PersonState): void;
    /** Is this person embodied right now? */
    embodied(id: Id): boolean;
    bodies(): Body[];
    body(id: Id): Body | null;
}
