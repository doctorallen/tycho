// Saving to the browser's storage (localStorage): reads and writes that never
// throw (storage can be missing, full or refused), and a Store for a game's
// one save object, with what a game needs around it: a fresh save to start
// from, old keys to clear, ids renamed since a save was made, a save that
// couldn't be read kept aside rather than written over, single fields written
// at once, and starting over.

/** JSON from storage, or `fallback` if it's missing or can't be read. */
export function get<T = unknown>(key: string, fallback: T | null = null): T | null {
  try { const raw = localStorage.getItem(key); return raw === null ? fallback : (JSON.parse(raw) as T); } catch (e) { return fallback; }
}
/** Writes a value as JSON; false if storage refused it. */
export function set(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}
/** The raw string, or null. */
export function raw(key: string): string | null {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
export function remove(key: string): void {
  try { localStorage.removeItem(key); } catch (e) { /* storage unavailable */ }
}
/** Every key that starts with `prefix`. */
export function keys(prefix = ''): string[] {
  const out: string[] = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(prefix)) out.push(k); } } catch (e) { /* storage unavailable */ }
  return out;
}

export interface StoreOptions<D> {
  /** The storage key, e.g. 'mygame.save.v1'. */
  key: string;
  /** A new game's save. */
  fresh: () => D;
  /** Keys of saves this game no longer reads, deleted on load. */
  old?: string[];
  /** Ids renamed since a save could have been made: [pattern, replacement]
   * pairs applied to the save's JSON text before it's read. */
  renamed?: [RegExp | string, string][];
  /** Whether a stored save is still this game's (say, the same version);
   * if not, the game starts fresh. By default every save is. */
  accept?: (stored: Record<string, unknown>, fresh: D) => boolean;
  /** Puts a loaded save right (fills what's missing, moves old fields). */
  clean?: (data: D) => void;
  /** Keep a save that can't be read under key + '.unread', so a new game
   * never writes over it. */
  keepUnread?: boolean;
  /** Called the first time storage refuses a write. */
  onRefused?: () => void;
}

/** One save object kept in storage. `load()` reads it (merged over a fresh
 * save) into `data`; `write()` stores `data` (or what's given). */
export class Store<D extends object = Record<string, unknown>> {
  o: StoreOptions<D>;
  data: D | null = null;
  /** True once wiped: nothing more is written. */
  wiped = false;
  /** True if a save was there but couldn't be read (and was kept aside). */
  unread = false;
  /** True if `load()` found this game's save. */
  loaded = false;
  private refused = false;
  constructor(o: StoreOptions<D>) { this.o = o; }

  /** The stored save as it is (renamed ids put right), or null. */
  read(): Record<string, unknown> | null {
    const r = raw(this.o.key);
    if (r === null) return null;
    return JSON.parse(this.renamed(r));
  }
  private renamed(text: string): string {
    for (const [a, b] of this.o.renamed || []) text = typeof a === 'string' ? text.split(a).join(b) : text.replace(a, b);
    return text;
  }
  /** Reads the save into `data`: the stored one over a fresh one, or a fresh
   * one. Old keys are deleted first. Returns `data`. */
  load(): D {
    for (const k of this.o.old || []) remove(k);
    const fresh = this.o.fresh();
    let stored: Record<string, unknown> | null = null, r: string | null = null;
    try {
      r = raw(this.o.key);
      stored = r === null ? null : JSON.parse(this.renamed(r));
    } catch (e) {
      if (this.o.keepUnread && r !== null) { try { if (!raw(this.o.key + '.unread')) localStorage.setItem(this.o.key + '.unread', r); } catch (e2) { /* nowhere to keep it */ } }
      this.unread = r !== null;
      stored = null;
    }
    this.loaded = !!stored && (!this.o.accept || this.o.accept(stored, fresh));
    this.data = this.loaded ? (Object.assign(fresh, stored) as D) : fresh;
    if (this.o.clean) this.o.clean(this.data);
    return this.data;
  }
  /** Stores the save; false if storage refused it (said once by onRefused). */
  write(data: D | null = this.data): boolean {
    if (this.wiped || !data) return false;
    if (set(this.o.key, data)) return true;
    if (!this.refused) { this.refused = true; if (this.o.onRefused) this.o.onRefused(); }
    return false;
  }
  /** Writes one field into the stored save at once, leaving the rest as last
   * stored (or the whole save, if none is stored yet). */
  writeField(name: keyof D & string): void {
    if (this.wiped || !this.data) return;
    try {
      const r = raw(this.o.key);
      if (r === null) { this.write(); return; }
      const stored = JSON.parse(r);
      stored[name] = (this.data as Record<string, unknown>)[name];
      localStorage.setItem(this.o.key, JSON.stringify(stored));
    } catch (e) { /* written with the rest, later */ }
  }
  /** Deletes the save and stops writing (until the page loads again). */
  wipe(): void { this.wiped = true; remove(this.o.key); }
  /** Starting over: every key starting with `prefix` is deleted, and the
   * save becomes `next` (a fresh one, perhaps with settings kept). Nothing
   * more is written after. */
  startOver(prefix: string, next?: D): void {
    this.wiped = true;
    for (const k of keys(prefix)) remove(k);
    if (next) set(this.o.key, next);
  }
}
