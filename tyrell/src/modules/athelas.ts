// Athelas: conditions that run a course. Named for the kingsfoil of The Lord
// of the Rings, the herb Aragorn used in the Houses of Healing.
//
// A course is something that comes on, runs through its phases and passes:
// ale wearing off into a sore head, a cold coming on and the sniffles after,
// a toadstool's toxin, a sprained ankle, the flu that lays someone up. Each
// phase lasts a while (longer or shorter for some people), and while it
// lasts it can change how fast needs rise, how much actions weigh, which are
// ruled out, and give a feeling. A course can be caught from others by time
// spent together, and can leave a while of immunity behind. Merryfolk's body
// chemistry and illnesses, generalized.
//
// Wounds and poisons (Morgul) need a little more, all of it opt-in: how bad
// an affliction is (its severity, which stretches its phases and deepens
// what they do), a second one adding to the first, phases whose next depends
// on conditions (a tended cut heals, an untended one festers), care (a
// tended mark, the better for skill), a phase that ends in death (through
// Cradle), and quiet phases nobody notices, with one that tells when the
// harm shows.
//
// It's a module of its own rather than part of Reverie: Reverie is the mind
// (feelings, mood, memories, beliefs), and a course is the body. It has its
// own clock (phases with durations), it changes how fast needs rise, it
// spreads from person to person and leaves immunity, none of which feelings
// do; and a game can want colds and ale without the whole of Reverie. When
// Reverie is on, a phase can give a feeling, so a course still shows in the
// mood.
//
// State is made the first time anyone is afflicted, so a world without
// courses saves and hashes as if Athelas weren't there.
import type { Module } from '../core/module';
import type { Candidate, Cond, Consideration, Effect, Id, PersonState, QueueItem } from '../core/types';
import type { World } from '../core/world';
import { round } from '../core/util';

/** Where a phase goes next, chosen by conditions: the first branch whose conditions hold. */
export interface CourseBranch {
  /** Conditions on the person (ctx.data.course is the course): 'tended:cut', 'sev:cut>0.5'. None: always. */
  if?: Cond[];
  /** The phase it goes to, by id; null: the course passes. */
  to: Id | null;
}

/** One phase of a course. */
export interface CoursePhase {
  id: string;
  label?: string;
  /**
   * Only for some: conditions on the person (ctx.data.course is the course),
   * read as the phase would start. One whose conditions don't hold is passed
   * over, as if it had run out at once (to its `next`), with nothing logged:
   * ale past a pint or two, 'sev:ale>0.6'. None: always.
   */
  if?: Cond[];
  /** How long it lasts: minutes, or [min, max] (drawn from the person's stream). */
  minutes: number | [number, number];
  /** Longer or shorter for some (hardiness): considerations on the person, multiplied into the minutes. */
  scale?: Consideration[];
  /** Needs rise this much faster or slower while it lasts: { energy: 1.6, hunger: 0.3 }. */
  rates?: Record<Id, number>;
  /** Options weigh this much more or less while it lasts: by action or task id, 'tag:<tag>', or '*' for the rest. */
  weigh?: Record<string, number>;
  /** Actions or tasks ruled out while it lasts: ids, or 'tag:<tag>'. */
  blocks?: string[];
  /** A feeling given when it starts (Reverie). Not in a quiet phase. */
  feel?: Id;
  /** Effects when it starts. */
  then?: Effect[];
  /** Stops what they're doing when it starts, so they choose again (laid up in bed). */
  stop?: boolean;
  /** Whether it can be caught from someone in this phase (with the course's `contagion`). Default true. */
  spreads?: boolean;
  /**
   * Where it goes when it runs out: a phase's id, null (the course passes),
   * or branches tried in order, the first whose conditions hold (a tended cut
   * heals, an untended one festers). Default, or when no branch holds: the
   * next phase in order, and after the last, the course passes.
   */
  next?: Id | null | CourseBranch[];
  /**
   * It ends in death: when it runs out they die (Cradle's departure, why
   * this or 'died'). Without Cradle, or spared (a wound's, by Morgul's
   * lethality), they pull through and it goes on as `next` says.
   */
  dies?: boolean | string;
  /**
   * Nobody notices it (poison working): it gives no feeling, and `under:`
   * reads it as not there, so lines and choices can't know of it. Its rates,
   * weights and blocks still work.
   */
  quiet?: boolean;
  /** The harm shows when it starts: the 'shows' event, and Morgul's onlookers and suspicion begin then. */
  tells?: boolean;
  /** How much of the course's severity it still counts toward Morgul's `hurt`: 1 at first, less as a wound heals. Default 1 (a quiet phase 0). */
  hurts?: number;
}

