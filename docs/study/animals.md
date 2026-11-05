# Animals

How a game can make its animals, move them in herds, flocks and schools, and decide which live where and how many. Three layers that are usually treated apart turn out to share one small data model. A creature is a **genome**: a body plan, a role and a biome, plus a handful of numbers. A painter turns the genome into frames, and the same genome sets how the animal moves, when it's about, and how many of it the land can feed. Shipped games all build bodies from authored parts toggled by a seed (Spore, No Man's Sky, Starbound, Dwarf Fortress), never from free noise. Groups move by boids (Reynolds 1987), and a few hundred agents on a uniform grid take **well under a millisecond** a step in plain JS. Placement is a table of rules per species, like Dwarf Fortress's creature tokens and Minecraft's spawn lists. Numbers come from three rules of thumb: about ten percent of energy passes up each level of the food chain (Lindeman), about 90 kg of a carnivore lives on 10,000 kg of its prey (Carbone and Gittleman), and density falls as mass to the −0.75 (Damuth). On a phone, all of it fits in a frame except one-off painting, which is baked once per species. Animal trails are on [the settlements page](settling.md#paths), the IK creature on [Motion](motion.md), and the biomes on [Real geography](geography.md#climate-and-biomes).

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md).

Text marked *(inference)* is reasoning from the sources, not a sourced fact. The full research, with every source, is in [the animals note](notes/animals_creatures_ecology.md).

