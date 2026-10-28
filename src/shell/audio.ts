// Sound made in code with Web Audio: nothing is loaded. Lodestar's sound
// engine, for any game that brings its own recipes and music. Three parts:
//
//   Engine  the graph (two buses, sfx and music, each with a send to an echo,
//           the space; a high pass, a low pass and a limiter), a game's
//           settings as levels, cues played by name with a least gap between
//           plays and a cap on voices sounding at once, quieter and panned by
//           distance from a listener, and the browser's rules: nothing until
//           the first tap, asleep while the page is hidden.
//   Bank    sounds too rich to build for every play, rendered ahead in an
//           OfflineAudioContext a few variants each, one at a time between
//           frames (or a loader's slices), through a saturation and a
//           convolution reverb; a play is then a buffer at a slightly
//           different speed.
//   Music   continuous voices built once and kept running (silent until
//           wanted), bands of noise for a place's own sound, targets set on
//           their params only when they change, a slower tick for the music
//           than the frame's, events now and then, and a dip (duck).
//
// The voices every recipe is made of: tone (an oscillator through a low
// pass, gliding, wobbling), noise (looped noise through a filter), fm (a
// carrier modulated by another) and stack (detuned voices through a sweeping
// filter), each with an envelope and an optional send to the space.
//
// Variation comes from the sound's own stream (Rand, xorshift32), never the
// game's, so sound never moves the world. The Engine, the Bank and the
// voices draw from one Rand the game passes to all three, in the order the
// recipes call for them, so a game's sounds come out the same.
//
// Everything that makes a game sound its own way is passed in: its recipes,
// its periodic waves, its mix (read live, so a game's tuning can change it),
// the chain's and the space's numbers, the bank's chain and reverbs. Where an
// option is left out, the number is Lodestar's (whose engine this was).
// Nothing here throws into the game: a cue it doesn't know does nothing.

/** The sound's own stream (xorshift32): variation in each sound, never the
 * game's randomness. Lodestar's seed by default. */
export class Rand {
  s: number;
  constructor(seed = 0x2545f491) { this.s = seed >>> 0; }
  /** 0..1. */
  next(): number { let s = this.s; s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; this.s = s; return s / 4294967296; }
  /** a..b. */
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
}

/** A pitch: `semi` semitones from `root` Hz. */
export function hz(semi: number, root = 440): number { return root * Math.pow(2, semi / 12); }

/** A stored setting as a level: on (true, or never set) 1, off (false) 0, a
 * number clamped to 0..1 (soft). */
