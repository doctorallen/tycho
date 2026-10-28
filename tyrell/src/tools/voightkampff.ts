// Voight-Kampff: the behavior tests. Named for Blade Runner's test that tells
// a person from a machine. It runs a world headless for seeded days and checks
// that people still behave like people: nobody starves, no place is over
// capacity, everyone sleeps, nobody stands about for hours, the same seed
// gives the same world, and time walk and saving give back exactly what they
// took. It also gathers the numbers a baseline can be compared against.
import type { Id } from '../core/types';
import type { World } from '../core/world';
import { DAY, HOUR, hourOf, round } from '../core/util';

export interface VKCheck {
  name: string;
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
  const moods: Array<{ day: number; vals: number[] }> = [];
  const places: Record<number, Record<Id, number>> = {};
  const needMax: Record<Id, number> = {};
  let decisions = 0;
  w.on('decided', () => { decisions++; });
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
  return {
    seed, days, passed: failures.length === 0, failures,
    checks: names.map((c) => (typeof c === 'string' ? c : c.name)),
    stats: { actions, mood, places, needs: needMax, decisions: decided, ms: Date.now() - t0 },
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