/** How severity changes a course (over the config's sevAt, sevStretch and sevDepth). */
export interface CourseSeverity {
  /** The severity its numbers are written for. */
  at?: number;
  /** How much severity stretches its phases. */
  stretch?: number;
  /** How much severity deepens what its phases do. */
  depth?: number;
}

/** A course: something that comes on, runs through its phases, and passes. */
export interface CourseDef {
  id: Id;
  label?: string;
  /**
   * Its words in a story (Irulan), as they'd follow the person's name: when
   * it comes on ('caught a cold') and when it's over ('shook off the cold').
   * Without them, 'came down with <label>' and 'got over <label>'. A list is
   * variants, one drawn for each telling.
   */
  tell?: { on?: string | string[]; over?: string | string[] };
  /** Free labels ('illness'): `under:tag:<tag>` asks whether any course with the tag is running. */
  tags?: string[];
  /** The phases, in order. */
  phases: CoursePhase[];
  /** Caught from others: the chance per hour spent together, and considerations on the catcher (and the carrier as their target), multiplied in. */
  contagion?: { chance: number; resist?: Consideration[] };
  /** Minutes after it passes when it can't come on again. Default 0. */
  immunity?: number;
  /**
   * Afflicted again while it runs: 'ignore' (default), 'extend' (the phase
   * runs on as long again: another pint), 'restart', or 'worsen' (the new
   * severity adds to the old, up to 1: a second beating).
   */
  again?: 'ignore' | 'extend' | 'restart' | 'worsen';
  /** Its own numbers for how severity changes it, over the config's. */
  severity?: CourseSeverity;
  /** Effects when it passes (not when it's cured). */
  then?: Effect[];
}

export interface AthelasConfig {
  /**
   * The headline knobs: plain multipliers, 1 changing nothing. A person's own
   * (PersonDef.tune.athelas) multiplies these for them alone: the catcher's
   * for contagion, the sufferer's for duration.
   */
  /** How catching courses are: every course's contagion chance per hour together. 0: nothing spreads. Default 1. */
  contagion: number;
  /** How long courses last: every phase's minutes (when it starts). Default 1. */
  duration: number;

  // Severity: only for a course afflicted with one (a wound, a dose).
  /** The severity a course's numbers are written for: at it, its phases run as written. Default 0.5. */
  sevAt: number;
  /** How much severity stretches the phases: each lasts sevStretch^((severity - sevAt) × 2) times as long (2: twice as long at 1, half at 0). 1: severity doesn't change how long. Default 2. */
  sevStretch: number;
  /** How much severity deepens what a phase does: its rates and weights are raised to the power 1 + sevDepth × (severity - sevAt) / sevAt (twice as deep at 1, nothing at 0). 0: severity doesn't change them. Default 1. */
  sevDepth: number;

  // Care: being tended.
  /** How good a tending is, 0..1: tendBase, plus the rest by the tender's share of tendSkill. Default 0.5. */
  tendBase: number;
  /** The skill that makes a tending better (null: none, every tending is tendBase). Default null. */
  tendSkill: string | null;
  /** A tending brings the end of the phase they're in sooner by this share of what's left, times how good it was. Default 0.25. */
  tendHasten: number;
}

export const DEFAULT_ATHELAS: AthelasConfig = { contagion: 1, duration: 1, sevAt: 0.5, sevStretch: 2, sevDepth: 1, tendBase: 0.5, tendSkill: null, tendHasten: 0.25 };

