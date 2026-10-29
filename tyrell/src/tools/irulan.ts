// Irulan: the narrator, named for the Princess Irulan of Dune, who wrote the
// histories of Muad'Dib. Westmarch keeps the log a line at a time; Irulan
// tells it as a story. The entries are folded into beats (an action from
// start to finish, with the walk there, the company kept and how it went; a
// talk from its first word to its last; whatever happened to someone in the
// same minute, as one sentence), the same beat for several people is told
// once, and every beat is scored for how much it matters. From the beats it
// tells paragraphs by the time of day, someone's day, the headlines, and the
// storylines running through the town (a feud, a theft and the gossip about
// it, a trap and who it caught).
//
// Every sentence comes with its parts: the words, and the people and places
// in them tagged with their ids, so a game can make names links or color
// places without searching the text.
//
// The words come from the game: an action's, a feeling's, a wish's, an
// illness's, a breakdown's or a kind of interaction's `tell`, and the words
// it gives a kind of entry (`words`); and otherwise Irulan's own, or
// Westmarch's describe. Like Palantír it's a look: it reads the state and
// changes nothing, so the same entries can be told as often as a game likes.
import type { Id, LogEntry, Minutes } from '../core/types';
import type { World } from '../core/world';
import { DAY, HOUR } from '../core/util';

/** A piece of a sentence: words, or a person or a place by its id. */
export interface Part {
  text: string;
  person?: Id;
  place?: Id;
}

/** Something that happened, told as a sentence. */
export interface Beat {
  /** When it began (for an action someone walked to, when they set out). */
  t: Minutes;
  /** When it ended, for an action or a talk that did. */
  end?: Minutes;
  /** Whom it's about: the subject, or several people told as one ("Kofi and Sam"). Empty for what happened to nobody in particular (the rain). */
  who: Id[];
  /** Others in it: the target, the company kept, the other side of a talk. */
  with: Id[];
  /** Where, when it's known. */
  place?: Id;
  /** The kinds of entry it was made from. */
  kinds: string[];
  /** How much it matters, 0..1: the weight of its kinds, up to twice that for what's rare among the entries told. */
  score: number;
  /** The sentence. */
  text: string;
  /** The sentence in parts, the people and places in it tagged. */
  parts: Part[];
  /** The entries it was made from, oldest first. */
  entries: LogEntry[];
}

/** A storyline: the beats of one matter (a deed and what came of it) or between the same people, in order. */
export interface Thread {
  /**
   * What it's about: 'did:sam:theft' (a deed, and its witnesses, gossip and
   * reports), 'pair:dev+sam' (what passed between two people), 'trap:t1',
   * 'taint:x2', 'harm:5'. Several when they turned out to be one story.
   */
  keys: string[];
  /** A title: "Sam's theft", "Dev and Sam at odds". */
  title: string;
  /** The title in parts. */
  parts: Part[];
  /** The people in it, the most involved first. */
  people: Id[];
  /** Its beats, in order: everything about its matters whatever it scores, and what its people felt along the way. */
  beats: Beat[];
  t: Minutes;
  end: Minutes;
  /** Its best beat's score. */
  score: number;
}

export interface TellOptions {
  /** Only the beats about this person: theirs, or with them in it. */
  who?: Id;
  /** Leave out beats scoring below this. Default 0 (beats, tell), 0.3 (day), 0.4 (threads). */
  min?: number;
  /** Weights by kind of entry, over Irulan's own (IRULAN_WEIGHTS); 0 leaves a kind out. */
  weights?: Record<string, number>;
  /** People who matter more to the story (the player, their friends): a beat with them in it scores this many times more, up to 1. */
  focus?: Record<Id, number>;
  /** The parts of the day tell's paragraphs are made by: [the hour it starts, its name], earliest first. */
  periods?: Array<[number, string]>;
  /** A day's name, for tell's paragraphs. Default 'Day n'. */
  day?: (day: number) => string;
}

/** What a game's words see: names for people, groups and places, and the world. */
export interface WordsContext {
  world: World;
  /** A person, a group or a place by its name ('someone' for none), tagged for the beat's parts: put it in your words as it is. */
  name(id: unknown): string;
  /** A place as someone would say it, tagged the same way: 'home' for their own, 'Mara's place' for another's, else its name. */
  place(id: Id | undefined, who?: Id): string;
}

/**
 * A game's words for a kind of entry: what follows the person's name ("rain
 * set in" for an entry with no person, without a full stop), null to leave
 * the entry out, or undefined for Irulan's own words.
 */
export type WordsFn = (e: LogEntry, ctx: WordsContext) => string | null | undefined;

/**
 * How much each kind of entry matters, 0..1, before what's rare counts for
 * more: routine low, the turns of a day in the middle, what a story is made
 * of high. 0 leaves a kind out (the day's turning is told by the paragraphs,
 * a plan by what's done about it). A kind not here weighs 0.3.
 */
export const IRULAN_WEIGHTS: Readonly<Record<string, number>> = {
  // the routine of a day
  started: 0.15, 'set-out': 0.05, arrived: 0.05, met: 0.05, finished: 0.1, stopped: 0.1, interrupted: 0.1, joined: 0.05, parted: 0.05,
  said: 0.1, social: 0.2, talked: 0.1, course: 0.05, shows: 0.1, released: 0.1, 'done-plan': 0.1, replanned: 0.1, 'set-aside': 0.05, resumed: 0.05,
  failed: 0.15,
  // its turns
  felt: 0.3, 'gave-up': 0.3, 'no-plan': 0.3, wished: 0.3, faded: 0.2, granted: 0.45, regard: 0.25, sentiment: 0.35, owes: 0.3, rent: 0.35,
  exchange: 0.35, told: 0.35, learned: 0.4, sensed: 0.3, directed: 0.4, away: 0.4, back: 0.4, fact: 0.4, did: 0.45, afflicted: 0.45, recovered: 0.35,
  tended: 0.4, saw: 0.4, promised: 0.5, promise: 0.45, talk: 0.45, skill: 0.55, stage: 0.55, promoted: 0.4, changed: 0.3, up: 0.4, healed: 0.45,
  noticed: 0.5, warned: 0.5, disarmed: 0.5, respond: 0.5,
  // what a story is made of
  witnessed: 0.65, report: 0.6, silenced: 0.7, exposed: 0.75, broke: 0.75, grudge: 0.6, feud: 0.7, mended: 0.6, escalated: 0.6, blamed: 0.6,
  suspect: 0.6, set: 0.65, tainted: 0.75, sprung: 0.8, yielded: 0.65, spared: 0.6, mutated: 0.6, paired: 0.8, harm: 0.85, down: 0.8, fatal: 0.9,
  gone: 0.85, born: 1, killed: 1,
  // told by other means
  day: 0, timer: 0, route: 0, planned: 0, director: 0, tuned: 0,
};

