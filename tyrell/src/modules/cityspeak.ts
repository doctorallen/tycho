// Cityspeak: talk. Named for Blade Runner's street language, a mix of
// everything spoken in the city.
//
//   lines      chosen by the most specific rule that matches (Valve's dialogue
//              rules; Merryfolk's chooser), with weights, cooldowns, a memory
//              of what was said, and replies; the game owns the words
//   barks      two people near the player answering each other
//   practices  situations with roles (dinner at the bar, a sale at the till,
//              a police stop) that make role actions more appealing to whoever
//              fills each role (Versu)
//   social acts aimed at someone, which the target may refuse (Prom Week's
//              Comme il Faut), with feelings and regard either way
//   the room   the mood of the people in a place, for lines to read
//   ink        a bridge so ink stories can ask Tyrell about the world
import type { Module } from '../core/module';
import type { Candidate, Cond, Consideration, Ctx, Doing, Effect, Id, PersonState, Value } from '../core/types';
import type { World } from '../core/world';
import { HOUR, clamp, inHours, hourOf, round } from '../core/util';

export interface LineDef {
  /** The line's key: what the game looks up for the words. */
  key: string;
  /** Words, if the engine should carry them (one picked at random). */
  text?: string | string[];
  /** Who says it: a person id, 'tag:<tag>', 'job:<id>', or conditions. */
  who?: string | Cond[];
  /** Conditions on the speaker and the moment. */
  when?: Cond[];
  /** Conditions on the listener (the target in conditions). */
  to?: Cond[];
  /** The topic it answers ('greet', 'bye', 'work', 'rumor'...). */
  topic?: string;
  /** Among equally specific lines, how likely. Default 1. */
  weight?: number;
  /** Counts this much more toward how specific it is (a line that should win among its equals). Default 0. */
  pri?: number;
  /** Minutes before the same speaker says it again. */
  cooldown?: number;
  /** Said only once per speaker. */
  once?: boolean;
  /** Effects when said (said on purpose by the game, not as a bark). */
  then?: Effect[];
  /** The key (or topic, as 'topic:x') the listener answers with. */
  reply?: string;
}

export interface PracticeDef {
  id: Id;
  /** Where: a place id or 'tag:<tag>'. */
  at: Id;
  hours?: [number, number];
  /** Roles: who can fill them and the actions they make more appealing. */
  roles: Record<string, { who?: Cond[]; job?: Id; actions: Id[] }>;
  /** Shifts the mood of the room (-1..1). */
  tone?: number;
  /** How much more appealing role actions are. Default config.practiceBoost (1.5). */
  boost?: number;
}

export interface SocialActDef {
  id: Id;
  /** The target's side: considerations multiplied (ctx.person is the target, ctx.target the asker). */
  accept?: Consideration[];
  /** Or plain conditions on the target. */
  acceptIf?: Cond[];
  /** Accepted when the score beats a draw against it (default) or this threshold. */
  threshold?: number;
  onAccept?: Effect[];
  onRefuse?: Effect[];
  /** Feelings: for the asker on yes and no, and for the target. */
  feelings?: { accepted?: Id; refused?: Id; target?: Id };
  /** Regard change for the target toward the asker: [on yes, on no]. */
  regard?: [number, number];
}

export interface Said { who: Id; key: string; text?: string; to?: Id; topic?: string; reply?: string }

/** How choose() picks a line. */
export interface ChooseOpts {
  /** The listener (the target in lines' conditions). */
  to?: Id;
  topic?: string;
  /** Leave out lines with no topic (with a topic given, they'd otherwise count as its least specific lines). */
  exact?: boolean;
  /** Pass over lines by key (said lately), unless there's nothing else. */
  avoid?: (key: string) => boolean;
  /** Varies the draw among equally specific lines. */
  salt?: Array<string | number>;
  skip?: (l: LineDef, i: number) => boolean;
}

export interface CityspeakConfig {
  /**
   * The headline knob: how chatty people near the player are. It scales the
   * chance that two people meeting in view strike up an exchange (1, the
   * default, always does; 0 never) and how many lines it runs to (barkLength
   * times it, rounded, at least one). A person's own (PersonDef.tune.cityspeak)
   * multiplies it for them: an exchange takes both people's. Barks change
   * nothing in the world, so neither does this.
   */
  chatter: number;
  /** Seconds between lines in a bark exchange. Default 2.2. */
  barkGap: number;
  /** Most lines in one exchange. Default 3. */
  barkLength: number;
  /** Minutes before someone barks the same line again, for a line with no `cooldown`. Default 60. */
  barkCooldown: number;
  /** How much more appealing role actions are, for a practice with no `boost`. Default 1.5. */
  practiceBoost: number;
  /** The share of an action with a `social` act that must be done for the act to be resolved. Default 0.5. */
  socialDone: number;
  /** The mood of a room with nobody in it (before the practices' tone). Default 0.5. */
  roomEmpty: number;
}

