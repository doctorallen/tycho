// Reverie: what people carry. Named for Westworld's reveries, the small
// gestures old memories leave behind.
//
//   feelings  with a weight, a lifetime and a stack limit (the fifth insult
//             of the week stings less than the first), adding up to a mood
//             and one named emotion (RimWorld's thoughts, The Sims 4's moodlets)
//   breaks    below set moods a break can come, more often the lower the mood,
//             picked by temperament, then a catharsis (RimWorld)
//   stress    on two timescales, and from acting against one's own values
//             (Dwarf Fortress, Crusader Kings 3)
//   memories  that fade by how long ago and how much they mattered; the
//             strongest become core memories that shift a trait, with the
//             reason kept (Dwarf Fortress, Generative Agents' scoring)
//   beliefs   about the world and each other, each with where it came from,
//             a strength that fades, and whether it's actually true (Talk of
//             the Town); plans and lines run on beliefs, not the truth
//   files     on the player (or anyone): met, helped, cheated, promised, owed
//             (the general idea of the Nemesis system)
import type { Module } from '../core/module';
import type { Candidate, Consideration, Doing, Id, PersonState, PlaceSpec, Value } from '../core/types';
import type { World } from '../core/world';
import { DAY, HOUR, clamp, round } from '../core/util';

export interface FeelingDef {
  id: Id;
  label?: string;
  /** How much it lifts (+) or sinks (-) the mood, -1..1. */
  weight: number;
  /** How long it lasts. */
  minutes: number;
  /** How many can stack (default 1: a new one refreshes the old). */
  stack?: number;
  /** Each extra stack counts this much of the one before (default 0.8). */
  stackMul?: number;
  /** The emotion it feeds: 'happy', 'angry', 'sad', 'scared', 'tense', 'guilty'... */
  emotion?: string;
  /** Stress it adds when felt (default: half its weight, if negative). */
  stress?: number;
  /** While felt, actions with these tags weigh this much more or less: { comfort: 1.5 }. */
  boost?: Record<string, number>;
}

export interface BreakDef {
  id: Id;
  /** 'minor', 'major' or 'extreme'. */
  level: 'minor' | 'major' | 'extreme';
  /** The action or task they break into. */
  do: Id;
  at?: PlaceSpec;
  /** How likely this break is for a person (a temperament), against the others at its level. */
  weight?: Consideration[];
  /** The feeling afterward. Default 'catharsis'. */
  after?: Id;
  label?: string;
}

export interface MemoryKindDef {
  id: Id;
  /** 1..10. Default 5. */
  importance?: number;
  /** Trait shifts if it becomes a core memory: { courage: -0.1 }. */
  shifts?: Record<string, number>;
  label?: string;
}

export interface Feeling { id: Id; t: number; until: number; w: number; cause?: string }
export interface Memory { k: Id; t: number; imp: number; recalls: number; about?: Id; place?: Id; text?: string; core?: boolean }
export interface Belief { key: string; v: Value; src: 'saw' | 'told' | 'assumed' | 'knew'; from?: Id; t: number; str: number; hops: number; silenced?: boolean }
export interface FileEntry { verb: string; t: number; what?: string }
export interface PersonFile { met: number; first: number; last: number; tally: Record<string, number>; notes: FileEntry[] }
export interface Shift { trait: string; by: number; cause: string; t: number }

interface State {
  f: Record<Id, Feeling[]>;
  m: Record<Id, Memory[]>;
  b: Record<Id, Record<string, Omit<Belief, 'key'>>>;
  files: Record<Id, Record<Id, PersonFile>>;
  st: Record<Id, [number, number, number]>;
  checked: Record<Id, number>;
  shifts: Record<Id, Shift[]>;
}

