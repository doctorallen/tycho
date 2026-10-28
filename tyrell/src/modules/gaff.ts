// Gaff: the director. Named for the Blade Runner detective who watches
// everything and leaves small origami figures behind.
//
// Gaff paces events on top of the people: storylets that fire on a mean time
// between events (RimWorld's storytellers), gated by conditions, cooldowns and
// the phase of an intensity cycle per subject (Left 4 Dead's build-up, peak,
// fade and relax), drawn from shuffled decks so nothing repeats back to back,
// and placed where nobody's looking when that matters.
//
// A storylet's fire() is game code the engine runs; it runs again on a
// replay, so changes it makes through the API aren't recorded twice.
import type { Module } from '../core/module';
import type { Cond, Id } from '../core/types';
import type { World } from '../core/world';
import { HOUR, clamp, round } from '../core/util';

export type Phase = 'build' | 'peak' | 'fade' | 'relax';

export interface StoryletDef {
  id: Id;
  label?: string;
  /** Conditions (strings or a function of the world). */
  when?: Cond[] | ((w: World) => boolean);
  /** Mean minutes between firings while it's eligible. */
  mtb: number;
  /** Minutes before it can fire again. */
  cooldown?: number;
  /** Fires only in these phases of its subject's intensity. */
  phase?: Phase | Phase[];
  /** The intensity subject it reads and bumps. Default 'world'. */
  subject?: string;
  /** How much firing raises the subject's intensity. Default 0.2. */
  bump?: number;
  /** Part of a deck: when it comes up, a card is drawn from the deck instead. */
  deck?: string;
  /** Pick a place nobody can see (not in focus, nobody there), from this tag. */
  unseen?: string;
  /** What happens. */
  fire: (w: World, ctx: { place: Id | null; subject: string; id: Id }) => void;
}

interface Intensity { v: number; phase: Phase; since: number }
interface State {
  last: Record<Id, number>;
  decks: Record<string, { cards: Id[]; last?: Id }>;
  intensity: Record<string, Intensity>;
  fired: Array<{ t: number; id: Id; place: Id | null }>;
}

export interface GaffConfig {
  /** Intensity at which the build-up turns into a peak. */
  peakAt: number;
  /** Minutes a peak lasts. */
  peakMinutes: number;
  /** Minutes of relaxing after the fade. */
  relaxMinutes: number;
  /** Intensity lost per hour. */
  decay: number;
}

export const DEFAULT_GAFF: GaffConfig = { peakAt: 0.7, peakMinutes: 4 * HOUR, relaxMinutes: 12 * HOUR, decay: 0.04 };

export class Gaff implements Module {
  readonly name = 'gaff';
  readonly config: GaffConfig;
  readonly storylets = new Map<Id, StoryletDef>();
  private deckCards = new Map<string, Id[]>();
  private metricFns = new Map<string, (w: World) => number>();
  private w!: World;

  constructor(cfg: Partial<GaffConfig> = {}) { this.config = { ...DEFAULT_GAFF, ...cfg }; }

  init(): State { return { last: {}, decks: {}, intensity: {}, fired: [] }; }
  private get st(): State { return this.w.s.mod.gaff as State; }

  attach(w: World): void {
    this.w = w;
    w.lang.term('metric', (_c, a) => this.metric(a));
    w.lang.term('intensity', (_c, a) => this.intensity(a || 'world'));
    w.lang.term('phase', (_c, a) => this.phase(a.includes('.') ? a.split('.')[0] : 'world') === (a.includes('.') ? a.split('.')[1] : a));
    w.defineInput('trigger', (id: Id, place: Id | null) => this.fire(id, place));
    w.defineInput('bump', (subject: string, by: number) => this.applyBump(subject, by));
    w.defineInput('draw', (deck: string) => this.applyDraw(deck) ?? null);
    // the built-in metrics
    this.metricFns.set('mood', (ww) => {
      const people = ww.people();
      if (!people.length || !ww.reverie) return 0.5;
      return people.reduce((a, p) => a + ww.reverie!.mood(p.id), 0) / people.length;
    });
    this.metricFns.set('people', (ww) => ww.people().length);
  }

  // -------------------------------------------------------------------------
  // Declaring
  // -------------------------------------------------------------------------

  storylet(def: StoryletDef): this { this.storylets.set(def.id, def); return this; }
  /** A deck of storylet ids, drawn without repeating back to back. */
  deck(id: string, cards: Id[]): this { this.deckCards.set(id, cards.slice()); return this; }
  /** A number Gaff can read ('metric:<name>' in conditions). */
  defineMetric(name: string, fn: (w: World) => number): this { this.metricFns.set(name, fn); return this; }

  metric(name: string): number {
    if (name.startsWith('heat.')) return this.w.wormtongue?.heat(name.slice(5)) ?? 0;
    const fn = this.metricFns.get(name);
    return fn ? fn(this.w) : 0;
  }

  // -------------------------------------------------------------------------
  // Intensity
  // -------------------------------------------------------------------------

