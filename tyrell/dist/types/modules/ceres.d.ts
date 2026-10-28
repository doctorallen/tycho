import type { Module } from '../core/module';
import type { Candidate, Doing, Id, PersonState, Value } from '../core/types';
import type { World } from '../core/world';
export interface GoodDef {
    id: Id;
    /** A kind of good: 'food', 'drink', 'part'... The term goods:<kind> counts every good of a kind. */
    kind?: string;
    price?: number;
    /** Needs it meets when used up: { hunger: 0.4 }. */
    satisfies?: Record<Id, number>;
    /** A readable name: Palantír shows it. */
    label?: string;
}
interface Rent {
    amount: number;
    every: number;
    next: number;
    to?: Id;
}
interface State {
    purses: Record<Id, number>;
    pantry: Record<Id, Record<Id, number>>;
    rent: Record<Id, Rent>;
    income?: Record<Id, Rent>;
    ledger: Array<{
        t: number;
        from: Id;
        to: Id;
        amount: number;
        why: string;
    }>;
}
export declare class Ceres implements Module {
    readonly name = "ceres";
    readonly goods: Map<string, GoodDef>;
    private w;
    init(): State;
    private get st();
    attach(w: World): void;
    good(def: GoodDef): this;
    /** How many goods of a kind a person can use (their own and their household's pantry). */
    ofKind(p: PersonState, kind: string): number;
    /** The purse a person spends from: their household's if it shares one, else their own. */
    purseOf(id: Id): {
        kind: 'person' | 'household';
        id: Id;
    };
    /** How much a person can spend. */
    money(id: Id): number;
    private add;
    /** Moves money inside the simulation (from the game, call pay()). 'world' is outside the simulation. */
    applyPay(from: Id, to: Id, amount: number, why: string): void;
    /** Pays money from one to another (or 'world'): recorded for time walk. */
    pay(from: Id, to: Id, amount: number, why?: string): void;
    /** Sets up rent: amount every so many days, paid to someone (or the world). */
    rent(id: Id, amount: number, everyDays?: number, to?: Id): void;
    /** Sets up an income (a pension, an allowance): amount every so many days, from someone (or the world). */
    income(id: Id, amount: number, everyDays?: number, from?: Id): void;
    /** Recent payments. */
    ledger(id?: Id): Array<{
        t: number;
        from: Id;
        to: Id;
        amount: number;
        why: string;
    }>;
    /** How many of an item are in a person's household pantry. */
    pantryCount(id: Id, item: Id): number;
    /** What's in a household's pantry. */
    pantry(household: Id): Record<Id, number>;
    takeFromPantry(id: Id, item: Id, n: number): void;
    private store;
    stock(place: Id, item: Id): number;
    /** Adds (or removes) stock at a place: recorded. */
    restock(place: Id, item: Id, n: number): void;
    block(p: PersonState, c: Candidate): string | null;
    consider(p: PersonState, c: Candidate): Array<[string, number]> | void;
    started(p: PersonState, d: Doing): void;
    ended(p: PersonState, d: Doing, frac: number, interrupted: boolean): void;
    hour(t: number): void;
    day(): void;
    did(_actor: Id, _verb: string, _data: Record<string, Value>): void;
}
export {};
