// Ceres: money and goods. Named for The Expanse's station that lives on
// trade, water and air.
//
//   money     each person's own, or a household's shared purse
//   prices    paid when an action starts, to whoever owns the place
//   stock     places sell goods from stock, which runs out and restocks
//   wages     paid per hour for work, at the end of a stint
//   goods     have a kind, so conditions can ask for any of several (goods:food)
//   rent      due every so many days; missing it is felt, and remembered
//   affording people weigh prices against what they have, by thrift
//   production actions that use goods from a store's stock and make goods
//             into it, a daily report of every store (stock, made and used
//             yesterday, days left at that rate) and the bottleneck in each
//             chain (grain to flour to bread): Merryfolk's economy board
import type { Module } from '../core/module';
import type { ActionDef, Candidate, Doing, Id, PersonState, Value } from '../core/types';
import type { World } from '../core/world';
import { DAY, HOUR, clamp, round } from '../core/util';

export interface GoodDef {
  id: Id;
  /** A kind of good: 'food', 'drink', 'part'... The term goods:<kind> counts every good of a kind. */
  kind?: string;
  price?: number;
  /** Needs it meets when used up: { hunger: 0.4 }. */
  satisfies?: Record<Id, number>;
  /** A readable name: Palantír shows it. */
  label?: string;
}

/** A production chain: goods made one from the next (grain, flour, bread). */
export interface ChainDef {
  id: Id;
  label?: string;
  /** The goods, from the rawest to the finished. */
  goods: Id[];
  /** The place whose stock it's judged by (a store, a granary). Default: every place's stock added up. */
  store?: Id;
  /** A good counts as piling up at this much stock. Default: two days of what was used of it yesterday (at least 2). */
  plenty?: number;
  /** A good counts as short at or under this much stock. Default: under a day of what was used of it yesterday (at least 1). */
  short?: number;
}

/** One good in a store, in the daily report. */
export interface GoodReport {
  stock: number;
  /** Made (or delivered) and used (or sold) yesterday. */
  made: number;
  used: number;
  net: number;
  /** Days the stock would last if yesterday repeated (null unless it's running down). */
  days: number | null;
}

/** The daily production report: what every store had and did yesterday, and where each chain is stuck. */
export interface ProductionReport {
  /** The day the made and used figures are for. */
  day: number;
  places: Record<Id, Record<Id, GoodReport>>;
  /** Links where the first good piles up while the next runs short: the bottlenecks. */
  bottlenecks: Array<{ chain: Id; from: Id; to: Id; store: Id | null; fromStock: number; toStock: number }>;
}

export interface CeresConfig {
  /**
   * The headline knob: how much prices put people off. It scales how far a
   * price, as a share of what they have, weighs an option down. 0: price is
   * no object (they still can't buy what they can't afford). A person's own
   * (PersonDef.tune.ceres) multiplies it for them. Default 1.
   */
  prices: number;
  /** A priced option weighs 1 - share × (priceShare + thrift × priceThrift), never under priceFloor, where share is the price over what they have. Defaults 0.4, 0.8 and 0.05. */
  priceShare: number;
  priceThrift: number;
  priceFloor: number;
}

export const DEFAULT_CERES: CeresConfig = { prices: 1, priceShare: 0.4, priceThrift: 0.8, priceFloor: 0.05 };

interface Flow { made?: Record<Id, number>; used?: Record<Id, number> }
interface Production { day: number; today: Record<Id, Flow>; yesterday: Record<Id, Flow> }
interface Rent { amount: number; every: number; next: number; to?: Id }
interface State { purses: Record<Id, number>; pantry: Record<Id, Record<Id, number>>; rent: Record<Id, Rent>; income?: Record<Id, Rent>; ledger: Array<{ t: number; from: Id; to: Id; amount: number; why: string }>; prod?: Production }