  /** A subject's intensity, made if missing (inside the simulation). */
  private int(subject: string): Intensity {
    return (this.st.intensity[subject] ||= { v: 0, phase: 'build', since: this.w.s.now });
  }
  /** A subject's intensity for reading: one never bumped is building from 0 (and isn't made). */
  private look(subject: string): Intensity { return this.st.intensity[subject] ?? { v: 0, phase: 'build', since: this.w.s.now }; }
  intensity(subject = 'world'): number { return round(this.look(subject).v, 4); }
  phase(subject = 'world'): Phase { return this.look(subject).phase; }
  /** Raises (or lowers) a subject's intensity (from the game: recorded). */
  bump(subject: string, by: number): void { this.w.input('bump', [subject, by]); }
  applyBump(subject: string, by: number): void {
    const i = this.int(subject);
    i.v = round(clamp(i.v + by), 4);
  }

  private stepPhases(): void {
    const c = this.config, now = this.w.s.now;
    for (const subject in this.st.intensity) {
      const i = this.st.intensity[subject];
      i.v = round(clamp(i.v - c.decay), 4);
      if (i.phase === 'build' && i.v >= c.peakAt) { i.phase = 'peak'; i.since = now; }
      else if (i.phase === 'peak' && now - i.since >= c.peakMinutes) { i.phase = 'fade'; i.since = now; }
      else if (i.phase === 'fade' && i.v < c.peakAt * 0.4) { i.phase = 'relax'; i.since = now; }
      else if (i.phase === 'relax' && now - i.since >= c.relaxMinutes) { i.phase = 'build'; i.since = now; }
    }
  }

  // -------------------------------------------------------------------------
  // Storylets
  // -------------------------------------------------------------------------

  /** Could a storylet fire now? (Looking only: changes nothing.) */
  eligible(def: StoryletDef): boolean { return this.w.peek(() => this.ready(def)); }

  private ready(def: StoryletDef): boolean {
    const w = this.w, now = w.s.now;
    const last = this.st.last[def.id];
    if (def.cooldown && last !== undefined && now - last < def.cooldown) return false;
    if (def.phase) {
      const phases = Array.isArray(def.phase) ? def.phase : [def.phase];
      if (!phases.includes(this.phase(def.subject ?? 'world'))) return false;
    }
    if (typeof def.when === 'function') return !!def.when(w);
    if (def.when && !w.lang.all(def.when, w.ctx())) return false;
    return true;
  }

  hour(): void {
    const w = this.w;
    this.stepPhases();
    const r = w.worldStream('gaff');
    for (const def of this.storylets.values()) {
      if (!this.ready(def)) continue;
      if (!r.chance(1 - Math.exp(-HOUR / Math.max(1, def.mtb)))) continue;
      let id = def.id;
      if (def.deck) {
        const drawn = this.applyDraw(def.deck);
        if (!drawn) continue;
        const d = this.storylets.get(drawn);
        if (!d || !this.ready(d)) continue;
        id = drawn;
      }
      this.fire(id, null);
      // a deck's trigger fired too: its own cooldown counts from now
      if (id !== def.id) this.st.last[def.id] = w.s.now;
    }
  }

  /** Draws a card from a deck (from the game: recorded): shuffled, no repeat of the last one. */
  draw(deck: string): Id | undefined { return (this.w.input('draw', [deck]) as Id | null | undefined) ?? undefined; }

  /** Draws a card inside the simulation. */
  applyDraw(deck: string): Id | undefined {
    const st = this.st;
    const d = (st.decks[deck] ||= { cards: [] });
    if (!d.cards.length) {
      const all = this.deckCards.get(deck) || [];
      let cards = this.w.worldStream('deck:' + deck).shuffle(all);
      if (cards.length > 1 && cards[0] === d.last) cards = [...cards.slice(1), cards[0]];
      d.cards = cards;
    }
    const card = d.cards.shift();
    if (card) d.last = card;
    return card;
  }

  /** Makes a storylet fire now (the game can force one: recorded). */
  trigger(id: Id, place: Id | null = null): void { this.w.input('trigger', [id, place]); }

  private fire(id: Id, place: Id | null): void {
    const w = this.w;
    const def = this.storylets.get(id);
    if (!def) return;
    let where = place;
    if (!where && def.unseen) where = this.unseenPlace(def.unseen);
    const subject = def.subject ?? 'world';
    this.st.last[id] = w.s.now;
    this.st.fired.push({ t: w.s.now, id, place: where });
    if (this.st.fired.length > 100) this.st.fired.shift();
    this.applyBump(subject, def.bump ?? 0.2);
    w.log('director', undefined, { storylet: id, place: where });
    w.emit('director', { id, place: where, label: def.label ?? id });
    w.internally(() => def.fire(w, { place: where, subject, id }));
  }

  /** A place with a tag that nobody is at and the game isn't showing. */
  unseenPlace(tag: string): Id | null {
    const w = this.w;
    const focus = new Set(w.clock.regionsInFocus());
    const options = w.ring.tagged(tag).filter((id) => !focus.has(w.ring.region(id)) && !w.ring.present(id).length);
    return w.worldStream('unseen').pick(options) ?? null;
  }

  /** What's fired recently. */
  history(): Array<{ t: number; id: Id; place: Id | null }> { return this.st.fired.slice(); }
}