/** A course running for someone. */
interface Running {
  /** The phase it's in. */
  p: number;
  since: number;
  until: number;
  /** The token on its timer (an older timer is stale). */
  k: number;
  /** Who it was caught from. */
  from?: Id;
  /** How bad it is, 0..1 (only when afflicted with a severity). */
  sev?: number;
  /** How well it's been tended, 0..1 (only once tended). */
  tend?: number;
}

interface State {
  on: Record<Id, Record<Id, Running>>;
  immune: Record<Id, Record<Id, number>>;
  k: number;
}

/** A course running for someone, as the game sees it. */
export interface CourseView {
  course: Id; label: string; phase: string; phaseLabel: string; since: number; until: number;
  from?: Id;
  /** Its severity, if it was given one. */
  severity?: number;
  /** How well it's been tended, once tended. */
  tended?: number;
  /** In a quiet phase: nobody has noticed it. */
  quiet?: boolean;
}

export class Athelas implements Module {
  readonly name = 'athelas';
  readonly config: AthelasConfig;
  readonly knobs = { contagion: 'person', duration: 'person' } as const;
  readonly courses = new Map<Id, CourseDef>();
  private w!: World;

  constructor(cfg: Partial<AthelasConfig> = {}) { this.config = { ...DEFAULT_ATHELAS, ...cfg }; }

  /** The config in force: as declared, under any world.tune. */
  private get c(): AthelasConfig { return this.w.tuned(this.name, this.config); }
  /** A headline knob for someone: the world's (as tuned), times their own. */
  private knob(name: 'contagion' | 'duration', p: PersonState): number { return this.c[name] * this.w.own(p, this.name, name); }

  /** The state for reading: undefined until someone is first afflicted. */
  private get st(): State | undefined { return this.w.s.mod.athelas as State | undefined; }
  /** The state for writing (inside the simulation): made when first needed. */
  private mut(): State { return (this.w.s.mod.athelas ||= { on: {}, immune: {}, k: 0 }) as State; }

  attach(w: World): void {
    this.w = w;
    const L = w.lang;
    // what's known: a quiet phase reads as not there
    L.term('under', (c, a) => {
      if (!c.person) return a ? false : 0;
      const on = this.st?.on[c.person.id];
      const shows = (id: Id): boolean => !this.quiet(id, on?.[id]);
      if (!a) return on ? Object.keys(on).filter(shows).length : 0;
      if (a.startsWith('tag:')) return !!on && Object.keys(on).some((id) => shows(id) && this.courses.get(id)?.tags?.includes(a.slice(4)));
      const r = on?.[a];
      return r && shows(a) ? this.courses.get(a)?.phases[r.p]?.id ?? true : false;
    });
    L.term('immune', (c, a) => (c.person ? this.immune(c.person.id, a) : false));
    // how bad a course is (as written, without a severity of its own), the worst with a tag; 0 when it isn't running
    L.term('sev', (c, a) => {
      if (!c.person) return 0;
      const on = this.st?.on[c.person.id];
      if (!on) return 0;
      if (a.startsWith('tag:')) {
        let best = 0;
        for (const id of Object.keys(on)) if (this.courses.get(id)?.tags?.includes(a.slice(4))) best = Math.max(best, this.severity(id, on[id]));
        return best;
      }
      return on[a] ? this.severity(a, on[a]) : 0;
    });
    // how well it's been tended, 0 if not (with no course, the best tending of any)
    L.term('tended', (c, a) => {
      const on = c.person ? this.st?.on[c.person.id] : undefined;
      if (!on) return 0;
      if (a) return on[a]?.tend ?? 0;
      let best = 0;
      for (const id of Object.keys(on)) best = Math.max(best, on[id].tend ?? 0);
      return best;
    });
    L.effect('afflict', (c, a, op, v) => { if (c.person) this.applyAfflict(c.person.id, a, c.target ?? undefined, op && typeof v === 'number' ? v : undefined); });
    L.effect('cure', (c, a) => { if (c.person) this.applyCure(c.person.id, a || undefined); });
    L.effect('hasten', (c, a, _op, v) => { if (c.person) this.applyHasten(c.person.id, a, Number(v ?? 0)); });
    // the person tends the target (or themselves, with none): every course, or the one named
    L.effect('tend', (c, a) => { if (c.person) this.applyTend(c.target ?? c.person.id, a || undefined, c.person.id); });
    w.defineInput('afflict', (id: Id, course: Id, from: Id | null, sev?: number | null) => this.applyAfflict(id, course, from ?? undefined, sev ?? undefined));
    w.defineInput('cure', (id: Id, course: Id | null) => this.applyCure(id, course ?? undefined));
    w.defineInput('hasten', (id: Id, course: Id, minutes: number) => this.applyHasten(id, course, minutes));
    w.defineInput('tend', (id: Id, course: Id | null, by: Id | null) => this.applyTend(id, course ?? undefined, by ?? undefined));
  }

