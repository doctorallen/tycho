/** Counts by kind: { wire: 3, glass: 1 }. */
export type Bag = Record<string, number>;
/** Kinds that stack by count, in a bag. */
export declare const bag: {
    /** How many of a kind (0 if none). */
    count(b: Bag, kind: string): number;
    /** How many in all: of the kinds given, or of every kind in the bag. */
    total(b: Bag, kinds?: string[]): number;
    /** Puts n of a kind in; returns how many went in (none for n <= 0). */
    add(b: Bag, kind: string, n: number): number;
    /** Takes n of a kind out if there are as many; false (and nothing taken) if not. */
    take(b: Bag, kind: string, n: number): boolean;
    /** Are there as many of each kind as a cost asks ({ wire: 2, glass: 1 })? */
    has(b: Bag, cost: Bag): boolean;
    /** Takes a cost out if it's all there; false (and nothing taken) if not. */
    pay(b: Bag, cost: Bag): boolean;
    /** Every count to 0 (those of the kinds given, each set even if it wasn't
     * there, or every kind in the bag); returns what there was, [kind, n] for
     * each above 0. */
    empty(b: Bag, kinds?: string[]): [string, number][];
    /** Moves everything from one bag into another (of the kinds given, in
     * their order, or of every kind in `from`), leaving 0 behind; returns what
     * moved, [kind, n] for each above 0. */
    move(from: Bag, to: Bag, kinds?: string[]): [string, number][];
    /** What a bag is worth: value(kind, count) summed over the kinds given (in
     * their order), or over every kind in the bag. */
    worth(b: Bag, value: (kind: string, n: number) => number, kinds?: string[]): number;
};
/** Things of their own, each with an id and attributes of its own, kept in
 * a plain list. */
export declare const things: {
    /** The next id from a counter kept in the save, holder[key]: one more than
     * the last given, or than `from` before any was. */
    nextId(holder: Record<string, unknown>, key?: string, from?: number): number;
    /** A thing: its id first, then its attributes (later ones over earlier). */
    make<T extends object>(id: number, ...attrs: Partial<T>[]): T & {
        id: number;
    };
    /** Takes the thing with that id out of a list: it, or null. */
    pull<T extends {
        id: unknown;
    }>(list: T[], id: unknown): T | null;
    /** The things in a list with these attributes (each equal), or passing a test. */
    where<T>(list: T[], what: Partial<T> | ((t: T) => boolean)): T[];
};
/** A stack in a slot: a kind and how many (and whatever else the game keeps). */
export interface Stack {
    k: string;
    n: number;
    [attr: string]: unknown;
}
/** An inventory by slot: a stack or null in each. */
export type Slots = (Stack | null)[];
/** Inventories by slot: each slot holds one kind, up to its stack's limit. */
export declare const slots: {
    /** n empty slots. */
    make(n: number): Slots;
    /** Puts n of a kind in: topping up its stacks first, in slot order, then
     * the empty slots; `stack` is the most a slot holds (a number, or a
     * kind's). Returns how many didn't fit. */
    put(S: Slots, kind: string, n: number, stack?: number | ((kind: string) => number)): number;
    /** How many of a kind, over every slot. */
    count(S: Slots, kind: string): number;
    /** Takes n of a kind if there are as many (from the last stacks first, a
     * slot emptied when it runs out); false (and nothing taken) if not. */
    take(S: Slots, kind: string, n: number): boolean;
    /** How many slots are empty. */
    free(S: Slots): number;
};
/** Equipment: named slots, each holding one thing or null. */
export type Gear<T> = Record<string, T | null>;
export declare const gear: {
    /** Empty slots of these names. */
    make<T>(names: string[]): Gear<T>;
    /** Puts a thing on in a slot, if the slot is there and (by `fits`) takes
     * it. Returns what came off to make room (null if the slot was empty), or
     * undefined if it doesn't go there. */
    equip<T>(g: Gear<T>, slot: string, thing: T, fits?: (slot: string, thing: T) => boolean): T | null | undefined;
    /** Takes off what's in a slot: it, or null. */
    unequip<T>(g: Gear<T>, slot: string): T | null;
    /** What's on, in the slots' order. */
    worn<T>(g: Gear<T>): T[];
};
/** One level of a counted view. */
export interface Level<T> {
    /** What the things are grouped by: an attribute's name, or a function of the thing. */
    by: string | ((t: T) => unknown);
    /** The order of the groups: the values in this order (a thing with any
     * other value goes in none of them), a compare function, or by default
     * the values there are, sorted as text. */
    order?: unknown[] | ((a: any, b: any) => number);
}
/** A group of things alike: their value at this level, how many, which,
 * and the groups of the next level down among them. */
export interface Group<T> {
    key: any;
    n: number;
    items: T[];
    groups?: Group<T>[];
}
/** Counts a list grouped a level at a time: the groups at the first level
 * (none empty), each holding the groups of the next level among its things,
 * and so on. A group's count is all its things, whether or not the next
 * level's order leaves some out. */
export declare function group<T>(list: T[], levels: Level<T>[]): Group<T>[];
