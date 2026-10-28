import type { Module } from '../core/module';
import type { Candidate, Cond, Consideration, Doing, Effect, Id, PersonState, Value } from '../core/types';
import type { World } from '../core/world';
import { HOUR } from '../core/util';
export interface LineDef {
    /** The line's key: what the game looks up for the words. */
    key: string;
    /** Words, if the engine should carry them (one picked at random). */
    text?: string | string[];
    /** Who says it: a person id, 'tag:<tag>', 'job:<id>', or conditions. */
    who?: string | Cond[];
    /** Conditions on the speaker and the moment. */
    when?: Cond[];
    /** Conditions on the listener (the target in conditions). */
    to?: Cond[];
    /** The topic it answers ('greet', 'bye', 'work', 'rumor'...). */
    topic?: string;
    /** Among equally specific lines, how likely. Default 1. */
    weight?: number;
    /** Counts this much more toward how specific it is (a line that should win among its equals). Default 0. */
    pri?: number;
    /** Minutes before the same speaker says it again. */
    cooldown?: number;
    /** Said only once per speaker. */
    once?: boolean;
    /** Effects when said (said on purpose by the game, not as a bark). */
    then?: Effect[];
    /** The key (or topic, as 'topic:x') the listener answers with. */
    reply?: string;
}
export interface PracticeDef {
    id: Id;
    /** Where: a place id or 'tag:<tag>'. */
    at: Id;
    hours?: [number, number];
    /** Roles: who can fill them and the actions they make more appealing. */
    roles: Record<string, {
        who?: Cond[];
        job?: Id;
        actions: Id[];
    }>;
    /** Shifts the mood of the room (-1..1). */
    tone?: number;
    /** How much more appealing role actions are. Default config.practiceBoost (1.5). */
    boost?: number;
}
export interface SocialActDef {
    id: Id;
    /** The target's side: considerations multiplied (ctx.person is the target, ctx.target the asker). */
    accept?: Consideration[];
    /** Or plain conditions on the target. */
    acceptIf?: Cond[];
    /** Accepted when the score beats a draw against it (default) or this threshold. */
    threshold?: number;
    onAccept?: Effect[];
    onRefuse?: Effect[];
    /** Feelings: for the asker on yes and no, and for the target. */
    feelings?: {
        accepted?: Id;
        refused?: Id;
        target?: Id;
    };
    /** Regard change for the target toward the asker: [on yes, on no]. */
    regard?: [number, number];
}
export interface Said {
    who: Id;
    key: string;
    text?: string;
    to?: Id;
    topic?: string;
    reply?: string;
}
/** How choose() picks a line. */
export interface ChooseOpts {
    /** The listener (the target in lines' conditions). */
    to?: Id;
    topic?: string;
    /** Leave out lines with no topic (with a topic given, they'd otherwise count as its least specific lines). */
    exact?: boolean;
    /** Pass over lines by key (said lately), unless there's nothing else. */
    avoid?: (key: string) => boolean;
    /** Varies the draw among equally specific lines. */
    salt?: Array<string | number>;
    skip?: (l: LineDef, i: number) => boolean;
}
export interface CityspeakConfig {
    /**
     * The headline knob: how chatty people near the player are. It scales the
     * chance that two people meeting in view strike up an exchange (1, the
     * default, always does; 0 never) and how many lines it runs to (barkLength
     * times it, rounded, at least one). A person's own (PersonDef.tune.cityspeak)
     * multiplies it for them: an exchange takes both people's. Barks change
     * nothing in the world, so neither does this.
     */
    chatter: number;
    /** Seconds between lines in a bark exchange. Default 2.2. */
    barkGap: number;
    /** Most lines in one exchange. Default 3. */
    barkLength: number;
    /** Minutes before someone barks the same line again, for a line with no `cooldown`. Default 60. */
    barkCooldown: number;
    /** How much more appealing role actions are, for a practice with no `boost`. Default 1.5. */
    practiceBoost: number;
    /** The share of an action with a `social` act that must be done for the act to be resolved. Default 0.5. */
    socialDone: number;
    /** The mood of a room with nobody in it (before the practices' tone). Default 0.5. */
    roomEmpty: number;
}
export declare const DEFAULT_CITYSPEAK: CityspeakConfig;
interface State {
    /** By speaker, by line key (or index, for a line without one): when they last said it. */
    said: Record<Id, Record<string, number>>;
    /** Lines said before save schema 2, by speaker, by line index (read until said again). */
    byIndex?: Record<Id, Record<string, number>>;
    acts: Array<{
        t: number;
        act: Id;
        from: Id;
        to: Id;
        ok: boolean;
    }>;
}
export declare class Cityspeak implements Module {
    readonly name = "cityspeak";
    readonly config: CityspeakConfig;
    readonly knobs: {
        readonly chatter: "person";
    };
    readonly lines: LineDef[];
    readonly practices: Map<string, PracticeDef>;
    readonly acts: Map<string, SocialActDef>;
    /** Bark cooldowns are kept outside the state: barks only happen near the player, so they mustn't change the world. */
    private barkSaid;
    private w;
    constructor(cfg?: Partial<CityspeakConfig>);
    /** Seconds between lines in a bark exchange (config.barkGap: setting it here sets the config). */
    get barkGap(): number;
    set barkGap(v: number);
    /** Most lines in one exchange (config.barkLength: setting it here sets the config). */
    get barkLength(): number;
    set barkLength(v: number);
    init(): State;
    private get st();
    /** The config in force: as declared, under any world.tune. */
    private get c();
    /** How chatty two people are together: the world's chatter, times each one's own. */
    private chatter;
    attach(w: World): void;
    line(def: LineDef): this;
    addLines(defs: LineDef[]): this;
    practice(def: PracticeDef): this;
    act(def: SocialActDef): this;
    /** When someone last said a line (undefined if never). */
    private lastSaid;
    /** Has someone said a line with this key (or, as before 1.1, at this index)? */
    private hasSaid;
    /**
     * What a person would say now, without saying it (nothing changes). The
     * most specific matching line wins; ties go by weight. Options: `to` (the
     * listener), `topic`; `exact` leaves out lines without a topic; `avoid`
     * passes over lines by key (said lately) unless every line at the most
     * specific level is avoided, when the most specific fresh line at any
     * level wins, and only then a repeat; `salt` varies the draw among equals
     * (Voice passes the talk's counter).
     */
    choose(who: Id, opts?: ChooseOpts): Said | null;
    /** The line choose() would pick, with its index. Looking only: chance: conditions peek. */
    private pick;
    private pickNow;
    /** Says something on purpose (the game asks): chosen, remembered, its effects applied. */
    say(who: Id, opts?: {
        to?: Id;
        topic?: string;
    }): Said | null;
    private applySay;
    /** The answer someone gives to a line. */
    answer(to: Said, by: Id): Said | null;
    private reply;
    private whoMatches;
    /**
     * A short exchange between two people near the player: lines that don't
     * change the world (barks). Returns the lines with a delay for each.
     */
    converse(a: Id, b: Id, topic?: string): Array<Said & {
        after: number;
    }>;
    /** Practices going on at a place now. */
    activeAt(place: Id): PracticeDef[];
    /** Does a person fill a role at their place? */
    roleOf(p: PersonState, role: string): boolean;
    private fills;
    /** The mood of the room: everyone at the place, plus the practices' tone. */
    room(place: Id): number;
    consider(p: PersonState, c: Candidate): Array<[string, number]> | void;
    /** An action that says something on starting (its `says` topic) says it. */
    started(p: PersonState, d: Doing): void;
    ended(p: PersonState, d: Doing, frac: number, interrupted: boolean): void;
    /** Resolves a social act now (from the game: recorded): does the target accept? Applies the outcome. */
    resolve(actId: Id, from: Id, to: Id): boolean;
    /** Resolves a social act inside the simulation. */
    applyResolve(actId: Id, from: Id, to: Id): boolean;
    met(a: PersonState, b: PersonState): void;
    /**
     * Binds Tyrell to an ink story (inkjs): the story can call
     * tyrell_fact(key), tyrell_thinks(who, key), tyrell_regard(a, b),
     * tyrell_mood(who), tyrell_test(who, condition) and tyrell_did(actor, verb, target).
     */
    bindInk(story: {
        BindExternalFunction: (name: string, fn: (...args: any[]) => unknown, lookahead?: boolean) => void;
    }): void;
}
export { HOUR };
export type { Value };
