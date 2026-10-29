// Morgul: harm between people. Named for the Morgul-blade of The Lord of the
// Rings, whose wound won't heal.
//
// The game (Tycho.harm, on screen) handles the moment of a hit; Morgul
// handles what follows, in minutes, on screen and off:
//
//   wounds       a harm leaves a wound, an Athelas course carrying its
//                severity, that runs its phases and heals in its own time;
//                someone's hurt is the sum of their open wounds; past
//                downAt they go down, and at the worst they may die, as
//                often as the lethality knob says (0 by default: nobody)
//   the victim   pain, anger or fear by their temper, shaken after; a
//                memory; who they believe did it; a grudge (Bree) by the
//                severity and the intent (none for a blow they started);
//                fear of whoever did it, and of the place (RimWorld, Dwarf
//                Fortress)
//   onlookers    believe what they saw, remember it, think less of whoever
//                did it; a harm the game calls a crime goes to Wormtongue
//                with its severity: reports, heat, infamy, gossip
//   traps        set at places, catching whoever comes by off screen, by
//                chance, unless they know it's there; known by whoever saw
//                it set (Thief, Dishonored)
//   poison       taints in a place's stock or someone's goods that travel
//                with them (Ceres) and afflict whoever eats them, quietly
//                at first, until the course tells
//   suspicion    unseen harm leaves beliefs about who did it, by evidence
//                and reason: whoever set or served it, whoever bore a
//                grudge, whoever was about. They can be wrong; nobody
//                investigates (Crusader Kings)
//   fights       Bree's fights come out by numbers: each turn a blow lands
//                one way or the other by the fighters' might and what they
//                hold, until someone yields or goes down; harm by the player
//                makes a character choose to fight back, flee, yield or
//                call for help
//   choosing     terms to weigh harm by, revenge as a task, flight, care,
//                caution, and the knobs: violence, lethality, vengeance,
//                caution, healing, suspicion
//
// Off screen it all comes out by numbers; on screen the game reports each
// harm (`harm`) and each trap sprung (`spring`), and traps where the game
// shows them (`near`) are the game's to spring.
//
// State is made with the first harm, trap or taint (world.s.mod.morgul), so
// a world without harm saves and hashes as if Morgul were off.
import type { Module } from '../core/module';
import type { Candidate, Consideration, Doing, Id, PersonState, QueueItem, Value } from '../core/types';
import type { World } from '../core/world';
import { DAY, Stream, clamp, round } from '../core/util';

/** Why a harm happened, which decides what it leaves: meant, in self-defense, careless, or nobody's doing. */
export type Intent = 'meant' | 'defense' | 'careless' | 'accident';
/** How a means is used: up close, thrown, shot, cast, coated onto another, dosed into food, or set as a trap. */
export type MeansUse = 'strike' | 'throw' | 'shoot' | 'cast' | 'coat' | 'dose' | 'set';

/**
 * What harm is done with: a weapon, a spell, a poison, a trap. Declared once
 * and shared with the game's own (Tycho.harm plays the on-screen fields; the
 * rest are kept and ignored). A character holds one as a good of the same id.
 */
export interface MeansDef {
  id: Id;
  label?: string;
  /** The kinds of harm it does: 'blunt', 'cut', 'poison'... */
  kinds?: string[];
  use?: MeansUse;
  /** How bad its harm is, 0..1: a blow with it adds this to a fist's; a trap or a dose of it harms this much. */
  severity?: number;
  /** The course a dose of it starts (a poison). */
  course?: Id;
  /** The game's own fields (the move, the blow, the trigger...). */
  [field: string]: unknown;
}

/** What a harm leaves on the body: by kind, how severe, and what it was done with; the first that fits. */
export interface WoundDef {
  id: Id;
  label?: string;
  /** The kinds of harm it's for. None: any. */
  kinds?: string[];
  /** The severities it's for, [least, most]. None: any. */
  at?: [number, number];
  /** What it was done with (a means or an item). None: anything. */
  what?: string | string[];
  /** How it came ('blow', 'trap', 'dose'...). None: any way. */
  via?: string[];
  /** The Athelas course it runs. */
  course: Id;
}

/** A kind of trap. */
export interface TrapDef {
  id: Id;
  label?: string;
  /** The kind of harm it does. Default: its means' first kind, or 'trap'. */
  kind?: string;
  /** How bad, 0..1. Default: its means' severity, or 0.2. */
  severity?: number;
  /** Hidden from whoever comes by (default true); one that isn't catches fewer, and is seen by whoever it doesn't catch. */
  hidden?: boolean;
  /** How many it catches before it's spent. Default 1. */
  uses?: number;
  /** Its chance to catch someone who comes to or does something at its place off screen. Default config.catch. */
  catch?: number;
}

/** A harm: who it struck, who did it, what kind and how bad, how it came, why, with what, where, and who saw it land. */
export interface Harm {
  to: Id;
  /** Who did it: a person, 'player', or null (nobody: a rockfall). */
  by?: Id | null;
  /** The game's own kind ('blunt', 'cut', 'burn', 'poison'...). Default: what it was done with's first kind, or 'harm'. */
  kind?: string;
  /** How bad, 0..1: a slap 0.05, a beating 0.5, a killing blow 1. */
  severity?: number;
  /** How it came: 'blow', 'trap', 'dose', 'fall', 'fire'... Default 'blow'. */
  via?: string;
  /** Default 'meant' if someone did it, else 'accident'. */
  intent?: Intent;
  /** The hazard it came from (a trap's or a taint's id). */
  cause?: string;
  /** What it was done with: a means, an item, a trap's kind. */
  what?: string;
  /** Where. Default: where the one struck is. */
  place?: Id | null;
  /** Who saw it land. Default: everyone at the place but the two of them. */
  seenBy?: Id[];
  /** The course it starts, over the wound it would leave (a dose's own). */
  course?: Id;
}

/** A harm as the game sees it (event 'morgul:harm'). */
export interface HarmView {
  id: number; t: number;
  to: Id; by: Id | null; kind: string; severity: number; via: string; intent: Intent;
  place: Id | null; seenBy: Id[];
  cause?: string; what?: string;
  /** The wound it left, and its course. */
  wound?: Id; course?: Id;
  /** Noticed yet (a dose isn't, until its course tells). */
  shown: boolean;
  /** How hurt the one struck is now. */
  hurt: number;
  /** A blow in a fight: the Bree exchange. */
  exchange?: number;
}

/** A blow in a fight by numbers, as a Bree turn carries it (`turn.harm`). */
export interface Blow {
  /** The harm it was. */
  id: number;
  by: Id; to: Id;
  kind: string; severity: number; what?: string;
  /** How hurt the one struck is now. */
  hurt: number;
  /** The fight ends with it: the one struck went down, yielded, or walked off. */
  end?: 'down' | 'yielded' | 'left';
}

/** A character's answer to harm from the player (event 'morgul:respond'). */
export interface Response {
  id: Id;
  to: Id;
  act: 'fight' | 'flee' | 'yield' | 'help';
  /** Their odds against the other, and how hurt they are. */
  odds: number;
  hurt: number;
  /** The first harm between them a while: the fight starts. */
  start: boolean;
  /** Who they'd call on (act 'help'). */
  help?: Id[];
  /** How appealing each answer was. */
  weights: Record<string, number>;
}

export interface MorgulConfig {
  // The headline knobs: plain multipliers, 1 changing nothing (lethality 0
  // by default). A person's own (PersonDef.tune.morgul) multiplies these for them.
  /** How readily anyone chooses an action or task tagged harmTag: its weight, times it. 0: nobody ever does. Default 1. */
  violence: number;
  /** How often harm at its worst kills: hurt at killAt kills with deathChance times it; a wound's phase that ends in death, with it. 0: nobody dies of harm. Default 0. */
  lethality: number;
  /** How strongly harm turns into a wish for revenge. Default 1. */
  vengeance: number;
  /** How much people steer clear of danger they know of. Default 1. */
  caution: number;
  /** How fast wounds heal: a wound's phases last 1 / healing as long (under 0.01 taken as 0.01). Default 1. */
  healing: number;
  /** How readily people suspect someone of harm they didn't see, and how strongly. Default 1. */
  suspicion: number;

  // The body.
  /** Hurt at which someone goes down. Default 0.8. */
  downAt: number;
  /** Minutes they lie there before they come round, unless someone helps them up: [min, max]. Default [20, 60]. */
  downMinutes: number[];
  /** The rank lying down comes at: above everything (a break is 4). Default 5. */
  downRank: number;
  /** The action lying down is (Morgul declares it, unless the game has one by this id). Default 'down'. */
  down: string;
  /** The action fighting is: both fighters are held in it while a fight by numbers lasts (declared like down). Default 'fighting'. */
  fighting: string;
  /** The rank fighting comes at: above directives and breaks, under lying down. Default 4.5. */
  fightRank: number;
  /** Hurt at which harm is at its worst, and may kill. Default 1. */
  killAt: number;
  /** The chance harm at its worst kills, times lethality. Default 0.5. */
  deathChance: number;

  // The victim.
  /** The ways of harm whose victim sees who did it (otherwise they suspect). Default ['blow', 'throw', 'shoot', 'cast']. */
  direct: string[];
  /** The share of the grudge, the regard lost, the fear and onlookers' blame each intent brings. Default meant 1, careless 0.4, accident 0.1, defense 0. */
  intents: Record<string, number>;
  /** A victim's grudge (Bree): severity × this × the intent's share. Default 1.5. */
  grudge: number;
  /** A victim's regard lost for whoever did it: severity × this × the share. Default 0.6. */
  regard: number;
  /** Fear of whoever did it: severity × this × the share × (1 + (0.5 - courage) × 2 × fearCourage). Defaults 1 and 0.5. */
  fear: number;
  fearCourage: number;
  /** Fear of the place it happened: severity × this. Default 1. */
  wary: number;
  /** Fear, fear of places, and what they hold against someone from harm, lost a day (the last times 0.5 + forgiveness; fear times 0.5 + courage). Default 0.05. */
  fade: number;
  /** A victim whose temper and nerve (temper × 0.6 + courage × 0.4) are at least this is furious, else scared. Default 0.5. */
  angerAt: number;
  /** A harm at least this bad leaves them shaken. Default 0.15. */
  shakenAt: number;
  /** The importance of the victim's memory: memory + severity × memorySeverity. Defaults 3 and 6. */
  memory: number;
  memorySeverity: number;
  /** Meant harm between people of two households sets the households feuding by severity × this (Bree). 0: never. Default 0. */
  feud: number;
  /** Harm someone does to someone they held harm against eases it by severity × this (revenge sated). Default 2. */
  sated: number;

  // Onlookers and the law.
  /** How strongly an onlooker believes what they saw. Default 0.8. */
  witnessStrength: number;
  /** The importance of an onlooker's memory: witnessMemory + severity × memorySeverity / 2. Default 2. */
  witnessMemory: number;
  /** An onlooker's regard lost for whoever did it: severity × this × the share. Default 0.3. */
  witnessRegard: number;
  /** The Wormtongue crime each intent is, and a killing ('killed'): { meant: 'assault', careless: 'negligence', killed: 'murder' }. Default none. */
  crimes: Record<string, string>;

  // Traps.
  /** A trap's chance to catch someone, for one with no `catch`. Default 0.3. */
  catch: number;
  /** The careful are caught less: × (1 - (careful - 0.5) × 2 × this). Default 0.5. */
  careful: number;
  /** A trap that isn't hidden catches at this share of its chance. Default 0.3. */
  seenCatch: number;
  /** Someone who knows of a trap or a taint set for someone warns them when they meet, if their regard for them is at least this. Default 0.2. */
  warnAt: number;

  // Poison.
  /** Action tags that eat from a place's pot (a taint with no item). Default ['food']. */
  eats: string[];
  /** A dose's severity, for a taint with none whose means says none. Default 0.5. */
  dose: number;

