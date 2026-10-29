// The bridge between Tycho and Tyrell (dist/tycho-minds.js): the glue every
// game with people on Tyrell writes. It moved here from the White Dragon's
// city.js, and Merryfolk's shell uses it too: the game's clock driving the
// minds' (forward, and back through Esper's time walk), the minds kept in the
// save and read back, seats handed out so nobody sits in anybody, knowing
// who might be in a place without working out where everyone is, who saw
// something done, and the reports the minds file about the player. And harm,
// where its two halves meet: Tycho.harm plays the moment on screen, Morgul
// (Tyrell's) what follows, and the bridge hands over between them (the means
// declared to both, a hit turned into a harm, a fight between characters
// shown in step with its turns, a fight with the player, traps near and far).
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
  /** A fact of the world's (read, or set: an input). */
  fact?(key: string, value?: unknown): unknown;
  /** How many of an item someone has (their own, and their household's). */
  have?(p: PersonLike, item: string): number;
  /** Harm, when it's on (the Morgul module). */
  morgul?: MorgulLike;
  /** What passes between people, when it's on (the Bree module). */
  bree?: BreeLike;
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

// ---- harm -------------------------------------------------------------------
//
// Harm has two halves: Tycho.harm plays the moment on screen (the hit through
// a pipeline of stages, the moves, the triggers), and Morgul, Tyrell's, what
// follows, on screen and off (the wound, the fear, the grudge, the blame).
// The bridge takes nothing of either at run time: the game passes in what it
// needs of Tycho.harm (its means maker), and reaches Morgul and Bree through
// the world. Everything it tells Morgul is one of Morgul's inputs, so time
// walk records it.

/** A means as both halves read it: Tycho.harm's Means, Morgul's MeansDef. */
export interface MeansLike {
  id: string;
  kinds?: readonly string[];
  use?: string;
  severity?: number;
  course?: string;
  /** For a means set as a trap: how many it catches (Morgul's uses); Tycho.harm's for a coat. */
  uses?: number;
  /** A trap's chance to catch someone off screen (Morgul's catch). */
  catch?: number;
  trigger?: { hidden?: boolean; once?: boolean; [k: string]: unknown };
  [field: string]: unknown;
}
/** A harm, as Morgul takes it (its Harm). */
export interface HarmLike {
  to: string; by?: string | null; kind?: string; severity?: number; via?: string; intent?: string;
  cause?: string; what?: string; place?: string | null; seenBy?: string[]; course?: string;
}
/** A harm as Morgul tells it (its HarmView): with the wound it left and how hurt the one struck is. */
export interface HarmViewLike { id: number; t: number; to: string; by: string | null; kind: string; severity: number; via: string; hurt: number; wound?: string; course?: string; shown: boolean; [k: string]: unknown }
/** A trap set, as Morgul lists it. */
export interface TrapLike { id: string; kind: string; place: string; by: string | null; for?: string; uses: number; t: number; known: string[] }
/** A character's answer to a fight with the player (Morgul's Response, event 'morgul:respond'). */
export interface ResponseLike { id: string; to: string; act: 'fight' | 'flee' | 'yield' | 'help'; odds: number; hurt: number; start: boolean; help?: string[]; weights: Record<string, number> }
/** A blow in a fight by numbers (Morgul's Blow, a Bree turn's harm). */
export interface BlowLike { id: number; by: string; to: string; kind: string; severity: number; what?: string; hurt: number; end?: 'down' | 'yielded' | 'left' }
/** Morgul, as the bridge reaches it (world.morgul). */
export interface MorgulLike {
  readonly config: { fightGap?: number; playerMight?: string };
  readonly meansDefs?: { values(): Iterable<MeansLike> };
  readonly trapDefs?: { has(id: string): boolean; readonly size: number };
  means(def: MeansLike): unknown;
  trap(def: { id: string; [k: string]: unknown }): unknown;
  harm(h: HarmLike): HarmViewLike | null;
  hurt(id: string): number;
  set(kind: string, o: { by?: string | null; place: string; for?: string; seenBy?: string[]; about?: string[] }): string | null;
  spring(trap: string, id: string, seenBy?: string[], about?: string[]): void;
  disarm(trap: string, by?: string): void;
  near(regions?: string[]): void;
  nearPlace(place: string): boolean;
  traps(place?: string): TrapLike[];
  fights(kind: string): boolean;
  respond(id: string, against?: string): ResponseLike | null;
}
/** An exchange between people, as Bree shows it (its ExchangeView). */
export interface ExchangeLike { id: number; kind: string; who: string[]; place: string | null; t: number; by?: string }
/** Bree, as the bridge reaches it (world.bree). */
export interface BreeLike {
  exchanges(): ExchangeLike[];
  exchange(which: number | string): ExchangeLike | null;
}

