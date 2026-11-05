# Level-of-detail zooming for endless chunked pixel/tile worlds

Scope: how a 2D pixel game can zoom, in steps or continuously, from a region map (a pixel per tile or less) down to single plants and characters, and how chunks are generated, cached and drawn at each level. The notes feed a Tycho engine roadmap. Tycho is plain JS. Each frame it draws through a limited canvas API (fillRect, drawImage, alpha, four blends, transforms, gradients) and bakes everything else offscreen.

Local paths are absolute. Line numbers are from the working trees on 2026-11-03. Elsewhere's `vendor/tycho` is at commit 68b29b6 and `/Users/david/projects/tycho` at c4ab110; the `Chunks` code cited below sits on the same lines in both.

---

## 1. Local precedent: how Merryfolk zooms and how far Tycho supports it

### Takeaway
Merryfolk has five fixed zoom steps, `[1, 2, 4, 6, 8]` screen pixels per world pixel, over a canvas that always holds 2 canvas pixels per world pixel. Its whole LOD scheme is three small switches:
- at 1× the canvas is shown at half size and the browser smooths it;
- at 2× the villagers use a half-resolution copy;
- at 1× the short grass is left out.

The ground is cached as 256-world-px chunk canvases (16 tiles, not the 32 the comments claim). Each chunk shows a flat sketch first and is then painted nearest-first by a sliced generator under a per-frame millisecond budget. The cache keeps at most 112 chunks (about 1 MB each) and evicts the least recently used. Tycho has a generic LRU chunk cache (`Chunks`/`Painter`) and a pinch gesture, but no camera, no zoom and no LOD levels. Its chunk cache also refuses negative or out-of-bounds chunk coordinates, so it cannot hold an endless world as it stands.

### Cited Findings

**Zoom steps and the canvas**
- Zoom is in screen (CSS) pixels per world pixel: `const ZOOMS = [1, 2, 4, 6, 8]`. The steps are even "so every half-pixel of art lands on whole screen pixels; the widest, 1, shows a whole stretch of the valley on a phone, smoothed down to half size." `snapZoom` picks the nearest step, and `zoomStep(dir)` moves one step up or down, clamped. — `/Users/david/projects/merryfolk/js/main.js:1035-1040`
- The world is drawn at double resolution: `RS = 2` canvas pixels per world pixel. Villagers' sprites use `FOLK_RES = 4`, and the painted ground also uses `GS = 2`. Tiles are 16 px (`TILE = 16`), and the classic map is 128×96 tiles. — `/Users/david/projects/merryfolk/js/util.js:17-22`, `:36-40`
- `resize()` sizes the camera in world px as `ceil(innerWidth / zoom)` and makes the backing canvas `cam.w * RS` wide at every zoom. It then sets the canvas's CSS size to `cam.w * zoom`. So zoom is CSS scaling of a fixed-density canvas: at 1× the 2× canvas shows at half size, at 2× one canvas px is one CSS px, and at 4/6/8× each canvas px is shown 2/3/4 CSS px wide. — `/Users/david/projects/merryfolk/js/main.js:1014-1027`
- At 1× the body gets class `zoom-1`, "since there's no whole pixel for each half-pixel of art". The CSS rule `body.zoom-1 #view { image-rendering: auto; }` turns on the browser's smoothing for that step only. — `/Users/david/projects/merryfolk/js/main.js:1011-1012`; `/Users/david/projects/merryfolk/css/style.css:849`
- The camera snaps to half-pixels, "the finest step the art has" (`Math.round(cam.x * RS) / RS`), and the world transform is `setTransform(RS, 0, 0, RS, -cx*RS, -cy*RS)`. The text overlay uses the same snapped camera so labels sit exactly on it. — `/Users/david/projects/merryfolk/js/main.js:675-678`, `:861-862`
- The first zoom is `Math.max(2, snapZoom(min(innerWidth/240, innerHeight/280)))`: "about 15 tiles across, never the widest (that one's for looking about)". — `/Users/david/projects/merryfolk/js/main.js:1347-1348`. The README says the game opens at 2× on phones and "Zoom reaches 1×, which shows a whole stretch of the valley smoothed down to half size". — `/Users/david/projects/merryfolk/README.md:125`
- Keyboard panning is scaled so a wider view pans faster in world px: `sp = 260 * dt / Math.max(1, Game.zoom / 2)`. — `/Users/david/projects/merryfolk/js/main.js:1276`

**What is dropped at which zoom**
- **1×, grass:** "the short grass and weeds are too small to see, so only the tall stands are drawn". Grass is gathered with `if (Game.zoom > 1 || g.v >= TALL_V)`, where `TALL_V = 300`. — `/Users/david/projects/merryfolk/js/main.js:727-728`; `/Users/david/projects/merryfolk/js/nature.js:101-102`. The README repeats this: "the short grass is left out there, since it would be too small to see". — `/Users/david/projects/merryfolk/README.md:396`
- **2×, villagers:** every villager sprite carries a `lo` copy, the plain grid at 2 px per world pixel rather than the refined 4 px version, "for the zooms where quarter-pixels wouldn't land on whole screen pixels". The set of such zooms is `FOLK_LO_ZOOMS = new Set([2])`: "at this zoom a quarter-pixel is half a screen pixel and the finer detail can't show". — `/Users/david/projects/merryfolk/js/sprites.js:548-556`; `/Users/david/projects/merryfolk/js/util.js:33-35`
- `blit()` swaps in `img.lo` when the zoom is in `FOLK_LO_ZOOMS`. The anchors (where hands and props attach) are copied to the `lo` canvas so props still line up. — `/Users/david/projects/merryfolk/js/sprites.js:37`, `:564`
- A dev toggle, "fine folk at every zoom", empties `FOLK_LO_ZOOMS` so the quadruple-resolution folk are drawn at zoom 2 as well. — `/Users/david/projects/merryfolk/js/dev.js:307`, `:461`
- Sprites drawn at world resolution are upscaled once with Tycho's Scale2x (`Tycho.sprite.enlarged(src, 2)`) and the result is cached in a `WeakMap` (`hd()`). — `/Users/david/projects/merryfolk/js/sprites.js:25-31`
- Unresolved: the view canvas is `cam.w * RS` (2 px per world px) at every zoom (`main.js:1020`), and I found no separate higher-resolution pass for villagers. I could not confirm how the 4×-resolution folk detail reaches the screen at zooms 4–8, given that the README says folk are drawn "at quadruple resolution" (`README.md:396`). See Gaps.

