// Bicameral: the minds. Needs that rise, the layered priorities (story, job,
// routine, needs), every option weighed by considerations, the pick, and
// habits that learn from what actually happened. Named for Westworld's
// bicameral mind, the voice that tells a host what to do until it becomes
// their own.
//
// A decision runs in four steps:
//   1. what's required: a directive from the story, the job's hours, the
//      routine (the first variant that fits the day), each with a rank
//   2. what's on offer: every action and task, at every place that offers it,
//      filtered by who may, hours, conditions and free slots
//   3. what it's worth: relief for the needs it meets (each need through its
//      curve), times considerations, habit, travel and the modules' factors;
//      urgent needs lift an option's rank
//   4. the pick: the top rank only, the weak cut, a weighted draw from the
//      person's own seeded stream
import type {
  ActionDef, Candidate, Consideration, Ctx, Curve, Decision, Doing, Id, PersonState, PlaceSpec,
  RoutineEntry, RoutineVariant, TaskDef,
} from './types';
import type { World } from './world';
import { DAY, HOUR, clamp, dayOf, hourOf, inHours, lerp, round } from './util';

/** What a layer of the stack requires right now. */
export interface Requirement {
  do: Id;
  at: PlaceSpec | undefined;
  rank: number;
  layer: 'story' | 'job' | 'routine';
  /** When the requirement ends (minutes). */
  until: number;
  target?: Id;
  with?: Id;
  /** '*' activities: anything at this place. */
  any?: boolean;
}

/** Evaluates a response curve at x in [0, 1]. */
export function curveAt(curve: Curve | undefined, x: number): number {
  x = clamp(x);
  if (!curve || curve === 'linear') return x;
  if (typeof curve === 'function') return clamp(curve(x));
  if (Array.isArray(curve)) {
    if (!curve.length) return x;
    if (x <= curve[0][0]) return curve[0][1];
    for (let i = 1; i < curve.length; i++) {
      const [x1, y1] = curve[i];
      if (x <= x1) {
        const [x0, y0] = curve[i - 1];
        return x1 === x0 ? y1 : lerp(y0, y1, (x - x0) / (x1 - x0));
      }
    }
    return curve[curve.length - 1][1];
  }
  switch (curve) {
    case 'inverse': return 1 - x;
    case 'quadratic': return x * x;
    case 'cubic': return x * x * x;
    case 'sqrt': return Math.sqrt(x);
    case 'pow1.5': return Math.pow(x, 1.5);
    case 'smooth': return x * x * (3 - 2 * x);
    case 'logistic': return 1 / (1 + Math.exp(-12 * (x - 0.5)));
    case 'step': return x >= 0.5 ? 1 : 0;
    default: return x;
  }
}

const mid = (r: number | [number, number]): number => (Array.isArray(r) ? (r[0] + r[1]) / 2 : r);

/** The cooldown key that rules an action out at a place for a while after it failed there. */
export const backoffKey = (action: Id, place: Id | null | undefined): string => `@fail:${action}@${place ?? ''}`;

export class Bicameral {
  constructor(private w: World) {}

  // -------------------------------------------------------------------------
  // Needs
  // -------------------------------------------------------------------------

  /** A need's level at time t (default now), counting any relief in progress. */
  level(p: PersonState, need: Id, t = this.w.s.now): number {
    const ns = p.needs[need];
    const def = this.w.needs.get(need);
    if (!ns || !def) return 0;
    const d = p.doing;
    const a = d && d.kind === 'act' ? this.w.actions.get(d.action) : undefined;
    const rate = a?.rates?.[need];
    let v: number;
    if (rate !== undefined && d && t > d.start) {
      // the usual rise up to the start, then the action's rate
      const from = Math.max(ns.t, d.start);
      v = ns.v + (def.rise * Math.max(0, d.start - ns.t)) / HOUR + (def.rise * rate * (t - from)) / HOUR;
    } else v = ns.v + (def.rise * (t - ns.t)) / HOUR;
    if (a && d) {
      const r = a.relieves?.[need];
      if (r !== undefined && t > d.start) {
        const f = clamp((t - d.start) / Math.max(1, d.end - d.start));
        v -= mid(r) * this.quality(d.place) * f;
      }
    }
    return clamp(v);
  }