export function setting(v: unknown): number {
  if (v === undefined || v === true) return 1;
  if (v === false) return 0;
  const n = +(v as number) || 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** A promise from the context, its rejection ignored (a browser may refuse
 * to resume, which isn't an error worth showing). */
export function quiet(p: Promise<unknown> | undefined | null): void { if (p && p.catch) p.catch(() => {}); }

/** A periodic wave's recipe: [harmonics, amplitude of harmonic k]. */
export type WaveRecipe = [number, (k: number) => number];

/** Periodic waves from recipes, made on context c each only when it's first
 * wanted (making one costs a few ms). */
export function waves(c: BaseAudioContext, recipes: Record<string, WaveRecipe> = {}): Record<string, PeriodicWave> {
  const out: Record<string, PeriodicWave> = {};
  for (const [name, [n, f]] of Object.entries(recipes)) {
    let w: PeriodicWave | null = null;
    Object.defineProperty(out, name, { enumerable: true, get() {
      if (!w) { const re = new Float32Array(n + 1), im = new Float32Array(n + 1); for (let k = 1; k <= n; k++) im[k] = f(k); w = c.createPeriodicWave(re, im); }
      return w;
    } });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The voices
// ---------------------------------------------------------------------------

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
export type Source = AudioScheduledSourceNode & { stopAt?: number };
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
  f: number; f2?: number; glide?: number; w?: string;
  a?: number; g?: number; d?: number; hold?: number; send?: number;
  lp?: number; q?: number; vib?: [number, number]; det?: number;
  ft?: BiquadFilterType;
  ratio?: number; i0?: number; i1?: number; id?: number; trem?: [number, number];
  n?: number; spread?: number; lp2?: number; sweep?: number;
}

/** An envelope on p: from 0 at t, up to g over a, held for hold, then dying
 * away with time constant d. Returns when it's silent (cut then). */
export function env(p: AudioParam, t: number, a: number, g: number, d: number, hold?: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(g, t + a);
  if (hold) p.setValueAtTime(g, t + a + hold);
  p.setTargetAtTime(0, t + a + (hold || 0), d);
  return t + a + (hold || 0) + d * 6;
}
/** A voice's gain into its cue, and its share sent to the space. */
export function voiceOut(S: Voices, o: Out, v: Voice, g: AudioNode): void {
  g.connect(o.node);
  if (v.send) {
    if (!o.send) { o.send = S.ctx.createGain(); o.send.gain.value = o.level; o.send.connect(o.sendTo); }
    const s = S.ctx.createGain(); s.gain.value = v.send; g.connect(s); s.connect(o.send);
  }
}
/** A tone. Returns when it ends. */
export function tone(S: Voices, o: Out, t: number, v: Voice): number {
  const c = S.ctx, osc = c.createOscillator() as OscillatorNode & { stopAt?: number }, g = c.createGain();
  if (v.w && S.waves[v.w]) osc.setPeriodicWave(S.waves[v.w]); else osc.type = (v.w || 'sine') as OscillatorType;
  osc.frequency.setValueAtTime(v.f, t);
  if (v.f2) osc.frequency.exponentialRampToValueAtTime(v.f2, t + (v.glide || 0.1));
  if (v.det) osc.detune.value = v.det;
  let node: AudioNode = osc;
  if (v.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = v.lp; f.Q.value = v.q || 0.7; node.connect(f); node = f; }
  node.connect(g);
  const end = env(g.gain, t, v.a || 0.005, v.g === undefined ? 1 : v.g, v.d || 0.1, v.hold);
  if (v.vib) {
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = v.vib[0]; lg.gain.value = v.vib[1];
    lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(end);
  }
  voiceOut(S, o, v, g);
  osc.start(t); osc.stop(end); osc.stopAt = end;
  o.srcs.push(osc); o.end = Math.max(o.end, end);
  return end;
}
/** Noise through a filter, from somewhere in the noise's loop. Returns when
 * it ends. */
export function noise(S: Voices, o: Out, t: number, v: Voice): number {
  const c = S.ctx, src = c.createBufferSource() as AudioBufferSourceNode & { stopAt?: number }, f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = S.noise; src.loop = true;
  f.type = v.ft || 'bandpass'; f.Q.value = v.q || 1;
  f.frequency.setValueAtTime(v.f, t);
  if (v.f2) f.frequency.exponentialRampToValueAtTime(v.f2, t + (v.glide || 0.1));
  src.connect(f); f.connect(g);
  const end = env(g.gain, t, v.a || 0.003, v.g === undefined ? 1 : v.g, v.d || 0.05, v.hold);
  voiceOut(S, o, v, g);
  src.start(t, S.rand.next() * 1.5); src.stop(end); src.stopAt = end;
  o.srcs.push(src); o.end = Math.max(o.end, end);
  return end;
}
/** A slow or fast swell (trem: [rate, depth]) on whatever passes through
 * `node`: a whirr, a throb. Returns the node to go on from. */
export function trem(S: Voices, node: AudioNode, t: number, tr?: [number, number]): AudioNode {
  if (!tr) return node;
  const c = S.ctx, g = c.createGain(), l = c.createOscillator(), lg = c.createGain();
  g.gain.value = 1 - tr[1] / 2; l.frequency.value = tr[0]; lg.gain.value = tr[1] / 2;
  l.connect(lg); lg.connect(g.gain); node.connect(g); l.start(t);
  return g;
}
/** A carrier frequency-modulated by another at `ratio` times it: metal, a
 * discharge, a roar, by its ratio and index. */
export function fm(S: Voices, o: Out, t: number, v: Voice): void {
  const c = S.ctx, car = c.createOscillator() as OscillatorNode & { stopAt?: number }, mod = c.createOscillator(), mg = c.createGain(), g = c.createGain(), gl = v.glide || 0.1, ratio = v.ratio as number;
  car.frequency.setValueAtTime(v.f, t); mod.frequency.setValueAtTime(v.f * ratio, t);
  if (v.f2) { car.frequency.exponentialRampToValueAtTime(v.f2, t + gl); mod.frequency.exponentialRampToValueAtTime(v.f2 * ratio, t + gl); }
  mg.gain.setValueAtTime(v.f * (v.i0 as number), t); mg.gain.setTargetAtTime(v.f * (v.i1 || 0), t, v.id || 0.05);
  mod.connect(mg); mg.connect(car.frequency);
  let node: AudioNode = car;
  if (v.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = v.lp; f.Q.value = 0.7; node.connect(f); node = f; }
  node = trem(S, node, t, v.trem);
  node.connect(g);
  const end = env(g.gain, t, v.a || 0.002, v.g === undefined ? 1 : v.g, v.d || 0.1, v.hold);
  voiceOut(S, o, v, g);
  car.start(t); mod.start(t); car.stop(end); mod.stop(end); car.stopAt = end;
  o.srcs.push(car); o.end = Math.max(o.end, end);
}
/** Several voices of one wave, spread over `spread` cents, through a filter
 * sweeping lp to lp2: a wide, thick tone. */
export function stack(S: Voices, o: Out, t: number, v: Voice): void {
  const c = S.ctx, f = c.createBiquadFilter(), g = c.createGain(), n = v.n || 3, gl = v.glide || 0.2;
  f.type = 'lowpass'; f.Q.value = v.q || 0.9; f.frequency.setValueAtTime(v.lp as number, t);
  if (v.lp2) f.frequency.exponentialRampToValueAtTime(v.lp2, t + (v.sweep || 0.2));
  trem(S, f, t, v.trem).connect(g);
  const end = env(g.gain, t, v.a || 0.01, (v.g === undefined ? 1 : v.g) / Math.sqrt(n), v.d || 0.2, v.hold);
  for (let i = 0; i < n; i++) {
    const osc = c.createOscillator() as OscillatorNode & { stopAt?: number }, k = Math.pow(2, ((n > 1 ? i / (n - 1) : 0.5) - 0.5) * (v.spread || 10) / 1200);
    if (v.w && S.waves[v.w]) osc.setPeriodicWave(S.waves[v.w]); else osc.type = (v.w || 'sine') as OscillatorType;
    osc.frequency.setValueAtTime(v.f * k, t);
    if (v.f2) osc.frequency.exponentialRampToValueAtTime(v.f2 * k, t + gl);
    osc.connect(f); osc.start(t); osc.stop(end); osc.stopAt = end; o.srcs.push(osc);
  }
  voiceOut(S, o, v, g);
  o.end = Math.max(o.end, end);
}

/** A second (or `secs`) of white noise on context c, from the stream. */
export function noiseBuffer(c: BaseAudioContext, rand: Rand, secs = 2): AudioBuffer {
  const n = c.sampleRate * secs, buf = c.createBuffer(1, n, c.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = rand.next() * 2 - 1;
  return buf;
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

/** A part of a cue played from the bank: [key, level, delay]. */
export type BankPart = [string, number, number?];
/** Where a cue is heard from: its level, its pan, and a playback rate for a
 * bank cue. */
export interface Heard { g: number; pan: number; rate?: number }
/** A cue, by name. g: its level; gap: the least time between two plays (else
 * the mix's gap); pri: always plays, however many are sounding; music: a
 * moment of the music's, heard whatever the effects' setting (fn is called
 * with no output). Made live by fn(S, out, t, opts), or played from the bank:
 * bank(opts) gives its parts, spread how far its speed may be off true, lp
 * [lo, hi] a low pass somewhere between. where(opts) overrides the distance
 * falloff; at() is where it's heard from when opts gives no x; also(t) runs
 * after it's played. */
export interface Cue {
  g?: number; gap?: number; pri?: boolean; music?: boolean;
  fn?: (S: Engine, out: Out | null, t: number, opts: CueOpts) => void;
  bank?: (opts: CueOpts) => BankPart[];
  spread?: number; lp?: [number, number];
  where?: (opts: CueOpts) => Heard;
  at?: () => { x: number; y: number };
  also?: (t: number) => void;
}
/** A cue's options: x, y (world px) where it's heard from; g a level; and
 * whatever the recipe reads. */
export type CueOpts = { x?: number; y?: number; g?: number; [k: string]: unknown };

/** The mix, read live (a game may pass its tuning object): the master level,
 * the music's and the effects' levels at full, how loud the space's echoes
 * come back, voices at once, the least gap between two plays of a cue, and
 * how sound falls off with distance: full within near[0] px, gone at
 * near[1]; panned dx / panW, at most panMax. */
export interface Mix {
  master: number; music: number; sfx: number; space: number;
  voices: number; gap: number;
  near: [number, number]; panW: number; panMax: number;
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
  listener?: () => { x: number; y: number } | null;
  /** The chain's numbers: the limiter, a low pass over what a speaker makes
   * harsh, a high pass under what it can't play. */
  chain?: { threshold?: number; knee?: number; ratio?: number; attack?: number; release?: number; lp?: number; lpQ?: number; hp?: number; hpQ?: number };
  /** The space: delays [seconds, pan] fed back through a low pass. */
  space?: { taps?: [number, number][]; lp?: number; fb?: number };
  /** Seconds of noise the noisy voices loop. */
  noiseSecs?: number;
  /** Whether it may start yet (the game's ready for it). */
  canStart?: () => boolean;
  /** Called once the live context is made (and the music built): say, to
   * render the bank if the loading didn't. */
  onStart?: (ctx: AudioContext) => void;
}

/** Lodestar's numbers for the chain and the space, where a game passes none. */
const CHAIN = { threshold: -10, knee: 6, ratio: 10, attack: 0.003, release: 0.25, lp: 9000, lpQ: 0.5, hp: 80, hpQ: 0.6 };
const SPACE = { taps: [[0.193, -0.6], [0.311, 0.6], [0.467, 0]] as [number, number][], lp: 2200, fb: 0.48 };

/** The space: delays fed back through a low pass, spread left and right, so
 * what's sent to it rings on as in a dark room. Returns its input. */
export function space(c: BaseAudioContext, dest: AudioNode, level: number, o: EngineOptions['space'] = {}): GainNode {
  const taps = o.taps || SPACE.taps, lpf = o.lp ?? SPACE.lp, fbg = o.fb ?? SPACE.fb;
  const inp = c.createGain(), out = c.createGain();
  inp.gain.value = 1; out.gain.value = level;
  out.connect(dest);
  taps.forEach(([dt, pan]) => {
    const dl = c.createDelay(1), lp = c.createBiquadFilter(), fb = c.createGain();
    dl.delayTime.value = dt; lp.type = 'lowpass'; lp.frequency.value = lpf; fb.gain.value = fbg;
    inp.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl);
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; lp.connect(p); p.connect(out); } else lp.connect(out);
  });
  return inp;
}

/** What the music needs from the engine: built once the context is made,
 * ticked every frame. */
export interface MusicLike { build(S: Engine): void; tick(dt: number): void }
/** What the engine needs from a bank. */
export interface BankLike { has(k: string): boolean; pick(k: string): AudioBuffer }

/** The engine. Make one at load, `listen()` for the first tap, call
 * `tick(dt)` every frame and `cue(name, opts)` from anywhere. */
export class Engine implements Voices {
  o: EngineOptions;
  rand: Rand;
  root: number;
  ctx!: BaseAudioContext;
  ready = false; failed = false; realtime = false;
  out!: GainNode; sfx!: GainNode; music!: GainNode; space!: GainNode; sfxSend!: GainNode; musicSend!: GainNode;
  noise: AudioBuffer | null = null;
  waves: Record<string, PeriodicWave> = {};
  /** When each voice sounding now ends. */
  ends: number[] = [];
  /** When each cue last played. */
  last: Record<string, number> = {};
  /** The levels last applied. */
  levels = { music: -1, sfx: -1 };
  /** The music (built with the context, ticked with the engine), if any. */
  score: MusicLike | null = null;
  /** The bank the cues' rendered parts come from, if any. */
  bank: BankLike | null = null;
  private listening = false;
  constructor(o: EngineOptions) { this.o = o; this.rand = o.rand || new Rand(); this.root = o.root ?? 440; }

  /** Makes the whole graph on ctx: the page's AudioContext (realtime), or a
   * test's OfflineAudioContext. */
  build(ctx: BaseAudioContext, realtime?: boolean): void {
    const c = ctx, ch = Object.assign({}, CHAIN, this.o.chain || {}), M = this.o.mix;
    this.ctx = c; this.realtime = !!realtime; this.ends = []; this.last = {};
    // the limiter, a low pass over what a phone speaker makes harsh, and a
    // high pass under what it can't play at all
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = ch.threshold; lim.knee.value = ch.knee; lim.ratio.value = ch.ratio; lim.attack.value = ch.attack; lim.release.value = ch.release;
    lim.connect(c.destination);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = ch.lp; lp.Q.value = ch.lpQ; lp.connect(lim);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = ch.hp; hp.Q.value = ch.hpQ; hp.connect(lp);
    this.out = c.createGain(); this.out.gain.value = M.master; this.out.connect(hp);
    this.sfx = c.createGain(); this.sfx.gain.value = 0; this.sfx.connect(this.out);
    this.music = c.createGain(); this.music.gain.value = 0; this.music.connect(this.out);
    // what's sent to the space goes through its bus's own level, so a
    // setting quiets its echoes too
    this.space = space(c, this.out, M.space, this.o.space);
    this.sfxSend = c.createGain(); this.sfxSend.gain.value = 0; this.sfxSend.connect(this.space);
    this.musicSend = c.createGain(); this.musicSend.gain.value = 0; this.musicSend.connect(this.space);
    // noise, looped by every noisy sound
    this.noise = noiseBuffer(c, this.rand, this.o.noiseSecs ?? 2);
    this.waves = waves(c, this.o.waves);
    this.levels = { music: -1, sfx: -1 };
    this.applyLevels(true);
    this.ready = true;
  }

  /** A setting's level: 'music' or 'sfx'. */
  level(kind: 'music' | 'sfx'): number { return this.o.level ? this.o.level(kind) : 1; }
  /** Whether either setting wants sound at all. */
  wanted(): boolean { return this.level('music') > 0 || this.level('sfx') > 0; }
  /** The settings onto the buses (at once with `now`, else gliding); with
   * nothing wanted the live context sleeps, and costs nothing. */
  applyLevels(now?: boolean): void {
    if (!this.ctx) return;
    const m = this.level('music'), e = this.level('sfx'), t = this.ctx.currentTime, M = this.o.mix;
    if (m !== this.levels.music) { for (const b of [this.music, this.musicSend]) b.gain.setTargetAtTime(m * M.music, t, now ? 0.001 : 0.3); this.levels.music = m; }
    if (e !== this.levels.sfx) { for (const b of [this.sfx, this.sfxSend]) b.gain.setTargetAtTime(e * M.sfx, t, now ? 0.001 : 0.05); this.levels.sfx = e; }
    if (this.realtime && this.ctx.state !== 'closed' && typeof document !== 'undefined') {
      const ac = this.ctx as AudioContext;
      if (!this.wanted()) quiet(ac.suspend());
      else if (!document.hidden && this.ctx.state !== 'running') quiet(ac.resume());
    }
  }

  /** A cue's output: its voices meet in one node, its level and its pan, and
   * leave through the effects' bus (or `bus`; the space through the same
   * bus's send). */
  cueOut(t: number, g: number, pan?: number, bus?: AudioNode): Out {
    const c = this.ctx, node = c.createGain(), b = bus || this.sfx;
    node.gain.value = g;
    let last: AudioNode = node;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; node.connect(p); last = p; }
    last.connect(b);
    return { node, last, send: null, sendTo: b === this.sfx ? this.sfxSend : this.musicSend, level: g, srcs: [], end: t, pan };
  }
  /** Cuts a finished cue loose once its last voice is done. */
  cueDone(o: Out): void {
    let tail: Source | null = null;
    for (const s of o.srcs) if (!tail || (s.stopAt as number) > (tail.stopAt as number)) tail = s;
    if (tail) tail.onended = () => { try { o.node.disconnect(); if (o.extra) o.extra.disconnect(); if (o.last !== o.node) (o.last as AudioNode).disconnect(); if (o.send) o.send.disconnect(); } catch (e) { /* already loose */ } };
  }

  /** Where a cue is heard from, by its distance from the listener. */
  where(o: { x?: number; y?: number }): Heard {
    const p = o.x === undefined || !this.o.listener ? null : this.o.listener();
    if (!p) return { g: 1, pan: 0 };
    const M = this.o.mix, dx = (o.x as number) - p.x, dy = (o.y as number) - p.y, m = Math.hypot(dx, dy), N = M.near;
    const k = m <= N[0] ? 1 : m >= N[1] ? 0 : 1 - (m - N[0]) / (N[1] - N[0]);
    const pan = dx / M.panW;
    return { g: k * k, pan: pan < -M.panMax ? -M.panMax : pan > M.panMax ? M.panMax : pan };
  }

  /** Plays cue `name` at `when` (now, if not given). Returns whether it played. */
  play(name: string, opts?: CueOpts, when?: number): boolean {
    const cue = this.o.cues[name];
    if (!cue || !this.ready) return false;
    const o = opts || {}, now = this.ctx.currentTime, t = Math.max(now, when || now), M = this.o.mix;
    // the music's own moments are the music's, whatever the effects' setting
    if (cue.music) { if (cue.fn) cue.fn(this, null, t, o); return true; }
    if (this.levels.sfx <= 0) return false;
    if (t - (this.last[name] === undefined ? -99 : this.last[name]) < (cue.gap === undefined ? M.gap : cue.gap)) return false;
    this.ends = this.ends.filter((e) => e > t);
    if (this.ends.length >= M.voices && !cue.pri) return false;
    const parts = cue.bank ? cue.bank(o) : null;
    if (parts && (!this.bank || !this.bank.has(parts[0][0]))) return false;
    const w = cue.where ? cue.where(o) : this.where(o.x === undefined && cue.at ? cue.at() : o);
    if (w.g < 0.03) return false;
    this.last[name] = t;
    const out = this.cueOut(t, (cue.g || 0.3) * w.g * (o.g || 1), w.pan);
    if (parts) this.playBank(out, t, parts, cue.spread === undefined ? 0.04 : cue.spread, w.rate || 1, cue.lp);
    else if (cue.fn) cue.fn(this, out, t, o);
    if (cue.also) cue.also(t);
    this.cueDone(out);
    this.ends.push(out.end);
    return true;
  }

  /** A cue from the bank: each part a rendered variant, all at one speed a
   * little off true (and through a low pass somewhere in lp, if it has one),
   * so no two plays are the same. */
  playBank(out: Out, t: number, parts: BankPart[], spread: number, k: number, lp?: [number, number]): void {
    const c = this.ctx, rate = k * (1 + this.rand.range(-spread, spread)), bank = this.bank as BankLike;
    if (lp) {
      const f = c.createBiquadFilter(), was = out.node;
      f.type = 'lowpass'; f.frequency.value = this.rand.range(lp[0], lp[1]); f.Q.value = 0.6;
      f.connect(was); out.node = f; out.extra = was;
    }
    for (const [key, g, dt] of parts) {
      if (!bank.has(key)) continue;
      const b = bank.pick(key), src = c.createBufferSource() as AudioBufferSourceNode & { stopAt?: number }, at = t + (dt || 0);
      src.buffer = b; src.playbackRate.value = rate;
      let node: AudioNode = src;
      if (g !== 1) { const gn = c.createGain(); gn.gain.value = g; src.connect(gn); node = gn; }
      node.connect(out.node);
      src.start(at); src.stopAt = at + b.duration / rate;
      out.srcs.push(src); out.end = Math.max(out.end, src.stopAt);
    }
  }

  /** Every frame: the settings, then the music. Sound never stops the game. */
  tick(dt: number): void {
    if (!this.ready || this.ctx.state !== 'running') return;
    try {
      this.applyLevels(false);
      if (this.score) this.score.tick(dt);
    } catch (e) { /* sound never stops the game */ }
  }

  /** Whether a cue could sound now: its rendered parts are ready (a cue made
   * live always is). */
  canPlay(name: string, opts?: CueOpts): boolean {
    const cue = this.o.cues[name];
    if (!cue || !cue.bank || !this.ready || !this.bank) return true;
    const bank = this.bank;
    return cue.bank(opts || {}).every(([k]) => bank.has(k));
  }
  /** The hook the game calls: a cue by name, never an error, nothing before
   * the first tap. */
  cue(name: string, opts?: CueOpts): void {
    if (!this.ready) return;
    try { this.play(name, opts); } catch (e) { /* sound never stops the game */ }
  }

  /** The first tap (or key) makes the sound, as browsers ask; later ones wake
   * it if the browser put it to sleep. */
  unlock(): void {
    if (this.failed) return;
    try {
      if (!this.ctx) {
        const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
        const AC = W.AudioContext || W.webkitAudioContext;
        if (!AC || (this.o.canStart && !this.o.canStart())) { this.failed = !AC; return; }
        let ctx: AudioContext;
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
        this.build(ctx, true);
        if (this.score) this.score.build(this);
        if (this.o.onStart) this.o.onStart(ctx);
        // a moment of silence started inside the tap wakes iOS's output
        const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); b.connect(ctx.destination); b.start(0);
      }
      if (this.ctx.state !== 'running' && !document.hidden && this.wanted()) quiet((this.ctx as AudioContext).resume());
    } catch (e) { this.failed = true; }
  }

  /** Listens for the first tap or key, and sleeps while the page is hidden
   * (waking when it's back, if sound is wanted). Once. */
  listen(): this {
    if (this.listening || typeof window === 'undefined' || !window.addEventListener || typeof document === 'undefined' || !document.addEventListener) return this;
    this.listening = true;
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) window.addEventListener(ev, unlock, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      try { const ac = this.ctx as AudioContext; if (document.hidden) quiet(ac.suspend()); else if (this.wanted()) quiet(ac.resume()); } catch (e) { /* nothing to do */ }
    });
    window.addEventListener('pagehide', () => { try { if (this.ctx) quiet((this.ctx as AudioContext).suspend()); } catch (e) { /* nothing to do */ } });
    return this;
  }
}

