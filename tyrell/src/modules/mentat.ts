// Mentat: planning. Named for Dune's human computers.
//
// The minds decide *what* (a task: get the radio working, close up the bar);
// Mentat works out *how*:
//   HTN       a task is a list of methods, tried in order, each with
//             conditions and steps; steps are actions, other tasks, 'go:',
//             'wait:' and 'get:' (Guerrilla's Decima, SHOP). Methods are
//             checked against what the person *believes*, so a plan can rest
//             on a mistake and fail on contact with the truth.
//   get:item  a short backward search over every way of getting hold of
//             something (buy, borrow, scavenge, make, steal), costed by time,
//             walking, money, risk and temperament: GOAP's strength, used
//             only where hand-written methods would never keep up
//   replanning when a step fails (the bar's full, the door's shut) the method
//             is marked failed and the next one tried, up to a limit
//   interrupts an urgent need sets a plan aside; it picks up again after, if
//             it still makes sense
import type { Module } from '../core/module';
import type { ActionDef, Candidate, Id, PersonState, PlaceSpec, PlanState, Step } from '../core/types';
import type { World } from '../core/world';
import { clamp, round } from '../core/util';

export interface MentatConfig {
  /** Replans before giving up. */
  maxTries: number;
  /** How deep 'get:' looks (getting a part to make the thing to get). */
  depth: number;
  /** Minutes of effort one unit of money is worth, before thrift. */
  priceWeight: number;

  // The headline knobs: plain multipliers, 1 changing nothing. A person's
  // own (PersonDef.tune.mentat) multiplies these for them alone.
  /** How long people keep at a plan: the replans before they give up (maxTries). 0: they give up at the first failure. Default 1. */
  persistence: number;
  /** How much their scruples cost a way of getting something: the extra cost of illegal ways (risk) and of ways against their values. 0: none (the honest and the devout still never). Default 1. */
  scruples: number;

  // The finer numbers.
  /** Minutes, at least, before a task given up on is chosen again. Default 120. */
  giveUp: number;
  /** Plans kept set aside at once (an urgent need interrupted them). Default 2. */
  setAside: number;
  /** Minutes after it began that a plan set aside is dropped instead of picked up again. Default 1440. */
  stale: number;
  /** Illegal ways: never for honesty this high; otherwise riskBase + honesty × riskHonesty + heat × riskHeat minutes. Defaults 0.8, 60, 300 and 20. */
  honestNever: number;
  riskBase: number;
  riskHonesty: number;
  riskHeat: number;
  /** Ways against a value: never if it's held this much; otherwise held × valuesCost minutes. Defaults 0.9 and 200. */
  valuesNever: number;
  valuesCost: number;
}

export const DEFAULT_MENTAT: MentatConfig = {
  maxTries: 3, depth: 3, priceWeight: 1, persistence: 1, scruples: 1,
  giveUp: 120, setAside: 2, stale: 24 * 60, honestNever: 0.8, riskBase: 60, riskHonesty: 300, riskHeat: 20, valuesNever: 0.9, valuesCost: 200,
};

interface Route { steps: Step[]; cost: number }

export class Mentat implements Module {
  readonly name = 'mentat';
  readonly config: MentatConfig;
  readonly knobs = { persistence: 'person', scruples: 'person' } as const;
  private w!: World;

  constructor(cfg: Partial<MentatConfig> = {}) { this.config = { ...DEFAULT_MENTAT, ...cfg }; }

  /** The config in force: as declared, under any world.tune. */
  private get c(): MentatConfig { return this.w.tuned(this.name, this.config); }
  /** A headline knob for someone: the world's, times their own. */
  private knob(name: 'persistence' | 'scruples', p: PersonState): number { return this.c[name] * this.w.own(p, this.name, name); }

  attach(w: World): void {
    this.w = w;
    w.lang.term('planning', (c, a) => (c.person?.plan ? (a ? c.person.plan.task === a : c.person.plan.task) : a ? false : null));
  }

  // -------------------------------------------------------------------------
  // Plans
  // -------------------------------------------------------------------------