  // Suspicion.
  /** The chance someone who learns of a harm they didn't see suspects someone, times suspicion. Default 0.8. */
  suspect: number;
  /** The evidence: being told who set or dosed it, by the belief's strength (whoever saw it, knows). Default 2. */
  suspectTold: number;
  /** ...having served it (the place's owner, staff on shift there). Default 0.6. */
  suspectServed: number;
  /** ...a grudge against the victim, by its strength. Default 1.5. */
  suspectGrudge: number;
  /** ...being about when it happened. Default 0.3. */
  suspectAbout: number;
  /** A suspicion weighs 1 + dislike × suspectSpite (a scapegoat), and 1 - liking × suspectLoyal (never under 0.1). Defaults 1 and 0.6. */
  suspectSpite: number;
  suspectLoyal: number;
  /** A suspicion's strength: its weight × this × suspicion, at most suspectMax; under suspectFloor it isn't held. Defaults 0.5, 0.9 and 0.1. */
  suspectStrength: number;
  suspectMax: number;
  suspectFloor: number;

  // Fights by numbers.
  /** The Bree kinds that are fights by numbers: ids or 'tag:<tag>'. Default ['fight']. */
  fights: string[];
  /** Most blows in a fight. Default 12. */
  blows: number;
  /** A fighter's might: considerations on them (strength, size, skill, nerve), multiplied. Default none (1). */
  might: Consideration[];
  /** A bare blow's severity, and its kind. Defaults 0.1 and 'blunt'. */
  fist: number;
  fistKind: string;
  /** A held means adds its severity times meansBlow to a blow, and times meansMight to might (× (1 + severity × meansMight)). Defaults 0.5 and 1. */
  meansBlow: number;
  meansMight: number;
  /** Might lost a point of hurt: × (1 - hurt × hurtMight). Default 0.6. */
  hurtMight: number;
  /** A blow's severity, give or take this share. Default 0.5. */
  blowSpread: number;
  /** A fighter yields at this much hurt, at middling nerve: × (1 + (courage - 0.5) × yieldCourage). Defaults 0.5 and 1. */
  yieldAt: number;
  yieldCourage: number;
  /** After a blow that doesn't end it, the one struck walks off with this chance times how near they are to yielding (hurt over the hurt they'd yield at). Default 0.4. */
  walkOff: number;
  /** The fact the player's might is read from (default 1 when it isn't set). Default 'might:player'. */
  playerMight: string;

  // Fights with the player.
  /** How appealing each answer to the player's harm is, over its shape (fight, flee, yield, help). Default 1 each. */
  respond: Record<string, number>;
  /** Someone there whose regard for them is at least this can be called on for help. Default 0.2. */
  helpFrom: number;
  /** Minutes without harm between them after which the next starts a fight afresh. Default 30. */
  fightGap: number;
  /** Minutes someone who chose to flee, or was frightened off, keeps wanting to get away (and before fear sends them off again). Default 30. */
  fleeMinutes: number;

  // Choosing.
  /** The tags of harmful actions (violence), of fleeing, and of tending the hurt. Defaults 'harm', 'flee' and 'care'. */
  harmTag: string;
  fleeTag: string;
  careTag: string;
  /** The task revenge is: offered, aimed at whoever they want it on, when they want it enough. Default 'avenge'. */
  avenge: string;
  /** What they hold against someone from harm, times vengeance and their temper (1 + (temper - 0.5) × 2 × vengeTemper), at which revenge is an option. Defaults 0.3 and 0.5. */
  vengeAt: number;
  vengeTemper: number;
  /** Revenge weighs this times how much they want it; a harmful action aimed at whoever they want it on, 1 + that. Default 0.5. */
  vengePull: number;
  /** Fear of someone there times poor odds against them, at which someone wants to leave. Default 0.25. */
  fleeAt: number;
  /** Options where someone they fear is weigh 1 - fear × (1 - odds) × fleePlace; fleeing weighs 1 + fear × fleePull. Defaults 0.8 and 2. */
  fleePlace: number;
  fleePull: number;
  /** Options at a place they know is dangerous weigh 1 - danger × cautionPlace × caution. Default 0.7. */
  cautionPlace: number;
  /** Tending someone hurt weighs 1 + hurt × carePull × (0.5 + regard); the one tended gains `cared` regard for them. Defaults 2 and 0.03. */
  carePull: number;
  cared: number;
  /** None of these weighs an option under this. Default 0.1. */
  floor: number;

  /** Harms kept, for history and suspicion (and every one not noticed yet). Default 50. */
  recent: number;
  /** The terms trait roles are read from (temper, courage, careful, forgiveness): over Bree's mapping, else trait.<role>. Default none. */
  traits: Record<string, string>;
}

export const DEFAULT_MORGUL: MorgulConfig = {
  violence: 1, lethality: 0, vengeance: 1, caution: 1, healing: 1, suspicion: 1,
  downAt: 0.8, downMinutes: [20, 60], downRank: 5, down: 'down', fighting: 'fighting', fightRank: 4.5, killAt: 1, deathChance: 0.5,
  direct: ['blow', 'throw', 'shoot', 'cast'], intents: { meant: 1, careless: 0.4, accident: 0.1, defense: 0 },
  grudge: 1.5, regard: 0.6, fear: 1, fearCourage: 0.5, wary: 1, fade: 0.05, angerAt: 0.5, shakenAt: 0.15,
  memory: 3, memorySeverity: 6, feud: 0, sated: 2,
  witnessStrength: 0.8, witnessMemory: 2, witnessRegard: 0.3, crimes: {},
  catch: 0.3, careful: 0.5, seenCatch: 0.3, warnAt: 0.2,
  eats: ['food'], dose: 0.5,
  suspect: 0.8, suspectTold: 2, suspectServed: 0.6, suspectGrudge: 1.5, suspectAbout: 0.3, suspectSpite: 1, suspectLoyal: 0.6,
  suspectStrength: 0.5, suspectMax: 0.9, suspectFloor: 0.1,
  fights: ['fight'], blows: 12, might: [], fist: 0.1, fistKind: 'blunt', meansBlow: 0.5, meansMight: 1, hurtMight: 0.6, blowSpread: 0.5,
  yieldAt: 0.5, yieldCourage: 1, walkOff: 0.4, playerMight: 'might:player',
  respond: { fight: 1, flee: 1, yield: 1, help: 1 }, helpFrom: 0.2, fightGap: 30, fleeMinutes: 30,
  harmTag: 'harm', fleeTag: 'flee', careTag: 'care', avenge: 'avenge',
  vengeAt: 0.3, vengeTemper: 0.5, vengePull: 0.5, fleeAt: 0.25, fleePlace: 0.8, fleePull: 2, cautionPlace: 0.7, carePull: 2, cared: 0.03, floor: 0.1,
  recent: 50, traits: {},
};

/** Feelings Morgul gives (declared when Reverie is on; a game declares its own with the same ids to change them; Reverie's own 'scared' is used too). */
const MORGUL_FEELINGS = [
  { id: 'in_pain', label: 'In pain', tell: 'was in pain', weight: -0.15, minutes: 12 * 60, stack: 2, emotion: 'sad' },
  { id: 'furious', label: 'Furious', tell: 'was furious', weight: -0.1, minutes: DAY, stack: 2, emotion: 'angry' },
  { id: 'shaken', label: 'Shaken', tell: 'was shaken', weight: -0.08, minutes: 2 * DAY, stack: 2, emotion: 'tense' },
  { id: 'saw_harm', label: 'Saw someone hurt', tell: 'was upset to see someone hurt', weight: -0.06, minutes: 6 * 60, stack: 2, emotion: 'tense' },
  { id: 'cared_for', label: 'Someone looked after me', tell: 'felt looked after', weight: 0.1, minutes: DAY, emotion: 'happy' },
];

/** The uses that arm someone for a fight. */
const ARMS: readonly string[] = ['strike', 'throw', 'shoot', 'cast'];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** A harm, kept a while. */
interface HarmRec {
  id: number; t: number; to: Id; by: Id | null; kind: string; sev: number; via: string; intent: Intent;
  place: Id | null; seen: Id[];
  cause?: string; what?: string; wound?: Id; course?: Id;
  /** Noticed: its mind's part has happened. */
  shown: boolean;
  /** A blow in this Bree exchange. */
  ex?: number;
  /** Who was about when it struck, and who served it (a dose): for suspicion. */
  about?: Id[];
  served?: Id[];
}

/** An open wound: which, who gave it, the last harm. */
interface WoundRec { w: Id; by: Id[]; h: number }

/** A trap set at a place. */
interface TrapRec {
  id: string; kind: Id; place: Id; by: Id | null; t: number; uses: number; for?: Id; known: Id[];
  /** Who was about when it was set (whoever set it too), when the game says: for suspicion once it springs. */
  about?: Id[];
}

/** Tainted servings: in a place's stock (or its pot, with no item), or in someone's goods (a person's, or a household's pantry). */
interface TaintRec {
  id: string; course: Id; n: number; t: number;
  place?: Id; owner?: Id; item?: Id;
  by?: Id; for?: Id; sev?: number; what?: Id;
  /** Who knows (whoever did it, whoever saw), and who was about when it was done (whoever did it too). */
  known: Id[];
  about?: Id[];
}

interface State {
  /** Draws from Morgul's own stream; ids handed out (harms, traps, taints). */
  n: number;
  ids: number;
  harms: HarmRec[];
  /** Open wounds: person -> course -> the wound. */
  wounds: Record<Id, Record<Id, WoundRec>>;
  /** What the victim holds against whoever hurt them (as they believe): [strength, since]. */
  held: Record<Id, Record<Id, [number, number]>>;
  /** Fear of someone, and of a place: [strength, since]. */
  fear: Record<Id, Record<Id, [number, number]>>;
  wary: Record<Id, Record<Id, [number, number]>>;
  /** Who's down: since and until when. */
  down: Record<Id, { t: number; until: number }>;
  traps: Record<string, TrapRec>;
  taints: Record<string, TaintRec>;
  /** Who wants to get away, until when (they chose to flee the player). */
  flee: Record<Id, number>;
  /** The last harm between each and the player (for a fight's start). */
  pf: Record<Id, number>;
  /** The regions whose traps the game springs itself (morgul.near). */
  near?: string[];
}

const hasKeys = (o: object | undefined): boolean => { if (o) for (const _ in o) return true; return false; };

// ---------------------------------------------------------------------------
// The module
// ---------------------------------------------------------------------------

export class Morgul implements Module {
  readonly name = 'morgul';
  readonly config: MorgulConfig;
  readonly knobs = { violence: 'person', lethality: 'person', vengeance: 'person', caution: 'person', healing: 'person', suspicion: 'person' } as const;
  readonly meansDefs = new Map<Id, MeansDef>();
  readonly woundDefs = new Map<Id, WoundDef>();
  readonly trapDefs = new Map<Id, TrapDef>();
  private w!: World;
  /** Where someone knows of danger, as of a moment (worked out again from the state). */
  private dangerCache: { id: Id; now: number; seq: number; n: number; map: Map<Id, number> } | null = null;

  constructor(cfg: Partial<MorgulConfig> = {}) { this.config = { ...DEFAULT_MORGUL, ...cfg }; }

  private get st(): State | undefined { return this.w.s.mod.morgul as State | undefined; }
  private mut(): State {
    return (this.w.s.mod.morgul ||= { n: 0, ids: 0, harms: [], wounds: {}, held: {}, fear: {}, wary: {}, down: {}, traps: {}, taints: {}, flee: {}, pf: {} }) as State;
  }
  /** The config in force: as declared, under any world.tune. */
  private get c(): MorgulConfig { return this.w.tuned(this.name, this.config); }
  /** A headline knob for someone: the world's, times their own. */
  knob(name: 'violence' | 'lethality' | 'vengeance' | 'caution' | 'healing' | 'suspicion', id: Id | null | undefined): number {
    return this.c[name] * this.w.own(id ? this.w.s.people[id] : undefined, this.name, name);
  }
  /** Has the game declared anything (a means, a wound, a trap)? Until then Morgul weighs nothing. */
  get used(): boolean { return this.woundDefs.size > 0 || this.trapDefs.size > 0 || this.meansDefs.size > 0; }

