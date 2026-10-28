// Voight-Kampff: the behavior tests. Named for Blade Runner's test that tells
// a person from a machine. It runs a world headless for seeded days and checks
// that people still behave like people: nobody starves, no place is over
// capacity, everyone sleeps, nobody stands about for hours, the same seed
// gives the same world, and time walk and saving give back exactly what they
// took. It also gathers the numbers a baseline can be compared against, and,
// when people interact (Bree), what passed between them; the 'interactions'
// check (asked for by name) holds those exchanges to sense. When people harm
// each other (Morgul), it counts what was done and what came of it, and the
// 'harm' check (asked for by name) holds that to sense: nobody dies with
// lethality 0, grudges follow harm, the poisoner is suspected some of the
// time and not always.
import type { Id } from '../core/types';
import type { World } from '../core/world';
import { DAY, HOUR, hourOf, round } from '../core/util';

export interface VKCheck {
  name: string;
  /** Called once, when the world is built, before it runs (to listen for events). */
  start?(w: World, acc: Record<string, any>, fail: (msg: string) => void): void;
  /** Called at every sample; push failures into the list. */
  sample?(w: World, acc: Record<string, any>, fail: (msg: string) => void): void;
  /** Called once at the end. */
  end?(w: World, acc: Record<string, any>, fail: (msg: string) => void): void;
}

export interface VKOptions {
  /** Builds a fresh world for a seed (declare everything, add everyone). */
  build: (seed: string) => World;
  /** Days to run. Default 3. */
  days?: number;
  seed?: string;
  /** Minutes between samples. Default 30. */
  every?: number;
  /** Checks by name, or your own. Default: all the built-in ones. */
  checks?: Array<string | VKCheck>;
}

export interface VKStats {
  /** Share of all actions started, by action. */
  actions: Record<Id, number>;
  /** Mean and spread of mood across people, per day. */
  mood: Array<{ day: number; mean: number; sd: number }>;
  /** Where everyone is, by hour of day: place -> count, summed over days. */
  places: Record<number, Record<Id, number>>;
  /** The highest level each need reached. */
  needs: Record<Id, number>;
  /** How many decisions were made. */
  decisions: number;
  /** Milliseconds the run took. */
  ms: number;
  /** What passed between people (Bree), when anything did. */
  interactions?: VKInteractions;
  /** Harm between people (Morgul), when there was any. */
  harm?: VKHarm;
}

/** Harm between people over a run (Morgul). */
export interface VKHarm {
  /** Harms, by how they came ('blow', 'trap', 'dose'...). */
  harms: number;
  via: Record<string, number>;
  /** Fights by numbers (Bree exchanges with blows), and the blows. */
  fights: number;
  blows: number;
  /** Times someone went down, and was killed. */
  downs: number;
  killed: number;
  /** Traps set and sprung; taints made, and the doses eaten. */
  set: number;
  sprung: number;
  tainted: number;
  doses: number;
  /** Suspicions formed of harm nobody saw done: right, and wrong. */
  suspicions: number;
  right: number;
  wrong: number;
  /** Tendings, and answers to the player. */
  tended: number;
  responses: number;
  /** At the end: open wounds, and people down. */
  wounds: number;
  down: number;
}

/** What passed between people over a run (Bree's exchanges). */
export interface VKInteractions {
  /** Exchanges finished, and the turns they ran to. */
  exchanges: number;
  turns: number;
  /** Exchanges by the kind they ended as, and by outcome. */
  kinds: Record<string, number>;
  outcomes: Record<string, number>;
  /** Talk that turned into an argument or worse; people who walked off; someone who stepped in. */
  escalations: number;
  walkedOff: number;
  steppedIn: number;
  /** At the end: grudges held, and feuds. */
  grudges: number;
  feuds: number;
}

export interface VKReport {
  seed: string;
  days: number;
  passed: boolean;
  failures: string[];
  checks: string[];
  stats: VKStats;
  hash: string;
}

