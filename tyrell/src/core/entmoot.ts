// Entmoot: the clock and the scheduler. Named for the Ents' council, which
// takes its time and gets there in the end.
//
// Off screen nothing ticks: every action's end is an event in a queue, along
// with the moments something changes (a shift starting, a routine entry, an
// urgent need), and the clock jumps from one to the next. A person on screen
// ("near") is the same person: the game is handed a body to walk and pose,
// and Entmoot keeps the same timetable either way, so someone who sets out
// for the bar arrives at the same minute whether or not anyone watched.
import type { Body, Candidate, Doing, Id, PersonState, QueueItem, Value } from './types';
import type { World } from './world';
import { backoffKey } from './bicameral';
import { DAY, HOUR, clamp, heapPeek, heapPop, heapPush, hourOf } from './util';

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Failures for one person at one moment before they rest instead of choosing again. */
const MAX_FAILS = 10;

export class Entmoot {
  /** Regions the game has loaded (not saved: the game says it again after a load). */
  private regions = new Set<string>();
  /** Who has a body right now. */
  private near = new Set<Id>();
  private started = false;
  /** The seq of the event being handled, or null (World defers inputs made meanwhile). */
  handling: number | null = null;

  constructor(private w: World) {}

  /** Called once at creation: starts the hourly tick. */
  boot(): void {
    if (this.started) return;
    this.started = true;
    const t = this.w.s.now;
    const next = Math.floor(t / HOUR) * HOUR + HOUR;
    this.schedule({ t: next, k: 'hour' });
  }

  /** Forgets transient things (after a load or a seek). */
  reset(): void {
    for (const id of this.near) this.w.emit('disembody', { id });
    this.near.clear();
  }

  /** Puts something on the queue. */
  schedule(item: Omit<QueueItem, 'seq'>): number {
    const seq = this.w.nextSeq();
    heapPush(this.w.s.q, { ...item, seq } as QueueItem);
    return seq;
  }

  /** Queues the end of someone's current doing; the doing carries the same seq. */
  private scheduleEnd(p: PersonState, t: number): number {
    const seq = this.w.nextSeq();
    heapPush(this.w.s.q, { t, seq, k: 'end', who: p.id, ref: seq });
    return seq;
  }

  // -------------------------------------------------------------------------
  // Running time
  // -------------------------------------------------------------------------

  /**
   * Runs events up to time `target`. Inputs Esper still has in its future
   * (after a rewind) are applied at their times. With a budget, stops early
   * (at a whole timestamp) and returns false; the rest runs next frame.
   */
  advanceTo(target: number, budgetMs: number): boolean {
    const w = this.w, q = w.s.q, esper = w.esper;
    const t0 = budgetMs < Infinity ? now() : 0;
    esper.ensureBase();
    for (;;) {
      const ev = heapPeek(q);
      const inp = esper.pending();
      if (inp && inp.after === undefined && !inp.chain && inp.t <= target && (!ev || ev.t > inp.t)) {
        esper.passMarks(inp.t);
        if (inp.t > w.s.now) w.s.now = inp.t;
        esper.applyNext();
        continue;
      }
      if (ev && ev.t <= target) {
        esper.passMarks(ev.t);
        heapPop(q);
        if (ev.t > w.s.now) w.s.now = ev.t;
        this.run(ev);
        if (budgetMs < Infinity && now() - t0 > budgetMs) {
          // finish this timestamp so the state is whole, then stop
          let more = heapPeek(q);
          while (more && more.t === ev.t) { heapPop(q); this.run(more); more = heapPeek(q); }
          return false;
        }
        continue;
      }
      break;
    }
    esper.passMarks(target);
    if (target > w.s.now) w.s.now = target;
    return true;
  }

  /** Handles one event, then the inputs that came in while it was handled. */
  private run(ev: QueueItem): void {
    const w = this.w;
    this.handling = ev.seq;
    try { this.handle(ev); } finally { this.handling = null; }
    w.flushDeferred(ev.seq);
    for (let inp = w.esper.pending(); inp && inp.after === ev.seq; inp = w.esper.pending()) w.esper.applyNext();
  }

