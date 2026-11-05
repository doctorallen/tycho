# Local inventory: how Tycho and the user's five games make pixel art, animation and worlds

Scope: read-only reading of /Users/david/projects/tycho (the engine), and the games neo, lodestar, merryfolk, under-the-white-dragon (UWD) and elsewhere. Sources are local file paths. The lodestar-* sibling folders (lodestar-balance, -beam, -deeds, -feed, -forge, -gear, -intro, -kindler, -lean, -loader, -onboard, -outpost, -painted, -preview, -qa, -qa2, -rig, -simplify, -sound, -spellfx, -structures, -stylestudy) exist in /Users/david/projects and look like worktrees or branches; they were not read. The four games other than Elsewhere were read through code-search passes that sampled files rather than reading every line; details from those passes are marked "(search pass)" where they could be less exact.

## Tycho's current API surface for pixels, sprites, painting, noise, seeds, color, effects, light, post, grids and paths

### Takeaway
Tycho already has a full seeded-randomness core (hashes, value noise, fractal noise, a seeded `Rng`), color ramps, a letter-row sprite maker, outlines, flips, tints, pixel-art upscalers (Scale2x/3x), a shape-based sprite painter (`Shapes`), a chunked lazy world painter (`paint`), simple particles, a WebGL2 batcher that stands in for the 2D canvas, one light model and one bloom/reflection finish. Every one of these came in from a game "bit for bit". There is nothing for generating maps or levels yet: `gen`, `liquid`, `tilelight`, `figure`, `life` and `sky` are named as planned but not built.

### Cited Findings

**Rules for adding features (Tycho CLAUDE.md)**
- Layers: core, then pixels, world, play, shell. A part may use only its own layer and the ones below it, and the build fails otherwise. Core never touches the DOM. — [tycho/CLAUDE.md](/Users/david/projects/tycho/CLAUDE.md)
- "Parameters, not defaults": whatever makes a game look or play its own way ("palettes, recipes, painting operations, light models, tile kinds, items...") is passed in. Never change a default in a way that changes an existing game; add an option instead. — [tycho/CLAUDE.md](/Users/david/projects/tycho/CLAUDE.md)
- "Bit for bit": when a game's code moves in, the same inputs give the same outputs, and a test in `test/` holds it to the game's original. — [tycho/CLAUDE.md](/Users/david/projects/tycho/CLAUDE.md)
- Determinism: generation and painting use `Tycho.seed` only (never `Math.random` or `Date.now()`), in a stable iteration order. `Tycho.seed.fxRand` is only for effects nothing saves or tests. — [tycho/CLAUDE.md](/Users/david/projects/tycho/CLAUDE.md)
- No globals and no game knowledge. Plain dependency-free outputs (`dist/tycho.js` exposes the `Tycho` global; also .mjs/.cjs). — [tycho/CLAUDE.md](/Users/david/projects/tycho/CLAUDE.md)
- A new part needs: its source in the right layer, an export in `src/index.ts`, a test, a page in `docs/`, and a line in the README's parts table. `npm test` must pass and the rebuilt `dist/` must be committed (CI fails if it is stale and runs each game's tests against the new build). — [tycho/CLAUDE.md](/Users/david/projects/tycho/CLAUDE.md)
- Games pass "art recipes" in as data and functions: the header of `src/index.ts` says "A game brings its content (places, art recipes, numbers, words) and its rules; Tycho brings the rest." — [tycho/src/index.ts](/Users/david/projects/tycho/src/index.ts)
- Namespaces exported: seed, math, color, loop, gpu, light, post, sprite, paint, fx, grid, collide, move, path, input, items, guide, harm, save, pwa, dev, loader, audio, inspect, ui. — [tycho/src/index.ts](/Users/david/projects/tycho/src/index.ts)
- README parts table: Pixels is "Partly in", with "then figure, life, sky" still to come. World is "Partly in", with "then gen, liquid, tilelight" still to come. Play is still to get interact, craft, trade, build and mine. — [tycho/README.md](/Users/david/projects/tycho/README.md)
- The move record says these stay in the games: "figures, ambient life and skylines; Lodestar's painted rock; the HUDs and maps; Merryfolk's pointer gestures, particles and the villagers' outline". The parts planned for a coming Terraria-like crafting game are gen, liquid and tilelight, and a big world's chunks being let go of, made again and saved. — [tycho/docs/move.md](/Users/david/projects/tycho/docs/move.md)

