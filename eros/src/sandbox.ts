// The sandbox: a town (as code) and the world running from it, without the
// screen. It plays, pauses, steps and rewinds (Esper); keeps every log entry
// so Irulan can tell the whole run; and when the town changes, builds it
// again from day 0 and runs it back to the same moment with the same seed,
// so what a change did shows as the difference in the story. It runs
// Voight-Kampff's checks on the town, and keeps the changes so they can be
// undone.
import { callName, replay, type Call, type CallError, type Model } from './recorder';
import type { TyrellLib } from './tyrell';

export type Layout = 'timeline' | 'person' | 'thread' | 'paragraphs' | 'recap' | 'recount' | 'feed' | 'changes';
export const LAYOUTS: Layout[] = ['timeline', 'person', 'thread', 'paragraphs', 'recap', 'recount', 'feed', 'changes'];

/** How the story is told: Irulan's options, and the layout. */
export interface StorySettings {
  layout: Layout;
  min: number;
  who: string | null;
  as: string | null;
  voice: 'third' | 'first';
  vary: boolean;
  focus: string | null;
  limit: number;
}
export const DEFAULT_STORY: StorySettings = { layout: 'timeline', min: 0.3, who: null, as: null, voice: 'third', vary: true, focus: null, limit: 8 };

/** A line of the story as shown: a heading, a beat, or plain words. */
export interface Line {
  kind: 'head' | 'sub' | 'beat' | 'text' | 'added' | 'removed';
  text: string;
  parts?: Array<{ text: string; person?: string; place?: string }>;
  t?: number;
  score?: number;
}

export interface Checks { state: 'none' | 'passed' | 'failed' | 'error'; days: number; failures: string[]; summary: string }

