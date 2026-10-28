// Harm: the moment people and creatures hurt each other, in frames. A blow
// lands through a pipeline of stages the game lists in order (each may
// change the amount, stop it, mark it with a name to show, or send a blow on
// to someone else); statuses a hit leaves for a while, how they bite, stack,
// wear off and spread, and the reactions of two that meet; the means harm is
// done with (weapons, spells, poisons, traps), declared once for the player
// and the characters alike; moves (a wind-up, a strike that hits each target
// once a swing, a recovery) with flinch, stagger and steady; triggers (harm
// that waits in space, set off by a body entering or by a cycle that shows
// before it bites); the feel (the world held still a moment, the target
// longer, knockback by each body's weight, flashes, numbers rising, a shake);
// and the player's wounds, conditions that run in phases on the game's clock.
//
// It knows nothing of minds (Tyrell's Morgul settles what follows, off
// screen and on) and nothing of any game: every stage, status, reaction,
// number and random draw is the game's, passed in (a random draw only ever
// from the source the game gives, `rng`). Everything works on the game's
// own plain objects, the fields it names, so its state stays where it was.
// Lodestar's fighting is the first on it, bit for bit: its hurtEnemy and
// hurtPlayer as pipelines, its elements' statuses and reactions, its foes'
// moves, its vents, pods and marks as triggers, its spells as means
// (test/harm.test.mjs holds each piece to the game's original).

import { clamp, dist } from '../core/math';
import { tick } from '../pixels/fx';
import { Space, type Box } from '../world/collide';

/** A random source: Tycho.seed's Rng, or anything shaped like it. */
export interface Stream { f(a?: number, b?: number): number; chance?(p: number): boolean }

const num = (v: number | (() => number) | undefined, d = 0): number => (v === undefined ? d : typeof v === 'function' ? v() : v);

// ---------------------------------------------------------------------------
// The hit
// ---------------------------------------------------------------------------

/** A blow: how much, of what, from whom, and anything the game's stages read. */
export interface Blow {
  amount: number;
  /** What it's of: elements, kinds of harm (`blunt`, `cut`, `burn`...); null for none. */
  kinds?: readonly string[] | null;
  /** Who struck: a body, `'player'`, or nothing (a rockfall). */
  by?: unknown;
  /** The knock it gives, px/s, before the body's weight. */
  knock?: { x: number; y: number } | null;
  /** A heavy blow staggers. */
  heavy?: boolean;
  /** Statuses it leaves (the `afflict` stage). */
  statuses?: readonly string[];
  [field: string]: unknown;
}

/** A blow landing on a body, as the stages see it; and, once it's landed, what came of it. */
export class Hit<B = any> {
  readonly pipe: Pipeline<B>;
  readonly to: B;
  readonly blow: Blow;
  /** The amount as it stands. */
  amount: number;
  /** The blow's kinds (or null). */
  readonly kinds: readonly string[] | null;
  /** The random source the game passed (all a stage draws, it draws from this). */
  readonly rng: Stream | null;
  /** Whatever else the game passed. */
  readonly ctx: any;
  /** What `resist` made of it: 'W' weak, 'R' resisted, or null. */
  verdict: string | null = null;
  /** A flat amount reactions add as `react` ends. */
  extra = 0;
  /** Stopped: no stage after it ran. */
  stopped = false;
  /** Names to show: reactions fired, and anything a stage marks. */
  readonly marks: string[] = [];
  /** The blows sent on from it (each a Hit, landed). */
  readonly follow: Hit[] = [];
  /** The knock the body took (after its weight), if any. */
  knock: { x: number; y: number } | null = null;
  /** Staggered (a heavy blow), or flinched out of a wind-up. */
  stagger = false;
  flinch = false;
  /** How long the body was held still (`hold`). */
  hold = 0;

  constructor(pipe: Pipeline<B>, to: B, blow: Blow, rng: Stream | null, ctx: any) {
    this.pipe = pipe; this.to = to; this.blow = blow; this.amount = blow.amount; this.kinds = blow.kinds || null; this.rng = rng; this.ctx = ctx;
  }
  /** No stage after this one runs (the blow turned, soaked whole, the body gone). */
  stop(): void { this.stopped = true; }
  /** A name to show over it. */
  mark(name: string): void { this.marks.push(name); }
  /** A blow sent on to another body (a shock that arcs, a chain that shares the hit), landed now through this pipeline or another, with the same random source and context. */
  send(to: unknown, blow: Blow, pipe?: Pipeline): Hit {
    const h = (pipe || (this.pipe as Pipeline)).land(to, blow, { rng: this.rng, ctx: this.ctx });
    this.follow.push(h);
    return h;
  }
}

/** A stage: a function of the hit, or an object with a name and `land`. */
export type Stage<B = any> = ((h: Hit<B>) => void) | { name?: string; land(h: Hit<B>): void };

/** The hit: stages in the order the game lists them, each given the hit in turn until one stops it. */
export class Pipeline<B = any> {
  readonly stages: Stage<B>[];
  rng: Stream | null;
  ctx: any;
  constructor(stages: Stage<B>[], o: { rng?: Stream | null; ctx?: unknown } = {}) { this.stages = stages; this.rng = o.rng || null; this.ctx = o.ctx; }
  /** Lands a blow on a body: returns the hit, with what came of it. */
  land(to: B, blow: Blow, o: { rng?: Stream | null; ctx?: unknown } = {}): Hit<B> {
    const h = new Hit<B>(this, to, blow, o.rng || this.rng, o.ctx === undefined ? this.ctx : o.ctx);
    for (const s of this.stages) {
      if (typeof s === 'function') s(h); else s.land(h);
      if (h.stopped) break;
    }
    return h;
  }
}

// ---- stock stages -------------------------------------------------------------

/** Lets the blow through only while `open(h)` (a body that's gone, or out of reach, isn't struck). */
export function gate<B = any>(open: (h: Hit<B>) => boolean): Stage<B> {
  return { name: 'gate', land(h) { if (!open(h)) h.stop(); } };
}

