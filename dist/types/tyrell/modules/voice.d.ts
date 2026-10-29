import type { Module } from '../core/module';
import type { Cond, Ctx, Effect, Id, PersonState, Value } from '../core/types';
import type { World } from '../core/world';
import type { LandRules } from './landing';
/** A way of coming at someone: how it lands depends on them. */
export interface ApproachDef {
    id: Id;
    label?: string;
    /** How it lands: rules whose conditions hold are added up (ctx: the listener as person, the speaker as target), or a function. Above 0 lands well, below badly. Bree's kinds can land the same way (their `approach`). */
    lands?: LandRules;
    /** Added to every landing. Default 0. */
    base?: number;
    /** How much the listener's familiarity with the speaker counts for this approach (times config.familiarLand). Default 1; 0 for none. */
    familiar?: number;
}
/** Something that can be said back at a beat. */
export interface AnswerDef {
    /** What's said: words, or a line topic (chosen from the speaker's lines, when the speaker is a person with some). */
    say: string;
    /** A short label for the choice, if not the words themselves. */
    label?: string;
    approach?: Id;
    /** Offered only when these hold (ctx: the listener as person, the speaker as target). */
    if?: Cond[];
    /** Something learned about them that it recalls: offered only once the speaker has learned it, and it lands better (config.recallLand). */
    recalls?: string;
    /** Offered but not yet choosable when `if`, `recalls` or `warmth` fails ("not yet"), instead of hidden. */
    soft?: boolean;
    /** Needs at least this much warmth in the talk. */
    warmth?: number;
    /** Effects when it's chosen. */
    then?: Effect[];
    /**
     * Where it leads: a beat, 'end' (the subject's done), 'thread:<id>' (a
     * door into another subject: this one's done, that one starts), 'bye'
     * (the talk's over), or the first that fits of a list. Default 'end'.
     */
    to?: string | Array<{
        if?: Cond[];
        landed?: 'well' | 'badly' | 'even';
        warmth?: number;
        to: string;
    }>;
}
/** A beat: something said, and what can be said back. */
export interface BeatDef {
    /** What's said: a line topic (Cityspeak's chooser picks the words). */
    line?: string;
    /** Or the words themselves (one picked, if several). */
    text?: string | string[];
    /** Who says it: 'them' (default), 'you' (the speaker), or 'aside' (narration). */
    who?: 'them' | 'you' | 'aside';
    /** Effects when it's reached. */
    then?: Effect[];
    answers?: AnswerDef[];
    /** The subject ends here. */
    end?: boolean;
}
/** A thread: a few beats about one subject. */
export interface ThreadDef {
    id: Id;
    /** What it's offered as (words, or a function of the context). */
    label?: string | ((ctx: Ctx) => string);
    /** Conditions for it to come up (ctx: the person talked to, the speaker as target). */
    if?: Cond[];
    /** How much it's worth raising, against the others. Default 1. */
    weight?: number | ((ctx: Ctx) => number);
    /** Minutes for it to come round fresh again after it was talked about (it does so gradually). Default config.cooldown (3 days). */
    cooldown?: number;
    /** They raise it themselves (at the start, or between subjects), instead of being offered it. */
    theirs?: boolean;
    /** A key it's for learning: it's more wanted until the speaker has learned it. */
    reveals?: string;
    /** Something learned about them that it recalls: it comes up only once the speaker has learned it, and its opener lands better (config.recallLand). */
    recalls?: string;
    /** What the speaker says to open it: words or a line topic, or by approach. Default: the label. */
    open?: string | Record<Id, string>;
    /** The approach the opening takes. */
    approach?: Id;
    /** The first beat. Default 'start'. */
    start?: string;
    beats: Record<string, BeatDef>;
    /** Effects when it's talked through to the end (not when it's let lie). */
    then?: Effect[];
}
/** A promise: settled later by what happens. */
export interface PromiseDef {
    id: Id;
    label?: string;
    /** Kept when these hold (checked each hour; ctx: the one promised to, the one who promised as target). */
    kept?: Cond[];
    /** Broken when these hold. */
    broken?: Cond[];
    /** Days before it comes due. Default config.promiseDays (3). */
    days?: number;
    /** What it comes to when it's due and neither kept nor broken. Default 'lapsed'. */
    lapse?: 'kept' | 'broken' | 'lapsed';
    onKept?: Effect[];
    onBroken?: Effect[];
    onLapsed?: Effect[];
}
export interface VoiceConfig {
    /** Subjects offered at once. Default 3. */
    offers: number;
    /** Answers offered at once (besides letting it lie and goodbye). Default 3. */
    choices: number;
    /** The chance, at the start and between subjects, that they raise something of their own. Default 0.3. */
    theirs: number;
    /** Beats before they've had enough, unless `voice.patience` says otherwise. Default 8. */
    patience: number;
    /** Minutes a line said to someone is passed over for a fresher one. Default 7 days. */
    fresh: number;
    /** A landing this strong (either way) runs `onWell` or `onBadly`, and draws a reaction. Default 2. */
    strong: number;
    /** Effects when an approach lands strongly well, or badly (ctx: the listener, the speaker as target). */
    onWell: Effect[];
    onBadly: Effect[];
    /** Line topics: the greeting, their goodbye, their closing when patience runs out, and the prefix of reactions ('react.jest.well', 'react.well'). */
    greet: string;
    bye: string;
    close: string;
    react: string;
    /** A deed recorded when a talk ends (world.deed: feelings, regard, a file on the speaker). Default none. */
    deed: string | null;
    /**
     * The headline knob: how chatty they are. It scales how long they'll talk
     * (the patience a talk starts with, rounded, at least 1 beat) and the
     * chance they raise something of their own (`theirs`). A person's own
     * (PersonDef.tune.voice) multiplies it for them. Default 1.
     */
    chatter: number;
    /** The default warmth a talk starts with: regard × warmthRegard, rounded, from warmthMin to warmthMax (with Fellowship). Defaults 3, -1 and 3. */
    warmthRegard: number;
    warmthMin: number;
    warmthMax: number;
    /** familiarity(): this much for each talk, and for each thing learned about them. Defaults 0.5 and 1. */
    familiarTalk: number;
    familiarLearned: number;
    /**
     * Familiarity as trust: every approach lands this much better for each
     * point of the listener's familiarity with the speaker (times the
     * approach's own `familiar`), up to familiarLandMax. Defaults 0 (it
     * doesn't count) and 1.
     */
    familiarLand: number;
    familiarLandMax: number;
    /** An answer or a subject that recalls something learned about them lands this much better. Default 1. */
    recallLand: number;
    /** Minutes a subject takes to come round fresh again, for a thread with no `cooldown`. Default 3 days. */
    cooldown: number;
    /** Days a subject stays sore after `sore` with no number. Default 2. */
    soreDays: number;
    /** A sore subject is worth this share of its weight. Default 0.1. */
    soreWeight: number;
    /** A subject for learning something not yet learned is worth this much more. Default 1.5. */
    revealPull: number;
    /** Subjects worth less than this aren't offered. Default 0.05. */
    salientFloor: number;
    /** A little variety in what's offered: up to this much added to each subject's worth, the same for a pair all day. Default 0.2. */
    variety: number;
    /** Days before a promise comes due, for a promise with no `days`. Default 3. */
    promiseDays: number;
    /** Days a settled promise is remembered (the `promise:` term reads it). Default 30. */
    promiseKeep: number;
}
export declare const DEFAULT_VOICE: VoiceConfig;
/** A line said in a talk. */
export interface TalkLine {
    who: 'them' | 'you' | 'aside' | 'note';
    /** The line's key (a Cityspeak line), or the topic when no line was found. */
    key?: string;
    text?: string;
    /** A note: what the speaker learned, and its value. */
    learned?: string;
    value?: Value;
}
/** Something that can be chosen now. */
export interface TalkOption {
    /** 'thread' (a subject to raise), 'answer', 'drop' (let it lie), 'bye'. */
    kind: 'thread' | 'answer' | 'drop' | 'bye';
    id: string;
    ok: boolean;
    label?: string;
    say?: string;
    approach?: Id;
    /** What learned about them it recalls, if anything. */
    recalls?: string;
}
/** Someone the speaker has talked with, as acquaintances() lists them. */
export interface Acquaintance {
    who: Id;
    /** Talks they've had (counted at the end of each). */
    talks: number;
    /** When the last talk ended (null: the first is still going). */
    last: number | null;
    familiarity: number;
    /** What the speaker has learned about them (a copy). */
    learned: Record<string, Value>;
}
/** A talk as the game shows it. */
export interface TalkView {
    who: Id;
    by: Id;
    thread: {
        id: Id;
        label: string;
        beat: string;
        theirs: boolean;
    } | null;
    /** What was said since the last choice. */
    lines: TalkLine[];
    answers: Array<TalkOption & {
        i: number;
    }>;
    warmth: number;
    patience: number;
    /** How the last approach landed. */
    landed: 'well' | 'badly' | 'even' | null;
    /** They've had enough: only goodbye is left. */
    over: boolean;
    /** The talk has ended. */
    ended: boolean;
}
interface Promised {
    who: Id;
    by: Id;
    id: Id;
    t: number;
    due: number;
    state: 'open' | 'kept' | 'broken' | 'lapsed';
    settled?: number;
}
export declare class Voice implements Module {
    readonly name = "voice";
    readonly config: VoiceConfig;
    readonly knobs: {
        readonly chatter: "person";
    };
    readonly approaches: Map<string, ApproachDef>;
    readonly threads: Map<string, ThreadDef>;
    readonly promiseDefs: Map<string, PromiseDef>;
    /** The warmth a talk starts with (a definition: set it on every start). Default: regard times config.warmthRegard (3), rounded, from warmthMin to warmthMax (-1 to 3; with Fellowship), else 0. */
    warmth: (ctx: Ctx) => number;
    /** How many beats they'll talk for (a definition), before `chatter`. Default config.patience. */
    patience: (ctx: Ctx) => number;
    /**
     * How something learned about them is put in words, where a line or an
     * answer says {learned.<key>} or {learned.<key>:<form>} (a definition: set
     * it on every start). ctx: the one talked to, the speaker as target.
     * Default: a word or a number as it is, anything else nothing.
     */
    remembered: (ctx: Ctx, key: string, value: Value, form: string | null) => string;
    private w;
    /** The talk being worked on inside an input (effects add their notes to it). */
    private live;
    constructor(cfg?: Partial<VoiceConfig>);
    private get st();
    /** The config in force: as declared, under any world.tune. */
    private get c();
    /** How chatty the one talked to is: the world's chatter, times their own. */
    private chatter;
    private mut;
    private bond;
    private peekBond;
    attach(w: World): void;
    approach(def: ApproachDef): this;
    thread(def: ThreadDef): this;
    promise(def: PromiseDef): this;
    /** Starts a talk with someone (from the game: recorded). Returns what to show, or null if they can't talk. */
    start(who: Id, by?: Id): TalkView | null;
    /** Chooses one of the talk's answers by its index in current().answers (recorded). Returns what to show next. */
    answer(i: number, by?: Id): TalkView | null;
    /** Ends a talk without a goodbye (walked off; recorded). */
    end(by?: Id): void;
    /** The talk in progress, as the game shows it, or null. */
    current(by?: Id): TalkView | null;
    /** How well someone knows the speaker: half a point a talk, a point for each thing learned about them. */
    familiarity(who: Id, by?: Id): number;
    /** What the speaker has learned about someone. */
    learned(who: Id, by?: Id): Record<string, Value>;
    /** Talks so far between them, and when the last ended. */
    history(who: Id, by?: Id): {
        talks: number;
        last: number | null;
        lastThread: Id | null;
        seen: Record<Id, number>;
    };
    /**
     * Everyone the speaker has talked with: talks, when the last ended,
     * familiarity and what's been learned, the latest first (one still talking
     * for the first time first of all), then by id. A look: it changes nothing.
     */
    acquaintances(by?: Id): Acquaintance[];
    /** Promises made to someone (or everyone), newest last. */
    promises(who?: Id): Promised[];
    private ctx;
    /** A stream of this talk's own: the same talk draws the same on a replay. */
    private stream;
    applyStart(who: Id, by: Id): TalkView | null;
    applyAnswer(by: Id, i: number, id: string | null): TalkView | null;
    /** An answer is chosen: said, its approach lands, its effects, and where it leads. Returns where. */
    private chosen;
    /** Starts on a subject: the speaker opens it (unless it's theirs, or the answer before was the way in), then its first beat. */
    private enter;
    private runBeat;
    /** A subject is done: talked through (its effects run) or let lie. */
    private finishThread;
    /**
     * How an approach lands (and something recalled, with or without one):
     * added to the warmth, and remembered for the lines and answers that
     * follow. Someone who knows the speaker takes it better (familiarLand),
     * and something they've told you, remembered, better still (recallLand).
     */
    private land;
    /** Has the speaker learned this about them? */
    private knows;
    /** Words with what's been learned filled in: {learned.<key>} and {learned.<key>:<form>}, by `remembered` (an unlearned key is left as it is). */
    private fill;
    /** Now and then they raise something of their own. Returns whether they did. */
    private theirTurn;
    private weightOf;
    /** The subjects worth raising now, best first. */
    private salient;
    /** Works out what can be said now (kept with the talk, so a replay offers the same). */
    private refresh;
    private bye;
    /** Ends a talk: what it leaves (a talk counted, when, a deed). */
    applyEnd(by: Id, why: string): void;
    /** Does the speaker have lines on this topic (so it's a topic, not words)? */
    private isTopic;
    /**
     * Says something in the talk: a line on a topic, chosen by Cityspeak for
     * the speaker (passing over what they've said to this listener lately), or
     * the words given. Returns whether anything was said.
     */
    private say;
    private sayText;
    private view;
    /** The speaker learns something about someone (inside the simulation). */
    applyLearn(who: Id, by: Id, key: string, value: Value): void;
    /** A promise is made to someone (inside the simulation). */
    applyPromise(who: Id, by: Id, id: Id, days?: number): void;
    private settle;
    /** Each hour, open promises are checked: kept, broken, or come due. */
    hour(): void;
    /** Each day, old marks are let go: lines said long ago, promises long settled. */
    day(): void;
    removed(p: PersonState): void;
}
export {};
