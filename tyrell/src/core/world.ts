// The world: one simulation of people and places, and the whole public API a
// game talks to. It holds the state (plain JSON in `s`), the definitions the
// game declared, the core parts (Ring, Bicameral, Entmoot, Esper, Westmarch)
// and the modules that are switched on.
//
// Every call that changes the world from outside (a fact, something seen, a
// deed, a body that couldn't get to its stool...) goes through `input()`, so
// Esper can record it and play it again after a rewind.
import { Lang, combine, itemCount } from './conds';
import type { Module } from './module';
import { Ring } from './ring';
import { Bicameral } from './bicameral';
import { Entmoot } from './entmoot';
import { Esper } from './esper';
import { Westmarch } from './westmarch';
import { Palantir } from '../tools/palantir';
import { Strangers } from './strangers';
import type { Reverie } from '../modules/reverie';
import type { Fellowship } from '../modules/fellowship';
import type { Wormtongue } from '../modules/wormtongue';
import type { Cityspeak } from '../modules/cityspeak';
import type { Mentat } from '../modules/mentat';
import type { Gaff } from '../modules/gaff';
import type { Ceres } from '../modules/ceres';
import type { Cradle } from '../modules/cradle';
import type { Joi } from '../modules/joi';
import type {
  ActionDef, Body, Config, Ctx, DeedDef, Decision, Directive, Id, NeedDef, Options, PersonDef, PersonState,
  PlaceDef, Shell, Stimulus, TaskDef, Value, WorldState,
} from './types';
import { DAY, HOUR, Stream, clamp, dayOf, hash, hourOf, stableStringify } from './util';

export const SCHEMA = 1;

export const DEFAULT_CONFIG: Config = {
  minutesPerSecond: 1,
  week: 7,
  urgent: 0.85,
  urgentRank: 1.5,
  desperateRank: 2.5,
  cut: 0.25,
  top: 3,
  power: 2,
  inertia: 1.15,
  repeat: 0.75,
  travelScale: 30,
  placesPerAction: 4,
  idle: 20,
  backoff: 15,
  recheck: 30,
  budgetMs: 4,
  logSize: 1000,
  decisions: 12,
  habitFast: 0.25,
  habitSlow: 0.05,
  habitMin: 0.25,
  habitMax: 4,
  compensate: true,
};

/** A saved world: what world.save() returns and world.load() takes. */
export interface SaveData {
  tyrell: string;
  v: number;
  s: WorldState;
  history?: unknown;
}

type Listener = (data: any) => void;

export class World {
  /** The state: everything that changes. Plain JSON. */
  s: WorldState;
  readonly config: Config;
  readonly shell: Shell;
  readonly lang = new Lang();
  readonly needs = new Map<Id, NeedDef>();
  readonly actions = new Map<Id, ActionDef>();
  readonly tasks = new Map<Id, TaskDef>();
  readonly deeds = new Map<string, DeedDef>();
  readonly ring: Ring;
  readonly mind: Bicameral;
  readonly clock: Entmoot;
  readonly esper: Esper;
  readonly westmarch: Westmarch;
  readonly palantir: Palantir;
  readonly strangers: Strangers;
  readonly modules = new Map<string, Module>();
  /** The modules in the order their hooks run. */
  readonly hooks: Module[] = [];
  /** True while Esper replays history: the game hears nothing then. */
  replaying = false;
  private listeners = new Map<string, Listener[]>();
  private inputs = new Map<string, (...args: any[]) => unknown>();
  private depth = 0;
  private deferred: Array<[string, unknown[], boolean]> = [];
  /** Listeners being called (game code): inputs they make wait their turn. */
  private listening = 0;
  private _speed = 1;

  constructor(opts: Options, modules: Module[]) {
    this.config = { ...DEFAULT_CONFIG, ...(opts.config || {}) };
    this.shell = opts.shell || {};
    const seed = String(opts.seed ?? 'tyrell');
    const start = opts.start ?? 0;
    this.s = {
      v: SCHEMA, seed, now: start, seq: 0, people: {}, places: {}, facts: {}, q: [], log: [],
      mod: {}, game: {}, n: 0, ids: 0,
    };
    this.ring = new Ring(this);
    this.westmarch = new Westmarch(this);
    this.mind = new Bicameral(this);
    this.clock = new Entmoot(this);
    this.esper = new Esper(this, opts.esper);
    this.palantir = new Palantir(this);
    this.strangers = new Strangers(this);
    this.registerCore();
    for (const m of modules) {
      this.modules.set(m.name, m);
      this.hooks.push(m);
      m.attach(this);
      if (m.init) this.s.mod[m.name] = m.init();
    }
    this.clock.boot();
  }

