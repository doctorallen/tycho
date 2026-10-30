// Wormtongue: word of mouth. Named for the whisperer in Théoden's ear.
//
//   witnesses  the game reports what was seen (it owns sight); Wormtongue
//              decides whether the witness recognized who did it, what they
//              now believe, and whether they report it (Thief's guards,
//              Skyrim's crimes, Hitman's disguises)
//   heat       made of reports: who saw you and told someone
//   gossip     beliefs passing between people who spend time together, a
//              hop at a time, weakening as they go (Talk of the Town)
//   lies       someone who dislikes the subject and isn't honest may shift
//              the blame onto someone else they dislike
//   silencing  a witness can be paid or scared off
//   secrets    with a list of who knows them
//   favors     owed between people, called in later
//   repeats    (with repeatDays) how many times each has seen someone do the
//              same thing lately, and warned them about it: "What did I
//              just tell you?", and more likely to report it each time
import type { Module } from '../core/module';
import type { Id, PersonState, Stimulus, Value } from '../core/types';
import type { World } from '../core/world';
import { DAY, HOUR, clamp, round } from '../core/util';
import type { Stream } from '../core/util';

export interface CrimeDef {
  kind: string;
  /** 0..1: how bad. */
  severity: number;
  /** Heat each report adds. Default severity × config.heatPerSeverity (10). */
  heat?: number;
  /** The group reports go to (the police). Default: any group of kind 'authority'. */
  reportTo?: Id;
  /** The feeling a witness gets. Default 'witnessed'. */
  feeling?: Id;
  /** Chance a witness reports it (before temperament). Default from config. */
  report?: number;
}

export interface Report { t: number; witness: Id; actor: Id; kind: string; what?: string; to?: Id }
/** How many times a witness has seen someone do something lately (n), when last (t), and how many times they've warned them about it (warned). */
export interface Repeat { n: number; t: number; warned: number }
export interface Secret { about: Id; key: string; value: Value; knownBy: Id[] }

interface State {
  heat: Record<Id, number>;
  reports: Report[];
  secrets: Record<string, Secret>;
  favors: Record<string, number>;
  /** With repeatDays: by witness, then by 'actor:kind'. (Absent until something's counted, so a world without it hashes as before.) */
  seen?: Record<Id, Record<string, Repeat>>;
}

export interface WormtongueConfig {
  /** Base chance a witness reports a crime. */
  reportChance: number;
  /** Minutes before a report is made: [min, max]. */
  reportDelay: [number, number];
  /** Chance of recognizing someone you don't know (you always might know who you know). */
  recognizeStranger: number;
  /** Chance per meeting that someone passes something on. */
  gossipChance: number;
  /** Gossip goes at most this many hops from whoever saw it. */
  maxHops: number;
  /** Heat kept per day. */
  heatDecay: number;
  /** Chance that a dishonest teller who dislikes the subject lies. */
  lieChance: number;

  // The headline knobs: plain multipliers, 1 changing nothing. A person's
  // own (PersonDef.tune.wormtongue) multiplies these for them alone: the
  // teller's for gossip and lies, the witness's for reporting, the actor's
  // for heat and cooling.
  /** How readily gossip spreads: the chance per meeting that someone passes something on. 0: nobody tells anybody. Default 1. */
  gossip: number;
  /** How readily crimes are reported: the chance a witness who recognized the actor reports them. 0: nobody reports. Default 1. */
  reporting: number;
  /** How much heat each report adds. Default 1. */
  heat: number;
  /** How fast heat cools: heatDecay over the days. 0: it never cools. Default 1. */
  cooling: number;
  /** How readily a dishonest teller who dislikes the subject lies (lieChance). 0: nobody lies. Default 1. */
  lies: number;