export const DEFAULT_CITYSPEAK: CityspeakConfig = { chatter: 1, barkGap: 2.2, barkLength: 3, barkCooldown: 60, practiceBoost: 1.5, socialDone: 0.5, roomEmpty: 0.5 };

interface State {
  /** By speaker, by line key (or index, for a line without one): when they last said it. */
  said: Record<Id, Record<string, number>>;
  /** Lines said before save schema 2, by speaker, by line index (read until said again). */
  byIndex?: Record<Id, Record<string, number>>;
  acts: Array<{ t: number; act: Id; from: Id; to: Id; ok: boolean }>;
}

/** What a line is remembered by: its key, or its index if it has none. */
const lineKey = (l: LineDef, i: number): string => (l.key !== undefined && l.key !== '' ? l.key : String(i));

export class Cityspeak implements Module {
  readonly name = 'cityspeak';
  readonly config: CityspeakConfig;
  readonly knobs = { chatter: 'person' } as const;
  readonly lines: LineDef[] = [];
  readonly practices = new Map<Id, PracticeDef>();
  readonly acts = new Map<Id, SocialActDef>();
  /** Bark cooldowns are kept outside the state: barks only happen near the player, so they mustn't change the world. */
  private barkSaid = new Map<string, number>();
  private w!: World;

  constructor(cfg: Partial<CityspeakConfig> = {}) { this.config = { ...DEFAULT_CITYSPEAK, ...cfg }; }

  /** Seconds between lines in a bark exchange (config.barkGap: setting it here sets the config). */
  get barkGap(): number { return this.w ? this.c.barkGap : this.config.barkGap; }
  set barkGap(v: number) { this.config.barkGap = v; }
  /** Most lines in one exchange (config.barkLength: setting it here sets the config). */
  get barkLength(): number { return this.w ? this.c.barkLength : this.config.barkLength; }
  set barkLength(v: number) { this.config.barkLength = v; }

  init(): State { return { said: {}, acts: [] }; }
  private get st(): State { return this.w.s.mod.cityspeak as State; }
  /** The config in force: as declared, under any world.tune. */
  private get c(): CityspeakConfig { return this.w.tuned(this.name, this.config); }
  /** How chatty two people are together: the world's chatter, times each one's own. */
  private chatter(a: Id, b: Id): number {
    const w = this.w;
    return this.c.chatter * w.own(w.s.people[a], this.name, 'chatter') * w.own(w.s.people[b], this.name, 'chatter');
  }

  attach(w: World): void {
    this.w = w;
    w.lang.term('room', (c) => (c.person?.place ? this.room(c.person.place) : 0.5));
    w.lang.term('said', (c, a) => (c.person ? this.hasSaid(c.person.id, a) : false));
    w.lang.term('practice', (c, a) => (c.person?.place ? this.activeAt(c.person.place).some((p) => p.id === a) : false));
    w.lang.term('role', (c, a) => (c.person ? this.roleOf(c.person, a) : false));
    w.defineInput('say', (who: Id, opts: { to?: Id; topic?: string }) => this.applySay(who, opts));
    w.defineInput('social', (act: Id, from: Id, to: Id) => this.applyResolve(act, from, to));
  }

  // -------------------------------------------------------------------------
  // Declaring
  // -------------------------------------------------------------------------

  line(def: LineDef): this { this.lines.push(def); return this; }
  addLines(defs: LineDef[]): this { for (const d of defs) this.lines.push(d); return this; }
  practice(def: PracticeDef): this { this.practices.set(def.id, def); return this; }
  act(def: SocialActDef): this { this.acts.set(def.id, def); return this; }

  // -------------------------------------------------------------------------
  // Lines
  // -------------------------------------------------------------------------

  /** When someone last said a line (undefined if never). */
  private lastSaid(who: Id, l: LineDef, i: number): number | undefined {
    return this.st.said[who]?.[lineKey(l, i)] ?? this.st.byIndex?.[who]?.[String(i)];
  }

  /** Has someone said a line with this key (or, as before 1.1, at this index)? */
  private hasSaid(who: Id, key: string): boolean {
    if (this.st.said[who]?.[key] !== undefined) return true;
    return this.lines.some((l, i) => (lineKey(l, i) === key || String(i) === key) && this.lastSaid(who, l, i) !== undefined);
  }