  /**
   * Folds a finished (or stopped) action's effect on needs' rise into their
   * stored levels, for needs it changed the rate of. Called before relief.
   */
  settle(p: PersonState, d: Doing): void {
    if (d.kind !== 'act') return;
    const a = this.w.actions.get(d.action);
    if (!a?.rates) return;
    const now = this.w.s.now;
    for (const need in a.rates) {
      const ns = p.needs[need], def = this.w.needs.get(need);
      if (!ns || !def) continue;
      const from = Math.max(ns.t, d.start);
      const v = ns.v + (def.rise * Math.max(0, d.start - ns.t)) / HOUR + (def.rise * a.rates[need] * Math.max(0, now - from)) / HOUR;
      p.needs[need] = { v: clamp(v), t: now };
    }
  }

  /** Sets a need's level now. */
  setLevel(p: PersonState, need: Id, v: number): void {
    if (!this.w.needs.has(need)) return;
    p.needs[need] = { v: clamp(v), t: this.w.s.now };
  }

  /** Makes sure a person has every declared need. */
  ensureNeeds(p: PersonState): void {
    for (const [id, def] of this.w.needs) if (!p.needs[id]) p.needs[id] = { v: def.start ?? 0.2, t: this.w.s.now };
  }

  private quality(place: Id | null | undefined): number { return this.w.ring.get(place)?.quality ?? 1; }

  /** The urgency of a need: its level through its curve. */
  urgency(p: PersonState, need: Id, t = this.w.s.now): number {
    return curveAt(this.w.needs.get(need)?.curve ?? 'pow1.5', this.level(p, need, t));
  }

  /**
   * When the next need will cross a line that matters: urgent, desperate, or
   * at its worst (Infinity if none will). Each can lift an option's rank.
   */
  urgentAt(p: PersonState): number {
    let best = Infinity;
    const a = p.doing?.kind === 'act' ? this.w.actions.get(p.doing.action) : undefined;
    const relieving = a?.relieves;
    for (const [id, def] of this.w.needs) {
      if (relieving && relieving[id] !== undefined) continue;
      const u = def.urgent ?? this.w.config.urgent;
      const rise = def.rise * (a?.rates?.[id] ?? 1);
      if (u > 1 || rise <= 0) continue;
      const v = this.level(p, id);
      for (const line of [u, Math.max(u, 0.97), 1]) {
        if (v >= line - 1e-9) continue;
        const t = this.w.s.now + ((line - v) / rise) * HOUR;
        if (t < best) best = t;
        break;
      }
    }
    return best;
  }

  /** Applies an action's relief: frac of it, for a person, at the end. Returns realized vs expected. */
  relieve(p: PersonState, d: Doing, frac: number): { got: number; expected: number } {
    const a = this.w.actions.get(d.action);
    let got = 0, expected = 0;
    if (!a?.relieves) return { got, expected };
    const q = this.quality(d.place);
    const r = this.w.stream(p);
    for (const need in a.relieves) {
      if (!this.w.needs.has(need)) continue;
      const before = this.levelRaw(p, need);
      const range = a.relieves[need];
      const amount = (Array.isArray(range) ? r.range(range[0], range[1]) : range) * q * frac;
      const after = clamp(before - amount);
      const weight = this.urgencyAt(need, before);
      got += weight * (before - after);
      expected += weight * mid(range) * q * frac;
      p.needs[need] = { v: after, t: this.w.s.now };
    }
    return { got, expected };
  }

  /** The level now ignoring relief in progress (the doing is ending). */
  private levelRaw(p: PersonState, need: Id): number {
    const ns = p.needs[need];
    const def = this.w.needs.get(need);
    if (!ns || !def) return 0;
    return clamp(ns.v + (def.rise * (this.w.s.now - ns.t)) / HOUR);
  }