/** The amount times what `by(h)` says (1 changes nothing). */
export function scale<B = any>(by: (h: Hit<B>) => number, name = 'scale'): Stage<B> {
  return { name, land(h) { h.amount *= by(h); } };
}

/**
 * Weak, resistant or neither, by kind: the amount times `of(body, kinds)`
 * (1 for a blow of no kind), and the verdict: 'W' over `weak` (1.01), 'R'
 * under `strong` (0.99), or `verdict(m)`. `shape(h, m)` has the last say on
 * the multiplier (a shell that stands in for a resistance) before it's
 * applied, once.
 */
export function resist<B = any>(o: { of: (body: B, kinds: readonly string[], h: Hit<B>) => number; verdict?: (m: number) => string | null; weak?: number; strong?: number; shape?: (h: Hit<B>, m: number) => number }): Stage<B> {
  const weak = o.weak === undefined ? 1.01 : o.weak, strong = o.strong === undefined ? 0.99 : o.strong;
  const verdict = o.verdict || ((m: number) => (m > weak ? 'W' : m < strong ? 'R' : null));
  return {
    name: 'resist',
    land(h) {
      let m = 1;
      if (h.kinds) { m = o.of(h.to, h.kinds, h); h.verdict = verdict(m); }
      if (o.shape) m = o.shape(h, m);
      h.amount *= m;
    },
  };
}

/** Armor: the amount times k / (k + armor), the body's armor from `of`. */
export function armor<B = any>(o: { k: number | (() => number); of: (body: B, h: Hit<B>) => number }): Stage<B> {
  return { name: 'armor', land(h) { const a = o.of(h.to, h), k = num(o.k); h.amount *= k / (k + a); } };
}
/** What armor lets through of a drain that isn't a blow (a burn, spores): x × k / (k + armor). */
export function armored(x: number, k: number, a: number): number { return x * k / (k + a); }

/**
 * A shield takes the blow first: what's in the body's `field` (while it's
 * above 0, or while `when(h)`) soaks as much of the amount as it can;
 * `first(h)` runs as it does (what strikes a shield is struck back), and
 * `gone(body, h)` once it's spent.
 */
export function soak<B = any>(field: string, o: { when?: (h: Hit<B>) => boolean; first?: (h: Hit<B>) => void; gone?: (body: B, h: Hit<B>) => void } = {}): Stage<B> {
  return {
    name: 'soak',
    land(h) {
      const b = h.to as any;
      if (o.when ? !o.when(h) : !(b[field] > 0)) return;
      if (o.first) o.first(h);
      const s = Math.min(b[field], h.amount);
      b[field] -= s; h.amount -= s;
      if (b[field] <= 0 && o.gone) o.gone(h.to, h);
    },
  };
}

/** Which two kinds react, and as what: pairs by either order ('frost|force' and 'force|frost' alike). */
export class Reactions {
  private readonly map: Record<string, string> = {};
  constructor(pairs: Record<string, string>) {
    for (const k in pairs) { const [a, b] = k.split('|'); this.map[a < b ? a + '|' + b : b + '|' + a] = pairs[k]; }
  }
  /** What a and b make when they meet, or null. */
  of(a: string, b: string): string | null { return this.map[a < b ? a + '|' + b : b + '|' + a] || null; }
}

/**
 * Statuses that meet: a blow of two kinds reacts with itself, and each of its
 * kinds with every status of another kind the body carries (asked in the
 * order of `kinds`), each reaction once. Each one fired that's `ready` runs
 * its `do(h)`, which returns the amount's multiplier (or null: nothing for
 * it to do, and it doesn't count); it's marked and `fired` is told. Then the
 * amount is amount × the multipliers + `h.extra` (what reactions added flat).
 */
export function react<B = any>(o: {
  table: Reactions | ((a: string, b: string) => string | null);
  kinds: readonly string[];
  carries: (body: B, kind: string, h: Hit<B>) => boolean;
  do: Record<string, (h: Hit<B>) => number | null>;
  ready?: (body: B, id: string, h: Hit<B>) => boolean;
  fired?: (body: B, id: string, h: Hit<B>) => void;
  when?: (h: Hit<B>) => boolean;
}): Stage<B> {
  const T = o.table, pair = typeof T === 'function' ? T : (a: string, b: string) => T.of(a, b);
  return {
    name: 'react',
    land(h) {
      const ks = h.kinds;
      if (!ks || (o.when && !o.when(h))) return;
      const fired: string[] = [];
      const add = (id: string | null) => { if (id && !fired.includes(id)) fired.push(id); };
      if (ks.length > 1) add(pair(ks[0], ks[1]));
      for (const k of ks) for (const c of o.kinds) if (c !== k && o.carries(h.to, c, h)) add(pair(k, c));
      let mult = 1;
      for (const id of fired) {
        if (o.ready && !o.ready(h.to, id, h)) continue;
        const fn = o.do[id];
        if (!fn) continue;
        const m = fn(h);
        if (m === null) continue;
        mult *= m;
        h.mark(id);
        if (o.fired) o.fired(h.to, id, h);
      }
      h.amount = h.amount * mult + h.extra;
    },
  };
}

/** The statuses the blow leaves (its `statuses`, and `of(kind)` for each of its kinds), each by its own stacking. */
export function afflict<B = any>(S: Statuses, o: { of?: (kind: string, h: Hit<B>) => string | null; amount?: (id: string, h: Hit<B>) => number; scale?: (id: string, h: Hit<B>) => number } = {}): Stage<B> {
  return {
    name: 'afflict',
    land(h) {
      const ids: string[] = [];
      for (const id of h.blow.statuses || []) if (!ids.includes(id)) ids.push(id);
      if (o.of && h.kinds) for (const k of h.kinds) { const id = o.of(k, h); if (id && !ids.includes(id)) ids.push(id); }
      for (const id of ids) S.give(h.to, id, { amount: o.amount ? o.amount(id, h) : undefined, scale: o.scale ? o.scale(id, h) : 1 });
    },
  };
}

