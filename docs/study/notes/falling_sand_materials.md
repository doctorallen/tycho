# Falling-sand simulations: materials, reactions, and efficient plain-JS implementation

Scope: how falling-sand cellular automata (Noita, The Powder Toy, Sandspiel, Sandboxels, the classic Falling Sand Game and Powder Game) model many materials, and how to build one in plain JavaScript at about 160x120 to 320x180 on phones, for Tycho (which can push a pixel buffer each frame through drawPixels).

How the sources were read:
- The Powder Toy wiki blocks bots (Anubis), so its values come straight from the game's C++ source on GitHub (`src/simulation/elements/*.cpp`, `Simulation.cpp`, master branch, read November 2026).
- Sandboxels values come from its single-file source (`index.html`, last commit 2026-01-11).
- Sandspiel rules come from its Rust source (`crate/src/species.rs`).
- These are primary sources: the numbers are what the games actually run, not wiki paraphrase.

## 1. Materials and their properties across the major games

### Takeaway
Every game sorts materials into a few movement classes: empty, static solid, powder, liquid, gas, plus special "living" or "energy" cells such as fire. A small set of numbers then sets each material apart:
- density, or weight, for who sinks through whom;
- a dispersion or viscosity knob for liquids;
- flammability, plus a burn time or life counter;
- a temperature with high and low transition thresholds and the material each one becomes;
- a conductivity;
- a hardness, which acts as resistance to acid or explosions.

Reactions are either data tables of (A touches B, then A becomes X and B becomes Y, with chance p) as in Sandboxels, or hand-written per-element update functions as in Sandspiel and The Powder Toy. Noita adds two things the toys lack: free-flying particles off the grid, and destructible rigid bodies.

### Cited Findings

