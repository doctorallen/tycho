# Real geography

How real land is made, and how a game can make it the same way, in the same order: plates and uplift raise the land, rivers cut it down, water fills what's left, wind and height set the climate, the climate sets the biomes, and people settle, walk and clear the land last. Every serious whole-map generator, from Dwarf Fortress to mapgen4, converges on one cheap backbone. Priority-flood fills depressions and orders every cell in O(n log n), flow accumulation is one reverse pass, an implicit stream-power solve carves the valleys, and one sorted sweep along the wind makes a rain shadow. At 256×256 the whole pipeline takes about half a second of plain JS on a laptop, so a seeded quest-sized world can be generated on a phone in a worker. Only full erosion to equilibrium has to be precomputed or moved onto the GPU. Settlements, paths and trees then go where real ones would, by scoring sites (Emilien 2012), costing every step (Tobler, Galin) and reading habitat (Cordonnier, Merryfolk): that's [the next page](settling.md).

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md).

Text marked *(inference)* is reasoning from the sources, not a sourced fact. Times marked "bench" were measured for the notes with [world_generation_bench.js](notes/world_generation_bench.js): Node v26.8.1 on a 2019 Intel i9-9880H laptop at 2.3 GHz, one thread, typed arrays, 8-neighbor grids. No phone was measured.

<figure class="demo"><div class="stage" data-demo="geo-world"></div>
<figcaption><b>A world made the way the land is.</b> Plates collide and raise ranges, rivers carve them down, and the wind leaves deserts behind the mountains, built in stages you watch: the tabs show the height before erosion, the plates, erosion, water, temperature, rain, biomes, soil and the final map. Villages settle by water on sunny, sheltered flats, and roads join them along the easiest ground. The <i>Rock</i> tab shows the rock the plates left: basalt, granite, and a folded layer cake of limestone, sandstone and shale. Tap anywhere to walk into that place in 3/4 view: cliffs banded with the beds they cut, waterfalls, a village shaped by its site, trees by habitat with blended edges, and under <i>Underground</i> the caves that rock makes: karst passages draining to springs, lava tubes, sea caves. <i>Show scores</i> heats the village sites. Drag and pinch to move round a region; New seed makes another world.</figcaption></figure>

The demo's limits, plainly:
- **Timing:** the world takes about 0.77 s of work (1.3 s on the clock) on a desktop: plates about 260 ms, 16 erosion steps about 325 ms, the rest about 190 ms. A region takes 0.09 to 0.42 s, 0.2 s typically; the first one also paints the plant sprites. No phone was measured.
- **Height:** a region's terrace height adapts to it (20 to 300 m a step), so neighboring regions don't share one scale.
- **Rain:** it is scaled to a percentile, so every world has both wet and dry land.
- **Caves:** they're two levels of one-tile passages, drawn as a cutaway: no spongework or ramiform caves, no shafts below the sinkholes, no talus or glacier caves ([caves](#caves-made-by-the-rock)).
- **Rock:** the layer cake is the same everywhere a bed's height is the same; there's no metamorphic rock, and basalt runs all the way down.
- (Fixed: villages now take a form from their site, caves come from the rock and the water table, and biome edges follow the climate instead of the world grid; see [the settlements page](settling.md) and the note [caves_villages_edges.md](notes/caves_villages_edges.md).)

