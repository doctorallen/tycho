// Voice: branching conversations. Named for the Voice of Dune, the
// Bene Gesserit's art of saying the right thing in the right way.
//
// Beside Cityspeak's single lines, Voice runs a talk: a run of threads,
// each a few beats about one subject. A beat is something they say and two
// or three answers; each answer has an approach (warm, jest, ask...: the
// game names its own) that lands well or badly with whoever's listening, by
// their nature and how things stand. An answer leads to another beat, or to
// the end of the subject, and on the way it can change things: feelings,
// regard, beliefs, something the speaker learns about them, a promise to be
// kept. "Let it lie" drops a subject, goodbye ends the talk, and everyone's
// patience runs out in the end. Which subjects come up is weighed from the
// person's real state, how lately each was talked of, and what's still to
// learn; now and then they raise something of their own. Merryfolk's talks
// with the wizard, generalized.
//
// The words are the game's: a beat names a line topic, and Cityspeak's
// chooser picks the most specific line for it (passing over lines said to
// this listener lately), or the beat carries its own words. Talks are state
// (world.s.mod.voice), every choice is an input that Esper records, and the
// draws come from streams of the talk itself, so a replay says the same.
// The state is made with the first talk.
//
// What a pair keeps is a bond: their talks and what the speaker has learned
// about them, which make them familiar. A game can have that count: someone
// who knows the speaker takes what's said better (familiarLand), an answer
// or a subject can recall something learned (`recalls`: offered only once
// it's known, and landing better), and the words can say it
// ({learned.<key>}).
//
// A game can have a talk follow itself, too: a subject can open the talk
// (`opens`: their greeting is its first beat, with answers, so what they
// say first can be answered), and subjects can say what they're about
// (`about`), so that the ones sharing a topic with what was just said are
// offered first (followPull).
import type { Module } from '../core/module';
import type { Cond, Ctx, Effect, Id, PersonState, Value } from '../core/types';
import type { World } from '../core/world';
import { DAY, Stream, clamp, round } from '../core/util';
import { landing } from './landing';
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
  to?: string | Array<{ if?: Cond[]; landed?: 'well' | 'badly' | 'even'; warmth?: number; to: string }>;
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
  /**
   * They open the talk with it: when one can (its `if` holds, not talked of
   * within its cooldown), its first beat is their greeting, with answers,
   * in place of the plain one (one drawn by weight, if several can). It's
   * never offered.
   */
  opens?: boolean;
  /** What it's about: once it's talked of, subjects sharing a topic with it are offered first (config.followPull). */
  about?: string[];
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
  /** Effects when it's kept (the one promised to as the person, the one who promised as target). */
  onKept?: Effect[];
  /** Effects when it's broken. */
  onBroken?: Effect[];
  /** Effects when it comes due neither kept nor broken. */
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

  // The finer numbers.
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
  /** Variety drawn afresh each time the subjects are offered (each talk, and each return to them), not once a day. Default false. */
  reshuffle: boolean;
  /** A subject sharing a topic (`about`) with the one just talked of is worth this much more. Default 1 (it doesn't count). */
  followPull: number;
  /** Days before a promise comes due, for a promise with no `days`. Default 3. */
  promiseDays: number;
  /** Days a settled promise is remembered (the `promise:` term reads it). Default 30. */
  promiseKeep: number;
}

export const DEFAULT_VOICE: VoiceConfig = {
  offers: 3, choices: 3, theirs: 0.3, patience: 8, fresh: 7 * DAY, strong: 2, onWell: [], onBadly: [],
  greet: 'greet', bye: 'bye', close: 'close', react: 'react', deed: null,
  chatter: 1,
  warmthRegard: 3, warmthMin: -1, warmthMax: 3, familiarTalk: 0.5, familiarLearned: 1, familiarLand: 0, familiarLandMax: 1, recallLand: 1, cooldown: 3 * DAY, soreDays: 2, soreWeight: 0.1,
  revealPull: 1.5, salientFloor: 0.05, variety: 0.2, reshuffle: false, followPull: 1, promiseDays: 3, promiseKeep: 30,
};

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
  thread: { id: Id; label: string; beat: string; theirs: boolean } | null;
  /** What was said since the last choice. */
  lines: TalkLine[];
  answers: Array<TalkOption & { i: number }>;
  warmth: number;
  patience: number;
  /** How the last approach landed. */
  landed: 'well' | 'badly' | 'even' | null;
  /** They've had enough: only goodbye is left. */
  over: boolean;
  /** The talk has ended. */
  ended: boolean;
}