  // -------------------------------------------------------------------------
  // The clock
  // -------------------------------------------------------------------------

  /** Minutes since the world began. */
  get now(): number { return this.s.now; }
  /** The hour of the day, 0 to 24 (fractional). */
  get hour(): number { return hourOf(this.s.now); }
  /** The day number. */
  get day(): number { return dayOf(this.s.now); }
  /** The day of the week, 0 to config.week - 1. */
  get weekday(): number { return this.day % this.config.week; }

  /** How fast time runs: 1 normal, 4 four times as fast, 0 paused, negative runs backward. */
  get speed(): number { return this._speed; }
  set speed(v: number) { this._speed = v; }

  /**
   * Moves the world on by a frame: `seconds` of real time at the current
   * speed and config.minutesPerSecond. A negative speed plays history backward.
   */
  tick(seconds: number): void {
    const minutes = seconds * this.config.minutesPerSecond * this._speed;
    if (minutes > 0) this.clock.advanceTo(this.s.now + minutes, this.config.budgetMs);
    else if (minutes < 0) {
      const to = Math.max(this.esper.earliest(), this.s.now + minutes);
      if (to >= this.s.now) { this._speed = 0; this.emit('esper:start', { t: this.s.now }); }
      else this.esper.seek(to);
    }
    this.clock.refreshBodies();
  }

  /** Jumps forward this many minutes at once (sleeping, a cut scene). No frame budget. */
  advance(minutes: number): void { this.advanceTo(this.s.now + minutes); }

  /** Runs the world up to time t (minutes). Use this when the game owns the clock. */
  advanceTo(t: number): void {
    if (t < this.s.now) { this.seek(t); return; }
    this.clock.advanceTo(t, Infinity);
    this.clock.refreshBodies();
  }

  /** Goes to any time Esper still remembers, back or forward. */
  seek(t: number): void {
    if (t >= this.s.now) { this.advanceTo(t); return; }
    this.esper.seek(t);
    this.clock.refreshBodies();
  }

  /** Goes back this many minutes. */
  rewind(minutes: number): void { this.seek(this.s.now - minutes); }

  /** Calls the game back at time t: listen with on('timer', ...) or on('timer:' + name, ...). */
  at(t: number, name: string, data: Record<string, Value> = {}): void { this.input('at', [t, name, data]); }

  // -------------------------------------------------------------------------
  // Declaring the world
  // -------------------------------------------------------------------------

  need(def: NeedDef): this { this.needs.set(def.id, def); return this; }
  place(def: PlaceDef): this { this.ring.place(def); return this; }
  link(a: Id, b: Id, minutes: number, oneWay = false): this { this.ring.link(a, b, minutes, oneWay); return this; }
  action(def: ActionDef): this { this.actions.set(def.id, def); return this; }
  task(def: TaskDef): this { this.tasks.set(def.id, def); return this; }
  /** Says what a deed (world.did) means: feelings, memories, regard, standing, crime. */
  deed(verb: string, def: DeedDef): this { this.deeds.set(verb, def); return this; }

  /**
   * Adds a person, or returns them if they already exist (after a load the
   * saved person wins, so declaring everyone on every start is safe).
   */
  person(id: Id, def: PersonDef = {}): PersonState {
    const have = this.s.people[id];
    if (have) return have;
    return this.input('person', [id, def]) as PersonState;
  }

  /** Extends the condition language with a term. */
  term(name: string, fn: (ctx: Ctx, arg: string) => Value | undefined): this { this.lang.term(name, fn); return this; }
  /** Extends the effect language. */
  effect(name: string, fn: (ctx: Ctx, arg: string, op: string, value: Value) => void): this { this.lang.effect(name, fn); return this; }