const round4 = (x: number): number => Math.round(x * 1e4) / 1e4;
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string' ? (v as { id: string }).id : undefined);
/** A listener on the world, and a way to take it off again (Tyrell's on returns one). */
function listen(world: WorldLike, kind: string, fn: (data: any) => void): () => void {
  const off = world.on(kind, fn);
  return typeof off === 'function' ? (off as () => void) : () => {};
}

/**
 * The means, declared to both halves at once, so a game writes its weapons,
 * spells, poisons and traps once: each to the world's Morgul (which reads
 * id, kinds, use, severity and course, and keeps the rest), a means set as a
 * trap as Morgul's trap too (hidden as its trigger says, else Morgul's
 * default, hidden; catching `uses`, 1 by default; `catch` its chance off
 * screen), unless the game declared that trap itself; then the list made
 * into Tycho.harm's lookup by the maker the game passes (Tycho.harm.means),
 * or a copy of it. Declare them again on a new world, as every definition.
 */
export function means<A = MeansLike[]>(world: WorldLike | null | undefined, list: readonly MeansLike[], arsenal?: (list: readonly MeansLike[]) => A): A {
  const mg = world && world.morgul;
  if (mg) {
    for (const m of list) {
      mg.means(m);
      if (m.use !== 'set' || (mg.trapDefs && mg.trapDefs.has(m.id))) continue;
      const def: { id: string; [k: string]: unknown } = { id: m.id };
      if (m.trigger && typeof m.trigger.hidden === 'boolean') def.hidden = m.trigger.hidden;
      if (m.kinds && m.kinds.length) def.kind = m.kinds[0];
      if (typeof m.severity === 'number') def.severity = m.severity;
      if (typeof m.uses === 'number') def.uses = m.uses;
      if (typeof m.catch === 'number') def.catch = m.catch;
      mg.trap(def);
    }
  }
  return arsenal ? arsenal(list) : (list.slice() as unknown as A);
}

/** A hit Tycho.harm landed (its Hit): on whom, the blow, and the amount that got through. */
export interface HitLike<B = any> {
  to: B;
  blow: { amount: number; kinds?: readonly string[] | null; by?: unknown; [field: string]: unknown };
  amount: number;
  kinds?: readonly string[] | null;
}
export interface HarmOptions<B = any> {
  /** The Tyrell id of a body: 'player' for the player, null for a body with no mind (a creature). Default: its `id`, or the body itself if it's a string. */
  id?: (body: B) => string | null | undefined;
  /** The whole of what the game measures on the one struck (a health bar's top): the severity is the hit's share of it. */
  whole?: number | ((body: B) => number);
  /** Or the severity itself, 0..1, from the hit. */
  severity?: (hit: HitLike<B>) => number;
  /** Who did it, over the blow's `by`. */
  by?: string | null;
  /** How it came: default the blow's `via`, or 'blow'. */
  via?: string;
  intent?: 'meant' | 'defense' | 'careless' | 'accident';
  /** What it was done with: default the blow's `what`, or its `means` (an id, or a means). */
  what?: string;
  cause?: string;
  course?: string;
  /** Where, a Tyrell place (default: where the one struck is). */
  place?: string | null;
  /** Who saw it land, by id; or the people about (bodies) and the game's sight, for witnesses(). */
  seenBy?: string[];
  people?: readonly B[];
  sight?: WitnessOptions<any>;
  /** Where it was seen from (default: the one struck). */
  at?: { x: number; y: number };
}

/** A body's Tyrell id, by default. */
function idOfBody(b: unknown): string | null { return str(b) ?? null; }

/**
 * A hit Tycho.harm landed on screen, as Morgul's harm (an input, recorded):
 * to and by from the bodies (`id`), its kind from the hit's, its severity
 * the hit's share of what the game measures (`whole`), or `severity`, or the
 * blow's own severity by the share of its amount that got through, how it
 * came, why, with what, where, and who saw it (`seenBy`, or witnesses() of
 * the `people` about by the game's `sight`). Returns the harm as Morgul
 * tells it, or null: no Morgul, nobody with a mind struck, or nothing that
 * got through. Call it for a hit that landed.
 */