export interface ReverieConfig {
  /** Mood with no feelings and needs met. Default 0.6. */
  base: number;
  /** How much unmet needs drag the mood. Default 0.25. */
  needWeight: number;
  /** An emotion shows only above this strength. Default 0.08. */
  emotionFloor: number;
  /** Break thresholds: [mood below, mean days between breaks]. */
  minor: [number, number];
  major: [number, number];
  extreme: [number, number];
  memoryCap: number;
  coreCap: number;
  /** Memory strength lost per game hour (Generative Agents used 0.995). */
  memoryDecay: number;
  /** Beliefs weaker than this are forgotten. */
  beliefFloor: number;
  /** Belief strength kept per day. */
  beliefDecay: number;
  /** Stress half-lives in minutes. */
  stressShort: number;
  stressLong: number;
}

export const DEFAULT_REVERIE: ReverieConfig = {
  base: 0.6, needWeight: 0.25, emotionFloor: 0.08,
  minor: [0.35, 4], major: [0.2, 0.8], extreme: [0.08, 0.5],
  memoryCap: 24, coreCap: 8, memoryDecay: 0.995, beliefFloor: 0.05, beliefDecay: 0.97,
  stressShort: 12 * HOUR, stressLong: 7 * DAY,
};

/** Feelings every world has (a game can declare its own with the same ids to change them). */
const BUILTIN_FEELINGS: FeelingDef[] = [
  { id: 'catharsis', label: 'Got it out of my system', weight: 0.25, minutes: 2 * DAY, emotion: 'relieved' },
  { id: 'conscience', label: 'A guilty conscience', weight: -0.1, minutes: DAY, stack: 3, emotion: 'guilty' },
  { id: 'witnessed', label: 'Saw something bad', weight: -0.06, minutes: 12 * HOUR, stack: 2, emotion: 'tense' },
  { id: 'frustrated', label: 'Nothing went right', weight: -0.06, minutes: 6 * HOUR, stack: 3, emotion: 'angry' },
  { id: 'grief', label: 'Grieving', weight: -0.3, minutes: 7 * DAY, emotion: 'sad' },
  { id: 'scared', label: 'Frightened', weight: -0.15, minutes: DAY, stack: 2, emotion: 'scared' },
  { id: 'helped', label: 'Someone helped me', weight: 0.1, minutes: DAY, stack: 3, emotion: 'happy' },
  { id: 'wronged', label: 'Someone did me wrong', weight: -0.12, minutes: 2 * DAY, stack: 3, emotion: 'angry' },
];

export class Reverie implements Module {
  readonly name = 'reverie';
  readonly config: ReverieConfig;
  readonly feelingDefs = new Map<Id, FeelingDef>();
  readonly breakDefs = new Map<Id, BreakDef>();
  readonly memoryKinds = new Map<Id, MemoryKindDef>();
  private w!: World;

  constructor(cfg: Partial<ReverieConfig> = {}) {
    this.config = { ...DEFAULT_REVERIE, ...cfg };
    for (const f of BUILTIN_FEELINGS) this.feelingDefs.set(f.id, f);
  }

  init(): State { return { f: {}, m: {}, b: {}, files: {}, st: {}, checked: {}, shifts: {} }; }
  private get st(): State { return this.w.s.mod.reverie as State; }

