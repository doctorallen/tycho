// Dev settings: testing switches kept in the browser's storage under a key
// of their own (never in the save), shown when the address has ?dev (or
// once they've been shown), and flags read from the address (?nogl, ?perf).
import { get, set } from './save';

/** Is `name` a flag in the address (?name or &name)? */
export function query(name: string, search: string = typeof location !== 'undefined' ? location.search : ''): boolean {
  return new RegExp('[?&]' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(search);
}

/** A set of dev switches: `s` holds them (over `defaults`), `load()` reads
 * them (and, with ?dev in the address, remembers that they're shown),
 * `save()` keeps them, `shown()` says whether the dev settings show. */
export class Flags<S extends Record<string, unknown> = Record<string, unknown>> {
  key: string; s: S & { shown?: boolean };
  constructor(key: string, defaults: S) { this.key = key; this.s = Object.assign({}, defaults); }
  load(): this {
    Object.assign(this.s, get<Record<string, unknown>>(this.key, {}) || {});
    if (query('dev') && !this.s.shown) { this.s.shown = true; this.save(); }
    return this;
  }
  save(): void { set(this.key, this.s); }
  shown(): boolean { return query('dev') || !!this.s.shown; }
}