- [Landmass and plates](#landmass-and-plates)
- [Uplift and erosion](#uplift-and-erosion)
- [Water: rivers, lakes and oceans](#water-rivers-lakes-and-oceans)
- [Climate and biomes](#climate-and-biomes)
- [Caves and rock](#caves-and-rock)
- [Caves made by the rock](#caves-made-by-the-rock)
- [What fits on a phone, and what to precompute](#what-fits-on-a-phone-and-what-to-precompute)
- [What Tycho would need](#what-tycho-would-need)
- [Sources](#sources)

## Landmass and plates

World generators come in two families:

| Family | Examples | How | What it gives |
|---|---|---|---|
| Field and threshold | Minecraft 1.18+, Terrafirmacraft's layers, Vintage Story's strata | Noise and splines evaluated per point, with no global pass | Worlds that stream forever, but no real drainage: Minecraft's "rivers" are just the valleys band of a noise |
| Whole-map simulator | Dwarf Fortress, O'Leary, Azgaar, mapgen4, WorldEngine, Undiscovered Worlds | A bounded map, then global passes: depression filling, flow accumulation, wind sweeps | Rivers that join and reach the sea |

A bounded phone world, such as a quest's island, belongs in the second family *(inference)*. Almost all of them fake erosion cheaply, and the physically based tools (WorldEngine's plate simulation) are slow and run offline.

### Dwarf Fortress, stage by stage

Dwarf Fortress doesn't paint biomes. It generates six coarse fields, fills them fractally, derives biomes from thresholds, carves rivers, recomputes the climate from the final terrain, and throws the world away if it fails its checks. Tarn Adams gives the order ([Gamasutra Q&A](https://gamasutra.com/design/q-a-dissecting-the-development-of-i-dwarf-fortress-i-with-creator-tarn-adams), quoted on the [DF wiki](https://dwarffortresswiki.org/index.php/DF2014:World_generation)), and this page follows it:

1. **Fields.** Allocate the map and choose the poles. "The basic map field values (elevation, rainfall, temperature, drainage, volcanism, wildness) are seeded along a grid of variable size, respecting various settings (oceans, island sizes, other variances, etc.), and then filled in fractally." The poles vary temperature, and points are picked for the highest peaks. A first check "attempts to adjust some altitudes to fit the map within the desired parameters if it missed. The world can be rejected at this point if it is unfixable."
2. **First biomes.** Vegetation, the first derived field, is set from elevation, rainfall and temperature, and the biomes are tested. "The mid-level elevations are smoothed at this point to make more plains areas, and volcanoes are placed respecting the hot spots in the volcanism field."
3. **Erosion and rivers.** "Small oceans are dried out, and it locates edges of mountain sides where it can run test rivers ... Many fake rivers flow downward from these points, carving channels in the elevation field if they can't find a path to the sea. Extreme elevations differences are often smoothed here so that everything isn't canyons. Ideally we'd use mineral types for that, but we don't yet. Lakes are grown out at several points along the rivers."
4. **Climate again.** "Elevations are smoothed again from the mountains down to the sea ... Now that the elevations are finalized, it makes adjustments to rainfall based on rain shadows and orographic precipitation. Temperatures are reset based on elevation and rainfall and the dampening effects of forests, and it uses the new values to set the vegetation level one final time. Salinity values are set for the ocean and tiles neighboring the ocean."
5. **Regions, rock and history.** Biome regions are found and named; geological and underground layers are added ("though the geological stuff should really be earlier"); "a final verification process against the parameters" runs; wildlife and weather are seeded. Then "Civilizations and caves are placed ... there's a giant zero-player strategy game going on with somewhat loose turn rules and bad AI (but thousands of agents), and history is just a record of that."

The exact date of the Q&A couldn't be confirmed; the wiki cites gamasutra.com/view/news/343859. In 2008 Adams told John Harris that elevation came from midpoint displacement, temperature was biased by elevation and latitude, drainage was a fractal 0–100 field, and salinity was 100 at the oceans, tapering quickly over land. He noted that midpoint displacement leaves artifacts, which erosion later addresses ([Game Developer, 2008](https://www.gamedeveloper.com/design/interview-the-making-of-dwarf-fortress)). A 2014 Polygon account, paraphrased by Isegoria, adds a separate fractal for mineral strata, rivers carving valleys "only after biomes exist", a salinity pass for deltas and mangroves, and region names from four cultures ([Isegoria, 2014](https://www.isegoria.net/?p=35819)).

The order is the part worth copying. The climate is computed twice: once roughly to pick and test biomes, and again after erosion, so rain shadows follow the final mountains *(inference)*.

The grid is tiny. Worlds are 17, 33, 65, 129 or 257 squares a side (Pocket to Large); 257×257 is 66,049 squares. Detail comes only at embark, where each square expands to 16×16 local blocks of 48×48 tiles. In the wiki's words, "the essential factor for the gen duration is the history", not the map ([DF wiki, Advanced world generation](https://dwarffortresswiki.org/index.php/DF2014:Advanced_world_generation)). Each field is a token `[FIELD:min:max:xVariance:yVariance]`:

| Field | Example | Range and notes |
|---|---|---|
| Elevation | `ELEVATION:1:400:401:401` | 0–400 |
| Rainfall | `RAINFALL:0:100:200:200` | |
| Temperature | `TEMPERATURE:25:75:200:200` | −1000 to 1000 |
| Drainage | `DRAINAGE:0:100:200:200` | |
| Volcanism | `VOLCANISM:1:100:200:200` | |
| Savagery | `SAVAGERY:1:100:200:200` | |

Variance runs 0–3200 and sets how wildly a value can differ between adjacent squares, per axis. Setting only one axis high gives bands; both at 0 give a single value everywhere. Under the noise sits a mesh of "weighted ranges", `[ELEVATION_FREQUENCY:mesh:w0-20:w20-40:w40-60:w60-80:w80-100]`, for example `ELEVATION_FREQUENCY:2:1:2:3:4:5`. Mesh 1 means ignore, 2 is 2×2, up to 6 for 32×32, limited by world size; the finest mesh always makes grid cells of 8×8 world squares. The steps are: make the grid, set its intersections to random values drawn from the five weighted bands, "smooth out the area between the intersection points", then "add noise according to the variance parameters". A large enough variance swamps the mesh, and the effect depends on the mesh count, not the cell size. The poles are `POLE:NONE|NORTH|SOUTH|NORTH_AND_SOUTH|NORTH_OR_SOUTH|NORTH_AND_OR_SOUTH`, with the equator at the opposite edge or the middle; latitude can shift temperature by more than 75 °C (the wiki marks the exact values "unsure") ([DF wiki](https://dwarffortresswiki.org/index.php/DF2014:Advanced_world_generation)). No primary source gives DF's exact fractal routine, roughness falloff or river-dig depth.

### Other ways to raise land

| Generator | Cells | Base height |
|---|---|---|
| Minecraft 1.18+ | Every block | A 3D density per block (> 0 is solid), squeezed with altitude by a height bias. Continentalness, erosion and peaks-and-valleys (PV) map through splines to a height **offset** and a vertical stretch **factor**, and the same noises pick the biome, so terrain and biome agree. PV = 1 − \|3·\|weirdness\| − 2\|: valleys below −0.85, low below −0.2, mid below 0.2, high below 0.7, then peaks ([Minecraft Wiki](https://minecraft.wiki/w/World_generation)) |
| O'Leary, "Generating fantasy maps" | 16,384 points, one round of Lloyd relaxation, a Voronoi mesh | A sum of primitives (a random tilted slope, a cone, 50 random "mountain" blobs), 10 rounds of neighbor averaging, then "peaky" square-root sharpening ([mewo2/terrain](https://github.com/mewo2/terrain/blob/master/terrain.js)). The essay page returned 404 when fetched; the source is the record |
| Azgaar's Fantasy Map Generator | A jittered lattice (jitter 0–0.9, default 0.9); the FAQ says "set Points number to 10K" for performance, and several constants scale by (points/10000)^0.25 | Templates of blob primitives (Hill, Pit, Range, Trough, Strait, Add, Multiply, Smooth, Invert), each with a count, a height (0–100, with 20 as sea level) and x and y placement ranges in percent ([Advanced options](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Advanced-options); [Knowledge Base](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Knowledge-Base); [template editor](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Heightmap-template-editor)) |
| mapgen4 (Amit Patel, 2018) | **Precomputed** points loaded from `build/points-5.5.data`: Poisson disc at spacing 5.5 in a 1000×1000 square, plus mountain peaks at spacing 35, triangulated by Delaunator. The code supports 1 million+ cells (spacing 0.7), but "the rendering code and other parameters are designed to look prettiest around 25k cells" | A painted constraint map (bilinear) plus coastline noise. On land, low simplex "hills" (there to make rivers meander) mix with "mountains" from a jittered BFS distance-from-peak field, em = 1 − slope/sharpness·distance, weighted by e². Six simplex octaves are precomputed per triangle once per seed ([mesh.ts](https://github.com/redblobgames/mapgen4/blob/master/mesh.ts); [config.js](https://github.com/redblobgames/mapgen4/blob/master/config.js); [README](https://github.com/redblobgames/mapgen4/blob/master/README.org); [map.ts](https://github.com/redblobgames/mapgen4/blob/master/map.ts)) |

Minecraft's spline trick is the cheapest good-looking idea here, and it suits a phone. Three low-frequency 2D noises through hand-tuned piecewise-linear splines give coasts, plains and jagged peaks for a few noise samples per cell, and the same values pick biomes. It gives no connected rivers, so pair it with one priority-flood pass *(inference)*. The exact spline control points live in the game's `noise_settings` data and weren't extracted. Henrik Kniberg's talk on the 1.18 generator is "Minecraft terrain generation in a nutshell" (6 Feb 2022) ([YouTube](https://www.youtube.com/watch?v=CSa5O6knuwI)).

Island masks push the edges down. Red Blob gives d = 1 − (1 − nx²)(1 − ny²) (a square bump) or d = min(1, (nx² + ny²)/√2), then e = lerp(e, 1 − d, mix) ([Red Blob, making maps with noise](https://www.redblobgames.com/maps/terrain-from-noise/)). mapgen4 adds coastline noise weighted by (1 − e⁴), so it acts mostly near the shore ([map.ts](https://github.com/redblobgames/mapgen4/blob/master/map.ts)).

### Plates

| Approach | How | Cost |
|---|---|---|
| WorldEngine | Elevation from pyplatec, a C plate-tectonics simulation (defaults: 10 plates, 2 cycles, erosion_period 60, folding_ratio 0.02, aggr_overlap_rel 0.33, sea_level 0.65); then 8-octave simplex; the land centered by rolling the map to put the least land at the borders; borders faded to ocean over min(30, size/5) cells; the shallow ocean floor flattened. Hills and mountains are the top 10% and 3% of heights by quantile ([plates.py](https://github.com/Mindwerks/worldengine/blob/master/worldengine/plates.py); [generation.py](https://github.com/Mindwerks/worldengine/blob/master/worldengine/generation.py)) | The README warns generation "could take a few minutes" ([WorldEngine](https://github.com/Mindwerks/worldengine)) |
| Frozen Fractal, "Around the World" (2023) | Plates grown from continent Voronoi regions by simultaneous flood fill (about 15 plates for 6 continents), with random velocities. Boundaries are classed only as converging or diverging (transforms dropped), and boundary type × crust type picks a noisy profile curve: mountains (continent meets continent, taller with speed), rift valleys, mid-ocean ridges, island arcs, trenches with volcanic arcs ([Frozen Fractal, 2023](https://frozenfractal.com/blog/2023/11/13/around-the-world-2-plate-tectonics/)) | A flood fill and a profile lookup per boundary cell |
| Undiscovered Worlds (Jonathan Hill) | Global maps of 512×257, 1024×513 or 2048×1025 pixels at "roughly 16km" per pixel; regional maps at about 1 km per pixel on demand; "tectonic" (Earthlike continents and ranges) or "non-tectonic" terrain; mountain ranges a separate layer from elevation; monthly temperature and precipitation per point ([blog](https://undiscoveredworlds.blogspot.com/2019/01/what-is-undiscovered-worlds.html); [GitHub](https://github.com/fegennari/Undiscovered_Worlds)) | A perfect climate simulation "would require a lot more processing power and time than I have available"; "Rivers and lakes occasionally go haywire." In December 2025, rivers and lakes were "more or less" working, rift lakes had a simpler method, and hydraulic erosion was only being considered ([blog, Dec 2025](https://undiscoveredworlds.blogspot.com/2025/12/springs-and-valleys.html), via search summary) |

Cordonnier's method, next, skips plates: the user paints the uplift directly. WorldEngine's platec internals (Viitanen's thesis) and Undiscovered Worlds' algorithms weren't read.

## Uplift and erosion

### The stream-power law

Land is raised by uplift and cut by rivers in proportion to how much water drains through a point and how steep it is. Cordonnier et al. write it as **dh/dt = u(p) − k·A(p)^m·s(p)^n**: uplift minus fluvial erosion, with A the drainage area and s the slope. "As in most geomorphological studies, we use n = 1 and m = 0.5" (m/n ≈ 0.5 is constrained by stream profiles) ([Cordonnier et al. 2016](https://www.cs.purdue.edu/homes/bbenes/papers/Cordonier16CGF.pdf)).

Their method places Poisson-disc nodes on a Delaunay graph, and the user paints an uplift map. Each step builds stream trees, with each node's receiver its steepest downhill neighbor. Then it sums Voronoi cell areas from the leaves to the roots for the drainage area, and solves the implicit update

h_i(t+δt) = (h_i(t) + δt·(u_i + k·A_i^m·h_j(t+δt)/‖p_i − p_j‖)) / (1 + k·A_i^m·δt/‖p_i − p_j‖)

which needs the receiver j solved first, so nodes are visited in stream-tree order. Lakes (internal roots) are joined by a lake graph in O(N + M log M), with M lakes ≪ N, instead of Braun and Willett's optional O(N√N) step. Braun and Willett 2013, the O(n) implicit solver itself, wasn't fetched; its use and complexity are cited through Cordonnier.

Their parameters: a 50×50 km terrain, maximum uplift U = 5.0e-4 m/yr, k = 5.61e-7 /yr (for peaks of about 2000 m), δt = 2.5e5 years. "Convergence is obtained after around 200 time steps", and thanks to the implicit solve the step count "does not depend on the resolution". Timings on a 3 GHz Core i7, single thread, which they "did not fully optimize" (§6 and Table 1):

| Samples | Per step | To converge |
|---|---|---|
| 10,000 | 0.031 s | 6.4 s |
| 40,000 | 0.177 s | 35.4 s |
| 90,000 | 0.401 s | 78 s |
| 160,000 | 1.273 s | 252 s |

In plain JS the same implicit solve (flood, accumulate, solve) costs 31 / 118 ms for the first step at 256² / 512², and 289 / 1015 ms for 20 steps, about 14 / 50 ms per step (bench).

### Stream power for the GPU

Schott, Paris, Fournier, Guérin and Galin (ACM TOG 2023) made stream power an authoring tool. The user paints uplift, fluvial erosion is "continuously simulated through the Stream Power Equation", and "a fast yet accurate approximation of drainage area and flow routing" keeps it interactive, with copy-paste, warping for folds and faults, and point and curve elevation constraints ([project page](https://h-schott.github.io/p/uplift); [StreamPowerErosion](https://github.com/H-Schott/StreamPowerErosion)). The released code is an OpenGL 4.5 compute shader (8×8 work groups, ping-pong buffers). Per cell, per step ([spe_shader.glsl](https://github.com/H-Schott/StreamPowerErosion/blob/main/data/shaders/spe_shader.glsl)):

- **Drainage area** = cell area + Σ neighbor area × (the neighbor's slope share toward this cell)^p_flow. This is multiple-flow routing read from the *previous* step, so area propagates one cell per step.
- **Erosion** = k·noise·A^0.8·s^2.0 along the steepest receiver, plus hillslope diffusion k_h·∇²h, plus an optional debris term k_d·s.
- The new height is clamped no lower than the receiver, then + dt·uplift. Border cells are fixed at 0.

| Parameter | uplift | k | k_d | k_h | p_sa (m) | p_sl (n) | dt | p_flow |
|---|---|---|---|---|---|---|---|---|
| Default | 0.03 | 0.0005 | 10 | 200 | 0.8 | 2.0 | 50 | 1 |

The paper's own GPU timings couldn't be retrieved (HAL blocked the fetch; ACM is paywalled). Ported to a CPU loop, the kernel costs 39 / 129 ms per step at 256² / 512², and 2.8 / 10.5 s for 100 steps (bench). That is about twice the implicit solver per step, and it needs at least as many steps as the grid is wide before drainage area reaches the outlets. So it fits Tycho only on `Tycho.gpu`: each cell reads only its 8 neighbors, which maps onto a fragment-shader ping-pong, and with float render targets thousands of steps per second at 256² are plausible *(inference, not measured)*.

### Cheap erosion, as games do it

| Generator | Erosion |
|---|---|
| O'Leary | rate = min(200, 1000·√flux·slope + slope²), river incision plus creep, normalized to the maximum and scaled by a random amount from 0 to 0.1; run 5 times, filling sinks between ([mewo2/terrain](https://github.com/mewo2/terrain/blob/master/terrain.js)) |
| Azgaar | An optional one-pass downcut: cells above height 35 are lowered by floor(flux / mean flux of higher neighbors), at most 5 ([river-generator.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/river-generator.ts)) |
| mapgen4 | None: where a trunk river is higher than its tributary, its elevation is lowered to match ([map.ts](https://github.com/redblobgames/mapgen4/blob/master/map.ts)) |
| Dwarf Fortress | Fake rivers dig when stuck. `EROSION_CYCLE_COUNT:250` (0–1000; higher is less jagged with wider rivers, and the maximum dissolves mountains into plains and causes rejections); `RIVER_MINS:200:400` (pre-erosion minimum and post-erosion desired river starts, 0–800; "Extremely high pre-erosion values speed erosion greatly"); `PERIODICALLY_ERODE_EXTREMES:1` turns impassable cliffs into ramps ([DF wiki](https://dwarffortresswiki.org/index.php/DF2014:Advanced_world_generation)) |

DF's "fake rivers dig when stuck" is an ad hoc stand-in for depression filling, which priority-flood does deterministically in one pass *(inference)*.

### Droplets

Droplet erosion is the detail pass: gullies and sediment fans. In Beyer's 2015 TU München bachelor's thesis, each drop carries a direction, speed, water and sediment, reading height and gradient by bilinear interpolation. Its capacity is max(−Δh, minSlope)·speed·water·p_capacity. Under capacity it erodes over a radius; over capacity it deposits bilinearly at its current point, with no radius, so pits fill. The change map can be blurred and blended by a factor b ([Beyer 2015](https://ardordeosis.github.io/implementation-of-a-method-for-hydraulic-erosion/thesis-beyer.pdf)). His timings, on a 3.2 GHz Core i5-3470 with inertia 0.3, capacity 8, deposition 0.2, erosion 0.7, evaporation 0.02, minSlope 0.01, gravity 10, radius 4 and maxPath 64:

| Map | Drops | Radius | Time |
|---|---|---|---|
| 256×256 | 10,000 | 4 | 2.27 s |
| 256×256 | 100,000 | 4 | 32 s |
| 2048×2048 | 100,000 | 4 | 43.8 s |
| 256×256 | 10,000 | 1 / 2 / 4 / 6 / 8 | 0.48 / 0.83 / 2.27 / 5.51 / 9.69 s |

Time barely depends on map size but grows with radius². About 16,500 of 100,000 drops ran off a 256×256 map.

| Implementation | Defaults |
|---|---|
| Sebastian Lague's Unity port | Map 255×255, 50,000 droplets, brush radius 3, inertia 0.05, sedimentCapacityFactor 4 (3 in the generator), minSedimentCapacity 0.01, erodeSpeed 0.3, depositSpeed 0.3, evaporateSpeed 0.01, gravity 4, maxDropletLifetime 30, initial water 1 and speed 1; brush weights precomputed per cell; a compute-shader version too ([SebLague/Hydraulic-Erosion](https://github.com/SebLague/Hydraulic-Erosion)) |
| Erodr (C, Beyer's algorithm) | 70,000 particles, ttl 32, radius 2, gravity 1, inertia 0.3, capacity 8, evaporation 0.02, erosion 0.7, deposition 0.3, min slope 0.0001 ([henrikglass/erodr](https://github.com/henrikglass/erodr)) |

In JS, 0.5 droplets per cell with Lague's defaults and a radius-3 brush (33k / 131k droplets) costs 128 / 445 ms at 256² / 512², about 4 µs a droplet (bench). That is about two orders of magnitude faster than Beyer's table, and the gap is implementation (precomputed brush offsets and weights, typed arrays, a shorter life) more than language. So budget droplets by droplets × life × brush cells *(inference)*.

### Thermal erosion

Thermal erosion moves material from a cell to lower neighbors while the height difference exceeds the talus angle, the steepest stable slope for that material, which evens out sharp changes. Olsen (2004) described speed-ups for real-time game maps ([Smelik et al. 2009](https://publications.graphics.tudelft.nl/rails/active_storage/blobs/redirect/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBBcmtLIiwiZXhwIjpudWxsLCJwdXIiOiJibG9iX2lkIn19--a99ce149fd6820493fdcb22b4f4b5e3cccbd976e/SDGTB09a.pdf)). The Olsen constants quoted across blog posts (talus T = 4/N for an N-cell map, move half the excess, about 50 iterations) are folklore here: they couldn't be checked against the paper, and the bench uses that form with a hand-picked T. Fifty iterations with a 4-neighbor talus cost 86 / 318 ms at 256² / 512² (bench). Schott's shader folds hillslope processes into the stream-power step as Laplacian diffusion (k_h) plus a debris term (k_d), a cheaper continuous stand-in for talus moves.

### The order for a phone

On a CPU-only phone build the order of work is *(inference)*:

1. A noise or spline base.
2. Priority-flood.
3. 10 to 40 implicit stream-power steps, at a δt large enough to converge fast.
4. 0.25 to 0.5 droplets per cell for gullies.
5. Thermal or Laplacian smoothing for talus.
6. The wind sweep, then the biome lookup.

Cordonnier's 200 steps to steady state are about 3 s at 256² in JS, too slow for a phone. Start instead from terrain already near equilibrium (noise shaped like ridges), or run on a coarse 128² grid, at roughly a quarter of the cost, and upsample *(inference)*.

## Water: rivers, lakes and oceans

### Priority-flood

Barnes, Lehman and Mulla's priority-flood fills depressions and is "optimal for both integer and floating-point data, working in O(n) and O(n lg n) time, respectively". An improved variant, with a plain FIFO queue inside depressions and a priority queue elsewhere, is O(m lg m) with m ≤ n and ran "up to 37% faster"; a parallel version of an older algorithm needed six processors to match it on one. It "can also be adapted to label watersheds and determine flow directions", with epsilon increments or by carving ([Barnes et al. 2014](https://arxiv.org/abs/1511.04463)).

mapgen4 uses exactly this shape on its triangles: a priority queue seeded with ocean walks uphill in elevation order, which gives every triangle a downslope side and a topological order ([map.ts](https://github.com/redblobgames/mapgen4/blob/master/map.ts)). O'Leary used iterative Planchon–Darboux filling instead, repeating full sweeps until nothing changes with epsilon 1e-5, and Azgaar iterates lake-raising passes. Both are cheaper to write but have no tight bound ([mewo2/terrain](https://github.com/mewo2/terrain/blob/master/terrain.js); [river-generator.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/river-generator.ts)). Merryfolk runs it on its tile map: the heap is seeded with the river, the pond and the map border, every cell filled to at least its parent + 1e-5, then each cell sends its flow to its lowest neighbor in reverse flood order ([Merryfolk terrain.js](https://github.com/doctorallen/merryfolk/blob/main/js/terrain.js)).

| Kernel (bench) | 256² | 512² |
|---|---|---|
| Priority-flood with epsilon fill and a binary heap, also recording receivers and flood order | 15.8 ms | 55.9 ms |
| Flow accumulation in reverse flood order | 1.2 ms | 2.7 ms |
| D8 steepest receivers plus sort-by-height accumulation (the textbook way) | 25.1 ms | 99.8 ms |

The flood order makes accumulation one O(n) pass: 1.2 ms against 25 ms for the sort-based way at 256².

### Rivers

| Generator | Rivers |
|---|---|
| mapgen4 | Flow = flow_param·moisture² per land triangle, summed in reverse flood order; trunk beds lowered to their tributaries ([map.ts](https://github.com/redblobgames/mapgen4/blob/master/map.ts)) |
| Azgaar | Land cells sorted high to low accumulate precipitation flux; a river forms at flux ≥ 30, navigable at ≥ 100 ([river-generator.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/river-generator.ts)) |
| WorldEngine | Rivers from flow sources above `RIVER_TH = 0.02`; rivers erode; sinks with no path to the sea become lakes ([simulations](https://github.com/Mindwerks/worldengine/tree/master/worldengine/simulations)) |
| Dwarf Fortress (2008) | Pick mountain bases (squares above an elevation), run temporary paths downhill, digging when stuck, until they reach the ocean; run real rivers along the best channels, force paths for those that fail, bulge out some lakes, apply loop-erasure; flow amounts decide tributaries; rivers are named; invisible brooks are added ([Game Developer, 2008](https://www.gamedeveloper.com/design/interview-the-making-of-dwarf-fortress)). Rivers are placed only if the elevation maximum is at least 104 ([DF wiki](https://dwarffortresswiki.org/index.php/DF2014:Advanced_world_generation)) |
| Minecraft | No flow at all: rivers occur where PV is "Valleys" at low continentalness or high erosion ([Minecraft Wiki](https://minecraft.wiki/w/World_generation)) |

### Lakes

With priority-flood, a lake's depth is just the filled height minus the original height, and the fill surface is the lake level. Cordonnier treats lakes as internal root nodes and routes their overflow through the lowest saddle ([Cordonnier et al. 2016 §4.3](https://www.cs.purdue.edu/homes/bbenes/papers/Cordonier16CGF.pdf)).

Closed (endorheic) lakes come from a water balance. Azgaar resolves depressions iteratively, raising lakes to their lowest shore + 0.2 and closing deep ones as endorheic after 75–85% of the allowed iterations. A lake drains through its lowest shore cell only if inflow (shoreline precipitation plus rivers) exceeds evaporation, estimated by a Penman-like formula of temperature and altitude. Lake subtypes are freshwater, salt, dry, sinkhole, frozen and lava ([lakes.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/lakes.ts); [river-generator.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/river-generator.ts); [Geographical features](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Geographical-Features-Overview)). Dwarf Fortress grows lakes at several points along its rivers and bulges some out.

### Oceans and coasts

- **Sea level.** O'Leary sets it at a random 20–60% height quantile; Azgaar fixes it at height 20 of 100; WorldEngine's plate default is 0.65; DF's ocean is elevation 0–99 of 400, and it dries out small oceans.
- **Shelves.** WorldEngine flattens the ocean floor, compressing values above and below a mid-depth toward it by a factor of 5, and scales sea depth by distance to land (factors 0, 0.3, 0.5, 0.7, 0.9 for 1 to 5 cells out, then anti-aliased), which makes a shelf. Oceans are flood-filled from the map edges, so inland low spots aren't sea ([generation.py](https://github.com/Mindwerks/worldengine/blob/master/worldengine/generation.py)). Minecraft's continentalness bands act as a shelf profile: mushroom fields −1.2 to −1.05, deep ocean to −0.455, ocean to −0.19, coast to −0.11, near-inland to 0.03, mid-inland to 0.3, far-inland to 1.0, each with spline-driven height offsets ([Minecraft Wiki](https://minecraft.wiki/w/World_generation)).
- **Salt.** DF sets salinity for the ocean and the tiles beside it, which a later pass reads for deltas and mangroves.

## Climate and biomes

### Temperature

Azgaar sets sea-level temperature by latitude, with tropics from 16° N to 20° S at 0.15 °C per degree and a linear fall to the poles, then subtracts 6.5 °C per km of altitude ([temperature-generator.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/temperature-generator.ts)). Cordonnier et al. use the same lapse rate, θ(p) = θ̄ − 0.0065·elevation in meters ([Cordonnier et al. 2017](https://cs.purdue.edu/homes/bbenes/papers/Cordonnier17ToG.pdf)). DF resets temperature after erosion from elevation, rainfall and "the dampening effects of forests". For a quest-sized island, one prevailing wind plus a 6.5 °C/km lapse rate is enough *(inference)*.

### Wind, rain and the rain shadow

The rain is one sorted sweep along the wind. Humidity is carried from upwind neighbors, gained over water, and capped by height or lost on climbing slopes as orographic rain, so the lee side is dry.

- **mapgen4.** Sort regions once by position along the wind vector, cos θ·x + sin θ·y, and visit them in that order. Humidity is the mean of the upwind neighbors; boundary regions have humidity 1; the ocean adds evaporation in proportion to depth. If humidity > 1 − elevation, the excess times `rain_shadow` falls as orographic rain and is removed. Then rainfall += raininess·humidity. It's one pass, O(n) after the sort ([map.ts](https://github.com/redblobgames/mapgen4/blob/master/map.ts); [Patel, mapgen4 rainfall](https://simblob.blogspot.com/2018/09/mapgen4-rainfall.html)). Patel's caveat: the straight-line wind is fast but leaks moisture through passes, "a green strip in a desert", and at the time he didn't know how to choose forest, grassland or desert from it.
- **Azgaar.** "The simplest precipitation model: winds enter the map from each side and drop humidity as they pass the cells." Wind direction is set per 30° latitude tier, and the humidity cap is scaled by a modifier per 5° of latitude, [4, 2, 2, 2, 1, 1, 2, 2, 2, 2, 3, 3, 2, 2, 1, 1, 1, 0.5] (the Hadley, Ferrel and polar cells). Over water the wind gains humidity, and coastal cells get a burst. On land it rains max(humidity/(10·mod), 1) plus the uphill difference × (h/70)². Cells above height 85 block the wind entirely, dropping all humidity, and there's no flux in permafrost (below −5 °C) ([precipitation-generator.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/precipitation-generator.ts)).
- **Dwarf Fortress.** Orographic precipitation is a toggle, `OROGRAPHIC_PRECIPITATION:1`, applied once after the final elevations; it can push rainfall outside the field's min and max, and a forum report reproduced in 2022 says it applies only where drainage ≥ 50 ([DF wiki](https://dwarffortresswiki.org/index.php/DF2014:Advanced_world_generation)).
- **WorldEngine.** Precipitation is simplex noise shaped by a gamma curve (gamma 1.25, offset 0.2), even though the README mentions rain shadows ([simulations](https://github.com/Mindwerks/worldengine/tree/master/worldengine/simulations)).

One west-to-east sweep with an orographic cap costs 1.4 / 2.4 ms at 256² / 512² (bench).

### Biomes

Every biome table is a lookup on two or more climate axes. Red Blob's Whittaker-style table works on elevation e and moisture m ([Red Blob](https://www.redblobgames.com/maps/terrain-from-noise/)):

| Elevation | Biome by moisture |
|---|---|
| e < 0.1 | Ocean |
| e < 0.12 | Beach |
| e > 0.8 | Scorched, bare, tundra, snow, at m < 0.1, < 0.2, < 0.5, else |
| e > 0.6 | Temperate desert, shrubland, taiga, at m < 0.33, < 0.66, else |
| e > 0.3 | Temperate desert, grassland, temperate deciduous forest, temperate rain forest, at m < 0.16, < 0.5, < 0.83, else |
| Otherwise | Subtropical desert, grassland, tropical seasonal forest, tropical rain forest, at m < 0.16, < 0.33, < 0.66, else |

Patel: "every project I've worked on I've had to change" these numbers.

The others add temperature as an axis:

- **Azgaar** uses a 5 × 26 matrix indexed by moisture band (moisture/5, 0–4) and temperature band (20 − T, clamped 0–25), with overrides: T < −5 is permafrost; T ≥ 25 with no river and moisture < 8 is hot desert; wetland where moisture > 40 near the coast or > 24 at heights 25–60. Moisture is the cell's precipitation plus a river flux bonus, averaged with its land neighbors ([biomes-generator.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/biomes-generator.ts)).
- **WorldEngine** sets temperature and humidity bands by quantile (temperatures 0.874 / 0.765 / 0.594 / 0.439 / 0.366 / 0.124; humidities 0.941 ... 0.002) and follows the Holdridge life zones ([WorldEngine](https://github.com/Mindwerks/worldengine)).
- **Minecraft** puts biomes in a six-parameter space: temperature, humidity, continentalness, erosion, weirdness and depth. All but depth are 2D noise; a location takes the biome whose interval box contains it, or the nearest box in 6D. Temperature has 5 levels (−1, −0.45, −0.15, 0.2, 0.55, 1), humidity 5 (−1, −0.35, −0.1, 0.1, 0.3, 1), erosion 7 (−1, −0.78, −0.375, −0.2225, 0.05, 0.45, 0.55, 1); depth is about 0 at the surface and +1/128 per block down ([Minecraft Wiki](https://minecraft.wiki/w/World_generation)).
- **Köppen–Geiger** (Peel, Finlayson and McMahon 2007) needs monthly temperature and precipitation. Pthreshold = 2·MAT if 70% of precipitation falls in winter, 2·MAT + 28 if 70% falls in summer, else 2·MAT + 14. A climate is arid (B) if MAP < 10·Pthreshold, desert (W) if MAP < 5·Pthreshold, steppe (S) otherwise. A PMC reproduction of the table gives steppe as ≥ 10·Pthreshold, which conflicts with the Melbourne copy; check the HESS original ([Peel's Köppen page](https://people.eng.unimelb.edu.au/mpeel/koppen.html); [Peel et al. 2007](https://hess.copernicus.org/articles/11/1633/2007/); [PMC table](https://pmc.ncbi.nlm.nih.gov/articles/PMC4676011/table/t1)).

Dwarf Fortress's thresholds, on its 0–400 elevation and 0–100 fields (the wiki tags the biome rows "verify") ([DF wiki](https://dwarffortresswiki.org/index.php/DF2014:Advanced_world_generation)):

| Biome | Rule |
|---|---|
| Ocean, land, mountains | Elevation 0–99, 100–299, 300–400; peaks only at 400 |
| Volcano | Volcanism 100 |
| Swamp | Rain 33–100, drainage 0–32, not freezing |
| Desert and badland | Rain 0–9: drainage 0–32 sand desert, 33–49 and 50–65 rocky wasteland, 66–100 badlands |
| Forest | Rain 66–100, drainage 66–100 (as listed) |
| Grassland | Rain 0–66, drainage 0–66 |
| Hills | Rain 0–66, drainage 66–100 |
| Tundra | Freezing, drainage 0–66 |
| Glacier | Freezing, drainage about 80–100 |

High drainage is "important for forming hills"; low drainage makes lakes, rivers, swamps and reportedly thicker soil. Adams's 2008 rule for swamps, where "rainfall is >=66/100 and drainage is less than 50", differs from the wiki's row.

## Caves and rock

### Caves

| Method | How | Cost |
|---|---|---|
| Minecraft noise caves | Part of base terrain. Cheese caves are the "white" region of a 3D noise (hollowness sets the size, with pillars inside); spaghetti caves are the thin band where a noise crosses zero ("the edge of black and white part ... becomes air"); noodle caves the same, thinner, 1 to 5 blocks wide. Frequency, hollowness and thickness noises control them. Old-style "carvers" still cut caves and canyons afterward ([Minecraft Wiki, Cave](https://minecraft.wiki/w/Cave)) | Evaluated per block with the terrain density; no global pass |
| Cellular automata (Johnson, Yannakakis and Togelius, FDG 2010) | A 50×50 grid, initial rock ratio r = 0.5, n = 4 iterations, Moore neighborhood M = 1, rock if the neighborhood value ≥ T = 5 (the paper's wording: greater than T); cost ∝ (2M + 1)² ([Johnson et al. 2010](https://www.um.edu.mt/library/oar/bitstream/123456789/22895/1/Cellular_automata_for_real-time_generation_of.pdf)) | 0.41 ms per 50×50 map in C#/XNA; a 3×3 grid of joined rooms (2 extra iterations on the joined borders) in 349 ms. In JS, 45% fill and 5 passes of the 4-5 rule cost 23 / 54 ms at 256² / 512² (bench) |
| Karst networks (Paris, Guérin, Peytavie, Collon and Galin, CGF 2021) | Skeletons by a gridless anisotropic shortest path from inlets to outlets, steered by faults, inception horizons, fractures and permeability contrasts; conduits as a signed-distance construction tree with blending and warping. A related tool, KarstNSim, reports sub-vertical conduits above the water table and sub-horizontal ones below it ([Paris et al. 2021](https://diglib.eg.org/handle/10.1111/cgf14420); the water-table detail via search summary) | Offline |
| Dwarf Fortress caverns | `CAVERN_LAYER_COUNT:3`, each layer with openness 0–100 (open expanses against passages), passage density 0–100 (a maze of passages) and water 0–100, plus magma sea and bottom-layer toggles; `MOUNTAIN_CAVE_MIN:25` and `NON_MOUNTAIN_CAVE_MIN:50` reject worlds without enough cave entrances ([DF wiki](https://dwarffortresswiki.org/index.php/DF2014:Advanced_world_generation)) | Part of world generation |

Minecraft's aquifers decide what fills every empty block. The world is cut into cells of 16×12×16 blocks, each with one jittered center that has a fluid level and type, and a block takes the nearest center's status, a 3D Voronoi, so levels step at cell boundaries, with stone barriers between differing neighbors. Partly flooded levels cluster near Y = 40·floor(Y/40) + 20 ± 10. Lava appears where the level is at or below Y = −10 and |lava noise| > 0.3, sampled per 64×40×64 blocks. Under the sea floor, cells are almost always flooded to sea level; inland, mostly dry. There are no aquifers where erosion < −0.225 and depth > 0.9, the deep dark ([Minecraft Wiki, Cave](https://minecraft.wiki/w/Cave)).

Karst and lava tubes have no game-ready algorithm in the sources; the PLUME framework (arXiv 2508.20926) targets planetary shelters, not games. The hydrogeology tools above do have one at their core, a shortest-path tree from springs to sinkholes, and it turns out cheap enough to run per region: [Caves made by the rock](#caves-made-by-the-rock) below.

### Rock

- **Terrafirmacraft (1.20.x)** gives each area a layer type: `ocean_floor` (igneous extrusive), `volcanic`, `land` (igneous extrusive or sedimentary) or `uplift` (sedimentary over uplifted or metamorphic, for inland mountains). It has twenty rocks: granite, diorite, gabbro, shale, claystone, limestone, conglomerate, dolomite, chert, chalk, rhyolite, basalt, andesite, dacite, quartzite, slate, phyllite, schist, gneiss and marble. Stacking is a chain: pick a rock for the top layer; that rock names the layer below it; repeat until a bottom layer (gneiss, schist, diorite, granite, gabbro), which repeats forever ([TFC docs](https://terrafirmacraft.github.io/Documentation/1.20.x/worldgen/world-preset)). TFC 3.x claims more predictable strata ("you'll very likely find marble underneath a layer of surface limestone") and ores rebalanced around the layers ([Modrinth, TFC 3.0.0 beta](https://modrinth.com/mod/terrafirmacraft/version/3.0.0-beta), via search summary). Claims of "tectonic" TFC world generation online are unverified.
- **Vintage Story** puts sedimentary rock near the surface, metamorphic beneath and igneous at the bottom (basalt may cap anything), typically 3 layers (4 under volcanics). Geologic provinces (Shield, Platform, Orogen, Basin, Large Igneous Province, Extended Crust) set the thickness of the volcanic, sedimentary, metamorphic and igneous layers (Basin 0/50/15/255, Shield 0/0/0/255; units unlabeled). Ores are tied to host rocks: galena in claystone, cassiterite in granite, coal in conglomerate. The wiki page has inconsistencies (20 against 22 rocks; where phyllite and slate belong) ([Vintage Story Wiki, Rock](https://wiki.vintagestory.at/Rock)).
- **Dwarf Fortress** sets `MINERAL_SCARCITY:2500` (100–100,000; the menu presets are 50000, 10000, 2500, 500 and 100).

Province-driven strata or chained layer tables cost nothing at generation time, a lookup per column. They matter only if a world shows cliffs, mines or caves *(inference)*.

The demo's rock is a lookup of that kind, driven by the plates. During the plates stage a volcanic field gathers island arcs, continental arcs (at 45%), rift floors (four times, as flood basalt), mid-ocean ridges and hotspot shields, plus any land on an oceanic plate far from a continent; above 0.45 it's basalt. Granite goes where uplift was fast enough to strip a range to its core, or where old ranges are worn to their roots. Everywhere else is a layer cake of sedimentary beds 150 m thick, each bed's rock drawn from a hash of its index (42% limestone, 30% sandstone, 28% shale), folded by a slow noise of ±0.45 km. So the rock at a point depends on its height, and a valley cut deep enough reaches the next bed down. A region's cliffs are banded with the beds they cut, and the <i>Rock</i> tab marks karst where limestone gets over 45 cm of rain. It costs about 3 ms for the world map *(measured)*.

## Caves made by the rock

Real caves come from rock and water, not from noise. Most are dissolved in limestone along joints and bedding planes, at and just below the water table, and the recharge decides the pattern (Palmer 1991, abstract). Sinkholes feeding water to points make **branchwork**, tributaries joining downstream into fewer, larger passages: about 57% of Palmer's roughly 500 caves, and 72 to 84% of 633 Missouri caves. Diffuse recharge, as through a permeable caprock, opens every fracture at once into a **network maze** (17%); floodwater backing up from a river braids **anastomotic** loops (3%) ([Palmer 1991](https://digitalcommons.usf.edu/kip_articles/4015); [Palmer 1975](https://digitalcommons.usf.edu/kip_articles/4197); [Dom and Wicks 2003](https://repository.lsu.edu/geo_pubs/1093), the shares via search summary). Cave levels record old stands of the base-level river: as the valley deepens, the old level drains and dries, and only then can speleothems grow, since calcite comes out of water losing CO₂ to the air ([NPS](https://www.nps.gov/grba/learn/nature/speleothems-cave-formations.htm)). Lava tubes are rivers of lava under their own crust, 1 to 15 m down, following the flow downslope, open through skylights where the roof fell in ([USGS](https://www.usgs.gov/news/truth-about-terrifying-lava-skylight-where-only-trained-should-lurk); [Wikipedia](https://en.wikipedia.org/wiki/Lava_tube)). Sea caves are cut by waves along weak zones in cliffs at sea level ([Wikipedia](https://en.wikipedia.org/wiki/Sea_cave)). The full sourcing is in [caves_villages_edges.md](notes/caves_villages_edges.md).

Games don't do any of this. Dwarf Fortress's cavern layers are world-wide horizontal bands with openness and passage-density sliders; Minecraft's cheese, spaghetti and noodle caves are thresholds and zero-crossings of 3D noise, its carver caves Perlin worms; Terraria runs random-walk "TileRunner" passes; Noita fills its biomes with herringbone Wang tiles and rejects layouts a pathfinder can't cross; Spelunky lays a guaranteed path through a 4×4 grid of room templates ([DF wiki](https://dwarffortresswiki.org/index.php/DF2014:Advanced_world_generation); [Minecraft Wiki](https://minecraft.wiki/w/Cave); [Terraria wiki](https://terraria.wiki.gg/wiki/World_generation); [Noita wiki](https://noita.wiki.gg/wiki/User:NoitaArena/Staging/World_generation); [Kazemi](https://tinysubversions.com/spelunkyGen/)). Only the hydrogeology tools grow passages from inlets to outlets, Paris et al. by an anisotropic shortest path steered by fractures and inception horizons, KarstNSim and pyKasso by fast marching ([Paris et al. 2021](https://perso.liris.cnrs.fr/aparis/public_html/projects/paris2021_Karsts.html); [HAL](https://hal.univ-lorraine.fr/hal-04468018), via search summary).

That core is a single Dijkstra, and on a 64×48 region it's nearly free. The demo:

| Cave | Where | How |
|---|---|---|
| Karst, active level | Limestone at the water's own level within two tiles of a river, lake or the sea, under at least a terrace of ground: up to six springs, 7 tiles apart | Joints in two sets at right angles, square to the plate's drift, 4 or 5 tiles apart and wavering. A multi-source Dijkstra grows from the springs through limestone at each spring's level, 1 along a joint and 2.8 through solid rock. Up to nine sinkholes (limestone at the surface, dry, open, 6 tiles apart, wetter and flatter first) trace back to their springs, so the passages join downstream: branchwork. A passage carrying three or more sinkholes' water is two tiles wide. Streams run along them to the springs, which issue at the foot of a cliff or well up on the bank |
| Karst patterns | Under a sandstone bed just above the passage level; near a spring on a big river or a lake | Every joint within 3 tiles of a capped passage opens (a network maze, from diffuse recharge). Near a flooding river, side passages braid off the last tiles before the spring and rejoin (anastomotic): a fresh Dijkstra between two points of the trunk with a random cost that avoids the trunk |
| Karst, old level | Two to four terraces above the springs (about 70 m), or without springs the limestone level most cut by valley walls | The same growth, from entrances where a valley wall cuts the level; dry, with speleothems; mouths open in the cliff face at the level's own height when the wall faces the viewer |
| Lava tubes | Regions over a fifth basalt | From the highest basalt (and a second vent 18 tiles off), a tube runs down the smooth world slope with momentum and a little wander, a terrace under the surface, never climbing; a skylight every nine tiles |
| Sea caves | Where the sea meets a cliff two or more terraces high in rock other than shale | Two to four tiles inland at sea level, up to four, the mouth at the waterline |
| Rock shelters | The foot of a sandstone cliff three or more terraces high | A one-tile alcove, up to two |

Limestone dissolves only where there's water to do it, so a region averaging under 25 cm of rain gets no karst. Each passage tile keeps its level, so the underground cutaway draws it at its own depth, its back wall in the rock of the bed above. A region with none says so ("no caves in its granite"). How common caves are depends on the world: in seed 4242, whose interior is mostly limestone, every village's region had karst; in seed 777, mostly shale and sandstone, five of sixteen did, one had a lava tube, two sea caves, and one no cave at all. With the caves, a region still builds in 0.09 to 0.42 s, against 0.16 to 0.35 s before *(measured)*. Not done: spongework and ramiform caves, shafts below the sinkholes, flooded passages below the spring level, talus and glacier caves. A cave level crossing a region edge doesn't continue into the next region, which would need the springs and sinkholes chosen per world cell instead of per region *(inference)*.

## What fits on a phone, and what to precompute

<div class="finding"><p>On a 256×256 grid everything but long erosion runs costs tens of milliseconds in plain JS: base noise, priority-flood, flow accumulation, rivers, lakes, wind and rain shadow, biomes, CA caves. The whole pipeline, with about 20 implicit stream-power steps and a light droplet pass, takes about <b>0.5 s on a laptop</b>, roughly <b>1 to 2 s on a phone</b> in a worker. Full stream-power equilibrium (about 200 steps) is the one stage that doesn't fit at 512² on a phone.</p></div>

The measured costs, in ms (bench):

| Kernel | 256² | 512² |
|---|---|---|
| fBm value noise, 6 octaves | 10.2 | 28.6 |
| Diamond-square midpoint displacement | 3.5 | 9.0 |
| Priority-flood (epsilon fill, binary heap, receivers and flood order) | 15.8 | 55.9 |
| Flow accumulation in reverse flood order | 1.2 | 2.7 |
| D8 receivers plus sort-by-height accumulation | 25.1 | 99.8 |
| Stream power, implicit Braun–Willett, 1 iteration (flood, accumulate, solve) | 31.3 | 118.4 |
| Stream power, 20 iterations | 289 | 1015 |
| Schott-style local stream power on the CPU, per step | 39 | 129 |
| Droplets, radius-3 brush, 0.5 per cell (33k / 131k) | 128 | 445 |
| Thermal erosion, 50 iterations, 4-neighbor talus | 86 | 318 |
| One wind sweep with an orographic cap | 1.4 | 2.4 |
| CA caves, 45% fill, 5 passes of the 4-5 rule | 23 | 54 |

For comparison, the published costs: Cordonnier's stream power at 10,000 nodes, 0.031 s a step and 6.4 s to converge on a 3 GHz i7; Beyer's droplets at 256², 10,000 drops in 2.27 s on a 3.2 GHz i5; Johnson's CA, 0.41 ms per 50×50 map in C#. DF says world-map generation is "generally much faster than history generation" ([DF wiki](https://dwarffortresswiki.org/index.php/DF2014:World_generation)). The shipped tools' grids are small: DF's worlds 17 to 257 squares a side, Lague's demo 255², mapgen4 tuned to about 25k cells from precomputed points, Azgaar 10K points with no mobile app ("There is no mobile app", per its FAQ), O'Leary 16,384 points, Johnson's caves 50×50 chunks. mapgen4 moved generation into a Web Worker "to make it run acceptably fast", keeping the map in the worker and transferring geometry buffers to the main thread ([Patel, mapgen4 threads](https://simblob.blogspot.com/2018/09/mapgen4-threads.html)).

A budget for 256×256 from the laptop numbers, times an unmeasured phone factor, plausibly 2 to 4× for a mid-range Android *(inference)*:

| Stage | Laptop |
|---|---|
| Base: Minecraft-style splines, or fBm plus an island mask | about 30 ms |
| Priority-flood plus accumulation | about 20 ms |
| 20 implicit stream-power steps | about 300 ms |
| 0.25 droplets per cell | about 60 ms |
| 20 thermal iterations | about 35 ms |
| Wind sweep, temperature (latitude plus lapse rate) and biome lookup | under 10 ms |
| A final priority-flood for lakes and rivers | about 20 ms |
| **Total** | **about 0.5 s; roughly 1 to 2 s on a phone** |

512×512 is about 4× per stage, about 2 s on the laptop with the same step counts. On a phone, cut stream power to about 5 steps, or run it at 256², upsample, and add droplets at 512², or precompute *(inference)*.

| When | What *(inference)* |
|---|---|
| Precompute and ship | Poisson or mesh points (mapgen4's choice), splines and biome tables, rock-strata tables, and any "fully eroded" mountain set: a coarse 128² stream-power run upsampled, or a stock of eroded tiles |
| Per seed, in a worker | Noise, flood, rivers, lakes, climate, biomes, caves, settlements, paths, vegetation |
| Never per frame | Erosion. A GPU path (Schott's kernel as a fragment-shader ping-pong on `Tycho.gpu`) is the only way to make full steady-state erosion interactive on a phone |

Typed arrays (Float32Array heights, Int32Array receivers and order), a hand-rolled binary heap and precomputed brush offsets are what make these numbers. Array-of-objects or `Array.prototype.sort`-heavy code, as in O'Leary's D3 version, is several times slower *(inference)*.

### Generate, measure, reject

Dwarf Fortress's reliability comes from "belt and braces": parameters steer generation, and separate tokens reject the world and reroll. "Certain factors, such as the number of mountain tiles, can't be determined ahead of time ... worlds are generated with parameters which are likely to produce worlds that can support a required number of mountains, and are then checked." Rejections are logged with `LOG_MAP_REJECTS:YES` ([DF wiki, World rejection](https://dwarffortresswiki.org/index.php/DF2014:World_rejection)).

| Check | Tokens |
|---|---|
| Biome counts | `REGION_COUNTS:<biome>:<initial squares>:<initial regions>:<final regions>` for swamp, desert, forest, mountains, ocean, glacier, tundra, grassland and hills; example defaults for a 257 world are SWAMP 1032:7:6, FOREST 4128:13:12, and 8256 squares for mountains, ocean, grassland and hills. Initial counts are checked before erosion, final region counts after |
| Field spread | `ELEVATION_RANGES`, `RAIN_RANGES`, `DRAINAGE_RANGES`, `SAVAGERY_RANGES`, `VOLCANISM_RANGES` require minimum numbers of low, mid and high squares; "Volcanism not evenly distributed" is a named rejection |
| Patchwork | `SUBREGION_MAX:2750` (1–5000) rejects worlds with too many separate biome regions |
| Placement | `VOLCANO_MIN`, `PEAK_NUMBER_MIN`, `PARTIAL_OCEAN_EDGE_MIN` and `COMPLETE_OCEAN_EDGE_MIN` (0–4; 4 is an island world, 3 a peninsula), `RIVER_MINS`, `MOUNTAIN_CAVE_MIN:25`, `NON_MOUNTAIN_CAVE_MIN:50`, `TOTAL_CIV_NUMBER:40`, `PLAYABLE_CIVILIZATION_REQUIRED:1` |

Rejection warnings can take "a few hundred" to thousands of rerolls to appear. The loop is cheap at this size, and a phone game can copy it with a twist: reject on a coarse 64² or 128² pass (a few ms), testing land fraction, a river reaching the sea, a mountain count and the biomes the quest needs, then run the costly stages once at full size. Because Elsewhere requires `ctx.rng`-seeded determinism, the reroll must derive the next seed from the current one (seed, seed + 1, ...), so a saved world always regenerates the same *(inference)*.

No phone measurements were made, and no reliable mid-range-phone JS benchmark was found (Speedometer comparisons online are flagship-only and vendor-sourced). The phone factor waits on a run of the bench, or a browser port of it, on target devices; worker startup and transfer costs on phones weren't measured either.

## What Tycho would need

[The roadmap](roadmap.md#wave-3-generated-places) puts terrain and biomes in wave 3's `gen`, and names Merryfolk's priority-flood and D8 routines as donors for a later `gen.flow` if a second game asks for rivers. This page adds what that flow module would hold *(inference)*:

- **`gen.flow`:** priority-flood recording receivers and order, accumulation in reverse order, an implicit stream-power step and a wind sweep, all on typed arrays and safe to run in a worker.
- **A habitat module:** Merryfolk's land analysis (slope, aspect and sun, distance to water, flow, wetness index, soil class) as reusable maps, with the species tables left to each game or quest.
- **Paths:** least-cost A* with Galin's k-masks and Tobler or capped-slope costs, and a wear grid for desire paths.
- **Rock and caves:** a `rockAt(x, y, z)` lookup from a few world fields (volcanism, crystalline core, fold) and a multi-source Dijkstra with per-source levels for karst from springs to sinkholes. Both are small and game-agnostic, and a mine, a quarry or a cave quest could use them.
- **GPU erosion** only if `Tycho.gpu` gains render-to-texture with float targets, which is outside these notes.

## Sources


- [Tarn Adams, Gamasutra Q&A on the development of Dwarf Fortress](https://gamasutra.com/design/q-a-dissecting-the-development-of-i-dwarf-fortress-i-with-creator-tarn-adams)
- [John Harris, Interview: The Making Of Dwarf Fortress (Game Developer, 2008)](https://www.gamedeveloper.com/design/interview-the-making-of-dwarf-fortress)
- [Isegoria, quoting Polygon on Dwarf Fortress (2014)](https://www.isegoria.net/?p=35819)
- [Minecraft Wiki, world generation](https://minecraft.wiki/w/World_generation) and [cave](https://minecraft.wiki/w/Cave)
- [Henrik Kniberg, Minecraft terrain generation in a nutshell (2022)](https://www.youtube.com/watch?v=CSa5O6knuwI)
- [Martin O'Leary, mewo2/terrain](https://github.com/mewo2/terrain/blob/master/terrain.js)
- [Frozen Fractal, Around The World, part 2: plate tectonics (2023)](https://frozenfractal.com/blog/2023/11/13/around-the-world-2-plate-tectonics/)
- [Terrafirmacraft docs, world presets (1.20.x)](https://terrafirmacraft.github.io/Documentation/1.20.x/worldgen/world-preset) and [TFC 3.0.0 beta notes on Modrinth](https://modrinth.com/mod/terrafirmacraft/version/3.0.0-beta)
- [Vintage Story Wiki, rock](https://wiki.vintagestory.at/Rock)
- [Cordonnier et al. 2016, Large Scale Terrain Generation from Tectonic Uplift and Fluvial Erosion](https://www.cs.purdue.edu/homes/bbenes/papers/Cordonier16CGF.pdf)
- [Barnes, Lehman and Mulla 2014, Priority-Flood (arXiv 1511.04463)](https://arxiv.org/abs/1511.04463)
- [Beyer 2015, Implementation of a method for hydraulic erosion](https://ardordeosis.github.io/implementation-of-a-method-for-hydraulic-erosion/thesis-beyer.pdf)
- [Sebastian Lague, Hydraulic-Erosion](https://github.com/SebLague/Hydraulic-Erosion)
- [henrikglass, erodr](https://github.com/henrikglass/erodr)
- [Smelik et al. 2009, A Survey of Procedural Methods for Terrain Modelling](https://publications.graphics.tudelft.nl/rails/active_storage/blobs/redirect/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBBcmtLIiwiZXhwIjpudWxsLCJwdXIiOiJibG9iX2lkIn19--a99ce149fd6820493fdcb22b4f4b5e3cccbd976e/SDGTB09a.pdf)
- [Johnson, Yannakakis and Togelius 2010, cellular automata for real-time cave levels](https://www.um.edu.mt/library/oar/bitstream/123456789/22895/1/Cellular_automata_for_real-time_generation_of.pdf)
- [Paris et al. 2021, Synthesizing Geologically Coherent Cave Networks](https://diglib.eg.org/handle/10.1111/cgf14420)
- [Cordonnier et al. 2017 (ACM ToG)](https://cs.purdue.edu/homes/bbenes/papers/Cordonnier17ToG.pdf)
- Dwarf Fortress wiki: [world generation](https://dwarffortresswiki.org/index.php/DF2014:World_generation), [advanced world generation](https://dwarffortresswiki.org/index.php/DF2014:Advanced_world_generation), [world rejection (DF2014)](https://dwarffortresswiki.org/index.php/DF2014:World_rejection), [world rejection](https://dwarffortresswiki.org/index.php/World_rejection), [site](https://dwarffortresswiki.org/index.php/DF2014:Site), [v0.31 civilisation](https://dwarffortresswiki.org/index.php/v0.31:Civilisation)
- Red Blob Games: [making maps with noise](https://www.redblobgames.com/maps/terrain-from-noise/); mapgen4 [mesh.ts](https://github.com/redblobgames/mapgen4/blob/master/mesh.ts), [config.js](https://github.com/redblobgames/mapgen4/blob/master/config.js), [README](https://github.com/redblobgames/mapgen4/blob/master/README.org), [map.ts](https://github.com/redblobgames/mapgen4/blob/master/map.ts); Amit Patel on [mapgen4 rainfall](https://simblob.blogspot.com/2018/09/mapgen4-rainfall.html) and [mapgen4 threads](https://simblob.blogspot.com/2018/09/mapgen4-threads.html)
- Azgaar's Fantasy Map Generator: [advanced options](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Advanced-options), [knowledge base](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Knowledge-Base), [heightmap template editor](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Heightmap-template-editor), [geographical features](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Geographical-Features-Overview), [temperature-generator.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/temperature-generator.ts), [precipitation-generator.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/precipitation-generator.ts), [river-generator.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/river-generator.ts), [lakes.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/lakes.ts), [biomes-generator.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/biomes-generator.ts)
- WorldEngine: [README](https://github.com/Mindwerks/worldengine), [plates.py](https://github.com/Mindwerks/worldengine/blob/master/worldengine/plates.py), [generation.py](https://github.com/Mindwerks/worldengine/blob/master/worldengine/generation.py), [simulations](https://github.com/Mindwerks/worldengine/tree/master/worldengine/simulations)
- Undiscovered Worlds: [what it is](https://undiscoveredworlds.blogspot.com/2019/01/what-is-undiscovered-worlds.html), [springs and valleys (2025)](https://undiscoveredworlds.blogspot.com/2025/12/springs-and-valleys.html), [GitHub](https://github.com/fegennari/Undiscovered_Worlds)
- Schott et al. 2023: [project page](https://h-schott.github.io/p/uplift), [StreamPowerErosion](https://github.com/H-Schott/StreamPowerErosion), [spe_shader.glsl](https://github.com/H-Schott/StreamPowerErosion/blob/main/data/shaders/spe_shader.glsl)
- Köppen–Geiger: [Peel's Köppen page](https://people.eng.unimelb.edu.au/mpeel/koppen.html), [Peel et al. 2007 (HESS)](https://hess.copernicus.org/articles/11/1633/2007/), [PMC table reproduction](https://pmc.ncbi.nlm.nih.gov/articles/PMC4676011/table/t1)
- AMS Glossary: [adret](https://glossary.ametsoc.org/wiki/adret/) and [ubac](https://glossary.ametsoc.org/wiki/ubac/)
- Watabou's village generator: [devlog 1.4.0](https://watabou.itch.io/village-generator/devlog/507254/140-village-square-and-orchards), [devlog 1.6.4](https://watabou.itch.io/village-generator/devlog/840277/164-crossroads-and-numbered-houses), [comments](https://watabou.itch.io/village-generator/comments?after=162)
- Helbing et al., active walker model: [arXiv cond-mat/9806097](https://ar5iv.labs.arxiv.org/html/cond-mat/9806097) and [cond-mat/9805158](https://arxiv.org/pdf/cond-mat/9805158)
- Hammes 2001: [flipcode](https://flipcode.com/archives/02-07-2002.shtml), [DOI 10.1007/3-540-44818-7_14](https://doi.org/10.1007/3-540-44818-7_14)
- Sea of Stars: [PlayStation Blog](https://blog.playstation.com/?p=382678), [MobileSyrup interview with Thierry Boulanger](https://mobilesyrup.com/2023/09/11/sea-of-stars-level-design-sabotage-studio-thierry-boulanger-interview/), [Nintendo Life hands-on](https://www.nintendolife.com/news/2020/03/hands_on_first_impressions_of_sea_of_stars_the_next_project_from_the_messenger_dev_sabotage)
- Merryfolk: [README](https://github.com/doctorallen/merryfolk/blob/main/README.md), [terrain.js](https://github.com/doctorallen/merryfolk/blob/main/js/terrain.js), [layout.js](https://github.com/doctorallen/merryfolk/blob/main/js/layout.js), [nature.js](https://github.com/doctorallen/merryfolk/blob/main/js/nature.js), [world.js](https://github.com/doctorallen/merryfolk/blob/main/js/world.js), [cliffs.js](https://github.com/doctorallen/merryfolk/blob/main/js/cliffs.js)

- Caves: [Palmer 1991, abstract](https://digitalcommons.usf.edu/kip_articles/4015), [Palmer 1975, maze caves](https://digitalcommons.usf.edu/kip_articles/4197), [Dom and Wicks 2003](https://repository.lsu.edu/geo_pubs/1093), [NPS speleothems](https://www.nps.gov/grba/learn/nature/speleothems-cave-formations.htm), [USGS lava skylights](https://www.usgs.gov/news/truth-about-terrifying-lava-skylight-where-only-trained-should-lurk), [Paris et al. 2021](https://perso.liris.cnrs.fr/aparis/public_html/projects/paris2021_Karsts.html), [Noita world generation](https://noita.wiki.gg/wiki/User:NoitaArena/Staging/World_generation), [Kazemi, Spelunky generator](https://tinysubversions.com/spelunkyGen/)

The full research is in the notes on [realistic world generation](notes/realistic_world_generation.md), with its benchmark [world_generation_bench.js](notes/world_generation_bench.js), on [settlements, paths and vegetation](notes/settlements_paths_vegetation.md), and on [caves, village forms and biome edges](notes/caves_villages_edges.md).

<script src="demos/kit.js"></script>
<script src="demos/flora.js"></script>
<script src="demos/geo-world.js"></script>
<script src="demos/start.js"></script>