  attach(w: World): void {
    this.w = w;
    const L = w.lang;
    const other = (c: { target?: Id | null }, a: string): Id | null => (a && a !== 'target' ? a : c.target ?? null);
    L.term('hurt', (c) => (c.person ? this.hurt(c.person.id) : 0));
    L.term('wounded', (c, a) => (c.person ? this.wounded(c.person.id, a || undefined) : 0));
    L.term('hurt_by', (c, a) => { const o = other(c, a); return c.person && o ? this.held(c.person.id, o) : 0; });
    L.term('afraid_of', (c, a) => { const o = other(c, a); return c.person && o ? this.fearOf(c.person.id, o) : 0; });
    L.term('danger', (c, a) => (c.person ? this.danger(c.person.id, a || c.place || c.person.place) : 0));
    L.term('armed', (c) => (c.person ? this.armed(c.person) : 0));
    L.term('odds', (c, a) => { const o = other(c, a); return c.person && o ? this.odds(c.person.id, o) : 0.5; });
    L.term('suspects', (c, a) => { const o = other(c, a); return c.person && o ? this.suspicionOf(c.person.id, o) : 0; });
    L.term('down', (c) => (c.person ? this.isDown(c.person.id) : false));
    L.term('vengeance', (c, a) => { const o = other(c, a); return c.person && o ? this.vengeance(c.person.id, o) : 0; });
    L.term('fleeing', (c) => (c.person ? this.fleeing(c.person) : 0));
    // effects run inside the simulation: the person does it, to the target
    L.effect('harm', (c, a, _op, v) => {
      if (!c.person || !c.target) return;
      const what = this.bestMeans(c.person, a);
      this.applyHarm({ to: c.target, by: c.person.id, kind: a || undefined, severity: Number(v ?? this.c.fist) || 0, via: 'blow', intent: 'meant', what: what?.id, place: c.place ?? c.person.place });
    });
    L.effect('set', (c, a) => { if (c.person) this.applySet(a, { by: c.person.id, place: c.place ?? c.person.place, for: c.target ?? undefined }); });
    L.effect('taint', (c, a, op, v) => {
      if (!c.person) return;
      const [course, item] = a.split('.');
      this.applyTaint({ course, item: item || undefined, n: op && typeof v === 'number' ? v : 1, by: c.person.id, for: c.target ?? undefined, place: c.place ?? c.person.place ?? undefined });
    });
    L.effect('disarm', (c, a) => { if (c.person) this.disarmHere(c.person, a || undefined); });
    // tending: Athelas's mark, and someone down helped up (over Athelas's own effect)
    L.effect('tend', (c, a) => { if (c.person) this.applyTend(c.target ?? c.person.id, c.person.id, a || undefined); });
    w.defineInput('morgul.harm', (h: Harm) => this.applyHarm(h));
    w.defineInput('morgul.spring', (trap: string, id: Id, seenBy: Id[] | null, about?: Id[] | null) => this.applySpring(trap, id, seenBy ?? undefined, about ?? undefined));
    w.defineInput('morgul.disarm', (trap: string, by: Id | null) => this.applyDisarm(trap, by ?? undefined));
    w.defineInput('morgul.set', (kind: Id, o: { by?: Id | null; place: Id; for?: Id | null; seenBy?: Id[] | null; about?: Id[] | null }) => this.applySet(kind, { by: o.by ?? null, place: o.place, for: o.for ?? undefined, seenBy: o.seenBy ?? undefined, about: o.about ?? undefined }));
    w.defineInput('morgul.taint', (def: TaintDef) => this.applyTaint(def));
    w.defineInput('morgul.tend', (id: Id, by: Id | null) => this.applyTend(id, by ?? undefined));
    w.defineInput('morgul.near', (regions: string[]) => this.applyNear(regions));
    const rv = w.reverie;
    if (rv) for (const f of MORGUL_FEELINGS) if (!rv.feelingDefs.has(f.id)) rv.feelingDefs.set(f.id, f);
  }

  // -------------------------------------------------------------------------
  // Declaring
  // -------------------------------------------------------------------------

  /** What harm is done with (shared with the game's own: the off-screen fields are read here). */
  means(def: MeansDef): this { this.meansDefs.set(def.id, def); return this; }
  /** What a harm leaves on the body: by kind, how severe, with what; the first that fits. */
  wound(def: WoundDef): this { this.woundDefs.set(def.id, def); this.declareDown(); return this; }
  /** A kind of trap. */
  trap(def: TrapDef): this { this.trapDefs.set(def.id, def); return this; }

  /** The actions lying down and fighting are: declared once a wound is, unless the game has its own. */
  private declareDown(): void {
    const w = this.w, c = this.config;
    if (!w.actions.has(c.down)) w.action({ id: c.down, label: 'down', at: 'here', minutes: 30, rank: -1, pose: 'down', tags: ['down'], if: [(ctx) => !!ctx.person && this.isDown(ctx.person.id)] });
    if (!w.actions.has(c.fighting)) w.action({ id: c.fighting, label: 'fighting', at: 'here', minutes: 60, rank: -1, pose: 'fight', tags: ['fight'], if: [(ctx) => !!ctx.person && this.inFight(ctx.person.id)] });
  }

  /** Is someone in a fight by numbers (a Bree exchange of a kind that fights)? */
  inFight(id: Id): boolean {
    if (!this.woundDefs.size) return false;
    const ex = this.w.bree?.exchange(id);
    return !!ex && this.fights(ex.kind);
  }

  /**
   * A fight by numbers breaks out (Bree calls this): both fighters stop what
   * they're doing and fight, just after (whoever started it with an action of
   * their own keeps at it).
   */
  brawl(who: Id[], kind: Id): void {
    const w = this.w;
    for (const id of who) {
      const p = w.s.people[id];
      if (!p || p.status !== 'active') continue;
      const a = p.doing?.kind === 'act' ? w.actions.get(p.doing.action) : undefined;
      if (a && (a.id === this.c.fighting || a.interact === kind)) continue;
      w.clock.schedule({ t: w.s.now, k: 'module', ref: this.name, who: id, data: { act: 'fight' } });
    }
  }

  /** A fight by numbers is over (Bree calls this): whoever was fighting thinks again, just after. */
  parted(who: Id[]): void {
    const w = this.w;
    for (const id of who) {
      const p = w.s.people[id];
      if (p?.status === 'active' && p.doing?.action === this.c.fighting) w.clock.schedule({ t: w.s.now, k: 'module', ref: this.name, who: id, data: { act: 'fought' } });
    }
  }

  // -------------------------------------------------------------------------
  // Reading people
  // -------------------------------------------------------------------------

  /** Someone's nature in a role (temper, courage, careful, forgiveness): Morgul's mapping, else Bree's, else trait.<role>. */
  nature(p: PersonState, role: string): number {
    const w = this.w, term = this.c.traits[role];
    let v: Value | undefined;
    if (term) v = w.lang.value(term, w.ctx(p));
    else if (w.bree && w.bree.config.traits[role]) return w.bree.nature(p, role);
    else v = w.lang.value('trait.' + role, w.ctx(p));
    return typeof v === 'number' && isFinite(v) ? v : w.cfg.traitDefault;
  }

  /** How hurt someone is: the severities of their open wounds, each by how much its phase still hurts. */
  hurt(id: Id): number {
    const wounds = this.st?.wounds[id];
    const ath = this.w.athelas;
    if (!wounds || !ath) return 0;
    let h = 0;
    for (const course of Object.keys(wounds)) {
      const sev = ath.severityOf(id, course);
      if (sev === undefined) continue;
      const ph = ath.phaseOf(id, course);
      h += sev * (ph?.hurts ?? (ph?.quiet ? 0 : 1));
    }
    return round(h, 4);
  }

  /** How bad someone's open wounds of a kind are (any kind, with none). */
  private wounded(id: Id, kind?: string): number {
    const wounds = this.st?.wounds[id];
    const ath = this.w.athelas;
    if (!wounds || !ath) return 0;
    let h = 0;
    for (const course of Object.keys(wounds)) {
      const def = this.woundDefs.get(wounds[course].w);
      if (kind && !(def?.kinds?.includes(kind) || wounds[course].w === kind || course === kind)) continue;
      h += ath.severityOf(id, course) ?? 0;
    }
    return round(h, 4);
  }

  /** Someone's open wounds: which, the course and phase, how bad, how much it still hurts, who gave it, tended or not. */
  wounds(id: Id): Array<{ wound: Id; course: Id; phase: string; severity: number; hurts: number; by: Id[]; tended: number; quiet: boolean }> {
    const wounds = this.st?.wounds[id];
    const ath = this.w.athelas;
    if (!wounds || !ath) return [];
    const out = [];
    for (const course of Object.keys(wounds)) {
      const v = ath.of(id).find((x) => x.course === course);
      if (!v) continue;
      const ph = ath.phaseOf(id, course);
      out.push({ wound: wounds[course].w, course, phase: v.phase, severity: v.severity ?? ath.severityOf(id, course) ?? 0, hurts: ph?.hurts ?? (ph?.quiet ? 0 : 1), by: wounds[course].by.slice(), tended: v.tended ?? 0, quiet: !!v.quiet });
    }
    return out;
  }

  /** Is someone down? */
  isDown(id: Id): boolean { return !!this.st?.down[id]; }

  /** A faded strength: what's left of [strength, since] at this pace a day. */
  private faded(x: [number, number] | undefined, perDay: number): number {
    if (!x) return 0;
    return round(Math.max(0, x[0] - perDay * (this.w.s.now - x[1]) / DAY), 4);
  }
  private forgiving(id: Id): number { const p = this.w.s.people[id]; return 0.5 + (p ? this.nature(p, 'forgiveness') : this.w.cfg.traitDefault); }
  private brave(id: Id): number { const p = this.w.s.people[id]; return 0.5 + (p ? this.nature(p, 'courage') : this.w.cfg.traitDefault); }

  /** What a holds against b from harm b did them (as a believes), 0..1, fading. */
  held(a: Id, b: Id): number { return this.faded(this.st?.held[a]?.[b], this.c.fade * this.forgiving(a)); }
  /** a's fear of b, 0..1, fading. */
  fearOf(a: Id, b: Id): number { return this.faded(this.st?.fear[a]?.[b], this.c.fade * this.brave(a)); }
  /** a's fear of a place (where they were hurt), 0..1, fading. */
  private waryOf(a: Id, place: Id): number { return this.faded(this.st?.wary[a]?.[place], this.c.fade); }

  /** How much a wants revenge on b: what they hold against them, times vengeance and their temper. */
  vengeance(a: Id, b: Id): number {
    const h = this.held(a, b);
    if (!h) return 0;
    const p = this.w.s.people[a];
    const temper = p ? this.nature(p, 'temper') : this.w.cfg.traitDefault;
    return round(clamp(h * this.knob('vengeance', a) * Math.max(0, 1 + (temper - 0.5) * 2 * this.c.vengeTemper)), 4);
  }

  /** How strongly a believes b did harm (to anyone): their belief that b did it, as harm or as one of the crimes harm is. */
  suspicionOf(a: Id, b: Id): number {
    const rv = this.w.reverie;
    if (!rv) return 0;
    let best = 0;
    for (const k of ['harm', ...Object.values(this.c.crimes)]) {
      const r = rv.beliefRecord(a, `did:${b}:${k}`);
      if (r && r.str >= rv.config.beliefFloor && r.v !== false && r.v !== null) best = Math.max(best, r.str);
    }
    return round(best, 4);
  }

  /** Who someone suspects (or knows) of harm: the people they believe did it, strongest first. */
  suspects(id: Id): Array<{ id: Id; strength: number; to: Value; src: string }> {
    const rv = this.w.reverie;
    if (!rv) return [];
    const kinds = new Set(['harm', ...Object.values(this.c.crimes)]);
    const out: Array<{ id: Id; strength: number; to: Value; src: string }> = [];
    for (const b of rv.beliefs(id)) {
      const [d, who, k] = b.key.split(':');
      if (d !== 'did' || !kinds.has(k) || who === 'someone') continue;
      out.push({ id: who, strength: b.str, to: b.v, src: b.src });
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Might and odds
  // -------------------------------------------------------------------------

  /** The means someone holds (as goods of the same id) that arm them, best first; with a kind, of that kind. */
  private arms(p: PersonState, kind?: string): MeansDef[] {
    const out: MeansDef[] = [];
    for (const m of this.meansDefs.values()) {
      if (!ARMS.includes(m.use ?? '') || this.w.have(p, m.id) <= 0) continue;
      if (kind && !(m.kinds || []).includes(kind)) continue;
      out.push(m);
    }
    return out.sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0) || (a.id < b.id ? -1 : 1));
  }
  private bestMeans(p: PersonState, kind?: string): MeansDef | undefined { return this.arms(p, kind || undefined)[0]; }
  /** How many means that arm them someone holds. */
  armed(p: PersonState): number { return this.arms(p).length; }

