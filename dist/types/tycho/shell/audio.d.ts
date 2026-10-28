/** The sound's own stream (xorshift32): variation in each sound, never the
 * game's randomness. Lodestar's seed by default. */
export declare class Rand {
    s: number;
    constructor(seed?: number);
    /** 0..1. */
    next(): number;
    /** a..b. */
    range(a: number, b: number): number;
}
/** A pitch: `semi` semitones from `root` Hz. */
export declare function hz(semi: number, root?: number): number;
/** A stored setting as a level: on (true, or never set) 1, off (false) 0, a
 * number clamped to 0..1 (soft). */
export declare function setting(v: unknown): number;
/** A promise from the context, its rejection ignored (a browser may refuse
 * to resume, which isn't an error worth showing). */
export declare function quiet(p: Promise<unknown> | undefined | null): void;
/** A periodic wave's recipe: [harmonics, amplitude of harmonic k]. */
export type WaveRecipe = [number, (k: number) => number];
/** Periodic waves from recipes, made on context c each only when it's first
 * wanted (making one costs a few ms). */
export declare function waves(c: BaseAudioContext, recipes?: Record<string, WaveRecipe>): Record<string, PeriodicWave>;
/** What the voices are made on: a context, its waves, a second or two of
 * noise to loop, and the stream for variation. An Engine is one; so is each
 * of a Bank's renders. */
export interface Voices {
    ctx: BaseAudioContext;
    waves: Record<string, PeriodicWave>;
    noise: AudioBuffer | null;
    rand: Rand;
}
/** A source, with when it stops. */
export type Source = AudioScheduledSourceNode & {
    stopAt?: number;
};
/** A cue's output while it's being made: its voices meet in `node`, and
 * leave through `last` (its pan); `send` (made on the first voice that
 * sends) goes to `sendTo`, the space through the bus's send. `end` is when
 * its last voice is done. */
export interface Out {
    node: AudioNode;
    last?: AudioNode;
    send: GainNode | null;
    sendTo: AudioNode;
    level: number;
    srcs: Source[];
    end: number;
    pan?: number;
    extra?: AudioNode;
}
/** A voice's recipe. f: Hz (gliding to f2 over glide s); w: a wave (sine,
 * triangle, square, sawtooth, or one of the context's waves); a: rise (s);
 * g: level within the cue; d: the time constant it dies away with; hold:
 * held before it dies; send: how much goes to the space. A tone: lp a low
 * pass (Q q), vib [rate, Hz] a wobble, det detune (cents). Noise: ft the
 * filter's type (bandpass unless said), f its frequency, q. FM: ratio of the
 * modulator to f, index i0 (in multiples of f) falling to i1 with time
 * constant id, trem [rate, depth]. A stack: n voices spread over `spread`
 * cents through a low pass from lp to lp2 over `sweep`. */
export interface Voice {
    f: number;
    f2?: number;
    glide?: number;
    w?: string;
    a?: number;
    g?: number;
    d?: number;
    hold?: number;
    send?: number;
    lp?: number;
    q?: number;
    vib?: [number, number];
    det?: number;
    ft?: BiquadFilterType;
    ratio?: number;
    i0?: number;
    i1?: number;
    id?: number;
    trem?: [number, number];
    n?: number;
    spread?: number;
    lp2?: number;
    sweep?: number;
}
/** An envelope on p: from 0 at t, up to g over a, held for hold, then dying
 * away with time constant d. Returns when it's silent (cut then). */
export declare function env(p: AudioParam, t: number, a: number, g: number, d: number, hold?: number): number;
/** A voice's gain into its cue, and its share sent to the space. */
export declare function voiceOut(S: Voices, o: Out, v: Voice, g: AudioNode): void;
/** A tone. Returns when it ends. */
export declare function tone(S: Voices, o: Out, t: number, v: Voice): number;
/** Noise through a filter, from somewhere in the noise's loop. Returns when
 * it ends. */
export declare function noise(S: Voices, o: Out, t: number, v: Voice): number;
/** A slow or fast swell (trem: [rate, depth]) on whatever passes through
 * `node`: a whirr, a throb. Returns the node to go on from. */