export class Ceres implements Module {
  readonly name = 'ceres';
  readonly config: CeresConfig;
  readonly knobs = { prices: 'person' } as const;
  readonly goods = new Map<Id, GoodDef>();
  readonly chains = new Map<Id, ChainDef>();
  private w!: World;
  /** Whether anything makes goods or works from a store (worked out from the definitions, kept until they change). */
  private producingCache: { n: number; on: boolean } | null = null;

  constructor(cfg: Partial<CeresConfig> = {}) { this.config = { ...DEFAULT_CERES, ...cfg }; }

  init(): State { return { purses: {}, pantry: {}, rent: {}, ledger: [] }; }
  private get st(): State { return this.w.s.mod.ceres as State; }
  /** The config in force: as declared, under any world.tune. */
  private get c(): CeresConfig { return this.w.tuned(this.name, this.config); }

  attach(w: World): void {
    this.w = w;
    w.lang.term('purse', (c) => (c.person ? this.money(c.person.id) : 0));
    w.lang.term('price', (c, a) => (a ? this.goods.get(a)?.price ?? 0 : w.actions.get(c.action ?? '')?.price ?? 0));
    w.lang.term('stock', (c, a) => { const [pl, item] = a.includes('.') ? a.split('.') : [c.place ?? '', a]; return this.stock(pl, item); });
    w.lang.term('afford', (c, a) => (c.person ? this.money(c.person.id) >= Number(a) : false));
    w.lang.term('goods', (c, a) => (c.person ? this.ofKind(c.person, a) : 0));
    w.lang.effect('pay', (c, a, _op, v) => { if (c.person) this.applyPay(c.person.id, a || 'world', Number(v ?? 0), 'pay'); });
    w.defineInput('pay', (from: Id, to: Id, amount: number, why: string) => this.applyPay(from, to, amount, why));
    w.defineInput('rent', (id: Id, amount: number, everyDays: number, to: Id | null) => {
      this.st.rent[id] = { amount, every: everyDays, next: Math.ceil((w.s.now + everyDays * DAY) / DAY) * DAY, ...(to ? { to } : {}) };
    });
    w.defineInput('income', (id: Id, amount: number, everyDays: number, from: Id | null) => {
      (this.st.income ||= {})[id] = { amount, every: everyDays, next: Math.ceil((w.s.now + 1) / DAY) * DAY, ...(from ? { to: from } : {}) };
    });
    w.defineInput('stock', (place: Id, item: Id, n: number) => {
      const st = w.ring.state(place);
      st.stock ||= {};
      const before = st.stock[item] || 0;
      st.stock[item] = Math.max(0, before + n);
      this.flow(place, item, st.stock[item] - before);
    });
  }

  good(def: GoodDef): this { this.goods.set(def.id, def); return this; }
  /** A production chain, for the daily report's bottlenecks. */
  chain(def: ChainDef): this { this.chains.set(def.id, def); this.producingCache = null; return this; }

  /** How many goods of a kind a person can use (their own and their household's pantry). */
  ofKind(p: PersonState, kind: string): number {
    let n = 0;
    for (const g of this.goods.values()) if (g.kind === kind) n += this.w.have(p, g.id);
    return n;
  }

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

  /** Moves money inside the simulation (from the game, call pay()). 'world' is outside the simulation. */
  applyPay(from: Id, to: Id, amount: number, why: string): void {
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
    return this.st.pantry?.[purse.id]?.[item] ?? 0;
  }

  /** What's in a household's pantry. */
  pantry(household: Id): Record<Id, number> { return { ...(this.st.pantry?.[household] || {}) }; }

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
  // Production
  // -------------------------------------------------------------------------

  /** Does anything make goods or work from a store, or is there a chain? Then stock flows are counted. */
  producing(): boolean {
    const w = this.w;
    const n = w.actions.size * 1000 + this.chains.size;
    if (this.producingCache && this.producingCache.n === n) return this.producingCache.on;
    let on = this.chains.size > 0;
    if (!on) for (const a of w.actions.values()) if (a.makes || a.store) { on = true; break; }
    this.producingCache = { n, on };
    return on;
  }

