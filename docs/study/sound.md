# Sound and music

How a phone game in plain JavaScript can make all its sound in code, effects, places and music, and give each world a sound of its own the way it already has eight inks of its own. Sound effects in games have been made from a dozen numbers since sfxr in 2007: a wave, a pitch and its slide, an envelope, a filter. ZzFX packs the same idea into 21 numbers and under a kilobyte, and renders each sound once into a buffer. Places are noise through filters (wind), many tiny pitched events (water, gravel, birds) and a slow signal steering both. Adaptive music has two moves, adding layers (vertical) and choosing the next section (horizontal), and a tune stored as scale degrees can change mode with the time of day without being rewritten. The finding: **Tycho already has the hard half of this** (Lodestar's engine: the graph, the browser's rules, voices, an offline bank, drones and noise bands for places). **What it lacks is the musical half**: a sample-loop effect synth driven by a few seeded numbers, a beat clock with a note scheduler, scales and modes, and a "sound palette" a quest declares like its palette, with a small, fixed voice budget, as the chips had.

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). For sound, pre-bake means rendered once into a buffer and per frame means scheduled live as the game runs. What would move into Tycho, and when, is in [the roadmap](roadmap.md).

Text marked *(inference)* is reasoning from the sources, not a sourced fact. Browsers allow sound only after a tap, so every demo here is silent until you press a button; the pictures run either way. Timings were measured in Chrome on a laptop; no phone was measured.

