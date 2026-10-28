// The world: one simulation of people and places, and the whole public API a
// game talks to. It holds the state (plain JSON in `s`), the definitions the
// game declared, the core parts (Ring, Bicameral, Entmoot, Esper, Westmarch)
// and the modules that are switched on.
//
// Every call that changes the world from outside (a fact, something seen, a
// deed, a body that couldn't get to its stool...) goes through `input()`, so
// Esper can record it and play it again after a rewind. Settings changed
// during play (`tune()`) are inputs too, kept in the state over the config
// the game declared, so they rewind and save with everything else.
import { Lang, combine, itemCount } from './conds';
import type { Module } from './module';
import { Ring } from './ring';
import { Bicameral } from './bicameral';
import { Entmoot } from './entmoot';
import { Esper } from './esper';
import { Westmarch } from './westmarch';
import { Palantir } from '../tools/palantir';
import { Strangers } from './strangers';
import { Skills } from './skills';
import type { Reverie } from '../modules/reverie';
import type { Fellowship } from '../modules/fellowship';
import type { Wormtongue } from '../modules/wormtongue';
import type { Cityspeak } from '../modules/cityspeak';
import type { Mentat } from '../modules/mentat';
import type { Gaff } from '../modules/gaff';
import type { Ceres } from '../modules/ceres';
import type { Cradle } from '../modules/cradle';
import type { Joi } from '../modules/joi';
import type { Athelas } from '../modules/athelas';
import type { Delos } from '../modules/delos';
import type { Voice } from '../modules/voice';
import type {
  ActionDef, Body, Config, Ctx, DeedDef, Decision, Directive, HeldWish, Id, NeedDef, Options, PersonDef, PersonState,
  PastimeDef, PlaceDef, Shell, SkillDef, Stimulus, TaskDef, Value, WishDef, WorldState,
} from './types';
import { DAY, HOUR, Stream, clamp, clone, dayOf, hash, hourOf, stableStringify } from './util';

export const SCHEMA = 2;

export const DEFAULT_CONFIG: Config = {
  minutesPerSecond: 1,
  week: 7,
  urgent: 0.85,
  urgentRank: 1.5,
  desperateRank: 2.5,
  storyRank: 3,
  jobRank: 2,
  routineRank: 1,
  cut: 0.25,
  top: 3,
  power: 2,
  inertia: 1.15,
  repeat: 0.75,
  travelScale: 30,
  placesPerAction: 4,
  idle: 20,
  backoff: 15,
  budgetMs: 4,
  logSize: 1000,
  decisions: 12,
  checksOnce: false,
  habitFast: 0.25,
  habitSlow: 0.05,
  habitDrift: 0.02,
  habitMin: 0.25,
  habitMax: 4,
  compensate: true,
  pallGain: 0.35,
  pallDecay: 0.08,
  pallPenalty: 0.6,
  wishMax: 2,
  wishHours: [8, 13, 17],
  wishChance: 0.5,
  wishMinutes: 2160,
  wishPull: 1.35,
  needs: 1,
  habits: 1,
  learning: 1,
  wishes: 1,
  crowds: 1,
  traitDefault: 0.5,
  needStart: 0.2,
  needCurve: 'pow1.5',
  reliefFloor: 0.05,
  liftRelief: 0.3,
  desperate: 0.97,
  desperateSlope: 10,
  habitBest: 2,
  habitDone: 0.2,
  nudgeSlow: 0.25,
  pallFrom: 0.05,
  pallDone: 0.2,
  repeatWindow: 90,
  targets: 6,
  meetMax: 3,
  meetMinutes: 3,
  awayNeeds: 0.4,
  skillRate: 0.02,
  skillGrace: 3,
};

/**
 * The core's headline knobs (fields of Config): plain multipliers, 1 changing
 * nothing. 'person' ones a person's own `tune.core` multiplies for them alone;
 * 'world' ones are the world's only.
 */
export const CORE_KNOBS: Readonly<Record<string, 'person' | 'world'>> = { needs: 'person', habits: 'person', learning: 'person', wishes: 'person', crowds: 'world' };