/** Knockback: the blow's knock times the body's weight (`weight`, 1), added to its knock velocity (`vx`, `vy`: 'kvx', 'kvy'). */
export function knock<B = any>(o: { weight?: (body: B, h: Hit<B>) => number; vx?: string; vy?: string } = {}): Stage<B> {
  const vx = o.vx || 'kvx', vy = o.vy || 'kvy';
  return {
    name: 'knock',
    land(h) {
      const k = h.blow.knock;
      if (!k) return;
      const w = o.weight ? o.weight(h.to, h) : 1, b = h.to as any;
      b[vx] += k.x * w; b[vy] += k.y * w;
      h.knock = { x: k.x * w, y: k.y * w };
    },
  };
}

/**
 * Stagger, flinch and steady. A heavy blow staggers a body that `can` be
 * (and is `open` to it now): its `state` to `into` ('stagger') for `heavy` s
 * (times the blow's `scale` field, if it has one). Else a body in its
 * wind-up (`windup`) struck for at least `flinch.share` of its health
 * (`flinch.of`: 'maxHp') breaks it off, staggered for `flinch.time`, once
 * every `flinch.gap` by `flinch.clock` (kept in `flinch.at`: 'flinchAt'). A
 * body `steady` shrugs off both.
 */
export function stagger<B = any>(o: {
  can?: (body: B, h: Hit<B>) => boolean; steady?: (body: B, h: Hit<B>) => boolean; open?: (body: B, h: Hit<B>) => boolean;
  state?: string; time?: string; into?: string; windup?: string;
  heavy: number | (() => number); scale?: string;
  flinch?: { share: number | (() => number); time: number | (() => number); gap: number | (() => number); clock: () => number; at?: string; of?: string };
}): Stage<B> {
  const S = o.state || 'state', Tm = o.time || 't', into = o.into || 'stagger', wind = o.windup || 'windup', F = o.flinch;
  const at = (F && F.at) || 'flinchAt', of = (F && F.of) || 'maxHp';
  return {
    name: 'stagger',
    land(h) {
      const b = h.to as any, can = !o.can || o.can(h.to, h), steady = !!o.steady && o.steady(h.to, h);
      if (h.blow.heavy && can && !steady && (!o.open || o.open(h.to, h))) {
        b[S] = into; b[Tm] = num(o.heavy) * ((o.scale ? (h.blow[o.scale] as number) : 0) || 1); h.stagger = true;
      } else if (F && b[S] === wind && can && !steady && h.amount >= b[of] * num(F.share) && F.clock() - (b[at] || -9) > num(F.gap)) {
        b[S] = into; b[Tm] = num(F.time); b[at] = F.clock(); h.flinch = true;
      }
    },
  };
}

/** The struck body held still a moment as the blow lands: its `field` ('hitT') to at least `time` s (`heavy` for a heavy blow), if it `can` be. */
export function hold<B = any>(o: { field?: string; time: number | (() => number); heavy?: number | (() => number); can?: (body: B, h: Hit<B>) => boolean }): Stage<B> {
  const f = o.field || 'hitT';
  return {
    name: 'hold',
    land(h) {
      if (o.can && !o.can(h.to, h)) return;
      const b = h.to as any, t = h.blow.heavy && o.heavy !== undefined ? num(o.heavy) : num(o.time);
      b[f] = Math.max(b[f] || 0, t);
      h.hold = t;
    },
  };
}

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

/**
 * A status: what a hit leaves on a body for a while. A timer is a number on
 * the body, the time left (a chill, an element's mark); a dose is an object
 * ({ t, and its amount a second in its `dose` field, n stacks, tick }), and
 * bites while it lasts (a burn, a poison). Where the body keeps it is the
 * game's: a field (`at`, by default the id) or a field's key (['st', 'frost']).
 */
export interface StatusDef {
  id: string;
  at?: string | readonly [string, string];
  /** A dose, and the name of its amount a second ('dps'); unset, a timer. */
  dose?: string;
  /** How long one lasts, s. */
  time?: number | (() => number);
  /** Its beat, s: a dose shows (and with `bite: 'beat'` bites) each beat. */
  every?: number | (() => number);
  /** A dose bites `steady` (amount × dt each step) or on its `beat` (amount × every). */
  bite?: 'steady' | 'beat';
  /**
   * Given again while it lasts: `max` the longer time (a timer); `set` the
   * time given; `count` one more (or n), back to none at `most` ('full');
   * `add` (a dose) one more stack to `most`, the amount added to `most`
   * times one, the longer time; `refresh` (a dose) a fresh one, its amount
   * the larger of the two; `keep` the one there.
   */
  stack?: 'max' | 'set' | 'count' | 'add' | 'refresh' | 'keep';
  most?: number | (() => number);
  /** How a timer wears off: `clamp` (down to 0 every step), `clear` (down while above 0; at 0, `ends`), `down` (down while above 0, past 0). */
  wear?: 'clamp' | 'clear' | 'down';
  ends?: (body: any) => void;
  /** How it spreads, by default (`spread`): r px round, measured to the other body's `edge` (r + its r) or its `middle`; `on: 'death'` for `died` (a hit's spreading, or at its most, is the game's to call). */
  spread?: { r: number | (() => number); reach?: 'edge' | 'middle'; on?: 'death' | 'hit' | 'most' };
}

/** What a give did: put on fresh, again on one there, to its most, or full (a count run up and back to none). */
export type Given = 'new' | 'again' | 'most' | 'full' | 'kept';

export interface TickHooks<B = any> {
  /** Whether doses bite now (and count their beat). */
  bites?: (body: B, id: string) => boolean;
  /** A dose's bite: amount (amount a second × dt, or × every on a beat). */
  bite?: (body: B, id: string, amount: number, s: any) => void;
  /** A dose's beat (a number to show). */
  show?: (body: B, id: string, s: any) => void;
  /** After each dose: true stops the tick (the body fell). */
  after?: (body: B, id: string) => boolean | void;
}