**Chunk painting, order and eviction**
- The comment says: "The ground is kept in chunks of 32×32 tiles … made when it first comes into view, showing a flat sketch … until its real painting is done (the nearest to the camera first, a few milliseconds a frame), and is let go again when it has been out of sight longest, so a big valley never holds more than a score of them." The code below it says `const CHUNK_T = 16, CHUNK_PX = CHUNK_T * TILE, CHUNK_MAX = 112`. So the comment and the README ("chunks of 32×32 tiles") are stale: chunks are 16×16 tiles (256 world px), and up to 112 are kept. — `/Users/david/projects/merryfolk/js/world.js:1179-1186`; `/Users/david/projects/merryfolk/README.md:396`
- **Placeholder.** `sketchGround` fills the chunk with the season's grass color and lays "a mottle of four blocks to the tile, so the sketch reads as ground until the painting lands". It draws 4×4 blocks of 4 world px per tile, colored by tile type, with colors chosen by `hash2(tx*4+i, ty*4+j)`. — `/Users/david/projects/merryfolk/js/world.js:1187-1202`
- **Creation.** `Ground.get(cx, cy)` makes a canvas `(x1-x0)*GS` square, sketches it at once, and records `{painted: false, prev, fade, gen, next, used}`. Its key is `cy * 1024 + cx`. — `/Users/david/projects/merryfolk/js/world.js:1210-1225`
- **Look-ahead.** Each step first creates chunks for everything within 1.5 chunk widths of the screen ("so it is painted before it is drawn"). It collects the chunks that still want painting and sorts them by the Euclidean distance from chunk center to camera center. — `/Users/david/projects/merryfolk/js/world.js:1236-1245`
- **Sliced painting.** The painter is a generator, `function* paintGroundGen(...)`, which yields between stages and every 64 rows of the final pass. `step` calls `gen.next()` until the budget runs out. A finished chunk swaps in `next` and keeps the old canvas as `prev` with `fade = 1`. The fade rate is 3 per second after a sketch and 0.5 per second for a season repaint. — `/Users/david/projects/merryfolk/js/world.js:897`, `:1246-1257`, `:1158-1175`
- **Budget per frame:**
  - 28 ms while the intro card is up or the job is urgent;
  - 16 ms when unpainted ("bare") ground is on screen;
  - 6 ms if the camera moved within the last second;
  - otherwise 2 ms ("only a sliver goes to the chunks off screen").
  
  — `/Users/david/projects/merryfolk/js/main.js:1308-1314`
- **Drawing.** Each visible chunk is drawn with a source rectangle clipped to the view. If `prev` is set and `fade > 0`, the old canvas is drawn over it at `globalAlpha = fade`. The fade runs on wall-clock time "so they finish even while the game is paused". `Ground.trim()` runs every frame. — `/Users/david/projects/merryfolk/js/main.js:684-697`
- **Eviction.** `trim()` does nothing until the cache holds more than `CHUNK_MAX`. It then sorts all chunks by their `used` stamp and deletes the oldest, but skips any chunk used in the current frame. — `/Users/david/projects/merryfolk/js/world.js:1261-1266`
- **Seams.** All chunks read whole-map per-pixel arrays (`World.px`: `type`, `noise`, `height` …), built once by `computePixelTypes`. The speckle noise function is cached between chunks because "it costs as much to make as a chunk takes to paint". The final pass averages each world pixel's GS×GS half-pixels and dithers with a 4×4 Bayer matrix indexed by world coordinates (`(y0 + r) & 3`, `(R0.x0 + c) & 3`), so the dither pattern runs on across chunk edges. — `/Users/david/projects/merryfolk/js/world.js:762-766`, `:897-921`, `:1158-1175`
- **Local edits.** `repaintRect` repaints a changed rectangle on a scratch canvas with a 96-px margin "so mounds and flowers that straddle its edge come out whole", then copies the result into the chunks it touches. A chunk still mid-paint restarts. — `/Users/david/projects/merryfolk/js/world.js:1300-1320`
- `paintAll` paints every chunk synchronously (a dev button and a fallback). — `/Users/david/projects/merryfolk/js/world.js:1271-1283`

**Memory budget**
- The dev line reports chunk memory as `chunks.length * CHUNK_PX * CHUNK_PX * GS * GS * 4 / 1e6` MB. That is (256·2)² px × 4 bytes ≈ 1.05 MB per chunk, so the 112-chunk cap is about 117 MB of canvas. — `/Users/david/projects/merryfolk/js/dev.js:121`; constants at `/Users/david/projects/merryfolk/js/world.js:1186`
- The README describes the dev panel's chunk tools: the frame line shows "the chunks of ground painted and kept with their memory", and an overlay outlines "every chunk of ground with whether it is painted, painting or still a sketch". — `/Users/david/projects/merryfolk/README.md:78-79`

**Pinch, wheel and keys in Merryfolk**
- **Pinch.** A pinch zooms "in whole steps (keeping the pixels crisp) around the point between the fingers, and pans as the fingers move together".
  - `startPinch` records the starting finger distance `d0` (at least 20 px), the starting zoom `z0`, and the world point under the midpoint.
  - `movePinch` sets `z = snapZoom(z0 * d/d0)`, resizes on a step change, and re-solves the camera so the same world point stays under the moving midpoint.
  - Pinch is touch-only and never starts while a villager is being carried.
  
  — `/Users/david/projects/merryfolk/js/main.js:1071-1089`, `:1093-1097`
- **Wheel.** Deltas are summed (line-mode deltas ×40). The sum fires one step at 60 px, or at 30 for `ctrlKey`, which is how trackpad pinches arrive. Any single delta of 50 or more fires at once. The step is anchored at the cursor. — `/Users/david/projects/merryfolk/js/main.js:1141-1151`
- **Keys.** `+`/`=` and `-`/`_` step the zoom about the screen center. `setZoom` keeps the anchor's world point fixed: `wx = cam.x + ax/zoom`, then `cam.x = wx - ax/z`. — `/Users/david/projects/merryfolk/js/main.js:1041-1050`, `:1167-1168`