**Tycho.seed** (`src/core/seed.ts`)
- `hash(x, y, s = 0): number`: three integers to 0..1 (UWD's). — [seed.ts](/Users/david/projects/tycho/src/core/seed.ts)
- `hash2(x, y)`: Merryfolk's. — [seed.ts](/Users/david/projects/tycho/src/core/seed.ts)
- `smooth(t)`: smoothstep. — [seed.ts](/Users/david/projects/tycho/src/core/seed.ts)
- `noise(x, y, s = 0)`: single-octave value noise on the `hash` lattice, 0..1. — [seed.ts](/Users/david/projects/tycho/src/core/seed.ts)
- `makeNoise(seed): (x, y) => number`: Merryfolk's fractal value noise over a 256×256 table filled by mulberry32. Three fixed octaves (weights 0.6/0.3/0.1, frequencies 1/2.1/4.3). — [seed.ts](/Users/david/projects/tycho/src/core/seed.ts)
- `mulberry32(a)`, `hashInts(...xs)`, `hashString(s)` (FNV-1a). — [seed.ts](/Users/david/projects/tycho/src/core/seed.ts)
- `class Rng { f(a?, b?); i(a, b); pick(arr); chance(p); weighted([[w, v]...]); shuffle(arr); fork() }`. — [seed.ts](/Users/david/projects/tycho/src/core/seed.ts)
- `fxRand`: `Math.random` with Rng's shape. — [seed.ts](/Users/david/projects/tycho/src/core/seed.ts)
- Not present: gradient/Perlin/simplex noise, an octave or lacunarity control on `noise`, domain warping, ridged noise, Worley/cellular noise, Poisson-disc sampling. — [seed.ts](/Users/david/projects/tycho/src/core/seed.ts)

**Tycho.color** (`src/core/color.ts`)
- Conversions and mixing: `rgb(hex)`, `hexToRgb(h)`, `rgbToHex(r,g,b)`, `shade(hex, amt)`, `mix(h1,h2,t)`, `mixRgb(a,b,t)`, `lum(c)` (0.3/0.59/0.11), `css(c)`. — [color.ts](/Users/david/projects/tycho/src/core/color.ts)
- `rampOf(anchors, n = 9, deep = 0.55, high = 0.3): RGB[]`: a painter's ramp from soot (`SOOT` [8,6,12]) through the anchors to a warm light (`WARM` [255,238,200]), with tones evenly spaced in lightness. — [color.ts](/Users/david/projects/tycho/src/core/color.ts)
- `tone(ramp, v, jit = 0)`: picks a ramp entry. — [color.ts](/Users/david/projects/tycho/src/core/color.ts)
- Not present: HSL/OKLab, hue-shifted ramps, nearest-palette quantization, palette swaps or remaps, palette cycling. — [color.ts](/Users/david/projects/tycho/src/core/color.ts)

**Tycho.sprite** (`src/pixels/sprite.ts`, `shapes.ts`)
- `canvas(w, h, { read, min }) → [canvas, ctx]` with smoothing off. — [sprite.ts](/Users/david/projects/tycho/src/pixels/sprite.ts)
- `spriteFrom(rows: string[], pal: Record<string,string>, { w, read, min })`: a letter per pixel; '.', space and unknown letters are clear. — [sprite.ts](/Users/david/projects/tycho/src/pixels/sprite.ts)
- `outline(src, { ink, own, alpha, grow })`: a 1 px outline in one ink, or `own` (each outline pixel the average of its solid neighbors × own). `grow`: true, false or 'edge'. — [sprite.ts](/Users/david/projects/tycho/src/pixels/sprite.ts)
- Copies: `tinted(src, col)`, `flipped(src)`, `flipSprite(s, layers=['c','e'])` (mirrors `ax` as `w - ax`), `enlarged(src, k)`. — [sprite.ts](/Users/david/projects/tycho/src/pixels/sprite.ts)
- Pixel-exact shapes drawn as runs of `fillRect`: `disc(ctx, cx, cy, r, col)`, `ellipse(ctx, cx, cy, rx, ry, col)`. — [sprite.ts](/Users/david/projects/tycho/src/pixels/sprite.ts)
- Letter-grid upscalers (Lodestar's): `scale2xRows` (EPX), `scale3xRows(rows, fixed)`, `scale15Rows`, `scaleRows(rows, k, fixed)`. — [sprite.ts](/Users/david/projects/tycho/src/pixels/sprite.ts); [docs/sprite.md](/Users/david/projects/tycho/docs/sprite.md)
- `Shapes` (UWD's people and props), with constructors `new Shapes(w, h, seed, look)`, `Shapes.figure(...)` (flat and outlined) and `Shapes.soft(...)` (stroked, no outline). — [shapes.ts](/Users/david/projects/tycho/src/pixels/shapes.ts)
- `Shapes` methods: `ell(cx,cy,rx,ry,ramp,o)`, `box`, `limb(ax,ay,bx,by,w,ramp,o)`, `cap(ax,ay,bx,by,ra,rb,ramp,o)`, `shape(pts,ramp,o)` (cloth shading with `down` and `folds`), `poly(pts,col)`, `px`, `get`, `part(cast)`, `finish()`, `done() → { c, e, w, h, ax, ay }`. — [shapes.ts](/Users/david/projects/tycho/src/pixels/shapes.ts)
- How `Shapes` shades: three tones per material via `band(s, lo, hi)`, light from the upper left, shadow lines between parts, and a `look` of `{ ink: [8,6,12], shadow: 0.45, edge: 0.72 }`. Options per shape: `lo`, `hi`, `bias`, `glow`, `mask`. — [shapes.ts](/Users/david/projects/tycho/src/pixels/shapes.ts)
- Each game's use is recorded as options: UWD uses `canvas` and `flipSprite`; Lodestar uses `outline({ink})`, `tinted`, `flipped` and `enlarged` with `{read:true, min:1}`; Merryfolk uses `outline({own:0.42, grow:'edge'})`, `enlarged(…,2)` and `disc`/`ellipse`. — [docs/sprite.md](/Users/david/projects/tycho/docs/sprite.md)

**Tycho.paint** (`src/pixels/paint.ts`, UWD's chunked lazy painter)
- `new Pix(w, h, ox, oy, { flat })`: color plus glow RGBA buffers. Methods: `put(x,y,col,glow)`, `tint(x,y,col,k)`, `area(x0,y0,x1,y1,ramp,v,o)`, `block(x0,y0,x1,y1,ramp,o)`, `sees`, `canvases()`. — [paint.ts](/Users/david/projects/tycho/src/pixels/paint.ts)
- `AreaOpts { seed, inside(x,y), jit (0.45), glow, fog, fogc }`. — [paint.ts](/Users/david/projects/tycho/src/pixels/paint.ts)
- `BlockOpts { base, lip, grain, inward, drips, dripLen, bands, panels }`. — [paint.ts](/Users/david/projects/tycho/src/pixels/paint.ts)
- Two styles: flat (UWD) or strokes, where `strokeRow(mid, jit, x0, n, y, seed)` cuts each 8 px cell into 1–3 hashed strokes. `blockV(...)` is a block's value function. — [paint.ts](/Users/david/projects/tycho/src/pixels/paint.ts); [docs/paint.md](/Users/david/projects/tycho/docs/paint.md)
- Operations: `Op { x0,y0,x1,y1, seed, fn(P) }`. `paintOps(P, ops)` runs those whose box touches the buffer; `chunk(ops, cx, cy, size, {flat}) → { c, e, x, y }`. — [paint.ts](/Users/david/projects/tycho/src/pixels/paint.ts)
- `new Chunks({ size, make, w, h, max })`: an LRU chunk cache with `get`, `peek`, `has`, `over`, `nearest`, `ahead(x,y,{rx,ry,budget})` and `trim`. `new Painter({ size, flat, max })` with `reset({ w, h, ops })`. — [paint.ts](/Users/david/projects/tycho/src/pixels/paint.ts)
- The painter works in RGB triples: a ramp is a list of `[r,g,b]`. It does not keep palette indexes. — [docs/paint.md](/Users/david/projects/tycho/docs/paint.md)

**Tycho.fx** (`src/pixels/fx.ts`)
- `tick(list, dt)`, `age(list, dt, life)`, `move(q, dt, { bounce, slide })`. — [fx.ts](/Users/david/projects/tycho/src/pixels/fx.ts)
- `new Particles({ max: 260, keep: 200, bounce, slide })` with `add`, `step` and `cap`. — [fx.ts](/Users/david/projects/tycho/src/pixels/fx.ts)
- Emitters: `sparks(x, y, n, draw, o)` and `burst(x, y, c, n, draw, o)`, where `draw(k, s)` is the random source (a deterministic draw is possible, e.g. `(k,s) => hash(frame,k,s)`). `rise(age, i, of, o)` lays out rising text. — [fx.ts](/Users/david/projects/tycho/src/pixels/fx.ts); [docs/fx.md](/Users/david/projects/tycho/docs/fx.md)
- Not present: emitter shapes, weather (rain/snow/fog), trails, palette-based particle colors.

**Tycho.gpu, light, post: the "GPU stand-in"**
- `Gpu.create(canvas, { onError, occlude, atlas, pages, maxPages, keep, ring, attributes })` returns null without WebGL2 (`?nogpu` forces this). — [gpu.ts](/Users/david/projects/tycho/src/pixels/gpu.ts); [docs/renderer.md](/Users/david/projects/tycho/docs/renderer.md)
- Layers: `F = { EM, COL, SOLID, SMOOTH, GROUND, GROUNDEM, DYN, MAP }`. Contexts: `gpu.ctx(F.COL)` (color), `gpu.ctx(F.EM)` (glow), `gpu.ctx(F.COL, true)` (unlit overlay). — [gpu.ts](/Users/david/projects/tycho/src/pixels/gpu.ts)
- The stand-in `Ctx` accepts only: `fillRect`, `clearRect`, `drawImage` (3 forms), `globalAlpha`, `globalCompositeOperation` limited to source-over, lighter, destination-out and multiply (`BLEND` also maps copy and source-in to 0), `imageSmoothingEnabled`, `save`/`restore`, `translate`/`scale`/`rotate`/`setTransform`/`resetTransform`, a rectangle-only `clip` (`beginPath`/`rect`/`clip`; "rects only"), and `fillStyle` as a color, a linear gradient (drawn as strips) or a radial gradient (rasterized once and cached). — [gpu.ts](/Users/david/projects/tycho/src/pixels/gpu.ts); [docs/renderer.md](/Users/david/projects/tycho/docs/renderer.md)
- So there are no arbitrary paths, `arc`, `stroke`, text, `getImageData` or per-frame `putImageData`.
- Extensions beyond a 2D context: `ctx.tint = [r,g,b]`, `ctx.lightMap = true`, and `ctx.drawPixels(imageData, …)` for pixels rewritten each frame. — [docs/renderer.md](/Users/david/projects/tycho/docs/renderer.md)
- Atlas management: canvases go into an atlas on first draw and are held by WeakRef. `gpu.dirty(canvas)` after repainting; `canvas.gpuLive = true` for one repainted every frame; `canvas.gpuOwn = true` for its own texture. — [docs/renderer.md](/Users/david/projects/tycho/docs/renderer.md)
- Ground textures: `groundStart`, `groundShift`, `groundDirty`, `groundSync`. — [gpu.ts](/Users/david/projects/tycho/src/pixels/gpu.ts)
- Custom shaders: `program(vs, fs, uniforms)` and `lightPass(prog, set)`. — [gpu.ts](/Users/david/projects/tycho/src/pixels/gpu.ts)
- `Tycho.light.Smooth(gpu).draw({ cells, w, h, cell, org, add = 0.1 })`: a cell light map, bilinear-scaled and multiplied over the scene, plus `add` of it. This is the only light model in Tycho. Lodestar's stepped, dithered, violet-in-the-dark light runs its own shader through `gpu.lightPass` in the game (`gllight.js`). — [light.ts](/Users/david/projects/tycho/src/pixels/light.ts)
- `Tycho.post.Blur(gpu).finish({ out, wets, fade, time, near = 0.8, far = 0.55 })`: two bloom layers from the glow layer, wet-strip reflections with a ripple, a fade, and whole-pixel upscaling. Lodestar's grid bloom is `gpu.bloom` / `frameEnd`. — [post.ts](/Users/david/projects/tycho/src/pixels/post.ts)
- Frame order: `frameBegin` → draw through the stand-ins → light model or `plain()` → finish (`frameEnd` or `post.Blur`) → overlay. Measured gain: 4.3→1.3 ms in Chrome and 20→2 ms in WebKit, versus 2D canvases uploaded to WebGL. — [docs/renderer.md](/Users/david/projects/tycho/docs/renderer.md)

**Tycho.grid / collide / move / path** (world layer)
- `new Grid({ w, h, chunk, flat, layers: [{ name, data, edge, bits }], make(c) })`. Methods: `get(l,x,y)`, `set`, `fill(l,x0,y0,x1,y1,v)`, `array(l)`, `chunkAt`, `has`, `takeDirty()`, `seal()`, `changes()`, `apply(changes)`. Chunks are made lazily from the seed through `make`. — [grid.ts](/Users/david/projects/tycho/src/world/grid.ts); [docs/world.md](/Users/david/projects/tycho/docs/world.md)
- Collision: `Space` with `.boxes`, `.bounds`, `.tiles(new Tiles(grid, layer, { size, solid, smooth: { noise, amp } }))`, `.ellipses`, `.ways`, `.ladders`. Queries: `hits`, `solidAt`, `circleHits`, `circleDepth`, `way`, `ladderAt`, `ray`. — [docs/world.md](/Users/david/projects/tycho/docs/world.md)
- Movement: `move.Platform` (UWD runner) and `move.topdown` (Lodestar). — [docs/world.md](/Users/david/projects/tycho/docs/world.md)
- Paths: `path.distances(cells, w, h, x, y, solid, avoid?, out?)` (a 4-way BFS flow field); `new AStar(w, h, { cap, diag })` with `.find(sx,sy,tx,ty,{walkable,cost,snap})` and `.near`; `new Routes()` with `link`/`route` (Dijkstra). — [path.ts](/Users/david/projects/tycho/src/world/path.ts)
- The grid has no tile-kind table, autotile or neighbor-mask helper, and no generation helpers: no flood fill, connected regions, cellular automata, BSP, room/corridor carving or WFC. "Not yet: gen, liquid and tilelight." — [docs/move.md](/Users/david/projects/tycho/docs/move.md)

### Inferences
- Tycho's art primitives sit at two levels that do not meet. Low-level canvas helpers (`spriteFrom`, `outline`, scalers) work on RGB canvases. Mid-level painters (`Shapes`, `Pix`) work on RGB ramps. Nothing works on palette indexes, so a palette-locked look like Elsewhere's 8 inks cannot be enforced with Tycho as it is.
- Because of "bit for bit" and "parameters, not defaults", new generators can go in fairly freely as new parts or options, but nothing existing may change output. A generator that ships with golden tests over a seed matches how Tycho already works.
- The renderer constraint (blits, rects, gradients, 4 blends) pushes all procedural pixel work offscreen and done once (paint into a buffer, then blit). Per-frame procedural effects must be precomputed frames, `drawPixels` uploads, or custom shaders via `gpu.program`/`lightPass`.

### Gaps
- I did not read `gpu.ts` in full (56 KB). The details of its occlusion (`feet`, `lift`) and grid bloom come from the docs.
- I did not check whether `dist/` matches `src/` byte for byte. Elsewhere's `vendor/tycho` is at commit 68b29b6, the same as the local Tycho HEAD.

## Each game: genre, perspective, resolution, palette, how art and worlds are made, animation, effects, determinism

### Takeaway
The five games share three habits:
- art is made in code, not image files: letter-row strings plus code recipes, seeded;
- each game keeps its own palette system, from free hex values through ramps to Elsewhere's 8 hard-indexed inks;
- worlds are mostly hand-built.

Each game's perspective and resolution:

| Game | Perspective | Resolution |
|---|---|---|
| Neo | top-down 3/4 | 192 wide |
| Lodestar | top-down steep 3/4 | about 176 world px short side at 1.5 art px per world px |
| Merryfolk | top-down 3/4 with side-cut interiors | 16 px tiles, zoomable |
| White Dragon | side-on with parallax | 200 px short side |
| Elsewhere | isometric 2:1 | 320×180 |

Real procedural world generation exists in three places:
- Neo: random-walk room graphs over hand-made room templates.
- Lodestar: cave blobs, tunnels, one CA pass, Voronoi climes.
- Merryfolk: fBm terraces, Priority-Flood hydrology, habitat placement, warped tile-edge blending.

The other two generate little:
- White Dragon: only the skyline is procedural.
- Elsewhere: sine shores and seeded scatter.

Character generators exist in two games: White Dragon's parametric `person(o)` on `Shapes`, and Merryfolk's gene-driven `folkBody`. Lodestar's Kindler is a rigged pseudo-3D figure rendered to strokes.

### Cited Findings

#### Elsewhere (/Users/david/projects/elsewhere)
- Genre: a phone-first pixel game with "no main quest". An epic opening hands you one mission, then nothing but side quests, "each its own small world with its own look, people and way of playing". It is plain JavaScript on Tycho, a submodule at vendor/tycho, with Tyrell minds for its people. — [CLAUDE.md](/Users/david/projects/elsewhere/CLAUDE.md); [DESIGN.md](/Users/david/projects/elsewhere/DESIGN.md)
- Look:
  - "Isometric, 320 by 180" on a 2:1 grid.
  - "Eight inks to a frame, chosen per quest". A palette change can be an event (dusk at the frog stall, the lamp catching at the lighthouse).
  - "The frogs' rule": a dark outline round everything, flat color inside, a few bold marks, no noise; "speckle, grain and fine dithering all went... Fat rows of dots are the only gradient."
  - Full bleed: "the land runs off every side"; "Paint well past what's on screen".
  - — [DESIGN.md](/Users/david/projects/elsewhere/DESIGN.md) lines 60–69
- The view: `View` (js/view.js) is one 2D canvas whose short side is the quest's `px` (180 by default), scaled up by whole steps. Quests draw on `View.g` and keep to the ops Tycho's GPU stand-in takes; the code does not use `Tycho.gpu` yet. — [js/view.js](/Users/david/projects/elsewhere/js/view.js)
- `Ink` (js/ink.js) is the painter. A `Sheet(w, h, dark = 0)` holds palette indexes in a `Uint8Array` (`CLEAR = 255`), with an `ox, oy` world offset. — [js/ink.js](/Users/david/projects/elsewhere/js/ink.js)
  - Drawing: `px(x,y,c)` (c is an index or `(x,y)=>index|-1`), `rect`, `frame`, `line` (Bresenham), `disc(cx,cy,rx,ry,c)`, `ring`, `poly(p,c)` (scanline), `path(p,c,closed)`.
  - Outlined versions: `orect`, `opoly`, `odisc`.
  - `rows(rows, x, y, map, flip)` stamps letter rows; `tuft(x,y,c)` draws a 5-pixel grass mark.
  - `print(pal) → canvas` turns indexes into hex colors via ImageData, so one sheet can be printed in several palettes.
- More of `Ink`: `Ink.curve(p, closed=true, seg=8)` (Catmull-Rom to a polyline); `Ink.Iso(sheet, at)` with `top(x,y,w,d,z,c)`, `left`, `right`, `box(x,y,z,w,d,h,[t,l,r])` and `line`; `Ink.sprite(rows, map, pal, ax, ay, flip) → { c, e:null, w, h, ax, ay }`. — [js/ink.js](/Users/david/projects/elsewhere/js/ink.js)
- `Ink.traveler(pal, look)`: the player as hand-authored letter rows (HEAD, BODY, STAND, WALK, BACK, GLASS for the Lantern), mapped per quest to that quest's ink indexes (`look`: which ink is hair h/H, skin s, coat c/C, scarf r, legs l, glass g/G, outline k). It returns `stand`/`walk`/`away`/`awayWalk`, each `{ r, l }` (flipped), plus `lantern`. Two-frame walking. — [js/ink.js](/Users/david/projects/elsewhere/js/ink.js)
- `Figure.draw(g, s, x, y, alpha)` blits the sprite at its foot anchor and adds `s.e` with 'lighter'. `Figure.lantern()` prints the Lantern in a fixed 3-color palette. — [js/figure.js](/Users/david/projects/elsewhere/js/figure.js)
- Frogs quest (frogs.js, 682 lines): — [quests/frogs/frogs.js](/Users/david/projects/elsewhere/quests/frogs/frogs.js)
  - Palettes: `DAY` and `DUSK`, 8 hex each, named indexes `D,M,G,L,R,T,B,O`.
  - Projection: `iso = (x,y,z) => [(x-y)*K, (x+y)*K/2 - z]` and its inverse `unIso`, with K = 0.7.
  - The pond's shape comes from sums of sines plus an ellipse: `shore(x,s) = 184 + sin(x/37+s)*6 + sin(x/13+s*2)*3`; `cove`; `isLand`.
  - `paintGround(sd)` rasterizes land/water through `unIso` and does neighbor-based edge inking: outline where land meets water, a 3-row orange band under the bank.
  - Seeded `Tycho.seed.Rng(sd+41)` scatters ripples in staggered rows, tufts and flowers. Lily pads are placed by rejection sampling (min distance 34) and drawn back to front by x+y.
  - Frogs: letter rows (`FROG`, `HOP`) plus code-drawn hats (`hat(S, kind)`: bow, cap, flower, beret, straw, tophat, kerchief), which is a small parts kit for characters.
  - Dishes are letter rows with per-dish maps. Every sheet is printed once per palette (day and dusk).
  - The fly moves on Lissajous-like sine paths.
- Lighthouse quest: — [quests/lighthouse/lighthouse.js](/Users/david/projects/elsewhere/quests/lighthouse/lighthouse.js)
  - Three palettes (`NIGHT`, `KINDLE`, `LIT`). The room and lens are painted once and printed per palette, so a lighting change is a palette swap.
  - `paintPool(r)` is a local 4×4 Bayer-dithered disc edge (in 2-pixel cells), in two sizes swapped to flicker. That is dithering done locally, not through Tycho.
  - The pool canvas is redrawn every frame, marked `gpuLive`.
  - Waves use `Tycho.seed.fxRand`; sea rows sway with `sin`.
- Road quest (the opening): — [quests/road/road.js](/Users/david/projects/elsewhere/quests/road/road.js)
  - Sky bands from `paintDusk`, a Hollow silhouette from `Ink.curve`, ridges from Catmull-Rom curves.
  - Tufts scattered by `Rng(6/8/9)`. Parallax by layers. Fire flames come from `fxRand`.
  - Tendrils of dark creep in from the frame edges, made from `hash` and `sin` sway.
- Pell quest: an isometric brick terrace on `Tycho.move.Platform` and `Tycho.collide.Space`. Houses are painted per id with `Rng(id)` (windows, marks). `SUN` and `DARK` palettes. Sprites for the cat, Mrs Pell and others are letter rows printed with `Ink.sprite`, plus flipped copies. A drifting dust or petal layer uses `hash(i,…)` and `sin`. — [quests/pell/pell.js](/Users/david/projects/elsewhere/quests/pell/pell.js)
- Seeding: the shell gives each quest `seed: Tycho.seed.hashString(S.seed + ':' + id)` and `rng(name) = new Tycho.seed.Rng(hashString(S.seed+':'+id+':'+name))`. Replays from the log must reproduce a quest from its seed. — [js/shell.js](/Users/david/projects/elsewhere/js/shell.js) lines 109–110; [DESIGN.md](/Users/david/projects/elsewhere/DESIGN.md)
- Plans:
  - "The figure recipe in Tycho (the pixels layer's planned `figure`)", meaning one description of the player drawn by each quest's painter.
  - "`gen` in Tycho's world layer, taken from Lodestar's code, for the moor and the dig".
  - The slice deliberately runs on Tycho as it stands.
  - — [PLAN.md](/Users/david/projects/elsewhere/PLAN.md) lines 17, 168–177
- Elsewhere's quests hand-author their worlds as code (curves, boxes, scatter). Nothing is generated at the level of layout; seeds only vary scatter and shore phase.

#### Neo (/Users/david/projects/neo) (search pass)
- Genre: a Matrix-inspired, five-minute, twin-stick roguelite for phone browsers with Diablo-style loot (5 rarities, affixes, "Zero-Day" uniques). The hub is Neo's apartment. There are five sectors (`T.floors` in js/tuning.js): tenement, server, subway, grid, core. — [neo/docs/VISION.md](/Users/david/projects/neo/docs/VISION.md); [neo/js/tuning.js](/Users/david/projects/neo/js/tuning.js)
- No engine: plain JS with no build step and no runtime dependencies; classic scripts share globals; Phaser and Vite were rejected (DECISIONS #1). No Tycho. VISION says it follows Merryfolk's "pixel art drawn procedurally from string templates and palettes... no image files". — [neo/DECISIONS.md](/Users/david/projects/neo/DECISIONS.md); [neo/docs/VISION.md](/Users/david/projects/neo/docs/VISION.md)
- Perspective: top-down/3/4 view with wallTop and wallFace tiles, lid-plus-face obstacles, and depth sorting by foot y. `TILE = 16`, `VIEW_W = 192` (12 tiles); height follows the screen (`max(120, H/scale)`); whole-pixel scaling (`resizeView()`, js/render.js). Rooms are 12×11, 12×13 or 12×15 tiles. — [neo/js/util.js](/Users/david/projects/neo/js/util.js); [neo/js/render.js](/Users/david/projects/neo/js/render.js); [neo/js/rooms.js](/Users/david/projects/neo/js/rooms.js)
- Palette: free hex values, no index limit.
  - Per-sector `SECTOR_PAL` with keys `{bg, floor, floor2, line, wallTop, wallFace, wallEdge, accent, pit}` and one accent per sector.
  - Per-character letter→hex maps (e.g. `spr_NEO_PAL`).
  - Hand-listed 4–6 tone ramps for `disc()`.
  - Variants come from `shade`/`mix`; loot icons are gray and recolored by rarity with a multiply (`shadeOf`).
  - — [neo/js/sprites.js](/Users/david/projects/neo/js/sprites.js)
- Characters are letter-row templates layered by code (sprites.js, 1470 lines, `buildSprites()` into global `SPR`):
  - `spr_grid(w,h)`, `spr_stamp(g, rows, ox, oy)`, `spr_put`, `spr_fromGrid(g, pal, ink, axGrid, ayGrid)` (render, outline, anchor).
  - Neo: `spr_neoFrame(kind, pose, f)` and `spr_neoFrameV(kind, view, pose, f)` stack legs, body, arms and head on a 13×18 grid. Poses: idle×2, walk×4, type×2.
  - Agent: `spr_agentFrame(pose, f, big)`. `spr_dupRow`/`spr_dupCol` duplicate a row or column (said to make the boss bigger; not confirmed).
  - — [neo/js/sprites.js](/Users/david/projects/neo/js/sprites.js)
- Props, tiles and some enemies use a rect painter, `spr_paint(w,h)` → `{ r(col,X,Y,W,H), clear, ln (Bresenham), disc(cx,cy,rx,ry,ramp,bias) (ramp-shaded from the top left), tpl(rows,pal,ox,oy) }`. — [neo/js/sprites.js](/Users/david/projects/neo/js/sprites.js)
  - The Harvester's cracks are random walks from `mulberry32(0x4a7e)`; its edges are ragged by `hashInts`.
  - Sentinel tentacles follow a sine wave.
- Tiles are procedural 16×16 recipes per sector, memoized by `sectorTiles(sector)`: `spr_floorTile(sector,pal,v,rnd)` (4 variants), `spr_wallFace` (2), `spr_wallTop`, `spr_pitTile`, `spr_doorSealed(pal,f)` (2 frames), `spr_doorOpen`. Specks come from `mulberry32(hashInts(si+1, k, 4012))`. — [neo/js/sprites.js](/Users/david/projects/neo/js/sprites.js)
- Minimal autotiling: `roomBackground()` picks wallFace if the tile below is not wall, otherwise wallTop. Floor variants are chosen by `hashInts(room.seed,tx,ty)` (70% variant 0). — [neo/js/render.js](/Users/david/projects/neo/js/render.js)
- Levels (js/dungeon.js): — [neo/js/dungeon.js](/Users/david/projects/neo/js/dungeon.js); [neo/js/rooms.js](/Users/david/projects/neo/js/rooms.js)
  - `generateFloor(seed, n)` lays a main path on a 7×7 grid by a weighted random walk leaning north (n 3, e/w 1.4, s 0.6), retrying up to 200 times. One-room side branches are attached (cache, oracle, rabbit behind a hidden door, backdoor on its own stream `0xbacd`).
  - `buildRoomTiles(room, rng)` picks a hand-authored `ROOM_TEMPLATES` entry (10 wide; `.` floor, `o` block, `p` pit, `x` wall) and mirrors it at random in x and y.
  - Helpers: `fillRoomTiles`, `carveDoor`, `roomConnected` (flood fill), `furnish(r,rng,floor)`, and `floorHash` for golden tests. test/gen.js pins hashes over 2,500 floors.
  - No noise, CA, BSP or WFC.
- Animation: discrete frames on timers (`walk[floor(walkT*8)%4]`, `idle[floor(anim*1.6)%2]`). Bob is baked into frames (1 px). There is no tweening or squash.
  - Afterimages are tinted alpha copies; hit flashes are tints; invulnerability blinks at 16 Hz.
  - Elite enemies get a gold rim from 4 offset tinted blits.
  - — [neo/js/render.js](/Users/david/projects/neo/js/render.js)
- Effects (js/fx.js): — [neo/js/fx.js](/Users/david/projects/neo/js/fx.js); [neo/js/render.js](/Users/david/projects/neo/js/render.js); [neo/css/style.css](/Users/david/projects/neo/css/style.css)
  - Particles: `spawnBits` (0/1 glyphs with gravity), `spawnRing`, `spawnHex`, `spawnDissolve(e,big)` (falling code columns), `addFloat`, `addDamageNumber`. Capped at 260 and drawn from `Math.random`.
  - Screen shake decays at 14/s.
  - A glitch tear draws the frame as 6 horizontal slices offset sideways.
  - `flashScreen` is rate-limited to 3 per second.
  - Bullet time is a 'color'-composite green fill.
  - The spawn telegraph is pixel noise with a scan line.
  - Lighting is faked with `sin`-flicker alpha.
  - The scanlines are CSS only, and the title has a DOM code-rain canvas.
  - No dithering and no palette cycling.
- Determinism: util.js has its own `mulberry32`, `hashInts`, `hashString` and `class Rng` (the same API as Tycho's, which came from Lodestar). A floor uses `Rng(hashInts(seed, n, 0x5eed))`, with `rng.fork()` per room. Tile art is seeded by sector only. There is a Daily seed. — [neo/js/util.js](/Users/david/projects/neo/js/util.js); [neo/js/dungeon.js](/Users/david/projects/neo/js/dungeon.js)
- Generic helpers Neo re-implements, all of which already exist in Tycho: `shade`, `mix`, `hexToRgb`, `rgbToHex`, `makeCanvas`, `spriteFrom`, `outlined(src, ink)`, `tinted`, `flipped`, `clamp`, `lerp`, `approach`. — [neo/js/util.js](/Users/david/projects/neo/js/util.js)
- Not in Tycho:
  - `spr_outline` (an outline from 4 shifted silhouettes, no readback).
  - `spr_anchor`.
  - The cached `tintOf`/`flipOf`/`shadeOf`.
  - `blit(ctx,img,x,y,{flip,alpha,tint})`.
  - A bitmap 3×5 font (`FONT3` as 15-bit strings, `glyph3`, `drawText3`).
  - — [neo/js/sprites.js](/Users/david/projects/neo/js/sprites.js); [neo/js/render.js](/Users/david/projects/neo/js/render.js); neo/js/font.js

#### Lodestar (/Users/david/projects/lodestar) (search pass)

**Source caveat**
- `vendor/tycho` is a submodule pinned at c25e2962 and is not checked out locally (the directory is empty). Lodestar's use of Tycho is therefore known from its call sites, not from the pinned source. — [lodestar/.gitmodules](/Users/david/projects/lodestar/.gitmodules) (search pass)

**Genre, setting, perspective, resolution**
- Genre: a top-down pixel action game for phone browsers with a light-as-health survival loop ("The Veins"). — [lodestar/README.md](/Users/david/projects/lodestar/README.md); [lodestar/DESIGN.md](/Users/david/projects/lodestar/DESIGN.md)
  - Story: the Charter's ship *Meridian* brought a seed-star (the Lodestar) to a dead world.
  - The player is the Kindler, "the Shards": lodestone pieces held apart by light, with a crystal head that works as a flashlight. Wick is a companion drone.
  - Loop: lay veins of light and plant nodes. Creatures drop motes of 5 natures (rime, cinder, spore, spark, grit), which buy spells: Forms (arc, glaive, bolt, lance, orb, nova, well, ward) combined with Elements and Mods.
- World and creatures: — [lodestar/DESIGN.md](/Users/david/projects/lodestar/DESIGN.md); [js/climes.js](/Users/david/projects/lodestar/js/climes.js)
  - A 320×320-tile surface split into climes (badlands, frost, cinder, bloomfen), over a second 320×320 layer, the Deep (caverns, grotto, magma, rootdeep).
  - Base creatures: crawler, wisp, construct/stalker, snapjaw, spitter, warden, the Hollow, three Shard Keepers.
  - One per clime: skink, tusker, wraith, lurker, dropper, eel, crab, weaver, sentinel, idol, hound.
- Perspective: top-down with a steep three-quarter camera. Rock is a heightfield whose tops hide what stands north of it, and actors are sorted by their feet (`paintOcclude`, `paintOccludeActor`). — [js/render.js](/Users/david/projects/lodestar/js/render.js)
- Resolution: — [js/art.js](/Users/david/projects/lodestar/js/art.js); [js/gpu.js](/Users/david/projects/lodestar/js/gpu.js)
  - `TILE = 16` world px; `AP_ART = 1.5` art px per world px, so `ATILE = 24`. FINE GRAIN doubles this (`T.art.px = 3`, `AF = 2`).
  - The short side shows about `VIEW_MIN = 176` world px.
  - Drawn with WebGL2 through `Tycho.gpu`, with a 2D fallback.

**Palette and pixel-art rules**
- No index limit. Hex ramps per material, usually 4 steps, live in `ART` (js/art.js: `pal`, `biomes`, `surface`, `ores`, `stones`, `forms`, `glyphs`, `rarity`) and per clime in `CLIME_ART`. — [js/art.js](/Users/david/projects/lodestar/js/art.js)
- The "A+" rules (DECISIONS.md, 2026-10-18): at most 4 tones per material (`T.art.tones = 4`); hue-shifted ramps (shadows toward violet, lights toward gold); texture in clusters, never speckle; no dither on sprites; black outlines on creatures and sel-outs on props. — [lodestar/DECISIONS.md](/Users/david/projects/lodestar/DECISIONS.md)
- Local ramp helpers: — [js/art.js](/Users/david/projects/lodestar/js/art.js); [js/paint.js](/Users/david/projects/lodestar/js/paint.js)
  - art.js: `hueRamp(ramp, amt)` (shifts hue through HSL with `artHsl`/`artRgbOfHsl`; ore ramps are exempt via `ART_TRUE_HUES`), `toneMap(n, tones)`, `fourStep(r)`, `desaturate(hex, t)`.
  - paint.js: `pntRamp(anchors, light=PNT_WARM, P)` (3 anchors to 7 tones, toward violet-black `PNT_DEEP` and warm gold), `pntRampEven(anchors, n, P, light)`, `pntLiftRamp(ramp, lift, L)`, `pntLook(b, lift)`.
  - Others: `pflRamp`, `cfxRamp`, `phlRamp`.

**How art is made**
- Style 1, letter-grid sprites with procedural form shading: — [js/art.js](/Users/david/projects/lodestar/js/art.js)
  - Grids: `ENEMY_ROWS`, `ICON_ROWS`, `LODESTAR_ROWS`, `STUFF_ROWS` (art.js); `KEEPER_ROWS`, `PART_ROWS`, `UPLINK_ROWS` (art2.js); `RIFT_ROWS`, `TOOL_ROWS` (art3.js); clime creatures (foesart.js); flora (flora.js).
  - `buildArtSprite(rows, pal, letters=SPRITE_CHARS, glows=SPRITE_GLOWS, opts={kind, outline, hueShift, tones, dither, scale, openFoot, fine}) → {c, ec, w, h, k}`.
  - How it shades: chamfer distance passes give each pixel's depth inside the silhouette and inside its own material patch. That becomes a height, then a normal, then Lambert light from the top left, then a hard cut to a ramp step. Orphan pixels are removed, then `outlineBuf(P, solid, 'black'|'selout'|'none')` runs.
  - Grids are upscaled before shading with Tycho's `scale15Rows`, `scale3xRows`, `scale2xRows` and `scaleRows`. Grids redrawn by hand are marked `artNative(rows)`.
- Style 2, painted code-built sprites (the current main style):
  - `class PntSpr(w, h, seed)` (paint.js:1273) has `ell`, `box`, `limb(pts,w0,w1,col)`, `poly`, `flip()` and `done()`. Shapes are lit from the upper left and laid in short jittered strokes, with no outline. It looks related to Tycho's `Shapes.soft` but is a separate class.
  - Used by: `FpSpr`/`fpEnemySprites`/`FP_FOE`/`fpPaintGrid` (foespaint.js); the outpost's `hart*` helpers (hubart.js); intro.js; `pflSprite`/`pflGrass`/`pflTuft`/`pflCrystal` (pflora.js).
  - — [js/paint.js](/Users/david/projects/lodestar/js/paint.js)
- The Kindler is drawn from a 3D-ish skeleton (diver.js): `kdPose(key)`, `kdRig(o)`, `kdIK(a,b,L1,L2,hint)` (two-bone IK), `kdRender(face, key)`. Tapered tubes are sampled, projected (`KD_K = 0.7`), z-buffered, shaded and laid as strokes stuck to the body. There are 5 facings plus mirrors (`kdFlip`), and other looks in `KD_LOOKS`. — [js/diver.js](/Users/david/projects/lodestar/js/diver.js)
- Terrain is painted procedurally (no tilesets, no autotiling): — [js/paint.js](/Users/david/projects/lodestar/js/paint.js); [js/floor.js](/Users/david/projects/lodestar/js/floor.js)
  - Painters: `paintCaveTile(P, rock, ox, oy, b, rnd, seedH, field)`, `pntGroundTones`, `pntHeights` (the rock heightfield), `pntPaintRock`, `pntSlabs`, `pntBlocks`, `pntBoulder`, `pntStrokeRow`, `pnr*` (paintrock.js), `phl*` (pools and the wading cut, painthole.js), `paintEdgeVoid`.
  - The floor is painted lazily in 32-tile chunks inside a moving window: `PWIN`, `pntWindowMove`, `pntFrame` (64 tiles square, 48 at FINE GRAIN).
  - Its own noise: `artHash(x,y,seed)`, `artNoise(x,y,s,seed)`, `artNoiseAt`, `artNoiseRow`, `artLattice`, `artClump` (two-octave clusters with a hard cut), `pntNoise`, `pntNoiseRow`, `wallNoise(x,y,scale)` (on `hashInts`).

**World generation (code recipes)**
- `generateFloor(seed, depth, biome, padChance, zone, ways, clime, over)` (floor.js): — [js/floor.js](/Users/david/projects/lodestar/js/floor.js)
  - cavern blobs: ellipses whose radius ripples by sin(3a) and sin(5a);
  - "river" tunnels between nearest rooms with drift, plus loops;
  - pillars;
  - one CA-like smoothing pass (rock with 6 or more open neighbors becomes floor);
  - a flood-fill prune with `Tycho.path.distances`;
  - ore veins as random walks.
- Other generators: — [js/game.js](/Users/david/projects/lodestar/js/game.js); [js/regions.js](/Users/david/projects/lodestar/js/regions.js)
  - `generateRuin`: rectangular rooms joined by L-shaped corridors.
  - `placeHazards`/`layHazard`.
  - `generateWorld(seed)` (game.js:55) puts the star in the room nearest the center, then `layRegions(f, seed, climes, home, hx, hy)` (regions.js) builds a Voronoi field on a jittered grid with noise-warped borders, a shuffled clime deck, and blending across borders (`climeIdx2`, `climeMix`).
  - `generateDeep` and `placeShafts` (deep.js).
  - `placeUndergrowth` (undergrowth.js): a habitat score per tile plus seeded noise drifts.
  - Play repaints the ground: `terraPaintGround` (terraform.js) and `veinsPaintSeg` (veins.js).
- This is the code Elsewhere's PLAN means by "`gen` in Tycho's world layer, taken from Lodestar's code". — [elsewhere/PLAN.md](/Users/david/projects/elsewhere/PLAN.md)

**Animation**
- Letter-grid creatures have hand-drawn frame lists (idle, move, tell, attack, mechanic states). Painted foes get poses from `fpPose`.
- The Kindler is procedural: `kdWalk`/`kdRun` (8 frames driven by distance walked), `kdIdle`, `kdDash`, `kdCast`, `kdSettle`, `kdGlance`, chosen by `kindlerPick`. Every frame is pre-built by `kindlerEveryFrame`/`kdWarm`.
- Flora sways (`floraWind`, `drawLeaning`). Enemies jitter ±1 px while winding up. Nodes grow (`nodeSprite(lit, grow)`).
- — [js/diver.js](/Users/david/projects/lodestar/js/diver.js); [js/render.js](/Users/david/projects/lodestar/js/render.js)

**Effects**
- Light: `lightScene(cx, cy)` (render.js) and its GPU twin `glLightScene` (gllight.js), held to match each other. — [js/render.js](/Users/david/projects/lodestar/js/render.js); [js/gllight.js](/Users/david/projects/lodestar/js/gllight.js)
  - A cell grid (`LC = 2*AP` art px) with ambient light plus `addLight` and `addBeamLight`.
  - Quantized into `T.art.lightSteps = 16` bands, the lamp varying per pixel, darks tinted violet.
  - Modes: NOCTURNE, soft-beam, canvas-weave. `lampBeamOf` gives the lamp beam.
- Shadows: shadow.js casts lamp rays against the wall line. pshadow.js lays silhouette ground shadows (`pshShadeFor`, `pshFrame`, `pshContact`).
- Glow and bloom: every sprite has an `ec` emissive canvas. `bloomScene`/`bloomSceneWorld` use `T.light.bloom = [[3,.7],[7,.6]]` (Tycho's grid bloom).
- Dithering: `BAYER4`/`bayerAt`, only on ground gradients and light steps.
- Air: air.js adds motes, haze and `airVignette`.
- Spell effects (castfx.js, hardlight.js):
  - shapes: `hlLine`, `hlDiamond`, `hlHex`, `hlBrackets`, `hlEdgeRing`
  - kept pictures: `hlSigilPic`, `hlWavePic`, `hlLatticePic`, `hlSeedPic`, `hlScanPic` (scanline dissolve)
  - painted arcs and rings: `cfxPaintArc`, `cfxStrokeRing`
  - particles: `cfxPart`, `cfxSpark`, `cfxBurst`, `cfxShed`, moved by `Tycho.fx.move`/`tick`
  - also decals, afterimages and lightning paths (`cfxBoltPath`)
- Elsewhere: `spawnSparks` (render.js); ambient critters, cloud shadows, dust and drips (life.js). Screen shake is wired (`Tycho.harm.Shake`) but every amount is 0, per A+ "no screen shake". `Tycho.harm.Hitstop`. Hit flashes are `tinted` plus `spriteRim`. No palette cycling.

**Determinism**
- Seeding: — [js/save.js](/Users/david/projects/lodestar/js/save.js); [js/floor.js](/Users/david/projects/lodestar/js/floor.js)
  - The world seed is made once with `Math.random` in save.js and kept in the save.
  - Floors: `Rng(hashInts(seed, depth, biome, ZONE_SALT[zone]))`, with salts 0x5742 for the surface and 0xdeeb for the Deep.
  - Regions: `hashInts(seed, 0x4e61, layer)`. Hazards add `hashString(clime)`.
  - Painting is seeded by place (`artHash(x,y,floorSeed)`); `PntSpr.rnd()` hashes a counter.
  - Effects use `fxRand` or `Math.random`.
- test/gen.js holds golden hashes of generation.

**Tycho use**
- Used: `seed` (Rng, hashInts, hashString, mulberry32, fxRand); `color`; `sprite` (canvas, spriteFrom, outline, tinted, flipped, flipSprite, enlarged, all scalers); `grid.Grid`; `collide.Tiles` (with the game's `wallNoise`) and `Space`; `move.topdown`; `path.distances`; `fx.move`/`tick`; `gpu` (`Gpu`, `F`, `TRI_VS`); `harm`.
- Not used: `Tycho.paint`, `light`, `post`, `seed.noise`/`makeNoise`.
- Its own generic helpers:
  - ramps: `hueRamp`, `toneMap`, `fourStep`, `desaturate`, HSL conversions; `pntRamp*`
  - buffers and outlines: `outlineBuf` with selout, `pixBuf`/`putPx` (color plus emissive), `spriteFromBuf`
  - shading and painting: the `buildArtSprite` form shader, `PntSpr`, `pntStrokeRow`
  - noise: `artNoise`/`artClump`/`wallNoise`
  - dither: `bayerAt`
  - raster shapes: `cfxEllipse`, `hl*`, `pixelLine`, `ringDots`
  - the whole light, shadow and bloom pipeline
  - generators: caves, ruins, the Voronoi regions
  - — (search pass)
- Not read: lodestar/docs/PAINTED.md (42 KB) and docs/RENDERING.md (17 KB), which describe the painted style and the GPU frame in depth. — (search pass)

#### Merryfolk (/Users/david/projects/merryfolk) (search pass)

**Genre, perspective, resolution**
- Genre and setting: a cozy *Creatures*-style artificial-life game set in Thistledown, a Shire-like village (hobbit-holes, pipe-weed, parties, inns, mills, farms). — [merryfolk/README.md](/Users/david/projects/merryfolk/README.md)
  - Villagers have genomes. `expressed(g)` in genetics.js maps genes to skin, hair, vest, shirt, legs, eyes, freckles, chrome and neon.
  - Other characters: a playable wizard, pets, farm animals, rabbits, crows, ducks and hens.
  - A sci-fi sub-theme of "rift-folk" from the city of Neverdark: neon trim, visors, relays, solar arrays (`NEON_COLS`, `RIFT_HAIR`, `makeRelay`, `makeNeonBar`, `makeSolarArray` in sprites.js).
  - — [js/sprites.js](/Users/david/projects/merryfolk/js/sprites.js)
- Perspective: a top-down 3/4 map (front, back and side sprites, y-sorted in `render()`, main.js) with side-view cutaway interiors (interior.js, interior_buildings.js). — [js/main.js](/Users/david/projects/merryfolk/js/main.js); [js/interior.js](/Users/david/projects/merryfolk/js/interior.js)
- Resolution: no fixed internal size. — [js/util.js](/Users/david/projects/merryfolk/js/util.js)
  - `TILE` = 16. The map is 128×96 tiles, or 192×144 for the "valley" layout.
  - `RS`/`GS` = 2, so a world pixel is a 2×2 block; `FOLK_RES` = 4 for villagers.
  - Zoom levels `ZOOMS = [1,2,4,6,8]`.

**Palette**
- No global palette. — [js/sprites.js](/Users/david/projects/merryfolk/js/sprites.js); [js/world.js](/Users/david/projects/merryfolk/js/world.js)
  - Hand-picked hex arrays: `SKIN_TONES`, `HAIR_COLS`, `VEST_COLS`, `TREE_PAL[season][kind]` (5-step ramps), `GROUND_PAL[season]`, `MOUND_PAL`, `CLIFF_PAL`.
  - Shades are derived with Tycho's `shade`/`mix`. `villagerPalette(genes, stage, look)` builds about 35 palette letters from a few gene colors.
- Dithering:
  - The ground is quantized after painting to steps of `DITHER_STEP = 14` per channel, with 4×4 Bayer dithering (`BAYER4`, world.js).
  - Tree crowns are Bayer-dithered across their 5-tone ramp (`paintCrown`).
  - — [js/world.js](/Users/david/projects/merryfolk/js/world.js)

**How art is made**
- Hand-authored letter-row sprites through `spriteFrom`/`finishSprite` (the latter adds an outline):
  - `makeRabbit/Sheep/Cow/Pig/Hen/Crow(frame)`
  - `ICON_ROWS` (9×9) and `buildIcons()`
  - pets and small items
  - — [js/sprites.js](/Users/david/projects/merryfolk/js/sprites.js)
- Code-recipe buildings and props:
  - `makeCottage({w, wall, roof, sign, lit, windows, door, chimneys})`, `makeInn(lit)`, `makeMill`, `makeWindmill`, `makeWell`
  - `makeLampPost(lit)`, `makeFence`, `makeBench`, `makeItem(kind)`, `makeCrop(type, stage)`
  - interior `drawItem(L, it, part, t)`
  - — [js/sprites.js](/Users/david/projects/merryfolk/js/sprites.js)
- Procedural villagers (a gene-driven character generator):
  - `folkBody(genes, stage, look)` feeds `folkFront`, `folkBack` and `folkSide(B, pose)`, which paint into a 20-wide letter grid (`folkGrid(H)`) with ellipse heads and hair styles 0–3.
  - `fineGrid(grid)` is a local EPX-like rounding. It overlaps Tycho's `scale2xRows`; whether the two are bit-identical is uncertain.
  - `refineFolk` adds pupils, brows, strands and toes.
  - `gridCanvas(grid, pal, pad, res)` draws a multi-ring own-color outline.
  - `buildVillagerSprites(genes, stage, look, shut)` builds 3 views × `FOLK_POSES` ['stand','walk1','walk2','sit','sitg','work','reach'].
  - — [js/sprites.js](/Users/david/projects/merryfolk/js/sprites.js)
- Procedural vegetation, seeded and memoized: — [js/sprites.js](/Users/david/projects/merryfolk/js/sprites.js); [js/nature.js](/Users/david/projects/merryfolk/js/nature.js)
  - `treeShape(seed, kind)` and `makeTree(seed, kind, season)`. Conifers are drawn in tiers.
  - Broadleaf crowns are blobs drawn by `paintCrown(ctx,W,H,blobs,pal,cx,cy,Rx,Ry,seed)`: per-pixel light from the upper left, bilinear value noise on `hash2`, Bayer dither.
  - `makeBareTree` uses recursive branches. `makeGreatTree(seed, season)` is limbs plus foliage masses with rim darkening.
  - `makeBush(seed, season)` (7 kinds), `makeHedge`, `makeRock(seed, size)`, `makeFlowerPatch(seed, kind)`.
  - Grass: `tuftSprite`/`tallSprite`/`wildSprite(v, season, lean)`.
- Seasons: statics carry a `gen` recipe and are regenerated per season by `seasonalImage(gen, season)`. `addSnow(c, y0, y1, depth, seed)` dusts upward-facing edges. — [js/world.js](/Users/david/projects/merryfolk/js/world.js)

**World generation (the most procedural world code in any of the games)**
- Layouts and pipeline: — [js/layout.js](/Users/david/projects/merryfolk/js/layout.js); [js/world.js](/Users/david/projects/merryfolk/js/world.js)
  - Tile kinds are in `T` (world.js). `CLASSIC_LAYOUT` is hand-authored.
  - `planValley(seed, W, H)` is a seeded placement planner: a sine river (`makeRiverY`), claimed rectangles, and knolls on south slopes.
  - `buildWorldSteps(cfg)` is a generator that yields stage lines: river and ponds, home mounds, `routeRoads(seed)`, plaza and fields, `computeLand`, statics.
  - Options come from `GEN_OPTIONS`/`defaultGen(seed)` (hills, river, woods, wet, hedges, flowers, rocks, cliffs, relief).
- Terrain: — [js/terrain.js](/Users/david/projects/merryfolk/js/terrain.js)
  - `landHeight(nh, x, y)`: `makeNoise` fBm with power-shaped relief, ridges `1-|n-0.5|`, and knolls, quantized into `TERRACES = 4` levels (`computeHeights`) that are painted as banks.
  - `computeLand(seed)`: height, slope and aspect; a BFS distance to water; Priority-Flood depression filling (binary heap); D8 flow accumulation; a TWI wetness index; a soil class.
- Cliffs and placement: — [js/cliffs.js](/Users/david/projects/merryfolk/js/cliffs.js); [js/nature.js](/Users/david/projects/merryfolk/js/nature.js)
  - `computeCliffs(seed)` uses a noise mask faded by BFS distance from built land, with `rockColor`, `cliffPixel` and `cutCliffSteps`.
  - Habitat placement: `habitat(x, y, treeNear)`, `plantNature`, `plantWoods` (BFS distance plus noise potential), `plantWildflowers`, `plantHedges`, `keepReachable`.
- Tile transitions without autotiling: `computePixelTypes(seed, rect)` domain-warps the tile lookup with two noise fields and takes a Gaussian-weighted 3×3 vote of tile kinds, which rounds the grass, lawn, path and water edges. — [js/world.js](/Users/david/projects/merryfolk/js/world.js)
- Ground painting: `paintGroundGen(season, target, rect, org)` colors each pixel by rule: grass mottle, hill-shading from the north-west, bank strata, stones and roots, ragged path rims, water depth rings. A final pixelate-and-dither pass follows. — [js/world.js](/Users/david/projects/merryfolk/js/world.js)
- Chunking: `Ground` paints chunks lazily (`CHUNK_T = 16` tiles per search pass; the game's CLAUDE.md says 32, which is uncertain) via `stepPaint(budgetMs)`. It is its own system, not `Tycho.paint`. — [js/world.js](/Users/david/projects/merryfolk/js/world.js)
- No CA, BSP or WFC was found.

**Animation**
- Villager pose switches on walk phase; a separate eyes-shut sprite set handles blinks and dozing. Critters have 2 frames. Facing left is a mirror (`blit(ctx,img,x,y,flip)`).
- Wind sway: `windAt(x, y)` (sine swell plus gust) and `blitSway(ctx, img, x, y, amp)`, which shears an image row by row.
- Live machinery is drawn each frame: mill wheel, windmill sails, party lanterns, bonfire, doors.
- — [js/nature.js](/Users/david/projects/merryfolk/js/nature.js); [js/main.js](/Users/david/projects/merryfolk/js/main.js)

**Effects**
- Particles: `FX` (fx.js), a hand-rolled list capped at 2000. Smoke, rings, zzz, hearts, puffs, notes, splashes, snowballs, sparkles, and fireworks (`launch`, `burst` with 4 styles, emissive sparks drawn after lighting). Tycho's move record says it stays local because its drag is `drag^(60·dt)` and particles burst into others. — [js/fx.js](/Users/david/projects/merryfolk/js/fx.js); [tycho/docs/move.md](/Users/david/projects/tycho/docs/move.md)
- Weather and ambient: butterflies, fireflies, clouds with stepped shadows, falling petals and leaves (`drawFalling`), fog, rain, lightning, snow. Seasonal hazards are in hazards.js.
- Day and night: `skyState(h)` gives `{dark, dusk}` from `DAYLIGHT[season]`.
- Light: `Light.render(ctx, cam, darkness, tint, lights)` draws a darkness overlay with `destination-out` pools. Pools are stepped (4 flattened elliptical rings), cached by `Light.stamp(r, rings, div, col, op)`, plus an additive glow. Interiors use their own `drawLight`.
- Post: sepia portraits (`drawPortrait`) only. No palette cycling.

**Determinism**
- World generation uses `mulberry32`, `hash2` and `makeNoise(seed+k)` with fixed offsets (+1/+2/+3 for warps and mottle, +9 height, +31 nature, +61 cliffs). Interiors use `mulberry32(h.id*4241+7)`. Effects use `fxRand`.
- Some `Math.random` remains in runtime critters, and `furnishHome(h, rng = Math.random)` defaults to it (generation passes a seeded stream).
- Golden tests: test/golden.js, sprites.js, pictures.js.
- — [js/world.js](/Users/david/projects/merryfolk/js/world.js)

**Tycho use**
- Used: `seed` {mulberry32, hash2, makeNoise, fxRand}; `color` {hexToRgb, rgbToHex, shade, mix}; `sprite` {canvas, spriteFrom, outline(own 0.42, grow 'edge'), enlarged, flipped, disc, ellipse}; `fx.age`; `gpu`; `path.AStar`.
- Not used: `paint`, `light`, `post`, `grid`, `collide`, `move`, `Shapes`, the scalers, `fx.Particles`, `Rng`, `noise`, `hash`.
- Its local generic helpers:
  - sprites and outlines: `fineGrid`, `gridCanvas` (multi-ring outline)
  - dither and shading: `BAYER4` ordered dither and quantization, `paintCrown` lit blob shader
  - snow and portraits: `addSnow`, sepia `drawPortrait`
  - light and effects: stepped light pools `Light.stamp`, the `FX` system, `blitSway`/`windAt`
  - color: `lerpC`/`lerpRGB`
  - terrain: Priority-Flood plus D8, repeated BFS distance fields (terrain.js, cliffs.js, nature.js), warped Gaussian tile-edge blending, terraced-height bank painting
  - seasons: `seasonalImage` and its caches
  - — (search pass)

#### Under the White Dragon (/Users/david/projects/under-the-white-dragon) (search pass)
- Genre: a side-scrolling 2D cyberpunk platformer and repair sim for a phone held sideways. You fix devices at a hidden bench under the White Dragon noodle bar. There is no combat; "heat" (police attention) is the danger. — [UWD README.md](/Users/david/projects/under-the-white-dragon/README.md); [DESIGN.md](/Users/david/projects/under-the-white-dragon/DESIGN.md)
- Setting: a vertical city in depth bands, from the Spires (+300 m) through up-high blocks, the street, the undercity, Old Town (−140 m) and the Works down to the Bowels (−400 m). It is East Asian cyberpunk:
  - Buildings: shophouses, capsule towers, machiya, temples, pagodas, torii, glass towers, shanty stacks, danchi slabs.
  - Street life: 15 stall kinds; vending machines, ATMs and pachinko; about 320 residents; rats, cats, dogs and owls.
  - Salvage: wire, alloy, glass, coolant, chips.
  - — [UWD DESIGN.md](/Users/david/projects/under-the-white-dragon/DESIGN.md); [js/kit.js](/Users/david/projects/under-the-white-dragon/js/kit.js)
- Perspective and resolution:
  - Side-on with parallax. There are back and front views for ladders and doors (`personBack` and `personFront` in js/people.js). The pause map is a cross-section (js/worldmap.js).
  - The view's short side is `T.view.min: 200` px, scaled by whole pixels (`View.out` ≤ 3).
  - Scale: an adult is 33 px tall, a door 40 px, a story about 50 px (`KS` in js/kit.js). Chunks are 256 px. The bench close-up is its own 172×98 canvas (js/bench.js).
  - — [js/tuning.js](/Users/david/projects/under-the-white-dragon/js/tuning.js)
- Palette: no index limit. Colors come from generated ramps:
  - js/paint.js: `R = (anchors, n=9, deep=.55, high=.3) => rampOf(...)` and `MAT` (about 19 material ramps: concrete, steel, rust, glass, brick, tile, asphalt, copper, chrome, wood, clinic, a 14-tone sky...). `KMAT` in kit.js adds more.
  - js/people.js: `rp = (h, n=6) => rampOf([mix(c,dark,.55), c, mix(c,warm,.3)], n, .5, .25)`, a ramp from one color. `SKINS` has 6 hex values.
  - Flat style is three hard tones per material (`PAINT_FLAT = true`).
  - — [js/paint.js](/Users/david/projects/under-the-white-dragon/js/paint.js); [js/people.js](/Users/david/projects/under-the-white-dragon/js/people.js)
- Characters are code recipes on `Spr = Tycho.sprite.Shapes` (js/spr.js). — [js/people.js](/Users/david/projects/under-the-white-dragon/js/people.js); [js/player.js](/Users/david/projects/under-the-white-dragon/js/player.js)
  - `person(o)` (js/people.js:7) builds a 44×52 figure from options:
    - hair: short, undercut, mohawk, bob, long, bun, hood, beanie, cap, helmet, bald
    - clothes and gear: long coat or jacket, vest, armor, apron, pack, satchel, toolbelt, goggles, lamp, loupe, shades, hats
    - held: cutter, blade, bowl, phone, umbrella
    - `tall` and `wide` scales
  - This is in effect a parametric character generator: the residents' looks come from census hashes. That last point is an inference from js/folk.js and js/census.js generating residents by hash.
  - `personBack(o)` and `personFront(o)` give the other views. The player is `RunnerArt.get(pose, left)`, cached per pose, using `flipSprite`.
- Props are one function each (js/props.js): `vending`, `cashRegister`, `jukebox`, `arcadeCab`, `pachinko`, `atm`, `stall`, `car`, `rack`, `capsule`, `docChair`, `holo(w,h,colr,kind,seed)`, `salvageIcon`/`itemIcon(k)`. Also `stallArt(kind, o)` (kit.js:625) and `partArt(g, p, X, Y, w, h, lens, t)` (bench.js:334), which draws device parts straight to a canvas. — [js/props.js](/Users/david/projects/under-the-white-dragon/js/props.js); [js/bench.js](/Users/david/projects/under-the-white-dragon/js/bench.js)
- Hand-authored pixel strings are rare:
  - js/dragon.js has `KANJI` and `PIX3` (3×5 letters) as '1'/'.' strings, drawn by its own `pixText`/`pixKanji`, which duplicates Tycho's `spriteFrom`.
  - `dragonHead(N, o)` and `dragonVert(W)` are vector shapes on a 100×100 design grid, rasterized with a neon-tube edge.
  - tools/mkfont.py builds a 5×7 pixel font with fontTools.
  - — [js/dragon.js](/Users/david/projects/under-the-white-dragon/js/dragon.js)
- Worlds have no tilemaps and no autotiling. A level is a list of paint ops in world px, painted lazily per chunk by `Tycho.paint.Painter`. — [js/world.js](/Users/david/projects/under-the-white-dragon/js/world.js); [js/kit.js](/Users/david/projects/under-the-white-dragon/js/kit.js); [js/paint.js](/Users/david/projects/under-the-white-dragon/js/paint.js)
  - `newLevel(id, name, w, h)` (js/world.js:16) returns `L` with:
    - painting: `L.paint(x0,y0,x1,y1,fn)` (seed = index*31+7), `block`
    - geometry: `solid`, `wall`, `floor`, `walk`, `stairs`, `ladder`
    - lights and life: `light(x,y,r,col,k,flat,flick)`, `sign`, `tube`, `fire`, `lamp`, `ad`, `critter`, `litter`
    - contents: `prop`, `npc`, `home`, `amenity`
  - Districts are hand-placed: `district(o)` (kit.js:743) sets up the ground, parallax city, transit, spots, ambient and rain, then calls `o.build(L, G)`.
  - Building kit: `bShophouse`, `bCapsules`, `bMachiya`, `bTemple`, `bPagoda`, `bGlass`, `bStack`, `bDanchi`, `bTheater`, `bBath`, `bPark`, `bArcade`.
  - Part painters: `kRoof`, `kLattice`, `kNoren`, `kLantern`, `kAwning`, `kBalcony`, `kWin`, `kShop`, `kTorii`, `kTree(P, x, G, kind, o)` (hash-scalloped leaf clumps with their own outline).
  - Material painters (paint.js): `windows` (lit cells by hash), `sign` (`GLYPHS`: 40 invented 3×5 glyphs from hash), `pipe`, `cable` (sag), `girder`, `haze`, `glassWall`, `heap`, `corrugated`, `railing`, `laundry`, `slab`, `stairsPaint`, `water` (value noise).
- The only procedural world generation is the background:
  - js/skyline.js: `tower(P, b)` and `skylineLayer(P, o)` use `Rng` for widths and heights, setbacks, cantilevers, crowns (flat, slope, spire, masts, tank, billboard) and window styles. Also `cloudBands(P, x0, x1, y0, y1, ramp, seed)`.
  - `cityLayers(L)` (js/levels.js:48) stacks 3 parallax layers.
  - Residents, names and households come from hash (js/folk.js, js/census.js).
  - No BSP, WFC, CA or level generation was found.
  - — [js/skyline.js](/Users/david/projects/under-the-white-dragon/js/skyline.js); [js/levels.js](/Users/david/projects/under-the-white-dragon/js/levels.js)
- Animation: every frame is generated by code. Gait poses `walkN`/`runN` (6 each) are computed with sin/cos (leg swing, arm counter-swing, bob); also `breathe`, `jump`, `fall`, `cut`, `climb0/1`. Each is cached as a sprite.
  - Critters are 2-frame procedural sprites cached by `Life.art(key, make)`: `rat`, `cat`, `dog`, `owl`.
  - Ads are animated live in `Life.drawAds` (marquee, koi, a 3-scene cycle, ECG, equalizer, with 1-px scanline alpha). `Skyline.holo` and `Skyline.train` animate holograms and the monorail.
  - — [js/people.js](/Users/david/projects/under-the-white-dragon/js/people.js); [js/player.js](/Users/david/projects/under-the-white-dragon/js/player.js)
- Effects: — [js/render.js](/Users/david/projects/under-the-white-dragon/js/render.js); [js/day.js](/Users/david/projects/under-the-white-dragon/js/day.js)
  - Light: `lightMap(cx, cy)` in js/render.js is a CPU grid of 4 px cells: ambient from `Day.amb` plus radial lights with falloff `t*sqrt(t)` and a vertical squash. It is drawn by `Tycho.light.Smooth` on the GPU, or in 2D otherwise. Figures are tinted by `lightAt(x,y)`.
  - Flicker: `Life.flick(fl)` with modes fire, tube, bad and sign.
  - Glow: an emissive canvas, finished by `Tycho.post.Blur` (bloom, wet reflections, fade).
  - Weather and day: `Weather` (rain spells from the day number, `rain()`, `wet()`), with hash-placed 2-stroke rain bucketed by light. `Day.haze`, `Day.dim`.
  - Particles: a local `Fx.sparks`/`Fx.burst`/`Fx.step` (js/player.js:106) that duplicates Tycho's `fx.sparks`/`burst`. The move record says it is waiting for that file to be free. `Life` puffs and splashes use `Tycho.fx.age`; litter blows by `Life.wind(t)`.
  - No dithering, palette cycling or CRT post.
- Determinism: painting and sprites use only `Tycho.seed` (`hash`, `Rng`, `noise`). check.sh bans `Math.random`. test/golden.js pins level paint, sprites and frames. — [UWD CLAUDE.md](/Users/david/projects/under-the-white-dragon/CLAUDE.md); [tycho/docs/move.md](/Users/david/projects/tycho/docs/move.md)
- Tycho APIs used for art: `seed` {hash, noise, smooth, Rng}; `color` {rgb, mixRgb, lum, css, SOOT, WARM, rampOf, tone}; `sprite.Shapes`, `canvas`, `flipSprite`; `paint.Pix` (subclassed), `Painter`, `chunk`; `gpu`, `light.Smooth`, `post.Blur`, `fx.age`. Unused (per grep): `spriteFrom`, `outline`, `tinted`, `enlarged`, the scalers, `fx.Particles`/`sparks`/`burst`, `makeNoise`, `shade`. Whether it uses `fx.rise` is uncertain: the move record says the HUD gains rise by it, but grep found only `ui.Rising`. — (search pass)
- Generic local helpers:
  - color: `rp` (a ramp from one color), `col3`
  - pixel primitives: `kFill`, `kH`, `kV`, `kCross`, `kDrain`
  - drawing: `pixText`, vector-to-pixel rasterizing with a tube edge (`dragonHead`), `kTree`'s blob union with an outline
  - painters: `windows`, glyph `sign`, `cable`, `pipe`, `girder`, `railing`, `corrugated`, `heap`, `water`, `haze`
  - the procedural skyline: `tower`, `skylineLayer`, `cloudBands`
  - light: `lightMap`/`lightAt`
  - effects: `Fx`, `Life.flick`, `Life.wind`, rain streaks
  - figures: the gait solver inside `person`; the `Life.art` and `RunnerArt` caches
  - — (search pass)

### Inferences
- Palette approaches run from loosest to strictest: Neo uses free hex values; Merryfolk uses hex ramps from `shade`/`mix` with a quantize and dither pass; White Dragon uses `rampOf` ramps of 9 tones, drawn three hard tones at a time; Lodestar uses 4-tone hue-shifted ramps; Elsewhere uses 8 indexed inks per frame. No shared palette object exists. A Tycho palette type would have to support both "ramps of RGB" and "indexed inks", as options.
- Lodestar and White Dragon both have a stroke painter for sprites (`PntSpr`, and `Shapes.soft`) and a flat outlined painter. Elsewhere has a third, index-based shape painter (`Ink.Sheet`). Neo's `spr_paint` and Merryfolk's `IR`/`IP` helpers are smaller versions of the same thing. That makes five shape rasterizers across the five games.
- The "figure" that Tycho and Elsewhere both plan has three working prototypes to generalize from: White Dragon's `person(o)` (options kit, sin/cos gait), Merryfolk's `folkBody` (genes to palette and grid, 7 poses × 3 views), and Lodestar's `kdRig`/`kdIK` (skeleton, IK, 5 facings). Elsewhere's `Ink.traveler` (fixed rows, palette-mapped) is the simplest.

### Gaps
- The four other games were read through search passes (each reading sample files), not line by line. Function names and line numbers come from those passes and were not re-checked by hand.
- Lodestar's pinned Tycho (c25e2962) is not checked out, so its exact Tycho version is unknown. The local Tycho and Elsewhere's submodule are at 68b29b6.
- Not checked: whether Merryfolk's `fineGrid` matches Tycho's `scale2xRows`, how Neo's boss is enlarged, and Merryfolk's chunk size (16 vs 32 tiles).

## Patterns that repeat across games and could move into Tycho

### Takeaway
The most repeated local code is:
1. Ramp building with hue shift, lift and one-color-to-ramp: in 4 games, beyond `rampOf`.
2. Shape rasterizers into a buffer (ellipse, polygon, line, disc, outlined versions): in 5 games, only partly covered by `Shapes`.
3. Ordered (Bayer) dithering: 3 games.
4. Hash value noise and clustered noise: Lodestar and Merryfolk re-implement it beside `Tycho.seed.noise`.
5. Lazy chunked ground painting outside `Tycho.paint`: Lodestar and Merryfolk.
6. Stepped or radial light grids computed on the CPU: 3 games; only the GPU draw step is shared.
7. Particle systems kept local: 4 games.
8. Wind sway and shear: 2 games.
9. Seasonal or time-of-day palette swaps: 3 games.
10. BFS distance and flood-fill helpers in generation: Neo, Lodestar, Merryfolk.

### Cited Findings
- **Ramps.** Tycho has only `rampOf`, `tone`, `shade` and `mix`. — [tycho/src/core/color.ts](/Users/david/projects/tycho/src/core/color.ts)
  - Lodestar adds `hueRamp` (HSL hue shift: violet shadows, gold lights), `pntRamp`, `pntRampEven`, `pntLiftRamp` and `desaturate`. — [lodestar/js/art.js](/Users/david/projects/lodestar/js/art.js); [lodestar/js/paint.js](/Users/david/projects/lodestar/js/paint.js)
  - White Dragon adds `rp(hex, n)`, a ramp from one color. — [UWD js/people.js](/Users/david/projects/under-the-white-dragon/js/people.js)
  - Merryfolk adds `villagerPalette`, deriving about 35 letters from gene colors. — [merryfolk/js/sprites.js](/Users/david/projects/merryfolk/js/sprites.js)
  - Neo hand-lists 4–6-tone ramps. — [neo/js/sprites.js](/Users/david/projects/neo/js/sprites.js)
- **Indexed or palette-swapped art.** Elsewhere's `Sheet.print(pal)` reprints one index sheet per palette (frogs DAY/DUSK; lighthouse NIGHT/KINDLE/LIT). — [elsewhere/js/ink.js](/Users/david/projects/elsewhere/js/ink.js); [quests/lighthouse/lighthouse.js](/Users/david/projects/elsewhere/quests/lighthouse/lighthouse.js)
  - Merryfolk regenerates art per season (`seasonalImage`, `TREE_PAL[season]`, `GROUND_PAL[season]`). — [merryfolk/js/world.js](/Users/david/projects/merryfolk/js/world.js)
  - Neo recolors loot by rarity (`shadeOf` multiply), and has `SECTOR_PAL` per sector. — [neo/js/render.js](/Users/david/projects/neo/js/render.js)
- **Shape rasterizers.**
  - Elsewhere: `Ink.Sheet` (`line`, `disc`, `ring`, `poly`, `orect`/`opoly`/`odisc`, `curve`). — [elsewhere/js/ink.js](/Users/david/projects/elsewhere/js/ink.js)
  - Neo: `spr_paint` (`r`, `ln`, ramp `disc`, `tpl`). — [neo/js/sprites.js](/Users/david/projects/neo/js/sprites.js)
  - Lodestar: `PntSpr`, `cfxEllipse`, `pixelLine`, `ringDots`, `hl*`. — [lodestar/js/paint.js](/Users/david/projects/lodestar/js/paint.js)
  - Merryfolk: `IR`/`IP`, plus Tycho's `disc`/`ellipse`. — [merryfolk/js/interior.js](/Users/david/projects/merryfolk/js/interior.js)
  - White Dragon: `kFill`/`kH`/`kV`/`kCross` and Tycho's `Shapes`. — [UWD js/kit.js](/Users/david/projects/under-the-white-dragon/js/kit.js)
  - Tycho's own: `Shapes` (RGB, ramp-shaded), `disc`/`ellipse` (direct to a ctx). — [tycho/src/pixels/shapes.ts](/Users/david/projects/tycho/src/pixels/shapes.ts)
- **Outlines.** Tycho `outline` (one ink or own-color, 1 px). Local versions:
  - Lodestar `outlineBuf` with 'selout' (selective outline, colored by the neighbor) — [lodestar/js/art.js](/Users/david/projects/lodestar/js/art.js)
  - Merryfolk `gridCanvas` (multi-ring own-color) — [merryfolk/js/sprites.js](/Users/david/projects/merryfolk/js/sprites.js)
  - Neo `spr_outline` (from 4 shifted silhouettes) — [neo/js/sprites.js](/Users/david/projects/neo/js/sprites.js)
  - White Dragon `kTree` blob-union outline — [UWD js/kit.js](/Users/david/projects/under-the-white-dragon/js/kit.js)
  - Elsewhere's outlined primitives — [elsewhere/js/ink.js](/Users/david/projects/elsewhere/js/ink.js)
- **Dithering.**
  - Merryfolk: `BAYER4` ground quantization (`DITHER_STEP = 14`) and dithered crowns. — [merryfolk/js/world.js](/Users/david/projects/merryfolk/js/world.js)
  - Lodestar: `BAYER4`/`bayerAt` on ground gradients and light steps. — [lodestar/js/render.js](/Users/david/projects/lodestar/js/render.js)
  - Elsewhere: a Bayer table inline in `paintPool`. — [elsewhere/quests/lighthouse/lighthouse.js](/Users/david/projects/elsewhere/quests/lighthouse/lighthouse.js)
  - Tycho has none. — [tycho/src/pixels](/Users/david/projects/tycho/src/pixels)
- **Noise.**
  - Lodestar: `artNoise`, `artClump`, `artLattice`, `pntNoise`, `wallNoise`. — [lodestar/js/art.js](/Users/david/projects/lodestar/js/art.js)
  - Merryfolk: an inline `vn` on `hash2` in `paintCrown`, domain warp in `computePixelTypes`, and ridged `1-|n-0.5|` in `landHeight`. — [merryfolk/js/world.js](/Users/david/projects/merryfolk/js/world.js); [merryfolk/js/terrain.js](/Users/david/projects/merryfolk/js/terrain.js)
  - Tycho: `noise` (one octave) and `makeNoise` (3 fixed octaves). — [tycho/src/core/seed.ts](/Users/david/projects/tycho/src/core/seed.ts)
- **Form or volume shading from a mask.** Lodestar's `buildArtSprite` shades a flat letter-grid silhouette into a lit volume (chamfer distance, then height, normal, Lambert, hard cut). Merryfolk's `paintCrown` lights blobs per pixel from the upper left. Tycho's `Shapes.ell` lights primitives by how they face the light, but cannot shade an arbitrary mask. — [lodestar/js/art.js](/Users/david/projects/lodestar/js/art.js); [merryfolk/js/sprites.js](/Users/david/projects/merryfolk/js/sprites.js); [tycho/src/pixels/shapes.ts](/Users/david/projects/tycho/src/pixels/shapes.ts)
- **Chunked lazy ground.** Lodestar's `PWIN`/`pntWindowMove` and Merryfolk's `Ground`/`stepPaint(budgetMs)` both paint lazily outside `Tycho.paint.Painter`, which only White Dragon uses. — [lodestar/js/paint.js](/Users/david/projects/lodestar/js/paint.js); [merryfolk/js/world.js](/Users/david/projects/merryfolk/js/world.js); [tycho/docs/move.md](/Users/david/projects/tycho/docs/move.md)
- **Light grids.**
  - White Dragon `lightMap` (4 px cells, `t*sqrt(t)` falloff). — [UWD js/render.js](/Users/david/projects/under-the-white-dragon/js/render.js)
  - Lodestar `lightScene` with `addLight` and `addBeamLight` (16 bands, violet darks) and shadow rays. — [lodestar/js/render.js](/Users/david/projects/lodestar/js/render.js)
  - Merryfolk `Light.stamp` (stepped elliptical pools, cut with destination-out). — [merryfolk/js/fx.js](/Users/david/projects/merryfolk/js/fx.js)
  - Elsewhere's dithered lantern pool. — [elsewhere/quests/lighthouse/lighthouse.js](/Users/david/projects/elsewhere/quests/lighthouse/lighthouse.js)
  - Tycho's `light.Smooth` only draws a cell map that a game has already computed; Tycho has no API for placing lights. — [tycho/src/pixels/light.ts](/Users/david/projects/tycho/src/pixels/light.ts)
- **Particles.**
  - White Dragon `Fx` (a copy of Tycho's `sparks`/`burst`). — [UWD js/player.js](/Users/david/projects/under-the-white-dragon/js/player.js)
  - Merryfolk `FX` (2000 cap, fireworks, `drag^(60·dt)`). — [merryfolk/js/fx.js](/Users/david/projects/merryfolk/js/fx.js)
  - Neo `spawnBits` and others (260 cap, `Math.random`). — [neo/js/fx.js](/Users/david/projects/neo/js/fx.js)
  - Lodestar `cfx*` (on `Tycho.fx.move`/`tick`). — [lodestar/js/castfx.js](/Users/david/projects/lodestar/js/castfx.js)
- **Wind and sway.** Merryfolk `windAt`/`blitSway` (row shear); Lodestar `floraWind`/`drawLeaning`; White Dragon `Life.wind`. — [merryfolk/js/nature.js](/Users/david/projects/merryfolk/js/nature.js); [lodestar/js/render.js](/Users/david/projects/lodestar/js/render.js)
- **Mirroring and anchor bookkeeping.** Tycho has `flipped`/`flipSprite`. Elsewhere's `Ink.sprite` mirrors `ax` as `w-1-ax`, Neo's `spr_anchor` does the same, and Tycho's `flipSprite` uses `w - ax` instead. This off-by-one convention varies between games. — [tycho/src/pixels/sprite.ts](/Users/david/projects/tycho/src/pixels/sprite.ts); [elsewhere/js/ink.js](/Users/david/projects/elsewhere/js/ink.js); [neo/js/sprites.js](/Users/david/projects/neo/js/sprites.js)
- **Bitmap fonts and glyphs.** Neo `FONT3` (3×5), White Dragon `PIX3` (3×5) plus invented sign `GLYPHS` (40 random 3×5 from hash), Lodestar `hlSigilPic`/glyph palettes. Tycho has no pixel-font part. — [neo/js/font.js](/Users/david/projects/neo/js/font.js); [UWD js/dragon.js](/Users/david/projects/under-the-white-dragon/js/dragon.js); [UWD js/paint.js](/Users/david/projects/under-the-white-dragon/js/paint.js)
- **Generation helpers.**
  - Flood fill and connectivity: Neo `roomConnected`; Lodestar's prune via `path.distances`; Merryfolk `keepReachable`. — [neo/js/dungeon.js](/Users/david/projects/neo/js/dungeon.js); [lodestar/js/floor.js](/Users/david/projects/lodestar/js/floor.js); [merryfolk/js/nature.js](/Users/david/projects/merryfolk/js/nature.js)
  - Random walks: Neo's room graph; Lodestar's ore veins; Neo's Harvester cracks.
  - Rooms and corridors: Lodestar `generateRuin`.
  - Voronoi regions: Lodestar `layRegions`.
  - Habitat-scored scatter: Lodestar `placeUndergrowth`; Merryfolk `habitat`/`plantNature`.
  - Rejection-sampled scatter: Elsewhere's lily pads. — [elsewhere/quests/frogs/frogs.js](/Users/david/projects/elsewhere/quests/frogs/frogs.js)
- **Character recipes.**
  - White Dragon `person(o)`: an option kit with a sin/cos gait. — [UWD js/people.js](/Users/david/projects/under-the-white-dragon/js/people.js)
  - Merryfolk `folkBody`/`buildVillagerSprites`: genes, 3 views, 7 poses. — [merryfolk/js/sprites.js](/Users/david/projects/merryfolk/js/sprites.js)
  - Lodestar `kdRig`/`kdIK`/`kdRender`. — [lodestar/js/diver.js](/Users/david/projects/lodestar/js/diver.js)
  - Neo `spr_neoFrame`: layered letter parts. — [neo/js/sprites.js](/Users/david/projects/neo/js/sprites.js)
  - Elsewhere `Ink.traveler` and the frogs' `hat(S, kind)` parts kit. — [elsewhere/js/ink.js](/Users/david/projects/elsewhere/js/ink.js); [elsewhere/quests/frogs/frogs.js](/Users/david/projects/elsewhere/quests/frogs/frogs.js)
  - Tycho's README lists `figure` as planned in pixels, and Elsewhere's PLAN item 2 asks for it. — [tycho/README.md](/Users/david/projects/tycho/README.md); [elsewhere/PLAN.md](/Users/david/projects/elsewhere/PLAN.md)

### Inferences
- The patterns most ready to move in under "bit for bit" are the ones already shaped like a pure function: ordered dither (a table plus threshold), hue-shifted ramp options for `rampOf`, a selective outline mode (selout) and a multi-ring mode for `outline`, BFS and flood-fill helpers next to `path.distances`, and an octave/warp/ridge noise builder. Each could be added as an option or a new function without changing existing outputs.
- An indexed buffer (Elsewhere's `Sheet` idea: a `Uint8Array` of palette indexes with `print(pal)`) would sit under every palette-swap use (seasons, day/dusk, rarity, sector looks). It would also let Tycho enforce a color limit. Elsewhere's `Ink` is the natural source to move in, by Tycho's own rule that a game's code moves in exactly.
- Game-specific large pipelines (Lodestar's lighting, Merryfolk's terrain hydrology, White Dragon's skyline) were explicitly kept in the games by the move record ("Lodestar's painted rock", "skylines"). A proposal should treat them as donors of algorithms, not as code to move in whole.

### Gaps
- No measurements were made of how much code each duplicate pattern represents. The counts are of games, not lines.

## Clear gaps: procedural capabilities entirely missing

### Takeaway
Nothing exists, in Tycho or in any game, for:
- wave function collapse or model synthesis
- autotiling (bitmask/blob/Wang tile selection)
- a general sprite generator from seeds (Spelunky/"pixel-sprite-generator"-style mirrored masks)
- palette cycling or color-cycling animation
- Poisson-disc sampling
- L-systems for plants (Merryfolk's recursive `makeBareTree` comes close)
- dungeon graph grammars
- isometric tile and heightmap helpers in Tycho

Things that exist only inside single games, and not in Tycho:
- dithering
- palette indexing and swapping
- hue-shifted ramps
- selective outlines
- cellular automata (one pass, in Lodestar)
- Voronoi regions
- BSP-like room layouts (Lodestar ruins: rooms plus L corridors, not true BSP)
- hydrology
- domain-warped noise
- light placement
- pixel fonts
- wind sway

### Cited Findings
- WFC / constraint solving: none found in any game's search pass or in Tycho's sources. — (search passes); [tycho/src/world](/Users/david/projects/tycho/src/world)
- Autotiling:
  - Tycho's `Grid` stores tile values but has no neighbor-mask or tile-selection helpers. — [tycho/src/world/grid.ts](/Users/david/projects/tycho/src/world/grid.ts)
  - Neo's only rule is "wallFace if the tile below is not wall". — [neo/js/render.js](/Users/david/projects/neo/js/render.js)
  - Merryfolk blends edges by warped Gaussian voting rather than by autotile. — [merryfolk/js/world.js](/Users/david/projects/merryfolk/js/world.js)
  - Lodestar and White Dragon paint terrain without tiles. — (search passes)
- Sprite generation from a seed: every game's characters are either hand-authored letter rows or hand-written recipes with options. Merryfolk's genes and White Dragon's census pick options for those recipes; no game generates new silhouettes from noise or symmetric masks. — [merryfolk/js/sprites.js](/Users/david/projects/merryfolk/js/sprites.js); [UWD js/people.js](/Users/david/projects/under-the-white-dragon/js/people.js)
- Palette cycling: reported absent in all four search passes and not present in Tycho's `color.ts`. Elsewhere does palette changes only as whole reprints (dusk, the lamp catching). — (search passes); [tycho/src/core/color.ts](/Users/david/projects/tycho/src/core/color.ts); [elsewhere/DESIGN.md](/Users/david/projects/elsewhere/DESIGN.md)
- Dithering is not in Tycho; it lives locally in Merryfolk, Lodestar and Elsewhere (see above). Elsewhere's DESIGN limits it to "fat rows of dots", so a dither helper would need a cell-size option (Elsewhere's pool dithers in 2 px cells: `(x>>1)&3`). — [elsewhere/DESIGN.md](/Users/david/projects/elsewhere/DESIGN.md); [elsewhere/quests/lighthouse/lighthouse.js](/Users/david/projects/elsewhere/quests/lighthouse/lighthouse.js)
- Planned but not built in Tycho:
  - pixels: `figure`, `life`, `sky`
  - world: `gen`, `liquid`, `tilelight`
  - play: interact, craft, trade, build, mine
  - a big world's chunks let go of and made again
  - — [tycho/README.md](/Users/david/projects/tycho/README.md); [tycho/docs/move.md](/Users/david/projects/tycho/docs/move.md)
- Isometric support: Elsewhere's `Ink.Iso` (2:1 faces and boxes) and the frogs' `iso`/`unIso` are local. Tycho has no projection or depth-sort helpers. Lodestar's foot-sorting and occlusion are partly in `gpu` (`feet`, `occlude`). — [elsewhere/js/ink.js](/Users/david/projects/elsewhere/js/ink.js); [tycho/docs/renderer.md](/Users/david/projects/tycho/docs/renderer.md)
- Animation tooling: no Tycho part for frame sets, poses, procedural gait, squash/stretch or tweening. Gaits are re-solved per game: White Dragon sin/cos gait, Lodestar 8-frame `kdWalk`, Merryfolk walk1/walk2, Neo 4-frame walk, Elsewhere 2-frame walk. — (search passes); [elsewhere/js/ink.js](/Users/david/projects/elsewhere/js/ink.js)
- Effects missing from `Tycho.fx`: weather (rain, snow, fog, falling leaves), wind, flicker modes, trails and afterimages, screen-space glitch. All exist locally in one or more games. — [tycho/src/pixels/fx.ts](/Users/david/projects/tycho/src/pixels/fx.ts)

### Inferences
- The biggest missing pieces for Elsewhere specifically, given eight inks, iso, many small distinct worlds and replay by seed:
  - an indexed sheet with palette print and swap or cycle (Elsewhere has it locally);
  - iso helpers;
  - autotile or WFC for quickly varied small maps;
  - a seeded parts-kit character and creature generator ("figure");
  - Poisson or rejection scatter;
  - `gen` (noise terrain, caves, regions).

  DESIGN says each world is "one hand-built place", so generators would be used to build quests faster and vary their details, not to replace authorship. That last part is an inference from DESIGN.md's "The world | One hand-built place" row.

### Gaps
- I did not confirm the absence of WFC, autotile or palette cycling by grepping each repo myself. The search passes reported them absent. Tycho's sources were checked directly.

## Settings and themes (what each game would want to generate)

### Takeaway
The five settings are far apart:
- Matrix cyberspace (Neo)
- mystic sci-fi caves on a dead world (Lodestar)
- a Shire village with a neon "rift" sub-theme (Merryfolk)
- a vertical East Asian cyberpunk city (White Dragon)
- an anthology of small whimsical worlds (Elsewhere)

Generators would need to be style-agnostic and driven by recipes and palettes.

### Cited Findings
- **Neo:**
  - sectors: tenement, server, subway, grid, core
  - foes: bugs, watchdogs, firewalls, sentinels, worms, exiles, Agents, the Harvester
  - props: payphones, caches, mirrors, signs
  - items: loot icons (exploit, coat, shades, implant) recolored by 5 rarities
  - projectiles: falling code glyphs
  - Would want: rooms per sector, glyph and code effects, loot icon variants by affix.
  - — [neo/docs/VISION.md](/Users/david/projects/neo/docs/VISION.md); [neo/js/sprites.js](/Users/david/projects/neo/js/sprites.js)
- **Lodestar:**
  - climes: badlands, frost, cinder, bloomfen; the Deep: caverns, grotto, magma, rootdeep
  - creatures: about 20 kinds, one set per clime
  - nodes and veins of light; ores and stones
  - five mote natures and spell Forms × Elements (sigils, arcs, lattices)
  - Would want: cave and biome generation, creature variants per clime, spell-effect pictures.
  - — [lodestar/DESIGN.md](/Users/david/projects/lodestar/DESIGN.md); [lodestar/js/castfx.js](/Users/david/projects/lodestar/js/castfx.js)
- **Merryfolk:**
  - genetic villagers across life stages, plus rift-folk with neon and visors
  - farm animals, pets, critters
  - cottages, inns, mills, windmills, crops by stage
  - trees, bushes and flowers through four seasons
  - valleys with rivers, terraces, cliffs and woods
  - Would want: more terrain and vegetation variety, building variants, villager looks.
  - — [merryfolk/README.md](/Users/david/projects/merryfolk/README.md); [merryfolk/js/sprites.js](/Users/david/projects/merryfolk/js/sprites.js)
- **White Dragon:**
  - about 320 residents with outfits and gear
  - 15 stall kinds; vending, ATM, pachinko, cars, racks
  - 12 building types (shophouse, capsules, machiya, temple, pagoda, glass, stack, danchi, theater, bath, park, arcade)
  - neon signs with invented glyphs, holograms, the monorail
  - device parts on a repair bench; salvage icons
  - depth bands from the Spires to the Bowels
  - Would want: building and facade variety, sign and glyph generation, crowd looks, device-part pictures.
  - — [UWD DESIGN.md](/Users/david/projects/under-the-white-dragon/DESIGN.md); [UWD js/kit.js](/Users/david/projects/under-the-white-dragon/js/kit.js)
- **Elsewhere:**
  - the opening: a dusk Lantern Road, the Hollow, a cottage
  - Mrs. Pell's brick terrace and her cat
  - a pond village of frogs in hats, with a noodle stall
  - a lighthouse at night
  - planned: the last tram (neon and rain, side-on), lost on the moor (fog, top-down, nearly monochrome), and more
  - Every quest needs its own place, people and a souvenir item; the traveler is reprinted in each world's 8 inks.
  - Would want: fast generation of small iso worlds in an 8-ink outlined flat style, creature and person kits (frogs, cats, townsfolk), souvenir icons, and palette events (dusk, the lamp catching).
  - — [elsewhere/DESIGN.md](/Users/david/projects/elsewhere/DESIGN.md); [quests/frogs/frogs.js](/Users/david/projects/elsewhere/quests/frogs/frogs.js)

### Inferences
- Different tastes in shading recur across the games:
  - flat with an outline: Elsewhere, White Dragon `Shapes.figure`, Lodestar letter grids
  - brush strokes: Lodestar `PntSpr`, `Shapes.soft`, `Tycho.paint` strokes
  - dithered and lit: Merryfolk crowns and ground

  Any shared sprite or world generator should output a structure such as an index mask, a material map or a height map, and leave the final look to pluggable "finishers" (flat-outline, strokes, form-shade, dither). That keeps the "parameters, not defaults" rule.

### Gaps
- The settings come from READMEs and design docs plus search passes. Where the games' content lists were long, the lists here may be incomplete.