export class Statuses {
  readonly defs: StatusDef[];
  private readonly byId = new Map<string, StatusDef>();
  constructor(defs: readonly StatusDef[]) {
    this.defs = defs.slice();
    for (const d of this.defs) this.byId.set(d.id, d);
  }
  def(id: string): StatusDef {
    const d = this.byId.get(id);
    if (!d) throw new Error(`Tycho.harm: no status ${id}`);
    return d;
  }
  private slot(body: any, d: StatusDef, make: boolean): [any, string] | null {
    const at = d.at || d.id;
    if (typeof at === 'string') return [body, at];
    let m = body[at[0]];
    if (!m) { if (!make) return null; m = body[at[0]] = {}; }
    return [m, at[1]];
  }
  /** Its time left (a timer), its dose (or null), or undefined if the body keeps nothing for it. */
  get(body: any, id: string): any {
    const s = this.slot(body, this.def(id), false);
    return s ? s[0][s[1]] : undefined;
  }
  /** Carried: a timer above 0, a dose there. */
  has(body: any, id: string): boolean {
    const d = this.def(id), v = this.get(body, id);
    return d.dose ? !!v : v > 0;
  }
  /** Puts it there as given (a time, a dose), whatever was there. */
  put(body: any, id: string, v: unknown): void { const s = this.slot(body, this.def(id), true)!; s[0][s[1]] = v; }
  /** Gone: a timer to 0, a dose to null. */
  clear(body: any, id: string): void {
    const d = this.def(id), s = this.slot(body, d, false);
    if (s) s[0][s[1]] = d.dose ? null : 0;
  }

  /**
   * Gives it, by its stacking: `time` (its own, else the def's) times
   * `scale`; a dose's `amount` a second; `n` for a count. Returns what it did.
   */
  give(body: any, id: string, o: { time?: number; scale?: number; amount?: number; n?: number } = {}): Given {
    const d = this.def(id), s = this.slot(body, d, true)!, box = s[0], key = s[1], cur = box[key];
    const time = (o.time === undefined ? num(d.time) : o.time) * (o.scale === undefined ? 1 : o.scale);
    const stack = d.stack || (d.dose ? 'refresh' : 'max');
    if (!d.dose) {
      if (stack === 'count') {
        const most = num(d.most, Infinity), v = (cur || 0) + (o.n === undefined ? 1 : o.n);
        if (v >= most) { box[key] = 0; return 'full'; }
        box[key] = v; return cur ? 'again' : 'new';
      }
      if (stack === 'keep' && cur > 0) return 'kept';
      box[key] = stack === 'set' || stack === 'keep' ? time : Math.max(cur || 0, time);
      return cur > 0 ? 'again' : 'new';
    }
    const f = d.dose, a = o.amount === undefined ? 0 : o.amount;
    if (stack === 'keep' && cur) return 'kept';
    if (stack === 'add') {
      if (cur) {
        const most = num(d.most, Infinity);
        cur.n = Math.min(most, (cur.n || 1) + 1);
        cur[f] = Math.min(cur[f] + a, a * most);
        cur.t = Math.max(cur.t, time);
        return cur.n >= most ? 'most' : 'again';
      }
      box[key] = { t: time, [f]: a, n: 1 };
      return 'new';
    }
    // refresh (and set: the amount as given)
    box[key] = { t: time, [f]: stack === 'set' ? a : Math.max(a, cur ? cur[f] : 0) };
    return cur ? 'again' : 'new';
  }

  /** Timers worn down by dt, each by its `wear` (doses wear in `tick`). */
  wear(body: any, dt: number): void {
    for (const d of this.defs) {
      if (d.dose || !d.wear) continue;
      const s = this.slot(body, d, false);
      if (!s) continue;
      const box = s[0], key = s[1];
      if (d.wear === 'clamp') { if (box[key] !== undefined) box[key] = Math.max(0, box[key] - dt); }
      else if (d.wear === 'down') { if (box[key] > 0) box[key] -= dt; }
      else if (box[key] > 0 && (box[key] -= dt) <= 0) { box[key] = 0; if (d.ends) d.ends(body); }
    }
  }

  /**
   * Doses, each step: its time down by dt; while it `bites`, its bite and
   * its beat (every `every` s: `show`); gone once its time is out; then
   * `after`, which may stop the tick (the body fell).
   */
  tick<B = any>(body: B, dt: number, o: TickHooks<B> = {}): void {
    for (const d of this.defs) {
      if (!d.dose) continue;
      const s = this.slot(body, d, false);
      const dose = s && s[0][s[1]];
      if (!dose) continue;
      dose.t -= dt;
      if (!o.bites || o.bites(body, d.id)) {
        const beat = d.bite === 'beat';
        if (!beat && o.bite) o.bite(body, d.id, dose[d.dose] * dt, dose);
        dose.tick = (dose.tick || 0) - dt;
        if (dose.tick <= 0) {
          const every = num(d.every, 1);
          dose.tick = every;
          if (beat && o.bite) o.bite(body, d.id, dose[d.dose] * every, dose);
          if (o.show) o.show(body, d.id, dose);
        }
      }
      if (dose.t <= 0) s![0][s![1]] = null;
      if (o.after && o.after(body, d.id)) break;
    }
  }

