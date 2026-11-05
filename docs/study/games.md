# The five games

What Tycho and the five games built on or beside it (Neo, Lodestar, Merryfolk, Under the White Dragon and Elsewhere) already do for pixel art and worlds, what the games keep writing again on their own, and the eight principles that follow for anything new. Tycho holds the seed, the color helpers, the sprite tools, a chunked painter and the GPU renderer. What it lacks is an indexed layer: its painters work in RGB, so a palette-locked look like Elsewhere's eight inks can't be enforced with Tycho as it is, and every palette technique in this study needs pictures stored as palette indexes. Across the five games the same generic code is written again and again (ramps, reprints, rasterizers, outlines, dither, noise, light grids, particles, wind, flood fills, figures), and none of it is shared yet.

**Proposed: none of the principles on this page is in Tycho yet.** The page describes Tycho and the games as surveyed; what would move into Tycho, and when, is in [the roadmap](roadmap.md).

- [The five games today](#the-five-games-today)
- [What Tycho already has](#what-tycho-already-has)
- [What the games keep solving on their own](#what-the-games-keep-solving-on-their-own)
- [Eight principles](#eight-principles)
- [Sources](#sources)

## The five games today

Each game makes its art in code, from letter-row strings and code recipes, seeded.

| Game | View and size | Palette | How art and worlds are made |
|---|---|---|---|
| **Neo**, a Matrix roguelite | 3/4 top-down, 192 px wide | Free hex, one palette per sector | Letter-row sprites in layers, 16 px tiles from code recipes, floors from a random walk over hand-made room templates pinned by golden hashes. Doesn't use Tycho, and re-implements its helpers |
| **Lodestar**, light survival in caves | Steep 3/4, 1.5 art px per world px | Four-tone hue-shifted ramps | Letter grids shaded into volumes (`buildArtSprite`), a stroke painter, the Kindler from a rigged skeleton with IK; caves from blobs, tunnels, one automaton pass and Voronoi climes. The biggest code donor |
| **Merryfolk**, cozy village life | Top-down, 16 px tiles, zoomable | Seasonal ramps, Bayer dither | Villagers from genes in 3 views × 7 poses, seeded trees, terrain from terraced noise with Priority-Flood water and D8 flow, noise-warped tile edges instead of autotiling |
| **Under the White Dragon**, a vertical cyberpunk city | Side view, 200 px short side | `rampOf` material ramps | `person(o)` builds people from options on `Shapes`, a building kit, hand-placed levels with a procedural skyline, a CPU light grid lit through `light.Smooth` |
| **Elsewhere**, an anthology of small worlds | 2:1 isometric, 320×180 | Eight indexed inks per quest | `Ink.Sheet` keeps palette indexes and reprints in any palette; `Ink.Iso` faces and boxes; a traveler reprinted per world; hand-built places with seeded scatter |

## What Tycho already has

Tycho's own rules ([CLAUDE.md](../../CLAUDE.md)) shape every proposal in this study:

- **Layers.** Parts sit in layers (core, pixels, world, play, shell) and may use only their own layer and those below it. Core never touches the DOM.
- **Parameters, not defaults.** Whatever makes a game look its own way ("palettes, recipes, painting operations, light models, tile kinds") is passed in. A default is never changed in a way that changes an existing game; new behavior arrives as an option.
- **Bit for bit.** Code that moves in from a game gives the same outputs for the same inputs, held by a test.
- **One seed.** Generation and painting use `Tycho.seed` only, in a stable order.
- **Fixed costs.** Each new part needs its source, an export, a test, a docs page, a README line and a rebuilt `dist/`, with CI running every game's tests against the new build.

The GPU stand-in ([the renderer](../renderer.md)) accepts only fillRect, clearRect, drawImage, alpha, four blends (source-over, lighter, destination-out and multiply, with no `screen`), transforms, rectangle clips and gradients, plus `tint`, `lightMap` and `drawPixels`. It draws into a color target, an emissive target and an unlit overlay. It has no paths, arcs, text or readback.

| Namespace (layer) | What it already gives | Where it came from |
|---|---|---|
| `seed` (core) | `hash`, `hash2`, one-octave value `noise`, `makeNoise` (three fixed octaves), `mulberry32`, `hashInts`, `hashString`, `Rng` with `pick`, `weighted`, `shuffle`, `fork`; `fxRand` | White Dragon, Merryfolk, Lodestar |
| `color` (core) | hex and RGB conversions, `shade`, `mix`, `lum`, `rampOf` (soot to warm light), `tone` | the games, chiefly White Dragon |
| `sprite` (pixels) | `canvas`, `spriteFrom` letter rows, `outline` (one ink or own color, `grow`), `tinted`, `flipped`, `flipSprite`, `enlarged`, `disc`, `ellipse`, Scale2x/3x/1.5×/k row scalers, `Shapes` (ramp-shaded figures and props) | Lodestar (scalers), White Dragon (`Shapes`) |
| `paint` (pixels) | `Pix` color-plus-glow buffers, `area`, `block`, stroke style, paint ops, `chunk`, an LRU `Chunks` cache (bounded: non-negative chunk coordinates only), `Painter` | White Dragon |
| `fx` (pixels) | `tick`, `age`, `move`, `Particles`, `sparks`, `burst`, `rise` | the games |
| `gpu`, `light`, `post` (pixels) | the stand-in, atlas, layers, emissive target `F.EM`, `program`/`lightPass`, `light.Smooth` (RGBA cells, bilinear, `p*m + m*0.1`), `post.Blur` (bloom, wet reflections, fade), grid bloom; `NEAREST` textures, no mipmaps | Lodestar, White Dragon |
| `grid`, `collide`, `move`, `path` (world) | lazily made chunked `Grid` with change tracking (no eviction); `Space` and `Tiles`; `Platform` and `topdown`; BFS `distances`, `AStar`, `Routes` | White Dragon, Lodestar |
| `input` (play) | `Gestures` with taps, drags and `onPinch(k, x, y, dx, dy)`, where `k` is the per-move ratio; the wheel's zoom is left to the game | the games |

Sources: [seed.ts](../../src/core/seed.ts), [color.ts](../../src/core/color.ts), [sprite.ts](../../src/pixels/sprite.ts), [shapes.ts](../../src/pixels/shapes.ts), [paint.ts](../../src/pixels/paint.ts), [fx.ts](../../src/pixels/fx.ts), [gpu.ts](../../src/pixels/gpu.ts), [light.ts](../../src/pixels/light.ts), [grid.ts](../../src/world/grid.ts), [path.ts](../../src/world/path.ts), [input.ts](../../src/play/input.ts).

Tycho has no camera, zoom, sun or level-of-detail code. Its test kit already provides `golden`, `diff` and `shot` for headless checks ([the test kit](../testkit.md)). The README lists `figure`, `life` and `sky` as still to come in pixels, and `gen`, `liquid` and `tilelight` in world. The move record, though, keeps "figures, ambient life and skylines; Lodestar's painted rock" in the games for now ([README](../../README.md); [the move](../move.md)).

## What the games keep solving on their own

The survey found the same generic code written again and again. Tycho already covers some of it, and none of it is shared yet.

| Repeated pattern | Games that carry their own | Tycho today |
|---|---|---|
| Ramp building with hue shift, lift, one-color ramps | Lodestar `hueRamp`/`pntRamp`, White Dragon `rp`, Merryfolk `villagerPalette`, Neo hand-listed ramps | `rampOf` only |
| Indexed pictures and palette reprints | Elsewhere `Ink.Sheet.print`, Merryfolk `seasonalImage`, Neo rarity recolor and `SECTOR_PAL` | none |
| Shape rasterizers into buffers | all five (Elsewhere `Ink`, Neo `spr_paint`, Lodestar `PntSpr`, Merryfolk `IR`/`IP`, White Dragon `kFill`) | `Shapes`, `disc`, `ellipse` (RGB) |
| Outline variants (selout, multi-ring, shifted silhouettes) | Lodestar, Merryfolk, Neo, White Dragon, Elsewhere | one-ink and own-color `outline` |
| Ordered dither | Merryfolk, Lodestar, Elsewhere | none |
| Clustered and warped noise | Lodestar `artClump`/`wallNoise`, Merryfolk warp and ridges | `noise`, `makeNoise` |
| Lazy chunked ground outside `paint` | Lodestar `PWIN`, Merryfolk `Ground` (sketch, sliced painting, budgets, fades) | `Painter` (White Dragon only); `Chunks` bounded |
| Stepped zoom with pinch and wheel anchoring | Merryfolk (`ZOOMS`, `snapZoom`, `setZoom`, coarse villager copies) | per-move pinch ratio only |
| Plant generators | Merryfolk `makeBareTree`, `paintCrown` | none |
| CPU light grids | White Dragon `lightMap`, Lodestar `lightScene`, Merryfolk `Light.stamp` | draw step only |
| Stepped or palette light | Lodestar `gllight` (16 bands, violet darks), Elsewhere lighthouse palette reprints | none |
| Particle systems | four games | `fx` (used partly) |
| Wind sway | Merryfolk, Lodestar, White Dragon | none |
| Flood fill and BFS in generation | Neo, Lodestar, Merryfolk | `path.distances` |
| Character recipes and gaits | all five | none (`figure` planned) |

Each game's files are cited in [the survey](notes/local_games_and_tycho.md).

Four mismatches and gaps will matter when code moves:

- **The anchor mirror.** Tycho's `flipSprite` mirrors the anchor as `w − ax`, while Elsewhere's `Ink.sprite` and Neo's `spr_anchor` use `w − 1 − ax` ([sprite.ts](../../src/pixels/sprite.ts)).
- **The scaler.** It's unknown whether Merryfolk's `fineGrid` matches Tycho's `scale2xRows` bit for bit.
- **Negative chunks.** `Chunks.inside` refuses negative coordinates, so an endless world can't use it as written ([paint.ts](../../src/pixels/paint.ts)).
- **Pinch.** `onPinch` reports a per-move ratio, so stepped zoom must multiply the ratios itself ([input.ts](../../src/play/input.ts)).

Nothing exists anywhere for WFC, autotile tile selection, seeded mask sprites, palette cycling, Poisson-disk sampling, L-systems, graph grammars, isometric helpers (depth sorting included), a solar model, cellular sand or style metrics in Tycho. Dithering, palette indexing, hue-shifted ramps, selective outlines, cellular automata, Voronoi regions, hydrology, light placement, pixel fonts and wind exist only inside single games.

## Eight principles

Eight principles follow from Tycho's rules and the research.

| # | Principle | What it means |
|---|---|---|
| 1 | One indexed sheet is the common format | Every palette technique in this study (reprints, cycling, fades, status swaps, eight-ink checks, kit recolors, finishers) needs pictures stored as palette indexes. Tycho's painters work in RGB, so "a palette-locked look like Elsewhere's 8 inks cannot be enforced with Tycho as it is" ([the survey](notes/local_games_and_tycho.md)). Elsewhere's `Ink.Sheet`, a `Uint8Array` of indexes with drawing operations and `print(pal)`, is only 113 lines and the natural donor *(inference)* |
| 2 | Structure apart from finish | Generators output an index mask, a material map or a height field; pluggable finishers (flat outline, strokes, form shading, dither) give the look. Lodestar's painted style, White Dragon's flat three-tone style and Elsewhere's frogs' rule can then share one generator under "parameters, not defaults" *(inference)* |
| 3 | Pure typed-array algorithms in core | Sprite generation in pixels needs flood fill, automaton steps and chamfer distance, and so does world generation, but pixels can't import world. A core `field` module lets both layers use one implementation *(inference)* |
| 4 | Split code by origin | Donor code moves in bit for bit with a test against the game's outputs: Elsewhere's goldens, Lodestar's and Neo's generation hashes. New code with no donor ships with golden hashes over a range of seeds *(inference)* |
| 5 | Pixel work offscreen and once | All procedural pixel work is done offscreen once; per-frame work is only blits, rectangles and the documented extensions ([the renderer](../renderer.md)) |
| 6 | Determinism in `Tycho.seed` | Every layout decision rests on integer hashes, with a bounded, seeded retry and a seed sweep as library functions so every game can generate and test the same way *(inference)* |
| 7 | The index rule extends to light and zoom | Light selects ramp steps rather than multiplying colors, and coarse levels downscale by mode on indexes rather than averaging, so neither invents a color outside the palette. The default stays the existing smooth light, so no game's picture changes unless it opts in *(inference)* |
| 8 | A style is data | Palettes, scales, light and line rules, anchors and metric thresholds live in a style pack in the game's repository; Tycho supplies the metrics and the contact sheet, and heavy pre-renders run as build steps whose output is committed as files ([reaching a style](style.md)) *(inference)* |

Because each new part carries fixed costs (docs, test, README, `dist/`), it's better to have about a dozen well-grouped namespaces than twenty small ones *(inference)*.

## Sources

- [Tycho's CLAUDE.md, the engine's rules](../../CLAUDE.md)
- [The renderer: the GPU stand-in and its extensions](../renderer.md)
- [The test kit: `golden`, `diff`, `shot`](../testkit.md)
- [The move: what moved from the games, and what stays](../move.md)
- [Tycho's README: the parts table](../../README.md)

The full survey, with each game's files, is in [the notes](notes/local_games_and_tycho.md).