const builtins: Record<string, VKCheck> = {
  // asked for by name: harm between people (Morgul) makes sense
  harm: {
    name: 'harm',
    start(w, acc, fail) {
      const mg = w.morgul;
      if (!mg) return;
      acc.harmKilled = 0;
      acc.harmPoison = { right: 0, wrong: 0 };
      acc.harmVia = {} as Record<number, string>;
      acc.harmGrudges = { due: 0, held: 0 };
      w.on('morgul:killed', (e: { id: string }) => {
        acc.harmKilled++;
        if (!(Number(w.tuning('morgul', e.id).lethality) > 0)) fail(`${e.id} was killed with lethality 0 (day ${w.day})`);
      });
      w.on('morgul:harm', (h: { id: number; to: string; by: string | null; via: string; intent: string; shown: boolean; severity: number }) => {
        acc.harmVia[h.id] = h.via;
        if (!(h.severity >= 0 && h.severity <= 1)) fail(`harm ${h.id} has severity ${h.severity}`);
        // meant harm the victim saw done leaves them a grudge (Bree), however small
        if (!w.bree || !h.shown || h.intent !== 'meant' || !h.by || !w.s.people[h.by] || !w.s.people[h.to] || !w.morgul?.config.direct.includes(h.via) || !(h.severity > 0)) return;
        acc.harmGrudges.due++;
        if (w.bree.grudge(h.to, h.by) > 0) acc.harmGrudges.held++;
        else fail(`${h.to} bears ${h.by} no grudge right after harm ${h.id} (day ${w.day})`);
      });
      w.on('morgul:suspect', (e: { harm: number; right: boolean }) => {
        if (acc.harmVia[e.harm] !== 'dose') return;
        if (e.right) acc.harmPoison.right++; else acc.harmPoison.wrong++;
      });
    },
    sample(w, acc, fail) {
      const mg = w.morgul;
      if (!mg) return;
      const down: Record<string, number> = (acc.harmDown ||= {});
      for (const p of w.people()) {
        const h = mg.hurt(p.id);
        if (!(h >= 0 && h < 5)) fail(`${p.id}'s hurt is ${h} at ${w.now}`);
        if (mg.isDown(p.id)) {
          down[p.id] ??= w.now;
          if (w.now - down[p.id] > 6 * HOUR && !acc['harmDownLong:' + p.id]) { acc['harmDownLong:' + p.id] = true; fail(`${p.id} has been down for over 6 hours (day ${w.day})`); }
        } else delete down[p.id];
      }
    },
    end(w, acc, fail) {
      if (!w.morgul) return;
      const lethal = Number(w.tuning('morgul').lethality) > 0;
      if (!lethal) for (const id of Object.keys(w.s.people)) { const p = w.s.people[id]; if (p.status === 'gone' && w.cradle?.departed()[id]?.why === 'killed') fail(`${id} is gone, killed, with lethality 0`); }
      // (judged once there are enough suspicions to judge by)
      const pz = acc.harmPoison as { right: number; wrong: number } | undefined;
      if (pz && pz.right + pz.wrong >= 6) {
        if (!pz.right) fail(`the poisoner was never suspected (${pz.wrong} suspicions, all of others)`);
        if (!pz.wrong) fail(`the poisoner was suspected every time (${pz.right} suspicions): suspicion should be able to fall wrong`);
      }
    },
  },
  // asked for by name: exchanges between people (Bree) make sense
  interactions: {
    name: 'interactions',
    sample(w, acc, fail) {
      const b = w.bree;
      if (!b) return;
      const seen = new Set<string>();
      for (const ex of b.exchanges()) {
        if (w.now - ex.t > 6 * HOUR && !acc['long:' + ex.id]) { acc['long:' + ex.id] = true; fail(`exchange ${ex.id} (${ex.kind}) has gone on for over 6 hours (day ${w.day})`); }
        for (const id of ex.who) {
          if (seen.has(id)) fail(`${id} is in two exchanges at once at ${w.now}`);
          seen.add(id);
        }
      }
      for (const p of w.people()) for (const g of b.grudges(p.id)) if (!(g.strength > 0 && g.strength <= 1)) fail(`${p.id}'s grudge against ${g.id} is ${g.strength}`);
    },
  },
  'nobody-starves': {
    name: 'nobody-starves',
    sample(w, acc, fail) {
      const since: Record<string, number> = (acc.starve ||= {});
      // only needs that can break through a routine (urgent at or under 1) can starve someone
      const vital = [...w.needs.values()].filter((d) => (d.urgent ?? w.cfg.urgent) <= 1).map((d) => d.id);
      for (const p of w.people()) for (const n of vital) {
        const k = p.id + ':' + n;
        if (w.mind.level(p, n) >= 0.999) {
          since[k] ??= w.now;
          if (w.now - since[k] > 12 * HOUR && !acc['starved:' + k]) { acc['starved:' + k] = true; fail(`${p.id}'s ${n} has been at its worst for over 12 hours (day ${w.day})`); }
        } else delete since[k];
      }
    },
  },
  capacity: {
    name: 'capacity',
    sample(w, _acc, fail) {
      for (const def of w.ring.defs.values()) for (const slot in def.slots || {}) {
        const cap = w.ring.capacity(def.id, slot);
        const n = w.ring.holders(def.id, slot).length;
        if (cap > 0 && n > cap) fail(`${def.id}.${slot} holds ${n} (capacity ${cap}) at ${w.now}`);
      }
    },
  },
  'everyone-sleeps': {
    name: 'everyone-sleeps',
    end(w, _acc, fail) {
      const sleepy = [...w.actions.values()].filter((a) => a.tags?.includes('sleep')).map((a) => a.id);
      if (!sleepy.length) return;
      const started = w.westmarch.find({ k: 'started' });
      const days = new Map<string, Set<number>>();
      for (const e of started) if (e.who && sleepy.includes(String((e.d as any)?.action))) {
        const set = days.get(e.who) || new Set<number>();
        set.add(Math.floor(e.t / DAY));
        days.set(e.who, set);
      }
      const first = started.length ? Math.floor(started[0].t / DAY) : 0;
      const last = Math.floor(w.now / DAY) - 1;
      for (const p of w.people()) {
        for (let d = first + 1; d <= last; d++) {
          // a sleep that started the night before counts
          const s = days.get(p.id);
          if (!s || (!s.has(d) && !s.has(d - 1))) { fail(`${p.id} didn't sleep around day ${d}`); break; }
        }
      }
    },
  },
  'no-stuck': {
    name: 'no-stuck',
    sample(w, acc, fail) {
      const idle: Record<string, number> = (acc.idle ||= {});
      for (const p of w.people()) {
        if (!p.doing) { fail(`${p.id} is doing nothing at all at ${w.now}`); continue; }
        if (p.doing.layer === 'idle') {
          idle[p.id] ??= w.now;
          if (w.now - idle[p.id] > 4 * HOUR && !acc['stuck:' + p.id]) { acc['stuck:' + p.id] = true; fail(`${p.id} has been idle for over 4 hours (day ${w.day})`); }
        } else delete idle[p.id];
      }
    },
  },
};