- [What exists](#what-exists)
- [Sound effects from a dozen numbers](#sound-effects-from-a-dozen-numbers)
- [Render once or build each time](#render-once-or-build-each-time)
- [Footsteps, doors and places](#footsteps-doors-and-places)
- [The chip as a style](#the-chip-as-a-style)
- [Music that follows the game](#music-that-follows-the-game)
- [A tune from a seed](#a-tune-from-a-seed)
- [A sound palette per world](#a-sound-palette-per-world)
- [Phones](#phones)
- [What it means for Tycho](#what-it-means-for-tycho)
- [Sources](#sources)

## What exists

**Tycho.audio** is Lodestar's sound engine, moved into Tycho bit for bit and held to Lodestar's own by a test that traces every Web Audio call ([the audio page](../audio.md), [audio.ts](../../src/shell/audio.ts)). It has three parts:

| Part | What it does |
|---|---|
| `Engine` | Two buses (effects and music), each sending to a "space" of fed-back delays, then a high pass, a low pass and a limiter. Cues by name with a least gap between plays and a cap on voices. Quieter and panned by distance from a listener. Nothing before the first tap; asleep while the page is hidden |
| `Bank` | Rich sounds rendered ahead in an `OfflineAudioContext`, a few variants each, one at a time between frames, through a saturation and a convolution reverb; a play is then a buffer at a slightly different speed |
| `Music` | Drones built once and kept running silent until wanted, noise `band`s for a place's wind or water, a slower tick than the frame's, events `due` now and then, a `duck`, and `presence(s, at)`, a smooth curve for a layer coming in as a state rises |

Its voices are `tone` (an oscillator, gliding, through a low pass), `noise` (looped noise through a sweeping filter), `fm` and `stack` (detuned voices through a sweeping filter). Variation comes from the sound's own seeded stream, never the game's, "so sound never moves the world".

**Elsewhere's `js/snd.js`** is a thin shell over that engine: four cues of its own (a tap, a page of the log, a quest, a souvenir) and a `pad`, one note of a chord as a slow `stack`. Each quest brings its own `sounds` and a `score`: `{ bpm, beats, root, chords, w, lp, g }`, played a bar at a time, 0.3 s ahead of the audio clock. The slice's scores are already tiny sound palettes:

| Quest | Tempo | Root | Wave | Low pass | Chords |
|---|---|---|---|---|---|
| The Road | 48 bpm | D3 (146.83 Hz) | sawtooth | 1100 Hz | minor, four bars |
| The frogs | 104 bpm | C4 (261.63 Hz) | triangle | 1500 Hz | I vi IV V |
| The lighthouse | 42 bpm | A2 (110 Hz) | triangle | 700 Hz | minor with rests, major once the lamp is lit |

What neither has *(inference, from reading the code)*: no effect synth that runs as a sample loop (every live voice is a node graph), no beat clock or note sequencer (`Music` follows a state, not a tempo), no scale or mode helpers beyond `hz(semitones, root)`, and no recipe made from a seed. A score is chords only: no melody, no rhythm, no layers that follow play.

## Sound effects from a dozen numbers

**sfxr** was written by DrPetter (Tomas Pettersson) for the 10th Ludum Dare in December 2007, as "a simple means of getting basic sound effects into a game" for entrants with 48 hours and no time to find sounds, and "a lot of the entrants used it" ([sfxr](https://www.drpetter.se/project_sfxr.html)). Its sound is about 22 numbers, each normalized to 0..1 ([jsfxr's sfxr.js](https://github.com/chr15m/jsfxr)):

| Group | Parameters |
|---|---|
| Wave | square (with duty and duty sweep), sawtooth, sine, noise |
| Envelope | attack, sustain, punch (a sustain that starts loud), decay |
| Pitch | start frequency, a floor, slide, slide of the slide, vibrato depth and speed, an arpeggio step (amount, when), repeat (restart the pitch) |
| Filters | low pass (cutoff, sweep, resonance), high pass (cutoff, sweep), a phaser (offset, sweep) |

The buttons are the clever part. Each category, pickupCoin, laserShoot, explosion, powerUp, hitHurt, jump, blipSelect, is a few lines of seeded choices within ranges. In jsfxr, pickupCoin is a sawtooth with a start between 0.4 and 0.9, a short sustain, a punchy decay and a 50% chance of an arpeggio jump. Jump is a square with a random duty and a rising slide of 0.1 to 0.3. hitHurt is square, sawtooth or noise with a steep falling slide. Explosion is noise at a low, squared random start with a falling slide, high punch, and optional repeat, phaser, vibrato or arpeggio. **Mutate** moves each parameter, with probability one half, by up to ±0.05. The loop renders at 8× oversampling, and its noise is a table of 32 random values refilled every period, so noise has a pitch ([jsfxr](https://github.com/chr15m/jsfxr)).

The descendants added waves and effects, not new ideas. **bfxr** (increpare) added five waves (triangle, breaker, tan, whistle, pink noise), a one-bit noise after the BBC Micro's SN76489, and compression, harmonics and a bitcrusher ([rekkerd.org](https://rekkerd.org/bfxr-free-sound-fx-generator-by-increpare/), [a C++ port](https://github.com/madeso/bfxr/)). **ChipTone** (Tom Vian, SFBGames, 2015, first in Flash) descends from bfxr by way of Vian's own as3sfxr and releases its sounds as CC0 ([ChipTone](https://sfbgames.itch.io/chiptone)).

**ZzFX** (Frank Force, 2019, MIT) is the one built for the web: the micro version is "under 1 kilobyte" ([ZzFX](https://github.com/KilledByAPixel/ZzFX)). A sound is an array of numbers in a fixed order, in seconds and hertz rather than 0..1 ([ZzFX.js](https://github.com/KilledByAPixel/ZzFX/blob/master/ZzFX.js)):

| # | Parameter | Default | # | Parameter | Default |
|---|---|---|---|---|---|
| 1 | volume | 1 | 12 | pitchJumpTime | 0 |
| 2 | randomness | 0.05 | 13 | repeatTime | 0 |
| 3 | frequency | 220 Hz | 14 | noise | 0 |
| 4 | attack | 0 s | 15 | modulation | 0 |
| 5 | sustain | 0 s | 16 | bitCrush | 0 |
| 6 | release | 0.1 s | 17 | delay | 0 |
| 7 | shape (sine, triangle, sawtooth, tan, noise, square) | 0 | 18 | sustainVolume | 1 |
| 8 | shapeCurve (the square's duty) | 1 | 19 | decay | 0 |
| 9 | slide | 0 | 20 | tremolo | 0 |
| 10 | deltaSlide | 0 | 21 | filter (sign: low or high pass) | 0 |
| 11 | pitchJump | 0 | | | |

The 1.4 code takes 21, though its header still says "20 controllable parameters". ZzFX writes samples at 44,100 Hz in a plain JS loop into a mono AudioBuffer and plays it with a buffer source, with no oscillator nodes, and sounds can be made ahead and played later ([ZzFX](https://github.com/KilledByAPixel/ZzFX)). Keith Clark's **ZzFXM** is a tracker-style player built on ZzFX instruments, for js13k games ([ZzFXM](https://keithclark.co.uk/articles/zzfxm/)).

The demo is a generator in this manner. A sound is up to four layers, each one voice described by sfxr's kind of numbers plus one more, *grains*: the voice heard only in short random bursts, which is what turns noise into grass, gravel or the stick-slip of a creaking hinge. A category is a function from a seeded stream to layers, and Mutate nudges half the numbers. Each sound is rendered once into a Float32Array and played as a buffer.

<figure class="demo"><div class="stage" data-demo="sfx"></div>
<figcaption><b>Seeded sound effects.</b> Tap a category to make and hear one: <i>Pickup</i>, <i>Jump</i>, <i>Hit</i>, <i>Explosion</i>, a footstep on <i>Grass</i>, <i>Stone</i> or <i>Wood</i>, and a <i>Door</i>. The top box is the whole sound (the amber line is the first layer's pitch, on a log scale), the strip under it is 8 ms of the wave itself where it's loudest, and each line below is one layer's numbers: wave, pitch, slide (octaves a second), the arpeggio jump, when it starts (<code>@</code>), attack, sustain and decay, the filter and the grains. <i>Mutate</i> nudges half the numbers; <i>New seed</i> makes another sound of the same kind. Every sound is rendered once in plain JS, then played as a buffer.</figcaption></figure>

## Render once or build each time

Web Audio offers two ways to make a sound, and the choice is about cost and control:

| | Rendered buffer | Live node graph |
|---|---|---|
| How | A JS loop (or an `OfflineAudioContext`) writes samples once; each play is one `AudioBufferSourceNode` | Oscillators, filters and gains made for each play, with automation on their params |
| Cost per play | One node, whatever the recipe | Several nodes; a frequency change can force new wavetables |
| Memory | length × channels × 4 bytes: 88 KB for half a second of mono at 44.1 kHz | Almost none |
| Same on every device | Yes, the samples are fixed | Up to the browser's own DSP |
| Follows the game | Only by speed, level and pan | Fully: a pitch that tracks speed, a filter that opens with the weather |

Paul Adenot's notes on Web Audio performance give the costs ([Adenot](https://padenot.github.io/web-audio-perf/)): a BiquadFilterNode is "relatively cheap", about five multiplies and four adds a sample; a ConvolverNode is "very expensive" (FFTs every block, in bursts); HRTF panning is "**very** expensive" (up to four convolvers while a source moves); equal-power panning is "rather cheap" and a StereoPanner cheaper; a GainNode is "very cheap to create and connect". Blink and WebKit resample buffers linearly: cheap, a little rough. For phones he advises delays, all-passes and low passes instead of convolution reverb, a short reverb and an equal-power panner instead of HRTF, and a "degraded" mode for weak devices.

In the demo, a pickup (14,148 samples) renders in about 0.4 ms, a footstep in 3 to 5 ms, and a one-second, three-layer explosion in 6 to 11 ms once the code is warm (30 ms the first time). That is too long to do on the frame a sword lands, so effects are rendered at load or between frames, which is what Tycho's `Bank` already does, then played instantly *(inference from the timings)*. Ten effects with three variants each are under 3 MB of buffers *(inference)*.

So effects with a fixed shape (pickups, hits, steps, doors) want rendering; sounds that follow a continuous value (wind, an engine, a rising danger) want live nodes, and music can be either: live oscillators per note are cheap at chip-like note rates *(inference)*. Tycho already does both, live voices in `Engine` and offline renders in `Bank`. What a ZzFX-style synth would add is the compact, seedable description: 20 numbers a recipe, rendered in plain JS with no context at all, so a quest's sounds could be generated from its seed and tested in Node.

## Footsteps, doors and places

Andy Farnell's *Designing Sound* (MIT Press, 2010, 688 pages) makes the case that any sound can be built from first principles, from the physics to a model to a Pure Data patch. His 2005 demo made "fire, water, wind, rain, some animals, some footsteps, some guns, some vehicles" for a first-person shooter, all in code ([interview, 2012](https://designingsound.org/2012/01/18/procedural-audio-interview-with-andy-farnell/)).

**Footsteps.** Perry Cook's "Modeling Bill's Gait" (AES, 2002) analyzes walking into gait timing and heel-toe events, finds a surface's resonances by linear prediction, and resynthesizes loose surfaces with PhISEM, which treats them as particle collisions arriving as a Poisson process; gravel, grass and snow underfoot are among its uses ([Cook 2002](https://soundlab.cs.princeton.edu/publications/billsgait.pdf), [Cook 2003](https://www.cs.princeton.edu/courses/archive/spr05/cos598E/bib/CookWASPAAFinal03.pdf)). For a pixel game that reduces to two layers a step, heel then toe 50 to 90 ms apart *(inference from Cook)*:

| Surface | Body | Texture |
|---|---|---|
| Grass | A faint low thump (90 Hz) | Dense grains (350 to 700 a second) of noise in a band near 3 to 5 kHz |
| Stone | A sharp click (noise in a narrow band near 2 kHz, 20 to 30 ms) and a short low knock | A little grit: sparse high grains |
| Wood | A ringing knock: noise through a narrow band pass (Q 6 to 11) at 330 to 620 Hz, plus a hollow triangle | None |
| Gravel, snow | A soft thump | Grains slower and coarser (gravel) or fine and muffled (snow) |

A **door** in the demo is a creak, a low sawtooth heard in bursts through a resonance (the stick-slip of a hinge), then the latch: a low thud and a click. The same recipe with a different resonance is a ship's timber or a gate *(inference)*.

**Water** is bubbles. Van den Doel's "Physically Based Models for Liquid Sounds" (2005) builds streams, pouring, rain and waves from single bubbles: each a damped sine at the Minnaert frequency of its radius, rising in pitch as it rings, and a user study found a rise parameter near 0.1 sounded most real ([van den Doel 2005](https://repository.gatech.edu/entities/publication/dcc121b6-5fdb-42db-b758-971522f01c70), [Moss et al. 2009](https://gamma.cs.unc.edu/SoundingLiquids/soundingliquids.pdf)). Minnaert's formula puts a 1 mm bubble near 3.3 kHz and a 3 mm one near 1.1 kHz, so a babbling brook is a dozen or more tiny sines a second between 800 Hz and 4 kHz over a bed of low noise *(the constant from Minnaert; inference to apply it)*.

**Wind** is noise through a band pass whose center and level follow a slow gust signal, and a second, narrow band for the whistle once it's strong. **Birds** are short sine chirps, 40 to 90 ms, sweeping fast between 1.5 and 7 kHz, in phrases of two to five. **Rain** is high-passed noise plus more, smaller bubbles; **thunder** a low rumble that arrives after its flash *(inference, in the manner of Farnell)*. Tycho's `Music.band` is already the wind's and the stream bed's building block: a band of looped noise, silent until set.

The demo drives the picture and the sound from one seeded event stream at 30 steps a second: every bubble you hear is a sparkle on the stream, every phrase a bird crossing the sky. That is the rule worth keeping in the game *(inference)*: sound events are the world's events, so a quest that's silent (sound off) or deaf (a phone on silent) shows exactly the same thing.

<figure class="demo"><div class="stage" data-demo="ambience"></div>
<figcaption><b>Wind, water and birds.</b> A meadow by a stream, all of its sound made from noise and filters. Press <i>Play</i> and move <i>Weather</i>: wind is two bands of noise steered by a gust signal (the grass and the tree lean with it); the stream is low noise and single bubbles, each a sine rising as it rings at the pitch of its size (a sparkle where it bursts); birds sing in short sine chirps, fewer as the weather turns; past halfway rain comes in, and at the top thunder rolls a moment after its flash. The bars at the top left are the three levels.</figcaption></figure>

## The chip as a style

The consoles' sound chips gave every game the same tight budget, and composers made that budget a style:

| Machine | Voices | What each could do |
|---|---|---|
| NES (2A03) | 2 pulse, triangle, noise, DMC | Pulses at duties of 12.5, 25, 50 and 75%; a 32-step, 4-bit triangle with no volume control, an octave below a pulse at the same timer; noise from a 4-bit period table, with a mode that shortens it to a periodic buzz; 1-bit delta samples. Envelopes clock at about 240 Hz ([NESdev: APU](https://www.nesdev.org/wiki/APU)) |
| Game Boy | 2 pulse, wave, noise | Four duties, a frequency sweep on the first pulse, a user waveform on the third, LFSR noise; envelope ticks at 64 Hz ([Pan Docs](https://gbdev.io/pandocs/Audio.html)) |
| SNES (S-DSP) | 8 sample voices | BRR-compressed samples at any pitch, 16-bit stereo at 32 kHz, ADSR, echo through an 8-tap FIR, all sharing 64 KB with the program ([SNESdev](https://snes.nesdev.org/wiki/S-SMP)) |
| Amiga MOD (1987) | 4 sample channels | Patterns of 64 rows; 8-bit samples; 15 instruments, later 31; each cell starts a note with one effect ([MOD](https://en.wikipedia.org/wiki/MOD_(file_format)), [Ultimate Soundtracker](https://en.wikipedia.org/wiki/Ultimate_Soundtracker)) |

From those limits came the chip idioms: a chord played as a fast arpeggio on one voice; the triangle as bass, its pitch dropping fast as a kick; noise shared between the hi-hat, the snare and the effects; each part keeping one timbre for the whole tune *(inference)*.

This is the eight-ink rule's twin. Eight inks force a world to choose what it is; four voices and a noise force a tune to choose what it says, and a player hears the limit as a style rather than a lack *(inference)*. The game needn't copy any one chip; each world can declare a budget, its voices and their waves, the way it declares its inks. Two worlds then sound as different as they look: a pulse-12.5% lead and a triangle bass at 128 bpm is a toy shop, sines and a slow pad at 70 bpm is a lake at night.

## Music that follows the game

Adaptive music has two moves, and every system is some mix of them ([Winifred Phillips at GDC 2021](https://www.gamedeveloper.com/audio/horizontal-resequencing-and-dynamic-transitions-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-), [hybrids](https://www.gamedeveloper.com/game-platforms/hybrid-horizontal-vertical-structure-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-)):

- **Vertical layering:** synchronized parts switched on and off by the game (The Maw used three layers, LittleBigPlanet 2's Toy Story level six).
- **Horizontal re-sequencing:** a piece built from segments chosen and ordered during play (Speed Racer, Spore Hero).

What shipped games did:

| Game | Year | What the music does |
|---|---|---|
| Monkey Island 2 (iMUSE) | 1991 | Michael Land and Peter McConnell's engine in SCUMM 5, patented in 1994 (US 5,315,057). A "pit orchestra" that plays longer or shorter while waiting for the game; branch and loop markers in the sequences; in Woodtick each building brings its own instrument's variation of the town theme, and leaving closes with a flourish ([iMUSE](https://en.wikipedia.org/wiki/IMUSE)) |
| Super Mario World | 1990 | Riding Yoshi adds a bongo layer to the overworld theme and its arrangements ([MarioWiki](https://www.mariowiki.com/Ground_BGM_(Super_Mario_World))) |
| Animal Crossing | 2001 on | 24 hourly tracks, switching on the hour, in variants for sun, rain and snow ([Animal Crossing World](https://animalcrossingworld.com/2012/11/all-of-animal-crossing-new-leafs-24-hourly-music-tracks)) |
| Rez | 2001 | Shots make sounds in time with the music; Mizuguchi said quantizing them synced players who weren't on the beat, "and it felt like magic" ([oral history](https://gamedeveloper.com/audio/oral-history-of-i-rez-i-recounts-a-marriage-of-game-and-music)) |
| Spore | 2008 | Music generated live in EA's own Pure Data (EApd), with Brian Eno; notes filtered into scales and modes "so that it started to sound like music instead of noise" ([PdCon](https://www.uni-weimar.de/kunst-und-gestaltung/wiki/PDCON:Conference/Using_Pure_Data_in_Spore_and_Darkspore)) |
| Proteus | 2013 | Ed Key and David Kanaga: the land, plants and animals make the music, which shifts as you walk; four seasons ([Proteus](https://en.wikipedia.org/wiki/Proteus_(video_game))) |
| No Man's Sky | 2016 | Paul Weir's Pulse, "a glorified random file player": instruments (sets of variations of one sound) with rules for how often and at what pitch, pan and volume; 24 sets making 60 basic soundscapes from 65daysofstatic's material. "Very little of the audio is procedurally created, only the creature vocals and background fauna" ([A Sound Effect](https://www.asoundeffect.com/no-mans-sky-sound-procedural-audio/)) |

Behind the generative ones is Brian Eno. *Music for Airports* (1978) phases tape loops of different lengths; in *2/1* seven loops each carry one sung note, the C repeating every 20.1 s and the high F every 19.6 s, and "they all repeat in cycles that are called incommensurable — they are not likely to come back into sync again" ([Reverb Machine](https://reverbmachine.com/blog/deconstructing-brian-eno-music-for-airports/)). *Generative Music 1* (1996) was a floppy of 12 pieces for SSEYO's Koan player ([Intermorphic](https://intermorphic.com/sseyo/koan/generativemusic1/)).

Three lessons for a small game *(inference)*. No Man's Sky, the most "procedural" game on the list, streams nearly all its audio: the generative part is the choosing, not the synthesis. Mario's bongos and Animal Crossing's hours are the cheapest adaptive music there is, one layer and one clock, and both are remembered. And Spore's line is the whole trick of generative melody: constrain the notes to a scale, and randomness starts to sound like music.

## A tune from a seed

The demo makes a tune for a world in five steps, each small enough for a phone:

1. **A palette from the seed:** a family of three modes (day, dusk, night), a root, a tempo (70 to 130 bpm), swing or not, one wave for each of four voices, and a drum kit (a triangle kick falling fast, as on the NES; noise snare and hat).
2. **Chords by a Markov step.** Four bars of chord roots, each a move of a third, fourth or fifth likeliest; then the same four again ending home. A chord is three scale tones a degree apart.
3. **Melody by a Markov walk over intervals:** small steps likeliest, a leap followed by a step back, chord tones on the strong beats. That is the usual order-1 chain over scale-degree intervals ([Melody Triangle](https://code.soundsoftware.ac.uk/hg/mtridoc/rev/09faa61946bc)).
4. **Repetition.** Two 2-bar motifs make an eight-bar song, A A′ B A″, with A″ ending on the tonic. Repetition with small changes is what makes a generated line sound written rather than random *(inference)*.
5. **Stored as scale degrees.** Every note is a degree, mapped onto the current mode only when it plays, as Disasterpeace's #January does ([#January](https://disasterpeace.com/blog/tag.code.January)).

The modes, in order of brightness, each one note flatter than the last: **Lydian, Ionian (major), Mixolydian, Dorian, Aeolian (minor), Phrygian**. A family steps along that line at dusk and at night, Ionian → Mixolydian → Dorian, say, so the same tune darkens without being rewritten. The five-note families, major pentatonic → Japanese yo → minor pentatonic → in, give a world a place with few clashing notes. An equal-tempered approximation of other traditions' scales (gamelan's slendro or pelog, a maqam) is only a flavor of the real tuning, and should be called that *(inference)*.

**Layers by danger.** Each voice has a threshold; the danger slider brings layers in at bar lines, as Mario's bongos do: pad always, then bass (0.1), lead (0.25), hat (0.45), kick (0.55), arpeggio (0.7), snare (0.85). The bass also changes pattern as danger rises: half notes, then a syncopated figure, then octave eighths. Dusk drops the hat; night drops the drums (unless danger is near full), halves the lead and plays it an octave down, and slows the arpeggio to eighths. Tycho's `presence(s, at)` would make the same entrances as crossfades rather than cuts.

**Scheduling.** Notes are scheduled on the audio clock a little ahead, never on the frame or `setTimeout`, following Chris Wilson's pattern: "a good place to start is probably 100ms of 'lookahead' time, with intervals set to 25ms" ([web.dev](https://web.dev/articles/audio-scheduling)). The demo schedules each bar that starts within the next 150 ms, from its 30-a-second step, and makes bars again only from the next unscheduled one when the state changes, so a change lands on the next bar line, as iMUSE's markers do.

<figure class="demo"><div class="stage" data-demo="music"></div>
<figcaption><b>A tune for a world.</b> Each <i>New world</i> is a seed: a family of modes, a root, a tempo, a wave for each of four voices (<b>bass</b> brown, <b>pad</b> blue, <b>lead</b> amber, <b>arpeggio</b> green; drums in the bottom lane) and a drum pattern, written under the controls. Press <i>Play</i> to hear it scroll past the white playhead. The lighter rows are the notes of the current mode, the lightest the root: <i>Dusk</i> and <i>Night</i> move the same tune one and two modes darker and thin it out. <i>Danger</i> brings layers in at the bar lines (pad, bass, lead, hat, kick, arpeggio, snare) and drives the bass harder. The melody is a Markov walk over scale degrees, chord tones on the strong beats, in the shape A A′ B A″.</figcaption></figure>

## A sound palette per world

The proposal *(inference throughout)*: a quest declares a sound palette beside its palette, a small, fixed set from which every cue and every note is drawn, and from which Tycho can generate what the quest doesn't write by hand.

| Field | What it is | Example |
|---|---|---|
| `modes` | Day, dusk and night modes from one family | `['dorian', 'aeolian', 'phrygian']` |
| `root`, `bpm`, `swing` | The key and the pulse | D3, 48 bpm, straight |
| `voices` | Three or four parts, each with one wave and register; the budget | `bass: 'triangle', pad: 'sawtooth', lead: 'pulse25'` |
| `drums` | A kit from noise and the triangle, and its patterns, or none | `kick: [0, 8], hat: none` |
| `layers` | The state each part enters at | `{ lead: 0.25, kick: 0.55 }` |
| `tone` | A filter ceiling (bright or muffled) and a space (dry room, echo, hall) | `lp: 1100, space: 'hall'` |
| `accent` | The wave and register its cues use, so its coins and doors belong to it | `pulse12`, high |
| `ambience` | Its bands of noise and its events | wind 0.4, gulls, waves |

Sketches for the slice and one proposed quest, extending what their scores already say:

| World | Modes | Voices | Pulse | Ambience |
|---|---|---|---|---|
| The Road | Aeolian → Phrygian | sawtooth strings, a triangle bass; no drums | 48 bpm | dusk wind |
| Mrs. Pell's street | Ionian → Mixolydian | pulse-25 lead, triangle bass, a soft hat | 100 bpm, swung | sparrows, a distant radio |
| The frogs | major pentatonic → yo | pulse-12.5 lead, triangle bass, arpeggio | 104 bpm | the pond's bubbles, croaks |
| The lighthouse | Aeolian, turning Ionian when lit | triangle pad, sine lead | 42 bpm | the sea, gulls, the lamp's hum |
| Lost on the moor | none: bell, dog and stream only | none | none | fog wind; the bell, the dog and the stream panned by distance |

The moor (in [Elsewhere's brief](https://github.com/doctorallen/elsewhere/blob/main/DESIGN.md)) is the case where sound is the play: the engine's distance falloff and pan, which Tycho has, do the work.

Two rules from the eight-ink rule carry over. **A palette is an identity, and a change of palette is an event**: the lighthouse's turn to major when the lamp is lit is the sound's version of dusk at the frog stall. And **the player is printed in every world's inks by one recipe**: the shell's own cues (a tap, a page, a souvenir) could likewise be played in the quest's accent wave and mode, so the Lantern's chime is always the Lantern but always sounds like where you are.

## Phones

| Issue | What happens | What to do |
|---|---|---|
| Autoplay | Chrome (for Web Audio since version 70 and 71) starts a context made without a gesture `suspended`; "call context.resume() after the first user gesture (e.g. a click, or tap)"; no exceptions ([Chromium](https://www.chromium.org/audio-video/autoplay)) | Make or resume the context on the first tap. Tycho's `Engine.listen()` does |
| The silent switch | Safari's default audio session behaves as ambient, so the ring/silent switch mutes Web Audio. Since iOS 17, `navigator.audioSession.type = 'playback'` plays through it (and pauses other apps' audio); before, a looping silent `<audio>` element did. Only Safari has the API ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioSession/type), [WebKit 237322](https://bugs.webkit.org/show_bug.cgi?id=237322)) | Respect the switch by default; the player who flipped it meant it *(inference)*. A setting could choose `playback` |
| Backgrounding | Safari puts a context in an `interrupted` state when the page is left, the tab switched or the screen locked; it must be resumed. WebKit has open reports of contexts that say `running` yet are silent after a long background, and of a home-screen app whose `resume()` never returns ([MDN](https://developer.mozilla.org/docs/Web/API/BaseAudioContext/state), [WebKit 276687](https://bugs.webkit.org/show_bug.cgi?id=276687), [WebKit 291892](https://bugs.webkit.org/show_bug.cgi?id=291892)) | Suspend on `visibilitychange`, resume on the next tap, and don't trust `running` alone |
| Latency | A few milliseconds on iOS and macOS, about 10 ms on Windows, 30 to 40 on Linux, 12.5 ms to about 150 ms on Android ([Adenot](https://padenot.github.io/web-audio-perf/)) | Schedule ahead on the audio clock; quantize to the beat, as Rez does, where timing matters |
| AudioWorklet | Safari 14.1 and iOS 14.5, April 2021 ([web-features](https://web-platform-dx.github.io/web-features-explorer/features/audio-worklet.json)) | Not needed: rendered buffers and built-in nodes cover all of this |
| Battery and CPU | A running context keeps the audio thread and device busy even in silence *(inference)*; convolution and HRTF are the expensive nodes ([Adenot](https://padenot.github.io/web-audio-perf/)) | Suspend when nothing is wanted (Tycho's Engine sleeps when hidden or with both settings at 0); delays for space; a voice cap |
| Sample rate | A context runs at the device's rate; a buffer at another rate is resampled linearly on each play ([Adenot](https://padenot.github.io/web-audio-perf/)) | Render effects at the context's own rate |

## What it means for Tycho

Tycho's audio is a complete engine for one game's hand-written sound. What Elsewhere needs on top is a way for each quest to have a whole sound from a few declared numbers. As options any game could use, in `Tycho.audio` *(inference)*:

| Part | What it is | Fit |
|---|---|---|
| `sfx(recipe, rate)` | A sample-loop synth of a ZzFX-style recipe (layers of wave, pitch and slide, envelope, filter, grains), returning a Float32Array; runs in Node too, so recipes can be tested | Pre-bake, through `Bank` |
| `sfx.make(kind, rand)`, `sfx.mutate(recipe, rand)` | sfxr-style generators (pickup, jump, hit, explosion, steps by surface, door, blip) from a seeded stream, and a nudge | Pre-bake |
| `scale(name)`, `degree(scale, d, root)` | Modes and five-note scales as semitone lists, ordered by brightness; a degree to a pitch | Core |
| `Clock` | A beat clock on `ctx.currentTime`: tempo, swing, bars, a look-ahead scheduler, changes on the next bar line | Per frame |
| `Tune` | A seeded tune from a palette: Markov chords and melody as scale degrees, motifs in A A′ B A″, layers with thresholds read through `presence` | Per frame |
| `palette` field in a game's sound | `{ modes, root, bpm, swing, voices, drums, layers, tone, accent, ambience }`, the eight-ink rule for sound | Data |
| `ambience` | Wind, stream bed and rain from `band`s, and bubbles, chirps and grains as `due` events, driven by one event stream the picture can share | Per frame |

None of it changes Lodestar's sound: `Engine`, `Bank` and `Music` stay as they are, and the new parts feed them (a rendered effect is a bank recipe; a tune's notes are cues on the music bus) *(inference)*. In Elsewhere, `snd.js`'s `score` would become a `palette`, with the four existing scores as its first examples.

## Sources

- Tycho: [the audio page](../audio.md) and [audio.ts](../../src/shell/audio.ts)
- [DrPetter, sfxr](https://www.drpetter.se/project_sfxr.html) and [jsfxr](https://github.com/chr15m/jsfxr)
- [bfxr on rekkerd.org](https://rekkerd.org/bfxr-free-sound-fx-generator-by-increpare/) and [madeso's C++ port](https://github.com/madeso/bfxr/)
- [ChipTone](https://sfbgames.itch.io/chiptone)
- [Frank Force, ZzFX](https://github.com/KilledByAPixel/ZzFX) and [Keith Clark, ZzFXM](https://keithclark.co.uk/articles/zzfxm/)
- [Paul Adenot, Web Audio API performance and debugging notes](https://padenot.github.io/web-audio-perf/)
- [Chris Wilson, A tale of two clocks](https://web.dev/articles/audio-scheduling)
- [Andy Farnell interview, Designing Sound, 2012](https://designingsound.org/2012/01/18/procedural-audio-interview-with-andy-farnell/)
- [Perry Cook, Modeling Bill's Gait (2002)](https://soundlab.cs.princeton.edu/publications/billsgait.pdf)
- [Kees van den Doel, Physically Based Models for Liquid Sounds (2005)](https://repository.gatech.edu/entities/publication/dcc121b6-5fdb-42db-b758-971522f01c70) and [Moss et al., Sounding Liquids (2009)](https://gamma.cs.unc.edu/SoundingLiquids/soundingliquids.pdf)
- [NESdev wiki, APU](https://www.nesdev.org/wiki/APU), [Pan Docs, Audio](https://gbdev.io/pandocs/Audio.html), [SNESdev wiki, S-SMP](https://snes.nesdev.org/wiki/S-SMP)
- Wikipedia: [MOD](https://en.wikipedia.org/wiki/MOD_(file_format)), [Ultimate Soundtracker](https://en.wikipedia.org/wiki/Ultimate_Soundtracker), [iMUSE](https://en.wikipedia.org/wiki/IMUSE), [Proteus](https://en.wikipedia.org/wiki/Proteus_(video_game))
- Winifred Phillips at GDC 2021: [horizontal re-sequencing](https://www.gamedeveloper.com/audio/horizontal-resequencing-and-dynamic-transitions-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-) and [hybrids](https://www.gamedeveloper.com/game-platforms/hybrid-horizontal-vertical-structure-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-)
- [MarioWiki, Ground BGM (Super Mario World)](https://www.mariowiki.com/Ground_BGM_(Super_Mario_World))
- [Animal Crossing World, New Leaf's 24 hourly tracks](https://animalcrossingworld.com/2012/11/all-of-animal-crossing-new-leafs-24-hourly-music-tracks)
- [Game Developer, oral history of Rez](https://gamedeveloper.com/audio/oral-history-of-i-rez-i-recounts-a-marriage-of-game-and-music)
- [PdCon, Using Pure Data in Spore and Darkspore](https://www.uni-weimar.de/kunst-und-gestaltung/wiki/PDCON:Conference/Using_Pure_Data_in_Spore_and_Darkspore)
- [A Sound Effect, Paul Weir on No Man's Sky](https://www.asoundeffect.com/no-mans-sky-sound-procedural-audio/)
- [Reverb Machine, deconstructing Music for Airports](https://reverbmachine.com/blog/deconstructing-brian-eno-music-for-airports/) and [Intermorphic, Generative Music 1](https://intermorphic.com/sseyo/koan/generativemusic1/)
- [Melody Triangle](https://code.soundsoftware.ac.uk/hg/mtridoc/rev/09faa61946bc) and [Disasterpeace, #January](https://disasterpeace.com/blog/tag.code.January)
- [Chromium, autoplay policy](https://www.chromium.org/audio-video/autoplay)
- MDN: [AudioSession.type](https://developer.mozilla.org/en-US/docs/Web/API/AudioSession/type) and [BaseAudioContext.state](https://developer.mozilla.org/docs/Web/API/BaseAudioContext/state); WebKit bugs [237322](https://bugs.webkit.org/show_bug.cgi?id=237322), [276687](https://bugs.webkit.org/show_bug.cgi?id=276687), [291892](https://bugs.webkit.org/show_bug.cgi?id=291892)
- [web-features, audio-worklet](https://web-platform-dx.github.io/web-features-explorer/features/audio-worklet.json)

The full research is in the note on [sound and music](notes/sound_music.md).

<script src="demos/kit.js"></script>
<script src="demos/sound-shared.js"></script>
<script src="demos/sfx.js"></script>
<script src="demos/ambience.js"></script>
<script src="demos/music.js"></script>
<script src="demos/start.js"></script>