interface Talk {
  who: Id; by: Id; t: number; n: number;
  warmth: number; patience: number;
  thread?: { id: Id; beat: string; label: string; theirs?: boolean };
  done: Id[];
  said: string[];
  lines: TalkLine[];
  options: TalkOption[];
  landed?: 'well' | 'badly' | 'even';
  over?: boolean;
  /** What's being talked of: the topics of the subject on now, or the one just talked through (and any an effect added). */
  about?: string[];
}
interface Bond {
  /** Talks they've had (counted at the end of each). */
  talks: number;
  /** When they last talked (the end of the last talk). */
  last?: number;
  seen: Record<Id, number>;
  sore?: Record<Id, number>;
  known?: Record<string, Value>;
  said?: Record<string, number>;
  lastThread?: Id;
}
interface Promised { who: Id; by: Id; id: Id; t: number; due: number; state: 'open' | 'kept' | 'broken' | 'lapsed'; settled?: number }
interface State { talks: Record<Id, Talk>; bonds: Record<string, Bond>; promises: Promised[] }

const bondKey = (who: Id, by: Id): string => who + '>' + by;

export class Voice implements Module {
  readonly name = 'voice';
  readonly config: VoiceConfig;
  readonly knobs = { chatter: 'person' } as const;
  readonly approaches = new Map<Id, ApproachDef>();
  readonly threads = new Map<Id, ThreadDef>();
  readonly promiseDefs = new Map<Id, PromiseDef>();
  /** The warmth a talk starts with (a definition: set it on every start). Default: regard times config.warmthRegard (3), rounded, from warmthMin to warmthMax (-1 to 3; with Fellowship), else 0. */
  warmth: (ctx: Ctx) => number = (ctx) => {
    const f = ctx.world.fellowship;
    const c = this.c;
    return f && ctx.person && ctx.target ? Math.round(clamp(f.regard(ctx.person.id, ctx.target) * c.warmthRegard, c.warmthMin, c.warmthMax)) : 0;
  };
  /** How many beats they'll talk for (a definition), before `chatter`. Default config.patience. */
  patience: (ctx: Ctx) => number = () => this.c.patience;
  /**
   * How something learned about them is put in words, where a line or an
   * answer says {learned.<key>} or {learned.<key>:<form>} (a definition: set
   * it on every start). ctx: the one talked to, the speaker as target.
   * Default: a word or a number as it is, anything else nothing.
   */
  remembered: (ctx: Ctx, key: string, value: Value, form: string | null) => string = (_ctx, _key, value) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');
  private w!: World;
  /** The talk being worked on inside an input (effects add their notes to it). */
  private live: Talk | null = null;

  constructor(cfg: Partial<VoiceConfig> = {}) { this.config = { ...DEFAULT_VOICE, ...cfg }; }

  private get st(): State | undefined { return this.w.s.mod.voice as State | undefined; }
  /** The config in force: as declared, under any world.tune. */
  private get c(): VoiceConfig { return this.w.tuned(this.name, this.config); }
  /** How chatty the one talked to is: the world's chatter, times their own. */
  private chatter(who: Id): number { return this.c.chatter * this.w.own(this.w.s.people[who], this.name, 'chatter'); }
  private mut(): State { return (this.w.s.mod.voice ||= { talks: {}, bonds: {}, promises: [] }) as State; }
  private bond(who: Id, by: Id): Bond { return (this.mut().bonds[bondKey(who, by)] ||= { talks: 0, seen: {} }); }
  private peekBond(who: Id, by: Id): Bond | undefined { return this.st?.bonds[bondKey(who, by)]; }