export declare function trem(S: Voices, node: AudioNode, t: number, tr?: [number, number]): AudioNode;
/** A carrier frequency-modulated by another at `ratio` times it: metal, a
 * discharge, a roar, by its ratio and index. */
export declare function fm(S: Voices, o: Out, t: number, v: Voice): void;
/** Several voices of one wave, spread over `spread` cents, through a filter
 * sweeping lp to lp2: a wide, thick tone. */
export declare function stack(S: Voices, o: Out, t: number, v: Voice): void;
/** A second (or `secs`) of white noise on context c, from the stream. */
export declare function noiseBuffer(c: BaseAudioContext, rand: Rand, secs?: number): AudioBuffer;
/** A part of a cue played from the bank: [key, level, delay]. */
export type BankPart = [string, number, number?];
/** Where a cue is heard from: its level, its pan, and a playback rate for a
 * bank cue. */
export interface Heard {
    g: number;
    pan: number;
    rate?: number;
}
/** A cue, by name. g: its level; gap: the least time between two plays (else
 * the mix's gap); pri: always plays, however many are sounding; music: a
 * moment of the music's, heard whatever the effects' setting (fn is called
 * with no output). Made live by fn(S, out, t, opts), or played from the bank:
 * bank(opts) gives its parts, spread how far its speed may be off true, lp
 * [lo, hi] a low pass somewhere between. where(opts) overrides the distance
 * falloff; at() is where it's heard from when opts gives no x; also(t) runs
 * after it's played. */
export interface Cue {
    g?: number;
    gap?: number;
    pri?: boolean;
    music?: boolean;
    fn?: (S: Engine, out: Out | null, t: number, opts: CueOpts) => void;
    bank?: (opts: CueOpts) => BankPart[];
    spread?: number;
    lp?: [number, number];
    where?: (opts: CueOpts) => Heard;
    at?: () => {
        x: number;
        y: number;
    };
    also?: (t: number) => void;
}
/** A cue's options: x, y (world px) where it's heard from; g a level; and
 * whatever the recipe reads. */
export type CueOpts = {
    x?: number;
    y?: number;
    g?: number;
    [k: string]: unknown;
};
/** The mix, read live (a game may pass its tuning object): the master level,
 * the music's and the effects' levels at full, how loud the space's echoes
 * come back, voices at once, the least gap between two plays of a cue, and
 * how sound falls off with distance: full within near[0] px, gone at
 * near[1]; panned dx / panW, at most panMax. */
export interface Mix {
    master: number;
    music: number;
    sfx: number;
    space: number;
    voices: number;
    gap: number;
    near: [number, number];
    panW: number;
    panMax: number;
}
export interface EngineOptions {
    cues: Record<string, Cue>;
    mix: Mix;
    /** The stream for variation (share it with the Bank). */
    rand?: Rand;
    /** The game's periodic waves, by name. */
    waves?: Record<string, WaveRecipe>;
    /** The pitch semitones count from (Hz): what music's drones are tuned to. */
    root?: number;
    /** A setting's level, 0..1: 'music' or 'sfx'. Every setting is on without it. */
    level?: (kind: 'music' | 'sfx') => number;
    /** Where sound is heard from (world px), or null (everything at full). */
    listener?: () => {
        x: number;
        y: number;
    } | null;
    /** The chain's numbers: the limiter, a low pass over what a speaker makes
     * harsh, a high pass under what it can't play. */
    chain?: {
        threshold?: number;
        knee?: number;
        ratio?: number;
        attack?: number;
        release?: number;
        lp?: number;
        lpQ?: number;
        hp?: number;
        hpQ?: number;
    };
    /** The space: delays [seconds, pan] fed back through a low pass. */
    space?: {
        taps?: [number, number][];
        lp?: number;
        fb?: number;
    };
    /** Seconds of noise the noisy voices loop. */
    noiseSecs?: number;
    /** Whether it may start yet (the game's ready for it). */
    canStart?: () => boolean;
    /** Called once the live context is made (and the music built): say, to
     * render the bank if the loading didn't. */
    onStart?: (ctx: AudioContext) => void;
}
/** The space: delays fed back through a low pass, spread left and right, so
 * what's sent to it rings on as in a dark room. Returns its input. */
