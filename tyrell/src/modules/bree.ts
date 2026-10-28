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
//   conversations  over turns on the clock, topic by topic: opened, answered,
//                  followed up and capped, on what's true for the two of them
//                  (news one has, a memory they share, what they love doing,
//                  what they're at, where they are, the game's own), each in
//                  their own manner; friends talk long and strangers briefly;
//                  round a table everyone answers, and someone happening by
//                  joins in (Merryfolk's natters and table talk). Each turn
//                  is told to the game as it comes, with the words left to it
//                  (or Cityspeak's most specific line), and off screen it all
//                  happens the same. A game that works out who's near whom
//                  itself strikes them up as its people meet, seats them at
//                  a table, and says who's still together
//   escalation     a sour turn can turn talk into an argument and an argument
//                  into a fight, unless the other keeps their patience or
//                  someone there steps in, or the one hurt walks off; whoever
//                  is about sees it, remembers it and gossips it, and a fight
//                  can be a crime they report (RimWorld's social fights)
//   grudges        one person's against another, with a reason and a strength
//                  that fades at a set pace, coloring what comes after (Dwarf
//                  Fortress); feuds between two people or two households,
//                  both ways (Dune's kanly, Crusader Kings' rivalries); people
//                  keep away from those they have something against; and
//                  making up: an apology, a gift, a go-between, or time
//
// State is made with the first exchange or grudge (world.s.mod.bree), so a
// world that declares nothing for it is exactly the world it was.
import type { Module } from '../core/module';
import type { ActionDef, Candidate, Consideration, Cond, Ctx, Doing, Effect, Id, PersonState, QueueItem, Value } from '../core/types';
import type { World } from '../core/world';
import { DAY, HOUR, Stream, clamp, hash01, round } from '../core/util';
import { landing } from './landing';
import type { LandRules } from './landing';
import type { Blow } from './morgul';

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
  /** Turns: a number, [min, max], or a function (the starter as the person, the other as target: a game's own reckoning). Default: by how they stand (config.turns) for one with topics, config.quickTurns for one without. */
  turns?: number | [number, number] | ((ctx: Ctx) => number);
  /** Minutes between its turns: [min, max], drawn. Default config.turnGap. */
  gap?: number[];
  /** Others nearby can join in (a table). */
  group?: boolean;
  /** A group goes on without whoever leaves it, while two are left (a table someone gets up from). Default false: anyone leaving ends it. */
  stays?: boolean;
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
export type TopicSource = 'beliefs' | 'memories' | 'events' | 'likes' | 'doing' | 'place' | 'grudge';

/** Something to talk about (a definition). */
export interface TopicDef {
  id: Id;
  label?: string;
  tags?: string[];
  /**
   * Where its subject comes from: 'beliefs' (news the speaker has and the
   * listener hasn't), 'memories' (one they share, or the speaker's of the
   * listener), 'events' (what's happened to the speaker lately: their
   * strongest memory of the last recentMinutes), 'likes' (something the
   * speaker loves doing), 'doing' (what
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
  /**
   * Two people still together after an exchange between them is done (both
   * free, at the same place) may strike up another this many minutes later,
   * by the same chance, and every as many after while they stay together
   * and nothing strikes: people sitting side by side talk on and off. 0:
   * only when they meet. Default 0.
   */
  again: number;
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
  /** What's happened to someone lately ('events' topics): a memory of the last this many minutes. Default 1440. */
  recentMinutes: number;
  /** A taste (instinct, or habit) above this counts as something they like doing. Default 1.1. */
  likeAbove: number;
  /** A topic they share (the same doing, a memory both hold) is this much more to the listener's taste. Default 0.5. */
  shareFit: number;
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
  /** Days after their last exchange that what's kept of two people's exchanges (the last row, their topics) is let go; 0 never. Default 30. */
  pairDays: number;
}

export const DEFAULT_BREE: BreeConfig = {
  warmth: 1, quarrels: 1, escalation: 1, grudges: 1, forgiveness: 1, talk: 1,
  strike: 0.3, again: 0, quiet: ['sleep'], needPull: 2,
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
  topicPull: 0.5, topicCooldown: DAY, topicMemory: 8, tellAt: 'fine', trust: 0.7, shareWindow: HOUR, recentMinutes: DAY, likeAbove: 1.1, shareFit: 0.5, mannerJitter: 0.1,
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
  recent: 50, pairDays: 30,
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
  /** The topic on now: its subject, who opened it, its steps ([step, who, to]) and how far through. */
  topic?: { id: Id; subject?: Value; by: Id; steps: Array<[string, Id, Id]>; i: number };
  /** Who opened the last topic. */
  opener?: Id;
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

/** What the one hurt does about it. */
interface Reaction { act: 'none' | 'calm' | 'step_in' | 'escalate' | 'leave'; by?: Id }

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
  /** When they may strike up again, if they're still together (config.again). */
  again?: number;
}

/** A feud: between two people, or two groups (households, families, factions), both ways. */
export interface Feud { a: Id; b: Id; s: number; t: number; why: string }

/** A finished exchange, kept a while. */
export interface Finished {
  id: number; kind: Id; first: Id; who: Id[]; place: Id | null; t: number; end: number;
  outcome: Outcome; outcomes: Record<Id, Outcome>; n: number; why: string; by?: Id; left?: Id; mediator?: Id;
}

/** An exchange as the game sees it. */
export interface ExchangeView {
  id: number; kind: Id; first: Id; who: Id[]; place: Id | null; t: number; why: string;
  /** Turns taken so far, and planned. */
  turn: number; turns: number;
  /** How it's going: the running outcome and score (null before the first turn). */
  outcome: Outcome | null; score: number | null;
  topic: { id: Id; subject?: Value } | null;
  manners: Record<Id, Id>;
  by?: Id;
}

/** One turn, as it's told to the game (event 'bree:turn'). */
export interface Turn {
  id: number; kind: Id;
  /** Which turn this is (1 for the first). */
  n: number;
  who: Id; to: Id;
  /** 'open', 'reply', 'more', 'back' (a topic's steps), 'bye', 'leave', 'calm', 'step_in'. */
  step: string;
  topic: Id | null; subject?: Value;
  manner?: Id;
  /** How this turn landed, and how the exchange is going now. */
  landed: Outcome | null; outcome: Outcome | null;
  /** The line topic for the words: the game's own lines, or Cityspeak's (with its key and text). */
  line: string; key?: string; text?: string;
  /** The exchange ends with this turn. */
  end: boolean;
  /** A fight by numbers (Morgul): the blow this turn landed, one way or the other. */
  harm?: Blow;
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
/** Has an object any keys (without making a list of them)? */
const hasKeys = (o: object): boolean => { for (const _ in o) return true; return false; };

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
    { id: 'doings', label: 'what they\'ve been up to', from: 'events', weight: 1.2 },
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
  /**
   * Who sees an exchange go wrong (a definition: set it on every start, like
   * Cradle's namer). Default null: everyone at the place, awake, not in it.
   * The game owns sight: give it its own (a room indoors, shouting distance
   * on a street), deterministic from the world's state.
   */
  witnesses: ((ex: ExchangeView, world: World) => Id[]) | null = null;
  /**
   * Whether the people in an exchange are still together (a definition, like
   * witnesses): the id of someone who has left the others, or null. Default
   * null: they must all be where it began (its outermost place). A game that
   * works out who's near whom itself (its people each at a place of their
   * own in Tyrell) says so here; whoever is asleep or away has left anyway.
   */
  together: ((ex: ExchangeView, world: World) => Id | null) | null = null;
  private w!: World;
  /** Who someone has something against, as of a moment (outside the state: it's worked out again from it). */
  private foeCache: { st: State; id: Id; now: number; seq: number; v: number; list: Array<{ id: Id; a: number }> } | null = null;

  constructor(cfg: Partial<BreeConfig> = {}) { this.config = { ...DEFAULT_BREE, ...cfg }; }

