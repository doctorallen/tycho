// Items: what a player carries and how it's counted. Kinds that stack by
// count, kept in a bag (a plain object of counts, saved as it is); things
// of their own, instances that carry their own attributes (an id, a grade,
// a history), in plain lists; inventories by slot, a stack a slot; equipment
// slots; and counted views of a list, grouped by any of its attributes a
// level at a time (the White Dragon's shelf: a card a kind, a row a grade
// and gauge, a chip a state, each with its count).
//
// Everything here works on the game's own plain objects and arrays, so they
// stay in its save as they are and nothing here holds state of its own.
// What the kinds are called, what they're worth and how they're shown are
// the game's.

/** Counts by kind: { wire: 3, glass: 1 }. */
export type Bag = Record<string, number>;

/** Kinds that stack by count, in a bag. */
export const bag = {
  /** How many of a kind (0 if none). */
  count(b: Bag, kind: string): number { return b[kind] || 0; },
  /** How many in all: of the kinds given, or of every kind in the bag. */
  total(b: Bag, kinds?: string[]): number {
    let n = 0;
    if (kinds) for (const k of kinds) n += b[k] || 0;
    else for (const k in b) n += b[k];
    return n;
  },
  /** Puts n of a kind in; returns how many went in (none for n <= 0). */
  add(b: Bag, kind: string, n: number): number {
    if (n <= 0) return 0;
    b[kind] = (b[kind] || 0) + n;
    return n;
  },
  /** Takes n of a kind out if there are as many; false (and nothing taken) if not. */
  take(b: Bag, kind: string, n: number): boolean {
    if ((b[kind] || 0) < n) return false;
    b[kind] = (b[kind] || 0) - n;
    return true;
  },
  /** Are there as many of each kind as a cost asks ({ wire: 2, glass: 1 })? */
  has(b: Bag, cost: Bag): boolean {
    for (const k in cost) if ((b[k] || 0) < cost[k]) return false;
    return true;
  },
  /** Takes a cost out if it's all there; false (and nothing taken) if not. */
  pay(b: Bag, cost: Bag): boolean {
    if (!bag.has(b, cost)) return false;
    for (const k in cost) b[k] = (b[k] || 0) - cost[k];
    return true;
  },
  /** Every count to 0 (those of the kinds given, each set even if it wasn't
   * there, or every kind in the bag); returns what there was, [kind, n] for
   * each above 0. */
  empty(b: Bag, kinds?: string[]): [string, number][] {
    const out: [string, number][] = [];
    for (const k of kinds || Object.keys(b)) { if (b[k] > 0) out.push([k, b[k]]); b[k] = 0; }
    return out;
  },
  /** Moves everything from one bag into another (of the kinds given, in
   * their order, or of every kind in `from`), leaving 0 behind; returns what
   * moved, [kind, n] for each above 0. */
  move(from: Bag, to: Bag, kinds?: string[]): [string, number][] {
    const out: [string, number][] = [];
    for (const k of kinds || Object.keys(from)) {
      const n = from[k];
      if (!(n > 0)) continue;
      to[k] = (to[k] || 0) + n;
      out.push([k, n]);
      from[k] = 0;
    }
    return out;
  },
  /** What a bag is worth: value(kind, count) summed over the kinds given (in
   * their order), or over every kind in the bag. */
  worth(b: Bag, value: (kind: string, n: number) => number, kinds?: string[]): number {
    let v = 0;
    for (const k of kinds || Object.keys(b)) v += value(k, b[k] || 0);
    return v;
  },
};

/** Things of their own, each with an id and attributes of its own, kept in
 * a plain list. */
export const things = {
  /** The next id from a counter kept in the save, holder[key]: one more than
   * the last given, or than `from` before any was. */
  nextId(holder: Record<string, unknown>, key = 'id', from = 0): number {
    const n = ((holder[key] as number) || from) + 1;
    holder[key] = n;
    return n;
  },
  /** A thing: its id first, then its attributes (later ones over earlier). */
  make<T extends object>(id: number, ...attrs: Partial<T>[]): T & { id: number } {
    return Object.assign({ id }, ...attrs);
  },
  /** Takes the thing with that id out of a list: it, or null. */
  pull<T extends { id: unknown }>(list: T[], id: unknown): T | null {
    const i = list.findIndex((t) => t.id === id);
    return i < 0 ? null : list.splice(i, 1)[0];
  },
  /** The things in a list with these attributes (each equal), or passing a test. */
  where<T>(list: T[], what: Partial<T> | ((t: T) => boolean)): T[] {
    if (typeof what === 'function') return list.filter(what);
    const keys = Object.keys(what) as (keyof T)[];
    return list.filter((t) => keys.every((k) => t[k] === what[k]));
  },
};

