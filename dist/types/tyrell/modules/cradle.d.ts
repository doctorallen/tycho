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
    /** How readily couples form on their own: autoPair's thresholds are divided by it, each for their own side. 0: never. Default 1. */
    courtship: number;
    /** How often couples have children (fertility): a couple's is the world's times both partners' own. 0: never. Default 1. */
    births: number;
    /** How likely people are to die of old age, each day past the start of their lifespan. 0: never. Default 1. */
    deaths: number;
    /** The age of someone with no `born`. Default 30. */
    ageUnknown: number;
    /** The stages that couple up on their own. Default ['adult', 'elder']. */
    pairStages: string[];
    /** The sentiment a couple holds for each other ('my partner'), and parents for a newborn ('my child'). Defaults 0.3 and 0.5. */
    partnerSentiment: number;
    childSentiment: number;
    /** A child's trait is their parents' average, give or take up to this (without Delos). Default 0.12. */
    traitSpread: number;
    /** Those whose regard for someone who leaves is at least this grieve. Default 0.35. */
    griefAt: number;
    /** The chance a day, on top, of dying once past the end of the lifespan. Default 0.2. */
    pastLifespan: number;
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
    readonly knobs: {
        readonly courtship: "person";
        readonly births: "person";
        readonly deaths: "person";
    };
    /** Names a newborn: set this to your game's namer. */
    namer: (r: Stream, parents: PersonState[]) => string;
    /** Fills in a newborn's definition (look, home): set this for your game. */
    template: (r: Stream, parents: PersonState[]) => PersonDef;
    private w;
    constructor(cfg?: Partial<CradleConfig>);
    init(): State;
    private get st();
    /** The config in force: as declared, under any world.tune. */
    private get c();
    /** A headline knob for someone: the world's, times their own. */
    private knob;
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
