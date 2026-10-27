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
import type { Module } from '../core/module';
import type { Id, PersonState, Stimulus, Value } from '../core/types';
import type { World } from '../core/world';
import { DAY, HOUR, clamp, round } from '../core/util';

export interface CrimeDef {
  kind: string;
  /** 0..1: how bad. */
  severity: number;
  /** Heat each report adds. Default severity * 10. */
  heat?: number;
  /** The group reports go to (the police). Default: any group of kind 'authority'. */
  reportTo?: Id;
  /** The feeling a witness gets. Default 'witnessed'. */
  feeling?: Id;
  /** Chance a witness reports it (before temperament). Default from config. */
  report?: number;
}

export interface Report { t: number; witness: Id; actor: Id; kind: string; what?: string; to?: Id }
export interface Secret { about: Id; key: string; value: Value; knownBy: Id[] }

interface State {
  heat: Record<Id, number>;
  reports: Report[];
  secrets: Record<string, Secret>;
  favors: Record<string, number>;
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
}

export const DEFAULT_WORMTONGUE: WormtongueConfig = {
  reportChance: 0.6, reportDelay: [10, 90], recognizeStranger: 0.5, gossipChance: 0.45, maxHops: 3, heatDecay: 0.85, lieChance: 0.5,
};

export class Wormtongue implements Module {
  readonly name = 'wormtongue';
  readonly config: WormtongueConfig;
  readonly crimes = new Map<string, CrimeDef>();
  private w!: World;

  constructor(cfg: Partial<WormtongueConfig> = {}) { this.config = { ...DEFAULT_WORMTONGUE, ...cfg }; }

  init(): State { return { heat: {}, reports: [], secrets: {}, favors: {} }; }
  private get st(): State { return this.w.s.mod.wormtongue as State; }

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
  // Witnessing
  // -------------------------------------------------------------------------

