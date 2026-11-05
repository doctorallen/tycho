# Worlds and levels

How the study's sources make terrain, levels, tile dressing, scatter and settlements, and how they keep the results good. The best-documented generators are hybrids in which each step is small: noise and climate tables make terrain, a graph comes first for a level and templates fill it, wave function collapse (WFC) works on small regions with designer cells fixed before it starts, a dual-grid autotiler dresses the result, Poisson-disk scatter decorates it, and a sweep over many seeds proves it. Every shipped generator's authored feel comes from three layers: hand-made structure on top, hand-made pieces at the bottom, and generate-and-test in between.

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md).

Text marked *(inference)* is reasoning from the sources, not a sourced fact.

- [Terrain from noise and climate tables](#terrain-from-noise-and-climate-tables)
- [Levels: a graph first, then templates](#levels-a-graph-first-then-templates)
- [Wave function collapse in small regions](#wave-function-collapse-in-small-regions)
- [Autotiling on a dual grid](#autotiling-on-a-dual-grid)
- [Scatter](#scatter)
- [Places with people](#places-with-people)
- [Generate, then test](#generate-then-test)
- [Sources](#sources)

## Terrain from noise and climate tables

Red Blob Games documents the standard terrain pipeline ([terrain from noise](https://www.redblobgames.com/maps/terrain-from-noise/)):

| Step | How |
|---|---|
| Octaves | Sum noise octaves with halving amplitudes, and divide by the total |
| Reshape | `pow(e·fudge, exponent)` flattens the valleys |
| Island | Mix in a falloff toward the edges, if the map is an island |
| Ridges | `2·(0.5 − abs(0.5 − n))`, each octave weighted by the ones before it, so only mountains get detail |
| Terraces | `round(e·n)/n` |
| Biomes | A second noise channel gives moisture; an elevation-by-moisture table names the biome, from ocean to tropical rain forest |

Minecraft generalizes the table. Each biome is a "noise hypercube" in a space of temperature, humidity, continentalness, erosion and weirdness, and the biome at a point is the closest hypercube ([Fabric Yarn docs](https://maven.fabricmc.net/docs/yarn-1.20.4+build.1/net/minecraft/world/biome/source/util/MultiNoiseUtil.NoiseHypercube.html)). Storing biomes as points means adding one never rewrites a chain of thresholds *(inference)*.

Domain warping, `fbm(p + 4·q)` with `q` itself an fBm, makes coastlines look authored rather than blobby ([Inigo Quilez, via search excerpt](https://iquilezles.org/articles/warp)). Droplet erosion carves believable valleys for tens of milliseconds of work ([xarray-spatial](https://xarray-spatial.readthedocs.io/en/stable/_modules/xrspatial/erosion.html)). On tiny maps, rivers that run by steepest descent from high ground to water are cheaper and fully deterministic, in the style of Dwarf Fortress ([DF Wiki](https://dwarffortresswiki.org/index.php/World_generation)).

<figure class="demo"><div class="stage" data-demo="terrain"></div>
<figcaption><b>Noise terrain and biomes.</b> Octaves of noise, domain warping (<code>fbm(p + 4q)</code>) so coasts look drawn, and an elevation-by-moisture table that names the biome, after Red Blob Games. Rivers run downhill from high ground. Minecraft generalizes the table to "the nearest point in climate space", which lets a game add a biome without rewriting thresholds.</figcaption></figure>

Two of the games already do this:

- **Merryfolk** runs the most complete local version: fBm with ridges and knolls quantized to four terraces, then Priority-Flood depression filling, D8 flow accumulation and a wetness index ([Merryfolk terrain.js](https://github.com/doctorallen/merryfolk/blob/main/js/terrain.js)).
- **Lodestar** lays its climes as a Voronoi field on a jittered grid with noise-warped borders, blending across them ([Lodestar regions.js](https://github.com/doctorallen/lodestar/blob/main/js/regions.js)).

For Elsewhere, two details matter. The land must run off every edge, so unshaped noise beats island masks. And terraces of four to six steps map straight onto the cliff faces a 2:1 isometric grid can show, which suits a moor of low rises *(inference)*.

Erosion, rivers and settlements done physically are in [Real geography](geography.md).

## Levels: a graph first, then templates

The best-documented level generators are hybrids, and each step is small.

| Game | Structure | The numbers |
|---|---|---|
| Spelunky | A 4×4 grid of rooms; a walk lays the solution path, and each room is a 10×8 template whose glyphs are themselves chances | The walk moves left or right 40% of the time each and down 20%, which guarantees a solution; glyph "2" is 50% solid, "7" is 33% spike ([Kazemi pt.1](https://tinysubversions.com/spelunkyGen/); [Kazemi pt.2](https://tinysubversions.com/spelunkyGen2/)) |
| The Binding of Isaac | Rooms grown by breadth-first search; the boss in the farthest dead end | A 9×8 grid; restarts when the room count is wrong ([Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)) |
| Brogue | Accreted rooms; a loop added only where the two sides of a wall are far apart by path | Lakes grown from 55% fill with five passes of a B5678/S45678 automaton; any lake that breaks passability is rejected ([brogue.wiki](https://brogue.wiki/wiki/Level_generation)) |
| Cellular-automaton caves | Random walls smoothed by the 4-5 rule, then a flood fill keeps the connected area | 40 to 45% walls to start ([RogueBasin](https://www.roguebasin.com/index.php/Cellular_Automata_Method_for_Generating_Random_Cave-Like_Levels)) |
| Unexplored | Cycles on a fixed 5×5 node grid, rewritten (lock-and-key, hidden shortcuts), each node expanded into a 5×5 block of tiles | **24 major cycle types and about 5,000 graph rewrite rules** ([Boris the Brave](https://www.boristhebrave.com/2021/04/10/dungeon-generation-in-unexplored/)) |
| Dead Cells | A fixed island framework; each biome a concept graph filled with handmade room tiles | Monsters budgeted, for example **one per five combat tiles** ([Deepnight](https://deepnight.net/tutorial/the-level-design-of-dead-cells-a-hybrid-approach/)) |

<figure class="demo"><div class="stage" data-demo="dungeons"></div>
<figcaption><b>Four dungeon recipes.</b> Binary space partition rooms, cellular-automaton caves (start at about 45% walls, apply the 4-5 rule, keep the largest region), a drunkard's walk, and Spelunky's 4×4 room grid, where a walk guarantees the solution path and each room is a template of chances.</figcaption></figure>

Neo already uses this shape: a random walk on a 7×7 grid that leans north, hand-drawn room templates mirrored at random, and flood-fill checks, pinned by golden hashes over 2,500 floors ([Neo dungeon.js](https://github.com/doctorallen/Neo/blob/main/js/dungeon.js)). Lodestar's `generateFloor` mixes ellipse caverns whose radius ripples by `sin(3a)` and `sin(5a)`, drifting tunnels with loops, one automaton smoothing pass, a flood-fill prune and random-walk ore veins ([Lodestar floor.js](https://github.com/doctorallen/lodestar/blob/main/js/floor.js)). Elsewhere's plan (its `PLAN.md`) names exactly this code as the source of "`gen` in Tycho's world layer ... for the moor and the dig".

A quest-sized recipe follows *(inference)*:

1. Lay a 4×4 or 5×5 node graph with a start, a goal and one cycle.
2. Optionally add a lock and key, with the key on the side reachable without the lock.
3. Fill each node from probabilistic templates written as strings inside the quest file, which keeps the quest one closure.

## Wave function collapse in small regions

WFC is Paul Merrell's 2007 model synthesis reinvented for bitmaps. It observes the cell with the lowest entropy, collapses it by weighted frequency and propagates constraints. The simple tiled model, with adjacency lists and symmetry classes, is the practical one for a drawn tileset ([mxgmn/WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse); [Merrell](https://paulmerrell.org/model-synthesis/)). The problem is NP-hard. Contradictions are rare but real, and Karth and Smith found that global restarts rarely succeed under global constraints, which favors local backtracking ([Karth slides](https://creativecoding.soe.ucsc.edu/courses/cmpm202_w20/slides/W2_Tues_Karth_WaveFunctionCollapse.pdf)).

<figure class="demo"><div class="stage" data-demo="wfc"></div>
<figcaption><b>Wave function collapse, step by step.</b> Pick the cell with the fewest options, collapse it by weight, propagate the adjacency rules, restart on a contradiction. It is Merrell's 2007 model synthesis redone for bitmaps. Global restarts handle global constraints poorly, so on a phone keep it to a shopfront, a room or a village block.</figcaption></figure>

On a phone, WFC belongs in small regions: a shopfront, a room's furniture, a village block. It should run with designer cells (doors, a path, a landmark) collapsed before it starts, and retry deterministically on a contradiction with `name + ':' + attempt` *(inference)*. The White Dragon's facades and an Elsewhere tram carriage are natural targets.

## Autotiling on a dual grid

Autotiling has a clear best answer for a small hand-drawn set ([Classification of Tilesets](https://www.boristhebrave.com/2021/11/14/classification-of-tilesets/); [Quarter-Tile Autotiling](https://www.boristhebrave.com/2023/05/31/quarter-tile-autotiling/)):

| Set | Tiles for two terrains | How a tile is chosen |
|---|---|---|
| Blob | **47** (the "48-tile blob") | By the eight neighbors of a cell |
| Corner (marching squares) | **16**, or 6 with rotation and mirroring | By the terrain at its four corners |
| Dual grid | 16 | Terrain sits on cell centers, and tiles are drawn at a half-cell offset, each chosen by the four terrains at its corners |

Boris the Brave calls the dual grid "a substantial improvement" over the 48-tile blob. LDtk's auto-layer rules, small grid patterns that paint a tile when they match, are a good plain-data format for a game's own decoration rules ([LDtk docs](https://ldtk.io/docs/general/auto-layers/auto-layer-rules/)).

<figure class="demo"><div class="stage" data-demo="autotile"></div>
<figcaption><b>Autotiling: paint on it.</b> The classic corner set and the dual grid, where terrain sits on cells and art tiles are drawn half a cell off, chosen by their four corners. Sixteen tiles cover two terrains, against 47 for a blob set. On Elsewhere's 2:1 grid the dual grid carries over directly, because the iso grid is a square grid seen at an angle (no source covered this; it's an inference).</figcaption></figure>

No source covered the dual grid on an isometric diamond grid. It should carry over directly, because a 2:1 iso grid is a square grid seen at an angle. Lit faces break rotational symmetry, so budget for all 16 tiles per terrain, and layer terrains in priority order rather than drawing every pairwise transition *(inference)*. Today, Neo's only autotile rule is "draw a wall face if the tile below is not wall", and Merryfolk rounds edges by a noise-warped Gaussian vote of tile kinds instead of picking tiles ([Neo render.js](https://github.com/doctorallen/Neo/blob/main/js/render.js); [Merryfolk world.js](https://github.com/doctorallen/merryfolk/blob/main/js/world.js)).

## Scatter

Bridson's algorithm places decoration by Poisson-disk sampling in O(N), with **k = 30** tries per point by default ([Bridson 2007](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf)). Varying the minimum distance by noise varies the density ([devmag](https://devmag.org.za/2009/05/03/poisson-disk-sampling/)). For chunked worlds, one seeded point per global grid cell (a jittered grid) is seamless across chunk borders and needs no neighbor lookups *(inference)*. Elsewhere's lily pads already use rejection sampling with a minimum distance of 34 (its `quests/frogs/frogs.js`).

<figure class="demo"><div class="stage" data-demo="poisson"></div>
<figcaption><b>Scatter.</b> Pure random clumps and leaves holes; a jittered grid is even and seamless across chunks; Bridson's Poisson-disk sampling (k = 30) looks natural. Elsewhere's lily pads already use rejection sampling with a minimum distance of 34.</figcaption></figure>

## Places with people

Settlement generators are mostly geometry. Watabou says the Voronoi diagram is the only special piece of his city generator and "not really necessary" ([itch.io comment](https://itch.io/post/346778)). Parish and Müller grew roads as L-systems steered by density and terrain, snapping to existing roads to close loops ([SIGGRAPH archive](https://history.siggraph.org/?p=116923)). Watabou's hardest problem was coherent text: "Narrative stuff is hard" ([RandRoll interview](https://randroll.com/interview-watabou-2)). Wildermyth's team built generation around characters, not plot, for the same reason ([Turn Based Lovers](https://turnbasedlovers.com/10-turns-interview/with-wildermyth-developer)). Caves of Qud keeps its history legible with **five fixed periods of sultan rule** whose contents are generated and tied to sites in the world ([Qud wiki](https://wiki.cavesofqud.com/wiki/World_generation)).

<figure class="demo"><div class="stage" data-demo="town"></div>
<figcaption><b>A village.</b> A bent main road, lanes, lots split along the roads, houses on lots, fields and trees around. Watabou says the geometry is the easy part and "narrative stuff is hard", which is where Tyrell's minds come in: generate a few people and events first, then lay out the place so each event leaves something to find.</figcaption></figure>

For a game whose people are Tyrell minds, as Elsewhere's are, the transferable loop runs in four steps, all under one named stream such as `ctx.rng('history')` *(inference)*:

1. Generate a few people, each with a need and a relationship.
2. Write three to five events that link people to places.
3. Lay out the place so each event leaves something the player can find.
4. Feed the events to the minds as memories.

## Generate, then test

The authored feel of every shipped generator comes from the same three layers: hand-made structure on top, hand-made pieces at the bottom, and generate-and-test in between. Isaac restarts floors, Brogue rejects lakes, Dwarf Fortress rejects worlds, and RogueBasin regenerates caves that are too closed ([Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/); [brogue.wiki](https://brogue.wiki/wiki/Level_generation); [DF Wiki](https://dwarffortresswiki.org/index.php/World_generation)). Smith and Whitehead's expressive range analysis judges the generator as a whole: it scores many outputs on two metrics and plots them as a heatmap ([arXiv 2004.10808](https://arxiv.org/pdf/2004.10808)).

The games already pin generation with golden hashes, bots and smoke tests (Neo checks 2,500 floors; Elsewhere has bots, smoke tests and golden frames). The natural addition is a sweep over a thousand seeds in Node that checks invariants: the goal is reachable, every person has a reachable home, no frame uses more than eight inks. At runtime, a bounded retry by sub-seed keeps generation deterministic, and a short list of curated seeds can guarantee a good first visit *(inference)*.

## Sources

- [Red Blob Games, terrain from noise](https://www.redblobgames.com/maps/terrain-from-noise/)
- [Fabric Yarn docs, Minecraft's noise hypercube](https://maven.fabricmc.net/docs/yarn-1.20.4+build.1/net/minecraft/world/biome/source/util/MultiNoiseUtil.NoiseHypercube.html)
- [Inigo Quilez, domain warping](https://iquilezles.org/articles/warp)
- [xarray-spatial, droplet erosion](https://xarray-spatial.readthedocs.io/en/stable/_modules/xrspatial/erosion.html)
- [Dwarf Fortress Wiki, world generation](https://dwarffortresswiki.org/index.php/World_generation)
- [Darius Kazemi, Spelunky's generator, part 1](https://tinysubversions.com/spelunkyGen/) and [part 2](https://tinysubversions.com/spelunkyGen2/)
- [Boris the Brave, dungeon generation in The Binding of Isaac](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
- [brogue.wiki, level generation](https://brogue.wiki/wiki/Level_generation)
- [RogueBasin, cellular automata caves](https://www.roguebasin.com/index.php/Cellular_Automata_Method_for_Generating_Random_Cave-Like_Levels)
- [Boris the Brave, dungeon generation in Unexplored](https://www.boristhebrave.com/2021/04/10/dungeon-generation-in-unexplored/)
- [Deepnight, the level design of Dead Cells](https://deepnight.net/tutorial/the-level-design-of-dead-cells-a-hybrid-approach/)
- [mxgmn, WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse) and [Paul Merrell, model synthesis](https://paulmerrell.org/model-synthesis/)
- [Isaac Karth, WFC slides](https://creativecoding.soe.ucsc.edu/courses/cmpm202_w20/slides/W2_Tues_Karth_WaveFunctionCollapse.pdf)
- [Boris the Brave, classification of tilesets](https://www.boristhebrave.com/2021/11/14/classification-of-tilesets/) and [quarter-tile autotiling](https://www.boristhebrave.com/2023/05/31/quarter-tile-autotiling/)
- [LDtk, auto-layer rules](https://ldtk.io/docs/general/auto-layers/auto-layer-rules/)
- [Robert Bridson, fast Poisson-disk sampling (2007)](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf) and [devmag, Poisson-disk sampling](https://devmag.org.za/2009/05/03/poisson-disk-sampling/)
- [Watabou, on his city generator](https://itch.io/post/346778) and [the RandRoll interview](https://randroll.com/interview-watabou-2)
- [Parish and Müller, procedural modeling of cities](https://history.siggraph.org/?p=116923)
- [Turn Based Lovers, interview with Wildermyth's developer](https://turnbasedlovers.com/10-turns-interview/with-wildermyth-developer)
- [Caves of Qud wiki, world generation](https://wiki.cavesofqud.com/wiki/World_generation)
- [On expressive range analysis (arXiv 2004.10808)](https://arxiv.org/pdf/2004.10808)
- The games: [Merryfolk terrain.js](https://github.com/doctorallen/merryfolk/blob/main/js/terrain.js) and [world.js](https://github.com/doctorallen/merryfolk/blob/main/js/world.js), [Lodestar regions.js](https://github.com/doctorallen/lodestar/blob/main/js/regions.js) and [floor.js](https://github.com/doctorallen/lodestar/blob/main/js/floor.js), [Neo dungeon.js](https://github.com/doctorallen/Neo/blob/main/js/dungeon.js) and [render.js](https://github.com/doctorallen/Neo/blob/main/js/render.js)

The full research is in the notes on [world generation](notes/world_generation.md) and on [settlements, paths and vegetation](notes/settlements_paths_vegetation.md).

<script src="demos/kit.js"></script>
<script src="demos/worlds-shared.js"></script>
<script src="demos/terrain.js"></script>
<script src="demos/dungeons.js"></script>
<script src="demos/wfc.js"></script>
<script src="demos/autotile.js"></script>
<script src="demos/poisson.js"></script>
<script src="demos/town.js"></script>
<script src="demos/start.js"></script>
