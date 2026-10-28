# The core

The layer every other part stands on. Nothing in it touches the DOM.

## Tycho.seed

Seeded randomness. Anything generated or painted draws from these, never `Math.random`, so a seed always makes the same world and the same picture.

| Name | What it does |
|---|---|
| `hash(x, y, s = 0)` | Three integers to 0..1 (non-integers truncated). The painting hash: a place and a seed give a stable value |
| `hash2(x, y)` | Two numbers to 0..1, multiplying before truncating (Merryfolk's; the same as `hash(x, y, 0)` for integers of everyday size) |
| `noise(x, y, s = 0)` | Value noise from `hash`, smooth between lattice points, 0..1 |
| `makeNoise(seed)` | A fractal value-noise function `(x, y) => 0..1` over a table filled from the seed |
| `smooth(t)` | Smoothstep |
| `mulberry32(seed)` | A generator of 0..1 |
| `hashInts(...xs)` | Integers to one 32-bit seed |
| `hashString(s)` | A string to a 32-bit seed |
| `new Rng(seed)` | A seeded stream: `f()`, `f(a)`, `f(a, b)`, `i(a, b)`, `pick(list)`, `chance(p)`, `weighted([[w, v]...])`, `shuffle(list)`, `fork()` |
| `fxRand` | `Math.random` with `Rng`'s shape, for effects nothing saves or tests |

Each is the games' own, bit for bit (`test/core.test.mjs` holds them to the originals): the White Dragon's `hash` and `noise`, Lodestar's `mulberry32`, `hashInts`, `hashString` and `Rng` (the White Dragon's `Rng` draws the same numbers), Merryfolk's `hash2` and `makeNoise`.

## Tycho.math

`clamp`, `lerp`, `unlerp`, `dist`, `dist2`, `angleTo`, `approach(v, target, step)`, `ease(v, target, rate, dt)` (closing the gap at a rate per second, independent of the frame rate) and `wrap(v, m)`.

## Tycho.color

Hex strings (`'#e0701e'`) and `[r, g, b]` triples.

| Name | What it does |
|---|---|
| `rgb(hex)`, `hexToRgb(hex)` | To `[r, g, b]` (`hexToRgb` takes it with or without the `#`) |
| `rgbToHex(r, g, b)` | Rounded and clamped |
| `shade(hex, amt)` | Darker toward black (amt < 0) or lighter toward white |
| `mix(a, b, t)`, `mixRgb(a, b, t)` | Mixing hex colors or triples |
| `lum(c)`, `css(c)` | Lightness 0..255; `'rgb(r,g,b)'` |
| `rampOf(anchors, n = 9, deep = 0.55, high = 0.3)` | A painter's ramp: n tones from soot through the anchors to a warm light, evenly spaced in lightness |
| `tone(ramp, v, jit = 0)` | The ramp's tone at v (0..1), moved by a stroke's jitter |
| `SOOT`, `WARM` | The ramp's ends |

## Tycho.loop

For a game that draws on animation frames and simulates in fixed steps.

```js
const stepper = new Tycho.loop.Stepper({ dt: 1 / 60, max: 4 });
function frame(now) {
  const dt = stepper.since(now);              // seconds since the last frame, at most 0.1
  if (paused) stepper.hold(); else stepper.advance(dt, step);
  render();
  requestAnimationFrame(frame);
}
```

`advance` runs as many fixed steps as the time allows, at most `max` a frame, then drops what's left, so a slow phone slows down rather than walking through walls. `Samples` keeps a rolling window of frame times with percentiles (`pct(0.95)`), for a readout. `Governor` lowers the quality while frames run slow: `new Governor({ window: 2, below: 40, lower })`, then `check(dt, active)` each frame; every `window` seconds of active play it compares the frames a second with `below` and calls `lower()`.
