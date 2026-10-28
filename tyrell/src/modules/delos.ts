// Delos: genomes. Named for Westworld's Delos, the company that kept a copy
// of everyone who came to the parks, and made new people from the copies.
//
//   genes      looks carried as alleles, two copies (one from each parent)
//              or one (taken whole from either), shown by dominance: brown
//              eyes over blue, so blue can skip a generation and come back
//   traits     personality, blended from both parents with a little of the
//              child's own: one parent's value for the most part, the
//              parents' average for the rest, and a small draw either way
//   talents    how fast someone learns each skill (Tyrell's skills read them)
//   instincts  inborn tastes: standing multipliers on actions' weight
//   looks      continuous looks (a skin tone), blended the same way
//   mutations  now and then a trait jumps, a talent turns out a gift, or an
//              allele turns into another; each is kept with the genome
//
// The genome is state (in world.s.mod.delos), and what it means for the
// person (traits, talents, instincts) is written into their definition, so
// the rest of Tyrell reads it as it reads anything a game declares. Founders
// get a genome drawn from the founders' ranges when they join; Cradle's
// births inherit one from the parents. Merryfolk's genetics, generalized.
//
// Every draw comes from a stream of the world's seed and the person's id, so
// the same seed makes the same people. Nothing is kept until there's
// something declared, so a world without genes hashes as if Delos were off.
import type { Module } from '../core/module';
import type { Id, PersonState, Value } from '../core/types';
import type { World } from '../core/world';
import { Stream, clamp, round } from '../core/util';

/** A gene: alleles, most dominant first. */
export interface GeneDef {
  id: Id;
  label?: string;
  /** The alleles, most dominant first. */
  alleles: string[];
  /** How common each allele is among founders (the same order). Default even. */
  weights?: number[];
  /** Two copies, one from each parent (default), or one, taken whole from either parent. */
  copies?: 1 | 2;
  /** What shows, from the copies carried. Default: the most dominant allele carried. */
  express?: (alleles: string[]) => Value;
  /** The chance, per child, that one copy turns into another allele (drawn by `weights`). Default 0. */
  mutate?: number;
}

/** A value blended from both parents: a trait, a talent, an instinct or a continuous look. */
export interface BlendDef {
  id: Id;
  label?: string;
  /** Founders' values are drawn from this range. */
  founders?: [number, number];
  /** Values are kept in this range. */
  bounds?: [number, number];
  /** The share of a child's value taken from one parent, picked at random; the rest is the parents' average. */
  cross?: number;
  /** A child's value moves by up to this much either way. */
  noise?: number;
  /** Whole numbers only (a tone from a palette). */
  round?: boolean;
  /** What the person gets from the genome's value (an aptitude of 0.5 might mean learning at 1.0 times the rate). Default: the value. */
  express?: (v: number) => number;
}

type Kind = 'traits' | 'talents' | 'instincts' | 'looks';

/** Defaults for each kind of blended value. */
const DEFAULTS: Record<Kind, Required<Pick<BlendDef, 'founders' | 'bounds' | 'cross' | 'noise'>>> = {
  traits: { founders: [0.1, 0.9], bounds: [0, 1], cross: 0.65, noise: 0.1 },
  talents: { founders: [0.6, 1.4], bounds: [0.2, 2], cross: 0.7, noise: 0.08 },
  instincts: { founders: [0.8, 1.25], bounds: [0.5, 1.5], cross: 0, noise: 0.1 },
  looks: { founders: [0, 1], bounds: [0, 1], cross: 0.65, noise: 0.1 },
};

/** A mutation, kept with the genome it happened in. */
export interface Mutation { kind: 'gene' | 'trait' | 'talent'; id: Id; by?: number; to?: string }

/** Someone's genome. */
export interface Genome {
  genes: Record<Id, string[]>;
  traits: Record<Id, number>;
  talents: Record<Id, number>;
  instincts: Record<Id, number>;
  looks: Record<Id, number>;
  mut?: Mutation[];
}

export interface DelosConfig {
  /** A child's chance that one trait jumps by `by`, up or down. */
  jump: { chance: number; by: number };
  /** A child's chance of a natural gift: one talent raised by `by`. */
  gift: { chance: number; by: number };

  // The headline knobs: plain multipliers, 1 changing nothing (the world's
  // only: a child's genome is made before they're anyone).
  /** How often genomes mutate: the chance of a trait jump, of a gift, and every gene's `mutate`. 0: never. Default 1. */
  mutation: number;
  /** How far children stray from their parents: every blended value's noise. 0: a child is exactly the blend. Default 1. */
  variation: number;