export declare function space(c: BaseAudioContext, dest: AudioNode, level: number, o?: EngineOptions['space']): GainNode;
/** What the music needs from the engine: built once the context is made,
 * ticked every frame. */
export interface MusicLike {
    build(S: Engine): void;
    tick(dt: number): void;
}
/** What the engine needs from a bank. */
export interface BankLike {
    has(k: string): boolean;
    pick(k: string): AudioBuffer;
}
/** The engine. Make one at load, `listen()` for the first tap, call
 * `tick(dt)` every frame and `cue(name, opts)` from anywhere. */
export declare class Engine implements Voices {
    o: EngineOptions;
    rand: Rand;
    root: number;
    ctx: BaseAudioContext;
    ready: boolean;
    failed: boolean;
    realtime: boolean;
    out: GainNode;
    sfx: GainNode;
    music: GainNode;
    space: GainNode;
    sfxSend: GainNode;
    musicSend: GainNode;
    noise: AudioBuffer | null;
    waves: Record<string, PeriodicWave>;
    /** When each voice sounding now ends. */
    ends: number[];
    /** When each cue last played. */
    last: Record<string, number>;
    /** The levels last applied. */
    levels: {
        music: number;
        sfx: number;
    };
    /** The music (built with the context, ticked with the engine), if any. */
    score: MusicLike | null;
    /** The bank the cues' rendered parts come from, if any. */
    bank: BankLike | null;
    private listening;
    constructor(o: EngineOptions);
    /** Makes the whole graph on ctx: the page's AudioContext (realtime), or a
     * test's OfflineAudioContext. */
    build(ctx: BaseAudioContext, realtime?: boolean): void;
    /** A setting's level: 'music' or 'sfx'. */
    level(kind: 'music' | 'sfx'): number;
    /** Whether either setting wants sound at all. */
    wanted(): boolean;
    /** The settings onto the buses (at once with `now`, else gliding); with
     * nothing wanted the live context sleeps, and costs nothing. */
    applyLevels(now?: boolean): void;
    /** A cue's output: its voices meet in one node, its level and its pan, and
     * leave through the effects' bus (or `bus`; the space through the same
     * bus's send). */
    cueOut(t: number, g: number, pan?: number, bus?: AudioNode): Out;
    /** Cuts a finished cue loose once its last voice is done. */
    cueDone(o: Out): void;
    /** Where a cue is heard from, by its distance from the listener. */
    where(o: {
        x?: number;
        y?: number;
    }): Heard;
    /** Plays cue `name` at `when` (now, if not given). Returns whether it played. */
    play(name: string, opts?: CueOpts, when?: number): boolean;
    /** A cue from the bank: each part a rendered variant, all at one speed a
     * little off true (and through a low pass somewhere in lp, if it has one),
     * so no two plays are the same. */
    playBank(out: Out, t: number, parts: BankPart[], spread: number, k: number, lp?: [number, number]): void;
    /** Every frame: the settings, then the music. Sound never stops the game. */
    tick(dt: number): void;
    /** Whether a cue could sound now: its rendered parts are ready (a cue made
     * live always is). */
    canPlay(name: string, opts?: CueOpts): boolean;
    /** The hook the game calls: a cue by name, never an error, nothing before
     * the first tap. */
    cue(name: string, opts?: CueOpts): void;
    /** The first tap (or key) makes the sound, as browsers ask; later ones wake
     * it if the browser put it to sleep. */
    unlock(): void;
    /** Listens for the first tap or key, and sleeps while the page is hidden
     * (waking when it's back, if sound is wanted). Once. */
    listen(): this;
}
/** A sound rendered ahead: dur (s), ch (channels), rate (at most), verb (a
 * reverb's name) and wet, drive (the saturation), n (variants, if the bank's
 * count doesn't say), and fn(R, out, t, variant). */