  /**
   * What a person would say now, without saying it (nothing changes). The
   * most specific matching line wins; ties go by weight. Options: `to` (the
   * listener), `topic`; `exact` leaves out lines without a topic; `avoid`
   * passes over lines by key (said lately) unless every line at the most
   * specific level is avoided, when the most specific fresh line at any
   * level wins, and only then a repeat; `salt` varies the draw among equals
   * (Voice passes the talk's counter).
   */
  choose(who: Id, opts: ChooseOpts = {}): Said | null {
    return this.pick(who, opts)?.said ?? null;
  }

  /** The line choose() would pick, with its index. Looking only: chance: conditions peek. */
  private pick(who: Id, opts: ChooseOpts): { said: Said; i: number } | null {
    return this.w.peek(() => this.pickNow(who, opts));
  }

  private pickNow(who: Id, opts: ChooseOpts): { said: Said; i: number } | null {
    const w = this.w;
    const p = w.s.people[who];
    if (!p) return null;
    const ctx: Ctx = w.ctx(p, { target: opts.to ?? null, topic: opts.topic, place: p.place });
    const now = w.s.now;
    let best: Array<{ l: LineDef; i: number }> = [];
    let bestSpec = -1;
    // with `avoid`: every line that fits, by how specific it is
    const all: Array<{ l: LineDef; i: number; spec: number }> | null = opts.avoid ? [] : null;
    this.lines.forEach((l, i) => {
      if (opts.topic !== undefined && l.topic !== undefined && l.topic !== opts.topic) return;
      if (opts.topic === undefined && l.topic !== undefined) return;
      if (opts.exact && l.topic === undefined) return;
      if (opts.skip?.(l, i)) return;
      let spec = (l.topic !== undefined ? 1 : 0) + (l.pri ?? 0);
      if (l.who !== undefined) {
        if (typeof l.who === 'string') {
          if (!this.whoMatches(p, l.who)) return;
          spec += 2;
        } else {
          if (!w.lang.all(l.who, ctx)) return;
          spec += l.who.length;
        }
      }
      if (l.when) { if (!w.lang.all(l.when, ctx)) return; spec += l.when.length; }
      if (l.to) {
        if (!opts.to) return;
        const t = w.s.people[opts.to];
        const tctx = t ? { ...ctx } : ctx;
        if (!w.lang.all(l.to, tctx)) return;
        spec += l.to.length;
      }
      const last = this.lastSaid(who, l, i);
      if (l.once && last !== undefined) return;
      if (l.cooldown && last !== undefined && now - last < l.cooldown) return;
      if (all) all.push({ l, i, spec });
      if (spec > bestSpec) { bestSpec = spec; best = [{ l, i }]; } else if (spec === bestSpec) best.push({ l, i });
    });
    if (!best.length) return null;
    if (all && opts.avoid) {
      // the most specific level with a line not avoided; else the most specific lines, said again
      const avoid = opts.avoid;
      const levels = [...new Set(all.map((x) => x.spec))].sort((a, b) => b - a);
      for (const lv of levels) {
        const fresh = all.filter((x) => x.spec === lv && !avoid(lineKey(x.l, x.i)));
        if (fresh.length) { best = fresh.map(({ l, i }) => ({ l, i })); break; }
      }
    }
    const r = w.worldStreamPeek(who, 'line', now, ...(opts.salt || []));
    const pick = r.weighted(best, (x) => x.l.weight ?? 1) || best[0];
    const out: Said = { who, key: pick.l.key };
    if (pick.l.text !== undefined) out.text = Array.isArray(pick.l.text) ? r.pick(pick.l.text) : pick.l.text;
    if (opts.to) out.to = opts.to;
    if (opts.topic) out.topic = opts.topic;
    if (pick.l.reply) out.reply = pick.l.reply;
    return { said: out, i: pick.i };
  }

  /** Says something on purpose (the game asks): chosen, remembered, its effects applied. */
  say(who: Id, opts: { to?: Id; topic?: string } = {}): Said | null {
    return this.w.input('say', [who, opts]) as Said | null;
  }

  private applySay(who: Id, opts: { to?: Id; topic?: string }): Said | null {
    const picked = this.pick(who, opts);
    if (!picked) return null;
    const { said, i } = picked;
    const l = this.lines[i];
    (this.st.said[who] ||= {})[lineKey(l, i)] = this.w.s.now;
    if (this.st.byIndex?.[who]) delete this.st.byIndex[who][String(i)];
    const p = this.w.s.people[who];
    if (l.then && p) this.w.lang.applyAll(l.then, this.w.ctx(p, { target: opts.to ?? null, topic: opts.topic }));
    this.w.log('said', who, { key: said.key, ...(opts.to ? { to: opts.to } : {}) });
    this.w.emit('say', said);
    return said;
  }