  /** Someone's might in a fight: the game's considerations, what they hold, less what they've been hurt. The player's is the game's fact. */
  might(id: Id): number {
    const w = this.w, c = this.c;
    const p = w.s.people[id];
    if (!p) {
      const v = w.s.facts[c.playerMight];
      return typeof v === 'number' && v > 0 ? v : 1;
    }
    let m = 1;
    if (c.might.length) {
      const ctx = w.ctx(p);
      w.peek(() => { for (const k of c.might) m *= w.mind.consider(k, ctx); });
    }
    const arm = this.bestMeans(p);
    if (arm) m *= 1 + (arm.severity ?? 0) * c.meansMight;
    m *= Math.max(0.05, 1 - this.hurt(id) * c.hurtMight);
    return round(Math.max(0.01, m), 4);
  }

  /** a's odds against b: the chance a blow between them is a's, 0..1. */
  odds(a: Id, b: Id): number { const ma = this.might(a), mb = this.might(b); return round(ma / (ma + mb), 4); }

  /** The hurt at which someone yields: yieldAt, sooner for the timid. */
  private yieldAt(p: PersonState): number { const c = this.c; return c.yieldAt * Math.max(0.1, 1 + (this.nature(p, 'courage') - 0.5) * c.yieldCourage); }

  // -------------------------------------------------------------------------
  // Harm
  // -------------------------------------------------------------------------

  /** A stream of Morgul's own: its draws leave people's own streams as they were. */
  private stream(): Stream { const st = this.mut(); return new Stream(this.w.s.seed, 'morgul', st.n++); }

  /** Who's at a place (its outermost), but these. */
  private present(place: Id | null | undefined, but: Array<Id | null | undefined>): Id[] {
    if (!place) return [];
    const w = this.w;
    return w.ring.present(w.ring.root(place)).filter((id) => !but.includes(id)).sort();
  }

  /** The wound a harm leaves: the first declared that fits. */
  private woundFor(kind: string, sev: number, what: string | undefined, via: string): WoundDef | undefined {
    for (const d of this.woundDefs.values()) {
      if (d.kinds && !d.kinds.includes(kind)) continue;
      if (d.at && (sev < d.at[0] - 1e-9 || sev > d.at[1] + 1e-9)) continue;
      if (d.via && !d.via.includes(via)) continue;
      if (d.what !== undefined && !(what !== undefined && (Array.isArray(d.what) ? d.what.includes(what) : d.what === what))) continue;
      return d;
    }
    return undefined;
  }

  /** A harm (from the game, on screen: recorded, and it applies at once). Returns it as it stands, or null if nobody was struck. */
  harm(h: Harm): HarmView | null { return (this.w.input('morgul.harm', [h]) as HarmView | null | undefined) ?? null; }

  /** Records a harm inside the simulation: the body now, the mind now or when it shows. */
  applyHarm(h: Harm & { ex?: number; about?: Id[]; served?: Id[] }): HarmView | null {
    const w = this.w, c = this.c;
    const p = w.s.people[h.to];
    if (!p && h.to !== 'player') return null;
    if (p && p.status !== 'active') return null;
    const st = this.mut();
    const by = h.by ?? null;
    const sev = round(clamp(Number(h.severity ?? 0) || 0), 4);
    const kind = h.kind ?? (h.what ? this.meansDefs.get(h.what)?.kinds?.[0] : undefined) ?? 'harm';
    const via = h.via ?? 'blow';
    const intent: Intent = h.intent ?? (by ? 'meant' : 'accident');
    const place = h.place !== undefined ? h.place : p?.place ?? null;
    const seen = (h.seenBy ?? this.present(place, [h.to, by])).filter((id) => id !== h.to && id !== by && w.s.people[id]?.status === 'active');
    const rec: HarmRec = { id: ++st.ids, t: w.s.now, to: h.to, by, kind, sev, via, intent, place, seen, shown: true };
    if (h.cause) rec.cause = h.cause;
    if (h.what) rec.what = h.what;
    if (h.ex !== undefined) rec.ex = h.ex;
    // who was about (for suspicion of what nobody saw done)
    if (!c.direct.includes(via)) rec.about = h.about ?? this.present(place, [h.to]);
    if (h.served?.length) rec.served = h.served;
    // the body: a wound, an Athelas course carrying the severity
    const ath = w.athelas;
    if (p && ath) {
      const wd = h.course ? undefined : this.woundFor(kind, sev, h.what, via);
      const course = h.course ?? wd?.course;
      if (course && ath.courses.has(course)) {
        const mine = ((st.wounds[p.id] ||= {})[course] ||= { w: wd?.id ?? course, by: [], h: rec.id });
        mine.h = rec.id;
        if (wd) mine.w = wd.id;
        if (by && !mine.by.includes(by)) mine.by.push(by);
        if (ath.applyAfflict(p.id, course, by ?? undefined, sev)) {
          rec.course = course;
          if (wd) rec.wound = wd.id;
          // a course that starts quiet: nobody notices it yet
          if (ath.phaseOf(p.id, course)?.quiet) rec.shown = false;
        } else if (!ath.of(p.id).some((x) => x.course === course)) {
          delete st.wounds[p.id][course];
          if (!hasKeys(st.wounds[p.id])) delete st.wounds[p.id];
        }
      }
    }
    st.harms.push(rec);
    this.prune(st);
    // revenge sated: harm done to someone they held harm against
    if (by && p && st.held[by]?.[p.id] && c.sated > 0) this.hold(by, p.id, -sev * c.sated);
    w.log('harm', h.to, { id: rec.id, by, kind, severity: sev, via, intent, ...(rec.course ? { course: rec.course } : {}), ...(rec.shown ? {} : { quiet: true }) });
    // the mind: now, or when it shows
    if (rec.shown) this.notice(rec);
    const view = this.view(rec);
    w.emit('morgul:harm', view);
    // down, or worse
    if (p) this.check(p, rec);
    // the player in it, face to face: the character answers (not a trap or a dose, which nobody fights)
    if (c.direct.includes(via)) {
      if (by === 'player' && p) this.respondTo(p, 'player', rec);
      else if (h.to === 'player' && by && w.s.people[by]) this.respondTo(w.s.people[by], 'player', rec);
    }
    return { ...view, hurt: p ? this.hurt(p.id) : 0 };
  }

  private view(rec: HarmRec): HarmView {
    const v: HarmView = {
      id: rec.id, t: rec.t, to: rec.to, by: rec.by, kind: rec.kind, severity: rec.sev, via: rec.via, intent: rec.intent,
      place: rec.place, seenBy: rec.seen.slice(), shown: rec.shown, hurt: this.w.s.people[rec.to] ? this.hurt(rec.to) : 0,
    };
    if (rec.cause) v.cause = rec.cause;
    if (rec.what) v.what = rec.what;
    if (rec.wound) v.wound = rec.wound;
    if (rec.course) v.course = rec.course;
    if (rec.ex !== undefined) v.exchange = rec.ex;
    return v;
  }

  /** Harms kept (the last config.recent, and every one not noticed yet), newest last: someone's (as victim or doer), with an id. */
  harms(id?: Id): HarmView[] { return (this.st?.harms || []).filter((r) => !id || r.to === id || r.by === id).map((r) => this.view(r)); }

  private prune(st: State): void {
    const most = Math.max(0, this.c.recent);
    while (st.harms.length > most) {
      const i = st.harms.findIndex((r) => r.shown);
      if (i < 0 || st.harms.length - most <= 0) break;
      st.harms.splice(i, 1);
    }
  }

  /** Changes what a holds against b (negative eases it). */
  private hold(a: Id, b: Id, by: number): void {
    const st = this.mut();
    const s = round(clamp(this.held(a, b) + by), 4);
    const map = (st.held[a] ||= {});
    if (s <= 0) { delete map[b]; if (!hasKeys(map)) delete st.held[a]; } else map[b] = [s, this.w.s.now];
  }
  private frighten(a: Id, b: Id, by: number): void {
    if (!(by > 0)) return;
    const st = this.mut();
    (st.fear[a] ||= {})[b] = [round(clamp(this.fearOf(a, b) + by), 4), this.w.s.now];
  }
  private warn(a: Id, place: Id, by: number): void {
    if (!(by > 0)) return;
    const st = this.mut();
    (st.wary[a] ||= {})[place] = [round(clamp(this.waryOf(a, place) + by), 4), this.w.s.now];
  }

  /**
   * The mind's part of a harm, once it's noticed: the victim's feelings,
   * memory and belief; for a harm they saw done, a grudge, fear and regard;
   * onlookers' beliefs, memories and regard, and a crime; and for harm
   * nobody saw done, suspicion.
   */
  private notice(rec: HarmRec): void {
    const w = this.w, c = this.c, rv = w.reverie;
    const victim = w.s.people[rec.to];
    const share = c.intents[rec.intent] ?? 1;
    const by = rec.by;
    const known = by !== null && c.direct.includes(rec.via);
    const root = rec.place ? w.ring.root(rec.place) : null;
    if (victim) {
      if (rv) {
        rv.applyFeel(victim.id, 'in_pain', rec.kind);
        if (rec.sev >= c.shakenAt) rv.applyFeel(victim.id, 'shaken', rec.kind);
        if (by && share > 0) rv.applyFeel(victim.id, this.nature(victim, 'temper') * 0.6 + this.nature(victim, 'courage') * 0.4 >= c.angerAt ? 'furious' : 'scared', by);
        // (a fight is one memory, not one a blow)
        const again = rec.ex !== undefined && (this.st as State).harms.some((h) => h.ex === rec.ex && h.to === rec.to && h.id < rec.id);
        if (!again) rv.applyRemember(victim.id, { k: 'harmed', about: known ? by as Id : undefined, place: root ?? undefined, imp: c.memory + rec.sev * c.memorySeverity, text: `was hurt${known ? ' by ' + (w.s.people[by as Id]?.name ?? by) : ''}: ${rec.kind}` });
      }
      if (root) this.warn(victim.id, root, rec.sev * c.wary);
      if (known) this.blame(victim.id, by as Id, rec, 1, 'saw', 'felt it');
    }
    // onlookers: a blow in a fight is Bree's to witness
    if (rec.ex === undefined) {
      const crime = known && share > 0 ? c.crimes[rec.intent] : undefined;
      const wt = w.wormtongue;
      if (known && crime && wt?.crimes.has(crime)) {
        wt.sensed({ kind: crime, actor: by as Id, what: rec.to, place: rec.place, seenBy: [...(victim ? [victim.id] : []), ...rec.seen], severity: rec.sev });
      }
      for (const id of rec.seen) {
        if (rv && !(known && crime && wt?.crimes.has(crime))) {
          if (known) rv.applyBelieve(id, `did:${by}:harm`, rec.to, 'saw', null, c.witnessStrength);
          rv.applyRemember(id, { k: 'saw:harm', about: known ? by as Id : rec.to, place: root ?? undefined, imp: c.witnessMemory + rec.sev * c.memorySeverity / 2, text: `saw ${w.s.people[rec.to]?.name ?? rec.to} hurt${known ? ' by ' + (w.s.people[by as Id]?.name ?? by) : ''}` });
          rv.applyFeel(id, 'saw_harm', rec.to);
        }
        if (known && w.fellowship && share > 0) w.fellowship.applyRegard(id, by as Id, round(-rec.sev * c.witnessRegard * share, 4));
      }
    }
    // nobody saw it done: whoever learns of it may suspect someone
    if (by !== null && !known) {
      if (victim) this.suspect(victim.id, rec);
      for (const id of rec.seen) this.suspect(id, rec);
    }
  }

