# The painter

`Tycho.paint`: a world (a level, a far layer) painted from a list of operations, lazily, in chunks. It's the White Dragon's, bit for bit: `test/pixels.test.mjs` holds the buffer, its strokes and blocks and the chunks to the game's originals, and the game's golden test pins every level it paints.

Each operation has a box in world px, its own seed and a function that paints into a pixel buffer. A chunk runs only the operations whose box touches it, each starting from its own seed, so strokes meet across chunk edges without seams and anything painted twice matches itself. Chunks are made when first asked for and painted ahead of the camera when a frame has time to spare.

```js
const ops = [];
const paint = (x0, y0, x1, y1, fn) => ops.push({ x0, y0, x1, y1, fn, seed: ops.length * 31 + 7 });
paint(0, 180, 640, 200, (P) => P.block(0, 180, 640, 200, concrete, { base: 0.45, drips: 0.08 }));
paint(40, 100, 90, 180, (P) => P.area(40, 100, 90, 180, glass, (x, y) => 0.3 + (y % 14 === 0 ? 0.2 : 0)));

const painter = new Tycho.paint.Painter({ size: 256, flat: true });
painter.reset({ w: 640, h: 200, ops });            // a new level: every chunk goes
const ch = painter.get(cx, cy);                    // { c, e, x, y }: its picture, glow (or null) and place
painter.ahead(cam.x, cam.y);                       // in a frame's spare time: the nearest chunk not yet made
```

## Tycho.paint.Pix

A pixel buffer over a piece of the world: `new Pix(w, h, ox, oy, { flat })`, (ox, oy) its top left in world px, with a color picture and a glow picture (RGBA, `c` and `g`).

| | |
|---|---|
| `put(x, y, col, glow = 0)` | One pixel, `[r, g, b]`; glow 0..1 puts it on the glow picture that bright |
| `tint(x, y, col, k)` | What's there mixed toward a color, k of the way (haze, steam) |
| `area(x0, y0, x1, y1, ramp, v, o)` | A painted area: `v(x, y)` its value 0..1, read from the ramp (`[r, g, b]` tones, dark to light). Options: `inside(x, y)`, `glow`, `fog` and `fogc`, `seed`, `jit` |
| `block(x0, y0, x1, y1, ramp, o)` | A block lit side-on (`blockV`), with an area's options |
| `sees(x0, y0, x1, y1)` | Whether a world box touches the buffer |
| `canvases()` | `{ c, e }`: the picture, and the glow (null if nothing glows) |
| `n` | The seed the next area takes when it's given none (an operation sets it) |

Two styles, by `flat`:

- **Flat** (the White Dragon's): each pixel its own tone, a block one tone from its base with a crisp lit top edge (`lip`), a shaded bottom, the left edge lit and the right shaded, `drips` (the share of columns with grime running down, `dripLen` px), `bands` (a dark line every n rows) and `panels` (`[w, h]` panel lines).
- **Strokes** (the default): an area laid in short horizontal strokes of close tones, each read at its middle with a little jitter (`jit`, 0.45), so it reads as brushwork; a block with slow noise and `grain`, a beveled lip, soot under, the west face lit and the east shaded, darker `inward`.

`strokeRow(mid, jit, x0, n, y, seed)` is the strokes of one row on their own (each 8 px cell cut into one to three strokes at hashed places), and `blockV(x0, y0, x1, y1, o, flat)` a block's value function.

A game's own painters (railings, laundry, windows, water...) are written against `put`, `tint`, `area` and `block`; a game that always paints one way can name a buffer of its own: `class Pix extends Tycho.paint.Pix { constructor(w, h, ox, oy) { super(w, h, ox, oy, { flat: true }); } }`.

## Operations and chunks

| | |
|---|---|
| `paintOps(P, ops)` | Runs the operations whose box touches the buffer, in order, each from its seed |
| `chunk(ops, cx, cy, size, { flat })` | The chunk (cx, cy), `size` px square: `{ c, e, x, y }` |
| `new Chunks({ size, make, w, h, max })` | A cache of anything made by chunk: `get(cx, cy)` (made if new), `peek`, `has`, `inside`, `over(x0, y0, x1, y1)` (the chunks a box touches), `nearest(x, y, rx, ry)`, `ahead(x, y, { rx: 3, ry: 2, budget })`, `trim(max)`, `reset({ w, h })`, `count` |
| `new Painter({ size, flat, max })` | A `Chunks` of painted chunks for a level: `reset(level)` with `{ w, h, ops }` |

`ahead` makes the nearest chunk not yet made within `rx` chunks across and `ry` down of the one at (x, y), fewest steps first (the first found, row by row, on a tie), and returns how many it made: one, or with `budget` as many as that many milliseconds allow. With `max`, a cache lets the chunk used longest ago go when it holds too many.
