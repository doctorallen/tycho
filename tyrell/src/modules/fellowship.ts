// Fellowship: how people stand with each other. Named for the Fellowship of
// the Ring.
//
//   regard       between any two people, one way (-1..1), grown by time spent
//                together and moved by deeds (Merryfolk's hearts)
//   attraction   a second track for romance (The Sims keeps them apart)
//   sentiments   up to four per relationship, each with a reason (The Sims 4)
//   compatibility hidden per pair, from the seed and shared values, so some
//                people just get on (RimWorld)
//   groups       households, families, factions, the police
//   standing     with each group: fame and infamy kept apart, so the same
//                people can like you and fear you (Fallout: New Vegas)
//   imitation    people pick up the habits of people they like
import type { Module } from '../core/module';
import type { Candidate, Id, PersonState, Value } from '../core/types';
import type { World } from '../core/world';
import { DAY, clamp, hash01, round } from '../core/util';

export interface GroupDef {
  id: Id;
  label?: string;
  /** 'household', 'family', 'faction', 'authority' (reports crimes), 'club'... */
  kind?: string;
  /** Members listed here, on top of people whose definitions name the group. */
  members?: Id[];
  /** Households: money is shared (Ceres). */
  purse?: boolean;
}

export interface Sentiment { label: string; by: number; until?: number }
export interface Rel { r: number; a: number; s: Sentiment[]; met: number; last: number }

interface State {
  rel: Record<string, Rel>;
  /** group -> subject -> [fame, infamy] */
  standing: Record<Id, Record<Id, [number, number]>>;
  partners: Record<Id, Id>;
  /** members added at runtime: group -> ids */
  joined: Record<Id, Id[]>;
}

export interface FellowshipConfig {
  /** Regard gained per half hour together, before compatibility and mood. */
  meetGain: number;
  /** How much compatibility varies between pairs (0..1). */
  compatSpread: number;
  /** Regard drifts back toward zero by this much a day. */
  decay: number;
  /** Most sentiments kept per relationship. */
  sentiments: number;
  /** How much a liked person's habits rub off. */
  imitation: number;
  /** Standing labels, by fame (rows: low, some, high) and infamy (columns). */
  labels: string[][];
}

export const DEFAULT_FELLOWSHIP: FellowshipConfig = {
  meetGain: 0.03, compatSpread: 0.6, decay: 0.004, sentiments: 4, imitation: 0.03,
  labels: [
    ['unknown', 'suspect', 'trouble', 'menace'],
    ['familiar', 'mixed', 'rough edges', 'feared'],
    ['liked', 'complicated', 'loved and feared', 'dangerous hero'],
    ['beloved', 'tolerated', 'wild card', 'legend'],
  ],
};

const key = (a: Id, b: Id): string => a + '>' + b;

export class Fellowship implements Module {
  readonly name = 'fellowship';
  readonly config: FellowshipConfig;
  readonly groups = new Map<Id, GroupDef>();
  private w!: World;

  constructor(cfg: Partial<FellowshipConfig> = {}) { this.config = { ...DEFAULT_FELLOWSHIP, ...cfg }; }

  init(): State { return { rel: {}, standing: {}, partners: {}, joined: {} }; }
  private get st(): State { return this.w.s.mod.fellowship as State; }

