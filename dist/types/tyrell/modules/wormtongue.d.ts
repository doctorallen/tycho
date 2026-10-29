import type { Module } from '../core/module';
import type { Id, PersonState, Stimulus, Value } from '../core/types';
import type { World } from '../core/world';
import type { Stream } from '../core/util';
export interface CrimeDef {
    kind: string;
    /** 0..1: how bad. */
    severity: number;
    /** Heat each report adds. Default severity × config.heatPerSeverity (10). */
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
    /** How readily gossip spreads: the chance per meeting that someone passes something on. 0: nobody tells anybody. Default 1. */
    gossip: number;
    /** How readily crimes are reported: the chance a witness who recognized the actor reports them. 0: nobody reports. Default 1. */
    reporting: number;
    /** How much heat each report adds. Default 1. */
    heat: number;
    /** How fast heat cools: heatDecay over the days. 0: it never cools. Default 1. */
    cooling: number;
    /** How readily a dishonest teller who dislikes the subject lies (lieChance). 0: nobody lies. Default 1. */
    lies: number;
    /** Heat a report adds per point of the crime's severity, for a crime with no `heat`. Default 10. */
    heatPerSeverity: number;
    /** Heat under this is let go at midnight. Default 0.05. */
    heatFloor: number;
    /** A belief from seeing something is at least this strong, however unclear the sighting. Default 0.3. */
    sawStrength: number;
    /** The importance of a witness's memory: crimeMemory + severity × severityMemory for a crime, plainMemory for anything else. Defaults 4, 6 and 3. */
    crimeMemory: number;
    severityMemory: number;
    plainMemory: number;
    /** How much fear (1 - courage) puts a witness off reporting. Default 0.3. */
    fearWeight: number;
    /** How much liking the actor keeps a witness quiet. Default 0.8. */
    loyalty: number;
    /**
     * How much knowing the actor keeps a witness quiet: the chance they report
     * is cut by this much for each point of their familiarity with the actor
     * (Voice's: talks had, things learned), up to familiarReportMax. Defaults
     * 0 (it doesn't count) and 1.
     */
    familiarReport: number;
    familiarReportMax: number;
    /** How clearly bystanders see a crime someone commits (a crime action's sighting strength). Default 0.8. */
    crimeSeen: number;
    /** Infamy a report adds, per point of severity, with the group it went to and with the witness's groups. Defaults 0.2 and 0.1. */
    infamyAuthority: number;
    infamyGroups: number;
    /** How strongly the authority believes what it's told in a report. Default 0.8. */
    toldAuthority: number;
    /**
     * A bribe's chance: greed × bribeGreed + (the amount, up to bribeFull) /
     * bribeFull × bribeMoney - honesty × bribeHonesty + bribeBase. Defaults
     * 0.6, 100, 0.5, 0.4 and 0.1.
     */
    bribeGreed: number;
    bribeFull: number;
    bribeMoney: number;
    bribeHonesty: number;
    bribeBase: number;
    /** A threat's chance: (1 - courage) × scareFear - honesty × scareHonesty + scareBase; and the regard it costs. Defaults 0.8, 0.2, 0.1 and -0.3. */
    scareFear: number;
    scareHonesty: number;
    scareBase: number;
    scareRegard: number;
    /** A secret is passed on only by someone whose regard for its subject is under this. Default -0.3. */
    secretSpite: number;
    /** How much more worth telling a crime is, and any other deed, than other news. Defaults 3 and 1.5. */
    juicyCrime: number;
    juicyDeed: number;
    /** News loses this much of its worth in telling an hour. Default 0.99. */
    gossipRecency: number;
    /** Someone lies only with honesty under liarBelow, about someone their regard for is under lieSpite, onto someone under scapegoat. Defaults 0.3, -0.3 and -0.2. */
    liarBelow: number;
    lieSpite: number;
    scapegoat: number;
    /** How far a listener trusts a teller: trustBase + regard × trustRegard, from trustMin to trustMax; trustAlone without Fellowship. Defaults 0.6, 0.4, 0.2, 1 and 0.7. */
    trustBase: number;
    trustRegard: number;
    trustMin: number;
    trustMax: number;
    trustAlone: number;
    /** The share of a belief's strength that survives a telling (before trust). Default 0.9. */
    toldKeep: number;
    /** A secret counts as exposed once this many know it. Default 4. */
    exposedAt: number;
}
export declare const DEFAULT_WORMTONGUE: WormtongueConfig;
export declare class Wormtongue implements Module {
    readonly name = "wormtongue";
    readonly config: WormtongueConfig;
    readonly knobs: {
        readonly gossip: "person";
        readonly reporting: "person";
        readonly heat: "person";
        readonly cooling: "person";
        readonly lies: "person";
    };
    readonly crimes: Map<string, CrimeDef>;
    private w;
    constructor(cfg?: Partial<WormtongueConfig>);
    init(): State;
    private get st();
    /** The config in force: as declared, under any world.tune. */
    private get c();
    /** A headline knob for someone (a person's id, or anyone else: the player): the world's, times their own. */
    private knob;
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
    /**
     * What a would most want to tell b now (gossip's pick): a belief not
     * silenced, not too many tellings on, not private ('@'), not something b
     * already believes, not about b, a secret only out of spite; scored by
     * how juicy, how strong and how fresh. With `key`, that belief alone, if
     * it could be told. Null if there's nothing. A look: it changes nothing.
     */
    news(a: Id, b: Id, key?: string): {
        key: string;
        v: Value;
        str: number;
        hops: number;
        score: number;
    } | null;
    /**
     * a tells b something they believe (inside the simulation; gossip, and
     * Bree's talk): a liar may shift the blame, b believes it as far as they
     * trust a, a secret spreads, and a member of the authority takes a crime
     * as a report. `r` is the stream its draws come from.
     */
    applyTell(teller: Id, listener: Id, best: {
        key: string;
        v: Value;
        str: number;
        hops: number;
    }, r: Stream): void;
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