// ---------------------------------------------------------------------------
// The bank: sounds rendered ahead
// ---------------------------------------------------------------------------

/** A sound rendered ahead: dur (s), ch (channels), rate (at most), verb (a
 * reverb's name) and wet, drive (the saturation), n (variants, if the bank's
 * count doesn't say), and fn(R, out, t, variant). */
export interface BankRecipe {
  dur: number; ch?: number; rate?: number; verb?: string | null; wet?: number; drive?: number; n?: number;
  fn: (R: Voices, o: Out, t: number, v: number) => void;
  [k: string]: unknown;
}
/** A reverb: its impulse's length and the resonances that ring in it (Hz). */
export interface Verb { secs: number; modes?: number[] }

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
  chain?: { lp?: number; lpQ?: number; hp?: number; drive?: number; oversample?: OverSampleType; verbLp?: number; wet?: number };
  /** A rendered sound is cut once it's this far under its peak, with a fade. */
  trim?: { floor?: number; fade?: number };
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
export interface BankStart { pace?: (k: number, n: number) => Promise<unknown>; enough?: () => boolean; [k: string]: unknown }

const BANK_CHAIN = { lp: 8000, lpQ: 0.5, hp: 35, drive: 1.4, oversample: '2x' as OverSampleType, verbLp: 5000, wet: 0.2 };
const BANK_VERBS: Record<string, Verb> = { room: { secs: 0.45, modes: [431, 1173, 1777, 2390] }, hall: { secs: 1.4 } };

