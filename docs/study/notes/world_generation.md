# Procedural world, level and map generation for 2D/pixel games

Scope: algorithms at every scale (continent to tile detail) for deterministic, seeded generation in plain JavaScript on a phone. The target is small worlds, pixel tile grids, and one game on an isometric 2:1 grid: Elsewhere on Tycho, 320x180, with `ctx.rng(name)` / `Tycho.seed.Rng` / `Tycho.seed.hashString` already in `js/shell.js`. Researched 2026-11-02. Where a fetch failed or only secondary sources existed, it says so.

## Noise-based terrain: noise, fBm, ridged noise, domain warping, biomes, multi-noise, erosion, rivers, coastlines, Red Blob polygon maps and mapgen4

### Takeaway
For a small pixel world, the full terrain pipeline is cheap and well documented:
- Seeded simplex noise, then fBm (3-5 octaves, amplitude halved each octave).
- A `pow` redistribution, an island or edge shaping function, and an optional domain warp.
- Biomes from an elevation x moisture lookup table (Red Blob's Whittaker-style table).
- Optionally, droplet erosion and downhill rivers.

Minecraft-style multi-noise (nearest point in a 5-6 dimensional climate space) is the general form of the same lookup. Mapgen4-style Voronoi meshes help for hand-drawn-looking overworld maps, not for tile grids.

### Cited Findings
**Noise and fBm (Red Blob Games, "Making maps with noise functions")**
- Normalize coordinates with `nx = x/width - 0.5`. Rescale library output from [-1,1] to [0,1] with `n/2 + 0.5` — [Red Blob Games, Making maps with noise (2015, updated through 2022; page last modified 2026-09-29)](https://www.redblobgames.com/maps/terrain-from-noise/)
- Octaves: `e = 1*noise(1nx,1ny) + 0.5*noise(2nx,2ny) + 0.25*noise(4nx,4ny)`, then divide by the sum of the amplitudes (1.75). Amplitudes `[1, 1/2, 1/3, 1/4, 1/5]` give more fine detail. Wavelength = map_size / frequency — [Red Blob Games](https://www.redblobgames.com/maps/terrain-from-noise/)
- Decorrelate octaves with a separate seed for each octave, or with offsets such as `noise(2nx+5.3, 2ny+9.1)`. Rotating octaves, or using simplex instead of plain grid noise, reduces directional artifacts — [Red Blob Games](https://www.redblobgames.com/maps/terrain-from-noise/)

**Shaping elevation**
- Redistribution: `e = Math.pow(e * fudge, exponent)`, with fudge about 1.2 in the demo. Higher exponents flatten valleys and leave peaks — [Red Blob Games](https://www.redblobgames.com/maps/terrain-from-noise/)
- Islands: with `nx = 2x/w - 1`, use the square bump `d = 1 - (1-nx²)(1-ny²)` or Euclidean² `d = min(1, (nx²+ny²)/√2)`. Then `e = lerp(e, 1-d, mix)`, with water below 0.5 — [Red Blob Games](https://www.redblobgames.com/maps/terrain-from-noise/)
- Ridged noise: `r = 2*(0.5 - abs(0.5 - noise))`. Multiply each octave by the earlier ones (`e1 = 0.5*r(2p)*e0`, `e2 = 0.25*r(4p)*(e0+e1)`) so only mountains get detail — [Red Blob Games](https://www.redblobgames.com/maps/terrain-from-noise/)
- Terraces: `e = round(e*n)/n`, with n from 2 to 15 in the demo — [Red Blob Games](https://www.redblobgames.com/maps/terrain-from-noise/)
- Wraparound: for a cylinder use `noise3D(cos(TAU*nx)/TAU, sin(TAU*nx)/TAU, ny)`; for a torus use noise4D. Scale noise3D by about √1.5 and noise4D by about √2 to match 2D tuning — [Red Blob Games](https://www.redblobgames.com/maps/terrain-from-noise/)

**Biomes from elevation and moisture**
- Elevation-only thresholds: water <0.1, beach <0.2, forest <0.3, jungle <0.5, savannah <0.7, desert <0.9, snow above — [Red Blob Games](https://www.redblobgames.com/maps/terrain-from-noise/)
- The elevation x moisture table uses a moisture noise with its own seed:
  - e<0.1 ocean; e<0.12 beach.
  - e>0.8: scorched (m<0.1), bare (<0.2), tundra (<0.5), else snow.
  - e>0.6: temperate desert (m<0.33), shrubland (<0.66), else taiga.
  - e>0.3: temperate desert (m<0.16), grassland (<0.5), temperate deciduous forest (<0.83), else temperate rain forest.
  - Otherwise: subtropical desert (m<0.16), grassland (<0.33), tropical seasonal forest (<0.66), else tropical rain forest.
  - [Red Blob Games](https://www.redblobgames.com/maps/terrain-from-noise/)

**Domain warping (Inigo Quilez)**
- Warping means distorting the domain with another function g(p) before evaluating f. The one-stage form is `fbm(p + 4.0*q)` with `q = (fbm(p), fbm(p + (5.2,1.3)))`. The two-stage form builds r from q and evaluates `fbm(p + 4.0*r)` — [Inigo Quilez, Domain warping (search excerpt; direct fetch returned 404)](https://iquilezles.org/articles/warp)

**Minecraft's multi-noise biomes (since 1.18)**
- Each location gets climate parameters: temperature, humidity, continentalness, erosion, weirdness, plus depth (and an offset that is 0 during biome generation). The biome source picks the closest "noise hypercube" to the sampled point — [Fabric Yarn docs, MultiNoiseUtil.NoiseHypercube](https://maven.fabricmc.net/docs/yarn-1.20.4+build.1/net/minecraft/world/biome/source/util/MultiNoiseUtil.NoiseHypercube.html)
- A community write-up describes the order: continentalness and erosion sort the terrain, then temperature and humidity pick the biome. Weirdness matters only for some variants — [Dawnosaur, How Minecraft generates worlds](https://dawnosaur.substack.com/p/how-minecraft-generates-worlds-you)
- The climate noises are sampled at a different scale for biome placement than for surface rules. Mojang closed this as "Works As Intended" — [Mojang bug MC-239790](https://bugs.mojang.com/browse/MC-239790)

**Hydraulic erosion (droplet method)**
- Defaults in an open implementation: inertia 0.05, capacity 4.0, deposition 0.3, erosion 0.3, evaporation 0.01, gravity 4.0, min slope 0.01, brush radius 3, max lifetime 30 — [xarray-spatial erosion source](https://xarray-spatial.readthedocs.io/en/stable/_modules/xrspatial/erosion.html)
- Each step: `dir = dir*inertia - grad*(1-inertia)`, normalized. Capacity is `max(-Δh, minSlope) * speed * water * capacity`. A droplet over capacity deposits; otherwise it erodes a fraction of the gap, limited by Δh — [xarray-spatial](https://xarray-spatial.readthedocs.io/en/stable/_modules/xrspatial/erosion.html)
- Hans Theobald Beyer's bachelor thesis is the formal specification, and Sebastian Lague's Unity project is the most-copied implementation (secondary claim) — [getbutterfly, Procedural eroded terrain in Three.js](https://getbutterfly.com/procedural-eroded-terrain-in-three-js-theory-techniques-field-notes/)

**Dwarf Fortress world generation (simulation-flavored terrain)**
- The order:
  1. Seed elevation, rainfall, temperature, drainage, volcanism and wildness fields, and fill them in "fractally".
  2. Place peaks; reject worlds that can't be fixed.
  3. Derive vegetation; test biomes.
  4. Smooth, and place volcanoes.
  5. Run test rivers from mountain edges, carve channels, grow lakes.
  6. Re-smooth.
  7. Apply rain shadows and orographic rain.
  8. Reset temperature from elevation, rain and forest.
  9. Set salinity.
  10. Name biome regions; check the final parameters.
  - [Dwarf Fortress Wiki, World generation](https://dwarffortresswiki.org/index.php/World_generation)

**Red Blob mapgen4 and the 2010 polygon maps**
- Mapgen4 (created 2018-07-20; geometry rewritten Apr 2023; renderer rewritten 2025; page modified 2026-07-09):
  - A Delaunay+Voronoi dual mesh, built with delaunator and poisson-disk-sampling.
  - Painted mountains, valleys and oceans shape elevation through distance fields; the author later wrote these "didn't work out like I hoped".
  - Evaporation, wind and rainfall determine biomes and rivers, with rivers stored as binary trees.
  - An oblique 3D projection mimics hand-drawn maps.
  - [Red Blob Games, mapgen4](https://www.redblobgames.com/maps/mapgen4/)
- Mapgen4's techniques started in the 2010 "polygon map generation" write-up on Amit Patel's Stanford site — [Red Blob Games, mapgen4](https://www.redblobgames.com/maps/mapgen4/) (the 2010 page itself refused the connection when fetched)

### Inferences
- A good minimal pipeline for a 320x180 frame, or a world of a few frames, keeps everything on the tile grid (say 64x64 to 256x256 cells):
  1. Make one seeded `noise2D` for each named channel (elevation, moisture, warp), each from `ctx.rng('elev')` and so on.
  2. Elevation = fBm over 4 octaves; apply `pow(e*1.2, 2)`.
  3. Moisture = fBm over 3 octaves.
  4. Choose biomes from a small table.
  5. Run Bridson Poisson-disk decoration from a per-biome density.
- A 128x128 grid with 4 octaves is about 65k noise samples. At the roughly 20 ns per sample measured on a desktop (see the libraries section), that is about 1.3 ms on desktop and plausibly under 20 ms on a phone. This is an estimate, not a measurement.
- Eight inks to a frame suggests discrete biome bands (the elevation x moisture table, or terraces) rather than smooth gradients. Terracing `round(e*n)/n` with n of about 4-6 maps naturally onto the isometric "height steps" a 2:1 iso grid can show as cliff faces.
- The land must run off every edge of the frame, so prefer unshaped noise, or a torus wrap with noise4D, over island masks, unless the quest is an island.
- Droplet erosion is iterative and costs O(droplets x lifetime x brush). For small maps, about 5-20k droplets with lifetime 30 should run in tens of milliseconds. Its main payoff is believable river valleys; for tiny maps, carving "steepest descent from high points to water" rivers (the Dwarf Fortress and polygon-map style) is cheaper and fully deterministic.
- Multi-noise is worth copying as a pattern, not as a parameter set. Store each biome as a point in a (temperature, humidity, continentalness...) space and choose the nearest. Adding a biome then never needs a rewritten threshold cascade.
- Domain warping by about 4x a low-frequency fBm is the cheapest way to make noise coastlines look less "blobby" and more authored. It triples the noise cost.

### Gaps
- Could not fetch Inigo Quilez's warp article directly (404); the formulas come from a search excerpt and a derived shader.
- No primary source for OpenSimplex2 (KdotJPG) was fetched. It is known as a patent-free simplex variant, but its JS port status in 2026 is unverified.
- Thermal erosion (talus-angle slumping) was not sourced.
- Minecraft's exact parameter ranges for each biome were not retrieved.
- Mapgen4 regeneration timings and region counts are not published on the page.

## Constraint and rule-based generation: WFC, model synthesis, Townscaper/Bad North, constraint solvers, answer set programming

### Takeaway
WFC is model synthesis (Merrell, 2007) reinvented for 2D bitmaps (Gumin, 2016). It runs in three steps: pick the lowest-entropy cell, collapse it weighted by frequency, propagate (AC-4).
- The simple tiled model (adjacency lists with D4 symmetry) is the practical one for a hand-drawn tileset.
- The overlapping model (NxN patterns learned from a sample bitmap, N=3 typical) suits texture-like detail.
- Contradictions are rare but possible, since the problem is NP-hard. Restart, or add backtracking.

On a phone, use WFC in small regions (building facades, a room's furniture, a village block), not on whole worlds.

### Cited Findings
**WFC (Maxim Gumin, mxgmn/WaveFunctionCollapse)**
- Each cell holds a superposition of patterns. The loop observes the cell with the lowest nonzero Shannon entropy, collapses it weighted by pattern frequency, and propagates. The lowest-entropy heuristic removes directional bias and works on irregular grids — [mxgmn/WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse)
- Overlapping model: NxN patterns from one bitmap (N=3 typical), optionally augmented with rotations and reflections; larger N copies the input more closely. Simple tiled model: tiles plus adjacency lists, with a D4 symmetry class for each tile to shorten the lists — [mxgmn/WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse)
- "Easy" tilesets never get stuck but give less interesting global structure. Some tilesets (Circuit, Summer, Rooms) can't derive their adjacencies from edge labels — [mxgmn/WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse)
- A contradiction is a cell with zero options. The problem is NP-hard, contradictions are rare in practice, and the reference implementation just stops. Backtracking appears in ports such as Boris the Brave's DeBroglie — [mxgmn/WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse)
- Games using WFC:
  - Bad North, Caves of Qud, Dead Static Drive, Townscaper (WFC plus marching cubes on irregular grids), The Matrix Awakens, Proc Skater 2016, Swapland, Bug with a Gun, Rodina.
  - JS ports: Kevin Chapelier's browser JS port and a p5.js port; Vasu Mahesh's TypeScript/WebGL port of the 3D tiled model.
  - MarkovJunior (same author) contains a 3D simple tiled model.
  - [mxgmn/WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse)

**Model synthesis and the constraint-solving view**
- Merrell: model synthesis (2007) and WFC (2016) "are nearly identical and produce very similar results". Model synthesis focused on 3D, WFC on 2D textures. Papers: i3D 2007, ACM TOG 2008 (continuous), PhD 2009, IEEE TVCG 2010 — [Paul Merrell, Model Synthesis](https://paulmerrell.org/model-synthesis/)
- Merrell used AC-3, WFC uses AC-4, and WFC drops Merrell's incremental modify-in-blocks method for reducing failures — [mxgmn/WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse)
- Karth & Smith, "WaveFunctionCollapse is constraint solving in the wild" (FDG 2017, DOI 10.1145/3102071.3110566): global restarts alone rarely succeed under global constraints, which suggests local backtracking — [UCSC course slides (Karth)](https://creativecoding.soe.ucsc.edu/courses/cmpm202_w20/slides/W2_Tues_Karth_WaveFunctionCollapse.pdf); [SIGMM Records on WFC](https://records.sigmm.org/?p=12589)
- Follow-up: "WaveFunctionCollapse: Content Generation via Constraint Solving and Machine Learning" (IEEE Transactions on Games, 2022) studies backtracking, heuristics and pattern classification — [eScholarship](https://escholarship.org/uc/item/1f29235t)
- The PCG book has a chapter "ASP with applications to mazes and levels" by Nelson & Smith (Ch. 8, pp. 143-157) — [PCG book](https://pcgbook.com/)

**Townscaper (Oskar Stålberg)**
- The grid: fill a hexagon with equilateral triangles, randomly merge pairs into quads, subdivide everything into quads, then relax. The goals were removing six-sided vertices and tiling to infinity. Relaxation runs across the whole grid so neighboring patches join, and encourages squarish cells — [Sylves docs, Townscaper Grid (reconstruction quoting Stålberg's 2019 tweet)](https://boristhebrave.com/docs/sylves/1/articles/tutorials/townscaper.html)
- Stålberg's IndieCade Europe 2019 talk "Organic Towns from Square Tiles" covers terrain and procedural building design (secondary listing) — [Wikipedia, Townscaper](https://en.Wikipedia.com/wiki/Townscaper)

### Inferences
- For Elsewhere, the simple tiled model with a hand-drawn set of about 10-30 isometric tiles is the right fit. Edge labels on the four iso edges work the same as on a square grid, because the iso diamond is a square grid seen at 2:1; only the drawing order changes.
- Keep WFC regions small (for example 12x12 cells, at most about 50 tile types) so propagation stays well under a frame budget. Use a bit-set per cell (Uint32Array words) and a stack-based AC-4 propagation.
- Determinism: entropy ties and weighted choices must draw from `ctx.rng('wfc:'+region)`, never `Math.random`. With a contradiction, "restart with the next sub-seed (`name+':'+attempt`) up to K tries" stays deterministic and is simpler than backtracking.
- Pre-place designer constraints (doors, paths, a fixed landmark) as already-collapsed cells before running. This is the most practical way to make WFC output look authored.
- Townscaper's irregular grid probably clashes with the house style (a strict 2:1 iso grid), but its dual-grid-plus-corner-tile idea transfers directly (see autotiling).

### Gaps
- Bad North's specific use of WFC and Stålberg's primary talk content were not retrieved, only secondary listings.
- No current (2026) benchmark of JS WFC ports on phones was found.
- The ndwfc (n-dimensional WFC, LingDong) status was not checked.
- No source was fetched on answer set programming tooling in JS (clingo-wasm exists, but was not verified here).

## Dungeons and levels: BSP, rooms and corridors, CA caves, drunkard's walk, Spelunky, Brogue, Isaac, Unexplored cycles, lock-and-key, Dead Cells, metroidvanias, pacing

### Takeaway
The best-documented shipped generators are all hybrids: hand-made pieces placed by a simple, constrained structure.
- Spelunky: a 4x4 grid of 10x8 templates with probabilistic tiles.
- Isaac: BFS growth on a 9x8 grid.
- Dead Cells: handmade room tiles placed to fit a per-biome concept graph.
- Brogue: room accretion, loop-adding by path distance, then CA lakes and "machines".
- Unexplored: graph-rewriting cycles on a 5x5 node grid, then expanded to tiles.

Each step is small, deterministic, and easy to run in JS. The way to get "authored" structure is the graph-first approach (cycles, lock-and-key) followed by tiles.

### Cited Findings
**Spelunky**
- The level is a 4x4 grid of rooms. Room types: 0 side room, 1 left/right exits, 2 left/right/bottom exits (top too if a type 2 sits above), 3 left/right/top exits. The start is in the top row — [Darius Kazemi, Spelunky Generator Lessons pt.1](https://tinysubversions.com/spelunkyGen/)
- The solution path:
  - Roll 1-5: 1-2 move left (40%), 3-4 move right (40%), 5 move down (20%).
  - At an edge, drop down and reverse.
  - Moving down sets the current room to type 2, and the room below must be type 2 or 3.
  - Dropping from the bottom row places the exit.
  - Every other cell is type 0.
  - 3-4 stacked type 0 rooms may become a snake pit.
  - [tinysubversions pt.1](https://tinysubversions.com/spelunkyGen/)
- Rooms are 10x8 tiles with about 8-16 templates per type, sometimes mirrored. Codes:
  - 0 empty; 1 solid; L ladder; P ladder-top platform.
  - 2: 50% solid. 4: 25% pushblock. 7: 33% spike.
  - 5 and 6: ground and air slots for 5x3 "obstacle blocks", each with its own templates of probabilistic tiles.
  - [Darius Kazemi, pt.2](https://tinysubversions.com/spelunkyGen2/)

**Brogue (Brian Walker). Community wiki flagged "needs verification"; numbers conflict slightly with another wiki.**
1. Profile: cave 33%, cross-room 100%, corridor 80%, doors 60%. Caps: 99 rooms, 30 loops. Rooms 4-20 x 3-7 — [brogue.wiki, Level generation](https://brogue.wiki/wiki/Level_generation)
2. Accretion: up to 600 attempts. Each attempt builds a room (with a corridor 80% of the time) and slides it against a wall of the existing map until it fits. Each wall gets 15 tries; the last 225 attempts build rooms only — [brogue.wiki](https://brogue.wiki/wiki/Level_generation)
3. Loops: up to 500 attempts or 30 loops. Open a wall into a doorway only if the floors on both sides are more than about 2 rooms apart by shortest path — [brogue.wiki](https://brogue.wiki/wiki/Level_generation)
4. Lakes: 55% fill, then 5 iterations of B5678/S45678 CA. Keep the largest blob that fits, starting at 30x15 and shrinking to 20x10 over 10 lakes. Reject any lake that breaks passability. Each lake gets a shallow "wreath" — [brogue.wiki](https://brogue.wiki/wiki/Level_generation)
5. Then: machines and treasure rooms (at depths 3, 7, 11..., each with a key holder), diagonal cleanup, bridges, orphan-door removal, and secret doors with chance (depth−1)×67/25 % — [brogue.wiki](https://brogue.wiki/wiki/Level_generation); compare [brogue.fandom.com](https://brogue.fandom.com/wiki/Level_Generation)

**Cellular automata caves (RogueBasin)**
- Fill 40-45% with walls. The 4-5 rule: a cell is a wall if its 3x3 block holds at least 5 walls. Tuned recipe: 4 passes of `R1>=5 || R2<=2` (R2 counts walls within 2 steps), then 3 passes of `R1>=5` — [RogueBasin, Cellular Automata Method](https://www.roguebasin.com/index.php/Cellular_Automata_Method_for_Generating_Random_Cave-Like_Levels)
- Connectivity: flood-fill from a random open cell, wall up whatever it doesn't reach, and regenerate if the open area falls below a threshold (about 45% open looks fine). Clearing a 3-4 tile horizontal strip before iterating prevents a vertical wall from splitting the map — [RogueBasin](https://www.roguebasin.com/index.php/Cellular_Automata_Method_for_Generating_Random_Cave-Like_Levels)

**Binding of Isaac**
1. 9x8 grid, start at cell 35. Room target = `random(2) + 5 + level*2.6` — [Boris the Brave, Dungeon Generation in Binding of Isaac (2020-09-12)](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
2. BFS queue. Skip a neighbor if it is occupied, already has more than one filled neighbor, the target is reached, or a 50% roll fails. Cells that add nothing are dead ends — [Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
3. Restart if the count is wrong or the boss would sit next to the start. The boss goes in the farthest dead end; special rooms go in other dead ends — [Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
4. The secret room goes in an empty cell touching 3 or more rooms and no dead ends, with the criteria relaxed after 300 and again after 600 tries, so it always succeeds — [Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)

**Unexplored (Joris Dormans): cyclic generation**
- Two generators:
  - A dungeon generator writes 20 level requests.
  - A floorplan generator builds each level, using about 50 Ludoscope modules and about 5,000 graph find-replace rules.
  - [Boris the Brave, Dungeon Generation in Unexplored (2021-04-10)](https://www.boristhebrave.com/2021/04/10/dungeon-generation-in-unexplored/)
- Steps:
  1. Start from a 5x5 grid of nodes that are never moved or deleted, only annotated, so mapping to tiles stays easy.
  2. Draw a start, a goal and a rough loop between them (about 40 rules).
  3. Pick one of 24 major cycle types. Examples: two alternative routes; ThreeLeverHub (three keys plus a guardian); a hub; a lake cycle.
  4. Insert minor cycles and dead ends until the level reaches its target size.
  5. Resolve abstractions using "biomes" (theme, enemy pools) and non-terminal symbols. Lock and key pairs are linked by an edge.
  - [Boris the Brave](https://www.boristhebrave.com/2021/04/10/dungeon-generation-in-unexplored/)
- To tiles: double the grid (corridor and door slots), expand it 5x, and shape each 5x5 block by rules. Caves and tunnels get small CA; set pieces are placed by pattern matching — [Boris the Brave](https://www.boristhebrave.com/2021/04/10/dungeon-generation-in-unexplored/)
- Cycles can nest, and lock-and-key and hidden-shortcut are cycle types. A reviewer noted failures such as keys placed on the wrong side of a door — [Game Developer, Unexplored's secret: cyclic dungeon generation](https://gamedeveloper.com/design/unexplored-s-secret-cyclic-dungeon-generation-)
- The PCG book's "Grammars and L-systems with applications to vegetation and levels" chapter is co-written by Dormans (Ch. 5) — [PCG book](https://pcgbook.com/)

**Dead Cells (Sébastien Bénard, Motion Twin; 2020-02-15, originally on Gamasutra)**
1. The island framework (biome connections, key locations) is handmade and fixed across seeds.
2. Handmade room tiles are made for each biome and each purpose (combat, treasure, merchant), defined by their entrances and exits.
3. Each biome has a concept graph: entrance and exit first, then special rooms, then combat and exploration tiles. The graph controls level length, how labyrinthine the level is, and the entrance-to-exit distance.
4. The generator picks random rooms from the biome pool until each node's requirements are met.
5. Monster count comes from combat-tile length, for example one monster per 5 combat tiles. A dangerous monster costs about 10 tiles.
6. Pacing follows dramatic peaks and breaks, borrowed from Left 4 Dead's AI Director.
- [Deepnight, The level design of Dead Cells: a hybrid approach](https://deepnight.net/tutorial/the-level-design-of-dead-cells-a-hybrid-approach/)

**General references**
- PCG book Ch. 3, "Constructive generation methods for dungeons and levels" (Shaker, Liapis, Togelius, Lopes, Bidarra) covers BSP, agent-based (drunkard's) digging, CA and grammars — [PCG book](https://pcgbook.com/)

### Inferences
- For phone-scale quests, the strongest pattern is **graph first, then templates**:
  1. A tiny Unexplored-style node grid (for example 4x4 or 5x5) with a start, a goal and one cycle.
  2. Optionally a lock-and-key pair, with the key placed on the arc reachable without the lock.
  3. Each node filled from a hand-drawn room template, in Spelunky style with probabilistic glyphs.
  - All three steps are O(nodes) and trivially deterministic.
- Spelunky's probabilistic glyph templates are a cheap, high-yield way to keep the hand-drawn look of eight-ink pixel art while still varying every seed. Templates can be strings inside the quest file, which keeps quests as one closure.
- For a talk-driven, small-world game like Elsewhere, Brogue's loop-adding rule ("open a wall only if the path between its two sides is long") generalizes: compute BFS distance on the room graph and add a shortcut edge when it would cut more than N steps. It is the simplest fix for tree-like, dead-end-heavy layouts.
- Use Dead Cells' "monsters (or encounters) per N combat tiles" and "peaks and breaks" pacing as budget rules, not as simulation.
- Drunkard's walk and BSP were not separately sourced here, beyond the PCG book chapter listing. Both are a few lines of code: BSP splits rectangles recursively until a minimum size and joins sibling centers; drunkard's walk carves until X% of the map is floor.

### Gaps
- No primary 2026 source was fetched for BSP or drunkard's-walk parameters (RogueBasin has pages).
- Metroidvania-specific generation (ability-gated graphs) was not sourced beyond lock-and-key cycles.
- Spelunky 2's changes and template weighting are unknown; Kazemi notes that the weighting isn't documented.
- Brogue's numbers come from community wikis flagged for verification; the primary source is the Brogue CE code. The 2015 Rock Paper Shotgun interview couldn't be fetched.
- Dormans's own papers (mission and space grammars, 2010-2011) were not fetched directly.

## Settlements and structures: Watabou, building and house generators, interiors, road networks, fields

### Takeaway
Settlement generators in practice are geometric:
- Watabou's city generator: Voronoi wards (via Delaunator), then lot subdivision (bisection, Voronoi or "twisted"), then buildings.
- Parish & Müller (SIGGRAPH 2001): roads from L-systems steered by global goals (density, grid or radial pattern) and local constraints (water, slope, snapping to existing roads to close loops).

For a small pixel town on a tile grid, simpler versions work: a few roads by noise-weighted A* or a grown street tree, lots by recursive bisection, buildings by footprint rules, and interiors by WFC or template rules.

### Cited Findings
**Watabou's generators**
- Watabou said the only special procedural piece in the Medieval Fantasy City Generator is the Voronoi diagram, which he now thinks is "not really necessary"; the rest is "generic geometric stuff and random numbers" — [itch.io comment by watabou](https://itch.io/post/346778) (via search summary)
- Version 0.7.3 replaced a naive Bowyer-Watson triangulation with a port of Delaunator. Version 0.9.0 added a "Lots method" setting (Bisection, Voronoi, Twisted). A later version mentions a straight-skeleton-based algorithm — [MFCG devlogs](https://watabou.itch.io/medieval-fantasy-city-generator/devlog/179534/080-new-buildings-improved-ui); [0.11.1 devlog](https://watabou.itch.io/medieval-fantasy-city-generator/devlog/715292/0111-improved-map-labels); [Patreon 0.9.0](https://www.patreon.com/posts/61026228)
- Users choose a number of inner wards (for example 20, including market and temple, excluding the castle) — [itch.io forum](https://itch.io/post/621309)
- One Page Dungeon: rooms joined by doors and corridors, aiming for "traces of symmetry". The text generator was the hard part, and simple random lists gave incoherent descriptions: "Narrative stuff is hard." — [RandRoll interview with Watabou (2020-12-21)](https://randroll.com/interview-watabou-2)

**Roads and cities (Parish & Müller, 2001)**
- "Procedural Modeling of Cities" (SIGGRAPH 2001, pp. 301-308) extends L-systems with global goals and local constraints. Global: population density and superimposed patterns (grid, radial). Local: land, water, vegetation, elevation — [SIGGRAPH History Archive](https://history.siggraph.org/?p=116923); [VU student report](https://math.vu.nl/~eliens/archive/student/material/procedural-content.pdf)
- New roads can snap to existing ones and form closed loops. The pipeline goes on to subdivide land and create buildings — [McGill paper](https://www.sable.mcgill.ca/~clump/papers/rudzicz-08-iterated.pdf); [Watson et al. 2008 tutorial](https://peterwonka.net/Publications/pdfs/2008.CGA.Watson.ProceduralModelingTutorial.pdf)

**Caves of Qud's split between fixed and generated places**
- Towns are largely fixed, while wilderness, dungeons and some history and lore are generated each game. Brian Bucklew credits the hybrid with providing "a static backbone to deliver some of the deep world building and lore" (inspired by Omega and ADOM) — [Game Developer, John Harris (2022-03-10)](https://www.gamedeveloper.com/design/tapping-into-the-potential-of-procedural-generation-in-caves-of-qud)

### Inferences
- A town recipe sized for a tile grid in a phone game:
  1. A main road as a Bézier or noise-perturbed line across the frame (the land runs off the edges, so roads should too).
  2. Side streets branch off at intervals by a tiny Parish & Müller-style growth: extend, turn by a small rng angle, stop at water or slope, snap to a road within r tiles.
  3. Blocks between roads are split by recursive bisection into lots of at least w x h tiles.
  4. Each lot gets a building footprint (a rectangle, L or T) set back by 1 tile.
  5. Fields fill the leftover lots outside the core, as strips aligned to the nearest road.
- On an isometric 2:1 grid, buildings are best as stacked tile modules (footprint, wall course, roof by the footprint's shape). WFC or template rules can pick facade details from a small set while keeping the eight-ink palette.
- Interior furnishing: rule-based placement ("bed against a wall away from the door", "table in the center with chairs on free sides") over a room's wall and door mask, or the simple tiled WFC with the door cells pre-collapsed.
- For Elsewhere's "places with people", Watabou's lesson ("narrative stuff is hard") argues for generating places from the people's needs: who lives here gives the house, their job gives the workshop. Do not generate text from random lists.

### Gaps
- No full write-up of Watabou's ward and building algorithms was found; his Reddit and blog explanation was not retrieved.
- His Village, Dwellings and Perilous Shores generators were not covered by the fetched interview.
- No source was fetched for interior furnishing algorithms, such as Make It Home (Yu et al. 2011) or Germer & Schwarz 2009 "Procedural arrangement of furniture".
- Farm and field layout was not sourced.

## History and simulation-driven worlds: Dwarf Fortress, Caves of Qud, Ultima Ratio Regum, Wildermyth; places with people

### Takeaway
- Dwarf Fortress: history is "a giant zero-player strategy game" run after terrain generation. Civilizations are placed, then simulated for N years, and sites emerge, capped by settings.
- Caves of Qud: a bounded, legible history of 5 sultan periods. Generated sultans, events and lore are tied to generated historic sites in the world.
- Wildermyth: generation focuses on characters rather than plot, because procedural plot "was hard".

For Elsewhere, whose people are Tyrell minds, the transferable idea is Qud-style: a short generated backstory whose events point at concrete places and objects the player can find. Do not simulate centuries.

### Cited Findings
- **Dwarf Fortress history:** civilizations and caves are placed first. History is simulated over the chosen length as "a giant zero-player strategy game", and towns and hamlets emerge, capped by a maximum-sites setting. World parameters: World map size, History length, Number of civilizations, Maximum number of sites, Number of beasts, Natural savagery, Mineral occurrence — [Dwarf Fortress Wiki](https://dwarffortresswiki.org/index.php/World_generation)
- **Caves of Qud's sultans:** every history has 5 initial periods of sultan rule with 5 generated sultans (names, life events, lore recounting those events, recurring themes). Sultans of periods 4 and 5 each get two historic sites, drawn from the 2-3 historical regions added during their reign — [Caves of Qud Wiki, World generation](https://wiki.cavesofqud.com/wiki/World_generation)
- The history system draws on Dwarf Fortress and Epitaph — [Wikipedia, Caves of Qud](https://en.wikipedia.org/wiki/Caves_of_Qud)
- **Caves of Qud papers and talks:**
  - Jason Grinblat's GDC 2018 talk "Procedurally Generating History in Caves of Qud" — [GDC Vault](https://gdcvault.com/play/1025914)
  - Grinblat & Bucklew, "End-to-End Procedural Generation in Caves of Qud" (EXAG at AIIDE 2020) — [CEUR-WS Vol-2862 paper5](https://ceur-ws.org/Vol-2862/paper5.pdf). The PDF was retrieved but its text couldn't be extracted.
- **Wildermyth:**
  - Nate Austin says the team focused on character development rather than plot, and that procedural plot was hard to get working — [Turn Based Lovers interview](https://turnbasedlovers.com/10-turns-interview/with-wildermyth-developer)
  - The overland is a randomly generated tile board under fog of war, and most tiles trigger generic events. The Omenroad DLC switched to a node map — [RPG Site review](https://rpgsite.net/review/12107-wildermyth-review); [Inverse](https://inverse.com/gaming/wildermyth-omenroad-dlc-release-announcement)

### Inferences
- A "places with people" loop for a quest:
  1. Generate 3-6 people (minds), each with one need and one relationship.
  2. Generate a tiny history: 3-5 events, each linking two people or a person and a place, Qud style.
  3. Lay out the place so each event leaves a physical trace the player can find: a ruined house, a grave, a locked shed.
  4. Feed the event list to the minds as memories.
  - Everything is seeded by `ctx.rng('history')`, so the save stores only the seed plus deltas.
- Qud's "5 fixed periods, generated contents" is the authored-structure-with-procedural-fill pattern again, which keeps generated lore legible.
- A full Dwarf Fortress-style simulation is out of budget for a phone and out of scope for small worlds. A handful of pre-simulated "ticks" (for example, the village grew from 3 houses to 7, and one burned) gives most of the texture.

### Gaps
- Could not extract the text of the Qud AIIDE 2020 paper. The FDG 2017 paper on Qud's mythic biographies (which reportedly generates events first and rationalizes causes afterwards) was not found by search, so that claim is unverified here.
- Ultima Ratio Regum (Mark R. Johnson) was not researched for lack of tool budget; his blog and the PhD/talk material are the sources to check.
- Talk of the Town (James Ryan) and other "simulate a town, then let the player discover it" research was not fetched.

## Tile presentation: autotiling, Godot terrain sets, LDtk auto-layers, Tiled terrains, transitions, Poisson-disk decoration, chunks and per-chunk seeding

### Takeaway
Store terrain on cell corners (a dual grid) and draw tiles chosen by the 4-bit corner mask (marching squares).
- That needs 16 tiles for two terrains, or 6 with rotation, against 47-48 for the blob set.
- It handles transitions between terrains cleanly, and suits an isometric diamond grid equally well.

Decoration comes from Bridson Poisson-disk sampling (k=30, O(n)), with density from noise or biome. Chunked worlds seed each chunk as hash(worldSeed, cx, cy) so any chunk can be regenerated independently.

### Cited Findings
**Tileset classification (Boris the Brave)**
- Edge (Wang) tiles S-E2: 16. Corner (marching squares) S-V2: 16. Three-value corners: 81. Blob S-V2E2: 47. Blob with rotation and mirroring: 16. Corner with rotation and mirroring: 6. Triangle corner: 16 (4 with symmetry) — [Boris the Brave, Classification of Tilesets (2021-11-14, updated 2025-02-28)](https://www.boristhebrave.com/2021/11/14/classification-of-tilesets/)
- The blob set needs both corner and edge information. Of the 256 raw combinations, the impossible ones are removed to get 47 — [Boris the Brave](https://www.boristhebrave.com/2021/11/14/classification-of-tilesets/)

**Dual grid and quarter tiles**
- Dual grid: draw tiles at a half-cell offset and choose each by marching squares from the terrains at the dual cell's corners, which are the base cell centers. It needs 6 tiles with rotation, 16 without. It is simple, needs few tiles and extends easily, but is "hard to get your head around", and ambiguous tiles must be handled. Boris calls it "a substantial improvement" over the 48-tile blob — [Boris the Brave, Quarter-Tile Autotiling (2023-05-31)](https://www.boristhebrave.com/2023/05/31/quarter-tile-autotiling/)
- Quarter tiles: each quarter depends on the cell and its 3 touching neighbors (6 rules). It needs 5 half-size tiles with rotation (14-20 without). It can't make curves larger than half a tile, and has no clean multi-terrain extension. Marching squares handles larger curves and multiple terrains, at the cost of more tiles — [Boris the Brave](https://www.boristhebrave.com/2023/05/31/quarter-tile-autotiling/)
- Other sources state 2⁴ = 16 dual-grid tiles for two terrains (Red Blob's experimental autotile pages) and contrast 47 single-grid tiles with 15 for the dual grid (SpriteCook, 2026-06-12) — [Red Blob Games autotile](https://www.redblobgames.com/articles/autotile/claude/); [SpriteCook, Dual grid tilesets explained](https://www.spritecook.ai/blog/dual-grid-tilesets-explained)

**Engines and editors**
- Godot 4 terrain modes: Match Corners and Sides, Match Corners, Match Sides. Peering bits sit in a 3x3 layout around each tile. If nothing matches, the matcher falls back to an arbitrary close tile — [Godot TileSet docs](https://docs.godotengine.org/en/4.2/classes/class_tileset.html); [uhiyama-lab notes](https://uhiyama-lab.com/en/notes/godot/terrains-autotile-setup/)
- The better-terrain plugin replaces Godot 3's "3x3" and "3x3 minimal" modes — [Portponky/better-terrain](https://github.com/Portponky/better-terrain)
- LDtk auto-layer rules are grid patterns over an IntGrid layer that decide whether to paint a tile, for example grass where "walls" has no wall above. Rules update live as IntGrid values are painted — [LDtk docs, Auto-layer rules (updated 2022-02-16)](https://ldtk.io/docs/general/auto-layers/auto-layer-rules/)

**Decoration scattering**
- Bridson (SIGGRAPH 2007): Poisson-disk samples in O(N) in any dimension, with a rejection limit k=30 by default — [Bridson 2007 PDF](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf)
- Games commonly place objects such as shrubs at Poisson-disk sample positions. A variant varies the minimum distance by Perlin noise to vary density. Larger k packs tighter but runs slower — [devmag, Poisson disk sampling (2009)](https://devmag.org.za/2009/05/03/poisson-disk-sampling/)
- An improved Bridson variant is reported to run up to 20x faster — [Extreme Learning](https://extremelearning.com.au/an-improved-version-of-bridsons-algorithm-n-for-poisson-disc-sampling/)

### Inferences
- **Dual grid on the 2:1 isometric grid.** Store a terrain id per base vertex, and draw one diamond per dual cell chosen by `mask = tl | tr<<1 | br<<2 | bl<<3` (using the iso orientation's corners). Two terrains need 16 diamond tiles. Pairwise transitions between N terrains are manageable by layering: draw each terrain in a priority order, its own 16-tile set alpha-masked over the ones below (a "binary dual grid per layer"). That needs 16 x N tiles, not combinatorial sets. This fits the "eight inks" rule, because Ink stores palette indexes and the layered sets reprint in any palette.
- With rotation, only 6 base shapes need drawing (empty, one corner, edge, two opposite corners, three corners, full). But iso lighting usually breaks rotational symmetry, because a dark outline and lit faces differ per side, so budget for all 16.
- Determinism for scatter: run Bridson with `ctx.rng('scatter:'+chunk)`. To keep chunk borders seamless, either generate scatter on a global grid of cells with one seeded point per cell (jittered grid, "blue-ish" noise; cheapest and fully local), or run Bridson per chunk while including neighbor chunks' points within r.
- Per-chunk seeds: `Tycho.seed.hashString(seed + ':' + cx + ',' + cy)` gives each chunk an independent stream. Noise needs no per-chunk seeding, since it is a pure function of world coordinates.
- LDtk-style rules (a small pattern matrix, then a tile, with a chance and first-match-wins) are a good format for a quest's own decoration rules in plain JS data.

### Gaps
- Tiled's "terrain sets / Wang sets" docs were not fetched.
- LDtk's advanced rule features (pattern sizes, modulo, Perlin, break-on-match, stamps) were not confirmed from the fetched page.
- No source was found for dual grid on isometric grids specifically; the iso adaptation above is an inference.
- Stålberg's original dual-grid tweet or thread was not retrieved.

## Libraries and research in JS and PCG as of 2026: rot.js, simplex-noise, WFC ports, ndwfc, delaunator, PRNGs, books, procjam, the PCG workshop

### Takeaway
Elsewhere installs nothing for the game, so the key libraries are short enough to vendor or reimplement in about 100 lines each:
- simplex-noise.js 4.0.3 (MIT, about 2 KB gzipped, seeded by passing a PRNG function).
- delaunator (used by mapgen4 and Watabou).
- sfc32 or mulberry32 as PRNGs.
- rot.js: a full roguelike toolkit (maps, FOV, pathfinding, seeded RNG), useful as reference code.

The PCG book (Springer 2016) is free online. The PCG Workshop reached its 17th edition in 2026, and PROCJAM 2025 ran Nov 21 - Dec 1, 2025.

### Cited Findings
**simplex-noise.js**
- Version 4.0.3. `createNoise2D/3D/4D(prng?)` return values in [-1,1], and the default seed is `Math.random()`. Seed with `createNoise2D(alea('seed'))`. MIT, about 2 KB min+gz, dependency-free — [jwagner/simplex-noise.js](https://github.com/jwagner/simplex-noise.js)
- Benchmark on a Ryzen 5950X: about 72.9M noise2D, 47.9M noise3D, 35.6M noise4D ops per second (about 20 ns per 2D sample) — [jwagner/simplex-noise.js](https://github.com/jwagner/simplex-noise.js)
- Determinism caveats:
  - 4.0.0 changed output values.
  - Use a fresh `alea(seed)` for each `create` call to reproduce results.
  - Coordinates above 2^31 may stop being noisy.
  - [jwagner/simplex-noise.js](https://github.com/jwagner/simplex-noise.js)

**PRNGs**
- bryc ranks sfc32 (128-bit state, passes PractRand) and mulberry32 (32-bit state, very fast, passes gjrand) as the best seedable JS PRNGs. He notes xoshiro128** has weak low bits — [bryc/code PRNGs.md](https://github.com/bryc/code/blob/master/jshash/PRNGs.md)
- One gist commenter claims mulberry32 isn't equidistributed (it can't produce all 32-bit values). The same gist reports SplitMix32 failing at 4 GB of output while mulberry32 passed 16 GB — [tommyettinger gist](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c)
- A single Firefox 129 benchmark measured about 43M, 42.7M and 33.7M ops/s for splitmix32, mulberry32 and sfc32 — [MeasureThat](https://measurethat.net/Benchmarks/ShowResult/626378)

**Other libraries**
- rot.js manual sections: Map creation (Maze, Cellular, Dungeon), RNG, Noise, FOV, Pathfinding (© 2012– Ondřej Žára) — [rot.js manual](https://ondras.github.io/rot.js/manual/)
- WFC JS ports: Kevin Chapelier's (browser) and a p5.js port; Vasu Mahesh's TypeScript/WebGL 3D tiled model — [mxgmn/WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse)
- delaunator and poisson-disk-sampling are used by mapgen4 — [Red Blob mapgen4](https://www.redblobgames.com/maps/mapgen4/). Watabou's MFCG uses a Delaunator port — [MFCG devlog](https://watabou.itch.io/medieval-fantasy-city-generator/devlog/179534/080-new-buildings-improved-ui)

**Research and community**
- PCG book: *Procedural Content Generation in Games* (Shaker, Togelius, Nelson; Springer 2016; DOI 10.1007/978-3-319-42716-4). Author PDFs of every chapter are free online. Chapters include constructive dungeons, fractals/noise/agents, grammars and L-systems, ASP, mixed-initiative, and evaluating generators — [pcgbook.com](https://pcgbook.com/)
- PCG Workshop: pcgworkshop.com lists the 17th workshop (2026). The 16th (2025) was co-located with FDG 2025 — [pcgworkshop.com](https://pcgworkshop.com/); [CFP](https://pcgworkshop.com/cfp.php)
- PROCJAM 2025 ran 2025-11-21 to 2025-12-01 on the theme "Cold Places", with about 64-66 entries, no winners, and the single rule "make something that makes something" — [itch.io PROCJAM](https://itch.io/jam/procjam)

### Inferences
- Since Tycho already exposes `Tycho.seed.Rng` and `hashString`, the quest code needs only:
  - a simplex/OpenSimplex 2D function taking an rng, built on a permutation table shuffled by `ctx.rng('noise:'+channel)`;
  - fBm and ridged helpers;
  - Poisson-disk;
  - flood fill and BFS;
  - a small WFC.
  - Each is under about 150 lines, so they could be offered to Tycho as engine options (per the CLAUDE.md rule) rather than vendored per quest.
- Pin noise behavior with a golden test, since the simplex-noise 4.0 output change shows how library upgrades silently change worlds. Elsewhere's `test/golden.json` already catches this at the frame level.
- Floating-point determinism: JS numbers are IEEE doubles and `Math.sin/cos/pow` may differ in the last bits across engines. Noise and erosion that branch on thresholds could, rarely, diverge across browsers. Prefer integer hashing and table-based gradients, and avoid `Math.pow`/`sin` in decisions; using them for rendering only is fine. This is a general engineering inference, not sourced.

### Gaps
- OpenSimplex2 JS port, ndwfc, and the "PCG libraries" named in the brief (for example a "pcg-random" npm package) were not verified for 2026.
- No 2026 phone benchmarks for any of these libraries were found.
- *Procedural Generation in Game Design* (Short & Adams, CRC 2017) was not fetched.
- The 2026 PCG Workshop venue and dates were not found.

## Evaluation: making generated worlds feel authored (designer constraints, curated pieces, checked seeds, generate-and-test, expressive range)

### Takeaway
Every shipped generator studied here gets its "authored" feel the same way:
- Hand-made structure on top: Dead Cells' fixed island, Qud's static towns and 5 sultan periods, Spelunky's guaranteed solution path, Unexplored's 24 designed cycle types.
- Hand-made pieces at the bottom: templates and room tiles.
- Generate-and-test checks in between: Isaac restarts, Brogue rejects lakes that break passability, Dwarf Fortress rejects worlds.

Expressive range analysis (Smith & Whitehead) checks the generator as a whole. It plots many seeds on two metrics as a heatmap.

### Cited Findings
- Dead Cells: a fixed handmade framework, handmade room tiles, per-biome concept graphs, and pacing by peaks and breaks. "The algorithm runs only once all constraints and the overall design are set" (paraphrase) — [Deepnight (2020)](https://deepnight.net/tutorial/the-level-design-of-dead-cells-a-hybrid-approach/)
- Caves of Qud: a static backbone for worldbuilding plus generated wilderness, dungeons and history — [Game Developer (2022)](https://www.gamedeveloper.com/design/tapping-into-the-potential-of-procedural-generation-in-caves-of-qud)
- Generate-and-test inside generators:
  - Isaac restarts the whole floor on a wrong room count or a boss next to the start — [Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
  - Brogue rejects lakes that break passability and guarantees paths that don't depend on bridges — [brogue.wiki](https://brogue.wiki/wiki/Level_generation)
  - Dwarf Fortress rejects worlds that fail its peak and biome checks — [DF Wiki](https://dwarffortresswiki.org/index.php/World_generation)
  - RogueBasin regenerates caves whose connected area is too small — [RogueBasin](https://www.roguebasin.com/index.php/Cellular_Automata_Method_for_Generating_Random_Cave-Like_Levels)
- Spelunky guarantees a solution path before filling side rooms — [tinysubversions](https://tinysubversions.com/spelunkyGen/)
- Unexplored stores lock/key relationships so the game's "Pray For Help" feature can find and fix blockers at runtime — [Boris the Brave](https://www.boristhebrave.com/2021/04/10/dungeon-generation-in-unexplored/)
- Expressive range analysis (Smith & Whitehead) scores many generated outputs on chosen metrics and plots them as a heatmap of the generator's range, to guide tuning — [Tension Space Analysis paper (arXiv 2004.10808), describing ERA](https://arxiv.org/pdf/2004.10808)
- The PCG book has "Evaluating content generators" (Ch. 12) and "Mixed-initiative content creation" (Ch. 11) — [pcgbook.com](https://pcgbook.com/)
- Karth & Smith: global restarts struggle with global constraints, so prefer local backtracking or solvers — [UCSC slides](https://creativecoding.soe.ucsc.edu/courses/cmpm202_w20/slides/W2_Tues_Karth_WaveFunctionCollapse.pdf)
- Watabou: coherent generated descriptions were the hardest part ("Narrative stuff is hard") — [RandRoll (2020)](https://randroll.com/interview-watabou-2)

### Inferences
- For Elsewhere's harness (a bot per quest, smoke tests, golden frames), the natural check is **generate-and-test at test time across many seeds**:
  1. For each quest with generation, run the generator over, say, 1,000 seeds in Node.
  2. Assert invariants: reachable goal, a door count in range, no isolated people, an ink count of at most 8.
  3. Optionally emit ERA-style metrics (path length vs. openness) as a heatmap image into `test/out/`.
  - At runtime, generate with sub-seeds `seed:attempt` until the invariants pass (bounded), so it stays deterministic.
- **Checked seeds:** since Elsewhere seeds each quest from the save seed, a quest can also ship a short allowlist of curated seeds for its first visit. That guarantees a good first impression, after which it is fully procedural.
- For "curated pieces" in the eight-ink style, the strongest leverage is templates with probabilistic glyphs (Spelunky) plus a designed macro-structure (Dead Cells, Unexplored), not unconstrained noise or WFC at the top level.
- Because talk drives quests in Elsewhere, place-generation constraints should come from the quest's people: every person needs a reachable home and work spot, and every story beat a physical location. Validate this in the same generate-and-test loop.

### Gaps
- The original Smith & Whitehead 2010 paper ("Analyzing the expressive range of a level generator", PCG workshop 2010) and its linearity and leniency metrics were not fetched. The definitions come from secondary description only.
- Kate Compton's "So you want to build a generator" (the "10,000 bowls of oatmeal" problem) failed to fetch (HTTP 500), so it is not cited.
- No source quantifies how many seeds shipped games test or curate.
