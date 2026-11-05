# Settlements, paths and trees

Where people settle, walk and leave the trees, read from the land the way real people did. A village goes where a score of its needs is highest: water, flat ground, shelter from the wind, a sunny slope, a road (Emilien 2012, the one fully documented model). Paths cost every step by slope with Tobler's hiking function and Galin's road costs, and trails grow where feet keep walking (Helbing's active walkers). Trees and plants go where their habitat suits them, the weakest factor deciding (Cordonnier, Gain), spaced by Poisson disks, the way Merryfolk already places oaks on loam and willows by water. Last, how all of it is drawn with height in 3/4 view. The land these sit on, its plates, rivers and climate, is [Real geography](geography.md), and its live world shows both.

**Proposed: none of this is in Tycho yet.** The demos run in the pages, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; what would move into Tycho, and when, is in [the roadmap](roadmap.md).

Text marked *(inference)* is reasoning from the sources, not a sourced fact.

<figure class="demo"><div class="stage" data-demo="geo-world"></div>
<figcaption><b>Villages, roads and trees on a made world.</b> The world from <a href="geography.html">Real geography</a>. Villages stand at the best-scoring sites (Emilien's veto-and-weights rule: water, flat arable ground, shelter from the prevailing wind, a sunny slope, out of the floodplain); roads join them by Tobler's walking cost over 16 directions (Galin), and later paths reuse worn ones (Helbing). Turn on <i>Show scores</i> to see the site score, then tap a village to walk into it. Its form comes from its site: a street village with crofts behind each house along a valley road, a forest strip village, a round green, an Anger on the road, a hill village packed on its hilltop, or a fishing hamlet strung along the shore with its boats. Plants are chosen by the weakest habitat factor (Liebig's law) and spaced as Merryfolk spaces them, and biomes blend into each other at their edges.</figcaption></figure>

The demo's limits, plainly:
- **Villages:** one per region, all its houses alike; forms are chosen by rules read off the site, not grown by Emilien's house-by-house loop; no church, mill or market.
- **Fields:** a croft strip stops where the ground changes terrace, so on broken ground strips are short.
- **Biome edges:** blended per pixel only between tiles on the same terrace; a seam that meets a cliff stays a tile step.
- **Timing:** a region takes 0.09 to 0.33 s on a desktop, 0.2 s typically (up to 0.42 s for the first, which also paints the plant sprites).
- (Fixed: villages used to form only round a green; biome edges ran straight along world cells, and forests carried too many bushes. Sources in [caves_villages_edges.md](notes/caves_villages_edges.md).)

- [Settlements](#settlements)
- [Village forms](#village-forms)
- [Paths](#paths)
- [Vegetation](#vegetation)
- [Biome edges](#biome-edges)
- [Drawing height in 3/4 view](#drawing-height-in-34-view)
- [Sources](#sources)

## Settlements

### What real people weighed

Historical siting comes down to a few local **site** factors (a reliable water source, flood-free dry ground, a sun-facing and sheltered aspect, gentle arable slope, defensibility) plus **situation** factors (fords, bridging points, junctions). Emilien et al. state the premise for generators: "most human settlements did not result from some pre-defined land-use plan, but from people progressively settling in safe, well served, sunny or convenient location for farming or fishing. Meanwhile, the road networks progressively grew and in turn attracted new settlers", citing Barry (ed.), *A Story of Settlement in Ireland* (1999) ([Emilien et al. 2012](https://perso.liris.cnrs.fr/egalin/Articles/2012-villages.pdf)).

- **The spring line.** Spring-line settlements form where "a ridge of permeable rock lies over impermeable rock", so springs emerge along the contact. Building higher risked water shortage; building lower moved the village away from grazing or onto the floodplain. Such villages form a chain along the foot of an escarpment and anchor strip parishes, "long, narrow parish boundaries stretching up to the top of the ridge and down to the river". Examples are the South Downs (Edburton, Fulking, Poynings), the Mendips (Wells, Wookey Hole, Draycott) and the Lincoln Edge (Navenby, Metheringham). The article rests on one source, and several examples are marked "citation needed" ([Wikipedia, Spring line settlement](https://en.wikipedia.org/wiki/Spring_line_settlement)).
- **Wet point and dry point.** Wet-point sites are chosen for water; dry-point sites are firm, flood-free ground in wetland, marsh or floodplain (Glastonbury is the usual example). Defense, nodal points (route junctions) and bridging points are the other standard factors. These are school-level texts, via search summary ([Rashid Faridi](https://rashidfaridi.com/2019/08/06/site-of-a-settlement); [Save My Exams](https://www.savemyexams.com/igcse/geography/cie/20/flashcards/1-population-and-settlement/1-5-settlements-and-service-provision/)).
- **Aspect and shelter** are "two of the most important factors", with the spring-line villages under the Downs' chalk escarpment as the example of shelter (via search summary) ([British Landscape](https://britishlandscape.org/reading-the-landscape/files/archive-apr-2013.htm)).
- **Adret and ubac.** The adret is the sun-facing slope, south-facing in the Northern Hemisphere, a term used mostly of the Alps; on the ubac, the shaded slope, the timber line and snow line sit lower ([AMS, adret](https://glossary.ametsoc.org/wiki/adret/); [AMS, ubac](https://glossary.ametsoc.org/wiki/ubac/)). A French teaching source sums up the land use: adret "warm and dry => clearing, village, livestock, crops"; ubac "cold and damp (snow earlier and later) => forest, then winter sports resorts" (via search summary). The Écrins national park material says villagers settled the sunniest zones in winter ([cahier-de-prepa.fr](https://cahier-de-prepa.fr/hkal-thiers/download?id=1628); [Parc national des Écrins](https://www.ecrins-parcnational.fr/sites/ecrins-parcnational.com/files/fiche_doc/17153/correctionslivretenfant05-09-07.pdf)).

The best single heuristics for a generator are the spring line (settle at the foot of a slope where water emerges, above the floodplain) and the adret (settle and farm the sun-facing slope, leave the shaded one wooded). No primary historical-geography text was fetched in full, and no quantitative data ("villages are typically within N meters of water") was found.

A site score for one cell, built from these factors, with weights as a starting point to tune *(inference)*:

| Factor | Value |
|---|---|
| `water` | 1 at 1 to 3 cells from a spring, stream or lake, falling to 0 by about 8 cells. Springs go at the foot of slopes where height drops sharply and flow accumulation is moderate, a spring-line proxy |
| `dry` | 0 in the floodplain (within about 1 to 2 height steps of the river and below a flood level), else 1: the terrace above the river |
| `sun` | 0.5 + 0.5·(the slope's facing toward the sun, −1 to 1), scaled by steepness; with screen-up as north, slopes falling toward the bottom of the screen |
| `shelter` | The fraction of the upwind half-circle within about 6 cells that is higher than the cell |
| `flat` | A bell on slope peaking at 0 to 5% and 0 above about 25% |
| `arable` | The mean of `flat` and soil quality within about 5 cells |
| `defense` | Emilien's geographical domination (below), for castles, churches and hill forts only |
| `wood`, `stone` | Distance to the forest edge and to rock, as a soft bonus |
| `route` | A bonus at fords, confluences and junctions of least-cost paths |

The score is Σ wᵢ·fᵢ, with any hard veto (a water cell, a slope over the limit) forcing 0, exactly Emilien's rule. "Site against situation" becomes two passes: score sites from local terrain first, then add a situation term once the path graph exists. A minimum spacing between villages, as a Poisson-disk radius, gives the look of Christaller-style spacing at no cost *(inference)*.

### How generators score sites

Emilien et al.'s "Procedural Generation of Villages on Arbitrary Terrains" (*The Visual Computer* 28, 2012) is the one fully documented scoring model, and it fits a phone. It runs in three steps: settlement seeds and roads grow together from interest maps, parcels are conquered anisotropically, and an "open shape grammar" builds houses on slopes ([PDF](https://perso.liris.cnrs.fr/egalin/Articles/2012-villages.pdf); [HAL](https://hal.archives-ouvertes.fr/hal-00694525)).

- **Inputs:** elevation h(p), water height w(p), vegetation density v(p); connection points Ψ on the region's edge, where roads leave the map; a village type V (highland, defensive, fisherman); a "building encyclopedia" of parameters for each pair of V and building type B; and a growth scenario, a timeline of events that change V (a war period followed by a farming period) or seed n buildings of type B.
- **Seeding:** pick a random position p and check it can be built on (not in a lake). If so, compute the interest I(B) and run an "aggregation test", a random accept whose chance depends on I(B); on failure, pick a new p. It's adapted from the authors' lichen-growth "Open Diffusion Limited Aggregation" model.
- **Interest:** n criteria fᵢ(B) ∈ [−1, 1], where −1 means impossible, with weights wᵢ per (V, B). **I(B) = 0 if any fᵢ = −1; otherwise I(B) = max(0, Σ wᵢ·fᵢ(B)).**

| Criterion | Function | Updated |
|---|---|---|
| Sociability | A sum of attraction-repulsion functions of distance to other buildings, with λmin, λ0 (the preferred distance) and λmax per pair of building types, so terraced houses cluster tighter than farms | Dynamically |
| Worship | The same, toward religious buildings only | Dynamically |
| Accessibility | A non-symmetric bell on distance to the nearest road, preferred distance λ0, building prohibited outside [λmin, λmax] | Dynamically |
| Slope | A bell around a preferred slope with a prohibited range: "corn farms to flat areas and vineyards to hills" | Precomputed |
| Water | A decreasing "close distance" function of distance to water between λmin and λmax | Precomputed |
| Fortification | An "open distance" function, 1 inside walls and decreasing outside | Precomputed |
| Geographical domination | f(x) = Σ over samples p with ‖x − p‖ < r of (h(x) − h(p)) / (1 + ‖x − p‖²) | Precomputed |

Mountain hamlets were driven mainly by geographical domination, a cliff-top fortified village by domination plus fortification, and a fisherman village by distance to the sea. It was written in C++: on a 4096×4096 grid the skeleton took 4 to 7 minutes, parcels 7 to 13 minutes and geometry 20 to 30 seconds. Its main limitation is "the number of user-set parameters, currently 150 per village type".

On a phone the loop is cheap if the grid is the game's tile grid (64×64 = 4096 cells) rather than 4096²: a candidate costs a handful of map lookups and a neighbor sum. Static maps (slope, water distance, domination) are precomputed once by BFS or a box filter; dynamic ones are updated incrementally, with a BFS from new road cells only and each house's attraction kernel added into a sociability grid. Expect well under 50 ms for 30 to 80 houses. The 150 parameters are the real cost, so ship 3 or 4 village types with about 6 active criteria each (slope, water, road access, sociability, sun, domination) in a small table per quest. Draw the aggregation test from `ctx.rng('village')`, cap attempts at about 200 per house and fall back to the best candidate seen, so generation always ends. Domination with r of about 6 to 10 cells works as a hilltop detector for churches, castles and lookouts *(inference)*.

Other generators document much less:

| Generator | Siting |
|---|---|
| Watabou's Village Generator | "The generator finds a place on a map with high population density - often it's a place on the highway. Then it creates a circle of a reasonable size at that location and distorts it a little. This circle becomes the shape of a village square." If the square doesn't overlap water, a centerpiece (a large tree or a well) is added ([devlog 1.4.0](https://watabou.itch.io/village-generator/devlog/507254/140-village-square-and-orchards)). Version 1.6.4 added a "crossroads" tag for a village "at a highway intersection (a crossroads or a T-junction)" ([devlog 1.6.4](https://watabou.itch.io/village-generator/devlog/840277/164-crossroads-and-numbered-houses)); the details are on Patreon and weren't accessible |
| O'Leary | 15 cities by default, placed greedily by score = √flux (near rivers) plus edge penalties minus 0.02/distance to each existing city; 5 territories grown by a priority-queue flood whose cost includes 100·√flux (rivers as borders) and slope ([mewo2/terrain](https://github.com/mewo2/terrain/blob/master/terrain.js)) |
| Azgaar | Cultures pick terrain: nomadic in deserts and grassland below height 70, highland above 50, lake cultures by lakes over 5 cells ([Knowledge Base](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Knowledge-Base)) |
| Dwarf Fortress | Civilizations and caves are placed at the start of history, and civilizations need biomes: dwarves need mountains, elves won't spawn if the maximum temperature is 9, humans need at least 0, so the rejection checks partly guarantee placement is possible ([DF wiki](https://dwarffortresswiki.org/index.php/DF2014:World_generation)). Savagery of 66+ blocks civilization placement; the number of new sites is capped by a world parameter shared across civilizations; dwarven hamlets "are equally likely to be found in any land biome"; worlds that fail placement are rejected and logged (via search summary) ([World rejection](https://dwarffortresswiki.org/index.php/World_rejection); [DF2014:Site](https://dwarffortresswiki.org/index.php/DF2014:Site); [v0.31 Civilisation](https://dwarffortresswiki.org/index.php/v0.31:Civilisation)). How sites inside a civilization are spaced isn't documented; it emerges from the history simulation |
| Ostriv | Only player discussion of long, narrow house plots with road or waterfront access, and a 2023 note that Alpha 5 added two- and three-story Ukrainian Baroque houses and paved roads ([Mezha](https://mezha.media/en/2023/03/20/the-ukrainian-urban-planning-strategy-ostriv-has-received-an-alpha-5-update)) |

No primary documentation was found for site scoring in Banished, Foundation, Songs of Syx or Ostriv; those games let the player place buildings.

**Merryfolk already plans a valley this way**, from its seed alone ([Merryfolk layout.js](https://github.com/doctorallen/merryfolk/blob/main/js/layout.js); [README](https://github.com/doctorallen/merryfolk/blob/main/README.md)). `planValley` draws the river first, a tilted base line with two meanders and a wilder third. Then, on a grid of claims so nothing lands on anything else, it fits each place to the best of a set of candidate rectangles, scored by hand-set terms:

| Place | Where, and the score |
|---|---|
| The square | Gentle ground on the north bank, 12 to 22 tiles up from the water, near the middle of the map |
| The store, bakehouse, inn, brewhouse | Close round the square; the whole village mirrored left to right half the time |
| The mills | Where the river runs straight enough for a wheel, about 24 tiles from the square, at least 18 apart |
| The fields | The flattest open land within walking distance, in a ring 18 to 46 tiles out |
| The barn | Two thirds of the way from the square to the fields |
| The pond | A hollow (low height scores best) 10 to 34 tiles from the river |
| The windmill | The highest ground on the north side |
| The old orchard | A sunny slope: higher ground behind it than in front |
| The knolls (homes) | South-facing slopes: the score adds −4 × (height behind − height in front) and twice the roughness |

Roughness is the spread of heights in the rectangle plus 0.06 for each terrace bank it crosses. Every number comes from `mulberry32(seed * 31 + 0x5eed)`, and the plan is saved with the village, so a later change to the planner can't move anyone's home. The player picks the seed and how the land is made (gentle, rolling or hilly ground; a lazy, winding or meandering river; sparse, fair or thick woodland; dry, fair or damp ground; no cliffs, some or many; smooth, broken or rugged relief, among others), then watches it made on a map, stage by stage: the river finds its way down the valley, knolls rise, lanes wind along the contours, fields are plowed, rain runs off the hills and the soil settles, then come hedges, woods, willows, long grass, stones and wildflowers. It's the site-score idea with weights set per building, reading only the height field *(inference)*.

### How a village grows

Real and generated villages share three regularities: houses join the road network as they appear and roads attract houses; parcels have one side on the road and two sides roughly perpendicular to it; and buildings face the nearest road. Emilien et al. encode all three ([PDF §4.3, §5, §7](https://perso.liris.cnrs.fr/egalin/Articles/2012-villages.pdf)):

- **Roads and houses together.** "A new road attracts settlers while a new house often leads to some extension of the road network." Each new building is joined to the network at once by a least-cost road, and the accessibility map is updated.
- **Road reuse.** A new road costs C(R) = Σ wⱼ·gⱼ(R) (slope, curvature, water, and a high constant for crossing a building). Segments on an existing road cost **w_ex·C(R) with w_ex ≪ 1**, so new houses branch off existing roads instead of making "a fully ramified road network".
- **Cycles.** After the first road to a new building, the method looks for the closest road node in a cone of angle θ ahead along the road and builds a second road there, if it isn't too close to the first, making loops and shortcuts.
- **Parcels.** "Most parcels have one side neighboring a road and two sides perpendicular to it." Conquest runs in four steps: spread along the road both ways from the building's projection until meeting a neighbor or a maximum distance; the parcel that first reaches a junction annexes the corner, and seeds that lose road access are deleted; anisotropic grid conquest, where each road cell has a budget c_max and a cell costs Σ ωᵢ·cᵢ(cell, n) with n the road normal; then simplification, dropping vertices whose turn angle is below ε and removing acute T-vertex angles.
- **Conquest costs.** Distance is Euclidean for fields; for houses it's the "infinite" distance d = |max(p·n, p·t)|, which gives near-quadrilateral lots. Water, walls and roads cost +∞. Slope cost is "a quadratic function of the directional gradient", so parcels spread along contours rather than downhill.
- **Validation.** Generated parcels averaged 2.873 neighbors and 4.29 contour edges, against 2.812 and 4.068 in the real village.
- **Footprints.** A quad starts "at the closest position to the road, and oriented according to the closest normal to the road", then grows to the building type's maximum size or the parcel contour. Segments close to the contour snap to it, which makes terraced rows when neighbors do the same.

Players of Watabou's generator split between "villages sit on both sides of a trade road with perpendicular side roads" and "small villages should not have roads running through them" (via search summary) ([comments](https://watabou.itch.io/village-generator/comments?after=162)). Its "crossroads" tag puts the village at a highway intersection or T-junction ([devlog](https://watabou.itch.io/village-generator/devlog/840277/164-crossroads-and-numbered-houses)).

## Village forms

Settlement geography sorts villages first into **nucleated** and **dispersed**, then by plan. Roberts classes English plans as **rows** or **agglomerations**, regular or irregular, with or without a **green** (via search summary). In Durham and northern England up to 80% of settlements show signs of planning, many in a "regular two-row format" with rows facing across a street or green; excavated Newsham had at least 11 tofts, West Hartburn about 12 ([Hull, Beresford's Lost Villages](https://dmv.wordpress.hull.ac.uk/?p=278)). Behind each toft, the plot the house stood on, ran its croft, "strips of land behind the tofts" ([Wikipedia, Toft](https://en.wikipedia.org/wiki/Toft_village)). Round a nucleated village lay two or three great open fields, "usually several hundred acres each", in furlongs of strips about 200 m long and 4.6 to 20 m wide ([Wikipedia, Open-field system](https://en.wikipedia.org/wiki/Open-field_system); [Ridge and furrow](https://en.wikipedia.org/wiki/Ridge_and_furrow)). Roberts and Wrathmell's Central Province, the "champion" country of open fields and nucleated villages, has wooded, dispersed provinces either side, and the split was forming before the 9th century ([Hull](https://dmv.wordpress.hull.ac.uk/?p=102)).

German settlement geography names the forms most finely:

| Form | Shape | What made it |
|---|---|---|
| Haufendorf | Clustered, irregular | Grown without a plan, often with open fields; many classic forms are later reshapings ([de.wikipedia](https://de.wikipedia.org/wiki/Haufendorf)) |
| Straßendorf | Farmsteads directly on one road at roughly regular intervals | Planned or grown, often at road junctions ([de.wikipedia](https://de.wikipedia.org/wiki/Straßendorf)) |
| Zeilendorf | One row along a path or stream | Shaped by the terrain; along rivers one-sided, on the terrace edge above the flood ([de.wikipedia](https://de.wikipedia.org/wiki/Zeilendorf)) |
| Angerdorf | Farmsteads facing a lens- or eye-shaped common green, often with a pond | The medieval eastward colonization ([de.wikipedia](https://de.wikipedia.org/wiki/Angerdorf)) |
| Rundling | Wedge-shaped farms round a round green with one entrance, originally 3 to 10 farms | Lords regrouping Slavic settlers, from about 1150 ([de.wikipedia](https://de.wikipedia.org/wiki/Rundling)) |
| Waldhufendorf | Farms along a valley road "like beads on a chain", each with a strip running up to the ridge, forest left at its end | Upland clearance; chains up to 25 km in Saxon valleys ([de.wikipedia](https://de.wikipedia.org/wiki/Waldhufendorf)) |

A Frankish Hufe was 24.2 ha in a strip up to almost 2.5 km long, with farmsteads 50 to 100 m apart ([de.wikipedia, Hufe](https://de.wikipedia.org/wiki/Hufe)). Regular plans occur only with deliberate planning; a Weiler has 10 to 20 house sites ([de.wikipedia, Dorf](https://de.wikipedia.org/wiki/Haufendorf)). The French village-rue has its buildings "on both sides of a single street", on plots "as wide as the house" ([fr.wikipedia](https://fr.wikipedia.org/wiki/Village-rue)). Perched villages crown a relief, mostly fortified ([fr.wikipedia](https://fr.wikipedia.org/wiki/Village_perché)), as Italy's hill towns did after the 10th century's incastellamento ([Wikipedia](https://en.wikipedia.org/wiki/Incastellamento)). Fishing villages sit round a small harbor or work from a beach, needing "a safe way of landing fish and securing boats" ([Wikipedia](https://en.wikipedia.org/wiki/Fishing_village)). English greens may have begun as pens for livestock "from wild animals or human raiders during the night" ([Wikipedia](https://en.wikipedia.org/wiki/Village_green)). In generators, Emilien's village types (high-land, defensive, fisherman) reweight the same interest functions ([PDF](https://perso.liris.cnrs.fr/egalin/Articles/2012-villages.pdf)), and Manor Lords lets the player draw burgage plots that snap to the road with room at the back (via search summary) ([wiki](https://wiki.hoodedhorse.com/Manor_Lords/Burgage_plots)).

What decides the form, then: planning or growth, the road, the terrain (a valley floor allows one street; a hilltop forces a cluster), water, defense, and land tenure. The demo turns that into rules read off the site *(inference)*. The world's roads are laid first, since villages grew along them; the village's center is scored as before plus nearness to a road (and the shore, when its world cell is on a coast), and then:

| Site | Form | Layout |
|---|---|---|
| A sea or lake within 7 tiles | Fishing hamlet | One row along the shore (ordered along the shore's main axis), facing the water, a boat drawn up before each house, gardens behind |
| A hilltop (60% of a ring 5 to 7 tiles out lies lower) or rough ground (under 45% within a terrace of the center) | Hill village (Haufendorf) | 10 to 14 houses packed irregularly round a small square on the leveled top, open-field furlongs below |
| A road within 4 tiles, woods round (over 30%) | Forest strip village (Waldhufendorf) | A farm each side of the road every 4 tiles, each with one strip 13 tiles long running back into the woods |
| A road along a valley (more ground at the center's level along the road than across it) | Street village (Straßendorf) | The ground beside the road leveled to it; a house each side every 2.6 tiles, facing the road, a croft strip behind each, stopping where the ground changes terrace |
| A road through open flats | Anger village | A lens of green 10 tiles long along the road, a row of houses each side facing it, furlongs around |
| No road, open flats | Green village | Houses round a round green with a well, furlongs around |

The world's siting kept three of its sixteen places for the best shore sites, since a fishing village lives by the sea rather than the soil and would otherwise never win on arable land. Furlongs are drawn as strips, each tile row or column its own crop. In two seeds (4242 and 777) the 32 villages came out as 9 forest strip villages, 9 hill villages, 5 street villages, 4 green villages, 3 fishing hamlets and 2 Anger villages *(measured)*.

## Paths

Three families cover every path *(inference)*: least-cost A* over a cost grid with slope cost, using larger neighbor masks to escape 45° artifacts; reinforcement models where use lowers future cost and disuse decays it, which makes desire paths and trunk trails; and network building, which joins settlements by least-cost paths, prunes with a proximity rule, merges parallel roads and makes existing roads cheap.

### What a step costs

**Tobler's hiking function**: W = 6·e^(−3.5·|S + 0.05|) km/h, with S = dh/dx = tan θ. That gives about 5.04 km/h on flat ground and a maximum of about 6 km/h at S = −0.05, about −2.86°, slightly downhill. As a pace, p = 0.6·e^(3.5·|S + 0.05|) s/m, about 0.71 s/m on the flat. Off-path travel multiplies the speed by 3/5, and horseback by 5/4. It was fitted to Eduard Imhof's data (Tobler 1993) ([Wikipedia](https://en.wikipedia.org/wiki/Tobler%27s_hiking_function)). The R package movecost runs least-cost paths with Tobler and other cost functions cell by cell, and a USDA Forest Service study found that one function misses travel-rate variability (via search summary) ([movecost](https://cran.nics.utk.edu/cran/web/packages/movecost/vignettes/movecost.Rmd); [par.nsf.gov](https://par.nsf.gov/servlets/purl/10420114)).

Trail builders cap the grade. The US Forest Service, citing IMBA's *Trail Solutions* (2004), gives the "half rule" (a trail's grade at most half the grade of the sideslope it crosses) and the "ten percent average guideline" (the average grade over an uphill section at or below about 10%). Switchbacks put their short apex in the fall line and need a grade reversal to shed water ([USFS, trail design](https://www.fs.usda.gov/t-d/pubs/htmlpubs/htm07232806/page04.htm)). Short pitches of about 15% (15 to 20% in some sources) appear only in search summaries of secondary standards ([Shuswap Trail Alliance](https://shuswaptrails.com/userfiles/file/sta_trail_design_standards%20sml.pdf)).

As step costs *(inference)*:

- **Walkers:** cost = step length × pace(S) / pace(0), with S = Δh / step length signed in the direction of travel. Tobler is anisotropic (−5% downhill is cheapest), so it suits A* edges directly. Multiply by land cover: ×1 on paths, ×5/3 off-path (Tobler's 3/5), ×3 to 5 in dense wood, ∞ in deep water and on cliffs.
- **Carts and roads:** a capped slope cost, cost = len × (1 + a·(s/s_max)²) for s ≤ s_max and ∞ above, with s_max of 0.10 to 0.15 for roads (the 10% guideline) and 0.3 or more for footpaths. Switchbacks then appear by themselves wherever the direct grade exceeds s_max, provided the neighbor mask has at least k = 2 (16 directions); with 8-connectivity, hairpins come out as ugly 45° stairs.

### Roads

Galin et al.'s "Procedural Generation of Roads" (CGF 29(2), Eurographics 2010) makes a road minimize the line integral of c(p, ṗ, p̈) = Σ μᵢ∘κᵢ(p, ṗ, p̈) ([Galin et al. 2010](https://perso.liris.cnrs.fr/egalin/Articles/2010-roads.pdf)). The characteristics κ are vegetation density v(p) (trees within radius r), water depth w(p) (the maximum within r), slope along the direction of travel, and curvature. The μ are user-drawn transfer curves with a threshold κ0 above which cost is +∞: no road on slopes steeper than κ0, none through water deeper than κ0. Shallow water is allowed "at the expense of some banking", which is a ford. **Bridges** cost a function of height above ground (+∞ above the type's maximum), slope, the depth of water crossed and curvature; **tunnels** a function of depth below the surface, slope and the water above. Both are long straight segments between distant grid points, with minimum and maximum lengths per type. The search is A* with a heuristic equal to the cost of a straight road to the goal.

Its **path segment masks** M_k take neighbors (i, j) ∈ [−k, k]² with gcd(i, j) = 1:

| k | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Angular resolution | 45° | 26.5° | 18.5° | 14.0° | 11.3° | 9.5° |
| Neighbors | 8 | 16 | 32 | 48 | 80 | 96 |

On a 60×60 grid (2009 hardware), k = 1 took 0.015 s and gave a 477 m path, an "unrealistic direct path to the top"; k = 4 took 0.110 s and gave a 1757 m switchbacking path. Time grows O(k²), and "k = 5 proved to be a good compromise". Without curvature, paths have "too many sharp turns"; the fix is a 3D search over (x, y, heading) with m heading bins, and with m = 12 on 60×60 the time rose from 0.110 s to 1.750 s.

Galin et al.'s "Authoring Hierarchical Road Networks" (CGF 29(7), Pacific Graphics 2011) builds networks level by level ([Galin et al. 2011](https://www.cs.purdue.edu/homes/bbenes/papers/Galin11CGF.pdf)). Settlements have sizes σ ∈ {city 2, town 1, village 0}, and a road's type is τᵢⱼ = min(σᵢ, σⱼ): highways join cities, major roads cities and towns, minor roads towns and villages. At each level it computes least-cost paths for the complete graph, keeps a subset by a non-Euclidean proximity rule, then merges near-parallel paths into junctions (Steiner nodes). The proximity region is Ω_γ(a, b) = {p : d(a, b)^γ < d(a, p)^γ + d(b, p)^γ}, with d the least-cost distance, and edge (a, b) is kept only if no other node lies in Ω_γ. γ = 2 gives a cost-metric Gabriel graph, γ → ∞ the relative neighborhood graph, and lowering γ adds edges. A "control cost" h(p) added to c is positive near roads already built (with a radius that shrinks per level) to limit redundant parallel roads, or painted by the designer to keep roads out of parks or cities; persistent waypoints force a road through a point. Its merge thresholds and timings weren't extracted.

On a phone, A* over 64×64 with a k = 2 or 3 mask is 4096 cells × 16 to 32 edges, well under 10 ms in JS. Skip the heading dimension (×12 the cost) and smooth the result afterward with Chaikin's corner cutting or a string-pull pass, then rasterize to tiles. Treat river cells as fords at cost F where the river is wide and shallow, and add bridge edges as Galin-style long segments across a river at most L tiles wide, at a fixed cost B. With B large, roads converge on one crossing, which is also where the village should grow, a bridging-point bonus. Use Emilien's w_ex discount or Galin's pruning so a village doesn't get a spiderweb of parallel lanes *(inference)*.

Merryfolk's lanes are a cheaper stand-in ([Merryfolk layout.js](https://github.com/doctorallen/merryfolk/blob/main/js/layout.js)). The main road runs down from the Hill through the square and over a bridge straight below it, and a second bridge crosses 26 to 40 tiles away. Every other place joins the nearest lane already laid, nearest the square first, so lanes branch off lanes. A long stretch bends at up to four points, each chosen among offsets of up to 6 tiles across the line by the least height change (× 20), plus a small cost for the offset and for claimed ground, which makes lanes follow the easier ground without a search.

### Desire paths

Helbing, Schweitzer, Keltsch and Molnár's active walker model (*Phys. Rev. E* 56, 2527, 1997) explains trails ([arXiv cond-mat/9806097](https://ar5iv.labs.arxiv.org/html/cond-mat/9806097); [arXiv cond-mat/9805158](https://arxiv.org/pdf/cond-mat/9805158)):

- **Ground:** dG/dt = [G⁰(r) − G(r, t)]/T(r) + Σ_α I(r)·[1 − G/G_max]·δ(r − r_α). Trails relax back to bare ground G⁰ with durability T, and each footstep adds intensity I, saturating at G_max.
- **Trail attraction:** V_tr(r) = ∫ e^(−|r′ − r|/σ)·G(r′) d²r′, where σ is the visibility.
- **Walking direction:** e = ∇[U + V_tr] / |∇[U + V_tr]|, with destination potential U = −|d − r|.
- Two dimensionless parameters, κ = I·T/σ and λ = V⁰·T/σ. Low κ gives a direct-route system, high κ a minimal (Steiner-like) system, and intermediate κ a "minimal detour system", which matches photographs of real campus trails. Ants (chemical trails plus random search) make dendritic trunk-and-branch systems instead.

The paper gives no numeric values beyond a 100×100 lattice for the ant case, and no calibration of I, T or σ was found. A cheap version *(inference)*: keep a Float32 "wear" grid; for N trips between points of interest (houses to the well, fields and ford; for animals, dens to water), run A* with step cost = base × (1 − β·wear), β about 0.5 to 0.8; after each trip, add wear along the path (saturating at 1) and decay all wear by e^(−Δt/T). After 20 to 100 trips, threshold the wear map into dirt-path tiles. High β and long T give a few shared trunk trails; low β gives many direct paths. Game trails to water appear when trips start at random forest cells and end at the nearest bank. No source on real animal-trail placement was found.

## Vegetation

Every documented system reduces to per-cell abiotic maps (temperature from elevation, sun from aspect and shadow, moisture from flow and slope, soil depth from slope) fed into per-species tolerance curves combined by the minimum, Liebig's law. Then come clearings round people and denser bands at edges.

### Habitat

Cordonnier et al. (2017), after Gain et al. (2017), give each plant type a **viability hat function** for each condition c ∈ {temperature, moisture, sunlight} ([Cordonnier et al. 2017 §5](https://cs.purdue.edu/homes/bbenes/papers/Cordonnier17ToG.pdf)):

| c | v(c) |
|---|---|
| c < E_min or c > E_max | −1 |
| E_min ≤ c < I_min | (c − E_min) / (I_min − E_min) |
| I_min ≤ c ≤ I_max | 1 |
| I_max < c ≤ E_max | (c − I_max) / (E_max − I_max) as printed |

Viability is **V = minᵢ vᵢ**, "since viability is constrained by the weakest resource". As printed, the falling branch runs from 0 to +1 rather than from +1 to 0; the intended ramp is presumably 1 − (c − I_max)/(E_max − I_max). That's the notes' reading, not the paper's.

- **Inputs.** Temperature is the monthly mean minus a 6.5 °C per 1000 m lapse; sun exposure is the average daily hours of direct sun per month, from ray casts along the sun's path for a latitude and compass direction, with terrain self-shadowing; soil moisture is the yearly moisture distributed by monthly rainfall.
- **Vigor and stress.** Vigor is the mean viability over the growing season (months with a mean temperature of at least 5 °C); stress is the mean of the four worst monthly viabilities, counted only if negative. Germination adds seedlings in proportion to vigor × free space (1 − d), only without stress, at 0.24 saplings per m² for woody plants. Death removes plants until canopy density d < 1, then in proportion to stress, then a small random fraction above an age threshold.
- **Canopy density** per cell is d = n·π·(r·h/n)²/w², with n the plant count, h the summed heights, r the ratio of canopy radius to height and w the cell width; d > 1 forces self-thinning. Shrubs under trees get less sun in proportion to tree density, and grass is a density, not individuals.
- **Soil depth from slope.** The initial humus thickness is H = g(slope), g(s) = e^(−s²/σ²) with σ² = 3·ln 2, chosen so g(tan 30°) = 1/2: "half as much humus on 30° slopes as on flat areas" (§3.2).
- **Layers and events.** Bedrock, rock, sand, humus, grass, shrubs and trees, plus dead vegetation that decays into humus (about 30% of litterfall becomes humus per year). Events (rain, temperature, lightning, gravity, fire) fire at random cells with a time step of one year, and trees stabilize slopes against slides.

Gain et al.'s EcoBrush computes soil moisture as M_{i,m} = min(k_c, M_{i,m−1} + min(P_m, A_i) − k_p), with P_m the monthly rain, A_i the cell's absorption, k_c the reservoir capacity and k_p plant uptake (auto-tuned so the yearly cycle balances). Slope weights absorption linearly, "to represent the transition from loamy soils in valleys to rock on cliff faces"; rain above A_i runs off, and surface water (runoff plus seepage) spreads over the next three months. It derives temperature, sunlight, moisture and slope maps, clusters cells by condition, and fills each cluster from a database of precomputed small simulations, for interactive design up to 5×5 km² and automatic generation of 10×10 km² ([Gain et al. 2017](https://people.cs.uct.ac.za/~Jgain/wp-content/papercite-data/pdf/gain2017.pdf); [EG record](https://diglib.eg.org:443/handle/10.1111/cgf13107)). Hammes (2001) places plants at runtime from "ecotopes", habitats of fairly uniform climate and soil, recomputed for each area that comes on screen with fast, deterministic algorithms; the per-ecotope rules weren't in the fetched material (via search summary) ([flipcode](https://flipcode.com/archives/02-07-2002.shtml); [DOI](https://doi.org/10.1007/3-540-44818-7_14)).

**The treeline** sits where the growing-season mean root-zone temperature is about 6.4 ± 0.7 °C (Körner 2012; Paulsen and Körner 2014, the TREELIM model: days with a daily mean above 0.9 °C, a season of at least 94 days). Körner and Paulsen 2004 first reported 6.7 ± 0.8 °C from 46 sites between 68° N and 42° S (via search summary) ([GMBA](https://www.gmba.unibe.ch/tools/definitions/treeline_definition/index_eng.html); [Körner and Paulsen 2004](https://edoc.unibas.ch/8594); [PMC3535059](https://pmc.ncbi.nlm.nih.gov/articles/PMC3535059)). It's lower on the shaded ubac than on the adret, and it is also the upper limit for farming and wood.

A one-pass phone recipe, no simulation *(inference)*:

- `temp = T0 − lapse·h`
- `sun = clamp(0.55 + 0.4·southness − a small east penalty)`, Merryfolk's formula, plus a shadow test against cliffs if there are any
- `moist = max(river term e^(−dist/4.5), wetness-index term)`
- `soilDepth = e^(−s²/(3 ln 2))`, with s = tan(slope angle)
- for each species, V = min(hat(temp), hat(moist), hat(sun), hat(soilDepth)); pick a species by weighted random over max(0, V) × base abundance; density = clamp(max V) × a clearing factor

Willows, alders and reeds go where moist ≥ 0.85 within 1 to 2 cells of water. Below a temperature threshold V for trees falls to −1, leaving grass, heather and rock, and if `sun` feeds `temp` the treeline drops on north-facing slopes for free. For edges, blur tree density into a forest-ness F: bushes and young trees concentrate where 0.15 < F < 0.6, deep forest gets ferns and holly. Round settlements, multiply tree potential by a ramp of BFS distance from settled tiles with noise added, clamp((d − 1.5 + noise·3)/6), so the edge is ragged, and give paths a one-tile margin with no trees *(inference)*. No primary ecology source was fetched for riparian or forest-edge widths in meters.

### Spacing

- **Deussen et al. 1998** represent plants "coarsely as circles positioned in a continuous landscape. Each circle defines the ecological neighborhood of the plant", after Firbank and Watkinson. In the self-thinning model, circles start at random with random radii and grow; "If the circles representing two plants intersect, the smaller plant dies", and plants reaching a limit size die of age. Average area against density follows a log-log slope of −1, equivalent to the −3/2 self-thinning law in mass; the demonstration started with 62,500 plants. In the multi-species model each species has new plants per step, a maximum size, a growth rate, a probability of surviving domination and a wet or dry preference; each plant's vigor in [0, 1] is a randomized function of local water and that preference, and **competitive ability = vigor × (size / max size)**. With eight species, segregation into wet and dry areas emerged. For designed scenes, a painted density image is half-toned: "each dot becomes a plant" ([Deussen et al. 1998](https://algorithmicbotany.org/papers/ecosys.sig98.pdf); [project page](https://algorithmicbotany.org/papers/ecosys.sig98.html)).
- **Bridson 2007** samples a Poisson disk in O(N): candidates come from the annulus between r and 2r round an active sample, up to k per sample ("typically k = 30"), with a background grid of cell size r/√n for O(1) neighbor checks ([Bridson 2007](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf)).
- **EcoBrush** records pairwise distance histograms between plant categories (counts in concentric shells) and resynthesizes them by dart throwing or Metropolis–Hastings, extended to disk-disk (canopy radius) histograms so canopy spacing and undergrowth are reproduced ([Gain et al. 2017 §6](https://people.cs.uct.ac.za/~Jgain/wp-content/papercite-data/pdf/gain2017.pdf)).
- **Merryfolk** shuffles all tiles; each grass tile not on or beside a road is accepted with probability potential × 2.2 × `gen('woods')`; a species is chosen by weighted random; the radius is RADIUS[kind] × (0.55 + 0.45 × the tree's shape size), with RADIUS = {oak 2.1, beech 2.2, copper 2.2, birch 1.4, pine 1.6, fir 1.4, poplar 1.3, sapling 1.0} tiles; and a tree is rejected if any placed tree lies within 0.85 × max(r, r_other). Trunks get ±2 px of jitter inside the tile ([Merryfolk nature.js](https://github.com/doctorallen/merryfolk/blob/main/js/nature.js)).

The max(r₁, r₂) rule lets big trees hold space against small ones without a simulation, a cheap stand-in for Deussen's dominance; (r₁ + r₂)/2 instead lets saplings crowd under oaks, which looks like undergrowth. For habitat-weighted Bridson, set r(p) = r_species / √density(p), store each sample's radius, test against max(r_new, r_old), and pick the species at candidate time from habitat weights: clumps where habitat is good, sparse singletons at the margins. Seed from `ctx.rng('trees')`, or per chunk from hash(seed, cx, cy). For age structure, run 5 to 10 iterations of "grow all radii by 10%; in each overlapping pair, the one with lower vigor × relative size dies with probability p_species", milliseconds for a few hundred trees with a spatial grid. At 16 px tiles on a 320×180 frame (20×11 tiles), only about 20 to 60 trees are on screen, so placement cost is negligible and the art budget (distinct tree sprites under eight inks) is the real limit *(inference)*.

### Merryfolk's soils and species

Merryfolk works the land out "in stages, each reading the ones before (as Dwarf Fortress builds its worlds)": height, then slope and aspect, then drainage, then wetness, then soil ([Merryfolk terrain.js](https://github.com/doctorallen/merryfolk/blob/main/js/terrain.js)):

- **Slope** = |∇h| by central differences; south = clamp(−dy/0.03, −1, 1) ("south, toward the bottom of the map, gets the sun"); sun = clamp(0.55 + 0.4·south − 0.05·max(0, dx/0.03), 0, 1).
- **Water:** an 8-neighbor BFS distance to the river and pond, priority-flood with a binary heap, and D8 flow accumulation.
- **Wetness:** TWI = ln(flow / (slope + 0.004)); moist = 1 on water, else clamp(0.62·e^(−distWater/4.5) + 0.5·t + `gen('wet')`), with t the TWI normalized above 5.
- **Soil:** ALLUVIUM if h < 0.24 and distWater < 7; THIN if h > 0.62 or s > 1.1 (s = slope/0.03); CLAY if moist > 0.4 and s < 0.6; otherwise LOAM. "Rich alluvium on the low flood ground, loam on gentle slopes, thin stony soil on the heights and steep banks, heavy clay where it's wet and flat."

Woodland potential is 0.65 at the top border or 0.45 at the others; inside the named forest, 0.35 + 0.02 × depth; otherwise by soil, THIN 0.28 + 0.12·slope, CLAY 0.26, ALLUVIUM 0.05, LOAM 0.04. Moisture above 0.85 multiplies it by 0.4, noise above 0.6 adds up to 0.8 × the excess, and the clearing ramp clamp((settled − 1.5 + (noise − 0.5)·3)/6, 0, 1) multiplies the whole, where `settled` is a BFS distance from every non-grass or reserved tile. So loam and alluvium stay mostly open as farmland, and woods sit on thin soil, clay and the map edges ([nature.js](https://github.com/doctorallen/merryfolk/blob/main/js/nature.js)).

| Species | Weight |
|---|---|
| Oak | LOAM 1, CLAY 0.9, ALLUVIUM 0.5, else 0.15 |
| Beech | LOAM or CLAY 0.45, else 0.06 |
| Birch | THIN 0.9, else 0.25; +0.3 within 5 tiles of settlement, as a pioneer |
| Pine | 0.8 on THIN with h > 0.5, else 0.05; +0.5 at the forest or map edge |
| Fir | 0.5 if h > 0.6; +0.35 at edges |
| Poplar | 0.6 if moist > 0.5 and the soil isn't THIN |
| Sapling | 0.45 within 5 tiles of settlement, else 0.12 |

Willows go on grass tiles with water in the 3×3 neighborhood, not reserved, not beside a road, with no other tree within 4×3 tiles, accepted with probability 0.09. Edge tiles (1 to 4 trees in the 5×5 box) get a bush with probability 0.16, deep woods 0.05, open ground 0.008: thin soil with sun > 0.55 gets gorse or heather, deep or moist > 0.6 gets fern or holly, edges get bramble or thorn. Mushrooms go to the dampest wood tiles, wild herbs to sunny (> 0.5), dry (< 0.45) wood-edge tiles ([nature.js](https://github.com/doctorallen/merryfolk/blob/main/js/nature.js); [world.js](https://github.com/doctorallen/merryfolk/blob/main/js/world.js)).

These tables are a discretized version of the Cordonnier and Gain hat functions: soil class stands in for moisture and depth, and the edge and settlement bonuses stand in for succession, with birch and saplings as pioneers near disturbance. The constants are game-specific, not ecologically calibrated. Under eight inks, species must differ in silhouette more than color, so three or four species per quest (oak, birch, willow, pine) is the practical ceiling *(inference)*.

## Biome edges

Real biome edges are rarely lines. An ecotone "may be narrow or wide", "a gradual blending of the two communities across a broad area" or "a sharp boundary line" ([Wikipedia, Ecotone](https://en.wikipedia.org/wiki/Ecotone)). The treeline is "rarely a defined line and instead forms a fuzzy transitional zone" between the timberline, the treeline and the last single trees ([Nature Scitable](https://www.nature.com/scitable/knowledge/library/global-treeline-position-15897370)); the Arctic forest-tundra averages about 145 km wide, "larger trees along rivers and on sheltered sites set in a matrix of tundra" ([Wikipedia, Tree line](https://en.wikipedia.org/wiki/Tree_line)). Gallery forests push fingers of woodland along rivers into grassland, with abrupt edges only a few meters wide ([Wikipedia](https://en.wikipedia.org/wiki/Gallery_forest)). A forest edge is layered: the Swiss forest inventory measures a mantle of edge trees (up to 7 m and more), then a shrub belt (under 2 to over 4 m), then a herb fringe ([LFI](https://www.lfi.ch/api/data-catalog/var/1287); [LFI](https://lfi.ch/api/data-catalog/var/1088)). Under a closed canopy little light reaches the floor (a tropical canopy "intercepts around 95% of the sunlight"), and where a gap opens the undergrowth thickens ([Wikipedia, Understory](https://en.wikipedia.org/wiki/Understory)). So shrubs belong at edges and gaps, thin under closed forest *(inference)*.

| System | Edges |
|---|---|
| Minecraft before 1.18 | Zoom layers that coin-flip edge cells between parents, a smoothing layer, buffer biomes between incompatible ones, and a final Voronoi zoom jittering one point per 4-block cell by about ±1.8 blocks ([cubiomes](https://raw.githubusercontent.com/Cubitect/cubiomes/master/layers.c)) |
| Minecraft 1.18 | Biomes are boxes in a six-parameter climate space and a point takes the nearest, so edges follow smooth noise contours ([Minecraft Wiki](https://minecraft.wiki/w/World_generation)); "biome blend" (radius 0–7, default 2) only averages grass and water colors ([Biome](https://minecraft.wiki/w/Biome); [Options.txt](https://minecraft.wiki/w/Options.txt_(Java_Edition))) |
| Dwarf Fortress | Biomes per region tile, then "noise is calculated and applied which causes the irregular region boundaries on the local map" ([DF wiki](https://dwarffortresswiki.org/index.php/DF2014:Biome)) |
| Red Blob noisy edges | Each boundary recursively subdivided inside its cells' quadrilateral, amplitude 0.25 to 0.5 ([Red Blob Games](https://www.redblobgames.com/maps/noisy-edges/)) |
| Domain warping | Look up f(p + h(p)) instead of f(p) ([Quilez](https://iquilezles.org/articles/warp/)) |
| Dual-grid tiles | Tiles at a half-cell offset, marching squares on the base cells: 6 tiles with rotation, 16 without, instead of the blob's 47 ([Boris the Brave](https://www.boristhebrave.com/2023/05/31/quarter-tile-autotiling/)) |
| Height-blended splatting | The layer whose height plus weight is highest wins within a depth of 0.2, so sand fills the cracks between stones ([Mishkinis 2013](https://www.gamedeveloper.com/programming/advanced-terrain-texture-splatting)) |

The demo's region used to copy each world cell's biome through a small warp, so edges ran straight along the 4 km cells and showed as 10-tile steps. Now it does three things:

1. **Biomes by climate, per tile**, as Minecraft 1.18 does. Each tile reads the world's temperature (with the lapse rate from its own height) and rain, the rain from land cells only so a coast doesn't read the sea's dry air as desert, both looked up through a domain warp of about a cell and jittered by noise (±0.7 °C and ±10% of the rain, typically), and classifies them with the world's own Whittaker rule. Edges follow the climate's contours. Swamps and beaches still come from the world cell.
2. **Dithered seams.** Where a tile's neighbor on the same terrace has another ground, each pixel within 3 px of the border reads its ground from a point nudged by a slow noise (±3 px) plus an ordered dither (±2 px). The 8-pixel steps become a ragged edge with a little dither in it, the pixel-art cousin of height-blended splatting *(inference)*.
3. **A blended wood edge.** Tree cover is blurred over two tiles before groves and clearings are applied, so a wood thins across its edge with trees straying out, and the gallery-wood rule keeps trees along water. Shrubs follow the mantle and fringe: dense where the blurred cover is around 0.3 (a band about 0.15 to 0.45), along paths and round clearings. Under closed forest a biome's shrub density is multiplied by 0.12 (it was 0.3), and at an edge by up to 1.6.

The cost is a few extra noise lookups per tile and per seam pixel, inside the region's 0.1 to 0.4 s.

## Drawing height in 3/4 view

In 3/4 oblique a raised area is drawn as its top surface shifted up the screen by height × pixels per level, plus a front-facing vertical face below its southern edge. East and west edges get thin side faces or rims, and north edges only a lip line, because that face points away. Height reads only through value contrast (a lighter top, a darker face, a cast shadow at the foot), so a cliff is a stack of autotiled bands: lip, face rows, foot, shadow. Elsewhere's own 2:1 isometric look is a different projection; this section applies to a quest or game that chooses 3/4 oblique, or to Tycho generally.

What the sources show:

| Source | What it does |
|---|---|
| A commercial 16×16 elevation tileset | A tall cliff is four bands stacked lip to foot plus a cast-shadow row on the ground; each band has six variants plus left and right end caps; "A drop taller than four tiles repeats the upper face band." Light comes from the north-west: plateau edges have "a lit rim to the north and west, a shadowed face to the east, and a drop with a cast shadow to the south." The plateau is a 47-mask (blob) autotile, with a second 47-mask set for rocky shelves; no stairs or ramps ship ([Verdant 02 Elevation](https://csaf.itch.io/verdant-02-elevation)). The same page argues that a grey band between two identical lawns reads as a path, not a cliff, and recommends a lighter plateau, a stepped falloff down the face and an offset cast shadow (via search summary) |
| A tileset tutorial's layers | Base Ground holds flat ground, water, waterfalls and ledges; Cliffs holds short cliffs, high cliff tops, mid-sections, stairs and cave entrances; "Cliffs but Under" holds the side sections of faces and the piece visible beneath a cave entrance; Ground Carpet holds deep water, reflections and stones. A high waterfall has upper, middle and lower parts, joining the cliff top horizontally, the face, and the water vertically, in a 3-frame loop; a "tiered" waterfall joins a short cliff to water, also in 3 frames. Stairs sit in the Cliffs layer with Base Ground showing at top and bottom ([itch.io devlog](https://itch.io/devlog/986063/biome-tileset-packs-terrain-set-up-tutorial.amp)) |
| Cave entrances | Many tilesets include only entrances in the face you see, on a cliff north of the player; the workaround is an entrance in a face with more wall above and the interior beyond (via search summary) ([OpenGameArt](https://opengameart.org/node/5481)) |
| CrossCode | Made 3D "so that the player can walk on layers of different heights"; height matters, "jumping is not". Jumps are low and automatic at ledges, partly because without perspective, objects at different heights are hard to place; it's "pseudo 3D without perspective distortion" ([Radical Fish](https://www.radicalfishgames.com/?p=1168)) |
| Eastward | "A 3D game with a 2D perspective" in a custom engine with lighting and fog layers; Aseprite art split into parts and rebuilt in 3D with hand-painted bump maps. "Elevation is your friend to make an area feel dense!"; "Staircases in a bustling city let the player move behind buildings without being totally obscured" ([Game Developer](https://www.gamedeveloper.com/art/eastward-s-creators-share-insights-on-making-pixel-art-adventures)) |
| Sea of Stars | Climbing, vaulting and ledge-hoisting as core traversal, giving "a lot more verticality in the gameplay than is usually seen in games of the genre" and breaking from "bound-to-the-grid movement"; Coral Cascades is a cliffside crossed by jumping, swimming and shimmying ([PlayStation Blog](https://blog.playstation.com/?p=382678); [MobileSyrup](https://mobilesyrup.com/2023/09/11/sea-of-stars-level-design-sabotage-studio-thierry-boulanger-interview/); [Nintendo Life](https://www.nintendolife.com/news/2020/03/hands_on_first_impressions_of_sea_of_stars_the_next_project_from_the_messenger_dev_sabotage)) |
| Wargroove | "Wasn't supposed to have different layers/levels"; its cliff and mountain tile "works like the wall tileset", a neighbor-chosen autotile rather than true elevation ([Nexus Mods](https://www.nexusmods.com/wargroove/mods/44)) |
| SNES layering | In Mode 1, BG1 and BG2 are 16-color layers and BG3 a 4-color layer; each background splits into high- and low-priority halves by a per-tile bit, so sprites can pass between them, which is how walk-under bridges and upper floors work (via search summary) ([SNESLab](https://sneslab.net/wiki/BG3_High_Prio); [SNESdev wiki](https://snes.nesdev.org/wiki/Mode_5)) |
| Tile size | "16x16px is probably the most common size", and "Anything over 32x32px seems like overkill" ([Slynyrd, Pixelblog 20](https://slynyrd.com/blog/2019/8/27/pixelblog-20-top-down-tiles)) |

No developer write-up was found for how Stardew Valley, Chained Echoes, Minish Cap or A Link to the Past build cliffs and stairs tile by tile, nor for Eastward's or Sea of Stars' height data. Waterfall frame counts and caves come from asset-pack tutorials.

From these, a working model *(inference)*:

- **Data.** Store an integer level L per tile (0 to 3 or so), apart from the material.
- **Drawing.** A tile at (x, y, L) draws its top at (x·T, y·T − L·H), with H the face height per level (T/2 to T, so 8 or 16 px with 16 px tiles). Wherever L(x, y) > L(x, y+1), draw (L(x, y) − L(x, y+1))·H px of front face below the top's south edge. Draw rows north to south, then by L, so faces overdraw the tops in front. Sprites sort by their foot's y plus L·H and are offset up by L·H.
- **Autotiles.** The cliff top is a 47-blob (or 16-mask) autotile over "same or higher level" neighbors. The face takes a 3-bit key (does the left neighbor have a face, does the right, is this the foot row), which gives the band variants and end caps; taller faces repeat the middle band.
- **Value under eight inks.** The top is the ground ink; the lip one step lighter (the lit north and west rim); the face two steps darker with a few vertical strata marks; the foot the darkest line; the cast shadow a row of dither or darker ground below the foot, offset by the sun (see [the sun](sun.md)). East edges get a 1 to 2 px dark side face, west edges a lit rim.
- **Slopes.** A ramp is a face drawn as diagonal steps or 2 to 3 inks across the transition rows; stairs are 2 to 4 px treads cut into a face. Gentle hills can be shown by hillshading alone, ink index = base + round(k·(∇h · light)) with the light from the north-west, quantized to 2 or 3 steps, which costs nothing in an indexed buffer.
- **Water.** Each pool is flat at its own level, with a 1-row bright waterline against a face. A waterfall is a vertical strip of animated tiles (3 frames) replacing a face segment, with foam on the pool below, and the upper reach must end at the lip on the waterfall's column. Generation places waterfalls where a priority-flood flow path crosses a level drop.
- **Caves.** Entrances go only in south-facing faces, the visible ones, at least 2 face rows tall; the interior is a separate map or scene. For cutaways, cut the north wall and face out when the player is inside or behind.
- **Overlaps.** Walk-under bridges need two draw layers per tile (below and above sprites) and a per-actor layer flag switched at stairs, like the SNES priority bit.
- **Few levels.** Keep 2 to 4 levels, with faces 8 to 16 px tall at 320×180 (CrossCode's lesson). No authoritative face height per level was found.

Merryfolk shows the shape at scale. Its land is quantized into four terraces whose edges are drawn as grassy banks ([world.js](https://github.com/doctorallen/merryfolk/blob/main/js/world.js)). Out in the wilder parts, away from anything built, some banks turn to bare rock where a broad noise mask passes 0.35: a face of weathered boulders that drops 16 to 40 world pixels as the mask strengthens, with grass over the lip and a shadow along the foot. Inside a rocky stretch the ground steps up a whole terrace along a wavy line, so every stretch has an escarpment for its cliff to follow, and steps are cut wherever a lane runs up a cliff ([cliffs.js](https://github.com/doctorallen/merryfolk/blob/main/js/cliffs.js)). Built ground is leveled: fields, buildings and plots sit on flat pads at one terrace's height, blending back into the hillside over 2.5 tiles, so no bank runs under a bakery ([terrain.js](https://github.com/doctorallen/merryfolk/blob/main/js/terrain.js)).

## Sources

- [Martin O'Leary, mewo2/terrain](https://github.com/mewo2/terrain/blob/master/terrain.js)
- [Wikipedia, spring line settlement](https://en.wikipedia.org/wiki/Spring_line_settlement)
- [Rashid Faridi, site of a settlement](https://rashidfaridi.com/2019/08/06/site-of-a-settlement) and [Save My Exams, settlements](https://www.savemyexams.com/igcse/geography/cie/20/flashcards/1-population-and-settlement/1-5-settlements-and-service-provision/)
- [British Landscape, reading the landscape](https://britishlandscape.org/reading-the-landscape/files/archive-apr-2013.htm)
- [cahier-de-prepa.fr course notes](https://cahier-de-prepa.fr/hkal-thiers/download?id=1628) and [Parc national des Écrins booklet](https://www.ecrins-parcnational.fr/sites/ecrins-parcnational.com/files/fiche_doc/17153/correctionslivretenfant05-09-07.pdf)
- [GMBA, treeline definition](https://www.gmba.unibe.ch/tools/definitions/treeline_definition/index_eng.html), [Körner and Paulsen 2004](https://edoc.unibas.ch/8594), [PMC3535059](https://pmc.ncbi.nlm.nih.gov/articles/PMC3535059)
- [Emilien et al. 2012, Procedural Generation of Villages on Arbitrary Terrains](https://perso.liris.cnrs.fr/egalin/Articles/2012-villages.pdf) ([HAL](https://hal.archives-ouvertes.fr/hal-00694525))
- [Mezha, Ostriv Alpha 5](https://mezha.media/en/2023/03/20/the-ukrainian-urban-planning-strategy-ostriv-has-received-an-alpha-5-update)
- [Wikipedia, Tobler's hiking function](https://en.wikipedia.org/wiki/Tobler%27s_hiking_function), [movecost vignette](https://cran.nics.utk.edu/cran/web/packages/movecost/vignettes/movecost.Rmd), [par.nsf.gov 10420114](https://par.nsf.gov/servlets/purl/10420114)
- [Galin et al. 2010, Procedural Generation of Roads](https://perso.liris.cnrs.fr/egalin/Articles/2010-roads.pdf) and [Galin et al. 2011, Authoring Hierarchical Road Networks](https://www.cs.purdue.edu/homes/bbenes/papers/Galin11CGF.pdf)
- [USFS, trail design](https://www.fs.usda.gov/t-d/pubs/htmlpubs/htm07232806/page04.htm) and [Shuswap Trail Alliance design standards](https://shuswaptrails.com/userfiles/file/sta_trail_design_standards%20sml.pdf)
- [Cordonnier et al. 2017 (ACM ToG)](https://cs.purdue.edu/homes/bbenes/papers/Cordonnier17ToG.pdf)
- [Gain et al. 2017, EcoBrush](https://people.cs.uct.ac.za/~Jgain/wp-content/papercite-data/pdf/gain2017.pdf) ([EG record](https://diglib.eg.org:443/handle/10.1111/cgf13107))
- [Deussen et al. 1998, Realistic modeling and rendering of plant ecosystems](https://algorithmicbotany.org/papers/ecosys.sig98.pdf) ([project page](https://algorithmicbotany.org/papers/ecosys.sig98.html))
- [Bridson 2007, fast Poisson-disk sampling](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf)
- [Verdant 02 Elevation Tileset](https://csaf.itch.io/verdant-02-elevation) and [the biome tileset set-up tutorial](https://itch.io/devlog/986063/biome-tileset-packs-terrain-set-up-tutorial.amp)
- [OpenGameArt, cave entrances](https://opengameart.org/node/5481)
- [Radical Fish Games, why auto jump](https://www.radicalfishgames.com/?p=1168)
- [Game Developer, Eastward's creators on pixel-art adventures](https://www.gamedeveloper.com/art/eastward-s-creators-share-insights-on-making-pixel-art-adventures)
- [Nexus Mods, Wargroove tileset mod](https://www.nexusmods.com/wargroove/mods/44)
- [SNESLab, BG3 high priority](https://sneslab.net/wiki/BG3_High_Prio) and [SNESdev wiki, Mode 5](https://snes.nesdev.org/wiki/Mode_5)
- [Slynyrd, Pixelblog 20: top-down tiles](https://slynyrd.com/blog/2019/8/27/pixelblog-20-top-down-tiles)

- Village forms: [Hull, Beresford's Lost Villages](https://dmv.wordpress.hull.ac.uk/?p=278), [de.wikipedia, Dorf](https://de.wikipedia.org/wiki/Haufendorf), [Waldhufendorf](https://de.wikipedia.org/wiki/Waldhufendorf), [Angerdorf](https://de.wikipedia.org/wiki/Angerdorf), [Hufe](https://de.wikipedia.org/wiki/Hufe), [fr.wikipedia, Village-rue](https://fr.wikipedia.org/wiki/Village-rue), [Wikipedia, Open-field system](https://en.wikipedia.org/wiki/Open-field_system)
- Biome edges: [Wikipedia, Ecotone](https://en.wikipedia.org/wiki/Ecotone), [Swiss NFI forest edge](https://www.lfi.ch/api/data-catalog/var/1287), [cubiomes layers.c](https://raw.githubusercontent.com/Cubitect/cubiomes/master/layers.c), [Minecraft Wiki, World generation](https://minecraft.wiki/w/World_generation), [DF wiki, Biome](https://dwarffortresswiki.org/index.php/DF2014:Biome), [Red Blob Games, noisy edges](https://www.redblobgames.com/maps/noisy-edges/), [Quilez, domain warping](https://iquilezles.org/articles/warp/)

The full research is in the notes on [settlements, paths and vegetation](notes/settlements_paths_vegetation.md) and on [caves, village forms and biome edges](notes/caves_villages_edges.md).

<script src="demos/kit.js"></script>
<script src="demos/flora.js"></script>
<script src="demos/geo-world.js"></script>
<script src="demos/start.js"></script>