  /** Starts a task: picks a method and returns the first step to do. */
  begin(p: PersonState, c: Candidate): Candidate | null {
    const task = this.w.tasks.get(c.id);
    if (!task) return null;
    p.plan = { task: task.id, stack: [], failed: {}, tries: 0, started: this.w.s.now, rank: c.rank, layer: c.layer };
    // a task aimed at someone keeps who
    if (task.target === 'person' && c.target) p.plan.target = c.target;
    if (!this.push(p, task.id)) {
      this.w.log('no-plan', p.id, { task: task.id });
      p.plan = null;
      return null;
    }
    this.w.log('planned', p.id, { task: task.id, method: this.methodName(task.id, p.plan.stack[0].method) });
    return this.next(p);
  }

  private methodName(task: Id, i: number): string {
    const def = this.w.tasks.get(task);
    return def?.methods[i]?.name ?? (i >= 0 ? `way ${i + 1}` : 'get');
  }

  /** Chooses a method for a task (the first not yet failed whose conditions hold) and pushes it. */
  private push(p: PersonState, taskId: Id): boolean {
    const plan = p.plan as PlanState;
    const def = this.w.tasks.get(taskId);
    if (!def) return false;
    const failed = plan.failed[taskId] || [];
    const ctx = this.w.ctx(p, { action: taskId, ...(plan.target !== undefined ? { target: plan.target } : {}) });
    for (let i = 0; i < def.methods.length; i++) {
      if (failed.includes(i)) continue;
      const m = def.methods[i];
      if (!this.w.lang.all(m.if, ctx)) continue;
      plan.stack.push({ task: taskId, method: i, steps: m.do.slice(), i: 0 });
      return true;
    }
    return false;
  }

  /** The next step of the plan as an option to start, or null when it's over. */
  private next(p: PersonState): Candidate | null {
    const w = this.w;
    for (let guard = 0; guard < 64; guard++) {
      const plan = p.plan;
      if (!plan) return null;
      const frame = plan.stack[plan.stack.length - 1];
      if (!frame) return this.complete(p);
      if (frame.i >= frame.steps.length) { plan.stack.pop(); continue; }
      const step = frame.steps[frame.i++];
      if (typeof step === 'string') {
        if (step.startsWith('go:')) {
          const dest = this.destination(p, step.slice(3) as PlaceSpec);
          if (!dest) return this.fail(p, `can't get to ${step.slice(3)}`);
          return this.cand(p, '@go:' + dest, dest);
        }
        if (step.startsWith('wait:')) return this.cand(p, '@wait:' + step.slice(5), p.place);
        if (step.startsWith('get:')) {
          const item = step.slice(4);
          if (w.have(p, item) > 0) continue;
          const route = this.route(p, item, this.c.depth, new Set());
          if (!route) return this.fail(p, `no way to get ${item}`);
          plan.stack.push({ task: 'get:' + item, method: -1, steps: route.steps, i: 0 });
          w.log('route', p.id, { item, steps: route.steps.map((s) => (typeof s === 'string' ? s : s.action)), cost: round(route.cost, 1) });
          continue;
        }
        if (w.tasks.has(step)) {
          if (!this.push(p, step)) return this.fail(p, `no way to ${step}`);
          continue;
        }
        if (w.actions.has(step)) {
          // in a plan aimed at someone, a step aimed at someone is aimed at them
          const c = this.actionStep(p, plan.target !== undefined && w.actions.get(step)?.target === 'person' ? { action: step, target: plan.target } : { action: step });
          if (!c) return this.fail(p, `can't ${step} now`);
          return c;
        }
        return this.fail(p, `unknown step ${step}`);
      }
      const c = this.actionStep(p, step.target === 'target' ? { ...step, target: plan.target } : step.target === undefined && plan.target !== undefined && w.actions.get(step.action)?.target === 'person' ? { ...step, target: plan.target } : step);
      if (!c) return this.fail(p, `can't ${step.action} now`);
      if (step.minutes !== undefined) c.minutes = step.minutes;
      return c;
    }
    return this.fail(p, 'the plan went round in circles');
  }

  private cand(p: PersonState, id: string, place: Id | null): Candidate {
    const plan = p.plan as PlanState;
    return { id, kind: 'action', place, rank: plan.rank, layer: 'plan', weight: 1, parts: [['plan', 1]] };
  }

  /** Where a go: step walks to: the nearest declared place its spec names that they can get to. */
  private destination(p: PersonState, spec: PlaceSpec): Id | null {
    const w = this.w;
    for (const id of w.ring.resolve(spec, p, p.plan?.target)) if (w.ring.get(id) && isFinite(w.ring.travel(p.place, id, p))) return id;
    return null;
  }

