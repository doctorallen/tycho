// Ring: the place graph. Places, what they offer, their opening hours, their
// slots and who holds them, and how long it takes to get from one to another.
// Named for the Ring in The Expanse: the hub whose gates join every world.
//
// The engine never knows coordinates. A place is an id with tags, hours and
// slots; travel time comes from the game's shell if it has one, or from
// links declared here. Slots are claimed and released whether or not the
// player is watching, so a full bar is full off screen too.
import type { Id, PersonState, PlaceDef, PlaceSpec, PlaceState, SlotDef } from './types';
import type { World } from './world';
import { hourOf, inHours } from './util';

export class Ring {
  readonly defs = new Map<Id, PlaceDef>();
  private links = new Map<Id, Map<Id, number>>();
  private cache = new Map<string, number>();
  private byTag = new Map<string, Id[]>();

  constructor(private w: World) {}

  /** Declares a place. */
  place(def: PlaceDef): void {
    this.defs.set(def.id, def);
    for (const tag of def.tags || []) {
      const list = this.byTag.get(tag) || [];
      if (!list.includes(def.id)) list.push(def.id);
      this.byTag.set(tag, list);
    }
    if (!this.w.s.places[def.id]) this.w.s.places[def.id] = this.fresh(def);
    this.cache.clear();
  }

  private fresh(def: PlaceDef): PlaceState {
    const st: PlaceState = { claims: {} };
    if (def.stock) st.stock = { ...def.stock };
    return st;
  }

  /** Joins two places with a walk of this many minutes (both ways unless oneWay). */
  link(a: Id, b: Id, minutes: number, oneWay = false): void {
    const add = (x: Id, y: Id) => {
      const m = this.links.get(x) || new Map<Id, number>();
      m.set(y, minutes);
      this.links.set(x, m);
    };
    add(a, b);
    if (!oneWay) add(b, a);
    this.cache.clear();
  }

  get(id: Id | null | undefined): PlaceDef | undefined { return id ? this.defs.get(id) : undefined; }
  state(id: Id): PlaceState {
    let st = this.w.s.places[id];
    if (!st) {
      const def = this.defs.get(id);
      st = this.w.s.places[id] = def ? this.fresh(def) : { claims: {} };
    }
    return st;
  }

  /** Every place with a tag. */
  tagged(tag: string): Id[] { return this.byTag.get(tag) || []; }

  hasTag(id: Id | null | undefined, tag: string): boolean {
    let cur = this.get(id);
    while (cur) {
      if (cur.tags && cur.tags.includes(tag)) return true;
      cur = this.get(cur.in);
    }
    return false;
  }

  /** The region a place is in: its own, or its parent's, or 'world'. */
  region(id: Id | null | undefined): string {
    let cur = this.get(id);
    while (cur) {
      if (cur.region) return cur.region;
      cur = this.get(cur.in);
    }
    return 'world';
  }

  /** The outermost place containing this one. */
  root(id: Id): Id {
    let cur = this.get(id);
    let last = id;
    while (cur && cur.in) { last = cur.in; cur = this.get(cur.in); }
    return last;
  }

  /** Is `inner` the place `outer` or somewhere inside it? */
  within(inner: Id | null | undefined, outer: Id): boolean {
    let cur: Id | undefined = inner || undefined;
    while (cur) {
      if (cur === outer) return true;
      cur = this.get(cur)?.in;
    }
    return false;
  }

  /** Is the place open at a time (its own hours and every parent's)? */
  open(id: Id, t = this.w.now): boolean {
    const h = hourOf(t);
    let cur = this.get(id);
    while (cur) {
      if (cur.hours && !inHours(h, cur.hours)) return false;
      if (this.w.s.facts['closed:' + cur.id] === true) return false;
      cur = this.get(cur.in);
    }
    return this.w.s.facts['closed:' + id] !== true;
  }

  /** The capacity of a slot (0 if the place has no such slot). */
  capacity(id: Id, slot: string): number {
    const def = this.get(id);
    const sd = def?.slots?.[slot];
    if (sd === undefined) return 0;
    return typeof sd === 'number' ? sd : (sd as SlotDef).count;
  }

  /** Who holds a slot. */
  holders(id: Id, slot: string): Id[] { return this.state(id).claims[slot] || []; }

  /** Free places in a slot (Infinity when the place doesn't limit it). */
  free(id: Id, slot: string | undefined): number {
    if (!slot) return Infinity;
    const cap = this.capacity(id, slot);
    if (cap <= 0) return Infinity;
    return cap - this.holders(id, slot).length;
  }