  /** A module by name, or undefined if it's switched off. */
  module<T extends Module = Module>(name: string): T | undefined { return this.modules.get(name) as T | undefined; }

  /** Moods, memories, beliefs and the file on the player. */
  get reverie(): Reverie | undefined { return this.modules.get('reverie') as Reverie | undefined; }
  /** Regard, sentiments, compatibility, groups and standing. */
  get fellowship(): Fellowship | undefined { return this.modules.get('fellowship') as Fellowship | undefined; }
  /** Gossip, witnesses, heat, secrets and favors. */
  get wormtongue(): Wormtongue | undefined { return this.modules.get('wormtongue') as Wormtongue | undefined; }
  /** Practices, social acts and lines. */
  get cityspeak(): Cityspeak | undefined { return this.modules.get('cityspeak') as Cityspeak | undefined; }
  /** Planning: HTN tasks and getting hold of things. */
  get mentat(): Mentat | undefined { return this.modules.get('mentat') as Mentat | undefined; }
  /** The director. */
  get gaff(): Gaff | undefined { return this.modules.get('gaff') as Gaff | undefined; }
  /** Money, goods, wages, prices and stock. */
  get ceres(): Ceres | undefined { return this.modules.get('ceres') as Ceres | undefined; }
  /** Ages, households, births and departures. */
  get cradle(): Cradle | undefined { return this.modules.get('cradle') as Cradle | undefined; }
  /** The optional language-model voice. */
  get joi(): Joi | undefined { return this.modules.get('joi') as Joi | undefined; }

  // -------------------------------------------------------------------------
  // Talking to the world while it runs
  // -------------------------------------------------------------------------

  /** Sets a fact (the truth of the world), or reads it if no value is given. */
  fact(key: string, value?: Value): Value | undefined {
    if (value === undefined) return this.s.facts[key];
    if (this.s.facts[key] === value) return value;
    this.input('fact', [key, value]);
    return value;
  }

  /** The places that are loaded and visible: people there get bodies. */
  focus(regions: string[]): void { this.clock.focus(regions); }

  /** Everyone the game should show now. */
  bodies(): Body[] { return this.clock.bodies(); }

  /** Anyone's body as it would be shown now (whether or not they're near). */
  body(id: Id): Body | null { return this.clock.body(id); }

  /** The game reports what was seen or heard. */
  sense(stim: Stimulus): void { this.input('sense', [stim]); }

  /** The game reports a deed: someone did something to or for someone. */
  did(actor: Id, verb: string, data: Record<string, Value> = {}): void { this.input('did', [actor, verb, data]); }

  /** A body reports back: 'failed' (couldn't get there, the slot was taken), or 'done' early. */
  report(id: Id, what: 'failed' | 'done', reason = ''): void { this.input('report', [id, what, reason]); }

  /** The story layer: tell someone to do something, above their job and routine. */
  direct(id: Id, directive: Directive | null): void { this.input('direct', [id, directive]); }

  /** Rewards or discourages a choice: nudges the habit behind it. */
  reward(id: Id, action: Id, amount: number): void { this.input('reward', [id, action, amount]); }

  /** Sets a person's variable (money, anything). */
  setVar(id: Id, name: string, value: Value): void { this.input('setVar', [id, name, value]); }

  /** Gives (or with a negative count, takes) goods. */
  give(id: Id, item: Id, count = 1): void { this.input('give', [id, item, count]); }

  /** Sends someone away until a time (dormant): they come back with a summary of what they did. */
  away(id: Id, until: number, summary = '', place?: Id): void { this.input('away', [id, until, summary, place ?? null]); }

  /** Has someone follow another (walk together, sit together), or stop (null). */
  follow(id: Id, leader: Id | null): void { this.input('follow', [id, leader]); }

  /** Removes someone for good ('left', 'died'...). */
  remove(id: Id, why = 'left'): void { this.input('remove', [id, why]); }

  /** Keeps a piece of the game's own state with the world, so it rewinds with it. */
  keep(key: string, value: unknown): void { this.input('keep', [key, value === undefined ? null : JSON.parse(JSON.stringify(value))]); }
  kept<T = unknown>(key: string): T | undefined { return this.s.game[key] as T | undefined; }

