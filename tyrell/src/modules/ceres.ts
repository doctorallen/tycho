// Ceres: money and goods. Named for The Expanse's station that lives on
// trade, water and air.
//
//   money     each person's own, or a household's shared purse
//   prices    paid when an action starts, to whoever owns the place
//   stock     places sell goods from stock, which runs out and restocks
//   wages     paid per hour for work, at the end of a stint
//   goods     have a kind, so a need can be met by any of several (Victoria 3)
//   rent      due every so many days; missing it is felt, and remembered
//   affording people weigh prices against what they have, by thrift
import type { Module } from '../core/module';
import type { Candidate, Doing, Id, PersonState, Value } from '../core/types';
import type { World } from '../core/world';
import { DAY, HOUR, clamp, round } from '../core/util';

export interface GoodDef {
  id: Id;
  /** A kind of good: 'food', 'drink', 'part'... */
  kind?: string;
  price?: number;
  /** Needs it meets when used up: { hunger: 0.4 }. */
  satisfies?: Record<Id, number>;
  label?: string;
}

interface Rent { amount: number; every: number; next: number; to?: Id }
interface State { purses: Record<Id, number>; pantry: Record<Id, Record<Id, number>>; rent: Record<Id, Rent>; income?: Record<Id, Rent>; ledger: Array<{ t: number; from: Id; to: Id; amount: number; why: string }> }

export class Ceres implements Module {
  readonly name = 'ceres';
  readonly goods = new Map<Id, GoodDef>();
  private w!: World;

  init(): State { return { purses: {}, pantry: {}, rent: {}, ledger: [] }; }
  private get st(): State { return this.w.s.mod.ceres as State; }

  attach(w: World): void {
    this.w = w;
    w.lang.term('purse', (c) => (c.person ? this.money(c.person.id) : 0));
    w.lang.term('price', (_c, a) => this.goods.get(a)?.price ?? 0);
    w.lang.term('stock', (c, a) => { const [pl, item] = a.includes('.') ? a.split('.') : [c.place ?? '', a]; return this.stock(pl, item); });
    w.lang.term('afford', (c, a) => (c.person ? this.money(c.person.id) >= Number(a) : false));
    w.lang.effect('pay', (c, a, _op, v) => { if (c.person) this.transfer(c.person.id, a || 'world', Number(v ?? 0), 'pay'); });
    w.defineInput('pay', (from: Id, to: Id, amount: number, why: string) => this.transfer(from, to, amount, why));
    w.defineInput('rent', (id: Id, amount: number, everyDays: number, to: Id | null) => {
      this.st.rent[id] = { amount, every: everyDays, next: Math.ceil((w.s.now + everyDays * DAY) / DAY) * DAY, ...(to ? { to } : {}) };
    });
    w.defineInput('income', (id: Id, amount: number, everyDays: number, from: Id | null) => {
      (this.st.income ||= {})[id] = { amount, every: everyDays, next: Math.ceil((w.s.now + 1) / DAY) * DAY, ...(from ? { to: from } : {}) };
    });
    w.defineInput('stock', (place: Id, item: Id, n: number) => {
      const st = w.ring.state(place);
      st.stock ||= {};
      st.stock[item] = Math.max(0, (st.stock[item] || 0) + n);
    });
  }

  good(def: GoodDef): this { this.goods.set(def.id, def); return this; }

  // -------------------------------------------------------------------------
  // Money
  // -------------------------------------------------------------------------

  /** The purse a person spends from: their household's if it shares one, else their own. */
  purseOf(id: Id): { kind: 'person' | 'household'; id: Id } {
    const f = this.w.fellowship;
    const h = f?.household(id);
    if (h && f?.groups.get(h)?.purse) return { kind: 'household', id: h };
    return { kind: 'person', id };
  }

  /** How much a person can spend. */
  money(id: Id): number {
    const purse = this.purseOf(id);
    if (purse.kind === 'household') return round(this.st.purses[purse.id] ?? 0, 2);
    return round(Number(this.w.s.people[id]?.vars.money ?? 0), 2);
  }