  attach(w: World): void {
    this.w = w;
    const L = w.lang;
    L.term('mood', (c) => (c.person ? this.mood(c.person.id) : 0.5));
    L.term('stress', (c) => (c.person ? this.stress(c.person.id) : 0));
    L.term('emotion', (c, a) => (c.person ? (a ? this.emotion(c.person.id) === a : this.emotion(c.person.id)) : null));
    L.term('felt', (c, a) => (c.person ? this.feelings(c.person.id).some((f) => f.id === a) : false));
    L.term('believes', (c, a) => {
      if (!c.person) return null;
      const [key, want] = splitEq(a);
      const v = this.belief(c.person.id, key);
      return want === undefined ? v ?? null : v === want;
    });
    L.term('knows', (c, a) => (c.person ? this.belief(c.person.id, a) !== undefined : false));
    L.term('thinks', (c, a) => (c.person ? this.thinks(c.person.id, a) : w.s.facts[a] ?? null));
    L.term('file', (c, a) => {
      if (!c.person) return 0;
      const [subject, verb] = a.split('.');
      const file = this.file(c.person.id, subject === 'target' ? c.target ?? '' : subject);
      if (!file) return 0;
      return verb ? file.tally[verb] ?? 0 : file.met;
    });
    L.term('memories', (c, a) => (c.person ? (this.st.m[c.person.id] || []).filter((m) => !a || m.k === a).length : 0));
    // effects run inside the simulation, so they change state directly
    L.effect('feel', (c, a) => { if (c.person) this.applyFeel(c.person.id, a); });
    L.effect('believe', (c, a, _op, v) => { if (c.person) this.applyBelieve(c.person.id, a, v ?? true, 'knew'); });
    L.effect('forget', (c, a) => { if (c.person) delete this.st.b[c.person.id]?.[a]; });
    L.effect('remember', (c, a) => { if (c.person) this.applyRemember(c.person.id, { k: a, place: c.place ?? undefined, about: c.target ?? undefined }); });
    w.defineInput('feel', (id: Id, f: Id, cause: string | null) => this.applyFeel(id, f, cause));
    w.defineInput('believe', (id: Id, key: string, v: Value, src: Belief['src'], from: Id | null, str?: number) => this.applyBelieve(id, key, v, src, from, str));
    w.defineInput('remember', (id: Id, m: Partial<Memory> & { k: Id }) => this.applyRemember(id, m));
    w.defineInput('forget', (id: Id, key: string) => { delete this.st.b[id]?.[key]; });
  }

  // -------------------------------------------------------------------------
  // Declaring
  // -------------------------------------------------------------------------

  feeling(def: FeelingDef): this { this.feelingDefs.set(def.id, def); return this; }
  breakdown(def: BreakDef): this { this.breakDefs.set(def.id, def); return this; }
  memoryKind(def: MemoryKindDef): this { this.memoryKinds.set(def.id, def); return this; }

  // -------------------------------------------------------------------------
  // Feelings and mood
  // -------------------------------------------------------------------------

  /** Gives someone a feeling (from the game: recorded for time walk). */
  feel(id: Id, feeling: Id, cause?: string): void { this.w.input('feel', [id, feeling, cause ?? null]); }

  /** Gives a feeling inside the simulation (modules use this; the game uses feel()). */
  applyFeel(id: Id, feeling: Id, cause?: string | null): void {
    const def = this.feelingDefs.get(feeling);
    const p = this.w.s.people[id];
    if (!def || !p) return;
    const now = this.w.s.now;
    const list = (this.st.f[id] ||= []).filter((f) => f.until > now);
    const same = list.filter((f) => f.id === feeling);
    const cap = def.stack ?? 1;
    let w = def.weight;
    if (same.length >= cap) {
      // refresh the oldest
      const oldest = same.sort((a, b) => a.t - b.t)[0];
      oldest.t = now; oldest.until = now + def.minutes;
      if (cause) oldest.cause = cause;
    } else {
      w = def.weight * Math.pow(def.stackMul ?? 0.8, same.length);
      const f: Feeling = { id: feeling, t: now, until: now + def.minutes, w: round(w, 4) };
      if (cause) f.cause = cause;
      list.push(f);
    }
    this.st.f[id] = list;
    const stress = def.stress ?? (def.weight < 0 ? -def.weight * 0.5 : 0);
    if (stress) this.addStress(id, stress);
    this.w.log('felt', id, { feeling, label: def.label ?? feeling, ...(cause ? { cause } : {}) });
    this.w.emit('felt', { id, feeling, label: def.label ?? feeling, emotion: def.emotion ?? null });
  }

  /** Active feelings with their labels and weights. */
  feelings(id: Id): Array<{ id: Id; label: string; weight: number; until: number; emotion?: string; cause?: string }> {
    const now = this.w.s.now;
    return (this.st.f[id] || []).filter((f) => f.until > now).map((f) => {
      const def = this.feelingDefs.get(f.id);
      return { id: f.id, label: def?.label ?? f.id, weight: f.w, until: f.until, emotion: def?.emotion, cause: f.cause };
    });
  }

