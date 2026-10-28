import type { Id, PersonState, PlaceDef, PlaceSpec, PlaceState } from './types';
import type { World } from './world';
export declare class Ring {
    private w;
    readonly defs: Map<string, PlaceDef>;
    private links;
    private cache;
    private byTag;
    constructor(w: World);
    /** Declares a place. */
    place(def: PlaceDef): void;
    private fresh;
    /** Joins two places with a walk of this many minutes (both ways unless oneWay). */
    link(a: Id, b: Id, minutes: number, oneWay?: boolean): void;
    get(id: Id | null | undefined): PlaceDef | undefined;
    state(id: Id): PlaceState;
    /** Every place with a tag. */
    tagged(tag: string): Id[];
    hasTag(id: Id | null | undefined, tag: string): boolean;
    /** The region a place is in: its own, or its parent's, or 'world'. */
    region(id: Id | null | undefined): string;
    /** The outermost place containing this one. */
    root(id: Id): Id;
    /** Is `inner` the place `outer` or somewhere inside it? */
    within(inner: Id | null | undefined, outer: Id): boolean;
    /** Is the place open at a time (its own hours and every parent's)? */
    open(id: Id, t?: number): boolean;
    /** The capacity of a slot (0 if the place has no such slot). */
    capacity(id: Id, slot: string): number;
    /** Who holds a slot. */
    holders(id: Id, slot: string): Id[];
    /** Free places in a slot (Infinity when the place doesn't limit it). */
    free(id: Id, slot: string | undefined): number;
    /** May this person take the slot (its `who` conditions)? */
    allowed(id: Id, slot: string | undefined, p: PersonState | undefined): boolean;
    /** Takes a slot. False if it's full or the person may not use it. */
    claim(id: Id, slot: string | undefined, who: Id): boolean;
    /** Lets go of a slot. */
    release(id: Id | null | undefined, slot: string | undefined, who: Id): void;
    /** Everyone at a place right now (doing something there, not walking through). */
    present(id: Id): Id[];
    /** Share of a place's capacity in use (0..1). */
    crowd(id: Id): number;
    /** Travel time in minutes from a to b, for a person. */
    travel(a: Id | null | undefined, b: Id | null | undefined, person?: PersonState): number;
    private dijkstra;
    /**
     * The candidate places for an action's place spec, for a person: nearest
     * first. 'here' and null mean where they are.
     */
    resolve(spec: PlaceSpec | PlaceSpec[] | undefined, person: PersonState, target?: Id): Id[];
}