  // -------------------------------------------------------------------------
  // Declaring and asking
  // -------------------------------------------------------------------------

  course(def: CourseDef): this { this.courses.set(def.id, def); return this; }

  /** The courses running for someone: which phase, since and until when, and how bad, tended and noticed. */
  of(id: Id): CourseView[] {
    const on = this.st?.on[id];
    if (!on) return [];
    return Object.keys(on).map((course) => {
      const r = on[course], def = this.courses.get(course), ph = def?.phases[r.p];
      const out: CourseView = {
        course, label: def?.label ?? course, phase: ph?.id ?? String(r.p), phaseLabel: ph?.label ?? ph?.id ?? '', since: r.since, until: r.until,
      };
      if (r.from) out.from = r.from;
      if (r.sev !== undefined) out.severity = r.sev;
      if (r.tend !== undefined) out.tended = r.tend;
      if (ph?.quiet) out.quiet = true;
      return out;
    });
  }

  /** Is someone immune to a course now? */
  immune(id: Id, course: Id): boolean { return (this.st?.immune[id]?.[course] ?? -Infinity) > this.w.s.now; }

  /** A course's severity for someone: its own, or the severity its numbers are written for; undefined if it isn't running. */
  severityOf(id: Id, course: Id): number | undefined {
    const r = this.st?.on[id]?.[course];
    return r ? this.severity(course, r) : undefined;
  }

  /** The phase a course is in for someone, if it's running (the truth: quiet or not). */
  phaseOf(id: Id, course: Id): CoursePhase | undefined {
    const r = this.st?.on[id]?.[course];
    return r ? this.courses.get(course)?.phases[r.p] : undefined;
  }

  /**
   * Afflicts someone with a course (from the game: recorded), at a severity
   * (0..1) if it's given one. Returns whether it took.
   */
  afflict(id: Id, course: Id, from?: Id, severity?: number): boolean {
    return this.w.input('afflict', severity === undefined ? [id, course, from ?? null] : [id, course, from ?? null, severity]) === true;
  }

  /** Cures someone of a course, or of every course (from the game: recorded). */
  cure(id: Id, course?: Id): void { this.w.input('cure', [id, course ?? null]); }

  /** Brings the end of the phase someone's in sooner by some minutes (a visit, a remedy that helps): recorded. */
  hasten(id: Id, course: Id, minutes: number): void { this.w.input('hasten', [id, course, minutes]); }

  /** Someone tends someone's course (or every course they have), by someone if given (their skill counts): recorded. */
  tend(id: Id, course?: Id, by?: Id): void { this.w.input('tend', [id, course ?? null, by ?? null]); }

  // -------------------------------------------------------------------------
  // Severity
  // -------------------------------------------------------------------------

  /** The severity a course's numbers are written for, how much severity stretches it, and how much it deepens it. */
  private sevOf(def: CourseDef | undefined): { at: number; stretch: number; depth: number } {
    const c = this.c, s = def?.severity;
    return { at: s?.at ?? c.sevAt, stretch: s?.stretch ?? c.sevStretch, depth: s?.depth ?? c.sevDepth };
  }

  private severity(course: Id, r: Running): number { return r.sev ?? this.sevOf(this.courses.get(course)).at; }

