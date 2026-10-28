// The loop's pieces, for a game that draws on animation frames and simulates
// in fixed steps: the stepper that catches up (and gives up rather than
// spiral when a phone falls behind), samples of frame times with their
// percentiles (for a readout like Lodestar's ?perf), and a governor that
// lowers the quality a step at a time while frames run slow.

/** Fixed steps from real time: `advance(dt, step)` runs step(this.dt) as many
 * times as the time allows, at most `max` a frame (then drops the rest, so a
 * slow phone slows down rather than walking through walls). Real frames
 * longer than `longest` seconds count as that long. */
export class Stepper {
  dt: number; max: number; longest: number; acc = 0; last = 0;
  constructor(o: { dt?: number; max?: number; longest?: number } = {}) { this.dt = o.dt ?? 1 / 60; this.max = o.max ?? 4; this.longest = o.longest ?? 0.1; }
  /** Seconds since the last animation frame (clamped), from its timestamp. */
  since(now: number): number { const d = Math.min(this.longest, (now - (this.last || now)) / 1000 || 0); this.last = now; return d; }
  /** Runs the steps owed; returns how many ran. */
  advance(dt: number, step: (dt: number) => void): number {
    this.acc += dt; let n = 0;
    while (this.acc >= this.dt && n < this.max) { step(this.dt); this.acc -= this.dt; n++; }
    if (n >= this.max) this.acc = 0;
    return n;
  }
  /** Forgets owed time (while paused). */
  hold(): void { this.acc = 0; }
}

/** A rolling window of samples (frame times, gaps between frames). */
export class Samples {
  list: number[] = []; size: number;
  constructor(size = 180) { this.size = size; }
  add(v: number): void { this.list.push(v); if (this.list.length > this.size) this.list.shift(); }
  /** The p-th percentile (0..1); 0 with no samples. */
  pct(p: number): number { const a = this.list; if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; }
  count(test: (v: number) => boolean): number { return this.list.filter(test).length; }
}

/** Lowers the quality while frames run slow: every `window` seconds of play it
 * looks at the frames a second, and under `below` calls `lower()`, which
 * steps the quality down and says whether it could. `check(dt, active)`
 * each frame; inactive time (paused, hidden) starts the count over. */
export class Governor {
  t = 0; n = 0; window: number; below: number; lower: () => boolean;
  constructor(o: { window?: number; below?: number; lower: () => boolean }) { this.window = o.window ?? 2; this.below = o.below ?? 40; this.lower = o.lower; }
  check(dt: number, active = true): void {
    if (!active) { this.t = this.n = 0; return; }
    this.t += dt; this.n++;
    if (this.t < this.window) return;
    const fps = this.n / this.t; this.t = this.n = 0;
    if (fps < this.below) this.lower();
  }
}