/** A soft saturation's curve: tanh, so loud parts round off and gain
 * harmonics (odd, so silence stays silent). */
export function curve(k: number): Float32Array<ArrayBuffer> {
  const n = 1025, a = new Float32Array(n), m = Math.tanh(k);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; a[i] = Math.tanh(k * x) / m; }
  return a;
}
/** A reverb's impulse, two channels: decaying noise, darker as it goes, with
 * faint resonances (modes, Hz) ringing in it. */
export function impulse(rate: number, secs: number, modes: number[], rand: Rand): Float32Array<ArrayBuffer>[] {
  const n = Math.floor(rate * secs), chs = [new Float32Array(n), new Float32Array(n)];
  for (let ch = 0; ch < 2; ch++) {
    let lp = 0;
    const d = chs[ch];
    for (let i = 0; i < n; i++) {
      const t = i / rate, env = Math.exp(-t * 6.5 / secs), k = 0.15 + 0.8 * Math.exp(-t * 4 / secs);
      lp += (rand.next() * 2 - 1 - lp) * k;
      let v = lp * env;
      for (let m = 0; m < modes.length; m++) v += Math.sin(2 * Math.PI * modes[m] * (1 + ch * 0.003) * t) * 0.05 * Math.exp(-t * (9 + m * 4));
      d[i] = t < 0.004 ? v * (t / 0.004) : v;
    }
  }
  return chs;
}
/** A rendered sound, its peak brought to 1 and its end cut off once it's
 * `floor` of its peak (46 dB down), with a short fade; null if silent. */