const clock = (t: number) => { const m = Math.floor(t + 1e-6) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export const when = (t: number) => `day ${Math.floor((t + 1e-6) / 1440)} ${clock(t)}`;

export class Sandbox {
  world: any;
  /** Every log entry the run has written (rewinds drop what came after). */
  entries: any[] = [];
  /** The latest beats Irulan's feed told as they happened. */
  feed: any[] = [];
  /** Calls that failed when the town was built. */
  errors: CallError[] = [];
  /** What the last change did to the story. */
  change: { summary: string; added: any[]; removed: any[]; errors: CallError[] } | null = null;
  checks: Checks = { state: 'none', days: 0, failures: [], summary: '' };
  playing = false;
  /** Game minutes a second of real time, while playing. */
  speed = 60;
  private undone: Model[] = [];
  private stopFeed: (() => void) | null = null;

  constructor(readonly Tyrell: TyrellLib, public model: Model, public seed: string = 'eros') {
    this.build();
  }

  /** When the world started. */
  private startTime = 0;

  /** Builds the world from the town afresh, at its start. */
  build(): void {
    this.stopFeed?.();
    const { world, errors } = replay(this.model, this.Tyrell, { seed: this.seed });
    this.world = world;
    this.errors = errors;
    this.startTime = world.now;
    this.entries = [];
    this.feed = [];
    world.on('log', (e: any) => this.entries.push(e));
    world.on('seek', (e: { from: number; to: number }) => {
      if (e.to >= e.from) return;
      this.entries = this.entries.filter((x) => x.t <= e.to);
      this.feed = this.feed.filter((b) => b.t <= e.to);
    });
    this.stopFeed = world.irulan.feed((b: any) => { this.feed.push(b); if (this.feed.length > 300) this.feed.shift(); }, { min: 0.5 });
  }

  get now(): number { return this.world.now; }

  /** Runs on by real time while playing. */
  tick(ms: number): void { if (this.playing) this.world.advance((this.speed * ms) / 1000); }
  step(minutes: number): void { this.world.advance(minutes); }
  /**
   * Goes back, not before the start: by Esper as far as its snapshots reach,
   * and further by building the town again and running it to that moment
   * (the same seed runs the same, so it's the same moment either way).
   */
  back(minutes: number): void {
    const to = Math.max(this.startTime, this.world.now - minutes);
    if (to >= this.world.now) return;
    const earliest = this.world.esper?.on === false ? Infinity : this.world.esper?.earliest?.() ?? Infinity;
    if (to >= earliest) { this.world.seek(to); return; }
    this.build();
    if (to > this.world.now) this.world.advanceTo(to);
  }
  /** Starts again from the start, with a seed (the same one by default). */
  restart(seed = this.seed): void { this.seed = seed; this.build(); }

  // ---------------------------------------------------------------------------
  // Changing the town
  // ---------------------------------------------------------------------------

  /**
   * Changes the town: builds it again from day 0 with the same seed, runs it
   * to the same moment, and keeps what the change did to the story (beats
   * new and gone) and any call that failed. Undoable.
   */
  apply(next: Model, summary: string): void {
    const t = this.world.now;
    const before = this.beatTexts();
    this.undone.push(this.model);
    if (this.undone.length > 50) this.undone.shift();
    this.model = next;
    this.build();
    if (t > this.world.now) this.world.advanceTo(t);
    const after = this.beatTexts();
    this.change = {
      summary,
      added: after.beats.filter((b) => !before.texts.has(b.text)),
      removed: before.beats.filter((b) => !after.texts.has(b.text)),
      errors: this.errors,
    };
  }

  /** Undoes the last change. */
  undo(): boolean {
    const last = this.undone.pop();
    if (!last) return false;
    const t = this.world.now;
    this.model = last;
    this.build();
    if (t > this.world.now) this.world.advanceTo(t);
    this.change = { summary: 'undone', added: [], removed: [], errors: this.errors };
    return true;
  }

  get canUndo(): boolean { return this.undone.length > 0; }

  private beatTexts(): { beats: any[]; texts: Set<string> } {
    const beats = this.world.irulan.beats(this.entries, { min: 0.3, vary: false });
    return { beats, texts: new Set(beats.map((b: any) => b.text)) };
  }

  private nextId(): number { return Math.max(0, ...this.model.calls.map((c) => c.id)) + 1; }

  /** A call changed (its code). */
  updateCall(id: number, code: string): void {
    const c = this.model.calls.find((x) => x.id === id);
    if (!c) return;
    this.apply({ ...this.model, calls: this.model.calls.map((x) => (x.id === id ? { ...x, code } : x)) }, `changed ${callName(c)} #${id}`);
  }

  /** A call added: after the last of its kind, or at the end. */
  addCall(target: string, method: string, code: string): number {
    const id = this.nextId();
    const calls = this.model.calls.slice();
    let at = -1;
    calls.forEach((c, i) => { if (c.target === target && c.method === method) at = i; });
    calls.splice(at < 0 ? calls.length : at + 1, 0, { id, target, method, code });
    this.apply({ ...this.model, calls }, `added ${callName({ target, method })} #${id}`);
    return id;
  }

  removeCall(id: number): void {
    const c = this.model.calls.find((x) => x.id === id);
    if (!c) return;
    this.apply({ ...this.model, calls: this.model.calls.filter((x) => x.id !== id) }, `removed ${callName(c)} #${id}`);
  }

  duplicateCall(id: number): number | null {
    const c = this.model.calls.find((x) => x.id === id);
    return c ? this.addCall(c.target, c.method, c.code) : null;
  }

  // ---------------------------------------------------------------------------
  // Checks
  // ---------------------------------------------------------------------------

  /** Voight-Kampff's checks on the town, for some days, with the sandbox's seed. */
  runChecks(days = 1): Checks {
    try {
      const report = this.Tyrell.VoightKampff.run({ build: (seed: string) => replay(this.model, this.Tyrell, { seed }).world, days, seed: this.seed });
      this.checks = {
        state: report.passed ? 'passed' : 'failed', days, failures: report.failures,
        summary: `${report.days} day${report.days === 1 ? '' : 's'}, ${report.stats.decisions} decisions in ${report.stats.ms} ms`,
      };
    } catch (e: any) {
      this.checks = { state: 'error', days, failures: [e?.message ?? String(e)], summary: 'the checks could not run' };
    }
    return this.checks;
  }

  // ---------------------------------------------------------------------------
  // The story
  // ---------------------------------------------------------------------------

  /** The people, by id and name, in the order they were added. */
  people(): Array<{ id: string; name: string }> {
    return Object.values(this.world.s.people as Record<string, any>).map((p) => ({ id: p.id, name: p.name }));
  }

  /** Irulan's options for settings. */
  tellOptions(s: StorySettings): Record<string, unknown> {
    return {
      min: s.min, vary: s.vary, ...(s.who ? { who: s.who } : {}), ...(s.as ? { as: s.as, voice: s.voice } : {}), ...(s.focus ? { focus: { [s.focus]: 2 } } : {}),
    };
  }

  /** The story as lines to show, for these settings. */
  story(s: StorySettings): Line[] {
    const ir = this.world.irulan;
    const o = this.tellOptions(s);
    const beat = (b: any, at = true): Line => ({ kind: 'beat', text: b.text, parts: b.parts, t: at ? b.t : undefined, score: b.score });
    const out: Line[] = [];
    switch (s.layout) {
      case 'timeline': {
        let head = '';
        for (const b of ir.beats(this.entries, o)) {
          const h = ir.when(b.t);
          if (h !== head) { head = h; out.push({ kind: 'head', text: h }); }
          out.push(beat(b));
        }
        break;
      }
      case 'person': {
        const beats = ir.beats(this.entries, o);
        for (const p of this.people()) {
          if (s.who && p.id !== s.who) continue;
          const theirs = beats.filter((b: any) => b.who.includes(p.id));
          if (!theirs.length) continue;
          out.push({ kind: 'head', text: p.name });
          for (const b of theirs) out.push(beat(b));
        }
        break;
      }
      case 'thread': {
        const { threads, rest } = ir.threads(this.entries, { ...o, min: Math.max(s.min, 0.4) });
        out.push({ kind: 'sub', text: `${threads.length} storyline${threads.length === 1 ? '' : 's'}, the one that matters most first` });
        for (const th of threads) {
          out.push({ kind: 'head', text: th.title + (th.active ? '  (still going)' : ''), parts: th.parts });
          const names = th.people.slice(0, 4).map((id: string) => this.world.s.people[id]?.name ?? id).join(', ') + (th.people.length > 4 ? ' and others' : '');
          out.push({ kind: 'sub', text: `${names} · ${when(th.t)} to ${when(th.end)}` });
          for (const b of th.beats) out.push(beat(b));
        }
        const notable = rest.filter((b: any) => b.score >= Math.max(s.min, 0.55));
        if (notable.length) {
          out.push({ kind: 'head', text: 'Around town' });
          out.push({ kind: 'sub', text: `what else mattered most; ${rest.length - notable.length} smaller beats left out (the timeline tells them all)` });
          for (const b of notable) out.push(beat(b));
        }
        break;
      }
      case 'paragraphs':
        for (const p of ir.tell(this.entries, o)) out.push({ kind: 'text', text: p }, { kind: 'text', text: '' });
        break;
      case 'recap':
        out.push({ kind: 'head', text: 'The headlines' });
        for (const b of ir.recap(this.entries, { ...o, limit: s.limit })) out.push({ ...beat(b), text: `${ir.when(b.t)}: ${b.text}`, parts: [{ text: `${ir.when(b.t)}: ` }, ...b.parts] });
        break;
      case 'recount': {
        const as = s.as ?? this.people()[0]?.id;
        if (!as) break;
        out.push({ kind: 'head', text: `What ${this.world.s.people[as]?.name ?? as} would say` });
        for (const b of ir.recount(as, this.entries, { ...o, as, voice: s.voice === 'third' && !s.as ? 'first' : s.voice, limit: s.limit, min: Math.max(s.min, 0.4) })) out.push(beat(b, false));
        break;
      }
      case 'feed':
        out.push({ kind: 'head', text: 'As it happened (the feed: what scored 0.5 or more, told once complete)' });
        for (const b of this.feed) out.push(beat(b));
        break;
      case 'changes': {
        const c = this.change;
        if (!c) { out.push({ kind: 'text', text: 'No changes yet: change the town (Components, or a kind in the Catalog) and what it did to the story shows here.' }); break; }
        out.push({ kind: 'head', text: `Last change: ${c.summary}` });
        out.push({ kind: 'sub', text: `${c.added.length} beats new, ${c.removed.length} gone (re-run from the start to the same moment, with the same seed)` });
        for (const e of c.errors) out.push({ kind: 'removed', text: `! ${e.call} #${e.id}: ${e.message}` });
        for (const b of c.added) out.push({ kind: 'added', text: b.text, parts: b.parts, t: b.t });
        for (const b of c.removed) out.push({ kind: 'removed', text: b.text, parts: b.parts, t: b.t });
        break;
      }
    }
    return out;
  }

  /** Palantír's account of someone, and their last choice. */
  describe(id: string): string { return this.world.describe(id); }

  /** The call that declared someone (a person's world.person). */
  callFor(id: string): Call | undefined {
    return this.model.calls.find((c) => c.target === 'world' && c.method === 'person' && c.code.startsWith(`'${id}'`));
  }
}
