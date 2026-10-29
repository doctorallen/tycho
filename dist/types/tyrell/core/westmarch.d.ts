import type { Id, LogEntry, Minutes } from './types';
import type { World } from './world';
export interface LogFilter {
    k?: string | string[];
    who?: Id;
    since?: Minutes;
    until?: Minutes;
}
export declare class Westmarch {
    private w;
    constructor(w: World);
    /** Writes an entry and tells the game. */
    write(k: string, who?: Id, d?: Record<string, unknown>): void;
    /** Entries matching a filter, oldest first. */
    find(f?: LogFilter): LogEntry[];
    /** Everything since a time. */
    since(t: Minutes, k?: string | string[]): LogEntry[];
    /** Is an entry about someone: by them, or naming them as its target (target, for or to)? */
    about(e: LogEntry, who: Id): boolean;
    /**
     * One entry in plain words, as they'd follow the person's name: "set out
     * for The Market", "felt Nothing went right", "told Kofi about did:sam:theft".
     * People and places by their names, actions, tasks and wishes by their
     * labels; an entry with no person ("day", "fact") reads on its own. Every
     * kind gets words, and a kind it doesn't know comes out as its name and its
     * data. A look: it reads the state and changes nothing.
     */
    describe(e: LogEntry): string;
    /**
     * A short chronicle of someone's day since a time, in plain sentences:
     * "08:10 set out for the cafe", "08:24 started eat_bread at cafe". Instead
     * of a time it takes a list of entries (the game's own, kept from the 'log'
     * events, to reach back further than the log keeps).
     */
    chronicle(who: Id, since: Minutes | LogEntry[]): string[];
}
