# Light

How a pixel game can light its worlds, from a single lamp up to light that bounces, and which techniques keep a frame within its palette. Light in a pixel game sits on a spectrum: at one end, high-bit renderers put pixel sprites under modern light; at the other, strict-palette games let light only choose which ink a pixel shows. The dividing question for every technique is whether light **selects an ink** or **produces new colors**. Smooth, banded, dithered and reprinted light are stages of one pipeline, and only the last stages keep a frame strictly within eight inks. Tile flood fill, shadowcasting and even global illumination are small CPU grids at 320×180; normal maps, bloom and god rays belong to the high-bit look. Tycho already has the high-bit core; what it lacks is the strict core. The sun is on [its own page](sun.md).

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md).

Text marked *(inference)* is reasoning from the sources, not a sourced fact.

- [Selecting an ink](#selecting-an-ink)
- [One pipeline from smooth to reprinted](#one-pipeline-from-smooth-to-reprinted)
- [Ramp-table light](#ramp-table-light)
- [Tile flood fill](#tile-flood-fill)
- [Hard shadows](#hard-shadows)
- [Global illumination](#global-illumination)
- [Normals, glow and shafts](#normals-glow-and-shafts)
- [What runs where](#what-runs-where)
- [Sources](#sources)

## Selecting an ink

Elsewhere's eight-ink rule puts it at the strict end of the spectrum, and Tycho's GPU stand-in, which per frame draws only with fillRect, drawImage, alpha, transforms, gradients and four blends, makes the strict end cheap. Those four blends are **source-over, lighter, destination-out and multiply; there is no `screen`**. The stand-in also already draws an emissive target ("what glows", `gpu.ctx(F.EM)`) and an unlit overlay beside the color target ([the renderer](../renderer.md)).

## One pipeline from smooth to reprinted

The looks from smooth to stylized are stages of one pipeline. A coarse light buffer is computed, upscaled (smooth light), optionally quantized to N levels (bands), and optionally broken at band edges by an ordered threshold (dithered light).

Tycho's `Smooth` model is the first two stages. It holds RGBA bytes per cell, interpolates them bilinearly in a shader, and outputs `clamp(p*m + m*uAdd, 0, 1)` with add = 0.1 ([light.ts](../../src/pixels/light.ts)). That is Unity's two-factor blend with Modulate 1 and Additive 0.1 ([Unity URP](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/LightBlendStyles.html)), and it is fast: Tycho's renderer cut Lodestar's frame from **4.3 to 1.3 ms in Chrome and 20 to 2 ms in WebKit** ([the renderer](../renderer.md)).

Smooth light does break the pixel grid. Godot's docs say lighting "is computed at the Viewport's resolution, not the sprite texture's texel resolution", and they suggest flooring light vertices to the pixel grid ([Godot docs](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html)). Posterizing per-fragment light still leaves "jagged patches that break up the pixel grid" unless shading is done per texel ([Unity forum](https://discussions.unity.com/t/the-quest-for-efficient-per-texel-lighting/700574)).

In rising order of style:

1. Smooth light, in cells smaller than a tile.
2. Light snapped to art pixels.
3. Quantized bands.
4. Bands with Bayer edges.
5. Palette reprint, where light only selects among inks.

**Only the last, or bands resolved to inks through a ramp table, keeps a frame strictly within eight inks** *(inference)*.

<figure class="demo"><div class="stage" data-demo="lights"></div>
<figcaption><b>Seven ways to light a room.</b> <i>Smooth</i> multiplies a continuous light map over the room: no bands, no dither. <i>Banded</i> cuts the same light into five palette reprints, each ink stepping only along its own ramp. <i>Dither</i> blends between those reprints with a Bayer 4×4 anchored to the world, never random noise. <i>Shadows</i> casts rays from each light, with an optional penumbra. <i>Tile flood</i> spreads light cell to cell as Terraria and Minecraft do, blocky or blended. <i>Normals</i> lights normals generated from height. <i>GI</i> (global illumination, light that bounces) lets lava and the window light the walls and crates, which bounce it on in their own color, cached until a light moves. Drag to carry the lantern; Light map shows the buffer alone.</figcaption></figure>

## Ramp-table light

Ramp-table light has a clear public model. LutLight2D gives each palette color its own hand-made gradient "starting from the original, lightest, to the darkest" and picks the replacement by light brightness, so it "keeps the original colors of the palette" ([LutLight2D](https://github.com/unitycoder/LutLight2D)). Bloodless used "a 4-color palette and used lighting to blend between those colors with dithering on the borders" ([Game Developer](https://gamedeveloper.com/art/deep-dive-behind-the-starkly-stylish-art-direction-of-bloodless)), and Lodestar already runs 16 stepped bands with violet darks through `gpu.lightPass` ([Lodestar gllight.js](https://github.com/doctorallen/lodestar/blob/main/js/gllight.js)).

Bayer beats noise for the band edges ([Surma: Ditherpunk](https://surma.dev/things/ditherpunk/)):

| Threshold | Problem |
|---|---|
| Random | Leaves "clusters of bright pixels and voids of darker pixels" |
| Blue noise | Better, but slow to make: about a minute for 64×64 in JavaScript, so it must be baked offline |
| Error diffusion | "Is sequential and not suitable to run on a GPU" |
| Bayer | A pure function of position; indexed by world pixel rather than screen pixel, it travels with the ground and never crawls *(inference)* |

Without a shader, the strictest path is a JavaScript loop `out[i] = rampLUT[ink[i]*N + band[i]]` over a frame composed as indexes and uploaded with `drawPixels`. That is about 60,000 table reads at 320×180, estimated at well under a millisecond but not measured on phones *(inference)*. The cheaper stand-in path prints each layer once per band and draws the right print per light region *(inference)*.

Light colors combine best in the CPU buffer. Screen blending is unavailable in the stand-in, but `1 − Π(1 − Lᵢ)` per cell gives a non-clipping mix of many lights before the multiply, and warm and cool light can choose between two ramp tables per ink *(inference; blend formulas from [W3C Compositing](https://www.w3.org/TR/compositing-1/))*.

## Tile flood fill

Three shipped engines compute light per tile on the CPU and interpolate it on the GPU.

| Engine | Spread | Numbers |
|---|---|---|
| Minecraft | Block light floods outward, losing one level per block of taxicab distance; sky light passes straight down without loss; smooth lighting darkens face corners by their diagonal neighbors | 16 levels; sky light at 15 ([Minecraft Wiki: Light](https://minecraft.wiki/w/Light)) |
| Terraria (1.4.4.1 decompile) | Float RGB light spread by two passes of four directional running-max sweeps; each tile corner takes the average of its four tiles as a vertex color | **0.91 per air tile, 0.56 per solid tile**; water tinted by per-channel decay (0.88, 0.96, 1.015) × 0.91; stops below 0.0185 ([LightMap.cs](https://github.com/br4dnblehh/terraria-source-code/blob/main/1.4.4.1/Terraria.Graphics.Light/LightMap.cs); [Lighting.cs](https://github.com/br4dnblehh/terraria-source-code/blob/main/1.4.4.1/Terraria/Lighting.cs)). An unofficial decompile, cited for the algorithm |
| Starbound (the community OpenStarbound fork) | An "octagonal based cellular automata" with a linear drop and a hue-preserving color falloff; point lights use Xiaolin Wu lines to make obstruction fractional | The drop scaled by √2 on diagonals ([OpenStarbound header](https://github.com/OpenStarbound/OpenStarbound/blob/main/source/base/StarCellularLightArray.hpp); [OpenStarbound source](https://github.com/OpenStarbound/OpenStarbound/blob/main/source/base/StarCellularLightArray.cpp)) |

At Elsewhere's scale this is trivial. A 40×23-tile view with a light-radius border is about 2,600 cells, and Terraria's sweeps are about 20,000 cell visits a frame, all deterministic and handed straight to `Smooth`, whose bilinear filter matches Terraria's corner averaging *(inference)*. Linear falloff quantizes into evenly spaced rings, which suits bands; Terraria's exponential tail crowds rings near the source *(inference)*.

## Hard shadows

Hard shadows come cheapest from grid shadowcasting. Adam Milazzo measured recursive shadowcasting at **89,577 runs per second on an empty 20×20 map against 83,608 for ray casting**, concluding "a well-implemented shadow casting algorithm beats ray casting every time", though it has blind corners and narrow diagonal vision ([Milazzo](http://www.adammil.net/blog/v125_Roguelike_Vision_Algorithms.html)). Written into the light cells, it gives tile shadows that `Smooth` softens for free *(inference)*.

| Method | Fit |
|---|---|
| Red Blob's visibility sweep | Exact polygons, which must be rasterized into the light grid because the stand-in has no path fills ([Red Blob Games](https://www.redblobgames.com/articles/visibility/)) |
| Matt DesLauriers's 1D polar shadow map | Stores the nearest hit per angle in a 256×1 texture and blurs nine neighboring angles for softness, but "will not perform well on Android" as a shader ([mattdesl](https://github.com/mattdesl/lwjgl-basics/wiki/2D-Pixel-Perfect-Shadows)). Its CPU twin, raymarching 256 angles from a light, is plausible for a few lights at 160×90 *(inference)* |
| Godot's unfiltered shadows | "Fastest, suited to pixel art" ([Godot docs](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html)) |

## Global illumination

Global illumination (GI) is light that bounces: a lamp lights a wall, and the wall lights what's near it in its own color. It is the far end of the spectrum.

- **Jump-flood GI**: Sam Bigos's runs ten passes for a 768×512 buffer and casts 32 rays per pixel with up to 128 steps each, and it stays noisy ([Bigos](https://samuelbigos.github.io/posts/2dgi1-2d-global-illumination-in-godot.html)).
- **Radiance cascades**, unveiled by Alexander Sannikov of Grinding Gear Games in November 2023, cost "roughly the cost of the naive method at 16 rays, but without noise" ([80.lv](https://80.lv/articles/radiance-cascades-new-approach-to-calculating-global-illumination); [jason.today](https://jason.today/rc); [GM Shaders](https://mini.gmshaders.com/p/radiance-cascades)).

A CPU cascade at 160×90 might take 2 to 10 ms, which makes a noise-free bake of static light per room possible. But under eight inks GI reduces to "which band, which ink", so it suits at most one showcase world with a high-bit look *(inference)*.

<figure class="demo"><div class="stage" data-demo="gi-3d"></div>
<figcaption><b>The same room in real 3D, with real bounced light.</b> The room above is rebuilt as 48×28×13 voxels. Direct light from the torch, lamp, crystal, lava and moonlit window is computed exactly for every pixel, with soft shadows. Bounced light comes from a grid of 448 probes that sample the room in fixed directions. Each probe blends its new answer into its old one, so the bounce glides after a carried lamp instead of flickering, and it settles in about 2 seconds. Compare <i>Direct only</i> with 2 bounces, or show <i>Bounce only</i> to see just the light that came off other surfaces. <i>Pixel finish</i> forces the result back into the palette's ramps. Drag to orbit, tap to place the lamp. In a game this would be computed ahead of time per room and stored as a band index per face, so only drawImage runs each frame.</figcaption></figure>

## Normals, glow and shafts

The high-bit games buy their look with per-pixel tools.

- **Normal maps.** Dead Cells redrew backgrounds as normal maps, so "a torch on the left of a statue will light up the statue from the correct direction while respecting its base colours" ([80.lv](https://80.lv/articles/interview-with-the-developers-of-dead-cells)). The Siege and the Sandfox warns that one pixel can hold only one normal, so artists should favor angles over gradients ([Game Developer](https://gamedeveloper.com/art/adding-depth-to-2d-with-hand-drawn-normal-maps-in-i-the-siege-and-the-sandfox-i-)). Children of Morta stretched its sprites about four times so lighting could run at a finer resolution than the art ([TechRaptor](https://techraptor.net/content/how-dead-mage-created-the-art-for-children-of-morta)). For a strict palette, the equivalent is baking four or eight light directions per sprite, each quantized to the inks, and picking the nearest at draw time *(inference)*.
- **Bloom.** Threshold bloom, such as Phaser's default of 0.55, makes every light ink glow in an eight-ink palette, so glow should come from the emissive target or from halos baked once and drawn with `lighter` ([Phaser](https://phaser.io/packs/post-bloom.md); *the palette consequence is an inference*).
- **God rays.** Screen-space god rays blur an occlusion mask toward the light, as three.js does in three passes of six samples ([three.js ShaderGodRays](https://github.com/timoxley/threejs/blob/master/examples/js/ShaderGodRays.js)). On the stand-in, a few baked shaft sprites breathing in alpha give most of the look *(inference)*.

## What runs where

| Technique | Tier | Per-frame cost at 320×180 | Stays in the inks? | Suits |
|---|---|---|---|---|
| Coarse grid, smooth multiply (`Smooth`, `ctx.lightMap`) | Stand-in | grid fill and one quad | no | high-bit |
| Tile flood fill (Minecraft BFS, Terraria sweeps, Starbound CA) | CPU, then stand-in | about 10k to 20k cell visits | depends on final step | both |
| Bands through a per-ink ramp table | `drawPixels` or shader | about 60k table reads (estimate) | **yes** | strict |
| Band reprints per layer | Pre-bake, then stand-in | N× memory, near zero per frame | **yes** | strict |
| World-anchored Bayer band edges | Shader, `drawPixels` or baked masks | per pixel | **yes** | strict |
| Grid shadowcasting into the light grid | CPU | microseconds | depends | both |
| Sun shadows as affine card images | Stand-in, baked per sun step | one drawImage per caster | yes, in a shadow ink | both |
| Iso faces relit per sun step | Pre-bake | zero between steps | **yes** | strict |
| Time-of-day palette rows | Pre-bake, then stand-in | crossfade of two draws | yes, except mid-fade | strict |
| Baked directional sprite variants | Pre-bake | zero | **yes** | strict |
| Live normal-mapped sprites | Shader | per pixel per light | no | high-bit |
| Penumbra fins, 1D polar shadow maps | Shader (CPU twin possible) | per light | no | high-bit |
| Jump-flood GI, radiance cascades | Shader, or a static bake | millions of reads; 2 to 10 ms CPU estimate | no | high-bit showcase |
| Baked glow halos and shaft sprites | Pre-bake, then stand-in | one drawImage each | nearly | both |
| Downsampled screen bloom | Stand-in | two or three drawImage calls | no | high-bit |

The tiers and costs are inferences from the cited mechanisms and Tycho's renderer limits ([the renderer](../renderer.md)). The demos above run them this way in Tycho's terms:

| Technique | Where it runs | How |
|---|---|---|
| Light grids with shadowcasting | CPU cells, then `light.Smooth` | Already drawable per frame |
| Stepped, dithered light bands | CPU buffer, or shader | Pick one of N palette reprints per pixel by light level: `drawPixels` at internal resolution, or `gpu.lightPass` (Lodestar's precedent) |
| Sun and shade by time of day | Pre-bake per sun step | Relight faces when the sun crosses a step; affine shadow sprites per frame |
| Normal-mapped sprites | Shader, or pre-bake | Bake a few light directions instead |
| Soft shadows, bounced light (GI) by jump flood or radiance cascades | Shader, or a pre-bake per room | Bake once per light move at 160×90; poor value at eight inks |
| Bounced light (GI) in a real 3D voxel room | Pre-bake per room, offline | Store a band index per voxel face; drawImage per frame. The live version runs a probe grid (as in DDGI) on the GPU and CPU |

Tycho already has the high-bit core (`Smooth`, `ctx.lightMap`, `ctx.tint`, the emissive target and `post.Blur`). What it lacks is the strict core: a sun, a `tilelight` that writes the cells `Smooth` reads, a ramp light model with world-anchored Bayer, and bake helpers for faces, shadows, halos and directional variants.

## Sources

- Tycho: [the renderer](../renderer.md) and [light.ts](../../src/pixels/light.ts)
- [Unity URP, 2D light blend styles](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/LightBlendStyles.html) and [Unity forum, per-texel lighting](https://discussions.unity.com/t/the-quest-for-efficient-per-texel-lighting/700574)
- [Godot docs, 2D lights and shadows](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html)
- [LutLight2D](https://github.com/unitycoder/LutLight2D)
- [Game Developer, the art direction of Bloodless](https://gamedeveloper.com/art/deep-dive-behind-the-starkly-stylish-art-direction-of-bloodless)
- [Surma, Ditherpunk](https://surma.dev/things/ditherpunk/)
- [W3C, Compositing and Blending](https://www.w3.org/TR/compositing-1/)
- [Minecraft Wiki, Light](https://minecraft.wiki/w/Light)
- Terraria 1.4.4.1 decompile: [LightMap.cs](https://github.com/br4dnblehh/terraria-source-code/blob/main/1.4.4.1/Terraria.Graphics.Light/LightMap.cs) and [Lighting.cs](https://github.com/br4dnblehh/terraria-source-code/blob/main/1.4.4.1/Terraria/Lighting.cs)
- OpenStarbound: [StarCellularLightArray.hpp](https://github.com/OpenStarbound/OpenStarbound/blob/main/source/base/StarCellularLightArray.hpp) and [.cpp](https://github.com/OpenStarbound/OpenStarbound/blob/main/source/base/StarCellularLightArray.cpp)
- [Adam Milazzo, roguelike vision algorithms](http://www.adammil.net/blog/v125_Roguelike_Vision_Algorithms.html)
- [Red Blob Games, 2D visibility](https://www.redblobgames.com/articles/visibility/)
- [Matt DesLauriers, 2D pixel-perfect shadows](https://github.com/mattdesl/lwjgl-basics/wiki/2D-Pixel-Perfect-Shadows)
- [Sam Bigos, 2D global illumination in Godot](https://samuelbigos.github.io/posts/2dgi1-2d-global-illumination-in-godot.html)
- Radiance cascades: [80.lv](https://80.lv/articles/radiance-cascades-new-approach-to-calculating-global-illumination), [jason.today](https://jason.today/rc), [GM Shaders](https://mini.gmshaders.com/p/radiance-cascades)
- [80.lv, interview with the developers of Dead Cells](https://80.lv/articles/interview-with-the-developers-of-dead-cells)
- [Game Developer, hand-drawn normal maps in The Siege and the Sandfox](https://gamedeveloper.com/art/adding-depth-to-2d-with-hand-drawn-normal-maps-in-i-the-siege-and-the-sandfox-i-)
- [TechRaptor, the art of Children of Morta](https://techraptor.net/content/how-dead-mage-created-the-art-for-children-of-morta)
- [Phaser, post bloom](https://phaser.io/packs/post-bloom.md)
- [three.js, ShaderGodRays](https://github.com/timoxley/threejs/blob/master/examples/js/ShaderGodRays.js)
- [Lodestar gllight.js](https://github.com/doctorallen/lodestar/blob/main/js/gllight.js)

The full research is in the notes on [2D lighting](notes/lighting_types_2d.md) and on [effects and rendering](notes/effects_rendering.md).

<script src="demos/kit.js"></script>
<script src="demos/lights.js"></script>
<script src="demos/gi-3d.js"></script>
<script src="demos/start.js"></script>