const PERIODS: Array<[number, string]> = [[0, 'night'], [5, 'early morning'], [8, 'morning'], [12, 'afternoon'], [17, 'evening'], [21, 'night']];
/** How a talk ended (Bree's outcomes), after its sentence; a fine one says nothing. */
const ENDED: Record<string, string> = { warm: 'and it went warmly', good: 'and it went well', awkward: 'and it got awkward', sour: 'and it turned sour', row: 'and it ended in a row' };
/** Why someone's suspected or blamed (Morgul's reasons), after their name. */
const WHY: Record<string, string> = { 'served it': 'who served it', 'was about': 'who was about', 'bore a grudge': 'who bore them a grudge', 'was told': 'as they\'d been told' };
const NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** Kinds of entry that make what passed between two people a story (a chat that went fine isn't one). */
const BETWEEN = new Set(['grudge', 'feud', 'mended', 'escalated', 'did', 'harm', 'blamed', 'suspect', 'yielded', 'respond', 'warned', 'saw']);
/** The least a beat may score to be in a thread: what's routine stays out, a crime done comes in whatever else it scores. */
const FLOOR = 0.15;
/** Kinds of entry that mean two people are at odds, for a thread's title. */
const AT_ODDS = new Set(['grudge', 'feud', 'escalated', 'harm', 'blamed', 'suspect', 'yielded']);
/** Kinds of beat that are only how someone was, drawn into a thread of theirs when they come in its course. */
const PERSONAL = new Set(['felt', 'broke', 'started', 'finished', 'stopped', 'interrupted', 'set-out', 'arrived', 'met']);
/** How long after a thread's last beat what its people felt still belongs to it. */
const AFTER = 2 * HOUR;

// Names in sentences carry their ids until the sentence is cut into parts:
// \u0001, p (a person) or l (a place), the id, \u0002, the words, \u0003.
const MARK = /\u0001([pl])([^\u0002]*)\u0002([^\u0003]*)\u0003/g;
const tag = (kind: 'p' | 'l', id: Id, text: string): string => `\u0001${kind}${id}\u0002${text}\u0003`;

/** A sentence's parts, and its plain words. */
function partsOf(s: string): Part[] {
  const out: Part[] = [];
  const plain = (text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.person === undefined && last.place === undefined) last.text += text;
    else out.push({ text });
  };
  let i = 0;
  MARK.lastIndex = 0;
  for (let m = MARK.exec(s); m; m = MARK.exec(s)) {
    plain(s.slice(i, m.index));
    out.push(m[1] === 'p' ? { text: m[3], person: m[2] } : { text: m[3], place: m[2] });
    i = m.index + m[0].length;
  }
  plain(s.slice(i));
  return out;
}
const textOf = (parts: Part[]): string => parts.map((p) => p.text).join('');

/** A clause on its way to a beat: what one person did, or what happened. */
interface Clause {
  t: Minutes;
  end?: Minutes;
  who?: Id;
  with: Id[];
  place?: Id;
  kinds: string[];
  entries: LogEntry[];
  /** What it's like, for counting how rare it is: 'act:read', 'felt:fresh'. */
  sig: string;
  order: number;
  text?: string;
  /** An action from start to finish (start), the latest time it was taken up again (at). */
  act?: { action: Id; start: Minutes; at: Minutes; target?: Id; company: Id[]; walked: boolean; ok?: boolean; felt: string[] };
  /** A talk (Bree), by the kinds it went through. */
  talk?: { kinds: Id[]; outcome?: string };
  /** A walk: where to, and whether they got there. */
  walk?: { to: Id; arrived?: Minutes };
}

/** "Kofi", "Kofi and Sam", "Kofi, Sam and Dev". */
function list(words: string[]): string {
  return words.length < 2 ? words.join('') : words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1];
}

/** A length of time in words: "20 minutes", "half an hour", "an hour and a half", "eight hours". */
function lasting(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 50) return m >= 13 && m <= 17 ? 'a quarter of an hour' : m >= 25 && m <= 35 ? 'half an hour' : `${Math.max(5, Math.round(m / 5) * 5)} minutes`;
  const halves = Math.max(2, Math.round(m / 30)), h = Math.floor(halves / 2), half = halves % 2 === 1;
  if (h === 1) return half ? 'an hour and a half' : 'an hour';
  return `${NUMBERS[h] ?? h}${half ? ' and a half' : ''} hours`;
}

