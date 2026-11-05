# The roadmap

What would move into Tycho from this study, in five waves: an indexed foundation first, then looks, projection and people, then generated places, then motion, air, the sun and light, and last the specialties a game asks for. Each wave names its modules, the layer each sits in, the game code it absorbs, its first game and a rough size, with an API sketch. The order follows dependencies and who benefits: wave 1 is small (perhaps two to three weeks in all) and touches no existing output, and every later module writes into it. The study's conclusion is that the shared representation matters more than any one generator: every technique that suits these games ends in a palette-indexed picture changed by tables and checked against rules.

**Proposed: everything on this page is a proposal, and counts as an inference.** It follows Tycho's own rules: parts sit in layers (core, pixels, world, play, shell); games pass in their looks; new behavior arrives as options, never changed defaults; code moved from a game must match its old output bit for bit; generation draws only from `Tycho.seed`; and all pixel work happens offscreen once, so each frame only blits ([the five games](games.md) has the rules and the eight principles behind this plan). Sizes are rough: **S** is under about 150 lines and a day or two, **M** about 150 to 500 lines and several days, **L** larger, a week or more, counting tests and docs. Donor names come from [the survey](notes/local_games_and_tycho.md); their exact line counts were not measured except where stated.

- [The waves at a glance](#the-waves-at-a-glance)
- [Wave 1: the indexed foundation](#wave-1-the-indexed-foundation)
- [Wave 2: looks, places in projection, and people](#wave-2-looks-places-in-projection-and-people)
- [Wave 3: generated places](#wave-3-generated-places)
- [Wave 4: motion, air, the sun and light](#wave-4-motion-air-the-sun-and-light)
- [Wave 5: specialties when a game asks](#wave-5-specialties-when-a-game-asks)
- [Order](#order)
- [Risks](#risks)
- [Conclusion](#conclusion)

## The waves at a glance

| Wave | Module | Layer | Absorbs | First game | Size | Explained in |
|---|---|---|---|---|---|---|
| 1 | `ink` (indexed sheets, print, remap, cycle phases, quantize) | pixels | Elsewhere `Ink.Sheet`, `Ink.curve`, `Ink.sprite` (113 lines) | Elsewhere | M | [Palette and resolution](looks.md) |
| 1 | `color` additions (OKLab, ramp builders, `Palette`) | core | Lodestar `hueRamp`, `pntRamp*`, `desaturate`; White Dragon `rp` | Elsewhere, Lodestar | M | [Palette and resolution](looks.md) |
| 1 | `dither` (Bayer tables, world-anchored thresholds, patterns) | core | Merryfolk `BAYER4`, Lodestar `bayerAt`, Elsewhere `paintPool` cells | Elsewhere, Merryfolk | S | [Palette and resolution](looks.md) |
| 1 | `field` (flood, regions, chamfer, automata, neighbor bits, Poisson, jitter) | core | Neo `roomConnected`, Merryfolk `keepReachable`, Lodestar's smoothing pass | all | M | [Worlds and levels](worlds.md), [Sprites](sprites.md) |
| 1 | `seed` additions (fBm builder, ridged, warp, Worley, clump, gradient noise) | core | Lodestar `artNoise`/`artClump`, Merryfolk warp and ridges | Merryfolk, Elsewhere | S–M | [Worlds and levels](worlds.md) |
| 1 | `check` (ink counts, orphans, clusters, reachability, seed sweeps, retry) | core, with test-kit glue | none; extends `testkit` | Elsewhere | S–M | [Worlds and levels](worlds.md) |
| 1 | `check.style` (ramps and hue steps, colors per 4×4 cell, cluster histogram and orphan ratio, outline share, light vector, line weight, proportions, detail density, 3×3 pattern overlap) | core, with test-kit glue | none | Elsewhere | S–M | [Reaching a style](style.md) |
| 2 | `finish` (outline modes, form shading, cleanup, silhouettes, see-through) | pixels | Lodestar `buildArtSprite` shader and `outlineBuf`; Merryfolk `gridCanvas` rings; Neo `spr_outline` | Lodestar, then Elsewhere | M–L | [Sprites](sprites.md) |
| 2 | `iso` (projection, faces, diamonds, depth order) | pixels | Elsewhere `Ink.Iso`, frogs `iso`/`unIso` | Elsewhere | S–M | [Perspectives](views.md) |
| 2 | `kit` (parts with sockets and material slots) | pixels | frogs `hat()`; White Dragon `person(o)` options | Elsewhere, White Dragon | M | [Sprites](sprites.md) |
| 2 | `anim` (clips with holds, gait phase, springs, chains, two-bone IK, wind) | core | Lodestar `kdIK`; White Dragon gait math; Merryfolk `windAt` | Elsewhere | M | [Motion](motion.md) |
| 2 | `figure` (one body description drawn by any painter) | pixels | Elsewhere `Ink.traveler`; prototypes in White Dragon, Merryfolk, Lodestar | Elsewhere | L | [Sprites](sprites.md), [Motion](motion.md) |
| 2 | `bake` (silhouettes, lean frames, squash variants) | pixels | Merryfolk `blitSway` idea | Elsewhere | S | [Motion](motion.md) |
| 2 | `style` (style packs: ramps with roles, scale, light, line, anchors, thresholds; contact sheets; a harness for build-step pre-renders) | pixels, with test-kit glue | Elsewhere `test/look.js` and `test/golden.json` habits | Elsewhere | M | [Reaching a style](style.md) |
| 3 | `gen` (caves, blobs and tunnels, walks, rooms, BSP, regions, node graphs, templates, terrain, biomes) | world | Lodestar `generateFloor`, `generateRuin`, `layRegions`, `placeUndergrowth`; Neo `generateFloor` once on Tycho | Elsewhere (moor, dig) | L | [Worlds and levels](worlds.md), [Real geography](geography.md) |
| 3 | `autotile` (edge, blob and dual-grid bits, layered terrains, pattern rules) | world | Neo's wall-face rule | Elsewhere | M | [Worlds and levels](worlds.md) |
| 3 | `gen.wfc` (simple tiled model, fixed cells, seeded retry) | world | none | Elsewhere, White Dragon | M | [Worlds and levels](worlds.md) |
| 3 | `flora` (Weber–Penn-style brancher, colonization and L-system options, architecture enum, species table, clump stamps, rosettes, pads and ribbed columns, decay levels, season slots, meadow mixes) | pixels | Merryfolk `makeBareTree`, `paintCrown` | Elsewhere, Merryfolk | L | [Plants](plants.md) |
| 3 | `lod` (chunk pyramid: unbounded `(L, cx, cy)` keys, per-level LRU with a byte budget, sliced `make`, mode downscale on indexes, parent fallback, level crossfade, zoom ladder, cumulative pinch scale) | pixels, play | Merryfolk `Ground`, `ZOOMS`, `snapZoom`, pinch and wheel anchoring | Merryfolk, then an endless Elsewhere world | M–L | [Zoom and chunks](zoom.md) |
| 4 | `bake` additions (rotation caches, sprite stacks) | pixels | Tycho's own scalers; MMPX reference code | Lodestar, Elsewhere | M | [Motion](motion.md) |
| 4 | `fx` additions (rain, snow, motes, fireflies, tileable fog and cloud textures) | pixels | White Dragon rain; Merryfolk weather | Elsewhere (moor fog, tram rain) | S–M | [Effects and simulations](effects.md) |
| 4 | `sun` (solar path, phase table keyed on elevation, per-face relighting by sun step, affine shadow transforms, shadow atlas, rim bake, terrain shadow march) | core (path); pixels (shade and shadows) | Lodestar `spriteRim` | Elsewhere | M | [The sun](sun.md) |
| 4 | `light.Ramp` (stepped ramp light: bands, per-ink ramp table, world-anchored Bayer, art-pixel snap; a shader and a `drawPixels` twin) | pixels | Lodestar `gllight` stepped shader | Elsewhere, Lodestar | M | [Light](light.md) |
| 4 | `tilelight` (BFS, directional sweeps, octagonal spread, sky and block channels, shadowcasting, CPU polar shadows, optional static GI bake) | world | White Dragon `lightMap`, Lodestar `lightScene`, Merryfolk `Light.stamp` | Elsewhere (lighthouse), crafting game | M | [Light](light.md) |
| 4 | `audio` additions (a seeded ZzFX-style effect synth, scales and modes, a beat clock, a seeded `Tune`, ambience, a sound palette) | shell | Elsewhere `snd.js` scores | Elsewhere | M | [Sound and music](sound.md) |
| 5 | `mask` (seeded mirrored-mask and automaton sprites, glyphs) | pixels | White Dragon's invented 3×5 sign `GLYPHS` | Neo, Elsewhere | S–M | [Sprites](sprites.md) |
| 5 | `cells` (the falling-sand sim, fulfilling the planned `liquid`: material table compiled to typed arrays, contact, temperature and burn reactions, sleeping chunks, seeded xorshift, ink shades through `drawPixels`; Doom fire as a preset) | world | none | an Elsewhere sand quest, crafting game | M–L | [Effects and simulations](effects.md) |
| 5 | indexed `Painter` option, pseudo-3D floor and raycast helpers, pixel font | pixels | Neo `FONT3`, White Dragon `PIX3` | Elsewhere side quests | M each | [Zoom and chunks](zoom.md), [Perspectives](views.md) |

## Wave 1: the indexed foundation

Wave 1 comes first because every later module writes into it, and it touches no existing output: it's new parts plus one small bit-for-bit move from Elsewhere.

**`ink`** ([Palette and resolution](looks.md)). The sheet moves in from Elsewhere bit for bit, held by Elsewhere's existing `test/golden.json` frames, and gains four new abilities: remapping, phase printing for palette cycles, glow printing to fit Tycho's `{ c, e, w, h, ax, ay }` sprite shape, and quantizing RGB art from `Shapes` or `Pix` into indexes offscreen. The anchor mirror becomes an option so that `w − 1 − ax` and `w − ax` both survive.

```js
// pixels: Tycho.ink  (moved from elsewhere/js/ink.js, then extended)
const S = new Tycho.ink.Sheet(w, h, { dark = 0, ox = 0, oy = 0 });
S.px(x, y, c); S.rect(...); S.frame(...); S.line(...); S.disc(cx, cy, rx, ry, c); S.ring(...);
S.poly(pts, c); S.path(pts, c, closed); S.orect(...); S.opoly(...); S.odisc(...);
S.rows(rows, x, y, map, flip); S.tuft(x, y, c);
S.print(pal, { glow: [indexes] }) → canvas | { c, e }   // offscreen, once
S.printCycle(pal, ranges, n) → canvas[]                  // one canvas per cycle phase (new)
S.remap(lut) → Sheet                                     // status, rarity, depth haze (new)
S.inks() → Set<index>                                    // for the eight-ink check (new)
Tycho.ink.curve(pts, closed = true, seg = 8) → pts
Tycho.ink.sprite(rows, map, pal, ax, ay, flip, { mirror: 'last' | 'edge' }) → { c, e, w, h, ax, ay }
Tycho.ink.fromCanvas(canvas, pal, { dither }) → Sheet    // OKLab nearest; offscreen, willReadFrequently
```

**`color` additions** ([Palette and resolution](looks.md)). They leave `rampOf`, `tone`, `shade` and `mix` untouched and add a perceptual path beside them. Lodestar's `hueRamp` moves in bit for bit with its exemption list as an option. A `Palette` object makes Elsewhere's named eight-ink sets, Merryfolk's seasonal sets and Neo's sector sets the same kind of thing, with remap, fade, cycle and a lightness-order check so reprints keep each ink's role.

```js
// core: Tycho.color (additions)
Tycho.color.oklab(rgb) → [L, a, b];  Tycho.color.rgbOfOklab(lab) → rgb   // clip by reducing chroma
Tycho.color.rampOk({ hue, n = 5, L = [0.2, 0.92], chroma = 0.12, shift = 20, toward = 'warm' }) → RGB[]
Tycho.color.hueRamp(ramp, amt, { keep }) → RGB[]          // Lodestar art.js, bit for bit
Tycho.color.rampFrom(hex, n = 6, { deep = 0.5, high = 0.25 }) → RGB[]   // White Dragon's rp
Tycho.color.nearest(pal, rgb) → index                     // OKLab distance
const P = Tycho.color.palette(['#1a1c2c', ...], { names: 'DMGLRTBO' });
P.remap({ G: 'B' }) → Palette;  P.fade('dark', steps, ramps) → Palette[];  P.cycle([i0, i1], k) → Palette
P.order() → index[]                                       // lightness order, to check reprints keep roles
```

**`dither`** ([Palette and resolution](looks.md)). Tiny and pure. The `cell` option covers Elsewhere's fat dots and 2×1 iso cells, and `ox`/`oy` anchor the pattern to the world so it never crawls.

```js
// core: Tycho.dither
Tycho.dither.bayer(n = 4) → Uint8Array                    // thresholds 0..n²-1
Tycho.dither.at(x, y, { n = 4, cell = [1, 1], ox = 0, oy = 0 }) → 0..1
Tycho.dither.step(v, steps, x, y, o) → step               // floor(v·steps + t − ½), clamped
Tycho.dither.pattern(level, n = 4) → 16-bit mask          // PICO-8 fillp style
```

**`field`** ([Worlds and levels](worlds.md), [Sprites](sprites.md)). The typed-array tools that pixels and world both need, in core because sprite generation and world generation both use them and pixels can't import world. The automaton takes birth and survival lists, so one function covers RogueBasin's 4-5 caves, Brogue's B5678/S45678 lakes and Sprator's sprite rule. Poisson and the jittered grid live here because they need only an `Rng`.

```js
// core: Tycho.field  — f = { w, h, a: TypedArray }
Tycho.field.make(w, h, Type = Uint8Array) → f
Tycho.field.flood(f, x, y, pass, out?) → count
Tycho.field.regions(f, pass) → { id: Int32Array, sizes: number[] };  Tycho.field.keepLargest(f, pass, fill)
Tycho.field.chamfer(f, inside, { ortho = 2, diag = 3 }) → Int16Array   // the distance behind form shading
Tycho.field.life(f, { birth, survive, steps = 1, edge = 1, rng?, fill? }) → f
Tycho.field.bits(f, x, y, same, { diag = false }) → mask              // neighbor bits for autotile and cleanup
Tycho.field.dilate(f, v, r);  Tycho.field.erode(f, v, r)
Tycho.field.poisson(rng, w, h, r, { k = 30, radius: (x, y) => r, inside }) → [x, y][]
Tycho.field.jitter(seed, cell, x0, y0, x1, y1, { chance = 1 }) → [x, y][]   // chunk-seamless scatter
```

**`seed` additions** ([Worlds and levels](worlds.md)). Builders, so `makeNoise` keeps its three fixed octaves for Merryfolk. Lodestar's clumped noise moves in bit for bit.

```js
// core: Tycho.seed (additions)
Tycho.seed.fbm(noise, { octaves = 4, lacunarity = 2, gain = 0.5, offset = true }) → (x, y) => 0..1
Tycho.seed.ridged(noise, o) → (x, y) => 0..1              // Red Blob's octave-weighted ridges
Tycho.seed.warp(f, g, amount = 4) → (x, y) => f(x + amount·g(x, y), y + amount·g(x + 5.2, y + 1.3))
Tycho.seed.worley(seed, { cell = 16 }) → (x, y) => { d1, d2, id }
Tycho.seed.clump(seed, o) → (x, y) => 0 | 1               // Lodestar artClump
Tycho.seed.gradient(seed) → (x, y) => 0..1                // simplex-like, integer-hashed gradient table
```

**`check`** ([Worlds and levels](worlds.md)). The frogs' rule and the generate-and-test pattern as library calls, built on the test kit's `golden` and `diff` rather than replacing them. Its first use is an Elsewhere test that asserts eight inks or fewer in every quest's printed sheets.

```js
// core: Tycho.check (pure); test-kit glue in dist/testkit.cjs
Tycho.check.inks(sheet) → count;  Tycho.check.orphans(sheet, { keep }) → count
Tycho.check.clusters(sheet) → { min, sizes };  Tycho.check.reachable(f, from, targets, pass) → boolean
Tycho.check.retry(seed, make, ok, { tries = 8, fallback }) → result   // runtime: seed + ':' + attempt
Tycho.check.sweep(make, { from = 1, n = 1000 }, rules) → { failed: [seed, rule][], metrics }
tk.range(results, mx, my, { out }) → png                   // expressive-range heatmap into test/out
```

**`check.style`** ([Reaching a style](style.md)). The style metrics belong in wave 1 because they're the evaluation half of every later generator, and they need only sheets and palettes. Each metric is a pure function over indexes, so a game can measure its anchors once, store the numbers, and fail a test when generated output drifts. The pattern-overlap score maps both pictures to ramp-position classes first, so a palette reprint doesn't count as drift. The thresholds are untested proposals, and the light-vector estimate should be checked against hand-labeled anchors before anything depends on it.

```js
// core: Tycho.check.style (pure); test-kit glue renders contact sheets
const m = Tycho.check.style(sheet, pal, { ramps, mask }) → {
  ramps: [{ hueStep, chroma[] }], perCell: { size: 4, max, mean }, clusters: { hist, orphanRatio },
  outline: { darkShare, selout }, light: [dx, dy], lineWeight, height, headRatio, detail }
Tycho.check.overlap(sheet, anchors, { n = 3, classes: 'ramp' }) → 0..1   // WFC's C1 condition as a score
Tycho.check.compare(m, target, accept) → { pass, misses: [metric, value, limit][] }
```

## Wave 2: looks, places in projection, and people

Wave 2 delivers what Elsewhere's next quests need: kits, figures, iso and the frogs' rule as code.

**`finish`** ([Sprites](sprites.md)). The finishers work on sheets. Lodestar's form shader and selout move in bit for bit as the reference behavior. Merryfolk's multi-ring outline and Neo's shifted-silhouette outline become options on the existing RGB `sprite.outline` when those games adopt them. The cleanup pass is where the frogs' rule becomes code: it merges clusters smaller than `minCluster` into a neighbor, except for named mark inks.

```js
// pixels: Tycho.finish
Tycho.finish.outline(S, { ink, mode: 'outer' | 'selout' | 'inner' | 'rim', diag = false, rings = 1,
                          light = [-1, -1], ramps }) → S
Tycho.finish.shade(S, { materials, ramps, light = [-1, -1, 1], dome = 1, steps = 3, by: 'mask' | 'patch' }) → S
Tycho.finish.clean(S, { orphans = true, holes = true, corners = false, minCluster = 2, keep: [inks] }) → S
Tycho.finish.silhouette(S, ink) → Sheet                   // hit flash, baked
Tycho.finish.seethrough(S, level, { n = 4, cell }) → Sheet // dithered transparency, baked
```

**`iso`** ([Perspectives](views.md)). Lifts Elsewhere's `Ink.Iso` faces and the frogs' projection, keeping the frogs' non-tile scale `K = 0.7` as an option rather than a default. Depth order is a front-corner sort, topological for long footprints.

```js
// pixels: Tycho.iso
Tycho.iso.project(x, y, z, { tw = 32, th = 16, k }) → [sx, sy];  Tycho.iso.unproject(sx, sy, z, o) → [x, y]
const F = new Tycho.iso.Faces(sheet, at);  F.top(x, y, w, d, z, c); F.left(...); F.right(...); F.box(x, y, z, w, d, h, [t, l, r]); F.line(...)
Tycho.iso.diamond(sheet, cx, cy, tw, th, c, { outline })
Tycho.iso.order(items, { foot: it => [x0, y0, x1, y1] }) → items   // front-corner sort, topological for long footprints
```

**`kit`** ([Sprites](sprites.md)). The paper doll. Its choices are plain JSON, so a quest can save a person as a few ids. Elsewhere's frogs (body, hat, apron), Pell's townsfolk and White Dragon's census residents are the first users.

```js
// pixels: Tycho.kit
const K = new Tycho.kit.Kit({
  order: ['back', 'legs', 'body', 'arms', 'head', 'hair', 'hat', 'held'],
  parts: { hat: [{ id: 'beret', rows: [...], anchor: [x, y], sockets: { brim: [x, y] }, tags: ['frog'], weight: 2 }] },
  slots: { skin: [1, 2, 3], coat: [4, 5, 6], outline: 7 },   // material slots in index space
});
K.pick(rng, { tags, fixed: { hat: 'tophat' } }) → choice     // saveable
K.build(choice, { ramps: { coat: [5, 6, 7] }, pose }) → { sheet, ax, ay, sockets }
```

**`anim`** ([Motion](motion.md)). Pure math in core, so world and play parts can use it later. Lodestar's `kdIK` moves in bit for bit.

```js
// core: Tycho.anim
const clip = Tycho.anim.clip([{ f: 0, t: 8 }, { f: 1, t: 6 }], { loop: true });  Tycho.anim.frame(clip, ticks) → f
Tycho.anim.gait(dist, { stride, poses = 4 }) → pose        // phase from distance, quantized
Tycho.anim.spring(s, target, dt, { k, c }) → s
Tycho.anim.chain(pts, lengths, { head, maxBend, gravity, damping, iters = 3, verlet = false }) → pts
Tycho.anim.ik2(hip, foot, a, b, bend = 1) → knee
Tycho.anim.phase(seed, id) → 0..1                          // per-person offsets so crowds don't breathe in sync
Tycho.anim.wind(t, x, { swell, gust }) → -1..1             // one wind for grass, smoke, rain and clouds
```

**`figure`** ([Sprites](sprites.md), [Motion](motion.md)). The planned `figure`. The move record kept each game's figure code at home, so this shouldn't move any one game's figure whole: it's a new shared description and skeleton that each game's own painter draws, so looks stay in the games, as "parameters, not defaults" requires. Elsewhere's traveler is the first client, because Elsewhere's plan asks for "one description of the player drawn by each quest's painter". White Dragon's gait solver is the best donor for `pose`, and moves bit for bit only if White Dragon opts in.

```js
// pixels: Tycho.figure
const d = Tycho.figure.describe(rng, { height: 24, build: 'slim', kit: choice, look });   // plain JSON
Tycho.figure.pose(d, { act: 'walk' | 'stand' | 'reach', phase, view: 'se' | 'ne' | 'side' | 'front' | 'back' }) → skeleton
Tycho.figure.draw(skeleton, painter)                       // painter: an ink-sheet adapter, Shapes, or a stroke painter
Tycho.figure.frames(d, { acts, views, painter }) → { [act]: { [view]: sprite[] } }   // baked once
```

**`bake`, first part** ([Motion](motion.md)). The cheap helpers the finishers and figures need: silhouettes (re-exported from `finish`), lean frames for sway, and squash variants by row and column duplication. All return sheets for one print.

```js
// pixels: Tycho.bake (first part)
Tycho.bake.lean(S, { frames = 3, max = 2, pin: 'bottom' }) → Sheet[]
Tycho.bake.squash(S, { rows = -2, cols = 1 }) → Sheet
```

**`style`** ([Reaching a style](style.md)). A style pack as a first-class object: plain JSON plus anchor files kept in the game's repository. Finishers, kits and figures read its palette, scale, light and line rules as their parameters, and `check.style` reads its thresholds. Its contact sheet renders every direction and variant on the real ground at 1:1 and zoomed: the artifact an agent and a human review together. Heavy pre-renders (SDF, voxel or mesh models and rigs ray-marched at four times size in N directions, quantized to ramps and cleaned) run as Node build steps whose output is committed as index files, so the runtime stays deterministic and the art stays reviewable in a diff.

```js
// pixels: Tycho.style;  build steps run in Node through the test kit
const pack = Tycho.style.pack({ palette: { ramps: { skin: [...], stone: [...] }, inks: 8 },
  scale: { frame: [320, 180], tile: [32, 16], height: 40, head: 0.3, dirs: { drawn: 5, mirror: 3 } },
  light: { dir: [-1, -1, 1], levels: 4, night: 'pal-night' }, line: { outline: 'selout', weight: 1, convex: false },
  anchors: ['anchors/*.ink.json'], accept: { orphanRatio: '+0.01', lightDeg: 20, overlap: 0.8 } });
Tycho.style.sheet(pack, sprites, { ground, zoom: [1, 4] }) → canvas    // the contact sheet
tk.prerender(model, pack, { size: 4, dirs: 8, out: 'art/' })          // build step: render, quantize, clean, write
```

## Wave 3: generated places

Wave 3 delivers the generator Elsewhere's plan already names, with Lodestar's hashes as its guard, plus the flora library and the LOD pyramid.

**`gen`** ([Worlds and levels](worlds.md), [Real geography](geography.md)). Where Elsewhere's plan (the moor, the dig) and Tycho's README meet. Lodestar's floor, ruin, region and undergrowth code moves in first, bit for bit against Lodestar's `test/gen.js` hashes. The graph-and-template tools follow as new code that Neo's floors can adopt once Neo runs on Tycho: node graphs with cycles and lock-and-key, Brogue's loop rule, Spelunky-style templates, terrain and biomes. Merryfolk's hydrology stays in Merryfolk, as the move record kept the games' large pipelines, but its Priority-Flood and D8 routines are good donors for a later `gen.flow` if a second game asks for rivers.

```js
// world: Tycho.gen
Tycho.gen.terrain(seed, w, h, { octaves = 4, exponent = 2, warp = 0, terraces = 0, island = 0 }) → Float32Array
Tycho.gen.biomes(fields, table) → Uint8Array              // nearest point in climate space
Tycho.gen.cave(rng, w, h, { fill = 0.45, birth: [5,6,7,8], survive: [4,5,6,7,8], steps = 5, keep: 'largest' }) → f
Tycho.gen.blobs(rng, f, o);  Tycho.gen.tunnels(rng, f, rooms, { drift, loops })   // Lodestar generateFloor parts
Tycho.gen.walk(rng, f, { from, steps, bias: { n, e, s, w }, carve })               // ore veins, drunkard digs
Tycho.gen.rooms(rng, w, h, { min, max, tries });  Tycho.gen.bsp(rng, rect, { min }) // Lodestar generateRuin; BSP
Tycho.gen.regions(seed, w, h, { cell, jitter, warp, deck }) → { id, mix }            // Lodestar layRegions
Tycho.gen.graph(rng, { w = 5, h = 5, path: 'walk' | 'drop' | 'grow', size, cycles = 1, lockKey = false }) → { nodes, edges, start, goal }
Tycho.gen.loops(graph, { minGain = 6 }) → graph           // Brogue's rule: shortcut only if it saves a long way round
Tycho.gen.template(rng, rows, glyphs, { mirror: 'x' | 'xy' }) → rows   // Spelunky glyphs as chances
Tycho.gen.wfc({ tiles, adj, w, h, rng, fixed, weights, tries = 8 }) → Uint16Array | null
```

**`gen.wfc`** ([Worlds and levels](worlds.md)). The simple tiled model with fixed cells and seeded retry (the last line above), for facades, rooms and blocks.

**`autotile`** ([Worlds and levels](worlds.md)). Reads a `Grid` layer and returns tile choices. The dual grid with layered terrains in priority order is the recommended default for Elsewhere's iso moor, at 16 diamond tiles per terrain drawn through `ink` so they reprint in any palette. LDtk-style pattern rules come with it, and Neo's single wall rule becomes one entry in a pattern rule list.

```js
// world: Tycho.autotile
Tycho.autotile.edges(grid, layer, x, y, same) → 0..15
Tycho.autotile.blob(grid, layer, x, y, same) → 0..46       // 8-neighbor bits reduced to the 47-tile set
Tycho.autotile.corners(grid, layer, x, y, same) → 0..15    // dual grid
Tycho.autotile.layered(grid, layer, order) → (x, y) => [[terrain, mask], ...]
Tycho.autotile.rules(grid, layer, rules, rng) → (x, y) => tile   // { pattern: 3×3, tile, chance }, first match wins
```

**`flora`** ([Plants](plants.md)). New code built on wave 1 and 2 parts: `field.poisson` for leaf and meadow scatter, `finish` for orphan cleanup and selout, and `ink` slots for seasons as palette swaps. One brancher covers most trees through per-level parameters in the Weber–Penn mold (count, down angle, rotation, length ratio, taper, droop per level; crown shape and bare trunk per tree), with leaf-clump stamps drawn after the branches, and an architecture enum switches between monopodial and sympodial continuation and between tiered and continuous branching. A species is a small table row of crown shape, bare-trunk fraction, down angle, AttractionUp, tiers, bark marks, foliage stamp and season slots. Non-branching forms (palms, cacti, rosettes, bamboo) and ground cover (tufts, ferns, mushrooms, flowers) are separate small makers that share the same slots and finish. Merryfolk's `makeBareTree` and `paintCrown` stay in Merryfolk unless it opts in, and are the reference for the look at its scale; Merryfolk's trees and Elsewhere's scatter are the first users.

```js
// pixels: Tycho.flora
const sp = Tycho.flora.species({ arch: 'rauh' | 'massart' | 'leeuwenberg' | 'corner' | 'mcclure' | 'troll',
  shape: 'cone' | 'sphere' | 'flame' | 'umbrella' | 'vase' | 'column' | 'tiers', base = 0.2, down = 60, up = 0,
  levels = 2, tiers, bark: { ramp, marks: 'dashes' | 'scars' | 'lenticels' | 'plates' }, leaf: { stamp, clump: [3, 8] },
  seasons: { autumn: 'carotenoid' | 'anthocyanin' | 'russet', winter: 'bare' | 'keep' | 'marcescent', bloom } });
Tycho.flora.tree(seed, sp, { height: 48, light = [-1, -1, 1], decay = 0, slots }) → { sheet, ax, ay, skeleton }
Tycho.flora.palm(seed, o);  Tycho.flora.cactus(seed, { kind: 'saguaro' | 'pads' | 'barrel' | 'rosette' });  Tycho.flora.grove(seed, o)
Tycho.flora.flower(seed, { head: 'ray' | 'cup' | 'bell' | 'spike' | 'ball', petals, ink, center, nod, height })
Tycho.flora.tuft(seed, o);  Tycho.flora.fern(seed, o);  Tycho.flora.mushroom(seed, { cap, spots, ring, volva })
Tycho.flora.meadow(seed, box, mix, { r, drift }) → [{ x, y, kind, seed }]   // Poisson per species, clumped by noise
Tycho.flora.season(sheet, sp, season) → Sheet                                // a reprint through the season slots
```

**`lod`** ([Zoom and chunks](zoom.md)). Turns Tycho's single-level chunk cache into a pyramid. Two small, general changes come first and could land at any time: an `{ unbounded: true }` (or `inside` callback) option on `Chunks`, and a cumulative pinch scale on `Gestures` so zoom can snap in steps, with existing behavior unchanged by default. The pyramid then keys chunks by level, keeps one LRU per level under a byte budget, protects the parent chunks behind the view (drawn scaled while a child paints), and builds a parent from four cached children by mode downscale on indexes (the most common palette index) or straight from the fields when the children are missing. Merryfolk's ground, zoom ladder and pinch anchoring are the donors, and Merryfolk is the natural first client once its world grows past one map.

```js
// pixels: Tycho.paint (option), Tycho.lod;  play: Tycho.input (option)
new Tycho.paint.Chunks({ size, make, max, unbounded: true })                  // negative and unlimited coordinates
Tycho.input.Gestures({ onPinch(k, x, y, dx, dy, { scale, x0, y0 }) {} })      // scale = d / d0 since the pinch began
const L = new Tycho.lod.Pyramid({ px: 128, levels: 5, bytes: 12e6,
  make: function* (lv, cx, cy, sheet) { ... yield; ... },                     // sliced, position-pure
  far: { tree: [[2, 2], 'leafDark'], person: [[1, 2], 'coat'] } });           // impostor stamps per kind
L.step(view, { budget: ms });  L.draw(g, view, { fade = 200 })                 // parent fallback, then crossfade
Tycho.lod.down(sheet, { op: 'mode' | 'weighted' | 'point', weights }) → Sheet // palette-safe 2× downscale
Tycho.lod.ladder({ tile: 16, steps: [[0, 3], [0, 2], [0, 1], [1, 1], [2, 1]] }); Tycho.lod.snap(scale, ladder, { hysteresis = 0.12 })
```

## Wave 4: motion, air, the sun and light

Wave 4 lights the worlds with the sun, the ramp light and `tilelight`.

**`bake` additions** ([Motion](motion.md)). Rotation caches use Tycho's existing Scale2x row scaler three times, or MMPX for the first 2×, then nearest rotation and a most-common-color downsample. They're cached per sprite and angle, with 16 angles usually enough at 32 pixels or less. Sprite stacks bake angle caches from slices, which can come from generated voxels for iso props.

```js
// pixels: Tycho.bake (additions)
Tycho.bake.rotations(S, { n = 16, pivot, method: 'scale2x' | 'mmpx' }) → Sheet[]
Tycho.bake.stack(slices, { n = 16, lift = 1 }) → Sheet[]
Tycho.bake.cycle(S, pal, ranges, n) → canvas[]             // alias of Sheet.printCycle
```

**`fx` additions** ([Effects and simulations](effects.md)). Weather is stateless and hash-placed: a drop's position is a pure function of its index and the time, so a frame redraws the same however often it's drawn, matching how `fx` already treats its random source ([`Tycho.fx`](../fx.md)). Fog and cloud shadows are tileable noise textures quantized to two or three levels or dithered in one ink, baked once and scrolled. The moor quest (fog, nearly monochrome) and the last tram (neon and rain) are the first users. White Dragon's light-bucketed rain is the donor.

```js
// pixels: Tycho.fx (additions)
Tycho.fx.rain({ n, seed, w, h, vx, vy, len = 3 }, t, draw);  Tycho.fx.snow({ n, seed, layers = 2, sway }, t, draw)
Tycho.fx.motes({ n, seed, box, a, b, blink }, t, draw)     // Lissajous paths; fireflies blink on a hashed period
Tycho.fx.texture(seed, w, h, { noise, levels = 2, ink, dither, tile = true }) → Sheet
```

**`sun`** ([The sun](sun.md)). Split along Tycho's layers. The solar path is pure math in core (three equations): declination, hour angle, elevation, azimuth and day length from a latitude, a day of the year and the save's clock, quantized to bake steps. The phase table (sky, tint, ambient, shadow, rim, palette row) is keyed on elevation. Shading and shadows live in pixels. Faces are reprinted per sun step through ramp rows chosen by Lambert on each face ID, and each caster's shadow is the derived affine transform (length height × cot(elevation), away from the azimuth), baked into a shadow atlas per step so per-frame drawing is a sub-rectangle blit with no transform. Only moving figures shear live. The derived shadow matrices must be checked visually before they're trusted, which is what the study's `sun` demo and Elsewhere's `test/look.js` are for.

```js
// core: Tycho.sun;  pixels: Tycho.sun.shade, Tycho.sun.shadow
const S = Tycho.sun.at({ lat = 45, day, hour, north = 0 }) → { az, el, dayLength, step: [ai, ei] }
Tycho.sun.steps({ az = 16, el = 4, clampEl = 12, fadeBelow = 6 })            // quantized, crisp, shimmer-free
Tycho.sun.phase(table, S.el, { rising }) → { sky: stops, tint, ambient, shadow: { ink, alpha }, rim, palRow }
Tycho.sun.shade(sheet, faces, ramps, S, { tones = 4, ambient }) → Sheet       // per-face relight by remap
Tycho.sun.matrix(view, S, { foot, k }) → [a, b, c, d, e, f]                    // affine card shadow for any parallel view
Tycho.sun.atlas(casters, steps, view, { ink }) → { draw(g, caster, step, x, y) }
Tycho.sun.terrain(heights, S, { cell, out })                                   // grid march into the light cells
```

**`light.Ramp`** ([Light](light.md)). In place of the planned `light.Stepped`: Lodestar's stepped shader generalized into an option beside `Smooth`, which stays the default. It quantizes the light buffer to a few bands, breaks band edges with a Bayer threshold indexed by world pixel, snaps sampling to art pixels, and resolves each band through a per-ink ramp table, so the frame stays inside its inks: light bands as N palette reprints picked by light level, with the dither between them anchored to the world, as in the lights demo's Banded and Dither. A `drawPixels` twin does the same over ink index planes for the no-WebGL path. Elsewhere's lighthouse ("the lamp catching") and moor are the first users, and Lodestar keeps its own until it opts in.

```js
// pixels: Tycho.light (option)
Tycho.light.ramp(pal, { shadowHue = 'violet', steps = 4 }) → Uint8Array          // ink × band → ink, built at load
Tycho.light.Ramp(gpu).draw({ cells, w, h, cell, org, bands = 4, ramp, bayer: { n = 4, world: [cx, cy] }, snap = 1 })
Tycho.light.rampPixels(inkPlane, bandPlane, ramp, out32)                         // CPU twin, then ctx.drawPixels
```

**`tilelight`** ([Light](light.md)). Computes the cells that `Smooth` and the ramp light both draw. It offers Minecraft's integer flood, Terraria's directional max-sweeps with per-tile decay (about 0.91 per step through air) and Starbound's octagonal spread as falloff options, keeps sky and block light in separate channels so the hour changes without a re-propagation, and adds shadowcasting and a CPU polar shadow for hard edges. A static radiance-cascade bake per room (bounce light) is an optional extra for a high-bit showcase, not a default.

```js
// world: Tycho.tilelight
Tycho.tilelight.spread(grid, layer, lights, { mode: 'flood' | 'sweep' | 'octagon', decay: { air: 0.91, solid: 0.56 }, out }) → Uint8Array
Tycho.tilelight.sky(grid, layer, { level = 15, out });  Tycho.tilelight.combine(block, sky, hourLut, out)
Tycho.tilelight.cast(grid, layer, x, y, r, { opaque, out })                         // recursive shadowcasting
Tycho.tilelight.polar(grid, x, y, r, { angles = 256, taps = 9, out })               // CPU 1D shadow map
Tycho.tilelight.bakeGI(scene, { w = 160, h = 90, cascades = 4 }) → Uint8Array       // static rooms only
```

**`audio` additions** ([Sound and music](sound.md)). Tycho's sound engine, moved in from Lodestar, stays as it is; the new parts feed it. A ZzFX-style sample-loop synth turns a few seeded numbers into an effect buffer for `Bank`, and runs in Node so recipes can be tested. Scales and modes, a beat clock with a look-ahead scheduler, and a seeded `Tune` (chords and melody as scale degrees, layers by threshold) put generated music on the music bus. A quest declares a sound palette (modes for each time of day, a voice budget, drums, layer thresholds, an accent wave): the eight-ink rule for sound. Elsewhere's four `snd.js` scores are the first palettes.

## Wave 5: specialties when a game asks

Wave 5 follows demand.

**`mask`** ([Sprites](sprites.md)). Seeded mask sprites are small and new. They suit Neo's bugs, Lodestar's clime variants and an Elsewhere world of small creatures. White Dragon's 40 invented 3×5 sign glyphs from hashes are already a tiny mask generator and the natural first donor.

```js
// pixels: Tycho.mask
const M = Tycho.mask.from(rows);                            // '#' outline, '.' empty, 'o' body-or-empty, 'x' body-or-outline
Tycho.mask.grow(rng, M, { mirror: 'x' | 'xy', fill = 0.5, life: { birth: [0, 1], survive: [2, 3], steps: 2 } }) → f
Tycho.mask.make(seed, M, { tries = 8, accept: { minFill: 0.25, maxFill: 0.75, oneBody: true }, slots, ramps }) → Sheet
Tycho.mask.glyph(seed, { w = 3, h = 5 }) → rows
```

**`cells`** ([Effects and simulations](effects.md)). In place of the planned `liquid`, and waiting for a game: an Elsewhere quest built around sand, fire or water, or the planned crafting game. Materials are authored as a Sandboxels-style data table (weight, viscosity, flammability, conductivity, phase changes, reactions) and compiled into flat typed lookups: weight, class, flags, transitions, burn chance and time, and a dense contact table of results and byte chances. The grid is structure-of-arrays with a one-cell wall gutter. The update scans bottom-up with alternating direction, a parity clock bit, dispersion and viscosity knobs for liquids, sleeping 32×32 or 64×64 chunks, and a seeded xorshift so bots and goldens replay it. Rendering writes ink-indexed shades straight into a `Uint32Array` and uploads with `drawPixels`. An optional quarter-resolution temperature grid keeps heat affordable. Doom fire becomes a preset of the same machinery.

**The rest** ([Zoom and chunks](zoom.md), [Perspectives](views.md)). An `{ indexed: pal }` option on `Painter` would let Elsewhere paint full-bleed worlds lazily in chunks of indexes rather than one large sheet. A Mode 7 floor or raycaster helper would serve a single side quest that wants one, and a voxel mesh pass on `Tycho.gpu` one that wants real 3D. A 3×5 pixel font would end three games' duplicate fonts.

```js
// world: Tycho.cells (the planned liquid);  pixels: options
const M = Tycho.cells.materials({ sand: { cls: 'powder', weight: 90, high: [1700, 'glassMelt'], inks: [3, 4] },
  water: { cls: 'liquid', weight: 30, disperse: 4, high: [100, 'steam'], low: [0, 'ice'] }, ... },
  { react: [['water', 'salt', 'brine', 'brine', 1 / 50], ['lava', 'water', 'lava', 'stone', 1]], hz: 30 });
const W = new Tycho.cells.World(w, h, M, { seed, chunk = 32, heat: 'quarter' | false });
W.paint(x, y, r, mat, { density = 0.5 });  W.step();  W.draw(ctx, pal)        // drawPixels of awake chunks
W.save() → { seed, tick, cells: base64 }                                      // plain JSON
Tycho.cells.fire(w, h, rng, { heat = 36, wind = 0 }) → { step(), field }      // Doom fire into ink thresholds
new Tycho.paint.Painter({ size, indexed: pal })             // chunks of indexes, printed per palette
Tycho.view.floor(map, cam, out, { horizon, focal });  Tycho.view.cast(grid, cam, out)   // pseudo-3D into an index buffer
```

## Order

The order follows dependencies and who benefits *(inference)*:

| Wave | Why here | Rough cost |
|---|---|---|
| 1 | Every later module writes into it; new parts plus one small bit-for-bit move from Elsewhere, touching no existing output | Perhaps two to three weeks in all |
| 2 | What Elsewhere's next quests need: kits, figures, iso and the frogs' rule as code | |
| 3 | The generator Elsewhere's plan already names, with Lodestar's hashes as its guard; the flora library and the LOD pyramid, whose two small enabling options on `Chunks` and `Gestures` can land earlier | |
| 4 | Lights the worlds: the sun, the ramp light and `tilelight` | |
| 5 | Follows demand | |

## Risks

| # | Risk | What to do |
|---|---|---|
| 1 | Bit-for-bit moves from Lodestar run against a Tycho version Lodestar hasn't checked out locally: its submodule is pinned at c25e2962 and the directory is empty ([the survey](notes/local_games_and_tycho.md)) | Start the first move by bringing Lodestar onto the current Tycho |
| 2 | Floating-point drift between browser engines could break Elsewhere's seed replays on Safari *(inference)* | Rest layout decisions on integer hashes; add a Safari run of the seed sweep |
| 3 | Generators can drift from authorship. Elsewhere's design gives each world "one hand-built place" *(inference from Elsewhere's DESIGN.md)* | Generators speed up building and vary the details; they don't stand in for the place. Meanwhile Neo re-implements `shade`, `mix`, `spriteFrom`, `outline`, `tinted`, `flipped` and an `Rng` with Tycho's API; adopting Tycho is a cheap first step that would let it take `gen.graph`, `autotile` and `mask` later |
| 4 | Several numbers behind the new modules are estimates, not measurements: the sub-millisecond ink-to-ramp loop, the 2 to 10 ms CPU cascade, and the cost of plain JavaScript sand at 57,600 cells on phones *(inference)* | A micro-benchmark in Tycho on a real phone for each before a game depends on it |
| 5 | The derived shadow matrices and the LOD memory budget come from geometry and arithmetic *(inference)* | Verify them visually in `test/look.js` and the dev panel before they're documented as behavior |
| 6 | Style metrics can be gamed: a generator can pass every threshold and still look wrong *(inference)* | Keep the human sign-off on a golden contact sheet in the loop, especially for faces and anatomy |

## Conclusion

The research changes the question. It isn't which generator Tycho needs; it's which shared representation lets small generators, strict looks, light and zoom all meet. The answer held up as the scope widened: every technique that suits these games ends in a palette-indexed picture changed by tables and checked against rules. Diablo II shipped exactly that a quarter-century ago, with one palette per act, 48 light levels as index remaps, colormaps for monster variants and part layers for armor. Witchbrook ships its modern version, with greyscale clothing masks recolored by a palette system ([reaching a style](style.md)). A movable sun becomes a ramp row per face and an affine blit per caster ([the sun](sun.md)), a zoomed-out world becomes a mode filter on indexes ([zoom](zoom.md)), a falling-sand material becomes a row in a byte table ([effects](effects.md)), and a target style becomes a pack of numbers and anchors. Tycho has no indexed picture today, while Elsewhere already has one in 113 lines. Moving that sheet in first makes every later module cheaper, because each one only has to produce structure, light levels or coarse levels and let the palette keep the look honest.

The second shift is in where quality comes from, and the style research sharpened it. Shipped generators earn their authored feel from hand-made frames and pieces plus tests that reject bad seeds, not from cleverer randomness. Reaching a specific style works the same way: code can reach any style, so the bottleneck moves to specification and evaluation, which is to say to data and tests. Tycho's games already pin generation with golden hashes and bots. Extending that habit to style metrics, contact sheets and frozen pre-rendered assets makes the riskier work (WFC, mask creatures, flora at every size, a Diablo-like pre-render, a Witchbrook-like kit) safe to try one quest at a time. A bad seed or a drifting style then fails a test before it reaches a player. What still needs a human is the small set of global judgments no local metric sees: a face, a gait, a silhouette that reads.

The donors and each game's files are in [the survey](notes/local_games_and_tycho.md); every source behind the study is in [Sources](sources.md).