  /**
   * Spreads what one body carries to others near (`to`): each that `who`
   * lets catch it, within `r` (the def's) of it, to its edge or middle, that
   * `take` agrees to (a weaker one, or none), gets `as(s, q)` (else a copy).
   * Returns how many caught it.
   */
  spread(from: any, id: string, to: Iterable<any>, o: { r?: number; reach?: 'edge' | 'middle'; who?: (q: any) => boolean; take?: (q: any, s: any) => boolean; as?: (s: any, q: any) => unknown } = {}): number {
    const d = this.def(id), sp = d.spread, s = this.get(from, id);
    const r = o.r === undefined ? num(sp && sp.r) : o.r, edge = (o.reach || (sp && sp.reach) || 'edge') === 'edge';
    let n = 0;
    for (const q of to) {
      if (q === from || (o.who && !o.who(q))) continue;
      if (!(dist(q.x, q.y, from.x, from.y) < (edge ? r + q.r : r))) continue;
      if (o.take && !o.take(q, s)) continue;
      this.put(q, id, o.as ? o.as(s, q) : d.dose ? Object.assign({}, s) : s);
      n++;
    }
    return n;
  }
  /** A body fell: everything it carries that spreads on a death, spread (`o` as for spread). */
  died(body: any, to: readonly any[], o: Parameters<Statuses['spread']>[3] = {}): void {
    for (const d of this.defs) if (d.spread && d.spread.on === 'death' && this.has(body, d.id)) this.spread(body, d.id, to, o);
  }
}

// ---------------------------------------------------------------------------
// Means: what harm is done with
// ---------------------------------------------------------------------------

/** How a means is used: a move up close, a projectile, a spell, onto another means, into food or drink, set as a trap. */
export type Use = 'strike' | 'throw' | 'shoot' | 'cast' | 'coat' | 'dose' | 'set';

/** What using a means costs: a cooldown (s, or one a step of a combo), a charge, or an amount from a pool the game names. */
export interface Cost { cooldown?: number | readonly number[]; charge?: number; pool?: string; amount?: number }

/**
 * A means, declared once for the player and the characters alike. Morgul
 * reads `id`, `kinds`, `use`, `severity` and `course` (off screen); Tycho
 * plays `move`, `blow`, `trigger` and `cost` (on screen). `uses`: how many
 * blows a coat lasts.
 */
export interface Means {
  id: string;
  kinds?: readonly string[];
  use: Use;
  severity?: number;
  course?: string;
  move?: MoveDef & Record<string, unknown>;
  blow?: Partial<Blow> & Record<string, unknown>;
  trigger?: TriggerDef;
  cost?: Cost;
  uses?: number;
  [field: string]: unknown;
}

/** A lookup of means by id. */
export class Arsenal {
  readonly list: Means[];
  private readonly byId = new Map<string, Means>();
  constructor(list: readonly Means[]) {
    this.list = list.slice();
    for (const m of this.list) this.byId.set(m.id, m);
  }
  get(id: string): Means | undefined { return this.byId.get(id); }
  has(id: string): boolean { return this.byId.has(id); }
  /** The means used one way. */
  of(use: Use): Means[] { return this.list.filter((m) => m.use === use); }
}
/** A lookup of the means given. */
export function means(list: readonly Means[]): Arsenal { return new Arsenal(list); }

/** Its cooldown: the cost's, or a combo's step's (by step, round). */
export function cooldown(m: Means | undefined, step = 0): number {
  const c = m && m.cost && m.cost.cooldown;
  if (c === undefined) return 0;
  return typeof c === 'number' ? c : c[step % c.length];
}
/** What it costs in charge (or in its pool), if anything. */
export function costOf(m: Means | undefined): number {
  const c = m && m.cost;
  return c ? (c.charge !== undefined ? c.charge : c.amount || 0) : 0;
}

/** Whoever holds a means: its cooldown counting down (`cd`), its charge. */
export interface Holder { cd?: number; charge?: number; coat?: { id: string; uses: number } | null; [field: string]: unknown }

/** Ready to use: its cooldown out. */
export function ready(h: Holder): boolean { return !(h.cd !== undefined && h.cd > 0); }

/**
 * Uses it, if it can be: ready, and its cost there to pay (charge from the
 * holder, or an amount from `pools[cost.pool]`); pays it, and starts its
 * cooldown (times `scale`). False, and nothing changed, if it can't.
 */
export function use(m: Means, h: Holder, o: { step?: number; scale?: number; pools?: Record<string, number> } = {}): boolean {
  if (!ready(h)) return false;
  const c = m.cost || {};
  if (c.charge !== undefined && (h.charge || 0) < c.charge) return false;
  if (c.pool && (!o.pools || (o.pools[c.pool] || 0) < (c.amount || 0))) return false;
  if (c.charge !== undefined) h.charge = (h.charge || 0) - c.charge;
  if (c.pool && o.pools) o.pools[c.pool] = (o.pools[c.pool] || 0) - (c.amount || 0);
  h.cd = cooldown(m, o.step) * (o.scale === undefined ? 1 : o.scale);
  return true;
}

/** Coats what a holder wields with a means (a poison on a blade): its blows carry it for `uses` (the means' own) blows. */
export function coat(h: Holder, m: Means, uses?: number): void { h.coat = { id: m.id, uses: uses === undefined ? m.uses || 1 : uses }; }
/** The coat on it, if any is left. */
export function coatOf(h: Holder): { id: string; uses: number } | null { return h.coat && h.coat.uses > 0 ? h.coat : null; }
/** A blow struck with it: one use of the coat spent; the coat's means' id, or null if none was on. */
export function spendCoat(h: Holder): string | null {
  const c = coatOf(h);
  if (!c) return null;
  c.uses--;
  if (c.uses <= 0) h.coat = null;
  return c.id;
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

/**
 * Where a move strikes, from the body: `touch` (within the two bodies'
 * radii and this much more), `r` (within r of its middle, to the other's
 * edge), `ahead` (a line that far along its aim, `w` either side, to the
 * other's edge), or `cos` with `r` (within r, inside the angle whose cosine
 * that is, or as near as `close`).
 */
export type Area = { touch: number } | { r: number; cos?: number; close?: number } | { ahead: number; w: number };

/** The distance from px, py to the segment x0, y0 to x1, y1. */
export function segDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1, k = clamp(((px - x0) * dx + (py - y0) * dy) / L, 0, 1);
  return Math.hypot(px - x0 - dx * k, py - y0 - dy * k);
}