  /** An action step: the nearest place where it can be done now. */
  private actionStep(p: PersonState, step: { action: Id; at?: PlaceSpec | PlaceSpec[]; target?: Id }): Candidate | null {
    const w = this.w;
    const a = w.actions.get(step.action);
    if (!a) return null;
    const plan = p.plan as PlanState;
    const places = w.ring.resolve(step.at !== undefined ? step.at : a.at ?? null, p, step.target);
    for (const place of places.length ? places : [null]) {
      const c: Candidate = { id: a.id, kind: 'action', place, target: step.target, rank: plan.rank, layer: 'plan', weight: 1, parts: [['plan', 1]] };
      const why = w.mind.blockedReason(p, c);
      if (!why) return c;
      // they act on what they believe: if they think it's open, they go and find out
      if (place && /is closed then$/.test(why) && w.reverie?.belief(p.id, 'open:' + place) === true) return c;
    }
    return null;
  }

  private complete(p: PersonState): null {
    const plan = p.plan as PlanState;
    this.w.log('done-plan', p.id, { task: plan.task, minutes: Math.round(this.w.s.now - plan.started) });
    this.w.emit('planned', { id: p.id, task: plan.task, ok: true });
    if (p.directive && p.directive.do === plan.task) p.directive.done = true;
    const def = this.w.tasks.get(plan.task);
    if (def?.cooldown) p.cool[plan.task] = this.w.s.now + def.cooldown;
    p.plan = null;
    return null;
  }

  /** The step went fine: the next one. */
  stepDone(p: PersonState, ok: boolean): Candidate | null {
    if (!p.plan) return null;
    if (!ok) return this.stepFailed(p, 'step failed');
    return this.next(p);
  }

  /** The step failed: the method is marked failed and the task replanned. */
  stepFailed(p: PersonState, why: string): Candidate | null {
    const w = this.w;
    const plan = p.plan;
    if (!plan) return null;
    // what they believed was wrong
    const closed = /^(.*) is closed then$/.exec(why);
    if (closed && w.reverie) w.reverie.applyBelieve(p.id, 'open:' + closed[1], false, 'saw');
    plan.tries++;
    if (plan.tries > this.c.maxTries * this.knob('persistence', p)) return this.giveUp(p, why);
    // mark the innermost real method as failed and choose again, going outward
    while (plan.stack.length) {
      const frame = plan.stack.pop()!;
      if (frame.method < 0) continue; // a 'get:' route: replan its owner
      (plan.failed[frame.task] ||= []).push(frame.method);
      if (this.push(p, frame.task)) {
        w.log('replanned', p.id, { task: frame.task, why });
        return this.next(p);
      }
    }
    return this.giveUp(p, why);
  }

  private fail(p: PersonState, why: string): Candidate | null {
    return this.stepFailed(p, why);
  }

  private giveUp(p: PersonState, why: string): null {
    const w = this.w;
    const plan = p.plan as PlanState;
    w.log('gave-up', p.id, { task: plan.task, why });
    w.emit('planned', { id: p.id, task: plan.task, ok: false, why });
    if (w.reverie?.feelingDefs.has('frustrated')) w.reverie.applyFeel(p.id, 'frustrated', plan.task);
    const def = w.tasks.get(plan.task);
    p.cool[plan.task] = w.s.now + Math.max(def?.cooldown ?? 0, this.c.giveUp);
    p.plan = null;
    return null;
  }

  /** Sets a plan aside (something urgent came up). */
  suspend(p: PersonState): void {
    const plan = p.plan;
    if (!plan) return;
    const frame = plan.stack[plan.stack.length - 1];
    if (frame && frame.i > 0) frame.i--; // do the interrupted step again
    p.suspended.unshift(plan);
    const most = this.c.setAside;
    if (p.suspended.length > most) p.suspended.length = most;
    p.plan = null;
    this.w.log('set-aside', p.id, { task: plan.task });
  }

  /** Picks a set-aside plan back up, unless the new choice outranks it. */
  resume(p: PersonState, pick: Candidate | null): Candidate | null {
    const plan = p.suspended[0];
    if (!plan) return null;
    if (pick && pick.rank > plan.rank) return null;
    if (pick && pick.kind === 'task' && pick.id === plan.task) { p.suspended.shift(); return null; }
    p.suspended.shift();
    if (this.w.s.now - plan.started > this.c.stale) return null; // stale
    p.plan = plan;
    this.w.log('resumed', p.id, { task: plan.task });
    return this.next(p);
  }

