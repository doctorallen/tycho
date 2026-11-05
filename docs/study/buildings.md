# Buildings and interiors

How a game can make a house from a seed and then let the player walk round it, behind it and into it, in isometric or 3/4 view. Making the house is cheap and well trodden. A squarified treemap divides a footprint into rooms by zone (Marson & Musse 2010), a room graph places the doors, and a handful of grid rules seat the furniture (a cut-down Merrell 2011). The roof comes from formulas on rectangles, which is what a straight skeleton reduces to on rectilinear footprints. The climate sets the pitch, the materials and the footprint. All of it takes about half a millisecond in plain JS. Seeing the inside comes in two families. Separate interior maps (Stardew Valley) need no tricks; in-place cutaways (Ultima VII, Fallout, The Sims) hide what is above or in front of the player. Fallout's rule, flood the roof region you stand under, beats Ultima's, cut everything above your head, because the neighbors keep their roofs. The hard part is depth sorting. Sorting by one point per object breaks on anything bigger than a tile. Ordering box pairs and sorting the graph topologically fixes it, and costs 0.06 ms for 64 objects. The fix has two conditions the demos found the hard way: test overlap on the boxes' hexagons, not on sprite rectangles, and make every sprite fit inside its box.

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md).

Text marked *(inference)* is reasoning from the sources, not a sourced fact. Times marked "bench" were measured for the note with [buildings_sorting_bench.js](notes/buildings_sorting_bench.js): Node v26.8.1 on a 2019 Intel i9-9880H laptop at 2.3 GHz, one thread. Times in the demos are measured in the browser as they run. No phone was measured.