/** Does a move's area from a body (x, y, its radius br, aim dx, dy) reach a target at tx, ty of radius tr? */
export function reaches(a: Area, x: number, y: number, br: number, dx: number, dy: number, tx: number, ty: number, tr: number): boolean {
  if ('touch' in a) return dist(x, y, tx, ty) < br + tr + a.touch;
  if ('ahead' in a) return segDist(tx, ty, x, y, x + dx * a.ahead, y + dy * a.ahead) < a.w + tr;
  const m = dist(x, y, tx, ty);
  if (a.cos === undefined) return m < a.r + tr;
  if (a.close !== undefined && m <= br + tr + a.close) return true;
  if (m > a.r + tr) return false;
  return m <= 2 || ((tx - x) * dx + (ty - y) * dy) / m >= a.cos;
}

/** A move: its phases' times (s), what the body's state field calls each, the area it strikes. */
export interface MoveDef {
  windup?: number | (() => number);
  active?: number | (() => number);
  recover?: number | (() => number);
  /** What the body's state is in each phase ('windup', 'strike', 'recover'). */
  names?: { windup?: string; active?: string; recover?: string };
  /** The body's fields: its state ('state') and the time left in it ('t'). */
  state?: string;
  time?: string;
  /** Struck this swing: a field holding true for its one target ('hitDone'), else a list on the body ('struck'). */
  once?: string;
  area?: Area;
}

type Phase = 'windup' | 'active' | 'recover';

/**
 * A move on a body: into its wind-up (the tell), on to the strike (the
 * frames it can hit, each target once a swing) and the recovery (the
 * opening), each phase's name and time in the body's own fields. The game
 * counts the time down and says when to go on.
 */
export class Move {
  readonly def: MoveDef;
  private readonly S: string;
  private readonly Tm: string;
  private readonly order: Phase[];
  constructor(def: MoveDef) {
    this.def = def; this.S = def.state || 'state'; this.Tm = def.time || 't';
    this.order = (['windup', 'active', 'recover'] as Phase[]).filter((p) => def[p] !== undefined);
  }
  name(p: Phase): string { const n = this.def.names || {}; return n[p] || (p === 'active' ? 'strike' : p); }
  /** The phase the body is in, or null. */
  phase(body: any): Phase | null { for (const p of this.order) if (body[this.S] === this.name(p)) return p; return null; }
  private enter(body: any, p: Phase): void {
    body[this.S] = this.name(p); body[this.Tm] = num(this.def[p]);
    if (p === 'active') { if (this.def.once) body[this.def.once] = false; else body.struck = []; }
  }
  /** Into its first phase. */
  start(body: any): void { this.enter(body, this.order[0]); }
  /** On to the next phase; null when the move is over (and nothing is written: what it does next is the game's). */
  next(body: any): Phase | null {
    const now = this.phase(body);
    if (!now) return null;
    const p = this.order[this.order.indexOf(now) + 1];
    if (!p) return null;
    this.enter(body, p);
    return p;
  }
  /** Struck yet this swing (a target, or its one)? */
  struck(body: any, target?: unknown): boolean { return this.def.once ? !!body[this.def.once] : !!body.struck && body.struck.includes(target); }
  /** Marks a target struck this swing. */
  mark(body: any, target?: unknown): void { if (this.def.once) body[this.def.once] = true; else (body.struck || (body.struck = [])).push(target); }
  /** In its area and not struck yet this swing: marks it struck and says true. */
  hits(body: any, target: unknown, tx: number, ty: number, tr: number, dx = 0, dy = 0): boolean {
    if (this.struck(body, target) || !this.def.area || !reaches(this.def.area, body.x, body.y, body.r || 0, dx, dy, tx, ty, tr)) return false;
    this.mark(body, target);
    return true;
  }
}

// ---------------------------------------------------------------------------
// Triggers: harm that waits in space
// ---------------------------------------------------------------------------

/**
 * A zone: `r` round its place; a box, `w` by `h` on its place or x0, y0, x1,
 * y1 in the world; a line from x0, y0 to x1, y1 with `w` either side; or
 * tiles, `tiles(x, y)` (is the point on one).
 */
export type Zone = { r: number } | { w: number; h: number } | { x0: number; y0: number; x1: number; y1: number; w?: number } | { tiles: (x: number, y: number) => boolean };

/** Is a round body (x, y, radius r) in a zone placed at cx, cy? (A box zone is felt as Tycho.collide feels a round body against a box.) */
export function inZone(z: Zone, cx: number, cy: number, x: number, y: number, r: number): boolean {
  if ('tiles' in z) return z.tiles(x, y);
  if ('r' in z) return dist(cx, cy, x, y) < z.r + r;
  let b: Box;
  if ('x0' in z) {
    if (z.w !== undefined) return segDist(x, y, z.x0, z.y0, z.x1, z.y1) < z.w + r;
    b = z;
  } else b = { x0: cx - z.w / 2, y0: cy - z.h / 2, x1: cx + z.w / 2, y1: cy + z.h / 2 };
  return new Space().boxes([b]).circleHits(x, y, r);
}

/** A beat: on the step its tick runs out (`every`, its own field by default), true, and the next one begins. */
export function beat(s: { tick?: number; every?: number }, dt: number, every?: number): boolean {
  s.tick = (s.tick || 0) - dt;
  if (s.tick > 0) return false;
  s.tick = every === undefined ? (s.every as number) : every;
  return true;
}

/** A trigger's kind: its zone, its cycle (rest, then the tell, then it bites for `bite` s at the end of each `every`) or its mark (shown for `tell` s, then it bites once), whether it's set off once, hidden, and the blow it lands. */
export interface TriggerDef {
  zone?: Zone;
  cycle?: { every: number | (() => number); tell?: number | (() => number); bite?: number | (() => number) };
  tell?: number | (() => number);
  once?: boolean;
  hidden?: boolean;
  blow?: Partial<Blow> & Record<string, unknown>;
}

/** A trigger placed: the game's own object, with what the trigger keeps on it. */
export interface Placed { x?: number; y?: number; ph?: number; t?: number; by?: unknown; armed?: boolean; sprung?: boolean; fired?: boolean; last?: number; done?: boolean; [field: string]: unknown }