  private urgencyAt(need: Id, v: number): number { return curveAt(this.w.needs.get(need)?.curve ?? 'pow1.5', v); }

  // -------------------------------------------------------------------------
  // Habits
  // -------------------------------------------------------------------------

  habit(p: PersonState, id: Id): number {
    const h = p.habits[id];
    return h ? round((h[0] + h[1]) / 2, 4) : 1;
  }

  /** Learns from how an action went: realized relief against what was expected. */
  learn(p: PersonState, id: Id, got: number, expected: number, bonus = 0): void {
    const c = this.w.config;
    const h = p.habits[id] || [1, 1];
    let fast = h[0], slow = h[1];
    const ratio = expected > 1e-6 ? clamp(got / expected, 0, 2) : 1;
    fast += c.habitFast * (ratio - 1) + bonus;
    fast += 0.02 * (1 - fast); // a slow pull back toward neutral
    fast = clamp(fast, c.habitMin, c.habitMax);
    slow = clamp(slow + c.habitSlow * (fast - slow), c.habitMin, c.habitMax);
    p.habits[id] = [round(fast, 5), round(slow, 5)];
  }

  /** A reward or a telling-off: nudges the habit directly. */
  nudge(p: PersonState, id: Id, amount: number): void {
    const c = this.w.config;
    const h = p.habits[id] || [1, 1];
    const fast = clamp(h[0] + amount, c.habitMin, c.habitMax);
    p.habits[id] = [round(fast, 5), round(clamp(h[1] + amount * 0.25, c.habitMin, c.habitMax), 5)];
  }

  // -------------------------------------------------------------------------
  // The layered stack
  // -------------------------------------------------------------------------

  /** The routine plan for the day a time falls on (first matching variant). */
  routineFor(p: PersonState, t = this.w.s.now): RoutineEntry[] | null {
    const r = p.def.routine;
    if (!r || !r.length) return null;
    if (Array.isArray(r[0])) return r as RoutineEntry[];
    const day = dayOf(t);
    const weekday = day % this.w.config.week;
    for (const v of r as RoutineVariant[]) {
      if (v.days && !v.days.includes(weekday)) continue;
      if (v.when && !this.w.lang.all(v.when, this.w.ctx(p))) continue;
      return v.plan;
    }
    return null;
  }

  /** The routine entry in force at time t, and when it ends. */
  routineAt(p: PersonState, t = this.w.s.now): { entry: RoutineEntry; until: number } | null {
    const plan = this.routineFor(p, t);
    if (!plan || !plan.length) return null;
    const h = hourOf(t);
    const sorted = plan.slice().sort((a, b) => a[0] - b[0]);
    let idx = -1;
    for (let i = 0; i < sorted.length; i++) if (sorted[i][0] <= h + 1e-9) idx = i;
    const entry = idx >= 0 ? sorted[idx] : sorted[sorted.length - 1];
    const next = idx + 1 < sorted.length ? sorted[idx + 1][0] : sorted[0][0] + 24;
    const dayStart = t - h * HOUR;
    const until = dayStart + next * HOUR;
    return { entry, until: until > t ? until : until + DAY };
  }

  /** Is the person on shift at time t, and until when? */
  shiftAt(p: PersonState, t = this.w.s.now): { until: number } | null {
    const job = p.def.job;
    if (!job) return null;
    const h = hourOf(t);
    const dayStart = t - h * HOUR;
    for (const [a, b] of job.shifts) {
      if (!inHours(h, [a, b])) continue;
      // which day did this shift start on?
      const startedToday = a <= b || h >= a;
      const startDay = startedToday ? dayOf(t) : dayOf(t) - 1;
      if (job.days && !job.days.includes(startDay % this.w.config.week)) continue;
      let end = dayStart + b * HOUR;
      if (end <= t) end += DAY;
      return { until: end };
    }
    return null;
  }