  /** The place an action's `store` names, from the place it's done. */
  storeOf(a: ActionDef, place: Id | null | undefined): Id | null {
    if (!a.store || a.store === 'here') return place ?? null;
    return a.store;
  }

  /** Counts a change in a place's stock as made (more) or used (less), when production is on. */
  private flow(place: Id, item: Id, n: number): void {
    if (!n || !this.producing()) return;
    const st = this.st;
    const prod = (st.prod ||= { day: Math.floor(this.w.s.now / DAY), today: {}, yesterday: {} });
    const f = (prod.today[place] ||= {});
    const side = n > 0 ? (f.made ||= {}) : (f.used ||= {});
    side[item] = round((side[item] || 0) + Math.abs(n), 4);
  }

  /** Takes goods out of a place's stock (not below none), counting them as used. */
  private takeStock(place: Id, item: Id, n: number): void {
    const st = this.w.ring.state(place);
    const before = st.stock?.[item] ?? 0;
    if (!st.stock) return;
    st.stock[item] = round(Math.max(0, before - n), 4);
    this.flow(place, item, st.stock[item] - before);
  }

  /** Adds goods to a place's stock, counting them as made. */
  private addStock(place: Id, item: Id, n: number): void {
    const st = this.w.ring.state(place);
    st.stock ||= {};
    st.stock[item] = round((st.stock[item] || 0) + n, 4);
    this.flow(place, item, n);
  }

  private stockAt(item: Id, store: Id | null | undefined): number {
    if (store) return this.stock(store, item);
    let n = 0;
    for (const id in this.w.s.places) n += this.w.s.places[id].stock?.[item] ?? 0;
    return round(n, 4);
  }

  private flowAt(side: 'made' | 'used', item: Id, store: Id | null | undefined): number {
    const y = this.st.prod?.yesterday;
    if (!y) return 0;
    if (store) return y[store]?.[side]?.[item] ?? 0;
    let n = 0;
    for (const id in y) n += y[id][side]?.[item] ?? 0;
    return round(n, 4);
  }

