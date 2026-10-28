// The guide: a tutorial as a list of steps, each done when the game says so
// (its `done` test, asked every frame), so a player who's ahead of it just
// moves it on, as many steps at once as are done. A step marked `end` waits
// for the player to say they've read it. Where it stands is a plain object
// in the game's save ({ i, off }): the step it's on, and whether it was
// skipped. A save without one never sees it.
//
// What the steps say and where they're shown (a card, marks on the screen,
// a button pulsing) are the game's; a step may carry anything else it needs,
// and read() gives a field that may be a function of the moment.

export interface Step {
  /** Done now? Asked every frame while the step is current. */
  done?: () => boolean;
  /** The last word: it waits until the game calls finish(). */
  end?: boolean;
  /** The chapter it belongs to (for "Parts · 2/6"). */
  ch?: string;
  [field: string]: unknown;
}

/** Where a guide stands, as kept in a save. */
export interface Place { i: number; off?: boolean }

export interface GuideOptions<S extends Step> {
  steps: S[];
  /** Where it stands: the object in the save (read each time, since a save
   * loaded replaces it), or null for a game that has none. */
  state: () => Place | null | undefined;
}

/** A guide's place at the start, to keep in a new game's save. */
export function fresh(): Place { return { i: 0 }; }

export class Guide<S extends Step = Step> {
  steps: S[];
  o: GuideOptions<S>;
  constructor(o: GuideOptions<S>) { this.o = o; this.steps = o.steps; }

  /** Where it stands (the save's object), or null. */
  get s(): Place | null { return this.o.state() || null; }
  /** Running: there's a place, it wasn't skipped, and it isn't past the end. */
  active(): boolean { const t = this.s; return !!t && !t.off && t.i < this.steps.length; }
  /** The step it's on. */
  get step(): S { return this.steps[this.s!.i]; }
  /** Every frame: moves on past whatever is done, more than one step if the
   * player is ahead (never past an `end`). Returns the steps passed, oldest
   * first (none, mostly). */
  tick(): S[] {
    const passed: S[] = [];
    while (this.active() && !this.step.end && this.step.done && this.step.done()) { passed.push(this.step); this.s!.i++; }
    return passed;
  }
  /** Skipped: it never shows again. */
  skip(): void { const t = this.s; if (t) t.off = true; }
  /** Read to the end: past the last step. */
  finish(): void { const t = this.s; if (t) t.i = this.steps.length; }
  /** A field of a step that may be a function (called) or a value. */
  read(field: string, step: S = this.step): unknown { const v = step[field]; return typeof v === 'function' ? (v as () => unknown)() : v; }
  /** Where a step is in its chapter: its chapter, which it is (from 1) and of how many. */
  place(step: S = this.step): { ch: string | undefined; at: number; of: number } {
    const all = this.steps.filter((q) => q.ch === step.ch);
    return { ch: step.ch, at: all.indexOf(step) + 1, of: all.length };
  }
}