/** A label mid-sentence: 'A cold' is 'a cold' (only a leading article is lowered, so names keep their capitals). */
const lower = (s: string): string => s.replace(/^(A|An|The|Some) /, (m) => m.toLowerCase());
const article = (word: string): string => (/^[aeiou]/i.test(word) ? 'an ' : 'a ') + word;
const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export class Irulan {
  private wordsFor = new Map<string, WordsFn>();
  private ctx: WordsContext;

  constructor(private w: World) {
    this.ctx = { world: w, name: (id) => this.name(id), place: (id, who) => this.placeName(id, who) };
  }

  /** Gives a kind of entry the game's own words (a definition: declare it again on every start). */
  words(kind: string, fn: WordsFn): this { this.wordsFor.set(kind, fn); return this; }

  /**
   * The entries told as beats, in the order they happened. `entries` is a
   * list (the game's own, kept from the 'log' events, to reach back further
   * than the log keeps) or a time to tell the log from.
   */
  beats(entries: LogEntry[] | Minutes, opts: TellOptions = {}): Beat[] {
    const all = typeof entries === 'number' ? this.w.westmarch.find({ since: entries }) : entries.slice().sort((a, b) => a.t - b.t);
    const weights = { ...IRULAN_WEIGHTS, ...(opts.weights || {}) };
    const weight = (k: string): number => weights[k] ?? 0.3;
    const clauses = this.fold(all).filter((c) => weight(c.kinds[0]) > 0 && c.text !== '');
    // how rare each is among what's told
    const count = new Map<string, number>();
    for (const c of clauses) count.set(c.sig, (count.get(c.sig) || 0) + 1);
    const score = new Map<Clause, number>();
    const focus = opts.focus || {};
    for (const c of clauses) {
      // (the only one of its kind counts twice, one of ten a tenth more: routine stays low however rare)
      let s = this.weigh(c, weight) * (1 + 1 / (count.get(c.sig) || 1));
      const by = Math.max(1, ...[c.who, ...c.with].map((id) => (id !== undefined ? focus[id] ?? 1 : 1)));
      score.set(c, Math.min(1, s * by));
    }
    // whatever happened to someone in the same minute, as one sentence (of what matters enough to tell)
    const min = opts.min ?? 0;
    const moments: Array<{ c: Clause[]; who?: Id }> = [];
    const byMinute = new Map<string, { c: Clause[]; who?: Id }>();
    for (const c of clauses) {
      if (score.get(c)! < min) continue;
      const key = c.who === undefined ? '' : `${c.who}@${c.t}`;
      const m = key && byMinute.get(key);
      if (m) m.c.push(c);
      else { const n = { c: [c], who: c.who }; moments.push(n); if (key) byMinute.set(key, n); }
    }
    // the same thing for several people at once, told once
    const out: Beat[] = [];
    const told = new Map<string, Beat>();
    for (const m of moments) {
      const said = this.join(m.c);
      const t = m.c[0].t;
      const ends = m.c.map((c) => c.end).filter((e): e is number => e !== undefined);
      const beat: Beat = {
        t, ...(ends.length ? { end: Math.max(...ends) } : {}),
        who: m.who === undefined ? [] : [m.who],
        with: [...new Set(m.c.flatMap((c) => c.with))].filter((id) => id !== m.who),
        ...(m.c.find((c) => c.place) ? { place: m.c.find((c) => c.place)!.place } : {}),
        kinds: [...new Set(m.c.flatMap((c) => c.kinds))],
        score: Math.round(Math.max(...m.c.map((c) => score.get(c)!)) * 1000) / 1000,
        text: said,
        parts: [],
        entries: m.c.flatMap((c) => c.entries).sort((a, b) => a.t - b.t),
      };
      const same = m.who !== undefined ? told.get(`${t}|${said}`) : undefined;
      if (same && !said.includes(this.name(m.who))) {
        same.who.push(m.who!);
        same.with = same.with.filter((id) => id !== m.who);
        same.entries = same.entries.concat(beat.entries).sort((a, b) => a.t - b.t);
        same.score = Math.max(same.score, beat.score);
        continue;
      }
      if (m.who !== undefined) told.set(`${t}|${said}`, beat);
      out.push(beat);
    }
    for (const b of out) {
      // (several people at once: "Kofi and Sam were frustrated")
      const marked = b.who.length ? `${list(b.who.map((id) => this.name(id)))} ${b.who.length > 1 ? b.text.replace(/\bwas\b/g, 'were') : b.text}.` : `${b.text}.`;
      b.parts = partsOf(marked);
      if (!b.who.length && b.parts.length) b.parts[0].text = capital(b.parts[0].text);
      b.text = textOf(b.parts);
    }
    const who = opts.who;
    return who === undefined ? out : out.filter((b) => this.concerns(b, who));
  }

  /**
   * The entries told as paragraphs, one for each part of the day, each
   * starting with when: "Day 0, early morning. Mara went to Mara's Cafe and
   * baked bread. ..."
   */
  tell(entries: LogEntry[] | Minutes, opts: TellOptions = {}): string[] {
    const out: string[] = [];
    let at = '';
    let words: string[] = [];
    for (const b of this.beats(entries, opts)) {
      const head = this.when(b.t, opts) + '.';
      if (head !== at) { if (words.length) out.push(words.join(' ')); at = head; words = [head]; }
      words.push(b.text);
    }
    if (words.length) out.push(words.join(' '));
    return out;
  }

  /** Someone's day as one paragraph: the beats about them since a time (or from a list of entries), the routine left out (min 0.3). */
  day(who: Id, since: LogEntry[] | Minutes, opts: TellOptions = {}): string {
    return this.beats(since, { min: 0.3, ...opts, who }).map((b) => b.text).join(' ');
  }

  /** The headlines: the `limit` beats that matter most (default 5), in the order they happened. For a recap after time away. */
  recap(entries: LogEntry[] | Minutes, opts: TellOptions & { limit?: number } = {}): Beat[] {
    const beats = this.beats(entries, opts);
    const top = new Set(beats.slice().sort((a, b) => b.score - a.score || a.t - b.t).slice(0, opts.limit ?? 5));
    return beats.filter((b) => top.has(b));
  }

  /**
   * The storylines running through the entries, the one that matters most
   * first, and the beats that belong to none (rest). A thread is the beats of
   * one matter (a deed, a trap, a taint, a harm: what was done, who saw it,
   * who was told and who reported it) or of what passed between two people
   * (talks, grudges, feuds, deeds), joined when they turn out to be one
   * story (the fight in a quarrel), with what its people felt along the way.
   * Everything about its matters is in it whatever it scores; a thread needs
   * two beats and one scoring `min` (default 0.4); the rest are what score
   * `min` too.
   */
  threads(entries: LogEntry[] | Minutes, opts: TellOptions = {}): { threads: Thread[]; rest: Beat[] } {
    const min = opts.min ?? 0.4;
    const beats = this.beats(entries, { ...opts, min: Math.min(min, FLOOR), who: undefined });
    // what each beat is about; matters are one story only when a single entry links them (a quarrel that
    // came to blows, a trap and the harm it did), never for happening in the same minute
    const about = this.matters(beats);
    const root = new Map<string, string>();
    const find = (k: string): string => { if (!root.has(k)) root.set(k, k); let r = k; while (root.get(r) !== r) r = root.get(r)!; root.set(k, r); return r; };
    for (const a of about) for (const link of a.links) for (const k of link) root.set(find(k), find(link[0]));
    // a beat goes in every story it's about
    const groups = new Map<string, { keys: Set<string>; beats: Beat[] }>();
    beats.forEach((b, i) => {
      for (const r of new Set(about[i].keys.map(find))) {
        const g = groups.get(r) ?? { keys: new Set<string>(), beats: [] };
        for (const k of about[i].keys) if (find(k) === r) g.keys.add(k);
        g.beats.push(b);
        groups.set(r, g);
      }
    });
    // a thread's people: who did and who it was done to, the most involved first
    const threads: Thread[] = [];
    for (const g of groups.values()) {
      const n = new Map<Id, number>();
      for (const b of g.beats) for (const id of [...b.who, ...b.with]) n.set(id, (n.get(id) || 0) + 1);
      for (const k of g.keys) for (const id of this.keyPeople(k, g.beats)) n.set(id, (n.get(id) || 0) + 2);
      const people = [...n.keys()].filter((id) => this.w.s.people[id]).sort((a, b) => n.get(b)! - n.get(a)!);
      threads.push({ keys: [...g.keys].sort(), title: '', parts: [], people, beats: g.beats, t: g.beats[0].t, end: 0, score: 0 });
    }
    // what its core people felt in its course comes with it (the closest thread before, when there are several)
    const taken = new Set(threads.flatMap((th) => th.beats));
    for (const b of beats) {
      if (taken.has(b) || b.score < min || b.who.length !== 1 || !b.kinds.every((k) => PERSONAL.has(k)) || !(b.kinds.includes('felt') || b.kinds.includes('broke'))) continue;
      let best: Thread | undefined, gap = Infinity;
      for (const th of threads) {
        if (!th.people.slice(0, 2).includes(b.who[0])) continue;
        // (after something in it that mattered, that they were in: a joke that went fine leaves nobody upset,
        // and a poisoning nobody knows of yet troubles nobody)
        const before = th.beats.filter((x) => x.t <= b.t && x.score >= min && (x.who.includes(b.who[0]) || x.with.includes(b.who[0])));
        if (!before.length) continue;
        const d = b.t - before[before.length - 1].t;
        if (d <= AFTER && d < gap) { gap = d; best = th; }
      }
      if (best) { best.beats.push(b); best.beats.sort((x, y) => x.t - y.t); taken.add(b); }
    }
    const kept: Thread[] = [];
    for (const th of threads) {
      th.score = Math.max(...th.beats.map((b) => b.score));
      const story = th.keys.some((k) => !k.startsWith('pair:')) || th.beats.some((b) => b.entries.some((e) => BETWEEN.has(e.k)) || this.hostile(b));
      if (th.beats.length < 2 || th.score < min || !story) continue;
      th.end = Math.max(...th.beats.map((b) => b.end ?? b.t));
      th.parts = partsOf(this.title(th));
      th.title = textOf(th.parts);
      kept.push(th);
    }
    kept.sort((a, b) => b.score - a.score || a.t - b.t);
    // (a beat in a thread that wasn't kept may be in one that was)
    const told = new Set(kept.flatMap((th) => th.beats));
    const who = opts.who;
    return {
      threads: who === undefined ? kept : kept.filter((th) => th.people.includes(who)),
      rest: beats.filter((b) => !told.has(b) && b.score >= min && (who === undefined || this.concerns(b, who))),
    };
  }

  /** When a time is, as tell's paragraphs say it: "Day 0, early morning". */
  when(t: Minutes, opts: TellOptions = {}): string {
    const periods = opts.periods ?? PERIODS;
    const day = Math.floor((t + 1e-6) / DAY);
    const hour = ((t % DAY) + DAY) % DAY / HOUR;
    let i = 0;
    for (let j = 0; j < periods.length; j++) if (hour >= periods[j][0]) i = j;
    return `${(opts.day ?? ((d: number) => `Day ${d}`))(day)}, ${periods[i][1]}`;
  }

  /** Whether a beat is about someone: theirs, with them in it, or naming them. */
  private concerns(b: Beat, who: Id): boolean {
    return b.who.includes(who) || b.with.includes(who) || b.entries.some((e) => this.w.westmarch.about(e, who));
  }

  // -------------------------------------------------------------------------
  // Folding: entries into clauses
  // -------------------------------------------------------------------------

  private fold(entries: LogEntry[]): Clause[] {
    const out: Clause[] = [];
    const doing = new Map<Id, Clause>();   // each person's action under way
    const ended = new Map<Id, Clause>();   // and the last one they finished
    const walks = new Map<Id, Clause>();   // a walk not yet told
    const talks = new Map<unknown, Clause>(); // Bree's talks under way, by id
    const here = new Map<Id, Id>();        // where each was last, as far as the entries say
    const add = (c: Omit<Clause, 'order'>): Clause => { const n = { ...c, order: out.length } as Clause; out.push(n); return n; };
    const walked = (who: Id) => walks.delete(who);
    for (const e of entries) {
      const who = e.who;
      const d: any = e.d || {};
      if (who !== undefined) switch (e.k) {
        case 'set-out': {
          walked(who);
          walks.set(who, add({ t: e.t, who, with: [], place: d.to, kinds: ['set-out'], entries: [e], sig: 'walk', walk: { to: d.to } }));
          continue;
        }
        case 'arrived': {
          here.set(who, d.place);
          const c = walks.get(who);
          if (c && c.walk!.arrived === undefined && c.walk!.to === d.place) { c.walk!.arrived = e.t; c.end = e.t; c.kinds.push('arrived'); c.entries.push(e); continue; }
          walks.set(who, add({ t: e.t, who, with: [], place: d.place, kinds: ['arrived'], entries: [e], sig: 'walk', walk: { to: d.place, arrived: e.t } }));
          continue;
        }
        case 'started': {
          if (d.place) here.set(who, d.place);
          // the same again, straight after, is more of it (a shift baked an hour at a time)
          const last = ended.get(who);
          if (last && last.end === e.t && !walks.has(who) && last.act!.action === d.action && last.place === d.place && last.act!.target === d.target) {
            delete last.end;
            last.act!.at = e.t;
            last.entries.push(e);
            ended.delete(who);
            doing.set(who, last);
            continue;
          }
          // the walk there, told with it
          const c = walks.get(who);
          const via = c && c.walk!.arrived === e.t && c.walk!.to === d.place ? c : undefined;
          walked(who);
          const act = { action: d.action, start: e.t, at: e.t, ...(d.target !== undefined ? { target: d.target } : {}), company: [], walked: !!via, felt: [] };
          const n: Omit<Clause, 'order'> = { t: via ? via.t : e.t, who, with: d.target !== undefined ? [d.target] : [], place: d.place, kinds: ['started'], entries: [...(via?.entries ?? []), e], sig: 'act:' + d.action, act };
          if (via) { Object.assign(via, n); delete via.walk; delete via.end; doing.set(who, via); } else doing.set(who, add(n));
          continue;
        }
        case 'met': {
          const c = doing.get(who);
          if (c && c.act!.at === e.t) {
            if (d.target !== c.act!.target && !c.act!.company.includes(d.target)) { c.act!.company.push(d.target); c.with.push(d.target); }
            c.entries.push(e);
            continue;
          }
          break;
        }
        case 'finished': case 'stopped': {
          const c = doing.get(who);
          if (c && c.act!.action === d.action) { c.end = e.t; c.kinds.push(e.k); c.entries.push(e); doing.delete(who); ended.set(who, c); }
          // (an action that started before the entries told is left untold)
          continue;
        }
        case 'interrupted': case 'social': case 'did': {
          // said of the action that just ended: why, how it went, the deed it was
          const c = [doing.get(who), ended.get(who)].find((x) => x && (x.end === undefined || x.end === e.t) &&
            (e.k === 'interrupted' ? x.act!.action === d.action : x.act!.target === (e.k === 'did' ? d.for ?? d.to ?? d.target : d.target)));
          // (a deed told by the action it came of: "helped Lena out")
          if (c && (e.k !== 'did' || c.act!.target !== undefined)) {
            if (e.k === 'social') c.act!.ok = !!d.ok;
            c.entries.push(e);
            continue;
          }
          break;
        }
        case 'exchange': {
          talks.set(d.id, add({ t: e.t, who, with: [...(d.with || [])], place: here.get(who), kinds: ['exchange'], entries: [e], sig: 'talk:' + d.kind, talk: { kinds: [d.kind] } }));
          continue;
        }
        case 'joined': case 'parted': case 'escalated': case 'exchanged': {
          const c = d.id !== undefined ? talks.get(d.id) : undefined;
          if (!c) break;
          c.entries.push(e);
          if (e.k === 'joined' && who !== c.who && !c.with.includes(who)) c.with.push(who);
          if (e.k === 'escalated') { c.talk!.kinds.push(d.to); c.kinds.push('escalated'); c.sig = 'talk:' + d.to; }
          if (e.k === 'exchanged') { c.end = e.t; c.talk!.outcome = d.outcome; c.kinds.push('exchanged'); talks.delete(d.id); }
          continue;
        }
      }
      const text = this.say(e);
      if (text === null) continue;
      const other = d.target ?? d.against ?? d.by ?? d.to ?? d.for ?? d.suspect ?? d.actor;
      add({
        t: e.t, ...(who !== undefined ? { who } : {}), with: typeof other === 'string' && other !== who && this.w.s.people[other] ? [other] : [],
        ...(typeof d.place === 'string' ? { place: d.place } : {}), kinds: [e.k], entries: [e],
        sig: e.k + ':' + (d.feeling ?? d.task ?? d.kind ?? d.verb ?? d.wish ?? d.key ?? d.course ?? ''), text,
      });
    }
    // a feeling that came of finishing something, told with it ("showered, and felt fresh")
    const finished = new Map<string, Clause>();
    for (const c of out) if (c.act && c.end !== undefined) finished.set(`${c.who}@${c.end}`, c);
    const kept = out.filter((c) => {
      if (c.kinds[0] !== 'felt') return true;
      const act = finished.get(`${c.who}@${c.t}`);
      const cause = (c.entries[0].d as any)?.cause;
      if (!act || !c.text || (cause !== undefined && cause !== act.act!.action)) return true;
      act.act!.felt.push(c.text);
      act.kinds.push('felt');
      act.entries.push(c.entries[0]);
      act.sig += '+' + c.sig;
      return false;
    });
    // a suspicion with a blame of the same person, told by the blame
    const blamed = new Set(kept.filter((c) => c.kinds[0] === 'blamed').map((c) => `${c.who}@${c.t}>${(c.entries[0].d as any)?.by}`));
    for (let i = kept.length - 1; i >= 0; i--) {
      const c = kept[i];
      if (c.kinds[0] === 'suspect' && blamed.has(`${c.who}@${c.t}>${(c.entries[0].d as any)?.suspect}`)) kept.splice(i, 1);
    }
    // a chat both started at once, told by the first
    const acts = new Map<string, Clause>();
    const once = kept.filter((c) => {
      if (!c.act || c.act.target === undefined) return true;
      if (acts.has(`${c.act.target}>${c.who}@${c.act.start}:${c.act.action}`)) return false;
      acts.set(`${c.who}>${c.act.target}@${c.act.start}:${c.act.action}`, c);
      return true;
    });
    for (const c of once) if (c.text === undefined) c.text = c.act ? this.acted(c) : c.talk ? this.talked(c) : this.went(c);
    return once.sort((a, b) => a.t - b.t || a.order - b.order);
  }

  /** How much a clause matters, before what's rare counts. */
  private weigh(c: Clause, weight: (k: string) => number): number {
    const w = this.w;
    if (c.act) {
      const def = w.actions.get(c.act.action);
      let s = weight('started') + (c.with.length ? 0.1 : 0);
      if (def?.job) s *= 0.3;
      if (def?.crime) s = Math.max(s, weight('witnessed'));
      if (c.act.ok === false) s += 0.15;
      return s;
    }
    if (c.talk) {
      const def = w.bree?.kinds.get(c.talk.kinds[c.talk.kinds.length - 1]);
      let s = weight('exchange');
      if (def?.tags?.includes('hostile')) s += 0.25;
      if (c.talk.kinds.length > 1) s = Math.max(s, weight('escalated'));
      if (c.talk.outcome === 'sour' || c.talk.outcome === 'row') s += 0.15;
      return s;
    }
    const k = c.kinds[0];
    if (k === 'felt') {
      const f = w.reverie?.feelingDefs.get((c.entries[0].d as any)?.feeling);
      return weight('felt') * (0.5 + Math.min(1, 8 * Math.abs(f?.weight ?? 0.06)));
    }
    return weight(k);
  }

  /** A minute's clauses, as one: "gave up on dinner at home, was frustrated, then read at home for an hour". What happened comes first, then how they felt, then what they did. */
  private join(clauses: Clause[]): string {
    const rank = (c: Clause) => (c.act || c.talk ? 2 : c.kinds[0] === 'felt' ? 1 : 0);
    const cs = clauses.slice().sort((a, b) => rank(a) - rank(b));
    const words = cs.map((c) => c.text!);
    if (words.length < 2) return words[0];
    const last = cs[cs.length - 1];
    return words.slice(0, -1).join(', ') + (last.act || last.talk ? ', then ' : ' and ') + words[words.length - 1];
  }

  // -------------------------------------------------------------------------
  // Threads
  // -------------------------------------------------------------------------

  /**
   * What each beat is about, for threads: its matters (a deed, a trap, a
   * taint, a harm), or when it's about none, the two people it passed
   * between. A crime seen, told or reported without knowing who did it
   * ('did:someone:theft') is the latest crime of its kind done before it,
   * whoever did that.
   */
  private matters(beats: Beat[]): Array<{ keys: string[]; links: string[][] }> {
    const crimes = new Map<string, string>(); // the latest crime of each kind
    const taints = new Map<Id, string>();     // the latest taint each person made
    return beats.map((b) => {
      // whoever it was: the latest crime of its kind; a harm by a taint: its maker's latest
      const resolve = (k: string) => (k.startsWith('did:someone:') ? crimes.get(k.slice(12)) : k.startsWith('taintby:') ? taints.get(k.slice(8)) : k);
      for (const e of b.entries) {
        const d: any = e.d || {};
        if (e.k === 'tainted' && e.who !== undefined) taints.set(e.who, 'taint:' + d.taint);
      }
      const links = this.keys(b).map((l) => l.map(resolve).filter((k): k is string => k !== undefined));
      for (const e of b.entries) {
        const crime = e.k === 'started' ? this.w.actions.get((e.d as any)?.action)?.crime : undefined;
        if (crime && e.who !== undefined) crimes.set(crime, `did:${e.who}:${crime}`);
      }
      const all = [...new Set(links.flat())];
      // a deed, a trap, a taint or a harm makes the story; who it was between only places what's about none
      const matters = all.filter((k) => !k.startsWith('pair:'));
      return { keys: matters.length ? matters : all, links: links.filter((l) => l.length) };
    });
  }

  /** Whether a beat holds a hostile talk (Bree's kinds tagged 'hostile'). */
  private hostile(b: Beat): boolean {
    return b.entries.some((e) => (e.k === 'exchange' || e.k === 'escalated') && this.w.bree?.kinds.get((e.d as any)?.[e.k === 'exchange' ? 'kind' : 'to'])?.tags?.includes('hostile'));
  }

  /**
   * What a beat's entries are about, for threads, an entry at a time (what
   * one entry names is linked): deeds ('did:sam:theft', a crime done, seen,
   * told or reported, or a talk that is one, like a fight), traps, taints and
   * harms by their ids, and the two people something passed between
   * ('pair:dev+sam'). A harm by a trap is linked to the trap sprung in the
   * same beat, and one by a taint to its maker's ('taintby:sam').
   */
  private keys(b: Beat): string[][] {
    const w = this.w;
    const links: string[][] = [];
    let out = new Set<string>();
    const pair = (a: unknown, b: unknown) => {
      if (typeof a === 'string' && typeof b === 'string' && a !== b && w.s.people[a] && w.s.people[b]) out.add('pair:' + [a, b].sort().join('+'));
    };
    const deed = (actor: unknown, kind: unknown) => { if (typeof actor === 'string' && (actor === 'someone' || w.s.people[actor]) && kind) out.add(`did:${actor}:${kind}`); };
    const traps = b.entries.filter((e) => e.k === 'sprung').map((e) => 'trap:' + (e.d as any)?.trap);
    for (const e of b.entries) {
      const d: any = e.d || {};
      const who = e.who;
      out = new Set<string>();
      switch (e.k) {
        case 'started': { const crime = w.actions.get(d.action)?.crime; if (crime) deed(who, crime); break; }
        case 'told': { const m = /^did:([^:]+):(.+)$/.exec(String(d.key)); if (m) deed(m[1], m[2]); else if (/^(trap|taint):/.test(String(d.key))) out.add(String(d.key)); break; }
        case 'witnessed': case 'report': case 'silenced': deed(d.actor, d.kind); break;
        case 'exchange': {
          for (const o of d.with || []) pair(who, o);
          const crime = w.bree?.kinds.get(d.kind)?.crime;
          if (crime) deed(who, crime);
          break;
        }
        case 'escalated': { pair(who, d.against); const crime = w.bree?.kinds.get(d.to)?.crime; if (crime) deed(who, crime); break; }
        case 'saw': pair(d.actor, d.against); break;
        case 'grudge': pair(who, d.against); break;
        case 'feud': case 'mended': pair(who, d.with); break;
        case 'sentiment': case 'regard': pair(who, d.target); break;
        case 'social': if (d.ok === false) pair(who, d.target); break;
        case 'did': pair(who, d.for ?? d.to ?? d.target); break;
        case 'yielded': case 'respond': case 'warned': pair(who, d.to); break;
        case 'harm': {
          out.add('harm:' + d.id);
          if (d.via === 'trap') for (const k of traps) out.add(k);
          if ((d.via === 'dose' || d.via === 'taint') && typeof d.by === 'string') out.add('taintby:' + d.by);
          break;
        }
        // (whom someone blames is part of what happened, not a story of their own)
        case 'blamed': case 'suspect': out.add('harm:' + d.harm); break;
        case 'noticed': case 'down': out.add('harm:' + d.harm); break;
        case 'set': case 'sprung': case 'disarmed': out.add('trap:' + d.trap); break;
        case 'tainted': out.add('taint:' + d.taint); break;
      }
      if (e.k === 'warned') out.add(d.trap !== undefined ? 'trap:' + d.trap : 'taint:' + d.taint);
      if (out.size) links.push([...out].sort());
    }
    return links;
  }

  /** The people a key names: the two of a pair, a deed's doer, a trap's setter and a taint's maker (from the beats). */
  private keyPeople(k: string, beats: Beat[]): Id[] {
    if (k.startsWith('pair:')) return k.slice(5).split('+');
    if (k.startsWith('did:')) return [k.split(':')[1]];
    const [kind, id] = k.split(':');
    const by = beats.flatMap((b) => b.entries).find((e) => (kind === 'trap' && e.k === 'set' && String((e.d as any)?.trap) === id) || (kind === 'taint' && e.k === 'tainted' && String((e.d as any)?.taint) === id));
    return by?.who !== undefined ? [by.who] : [];
  }

  /** A thread's title: its trap or taint ("Pip's snare"), its deed ("Sam's theft"), or its two people ("Dev and Sam at odds"). */
  private title(th: Thread): string {
    const entries = th.beats.flatMap((b) => b.entries);
    const trap = entries.find((e) => e.k === 'set');
    if (trap && trap.who !== undefined) return `${this.name(trap.who)}'s ${(trap.d as any)?.kind ?? 'trap'}`;
    const taint = entries.find((e) => e.k === 'tainted');
    if (taint && taint.who !== undefined) { const l = lower(this.w.athelas?.courses.get((taint.d as any)?.course)?.label ?? (taint.d as any)?.course ?? 'poison'); return `${this.name(taint.who)}'s ${l.charAt(0).toLowerCase() + l.slice(1)}`; }
    const deeds = th.keys.filter((k) => k.startsWith('did:')).map((k) => k.split(':'));
    if (deeds.length) {
      const by = deeds[0][1];
      const kinds = [...new Set(deeds.filter((d) => d[1] === by).map((d) => d[2]))];
      return `${this.name(by)}'s ${list(kinds)}`;
    }
    const pair = th.keys.find((k) => k.startsWith('pair:'));
    if (pair) {
      const [a, b] = pair.slice(5).split('+').sort((x, y) => th.people.indexOf(x) - th.people.indexOf(y));
      const odds = entries.some((e) => AT_ODDS.has(e.k) || (e.k === 'exchange' && this.w.bree?.kinds.get((e.d as any)?.kind)?.tags?.includes('hostile')));
      return `${this.name(a)} and ${this.name(b)}${odds ? ' at odds' : ''}`;
    }
    const hurt = entries.find((e) => e.k === 'harm');
    return hurt?.who !== undefined ? `What happened to ${this.name(hurt.who)}` : 'A story';
  }

  // -------------------------------------------------------------------------
  // Words
  // -------------------------------------------------------------------------

  /** A person, a group or a place by its name, people and places tagged for the parts. */
  private name(id: unknown): string {
    if (typeof id !== 'string') return 'someone';
    const w = this.w;
    const p = w.s.people[id];
    if (p) return tag('p', id, p.name);
    const g = w.fellowship?.groups.get(id)?.label;
    if (g) return g;
    const place = w.ring.get(id)?.name;
    return place ? tag('l', id, place) : id;
  }

  private isHome(id: Id | undefined, who?: Id): boolean {
    return id !== undefined && who !== undefined && this.w.s.people[who]?.def.home === id;
  }

  private placeName(id: Id | undefined, who?: Id): string {
    if (id === undefined) return 'somewhere';
    const w = this.w;
    if (this.isHome(id, who)) return tag('l', id, 'home');
    const named = w.ring.get(id)?.name;
    if (named) return tag('l', id, named);
    const lives = Object.values(w.s.people).find((p) => p.def.home === id);
    return tag('l', id, lives ? `${lives.name}'s place` : id);
  }

  /** "at home", "at Mara's Cafe". */
  private at(id: Id | undefined, who?: Id): string {
    return 'at ' + this.placeName(id, who);
  }

  /** "home", "to Mara's Cafe". */
  private to(id: Id | undefined, who?: Id): string {
    return (this.isHome(id, who) ? '' : 'to ') + this.placeName(id, who);
  }

  /** A walk not followed by anything told with it. */
  private went(c: Clause): string {
    return c.walk!.arrived !== undefined ? `went ${this.to(c.walk!.to, c.who)}` : `set out for ${this.placeName(c.walk!.to, c.who)}`;
  }

  /** An action from start to finish: "went to Mara's Cafe and ate, with Ines there". */
  private acted(c: Clause): string {
    const w = this.w;
    const a = c.act!;
    const def = w.actions.get(a.action);
    const label = def?.label ?? a.action;
    const going = c.end === undefined;
    const gerund = /^\w+ing\b/.test(label);
    const minutes = (c.end ?? a.start) - a.start;
    let words: string;
    let timed = false;
    if (going) words = def?.tell?.doing ?? (gerund ? `was ${label}` : `was having ${label}`);
    else if (def?.tell?.did) words = def.tell.did;
    else if (gerund && minutes >= 30) { words = `spent ${lasting(minutes)} ${label}`; timed = true; }
    else words = gerund ? `was ${label}` : `had ${label}`;
    // where: in the words, after them, or already said by the walk there
    if (a.walked) words = words.replace(/\s+(at|in|on|to|into|around|across|from)\s+\{place\}/g, '');
    const placed = words.includes('{place}');
    words = words.replace(/\{place\}/g, this.placeName(c.place, c.who)).replace(/\{target\}/g, this.name(a.target));
    if (!placed && !a.walked && c.place !== undefined) words += ' ' + this.at(c.place, c.who);
    if (!going && !timed && minutes >= 30) words += ' for ' + lasting(minutes);
    if (a.company.length) words += ', with ' + list(a.company.map((id) => this.name(id))) + ' there';
    if (a.ok === false) words += ', but it went badly';
    if (a.felt.length) words += ', and ' + list(a.felt);
    return a.walked ? `went ${this.to(c.place, c.who)} and ${words}` : words;
  }

  /** A talk (Bree): "argued with Lena at Mara's Cafe, which turned into a fight, and it ended in a row". */
  private talked(c: Clause): string {
    const kinds = this.w.bree?.kinds;
    const t = c.talk!;
    const first = kinds?.get(t.kinds[0]);
    const others = list(c.with.map((id) => this.name(id))) || 'nobody';
    let words = (first?.tell ?? `had ${first?.label ?? t.kinds[0]} with {with}`).replace(/\{with\}/g, others);
    if (c.place !== undefined) words += ' ' + this.at(c.place, c.who);
    if (t.kinds.length > 1) { const last = kinds?.get(t.kinds[t.kinds.length - 1]); words += `, which turned into ${last?.label ?? t.kinds[t.kinds.length - 1]}`; }
    const ended = t.outcome !== undefined ? ENDED[t.outcome] : undefined;
    if (ended) words += ', ' + ended;
    return words;
  }

  /** Any other entry: the game's words, Irulan's own, or describe's; null leaves it out. */
  private say(e: LogEntry): string | null {
    const w = this.w;
    const game = this.wordsFor.get(e.k);
    if (game) { const s = game(e, this.ctx); if (s !== undefined) return s; }
    const d: any = e.d || {};
    const name = (id: unknown) => this.name(id);
    const names = (ids: unknown) => (Array.isArray(ids) && ids.length ? list(ids.map(name)) : 'nobody');
    const task = (id: Id) => w.tasks.get(id)?.label ?? id;
    const wish = (id: Id) => lower(w.wishes.get(id)?.label ?? id);
    // (an illness is no name: 'Nightshade' is nightshade mid-sentence)
    const course = (id: Id) => { const l = lower(w.athelas?.courses.get(id)?.label ?? id); return l.charAt(0).toLowerCase() + l.slice(1); };
    const kind = (id: Id) => w.bree?.kinds.get(id)?.label ?? id;
    const where = d.place !== undefined ? ' ' + this.at(d.place, e.who) : '';
    // a belief by what it's about: 'did:sam:theft' is Sam's theft
    const about = (key: unknown) => {
      const m = /^did:([^:]+):(.+)$/.exec(String(key));
      if (/^trap:/.test(String(key))) return 'a trap';
      if (/^taint:/.test(String(key))) return 'something in the food';
      if (m && m[2] === 'harm') return `${m[1] === 'someone' ? 'someone' : name(m[1])} hurting someone`;
      return m ? (m[1] === 'someone' ? article(m[2]) : `${name(m[1])}'s ${m[2]}`) : String(key);
    };
    // why someone's suspected or blamed (Morgul's reasons)
    const because = (why: unknown) => (WHY[String(why)] ? ', ' + WHY[String(why)] : why ? ` (${why})` : '');
    // how deep a grudge or a feud runs
    const deep = (s: unknown) => (Number(s) >= 0.6 ? 'a deep ' : Number(s) < 0.2 ? 'a small ' : 'a ');
    // what a grudge is over: a kind of interaction, or harm
    const over = (why: unknown) => (why === 'harm' ? 'being hurt' : w.bree?.kinds.has(String(why)) ? kind(String(why)) : String(why));
    switch (e.k) {
      case 'day': case 'timer': case 'route': case 'planned': case 'director': case 'tuned': return null;
      case 'felt': { const f = w.reverie?.feelingDefs.get(d.feeling); if (f?.tell) return f.tell; break; }
      case 'broke': { const b = w.reverie?.breakDefs.get(d.kind); return b?.tell ?? `broke down${b?.label ? ' (' + b.label + ')' : ''}`; }
      case 'told': return `told ${name(d.to)} about ${about(d.key)}`;
      // (someone who saw a crime done to them was in it: the crime tells it)
      case 'witnessed': return d.what === e.who ? null : d.recognized ? `saw ${name(d.actor)}'s ${d.kind}${typeof d.what === 'string' && w.s.people[d.what] ? ' against ' + name(d.what) : ''}` : `saw ${article(d.kind)} without seeing who did it`;
      case 'report': return `reported ${d.actor === 'someone' ? article(d.kind) : name(d.actor) + '\'s ' + d.kind}${d.to ? ' to ' + name(d.to) : ''}`;
      case 'gave-up': return `gave up on ${task(d.task)} (${d.why})`;
      case 'done-plan': return `saw ${task(d.task)} through`;
      case 'wished': return w.wishes.get(d.wish)?.tell ?? `wished for ${wish(d.wish)}`;
      case 'granted': return `got ${wish(d.wish)}, as they'd wished`;
      case 'faded': return `stopped wishing for ${wish(d.wish)}`;
      case 'sentiment': return `thought ${Number(d.by) < 0 ? 'less' : 'well'} of ${name(d.target)}: "${d.label}"`;
      case 'regard': return `thought ${Number(d.by) < 0 ? 'less' : 'more'} of ${name(d.target)}`;
      case 'met': return `spent time with ${name(d.target)}`;
      case 'did': { const t = d.for ?? d.to ?? d.target; return `${d.verb}${t === undefined ? '' : ' ' + name(t)}`; }
      case 'owes': return `owed ${name(d.target)} ${d.n === 1 ? 'a favor' : d.n + ' favors'}`;
      case 'skill': return `became ${d.level} at ${(w.skills.defs.get(d.skill)?.label ?? d.skill).toLowerCase()}`;
      case 'afflicted': {
        // (from whom only for what's caught: a cut from a trap says nothing of who set it)
        const def = w.athelas?.courses.get(d.course);
        return `${def?.tell?.on ?? `came down with ${course(d.course)}`}${d.again ? ' again' : ''}${d.from && def?.contagion ? ' from ' + name(d.from) : ''}`;
      }
      case 'recovered': case 'healed': return w.athelas?.courses.get(d.course)?.tell?.over ?? `got over ${course(d.course)}`;
      case 'course': return `${course(d.course)} turned to ${w.athelas?.courses.get(d.course)?.phases.find((p) => p.id === d.phase)?.label ?? d.phase}`;
      case 'shows': return `was ${w.athelas?.courses.get(d.course)?.phases.find((p) => p.id === d.phase)?.label ?? d.phase}`;
      case 'tended': return `was seen to${d.by ? ' by ' + name(d.by) : ''}`;
      // Bree
      case 'saw': return `saw ${kind(d.kind)} between ${name(d.actor)} and ${name(d.against)}`;
      case 'grudge': return `bore ${name(d.against)} ${deep(d.strength)}grudge over ${over(d.why)}`;
      case 'feud': return Number(d.strength) > 0 ? `was in ${deep(d.strength)}feud with ${name(d.with)}` : `ended the feud with ${name(d.with)}`;
      case 'mended': return `made it up with ${name(d.with)}`;
      case 'escalated': return `turned ${kind(d.from)} with ${name(d.against)} into ${kind(d.to)}`;
      case 'exchange': return `${w.bree?.kinds.get(d.kind)?.tell?.replace(/\{with\}/g, names(d.with)) ?? `had ${kind(d.kind)} with ${names(d.with)}`}`;
      // Morgul
      case 'harm': {
        const badly = Number(d.severity) >= 0.6 ? 'badly ' : '';
        const by = d.by ? name(d.by) : 'someone';
        const how = d.via === 'trap' ? `was ${badly}hurt in ${by === 'someone' ? 'a' : by + '\'s'} trap`
          : d.via === 'dose' || d.via === 'taint' ? `was ${badly}hurt by what ${by} put in the food`
          : `was ${badly}hurt${d.by ? ' by ' + by : ''}`;
        return how + (d.intent === 'careless' ? ', by accident' : '');
      }
      case 'blamed': return `blamed ${name(d.by)}${because(d.why)}`;
      case 'suspect': return `suspected ${name(d.suspect)}${because(d.why)}`;
      case 'noticed': return `realized it was ${course(d.course)}`;
      case 'down': return 'went down';
      case 'up': return `got back up${d.by ? ' with ' + name(d.by) + '\'s help' : ''}`;
      case 'set': return `set ${article(d.kind)}${where}${d.for ? ' for ' + name(d.for) : ''}`;
      case 'sprung': return `was caught in ${article(d.kind)}${where}`;
      case 'disarmed': return `found and disarmed ${article(d.kind)}${where}`;
      case 'tainted': return `slipped ${course(d.course)} into ${d.item ? 'the ' + d.item : 'the food'}${d.place ? ' ' + this.at(d.place, e.who) : d.owner ? ' of ' + name(d.owner) : ''}`;
      case 'yielded': return `gave in to ${name(d.to)}`;
      case 'warned': return `warned ${name(d.to)} of ${d.trap !== undefined ? 'a trap' : 'something in the food'}`;
      case 'killed': return `was killed${d.by ? ' by ' + name(d.by) : ''}`;
    }
    return w.westmarch.describe(e);
  }
}