  /** The answer someone gives to a line. */
  answer(to: Said, by: Id): Said | null { return this.reply(to, by)?.said ?? null; }

  private reply(to: Said, by: Id): { said: Said; i: number } | null {
    if (!to.reply) return null;
    if (to.reply.startsWith('topic:')) return this.pick(by, { to: to.who, topic: to.reply.slice(6) });
    const i = this.lines.findIndex((l) => l.key === to.reply);
    if (i < 0) return null;
    const l = this.lines[i];
    const out: Said = { who: by, key: l.key, to: to.who };
    if (l.text !== undefined) out.text = Array.isArray(l.text) ? l.text[0] : l.text;
    return { said: out, i };
  }

  private whoMatches(p: PersonState, who: string): boolean {
    if (who === p.id) return true;
    if (who.startsWith('tag:')) return !!p.def.tags?.includes(who.slice(4));
    if (who.startsWith('job:')) return p.def.job?.id === who.slice(4);
    if (who.startsWith('group:')) return !!p.def.groups?.includes(who.slice(6));
    return false;
  }

  /**
   * A short exchange between two people near the player: lines that don't
   * change the world (barks). Returns the lines with a delay for each.
   */
  converse(a: Id, b: Id, topic = 'chat'): Array<Said & { after: number }> {
    const out: Array<Said & { after: number }> = [];
    const now = this.w.s.now;
    const c = this.c;
    // the headline knob: a chattier pair talks longer, a quiet one less (and a mute one not at all)
    const k = this.chatter(a, b);
    if (!(k > 0)) return out;
    const most = k === 1 ? c.barkLength : Math.max(1, Math.round(c.barkLength * k));
    const skip = (who: Id) => (l: LineDef, i: number) => {
      const last = this.barkSaid.get(who + '|' + lineKey(l, i));
      return last !== undefined && now - last < (l.cooldown ?? c.barkCooldown);
    };
    let speaker = a, listener = b;
    let line = this.pick(speaker, { to: listener, topic, skip: skip(speaker) });
    for (let n = 0; line && n < most; n++) {
      this.barkSaid.set(speaker + '|' + lineKey(this.lines[line.i], line.i), now);
      out.push({ ...line.said, after: n * c.barkGap });
      const reply = this.reply(line.said, listener);
      [speaker, listener] = [listener, speaker];
      line = reply;
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Practices and the room
  // -------------------------------------------------------------------------

  /** Practices going on at a place now. */
  activeAt(place: Id): PracticeDef[] {
    const w = this.w, h = hourOf(w.s.now);
    const out: PracticeDef[] = [];
    for (const pr of this.practices.values()) {
      if (pr.hours && !inHours(h, pr.hours)) continue;
      const at = pr.at;
      const ok = at.startsWith('tag:') ? w.ring.hasTag(place, at.slice(4)) : w.ring.within(place, at);
      if (ok) out.push(pr);
    }
    return out;
  }

  /** Does a person fill a role at their place? */
  roleOf(p: PersonState, role: string): boolean {
    if (!p.place) return false;
    for (const pr of this.activeAt(p.place)) {
      const r = pr.roles[role];
      if (r && this.fills(p, r)) return true;
    }
    return false;
  }

  private fills(p: PersonState, r: { who?: Cond[]; job?: Id }): boolean {
    if (r.job && p.def.job?.id !== r.job) return false;
    if (r.who && !this.w.lang.all(r.who, this.w.ctx(p, { place: p.place }))) return false;
    return true;
  }

  /** The mood of the room: everyone at the place, plus the practices' tone. */
  room(place: Id): number {
    const w = this.w;
    const ids = w.ring.present(w.ring.root(place));
    let m = this.c.roomEmpty;
    if (ids.length && w.reverie) m = ids.reduce((acc, id) => acc + w.reverie!.mood(id), 0) / ids.length;
    for (const pr of this.activeAt(place)) m += pr.tone ?? 0;
    return round(clamp(m), 4);
  }

  consider(p: PersonState, c: Candidate): Array<[string, number]> | void {
    const place = c.place ?? p.place;
    if (!place) return;
    const out: Array<[string, number]> = [];
    for (const pr of this.activeAt(place)) {
      for (const role in pr.roles) {
        const r = pr.roles[role];
        if (!r.actions.includes(c.id) || !this.fills(p, r)) continue;
        out.push([`${pr.id}: ${role}`, pr.boost ?? this.c.practiceBoost]);
        break;
      }
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Social acts
  // -------------------------------------------------------------------------

  /** An action that says something on starting (its `says` topic) says it. */
  started(p: PersonState, d: Doing): void {
    if (d.kind !== 'act') return;
    const topic = this.w.actions.get(d.action)?.says;
    if (topic) this.applySay(p.id, d.target ? { topic, to: d.target } : { topic });
  }

  ended(p: PersonState, d: Doing, frac: number, interrupted: boolean): void {
    if (d.kind !== 'act' || interrupted || frac < this.c.socialDone || !d.target) return;
    const a = this.w.actions.get(d.action);
    if (!a?.social) return;
    this.applyResolve(a.social, p.id, d.target);
  }

  /** Resolves a social act now (from the game: recorded): does the target accept? Applies the outcome. */
  resolve(actId: Id, from: Id, to: Id): boolean { return this.w.input('social', [actId, from, to]) === true; }

  /** Resolves a social act inside the simulation. */
  applyResolve(actId: Id, from: Id, to: Id): boolean {
    const w = this.w;
    const def = this.acts.get(actId);
    const asker = w.s.people[from], target = w.s.people[to];
    if (!def || !asker || !target) return false;
    const tctx = w.ctx(target, { target: from });
    let score = 1;
    for (const k of def.accept || []) score *= w.mind.consider(k, tctx);
    if (def.acceptIf && !w.lang.all(def.acceptIf, tctx)) score = 0;
    const r = w.stream(target);
    const ok = def.threshold !== undefined ? score >= def.threshold : r.chance(clamp(score));
    const actx = w.ctx(asker, { target: to });
    w.lang.applyAll(ok ? def.onAccept : def.onRefuse, actx);
    const rv = w.reverie;
    if (rv && def.feelings) {
      const f = ok ? def.feelings.accepted : def.feelings.refused;
      if (f) rv.applyFeel(from, f, to);
      if (def.feelings.target) rv.applyFeel(to, def.feelings.target, from);
    }
    if (def.regard && w.fellowship) w.fellowship.applyRegard(to, from, ok ? def.regard[0] : def.regard[1]);
    this.st.acts.push({ t: w.s.now, act: actId, from, to, ok });
    if (this.st.acts.length > 100) this.st.acts.shift();
    w.log('social', from, { act: actId, target: to, ok });
    w.emit('social', { act: actId, from, to, ok });
    return ok;
  }

  // -------------------------------------------------------------------------
  // Barks between people near the player
  // -------------------------------------------------------------------------

  met(a: PersonState, b: PersonState): void {
    const w = this.w;
    if (w.replaying) return;
    if (!w.clock.embodied(a.id) && !w.clock.embodied(b.id)) return;
    // the headline knob: below 1, only some meetings in view start an exchange (a draw that only looks: barks change nothing)
    const k = this.chatter(a.id, b.id);
    if (k < 1 && !(k > 0 && w.worldStreamPeek('bark', a.id, b.id, w.s.now).chance(k))) return;
    const lines = this.converse(a.id, b.id);
    if (lines.length) w.emit('bark', { a: a.id, b: b.id, lines });
  }

  // -------------------------------------------------------------------------
  // ink
  // -------------------------------------------------------------------------

  /**
   * Binds Tyrell to an ink story (inkjs): the story can call
   * tyrell_fact(key), tyrell_thinks(who, key), tyrell_regard(a, b),
   * tyrell_mood(who), tyrell_test(who, condition) and tyrell_did(actor, verb, target).
   */
  bindInk(story: { BindExternalFunction: (name: string, fn: (...args: any[]) => unknown, lookahead?: boolean) => void }): void {
    const w = this.w;
    story.BindExternalFunction('tyrell_fact', (k: string) => w.s.facts[k] ?? null, true);
    story.BindExternalFunction('tyrell_thinks', (who: Id, k: string) => w.peek(() => w.reverie?.thinks(who, k) ?? w.s.facts[k] ?? null), true);
    story.BindExternalFunction('tyrell_regard', (a: Id, b: Id) => w.fellowship?.regard(a, b) ?? 0, true);
    story.BindExternalFunction('tyrell_mood', (who: Id) => w.reverie?.mood(who) ?? 0.5, true);
    story.BindExternalFunction('tyrell_test', (who: Id, cond: string) => { const p = w.s.people[who]; return p ? w.peek(() => w.lang.test(cond, w.ctx(p))) : false; }, true);
    story.BindExternalFunction('tyrell_did', (actor: Id, verb: string, target: Id) => { w.did(actor, verb, target ? { for: target } : {}); return true; }, false);
  }
}

export { HOUR };
export type { Value };