  // The finer numbers.
  /** Heat a report adds per point of the crime's severity, for a crime with no `heat`. Default 10. */
  heatPerSeverity: number;
  /** Heat under this is let go at midnight. Default 0.05. */
  heatFloor: number;
  /** A belief from seeing something is at least this strong, however unclear the sighting. Default 0.3. */
  sawStrength: number;
  /** The importance of a witness's memory: crimeMemory + severity × severityMemory for a crime, plainMemory for anything else. Defaults 4, 6 and 3. */
  crimeMemory: number;
  severityMemory: number;
  plainMemory: number;
  /** How much fear (1 - courage) puts a witness off reporting. Default 0.3. */
  fearWeight: number;
  /** How much liking the actor keeps a witness quiet. Default 0.8. */
  loyalty: number;
  /**
   * How much knowing the actor keeps a witness quiet: the chance they report
   * is cut by this much for each point of their familiarity with the actor
   * (Voice's: talks had, things learned), up to familiarReportMax. Defaults
   * 0 (it doesn't count) and 1.
   */
  familiarReport: number;
  familiarReportMax: number;
  /** How clearly bystanders see a crime someone commits (a crime action's sighting strength). Default 0.8. */
  crimeSeen: number;
  /** Infamy a report adds, per point of severity, with the group it went to and with the witness's groups. Defaults 0.2 and 0.1. */
  infamyAuthority: number;
  infamyGroups: number;
  /** How strongly the authority believes what it's told in a report. Default 0.8. */
  toldAuthority: number;
  /**
   * A bribe's chance: greed × bribeGreed + (the amount, up to bribeFull) /
   * bribeFull × bribeMoney - honesty × bribeHonesty + bribeBase. Defaults
   * 0.6, 100, 0.5, 0.4 and 0.1.
   */
  bribeGreed: number;
  bribeFull: number;
  bribeMoney: number;
  bribeHonesty: number;
  bribeBase: number;
  /** A threat's chance: (1 - courage) × scareFear - honesty × scareHonesty + scareBase; and the regard it costs. Defaults 0.8, 0.2, 0.1 and -0.3. */
  scareFear: number;
  scareHonesty: number;
  scareBase: number;
  scareRegard: number;
  /** A secret is passed on only by someone whose regard for its subject is under this. Default -0.3. */
  secretSpite: number;
  /** How much more worth telling a crime is, and any other deed, than other news. Defaults 3 and 1.5. */
  juicyCrime: number;
  juicyDeed: number;
  /** News loses this much of its worth in telling an hour. Default 0.99. */
  gossipRecency: number;
  /** Someone lies only with honesty under liarBelow, about someone their regard for is under lieSpite, onto someone under scapegoat. Defaults 0.3, -0.3 and -0.2. */
  liarBelow: number;
  lieSpite: number;
  scapegoat: number;
  /** How far a listener trusts a teller: trustBase + regard × trustRegard, from trustMin to trustMax; trustAlone without Fellowship. Defaults 0.6, 0.4, 0.2, 1 and 0.7. */
  trustBase: number;
  trustRegard: number;
  trustMin: number;
  trustMax: number;
  trustAlone: number;
  /** The share of a belief's strength that survives a telling (before trust). Default 0.9. */
  toldKeep: number;
  /** A secret counts as exposed once this many know it. Default 4. */
  exposedAt: number;
  /**
   * Repeats: for how many days a witness keeps count of the times they've
   * seen someone do the same thing (each sighting, recognized or not), and warned
   * them about it (warn). That many days without seeing it again and the
   * count lapses. Default 0: nobody counts.
   */
  repeatDays: number;
  /** Each time before that a witness saw it makes them this much more likely to report it (the third time, 1 + 2 × this). Default 0. */
  repeatReport: number;
}

export const DEFAULT_WORMTONGUE: WormtongueConfig = {
  reportChance: 0.6, reportDelay: [10, 90], recognizeStranger: 0.5, gossipChance: 0.45, maxHops: 3, heatDecay: 0.85, lieChance: 0.5,
  gossip: 1, reporting: 1, heat: 1, cooling: 1, lies: 1,
  heatPerSeverity: 10, heatFloor: 0.05, sawStrength: 0.3, crimeMemory: 4, severityMemory: 6, plainMemory: 3,
  fearWeight: 0.3, loyalty: 0.8, familiarReport: 0, familiarReportMax: 1, crimeSeen: 0.8, infamyAuthority: 0.2, infamyGroups: 0.1, toldAuthority: 0.8,
  bribeGreed: 0.6, bribeFull: 100, bribeMoney: 0.5, bribeHonesty: 0.4, bribeBase: 0.1,
  scareFear: 0.8, scareHonesty: 0.2, scareBase: 0.1, scareRegard: -0.3,
  secretSpite: -0.3, juicyCrime: 3, juicyDeed: 1.5, gossipRecency: 0.99, liarBelow: 0.3, lieSpite: -0.3, scapegoat: -0.2,
  trustBase: 0.6, trustRegard: 0.4, trustMin: 0.2, trustMax: 1, trustAlone: 0.7, toldKeep: 0.9, exposedAt: 4,
  repeatDays: 0, repeatReport: 0,
};

