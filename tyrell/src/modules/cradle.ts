// Cradle: the course of a life. Named for Westworld's Cradle, where the hosts'
// minds are kept and new ones made.
//
//   ages and stages  baby, child, teen, adult, elder (or whatever the game sets)
//   couples          from regard and attraction, or the game's say-so
//   births           to couples of the right age, now and then; children
//                    inherit their parents' traits, blended, with a little
//                    of their own (Merryfolk's genetics)
//   departures       dying of old age, leaving town: the money goes to the
//                    household or the family, and those who cared grieve
import type { Module } from '../core/module';
import type { Id, PersonDef, PersonState } from '../core/types';
import type { World } from '../core/world';
import { DAY, Stream, clamp, round } from '../core/util';

export interface CradleConfig {
  /** Minutes in a year (default 365 days). Merryfolk's year is 12 days. */
  year: number;
  /** Stages and the age (in years) each starts at. */
  stages: Array<[string, number]>;
  /** People die of old age between these ages (years). */
  lifespan: [number, number];
  /** Chance per year a couple of the right age has a child. */
  fertility: number;
  /** The ages (years) at which people have children. */
  fertile: [number, number];
  /** Couples form on their own when regard and attraction both pass these (null to leave it to the game). */
  autoPair: { regard: number; attraction: number } | null;
}

export const DEFAULT_CRADLE: CradleConfig = {
  year: 365 * DAY,
  stages: [['baby', 0], ['child', 3], ['teen', 13], ['adult', 18], ['elder', 65]],
  lifespan: [72, 96],
  fertility: 0.25,
  fertile: [20, 42],
  autoPair: { regard: 0.6, attraction: 0.5 },
};

interface Departed { name: string; born?: number; left: number; why: string }
interface State { stage: Record<Id, string>; parents: Record<Id, Id[]>; departed: Record<Id, Departed>; next: number }

export class Cradle implements Module {
  readonly name = 'cradle';
  readonly config: CradleConfig;
  /** Names a newborn: set this to your game's namer. */
  namer: (r: Stream, parents: PersonState[]) => string = (r) => 'Baby ' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[r.int(26)];
  /** Fills in a newborn's definition (look, home): set this for your game. */
  template: (r: Stream, parents: PersonState[]) => PersonDef = () => ({});
  private w!: World;

  constructor(cfg: Partial<CradleConfig> = {}) { this.config = { ...DEFAULT_CRADLE, ...cfg }; }

  init(): State { return { stage: {}, parents: {}, departed: {}, next: 0 }; }
  private get st(): State { return this.w.s.mod.cradle as State; }

  attach(w: World): void {
    this.w = w;
    w.lang.term('age', (c) => (c.person ? this.age(c.person.id) : 0));
    w.lang.term('stage', (c, a) => (c.person ? (a ? this.stage(c.person.id) === a : this.stage(c.person.id)) : null));
    w.lang.term('married', (c) => !!(c.person && w.fellowship?.partner(c.person.id)));
    w.defineInput('birth', (parents: Id[], def: PersonDef | null, id: Id | null) => this.applyBirth(parents, def ?? {}, id));
    w.defineInput('pair', (a: Id, b: Id) => this.applyPair(a, b));
    w.defineInput('depart', (id: Id, why: string) => this.applyDepart(id, why));
  }

  // -------------------------------------------------------------------------
  // Ages
  // -------------------------------------------------------------------------

  /** Age in years (fractional). */
  age(id: Id): number {
    const p = this.w.s.people[id];
    if (!p || p.born === undefined) return 30;
    return round((this.w.s.now - p.born) / this.config.year, 3);
  }

  stage(id: Id): string {
    const age = this.age(id);
    let out = this.config.stages[0]?.[0] ?? 'adult';
    for (const [name, from] of this.config.stages) if (age >= from) out = name;
    return out;
  }

  /** Who someone's parents are. */
  parents(id: Id): Id[] { return this.st.parents[id]?.slice() ?? []; }
  /** Who someone's children are. */
  children(id: Id): Id[] { return Object.keys(this.st.parents).filter((c) => this.st.parents[c].includes(id)); }
  /** Everyone who has left, and why. */
  departed(): Record<Id, Departed> { return this.st.departed; }

  // -------------------------------------------------------------------------
  // Couples, births, departures
  // -------------------------------------------------------------------------

  /** Pairs two people up (from the game: recorded). */
  pair(a: Id, b: Id): void { this.w.input('pair', [a, b]); }
  private applyPair(a: Id, b: Id): void {
    const f = this.w.fellowship;
    if (!f) return;
    f.applyPartners(a, b);
    f.applySentiment(a, b, 'my partner', 0.3);
    f.applySentiment(b, a, 'my partner', 0.3);
    this.w.log('paired', a, { target: b });
    this.w.emit('paired', { a, b });
  }

  /** A child is born to these parents. Returns the child's id. */
  birth(parents: Id[], def: PersonDef = {}, id?: Id): Id { return this.w.input('birth', [parents, def, id ?? null]) as Id; }

