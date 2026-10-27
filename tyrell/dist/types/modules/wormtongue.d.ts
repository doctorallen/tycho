import type { Module } from '../core/module';
import type { Id, PersonState, Stimulus, Value } from '../core/types';
import type { World } from '../core/world';
export interface CrimeDef {
    kind: string;
    /** 0..1: how bad. */
    severity: number;
    /** Heat each report adds. Default severity * 10. */
    heat?: number;
    /** The group reports go to (the police). Default: any group of kind 'authority'. */
    reportTo?: Id;
    /** The feeling a witness gets. Default 'witnessed'. */
    feeling?: Id;
    /** Chance a witness reports it (before temperament). Default from config. */
    report?: number;
}
export interface Report {
    t: number;
    witness: Id;
    actor: Id;
    kind: string;
    what?: string;
    to?: Id;
}
export interface Secret {
    about: Id;
    key: string;
    value: Value;
    knownBy: Id[];
}
interface State {
    heat: Record<Id, number>;
    reports: Report[];
    secrets: Record<string, Secret>;
    favors: Record<string, number>;
}
export interface WormtongueConfig {
    /** Base chance a witness reports a crime. */
    reportChance: number;
    /** Minutes before a report is made: [min, max]. */
    reportDelay: [number, number];
    /** Chance of recognizing someone you don't know (you always might know who you know). */
    recognizeStranger: number;
    /** Chance per meeting that someone passes something on. */
    gossipChance: number;
    /** Gossip goes at most this many hops from whoever saw it. */
    maxHops: number;
    /** Heat kept per day. */
    heatDecay: number;
    /** Chance that a dishonest teller who dislikes the subject lies. */
    lieChance: number;
}
export declare const DEFAULT_WORMTONGUE: WormtongueConfig;
export declare class Wormtongue implements Module {
    readonly name = "wormtongue";
    readonly config: WormtongueConfig;
    readonly crimes: Map<string, CrimeDef>;
    private w;
    constructor(cfg?: Partial<WormtongueConfig>);
    init(): State;
    private get st();
    attach(w: World): void;
    crime(def: CrimeDef): this;
    /** Heat on someone: the weight of reports against them, fading by day. */
    heat(actor: Id): number;
    /** Changes heat directly (from the game: recorded). */
    addHeat(actor: Id, by: number): void;
    /** Recent reports, newest last. */
    reports(actor?: Id): Report[];
    /** Everyone who believes they saw the actor do something criminal and hasn't been silenced. */
    witnesses(actor: Id, kind?: string): Id[];
    sensed(stim: Stimulus): void;
    timer(item: {
        who?: Id;
        data?: Record<string, Value | Value[]>;
    }): void;
    private report;
    /** Pays or scares a witness off. Returns nothing; check witnesses() or listen for 'silenced'. */
    silence(witness: Id, actor: Id, how: 'pay' | 'scare', amount?: number): void;
    private applySilence;
    met(a: PersonState, b: PersonState): void;
    /** a may tell b one thing worth telling. */
    private gossip;
    /** Declares a secret: a belief that only some people hold, which they pass on reluctantly. */
    secret(id: string, s: Secret): void;
    secrets(): Record<string, Secret>;
    private secretFor;
    /** Records a favor: debtor now owes creditor (n can be negative to settle). */
    owe(debtor: Id, creditor: Id, n?: number): void;
    applyOwe(debtor: Id, creditor: Id, n: number): void;
    /** How much debtor owes creditor. */
    owes(debtor: Id, creditor: Id): number;
    started(p: PersonState, d: {
        kind: string;
        action: Id;
        place: Id | null;
    }): void;
    did(actor: Id, verb: string, data: Record<string, Value>): void;
    day(): void;
}
export {};