  /**
   * Someone comes to believe `doer` hurt `victim` (as strongly as `str`):
   * the belief; and for the victim, what they hold against them, a grudge
   * (Bree) by the severity and the intent, fear, less regard, a note in
   * their file. A scapegoat is blamed the same way.
   */
  private blame(holder: Id, doer: Id, rec: HarmRec, str: number, src: 'saw' | 'told' | 'assumed', why: string): void {
    const w = this.w, c = this.c, rv = w.reverie;
    const p = w.s.people[holder];
    if (!p || holder === doer) return;
    rv?.applyBelieve(holder, `did:${doer}:harm`, rec.to, src, null, round(clamp(str), 4));
    const share = c.intents[rec.intent] ?? 1;
    if (holder !== rec.to) {
      if (w.fellowship && share > 0) w.fellowship.applyRegard(holder, doer, round(-rec.sev * c.witnessRegard * share * str, 4));
      return;
    }
    const s = rec.sev * share * str;
    if (s <= 0) return;
    this.hold(holder, doer, s);
    const br = w.bree;
    if (br) br.applyGrudge(holder, doer, round(s * c.grudge * br.knob('grudges', holder), 4), 'harm');
    this.frighten(holder, doer, round(s * c.fear * Math.max(0, 1 + (0.5 - this.nature(p, 'courage')) * 2 * c.fearCourage), 4));
    if (w.fellowship) w.fellowship.applyRegard(holder, doer, round(-s * c.regard, 4));
    rv?.applyNote(holder, doer, 'harmed', rec.kind);
    // meant harm between two households can set them feuding
    if (br && c.feud > 0 && rec.intent === 'meant' && w.fellowship) {
      const ha = w.fellowship.household(holder), hb = w.fellowship.household(doer);
      if (ha && hb && ha !== hb) br.applyFeud(ha, hb, br.feudBetween(holder, doer) + rec.sev * c.feud, 'harm');
    }
    w.log('blamed', holder, { by: doer, harm: rec.id, strength: round(str, 4), why });
  }

  /**
   * Someone learns of a harm they didn't see done: whoever they saw set or
   * serve it, they know; otherwise, by chance, they suspect someone, by the
   * evidence (believing they set or served it, having served it, a grudge
   * against the victim, being about), their dislike of them and their
   * liking. It can be wrong.
   */
  private suspect(former: Id, rec: HarmRec): void {
    const w = this.w, c = this.c, rv = w.reverie, fs = w.fellowship;
    const f = w.s.people[former];
    if (!f || f.status !== 'active' || former === rec.by) return;
    const victim = rec.to;
    // they saw it set or dosed: they know
    const act = rec.cause && rv ? rv.beliefRecord(former, this.actKey(rec.cause)) : undefined;
    const heard = act && typeof act.v === 'string' && act.v !== former && act.v !== victim && act.str >= rv!.config.beliefFloor ? act : undefined;
    if (heard && heard.src === 'saw') {
      this.blame(former, heard.v as Id, rec, heard.str, 'saw', 'saw it done');
      this.told(former, heard.v as Id, rec, heard.str, 'saw it done');
      return;
    }
    const r = this.stream();
    const k = this.knob('suspicion', former);
    if (!(k > 0) || !r.chance(clamp(c.suspect * k))) return;
    const cands = new Map<Id, { w: number; why: string }>();
    const add = (id: Id, v: number, why: string) => {
      if (id === former || id === victim || !(v > 0) || w.s.people[id]?.status !== 'active') return;
      const cur = cands.get(id);
      if (!cur) cands.set(id, { w: v, why }); else { cur.w += v; if (v > 0.2) cur.why = why; }
    };
    // (told who did it: evidence, as strong as the telling)
    if (heard) add(heard.v as Id, heard.str * c.suspectTold, 'was told');
    for (const id of rec.served || []) add(id, c.suspectServed, 'served it');
    const br = w.bree;
    if (br) for (const id of Object.keys(w.s.people).sort()) { const a = br.animosity(id, victim); if (a >= 0.05) add(id, a * c.suspectGrudge, 'bore a grudge'); }
    for (const id of rec.about || []) add(id, c.suspectAbout, 'was about');
    const list: Array<{ id: Id; w: number; why: string }> = [];
    for (const [id, v] of cands) {
      const regard = fs ? fs.regard(former, id) : 0;
      const wgt = v.w * (1 + Math.max(0, -regard) * c.suspectSpite) * Math.max(0.1, 1 - Math.max(0, regard) * c.suspectLoyal);
      list.push({ id, w: round(wgt, 6), why: v.why });
    }
    list.sort((a, b) => (a.id < b.id ? -1 : 1));
    const pick = r.weighted(list, (x) => x.w);
    if (!pick || !(pick.w > 0)) return;
    const str = round(Math.min(c.suspectMax, pick.w * c.suspectStrength * k), 4);
    if (str < c.suspectFloor) return;
    this.blame(former, pick.id, rec, str, 'assumed', pick.why);
    this.told(former, pick.id, rec, str, pick.why);
  }

  private told(former: Id, suspect: Id, rec: HarmRec, strength: number, why: string): void {
    this.w.log('suspect', former, { suspect, harm: rec.id, strength, why });
    this.w.emit('morgul:suspect', { id: former, suspect, harm: rec.id, to: rec.to, strength, why, right: suspect === rec.by });
  }

  /** The belief that says who set a trap or dosed a taint. */
  private actKey(cause: string): string { return cause.startsWith('t') ? `set:${cause}` : `dosed:${cause}`; }

  /** After a harm: down past downAt, and at the worst, maybe dead. */
  private check(p: PersonState, rec: HarmRec): void {
    const w = this.w, c = this.c, st = this.mut();
    const hurt = this.hurt(p.id);
    if (hurt >= c.killAt - 1e-9 && w.cradle) {
      const chance = clamp(this.knob('lethality', p.id) * c.deathChance);
      if (chance > 0 && this.stream().chance(chance)) {
        w.clock.schedule({ t: w.s.now, k: 'module', ref: this.name, who: p.id, data: { act: 'kill', harm: rec.id } });
        this.goDown(p, rec, hurt);
        return;
      }
    }
    if (hurt >= c.downAt - 1e-9) {
      if (st.down[p.id]) {
        // a harm while down keeps them down a while longer
        const [lo, hi] = c.downMinutes;
        st.down[p.id].until = round(Math.max(st.down[p.id].until, w.s.now + this.stream().range(lo, hi ?? lo)), 4);
      } else this.goDown(p, rec, hurt);
    }
  }

  private goDown(p: PersonState, rec: HarmRec, hurt: number): void {
    const w = this.w, c = this.c, st = this.mut();
    if (st.down[p.id]) return;
    const [lo, hi] = c.downMinutes;
    st.down[p.id] = { t: w.s.now, until: round(w.s.now + this.stream().range(lo, hi ?? lo), 4) };
    w.log('down', p.id, { harm: rec.id, hurt });
    w.emit('morgul:down', { id: p.id, harm: rec.id, hurt });
    // they stop where they are, just after this
    w.clock.schedule({ t: w.s.now, k: 'module', ref: this.name, who: p.id, data: { act: 'down' } });
  }

  /** Someone gets up: they came round, or someone helped them. */
  private applyUp(p: PersonState, why: string, by?: Id): void {
    const w = this.w, st = this.st;
    if (!st?.down[p.id]) return;
    delete st.down[p.id];
    w.log('up', p.id, { why, ...(by ? { by } : {}) });
    w.emit('morgul:up', { id: p.id, why, by: by ?? null });
    if (p.doing?.action === this.c.down) w.clock.schedule({ t: w.s.now, k: 'module', ref: this.name, who: p.id, data: { act: 'up' } });
  }

  // -------------------------------------------------------------------------
  // Tending
  // -------------------------------------------------------------------------

  /** Someone tends someone (from the game: recorded): their wounds' tended mark (Athelas), and up if they're down. */
  tend(id: Id, by?: Id): void { this.w.input('morgul.tend', [id, by ?? null]); }

  /** Tends inside the simulation: Athelas's mark on their courses (or one), and, from Morgul, up if down, a feeling and a little regard. */
  applyTend(id: Id, by?: Id, course?: Id): void {
    const w = this.w;
    const q = w.athelas ? w.athelas.applyTend(id, course, by) : 0;
    const p = w.s.people[id];
    if (!p || !this.st) return;
    const down = this.isDown(id);
    if (down) this.applyUp(p, 'helped up', by);
    if (by && by !== id && (q > 0 || down)) {
      w.reverie?.applyFeel(id, 'cared_for', by);
      if (w.fellowship && this.c.cared) w.fellowship.applyRegard(id, by, this.c.cared);
    }
  }

  // -------------------------------------------------------------------------
  // Traps
  // -------------------------------------------------------------------------

  /** A trap's kind: its own definition, or a means that's set. */
  private trapDef(kind: Id): (TrapDef & { kind: string; severity: number }) | undefined {
    const t = this.trapDefs.get(kind), m = this.meansDefs.get(kind);
    if (!t && m?.use !== 'set') return undefined;
    return { id: kind, ...(t || {}), kind: t?.kind ?? m?.kinds?.[0] ?? 'trap', severity: t?.severity ?? m?.severity ?? 0.2 };
  }

  /**
   * Sets a trap (from the game: recorded): a kind, at a place, by someone (or
   * nobody), for someone, seen by whoever (default everyone there), and, if
   * the game says, who was about (by its sight: evidence once it springs).
   * Returns its id.
   */
  set(kind: Id, o: { by?: Id | null; place: Id; for?: Id; seenBy?: Id[]; about?: Id[] }): string | null {
    const s: Record<string, unknown> = { by: o.by ?? null, place: o.place, for: o.for ?? null, seenBy: o.seenBy ?? null };
    if (o.about) s.about = o.about;
    return (this.w.input('morgul.set', [kind, s]) as string | null | undefined) ?? null;
  }

  /** Sets a trap inside the simulation. */
  applySet(kind: Id, o: { by: Id | null; place: Id | null; for?: Id; seenBy?: Id[]; about?: Id[] }): string | null {
    const w = this.w;
    const def = this.trapDef(kind);
    if (!def || !o.place || !w.ring.get(o.place)) return null;
    const st = this.mut();
    const id = 't' + ++st.ids;
    const seen = (o.seenBy ?? this.present(o.place, [o.by])).filter((x) => x !== o.by && w.s.people[x]);
    const rec: TrapRec = { id, kind, place: o.place, by: o.by, t: w.s.now, uses: Math.max(1, Math.round(def.uses ?? 1)), known: [] };
    if (o.for && o.for !== o.by) rec.for = o.for;
    if (o.by && w.s.people[o.by]) rec.known.push(o.by);
    // who was about, as the game saw it (whoever set it among them), as a taint keeps it
    if (o.about) { const about = o.about.filter((x) => w.s.people[x]); if (o.by && w.s.people[o.by] && !about.includes(o.by)) about.push(o.by); if (about.length) rec.about = [...new Set(about)].sort(); }
    st.traps[id] = rec;
    // whoever saw it set knows it's there, and who set it
    for (const x of seen) this.learnTrap(x, rec, 'saw', 1);
    w.log('set', o.by ?? undefined, { trap: id, kind, place: o.place, ...(rec.for ? { for: rec.for } : {}) });
    w.emit('morgul:set', { trap: id, kind, place: o.place, by: o.by, for: rec.for ?? null, seenBy: seen });
    return id;
  }

  /** Someone learns a trap is there (and who set it, if they saw it set). */
  private learnTrap(id: Id, rec: TrapRec, src: 'saw' | 'told', str: number): void {
    if (!rec.known.includes(id)) rec.known.push(id);
    const rv = this.w.reverie;
    if (!rv) return;
    rv.applyBelieve(id, `trap:${rec.id}`, rec.place, src, null, str);
    if (src === 'saw' && rec.by) rv.applyBelieve(id, `set:${rec.id}`, rec.by, 'saw', null, str);
  }

  /** Does someone know a trap is there? */
  private knowsTrap(id: Id, rec: TrapRec): boolean {
    if (rec.known.includes(id)) return true;
    const rv = this.w.reverie;
    return !!rv && rv.belief(id, `trap:${rec.id}`) !== undefined;
  }