  private get st(): State | undefined { return this.w.s.mod.bree as State | undefined; }
  private mut(): State { return (this.w.s.mod.bree ||= { n: 0, ids: 0, v: 0, ex: {}, of: {}, g: {}, feuds: {}, pairs: {}, recent: [] }) as State; }
  /** The config in force: as declared, under any world.tune. */
  private get c(): BreeConfig { return this.w.tuned(this.name, this.config); }
  /** A headline knob for someone: the world's, times their own. */
  knob(name: 'warmth' | 'quarrels' | 'escalation' | 'grudges' | 'forgiveness' | 'talk', id: Id | undefined): number {
    return this.c[name] * this.w.own(id === undefined ? undefined : this.w.s.people[id], this.name, name);
  }
  /** How chatty people are together: the world's talk, times each one's own. */
  private talkOf(ids: readonly Id[]): number {
    let k = this.c.talk;
    for (const id of ids) k *= this.w.own(this.w.s.people[id], this.name, 'talk');
    return k;
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
    L.term('exchange', (c, a) => { const ex = c.person ? this.exOf(c.person.id) : undefined; return a ? ex?.kind === a : ex?.kind ?? null; });
    L.term('outcome', (c, a) => {
      if (!c.person) return a ? false : null;
      const ex = this.exOf(c.person.id);
      const o = ex ? (ex.score === null ? null : this.outcome(ex.score)) : c.target ? this.st?.pairs[pairKey(c.person.id, c.target)]?.outcome ?? null : null;
      return a ? o === a : o;
    });
    L.term('turn', (c, a) => { const o = (c.person ? this.exOf(c.person.id)?.last : undefined) ?? null; return a ? o === a : o; });
    L.term('manner', (c, a) => { const m = c.person ? this.mannerOf(c.person.id) : null; return a ? m === a : m; });
    L.term('subject', (c) => (c.person ? this.exOf(c.person.id)?.topic?.subject ?? null : null));
    L.effect('exchange', (c, a) => { if (c.person && c.target && this.kinds.has(a) && !this.exOf(c.person.id) && !this.exOf(c.target)) this.begin(a, [c.person.id, c.target], 'game'); });
    w.defineInput('bree.start', (kind: Id, a: Id, others: Id[], opts: { minutes?: number; turns?: number } | null) => this.applyStart(kind, a, others, opts ?? {}));
    w.defineInput('bree.strike', (a: Id, b: Id, opts: { minutes?: number; turns?: number } | null) => this.applyStrike(a, b, opts ?? {}));
    w.defineInput('bree.join', (exchange: number, id: Id) => this.applyJoin(exchange, id));
    w.defineInput('bree.end', (which: number | Id) => this.applyEnd(which));
    w.defineInput('bree.witness', (exchange: number, seenBy: Id[]) => this.applyWitnessed(exchange, seenBy));
    w.defineInput('bree.grudge', (a: Id, b: Id, by: number, why: string | null) => this.applyGrudge(a, b, by, why ?? 'the game'));
    w.defineInput('bree.feud', (a: Id, b: Id, s: number | null, why: string | null) => this.applyFeud(a, b, s, why ?? 'the game'));
    w.defineInput('bree.reconcile', (a: Id, b: Id, why: string | null) => this.applyReconcile(a, b, why ?? 'the game'));
    L.effect('grudge', (c, a, op, v) => {
      const o = other(c, a);
      if (!c.person || !o) return;
      const n = Number(v) || 0;
      const by = op === '-=' ? -n : op === '=' ? n - this.grudge(c.person.id, o) : n;
      this.applyGrudge(c.person.id, o, by, c.action ?? 'an effect');
    });
    L.effect('reconcile', (c, a) => { const o = other(c, a); if (c.person && o) this.applyReconcile(c.person.id, o, c.action ?? 'an effect'); });
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

  /** Is an outcome bad enough to escalate, send someone off, or be seen (config.escalateAt or worse)? */
  private bad(o: Outcome): boolean { return OUTCOMES.indexOf(o) >= OUTCOMES.indexOf(this.c.escalateAt as Outcome); }

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

  /** How much of a grudge someone holds: their knob, more for a quick temper, less for a forgiving nature. */
  private grudging(p: PersonState): number {
    const c = this.c;
    return this.knob('grudges', p.id) * Math.max(0, 1 + (this.nature(p, 'temper') - 0.5) * 2 * c.grudgeTemper) * Math.max(0, 1 - (this.nature(p, 'forgiveness') - 0.5) * 2 * c.grudgeForgive);
  }

  /**
   * Something mends: the holder's grudge against the other eases by this
   * much (and a feud between them: a person's in full, their groups' by
   * feudMends). A grudge eased to nothing is made up.
   */
  private mend(holder: Id, other: Id, amount: number, why: string): void {
    if (!(amount > 0)) return;
    const st = this.st;
    if (!st) return;
    const c = this.c;
    const had = this.grudge(holder, other);
    if (had > 0) {
      this.applyGrudge(holder, other, -amount, why);
      if (this.grudge(holder, other) <= 0) this.reconciled(holder, other, why);
    }
    for (const k of Object.keys(st.feuds)) {
      const f = st.feuds[k];
      const persons = (f.a === holder && f.b === other) || (f.a === other && f.b === holder);
      const groups = !persons && ((this.inParty(holder, f.a) && this.inParty(other, f.b)) || (this.inParty(holder, f.b) && this.inParty(other, f.a)));
      if (!persons && !groups) continue;
      const s = this.feudStrength(f) - amount * (persons ? 1 : c.feudMends);
      this.applyFeud(f.a, f.b, s > 0 ? s : null, why);
    }
  }

  /** A grudge made up: it ends, and a sentiment remembers it, with a feeling and a memory. */
  private reconciled(holder: Id, other: Id, why: string): void {
    const w = this.w, c = this.c, st = this.mut();
    const g = st.g[holder];
    if (g?.[other]) { delete g[other]; if (!Object.keys(g).length) delete st.g[holder]; st.v++; }
    w.fellowship?.applySentiment(holder, other, c.reconcileLabel, c.reconcileSentiment);
    const rv = w.reverie;
    if (rv && c.reconcileFeeling) rv.applyFeel(holder, c.reconcileFeeling, other);
    if (rv && c.reconcileMemory >= 1) rv.applyRemember(holder, { k: 'made_up', about: other, imp: c.reconcileMemory, text: `made it up with ${w.s.people[other]?.name ?? other}` });
    const pair = st.pairs[pairKey(holder, other)];
    if (pair) pair.mended = w.s.now;
    w.log('mended', holder, { with: other, why });
    w.emit('bree:mended', { id: holder, with: other, why });
  }

  /** Two people make it up (from the game: recorded): grudges both ways and a feud between them end, and each keeps a sentiment for it. */
  reconcile(a: Id, b: Id, why?: string): void { this.w.input('bree.reconcile', [a, b, why ?? null]); }

  /** Makes it up inside the simulation. */
  applyReconcile(a: Id, b: Id, why: string): void {
    if (a === b || !this.w.s.people[a] || !this.w.s.people[b]) return;
    const st = this.mut();
    this.reconciled(a, b, why);
    this.reconciled(b, a, why);
    if (st.feuds[pairKey(a, b)]) this.applyFeud(a, b, null, why);
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
  // Exchanges: starting one
  // -------------------------------------------------------------------------

  /** A stream of Bree's own: its draws leave people's own streams as they were. */
  private stream(): Stream { const st = this.mut(); return new Stream(this.w.s.seed, 'bree', st.n++); }

  /** Is someone free to talk: about, not walking, not doing something quiet (asleep)? */
  private free(p: PersonState | undefined): p is PersonState {
    if (!p || p.status !== 'active' || !p.place || p.doing?.kind === 'travel') return false;
    // someone down (Morgul) talks to nobody
    if (this.w.morgul?.isDown(p.id)) return false;
    const d = p.doing;
    if (d && d.kind === 'act') {
      const tags = this.w.actions.get(d.action)?.tags;
      if (tags && this.c.quiet.some((t) => tags.includes(t))) return false;
    }
    return true;
  }

  /** The exchange someone is in, or undefined. */
  private exOf(id: Id): Exchange | undefined {
    const st = this.st;
    const n = st?.of[id];
    return n === undefined ? undefined : st?.ex[n];
  }

  /**
   * Starts an exchange of a kind (from the game: recorded, and it applies at
   * once): `a` starts it with `b` (or several, a group). Anyone already in
   * one leaves it. Returns it as it stands after the first turn, or null.
   * `minutes`: the time they have (no turn after it); `turns`: how many.
   */
  start(kind: Id, a: Id, b: Id | Id[], opts: { minutes?: number; turns?: number } = {}): ExchangeView | null {
    return (this.w.input('bree.start', [kind, a, Array.isArray(b) ? b : [b], opts]) as ExchangeView | null | undefined) ?? null;
  }

  /** Ends an exchange now (by its id, or someone in it): someone walked away on screen (recorded). */
  end(which: number | Id): void { this.w.input('bree.end', [which]); }

  /** Starts an exchange inside the simulation (see start). */
  applyStart(kind: Id, a: Id, others: Id[], opts: { minutes?: number; turns?: number } = {}): ExchangeView | null {
    const w = this.w;
    const who = [a, ...others.filter((o, i) => o !== a && others.indexOf(o) === i)];
    if (who.length < 2 || !this.kinds.has(kind) || who.some((id) => w.s.people[id]?.status !== 'active')) return null;
    for (const id of who) { const ex = this.exOf(id); if (ex) this.leaveEx(ex, id, 'interrupted'); }
    const ex = this.begin(kind, who, 'game', opts.minutes, opts.turns);
    return ex ? this.view(ex) : null;
  }

  /**
   * Strikes up an exchange as if they'd met (from the game: recorded, and it
   * applies at once): `a`, the one who starts it, draws a kind among those
   * that fit `b`, by weight, as on meeting. For a game that works out who
   * meets whom itself (it walks someone up to another, and they talk).
   * Returns it as it stands after the first turn, or null if nothing fits.
   */
  strike(a: Id, b: Id, opts: { minutes?: number; turns?: number } = {}): ExchangeView | null {
    return (this.w.input('bree.strike', [a, b, opts]) as ExchangeView | null | undefined) ?? null;
  }

  /** Strikes one up inside the simulation (see strike). */
  applyStrike(a: Id, b: Id, opts: { minutes?: number; turns?: number } = {}): ExchangeView | null {
    const w = this.w;
    const s = w.s.people[a], o = w.s.people[b];
    if (a === b || s?.status !== 'active' || o?.status !== 'active') return null;
    for (const id of [a, b]) { const ex = this.exOf(id); if (ex) this.leaveEx(ex, id, 'interrupted'); }
    const pick = this.stream().weighted(this.choices(s, o), (x) => x.weight);
    const ex = pick ? this.begin(pick.def.id, [a, b], 'meet', opts.minutes, opts.turns) : null;
    return ex ? this.view(ex) : null;
  }

  /** Someone joins a group exchange in progress (from the game: recorded): they've sat down at the table. False if they can't (it isn't a group's, it's full, they're busy). */
  join(exchange: number, id: Id): boolean { return !!this.w.input('bree.join', [exchange, id]); }

  /** Joins one inside the simulation. */
  applyJoin(exchange: number, id: Id): boolean {
    const ex = this.st?.ex[exchange];
    const def = ex ? this.kinds.get(ex.kind) : undefined;
    if (!ex || !def?.group || ex.who.includes(id) || ex.who.length >= this.c.groupMax || this.exOf(id) || !this.free(this.w.s.people[id])) return false;
    this.add(ex, id);
    return true;
  }

  /** Ends an exchange inside the simulation. */
  applyEnd(which: number | Id): void {
    const ex = typeof which === 'number' ? this.st?.ex[which] : this.exOf(which);
    // (someone walking away from a group that stays leaves it, and it goes on)
    if (ex && typeof which === 'string' && this.stays(ex)) this.drop(ex, which);
    else if (ex) this.finish(ex, 'ended', typeof which === 'string' ? which : undefined);
  }

  /** Begins an exchange: the turns it'll run to, the first turn now, the next on the clock. */
  private begin(kind: Id, who: Id[], why: Exchange['why'], minutes?: number, turns?: number): Exchange | null {
    const w = this.w;
    const def = this.kinds.get(kind);
    const p = w.s.people[who[0]];
    if (!def || !p || who.some((id) => w.s.people[id]?.status !== 'active')) return null;
    const st = this.mut();
    const r = this.stream();
    const ex: Exchange = {
      id: ++st.ids, kind, first: kind, who: who.slice(), place: p.place ?? p.doing?.to ?? null, t: w.s.now, why,
      n: 0, turns: 1, score: null, heard: {}, sour: 0, manners: {}, topics: [], said: [], next: w.s.now,
    };
    if (minutes !== undefined && isFinite(minutes)) ex.until = round(w.s.now + Math.max(0, minutes), 4);
    if (def.tags?.includes('hostile')) ex.by = who[0];
    // round a table, others there may join in
    if (def.group && def.topics?.length && why !== 'game') for (const id of this.joiners(ex, r)) ex.who.push(id);
    for (const id of ex.who) { const m = this.mannerOf(id); if (m) ex.manners[id] = m; }
    ex.turns = turns !== undefined ? Math.max(1, Math.round(turns)) : this.plan(def, ex.who, r, minutes);
    // a fight by numbers (Morgul) goes on until someone yields or goes down, wherever they were going
    const brawl = !!w.morgul?.fights(kind);
    if (brawl) { if (turns === undefined) ex.turns = (w.morgul as NonNullable<World['morgul']>).blows; delete ex.until; }
    st.ex[ex.id] = ex;
    for (const id of ex.who) st.of[id] = ex.id;
    w.log('exchange', who[0], { id: ex.id, kind, with: ex.who.slice(1), why });
    w.emit('bree:start', this.view(ex));
    if (brawl) w.morgul?.brawl(ex.who, kind);
    // a fight from the first blow: seen as it starts
    if (def.crime) this.breaksOut(ex, def);
    this.turn(ex);
    return ex;
  }

  /** The turns an exchange runs to: its own, or by how they stand, how talkative and how low they are; times talk; within the time they have. */
  private plan(def: KindDef, who: Id[], r: Stream, minutes?: number): number {
    const w = this.w, c = this.c;
    const [a, b] = who;
    const pa = w.s.people[a], pb = w.s.people[b];
    let n: number;
    if (typeof def.turns === 'function') n = pa ? Number(def.turns(w.ctx(pa, { target: b ?? null }))) || 0 : c.minTurns;
    else if (typeof def.turns === 'number') n = def.turns;
    else if (Array.isArray(def.turns)) n = def.turns[0] + r.int(Math.max(0, def.turns[1] - def.turns[0]) + 1);
    else if (def.topics?.length) {
      n = c.turns[this.bond(a, b)] ?? c.turns.stranger ?? c.minTurns;
      const talk = (pa ? this.nature(pa, 'talkative') : 0.5) + (pb ? this.nature(pb, 'talkative') : 0.5) - 1;
      n += Math.round(talk * c.talkativeTurns);
      const rv = w.reverie;
      if (rv && (rv.mood(a) < c.lowMood || rv.mood(b) < c.lowMood)) n -= c.lowMoodTurns;
      const j = Math.max(0, Math.round(c.turnsJitter));
      if (j) n += r.int(2 * j + 1) - j;
      n = clamp(n, c.minTurns, c.maxTurns);
      if (def.group) n += Math.max(0, who.length - 2) * c.groupTurns;
    } else n = c.quickTurns;
    // the headline knob: chattier people talk for longer (the world's, times each one's own)
    const k = this.talkOf(who);
    if (k !== 1) n = Math.round(n * k);
    n = Math.max(1, Math.round(n));
    if (minutes !== undefined && isFinite(minutes)) {
      const tg = def.gap ?? c.turnGap;
      const gap = (tg[0] + (tg[1] ?? tg[0])) / 2;
      n = Math.min(n, Math.max(1, Math.floor(minutes / Math.max(0.5, gap)) + 1));
    }
    return n;
  }

  /** The kinds the starter might strike up with someone, each with its weight. */
  private choices(s: PersonState, o: PersonState): Array<{ def: KindDef; weight: number }> {
    const w = this.w, c = this.c;
    const ctx = w.ctx(s, { target: o.id, place: s.place });
    const out: Array<{ def: KindDef; weight: number }> = [];
    w.peek(() => {
      for (const def of this.kinds.values()) {
        if (def.weight === 0) continue;
        if (!w.lang.all(def.who, ctx) || !w.lang.all(def.to, ctx) || !w.lang.all(def.if, ctx)) continue;
        if (def.gives && !(w.have(s, def.gives) > 0)) continue;
        if (def.teaches && !this.lesson(s, o)) continue;
        let weight = 1;
        if (typeof def.weight === 'number') weight = def.weight;
        else if (typeof def.weight === 'function') weight = Number(def.weight(ctx)) || 0;
        else if (def.weight) for (const k of def.weight) weight *= w.mind.consider(k, ctx);
        // a pressing need it meets makes it more appealing (the lonely strike up a chat)
        if (def.relieves) {
          let pull = 0;
          for (const need in def.relieves) if (w.needs.has(need)) pull += def.relieves[need] * w.mind.urgency(s, need);
          weight *= 1 + pull * c.needPull;
        }
        // the headline knob: how readily people pick a quarrel
        if (def.tags?.includes('hostile')) weight *= this.knob('quarrels', s.id);
        if (weight > 0) out.push({ def, weight: round(weight, 6) });
      }
    });
    return out;
  }

  /** The skill a teacher could teach someone: their best, well enough over the other's. */
  private lesson(t: PersonState, o: PersonState): Id | null {
    const w = this.w;
    let best: Id | null = null, gap = this.c.teachOver;
    for (const skill of Object.keys(w.skills.of(t))) {
      const g = w.skills.level(t, skill) - w.skills.level(o, skill);
      if (g >= gap) { gap = g; best = skill; }
    }
    return best;
  }

  /** Who at the same place joins a group exchange as it starts: free, fond enough of one of them, by chance and their talk. */
  private joiners(ex: Exchange, r: Stream): Id[] {
    const w = this.w, c = this.c;
    if (!ex.place || c.groupMax <= ex.who.length) return [];
    const out: Id[] = [];
    for (const id of r.shuffle(w.ring.present(ex.place).filter((x) => !ex.who.includes(x)).sort())) {
      if (ex.who.length + out.length >= c.groupMax) break;
      if (!this.joins(ex, id, r)) continue;
      out.push(id);
    }
    return out;
  }

  /** Would someone join an exchange now? */
  private joins(ex: Exchange, id: Id, r: Stream): boolean {
    const w = this.w, c = this.c, fs = w.fellowship;
    const p = w.s.people[id];
    if (!this.free(p) || this.exOf(id)) return false;
    if (fs && !ex.who.some((m) => fs.regard(id, m) >= c.joinRegard)) return false;
    return r.chance(clamp(c.joinChance * this.talkOf([id])));
  }

  /** Someone joins a group exchange in progress. */
  private add(ex: Exchange, id: Id): void {
    const st = this.mut();
    ex.who.push(id);
    st.of[id] = ex.id;
    const m = this.mannerOf(id);
    if (m) ex.manners[id] = m;
    ex.turns += this.c.groupTurns;
    this.w.log('joined', id, { id: ex.id });
    this.w.emit('bree:joined', { id: ex.id, who: id });
  }

  /** Does this exchange go on without someone who leaves it (a group whose kind stays, with more than two in it)? */
  private stays(ex: Exchange): boolean { return ex.who.length > 2 && !!this.kinds.get(ex.kind)?.stays && !!this.kinds.get(ex.kind)?.group; }

  /** Someone leaves a group that goes on without them: out of the turns to come; what's said stays said. */
  private drop(ex: Exchange, id: Id): void {
    const st = this.mut();
    if (st.of[id] === ex.id) delete st.of[id];
    ex.who = ex.who.filter((x) => x !== id);
    delete ex.manners[id];
    const tp = ex.topic;
    if (tp && tp.by === id) delete ex.topic; // (whoever raised it has gone: on to the next)
    else if (tp) {
      const others = ex.who.filter((x) => x !== tp.by);
      const steps: Array<[string, Id, Id]> = [];
      let i = tp.i;
      tp.steps.forEach((s, k) => {
        if (s[1] === id) { if (k < tp.i) i--; return; }
        steps.push([s[0], s[1], s[2] !== id ? s[2] : s[0] === 'open' || s[0] === 'more' ? others[0] : tp.by]);
      });
      tp.steps = steps;
      tp.i = Math.max(0, i);
    }
    for (const k of ['opener', 'lead', 'lastWho', 'sourBy'] as const) if (ex[k] === id) delete ex[k];
    this.w.log('parted', id, { id: ex.id });
    this.w.emit('bree:parted', { id: ex.id, who: id });
  }

  /** Someone leaves the exchange they're in (for another, or gone): a group that stays goes on; anything else ends. */
  private leaveEx(ex: Exchange, id: Id, why: string): void {
    if (this.stays(ex)) this.drop(ex, id); else this.finish(ex, why, why === 'gone' ? id : undefined);
  }

  /** The manner that fits someone best now (or null, with none declared): its base, rules, their nature, and a little of their own. */
  mannerOf(id: Id): Id | null {
    const w = this.w, c = this.c;
    const p = w.s.people[id];
    if (!p || !this.manners.size) return null;
    const ex = this.exOf(id);
    if (ex?.manners[id]) return ex.manners[id];
    const ctx = w.ctx(p);
    let best: Id | null = null, top = -Infinity;
    w.peek(() => {
      for (const m of this.manners.values()) {
        if (m.if && !w.lang.all(m.if, ctx)) continue;
        let v = landing(w.lang, m.base ?? 0, m.fits, ctx);
        for (const role in m.traits || {}) v += (m.traits as Record<string, number>)[role] * (this.nature(p, role) - 0.5) * 2;
        v += hash01(w.s.seed, 'manner', id, m.id) * c.mannerJitter;
        if (v > top) { top = v; best = m.id; }
      }
    });
    return best;
  }

  /** Is a kind a conversation, topic by topic? (One with topics, in a world that declares some; without any, it goes turn about.) */
  private talks(def: KindDef): boolean { return !!def.topics?.length && this.topics.size > 0; }

  /** Does a topic fit a kind? */
  private fits(t: TopicDef, def: KindDef): boolean {
    const list = def.topics;
    if (!list?.length) return false;
    if (list.includes(t.id)) return true;
    if (t.tags && list.some((x) => x.startsWith('tag:') && t.tags?.includes(x.slice(4)))) return true;
    if (!list.includes('*')) return false;
    return !t.kinds || t.kinds.some((k) => k === def.id || (k.startsWith('tag:') && !!def.tags?.includes(k.slice(4))));
  }

  /** How much someone (they love doing it) likes an action: instinct times habit. */
  private taste(p: PersonState, action: Id): number { return (p.def.instincts?.[action] ?? 1) * this.w.mind.habit(p, action); }

  /** What a topic would be about, raised by the speaker to the listener now: undefined if it can't be raised, null if it needs nothing. A look. */
  subject(topic: Id, speaker: Id, listener: Id): Value | undefined {
    const t = this.topics.get(topic), s = this.w.s.people[speaker], l = this.w.s.people[listener];
    return t && s && l ? this.w.peek(() => this.subjectOf(t, s, l)) : undefined;
  }

  private subjectOf(t: TopicDef, s: PersonState, l: PersonState): Value | undefined {
    const w = this.w, c = this.c, rv = w.reverie;
    switch (t.from) {
      case undefined: return null;
      case 'beliefs': {
        if (!rv) return undefined;
        const wt = w.wormtongue;
        if (wt) {
          // a teller whose gossip knob is 0 tells nobody anything
          if (!(Number(w.tuning('wormtongue', s.id).gossip) > 0)) return undefined;
          return wt.news(s.id, l.id)?.key;
        }
        const best = rv.beliefs(s.id).find((b) => !b.silenced && !b.key.startsWith('@') && !b.key.startsWith(`did:${l.id}:`) && rv.belief(l.id, b.key) !== b.v);
        return best?.key;
      }
      case 'memories': {
        if (!rv) return undefined;
        const theirs = rv.memories(l.id);
        const m = rv.memories(s.id).find((x) => x.about === l.id || theirs.some((y) => y.k === x.k && Math.abs(y.t - x.t) <= c.shareWindow));
        return m?.k;
      }
      case 'events': {
        if (!rv) return undefined;
        return rv.memories(s.id).find((m) => w.s.now - m.t <= c.recentMinutes && m.about !== l.id)?.k;
      }
      case 'likes': {
        let best: Id | undefined, top = c.likeAbove;
        for (const a of [...new Set([...Object.keys(s.def.instincts || {}), ...Object.keys(s.habits)])].sort()) {
          const v = this.taste(s, a);
          if (v > top) { top = v; best = a; }
        }
        return best;
      }
      case 'doing': return s.doing?.kind === 'act' ? s.doing.action : undefined;
      case 'place': return s.place ? w.ring.root(s.place) : undefined;
      case 'grudge': return this.st?.g[s.id]?.[l.id]?.[2] ?? undefined;
    }
    return undefined;
  }

  /** How much a topic is to someone's taste: its rules, and what they share of it. */
  private fitOf(t: TopicDef, p: PersonState, other: PersonState, subject: Value | undefined): number {
    const w = this.w, c = this.c;
    let v = t.fit ? landing(w.lang, 0, t.fit, w.ctx(p, { target: other.id, topic: t.id, data: { subject: subject ?? null } })) : 0;
    if (typeof subject === 'string') {
      if (t.from === 'likes') v += this.taste(p, subject) - 1;
      if (t.from === 'doing' && p.doing?.kind === 'act' && p.doing.action === subject) v += c.shareFit;
      if (t.from === 'memories' && w.reverie?.memories(p.id).some((m) => m.k === subject)) v += c.shareFit;
    }
    return round(v, 4);
  }

  /** The topic someone opens next: one that fits the kind, not talked of yet, with something to it, drawn by weight, taste and how fresh it is between them. */
  private pickTopic(ex: Exchange, def: KindDef, s: PersonState, l: PersonState, r: Stream): { t: TopicDef; subject: Value | undefined } | null {
    const w = this.w, c = this.c, now = w.s.now;
    const pair = this.st?.pairs[pairKey(s.id, l.id)];
    const out: Array<{ t: TopicDef; subject: Value | undefined; weight: number }> = [];
    w.peek(() => {
      for (const t of this.topics.values()) {
        if (ex.topics.includes(t.id) || !this.fits(t, def)) continue;
        const subject = this.subjectOf(t, s, l);
        if (subject === undefined) continue;
        const ctx = w.ctx(s, { target: l.id, place: ex.place, topic: t.id, data: { subject } });
        if (t.if && !w.lang.all(t.if, ctx)) continue;
        let weight = 1;
        if (typeof t.weight === 'number') weight = t.weight;
        else if (typeof t.weight === 'function') weight = Number(t.weight(ctx)) || 0;
        else if (t.weight) for (const k of t.weight) weight *= w.mind.consider(k, ctx);
        const seen = pair?.topics?.[t.id];
        if (seen !== undefined) weight *= 1 - Math.exp(-(now - seen) / Math.max(1, c.topicCooldown));
        weight *= Math.max(0, 1 + this.fitOf(t, s, l, subject) * c.topicPull);
        if (weight > 0) out.push({ t, subject, weight: round(weight, 6) });
      }
    });
    const pick = r.weighted(out, (x) => x.weight);
    return pick && pick.weight > 0 ? { t: pick.t, subject: pick.subject } : null;
  }

  /** A topic's steps, round the group: the opener opens it, each of the others answers, the opener follows it up, and one has the last word. */
  private stepsOf(t: TopicDef, ex: Exchange, opener: Id, r: Stream): Array<[string, Id, Id]> {
    const others = ex.who.filter((id) => id !== opener);
    const first = others[0];
    const out: Array<[string, Id, Id]> = [['open', opener, first]];
    for (const o of others) out.push(['reply', o, opener]);
    const n = clamp(Math.round(t.steps ?? 4), 2, 4);
    if (n >= 3) out.push(['more', opener, first]);
    if (n >= 4) out.push(['back', (others.length > 1 ? r.pick(others) : first) as Id, opener]);
    return out;
  }

  /** A topic talked through: when it came up between them, and its effects for each. */
  private topicDone(ex: Exchange): void {
    const w = this.w, c = this.c, st = this.mut();
    const tp = ex.topic;
    if (!tp) return;
    delete ex.topic;
    const def = this.topics.get(tp.id);
    const others = ex.who.filter((id) => id !== tp.by);
    if (others[0]) {
      const pair = (st.pairs[pairKey(tp.by, others[0])] ||= { n: 0, last: w.s.now });
      const topics = (pair.topics ||= {});
      delete topics[tp.id];
      topics[tp.id] = w.s.now;
      const keys = Object.keys(topics);
      for (let i = 0; i < keys.length - c.topicMemory; i++) delete topics[keys[i]];
    }
    if (def?.then) for (const id of ex.who) {
      const p = w.s.people[id];
      if (p) w.lang.applyAll(def.then, w.ctx(p, { target: id === tp.by ? others[0] ?? null : tp.by, topic: tp.id, data: { subject: tp.subject ?? null } }));
    }
  }

  // -------------------------------------------------------------------------
  // Exchanges: how a turn lands
  // -------------------------------------------------------------------------

  /**
   * How words of a kind from the speaker land with the listener now: the
   * score from the listener's side with its parts, and where it falls,
   * before the luck of the turn. A look: it changes nothing.
   */
  weigh(kind: Id, speaker: Id, listener: Id, opts: { topic?: Id; subject?: Value; manner?: Id; place?: Id; step?: string } = {}): { score: number; outcome: Outcome; parts: Array<[string, number]> } | null {
    const def = this.kinds.get(kind);
    const s = this.w.s.people[speaker], l = this.w.s.people[listener];
    if (!def || !s || !l) return null;
    const parts = this.w.peek(() => this.parts(def, s, l, opts.place ?? s.place, opts.topic, opts.subject, opts.manner ?? this.mannerOf(speaker) ?? undefined, opts.step));
    const score = round(parts.reduce((a, [, v]) => a + v, 0), 4);
    return { score, outcome: this.outcome(score), parts };
  }

  /**
   * The parts of how words land with the listener (the speaker is the
   * target), each a setting's weight. The rules (the kind's lands and knack,
   * the manner's lands) can read what's being said in ctx.data: the kind,
   * the step, the topic and its subject.
   */
  private parts(def: KindDef, s: PersonState, l: PersonState, place: Id | null | undefined, topic?: Id, subject?: Value, manner?: Id, step?: string): Array<[string, number]> {
    const w = this.w, c = this.c, L = w.lang;
    const out: Array<[string, number]> = [];
    const add = (name: string, v: number) => { if (v && isFinite(v)) out.push([name, round(v, 4)]); };
    const data = { kind: def.id, step: step ?? null, topic: topic ?? null, subject: subject ?? null };
    const lctx = w.ctx(l, { target: s.id, place: place ?? null, data });
    const sctx = w.ctx(s, { target: l.id, place: place ?? null, data });
    add('base', def.base ?? 0);
    if (def.lands) add('lands', landing(L, 0, def.lands, lctx));
    const ap = def.approach ? w.voice?.approaches.get(def.approach) : undefined;
    if (ap) add('approach', landing(L, ap.base ?? 0, ap.lands, lctx));
    if (def.knack) add('knack', landing(L, 0, def.knack, sctx));
    let nat = 0, skill = 0;
    for (const role in def.traits || {}) nat += (def.traits as Record<string, number>)[role] * (this.nature(l, role) - 0.5) * 2;
    for (const role in def.skill || {}) skill += (def.skill as Record<string, number>)[role] * (this.nature(s, role) - 0.5) * 2;
    add('nature', nat);
    add('skill', skill);
    const fs = w.fellowship, rv = w.reverie;
    if (fs) {
      add('regard', c.regardWeight * fs.regard(l.id, s.id));
      add('compat', c.compatWeight * fs.compat(l.id, s.id));
      if (def.tags?.includes('romantic')) add('attraction', c.attractWeight * fs.attraction(l.id, s.id));
    }
    if (rv) {
      add('mood', c.moodWeight * (rv.mood(l.id) - 0.5) * 2);
      add('stress', -c.stressWeight * rv.stress(l.id));
    }
    if (def.relieves) {
      let need = 0;
      for (const n in def.relieves) if (w.needs.has(n)) need += def.relieves[n] * w.mind.urgency(l, n);
      add('need', c.needWeight * need);
    }
    add('grudge', -c.grudgeWeight * this.animosity(l.id, s.id));
    const row = this.st?.pairs[pairKey(l.id, s.id)]?.row;
    if (row !== undefined) add('row', -c.rowWeight * Math.exp(-(w.s.now - row) / Math.max(1, c.rowMinutes)));
    const cs = w.cityspeak;
    if (cs && place && c.roomWeight) add('room', c.roomWeight * (cs.room(place) - 0.5) * 2);
    const t = topic ? this.topics.get(topic) : undefined;
    if (t) add('topic', c.topicWeight * this.fitOf(t, l, s, subject));
    const m = manner ? this.manners.get(manner) : undefined;
    if (m?.lands) add('manner', c.mannerWeight * landing(L, 0, m.lands, lctx));
    return out;
  }

  /** The luck of a turn: two draws, so mostly near nothing. */
  private luck(r: Stream): number { return (r.next() + r.next() - 1) * this.c.spread; }

  // -------------------------------------------------------------------------
  // Exchanges: turns
  // -------------------------------------------------------------------------

  /** Who has left the others (asleep, away, or no longer where it began, or as the game's own `together` says), or null. */
  private whoLeft(ex: Exchange): Id | null {
    const w = this.w;
    const own = this.together;
    const root = !own && ex.place ? w.ring.root(ex.place) : null;
    for (const id of ex.who) {
      const p = w.s.people[id];
      if (!this.free(p)) return id;
      if (root && w.ring.root(p.place as Id) !== root) return id;
    }
    return own ? w.peek(() => own(this.view(ex), w)) ?? null : null;
  }

  /**
   * Who speaks to whom next, and the step. A conversation (a kind with
   * topics) goes topic by topic: the next opener raises one, the others
   * answer, and when the turns they have are done (or there's nothing left
   * to say), whoever's turn it is takes their leave. Anything else goes turn
   * about, the one who leads first.
   */
  private nextStep(ex: Exchange, def: KindDef, r: Stream): { who: Id; to: Id; step: string; topic?: TopicDef } {
    const w = this.w;
    if (this.talks(def)) {
      const tp = ex.topic;
      const rot = (after: Id | undefined): Id => (after === undefined ? ex.lead ?? ex.who[0] : ex.who[(ex.who.indexOf(after) + 1) % ex.who.length] ?? ex.who[0]);
      if (tp && tp.i < tp.steps.length) {
        // out of time, but not before the first answer (unless they've time for only a word)
        if (ex.n >= ex.turns && (tp.i !== 1 || ex.turns <= 1)) { const who = rot(tp.by); return { who, to: who === tp.by ? rot(who) : tp.by, step: 'bye' }; }
        const [step, who, to] = tp.steps[tp.i];
        return { who, to, step, topic: this.topics.get(tp.id) };
      }
      if (tp) this.topicDone(ex);
      const opener = rot(ex.opener);
      const to = opener === ex.who[0] ? ex.who[1] : ex.who[0];
      if (ex.n >= ex.turns) return { who: opener, to: ex.opener ?? to, step: 'bye' };
      const s = w.s.people[opener], l = w.s.people[to];
      const pick = s && l ? this.pickTopic(ex, def, s, l, r) : null;
      if (!pick) return { who: opener, to, step: 'bye' };
      ex.topic = { id: pick.t.id, by: opener, steps: this.stepsOf(pick.t, ex, opener, r), i: 0 };
      if (pick.subject !== null && pick.subject !== undefined) ex.topic.subject = pick.subject;
      ex.opener = opener;
      ex.topics.push(pick.t.id);
      const [step, who, too] = ex.topic.steps[0];
      return { who, to: too, step, topic: pick.t };
    }
    const steps = ['open', 'reply', 'more', 'back'];
    const lead = ex.lead ?? ex.who[0];
    const other = (id: Id): Id => (id === ex.who[0] ? ex.who[1] : ex.who[0]);
    const who = ex.lastWho === undefined ? lead : other(ex.lastWho);
    return { who, to: other(who), step: steps[(ex.i ?? 0) % steps.length] };
  }

  /** One turn: who speaks, how it lands, what it changes, and when the next comes. */
  private turn(ex: Exchange): void {
    const w = this.w, c = this.c;
    const def = this.kinds.get(ex.kind);
    if (!def) { this.finish(ex, 'ended'); return; }
    // (the game vouches for the first turn of one it starts: a greeting in passing)
    let gone = ex.n === 0 && ex.why === 'game' ? null : this.whoLeft(ex);
    // (a group that stays goes on without them, while two are left)
    while (gone !== null && this.stays(ex)) { this.drop(ex, gone); gone = this.whoLeft(ex); }
    if (gone !== null) { this.finish(ex, 'parted', gone); return; }
    if (ex.until !== undefined && w.s.now > ex.until + 1e-6) { this.finish(ex, 'parted'); return; }
    const r = this.stream();
    const { who, to, step, topic } = this.nextStep(ex, def, r);
    if (step === 'bye') { ex.n++; this.tell(ex, { who, to, step, landed: null, end: true }); this.finish(ex, 'done'); return; }
    const s = w.s.people[who], l = w.s.people[to];
    const subject = topic ? ex.topic?.subject : undefined;
    const parts = this.parts(def, s, l, ex.place, topic?.id, subject, ex.manners[who], step);
    const score = round(parts.reduce((acc, [, v]) => acc + v, 0) + this.luck(r), 4);
    const landed = this.outcome(score);
    ex.heard[to] = ex.heard[to] === undefined ? score : round(ex.heard[to] + (score - ex.heard[to]) * c.sway, 4);
    ex.score = ex.score === null ? score : round(ex.score + (score - ex.score) * c.sway, 4);
    ex.last = landed;
    ex.lastWho = who;
    if (topic && ex.topic) ex.topic.i++; else ex.i = (ex.i ?? 0) + 1;
    ex.n++;
    // opening a topic: news is passed on if it's heard out, old times are brought to mind
    if (topic && step === 'open' && typeof subject === 'string') this.opened(ex, topic, s, subject, landed, r);
    // a fight by numbers (Morgul): a blow lands one way or the other, and it's over if one yields or goes down
    const mg = w.morgul;
    const blow = mg && mg.fights(ex.kind) ? mg.applyBlow(ex.id, ex.by ?? ex.who[0], s, l, ex.place, this.seers(ex)) : null;
    // words that land badly: the one hurt may answer back harder, or walk off
    let act: Reaction = { act: 'none' };
    let leaver = to;
    if (this.bad(landed)) { ex.sour++; ex.sourBy = who; }
    if (blow) {
      // a fight by numbers: someone there may step in; the one struck walks off (or yields, or goes down), as Morgul says
      if (blow.end === 'left') { act = { act: 'leave' }; leaver = blow.to; }
      else if (!blow.end) { const by = this.stepper(ex, s, l, r); if (by) act = { act: 'step_in', by }; }
    } else if (this.bad(landed)) act = this.react(ex, def, s, l, r);
    const ends = act.act === 'leave' || act.act === 'step_in';
    // (a conversation takes its leave on a turn of its own)
    const kd = this.kinds.get(ex.kind);
    const over = ends || blow?.end === 'down' || blow?.end === 'yielded' || (act.act !== 'escalate' && !(kd && this.talks(kd)) && ex.n >= ex.turns);
    this.tell(ex, { who, to, step, landed, end: over && !ends, ...(blow ? { harm: blow } : {}) });
    if (act.act === 'calm') { ex.n++; ex.lastWho = who; this.tell(ex, { who, to, step: 'calm', landed: null, end: over }); }
    else if (act.act === 'step_in' && act.by) { ex.n++; ex.mediator = act.by; this.tell(ex, { who: act.by, to, step: 'step_in', landed: null, end: true }); }
    else if (act.act === 'leave') { ex.n++; this.tell(ex, { who: leaver, to: leaver === to ? who : to, step: 'leave', landed: null, end: true }); }
    else if (act.act === 'escalate') this.escalate(ex, def, l, s, r);
    if (over) { this.finish(ex, act.act === 'leave' ? 'left' : act.act === 'step_in' ? 'stepped in' : blow?.end ?? 'done', act.act === 'leave' ? leaver : undefined); return; }
    this.schedule(ex, r);
  }

  /** A topic is opened: news told to everyone in it who'd hear it (through Wormtongue's telling, when it's on), or a memory brought to mind. */
  private opened(ex: Exchange, topic: TopicDef, s: PersonState, subject: string, landed: Outcome, r: Stream): void {
    const w = this.w, c = this.c, rv = w.reverie;
    if (!rv) return;
    if (topic.from === 'beliefs' && this.atLeast(landed, c.tellAt)) {
      const wt = w.wormtongue;
      for (const id of ex.who) {
        if (id === s.id || subject.startsWith(`did:${id}:`)) continue;
        if (wt) { const news = wt.news(s.id, id, subject); if (news) wt.applyTell(s.id, id, news, r); continue; }
        const b = rv.beliefRecord(s.id, subject);
        if (b && rv.belief(id, subject) !== b.v) rv.applyBelieve(id, subject, b.v, 'told', s.id, round(b.str * c.trust, 4), b.hops + 1);
      }
    }
    if (topic.from === 'memories') for (const id of ex.who) if (id === s.id || rv.memories(id).some((m) => m.k === subject)) rv.applyRecall(id, { k: subject }, 1);
    if (topic.from === 'events') rv.applyRecall(s.id, { k: subject }, 1);
  }

  /**
   * Words landed badly with the one who heard them (l): do they answer back
   * harder (and does the other keep their patience, or someone step in), or
   * walk off, or let it go?
   */
  private react(ex: Exchange, def: KindDef, s: PersonState, l: PersonState, r: Stream): Reaction {
    const w = this.w, c = this.c, fs = w.fellowship, rv = w.reverie;
    const regard = (x: Id, y: Id): number => (fs ? fs.regard(x, y) : 0);
    if (def.escalates && this.kinds.has(def.escalates)) {
      // the headline knob, for the one who'd escalate
      const p = clamp(c.escalateBase + c.escalateTemper * (this.nature(l, 'temper') - 0.5) * 2 + c.escalateStress * (rv ? rv.stress(l.id) : 0)
        + c.escalateGrudge * this.animosity(l.id, s.id) - c.escalateRegard * Math.max(0, regard(l.id, s.id))) * this.knob('escalation', l.id);
      if (r.chance(p)) {
        // the other keeps their patience
        if (r.chance(clamp(c.calmBase + c.calmPatience * this.nature(s, 'patience') + c.calmRegard * Math.max(0, regard(s.id, l.id))))) return { act: 'calm' };
        // someone there steps in
        const by = this.stepper(ex, s, l, r);
        if (by) return { act: 'step_in', by };
        return { act: 'escalate' };
      }
    }
    // in a pair, the one hurt may walk off
    if (ex.who.length === 2) {
      const p = clamp(c.leaveBase + c.leaveTemper * this.nature(l, 'temper') - c.leaveRegard * regard(l.id, s.id) + c.leaveSour * Math.max(0, ex.sour - 1));
      if (r.chance(p)) return { act: 'leave' };
    }
    return { act: 'none' };
  }

  /** Does someone there step in? Whoever likes one of them best, with the nerve for it, by chance. */
  private stepper(ex: Exchange, s: PersonState, l: PersonState, r: Stream): Id | null {
    const w = this.w, c = this.c, fs = w.fellowship;
    const regard = (x: Id, y: Id): number => (fs ? fs.regard(x, y) : 0);
    let best: { id: Id; v: number } | null = null;
    for (const id of this.seers(ex)) {
      const m = w.s.people[id];
      const like = Math.max(regard(id, s.id), regard(id, l.id));
      if (!m || like < c.stepInFrom) continue;
      const v = like + (this.nature(m, 'courage') - 0.5) * 2 * c.stepInCourage;
      if (!best || v > best.v) best = { id, v };
    }
    if (!best) return null;
    const m = w.s.people[best.id] as PersonState;
    const like = Math.max(regard(best.id, s.id), regard(best.id, l.id));
    return r.chance(clamp(c.stepInBase + c.stepInRegard * like + c.stepInCourage * (this.nature(m, 'courage') - 0.5) * 2)) ? best.id : null;
  }

  /** Talk turns into an argument, an argument into a fight: the one who escalated leads it now, and whoever's there sees it. */
  private escalate(ex: Exchange, def: KindDef, angry: PersonState, other: PersonState, r: Stream): void {
    const w = this.w, st = this.mut();
    const next = this.kinds.get(def.escalates as Id) as KindDef;
    const from = ex.kind;
    ex.kind = next.id;
    ex.by = angry.id;
    ex.esc = (ex.esc ?? 0) + 1;
    // a group narrows to the two of them; the rest look on
    for (const id of ex.who) if (id !== angry.id && id !== other.id && st.of[id] === ex.id) delete st.of[id];
    ex.who = [angry.id, other.id];
    ex.lead = angry.id;
    ex.i = 0;
    delete ex.lastWho;
    delete ex.topic;
    delete ex.opener;
    const left = ex.until !== undefined ? ex.until - w.s.now : undefined;
    const brawl = !!w.morgul?.fights(next.id);
    ex.turns = ex.n + (brawl ? (w.morgul as NonNullable<World['morgul']>).blows : this.plan(next, ex.who, r, left));
    if (brawl) delete ex.until;
    w.log('escalated', angry.id, { id: ex.id, from, to: next.id, against: other.id });
    w.emit('bree:escalated', { id: ex.id, from, to: next.id, by: angry.id, against: other.id });
    if (brawl) w.morgul?.brawl(ex.who, next.id);
    this.breaksOut(ex, next);
  }

  /** An exchange of a kind breaks out where people can see it: a crime for Wormtongue, if the game calls it one, and Bree's own witnesses. */
  private breaksOut(ex: Exchange, def: KindDef): void {
    if (def.seen === false) return;
    const seers = this.seers(ex);
    const wt = this.w.wormtongue;
    const crime = !!(def.crime && wt?.crimes.has(def.crime));
    const by = ex.by ?? ex.who[0];
    const other = ex.who.find((id) => id !== by) ?? ex.who[1];
    // Wormtongue's witnesses (the other one too), who may report it
    if (crime) wt?.sensed({ kind: def.crime as string, actor: by, what: other, place: ex.place, seenBy: [other, ...seers] });
    this.witness(ex, seers, crime);
    // a fight between two households can set them feuding
    const c = this.c, fs = this.w.fellowship;
    if (def.crime && c.feudSpread > 0 && fs) {
      const ha = fs.household(by), hb = fs.household(other);
      if (ha && hb && ha !== hb) {
        const f = this.mut().feuds[pairKey(ha, hb)];
        this.applyFeud(ha, hb, (f ? this.feudStrength(f) : 0) + c.feudSpread, def.id);
      }
    }
  }

  /** Who's about to see what happens in an exchange: the game's own say (bree.witnesses), or everyone at the place, awake, not in it. */
  private seers(ex: Exchange): Id[] {
    const w = this.w;
    if (this.witnesses) return w.peek(() => (this.witnesses as NonNullable<Bree['witnesses']>)(this.view(ex), w)).filter((id) => !ex.who.includes(id) && w.s.people[id]?.status === 'active');
    if (!ex.place) return [];
    return w.ring.present(w.ring.root(ex.place)).filter((id) => !ex.who.includes(id) && this.free(w.s.people[id]));
  }

  /**
   * People see an exchange go wrong: they believe what they saw (did:<who
   * started it>:<kind>, the other as its value: gossip, through Wormtongue),
   * remember it, feel it, and think less of whoever started it. Once a kind,
   * each. With `crime`, Wormtongue has seen to the belief, memory and feeling.
   */
  private witness(ex: { id: number; kind: Id; who: Id[]; place: Id | null; by?: Id; sourBy?: Id; seen?: Record<Id, Id>; score?: number | null; outcome?: Outcome }, seers: Id[], crime = false): void {
    const w = this.w, c = this.c, rv = w.reverie, fs = w.fellowship;
    const by = ex.by ?? ex.sourBy ?? ex.who[0];
    const against = ex.who.find((id) => id !== by) ?? ex.who[1];
    const def = this.kinds.get(ex.kind);
    const outcome = ex.outcome ?? this.outcome(ex.score ?? 0);
    const seen = (ex.seen ||= {});
    for (const id of seers) {
      if (seen[id] === ex.kind || id === by || id === against || !w.s.people[id]) continue;
      seen[id] = ex.kind;
      if (rv && !crime) {
        rv.applyBelieve(id, `did:${by}:${ex.kind}`, against ?? true, 'saw', null, c.witnessStrength);
        rv.applyRemember(id, { k: 'saw:' + ex.kind, about: by, place: ex.place ?? undefined, imp: c.witnessMemory, text: `saw ${w.s.people[by]?.name ?? by} and ${w.s.people[against]?.name ?? against}: ${def?.label ?? ex.kind}` });
        if (c.witnessFeeling) rv.applyFeel(id, c.witnessFeeling, by);
      }
      if (fs) {
        const d = c.witnessRegard * (c.regard[outcome] ?? 0) * (def?.regard ?? 1);
        if (d) fs.applyRegard(id, by, round(d * (d > 0 ? this.knob('warmth', id) : this.knob('quarrels', id)), 4));
      }
      w.log('saw', id, { exchange: ex.id, actor: by, kind: ex.kind, against });
      w.emit('bree:witnessed', { id, exchange: ex.id, actor: by, kind: ex.kind, against });
    }
  }

  /** The game says who saw an exchange (in progress, or lately finished): they see what it came to (recorded). */
  witnessed(exchange: number, seenBy: Id[]): void { this.w.input('bree.witness', [exchange, seenBy]); }

  /** Witnesses reported by the game, inside the simulation. */
  applyWitnessed(exchange: number, seenBy: Id[]): void {
    const st = this.st;
    if (!st) return;
    const ex = st.ex[exchange];
    if (ex) { this.witness(ex, seenBy); return; }
    const done = st.recent.find((f) => f.id === exchange);
    if (done) this.witness({ id: done.id, kind: done.kind, who: done.who, place: done.place, by: done.by, outcome: done.outcome, seen: {} }, seenBy);
  }

  /** Puts the next turn on the clock (the kind's own gap, or the config's). */
  private schedule(ex: Exchange, r: Stream): void {
    const [lo, hi] = this.kinds.get(ex.kind)?.gap ?? this.c.turnGap;
    ex.next = round(this.w.s.now + Math.max(0.5, r.range(lo, hi ?? lo)), 4);
    this.w.clock.schedule({ t: ex.next, k: 'module', ref: this.name, data: { ex: ex.id, n: ex.n } });
  }

  /** Tells the game about a turn. */
  private tell(ex: Exchange, t: { who: Id; to: Id; step: string; landed: Outcome | null; end: boolean; harm?: Blow }): void {
    const w = this.w;
    const tp = ex.topic && ['open', 'reply', 'more', 'back'].includes(t.step) ? ex.topic : undefined;
    // the words: the most specific line there is, the topic's, then the kind's, then any exchange's
    const tries = [...(tp ? [`${tp.id}.${t.step}`] : []), `${this.kinds.get(ex.kind)?.line ?? ex.kind}.${t.step}`, `bree.${t.step}`];
    const turn: Turn = {
      id: ex.id, kind: ex.kind, n: ex.n, who: t.who, to: t.to, step: t.step, topic: tp?.id ?? null,
      landed: t.landed, outcome: ex.score === null ? null : this.outcome(ex.score), line: tries[0], end: t.end,
    };
    if (tp && tp.subject !== undefined) turn.subject = tp.subject;
    if (ex.manners[t.who]) turn.manner = ex.manners[t.who];
    if (t.harm) turn.harm = t.harm;
    const cs = w.cityspeak;
    if (cs && w.s.people[t.who]) {
      for (const topic of tries) {
        const said = cs.choose(t.who, { to: t.to, topic, exact: true, salt: [ex.id, ex.n], avoid: (key) => ex.said.includes(key) });
        if (!said) continue;
        turn.line = topic;
        turn.key = said.key;
        if (said.text !== undefined) turn.text = said.text;
        ex.said.push(said.key);
        if (ex.said.length > 24) ex.said.shift();
        break;
      }
    }
    w.emit('bree:turn', turn);
  }

  /** The exchange as the game sees it. */
  private view(ex: Exchange): ExchangeView {
    const v: ExchangeView = {
      id: ex.id, kind: ex.kind, first: ex.first, who: ex.who.slice(), place: ex.place, t: ex.t, why: ex.why,
      turn: ex.n, turns: ex.turns, outcome: ex.score === null ? null : this.outcome(ex.score), score: ex.score,
      topic: ex.topic ? { id: ex.topic.id, ...(ex.topic.subject !== undefined ? { subject: ex.topic.subject } : {}) } : null,
      manners: { ...ex.manners },
    };
    if (ex.by) v.by = ex.by;
    return v;
  }

  /** The exchange someone's in (by its id, or someone in it), as the game sees it, or null. */
  exchange(which: number | Id): ExchangeView | null {
    const ex = typeof which === 'number' ? this.st?.ex[which] : this.exOf(which);
    return ex ? this.view(ex) : null;
  }

  /** Every exchange in progress. */
  exchanges(): ExchangeView[] { const st = this.st; return st ? Object.keys(st.ex).map((k) => this.view(st.ex[k])) : []; }

  /** Finished exchanges (the last config.recent), newest last; those of a pair, with both given. */
  history(a?: Id, b?: Id): Finished[] {
    return (this.st?.recent || []).filter((f) => (!a || f.who.includes(a)) && (!b || f.who.includes(b))).map((f) => ({ ...f, who: f.who.slice(), outcomes: { ...f.outcomes } }));
  }

  // -------------------------------------------------------------------------
  // Exchanges: the end, and what it leaves
  // -------------------------------------------------------------------------

  /** Ends an exchange: what each outcome does, for each of them. */
  private finish(ex: Exchange, why: string, left?: Id): void {
    const w = this.w, c = this.c, st = this.mut();
    delete st.ex[ex.id];
    for (const id of ex.who) if (st.of[id] === ex.id) delete st.of[id];
    const def = this.kinds.get(ex.kind);
    const outcome = this.outcome(ex.score ?? 0);
    const outcomes: Record<Id, Outcome> = {};
    for (const id of ex.who) outcomes[id] = ex.heard[id] === undefined ? outcome : this.outcome(ex.heard[id]);
    if (def && ex.n > 0) {
      this.leave(ex, def, outcomes, why === 'left' ? left : undefined);
      // an exchange that came to a row in front of people: they saw it
      if (def.seen !== false && OUTCOMES.indexOf(outcome) >= OUTCOMES.indexOf(c.seenAt as Outcome)) this.witness({ ...ex, outcome }, this.seers(ex), !!(def.crime && w.wormtongue?.crimes.has(def.crime)));
    }
    // how the two in it have got on
    const [a, b] = ex.who;
    if (ex.n > 0) {
      const pair = (st.pairs[pairKey(a, b)] ||= { n: 0, last: w.s.now });
      pair.n++;
      pair.last = w.s.now;
      pair.outcome = outcome;
      if (!this.atLeast(outcome, 'awkward')) { pair.row = w.s.now; if (ex.by) pair.by = ex.by; else delete pair.by; }
    }
    const done: Finished = { id: ex.id, kind: ex.kind, first: ex.first, who: ex.who.slice(), place: ex.place, t: ex.t, end: w.s.now, outcome, outcomes, n: ex.n, why };
    if (ex.by) done.by = ex.by;
    if (left) done.left = left;
    if (ex.mediator) done.mediator = ex.mediator;
    st.recent.push(done);
    while (st.recent.length > Math.max(0, c.recent)) st.recent.shift();
    // two still together may talk again later
    if (c.again > 0 && why === 'done' && ex.who.length === 2 && ex.place) this.later(a, b, w.ring.root(ex.place));
    w.log('exchanged', a, { id: ex.id, kind: ex.kind, with: ex.who.slice(1), outcome, turns: ex.n, why });
    w.emit('bree:end', { ...done, who: done.who.slice(), outcomes: { ...outcomes } });
    // a fight by numbers over: whoever was held in it thinks again
    if (w.morgul?.fights(ex.kind)) w.morgul.parted(ex.who);
  }

  /** What an exchange leaves each of them: regard, attraction, feelings, memories, sentiments, relief, and what the kind does. */
  private leave(ex: Exchange, def: KindDef, outcomes: Record<Id, Outcome>, left?: Id): void {
    const w = this.w, c = this.c, fs = w.fellowship, rv = w.reverie;
    const who = ex.who, starter = who[0];
    const group = who.length > 2;
    const share = group ? c.groupShare : 1;
    const romantic = !!def.tags?.includes('romantic');
    const frac = clamp(ex.n / Math.max(1, ex.turns));
    const long = ex.n >= c.longTurns;
    for (const x of who) {
      const p = w.s.people[x];
      if (!p || p.status === 'gone') continue;
      const o = outcomes[x];
      // the one they talked with (the starter's: the first other; the others': the starter)
      const y = x === starter ? who[1] : starter;
      if (fs) for (const z of who) {
        if (z === x || (!group && z !== y)) continue;
        let d = (c.regard[o] ?? 0) * (def.regard ?? 1) * share;
        // the headline knobs, for whoever's regard it is: good ones warm, bad ones sour
        d *= d > 0 ? this.knob('warmth', x) : this.knob('quarrels', x);
        if (d) fs.applyRegard(x, z, round(d, 4));
        if (romantic && z === y) {
          let a = (c.attraction[o] ?? 0) * (def.attraction ?? 1);
          a *= a > 0 ? this.knob('warmth', x) : this.knob('quarrels', x);
          if (a) fs.applyAttraction(x, z, round(a, 4));
        }
      }
      const does: OutcomeDo[] = [];
      const own = def.on?.[o];
      does.push({ feel: own && 'feel' in own ? own.feel : c.feel[o] ?? null, memory: own?.memory ?? c.memory[o] ?? 0, sentiment: own?.sentiment, then: own?.then });
      if (long && this.atLeast(o, 'fine')) {
        const lg = def.on?.long;
        does.push({ feel: lg && 'feel' in lg ? lg.feel : c.feel.long ?? null, memory: lg?.memory ?? c.memory.long ?? 0, sentiment: lg?.sentiment, then: lg?.then });
      }
      if (left === x) {
        const lf = def.on?.left;
        does.push({ feel: lf && 'feel' in lf ? lf.feel : c.feel.left ?? null, memory: lf?.memory ?? c.memory.left ?? 0, sentiment: lf?.sentiment, then: lf?.then });
        if (fs && c.leftRegard) fs.applyRegard(x, y, round(c.leftRegard * (c.leftRegard > 0 ? this.knob('warmth', x) : this.knob('quarrels', x)), 4));
      }
      if (def.on?.end) does.push(def.on.end);
      // whoever stepped in: thanked by both
      if (ex.mediator && fs && c.mediateRegard) fs.applyRegard(x, ex.mediator, round(c.mediateRegard * this.knob('warmth', x), 4));
      // (what the kind does can read the exchange: its kind, who was in it, how many turns, their outcome, who walked off)
      const ctx = w.ctx(p, { target: y, place: ex.place, data: { exchange: ex.id, kind: ex.kind, first: ex.first, who: ex.who.slice(), turns: ex.n, outcome: o, left: left ?? null } });
      for (const d of does) {
        const f = Array.isArray(d.feel) ? d.feel[x === starter ? 0 : 1] : d.feel;
        if (f && rv) rv.applyFeel(x, f, y);
        if (rv && (d.memory ?? 0) >= 1) rv.applyRemember(x, { k: `${ex.kind}:${o}`, about: group ? undefined : y, place: ex.place ?? undefined, imp: d.memory, text: `${def.label ?? ex.kind} with ${w.s.people[y]?.name ?? y}` });
        if (d.sentiment && fs && (x !== starter || d.sentiment.both)) fs.applySentiment(x, y, d.sentiment.label, d.sentiment.by ?? c.regard[o] ?? 0, d.sentiment.minutes);
        if (d.then) w.lang.applyAll(d.then, ctx);
      }
      // a bad one leaves a grudge, more for a quick temper, less for a forgiving nature
      for (const z of who) {
        if (z === x || (!group && z !== y)) continue;
        const g = (c.grudge[o] ?? 0) * (def.grudge ?? 1) * share * this.grudging(p);
        if (g > 0) this.applyGrudge(x, z, round(g, 4), ex.kind);
        // whoever stepped in eased it
        if (ex.mediator && c.mediateMends > 0) this.mend(x, z, c.mediateMends * this.forgiving(x), 'a go-between');
      }
      // the needs it meets, by how much of it they had
      if (def.relieves) for (const need in def.relieves) {
        if (!w.needs.has(need)) continue;
        w.mind.setLevel(p, need, w.mind.level(p, need) - def.relieves[need] * frac);
      }
    }
    // an apology, a gift, making up: the other's grudge against the one who began it eases (both ways, making up)
    if (def.mends) {
      const [a, b] = who;
      const mb = c.mends[outcomes[b]] ?? 0;
      if (mb > 0) this.mend(b, a, def.mends * mb * this.forgiving(b), ex.kind);
      const ma = def.mutual ? c.mends[outcomes[a]] ?? 0 : 0;
      if (ma > 0) this.mend(a, b, def.mends * ma * this.forgiving(a), ex.kind);
    }
    // what the kind does when it goes well for the other: a deed, a gift, a favor owed, a lesson
    const other = w.s.people[who[1]];
    const s = w.s.people[starter];
    if (s && other && this.atLeast(outcomes[who[1]], 'fine')) {
      if (def.deed) {
        const data: Record<string, Value> = { for: other.id };
        if (ex.place) data.place = ex.place;
        w.log('did', starter, { verb: def.deed, for: other.id });
        for (const m of w.hooks) m.did?.(starter, def.deed, data);
      }
      if (def.gives && w.have(s, def.gives) > 0) { w.takeItem(s, def.gives, 1); other.inv[def.gives] = (other.inv[def.gives] || 0) + 1; }
      if (def.owes && w.wormtongue) w.wormtongue.applyOwe(starter, other.id, def.owes);
      if (def.teaches) { const skill = this.lesson(s, other); if (skill) w.skills.applyTrain(other, skill, def.teaches * frac); }
    }
  }

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------

  /** The people someone has something against (a grudge or a feud), strongest first; worked out once a moment. */
  private foes(p: PersonState): Array<{ id: Id; a: number }> {
    const st = this.st as State, w = this.w;
    const hit = this.foeCache;
    if (hit && hit.st === st && hit.id === p.id && hit.now === w.s.now && hit.seq === w.s.seq && hit.v === st.v) return hit.list;
    const ids = new Set<Id>(Object.keys(st.g[p.id] || {}));
    const fs = w.fellowship;
    for (const k of Object.keys(st.feuds)) {
      const f = st.feuds[k];
      for (const [mine, theirs] of [[f.a, f.b], [f.b, f.a]]) {
        if (!this.inParty(p.id, mine)) continue;
        if (w.s.people[theirs]) ids.add(theirs);
        else if (fs) for (const m of fs.members(theirs)) ids.add(m);
      }
    }
    const from = this.c.avoidFrom;
    const list: Array<{ id: Id; a: number }> = [];
    for (const id of [...ids].sort()) { if (id === p.id) continue; const a = this.animosity(p.id, id); if (a >= from) list.push({ id, a }); }
    list.sort((x, y) => y.a - x.a || (x.id < y.id ? -1 : 1));
    this.foeCache = { st, id: p.id, now: w.s.now, seq: w.s.seq, v: st.v, list };
    return list;
  }

  /**
   * Avoidance: someone with a grudge or in a feud weighs what they might do
   * where the other is lower, and anything social aimed at them lower still;
   * a hostile interaction aimed at them weighs more.
   */
  consider(p: PersonState, cand: Candidate): Array<[string, number]> | void {
    const st = this.st;
    if (!st || (!st.g[p.id] && !hasKeys(st.feuds))) return;
    const foes = this.foes(p);
    if (!foes.length) return;
    const w = this.w, c = this.c;
    const out: Array<[string, number]> = [];
    const name = (id: Id): string => w.s.people[id]?.name ?? id;
    if (cand.target) {
      const f = foes.find((x) => x.id === cand.target);
      const a = cand.kind === 'action' ? w.actions.get(cand.id) : undefined;
      if (f && a) {
        const k = a.interact ? this.kinds.get(a.interact) : undefined;
        if (k?.tags?.includes('hostile')) out.push([`a grudge against ${name(f.id)}`, round(1 + f.a * c.hostilePull, 4)]);
        else if (a.interact || a.tags?.includes('social')) out.push([`avoiding ${name(f.id)}`, round(Math.max(c.avoidFloor, 1 - f.a * c.avoidTarget), 4)]);
      }
    }
    const place = cand.place ?? p.place;
    if (place) {
      const root = w.ring.root(place);
      for (const f of foes) {
        if (f.id === cand.target) continue;
        const q = w.s.people[f.id];
        if (!q || q.status !== 'active' || !q.place || q.doing?.kind === 'travel' || w.ring.root(q.place) !== root) continue;
        out.push([`avoiding ${name(f.id)}`, round(Math.max(c.avoidFloor, 1 - f.a * c.avoidPlace), 4)]);
        break;
      }
    }
    return out;
  }

  /** Two people spend time together: now and then one strikes up an exchange. */
  met(a: PersonState, b: PersonState, _place: Id, minutes: number): void {
    if (!this.kinds.size) return;
    const c = this.c;
    if (!this.free(a) || !this.free(b)) return;
    // someone happening by a group talking: room for one more
    const ea = this.exOf(a.id), eb = this.exOf(b.id);
    if (ea || eb) {
      const ex = (ea ?? eb) as Exchange, newcomer = ea ? b : a;
      if ((ea && eb) || !this.kinds.get(ex.kind)?.group || !this.talks(this.kinds.get(ex.kind) as KindDef) || ex.who.length >= c.groupMax || !ex.place || !this.w.ring.within(newcomer.place, ex.place)) return;
      if (!(c.joinChance * this.talkOf([newcomer.id]) > 0)) return;
      if (this.joins(ex, newcomer.id, this.stream())) this.add(ex, newcomer.id);
      return;
    }
    // the headline knob: how readily people strike one up (the world's, times both people's own)
    const k = c.strike * this.talkOf([a.id, b.id]);
    if (!(k > 0)) return;
    const r = this.stream();
    if (!r.chance(k)) return;
    // the chattier is likelier to start
    const ta = this.nature(a, 'talkative'), tb = this.nature(b, 'talkative');
    const [s, o] = r.chance((0.5 + ta) / Math.max(1e-6, 1 + ta + tb)) ? [a, b] : [b, a];
    const pick = r.weighted(this.choices(s, o), (x) => x.weight);
    if (pick) this.begin(pick.def.id, [s.id, o.id], 'meet', minutes);
  }

  /**
   * An action that interacts (its `interact`) begins its exchange with its
   * target, over its length; with no target, with whoever there its
   * `interactWith` finds (who leaves any exchange they're in for it).
   */
  started(p: PersonState, d: Doing): void {
    if (d.kind !== 'act') return;
    const a = this.w.actions.get(d.action);
    const found = !d.target && a?.interactWith && a.interact ? this.partner(p, a) : undefined;
    const target = d.target ?? found;
    if (!target) return;
    const kind = a?.interact;
    if (!kind || !this.kinds.has(kind) || this.exOf(p.id)) return;
    // (whoever's serving breaks off to serve; someone aimed at already talking is left be)
    const busy = this.exOf(target);
    if (busy && !found) return;
    const o = this.w.s.people[target];
    if (!this.free(o) || !p.place || this.w.ring.root(o.place as Id) !== this.w.ring.root(p.place)) return;
    if (busy) this.finish(busy, 'interrupted');
    this.begin(kind, [p.id, o.id], 'action', d.end - this.w.s.now);
  }

  /** Who an action with no target interacts with: the first one at the place (by id) who is free and for whom its interactWith holds, someone not in an exchange before someone in one. */
  private partner(p: PersonState, a: ActionDef): Id | undefined {
    const w = this.w;
    if (!p.place || !this.kinds.has(a.interact as Id)) return undefined;
    const root = w.ring.root(p.place);
    const fit = w.peek(() => w.ring.present(root).filter((id) => id !== p.id).sort().filter((id) =>
      this.free(w.s.people[id]) && w.lang.all(a.interactWith, w.ctx(p, { target: id, place: p.place, action: a.id }))));
    return fit.find((id) => !this.exOf(id)) ?? fit[0];
  }

  /** Two people who've talked may strike up again in config.again minutes, if they're still together then. */
  private later(a: Id, b: Id, place: Id): void {
    const pair = this.mut().pairs[pairKey(a, b)];
    if (!pair) return;
    // (one wait a pair: a later one supersedes it)
    const t = (pair.again = round(this.w.s.now + Math.max(0.5, this.c.again), 4));
    this.w.clock.schedule({ t, k: 'module', ref: this.name, data: { again: [a, b], place, t } });
  }

  /** Still together (free, at the same place, neither in an exchange) for a few minutes more: a meeting of Bree's own, or another wait. */
  private again(a: Id, b: Id, place: Id, t: number): void {
    const w = this.w, pa = w.s.people[a], pb = w.s.people[b];
    const pair = this.st?.pairs[pairKey(a, b)];
    if (!pair || pair.again !== t) return;
    delete pair.again;
    if (!this.free(pa) || !this.free(pb) || this.exOf(a) || this.exOf(b)) return;
    if (w.ring.root(pa.place as Id) !== place || w.ring.root(pb.place as Id) !== place) return;
    const minutes = Math.min(pa.doing?.end ?? Infinity, pb.doing?.end ?? Infinity) - w.s.now;
    if (!(minutes >= w.cfg.meetMinutes)) return;
    const before = this.mut().ids;
    this.met(pa, pb, place, minutes);
    if (this.mut().ids === before) this.later(a, b, place);
  }

  /** The next turn of an exchange comes due, or two who talked may talk again. */
  timer(item: QueueItem): void {
    const again = item.data?.again;
    if (Array.isArray(again)) { this.again(String(again[0]), String(again[1]), String(item.data?.place), Number(item.data?.t)); return; }
    const id = Number(item.data?.ex);
    const ex = this.st?.ex[id];
    if (!ex || ex.n !== Number(item.data?.n)) return;
    this.turn(ex);
  }

  day(): void {
    const st = this.st;
    if (!st) return;
    const floor = this.c.grudgeFloor;
    for (const a of Object.keys(st.g)) {
      for (const b of Object.keys(st.g[a])) if (this.grudge(a, b) < floor) delete st.g[a][b];
      if (!Object.keys(st.g[a]).length) delete st.g[a];
    }
    for (const k of Object.keys(st.feuds)) if (this.feudStrength(st.feuds[k]) < floor) delete st.feuds[k];
    // two people who haven't had words in a long while: what's kept of it goes
    const days = this.c.pairDays, now = this.w.s.now;
    if (days > 0) for (const k of Object.keys(st.pairs)) if (now - st.pairs[k].last > days * DAY) delete st.pairs[k];
  }

  removed(p: PersonState): void {
    const st = this.st;
    if (!st) return;
    const ex = this.exOf(p.id);
    if (ex) this.leaveEx(ex, p.id, 'gone');
    delete st.g[p.id];
    for (const a of Object.keys(st.g)) { delete st.g[a][p.id]; if (!Object.keys(st.g[a]).length) delete st.g[a]; }
    for (const k of Object.keys(st.feuds)) if (st.feuds[k].a === p.id || st.feuds[k].b === p.id) delete st.feuds[k];
  }
}

export { DAY };
