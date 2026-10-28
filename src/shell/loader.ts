// Loading in slices with an honest bar (Lodestar's loader, without its
// screen): a list of tasks, each with a weight (about how long it takes
// beside the others), run in order a few milliseconds a frame so the page
// can draw the bar between slices. A task's fn(job) may do its work at once
// and return; return a step function, called again and again a slice at a
// time until it returns true; or be async and `await job.yield()` often,
// which waits for the next frame only once the slice is spent. A task marked
// `side` runs alongside the others (one mostly waiting on another thread). A
// task that throws is skipped (and reported), and the rest go on.

export interface Task {
  label: string;
  weight: number;
  fn: (job: Job) => unknown;
  /** Runs alongside the main lane rather than in it. */
  side?: boolean;
}
export interface TaskState extends Task {
  /** 'wait', 'run', 'ok' or 'skip'. */
  state: string;
  /** How far, 0..1, while it runs; k of n if it says so. */
  f: number; k: number; n: number;
  /** Its line, which it may change. */
  line: string;
  ms: number;
}
export interface Job {
  /** k of n done (and how far, if not k / n): moves the bar. */
  at(k: number, n: number, f?: number): void;
  /** Changes the task's line. */
  say(text: string): void;
  /** Waits for the next frame once this slice is spent (at once with `now`). */
  yield(now?: boolean): Promise<void>;
}

// Runs fn once the frame now being drawn is on screen (a message posted from
// the frame's callback arrives after it's painted).
// (The channel is made the first time it's needed, so loading Tycho in Node
// leaves nothing holding the process open.)
let chan: MessageChannel | null = null;
const queue: (() => void)[] = [];
export function afterPaint(fn: () => void): void {
  if (!chan && typeof MessageChannel !== 'undefined' && typeof document !== 'undefined') {
    chan = new MessageChannel();
    chan.port1.onmessage = () => { const q = queue.splice(0); for (const f of q) f(); };
  }
  if (!chan) { setTimeout(fn, 0); return; }
  queue.push(fn);
  chan.port2.postMessage(0);
}

export class Tasks {
  /** Milliseconds of work a frame. */
  slice: number;
  jobs: TaskState[] = [];
  sliceAt = 0;
  /** True once the main lane is done (a side task may stop early then). */
  mainDone = false;
  onError: (e: unknown, task: TaskState) => void;
  /** Called after each slice's frame is drawn (redraw the bar). */
  onFrame: (() => void) | null;
  constructor(o: { slice?: number; onError?: (e: unknown, task: TaskState) => void; onFrame?: () => void } = {}) {
    this.slice = o.slice ?? 12; this.onError = o.onError || (() => { /* skipped */ }); this.onFrame = o.onFrame || null;
  }
  /** Runs the tasks: the side lane at once, the main lane one after another.
   * Resolves when all are done or skipped. `jobs` holds their states from
   * the moment it's called. */
  async run(tasks: Task[]): Promise<void> {
    this.jobs = tasks.filter(Boolean).map((t) => Object.assign({ k: 0, n: 0, f: 0, line: t.label, state: 'wait', ms: 0 }, t));
    this.mainDone = false;
    const side = this.jobs.filter((j) => j.side).map((j) => this.runOne(j));
    for (const j of this.jobs) if (!j.side) await this.runOne(j);
    this.mainDone = true;
    await Promise.all(side);
  }
  async runOne(j: TaskState): Promise<void> {
    const t0 = performance.now();
    j.state = 'run';
    const job = this.jobFor(j);
    try {
      await this.yield(true);
      const r = j.fn(job);
      if (typeof r === 'function') {
        for (;;) { if ((r as (job: Job) => unknown)(job) === true) break; await this.yield(); }
      } else if (r && typeof (r as Promise<unknown>).then === 'function') await r;
      j.state = 'ok';
    } catch (e) {
      j.state = 'skip';
      this.onError(e, j);
    }
    j.f = 1;
    j.ms = performance.now() - t0;
  }
  jobFor(j: TaskState): Job {
    return {
      at(k, n, f) { j.k = k; j.n = n; j.f = f !== undefined ? f : n ? Math.min(1, k / n) : 0; },
      say(text) { j.line = text; },
      yield: (now) => this.yield(now),
    };
  }
  /** Waits for the next frame once this slice's time is spent (or at once,
   * with `now`): the bar is drawn, and a frame shown, between slices. */
  yield(now?: boolean): Promise<void> {
    if (!now && performance.now() - this.sliceAt < this.slice) return Promise.resolve();
    return new Promise((res) => {
      const go = () => { this.sliceAt = performance.now(); if (this.onFrame) this.onFrame(); res(); };
      // (after the frame is drawn; a hidden page has no frames)
      if (typeof document === 'undefined' || document.hidden || typeof requestAnimationFrame === 'undefined') setTimeout(go, 0);
      else requestAnimationFrame(() => afterPaint(go));
    });
  }
  /** How far, 0..1: each task's share by its weight. */
  progress(): number {
    let w = 0, d = 0;
    for (const j of this.jobs) { w += j.weight; d += j.weight * (j.state === 'ok' || j.state === 'skip' ? 1 : j.f); }
    return w ? d / w : 1;
  }
  /** A step function that runs fn on each of a list, a slice at a time. */
  each<T>(job: Job, list: T[], fn: (item: T, i: number) => void): () => boolean {
    let i = 0;
    return () => {
      const t0 = performance.now();
      while (i < list.length && performance.now() - t0 < this.slice) fn(list[i++], i - 1);
      job.at(i, list.length);
      return i >= list.length;
    };
  }
}