  /** What the stack requires of a person now, highest layer first. */
  required(p: PersonState): Requirement[] {
    const out: Requirement[] = [];
    const now = this.w.s.now;
    const d = p.directive;
    if (d && !(d.done && !d.repeat) && !(d.until !== undefined && d.until <= now)) {
      out.push({ do: d.do, at: d.at, rank: d.rank ?? 3, layer: 'story', until: d.until ?? Infinity, target: d.target });
    }
    const shift = this.shiftAt(p);
    if (shift && p.def.job) out.push({ do: p.def.job.action, at: p.def.job.place, rank: 2, layer: 'job', until: shift.until });
    const r = this.routineAt(p);
    if (r) {
      const [, at, act, extra] = r.entry;
      // '*' with no place is free time: nothing required
      const free = (act === '*' || act === 'free') && (at === null || at === undefined || at === 'here');
      if (!free) out.push({ do: act, at, rank: extra?.rank ?? 1, layer: 'routine', until: r.until, with: extra?.with, any: act === '*' });
    }
    return out;
  }

  /** The next time something in the stack changes for a person (routine entry, shift, directive). */
  nextBoundary(p: PersonState): number {
    const now = this.w.s.now;
    let best = Infinity;
    const r = this.routineAt(p);
    if (r) best = Math.min(best, r.until);
    const job = p.def.job;
    if (job) {
      const h = hourOf(now);
      const dayStart = now - h * HOUR;
      for (const [a, b] of job.shifts) {
        for (const hh of [a, b]) {
          let t = dayStart + hh * HOUR;
          if (t <= now + 1e-6) t += DAY;
          best = Math.min(best, t);
        }
      }
    }
    if (p.directive?.until !== undefined && p.directive.until > now) best = Math.min(best, p.directive.until);
    return best;
  }

  // -------------------------------------------------------------------------
  // Options and their worth
  // -------------------------------------------------------------------------

  /** Every option a person has now, weighed. */
  options(p: PersonState): Candidate[] {
    const out: Candidate[] = [];
    const reqs = this.required(p);
    const reqIds = new Set<string>();
    for (const r of reqs) {
      if (r.any) {
        const places = this.w.ring.resolve(r.at ?? null, p);
        const place = places[0] ?? null;
        for (const a of this.w.actions.values()) {
          if (a.target) continue;
          if (!this.offeredAt(a, place, p)) continue;
          // anything they like there: each thing for as long as it takes, choosing again after
          this.addOption(p, out, { id: a.id, kind: 'action', place, rank: r.rank, layer: r.layer, until: r.until, fill: false }, true);
          reqIds.add(a.id + '@' + place);
        }
        continue;
      }
      const kind = this.w.tasks.has(r.do) ? 'task' : 'action';
      if (kind === 'action' && !this.w.actions.has(r.do)) continue;
      const def = kind === 'task' ? this.w.tasks.get(r.do) : this.w.actions.get(r.do);
      const at = r.at !== undefined ? r.at : (def as ActionDef | TaskDef).at;
      const places = this.w.ring.resolve(at, p, r.target);
      const target = r.target;
      for (const place of places.slice(0, this.w.config.placesPerAction)) {
        this.addOption(p, out, { id: r.do, kind, place, target, rank: r.rank, layer: r.layer, until: r.until }, true);
        reqIds.add(r.do + '@' + place);
      }
      if (!places.length) this.addOption(p, out, { id: r.do, kind, place: null, target, rank: r.rank, layer: r.layer, until: r.until }, true);
    }
    // free choices: every action, at every place that offers it
    for (const a of this.w.actions.values()) {
      if (a.job && a.job !== p.def.job?.id) continue;
      if (a.rank !== undefined && a.rank < 0) continue; // only by requirement
      if (!a.relieves && !a.base) continue;
      const places = this.w.ring.resolve(a.at ?? null, p);
      for (const place of places.slice(0, this.w.config.placesPerAction)) {
        if (reqIds.has(a.id + '@' + place)) continue;
        if (a.at !== undefined && a.at !== null && !this.offeredAt(a, place, p)) continue;
        if (a.target === 'person') {
          for (const t of this.targetsFor(p, a, place)) this.addOption(p, out, { id: a.id, kind: 'action', place, target: t, rank: a.rank ?? 0, layer: 'need' }, false);
        } else this.addOption(p, out, { id: a.id, kind: 'action', place, rank: a.rank ?? 0, layer: 'need' }, false);
      }
    }
    for (const t of this.w.tasks.values()) {
      if (!t.relieves && !t.base) continue;
      if (t.rank !== undefined && t.rank < 0) continue;
      const places = t.at !== undefined ? this.w.ring.resolve(t.at, p) : [null];
      for (const place of places.slice(0, this.w.config.placesPerAction)) {
        if (reqIds.has(t.id + '@' + place)) continue;
        this.addOption(p, out, { id: t.id, kind: 'task', place, rank: t.rank ?? 0, layer: 'need' }, false);
      }
    }
    for (const m of this.w.hooks) m.candidates?.(p, out);
    // weigh anything a module added without weighing it
    for (const c of out) if (!c.parts.length && !c.blocked) this.weigh(p, c, true);
    return out;
  }

