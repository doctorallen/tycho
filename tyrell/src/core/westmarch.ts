// Westmarch: the log of what happened, named for the Red Book of Westmarch,
// where the story was written down. It's part of the world's state (so it
// saves and rewinds), bounded to config.logSize entries, and every entry is
// also sent to the game as a 'log' event.
import type { Id, LogEntry, Minutes } from './types';
import type { World } from './world';
import { hourOf } from './util';

export interface LogFilter { k?: string | string[]; who?: Id; since?: Minutes; until?: Minutes }

export class Westmarch {
  constructor(private w: World) {}

  /** Writes an entry and tells the game. */
  write(k: string, who?: Id, d?: Record<string, unknown>): void {
    const w = this.w;
    const e: LogEntry = { t: w.s.now, k };
    if (who !== undefined) e.who = who;
    if (d !== undefined) e.d = d;
    const log = w.s.log;
    log.push(e);
    const over = log.length - w.config.logSize;
    if (over > 0) log.splice(0, over);
    w.emit('log', e);
  }

  /** Entries matching a filter, oldest first. */
  find(f: LogFilter = {}): LogEntry[] {
    const kinds = f.k === undefined ? null : new Set(Array.isArray(f.k) ? f.k : [f.k]);
    return this.w.s.log.filter((e) =>
      (!kinds || kinds.has(e.k)) && (f.who === undefined || e.who === f.who || (e.d && (e.d as any).target === f.who)) &&
      (f.since === undefined || e.t >= f.since) && (f.until === undefined || e.t <= f.until));
  }

  /** Everything since a time. */
  since(t: Minutes, k?: string | string[]): LogEntry[] { return this.find({ since: t, k }); }

  /**
   * A short chronicle of someone's day since a time, in plain sentences:
   * "08:10 set out for the cafe", "08:24 started eat_bread at cafe".
   */
  chronicle(who: Id, since: Minutes): string[] {
    const w = this.w;
    const out: string[] = [];
    for (const e of this.find({ who, since })) {
      const hh = hourOf(e.t);
      const h = Math.floor(hh), m = Math.floor((hh - h) * 60);
      const clock = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const d: any = e.d || {};
      // something someone else did with them
      if (e.who !== who) {
        const other = w.s.people[e.who ?? '']?.name ?? e.who ?? 'someone';
        if (e.k === 'started') out.push(`${clock} ${other}: ${w.actions.get(d.action)?.label ?? d.action} with them`);
        else if (e.k === 'did') out.push(`${clock} ${other} ${d.verb} them`);
        else if (e.k === 'met') out.push(`${clock} spent time with ${other}`);
        continue;
      }
      let line: string;
      switch (e.k) {
        case 'set-out': line = `set out for ${d.to}`; break;
        case 'arrived': line = `got to ${d.place}`; break;
        case 'started': line = `${w.actions.get(d.action)?.label ?? d.action}${d.place ? ' at ' + d.place : ''}`; break;
        case 'failed': line = `couldn't: ${d.why}`; break;
        case 'felt': line = `felt ${d.label ?? d.feeling}`; break;
        case 'told': line = e.who === who ? `told ${d.to} about ${d.key}` : `heard about ${d.key} from ${e.who}`; break;
        case 'broke': line = `broke down: ${d.kind}`; break;
        case 'met': line = `spent time with ${w.s.people[d.target]?.name ?? d.target}`; break;
        case 'did': line = `${d.verb} ${w.s.people[d.for]?.name ?? d.for ?? ''}`.trim(); break;
        default: continue;
      }
      out.push(`${clock} ${line}`);
    }
    return out;
  }
}
