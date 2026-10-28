import type { Body, Id, PersonDef } from './types';
import type { World } from './world';
import { Stream } from './util';
export interface StrangerErrand {
    /** Where they come from (a street end, a station). */
    from: Id;
    /** Where they're going. */
    to: Id;
    /** What they do there (an action id, for its pose). Default: they pass through. */
    action?: Id;
    /** How long they stay: minutes or [min, max]. Default 0 (passing through). */
    minutes?: number | [number, number];
    weight?: number;
    /** Only during these hours. */
    hours?: [number, number];
}
export interface StrangerDef {
    /** How many set out each hour: one number, or 24 (one per hour of the day). */
    perHour: number | number[];
    errands: StrangerErrand[];
    /** Fills in what the game needs to draw one (a look), from their own stream. */
    data?: (r: Stream, id: string) => Record<string, unknown>;
}
export declare class Strangers {
    private w;
    private defs;
    constructor(w: World);
    /** Who's been promoted (read only: looking at strangers changes nothing). */
    private store;
    /** Declares the passers-by of a region. */
    define(region: string, def: StrangerDef): void;
    /** The strangers in a region at a time (default now), as bodies. */
    at(region: string, t?: number): Body[];
    /** One stranger by id ('~region:hour:i'), as a body at a time. */
    find(sid: string, t?: number): Body | null;
    private make;
    /** Turns a stranger into a person with a mind. Returns the new person's id. */
    promote(sid: string, def?: PersonDef, id?: Id): Id;
    /** Has this stranger been promoted, and to whom? */
    promoted(sid: string): Id | undefined;
}
