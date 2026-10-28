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
import type { Candidate, Consideration, Effect, Id, PersonState, QueueItem } from '../core/types';
import type { World } from '../core/world';
import { round } from '../core/util';

/** One phase of a course. */
export interface CoursePhase {
  id: string;
  label?: string;
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
  /** A feeling given when it starts (Reverie). */
  feel?: Id;
  /** Effects when it starts. */
  then?: Effect[];
  /** Stops what they're doing when it starts, so they choose again (laid up in bed). */
  stop?: boolean;
  /** Whether it can be caught from someone in this phase (with the course's `contagion`). Default true. */
  spreads?: boolean;
}

/** A course: something that comes on, runs through its phases, and passes. */
export interface CourseDef {
  id: Id;
  label?: string;
  /** Free labels ('illness'): `under:tag:<tag>` asks whether any course with the tag is running. */
  tags?: string[];
  /** The phases, in order. */
  phases: CoursePhase[];
  /** Caught from others: the chance per hour spent together, and considerations on the catcher (and the carrier as their target), multiplied in. */
  contagion?: { chance: number; resist?: Consideration[] };
  /** Minutes after it passes when it can't come on again. Default 0. */
  immunity?: number;
  /** Afflicted again while it runs: 'ignore' (default), 'extend' (the phase runs on as long again: another pint), 'restart'. */
  again?: 'ignore' | 'extend' | 'restart';
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
}

export const DEFAULT_ATHELAS: AthelasConfig = { contagion: 1, duration: 1 };

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
}

interface State {
  on: Record<Id, Record<Id, Running>>;
  immune: Record<Id, Record<Id, number>>;
  k: number;
}

export class Athelas implements Module {
  readonly name = 'athelas';
  readonly config: AthelasConfig;
  readonly knobs = { contagion: 'person', duration: 'person' } as const;
  readonly courses = new Map<Id, CourseDef>();
  private w!: World;

  constructor(cfg: Partial<AthelasConfig> = {}) { this.config = { ...DEFAULT_ATHELAS, ...cfg }; }

  /** A headline knob for someone: the world's (as tuned), times their own. */
  private knob(name: 'contagion' | 'duration', p: PersonState): number { return this.w.tuned(this.name, this.config)[name] * this.w.own(p, this.name, name); }

  /** The state for reading: undefined until someone is first afflicted. */
  private get st(): State | undefined { return this.w.s.mod.athelas as State | undefined; }
  /** The state for writing (inside the simulation): made when first needed. */
  private mut(): State { return (this.w.s.mod.athelas ||= { on: {}, immune: {}, k: 0 }) as State; }

  attach(w: World): void {
    this.w = w;
    const L = w.lang;
    L.term('under', (c, a) => {
      if (!c.person) return a ? false : 0;
      const on = this.st?.on[c.person.id];
      if (!a) return on ? Object.keys(on).length : 0;
      if (a.startsWith('tag:')) return !!on && Object.keys(on).some((id) => this.courses.get(id)?.tags?.includes(a.slice(4)));
      const r = on?.[a];
      return r ? this.courses.get(a)?.phases[r.p]?.id ?? true : false;
    });
    L.term('immune', (c, a) => (c.person ? this.immune(c.person.id, a) : false));
    L.effect('afflict', (c, a) => { if (c.person) this.applyAfflict(c.person.id, a, c.target ?? undefined); });
    L.effect('cure', (c, a) => { if (c.person) this.applyCure(c.person.id, a || undefined); });
    L.effect('hasten', (c, a, _op, v) => { if (c.person) this.applyHasten(c.person.id, a, Number(v ?? 0)); });
    w.defineInput('afflict', (id: Id, course: Id, from: Id | null) => this.applyAfflict(id, course, from ?? undefined));
    w.defineInput('cure', (id: Id, course: Id | null) => this.applyCure(id, course ?? undefined));
    w.defineInput('hasten', (id: Id, course: Id, minutes: number) => this.applyHasten(id, course, minutes));
  }

  // -------------------------------------------------------------------------
  // Declaring and asking
  // -------------------------------------------------------------------------

  course(def: CourseDef): this { this.courses.set(def.id, def); return this; }

  /** The courses running for someone: which phase, since and until when. */
  of(id: Id): Array<{ course: Id; label: string; phase: string; phaseLabel: string; since: number; until: number; from?: Id }> {
    const on = this.st?.on[id];
    if (!on) return [];
    return Object.keys(on).map((course) => {
      const r = on[course], def = this.courses.get(course), ph = def?.phases[r.p];
      const out: { course: Id; label: string; phase: string; phaseLabel: string; since: number; until: number; from?: Id } = {
        course, label: def?.label ?? course, phase: ph?.id ?? String(r.p), phaseLabel: ph?.label ?? ph?.id ?? '', since: r.since, until: r.until,
      };
      if (r.from) out.from = r.from;
      return out;
    });
  }