  private applyBirth(parentIds: Id[], def: PersonDef, given: Id | null): Id {
    const w = this.w;
    const parents = parentIds.map((id) => w.s.people[id]).filter(Boolean) as PersonState[];
    const id = given ?? `born${++this.st.next}`;
    const r = new Stream(w.s.seed, 'birth', id);
    // traits: the parents' average, plus a little of their own
    const traits: Record<string, number> = {};
    const keys = new Set<string>();
    for (const p of parents) for (const k in p.def.traits || {}) keys.add(k);
    for (const k of [...keys].sort()) {
      const vals = parents.map((p) => p.def.traits?.[k]).filter((v): v is number => v !== undefined);
      const avg = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
      traits[k] = round(clamp(avg + r.range(-0.12, 0.12)), 3);
    }
    const tpl = this.template(r, parents);
    const home = def.home ?? tpl.home ?? parents[0]?.def.home;
    const groups = [...new Set([...(def.groups || []), ...(tpl.groups || []), ...parents.flatMap((p) => (w.fellowship?.household(p.id) ? [w.fellowship.household(p.id) as Id] : []))])];
    const child: PersonDef = {
      ...tpl, ...def,
      name: def.name ?? tpl.name ?? this.namer(r, parents),
      traits: { ...traits, ...(tpl.traits || {}), ...(def.traits || {}) },
      home, groups, born: w.s.now, place: home,
      tags: [...(tpl.tags || []), ...(def.tags || []), 'born'],
    };
    w.input('person', [id, child]);
    this.st.parents[id] = parents.map((p) => p.id);
    this.st.stage[id] = this.stage(id);
    if (w.fellowship) for (const p of parents) { w.fellowship.applySentiment(p.id, id, 'my child', 0.5); }
    w.log('born', id, { parents: parents.map((p) => p.id) });
    w.emit('born', { id, parents: parents.map((p) => p.id) });
    return id;
  }

  /** Someone leaves for good ('died', 'moved away'...). Money passes on; those who cared grieve. */
  depart(id: Id, why = 'left'): void { this.w.input('depart', [id, why]); }

  private applyDepart(id: Id, why: string): void {
    const w = this.w;
    const p = w.s.people[id];
    if (!p || p.status === 'gone') return;
    // grief, by how much they were cared for
    if (w.reverie && w.fellowship) {
      for (const o of w.people()) {
        if (o.id === id) continue;
        const regard = w.fellowship.regard(o.id, id);
        if (regard >= 0.35) {
          w.reverie.applyFeel(o.id, 'grief', p.name);
          w.reverie.applyRemember(o.id, { k: 'loss', about: id, imp: clamp(Math.round(regard * 10), 5, 10), text: `${p.name} ${why}` });
        }
      }
    }
    // inheritance: partner, then children, then the household purse
    const money = Number(p.vars.money ?? 0);
    if (money > 0) {
      const heirs = [w.fellowship?.partner(id), ...this.children(id)].filter((h): h is Id => !!h && w.s.people[h]?.status === 'active');
      if (heirs.length) {
        const share = round(money / heirs.length, 2);
        for (const h of heirs) w.s.people[h].vars.money = round(Number(w.s.people[h].vars.money ?? 0) + share, 2);
      } else if (w.ceres) {
        const hh = w.fellowship?.household(id);
        if (hh) w.ceres.applyPay(id, hh, money, 'inheritance');
      }
      p.vars.money = 0;
    }
    this.st.departed[id] = { name: p.name, ...(p.born !== undefined ? { born: p.born } : {}), left: w.s.now, why };
    w.clock.removePerson(id, why);
  }

  // -------------------------------------------------------------------------
  // Daily
  // -------------------------------------------------------------------------

  day(): void {
    const w = this.w, c = this.config, st = this.st;
    const yearDays = c.year / DAY;
    const people = w.people();
    for (const p of people) {
      if (p.born === undefined) continue;
      const stage = this.stage(p.id);
      if (st.stage[p.id] !== stage) {
        const was = st.stage[p.id];
        st.stage[p.id] = stage;
        if (was) { w.log('stage', p.id, { from: was, to: stage }); w.emit('stage', { id: p.id, from: was, to: stage }); }
      }
      // old age
      const age = this.age(p.id);
      if (age >= c.lifespan[0]) {
        const span = Math.max(1, c.lifespan[1] - c.lifespan[0]);
        const pDie = clamp((age - c.lifespan[0]) / span) * 2 / (span * yearDays) + (age >= c.lifespan[1] ? 0.2 : 0);
        if (w.stream(p).chance(pDie)) this.applyDepart(p.id, 'died');
      }
    }
    const f = w.fellowship;
    if (!f) return;
    // couples forming on their own
    if (c.autoPair) {
      for (const p of people) {
        if (p.status !== 'active' || f.partner(p.id) || this.stage(p.id) !== 'adult' && this.stage(p.id) !== 'elder') continue;
        for (const r of f.relations(p.id)) {
          const o = w.s.people[r.id];
          if (!o || o.status !== 'active' || f.partner(o.id) || o.id === p.id) continue;
          if (this.stage(o.id) !== 'adult' && this.stage(o.id) !== 'elder') continue;
          if (r.regard >= c.autoPair.regard && r.attraction >= c.autoPair.attraction && f.regard(o.id, p.id) >= c.autoPair.regard && f.attraction(o.id, p.id) >= c.autoPair.attraction) {
            this.applyPair(p.id, o.id);
            break;
          }
        }
      }
    }
    // births
    const seen = new Set<Id>();
    for (const p of people) {
      const q = f.partner(p.id);
      if (!q || seen.has(p.id) || p.status !== 'active') continue;
      seen.add(p.id); seen.add(q);
      const o = w.s.people[q];
      if (!o || o.status !== 'active') continue;
      const ages = [this.age(p.id), this.age(q)];
      if (ages.some((a) => a < c.fertile[0] || a > c.fertile[1])) continue;
      if (w.stream(p).chance(c.fertility / yearDays)) this.applyBirth([p.id, q], {}, null);
    }
  }

  removed(p: PersonState, why: string): void {
    if (!this.st.departed[p.id]) this.st.departed[p.id] = { name: p.name, ...(p.born !== undefined ? { born: p.born } : {}), left: this.w.s.now, why };
  }
}