export function harm<B = any>(world: WorldLike | null | undefined, hit: HitLike<B>, o: HarmOptions<B> = {}): HarmViewLike | null {
  const mg = world && world.morgul;
  if (!mg) return null;
  const id = o.id ?? idOfBody;
  const to = id(hit.to);
  if (!to) return null;
  const blow = hit.blow;
  let sev: number;
  if (o.severity) sev = o.severity(hit);
  else if (o.whole !== undefined) {
    const whole = typeof o.whole === 'function' ? o.whole(hit.to) : o.whole;
    sev = whole > 0 ? hit.amount / whole : 0;
  } else if (typeof blow.severity === 'number') sev = blow.amount > 0 ? blow.severity * hit.amount / blow.amount : blow.severity;
  else sev = hit.amount;
  sev = round4(clamp01(Number(sev) || 0));
  if (sev <= 0) return null;
  const by = o.by !== undefined ? o.by : blow.by === undefined || blow.by === null ? null : id(blow.by as B) ?? null;
  const h: HarmLike = { to, by, severity: sev, via: o.via ?? str(blow.via) ?? 'blow' };
  const kind = (hit.kinds && hit.kinds[0]) || (blow.kinds && blow.kinds[0]);
  if (kind) h.kind = kind;
  const intent = o.intent ?? str(blow.intent);
  if (intent) h.intent = intent;
  const what = o.what ?? str(blow.what) ?? str(blow.means);
  if (what) h.what = what;
  const cause = o.cause ?? str(blow.cause);
  if (cause) h.cause = cause;
  const course = o.course ?? str(blow.course);
  if (course) h.course = course;
  if (o.place !== undefined) h.place = o.place;
  if (o.seenBy) h.seenBy = o.seenBy.slice();
  else if (o.people) {
    const at = o.at ?? (hit.to as unknown as { x: number; y: number });
    const seen = witnesses(at, o.people as unknown as Array<{ x: number; y: number }>, o.sight);
    h.seenBy = seen.map((n) => id(n as unknown as B)).filter((x): x is string => !!x && x !== to && x !== by);
  }
  return mg.harm(h);
}

/**
 * The player's might in a fight, as the game reckons it (their gear, their
 * strength), as the world's fact Morgul reads (its playerMight, 'might:player'
 * by default): set (an input) only when it changes.
 */
export function might(world: WorldLike | null | undefined, value: number, key?: string): void {
  if (!world || !world.fact) return;
  const k = key ?? (world.morgul && world.morgul.config.playerMight) ?? 'might:player';
  const v = round4(Number(value) || 0);
  if (world.fact(k) !== v) world.fact(k, v);
}

/** The strongest means someone holds that arms them (strikes, throws, shoots or casts), as Morgul picks it; null for their fists. */
function armOf(world: WorldLike, id: string): MeansLike | null {
  const mg = world.morgul, p = world.get(id);
  if (!mg || !mg.meansDefs || !p || !world.have) return null;
  let best: MeansLike | null = null;
  for (const m of mg.meansDefs.values()) {
    if (!(m.use === 'strike' || m.use === 'throw' || m.use === 'shoot' || m.use === 'cast') || world.have(p, m.id) <= 0) continue;
    const a = m.severity ?? 0, b = best ? best.severity ?? 0 : -1;
    if (!best || a > b || (a === b && m.id < best.id)) best = m;
  }
  return best;
}

// ---- the scuffle ------------------------------------------------------------

/** A moment of a fight between characters, for the game to show. */
export interface Beat {
  /** The fight (its Bree exchange), and when (world minutes). */
  fight: number; t: number;
  /** 'start': they square up; 'blow': a turn of it; 'end': it's over. */
  type: 'start' | 'blow' | 'end';
  /** Bree's kind, the two in it, where, and who started it. */
  kind: string; who: string[]; place: string | null; started?: string;
  /** A blow: whose turn it was (they swing), at whom, and whether theirs landed (if not, the other's did: a counter). */
  swing?: string; at?: string; lands?: boolean;
  /** A blow: who struck whom, of what kind, how hard (0..1, heavy past heavyAt), with what, how hurt the one struck is now, and its harm's id. */
  hit?: { by: string; to: string; kind: string; severity: number; heavy: boolean; what?: string; hurt: number; harm: number };
  /** How it ends: with a blow, 'down', 'yielded' or 'left'; at the end, Bree's why ('down', 'yielded', 'left', 'stepped in', 'done', 'parted'...). */
  end?: string;
  /** Who walked off, who stepped in, and how it went (at the end). */
  left?: string; mediator?: string; outcome?: string;
}
/** A fight going on, as the scuffle keeps it. */
export interface Fight { id: number; kind: string; who: string[]; place: string | null; started?: string; t: number; blows: number; hurt: Record<string, number>; last: Beat | null }