  /** May this person take the slot (its `who` conditions)? */
  allowed(id: Id, slot: string | undefined, p: PersonState | undefined): boolean {
    if (!slot || !p) return true;
    const sd = this.get(id)?.slots?.[slot];
    if (!sd || typeof sd !== 'object' || !sd.who) return true;
    return this.w.lang.all(sd.who, { world: this.w, person: p, place: id });
  }

  /** Takes a slot. False if it's full or the person may not use it. */
  claim(id: Id, slot: string | undefined, who: Id): boolean {
    if (!slot) return true;
    const cap = this.capacity(id, slot);
    if (cap <= 0) return true;
    const st = this.state(id);
    const list = st.claims[slot] || (st.claims[slot] = []);
    if (list.includes(who)) return true;
    if (list.length >= cap) return false;
    if (!this.allowed(id, slot, this.w.s.people[who])) return false;
    list.push(who);
    return true;
  }

  /** Lets go of a slot. */
  release(id: Id | null | undefined, slot: string | undefined, who: Id): void {
    if (!id || !slot) return;
    const st = this.w.s.places[id];
    const list = st?.claims[slot];
    if (!list) return;
    const i = list.indexOf(who);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) delete st.claims[slot];
  }

  /** Everyone at a place right now (doing something there, not walking through). */
  present(id: Id): Id[] {
    const out: Id[] = [];
    for (const pid in this.w.s.people) {
      const p = this.w.s.people[pid];
      if (p.status === 'active' && p.doing?.kind !== 'travel' && p.place && this.within(p.place, id)) out.push(pid);
    }
    return out;
  }

  /** Share of a place's capacity in use (0..1). */
  crowd(id: Id): number {
    const def = this.get(id);
    if (!def?.slots) return 0;
    let cap = 0, used = 0;
    for (const k in def.slots) { cap += this.capacity(id, k); used += this.holders(id, k).length; }
    return cap ? used / cap : 0;
  }

  /** Travel time in minutes from a to b, for a person. */
  travel(a: Id | null | undefined, b: Id | null | undefined, person?: PersonState): number {
    if (!a || !b || a === b) return 0;
    if (this.w.shell.travel) return this.w.shell.travel(a, b, person);
    const ra = this.root(a), rb = this.root(b);
    if (ra === rb) return 0;
    const key = ra + '\u0001' + rb;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    const d = this.dijkstra(ra, rb);
    this.cache.set(key, d);
    return d;
  }

  private dijkstra(a: Id, b: Id): number {
    const dist = new Map<Id, number>([[a, 0]]);
    const done = new Set<Id>();
    for (;;) {
      let cur: Id | null = null, best = Infinity;
      for (const [k, v] of dist) if (!done.has(k) && v < best) { best = v; cur = k; }
      if (cur === null) return Infinity;
      if (cur === b) return best;
      done.add(cur);
      const edges = this.links.get(cur);
      if (!edges) continue;
      for (const [n, m] of edges) {
        const nd = best + m;
        if (nd < (dist.get(n) ?? Infinity)) dist.set(n, nd);
      }
    }
  }

  /**
   * The candidate places for an action's place spec, for a person: nearest
   * first. 'here' and null mean where they are.
   */
  resolve(spec: PlaceSpec | PlaceSpec[] | undefined, person: PersonState, target?: Id): Id[] {
    const specs = Array.isArray(spec) ? spec : [spec === undefined ? null : spec];
    const out: Id[] = [];
    const add = (id: Id | null | undefined) => { if (id && !out.includes(id)) out.push(id); };
    for (const sp of specs) {
      if (sp === null || sp === 'here') add(person.place || person.def.home);
      else if (sp === 'home') add(person.def.home);
      else if (sp === 'work') add(person.def.job?.place);
      else if (sp === 'target') { const t = target ? this.w.s.people[target] : undefined; add(t?.place); }
      else if (sp.startsWith('tag:')) for (const id of this.tagged(sp.slice(4))) add(id);
      else if (sp.startsWith('person:')) add(this.w.s.people[sp.slice(7)]?.place);
      else add(sp);
    }
    if (out.length > 1) {
      const from = person.place;
      const d = new Map(out.map((id) => [id, this.travel(from, id, person)]));
      out.sort((x, y) => (d.get(x) as number) - (d.get(y) as number) || (x < y ? -1 : 1));
    }
    return out;
  }
}
