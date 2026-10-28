// Bree: interactions between people. Named for the village of the Prancing
// Pony, where folk of every sort meet over a pint, talk, and now and then
// fall out.
//
//   kinds          what passes between two people: a chat, a joke, a
//                  compliment, a flirt, an argument, an insult, a fight, an
//                  apology... declared by the game (with a starter set to
//                  take or replace), each with who may start it with whom,
//                  what it relieves, which topics fit, how it's weighed and
//                  what each outcome does
//   outcomes       by degrees, not yes or no: warm, good, fine, awkward, sour
//                  or a row, from both sides' natures, moods, needs, stress,
//                  regard, compatibility and attraction, the topic, the place
//                  and their history (Prom Week's social exchanges, The Sims'
//                  social interactions)
//
// State is made with the first exchange or grudge (world.s.mod.bree), so a
// world that declares nothing for it is exactly the world it was.
import type { Module } from '../core/module';
import type { Consideration, Cond, Ctx, Effect, Id, PersonState, Value } from '../core/types';
import type { World } from '../core/world';
import { DAY, HOUR, clamp, round } from '../core/util';
import type { LandRules } from './landing';

/** The steps an exchange can come out at, best first. */
export type Outcome = 'warm' | 'good' | 'fine' | 'awkward' | 'sour' | 'row';
export const OUTCOMES: readonly Outcome[] = ['warm', 'good', 'fine', 'awkward', 'sour', 'row'];
/** What a kind can say it does: at an outcome, after a long one, when someone walks off, and at any end. */
export type OutcomeKey = Outcome | 'long' | 'left' | 'end';

/** What an outcome does, for each of them, besides the regard and grudges it moves. */
export interface OutcomeDo {
  /** A feeling for each of them, or [for the one who started it, for the other]; null for none (over the config's `feel`). */
  feel?: Id | null | [Id | null, Id | null];
  /** A sentiment the other keeps about the one who started it (with `both`, the other way too). */
  sentiment?: { label: string; by?: number; minutes?: number; both?: boolean };
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
  // The headline knobs: plain multipliers, 1 changing nothing. A person's own
  // (PersonDef.tune.bree) multiplies these for them alone.
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

  // Striking up.
  /** The chance a meeting (two people doing something together) starts an exchange, before talk. Default 0.3. */
  strike: number;
  /** Nobody strikes up an exchange, joins one, or keeps one going while doing an action with one of these tags. Default ['sleep']. */
  quiet: string[];
  /** A kind that relieves a pressing need is more appealing: weight × (1 + relief × urgency × needPull), summed over its needs. Default 2. */
  needPull: number;
  /** The terms each trait role is read from (a game maps its own: humor: 'trait.wit'). A role with no trait reads as config.traitDefault. */
  traits: Record<string, string>;

  // How an exchange lands: a score from the listener's side, each part a setting.
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

  // What an outcome does, by outcome.
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

  // How long they talk.
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

  // Topics.
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

  // Groups.
  /** Most people in one exchange. Default 5. */
  groupMax: number;
  /** The chance someone at the same place joins a group exchange (times their talk). Default 0.5. */
  joinChance: number;
  /** Only people whose regard for one of those talking is at least this join. Default 0. */
  joinRegard: number;

  // Escalation.
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

  // Grudges and feuds.
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

  // Avoidance.
  /** Grudges and feuds weaker than this don't keep anyone away. Default 0.05. */
  avoidFrom: number;
  /** An option at a place where someone they bear a grudge against is weighs 1 - animosity × avoidPlace; a social one aimed at them 1 - animosity × avoidTarget; never under avoidFloor. Defaults 0.6, 0.8 and 0.1. */
  avoidPlace: number;
  avoidTarget: number;
  avoidFloor: number;
  /** A hostile interaction aimed at them weighs 1 + animosity × hostilePull instead. Default 1. */
  hostilePull: number;