/** Config fields that aren't tuned through world.tune: the game changes them directly (they never change what happens). */
const UNTUNED = new Set(['minutesPerSecond', 'budgetMs']);
/** Settings that take more than one kind of value: a curve is a name or a list of points. */
const CURVES = new Set(['needCurve']);

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
  readonly pastimes = new Map<Id, PastimeDef>();
  readonly wishes = new Map<Id, WishDef>();
  readonly ring: Ring;
  readonly mind: Bicameral;
  readonly clock: Entmoot;
  readonly esper: Esper;
  readonly westmarch: Westmarch;
  readonly palantir: Palantir;
  readonly strangers: Strangers;
  /** Skills: levels that grow with practice. */
  readonly skills: Skills;
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
  /** The input depth the innermost listener was called at (deeper is engine code it set off). */
  private listenDepth = -1;
  /** Clock calls running (tick, advanceTo, seek, load). */
  private moving = 0;
  /** Clock calls made while the engine was busy, waiting their turn. */
  private later: Array<() => void> = [];
  /** Calls that only look (choosing a line, explaining a choice): chance: draws change nothing then. */
  private looking = 0;
  private _speed = 1;
  /** The settings in force, by module, made from the overrides they were made from (s.tune's, kept whole: a new tune makes a new object). */
  private tunedCache = new Map<string, { src: object; base: object; out: object }>();

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
    this.skills = new Skills(this);
    this.registerCore();
    this.skills.register();
    this.mind.register();
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
  get weekday(): number { return this.day % this.cfg.week; }

  /** How fast time runs: 1 normal, 4 four times as fast, 0 paused, negative runs backward. */
  get speed(): number { return this._speed; }
  set speed(v: number) { this._speed = v; }

  // Calls that move time or replace the state (tick, advance, advanceTo,
  // seek, rewind, load) can't run in the middle of the engine's work: the
  // queue being run would be swapped out from under it. Made from a listener
  // (or a storylet, an effect, an input handler), they wait until the call
  // that's running returns, then run in order.

  /**
   * Moves the world on by a frame: `seconds` of real time at the current
   * speed and config.minutesPerSecond. A negative speed plays history backward.
   */
  tick(seconds: number): void { this.whenFree(() => this.runTick(seconds)); }

  /** Jumps forward this many minutes at once (sleeping, a cut scene). No frame budget. */
  advance(minutes: number): void { this.whenFree(() => this.runTo(this.s.now + minutes)); }

  /** Runs the world up to time t (minutes). Use this when the game owns the clock. */
  advanceTo(t: number): void { this.whenFree(() => this.runTo(t)); }

  /** Goes to any time Esper still remembers, back or forward. */
  seek(t: number): void { this.whenFree(() => this.runSeek(t)); }

  /** Goes back this many minutes. */
  rewind(minutes: number): void { this.whenFree(() => this.runSeek(this.s.now - minutes)); }

  private runTick(seconds: number): void {
    const minutes = seconds * this.config.minutesPerSecond * this._speed;
    if (minutes > 0) this.clock.advanceTo(this.s.now + minutes, this.config.budgetMs);
    else if (minutes < 0) {
      const to = Math.max(this.esper.earliest(), this.s.now + minutes);
      if (to >= this.s.now) { this._speed = 0; this.emit('esper:start', { t: this.s.now }); }
      else {
        const before = this.clock.shown();
        this.esper.seek(to);
        this.clock.refreshBodies(before);
        return;
      }
    }
    this.clock.refreshBodies();
  }

  private runTo(t: number): void {
    if (t < this.s.now) { this.runSeek(t); return; }
    this.clock.advanceTo(t, Infinity);
    this.clock.refreshBodies();
  }

  private runSeek(t: number): void {
    if (t >= this.s.now) { this.runTo(t); return; }
    const before = this.clock.shown();
    this.esper.seek(t);
    this.clock.refreshBodies(before);
  }

  /** Is the engine in the middle of something: moving time, an event, an input, a listener, a replay? */
  private busy(): boolean {
    return this.moving > 0 || this.listening > 0 || this.depth > 0 || this.clock.handling !== null || this.replaying;
  }

  /** Runs a call that moves time or replaces the state now, or after the engine's current work if it's busy. */
  private whenFree(fn: () => void): void {
    if (this.busy()) { this.later.push(fn); return; }
    this.moving++;
    try { fn(); } finally { this.moving--; }
    this.runLater();
  }

  /** Runs the clock calls that waited, in order, once the engine is free. */
  private runLater(): void {
    while (this.later.length && !this.busy()) {
      const fn = this.later.shift() as () => void;
      this.moving++;
      try { fn(); } finally { this.moving--; }
    }
  }

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
  /** A skill: levels that grow with practice (actions' `trains`), read as `skill.<id>`. */
  skill(def: SkillDef): this { this.skills.defs.set(def.id, def); return this; }
  /** A kind of pastime that palls (actions' `palls`): its label, and how fast it palls and recovers. */
  pastime(def: PastimeDef): this { this.pastimes.set(def.id, def); return this; }
  /** A wish (or, with `dream`, a dream) people may come to hold. */
  wish(def: WishDef): this { this.wishes.set(def.id, def); return this; }

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
  /** Conditions that run a course: ale, colds, toxins. */
  get athelas(): Athelas | undefined { return this.modules.get('athelas') as Athelas | undefined; }
  /** Genomes: looks, traits, talents and instincts, inherited. */
  get delos(): Delos | undefined { return this.modules.get('delos') as Delos | undefined; }
  /** Branching conversations: threads of beats, answers with approaches, promises. */
  get voice(): Voice | undefined { return this.modules.get('voice') as Voice | undefined; }

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
  focus(regions: string[]): void { this.clock.focus(regions); this.runLater(); }

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

  /** Practice from outside the simulation (a lesson, a book): hours of it at the person's own pace. */
  train(id: Id, skill: Id, hours: number): void { this.input('train', [id, skill, hours]); }

  /** Sets a skill's level outright. */
  setSkill(id: Id, skill: Id, level: number): void { this.input('skill', [id, skill, level]); }

  /** Gives someone a wish (or a dream), about something if it's given (a dish, a friend's id). */
  wishFor(id: Id, wish: Id, about?: Value): void { this.input('wish', [id, wish, about ?? null]); }

  /** Makes a wish someone holds come true. */
  grant(id: Id, wish: Id): void { this.input('grant', [id, wish]); }

  /** The wishes (and the dream) someone holds now. */
  wishesOf(id: Id): Array<HeldWish & { label: string; progress?: number }> { const p = this.s.people[id]; return p ? this.mind.wishesOf(p) : []; }

  /** A person's level in a skill now (0 if they've never practiced it and didn't start with it). */
  skillOf(id: Id, skill: Id): number { const p = this.s.people[id]; return p ? this.skills.level(p, skill) : 0; }

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
  // Tuning: settings changed during play
  // -------------------------------------------------------------------------

  /**
   * Changes settings during play (a slider in the game's options). It's an
   * input, so time walk replays the change at the moment it was made, and
   * the overrides are kept in the state, so a save keeps them. `module` is a
   * module's name, or 'core' for the config; `values` are fields of its
   * settings (any of them, not only the headline knobs), each over what was
   * declared. A field set to null goes back to what was declared, and
   * `values` null puts the whole module back. With `person`, it's that
   * person's own headline knobs instead (their `tune`). See docs/tuning.md.
   */
  tune(module: string, values: Record<string, unknown> | null, person?: Id): void {
    const base = this.tuneBase(module) as Record<string, unknown>;
    const knobs = this.knobsOf(module);
    if (values !== null && (typeof values !== 'object' || Array.isArray(values))) throw new Error(`Tyrell: tune ${module} with an object of settings, or null`);
    if (person !== undefined && !this.s.people[person]) throw new Error(`Tyrell: can't tune '${person}': there's nobody by that id`);
    for (const key of Object.keys(values || {})) {
      const v = (values as Record<string, unknown>)[key];
      if (person !== undefined) {
        if (knobs[key] !== 'person') throw new Error(`Tyrell: '${key}' isn't a knob of ${module}'s a person can have their own of`);
        if (v !== null && !(typeof v === 'number' && isFinite(v) && v >= 0)) throw new Error(`Tyrell: a person's '${key}' must be a number, 0 or more, or null`);
        continue;
      }
      if (module === 'core' && UNTUNED.has(key)) throw new Error(`Tyrell: set world.config.${key} directly: it changes nothing that happens`);
      if (!(key in base)) throw new Error(`Tyrell: ${module} has no setting '${key}'`);
      if (v === null) continue;
      const want = base[key];
      if (!plain(v)) throw new Error(`Tyrell: '${key}' must be plain data (numbers, strings, true or false, lists and objects of them)`);
      const curve = CURVES.has(key) && (typeof v === 'string' || Array.isArray(v));
      if (!curve && want !== null && want !== undefined && kindOf(v) !== kindOf(want)) throw new Error(`Tyrell: '${key}' is a ${kindOf(want)} in ${module}, not a ${kindOf(v)}`);
    }
    this.input('tune', [module, values === null ? null : clone(values), person ?? null]);
  }

  /**
   * The settings in force for a module (or 'core'): a copy of what was
   * declared with any overrides from tune() over it. With a person, their
   * headline knobs as they apply to them: the world's times their own.
   */
  tuning(module: string, person?: Id): Record<string, unknown> {
    const now: Record<string, unknown> = { ...(this.tuneBase(module) as Record<string, unknown>), ...(this.s.tune?.[module] || {}) };
    if (person === undefined) return now;
    const p = this.s.people[person];
    const out: Record<string, unknown> = {};
    const knobs = this.knobsOf(module);
    for (const k of Object.keys(knobs)) if (knobs[k] === 'person') out[k] = Number(now[k]) * this.own(p, module, k);
    return out;
  }

  /** The core config in force: what was declared (world.config), under any overrides made with tune(). */
  get cfg(): Config { return this.tuned('core', this.config); }

  /**
   * A module's settings in force (or the core's, as 'core'): `base`, what was
   * declared, under any overrides made with tune(). Untuned, it's `base`
   * itself; tuned, an object whose own fields are the overrides and whose
   * prototype is `base` (so a field the game sets on `base` still shows).
   */
  tuned<T extends object>(name: string, base: T): T {
    const t = this.s.tune;
    if (t === undefined) return base;
    const o = t[name];
    if (o === undefined) return base;
    const c = this.tunedCache.get(name);
    if (c && c.src === o && c.base === base) return c.out as T;
    const out = Object.assign(Object.create(base), o) as T;
    this.tunedCache.set(name, { src: o, base, out });
    return out;
  }

  /** A person's own multiplier for one of a module's headline knobs (their `tune`): 1 if they have none. */
  own(p: PersonState | null | undefined, module: string, knob: string): number {
    const v = p?.def.tune?.[module]?.[knob];
    return typeof v === 'number' ? v : 1;
  }

  /** What tune() works over: the config for 'core', else the module's declared settings. */
  private tuneBase(module: string): object {
    if (module === 'core') return this.config;
    const m = this.modules.get(module);
    if (!m) throw new Error(`Tyrell: can't tune '${module}': no module by that name is switched on`);
    if (!m.config) throw new Error(`Tyrell: ${module} has no settings to tune`);
    return m.config;
  }

  private knobsOf(module: string): Readonly<Record<string, 'person' | 'world'>> {
    return module === 'core' ? CORE_KNOBS : this.modules.get(module)?.knobs ?? {};
  }

  /** Applies a tune (the input): the overrides kept whole, a new object each time, so what's made from them is made again. */
  private applyTune(module: string, values: Record<string, Value> | null, person: Id | null): void {
    const p = person !== null ? this.s.people[person] : undefined;
    if (person !== null && !p) return;
    const held = (p ? p.def.tune : this.s.tune) || {};
    const cur = held[module] || {};
    const next: Record<string, any> = values === null ? {} : { ...cur };
    for (const k of Object.keys(values || {})) {
      const v = (values as Record<string, Value>)[k];
      if (v === null) delete next[k]; else next[k] = v;
    }
    // how fast needs rise changes from now on: the rise so far is kept first, and when they turn urgent is looked at again after
    const rising = module === 'core' && ('needs' in cur || 'needs' in next) && cur.needs !== next.needs;
    const who: PersonState[] = [];
    if (rising) for (const id in this.s.people) { const q = this.s.people[id]; if (q.status !== 'gone' && (!p || q === p)) who.push(q); }
    for (const q of who) this.mind.settleRise(q);
    const all: Record<string, any> = { ...held };
    if (Object.keys(next).length) all[module] = next; else delete all[module];
    if (p) { if (Object.keys(all).length) p.def.tune = all; else delete p.def.tune; }
    else if (Object.keys(all).length) this.s.tune = all; else delete this.s.tune;
    for (const q of who) if (q.status === 'active' && q.doing) this.clock.scheduleChecks(q);
    this.log('tuned', person ?? undefined, { module, values });
  }

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

  /**
   * Listens for an event: 'embody', 'disembody', 'step', 'say', 'report'...
   * or '*' for all, which get `{ kind, ...payload, event }`: `event` is
   * always the event's name (`kind` is too, unless the payload has its own).
   */
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
    const outer = this.listenDepth;
    this.listening++;
    this.listenDepth = this.depth;
    try {
      for (const fn of a || []) fn(data);
      for (const fn of b || []) fn({ kind, ...data, event: kind });
    } finally { this.listening--; this.listenDepth = outer; }
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

  /**
   * Loads a saved world (migrating older saves). Declare places and actions
   * before or after. From a listener, it waits until the running call returns.
   */
  load(data: SaveData | string): void { this.whenFree(() => this.runLoad(data)); }

  private runLoad(data: SaveData | string): void {
    const d: SaveData = typeof data === 'string' ? JSON.parse(data) : data;
    const v = d.v ?? d.s.v ?? 1;
    if (v > SCHEMA) throw new Error(`Tyrell: save version ${v} is newer than this engine (${SCHEMA})`);
    // a copy: the world mustn't change the caller's save (a dawn loaded every loop)
    const s = migrate(typeof data === 'string' ? d.s : clone(d.s), v);
    this.s = s;
    for (const m of this.hooks) {
      if (m.init && this.s.mod[m.name] === undefined) this.s.mod[m.name] = m.init();
      m.loaded?.();
    }
    for (const def of this.ring.defs.values()) this.ring.state(def.id);
    this.esper.reset();
    if (d.history) {
      // the history's snapshots are states of the save's version too
      const h = d.history as { snaps?: Array<{ s: string }> };
      this.esper.import(v < SCHEMA && h.snaps ? { ...h, snaps: h.snaps.map((sn) => ({ ...sn, s: JSON.stringify(migrate(JSON.parse(sn.s), v)) })) } : h);
    }
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

  /**
   * Runs fn as a look: `chance:` conditions inside it draw from a stream
   * that changes nothing, so looking leaves the world as it was. The
   * engine's own looks (cityspeak.choose, whyNot, describe, Joi...) do this.
   */
  peek<T>(fn: () => T): T {
    this.looking++;
    try { return fn(); } finally { this.looking--; }
  }

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
    const fromGame = this.fromListener();
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
    this.runLater();
    return out;
  }

  /** Is the code running now a listener's own (game code), not engine work it set off? */
  private fromListener(): boolean { return this.listening > 0 && this.depth === this.listenDepth; }

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

  /**
   * Writes to the log and tells the game. Inside the simulation (modules,
   * effects, input handlers) it writes at once; from the game it's an input,
   * so the entry is recorded for time walk.
   */
  log(k: string, who?: Id, d?: Record<string, unknown>): void {
    const engine = !this.fromListener() && (this.depth > 0 || this.clock.handling !== null || this.replaying || this.moving > 0);
    if (engine) this.westmarch.write(k, who, d);
    else this.input('log', [k, who ?? null, d === undefined ? null : JSON.parse(JSON.stringify(d))]);
  }

  private makePerson(id: Id, def: PersonDef): PersonState {
    const needs: PersonState['needs'] = {};
    for (const [nid, nd] of this.needs) needs[nid] = { v: clamp(def.needs?.[nid] ?? nd.start ?? this.cfg.needStart), t: this.s.now };
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
    L.term('trait', (c, a) => c.person?.def.traits?.[a] ?? this.cfg.traitDefault);
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
    L.term('chance', (c, a) => {
      if (this.looking > 0) return this.worldStreamPeek('chance', c.person?.id ?? 'world', c.person?.n ?? this.s.n, this.s.now, c.action ?? '', c.place ?? '', a).chance(Number(a));
      return c.person ? this.stream(c.person).chance(Number(a)) : this.worldStream('chance').chance(Number(a));
    });
    L.term('target', (c, a) => {
      if (!c.target) return null;
      if (!a) return c.target;
      const t = this.s.people[c.target];
      return t ? this.lang.value(a, { ...c, person: t, target: c.person?.id ?? null }) : null;
    });
    L.term('person', (c) => c.person?.id ?? null);
    L.term('place', (c, a) => (a ? c.place === a : c.place ?? null));
    L.term('home', (c) => c.person?.def.home ?? null);
    L.term('habit', (c, a) => (c.person ? this.mind.habit(c.person, a || c.action || '') : 1));
    L.term('crowd', (c, a) => { const pl = a || c.place || c.person?.place; return pl ? this.ring.crowd(pl) : 0; });
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
      this.log(d ? 'directed' : 'released', id, d ? { do: d.do, ...(d.label ? { label: d.label } : {}) } : undefined);
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
    this.defineInput('log', (k: string, who: Id | null, d: Record<string, unknown> | null) => this.westmarch.write(k, who ?? undefined, d ?? undefined));
    this.defineInput('at', (t: number, name: string, data: Record<string, Value>) => {
      this.clock.schedule({ t, k: 'timer', ref: name, data });
    });
    this.defineInput('tune', (module: string, values: Record<string, Value> | null, person: Id | null) => this.applyTune(module, values, person));
  }
}