  attach(w: World): void {
    this.w = w;
    const L = w.lang;
    const by = (c: Ctx): Id | null => c.target ?? null;
    const talkOf = (c: Ctx): Talk | undefined => {
      const t = by(c);
      const talk = t ? this.st?.talks[t] : undefined;
      return talk && c.person && talk.who === c.person.id ? talk : undefined;
    };
    L.term('talks', (c) => (c.person && by(c) ? this.peekBond(c.person.id, by(c) as Id)?.talks ?? 0 : 0));
    L.term('familiar', (c) => (c.person && by(c) ? this.familiarity(c.person.id, by(c) as Id) : 0));
    L.term('talking', (c, a) => {
      if (!c.person) return false;
      const talks = this.st?.talks || {};
      return a ? talks[a]?.who === c.person.id : Object.values(talks).some((t) => t.who === c.person?.id);
    });
    L.term('warmth', (c) => talkOf(c)?.warmth ?? 0);
    L.term('patience', (c) => talkOf(c)?.patience ?? 0);
    L.term('landed', (c) => talkOf(c)?.landed ?? null);
    L.term('about', (c, a) => !!talkOf(c)?.about?.includes(a));
    L.term('learned', (c, a) => (c.person && by(c) ? this.peekBond(c.person.id, by(c) as Id)?.known?.[a] ?? false : false));
    L.term('sore', (c, a) => (c.person && by(c) ? (this.peekBond(c.person.id, by(c) as Id)?.sore?.[a] ?? -1) > w.s.now : false));
    L.term('talked', (c, a) => {
      if (!c.person || !by(c)) return a ? false : null;
      const b = this.peekBond(c.person.id, by(c) as Id);
      if (a) return b?.seen[a] !== undefined;
      return b?.last !== undefined ? round(w.s.now - b.last, 2) : null;
    });
    L.term('promise', (c, a) => {
      if (!c.person) return null;
      const list = (this.st?.promises || []).filter((x) => x.who === c.person?.id && x.id === a && (!by(c) || x.by === by(c)));
      return list.length ? list[list.length - 1].state : null;
    });
    L.effect('learn', (c, a, _op, v) => { if (c.person && c.target) this.applyLearn(c.person.id, c.target, a, v === null ? true : v); });
    L.effect('promise', (c, a, _op, v) => { if (c.person && c.target) this.applyPromise(c.person.id, c.target, a, v === null || v === true ? undefined : Number(v)); });
    L.effect('sore', (c, a, _op, v) => {
      if (!c.person || !c.target) return;
      const talk = this.st?.talks[c.target];
      const thread = a || talk?.thread?.id;
      if (!thread) return;
      const b = this.bond(c.person.id, c.target);
      (b.sore ||= {})[thread] = this.w.s.now + (v === null || v === true ? this.c.soreDays : Number(v)) * DAY;
    });
    // the talk turns to a topic (it pulls subjects about it, with followPull)
    L.effect('about', (c, a) => {
      const talk = c.target ? this.st?.talks[c.target] : undefined;
      if (!talk || !c.person || talk.who !== c.person.id || !a) return;
      if (!(talk.about ||= []).includes(a)) talk.about.push(a);
    });
    L.effect('warmth', (c, _a, op, v) => {
      const talk = c.target ? this.st?.talks[c.target] : undefined;
      if (!talk || !c.person || talk.who !== c.person.id) return;
      const n = Number(v);
      talk.warmth = round(op === '+=' ? talk.warmth + n : op === '-=' ? talk.warmth - n : op === '*=' ? talk.warmth * n : n, 4);
    });
    w.defineInput('voice.start', (who: Id, by: Id) => this.applyStart(who, by));
    w.defineInput('voice.answer', (by: Id, i: number, id: string | null) => this.applyAnswer(by, i, id));
    w.defineInput('voice.end', (by: Id) => this.applyEnd(by, 'left'));
  }

  // -------------------------------------------------------------------------
  // Declaring
  // -------------------------------------------------------------------------

  approach(def: ApproachDef): this { this.approaches.set(def.id, def); return this; }
  thread(def: ThreadDef): this { this.threads.set(def.id, def); return this; }
  promise(def: PromiseDef): this { this.promiseDefs.set(def.id, def); return this; }

  // -------------------------------------------------------------------------
  // The game's side
  // -------------------------------------------------------------------------

  /** Starts a talk with someone (from the game: recorded). Returns what to show, or null if they can't talk. */
  start(who: Id, by: Id = 'player'): TalkView | null { return (this.w.input('voice.start', [who, by]) as TalkView | null | undefined) ?? null; }

  /** Chooses one of the talk's answers by its index in current().answers (recorded). Returns what to show next. */
  answer(i: number, by: Id = 'player'): TalkView | null {
    const opt = this.st?.talks[by]?.options[i];
    return (this.w.input('voice.answer', [by, i, opt?.id ?? null]) as TalkView | null | undefined) ?? null;
  }

  /** Ends a talk without a goodbye (walked off; recorded). */
  end(by: Id = 'player'): void { this.w.input('voice.end', [by]); }

  /** The talk in progress, as the game shows it, or null. */
  current(by: Id = 'player'): TalkView | null {
    const talk = this.st?.talks[by];
    return talk ? this.view(talk, false) : null;
  }

  /** How well someone knows the speaker: half a point a talk, a point for each thing learned about them. */
  familiarity(who: Id, by: Id = 'player'): number {
    const b = this.peekBond(who, by);
    const c = this.c;
    return b ? round(b.talks * c.familiarTalk + Object.keys(b.known || {}).length * c.familiarLearned, 2) : 0;
  }

  /** What the speaker has learned about someone. */
  learned(who: Id, by: Id = 'player'): Record<string, Value> { return { ...(this.peekBond(who, by)?.known || {}) }; }

  /** Talks so far between them, and when the last ended. */
  history(who: Id, by: Id = 'player'): { talks: number; last: number | null; lastThread: Id | null; seen: Record<Id, number> } {
    const b = this.peekBond(who, by);
    return { talks: b?.talks ?? 0, last: b?.last ?? null, lastThread: b?.lastThread ?? null, seen: { ...(b?.seen || {}) } };
  }

