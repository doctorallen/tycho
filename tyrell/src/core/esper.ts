// Esper: time walk. Named for Blade Runner's photo machine, the one Deckard
// talks into to move around inside a single moment ("enhance... go back").
//
// The world is deterministic: the same state and the same inputs give the
// same future. So Esper keeps two things:
//   snapshots of the whole state at regular marks (every 15 game minutes by
//     default, thinner further back), and
//   every input from outside (facts, sightings, deeds, bodies' reports...),
//     with the time it came.
// Going back means restoring the snapshot before the target and replaying
// the inputs up to it. Going forward again replays the recorded inputs too,
// so scrubbing back and forth shows the same history. Any new input in the
// past starts a new timeline: the old future is dropped (a 'branch' event).
import type { EsperConfig, Minutes, WorldState } from './types';
import type { World } from './world';
import { clone } from './util';

interface Snap { t: Minutes; input: number; s: string }
interface Input { t: Minutes; name: string; args: unknown[]; after?: number; chain?: boolean }

export const DEFAULT_ESPER: EsperConfig = { on: true, every: 15, keep: 1440, sparseAfter: 240, sparseEvery: 60 };

export class Esper {
  readonly config: EsperConfig;
  private snaps: Snap[] = [];
  private inputs: Input[] = [];
  /** The absolute index of inputs[0] (older inputs are pruned). */
  private base = 0;
  /** The absolute index of the next input to apply (equals the end when there's no future). */
  private cursor = 0;
  private nextMark = Infinity;
  private seeking = false;
  private marks = new Map<string, Minutes>();

  constructor(private w: World, cfg?: Partial<EsperConfig>) {
    this.config = { ...DEFAULT_ESPER, ...(cfg || {}) };
  }

  /** Is time walk recording? */
  get on(): boolean { return this.config.on; }

  /** Forgets all history (after a load). */
  reset(): void {
    this.snaps = [];
    this.inputs = [];
    this.base = 0;
    this.cursor = 0;
    this.nextMark = Infinity;
  }

  /** Takes the first snapshot, the earliest point to rewind to. */
  ensureBase(): void {
    if (!this.config.on || this.snaps.length || this.seeking) return;
    this.snapshot();
    const e = this.config.every;
    this.nextMark = Math.floor(this.w.s.now / e) * e + e;
  }

  /**
   * Records an input from outside (called by World.input before applying it).
   * `after` is the seq of the event it came in during, if any.
   */
  record(name: string, args: unknown[], after?: number, chain = false): void {
    if (!this.config.on) return;
    if (this.cursor < this.base + this.inputs.length || (this.snaps.length && this.snaps[this.snaps.length - 1].t > this.w.s.now)) this.branch();
    const inp: Input = { t: this.w.s.now, name, args: clone(args) };
    if (after !== undefined) inp.after = after;
    if (chain) inp.chain = true;
    this.inputs.push(inp);
    this.cursor = this.base + this.inputs.length;
  }

  /**
   * Is this call the very input the recorded future holds next? (After a
   * rewind, a game that reacts to replayed events the same way as before
   * repeats itself; those repeats don't start a new timeline.)
   */
  echo(name: string, args: unknown[], after?: number, chain = false): boolean {
    const inp = this.pending();
    if (!inp || inp.name !== name || inp.after !== after || !!inp.chain !== chain) return false;
    if (Math.abs(inp.t - this.w.s.now) > 1e-9) return false;
    return JSON.stringify(inp.args) === JSON.stringify(args);
  }

  /** The next recorded input still ahead of the world (after a rewind), if any. */
  pending(): Input | undefined {
    const i = this.cursor - this.base;
    return i >= 0 && i < this.inputs.length ? this.inputs[i] : undefined;
  }

  /** Applies the next recorded input, and any chained to it. */
  applyNext(): void {
    let inp = this.pending();
    if (!inp) return;
    for (;;) {
      this.cursor++;
      // replayed inputs are never recorded again
      this.w.replay(inp.name, clone(inp.args));
      inp = this.pending();
      if (!inp || !inp.chain) break;
    }
  }

  /** Takes snapshots for every mark the clock is about to pass (marks strictly before t). */
  passMarks(t: Minutes): void {
    if (!this.config.on || this.seeking) return;
    while (this.nextMark < t) {
      const keep = this.w.s.now;
      this.w.s.now = this.nextMark;
      if (!this.snaps.some((s) => s.t === this.nextMark)) this.snapshot();
      this.w.s.now = Math.max(keep, this.nextMark);
      this.nextMark += this.config.every;
      this.prune();
    }
  }