export function trim(c: BaseAudioContext, buf: AudioBuffer, floor = 5e-3, fadeSecs = 0.03): AudioBuffer | null {
  const chs: Float32Array[] = [];
  let peak = 0, last = 0;
  for (let k = 0; k < buf.numberOfChannels; k++) { const d = buf.getChannelData(k); chs.push(d); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; } }
  if (peak < 1e-5) return null;
  for (const d of chs) for (let i = d.length - 1; i > last; i--) if (Math.abs(d[i]) > peak * floor) { last = i; break; }
  const n = Math.min(buf.length, last + 1), fade = Math.floor(buf.sampleRate * fadeSecs), out = c.createBuffer(chs.length, n, buf.sampleRate);
  chs.forEach((d, k) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = (d[i] / peak) * Math.min(1, (n - i) / fade); out.copyToChannel(a, k); });
  return out;
}

type Bufs = AudioBuffer[] & { last?: number };

/** Sounds rendered ahead, a few variants each. `start()` renders everything
 * a buffer at a time; `has(k)` and `pick(k)` (a variant, not the one just
 * played) are for the engine. */
export class Bank implements BankLike {
  o: BankOptions;
  rand: Rand;
  bufs: Record<string, Bufs | 'busy'> = {};
  started = false; done = false; bytes = 0; ms = 0;
  rate: number;
  irs: Record<string, Float32Array<ArrayBuffer>[]> | null = null;
  noises: Record<number, AudioBuffer> | null = null;
  queue: [string, BankRecipe, number][] | null = null;
  total = 0; first = 0; made = 0;
  idling = false;
  constructor(o: BankOptions) { this.o = o; this.rand = o.rand || new Rand(); this.rate = o.rate ?? 48000; }