  /** Does a place offer an action? (the action asks for the place, its tag, or the place lists it) */
  offeredAt(a: ActionDef, place: Id | null, p: PersonState): boolean {
    if (a.at === undefined || a.at === null || a.at === 'here') return true;
    if (!place) return false;
    const specs = Array.isArray(a.at) ? a.at : [a.at];
    for (const sp of specs) {
      if (sp === null || sp === 'here') return true;
      if (sp === place) return true;
      if (sp === 'home' && p.def.home && this.w.ring.within(place, p.def.home)) return true;
      if (sp === 'work' && p.def.job && this.w.ring.within(place, p.def.job.place)) return true;
      if (typeof sp === 'string' && sp.startsWith('tag:') && this.w.ring.hasTag(place, sp.slice(4))) return true;
      if (typeof sp === 'string' && (sp.startsWith('person:') || sp === 'target')) return true;
    }
    return !!this.w.ring.get(place)?.offers?.includes(a.id);
  }

  /** Who an action aimed at someone could be aimed at, from a place. */
  targetsFor(p: PersonState, a: ActionDef, place: Id | null): Id[] {
    const out: Id[] = [];
    const where = place || p.place;
    if (!where) return out;
    for (const id of this.w.ring.present(this.w.ring.root(where))) {
      if (id === p.id) continue;
      const ctx = this.w.ctx(p, { target: id, place: where, action: a.id });
      if (a.targetIf && !this.w.lang.all(a.targetIf, ctx)) continue;
      out.push(id);
    }
    return out.slice(0, 6);
  }

  private addOption(p: PersonState, out: Candidate[], base: Omit<Candidate, 'weight' | 'parts'>, required: boolean): void {
    const c: Candidate = { ...base, weight: 0, parts: [] };
    this.weigh(p, c, required);
    out.push(c);
  }