  /**
   * Everyone the speaker has talked with: talks, when the last ended,
   * familiarity and what's been learned, the latest first (one still talking
   * for the first time first of all), then by id. A look: it changes nothing.
   */
  acquaintances(by: Id = 'player'): Acquaintance[] {
    const st = this.st;
    if (!st) return [];
    const tail = '>' + by, now = this.w.s.now, out: Acquaintance[] = [];
    for (const k of Object.keys(st.bonds)) {
      if (!k.endsWith(tail) || k.length === tail.length) continue;
      const who = k.slice(0, k.length - tail.length), b = st.bonds[k];
      out.push({ who, talks: b.talks, last: b.last ?? null, familiarity: this.familiarity(who, by), learned: { ...(b.known || {}) } });
    }
    return out.sort((x, y) => (y.last ?? now) - (x.last ?? now) || (x.who < y.who ? -1 : x.who > y.who ? 1 : 0));
  }

  /** Promises made to someone (or everyone), newest last. */
  promises(who?: Id): Promised[] { return (this.st?.promises || []).filter((p) => !who || p.who === who).map((p) => ({ ...p })); }

  // -------------------------------------------------------------------------
  // Running a talk (inside inputs)
  // -------------------------------------------------------------------------

  private ctx(talk: { who: Id; by: Id }): Ctx { return this.w.ctx(this.w.s.people[talk.who], { target: talk.by }); }

  /** A stream of this talk's own: the same talk draws the same on a replay. */
  private stream(talk: Talk): Stream { return new Stream(this.w.s.seed, 'voice', talk.who, talk.by, talk.t, talk.n++); }

  applyStart(who: Id, by: Id): TalkView | null {
    const w = this.w;
    const p = w.s.people[who];
    if (!p || p.status !== 'active' || who === by) return null;
    const st = this.mut();
    const old = st.talks[by];
    if (old && old.who === who) return this.view(old, false);
    if (old) this.applyEnd(by, 'left');
    const talk: Talk = { who, by, t: w.s.now, n: 0, warmth: 0, patience: 0, done: [], said: [], lines: [], options: [] };
    const ctx = this.ctx(talk);
    talk.warmth = round(Number(this.warmth(ctx)) || 0, 4);
    // the headline knob: a chattier person talks for longer
    talk.patience = Math.max(1, Math.round((Number(this.patience(ctx)) || this.c.patience) * this.chatter(who)));
    st.talks[by] = talk;
    this.live = talk;
    try {
      w.log('talk', who, { by });
      w.emit('voice:start', { who, by });
      // they open with a subject of their own making, if one can, else the plain greeting
      if (!this.opening(talk)) this.say(talk, 'them', this.c.greet);
      if (!this.theirTurn(talk)) this.refresh(talk);
    } finally { this.live = null; }
    return this.view(talk, false);
  }

  applyAnswer(by: Id, i: number, id: string | null): TalkView | null {
    const talk = this.st?.talks[by];
    if (!talk) return null;
    const opt = (id !== null ? talk.options.find((o) => o.id === id) : undefined) ?? talk.options[i];
    if (!opt || !opt.ok) return this.view(talk, false);
    talk.lines = [];
    this.live = talk;
    try {
      if (opt.kind === 'bye') return this.bye(talk);
      if (opt.kind === 'drop') this.finishThread(talk, false);
      else if (opt.kind === 'thread') {
        const def = this.threads.get(opt.id);
        if (def) this.enter(talk, def, false);
      } else if (opt.kind === 'answer') {
        const where = this.chosen(talk, opt);
        if (where === 'bye') return this.bye(talk);
      }
      if (!this.st?.talks[by]) return this.view(talk, true);
      if (!talk.thread && !talk.over && this.theirTurn(talk)) return this.view(talk, false);
      this.refresh(talk);
    } finally { this.live = null; }
    return this.view(talk, false);
  }

  /** An answer is chosen: said, its approach lands, its effects, and where it leads. Returns where. */
  private chosen(talk: Talk, opt: TalkOption): string {
    const def = talk.thread ? this.threads.get(talk.thread.id) : undefined;
    const beat = def && talk.thread ? def.beats[talk.thread.beat] : undefined;
    const a = beat?.answers?.[Number(opt.id.slice(1))];
    if (!def || !a) { this.finishThread(talk, false); return 'end'; }
    this.say(talk, 'you', a.say, true);
    if (a.approach || a.recalls) this.land(talk, a.approach, !!a.recalls);
    const ctx = this.ctx(talk);
    if (a.then) this.w.lang.applyAll(a.then, ctx);
    let to = 'end';
    if (typeof a.to === 'string') to = a.to;
    else if (Array.isArray(a.to)) {
      const pick = a.to.find((x) => (!x.if || this.w.lang.all(x.if, ctx)) && (!x.landed || x.landed === talk.landed) && (x.warmth === undefined || talk.warmth >= x.warmth));
      to = pick?.to ?? a.to[a.to.length - 1]?.to ?? 'end';
    }
    if (to === 'bye') return 'bye';
    if (to.startsWith('thread:')) {
      // a door into another subject: this one's talked through, that one starts at once
      this.finishThread(talk, true);
      const next = this.threads.get(to.slice(7));
      if (next && !talk.over) this.enter(talk, next, false, true);
      return to;
    }
    if (to === 'end' || !def.beats[to]) this.finishThread(talk, true);
    else this.runBeat(talk, to);
    return to;
  }