export interface ScuffleOptions {
  /** How severe a blow is heavy (a stagger, a knock), 0..1. Default 0.25. */
  heavyAt?: number;
  /** Which fights the game shows (the ones in its loaded region, say): only their beats are kept. Default all. */
  keep?: (fight: Fight) => boolean;
}

/**
 * A fight between characters, shown in step with its turns: the fights by
 * numbers (Bree's kinds that Morgul fights) as they start, each turn's blow
 * (from `bree:turn`'s harm) and how they end, as beats for the game to play
 * in order (take), and the fights going on, as the world has them now
 * (fights, of), so a rewind or a load leaves nothing stale.
 */
export function scuffles(world: WorldLike, o: ScuffleOptions = {}) {
  const heavyAt = o.heavyAt ?? 0.25;
  const known = new Map<number, Fight>();
  let beats: Beat[] = [];
  const fightsKind = (kind: string): boolean => !!(world.morgul && world.morgul.fights(kind));
  const open = (v: ExchangeLike): Fight => {
    const mg = world.morgul;
    const f: Fight = { id: v.id, kind: v.kind, who: v.who.slice(), place: v.place, t: v.t, blows: 0, hurt: {}, last: null };
    if (v.by) f.started = v.by;
    for (const x of f.who) f.hurt[x] = mg ? round4(mg.hurt(x)) : 0;
    known.set(v.id, f);
    return f;
  };
  const push = (f: Fight, b: Beat): void => { f.last = b; if (!o.keep || o.keep(f)) beats.push(b); };
  const base = (f: Fight, type: Beat['type']): Beat => {
    const b: Beat = { fight: f.id, t: world.now, type, kind: f.kind, who: f.who.slice(), place: f.place };
    if (f.started) b.started = f.started;
    return b;
  };
  const start = (v: ExchangeLike | null): void => { if (v && fightsKind(v.kind) && !known.has(v.id)) { const f = open(v); push(f, base(f, 'start')); } };
  const offs = [
    listen(world, 'bree:start', (v: ExchangeLike) => start(v)),
    listen(world, 'bree:escalated', (e: { id: number; to: string }) => { if (fightsKind(e.to) && world.bree) start(world.bree.exchange(e.id)); }),
    listen(world, 'bree:turn', (t: { id: number; who: string; to: string; harm?: BlowLike }) => {
      if (!t.harm) return;
      const f = known.get(t.id) ?? (world.bree && world.bree.exchange(t.id) ? open(world.bree.exchange(t.id) as ExchangeLike) : null);
      if (!f) return;
      const h = t.harm, b = base(f, 'blow');
      b.swing = t.who; b.at = t.to; b.lands = h.by === t.who;
      b.hit = { by: h.by, to: h.to, kind: h.kind, severity: h.severity, heavy: h.severity >= heavyAt, hurt: h.hurt, harm: h.id };
      if (h.what) b.hit.what = h.what;
      if (h.end) b.end = h.end;
      f.blows++;
      f.hurt[h.to] = h.hurt;
      push(f, b);
    }),
    listen(world, 'bree:end', (e: { id: number; why: string; left?: string; mediator?: string; outcome?: string }) => {
      const f = known.get(e.id);
      if (!f) return;
      known.delete(e.id);
      const b = base(f, 'end');
      b.end = e.why;
      if (e.left) b.left = e.left;
      if (e.mediator) b.mediator = e.mediator;
      if (e.outcome) b.outcome = e.outcome;
      push(f, b);
    }),
  ];
  return {
    /** The beats since the last take, in order (those at or after `since`, world minutes, if given). */
    take(since?: number): Beat[] { const l = beats; beats = []; return since === undefined ? l : l.filter((b) => b.t >= since); },
    /** The fights going on now, as the world has them (those the game keeps). */
    fights(): Fight[] {
      const bree = world.bree;
      if (!bree || !world.morgul) { known.clear(); return []; }
      const live = bree.exchanges().filter((v) => fightsKind(v.kind));
      const ids = new Set(live.map((v) => v.id));
      for (const k of [...known.keys()]) if (!ids.has(k)) known.delete(k);
      return live.map((v) => known.get(v.id) ?? open(v)).filter((f) => !o.keep || o.keep(f));
    },
    /** The fight someone's in now, or null. */
    of(id: string): Fight | null { return this.fights().find((f) => f.who.includes(id)) ?? null; },
    /** Forgets every fight and beat (a new world, or a jump the game won't show). */
    clear(): void { known.clear(); beats = []; },
    /** Stops listening. */
    stop(): void { for (const f of offs) f(); },
  };
}

