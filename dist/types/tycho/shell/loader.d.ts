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
    f: number;
    k: number;
    n: number;
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
export declare function afterPaint(fn: () => void): void;
export declare class Tasks {
    /** Milliseconds of work a frame. */
    slice: number;
    jobs: TaskState[];
    sliceAt: number;
    onError: (e: unknown, task: TaskState) => void;
    /** Called after each slice's frame is drawn (redraw the bar). */
    onFrame: (() => void) | null;
    constructor(o?: {
        slice?: number;
        onError?: (e: unknown, task: TaskState) => void;
        onFrame?: () => void;
    });
    /** Runs the tasks: the side lane at once, the main lane one after another.
     * Resolves when all are done or skipped. */
    run(tasks: Task[]): Promise<void>;
    runOne(j: TaskState): Promise<void>;
    jobFor(j: TaskState): Job;
    /** Waits for the next frame once this slice's time is spent (or at once,
     * with `now`): the bar is drawn, and a frame shown, between slices. */
    yield(now?: boolean): Promise<void>;
    /** How far, 0..1: each task's share by its weight. */
    progress(): number;
    /** A step function that runs fn on each of a list, a slice at a time. */
    each<T>(job: Job, list: T[], fn: (item: T, i: number) => void): () => boolean;
}