  has(k: string): boolean { const b = this.bufs[k]; return !!(b && b !== 'busy' && b.length); }
  /** A variant, not the one just played. */
  pick(k: string): AudioBuffer {
    const b = this.bufs[k] as Bufs;
    let i = Math.floor(this.rand.next() * b.length);
    if (b.length > 1 && i === b.last) i = (i + 1) % b.length;
    b.last = i;
    return b[i];
  }
  /** Renders everything, a buffer at a time, yielding between them: every
   * sound's first variant (in order), then each one's second, and so on, so
   * each can play as soon as possible. An offline context needs no tap, so
   * this can run while the game loads, before any; its buffers play in the
   * live context the tap makes (resampled, if its rate differs). `wait` (ms)
   * puts it off a moment (so a tap that starts it isn't slowed). */
  async start(rate?: number, wait = 0, o: BankStart = {}): Promise<void> {
    if (this.started) return;
    this.started = true;
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const max = this.o.rate ?? 48000;
    this.rate = Math.min(max, rate || max);
    const t0 = performance.now(), per: [string, BankRecipe, number][] = [], R = this.o.recipes;
    this.irs = {};
    const f = this.o.first ? this.o.first(this, o) : null;
    if (f) await f;
    for (const k of this.o.order) {
      const B = R[k], n = this.o.count ? this.o.count(k, B) : B.n || 1;
      this.bufs[k] = this.bufs[k] || [];
      per.push([k, B, n]);
    }
    const q: [string, BankRecipe, number][] = (this.queue = []), most = per.reduce((a, p) => Math.max(a, p[2]), 0);
    for (let v = 0; v < most; v++) for (const [k, B, n] of per) if (v < n) q.push([k, B, v]);
    this.total = q.length; this.first = per.length; this.made = 0;
    while (q.length) {
      if (this.made >= this.first && o.enough && o.enough()) break;
      await this.renderNext();
      if (o.pace) await o.pace(this.made, this.total);
      else if (q.length) await new Promise((r) => setTimeout(r, this.o.gap ?? 40));
    }
    this.ms = performance.now() - t0;
    this.done = !q.length;
  }
  async renderNext(): Promise<void> {
    const [k, B, v] = (this.queue as [string, BankRecipe, number][]).shift() as [string, BankRecipe, number], b = await this.renderOne(B, v);
    if (b) { (this.bufs[k] as Bufs).push(b); this.bytes += b.length * b.numberOfChannels * 4; }
    this.made++;
  }
  /** What the start left, a buffer at a time, only when it can't be felt:
   * at a free moment (the game says), or when the browser says it's idle
   * with time to spare. */
  idle(): void {
    if (this.idling || this.done || !this.queue || !this.queue.length) return;
    this.idling = true;
    const ric = typeof requestIdleCallback === 'function', ms = this.o.idleMs ?? 12;
    const free = () => (this.o.free ? this.o.free() : false);
    const go = async () => {
      await this.renderNext();
      if (!(this.queue as unknown[]).length) { this.done = true; this.idling = false; return; }
      wait();
    };
    const wait = () => {
      if (ric) requestIdleCallback((dl) => (free() || dl.timeRemaining() >= ms ? go() : wait()), { timeout: 1000 });
      else setTimeout(() => (free() ? go() : wait()), 250);
    };
    wait();
  }
  /** Renders those of keys not yet rendered, in turn, one variant each,
   * while still(); pace, if given, is awaited between them instead of the
   * gap. */
  async want(keys: string[], still: () => boolean = () => true, pace: ((k: number, n: number) => Promise<unknown>) | null = null): Promise<void> {
    if (!this.rate || !this.irs) return;
    for (const k of keys) {
      if (!still()) return;
      if (this.has(k) || this.bufs[k] === 'busy') continue;
      this.bufs[k] = 'busy';
      const b = await this.renderOne(this.o.recipes[k], 0);
      this.bufs[k] = b ? [b] : [];
      if (b) this.bytes += b.length * b.numberOfChannels * 4;
      if (pace) await pace(0, 0); else await new Promise((r) => setTimeout(r, this.o.gap ?? 40));
    }
  }
  /** Lets them go. */
  drop(keys: string[]): void {
    for (const k of keys) { const b = this.bufs[k]; if (b && b.length && b !== 'busy') for (const x of b) this.bytes -= x.length * x.numberOfChannels * 4; delete this.bufs[k]; }
  }
  /** One variant of a sound, rendered. */
  async renderOne(B: BankRecipe, v: number): Promise<AudioBuffer | null> {
    const ch0 = Object.assign({}, BANK_CHAIN, this.o.chain || {}), verbs = this.o.verbs || BANK_VERBS;
    const rate = Math.min(this.rate, B.rate || this.rate), ch = B.ch || 1, c = new OfflineAudioContext(ch, Math.ceil(B.dur * rate), rate);
    // (a noise buffer kept for each rate)
    const nz = this.noises || (this.noises = {});
    if (!nz[rate]) nz[rate] = noiseBuffer(c, this.rand, 2);
    const R: Voices = { ctx: c, waves: waves(c, this.o.waves), noise: nz[rate], rand: this.rand };
    // the chain: the voices, the saturation, a high pass under the sub's
    // own, a low pass over what a phone makes harsh; the reverb beside it
    const out = c.createGain(), lp = c.createBiquadFilter(), hp = c.createBiquadFilter(), sh = c.createWaveShaper(), dry = c.createGain();
    out.connect(c.destination);
    lp.type = 'lowpass'; lp.frequency.value = ch0.lp; lp.Q.value = ch0.lpQ; lp.connect(out);
    hp.type = 'highpass'; hp.frequency.value = ch0.hp; hp.connect(lp);
    sh.curve = curve(B.drive || ch0.drive); sh.oversample = ch0.oversample; sh.connect(hp);
    dry.connect(sh);
    let verbIn: AudioNode = dry;
    if (B.verb) {
      const V = verbs[B.verb] || { secs: 1 }, irs = this.irs || (this.irs = {});
      const ir = irs[B.verb + rate] || (irs[B.verb + rate] = impulse(rate, V.secs, V.modes || [], this.rand)), ib = c.createBuffer(2, ir[0].length, rate);
      ib.copyToChannel(ir[0], 0); ib.copyToChannel(ir[1], 1);
      const cv = c.createConvolver(), vl = c.createBiquadFilter(), vg = c.createGain();
      cv.buffer = ib; vl.type = 'lowpass'; vl.frequency.value = ch0.verbLp; vg.gain.value = B.wet || ch0.wet;
      verbIn = c.createGain(); (verbIn as GainNode).gain.value = 1; dry.connect(verbIn);
      verbIn.connect(cv); cv.connect(vl); vl.connect(vg); vg.connect(out);
    }
    const o: Out = { node: dry, sendTo: verbIn, level: 1, srcs: [], end: 0, send: null };
    B.fn(R, o, 0.004, v);
    const buf = await c.startRendering();
    return trim(c, buf, this.o.trim && this.o.trim.floor, this.o.trim && this.o.trim.fade);
  }
}