  /** The traps set (at a place, or everywhere): id, kind, place, who set it, for whom, uses left, who knows. */
  traps(place?: Id): Array<{ id: string; kind: Id; place: Id; by: Id | null; for?: Id; uses: number; t: number; known: Id[] }> {
    const traps = this.st?.traps || {};
    const root = place ? this.w.ring.root(place) : null;
    return Object.keys(traps).sort().map((k) => traps[k]).filter((t) => !root || this.w.ring.root(t.place) === root)
      .map((t) => ({ id: t.id, kind: t.kind, place: t.place, by: t.by, ...(t.for ? { for: t.for } : {}), uses: t.uses, t: t.t, known: t.known.slice() }));
  }

  /**
   * A trap caught someone on screen, or the player (from the game: recorded),
   * seen by whoever (default everyone there), with whoever else was about if
   * the game says (its sight: evidence for suspicion, with whoever was about
   * when it was set).
   */
  spring(trap: string, id: Id, seenBy?: Id[], about?: Id[]): void { this.w.input('morgul.spring', about ? [trap, id, seenBy ?? null, about] : [trap, id, seenBy ?? null]); }

  /** A trap catches someone (or the player), inside the simulation: the harm, and it's spent a use. */
  applySpring(trap: string, id: Id, seenBy?: Id[], about?: Id[]): HarmView | null {
    const w = this.w, st = this.st;
    const rec = st?.traps[trap];
    const p = w.s.people[id];
    if (!rec || (id !== 'player' && (!p || p.status !== 'active'))) return null;
    const def = this.trapDef(rec.kind);
    rec.uses--;
    if (rec.uses <= 0) delete (st as State).traps[trap];
    const seen = seenBy ?? this.present(rec.place, [id]);
    // whoever's there sees it sprung: they know of it now
    if (rec.uses > 0) for (const x of seen) this.learnTrap(x, rec, 'saw', 1);
    else if (w.reverie) for (const x of [...rec.known, ...seen]) w.reverie.applyBelieve(x, `trap:${rec.id}`, false, 'saw');
    w.log('sprung', id, { trap, kind: rec.kind, place: rec.place });
    // who was about, when the game says: when it was set, and now (else, as for any harm, whoever's at the place)
    const near = rec.about || about ? [...new Set([...(rec.about || []), ...(about ?? this.present(rec.place, [id]))])].filter((x) => x !== id).sort() : undefined;
    const view = this.applyHarm({ to: id, by: rec.by, kind: def?.kind ?? 'trap', severity: def?.severity ?? 0.2, via: 'trap', intent: rec.by ? 'meant' : 'accident', cause: trap, what: rec.kind, place: rec.place, seenBy: seen, ...(near ? { about: near } : {}) });
    w.emit('morgul:sprung', { trap, kind: rec.kind, place: rec.place, id, by: rec.by, harm: view?.id ?? null });
    return view;
  }

  /** A trap is disarmed (from the game: recorded), by someone if given. */
  disarm(trap: string, by?: Id): void { this.w.input('morgul.disarm', [trap, by ?? null]); }

  /** Disarms a trap inside the simulation. */
  applyDisarm(trap: string, by?: Id): void {
    const w = this.w, st = this.st;
    const rec = st?.traps[trap];
    if (!rec) return;
    delete (st as State).traps[trap];
    if (by) w.reverie?.applyBelieve(by, `trap:${rec.id}`, false, 'saw');
    w.log('disarmed', by, { trap, kind: rec.kind, place: rec.place });
    w.emit('morgul:disarmed', { trap, kind: rec.kind, place: rec.place, by: by ?? null });
  }

  /** Someone disarms the traps they know of where they are (of a kind, if given). */
  private disarmHere(p: PersonState, kind?: Id): void {
    const st = this.st;
    if (!st || !p.place) return;
    const root = this.w.ring.root(p.place);
    for (const k of Object.keys(st.traps).sort()) {
      const t = st.traps[k];
      if (this.w.ring.root(t.place) !== root || (kind && t.kind !== kind) || !this.knowsTrap(p.id, t)) continue;
      this.applyDisarm(k, p.id);
    }
  }

  /** The regions whose traps the game springs itself, on screen (from the game: recorded). Default: the regions in focus now. */
  near(regions?: string[]): void { this.w.input('morgul.near', [(regions ?? this.w.clock.regionsInFocus()).slice().sort()]); }

  private applyNear(regions: string[]): void {
    if (!this.trapDefs.size && ![...this.meansDefs.values()].some((m) => m.use === 'set') && !this.st) return;
    const st = this.mut();
    const next = [...new Set(regions)].sort();
    if (next.length) st.near = next; else delete st.near;
  }

  /** Is a place near the player: its traps the game's to spring? (As the game last said with near().) */
  nearPlace(place: Id): boolean { const near = this.st?.near; return !!near && near.includes(this.w.ring.region(place)); }

  /** A trap may catch someone who does something at its place, off screen (none for someone who knows). */
  private snare(p: PersonState, place: Id): void {
    const st = this.st;
    if (!st || !hasKeys(st.traps)) return;
    const w = this.w, c = this.c;
    const root = w.ring.root(place);
    for (const k of Object.keys(st.traps).sort()) {
      const t = st.traps[k];
      if (!t || w.ring.root(t.place) !== root) continue;
      if (this.nearPlace(t.place)) continue;
      if (t.for && t.for !== p.id) continue;
      if (t.by === p.id || this.knowsTrap(p.id, t)) continue;
      const def = this.trapDef(t.kind);
      const hidden = def?.hidden !== false;
      const careful = Math.max(0, 1 - (this.nature(p, 'careful') - 0.5) * 2 * c.careful);
      const chance = clamp((def?.catch ?? c.catch) * careful * (hidden ? 1 : c.seenCatch));
      if (chance > 0 && this.stream().chance(chance)) { this.applySpring(k, p.id); return; }
      // one in plain sight is seen by whoever it doesn't catch
      if (!hidden) this.learnTrap(p.id, t, 'saw', 1);
    }
  }

  // -------------------------------------------------------------------------
  // Poison
  // -------------------------------------------------------------------------

  /** Taints food or drink (from the game: recorded): a place's stock of an item, a place's pot (no item), or someone's goods. Returns its id. */
  taint(def: TaintDef): string | null { return (this.w.input('morgul.taint', [def]) as string | null | undefined) ?? null; }

  /** The holder of a person's goods: their household, if it shares a pantry (Ceres), else themselves. */
  private holderOf(id: Id): Id {
    const ce = this.w.ceres;
    const purse = ce?.purseOf(id);
    return purse && purse.kind === 'household' ? purse.id : id;
  }

  /** Taints inside the simulation. */
  applyTaint(def: TaintDef): string | null {
    const w = this.w, ath = w.athelas;
    if (!ath?.courses.has(def.course)) return null;
    if (!def.place && !def.person && !def.owner) return null;
    const st = this.mut();
    const id = 'x' + ++st.ids;
    const rec: TaintRec = { id, course: def.course, n: Math.max(1, Math.round(def.n ?? 1)), t: w.s.now, known: [] };
    if (def.place) rec.place = def.place;
    else rec.owner = def.owner ?? this.holderOf(def.person as Id);
    if (def.item) rec.item = def.item;
    if (def.by) { rec.by = def.by; if (w.s.people[def.by]) rec.known.push(def.by); }
    if (def.for) rec.for = def.for;
    if (def.severity !== undefined) rec.sev = round(clamp(def.severity), 4);
    if (def.what) rec.what = def.what;
    // who was about when it was done (whoever did it among them): for suspicion later
    if (def.place) { const about = this.present(def.place, []); if (def.by && w.s.people[def.by] && !about.includes(def.by)) about.push(def.by); if (about.length) rec.about = about.sort(); }
    st.taints[id] = rec;
    // whoever saw it done knows: that it's tainted, and who did it
    const seen = (def.seenBy ?? (def.place ? this.present(def.place, [def.by]) : [])).filter((x) => x !== def.by && w.s.people[x]);
    const rv = w.reverie;
    for (const x of seen) {
      rec.known.push(x);
      if (!rv) continue;
      if (def.by) rv.applyBelieve(x, `dosed:${id}`, def.by, 'saw', null, 1);
      if (def.place) rv.applyBelieve(x, `tainted:${w.ring.root(def.place)}`, true, 'saw', null, 1);
    }
    w.log('tainted', def.by, { taint: id, course: def.course, ...(def.place ? { place: def.place } : { owner: rec.owner }), ...(def.item ? { item: def.item } : {}), n: rec.n });
    w.emit('morgul:tainted', { taint: id, course: def.course, place: rec.place ?? null, owner: rec.owner ?? null, item: rec.item ?? null, n: rec.n, by: rec.by ?? null, for: rec.for ?? null, seenBy: seen });
    return id;
  }

  /** The taints (at a place, or everywhere): where, what, how many servings, by whom, for whom. */
  taints(place?: Id): Array<{ id: string; course: Id; n: number; place?: Id; owner?: Id; item?: Id; by?: Id; for?: Id; t: number }> {
    const taints = this.st?.taints || {};
    const root = place ? this.w.ring.root(place) : null;
    return Object.keys(taints).sort().map((k) => taints[k]).filter((x) => !root || (x.place && this.w.ring.root(x.place) === root))
      .map((x) => ({ id: x.id, course: x.course, n: x.n, t: x.t, ...(x.place ? { place: x.place } : {}), ...(x.owner ? { owner: x.owner } : {}), ...(x.item ? { item: x.item } : {}), ...(x.by ? { by: x.by } : {}), ...(x.for ? { for: x.for } : {}) }));
  }

  /** The poison's severity: the taint's own, else its means', else config.dose. */
  private doseOf(rec: TaintRec): { sev: number; kind: string; what?: Id } {
    let means: MeansDef | undefined;
    for (const m of this.meansDefs.values()) if (m.course === rec.course) { means = m; break; }
    return { sev: rec.sev ?? means?.severity ?? this.c.dose, kind: means?.kinds?.[0] ?? 'poison', what: rec.what ?? means?.id ?? rec.item };
  }

  /** Tainted servings move with the goods, and afflict whoever eats them: an action just started. */
  private eat(p: PersonState, d: Doing): void {
    const st = this.st;
    if (!st || !hasKeys(st.taints) || !d.place) return;
    const w = this.w, c = this.c, ce = w.ceres;
    const a = w.actions.get(d.action);
    if (!a) return;
    const root = w.ring.root(d.place);
    const ids = Object.keys(st.taints).sort();
    const r = (): Stream => this.stream();
    // bought from a place: tainted servings go home with them
    if (a.buys && ce) for (const item of Object.keys(a.buys)) {
      const n = a.buys[item];
      for (const k of ids) {
        const t = st.taints[k];
        if (!t || t.item !== item || !t.place || w.ring.root(t.place) !== root || (t.for && t.for !== p.id)) continue;
        const before = ce.stock(t.place, item) + n;
        const moved = this.draw(t, n, before, p.id, r);
        if (moved > 0) this.move(t, moved, this.holderOf(p.id));
      }
    }
    // eaten: from a store's stock, from their own goods, or from the place's pot
    const eaten: Array<{ t: TaintRec; hits: number }> = [];
    if (a.uses) for (const item of Object.keys(a.uses)) {
      const n = a.uses[item];
      const store = a.store && ce ? ce.storeOf(a, d.place) : null;
      for (const k of ids) {
        const t = st.taints[k];
        if (!t || t.item !== item || (t.for && t.for !== p.id)) continue;
        let before: number;
        if (store) { if (!t.place || t.place !== store) continue; before = (ce as NonNullable<typeof ce>).stock(store, item) + n; }
        else { if (!t.owner || t.owner !== this.holderOf(p.id)) continue; before = w.have(p, item) + n; }
        const hits = this.draw(t, n, before, p.id, r);
        if (hits > 0) eaten.push({ t, hits });
      }
    }
    if (a.tags?.some((tag) => c.eats.includes(tag))) for (const k of ids) {
      const t = st.taints[k];
      if (!t || t.item || !t.place || w.ring.root(t.place) !== root || (t.for && t.for !== p.id)) continue;
      t.n--;
      eaten.push({ t, hits: 1 });
    }
    for (const { t, hits } of eaten) {
      if (t.n <= 0) delete st.taints[t.id];
      const dose = this.doseOf(t);
      const place: Id = d.place;
      // who served it: the place's owner, and whoever's on shift there
      const served: Id[] = [];
      const owner = w.ring.get(place)?.owner;
      if (owner && w.s.people[owner] && owner !== p.id) served.push(owner);
      for (const id of this.present(place, [p.id])) { const q = w.s.people[id]; if (q.doing?.layer === 'job' && !served.includes(id)) served.push(id); }
      // who was about: when it was done, and now
      const about = [...new Set([...(t.about || []), ...this.present(place, [p.id])])].filter((id) => id !== p.id).sort();
      this.applyHarm({ to: p.id, by: t.by ?? null, kind: dose.kind, severity: Math.min(1, dose.sev * hits), via: 'dose', intent: t.by ? 'meant' : 'accident', cause: t.id, what: dose.what, place, seenBy: [], course: t.course, served: served.sort(), about });
    }
  }