  /**
   * The defaults for each kind of blended value, for a trait, talent,
   * instinct or look that doesn't say its own: founders' range, bounds,
   * cross and noise (BlendDef). Give any of them; the rest stay as they were.
   */
  traitBlend: Partial<Pick<BlendDef, 'founders' | 'bounds' | 'cross' | 'noise'>>;
  talentBlend: Partial<Pick<BlendDef, 'founders' | 'bounds' | 'cross' | 'noise'>>;
  instinctBlend: Partial<Pick<BlendDef, 'founders' | 'bounds' | 'cross' | 'noise'>>;
  lookBlend: Partial<Pick<BlendDef, 'founders' | 'bounds' | 'cross' | 'noise'>>;
}

export const DEFAULT_DELOS: DelosConfig = {
  jump: { chance: 0.12, by: 0.35 }, gift: { chance: 0.1, by: 0.4 }, mutation: 1, variation: 1,
  traitBlend: { ...DEFAULTS.traits }, talentBlend: { ...DEFAULTS.talents }, instinctBlend: { ...DEFAULTS.instincts }, lookBlend: { ...DEFAULTS.looks },
};

/** Which config field holds each kind's defaults. */
const BLEND: Record<Kind, 'traitBlend' | 'talentBlend' | 'instinctBlend' | 'lookBlend'> = { traits: 'traitBlend', talents: 'talentBlend', instincts: 'instinctBlend', looks: 'lookBlend' };

interface State { g: Record<Id, Genome> }

export class Delos implements Module {
  readonly name = 'delos';
  readonly config: DelosConfig;
  readonly knobs = { mutation: 'world', variation: 'world' } as const;
  readonly genes = new Map<Id, GeneDef>();
  readonly blends: Record<Kind, Map<Id, BlendDef>> = { traits: new Map(), talents: new Map(), instincts: new Map(), looks: new Map() };
  private w!: World;

  constructor(cfg: Partial<DelosConfig> = {}) { this.config = { ...DEFAULT_DELOS, ...cfg }; }

  private get st(): State | undefined { return this.w.s.mod.delos as State | undefined; }
  /** The config in force: as declared, under any world.tune. */
  private get c(): DelosConfig { return this.w.tuned(this.name, this.config); }
  private mut(): State { return (this.w.s.mod.delos ||= { g: {} }) as State; }

  attach(w: World): void {
    this.w = w;
    w.lang.term('gene', (c, a) => (c.person ? this.express(c.person.id, a) ?? null : null));
    w.lang.term('carries', (c, a) => {
      if (!c.person) return false;
      const i = a.indexOf('.');
      return i > 0 ? this.carries(c.person.id, a.slice(0, i), a.slice(i + 1)) : false;
    });
    w.defineInput('genome', (id: Id, part: Partial<Genome>) => this.applySet(id, part));
  }

  // -------------------------------------------------------------------------
  // Declaring
  // -------------------------------------------------------------------------

  gene(def: GeneDef): this { this.genes.set(def.id, def); return this; }
  /** A personality trait carried in the genome (written to PersonDef.traits). */
  trait(def: BlendDef): this { this.blends.traits.set(def.id, def); return this; }
  /** A talent for a skill: how fast it's learned (written to PersonDef.talents). */
  talent(def: BlendDef): this { this.blends.talents.set(def.id, def); return this; }
  /** An inborn taste for an action or task (written to PersonDef.instincts). */
  instinct(def: BlendDef): this { this.blends.instincts.set(def.id, def); return this; }
  /** A continuous look, like a skin tone (read with looks()). */
  look(def: BlendDef): this { this.blends.looks.set(def.id, def); return this; }

  /** Is anything declared? Without, Delos does nothing (and Cradle blends traits its own way). */
  active(): boolean {
    return this.genes.size > 0 || this.blends.traits.size > 0 || this.blends.talents.size > 0 || this.blends.instincts.size > 0 || this.blends.looks.size > 0;
  }

  // -------------------------------------------------------------------------
  // Asking
  // -------------------------------------------------------------------------

  /** Someone's genome (a copy), or undefined if they have none. */
  genome(id: Id): Genome | undefined {
    const g = this.st?.g[id];
    return g ? JSON.parse(JSON.stringify(g)) : undefined;
  }

  /** What a gene shows for someone (undefined without a genome or the gene). */
  express(id: Id, gene: Id): Value | undefined {
    const copies = this.st?.g[id]?.genes[gene];
    const def = this.genes.get(gene);
    if (!copies || !def) return undefined;
    if (def.express) return def.express(copies.slice());
    for (const a of def.alleles) if (copies.includes(a)) return a;
    return copies[0];
  }

  /** Does someone carry an allele (showing or not)? */
  carries(id: Id, gene: Id, allele: string): boolean { return !!this.st?.g[id]?.genes[gene]?.includes(allele); }