export class Trigger {
  readonly def: TriggerDef;
  constructor(def: TriggerDef) { this.def = def; }
  private every(e?: number): number { return e === undefined ? num(this.def.cycle && this.def.cycle.every, 1) : e; }
  /** Seconds into its cycle at `clock`, from its offset `ph` (a share of the cycle). */
  at(clock: number, ph = 0, every?: number): number { const E = this.every(every); return ((clock / E + ph) % 1) * E; }
  /** How far into its cycle, 0..1. */
  share(clock: number, ph = 0, every?: number): number { return (clock / this.every(every) + ph) % 1; }
  /** Its phase s seconds into the cycle: resting, telling (it shows), or biting. */
  phase(s: number, every?: number): 'rest' | 'tell' | 'bite' {
    const c = this.def.cycle || { every: 1 }, E = this.every(every), b = num(c.bite), tl = num(c.tell);
    return s >= E - b ? 'bite' : s >= E - b - tl ? 'tell' : 'rest';
  }
  /** On the step its bite begins: true, once a cycle (kept as `fired`). */
  fires(p: Placed, clock: number, every?: number): boolean {
    const E = this.every(every), biting = this.at(clock, p.ph || 0, E) >= E - num(this.def.cycle && this.def.cycle.bite);
    if (biting && !p.fired) { p.fired = true; return true; }
    if (!biting) p.fired = false;
    return false;
  }
  /** On the step its cycle begins again: true (its last share kept as `last`). */
  wraps(p: Placed, clock: number, every?: number): boolean {
    const s = this.share(clock, p.ph || 0, every), w = p.last !== undefined && s < p.last;
    p.last = s;
    return w;
  }
  /** A mark's tell counted down by dt: true once it's run out (that step and after). */
  down(p: Placed, dt: number): boolean { p.t = (p.t as number) - dt; return p.t <= 0; }
  /** True once, the first time its tell has run out (kept as `done`). */
  goes(p: Placed): boolean { if (!(p.t! <= 0) || p.done) return false; p.done = true; return true; }
  /** Is a round body in its zone (at the placed one's x, y)? */
  inside(p: Placed, x: number, y: number, r: number): boolean { return !!this.def.zone && inZone(this.def.zone, p.x || 0, p.y || 0, x, y, r); }
  /** Set off, by whoever: false if it's disarmed, or sprung already and set off only once; else it's sprung. */
  spring(p: Placed, by?: unknown): boolean {
    if (p.armed === false || (this.def.once && p.sprung)) return false;
    p.sprung = true;
    if (by !== undefined) p.sprungBy = by;
    if (this.def.once) p.armed = false;
    return true;
  }
}

/**
 * Traps set in a world of boxes (a snare on a path, a tripwire across a
 * door): each placed one's box (`box(p)`) in a Tycho.collide space, so a
 * body's box is asked once against all of them.
 */
export class Traps {
  readonly list: Placed[] = [];
  private readonly space: Space;
  private readonly boxOf = new Map<Box, Placed>();
  constructor(readonly box: (p: Placed) => Box | null) {
    this.space = new Space().boxes(() => this.list, (p) => {
      if (p.armed === false) return null;
      const b = this.box(p);
      if (b) this.boxOf.set(b, p);
      return b;
    });
  }
  add(p: Placed): Placed { if (p.armed === undefined) p.armed = true; this.list.push(p); return p; }
  remove(p: Placed): void { const i = this.list.indexOf(p); if (i >= 0) this.list.splice(i, 1); }
  /** The first armed one a body's box overlaps, or null. */
  entered(x0: number, y0: number, x1: number, y1: number): Placed | null {
    this.boxOf.clear();
    const b = this.space.hits(x0, y0, x1, y1);
    return b ? this.boxOf.get(b) || null : null;
  }
}

// ---------------------------------------------------------------------------
// The feel
// ---------------------------------------------------------------------------

/**
 * The world held still as a hit lands: `freeze(t)` holds it at least t s,
 * unless the last began within `gap` s by `clock` (only a heavy hit can
 * freeze it again so soon, so a flurry doesn't stutter); `hold(dt)` each
 * step says whether it's still held. Kept on the game's object (`state`,
 * its fields `hitstop` and `frozeAt`).
 */
export class Hitstop {
  readonly state: { hitstop: number; frozeAt?: number; [k: string]: unknown };
  private readonly gap: number | (() => number);
  private readonly clock: () => number;
  constructor(o: { state: { hitstop: number; frozeAt?: number; [k: string]: unknown }; gap?: number | (() => number); clock: () => number }) {
    this.state = o.state; this.gap = o.gap === undefined ? 0 : o.gap; this.clock = o.clock;
  }
  freeze(t: number, heavy = false): void {
    const s = this.state;
    if (!heavy && this.clock() - (s.frozeAt || -1) < num(this.gap)) return;
    s.hitstop = Math.max(s.hitstop, t);
    s.frozeAt = this.clock();
  }
  hold(dt: number): boolean {
    const s = this.state;
    if (s.hitstop > 0) { s.hitstop -= dt; return true; }
    return false;
  }
}

/** Knockback fading: a body's knock velocity (`vx`, `vy`) moves it while it's over `min` (1), and fades by e^(-decay × dt). */
export class Knock {
  readonly decay: number | (() => number);
  readonly vx: string;
  readonly vy: string;
  readonly min: number;
  constructor(o: { decay: number | (() => number); vx?: string; vy?: string; min?: number }) { this.decay = o.decay; this.vx = o.vx || 'kvx'; this.vy = o.vy || 'kvy'; this.min = o.min === undefined ? 1 : o.min; }
  /** The fade a step of dt. */
  fade(dt: number): number { return Math.exp(-num(this.decay) * dt); }
  /** Moves the body by its knock (`move(body, dx, dy)`) and fades it, if it's knocked; true if it was. `fade` from fade(dt), if worked out already. */
  step(body: any, dt: number, move: (body: any, dx: number, dy: number) => void, fade = this.fade(dt)): boolean {
    if (!(Math.abs(body[this.vx]) + Math.abs(body[this.vy]) > this.min)) return false;
    move(body, body[this.vx] * dt, body[this.vy] * dt);
    body[this.vx] *= fade; body[this.vy] *= fade;
    return true;
  }
  stop(body: any): void { body[this.vx] = body[this.vy] = 0; }
}