  // -------------------------------------------------------------------------
  // get: a backward search over the ways of getting hold of something
  // -------------------------------------------------------------------------

  /** Every action that gives an item. */
  providers(item: Id): ActionDef[] {
    const out: ActionDef[] = [];
    for (const a of this.w.actions.values()) if ((a.gives?.[item] ?? 0) > 0 || (a.buys?.[item] ?? 0) > 0) out.push(a);
    return out;
  }

  /** The cheapest way for a person to get an item: steps and cost, or null. Changes nothing. */
  acquire(p: PersonState, item: Id, depth: number, seen: Set<Id>): Route | null { return this.w.peek(() => this.route(p, item, depth, seen)); }

  private route(p: PersonState, item: Id, depth: number, seen: Set<Id>): Route | null {
    if (depth <= 0 || seen.has(item)) return null;
    seen = new Set(seen).add(item);
    const w = this.w;
    let best: Route | null = null;
    for (const a of this.providers(item)) {
      if (a.job && a.job !== p.def.job?.id) continue;
      const ctx = w.ctx(p, { action: a.id });
      if (!w.lang.all(a.who, ctx)) continue;
      // conditions: 'has:' ones become sub-goals; the rest must hold now
      const needs = new Set<Id>();
      let ok = true;
      for (const c of a.if || []) {
        if (typeof c === 'string') {
          const m = /^has[.:]([A-Za-z0-9_\-]+)$/.exec(c.trim());
          if (m && !(w.have(p, m[1]) > 0)) { needs.add(m[1]); continue; }
        }
        if (!w.lang.test(c, ctx)) { ok = false; break; }
      }
      if (!ok) continue;
      for (const used in a.uses || {}) if (!(w.have(p, used) > 0)) needs.add(used);
      const places = w.ring.resolve(a.at ?? null, p);
      let place: Id | null = null, travel = Infinity;
      for (const pl of places.length ? places : [null]) {
        if (pl && !w.mind.offeredAt(a, pl, p)) continue;
        if (pl && !w.ring.open(pl)) continue;
        if (pl && a.buys) {
          const stock = w.s.places[pl]?.stock;
          if (stock && Object.keys(a.buys).some((k) => (stock[k] ?? 0) < (a.buys as Record<Id, number>)[k])) continue;
        }
        place = pl;
        travel = pl ? w.ring.travel(p.place, pl, p) : 0;
        break;
      }
      if (!isFinite(travel)) continue;
      let cost = this.cost(p, a) + travel;
      if (!isFinite(cost)) continue;
      const steps: Step[] = [];
      let subOk = true;
      for (const n of needs) {
        const sub = this.route(p, n, depth - 1, seen);
        if (!sub) { subOk = false; break; }
        steps.push(...sub.steps);
        cost += sub.cost;
      }
      if (!subOk) continue;
      steps.push(place ? { action: a.id, at: place } : a.id);
      if (!best || cost < best.cost) best = { steps, cost };
    }
    return best;
  }

  /** What an action costs a person, in minutes of effort: time, money by thrift, risk by honesty. */
  cost(p: PersonState, a: ActionDef): number {
    const w = this.w, c = this.c;
    const minutes = Array.isArray(a.minutes) ? (a.minutes[0] + a.minutes[1]) / 2 : a.minutes;
    let cost = minutes + (a.cost ?? 0);
    const price = a.price ?? 0;
    if (price) {
      const money = Number(p.vars.money ?? 0);
      if (price > money) return Infinity;
      const thrift = p.def.traits?.thrift ?? w.cfg.traitDefault;
      cost += price * c.priceWeight * (0.5 + thrift) * (1 + clamp(price / Math.max(1, money)));
    }
    // the headline knob: how much their scruples cost them
    const scruples = a.tags?.includes('illegal') || a.against?.length ? this.knob('scruples', p) : 1;
    if (a.tags?.includes('illegal')) {
      const honesty = p.def.traits?.honesty ?? w.cfg.traitDefault;
      if (honesty >= c.honestNever) return Infinity;
      cost += (c.riskBase + honesty * c.riskHonesty + (w.wormtongue ? w.wormtongue.heat(p.id) * c.riskHeat : 0)) * scruples;
    }
    for (const v of a.against || []) {
      const held = p.def.values?.[v] ?? 0;
      if (held >= c.valuesNever) return Infinity;
      cost += held * c.valuesCost * scruples;
    }
    return cost;
  }
}