  private snapshot(): void {
    const snap: Snap = { t: this.w.s.now, input: this.cursor, s: JSON.stringify(this.w.s) };
    // keep them in time order
    let i = this.snaps.length;
    while (i > 0 && this.snaps[i - 1].t > snap.t) i--;
    this.snaps.splice(i, 0, snap);
  }

  /** Drops history older than `keep`, and thins what's older than `sparseAfter`. */
  private prune(): void {
    const c = this.config, now = this.w.s.now;
    if (this.snaps.length < 2) return;
    const oldest = now - c.keep;
    this.snaps = this.snaps.filter((s, i) => {
      if (i === this.snaps.length - 1) return true;
      if (s.t < oldest) return false;
      if (s.t < now - c.sparseAfter && Math.round(s.t) % c.sparseEvery !== 0) return false;
      return true;
    });
    // inputs before the oldest snapshot can never be replayed
    const first = this.snaps[0].input;
    const drop = first - this.base;
    if (drop > 0) { this.inputs.splice(0, drop); this.base = first; }
  }

  /** The earliest time Esper can go back to. */
  earliest(): Minutes { return this.snaps.length ? this.snaps[0].t : this.w.s.now; }
  /** The latest time it knows (the end of the recorded future, or now). */
  latest(): Minutes {
    const lastInput = this.inputs.length ? this.inputs[this.inputs.length - 1].t : -Infinity;
    const lastSnap = this.snaps.length ? this.snaps[this.snaps.length - 1].t : -Infinity;
    return Math.max(this.w.s.now, lastInput, lastSnap);
  }
  /** The span of history: [earliest, latest]. */
  span(): [Minutes, Minutes] { return [this.earliest(), this.latest()]; }
  /** How many snapshots and inputs are held (for a memory readout). */
  size(): { snapshots: number; inputs: number; bytes: number } {
    let bytes = 0;
    for (const s of this.snaps) bytes += s.s.length;
    return { snapshots: this.snaps.length, inputs: this.inputs.length, bytes };
  }

  /** Goes to time t (clamped to what's remembered): back by restoring and replaying, forward by running. */
  seek(t: Minutes): void {
    const w = this.w;
    if (!this.config.on || !this.snaps.length) {
      if (t > w.s.now) w.clock.advanceTo(t, Infinity);
      return;
    }
    if (t >= w.s.now) { w.clock.advanceTo(t, Infinity); return; }
    const target = Math.max(t, this.earliest());
    let snap = this.snaps[0];
    for (const s of this.snaps) if (s.t <= target) snap = s;
    const from = w.s.now;
    w.clock.reset();
    w.s = JSON.parse(snap.s) as WorldState;
    this.cursor = snap.input;
    this.seeking = true;
    w.replaying = true;
    try {
      w.clock.advanceTo(target, Infinity);
    } finally {
      w.replaying = false;
      this.seeking = false;
    }
    const e = this.config.every;
    this.nextMark = Math.floor(w.s.now / e) * e + e;
    w.palantir.clear();
    w.emit('seek', { from, to: w.s.now });
  }

  /** Drops the recorded future (a new input in the past starts a new timeline). */
  private branch(): void {
    const now = this.w.s.now;
    const keepInputs = this.cursor - this.base;
    const dropped = this.inputs.length - keepInputs;
    this.inputs.length = Math.max(0, keepInputs);
    this.snaps = this.snaps.filter((s) => s.t <= now);
    this.w.emit('branch', { t: now, dropped });
  }

  /** Names the present moment, to come back to later. */
  mark(name: string): void { this.marks.set(name, this.w.s.now); }
  /** Goes back (or forward) to a named moment. Returns false if it's been forgotten. */
  seekMark(name: string): boolean {
    const t = this.marks.get(name);
    if (t === undefined || t < this.earliest()) return false;
    this.w.seek(t);
    return true;
  }

  /** History as plain data, for a save that keeps it. */
  export(): unknown {
    return { snaps: this.snaps, inputs: this.inputs, base: this.base, cursor: this.cursor, nextMark: this.nextMark, marks: [...this.marks] };
  }
  import(h: any): void {
    if (!h) return;
    this.snaps = (h.snaps || []).slice();
    this.inputs = (h.inputs || []).slice();
    this.base = h.base || 0;
    this.cursor = h.cursor ?? this.base + this.inputs.length;
    this.nextMark = h.nextMark ?? Infinity;
    this.marks = new Map(h.marks || []);
  }
}