- [Body plans](#body-plans)
- [Anatomy and color](#anatomy-and-color)
- [Names that agree with the picture](#names-that-agree-with-the-picture)
- [Moving together](#moving-together)
- [The day's round](#the-days-round)
- [Who lives where](#who-lives-where)
- [How many](#how-many)
- [What it costs on a phone](#what-it-costs-on-a-phone)
- [What it means for Tycho](#what-it-means-for-tycho)
- [Sources](#sources)

## Body plans

Every shipped creature generator starts from a body plan someone drew or wrote, then varies it. None grows anatomy from noise.

| Game | What is authored | What the seed chooses |
|---|---|---|
| Spore (2008) | Part meshes, each with **capabilities** (grasper, mouth, foot, spine); animations written against those capabilities | Nothing: the player builds the body; the animation binds to whatever was built ([Hecker et al. 2008](https://www.chrishecker.com/Real-time_Motion_Retargeting_to_Highly_Varied_User-Created_Morphologies)) |
| No Man's Sky (2016) | One model per creature family holding every candidate part, "a horrific mess of potential body parts and contradicting geometries" | Which named parts are shown: "each geometrical object has a name that points to a descriptor", drawn from pools until the creature is valid ([Kotaku](https://kotaku.com/a-look-at-how-no-mans-skys-procedural-generation-works-1787928446), on a data-miner's findings) |
| Starbound (2016) | Parts by type: quadrupeds get head, body, legs and tail; fliers head, body and wings; fish head, body and fins | The parts, and six palette colors per part, randomized at spawn ([Ruud Schouten](https://ruudschouten.github.io/post/procedural-creatures); modding tutorial, search summary) |
| Dwarf Fortress forgotten beasts | Base forms: blobs, worms, quadrupeds and humanoids, insects and spiders; materials; attack syndromes | Form, extra or missing parts (extra eyes, feathers), material (flesh, ash, steam, gem, metal), a venom or a breath ([DF wiki](https://dwarffortresswiki.org/index.php/Forgotten_beast)) |

No Man's Sky and Starbound are **kits**, the study's word on [the sprites page](sprites.md#kits) for drawn parts layered by slot. Dwarf Fortress's beasts are kits too, but their parts are words. The only "free" generators, Bollinger's masks and their ports, still run inside a hand-drawn mask, and [the sprites page](sprites.md#masks) found the read comes from the body plan, the symmetry and the outline, not the noise.

Spore's paper is the one full account of making any body move. Animators write motion against **queries over capabilities** ("the graspers in the front half-space", "walk up from this limb to the first spine segment"), so a clip never names a bone. At bind time, predicates such as `HasGraspers`, `HasFeet` and "is the spine prone or upright" pick a branch. A creature without hands picks fruit up with its mouth ([Hecker et al. 2008](https://www.cse.chalmers.se/edu/year/2011/course/TDA361/Advanced%20Computer%20Graphics/027-hecker%20copy.pdf)). The gait system then does the legs:

- **A leg** is "a path through the tree of connected limb segments with a foot body at the leaf and a spine segment at the base".
- **Leg groups.** Legs are clustered into groups of roughly equal length, and the groups' length ratios are approximated by small rational numbers. Those ratios set each group's gait frequency.
- **Duty factor and step trigger.** Each foot gets a duty factor (the fraction of the cycle it is on the ground) and a step trigger (its phase offset in the cycle).
- **Gaits by foot count.** Animators wrote speed-to-gait tables for groups of 1 to 6 feet; 7 or more were generated. Footless bodies either float or crawl: "some spine bodies [are] converted into pseudo-feet and an inch-worm-like gait is generated."
- **Cost.** "A procedurally animating character with 25 bodies currently takes approximately 0.2ms per frame on a 1.7Ghz Pentium-M", 35% of it in the IK solver.
- **Quality.** Testers ran several hundred creatures against a thousand animations; the pass rate was "~90%". The authors concede a generalizing system is not yet "competitive with a Maya animation on a single fixed character".

Spore's Creature Creator also capped bodies: a DNA budget (2,000 points to start) and a complexity meter that stops new parts (search summary, [Spore tutorials](https://www.spore.com/comm/tutorials/hero_creature_creation)). Capping complexity keeps a generated body readable, and at 320×180 the cap is tighter still *(inference)*.

For a pixel game, the lesson splits in two *(inference)*:

- **Bodies** are a few authored plans (four legs, bird, fish, bug, and a footless crawler if a quest wants one), each a small parametric drawing: body length and height, leg length and thickness, neck, head, snout, tail, ears, horns. The seed picks the numbers inside ranges that keep the silhouette working.
- **Motion** comes from the plan, Spore-style: a four-legged plan trots in diagonal pairs, a bird flaps through up, level, down and level, a fish swings its tail, and a bug walks in two tripods. Each is a four-frame loop drawn from the same genome, so a new body needs no new animation. The IK creature on [Motion](motion.md) is the next step up, for a hero animal the camera dwells on.

<figure class="demo"><div class="stage" data-demo="creatures"></div>
<figcaption><b>Generated creatures.</b> Nine animals for one biome, each from a seeded genome of about 550 bytes of JSON: a body plan (four legs, bird, fish or bug), proportions, inks by biome and role, a four-frame trot, flight, swim or tripod walk, and a name and description built from the same numbers. Prey take the biome's ground inks and shade dark above and pale below; predators take a darker ramp and an amber eye; the poisonous wear red, amber and black. Tap an animal to reroll it; the line under the grid counts the inks its cell uses, never more than eight. Switch biomes to see the same slots dressed for snow, desert or marsh.</figcaption></figure>

The demo's genome is plain JSON and takes about **0.008 ms** to make; its four frames take about **0.14 ms** to paint (Node on a laptop), so a quest could make dozens of species when it loads and bake them into a sheet.

## Anatomy and color

A few rules from biology make a generated animal look as if it could live. Each turns into one line of a generator.

### Legs and size

Bigger animals need relatively thicker legs. McMahon's elastic similarity (1973) predicts bone length rising as mass^0.25 and diameter as mass^0.375, so limbs thicken with size. Ungulate and especially bovid limb bones fit it well. Biewener's 1983 survey of 32 species found mammal long bones closer to geometric similarity (both as mass^0.33): large mammals keep bone stress down by standing more erect, not by growing much stouter bones ([arXiv physics/0303074](https://arxiv.org/abs/physics/0303074); [Biewener 2005](https://cob.silverchair.com/jeb/article-split/208/9/1665/9381/Biomechanical-consequences-of-scaling)). For a sprite, both readings point the same way *(inference)*: a big animal gets **thicker, straighter, more columnar legs** (2 px in the demo above a size threshold), a small one thin, crouched ones.

Gait scales with leg length too. The Froude number, Fr = v²/(gL), predicts that geometrically similar animals change gait at the same value; birds and humans switch from walking to running near **Fr ≈ 0.5** ([JEB](https://cob.silverchair.com/jeb/article-pdf/1883454/3200.pdf), search summary). A short-legged animal therefore steps faster for the same look. Cycling frames at a rate proportional to √(1/leg length) keeps small and big animals from looking like the same clip at different zooms *(inference)*.

### Countershading

Abbott Thayer's law (1896) is the oldest coloring rule: animals are darker on the surfaces the sky lights and paler beneath, so the gradient cancels the self-shadow and flattens the body against its background ([Wikipedia](https://en.wikipedia.org/wiki/Countershading); [Rowland 2009](https://pmc.ncbi.nlm.nih.gov/articles/PMC2674085)). Cuthill and colleagues showed in 2016 that optimal countershading does aid concealment ([PNAS, PMC5135326](https://pmc.ncbi.nlm.nih.gov/articles/PMC5135326)). In pixels, that is **the top third of the body one ink darker and the bottom third one ink paler**, which happens to be exactly the house rule of light from above, inverted. On a fish it is a dark back and a silver belly.

### Warning colors

Poisonous animals do the opposite. "Many species use red, yellow, and orange, often combined with black" to advertise that they are unprofitable to visual predators (Endler and Mappes 2004). Luminance contrast drives the first avoidance; red, yellow and color contrast speed up the learning, and distinctiveness alone can deter birds (search summaries via [Mappes, Marples and Endler 2005](https://researchonline.jcu.edu.au/29248/) and [a 2014 review](https://www.frontiersin.org/journals/ecology-and-evolution/articles/10.3389/fevo.2014.00025/pdf)). The demo's poisonous slots use red or amber with black bands or spots and no countershading, and keep those inks the same in every biome.

### Camouflage by biome, inside eight inks

Elsewhere's eight-ink rule makes camouflage nearly free *(inference)*. If each biome lends its animals a small ramp one step off its ground, prey hide by construction, and the frame's ink count barely rises. The demo's biome table:

| Biome | Ground | Prey ramp | Predator ramp | Warning |
|---|---|---|---|---|
| Meadow | green | umber, brown, fawn | dusk greys | red, amber, black |
| Forest | dark green | umber, brown, dun | night greys | the same |
| Desert | fawn | brown, dun, amber | umber, brown, dun | the same |
| Snow | pale grey | grey, ash, white | dusk greys | the same |
| Marsh | olive | moss, olive, leaf | umber browns | the same |

A cell with ground, shade, outline, three body inks, a belly ink and an eye uses **six to eight inks**, and the demo counts them per cell. A whole quest world needs the same discipline across species: share the camo ramp among the prey, and spend the spare inks on one predator and one warning pair *(inference)*.

## Names that agree with the picture

Dwarf Fortress writes its generated beasts in a fixed pattern: a size word and a body plan, "composed of" a material; then feature sentences; then a warning. "A gigantic snail composed of grime and filth. It has an enormous shell and it squirms and fidgets. Beware its deadly spittle!" ([DF wiki](https://dwarffortresswiki.org/index.php/Forgotten_beast)). The pattern works because every word comes from a field of the creature.

The demo does the same. The color word is the name of the body's middle ink ("dun", "ash", "moss"), the features are the ones drawn (horned, long-tailed, hook-billed), the group size and active hours are the ones the herd demo uses, and the last sentence is the role's: countershading for prey, a hunting line for predators, "Beware its red-and-black back: it is bitter to eat" for the poisonous. A proper name comes from syllable tables (onset, vowel, coda). As on [the sprites page](sprites.md), where loot's name and picture agree, the genome is the single source and the words can't promise a horn the sprite lacks *(inference)*. In Elsewhere a Tyrell mind could be handed the description line as a fact it knows about the animal, so a villager names and describes the same creature the player sees *(inference)*.

## Moving together

### Boids

Craig Reynolds's boids (SIGGRAPH 1987) are still the model: each agent steers by three rules over its neighbors within a distance and an angle of its heading ([Reynolds](https://www.red3d.com/cwr/boids/)).

| Rule | Reynolds's wording |
|---|---|
| Separation | "steer to avoid crowding local flockmates" |
| Alignment | "steer towards the average heading of local flockmates" |
| Cohesion | "steer to move toward the average position of local flockmates" |

The naive cost is O(n²); "a spatial data structure" makes it nearly O(n) ([Reynolds](https://www.red3d.com/cwr/boids/)). His 1999 steering paper adds the vehicle and the behaviors a game needs. The vehicle is a point mass with `max_force` and `max_speed`, updated by clipping the steering force, dividing by mass, adding to velocity, clipping speed, and moving. The behaviors include seek, flee, pursuit and evasion (seek or flee where the target will be), arrival, obstacle avoidance, containment, wander, leader following and **flow field following**, where the desired velocity is the field's vector at the predicted position ([Reynolds 1999](https://www.red3d.com/cwr/steer/gdc99/)).

### Zones and states

Couzin and colleagues (2002) split the neighborhood into three zones: repulsion (radius r_r; if anyone is inside, only move away), orientation (width Δr_o) and attraction (width Δr_a). Their parameter ranges are a useful starting table ([Couzin et al. 2002](https://www.cs.princeton.edu/courses/archive/fall24/cos597C/bib/couzinKJRF.pdf)):

| Parameter | Range explored |
|---|---|
| Group size N | 10 to 100 |
| Repulsion radius r_r | 1 unit |
| Orientation and attraction widths | 0 to 15 units |
| Field of perception | 200 to 360° |
| Turning rate | 10 to 100° per second |
| Speed | 1 to 5 units per second |
| Error | 0 to 0.2 rad |
| Time step | 0.1 s |

As the orientation zone widens, the group snaps between four states: a **swarm** (attraction and repulsion, little alignment: midges), a **torus** (milling round an empty core: small orientation zone, large attraction zone), a **dynamic parallel** group and a **highly parallel** one. The state also depends on history, the "collective memory" of the title: the same parameters give a torus or a parallel group depending on what came before. One rule set with two or three weights therefore gives a game its insects, its milling fish and its marching herds *(inference)*. The herd demo runs bats as a swarm (no alignment) and fish as a parallel school.

### Seven neighbors

Ballerini and colleagues reconstructed starling flocks of up to 2,600 birds in 3D and found each bird interacts with about **six to seven nearest neighbors**, whatever the distance: interaction is topological, not metric. In their simulations, topological interaction held flocks together under disturbance better than a fixed radius ([Ballerini et al. 2008](https://web3.arxiv.org/abs/0709.1916)). For a game that's also a cost cap: stop after seven neighbors, and a dense flock costs no more per bird than a sparse one *(inference)*. The demo stops at seven inside a radius.

The famous dark waves through murmurations come from orientation, not density. Hemelrijk's StarDisplay model adds banking turns to the three rules; a bird that banks shows more wing, so an escape zigzag passed from neighbor to neighbor runs through the flock as a dark band, at about 13.4 m/s against the flock's 10.6 m/s ([Hemelrijk et al. 2015](https://link.springer.com/article/10.1007/s00265-015-1891-3), search summary). In pixels, that is a banked frame with a longer, darker wing, and a "banking" flag that spreads to neighbors for a few steps *(inference)*.

### Fleeing: the selfish herd

W. D. Hamilton's "Geometry for the selfish herd" (1971) gave each animal a **domain of danger**: its Voronoi cell, the ground nearer to it than to any other animal. If attacks start at random points, an animal's risk scales with that area, so each does best by moving toward its nearest neighbor, and the herd condenses. James, Krause and Bennett (2004) limited the domain to the predator's reach and found a time-minimizing rule beats nearest-neighbor. King and colleagues' GPS-collared sheep (2012) moved toward the flock's center when a sheepdog approached ([Wikipedia, Selfish herd theory](https://en.wikipedia.org/wiki/Selfish_herd_theory)).

The demo's flee rule is that, in three parts *(inference)*:

1. **Flee.** A deer within 26 px of a hunting wolf steers away, harder the closer it is, and its top speed rises from 6 to 38 px/s.
2. **Close up.** Its cohesion weight rises from 0.12 to 0.9, so the herd bunches as it runs (the selfish herd).
3. **Spread the alarm.** A deer that sees a frightened neighbor within 10 px takes on part of its fear and its heading, so the whole herd bolts, not just the deer nearest the wolf.

The wolf uses Reynolds's pursuit (seek where the quarry will be in 0.4 s) and tires after 4 seconds, so most chases fail.

<figure class="demo"><div class="stage" data-demo="herds"></div>
<figcaption><b>Herds, flocks and schools.</b> About 300 animals on one spatial hash: a herd of 26 deer, 170 starlings, 70 fish, 40 bats and three wolves, steered by boids with at most seven neighbors each. By day the herd grazes (stand with the head down, then a few steps) and the flock wheels over the meadow; at dusk the herd follows a flow field to the shore and drinks, and the flock gathers over the wood, then roosts in the trees; at night the herd beds down at the wood's edge, bats swarm over the pond, and the wolves leave their den to hunt. Drag the hour, or let the clock run. Tap with <i>Wolf</i> to drop a wolf into the herd and watch it scatter and bunch; tap with <i>Food</i> to drop a patch the grazers seek. <i>Flow field</i> shows the field the herd is following. Dusk and night are ramp-table reprints of the same palette, so light only selects inks.</figcaption></figure>

## The day's round

### Who is about when

Most mammals are nocturnal. Bennie and colleagues sorted **4,477 mammal species: 69% nocturnal, 20% diurnal, 8.5% cathemeral (active at any hour) and 2.5% crepuscular** (dawn and dusk). The nocturnal share is highest in arid regions, and cathemerality clusters in the northern Holarctic ([Bennie et al. 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4183310)). A game is mostly played by day, so it inverts the share and shows the diurnal species. Its night is where a quest's strangeness can live, and a desert world should have the most night life *(inference)*.

Dwarf Fortress gives each creature a time-of-day token, with hours ([DF wiki, creature tokens](https://dwarffortresswiki.org/index.php/DF2014:Creature_token)):

| Token | Appears (adventure mode) |
|---|---|
| `DIURNAL` | 6:00 to 20:00 |
| `NOCTURNAL` | after 22:05 and before 4:30 |
| `CREPUSCULAR` | dawn, 4:30 to 6:00, and evening |
| `MATUTINAL` | dawn only |
| `VESPERTINE` | evening only, about 20:00 to 22:05 |

Seasons work the same way, with `NO_SPRING`, `NO_SUMMER`, `NO_AUTUMN` and `NO_WINTER`. The generator's genome carries one of four activity words, and the herd demo reads them as states: grazing, drinking, roosting, sleeping, hunting.

### Water at dusk, and why real prey avoid it

The brief for the herd demo sends animals to water at dusk, which is the game convention. Real herbivores mostly drink by day. In Hwange, Valeix and colleagues found that lion-preferred prey avoided risky waterholes, that **every species avoided waterholes at night when lions were near**, and that animals spent longer drinking when the risk was high, because they kept looking up ([Valeix et al. 2009](https://hal.archives-ouvertes.fr/hal-00539421)). Most herbivores visit waterholes in daytime ([Valeix 2011](https://resolve.cambridge.org/core/journals/journal-of-tropical-ecology/article/temporal-dynamics-of-dryseason-waterhole-use-by-large-african-herbivores-in-two-years-of-contrasting-rainfall-in-hwange-national-park-zimbabwe/B04B450748E4C917CA57FA65EF2BAB7A)). A world that wants to feel real puts its predators by the water after dark and its grazers there in the heat of the day; a world that wants a picture puts everyone there at dusk. Either way, it is one table entry *(inference)*.

### Flow fields to water and to bed

A flow field is the cheap way to send many animals to one kind of place. Dijkstra runs from every goal cell outward; each cell then points at its lowest neighbor of eight; every agent heading there samples the same field. Big maps tile the field, as Supreme Commander 2 and Planetary Annihilation did ([howtorts](https://howtorts.github.io/2014/01/04/basic-flow-fields.html); Emerson, "Crowd Pathfinding and Steering Using Flow Field Tiles", *Game AI Pro 360*). Animals have few kinds of goals (water, bedding cover, the den), so a world needs **one field per kind of goal, built once when the map is made** *(inference)*. The demo builds two fields over 4-pixel cells (50×32), to the shore and to the wood's edge, in well under a millisecond, and the deer simply add the field's direction to their boids steering.

Grazing, sleeping and roosting are what make a herd look alive, and they're nearly free: they're states in which an animal *doesn't* move. In the demo a grazer alternates between standing with its head down for 1.5 to 5 s and walking for 0.4 to 1.4 s. A sleeper lies down only where no other sleeper is within 6 px, so the herd beds as a spread group rather than a pile. Each starling is given one perch on one tree, flies to it as night falls and sits still until dawn.

Rain World adds the piece that keeps an ecosystem from looking scripted: creatures carry optional AI modules (PreyTracker, ThreatTracker, FriendTracker, ItemTracker, a DenFinder for "a home base to return to after certain tasks", a DiscomfortTracker), and each has "a table cataloging its relationships to other creatures, objects, and locations" ([Unity blog](https://unity.com/blog/exploring-procedural-design-rain-world)). Emergence still needed tuning. One creature fixated on tiny worms and ignored the player, and the team "eventually gave in and created a tool where certain rooms could be assigned as more attractive to certain creatures" (same source). Its designers ran regions 15 to 20 times to tune pathing, and say "outside of your frame they're all still alive" ([Game Developer](https://gamedeveloper.com/design/crafting-the-complex-chaotic-ecosystem-of-i-rain-world-i-)). For Elsewhere, a relationship table (eats, fears, follows, ignores) per species pair, plus attractiveness per place, is the right size *(inference)*.

## Who lives where

Two shipped systems give a complete, copyable model of placement.

**Dwarf Fortress** keeps it in each creature's raws ([DF wiki, creature tokens](https://dwarffortresswiki.org/index.php/DF2014:Creature_token)):

| Token | Meaning |
|---|---|
| `BIOME` (any number) | A biome the creature may appear in |
| `FREQUENCY` (0 to 100, default 50) | A weight: "uses the FREQUENCY value as a weight" |
| `POPULATION_NUMBER:min:max` | How many per world-map tile of its region (default 1:1) |
| `CLUSTER_NUMBER:min:max` | How many per spawned group (default 1:1) |
| `LOOSE_CLUSTERS` | Scatter rather than form tight packs |
| `UBIQUITOUS` | In every region with the right biome |
| `LARGE_PREDATOR`, `BENIGN`, `MEANDERER` | Attacks smaller things; non-aggressive; "slowly stroll around" |
| `VERMIN_SOIL`, `VERMIN_FISH`, `VERMIN_ROTTER` | Small things near dirt, in water, at rot and loose food |

**Minecraft** keeps it in each biome's weighted spawn list and in caps ([Minecraft Wiki](https://minecraft.wiki/w/Mob_spawning)):

| Rule | Java Edition value |
|---|---|
| Caps per category | monster 70, creature 10, ambient 15, water creature 5, water ambient 20 |
| Global cap | cap × chunks ÷ 289 (a 17×17-chunk square per player) |
| Spawn attempts | every tick for hostiles; every 400 ticks (20 s) for animals |
| Where | within 128 blocks of a player, never within 24 |
| Light | animals need light 9 or more |
| Packs | most up to 4; horses 2 to 6; wolves and cod up to 8; members within ±5 blocks |
| New chunks | animals seeded once, with chance 0.1 per chunk (badlands 0.03, snowy 0.07), ignoring the caps |

The two differ in one useful way *(inference)*. Dwarf Fortress places animals as **a property of the world** (per region, at worldgen), so a place always has its animals. Minecraft spawns them **near the player** under a cap, so the count stays small however big the world is. An Elsewhere quest is small, so the Dwarf Fortress way fits: place every animal when the world is made, from the seed, and save nothing but the seed and what the player changed.

Red Dead Redemption 2 shows how far the idea scales. It has about 200 species of animals, birds and fish that "form part of a complex ecosystem and must continually fight for their place on the food chain" (Rockstar, via [Twinfinite](https://twinfinite.net/news/red-dead-redemption-2-hunting-fishing-wildlife/)). Scavengers come to carcasses, not only to bait ([GamesRadar](https://www.gamesradar.com/red-dead-redemption-2-horse-permadeath), search summary), and players of it later named real wildlife better than non-players did ([University of Exeter](https://news-archive.exeter.ac.uk/2021/july/articles/reddeadredemption2teaches.html)). No public account of its spawning rules was found. Far Cry 4's talk covers the other half, moving quadrupeds over rocky ground with "additive animation, environment detection, IK and character physics" ([GDC Vault](https://www.gdcvault.com/play/1022027/Grounding-Wildlife-in-the-Mountains)).

## How many

Three rules of thumb set the numbers, and a fourth, the predator-prey cycle, sets how they change.

| Rule | Finding | In a generator *(inference)* |
|---|---|---|
| Ten percent (Lindeman 1942) | About 10% of a trophic level's energy passes to the next; Lindeman himself cited efficiencies from 0.1% to 37.5% and never called it a law ([Wikipedia](https://en.wikipedia.org/wiki/Raymond_Lindeman); [EBSCO](https://www.ebsco.com/research-starters/history/lindemans-trophic-dynamic-aspect-ecology-published)) | Each level up the food chain holds about a tenth the biomass of the one below |
| Carnivores per prey (Carbone and Gittleman 2002) | About **90 kg of a carnivore species per 10,000 kg of its prey**, whatever the carnivore's size, across 25 species (search summary; [core.ac.uk](https://core.ac.uk/download/80881394.pdf)) | Predator count = 0.009 × prey biomass ÷ predator mass |
| Density by size (Damuth 1981) | Over 307 herbivorous mammals, population density falls as mass^−0.75, so a population's energy use is roughly independent of body size ([Damuth 1981](https://pdodds.w3.uvm.edu/files/papers/others/1981/damuth1981a.pdf)); later work contests the "energetic equivalence" reading | Plant eaters per cell of habitat ∝ mass^−0.75 |
| Cycles (Krebs et al. 2001) | The Hudson's Bay Company lynx fur returns, 1821 to 1910, cycle every **9.6 years** on average; every hare predator's numbers "lagged behind the hare cycle 1–2 years"; "predation is clearly the dominant process", and food acts indirectly ([Krebs et al. 2001](https://www.zoology.ubc.ca/~krebs/papers/180.pdf)) | A predator-prey model with a food limit, stepped once per season, over the off-screen populations |

Put together, a meadow's species list nearly writes itself. A 60 kg grazer is about 13 times rarer per cell than a 2 kg hare (30^0.75), a lizard of 80 g is about 140 times commoner than the grazer, and a wolf pack exists only if the prey biomass reaches thousands of kilograms. The ecology demo shows the consequence: on a typical seed, thousands of hares and skinks, dozens of grazers, and **two wolves**. Predators are rare not by design choice but because the arithmetic says so, and the rarity is what makes meeting one an event *(inference)*.

The cycle is the classic Lotka–Volterra pair, dx/dt = αx − βxy and dy/dt = δxy − γy, whose solutions orbit forever ([Wikipedia](https://en.wikipedia.org/wiki/Lotka%E2%80%93Volterra_equations)). Krebs's paper notes the hare cycle is "often cited as one of the few examples" of it. Giving the prey a food limit (logistic growth toward K) and the predator a saturating appetite makes the Rosenzweig–MacArthur model, which settles to a steady state when food is scarce and cycles when food is plentiful: raising K destabilizes it, Rosenzweig's "paradox of enrichment" (1971; [Wikipedia](https://en.wikipedia.org/wiki/Paradox_of_enrichment)). The demo's slider shows exactly that. With parameters tuned for it (prey growth 2.7 a year, a 15% seasonal swing), the cycle comes out at about **eight to nine years**, near the lynx records' 9.6. Explicit Euler steps spiral outward on these equations, so step them small (the demo uses 0.002 years) or semi-implicitly.

Migration is the seasonal version of placement. Merkle and colleagues tracked 10 populations of five species (bighorn sheep, mule deer, elk, moose and bison) and found they time their spring movements to the wave of green-up ([Merkle et al. 2016](https://escholarship.org/content/qt9pp289d2/qt9pp289d2.pdf)). Aikens and colleagues later found 98% of mule deer "surfed" better than random and 31% as well as a perfect surfer (search summary). A game can do this with one moving field: each species' habitat score gains a term for "greenness" that sweeps uphill through spring, and the herds' flow field follows the best cells *(inference)*.

<figure class="demo"><div class="stage" data-demo="ecology"></div>
<figcaption><b>Who lives where, and how many.</b> Biomes from height and moisture, and eight species placed by rules in the manner of Dwarf Fortress's creature tokens: which biomes, a height range, how far from water, a cluster size. Plant eaters are counted by Damuth's rule (density as mass<sup>−0.75</sup>), meat eaters by Carbone and Gittleman's (90 kg per 10,000 kg of prey), so wolves come out rare. The pyramid shows the biomass at each level on a log scale; the graph runs hares and lynx over forty years of seasons with a food limit. Raise <i>Food for hares</i> and the steady state breaks into ever wilder cycles, the paradox of enrichment. Tap a species to see only it; tap the map to see who can live there and why.</figcaption></figure>

## What it costs on a phone

Measured in the demos (Chrome on a laptop; a phone is about two to four times slower, as [Real geography](geography.md#what-fits-on-a-phone-and-what-to-precompute) found for its own pipeline):

| Work | Cost | When |
|---|---|---|
| One creature genome | about 0.008 ms | when a world is made |
| Its four frames, painted to indexes | about 0.14 ms | once per species, into a sheet (pre-bake) |
| One boids step for about 300 animals on an 8-pixel grid, seven neighbors each | **0.2 to 0.5 ms** | every step, 30 a second |
| Two flow fields (Dijkstra over 50×32 cells) | well under 1 ms | when the map is made, or when it changes |
| Placement of thousands of animals by rules | a few ms | when the world is made |
| A seasonal predator-prey step | microseconds | once per in-game day or season |

Other plain-JS measurements agree. A grid-free boids library ran 1,000 boids at 60 fps on a MacBook, but its ticks per second fell from about 34,000 at 50 boids to 95 at 1,000, the O(n²) wall ([hughsk/boids](https://github.com/hughsk/boids)). Grids sized to the vision radius, with linked-list cells (a head per cell, a next per agent), carry thousands. Projects that reach 10,000 and more move the neighbor search to WebGPU or WebAssembly (search summaries).

<div class="finding"><p>A few hundred animals fit a phone frame many times over: boids on a uniform grid with a cap of seven neighbors cost well under a millisecond per step in plain JS. The expensive parts, painting bodies and building flow fields, happen once per world. Only animals near the player need simulating as individuals; the rest can be counts per region, stepped once a season.</p></div>

The last row of that table is the important design choice *(inference)*. A quest world holds its animals as **individuals near the player and counts everywhere else**, the way Minecraft spawns near the player and Rain World keeps creatures "still alive" outside the frame. When the player walks into a region, its counts become individuals placed by the rules from the seed; when they leave, the individuals fold back into counts.

## What it means for Tycho

Nothing here needs new rendering; it needs a few data-shaped parts *(inference throughout)*:

- **`fauna`** (world layer): a species table as plain data (biomes with weights, height and water-distance ranges, cluster sizes, mass, level, activity, eats and fears lists), a placement pass from the seed that reads [the geography page's](geography.md) fields, and counts by the three rules above with a game-supplied scale. A Rosenzweig–MacArthur step over region counts, with the game's own parameters. Dwarf Fortress's tokens are the field list to copy.
- **`flock`** (play layer): a uniform grid with heads and next links, reused per species; Reynolds's vehicle and steering behaviors (separate, align, cohere with a neighbor cap; seek, flee, pursue, evade, wander, containment, follow a field); weights per species as parameters, so swarm, torus and parallel are presets, not code. It builds on `field` (wave 1) for flow fields, which `field` already plans as flood and Dijkstra.
- **`creature`** (pixels layer): the genome and its painters for a few body plans, drawing into material slots like `kit`'s, so the biome's ramps print them, and a four-frame loop per plan, baked by `bake`. The words are part of it, as `kit`'s items are tied to their names. It is a sibling of `mask` and `figure`, and an `anim` gait (duty factor and phase per leg group, Spore's model) can drive the IK creature on [Motion](motion.md) for a hero animal.
- **Time of day** stays outside: an activity word per species and a game clock decide states, and the light is [the light page's](light.md) ramp-table reprint, as in the herd demo.

The roadmap's `kit`, `anim`, `field` and `gen` already cover the ground these sit on; `fauna` and `flock` are new and small, and a quest of grazing animals, a fish pond or a flock to herd would be their first user.

## Sources

- Craig Reynolds: [Boids](https://www.red3d.com/cwr/boids/) and [Steering Behaviors For Autonomous Characters (GDC 1999)](https://www.red3d.com/cwr/steer/gdc99/)
- Hecker et al., Real-time Motion Retargeting to Highly Varied User-Created Morphologies, ACM TOG 27(3), 2008: [author's page](https://www.chrishecker.com/Real-time_Motion_Retargeting_to_Highly_Varied_User-Created_Morphologies), [PDF](https://www.cse.chalmers.se/edu/year/2011/course/TDA361/Advanced%20Computer%20Graphics/027-hecker%20copy.pdf); [Spore tutorials](https://www.spore.com/comm/tutorials/hero_creature_creation)
- No Man's Sky: [Kotaku on the creature data](https://kotaku.com/a-look-at-how-no-mans-skys-procedural-generation-works-1787928446)
- Starbound: [Ruud Schouten, procedural creatures](https://ruudschouten.github.io/post/procedural-creatures)
- Dwarf Fortress wiki: [Forgotten beast](https://dwarffortresswiki.org/index.php/Forgotten_beast), [Creature token](https://dwarffortresswiki.org/index.php/DF2014:Creature_token)
- Rain World: [Unity blog](https://unity.com/blog/exploring-procedural-design-rain-world), [Game Developer](https://gamedeveloper.com/design/crafting-the-complex-chaotic-ecosystem-of-i-rain-world-i-)
- Red Dead Redemption 2: [Twinfinite](https://twinfinite.net/news/red-dead-redemption-2-hunting-fishing-wildlife/), [GamesRadar](https://www.gamesradar.com/red-dead-redemption-2-horse-permadeath), [University of Exeter](https://news-archive.exeter.ac.uk/2021/july/articles/reddeadredemption2teaches.html), [GDC 2020 talk](https://gdconf.com/news/learn-how-rockstar-breathed-life-wildlife-red-dead-redemption-2-gdc)
- Far Cry 4: [Grounding Wildlife in the Mountains (GDC 2015)](https://www.gdcvault.com/play/1022027/Grounding-Wildlife-in-the-Mountains)
- [Minecraft Wiki, Mob spawning](https://minecraft.wiki/w/Mob_spawning)
- Couzin, Krause, James, Ruxton and Franks, Collective Memory and Spatial Sorting in Animal Groups, J. Theor. Biol. 218, 2002 ([PDF](https://www.cs.princeton.edu/courses/archive/fall24/cos597C/bib/couzinKJRF.pdf))
- Ballerini et al., Interaction ruling animal collective behavior depends on topological rather than metric distance, PNAS 105(4), 2008 ([arXiv 0709.1916](https://web3.arxiv.org/abs/0709.1916))
- Hemelrijk et al., What underlies waves of agitation in starling flocks, Behav. Ecol. Sociobiol., 2015 ([Springer](https://link.springer.com/article/10.1007/s00265-015-1891-3))
- Hamilton, Geometry for the selfish herd, J. Theor. Biol. 31, 1971 ([Wikipedia summary](https://en.wikipedia.org/wiki/Selfish_herd_theory))
- Flow fields: [howtorts](https://howtorts.github.io/2014/01/04/basic-flow-fields.html); Emerson, Crowd Pathfinding and Steering Using Flow Field Tiles, Game AI Pro 360
- [hughsk/boids](https://github.com/hughsk/boids)
- McMahon and Biewener on scaling: [arXiv physics/0303074](https://arxiv.org/abs/physics/0303074), [Biewener 2005](https://cob.silverchair.com/jeb/article-split/208/9/1665/9381/Biomechanical-consequences-of-scaling); Froude number: [JEB](https://cob.silverchair.com/jeb/article-pdf/1883454/3200.pdf)
- Countershading: [Wikipedia](https://en.wikipedia.org/wiki/Countershading), [Rowland 2009](https://pmc.ncbi.nlm.nih.gov/articles/PMC2674085), [Cuthill et al. 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5135326); aposematism: [Mappes, Marples and Endler 2005](https://researchonline.jcu.edu.au/29248/), [Frontiers 2014](https://www.frontiersin.org/journals/ecology-and-evolution/articles/10.3389/fevo.2014.00025/pdf)
- Bennie, Duffy, Inger and Gaston, Biogeography of time partitioning in mammals, PNAS 111(38), 2014 ([PMC4183310](https://pmc.ncbi.nlm.nih.gov/articles/PMC4183310))
- Valeix et al. 2009 ([HAL](https://hal.archives-ouvertes.fr/hal-00539421)) and Valeix 2011 ([J. Trop. Ecol.](https://resolve.cambridge.org/core/journals/journal-of-tropical-ecology/article/temporal-dynamics-of-dryseason-waterhole-use-by-large-african-herbivores-in-two-years-of-contrasting-rainfall-in-hwange-national-park-zimbabwe/B04B450748E4C917CA57FA65EF2BAB7A))
- Lindeman 1942: [Wikipedia](https://en.wikipedia.org/wiki/Raymond_Lindeman), [EBSCO](https://www.ebsco.com/research-starters/history/lindemans-trophic-dynamic-aspect-ecology-published); Carbone and Gittleman 2002 ([core.ac.uk](https://core.ac.uk/download/80881394.pdf)); Damuth 1981 ([PDF](https://pdodds.w3.uvm.edu/files/papers/others/1981/damuth1981a.pdf))
- Krebs, Boonstra, Boutin and Sinclair, What Drives the 10-year Cycle of Snowshoe Hares?, BioScience 51(1), 2001 ([PDF](https://www.zoology.ubc.ca/~krebs/papers/180.pdf)); [Lotka–Volterra equations](https://en.wikipedia.org/wiki/Lotka%E2%80%93Volterra_equations), [paradox of enrichment](https://en.wikipedia.org/wiki/Paradox_of_enrichment)
- Merkle et al., Large herbivores surf waves of green-up during spring, Proc. R. Soc. B 283, 2016 ([eScholarship](https://escholarship.org/content/qt9pp289d2/qt9pp289d2.pdf))

The full research is in [the animals note](notes/animals_creatures_ecology.md).

<script src="demos/kit.js"></script>
<script src="demos/animals-shared.js"></script>
<script src="demos/creatures.js"></script>
<script src="demos/herds.js"></script>
<script src="demos/ecology.js"></script>
<script src="demos/start.js"></script>
