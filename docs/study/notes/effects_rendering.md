# Procedural visual effects and rendering for limited-palette pixel-art games (plain JS, phone browser)

Scope note: researched 2026-11-02. Target: internal resolution about 160x90 to 640x360, a fixed palette of 8 to 64 colors, deterministic, drawn each frame with only fillRect, drawImage, alpha, four blend modes (source-over, lighter, destination-out, multiply), transforms and gradients. In Elsewhere this is "Tycho's GPU stand-in". Offscreen canvases painted once may use anything. Web sources are cited inline. Where a claim rests on general graphics knowledge rather than a fetched source, it sits under Inferences or Gaps, not Cited Findings. Tycho's own docs in the repo are cited as local files because they decide what's feasible here.

## Lighting: light maps, blend-mode lighting, normal maps, 2D shadows, 2D GI, quantized light, day/night, AO

### Takeaway
For a 320x180, 8-ink look the cheapest effect that still reads well is a coarse light grid. Compute it per cell on the CPU, scale it up, and multiply it over the scene. Tycho already ships this as `Tycho.light.Smooth`, plus `ctx.lightMap`/`ctx.tint` on the stand-in. Hard shadows come from visibility polygons or grid shadowcasting, and a stepped or dithered light shader can snap light back to palette bands. Raymarched SDF GI and radiance cascades produce beautiful soft GI, but they need real fragment shaders and many passes. They're out of reach for the stand-in and marginal on phones at anything above very low resolution.

