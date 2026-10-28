import type { Module } from '../core/module';
import type { Candidate, Id, PersonState, Value } from '../core/types';
import type { World } from '../core/world';
import { DAY } from '../core/util';
export interface GroupDef {
    id: Id;
    label?: string;
    /** 'household', 'family', 'faction', 'authority' (reports crimes), 'club'... */
    kind?: string;
    /** Members listed here, on top of people whose definitions name the group. */
    members?: Id[];
    /** Households: money is shared (Ceres). */
    purse?: boolean;
}
export interface Sentiment {
    label: string;
    by: number;
    until?: number;
}
export interface Rel {
    r: number;
    a: number;
    s: Sentiment[];
    met: number;
    last: number;
}
interface State {
    rel: Record<string, Rel>;
    /** group -> subject -> [fame, infamy] */
    standing: Record<Id, Record<Id, [number, number]>>;
    partners: Record<Id, Id>;
    /** members added at runtime: group -> ids */
    joined: Record<Id, Id[]>;
}
export interface FellowshipConfig {
    /** Regard gained per half hour together, before compatibility and mood. */
    meetGain: number;
    /** How much compatibility varies between pairs (0..1). */
    compatSpread: number;
    /** Regard drifts back toward zero by this much a day. */
    decay: number;
    /** Most sentiments kept per relationship. */
    sentiments: number;
    /** How much a liked person's habits rub off. */
    imitation: number;
    /**
     * Days after their last meeting that a passing acquaintance is forgotten:
     * a record whose regard and attraction are both under `forgetBelow` and that
     * holds no sentiments. Keeps a big town's relationships to the ones that
     * matter. 0 forgets nobody.
     */
    forget: number;
    /** How faint a relationship has to be to be forgotten. */
    forgetBelow: number;
    /** Standing labels, by fame (rows: low, some, high) and infamy (columns). */
    labels: string[][];
}
export declare const DEFAULT_FELLOWSHIP: FellowshipConfig;
export declare class Fellowship implements Module {
    readonly name = "fellowship";
    readonly config: FellowshipConfig;
    readonly groups: Map<string, GroupDef>;
    private w;
    constructor(cfg?: Partial<FellowshipConfig>);
    init(): State;
    private get st();
    attach(w: World): void;
    group(def: GroupDef): this;
    /** Everyone in a group. */
    members(g: Id): Id[];
    /** The groups a person belongs to. */
    groupsOf(id: Id): Id[];
    /** The household a person belongs to, if any. */
    household(id: Id): Id | undefined;
    join(g: Id, id: Id, on?: boolean): void;
    applyJoin(g: Id, id: Id, on: boolean): void;
    /** The relationship record a -> b, or undefined if there's none (a copy: change it through the inputs). */
    rel(a: Id, b: Id): Rel | undefined;
    /** The relationship record a -> b, made if missing (inside the simulation). */
    private record;
    /** Has a met b (is there a record)? */
    knows(a: Id, b: Id): boolean;
    /** a's regard for b, -1..1, sentiments included. */
    regard(a: Id, b: Id): number;
    attraction(a: Id, b: Id): number;
    /** Changes a's attraction to b (from the game: recorded). */
    attract(a: Id, b: Id, by: number): void;
    applyAttraction(a: Id, b: Id, by: number): void;
    /** Hidden compatibility of a pair, -1..1 (the same both ways). */
    compat(a: Id, b: Id): number;
    /** Everyone a person has a relationship with, best regard first. */
    relations(a: Id): Array<{
        id: Id;
        regard: number;
        attraction: number;
        met: number;
    }>;
    /** The people a person likes most. */
    friends(a: Id, n?: number): Id[];
    /** Changes a's regard for b (from the game: recorded). */
    adjust(a: Id, b: Id, by: number, why?: string): void;
    applyRegard(a: Id, b: Id, by: number, why?: string): void;
    /** Adds a sentiment a holds about b (replaces the weakest past the limit). */
    sentiment(a: Id, b: Id, label: string, by: number, minutes?: number): void;
    applySentiment(a: Id, b: Id, label: string, by: number, minutes?: number): void;
    sentiments(a: Id, b: Id): Sentiment[];
    partner(a: Id): Id | undefined;
    /** Makes two people partners (or, with null, ends a's partnership). */
    setPartner(a: Id, b: Id | null): void;
    applyPartners(a: Id, b: Id | null): void;
    /** A subject's standing with a group: fame and infamy (0..1 each) and a label. */
    standing(g: Id, subject: Id): {
        fame: number;
        infamy: number;
        label: string;
    };
    /** Changes standing (from the game: recorded). */
    changeStanding(g: Id, subject: Id, fame: number, infamy: number): void;
    applyStanding(g: Id, subject: Id, fame: number, infamy: number): void;
    met(a: PersonState, b: PersonState, _place: Id, minutes: number): void;
    consider(p: PersonState, c: Candidate): Array<[string, number]> | void;
    did(actor: Id, verb: string, data: Record<string, Value>): void;
    day(): void;
    removed(p: PersonState): void;
}
export { DAY };