  /** Starts on a subject: the speaker opens it (unless it's theirs, or the answer before was the way in), then its first beat. */
  private enter(talk: Talk, def: ThreadDef, theirs: boolean, door = false): void {
    const ctx = this.ctx(talk);
    const label = this.fill(talk, typeof def.label === 'function' ? def.label(ctx) : def.label ?? def.id);
    talk.thread = { id: def.id, beat: def.start ?? 'start', label };
    if (theirs) talk.thread.theirs = true;
    if (!talk.done.includes(def.id)) talk.done.push(def.id);
    // what's being talked of now (kept only by a game whose subjects say)
    if (def.about?.length) talk.about = [...def.about];
    else if (talk.about) delete talk.about;
    if (!theirs && !door) {
      const open = typeof def.open === 'string' ? def.open : def.open ? (def.approach && def.open[def.approach]) || def.open[Object.keys(def.open)[0]] : label;
      if (open) this.say(talk, 'you', open, true);
      if (def.approach || def.recalls) this.land(talk, def.approach, !!def.recalls);
    }
    this.runBeat(talk, def.start ?? 'start');
  }

  private runBeat(talk: Talk, name: string): void {
    const def = talk.thread ? this.threads.get(talk.thread.id) : undefined;
    const beat = def?.beats[name];
    if (!def || !beat || !talk.thread) { this.finishThread(talk, true); return; }
    talk.thread.beat = name;
    talk.patience--;
    if (beat.then) this.w.lang.applyAll(beat.then, this.ctx(talk));
    const who = beat.who ?? 'them';
    if (beat.line) this.say(talk, who, beat.line, false, beat.text);
    else if (beat.text !== undefined) this.sayText(talk, who, beat.text);
    if (beat.end || !beat.answers?.length) this.finishThread(talk, true);
  }

  /** A subject is done: talked through (its effects run) or let lie. */
  private finishThread(talk: Talk, reached: boolean): void {
    const th = talk.thread;
    if (!th) return;
    const def = this.threads.get(th.id);
    const b = this.bond(talk.who, talk.by);
    b.seen[th.id] = this.w.s.now;
    b.lastThread = th.id;
    talk.thread = undefined;
    if (!reached && talk.about) delete talk.about; // (let lie: nothing to follow)
    if (reached && def?.then) this.w.lang.applyAll(def.then, this.ctx(talk));
    if (talk.patience <= 0 && !talk.over) {
      talk.over = true;
      this.say(talk, 'them', this.c.close);
    }
  }

  /**
   * How an approach lands (and something recalled, with or without one):
   * added to the warmth, and remembered for the lines and answers that
   * follow. Someone who knows the speaker takes it better (familiarLand),
   * and something they've told you, remembered, better still (recallLand).
   */
  private land(talk: Talk, id: Id | undefined, recall = false): number {
    const def = id !== undefined ? this.approaches.get(id) : undefined;
    if (!def && !recall) return 0;
    const ctx = this.ctx(talk);
    const c = this.c;
    let d = def ? landing(this.w.lang, def.base ?? 0, def.lands, ctx) : 0;
    const trust = (def?.familiar ?? 1) * c.familiarLand;
    if (trust) d = round(d + Math.min(c.familiarLandMax, this.familiarity(talk.who, talk.by) * trust), 4);
    if (recall) d = round(d + c.recallLand, 4);
    talk.warmth = round(talk.warmth + d, 4);
    talk.landed = d > 0 ? 'well' : d < 0 ? 'badly' : 'even';
    if (Math.abs(d) >= c.strong) {
      this.w.lang.applyAll(d > 0 ? c.onWell : c.onBadly, ctx);
      // a word on how it landed, if they have one
      const how = d > 0 ? 'well' : 'badly';
      if (!this.say(talk, 'them', `${c.react}.${def ? id : 'recall'}.${how}`, false, undefined, true)) this.say(talk, 'them', `${c.react}.${how}`, false, undefined, true);
    }
    return d;
  }

  /** Has the speaker learned this about them? */
  private knows(talk: { who: Id; by: Id }, key: string): boolean { return this.peekBond(talk.who, talk.by)?.known?.[key] !== undefined; }