  // -------------------------------------------------------------------------
  // Asking about people
  // -------------------------------------------------------------------------

  /** A person's state (read it, don't change it: go through the API). */
  get(id: Id): PersonState | undefined { return this.s.people[id]; }
  /** Everyone active. */
  people(): PersonState[] { return Object.values(this.s.people).filter((p) => p.status === 'active'); }
  /** How many of an item a person can use: their own, plus their household's pantry (Ceres). */
  have(p: PersonState, item: Id): number { return (p.inv[item] || 0) + (this.ceres ? this.ceres.pantryCount(p.id, item) : 0); }

  /** Takes items from a person: their own first, then the household's pantry. */
  takeItem(p: PersonState, item: Id, n: number): void {
    const own = Math.min(n, p.inv[item] || 0);
    if (own > 0) { p.inv[item] -= own; if (!p.inv[item]) delete p.inv[item]; }
    if (n - own > 0 && this.ceres) this.ceres.takeFromPantry(p.id, item, n - own);
  }

  /** A need's level now (0 calm, 1 desperate). */
  needOf(id: Id, need: Id): number { const p = this.s.people[id]; return p ? this.mind.level(p, need) : 0; }
  /** Why someone is doing what they're doing. */
  why(id: Id): Decision | null { return this.palantir.why(id); }
  /** Why someone isn't doing something. */
  whyNot(id: Id, action: Id): string { return this.palantir.whyNot(id, action); }
  /** A readable account of a person: needs, mood, doing, plan, beliefs. */
  describe(id: Id): string { return this.palantir.describe(id); }

  // -------------------------------------------------------------------------
  // Events for the game
  // -------------------------------------------------------------------------

  /** Listens for an event: 'embody', 'disembody', 'step', 'say', 'report'... or '*' for all. */
  on(kind: string, fn: Listener): () => void {
    const list = this.listeners.get(kind) || [];
    list.push(fn);
    this.listeners.set(kind, list);
    return () => this.off(kind, fn);
  }
  off(kind: string, fn: Listener): void {
    const list = this.listeners.get(kind);
    if (list) this.listeners.set(kind, list.filter((f) => f !== fn));
  }
  /** Tells the game something happened (silent while Esper replays). */
  emit(kind: string, data: any = {}): void {
    if (this.replaying) return;
    const a = this.listeners.get(kind), b = kind !== '*' ? this.listeners.get('*') : undefined;
    if (!a?.length && !b?.length) return;
    this.listening++;
    try {
      for (const fn of a || []) fn(data);
      for (const fn of b || []) fn({ kind, ...data });
    } finally { this.listening--; }
  }

  // -------------------------------------------------------------------------
  // Saving
  // -------------------------------------------------------------------------

  /** The whole world as plain JSON. With history, Esper's memory goes too. */
  save(withHistory = false): SaveData {
    const out: SaveData = { tyrell: 'world', v: SCHEMA, s: JSON.parse(JSON.stringify(this.s)) };
    if (withHistory) out.history = this.esper.export();
    return out;
  }

  /** Loads a saved world (migrating older saves). Declare places and actions before or after. */
  load(data: SaveData | string): void {
    const d: SaveData = typeof data === 'string' ? JSON.parse(data) : data;
    let s = d.s;
    let v = d.v ?? s.v ?? 1;
    while (v < SCHEMA) {
      const step = MIGRATIONS[v];
      if (!step) throw new Error(`Tyrell: no migration from save version ${v}`);
      s = step(s);
      v++;
    }
    if (v > SCHEMA) throw new Error(`Tyrell: save version ${v} is newer than this engine (${SCHEMA})`);
    s.v = SCHEMA;
    this.s = s;
    for (const m of this.hooks) {
      if (m.init && this.s.mod[m.name] === undefined) this.s.mod[m.name] = m.init();
      m.loaded?.();
    }
    for (const def of this.ring.defs.values()) this.ring.state(def.id);
    this.esper.reset();
    if (d.history) this.esper.import(d.history);
    this.palantir.clear();
    this.clock.reset();
    this.clock.refreshBodies();
  }

  /** A hash of the whole state: two worlds with the same hash are the same. */
  hash(): string { return hash(stableStringify(this.s)).toString(16); }

