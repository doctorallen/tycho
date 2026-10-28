# Sprites

`Tycho.sprite`: the canvases pictures are made on, letter-row sprites from a palette, outlines, tinted, flipped and enlarged copies, pixel-exact discs, letter grids enlarged by rule, and a painter of sprites from shapes. Each is one game's own, bit for bit, with what differed between the games kept as options; `test/pixels.test.mjs` (without a browser) and `test/browser.js` (in a page) hold them to the originals.

## Canvases and copies

| Name | What it does |
|---|---|
| `canvas(w, h, { read, min })` | `[canvas, ctx]` with smoothing off. `read`: kept in memory for reading back (`willReadFrequently`), for pictures built by reading their pixels; `min`: the least size (Lodestar's 1) |
| `spriteFrom(rows, pal, { w, read, min })` | A sprite from strings, a letter a pixel, colored by `pal` (letter to CSS color); `.`, space and letters the palette lacks are clear. As wide as the longest row, or `w` |
| `outline(src, { ink, own, alpha, grow })` | A 1 px outline round every solid pixel (alpha over 100). `ink`: one color (`'#000000'`); or `own`: each outline pixel the average of the solid pixels it borders times `own` (0.42: a sheep ringed in gray, a pine in deep green). `alpha` (255). `grow`: a pixel all round first, always (`true`, the default), never (`false`) or only when something touches the edge (`'edge'`); without growing it's drawn on `src` itself |
| `tinted(src, col, opts)` | A copy with every solid pixel one color (a hit flash, a silhouette) |
| `flipped(src, opts)` | A copy flipped left to right |
| `flipSprite(s, layers = ['c', 'e'], opts)` | A sprite record flipped: a copy with each named picture flipped (a missing one stays null) and `ax` mirrored (`w - ax`) |
| `enlarged(src, k, opts)` | A copy k times the size, each pixel a block |
| `disc(ctx, cx, cy, r, col)`, `ellipse(ctx, cx, cy, rx, ry, col)` | Pixel-exact filled circles and ellipses, a row of `fillRect` at a time |

`opts` is `canvas`'s: what the copy is made on.

Each game's own, by its options:

| | The White Dragon | Lodestar | Merryfolk |
|---|---|---|---|
| canvas | `canvas(w, h)` (`canvasOf`) | `canvas(w, h, { read: true, min: 1 })` (`makeCanvas`) | `canvas(w, h, { read: !draw })` |
| spriteFrom | | `spriteFrom(rows, pal, { read: true, min: 1 })` | `spriteFrom(rows, pal, { read: true, w: rows[0].length })` |
| outline | | `outline(src, { ink })` (`outlined`) | `outline(c, { own: 0.42, alpha, grow: 'edge' })`, then its GPU copy (`outlineCanvas`) |
| copies | `flipSprite(s)` | `tinted`, `flipped`, `flipSprite(s, ['c', 'ec'], ...)`, `enlarged` (`artFineCanvas`), with `{ read: true, min: 1 }` | `enlarged(src, 2, { read: true })` (`scale2x`), `disc`, `ellipse` (`ellipseFill`) |

## Letter grids enlarged by rule

A sprite drawn as letter rows can be enlarged as letters, before it's colored, so it stays clean pixel art: diagonals stay steps, curves stay round, nothing is blurred and no color is invented (Lodestar's).

| Name | What it does |
|---|---|
| `scale2xRows(rows)` | Scale2x (EPX): twice the size, corners rounded |
| `scale3xRows(rows, fixed)` | Scale3x. Letters in the set `fixed` (eyes, runes, a lamp's core) are enlarged as exact blocks, neither rounded off by their neighbors nor spilling into them |
| `scale15Rows(rows, fixed)` | 1.5x: Scale3x, then every other row and column |
| `scaleRows(rows, k, fixed)` | By those rules for 1, 1.5, 2, 3 and their products (4.5 is three times, then half again); by nearest neighbor for any other k |

## Tycho.sprite.Shapes

A sprite painted from shapes in a game's materials (ramps of tones, dark to light: `'#rrggbb'` or `[r, g, b]`), the White Dragon's people and props. Flat by default: three hard tones a material (shadow, base, light) and no noise, a box a flat panel (lit along its top and left edges, shaded along its bottom and right), a shadow line where a later part lies over an earlier one, and a dark outline round the whole. The light comes from the upper left.

```js
const S = new Tycho.sprite.Shapes(44, 52, seed);   // or Shapes.figure(...), Shapes.soft(...)
S.ax = 20; S.ay = 51;                              // the anchor (the bottom middle unless moved)
S.cap(18, 30, 22, 44, 2.3, 1.9, legs);             // a capsule from a (radius ra) to b (rb)
S.part();                                          // what follows lies over what came before
S.shape([[14, 20], [26, 20], [27, 34], [13, 34]], coat, { down: 0.3 });
S.part(false);                                     // a part that casts no shadow line (hair on a face)
S.ell(20, 14, 4, 4.5, hair);
S.px(22, 13, '#ff4a3a', true);                     // one pixel, glowing
const spr = S.done();                              // { c, e, w, h, ax, ay }: e only if something glows
```

| | |
|---|---|
| `ell(cx, cy, rx, ry, ramp, o)` | A rounded volume, its tone from how it faces the light |
| `box(x0, y0, x1, y1, ramp, o)` | A flat panel; soft, a rounded volume filled out to its corners |
| `limb(ax, ay, bx, by, w, ramp, o)` | A stroke w wide, lit along its upper side |
| `cap(ax, ay, bx, by, ra, rb, ramp, o)` | A capsule: a limb with volume |
| `shape(pts, ramp, o)` | A polygon shaded like cloth over a body: lit on its left, shaded on its right and down it (`o.down`) |
| `poly(pts, col)` | A polygon in one color, or `col(x, y)` a pixel |
| `px(x, y, col, glow)`, `get(x, y)` | One pixel |
| `part(cast = true)` | A new part |
| `finish()` | The shadow lines and the outline (`done` runs it when `line` is set) |
| `done()` | The sprite |

A shape's options `o`: `lo`, `hi` (the ramp's tones it uses), `bias` (lighter or darker), `glow`, `mask(x, y)`, and for polygons `down` and `folds`. `Shapes.soft` paints the older way, in short runs of close tones from the sprite's own seeded stream (`rnd`), with no outline. `flat` and `line` can be set on any instance; `band(s, lo, hi)` (which of the three tones a shading value gets) can be overridden.

The finish's look is the White Dragon's unless given: `new Shapes(w, h, seed, { ink: [8, 6, 12], shadow: 0.45, edge: 0.72 })` (`Shapes.LOOK`): the ink the outline and shadow lines go toward, how far a shadow line goes, and how far the outline goes from the darkest pixel it borders.