  /** How many of n servings taken from `before` are tainted: drawn one at a time (all of them for whoever it's for). Takes them off the taint. */
  private draw(t: TaintRec, n: number, before: number, who: Id, r: () => Stream): number {
    let hits = 0, left = Math.max(n, before);
    for (let i = 0; i < n && t.n > 0; i++) {
      if (t.for === who || r().chance(t.n / Math.max(1, left))) { hits++; t.n--; }
      left--;
    }
    return hits;
  }

  /** Tainted servings move into someone's goods: a taint of their own, carried on. */
  private move(t: TaintRec, n: number, owner: Id): void {
    const st = this.mut();
    const same = Object.keys(st.taints).sort().map((k) => st.taints[k]).find((x) => x.owner === owner && x.item === t.item && x.course === t.course && x.by === t.by && x.for === t.for && x.sev === t.sev);
    if (same) { same.n += n; return; }
    const id = 'x' + ++st.ids;
    const rec: TaintRec = { ...t, id, owner, n, t: this.w.s.now, known: t.by && this.w.s.people[t.by] ? [t.by] : [] };
    delete rec.place;
    st.taints[id] = rec;
    // whoever saw it dosed still knows who did it
    const rv = this.w.reverie;
    if (rv && t.by) for (const x of t.known) if (x !== t.by && rv.belief(x, `dosed:${t.id}`) !== undefined) rv.applyBelieve(x, `dosed:${id}`, t.by, 'saw', null, 1);
    if (t.n <= 0) delete st.taints[t.id];
  }

  // -------------------------------------------------------------------------
  // Fights by numbers
  // -------------------------------------------------------------------------

  /** Is a Bree kind a fight by numbers? (Only once Morgul has been given a wound.) */
  fights(kind: Id): boolean {
    if (!this.woundDefs.size) return false;
    const def = this.w.bree?.kinds.get(kind);
    return this.c.fights.some((f) => f === kind || (f.startsWith('tag:') && !!def?.tags?.includes(f.slice(4))));
  }

  /** The most blows a fight runs to. */
  get blows(): number { return Math.max(1, Math.round(this.c.blows)); }

  /**
   * A turn of a fight by numbers (Bree calls this): a blow lands one way or
   * the other, by the odds; the harm follows; the fight ends if the one
   * struck goes down or yields.
   */
  applyBlow(ex: number, starter: Id, a: PersonState, b: PersonState, place: Id | null, seenBy: Id[]): Blow | null {
    const w = this.w, c = this.c;
    if (!this.woundDefs.size) return null;
    const r = this.stream();
    const [by, to] = r.chance(this.odds(a.id, b.id)) ? [a, b] : [b, a];
    const arm = this.bestMeans(by);
    const base = c.fist + (arm?.severity ?? 0) * c.meansBlow;
    const sev = round(clamp(base * (1 + (r.next() * 2 - 1) * c.blowSpread)), 4);
    const kind = arm?.kinds?.[0] ?? c.fistKind;
    const view = this.applyHarm({ to: to.id, by: by.id, kind, severity: sev, via: 'blow', intent: by.id === starter ? 'meant' : 'defense', what: arm?.id, place, seenBy, ex });
    if (!view) return null;
    const blow: Blow = { id: view.id, by: by.id, to: to.id, kind, severity: sev, hurt: view.hurt };
    if (arm) blow.what = arm.id;
    const give = this.yieldAt(to);
    if (this.isDown(to.id)) blow.end = 'down';
    else if (view.hurt >= give) {
      blow.end = 'yielded';
      w.log('yielded', to.id, { to: by.id, hurt: view.hurt });
    } else if (r.chance(clamp(c.walkOff * view.hurt / Math.max(0.01, give)))) blow.end = 'left';
    return blow;
  }

  // -------------------------------------------------------------------------
  // Fights with the player
  // -------------------------------------------------------------------------

  /** How someone would answer a fight with someone (the player, by default) now: fight back, flee, yield or call for help. A look. */
  respond(id: Id, against: Id = 'player'): Response | null {
    const p = this.w.s.people[id];
    if (!p) return null;
    const st = this.st;
    const start = !st || st.pf[id] === undefined || this.w.s.now - st.pf[id] > this.c.fightGap;
    return this.w.peek(() => this.answer(p, against, this.w.worldStreamPeek('respond', id, this.w.s.now), start));
  }

  private answer(p: PersonState, against: Id, r: Stream, start: boolean): Response {
    const w = this.w, c = this.c, fs = w.fellowship;
    const odds = this.odds(p.id, against), hurt = this.hurt(p.id);
    const courage = this.nature(p, 'courage'), temper = this.nature(p, 'temper');
    const give = this.yieldAt(p);
    const help = this.present(p.place, [p.id, against]).filter((id) => (fs ? fs.regard(id, p.id) : 0) >= c.helpFrom && !this.isDown(id));
    const m = (k: string): number => c.respond[k] ?? 1;
    const weights: Record<string, number> = {
      fight: round(m('fight') * (0.25 + courage) * (0.5 + temper) * odds * 2 * Math.max(0, 1 - hurt / Math.max(0.05, give)), 4),
      flee: round(m('flee') * (1.25 - courage) * (1 - odds) * (0.5 + hurt), 4),
      yield: round(m('yield') * (hurt >= give ? 2 * (1.25 - courage) : 0.2 * (1 - courage)), 4),
      help: round(m('help') * (help.length ? (1 - odds) * (0.5 + Math.min(1, help.length / 2)) : 0), 4),
    };
    const acts = ['fight', 'flee', 'yield', 'help'] as const;
    const act = r.weighted(acts.slice(), (k) => weights[k]) ?? 'fight';
    const out: Response = { id: p.id, to: against, act, odds, hurt, start, weights };
    if (act === 'help') out.help = help;
    return out;
  }

  /** A character in a fight with the player answers (after each harm between them): emitted, and fleeing makes them want to get away. */
  private respondTo(p: PersonState, against: Id, _rec: HarmRec): void {
    const w = this.w, c = this.c, st = this.mut();
    const start = st.pf[p.id] === undefined || w.s.now - st.pf[p.id] > c.fightGap;
    st.pf[p.id] = w.s.now;
    if (p.status !== 'active') return;
    const res = this.answer(p, against, this.stream(), start);
    w.log('respond', p.id, { to: against, act: res.act, odds: res.odds });
    w.emit('morgul:respond', res);
    if (res.act === 'flee' && !this.isDown(p.id)) {
      st.flee[p.id] = round(w.s.now + c.fleeMinutes, 4);
      w.clock.schedule({ t: w.s.now, k: 'module', ref: this.name, who: p.id, data: { act: 'flee' } });
    }
  }

  // -------------------------------------------------------------------------
  // Danger
  // -------------------------------------------------------------------------

  /** How dangerous someone believes a place is: a trap or a taint they know of there, or a place they were hurt. */
  danger(id: Id, place: Id | null | undefined): number {
    if (!place || !this.st) return 0;
    const root = this.w.ring.root(place);
    const map = this.dangers(id);
    return round(Math.max(map.get(root) ?? 0, this.waryOf(id, root)), 4);
  }

  /** The places someone knows of a trap or a taint at, worked out once a moment. */
  private dangers(id: Id): Map<Id, number> {
    const w = this.w, st = this.st as State;
    const hit = this.dangerCache;
    if (hit && hit.id === id && hit.now === w.s.now && hit.seq === w.s.seq && hit.n === st.n + st.ids) return hit.map;
    const map = new Map<Id, number>();
    const put = (place: Id, v: number) => { const root = w.ring.root(place); map.set(root, Math.max(map.get(root) ?? 0, v)); };
    for (const k of Object.keys(st.traps)) { const t = st.traps[k]; if (t.known.includes(id)) put(t.place, 1); }
    for (const k of Object.keys(st.taints)) { const t = st.taints[k]; if (t.place && t.known.includes(id) && t.by !== id) put(t.place, 1); }
    const rv = w.reverie;
    if (rv) for (const b of rv.beliefs(id)) {
      if (b.key.startsWith('trap:') && typeof b.v === 'string') put(b.v, b.str);
      else if (b.key.startsWith('tainted:') && b.v === true) put(b.key.slice(8), b.str);
    }
    this.dangerCache = { id, now: w.s.now, seq: w.s.seq, n: st.n + st.ids, map };
    return map;
  }

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------

  /** Athelas asks: how fast a course runs for someone (a wound heals at the healing knob's pace). */
  paceOf(p: PersonState, course: Id): number {
    if (!this.st?.wounds[p.id]?.[course]) return 1;
    return 1 / Math.max(0.01, this.knob('healing', p.id));
  }

  /** Athelas asks, as a phase that ends in death runs out: are they spared? A wound kills only as often as lethality says. */
  spares(p: PersonState, course: Id): boolean {
    const wound = this.st?.wounds[p.id]?.[course];
    if (!wound) return false;
    const chance = clamp(this.knob('lethality', p.id));
    const dies = chance > 0 && (chance >= 1 || this.stream().chance(chance));
    if (!dies) { this.w.log('spared', p.id, { course }); return true; }
    this.w.emit('morgul:killed', { id: p.id, by: wound.by[wound.by.length - 1] ?? null, harm: wound.h });
    return false;
  }

  /** Athelas tells: a course's phase that tells has started, so whatever harm it was is noticed now. */
  showed(p: PersonState, course: Id): void {
    const st = this.st;
    if (!st) return;
    for (const rec of st.harms) {
      if (rec.shown || rec.to !== p.id || rec.course !== course) continue;
      rec.shown = true;
      // whoever's about sees them taken ill: they're the onlookers now
      rec.seen = this.present(p.place, [p.id, rec.by]).filter((id) => this.w.s.people[id]?.status === 'active');
      this.w.log('noticed', p.id, { harm: rec.id, course });
      this.notice(rec);
    }
    this.prune(st);
  }

  /** Athelas tells: a course passed or was cured; a wound it was is healed. */
  healed(p: PersonState, course: Id): void {
    const st = this.st;
    const mine = st?.wounds[p.id];
    if (!mine?.[course]) return;
    delete mine[course];
    if (!hasKeys(mine)) delete (st as State).wounds[p.id];
    this.w.log('healed', p.id, { course });
  }

  candidates(p: PersonState, out: Candidate[]): void {
    const st = this.st;
    if (!st) return;
    const w = this.w, c = this.c;
    // down: they lie there
    const down = st.down[p.id];
    if (down) {
      if (w.actions.has(c.down)) out.push({ id: c.down, kind: 'action', place: p.place, rank: c.downRank, layer: 'down', weight: 0, parts: [], minutes: round(Math.max(1, down.until - w.s.now), 4) });
      return;
    }
    // in a fight by numbers: they fight
    if (w.actions.has(c.fighting) && this.inFight(p.id)) out.push({ id: c.fighting, kind: 'action', place: p.place, rank: c.fightRank, layer: 'fight', weight: 0, parts: [] });
    // revenge: the game's task, aimed at whoever they want it on enough
    const held = st.held[p.id];
    if (held && w.tasks.get(c.avenge)?.target === 'person') {
      const list = Object.keys(held).sort().map((id) => ({ id, v: this.vengeance(p.id, id) })).filter((x) => x.v >= c.vengeAt && w.s.people[x.id]?.status === 'active');
      list.sort((x, y) => y.v - x.v || (x.id < y.id ? -1 : 1));
      for (const x of list.slice(0, 2)) out.push({ id: c.avenge, kind: 'task', place: null, target: x.id, rank: 0, layer: 'need', weight: 0, parts: [] });
    }
  }