  /** Why an option is ruled out for a person now, or null if it isn't. */
  blockedReason(p: PersonState, c: Candidate): string | null {
    const isTask = c.kind === 'task';
    const def = isTask ? this.w.tasks.get(c.id) : this.w.actions.get(c.id);
    if (!def) return 'not declared';
    const w = this.w;
    const ctx: Ctx = w.ctx(p, { place: c.place, target: c.target ?? null, action: c.id });
    const a = def as ActionDef;
    if (!isTask && a.job && a.job !== p.def.job?.id) return `needs the job '${a.job}'`;
    const who = w.lang.failing(def.who, ctx);
    if (who) return `not for them (${String(who)})`;
    if (p.cool[c.id] && p.cool[c.id] > w.s.now) return `cooling down, ${Math.ceil(p.cool[c.id] - w.s.now)} min`;
    const backoff = p.cool[backoffKey(c.id, c.place ?? p.place)];
    if (backoff !== undefined && backoff > w.s.now) return `failed recently, ${Math.ceil(backoff - w.s.now)} min`;
    const travel = c.place ? w.ring.travel(p.place, c.place, p) : 0;
    if (!isFinite(travel)) return `can't get to ${c.place}`;
    const arrive = w.s.now + travel;
    if (!isTask && a.hours && !inHours(hourOf(arrive), a.hours)) return 'not at this hour';
    // staff can get in to work when the place is shut to everyone else
    const staffWork = !isTask && !!a.job && p.def.job?.id === a.job && !!p.def.job && w.ring.within(c.place, p.def.job.place);
    if (c.place && !staffWork && !w.ring.open(c.place, arrive)) return `${c.place} is closed then`;
    if (c.place && !isTask && a.slot && w.ring.free(c.place, a.slot) <= 0 && !w.ring.holders(c.place, a.slot).includes(p.id)) return `no free ${a.slot}`;
    const fail = w.lang.failing(def.if, ctx);
    if (fail) return `needs ${String(fail)}`;
    if (c.target) {
      const t = w.s.people[c.target];
      if (!t || t.status !== 'active') return 'they are not around';
    }
    for (const m of w.hooks) {
      const why = m.block?.(p, c);
      if (why) return why;
    }
    return null;
  }

  /** Weighs one option: fills in weight, parts and rank (or blocked). */
  weigh(p: PersonState, c: Candidate, required: boolean): void {
    const w = this.w;
    c.parts = [];
    const why = this.blockedReason(p, c);
    if (why) { c.blocked = why; c.weight = 0; return; }
    const isTask = c.kind === 'task';
    const def = (isTask ? w.tasks.get(c.id) : w.actions.get(c.id)) as ActionDef & TaskDef;
    const travel = c.place ? w.ring.travel(p.place, c.place, p) : 0;
    const arrive = w.s.now + travel;
    // base: relief for the needs it meets, by how urgent each is
    let base = def.base ?? 0;
    let lift = 0;
    const q = w.ring.get(c.place)?.quality ?? 1;
    if (def.relieves) {
      for (const need in def.relieves) {
        const nd = w.needs.get(need);
        if (!nd) continue;
        const r = mid(def.relieves[need]) * q;
        const lvl = this.level(p, need, arrive);
        base += curveAt(nd.curve ?? 'pow1.5', lvl) * Math.min(r, Math.max(lvl, 0.05));
        // an urgent need breaks through routines, but only for something that really meets it
        if (r >= 0.3) {
          const u = nd.urgent ?? w.config.urgent;
          // desperate: above work; the worse it gets, the higher (so starving wakes the exhausted)
          if (lvl >= Math.max(u, 0.97)) lift = Math.max(lift, w.config.desperateRank + (lvl - 0.97) * 10);
          else if (lvl >= u) lift = Math.max(lift, w.config.urgentRank);
        }
      }
    }
    if (required) base = Math.max(base, 0) + 1;
    if (base <= 0) { c.blocked = 'nothing in it for them'; c.weight = 0; return; }
    c.parts.push(['base', round(base)]);
    let weight = base;
    const mul = (name: string, f: number) => {
      if (f === 1 || !isFinite(f)) return;
      weight *= f;
      c.parts.push([name, round(f)]);
    };
    // considerations, compensated for how many there are
    const cons = def.considerations || [];
    if (cons.length) {
      const ctx: Ctx = w.ctx(p, { place: c.place, target: c.target ?? null, action: c.id });
      const n = cons.length;
      for (const k of cons) {
        let v = this.consider(k, ctx, travel);
        if (w.config.compensate && n > 1 && v < 1 && v > 0) v = v + (1 - v) * (1 - 1 / n) * v;
        mul(k.name || (typeof k.input === 'string' ? k.input : 'consideration'), v);
        if (v <= 0) break;
      }
    }
    mul('habit', this.habit(p, c.id));
    if (travel > 0) mul('travel', 1 / (1 + travel / w.config.travelScale));
    const sleepy = def.tags?.includes('sleep');
    if (!required && p.last === c.id && !sleepy && p.lastEnd !== undefined && w.s.now - p.lastEnd < 90) mul('did it last', w.config.repeat);
    if (p.doing && p.doing.action === c.id && p.doing.place === c.place) mul('carrying on', w.config.inertia);
    for (const m of w.hooks) {
      const parts = m.consider?.(p, c);
      if (parts) for (const [name, f] of parts) mul(name, f);
    }
    c.weight = round(Math.max(0, weight), 6);
    if (c.weight <= 0) { c.blocked = c.blocked || 'weighed nothing'; return; }
    // urgent needs break through routines (and desperate ones through work)
    if (!required && lift > c.rank) { c.rank = round(lift, 3); c.parts.push(['urgent', c.rank]); }
  }

