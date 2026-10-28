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
    /** How fast friendships and enmities form: the regard each meeting adds or takes away (after its cap). 0: time together changes nothing. Default 1. */
    friendship: number;
    /** How fast attraction grows from time together. 0: it doesn't. Default 1. */
    romance: number;
    /** How fast relationships fade: regard drifting back to nothing (decay) and how soon faint acquaintances are forgotten (forget). 0: never. Default 1. */
    fading: number;
    /** The `friend` term: regard at least this. Default 0.5. */
    friendAt: number;
    /** The `foe` term: regard at most this. Default -0.4. */
    foeAt: number;
    /** friends(): the people liked more than this. Default 0.2. */
    likeAbove: number;
    /** How much shared values add to compatibility (each pair's values, matched). Default 0.3. */
    compatValues: number;
    /** The most one meeting can take away from regard, and add to it. Defaults -0.05 and 0.08. */
    meetMin: number;
    meetMax: number;
    /** How much compatibility and mood color a meeting's gain (1 + compat × meetCompat + (mood - 0.5) × meetMood). Defaults 1 and 1. */
    meetCompat: number;
    meetMood: number;
    /** Time together grows attraction only between people more compatible than this, by attractGain of the regard gained. Defaults 0.3 and 0.5. */
    attractAt: number;
    attractGain: number;
    /** Someone's habits rub off only on people whose regard for them is over this. Default 0.3. */
    imitateAt: number;
    /** A social action aimed at someone weighs 1 + regard × socialRegard + compat × socialCompat, from socialMin to socialMax. Defaults 0.8, 0.2, 0.1 and 2. */
    socialRegard: number;
    socialCompat: number;
    socialMin: number;
    socialMax: number;
    /** A deed's sentiment, when the deed moves no regard, holds this much. Default 0.1. */
    deedSentiment: number;
    /** Witnesses to a deed take this share of its regard. Default 0.4. */
    witnessRegard: number;
    /** Where fame and infamy pass into the next band of `labels`. Default [0.15, 0.4, 0.7]. */
    bands: number[];
}
export declare const DEFAULT_FELLOWSHIP: FellowshipConfig;
export declare class Fellowship implements Module {
    readonly name = "fellowship";
    readonly config: FellowshipConfig;
    readonly knobs: {
        readonly friendship: "person";
        readonly romance: "person";
        readonly fading: "person";
    };
    readonly groups: Map<string, GroupDef>;
    private w;
    constructor(cfg?: Partial<FellowshipConfig>);
    init(): State;
    private get st();
    /** The config in force: as declared, under any world.tune. */
    private get c();
    /** A headline knob for someone: the world's, times their own. */
    private knob;
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