  /** How much longer a phase runs at a severity: stretch^((severity - at) × 2). */
  private stretch(def: CourseDef, sev: number | undefined): number {
    if (sev === undefined) return 1;
    const s = this.sevOf(def);
    return Math.pow(Math.max(0, s.stretch), (sev - s.at) * 2);
  }

  /** How much deeper what a phase does goes at a severity: rates and weights are raised to this power. */
  private depth(def: CourseDef | undefined, sev: number | undefined): number {
    if (sev === undefined) return 1;
    const s = this.sevOf(def);
    return Math.max(0, 1 + s.depth * (s.at > 0 ? (sev - s.at) / s.at : sev));
  }

  /** Is a course in a quiet phase (nobody notices it)? */
  private quiet(course: Id, r: Running | undefined): boolean { return !!r && !!this.courses.get(course)?.phases[r.p]?.quiet; }

  // -------------------------------------------------------------------------
  // Running a course
  // -------------------------------------------------------------------------

  private phaseMinutes(p: PersonState, course: Id, ph: CoursePhase, r: Running): number {
    let m = Array.isArray(ph.minutes) ? this.w.stream(p).range(ph.minutes[0], ph.minutes[1]) : ph.minutes;
    if (ph.scale?.length) {
      const ctx = this.w.ctx(p);
      for (const k of ph.scale) m *= this.w.mind.consider(k, ctx);
    }
    // the headline knob: how long courses last for them
    m *= this.knob('duration', p);
    // how bad it is, and (a wound) how fast they heal
    if (r.sev !== undefined) m *= this.stretch(this.courses.get(course) as CourseDef, r.sev);
    const morgul = this.w.morgul;
    if (morgul) m *= morgul.paceOf(p, course);
    return round(Math.max(1, m), 4);
  }

  private schedule(id: Id, course: Id, r: Running): void {
    r.k = ++this.mut().k;
    this.w.clock.schedule({ t: r.until, k: 'module', ref: this.name, who: id, data: { c: course, k: r.k } });
  }

  private label(def: CourseDef, ph: CoursePhase | undefined): string { return (def.label ?? def.id) + (ph?.label ? `: ${ph.label}` : ''); }

  /** Afflicts someone, inside the simulation (at a severity, 0..1, if given). */
  applyAfflict(id: Id, course: Id, from?: Id, sev?: number): boolean {
    const w = this.w;
    const p = w.s.people[id];
    const def = this.courses.get(course);
    if (!p || p.status === 'gone' || !def || !def.phases.length) return false;
    const now = w.s.now;
    const given = sev === undefined || !isFinite(sev) ? undefined : round(Math.min(1, Math.max(0, sev)), 4);
    const cur = this.st?.on[id]?.[course];
    if (cur) {
      const again = def.again ?? 'ignore';
      if (again === 'ignore') return false;
      if (again === 'extend') {
        if (given !== undefined) { w.mind.settleRise(p); cur.sev = Math.max(cur.sev ?? 0, given); }
        cur.until = round(cur.until + this.phaseMinutes(p, course, def.phases[cur.p], cur), 4);
        this.schedule(id, course, cur);
      } else if (again === 'worsen') {
        // a second one adds to the first, up to 1; the phase they're in runs as long as it would have at the new severity
        w.mind.settleRise(p);
        const at = this.sevOf(def).at;
        const before = cur.sev ?? at;
        const next = round(Math.min(1, before + (given ?? at)), 4);
        const f0 = this.stretch(def, before), f1 = this.stretch(def, next);
        cur.sev = next;
        if (f0 > 0) cur.until = round(Math.max(now, cur.since + (cur.until - cur.since) * (f1 / f0)), 4);
        this.schedule(id, course, cur);
        if (p.doing) w.clock.scheduleChecks(p);
      } else {
        w.mind.settleRise(p);
        if (given !== undefined) cur.sev = given;
        this.enter(p, course, 0);
      }
      w.log('afflicted', id, { course, again, ...(cur.sev !== undefined ? { severity: cur.sev } : {}) });
      w.emit('afflicted', { id, course, from: from ?? null, label: def.label ?? course, again, ...(cur.sev !== undefined ? { severity: cur.sev } : {}) });
      return true;
    }
    if (this.immune(id, course)) return false;
    const st = this.mut();
    if (st.immune[id]) { delete st.immune[id][course]; if (!Object.keys(st.immune[id]).length) delete st.immune[id]; }
    w.mind.settleRise(p);
    const r: Running = { p: 0, since: now, until: now, k: 0 };
    if (from) r.from = from;
    if (given !== undefined) r.sev = given;
    (st.on[id] ||= {})[course] = r;
    w.log('afflicted', id, { course, ...(from ? { from } : {}), ...(given !== undefined ? { severity: given } : {}) });
    w.emit('afflicted', { id, course, from: from ?? null, label: def.label ?? course, ...(given !== undefined ? { severity: given } : {}), ...(def.phases[0].quiet ? { quiet: true } : {}) });
    this.enter(p, course, 0);
    return true;
  }