/** Runs the tests. */
export function run(opts: VKOptions): VKReport {
  const seed = opts.seed ?? 'voight-kampff';
  const days = opts.days ?? 3;
  const every = opts.every ?? 30;
  const names = opts.checks ?? ['nobody-starves', 'capacity', 'everyone-sleeps', 'no-stuck', 'deterministic', 'esper', 'save-load'];
  const checks: VKCheck[] = [];
  const special = new Set<string>();
  for (const c of names) {
    if (typeof c !== 'string') { checks.push(c); continue; }
    if (builtins[c]) checks.push(builtins[c]);
    else special.add(c);
  }
  const failures: string[] = [];
  const fail = (msg: string) => { if (failures.length < 200) failures.push(msg); };
  const t0 = Date.now();
  const w = opts.build(seed);
  const start = w.now;
  const end = start + days * DAY;
  const acc: Record<string, any> = {};
  for (const c of checks) c.start?.(w, acc, fail);
  const moods: Array<{ day: number; vals: number[] }> = [];
  const places: Record<number, Record<Id, number>> = {};
  const needMax: Record<Id, number> = {};
  let decisions = 0;
  w.on('decided', () => { decisions++; });
  // what passes between people, as it ends (Bree)
  let inter: VKInteractions | null = null;
  const tally = (): VKInteractions => (inter ||= { exchanges: 0, turns: 0, kinds: {}, outcomes: {}, escalations: 0, walkedOff: 0, steppedIn: 0, grudges: 0, feuds: 0 });
  w.on('bree:end', (e: { kind: string; outcome: string; n: number; why: string }) => {
    const t = tally();
    t.exchanges++;
    t.turns += e.n;
    t.kinds[e.kind] = (t.kinds[e.kind] || 0) + 1;
    t.outcomes[e.outcome] = (t.outcomes[e.outcome] || 0) + 1;
    if (e.why === 'left') t.walkedOff++;
    if (e.why === 'stepped in') t.steppedIn++;
  });
  w.on('bree:escalated', () => { tally().escalations++; });
  // harm between people, as it comes (Morgul)
  let harm: VKHarm | null = null;
  const hurt = (): VKHarm => (harm ||= { harms: 0, via: {}, fights: 0, blows: 0, downs: 0, killed: 0, set: 0, sprung: 0, tainted: 0, doses: 0, suspicions: 0, right: 0, wrong: 0, tended: 0, responses: 0, wounds: 0, down: 0 });
  const fought = new Set<number>();
  w.on('morgul:harm', (h: { via: string; exchange?: number }) => {
    const t = hurt();
    t.harms++;
    t.via[h.via] = (t.via[h.via] || 0) + 1;
    if (h.via === 'dose') t.doses++;
    if (h.exchange !== undefined) { t.blows++; if (!fought.has(h.exchange)) { fought.add(h.exchange); t.fights++; } }
  });
  w.on('morgul:down', () => { hurt().downs++; });
  w.on('morgul:killed', () => { hurt().killed++; });
  w.on('morgul:set', () => { hurt().set++; });
  w.on('morgul:sprung', () => { hurt().sprung++; });
  w.on('morgul:tainted', () => { hurt().tainted++; });
  w.on('morgul:suspect', (e: { right: boolean }) => { const t = hurt(); t.suspicions++; if (e.right) t.right++; else t.wrong++; });
  w.on('morgul:respond', () => { hurt().responses++; });
  w.on('tended', () => { if (harm) harm.tended++; });
  for (let t = start + every; t <= end + 1e-6; t += every) {
    w.advanceTo(t);
    for (const c of checks) c.sample?.(w, acc, fail);
    const h = Math.floor(hourOf(w.now));
    const day = w.day;
    let rec = moods.find((m) => m.day === day);
    if (!rec) { rec = { day, vals: [] }; moods.push(rec); }
    for (const p of w.people()) {
      if (w.reverie) rec.vals.push(w.reverie.mood(p.id));
      const where = p.doing?.kind === 'travel' ? '(walking)' : p.place ?? '(nowhere)';
      const slot = (places[h] ||= {});
      slot[where] = (slot[where] || 0) + 1;
      for (const n of w.needs.keys()) needMax[n] = Math.max(needMax[n] ?? 0, round(w.mind.level(p, n), 3));
    }
  }
  for (const c of checks) c.end?.(w, acc, fail);
  const hash = w.hash();
  const decided = decisions;
  const counts: Record<Id, number> = {};
  let total = 0;
  for (const e of w.westmarch.find({ k: 'started' })) { const a = String((e.d as any)?.action); counts[a] = (counts[a] || 0) + 1; total++; }
  const actions: Record<Id, number> = {};
  for (const k of Object.keys(counts).sort()) actions[k] = round(counts[k] / Math.max(1, total), 4);
  const mood = moods.map((m) => {
    const mean = m.vals.reduce((a, b) => a + b, 0) / Math.max(1, m.vals.length);
    const sd = Math.sqrt(m.vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, m.vals.length));
    return { day: m.day, mean: round(mean, 4), sd: round(sd, 4) };
  });
  if (special.has('deterministic')) {
    const again = opts.build(seed);
    again.advanceTo(end);
    if (again.hash() !== hash) fail(`the same seed gave a different world (${again.hash()} vs ${hash})`);
  }
  if (special.has('esper') && w.esper.on) {
    const back = Math.max(w.esper.earliest(), w.now - 6 * HOUR);
    const before = w.hash();
    w.seek(back);
    w.seek(end);
    if (w.hash() !== before) fail(`going back to ${back} and forward again changed the world`);
  }
  if (special.has('save-load')) {
    const saved = JSON.stringify(w.save());
    const copy = opts.build(seed);
    copy.load(saved);
    if (copy.hash() !== w.hash()) fail('a saved and loaded world differs from the original');
    w.advance(3 * HOUR);
    copy.advance(3 * HOUR);
    if (copy.hash() !== w.hash()) fail('a loaded world ran differently from the original');
  }
  const stats: VKStats = { actions, mood, places, needs: needMax, decisions: decided, ms: Date.now() - t0 };
  const done = inter as VKInteractions | null;
  if (done && w.bree) {
    const sorted = (o: Record<string, number>): Record<string, number> => { const out: Record<string, number> = {}; for (const k of Object.keys(o).sort()) out[k] = o[k]; return out; };
    done.kinds = sorted(done.kinds);
    done.outcomes = sorted(done.outcomes);
    done.grudges = w.people().reduce((n, p) => n + (w.bree as NonNullable<World['bree']>).grudges(p.id).length, 0);
    done.feuds = w.bree.feuds().length;
    stats.interactions = done;
  }
  const harmed = harm as VKHarm | null;
  if (harmed && w.morgul) {
    const via: Record<string, number> = {};
    for (const k of Object.keys(harmed.via).sort()) via[k] = harmed.via[k];
    harmed.via = via;
    harmed.wounds = w.people().reduce((n, p) => n + (w.morgul as NonNullable<World['morgul']>).wounds(p.id).length, 0);
    harmed.down = w.people().filter((p) => (w.morgul as NonNullable<World['morgul']>).isDown(p.id)).length;
    stats.harm = harmed;
  }
  return {
    seed, days, passed: failures.length === 0, failures,
    checks: names.map((c) => (typeof c === 'string' ? c : c.name)),
    stats,
    hash,
  };
}

/**
 * Compares a run with a baseline: action shares and mean mood within a
 * tolerance. Returns the differences (empty when they match).
 */
export function compare(report: VKReport, baseline: VKReport, tolerance = 0.05): string[] {
  const out: string[] = [];
  const keys = new Set([...Object.keys(report.stats.actions), ...Object.keys(baseline.stats.actions)]);
  for (const k of [...keys].sort()) {
    const a = report.stats.actions[k] ?? 0, b = baseline.stats.actions[k] ?? 0;
    if (Math.abs(a - b) > tolerance) out.push(`${k}: ${round(a, 3)} against ${round(b, 3)}`);
  }
  const mean = (r: VKReport) => r.stats.mood.reduce((acc, m) => acc + m.mean, 0) / Math.max(1, r.stats.mood.length);
  if (Math.abs(mean(report) - mean(baseline)) > tolerance) out.push(`mood: ${round(mean(report), 3)} against ${round(mean(baseline), 3)}`);
  return out;
}