  attach(w: World): void {
    this.w = w;
    const L = w.lang;
    const other = (c: { target?: Id | null }, a: string): Id | null => (a && a !== 'target' ? a : c.target ?? null);
    L.term('regard', (c, a) => { const o = other(c, a); return c.person && o ? this.regard(c.person.id, o) : 0; });
    L.term('attraction', (c, a) => { const o = other(c, a); return c.person && o ? this.attraction(c.person.id, o) : 0; });
    L.term('compat', (c, a) => { const o = other(c, a); return c.person && o ? this.compat(c.person.id, o) : 0; });
    L.term('friend', (c, a) => { const o = other(c, a); return !!(c.person && o && this.regard(c.person.id, o) >= 0.5); });
    L.term('foe', (c, a) => { const o = other(c, a); return !!(c.person && o && this.regard(c.person.id, o) <= -0.4); });
    L.term('member', (c, a) => (c.person ? this.groupsOf(c.person.id).includes(a) : false));
    L.term('partner', (c, a) => (c.person ? (a ? this.partner(c.person.id) === a : this.partner(c.person.id) ?? null) : null));
    L.term('fame', (c, a) => { const [g, s] = a.split('.'); return this.standing(g, s || c.person?.id || 'player').fame; });
    L.term('infamy', (c, a) => { const [g, s] = a.split('.'); return this.standing(g, s || c.person?.id || 'player').infamy; });
    L.effect('regard', (c, a, op, v) => {
      const o = other(c, a);
      if (!c.person || !o) return;
      const cur = this.record(c.person.id, o);
      cur.r = round(clamp(op === '=' ? Number(v) : cur.r + (op === '-=' ? -1 : 1) * Number(v), -1, 1), 4);
    });
    L.effect('fame', (c, a, op, v) => { const [g, s] = a.split('.'); this.applyStanding(g, s || 'player', (op === '-=' ? -1 : 1) * Number(v), 0); void c; });
    L.effect('infamy', (c, a, op, v) => { const [g, s] = a.split('.'); this.applyStanding(g, s || 'player', 0, (op === '-=' ? -1 : 1) * Number(v)); void c; });
    w.defineInput('regard', (a: Id, b: Id, by: number, why: string | null) => this.applyRegard(a, b, by, why ?? undefined));
    w.defineInput('attraction', (a: Id, b: Id, by: number) => this.applyAttraction(a, b, by));
    w.defineInput('sentiment', (a: Id, b: Id, label: string, by: number, minutes: number | null) => this.applySentiment(a, b, label, by, minutes ?? undefined));
    w.defineInput('standing', (g: Id, subject: Id, fame: number, infamy: number) => this.applyStanding(g, subject, fame, infamy));
    w.defineInput('join', (g: Id, id: Id, on: boolean) => this.applyJoin(g, id, on));
    w.defineInput('partners', (a: Id, b: Id | null) => this.applyPartners(a, b));
  }

  // -------------------------------------------------------------------------
  // Groups
  // -------------------------------------------------------------------------

  group(def: GroupDef): this { this.groups.set(def.id, def); return this; }

  /** Everyone in a group. */
  members(g: Id): Id[] {
    const out = new Set<Id>(this.groups.get(g)?.members || []);
    for (const id of this.st.joined[g] || []) out.add(id);
    for (const p of Object.values(this.w.s.people)) if (p.status !== 'gone' && p.def.groups?.includes(g)) out.add(p.id);
    return [...out];
  }

  /** The groups a person belongs to. */
  groupsOf(id: Id): Id[] {
    const p = this.w.s.people[id];
    const out = new Set<Id>(p?.def.groups || []);
    for (const g of this.groups.values()) if (g.members?.includes(id)) out.add(g.id);
    for (const g in this.st.joined) if (this.st.joined[g].includes(id)) out.add(g);
    return [...out];
  }

  /** The household a person belongs to, if any. */
  household(id: Id): Id | undefined { return this.groupsOf(id).find((g) => this.groups.get(g)?.kind === 'household'); }

  join(g: Id, id: Id, on = true): void { this.w.input('join', [g, id, on]); }
  applyJoin(g: Id, id: Id, on: boolean): void {
    const list = (this.st.joined[g] ||= []);
    if (on && !list.includes(id)) list.push(id);
    if (!on) this.st.joined[g] = list.filter((x) => x !== id);
  }

  // -------------------------------------------------------------------------
  // Relationships
  // -------------------------------------------------------------------------

  /** The relationship record a -> b, or undefined if there's none (a copy: change it through the inputs). */
  rel(a: Id, b: Id): Rel | undefined {
    const r = this.st.rel[key(a, b)];
    return r ? { ...r, s: r.s.map((s) => ({ ...s })) } : undefined;
  }

  /** The relationship record a -> b, made if missing (inside the simulation). */
  private record(a: Id, b: Id): Rel {
    const k = key(a, b);
    let r = this.st.rel[k];
    if (!r) r = this.st.rel[k] = { r: 0, a: 0, s: [], met: 0, last: this.w.s.now };
    return r;
  }

  /** Has a met b (is there a record)? */
  knows(a: Id, b: Id): boolean { return !!this.st.rel[key(a, b)]; }