export interface BankRecipe {
    dur: number;
    ch?: number;
    rate?: number;
    verb?: string | null;
    wet?: number;
    drive?: number;
    n?: number;
    fn: (R: Voices, o: Out, t: number, v: number) => void;
    [k: string]: unknown;
}
/** A reverb: its impulse's length and the resonances that ring in it (Hz). */
export interface Verb {
    secs: number;
    modes?: number[];
}
export interface BankOptions {
    recipes: Record<string, BankRecipe>;
    /** The order to render in (the commonest first). */
    order: string[];
    /** How many variants of each (default its n, else 1). */
    count?: (key: string, B: BankRecipe) => number;
    /** The rate to render at, at most. */
    rate?: number;
    /** ms between renders when nothing else paces them. */
    gap?: number;
    /** The idle time (ms) a frame must have spare to render in play. */
    idleMs?: number;
    rand?: Rand;
    waves?: Record<string, WaveRecipe>;
    /** The reverbs, by the name a recipe's `verb` gives. */
    verbs?: Record<string, Verb>;
    /** The render's chain: a low pass and a high pass round the saturation
     * (its drive unless the recipe says, and oversampling), the reverb's low
     * pass, its wet level unless the recipe says. */
    chain?: {
        lp?: number;
        lpQ?: number;
        hp?: number;
        drive?: number;
        oversample?: OverSampleType;
        verbLp?: number;
        wet?: number;
    };
    /** A rendered sound is cut once it's this far under its peak, with a fade. */
    trim?: {
        floor?: number;
        fade?: number;
    };
    /** A moment that can't be felt (a screen open, the world still): idle()
     * renders then without waiting for the browser to be idle. */
    free?: () => boolean;
    /** Run at the start, before the queue: say, render a few sounds first
     * (`bank.want(keys)`), as the start's options ask. */
    first?: (bank: Bank, o: BankStart) => Promise<unknown> | null | undefined | void;
}
/** How a start is paced: pace(k, n) is awaited between buffers instead of
 * the gap (a loader's slices); enough() is asked once every sound has a
 * variant, and true leaves the rest for idle(). Anything else is for
 * `first`. */
export interface BankStart {
    pace?: (k: number, n: number) => Promise<unknown>;
    enough?: () => boolean;
    [k: string]: unknown;
}
/** A soft saturation's curve: tanh, so loud parts round off and gain
 * harmonics (odd, so silence stays silent). */
export declare function curve(k: number): Float32Array<ArrayBuffer>;
/** A reverb's impulse, two channels: decaying noise, darker as it goes, with
 * faint resonances (modes, Hz) ringing in it. */
export declare function impulse(rate: number, secs: number, modes: number[], rand: Rand): Float32Array<ArrayBuffer>[];
/** A rendered sound, its peak brought to 1 and its end cut off once it's
 * `floor` of its peak (46 dB down), with a short fade; null if silent. */
export declare function trim(c: BaseAudioContext, buf: AudioBuffer, floor?: number, fadeSecs?: number): AudioBuffer | null;
type Bufs = AudioBuffer[] & {
    last?: number;
};
/** Sounds rendered ahead, a few variants each. `start()` renders everything
 * a buffer at a time; `has(k)` and `pick(k)` (a variant, not the one just
 * played) are for the engine. */