  private add(id: Id, amount: number): void {
    if (id === 'world') return;
    const purse = this.w.s.people[id] ? this.purseOf(id) : { kind: 'household' as const, id };
    if (purse.kind === 'household' || !this.w.s.people[id]) {
      this.st.purses[purse.id] = round((this.st.purses[purse.id] ?? 0) + amount, 2);
      return;
    }
    const p = this.w.s.people[id];
    p.vars.money = round(Number(p.vars.money ?? 0) + amount, 2);
  }

  /** Moves money (from the game, call pay()). 'world' is outside the simulation. */
  transfer(from: Id, to: Id, amount: number, why: string): void {
    if (!amount) return;
    this.add(from, -amount);
    this.add(to, amount);
    this.st.ledger.push({ t: this.w.s.now, from, to, amount: round(amount, 2), why });
    if (this.st.ledger.length > 200) this.st.ledger.shift();
  }

  /** Pays money from one to another (or 'world'): recorded for time walk. */
  pay(from: Id, to: Id, amount: number, why = 'paid'): void { this.w.input('pay', [from, to, amount, why]); }

  /** Sets up rent: amount every so many days, paid to someone (or the world). */
  rent(id: Id, amount: number, everyDays = 7, to?: Id): void { this.w.input('rent', [id, amount, everyDays, to ?? null]); }

  /** Sets up an income (a pension, an allowance): amount every so many days, from someone (or the world). */
  income(id: Id, amount: number, everyDays = 7, from?: Id): void { this.w.input('income', [id, amount, everyDays, from ?? null]); }

  /** Recent payments. */
  ledger(id?: Id): Array<{ t: number; from: Id; to: Id; amount: number; why: string }> {
    return this.st.ledger.filter((e) => !id || e.from === id || e.to === id);
  }

  // -------------------------------------------------------------------------
  // The household pantry: goods bought by anyone in a household that shares a purse
  // -------------------------------------------------------------------------

  /** How many of an item are in a person's household pantry. */
  pantryCount(id: Id, item: Id): number {
    const purse = this.purseOf(id);
    if (purse.kind !== 'household') return 0;
    return (this.st.pantry ||= {})[purse.id]?.[item] ?? 0;
  }

  /** What's in a household's pantry. */
  pantry(household: Id): Record<Id, number> { return { ...((this.st.pantry ||= {})[household] || {}) }; }

  takeFromPantry(id: Id, item: Id, n: number): void {
    const purse = this.purseOf(id);
    if (purse.kind !== 'household') return;
    const pan = ((this.st.pantry ||= {})[purse.id] ||= {});
    pan[item] = Math.max(0, (pan[item] || 0) - n);
    if (!pan[item]) delete pan[item];
  }

  private store(p: PersonState, item: Id, n: number): void {
    const purse = this.purseOf(p.id);
    if (purse.kind === 'household') {
      const pan = ((this.st.pantry ||= {})[purse.id] ||= {});
      pan[item] = (pan[item] || 0) + n;
    } else p.inv[item] = (p.inv[item] || 0) + n;
  }

  // -------------------------------------------------------------------------
  // Stock
  // -------------------------------------------------------------------------

  stock(place: Id, item: Id): number { return this.w.s.places[place]?.stock?.[item] ?? 0; }
  /** Adds (or removes) stock at a place: recorded. */
  restock(place: Id, item: Id, n: number): void { this.w.input('stock', [place, item, n]); }

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------

  block(p: PersonState, c: Candidate): string | null {
    if (c.kind !== 'action') return null;
    const a = this.w.actions.get(c.id);
    if (!a) return null;
    const price = a.price ?? 0;
    if (price > 0 && this.money(p.id) < price) return `can't afford ${price}`;
    if (a.buys && c.place) {
      for (const item in a.buys) if (this.stock(c.place, item) < a.buys[item]) return `${item} sold out`;
    }
    if (a.uses) for (const item in a.uses) if (this.w.have(p, item) < a.uses[item]) return `needs ${item}`;
    return null;
  }

