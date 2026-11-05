# Effects and simulations

How water, weather, fire and falling sand fit a palette-indexed engine on a phone: most effects bake once and blit every frame, and the ones that must change every pixel every frame are tiny integer automata over typed arrays, uploaded a row at a time. Effects that obey the palette are cheap; effects that ignore it need shaders. Tycho already ships a light map drawn by `light.Smooth`, `post.Blur` for bloom and wet reflections, deterministic particles in [`Tycho.fx`](../fx.md), and `drawPixels` for buffers rewritten each frame ([the renderer](../renderer.md)). What's missing is the CPU side: weather, small automata and a falling-sand sim. Light has [its own page](light.md).

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md).

- [Water and weather](#water-and-weather)
- [Small automata](#small-automata)
- [Falling sand: the materials](#falling-sand-the-materials)
- [Falling sand: the reactions](#falling-sand-the-reactions)
- [Falling sand: the implementation](#falling-sand-the-implementation)
- [Where each effect runs](#where-each-effect-runs)
- [Sources](#sources)

## Water and weather

At pixel resolution water reads through a few cheap tricks: a vertically flipped copy of what's above the shoreline, a per-row horizontal sine offset for ripples, cycling highlight inks for glints and foam, and a scrolling strip for waterfalls. All but per-pixel displacement are drawImage strips: one strip per row, so 50 rows of water is 50 quads *(inference)*. Tycho's `post.Blur` already reflects "wet strips" with a ripple ([the renderer](../renderer.md)). Mark Ferrari animated waves, streams and waterfalls purely by palette cycling over one image ([Effect Games](http://www.effectgames.com/effect/article-Old_School_Color_Cycling_with_HTML5.html)); that route is on [motion](motion.md#palette-cycling-and-sway).

<figure class="demo"><div class="stage" data-demo="water"></div>
<figcaption><b>Reflections.</b> The scene mirrored into water with a per-row sine offset, foam at the shore and a few glints. Per-row <code>drawImage</code> strips fit the stand-in; <code>post.Blur</code> already has wet strips.</figcaption></figure>

Nearly all weather is either particles (rain, snow, motes, fireflies, leaves) or scrolling, pre-painted layers (fog, clouds, cloud shadows, god rays) drawn with alpha, `multiply` or `lighter`; heat haze is the water's per-row offset at 1 pixel *(inference)*. A particle whose position is a pure function of its index and the tick needs no state, so a frame draws the same however often it's drawn, which is how the White Dragon's sparks already work in `Tycho.fx` ([effects](../fx.md)). Dithered fog keeps the palette exact; smooth alpha fog doesn't *(inference)*.

<figure class="demo"><div class="stage" data-demo="weather"></div>
<figcaption><b>Weather.</b> Rain with splashes, snow, dithered fog and blinking fireflies. Each particle's position is a pure function of its index and the tick, so a frame draws the same however often it is drawn.</figcaption></figure>

## Small automata

The simulation effects that matter are tiny integer automata.

- **Doom's PSX fire** is an index buffer of 37 heat values. The bottom row is fixed hot, and each frame every pixel copies the one below, minus 0 or 1, shifted sideways at random; biasing the shift makes wind ([Fabien Sanglard](https://fabiensanglard.net/doom_fire_psx/)). With a seeded random source, its output is already palette indexes.
- **Noita** splits its falling-sand world into **64×64 chunks with dirty rectangles** so only active pixels update ([80.lv](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/)).
- **Stam's stable fluids** are unconditionally stable at any step ([Autodesk Research](https://www-pt.autodesk.com/research/publications/real-time-fluid-dynamics)).
- **Animal Well** thresholds its Navier-Stokes layer back "to fit the pixel art" ([PlayStation Blog](https://blog.playstation.com/?p=367113)).

At 320×180 or smaller regions, each of these runs in a typed array and uploads changed rows through the stand-in's `drawPixels` *(inference)*. The fallback rule is to never call `getImageData` on a GPU canvas, since readback is the main phone hazard ([WebKit bug 235196](https://bugs.webkit.org/show_bug.cgi?id=235196)). The fire and the sand below carry the shader tag because they are per-pixel work every frame; at these sizes that work fits a CPU buffer uploaded with `drawPixels`.

<figure class="demo"><div class="stage" data-demo="doom-fire"></div>
<figcaption><b>Doom fire.</b> Every cell copies the one below minus 0 or 1, shifted sideways at random (Fabien Sanglard's write-up of the PSX version). The output is already palette indexes; a seeded source keeps it deterministic.</figcaption></figure>

## Falling sand: the materials

Every falling-sand game sorts materials into a few movement classes (static, powder, liquid, gas, plus fire-like cells), then separates them with a handful of numbers.

- **The Powder Toy**'s C++ source gives each element a `Weight`, a gravity, a flammability, a heat conductivity and four transitions by temperature and pressure. Its weights run **gases 1, fire 2, acid 10, oil 20, water 30, salt water 35, lava 45, salt 75, dust 85, sand and stone 90, solids 100**, so oil floats, salt water sinks under fresh water and sand sinks through every liquid ([TPT elements](https://github.com/The-Powder-Toy/The-Powder-Toy/tree/master/src/simulation/elements)). Its `Hardness` is resistance to acid, not sturdiness, and glass at 0 is immune ([TPT ACID.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/ACID.cpp)). One trick saves many material IDs: lava carries a `ctype` that remembers what melted, so sand above 1973 K becomes lava that solidifies back into glass ([TPT Simulation.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/Simulation.cpp); [TPT FIRE.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/FIRE.cpp)).
- **Sandboxels** makes everything data. Each element is a plain object with a behavior grid, `reactions` keyed by the other element with a chance, `tempHigh`/`stateHigh`, `burn`, `burnTime` and `burnInto`. Viscosity is a probability: a liquid may try sideways only if a random draw beats `100 / viscosity^0.25`, which gives oil about 25% and magma 10% ([Sandboxels index.html](https://github.com/R74nCom/sandboxels/blob/main/index.html)).
- **Sandspiel** shows the minimal cell: four bytes for species, a random grain value `ra` that also sets lightness, a state byte `rb` and a clock. Burning is a countdown in `rb` (wood 90 ticks, oil 50, plant 20), and gas carries a molecule count that splits and merges ([Making Sandspiel](https://maxbittker.com/making-sandspiel); [species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)).
- **Noita** adds what the toys lack: rigid bodies on Box2D, and destruction gated by durability (sand 4 against brickwork 14), which turns the sandbox into progression ([80.lv](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/); [Noita wiki](https://noita.wiki.gg/wiki/Material)).

A demo's materials, taken from those sources:

| Material | Class | Weight | Key behavior and reactions | Basis |
|---|---|---|---|---|
| Sand | powder | 90 | melts to glass via lava; water makes wet sand | TPT, Sandboxels |
| Water | liquid | 30 | boils at 100 °C, freezes at 0 °C; salt makes salt water (1/50); kills fire | TPT, Sandboxels |
| Salt water | liquid | 35 | freezes lower (−21 °C in TPT, −2 °C in Sandboxels); boils into steam and salt | TPT, Sandboxels |
| Oil | liquid | 20 | floats on water; about 25% sideways chance; ignites at 2% | TPT, Sandboxels |
| Lava | thick liquid | 45 | 10% sideways chance; water makes stone and steam; remembers what melted | TPT, Sandspiel |
| Acid | liquid | 10 | dissolves non-glass at Hardness/1000; about 25 kills, then dies | TPT |
| Glass | static | 100 | acid-proof (Hardness 0) | TPT |
| Wood | static | 100 | burns 90 to 300 ticks into ember, charcoal or ash | Sandspiel, Sandboxels |
| Plant | static, grows | 100 | drinks adjacent water (1/50 TPT, about 19% Sandspiel) | TPT, Sandspiel |
| Ice | static | 100 | spreads into water (7%); fire or lava melts it | Sandspiel |
| Steam | gas | 1 | condenses below about 95 °C; clouds near the ceiling | TPT, Sandboxels |
| Fire | short-lived gas | 2 | life 180 to 259 ticks; ignites by flammability; becomes smoke | TPT, Sandboxels |
| Smoke | dissipating gas | 1 | deletes itself 5% per tick | Sandboxels |
| Gunpowder | powder | 85 | ignites at 60% (TPT) and explodes | TPT, Sandboxels |

## Falling sand: the reactions

Reactions come with real per-tick chances, which set the pace of the toy.

| Reaction | Chance | Source |
|---|---|---|
| Lava next to water becomes stone | 100% | [Sandspiel](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs) |
| Salt dissolves into water | 1/50 per tick | [TPT WATR.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/WATR.cpp) |
| A flammable neighbor ignites | `(Flammable + pressure·10)/1000`: 2% for oil and wood, 60% for gunpowder, 100% for nitro | [TPT FIRE.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/FIRE.cpp) |
| Water kills fire; water evaporates | Always; 1/30 | [TPT](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/WATR.cpp) |
| A plant drinks neighboring water | 1/50 | [TPT PLNT.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/PLNT.cpp) |
| Acid dissolves a neighbor (TPT) | `Hardness/1000`; dies after about 25 kills (life 75, stopping at 50) | [TPT ACID.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/ACID.cpp) |
| Acid eats a neighbor (Sandboxels) | 5% per side, 10% below; ignores glass and the other waters | [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html) |
| Ice spreads through water | About 7% per tick | [Sandspiel](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs) |
| Two steam cells near the top of the screen form a cloud | 5% | [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html) |

Acid is bounded in both so it cannot erase the world. Three reaction kinds cover a demo: contact reactions (A, B) → (A′, B′) at chance p, temperature transitions, and burning. A 28-material table fits in a dense 784-entry array of results and chances stored as bytes out of 256. Chances taken from 60 Hz sources must double if the sim runs at 30 Hz *(inference)*.

## Falling sand: the implementation

The implementation is well settled.

- **Scan bottom-up**, because "if you update it from the bottom up, the sequence of the falling rows will be consistent" ([80.lv](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/)).
- **Alternate or randomize the horizontal direction**, or "the right particles will always execute their rules before the left ones" ([jason.today](https://jason.today/falling-improved)).
- **Skip cells already moved this tick** with a clock bit, and update in place rather than double-buffering, which Sandspiel, Noita and jason.today all do ([Making Sandspiel](https://maxbittker.com/making-sandspiel); [HN thread](https://news.ycombinator.com/item?id=31309616)).
- **Let water flow**: Sandspiel's water stores a preferred direction in the parity of its grain byte and moves up to two cells sideways, so a body of water flows instead of jittering ([species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)).
- **Accelerate**: jason.today's sand accelerates by 0.4 to a maximum speed of 8, with the whole part of its velocity counted as one-cell move attempts. Its profiler found color-string parsing, not the sim, eating the frame ([jason.today](https://jason.today/falling-improved)).
- **Sleep**: Noita's 64×64 chunks with dirty rectangles let settled regions cost nothing ([80.lv](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/)).
- **Not Margolus on a CPU**: Margolus block updates are order-independent but leave gaps between falling grains, so they are worth it only on a GPU ([LifeWiki](https://conwaylife.com/wiki/Margolus_neighborhood); [HN thread](https://news.ycombinator.com/item?id=31309616)).

No source measures plain JavaScript sand on phones. The best anchor is Sandspiel's 300×300 grid in Rust compiled to WebAssembly, which hits 60 fps on many devices but not all, so its author regrets spending headroom on a bigger canvas ([Making Sandspiel](https://maxbittker.com/making-sandspiel)). Elsewhere's 320×180 is 64% of that cell count, so a Tycho sim needs typed arrays with a one-cell wall gutter, property tables indexed by material, sleeping chunks, an optional 30 Hz tick, and a seeded xorshift in place of `Math.random`. The last of these lets the bots and golden tests replay a sand quest exactly. Each material's grain should pick among two or three of the frame's inks rather than free RGB *(inference)*.

The design lesson is to keep it legible. Sandspiel's single-tap tools and Noita's finding that players never noticed slow moss both argue for a few strong chains in one constrained toy with a goal, such as melting sand into a glass bridge with lava ([Making Sandspiel](https://maxbittker.com/making-sandspiel); [80.lv](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/)).

<figure class="demo"><div class="stage" data-demo="falling-sand"></div>
<figcaption><b>Falling sand, 26 materials.</b> Every material has a weight, a viscosity, a flammability and a heat conductivity, and every cell carries a temperature. Water freezes and boils, and steam rains back. Lava turns to stone in the lake and sand to glass. Acid eats everything but glass and wears out. Salt water melts ice, gunpowder and gas explode, and seeds grow toward water. The numbers follow the source code of The Powder Toy, Sandboxels and Sandspiel. Sideways flow is a chance of 100/viscosity<sup>0.25</sup>%; acid dies after about 25 cells. It runs 160×120 in 2 to 6 ms a frame, with sleeping 16×16 chunks and one <code>drawPixels</code> upload. Pick a scene, or choose a material and pour; Heat view shows the temperatures.</figcaption></figure>

## Where each effect runs

Under Tycho's rules, "stand-in" means per-frame drawing with fillRect, drawImage, alpha, the four blends (source-over, lighter, destination-out, multiply), transforms and gradients; "pre-bake" means painted once offscreen, where anything goes; "CPU buffer" means a typed array uploaded each frame with `drawPixels`; "shader" means `gpu.program` or `gpu.lightPass`. The placements are inferences from the renderer's documented limits ([the renderer](../renderer.md)) and the effects research. Light's rows are on [its page](light.md).

| Technique family | Where it runs | How |
|---|---|---|
| Palette cycling | Pre-bake (CPU buffer for large areas) | K phase canvases, or changed rows via `drawPixels` |
| Particles, rain, snow, motes, fireflies | Stand-in | fillRects at rounded positions |
| Fog, cloud shadows, god rays, caustics | Pre-bake, then stand-in | Scroll baked textures with alpha, multiply or lighter |
| Ripples, heat haze, reflections of painted layers | Stand-in | One drawImage per row; `post.Blur` wet strips already exist |
| Doom fire, falling sand, Stam fluid, Life | CPU buffer | `drawPixels` of changed rows |
| Mosaic and iris transitions, screen shake, hit stop | Stand-in | Two blits; baked masks; camera offset |
| CRT curvature, chromatic aberration, sharp bilinear, color LUTs on RGB | Shader | Against the eight-ink look by design |

Two phone hazards matter most: reading pixels back from a GPU canvas with `getImageData`, and running effects after upscaling, which touches about 50 times the pixels of 320×180. Do every effect at internal resolution and upscale last.

## Sources

- [Fabien Sanglard, how Doom fire was done](https://fabiensanglard.net/doom_fire_psx/)
- [80.lv, Noita: a game based on falling sand simulation](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/)
- [Jos Stam, real-time fluid dynamics for games](https://www-pt.autodesk.com/research/publications/real-time-fluid-dynamics)
- [PlayStation Blog, Animal Well](https://blog.playstation.com/?p=367113)
- [WebKit bug 235196, canvas readback](https://bugs.webkit.org/show_bug.cgi?id=235196)
- [The Powder Toy, its elements' source](https://github.com/The-Powder-Toy/The-Powder-Toy/tree/master/src/simulation/elements)
- [Sandboxels, its source](https://github.com/R74nCom/sandboxels/blob/main/index.html)
- [Max Bittker, Making Sandspiel](https://maxbittker.com/making-sandspiel), and [its species](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)
- [jason.today, falling sand improved](https://jason.today/falling-improved)
- [Noita wiki, materials](https://noita.wiki.gg/wiki/Material)

The full research is in [the notes on effects and rendering](notes/effects_rendering.md) and [the notes on falling-sand materials](notes/falling_sand_materials.md).

<script src="demos/kit.js"></script>
<script src="demos/fx-shared.js"></script>
<script src="demos/water.js"></script>
<script src="demos/weather.js"></script>
<script src="demos/doom-fire.js"></script>
<script src="demos/falling-sand.js"></script>
<script src="demos/start.js"></script>