  /**
   * The production report: for each store (or the one asked for), every good
   * with its stock now, what was made and used yesterday, and how many days
   * it would last if yesterday repeated; and the bottleneck links of every
   * chain, where a good piles up while the next one runs short.
   */
  production(place?: Id): ProductionReport {
    const w = this.w;
    const prod = this.st.prod;
    const y = prod?.yesterday ?? {};
    const out: ProductionReport = { day: Math.floor(w.s.now / DAY) - 1, places: {}, bottlenecks: [] };
    const places = new Set<Id>(place ? [place] : Object.keys(y));
    if (!place) for (const c of this.chains.values()) if (c.store) places.add(c.store);
    for (const pl of [...places].sort()) {
      const items = new Set<Id>([...Object.keys(w.s.places[pl]?.stock || {}), ...Object.keys(y[pl]?.made || {}), ...Object.keys(y[pl]?.used || {})]);
      const goods: Record<Id, GoodReport> = {};
      for (const item of [...items].sort()) {
        const stock = this.stock(pl, item), made = y[pl]?.made?.[item] ?? 0, used = y[pl]?.used?.[item] ?? 0;
        const net = round(made - used, 4);
        goods[item] = { stock, made, used, net, days: net < 0 && stock > 0 ? round(stock / -net, 2) : null };
      }
      out.places[pl] = goods;
    }
    for (const c of this.chains.values()) {
      if (place && c.store !== place) continue;
      for (let i = 0; i + 1 < c.goods.length; i++) {
        const from = c.goods[i], to = c.goods[i + 1];
        const fromStock = this.stockAt(from, c.store), toStock = this.stockAt(to, c.store);
        const plenty = c.plenty ?? Math.max(2, 2 * this.flowAt('used', from, c.store));
        const short = c.short !== undefined ? toStock <= c.short : toStock < Math.max(1, this.flowAt('used', to, c.store));
        if (fromStock >= plenty && short) out.bottlenecks.push({ chain: c.id, from, to, store: c.store ?? null, fromStock, toStock });
      }
    }
    return out;
  }

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
    if (a.uses) {
      const store = a.store ? this.storeOf(a, c.place ?? p.place) : null;
      if (store) { for (const item in a.uses) if (this.stock(store, item) < a.uses[item]) return `no ${item} left at ${store}`; }
      else for (const item in a.uses) if (this.w.have(p, item) < a.uses[item]) return `needs ${item}`;
    }
    return null;
  }

  consider(p: PersonState, c: Candidate): Array<[string, number]> | void {
    if (c.kind !== 'action') return;
    const a = this.w.actions.get(c.id);
    const price = a?.price ?? 0;
    if (!price) return;
    const money = Math.max(0.01, this.money(p.id));
    const thrift = p.def.traits?.thrift ?? this.w.cfg.traitDefault;
    const share = clamp(price / money);
    const cfg = this.c;
    // the headline knob: how much prices put them off, the world's times their own
    const k = cfg.prices * this.w.own(p, this.name, 'prices');
    return [['price', round(clamp(1 - share * (cfg.priceShare + thrift * cfg.priceThrift) * k, cfg.priceFloor, 1), 4)]];
  }

  started(p: PersonState, d: Doing): void {
    if (d.kind !== 'act') return;
    const w = this.w;
    const a = w.actions.get(d.action);
    if (!a) return;
    const owner = (d.place && w.ring.get(d.place)?.owner) || 'world';
    if (a.price) this.applyPay(p.id, owner, a.price, a.id);
    if (a.buys && d.place) {
      const st = w.ring.state(d.place);
      for (const item in a.buys) {
        const n = a.buys[item];
        if (st.stock) {
          const before = st.stock[item] || 0;
          st.stock[item] = Math.max(0, before - n);
          this.flow(d.place, item, st.stock[item] - before);
        }
        this.store(p, item, n);
      }
    }
    const store = a.store ? this.storeOf(a, d.place) : null;
    if (a.uses && store) {
      // materials from the store's stock (not eaten: what they're made into is)
      for (const item in a.uses) this.takeStock(store, item, a.uses[item]);
    } else if (a.uses) {
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
      if (payer !== p.id) this.applyPay(payer, p.id, round(wage * hours, 2), 'wages');
    }
    if (a.gives && !interrupted) for (const item in a.gives) p.inv[item] = (p.inv[item] || 0) + a.gives[item];
    if (a.makes && frac > 0) {
      let f = interrupted ? frac : 1;
      if (a.yields?.length) {
        const ctx = w.ctx(p, { place: d.place, action: a.id });
        for (const k of a.yields) f *= w.mind.consider(k, ctx);
      }
      const place = this.storeOf(a, d.place);
      for (const item of Object.keys(a.makes)) {
        const n = round(a.makes[item] * f, 4);
        if (n <= 0) continue;
        if (place) this.addStock(place, item, n);
        else this.store(p, item, n);
      }
    }
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
          const before = st.stock[item] || 0;
          st.stock[item] = Math.min(cap, before + n);
          this.flow(def.id, item, st.stock[item] - before);
        }
      }
    }
  }

  day(): void {
    const w = this.w, now = w.s.now;
    // a new day's figures: yesterday's are the report
    const prod = this.st.prod;
    if (prod) {
      prod.yesterday = prod.today;
      prod.today = {};
      prod.day = Math.floor(now / DAY);
      w.emit('production', this.production());
    }
    for (const id in this.st.income || {}) {
      const inc = (this.st.income as Record<Id, Rent>)[id];
      if (inc.next > now + 1e-6) continue;
      inc.next += inc.every * DAY;
      if (w.s.people[id]?.status === 'active') this.applyPay(inc.to ?? 'world', id, inc.amount, 'income');
    }
    for (const id in this.st.rent) {
      const r = this.st.rent[id];
      if (r.next > now + 1e-6) continue;
      r.next += r.every * DAY;
      const p = w.s.people[id];
      if (!p || p.status === 'gone') continue;
      if (this.money(id) >= r.amount) {
        this.applyPay(id, r.to ?? 'world', r.amount, 'rent');
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