  /** Words with what's been learned filled in: {learned.<key>} and {learned.<key>:<form>}, by `remembered` (an unlearned key is left as it is). */
  private fill(talk: { who: Id; by: Id }, s: string): string {
    if (s.indexOf('{learned.') < 0) return s;
    const known = this.peekBond(talk.who, talk.by)?.known || {};
    const ctx = this.ctx(talk);
    return s.replace(/\{learned\.([^}:]+)(?::([^}]*))?\}/g, (m, key: string, form?: string) => (known[key] === undefined ? m : String(this.w.peek(() => this.remembered(ctx, key, known[key], form ?? null)) ?? '')));
  }

  /** They open the talk with a subject, when one can: its first beat is their greeting. Returns whether they did. */
  private opening(talk: Talk): boolean {
    const w = this.w, now = w.s.now;
    const b = this.peekBond(talk.who, talk.by);
    const ctx = this.ctx(talk);
    const c = this.c;
    const cands = [...this.threads.values()].filter((def) => {
      if (!def.opens) return false;
      if (def.recalls && b?.known?.[def.recalls] === undefined) return false;
      const seen = b?.seen[def.id];
      if (seen !== undefined && now - seen < (def.cooldown ?? c.cooldown)) return false;
      return !def.if || w.peek(() => w.lang.all(def.if, ctx));
    }).sort((x, y) => (x.id < y.id ? -1 : 1));
    if (!cands.length) return false;
    const def = cands.length === 1 ? cands[0] : this.stream(talk).weighted(cands, (d) => Math.max(0, this.weightOf(d, ctx)));
    if (!def) return false;
    this.enter(talk, def, true);
    return true;
  }

  /** Now and then they raise something of their own. Returns whether they did. */
  private theirTurn(talk: Talk): boolean {
    if (talk.over || talk.thread) return false;
    const w = this.w, now = w.s.now;
    const b = this.peekBond(talk.who, talk.by);
    const ctx = this.ctx(talk);
    const c = this.c;
    const cands = [...this.threads.values()].filter((def) => {
      if (!def.theirs || talk.done.includes(def.id)) return false;
      if (def.recalls && b?.known?.[def.recalls] === undefined) return false;
      const seen = b?.seen[def.id];
      if (seen !== undefined && now - seen < (def.cooldown ?? c.cooldown)) return false;
      return !def.if || w.peek(() => w.lang.all(def.if, ctx));
    }).sort((x, y) => (x.id < y.id ? -1 : 1));
    if (!cands.length) return false;
    const r = this.stream(talk);
    // the headline knob: a chattier person raises more of their own
    if (!r.chance(c.theirs * this.chatter(talk.who))) return false;
    const def = r.weighted(cands, (d) => Math.max(0, this.weightOf(d, ctx)));
    if (!def) return false;
    this.enter(talk, def, true);
    this.refresh(talk);
    return true;
  }

  private weightOf(def: ThreadDef, ctx: Ctx): number {
    return typeof def.weight === 'function' ? Number(this.w.peek(() => (def.weight as (c: Ctx) => number)(ctx))) || 0 : def.weight ?? 1;
  }

  /** The subjects worth raising now, best first. */
  private salient(talk: Talk): ThreadDef[] {
    const w = this.w, now = w.s.now;
    const b = this.peekBond(talk.who, talk.by);
    const ctx = this.ctx(talk);
    const c = this.c;
    const scored: Array<[number, ThreadDef]> = [];
    for (const def of this.threads.values()) {
      if (def.theirs || def.opens || talk.done.includes(def.id)) continue;
      if (def.recalls && b?.known?.[def.recalls] === undefined) continue;
      if (def.if && !w.lang.all(def.if, ctx)) continue;
      const seen = b?.seen[def.id];
      const fresh = seen === undefined ? 1 : 1 - Math.exp(-(now - seen) / Math.max(1, def.cooldown ?? c.cooldown));
      let s = this.weightOf(def, ctx) * fresh;
      if ((b?.sore?.[def.id] ?? -1) > now) s *= c.soreWeight;
      if (def.reveals && b?.known?.[def.reveals] === undefined) s *= c.revealPull;
      // following on from what was just said
      if (c.followPull !== 1 && talk.about && def.about?.some((t) => talk.about?.includes(t))) s *= c.followPull;
      if (s < c.salientFloor) continue;
      // a little variety, the same for this pair all day (or afresh each time, with reshuffle)
      const peek = c.reshuffle ? w.worldStreamPeek('voice', talk.who, talk.by, talk.t, talk.done.length, def.id) : w.worldStreamPeek('voice', talk.who, talk.by, Math.floor(now / DAY), def.id);
      s += peek.next() * c.variety;
      scored.push([s, def]);
    }
    return scored.sort((x, y) => y[0] - x[0] || (x[1].id < y[1].id ? -1 : 1)).slice(0, c.offers).map(([, d]) => d);
  }

  /** Works out what can be said now (kept with the talk, so a replay offers the same). */
  private refresh(talk: Talk): void {
    const w = this.w;
    w.peek(() => {
      const out: TalkOption[] = [];
      const ctx = this.ctx(talk);
      if (talk.over) { talk.options = [{ kind: 'bye', id: 'bye', ok: true }]; return; }
      if (talk.thread) {
        const beat = this.threads.get(talk.thread.id)?.beats[talk.thread.beat];
        const choices = this.c.choices;
        (beat?.answers || []).forEach((a, i) => {
          if (out.length >= choices) return;
          const ok = (!a.if || w.lang.all(a.if, ctx)) && (a.warmth === undefined || talk.warmth >= a.warmth) && (!a.recalls || this.knows(talk, a.recalls));
          if (!ok && !a.soft) return;
          // a beat come round again doesn't offer what's been said already
          if (ok && !this.isTopic(talk.by, a.say) && talk.said.includes(a.say)) return;
          const o: TalkOption = { kind: 'answer', id: 'a' + i, ok, say: this.fill(talk, a.say) };
          if (a.label) o.label = this.fill(talk, a.label);
          if (a.approach) o.approach = a.approach;
          if (a.recalls) o.recalls = a.recalls;
          out.push(o);
        });
        out.push({ kind: 'drop', id: 'drop', ok: true });
      } else {
        for (const def of this.salient(talk)) {
          const o: TalkOption = { kind: 'thread', id: def.id, ok: true, label: this.fill(talk, typeof def.label === 'function' ? def.label(ctx) : def.label ?? def.id) };
          if (def.approach) o.approach = def.approach;
          if (def.recalls) o.recalls = def.recalls;
          out.push(o);
        }
      }
      out.push({ kind: 'bye', id: 'bye', ok: true });
      talk.options = out;
    });
  }

  private bye(talk: Talk): TalkView {
    this.say(talk, 'them', this.c.bye);
    const view = this.view(talk, true);
    this.applyEnd(talk.by, 'bye');
    return view;
  }

  /** Ends a talk: what it leaves (a talk counted, when, a deed). */
  applyEnd(by: Id, why: string): void {
    const w = this.w;
    const st = this.st;
    const talk = st?.talks[by];
    if (!st || !talk) return;
    if (talk.thread) this.finishThread(talk, false);
    delete st.talks[by];
    const b = this.bond(talk.who, by);
    b.talks++;
    b.last = w.s.now;
    w.log('talked', talk.who, { by, threads: talk.done.slice(), why });
    w.emit('voice:end', { who: talk.who, by, threads: talk.done.slice(), why });
    const deed = this.c.deed;
    if (deed) {
      const data: Record<string, Value> = { for: talk.who };
      w.log('did', by, { verb: deed, for: talk.who });
      for (const m of w.hooks) m.did?.(by, deed, data);
    }
  }

  // -------------------------------------------------------------------------
  // Words
  // -------------------------------------------------------------------------

  /** Does the speaker have lines on this topic (so it's a topic, not words)? */
  private isTopic(speaker: Id, s: string): boolean {
    const cs = this.w.cityspeak;
    return !!cs && !!this.w.s.people[speaker] && cs.lines.some((l) => l.topic === s);
  }

  /**
   * Says something in the talk: a line on a topic, chosen by Cityspeak for
   * the speaker (passing over what they've said to this listener lately), or
   * the words given. Returns whether anything was said.
   */
  private say(talk: Talk, who: 'them' | 'you' | 'aside', topicOrWords: string, words = false, fallback?: string | string[], onlyLine = false): boolean {
    const w = this.w;
    const speaker = who === 'them' ? talk.who : who === 'you' ? talk.by : null;
    const listener = who === 'them' ? talk.by : talk.who;
    const cs = w.cityspeak;
    if (speaker && cs && w.s.people[speaker] && (!words || this.isTopic(speaker, topicOrWords))) {
      const b = this.peekBond(talk.who, talk.by);
      const now = w.s.now;
      const fresh = this.c.fresh;
      const said = cs.choose(speaker, {
        to: listener, topic: topicOrWords, exact: true, salt: [talk.t, talk.n++],
        avoid: (key) => talk.said.includes(key) || (b?.said?.[key] !== undefined && now - (b.said[key] as number) < fresh),
      });
      if (said) {
        const line: TalkLine = { who, key: said.key };
        if (said.text !== undefined) line.text = this.fill(talk, said.text);
        talk.lines.push(line);
        talk.said.push(said.key);
        if (who === 'them') (this.bond(talk.who, talk.by).said ||= {})[said.key] = now;
        return true;
      }
    }
    if (onlyLine) return false;
    if (fallback !== undefined) return this.sayText(talk, who, fallback);
    if (words) { talk.lines.push({ who, text: this.fill(talk, topicOrWords) }); talk.said.push(topicOrWords); return true; }
    // a topic with no line for it: the game looks the words up itself
    if (topicOrWords) { talk.lines.push({ who, key: topicOrWords }); return true; }
    return false;
  }

  private sayText(talk: Talk, who: 'them' | 'you' | 'aside', text: string | string[]): boolean {
    const list = (Array.isArray(text) ? text : [text]).filter((t) => t);
    if (!list.length) return false;
    const fresh = list.filter((t) => !talk.said.includes(t));
    const t = this.stream(talk).pick(fresh.length ? fresh : list) as string;
    talk.lines.push({ who, text: this.fill(talk, t) });
    talk.said.push(t);
    return true;
  }

  private view(talk: Talk, ended: boolean): TalkView {
    return {
      who: talk.who, by: talk.by,
      thread: talk.thread ? { id: talk.thread.id, label: talk.thread.label, beat: talk.thread.beat, theirs: !!talk.thread.theirs } : null,
      lines: talk.lines.map((l) => ({ ...l })),
      answers: ended ? [] : talk.options.map((o, i) => ({ ...o, i })),
      warmth: talk.warmth, patience: talk.patience, landed: talk.landed ?? null, over: !!talk.over, ended,
    };
  }

  // -------------------------------------------------------------------------
  // What a talk leaves: things learned, sore subjects, promises
  // -------------------------------------------------------------------------

  /** The speaker learns something about someone (inside the simulation). */
  applyLearn(who: Id, by: Id, key: string, value: Value): void {
    const b = this.bond(who, by);
    const had = b.known?.[key] !== undefined;
    (b.known ||= {})[key] = value;
    const talk = this.live && this.live.who === who && this.live.by === by ? this.live : this.st?.talks[by]?.who === who ? this.st?.talks[by] : undefined;
    if (talk && !had) talk.lines.push({ who: 'note', learned: key, value });
    this.w.log('learned', who, { by, key });
  }

  /** A promise is made to someone (inside the simulation). */
  applyPromise(who: Id, by: Id, id: Id, days?: number): void {
    const st = this.mut();
    if (st.promises.some((p) => p.who === who && p.by === by && p.id === id && p.state === 'open')) return;
    const def = this.promiseDefs.get(id);
    const now = this.w.s.now;
    st.promises.push({ who, by, id, t: now, due: now + (days ?? def?.days ?? this.c.promiseDays) * DAY, state: 'open' });
    this.w.log('promised', who, { by, promise: id });
    this.w.emit('promise', { who, by, id, state: 'open' });
  }

  private settle(p: Promised, state: 'kept' | 'broken' | 'lapsed'): void {
    const w = this.w;
    p.state = state;
    p.settled = w.s.now;
    w.log('promise', p.who, { by: p.by, promise: p.id, state });
    w.emit('promise', { who: p.who, by: p.by, id: p.id, state });
    const def = this.promiseDefs.get(p.id);
    const fx = state === 'kept' ? def?.onKept : state === 'broken' ? def?.onBroken : def?.onLapsed;
    const person = w.s.people[p.who];
    if (fx && person) w.lang.applyAll(fx, w.ctx(person, { target: p.by }));
  }

  /** Each hour, open promises are checked: kept, broken, or come due. */
  hour(): void {
    const st = this.st;
    if (!st?.promises.length) return;
    const w = this.w, now = w.s.now;
    for (const p of st.promises) {
      if (p.state !== 'open') continue;
      const person = w.s.people[p.who];
      const def = this.promiseDefs.get(p.id);
      if (person && def) {
        const ctx = w.ctx(person, { target: p.by });
        if (def.kept?.length && w.lang.all(def.kept, ctx)) { this.settle(p, 'kept'); continue; }
        if (def.broken?.length && w.lang.all(def.broken, ctx)) { this.settle(p, 'broken'); continue; }
      }
      if (now >= p.due) this.settle(p, def?.lapse ?? 'lapsed');
    }
  }

  /** Each day, old marks are let go: lines said long ago, promises long settled. */
  day(): void {
    const st = this.st;
    if (!st) return;
    const now = this.w.s.now, c = this.c;
    for (const k of Object.keys(st.bonds)) {
      const said = st.bonds[k].said;
      if (said) for (const key of Object.keys(said)) if (now - said[key] > 2 * c.fresh) delete said[key];
      const sore = st.bonds[k].sore;
      if (sore) for (const t of Object.keys(sore)) if (sore[t] <= now) delete sore[t];
    }
    st.promises = st.promises.filter((p) => p.state === 'open' || now - (p.settled ?? now) < c.promiseKeep * DAY);
  }

  removed(p: PersonState): void {
    const st = this.st;
    if (!st) return;
    for (const by of Object.keys(st.talks)) if (st.talks[by].who === p.id || by === p.id) this.applyEnd(by, 'gone');
  }
}