export class Wormtongue implements Module {
  readonly name = 'wormtongue';
  readonly config: WormtongueConfig;
  readonly knobs = { gossip: 'person', reporting: 'person', heat: 'person', cooling: 'person', lies: 'person' } as const;
  readonly crimes = new Map<string, CrimeDef>();
  private w!: World;

  constructor(cfg: Partial<WormtongueConfig> = {}) { this.config = { ...DEFAULT_WORMTONGUE, ...cfg }; }

  init(): State { return { heat: {}, reports: [], secrets: {}, favors: {} }; }
  private get st(): State { return this.w.s.mod.wormtongue as State; }
  /** The config in force: as declared, under any world.tune. */
  private get c(): WormtongueConfig { return this.w.tuned(this.name, this.config); }
  /** A headline knob for someone (a person's id, or anyone else: the player): the world's, times their own. */
  private knob(name: 'gossip' | 'reporting' | 'heat' | 'cooling' | 'lies', id: Id): number { return this.c[name] * this.w.own(this.w.s.people[id], this.name, name); }

  attach(w: World): void {
    this.w = w;
    w.lang.term('heat', (c, a) => this.heat(a || c.person?.id || 'player'));
    w.lang.term('owes', (c, a) => (c.person ? this.owes(c.person.id, a || c.target || '') : 0));
    w.lang.term('owed', (c, a) => (c.person ? this.owes(a || c.target || '', c.person.id) : 0));
    w.lang.term('saw', (c, a) => {
      // 'saw:player.strip': does this person believe they saw it?
      if (!c.person || !w.reverie) return false;
      const [actor, kind] = a.split('.');
      return w.reverie.belief(c.person.id, `did:${actor}:${kind}`) !== undefined;
    });
    // 'witnessed:player.strip', 'warned:player.strip': how many times lately (repeatDays)
    w.lang.term('witnessed', (c, a) => { if (!c.person) return 0; const [actor, kind] = a.split('.'); return this.seenTimes(c.person.id, actor, kind); });
    w.lang.term('warned', (c, a) => { if (!c.person) return 0; const [actor, kind] = a.split('.'); return this.warnedTimes(c.person.id, actor, kind); });
    w.defineInput('warn', (witness: Id, actor: Id, kind: string) => this.applyWarn(witness, actor, kind));
    w.defineInput('silence', (witness: Id, actor: Id, how: string, amount: number) => this.applySilence(witness, actor, how, amount));
    w.defineInput('secret', (id: string, s: Secret) => { this.st.secrets[id] = { ...s, knownBy: [...s.knownBy] }; for (const k of s.knownBy) w.reverie?.applyBelieve(k, s.key, s.value, 'knew'); });
    w.defineInput('owe', (debtor: Id, creditor: Id, n: number) => this.applyOwe(debtor, creditor, n));
    w.defineInput('heat', (actor: Id, by: number) => { this.st.heat[actor] = round(Math.max(0, (this.st.heat[actor] || 0) + by), 4); });
  }

  crime(def: CrimeDef): this { this.crimes.set(def.kind, def); return this; }

  // -------------------------------------------------------------------------
  // Heat and reports
  // -------------------------------------------------------------------------

  /** Heat on someone: the weight of reports against them, fading by day. */
  heat(actor: Id): number { return round(this.st.heat[actor] || 0, 3); }
  /** Changes heat directly (from the game: recorded). */
  addHeat(actor: Id, by: number): void { this.w.input('heat', [actor, by]); }

  /** Recent reports, newest last. */
  reports(actor?: Id): Report[] { return this.st.reports.filter((r) => !actor || r.actor === actor); }