  /** Everything someone looks like: each gene as it shows, and the continuous looks. */
  looks(id: Id): Record<Id, Value> {
    const g = this.st?.g[id];
    const out: Record<Id, Value> = {};
    if (!g) return out;
    for (const gene of [...this.genes.keys()].sort()) { const v = this.express(id, gene); if (v !== undefined) out[gene] = v; }
    for (const k of [...this.blends.looks.keys()].sort()) if (g.looks[k] !== undefined) out[k] = this.expressed('looks', k, g.looks[k]);
    return out;
  }

  // -------------------------------------------------------------------------
  // Making genomes
  // -------------------------------------------------------------------------

  private settings(kind: Kind, def: BlendDef): Required<Pick<BlendDef, 'founders' | 'bounds' | 'cross' | 'noise'>> {
    const d = DEFAULTS[kind], g = this.c[BLEND[kind]];
    return { founders: def.founders ?? g.founders ?? d.founders, bounds: def.bounds ?? g.bounds ?? d.bounds, cross: def.cross ?? g.cross ?? d.cross, noise: def.noise ?? g.noise ?? d.noise };
  }

  private fit(kind: Kind, def: BlendDef, v: number): number {
    const { bounds } = this.settings(kind, def);
    const x = clamp(v, bounds[0], bounds[1]);
    return def.round ? Math.round(x) : round(x, 4);
  }

  private expressed(kind: Kind, id: Id, v: number): number {
    const def = this.blends[kind].get(id);
    return def?.express ? round(def.express(v), 4) : v;
  }

  private allele(def: GeneDef, r: Stream): string {
    const w = def.weights;
    return w && w.length === def.alleles.length ? (r.weighted(def.alleles, (a) => w[def.alleles.indexOf(a)]) as string) : (r.pick(def.alleles) as string);
  }

  /** A founder's genome: drawn from the founders' ranges, keeping any value their definition already gives. */
  private founder(p: PersonState | undefined, id: Id): Genome {
    const r = new Stream(this.w.s.seed, 'delos', id);
    const g: Genome = { genes: {}, traits: {}, talents: {}, instincts: {}, looks: {} };
    for (const gid of [...this.genes.keys()].sort()) {
      const def = this.genes.get(gid) as GeneDef;
      const n = def.copies === 1 ? 1 : 2;
      g.genes[gid] = Array.from({ length: n }, () => this.allele(def, r));
    }
    const given: Record<Kind, Record<Id, number> | undefined> = { traits: p?.def.traits, talents: p?.def.talents, instincts: p?.def.instincts, looks: undefined };
    for (const kind of ['traits', 'talents', 'instincts', 'looks'] as Kind[]) {
      for (const k of [...this.blends[kind].keys()].sort()) {
        const def = this.blends[kind].get(k) as BlendDef;
        const { founders } = this.settings(kind, def);
        const drawn = r.range(founders[0], founders[1]);
        const have = given[kind]?.[k];
        g[kind][k] = have !== undefined ? have : this.fit(kind, def, drawn);
      }
    }
    return g;
  }

  /** Writes what a genome means (traits, talents, instincts) into the person's definition, keeping what it already says. */
  private writeDef(p: PersonState, g: Genome, overwrite: boolean): void {
    const set = (field: 'traits' | 'talents' | 'instincts') => {
      const keys = Object.keys(g[field]).sort();
      if (!keys.length) return;
      const out = (p.def[field] ||= {});
      for (const k of keys) if (overwrite || out[k] === undefined) out[k] = this.expressed(field, k, g[field][k]);
    };
    set('traits'); set('talents'); set('instincts');
  }

  /** Gives someone a founder's genome if they have none (inside the simulation). Returns it. */
  applyFounder(id: Id): Genome {
    const st = this.mut();
    const have = st.g[id];
    if (have) return have;
    const p = this.w.s.people[id];
    const g = this.founder(p, id);
    st.g[id] = g;
    if (p) this.writeDef(p, g, false);
    return g;
  }

