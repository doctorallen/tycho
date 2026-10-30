// Westmarch: the log of what happened, named for the Red Book of Westmarch,
// where the story was written down. It's part of the world's state (so it
// saves and rewinds), bounded to config.logSize entries, and every entry is
// also sent to the game as a 'log' event. With config.storySize, Irulan keeps
// what matters beyond it.
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
    const over = log.length - w.cfg.logSize;
    if (over > 0) log.splice(0, over);
    if (w.cfg.storySize > 0) w.irulan.keep(e);
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

  /** Is an entry about someone: by them, or naming them as its target (target, for or to)? */
  about(e: LogEntry, who: Id): boolean { return about(e, who); }

  /**
   * One entry in plain words, as they'd follow the person's name: "set out
   * for The Market", "felt Nothing went right", "told Kofi about did:sam:theft".
   * People and places by their names, actions, tasks and wishes by their
   * labels; an entry with no person ("day", "fact") reads on its own. Every
   * kind gets words, and a kind it doesn't know comes out as its name and its
   * data. A look: it reads the state and changes nothing.
   */
  describe(e: LogEntry): string {
    const w = this.w;
    const d: any = e.d || {};
    const name = (id: unknown): string => (typeof id === 'string' ? w.s.people[id]?.name ?? w.ring.get(id)?.name ?? id : 'someone');
    const at = (id: Id | undefined) => (id ? w.ring.get(id)?.name ?? id : id); // (a place by its name, when it has one)
    const names = (ids: unknown) => (Array.isArray(ids) && ids.length ? ids.map(name).join(', ') : 'nobody');
    const action = (id: Id) => w.actions.get(id)?.label ?? id;
    const task = (id: Id) => w.tasks.get(id)?.label ?? id;
    const wish = (id: Id) => w.wishes.get(id)?.label ?? id;
    const where = d.place ? ' at ' + at(d.place) : '';
    switch (e.k) {
      // the engine
      case 'joined': return d.id !== undefined ? `joined exchange ${d.id}` : 'joined the world';
      case 'fact': return `${d.key} became ${JSON.stringify(d.value)}`;
      case 'sensed': return `was noticed: ${d.kind}${d.what ? ' (' + d.what + ')' : ''}${where}, by ${names(d.by)}`;
      case 'did': { const t = d.for ?? d.to ?? d.target; return `${d.verb} ${t === undefined ? '' : name(t)}`.trim(); }
      case 'directed': return `was told to ${d.label ?? d.do}`;
      case 'released': return 'was let go of what they were told to do';
      case 'set-out': return `set out for ${at(d.to)}`;
      case 'arrived': return `got to ${at(d.place)}`;
      case 'started': return `${action(d.action)}${where}`;
      case 'finished': return `finished ${action(d.action)}${where}`;
      case 'stopped': return `stopped ${action(d.action)}${where}, ${Math.round(Number(d.frac) * 100)}% done`;
      case 'interrupted': return `was interrupted at ${action(d.action)}: ${d.why}`;
      case 'failed': return `couldn't: ${d.why}`;
      case 'away': return `went away until ${clockOf(d.until)}${d.summary ? ': ' + d.summary : ''}`;
      case 'back': return `came back${d.summary ? ': ' + d.summary : ''}`;
      case 'gone': return `left for good: ${d.why}`;
      case 'timer': return `timer ${d.name} went off`;
      case 'day': return `day ${d.day} began`;
      case 'promoted': return `stepped out of the passers-by (${d.stranger})`;
      case 'tuned': return `was tuned: ${d.module} ` + Object.entries(d.values || {}).map(([k, v]) => `${k} ${v}`).join(', ');
      case 'skill': return `reached ${d.level} at ${d.skill}`;
      case 'wished': return `wished for ${wish(d.wish)}`;
      case 'granted': return `got their wish: ${wish(d.wish)}`;
      case 'faded': return `stopped wishing for ${wish(d.wish)}`;
      // Reverie
      case 'felt': return `felt ${d.label ?? d.feeling}`;
      case 'broke': return `broke down: ${d.kind}`;
      case 'changed': return `remembered ${d.memory} differently`;
      // Fellowship
      case 'met': return `spent time with ${name(d.target)}`;
      case 'regard': return `thought ${Number(d.by) < 0 ? 'less' : 'more'} of ${name(d.target)}: ${d.why}`;
      case 'sentiment': return `felt about ${name(d.target)}: ${d.label}`;
      // Wormtongue
      case 'witnessed': return `saw ${d.kind} by ${d.recognized ? name(d.actor) : 'someone'}${d.what ? ' (' + d.what + ')' : ''}${d.times ? ', ' + d.times + ' times now' : ''}`;
      case 'warn': return `warned ${name(d.actor)} about ${d.kind}${d.n > 1 ? ', ' + d.n + ' times now' : ''}`;
      case 'report': return `reported ${d.kind} by ${name(d.actor)}${d.to ? ' to ' + name(d.to) : ''}`;
      case 'silenced': return `${d.ok ? 'was' : 'wasn\'t'} silenced by ${name(d.actor)} (${d.how})`;
      case 'told': return `told ${name(d.to)} about ${d.key}`;
      case 'exposed': return `was exposed: ${d.key}`;
      case 'owes': return `owes ${name(d.target)} ${d.n === 1 ? 'a favor' : d.n + ' favors'}`;
      // Cityspeak
      case 'said': return `said ${d.key}${d.to ? ' to ' + name(d.to) : ''}`;
      case 'social': return `${d.act} with ${name(d.target)} went ${d.ok ? 'well' : 'badly'}`;
      // Mentat
      case 'planned': return `planned ${task(d.task)}: ${d.method}`;
      case 'no-plan': return `found no way to ${task(d.task)}`;
      case 'route': return `worked out how to get ${d.item}: ${(d.steps || []).map(action).join(', then ')}`;
      case 'replanned': return `planned ${task(d.task)} again: ${d.why}`;
      case 'done-plan': return `saw ${task(d.task)} through in ${d.minutes} minutes`;
      case 'gave-up': return `gave up on ${task(d.task)}: ${d.why}`;
      case 'set-aside': return `set ${task(d.task)} aside`;
      case 'resumed': return `went back to ${task(d.task)}`;
      // Gaff, Ceres, Cradle, Delos
      case 'director': return `the director began ${d.storylet}${where}`;
      case 'rent': return d.missed !== undefined ? `missed the rent (${d.missed})` : `paid the rent (${d.paid})`;
      case 'paired': return `paired with ${name(d.target)}`;
      case 'born': return `was born to ${names(d.parents)}`;
      case 'stage': return `grew from ${d.from} to ${d.to}`;
      case 'mutated': return `was born with a mutation: ${d.kind} ${d.what}`;
      // Athelas
      case 'afflicted': return `came down with ${d.course}${d.again ? ' again' : ''}${d.from ? ' from ' + name(d.from) : ''}`;
      case 'course': return `${d.course}: ${d.phase}`;
      case 'shows': return `shows ${d.course}: ${d.phase}`;
      case 'recovered': return `got over ${d.course}${d.cured ? ' (' + d.cured + ')' : ''}`;
      case 'tended': return `was seen to${d.by ? ' by ' + name(d.by) : ''}: ${names(d.courses)}`;
      case 'fatal': return `${d.course} turned fatal: ${d.phase}`;
      // Voice
      case 'talk': return `was talked to by ${name(d.by)}`;
      case 'talked': return `finished talking with ${name(d.by)}${d.why ? ': ' + d.why : ''}`;
      case 'learned': return `learned ${d.key} from ${name(d.by)}`;
      case 'promised': return `was promised ${d.promise} by ${name(d.by)}`;
      case 'promise': return `${name(d.by)}'s promise of ${d.promise}: ${d.state}`;
      // Bree
      case 'exchange': return `${d.kind} with ${names(d.with)} began (exchange ${d.id})`;
      case 'parted': return `left exchange ${d.id}`;
      case 'escalated': return `${d.from} with ${name(d.against)} turned into ${d.to} (exchange ${d.id})`;
      case 'saw': return `saw ${name(d.actor)} ${d.kind}${d.against ? ' with ' + name(d.against) : ''}`;
      case 'exchanged': return `${d.kind} with ${names(d.with)} ended ${d.outcome} after ${d.turns} turn${d.turns === 1 ? '' : 's'}`;
      case 'grudge': return `bears ${name(d.against)} a grudge (${d.why}): ${d.strength}`;
      case 'mended': return `made it up with ${name(d.with)}${d.why ? ': ' + d.why : ''}`;
      case 'feud': return Number(d.strength) > 0 ? `feuds with ${name(d.with)} (${d.why}): ${d.strength}` : `ended the feud with ${name(d.with)}`;
      // Morgul
      case 'harm': return `was harmed${d.by ? ' by ' + name(d.by) : ''}: ${d.kind} by ${d.via}, severity ${d.severity}${d.intent === 'meant' ? '' : ', ' + d.intent}`;
      case 'blamed': return `blamed ${name(d.by)} for harm ${d.harm} (${d.why})`;
      case 'suspect': return `suspected ${name(d.suspect)} of harm ${d.harm} (${d.why})`;
      case 'down': return 'went down';
      case 'up': return `got up${d.by ? ' with ' + name(d.by) + '\'s help' : ''}${d.why ? ': ' + d.why : ''}`;
      case 'set': return `set a ${d.kind}${where}${d.for ? ' for ' + name(d.for) : ''}`;
      case 'sprung': return `sprang a ${d.kind}${where}`;
      case 'disarmed': return `disarmed a ${d.kind}${where}`;
      case 'tainted': return `tainted ${d.item ?? 'the food'}${d.place ? ' at ' + at(d.place) : d.owner ? ' of ' + name(d.owner) + '\'s' : ''} with ${d.course}`;
      case 'yielded': return `gave in to ${name(d.to)}`;
      case 'respond': return `answered ${name(d.to)}: ${d.act}`;
      case 'spared': return `survived ${d.course}`;
      case 'noticed': return `noticed ${d.course} (harm ${d.harm})`;
      case 'healed': return `healed of ${d.course}`;
      case 'warned': return `warned ${name(d.to)} of a ${d.trap !== undefined ? 'trap' : 'taint'}`;
      case 'killed': return `was killed${d.by ? ' by ' + name(d.by) : ''}`;
    }
    // a kind it doesn't know: its name and its data
    const rest = Object.entries(d).map(([k, v]) => `${k} ${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ');
    return rest ? `${e.k}: ${rest}` : e.k;
  }

  /**
   * A short chronicle of someone's day since a time, in plain sentences:
   * "08:10 set out for the cafe", "08:24 started eat_bread at cafe". Instead
   * of a time it takes a list of entries (the game's own, kept from the 'log'
   * events, to reach back further than the log keeps).
   */
  chronicle(who: Id, since: Minutes | LogEntry[]): string[] {
    const w = this.w;
    const out: string[] = [];
    const entries = typeof since === 'number' ? this.find({ who, since }) : since.filter((e) => about(e, who));
    for (const e of entries) {
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
      if (CHRONICLED.has(e.k)) out.push(`${clock} ${this.describe(e)}`);
    }
    return out;
  }
}

/** The kinds a chronicle tells of someone's own doings. */
const CHRONICLED = new Set(['set-out', 'arrived', 'started', 'failed', 'felt', 'told', 'broke', 'met', 'did']);