  private handle(ev: QueueItem): void {
    const w = this.w;
    switch (ev.k) {
      case 'end': {
        const p = ev.who ? w.s.people[ev.who] : undefined;
        if (!p || p.status !== 'active' || !p.doing || p.doing.seq !== ev.ref) return;
        this.finish(p);
        return;
      }
      case 'think': {
        const p = ev.who ? w.s.people[ev.who] : undefined;
        if (!p || p.status !== 'active') return;
        const mode = String(ev.data?.mode ?? 'free');
        if (mode === 'free') {
          if (p.doing) return; // something else got them going
          this.think(p);
        } else this.reconsider(p, mode);
        return;
      }
      case 'hour': {
        const t = ev.t;
        w.mind.hour(t);
        for (const m of w.hooks) m.hour?.(t);
        if (Math.round(hourOf(t) * 60) % (24 * 60) === 0) {
          const day = Math.round(t / DAY);
          for (const m of w.hooks) m.day?.(day);
          w.log('day', undefined, { day });
        }
        this.schedule({ t: t + HOUR, k: 'hour' });
        return;
      }
      case 'timer': {
        const name = String(ev.ref ?? '');
        w.log('timer', undefined, { name });
        w.emit('timer', { name, data: ev.data ?? {}, t: ev.t });
        w.emit('timer:' + name, { name, data: ev.data ?? {}, t: ev.t });
        return;
      }
      case 'module': {
        const m = w.modules.get(String(ev.ref));
        m?.timer?.(ev);
        return;
      }
      case 'back': {
        const p = ev.who ? w.s.people[ev.who] : undefined;
        if (p && p.status === 'away') this.comeBack(p);
        return;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Thinking
  // -------------------------------------------------------------------------

  /** Has someone think after a delay (minutes). */
  wake(p: PersonState, delay: number, mode = 'free'): void {
    this.schedule({ t: this.w.s.now + Math.max(0, delay), k: 'think', who: p.id, data: { mode } });
  }

  /** Thinks and starts whatever wins. */
  think(p: PersonState): void {
    const w = this.w;
    w.mind.ensureNeeds(p);
    const dec = w.mind.decide(p);
    let pick = dec.picked;
    // a plan that was set aside picks up again, unless something outranks it (Mentat)
    const mentat = w.mentat;
    if (mentat && p.suspended.length) {
      const next = mentat.resume(p, pick);
      if (next) pick = next;
    }
    if (!pick) { this.idle(p); return; }
    this.begin(p, pick);
  }

  /**
   * Thinks again while busy (a routine boundary, an urgent need): switches
   * only if something now outranks what they're doing.
   */
  reconsider(p: PersonState, mode: string): void {
    const w = this.w;
    if (!p.doing) { this.think(p); return; }
    if (p.doing.kind === 'travel' && mode !== 'boundary') return;
    const dec = w.mind.decide(p);
    const pick = dec.picked;
    const cur = p.doing;
    const outranks = pick && pick.rank > cur.rank;
    const stale = mode === 'boundary' && (cur.layer === 'routine' || cur.layer === 'job' || cur.layer === 'story') && cur.until !== undefined && cur.until <= w.s.now + 1e-6;
    if (outranks || stale || (cur.kind === 'wait' && pick)) {
      if (pick && pick.id === cur.action && pick.place === (cur.kind === 'travel' ? cur.to : cur.place) && !stale) return;
      this.interrupt(p, outranks ? 'something mattered more' : 'time for something else', !!outranks);
      if (pick) this.begin(p, pick); else this.idle(p);
    } else {
      this.scheduleChecks(p);
    }
  }

  /** Interrupts and thinks again now. */
  rethink(p: PersonState, why: string): void {
    if (p.status !== 'active') return;
    if (p.doing) this.interrupt(p, why, true);
    this.think(p);
  }

  /** Nothing to do: wait where they are, then think again. */
  idle(p: PersonState): void {
    const w = this.w;
    const end = w.s.now + w.config.idle;
    const seq = this.scheduleEnd(p, end);
    p.doing = { kind: 'wait', action: 'wait', place: p.place, start: w.s.now, end, rank: -1, layer: 'idle', seq };
    this.announce(p);
  }

  // -------------------------------------------------------------------------
  // Doing things
  // -------------------------------------------------------------------------

  /** Starts an option: walks there first if it's somewhere else. */
  begin(p: PersonState, c: Candidate): void {
    const w = this.w;
    if (c.kind === 'task') {
      const mentat = w.mentat;
      const step = mentat ? mentat.begin(p, c) : null;
      if (!step) { this.idle(p); return; }
      c = step;
    }
    if (c.id.startsWith('@go:')) {
      // a bare walk (a plan's go: step)
      this.travelTo(p, c, c.place);
      return;
    }
    if (c.id.startsWith('@wait:')) {
      const minutes = Number(c.id.slice(6)) || w.config.idle;
      const end = w.s.now + minutes;
      const seq = this.scheduleEnd(p, end);
      p.doing = { kind: 'wait', action: 'wait', place: p.place, start: w.s.now, end, rank: c.rank, layer: c.layer, seq, task: p.plan?.task };
      this.announce(p);
      return;
    }
    const dest = c.place ?? p.place;
    if (dest && p.place && dest !== p.place && w.ring.travel(p.place, dest, p) > 0) { this.travelTo(p, c, dest); return; }
    if (dest && !p.place) { this.travelTo(p, c, dest); return; }
    if (dest && dest !== p.place) p.place = dest; // free move (same building)
    this.act(p, c);
  }

  private travelTo(p: PersonState, c: Candidate, dest: Id | null): void {
    const w = this.w;
    if (!dest) { this.act(p, c); return; }
    const minutes = w.ring.travel(p.place, dest, p);
    // a walk that would never end (an unknown or unreachable place) fails instead
    if (!isFinite(minutes)) { this.fail(p, `can't get to ${dest}`, true, { action: c.id, place: dest }); return; }
    w.ring.release(p.place, p.slot, p.id);
    delete p.slot;
    const end = w.s.now + Math.max(0.5, minutes);
    const seq = this.scheduleEnd(p, end);
    p.doing = {
      kind: 'travel', action: c.id, place: null, from: p.place, to: dest, start: w.s.now, end,
      rank: c.rank, layer: c.layer, seq, target: c.target, until: c.until, slot: c.slot,
    };
    if (c.fill === false) p.doing.fill = false;
    if (c.minutes !== undefined) p.doing.minutes = c.minutes;
    if (p.plan) p.doing.task = p.plan.task;
    p.place = null;
    w.log('set-out', p.id, { to: dest, for: c.id });
    for (const m of w.hooks) m.started?.(p, p.doing);
    this.announce(p);
    this.carryFollowers(p);
    this.scheduleChecks(p);
  }

  /** Starts the action itself, here. */
  act(p: PersonState, c: Candidate): void {
    const w = this.w;
    const a = w.actions.get(c.id);
    if (!a) { this.idle(p); return; }
    const place = c.place ?? p.place;
    // the slot
    if (a.slot && place) {
      if (p.slot && p.place && p.slot !== a.slot) w.ring.release(p.place, p.slot, p.id);
      if (!w.ring.claim(place, a.slot, p.id)) {
        const why = w.ring.allowed(place, a.slot, p) ? `no free ${a.slot} at ${place}` : `the ${a.slot} at ${place} isn't for them`;
        this.fail(p, why, true, { action: a.id, place });
        return;
      }
      p.slot = a.slot;
    } else if (p.slot && p.place) { w.ring.release(p.place, p.slot, p.id); delete p.slot; }
    // how long
    const r = w.stream(p);
    let minutes = c.minutes ?? (Array.isArray(a.minutes) ? r.range(a.minutes[0], a.minutes[1]) : a.minutes);
    if (c.until !== undefined && isFinite(c.until) && (c.layer === 'routine' || c.layer === 'job' || c.layer === 'story') && a.fill !== false && c.fill !== false) {
      minutes = Math.max(c.until - w.s.now, Math.min(minutes, 5));
    }
    minutes = Math.max(0.5, minutes);
    const end = w.s.now + minutes;
    const seq = this.scheduleEnd(p, end);
    p.place = place;
    p.doing = { kind: 'act', action: a.id, place, slot: a.slot, target: c.target, start: w.s.now, end, rank: c.rank, layer: c.layer, seq, until: c.until };
    if (p.plan) p.doing.task = p.plan.task;
    // the conditions at the start (a place may have closed on the way)
    w.log('started', p.id, { action: a.id, place, layer: c.layer, ...(c.target ? { target: c.target } : {}) });
    for (const m of w.hooks) m.started?.(p, p.doing);
    if (!p.doing || p.doing.seq !== seq) return; // a module stopped it
    if (p.directive && p.directive.do === a.id && c.layer === 'story') p.directive.done = true;
    this.announce(p);
    this.carryFollowers(p);
    this.meet(p);
    this.scheduleChecks(p);
  }

  /** The action or walk ran its course. */
  finish(p: PersonState): void {
    const w = this.w;
    const d = p.doing as Doing;
    if (d.kind === 'travel') {
      p.place = d.to ?? null;
      p.doing = null;
      w.log('arrived', p.id, { place: p.place });
      for (const m of w.hooks) m.arrived?.(p, p.place as Id);
      w.emit('arrive', { id: p.id, place: p.place });
      if (d.action.startsWith('@go:')) { this.afterStep(p, d, true); return; }
      const c: Candidate = { id: d.action, kind: 'action', place: p.place, target: d.target, rank: d.rank, layer: d.layer, weight: 1, parts: [], until: d.until, slot: d.slot };
      if (d.fill === false) c.fill = false;
      if (d.minutes !== undefined) c.minutes = d.minutes;
      // still worth doing? (the place may have closed while they walked)
      const why = w.mind.blockedReason(p, c);
      if (why) { this.fail(p, why, true, { action: d.action, place: p.place }); return; }
      this.act(p, c);
      return;
    }
    p.doing = null;
    if (d.kind === 'act') this.complete(p, d, 1, false);
    this.afterStep(p, d, true);
  }

  /** Applies what finishing (some of) an action does: relief, effects, learning. */
  private complete(p: PersonState, d: Doing, frac: number, interrupted: boolean): void {
    const w = this.w;
    const a = w.actions.get(d.action);
    w.mind.settle(p, d);
    const { got, expected } = w.mind.relieve(p, d, frac);
    if (a && !interrupted) {
      const ctx = w.ctx(p, { place: d.place, target: d.target ?? null, action: a.id });
      w.lang.applyAll(a.then, ctx);
      // a deed done to someone: the same path as the game's world.did()
      if (a.deed && d.target) {
        const data: Record<string, Value> = { for: d.target };
        if (d.place) data.place = d.place;
        w.log('did', p.id, { verb: a.deed, for: d.target });
        for (const m of w.hooks) m.did?.(p.id, a.deed, data);
      }
    }
    if (a && frac > 0.2) w.mind.learn(p, a.id, got, expected);
    if (a?.trains) w.skills.practiced(p, a.trains, d.start);
    w.mind.finished(p, d, frac, interrupted);
    if (a?.cooldown) p.cool[a.id] = w.s.now + a.cooldown;
    p.last = d.action;
    p.lastEnd = w.s.now;
    if (d.slot && d.place) { w.ring.release(d.place, d.slot, p.id); if (p.slot === d.slot) delete p.slot; }
    for (const m of w.hooks) m.ended?.(p, d, frac, interrupted);
    w.log(interrupted ? 'stopped' : 'finished', p.id, { action: d.action, place: d.place, frac: Math.round(frac * 100) / 100 });
  }

  /** What happens after a step: the plan goes on, or they think again. */
  private afterStep(p: PersonState, d: Doing, ok: boolean): void {
    const w = this.w;
    if (p.status !== 'active') return;
    if (p.plan && w.mentat && d.layer === 'plan') {
      const next = w.mentat.stepDone(p, ok);
      if (next) { this.begin(p, next); return; }
    }
    this.think(p);
  }

  /** Stops what they're doing, keeping what they got from it so far. */
  interrupt(p: PersonState, why: string, suspendPlan: boolean): void {
    const w = this.w;
    const d = p.doing;
    if (!d) return;
    p.doing = null;
    const frac = clamp((w.s.now - d.start) / Math.max(1e-6, d.end - d.start));
    if (d.kind === 'act') this.complete(p, d, frac, true);
    else if (d.kind === 'travel') {
      p.place = frac >= 0.5 ? d.to ?? null : d.from ?? d.to ?? null;
      for (const m of w.hooks) m.ended?.(p, d, frac, true);
    } else for (const m of w.hooks) m.ended?.(p, d, frac, true);
    if (p.plan && w.mentat && d.layer === 'plan') {
      if (suspendPlan) w.mentat.suspend(p);
    }
    w.log('interrupted', p.id, { action: d.action, why });
  }

  /**
   * Something went wrong: the slot was taken, the door was shut. The action
   * is ruled out at that place for config.backoff minutes, and they think
   * again. `what` names what failed when it never became their doing.
   */
  fail(p: PersonState, why: string, alreadyStopped = false, what?: { action: Id; place: Id | null }): void {
    const w = this.w;
    const d = p.doing;
    const now = w.s.now;
    // a guard against failing in a loop: count the failures at this moment
    const n = p.fails && p.fails[0] === now ? p.fails[1] + 1 : 1;
    p.fails = [now, n];
    if (n > MAX_FAILS && d?.kind === 'wait' && !alreadyStopped) return; // resting already: leave them be
    const failed = what ?? (d && d.kind !== 'wait' ? { action: d.action, place: d.kind === 'travel' ? d.to ?? null : d.place } : null);
    if (d && !alreadyStopped) {
      p.doing = null;
      const frac = clamp((now - d.start) / Math.max(1e-6, d.end - d.start));
      if (d.kind === 'act') this.complete(p, d, frac, true);
      else if (d.kind === 'travel') p.place = frac >= 0.5 ? d.to ?? null : d.from ?? null;
    } else if (alreadyStopped) p.doing = null;
    w.log('failed', p.id, { why });
    w.emit('failed', { id: p.id, why });
    for (const m of w.hooks) (m as any).failed?.(p, why);
    // back off: don't choose the same thing at the same place again at once
    if (failed) {
      for (const k in p.cool) if (k.startsWith('@fail:') && p.cool[k] <= now) delete p.cool[k];
      p.cool[backoffKey(failed.action, failed.place)] = now + w.config.backoff;
    }
    if (n >= MAX_FAILS) {
      // too many at once: set any plan aside and rest a while instead of choosing again
      if (p.plan && w.mentat) w.mentat.suspend(p);
      this.idle(p);
      return;
    }
    if (p.plan && w.mentat) {
      const next = w.mentat.stepFailed(p, why);
      if (next) { this.begin(p, next); return; }
    }
    this.think(p);
  }

  /** The game says they're done early. */
  finishNow(p: PersonState): void {
    const d = p.doing;
    if (!d) return;
    d.end = this.w.s.now;
    this.finish(p);
  }

  /** Re-checks for urgent needs and stack changes while busy. */
  scheduleChecks(p: PersonState): void {
    const w = this.w;
    const d = p.doing;
    if (!d) return;
    // (with checksOnce, a check already queued for that moment isn't queued again)
    const queued = (t: number, mode: string): boolean => w.config.checksOnce && w.s.q.some((e) => e.k === 'think' && e.who === p.id && e.t === t && e.data?.mode === mode);
    const boundary = w.mind.nextBoundary(p);
    if (boundary < d.end - 0.01 && !queued(boundary, 'boundary')) this.schedule({ t: boundary, k: 'think', who: p.id, data: { mode: 'boundary' } });
    const urge = w.mind.urgentAt(p);
    const at = Math.max(w.s.now + 1, urge);
    if (urge < d.end - 0.01 && !queued(at, 'urge')) this.schedule({ t: at, k: 'think', who: p.id, data: { mode: 'urge' } });
  }

  /** People at the same place meet: modules hear about it (regard, gossip, talk). */
  private meet(p: PersonState): void {
    const w = this.w;
    const d = p.doing;
    if (!d || d.kind !== 'act' || !d.place) return;
    const others = w.ring.present(d.place).filter((id) => id !== p.id);
    if (!others.length) return;
    const r = w.stream(p);
    const chosen = others.length <= 3 ? others : r.shuffle(others).slice(0, 3);
    for (const id of chosen) {
      const o = w.s.people[id];
      if (!o.doing || o.doing.kind !== 'act') continue;
      const minutes = Math.min(d.end, o.doing.end) - w.s.now;
      if (minutes < 3) continue;
      for (const m of w.hooks) m.met?.(p, o, d.place, minutes);
    }
  }

  /** Followers do what their leader does. */
  private carryFollowers(leader: PersonState): void {
    const w = this.w;
    const d = leader.doing;
    if (!d) return;
    for (const id in w.s.people) {
      const f = w.s.people[id];
      if (f.follow !== leader.id || f.status !== 'active' || f === leader) continue;
      if (f.doing && f.doing.rank > d.rank) continue;
      if (f.doing) this.interrupt(f, 'following ' + leader.name, false);
      const seq = this.scheduleEnd(f, d.end);
      f.doing = { ...d, seq, layer: 'follow', slot: undefined };
      if (d.kind === 'travel') { w.ring.release(f.place, f.slot, f.id); delete f.slot; f.place = null; }
      else if (d.slot && d.place && w.ring.claim(d.place, d.slot, f.id)) { f.doing.slot = d.slot; f.slot = d.slot; f.place = d.place; }
      else f.place = d.place;
      this.announce(f);
    }
  }

  /** A fact changed: places that closed turn people away when they get there. */
  factChanged(_key: string): void { /* people find out on arrival; modules may listen to 'fact' */ }

  // -------------------------------------------------------------------------
  // Away and gone
  // -------------------------------------------------------------------------

  sendAway(id: Id, until: number, summary: string, place: Id | null): void {
    const w = this.w;
    const p = w.s.people[id];
    if (!p || p.status !== 'active') return;
    if (p.doing) this.interrupt(p, 'went away', false);
    w.ring.release(p.place, p.slot, p.id);
    delete p.slot;
    p.status = 'away';
    p.away = { until, summary, ...(place ? { place } : {}) };
    p.place = null;
    p.doing = null;
    p.plan = null;
    this.schedule({ t: until, k: 'back', who: p.id });
    w.log('away', id, { until, summary });
  }

  private comeBack(p: PersonState): void {
    const w = this.w;
    const away = p.away;
    p.status = 'active';
    p.place = away?.place ?? p.def.home ?? null;
    // a day or two away: needs are whatever they'd settle at
    for (const id in p.needs) p.needs[id] = { v: Math.min(p.needs[id].v, 0.4), t: w.s.now };
    delete p.away;
    w.log('back', p.id, { summary: away?.summary ?? '' });
    w.emit('back', { id: p.id, summary: away?.summary ?? '' });
    this.think(p);
  }

  removePerson(id: Id, why: string): void {
    const w = this.w;
    const p = w.s.people[id];
    if (!p || p.status === 'gone') return;
    if (p.doing) this.interrupt(p, why, false);
    w.ring.release(p.place, p.slot, p.id);
    p.status = 'gone';
    p.doing = null;
    p.plan = null;
    for (const m of w.hooks) m.removed?.(p, why);
    for (const o of Object.values(w.s.people)) if (o.follow === id) delete o.follow;
    w.log('gone', id, { why });
    w.emit('gone', { id, why });
  }

  // -------------------------------------------------------------------------
  // Bodies: the hand-over to the game
  // -------------------------------------------------------------------------

  focus(regions: string[]): void {
    this.regions = new Set(regions);
    this.refreshBodies();
  }

  regionsInFocus(): string[] { return [...this.regions]; }

  /** Is someone in a focused region (or does the shell say they're visible)? */
  isNear(p: PersonState): boolean {
    if (p.status !== 'active') return false;
    const w = this.w;
    if (w.shell.near) {
      const b = this.body(p.id);
      return !!b && w.shell.near(b, w);
    }
    const d = p.doing;
    if (d && d.kind === 'travel') return this.regions.has(w.ring.region(d.from)) || this.regions.has(w.ring.region(d.to));
    return !!p.place && this.regions.has(w.ring.region(p.place));
  }

  /**
   * Emits embody and disembody for whoever came into or left view. After a
   * seek, given what the bodies were before it (shown()), also a step for
   * each body that stayed in view but changed.
   */
  refreshBodies(before?: Map<Id, string>): void {
    const w = this.w;
    if (w.replaying) return;
    const now = new Set<Id>();
    for (const id in w.s.people) if (this.isNear(w.s.people[id])) now.add(id);
    for (const id of this.near) if (!now.has(id)) w.emit('disembody', { id });
    for (const id of now) {
      if (!this.near.has(id)) w.emit('embody', this.body(id));
      else if (before && before.get(id) !== this.sig(id)) w.emit('step', this.body(id));
    }
    this.near = now;
  }

  /** What each near body is now, to tell after a seek which of them changed. */
  shown(): Map<Id, string> {
    const out = new Map<Id, string>();
    for (const id of this.near) out.set(id, this.sig(id));
    return out;
  }

  /** The parts of a body that say what it's doing (not how far through it is). */
  private sig(id: Id): string {
    const b = this.body(id);
    return b ? [b.action, b.next, b.place, b.slot, b.target, b.pose, b.start, b.end].join('|') : '';
  }

  /** Tells the game a near person started something new. */
  announce(p: PersonState): void {
    const w = this.w;
    if (w.replaying) return;
    if (!this.near.has(p.id) && !this.isNear(p)) return;
    w.emit('step', this.body(p.id));
  }

  /** Is this person embodied right now? */
  embodied(id: Id): boolean { return this.near.has(id); }

  bodies(): Body[] {
    const out: Body[] = [];
    for (const id of this.near) { const b = this.body(id); if (b) out.push(b); }
    return out;
  }

  body(id: Id): Body | null {
    const w = this.w;
    const p = w.s.people[id];
    if (!p || p.status !== 'active') return null;
    const d = p.doing;
    const t = w.s.now;
    const progress = d ? clamp((t - d.start) / Math.max(1e-6, d.end - d.start)) : 0;
    const reverie = w.reverie;
    const b: Body = {
      id, name: p.name, place: p.place, slot: p.slot, action: d ? (d.kind === 'travel' ? 'travel' : d.action) : 'wait',
      pose: 'idle', progress, start: d?.start ?? t, end: d?.end ?? t,
    };
    if (d?.target) b.target = d.target;
    if (d?.kind === 'travel') {
      b.pose = 'walk';
      b.next = d.action;
      b.travel = { from: d.from ?? null, to: d.to ?? null, start: d.start, end: d.end, f: progress };
    } else if (d?.kind === 'act') b.pose = w.actions.get(d.action)?.pose ?? 'idle';
    const r = w.mind.routineAt(p);
    if (r?.entry[3]?.with) b.with = r.entry[3].with;
    if (reverie) { b.emotion = reverie.emotion(p.id); b.mood = reverie.mood(p.id); }
    if (p.def.data) b.data = p.def.data;
    return b;
  }
}