/** Is a value plain data that saves as it is (no functions, no undefined, no class instances, finite numbers)? */
function plain(v: unknown): boolean {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
  if (typeof v === 'number') return isFinite(v);
  if (Array.isArray(v)) return v.every(plain);
  if (typeof v === 'object') {
    const proto = Object.getPrototypeOf(v);
    return (proto === Object.prototype || proto === null) && Object.values(v as object).every(plain);
  }
  return false;
}

/** What kind of value a setting holds, for tune()'s check. */
const kindOf = (v: unknown): string => (Array.isArray(v) ? 'list' : v === null ? 'null' : typeof v);

/** Inputs that return a value, so they can't wait for an event to finish. */
const IMMEDIATE = new Set(['person', 'promote', 'say', 'birth', 'recollect', 'social', 'draw', 'afflict', 'voice.start', 'voice.answer']);

/** Save migrations: MIGRATIONS[v] turns a version-v state into version v+1. */
export const MIGRATIONS: Record<number, (s: any) => any> = {
  // 1 -> 2: Cityspeak remembers lines said by their key, not their index. The
  // old records are kept apart (it takes the line definitions to read them).
  1: (s) => {
    const cs = s.mod?.cityspeak;
    if (cs?.said && Object.keys(cs.said).length) { cs.byIndex = cs.said; cs.said = {}; }
    return s;
  },
};

/** Brings a saved state of version v up to the current schema. */
function migrate(s: any, v: number): WorldState {
  for (; v < SCHEMA; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`Tyrell: no migration from save version ${v}`);
    s = step(s);
  }
  s.v = SCHEMA;
  return s;
}

export { DAY, HOUR };