  /** Mood, 0 (miserable) to 1 (elated): feelings, less unmet needs. */
  mood(id: Id): number {
    const p = this.w.s.people[id];
    if (!p) return 0.5;
    let m = this.config.base;
    for (const f of this.feelings(id)) m += f.weight;
    let pen = 0, n = 0;
    for (const need of this.w.needs.keys()) { pen += this.w.mind.urgency(p, need); n++; }
    if (n) m -= (pen / n) * this.config.needWeight * 2;
    return round(clamp(m), 4);
  }

  /** The one named emotion showing now ('fine' when nothing stands out). */
  emotion(id: Id): string {
    const sums = new Map<string, number>();
    for (const f of this.feelings(id)) if (f.emotion) sums.set(f.emotion, (sums.get(f.emotion) || 0) + Math.abs(f.weight));
    // a pressing need shows too (hunger as 'irritable', loneliness as 'lonely')
    const p = this.w.s.people[id];
    if (p) for (const [nid, nd] of this.w.needs) {
      if (!nd.emotion) continue;
      const lvl = this.w.mind.level(p, nid);
      if (lvl > 0.7) sums.set(nd.emotion, (sums.get(nd.emotion) || 0) + (lvl - 0.7) * 0.8);
    }
    let best = 'fine', top = this.config.emotionFloor;
    for (const [e, v] of sums) if (v > top || (v === top && e < best)) { best = e; top = v; }
    return best;
  }

  // -------------------------------------------------------------------------
  // Stress
  // -------------------------------------------------------------------------

  /** Stress now: short-term and long-term together, 0..1. */
  stress(id: Id): number {
    const [s, l] = this.stressParts(id);
    return round(clamp(s * 0.6 + l * 0.6), 4);
  }

  stressParts(id: Id): [number, number] {
    const cur = this.st.st[id];
    if (!cur) return [0, 0];
    const dt = this.w.s.now - cur[2];
    const s = cur[0] * Math.pow(0.5, dt / this.config.stressShort);
    const l = cur[1] * Math.pow(0.5, dt / this.config.stressLong);
    return [s, l];
  }

  addStress(id: Id, amount: number): void {
    const [s, l] = this.stressParts(id);
    const ns = clamp(s + amount);
    const nl = clamp(l + amount * 0.15 + (ns > 0.6 ? 0.02 : 0));
    this.st.st[id] = [round(ns, 5), round(nl, 5), this.w.s.now];
  }

  // -------------------------------------------------------------------------
  // Memories
  // -------------------------------------------------------------------------

  /** Remembers something (from the game: recorded for time walk). */
  remember(id: Id, m: Partial<Memory> & { k: Id }): void { this.w.input('remember', [id, m]); }

  /** Remembers inside the simulation (modules use this). */
  applyRemember(id: Id, m: Partial<Memory> & { k: Id }): void {
    if (!this.w.s.people[id]) return;
    const kind = this.memoryKinds.get(m.k);
    const mem: Memory = { k: m.k, t: this.w.s.now, imp: clamp(m.imp ?? kind?.importance ?? 5, 1, 10), recalls: 0 };
    if (m.about) mem.about = m.about;
    if (m.place) mem.place = m.place;
    if (m.text) mem.text = m.text;
    const list = (this.st.m[id] ||= []);
    list.push(mem);
    const loose = list.filter((x) => !x.core);
    if (loose.length > this.config.memoryCap) {
      let worst = loose[0];
      for (const x of loose) if (this.strength(x) < this.strength(worst)) worst = x;
      list.splice(list.indexOf(worst), 1);
    }
  }

  /** How strongly a memory is held now: importance, faded by time. Core memories don't fade. */
  strength(m: Memory): number {
    if (m.core) return m.imp;
    const hours = (this.w.s.now - m.t) / HOUR;
    return m.imp * Math.pow(this.config.memoryDecay, hours);
  }

  /** Someone's memories, strongest first. */
  memories(id: Id): Memory[] { return (this.st.m[id] || []).slice().sort((a, b) => this.strength(b) - this.strength(a)); }

