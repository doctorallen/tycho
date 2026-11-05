# Plants

How trees, shrubs, flowers and cacti are generated as pixel sprites 8 to 96 pixels tall: which of the four classic algorithms fits, which traits make a species read at a glance, the small generators that cover desert and tropical forms, how meadows are mixed, and how pixel artists finish foliage. The answer is one brancher in the Weber–Penn manner at two or three levels, a crown envelope, and leaf clusters stamped at the tips rather than drawn as twigs, with L-systems kept for herbs, ferns and vines and a few special generators for palms, pads and cacti.

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md).

- [Four algorithms](#four-algorithms)
- [What makes a species read](#what-makes-a-species-read)
- [Desert, tropical and dead trees](#desert-tropical-and-dead-trees)
- [Flowers and meadows](#flowers-and-meadows)
- [Finishing foliage](#finishing-foliage)
- [Where it runs](#where-it-runs)
- [Sources](#sources)

## Four algorithms

Plant generation has four classic algorithms, and one of them fits pixel sprites best.

| Algorithm | How it works | Its limits |
|---|---|---|
| L-systems | Bracketed turtle grammars: F draws, + and − turn, `[` and `]` push and pop the turtle; stochastic and parametric variants let one grammar vary by seed ([Wikipedia: L-system](https://en.wikipedia.org/wiki/L-system)) | Fastest, but worst at following a target shape ([Nuić et al. 2019](https://www.zemris.fer.hr/~zeljkam/radovi/19_Mipro_Nuic.pdf)) |
| Space colonization | Grows a tree toward attraction points scattered inside a crown envelope; narrow envelopes give a clear central trunk as an emergent property | The authors "were not able to generate strongly pendulous, 'weeping' trees" ([Runions et al. 2007](http://algorithmicbotany.org/papers/colonization.egwnp2007.pdf)) |
| Particle flow | Particles fill the crown, fall under gravity and attract each other, and merge as they meet; their trajectories become branches, so growth runs from the leaves to the trunk ([Nuić et al. 2019](https://www.zemris.fer.hr/~zeljkam/radovi/19_Mipro_Nuic.pdf)) | Slowest, with "many parameters that need to be fine-tuned" ([Nuić et al. 2019](https://www.zemris.fer.hr/~zeljkam/radovi/19_Mipro_Nuic.pdf)) |
| Weber and Penn (1995), the basis of Blender's Sapling | Per recursion level: a child count, down angle, spiral rotate angle, length ratio, taper, curvature and split rate; eight ShapeRatio crown curves from conical (0.2 + 0.8r) to flame; **AttractionUp**, whose negative values droop ([Weber and Penn 1995](https://courses.cs.duke.edu/fall02/cps124/resources/p119-weber.pdf); [Blender manual](https://www.blender.org/manual/en/addons/add_curve/sapling.html)) | Sits between the others |

*The Algorithmic Beauty of Plants* gives six classic 2D plants with angles of 20° to 25.7°, Honda's monopodial tree, and tropism as a turn toward a gravity vector by e·|H × T| per segment ([ABOP](http://algorithmicbotany.org/papers/abop/abop.pdf)). Its width rule, **wr = 0.707**, is Leonardo da Vinci's observation that the branches above a fork together match the trunk below ([ABOP p.57](http://algorithmicbotany.org/papers/abop/abop.pdf)). Weber and Penn's weeping willow uses AttractionUp −3, and their quaking aspen a tend-flame crown on a trunk bare for 40% of its height ([Weber and Penn 1995](https://courses.cs.duke.edu/fall02/cps124/resources/p119-weber.pdf)). Phyllotaxis covers rosettes and flower heads: Vogel's φ = n·137.5°, r = c√n, a pattern that visibly breaks at 137.3° or 137.6° ([ABOP ch. 4](http://algorithmicbotany.org/papers/abop/abop.pdf)).

For 8 to 96 pixel sprites, the best core is a Weber–Penn-style brancher at two or three levels, with the last level drawn as leaf-cluster stamps rather than twigs, colonization kept as an option for crowns that must fill a silhouette, and L-systems kept for herbs, ferns and vines *(inference)*.

## What makes a species read

Species read at a glance through a handful of traits, and botany already names the structural ones. Hallé and Oldeman's 23 architectural models sort trees by branched or unbranched, monopodial or sympodial, upright or horizontal axes, and rhythmic or continuous growth ([LibreTexts key](https://bio.libretexts.org/Bookshelves/Evolutionary_Developmental_Biology/Key_to_the_Diversity_and_History_of_Life_(Shipunov)/04:_Geography_of_Life/4.02:_Architectural_Models_of_Tropical_Trees-_Illustrated_Key)). About ten of them matter for game trees *(inference from the key)*:

| Model | For |
|---|---|
| Corner | The single-stem palm |
| Tomlinson | Clumping palms and bananas |
| Leeuwenberg | Forms that fork after each flowering |
| McClure | Bamboo groves |
| Massart, Aubréville | Tiered pagoda shapes |
| Rauh | The default temperate tree |
| Troll, Champagnat | Spreading and arching forms |

On top of architecture, six visible traits separate species: crown envelope, bare-trunk fraction, branch posture, tier rhythm, bark ink and mark, and a seasonal cue.

| Species | Its signature |
|---|---|
| Eastern white pine | Whorls of **5 to 6 branches "like wagon-wheel spokes"** in well-separated tiers ([Virginia Tech dendrology](https://dendro.cnre.vt.edu/dendrology/syllabus/factsheet.cfm?ID=111)) |
| Italian cypress | An "exclamation mark" under a tenth as wide as it is tall ([Wikipedia](https://en.wikipedia.org/wiki/Cupressus_sempervirens)) |
| Fir | Cones stand upright "like candles" ([Wikipedia: Fir](https://en.wikipedia.org/wiki/Fir)) |
| Larch | A conifer whose needles turn gold and drop ([Wikipedia](https://en.wikipedia.org/wiki/Larix_decidua)) |
| Birch | White bark with black fissures ([Wikipedia: Betula pendula](https://en.wikipedia.org/wiki/Betula_pendula)) |
| Aspen | Bark with black horizontal scars; its clones turn gold at different times ([Wikipedia: Populus tremuloides](https://en.wikipedia.org/wiki/Populus_tremuloides)) |
| Beech | Keeps dead leaves through winter ([NC State: Fagus](https://plants.ces.ncsu.edu/plants/fagus-grandifolia/)) |
| Baobab | Leafless for about eight months ([Wikipedia: Adansonia](https://en.wikipedia.org/wiki/Adansonia_digitata)) |
| Jacaranda | Blooms purple-blue on bare wood ([NC State: Jacaranda](https://plants.ces.ncsu.edu/plants/jacaranda-mimosifolia/)) |

At 16 pixels only envelope, bare trunk and posture survive. Tiers, bark marks and seasons start to show from about 48 pixels *(inference)*.

<figure class="demo"><div class="stage" data-demo="plants"></div>
<figcaption><b>Sixty plant species.</b> Twenty-one trees, seventeen shrubs and ground plants, fifteen flowers and seven succulents, each a small generator:
<ul>
<li>broadleaf skeletons with per-species angle and droop, grown four times with the best kept;</li>
<li>conifers as stacked, ragged skirts;</li>
<li>palms and tree ferns as fronds bent by gravity;</li>
<li>cacti as ribbed bodies;</li>
<li>sunflowers on Vogel's golden-angle spiral.</li>
</ul>
Every species follows the same finishing rules from the pixel tutorials: clumps lit from one side, bark textures that run along each limb, no orphan pixels, and a selective outline. Seasons recolor, strip, blossom or snow each plant. The swatch by each name is the color the zoom demo (in Zoom and chunks) uses far away. Tap a plant for its seed variants and its year, or open Scene for a biome.</figcaption></figure>

## Desert, tropical and dead trees

Many desert and tropical forms need no recursive brancher at all.

| Plant | Its growth |
|---|---|
| Saguaro | First arms at about **60 to 75 years**; can carry dozens (the record is 78) ([NPS](https://www.nps.gov/sagu/learn/nature/saguaro.htm); [Wikipedia](https://en.wikipedia.org/wiki/Saguaro)) |
| Prickly pear | Pads stacked end to end ([Wikipedia: Opuntia](https://en.wikipedia.org/wiki/Opuntia)) |
| Barrel cactus | Leans south ([Wikipedia: Ferocactus wislizeni](https://en.wikipedia.org/wiki/Ferocactus_wislizeni)) |
| Agave | Flowers once after 10 to 30 years, on a stalk up to about 8 m, then dies ([Wikipedia](https://en.wikipedia.org/wiki/Agave_americana)) |
| Joshua tree | Unbranched until its first bloom ([Wikipedia](https://en.wikipedia.org/wiki/Yucca_brevifolia)) |

Three small generators cover these: a trunk path with a frond rosette at its tip, a segment chain for pads, cholla joints and bamboo culms, and a ribbed column with elbowed arms, with rosettes placed by the 137.5° rule *(inference)*.

Dead trees follow a documented decay sequence: needles red, then a bare skeleton with fine branches intact, then lost twigs and cracking bark, then a hard snag with little bark, with broken tops uncommon until late ([USDA Forest Service](https://www.fs.usda.gov/media/218293)). That sequence becomes a decay level from 0 to 5 applied to any live tree *(inference)*.

## Flowers and meadows

Ground cover and flowers lean on stamps. Flowers read at 3 to 12 pixels by petal count and posture:

| Flower | Reads by |
|---|---|
| Corn poppy | Four petals with a black spot ([Wikipedia: Papaver rhoeas](https://en.wikipedia.org/wiki/Papaver_rhoeas)) |
| Wild rose | Five petals ([Wikipedia: Rose](https://en.wikipedia.org/wiki/Rose)) |
| Tulip | Six tepals ([Wikipedia: Tulip](https://en.wikipedia.org/wiki/Tulip)) |
| Cosmos | Eight rays ([Wikipedia: Cosmos bipinnatus](https://en.wikipedia.org/wiki/Cosmos_bipinnatus)) |
| Bluebell | A one-sided nodding raceme ([Wikipedia: Hyacinthoides](https://en.wikipedia.org/wiki/Hyacinthoides_non-scripta)) |

Botany even supplies palette constraints. Tulips have no pure blue, roses lack the enzyme for blue pigment, irises have no true red, and blue-flowered species are reported at under 10% of flowering plants ([Wikipedia: Blue flower colouration](https://en.wikipedia.org/wiki/Blue_flower_colouration); [Wikipedia: Iris](https://en.wikipedia.org/wiki/Iris_(plant)); [Gulf News](https://gulfnews.com/world/americas/scientists-give-a-chrysanthemum-the-blues-1.2065787)).

A meadow is a weighted species list. One cornfield seed mix runs corncockle 40%, poppy 25%, cornflower 20%, corn chamomile 12.5% and corn marigold 2.5% by weight ([Germinal WF10](https://www.externalworksindex.co.uk/entry/37591/Germinal-Amenity/WF10-Cornfield-Annuals-wildflower-seed-mixture/)), and a generator can scatter each species by Poisson disk and clump it into drifts by low-frequency noise *(inference)*. Scatter itself is on [worlds and levels](worlds.md).

## Finishing foliage

Pixel artists agree on how foliage should be finished, and their rules translate into passes.

- Saint11 works in the order "Shape, Light, Detail", wants a silhouette "recognizable as a tree, even without the colors", labels pillow shading "Avoid", and asks for "detailed borders, clear internal areas" without orphan pixels ([Saint11 Vegetation Part 1](https://saint11.art/img/pixel-tutorials/Vegetation.gif)).
- Slynyrd builds one foliage bundle, makes darker and lighter copies by shifting one step along a shared ramp, stacks them by an implied light, and finds "4 or 5 colors per bundle is plenty" ([Slynyrd Pixelblog 44](https://slynyrd.com/blog/2023/5/22/pixelblog-44-top-down-trees)).
- Red Blob Games draws all leaf clusters after all branches ([simblob](https://simblob.blogspot.com/2022/06/procedural-tree-generator.html)).
- Desarrh's Godot generator stamps "solid w*w rendering per segment (no staircase artifacts)" ([Desarrh](https://github.com/Desarrh/Procedural-Tree-Godot)).
- t3ssel8r judged his scattered-leaf trees "still a bit too messy compared to artist results" ([Games in Progress](https://www.gamesinprogress.com/indie-game-developers/t3ssel8r/procedural-pixel-art-trees)).
- Nick McDonald seeds each branch's leaves from a hash of its ID, so foliage stays put as the tree grows ([nickmcd.me](https://nickmcd.me/2020/10/19/transport-oriented-growth-and-procedural-trees/)).

Together these give a recipe *(inference)*:

1. Run the skeleton.
2. Place clump discs at the tips.
3. Shade each disc by a light vector into three or four bands.
4. Paint back to front.
5. Stamp a small fixed set of leaf clusters by Poisson disk.
6. Remove orphans and add a selective outline.

At 8 to 16 pixels a jittered silhouette template per family beats any skeleton *(inference)*. Seasons are then palette slots, since autumn yellow comes from carotenoids in birch and aspen and red from anthocyanins in maples and oaks ([Wikipedia: Autumn leaf color](https://en.wikipedia.org/wiki/Autumn_leaf_color)). Sway is a per-row offset floored to whole pixels that grows with height ([godotshaders: 2D wind sway](https://godotshaders.com/shader/2d-wind-sway/); [dev.to](https://dev.to/sarasol/animating-pixel-art-fabric-with-unity-shader-6f1)); [motion](motion.md) has how it's drawn. The demo above is a flora library built this way. Locally, Merryfolk's recursive `makeBareTree` and blob-lit `paintCrown` are the only existing plant generators in the five games (`js/sprites.js`).

## Where it runs

| Technique family | Where it runs | How |
|---|---|---|
| Flora (brancher, clump stamps, rosettes, pads, decay levels, season slots) | Pre-bake | Build once per seed and species; seasons as reprints; sway as row strips |

## Sources

- [Prusinkiewicz and Lindenmayer, The Algorithmic Beauty of Plants](http://algorithmicbotany.org/papers/abop/abop.pdf)
- [Runions, Lane and Prusinkiewicz 2007, space colonization](http://algorithmicbotany.org/papers/colonization.egwnp2007.pdf)
- [Weber and Penn 1995, creation and rendering of realistic trees](https://courses.cs.duke.edu/fall02/cps124/resources/p119-weber.pdf)
- [Nuić et al. 2019, a comparison of tree algorithms](https://www.zemris.fer.hr/~zeljkam/radovi/19_Mipro_Nuic.pdf)
- [Hallé and Oldeman's architectural models, an illustrated key](https://bio.libretexts.org/Bookshelves/Evolutionary_Developmental_Biology/Key_to_the_Diversity_and_History_of_Life_(Shipunov)/04:_Geography_of_Life/4.02:_Architectural_Models_of_Tropical_Trees-_Illustrated_Key)
- [USDA Forest Service, the decay of dead trees](https://www.fs.usda.gov/media/218293)
- [Saint11, Vegetation Part 1](https://saint11.art/img/pixel-tutorials/Vegetation.gif)
- [Slynyrd, Pixelblog 44: top-down trees](https://slynyrd.com/blog/2023/5/22/pixelblog-44-top-down-trees)
- [Red Blob Games, a procedural tree generator](https://simblob.blogspot.com/2022/06/procedural-tree-generator.html)
- [Nick McDonald, transport-oriented growth and procedural trees](https://nickmcd.me/2020/10/19/transport-oriented-growth-and-procedural-trees/)

The full research is in [the notes on plants, trees and flowers](notes/plants_trees_flowers.md).

<script src="demos/kit.js"></script>
<script src="demos/flora.js"></script>
<script src="demos/start.js"></script>