  /** Evaluates one consideration to a factor. */
  consider(k: Consideration, ctx: Ctx, travel = 0): number {
    let x: number;
    if (typeof k.input === 'function') x = k.input(ctx);
    else if (k.input === 'travel') x = travel;
    else x = Number(this.w.lang.value(k.input, ctx) ?? 0);
    const [lo, hi] = k.range || [0, 1];
    const nx = hi === lo ? (x >= hi ? 1 : 0) : (x - lo) / (hi - lo);
    const y = curveAt(k.curve, nx);
    const [o0, o1] = k.out || [0, 1];
    return lerp(o0, o1, y);
  }

  // -------------------------------------------------------------------------
  // The pick
  // -------------------------------------------------------------------------

  /** Picks from options: top rank, cut the weak, a weighted draw. */
  pick(p: PersonState, options: Candidate[]): { picked: Candidate | null; reason: string } {
    const valid = options.filter((c) => !c.blocked && c.weight > 0);
    if (!valid.length) return { picked: null, reason: 'nothing to do' };
    let top = -Infinity;
    for (const c of valid) top = Math.max(top, c.rank);
    let pool = valid.filter((c) => c.rank === top);
    const best = Math.max(...pool.map((c) => c.weight));
    const cfg = this.w.config;
    pool = pool.filter((c) => c.weight >= best * cfg.cut).sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : 1)).slice(0, cfg.top);
    const r = this.w.stream(p);
    const picked = r.weighted(pool, (c) => Math.pow(c.weight, cfg.power)) || pool[0];
    const others = pool.filter((c) => c !== picked).map((c) => c.id).join(', ');
    const reason = `${picked.layer} at rank ${picked.rank}` + (others ? `; beat ${others}` : '') + (valid.length > pool.length ? `; ${valid.length - pool.length} more ruled out by rank or weight` : '');
    return { picked, reason };
  }

  /** Thinks: weighs every option, picks one, and records the decision. */
  decide(p: PersonState): Decision {
    const options = this.options(p);
    const { picked, reason } = this.pick(p, options);
    const dec: Decision = { t: this.w.s.now, who: p.id, picked, candidates: options, reason };
    this.w.palantir.record(dec);
    return dec;
  }

  /** Weighs one action or task now for the inspector, even if it wasn't considered. */
  explain(p: PersonState, id: Id): Candidate[] {
    const kind = this.w.tasks.has(id) ? 'task' : 'action';
    const def = kind === 'task' ? this.w.tasks.get(id) : this.w.actions.get(id);
    if (!def) return [];
    const places = this.w.ring.resolve((def as ActionDef).at ?? null, p);
    const out: Candidate[] = [];
    for (const place of places.length ? places : [null]) {
      const c: Candidate = { id, kind, place, rank: (def as ActionDef).rank ?? 0, layer: 'need', weight: 0, parts: [] };
      if (kind === 'action' && place && !this.offeredAt(def as ActionDef, place, p)) c.blocked = `${place} doesn't offer it`;
      else this.weigh(p, c, false);
      out.push(c);
    }
    return out;
  }
}