// ---- fights with the player -------------------------------------------------

/** What a character's frame-level fighter should do in a fight with the player, from their answer. */
export interface Plan {
  id: string; against: string;
  /** Fight back, flee, yield, or call for help. */
  act: 'fight' | 'flee' | 'yield' | 'help';
  /** When they chose it (world minutes), and whether the fight starts with it. */
  t: number; start: boolean;
  /** Their odds against the player, and how hurt they are. */
  odds: number; hurt: number;
  /** Who they call on (act 'help'). */
  help?: string[];
  /** What they'd fight with: the strongest means they hold that arms them, or null for their fists. */
  means: MeansLike | null;
  /** How appealing each answer was. */
  weights: Record<string, number>;
}
export interface FighterOptions {
  /** The player's might, as the game reckons it, set on each sync() and ask(). */
  might?: () => number;
  /** How long an answer holds without another harm between them (minutes). Default Morgul's fightGap (30). */
  gap?: number;
}

/**
 * Fights with the player, played in frames: each answer a character gives
 * (Morgul's 'morgul:respond', after each harm between them and the player,
 * the first as the fight starts) made into what the game's fighter should
 * do (take, plan), with what they'd fight with; ask() looks before anything
 * happens (will they fight if the player squares up?). The player's might is
 * the game's (might), set as the world's fact before Morgul reads it.
 */
export function fighters(world: WorldLike, o: FighterOptions = {}) {
  const last = new Map<string, Plan>();
  let fresh: Plan[] = [];
  const gap = (): number => o.gap ?? (world.morgul && world.morgul.config.fightGap) ?? 30;
  const plan = (r: ResponseLike): Plan => {
    const p: Plan = { id: r.id, against: r.to, act: r.act, t: world.now, start: r.start, odds: r.odds, hurt: r.hurt, means: armOf(world, r.id), weights: { ...r.weights } };
    if (r.help) p.help = r.help.slice();
    return p;
  };
  const sync = (): void => { if (o.might) might(world, o.might()); };
  const off = listen(world, 'morgul:respond', (r: ResponseLike) => { const p = plan(r); last.set(r.id, p); fresh.push(p); });
  return {
    /** Sets the player's might (call it before reporting the player's hits, or each frame: it's an input only when it changes). */
    sync,
    /** The answers since the last take, in order. */
    take(): Plan[] { const l = fresh; fresh = []; return l; },
    /** Someone's answer now: their last, unless the fight's gone quiet longer than the gap. */
    plan(id: string): Plan | null { const p = last.get(id); return p && world.now - p.t <= gap() + 1e-6 && p.t <= world.now + 1e-6 ? p : null; },
    /** How someone would answer now, without changing anything (Morgul's respond, a look). */
    ask(id: string): Plan | null { sync(); const r = world.morgul && world.morgul.respond(id); return r ? plan(r) : null; },
    /** What someone would fight with: the strongest means they hold that arms them, or null (fists). */
    means(id: string): MeansLike | null { return armOf(world, id); },
    /** Forgets every answer (a new world). */
    clear(): void { last.clear(); fresh = []; },
    stop(): void { off(); },
  };
}

// ---- traps near and far -----------------------------------------------------

/** A trap at a place near the player: the game's to spring, with its means (for its trigger) and the game's own object for it. */
export interface NearTrap<T = unknown> extends TrapLike { means: MeansLike | null; obj?: T }
export interface TrapOptions<T> {
  /** The regions the game has loaded (its level, the rooms about it): their traps are the game's to spring. */
  regions: () => Iterable<string>;
  /** Makes the game's own trigger for a trap come near (placed at its place's spot). */
  make?: (trap: NearTrap<T>) => T;
  /** Lets one go (gone off, disarmed, or no longer near). */
  drop?: (trap: NearTrap<T>) => void;
}