  consider(p: PersonState, c: Candidate): Array<[string, number]> | void {
    if (c.kind !== 'action') return;
    const a = this.w.actions.get(c.id);
    const price = a?.price ?? 0;
    if (!price) return;
    const money = Math.max(0.01, this.money(p.id));
    const thrift = p.def.traits?.thrift ?? 0.5;
    const share = clamp(price / money);
    return [['price', round(clamp(1 - share * (0.4 + thrift * 0.8), 0.05, 1), 4)]];
  }

  started(p: PersonState, d: Doing): void {
    if (d.kind !== 'act') return;
    const w = this.w;
    const a = w.actions.get(d.action);
    if (!a) return;
    const owner = (d.place && w.ring.get(d.place)?.owner) || 'world';
    if (a.price) this.transfer(p.id, owner, a.price, a.id);
    if (a.buys && d.place) {
      const st = w.ring.state(d.place);
      for (const item in a.buys) {
        const n = a.buys[item];
        if (st.stock) st.stock[item] = Math.max(0, (st.stock[item] || 0) - n);
        this.store(p, item, n);
      }
    }
    if (a.uses) {
      for (const item in a.uses) {
        w.takeItem(p, item, a.uses[item]);
        const g = this.goods.get(item);
        if (g?.satisfies) for (const need in g.satisfies) w.mind.setLevel(p, need, w.mind.level(p, need) - g.satisfies[need] * a.uses[item]);
      }
    }
  }

  ended(p: PersonState, d: Doing, frac: number, interrupted: boolean): void {
    if (d.kind !== 'act') return;
    const w = this.w;
    const a = w.actions.get(d.action);
    if (!a) return;
    const job = p.def.job;
    const wage = a.wage ?? (job && job.action === a.id ? job.wage : undefined);
    if (wage) {
      const hours = ((d.end - d.start) * frac) / HOUR;
      const payer = (d.place && w.ring.get(d.place)?.owner) || 'world';
      if (payer !== p.id) this.transfer(payer, p.id, round(wage * hours, 2), 'wages');
    }
    if (a.gives && !interrupted) for (const item in a.gives) p.inv[item] = (p.inv[item] || 0) + a.gives[item];
  }

  hour(t: number): void {
    const w = this.w;
    const hourIndex = Math.round(t / HOUR);
    for (const def of w.ring.defs.values()) {
      if (!def.restock) continue;
      const st = w.ring.state(def.id);
      st.stock ||= {};
      for (const item in def.restock) {
        const [n, every] = def.restock[item];
        if (every > 0 && hourIndex % every === 0) {
          const cap = def.stock?.[item] ?? n;
          st.stock[item] = Math.min(cap, (st.stock[item] || 0) + n);
        }
      }
    }
  }

  day(): void {
    const w = this.w, now = w.s.now;
    for (const id in this.st.income || {}) {
      const inc = (this.st.income as Record<Id, Rent>)[id];
      if (inc.next > now + 1e-6) continue;
      inc.next += inc.every * DAY;
      if (w.s.people[id]?.status === 'active') this.transfer(inc.to ?? 'world', id, inc.amount, 'income');
    }
    for (const id in this.st.rent) {
      const r = this.st.rent[id];
      if (r.next > now + 1e-6) continue;
      r.next += r.every * DAY;
      const p = w.s.people[id];
      if (!p || p.status === 'gone') continue;
      if (this.money(id) >= r.amount) {
        this.transfer(id, r.to ?? 'world', r.amount, 'rent');
        w.log('rent', id, { paid: r.amount });
      } else {
        w.log('rent', id, { missed: r.amount });
        w.emit('rent-missed', { id, amount: r.amount });
        if (w.reverie) {
          if (!w.reverie.feelingDefs.has('behind_on_rent')) w.reverie.feeling({ id: 'behind_on_rent', label: 'Behind on the rent', weight: -0.15, minutes: 7 * DAY, emotion: 'tense' });
          w.reverie.applyFeel(id, 'behind_on_rent');
          if (r.to && w.s.people[r.to]) w.reverie.applyBelieve(r.to, `behind:${id}`, true, 'saw');
        }
      }
    }
  }

  did(_actor: Id, _verb: string, _data: Record<string, Value>): void { /* nothing: payments go through pay() */ }
}
