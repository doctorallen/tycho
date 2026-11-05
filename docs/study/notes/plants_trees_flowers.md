# Procedural generation of plants, trees and flowers, especially as pixel art

Notes compiled 2026-11-03 for the Tycho engine roadmap. Target: plain JavaScript, sprites about 8 to 96 px tall, painted once offscreen into palette-indexed buffers, deterministic seeds. Primary sources were read in full where possible: the ABOP PDF, the Runions et al. 2007 paper, the Weber and Penn 1995 paper (text extracted locally), Saint11's vegetation tutorial images, Slynyrd's Pixelblogs and Wikipedia species pages. Botanical facts for palms, cacti, ground cover and flowers were gathered by helper researchers and are marked **[S]** where they came from a search summary and not a fetched page. Engineering advice that is my own synthesis sits under **Inferences**, not **Cited Findings**.

## 1. Algorithms: L-systems, space colonization, particle flow, recursive branching with tropism, phyllotaxis, Hallé–Oldeman models, SpeedTree/Tree It, Weber–Penn

### Takeaway
For 8 to 96 px sprites, the best fit is a **parametric recursive brancher** (Weber–Penn / Honda style: per-level child count, down angle, divergence/rotate angle, length ratio, taper, curvature, and a vertical "AttractionUp" term that gives drooping when negative) feeding a **crown-envelope function** (Weber–Penn's 8 ShapeRatio curves). Leaves are then **stamped as clusters** at branch tips. Space colonization is the best tool for broadleaf crowns that must fill a silhouette exactly, and it is cheap at pixel scale (hundreds, not thousands, of attraction points). L-systems are compact and fast but follow a target silhouette poorly. Phyllotaxis (137.5°, r = c√n) drives sunflower heads, daisies, rosettes (agave, aloe) and the spiral placement of branches.

### Cited Findings

**L-systems (Prusinkiewicz and Lindenmayer, *The Algorithmic Beauty of Plants*, 1990)**
- Bracketed turtle symbols: F draws forward; + and − turn by δ; `[` pushes position and heading onto a stack; `]` pops them. X is a non-drawing symbol that only controls growth. The Wikipedia "fractal plant" is axiom `-X`, rules `X → F+[[X]-X]-F[-FX]+X`, `F → FF`, angle 25°. — [Wikipedia: L-system](https://en.wikipedia.org/wiki/L-system)
- Variants: **stochastic** (one symbol, several rules with probabilities, e.g. `0 (0.5) → 1[0]0`, `0 (0.5) → 0`); **parametric** (symbols carry parameters such as `a(x,y)` that rules test and modify, so lengths and angles can come from the grammar); **context-sensitive** (`b < a > c → aa`). — [Wikipedia: L-system](https://en.wikipedia.org/wiki/L-system)
- ABOP Fig. 1.24, six classic 2D plants (n = derivation steps, δ = angle):
  - (a) n=5, δ=25.7°, `F → F[+F]F[-F]F`
  - (b) n=5, δ=20°, `F → F[+F]F[-F][F]`
  - (c) n=4, δ=22.5°, `F → FF-[-F+F+F]+[+F-F-F]`
  - (d) n=7, δ=20°, `X → F[+X]F[-X]+X`, `F → FF`
  - (e) n=7, δ=25.7°, `X → F[+X][-X]FX`, `F → FF`
  - (f) n=5, δ=22.5°, `X → F-[[X]+X]+F[+FX]-X`, `F → FF`
  
  (a) to (c) are edge-rewriting and (d) to (f) node-rewriting. — [ABOP PDF, ch. 1.6](http://algorithmicbotany.org/papers/abop/abop.pdf)
- **Honda's monopodial tree** as a parametric L-system: `n=10, r1=0.9` (trunk contraction), `r2=0.6` (branch contraction), `a0=45` (branch angle from trunk), `a2=45` (lateral branch angle), `d=137.5` (divergence), `wr=0.707` (width decrease). Rules: `ω: A(1,10)`; `A(l,w) → !(w)F(l)[&(a0)B(l*r2,w*wr)]/(d)A(l*r1,w*wr)`; `B(l,w) → !(w)F(l)[-(a2)$C(l*r2,w*wr)]C(l*r1,w*wr)`; `C(l,w) → !(w)F(l)[+(a2)$B(l*r2,w*wr)]B(l*r1,w*wr)`. — [ABOP, Fig. 2.6](http://algorithmicbotany.org/papers/abop/abop.pdf)
- wr = 0.707 = 1/√2 follows Leonardo da Vinci's rule that "all the branches of a tree at every stage of its height when put together are equal in thickness to the trunk below them". For two equal daughters, w1² = 2·w2². — [ABOP p.57](http://algorithmicbotany.org/papers/abop/abop.pdf)
- **Sympodial trees (Aono and Kunii)**: `A(l,w) → !(w)F(l)[&(a1)B(l*r1,w*wr)]/(180)[&(a2)B(l*r2,w*wr)]`. ABOP Table 2.2 gives four parameter sets for (r1, r2, a1, a2): (0.9, 0.7, 5, 65), (0.9, 0.7, 10, 60), (0.9, 0.8, 20, 50), (0.9, 0.8, 35, 35). — [ABOP, Fig. 2.7 and Table 2.2](http://algorithmicbotany.org/papers/abop/abop.pdf)
- **Tropism**: after each segment, rotate the turtle heading H toward a tropism vector T by α = e·|H × T|, where e is the axis's "susceptibility to bending" (a torque analogy). For ternary trees, ABOP Table 2.3 uses T = (0, −1, 0) (gravity) with e = 0.14 to 0.27. The ternary tree uses divergence angles d1=94.74°, d2=132.63°, branch angle 18.95°, elongation lr=1.109 and width increase vr=1.732 (√3, for three equal daughters). — [ABOP pp.58-61](http://algorithmicbotany.org/papers/abop/abop.pdf)

**Space colonization (Runions, Lane and Prusinkiewicz 2007)**
- The input is a crown envelope, which only needs an inside/outside test; the paper used a surface of revolution. The envelope is seeded with N attraction points ("usually hundreds or thousands"), and the tree starts from a single node at the base. — [Runions et al. 2007](http://algorithmicbotany.org/papers/colonization.egwnp2007.pdf)
- Each iteration:
  1. Each attraction point influences the **closest** tree node, if it lies within the radius of influence di.
  2. For node v with influence set S(v), a new node is placed at v′ = v + D·n̂, where n̂ = normalize(Σ normalize(s − v)).
  3. Optionally the direction is biased by a vector g (weight plus tropism): ñ = normalize(n̂ + g).
  4. Every point with a node closer than the kill distance dk is removed.
  
  It stops when no points are left, none are in range, or an iteration cap is hit. — [Runions et al. 2007](http://algorithmicbotany.org/papers/colonization.egwnp2007.pdf)
- Branch radius follows the pipe model, computed from the tips toward the base: rⁿ = r1ⁿ + r2ⁿ, with n "usually between 2 and 3". All tips start at radius r0. — [Runions et al. 2007](http://algorithmicbotany.org/papers/colonization.egwnp2007.pdf)
- Parameter effects (Fig. 3; dk is expressed in units of D):
  - Lower N and higher dk give sparser crowns. Low N gives irregular branches, because one point more or less can swing a tip.
  - Large dk gives smoothly curved branches. The four combinations shown: N=12000, dk=2D; N=1500, dk=2D; N=12000, dk=20D; N=375, dk=20D.
  - Smaller di makes tips "meander" into a "wiggly or gnarly appearance". Shrubs used di=∞ vs 17D; trees used di=∞ vs 8D.
  
  — [Runions et al. 2007](http://algorithmicbotany.org/papers/colonization.egwnp2007.pdf)
- Narrow envelopes (columnar, conical) produce a clear trunk (excurrent). Wide envelopes give highly ramified main limbs (decurrent). This is "an emergent property". — [Runions et al. 2007](http://algorithmicbotany.org/papers/colonization.egwnp2007.pdf)
- Other controls:
  - Putting points only near the envelope gives an open shrub with twigs on the surface.
  - Dart-throwing (blue-noise) points, with more points added during growth at shrinking spacing, gives a hierarchy of twig sizes like a mature tree.
  - Removing points behind obstacles makes plants avoid walls. Several seeds in one point cloud form a competing hedge.
  
  — [Runions et al. 2007](http://algorithmicbotany.org/papers/colonization.egwnp2007.pdf)
- Post-process: moving each node halfway toward its basal neighbor reduces branching angles "and can have a significant impact on the overall appearance". — [Runions et al. 2007](http://algorithmicbotany.org/papers/colonization.egwnp2007.pdf)
- Limitation: the authors "were not able to generate strongly pendulous, 'weeping' trees with this approach". — [Runions et al. 2007](http://algorithmicbotany.org/papers/colonization.egwnp2007.pdf)

**Particle flow and resource-flow "growth" simulations**
- **Particle flow**: fill the crown volume with particles. Each step they move under gravity plus mutual attraction (force ∝ mᵢmⱼ/distance) with semi-implicit Euler at Δt = 10 ms. Particles that come close merge (mass-weighted position and velocity), and their trajectories become branches. A new branch starts when a particle has passed a minimum distance from the last one. — [Nuić et al., MIPRO 2019](https://www.zemris.fer.hr/~zeljkam/radovi/19_Mipro_Nuic.pdf)
- Same paper's comparison:
  - L-systems are fastest and easy to extend with new rules, but follow a target model worst.
  - Particle flow is slowest and makes fewer branch intersections than space colonization.
  - Particle flow has "many parameters that need to be fine-tuned", and branch depth is hard to predict because growth runs from the leaves to the trunk.
  
  — [Nuić et al. 2019](https://www.zemris.fer.hr/~zeljkam/radovi/19_Mipro_Nuic.pdf)
- **Transport-oriented growth** (Nick McDonald 2020): each step a branch receives "feed".
  - A leaf branch grows length by `cbrt(feed)`, puts the rest into girth, and splits when length > `splitsize·exp(−splitdecay·depth)`.
  - At a split, feed is divided by `ratio` (A gets feed·ratio, B gets feed·(1−ratio)). "Heavier branches tend to continue straight while light branches will be more perpendicular". Very asymmetric ratios mimic evergreens.
  - `spread` weights perpendicular vs straight growth. `directedness` steers away from leaf density, mixed with noise.
  - Leaf particle clouds are seeded by a hash of the branch ID (child IDs 2·ID and 2·ID+1), so leaves stay stable as the tree grows.
  
  — [nickmcd.me](https://nickmcd.me/2020/10/19/transport-oriented-growth-and-procedural-trees/)

**Phyllotaxis**
- Vogel's formula: φ = n·137.5°, r = c·√n, where n counts outward from the center. A divergence of 137.3° or 137.6° instead of 137.5° visibly breaks the pattern (ABOP Fig. 4.2). The golden angle is 360°·τ⁻² ≈ 137.5°. — [ABOP ch. 4.1](http://algorithmicbotany.org/papers/abop/abop.pdf); [Wikipedia: Fermat's spiral](https://en.wikipedia.org/wiki/Fermat%27s_spiral)
- ABOP's sunflower L-system is `A(n) → +(137.5)[f(n^0.5)C(n)]A(n+1)`, with organ type chosen by index (e.g. disk florets for n ≤ 440, then other organs, then ray petals for larger n). — [ABOP p.~103](http://algorithmicbotany.org/papers/abop/abop.pdf)
- Sunflower disks usually show 34 and 55 spirals (89 and 144 on very large heads). — [Wikipedia: Helianthus annuus](https://en.wikipedia.org/wiki/Helianthus_annuus)
- The same 137.5° divergence places lateral organs and branches along a stem in ABOP's models (e.g. `[&(70)L]/(137.5)`). — [ABOP](http://algorithmicbotany.org/papers/abop/abop.pdf)

**Hallé–Oldeman architectural models** (Hallé, Oldeman and Tomlinson 1978, *Tropical Trees and Forests*; 23 models, named after botanists)
- The key sorts trees by branched or unbranched; monopodial or sympodial; orthotropic (upright) or plagiotropic (horizontal) axes; rhythmic or continuous growth; and terminal or lateral flowering. — [LibreTexts illustrated key](https://bio.libretexts.org/Bookshelves/Evolutionary_Developmental_Biology/Key_to_the_Diversity_and_History_of_Life_(Shipunov)/04:_Geography_of_Life/4.02:_Architectural_Models_of_Tropical_Trees-_Illustrated_Key)
- The models, from the same key:

| Model | Defining traits | Example species |
|---|---|---|
| Holttum | unbranched, terminal inflorescence (flowers once and dies) | talipot palm *Corypha* |
| Corner | unbranched, lateral inflorescences | coconut, oil palm, papaya, cycad (female) |
| Tomlinson | branches from the base (often underground), orthotropic | banana, date palm |
| Schoute | equal dichotomous forking of the apex | doum palm *Hyphaene*, nipa |
| Chamberlain | sympodial, one module on another, looks unbranched | male *Cycas*, *Cordyline* |
| Leeuwenberg | sympodial, 2+ equal branches per module, terminal flowers | dragon tree *Dracaena draco*, castor bean, cassava |
| McClure | basal branching makes new (underground) trunks | bamboo, Japanese knotweed |
| Koriba | equal sympodial modules, one later becomes the trunk | sandbox tree *Hura* |
| Prévost | unequal modules, trunk module appears later | poinsettia, *Alstonia* |
| Fagerlind | monopodial trunk, rhythmic growth, sympodial plagiotropic branches | *Magnolia grandiflora*, *Cornus alternifolia* |
| Petit | monopodial trunk, continuous growth | cotton |
| Nozeran | trunk is a sympodium of orthotropic modules, plagiotropic tiers | cacao |
| Aubréville | monopodial rhythmic trunk, plagiotropic tiers by apposition (pagoda) | tropical almond *Terminalia catappa* |
| Massart | monopodial trunk, rhythmic tiers of plagiotropic branches | Norfolk Island pine *Araucaria*, kapok *Ceiba pentandra*, nutmeg |
| Roux | continuous trunk, long-lived plagiotropic branches | coffee, Brazil nut |
| Cook | plagiotropic branches short-lived, leaf-like (shed whole) | *Castilla elastica* |
| Scarrone | orthotropic sympodial branches on a rhythmic trunk | mango, *Pandanus vandamii* |
| Stone | as Scarrone but continuous trunk | *Pandanus pulcher* |
| Rauh | monopodial, all axes orthotropic, rhythmic, lateral flowers (most temperate conifers/broadleaves) | Caribbean pine, rubber tree |
| Attims | as Rauh but continuous growth | red mangrove *Rhizophora racemosa* |
| Mangenot | axes orthotropic at base then plagiotropic outward | *Strychnos variabilis* |
| Champagnat | all axes orthotropic, later bend under their own weight (arching) | bougainvillea |
| Troll | all axes plagiotropic, later erect; trunk built from bent axes | soursop, carambola, flamboyant *Delonix regia* |

- The key also says woody climbers such as ivy (*Hedera helix*) fit no tree model. — [LibreTexts key](https://bio.libretexts.org/Bookshelves/Evolutionary_Developmental_Biology/Key_to_the_Diversity_and_History_of_Life_(Shipunov)/04:_Geography_of_Life/4.02:_Architectural_Models_of_Tropical_Trees-_Illustrated_Key)
- Secondary sources call Massart the "Abies type" and Attims the "Cupressus type". The "23 models" count varies because two models (McClure and one other) are sometimes left out of formal treatments. — [search summary, ResearchGate HAM figure](https://www.researchgate.net/figure/Illustrations-of-the-HAMs-proposed-by-Halle-et-al-1978-A-Massart-B-Rauh-C_fig3_323297524); [L-system/Petri net characterization of the models](https://algorithmicbotany.org/papers/catm.tree2000.pdf)

**Weber and Penn, "Creation and Rendering of Realistic Trees" (SIGGRAPH 1995)**, the basis of Blender's Sapling
- Blender's Sapling Tree Gen manual credits its method to this paper. — [Blender manual: Sapling Tree Gen](https://www.blender.org/manual/en/addons/add_curve/sapling.html)
- Parameters are given per recursion level (0 = trunk, 1 to 3 = branch levels, written nX):

| Parameter | Meaning |
|---|---|
| Shape | crown-shape curve id |
| BaseSize | fraction of the trunk with no branches (bare lower trunk) |
| Scale, ScaleV, ZScale, ZScaleV | tree size and its variation |
| Levels | recursion depth (usually 3 or 4) |
| Ratio, RatioPower | radius/length ratio; child radius = parent·(childLen/parentLen)^RatioPower |
| Lobes, LobeDepth | sinusoidal ridges in the trunk cross-section |
| Flare | exponential widening at the base |
| nLength, nLengthV | child length as a fraction of the parent |
| nTaper | 0–1 cone taper, 1–2 spherical ends, 2–3 periodic (nodes) |
| nBaseSplits, nSegSplits, nSplitAngle(V) | forks (dichotomous clones) per segment |
| nCurveRes, nCurve, nCurveBack, nCurveV | segments per stem, total bend, S-curve back-bend, random wiggle |
| nDownAngle(V) | angle of a child from its parent's axis |
| nRotate(V) | spiral (divergence) angle between successive children; negative means alternate sides |
| nBranches | children per parent |
| Leaves, LeafShape, LeafScale, LeafScaleX | leaves per parent at the last level; negative Leaves gives fan mode (palms) |
| AttractionUp | upward bend for sub-branches; negative means drooping |
| PruneRatio, PruneWidth, PruneWidthPeak, PrunePowerLow/High | prune to a custom envelope |

  — [Weber and Penn 1995 PDF, appendix](https://courses.cs.duke.edu/fall02/cps124/resources/p119-weber.pdf)
- **ShapeRatio(shape, r)** gives the relative branch length at normalized height r:

| Shape | ShapeRatio(r) |
|---|---|
| 0 conical | 0.2 + 0.8r |
| 1 spherical | 0.2 + 0.8·sin(πr) |
| 2 hemispherical | 0.2 + 0.8·sin(0.5πr) |
| 3 cylindrical | 1.0 |
| 4 tapered cylindrical | 0.5 + 0.5r |
| 5 flame | r/0.7 for r ≤ 0.7, (1−r)/0.3 above |
| 6 inverse conical | 1 − 0.8r |
| 7 tend flame | 0.5 + 0.5·r/0.7 for r ≤ 0.7, 0.5 + 0.5·(1−r)/0.3 above |
| 8 envelope | the pruning envelope |

  First-level branch length = trunkLen·nLength·ShapeRatio(Shape, (trunkLen − offset)/(trunkLen − baseLen)). — [Weber and Penn 1995](https://courses.cs.duke.edu/fall02/cps124/resources/p119-weber.pdf)
- Down angle can vary along the parent: if nDownAngleV < 0, downAngle = nDownAngle ± nDownAngleV·(1 − 2·ShapeRatio(0, …)). Branches near the top then angle upward and those near the bottom downward, as in the Black Tupelo. — [Weber and Penn 1995](https://courses.cs.duke.edu/fall02/cps124/resources/p119-weber.pdf)
- **AttractionUp**: curve_up per segment = AttractionUp·declination·cos(orientation)/nCurveRes. A value of 1 curves each stem so its last segment points straight up. Negative values droop, as in the Weeping Willow. About 10 gives "snaking oscillations", which suit some sinusoidal branches. It is applied to sub-branches only. — [Weber and Penn 1995](https://courses.cs.duke.edu/fall02/cps124/resources/p119-weber.pdf)
- **nSegSplits** carries the fractional part of the split count forward as an error term ("error diffusion"), so 1.2 gives one clone on 80% of segments and two on 20%. Each clone halves its own tendency to clone again. — [Weber and Penn 1995](https://courses.cs.duke.edu/fall02/cps124/resources/p119-weber.pdf)
- Example parameter sets from the appendix (selected fields):

| Field | Quaking Aspen | Black Tupelo | Weeping Willow | CA Black Oak |
|---|---|---|---|---|
| Shape | 7 (tend flame) | 4 (tapered cylindrical) | 3 (cylindrical) | 2 (hemispherical) |
| BaseSize | 0.4 | 0.2 | 0.05 | 0.05 |
| Levels | 3 | 4 | 4 | 3 |
| 1DownAngle(V) | 60, −50 | 60, −40 | 20, 10 | – |
| 1Rotate, 1Branches | 140, 50 | 140, 50 | −120, 25 | – |
| 1Length | 0.3 | 0.3 | 0.5 | – |
| 2DownAngle | 45 | 30 | 30 | – |
| 2Branches | 30 | 25 | 10 | – |
| 2Length | 0.6 | 0.6 | 1.5 | – |
| 3Branches | – | 12 | 300 | – |
| 3Length | – | 0.4 | 0.1 | – |
| Leaves | 25 | 6 | 15 | – |
| AttractionUp | 0.5 | 0.5 | −3 | – |
| 0BaseSplits | – | – | 2 | 2 |

  — [Weber and Penn 1995 appendix](https://courses.cs.duke.edu/fall02/cps124/resources/p119-weber.pdf)

**SpeedTree and Tree It**
- SpeedTree's generators each have a Generation mode:
  - Proportional; **Proportional steps** ("steps of several nodes each, common on pine trees", i.e. whorls); Absolute; Absolute steps.
  - **Phyllotaxy** ("many common leaf growth patterns"); Interval; **Bifurcation** (nodes where the parent bends, simulating a split); Flood (random positions); Parent.
  - Supporting controls: First/Last boundaries along the parent; Pruning by position curve; **Knockout** (randomly remove a proportion); Force containers (include or exclude zones).
  
  — [SpeedTree Modeler: generation properties](https://docs.unity3d.com/speedtree-modeler/manual/generation-properties.html)
- The older SpeedTree spine generator has "jink frequency" and "jink amount" (perturbance). The vine generator has a gravity Amount and a droop style. — [SpeedTree spine generator](https://docs.unity3d.com/speedtree-modeler/manual/spine-generator-properties.html); [vine generator](https://docs.unity3d.com/speedtree-modeler/manual/vine-generator-properties.html)
- Tree It (Evolved Software, free) ships 18 preset scenes (broadleaf, conifers, palms) and a Generate button for random variants. Sliders cover trunk (shown as an editable joint chain), branches, leaves and roots at the ground surface. It has wind animation and two polygon-reduction controls. No online manual exists, and no published list of parameter ranges was found. — [CG Channel](https://www.cgchannel.com/2018/01/download-free-tree-generation-tool-tree-it/); [80.lv](https://80.lv/articles/tree-it-a-free-tree-generator/)

### Inferences
- **A single generator core can cover most species.** Use a Weber–Penn-style recursive stem generator with these knobs per level: count, downAngle(V), rotate(V) (137.5 for spiral, 180 for distichous/alternate, 90 for decussate/opposite), lengthRatio, taper, curve, curveBack, segSplits, plus global Shape, BaseSize, AttractionUp, Flare and Lobes. At 8 to 96 px, Levels 2 or 3 is enough: the third level should mostly be represented by leaf-cluster stamps, not drawn twigs.
- **Hallé–Oldeman models that matter for game trees:**
  - **Corner** (single-stem palm, tree fern, papaya)
  - **Tomlinson** (clumping palms, banana, date palm)
  - **Schoute** (forked doum palm)
  - **Leeuwenberg** (dragon blood tree, Joshua tree, candelabra shapes; repeated equal forks)
  - **McClure** (bamboo groves)
  - **Massart and Aubréville** (tiered, pagoda forms: spruce, fir, Araucaria, kapok, white pine whorls)
  - **Rauh** (default temperate tree: oak, pine, ash, everything upright and monopodial)
  - **Attims** (continuous version of Rauh)
  - **Troll** (layered spreading trees whose trunk is built from bent axes: flamboyant, beech-like horizontal sprays, elm's arching form)
  - **Champagnat** (arching shrubs, weeping forms)
  
  Fagerlind, Petit, Nozeran, Prévost, Koriba, Cook, Mangenot, Stone, Scarrone and Roux matter mainly for tropical realism and can be approximated by the above. In code this becomes an "architecture" enum that picks rules: monopodial vs sympodial continuation, rhythmic tiers (whorl count, tier spacing) vs continuous branching, orthotropic vs plagiotropic children (plagiotropic means horizontal, foliage in a flat plane), and terminal flowering (forks after each flowering, as in Leeuwenberg).
- **Space colonization at pixel scale**: with a 64 px crown, about 150 to 600 attraction points, D = 1 to 2 px, dk = 2 to 4·D and di = 6 to 12·D should give readable limbs in a few hundred iterations; a brute-force nearest-node search is fine without a Voronoi diagram. Use blue-noise (Poisson-disc) points for clean, even branch spacing. A weeping form cannot come from colonization alone, so add a post-pass droop (rotate each segment toward −y by e·|H×T|, per ABOP).
- **L-systems**: keep them for herbs, flowers, ferns, vines and seaweed, where a target silhouette matters less and the tiny grammar is an advantage. A stochastic, parametric L-system with a seeded RNG suits Tycho's determinism rule.
- **Pipe model for pixel widths**: compute widths from the tips toward the base with n = 2 to 2.5, then quantize to whole pixels. Most twigs end up 1 px wide and the trunk 2 to 8 px; at 16 px tall, the trunk is just 1 to 2 px.

### Gaps
- I could not fetch Runions' high-resolution paper figures or ABOP's later chapters (ch. 3 developmental models, ch. 5 compound leaves) in detail; only text was extracted.
- SpeedTree's current branch-generator angle and gravity parameters were not documented in the pages fetched. The spine generator is deprecated. Tree It has no public parameter reference.
- No source compared Hallé–Oldeman models specifically for games; the "which matter" list is my inference.
- "Particle flow" here is from one implementation paper (Nuić et al., based on Neubert et al. 2007's image-based method, which I did not read).

## 2. Species signatures: conifers and broadleaf trees

### Takeaway
Each species reads at a glance through a small set of traits:
1. **Crown envelope**: the Weber–Penn Shape (cone, column, sphere, vase, umbrella, flame, tiered, weeping).
2. **Bare-trunk fraction** (BaseSize): Scots pine and redwood are high; magnolia and spruce are near 0, with branches to the ground.
3. **Branch posture**: upswept vs horizontal vs drooping, i.e. downAngle plus AttractionUp.
4. **Whorl or tier rhythm**: white pine, fir, spruce, cedar of Lebanon and kapok are tiered; oak and elm branch continuously.
5. **Bark ink and mark**: birch white with black dashes, aspen white with black horizontal scars, cherry with horizontal lenticels, Scots pine orange upper bark, redwood fibrous red, beech smooth gray.
6. **Season cue**: larch gold then bare, cherry and jacaranda blossom on bare or new wood, beech keeping brown leaves, baobab leafless about 8 months.

At 16 px, only traits 1 to 3 survive; at 48 px and up, traits 4 to 6 become visible.

### Cited Findings

**Conifers** (H:W = height to crown width, derived from published height and spread ranges where given; **[S]** = search-summary source, page not fetched)

| Species | Trunk | Bark | Branching | Crown silhouette | Needles / foliage | Cones and season | Sources |
|---|---|---|---|---|---|---|---|
| Scots pine *Pinus sylvestris* | mature: "long, bare and straight trunk" | young bark "thick, flaky and orange-red"; mature bark scaly gray-brown low down, **orange-red on the upper trunk** | one whorl per year **[S]**; sheds lower branches **[S]** | conical when young, then "rounded or flat-topped mass of foliage" on a bare trunk | paired needles 2.5–5 cm, glaucous blue-green, darker or yellow-green in winter | cones 3–7.5 cm, gray-green or yellow-brown; evergreen; about 35 m | [Wikipedia](https://en.wikipedia.org/wiki/Pinus_sylvestris); [Irish Wildflowers](https://irishwildflowers.ie/pages-trees/t-27.html); [Yale](https://naturewalk.yale.edu/node/393) [S] |
| Eastern white pine *P. strobus* | very straight; lower half often branchless in stands | young: smooth gray-green; old: thick, reddish to gray-brown, scaly ridges with dark furrows | **whorls about every 18 in, 5–6 branches like wagon-wheel spokes**, in "well-separated annual tiers", nearly horizontal and curving up at the tips | conical young; old: "deep, asymmetrically cylindrical", wispy horizontal layers; often emergent above the canopy | soft needles in fives, 5–13 cm, blue-green | slender hanging cones 8–16 cm; older needles yellow and drop in autumn; up to 50+ m | [Wikipedia](https://en.wikipedia.org/wiki/Pinus_strobus); [Virginia Tech dendrology](https://dendro.cnre.vt.edu/dendrology/syllabus/factsheet.cfm?ID=111) |
| Norway spruce *Picea abies* | straight, single | scaly brown to gray, flaky scales | main limbs mostly upturned, **branchlets hang down** | dense cone/pyramid, H:W about 1.6–2:1 | four-angled needles 15–25 mm, dark glossy green | hanging cones 9–20 cm (longest of any spruce), green/violet young, silvery-brown ripe | [Wikipedia](https://en.wikipedia.org/wiki/Picea_abies); [NC State](https://plants.ces.ncsu.edu/plants/picea-abies/) |
| Eastern hemlock *Tsuga canadensis* | straight, monopodial, rarely forked | young rough gray-brown; mature scaly, deeply fissured, brown with a reddish tinge | feathery, drooping branches; lower branches thin out with age | broadly conic, **drooping leader** (often leaning to one side **[S]**), lacy; H:W about 1.6–2:1 | flat needles 15–20 mm in two ranks, shiny green; lime-green new shoots in late spring | small cones 1.5–2.5 cm hanging at twig tips | [Wikipedia](https://en.wikipedia.org/wiki/Tsuga_canadensis); [Cornell](https://blogs.cornell.edu/nyshemlockinitiative/hemlock-woolly-adelgid/finding-hemlocks-in-the-field); [NC State](https://plants.ces.ncsu.edu/plants/tsuga-canadensis/) |
| Fir *Abies* (balsam fir) | single straight trunk | smooth gray with **resin blisters** when young, later brown-gray, fissured | whorled primary branches | narrow, symmetric, **spire-like** pyramid; H:W about 2.7:1 | deep green, white bands below, pointing forward and up | **cones stand upright "like candles"**, 5–25 cm, near the top; some purple; they shatter on the branch | [Wikipedia: Fir](https://en.wikipedia.org/wiki/Fir); [NC State](https://plants.ces.ncsu.edu/plants/abies-balsamea/) |
| Italian cypress *Cupressus sempervirens* | single | not sourced | cultivated forms fastigiate, with erect branches; wild type has level branches | **"exclamation mark"** column, often under a tenth as wide as tall (H:W > 10:1); up to 35 m | dense dark-green sprays of scale leaves | ovoid cones 25–40 mm, green to brown; evergreen | [Wikipedia](https://en.wikipedia.org/wiki/Cupressus_sempervirens) |
| Monterey cypress *Hesperocyparis macrocarpa* (a parent of Leyland) | up to 2.5 m thick; can be gnarled | not sourced | wind-sculpted | coastal trees "irregular and flat-topped" | bright green sprays (gold in 'Goldcrest') | globose cones 20–40 mm | [Wikipedia](https://en.wikipedia.org/wiki/Hesperocyparis_macrocarpa) |
| Cedar of Lebanon *Cedrus libani* | columnar; old trees often split into several upright limbs near the base | dark gray to blackish-brown, rough, scaly, with deep horizontal cracks | main limbs rise when young and **spread horizontally** when mature; side branches in **flat horizontal planes** (tiers) | conical young, then "broadly tabular" | needles 15–35 per cluster on short shoots, light green to blue-green | upright barrel cones 8–12 cm; about 40 m | [Wikipedia](https://en.wikipedia.org/wiki/Cedrus_libani) |
| European larch *Larix decidua* | straight | pinkish-brown, thick, with wide vertical fissures | main limbs level or rising, side branches often hang | conic young, then broad and irregular | soft light-green needles 2–4 cm in tufts | **deciduous conifer: needles bright yellow to bronze in autumn, bare in winter**; pink "larch rose" cones in spring | [Wikipedia](https://en.wikipedia.org/wiki/Larix_decidua); [Woodland Trust](https://www.woodlandtrust.org.uk/trees-woods-and-wildlife/british-trees/a-z-of-british-trees/european-larch/) |
| Coast redwood *Sequoia sempervirens* | "remarkably straight"; self-prunes lower limbs; can buttress | up to 35 cm thick, **"soft and fibrous", bright red-brown**, weathering darker | horizontal to slightly drooping branches | conical; old exposed trees flat-topped with dead windward limbs | dark green above, blue-white bands below | small ovoid cones 15–32 mm; 60–116 m | [Wikipedia](https://en.wikipedia.org/wiki/Sequoia_sempervirens); [Conifer Society](https://conifersociety.org/conifers/sequoia-sempervirens) [S] |

**Broadleaf trees**

| Species | Trunk | Bark | Branching | Crown silhouette | Leaves at a distance | Flowers, fruit, seasons | Sources |
|---|---|---|---|---|---|---|---|
| White oak *Quercus alba* | stout | whitish to ashy gray, scaly plates or blocks | wide-spreading | pyramidal young, then broad, rounded; H:W about 1–1.5:1 | bright green, 5–9 rounded lobes | catkins in April; acorns; autumn purplish to red-brown, late; **some dead leaves stay into winter** | [NC State](https://plants.ces.ncsu.edu/plants/quercus-alba/) |
| Sugar maple *Acer saccharum* | straight | gray, furrowed into long thick plates | opposite | dense oval; H:W about 1.5–2:1 | dark green, opposite | autumn yellow, orange or red; paired samaras | [NC State](https://plants.ces.ncsu.edu/plants/acer-saccharum/) |
| Red maple *A. rubrum* | – | smooth light gray young, dark gray plates old | ascending, opposite | rounded | red petioles | **red flowers before the leaves** in late winter; early red autumn color | [NC State](https://plants.ces.ncsu.edu/plants/acer-rubrum/) |
| Silver/paper birch *Betula pendula / papyrifera* | slender (under 40 cm); paper birch often multi-stemmed | **white, peeling, with black fissures**, black rugged base, dark diamond-shaped fissures; paper birch peels showing orange-brown | **"often pendulous twigs"**, "elegant, drooping branches" | light, open; paper birch irregular oval, H:W about 1.6–2:1 | small, triangular, light green | yellow early in autumn; catkins ("lambs' tails") April–May | [Wikipedia](https://en.wikipedia.org/wiki/Betula_pendula); [Woodland Trust](https://www.woodlandtrust.org.uk/trees-woods-and-wildlife/british-trees/a-z-of-british-trees/silver-birch/); [NC State](https://plants.ces.ncsu.edu/plants/betula-papyrifera/) |
| Quaking aspen *Populus tremuloides* | slim, under 40 cm across | smooth, **whitish (light green when young), thick black horizontal scars and black knots** | spreading | pyramidal or rounded; under 15 m; grows in clonal groves | round leaves 4–6 cm that tremble on flat petioles | **golden-yellow autumn, clones turning at different times (patchwork hills)**; some clones orange or red | [Wikipedia](https://en.wikipedia.org/wiki/Populus_tremuloides); [USFS FEIS](https://www.fs.usda.gov/database/feis/plants/tree/poptre/all.html) |
| Weeping willow *Salix babylonica* | short, stout | gray-brown to gray-black, irregular furrows | **weeping, pendulous** reddish- to yellowish-brown stems | broad, rounded, weeping; H:W about 1:1 | narrow light-green leaves 3–6 in, gray below | first to leaf out, last to drop; greenish-yellow to gold autumn; yellow winter twigs in 'Chrysocoma' | [NC State](https://plants.ces.ncsu.edu/plants/salix-babylonica/); [Wikipedia](https://en.wikipedia.org/wiki/Salix_babylonica) |
| American elm *Ulmus americana* | **forks low into several leaders at a sharp angle**; old trees may buttress | dark gray, flat braided ridges | branches rise while diverging, then arch into long branchlets whose ends "float lightly in the air" | **vase**; spread can exceed height (75–165 ft spread on 80–106 ft trees) | – | greenish-red flowers before the leaves; papery samaras; soft yellow autumn | [NC State](https://plants.ces.ncsu.edu/plants/ulmus-americana/); [Wikipedia](https://en.wikipedia.org/wiki/Ulmus_americana) |
| Beech *Fagus grandifolia / sylvatica* | stout when open-grown | **thin, smooth, silvery-gray**, stays smooth with age | low-branched | dense oval to rounded; H:W about 1–1.5:1 | dark glossy green | golden-bronze autumn; **dead leaves often hang on through winter**, especially on saplings and low branches | [NC State](https://plants.ces.ncsu.edu/plants/fagus-grandifolia/); [Wikipedia](https://en.wikipedia.org/wiki/Fagus_sylvatica) |
| Cherry *Prunus serrulata*, Yoshino *P. × yedoensis* | short | glossy reddish-brown to gray mahogany, **prominent horizontal lenticels** | spreading horizontal | vase or spreading, about as wide as tall (also weeping cultivars) | dark green; new leaves red-bronze | white to deep pink flowers in clusters of 3–5, March–May, lasting 2–3 weeks (Yoshino); autumn red, yellow or copper | [NC State: serrulata](https://plants.ces.ncsu.edu/plants/prunus-serrulata/); [NC State: yedoensis](https://plants.ces.ncsu.edu/plants/prunus-x-yedoensis/) |
| Southern magnolia *M. grandiflora* | – | smooth brown-gray, then plates | **lower branches tend to reach the ground** | pyramidal to rounded, dense; H:W about 1.5–3:1 | glossy dark green above, rusty below (evergreen) | creamy white flowers 8–12 in, May–June; cone-like fruit with red seeds | [NC State](https://plants.ces.ncsu.edu/plants/magnolia-grandiflora/) |
| Baobab *Adansonia digitata* | **very broad, fluted or cylindrical**, buttressed; trunk 10–14 m across on a 5–25 m tree | gray, usually smooth | sparse massive branches that "resemble roots" ("upside-down tree") | not sourced | palmate, 5–7 leaflets | **leafless about 8 months**; large white hanging flowers; woody fruit up to 25 cm | [Wikipedia](https://en.wikipedia.org/wiki/Adansonia_digitata) |
| Umbrella thorn *Vachellia tortilis* | – | gray to dark, twisting fissures **[S]** | – | flat-topped umbrella; cultivated 3–5 m tall with 8–13 m spread (H:W about 0.4) **[S]**; the southern subspecies often lacks the spread | tiny bipinnate leaves about 2.5 cm | paired thorns (one long and white, one short and hooked); white puffball flowers; coiled pods | [Wikipedia](https://en.wikipedia.org/wiki/Vachellia_tortilis); [Arizona arboretum](https://arboretum.arizona.edu/sites/arboretum.arizona.edu/files/Vachellia%20tortilis_SD_1.pdf) [S] |
| Banyan / strangler fig *Ficus benghalensis* | **aerial roots drop, root and thicken into extra trunks**; the Great Banyan has 2,880; stranglers wrap the host into a hollow lattice column | not sourced | – | crown wider than tall (H:W < 1); up to 30 m | leathery glossy elliptic leaves, red when young | – | [Wikipedia: Banyan](https://en.wikipedia.org/wiki/Banyan); [F. benghalensis](https://en.wikipedia.org/wiki/Ficus_benghalensis) |
| Red mangrove *Rhizophora mangle* | **arching prop (stilt) roots** above the water, also dropping from branches | thick gray-brown (Wikipedia) or reddish-brown (UF); the sources disagree | – | not sourced; about 6 m (up to 24 m) or a scrubby bush | opposite, leathery, dark green | yellow flowers; long cigar-like propagules hang from the branches **[S]** | [Wikipedia](https://en.wikipedia.org/wiki/Rhizophora_mangle); [UF FMEL](http://fmel.ifas.ufl.edu/general-information/natural-habitats-at-fmel/coastal-wetlands-salt-marshes-and-mangrove-forests/red-mangrove-r-mangle/) |
| Kapok *Ceiba pentandra* | **plank buttresses 12–15 m up the trunk and up to 20 m out**; spines on the trunk | not sourced | 4–6 huge branches, long and nearly horizontal **[S]** | crown up to 60 m wide on a 60 m tree | palmate, 5–9 leaflets, briefly deciduous | white night flowers while leafless; hanging capsules of kapok fiber | [Wikipedia](https://en.wikipedia.org/wiki/Ceiba_pentandra); [biostor](https://archive.org/download/biostor-277517/biostor-277517.pdf) [S]; Massart model per the [Hallé key](https://bio.libretexts.org/Bookshelves/Evolutionary_Developmental_Biology/Key_to_the_Diversity_and_History_of_Life_(Shipunov)/04:_Geography_of_Life/4.02:_Architectural_Models_of_Tropical_Trees-_Illustrated_Key) |
| Jacaranda *J. mimosifolia* | young: long unbranched trunk | dark gray, rough, fine vertical fissures | ascending, irregular | vase; H:W about 1.7–2:1 | fern-like bipinnate | **purple-blue panicles while leafless, just before the new leaves**, for up to two months; flat round brown capsules | [NC State](https://plants.ces.ncsu.edu/plants/jacaranda-mimosifolia/); [Wikipedia](https://en.wikipedia.org/wiki/Jacaranda_mimosifolia) |

- Weber and Penn's own tree specifications confirm several signatures in parameter form:
  - Weeping Willow: Shape 3, BaseSize 0.05, AttractionUp −3, 3Branches 300, 2Length 1.5.
  - Quaking Aspen: Shape 7 (tend flame), BaseSize 0.4.
  - Black Tupelo: down angles that flip from upward at the top to downward at the bottom.
  
  — [Weber and Penn 1995](https://courses.cs.duke.edu/fall02/cps124/resources/p119-weber.pdf)
- Desarrh's pixel generator maps species to four canopy shapes: round (oak), triangular (pine), flat (acacia) and columnar (cypress). Its other presets: birch is a thin trunk with white bark, sakura is pink foliage with falling leaves, weeping willow uses negative branch angles, baobab uses trunk bulge and a flat canopy. — [GitHub: Desarrh](https://github.com/Desarrh/Procedural-Tree-Godot)

### Inferences

**Parameter table for a Weber–Penn-style pixel generator**:
- Shape uses the WP ids: 0 cone, 1 sphere, 2 hemisphere, 3 cylinder, 4 tapered cylinder, 5 flame, 6 inverse cone, 7 tend flame, plus custom U = umbrella/flat-top, V = vase, T = tiered.
- base = BaseSize (bare-trunk fraction).
- down = level-1 down angle (0 = parallel to the trunk, 90 = horizontal, >90 = hanging).
- up = AttractionUp for twigs.
- tiers = whorl rhythm.
- foliage = leaf-cluster style.

These are my synthesis from the cited traits and are starting values to tune by eye.

| Species | Shape | base | down (°) | up | tiers / rhythm | Trunk notes | Foliage stamp and inks | Season |
|---|---|---|---|---|---|---|---|---|
| Scots pine (old) | U (flat top) | 0.6–0.7 | 70–90 | 0.2 | sparse whorls | straight; orange upper / gray lower bark ramp | blue-green clumps in flat pads | evergreen, darker in winter |
| White pine | T over 4 | 0.3–0.5 | 80–90 | 0.3 (tips curve up) | 4–7 well-separated tiers, 5 branches each | straight, gray-brown | wispy horizontal blue-green strands | evergreen |
| Spruce | 0 | 0.0–0.05 | 80–100 | −0.5 (hanging branchlets) | dense, continuous whorls | hidden | dense dark-green, saw-tooth edge | evergreen; snow sits on tiers |
| Hemlock | 0 | 0.05 | 90 | −1 | feathery | leader bent over 2–3 px | lacy, light-green sprays, softer edge than spruce | lime tips in spring |
| Fir | 0 (narrow) | 0.05 | 80 | 0 | regular whorls | gray, smooth | dark green; upright purple or brown cone ticks at the top | evergreen |
| Italian cypress | 3 / 5 | 0.0 | 5–15 | +1 | none | hidden | one dark column, vertical stroke texture | evergreen |
| Cedar of Lebanon | T over 2 | 0.2 | 90 | 0 | 3–5 flat plates, wider than tall when old | thick, often split into several limbs | blue-green horizontal slabs, lit top face, dark underside | evergreen |
| Larch | 0 → irregular | 0.2 | 80 | −0.5 | loose | pinkish-brown | soft pale-green stipple | **gold in autumn, then bare** |
| Redwood | 0 / 4 (narrow) | 0.4–0.6 | 90 | −0.3 | – | thick, fibrous **red-brown** with vertical grooves | dark-green clumps | evergreen |
| Oak | 1/2 (broad) | 0.2–0.3 | 50–70 | 0.0, crooked (high curveV) | continuous | stout, gray, blocky plate texture | big round lobed clumps | russet to brown; some leaves kept in winter |
| Maple | 1 (oval) | 0.2 | 40–55 | 0.3 | opposite pairs | gray, furrowed | dense round clumps | red, orange or yellow; red-flower haze in late winter (red maple) |
| Birch | 7 / 1 (open) | 0.3 | 40–60 | −0.8 (pendulous twigs) | – | thin, **white with black dashes and diamonds, black base** | small light clumps, see-through | early yellow |
| Aspen | 7 | 0.4 | 50–60 | 0.5 | – | thin, white-green with black horizontal scars and knots; stands of many | small round shimmering clumps (2-frame flicker) | **gold patchwork** by clone |
| Weeping willow | 3 / 1 | 0.05–0.2 | 20–40 then droop | **−3** | many long curtains | short, stout, gray | vertical strands (curtains) of 1 px lines with leaf dashes | early leaf-out, gold autumn |
| Elm | V | 0.2 | 15–30 (low fork into 3–5 leaders) | arch: + then − | – | dark gray, braided | crown wider at the top, fine twigs at the edge | soft yellow |
| Beech | 1/2 | 0.15 | 60–80 | 0 | – | **smooth silver-gray**, few marks | dense glossy clumps | golden-bronze; brown leaves kept low in winter |
| Cherry blossom | V / U spreading | 0.25 | 50–70 | 0.2 | – | mahogany with **horizontal lenticel dashes** | spring: pink/white clumps on bare twigs; summer: green | pink, then green, then copper |
| Magnolia (evergreen) | 1/0 | 0.0 | 70–90 | 0 | – | brown-gray | large glossy dark leaves (2–3 px dashes) | white cup flowers in May–June |
| Baobab | U | 0.6–0.7 | 30–60 | root-like crooks | sparse | **bottle trunk** (Flare and Lobes large; width ≈ 0.5–1 × height) | small sparse clumps or none | bare about 8 months |
| Umbrella thorn | U (flat) | 0.4–0.5 | 30–50, forking (segSplits) | 0 | – | dark, twisting | **one thin flat layer**, H:W ≈ 0.4, fine stipple | dry season thin |
| Banyan | U wide | 0.3 | 70–90 | 0 | – | many vertical prop-root trunks (1–2 px lines from limbs to the ground) | dense glossy | evergreen |
| Mangrove | 2 | 0.3 | 60 | 0 | – | **arched stilt roots** from the trunk base into the water | leathery dark-green clumps | – |
| Kapok | T / U | 0.6 | 90 | 0 | 2–3 tiers of 4–6 huge horizontal limbs | **plank buttresses** (2–4 triangular fins at the base) | sparse clumps | bare at flowering |
| Jacaranda | V | 0.3 | 30–50 | 0.2 | – | dark gray | fern-like fine clumps | **purple-blue crown on bare wood** in spring |

- Two traits are shared by different species. **Tiers** (white pine, cedar, kapok, Araucaria) need a rhythmic placement mode, i.e. SpeedTree's "proportional steps" or Hallé's Massart/Aubréville models. **Pendulous twigs** (birch, willow, hemlock, spruce branchlets) need negative AttractionUp only at the last level.
- **Snow** in winter belongs on the top faces of tiers (spruce, fir, cedar), which is cheap when tiers are drawn as separate slabs: paint the top 1 to 2 px row of each slab with the snow ink.

### Gaps
- Not sourced:
  - bark of Italian and Monterey cypress, and Leyland cypress shape
  - birch lenticels specifically (black fissures and diamonds were sourced)
  - crown shapes of baobab, umbrella thorn (search only) and red mangrove
  - tiered branching and bark color of kapok
  - banyan bark and fig color
  - crown widths for Scots pine, white pine, cedar of Lebanon and redwood
- Sources contradict each other on Norway spruce branch posture (NC State says both "pendulous with age" and "mostly upturned") and on red mangrove bark color (gray-brown vs reddish-brown).
- The parameter table is an inference to be tuned visually; no source gives pixel-art parameters per species.

## 3. Species signatures: palms, tree ferns, bamboo, desert trees, cacti, succulents, dead and storm-broken trees

### Takeaway
These read through one or two strong structural cues: an unbranched trunk topped by a frond rosette (Corner model), ribs and arms (saguaro), stacked pads (prickly pear), a rosette of thick, spined leaves (agave, aloe), or forking at every flowering (Joshua tree, dragon blood tree: Leeuwenberg). Most need no recursive brancher. A "trunk path plus rosette at the tip" generator, a "segment-chain" generator (pads, cholla joints, bamboo culms) and a "ribbed column with arms" generator cover them. Dead trees are a live tree run through a decay schedule: needles red, then gone; fine branches lost; bark cracking and falling; broken top; weathered gray wood.

### Cited Findings

**Signature table** (facts per row from the cited sources; **[S]** marks a search-summary source not fetched by the helper researcher)

| Species | Trunk / stem | Surface color and texture | Branching | Silhouette / crown | Leaves / fronds | Visible flowers and fruit | Size and season | Sources |
|---|---|---|---|---|---|---|---|---|
| Coconut palm *Cocos nucifera* | slender, unbranched, slightly swollen base, usually curved/leaning **[S]** | gray, ringed with frond scars **[S]**; old leaves break away cleanly, leaving the trunk smooth | none (Corner model) | rosette crown of 25–35 fronds **[S]** | pinnate fronds 4–6 m, leaflets 60–90 cm | nuts yellow-green to yellow-brown; dwarf varieties green or orange | up to 30 m; about one new frond a month **[S]** | [Wikipedia](https://en.wikipedia.org/wiki/Coconut); [allaboutpalmtrees](https://www.allaboutpalmtrees.com/coconut-palm-tree) [S] |
| Date palm *Phoenix dactylifera* | single or clumping, 30–40 cm thick **[S]** | rough gray with a diamond pattern of persistent leaf bases **[S]** | suckers at the base (Tomlinson model) | crown 6–10 m across | pinnate, 4–6 m, about 150 leaflets each about 30 cm, spiny petiole | fruit 3–7 cm, dark brown to bright red or yellow | up to 30 m | [Wikipedia](https://en.wikipedia.org/wiki/Date_palm); [U. Arizona arboretum](https://apps.cals.arizona.edu/arboretum/taxon.aspx?id=207) [S] |
| Fan palm *Washingtonia filifera* | columnar, 9–15 m, 0.3–0.6 m thick, brown where bare | "dense skirt" (petticoat) of dead fronds may cover the whole trunk | none | ball of fans over a skirt | palmate, gray-blue-green, white threads hang between segments | long flower stalks beyond the fronds, cream flowers in late summer; black fruit 1–2 cm | – | [Wikipedia](https://en.wikipedia.org/wiki/Washingtonia_filifera) |
| Fan palm *Chamaerops humilis* | clumping multi-stem, 2–5 m | – | rhizome clumps | shrubby fan mass | rounded fan of 10–20 leaflets, spiny petioles; green or silver-blue (var. argentea) | fruit green, then yellow, then brown | – | [Wikipedia](https://en.wikipedia.org/wiki/Chamaerops) |
| Tree fern *Dicksonia antarctica* | about 5 m (rarely 15 m), about 30 cm thick | "densely covered in matted brown fibrous roots" and old frond bases | usually one crown (up to six) | funnel of fronds | tripinnate fronds up to 4 m, broadest at the middle, dark green above, paler below; new fronds uncurl from hairy croziers **[S]** | – | Cyathea leaves hexagonal leaf-base scars **[S]** | [Wikipedia](https://en.wikipedia.org/wiki/Dicksonia_antarctica); [NZ plants (Auckland)](https://www.nzplants.auckland.ac.nz/en/about/ferns/native-ferns/cyatheaceae-black-silver-tree-ferns/cyathea-medullaris.html) [S] |
| Bamboo | culms hollow, columnar, **no taper**; full height in one season | jointed at nodes; internodes up to 2.5–5 m in some species; yellow (*P. aurea*) or black (*P. nigra*) culms | branches only from nodes after full height; Phyllostachys has none low down and 2 per node above mid-culm **[S]** | grove of verticals (McClure model) | leaves in sprays of 2–4 at branch ends, lanceolate **[S]** | flowers rarely and all at once, then declines | US garden species 4.5–12 m, timber bamboos over 30 m; may drop leaves in USDA zone 5 | [Wikipedia](https://en.wikipedia.org/wiki/Bamboo); [NZ Flora](https://nzflora.info/factsheet/Taxon/Phyllostachys.html) [S] |
| Joshua tree *Yucca brevifolia* | light, fibrous, no rings | – | **unbranched until first bloom** (or weevil damage), then forks; top-heavy | candelabra | dark green bayonet leaves 15–35 cm in dense spirals at the stem tips, white serrated edges | creamy white-green panicles 30–55 cm tall, February to April (irregular) | up to about 15 m | [Wikipedia](https://en.wikipedia.org/wiki/Yucca_brevifolia) |
| Dragon blood tree *Dracaena cinnabari* | thick, stout, up to 1.5 m across | – | **dichotomous**, each branch repeatedly splitting in two after the bud flowers | upturned, dense **umbrella** | rosettes only at the youngest branch tips, leaves up to 60 cm × 3 cm, stiff | small white or green flowers; berries green, then black, then orange-red; crimson resin | up to 9 m tall, crown up to 12 m wide | [Wikipedia](https://en.wikipedia.org/wiki/Dracaena_cinnabari) |
| Saguaro *Carnegiea gigantea* | column up to 75 cm across | pleated; pleats expand "like an accordion" after rain; spines up to 7 cm from areoles | first arms at about 60–75 years (up to 100); some never branch ("spears"); up to 50+ arms (record 78) | column with upturned arms | none | creamy white waxy flowers 8.6–12.4 cm at the trunk and arm tips, late April to early June; ruby-red fruit splits open showing black seeds | 3–16 m; crested fan form in about 1 in 10,000 | [NPS](https://www.nps.gov/sagu/learn/nature/saguaro.htm); [Wikipedia](https://en.wikipedia.org/wiki/Saguaro) |
| Prickly pear *Opuntia* | pads (cladodes) joined end to end; *O. ficus-indica* gets a trunk at 5–7 m | pads green to blue-green; areoles with 1–8 yellow-white spines and glochids | new pad from a bud on a pad | sprawling clump of paddles up to 3.5 m (*O. engelmannii*) | pads obovate to round, 15–30 × 12–20 cm | yellow flowers with red centers, 6–9 cm; purple barrel-shaped fruit ("tuna"); across the genus fruit is red, green or yellow-orange | – | [Wikipedia: Opuntia](https://en.wikipedia.org/wiki/Opuntia); [O. engelmannii](https://en.wikipedia.org/wiki/Opuntia_engelmannii) |
| Barrel cactus *Ferocactus wislizeni* | columnar when young, then barrel | 15–28 ribs; leathery asparagus-green; hooked spines form an "armored web", reddish fading to gray **[S]** | none | barrel; adults **lean south** ("compass barrel") | none | yellow to red-orange flowers at the top in summer; yellow fruit stays over a year | 0.9–1.8 m (up to 3 m) | [Wikipedia](https://en.wikipedia.org/wiki/Ferocactus_wislizeni); [Desert Museum](https://www.desertmuseum.org/visit/sheets/Ferwis.pdf) [S] |
| Cholla *Cylindropuntia fulgida* | one trunk branching low; old trunk brown-black, scaly | light green, very bumpy jointed segments; 6–12 silvery-yellow spines per areole, dense enough on young joints to hide the stem | drooping jointed branches | small tree, often 4 m | none | pink-lavender flowers 2.5 cm at the joint tips; fruit hangs in chains that lengthen each year | – | [Wikipedia](https://en.wikipedia.org/wiki/Cylindropuntia_fulgida) |
| Agave *A. americana* | stemless rosette 1.8–3 m across | gray-green leaves 0.9–1.5 m with prickly edges and a heavy **terminal spike**; variegated cultivars have yellow or white edges | offsets at the base | rosette | – | **flowers once** after 10–30 years on a branched stalk up to about 8 m with yellow flowers, then dies | – | [Wikipedia](https://en.wikipedia.org/wiki/Agave_americana) |
| Aloe *A. vera* | stemless or short, 60–100 cm | thick fleshy leaves, green to gray-green, some with white flecks, edges with small white teeth | pups at the base | rosette | – | spike up to 90 cm of hanging tubular yellow flowers | flowers in summer | [Wikipedia](https://en.wikipedia.org/wiki/Aloe_vera) |

**Dead and storm-broken trees**
- Snag decay sequence (subalpine fir, from Thomas 1979):
  1. Green needles turn red.
  2. Needles fall, leaving a "skeleton" with fine branches intact.
  3. Fine branches are lost and bark cracks.
  4. Larger branches and bark fall away, leaving a hard snag with little or no bark.
  5. The wood softens and the snag breaks down.
  
  Classes 3A and 3B "have the same shape as a live tree". Broken tops are uncommon until 3C. All soft snags found were broken and under 15 m. — [USDA Forest Service PDF](https://www.fs.usda.gov/media/218293)
- Class table:

| Class | Needles | Fine branches | Bark | Wood |
|---|---|---|---|---|
| 3A red | red | all | solid | hard |
| 3B skeleton | none | all | solid | hard |
| 3C | none | some or few | cracking | hard |
| 4 | none | none | 98–50% left | hard |
| 5 | none | none | under 50% left | mostly hard |
| Soft | none | none | none | soft |

  Annual fall-down rates rise from 0.2% (3A) to 6% (class 5). — [USDA FS](https://www.fs.usda.gov/media/218293)
- Hard snags usually keep an intact top and many dead branches. Soft snags usually have broken tops and few limbs. Causes are fire, insects, disease and lightning. — [Idaho Dept. of Lands FM9](https://www.idl.idaho.gov/wp-content/uploads/sites/2/forestry/forester-forums/fm9.pdf)
- Weathering: UV breaks down brown lignin and rain washes it out, leaving gray bleached cellulose, often with gray-black mold. This was measured on lumber; it is a surface effect. — [Woodworking Network](https://www.woodworkingnetwork.com/knowledge-center/wood-dr/what-causes-wood-turn-gray-outdoors) [S]; [USDA FS treesearch](https://research.fs.usda.gov/download/treesearch/29235.pdf) [S]
- A lightning strike can leave a spiral scar running down the trunk to the root flare. — [Middlebury](https://sites.middlebury.edu/middland/?p=2704) [S]
- Windthrow lifts a vertical root plate of soil. Over time these break down into pit-and-mound ground. — [search summary](https://www.bip.us.edu.pl/sites/default/files/2026-03/Steszczenie__ENG.pdf) [S]

### Inferences
- **Palm generator**: a trunk Bézier with lean of 0 to 25° (coconut) or 0 (Washingtonia, date). Draw ring marks every 2 to 3 px for coconut, a diamond crosshatch for date, or a skirt mass at the top third for Washingtonia. The crown is 6 to 14 frond arcs at 96 px (4 to 6 at 24 px), each a quadratic curve drooping under AttractionUp < 0, with leaflets as short diagonal ticks on both sides (pinnate) or a fan of spokes (palmate). Weber–Penn's negative "Leaves" fan mode is the 3D analogue.
- **Cactus generator**:
  - Saguaro: a capsule column with vertical rib stripes (highlight, base and shadow per rib, about 1 px each at 48 px) and 0 to 5 arms that leave horizontally and then turn up through a 90° rounded elbow. Flowers are a white crown on the tips in the spring palette.
  - Prickly pear: a recursive chain of ellipses (1 to 3 children per pad, attached at the rim, tilted ±30°) with dot areoles, magenta "tuna" fruit on the rims in late summer, and yellow flowers.
  - Barrel: a squat ellipse, ribs as curved stripes, a flower ring on top, and a lean toward screen-south.
  - Agave and aloe: rosettes placed by phyllotaxis (137.5° per leaf, leaf length shrinking toward the center), and a rare tall flower spike variant (agave flowers once and dies, so it makes a good "event" sprite).
- **Dead-tree generator**: run the normal tree, then apply a decay level 0 to 5. Recolor foliage to red-brown (3A) or drop it (3B+). Delete the top branch level (3C), then the next level (4). Shift bark to the gray ramp and expose patches of pale wood (4 to 5). Cut the trunk at 40 to 80% height with a jagged 2 to 3 px splintered top (soft). For storm damage, snap one major limb, hanging or fallen; for a lightning scar, add a pale spiral stripe down the trunk. Windthrow adds a disc-shaped root plate with dirt where it meets the ground.

### Gaps
- Not sourced: saguaro rib count, spine color and arm angle; coconut nut-bunch size; the color of the Washingtonia skirt; date palm leaf color; bark color of Joshua tree and dragon blood tree; whether Opuntia flowers sit on the pad rim. Treat these as art choices.
- Coconut trunk details, the date-palm diamond pattern, tree-fern croziers and bamboo branch counts came from search summaries, not fetched pages.

## 4. Ground cover and shrubs

### Takeaway
Ground cover is where pixel art leans on **repeated small stamps** more than structure. Grass is blade tufts or bunches; reeds and cattails are vertical strokes with a distinctive head; ferns are pinnate fronds made by a two-level recursive generator (or a short L-system); clover is trifoliate dots; moss is cushions or mats, dithered; ivy is a random-walk vine with lobed leaf stamps; shrubs are a small crown with berry dots; hedges are a clipped box with leaf texture; mushrooms are a cap-shape enum plus stem, ring and volva flags. Each has one botanical "tell" the generator must keep.

### Cited Findings
- **Grass**: bunchgrass grows in clumps, tufts or hummocks rather than sod (examples Idaho fescue, blue grama, purple needlegrass). Big bluestem (tallgrass prairie, 1–3 m) has a three-branched "turkey foot" seed head, and its stem base turns blue-purple as it matures. The prairie "Big Four" are big bluestem, Indiangrass, switchgrass and little bluestem. — [Wikipedia: Bunchgrass](https://en.wikipedia.org/wiki/Bunchgrass); [Andropogon gerardii](https://en.wikipedia.org/wiki/Andropogon_gerardii); [Pure Air Natives](https://www.pureairnatives.com/shop/tallgrass-prairie/)
- **Reed (Phragmites)**: stems 1.5–4 m that stay standing through winter. Leaves are glaucous gray-green, turning buff-brown in autumn. The plume is 15–50 cm, dark purple in late summer, then grayer as silky seed hairs develop. — [Wikipedia](https://en.wikipedia.org/wiki/Phragmites_australis)
- **Cattail (Typha)**: 0.8–2.4 m, linear basal leaves up to 2.5 cm wide. The female spike is a brown "sausage" up to 30 cm × 1–4 cm, with a narrow male spike on top that withers. In *T. latifolia* the two touch; in *T. angustifolia* there is a 3–8 cm gap. Ripe heads burst into cottony fluff. — [Wikipedia: Typha](https://en.wikipedia.org/wiki/Typha); [Typha latifolia](https://en.wikipedia.org/wiki/Typha_latifolia)
- **Ferns**: a frond is a stipe, then a rachis, then pinnae, then pinnules. Pinnate means divided once; bipinnate twice; tripinnate (rare) three times; pinnatifid means deeply cut but not separated. Young fronds unroll from a fiddlehead or crozier. — [Wikipedia: Frond](https://en.wikipedia.org/wiki/Frond)
- **Clover (*Trifolium repens*)**: 3 elliptic leaflets on long stalks, often with light or dark markings (four or more leaflets occasionally). White flower globes 1.5–2 cm on 7 cm stalks, sometimes turning pink with age. It creeps by stems rooting at the nodes. — [Wikipedia](https://en.wikipedia.org/wiki/Trifolium_repens)
- **Moss**: upright (acrocarp) or creeping (pleurocarp) stems forming dense clumps or mats, mostly 0.2–10 cm. Spore capsules sit on thin stalks (setae). Some leaf tips have white hair points. — [Wikipedia: Moss](https://en.wikipedia.org/wiki/Moss)
- **Ivy (*Hedera helix*)**: juvenile leaves on creeping or climbing stems are palmately 5-lobed. Adult flowering leaves in sun are unlobed and heart-shaped. It climbs by aerial rootlets to 20–30 m, or carpets the ground. Greenish-yellow flower umbels in autumn; purple-black berries in late winter. — [Wikipedia](https://en.wikipedia.org/wiki/Hedera_helix)
- **Berry shrubs**:
  - Highbush blueberry: 1.8–3.7 m, glossy dark green leaves turning red, orange, yellow or purple in autumn; white or pale-pink urn flowers; blue-black berries. — [Wikipedia](https://en.wikipedia.org/wiki/Vaccinium_corymbosum)
  - Holly: dark glossy spiny leaves (6–8 spines a side; smooth leaves higher up); red berries in October–November on female plants only. — [Wikipedia](https://en.wikipedia.org/wiki/Ilex_aquifolium)
  - Elder: flat ivory flower clusters 8–24 cm; drooping clusters of black-purple berries in late autumn. — [Wikipedia](https://en.wikipedia.org/wiki/Sambucus_nigra)
- **Hedges**:
  - Boxwood: small oval leaves 1.5–3 cm, slow-growing, valued for topiary because it tolerates close shearing. — [Wikipedia](https://en.wikipedia.org/wiki/Buxus_sempervirens)
  - Privet: up to 3 m, leaves 2–6 cm, creamy flower clusters and black berries. — [Wikipedia](https://en.wikipedia.org/wiki/Ligustrum_vulgare)
- **Mushroom cap shapes**:
  - Convex (dome, often flattening with age); umbonate (central knob); infundibuliform (funnel, as in chanterelles); campanulate (bell). — [Wikipedia: Pileus](https://en.wikipedia.org/wiki/Pileus_(mycology))
  - Conical; plane (flat); umbilicate (navel pit); depressed. — [chestofbooks American Fungi](https://chestofbooks.com/flora-plants/mushrooms/American-Fungi-Mushrooms-Edible-Poisonous/The-Pileus.html); [zombiemyco glossary](https://zombiemyco.com/blogs/growers-glossary/cap-pileus)
  - The annulus (ring) is left on the stalk; gills are free, adnate or decurrent. — [Wikipedia: Glossary of mycology](https://en.wikipedia.org/wiki/Glossary_of_mycology)
- **Fly agaric (*Amanita muscaria*)**: cap 5–30 cm, bright red (fading, or orange to yellow in some varieties), with white-to-yellow pyramidal warts from the universal veil that rain can wash off. The cap goes from egg to ball to hemisphere to flat plate. Gills and stalk are white, with a white ring and a bulbous base with 2–4 ruff rings. It grows with birch, pine, spruce, fir and oak. — [Wikipedia](https://en.wikipedia.org/wiki/Amanita_muscaria)
- **Water lily (*Nymphaea*)**: pads round to oval with a deep notch (the two basal lobes overlap or spread), 2.5–60 cm across the genus. Flowers have about 6–50 petals grading into many stamens, usually 4 green sepals, in white, yellow, rose-red or orange-red. — [Wikipedia](https://en.wikipedia.org/wiki/Nymphaea)
- **Giant kelp (*Macrocystis*)**: a holdfast sends up to 60 stipes, each with blades at irregular intervals and one gas bladder (pneumatocyst) at each blade's base. It reaches 50–60 m and grows up to 60 cm a day. — [Wikipedia](https://en.wikipedia.org/wiki/Macrocystis_pyrifera)
- **Heather (*Calluna*)**: 20–50 cm. Tiny scale leaves under 2–3 mm in opposite pairs. Mauve to purple (occasionally white) flowers in end spikes, July–September. — [Wikipedia](https://en.wikipedia.org/wiki/Calluna)
- **Pixel technique for ground foliage** (Saint11):
  - Think in layers (highlights, base, shadow, dirt); "think in 3 dimensions".
  - "Different depths and patterns break monotony"; "big empty areas give focus to other areas"; "don't overdo the details".
  - "Each detail must be conscious, don't throw random dots around"; "borders have more detail and contrast".
  - A ground leaf stamp has three tones: highlight, base and shadow.
  - "Mossy grass and bushes: draw the base, add a dense shadow area, add layers of depth, add tiny grass blades".
  - "Vines are an easy way to create interesting silhouettes"; "hanging vines are always awesome".
  
  — [Saint11 Vegetation Part 2](https://saint11.art/img/pixel-tutorials/Vegetation2.gif); [Part 3](https://saint11.art/img/pixel-tutorials/Vegetation3.gif); [Part 1](https://saint11.art/img/pixel-tutorials/Vegetation.gif)
- Slynyrd: wheat is "made with lots of repetition and overlapping", and "sometimes it's okay to have dense busy textures so long as you create interest using different colors or patterns". Foreground foliage in his example "uses only one sprite repeated several times", and the layers "can be individually moved around to animate a wind effect". — [Slynyrd Pixelblog 2: Texture](https://raymond-schlitter.squarespace.com/blog/2018/2/15/pixelblog-2-texture)

### Inferences
- **Grass tuft stamp**: 3 to 7 blades, each a 1 px line of 2 to 8 px, leaning ±30° from a shared base and curving with the wind. Color goes from the base (shadow ink) to the tip (light ink). Tall prairie grass adds seed heads: a turkey-foot fork (bluestem), a plume (reed) or a sausage (cattail).
- **Fern frond**: a curved rachis polyline with pinnae every 1 to 2 px, alternating sides, length following a spindle profile (short, long, short; Weber–Penn shape 1 is the same curve). At under 16 px, drop the pinnules and draw each pinna as a 1 px diagonal tick. A fern clump is 4 to 8 fronds radiating from one point, arching outward with negative AttractionUp. A crozier is a 2 to 3 px spiral at the frond tip (spring palette).
- **Ivy and vine**: a self-avoiding random walk along a surface or tree trunk, alternating leaf stamps; use a 5-lobed juvenile stamp (3×3 px blob with notches) on climbing runs, heart stamps near flowering tops. Hanging vines are vertical sine-wiggle lines 1 px wide with leaf dots.
- **Mushroom generator**: `{cap: convex|conical|campanulate|umbonate|plane|infundibuliform|depressed, capW, capH, capColor, spots: none|warts|scales, gills: visible-under-rim, stem: h,w, ring: bool, volva: bool, cluster: n}`. Fly agaric is red, convex to plane, with white warts, ring and bulb. At 8 px, a fly agaric is 5 px of red cap with 2 to 3 white dots on a 2 px white stem.
- **Kelp**: a vertical L-system or chain of stipe segments with blades alternating, each blade with a 1 px darker bladder dot at its base; it sways with a sine wave whose phase rises with height.
- **Hedge**: a clipped rectangle or rounded box (for isometric, a box with top and two visible faces), filled with a repeated small leaf stamp, the top face lighter. Topiary is a hedge clipped to spheres and cones (boxwood's tolerance of shearing makes this plausible).

### Gaps
- No sources fetched for turf-grass anatomy, red clover, kelp color or seaweeds other than giant kelp, or heather's flower size.
- No specific pixel-art grass tutorial with numeric blade sizes was found; the stamp sizes above are inferences.

## 5. Flowers: morphology that reads at small sizes, color palettes, meadow mixes

### Takeaway
At 3 to 12 px a flower reads by **count and symmetry of petals**, **center color**, **posture** (upright cup, nodding bell, spike, flat head, ball cluster) and **stem height**. A flower generator therefore needs: head type (radial disk/ray, cup, bell, spike, ball cluster, zygomorphic), petal count, petal color, center color, nodding angle, inflorescence (single, one-sided raceme, spike, umbel, ball), stem height and leaf type (rosette, strap, sword, palmate, pinnate). True blue is rare in nature, and some families never have it (no blue tulips or roses, no red irises), which is a cheap realism constraint for palettes.

### Cited Findings

**Morphology table** (facts from the cited Wikipedia pages)

| Flower | Head / petals | Colors | Size and posture | Leaves | Source |
|---|---|---|---|---|---|
| Daisy *Bellis perennis* | ray florets around a yellow disk | white rays, often tipped red | heads 2–3 cm on leafless stalks 2–10 cm | round to spoon-shaped rosette, flat on the ground | [Wikipedia](https://en.wikipedia.org/wiki/Bellis_perennis) |
| Sunflower *Helianthus annuus* | sterile ray florets plus a disk in 34/55 spirals (89/144 on big heads), florets 137.5° apart | yellow rays (also red or orange), brown disk | plant about 3 m, head 7.5–12.5 cm; young heads track the sun, mature heads face east | broad, coarse, heart-shaped low down | [Wikipedia](https://en.wikipedia.org/wiki/Helianthus_annuus) |
| Tulip | 6 tepals in two whorls, cup or star shape, single and erect | red, orange, pink, yellow, purple, white, often a contrasting basal blotch; **no pure blue** | stems 15–75 cm, flower up to 6–8 cm | 2–6 fleshy, strap-shaped, blue-green | [Wikipedia](https://en.wikipedia.org/wiki/Tulip) |
| Rose | wild: 5 petals (a few 4); doubles have stamens turned into petals | white, pink, red, orange, yellow; lacks the enzyme for blue pigment | climbers to 7 m; hooked prickles; red hips | 5–9 serrated leaflets | [Wikipedia: Rose](https://en.wikipedia.org/wiki/Rose); [Blue flower colouration](https://en.wikipedia.org/wiki/Blue_flower_colouration) |
| Corn poppy *Papaver rhoeas* | 4 petals, black spot at the base | vivid red | flower 5–10 cm, stem up to 70 cm with hairs at right angles; egg-shaped seed capsule | – | [Wikipedia](https://en.wikipedia.org/wiki/Papaver_rhoeas) |
| Lavender | whorls of small two-lipped flowers on a spike above the leaves | blue, violet, lilac | spike 2–8 cm on bare stems 10–30 cm | narrow, 2–6 cm × 4–6 mm, gray-green | [Wikipedia: Lavandula](https://en.wikipedia.org/wiki/Lavandula); [L. angustifolia](https://en.wikipedia.org/wiki/Lavandula_angustifolia) |
| Bluebell *Hyacinthoides non-scripta* | 5–12 tubular bells (3–32) on a **one-sided nodding** raceme; 6 tepals curled back; cream pollen | violet-blue | stem up to 50 cm, **drooping tip** | 3–6 linear basal leaves | [Wikipedia](https://en.wikipedia.org/wiki/Hyacinthoides_non-scripta) |
| Foxglove *Digitalis purpurea* | hanging tubes on one side of a tall spike, spotted inside | purple (pink, white, yellow in cultivars) | 1–2 m; biennial (year 1 is a rosette only) | rosette 10–35 cm | [Wikipedia](https://en.wikipedia.org/wiki/Digitalis_purpurea) |
| Dandelion *Taraxacum officinale* | 40–100+ strap florets in one head; seed head of 54–172 seeds, each with a white parachute about 6 mm | yellow to orange-yellow, then white clock | one head per hollow stem 5–40 cm | lobed or toothed basal rosette 5–45 cm | [Wikipedia](https://en.wikipedia.org/wiki/Taraxacum_officinale) |
| Iris | 3 drooping **falls** plus 3 upright **standards**, 3 petal-like style arms, some with a fuzzy beard | mostly purple or blue, also yellow, pink, orange, white; **no true red** | – | sword-shaped, in fans of 3–10 | [Wikipedia](https://en.wikipedia.org/wiki/Iris_(plant)) |
| Lily *Lilium* | 6 tepals, funnel, trumpet, bowl or Turk's cap (curled back) | white, yellow, orange, pink, red, purple, often spotted | stems 30–180 cm | – | [Wikipedia](https://en.wikipedia.org/wiki/Lilium) |
| Orchid | bilateral; 3 sepals and 3 petals, one petal a lip (labellum) that hangs below after a 180° twist | – | – | – | [Wikipedia](https://en.wikipedia.org/wiki/Orchidaceae) |
| Cosmos *C. bipinnatus* | usually **8** ray florets | pink, violet, white | heads 5–7 cm, plants 0.6–2 m | threadlike segments 0.5–1 mm | [Wikipedia](https://en.wikipedia.org/wiki/Cosmos_bipinnatus) |
| Marigold *Tagetes* | ray and disk florets | gold, orange, yellow, white, often with maroon | heads 4–6 cm, plants 0.1–2.2 m | pinnate, pungent | [Wikipedia](https://en.wikipedia.org/wiki/Tagetes) |
| Hydrangea *H. macrophylla* | **mophead**: a ball of large sterile 4-part florets; **lacecap**: a flat disk of tiny fertile flowers ringed by large sterile ones | blue in acid soil, pink or red in alkaline (aluminium ions) | shrub about 3 m × 2.5 m | serrated, up to 15 cm | [Wikipedia](https://en.wikipedia.org/wiki/Hydrangea_macrophylla) |
| Lupine *Lupinus polyphyllus* | dense tall **conical spike** of pea flowers 1–1.5 cm | wild blue to purple; garden red, pink, white, bicolor | up to 1.5 m | **palmate**, 9–17 leaflets | [Wikipedia](https://en.wikipedia.org/wiki/Lupinus_polyphyllus) |

**Color palettes as botany**
- Blue-flowered species are under 10% of about 400,000 flowering plants, per a news report. Wikipedia's statement that blue is rare carries a citation-needed tag. — [Gulf News](https://gulfnews.com/world/americas/scientists-give-a-chrysanthemum-the-blues-1.2065787); [Wikipedia: Blue flower colouration](https://en.wikipedia.org/wiki/Blue_flower_colouration)
- Blue needs delphinidin plus metal complexes, co-pigments or a pH shift; cornflower uses calcium. Morning glory shifts from purple to blue as cell pH rises from 6.6 to 7.7. Roses, carnations and chrysanthemums lack the F3′5′H enzyme. — [Wikipedia: Blue flower colouration](https://en.wikipedia.org/wiki/Blue_flower_colouration)
- **Pollination syndromes** map color to pollinator:
  - Bees: yellow or blue, often with UV nectar guides
  - Butterflies: pink or lavender, with a landing pad
  - Hawk moths: white, night-opening tubes
  - Birds: red or orange tubes
  - Beetles: greenish or off-white dishes
  - Carrion flies: dull colors
  - Bats: white, night-opening
  - Wind: small green flowers without real petals
  
  — [Wikipedia: Pollination syndrome](https://en.wikipedia.org/wiki/Pollination_syndrome)
- Honeybee photoreceptors peak at about 344 nm (UV), 436 nm and 544 nm, so bees are red-blind but see UV. — [PMC article](https://pmc.ncbi.nlm.nih.gov/articles/PMC3498261)

**Meadow mixes**
- European cornfield annuals (arable weeds, not true meadow plants):
  - RHS collection: corn chamomile, corncockle, cornflower, corn marigold, field poppy. — [RHS plants](https://www.rhsplants.co.uk/plants/_/summer-glory-collection/classid.1000000972); [Habitat Aid](https://www.habitataid.co.uk/products/cornfield-seed-mix)
  - Example seed mix by weight: corncockle 40%, poppy 25%, cornflower 20%, corn chamomile 12.5%, corn marigold 2.5%. — [Germinal WF10](https://www.externalworksindex.co.uk/entry/37591/Germinal-Amenity/WF10-Cornfield-Annuals-wildflower-seed-mixture/)
  - Cornflower: intense blue heads 1.5–3 cm. Corn marigold: yellow daisy heads 3.5–5.5 cm. Corncockle: deep pink 2.5–5 cm flowers with broken black lines. — [Centaurea cyanus](https://en.wikipedia.org/wiki/Centaurea_cyanus); [Glebionis segetum](https://en.wikipedia.org/wiki/Glebionis_segetum); [Agrostemma githago](https://en.wikipedia.org/wiki/Agrostemma_githago)
- North American tallgrass prairie mix:
  - Purple coneflower, black-eyed Susan and sweet black-eyed Susan, Indiangrass and others. — [Prairie Moon](https://prairiemoon.com/classic-tallgrass-prairie)
  - Wild lupine appears in a basic prairie mix. — [Stantec basic prairie mix](https://ideas.stantec.com/content/dam/stantec/files/PDFAssets/native-plant-nursery/basic-prairie-mix.pdf)
  - Coneflower: pink-purple rays and a domed cone, heads 7–15 cm, plants to 120 cm. Black-eyed Susan: yellow rays and a brown-black dome, 30–100 cm. — [Echinacea purpurea](https://en.wikipedia.org/wiki/Echinacea_purpurea); [Rudbeckia hirta](https://en.wikipedia.org/wiki/Rudbeckia_hirta)

### Inferences
- **Flower head renderer by size** (radius in px):
  - 1 px: a single colored dot (meadow speck).
  - 2 px: a plus sign or 2×2 block with a 1 px center of a contrasting ink (daisy = white with a yellow center).
  - 3 to 4 px: a ring of N petals at angle 360/N, each a 1 to 2 px stroke from the center. N is 4 (poppy), 5 (rose, wild), 6 (tulip, lily), 8 (cosmos) or "many" (daisy, a ring with 1 px gaps).
  - 5 px and up: phyllotactic disk (sunflower: florets at r = c√n, θ = 137.5n, with c = R/√N) plus a ray ring.
  
  Side views use posture: cup = U of 3 to 5 px (tulip); bell = an inverted U hanging off an arched stem (bluebell, a one-sided raceme of 3 to 6 bells; foxglove, a tall spike of 6 to 12); spike = a vertical stack of dots narrowing to the top (lavender, lupine, heather); ball = a dithered disk (hydrangea mophead, clover).
- **Meadow mix generator**: a weighted list of species with a color and a height band, scattered with Poisson-disc spacing per species and clumped by low-frequency noise (wildflowers grow in drifts). Example "cornfield": poppy red 0.25, cornflower blue 0.2, corncockle pink 0.4, corn marigold yellow 0.025, chamomile white 0.125, over a wheat-gold grass base. Example "prairie": coneflower pink, black-eyed Susan yellow, lupine blue, over tall grass in green-gold, rust in autumn (big bluestem).
- **Palette rule of thumb** for an 8-ink frame: one flower accent ink per biome, two at most. Blue flowers are rare, so a blue accent reads as special. Red is for poppies and bird flowers, white for night or moth flowers.

### Gaps
- Ray-floret counts for daisy, sunflower and black-eyed Susan were not found. Petal spiral arrangement in roses, the marigold pom-pom form and lily stamen counts were not confirmed from fetched pages.
- No source quantified the readability of flowers at specific pixel sizes; the size ladder above is my inference.

## 6. Pixel-art technique for foliage: clusters, light, outlines, stamps, avoiding noise

### Takeaway
Pixel artists agree:
1. Make a **silhouette** that reads as the species in one dark color.
2. Shade **volume by clumps**, each clump lit from one consistent direction (not pillow-shaded from the edges inward), using 3 to 5 inks per foliage ramp, warm light and cool shadow.
3. Build texture from a **few repeated leaf-cluster stamps** arranged in varied patterns, never random single pixels ("orphan pixels").
4. Put most of the detail and contrast on the **borders**, leaving calm internal "resting areas".
5. Outline selectively: the outline darkens toward the shadow side and lightens or vanishes on the lit side.

This maps directly onto a stamp-based generator: crown blobs from the branch skeleton, each blob shaded by a light vector, filled with oriented cluster stamps chosen by tone band.

### Cited Findings

**Saint11 (Pedro Medeiros), Vegetation tutorials, parts 1 to 3** (read from the tutorial images)
- Order of work is "Shape, Light, Detail". "I try to make a silhouette that is recognizable as a tree, even without the colors." "The light must show that the tree has volume." "Keep the color count as low as possible." The tutorial labels a pillow-shaded concentric blob "Avoid". — [Saint11 Vegetation Part 1](https://saint11.art/img/pixel-tutorials/Vegetation.gif)
- On color and detail:
  - The ramp runs from "warm light" to "cold shadow", and "almost half of the gradient is light green".
  - "Create resting areas for the eyes"; "detailed borders, clear internal areas".
  - "I try to detail without adding too much noise"; "I avoid orphan pixels"; "think in layers of foliage".
  - "Keep a leaf pattern for consistency"; "repeating patterns is a good way to avoid noise".
  - "Leaves fall in a sine wave and spin".
  
  — [Saint11 Part 1](https://saint11.art/img/pixel-tutorials/Vegetation.gif)
- From Part 2:
  - Layers are highlights, base, shadow, dirt. "Avoid too many colors, avoid orphan pixels, avoid noise."
  - "Wood has a texture with many almost parallel grooves." Grooves "use the shadow color and don't appear in low contrast areas".
  - Detail in front of the player stays above the collision limit.
  
  — [Saint11 Part 2](https://saint11.art/img/pixel-tutorials/Vegetation2.gif)
- From Part 3:
  - Big leaves: the "outline should focus on the 3D shape and folds"; "choose a dark and light side"; "add light layers"; "add specular points on edges".
  - Trunks: "start by defining your light/dark areas"; "add texture: individually make cracks and lumps"; "add light points"; "add a backlight of a different color"; "I like to work adding one color at a time".
  - Silhouette and texture: "Spirals and other shapes are great for creating interesting textures"; "fade far vegetation towards sky color"; "slimy plants fall in arches".
  - Ground: "Dither is great for moss texture".
  
  — [Saint11 Part 3](https://saint11.art/img/pixel-tutorials/Vegetation3.gif)
- Saint11 elsewhere advises minimizing orphan pixels, which make an image noisy and confusing. — [Pixel Grimoire, "How to start making pixel art #2"](https://medium.com/pixel-grimoire/how-to-start-making-pixel-art-2-bcd705cb04d7) (via search summary)

**Slynyrd (Raymond Schlitter)**
- Pixelblog 44, top-down trees:
  - Build one foliage bundle from a basic geometric leaf (rhombus/trapezoid, or a ball).
  - Make the mid-value bundle first, then a darker and a lighter copy "by shifting hues one step on a shared color ramp", giving three variants. "4 or 5 colors per bundle is plenty."
  - Stack the variants according to an implied light source, then clean up stray pixels where bundles overlap.
  - Small leaves use 2×2 px squares that "may touch but shouldn't overlap".
  - Pointed leaves are trapezoids angled upward at the top of the bundle and rotating downward toward the bottom.
  - Round bundles get a crescent of one-shade-darker color at the bottom left and a smaller lighter circle at the upper right.
  
  — [Slynyrd Pixelblog 44](https://slynyrd.com/blog/2023/5/22/pixelblog-44-top-down-trees)
- Pixelblog 44 on trunk, shadow and conifers:
  - Trunk: a cylinder whose bark stripes are "widest at the center and narrow toward the sides", broken up with a knot or a root.
  - Drop shadow: centered under the tree suits game layouts; offset to one side looks more dynamic.
  - Conifers are not modular. Start from a stick-figure guide and draw branches top to bottom, since higher ones overlap lower ones. Side branches can be mirrored before shading. Shade with light, medium and dark branch values, some branches casting shadows on those below.
  
  — [Slynyrd Pixelblog 44](https://slynyrd.com/blog/2023/5/22/pixelblog-44-top-down-trees)
- Pixelblog 15 (plant life): "Not every leaf needs to be represented"; aim for "just enough to give the impression of a leafy texture". Repeat similar cluster arrangements, since this "maintains a clean consistent look". "Too much variation will create displeasing noise." "Don't try to force realistic details simply for the sake of accuracy." — [Slynyrd Pixelblog 15](https://www.slynyrd.com/blog/2019/3/7/pixelblog-15-plant-life)
- Pixelblog 2 (texture): "A good texture may only need a few simple clusters. Repeat these same clusters over and over but vary the pattern in which they are distributed." The modular method needs only "a few textural sprites, which you can then duplicate and layer into larger textured shapes". — [Slynyrd Pixelblog 2](https://raymond-schlitter.squarespace.com/blog/2018/2/15/pixelblog-2-texture)

**Outlines, pillow shading, jaggies**
- Outlines:
  - "An outline should always be darker than both the object AND the background behind it." Outlines "should always increase contrast, and never decrease it."
  - Selective outlining: "Where the sprite is darkest, we'll use a dark color for the outline, and where it's lightest we'll use a lighter color."
  - Internal lines use a shade one step darker. Between two parts, use the color of the part nearer the viewer.
  
  — [Lospec: Pixel art outlines part 2](https://lospec.com/articles/pixel-art-outlines-part-2-using-color)
- Selout can be made by taking the bordering pixel values and going one shade lower. — [itch.io selective outlines thread](https://itch.io/t/2422252/pixel-tutorial-selective-outlines) (via search summary)
- Pillow shading is "the most common beginner mistake": "shadows are placed uniformly along the outline, creating an unnatural look with no discernible light source". The rule is to "keep the light direction consistent within a single work (or game scene)". Shade stages scale with size: 2 at 16×16, 3 at 32×32. Hue shifting is "barely used" at 16×16 and pays off from 3+ ramp steps. — [pixnote.net shading guide](https://pixnote.net/en/learn/shading)
- Jaggies: clean diagonals use equal-length steps (slopes 1/2, 1/3, 1/4 …); alternating 2:1 and 3:1 steps creates visible bumps. Curves should vary segment lengths continuously (e.g. 3-2-1-1-2-3). "Perfect lines" are 0:1, 1:2, 1:1, 2:1 and 1:0. — [Aseprite community](https://community.aseprite.org/t/how-do-i-make-straight-curved-lines-properly/10246/4); [Divoom](https://divoom.com/blogs/setup-ideas/fix-jaggies-pixel-art-without-blur); [OpenGameArt ch. 2 lines and curves](https://opengameart.org/content/chapter-2-lines-and-curves) (via search summary)
- Clusters: a PixelJoint critique says clusters under 4 px in area should be used very sparingly; let larger leaf groups carry the texture. Foliage should be built from branches, with the foliage clumps attached to them. — [PixelJoint forum](https://pixeljoint.com/forum/printer_friendly_posts.asp?TID=16751) (via search summary)

### Inferences
- **Stamp pipeline for a broadleaf crown at 24 to 96 px**:
  1. Run the skeleton (Weber–Penn or colonization) and take its terminal nodes.
  2. Place clump circles (radius 3 to 10 px) at tips and along the last branch level.
  3. Compute per-pixel clump shading: for each pixel in a clump, n = normalized offset from the clump center (with a fake z = √(1 − x² − y²)); tone = dot(n, L) with L = up-left; quantize into 3 to 4 bands (dark, mid, light, highlight).
  4. Paint back-to-front: lower and rear clumps first in darker ramps (Saint11's "layers of foliage"), then front and top clumps.
  5. Overlay texture by stamping a small fixed set (3 to 6) of leaf-cluster stamps (2×2 squares, 3 px trapezoids, 3 to 5 px blobs) into each band's region in that band's color, oriented by position (up at the top, down at the bottom, per Slynyrd).
  6. Post-pass: remove orphan pixels (any pixel whose 8 neighbors differ is replaced by the majority neighbor), then selout (outline = darkest ramp ink on the shadow side, one step darker than the fill on the lit side).
  
  Leave gaps in the crown (holes showing the sky or inner branches) on large trees, since Slynyrd's Pixelblog 15 tree shows inner branches.
- **Small sizes**: at 8 to 16 px, skip skeletons. Use a hand-authored silhouette template per species family (cone, ball, column, umbrella, palm, vase), jittered by the seed, with 2 shade stages plus an outline (per pixnote). At 24 to 48 px use a skeleton plus clumps. At 64 to 96 px add a third branch level and visible inner branches.
- **Species readability comes from the silhouette first**: test generators by rendering the shape in one color (Saint11's test) and checking that oak, pine, palm, cypress, willow and acacia are distinguishable at 16 px.
- **Bark**: draw vertical groove lines in the shadow ink, denser at the edges and absent in the lit center (Saint11, Slynyrd); add per-species marks (birch black dashes, cherry horizontal lenticels, pine plates).

### Gaps
- No AdamCYounis tree or foliage tutorial could be located by search; his content is on YouTube and wasn't indexed. Lospec has no tree-specific article found (only the outlines articles).
- The PixelJoint "cure" tutorial (pillow shading, jaggies, sel-out) mirror was not readable past its table of contents.

## 7. Procedural pixel tree projects

### Takeaway
Existing pixel-tree generators fall into three types:
- **Segment walkers**: a trunk of stacked segments with random horizontal shifts; branches snapped to trunk vertices; leaves spawned from tips (archaicvirus TIC-80).
- **Recursive branchers with blob canopies**: a Leonardo-rule recursion with canopy shapes round, triangular, flat and columnar, a 3-color hue-shifted ramp, outline and sway (Desarrh, Godot).
- **Recursion plus leaf circles drawn after all branches**: (Red Blob Games).

t3ssel8r's 3D approach (leaf sprites on shadowed spheres) was judged "still a bit too messy". All of them confirm the stamp-at-tips plus shaded-blob approach.

### Cited Findings
- **archaicvirus TreeGenerator (TIC-80)**:
  - Algorithm: a trunk of stacked vertical segments, each shifted horizontally at random. Branches snap to trunk vertices at a height interval, split left and right, and grow outward in segments with random upward shifts. Leaves spawn from branch tips and move toward the trunk, snapped to branch vertices, plus a random cluster at the top of the trunk. Vines connect two random branch vertices with a sag; fruit is placed like leaves on a separate layer.
  - Parameters: Trunk Width, Trunk Height, Step Height, Shift/Step, Branch Length, Branch Width, Branch Thickness, Branch Height, Branch Shift, Total Branches, Branch Deviation, Leaf Density, Leaf Cull Distance, Leaf Fill Radius, Leaf Fill Count, Vine Count, Fruit Density.
  
  — [GitHub: archaicvirus/TreeGenerator](https://github.com/archaicvirus/TreeGenerator)
- **Desarrh Procedural-Tree-Godot** (MIT, Godot 4.3, one @tool script, 50+ parameters):
  - Trunk: taper curves (linear, fast, stays thick), quadratic curve and sine waves, bulge, rings and roughness.
  - Branches: Leonardo-rule recursion with configurable depth, "solid w*w rendering per segment (no staircase artifacts)", an elbow (second segment at an angle), and rounding from square to circular cross-section.
  - Foliage: random-walk blobs or textures, four canopy shapes (round/oak, triangular/pine, flat/acacia, columnar/cypress), vertical gradient with hue shift on a 3-color palette, edge scatter, and a spatial hash grid for leaf spacing.
  - Rendering: bakes 7 textures (1 trunk, 3 back and 3 front leaf bands) and adds wind sway, outline and falling-leaf particles.
  - Presets: oak, pine/fir, birch (white bark), sakura (pink, falling leaves), weeping willow (negative branch angles, long branches), cactus (no foliage, elbow, 2–3 branches), crystal, coral, stalagmite, baobab (trunk bulge, flat canopy).
  
  — [GitHub: Desarrh/Procedural-Tree-Godot](https://github.com/Desarrh/Procedural-Tree-Godot); [Godot Asset Library](https://godotengine.org/asset-library/asset/5021)
- **Red Blob Games (Amit Patel)**: the structure comes from recursion, and "a leaf cluster is just a few green circles" drawn at the end of every branch, including intermediate ones. Drawing leaves during recursion put branches over leaves, so the HTML5 version draws all leaves after all branches, "top to bottom". — [simblob blog](https://simblob.blogspot.com/2022/06/procedural-tree-generator.html); [live generator](https://www.redblobgames.com/x/2222-tree-generator/)
- **t3ssel8r**: jagged spheres that cast shadows, with leaf sprites scattered over them and lit by the sphere normal underneath. It was judged "still a bit too messy compared to artist results"; the author proposed more even spacing, perhaps blue noise. — [Games in Progress: t3ssel8r](https://www.gamesinprogress.com/indie-game-developers/t3ssel8r/procedural-pixel-art-trees)
- Others:
  - 4b3c's Python/pygame generator makes PNG trees from a palette file and can animate growth. — [itch.io](https://4b3c.itch.io/procedural-pixel-art-tree-generator)
  - Gentree is an Aseprite extension with branch amount, fork frequency, leaf cluster radius and leaf type. — [itch.io devlog](https://devkidd.itch.io/gentree/devlog)
  - The Rust/Bevy crate "pixeltree" uses a stack-based branch generator. — [crates.io](https://crates.io/crates/pixeltree)
  - walsh9/topiary is a JS canvas recursive tree with angle, height and thickness options. — [GitHub](https://github.com/walsh9/topiary)
  - staff0rd/tree is a TypeScript and pixi space-colonization port. — [GitHub](https://github.com/staff0rd/tree)
  
  (All via search summary.)
- TU Delft research covers procedural texturing that places elements over a pixel image so they follow its 3D shape and shading, which applies to bark and foliage texture. — [TU Delft repository](https://repository.tudelft.nl/file/File_08448c65-f780-421c-8c7b-f2d9a64b6631) (via search summary)

### Inferences
- Draw order matters: all branches first, then foliage back to front (Red Blob). In isometric, sort clumps by depth (y + z) so front clumps overdraw.
- "Solid w×w per segment" (Desarrh) is the right way to draw thick branches on a pixel grid: stamp a w×w square (or disc) at each Bresenham step instead of drawing a thick line. This avoids stair gaps and keeps widths whole.
- Use **blue-noise** (Poisson-disc) placement for leaf stamps to fix t3ssel8r's "messy" result, and keep the stamp set small (Slynyrd).
- Hash-seeded leaf placement per branch ID (McDonald) keeps foliage stable across growth stages and seasons, so one tree can be shown as sapling, young or mature with the same identity.

### Gaps
- No Shadertoy pixel-tree shader was examined. I found no source describing a palette-indexed (rather than RGB) tree generator explicitly.

## 8. Seasons and wind sway, done cheaply

### Takeaway
Seasons are mostly **palette swaps** on an indexed sprite. Foliage ramp indexes map to green (summer), yellow, orange or red (autumn, by species), or transparent/absent (winter deciduous), with pale pink or white overlays for blossom (spring). Snow is an extra top-face ink. Wind sway is a **per-row horizontal offset** that grows with height, from a sum of two sines with per-instance phase, **floored to whole pixels**. Layered foliage stamps can be offset separately for parallax rustle, and falling leaves follow a sine-wave path while spinning.

### Cited Findings
- Autumn pigments: chlorophyll breaks down first; carotenoids (always present) show as yellow (xanthophylls) and orange (beta-carotene) in hickory, ash, aspen, birch, cottonwood and others; anthocyanins (made in late summer) give red and purple in maples, oaks, sweetgum, dogwood, tupelo, cherry and persimmon; brown comes from chlorophyll-anthocyanin mixing or late-senescence quinones. Veins often stay green after the tissue has turned. Bright, cool days and chilly non-freezing nights give the most vivid color. The change lasts a few weeks, around September–November in the Northern Hemisphere. — [Wikipedia: Autumn leaf color](https://en.wikipedia.org/wiki/Autumn_leaf_color)
- Reeds turn buff-brown in autumn and stay standing through winter; blueberry turns red, orange, yellow or purple. — [Phragmites](https://en.wikipedia.org/wiki/Phragmites_australis); [Vaccinium corymbosum](https://en.wikipedia.org/wiki/Vaccinium_corymbosum)
- Godot "2D wind sway" shader: `wind = (sin(t) + cos(t*detail)) * strength * max(0, (1 − uv.y) − heightOffset)`; `VERTEX.x += wind`. The top moves most and the base stays fixed; a per-instance `offset` is added to time for phase variety. — [godotshaders: 2D wind sway](https://godotshaders.com/shader/2d-wind-sway/)
- Pixel-perfect sway quantizes UV to the pixel grid so the sprite stays crisp, and leaves margin in the sprite region for the deformation. — [godotshaders: 2D pixel perfect wind & sway](https://godotshaders.com/shader/2d-pixel-perfect-wind-sway-effect/)
- A pixel-art sine animation layers two sine waves of different speed and frequency, dampens them, then floors the displacement to whole pixels to keep hard edges. — [dev.to (sarasol)](https://dev.to/sarasol/animating-pixel-art-fabric-with-unity-shader-6f1) (via search summary)
- Slynyrd: in the modular method "the sprite layers can be individually moved around to animate a wind effect". — [Slynyrd Pixelblog 2](https://raymond-schlitter.squarespace.com/blog/2018/2/15/pixelblog-2-texture)
- Saint11: "Leaves fall in a sine wave and spin". On wind itself: "We can't see the air moving, so use dust, foliage and other particles". — [Saint11 Vegetation Part 1](https://saint11.art/img/pixel-tutorials/Vegetation.gif); [Saint11 Wind](https://saint11.art/img/pixel-tutorials/Wind.gif)
- Desarrh bakes foliage into 3 back and 3 front leaf bands plus the trunk, enabling per-band sway and player interaction. — [GitHub: Desarrh](https://github.com/Desarrh/Procedural-Tree-Godot)

### Inferences
- **Palette-indexed seasons in Tycho/Ink**: reserve logical slots per sprite (`leafDark`, `leafMid`, `leafLight`, `leafHi`, `bark…`, `blossom`, `snow`) and resolve them through a season table per species. Examples: maple autumn red/orange (anthocyanin); birch, aspen and larch yellow (carotenoid); oak russet to brown and slow to drop; evergreens unchanged except a darker winter ramp. Winter deciduous trees are drawn with foliage clumps removed, which needs the skeleton drawn to the second or third level (draw the skeleton fully, then foliage on top, so removing foliage reveals real branches). Spring blossom (cherry, magnolia, jacaranda) is a foliage pass with blossom inks and smaller clumps, with fallen petals as ground dots. A transition frame mixing both palettes per clump (by hash) gives a "turning" look for free.
- **Wind in View.g's GPU stand-in** (fillRect, drawImage, transforms only): slice the pre-rendered tree canvas into horizontal strips of 2 to 4 px and draw each strip with `drawImage(src, 0, y, w, h, x + dx(y), y, w, h)`, where dx(y) = floor(A·((H − y)/H)^p·(sin(ωt + φ) + 0.5·sin(2.3ωt + φ))). Here p ≈ 1.5 to 2, so the trunk stays put, and φ is a per-tree hash. A is 0 to 2 px for a 48 px tree; anything beyond 2 px looks rubbery. This is a handful of drawImage calls per tree and stays within the allowed primitives. Grass tufts get the same formula with one strip per tuft (shift the whole tuft top). Use an extra foliage-layer offset (front clump layer shifted 1 px out of phase) for rustle.
- **Gusts**: a traveling wave, phase φ = k·worldX − ωt, makes sway roll across a field; it costs nothing extra.
- **Determinism**: wind phase from `Tycho.seed.fxRand` or the tree's hash and the frame clock is fine, since sway is "sparkle nothing saves".

### Gaps
- No pixel-art-specific source on seasonal palettes for named species beyond the general pigment science; species seasonal colors are in section 2.
- No measurement of how many sway pixels read well at a given sprite height was found; the 0 to 2 px figure is my judgment.