  /** Starts a phase (needs settled by the caller); one whose `if` doesn't hold is passed over, and with none left the course passes. */
  private enter(p: PersonState, course: Id, i: number): void {
    const w = this.w;
    const def = this.courses.get(course) as CourseDef;
    const r = (this.st as State).on[p.id][course];
    // phases only some go through, passed over as if they'd run out at once (a loop of them is entered after one round)
    for (let n = 0; def.phases[i]?.if?.length && n < def.phases.length; n++) {
      if (w.lang.all(def.phases[i].if, w.ctx(p, { data: { course } }))) break;
      const next = this.nextOf(p, def, i);
      if (next < 0) { this.end(p, course, false); return; }
      i = next;
    }
    const ph = def.phases[i];
    r.p = i;
    r.since = w.s.now;
    r.until = round(w.s.now + this.phaseMinutes(p, course, ph, r), 4);
    this.schedule(p.id, course, r);
    w.log('course', p.id, { course, phase: ph.id, ...(ph.quiet ? { quiet: true } : {}) });
    w.emit('course', { id: p.id, course, phase: ph.id, label: this.label(def, ph), ...(ph.quiet ? { quiet: true } : {}) });
    // a quiet phase: nobody notices, so no feeling
    if (ph.feel && !ph.quiet && w.reverie) w.reverie.applyFeel(p.id, ph.feel, def.label ?? course);
    if (ph.then) w.lang.applyAll(ph.then, w.ctx(p));
    // the harm shows: now people notice (Morgul's onlookers and suspicion)
    if (ph.tells) {
      w.log('shows', p.id, { course, phase: ph.id });
      w.emit('shows', { id: p.id, course, phase: ph.id, label: this.label(def, ph) });
      w.morgul?.showed(p, course);
    }
    // needs may rise at new rates: look again at when one turns urgent
    if (p.doing) w.clock.scheduleChecks(p);
    // stopping happens as an event of its own, just after this one
    if (ph.stop) w.clock.schedule({ t: w.s.now, k: 'module', ref: this.name, who: p.id, data: { c: course, stop: true } });
  }

  /** A course passes, or is cured (needs settled by the caller). */
  private end(p: PersonState, course: Id, cured: boolean): void {
    const w = this.w;
    const st = this.st as State;
    const def = this.courses.get(course);
    delete st.on[p.id][course];
    if (!Object.keys(st.on[p.id]).length) delete st.on[p.id];
    if (def?.immunity) (st.immune[p.id] ||= {})[course] = w.s.now + def.immunity;
    w.log('recovered', p.id, { course, ...(cured ? { cured } : {}) });
    w.emit('recovered', { id: p.id, course, cured, label: def?.label ?? course });
    w.morgul?.healed(p, course);
    if (def?.then && !cured) w.lang.applyAll(def.then, w.ctx(p));
    if (p.doing) w.clock.scheduleChecks(p);
  }

