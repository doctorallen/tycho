import type { Module } from '../core/module';
import type { Id, PersonDef, PersonState } from '../core/types';
import type { World } from '../core/world';
import { Stream } from '../core/util';
export interface CradleConfig {
    /** Minutes in a year (default 365 days). Merryfolk's year is 12 days. */
    year: number;
    /** Stages and the age (in years) each starts at. */
    stages: Array<[string, number]>;
    /** People die of old age between these ages (years). */
    lifespan: [number, number];
    /** Chance per year a couple of the right age has a child. */
    fertility: number;
    /** The ages (years) at which people have children. */
    fertile: [number, number];
    /** Couples form on their own when regard and attraction both pass these (null to leave it to the game). */
    autoPair: {
        regard: number;
        attraction: number;
    } | null;
}
export declare const DEFAULT_CRADLE: CradleConfig;
interface Departed {
    name: string;
    born?: number;
    left: number;
    why: string;
}
interface State {
    stage: Record<Id, string>;
    parents: Record<Id, Id[]>;
    departed: Record<Id, Departed>;
    next: number;
}
export declare class Cradle implements Module {
    readonly name = "cradle";
    readonly config: CradleConfig;
    /** Names a newborn: set this to your game's namer. */
    namer: (r: Stream, parents: PersonState[]) => string;
    /** Fills in a newborn's definition (look, home): set this for your game. */
    template: (r: Stream, parents: PersonState[]) => PersonDef;
    private w;
    constructor(cfg?: Partial<CradleConfig>);
    init(): State;
    private get st();
    attach(w: World): void;
    /** Age in years (fractional). */
    age(id: Id): number;
    stage(id: Id): string;
    /** Who someone's parents are. */
    parents(id: Id): Id[];
    /** Who someone's children are. */
    children(id: Id): Id[];
    /** Everyone who has left, and why. */
    departed(): Record<Id, Departed>;
    /** Pairs two people up (from the game: recorded). */
    pair(a: Id, b: Id): void;
    private applyPair;
    /** A child is born to these parents. Returns the child's id. */
    birth(parents: Id[], def?: PersonDef, id?: Id): Id;
    private applyBirth;
    /** Someone leaves for good ('died', 'moved away'...). Money passes on; those who cared grieve. */
    depart(id: Id, why?: string): void;
    private applyDepart;
    day(): void;
    removed(p: PersonState, why: string): void;
}
export {};
