import type { Module } from '../core/module';
import type { ActionDef, Candidate, Doing, Id, PersonState, Value } from '../core/types';
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
/** A production chain: goods made one from the next (grain, flour, bread). */
export interface ChainDef {
    id: Id;
    label?: string;
    /** The goods, from the rawest to the finished. */
    goods: Id[];
    /** The place whose stock it's judged by (a store, a granary). Default: every place's stock added up. */
    store?: Id;
    /** A good counts as piling up at this much stock. Default: two days of what was used of it yesterday (at least 2). */
    plenty?: number;
    /** A good counts as short at or under this much stock. Default: under a day of what was used of it yesterday (at least 1). */
    short?: number;
}
/** One good in a store, in the daily report. */
export interface GoodReport {
    stock: number;
    /** Made (or delivered) and used (or sold) yesterday. */
    made: number;
    used: number;
    net: number;
    /** Days the stock would last if yesterday repeated (null unless it's running down). */
    days: number | null;
}
/** The daily production report: what every store had and did yesterday, and where each chain is stuck. */
export interface ProductionReport {
    /** The day the made and used figures are for. */
    day: number;
    places: Record<Id, Record<Id, GoodReport>>;
    /** Links where the first good piles up while the next runs short: the bottlenecks. */
    bottlenecks: Array<{
        chain: Id;
        from: Id;
        to: Id;
        store: Id | null;
        fromStock: number;
        toStock: number;
    }>;
}
export interface CeresConfig {
    /**
     * The headline knob: how much prices put people off. It scales how far a
     * price, as a share of what they have, weighs an option down. 0: price is
     * no object (they still can't buy what they can't afford). A person's own
     * (PersonDef.tune.ceres) multiplies it for them. Default 1.
     */
    prices: number;
    /** A priced option weighs 1 - share × (priceShare + thrift × priceThrift), never under priceFloor, where share is the price over what they have. Defaults 0.4, 0.8 and 0.05. */
    priceShare: number;
    priceThrift: number;
    priceFloor: number;
}
export declare const DEFAULT_CERES: CeresConfig;
interface Flow {
    made?: Record<Id, number>;
    used?: Record<Id, number>;
}
interface Production {
    day: number;
    today: Record<Id, Flow>;
    yesterday: Record<Id, Flow>;
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
    prod?: Production;
}
export declare class Ceres implements Module {
    readonly name = "ceres";
    readonly config: CeresConfig;
    readonly knobs: {
        readonly prices: "person";
    };
    readonly goods: Map<string, GoodDef>;
    readonly chains: Map<string, ChainDef>;
    private w;
    /** Whether anything makes goods or works from a store (worked out from the definitions, kept until they change). */
    private producingCache;
    constructor(cfg?: Partial<CeresConfig>);
    init(): State;
    private get st();
    /** The config in force: as declared, under any world.tune. */
    private get c();
    attach(w: World): void;
    good(def: GoodDef): this;
    /** A production chain, for the daily report's bottlenecks. */
    chain(def: ChainDef): this;
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
    /** Does anything make goods or work from a store, or is there a chain? Then stock flows are counted. */
    producing(): boolean;
    /** The place an action's `store` names, from the place it's done. */
    storeOf(a: ActionDef, place: Id | null | undefined): Id | null;
    /** Counts a change in a place's stock as made (more) or used (less), when production is on. */
    private flow;
    /** Takes goods out of a place's stock (not below none), counting them as used. */
    private takeStock;
    /** Adds goods to a place's stock, counting them as made. */
    private addStock;
    private stockAt;
    private flowAt;
    /**
     * The production report: for each store (or the one asked for), every good
     * with its stock now, what was made and used yesterday, and how many days
     * it would last if yesterday repeated; and the bottleneck links of every
     * chain, where a good piles up while the next one runs short.
     */
    production(place?: Id): ProductionReport;
    block(p: PersonState, c: Candidate): string | null;
    consider(p: PersonState, c: Candidate): Array<[string, number]> | void;
    started(p: PersonState, d: Doing): void;
    ended(p: PersonState, d: Doing, frac: number, interrupted: boolean): void;
    hour(t: number): void;
    day(): void;
    did(_actor: Id, _verb: string, _data: Record<string, Value>): void;
}
export {};