  /** Everyone who believes they saw the actor do something criminal and hasn't been silenced. */
  witnesses(actor: Id, kind?: string): Id[] {
    const rv = this.w.reverie;
    if (!rv) return [];
    const out: Id[] = [];
    for (const p of Object.values(this.w.s.people)) {
      if (p.status !== 'active') continue;
      for (const b of rv.beliefs(p.id)) {
        if (b.silenced || !b.key.startsWith(`did:${actor}:`)) continue;
        const k = b.key.split(':')[2];
        if (kind && k !== kind) continue;
        if (!this.crimes.has(k)) continue;
        out.push(p.id);
        break;
      }
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Repeats
  // -------------------------------------------------------------------------

  /** A witness's count of someone doing something, if it hasn't lapsed. */
  repeat(witness: Id, actor: Id, kind: string): Repeat | null {
    const days = this.c.repeatDays, r = this.st.seen?.[witness]?.[actor + ':' + kind];
    return r && days > 0 && this.w.s.now - r.t <= days * DAY ? r : null;
  }
  /** How many times lately the witness has seen the actor do it (0 with repeatDays off). */
  seenTimes(witness: Id, actor: Id, kind: string): number { return this.repeat(witness, actor, kind)?.n ?? 0; }
  /** How many times lately the witness has warned the actor about it. */
  warnedTimes(witness: Id, actor: Id, kind: string): number { return this.repeat(witness, actor, kind)?.warned ?? 0; }
  /** The witness has had a word with the actor about it (an input): they warned them. */
  warn(witness: Id, actor: Id, kind: string): void { this.w.input('warn', [witness, actor, kind]); }
  /** The direct version (engine). Only a sighting still counted can be warned about. */
  applyWarn(witness: Id, actor: Id, kind: string): void {
    const r = this.repeat(witness, actor, kind);
    if (!r) return;
    r.warned++;
    this.w.log('warn', witness, { actor, kind, n: r.warned });
  }
  /** One more sighting: counted from 1 again once the last has lapsed. */
  private counted(witness: Id, actor: Id, kind: string): number {
    if (this.c.repeatDays <= 0) return 1;
    const was = this.repeat(witness, actor, kind), seen = (this.st.seen ??= {}), mine = (seen[witness] ??= {});
    mine[actor + ':' + kind] = was ? { n: was.n + 1, t: this.w.s.now, warned: was.warned } : { n: 1, t: this.w.s.now, warned: 0 };
    return mine[actor + ':' + kind].n;
  }

  // -------------------------------------------------------------------------
  // Witnessing
  // -------------------------------------------------------------------------

  sensed(stim: Stimulus): void {
    const w = this.w, rv = w.reverie, c = this.c;
    const crime = this.crimes.get(stim.kind);
    const strength = clamp(stim.strength ?? 1);
    // how bad it was: the stimulus's own (a harm's), else the crime's
    const severity = stim.severity !== undefined ? clamp(stim.severity) : crime?.severity ?? 0;
    for (const wid of stim.seenBy || []) {
      const p = w.s.people[wid];
      if (!p || p.status !== 'active' || wid === stim.actor) continue;
      const r = w.stream(p);
      const knows = !!w.fellowship?.knows(wid, stim.actor) || !!rv?.file(wid, stim.actor);
      const chance = strength * (1 - clamp(stim.disguise ?? 0)) * (knows ? 1 : c.recognizeStranger);
      const recognized = r.chance(chance);
      const actor = recognized ? stim.actor : 'someone';
      const key = `did:${actor}:${stim.kind}`;
      rv?.applyBelieve(wid, key, stim.what ?? true, 'saw', null, Math.max(c.sawStrength, strength));
      rv?.applyRemember(wid, { k: 'saw:' + stim.kind, about: recognized ? stim.actor : undefined, place: stim.place ?? undefined, imp: crime ? c.crimeMemory + severity * c.severityMemory : c.plainMemory, text: `saw ${actor} ${stim.kind}${stim.what ? ' ' + stim.what : ''}` });
      if (crime && rv) rv.applyFeel(wid, crime.feeling ?? 'witnessed', key);
      // (seen it before, lately? one more time: repeatDays. Whether or not
      // they could say who it was, they know it's the same one again)
      const times = this.counted(wid, stim.actor, stim.kind);
      w.log('witnessed', wid, { actor, kind: stim.kind, what: stim.what ?? null, recognized, ...(times > 1 ? { times } : {}) });
      w.emit('witnessed', { id: wid, actor, kind: stim.kind, recognized, times });
      if (crime && recognized) {
        const mid = w.cfg.traitDefault;
        const lawful = p.def.traits?.lawful ?? p.def.values?.law ?? mid;
        const fear = p.def.traits?.courage !== undefined ? 1 - p.def.traits.courage : 1 - mid;
        const regard = w.fellowship ? w.fellowship.regard(wid, stim.actor) : 0;
        // someone who knows the actor (they've talked, they've learned things: Voice) is slower to report them
        const known = c.familiarReport && w.voice ? clamp(w.voice.familiarity(wid, stim.actor) * c.familiarReport, 0, c.familiarReportMax) : 0;
        // the headline knob scales the chance, for the witness
        // and each time before that they saw it makes it likelier (repeatReport)
        const again = 1 + c.repeatReport * (times - 1);
        const pReport = clamp((crime.report ?? c.reportChance) * (0.5 + lawful) * (1 - fear * c.fearWeight) * (1 - Math.max(0, regard) * c.loyalty) * (1 - known) * again * this.knob('reporting', wid));
        if (r.chance(pReport)) {
          const [a, b] = c.reportDelay;
          w.clock.schedule({ t: w.s.now + r.range(a, b), k: 'module', ref: this.name, who: wid, data: { actor: stim.actor, kind: stim.kind, what: stim.what ?? null, ...(stim.severity !== undefined ? { sev: severity } : {}) } });
        }
      }
    }
  }

  timer(item: { who?: Id; data?: Record<string, Value | Value[]> }): void {
    const w = this.w;
    const wid = item.who as Id;
    const actor = String(item.data?.actor);
    const kind = String(item.data?.kind);
    const p = w.s.people[wid];
    if (!p || p.status !== 'active') return;
    const b = w.reverie?.beliefRecord(wid, `did:${actor}:${kind}`);
    if (!b || b.silenced) return; // paid off, scared off, or forgot
    this.report(wid, actor, kind, item.data?.what as string | undefined, typeof item.data?.sev === 'number' ? item.data.sev : undefined);
  }

  private report(wid: Id, actor: Id, kind: string, what?: string, sev?: number): void {
    const w = this.w, c = this.c;
    const crime = this.crimes.get(kind);
    if (!crime) return;
    const severity = sev ?? crime.severity;
    let to = crime.reportTo;
    if (!to && w.fellowship) for (const g of w.fellowship.groups.values()) if (g.kind === 'authority') { to = g.id; break; }
    const rep: Report = { t: w.s.now, witness: wid, actor, kind };
    if (what) rep.what = what;
    if (to) rep.to = to;
    this.st.reports.push(rep);
    if (this.st.reports.length > 200) this.st.reports.shift();
    this.st.heat[actor] = round((this.st.heat[actor] || 0) + (crime.heat ?? severity * c.heatPerSeverity) * this.knob('heat', actor), 4);
    if (w.fellowship) {
      if (to) w.fellowship.applyStanding(to, actor, 0, severity * c.infamyAuthority);
      for (const g of w.fellowship.groupsOf(wid)) w.fellowship.applyStanding(g, actor, 0, severity * c.infamyGroups);
    }
    // the authority now knows too
    if (to && w.fellowship && w.reverie) for (const m of w.fellowship.members(to)) w.reverie.applyBelieve(m, `did:${actor}:${kind}`, what ?? true, 'told', wid, c.toldAuthority, 1);
    w.log('report', wid, { actor, kind, to: to ?? null });
    w.emit('report', { ...rep, heat: this.heat(actor) });
  }

  /** Pays or scares a witness off. Returns nothing; check witnesses() or listen for 'silenced'. */
  silence(witness: Id, actor: Id, how: 'pay' | 'scare', amount = 0): void { this.w.input('silence', [witness, actor, how, amount]); }

  private applySilence(witness: Id, actor: Id, how: string, amount: number): void {
    const w = this.w;
    const p = w.s.people[witness];
    const rv = w.reverie;
    if (!p || !rv) return;
    const r = w.stream(p);
    const c = this.c;
    const mid = w.cfg.traitDefault;
    const greed = p.def.traits?.greed ?? mid, courage = p.def.traits?.courage ?? mid, honesty = p.def.traits?.honesty ?? mid;
    const pAccept = how === 'pay' ? clamp(greed * c.bribeGreed + Math.min(1, amount / c.bribeFull) * c.bribeMoney - honesty * c.bribeHonesty + c.bribeBase) : clamp((1 - courage) * c.scareFear - honesty * c.scareHonesty + c.scareBase);
    const ok = r.chance(pAccept);
    if (ok) for (const b of rv.beliefs(witness)) if (b.key.startsWith(`did:${actor}:`)) rv.applySilence(witness, b.key);
    if (how === 'pay' && ok) p.vars.money = Number(p.vars.money ?? 0) + amount;
    if (how === 'scare') {
      rv.applyFeel(witness, 'scared', actor);
      w.fellowship?.applyRegard(witness, actor, c.scareRegard);
    }
    w.log('silenced', witness, { actor, how, ok });
    w.emit('silenced', { witness, actor, how, ok });
  }

  // -------------------------------------------------------------------------
  // Gossip
  // -------------------------------------------------------------------------

  met(a: PersonState, b: PersonState): void {
    this.gossip(a, b);
    this.gossip(b, a);
  }

  /** a may tell b one thing worth telling. */
  private gossip(a: PersonState, b: PersonState): void {
    const w = this.w, rv = w.reverie;
    if (!rv) return;
    const c = this.c;
    const r = w.stream(a);
    const talkative = a.def.traits?.talkative ?? w.cfg.traitDefault;
    // the headline knob scales the chance, for the teller
    if (!r.chance(c.gossipChance * (0.5 + talkative) * this.knob('gossip', a.id))) return;
    const best = this.news(a.id, b.id);
    if (!best) return;
    this.applyTell(a.id, b.id, best, r);
  }

  /**
   * What a would most want to tell b now (gossip's pick): a belief not
   * silenced, not too many tellings on, not private ('@'), not something b
   * already believes, not about b, a secret only out of spite; scored by
   * how juicy, how strong and how fresh. With `key`, that belief alone, if
   * it could be told. Null if there's nothing. A look: it changes nothing.
   */
  news(a: Id, b: Id, key?: string): { key: string; v: Value; str: number; hops: number; score: number } | null {
    const w = this.w, rv = w.reverie;
    if (!rv) return null;
    const c = this.c;
    const now = w.s.now;
    let best: { key: string; v: Value; str: number; hops: number; score: number } | null = null;
    for (const bl of rv.beliefs(a)) {
      if (key !== undefined && bl.key !== key) continue;
      if (bl.silenced || bl.hops >= c.maxHops) continue;
      if (bl.key.startsWith('@')) continue;
      const theirs = rv.belief(b, bl.key);
      if (theirs === bl.v) continue;
      const secret = this.secretFor(bl.key);
      if (secret && !(secret.about !== a && w.fellowship && w.fellowship.regard(a, secret.about) < c.secretSpite)) continue;
      const subject = subjectOf(bl.key);
      if (subject === b) continue; // not to their face
      const juicy = bl.key.startsWith('did:') ? (this.crimes.has(bl.key.split(':')[2]) ? c.juicyCrime : c.juicyDeed) : 1;
      const recency = Math.pow(c.gossipRecency, (now - bl.t) / HOUR);
      const score = juicy * bl.str * recency;
      if (!best || score > best.score) best = { key: bl.key, v: bl.v, str: bl.str, hops: bl.hops, score };
    }
    return best;
  }

  /**
   * a tells b something they believe (inside the simulation; gossip, and
   * Bree's talk): a liar may shift the blame, b believes it as far as they
   * trust a, a secret spreads, and a member of the authority takes a crime
   * as a report. `r` is the stream its draws come from.
   */
  applyTell(teller: Id, listener: Id, best: { key: string; v: Value; str: number; hops: number }, r: Stream): void {
    const w = this.w, rv = w.reverie;
    const a = w.s.people[teller], b = w.s.people[listener];
    if (!rv || !a || !b) return;
    const c = this.c;
    let key = best.key, lie = false;
    const v = best.v;
    const subject = subjectOf(key);
    const honesty = a.def.traits?.honesty ?? w.cfg.traitDefault;
    // a liar shifts the blame for something done onto someone else they dislike (with nobody to blame, the truth goes on)
    if (subject && v !== false && v !== null && honesty < c.liarBelow && w.fellowship && w.fellowship.regard(a.id, subject) < c.lieSpite && r.chance(c.lieChance * this.knob('lies', a.id))) {
      const foes = w.fellowship.relations(a.id).filter((x) => x.regard < c.scapegoat && x.id !== subject && x.id !== b.id);
      if (foes.length) { key = key.replace(`did:${subject}:`, `did:${foes[0].id}:`); lie = true; }
    }
    const trust = w.fellowship ? clamp(c.trustBase + w.fellowship.regard(b.id, a.id) * c.trustRegard, c.trustMin, c.trustMax) : c.trustAlone;
    rv.applyBelieve(b.id, key, v, 'told', a.id, best.str * trust * c.toldKeep, best.hops + 1);
    const sec = this.secretFor(key);
    if (sec && !sec.knownBy.includes(b.id)) {
      sec.knownBy.push(b.id);
      if (sec.knownBy.length === c.exposedAt) { w.log('exposed', sec.about, { key }); w.emit('exposed', { about: sec.about, key }); }
    }
    w.log('told', a.id, { to: b.id, key, v, ...(lie ? { lie: true } : {}) });
    w.emit('told', { from: a.id, to: b.id, key, v, lie });
    // a member of the authority who hears of a crime takes it as a report (not of one that didn't happen)
    if (key.startsWith('did:') && v !== false && v !== null && w.fellowship) {
      const [, actor, kind] = key.split(':');
      const crime = this.crimes.get(kind);
      if (crime && actor !== 'someone') {
        const to = crime.reportTo;
        const authority = to ? [to] : [...w.fellowship.groups.values()].filter((g) => g.kind === 'authority').map((g) => g.id);
        const what = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined;
        if (authority.some((g) => w.fellowship!.groupsOf(b.id).includes(g))) this.report(a.id, actor, kind, what);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Secrets and favors
  // -------------------------------------------------------------------------

  /** Declares a secret: a belief that only some people hold, which they pass on reluctantly. */
  secret(id: string, s: Secret): void { this.w.input('secret', [id, s]); }
  secrets(): Record<string, Secret> { return this.st.secrets; }
  private secretFor(key: string): Secret | undefined {
    for (const id in this.st.secrets) if (this.st.secrets[id].key === key) return this.st.secrets[id];
    return undefined;
  }

  /** Records a favor: debtor now owes creditor (n can be negative to settle). */
  owe(debtor: Id, creditor: Id, n = 1): void { this.w.input('owe', [debtor, creditor, n]); }
  applyOwe(debtor: Id, creditor: Id, n: number): void {
    const k = debtor + '>' + creditor;
    const v = round((this.st.favors[k] || 0) + n, 4);
    if (v <= 0) delete this.st.favors[k]; else this.st.favors[k] = v;
    this.w.log('owes', debtor, { target: creditor, n: v });
  }
  /** How much debtor owes creditor. */
  owes(debtor: Id, creditor: Id): number { return this.st.favors[debtor + '>' + creditor] || 0; }

  // -------------------------------------------------------------------------
  // Crimes people commit
  // -------------------------------------------------------------------------

  started(p: PersonState, d: { kind: string; action: Id; place: Id | null }): void {
    if (d.kind !== 'act' || !d.place) return;
    const a = this.w.actions.get(d.action);
    if (!a?.crime) return;
    const seenBy = this.w.ring.present(this.w.ring.root(d.place)).filter((id) => id !== p.id);
    this.sensed({ kind: a.crime, actor: p.id, place: d.place, seenBy, strength: this.c.crimeSeen });
  }

  // -------------------------------------------------------------------------
  // Upkeep
  // -------------------------------------------------------------------------

  did(actor: Id, verb: string, data: Record<string, Value>): void {
    // a deed that counts as a crime, done in front of people
    const deed = this.w.deeds.get(verb);
    if (deed?.crime && Array.isArray(data.seenBy)) {
      this.sensed({ kind: deed.crime, actor, what: data.what === undefined ? undefined : String(data.what), place: (data.place as Id) ?? null, seenBy: data.seenBy as unknown as Id[] });
    }
  }

  day(): void {
    const c = this.c;
    for (const k in this.st.heat) {
      // the headline knob, for whoever it's on: how fast it cools
      const f = this.knob('cooling', k);
      const v = round(this.st.heat[k] * (f === 1 ? c.heatDecay : Math.pow(c.heatDecay, f)), 4);
      if (v < c.heatFloor) delete this.st.heat[k]; else this.st.heat[k] = v;
    }
    const cutoff = this.w.s.now - 14 * DAY;
    this.st.reports = this.st.reports.filter((r) => r.t >= cutoff);
    // counts lapsed (repeatDays) are let go
    const seen = this.st.seen;
    if (seen) for (const wid of Object.keys(seen)) {
      for (const k of Object.keys(seen[wid])) if (this.w.s.now - seen[wid][k].t > c.repeatDays * DAY) delete seen[wid][k];
      if (!Object.keys(seen[wid]).length) delete seen[wid];
    }
  }
}

/** The person a belief is about ('did:X:kind' -> X). */
function subjectOf(key: string): Id | null {
  if (key.startsWith('did:')) { const s = key.split(':')[1]; return s === 'someone' ? null : s; }
  return null;
}