/** The regions whose traps the world last heard are the game's (Morgul's state). */
function nearOf(world: WorldLike): string[] {
  const mod = (world.s as { mod?: { morgul?: { near?: string[] } } }).mod;
  return (mod && mod.morgul && mod.morgul.near) || [];
}

/**
 * Traps handed between near and far: Morgul springs traps off screen by
 * chance, except at places near the player, which are the game's to spring
 * with its triggers, so nobody is caught twice. sync() tells Morgul which
 * regions are near (an input, only when they change) and keeps the traps at
 * near places as the game's (made and dropped as they come and go); a
 * trigger that springs is reported back with spring().
 */
export function traps<T = unknown>(world: WorldLike, o: TrapOptions<T>) {
  const kept = new Map<string, NearTrap<T>>();
  const anyTraps = (mg: MorgulLike): boolean => {
    if (mg.trapDefs && mg.trapDefs.size) return true;
    if (mg.meansDefs) for (const m of mg.meansDefs.values()) if (m.use === 'set') return true;
    const mod = (world.s as { mod?: Record<string, unknown> }).mod;
    return !!(mod && mod.morgul);
  };
  const meansOf = (mg: MorgulLike, kind: string): MeansLike | null => {
    if (mg.meansDefs) for (const m of mg.meansDefs.values()) if (m.id === kind) return m;
    return null;
  };
  return {
    /** Tells Morgul what's near and works out the game's traps: those come near (made) and those gone (dropped). */
    sync(): { add: NearTrap<T>[]; drop: NearTrap<T>[] } {
      const mg = world.morgul, add: NearTrap<T>[] = [], drop: NearTrap<T>[] = [];
      if (!mg || !anyTraps(mg)) return { add, drop };
      const want = [...new Set(o.regions())].sort();
      if (want.join('\n') !== nearOf(world).join('\n')) mg.near(want);
      const now = mg.traps().filter((t) => mg.nearPlace(t.place));
      const ids = new Set(now.map((t) => t.id));
      for (const [k, t] of [...kept]) if (!ids.has(k)) { kept.delete(k); drop.push(t); if (o.drop) o.drop(t); }
      for (const t of now) {
        const had = kept.get(t.id);
        if (had) { had.uses = t.uses; had.known = t.known.slice(); continue; }
        const n: NearTrap<T> = { ...t, means: meansOf(mg, t.kind) };
        if (o.make) n.obj = o.make(n);
        kept.set(t.id, n);
        add.push(n);
      }
      return { add, drop };
    },
    /** The traps that are the game's now. */
    list(): NearTrap<T>[] { return [...kept.values()]; },
    get(id: string): NearTrap<T> | null { return kept.get(id) ?? null; },
    /** A trigger sprang on someone (a character, or the player), seen by whoever (default everyone there), with whoever else was about by the game's sight (evidence, for suspicion): Morgul's harm follows. */
    spring(id: string, who: string, seenBy?: string[], about?: string[]): void { if (world.morgul) { if (about) world.morgul.spring(id, who, seenBy, about); else world.morgul.spring(id, who, seenBy); } },
    /** Someone (the player, a character) disarmed one on screen. */
    disarm(id: string, by?: string): void { if (world.morgul) world.morgul.disarm(id, by); },
    /** A trap set on screen (by the player, a character the game walks there), at a place, for someone, seen by whoever, with whoever else was about: its id. */
    set(kind: string, s: { by?: string | null; place: string; for?: string; seenBy?: string[]; about?: string[] }): string | null { return world.morgul ? world.morgul.set(kind, s) : null; },
    /** Lets every trap go (a new world): the game's drop told of each. */
    clear(): void { for (const t of kept.values()) if (o.drop) o.drop(t); kept.clear(); },
  };
}

// Loaded as a plain script after dist/tycho.js, the bridge hangs itself on
// the engine as Tycho.minds too.
const g = globalThis as unknown as { Tycho?: Record<string, unknown> };
if (g.Tycho && typeof g.Tycho === 'object' && !Object.isFrozen(g.Tycho)) {
  try {
    g.Tycho.minds = { VERSION, minutes, hourOf, progress, clock, stash, restore, Seats, Presence, travelTimes, witnesses, collect, means, harm, might, scuffles, fighters, traps };
  } catch (e) { /* a frozen module namespace */ }
}