  /**
   * Brings memories to mind: the strongest matching ones (about someone, of
   * a kind). Recalling an important memory often enough can make it a core
   * memory that changes them.
   */
  recall(id: Id, match: { about?: Id; k?: Id; place?: Id } = {}, n = 3): Memory[] {
    const list = (this.st.m[id] || []).filter((m) => (!match.about || m.about === match.about) && (!match.k || m.k === match.k) && (!match.place || m.place === match.place));
    const out = list.sort((a, b) => this.strength(b) - this.strength(a)).slice(0, n);
    for (const m of out) {
      m.recalls++;
      if (!m.core && m.recalls >= 3 && m.imp >= 7) this.maybeCore(id, m);
    }
    return out;
  }

  private maybeCore(id: Id, m: Memory): void {
    const p = this.w.s.people[id];
    if (!p) return;
    const cores = (this.st.m[id] || []).filter((x) => x.core).length;
    if (cores >= this.config.coreCap) return;
    if (!this.w.stream(p).chance(1 / 3)) return;
    m.core = true;
    const kind = this.memoryKinds.get(m.k);
    const shifts = kind?.shifts || {};
    p.def.traits ||= {};
    for (const trait in shifts) {
      const before = p.def.traits[trait] ?? 0.5;
      const after = clamp(before + shifts[trait]);
      p.def.traits[trait] = round(after, 4);
      (this.st.shifts[id] ||= []).push({ trait, by: round(after - before, 4), cause: m.text ?? m.k, t: this.w.s.now });
    }
    this.w.log('changed', id, { memory: m.k, shifts });
    this.w.emit('changed', { id, memory: m.k, shifts });
  }

  /** How a person's traits have shifted, and why. */
  shifts(id: Id): Shift[] { return this.st.shifts[id]?.slice() ?? []; }

  // -------------------------------------------------------------------------
  // Beliefs
  // -------------------------------------------------------------------------

  /** Gives someone a belief (from the game: recorded for time walk). */
  believe(id: Id, key: string, v: Value, src: Belief['src'] = 'knew', from?: Id, str = 1): void {
    this.w.input('believe', [id, key, v, src, from ?? null, str]);
  }

  /** Changes a belief inside the simulation (modules use this). */
  applyBelieve(id: Id, key: string, v: Value, src: Belief['src'], from?: Id | null, str = 1, hops = 0): void {
    if (!this.w.s.people[id]) return;
    const map = (this.st.b[id] ||= {});
    const cur = map[key];
    const strength = clamp(str);
    if (cur && cur.v === v) {
      cur.str = round(Math.max(cur.str, strength), 4);
      cur.t = this.w.s.now;
      if (src === 'saw') cur.src = 'saw';
      return;
    }
    // something seen beats something heard; a stronger telling beats a weaker one
    if (cur && cur.src === 'saw' && src !== 'saw' && cur.str >= strength) return;
    if (cur && src !== 'saw' && cur.str > strength) return;
    const b: Omit<Belief, 'key'> = { v, src, t: this.w.s.now, str: round(strength, 4), hops };
    if (from) b.from = from;
    map[key] = b;
  }

  forget(id: Id, key: string): void { this.w.input('forget', [id, key]); }

  /** What someone believes about a key (undefined if they don't know or have forgotten). */
  belief(id: Id, key: string): Value | undefined {
    const b = this.st.b[id]?.[key];
    return b && b.str >= this.config.beliefFloor ? b.v : undefined;
  }

  /** The full belief record. */
  beliefRecord(id: Id, key: string): Belief | undefined {
    const b = this.st.b[id]?.[key];
    return b ? { key, ...b } : undefined;
  }

  /** What someone takes to be true: their belief, or the world's fact if they have none. */
  thinks(id: Id, key: string): Value {
    const b = this.belief(id, key);
    if (b !== undefined) return b;
    const f = this.w.s.facts[key];
    if (f !== undefined) return f;
    // no belief and no fact: the truth, as the condition language works it out ('open:cafe')
    const p = this.w.s.people[id];
    const v = this.w.lang.value(key, this.w.ctx(p));
    return v === undefined ? null : v;
  }