// ---------------------------------------------------------------------------
// The music's machinery
// ---------------------------------------------------------------------------

/** A continuous voice's recipe: notes [semitones from the engine's root,
 * detune cents]; w its wave; bp a band pass before lp, its low pass; lfo
 * [rate, Hz] on the low pass; trem [rate, depth] a slow swell; g its level.
 * Anything else is the game's (when it comes in, say). */
export interface DroneRecipe { notes: [number, number][]; w: string; lp: number; bp?: number; lfo?: [number, number]; trem?: [number, number]; g?: number; [k: string]: unknown }
export interface Drone { out: GainNode; lp: BiquadFilterNode; oscs: OscillatorNode[]; L: DroneRecipe }
export interface Band { f: BiquadFilterNode; g: GainNode }

/** A continuous voice into dest, started now and kept running (its level 0
 * until it's wanted). */
export function drone(S: Engine, L: DroneRecipe, dest: AudioNode): Drone {
  const c = S.ctx, out = c.createGain(), tr = c.createGain(), lp = c.createBiquadFilter();
  out.gain.value = 0; tr.gain.value = 1;
  lp.type = 'lowpass'; lp.frequency.value = L.lp; lp.Q.value = 0.6;
  lp.connect(tr); tr.connect(out); out.connect(dest);
  let head: AudioNode = lp;
  if (L.bp) { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = L.bp; bp.Q.value = 0.7; bp.connect(lp); head = bp; }
  const lfo = (rate: number, depth: number, param: AudioParam) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); };
  if (L.trem) lfo(L.trem[0], L.trem[1], tr.gain);
  if (L.lfo) lfo(L.lfo[0], L.lfo[1], lp.frequency);
  const oscs = L.notes.map(([s, det]) => {
    const o = c.createOscillator();
    if (S.waves[L.w]) o.setPeriodicWave(S.waves[L.w]); else o.type = L.w as OscillatorType;
    o.frequency.value = hz(s, S.root); o.detune.value = det; o.connect(head); o.start();
    return o;
  });
  return { out, lp, oscs, L };
}
/** A band of noise, looped from somewhere in the engine's noise, through a
 * filter (bandpass unless said), silent until it's set: a place's wind,
 * water or room. */