  // -------------------------------------------------------------------------
  // Randomness
  // -------------------------------------------------------------------------

  /** A random stream for one person's next decision (advances their counter). */
  stream(p: PersonState): Stream { return new Stream(this.s.seed, p.id, p.n++); }
  /** A random stream for the world itself (directors, strangers, events). */
  worldStream(name: string): Stream { return new Stream(this.s.seed, 'world', name, this.s.n++); }
  /** A random stream that changes nothing (for choices that only look, like a line to show). */
  worldStreamPeek(...parts: Array<string | number>): Stream { return new Stream(this.s.seed, 'peek', ...parts); }

  // -------------------------------------------------------------------------
  // Inputs (recorded for Esper)
  // -------------------------------------------------------------------------

  /** Registers an input handler: a change from outside that Esper records and replays. */
  defineInput(name: string, fn: (...args: any[]) => unknown): void { this.inputs.set(name, fn); }

  /**
   * Applies an input and records it for Esper, so a rewind can replay it.
   *
   *  - A plain call from the game is recorded at the current time.
   *  - A call the game makes from inside a listener, while the engine is in
   *    the middle of something (handling an event, applying another input),
   *    waits until that's finished and is recorded to replay at exactly that
   *    point (after that event, or chained to that input).
   *  - Calls the engine makes itself, or that a storylet makes while the
   *    engine runs it (world.internally), are applied but not recorded:
   *    a replay makes them again.
   */
  input(name: string, args: unknown[]): unknown {
    const fn = this.inputs.get(name);
    if (!fn) throw new Error(`Tyrell: unknown input '${name}'`);
    if (this.replaying) return this.applyInput(fn, args);
    const fromGame = this.listening > 0;
    if (this.depth > 0 && !fromGame) return this.applyInput(fn, args);
    const handling = this.clock.handling;
    if (this.depth > 0 || handling !== null) {
      if (IMMEDIATE.has(name)) { this.deferred.push([name, args, true]); return this.applyInput(fn, args); }
      this.deferred.push([name, args, false]);
      return undefined;
    }
    if (this.esper.echo(name, args)) return undefined;
    this.esper.record(name, args);
    const out = this.applyInput(fn, args);
    this.flushDeferred(undefined);
    return out;
  }

  private applyInput(fn: (...args: any[]) => unknown, args: unknown[]): unknown {
    this.depth++;
    try { return fn(...args); } finally { this.depth--; }
  }

  /**
   * Applies the calls that waited (Entmoot calls this after each event, with
   * its seq; input() calls it after each input, with none: they chain).
   */
  flushDeferred(after: number | undefined): void {
    let first = true;
    while (this.deferred.length) {
      const [name, args, applied] = this.deferred.shift() as [string, unknown[], boolean];
      const fn = this.inputs.get(name);
      if (!fn) continue;
      // the first waits for the event; the rest chain to the one before
      const a = first && after !== undefined ? after : undefined;
      const chain = !(first && after !== undefined);
      first = false;
      if (this.esper.echo(name, args, a, chain)) continue;
      this.esper.record(name, args, a, chain);
      if (!applied) this.applyInput(fn, args);
    }
  }

  /**
   * Runs engine-driven code (a director's storylet, a module's callback into
   * the game): inputs it makes are applied but not recorded, because a replay
   * runs the same code again.
   */
  internally<T>(fn: () => T): T {
    this.depth++;
    try { return fn(); } finally { this.depth--; }
  }

  /** Replays a recorded input (Esper only). */
  replay(name: string, args: unknown[]): void {
    const fn = this.inputs.get(name);
    if (fn) this.applyInput(fn, args);
  }

  // -------------------------------------------------------------------------
  // Internals shared by the parts
  // -------------------------------------------------------------------------

  /** A context for conditions about a person. */
  ctx(p?: PersonState, extra: Partial<Ctx> = {}): Ctx { return { world: this, person: p, ...extra }; }

  /** The next sequence number (for queue items and doings). */
  nextSeq(): number { return ++this.s.seq; }

  /** Writes to the log and tells the game. */
  log(k: string, who?: Id, d?: Record<string, unknown>): void { this.westmarch.write(k, who, d); }

