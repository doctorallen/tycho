import type { Module } from '../core/module';
import type { Id, PersonState, Value } from '../core/types';
import type { World } from '../core/world';
/** A gene: alleles, most dominant first. */
export interface GeneDef {
    id: Id;
    label?: string;
    /** The alleles, most dominant first. */
    alleles: string[];
    /** How common each allele is among founders (the same order). Default even. */
    weights?: number[];
    /** Two copies, one from each parent (default), or one, taken whole from either parent. */
    copies?: 1 | 2;
    /** What shows, from the copies carried. Default: the most dominant allele carried. */
    express?: (alleles: string[]) => Value;
    /** The chance, per child, that one copy turns into another allele (drawn by `weights`). Default 0. */
    mutate?: number;
}
/** A value blended from both parents: a trait, a talent, an instinct or a continuous look. */
export interface BlendDef {
    id: Id;
    label?: string;
    /** Founders' values are drawn from this range. */
    founders?: [number, number];
    /** Values are kept in this range. */
    bounds?: [number, number];
    /** The share of a child's value taken from one parent, picked at random; the rest is the parents' average. */
    cross?: number;
    /** A child's value moves by up to this much either way. */
    noise?: number;
    /** Whole numbers only (a tone from a palette). */
    round?: boolean;
    /** What the person gets from the genome's value (an aptitude of 0.5 might mean learning at 1.0 times the rate). Default: the value. */
    express?: (v: number) => number;
}
type Kind = 'traits' | 'talents' | 'instincts' | 'looks';
/** A mutation, kept with the genome it happened in. */
export interface Mutation {
    kind: 'gene' | 'trait' | 'talent';
    id: Id;
    by?: number;
    to?: string;
}
/** Someone's genome. */
export interface Genome {
    genes: Record<Id, string[]>;
    traits: Record<Id, number>;
    talents: Record<Id, number>;
    instincts: Record<Id, number>;
    looks: Record<Id, number>;
    mut?: Mutation[];
}
export interface DelosConfig {
    /** A child's chance that one trait jumps by `by`, up or down. */
    jump: {
        chance: number;
        by: number;
    };
    /** A child's chance of a natural gift: one talent raised by `by`. */
    gift: {
        chance: number;
        by: number;
    };
}
export declare const DEFAULT_DELOS: DelosConfig;
export declare class Delos implements Module {
    readonly name = "delos";
    readonly config: DelosConfig;
    readonly genes: Map<string, GeneDef>;
    readonly blends: Record<Kind, Map<Id, BlendDef>>;
    private w;
    constructor(cfg?: Partial<DelosConfig>);
    private get st();
    private mut;
    attach(w: World): void;
    gene(def: GeneDef): this;
    /** A personality trait carried in the genome (written to PersonDef.traits). */
    trait(def: BlendDef): this;
    /** A talent for a skill: how fast it's learned (written to PersonDef.talents). */
    talent(def: BlendDef): this;
    /** An inborn taste for an action or task (written to PersonDef.instincts). */
    instinct(def: BlendDef): this;
    /** A continuous look, like a skin tone (read with looks()). */
    look(def: BlendDef): this;
    /** Is anything declared? Without, Delos does nothing (and Cradle blends traits its own way). */
    active(): boolean;
    /** Someone's genome (a copy), or undefined if they have none. */
    genome(id: Id): Genome | undefined;
    /** What a gene shows for someone (undefined without a genome or the gene). */
    express(id: Id, gene: Id): Value | undefined;
    /** Does someone carry an allele (showing or not)? */
    carries(id: Id, gene: Id, allele: string): boolean;
    /** Everything someone looks like: each gene as it shows, and the continuous looks. */
    looks(id: Id): Record<Id, Value>;
    private settings;
    private fit;
    private expressed;
    private allele;
    /** A founder's genome: drawn from the founders' ranges, keeping any value their definition already gives. */
    private founder;
    /** Writes what a genome means (traits, talents, instincts) into the person's definition, keeping what it already says. */
    private writeDef;
    /** Gives someone a founder's genome if they have none (inside the simulation). Returns it. */
    applyFounder(id: Id): Genome;
    /**
     * A child's genome from its parents' (inside the simulation; Cradle calls
     * it for a birth before the child joins). Parents without a genome get a
     * founder's first. Returns what it means for the child's definition.
     */
    applyInherit(parentIds: Id[], child: Id): {
        traits: Record<Id, number>;
        talents: Record<Id, number>;
        instincts: Record<Id, number>;
    };
    /** What a genome means for a definition: its traits, talents and instincts, expressed. */
    private meaning;
    /** Sets parts of someone's genome (an imported traveler, a game's own founders): from the game, recorded. */
    set(id: Id, part: Partial<Genome>): void;
    /** Sets parts of a genome inside the simulation, and writes what they mean into the definition. */
    applySet(id: Id, part: Partial<Genome>): void;
    /** A founder gets a genome when they join (a child born through Cradle already has one). */
    added(p: PersonState): void;
}
export {};