**Tycho's support**
- `Tycho.paint` is a "chunked lazy painter". A world is a list of operations, each with a world-px box, its own seed and a paint function. A chunk runs only the operations whose box touches it, each from its own seed, "so strokes meet across chunk edges without seams and anything painted twice matches itself". — `/Users/david/projects/tycho/src/pixels/paint.ts:1-7`, `:186-203`; `/Users/david/projects/tycho/docs/paint.md:3-5`
- `Chunks<C>` is a generic LRU cache: `get` (make if new, stamp `used`, trim past `max`), `peek`, `has`, `over(box)`, `nearest(x, y, rx=3, ry=2)` (fewest Manhattan chunk steps), `ahead(x, y, {rx, ry, budget})` ("A frame's spare work … so walking into new ground doesn't stall") and `trim` (sort by `used`, delete the oldest). Keys are strings `cx + ',' + cy`. — `/Users/david/projects/tycho/src/pixels/paint.ts:213-283`
- `Chunks.inside(cx, cy)` is `cx >= 0 && cy >= 0 && cx*size < w && cy*size < h`, and both `over` and `nearest` skip chunks that fail it. With the default `w = h = 0`, no chunk is inside at all. — `/Users/david/projects/tycho/src/pixels/paint.ts:221`, `:230`, `:245`, `:254` (identical in `/Users/david/projects/elsewhere/vendor/tycho/src/pixels/paint.ts:230`)
- `Tycho.grid` is a chunked tile grid. Chunk sides are a power of two (default 32), and each chunk is filled lazily from the seed by `make` "the first time it's touched". It has no eviction. — `/Users/david/projects/tycho/src/world/grid.ts:33-38`, `:81-82`, `:155-162`
- `Tycho.input.Gestures` gives `onPinch(k, x, y, dx, dy)`. Here `k` is the new finger distance over the previous one, computed on every pointer move (`d1 / d0`), and it is null below `pinchMin`. `x, y` is the current midpoint, and `dx, dy` is the midpoint's movement when `pinchPan` is set. "The wheel's zoom is the game's own." — `/Users/david/projects/tycho/src/play/input.ts:333-353`, `:385-392`; `/Users/david/projects/tycho/docs/play.md:49`, `:58`
- The GPU stand-in creates textures with `NEAREST` filtering by default and uses `LINEAR` only for the light map scaled up "smooth from its cells". I found no mipmap generation. — `/Users/david/projects/tycho/src/pixels/gpu.ts:248-252`, `:321`, `:61-71`
- A grep of Tycho's `src/`, `docs/` and README for "zoom", "camera" and "mipmap" found nothing beyond the pinch gesture and the dev `inspect` wheel hook (`docs/inspect.md:41`). A separate local survey notes that Tycho's move record plans "a big world's chunks being let go of, made again and saved" for a coming Terraria-like game. — `/Users/david/projects/elsewhere/research_notes/Procedural pixel art and worlds/local_games_and_tycho.md` (lines 22, 634)
- Elsewhere's own view is "one pixel canvas the size of the screen in a quest's own pixels, scaled up by whole steps so the art stays crisp", with `imageSmoothingEnabled = false`. — `/Users/david/projects/elsewhere/js/view.js:1-10`, `:36`

### Inferences
- Merryfolk's LOD is "semantic" only at the extremes: it drops a decoration class (short grass) and swaps a sprite resolution. Everything else is the same picture shown at a different CSS scale. Because every zoom step is a multiple of the canvas density except 1×, Merryfolk never has to resample world art except at 1×, where it accepts browser smoothing (a blur) as the price.
- On the classic 128×96-tile valley there are only 8 × 6 = 48 chunks of 16 tiles, so the 112-chunk cap never triggers and the whole ground (about 50 MB) stays resident. Eviction matters only on larger maps (`setMapSize`, `/Users/david/projects/merryfolk/js/world.js:1510`).
- `Ground.step` creates look-ahead chunks with `touch = false`, so they keep `used = 0` and are the first to be evicted. That is the right bias: speculative work goes before chunks that were really seen.
- Merryfolk's chunk system is finite-map only. Seamlessness comes from reading whole-map arrays (`World.px`), and that is not available in an endless world. There, each chunk (or each level-of-detail tile) must be computable from position plus seed, or from a fixed-size neighborhood of other chunks.
- Two things in Tycho block an endless world:
  - `Chunks.inside` needs a bounded, non-negative world. An endless world needs an option such as `w: Infinity` with negative coordinates allowed, or an `inside` callback.
  - `Gestures` reports per-move pinch ratios, while stepped zoom needs the cumulative ratio since the pinch began (Merryfolk keeps `d0` from the start). A Tycho camera needs to accumulate `Π k`, or report `d / d0`.
- `trim()` in both Merryfolk and Tycho sorts the whole map on every overflow (O(n log n)). That is fine at around 100 entries. A per-level cache with thousands of small tiles would want a true LRU: a JS `Map` re-inserted on access gives oldest-first iteration for free.

### Gaps
- I could not confirm how Merryfolk's quadruple-resolution folk show at zooms 4–8 when the view canvas is fixed at 2 px per world px (`main.js:1020`). Either the GPU path renders at higher density, or the detail is lost to nearest sampling. This needs a run in the browser or a closer read of `gpu.ts`.
- The fade cost (two drawImages per fading chunk) and the real peak memory (`prev`, `next` and `gpuCopy` textures alongside `c`) were not measured.

---

## 2. How shipped games do semantic zoom and LOD in 2D

### Takeaway
Almost every shipped game that spans region and close-up scales uses separate representations rather than one image filtered down:
- a schematic "chart" or map layer with one flat color per tile or block, built incrementally as the world is explored or revealed;
- icons that stay a constant size on screen for important objects;
- a hard switch, or an overlay, between the chart and the full-detail world view.

Tile pyramids (each zoom level has 4× the tiles of the one above) are the standard structure for continuous web-map zoom.

### Cited Findings