  private makePerson(id: Id, def: PersonDef): PersonState {
    const needs: PersonState['needs'] = {};
    for (const [nid, nd] of this.needs) needs[nid] = { v: clamp(def.needs?.[nid] ?? nd.start ?? 0.2), t: this.s.now };
    const p: PersonState = {
      id, name: def.name || id, def: JSON.parse(JSON.stringify(def)), status: 'active',
      needs, vars: { money: 0, ...(def.vars || {}) }, inv: { ...(def.inv || {}) },
      place: def.place || def.home || null, doing: null, habits: {}, cool: {}, n: 0,
      plan: null, suspended: [], directive: null,
    };
    if (def.born !== undefined) p.born = def.born;
    return p;
  }

  private registerCore(): void {
    const L = this.lang;
    const person = (ctx: Ctx, arg: string): PersonState | undefined => {
      if (arg.startsWith('target.')) return ctx.target ? this.s.people[ctx.target] : undefined;
      return ctx.person;
    };
    void person;
    // terms ---------------------------------------------------------------
    L.term('need', (c, a) => (c.person ? this.mind.level(c.person, a) : undefined));
    L.term('var', (c, a) => c.person?.vars[a]);
    L.term('money', (c) => Number(c.person?.vars.money ?? 0));
    L.term('trait', (c, a) => c.person?.def.traits?.[a] ?? 0.5);
    L.term('value', (c, a) => c.person?.def.values?.[a] ?? 0);
    L.term('has', (c, a) => (c.person ? this.have(c.person, a) : 0));
    L.term('hour', () => this.hour);
    L.term('day', () => this.day);
    L.term('weekday', () => this.weekday);
    L.term('fact', (c, a) => {
      const v = this.s.facts[a];
      if (v !== undefined) return v;
      return this.shell.check ? this.shell.check(a, c) ?? null : null;
    });
    L.term('game', (_c, a) => this.s.game[a] as Value);
    L.term('at', (c, a) => {
      const p = c.person;
      if (!p || !p.place || p.doing?.kind === 'travel') return false;
      if (a.startsWith('tag:')) return this.ring.hasTag(p.place, a.slice(4));
      if (a === 'home') return !!p.def.home && this.ring.within(p.place, p.def.home);
      if (a === 'work') return !!p.def.job && this.ring.within(p.place, p.def.job.place);
      return this.ring.within(p.place, a);
    });
    L.term('open', (_c, a) => this.ring.open(a));
    L.term('free', (_c, a) => { const [pl, slot] = a.split('.'); return this.ring.free(pl, slot); });
    L.term('is', (c, a) => !!c.person?.def.tags?.includes(a));
    L.term('job', (c, a) => (a ? c.person?.def.job?.id === a : c.person?.def.job?.id ?? null));
    L.term('in', (c, a) => (c.person?.place ? this.ring.region(c.person.place) === a : false));
    L.term('doing', (c, a) => (a ? c.person?.doing?.action === a : c.person?.doing?.action ?? null));
    L.term('with', (c, a) => {
      const o = this.s.people[a];
      return !!(c.person?.place && o?.place && o.doing?.kind !== 'travel' && this.ring.root(o.place) === this.ring.root(c.person.place));
    });
    L.term('topic', (c, a) => c.topic === a);
    L.term('chance', (c, a) => (c.person ? this.stream(c.person).chance(Number(a)) : this.worldStream('chance').chance(Number(a))));
    L.term('target', (c, a) => {
      if (!c.target) return null;
      if (!a) return c.target;
      const t = this.s.people[c.target];
      return t ? this.lang.value(a, { ...c, person: t, target: c.person?.id ?? null }) : null;
    });
    L.term('person', (c) => c.person?.id ?? null);
    L.term('place', (c, a) => (a ? c.place === a : c.place ?? null));
    L.term('home', (c) => c.person?.def.home ?? null);
    // effects -------------------------------------------------------------
    L.effect('var', (c, a, op, v) => {
      if (!c.person) return;
      const name = a.startsWith('var.') ? a.slice(4) : a;
      c.person.vars[name] = combine(c.person.vars[name], op, v);
    });
    L.effect('money', (c, _a, op, v) => { if (c.person) c.person.vars.money = combine(c.person.vars.money ?? 0, op, v); });
    L.effect('need', (c, a, op, v) => { if (c.person) this.mind.setLevel(c.person, a, Number(combine(this.mind.level(c.person, a), op, v))); });
    L.effect('give', (c, a) => { if (c.person) { const [item, n] = itemCount(a); c.person.inv[item] = (c.person.inv[item] || 0) + n; } });
    L.effect('take', (c, a) => {
      if (!c.person) return;
      const [item, n] = itemCount(a);
      this.takeItem(c.person, item, n);
    });
    L.effect('fact', (_c, a, op, v) => { this.s.facts[a] = combine(this.s.facts[a], op, v); });
    L.effect('game', (_c, a, op, v) => { this.s.game[a] = combine(this.s.game[a] as Value, op, v); });
    L.effect('log', (c, a) => this.log(a, c.person?.id));
    // inputs --------------------------------------------------------------
    this.defineInput('person', (id: Id, def: PersonDef) => {
      if (this.s.people[id]) return this.s.people[id];
      const p = this.makePerson(id, def);
      this.s.people[id] = p;
      for (const m of this.hooks) m.added?.(p);
      this.clock.wake(p, 0);
      this.log('joined', id);
      return p;
    });
    this.defineInput('fact', (key: string, value: Value) => {
      this.s.facts[key] = value;
      this.log('fact', undefined, { key, value });
      this.clock.factChanged(key);
    });
    this.defineInput('sense', (stim: Stimulus) => {
      const s = { ...stim };
      if (!s.seenBy) s.seenBy = s.place ? this.ring.present(s.place).filter((id) => id !== s.actor) : [];
      this.log('sensed', s.actor, { kind: s.kind, what: s.what ?? null, place: s.place ?? null, by: s.seenBy });
      for (const m of this.hooks) m.sensed?.(s);
    });
    this.defineInput('did', (actor: Id, verb: string, data: Record<string, Value>) => {
      this.log('did', actor, { verb, ...data });
      for (const m of this.hooks) m.did?.(actor, verb, data);
    });
    this.defineInput('report', (id: Id, what: string, reason: string) => {
      const p = this.s.people[id];
      if (!p || p.status !== 'active') return;
      if (what === 'failed') this.clock.fail(p, reason || 'the body could not do it');
      else this.clock.finishNow(p);
    });
    this.defineInput('direct', (id: Id, d: Directive | null) => {
      const p = this.s.people[id];
      if (!p) return;
      p.directive = d ? { ...d } : null;
      this.log(d ? 'directed' : 'released', id, d ? { do: d.do } : undefined);
      this.clock.rethink(p, 'directive');
    });
    this.defineInput('reward', (id: Id, action: Id, amount: number) => {
      const p = this.s.people[id];
      if (p) this.mind.nudge(p, action, amount);
    });
    this.defineInput('setVar', (id: Id, name: string, value: Value) => {
      const p = this.s.people[id];
      if (p) p.vars[name] = value;
    });
    this.defineInput('give', (id: Id, item: Id, count: number) => {
      const p = this.s.people[id];
      if (!p) return;
      p.inv[item] = Math.max(0, (p.inv[item] || 0) + count);
      if (!p.inv[item]) delete p.inv[item];
    });
    this.defineInput('away', (id: Id, until: number, summary: string, place: Id | null) => this.clock.sendAway(id, until, summary, place));
    this.defineInput('follow', (id: Id, leader: Id | null) => {
      const p = this.s.people[id];
      if (!p) return;
      if (leader) p.follow = leader; else delete p.follow;
    });
    this.defineInput('remove', (id: Id, why: string) => this.clock.removePerson(id, why));
    this.defineInput('keep', (key: string, value: unknown) => { this.s.game[key] = value; });
    this.defineInput('at', (t: number, name: string, data: Record<string, Value>) => {
      this.clock.schedule({ t, k: 'timer', ref: name, data });
    });
  }
}

/** Inputs that return a value, so they can't wait for an event to finish. */
const IMMEDIATE = new Set(['person', 'promote', 'say', 'birth']);

/** Save migrations: MIGRATIONS[v] turns a version-v state into version v+1. */
export const MIGRATIONS: Record<number, (s: any) => any> = {};

export { DAY, HOUR };
