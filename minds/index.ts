// The bridge between Tycho and Tyrell (dist/tycho-minds.js): the glue every
// game with people on Tyrell writes. It moved here from the White Dragon's
// city.js, and Merryfolk's shell uses it too: the game's clock driving the
// minds' (forward, and back through Esper's time walk), the minds kept in the
// save and read back, seats handed out so nobody sits in anybody, knowing
// who might be in a place without working out where everyone is, who saw
// something done, and the reports the minds file about the player.
//
// It uses neither library's code, only the shapes it reads (written out
// below, so the bridge builds on its own), so it loads after both and a game
// without people (Lodestar) never loads it. Nothing here touches the minds'
// state except through Tyrell's own calls (advanceTo, load), so time walk
// and determinism stay Tyrell's.
declare const __VERSION__: string;

/** The bridge's version (Tycho's). */
export const VERSION: string = __VERSION__;

// ---- the shapes it reads ----------------------------------------------------

/** What someone is doing, as Tyrell keeps it (its Doing). */
export interface DoingLike {
  kind: 'act' | 'travel' | 'wait';
  action: string;
  place: string | null;
  start: number;
  end: number;
  from?: string | null;
  to?: string | null;
}
/** A person, as Tyrell keeps them (its PersonState). */
export interface PersonLike {
  id: string;
  status: 'active' | 'away' | 'gone';
  place: string | null;
  doing: DoingLike | null;
  last?: string;
}
/** The world: the few calls the bridge makes on a Tyrell World. */
export interface WorldLike {
  readonly now: number;
  s: { v: number; [k: string]: unknown };
  esper: { earliest(): number };
  advanceTo(t: number): void;
  load(data: unknown): void;
  get(id: string): PersonLike | undefined | null;
  on(kind: string, fn: (data: any) => void): unknown;
}
type Get<T> = () => T;

// ---- time -------------------------------------------------------------------

/** Game minutes from a day number and an hour of the day (Tyrell's time is minutes). */
export function minutes(day: number, hour: number): number { return (day * 24 + hour) * 60; }

/** The hour of the day (0 to 24) at a time in minutes, before midnight too. */
export function hourOf(t: number): number { return (((t / 60) % 24) + 24) % 24; }

/** How far along something running from start to end is at now, 0 to 1. */
export function progress(d: { start: number; end: number }, now: number): number {
  const f = (now - d.start) / Math.max(1e-6, d.end - d.start);
  return f < 0 ? 0 : f > 1 ? 1 : f;
}

export interface ClockOptions {
  /** The world now (a getter, since the game may make a new one). */
  world: Get<WorldLike | null | undefined>;
  /** The game's clock, in minutes. */
  minutes: Get<number>;
  /**
   * Called for a time further back than Esper remembers, to make the world
   * over from that moment. Without it the world is only ever run forward.
   */
  remake?: (t: number) => void;
  /**
   * Whether a game time behind the world's walks the world back (true, the
   * default: Esper's time walk). False for a game with time walk off: a time
   * behind the world's is left, and the world waits for the game to catch up.
   */
  back?: boolean;
  /** How close counts as the same moment (minutes; 1e-6). */
  eps?: number;
}
/** What a clock's sync did. */
export type Synced = 'off' | 'same' | 'ran' | 'remade';

/**
 * The game's clock driving the minds': each sync runs the world to the
 * game's time, forward, or back through Esper's time walk (Tyrell's
 * advanceTo seeks back), and further back than Esper remembers, remakes it.
 */
export function clock(o: ClockOptions): { sync(): Synced } {
  const eps = o.eps ?? 1e-6;
  return {
    sync(): Synced {
      const w = o.world();
      if (!w) return 'off';
      const t = o.minutes();
      if (o.back === false && t < w.now) return 'same';
      if (o.remake && t < w.esper.earliest() - eps) { o.remake(t); return 'remade'; }
      if (Math.abs(t - w.now) > eps) { w.advanceTo(t); return 'ran'; }
      return 'same';
    },
  };
}

// ---- saving -----------------------------------------------------------------

/** What goes in the game's save: Tyrell's save shape, with anything of the game's beside it. */
export interface Stash { tyrell: 'world'; v: number; s: unknown; [k: string]: unknown }

/**
 * The minds as they are, for the game's save: the state itself (not a copy:
 * the save writes it out), with the game's own fields (a population size, a
 * version of its own) beside it, which restore can check.
 */
export function stash(world: WorldLike, extra?: Record<string, unknown>): Stash {
  return Object.assign({ tyrell: 'world' as const, v: world.s.v }, extra, { s: world.s });
}

export interface RestoreOptions {
  /** Whether a saved world is one this game can use (the same people, say). */
  accept?: (saved: Stash) => boolean;
  /** Where to run a world that wasn't restored to (a new world runs to now). */
  now?: number;
  /** Told when a saved world couldn't be read (it's started over all the same). */
  onError?: (e: unknown) => void;
}
/**
 * Reads the minds back from the save into a world just made: true if they
 * were. A saved world this game won't take (accept), or one Tyrell can't
 * read, leaves the new world, run to now if given.
 */
export function restore(world: WorldLike, saved: unknown, o: RestoreOptions = {}): boolean {
  const sv = saved as Stash | null | undefined;
  let loaded = false;
  if (sv && typeof sv === 'object' && sv.s && (!o.accept || o.accept(sv))) {
    try { world.load(sv); loaded = true; } catch (e) { if (o.onError) o.onError(e); /* an unreadable world: start it over */ }
  }
  if (!loaded && o.now !== undefined) world.advanceTo(o.now);
  return loaded;
}

// ---- seats ------------------------------------------------------------------