  /** Is someone immune to a course now? */
  immune(id: Id, course: Id): boolean { return (this.st?.immune[id]?.[course] ?? -Infinity) > this.w.s.now; }

  /** Afflicts someone with a course (from the game: recorded). Returns whether it took. */
  afflict(id: Id, course: Id, from?: Id): boolean { return this.w.input('afflict', [id, course, from ?? null]) === true; }

  /** Cures someone of a course, or of every course (from the game: recorded). */
  cure(id: Id, course?: Id): void { this.w.input('cure', [id, course ?? null]); }

  /** Brings the end of the phase someone's in sooner by some minutes (a visit, a remedy that helps): recorded. */
  hasten(id: Id, course: Id, minutes: number): void { this.w.input('hasten', [id, course, minutes]); }

  // -------------------------------------------------------------------------
  // Running a course
  // -------------------------------------------------------------------------

  private phaseMinutes(p: PersonState, ph: CoursePhase): number {
    let m = Array.isArray(ph.minutes) ? this.w.stream(p).range(ph.minutes[0], ph.minutes[1]) : ph.minutes;
    if (ph.scale?.length) {
      const ctx = this.w.ctx(p);
      for (const k of ph.scale) m *= this.w.mind.consider(k, ctx);
    }
    // the headline knob: how long courses last for them
    m *= this.knob('duration', p);
    return round(Math.max(1, m), 4);
  }

  private schedule(id: Id, course: Id, r: Running): void {
    r.k = ++this.mut().k;
    this.w.clock.schedule({ t: r.until, k: 'module', ref: this.name, who: id, data: { c: course, k: r.k } });
  }

  private label(def: CourseDef, ph: CoursePhase | undefined): string { return (def.label ?? def.id) + (ph?.label ? `: ${ph.label}` : ''); }

  /** Afflicts someone, inside the simulation. */
  applyAfflict(id: Id, course: Id, from?: Id): boolean {
    const w = this.w;
    const p = w.s.people[id];
    const def = this.courses.get(course);
    if (!p || p.status === 'gone' || !def || !def.phases.length) return false;
    const now = w.s.now;
    const cur = this.st?.on[id]?.[course];
    if (cur) {
      const again = def.again ?? 'ignore';
      if (again === 'ignore') return false;
      if (again === 'extend') {
        cur.until = round(cur.until + this.phaseMinutes(p, def.phases[cur.p]), 4);
        this.schedule(id, course, cur);
      } else {
        w.mind.settleRise(p);
        this.enter(p, course, 0);
      }
      w.log('afflicted', id, { course, again });
      w.emit('afflicted', { id, course, from: from ?? null, label: def.label ?? course, again });
      return true;
    }
    if (this.immune(id, course)) return false;
    const st = this.mut();
    if (st.immune[id]) { delete st.immune[id][course]; if (!Object.keys(st.immune[id]).length) delete st.immune[id]; }
    w.mind.settleRise(p);
    const r: Running = { p: 0, since: now, until: now, k: 0 };
    if (from) r.from = from;
    (st.on[id] ||= {})[course] = r;
    w.log('afflicted', id, { course, ...(from ? { from } : {}) });
    w.emit('afflicted', { id, course, from: from ?? null, label: def.label ?? course });
    this.enter(p, course, 0);
    return true;
  }

  /** Starts a phase (needs settled by the caller). */
  private enter(p: PersonState, course: Id, i: number): void {
    const w = this.w;
    const def = this.courses.get(course) as CourseDef;
    const r = (this.st as State).on[p.id][course];
    const ph = def.phases[i];
    r.p = i;
    r.since = w.s.now;
    r.until = round(w.s.now + this.phaseMinutes(p, ph), 4);
    this.schedule(p.id, course, r);
    w.log('course', p.id, { course, phase: ph.id });
    w.emit('course', { id: p.id, course, phase: ph.id, label: this.label(def, ph) });
    if (ph.feel && w.reverie) w.reverie.applyFeel(p.id, ph.feel, def.label ?? course);
    if (ph.then) w.lang.applyAll(ph.then, w.ctx(p));
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
    if (def?.then && !cured) w.lang.applyAll(def.then, w.ctx(p));
    if (p.doing) w.clock.scheduleChecks(p);
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
    if (def && r.p + 1 < def.phases.length) this.enter(p, course, r.p + 1);
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
      const r = this.courses.get(course)?.phases[on[course].p]?.rates?.[need];
      if (r !== undefined) m *= r;
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
      const f = this.weighFor(ph.weigh, c);
      if (f !== undefined) out.push([this.label(def, ph), f]);
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
