# Sources

Every external source the study cites, about 300 in all, grouped by the page that draws on it and listed once each, under the page where it matters most. Each line gives the source and a few words on what it is or what the study took from it. Tycho's and the games' own files are cited on the pages themselves, and the research notes behind each page are in [the notes](notes/README.md), which also carry sources the pages don't.

- [Sprites and items](#sprites-and-items)
- [Plants](#plants)
- [Worlds and levels](#worlds-and-levels)
- [Real geography](#real-geography)
- [Zoom and chunks](#zoom-and-chunks)
- [Palette and resolution](#palette-and-resolution)
- [Text and interface](#text-and-interface)
- [Perspectives](#perspectives)
- [The sun](#the-sun)
- [Light](#light)
- [Motion](#motion)
- [Effects and simulations](#effects-and-simulations)
- [Sound and music](#sound-and-music)
- [Phones and budgets](#phones-and-budgets)
- [Reaching a style](#reaching-a-style)
- [The five games](#the-five-games)

## Sprites and items

[The page](sprites.md).

- [Dave Bollinger, Pixel Spaceships](https://www.davebollinger.us/pixelspaceships): the mirrored-mask ship generator; "the avocado" mask, 62 free pixels, about 4×10¹⁸ ships.
- [zfedoran, pixel-sprite-generator.js](https://raw.githubusercontent.com/zfedoran/pixel-sprite-generator/master/pixel-sprite-generator.js): the mask generator's source; cells of −1, 0, 1, 2, mirrored, outlined.
- [yurkth, Sprator](https://www.github.com/yurkth/sprator): sprites from a 4×8 noise grid and a Life-like rule, mirrored and outlined.
- [OpenGameArt, a layered character generator](https://opengameart.org/node/130839): layer groups and z-order in JSON; recolors that break across ramps.
- [OpenGameArt forum, the recoloring fork](https://opengameart.org/node/159745): recoloring made to work by capping each material at six shades.
- [Caves of Qud wiki, Modding: Tiles](https://wiki.cavesofqud.com/wiki/Modding:Tiles): 16×24 tiles in three color roles, filled at runtime from 18 fixed colors.
- [GTG3000, GunsNAmmo](https://github.com/GTG3000/GunsNAmmo): a Starbound mod config; guns from butt, middle and barrel parts with palette swaps.
- [ProcJam Seeds, spellbooks](https://procjam.com/seeds/issues/3/spell.txt.html): spellbooks built from image layers, each with several options.
- [Thomas Vasseur, Dead Cells' 3D pipeline for 2D animation](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-): 3ds Max models rendered tiny without anti-aliasing, plus normal maps; flicker never solved.
- [Lexaloffle BBS, sprite stacking](https://www.lexaloffle.com/bbs/?tid=39014): slices offset a pixel each for pseudo-3D; animating across slices is "a big pain".
- [James Poole, sprite stacking in Wee Boats](https://jamespoole.itch.io/wee-boats/devlog/685630/using-sprite-stacking-for-pseudo-3d-in-wee-boats): a devlog on stacked-slice pseudo-3D.
- [Pixel Composer, De-Corner](https://docs.pixel-composer.com/nodes/filter/fix/de_corner.html): a filter that removes the L-shaped corner pixel from 1 px lines.
- [Krita merge request 2158](https://invent.kde.org/graphics/krita/-/merge_requests/2158): Krita's pixel-perfect stroke mode, the same cleanup.
- [PixelLab API](https://pixellab.ai/pixellab-api): skeleton-posed animation and rotations; $0.0084 per 64×64 image.
- [PixelLab, skeleton animation](https://www.pixellab.ai/docs/tools/skeleton-animation): the docs for posing sprites from a skeleton.
- [Astropulse, Retro Diffusion on Gumroad](https://astropulse.gumroad.com/l/RetroDiffusion): color reduction and "Neural Pixelate" inside Aseprite.
- [Sprite Sheet Diffusion (arXiv 2412.03685)](https://arxiv.org/html/2412.03685v2): a research model trained on 152 paired action sequences.

## Plants

[The page](plants.md).

- [Wikipedia, L-system](https://en.wikipedia.org/wiki/L-system): bracketed turtle grammars, stochastic and parametric.
- [Prusinkiewicz and Lindenmayer, The Algorithmic Beauty of Plants](http://algorithmicbotany.org/papers/abop/abop.pdf): six classic 2D plants at 20° to 25.7°, Honda's tree, tropism.
- [Runions et al. 2007, space colonization](http://algorithmicbotany.org/papers/colonization.egwnp2007.pdf): branches grown toward points in a crown envelope; no weeping trees.
- [Nuić et al. 2019](https://www.zemris.fer.hr/~zeljkam/radovi/19_Mipro_Nuic.pdf): L-systems, colonization and particle flow compared on speed and shape.
- [Weber and Penn 1995, Creation and Rendering of Realistic Trees](https://courses.cs.duke.edu/fall02/cps124/resources/p119-weber.pdf): the per-level parametric brancher; crown shapes, AttractionUp.
- [Blender manual, Sapling](https://www.blender.org/manual/en/addons/add_curve/sapling.html): Blender's Weber–Penn tree add-on and its parameters.
- [LibreTexts, architectural models of tropical trees](https://bio.libretexts.org/Bookshelves/Evolutionary_Developmental_Biology/Key_to_the_Diversity_and_History_of_Life_(Shipunov)/04:_Geography_of_Life/4.02:_Architectural_Models_of_Tropical_Trees-_Illustrated_Key): an illustrated key to Hallé and Oldeman's 23 models.
- [Virginia Tech dendrology, eastern white pine](https://dendro.cnre.vt.edu/dendrology/syllabus/factsheet.cfm?ID=111): whorls of 5 to 6 branches "like wagon-wheel spokes".
- [Wikipedia, Cupressus sempervirens](https://en.wikipedia.org/wiki/Cupressus_sempervirens): the Italian cypress, under a tenth as wide as tall.
- [Wikipedia, Fir](https://en.wikipedia.org/wiki/Fir): cones that stand upright "like candles".
- [Wikipedia, Larix decidua](https://en.wikipedia.org/wiki/Larix_decidua): larch, a conifer whose needles turn gold and drop.
- [Wikipedia, Betula pendula](https://en.wikipedia.org/wiki/Betula_pendula): birch, white bark with black fissures.
- [Wikipedia, Populus tremuloides](https://en.wikipedia.org/wiki/Populus_tremuloides): aspen, black horizontal scars, clones that turn at different times.
- [NC State, Fagus grandifolia](https://plants.ces.ncsu.edu/plants/fagus-grandifolia/): beech, which keeps dead leaves through winter.
- [Wikipedia, Adansonia digitata](https://en.wikipedia.org/wiki/Adansonia_digitata): baobab, leafless about eight months a year.
- [NC State, Jacaranda mimosifolia](https://plants.ces.ncsu.edu/plants/jacaranda-mimosifolia/): purple-blue bloom on bare wood.
- [NPS, saguaro](https://www.nps.gov/sagu/learn/nature/saguaro.htm): first arms at 60 to 75 years.
- [Wikipedia, Saguaro](https://en.wikipedia.org/wiki/Saguaro): arm counts, the record 78.
- [Wikipedia, Opuntia](https://en.wikipedia.org/wiki/Opuntia): prickly pear, pads stacked end to end.
- [Wikipedia, Ferocactus wislizeni](https://en.wikipedia.org/wiki/Ferocactus_wislizeni): the barrel cactus that leans south.
- [Wikipedia, Agave americana](https://en.wikipedia.org/wiki/Agave_americana): flowers once after 10 to 30 years on a stalk up to 8 m, then dies.
- [Wikipedia, Yucca brevifolia](https://en.wikipedia.org/wiki/Yucca_brevifolia): the Joshua tree, unbranched until its first bloom.
- [USDA Forest Service, snag decay](https://www.fs.usda.gov/media/218293): the decay sequence of a dead conifer, red needles to hard snag.
- [Wikipedia, Papaver rhoeas](https://en.wikipedia.org/wiki/Papaver_rhoeas): the corn poppy, four petals with a black spot.
- [Wikipedia, Rose](https://en.wikipedia.org/wiki/Rose): five petals for the wild rose; no blue pigment.
- [Wikipedia, Tulip](https://en.wikipedia.org/wiki/Tulip): six tepals; no pure blue.
- [Wikipedia, Cosmos bipinnatus](https://en.wikipedia.org/wiki/Cosmos_bipinnatus): eight rays.
- [Wikipedia, Hyacinthoides non-scripta](https://en.wikipedia.org/wiki/Hyacinthoides_non-scripta): the bluebell's one-sided nodding raceme.
- [Wikipedia, Blue flower colouration](https://en.wikipedia.org/wiki/Blue_flower_colouration): blue-flowered species under 10% of flowering plants.
- [Wikipedia, Iris](https://en.wikipedia.org/wiki/Iris_(plant)): irises, which have no true red.
- [Gulf News, a blue chrysanthemum](https://gulfnews.com/world/americas/scientists-give-a-chrysanthemum-the-blues-1.2065787): blue engineered into a flower that lacks it.
- [Germinal WF10, cornfield annuals mix](https://www.externalworksindex.co.uk/entry/37591/Germinal-Amenity/WF10-Cornfield-Annuals-wildflower-seed-mixture/): a meadow as weighted species: corncockle 40%, poppy 25% and so on.
- [Saint11, Vegetation part 1](https://saint11.art/img/pixel-tutorials/Vegetation.gif): a pixel tutorial: "Shape, Light, Detail", no pillow shading, no orphans.
- [Slynyrd, Pixelblog 44: top-down trees](https://slynyrd.com/blog/2023/5/22/pixelblog-44-top-down-trees): foliage bundles shifted along one ramp; 4 or 5 colors a bundle.
- [Red Blob Games, a procedural tree generator](https://simblob.blogspot.com/2022/06/procedural-tree-generator.html): leaf clusters drawn after all branches.
- [Desarrh, Procedural-Tree-Godot](https://github.com/Desarrh/Procedural-Tree-Godot): a Godot pixel tree generator with solid stamps per segment.
- [Games in Progress, t3ssel8r's procedural pixel trees](https://www.gamesinprogress.com/indie-game-developers/t3ssel8r/procedural-pixel-art-trees): scattered-leaf trees "still a bit too messy".
- [Nick McDonald, transport-oriented growth](https://nickmcd.me/2020/10/19/transport-oriented-growth-and-procedural-trees/): leaves seeded from a branch's ID so foliage stays put as a tree grows.
- [Wikipedia, Autumn leaf color](https://en.wikipedia.org/wiki/Autumn_leaf_color): carotenoid yellows, anthocyanin reds.
- [godotshaders, 2D wind sway](https://godotshaders.com/shader/2d-wind-sway/): sway as a per-row offset growing with height.
- [dev.to, animating pixel-art fabric with a Unity shader](https://dev.to/sarasol/animating-pixel-art-fabric-with-unity-shader-6f1): the same sway floored to whole pixels.

## Worlds and levels

[The page](worlds.md).

- [Red Blob Games, terrain from noise](https://www.redblobgames.com/maps/terrain-from-noise/): fBm, redistribution, islands, ridges, terraces, biome tables.
- [Fabric Yarn docs, MultiNoiseUtil.NoiseHypercube](https://maven.fabricmc.net/docs/yarn-1.20.4+build.1/net/minecraft/world/biome/source/util/MultiNoiseUtil.NoiseHypercube.html): Minecraft's biomes as nearest points in climate space.
- [Inigo Quilez, domain warping](https://iquilezles.org/articles/warp): `fbm(p + 4·q)`, coastlines that look authored.
- [xarray-spatial, erosion](https://xarray-spatial.readthedocs.io/en/stable/_modules/xrspatial/erosion.html): droplet erosion in tens of milliseconds.
- [Dwarf Fortress wiki, World generation](https://dwarffortresswiki.org/index.php/World_generation): rivers by steepest descent, and generated history.
- [Darius Kazemi, Spelunky's generator, part 1](https://tinysubversions.com/spelunkyGen/): the 4×4 room walk and its solution path.
- [Darius Kazemi, Spelunky's generator, part 2](https://tinysubversions.com/spelunkyGen2/): 10×8 room templates whose glyphs are chances.
- [Boris the Brave, dungeon generation in The Binding of Isaac](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/): rooms grown by BFS on a 9×8 grid, boss in the farthest dead end.
- [Brogue wiki, Level generation](https://brogue.wiki/wiki/Level_generation): loops only where a wall's sides are far apart by path; B5678/S45678 lakes.
- [RogueBasin, cellular automata caves](https://www.roguebasin.com/index.php/Cellular_Automata_Method_for_Generating_Random_Cave-Like_Levels): 40 to 45% walls, the 4-5 rule, flood fill.
- [Boris the Brave, dungeon generation in Unexplored](https://www.boristhebrave.com/2021/04/10/dungeon-generation-in-unexplored/): cyclic generation; 24 cycle types, about 5,000 rewrite rules.
- [Deepnight, the level design of Dead Cells](https://deepnight.net/tutorial/the-level-design-of-dead-cells-a-hybrid-approach/): concept graphs filled with handmade rooms; monster budgets.
- [Maxim Gumin, WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse): the original WFC; simple tiled and overlapping models.
- [Paul Merrell, model synthesis](https://paulmerrell.org/model-synthesis/): the constraint solver WFC grew from.
- [Karth and Smith, WFC slides](https://creativecoding.soe.ucsc.edu/courses/cmpm202_w20/slides/W2_Tues_Karth_WaveFunctionCollapse.pdf): WFC is NP-hard; global restarts rarely succeed.
- [Boris the Brave, classification of tilesets](https://www.boristhebrave.com/2021/11/14/classification-of-tilesets/): 47 blob tiles against 16 corner tiles, or 6 with symmetry.
- [Boris the Brave, quarter-tile autotiling](https://www.boristhebrave.com/2023/05/31/quarter-tile-autotiling/): the dual grid, terrain on cell corners.
- [LDtk, auto-layer rules](https://ldtk.io/docs/general/auto-layers/auto-layer-rules/): small grid patterns that paint a tile when they match.
- [Bridson 2007, fast Poisson-disk sampling](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf): O(N) scatter, k = 30 tries per point.
- [devmag, Poisson-disk sampling](https://devmag.org.za/2009/05/03/poisson-disk-sampling/): density varied by noise.
- [Watabou, itch.io comment](https://itch.io/post/346778): the Voronoi diagram is "not really necessary" in his city generator.
- [Parish and Müller 2001, procedural modeling of cities (SIGGRAPH archive)](https://history.siggraph.org/?p=116923): roads grown as L-systems steered by density and terrain.
- [RandRoll, interview with Watabou](https://randroll.com/interview-watabou-2): "Narrative stuff is hard".
- [Turn Based Lovers, interview with Wildermyth's developer](https://turnbasedlovers.com/10-turns-interview/with-wildermyth-developer): generation built around characters, not plot.
- [Caves of Qud wiki, World generation](https://wiki.cavesofqud.com/wiki/World_generation): five fixed periods of sultan rule, generated and tied to sites.
- [Smith and Whitehead, expressive range (arXiv 2004.10808)](https://arxiv.org/pdf/2004.10808): judging a generator by many outputs on two metrics, as a heatmap.

## Real geography

[The page](geography.md).

- [Tarn Adams, Gamasutra Q&A on the development of Dwarf Fortress](https://gamasutra.com/design/q-a-dissecting-the-development-of-i-dwarf-fortress-i-with-creator-tarn-adams): Dwarf Fortress's world generation in Adams's words, stage by stage.
- [John Harris, Interview: The Making Of Dwarf Fortress (Game Developer, 2008)](https://www.gamedeveloper.com/design/interview-the-making-of-dwarf-fortress): midpoint displacement, drainage and salinity fields, rivers that dig when stuck.
- [Dwarf Fortress wiki, DF2014:World generation](https://dwarffortresswiki.org/index.php/DF2014:World_generation): Adams's stage list quoted in full; world sizes 17 to 257 squares.
- [Dwarf Fortress wiki, DF2014:Advanced world generation](https://dwarffortresswiki.org/index.php/DF2014:Advanced_world_generation): field tokens, the weighted mesh, biome thresholds, erosion and cavern parameters.
- [Dwarf Fortress wiki, DF2014:World rejection](https://dwarffortresswiki.org/index.php/DF2014:World_rejection): "belt and braces"; region counts, ranges and placement minimums that reroll a world.
- [Dwarf Fortress wiki, World rejection](https://dwarffortresswiki.org/index.php/World_rejection): worlds that fail placement constraints, and the rejection log.
- [Dwarf Fortress wiki, DF2014:Site](https://dwarffortresswiki.org/index.php/DF2014:Site): site types and the cap on new sites.
- [Dwarf Fortress wiki, v0.31:Civilisation](https://dwarffortresswiki.org/index.php/v0.31:Civilisation): savagery that blocks civilization placement.
- [Isegoria, quoting Polygon on Dwarf Fortress (2014)](https://www.isegoria.net/?p=35819): strata as a separate fractal; rivers "only after biomes exist".
- [Minecraft Wiki, World generation](https://minecraft.wiki/w/World_generation): the six biome parameters and their bands, density, splines, continentalness as a shelf.
- [Minecraft Wiki, Cave](https://minecraft.wiki/w/Cave): cheese, spaghetti and noodle caves; aquifer cells of 16×12×16 blocks.
- [Henrik Kniberg, Minecraft terrain generation in a nutshell (2022)](https://www.youtube.com/watch?v=CSa5O6knuwI): the talk on the 1.18 generator.
- [Martin O'Leary, mewo2/terrain](https://github.com/mewo2/terrain/blob/master/terrain.js): 16,384 points, primitive heightmaps, five rounds of flux-and-slope erosion, cities by river flux.
- [Red Blob Games, mapgen4 mesh.ts](https://github.com/redblobgames/mapgen4/blob/master/mesh.ts): precomputed Poisson points loaded from a file.
- [Red Blob Games, mapgen4 config.js](https://github.com/redblobgames/mapgen4/blob/master/config.js): mapgen4's parameters.
- [Red Blob Games, mapgen4 README](https://github.com/redblobgames/mapgen4/blob/master/README.org): 1 million+ cells possible, prettiest around 25k.
- [Red Blob Games, mapgen4 map.ts](https://github.com/redblobgames/mapgen4/blob/master/map.ts): elevation, the wind-sorted rain sweep, priority-flood rivers, trunk beds lowered to tributaries.
- [Amit Patel, mapgen4: rainfall (2018)](https://simblob.blogspot.com/2018/09/mapgen4-rainfall.html): one sorted pass along the wind; moisture leaking through passes.
- [Amit Patel, mapgen4: threads (2018)](https://simblob.blogspot.com/2018/09/mapgen4-threads.html): generation moved into a Web Worker "to make it run acceptably fast".
- [Azgaar wiki, Advanced options](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Advanced-options): the jittered lattice and its points count.
- [Azgaar wiki, Knowledge Base](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Knowledge-Base): 10K points for performance, no mobile app, cultures by terrain.
- [Azgaar wiki, Heightmap template editor](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Heightmap-template-editor): heightmaps from blob primitives, with 20 as sea level.
- [Azgaar wiki, Geographical features](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Geographical-Features-Overview): lake subtypes and features.
- [Azgaar, temperature-generator.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/temperature-generator.ts): temperature by latitude, minus 6.5 °C per km.
- [Azgaar, precipitation-generator.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/precipitation-generator.ts): winds by latitude tier; cells above height 85 block the wind.
- [Azgaar, river-generator.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/river-generator.ts): rivers at flux 30, lakes raised to their shore, a downcut of at most 5.
- [Azgaar, lakes.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/lakes.ts): lakes drain only when inflow beats evaporation.
- [Azgaar, biomes-generator.ts](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/model/physical/biomes-generator.ts): a 5 × 26 moisture-by-temperature biome matrix with overrides.
- [Mindwerks, WorldEngine](https://github.com/Mindwerks/worldengine): plate-based worlds and Holdridge life zones; "could take a few minutes".
- [WorldEngine, plates.py](https://github.com/Mindwerks/worldengine/blob/master/worldengine/plates.py): the pyplatec plate simulation's defaults.
- [WorldEngine, generation.py](https://github.com/Mindwerks/worldengine/blob/master/worldengine/generation.py): borders faded to ocean, a flattened shelf, oceans flooded from the edges.
- [WorldEngine, simulations](https://github.com/Mindwerks/worldengine/tree/master/worldengine/simulations): precipitation as gamma-shaped noise; river and erosion passes.
- [Undiscovered Worlds, what it is](https://undiscoveredworlds.blogspot.com/2019/01/what-is-undiscovered-worlds.html): global maps at about 16 km a pixel, regional maps on demand.
- [Undiscovered Worlds, springs and valleys (2025)](https://undiscoveredworlds.blogspot.com/2025/12/springs-and-valleys.html): rivers and lakes "more or less" working.
- [Undiscovered Worlds on GitHub](https://github.com/fegennari/Undiscovered_Worlds): the source.
- [Frozen Fractal, Around The World, part 2: plate tectonics (2023)](https://frozenfractal.com/blog/2023/11/13/around-the-world-2-plate-tectonics/): plates by flood fill; boundary type × crust type picks a profile.
- [Terrafirmacraft docs, world presets (1.20.x)](https://terrafirmacraft.github.io/Documentation/1.20.x/worldgen/world-preset): layer types and twenty rocks stacked as a chain.
- [Modrinth, Terrafirmacraft 3.0.0 beta](https://modrinth.com/mod/terrafirmacraft/version/3.0.0-beta): more predictable strata, ores rebalanced around them.
- [Vintage Story Wiki, Rock](https://wiki.vintagestory.at/Rock): geologic provinces set layer thickness; ores tied to host rocks.
- [Cordonnier et al. 2016, Large Scale Terrain Generation from Tectonic Uplift and Fluvial Erosion](https://www.cs.purdue.edu/homes/bbenes/papers/Cordonier16CGF.pdf): the implicit stream-power solve, about 200 steps to converge at any resolution.
- [Schott et al. 2023, project page](https://h-schott.github.io/p/uplift): stream power as an interactive authoring tool.
- [H-Schott, StreamPowerErosion](https://github.com/H-Schott/StreamPowerErosion): the released code.
- [StreamPowerErosion, spe_shader.glsl](https://github.com/H-Schott/StreamPowerErosion/blob/main/data/shaders/spe_shader.glsl): the per-cell compute-shader kernel and its defaults.
- [Barnes, Lehman and Mulla 2014, Priority-Flood (arXiv 1511.04463)](https://arxiv.org/abs/1511.04463): depression filling in O(n) or O(n lg n), with flow directions.
- [Beyer 2015, Implementation of a method for hydraulic erosion](https://ardordeosis.github.io/implementation-of-a-method-for-hydraulic-erosion/thesis-beyer.pdf): droplet erosion and its timings; cost grows with radius².
- [Sebastian Lague, Hydraulic-Erosion](https://github.com/SebLague/Hydraulic-Erosion): a Unity port of droplet erosion with precomputed brushes.
- [henrikglass, erodr](https://github.com/henrikglass/erodr): droplet erosion in C, and its defaults.
- [Smelik et al. 2009, A Survey of Procedural Methods for Terrain Modelling](https://publications.graphics.tudelft.nl/rails/active_storage/blobs/redirect/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBBcmtLIiwiZXhwIjpudWxsLCJwdXIiOiJibG9iX2lkIn19--a99ce149fd6820493fdcb22b4f4b5e3cccbd976e/SDGTB09a.pdf): thermal erosion by talus angle; Olsen's real-time speed-ups.
- [Peel's Köppen page, University of Melbourne](https://people.eng.unimelb.edu.au/mpeel/koppen.html): the Köppen–Geiger rules.
- [Peel, Finlayson and McMahon 2007 (HESS)](https://hess.copernicus.org/articles/11/1633/2007/): the updated Köppen–Geiger classification.
- [PMC, Köppen table reproduction](https://pmc.ncbi.nlm.nih.gov/articles/PMC4676011/table/t1): a copy that disagrees on the steppe threshold.
- [Johnson, Yannakakis and Togelius 2010, cellular automata for real-time cave levels](https://www.um.edu.mt/library/oar/bitstream/123456789/22895/1/Cellular_automata_for_real-time_generation_of.pdf): 50×50 caves in 0.41 ms.
- [Paris et al. 2021, Synthesizing Geologically Coherent Cave Networks](https://diglib.eg.org/handle/10.1111/cgf14420): karst skeletons by anisotropic shortest paths.
- [Wikipedia, Spring line settlement](https://en.wikipedia.org/wiki/Spring_line_settlement): villages at the foot of an escarpment where springs emerge.
- [Rashid Faridi, site of a settlement](https://rashidfaridi.com/2019/08/06/site-of-a-settlement): wet-point and dry-point sites.
- [Save My Exams, settlements and service provision](https://www.savemyexams.com/igcse/geography/cie/20/flashcards/1-population-and-settlement/1-5-settlements-and-service-provision/): the standard site factors.
- [British Landscape, reading the landscape](https://britishlandscape.org/reading-the-landscape/files/archive-apr-2013.htm): aspect and shelter as siting factors.
- [AMS Glossary, adret](https://glossary.ametsoc.org/wiki/adret/): the sun-facing slope.
- [AMS Glossary, ubac](https://glossary.ametsoc.org/wiki/ubac/): the shaded slope, with a lower timber line.
- [cahier-de-prepa.fr course notes](https://cahier-de-prepa.fr/hkal-thiers/download?id=1628): adret for villages and crops, ubac for forest.
- [Parc national des Écrins booklet](https://www.ecrins-parcnational.fr/sites/ecrins-parcnational.com/files/fiche_doc/17153/correctionslivretenfant05-09-07.pdf): villagers settled the sunniest zones.
- [GMBA, treeline definition](https://www.gmba.unibe.ch/tools/definitions/treeline_definition/index_eng.html): the treeline at a growing-season mean of about 6.4 °C.
- [Körner and Paulsen 2004](https://edoc.unibas.ch/8594): 6.7 ± 0.8 °C from 46 treeline sites.
- [PMC3535059](https://pmc.ncbi.nlm.nih.gov/articles/PMC3535059): the treeline temperature, later work.
- [Emilien et al. 2012, Procedural Generation of Villages on Arbitrary Terrains](https://perso.liris.cnrs.fr/egalin/Articles/2012-villages.pdf): interest maps with a veto, roads and houses grown together, parcels.
- [HAL, Emilien et al. 2012](https://hal.archives-ouvertes.fr/hal-00694525): the same paper's record.
- [Watabou, village generator devlog 1.4.0](https://watabou.itch.io/village-generator/devlog/507254/140-village-square-and-orchards): a distorted circle on the highway becomes the square.
- [Watabou, village generator devlog 1.6.4](https://watabou.itch.io/village-generator/devlog/840277/164-crossroads-and-numbered-houses): villages at a crossroads or T-junction.
- [Watabou, village generator comments](https://watabou.itch.io/village-generator/comments?after=162): players on roads through villages.
- [Mezha, Ostriv Alpha 5](https://mezha.media/en/2023/03/20/the-ukrainian-urban-planning-strategy-ostriv-has-received-an-alpha-5-update): two- and three-story houses and paved roads.
- [Wikipedia, Tobler's hiking function](https://en.wikipedia.org/wiki/Tobler%27s_hiking_function): walking speed against slope, fastest slightly downhill.
- [movecost vignette](https://cran.nics.utk.edu/cran/web/packages/movecost/vignettes/movecost.Rmd): least-cost paths with Tobler, cell by cell.
- [par.nsf.gov 10420114](https://par.nsf.gov/servlets/purl/10420114): one cost function misses travel-rate variability.
- [Galin et al. 2010, Procedural Generation of Roads](https://perso.liris.cnrs.fr/egalin/Articles/2010-roads.pdf): road cost curves, bridges and tunnels, k-masks against 45° artifacts.
- [Galin et al. 2011, Authoring Hierarchical Road Networks](https://www.cs.purdue.edu/homes/bbenes/papers/Galin11CGF.pdf): road levels by settlement size, proximity pruning, merged junctions.
- [Helbing et al., active walker model (arXiv cond-mat/9806097)](https://ar5iv.labs.arxiv.org/html/cond-mat/9806097): trails that wear in with use and fade without it.
- [Helbing et al., arXiv cond-mat/9805158](https://arxiv.org/pdf/cond-mat/9805158): direct, minimal and minimal-detour trail systems.
- [USFS, trail design](https://www.fs.usda.gov/t-d/pubs/htmlpubs/htm07232806/page04.htm): the half rule and the ten percent average guideline.
- [Shuswap Trail Alliance, trail design standards](https://shuswaptrails.com/userfiles/file/sta_trail_design_standards%20sml.pdf): maximum short-pitch grades.
- [Cordonnier et al. 2017 (ACM ToG)](https://cs.purdue.edu/homes/bbenes/papers/Cordonnier17ToG.pdf): viability hat functions, vigor and stress, humus by slope, the lapse rate.
- [Gain et al. 2017, EcoBrush](https://people.cs.uct.ac.za/~Jgain/wp-content/papercite-data/pdf/gain2017.pdf): monthly soil moisture, clustered conditions, plant spacing histograms.
- [Eurographics record, EcoBrush](https://diglib.eg.org:443/handle/10.1111/cgf13107): the same paper's record.
- [Hammes on flipcode](https://flipcode.com/archives/02-07-2002.shtml): plants placed at runtime from ecotopes.
- [Hammes 2001 (DOI 10.1007/3-540-44818-7_14)](https://doi.org/10.1007/3-540-44818-7_14): the paper.
- [Deussen et al. 1998, Realistic modeling and rendering of plant ecosystems](https://algorithmicbotany.org/papers/ecosys.sig98.pdf): circle competition and self-thinning; eight species segregate.
- [Deussen et al. 1998, project page](https://algorithmicbotany.org/papers/ecosys.sig98.html): the paper's page.
- [Verdant 02 Elevation Tileset](https://csaf.itch.io/verdant-02-elevation): cliffs as four bands plus a shadow row; lit north and west rims.
- [Biome tileset terrain set-up tutorial](https://itch.io/devlog/986063/biome-tileset-packs-terrain-set-up-tutorial.amp): layers for cliffs and caves; three-part, 3-frame waterfalls.
- [OpenGameArt, cave entrances](https://opengameart.org/node/5481): entrances only in the faces you see.
- [Radical Fish Games, why auto jump](https://www.radicalfishgames.com/?p=1168): CrossCode's height layers without perspective.
- [PlayStation Blog, Sea of Stars](https://blog.playstation.com/?p=382678): climbing and ledge-hoisting as core traversal.
- [MobileSyrup, interview with Thierry Boulanger](https://mobilesyrup.com/2023/09/11/sea-of-stars-level-design-sabotage-studio-thierry-boulanger-interview/): verticality in Sea of Stars' levels.
- [Nintendo Life, Sea of Stars hands-on](https://www.nintendolife.com/news/2020/03/hands_on_first_impressions_of_sea_of_stars_the_next_project_from_the_messenger_dev_sabotage): moving off the grid.
- [Nexus Mods, Wargroove tileset mod](https://www.nexusmods.com/wargroove/mods/44): cliffs as a wall-style autotile, not true elevation.
- [SNESLab, BG3 High Priority](https://sneslab.net/wiki/BG3_High_Prio): per-tile priority bits, for walk-under layers.
- [SNESdev wiki, Mode 5](https://snes.nesdev.org/wiki/Mode_5): SNES background modes.
- [Slynyrd, Pixelblog 20: top-down tiles](https://slynyrd.com/blog/2019/8/27/pixelblog-20-top-down-tiles): 16×16 as the common tile size.

## Zoom and chunks

[The page](zoom.md).

- [Factorio Friday Facts #180](https://factorio.com/blog/post/fff-180): a schematic chart apart from the world view.
- [Factorio forum, map zoom sharpness](https://forums.factorio.com/viewtopic.php?p=448642): non-integer map steps that "aren't as sharp as normal view".
- [Minecraft Wiki, Map](https://minecraft.wiki/w/Map): 128×128 maps at 1:1 to 1:16; Java's most-common-block color, Bedrock's point sample.
- [Dwarf Fortress wiki, Embark](https://dwarffortresswiki.org/index.php/DF2014:Embark): world, region and local tiles nested by 16 and 48.
- [newreleases.io, Distant Horizons 1.16.5-a1.4](https://newreleases.io/project/gitlab/jeseibel/distant-horizons/release/1.16.5-a1.4): the LOD mod's move to a quadtree.
- [Modrinth, Distant Horizons changelog](https://modrinth.com/mod/distanthorizons/changelog?page=2): low detail first, refined around the player.
- [OpenStreetMap wiki, Zoom levels](https://wiki.openstreetmap.org/wiki/Zoom_levels): the world in 4^zoom tiles of 256 pixels.
- [squirkel](https://zff.dev/thersgo/squirkel): sharp-bilinear fractional zoom with only `drawImage`.
- [CapView wiki, scaling and sharpening](https://github.com/NuclearMeltdown/CapView/wiki/Scaling-and-sharpening): the nearest-then-smooth scaling trick explained.

## Palette and resolution

[The page](looks.md).

- [NESdev, PPU palettes](https://www.nesdev.org/wiki/PPU_palettes): 4 background and 4 sprite palettes of 4 colors.
- [NESdev, PPU attribute tables](https://www.nesdev.org/wiki/PPU_attribute_tables): one subpalette per 16×16 background area.
- [Pan Docs, Game Boy specifications](https://gbdev.io/pandocs/Specifications.html): 4 shades at 160×144, 10 sprites a line.
- [PICO-8 manual](https://www.lexaloffle.com/dl/docs/pico-8_manual.html): 16 colors at 128×128; `pal()` remaps, `fillp()` dither patterns.
- [Slynyrd, Pixelblog 1: color palettes](https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes): hue-shifted ramps, at most about 20° a step.
- [Björn Ottosson, OKLab](https://bottosson.github.io/posts/oklab/): a perceptual color space; hue error 0.49 RMS against CIELAB's 0.69.
- [Wikipedia, Color quantization](https://en.wikipedia.org/wiki/Color_quantization): nearest palette color by distance in a Lab space.
- [Wikipedia, Ordered dithering](https://en.wikipedia.org/wiki/Ordered_dithering): the Bayer matrix and its −½ offset.
- [Wikipedia, Floyd–Steinberg dithering](https://en.wikipedia.org/wiki/Floyd%E2%80%93Steinberg_dithering): error diffusion, which depends on scan order and content.
- [Rune Skovbo Johansen, surface-stable fractal dithering](https://runevision.com/tech/dither3d): dots pinned to surfaces so they don't crawl.
- [Nintendo Everything, Octopath Traveler's developers](https://nintendoeverything.com/octopath-traveler-devs-on-character-origins-visual-style-initial-hd-rumble-plans-much-more/): sprites on big screens looked "lonely and simple".
- [Unity forum, smooth-looking pixel art in motion](https://discussions.unity.com/t/smooth-looking-pixel-art-in-motion/907566): snap to whole pixels, offset the final blit by the fraction.
- [Fab, a pixel-perfect camera listing](https://www.fab.com/listings/816f34f2-1a2e-4910-b3dd-009b5da0873b): the same subpixel-offset camera as a product.

## Text and interface

[The page](text.md), and the colorblind section of [Palette and resolution](looks.md#palettes-everyone-can-read).

- [DaltonLens, a review of open-source color vision deficiency simulations](https://daltonlens.org/opensource-cvd-simulation/): which simulation models hold up, and libDaltonLens's matrices.
- [Xbox Accessibility Guidelines 101, text display](https://devdocs.xbox.com/build/game-principles/accessibility/xag-deep-dives/xag-101-text-display.md): minimum text sizes and contrast for games.
- [AngelCode, the BMFont file format](https://www.angelcode.com/products/bmfont/doc/file_format.html): the common bitmap font format.
- [Brysbaert 2019, reading rate](https://www.Gwern.net/doc/psychology/linguistics/2019-brysbaert.pdf): how fast adults read silently, for typewriter speeds.
- [W3C, WCAG 2.5.8 target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): the minimum size of a touch target.
- [IGDA GASIG, don't implement colorblind filters](https://igda-gasig.org/how/platform-level-accessibility-recommendations/do-not-implement-colorblind-filters/): why to design palettes rather than filter them.
- [TakWolf, Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font): an open pixel font with CJK at low sizes.

## Perspectives

[The page](views.md).

- [Wikipedia, Isometric video game graphics](https://en.wikipedia.org/wiki/Isometric_video_game_graphics): the 2:1 grid is dimetric, at about 26.565°.
- [Wikipedia, Mode 7](https://en.wikipedia.org/wiki/Mode_7): an affine matrix per scanline, sampled without interpolation.
- [Lode Vandevenne, raycasting](https://lodev.org/cgtutor/raycasting.html): a ray a column, DDA, perpendicular distance.
- [Lou's Pseudo 3d Page](http://www.extentofthejam.com/pseudo/): OutRun-style roads from a Z map per line.
- [s-macke, VoxelSpace](https://github.com/s-macke/VoxelSpace): Comanche's height-map renderer in under 20 lines.

## The sun

[The page](sun.md).

- [Sabotage, Sea of Stars press kit](https://sabotagestudio.com/presskits/sea-of-stars/): "a custom-made render pipeline" with "full-on dynamic lighting".
- [Game Developer, Eastward's creators](https://www.gamedeveloper.com/art/eastward-s-creators-share-insights-on-making-pixel-art-adventures): assets rebuilt in 3D with hand-painted bump maps.
- [80.lv, Graveyard Keeper's sequel is 3D](https://80.lv/articles/almost-every-object-in-this-stardew-valley-style-cemetery-sim-is-actually-3d): pixel art projected onto Blender models.
- [Chucklefish forum, Stardew night lighting](https://community.playstarbound.com/threads/request-better-night-lighting.108239/): `outdoorLight` scaled between two times, from decompiled code.
- [Klei forums, making a custom colour cube](https://kleiforums.com/forums/topic/165348-guide-making-a-custom-colour-cube/): Don't Starve's day, dusk, night and full-moon color cubes.
- [Lazy Bear Games, Graveyard Keeper's graphics effects](https://slava.lazybeargames.com/graveyard-keeper-how-the-graphics-effects-are-made): night tint, and shadows that rotate around a point.
- [Wikipedia, Position of the Sun](https://en.wikipedia.org/wiki/Position_of_the_Sun): declination within about 2°.
- [Wikipedia, Solar zenith angle](https://en.wikipedia.org/wiki/Solar_zenith_angle): elevation from latitude, declination and hour angle.
- [Wikipedia, Solar azimuth angle](https://en.wikipedia.org/wiki/Solar_azimuth_angle): the azimuth's atan2 form.
- [PC Gamer, Witchbrook: what we know](https://www.pcgamer.com/witchbrook-release-date-gameplay-trailer-what-we-know): "Days get longer or shorter depending on the season".
- [Wikipedia, Golden hour](https://en.wikipedia.org/wiki/Golden_hour_(photography)): between about −6° and +10° of elevation; no sharp shadows in blue hour.
- [Sector12 Games, skew-shear vertex shader](https://www.sector12games.com/skewshear-vertex-shader/): shadows by skewing the sprite and drawing it black.
- [Gobs and Gods, 2D shadows](https://www.gobsandgods.com/blog/shadows-2d.html): each pixel's silhouette offset by its height above a root line.
- [dev.to, an HD-2D pipeline on DX12](https://dev.to/gaurav_de/creating-an-hd-2d-rendering-pipeline-on-dx12-205k): alpha-tested casters whose shadows match the pixel art.
- [GameDev.net, terrain self-shadows](https://gamedev.net/forums/topic/351505-terrain-self-shadows/3309444/): horizon maps as the fast path for terrain shadow.
- [JoonyoungSeo, unity-isometric-pixel-pipeline](https://github.com/JoonyoungSeo/unity-isometric-pixel-pipeline): an iso pipeline that fixes cloud-shadow direction at low suns.
- [Unreal forums, color-cycled 8-bit scenes](https://forums.unrealengine.com/t/beautiful-8-bit-pixel-art-scenes-animated-through-color-cycling/35110): a palette texture with "U = color index, V = time"; 3D LUTs too big for phones.
- [Yanrishatum, palette shader gist](https://gist.github.com/Yanrishatum/86794e9e663a7e343f9ef66e8b0f38ae): a palette lookup shader.
- [Pierre Vigier, palette swapping with shaders](https://pvigier.github.io/2019/10/06/palette-swapping-with-shaders.html): index-to-color swaps on the GPU.

## Light

[The page](light.md).

- [Normal-map generators compared (arXiv 2212.09692)](https://arxiv.org/pdf/2212.09692v1.pdf): "no technique could produce maps as good as" an artist's for pixel art.
- [Minecraft Wiki, Light](https://minecraft.wiki/w/Light): sky and block light in separate channels, combined through a lightmap.
- [Unity URP, light blend styles](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/LightBlendStyles.html): modulate and additive factors, the same as `light.Smooth`.
- [Godot docs, 2D lights and shadows](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html): light at viewport resolution, not texel resolution.
- [Unity forum, efficient per-texel lighting](https://discussions.unity.com/t/the-quest-for-efficient-per-texel-lighting/700574): posterized light leaves "jagged patches" unless done per texel.
- [unitycoder, LutLight2D](https://github.com/unitycoder/LutLight2D): a hand-made gradient per palette color, picked by light.
- [Game Developer, the art direction of Bloodless](https://gamedeveloper.com/art/deep-dive-behind-the-starkly-stylish-art-direction-of-bloodless): four colors, blended by light with dithered borders.
- [Surma, Ditherpunk](https://surma.dev/things/ditherpunk/): Bayer, blue noise and error diffusion compared.
- [W3C, Compositing and Blending](https://www.w3.org/TR/compositing-1/): the blend formulas behind additive and screen mixing.
- [Terraria 1.4.4.1, LightMap.cs (decompiled)](https://github.com/br4dnblehh/terraria-source-code/blob/main/1.4.4.1/Terraria.Graphics.Light/LightMap.cs): sweeps with 0.91 per air tile and 0.56 per solid.
- [Terraria 1.4.4.1, Lighting.cs (decompiled)](https://github.com/br4dnblehh/terraria-source-code/blob/main/1.4.4.1/Terraria/Lighting.cs): the light modes and corner averaging.
- [OpenStarbound, StarCellularLightArray.hpp](https://github.com/OpenStarbound/OpenStarbound/blob/main/source/base/StarCellularLightArray.hpp): the octagonal cellular light spread.
- [OpenStarbound, StarCellularLightArray.cpp](https://github.com/OpenStarbound/OpenStarbound/blob/main/source/base/StarCellularLightArray.cpp): its point lights with fractional obstruction.
- [Adam Milazzo, roguelike vision algorithms](http://www.adammil.net/blog/v125_Roguelike_Vision_Algorithms.html): shadowcasting against ray casting, cell visits counted.
- [Red Blob Games, 2D visibility](https://www.redblobgames.com/articles/visibility/): exact visibility polygons by sweep.
- [Matt DesLauriers, 2D pixel-perfect shadows](https://github.com/mattdesl/lwjgl-basics/wiki/2D-Pixel-Perfect-Shadows): the 1D polar shadow map.
- [Sam Bigos, 2D global illumination in Godot](https://samuelbigos.github.io/posts/2dgi1-2d-global-illumination-in-godot.html): jump-flood GI, 32 rays a pixel, still noisy.
- [80.lv, radiance cascades](https://80.lv/articles/radiance-cascades-new-approach-to-calculating-global-illumination): Sannikov's method, the cost of 16 rays without noise.
- [jason.today, radiance cascades](https://jason.today/rc): an interactive walkthrough of radiance cascades.
- [GM Shaders, radiance cascades](https://mini.gmshaders.com/p/radiance-cascades): another explainer of the method.
- [80.lv, interview with the developers of Dead Cells](https://80.lv/articles/interview-with-the-developers-of-dead-cells): backgrounds redrawn as normal maps.
- [Game Developer, hand-drawn normal maps in The Siege and the Sandfox](https://gamedeveloper.com/art/adding-depth-to-2d-with-hand-drawn-normal-maps-in-i-the-siege-and-the-sandfox-i-): one pixel holds one normal; angles over gradients.
- [TechRaptor, the art of Children of Morta](https://techraptor.net/content/how-dead-mage-created-the-art-for-children-of-morta): sprites stretched about four times so light runs finer than the art.
- [Phaser, post bloom](https://phaser.io/packs/post-bloom.md): threshold bloom at 0.55 by default.
- [three.js, ShaderGodRays](https://github.com/timoxley/threejs/blob/master/examples/js/ShaderGodRays.js): screen-space god rays in three passes of six samples.

## Motion

[The page](motion.md).

- [Glenn Fiedler, Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/): the fixed-step accumulator and the "spiral of death".
- [Unity blog, the procedural design of Rain World](https://unity.com/en/blog/exploring-procedural-design-rain-world): limbs moved in code, mixed with traditional animation.
- [Scale2x, the algorithm](https://www.scale2x.it/algorithm): four edge-preserving rules; Scale4x is Scale2x twice.
- [rotsprite crate, rotate.rs](https://docs.rs/crate/rotsprite/latest/source/src/rotate.rs): RotSprite: upscale, rotate nearest, downsample.
- [torcado, cleanEdge](https://torcado.com/cleanEdge/): pixel art scaled and rotated "as if it were a vector drawing", as a shader.
- [McGuire and Gagiu 2021, MMPX](https://casual-effects.com/research/McGuire2021PixelArt/McGuire2021PixelArt.pdf): palette-exact 2× magnification, 64k pixels in under 0.5 ms, JS reference code.

## Effects and simulations

[The page](effects.md).

- [Joseph Huckaby, old-school color cycling with HTML5](http://www.effectgames.com/effect/article-Old_School_Color_Cycling_with_HTML5.html): Canvas Cycle, redrawing only cycling pixels; ran on an iPhone 3GS.
- [80.lv, color cycling returns with HTML5](https://80.lv/articles/color-cycling-from-the-90s-returns-with-html5): Mark Ferrari's scenes and BlendShift fades.
- [Fabien Sanglard, Doom PSX fire](https://fabiensanglard.net/doom_fire_psx/): 37 heat indexes, each pixel copying the one below minus 0 or 1.
- [80.lv, Noita's falling sand](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/): 64×64 chunks with dirty rectangles; rigid bodies; durability.
- [Jos Stam, real-time fluid dynamics (Autodesk Research)](https://www-pt.autodesk.com/research/publications/real-time-fluid-dynamics): stable fluids, stable at any step.
- [PlayStation Blog, Animal Well](https://blog.playstation.com/?p=367113): a Navier-Stokes layer thresholded "to fit the pixel art".
- [WebKit bug 235196](https://bugs.webkit.org/show_bug.cgi?id=235196): cited for the rule never to call `getImageData` on a GPU canvas: readback is the main phone hazard.
- [The Powder Toy, elements](https://github.com/The-Powder-Toy/The-Powder-Toy/tree/master/src/simulation/elements): every material's numbers; weights from gas 1 to solids 100.
- [The Powder Toy, ACID.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/ACID.cpp): `Hardness` as resistance to acid.
- [The Powder Toy, Simulation.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/Simulation.cpp): lava's `ctype` remembering what melted.
- [The Powder Toy, FIRE.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/FIRE.cpp): fire, burning and its chances.
- [The Powder Toy, WATR.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/WATR.cpp): water's reactions.
- [The Powder Toy, PLNT.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/PLNT.cpp): plants drinking water and growing.
- [Sandboxels, index.html](https://github.com/R74nCom/sandboxels/blob/main/index.html): materials as a data table; viscosity as a probability.
- [Max Bittker, Making Sandspiel](https://maxbittker.com/making-sandspiel): cells of species, grain, state and clock; updating in place.
- [Sandspiel, species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs): Sandspiel's rules, burn countdowns and chances.
- [Noita wiki, Material](https://noita.wiki.gg/wiki/Material): material durability (sand 4, brickwork 14).
- [jason.today, falling sand improved](https://jason.today/falling-improved): alternating scan direction so neither side goes first.
- [Hacker News, a falling-sand thread](https://news.ycombinator.com/item?id=31309616): clock bits and updating in place.
- [LifeWiki, Margolus neighborhood](https://conwaylife.com/wiki/Margolus_neighborhood): order-free block updates that leave gaps between grains.

## Sound and music

[The page](sound.md).

- [DrPetter, sfxr](https://www.drpetter.se/project_sfxr.html): the 2007 generator that made game effects from a dozen numbers.
- [Frank Force, ZzFX](https://github.com/KilledByAPixel/ZzFX): the same idea in 21 numbers and under a kilobyte.
- [Paul Adenot, Web Audio performance notes](https://padenot.github.io/web-audio-perf/): what each node costs.
- [NESdev wiki, the APU](https://www.nesdev.org/wiki/APU): the NES's five channels, the chip as a style.
- [iMUSE on Wikipedia](https://en.wikipedia.org/wiki/IMUSE): LucasArts' music that changes at marked points.
- [A Sound Effect, Paul Weir on No Man's Sky](https://www.asoundeffect.com/no-mans-sky-sound-procedural-audio/): procedural audio and generated music in a shipped game.
- [Chris Wilson, a tale of two clocks](https://web.dev/articles/audio-scheduling): the look-ahead scheduler.
- [MDN, AudioSession.type](https://developer.mozilla.org/en-US/docs/Web/API/AudioSession/type): Safari's switch between ambient and playback audio.

## Phones and budgets

[The page](phones.md).

- [WebKit, updates to storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/): Safari's storage quotas and eviction.
- [WebKit, full third-party cookie blocking and more](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/): the seven-day cap on script-written storage.
- [WebKit bug 277848](https://bugs.webkit.org/show_bug.cgi?id=277848): the 1.5 GB soft memory limit for a tab.
- [WebKit bug 215745](https://bugs.webkit.org/show_bug.cgi?id=215745): requestAnimationFrame held to 30 fps in Low Power Mode.
- [Notebookcheck, iPhone 17 Pro review](https://www.notebookcheck.net/Apple-iPhone-17-Pro-review-Faster-longer-further-Is-that-enough.1140998.0.html): browser benchmark scores and throttling for a current phone.
- [Yan et al., HotPower 2015](https://engineering.purdue.edu/~hotpower/HotPower_2015_paper_6.pdf): what frame rate costs in battery.
- [Surma, is postMessage slow?](https://surma.dev/things/is-postmessage-slow/): the cost of sending data to a worker.
- [Chrome, the Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api): when a hidden page is frozen or discarded, and when to save.

## Reaching a style

[The page](style.md).

- [Erich Schaefer, Postmortem: Blizzard's Diablo II (Game Developer, 2000)](https://www.gamedeveloper.com/design/postmortem-blizzard-s-i-diablo-ii-i-): 3D Studio Max renders, 8 and 16 directions, 75 px characters, paper dolls.
- [Shacknews, how Diablo 2 evolved](https://www.shacknews.com/article/105720/how-diablo-2-evolved-from-gothic-horror-to-epic-fantasy): one baked light direction, set pieces; "doesn't feel as dark and gothic".
- [OpenDiablo2, pl2](https://github.com/OpenDiablo2/pl2): Diablo II's palette files: 48 light levels, blend tables, 111 variations.
- [Phrozen Keep, Diablo II colormaps](https://d2mods.info/forum/viewtopic.php?f=6&t=4369): colormaps that "decline" one animation into several monster colors.
- [pd2-sprite-studio](https://github.com/RoofooEvazan/pd2-sprite-studio): DCC format tools (four colors per 4×4 cell, 160×80 floor tiles) and an MCP server of 31 tools.
- [Game Informer, Witchbrook's new look](https://gameinformer.com/news/2020/04/02/chucklefish-reveals-new-look-for-witchbrook): the move from top-down to isometric in April 2020.
- [Witchbrook dev blog, Express Yourself!](https://www.witchbrook.com/dev-blog-express-yourself/): 5 drawn rotations flipped to 8, 6-frame walks, 11 greyscale clothing layers.
- [Gamereactor, Witchbrook's inspirations](https://www.gamereactor.eu/witchbrook-is-being-developed-with-inspiration-from-studio-ghibli-and-google-street-view-1649453/): characters about 40 px tall; Studio Ghibli and Google Street View.
- [witchbrook.com](https://www.witchbrook.com/): the game's site; launch set for January 28, 2027.
- [Witchbrook dev blog](https://www.witchbrook.com/category/dev-blog/): concept draw-overs on greybox layouts.
- [David Holland, 3D pixel art rendering](https://davidholland.netlify.app/articles/3d-pixel-art-rendering): t3ssel8r-style rendering reconstructed: texel-snapped camera, 1 px outlines.
- [Gerstner et al. 2012, pixelated image abstraction](https://pixl.cs.princeton.edu/pubs/Gerstner_2012_PIA/index.php): downsample and palette solved together; naive downsampling loses detail.
- [Efros and Leung, texture synthesis by non-parametric sampling](https://people.eecs.berkeley.edu/~efros/research/EfrosLeung.html): example-based synthesis, WFC's ancestor.
- [Efros and Freeman, image quilting](https://people.eecs.berkeley.edu/~efros/research/quilting.html): texture from stitched patches of an example.
- [Saint11, how to start making pixel art 2](https://medium.com/pixel-grimoire/how-to-start-making-pixel-art-2-bcd705cb04d7): the ban on orphan pixels.
- [SD-πXL (arXiv 2410.06236)](https://arxiv.org/abs/2410.06236): diffusion distilled into a fixed n-color palette.
- [Astropulse, Retro Diffusion on itch.io](https://astropulse.itch.io/retrodiffusion): a pixel model said to be trained on licensed art.
- [Jones Day, the US Copyright Office on AI training](https://www.jonesday.com/en/insights/2025/05/us-copyright-office-issues-guidance-on-generative-ai-training): training not categorically fair use (May 2025).
- [Loeb & Loeb, Thaler v. Perlmutter](https://www.loeb.com/en/insights/publications/2025/03/thaler-v-perlmutter): a work made solely by AI can't be registered.
- [GamingOnLinux, Steam's rules for AI content](https://www.gamingonlinux.com/2024/01/valve-announces-new-rules-for-games-with-ai-content-on-steam/): disclosure of AI content players consume.

## The five games

[The page](games.md). Its sources are local: Tycho's own source and docs, linked from the page, and the five games' files, cited in [the survey](notes/local_games_and_tycho.md).