  block(p: PersonState, cand: Candidate): string | null {
    const st = this.st;
    if (!st?.down[p.id]) return null;
    return cand.id === this.c.down ? null : 'down';
  }

  consider(p: PersonState, cand: Candidate): Array<[string, number]> | void {
    if (!this.used) return;
    const w = this.w, c = this.c, st = this.st;
    const def = cand.kind === 'task' ? w.tasks.get(cand.id) : w.actions.get(cand.id);
    const tags = def?.tags;
    const out: Array<[string, number]> = [];
    const name = (id: Id): string => w.s.people[id]?.name ?? id;
    const harmful = !!tags?.includes(c.harmTag);
    // violence: how readily they do harm at all
    if (harmful) { const v = this.knob('violence', p.id); if (v !== 1) out.push(['violence', round(v, 4)]); }
    if (!st) return out;
    // revenge: the task aimed at whoever they want it on, and harm aimed at them
    if (cand.target && (harmful || (cand.kind === 'task' && cand.id === c.avenge))) {
      const v = this.vengeance(p.id, cand.target);
      if (cand.kind === 'task' && cand.id === c.avenge) out.push([`revenge on ${name(cand.target)}`, round(Math.max(0.01, v * c.vengePull), 4)]);
      else if (v > 0) out.push([`revenge on ${name(cand.target)}`, round(1 + v * c.vengePull, 4)]);
    }
    // care: tending someone hurt (or down)
    if (cand.target && tags?.includes(c.careTag)) {
      const h = this.hurt(cand.target) + (this.isDown(cand.target) ? 0.5 : 0);
      if (h > 0) {
        const regard = w.fellowship ? Math.max(0, w.fellowship.regard(p.id, cand.target)) : 0;
        out.push([`tending ${name(cand.target)}`, round(1 + h * c.carePull * (0.5 + regard), 4)]);
      }
    }
    const place = cand.place ?? p.place;
    if (place) {
      // caution: a place they know is dangerous
      const d = this.danger(p.id, place);
      if (d > 0) { const k = this.knob('caution', p.id); if (k > 0) out.push(['danger', round(Math.max(c.floor, 1 - d * c.cautionPlace * k), 4)]); }
      // flight: someone they fear, with poor odds against them, is there
      const f = this.feared(p.id, place);
      if (f) out.push([`afraid of ${name(f.id)}`, round(Math.max(c.floor, 1 - f.v * c.fleePlace), 4)]);
    }
    // getting away: fleeing, when someone they fear is where they are (or they chose to flee)
    if (tags?.includes(c.fleeTag)) {
      const v = this.fleeing(p);
      if (v > 0) out.push(['getting away', round(1 + v * c.fleePull, 4)]);
    }
    return out;
  }

  /** How much someone wants to get away: someone they fear is where they are (fear times poor odds, past fleeAt), or they chose to flee (1). */
  fleeing(p: PersonState): number {
    const st = this.st;
    if (!st) return 0;
    if ((st.flee[p.id] ?? -Infinity) > this.w.s.now) return 1;
    return p.place ? this.feared(p.id, p.place)?.v ?? 0 : 0;
  }

  /** The one someone fears most at a place (fear times poor odds), if it's enough to want to leave. */
  private feared(id: Id, place: Id): { id: Id; v: number } | null {
    const st = this.st;
    const fears = st?.fear[id];
    if (!fears) return null;
    const w = this.w, root = w.ring.root(place);
    let best: { id: Id; v: number } | null = null;
    for (const o of Object.keys(fears).sort()) {
      const q = w.s.people[o];
      if (!q || q.status !== 'active' || !q.place || q.doing?.kind === 'travel' || w.ring.root(q.place) !== root) continue;
      const v = this.fearOf(id, o) * (1 - this.odds(id, o));
      if (v >= this.c.fleeAt && (!best || v > best.v)) best = { id: o, v: round(v, 4) };
    }
    return best;
  }

  /** Someone starts something: a trap there may catch them, and what they eat may be tainted. */
  started(p: PersonState, d: Doing): void {
    if (d.kind !== 'act' || !d.place || !this.st) return;
    if (d.action === this.c.down || d.action === this.c.fighting) return;
    this.eat(p, d);
    if (p.status === 'active' && p.doing === d) this.snare(p, d.place);
  }

  /** Lying down ran its course: they come round. */
  ended(p: PersonState, d: Doing, _frac: number, interrupted: boolean): void {
    if (d.kind !== 'act' || d.action !== this.c.down || interrupted) return;
    const st = this.st;
    if (st?.down[p.id] && st.down[p.id].until <= this.w.s.now + 1e-6) this.applyUp(p, 'came round');
  }

  /** People meet: fear may send someone away; someone who knows of a trap or a taint set for the other warns them. */
  met(a: PersonState, b: PersonState): void {
    const st = this.st;
    if (!st) return;
    const now = this.w.s.now;
    for (const [x, y] of [[a, b], [b, a]] as const) {
      // (once a while: someone who's thought again, and stayed, isn't sent off again at every meeting)
      if (st.fear[x.id]?.[y.id] && !st.down[x.id] && x.place && !((st.flee[x.id] ?? -Infinity) > now)) {
        const f = this.feared(x.id, x.place);
        if (f && f.id === y.id) {
          st.flee[x.id] = round(now + this.c.fleeMinutes, 4);
          this.w.clock.schedule({ t: now, k: 'module', ref: this.name, who: x.id, data: { act: 'afraid' } });
        }
      }
      this.warnOf(x, y);
    }
  }

  /** x warns y of a trap or taint set for y that x knows of, if fond enough of them. */
  private warnOf(x: PersonState, y: PersonState): void {
    const st = this.st as State, w = this.w, rv = w.reverie;
    if (!rv || !w.fellowship) return;
    const fond = w.fellowship.regard(x.id, y.id) >= this.c.warnAt;
    if (!fond) return;
    for (const k of Object.keys(st.traps).sort()) {
      const t = st.traps[k];
      if (t.for !== y.id || t.by === x.id || !this.knowsTrap(x.id, t) || this.knowsTrap(y.id, t)) continue;
      this.learnTrap(y.id, t, 'told', 0.9);
      w.log('warned', x.id, { to: y.id, trap: t.id });
    }
    for (const k of Object.keys(st.taints).sort()) {
      const t = st.taints[k];
      if (t.for !== y.id || !t.place || t.by === x.id || !t.known.includes(x.id) || t.known.includes(y.id)) continue;
      t.known.push(y.id);
      rv.applyBelieve(y.id, `tainted:${w.ring.root(t.place)}`, true, 'told', x.id, 0.9);
      w.log('warned', x.id, { to: y.id, taint: t.id });
    }
  }

  timer(item: QueueItem): void {
    const w = this.w;
    const p = item.who ? w.s.people[item.who] : undefined;
    if (!p || p.status !== 'active') return;
    const act = String(item.data?.act ?? '');
    if (act === 'kill') {
      const cr = w.cradle;
      if (!cr) return;
      const rec = this.st?.harms.find((h) => h.id === Number(item.data?.harm));
      const by = rec?.by ?? null;
      w.emit('morgul:killed', { id: p.id, by, harm: rec?.id ?? null });
      w.log('killed', p.id, { by, harm: rec?.id ?? null });
      // a killing is a crime of its own, for whoever saw it done
      const crime = this.c.crimes.killed;
      const wt = w.wormtongue;
      if (rec && by && crime && wt?.crimes.has(crime) && this.c.direct.includes(rec.via)) wt.sensed({ kind: crime, actor: by, what: p.id, place: rec.place, seenBy: rec.seen, severity: 1 });
      // whoever knew them and believes who did it remembers it
      const rv = w.reverie, fs = w.fellowship;
      if (rec && by && rv) for (const o of w.people()) {
        if (o.id === p.id || o.id === by) continue;
        const saw = rec.seen.includes(o.id) && this.c.direct.includes(rec.via);
        if (!saw && !(fs?.knows(o.id, p.id) && this.suspicionOf(o.id, by) > 0)) continue;
        rv.applyRemember(o.id, { k: 'killed', about: by, imp: 9, text: `${w.s.people[by]?.name ?? by} killed ${p.name}` });
      }
      cr.applyDepart(p.id, 'killed');
      return;
    }
    if (act === 'down') {
      if (!this.isDown(p.id)) return;
      w.bree?.applyEnd(p.id);
      w.clock.rethink(p, 'down');
      return;
    }
    // a fight: they stop to fight, while it lasts
    if (act === 'fight') {
      if (this.isDown(p.id) || !this.inFight(p.id) || p.doing?.action === this.c.fighting) return;
      w.clock.rethink(p, 'a fight');
      return;
    }
    // came round, fleeing, afraid, the fight's over: they think again
    if (act === 'up' || act === 'flee' || act === 'afraid' || act === 'fought') {
      if (act === 'up' && p.doing?.action !== this.c.down) return;
      if (act === 'fought' && (p.doing?.action !== this.c.fighting || this.inFight(p.id))) return;
      if (this.isDown(p.id)) return;
      w.clock.rethink(p, act === 'up' ? 'got up' : act === 'flee' ? 'getting away' : act === 'fought' ? 'the fight is over' : 'afraid');
    }
  }

  day(): void {
    const st = this.st;
    if (!st) return;
    const w = this.w, floor = 0.02;
    for (const [map, read] of [[st.held, (a: Id, b: Id) => this.held(a, b)], [st.fear, (a: Id, b: Id) => this.fearOf(a, b)], [st.wary, (a: Id, b: Id) => this.waryOf(a, b)]] as const) {
      for (const a of Object.keys(map)) {
        for (const b of Object.keys(map[a])) if (read(a, b) < floor) delete map[a][b];
        if (!hasKeys(map[a])) delete map[a];
      }
    }
    // wounds whose courses have run out
    const ath = w.athelas;
    for (const id of Object.keys(st.wounds)) {
      for (const course of Object.keys(st.wounds[id])) if (!ath || ath.severityOf(id, course) === undefined) delete st.wounds[id][course];
      if (!hasKeys(st.wounds[id])) delete st.wounds[id];
    }
    for (const id of Object.keys(st.flee)) if (st.flee[id] <= w.s.now) delete st.flee[id];
    for (const id of Object.keys(st.pf)) if (w.s.now - st.pf[id] > DAY) delete st.pf[id];
  }

  removed(p: PersonState): void {
    const st = this.st;
    if (!st) return;
    delete st.wounds[p.id];
    delete st.down[p.id];
    delete st.flee[p.id];
    delete st.pf[p.id];
    for (const map of [st.held, st.fear]) {
      delete map[p.id];
      for (const a of Object.keys(map)) { delete map[a][p.id]; if (!hasKeys(map[a])) delete map[a]; }
    }
    delete st.wary[p.id];
    for (const k of Object.keys(st.taints)) if (st.taints[k].owner === p.id) delete st.taints[k];
  }
}

/** Food or drink tainted: a place's stock of an item (or its pot, with none), or someone's goods. */
export interface TaintDef {
  /** The course whoever eats it gets (an Athelas course: a quiet phase, then one that tells). */
  course: Id;
  /** Where: a place's stock (or pot)... */
  place?: Id;
  /** ...or someone's goods (their household's pantry, if they share one)... */
  person?: Id;
  /** ...or a holder's, by id (a person or a household). */
  owner?: Id;
  /** The good tainted; none: a place's pot, whatever's eaten there next. */
  item?: Id;
  /** How many servings. Default 1. */
  n?: number;
  /** Who did it. */
  by?: Id;
  /** Who it's meant for: only they get it (the meal they'll eat). */
  for?: Id;
  /** How bad, 0..1. Default: its means', or config.dose. */
  severity?: number;
  /** What it was (a means). */
  what?: Id;
  /** Who saw it done. Default: everyone at the place but whoever did it. */
  seenBy?: Id[];
}