**Factorio**
- Factorio separates a "world view" (full visual detail) from a "chart/map view" (a schematic showing icons, connections and coverage but "not visual world detail"). — [Zooom mod page](https://mods.factorio.com/mod/Zooom) (search-result summary)
- FFF #180 (2017) listed as ideas: "Be able to zoom from the map view directly to the world", with areas not covered by radar shown as "some kind of blackness". It also floated "Option of Higher resolution of map. If we have 4 pixels per tile in the map it could be nicer". The post adds: "this doesn't mean a promise or a plan, just an idea." — [Factorio FFF #180](https://factorio.com/blog/post/fff-180)
- A Wube staff member said the zoomed-in map view draws the normal world view first and then draws the map over chunks radar hasn't revealed, which is why it is costly. — [Factorio forum, "[2.0.24] FPS drops in remote view"](https://forums.factorio.com/viewtopic.php?p=651822). From a search snippet only; the page returned 403 when fetched, so I could not read the exact quote.
- In 0.15, after a bug report on the jump between map zoom and zoom-to-world, a developer said "the step size of zooming is reduced, so the zoom levels are less dramatic between the map, and the zoom to world". — [Factorio forum, "[15.11] Mapzoom Bug"](https://forums.factorio.com/viewtopic.php?p=276697)
- A bug report says map-view zoom steps produce scales such as about 0.888, 1.110 and 1.388 that "aren't as sharp as normal view". — [Factorio forum, "Wrong zoom steps in map view"](https://forums.factorio.com/viewtopic.php?p=448642)
- The ZoomPresets mod's defaults give 0.4 as the maximum player zoom-out (on the map, "the zoom-to-world threshold") and 0.0035 as the maximum map zoom-out. These are mod defaults, not official values. — [ZoomPresets mod](https://mods.factorio.com/mod/ZoomPresets)
- Factorio's chunk is 32×32 tiles ([Factorio wiki, Chunk](https://wiki.factorio.com/Chunk/zh)). Base art is 32 px per tile ([forum](https://forums.factorio.com/viewtopic.php?p=476972)), and the mapshot tool notes that many assets allow up to 64 px per tile ([mapshot](https://github.com/compcj/mapshot)).

**RimWorld**
- A world object can define two icons: `expandingIconTexture`, shown "normally on the world map", and a texture that appears when you zoom in. — [RimShare wiki mirror, Using Custom World Map Icons](https://github.imc.re/seraphile/rimshare/wiki/Using-Custom-World-Map-Icons). A modding wiki mirror, so of moderate reliability.
- In 1.6, world objects with active maps get a green border and searched objects a yellow one, and there is a toggle for important world objects. — [RimWorld 1.6 changelog](https://docs.google.com/document/d/e/2PACX-1vRCjqVtPQDFGu4POiKTUd_8o3U2Asdhx99SOvcgU66ABdYtk3Cgndd53yJ6BC4tZX530pp_m6lf4Z9P/pub)

**Dwarf Fortress**
- The embark screen shows three magnifications of the same land: Local, Region and World. World tiles are 16×16 groups of region tiles, a region tile is covered by 16×16 local (embark) tiles, and each embark tile becomes 48×48 playable tiles. — [DF Wiki, Embark](https://dwarffortresswiki.org/index.php/DF2014:Embark); [DF Wiki, Region](https://dwarffortresswiki.org/index.php/Region) (search-result summaries; check which version a page describes)

**Civilization VI**
- The Strategic View is a top-down 2D rendering of the map. Each hex shows icons for special resources, improvements and units, and players describe it as translating the 3D style into 2D. — [CivFanatics, Strategic View](https://forums.civfanatics.com/threads/strategic-view.572168); [CivFanatics, Farther Zoom](https://forums.civfanatics.com/threads/farther-zoom.605630) (forum sources)

**Minecraft maps**
- A map is always 128×128 pixels. Scales run 1:1 to 1:16, so one pixel covers 1, 2×2, 4×4, 8×8 or 16×16 blocks, and a map covers 128² up to 2048² blocks.
- Java Edition colors a pixel by "the most common opaque block in the corresponding area" as seen from above, so "small features often don't appear on zoomed-out maps". Bedrock instead takes "the single top-most opaque block" at grid points spaced by the scale (point sampling).
- On land, a block is drawn darker if it is lower than the block to its north and brighter if higher.
- Zooming a map out in a cartography table resets its contents, so the land must be explored again.

— [Minecraft Wiki, Map](https://minecraft.wiki/w/Map)

**Distant Horizons (Minecraft LOD mod)**
- It "will render chunks at different detail levels depending on how far they are from you". — [CurseForge, Distant Horizons](https://www.curseforge.com/minecraft/mc-mods/distant-horizons/); [Modrinth](https://modrinth.com/mod/distanthorizons/gallery)
- An early (1.16.5-a1.4) release replaced the back-end data structure with a quadtree. — [release notes via newreleases.io](https://newreleases.io/project/gitlab/jeseibel/distant-horizons/release/1.16.5-a1.4)
- Changelogs say LODs are generated at low detail first and refined later, and that LOD updates happen around the player rather than first-in-first-out. — [Modrinth changelog](https://modrinth.com/mod/distanthorizons/changelog?page=2) (search-result summary)
- A fork has an option to generate the full detail hierarchy down to the finest configured level on first pass, rather than only the level the renderer currently needs. — [Distant Horizons Au Naturel fork](https://www.curseforge.com/minecraft/mc-mods/distant-horizons-au-naturel-edit/files/7965637)

**Terraria**
- The map/minimap shows explored areas "at the brightest level the character has seen them". Areas explored without light aren't mapped, and areas that go dark again stay visible. Overlay mode zooms from "a 1:1 scale" out "far enough to see the entire world".
- Map data is saved with the character, not the world, as a `.map` file. Paint shows on the map, and changed tiles are updated.

— [Terraria Wiki, Minimap](https://terraria.wiki.gg/wiki/Minimap)

**Web tile pyramids (Google/OSM slippy maps)**
- Raster tiles are typically 256 px (vector tiles 512). The world is covered by 4^zoom tiles. At the equator, zoom 0 is about 156,543 m per pixel and each level halves that. Systems expose 20–24 steps. — [OSM Wiki, Zoom levels](https://wiki.openstreetmap.org/wiki/Zoom_levels)

### Inferences
- The common pattern is a three-tier scheme, which maps directly onto a pixel game:
  1. **Chart:** one color per tile (or per block of tiles), cached as small images.
  2. **Mid zoom:** the real ground at reduced density, with decorations culled.
  3. **Close:** full art plus characters.
  
  Important objects (towns, quest-givers, the player) become constant-size icons on the chart, as in RimWorld, Civ and Factorio's chart, rather than shrinking into unreadable sprites.
- Factorio's two-pass cost (world, then chart over unrevealed chunks) and its non-integer map steps looking soft both argue for Elsewhere/Tycho to keep a small set of integer, or 2^n, LOD steps, with a deliberate switch or crossfade where the representation changes.
- Minecraft's "reset on zoom out" and Terraria's "saved with the character" show that a chart can be gameplay state (what the player has seen) rather than a pure function of the seed. For Elsewhere, the chart level can be pure seed-derived pixels, with a "seen" mask kept separately as small JSON or bitfields if exploration matters.

### Gaps
- No primary sources found for Songs of Syx, Townscaper or Stardew Valley zoom/LOD (not reached within the search budget). Stardew in particular may have little zoom range, which I could not confirm.
- No official Factorio Friday Facts post was found that describes how the chart is rasterized (pixels per tile, update cadence); FFF #180 only proposes ideas.
- No official RimWorld documentation on when icons swap or how big they are; Civ VI's strategic-view internals are known only from forums.
- Distant Horizons' exact per-level block widths and its data format were not found in docs (they likely live in its GitLab source).

---

## 3. Mipmapping pixel art: box filtering vs representative color vs palette-aware downscaling

### Takeaway
Straight mipmaps (box or bilinear averaging) blur pixel art and invent colors outside its palette. Dark outlines turn into mid-tone halos, and small bright marks wash out. Representative-color downscaling (mode/majority, like Minecraft Java's "most common block"), point sampling (Bedrock), or palette-aware quantization after averaging keep the result inside the palette and crisp.

For far zoom, an object should become a hand-made or derived impostor: a tree as a 2×2 dark-green blob, a house as a roof-colored square, a person as one or two pixels or an icon. A filtered copy of the full sprite is the wrong tool.

### Cited Findings
- Minecraft Java picks the most common opaque block per area (a mode filter), so minority features vanish. Bedrock point-samples one block per area. — [Minecraft Wiki, Map](https://minecraft.wiki/w/Map)
- Gerstner et al. (NPAR 2012), "Pixelated Image Abstraction", argue that naive nearest-neighbor or cubic downsampling followed by median-cut quantization loses detail and blurs. They optimize superpixels and a reduced palette jointly, and a user study preferred their results. — [Princeton PIXL, Gerstner 2012](https://pixl.cs.princeton.edu/pubs/Gerstner_2012_PIA/index.php)
- MakeItPixel lets the user choose how each output pixel is picked from its source block (minimum, maximum, median or average), maps to the nearest palette color (or nearest gray when the palette differs a lot), and suggests dithering to recover detail lost in quantization. — [MakeItPixel wiki, Process](https://github.com/MiguelMJ/MakeItPixel/wiki/Process)
- A "smart pixel art downscaler" library reduces regions to one representative color each, works in Oklab, and offers several palette-extraction strategies. — [smart-downscaler (pkgstats)](https://www.pkgstats.com/pkg:smart-downscaler)
- Merryfolk's own ground pass is an average-then-quantize step. Each world pixel takes the mean of its GS×GS half-pixels and is then posterized with a 4×4 Bayer dither (`DITHER_STEP = 14`), "so the hills, bridges and flowers are as chunky as the rest". — `/Users/david/projects/merryfolk/js/world.js:1158-1176`
- Merryfolk's 1× view relies on browser smoothing (`image-rendering: auto`). — `/Users/david/projects/merryfolk/css/style.css:849`
- Merryfolk's half-resolution villager is not a filtered copy. It is the original coarse grid redrawn (`c.lo = gridCanvas(grid, pal, 1, RS)`), so it is authored art at the lower level. — `/Users/david/projects/merryfolk/js/sprites.js:553-554`
- Tycho's GPU textures are `NEAREST` by default, with no mipmaps. — `/Users/david/projects/tycho/src/pixels/gpu.ts:249-252`
- Elsewhere's painter, `Ink`, keeps pictures as palette indexes, "so the limit is real and a world can be printed again in another palette", with eight inks to a frame. — `/Users/david/projects/elsewhere/CLAUDE.md` ("The look")

### Inferences
- **Why box mipmaps blur.** A 2×2 box filter replaces four pixels with their mean. On pixel art, where neighbors are often an outline ink and a fill ink, the mean is a new mid-tone found in neither, so the outline dissolves. Repeated levels compound the effect. That breaks Elsewhere's rules of eight inks and a dark outline. Inside Ink's palette-index pictures the average isn't even defined, which is a strong reason to downscale on indexes.
- **Recommended downscale operators for Ink pictures, from cheapest:**
  1. **Point sample:** a fixed corner of each 2×2 block. Crisp but aliased, and it flickers as the camera moves unless the sample grid is fixed in world space.
  2. **Mode, or "majority ink":** the most common index in each block. Stable and palette-safe, but it erases thin features (Minecraft's lesson).
  3. **Weighted mode:** like mode, but with per-ink priority, so outline, water edges and paths win ties or count double, and roads and rivers survive downscaling.
  4. **Semantic downscale:** compute each coarse pixel from the coarse world data (tile type to chart ink) rather than from the fine pixels. Always consistent and cheapest at region scale.
- **Impostors.** For far zoom, declare per object kind a tiny "far" stamp: tree = 2×2 (dark leaf plus outline), bush = 1 px, house = 3×2 roof ink, person = 1×2. Draw them on the chart chunk at generation time. This is the same idea as Merryfolk's `lo` copy and RimWorld's two icons: an authored representation per level rather than a filtered one.
- Merryfolk's 1× smoothing is an acceptable shortcut for a single half-size step. But in a palette-locked style like Elsewhere it would break the eight-ink rule, so Elsewhere should bake explicit half-size chunks (mode-filtered indexes) instead.

### Gaps
- I found no source that measures mode versus box versus point downscaling on game pixel art at runtime, or any shipped game's mipmap policy for sprites; the above rests on the Minecraft and Gerstner sources plus reasoning.
- Not researched: GPU-side approaches (sampling a lower-resolution "far" texture array), because Tycho's frame API excludes shaders.

---

## 4. Consistency across levels: the far color must match what is up close

### Takeaway
Consistency comes from generating every level from the same position-pure functions of the seed:
- noise at (x, y);
- a biome lookup from elevation and moisture;
- a hash for each object's placement.

The coarse level then evaluates the same functions on a coarser grid, or with the high-frequency octaves dropped, rather than painting something separately. Detail that only exists up close (single plants) should come from a hash keyed by cell, so the far level can compute its density, and therefore its average color, without placing each plant.

### Cited Findings
- Red Blob Games: "Let's mix big low frequency hills and small high frequency hills into the same map" (octaves). Biomes come from elevation plus moisture ("Low elevations are oceans and beaches. High elevations are rocky or snowy…"), and "The calculation of the biome at position (x,y) is independent of calculations at any other position." — [Red Blob Games, Making maps with noise](https://www.redblobgames.com/maps/terrain-from-noise/)
- Dwarf Fortress nests its scales exactly (world tile = 16×16 region tiles, region tile = 16×16 embark tiles, embark tile = 48×48 tiles). — [DF Wiki, Embark](https://dwarffortresswiki.org/index.php/DF2014:Embark)
- Tycho's painter makes each operation start "from its own seed, so strokes meet across chunk edges without seams and anything painted twice matches itself". — `/Users/david/projects/tycho/src/pixels/paint.ts:3-6`
- `Tycho.grid` fills chunks from the seed on first touch (`make`). — `/Users/david/projects/tycho/src/world/grid.ts:37-38`
- Merryfolk's sketch is already a coarse representation computed from the same tile map as the full painting: a per-tile color by type plus hashed mottle. So the placeholder matches the final picture's broad colors. — `/Users/david/projects/merryfolk/js/world.js:1187-1202`
- Minecraft Java's mode filter shows the failure mode: the most common block wins and minority features disappear from zoomed-out maps. — [Minecraft Wiki, Map](https://minecraft.wiki/w/Map)
- Distant Horizons generates low detail first and refines later. — [Modrinth changelog](https://modrinth.com/mod/distanthorizons/changelog?page=2)

### Inferences
- **Hierarchical generation recipe** (position-pure, deterministic under `ctx.rng`/`Tycho.seed`, as Elsewhere's CLAUDE.md requires):
  1. **Macro fields** (elevation, moisture, region or biome IDs) are evaluated at any resolution, using fewer octaves at coarse levels (for example, drop octaves whose wavelength is under about 2 coarse pixels). Truncated octaves change the coarse value very little, because high octaves have small amplitude. That keeps the far color close to the near average.
  2. **Tile layer:** the tile type at (tx, ty) is `classify(fields(tx, ty))`. Its chart color is the tile type's representative ink.
  3. **Object layer:** for each cell (say 4×4 tiles), a hash of (cell, seed) gives the count and positions of trees and plants. At far zoom, compute only the cell's density (the expected count is known without placing), and choose "forest ink" when the density passes a threshold. Up close, place the actual objects from the same hash. So a forest that reads dark green at far zoom shows trees exactly where the density said they would be.
  4. **Decoration layer** (grass tufts, flowers, pebbles) exists only at close zoom, like Merryfolk's short grass. Its contribution to the far color is approximated by the tile type's ink.
- **Pyramid versus direct.** A coarse chunk can be built from four finer chunks (exact, but it needs the fine chunks, which are expensive at region scale) or generated directly from the fields (cheap, and approximate only for features smaller than a coarse pixel).
  - Generate the far levels directly. Build the level just above full detail from real fine chunks when they are already cached, so the transition into close zoom is exact.
  - Features that must survive at every scale (rivers, roads, quest sites) should be vector or graph data (polylines, points) rasterized at each level with a minimum width of 1 px. Sampling them would let them alias away.
- A quadtree, where each level's tile is the parent of four children, keeps keys simple (`level, cx, cy`, with `cx >> 1` giving the parent) and lets "build parent from children" and "show parent until children are ready" work naturally.

### Gaps
- No game-specific source found describing exactly how a shipped 2D game keeps far-map colors consistent with close-up procedural content; the recipe above is a synthesis.
- Not researched: octave truncation error bounds, and specific quadtree terrain papers (Geometry Clipmaps, ROAM), because they target 3D meshes.

---

## 5. Chunk systems for infinite worlds

### Takeaway
Use power-of-two chunks keyed by (level, cx, cy), with a fixed pixel size per chunk at every level (for example 128–256 px), so a level-L chunk covers 2^L times the world span. Then:
- generate nearest-first under a per-frame millisecond budget, with sliced (generator) work;
- show a cheap placeholder at once (the parent level, or a flat sketch) and refine in place with a short fade;
- keep one LRU per level with a byte budget;
- make every chunk a pure function of position and seed, plus a margin for features that cross edges, so there are no seams.

Merryfolk and Tycho already cover the single-level case; what is missing is the level dimension and unbounded coordinates.

### Cited Findings
- **Chunk sizes in practice:**
  - Merryfolk: 16 tiles = 256 world px = a 512×512 canvas (`/Users/david/projects/merryfolk/js/world.js:1186`);
  - Tycho grid: 32 by default, must be a power of two (`/Users/david/projects/tycho/src/world/grid.ts:33`, `:81-82`);
  - Factorio: 32×32 tiles ([wiki](https://wiki.factorio.com/Chunk/zh));
  - web maps: 256 or 512 px tiles ([OSM](https://wiki.openstreetmap.org/wiki/Zoom_levels)).
- **Nearest-first under a budget:**
  - Merryfolk sorts by center distance and spends 2–28 ms a frame depending on urgency (`/Users/david/projects/merryfolk/js/world.js:1236-1257`; `/Users/david/projects/merryfolk/js/main.js:1308-1314`);
  - Tycho's `ahead()` makes the nearest missing chunk within ±3×±2 chunks, and more while a `budget` in ms lasts (`/Users/david/projects/tycho/src/pixels/paint.ts:250-271`);
  - Distant Horizons moved LOD updates to be "around the player instead of FIFO" ([Modrinth changelog](https://modrinth.com/mod/distanthorizons/changelog?page=2)).
- **Placeholder, then refine:**
  - Merryfolk's sketch, then the painting, faded in over about 0.33 s (`/Users/david/projects/merryfolk/js/world.js:1179-1202`, `:1250-1251`);
  - Distant Horizons' low detail first, higher later ([Modrinth changelog](https://modrinth.com/mod/distanthorizons/changelog?page=2)).
- **LRU:**
  - Merryfolk caps chunks at 112 and evicts by a `used` stamp, never one used this frame (`/Users/david/projects/merryfolk/js/world.js:1261-1266`);
  - Tycho's `Chunks` has `max` with `trim` (`/Users/david/projects/tycho/src/pixels/paint.ts:236-237`, `:273-280`).
- **Seams:**
  - Tycho runs every operation whose box touches a chunk, each from its own seed (`/Users/david/projects/tycho/src/pixels/paint.ts:186-192`);
  - Merryfolk reads whole-map arrays, indexes the dither by world coordinates, and repaints edits with a 96-px margin (`/Users/david/projects/merryfolk/js/world.js:1158-1175`, `:1300-1320`).
- **Memory per chunk:** 4 bytes per canvas pixel (Merryfolk's own readout, `/Users/david/projects/merryfolk/js/dev.js:121`).
- **Tile pyramid growth:** 4^zoom tiles per level ([OSM](https://wiki.openstreetmap.org/wiki/Zoom_levels)).

### Inferences
- **Sizing.** At a fixed chunk pixel size P, every level costs the same per chunk (P²×4 bytes; 256² is 256 KB, 128² is 64 KB). The number of chunks needed to fill a screen is also about the same at every level, roughly ⌈W/P+1⌉ × ⌈H/P+1⌉. For a 320×180 view with P = 128 that is 4×3 = 12 chunks visible per level, and about 30 with a one-chunk margin. A budget of 3 levels × about 64 chunks × 64 KB ≈ 12 MB, far below Merryfolk's 117 MB. Elsewhere's 320×180 native resolution makes multi-level caching cheap.
- **Pyramid totals.** If every level were fully resident for the same area, the coarser levels add at most 1/4 + 1/16 + … < 1/3 of the finest level's memory. Caching only what is near the view makes it cheaper still.
- **Generation order** within the budget:
  1. on-screen chunks at the current level, nearest first;
  2. the parent level's chunks covering the view, so a zoom-out has something to show;
  3. a one-chunk ring around the view at the current level;
  4. the child level's chunks at the view center, for zoom-in.
  
  Merryfolk's tiers (28/16/6/2 ms) are a good template: spend heavily only when "bare" placeholders are on screen.
- **Placeholder chain.** The ideal fallback for a missing chunk is the cached parent at level L+1, cropped and scaled up 2× by nearest-neighbor. That shows the right broad colors (by section 4's consistency) at no generation cost. If the parent is missing too, use a flat sketch from the macro fields (Merryfolk's approach). Fade in the real chunk over about 150–300 ms (Merryfolk uses about 330 ms after a sketch and 2 s for a season change).
- **Per-level LRU.** Give each level its own `Chunks` (or one cache keyed `L:cx:cy`) with a byte cap, and always protect the current frame's chunks and the parent chunks covering the view. Evict speculative look-ahead first, as Merryfolk does with `used = 0`.
- **Building a pyramid** from finer chunks is cheap with mode-downscaling of palette indexes (four children of P² each become one parent of P²), and should happen only when all four children are cached. Otherwise generate directly from the fields.
- **Seams in an endless world:**
  1. Make every per-pixel function position-pure (world coordinates in, never chunk-local).
  2. Give objects a declared footprint (Tycho's `Op` box) and let a chunk run every object whose box touches it. That needs object placement to be enumerable by cell, from hashes of neighboring cells.
  3. Index dither patterns and other textures by world coordinates.
  4. At coarse levels, snap object far-stamps to the coarse pixel grid in world space, so neighbors agree.
- **Tycho roadmap items** that follow:
  - `Chunks` with unbounded or negative coordinates (or an `inside` callback), a `level` dimension or one cache per level, a byte budget, and a true LRU;
  - sliced `make` (generators, as in Merryfolk's `paintGroundGen`) so one chunk can span several frames;
  - a `peekParent` / fallback hook for drawing;
  - a seen-mask store if a quest wants an explored chart.

### Gaps
- No measured benchmarks on mobile canvas-allocation cost or GPU texture-upload limits per frame for many small canvases versus a few big ones; this matters for choosing P on phones.
- Distant Horizons' cache sizes and eviction policy were not found in docs.

---

## 6. Transitions: integer steps vs continuous zoom, crossfades, crisp pixels at non-integer scale

### Takeaway
Integer (or 2^n) zoom steps keep pixel art perfectly crisp and are what Merryfolk and Elsewhere's view already do. Continuous zoom needs either:
- "sharp bilinear" scaling: nearest-neighbor up to the integer factor, smooth only at pixel boundaries, which a canvas can approximate as an integer upscale offscreen followed by a smoothed draw down;
- or brief continuous motion during the gesture, then a snap to the nearest step.

Between LOD levels, crossfade the two baked levels with `globalAlpha` over a short span. That is within Tycho's frame API.

### Cited Findings
- Merryfolk snaps zoom to even steps during the pinch itself (`snapZoom` on every move). Its one non-integer case (1×, a half-size view) uses browser smoothing. — `/Users/david/projects/merryfolk/js/main.js:1035-1040`, `:1082-1089`; `/Users/david/projects/merryfolk/css/style.css:849`
- Merryfolk crossfades a chunk's old and new paintings with `globalAlpha = fade`, over about 0.33 s after a sketch and 2 s after a season change, timed by the wall clock. — `/Users/david/projects/merryfolk/js/main.js:689-694`; `/Users/david/projects/merryfolk/js/world.js:1250-1251`
- Factorio players report non-integer map zoom steps (0.888, 1.110, 1.388) as less sharp than normal view. A developer reduced the step between the map and zoom-to-world so the switch felt less abrupt. — [Factorio forum p=448642](https://forums.factorio.com/viewtopic.php?p=448642); [Factorio forum p=276697](https://forums.factorio.com/viewtopic.php?p=276697)
- **Sharp bilinear:**
  - At non-integer scale, nearest-neighbor makes some source pixels wider than others ("wobble"). The fix blends only the screen pixels that straddle a source boundary. — [Godot Q&A, sharp bilinear](https://godotengine.org/qa/72525/how-to-apply-sharp-bilinear-filter-fix-pixel-wobble-pixel-art)
  - A sharp bilinear filter is nearest up to the integer factor and bilinear across the remainder, described as best for pixel art at non-integer sizes. — [CapView wiki, Scaling and sharpening](https://github.com/NuclearMeltdown/CapView/wiki/Scaling-and-sharpening)
  - A D3D11 approach keeps a bilinear sampler but emulates point sampling with antialiased fat-pixel edges in the shader. — [d7samurai gist](https://gist.github.com/d7samurai/9f17966ba6130a75d1bfb0f1894ed377)
- **No-shader version:** upscale with nearest-neighbor to the next integer size above the target, then downscale with bilinear. This gives nearly sharp pixels at any resolution. — [squirkel (LÖVE2D module)](https://zff.dev/thersgo/squirkel). A Hacker News commenter calls it equivalent to, for example, a 2× integer upscale then a 0.75× bilinear scale, and notes it works on GPUs without fragment shaders. — [HN discussion](https://hn.nuxt.dev/item/45555989)
- Elsewhere scales its view by whole steps with smoothing off. — `/Users/david/projects/elsewhere/js/view.js:1-10`, `:36`
- Tycho's GPU stand-in supports drawImage, `globalAlpha` and transforms, and its textures are `NEAREST` by default. — `/Users/david/projects/tycho/src/pixels/gpu.ts:1-5`, `:249-252`, `:798-801`

### Inferences
- **A workable Tycho scheme, "LOD bands with integer scales":**
  - Level L stores chunks at 1/2^L of full density (L = 0 is full art, 1 is half, 2 is quarter, … up to the chart at about 1 px per tile, which is L = 4 for 16-px tiles).
  - Each level is displayed only at integer magnifications (1×, 2×, 3× of its own pixels). The effective zoom ladder for a 16-px tile game could be: L0 at ×3, ×2, ×1; then L1 at ×1; then L2 at ×1; and so on. Each step halves the world px per screen px, so every frame is crisp and in the palette.
  - This is Merryfolk's ladder with the 1× smoothing replaced by a baked, palette-safe half level.
- **Continuous pinch:**
  - During the gesture, draw at the exact fractional scale using the sharp-bilinear trick. Render the current level at the next integer scale up to an offscreen canvas (with nearest-neighbor), then draw that onto the view with `imageSmoothingEnabled = true`.
  - On release, ease (about 150 ms) to the nearest band and switch back to pure nearest-neighbor.
  - This keeps the per-frame drawing to `drawImage` and transforms, as Elsewhere's rule requires. The smoothed scale only appears during motion, when blur is not noticed. A caveat: the smoothed resample is not palette-locked, so it should never be the resting state.
- **Crossfading levels.** When the zoom crosses a level boundary, draw the outgoing level and fade the incoming one in with `globalAlpha` 0 to 1 over about 150–250 ms. Merryfolk's chunk fade code is a ready model. Fade order: draw the coarse level opaque underneath and the fine level above with alpha, so holes in the not-yet-generated fine level show the coarse one.
- **Popping of semantic layers** (grass, people becoming icons) is best tied to the band switch, as Merryfolk does at its 1× step. Icons for people and quest sites should be constant screen size and drawn after the world, so they don't scale with the band.
- The camera should snap its position to the current level's pixel grid (Merryfolk snaps to half-pixels, `main.js:675-676`), or the coarse levels will shimmer as you pan.

### Gaps
- No source found on crossfading pixel-art LOD levels specifically in a shipped 2D game, other than Merryfolk's season and sketch fades.
- Not tested: whether mobile Safari and Chrome honor `imageSmoothingQuality` and `image-rendering` consistently for the sharp-bilinear trick, or how much the extra offscreen pass costs per frame on phones.

---

## 7. Touch controls: pinch anchored on the fingers, and wheel steps

### Takeaway
Anchor a zoom by recording the world point under the focus (the pinch midpoint or the cursor) at the start, then re-solve the camera after every zoom change: `cam = world - screen/zoom`. Compute stepped pinch zoom from the cumulative distance ratio since the gesture began, snapped to the nearest step (with optional hysteresis). Accumulate wheel input into a threshold, with a smaller threshold for trackpad pinch (`ctrlKey`). Merryfolk has all of this working.

### Cited Findings
- **Merryfolk pinch:** the midpoint and distance come from the two active touches. The start stores `d0 = max(20, d)`, `z0`, and the world point under the midpoint. Each move sets `z = snapZoom(z0 * d/d0)` and then "keep[s] the spot that was under the fingers under them": `cam.x = pinch.wx - m.x/zoom`. The same formula pans as the midpoint moves. — `/Users/david/projects/merryfolk/js/main.js:1071-1089`
- **Guards:** pinch is touch-only and never starts while a villager is carried. After a pinch, `pointer.pinched` suppresses taps and drags until every finger has lifted. A drag counts only after 6 px of travel. — `/Users/david/projects/merryfolk/js/main.js:1093-1099`, `:1107-1112`, `:1116`, `:1128-1133`
- **Taps:** fingertip hit-testing widens the target to about 22 screen px at any zoom (`pad = max(0, 22/zoom - 4)` world px). — `/Users/david/projects/merryfolk/js/main.js:1055-1058`
- **Wheel:** summed deltas (line mode ×40); one step per 60 units, or per 30 when `ctrlKey` (trackpad pinch); any single delta of 50 or more fires at once; anchored at the cursor. — `/Users/david/projects/merryfolk/js/main.js:1141-1151`
- Merryfolk also stops Safari from zooming the page when a pinch lands on the panels. — `/Users/david/projects/merryfolk/js/main.js:1175`
- **Tycho `Gestures`:** `onPinch(k, x, y, dx, dy)` gives a per-move ratio `k = d1/d0` (null under `pinchMin`), the midpoint, and the midpoint's movement if `pinchPan`. A pinch is never a tap (`moved = Infinity`), and a third pointer does nothing until there are two again. "The wheel's zoom is the game's own." — `/Users/david/projects/tycho/src/play/input.ts:333-353`, `:385-392`; `/Users/david/projects/tycho/docs/play.md:49`, `:58`
- Terraria zooms its map with the mouse wheel in full-screen mode and with +/− buttons, and a button returns to the default scale. — [Terraria Wiki, Minimap](https://terraria.wiki.gg/wiki/Minimap)

### Inferences
- With Tycho's per-move `k`, a game must multiply the `k` values (`scale *= k`) to get a continuous zoom, then snap for display. Snapping each move's tiny `k` directly would never leave the current step. A `pinchStart`/`d0` in the callback, or a `scale` accumulator, would be a small, general Tycho option.
- **Hysteresis:** snapping at the midpoint between steps can flicker when the fingers hover near a boundary. Switch steps only after the continuous scale passes about 10–15% beyond the midpoint, or use a log-scale distance. Merryfolk's `snapZoom` snaps to the nearest step in linear terms, which biases toward larger steps because the gaps (1, 2, 4, 6, 8) are uneven. Snapping in log space treats ratios evenly.
- **Continuous-during-gesture** zoom (section 6) can reuse the same anchor math with the unsnapped scale, then animate to the snapped band on release, keeping the anchor fixed during the ease.
- **Phone defaults:** keep on-screen −/+ buttons (Merryfolk's phone bar has them, `/Users/david/projects/merryfolk/README.md:125`) for one-handed play, and make a double-tap step the zoom about the tap point. The double-tap is an idea, not seen in the sources.

### Gaps
- No external source found on pinch hysteresis or anchor math in shipped games; this section rests on the local code and standard geometry.
