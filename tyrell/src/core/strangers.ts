// Strangers: the passers-by who don't need a name. A district declares how
// many people pass through each hour and on what errands; Tyrell works out,
// from the seed alone, who is where at any moment. They cost nothing until
// someone looks: then one can be promoted to a real person with a mind (as
// Watch Dogs: Legion filled in a stranger's life only when you profiled them).
import type { Body, Id, PersonDef } from './types';
import type { World } from './world';
import { HOUR, Stream, clamp } from './util';

export interface StrangerErrand {
  /** Where they come from (a street end, a station). */
  from: Id;
  /** Where they're going. */
  to: Id;
  /** What they do there (an action id, for its pose). Default: they pass through. */
  action?: Id;
  /** How long they stay: minutes or [min, max]. Default 0 (passing through). */
  minutes?: number | [number, number];
  weight?: number;
  /** Only during these hours. */
  hours?: [number, number];
}

export interface StrangerDef {
  /** How many set out each hour: one number, or 24 (one per hour of the day). */
  perHour: number | number[];
  errands: StrangerErrand[];
  /** Fills in what the game needs to draw one (a look), from their own stream. */
  data?: (r: Stream, id: string) => Record<string, unknown>;
}

export class Strangers {
  private defs = new Map<string, StrangerDef>();

  constructor(private w: World) {
    w.defineInput('promote', (sid: string, given: Id | null, def: PersonDef) => {
      const id = given ?? `p${++w.s.ids}`;
      const st = this.store();
      st[sid] = id;
      const b = this.find(sid);
      const p = w.input('person', [id, { ...def, place: def.place ?? b?.place ?? b?.travel?.to ?? undefined, data: { ...(b?.data || {}), ...(def.data || {}) }, tags: [...(def.tags || []), 'promoted'] }]);
      w.log('promoted', id, { stranger: sid });
      return (p as { id: Id }).id;
    });
  }

  private store(): Record<string, Id> { return (this.w.s.mod['@strangers'] ||= {}); }

  /** Declares the passers-by of a region. */
  define(region: string, def: StrangerDef): void { this.defs.set(region, def); }

  /** The strangers in a region at a time (default now), as bodies. */
  at(region: string, t = this.w.s.now): Body[] {
    const def = this.defs.get(region);
    if (!def || !def.errands.length) return [];
    const out: Body[] = [];
    const H = Math.floor(t / HOUR);
    for (let k = 4; k >= 0; k--) {
      const hh = H - k;
      const hourOfDay = ((hh % 24) + 24) % 24;
      const count = Array.isArray(def.perHour) ? def.perHour[hourOfDay] ?? 0 : def.perHour;
      for (let i = 0; i < count; i++) {
        const b = this.make(region, def, hh, i, t);
        if (b) out.push(b);
      }
    }
    return out;
  }

  /** One stranger by id ('~region:hour:i'), as a body at a time. */
  find(sid: string, t = this.w.s.now): Body | null {
    const m = /^~(.*):(-?\d+):(\d+)$/.exec(sid);
    if (!m) return null;
    const def = this.defs.get(m[1]);
    return def ? this.make(m[1], def, Number(m[2]), Number(m[3]), t, true) : null;
  }

  private make(region: string, def: StrangerDef, hh: number, i: number, t: number, any = false): Body | null {
    const w = this.w;
    const sid = `~${region}:${hh}:${i}`;
    if (this.store()[sid]) return null;
    const r = new Stream(w.s.seed, 'stranger', region, hh, i);
    const setOut = hh * HOUR + r.range(0, HOUR);
    const hour = ((hh % 24) + 24) % 24;
    const errands = def.errands.filter((e) => !e.hours || (e.hours[0] <= e.hours[1] ? hour >= e.hours[0] && hour < e.hours[1] : hour >= e.hours[0] || hour < e.hours[1]));
    const e = r.weighted(errands, (x) => x.weight ?? 1);
    if (!e) return null;
    const inMin = Math.max(1, w.ring.travel(e.from, e.to));
    const stay = e.minutes === undefined ? 0 : Array.isArray(e.minutes) ? r.range(e.minutes[0], e.minutes[1]) : e.minutes;
    const outMin = stay > 0 ? Math.max(1, w.ring.travel(e.to, e.from)) : 0;
    const arrive = setOut + inMin, leave = arrive + stay, gone = leave + outMin;
    const data = def.data ? def.data(r, sid) : undefined;
    const base = { id: sid, name: '', slot: undefined as string | undefined, data };
    if (t >= setOut && t < arrive) {
      const f = clamp((t - setOut) / inMin);
      return { ...base, place: null, action: 'travel', next: e.action ?? 'pass', pose: 'walk', progress: f, start: setOut, end: arrive, travel: { from: e.from, to: e.to, start: setOut, end: arrive, f } };
    }
    if (stay > 0 && t >= arrive && t < leave) {
      return { ...base, place: e.to, action: e.action ?? 'idle', pose: (e.action && w.actions.get(e.action)?.pose) || 'idle', progress: clamp((t - arrive) / stay), start: arrive, end: leave };
    }
    if (outMin > 0 && t >= leave && t < gone) {
      const f = clamp((t - leave) / outMin);
      return { ...base, place: null, action: 'travel', next: 'leave', pose: 'walk', progress: f, start: leave, end: gone, travel: { from: e.to, to: e.from, start: leave, end: gone, f } };
    }
    return any ? { ...base, place: null, action: 'gone', pose: 'idle', progress: 1, start: setOut, end: gone } : null;
  }

  /** Turns a stranger into a person with a mind. Returns the new person's id. */
  promote(sid: string, def: PersonDef = {}, id?: Id): Id {
    return this.w.input('promote', [sid, id ?? null, def]) as Id;
  }

  /** Has this stranger been promoted, and to whom? */
  promoted(sid: string): Id | undefined { return this.store()[sid]; }
}