  /**
   * A child's genome from its parents' (inside the simulation; Cradle calls
   * it for a birth before the child joins). Parents without a genome get a
   * founder's first. Returns what it means for the child's definition.
   */
  applyInherit(parentIds: Id[], child: Id): { traits: Record<Id, number>; talents: Record<Id, number>; instincts: Record<Id, number> } {
    const w = this.w;
    const ps = parentIds.filter((id) => w.s.people[id] || this.st?.g[id]).map((id) => this.applyFounder(id));
    if (!ps.length) {
      const g = this.applyFounder(child);
      return this.meaning(g);
    }
    const [a, b] = [ps[0], ps[1] ?? ps[0]];
    const r = new Stream(w.s.seed, 'delos', 'birth', child);
    const g: Genome = { genes: {}, traits: {}, talents: {}, instincts: {}, looks: {} };
    const mut: Mutation[] = [];
    const cfg = this.c;
    for (const gid of [...this.genes.keys()].sort()) {
      const def = this.genes.get(gid) as GeneDef;
      const from = (x: Genome) => { const c = x.genes[gid]; return c && c.length ? (r.pick(c) as string) : this.allele(def, r); };
      const copies = def.copies === 1 ? [from(r.chance(0.5) ? a : b)] : [from(a), from(b)];
      if (def.mutate && r.chance(def.mutate * cfg.mutation)) {
        const i = r.int(copies.length);
        const to = this.allele(def, r);
        if (to !== copies[i]) { copies[i] = to; mut.push({ kind: 'gene', id: gid, to }); }
      }
      g.genes[gid] = copies;
    }
    for (const kind of ['traits', 'talents', 'instincts', 'looks'] as Kind[]) {
      for (const k of [...this.blends[kind].keys()].sort()) {
        const def = this.blends[kind].get(k) as BlendDef;
        const { founders, cross, noise } = this.settings(kind, def);
        const va = a[kind][k] ?? r.range(founders[0], founders[1]);
        const vb = b[kind][k] ?? r.range(founders[0], founders[1]);
        const one = r.chance(0.5) ? va : vb;
        const n = noise * cfg.variation;
        g[kind][k] = this.fit(kind, def, one * cross + ((va + vb) / 2) * (1 - cross) + r.range(-n, n));
      }
    }
    // a trait that jumps, a talent that turns out a gift
    const traits = [...this.blends.traits.keys()].sort();
    if (traits.length && r.chance(cfg.jump.chance * cfg.mutation)) {
      const k = traits[r.int(traits.length)];
      const by = r.chance(0.5) ? cfg.jump.by : -cfg.jump.by;
      const before = g.traits[k];
      g.traits[k] = this.fit('traits', this.blends.traits.get(k) as BlendDef, before + by);
      mut.push({ kind: 'trait', id: k, by: round(g.traits[k] - before, 4) });
    }
    const talents = [...this.blends.talents.keys()].sort();
    if (talents.length && r.chance(cfg.gift.chance * cfg.mutation)) {
      const k = talents[r.int(talents.length)];
      const before = g.talents[k];
      g.talents[k] = this.fit('talents', this.blends.talents.get(k) as BlendDef, before + cfg.gift.by);
      mut.push({ kind: 'talent', id: k, by: round(g.talents[k] - before, 4) });
    }
    if (mut.length) g.mut = mut;
    this.mut().g[child] = g;
    for (const m of mut) {
      const d = { kind: m.kind, what: m.id, ...(m.by !== undefined ? { by: m.by } : {}), ...(m.to !== undefined ? { to: m.to } : {}) };
      w.log('mutated', child, d);
      w.emit('mutated', { id: child, ...d });
    }
    return this.meaning(g);
  }

  /** What a genome means for a definition: its traits, talents and instincts, expressed. */
  private meaning(g: Genome): { traits: Record<Id, number>; talents: Record<Id, number>; instincts: Record<Id, number> } {
    const out = { traits: {} as Record<Id, number>, talents: {} as Record<Id, number>, instincts: {} as Record<Id, number> };
    for (const kind of ['traits', 'talents', 'instincts'] as const) for (const k of Object.keys(g[kind]).sort()) out[kind][k] = this.expressed(kind, k, g[kind][k]);
    return out;
  }

  /** Sets parts of someone's genome (an imported traveler, a game's own founders): from the game, recorded. */
  set(id: Id, part: Partial<Genome>): void { this.w.input('genome', [id, JSON.parse(JSON.stringify(part))]); }

  /** Sets parts of a genome inside the simulation, and writes what they mean into the definition. */
  applySet(id: Id, part: Partial<Genome>): void {
    const g = this.applyFounder(id);
    for (const gid in part.genes || {}) g.genes[gid] = (part.genes as Record<Id, string[]>)[gid].slice();
    for (const kind of ['traits', 'talents', 'instincts', 'looks'] as Kind[]) for (const k in part[kind] || {}) g[kind][k] = (part[kind] as Record<Id, number>)[k];
    const p = this.w.s.people[id];
    if (!p) return;
    const m = this.meaning(g);
    for (const kind of ['traits', 'talents', 'instincts'] as const) {
      const given = part[kind];
      if (!given) continue;
      const out = (p.def[kind] ||= {});
      for (const k in given) out[k] = m[kind][k] ?? given[k];
    }
  }

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------

  /** A founder gets a genome when they join (a child born through Cradle already has one). */
  added(p: PersonState): void {
    if (!this.active() || this.st?.g[p.id]) return;
    this.applyFounder(p.id);
  }
}