  /** a's regard for b, -1..1, sentiments included. */
  regard(a: Id, b: Id): number {
    const r = this.st.rel[key(a, b)];
    if (!r) return 0;
    const now = this.w.s.now;
    let v = r.r;
    for (const s of r.s) if (s.until === undefined || s.until > now) v += s.by;
    return round(clamp(v, -1, 1), 4);
  }

  attraction(a: Id, b: Id): number { return this.st.rel[key(a, b)]?.a ?? 0; }

  /** Changes a's attraction to b (from the game: recorded). */
  attract(a: Id, b: Id, by: number): void { this.w.input('attraction', [a, b, by]); }
  applyAttraction(a: Id, b: Id, by: number): void {
    const r = this.record(a, b);
    r.a = round(clamp(r.a + by, -1, 1), 4);
  }

  /** Hidden compatibility of a pair, -1..1 (the same both ways). */
  compat(a: Id, b: Id): number {
    const [x, y] = a < b ? [a, b] : [b, a];
    let c = (hash01(this.w.s.seed, 'compat', x, y) * 2 - 1) * this.config.compatSpread;
    const va = this.w.s.people[a]?.def.values, vb = this.w.s.people[b]?.def.values;
    if (va && vb) {
      let shared = 0, n = 0;
      for (const k in va) if (vb[k] !== undefined) { shared += 1 - Math.abs(va[k] - vb[k]) * 2; n++; }
      if (n) c += (shared / n) * 0.3;
    }
    return round(clamp(c, -1, 1), 4);
  }

  /** Everyone a person has a relationship with, best regard first. */
  relations(a: Id): Array<{ id: Id; regard: number; attraction: number; met: number }> {
    const out: Array<{ id: Id; regard: number; attraction: number; met: number }> = [];
    const pre = a + '>';
    for (const k in this.st.rel) if (k.startsWith(pre)) {
      const b = k.slice(pre.length);
      out.push({ id: b, regard: this.regard(a, b), attraction: this.st.rel[k].a, met: this.st.rel[k].met });
    }
    return out.sort((x, y) => y.regard - x.regard || (x.id < y.id ? -1 : 1));
  }

  /** The people a person likes most. */
  friends(a: Id, n = 3): Id[] { return this.relations(a).filter((r) => r.regard > 0.2).slice(0, n).map((r) => r.id); }

  /** Changes a's regard for b (from the game: recorded). */
  adjust(a: Id, b: Id, by: number, why?: string): void { this.w.input('regard', [a, b, by, why ?? null]); }
  applyRegard(a: Id, b: Id, by: number, why?: string): void {
    const r = this.record(a, b);
    r.r = round(clamp(r.r + by, -1, 1), 4);
    if (why) this.w.log('regard', a, { target: b, by, why });
  }

  /** Adds a sentiment a holds about b (replaces the weakest past the limit). */
  sentiment(a: Id, b: Id, label: string, by: number, minutes?: number): void { this.w.input('sentiment', [a, b, label, by, minutes ?? null]); }
  applySentiment(a: Id, b: Id, label: string, by: number, minutes?: number): void {
    const r = this.record(a, b);
    const now = this.w.s.now;
    r.s = r.s.filter((s) => (s.until === undefined || s.until > now) && s.label !== label);
    const s: Sentiment = { label, by: round(by, 4) };
    if (minutes !== undefined) s.until = now + minutes;
    r.s.push(s);
    if (r.s.length > this.config.sentiments) {
      r.s.sort((x, y) => Math.abs(y.by) - Math.abs(x.by));
      r.s.length = this.config.sentiments;
    }
    this.w.log('sentiment', a, { target: b, label, by });
  }

  sentiments(a: Id, b: Id): Sentiment[] {
    const now = this.w.s.now;
    return (this.st.rel[key(a, b)]?.s || []).filter((s) => s.until === undefined || s.until > now);
  }

  partner(a: Id): Id | undefined { return this.st.partners[a]; }
  /** Makes two people partners (or, with null, ends a's partnership). */
  setPartner(a: Id, b: Id | null): void { this.w.input('partners', [a, b]); }
  applyPartners(a: Id, b: Id | null): void {
    const old = this.st.partners[a];
    if (old) delete this.st.partners[old];
    delete this.st.partners[a];
    if (b) {
      const prev = this.st.partners[b];
      if (prev) delete this.st.partners[prev];
      this.st.partners[a] = b;
      this.st.partners[b] = a;
    }
  }