  /** All of someone's beliefs, strongest and newest first. */
  beliefs(id: Id): Belief[] {
    const map = this.st.b[id] || {};
    return Object.keys(map).map((key) => ({ key, ...map[key] })).filter((b) => b.str >= this.config.beliefFloor)
      .sort((a, b) => b.str - a.str || b.t - a.t || (a.key < b.key ? -1 : 1));
  }

  /** Is someone's belief true? (null when the world has no fact to check it against) */
  accurate(id: Id, key: string): boolean | null {
    const f = this.w.s.facts[key];
    if (f === undefined) return null;
    return this.belief(id, key) === f;
  }

  /** Marks a belief as one they won't pass on (paid or scared off). */
  silence(id: Id, key: string, on = true): void {
    const b = this.st.b[id]?.[key];
    if (b) { if (on) b.silenced = true; else delete b.silenced; }
  }

  /** The raw belief map (for Wormtongue). */
  beliefMap(id: Id): Record<string, Omit<Belief, 'key'>> { return (this.st.b[id] ||= {}); }

  // -------------------------------------------------------------------------
  // Files
  // -------------------------------------------------------------------------

  /** Someone's file on someone else (the player, usually). */
  file(id: Id, subject: Id): PersonFile | undefined { return this.st.files[id]?.[subject]; }

  /** Notes a deed in someone's file on someone. */
  note(id: Id, subject: Id, verb: string, what?: string): void {
    const files = (this.st.files[id] ||= {});
    const now = this.w.s.now;
    const f = (files[subject] ||= { met: 0, first: now, last: now, tally: {}, notes: [] });
    f.last = now;
    f.tally[verb] = (f.tally[verb] || 0) + 1;
    const e: FileEntry = { verb, t: now };
    if (what) e.what = what;
    f.notes.push(e);
    if (f.notes.length > 12) f.notes.shift();
  }

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------

  candidates(p: PersonState, out: Candidate[]): void {
    if (!this.breakDefs.size) return;
    const st = this.st, now = this.w.s.now;
    const last = st.checked[p.id] ?? now;
    st.checked[p.id] = now;
    const dt = Math.min(DAY, Math.max(0, now - last));
    if (dt <= 0) return;
    if (p.doing && p.doing.layer === 'break') return;
    const mood = this.mood(p.id);
    const c = this.config;
    const level = mood < c.extreme[0] ? 'extreme' : mood < c.major[0] ? 'major' : mood < c.minor[0] ? 'minor' : null;
    if (!level) return;
    const mtbDays = c[level][1];
    const r = this.w.stream(p);
    if (!r.chance(1 - Math.exp(-dt / (mtbDays * DAY)))) return;
    // the breaks at this level, or the nearest milder level that has some
    const order: Array<BreakDef['level']> = ['extreme', 'major', 'minor'];
    let defs: BreakDef[] = [];
    for (const lv of order.slice(order.indexOf(level))) {
      defs = [...this.breakDefs.values()].filter((d) => d.level === lv);
      if (defs.length) break;
    }
    const ctx = this.w.ctx(p);
    const pick = r.weighted(defs, (d) => (d.weight || []).reduce((acc, k) => acc * this.w.mind.consider(k, ctx), 1));
    if (!pick) return;
    const kind = this.w.tasks.has(pick.do) ? 'task' : 'action';
    const places = this.w.ring.resolve(pick.at ?? (this.w.actions.get(pick.do)?.at ?? null), p);
    out.push({ id: pick.do, kind, place: places[0] ?? null, rank: 4, layer: 'break', weight: 1, parts: [['break', 1]] });
    st.checked[p.id] = now;
    this.w.log('broke', p.id, { kind: pick.id, level, mood });
    this.w.emit('broke', { id: p.id, kind: pick.id, level, label: pick.label ?? pick.id });
  }