export function band(S: Engine, dest: AudioNode, type?: BiquadFilterType): Band {
  const c = S.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = S.noise; src.loop = true;
  f.type = type || 'bandpass'; f.frequency.value = 500; f.Q.value = 0.8; g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(0, S.rand.next() * 1.8);
  return { f, g };
}
/** How much of something comes in as s rises past `at`: none below at - w/2,
 * all above at + w/2, smoothly between. */
export function presence(s: number, at: number, w = 0.2): number { let k = (s - at + w / 2) / w; k = k < 0 ? 0 : k > 1 ? 1 : k; return k * k * (3 - 2 * k); }

/** The music: built on the engine's context once there is one (its master
 * into the music's bus, a drone for each layer, then the game's `setup`),
 * and ticked every frame: `listen(now)` each frame (what the game doesn't
 * call itself), `update(now, state())` every `every` s. A game makes one
 * and gives it its own fields and methods (setup, state, update, listen and
 * whatever else its music does). */
export class Music implements MusicLike {
  S: Engine | null = null;
  built = false;
  /** The layers' drones, by id. */
  v: Record<string, Drone> = {};
  master: GainNode | null = null;
  layers: Record<string, DroneRecipe>;
  every: number;
  lastUp = -9;
  /** When each kind of event is next due. */
  nextEv: Record<string, number> = {};
  private targets = new WeakMap<AudioParam, number>();
  /** The game's: what's built after the layers. */
  setup?(S: Engine): void;
  /** The game's: what the music should be doing now. */
  state?(): unknown;
  /** The game's: the music at `now` for state `st`. */
  update?(now: number, st: unknown): void;
  /** The game's: every frame, what it listens for. */
  listen?(now: number): void;
  constructor(o: { layers?: Record<string, DroneRecipe>; every?: number } = {}) { this.layers = o.layers || {}; this.every = o.every ?? 0.1; }

  build(S: Engine): void {
    this.S = S;
    const c = S.ctx;
    this.master = c.createGain(); this.master.gain.value = 1; this.master.connect(S.music);
    this.v = {};
    for (const id of Object.keys(this.layers)) this.v[id] = drone(S, this.layers[id], this.master);
    if (this.setup) this.setup(S);
    this.built = true;
  }
  tick(_dt?: number): void {
    if (!this.built) return;
    const now = (this.S as Engine).ctx.currentTime;
    if (this.listen) this.listen(now);
    if (now - this.lastUp < this.every) return;
    this.lastUp = now;
    if (this.update) this.update(now, this.state ? this.state() : null);
  }
  /** A param glides to v (time constant tc) from now, unless that's already
   * its target. */
  set(p: AudioParam, v: number, now: number, tc: number): void {
    const was = this.targets.get(p);
    if (was !== undefined && Math.abs(was - v) < 1e-4) return;
    this.targets.set(p, v);
    p.setTargetAtTime(v, now, tc);
  }
  /** Forgets a param's target (it was set some other way). */
  forget(p: AudioParam): void { this.targets.delete(p); }
  /** Events now and then: each [kind, least gap, most gap, ...] is first due
   * somewhere in its gap from now, and when it comes due fn(entry) runs and
   * the next is set. Kinds no longer listed are forgotten. */
  due<E extends readonly [string, number, number, ...unknown[]]>(now: number, list: readonly E[], fn: (e: E) => void): void {
    const R = (this.S as Engine).rand;
    for (const e of list) {
      const [kind, lo, hi] = e;
      if (this.nextEv[kind] === undefined) this.nextEv[kind] = now + R.range(lo, hi);
      if (now < this.nextEv[kind]) continue;
      this.nextEv[kind] = now + R.range(lo, hi);
      fn(e);
    }
    for (const kind of Object.keys(this.nextEv)) if (!list.some((e) => e[0] === kind)) delete this.nextEv[kind];
  }
  /** The music dips a moment: to k at t, back after hold. */
  duck(t: number, k: number, hold: number): void {
    const p = this.master && this.master.gain;
    if (!p) return;
    p.cancelScheduledValues(t);
    p.setTargetAtTime(k, t, 0.04);
    p.setTargetAtTime(1, t + hold, 0.6);
  }
}
