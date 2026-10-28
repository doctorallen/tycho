import type { Module } from '../core/module';
import type { Consideration, Cond, Ctx, Doing, Effect, Id, PersonState, QueueItem, Value } from '../core/types';
import type { World } from '../core/world';
import { DAY } from '../core/util';
import type { LandRules } from './landing';
/** The steps an exchange can come out at, best first. */
export type Outcome = 'warm' | 'good' | 'fine' | 'awkward' | 'sour' | 'row';
export declare const OUTCOMES: readonly Outcome[];
/** What a kind can say it does: at an outcome, after a long one, when someone walks off, and at any end. */
export type OutcomeKey = Outcome | 'long' | 'left' | 'end';
/** What an outcome does, for each of them, besides the regard and grudges it moves. */
export interface OutcomeDo {
    /** A feeling for each of them, or [for the one who started it, for the other]; null for none (over the config's `feel`). */
    feel?: Id | null | [Id | null, Id | null];
    /** A sentiment the other keeps about the one who started it (with `both`, the other way too). */
    sentiment?: {
        label: string;
        by?: number;
        minutes?: number;
        both?: boolean;
    };
    /** A memory for each, this important (kind '<kind>:<outcome>'); 0 for none. */
    memory?: number;
    /** Effects for each of them: the person is one, the target the other. */
    then?: Effect[];
}
/** A kind of interaction (a definition: may hold functions; declared on every start). */
export interface KindDef {
    id: Id;
    label?: string;
    /** Free labels. The module reads 'hostile' (quarrels, avoidance) and 'romantic' (attraction). */
    tags?: string[];
    /** Who may start it: conditions on the one who starts it (the other is the target). */
    who?: Cond[];
    /** Conditions on the other, read from the starter's side (the target is the other): 'regard>0.3', 'grudge>0.2'. */
    to?: Cond[];
    /** Conditions on the moment and the place (the starter, with the other as target). */
    if?: Cond[];
    /** How appealing it is to strike up on meeting someone: a number, considerations (the starter's side), or a function. Default 1; 0: only by an action, an escalation or the game. */
    weight?: number | Consideration[] | ((ctx: Ctx) => number);
    /** Needs it relieves for each of them, by the share of it done; a pressing one makes it more appealing, and more welcome. */
    relieves?: Record<Id, number>;
    /** Topics that fit: ids, 'tag:<tag>', or '*' (every topic that doesn't name its kinds). None: a word and an answer, no topics. */
    topics?: string[];
    /** Turns: a number or [min, max]. Default: by how they stand (config.turns) for one with topics, config.quickTurns for one without. */
    turns?: number | [number, number];
    /** Others nearby can join in (a table). */
    group?: boolean;
    /** How it lands with the one spoken to, before anything else. Default 0. */
    base?: number;
    /** How it lands with the one spoken to: rules (the listener as the person, the speaker as target), or a function. */
    lands?: LandRules;
    /** A Voice approach whose landing it takes too (with Voice on): the game's approaches serve its people as well as the player. */
    approach?: Id;
    /** The speaker's knack for it: rules from the speaker's side (the speaker as the person, the listener as target). */
    knack?: LandRules;
    /** The listener's nature: trait role -> how much each point above the middle adds (below takes away). */
    traits?: Record<string, number>;
    /** The speaker's nature: trait role -> how much each point above the middle adds. */
    skill?: Record<string, number>;
    /** What it turns into when a turn goes sour and they won't let it go: chat to an argument, an argument to a fight. */
    escalates?: Id;
    /** Regard moved by its outcome, times this. Default 1. */
    regard?: number;
    /** Attraction moved by its outcome (romantic kinds), times this. Default 1. */
    attraction?: number;
    /** Grudges left by a bad outcome, times this. Default 1. */
    grudge?: number;
    /** How much a good outcome takes off the other's grudge against the starter (an apology, a gift). */
    mends?: number;
    /** It mends both ways (making up). */
    mutual?: boolean;
    /** A deed the starter does for the other when it goes well (world.deed: feelings, regard, a file). */
    deed?: string;
    /** An item the starter gives the other when it goes well (if they have one). */
    gives?: Id;
    /** Favors the starter owes the other when it goes well (Wormtongue): asking a favor. */
    owes?: number;
    /** Hours of practice the other gets, when it goes well, at the starter's best skill over theirs. */
    teaches?: number;
    /** The Wormtongue crime it is (a fight), if the game declares one: whoever's there witnesses it. */
    crime?: string;
    /** Whether people about see it go wrong. Default true; false for a word in private. */
    seen?: boolean;
    /** What each outcome does (over the config's defaults). */
    on?: Partial<Record<OutcomeKey, OutcomeDo>>;
    /** The line topics of its own steps start with this. Default its id. */
    line?: string;
}
/** Where a topic's subject comes from. */
export type TopicSource = 'beliefs' | 'memories' | 'likes' | 'doing' | 'place' | 'grudge';
/** Something to talk about (a definition). */
export interface TopicDef {
    id: Id;
    label?: string;
    tags?: string[];
    /**
     * Where its subject comes from: 'beliefs' (news the speaker has and the
     * listener hasn't), 'memories' (one they share, or the speaker's of the
     * listener), 'likes' (something the speaker loves doing), 'doing' (what
     * they're doing now), 'place' (where they are), 'grudge' (what the speaker
     * holds against the listener). None: a plain subject.
     */
    from?: TopicSource;
    /** Conditions for the speaker to raise it (the listener is the target). */
    if?: Cond[];
    /** The kinds it fits (ids or 'tag:<tag>'). Default: every kind whose topics include '*'. */
    kinds?: string[];
    /** How likely it's raised: a number, considerations (the speaker's side), or a function. Default 1. */
    weight?: number | Consideration[] | ((ctx: Ctx) => number);
    /** How much it's to someone's taste: rules read for each of them (the person is them, the target the other), added to how a turn on it lands. */
    fit?: LandRules;
    /** How many of its steps it runs: 2 (open and reply), 3 (and the opener's follow-up) or 4 (and the last word). Default 4. */
    steps?: number;
    /** Effects for each of them when it's talked through. */
    then?: Effect[];
}
/** A manner: how someone talks (cheerful, ornery, shy...); each person's best fit is theirs for an exchange. */
export interface MannerDef {
    id: Id;
    label?: string;
    /** Who can have it: conditions on the person. */
    if?: Cond[];
    /** How well it fits someone: base, plus rules (the person), plus their nature (trait role -> weight a point). */
    base?: number;
    fits?: LandRules;
    traits?: Record<string, number>;
    /** How words in this manner land with whoever hears them (the listener as the person, the speaker as target). */
    lands?: LandRules;
}
export interface BreeConfig {
    /** How much good exchanges warm people: the regard and attraction a good one gives, times it (the one whose regard it is). 0: nothing warms. Default 1. */
    warmth: number;
    /** How readily people quarrel: the regard a bad exchange takes away, and how appealing hostile kinds are on meeting, times it. 0: nobody picks a quarrel and nothing sours regard. Default 1. */
    quarrels: number;
    /** How readily a sour turn becomes an argument and an argument a fight (the one who'd escalate). 0: nothing escalates. Default 1. */
    escalation: number;
    /** How much a bad exchange leaves a grudge (the one who holds it). 0: none. Default 1. */
    grudges: number;
    /** How readily people forgive: how fast grudges fade, and how much an apology or making up takes off them (the one who holds it). 0: nobody forgives. Default 1. */
    forgiveness: number;
    /** How often people strike up exchanges when they meet, and how long they talk (both people's). 0: nobody strikes one up on their own, and one begun by an action or the game is a word and no more. Default 1. */
    talk: number;
    /** The chance a meeting (two people doing something together) starts an exchange, before talk. Default 0.3. */
    strike: number;
    /** Nobody strikes up an exchange, joins one, or keeps one going while doing an action with one of these tags. Default ['sleep']. */
    quiet: string[];
    /** A kind that relieves a pressing need is more appealing: weight × (1 + relief × urgency × needPull), summed over its needs. Default 2. */
    needPull: number;
    /** The terms each trait role is read from (a game maps its own: humor: 'trait.wit'). A role with no trait reads as config.traitDefault. */
    traits: Record<string, string>;
    /** The least score for warm, good, fine, awkward and sour; under the last it's a row. Default [2, 0.75, -0.75, -1.75, -3]. */
    scale: number[];
    /** The luck of a turn: up to this much either way (two draws added, so mostly less). Default 1.5. */
    spread: number;
    /** Regard (the listener's for the speaker) times this. Default 2. */
    regardWeight: number;
    /** Compatibility times this. Default 1. */
    compatWeight: number;
    /** The listener's mood, a point above the middle (0.5), times this. Default 1. */
    moodWeight: number;
    /** The listener's stress takes away this much a point. Default 1. */
    stressWeight: number;
    /** A pressing need the kind relieves: relief × urgency × this. Default 2. */
    needWeight: number;
    /** Attraction (romantic kinds) times this. Default 3. */
    attractWeight: number;
    /** A grudge or a feud against the speaker takes away this much a point. Default 3. */
    grudgeWeight: number;
    /** A row between them lately takes away this much, fading over rowMinutes. Defaults 2 and 1440. */
    rowWeight: number;
    rowMinutes: number;
    /** The mood of the room (Cityspeak), a point above the middle, times this. Default 0.5. */
    roomWeight: number;
    /** How much the topic is to the listener's taste, times this. Default 1. */
    topicWeight: number;
    /** How the speaker's manner lands with the listener, times this. Default 1. */
    mannerWeight: number;
    /** How far each turn moves the exchange's running score toward its own. Default 0.4. */
    sway: number;
    /** Regard each of them gains or loses for the other. */
    regard: Record<string, number>;
    /** Attraction moved, for romantic kinds. */
    attraction: Record<string, number>;
    /** Grudges left (before temper, forgiveness and the knob). */
    grudge: Record<string, number>;
    /** How much of a kind's `mends` the outcome brings. */
    mends: Record<string, number>;
    /** Feelings by outcome (and 'long', 'left'), when a kind says none of its own. */
    feel: Record<string, string>;
    /** Memories by outcome (and 'long'): how important; none under 1. */
    memory: Record<string, number>;
    /** In a group, each pair takes this share of the regard. Default 0.5. */
    groupShare: number;
    /** An exchange of this many turns or more, fine or better, counts as long. Default 6. */
    longTurns: number;
    /** Regard lost for the one walked away from, by the one who walks off. Default -0.03. */
    leftRegard: number;
    /** A teacher teaches only a skill they're at least this much better at. Default 0.2. */
    teachOver: number;
    /** Turns by how the starter stands with the other (bond): partner, kin, close, friend, acquaintance, stranger, rival, sour. */
    turns: Record<string, number>;
    /** The regard (at least) for close, friend, acquaintance and stranger; under the last, sour. Default [0.6, 0.3, 0.05, -0.15]. */
    bonds: number[];
    /** Grudges or a feud this strong make them rivals. Default 0.3. */
    rivalAt: number;
    /** Turns added a point of talkativeness above the middle, both together. Default 2. */
    talkativeTurns: number;
    /** Either in a mood under lowMood: lowMoodTurns fewer. Defaults 0.35 and 2. */
    lowMood: number;
    lowMoodTurns: number;
    /** Up to this many turns more or fewer, drawn. Default 1. */
    turnsJitter: number;
    /** Turns at least and at most, before the knob. Defaults 2 and 12. */
    minTurns: number;
    maxTurns: number;
    /** Turns of a kind with no topics that doesn't say its own. Default 2. */
    quickTurns: number;
    /** Turns added a member past two, in a group. Default 3. */
    groupTurns: number;
    /** Minutes between turns: [min, max], drawn. Default [2, 4]. */
    turnGap: number[];
    /** A topic to the speaker's taste is more likely raised: weight × (1 + fit × topicPull). Default 0.5. */
    topicPull: number;
    /** Minutes a topic takes to come round fresh again between the same two. Default 1440. */
    topicCooldown: number;
    /** Topics remembered per pair. Default 8. */
    topicMemory: number;
    /** News passes on when the telling lands at least this well. Default 'fine'. */
    tellAt: string;
    /** Without Wormtongue, a belief told keeps this share of its strength. Default 0.7. */
    trust: number;
    /** Two memories of the same kind this many minutes apart count as shared. Default 60. */
    shareWindow: number;
    /** A taste (instinct, or habit) above this counts as something they like doing. Default 1.1. */
    likeAbove: number;
    /** Up to this much is added to how well each manner fits someone, the same for them always. Default 0.1. */
    mannerJitter: number;
    /** Most people in one exchange. Default 5. */
    groupMax: number;
    /** The chance someone at the same place joins a group exchange (times their talk). Default 0.5. */
    joinChance: number;
    /** Only people whose regard for one of those talking is at least this join. Default 0. */
    joinRegard: number;
    /** A turn landing this badly or worse can escalate, send someone off, and be seen. Default 'sour'. */
    escalateAt: string;
    /** The chance the one hurt answers back harder: base + temper + stress + grudge - regard, each a setting. Defaults 0.25, 0.5, 0.5, 0.6 and 0.5. */
    escalateBase: number;
    escalateTemper: number;
    escalateStress: number;
    escalateGrudge: number;
    escalateRegard: number;
    /** The chance the other keeps their patience and calms it: base + patience + regard. Defaults 0.1, 0.6 and 0.3. */
    calmBase: number;
    calmPatience: number;
    calmRegard: number;
    /** The chance someone there steps in: base + regard for either + courage, if their regard for one of them is at least stepInFrom. Defaults 0.05, 0.5, 0.3 and 0.2. */
    stepInBase: number;
    stepInRegard: number;
    stepInCourage: number;
    stepInFrom: number;
    /** Someone who steps in gains this much regard from both, and takes this much off their grudges. Defaults 0.03 and 0.1. */
    mediateRegard: number;
    mediateMends: number;
    /** The chance the one hurt walks off instead: base + temper - regard + each sour turn so far. Defaults 0.3, 0.35, 0.3 and 0.2. */
    leaveBase: number;
    leaveTemper: number;
    leaveRegard: number;
    leaveSour: number;
    /** A quick temper holds more: × (1 + (temper - 0.5) × 2 × grudgeTemper); a forgiving nature less: × (1 - (forgiveness - 0.5) × 2 × grudgeForgive). Defaults 0.5 and 0.5. */
    grudgeTemper: number;
    grudgeForgive: number;
    /** Grudge strength lost a day, at a middling nature: × (forgiveBase + forgiveness × forgiveTrait). Defaults 0.04, 0.5 and 1. */
    fade: number;
    forgiveBase: number;
    forgiveTrait: number;
    /** Grudges and feuds weaker than this are let go at midnight. Default 0.02. */
    grudgeFloor: number;
    /** Two people who hold grudges this strong against each other are in a feud. Default 0.5. */
    feudAt: number;
    /** Feud strength lost a day. Default 0.01. */
    feudFade: number;
    /** A fight between people of two households sets their households feuding by this much (0: never). Default 0. */
    feudSpread: number;
    /** A making-up between members of feuding groups takes this share of what it mends off the feud. Default 0.5. */
    feudMends: number;
    /** Grudges and feuds weaker than this don't keep anyone away. Default 0.05. */
    avoidFrom: number;
    /** An option at a place where someone they bear a grudge against is weighs 1 - animosity × avoidPlace; a social one aimed at them 1 - animosity × avoidTarget; never under avoidFloor. Defaults 0.6, 0.8 and 0.1. */
    avoidPlace: number;
    avoidTarget: number;
    avoidFloor: number;
    /** A hostile interaction aimed at them weighs 1 + animosity × hostilePull instead. Default 1. */
    hostilePull: number;
    /** The sentiment a grudge made up leaves: its label and how much it adds. Defaults 'made it up' and 0.05. */
    reconcileLabel: string;
    reconcileSentiment: number;
    /** The feeling, and the memory's importance, of making up. Defaults 'made_up' and 5. */
    reconcileFeeling: string;
    reconcileMemory: number;
    /** People about see an exchange that goes this badly or worse (and every escalation). Default 'sour'. */
    seenAt: string;
    /** How strongly a witness believes what they saw. Default 0.8. */
    witnessStrength: number;
    /** The importance of a witness's memory. Default 3. */
    witnessMemory: number;
    /** A witness's regard for whoever started it moves by this share of what the outcome moves. Default 0.5. */
    witnessRegard: number;
    /** The feeling a witness gets. Default 'saw_row'. */
    witnessFeeling: string;
    /** Finished exchanges kept, for history and late witnesses. Default 50. */
    recent: number;
}
export declare const DEFAULT_BREE: BreeConfig;
/** An exchange in progress. */
export interface Exchange {
    id: number;
    /** The kind it is now (it changes when it escalates), and the kind it began as. */
    kind: Id;
    first: Id;
    /** Who's in it: the one who started it first. */
    who: Id[];
    place: Id | null;
    /** When it began; how it began. */
    t: number;
    why: 'meet' | 'action' | 'game';
    /** Turns taken, and planned. */
    n: number;
    turns: number;
    /** No turn comes after this (the time they have together). */
    until?: number;
    /** The running score, and each one's of what they've heard. */
    score: number | null;
    heard: Record<Id, number>;
    /** Turns that landed at escalateAt or worse. */
    sour: number;
    /** Each one's manner. */
    manners: Record<Id, Id>;
    /** The topic on now: its subject, who opened it, its steps and how far through. */
    topic?: {
        id: Id;
        subject?: Value;
        by: Id;
        steps: string[];
        i: number;
    };
    /** Topics talked of so far. */
    topics: string[];
    /** Line keys said, so lines aren't said twice. */
    said: string[];
    /** When the next turn comes. */
    next: number;
    /** Who started the trouble: escalated, or started a hostile kind. */
    by?: Id;
    /** Who saw it, and what they saw. */
    seen?: Record<Id, Id>;
    /** Who stepped in. */
    mediator?: Id;
    /** Escalations so far. */
    esc?: number;
    /** The turn's own outcome, last turn. */
    last?: Outcome;
    /** Who spoke last; who leads this stretch (the starter, or whoever escalated it); steps into it. */
    lastWho?: Id;
    lead?: Id;
    i?: number;
    /** Who said the last thing that landed badly. */
    sourBy?: Id;
}
/** A feud: between two people, or two groups (households, families, factions), both ways. */
export interface Feud {
    a: Id;
    b: Id;
    s: number;
    t: number;
    why: string;
}
/** A finished exchange, kept a while. */
export interface Finished {
    id: number;
    kind: Id;
    first: Id;
    who: Id[];
    place: Id | null;
    t: number;
    end: number;
    outcome: Outcome;
    outcomes: Record<Id, Outcome>;
    n: number;
    why: string;
    by?: Id;
    left?: Id;
    mediator?: Id;
}
/** An exchange as the game sees it. */
export interface ExchangeView {
    id: number;
    kind: Id;
    first: Id;
    who: Id[];
    place: Id | null;
    t: number;
    why: string;
    /** Turns taken so far, and planned. */
    turn: number;
    turns: number;
    /** How it's going: the running outcome and score (null before the first turn). */
    outcome: Outcome | null;
    score: number | null;
    topic: {
        id: Id;
        subject?: Value;
    } | null;
    manners: Record<Id, Id>;
    by?: Id;
}
/** One turn, as it's told to the game (event 'bree:turn'). */
export interface Turn {
    id: number;
    kind: Id;
    /** Which turn this is (1 for the first). */
    n: number;
    who: Id;
    to: Id;
    /** 'open', 'reply', 'more', 'back' (a topic's steps), 'bye', 'leave', 'calm', 'step_in'. */
    step: string;
    topic: Id | null;
    subject?: Value;
    manner?: Id;
    /** How this turn landed, and how the exchange is going now. */
    landed: Outcome | null;
    outcome: Outcome | null;
    /** The line topic for the words: the game's own lines, or Cityspeak's (with its key and text). */
    line: string;
    key?: string;
    text?: string;
    /** The exchange ends with this turn. */
    end: boolean;
}
export interface StarterOptions {
    /** Only these kinds (ids); default all. */
    kinds?: Id[];
    /** Only these topics; default all. */
    topics?: Id[];
    /** Only these manners; default all. */
    manners?: Id[];
    /** The game's names for the needs talk relieves. Defaults 'company' and 'fun'. */
    company?: string;
    fun?: string;
}
/**
 * The starter set: seventeen kinds (chat, deep talk, joke, compliment, tease,
 * flirt, comfort, asking a favor, a gift, help, teaching, an argument, an
 * insult, a fight, an apology, making up and the cold shoulder), the topics
 * they talk of and a few manners. Plain definitions: take them, change them,
 * or declare your own with the same ids over them.
 */