  // Making up.
  /** The sentiment a grudge made up leaves: its label and how much it adds. Defaults 'made it up' and 0.05. */
  reconcileLabel: string;
  reconcileSentiment: number;
  /** The feeling, and the memory's importance, of making up. Defaults 'made_up' and 5. */
  reconcileFeeling: string;
  reconcileMemory: number;

  // Witnesses.
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

export const DEFAULT_BREE: BreeConfig = {
  warmth: 1, quarrels: 1, escalation: 1, grudges: 1, forgiveness: 1, talk: 1,
  strike: 0.3, quiet: ['sleep'], needPull: 2,
  traits: { temper: 'trait.temper', warmth: 'trait.warmth', humor: 'trait.humor', patience: 'trait.patience', courage: 'trait.courage', forgiveness: 'trait.forgiveness', talkative: 'trait.talkative' },
  scale: [2, 0.75, -0.75, -1.75, -3], spread: 1.5,
  regardWeight: 2, compatWeight: 1, moodWeight: 1, stressWeight: 1, needWeight: 2, attractWeight: 3, grudgeWeight: 3,
  rowWeight: 2, rowMinutes: 1440, roomWeight: 0.5, topicWeight: 1, mannerWeight: 1, sway: 0.4,
  regard: { warm: 0.04, good: 0.02, fine: 0.005, awkward: -0.01, sour: -0.03, row: -0.08 },
  attraction: { warm: 0.05, good: 0.025, fine: 0, awkward: -0.01, sour: -0.03, row: -0.06 },
  grudge: { warm: 0, good: 0, fine: 0, awkward: 0, sour: 0.1, row: 0.25 },
  mends: { warm: 1.5, good: 1, fine: 0.5, awkward: 0, sour: 0, row: 0 },
  feel: { warm: 'good_talk', sour: 'had_words', row: 'had_words', long: 'long_chat', left: 'snubbed' },
  memory: { row: 5 },
  groupShare: 0.5, longTurns: 6, leftRegard: -0.03, teachOver: 0.2,
  turns: { partner: 8, kin: 6, close: 8, friend: 5, acquaintance: 3, stranger: 2, rival: 4, sour: 2 },
  bonds: [0.6, 0.3, 0.05, -0.15], rivalAt: 0.3,
  talkativeTurns: 2, lowMood: 0.35, lowMoodTurns: 2, turnsJitter: 1, minTurns: 2, maxTurns: 12, quickTurns: 2, groupTurns: 3, turnGap: [2, 4],
  topicPull: 0.5, topicCooldown: DAY, topicMemory: 8, tellAt: 'fine', trust: 0.7, shareWindow: HOUR, likeAbove: 1.1, mannerJitter: 0.1,
  groupMax: 5, joinChance: 0.5, joinRegard: 0,
  escalateAt: 'sour', escalateBase: 0.25, escalateTemper: 0.5, escalateStress: 0.5, escalateGrudge: 0.6, escalateRegard: 0.5,
  calmBase: 0.1, calmPatience: 0.6, calmRegard: 0.3,
  stepInBase: 0.05, stepInRegard: 0.5, stepInCourage: 0.3, stepInFrom: 0.2, mediateRegard: 0.03, mediateMends: 0.1,
  leaveBase: 0.3, leaveTemper: 0.35, leaveRegard: 0.3, leaveSour: 0.2,
  grudgeTemper: 0.5, grudgeForgive: 0.5, fade: 0.04, forgiveBase: 0.5, forgiveTrait: 1, grudgeFloor: 0.02,
  feudAt: 0.5, feudFade: 0.01, feudSpread: 0, feudMends: 0.5,
  avoidFrom: 0.05, avoidPlace: 0.6, avoidTarget: 0.8, avoidFloor: 0.1, hostilePull: 1,
  reconcileLabel: 'made it up', reconcileSentiment: 0.05, reconcileFeeling: 'made_up', reconcileMemory: 5,
  seenAt: 'sour', witnessStrength: 0.8, witnessMemory: 3, witnessRegard: 0.5, witnessFeeling: 'saw_row',
  recent: 50,
};

/** Feelings Bree gives (declared when Reverie is on; a game declares its own with the same ids to change them). */
const BREE_FEELINGS = [
  { id: 'good_talk', label: 'A good talk', weight: 0.05, minutes: 4 * HOUR, emotion: 'happy' },
  { id: 'long_chat', label: 'A proper long talk', weight: 0.07, minutes: 7 * HOUR, emotion: 'happy' },
  { id: 'had_words', label: 'Had words with someone', weight: -0.1, minutes: 6 * HOUR, stack: 2, emotion: 'angry' },
  { id: 'snubbed', label: 'Brushed off', weight: -0.05, minutes: 4 * HOUR, stack: 2, emotion: 'sad' },
  { id: 'fought', label: 'In a fight', weight: -0.2, minutes: DAY, stack: 2, emotion: 'angry' },
  { id: 'made_up', label: 'Made it up', weight: 0.1, minutes: DAY, emotion: 'relieved' },
  { id: 'saw_row', label: 'Saw a row', weight: -0.04, minutes: 4 * HOUR, emotion: 'tense' },
  { id: 'comforted', label: 'Someone was kind', weight: 0.08, minutes: 6 * HOUR, emotion: 'happy' },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** An exchange in progress. */
export interface Exchange {
  id: number;
  /** The kind it is now (it changes when it escalates), and the kind it began as. */
  kind: Id;
  first: Id;
  /** Who's in it: the one who started it first. */
  who: Id[];
  place: Id;
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
  topic?: { id: Id; subject?: Value; by: Id; steps: string[]; i: number };
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
}

/** How two people have got on in their exchanges (by 'a|b', the two in order). */
interface Pair {
  n: number;
  last: number;
  /** The last row: when, and who started it. */
  row?: number;
  by?: Id;
  /** When each topic last came up between them. */
  topics?: Record<Id, number>;
  /** When they last made up. */
  mended?: number;
  outcome?: Outcome;
}

/** A feud: between two people, or two groups (households, families, factions), both ways. */
export interface Feud { a: Id; b: Id; s: number; t: number; why: string }

/** A finished exchange, kept a while. */
export interface Finished {
  id: number; kind: Id; first: Id; who: Id[]; place: Id; t: number; end: number;
  outcome: Outcome; n: number; why: string; by?: Id; left?: Id; mediator?: Id;
}

interface State {
  /** Draws from Bree's own stream. */
  n: number;
  /** Exchanges begun. */
  ids: number;
  /** Changes to grudges and feuds. */
  v: number;
  ex: Record<string, Exchange>;
  /** Who's in which exchange. */
  of: Record<Id, number>;
  /** Grudges: holder -> other -> [strength, since, why]. */
  g: Record<Id, Record<Id, [number, number, string]>>;
  feuds: Record<string, Feud>;
  pairs: Record<string, Pair>;
  recent: Finished[];
}

const pairKey = (a: Id, b: Id): string => (a < b ? a + '|' + b : b + '|' + a);

// ---------------------------------------------------------------------------
// The starter set
// ---------------------------------------------------------------------------

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
export function breeStarter(opts: StarterOptions = {}): { kinds: KindDef[]; topics: TopicDef[]; manners: MannerDef[] } {
  const co = opts.company ?? 'company', fun = opts.fun ?? 'fun';
  const nature = (role: string, lo: number, hi: number): Consideration => ({ name: role, input: 'nature.' + role, out: [lo, hi] });
  const kinds: KindDef[] = [
    { id: 'chat', label: 'a chat', tags: ['talk', 'friendly'], topics: ['*'], group: true, relieves: { [co]: 0.15, [fun]: 0.05 }, escalates: 'argue',
      weight: [nature('talkative', 0.5, 1.5)] },
    { id: 'deep_talk', label: 'a heart to heart', tags: ['talk', 'friendly'], topics: ['tag:deep', '*'], to: ['regard>0.3'], relieves: { [co]: 0.3 }, base: 0.25, traits: { warmth: 0.5 }, regard: 1.5, escalates: 'argue',
      weight: [nature('warmth', 0.2, 1)], on: { long: { memory: 4 } } },
    { id: 'joke', label: 'a joke', tags: ['friendly'], relieves: { [fun]: 0.1 }, base: 0.25, traits: { humor: 1.5, temper: -0.5 }, skill: { humor: 1 }, escalates: 'argue',
      weight: [nature('humor', 0.1, 1.2)] },
    { id: 'compliment', label: 'a compliment', tags: ['friendly'], to: ['regard>0'], base: 1, traits: { warmth: 0.5 }, weight: 0.4,
      on: { warm: { sentiment: { label: 'said something kind', by: 0.05, minutes: 2 * DAY } } } },
    { id: 'tease', label: 'some teasing', tags: ['friendly'], to: ['regard>0.2'], relieves: { [fun]: 0.1 }, traits: { humor: 1, temper: -1.5 }, skill: { humor: 0.5 }, escalates: 'argue',
      weight: [nature('humor', 0.1, 0.8)] },
    { id: 'flirt', label: 'flirting', tags: ['romantic', 'talk'], topics: ['tag:romantic', 'small_talk'], who: ['!is:child'], to: ['attraction>0.1', '!target.is:child'], traits: { warmth: 0.5 }, skill: { humor: 0.5, warmth: 0.5 },
      weight: [{ name: 'attraction', input: 'attraction', range: [0, 1], out: [0.2, 2.5] }] },
    { id: 'comfort', label: 'a word of comfort', tags: ['friendly'], to: ['target.mood<0.4', 'regard>0'], relieves: { [co]: 0.2 }, base: 0.5, lands: [{ if: ['mood<0.35'], by: 1 }], skill: { warmth: 1 },
      weight: [nature('warmth', 0.2, 1.5)], on: { warm: { feel: [null, 'comforted'] }, good: { feel: [null, 'comforted'] } } },
    { id: 'favor', label: 'asking a favor', to: ['regard>0.1'], base: -0.25, traits: { warmth: 1 }, lands: [{ if: ['regard>0.4'], by: 1 }], owes: 1, weight: 0.2 },
    { id: 'gift', label: 'a gift', tags: ['friendly'], to: ['regard>0'], base: 1.5, regard: 2, mends: 0.2, weight: 0.1,
      on: { warm: { sentiment: { label: 'gave me a present', by: 0.1, minutes: 7 * DAY } } } },
    { id: 'help', label: 'a hand', tags: ['friendly'], to: ['regard>0.1'], base: 1, regard: 1.5, mends: 0.1, deed: 'helped', weight: 0.2 },
    { id: 'teach', label: 'a lesson', tags: ['friendly'], turns: 3, base: 0.5, traits: { patience: 0.5 }, skill: { patience: 1 }, teaches: 1, weight: 0.15 },
    { id: 'argue', label: 'an argument', tags: ['hostile', 'talk'], topics: ['grievance', '*'], turns: [3, 5], base: -1, traits: { temper: -1, patience: 1 }, regard: 1.5, escalates: 'fight',
      weight: [{ name: 'grudge', input: 'grudge', out: [0.05, 2] }, { name: 'regard', input: 'regard', range: [-1, 0.5], out: [1.5, 0.2] }], on: { row: { memory: 5 } } },
    { id: 'insult', label: 'an insult', tags: ['hostile'], to: ['regard<-0.2'], base: -2.5, traits: { temper: -1, forgiveness: 0.5 }, skill: { humor: 0.5 }, regard: 1.5, grudge: 1.5, escalates: 'fight',
      weight: [{ name: 'dislike', input: 'regard', range: [-1, -0.2], out: [1, 0.1] }] },
    { id: 'fight', label: 'a fight', tags: ['hostile'], turns: 2, base: -4, traits: { courage: 0.5 }, regard: 2, grudge: 2, crime: 'fight', weight: 0,
      on: { sour: { feel: 'fought', memory: 6 }, row: { feel: 'fought', memory: 7 } } },
    { id: 'apologize', label: 'an apology', tags: ['friendly'], to: ['grudged>0.05'], base: 0.5, traits: { forgiveness: 1.5, temper: -0.5 }, skill: { warmth: 0.5 }, mends: 0.5,
      weight: [{ name: 'their grudge', input: 'grudged', out: [0.3, 3] }, nature('warmth', 0.3, 1.5)], on: { sour: { feel: ['snubbed', null] }, row: { feel: ['snubbed', null] } } },
    { id: 'make_up', label: 'making up', tags: ['friendly'], to: ['grudge>0.05', 'grudged>0.05'], turns: 3, base: 0.5, traits: { forgiveness: 1.5 }, mends: 0.6, mutual: true,
      weight: [nature('forgiveness', 0.3, 2)] },
    { id: 'avoid', label: 'the cold shoulder', tags: ['hostile'], to: ['grudge>0.3'], turns: 1, base: -1, regard: 0.5, grudge: 0,
      weight: [{ name: 'grudge', input: 'grudge', out: [0, 2] }], on: { end: { feel: [null, 'snubbed'] } } },
  ];
  const topics: TopicDef[] = [
    { id: 'small_talk', label: 'this and that' },
    { id: 'news', label: 'the news', from: 'beliefs', weight: 1.5 },
    { id: 'old_times', label: 'old times', from: 'memories', tags: ['deep'], fit: [{ if: ['regard>0.3'], by: 0.5 }] },
    { id: 'pastimes', label: 'what they love doing', from: 'likes' },
    { id: 'here', label: 'this place', from: 'place', weight: 0.6 },
    { id: 'the_moment', label: 'what they\'re at', from: 'doing', weight: 0.8 },
    { id: 'troubles', label: 'their troubles', tags: ['deep'], if: ['mood<0.45'], fit: [{ if: ['nature.warmth>0.6'], by: 0.5 }], kinds: ['deep_talk', 'comfort'] },
    { id: 'sweet_nothings', label: 'sweet nothings', tags: ['romantic'], kinds: ['flirt'], fit: [{ if: ['attraction>0.3'], by: 1 }] },
    { id: 'grievance', label: 'what\'s wrong between them', from: 'grudge', kinds: ['argue'], weight: 3 },
  ];
  const manners: MannerDef[] = [
    { id: 'plain', label: 'plain', base: 0.1 },
    { id: 'warm', label: 'warm', traits: { warmth: 2 }, fits: [{ if: ['mood>0.6'], by: 0.3 }], lands: [{ by: 0.25 }] },
    { id: 'witty', label: 'witty', traits: { humor: 2 }, lands: [{ if: ['nature.humor>0.6'], by: 0.75 }, { if: ['nature.temper>0.7'], by: -0.5 }] },
    { id: 'ornery', label: 'ornery', traits: { temper: 2 }, fits: [{ if: ['mood<0.4'], by: 0.5 }, { if: ['stress>0.5'], by: 0.5 }], lands: [{ by: -0.75 }] },
    { id: 'shy', label: 'shy', traits: { talkative: -2 } },
    { id: 'gloomy', label: 'gloomy', base: -0.6, fits: [{ if: ['mood<0.35'], by: 1.2 }], lands: [{ by: -0.25 }, { if: ['nature.warmth>0.6'], by: 0.25 }] },
  ];
  const keep = <T extends { id: Id }>(list: T[], ids?: Id[]): T[] => (ids ? list.filter((d) => ids.includes(d.id)) : list);
  return { kinds: keep(kinds, opts.kinds), topics: keep(topics, opts.topics), manners: keep(manners, opts.manners) };
}

// ---------------------------------------------------------------------------
// The module
// ---------------------------------------------------------------------------

export class Bree implements Module {
  readonly name = 'bree';
  readonly config: BreeConfig;
  readonly knobs = { warmth: 'person', quarrels: 'person', escalation: 'person', grudges: 'person', forgiveness: 'person', talk: 'person' } as const;
  readonly kinds = new Map<Id, KindDef>();
  readonly topics = new Map<Id, TopicDef>();
  readonly manners = new Map<Id, MannerDef>();
  private w!: World;

  constructor(cfg: Partial<BreeConfig> = {}) { this.config = { ...DEFAULT_BREE, ...cfg }; }

  private get st(): State | undefined { return this.w.s.mod.bree as State | undefined; }
  private mut(): State { return (this.w.s.mod.bree ||= { n: 0, ids: 0, v: 0, ex: {}, of: {}, g: {}, feuds: {}, pairs: {}, recent: [] }) as State; }
  /** The config in force: as declared, under any world.tune. */
  private get c(): BreeConfig { return this.w.tuned(this.name, this.config); }
  /** A headline knob for someone: the world's, times their own. */
  knob(name: 'warmth' | 'quarrels' | 'escalation' | 'grudges' | 'forgiveness' | 'talk', id: Id | undefined): number {
    return this.c[name] * this.w.own(id === undefined ? undefined : this.w.s.people[id], this.name, name);
  }

  attach(w: World): void {
    this.w = w;
    const L = w.lang;
    const other = (c: Ctx, a: string): Id | null => (a && a !== 'target' ? a : c.target ?? null);
    // their nature, by role (the game maps each role to its own trait)
    L.term('nature', (c, a) => (c.person ? this.nature(c.person, a) : w.cfg.traitDefault));
    L.term('grudge', (c, a) => { const o = other(c, a); return c.person && o ? this.grudge(c.person.id, o) : 0; });
    L.term('grudged', (c, a) => { const o = other(c, a); return c.person && o ? this.grudge(o, c.person.id) : 0; });
    L.term('feud', (c, a) => { const o = other(c, a); return c.person && o ? this.feudBetween(c.person.id, o) : 0; });
    L.term('bond', (c, a) => {
      const o = c.target ?? null;
      if (!c.person || !o) return a ? false : null;
      const b = this.bond(c.person.id, o);
      return a ? b === a : b;
    });
    L.term('rowed', (c, a) => {
      const o = other(c, a);
      const row = c.person && o ? this.st?.pairs[pairKey(c.person.id, o)]?.row : undefined;
      return row === undefined ? null : round(w.s.now - row, 2);
    });
    L.term('exchanges', (c, a) => { const o = other(c, a); return c.person && o ? this.st?.pairs[pairKey(c.person.id, o)]?.n ?? 0 : 0; });
    // a game's own lines read nothing new until exchanges run; the feelings Bree gives, if Reverie is on
    const rv = w.reverie;
    if (rv) for (const f of BREE_FEELINGS) if (!rv.feelingDefs.has(f.id)) rv.feelingDefs.set(f.id, f);
    w.defineInput('bree.grudge', (a: Id, b: Id, by: number, why: string | null) => this.applyGrudge(a, b, by, why ?? 'the game'));
    w.defineInput('bree.feud', (a: Id, b: Id, s: number | null, why: string | null) => this.applyFeud(a, b, s, why ?? 'the game'));
  }

  // -------------------------------------------------------------------------
  // Declaring
  // -------------------------------------------------------------------------

  kind(def: KindDef): this { this.kinds.set(def.id, def); return this; }
  topic(def: TopicDef): this { this.topics.set(def.id, def); return this; }
  manner(def: MannerDef): this { this.manners.set(def.id, def); return this; }

  /** Declares the starter set (or some of it): kinds, topics and manners. Declare your own with the same ids after, to change them. */
  starter(opts: StarterOptions = {}): this {
    const s = breeStarter(opts);
    for (const d of s.topics) this.topic(d);
    for (const d of s.manners) this.manner(d);
    for (const d of s.kinds) this.kind(d);
    return this;
  }

  // -------------------------------------------------------------------------
  // Reading people
  // -------------------------------------------------------------------------

  /** Someone's nature in a role (temper, warmth, humor, patience, courage, forgiveness, talkative), read from the term the config maps it to. */
  nature(p: PersonState, role: string): number {
    const term = this.c.traits[role];
    const mid = this.w.cfg.traitDefault;
    if (!term) return mid;
    const v = this.w.lang.value(term, this.w.ctx(p));
    return typeof v === 'number' && isFinite(v) ? v : mid;
  }

  /** How a stands with b: 'partner', 'kin', 'rival', or by regard: 'close', 'friend', 'acquaintance', 'stranger', 'sour'. */
  bond(a: Id, b: Id): string {
    const w = this.w, fs = w.fellowship, c = this.c;
    if (fs?.partner(a) === b) return 'partner';
    if (fs) { const h = fs.household(a); if (h && h === fs.household(b)) return 'kin'; }
    const cr = w.cradle;
    if (cr && (cr.parents(a).includes(b) || cr.parents(b).includes(a))) return 'kin';
    if (Math.min(this.animosity(a, b), this.animosity(b, a)) >= c.rivalAt) return 'rival';
    const r = fs ? fs.regard(a, b) : 0;
    const [close, friend, acq, stranger] = c.bonds;
    return r >= close ? 'close' : r >= friend ? 'friend' : r >= acq ? 'acquaintance' : r >= stranger ? 'stranger' : 'sour';
  }

  /** Where a score falls on the scale. */
  outcome(score: number): Outcome {
    const s = this.c.scale;
    for (let i = 0; i < s.length && i < OUTCOMES.length - 1; i++) if (score >= s[i]) return OUTCOMES[i];
    return 'row';
  }

  /** Is outcome x at least as good as y? */
  atLeast(x: Outcome | string, y: Outcome | string): boolean { return OUTCOMES.indexOf(x as Outcome) <= OUTCOMES.indexOf(y as Outcome); }

  // -------------------------------------------------------------------------
  // Grudges and feuds
  // -------------------------------------------------------------------------

  /** How readily someone forgives: their knob times their nature. */
  private forgiving(id: Id): number {
    const p = this.w.s.people[id];
    const c = this.c;
    return this.knob('forgiveness', id) * (c.forgiveBase + c.forgiveTrait * (p ? this.nature(p, 'forgiveness') : this.w.cfg.traitDefault));
  }

  /** a's grudge against b now, 0..1 (it fades from when it was last set). */
  grudge(a: Id, b: Id): number {
    const g = this.st?.g[a]?.[b];
    if (!g) return 0;
    const days = (this.w.s.now - g[1]) / DAY;
    return round(Math.max(0, g[0] - this.c.fade * this.forgiving(a) * days), 4);
  }

  /** Everyone a bears a grudge against: { id, strength, why }, strongest first. */
  grudges(a: Id): Array<{ id: Id; strength: number; why: string }> {
    const out: Array<{ id: Id; strength: number; why: string }> = [];
    const g = this.st?.g[a];
    if (g) for (const b of Object.keys(g)) { const s = this.grudge(a, b); if (s > 0) out.push({ id: b, strength: s, why: g[b][2] }); }
    return out.sort((x, y) => y.strength - x.strength || (x.id < y.id ? -1 : 1));
  }

  /** Changes a's grudge against b (from the game: recorded). Negative eases it. */
  grudgeAgainst(a: Id, b: Id, by: number, why?: string): void { this.w.input('bree.grudge', [a, b, by, why ?? null]); }

  /** Changes a grudge inside the simulation. */
  applyGrudge(a: Id, b: Id, by: number, why: string): void {
    if (a === b || !this.w.s.people[a]) return;
    const st = this.mut();
    const now = this.w.s.now;
    const s = clamp(this.grudge(a, b) + by);
    const map = (st.g[a] ||= {});
    st.v++;
    if (s <= 0) { delete map[b]; if (!Object.keys(map).length) delete st.g[a]; }
    else map[b] = [round(s, 4), now, by > 0 ? why : map[b]?.[2] ?? why];
    this.w.log('grudge', a, { against: b, by: round(by, 4), strength: round(s, 4), why });
    if (by > 0) this.w.emit('bree:grudge', { id: a, against: b, strength: round(s, 4), why });
    // grudges both ways, strong enough: a feud
    const c = this.c;
    if (by > 0 && s >= c.feudAt && this.grudge(b, a) >= c.feudAt && !st.feuds[pairKey(a, b)]) this.applyFeud(a, b, Math.min(s, this.grudge(b, a)), why);
  }

  /** A feud's strength now (it fades from when it was last set). */
  private feudStrength(f: Feud): number {
    const days = (this.w.s.now - f.t) / DAY;
    return round(Math.max(0, f.s - this.c.feudFade * this.c.forgiveness * days), 4);
  }

  /** Is a person in a party (themselves, or a group they belong to)? */
  private inParty(id: Id, party: Id): boolean { return id === party || !!this.w.fellowship?.groupsOf(id).includes(party); }

  /** The feud between two people, as people or through their groups: its strength, 0 if none. */
  feudBetween(a: Id, b: Id): number {
    const feuds = this.st?.feuds;
    if (!feuds) return 0;
    let best = 0;
    for (const k of Object.keys(feuds)) {
      const f = feuds[k];
      if ((this.inParty(a, f.a) && this.inParty(b, f.b)) || (this.inParty(a, f.b) && this.inParty(b, f.a))) best = Math.max(best, this.feudStrength(f));
    }
    return best;
  }

  /** Every feud: { a, b, strength, since, why }. */
  feuds(): Array<{ a: Id; b: Id; strength: number; since: number; why: string }> {
    const feuds = this.st?.feuds || {};
    return Object.keys(feuds).sort().map((k) => ({ a: feuds[k].a, b: feuds[k].b, strength: this.feudStrength(feuds[k]), since: feuds[k].t, why: feuds[k].why })).filter((f) => f.strength > 0);
  }

  /** How much a has against b: their grudge or their feud, whichever is stronger. */
  animosity(a: Id, b: Id): number { return Math.max(this.grudge(a, b), this.feudBetween(a, b)); }

  /** Declares a feud between two people or two groups (from the game: recorded); a strength of 0 or null ends it. */
  feud(a: Id, b: Id, strength: number | null, why?: string): void { this.w.input('bree.feud', [a, b, strength, why ?? null]); }

  /** Sets a feud inside the simulation. */
  applyFeud(a: Id, b: Id, s: number | null, why: string): void {
    if (a === b) return;
    const st = this.mut();
    const k = pairKey(a, b);
    st.v++;
    if (s === null || s <= 0) {
      if (!st.feuds[k]) return;
      delete st.feuds[k];
      this.w.log('feud', a, { with: b, strength: 0, why });
      this.w.emit('bree:feud', { a, b, strength: 0, why });
      return;
    }
    const [x, y] = a < b ? [a, b] : [b, a];
    st.feuds[k] = { a: x, b: y, s: round(clamp(s), 4), t: this.w.s.now, why };
    this.w.log('feud', a, { with: b, strength: round(clamp(s), 4), why });
    this.w.emit('bree:feud', { a, b, strength: round(clamp(s), 4), why });
  }

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------

  day(): void {
    const st = this.st;
    if (!st) return;
    const floor = this.c.grudgeFloor;
    for (const a of Object.keys(st.g)) {
      for (const b of Object.keys(st.g[a])) if (this.grudge(a, b) < floor) delete st.g[a][b];
      if (!Object.keys(st.g[a]).length) delete st.g[a];
    }
    for (const k of Object.keys(st.feuds)) if (this.feudStrength(st.feuds[k]) < floor) delete st.feuds[k];
  }

  removed(p: PersonState): void {
    const st = this.st;
    if (!st) return;
    delete st.g[p.id];
    for (const a of Object.keys(st.g)) { delete st.g[a][p.id]; if (!Object.keys(st.g[a]).length) delete st.g[a]; }
    for (const k of Object.keys(st.feuds)) if (st.feuds[k].a === p.id || st.feuds[k].b === p.id) delete st.feuds[k];
  }
}

export { DAY };