  /** Where a course goes from a phase that ran out: a phase's index, or -1 to pass. */
  private nextOf(p: PersonState, def: CourseDef, i: number): number {
    const ph = def.phases[i];
    const index = (to: Id | null): number => (to === null ? -1 : def.phases.findIndex((x) => x.id === to));
    const n = ph.next;
    if (n === null) return -1;
    if (typeof n === 'string') return index(n);
    if (Array.isArray(n)) {
      const ctx = this.w.ctx(p, { data: { course: def.id } });
      for (const b of n) if (this.w.lang.all(b.if, ctx)) return index(b.to);
    }
    return i + 1 < def.phases.length ? i + 1 : -1;
  }

  /** Does a phase that ends in death take them? Only through Cradle, and (a wound) only as often as Morgul's lethality says. */
  private dies(p: PersonState, course: Id): boolean {
    const w = this.w;
    if (!w.cradle) return false;
    return !(w.morgul?.spares(p, course) ?? false);
  }

  /** Brings a phase's end sooner (or, with a negative number, later), inside the simulation. */
  applyHasten(id: Id, course: Id, minutes: number): void {
    const r = this.st?.on[id]?.[course];
    if (!r || !minutes) return;
    r.until = round(Math.max(this.w.s.now, r.until - minutes), 4);
    this.schedule(id, course, r);
  }

  /** Cures someone of a course (or all of them), inside the simulation. */
  applyCure(id: Id, course?: Id): void {
    const p = this.w.s.people[id];
    const on = this.st?.on[id];
    if (!p || !on) return;
    const which = course ? (on[course] ? [course] : []) : Object.keys(on);
    if (!which.length) return;
    this.w.mind.settleRise(p);
    for (const c of which) this.end(p, c, true);
  }

  /**
   * Someone's course is tended (or every course they have), inside the
   * simulation: a mark of how well (tendBase, the rest by the tender's skill
   * in tendSkill), which the branches read, and the phase they're in ends
   * sooner by tendHasten of what's left, times that. Returns how well, or 0
   * if there was nothing to tend.
   */
  applyTend(id: Id, course?: Id, by?: Id): number {
    const w = this.w, c = this.c;
    const on = this.st?.on[id];
    if (!w.s.people[id] || !on) return 0;
    const which = course ? (on[course] ? [course] : []) : Object.keys(on);
    if (!which.length) return 0;
    let share = 0;
    const tender = by !== undefined ? w.s.people[by] : undefined;
    if (c.tendSkill && tender) share = Math.min(1, Math.max(0, w.skills.level(tender, c.tendSkill) / (w.skills.def(c.tendSkill).max ?? 1)));
    const q = round(Math.min(1, Math.max(0, c.tendBase + (1 - c.tendBase) * share)), 4);
    for (const k of which) {
      const r = on[k];
      r.tend = Math.max(r.tend ?? 0, q);
      const left = r.until - w.s.now;
      if (c.tendHasten > 0 && left > 0) this.applyHasten(id, k, round(left * c.tendHasten * q, 4));
    }
    w.log('tended', id, { by: by ?? null, courses: which, quality: q });
    w.emit('tended', { id, by: by ?? null, courses: which, quality: q });
    return q;
  }

  timer(item: QueueItem): void {
    const w = this.w;
    const p = item.who ? w.s.people[item.who] : undefined;
    if (!p || p.status === 'gone') return;
    const course = String(item.data?.c ?? '');
    if (item.data?.stop) {
      if (p.status === 'active' && this.st?.on[p.id]?.[course]) {
        const def = this.courses.get(course);
        w.clock.rethink(p, this.label(def as CourseDef, def?.phases[(this.st as State).on[p.id][course].p]));
      }
      return;
    }
    const r = this.st?.on[p.id]?.[course];
    if (!r || r.k !== item.data?.k) return;
    w.mind.settleRise(p);
    const def = this.courses.get(course);
    if (!def) { this.end(p, course, false); return; }
    const ph = def.phases[r.p];
    // a phase that ends in death
    if (ph?.dies && this.dies(p, course)) {
      const why = typeof ph.dies === 'string' ? ph.dies : 'died';
      w.log('fatal', p.id, { course, phase: ph.id });
      (w.cradle as NonNullable<World['cradle']>).applyDepart(p.id, why);
      return;
    }
    const next = this.nextOf(p, def, r.p);
    if (next >= 0) this.enter(p, course, next);
    else this.end(p, course, false);
  }

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------