export declare function breeStarter(opts?: StarterOptions): {
    kinds: KindDef[];
    topics: TopicDef[];
    manners: MannerDef[];
};
export declare class Bree implements Module {
    readonly name = "bree";
    readonly config: BreeConfig;
    readonly knobs: {
        readonly warmth: "person";
        readonly quarrels: "person";
        readonly escalation: "person";
        readonly grudges: "person";
        readonly forgiveness: "person";
        readonly talk: "person";
    };
    readonly kinds: Map<string, KindDef>;
    readonly topics: Map<string, TopicDef>;
    readonly manners: Map<string, MannerDef>;
    /**
     * Who sees an exchange go wrong (a definition: set it on every start, like
     * Cradle's namer). Default null: everyone at the place, awake, not in it.
     * The game owns sight: give it its own (a room indoors, shouting distance
     * on a street), deterministic from the world's state.
     */
    witnesses: ((ex: ExchangeView, world: World) => Id[]) | null;
    private w;
    constructor(cfg?: Partial<BreeConfig>);
    private get st();
    private mut;
    /** The config in force: as declared, under any world.tune. */
    private get c();
    /** A headline knob for someone: the world's, times their own. */
    knob(name: 'warmth' | 'quarrels' | 'escalation' | 'grudges' | 'forgiveness' | 'talk', id: Id | undefined): number;
    /** How chatty people are together: the world's talk, times each one's own. */
    private talkOf;
    attach(w: World): void;
    kind(def: KindDef): this;
    topic(def: TopicDef): this;
    manner(def: MannerDef): this;
    /** Declares the starter set (or some of it): kinds, topics and manners. Declare your own with the same ids after, to change them. */
    starter(opts?: StarterOptions): this;
    /** Someone's nature in a role (temper, warmth, humor, patience, courage, forgiveness, talkative), read from the term the config maps it to. */
    nature(p: PersonState, role: string): number;
    /** How a stands with b: 'partner', 'kin', 'rival', or by regard: 'close', 'friend', 'acquaintance', 'stranger', 'sour'. */
    bond(a: Id, b: Id): string;
    /** Where a score falls on the scale. */
    outcome(score: number): Outcome;
    /** Is an outcome bad enough to escalate, send someone off, or be seen (config.escalateAt or worse)? */
    private bad;
    /** Is outcome x at least as good as y? */
    atLeast(x: Outcome | string, y: Outcome | string): boolean;
    /** How readily someone forgives: their knob times their nature. */
    private forgiving;
    /** a's grudge against b now, 0..1 (it fades from when it was last set). */
    grudge(a: Id, b: Id): number;
    /** Everyone a bears a grudge against: { id, strength, why }, strongest first. */
    grudges(a: Id): Array<{
        id: Id;
        strength: number;
        why: string;
    }>;
    /** Changes a's grudge against b (from the game: recorded). Negative eases it. */
    grudgeAgainst(a: Id, b: Id, by: number, why?: string): void;
    /** Changes a grudge inside the simulation. */
    applyGrudge(a: Id, b: Id, by: number, why: string): void;
    /** A feud's strength now (it fades from when it was last set). */
    private feudStrength;
    /** Is a person in a party (themselves, or a group they belong to)? */
    private inParty;
    /** The feud between two people, as people or through their groups: its strength, 0 if none. */
    feudBetween(a: Id, b: Id): number;
    /** Every feud: { a, b, strength, since, why }. */
    feuds(): Array<{
        a: Id;
        b: Id;
        strength: number;
        since: number;
        why: string;
    }>;
    /** How much a has against b: their grudge or their feud, whichever is stronger. */
    animosity(a: Id, b: Id): number;
    /** Declares a feud between two people or two groups (from the game: recorded); a strength of 0 or null ends it. */
    feud(a: Id, b: Id, strength: number | null, why?: string): void;
    /** Sets a feud inside the simulation. */
    applyFeud(a: Id, b: Id, s: number | null, why: string): void;
    /** A stream of Bree's own: its draws leave people's own streams as they were. */
    private stream;
    /** Is someone free to talk: about, not walking, not doing something quiet (asleep)? */
    private free;
    /** The exchange someone is in, or undefined. */
    private exOf;
    /**
     * Starts an exchange of a kind (from the game: recorded, and it applies at
     * once): `a` starts it with `b` (or several, a group). Anyone already in
     * one leaves it. Returns it as it stands after the first turn, or null.
     * `minutes`: the time they have (no turn after it); `turns`: how many.
     */
    start(kind: Id, a: Id, b: Id | Id[], opts?: {
        minutes?: number;
        turns?: number;
    }): ExchangeView | null;
    /** Ends an exchange now (by its id, or someone in it): someone walked away on screen (recorded). */
    end(which: number | Id): void;
    /** Starts an exchange inside the simulation (see start). */
    applyStart(kind: Id, a: Id, others: Id[], opts?: {
        minutes?: number;
        turns?: number;
    }): ExchangeView | null;
    /** Ends an exchange inside the simulation. */
    applyEnd(which: number | Id): void;
    /** Begins an exchange: the turns it'll run to, the first turn now, the next on the clock. */
    private begin;
    /** The turns an exchange runs to: its own, or by how they stand, how talkative and how low they are; times talk; within the time they have. */
    private plan;
    /** The kinds the starter might strike up with someone, each with its weight. */
    private choices;
    /** The skill a teacher could teach someone: their best, well enough over the other's. */
    private lesson;
    /**
     * How words of a kind from the speaker land with the listener now: the
     * score from the listener's side with its parts, and where it falls,
     * before the luck of the turn. A look: it changes nothing.
     */
    weigh(kind: Id, speaker: Id, listener: Id, opts?: {
        topic?: Id;
        subject?: Value;
        manner?: Id;
        place?: Id;
    }): {
        score: number;
        outcome: Outcome;
        parts: Array<[string, number]>;
    } | null;
    /** The parts of how words land with the listener (the speaker is the target), each a setting's weight. */
    private parts;
    /** The luck of a turn: two draws, so mostly near nothing. */
    private luck;
    /** Are they all still together and awake, where it began? */
    private together;
    /** Who speaks to whom next, and the step: turn about, the one who leads first. */
    private nextStep;
    /** One turn: who speaks, how it lands, what it changes, and when the next comes. */
    private turn;
    /**
     * Words landed badly with the one who heard them (l): do they answer back
     * harder (and does the other keep their patience, or someone step in), or
     * walk off, or let it go?
     */
    private react;
    /** Talk turns into an argument, an argument into a fight: the one who escalated leads it now, and whoever's there sees it. */
    private escalate;
    /** An exchange of a kind breaks out where people can see it: a crime for Wormtongue, if the game calls it one, and Bree's own witnesses. */
    private breaksOut;
    /** Who's about to see what happens in an exchange: the game's own say (bree.witnesses), or everyone at the place, awake, not in it. */
    private seers;
    /**
     * People see an exchange go wrong: they believe what they saw (did:<who
     * started it>:<kind>, the other as its value: gossip, through Wormtongue),
     * remember it, feel it, and think less of whoever started it. Once a kind,
     * each. With `crime`, Wormtongue has seen to the belief, memory and feeling.
     */
    private witness;
    /** The game says who saw an exchange (in progress, or lately finished): they see what it came to (recorded). */
    witnessed(exchange: number, seenBy: Id[]): void;
    /** Witnesses reported by the game, inside the simulation. */
    applyWitnessed(exchange: number, seenBy: Id[]): void;
    /** Puts the next turn on the clock. */
    private schedule;
    /** Tells the game about a turn. */
    private tell;
    /** The exchange as the game sees it. */
    private view;
    /** The exchange someone's in (by its id, or someone in it), as the game sees it, or null. */
    exchange(which: number | Id): ExchangeView | null;
    /** Every exchange in progress. */
    exchanges(): ExchangeView[];
    /** Finished exchanges (the last config.recent), newest last; those of a pair, with both given. */
    history(a?: Id, b?: Id): Finished[];
    /** Ends an exchange: what each outcome does, for each of them. */
    private finish;
    /** What an exchange leaves each of them: regard, attraction, feelings, memories, sentiments, relief, and what the kind does. */
    private leave;
    /** Two people spend time together: now and then one strikes up an exchange. */
    met(a: PersonState, b: PersonState, _place: Id, minutes: number): void;
    /** An action that interacts (its `interact`) begins its exchange with its target, over its length. */
    started(p: PersonState, d: Doing): void;
    /** The next turn of an exchange comes due. */
    timer(item: QueueItem): void;
    day(): void;
    removed(p: PersonState): void;
}
export { DAY };