/** A flash: the body's `field` ('flash') set to t s, and if `col` is given, its color (`colField`: 'flashCol') to it, as it is. */
export function flash(body: any, t: number, o: { col?: string | null; field?: string; colField?: string } = {}): void {
  body[o.field || 'flash'] = t;
  if ('col' in o) body[o.colField || 'flashCol'] = o.col;
}
/** A flash (or any timer kept to 0 and up) fading by dt. */
export function fade(body: any, dt: number, field = 'flash'): void { body[field] = Math.max(0, body[field] - dt); }

/** Numbers and words rising over what they're about: each moves up `speed` px/s and runs out (Tycho.fx's tick: `t` its time left), in place. */
export function rise<N extends { t: number; y: number }>(list: N[], dt: number, speed: number): N[] {
  for (const n of list) n.y -= speed * dt;
  return tick(list, dt);
}

/** A shake for games that want one: `kick(n)` to at least n, `step(dt)` dying away by e^(-decay × dt). On the game's object (`state.shake`). */
export class Shake {
  constructor(readonly state: { shake?: number; [k: string]: unknown }, readonly decay = 14) {}
  kick(n: number): void { this.state.shake = Math.max(this.state.shake || 0, n); }
  step(dt: number): void { this.state.shake = (this.state.shake || 0) * Math.exp(-this.decay * dt); }
}

// ---------------------------------------------------------------------------
// The player's wounds
// ---------------------------------------------------------------------------

/** A phase of a wound: how long (minutes, or [min, max] drawn from the game's rng), and what it marks while it lasts (`has`: 'shaky', 'limping'). */
export interface WoundPhase { id: string; minutes: number | readonly [number, number]; has?: readonly string[] }
/** A wound: its phases in order (shaped like Athelas's), and what happens given it again: `ignore`, `extend` (the phase runs as long again) or `restart`. */
export interface WoundDef { id: string; phases: readonly WoundPhase[]; has?: readonly string[]; again?: 'ignore' | 'extend' | 'restart' }
/** The wounds' state, plain JSON for the game's save: the clock (minutes), and each open wound's phase and its end. */
export interface WoundsState { now: number; on: Record<string, { p: number; since: number; until: number }> }
export interface WoundEvent { id: string; phase: string | null; healed: boolean; at: number }

/**
 * The player's wounds: conditions on the game's clock in game minutes, in
 * phases. `give` opens one, `step` moves the clock on by minutes (each phase
 * that ends in that time goes on to the next, the last heals), `has` asks
 * for a wound, a phase or a mark. All draws from the rng the game passes.
 */
export class Wounds {
  readonly defs: Map<string, WoundDef>;
  constructor(defs: readonly WoundDef[]) { this.defs = new Map(defs.map((d) => [d.id, d])); }
  fresh(now = 0): WoundsState { return { now, on: {} }; }
  private def(id: string): WoundDef { const d = this.defs.get(id); if (!d) throw new Error(`Tycho.harm: no wound ${id}`); return d; }
  private minutes(ph: WoundPhase, rng?: Stream | null): number {
    const m = ph.minutes;
    if (typeof m === 'number') return m;
    if (!rng) throw new Error('Tycho.harm: a wound with a range of minutes needs an rng');
    return rng.f(m[0], m[1]);
  }
  /** Opens a wound now; false if it's open already and given again is `ignore`. */
  give(s: WoundsState, id: string, rng?: Stream | null): boolean {
    const d = this.def(id), w = s.on[id];
    if (w) {
      const again = d.again || 'ignore';
      if (again === 'ignore') return false;
      if (again === 'extend') { w.until += w.until - w.since; return true; }
    }
    s.on[id] = { p: 0, since: s.now, until: s.now + this.minutes(d.phases[0], rng) };
    return true;
  }
  /** Moves the clock on by minutes: phases end in the order they're due, the last of a wound heals it. Returns what changed. */
  step(s: WoundsState, minutes: number, rng?: Stream | null): WoundEvent[] {
    const out: WoundEvent[] = [], to = s.now + minutes;
    for (;;) {
      let next: string | null = null;
      for (const id of Object.keys(s.on).sort()) if (s.on[id].until <= to && (next === null || s.on[id].until < s.on[next].until)) next = id;
      if (next === null) break;
      const d = this.def(next), w = s.on[next], at = w.until;
      if (w.p + 1 >= d.phases.length) { delete s.on[next]; out.push({ id: next, phase: null, healed: true, at }); continue; }
      w.p++; w.since = at; w.until = at + this.minutes(d.phases[w.p], rng);
      out.push({ id: next, phase: d.phases[w.p].id, healed: false, at });
    }
    s.now = to;
    return out;
  }
  /** Has a wound open (by its id), is in a phase (by its id), or carries a mark (a phase's or the wound's `has`)? */
  has(s: WoundsState, what: string): boolean {
    for (const id in s.on) {
      if (id === what) return true;
      const d = this.def(id), ph = d.phases[s.on[id].p];
      if (ph.id === what || (ph.has && ph.has.includes(what)) || (d.has && d.has.includes(what))) return true;
    }
    return false;
  }
  /** The wounds open: each one's phase and minutes left. */
  of(s: WoundsState): { id: string; phase: string; left: number }[] {
    return Object.keys(s.on).sort().map((id) => ({ id, phase: this.def(id).phases[s.on[id].p].id, left: s.on[id].until - s.now }));
  }
  /** Heals one wound, or all. */
  heal(s: WoundsState, id?: string): void { if (id === undefined) s.on = {}; else delete s.on[id]; }
}