  rate(p: PersonState, need: Id): number {
    const on = this.st?.on[p.id];
    if (!on) return 1;
    let m = 1;
    for (const course in on) {
      const def = this.courses.get(course);
      const r = def?.phases[on[course].p]?.rates?.[need];
      if (r !== undefined) m *= on[course].sev === undefined ? r : Math.pow(r, this.depth(def, on[course].sev));
    }
    return m;
  }

  /** The phase's `weigh` entry for an option: its id, else a tag it has, else '*'. */
  private weighFor(weigh: Record<string, number>, c: Candidate): number | undefined {
    if (weigh[c.id] !== undefined) return weigh[c.id];
    const tags = (c.kind === 'task' ? this.w.tasks.get(c.id)?.tags : this.w.actions.get(c.id)?.tags) || [];
    for (const key of Object.keys(weigh)) if (key.startsWith('tag:') && tags.includes(key.slice(4))) return weigh[key];
    return weigh['*'];
  }

  consider(p: PersonState, c: Candidate): Array<[string, number]> | void {
    const on = this.st?.on[p.id];
    if (!on) return;
    const out: Array<[string, number]> = [];
    for (const course in on) {
      const def = this.courses.get(course);
      const ph = def?.phases[on[course].p];
      if (!def || !ph?.weigh) continue;
      let f = this.weighFor(ph.weigh, c);
      if (f === undefined) continue;
      if (on[course].sev !== undefined) f = round(Math.pow(f, this.depth(def, on[course].sev)), 6);
      out.push([this.label(def, ph), f]);
    }
    return out;
  }

  block(p: PersonState, c: Candidate): string | null {
    const on = this.st?.on[p.id];
    if (!on) return null;
    for (const course in on) {
      const def = this.courses.get(course);
      const ph = def?.phases[on[course].p];
      if (!def || !ph?.blocks) continue;
      const tags = (c.kind === 'task' ? this.w.tasks.get(c.id)?.tags : this.w.actions.get(c.id)?.tags) || [];
      if (ph.blocks.some((b) => b === c.id || (b.startsWith('tag:') && tags.includes(b.slice(4))))) return this.label(def, ph);
    }
    return null;
  }

  /** Someone with a catching course passes it on, now and then, to whoever they spend time with. */
  private spread(from: PersonState, to: PersonState, minutes: number): void {
    const on = this.st?.on[from.id];
    if (!on || to.status !== 'active') return;
    for (const course of Object.keys(on)) {
      const def = this.courses.get(course);
      const cg = def?.contagion;
      if (!def || !cg || def.phases[on[course].p]?.spreads === false) continue;
      if (this.st?.on[to.id]?.[course] || this.immune(to.id, course)) continue;
      // the headline knob scales the chance an hour, for the one who might catch it
      let chance = 1 - Math.pow(1 - Math.min(1, Math.max(0, cg.chance * this.knob('contagion', to))), minutes / 60);
      if (cg.resist?.length) {
        const ctx = this.w.ctx(to, { target: from.id });
        for (const k of cg.resist) chance *= this.w.mind.consider(k, ctx);
      }
      if (chance > 0 && this.w.stream(to).chance(chance)) this.applyAfflict(to.id, course, from.id);
    }
  }

  met(a: PersonState, b: PersonState, _place: Id, minutes: number): void {
    if (!this.st) return;
    this.spread(a, b, minutes);
    this.spread(b, a, minutes);
  }

  /** Immunities that have run out are let go. */
  day(): void {
    const st = this.st;
    if (!st) return;
    const now = this.w.s.now;
    for (const id of Object.keys(st.immune)) {
      for (const c of Object.keys(st.immune[id])) if (st.immune[id][c] <= now) delete st.immune[id][c];
      if (!Object.keys(st.immune[id]).length) delete st.immune[id];
    }
  }

  removed(p: PersonState): void {
    const st = this.st;
    if (!st) return;
    delete st.on[p.id];
    delete st.immune[p.id];
  }
}