export declare class Bank implements BankLike {
    o: BankOptions;
    rand: Rand;
    bufs: Record<string, Bufs | 'busy'>;
    started: boolean;
    done: boolean;
    bytes: number;
    ms: number;
    rate: number;
    irs: Record<string, Float32Array<ArrayBuffer>[]> | null;
    noises: Record<number, AudioBuffer> | null;
    queue: [string, BankRecipe, number][] | null;
    total: number;
    first: number;
    made: number;
    idling: boolean;
    constructor(o: BankOptions);
    has(k: string): boolean;
    /** A variant, not the one just played. */
    pick(k: string): AudioBuffer;
    /** Renders everything, a buffer at a time, yielding between them: every
     * sound's first variant (in order), then each one's second, and so on, so
     * each can play as soon as possible. An offline context needs no tap, so
     * this can run while the game loads, before any; its buffers play in the
     * live context the tap makes (resampled, if its rate differs). `wait` (ms)
     * puts it off a moment (so a tap that starts it isn't slowed). */
    start(rate?: number, wait?: number, o?: BankStart): Promise<void>;
    renderNext(): Promise<void>;
    /** What the start left, a buffer at a time, only when it can't be felt:
     * at a free moment (the game says), or when the browser says it's idle
     * with time to spare. */
    idle(): void;
    /** Renders those of keys not yet rendered, in turn, one variant each,
     * while still(); pace, if given, is awaited between them instead of the
     * gap. */
    want(keys: string[], still?: () => boolean, pace?: ((k: number, n: number) => Promise<unknown>) | null): Promise<void>;
    /** Lets them go. */
    drop(keys: string[]): void;
    /** One variant of a sound, rendered. */
    renderOne(B: BankRecipe, v: number): Promise<AudioBuffer | null>;
}
/** A continuous voice's recipe: notes [semitones from the engine's root,
 * detune cents]; w its wave; bp a band pass before lp, its low pass; lfo
 * [rate, Hz] on the low pass; trem [rate, depth] a slow swell; g its level.
 * Anything else is the game's (when it comes in, say). */
export interface DroneRecipe {
    notes: [number, number][];
    w: string;
    lp: number;
    bp?: number;
    lfo?: [number, number];
    trem?: [number, number];
    g?: number;
    [k: string]: unknown;
}
export interface Drone {
    out: GainNode;
    lp: BiquadFilterNode;
    oscs: OscillatorNode[];
    L: DroneRecipe;
}
export interface Band {
    f: BiquadFilterNode;
    g: GainNode;
}
/** A continuous voice into dest, started now and kept running (its level 0
 * until it's wanted). */
export declare function drone(S: Engine, L: DroneRecipe, dest: AudioNode): Drone;
/** A band of noise, looped from somewhere in the engine's noise, through a
 * filter (bandpass unless said), silent until it's set: a place's wind,
 * water or room. */
export declare function band(S: Engine, dest: AudioNode, type?: BiquadFilterType): Band;
/** How much of something comes in as s rises past `at`: none below at - w/2,
 * all above at + w/2, smoothly between. */
export declare function presence(s: number, at: number, w?: number): number;
/** The music: built on the engine's context once there is one (its master
 * into the music's bus, a drone for each layer, then the game's `setup`),
 * and ticked every frame: `listen(now)` each frame (what the game doesn't
 * call itself), `update(now, state())` every `every` s. A game makes one
 * and gives it its own fields and methods (setup, state, update, listen and
 * whatever else its music does). */
export declare class Music implements MusicLike {
    S: Engine | null;
    built: boolean;
    /** The layers' drones, by id. */
    v: Record<string, Drone>;
    master: GainNode | null;
    layers: Record<string, DroneRecipe>;
    every: number;
    lastUp: number;
    /** When each kind of event is next due. */
    nextEv: Record<string, number>;
    private targets;
    /** The game's: what's built after the layers. */
    setup?(S: Engine): void;
    /** The game's: what the music should be doing now. */
    state?(): unknown;
    /** The game's: the music at `now` for state `st`. */
    update?(now: number, st: unknown): void;
    /** The game's: every frame, what it listens for. */
    listen?(now: number): void;
    constructor(o?: {
        layers?: Record<string, DroneRecipe>;
        every?: number;
    });
    build(S: Engine): void;
    tick(_dt?: number): void;
    /** A param glides to v (time constant tc) from now, unless that's already
     * its target. */
    set(p: AudioParam, v: number, now: number, tc: number): void;
    /** Forgets a param's target (it was set some other way). */
    forget(p: AudioParam): void;
    /** Events now and then: each [kind, least gap, most gap, ...] is first due
     * somewhere in its gap from now, and when it comes due fn(entry) runs and
     * the next is set. Kinds no longer listed are forgotten. */
    due<E extends readonly [string, number, number, ...unknown[]]>(now: number, list: readonly E[], fn: (e: E) => void): void;
    /** The music dips a moment: to k at t, back after hold. */
    duck(t: number, k: number, hold: number): void;
}
export {};