### Cited Findings
- **Tycho's renderer already does light-map lighting on the GPU.** A frame is drawn through stand-in contexts that turn each call into a quad. A light model then lights the scene in one pass. Lodestar measured this against 2D canvases plus a WebGL upload for the light: 4.3 to 1.3 ms in Chrome, and 20 to 2 ms in WebKit (iPhone), "because nothing is read back and nothing is copied between 2D canvases and WebGL." — [vendor/tycho/docs/renderer.md](file:///Users/david/projects/elsewhere/vendor/tycho/docs/renderer.md)
- **`Tycho.light.Smooth`** takes `cells`, a grid of light (RGBA bytes, w x h, each cell `cell` view px). It is "scaled up smooth ... and multiplied over the scene, with `add` of it added (0.1)". `ctx.lightMap = true` multiplies pictures by that map per pixel, and `ctx.tint = [r,g,b]` multiplies a picture by a color, lighting a figure by the light where it stands without a tinted copy. Lodestar's "stepped light (dithered bands, violet in the dark)" runs its own shader through `gpu.lightPass`. — [vendor/tycho/docs/renderer.md](file:///Users/david/projects/elsewhere/vendor/tycho/docs/renderer.md)
- **The stand-in's capabilities:** `globalCompositeOperation` limited to source-over, lighter, destination-out and multiply; `imageSmoothingEnabled` (bilinear when scaled); linear gradients drawn as strips; radial gradients rasterized once by a 2D canvas and kept; a rectangle clip; `drawPixels(imageData, ...)` for pixels rewritten each frame (only changed rows are uploaded). A canvas repainted every frame (e.g. a darkness layer) can be flagged `canvas.gpuLive = true`. Without WebGL2 the same calls run on real 2D canvases and are lit in JS. — [vendor/tycho/docs/renderer.md](file:///Users/david/projects/elsewhere/vendor/tycho/docs/renderer.md)
- **2D visibility polygons (Red Blob Games, Amit Patel; 2012, updated 2018 and 2020):** sort wall endpoints by angle, sweep 360°, keep an "open" set of walls the sweep line crosses, and emit a triangle whenever the nearest wall changes. The union of the triangles is the visible region. For lighting, run it once per light and union the results into a light map (the demo uses 24 lights). Shadows come out hard, and soft shadows need post-processing. Alternatives it lists: casting rays only at endpoint angles, subtractive shadow quads drawn on the GPU per segment, recursive grid shadowcasting for tile maps, and 1D shadow maps. It cites Bungiu et al. in CGAL as about 50x faster than its own sweep. — [Red Blob Games: 2D Visibility](https://www.redblobgames.com/articles/visibility/)
- **Naive 2D GI (jason.today, 27 July 2024):** the jump flood algorithm (JFA) spreads nearest-seed coordinates in `ceil(log2(max(w,h)))` ping-pong passes, then converts the result to a distance field. Each pixel casts rays (8 in the brute-force version) with a random angle offset, and sphere-traces via the SDF in about 32 steps instead of up to 256 fixed steps. Noise is hidden by temporal accumulation (0.9 mix, stopping after about 10 frames), which the author calls "basically a hack". The author notes the canvas can't grow much while staying smooth. — [jason.today: Building Real-Time Global Illumination](https://jason.today/gi)
- **Radiance cascades (Alexander Sannikov; explained at jason.today):** cascade 0 has 1 px probe spacing, and spacing grows by sqrt(base) per level. Cascade i casts base^(i+1) rays and marches an interval starting at base^(i-1) of length base^i, following the "penumbra hypothesis": near light needs spatial resolution, far light needs angular resolution. Cascades merge top-down, sampling the upper cascade bilinearly and clamping to avoid leaks. Cost is "roughly the cost of the naive method at 16 rays, but without noise". Naive 512-ray GI at 1024x1024 is about 1B texture lookups per frame, roughly 100x too slow for 60 fps. Known artifacts: ringing around single lights, grid artifacts without linear filtering, leaks without clamping, and a "hand-wavy" fix needed for base 16. It requires WebGL render targets and a JFA distance field, and "a modern GPU may be needed" at 1024x1024. — [jason.today: Radiance Cascades](https://jason.today/rc); paper: [Raikiri/RadianceCascadesPaper](https://github.com/Raikiri/RadianceCascadesPaper); also [Yaazarai, GM Shaders: Radiance Cascades](https://mini.gmshaders.com/p/radiance-cascades)
- **Normal maps for pixel art (Moreira, Coutinho, Chaimowicz, arXiv 2212.09692, late 2022)** compared five generators against hand painting:
  - Sobel on a grayscale sprite: fully automatic, but geometry comes out incoherent and baked shading creates grooves. Suits texture-like sprites such as grass, wood and water.
  - Sobel on a hand-painted height map: good results, but slow to paint.
  - Beveling, reconstructed from Laigter and Sprite Illuminator: distance transforms of the silhouette mask and edge mask, blended, Gaussian-smoothed, then Sobel. Automatic, but it invents spurious regions and misses concavities.
  - Sprite Lamp's four-light merge: the artist shades the sprite lit from top, bottom, left and right, and the four images are combined into the normal channels. Closest to hand painting.
  - DeepNormals: produces blurry, weak normals.

  Conclusion: "no technique could produce maps as good as the one an artist can manually paint." — [arXiv 2212.09692 (ar5iv)](https://ar5iv.labs.arxiv.org/html/2212.09692)
- **Laigter** (Azagaya) is a free, open-source generator of normal, specular, parallax and occlusion maps for 2D sprites. It has a "Pixelated" preview option and a command line (`laigter -d <texture> -n`), and its maps may be used commercially without attribution. **Sprite Lamp** is paid, proprietary and Windows-only, built around hand-drawn lighting profiles. — [Laigter on itch.io](https://azagaya.itch.io/laigter); [Laigter pixel-art devlog](https://azagaya.itch.io/laigter/devlog/82940/pixel-art-and-more-bugs-found-but-fixed-now); [Laigter on Flathub](https://flathub.org/sv/apps/io.itch.azagaya.Laigter)
- **Newer research:** "Light the Sprite" (Eurographics 2025 short paper) trains a model that generates point- and directional-light maps from RGB pixel-art sprites, with code and dataset on GitHub. DynaPix (SIGGRAPH 2022) is a Krita extension that pixelizes images and generates surface normals. — [Eurographics DL: Light the Sprite](https://diglib.eg.org/handle/10.2312/egs20251032); [SIGGRAPH history: DynaPix](https://history.siggraph.org/?p=127501)
- **Terraria's lighting modes:** Retro is the old engine, with light level per tile and all light white, giving a "blocky" look at low cost. Trippy is the same per-tile engine with color. Color and White modes use "pixel clusters smaller than tiles" for smoother transitions. The wiki suggests Retro or Trippy for older systems to raise frame rate. — [Terraria Wiki: Lighting mode](https://terraria.wiki.gg/wiki/Lighting_mode)
- **Quantized light, a named example:** *Bloodless* used "a 4-color palette and used lighting to blend between those colors with dithering on the borders." — [Game Developer: Deep Dive on Bloodless](https://gamedeveloper.com/art/deep-dive-behind-the-starkly-stylish-art-direction-of-bloodless)

### Inferences
- **Recommended stack for Elsewhere at 320x180:**
  1. A per-tile or per-half-tile light grid computed on the CPU. Flood-fill or BFS propagation from lights through open tiles, attenuating each step, Terraria style. That is cheap (a 40x23 grid is under 1k cells) and deterministic.
  2. Upload it through `Tycho.light.Smooth`, or as a tiny canvas drawn scaled with smoothing on and `multiply` blend.
  3. For the palette rule, snap the light to 3 to 4 bands, with an ordered Bayer dither at band edges, in a light shader (Lodestar's stepped light is the precedent). In the no-GPU path, keep the sprites pre-shaded in 2 to 3 palette variants and pick per tile.
- **Day and night without shaders.** Because `Ink` keeps pictures as palette indexes, the strongest option is to reprint each painted layer in a night palette once, as an offscreen canvas, and crossfade the two with globalAlpha (two drawImage calls). A full-screen `multiply` fillRect with a blue-violet color is cheaper but leaves the palette. A crossfade mixes two palettes for its duration only; holding it at 50% creates off-palette colors.
- **Hard shadows in a tile world.** Use recursive shadowcasting on the tile grid feeding the light grid, or Red Blob's sweep producing polygons. Polygons can't be filled with path fills in the stand-in, so rasterize them into the light grid or an offscreen mask canvas (anything goes offscreen), then draw that canvas.
- **Normal-mapped sprites** need a per-pixel dot product, which means a shader (`gpu.program`/`lightPass`), or prebaking. Prebaking means rendering each sprite lit from N fixed directions (for example 4 or 8) offscreen at load, from a generated normal map (bevel or Sobel), then picking the nearest direction at draw time. Prebaking fits the 8-ink rule better because every baked variant can be quantized to the palette.
- **Ambient occlusion in tiles** can be baked once at map paint time. Darken the corners and edges of floor tiles next to walls by checking the 8 neighbors (the bitmask autotile approach), drawing one palette step darker. That costs nothing per frame.
- **GI** (JFA plus raymarch, or radiance cascades) is a WebGL2 fragment-shader job with about 10 or more passes. At 160x90 or 320x180 the pixel count is about 1/36 of 1024x1024, so radiance cascades could plausibly run on a recent phone GPU. Quantizing it to palette bands would erase most of its subtlety, so it's poor value for an 8-ink look.

### Gaps
- No phone benchmarks for radiance cascades or JFA GI at 320x180 were found.
- The internals of Terraria's newer smooth light engine (the propagation code) are not documented in sources found. Only the wiki-level mode descriptions were found.
- Eastward's lighting implementation was not documented in any developer source found. One forum guess said trailers suggest plain 2D lights, not normal maps, but it's unverified.
- The exact algorithms for Hyper Light Drifter's lighting and dithering were not found in primary sources.

## Palette tricks: cycling, swaps, palette fades, LUTs

### Takeaway
Palette cycling is the most on-model effect for an indexed-color engine. Elsewhere's `Ink` already stores pictures as palette indexes, so cycling, hit flashes, status swaps and palette-to-palette fades become a matter of reprinting from a different palette. Canvas Cycle shows how to make this fast in a browser: precompute which pixels use cycling indexes and redraw only those.

### Cited Findings
- **Canvas Cycle (Joseph Huckaby, Effect Games, about 2011)** is a real-time 8-bit color-cycling engine in HTML5 canvas, showing 35 of Mark J. Ferrari's 640x480 scenes. Ferrari worked on LucasArts' *Loom* and *The Secret of Monkey Island*. Each scene animates rain, snow, waves, fog, clouds, smoke, waterfalls, streams and lakes from one flat image and one 256-color palette, "with no layers or alpha channels".
  - Optimization: preprocess each image on load to store the offsets of animated pixels in a smaller array, and redraw only those pixels each frame instead of all 307,200. That let it run on an iPhone 3GS and iPad.
  - Scene data is JSON, gzipped to about 100 KB per scene.
  - "BlendShift" cycling fades neighboring colors into each other as they shift, creating in-between frames at the same cycle speed. That introduces off-palette blended colors.

  — [Effect Games: Old School Color Cycling with HTML5](http://www.effectgames.com/effect/article-Old_School_Color_Cycling_with_HTML5.html)

### Inferences
- **Cycling with the stand-in.** You can't putImageData per frame on the GPU path cheaply except via `drawPixels`, which uploads changed rows. Alternatives:
  - (a) Pre-render the N phases of a cycle as N offscreen canvases (or one sprite-sheet strip) at load, and drawImage the current phase. N is the cycle length, typically 4 to 16. Memory is N times the layer, so cycle only small regions (water tiles, a waterfall, a lamp halo).
  - (b) Split a cycling layer into one mask canvas per cycling index, and redraw each with a color via `tint`. That's only practical with few indexes.
  - Option (a) keeps the palette exact and is deterministic (phase = floor(t / period) mod N).
- **Hit flash.** Pre-paint a one-ink silhouette (all opaque pixels set to white, or the palette's lightest ink) of each sprite once, and draw it for 1 to 3 frames. A one-off silhouette can also be made per frame with the offscreen `source-in` composite, but that op isn't in the stand-in, so bake it. `ctx.tint` multiplies, so it can darken or tint toward a color but not whiten. Use the baked silhouette for white flashes.
- **Status swaps (poison green, frozen blue)** are palette remaps of the index picture: reprint once per status and cache.
- **Fades through palettes,** the classic NES/SNES fade, step through 3 to 5 precomputed palettes, each ink stepping one place down a ramp toward black or white, reprinting or swapping canvases per step. This stays on-palette, unlike a globalAlpha black overlay, which produces intermediate off-palette colors during the fade.
- **Color LUTs** (3D lookup textures) need a shader. On the palette path, a "LUT" is simply a palette-to-palette index map (an array of up to 64 entries) applied at reprint time. It's essentially free.

### Gaps
- No primary source was fetched for Mark Ferrari's GDC talk on palette cycling ("8-bit and 16-bit painting"), and Canvas Cycle doesn't name its canvas API calls.

## Water and reflections: ripple displacement, caustics, waves, foam, refraction, waterfalls

### Takeaway
At pixel resolution, water reads through four cheap tricks: a vertically flipped copy of what's above the shoreline, a per-row horizontal sine offset for ripples, cycling highlight inks for glints and foam, and a scrolling strip for waterfalls. All but the per-pixel displacement are doable with drawImage strips. Tycho's `post.Blur` already reflects "wet strips" with a ripple.

### Cited Findings
- **Tycho's `post.Blur`** handles "each wet strip (`{ x0, y0, x1, depth, k }`, view px) reflecting what's above it with a ripple". It also handles two bloom layers and the fade, scaled up by whole pixels. — [vendor/tycho/docs/renderer.md](file:///Users/david/projects/elsewhere/vendor/tycho/docs/renderer.md)
- **Ferrari's palette-only water.** Waves, streams, lakes and waterfalls are animated purely by palette cycling over one image. — [Effect Games: Canvas Cycle](http://www.effectgames.com/effect/article-Old_School_Color_Cycling_with_HTML5.html)
- **Animal Well** has raymarched reflections, but only of its SDF background geometry, and uses a Navier-Stokes fluid layer for water and smoke. — [PlayStation Blog, 20 July 2022](https://blog.playstation.com/?p=367113)

### Inferences
- **Reflections with the stand-in.** For each row y of the water region, drawImage a 1 px tall strip from the source row `2*shore - y` of the already-drawn scene layer (an offscreen canvas), offset horizontally by `round(A * sin(y*k + t*w))`. That's one drawImage per row: 50 rows of water means 50 quads, which is cheap. Use `scale(1,-1)` for the flip if you draw whole bands instead. Then multiply by a water-tint fillRect, or alpha-blend a water-ink fillRect, and accept off-palette mixing only if the look allows it. Otherwise quantize by drawing the reflection only in alternating rows (a dithered transparency).
- **Isometric caveat.** In a 2:1 isometric view the "flip" axis isn't a screen row. Practical games fake it by reflecting the sprite under its own feet (draw each figure flipped vertically at its foot point, clipped to the water mask) rather than reflecting the scene.
- **Shore foam.** Compute shoreline cells once (water cells with a land neighbor), and place foam pixels in 1 to 2 inks cycled with a phase offset by a hash of position, so it shimmers deterministically.
- **Caustics.** Pre-render 8 to 16 frames of a tileable caustic pattern offscreen (for example thresholded Worley/Voronoi edges, or two scrolling sine-noise fields ANDed), in a single light ink. Draw with `lighter` or source-over, clipped by the water area.
- **Refraction** (what's under the water wobbling) is the same per-row strip offset applied to the underwater layer.
- **Waterfalls.** A vertical strip texture of 2 to 3 inks scrolled down by `t*speed mod h` (two drawImage calls for the wrap), plus foam particles at the base.
- **Per-pixel displacement maps** (true refraction offsets) need a shader or a JS pixel loop plus `drawPixels`. At 320x180 a JS loop over 57,600 pixels is feasible per frame, but only if no GPU readback is involved. Work in a JS-side index buffer, never getImageData from a GPU canvas.

### Gaps
- No primary source on how specific games (Eastward, Sea of Stars) implement water reflections was found.

## Weather and atmosphere: rain, snow, fog, god rays, clouds and cloud shadows, wind, heat haze, motes, fireflies, depth haze

### Takeaway
Nearly all weather is either particles (rain, snow, motes, fireflies, leaves) or scrolling, pre-painted layers (fog, clouds, cloud shadows, god rays) drawn with alpha or `multiply`/`lighter`. Heat haze is per-row strip displacement. All fit the stand-in if the layers are painted once in palette inks.

### Cited Findings
- **Single-image weather is possible.** Ferrari's scenes show rain, snow, fog, clouds and smoke with no layers or alpha, purely by palette cycling. — [Effect Games: Canvas Cycle](http://www.effectgames.com/effect/article-Old_School_Color_Cycling_with_HTML5.html)
- **Sea of Stars** ties its dynamic lighting to time-of-day changes the player controls. One technical artist (Jeakim Hamel) worked on the lighting from 2018, and asset production had to conform to the lighting pipeline. — [MobileSyrup interview with Thierry Boulanger, Sept 2023](https://mobilesyrup.com/2023/09/11/sea-of-stars-level-design-sabotage-studio-thierry-boulanger-interview/)
- **Sea of Stars' planned features (Kickstarter-era list, may differ from the shipped game):** normal-mapped sprites, multi-angle shadow-casting sprites, volumetric lighting, and screen-space indirect lighting. — [Niche Gamer, March 2020](https://nichegamer.com/2020/03/19/the-messenger-prequel-rpg-sea-of-stars-enters-kickstarter-launches-2020-for-pc/)

### Inferences
- **Rain.** Short 1x3 to 1x5 diagonal streaks in 1 to 2 inks, as fillRects (or a 2-pixel sprite per drop). Position is a pure function of (index, time): `x = (hash(i)*W + t*vx) mod W`, `y = (hash2(i)*H + t*vy) mod H`. That makes it deterministic, stateless and wrap-around. Splashes are a 2-frame sprite at a hashed ground point when the drop's y passes its target. 100 to 300 drops is a trivially small number of quads.
- **Snow.** The same, plus a sine sway `x += A*sin(t*f + phase_i)`. Draw 2 to 3 depth layers at different speeds and sizes (1 px versus 2 px) for parallax.
- **Fog.** A large tileable cloud-noise texture, quantized to 2 to 3 alpha levels or drawn as a dithered pattern in one ink, painted once offscreen and drawn twice, scrolling at two speeds. Dithered fog (a checker or Bayer mask) keeps the palette exact. Smooth alpha fog doesn't.
- **Cloud shadows.** The same texture in a dark ink drawn with `multiply` at low alpha, scrolled across the ground. This is very effective in isometric views, and cheap (one or two drawImage calls).
- **God rays.** Pre-painted diagonal light shafts (a linear gradient or banded strips) drawn with `lighter` at low alpha. They can be animated by slow alpha pulsing. For an on-palette version, use dithered shafts in a light ink.
- **Heat haze.** The per-row horizontal offset of a band, as in the water ripple, with small amplitude (1 px) and high frequency.
- **Dust motes and fireflies.** Particles with a Lissajous path, `x = cx + A*sin(t*a + p)` and `y = cy + B*sin(t*b + q)`, so no state is needed. Fireflies blink on a hashed period and draw a 1 px core plus a `lighter` 3x3 glow, or go into Tycho's glow layer `F.EM` for bloom.
- **Wind.** One global wind function `w(t)` (a sum of 2 to 3 slow sines) shared by grass sway, particles, smoke drift and cloud speed, so the world agrees with itself.
- **Depth haze for parallax layers.** Reprint far layers in a lighter or bluer palette (index remap) once. Don't use alpha overlays.

### Gaps
- No primary sources were found with measured costs of particle counts on mobile Canvas 2D or WebGL for these effects.

## Particles: pixel-snapped systems, sprite versus per-pixel, palette ramps, determinism, cheap physics

### Takeaway
Keep particles as plain `{x, y, vx, vy, t}` objects drawn as 1 to 2 px fillRects at rounded positions, colored by stepping down a short palette ramp over their life, with randomness drawn from a hash of (frame, index, draw#) so a frame redraws identically. Tycho.fx already implements this pattern.

### Cited Findings
- **Tycho.fx** provides `Particles` (max 260, keep 200), `move` (drag as speed times e^(-drag·dt), gravity, floor with bounce 0.35 and slide 0.6), `sparks` (orange to yellow, g 400), `burst` (ring), `tick`/`age`, and `rise` (floating text). Particles are drawn as `fillRect(Math.round(p.x - cx), Math.round(p.y - cy), 1, 1)`. The random source is `draw(k, s)`, "the k-th particle's s-th draw". The White Dragon uses `hash(Game.frame, k, s)` "so a frame's sparks are the same however often it's drawn." Effects aren't saved or golden-tested, so they may use `Tycho.seed.fxRand`. — [vendor/tycho/docs/fx.md](file:///Users/david/projects/elsewhere/vendor/tycho/docs/fx.md)

### Inferences
- **Palette ramps.** Give each effect a 3 to 5 ink ramp (fire: white, yellow, orange, red, dark; magic: white, cyan, blue, violet). Pick the ink as `ramp[floor((1 - t/life) * ramp.length)]`. Never fade alpha: shrink size from 2 px to 1 px, then vanish. That is the Celeste-style pixel particle look, and it keeps the ink count.
- **Sprite versus per-pixel particles.** Per-pixel fillRects are one quad each in the stand-in. Sprite particles (smoke puffs from 3 to 5 pre-drawn frames) cost the same per quad and give more shape. Use sprites for big soft things like smoke and dust clouds.
- **Pixel snapping.** Round only at draw time, keep subpixel positions in state, and snap the camera to whole pixels too, or particles jitter relative to tiles.
- **Determinism beyond fxRand.** A stateless particle (position as a closed-form function of birth time and a hashed seed) can be rewound and reproduced, which suits golden tests.

### Gaps
- No primary source was retrieved for Celeste's particle system specifics (a Matt Thorson or Noel Berry write-up). The Celeste style descriptions above are general knowledge.

## Simulation effects: falling sand/CA, stable fluids, Doom fire, grass, destructible terrain

### Takeaway
The Doom fire automaton is the gold standard for this target. It's an integer grid of palette indexes, one subtract and one random offset per cell, fully deterministic with a seeded RNG, and its output is already palette indexes. Falling sand and Stam fluids also run fine at 160x90 to 320x180 in JS. Noita shows the chunking and dirty rects needed at scale, and Animal Well shows thresholding a fluid sim back to pixel-art colors.

### Cited Findings
- **Doom PSX fire (Fabien Sanglard, 28 Dec 2018):** an index buffer valued 0 to 36 (37 palette entries, white at 36 through yellow, orange and red to black at 0). The bottom row is fixed at 36 and is the heat source. Each frame, for every pixel above row 0: `rand = round(random()*3) & 3; to = from - W - rand + 1; fire[to] = fire[from] - (rand & 1)`. That combines decay (lose 0 or 1) with a random sideways spread, and biasing the offset simulates wind. Credited to Samuel Villarreal's reverse engineering of the N64 version, with code at Fabien's DoomFirePSX `flames.html` on GitHub. — [Fabien Sanglard: How DOOM fire was done](https://fabiensanglard.net/doom_fire_psx/)
- **Noita (Nolla Games):** the world is divided into 64x64 chunks, each keeping a dirty rect of pixels needing update. Multithreading updates alternating chunks in passes, letting a pixel move up to 32 px beyond its chunk. Falling pieces of terrain become rigid bodies rather than pixels. The GDC 2019 talk "Exploring the Tech and Design of Noita" is by Petri Purho. — [80.lv: Noita, a game based on falling sand](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/); [Noita wiki: Official Interviews and Videos](https://noita.wiki.gg/wiki/Official_Interviews_and_Videos). The chunk details come from the 80.lv secondary source; the GDC talk itself was not retrieved.
- **Stam, "Real-Time Fluid Dynamics for Games" (GDC 2003):** a square grid with a boundary layer of cells, velocity and density per cell, semi-Lagrangian advection and implicit (Gauss-Seidel) diffusion, unconditionally stable at any time step, with a complete short C implementation. JS ports exist (npm `stam-stable-fluids`). The method was covered by US Patent 6,266,071. — [Autodesk Research: Real-Time Fluid Dynamics for Games](https://www-pt.autodesk.com/research/publications/real-time-fluid-dynamics); [npm stam-stable-fluids](https://www.npmjs.org/package/stam-stable-fluids); [Freiburg seminar slides (patent note)](https://cg.informatik.uni-freiburg.de/intern/seminar/gridFluids_StableFluidsImplementation.pdf)
- **Animal Well's fluid layer:** a Navier-Stokes simulation for water and smoke. Sprites are drawn into it as "dye", game objects push forces, and "colors are thresholded to fit the pixel art". — [PlayStation Blog, 20 July 2022](https://blog.playstation.com/?p=367113)

### Inferences
- **Doom fire for Elsewhere.** Replace `Math.random` with `ctx.rng('fire')` to satisfy the repo's determinism rule. Map 0 to 36 down to the frame's 3 to 5 fire inks by thresholds. Run it at the fire's own small size (for example 32x24 for a campfire, not full screen). Draw it via `drawPixels` (GPU path), or by writing an ImageData to an offscreen 2D canvas and drawing that. Cost is W*H integer ops per frame, negligible at these sizes.
- **Falling sand at 320x180.** 57,600 cells in a Uint8Array, scanned bottom-up with alternating left/right direction per row to avoid bias, with dirty-rect or active-chunk skipping (Noita's idea, scaled down). JS handles this easily per frame. The cost is upload: use `drawPixels`, which uploads only changed rows.
- **Stam fluids** at 64x36 to 128x72 with about 10 to 20 Gauss-Seidel iterations are fine in JS on phones. Render density through thresholds into 2 to 4 inks (the Animal Well approach). US patents last 20 years from filing, so US 6,266,071 has likely expired. This is unverified: check before relying on it.
- **Grass interaction.** Store per-blade (or per-tuft) bend angles. Each frame the bend relaxes toward the wind `w(t)`, and is pushed away from the player within radius r. Draw 2 to 3 pre-drawn bend frames rather than rotating pixels, since rotation breaks pixel art (see cleanEdge below).
- **Destructible terrain.** Keep a solidity mask, a Uint8Array or a 1-bit canvas. Carve with `destination-out` fillRects or a stamped brush drawImage on an offscreen terrain canvas (the op is in the stand-in), then mark it `gpu.dirty(canvas)`. Debris pixels become particles, and big chunks become rigid bodies (Noita).

### Gaps
- The GDC Noita talk's specifics (material rules, update order, Box2D use) weren't retrieved directly.
- No source confirming the expiry date of Stam's patent was found.

## Post-processing: CRT, palette-limited bloom, chromatic aberration, vignette, grain, dithered transparency, outlines, upscaling, juice, transitions

### Takeaway
Most "post" for an 8-ink look should be done at the native pixel grid with drawImage and fillRect: dithered transparency, baked outlines, vignettes from a pre-painted dither mask, integer upscaling, screen shake by whole pixels, hit stop by skipping simulation frames, and transitions by mosaic (draw small, then scale up) or by masks. Bloom, CRT curvature, chromatic aberration and sharp-bilinear scaling are shader territory, and Tycho's `frameEnd` and `post.Blur` already provide bloom and integer scaling.

### Cited Findings
- **Tycho's finish passes:** `gpu.frameEnd()` (Lodestar's grid bloom, configured as `[[cell px, strength]...]`), and `post.Blur`: glow "halved by averaging (so the bloom holds steady as the camera moves) and blurred into two layers", plus the lit picture, wet reflections and the fade, "scaled up `out` canvas px a view px" (whole pixels). Things that glow are drawn into the `F.EM` context. — [vendor/tycho/docs/renderer.md](file:///Users/david/projects/elsewhere/vendor/tycho/docs/renderer.md)
- **Sharp bilinear (rsn8887, after TheMaister):** an integer prescale (fixed 2x, or the optimum integer for the screen) followed by a bilinear pass to fill the screen. This removes "pixel wobble" (uneven pixel sizes at non-integer scales) at the cost of slight softness. — [rsn8887/Sharp-Bilinear-Shaders](https://www.GitHub.com/rsn8887/Sharp-Bilinear-Shaders)
- **Godot "adjustable strength sharp linear" shader:** disables interpolation at integer multiples, otherwise interpolates only at pixel edges, to avoid shimmer during camera motion. — [Godot Shaders: Adjustable Strength (Sharp) Linear Interpolation](https://godotshaders.com/shader/adjustable-strength-sharp-linear-interpolation/)
- **A critique:** an HN commenter argues that triangle-style filters blur pixel art, and that "sharp bilinear" variants reduce to a polyphase filter. — [HN discussion](https://hn.nuxt.dev/item/45555989)
- **cleanEdge (torcado, MIT license, credit appreciated):** a pixel-art upscaling algorithm aimed mainly at *rotating* sprites, prioritizing lines and edges to avoid the jumbled pixels of nearest-neighbor rotation. It's available as a shader (source in a GitHub Gist). — [torcado: cleanEdge](https://torcado.com/cleanEdge/)

### Inferences
- **Dithered transparency.** Draw an object through a pre-made 4x4 Bayer threshold mask at a given level (16 levels). Make 16 mask canvases once, draw the sprite onto an offscreen canvas, apply `destination-out` with the mask (offscreen anything goes), cache, and draw. On the stand-in, pre-bake "50% dithered" variants of sprites that need see-through (an object occluding the player). This is the standard on-palette replacement for alpha.
- **Outlines.** Bake them at paint time: dilate the sprite's alpha by 1 px and fill with the outline ink. The repo's "dark outline" rule makes this a paint-time step, never a per-frame shader.
- **Vignette.** A radial gradient is allowed in the stand-in (rasterized once). For the palette rule, use a pre-painted Bayer-dithered black border mask, drawn once per frame.
- **CRT and scanlines.** Scanlines can be done as a pre-painted overlay of dark rows at screen resolution (after upscaling), drawn with `multiply`. Curvature, phosphor masks and chromatic aberration need a shader. Chromatic aberration can be faked by drawing the frame three times with `lighter` and R/G/B tints offset 1 px, but that triples fill rate, and fill rate is the main phone concern. They also break the 8-ink look by design.
- **Film grain.** A small pre-baked noise tile set (4 to 8 frames of 1-bit noise in a dark ink at low alpha), cycled deterministically with fxRand. Per-pixel random noise each frame would need a pixel loop.
- **Pixel-perfect upscaling in the browser.** Render at 320x180, then scale by an integer with `imageSmoothingEnabled = false` and the CSS `image-rendering: pixelated`. Letterbox the remainder, or apply sharp bilinear in a final shader when the phone's aspect doesn't give an integer fit. Snap the camera to whole native pixels. For smooth camera motion at native resolution, render a 1 px larger frame and offset it by the subpixel remainder at the upscaled stage (a common technique, not sourced here).
- **Screen shake.** Offset the camera by integer pixels, decaying (trauma squared times a hashed offset), with randomness from fxRand or a frame hash.
- **Hit stop.** Freeze simulation for 2 to 6 frames on a heavy hit while still rendering, optionally with a white-silhouette flash frame.
- **Squash and stretch** of sprites breaks pixel grids if done by arbitrary scale. Use pre-drawn frames or integer-step scales.
- **Transitions:**
  - Mosaic/pixelate: draw the frame to a 1/n-size offscreen canvas without smoothing, then draw it back scaled up. That's two drawImage calls, fully stand-in compatible.
  - Dither wipe: animate the Bayer threshold level from 0 to 15 over a black overlay. Each step draws a pre-baked mask canvas.
  - Iris: a pre-painted ring mask scaled, or a radial gradient with a hard stop. In the stand-in the radial gradient is rasterized once, so scale a fixed mask canvas instead.
  - Palette fade: step through palettes (see the palette section).
  - Directional wipes: fillRect.

### Gaps
- No mobile fill-rate measurements for multi-pass post on WebGL at these resolutions were found.
- Primary sources for "fat pixel" shaders specifically (as opposed to sharp bilinear) weren't retrieved.

## Feasibility: what fits the stand-in, what needs offscreen pre-baking, what needs real shaders; phone performance

### Takeaway
With Tycho's design the rule is: anything expressible as quads of pre-painted pictures, combined with source-over, lighter, multiply or destination-out plus alpha, runs on the stand-in. Anything per-pixel either becomes a CPU buffer uploaded with `drawPixels` (fine at 320x180 if you never read back from the GPU) or a custom shader through `gpu.program`/`lightPass`. The biggest phone hazards are GPU readback (`getImageData`), full-screen overdraw, and per-frame canvas-to-texture copies.

### Cited Findings
- **Readback hurts, and Tycho avoids it.** "Nothing is read back and nothing is copied between 2D canvases and WebGL," taking a WebKit frame from 20 ms to 2 ms. Canvases drawn once go into an atlas. Canvases repainted each frame must be marked `gpuLive` or `dirty` (uploaded again). — [vendor/tycho/docs/renderer.md](file:///Users/david/projects/elsewhere/vendor/tycho/docs/renderer.md)
- **`getImageData` costs and `willReadFrequently`:** GPU readbacks are expensive, especially synchronous ones like getImageData and toDataURL. `willReadFrequently: true` asks the browser to keep a 2D canvas on the CPU. Browsers were removing their CPU/GPU heuristics, so apps must set the flag at context creation, and Chrome logs a warning after repeated reads. — [WebKit bug 235196](https://bugs.webkit.org/show_bug.cgi?id=235196); [MapLibre PR 1808](https://github.com/maplibre/maplibre-gl-js/pull/1808); [Babylon.js forum](https://forum.babylonjs.com/t/dynamictexture-getcontext-chrome-warning/39620)
- **Older evidence:** get/putImageData cost grew with canvas size, mostly in the read. — [Mozilla bug 1001069](https://bugzilla.mozilla.org/show_bug.cgi?id=1001069)
- **Canvas Cycle ran on an iPhone 3GS** by redrawing only the pixels that change. — [Effect Games](http://www.effectgames.com/effect/article-Old_School_Color_Cycling_with_HTML5.html)
- **2D GI needs WebGL render targets and many passes.** — [jason.today/rc](https://jason.today/rc)

### Inferences
**Stand-in OK each frame** (quads, alpha, four blends, transforms, gradients):

| Effect | How |
|---|---|
| Light grid | `Smooth`, or a scaled canvas with `multiply` |
| Additive glows | `lighter`, or the `F.EM` layer for bloom |
| Day/night | Crossfade of two reprints |
| Cloud shadows, fog, god rays | Scrolling pre-painted layers |
| Rain, snow, motes, fireflies, sparks | Particles |
| Screen shake, hit stop | Camera offset, simulation freeze |
| Mosaic transition | Two drawImage calls |
| Dither wipes, iris | Pre-baked masks |
| Reflections and ripples, heat haze | Per-row strips |
| Waterfalls | Scroll |
| Palette cycling | N pre-rendered phases |
| Hit flash | Baked silhouette |
| Destructible terrain | `destination-out` on an offscreen canvas plus `dirty` |
| Vignette | Gradient or mask |

**Offscreen pre-bake** (paint once with anything, including getImageData on a CPU canvas with `willReadFrequently`): outlines, AO, palette reprints (night, status, fades, parallax haze), dither masks, normal-map prelit variants, caustic frames, fog and cloud textures, cycle phases, and sprite silhouettes.

**CPU buffer plus `drawPixels` per frame:** Doom fire, falling sand, Stam fluid, and Game-of-Life-style automata. These are fine at about 320x180 or smaller regions. Never read back from a GPU canvas. Keep the truth in a typed array.

**Real shaders** (WebGL2 via `gpu.program`/`lightPass`, or WebGPU): normal-mapped per-pixel lighting, stepped and dithered light quantization in a light pass, SDF/JFA soft shadows, radiance-cascade or raymarched GI, true displacement-map refraction, CRT curvature and masks, chromatic aberration done properly, sharp-bilinear and cleanEdge scaling, and color LUTs on non-indexed content.

**Phone cost ranking** (cheapest first): palette reprints and baked work (zero per frame); quads and particles; per-row strip effects; small CPU automata plus uploads; full-screen extra passes (each roughly one more full-screen fill); multi-pass GI. At 320x180 even several full-screen passes are small (57,600 px each). The risk grows when post runs at the *device* resolution after upscaling, for example 2532x1170, which is about 50x more pixels. So do all effects at native resolution and upscale last.

### Gaps
- No mobile-specific benchmarks (iOS Safari or Android Chrome) of `willReadFrequently`, `putImageData` or WebGL texture upload at 320x180 were found.
- Tycho's own measurements are the only phone-relevant numbers found, and they cover a frame's light pass, not individual effects.

## Notable games and talks

### Takeaway
The pixel-art lighting landscape splits into two camps. One is "modern lighting over pixel art": Animal Well's SDF raymarching plus hand-drawn normals plus a fluid sim, Sea of Stars' custom Unity pipeline, and Kiyo's 3D-style lights. The other is "lighting that obeys the palette": Bloodless's 4-color dithered light, Terraria's per-tile Retro mode, and Ferrari's palette cycling. Elsewhere's 8-ink rule points squarely at the second camp, using the first only for glows and bloom.

### Cited Findings
- **Animal Well (Billy Basso, solo, custom engine; PlayStation Blog 20 July 2022):**
  - Many layers composited, with lighting built from them.
  - Hand-drawn normal maps for backgrounds.
  - SDF geometry raymarched and lit by foreground lights, with raymarched reflections.
  - A Navier-Stokes fluid layer for water and smoke, thresholded to pixel-art colors.
  - A modified Aseprite exporting a custom binary animation format with live reload.
  - Game code talks to the GPU directly, for same-frame input latency.

  — [PlayStation Blog](https://blog.playstation.com/?p=367113); [TechRadar](https://www.techradar.com/news/how-animal-well-uses-the-ps5-hardware-for-its-new-beautiful-metroidvania-world)
- **Noita:** Petri Purho's GDC 2019 talk "Exploring the Tech and Design of Noita". 64x64 chunks with dirty rects, checkerboard multithreading, and rigid bodies for falling terrain. — [80.lv](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/); [Noita wiki](https://noita.wiki.gg/wiki/Official_Interviews_and_Videos)
- **Sea of Stars (Sabotage, Aug 2023):** a custom lighting pipeline in Unity, one technical artist on lighting since 2018, and a time-of-day mechanic. — [MobileSyrup](https://mobilesyrup.com/2023/09/11/sea-of-stars-level-design-sabotage-studio-thierry-boulanger-interview/)
- **Terraria:** four lighting modes; Retro and Trippy are per-tile and cheaper, Color and White are sub-tile and smooth. — [Terraria Wiki](https://terraria.wiki.gg/wiki/Lighting_mode)
- **Bloodless:** a 4-color palette with light blended between colors by dithering at the borders. — [Game Developer](https://gamedeveloper.com/art/deep-dive-behind-the-starkly-stylish-art-direction-of-bloodless)
- **Kiyo:** Aseprite pixel art with 3D-style lighting, rendering into a high-resolution target so rotation doesn't look bad. — [80.lv: next-gen pixel art with real-time dynamic lighting](https://80.lv/articles/exploring-next-gen-pixel-art-with-real-time-dynamic-lighting)
- **Doom PSX/N64 fire:** see the simulation section. — [Fabien Sanglard](https://fabiensanglard.net/doom_fire_psx/)
- **Mark Ferrari and Canvas Cycle.** — [Effect Games](http://www.effectgames.com/effect/article-Old_School_Color_Cycling_with_HTML5.html)

### Inferences
- **Hyper Light Drifter** (made in GameMaker, per a secondary mention) is commonly cited for its limited-palette dithered gradients and glow. It's a useful reference for palette-respecting light, but its technique isn't documented in primary sources found.
- **Octopath Traveler's "HD-2D"** (3D scenes with pixel sprites, depth of field, bloom and tilt-shift) is the opposite of an 8-ink rule. It's useful only as a cautionary contrast: depth of field and bloom produce unlimited colors.

### Gaps
- No primary or developer sources were retrieved for:
  - Hyper Light Drifter's lighting or dithering
  - Eastward's renderer (Pixpil)
  - Dead Cells' pipeline (Motion Twin is known for 3D models rendered to pixel art with normal maps, but no source was fetched)
  - Blasphemous's effects
  - Octopath's HD-2D pipeline
  - Celeste's particles

  These remain to be sourced if the report needs them.
- No Billy Basso conference talk on Animal Well's renderer was found. The PlayStation Blog post is the primary source.