/**
 * Seats at places, handed out so nobody sits in anybody: someone doing an
 * action at a place with several seats for it keeps one while they're doing
 * that there. A seat is asked for with the one they'd pick (a hash of who
 * they are, say) and they get the first free one from it. A seat comes free
 * when its sitter is somewhere else, traveling, or doing something else.
 */
export class Seats {
  private m = new Map<string, Map<string, { i: number; start: number }>>();
  constructor(private world: Get<WorldLike | null | undefined>) {}
  /** The seat (0 to n-1) for id doing act at place since start, given n seats and the one they'd pick first. */
  take(id: string, place: string, act: string, start: number, n: number, first: number): number {
    const k = place + '|' + act;
    let m = this.m.get(k);
    if (!m) this.m.set(k, (m = new Map()));
    const mine = m.get(id);
    if (mine && mine.start === start) return mine.i;
    const w = this.world();
    for (const [q] of m) {
      const p = w && w.get(q);
      if (!p || p.place !== place || !p.doing || p.doing.kind === 'travel' || p.doing.action !== act) m.delete(q);
    }
    const used = new Set<number>();
    for (const v of m.values()) used.add(v.i);
    let i = first;
    for (let t = 0; t < n; t++) { const j = (first + t) % n; if (!used.has(j)) { i = j; break; } }
    m.set(id, { i, start });
    return i;
  }
  /** Everyone stands up (a new world). */
  clear(): void { this.m.clear(); }
}

// ---- who might be where -----------------------------------------------------

/**
 * Whether someone might be in a region (a level, a room, a part of the map)
 * without working out where they are: the regions a doing can touch are
 * worked out once per doing (a walk, every region its route passes; staying
 * put, the place's), by the game's regions(), and kept until they're doing
 * something else.
 */
export class Presence {
  private c = new Map<string, { key: string; set: Set<string> }>();
  constructor(private world: Get<WorldLike | null | undefined>, private regions: (p: PersonLike) => Iterable<string>) {}
  /** Whether id might be in region now (false for anyone not about). */
  may(id: string, region: string): boolean {
    const w = this.world(), p = w && w.get(id);
    if (!p || p.status !== 'active') return false;
    const d = p.doing, key = d ? d.kind + d.start + '|' + d.to + '|' + d.place : 'idle|' + p.place;
    let c = this.c.get(id);
    if (!c || c.key !== key) { c = { key, set: new Set(this.regions(p)) }; this.c.set(id, c); }
    return c.set.has(region);
  }
  /** Forgets every doing (a new world). */
  clear(): void { this.c.clear(); }
}

// ---- travel -----------------------------------------------------------------

/**
 * A travel time between two places (Tyrell's shell.travel), worked out once
 * a pair by the game's own route and kept: 0 from a place to itself.
 */
export function travelTimes(f: (a: string, b: string) => number): ((a: string, b: string) => number) & { clear(): void } {
  const pts = new Map<string, Map<string, number>>();
  const t = (a: string, b: string): number => {
    if (a === b) return 0;
    let row = pts.get(a);
    if (!row) pts.set(a, (row = new Map()));
    let m = row.get(b);
    if (m === undefined) { m = f(a, b); row.set(b, m); }
    return m;
  };
  return Object.assign(t, { clear: () => pts.clear() });
}

// ---- seeing -----------------------------------------------------------------

export interface WitnessOptions<T> {
  /** Indoors, everyone in the room sees (true), whatever the distance. */
  room?: boolean;
  /** Out in the open, how far off sight reaches: [across, up and down]. */
  reach?: [number, number];
  /** Who can see at all (not someone hidden, say). */
  can?: (n: T) => boolean;
  /** Who's nearest, for the order: the distance across by default. */
  far?: (n: T, at: { x: number; y: number }) => number;
}
/**
 * Who sees something done at a spot, nearest first: in a room, everyone in
 * it; in the open, whoever's within reach (a box, across and up and down).
 * The game then tells Tyrell what they saw (world.sense).
 */
export function witnesses<T extends { x: number; y: number }>(at: { x: number; y: number }, people: T[], o: WitnessOptions<T> = {}): T[] {
  const [rx, ry] = o.reach ?? [180, 40], far = o.far ?? ((n: T, p: { x: number; y: number }) => Math.abs(n.x - p.x));
  const near = (n: T) => o.room || (Math.abs(n.x - at.x) < rx && Math.abs(n.y - at.y) < ry);
  return people.filter((n) => (!o.can || o.can(n)) && near(n)).sort((a, b) => far(a, at) - far(b, at));
}

// ---- reports ----------------------------------------------------------------

/**
 * Collects what the world emits of one kind (Wormtongue's 'report') that the
 * game must act on later, in the game's own time: take() hands them over
 * and empties the list. Only those keep() passes are kept (the ones about
 * the player, say).
 */
export function collect<T = any>(world: WorldLike, kind: string, keep?: (data: T) => boolean): { list: T[]; take(): T[] } {
  const c = { list: [] as T[], take(): T[] { const l = c.list; c.list = []; return l; } };
  world.on(kind, (d: T) => { if (!keep || keep(d)) c.list.push(d); });
  return c;
}

// Loaded as a plain script after dist/tycho.js, the bridge hangs itself on
// the engine as Tycho.minds too.
const g = globalThis as unknown as { Tycho?: Record<string, unknown> };
if (g.Tycho && typeof g.Tycho === 'object' && !Object.isFrozen(g.Tycho)) {
  try {
    g.Tycho.minds = { VERSION, minutes, hourOf, progress, clock, stash, restore, Seats, Presence, travelTimes, witnesses, collect };
  } catch (e) { /* a frozen module namespace */ }
}