  sensed(stim: Stimulus): void {
    const w = this.w, rv = w.reverie;
    const crime = this.crimes.get(stim.kind);
    const strength = clamp(stim.strength ?? 1);
    for (const wid of stim.seenBy || []) {
      const p = w.s.people[wid];
      if (!p || p.status !== 'active' || wid === stim.actor) continue;
      const r = w.stream(p);
      const knows = !!w.fellowship?.knows(wid, stim.actor) || !!rv?.file(wid, stim.actor);
      const chance = strength * (1 - clamp(stim.disguise ?? 0)) * (knows ? 1 : this.config.recognizeStranger);
      const recognized = r.chance(chance);
      const actor = recognized ? stim.actor : 'someone';
      const key = `did:${actor}:${stim.kind}`;
      rv?.applyBelieve(wid, key, stim.what ?? true, 'saw', null, Math.max(0.3, strength));
      rv?.applyRemember(wid, { k: 'saw:' + stim.kind, about: recognized ? stim.actor : undefined, place: stim.place ?? undefined, imp: crime ? 4 + crime.severity * 6 : 3, text: `saw ${actor} ${stim.kind}${stim.what ? ' ' + stim.what : ''}` });
      if (crime && rv) rv.applyFeel(wid, crime.feeling ?? 'witnessed', key);
      w.log('witnessed', wid, { actor, kind: stim.kind, what: stim.what ?? null, recognized });
      w.emit('witnessed', { id: wid, actor, kind: stim.kind, recognized });
      if (crime && recognized) {
        const lawful = p.def.traits?.lawful ?? p.def.values?.law ?? 0.5;
        const fear = p.def.traits?.courage !== undefined ? 1 - p.def.traits.courage : 0.5;
        const regard = w.fellowship ? w.fellowship.regard(wid, stim.actor) : 0;
        const pReport = clamp((crime.report ?? this.config.reportChance) * (0.5 + lawful) * (1 - fear * 0.3) * (1 - Math.max(0, regard) * 0.8));
        if (r.chance(pReport)) {
          const [a, b] = this.config.reportDelay;
          w.clock.schedule({ t: w.s.now + r.range(a, b), k: 'module', ref: this.name, who: wid, data: { actor: stim.actor, kind: stim.kind, what: stim.what ?? null } });
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
    this.report(wid, actor, kind, item.data?.what as string | undefined);
  }

  private report(wid: Id, actor: Id, kind: string, what?: string): void {
    const w = this.w;
    const crime = this.crimes.get(kind);
    if (!crime) return;
    let to = crime.reportTo;
    if (!to && w.fellowship) for (const g of w.fellowship.groups.values()) if (g.kind === 'authority') { to = g.id; break; }
    const rep: Report = { t: w.s.now, witness: wid, actor, kind };
    if (what) rep.what = what;
    if (to) rep.to = to;
    this.st.reports.push(rep);
    if (this.st.reports.length > 200) this.st.reports.shift();
    this.st.heat[actor] = round((this.st.heat[actor] || 0) + (crime.heat ?? crime.severity * 10), 4);
    if (w.fellowship) {
      if (to) w.fellowship.applyStanding(to, actor, 0, crime.severity * 0.2);
      for (const g of w.fellowship.groupsOf(wid)) w.fellowship.applyStanding(g, actor, 0, crime.severity * 0.1);
    }
    // the authority now knows too
    if (to && w.fellowship && w.reverie) for (const m of w.fellowship.members(to)) w.reverie.applyBelieve(m, `did:${actor}:${kind}`, what ?? true, 'told', wid, 0.8, 1);
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
    const greed = p.def.traits?.greed ?? 0.5, courage = p.def.traits?.courage ?? 0.5, honesty = p.def.traits?.honesty ?? 0.5;
    const pAccept = how === 'pay' ? clamp(greed * 0.6 + Math.min(1, amount / 100) * 0.5 - honesty * 0.4 + 0.1) : clamp((1 - courage) * 0.8 - honesty * 0.2 + 0.1);
    const ok = r.chance(pAccept);
    if (ok) for (const b of rv.beliefs(witness)) if (b.key.startsWith(`did:${actor}:`)) rv.silence(witness, b.key);
    if (how === 'pay' && ok) p.vars.money = Number(p.vars.money ?? 0) + amount;
    if (how === 'scare') {
      rv.applyFeel(witness, 'scared', actor);
      w.fellowship?.applyRegard(witness, actor, -0.3);
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
    const r = w.stream(a);
    const talkative = a.def.traits?.talkative ?? 0.5;
    if (!r.chance(this.config.gossipChance * (0.5 + talkative))) return;
    const now = w.s.now;
    let best: { key: string; v: Value; str: number; hops: number; score: number } | null = null;
    for (const bl of rv.beliefs(a.id)) {
      if (bl.silenced || bl.hops >= this.config.maxHops) continue;
      if (bl.key.startsWith('@')) continue;
      const theirs = rv.belief(b.id, bl.key);
      if (theirs === bl.v) continue;
      const secret = this.secretFor(bl.key);
      if (secret && !(secret.about !== a.id && w.fellowship && w.fellowship.regard(a.id, secret.about) < -0.3)) continue;
      const subject = subjectOf(bl.key);
      if (subject === b.id) continue; // not to their face
      const juicy = bl.key.startsWith('did:') ? (this.crimes.has(bl.key.split(':')[2]) ? 3 : 1.5) : 1;
      const recency = Math.pow(0.99, (now - bl.t) / HOUR);
      const score = juicy * bl.str * recency;
      if (!best || score > best.score) best = { key: bl.key, v: bl.v, str: bl.str, hops: bl.hops, score };
    }
    if (!best) return;
    let key = best.key, lie = false;
    const v = best.v;
    const subject = subjectOf(key);
    const honesty = a.def.traits?.honesty ?? 0.5;
    // a liar shifts the blame for something done onto someone else they dislike (with nobody to blame, the truth goes on)
    if (subject && v !== false && v !== null && honesty < 0.3 && w.fellowship && w.fellowship.regard(a.id, subject) < -0.3 && r.chance(this.config.lieChance)) {
      const foes = w.fellowship.relations(a.id).filter((x) => x.regard < -0.2 && x.id !== subject && x.id !== b.id);
      if (foes.length) { key = key.replace(`did:${subject}:`, `did:${foes[0].id}:`); lie = true; }
    }
    const trust = w.fellowship ? clamp(0.6 + w.fellowship.regard(b.id, a.id) * 0.4, 0.2, 1) : 0.7;
    rv.applyBelieve(b.id, key, v, 'told', a.id, best.str * trust * 0.9, best.hops + 1);
    const sec = this.secretFor(key);
    if (sec && !sec.knownBy.includes(b.id)) {
      sec.knownBy.push(b.id);
      if (sec.knownBy.length === 4) { w.log('exposed', sec.about, { key }); w.emit('exposed', { about: sec.about, key }); }
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
    this.sensed({ kind: a.crime, actor: p.id, place: d.place, seenBy, strength: 0.8 });
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
    for (const k in this.st.heat) {
      const v = round(this.st.heat[k] * this.config.heatDecay, 4);
      if (v < 0.05) delete this.st.heat[k]; else this.st.heat[k] = v;
    }
    const cutoff = this.w.s.now - 14 * DAY;
    this.st.reports = this.st.reports.filter((r) => r.t >= cutoff);
  }
}

/** The person a belief is about ('did:X:kind' -> X). */
function subjectOf(key: string): Id | null {
  if (key.startsWith('did:')) { const s = key.split(':')[1]; return s === 'someone' ? null : s; }
  return null;
}