  // -------------------------------------------------------------------------
  // Standing
  // -------------------------------------------------------------------------

  /** A subject's standing with a group: fame and infamy (0..1 each) and a label. */
  standing(g: Id, subject: Id): { fame: number; infamy: number; label: string } {
    const [fame, infamy] = this.st.standing[g]?.[subject] || [0, 0];
    const band = (x: number) => (x < 0.15 ? 0 : x < 0.4 ? 1 : x < 0.7 ? 2 : 3);
    return { fame, infamy, label: this.config.labels[band(fame)][band(infamy)] };
  }

  /** Changes standing (from the game: recorded). */
  changeStanding(g: Id, subject: Id, fame: number, infamy: number): void { this.w.input('standing', [g, subject, fame, infamy]); }
  applyStanding(g: Id, subject: Id, fame: number, infamy: number): void {
    const map = (this.st.standing[g] ||= {});
    const [f0, i0] = map[subject] || [0, 0];
    map[subject] = [round(clamp(f0 + fame), 4), round(clamp(i0 + infamy), 4)];
  }

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------

  met(a: PersonState, b: PersonState, _place: Id, minutes: number): void {
    const rv = this.w.reverie;
    for (const [x, y] of [[a, b], [b, a]] as const) {
      const r = this.record(x.id, y.id);
      const mood = rv ? rv.mood(x.id) - 0.5 : 0;
      const gain = this.config.meetGain * (minutes / 30) * (1 + this.compat(x.id, y.id) + mood);
      r.r = round(clamp(r.r + clamp(gain, -0.05, 0.08), -1, 1), 4);
      if (this.compat(x.id, y.id) > 0.3 && this.partner(x.id) === undefined) r.a = round(clamp(r.a + gain * 0.5, -1, 1), 4);
      r.met++;
      r.last = this.w.s.now;
      // imitation: what a liked person is doing becomes a little more appealing
      if (y.doing && y.doing.kind === 'act' && this.regard(x.id, y.id) > 0.3) {
        const h = x.habits[y.doing.action] || [1, 1];
        x.habits[y.doing.action] = [round(clamp(h[0] + this.config.imitation, this.w.config.habitMin, this.w.config.habitMax), 5), h[1]];
      }
    }
    this.w.log('met', a.id, { target: b.id, minutes: Math.round(minutes) });
  }

  consider(p: PersonState, c: Candidate): Array<[string, number]> | void {
    if (!c.target) return;
    const a = this.w.actions.get(c.id);
    if (!a?.tags?.includes('social')) return;
    return [['regard', round(clamp(1 + this.regard(p.id, c.target) * 0.8 + this.compat(p.id, c.target) * 0.2, 0.1, 2), 4)]];
  }

  did(actor: Id, verb: string, data: Record<string, Value>): void {
    const deed = this.w.deeds.get(verb);
    if (!deed) return;
    const target = (data.for ?? data.to ?? data.target) as Id | undefined;
    if (target) {
      if (deed.regard) this.applyRegard(target, actor, deed.regard);
      if (deed.sentiment) this.applySentiment(target, actor, deed.sentiment, deed.regard ?? 0.1);
      if (deed.fame || deed.infamy) for (const g of this.groupsOf(target)) this.applyStanding(g, actor, deed.fame ?? 0, deed.infamy ?? 0);
    }
    const seen = Array.isArray(data.seenBy) ? (data.seenBy as unknown as Id[]) : [];
    for (const wid of seen) if (wid !== target && deed.regard) this.applyRegard(wid, actor, deed.regard * 0.4);
  }

  day(): void {
    const d = this.config.decay;
    for (const k in this.st.rel) {
      const r = this.st.rel[k];
      if (Math.abs(r.r) <= d) r.r = 0; else r.r = round(r.r - Math.sign(r.r) * d, 4);
      const now = this.w.s.now;
      r.s = r.s.filter((s) => s.until === undefined || s.until > now);
    }
  }

  removed(p: PersonState): void {
    const partner = this.st.partners[p.id];
    if (partner) { delete this.st.partners[partner]; delete this.st.partners[p.id]; }
  }
}

export { DAY };