/** A stack in a slot: a kind and how many (and whatever else the game keeps). */
export interface Stack { k: string; n: number; [attr: string]: unknown }
/** An inventory by slot: a stack or null in each. */
export type Slots = (Stack | null)[];

/** Inventories by slot: each slot holds one kind, up to its stack's limit. */
export const slots = {
  /** n empty slots. */
  make(n: number): Slots { return new Array(n).fill(null); },
  /** Puts n of a kind in: topping up its stacks first, in slot order, then
   * the empty slots; `stack` is the most a slot holds (a number, or a
   * kind's). Returns how many didn't fit. */
  put(S: Slots, kind: string, n: number, stack: number | ((kind: string) => number) = Infinity): number {
    const max = typeof stack === 'function' ? stack(kind) : stack;
    for (const s of S) { if (n <= 0) break; if (s && s.k === kind && s.n < max) { const m = Math.min(n, max - s.n); s.n += m; n -= m; } }
    for (let i = 0; i < S.length && n > 0; i++) if (!S[i]) { const m = Math.min(n, max); S[i] = { k: kind, n: m }; n -= m; }
    return Math.max(0, n);
  },
  /** How many of a kind, over every slot. */
  count(S: Slots, kind: string): number { let n = 0; for (const s of S) if (s && s.k === kind) n += s.n; return n; },
  /** Takes n of a kind if there are as many (from the last stacks first, a
   * slot emptied when it runs out); false (and nothing taken) if not. */
  take(S: Slots, kind: string, n: number): boolean {
    if (slots.count(S, kind) < n) return false;
    for (let i = S.length - 1; i >= 0 && n > 0; i--) {
      const s = S[i];
      if (!s || s.k !== kind) continue;
      const m = Math.min(n, s.n); s.n -= m; n -= m;
      if (s.n <= 0) S[i] = null;
    }
    return true;
  },
  /** How many slots are empty. */
  free(S: Slots): number { let n = 0; for (const s of S) if (!s) n++; return n; },
};

/** Equipment: named slots, each holding one thing or null. */
export type Gear<T> = Record<string, T | null>;

export const gear = {
  /** Empty slots of these names. */
  make<T>(names: string[]): Gear<T> { const g: Gear<T> = {}; for (const n of names) g[n] = null; return g; },
  /** Puts a thing on in a slot, if the slot is there and (by `fits`) takes
   * it. Returns what came off to make room (null if the slot was empty), or
   * undefined if it doesn't go there. */
  equip<T>(g: Gear<T>, slot: string, thing: T, fits?: (slot: string, thing: T) => boolean): T | null | undefined {
    if (!(slot in g) || (fits && !fits(slot, thing))) return undefined;
    const off = g[slot];
    g[slot] = thing;
    return off;
  },
  /** Takes off what's in a slot: it, or null. */
  unequip<T>(g: Gear<T>, slot: string): T | null {
    const off = g[slot] ?? null;
    if (slot in g) g[slot] = null;
    return off;
  },
  /** What's on, in the slots' order. */
  worn<T>(g: Gear<T>): T[] { return Object.values(g).filter((t): t is T => t !== null && t !== undefined); },
};

/** One level of a counted view. */
export interface Level<T> {
  /** What the things are grouped by: an attribute's name, or a function of the thing. */
  by: string | ((t: T) => unknown);
  /** The order of the groups: the values in this order (a thing with any
   * other value goes in none of them), a compare function, or by default
   * the values there are, sorted as text. */
  order?: unknown[] | ((a: any, b: any) => number);
}
/** A group of things alike: their value at this level, how many, which,
 * and the groups of the next level down among them. */
export interface Group<T> { key: any; n: number; items: T[]; groups?: Group<T>[] }

/** Counts a list grouped a level at a time: the groups at the first level
 * (none empty), each holding the groups of the next level among its things,
 * and so on. A group's count is all its things, whether or not the next
 * level's order leaves some out. */
export function group<T>(list: T[], levels: Level<T>[]): Group<T>[] {
  if (!levels.length) return [];
  const [L, ...rest] = levels, by = L.by;
  const keyOf = typeof by === 'function' ? by : (t: T) => (t as Record<string, unknown>)[by];
  const buckets = new Map<unknown, T[]>();
  for (const t of list) { const k = keyOf(t); let b = buckets.get(k); if (!b) buckets.set(k, (b = [])); b.push(t); }
  let keys: unknown[];
  if (Array.isArray(L.order)) keys = L.order.filter((k) => buckets.has(k));
  else if (typeof L.order === 'function') keys = [...buckets.keys()].sort(L.order);
  else keys = [...buckets.keys()].sort();
  return keys.map((key) => {
    const items = buckets.get(key)!, g: Group<T> = { key, n: items.length, items };
    if (rest.length) g.groups = group(items, rest);
    return g;
  });
}
