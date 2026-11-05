# 2D lighting techniques for pixel-art games, from smooth to stylized (a catalog for Tycho's roadmap)

Scope note: researched 2026-11-03. This catalog goes deeper than the lighting section of `effects_rendering.md` in this folder, which already covers Tycho's renderer, Red Blob's sweep, naive JFA GI, radiance cascades in outline, normal-map generators and Terraria's light modes. Those findings are not repeated here except where an algorithm needs them.

**Execution tiers.** Every technique is rated on where it can run:
- **[B] pre-bake.** Painted once on an offscreen canvas, where anything goes.
- **[S] stand-in.** Per frame through Tycho's GPU stand-in: fillRect, drawImage, globalAlpha, gradients, transforms, the blends source-over / lighter / destination-out / multiply, `ctx.tint`, `ctx.lightMap` (multiply by the Smooth model's map, pixel by pixel), and `ctx.drawPixels` (a CPU-written picture uploaded each frame). The CPU may compute anything small in JS first.
- **[H] shader.** Needs a fragment shader through `gpu.program` / `gpu.lightPass`.

**Two corrections to the brief's API list:**
- The stand-in has no `screen` blend. Its composite ops are source-over, lighter, destination-out and multiply (copy and source-in map to 0). — [vendor/tycho/docs/renderer.md](file:///Users/david/projects/elsewhere/vendor/tycho/docs/renderer.md); see also `effects_rendering.md`
- The stand-in already has an emissive target (`gpu.ctx(F.EM)`, "what glows") beside the color target, and an unlit overlay target. — [vendor/tycho/docs/renderer.md](file:///Users/david/projects/elsewhere/vendor/tycho/docs/renderer.md)

**Provenance.** Two engine sources here are not official:
- The Terraria code quoted is a decompile of 1.4.4.1 hosted on GitHub.
- The Starbound code is OpenStarbound, a community fork of Starbound's engine source.

Both are cited for the algorithms they show, and their status is flagged where they are used.

## Smooth light maps versus banded light versus dithered light

### Takeaway
The three looks are three stages of one pipeline:
1. Compute a coarse light buffer.
2. Upscale it, which gives smooth light.
3. Optionally quantize it to N levels, which gives bands. Quantizing can also mean picking a palette ramp step, which gives "reprint" lighting.
4. Optionally break the band edges with an ordered (Bayer) threshold, which gives dithered light.

Smooth bilinear light over crisp sprites is what most commercial games ship (Terraria's Color mode, Godot's and Unity's 2D lights), and it does break the pixel grid. The fixes are to snap the light to the art's pixel grid, to quantize it, or both. Bayer beats noise for dithering light: it is stable, tileable, position-only and reads as a deliberate pattern. White noise clumps and leaves voids, and it shimmers if reseeded.

### Cited Findings

**Smooth light maps (multiply a low-resolution buffer)**
- **Tycho's existing model is exactly this.** `Smooth` is a cell grid of RGBA bytes, `cell` view px per cell, bilinearly interpolated in the shader:
  - `t = (v - uOrg)/uCell - 0.5; m = mix(mix(cell(t0), cell(t0+(1,0)), f.x), mix(cell(t0+(0,1)), cell(t0+1), f.x), f.y)`
  - output `clamp(p*m + m*uAdd, 0, 1)`, which is the scene times the map plus a little of the map (add = 0.1).
  - The same map multiplies quads drawn with `ctx.lightMap`.
  
  — [vendor/tycho/src/pixels/light.ts](file:///Users/david/projects/elsewhere/vendor/tycho/src/pixels/light.ts); [vendor/tycho/docs/renderer.md](file:///Users/david/projects/elsewhere/vendor/tycho/docs/renderer.md)
- **Unity URP 2D** renders each light blend style into its own render texture, at an adjustable "Render Texture Scale". Lowering the scale saves fill rate, but "too low a value may cause visual artefacts or a shimmering effect" when objects move. — [Unity URP 14 Light Blend Styles](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/LightBlendStyles.html)
- **Unity expresses every 2D light blend as two factors:**
  - Multiply: Modulate = 1, Additive = 0.
  - Additive: Modulate = 0, Additive = 1.
  - Subtractive: Modulate = 0, Additive = −1.
  
  Tycho's `p*m + m*add` is the same two-factor form with Modulate = 1 and Additive = 0.1. — [Unity URP 14 Light Blend Styles](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/LightBlendStyles.html); [light.ts](file:///Users/david/projects/elsewhere/vendor/tycho/src/pixels/light.ts)

**Does bilinear light break the pixel look?**
- **Godot's docs say it plainly.** Lighting "is computed at the Viewport's resolution, not the sprite texture's texel resolution", and nearest texture filtering "affects only how the engine samples textures", so it does not pixelate lighting. The suggested fix is a canvas_item shader that `floor()`s LIGHT_VERTEX and SHADOW_VERTEX to a pixel grid. — [Godot docs: 2D lights and shadows](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html)
- **Posterizing doesn't fix it either.** Per-fragment lighting that is then posterized produces "jagged patches that break up the pixel grid". The proposed remedy is to shade per texel, snapping UVs to texel centers so falloff follows the art's grid. That needs light UVs at the albedo's texel density. — [Unity forum: The quest for efficient per-texel lighting](https://discussions.unity.com/t/the-quest-for-efficient-per-texel-lighting/700574)
- **Normal-mapped pixel art shows the same symptom** even with nearest filtering. The fix is to quantize UVs to the sprite's pixel grid with floor before sampling. — [Godot forum: Pixel perfect cell shading with normal maps](https://forum.godotengine.org/t/pixel-perfect-cell-shading-with-normal-maps/103199)
- **Terraria's approach.** The "Color" and "White" modes use "pixel clusters smaller than tiles" for smooth transitions. "Retro" keeps one light level per tile, giving a blocky look at lower cost. — [Terraria Wiki: Lighting mode](https://terraria.wiki.gg/wiki/Lighting_mode). The interpolation is described under the tile flood-fill question below.

**Banded light and palette reprint tables**
- **LutLight2D (Unity) is the clearest public implementation of ramp-table light.**
  - Each palette color gets its own hand-defined shading gradient, stored in a PNG, "starting from the original, lightest, to the darkest".
  - These are baked to LUTs. Each pixel's replacement color is "taken from the tables depending on the brightness from the lighting texture".
  - It "keeps the original colors of the palette", and it can optionally interpolate between steps for smooth transitions.
  
  — [unitycoder/LutLight2D](https://github.com/unitycoder/LutLight2D)
- **A precedent in Tycho's orbit.** Lodestar quantizes light to `T.art.lightSteps = 16` bands, with darks tinted violet, and runs a stepped, dithered light shader through `gpu.lightPass`. — `local_games_and_tycho.md` in this folder; [light.ts header](file:///Users/david/projects/elsewhere/vendor/tycho/src/pixels/light.ts)
- **Bloodless** used "a 4-color palette and used lighting to blend between those colors with dithering on the borders". — [Game Developer: Bloodless art direction](https://gamedeveloper.com/art/deep-dive-behind-the-starkly-stylish-art-direction-of-bloodless)

**Ordered (Bayer) versus noise dithering**
- **How Bayer works:**
  - Threshold each pixel against a tiled matrix, using "brightness > bayer value".
  - Bayer(0) = [[0,2],[3,1]]. Bayer(n) is four copies of 4·Bayer(n−1), offset by 0, 2, 3 and 1 in the quadrants.
  - Normalize by 2^(2n+2).
  - The plain matrix renders the image lighter than the original, so the article inverts the comparison to compensate.
  
  — [Surma: Ditherpunk](https://surma.dev/things/ditherpunk/)
- **Why white noise looks bad.** A random threshold map is "by no means good". It "inevitably will be clusters of bright pixels and voids of darker pixels", and details are lost where dark areas land in clusters. — [Surma: Ditherpunk](https://surma.dev/things/ditherpunk/)
- **Blue noise** suppresses low frequencies, so clusters and voids are "less pronounced", and it tiles seamlessly. Void-and-cluster generation (Ulichney 1993) is slow: about 1 minute for a 64×64 texture in Surma's JS, roughly halved with an FFT blur. That means it should be baked offline and shipped as an asset. — [Surma: Ditherpunk](https://surma.dev/things/ditherpunk/)
- **Error diffusion** (Floyd–Steinberg, Atkinson) "is sequential and not suitable to run on a GPU". Obra Dinn uses ordered dithering (Bayer plus blue noise) in a shader. — [Surma: Ditherpunk](https://surma.dev/things/ditherpunk/)

### Inferences

**The banded or dithered light step, as pseudocode** (it fits in a light shader [H]; on the CPU, it is the [S] variant):
```
L = lightmap(px)                         // 0..1, from the coarse buffer
if snapToArt: sample L at floor(px/artPx)*artPx + artPx/2    // light per art pixel, not per screen pixel
s = L * (N-1)                            // N = ramp steps (3–5 for an 8-ink look)
k = floor(s); f = s - k                  // band and position inside it
if dither: k += (f > bayer4[px.y&3][px.x&3]) ? 1 : 0      // Bayer only inside the band edge
else:      k += (f > 0.5) ? 1 : 0
out = ramp[materialOrInk(px)][k]         // reprint table: the ink index → its k-th shade
```

**Where each look can run:**
- **Smooth multiply [S].** Draw a tiny canvas scaled with smoothing and multiply it, or use `Smooth` / `ctx.lightMap`. Cost: one full-screen quad plus a JS grid fill.
- **Banded light [S] or [B].** Two routes, with no shader:
  - Quantize the coarse grid in JS, then draw it scaled **without** smoothing (`imageSmoothingEnabled = false`). That gives hard steps aligned to cells. Or draw it with smoothing on a 2-to-3-step map. In both cases the scene stays on-palette only if the multiply colors are chosen so ink × step lands on another ink, and in general it won't.
  - The truly palette-safe route on the stand-in is a **reprint per band**. `Ink` keeps pictures as palette indexes, so print each layer once per light step (say 3 or 4 offscreen canvases) and draw the right one per cell, clipping with drawImage source rectangles per tile or per light region.
  - Memory is N× the layer. Per-pixel blending between bands is impossible this way, but band edges can be dithered by baking a Bayer-masked transition tile.
- **Banded light by ink-index lookup per pixel [S via drawPixels].** At 320×180 = 57,600 px, a JS loop over palette indexes (`out[i] = rampLUT[ink[i]*N + band[i]]`) uploaded with `drawPixels` is about 60k table reads per frame, well under 1 ms in a modern JS engine. This is my estimate, not a measurement. It is the most faithful palette-locked light without a shader, but it needs the frame as indexes (one Uint8Array per frame composed from Ink's index buffers) rather than as RGB canvases.
- **Dithered bands [H] or [S via drawPixels].** The Bayer comparison is per pixel. A [B] alternative: pre-render 4×4 or 8×8 Bayer "transition masks", one per level (16 or 64 masks), and multiply or destination-out them at band edges.

**Why hash or noise dithering looks bad here:**
- It draws its threshold from a hash of position (white noise), and white noise clumps (Surma). That reads as the "noise" the house look forbids (CLAUDE.md: "a few bold marks, no noise"; Lodestar: "texture in clusters, never speckle").
- If the hash is reseeded per frame it boils.
- If it is fixed to screen space it slides against the world as the camera moves, the "shower door" effect.
- Bayer's regular cross-hatch reads as a deliberate texture, the same at every frame for the same light. At a 2-ink edge it is a clean 50% checker.
- For a world that scrolls, index the Bayer matrix by **world** pixel (px + camera, mod 4), so the pattern travels with the ground.

**Bilinear-on-crisp, how to handle it.** In rising order of style:
1. Accept smooth light, but keep the cells smaller than a tile (Terraria Color mode).
2. Snap light sampling to art pixels (Godot's floor trick).
3. Quantize to a few levels.
4. Quantize plus Bayer dither at edges.
5. Palette reprint, where light only selects among inks.

For Elsewhere's 8-ink rule, only 5 (or 4 resolved to inks) keeps the frame strictly within eight inks.

### Gaps
- No primary source was found on how Hyper Light Drifter or Blasphemous dither or band their light. A Steam community post only suggests "blending and opacity on the lighting layer" ([Steam discussion](https://steamcommunity.com/app/257850/discussions/0/357284767236620083)).
- No JS timing for a 57,600-pixel index-to-ramp loop on phones was found. The sub-millisecond figure above is an estimate.

## Tile flood-fill light: Minecraft, Terraria, Starbound, and per-tile interpolation

### Takeaway
All three engines compute light per tile on the CPU and interpolate on the GPU:
- **Minecraft:** integer BFS flood fill, −1 per block of taxicab distance, 16 levels, two channels (sky and block), then per-vertex smoothing with corner occlusion.
- **Terraria:** float RGB, propagated by repeated **directional max-sweeps** with multiplicative decay (×0.91 per air tile, ×0.56 per solid tile), two passes of four sweeps, then corner colors averaged from the four tiles at each corner and interpolated across each tile quad.
- **Starbound:** "spread" light by an octagonal cellular automaton (two diagonal-inclusive sweeps per pass, subtractive drop, √2 for diagonals), plus "point" light whose obstruction is found by a Xiaolin Wu antialiased line from the light to every cell.

All of this is cheap at Elsewhere's scale (a 40×23-tile view is about 900 cells) and fully deterministic.

### Cited Findings

**Minecraft**
- **Levels and spread:**
  - 16 levels, 0 to 15. Block light spreads by flood fill, losing 1 per block of taxicab distance, so a torch at 14 gives 13 to adjacent blocks and 12 to diagonal ones.
  - Sky light at 15 passes straight down through transparent blocks without loss. Spreading sideways or up costs 1.
  - Filtering blocks (water, leaves, ice and others) cost 1 in Java Edition. In Bedrock the cost varies by block.
  - Some blocks have directional opacity.
  
  — [Minecraft Wiki: Light](https://minecraft.wiki/w/Light)
- **Combining the channels.** Client light = max(sky, block). Internal sky light is 15 at noon, 12 in rain, 10 in thunder and 4 at midnight. The **lightmap texture** is indexed by block light on one axis and sky light on the other, so day/night is a change of lookup table, not a re-propagation. — [Minecraft Wiki: Light](https://minecraft.wiki/w/Light)
- **The historical brightness curve.** In Alpha, each level was 80% as bright as the one above, a geometric curve. — [Minecraft Wiki: Light](https://minecraft.wiki/w/Light)
- **Smooth lighting.** For each corner of a face, the diagonal neighbors are checked. With no full blocks, the corner is at full brightness. With full blocks on both sides, it gets the darkest level, which is never black. The four corner values are blended across the face. — [Minecraft Wiki: Light](https://minecraft.wiki/w/Light)

**Terraria 1.4.4.1 (decompiled `Terraria.Graphics.Light.LightMap`)**
- **Decay constants:**
  - `LightDecayThroughAir = 0.91f`
  - `LightDecayThroughSolid = 0.56f`
  - water `(0.88, 0.96, 1.015) × 0.91` per RGB channel, so water tints light blue-green
  - honey `(0.75, 0.7, 0.6) × 0.91`
  - cutoff threshold `0.0185f`
  
  — [decompiled LightMap.cs (br4dnblehh/terraria-source-code)](https://github.com/br4dnblehh/terraria-source-code/blob/main/1.4.4.1/Terraria.Graphics.Light/LightMap.cs)
- **Propagation is `Blur() { BlurPass(); BlurPass(); }`.** Each pass sweeps every column down then up, then every row right then left (parallelized per line). Each sweep is a running-max scan with decay. Per channel:
  ```
  carry = 0
  for cell along the line:
      if carry < cell.c: carry = cell.c                 // a brighter source restarts the carry
      else if carry >= 0.0185: cell.c = carry           // write the decayed carry (max semantics)
      carry *= decay[mask[cell]]                         // 0.91 air, 0.56 solid, per-channel for water/honey
  ```
  — [decompiled LightMap.cs](https://github.com/br4dnblehh/terraria-source-code/blob/main/1.4.4.1/Terraria.Graphics.Light/LightMap.cs)
- **Interpolation per tile corner.** `Lighting.GetCornerColors` reads the 3×3 neighborhood. Each tile corner gets the **average of the four tiles sharing that corner**, `(c + up + left + upLeft) × 63.75` (that is 255/4), clamped to 255. These become `VertexColors` on the tile's quad, so the GPU interpolates them. — [decompiled Lighting.cs](https://github.com/br4dnblehh/terraria-source-code/blob/main/1.4.4.1/Terraria/Lighting.cs)
- **Lighting modes in the same file.** `LightMode.Color` (the new engine), White, Retro and Trippy. Retro and Trippy are the legacy per-tile engine. — [decompiled Lighting.cs](https://github.com/br4dnblehh/terraria-source-code/blob/main/1.4.4.1/Terraria/Lighting.cs); [Terraria Wiki: Lighting mode](https://terraria.wiki.gg/wiki/Lighting_mode)
- **A modder's comparison.** The author of the Fancy Lighting mod says vanilla stores decay as an RGB value, while his engine uses a single number, and he calls vanilla's engine less accurate. This is a secondhand Reddit comment. — [Reddit via redlib: "I've improved my lighting algorithm"](https://redlib.hbubli.cc/r/Terraria/comments/13s27y5/ive_improved_my_lighting_algorithm); [FancyLighting repo](https://github.com/RandomComputerUser/FancyLighting/wiki)

**Starbound (OpenStarbound, `StarCellularLightArray`)**
- **Two kinds of light.** The header says spread light is spread "out in an octagonal based cellular automata". Each pass does two sweeps:
  - Sweep A goes x ascending, y ascending, and pushes to the right, up, up-right and down-right neighbors.
  - Sweep B goes x descending, y descending, and pushes to the left, down, up-left and down-left neighbors.
  - The drop per step is `1/spreadMaxAir` (or `1/spreadMaxObstacle` through solids), multiplied by √2 on diagonals.
  - The scalar spread function is `dest = max(source − drop, dest)`, a linear falloff, unlike Terraria's multiplicative one.
  - Colored light drops each channel in proportion to its share of the max channel, so hue is preserved: `c_i − c_i·drop/max(c)`.
  
  — [OpenStarbound StarCellularLightArray.hpp](https://github.com/OpenStarbound/OpenStarbound/blob/main/source/base/StarCellularLightArray.hpp)
- **Point lights.** For every cell within `maxIntensity × pointMaxAir`:
  - attenuation = distance × (1/pointMaxAir)
  - plus an optional beam term: `beam × (1 − dir·beamDir)`, which gives a cone
  - plus `lineAttenuation(...)`, which "Run[s] Xiaolin Wu's line algorithm from start to end, summing over colliding blocks". Wu's coverage weights make obstruction fractional, so shadows come out antialiased per cell.
  - The per-obstacle cost is "circularized" by dividing by max(|dx|,|dy|) of the direction.
  - There is an extra "single obstacle boost".
  - Light is additive across lights, or max-combined.
  - A spread light computed as a point light contributes ×0.15.
  
  — [OpenStarbound StarCellularLightArray.cpp](https://github.com/OpenStarbound/OpenStarbound/blob/main/source/base/StarCellularLightArray.cpp)
- **The off-screen border.** The calculated area is padded by `max(spreadMaxAir·spreadMaxValue, pointMaxAir·pointMaxValue)` cells, so lights just off screen still contribute. The OpenStarbound docs warn that raising the caps "calculates about N times the usual offscreen space, which is costly". — [OpenStarbound docs/json/openstarbound/lighting.md](https://github.com/OpenStarbound/OpenStarbound/blob/main/doc/json/openstarbound/lighting.md)

### Inferences

**Cost at Elsewhere's scale [S].**
- A 40×23 grid (plus a border equal to the light radius, say 60×43, about 2.6k cells) is trivial in JS.
- Terraria's 2 passes × 4 sweeps is about 20k cell visits per frame.
- A BFS flood (Minecraft) from each light is O(radius²) per light.
- The result goes into `Smooth.draw({cells})`, which already bilinear-interpolates per cell. That is equivalent to Terraria's corner averaging plus Gouraud, because averaging the 4 cells at each corner then interpolating is close to a bilinear filter offset by half a cell.

**Which falloff to pick:**
- Minecraft and Starbound subtract linearly, so light has a hard reach (radius = level / drop).
- Terraria multiplies (0.91^n), a soft exponential tail that needs a cutoff (0.0185).
- Linear falloff quantizes into evenly spaced rings, which is good for banded light.
- Exponential falloff gives rings that crowd near the source.

**Directional sweeps versus a BFS queue.**
- Sweeps are branch-light and cache-friendly, but they produce diamond (Manhattan) or octagonal shapes, not circles. Terraria hides this with smooth interpolation; Starbound adds diagonals with √2.
- Starbound's point-light path circularizes the shape at a higher cost: one Wu line per cell per light, O(r³) per light.
- For an isometric 2:1 world, run the flood on the logical tile grid, not on screen pixels, then project.

**Determinism.** All of these are pure functions of the tile grid and light list, so they satisfy CLAUDE.md's determinism rule with no rng.

**Day and night without re-propagation.** Minecraft's two-channel trick (block and sky stored separately, combined through a 2D lookup that changes with time) is a cheap way to do day/night. Store two byte grids, and recompute only the final cell color when the hour changes.

### Gaps
- Starbound's GPU-side rendering of the light array (texture filtering, any blur) was not read. Only the CPU propagation was examined. The default values of `spreadPasses`, `spreadMaxAir` and the related settings in vanilla `lighting.config` were not retrieved.
- No primary write-up of Starbound's lighting by Chucklefish was found. A forum claim that it was written by a former Terraria developer is unverified ([JVM Gaming thread](https://jvm-gaming.org/t/starbound-lighting-techneques/38799)).
- Minecraft's exact current brightness curve is shown only in an image chart on the wiki, not in text.

## Hard shadows from walls: visibility polygons, grid shadowcasting, penumbra wedges, 1D polar shadow maps

### Takeaway
Four families:
1. **Geometric visibility polygons**: an angular sweep over segment endpoints, done on the CPU, giving exact hard shadows.
2. **Grid FOV**: recursive shadowcasting per octant, fastest on tile maps, with well-known asymmetry artifacts.
3. **Geometric soft shadows**: shadow quads plus penumbra "fins" or wedges per light-facing edge.
4. **1D polar shadow maps**: an image-based GPU method. It unrolls occluders around a light into a 1×N texture of nearest-hit distance per angle, then blurs by angle for softness.

The first two produce data for the CPU that the stand-in can draw. The last two need either polygon fills (impossible in the stand-in per frame) or shaders.

### Cited Findings

**2D visibility polygons**
- **Red Blob Games' sweep:** sort wall endpoints by angle, sweep 360°, keep the set of walls crossed by the sweep ray, and emit a triangle whenever the nearest wall changes.
  - For lighting, run it once per light and union the results (the demo uses 24 lights). Shadows are hard.
  - Alternatives listed: rays only at endpoint angles, subtractive GPU shadow quads per segment, recursive grid shadowcasting, and 1D shadow maps.
  
  — [Red Blob Games: 2D Visibility](https://www.redblobgames.com/articles/visibility/) (details summarized in `effects_rendering.md`)

**Grid shadowcasting (roguelike FOV)**
- **Recursive shadowcasting:**
  - Process 8 octants. Sector bounds are slopes from 1/1 to 0/1.
  - Scan columns outward (increasing X), and tiles top to bottom within each column.
  - A clear-to-opaque transition raises the bottom slope. An opaque-to-clear transition lowers the top slope.
  - When both occur in one column, split the sector and recurse.
  - Stop at the radius, or when bottom > top.
  
  — [Adam Milazzo: Roguelike Vision Algorithms](http://www.adammil.net/blog/v125_Roguelike_Vision_Algorithms.html)
- **Relative speeds in Milazzo's tests**, shadowcasting = 100%:
  - ray casting 52%
  - diamond walls 78%
  - Milazzo's own 53%
  - permissive FOV 11%
  - Raw empty 20×20 map figures, in runs/s: 83,608 ray casting; 89,577 shadow casting; 60,369 Milazzo; 12,023 permissive.
  
  His conclusion: "A well-implemented shadow casting algorithm beats ray casting every time." — [Adam Milazzo](http://www.adammil.net/blog/v125_Roguelike_Vision_Algorithms.html)
- **Artifacts by algorithm:**
  - Ray casting: gaps in walls and shadows, and asymmetry.
  - Shadowcasting: blind corners, narrower diagonal vision, and a beam that widens through doors. It can be made symmetric with a small change.
  - Permissive: symmetric but slow, and "too permissive".
  
  — [Adam Milazzo](http://www.adammil.net/blog/v125_Roguelike_Vision_Algorithms.html)

**Soft shadows by geometry (penumbra fins and wedges)**
- **Orangy Tang, "Dynamic 2D Soft Shadows"** (GameDev.net, 2004, revised 2008). Geometry-based, with convex hulls as casters:
  - Penumbra size is a function of the light's physical size, not its range.
  - One pass per light: accumulate intensity in the framebuffer's alpha channel, then mask shadow regions with hull-projected geometry.
  - Penumbra "fins" at the hull's silhouette edges are textured with a gradient.
  
  — [GameDev.net article 2032 (archive)](https://archive.gamedev.net/archive/reference/articles/article2032.html); [r3065 revision](https://www.gamedev.net/tutorials/_/technical/graphics-programming-and-theory/dynamic-2d-soft-shadows-r3065/). Both pages returned HTTP 403 to my fetch; this summary is from search snippets.
- **"Penumbra wedges"** in the literature are 3D soft shadow volumes (Assarsson and Akenine-Möller, Graphics Hardware 2003). No dedicated 2D wedge article was found. — [Chalmers PDF](https://www.cse.chalmers.se/~uffe/soft_gfxhw2003.pdf)

**1D polar shadow map (mattdesl)**
1. Draw occluders into a square FBO centered on the light (256×256 by default), alpha only.
2. A shader turns this into a **256×1 texture**. For each angle (x), march outward and keep the minimum distance at which alpha > 0.75. Rays that hit nothing store 1.0.
3. Draw the light quad. Each fragment compares its radius with the stored distance for its angle, which gives hard shadows.
   - For softness, take **9 samples of neighboring angles with Gaussian weights**, with a blur width that grows with distance.
   - Multiply by radial falloff and light color, then add.

Limitations from the author:
- It is fill-rate heavy. He reports about 20 lights on a GeForce 9400.
- The code "will not perform well on Android".
- Precision is tied to light size.
- Geometry-based shadows are generally faster.

— [mattdesl/lwjgl-basics: 2D Pixel Perfect Shadows](https://github.com/mattdesl/lwjgl-basics/wiki/2D-Pixel-Perfect-Shadows)

**Engines' shadow filters**
- Godot's LightOccluder2D shadow filter has three settings:
  - None: "fastest, suited to pixel art".
  - PCF5: softer.
  - PCF13: softest, "only for a few lights at once".
  
  A high "Filter Smooth" can band or streak. Shadow color can tint shadowed areas. — [Godot docs](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html)

### Inferences

**Per family, how it would run in Tycho:**
- **Grid shadowcasting [S].** Run on the tile grid in JS per light, writing a visibility mask into the light cells (light = falloff × visible), then hand the cells to `Smooth`. Smooth upscaling gives free soft-edged shadows at cell scale. With smoothing off, it gives crisp per-tile shadows. This is the best fit for a tile or isometric world and costs microseconds.
- **Visibility polygon [S with a CPU rasterizer, or B per static light].** The sweep is cheap in JS (O(n log n) in the segments). The output polygon can't be path-filled in the stand-in, so either:
  - (a) rasterize the triangles into the light cell grid, or into a light-resolution ImageData in JS, and upload it with `drawPixels` or `Smooth`; or
  - (b) for static lights, fill the polygon on an offscreen 2D canvas once [B] and draw it with lighter or multiply.
  
  A JS scanline fill of a 160×90 light buffer is about 14k pixels per light, which is fine for a few lights.
- **Penumbra fins [H or CPU raster].** Fins need textured triangles. The stand-in's quads can't make arbitrary triangles. Rasterizing them on the CPU into the light buffer is possible but fiddly. A cheaper look-alike: blur the hard light buffer in JS (a separable box blur at 160×90 is about 2 × 14k × kernel), or rely on bilinear upscaling of a coarse buffer. Softness then scales with cell size rather than distance from the occluder, which looks fine at 320×180.
- **1D polar shadow map [H, or a CPU variant in S].** On the CPU the same idea is direct raycasting from the light:
  ```
  for a in 0..N-1:                            // N = 256 angles
    d[a] = R; for t in 1..R: if solid(light + dir(a)*t): d[a]=t; break
  for each light-buffer px within R:
    a = angle(px-light)*N/2π; r = |px-light|
    lit = Σ_k w_k * step(r, d[a+k])           // k=-4..4 Gaussian taps, wider with r → soft shadows
  ```
  At a light radius of 64 px and 256 angles, the march is about 16k samples, and the shade pass is π·64² ≈ 13k px × 9 taps. That is under a few hundred thousand operations per light, so several lights can run per frame in JS at 160×90 or 320×180, uploaded with `drawPixels`. This is an estimate.
- **For an isometric 2:1 world.** Compute shadows on the ground plane in tile space, not screen space, then project into the light grid. Tall walls that should hide what's behind them need an extra "height" rule. That is a design question, not one the sources answer.

### Gaps
- The full text of Orangy Tang's article could not be fetched (HTTP 403), so exact fin texturing and blend states are unconfirmed.
- No measured JS or CPU timings were found for 1D shadow maps or visibility polygons at low resolutions.

## 2D global illumination: radiance cascades, JFA SDF raymarching, Noita, CPU cost at 160×90

### Takeaway
2D GI treats every emissive pixel as a light and every opaque pixel as an occluder, so light bleeds color around corners with soft, correct penumbrae. Two practical families:
- **Distance field (JFA) plus Monte Carlo raymarch**: noisy, and needs temporal accumulation.
- **Radiance cascades**: noise-free, fixed cost, a hierarchy of probes trading spatial for angular resolution.

Both are GPU-shader methods ([H]) with roughly 10 or more passes. At 160×90 the pixel count is so small that a CPU version is conceivable for **static** light (bake [B]), and possibly for low-frequency dynamic light at a reduced rate. But quantizing GI to eight inks throws away most of what makes it worth having. No developer source documents Noita's lighting.

### Cited Findings

**JFA SDF plus raymarching**
- **Sam Bigos, "2DGI #1 – Global Illumination in Godot"** (28 Oct 2020):
  - Draw emitters (color > 0) and occluders into a scene buffer.
  - Seed JFA with each occupied pixel's UV in RG.
  - Run `ceil(log2(maxDim))` passes; for 768×512 that is log2(1024) = 10. Each pass looks at a 3×3 neighborhood at a halving offset and keeps the nearest seed, which builds a Voronoi diagram.
  - Distance = |uv − seed|. The distance field is in UV space, so it is skewed on non-square buffers; use square buffers.
  - Per pixel, cast **32 rays** (random rotation plus a golden-angle step), each sphere-traced up to **128 steps** (hit when d < 0.001, for 16-bit float precision).
  - Accumulate emission / RAYS, and color / total emission, so hue keeps its strength whatever the hit count.
  - Linear-to-sRGB conversion fixes an image that looks too dark.
  - The result is noisy. Bounces and denoising are deferred to later posts. No timings are given. The base viewport is 360×240.
  
  — [Sam Bigos: 2DGI #1](https://samuelbigos.github.io/posts/2dgi1-2d-global-illumination-in-godot.html)
- **jason.today's naive GI:**
  - JFA, then about 32 sphere-trace steps instead of up to 256 fixed steps, with 8 rays per pixel and a random offset.
  - Temporal accumulation (a 0.9 mix, stopping after about 10 frames), which the author calls "basically a hack".
  - Naive 512-ray GI at 1024² is about 1 billion lookups per frame, about 100× too slow for 60 fps.
  
  — [jason.today: GI](https://jason.today/gi); [jason.today: Radiance Cascades](https://jason.today/rc) (details in `effects_rendering.md`)
- **Godot 2D** can add LightOccluder2D polygons to a real-time SDF for custom shaders ("SDF Collision"), at no cost if no shader reads it. That is the same SDF these GI shaders march. — [Godot docs](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html)

**Radiance cascades**
- **GM Shaders (Yaazarai) layout:**
  - Each cascade has 1/4 the probes and 4× the rays of the one below. Example at 1024²: C0 has 16×16 probes × 64 rays, C1 8×8 × 256, C2 4×4 × 1024, C3 2×2 × 4096. That is 16,384 rays per cascade, so memory is constant per cascade.
  - Ray intervals form a geometric series: `origin = interval·(1−4^i)/(1−4)`, `length = interval·4^i`.
  - Cascade count comes from the screen diagonal: `ceil(log4(diagonal/interval0))`.
  - Merge from the top cascade down. Each ray in Cn bilinearly blends the matching-direction rays of the 4 nearest probes in Cn+1, but only where the ray missed (visibility term 0). That preserves penumbrae.
  - C0's probes, averaged over rays, are the radiance field, scaled up with hardware interpolation.
  - Stated limitations: occasional light leaks and nonlinear attenuation transitions.
  
  — [GM Shaders: Radiance Cascades](https://mini.gmshaders.com/p/radiance-cascades)
- **jason.today's numbers.** Cost is "roughly the cost of the naive method at 16 rays, but without noise". Artifacts are ringing around single lights, grid artifacts without linear filtering, and leaks without clamping. — [jason.today: RC](https://jason.today/rc)
- **Origin.** Alexander Sannikov, a senior programmer at Grinding Gear Games (Path of Exile), unveiled the method in November 2023. He calls it geometry-agnostic, with cost "independent of scene complexity, number of light sources or polygons". — [80.lv](https://80.lv/articles/radiance-cascades-new-approach-to-calculating-global-illumination); paper repository [Raikiri/RadianceCascadesPaper](https://github.com/Raikiri/RadianceCascadesPaper)
- **Use in Path of Exile 2.** A Chalmers thesis says RC was first presented for use in PoE2. A Habr article claims PoE2 cascades hold a few hundred probes with 128×128 textures at about 3 ms per frame; that is a secondary source and unverified. — [Chalmers thesis](https://odr.chalmers.se/items/9e42007a-bb60-440f-ba28-04410822758f/full); [Habr](https://habr.com/en/articles/897956)
- **Holographic Radiance Cascades** (Freeman, Sannikov, Margel, 2025) is a "single-shot scene-agnostic radiance transfer algorithm" for 2D GI, which the authors say is visually indistinguishable from the 2D reference at real-time rates. — [arXiv 2505.02041](https://arxiv.org/abs/2505.02041)

**Noita**
- No developer documentation was found. Community threads say its light is computed at a higher precision than the low-resolution world, giving a soft look over a per-pixel falling-sand world. This is unverified. — [r/howdidtheycodeit via mirror](https://lr.eu.psf.lt/r/howdidtheycodeit/comments/1jbb5ij/does_noita_put_the_entire_environment_display); [Godot forum: How to make lighting?](https://forum.godotengine.org/t/how-to-make-lighting/72469)

### Inferences

**CPU cost at 160×90 (14,400 px).** Estimates, not measurements:
- **The distance field.** On the CPU, skip JFA and use an exact two-pass linear-time Euclidean distance transform (the Felzenszwalb–Huttenlocher style, separable in x then y). That is about 30k column and row operations, well under 1 ms.
- **Monte Carlo raymarch.** 14,400 px × 32 rays × about 12 sphere-trace steps ≈ 5.5M SDF reads per frame. In JS that is likely 10 to 30 ms on a desktop and several times worse on a phone, so it is too slow for 60 fps. Options:
  - Amortize: 4 rays per pixel per frame plus temporal accumulation, about 0.7M reads, which is plausible.
  - Run GI at 80×45 (3,600 px).
  - Recompute only when emitters or walls change.
- **Radiance cascades on the CPU at 160×90.** Base 4, C0 at 1 px spacing, 4 rays per probe, so 57,600 rays, each marching about 1 px. Each cascade holds about the same total rays, with intervals growing 4×. Roughly 4 cascades cover a 183 px diagonal. That is a few hundred thousand short marches plus the merges, plausibly 2 to 10 ms in JS, and deterministic and noise-free.
- **Bake [B] for static light.** Because RC has no noise, a one-time bake of static GI per room (at room load) into a light map, quantized to ramp steps and dithered, gives GI's look with zero per-frame cost. Dynamic lights such as the Lantern or the player's light are then added with the cheap tile flood or radial methods.

**Look versus palette.** GI's selling point is continuous color bleeding and soft penumbrae. Under 8 inks, it reduces to "which band, which ink". The banded result of a GI bake would differ from a careful hand-placed flood fill mainly in corner wrap-around and color bleed. A bake can still be worth it for one showcase quest with a "high-bit" look (Elsewhere permits per-quest looks), done as [H] through `gpu.program` at 320×180.

**Pseudocode for the CPU RC skeleton** (base 4, my sketch from the GM Shaders description):
```
for i = N-1 down to 0:
  spacing = 2^i ; rays = 4^(i+1) ; t0 = I0*(4^i-1)/3 ; t1 = t0 + I0*4^i
  for each probe p on the spacing grid, for each ray k:
    hit, rad = march(p, dir(k), t0, t1)          // SDF sphere trace limited to [t0,t1]
    if !hit and i < N-1:
      rad += bilinear over 4 parent probes of avg(parent rays 4k..4k+3)
    C[i][p][k] = rad
light(px) = avg_k C[0][px][k]
```

### Gaps
- No phone or CPU benchmarks for RC or JFA GI at 160×90 or 320×180 were found.
- Noita's lighting method is undocumented in any primary source found.
- Samuel Bigos's later 2DGI parts (bounces, denoise) were not located; only part 1 is linked from his site.

## Normal-mapped sprites with point lights (Dead Cells, Children of Morta), and generating the normals

### Takeaway
Per-pixel N·L lighting turns flat sprites into relightable ones. Dead Cells redrew backgrounds and decorations as normal maps and rendered characters from 3D. Eastward hand-painted bump maps over 3D rebuilds. Children of Morta is documented only as Unity dynamic lighting with specular maps. Automatic normal generators are worse than hand-painted maps.

The pixel-art problem is that per-fragment lighting cuts across art pixels. Snap the lookup to the art grid, and prefer a few flat "facet" normals over smooth gradients. In Tycho, live normal lighting is [H]. Prebaking N lighting directions to palette-quantized sprite variants is [B] and fits the 8-ink rule.

### Cited Findings
- **Dead Cells:**
  - Characters and monsters are 3D models (made in 3ds Max) rendered to 2D sprites with a homebrew tool.
  - Backgrounds and decorations were pixel-art painted and then redrawn as normal maps, so "a torch on the left of a statue will light up the statue from the correct direction while respecting its base colours".
  
  — [80.lv: Interview with the developers of Dead Cells](https://80.lv/articles/interview-with-the-developers-of-dead-cells); [80.lv: Dead Cells character art pipeline](https://80.lv/articles/case-study-dead-cells-character-art-pipeline/)
- **The Siege and the Sandfox** credits Dead Cells for showing normal-mapped pixel art. It used normals to "sculpt" large obvious shapes rather than fine detail. Its advice: one pixel can be a stud or nail, but the normal map can only hold one angle there, so favor angles over gradients. — [Game Developer: hand-drawn normal maps in The Siege and the Sandfox](https://gamedeveloper.com/art/adding-depth-to-2d-with-hand-drawn-normal-maps-in-i-the-siege-and-the-sandfox-i-)
- **Children of Morta.** A review notes Unity, with "dynamic lighting and specular maps". No GDC or developer write-up on its normals was found. — [JumpDashRoll review](https://www.jumpdashroll.com/article/children-of-morta-review); [Engadget GDC 2018 hands-on](https://www.engadget.com/2018/03/22/children-of-morta-hands-on-indie-xbox-gdc/)
- **Eastward (Pixpil).** A custom engine based on MOAI, with shader textures and lighting systems for weather and time of day. Assets are "rebuilt in a 3D environment, then hand painted in the bump map one by one". The engine also simulates SSAO, CRT filters and LUT color grading. — [Game Developer: Eastward's creators](https://www.gamedeveloper.com/art/eastward-s-creators-share-insights-on-making-pixel-art-adventures); [80.lv: Eastward](https://80.lv/articles/eastward-charming-chinese-pixel-art-adventure?amp=1)
- **Sea of Stars (Sabotage).** A custom Unity render pipeline. Pre-release goals were "fully dynamic lighting of sprites including normal mapping, pixel depth writing and shadow receiving and shadow casting sprites from multiple angles and punctual/directional light sources". Time of day lengthens shadows. A pre-release list may differ from what shipped. — [Playdigious press kit](https://playdigious.com/press/sea-of-stars); [Nintendo Life hands-on](https://www.nintendolife.com/news/2020/03/hands_on_first_impressions_of_sea_of_stars_the_next_project_from_the_messenger_dev_sabotage)
- **Godot 2D normal maps.**
  - A CanvasTexture holds normal and specular maps, with Shininess.
  - A light's "Height" matters only for normal-mapped surfaces; raise Height or Energy after enabling normals.
  - Additive sprites are a far cheaper alternative, but they cast no shadows and ignore normals.
  
  — [Godot docs](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html)
- **Generating normals.** The comparison (Sobel on grayscale, Sobel on a painted height map, distance-transform "bevel" in the style of Laigter or Sprite Illuminator, Sprite Lamp's four-light merge, DeepNormals) concluded "no technique could produce maps as good as the one an artist can manually paint". Tools: Laigter (free, CLI), Sprite Lamp (paid). — [arXiv 2212.09692](https://ar5iv.labs.arxiv.org/html/2212.09692); summarized in `effects_rendering.md`
- **Procedural normals from a silhouette.** Lodestar's painter already derives normals from chamfer-distance height inside each silhouette and material patch: height, then normal, then Lambert from the top left, then a hard cut to a ramp step. — `local_games_and_tycho.md` in this folder

### Inferences

**Live normal lighting [H].** The per-pixel term is:
```
N = normalTex(floor(uv*artSize)+0.5)*2-1                  // sample normals per art pixel
for each light: Ldir = normalize(vec3(lightPos - px, height)); diff += col*max(dot(N,Ldir),0)*atten(dist)
out = albedo*(ambient + diff)
```
Then quantize `diff` to ramp steps for a pixel look.

**Prebaked directional variants [B].** Elsewhere's `Figure` sprites are generated, so their normals can come from the same shape data (the bevel or chamfer approach) at paint time. Bake 4 or 8 light directions × 2 or 3 intensities, each quantized to the quest's inks. At draw time, pick the variant whose direction is nearest the dominant light, plus `ctx.tint` or `ctx.lightMap` for intensity. That costs memory (8× sprites) and no per-frame work. It fits strict palettes, because every variant is printed from inks.

**Rim-light hack [S].** Draw a 1 px light-ink outline only on the side facing the light, by blitting a pre-made per-side edge mask (4 masks per sprite). Many palette-limited games approximate normal mapping this way. This is my inference; no source covers it.

### Gaps
- No primary source on Children of Morta's normal-map production was found.
- No source confirms whether Octopath or Sea of Stars sprites ship per-sprite normal maps. Third-party blogs claim deferred lighting of sprites in Octopath, unverified.

## Emissive and bloom

### Takeaway
Bloom has four steps: threshold or tag the bright or emissive pixels, blur them, often at reduced resolution and in several passes, then add (lighter) the result over the frame. For pixel art, the glow should be blocky, or blurred at low resolution and drawn with nearest scaling, and it should come from a **separate emissive layer** rather than a luminance threshold. A threshold on an 8-ink palette makes every light ink glow. Tycho already has an emissive target (`F.EM`) and a `post.Blur` finish, so a basic bloom is [S], or [S+H] for the blur.

### Cited Findings
- **Phaser's bloom** keeps pixels above a brightness threshold (default 0.55), blurs them, and adds them back. It suggests pixelating before bloom. — [Phaser post-bloom](https://phaser.io/packs/post-bloom.md)
- **The standard multipass pipeline:** a threshold pass, horizontal and vertical blur passes, then additive blend (after LearnOpenGL). — [Snake Rewind ep7 devlog](https://letsreinventthewheel.github.io/blog/snake-rewind-ep7)
- **Unity's bloom** uses a threshold plus a "soft knee" for gentler transitions, and a "fast mode" for mobile. — [Unity Post-processing Bloom](https://docs.unity3d.com/Packages/com.unity.postprocessing@3.0/manual/Bloom.html)
- **Tycho's existing pieces.** The stand-in draws "what glows" into its own target (`gpu.ctx(F.EM)`). The frame ends with `frameEnd` or `post.Blur`. `Figure.draw` already adds a sprite's emissive part `s.e` with `lighter`. — [vendor/tycho/docs/renderer.md](file:///Users/david/projects/elsewhere/vendor/tycho/docs/renderer.md); `local_games_and_tycho.md`
- **Godot's cheap alternative** to lights is additive-blended sprites (a CanvasItemMaterial set to Add), "much faster to render" but without shadows or normals. — [Godot docs](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html)

### Inferences
- **[S] pixel bloom without a shader.** Pre-render each glowing sprite's halo once [B]: blur its emissive mask offscreen, then quantize the halo to 2 or 3 ink steps with a Bayer edge. Draw the halo with `lighter` at the sprite's position each frame. Cost: one extra drawImage per glowing thing, and the halo is palette-shaped. This is the "baked glow sprite" approach. Flicker comes from `Tycho.seed.fxRand` modulating globalAlpha.
- **[S] screen bloom.** Draw the emissive layer onto a 1/4-resolution canvas (drawImage with smoothing), draw that back up scaled with smoothing and `lighter`, and repeat at 1/8 for a wider halo. That is three drawImage calls. It leaves the palette, since smooth halos add off-ink colors. Drawing the up-scale with smoothing **off** gives a blocky, retro halo.
- **Strict palette.** Additive glow can only stay on-palette if the result is re-quantized ([H] or drawPixels). Otherwise, treat glow as a **reprint**: the area near a lamp is printed one ramp step lighter, as in the band method of the first section.

### Gaps
- No primary source describes a shipped pixel-art game's bloom implementation (for instance Octopath's, beyond "bloom" being listed).

## Volumetric light, god rays, fog and haze

### Takeaway
2D god rays are an occlusion mask (a bright light disk with occluders drawn black) blurred radially toward the light and added over the scene. Fog and haze are layers: a flat or gradient fill, alpha by depth, or scrolling noise sprites. The radial blur is [H] or a CPU loop. Pre-baked shaft sprites drawn with `lighter` and slight alpha animation give most of the look on the stand-in.

### Cited Findings
- **Godot 4.3 screen-space god rays.** A white circle at the light, multiplied by an occlusion mask (the scene rendered with a transparent background in a SubViewport), then radially blurred. Off-screen objects don't occlude, and there are no rays if the light is behind the camera. — [godotshaders: Screen Space God Rays](https://godotshaders.com/shader/screen-space-god-rays-godot-4-3/)
- **three.js ShaderGodRays** (credited to huwb). A depth mask blurred along lines to the sun in **3 passes of 6 samples with shrinking filter support**. Together these act like 216 samples. The rays are then added to the background. — [three.js ShaderGodRays](https://github.com/timoxley/threejs/blob/master/examples/js/ShaderGodRays.js)
- **Unity Sun Shafts** expose blur size, iterations, intensity and an alpha mask, for clouds that block the shafts. — [Unity Sun Shafts](https://docs.unity3d.com/355/Documentation/Components/script-SunShafts.html)
- **Typical sample loop** (WGSL sunrays): step toward the light with `decay`, `weight` and `exposure` accumulating mask samples. — [fluid_core sunrays.wgsl](https://docs.rs/crate/fluid_core/0.1.0/source/src/shaders/sunrays.wgsl)
- **Octopath's HD-2D** look adds tilt-shift and depth of field, bloom, volumetric lighting and fog over pixel sprites in UE4. — [Wikipedia: HD-2D](https://en.wikipedia.org/wiki/HD-2D); [Unreal Engine spotlight](https://www.unrealengine.com/spotlights/octopath-traveler-s-hd-2d-art-style-and-story-make-for-a-jrpg-dream-come-true?lang=ja)

### Inferences

**The radial-blur loop, per output pixel [H, or CPU at light resolution]:**
```
uv = px; delta = (px - lightPos) * density / S
illum = 0; w = 1
for s in 1..S:  uv -= delta; illum += mask(uv) * w; w *= decay
out = scene + illum * exposure * lightColor
```
At 160×90 with S = 16 that is about 230k mask reads in JS per frame, feasible as `drawPixels`. Or apply the three.js trick (3 passes × 6) on a quarter-resolution mask.

**On the stand-in:**
- **God rays [S].** Bake a few long, soft wedge sprites (a gradient quantized to 2 inks with a Bayer edge) and draw them with `lighter`, alpha breathing slowly. For window shafts in a fixed room this is indistinguishable from the real thing.
- **Fog and haze [S].** A full-screen vertical gradient (stand-in linear gradients are drawn as strips) at low alpha, or tiled pre-dithered noise sprites scrolled. For the strict palette, haze is a reprint toward the sky ink by distance band. That is a [B] reprint of far layers, not alpha.

### Gaps
- No source on 2D pixel-art games' fog implementations was found beyond generic shaders.

## Palette-based lighting: ramp lookup, per-material ramps, hue-shifted shadows

### Takeaway
In palette lighting, light selects a shade from a ramp owned by the pixel's ink or material, instead of multiplying RGB. LutLight2D does exactly that on the GPU. On the CPU, Elsewhere's `Ink` index buffers make it natural:
- an index → ramp-step table per band, or
- whole-layer reprints per light state, which is how the lighthouse quest already does NIGHT, KINDLE and LIT.

Hue-shifted ramps, with shadows toward violet or blue and lights toward gold, read as painted. Black multiply reads as dirty. A colored multiply (an ambient tint) is the cheap stand-in approximation.

### Cited Findings
- **LutLight2D.** One hand-made gradient per palette color, from the original down to the darkest. Baked to LUTs and indexed by light-texture brightness, it "keeps the original colors of the palette". — [unitycoder/LutLight2D](https://github.com/unitycoder/LutLight2D)
- **A gradient-map variant:** convert to grayscale and sample a gradient. — [godotshaders: Color remap shader](https://godotshaders.com/shader/color-remap-shader-palette-swapper/)
- **Hue variation in ramps:**
  - "Pixel art color ramps actually look the most natural if there's a bit of color variation in them." — [OpenGameArt: Some insights about pixel art color ramps](https://opengameart.org/node/20643)
  - Shading by only darkening and lightening "is the quickest way to make pixel art look flat". — [Wayline color ramp generator](https://www.wayline.io/color-ramp-generator)
- **Tycho's `rampOf(anchors, n=9, deep=0.55, high=0.3)`** builds ramps from soot `[8,6,12]` through the anchors to a warm light `[255,238,200]`. Lodestar's rules are "shadows toward violet, lights toward gold", and its stepped light tints darks violet. — `local_games_and_tycho.md`; [light.ts header](file:///Users/david/projects/elsewhere/vendor/tycho/src/pixels/light.ts)
- **Elsewhere's lighthouse quest** keeps three palettes (NIGHT, KINDLE, LIT) and reprints the painted room per palette, so "a lighting change is a palette swap". — `local_games_and_tycho.md`
- **Godot's CanvasModulate** sets a base ambient color that lights add to. Godot's "Mix" light mode lerps toward the light texture's color, and shadow "Color" can tint shadowed areas. These are the engine-level knobs for colored darkness. — [Godot docs](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html)

### Inferences

**Three implementations, from strict to cheap:**
1. **Per-pixel index lookup [S via drawPixels, or H].**
   - `out = palette[ramp[ink][band(L)]]`. Each ink's ramp is a list of other inks in the frame's eight, so the frame never leaves the palette.
   - Per-material ramps are the same with a material id per pixel (Ink could keep a second index plane).
   - Hue shift is free, because the ramp's darker entries are whatever inks the artist or palette generator chose (violet-ish).
2. **Layer reprint per light state [B, then S].** Print each layer once per band or time of day, then select or crossfade with drawImage and globalAlpha.
   - Holding a crossfade mid-way creates off-palette blends. That is the existing note in `effects_rendering.md`.
   - Local light pools use the band reprint plus a mask: draw the lit print, then destination-out a baked light-shape mask, or draw lit-print tiles only within the light's tiles.
3. **Colored multiply [S].** Multiply by a violet-blue ambient instead of gray, then add warm light (lighter). This gives the hue-shifted feel at the cost of off-palette colors. Tycho's Smooth model already supports colored cells (RGB light map), so cool ambient cells with warm cells near lamps is a one-line change in the cell fill.

**Pseudocode for building a ramp table from an 8-ink palette** (at quest load; deterministic):
```
for each ink i: candidates = inks with lower lightness; sort by lightness
  ramp[i][0] = i
  ramp[i][k] = argmin over candidates of (ΔL to L_i - k*step) + λ·(hue distance toward the "shadow hue", e.g. violet)
```

### Gaps
- No primary sources on Hyper Light Drifter's or Blasphemous's lighting pipelines were found. Their palette-ramp lighting is commonly asserted but unconfirmed here.

## Light color mixing: warm and cool, additive versus screen versus overlay

### Takeaway
- **Multiply** (scene × light) darkens and tints. It is how ambient and "darkness" work, but it can't brighten beyond the albedo.
- **Additive** (lighter, scene + light) brightens and burns to white where lights overlap. It suits fire, magic and emissives.
- **Screen**, 1 − (1−a)(1−b), brightens with a soft roll-off and never clips. It is not available on the stand-in.
- **Overlay** multiplies in the darks and screens in the lights. It is a contrast-boosting color grade, not a light.

The common game formula is scene × (ambient + Σ lights) + small additive, the Unity two-factor and Tycho Smooth form. Warm lights over a cool ambient give the classic look.

### Cited Findings
- **Unity's factors:** multiply = (Modulate 1, Additive 0); additive = (0, 1); subtractive = (0, −1). — [Unity URP 14 Light Blend Styles](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/LightBlendStyles.html)
- **Godot's light blend modes:**
  - Add (the default)
  - Subtract (for "negative lights", not physically accurate)
  - Mix (lerp toward the light texture's color)
  
  CanvasModulate is needed so lights don't just brighten an already lit scene. — [Godot docs](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html)
- **Tycho Smooth** computes `p*m + m*add`, multiply plus 10% additive. — [light.ts](file:///Users/david/projects/elsewhere/vendor/tycho/src/pixels/light.ts)
- **Colored spread in Starbound** scales each channel by its share of the maximum, so a light keeps its hue as it fades. — [OpenStarbound header](https://github.com/OpenStarbound/OpenStarbound/blob/main/source/base/StarCellularLightArray.hpp)
- **Terraria** stores per-channel decay, so water tints light (0.88, 0.96, 1.015). — [decompiled LightMap.cs](https://github.com/br4dnblehh/terraria-source-code/blob/main/1.4.4.1/Terraria.Graphics.Light/LightMap.cs)
- **Formulas for multiply, screen, overlay and the other blend modes:** [W3C Compositing and Blending Level 1](https://www.w3.org/TR/compositing-1/)

### Inferences

**How the lights should combine in the light buffer:**
- **Accumulate lights additively** (sum per cell, RGB), then clamp. Or "max" combine, as Starbound's non-additive mode and Terraria's max-sweep do. Max avoids hot spots where lights overlap, keeping each light's color pure. Sum gives realistic warm-plus-cool mixing to white.
- **For palette lighting,** compute the hue of the summed light per cell and choose between a "warm ramp" and a "cool ramp" per ink. That is two reprint tables. This gives warm/cool mixing without leaving the palette.

**Screen on the stand-in.** It would need inverting the scene, so it is not directly possible. Approximations:
- (a) additive with light pre-scaled down
- (b) draw the light with `lighter` at globalAlpha k, then multiply by a slightly darker fill; but that is not the same curve
- (c) do screen in the CPU light buffer before the multiply, which is fine because the buffer is just numbers: `combined = 1 − Π(1 − L_i)` per cell, then `Smooth`

Option (c) is free and gives a non-clipping mix of many lights.

**Overlay** is best treated as a whole-frame grade done by palette reprint, not as a light.

### Gaps
- No pixel-art-specific source compared screen and additive lighting in shipped games.

## Which techniques suit a strict palette-limited look, and which a modern "high-bit" pixel look

### Takeaway
The dividing line is whether light **selects an ink** or **produces new colors**.
- **Strict-palette games** (Bloodless's 4 colors, Lodestar's stepped bands, Elsewhere's 8-ink rule) use per-tile light grids quantized to a few bands, palette or ramp reprints, Bayer-dithered band edges, baked halos, grid shadowcasting, and baked directional sprite variants.
- **High-bit pixel games** (Octopath's HD-2D, Sea of Stars, Eastward, Dead Cells, Children of Morta) put pixel sprites under a modern renderer: smooth or bilinear light maps, normal-mapped sprites with point lights, soft shadows, bloom, volumetrics, depth of field, LUT grading, and sometimes GI. They accept that the pixel grid of the lighting no longer matches the art.

### Cited Findings
- **Strict-palette examples:**
  - Bloodless: a 4-color palette with lighting blending between the colors via dithering at borders. — [Game Developer: Bloodless](https://gamedeveloper.com/art/deep-dive-behind-the-starkly-stylish-art-direction-of-bloodless)
  - Lodestar: 16 light bands, violet darks, a dithered stepped shader, at most 4 tones per material, no dither on sprites. — `local_games_and_tycho.md`
  - Elsewhere's lighthouse: lighting by palette swap. — `local_games_and_tycho.md`
- **High-bit examples:**
  - Octopath: UE4 with tilt-shift and depth of field, bloom, volumetric lighting and fog. — [Wikipedia: HD-2D](https://en.wikipedia.org/wiki/HD-2D)
  - Sea of Stars: a custom Unity pipeline, normal-mapped sprites, depth writing and shadow-casting sprites; one developer spent five years on the lighting. — [Playdigious press kit](https://playdigious.com/press/sea-of-stars); [3dpoder (Spanish)](https://foro3d.com/2026/julio/sea-of-stars-pixel-art-de-16-bits-con-iluminacion-dinamica-en-unity.html)
  - Eastward: hand-painted bump maps over 3D rebuilds, SSAO, LUT grading. — [Game Developer: Eastward](https://www.gamedeveloper.com/art/eastward-s-creators-share-insights-on-making-pixel-art-adventures); [80.lv](https://80.lv/articles/eastward-charming-chinese-pixel-art-adventure?amp=1)
  - Dead Cells: normal-mapped backgrounds and 3D-rendered characters. — [80.lv](https://80.lv/articles/interview-with-the-developers-of-dead-cells)
  - Children of Morta: Unity dynamic lighting and specular maps. — [JumpDashRoll](https://www.jumpdashroll.com/article/children-of-morta-review)
- **Engine guidance on pixel-art defaults.** Godot recommends shadow filter "None" for pixel art, and snapping light vertices to the pixel grid. — [Godot docs](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html)

### Inferences

**Master table** (B = bake, S = stand-in per frame, H = shader only; "palette-safe" = stays inside the frame's inks):

| Technique | Look | Per-frame cost at 320×180 | Tier | Palette-safe? | Fits |
|---|---|---|---|---|---|
| Coarse light grid, smooth multiply (`Smooth`, `ctx.lightMap`) | soft pools, Terraria Color | JS grid fill + 1 quad | S | no | high-bit |
| Same grid, nearest upscale (blocky) | per-tile steps, Terraria Retro | same | S | no (multiply) | either |
| Tile flood fill (Minecraft BFS / Terraria sweeps / Starbound octagonal CA) | light pours around corners | ~10–20k cell ops | S (CPU) | as above, depending on the final step | both |
| Quantized bands + palette ramp lookup per pixel | painted, stepped | ~60k table reads + `drawPixels` | S (drawPixels) / H | **yes** | strict |
| Band reprints per layer (Ink prints N times) | stepped, tile-aligned pools | N× memory, ~0 per frame | B→S | **yes** | strict |
| Bayer-dithered band edges | crosshatch transitions | per pixel | H / S (drawPixels) / B (masks) | **yes** | strict |
| White-noise or hash dither | grainy, crawling | per pixel | — | yes, but ugly | avoid |
| Grid shadowcasting into the light grid | crisp or soft tile shadows | microseconds | S (CPU) | depends on final step | both |
| Visibility polygon (Red Blob) rasterized | exact hard shadows | O(n log n) + raster | S (CPU+drawPixels) / B static | depends | both |
| 1D polar shadow map (CPU variant) | per-pixel shadows, angular blur | ~100k ops/light | S (drawPixels) / H | depends | high-bit |
| Penumbra fins (geometry) | physically soft shadows | per edge per light | H | no | high-bit |
| JFA/EDT + Monte Carlo GI | soft GI, noisy | millions of reads | H (bake B) | no | high-bit |
| Radiance cascades | noise-free GI | ~0.3M short marches (CPU est.) | H / B bake | no (bands lose it) | high-bit showcase |
| Normal-mapped sprites, live | relit sprites | per pixel per light | H | no (unless quantized) | high-bit |
| Baked directional sprite variants | relit in 4–8 steps | 0 | B | **yes** | strict |
| Baked glow halos (`lighter`) | blocky glow | 1 drawImage each | B→S | near (quantized halo, but additive) | both |
| Downsampled screen bloom | soft glow | 2–3 drawImage | S | no | high-bit |
| Radial-blur god rays | shafts | ~230k reads at 160×90 | H / S (drawPixels) | no | high-bit |
| Baked shaft sprites | shafts | 1–3 drawImage | B→S | near | both |
| Colored multiply ambient + warm add | warm/cool mood | 1–2 fills | S | no | high-bit-ish |
| Palette or time-of-day reprint and swap | whole-scene mood | 0 (crossfade 2 draws) | B→S | **yes** (except mid-crossfade) | strict |

**A Tycho roadmap reading:**
- Tycho already has the high-bit core (`Smooth`, `ctx.lightMap`, `ctx.tint`, the emissive target and `post.Blur`).
- The missing strict-palette core is:
  - (1) a `tilelight` module: flood or sweep propagation plus grid shadowcasting, writing the cells `Smooth` reads. This is already planned in Tycho's docs as "tilelight".
  - (2) a **stepped and ramp light model** as a second `Tycho.light` class: band count, Bayer 4×4 indexed by world pixel, per-ink ramp texture, and snapping to art pixels. That is Lodestar's `gllight.js` generalized, as a parameterized option in line with Tycho's "parameters, not defaults" rule.
  - (3) a JS twin of (2) over Ink index planes via `drawPixels`, for the no-WebGL path.
  - (4) bake helpers: directional sprite variants, quantized glow halos, and an optional RC or GI room bake.

### Gaps
- No source quantified how far a light map's cell size can grow before players perceive "blocky" light at 320×180. That is a design test for the dev panel.
- No source documents Sea of Stars' or Octopath's pipelines from the developers in technical detail.
