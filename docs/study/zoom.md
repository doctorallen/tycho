# Zoom and chunks

How an endless chunked world can zoom from a region map to a single flower and stay crisp pixel art at every step. Merryfolk already zooms over a finite map, and Tycho has the pieces for one level of chunks and nothing more. Shipped games that span region and close-up scales keep separate representations rather than filtering one image down, and box-filtered mipmaps are the wrong tool for pixel art. The design that follows is a pyramid of indexed chunks at power-of-two scales, built by operators that work on palette indexes and kept consistent across levels by position-pure generation, in about a tenth of Merryfolk's memory.

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md).

Text marked *(inference)* is reasoning from the sources, not a sourced fact.

- [How Merryfolk zooms](#how-merryfolk-zooms)
- [What Tycho has](#what-tycho-has)
- [How shipped games span scales](#how-shipped-games-span-scales)
- [Downscaling indexes, not colors](#downscaling-indexes-not-colors)
- [A pyramid of indexed chunks](#a-pyramid-of-indexed-chunks)
- [Moving between steps](#moving-between-steps)
- [Sources](#sources)

## How Merryfolk zooms

Merryfolk's scheme shows both what works and where Tycho falls short.

| Part | How it works |
|---|---|
| Zoom | Five steps, `[1, 2, 4, 6, 8]` screen pixels per world pixel, over a canvas that always holds two canvas pixels per world pixel, so zoom is CSS scaling of a fixed-density canvas ([main.js](https://github.com/doctorallen/merryfolk/blob/main/js/main.js); [util.js](https://github.com/doctorallen/merryfolk/blob/main/js/util.js)) |
| Level of detail | Three switches: at 1× the browser smooths the half-size view and short grass is left out; at 2× villagers swap to a coarser copy redrawn from their grid rather than filtered ([style.css](https://github.com/doctorallen/merryfolk/blob/main/css/style.css); [nature.js](https://github.com/doctorallen/merryfolk/blob/main/js/nature.js); [sprites.js](https://github.com/doctorallen/merryfolk/blob/main/js/sprites.js)) |
| Chunks | **16×16 tiles** (the code's `CHUNK_T = 16`; a comment and the README still say 32), capped at 112, each about 1.05 MB, so the cap is about 117 MB of canvas ([world.js](https://github.com/doctorallen/merryfolk/blob/main/js/world.js)) |
| Painting | A chunk shows a hashed sketch at once, is painted nearest-first by a generator that yields under a per-frame budget of 28, 16, 6 or 2 ms depending on urgency, and fades in ([world.js](https://github.com/doctorallen/merryfolk/blob/main/js/world.js); [dev.js](https://github.com/doctorallen/merryfolk/blob/main/js/dev.js)) |

The scheme works only on a finite map, because every chunk reads whole-map per-pixel arrays *(inference)*.

## What Tycho has

Tycho has the pieces for one level. Its `Chunks` LRU and lazy `Painter` run each operation from its own seed, so strokes meet across chunk edges without seams. But `Chunks.inside` accepts only `cx >= 0 && cy >= 0` inside a fixed width and height, so **it cannot hold an endless world as written** ([paint.ts](../../src/pixels/paint.ts)). Its pinch gesture reports a per-move ratio `d1/d0`, while stepped zoom needs the ratio since the pinch began ([input.ts](../../src/play/input.ts)). Tycho has no camera, no zoom and no mipmaps, and its textures sample `NEAREST` ([gpu.ts](../../src/pixels/gpu.ts)).

## How shipped games span scales

Shipped games that span region and close-up scales keep separate representations rather than filtering one image down.

| Game | Scales | What it does |
|---|---|---|
| Factorio | A schematic chart apart from the world view | Players found its non-integer map steps (about 0.888, 1.110, 1.388) "aren't as sharp as normal view" ([FFF #180](https://factorio.com/blog/post/fff-180); [Factorio forum](https://forums.factorio.com/viewtopic.php?p=448642)) |
| Minecraft maps | 128×128 pixels, at 1:1 to 1:16 | Java Edition colors each pixel by "the most common opaque block", so "small features often don't appear on zoomed-out maps"; Bedrock point-samples ([Minecraft Wiki: Map](https://minecraft.wiki/w/Map)) |
| Dwarf Fortress | World, region and local tiles | Nested in factors of 16 and 48 ([DF Wiki: Embark](https://dwarffortresswiki.org/index.php/DF2014:Embark)) |
| Distant Horizons (a Minecraft mod) | A quadtree | Generates low detail first and refines around the player ([newreleases.io](https://newreleases.io/project/gitlab/jeseibel/distant-horizons/release/1.16.5-a1.4); [Modrinth changelog](https://modrinth.com/mod/distanthorizons/changelog?page=2)) |
| Web maps | One tile at zoom 0, four times as many at each step | Cover the world in 4^zoom tiles of 256 pixels ([OSM Wiki](https://wiki.openstreetmap.org/wiki/Zoom_levels)) |

## Downscaling indexes, not colors

Box-filtered mipmaps are the wrong tool for pixel art. Averaging an outline ink with a fill ink invents a mid-tone found in neither, so outlines dissolve, and inside palette indexes an average is not even defined *(inference)*. Gerstner and colleagues showed that naive downsampling followed by palette quantization loses detail ([Gerstner et al. 2012](https://pixl.cs.princeton.edu/pubs/Gerstner_2012_PIA/index.php)).

The safe operators work on indexes *(inference)*:

| Operator | What it does |
|---|---|
| Mode | The most common ink per block |
| Weighted mode | The same, with outlines, paths and water edges winning ties |
| Semantic downscale | Coarse pixels computed straight from tile types |
| Far-zoom impostors | Objects replaced outright: a tree as a 2×2 blob, a person as two pixels, as Merryfolk's coarse villager and RimWorld's two icons already do |

## A pyramid of indexed chunks

The design that follows is a pyramid of indexed chunks *(inference)*. Level L holds chunks at 1/2^L of full density, every chunk has the same pixel size P, and keys are `(L, cx, cy)`, with `cx >> 1` naming the parent.

| At P = 128 | |
|---|---|
| One chunk | 64 KB |
| Chunks to fill a 320×180 view | about 12, at any level |
| Three levels of about 64 cached chunks | roughly **12 MB, a tenth of Merryfolk's cap** *(inference, arithmetic)* |

Consistency across levels comes from position-pure generation ([Red Blob Games](https://www.redblobgames.com/maps/terrain-from-noise/); [paint.ts](../../src/pixels/paint.ts)), though the recipe as a whole is an inference:

- **Macro fields** (elevation, moisture, biome) are evaluated at any resolution, with high octaves dropped at coarse levels.
- **Object density** comes from a hash per cell, so the far level knows a forest's color without placing trees.
- **Rivers, roads and quest sites** are vectors, rasterized at every level at least one pixel wide.

A missing chunk shows its cached parent scaled up 2× by nearest neighbor, then a flat sketch, then fades in, and look-ahead chunks are evicted first, as Merryfolk does *(inference)*.

<figure class="demo"><div class="stage" data-demo="chunks"></div>
<figcaption><b>Zoom from a region map to a single flower.</b> Seven steps over one endless seeded world, as in Merryfolk: biome colors, then a speck per tree, blobs, half-size sprites, full sprites, and every flower and tuft. Each step has its own chunk cache, painted nearest-first a few milliseconds a frame. A missing chunk borrows the coarser step scaled up, then fades in. One hash places each plant at every step, so the speckle seen from afar is the forest zoomed into. Far steps pick the most common palette color rather than blurring, the way Minecraft's maps do. Drag to pan; wheel, pinch, double-tap or − / + to zoom.</figcaption></figure>

## Moving between steps

Each level is shown only at whole magnifications, so every resting frame is crisp and inside the palette *(inference)*.

- **During a pinch**, the sharp-bilinear trick (a nearest upscale to the next integer, then one smoothed downscale) gives near-crisp fractional zoom with only `drawImage`, and the camera eases to the nearest step on release ([squirkel](https://zff.dev/thersgo/squirkel); [CapView wiki](https://github.com/NuclearMeltdown/CapView/wiki/Scaling-and-sharpening)).
- **Crossing a level** crossfades two baked levels with `globalAlpha` over 150 to 250 ms *(inference)*.
- **Snapping in log space** with a little hysteresis keeps a hovering pinch from flickering *(inference)*.

## Sources

- [Factorio Friday Facts #180](https://factorio.com/blog/post/fff-180) and [the Factorio forum on map zoom](https://forums.factorio.com/viewtopic.php?p=448642)
- [Minecraft Wiki, Map](https://minecraft.wiki/w/Map)
- [Dwarf Fortress Wiki, Embark](https://dwarffortresswiki.org/index.php/DF2014:Embark)
- [Distant Horizons release notes](https://newreleases.io/project/gitlab/jeseibel/distant-horizons/release/1.16.5-a1.4) and [Modrinth changelog](https://modrinth.com/mod/distanthorizons/changelog?page=2)
- [OpenStreetMap Wiki, zoom levels](https://wiki.openstreetmap.org/wiki/Zoom_levels)
- [Gerstner et al. 2012, pixelated image abstraction](https://pixl.cs.princeton.edu/pubs/Gerstner_2012_PIA/index.php)
- [Red Blob Games, terrain from noise](https://www.redblobgames.com/maps/terrain-from-noise/)
- [squirkel, sharp scaling](https://zff.dev/thersgo/squirkel) and [CapView wiki, scaling and sharpening](https://github.com/NuclearMeltdown/CapView/wiki/Scaling-and-sharpening)
- Merryfolk: [main.js](https://github.com/doctorallen/merryfolk/blob/main/js/main.js), [util.js](https://github.com/doctorallen/merryfolk/blob/main/js/util.js), [style.css](https://github.com/doctorallen/merryfolk/blob/main/css/style.css), [nature.js](https://github.com/doctorallen/merryfolk/blob/main/js/nature.js), [sprites.js](https://github.com/doctorallen/merryfolk/blob/main/js/sprites.js), [world.js](https://github.com/doctorallen/merryfolk/blob/main/js/world.js), [dev.js](https://github.com/doctorallen/merryfolk/blob/main/js/dev.js)
- Tycho: [paint.ts](../../src/pixels/paint.ts), [input.ts](../../src/play/input.ts), [gpu.ts](../../src/pixels/gpu.ts)

The full research is in [the notes on zoom and chunks](notes/lod_zoom_chunks.md).

<script src="demos/kit.js"></script>
<script src="demos/flora.js"></script>
<script src="demos/chunks.js"></script>
<script src="demos/start.js"></script>