  consider(p: PersonState, c: Candidate): Array<[string, number]> | void {
    const out: Array<[string, number]> = [];
    const a = c.kind === 'action' ? this.w.actions.get(c.id) : undefined;
    const tags = a?.tags || this.w.tasks.get(c.id)?.tags;
    if (tags) {
      for (const f of this.feelings(p.id)) {
        const boost = this.feelingDefs.get(f.id)?.boost;
        if (!boost) continue;
        for (const t of tags) if (boost[t] !== undefined) out.push([f.label, boost[t]]);
      }
    }
    if (a?.against) {
      for (const v of a.against) {
        const held = p.def.values?.[v] ?? 0;
        if (held > 0) out.push([`against ${v}`, clamp(1 - held * 0.8, 0.05, 1)]);
      }
    }
    return out;
  }

  started(p: PersonState, d: Doing): void {
    if (d.kind !== 'act') return;
    const a = this.w.actions.get(d.action);
    if (!a?.against) return;
    let s = 0;
    for (const v of a.against) s += p.def.values?.[v] ?? 0;
    if (s > 0) {
      this.addStress(p.id, s * 0.3);
      if (this.feelingDefs.has('conscience')) this.applyFeel(p.id, 'conscience', a.id);
    }
  }

  ended(p: PersonState, d: Doing, frac: number, interrupted: boolean): void {
    if (d.kind !== 'act') return;
    const a = this.w.actions.get(d.action);
    if (a?.feels && !interrupted) for (const f of a.feels) this.applyFeel(p.id, f, a.id);
    if (d.layer === 'break' && frac > 0.5) {
      const def = [...this.breakDefs.values()].find((b) => b.do === d.action);
      this.applyFeel(p.id, def?.after ?? 'catharsis', 'a break');
      const [, l] = this.stressParts(p.id);
      this.st.st[p.id] = [0, round(l * 0.7, 5), this.w.s.now];
    }
  }

  did(actor: Id, verb: string, data: Record<string, Value>): void {
    const target = (data.for ?? data.to ?? data.target) as Id | undefined;
    const deed = this.w.deeds.get(verb);
    if (target && this.w.s.people[target]) {
      this.note(target, actor, verb, data.what === undefined ? undefined : String(data.what));
      if (deed?.feeling) this.applyFeel(target, deed.feeling, `${actor} ${verb}`);
      if (deed?.memory) this.applyRemember(target, { k: verb, about: actor, imp: deed.memory, text: `${actor} ${verb}${data.what ? ' ' + data.what : ''}` });
    }
    const seen = Array.isArray(data.seenBy) ? (data.seenBy as unknown as Id[]) : [];
    for (const wid of seen) {
      if (wid === target || !this.w.s.people[wid]) continue;
      this.note(wid, actor, verb, data.what === undefined ? undefined : String(data.what));
      if (deed?.witnessFeeling) this.applyFeel(wid, deed.witnessFeeling, `saw ${actor} ${verb}`);
    }
  }

  met(a: PersonState, b: PersonState): void {
    for (const [x, y] of [[a, b], [b, a]] as const) {
      const files = (this.st.files[x.id] ||= {});
      const f = files[y.id];
      if (f) { f.met++; f.last = this.w.s.now; }
    }
  }

  day(): void {
    const st = this.st, now = this.w.s.now, c = this.config;
    for (const id in st.f) { st.f[id] = st.f[id].filter((f) => f.until > now); if (!st.f[id].length) delete st.f[id]; }
    for (const id in st.b) {
      const map = st.b[id];
      for (const key in map) {
        map[key].str = round(map[key].str * (map[key].src === 'saw' ? Math.sqrt(c.beliefDecay) : c.beliefDecay), 4);
        if (map[key].str < c.beliefFloor) delete map[key];
      }
    }
    for (const id in st.m) {
      st.m[id] = st.m[id].filter((m) => m.core || this.strength(m) >= 0.5);
    }
  }

  removed(p: PersonState): void {
    const st = this.st;
    delete st.checked[p.id];
  }
}

function splitEq(a: string): [string, Value | undefined] {
  const i = a.indexOf('=');
  if (i < 0) return [a, undefined];
  const raw = a.slice(i + 1);
  const v: Value = raw === 'true' ? true : raw === 'false' ? false : raw !== '' && !isNaN(Number(raw)) ? Number(raw) : raw;
  return [a.slice(0, i), v];
}
