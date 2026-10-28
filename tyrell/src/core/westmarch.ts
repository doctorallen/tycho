// Westmarch: the log of what happened, named for the Red Book of Westmarch,
// where the story was written down. It's part of the world's state (so it
// saves and rewinds), bounded to config.logSize entries, and every entry is
// also sent to the game as a 'log' event.
import type { Id, LogEntry, Minutes } from './types';
import type { World } from './world';
import { clockOf } from './util';

export interface LogFilter { k?: string | string[]; who?: Id; since?: Minutes; until?: Minutes }

/** Is an entry about someone: by them, or naming them as its target (target, for or to)? */
function about(e: LogEntry, who: Id): boolean {
  if (e.who === who) return true;
  const d = e.d as Record<string, unknown> | undefined;
  if (!d) return false;
  // a set-out's `to` is a place and a report's a group
  return d.target === who || d.for === who || (d.to === who && e.k !== 'set-out' && e.k !== 'report');
}

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
      (!kinds || kinds.has(e.k)) && (f.who === undefined || about(e, f.who)) &&
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
      const clock = clockOf(e.t);
      const d: any = e.d || {};
      // something someone else did with them
      if (e.who !== who) {
        const other = w.s.people[e.who ?? '']?.name ?? e.who ?? 'someone';
        if (e.k === 'started') out.push(`${clock} ${other}: ${w.actions.get(d.action)?.label ?? d.action} with them`);
        else if (e.k === 'did') out.push(`${clock} ${other} ${d.verb} them`);
        else if (e.k === 'told') out.push(`${clock} heard about ${d.key} from ${other}`);
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
        case 'told': line = `told ${w.s.people[d.to]?.name ?? d.to} about ${d.key}`; break;
        case 'broke': line = `broke down: ${d.kind}`; break;
        case 'met': line = `spent time with ${w.s.people[d.target]?.name ?? d.target}`; break;
        case 'did': { const t = d.for ?? d.to ?? d.target; line = `${d.verb} ${w.s.people[t]?.name ?? t ?? ''}`.trim(); break; }
        default: continue;
      }
      out.push(`${clock} ${line}`);
    }
    return out;
  }
}