**Sandspiel (Max Bittker), the minimal model**
- Each cell is a 32-bit `#[repr(C)]` struct with four `u8` fields:
  - `species`, an enum such as Empty=0, Wall=1, Sand=2, Water=3, Seed=19;
  - `ra`, randomly initialized, which sets the pixel's lightness (the grain) and also holds element state such as heat;
  - `rb`, which starts at 0 and holds other element state;
  - `clock`, which stops a cell being updated twice in a tick. Bittker notes one bit would do, but the struct is padded to 32 bits. — [Making Sandspiel](https://maxbittker.com/making-sandspiel)
- Saves are lossless PNGs, with species in red, `ra` in green and `rb` in blue. — [Making Sandspiel](https://maxbittker.com/making-sandspiel)
- The species list is Empty, Wall, Sand, Water, Gas, Cloner, Fire, Wood, Lava, Ice, Plant, Acid, Stone, Dust, Mite, Oil, Rocket, Fungus and Seed.
- Burning is a countdown in `rb`. Wood that touches Fire gets `rb = 90`, Oil gets `rb = 50`, Plant `rb = 20`, Fungus `rb = 10`. Each tick `rb` falls by one and the burning cell may throw Fire into empty neighbors. At `rb == 1` the cell becomes Empty. Water next to a burning cell puts it out (`ra = 50, rb = 0`). — [sandspiel species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)
- Fire's `ra` is its life. It drops by `2 + rand_dir()` each tick, and the fire dies when `ra < 5` or when it touches Water. Fire turns Gas or Dust neighbors into Fire (`ra = 150 + (dx+dy)*10`) and pushes the wind field. — [species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)
- Sandspiel models density as a hard-coded swap list, not a number. Sand swaps down through Water, Gas, Oil and Acid. Water falls into Empty or Oil, so oil floats. Stone sinks through Water, Gas, Oil and Acid but never slides diagonally. — [species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)
- Gas carries a "molecule count" in `rb` (5 to start). It splits when it moves into empty space, leaving `rb = 1` behind, and merges with neighboring gas while the total stays under 4. That is a cheap diffusion and dissipation model. — [species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)
- Acid wears itself out: `degraded = ra - 60`, and it vanishes when that falls below 80. It eats any non-Wall, non-Acid neighbor below, beside or above it. Sandspiel has no glass. — [species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)

**The Powder Toy (TPT), a numeric property schema per element**
- Each element defines these fields:
  - `Advection`, how strongly air moves it;
  - `AirDrag` and `AirLoss`;
  - `Loss`, velocity kept per frame;
  - `Collision`, bounce;
  - `Gravity`;
  - `Diffusion`, random walk, used by gases;
  - `HotAir`;
  - `Falldown`: 0 for solid or gas, 1 for powder, 2 for liquid;
  - `Flammable`, `Explosive`, `Meltable`, `Hardness`;
  - `Weight`, the density used for displacement;
  - `HeatConduct`, out of 255;
  - a `Properties` bitmask (`TYPE_PART`, `TYPE_LIQUID`, `TYPE_SOLID`, `TYPE_GAS`, `PROP_CONDUCTS`, `PROP_DEADLY`, `PROP_LIFE_DEC`, and so on);
  - four transitions (Low and High Pressure, Low and High Temperature), each a threshold plus the element it becomes. — [TPT WATR.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/WATR.cpp)
- Weights from the source:

  | Group | Elements and Weight |
  |---|---|
  | Gases and fire | WTRV (steam) 1, GAS 1, SMKE 1, FIRE 2 |
  | Liquids | ACID 10, OIL 20, NITR 23, WATR 30, SLTW 35, LAVA 45 |
  | Powders | SALT 75, DUST 85, GUNP 85, SAND 90, STNE 90 |
  | Solids | ICEI, GLAS, WOOD, PLNT, METL, COAL, WAX all 100 |

  So oil (20) floats on water (30), salt water (35) sinks under fresh water, and sand (90) sinks through everything liquid. — [TPT elements directory](https://github.com/The-Powder-Toy/The-Powder-Toy/tree/master/src/simulation/elements)
- Gravity per element: SAND and STNE 0.3, WATR, SLTW and OIL 0.1, LAVA 0.15, NITR 0.2. Fire, smoke and steam use −0.1 (they rise). GAS uses 0.0 with `Diffusion` 0.75, as does steam (0.75). — [TPT elements](https://github.com/The-Powder-Toy/The-Powder-Toy/tree/master/src/simulation/elements)
- Temperature transitions, stored in Kelvin:
  - WATR becomes ICEI below 273.15 K and WTRV above 373 K. SLTW freezes at 252.05 K (about −21 °C, so salt lowers the freezing point) and boils at 383 K.
  - SAND melts at 1973 K into LAVA, which remembers it as glass. STNE melts at 983 K into LAVA, SALT at 1173 K, METL at 1273 K, GLAS at 1973 K.
  - WOOD becomes FIRE at 873 K, PLNT at 573 K, GUNP and NITR at 673 K. GAS becomes FIRE at 573 K.
  - OIL becomes GAS at 333 K. WAX becomes MWAX (molten wax) at 319 K. SMKE turns back into FIRE at 625 K.
  - ICEI turns into SNOW under pressure above 0.8. GAS becomes OIL under pressure above 6. — [TPT elements](https://github.com/The-Powder-Toy/The-Powder-Toy/tree/master/src/simulation/elements)
- Lava is one element with a `ctype` that remembers what melted. Its LowTemperature is MAX_TEMP, so it checks whether to solidify every frame, and it turns back into the remembered material once below that material's melting point. Sand melted by fire gets `ctype = PT_GLAS`. That single trick gives sand → lava → glass. — [TPT Simulation.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/Simulation.cpp); [TPT FIRE.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/FIRE.cpp)
- Flammable values: DUST 10, OIL 20, WOOD 20, PLNT 20, ACID 40, GUNP 600, GAS 600, NITR 1000. Explosive: GUNP 1, NITR 2. Meltable: SAND, STNE and SALT 5, METL 1. HeatConduct: WATR 29, ACID 34, OIL and GAS 42, ICEI 46, LAVA 60, PLNT 65, SLTW 75, FIRE and SMKE 88, SAND, STNE and GLAS 150, WOOD 164, COAL 200, METL 251. — [TPT elements](https://github.com/The-Powder-Toy/The-Powder-Toy/tree/master/src/simulation/elements)
- TPT's `Hardness` measures how easily acid eats a material, not how sturdy it is. GLAS is 0 (immune), SAND, STNE and METL 1, WOOD 16, WATR 20, DUST 30. — [TPT elements](https://github.com/The-Powder-Toy/The-Powder-Toy/tree/master/src/simulation/elements); [TPT ACID.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/ACID.cpp)
- Electricity: elements with `PROP_CONDUCTS` (WATR, SLTW, METL and others) carry SPRK, a temporary "spark" that remembers the original element in `ctype` and has a short `life` (4). — [TPT Simulation.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/Simulation.cpp); [WATR.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/WATR.cpp)

**Sandboxels (R74n), data-driven elements**
- Elements are plain JS objects with these fields:
  - `behavior`: a preset function or a 3x3 grid of rule codes;
  - `reactions`: `{other: {elem1, elem2, chance, tempMin, tempMax, burning1, charged, temp1, ...}}`;
  - `temp`, `tempHigh`/`stateHigh`, `tempLow`/`stateLow` (the states can be arrays, picked at random);
  - `density` in kg/m³, `viscosity`, `burn` (ignition chance %), `burnTime` (ticks), `burnInto`, `fireColor`, `conduct` (0–1), `hardness`, `breakInto`, `insulate`, `stain`, `state`. — [Sandboxels index.html](https://github.com/R74nCom/sandboxels/blob/main/index.html)
- Behavior-grid codes: M1 (move, first priority), M2 (move, second priority), SP (support), DL (delete), DB (delete both, self and target), CL (clone), CH (change), CR:x (create x), LB:x (leave x behind), SW (swap), HT (heat), CO (cool), ST (stick), SH (shock), BO (bounce), EX:r (explode on touch), SM (smash), and `%n` for a chance. Acid is the grid `["XX|DB%5|XX", "DB%5 AND M2|XX|DB%5 AND M2", "DB%5 AND M2|DB%10 AND M1|DB%5 AND M2"]`: it eats a neighbor 5% of the time in most directions and 10% straight down. — [Sandboxels index.html](https://github.com/R74nCom/sandboxels/blob/main/index.html)
- Viscosity is a probability. In the LIQUID behavior, a pixel may move sideways only if `Math.random()*100 < 100 / viscosity^0.25`; otherwise it only tries straight down. — [Sandboxels index.html](https://github.com/R74nCom/sandboxels/blob/main/index.html)
  - Worked from that formula: oil (visc 250) about 25%, cement (1000) about 18%, magma (10000) 10%, nitro (36) about 41%. Water sets no viscosity, so it always may spread.
- Lighter-than-air pixels rise with probability `(airDensity − density)/(airDensity + density)` (doAirDensity). DGAS ("dissipating gas", such as smoke) deletes itself 5% of the time per tick before moving like a gas. — [Sandboxels index.html](https://github.com/R74nCom/sandboxels/blob/main/index.html)
- Values from the source:
  - Sand: POWDER, density 1602, `tempHigh 1700 → molten_glass`, with water → `wet_sand`.
  - Water: density 997, boils at 100 into steam, freezes at 0 into ice, `conduct 0.02`.
  - Salt water: density 1026, freezes at −2 (salt_ice), boils at 102 into `["steam","salt"]`, `conduct 0.1`.
  - Ice: WALL, `temp −5`, `tempHigh 5 → water`, density 917.
  - Steam: GAS, `tempLow 95 → water`, density 0.6.
  - Magma (alias lava): MOLTEN, `temp 1200`, `tempLow 800 → [basalt ×3, rock]`, viscosity 10000, density 2725.
  - Rock: POWDER, `tempHigh 950 → magma`, density 2550, hardness 0.5.
  - Glass: WALL, `tempHigh 1500`, density 2500.
  - Wood: WALL, `burn 5`, `burnTime 300`, `burnInto [ember, charcoal, fire]`, `tempHigh 400`, density 600.
  - Fire: `temp 600`, `tempLow 100 → smoke`, `burnTime 25`, `burnInto smoke`, density 0.1.
  - Smoke: DGAS, `temp 114`, `tempHigh 1000 → fire`, density 0.1.
  - Oil: LIQUID, viscosity 250, density 825, `burn 5`, `burnTime 300`, `burnInto [carbon_dioxide, fire]`, `tempHigh 500 → fire`.
  - Plant: WALL, `burn 15`, `burnTime 60`, `tempHigh 100 → dead_plant`, freezes at −1.66.
  - Salt: POWDER, density 2160, melts at 801.
  - Gunpowder: POWDER, `burn 100`, `burnTime 1`, `burnInto [explosion, pop, pop]`, `conduct 1`, explodes when charged (`EX:10`), density 1700.
  - Methane: GAS, `burn 85`, `burnTime 5`, cyan `fireColor`, density 0.554.
  - Charcoal: `burn 25`, `burnTime 1000`.
  - Ash: POWDER, density 700.
  - Snow: POWDER, `tempHigh 18 → water`, density 100.

  — [Sandboxels index.html](https://github.com/R74nCom/sandboxels/blob/main/index.html)
- The Sandboxels wiki gives water's density as 997 kg/m³, conductivity 2%, viscosity 0 cP. It also lists about 30 water reactions: dirt → mud, sand → wet sand, salt → salt water, snow → slush, ash, oil and dust → dirty water, metals → hydrogen and oxygen when charged at 0.75% per tick, and so on. — [Sandboxels wiki: Water](https://sandboxels.wiki.gg/wiki/Water)

**Noita (Nolla Games, the "Falling Everything" engine)**
- Liquids check down, then left and right, and compare density to decide whether to swap. Gases such as steam do the reverse: up, then left and right. Burning pixels pick a random direction and try to ignite neighbors. Oil burns, water does not, and fire on water makes steam. Wood burns for a set time and is then destroyed. Some materials stick to ceilings and fall only rarely. Static materials such as stone skip these rules by default. — [80.lv: Noita, a game based on falling sand simulation](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/)
- Rigid bodies:
  - Each rigid-body pixel stores which body it belongs to and its position within that body. Destroying pixels triggers a shape recalculation that may split the body. Collapses carve shapes out of static terrain and turn them into falling rigid bodies.
  - Large explosions turn suitable hit pixels into collapsing sand. — [80.lv](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/)
  - The engine is custom C++ ("Falling Everything") and uses Box2D for rigid bodies. — [Game Developer: Road to the IGF, Noita](https://www.gamedeveloper.com/disciplines/road-to-the-igf-nolla-games-i-noita-i-) (read via a search summary)
  - A common recreation pipeline for rigid bodies: marching squares turns the pixel blob into a contour, Douglas-Peucker simplifies it, triangulation splits it, and Box2D takes the result. The body is rebuilt when its pixels are destroyed. — [FallingSandJava](https://github.com/mandarinx/FallingSandJava); [CSC417 "Exploring the Tech of Noita"](https://github.com/EDToaster/CSC417-Project)
- Material categories on the community wiki: Solids (static), Liquids (layered by density), Gases (flow upward and pool on cave ceilings), Powders (pile up), and Organic and others.
  - Internal IDs carry suffixes such as `_static`, `_box2d`, `_loose` and `_wall`.
  - Destruction uses two values. Durability is a threshold: an explosion or projectile can destroy a material only if its durability is at or below the attack's level (sand 4, coal and concrete 8, dense rock 10, steel 12, brickwork 14). Hardness is a per-pixel HP: explosion rays spend "ray energy" against it (coal HP 25,000 against rock 100,000; an Energy Orb has ray_energy 350,000). — [Noita wiki: Material](https://noita.wiki.gg/wiki/Material)
- Density on the Noita wiki is "primarily a property of liquids", typically 1–15. — [Noita wiki: Material](https://noita.wiki.gg/wiki/Material) (via search summary)
- Slow natural processes (grass growth, moss, water freezing, snow melting, corpse decay) exist, but the developers said players rarely notice them, so they spent little time on them. — [80.lv](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/)

**Genre history (classic Falling Sand Game, Powder Game)**
- The first popular example was a 2005 Java applet on the Japanese Dofi-Blog, also called "Hell of Sand" or "World of Sand". It "kick-started the genre as a trend and gave it its name." wxSand (2006) was the first standalone version.
- Powder Game (2007, Dan-Ball) added pressure-based fluid simulation (this claim is tagged "citation needed" on Wikipedia). The Powder Toy (2010) added liquid simulation and Newtonian gravity. sand:box (2015) has "advanced digital circuit simulation". Noita came out in 2020. — [Wikipedia: Falling-sand game](https://en.wikipedia.org/wiki/Falling-sand_game)

### Inferences
- **Three schemas, three trade-offs.** Sandspiel's hard-coded swap lists are smallest but least extensible. TPT's numeric fields with hand-written update functions are the most physical (pressure, Kelvin, heat capacity). Sandboxels' data-driven `reactions`, `tempHigh/stateHigh` and `burn/burnTime/burnInto` table is easiest to author. For Tycho, a Sandboxels-style data table compiled into flat typed lookup arrays (density, flags, tempHigh, stateHigh, burn chance and so on, indexed by material id) gives both easy authoring and speed.
- **One weight number covers displacement.** A cell may swap into a neighbor when it moves in its gravity direction and its weight is greater, or less for gases. Both TPT and Noita work this way.
- **Viscosity as "chance to try sideways this tick"** (Sandboxels) and **dispersion as "how many cells sideways per tick"** are two independent liquid knobs. Thick lava wants both low.
- **The "remember what I was" trick** (TPT lava `ctype`, Sandspiel Cloner and Rocket `rb`) lets one molten or charged element stand for many, which saves material ids.
- **Noita's rigid bodies sit outside the grid model.** They need a physics engine (Box2D or similar) plus contour extraction. For a phone JS demo at 320x180, defer rigid bodies; "loose chunks that turn into sand when knocked" (Noita's explosion trick) captures most of the feel.

### Gaps
- I could not get a transcript or slides of Purho's GDC 2019 talk ([GDC Vault](https://gdcvault.com/play/1025695/Exploring-the-Tech-and-Design)). Details on Noita's free particles, its temperature model and its electricity come only from secondary sources, or are missing.
- Noita's `materials.xml` fields (for example `liquid_sand`, `burnable`, `fire_hp`, `autoignition_temperature`, `liquid_gravity`, `liquid_viscosity`) are referenced in search results, but I found no page documenting them. Don't quote values for them without reading the game's data files.
- I found no reliable per-element property data for the original Falling Sand Game or Dan-Ball's Powder Game. Powder Game's source is closed, and its wiki was not retrieved.
- The Powder Toy wiki pages could not be fetched (bot protection). Source code was used instead, so wiki prose such as element descriptions and fan-documented reactions is missing.

## 2. Reaction tables (with probabilities)

### Takeaway
The sources agree on a core set of reactions, and give real per-tick probabilities:
- water and lava make stone and steam;
- heat turns sand into glass, through molten glass;
- acid eats everything except glass (plus a few listed exceptions);
- salt in water makes salt water, which freezes lower;
- oil floats on water and burns;
- wood burns to ash, charcoal or embers plus smoke;
- plants grow into water;
- ice melts near heat, and steam condenses back to water.

Typical probabilities: 1/50 to 1/2000 per tick for slow dissolving or growth, 5–10% for acid and burning, and 100% for instant ones such as lava plus water.

### Cited Findings

**Water and lava make stone and steam**
- Sandspiel: Lava next to Water turns the Water into Stone and removes it, at 100% when the check runs. — [species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)
- Sandboxels: magma touching ice becomes basalt. Magma cooling below 800 becomes basalt 3/4 of the time and rock 1/4. — [Sandboxels index.html](https://github.com/R74nCom/sandboxels/blob/main/index.html)
- Noita: lava poured into water, or the reverse, makes rock while evaporating some water into steam, which condenses and falls as rain. — [Wikipedia: Noita](https://en.wikipedia.org/wiki/Noita_(video_game)) (via search summary)

**Sand and heat make glass**
- Sandboxels: sand above 1700 becomes molten_glass. Glass melts at 1500. — [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html)
- TPT: SAND above 1973 K becomes LAVA with ctype GLAS, which solidifies to glass when cooled. In legacy (no-heat) mode, a fire or lava neighbor melts a Meltable element with chance `Meltable * max(1, pressure) / 1000` per tick, and sand becomes lava(glass). — [TPT SAND.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/SAND.cpp); [FIRE.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/FIRE.cpp)

**Acid dissolves (almost) everything except glass**
- TPT ACID:
  - It scans a 5x5 area. For each non-acid neighbor it dissolves it with chance `Hardness/1000` per tick, while the acid's `life > 50`.
  - Glass protects: no dissolving if `parts_avg(acid, target) == GLAS`. Cloners are excluded.
  - Each dissolve heats the acid by `(60 − Hardness) * 7` and lowers its life by one. Default life is 75, so one acid particle eats about 25 particles and then dies at `life <= 50`.
  - Acid touching gunpowder, nitro or rubidium turns both into FIRE. Acid touching steam becomes CAUS (caustic gas) with chance 1/250. — [TPT ACID.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/ACID.cpp)
- Sandboxels acid deletes both itself and its target (DB) 5% of the time per side and 10% below. Its `ignore` list (immune materials) includes fire, smoke, glass and its variants, water and the other waters, copper, gold, silver, plastic, porcelain, diamond, bone, clay and more. Acid touching ash or limestone becomes neutral_acid. — [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html)
- Sandspiel acid eats any non-Wall neighbor and wears out (its `ra` drops by 60 per dissolve; it dies below 80). — [species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)

**Salt, water and salt water**
- TPT WATR: a SALT neighbor converts the water to SLTW with chance 1/50 per tick, and the salt itself also becomes SLTW with a further 1/3. Contact with salt water slowly salts fresh water (1/2000). SLTW freezes at 252.05 K, against 273.15 K for fresh water, and boils at 383 K against 373 K. — [WATR.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/WATR.cpp); [SLTW.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/SLTW.cpp)
- Sandboxels: water touching salt becomes salt_water, and the salt is consumed, with `temp1: −20` (dissolving cools the water). Salt on ice melts it to salt water at 10% per tick, on snow at 25%. Salt water freezes at −2 and boils into steam plus salt (the salt comes back). — [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html)

**Oil floats on water and burns**
- Weights: TPT OIL 20 against WATR 30. Sandboxels oil 825 against water 997. — [TPT](https://github.com/The-Powder-Toy/The-Powder-Toy/tree/master/src/simulation/elements); [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html)
- In Sandspiel, water falls through and diagonally into Oil, and burning oil lasts `rb = 50` ticks. — [species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)
- In Sandboxels, oil that is already burning and touches water turns the water into "explosion" (a boil-over flare). Above 90 °C, oil cracks into propane, molten plastic or lamp oil at 0.1% per tick. — [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html)
- In TPT, OIL above 333 K becomes GAS, and GAS above 573 K becomes FIRE. — [TPT OIL.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/OIL.cpp)

**Fire, burning, ash and smoke**
- TPT ignition:
  - Each fire particle checks a 5x5 area. A flammable neighbor ignites with chance `(Flammable + pressure*10)/1000` per tick: oil or wood 2%, gunpowder 60%, nitro 100%.
  - The new fire's temperature is fire's default plus `Flammable/2`, and its life is 180–259.
  - Explosive elements add 0.25 pressure when they ignite. Elements with `Explosive & 2` (nitro) detonate into fire when local pressure exceeds 2.5. — [FIRE.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/FIRE.cpp); [Simulation.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/Simulation.cpp)
- TPT water and fire: the fire is always killed, and the water evaporates with chance 1/30. — [WATR.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/WATR.cpp)
- Sandboxels doBurning:
  - A burning pixel gains 1 °C per tick and ignites each adjacent pixel with chance `burn`% per tick.
  - After `burnTime` ticks (default 200) it turns into `burnInto` with chance `burn`% per tick (default 10%; the default result is fire). Until then it has a 10% chance per tick to spawn fire in the empty cell above, or below if above is blocked.
  - Touching an `extinguish` element (water) puts it out.
  - Wood burns into ember, charcoal or fire. Ember becomes ash (`stateLow` and `burnInto`). Fire turns into smoke as it cools below 100. Smoke is a dissipating gas. — [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html)

**Plants grow into water**
- TPT PLNT: a plant beside water turns the water into PLNT with chance 1/50 per tick ("Plant, drinks water and grows"). A lava neighbor makes fire (1/50). Smoke or CO2 becomes O2 (1/50). — [TPT PLNT.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/PLNT.cpp)
- Sandspiel Plant: with about 19% chance per tick (`rand_int(100) > 80`) it writes a Plant into a neighboring Water (or Fungus) cell. Seeds germinate on Sand, Plant or Fungus and grow a stem with about 24% chance per tick (`rand_int(100) > 75`), then petals. — [species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)
- Sandboxels grass grows upward at 0.05% per tick, up to height 2, and spreads sideways onto soil at 0.5% per tick per side. — [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html)

**Ice melts near heat; water freezes**
- Sandspiel Ice: a Fire or Lava neighbor turns it into Water. Ice freezes a neighboring Water to Ice with about 7% chance per tick (`rand_int(100) < 7`), so ice spreads through water. — [species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)
- Sandboxels ice melts above 5 into water. TPT ICEI melts above 252.05 K into the stored ctype (normally water) and turns into snow under pressure above 0.8. — [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html); [TPT ICEI.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/ICEI.cpp)

**Steam condenses**
- TPT WTRV condenses below 371 K (rime if below 273 K, distilled water otherwise). Its boiling and condensing points shift with pressure (`ctemph −= 2*pressure`). — [Simulation.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/Simulation.cpp); [WTRV.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/WTRV.cpp)
- Sandboxels steam condenses below 95 into water. Two steam pixels near the top of the screen (rows 0–15) form a cloud at 5%, and rain clouds rain water at 0.05% per tick. — [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html)

**Other good reactions**
- Water erodes stone: in TPT, flowing water (speed ≥ 0.5) turns STNE to SAND (1/3) or leaves it stone, with chance 1/1000. In Sandboxels, water erodes rock to wet_sand at 0.035% per tick. — [WATR.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/WATR.cpp); [Sandboxels wiki: Water](https://sandboxels.wiki.gg/wiki/Water)
- Dirt plus water makes mud. Mud heated above 100 becomes mudstone and gives off steam. Sand plus water makes wet sand, which becomes packed sand at 100. — [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html)
- Cement is a liquid (viscosity 1000) that sets into concrete 100 ticks after its last mixing, at 10% per tick. — [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html)
- Charcoal plus sulfur makes gunpowder (2%). — [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html)
- Lava plus coal in TPT: LAVA(STNE) touching COAL becomes LAVA(SLCN), silicon, at 1/60. — [FIRE.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/FIRE.cpp)
- Sandspiel Fungus spreads into any non-empty, non-fire, non-ice neighbor and turns Wood into Fungus. Mites eat Plant, Wood and Seed (about 20% per tick when adjacent) and die in Fire, Lava, Water or Oil. — [species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)
- Sandspiel Dust ignites (becomes Fire) when wind pressure exceeds 120, and Stone crumbles to Sand above the same pressure: wind couples to the cells. — [species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)

### Demo material table (26 materials)

This table is a synthesis for a Tycho demo, not a copy of any one game.
- Weight is relative and copied from TPT where TPT has the element (else marked "~", meaning chosen to fit).
- Dispersion is cells per tick sideways for liquids (a design value; Noita-style).
- Ignition and burn values are adapted from TPT's `Flammable`/1000 and Sandboxels' `burn`%/`burnTime`.
- Temperatures are °C, from Sandboxels where it has the element, else TPT converted (K − 273).
- Reaction chances are per tick per touching pair, taken from the cited source where shown, else marked "design".

| # | Material | Class | Weight | Liquid dispersion / viscosity | Ignite chance; burn time | Melts or boils (°C) → | Freezes or condenses (°C) → | Key reactions (chance per tick) | Source basis |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Empty / air | gas (void) | 0 | – | – | – | – | holds ambient heat | all |
| 2 | Wall / bedrock | static | ∞ | – | none | none | – | immune to acid | Sandspiel Wall |
| 3 | Stone | static (or powder when knocked loose) | 90 | – | none | 950 → lava | – | flowing water erodes to sand (1/1000); acid eats (1/1000) | TPT STNE, Sandboxels rock |
| 4 | Sand | powder | 90 | – | none | 1700 → molten glass | – | water → wet sand (100%); acid (1/1000) | Sandboxels sand, TPT SAND |
| 5 | Wet sand | powder (no diagonal slide, sturdy) | ~95 | – | none | 100 → sand + steam | – | dries in heat | Sandboxels wet_sand |
| 6 | Dirt | powder | ~85 | – | none | – | – | water → mud (100%) | Sandboxels dirt |
| 7 | Mud | sturdy powder | ~100 | – | none | 100 → dirt or mudstone + steam | – | – | Sandboxels mud |
| 8 | Water | liquid | 30 | dispersion 4–5, visc 0 | extinguishes fire | 100 → steam | 0 → ice | salt → salt water (1/50); lava → stone + steam; fire → steam (1/30) | TPT WATR, Sandboxels water |
| 9 | Salt water | liquid | 35 | dispersion 4 | extinguishes | 102 → steam + salt | −2 (Sandboxels) / −21 (TPT) → ice | slowly salts water (1/2000) | TPT SLTW, Sandboxels |
| 10 | Salt | powder | 75 | – | none | 801 → molten salt | – | water → salt water (1/50, then 1/3 for salt); ice → salt water (10%) | TPT SALT, Sandboxels |
| 11 | Ice | static | 100 | – | none | 5 → water | – | freezes adjacent water (7%); fire or lava → water | Sandspiel Ice, Sandboxels |
| 12 | Snow | powder | ~40 | – | none | 18 → water | – | salt → salt water (25%) | Sandboxels snow |
| 13 | Steam | gas (rises, diffuses) | 1 | – | none | – | 95 → water | two steam near ceiling → cloud (5%) | TPT WTRV, Sandboxels |
| 14 | Oil | liquid (floats on water) | 20 | dispersion 2, visc 250 (≈25% sideways) | 2%; burns about 50–300 ticks | 500 → fire (TPT: 60 → gas) | – | burning oil + water → flare; floats | TPT OIL, Sandboxels, Sandspiel |
| 15 | Lava | liquid (thick, hot) | 45 | dispersion 1, visc 10000 (10% sideways) | ignites flammables | – | below 800 → stone or basalt | water → stone + steam (100%); melts sand to glass; 2.5% spawns fire above | Sandboxels magma, TPT LAVA |
| 16 | Molten glass | liquid (thick) | ~50 | visc high | ignites | – | below 1500 → glass | – | Sandboxels, TPT lava(glass) |
| 17 | Glass | static | 100 | – | none | 1500 → molten glass | – | acid-proof | Sandboxels glass, TPT GLAS (Hardness 0) |
| 18 | Acid | liquid | 10 | dispersion 3 | 4% (TPT Flammable 40) | – | – | dissolves non-glass, non-wall neighbors (TPT: Hardness/1000; Sandboxels: 5–10%); about 25 dissolves then dies; makes heat; acid + gunpowder → fire | TPT ACID, Sandboxels acid |
| 19 | Wood | static | 100 | – | 2% (TPT) / 5% (Sandboxels); burn 90 (Sandspiel) to 300 (Sandboxels) ticks | 400 → fire | – | burns into ember, charcoal or ash, giving smoke | all three |
| 20 | Plant | static (grows) | 100 | – | 2% / 15%; burn 20–60 ticks | 100 → dead plant (Sandboxels); 300 → fire (TPT) | −2 → frozen plant | grows into adjacent water (1/50 TPT; about 19% Sandspiel); salt kills (0.1%) | TPT PLNT, Sandspiel, Sandboxels |
| 21 | Seed | powder → grows | ~80 | – | burns | – | – | lands on sand or dirt: germinates, stem grows up (24%), then flower | Sandspiel Seed |
| 22 | Fungus / moss | static (spreads) | 100 | – | burns 10 ticks | – | – | creeps over any solid surface; eats wood | Sandspiel Fungus |
| 23 | Fire | gas-like (rises, short life) | 2 | – | – | – | life ends → smoke | ignites neighbors by flammability; killed by water | TPT FIRE (life 180–259), Sandspiel (ra decays 2/tick), Sandboxels (burnTime 25 → smoke) |
| 24 | Smoke | gas (dissipates) | 1 | – | none | 1000 → fire | – | deletes itself 5% per tick | Sandboxels DGAS, TPT SMKE |
| 25 | Ash / ember | powder (ember: brief glowing gas) | ~70 | – | ember is burning | – | ember below 0 → ash | water → dirty water | Sandboxels ash, ember |
| 26 | Gunpowder | powder | 85 | – | 60% (TPT 600/1000) / 100% (Sandboxels); burn 1 tick | 600 → explosion | – | ignites to explosion with radius (Sandboxels EX:10); acid → fire | TPT GUNP, Sandboxels |
| 27 | Methane / swamp gas | gas | 1 | – | 60–85%; burn 5 ticks | 537 → fire | – | burns with blue-cyan fire, a flash fire | TPT GAS (Flammable 600), Sandboxels methane |
| 28 | Metal | static (conducts) | 100 | – | none | 1000 (TPT METL 1273 K) → molten metal | – | carries electricity (spark life 4); HeatConduct 251 | TPT METL |

### Inferences
- A demo needs only three reaction kinds:
  1. **contact reactions**: (A, B) → (A′, B′) with chance p;
  2. **temperature transitions**: above tempHigh → stateHigh, below tempLow → stateLow;
  3. **burning**: ignite chance, burn ticks, burnInto, spawns fire and smoke.

  Sandboxels runs about 600 elements on essentially these three. Tycho could store contact reactions as a dense `N×N` table of (result A, result B, chance as `u8/256`). With 28 materials that is 784 entries.
- Per-tick chances must be tuned to the tick rate. Sandboxels and TPT assume about 30–60 ticks per second. If Tycho runs the sim at 30 Hz on phones, double the chances (or halve the burn times) of numbers taken from 60 Hz sources.
- "Glass is acid-proof" and "acid wears out" are the two rules that make acid playable as a puzzle tool and not a world-eraser. TPT bounds each acid particle at about 25 kills; Sandspiel's `ra` budget does the same.

### Gaps
- Noita's own reaction table (its `materials.xml` reaction entries with probabilities) was not retrieved. The Noita wiki has an "alchemy reaction table" page (Japanese edition seen in search results) that I did not fetch.
- The Powder Game reaction set was not found.
- The "Teardown-like 2D" and Sandustry reaction sets are not public in any source I found.

## 3. Implementation techniques

### Takeaway
The standard CPU design is a single in-place grid:
- scanned bottom-up, with the horizontal direction alternated per row or per frame (or randomized) to remove left/right bias;
- each cell carries a one-bit "clock" or updated flag, flipped per frame, so a cell that moved ahead of the scan is not processed twice;
- packed into a few bytes per cell (Sandspiel: species, ra, rb, clock = 4 bytes, uploaded directly as an RGBA texture).

The alternatives:
- Noita scales up with 64x64 chunks that keep dirty rectangles, and a four-pass checkerboard that lets threads update without locks.
- Margolus 2x2 block updates and double buffering make the update order-independent and GPU-friendly, at the cost of artifacts.
- Sandspiel couples the CPU cells (Rust to WASM) to a GPU Navier-Stokes wind field.
- Particles get velocity by attempting several one-cell moves per tick (jason.today), or by leaving the grid entirely as free particles until they land (Noita, per third-party accounts).

### Cited Findings

**Update order, bias and clock bits**
- Noita: "if you update it from the bottom up, the sequence of the falling rows will be consistent." — [80.lv](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/)
- jason.today, the second post:
  - "We still iterate last row to first, but we randomly swap the direction we iterate", using `const leftToRight = Math.random() > 0.5`.
  - The fix is needed because otherwise "the right particles will always execute their rules before the left ones, causing a bias."
  - The first post had shown that a top-down scan let sand reach the bottom "instantly". — [jason.today: Improving the foundation](https://jason.today/falling-improved); [jason.today: Making a falling sand simulator](https://jason.today/falling-sand)
- HN commenters describe the same bias. A falling pillar acts like a wall against one slope of a cone. The fixes are alternating scan direction per frame (jakear) and randomizing the down-left/down-right check order (jdthedisciple). — [HN thread](https://news.ycombinator.com/item?id=31309616)
- Sandspiel scans left to right and top to bottom, and relies on the per-cell `clock` to stop a falling particle that moved ahead of the scan from being updated again. — [Making Sandspiel](https://maxbittker.com/making-sandspiel)
- Sandspiel water uses the parity of its `ra` byte as a persistent "preferred direction". It moves 2 cells sideways when it can (setting `rb = 6`), else 1 (`rb = 3`). It can copy its direction parity to neighboring water, so a body of water flows coherently, not jittering. — [species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)

**Margolus / block cellular automata**
- The Margolus neighborhood splits the lattice into 2x2 blocks, and the partition shifts between time steps. Norman Margolus first studied block CAs with it. — [LifeWiki: Margolus neighbourhood](https://conwaylife.com/wiki/Margolus_neighborhood)
- Devlin and Schuster (2020) use a "custom, modified Margolus neighborhood" with probabilistic transitions tuned to simulate friction in granular media for games. The search summary of the PDF adds a four-step offset cycle so piles build evenly on both slopes. — [arXiv:2008.06341](https://arxiv.org/abs/2008.06341)
- Emergent Mind's Margolus Sand demo: sand trades places with air below within each block, and the column order is randomized when several moves are possible. — [emergentmind.com/margolus-sand](https://www.emergentmind.com/margolus-sand) (via search summary)
- Known artifacts:
  - falling particles end up separated by blank space (each block moves a grain at most one cell per step);
  - diagonal interactions must pass through orthogonal neighbors.
  - DonHopkins notes that the CAM-6 hardware used x/y/time phase bits in a lookup table, and suggests a gutter of padding cells so the inner loop needs no bounds checks. — [HN thread](https://news.ycombinator.com/item?id=31309616)

**Double buffering versus in-place**
- Some HN commenters suggest a double buffer (writing into a blank next-frame buffer) to remove order artifacts. Others note this gets hard because two cells may want the same target. Sandspiel, Noita and jason.today all update in place. — [HN thread](https://news.ycombinator.com/item?id=31309616); [Making Sandspiel](https://maxbittker.com/making-sandspiel)

**Noita: chunks, dirty rectangles, lock-free threading**
- The world is split into 64×64-pixel chunks. Each keeps a dirty rect of pixels that need updating, and movement marks the chunk for update, so still regions cost nothing.
- Per-pixel "updated" flags across threads would need atomics or locks, which "would slow things down a lot". Instead the world is updated in a checker pattern, "We do this 4 times". Each pass picks every other chunk, and pixels may move within their chunk plus 32 pixels in each direction (which "creates little crosses"), so no two threads touch the same pixel. — [80.lv](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/)
- Other engines copy the pattern: BeefSand updates chunks individually and plans checkerboard threading "as described in Noita's GDC talk". sgshea/sandengine (Rust/Bevy) uses chunked simulation for threading and dirty rectangles. — [BeefSand](https://github.com/BradFitz66/BeefSand); [sandengine](https://github.com/sgshea/sandengine) (via search summaries)
- The multithreading section starts at about 9:20 into the Noita talk. — [HN thread, commenter bo0tzz](https://news.ycombinator.com/item?id=31309616); talk at [GDC Vault](https://gdcvault.com/play/1025695/Exploring-the-Tech-and-Design)

**Sandspiel: WASM cells plus a GPU wind field**
- Particles are simulated on the CPU (Rust compiled to WebAssembly). Wind is a GPU Navier-Stokes simulation adapted from Pavel Dobryakov's WebGL Fluid Simulation, using the pressure, advection and diffusion steps from GPU Gems. Data flows both ways between WASM and WebGL, and the author had to restrict himself to WebGL features that work on most phones. — [Making Sandspiel](https://maxbittker.com/making-sandspiel)
- Cell rules use a `SandApi` with relative `get(dx, dy)` and `set(dx, dy, cell)`. The engine handles edges and enforces a small neighborhood ("no action at a distance"). Bittker's advice is to keep element logic small and move complexity into the engine API. — [Making Sandspiel](https://maxbittker.com/making-sandspiel)
- Coupling, from the source:
  - Cells push the fluid with `set_fluid` (Fire: dy 150, pressure 1, density 120; Lava: dy 10, density 60; burning Oil: dy 10, pressure 10, density 180).
  - Cells read fluid pressure: above 120, Dust ignites, Stone crumbles to Sand and Ice melts. — [species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)
- Rendering: JS makes a `Uint8Array` view over WASM memory and uploads it as an RGBA texture with no copy (4 bytes per cell). A fragment shader picks the color from `species` and `ra`. CPU time for rendering is "less than 1 millisecond". — [Making Sandspiel](https://maxbittker.com/making-sandspiel)

**Per-cell color variation stored at spawn**
- Sandspiel stores a random `ra` at spawn and uses it for the pixel's lightness, the visible grain. Moving cells carry their grain with them. — [Making Sandspiel](https://maxbittker.com/making-sandspiel)
- jason.today's `varyColor` keeps the hue and offsets saturation by −20 to 0 and lightness by −10 to +10, once at creation. Re-parsing color strings every frame was the profiled bottleneck (`Color._parseInputs`): convert colors once at spawn. — [jason.today: falling-sand](https://jason.today/falling-sand); [falling-improved](https://jason.today/falling-improved)
- Sandboxels picks each pixel's color at creation from an element's color list (`pixelColorPick`). Burning elements can have a `fireColor` (methane is cyan). Some elements use texture patterns (glass `colorPattern`) and renderers (`renderPresets.MOLTEN`, `PLANTCHAR`, `CHARCOALHEAT`). — [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html)

**Fire and light rendering**
- TPT marks glowing elements with `PROP_HOT_GLOW` (GLAS, METL) and draws fire with element `graphics` functions. Fire is a short-lived gas cell (life 180–259 when ignited) whose temperature reflects what burned (`fire default + Flammable/2`). — [TPT FIRE.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/FIRE.cpp); [GLAS.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/GLAS.cpp)
- Sandspiel's fire life (`ra`) drives its shading through the shader. The fire's `ra` falls by about 2 per tick, so color can map from life. — [species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs); [Making Sandspiel](https://maxbittker.com/making-sandspiel)
- Sandboxels embers start at alpha 0.2 and brighten by 0.04 per tick. — [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html)

**Velocity and momentum for particles**
- jason.today gives sand `maxSpeed = 8`, `acceleration = 0.4` and `velocity`, reset to 0 on collision. Each tick the integer part of velocity is the number of one-cell move attempts, and the fractional part is the chance of one more attempt. The author: with the faster updates "we can add acceleration and velocity and make the simulation feel much more fluid." — [jason.today: falling-improved](https://jason.today/falling-improved)
- TPT particles carry float `vx, vy` and per-element `Gravity`, `Loss`, `Collision` and `Advection` (how air pushes them). — [TPT WATR.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/WATR.cpp)
- Noita particles, per a third-party Unity manual: "particles are simulated without interacting with the pixel world." A particle is later replaced by a real pixel, creating the illusion it was part of the world all along. — [Kamgam Sand Game Template manual](https://kamgam.com/unity/SandGameManual.pdf) (via search summary; not Nolla's own documentation)

**Temperature fields**
- TPT heat transfer runs per particle with probability `HeatConduct/250` per frame. The particle and its 8 neighbors are set to the heat-capacity-weighted mean temperature: `pt = Σ(temp·hc) / Σ(hc)`. Particles also exchange heat with a coarse air grid `hv[y/CELL][x/CELL]` at a rate `alpha = min(0.04, 0.4·hc)`. The boiling point drops with pressure (`ctemph −= 2·pressure`). — [TPT Simulation.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/Simulation.cpp)
- Sandboxels doHeat: each non-insulating pixel averages its temperature with its right and bottom neighbors (both set to the average), then checks state transitions (`pixelTempCheck`). Heat capacity is commented out (it was tried and dropped). — [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html)
- Sandboxels electricity:
  - A charged pixel passes charge to each adjacent conductor with probability `conduct`. If that fails it heats the neighbor by `charge/4`, a resistance model.
  - Charge decays 0.2 per tick, and then a cooldown of `round(4 + 4·(1−conduct))` ticks applies.
  - Below `superconductAt`, conduct is treated as 1. — [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html)
- Sandspiel has no temperature field. "Heat" lives in per-cell registers (embers), and burning is a countdown. — [Making Sandspiel](https://maxbittker.com/making-sandspiel)

### Inferences
- **Recommended layout for Tycho** (plain JS, ≤320x180):
  - one `Uint8Array` per field (structure of arrays) or one `Uint32Array` of packed cells: `mat` (u8), `shade` (u8: the spawn-time variation, as Sandspiel's `ra`), `life` (u8: burn countdown or fire life, as Sandspiel's `rb`), and a 1-bit clock folded into a flags byte;
  - an optional `Int16Array` temperature (°C) or a coarse temperature grid at 1/4 resolution, the way TPT keeps air heat at CELL resolution;
  - an `Int8Array` vertical velocity, only for falling particles.
- **Clock-bit trick:** flip a global `tick & 1` each frame and store it in a cell when it is updated. A cell whose bit equals the current parity is skipped. This avoids clearing a flag array every frame.
- **Update order:** bottom row to top. Alternate direction per row (cheap) or per frame, and randomize the down-left/down-right choice. To stay deterministic (an Elsewhere rule), use a seeded PRNG such as xorshift32 from `ctx.rng`, never `Math.random`.
- **In place over double buffering.** In-place with clock bits is simpler and has no "two cells want one target" conflicts; save Margolus for a GPU port. Margolus is worth it only if Tycho later moves the sim onto `Tycho.gpu` shaders, because it is the one formulation that is embarrassingly parallel without the cross-shaped chunk rules.
- **Noita-style chunking at phone sizes.** 320x180 splits into 5x3 chunks of 64x64 (with partial chunks), or 10x6 chunks of 32x32. Even single-threaded, per-chunk "awake" flags and dirty rects pay off, because most of a settled world sleeps. Threading is impractical in plain JS without SharedArrayBuffer and workers.
- **Liquids:** use Noita's or Sandspiel's "dispersion N" (try up to N cells sideways in the chosen direction, stopping at obstacles) together with Sandboxels' viscosity chance. Without a dispersion of 3–5, water takes visibly long to level.
- **Rendering with drawPixels:** keep a precomputed `Uint32Array palette[mat*4 + (shade & 3)]` and write `out32[i] = palette[...]` in the same loop as the update, or only for dirty chunks. Under Elsewhere's eight-inks-per-frame rule, `shade` should select among two or three palette inks per material, not free RGB. Fire color can index by `life`.

### Gaps
- Winter's falling-sand article (winter.dev) returned 404 at the URL tried, and search did not find its current location. Its content (chunk-boundary movement and threading in C++) is not represented here.
- The GameDev.net "Recreating Noita's Falling Sand Simulation in C and OpenGL" tutorial returned 403. Its cell struct (velocity, lifetime, updated flag) and dispersion-rate details are not included.
- No primary Nolla source describes how Noita's free particles re-enter the grid, nor Noita's temperature model. The third-party Kamgam claim stands unverified.

## 4. Performance in plain JS on phones

### Takeaway
No source gives a measured "cells per frame in plain JS on a phone" figure. The best anchors:
- Sandspiel runs a 300x300 grid (90,000 cells) in Rust/WASM at 60 fps on many, but not all, devices, with render CPU cost under 1 ms.
- Its author regrets spending headroom on a bigger canvas.
- The main cost is iterating the whole buffer every frame, which is why dirty rectangles and sleeping chunks matter.

At 160x120 (19,200 cells) to 320x180 (57,600 cells), a typed-array JS sim with sleeping chunks is plausible on phones (an inference, not a measurement). Bit-packed cells, no per-cell objects, and no per-frame string or color parsing are the essentials.

### Cited Findings
- Sandspiel moved from 250x250 to 300x300. It hits 60 fps on many devices, but "some devices cannot hit 60 FPS at that size", and the author regrets spending the headroom on a larger canvas. — [Making Sandspiel](https://maxbittker.com/making-sandspiel)
- Building Sandspiel's Rust with `opt-level = 3` instead of size optimization ("z") gave a large speedup (WASM grew from 66 KB to 84 KB). — [Making Sandspiel](https://maxbittker.com/making-sandspiel)
- Rendering is a zero-copy `Uint8Array` view of WASM memory uploaded as an RGBA texture, under 1 ms of CPU per frame. — [Making Sandspiel](https://maxbittker.com/making-sandspiel)
- jason.today's profiling found that most frame time went to color-string parsing (`Color._parseInputs`), not to the simulation. Its fixes:
  - parse once at spawn;
  - track `modifiedIndices` so only changed pixels are redrawn;
  - pause the loop when nothing changed (`needsUpdate()`);
  - make empty-to-empty swaps return early. — [jason.today: falling-improved](https://jason.today/falling-improved)
- HN commenters on JS falling-sand demos:
  - "full-screen buffer iteration every frame" is the main cost (fix: mark empty rectangles, or use a fragment shader);
  - Chrome CPU use is high (suggestion: WebAssembly);
  - pause once the sim settles.
  - One WebGL implementation runs 8 substeps per frame with temperature and stickiness per pixel. — [HN thread](https://news.ycombinator.com/item?id=31309616)
- Noita's dirty rects in 64x64 chunks exist to cut the number of pixels processed. — [80.lv](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/)
- TPT packs element type and particle index into one integer in its position map (`pmap`), read with the `TYP(r)` and `ID(r)` macros, so one array lookup gives both. — [TPT ACID.cpp](https://github.com/The-Powder-Toy/The-Powder-Toy/blob/master/src/simulation/elements/ACID.cpp)

### Inferences
- **Budget arithmetic** (not measured): 320x180 is 57,600 cells, 64% of Sandspiel's 90,000. 160x120 is 19,200, about 21%. Sandspiel's WASM barely holds 60 fps at 90k on weaker phones, and well-written plain JS over typed arrays is commonly slower than optimized WASM by an unmeasured factor. So for Tycho, plan on:
  - (a) sleeping chunks, so typical cost scales with active cells, not total cells;
  - (b) optionally simulating at 30 Hz while rendering at 60;
  - (c) a 160x90 or 160x120 sim layer under a 320x180 view where the whole world is sand. A sand pocket inside a quest's 320x180 scene can be full resolution.
- **Hot-loop rules for V8 and JavaScriptCore:**
  - flat typed arrays indexed `y*W + x`, with a 1-cell border of Wall to drop bounds checks (DonHopkins' gutter);
  - material properties in parallel typed lookup tables (`DENSITY[mat]`, `FLAGS[mat]`), not objects;
  - a switch on a small integer class (powder, liquid, gas, fire, static);
  - no closures or allocation per cell, and no `Math.random` (an inline xorshift).
- **Sleeping chunks:** keep a `Uint8Array awake[chunks]`. A chunk wakes when any cell in it or on its border changes, and sleeps after a frame with no changes. Static and settled powder then costs nothing, which matches how Noita and jason.today avoid work.
- **Heat is the expensive extra.** TPT's per-particle 9-cell weighted average with probability `HeatConduct/250` is the model to copy (stochastic, so only a fraction of cells do work each frame). A quarter-resolution temperature grid would make heat roughly 16x cheaper, at the cost of crisp local melting.

### Gaps
- No primary benchmark exists for plain-JS falling sand on specific phones (for example "N cells at 60 fps on an iPhone 12"). One would need a micro-benchmark in Tycho itself.
- I found no data on the cost of `ImageData`/`putImageData` against WebGL texture upload at 320x180 on phones. Tycho's drawPixels path should be measured directly.

## 5. Game design: what makes the toy fun, and how games use it

### Takeaway
The toy is fun because of emergent chains between simple, legible rules: fire spreads to oil, which boils water to steam, which condenses to rain, which grows plants that then burn. One-tap brushes, an immediate audience, and low-fidelity art that invites imagination help too. Games built on it (Noita, Sandustry) succeed by making the simulation the main verb, then constraining it:
- Noita makes it lethal and roguelike, and skips simulation detail that players don't notice.
- Sandustry makes every grain a resource in a Factorio-style logistics loop.

### Cited Findings
- Bittker's design lessons:
  - make the sim a tool for imagination, with Loren Schmidt quoted: "Low-fidelity art is also appealingly open to interpretation";
  - build an audience in (uploads give each creation viewers without accounts or comments);
  - use touch-friendly single-tap tools and avoid multi-step selection;
  - keep element rules small and self-contained.
  - Sandspiel has had over 70,000 uploaded creations and a couple thousand daily players. — [Making Sandspiel](https://maxbittker.com/making-sandspiel)
- The genre emphasizes free-form play, loose rules and few goals, and interactions between particles can produce "complex emergent behaviour". "Elements" go far beyond sand. — [Wikipedia: Falling-sand game](https://en.wikipedia.org/wiki/Falling-sand_game)
- Noita's team:
  - profile constantly;
  - design parallelism around the sim's constraints;
  - generate worlds from controllable hand-made pieces (Herringbone Wang tiles with randomized contents, such as a 50% chance of a random enemy or item);
  - put effort where players notice: slow processes like moss and freezing went largely unnoticed. — [80.lv](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/)
- Noita's destruction is gated by material durability and hardness, so some materials are effectively indestructible by early tools (sand 4 against brickwork 14). That makes the sandbox a progression system. — [Noita wiki: Material](https://noita.wiki.gg/wiki/Material)
- Sandustry (Lantto Games, published by Hooded Horse) is a mining and automation game on a falling-sand simulation:
  - sand falls, water flows, steam rises, and materials melt, freeze, burn and react;
  - every grain, snowflake, seed, spore and piece of ice is an individual resource;
  - outlets describe it as Factorio's automation inside Terraria's 2D pixel world;
  - its free Steam demo topped Steam's trending-free charts. — [GamingOnLinux](https://www.gamingonlinux.com/2025/06/in-the-side-scroller-automation-game-sandustry-every-single-pixel-is-a-simulated-resource/page=1/); [PCGamesN](https://www.pcgamesn.com/sandustry/steam-hooded-horse); [Notebookcheck](https://www.notebookcheck.net/Mining-game-with-realistic-sand-physics-tops-Steam-s-Trending-Free-charts.955961.0.html); [Steam](https://store.steampowered.com/app/2764460)
- Sources disagree on Sandustry's release status: one listing gives the PC release as August 13, 2026, while the Game Pass listing calls it a Game Preview. — [Steam](https://store.steampowered.com/app/2764460); [TheXboxHub](https://www.thexboxhub.com/sandustry-on-game-pass-turns-every-pixel-into-a-factory-floor/) (via search summary)
- Sandboxels' brush and toy features visible in its source:
  - per-element `cooldown`, so seeds are placed one at a time;
  - "clouds" and "burn" settings that toggle whole reaction families;
  - `breakInto` for a smash tool;
  - "Cloner" elements (Sandspiel too), which turn a single placement into an endless source. — [Sandboxels](https://github.com/R74nCom/sandboxels/blob/main/index.html); [species.rs](https://github.com/MaxBittker/sandspiel/blob/master/crate/src/species.rs)

### Inferences
- For Elsewhere, where each side quest is its own small world, a falling-sand quest fits best as one constrained toy with a goal. For example, put out a fire with a limited water brush, grow a plant up to a ledge by channeling water, or melt sand into a glass bridge with a lava flow. The demo table above already contains each of these chains.
- **Presets that make a good first minute:**
  - a lava pool beside a lake (stone and steam immediately);
  - an oil slick on water with a torch;
  - a sand hourglass;
  - a planted seed on wet ground;
  - an acid vat behind glass (shows the immunity rule).
- **Brushes:** one tap per tool (Bittker's lesson), a circular brush with sparse "aerated" placement (jason.today places with probability 0.5), an eraser, and a heat/cool brush that edits temperature directly (Sandboxels' HT/CO).
- **Keep it legible.** Fewer materials with strong, visible reactions beat many subtle ones (Noita's "players didn't notice moss").
- **Determinism matters for Elsewhere's bots and golden tests.** A seeded PRNG and fixed update order mean `test/smoke.js` and `golden.js` can replay a sand quest exactly.

### Gaps
- No technical post-mortem of Sandustry's simulation (grid size, update model, performance) was found.
- No specific "Teardown-like 2D game" with documented destruction tech was found beyond Noita.
- I found no primary source on Powder Game's design, only Wikipedia's uncited note about its pressure-based fluids.
