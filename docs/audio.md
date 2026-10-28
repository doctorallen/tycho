# Tycho.audio

Sound made in code with Web Audio: nothing is loaded. Lodestar's sound engine, for any game that brings its own recipes and music. A game keeps its sound's design (the cues' recipes, the rendered sounds' layers, its waves, its mix and its tunes) and passes it in; the engine is the graph, the rules a browser makes about sound, the voices every recipe is built from, the bank that renders the rich sounds ahead, and the music's machinery.

- [The stream](#the-stream)
- [The engine](#the-engine)
- [The voices](#the-voices)
- [The bank](#the-bank)
- [The music](#the-music)

## The stream

Variation (a pitch a little off, a grain's moment, a variant picked) comes from the sound's own stream, never the game's, so sound never moves the world:

```js
const SND_RAND = new Tycho.audio.Rand(0x2545f491);  // xorshift32; Lodestar's seed by default
SND_RAND.next();          // 0..1
SND_RAND.range(-8, 8);    // a..b
```

Give the same `Rand` to the engine, the bank and anything of the game's own that varies its sound, and every draw comes in the order the recipes ask for it.

## The engine

```js
const Snd = new Tycho.audio.Engine({
  cues: SND_CUES,                  // by name (below)
  mix: T.sound,                    // read live: master, music, sfx, space, voices, gap, near, panW, panMax
  rand: SND_RAND,
  waves: { warm: [12, (k) => 1 / Math.pow(k, 1.45)] },  // periodic waves: [harmonics, amplitude of k]
  root: 293.66,                    // the pitch the music's drones count semitones from (D4)
  level: (kind) => Tycho.audio.setting(Save.data.settings[kind]),  // 'music' or 'sfx', 0..1
  listener: () => (Game.dive ? Game.dive.p : null),               // where sound is heard from (world px)
  chain: { threshold: -10, knee: 6, ratio: 10, attack: 0.003, release: 0.25, lp: 9000, lpQ: 0.5, hp: 80, hpQ: 0.6 },
  space: { taps: [[0.193, -0.6], [0.311, 0.6], [0.467, 0]], lp: 2200, fb: 0.48 },
  canStart: () => typeof Music !== 'undefined',                   // not before the game's ready for it
  onStart: (ctx) => SndBank.start(ctx.sampleRate, 800),          // the live context is made
}).listen();                       // the first tap makes the sound; hidden, it sleeps
Snd.score = Music;                 // built with the context, ticked with the engine
Snd.bank = SndBank;                // where bank cues play from

Snd.cue('mine', { x, y, tier: 3 });  // from anywhere: never throws, nothing before the first tap
Snd.tick(dt);                        // every frame: the settings, then the music
```

The graph: the effects' bus and the music's (`sfx`, `music`), each sending to the space (delays fed back through a low pass, spread left and right) through a send at the bus's own level, so a setting quiets its echoes too; then a high pass, a low pass and a limiter. A setting at 0 silences its bus; with neither wanted, the live context sleeps. Where `chain` or `space` leave a number out, it's Lodestar's.

A cue is `{ g, gap, pri, fn(S, out, t, opts) }`: its level, the least time between two plays (else the mix's `gap`), whether it plays however many are sounding (else at most the mix's `voices` at once), and how it's made, from voices into `out`. Played from the bank instead, `bank(opts)` gives its parts (`[key, level, delay]`), all at one speed a little off true (`spread`, 0.04) and through a low pass somewhere in `lp` ([lo, hi]) if it has one. `where(opts)` overrides the distance falloff (full within `near[0]` px of the listener, gone at `near[1]`, squared; panned `dx / panW`, at most `panMax`), `at()` is where a cue is heard from when its options give no `x`, `also(t)` runs after it's played, and `music: true` makes it a moment of the music's, heard whatever the effects' setting (`fn(S, null, t, opts)`).

| Call | What it does |
|---|---|
| `build(ctx, realtime)` | Makes the graph on a context (the page's, or a test's `OfflineAudioContext`) |
| `play(name, opts, when)` | Plays a cue at `when` (now if not given); whether it played |
| `cue(name, opts)` | The same, now, never throwing |
| `canPlay(name, opts)` | Whether its rendered parts are ready (a cue made live always is) |
| `level(kind)`, `wanted()`, `applyLevels(now)` | The settings, and putting them on the buses |
| `cueOut(t, g, pan, bus)`, `cueDone(out)` | A cue's output (into `bus`, the effects' by default), and cutting it loose once it's done |
| `where({ x, y })` | `{ g, pan }` by distance from the listener |
| `unlock()`, `listen()` | The first tap or key makes the context (as browsers ask); `listen` adds the listeners, and sleeps while the page is hidden |

`Tycho.audio.setting(v)` turns a stored setting into a level: never set or `true` 1, `false` 0, a number clamped (Lodestar's soft is 0.4). `hz(semi, root)` is a pitch, and `quiet(promise)` ignores a refusal to resume.

## The voices

Each starts at `t`, rises over `a`, holds for `hold`, then dies away with time constant `d`, and is cut once it's silent; `g` is its level within the cue and `send` how much of it goes to the space.

| Voice | |
|---|---|
| `tone(S, out, t, v)` | An oscillator: `f` (gliding to `f2` over `glide`), `w` a wave (sine, triangle, square, sawtooth, or one of the game's), `lp` a low pass (`q`), `vib` [rate, Hz] a wobble, `det` cents |
| `noise(S, out, t, v)` | Looped noise from somewhere in it, through a filter: `ft` its type (bandpass unless said), `f` (sweeping to `f2`), `q` |
| `fm(S, out, t, v)` | A carrier modulated at `ratio` times it, the index `i0` (in multiples of f) falling to `i1` with time constant `id`; `lp`, `trem` [rate, depth] |
| `stack(S, out, t, v)` | `n` voices of one wave spread over `spread` cents, through a low pass from `lp` to `lp2` over `sweep` |
| `env(param, t, a, g, d, hold)`, `voiceOut(S, out, v, gain)`, `trem(S, node, t, [rate, depth])` | What they're made of |

`S` is anything with `ctx`, `waves`, `noise` and `rand`: the engine, or one of the bank's renders. A game's own instruments (Lodestar's bells, crackle and swells) are built from these.

## The bank

Sounds too rich to build for every play (Lodestar's are layered like a film's: a transient, a body, a texture, a sub, a tail) are rendered ahead, a few variants each, in an `OfflineAudioContext`, one at a time between frames; a play is then a buffer at a slightly different speed, and until a sound's buffers are ready its cue is silent.

```js
const SndBank = new Tycho.audio.Bank({
  recipes: BANK,                     // key -> { dur, ch, rate, verb, wet, drive, n, fn(R, out, t, variant) }
  order: BANK_ORDER,                 // the commonest first
  count: (k, B) => B.n || 2,         // variants of each
  rate: 48000, gap: 40, idleMs: 12, rand: SND_RAND, waves: SND_WAVE_AMPS,
  verbs: { room: { secs: 0.45, modes: [431, 1173, 1777, 2390] }, hall: { secs: 1.4 } },
  chain: { lp: 8000, lpQ: 0.5, hp: 35, drive: 1.4, oversample: '2x', verbLp: 5000, wet: 0.2 },
  trim: { floor: 5e-3, fade: 0.03 },
  free: () => !!Game.modal,          // a moment that can't be felt, for idle()
  first: (bank, o) => o.intro ? bank.want(['intro.scene1']) : null,  // before the queue
});
await SndBank.start(48000, 0, { pace: (k, n) => job.yield(), enough: () => Loader.mainDone });
SndBank.idle();                      // what the start left, at idle moments
```

`start` renders every sound's first variant in order, then each one's second, and so on, so each can play as soon as possible; `pace(k, n)` is awaited between buffers instead of the gap (a loader's slices), and once every sound has one variant, `enough()` true leaves the rest for `idle()`. An offline context needs no tap, so it can render while the game loads; its buffers play in the live context the tap makes. Each render's chain is the voices into a soft saturation (`curve(drive)`, tanh), a high pass and a low pass, and beside it a convolution reverb from an `impulse` (decaying noise, darker as it goes, with the verb's `modes` ringing in it); the result is brought to its peak and cut once it's `floor` of it (`trim`). `want(keys, still, pace)` renders those not yet rendered, one variant each (an opening's own, first), `drop(keys)` lets them go, `has(k)` and `pick(k)` (a variant, never the one just played) are what the engine uses, and `bytes`, `ms`, `done`, `total`, `first`, `made` say how it stands.

## The music

The machinery of music that adapts: drones built once and kept running (silent until wanted, so nothing continuous is made while playing), bands of noise for a place's own sound, targets set on a param only when they change, a tick of its own slower than the frame's, events now and then, and a dip.

```js
const Music = Object.assign(new Tycho.audio.Music({ layers: MUS_LAYERS, every: 0.1 }), {
  setup(S) { this.bands = { a: Tycho.audio.band(S, this.master) }; },   // after the layers are built
  state() { return { s: presenceOfTheStar() }; },                       // what the music should do
  update(now, st) {                                                     // every `every` s
    for (const id in this.v) this.set(this.v[id].out.gain, this.v[id].L.g * Tycho.audio.presence(st.s, this.v[id].L.at), now, 1.2);
    this.due(now, [['drip', 2, 5]], ([kind]) => playAnEvent(kind));
  },
  listen(now) { /* every frame: what the game doesn't call itself (footsteps...) */ },
});
```

| Part | |
|---|---|
| `drone(S, L, dest)` | A continuous voice: `notes` [semitones from the engine's root, cents] in wave `w` into a band pass `bp` (if any) and a low pass `lp` (with an `lfo` [rate, Hz] on it), a slow swell `trem` [rate, depth]; returns `{ out, lp, oscs, L }`, its level 0 |
| `band(S, dest, type)` | Looped noise through a filter, silent until set: `{ f, g }` |
| `presence(s, at, w = 0.2)` | How much of a layer comes in as `s` rises past `at`, smoothly over `w` |
| `music.build(S)` | Its master into the engine's music bus, a drone for each layer (`music.v[id]`), then the game's `setup(S)` |
| `music.tick(dt)` | `listen(now)` every frame; `update(now, state())` every `every` s |
| `music.set(param, v, now, tc)`, `forget(param)` | A glide to v, unless that's already its target |
| `music.due(now, list, fn)` | Each `[kind, least gap, most gap, ...]` comes due somewhere in its gap; `fn(entry)` then, and the next is set; kinds no longer listed are forgotten |
| `music.duck(t, k, hold)` | Down to k at t, back after hold |

## How it's held to Lodestar's

`test/audio.test.mjs` holds the stream, pitches, settings, presence, the saturation's curve and the reverb's impulse to Lodestar's own, bit for bit, and the music's machinery to its loops. `test/audio.js` (`node test/audio.js`, or `npm run test:browser`) plays Lodestar's sound as it was (`test/fixtures/lodestar-audio/before`) beside Tycho's engine with Lodestar's recipes on it (`after`), each in a frame of one page: every live cue with a spread of options, distance and pan, gaps, the cap and the settings; every sound in the bank, the bank's start, want and drop, and its cues; the music through a timeline of states. Every call made on Web Audio is traced (each node, connection, param value and schedule, buffer's contents, start and stop) and must be the same call for call, the sound's stream must end each case in the same place, and the rendered samples must agree to Chromium's own rounding (it sums a node's inputs in an order of its own, which moves the last bit between two runs of the same code; `SELF=1` compares the original with itself to show it).