- [Floor plans](#floor-plans)
- [Roofs and climate](#roofs-and-climate)
- [Furniture by rules](#furniture-by-rules)
- [Showing the inside](#showing-the-inside)
- [Depth sorting](#depth-sorting)
- [Floors, bridges and heights](#floors-bridges-and-heights)
- [What it costs on a phone](#what-it-costs-on-a-phone)
- [What it means for Tycho](#what-it-means-for-tycho)
- [Sources](#sources)

<figure class="demo"><div class="stage" data-demo="house"></div>
<figcaption><b>A house from a seed.</b> The climate sets the footprint, roof, pitch and materials: <i>Snowy</i> is a compact timber house with a steep gable (52°) and a chimney; <i>Temperate</i> is plaster under a hip or gable tile roof (38°); <i>Arid</i> is adobe with a flat roof, a parapet and waterspouts, often on an L footprint; <i>Wetland</i> stands on stilts over water, with a veranda, a ladder and a steep thatched hip (47°). Rooms come from a squarified treemap inside zones; the plan in the corner shows them (amber social, blue service, green private), with doors as pale gaps and windows in blue. <i>Cutaway</i> lifts the roof and cuts the front and inner walls to stubs, as The Sims does, so the furniture shows. Every part goes into one z-buffer and then gets the dark outline, so the picture needs no draw order. The study palette has 32 colors; a cutaway uses about 22 of them, more than Elsewhere's eight.</figcaption></figure>

## Floor plans

Three families of floor-plan generator turn up in papers and games:

| Family | How | Who | Fits a phone |
|---|---|---|---|
| Subdivide a rectangle | Squarified treemap or BSP, rooms by area | Marson & Musse 2010; Mirahmadi & Shami 2012 | Yes: one pass, microseconds |
| Grow rooms from seeds | Rooms grow on a grid inside the footprint until they meet, under adjacency constraints | Lopes et al. 2010 | Yes, for tens of cells |
| Fill a grid by constraints | Wave Function Collapse from small templates | Caves of Qud; Townscaper's modules | Yes, but it can fail and needs a fallback |

**The treemap plan.** Marson & Musse draw each room's area from a distribution by its function. The rooms fall into three zones: a social area (living, dining), a service area (kitchen, laundry) and a private area (bedrooms, bathrooms). The zones share the footprint by their total area, and each zone then shares its rectangle among its rooms. Doors follow "a connection graph which is randomly produced at a previous stage based on some rules. An example rule can be expressed as bedrooms should not be connected together." When two rooms that must connect aren't adjacent, a corridor is cut, which Mirahmadi & Shami criticize because it "wastes some space in the house" ([arXiv 1211.5842](https://arxiv.org/abs/1211.5842), restating Marson & Musse). Mirahmadi & Shami draw the counts of rooms and bedrooms from a census table: three bedrooms in six rooms is the single most likely pair, at 0.106. Their corridor rule is that "all of the rooms are connected either directly or via some corridors to the living room, as the center of activities." Their doors "are then placed randomly at the shared walls between the rooms," at a fixed width, and their windows likewise, with rules such as "a window cannot be installed in bathrooms."

The **squarified treemap** itself is Bruls, Huizing & van Wijk's ([PDF](https://www.win.tue.nl/~vanwijk/stm.pdf)). It lays rectangles in a row along the shorter side of the free space and keeps adding to the row while its worst aspect ratio improves. When adding would make the row worse, it fixes the row and goes on with what is left. "A decreasing order usually gives the best results." It is linear in the number of rooms after the sort.

The demo does exactly this on whole tiles, for footprints of 4x4 to 10x7:

1. **Program.** Living, kitchen and a bedroom; a bathroom from 26 tiles; a second bedroom from 38; a dining room from 54. Each weight varies by ±20 percent.
2. **Zones, then rooms.** The zones are treemapped into the footprint, largest first, then each zone's rooms into the zone. The cut lines snap to whole tiles; two rooms share an edge, so they round the same way and the tiling stays exact. If any room comes out under 2x2 tiles, it tries again with new weights, and after 40 tries drops the last room.
3. **Turn the plan** so the living room touches the front (the south or east side, the ones the camera sees), and put the front door there.
4. **Doors.** Grow the linked set from the living room. The next room is the one sharing a wall with a linked room, preferring the living room, then social or service rooms. Bedrooms open into each other only as a last resort. Each door goes in the middle of the shared wall.
5. **Windows.** On exterior walls only, never in a bathroom, never beside a door or at a corner, with a gap after each one.

That takes **0.48 ms a house on average** (bench, 1,200 houses across the four climates, furniture included, no failures). With three to seven rooms it never needs a corridor search. *(inference)* For bigger buildings, Mirahmadi & Shami's shortest-path corridor is the next step; for a quest-sized cottage it is not needed.

**Growth and constraints.** Lopes, Tutenel, Smelik, de Kraker & Bidarra grow rooms from seed cells on a grid inside any footprint until they meet. A designer sets the functional constraints and adjacencies, and the method handles multiple floors ([GAME-ON 2010](https://publications.graphics.tudelft.nl/papers/584)). Caves of Qud builds its huts, crypts and lairs with Wave Function Collapse from small PNG templates in `wavetemplates/` (`huts11`, `compound`), at 40x20 cells. The output colors map to wall materials, and villages call `VillageBase.addInitialStructures` ([Qud wiki](https://wiki.cavesofqud.com/wiki/Modding:Zone_Procedural_Generation)). A 2024 patch fixed "partial, garbled WFC-generated buildings" ([devlog](https://freeholdgames.itch.io/cavesofqud/devlog/664714/feature-friday-january-12-2024)): a constraint solver can fail, and a game needs a plain fallback behind it. The demo keeps one too, a half-and-half split it reaches only when the treemap fails 40 times in a row.

**Buildings as corners.** Townscaper places corner modules, not whole blocks. It starts from an irregular quad grid, made by splitting a hex grid into quads twice and relaxing the points. A marching-cubes-like pass picks corner pieces from which cells are filled, and WFC chooses among modules by their neighbors, with priorities: gardens appear only where walls enclose an area. Decoration runs after placement, and windows are cut with a stencil. A re-skin is "somewhere in the region of 500 tiles," and Bad North had "over 300" ([Game Developer](https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making)). *(inference)* This is the other way to make buildings: no floor plan at all, just occupied cells and corner rules, with roofs, arches and stairs emerging from the neighbors. It suits a quest whose buildings are the toy itself.

**Facades.** CGA shape (Müller, Wonka, Haegler, Ulmer & Van Gool 2006, [SIGGRAPH](https://history.siggraph.org/?p=113547)) gives a shape a scope, an oriented box, and rewrites it with rules. The split rule divides a scope along an axis; the repeat split tiles a part as many times as fit; the component split turns a volume into faces, edges and points. *(inference)* At 320x180 a wall is 16 to 40 px wide, and one repeat split of "window, gap" with the door forced onto the front is all of CGA a pixel house needs. The demo's windows are that rule.

## Roofs and climate

A hip roof over any simple polygon is its straight skeleton raised at the roof's slope (Laycock & Day 2003, after Felkel & Obdržálek 1998). A gable is the same with the end edges made vertical, and a mansard stops the skeleton at its first event ([WSCG record](https://dspace5.zcu.cz/handle/11025/991)). Plain skeletons give only hips, "with some postprocessing, gable roofs" (Held & Palfrader, [arXiv 1604.03362](https://arxiv.org/abs/1604.03362)). Kelly & Wonka's weighted skeletons give each edge its own profile ([Glasgow eprint](https://eprints.gla.ac.uk/48707/), Java in [campskeleton](https://github.com/twak/campskeleton)).

On rectangles the skeleton is a formula *(inference, from the geometry)*. For a footprint w by d with w ≥ d and pitch p:

| Roof | Ridge | Ridge height above the eave | Planes |
|---|---|---|---|
| Gable | along w, full length | (d / 2) · tan p | Two slopes and two wall-colored gable triangles |
| Hip | along w, length w − d | (d / 2) · tan p | Two trapezoids and two triangles; hips at 45° in plan |
| Pyramid (hip, w = d) | a point | (d / 2) · tan p | Four triangles |
| Flat | none | 0 (a slope of a few degrees in life) | A deck behind a parapet |

An L or other rectilinear footprint can be cut into rectangles, each roofed and then merged (Laycock & Day). In the demo the merge is free: roofs go into a z-buffer, so two intersecting roofs draw their valley without any merge code. An overhang of 0.35 tiles lowers the eave by 0.35 · tan p. The roof then sits 0.12 above the wall tops, because a wall top level with the roof plane pokes through it as a row of dots. A gable's rake overhang is a sliver too thin to outline cleanly, so the demo draws it as a dark fascia line.

**Climate.** Li et al. measured the height-to-span ratios of about 200 surviving roofs in northern central and eastern China. Over roughly 750 to 1750 CE, the ratios rose and fell with extreme snowfall, lagging it by about 30 years ([Science Advances 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8442921/); [Eos](https://eos.org/articles/chinese-architecture-evolved-with-changes-in-snowfall)). Flat roofs concentrate in arid regions and still slope "up to approximately ten degrees" to shed water ([Wikipedia](https://en.wikipedia.org/wiki/Domestic_roof_construction)). In Samarinda, Indonesia, residents raised their stilts from 60-130 cm to 170-270 cm as floods worsened ([Unhas](https://discover.unhas.ac.id/publications/adaptive-morphologies-of-stilt-settlements-in-flood-prone-of-sempaja-samarinda-i)). Assam's chang ghar are bamboo huts on stilts that last about five years ([Dialogue Earth](https://dialogue.earth/en/climate/stilt-houses-assam-help-people-withstand-floods/)).

The demo's presets follow those trends; the exact numbers are design choices *(inference)*:

| Climate | Footprint (tiles) | Roof | Walls | Other |
|---|---|---|---|---|
| Snowy | 5-7 x 4-6, compact | Gable at 52°, snow on it | Timber, plank lines | Small windows, chimney 70% of the time |
| Temperate | 6-10 x 4-7 | Hip or gable at 38°, tile | Plaster, a few marks | More windows, chimney |
| Arid | 6-9 x 4-5, an L 75% of the time | Flat, parapet, waterspouts | Adobe, beam ends under the roof | Few, small windows |
| Wetland | 5-8 x 4-5 | Steep thatched hip at 47° over a veranda | Woven, vertical canes | Stilts of 1.1 tiles over water, a ladder |

## Furniture by rules

Merrell, Schkufza, Li, Agrawala & Koltun turned interior-design guidelines into terms of a density function ([project](https://graphics.stanford.edu/projects/furniture/), [PDF](https://paulmerrell.org//furnitureLayout2.pdf)):

| Guideline | Their term |
|---|---|
| Clearance | Each item's required free space, as Minkowski sums |
| Circulation | Connected components of free space, from robot motion planning |
| Conversation | Seats "roughly four to eight feet apart," facing each other |
| Balance | Visual weight centered in the room |
| Alignment | Items parallel to walls and to each other |
| Emphasis | A focal point |

They sample the density with parallel-tempered Markov chains, one per GPU warp, at 10,000 iterations per warp on a GTX 480. That gives suggestions in **0.73 to 1.03 s per room**, and professional designers preferred the assisted layouts in four rooms of five (p < 0.01). That is a GPU second per room, wrong for a phone at load.

*(inference)* On a grid the guidelines become cheap rules, and the demo uses five:

- **Wall pieces back to a wall.** Beds, chests, shelves, stoves, counters and tubs need a real wall behind them. A shelf can't stand against a window, and it stands only against a north or west wall, so the cutaway shows its books.
- **Clearance.** A wall piece needs a free cell in front of it, inside the room.
- **Doors stay clear.** The room cell inside every door is never used.
- **Tables away from walls** in rooms bigger than 2x2, with chairs on cells beside the table.
- **Circulation.** After each piece, a flood fill from a door must reach every free cell, every other door and every piece's front cell. If it doesn't, the piece tries its next place.

With two to four pieces a room and a seeded rng ordering the candidates, that is microseconds. It is Merrell's clearance and circulation without the sampler; balance, alignment and emphasis come free from the grid and the wall rule.

## Showing the inside

There are two families:

| Approach | Games | Cost | Catch |
|---|---|---|---|
| Separate interior maps | Stardew Valley, most JRPGs | None: a door is a warp | Outside and inside need not agree; a house can be bigger inside |
| Height cut | Ultima VII | One column test per move | Every roof and upper floor on screen goes at once |
| Region flood | Fallout 1 and 2 | A flood fill when the player's roof square changes | Needs roofs grouped by building |
| Wall modes | The Sims | Per wall, per frame | The player picks a mode |
| No roofs drawn | RimWorld | None | A roof shows only as an overlay |

**Stardew Valley** keeps interiors as separate locations joined by warps; "all maps require a warp" ([Stardew Modding wiki](https://stardewmodding.wiki.gg/wiki/Tutorial:_Map_Patches_and_Warps)). Its tile layers are Back, Buildings, Paths, Front and AlwaysFront. Front tiles are "drawn over the player when the player is north of them and behind the player when the player is south of them." AlwaysFront draws over everything, for foliage cover ([Mapping](https://stardewvalleywiki.com/Mapping), [Modding:Maps](https://stardewvalleywiki.com/Modding:Maps)). That is how a tile game lets a figure walk behind a tree without sorting at all: the crown is a separate layer.

**Ultima VII** cuts by height, as Exult reimplements it. Each time the camera actor moves, `is_roof(tx, ty, lift)` returns the lowest occupied lift at or above four lifts over the actor's feet, or 255 for open sky. The renderer then skips every object at or above that lift ([exult/gamewin.cc](https://github.com/exult/exult/blob/master/gamewin.cc), [objs/chunks.cc](https://github.com/exult/exult/blob/master/objs/chunks.cc)). Step under any roof and every roof and upper floor on the screen goes.

**Fallout 2** floods instead, as fallout2-ce reimplements it. Roofs live on a square grid at half the hex resolution, 100x100 per elevation, each square a 12-bit tile id and 4 flag bits. When the player's roof square changes, `tile_fill_roof` re-shows the old region and flood-fills the new one, four neighbors at a time from an explicit stack, setting a hidden flag on every connected non-empty roof square ([src/tile.cc](https://github.com/alexbatalov/fallout2-ce/blob/main/src/tile.cc), [src/object.cc](https://github.com/alexbatalov/fallout2-ce/blob/main/src/object.cc)). Only this building's roof goes; the street outside keeps its roofs.

**Walls in front.** Fallout 2's walls use a "translucent egg effect around player": an art mask placed at the player. When a wall is drawn, flags on it pick a test by its orientation, such as `tileIsInFrontOf(wall, dude)` or `tileIsToRightOf(dude, wall)`. If the wall should be seen through, the part under the egg's rectangle is drawn through the egg's intensity mask, and the rest normally, as four rectangles round it ([object.cc](https://github.com/alexbatalov/fallout2-ce/blob/main/src/object.cc)). Diablo II makes walls in front of the character transparent. D2R kept that in its legacy mode, and players missed it on some walls in the new one, in the Tower and Travincal ([Blizzard forum](https://us.forums.blizzard.com/en/d2r/t/in-d2r-graphics-certain-walls-arent-transparent-when-your-character-is-behind-them/160254)). The Sims 4 has walls up, cutaway ("visible if they are away from the camera, and hidden if they are near the camera") and walls down. Only the floor being viewed is cut, and half-walls always stay up ([EA forums](https://forums.ea.com/discussions/the-sims-4-technical-issues-pc-en/how-do-you-cut-away-walls/11796036)). Project Zomboid's first cutaways were "wholesale across the entire screen," so its building artist saw buildings sliced most of the time, and it moved to "sims-style" cutaways ([PZ blog](https://projectzomboid.com/blog/?p=6220)). RimWorld doesn't draw roofs; a roof overlay shows thin and mountain roofs in two greens ([Steam](https://steamcommunity.com/app/294100/discussions/0/1736588252417483940)).

**Fading without new colors.** Screen-door transparency drops pixels by an ordered Bayer threshold instead of blending ([Godot shaders](https://godotshaders.com/shader/dithering-screen-door-transparency/), [camera occlusion dither](https://godotshaders.com/shader/camera-occlusion-dither/)). It suits a palette game twice over *(inference)*. A dithered roof is still drawn in its own inks, so the frame stays within its limit. And each step of the fade is a pre-painted sprite, so the per-frame cost is a choice of which picture to draw. The demo paints five levels (0, 4, 8, 12 and 16 of 16 pixels kept) of every part that fades, aligned to the screen so neighboring parts dither as one, and steps through them over five frames.

**X-ray.** No technical write-up of Hades' silhouettes was found. The common technique draws the hidden part of the character in a flat ink over whatever hides it, using a mask of where it's hidden ([GDQuest](https://www.gdquest.com/library/silhouette_2d)). The demo does it within Tycho's GPU stand-in, with two small offscreen canvases and destination-out only:

1. Into canvas A, draw the silhouette: an outline in pale cyan with a checker of coat blue inside.
2. Fill canvas B, then draw with destination-out every sprite that comes after the figure in the order and overlaps it. B is now "not covered."
3. Draw B onto A with destination-out. A keeps the silhouette only where something covers the figure. Draw A over the frame.

That is one fill and a handful of drawImage calls a frame, and only when something covers the figure.

<figure class="demo"><div class="stage" data-demo="occlusion"></div>
<figcaption><b>Walking behind, under and inside.</b> A village block where every wall run, piece of furniture, roof, tree and fence is its own sprite with a 3D box. <i>Naive</i> orders them by one point each, the middle of the footprint, as a y-sort does: inner walls poke through roofs, and the walker shows on top of the house it's behind. <i>Boxes</i> builds a graph between things whose pictures overlap, orders each pair by which axis separates their boxes (Lebron) and sorts it topologically. Walk into a house and its roof and upper walls fade out through a Bayer dither, leaving stubs; the other house keeps its roof, as in Fallout. Behind a wall, a roof, a tree or the fence, an <i>X-ray</i> silhouette shows through. Tap the ground to walk there; <i>Auto-walk</i> follows a round behind the long house, along the back of the fence and through both doors. The note gives the time to order and to draw each frame.</figcaption></figure>

## Depth sorting

Sorting by a key, tile x + y or the screen y of a base point, is right only when every object fits in one tile. A house, a long wall, a fence or a tree whose crown overhangs the next tile breaks it. A figure behind the east end of a long house has a larger key than the house's middle, so it is drawn on top. The *Naive* tab shows exactly that, and also inner walls drawn over the roof: their middles are nearer than the roof's.

**Ordering boxes.** Shaun Lebron's IsometricBlocks ([page](https://shaunlebron.github.io/IsometricBlocks/)) gives the general method:

- **Overlap.** Each box projects to a hexagon with sides along the three drawn axes. Two boxes overlap on screen only if their ranges overlap on all three.
- **Order.** If they overlap, find an axis that separates the boxes; the one with lower x or y, or lower z, is behind. "A box should not be drawn until all the ones behind it are drawn": a topological sort by depth-first search.
- **Cycles.** They exist. Split a box or clip it, and detect them with Tarjan's strongly connected components.
- **No overlap, no order.** Two boxes that don't overlap on screen have no order at all.

Exult's `Game_object::compare` does the same for Ultima VII ([objs/objs.cc](https://github.com/exult/exult/blob/master/objs/objs.cc)). It returns "dont_care" when the screen rectangles don't meet, compares the x, y and z ranges, draws flat things first, and keeps a set of dependencies per object.

Andrew Russell's River City Ransom: Underground ([blog, 2016](https://andrewrussell.net/2016/06/how-2-5d-sorting-works-in-river-city-ransom-underground/)) refines it for heightmapped sprites. It compares bounding boxes first. Only if they overlap does it compare precomputed "depth slices" at "the lowest Y coordinate that the two objects have in common." It sorts the graph topologically, and breaks cycles, "the painter's dilemma," by deleting as few edges as possible with a modified Tarjan. They are rare because the objects are blocky and the collision uses the same data. It uses per-animation bounds, not per-frame bounds, so a looping animation doesn't flicker in depth.

Godot's `y_sort_enabled` is the one-point sort: "nodes with a higher Y position are rendered in front of nodes with a lower Y position," and a child without y-sort draws its children together at its own y ([Godot docs](https://docs.godotengine.org/en/stable/classes/class_canvasitem.html)).

<div class="finding"><p>Two conditions make the box sort hold, and the occlusion demo broke both before it worked. First, test overlap on the hexagons, ranges of x − y, x − z and y − z, not on sprite rectangles. Rectangles let two boxes "overlap" while separating on two axes in opposite directions, and the axis checked first can be the wrong one: a tree behind a house was ordered in front of an inner wall. Second, every sprite must fit inside its box. A tree's box is its crown's footprint, not its trunk's, and a roof's box takes in the overhang and starts at the wall tops, so walls always sort under it. With both, the demo's 64 objects showed no wrong pair at any of the 195 places the walker can stand <i>(measured)</i>.</p></div>

Two smaller rules keep boxes from intersecting, since intersecting boxes have no separating axis and fall back to a guess. Exterior walls running along x own the corners, and every other wall stops half a wall short. A cut wall's stub and upper part are separate boxes that touch at the cut.

**Cost.** In the bench, random boxes of 1-3 by 1-3 tiles:

| Objects | Key sort | All pairs, then topological sort | Screen grid, then topological sort | Overlapping pairs |
|---|---|---|---|---|
| 50 | 0.011 ms | 0.033 ms | 0.06 ms | 122 |
| 200 | 0.037 ms | 0.26 ms | 0.18 ms | 584 |
| 1,000 | 0.28 ms | 4.4 ms | 1.0 ms | 3,065 |

In the browser the demo sorts its 54 to 64 objects in 0.05 to 0.09 ms and draws the frame in about 0.35 ms. *(inference)* A quest-sized scene of 50 to 200 things fits a phone with room to spare even if a phone is five times slower. Above a few hundred, find candidate pairs through a screen grid, or build the static scenery's graph once and insert only the moving figures each frame.

**Slicing instead.** The other answer is to cut big things down to tile size so a key sort works again. Diablo II's tiles separate floors (orientation 0), walls (1 to 14, including corner pieces and door walls), shadows (13), objects (14), roofs (15, drawn "above the floor" by a roof height) and "lower walls" (above 15). Walls are built from 32x32 blocks at most 160 px wide ([DT1 docs](https://tristram-archives.github.io/diablo2_infodump/2013/just%20hosting%20these,%20Downloaded%20from%20Internet/documentation/dt1-docs-in-html/index.htm)). Stardew's Front layer is the same idea for trees. *(inference)* Slicing costs memory and draw calls (a 7x4 house becomes about 11 vertical strips) and still fails for anything taller than its strip is wide; the graph is better for a few big buildings and fine for small scenes.

## Floors, bridges and heights

*(inference)* With a z range on every box, height costs nothing extra in the sort. A bridge's box sits at z 1.5 to 1.8, and a figure walking under it, at z 0 to 1.75, separates from it in z, so the bridge draws after the figure. A figure crossing the bridge has z 1.8 to 3.55 and draws after it. The same holds for second floors and balconies. To show the inside of a two-floor house, use Ultima's height cut within Fallout's region: hide this building's parts above the player's floor, and leave every other building whole. The Sims cuts only the floor being viewed, and the walls of lower floors stay up. Stilts and terraces are the same: the wetland house's floor is a box at z 0.85 to 1.1, with posts under it.

## What it costs on a phone

| Step | When | Cost (laptop) | On a phone *(inference)* |
|---|---|---|---|
| Plan, doors, windows, furniture | At load or as the player nears | 0.48 ms a house (bench) | A few ms; spread over frames for a town |
| Painting a house (z-buffer and outline) | Once per house or seed | 2 to 4 ms at 200x150 in the demo (about 20 ms the first time, before the JIT warms) | 10 to 20 ms; prebake in a worker or over frames |
| Sprites for each part, and 5 dither levels of the parts that fade | Once | About 60 small canvases for a block of two houses | Memory, not time: tens of KB |
| Depth sort | Every frame | 0.05 to 0.09 ms for 64 objects | Under 0.5 ms |
| Drawing | Every frame | About 0.35 ms for about 60 drawImage calls | Well inside a frame |
| Roof fade | Every frame | Choosing which level to draw | Free |
| X-ray mask | When covered | One fill and a few drawImage calls on a 7x14 canvas | Free |

## What it means for Tycho

*(inference)* Four engine options any game could use, none Elsewhere-only:

- **Box sort.** `Sort.boxes(items)` orders items by world boxes: a hexagon overlap test, Lebron's separating axis, a depth-first topological sort, and a Tarjan pass that breaks a cycle by dropping its weakest edge. It takes an option to keep the static graph and re-insert only moving items. The rule that a sprite must fit inside its box goes in the docs and in a dev-panel overlay that draws each box's hexagon. Today a game on Tycho would sort by y.
- **Dither fade.** `Fade.levels(canvas, n, origin)` pre-paints n Bayer-threshold copies of a sprite, aligned to the screen, and a per-object fade value picks one each frame. It works inside the GPU stand-in and keeps a frame within its palette.
- **Hidden-part mask.** A helper for an x-ray: given a sprite and the sprites drawn after it, the two destination-out passes that leave its covered part. That stays within the stand-in's four blends.
- **Building kit.** A tile-grid house generator (treemap zones, room graph, furniture rules with a flood fill, rectangle roofs) as a Tycho module beside the painter, returning plain JSON a quest can save. Its parts come out as boxes with paint functions, so the same house prebakes as one picture or splits into sortable sprites.

For Elsewhere, Fallout's rule is the one to copy: a building id under the player, that building's upper parts faded, the rest of the world untouched. A quest whose houses are its toy could take Townscaper's corner modules instead. Neither touches the rule of the game; they are how a quest draws its houses.

## Sources

- Fernando Marson and Soraia Raupp Musse, [Automatic real-time generation of floor plans based on squarified treemaps algorithm](https://eld.bl.uk/catalog/100084568820_0x000001), *Int. J. Computer Games Technology* 2010, doi:10.1155/2010/624817 (read through Mirahmadi & Shami's restatement)
- Maysam Mirahmadi and Abdallah Shami, [A novel algorithm for real-time procedural generation of building floor plans](https://arxiv.org/abs/1211.5842), 2012
- Mark Bruls, Kees Huizing and Jarke J. van Wijk, [Squarified treemaps](https://www.win.tue.nl/~vanwijk/stm.pdf), 2000
- Ricardo Lopes et al., [A constrained growth method for procedural floor plan generation](https://publications.graphics.tudelft.nl/papers/584), GAME-ON 2010
- Caves of Qud wiki, [Zone procedural generation](https://wiki.cavesofqud.com/wiki/Modding:Zone_Procedural_Generation), and Freehold Games, [Feature Friday, January 12, 2024](https://freeholdgames.itch.io/cavesofqud/devlog/664714/feature-friday-january-12-2024)
- Game Developer, [How Townscaper works](https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making)
- Pascal Müller et al., [Procedural modeling of buildings](https://history.siggraph.org/?p=113547), SIGGRAPH 2006
- R. G. Laycock and A. M. Day, [Automatically generating roof models from building footprints](https://dspace5.zcu.cz/handle/11025/991), WSCG 2003; Tom Kelly and Peter Wonka, [Interactive architectural modeling with procedural extrusions](https://eprints.gla.ac.uk/48707/), 2011; Martin Held and Peter Palfrader, [arXiv 1604.03362](https://arxiv.org/abs/1604.03362)
- Li et al., [Change of extreme snow events shaped the roof of traditional Chinese architecture](https://pmc.ncbi.nlm.nih.gov/articles/PMC8442921/), *Science Advances* 2021
- Paul Merrell et al., [Interactive furniture layout using interior design guidelines](https://graphics.stanford.edu/projects/furniture/), SIGGRAPH 2011
- Exult: [gamewin.cc](https://github.com/exult/exult/blob/master/gamewin.cc), [objs/chunks.cc](https://github.com/exult/exult/blob/master/objs/chunks.cc), [objs/objs.cc](https://github.com/exult/exult/blob/master/objs/objs.cc)
- fallout2-ce: [src/tile.cc](https://github.com/alexbatalov/fallout2-ce/blob/main/src/tile.cc), [src/object.cc](https://github.com/alexbatalov/fallout2-ce/blob/main/src/object.cc)
- [Diablo II DT1 format](https://tristram-archives.github.io/diablo2_infodump/2013/just%20hosting%20these,%20Downloaded%20from%20Internet/documentation/dt1-docs-in-html/index.htm)
- Stardew Valley wiki, [Mapping](https://stardewvalleywiki.com/Mapping) and [Modding:Maps](https://stardewvalleywiki.com/Modding:Maps)
- Shaun Lebron, [IsometricBlocks](https://shaunlebron.github.io/IsometricBlocks/)
- Andrew Russell, [How 2.5D sorting works in River City Ransom: Underground](https://andrewrussell.net/2016/06/how-2-5d-sorting-works-in-river-city-ransom-underground/)
- Godot docs, [CanvasItem](https://docs.godotengine.org/en/stable/classes/class_canvasitem.html)
- Godot Shaders, [screen-door transparency](https://godotshaders.com/shader/dithering-screen-door-transparency/); GDQuest, [silhouette 2D](https://www.gdquest.com/library/silhouette_2d)

The full research is in the note on [buildings, interiors and depth sorting](notes/buildings_interiors_sorting.md). Related pages: [the settlements page](settling.md) for where houses go in a village, [views](views.md) for the projections, and [light](light.md) for the palette-strict limits the dither fade keeps to.

<script src="demos/kit.js"></script>
<script src="demos/buildings-shared.js"></script>
<script src="demos/house.js"></script>
<script src="demos/occlusion.js"></script>
<script src="demos/start.js"></script>
