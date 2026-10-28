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
    /**
     * A short chronicle of someone's day since a time, in plain sentences:
     * "08:10 set out for the cafe", "08:24 started eat_bread at cafe".
     */
    chronicle(who: Id, since: Minutes): string[];
}
