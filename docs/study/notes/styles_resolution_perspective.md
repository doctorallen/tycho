# Pixel-art styles, resolution and detail, palettes and color, and perspectives (for a plain-JS phone engine)

Research notes compiled 2026-11-02. Sources were fetched or searched this session unless an item is marked "general knowledge, not verified this session". Those items sit only in Inferences or Gaps, never in Cited Findings. Target: a plain-JS canvas engine on phones, with internal resolutions from 128x128 to 640x360. (Context: Elsewhere already renders isometric at 320x180 with 8 inks per frame, through an indexed-palette painter, `Ink`.)

---

## (a) Styles: which rules define each major pixel-art style, and which can an engine enforce automatically?

### Takeaway
The classic styles are defined by hardware rules that can be written down and checked by a program: a master palette, a few colors per sprite or per tile region, the region's size, sprite size, and sprites per scanline. An indexed-color engine can enforce these exactly. The modern styles (hi-bit, HD-2D, painterly, minimalist) are defined by habits instead: palette discipline, outline policy, cluster cleanliness, and post effects. An engine can enforce only some of those (palette lock, colors per frame, no anti-aliasing, outline rules). The rest has to be encoded as generator rules or checked with heuristics.

### Cited Findings
**NES (Famicom), from the hardware reference**
- Master palette: "A 6-bit value in the palette memory area corresponds to one of 64 outputs", and some entries are duplicates — [NESdev: PPU palettes](https://www.nesdev.org/wiki/PPU_palettes)
- "Backgrounds and sprites each have 4 palettes of 4 colors, located at $3F00-$3F1F". Entry 0 is transparent or shared, so each palette has 3 usable colors. The backdrop color is shared between the background and sprite palettes. Counting from that layout gives 25 colors at once (1 backdrop + 12 background + 12 sprite) — [NESdev: PPU palettes](https://www.nesdev.org/wiki/PPU_palettes)
- Sprites are "8x8 or 8x16 pixels", set globally — [NESdev: PPU palettes](https://www.nesdev.org/wiki/PPU_palettes)
- Attribute grid: "The background palette has one backdrop color and four three-color subpalettes." "Each 16x16 pixel color area has one of four subpalettes assigned to it." One attribute byte covers 32x32 pixels in four 2-bit quadrants, and each nametable has a 64-byte attribute table (8x8) — [NESdev: PPU attribute tables](https://www.nesdev.org/wiki/PPU_attribute_tables)

**Game Boy (DMG) and Game Boy Color**
- 160x144 screen, "4 shades of green". Palettes: "BG: 1 × 4, OBJ: 2 × 3". Sprites are 8x8 or 8x16. At most 40 sprites per screen and 10 per line. The CGB has "BG: 8 × 4, OBJ: 8 × 3" — [Pan Docs: Specifications](https://gbdev.io/pandocs/Specifications.html)

**SNES**
- Display modes of 256×224, 512×224 and 512×448. Colors come from "a palette of 32,768 colors" (15-bit RGB). "256 × 15 bits of color generator RAM (CGRAM)" allows up to 256 colors on screen. 544 bytes of OAM — [Wikipedia: SNES technical specifications](https://en.wikipedia.org/wiki/Super_Nintendo_Entertainment_System_technical_specifications)
- Mode 7 "has a single layer that can be scaled and rotated" — [Wikipedia: Mode 7](https://en.wikipedia.org/wiki/Mode_7)

**PICO-8 (fantasy console)**
- "Display: 128x128, fixed 16 colour palette". The sprite sheet holds 128 sprites of 8x8, plus 128 more shared with the bottom half of the map (256 in all, viewable as a 128x128 image). The map is 128x32 tiles, or 128x64 with the shared space — [PICO-8 manual](https://www.lexaloffle.com/dl/docs/pico-8_manual.html)
- `pal()` remaps colors at three levels: the draw palette (0), the display palette (1, which remaps the whole screen as it is shown) and the secondary palette (2). `fillp()` sets a 4x4 two-color pattern from a 16-bit bitfield, so dithered fills are a built-in primitive. For example, `fillp(0b0011001111001100)` gives a checkerboard — [PICO-8 manual](https://www.lexaloffle.com/dl/docs/pico-8_manual.html)

**1-bit (Return of the Obra Dinn)**
- Pope's dither needed special handling because a screen-fixed dither flickers uncomfortably when the camera moves. He mapped the dither pattern onto a sphere centered on the player's head. This pins the pattern to geometry while the camera rotates, but not while it translates — [runevision: Surface-Stable Fractal Dithering](https://runevision.com/tech/dither3d); [MetaFilter summary of the devlog](https://www.Metafilter.com/170872/man-this-dithering-is-stable-as-shit-total-magic-going-on-here)
- Conflict: Pope is also quoted as liking the game's look because it is "proper screen space dithering where every dither point has the same size". The sources disagree on how much of the shipped look is sphere-mapped and how much is screen-space. The original TIGSource devlog (topic 40832) returned HTTP 403 here — [search summary incl. runevision forum quote](https://runevision.com/tech/dither3d); [PlayStation Blog on the art style](https://blog.playstation.com/archive/2019/10/17/lucas-pope-on-return-of-the-obra-dinns-art-style)
- Rune Skovbo Johansen's "surface-stable fractal dithering" makes "the dots in the dither patterns stick to surfaces" while keeping dot size and spacing roughly constant on screen. The shader is open source at github.com/runevision/Dither3D — [runevision](https://runevision.com/tech/dither3d)

**Hue-shifted palettes (hi-bit and modern practice)**
- Slynyrd builds ramps of nine swatches with +20° of hue between swatches ("20 is about as high as I go"). Eight ramps sit 45° apart. Brightness rises steadily, with steps shrinking near 100%. Saturation "peaks around the middle and never fully goes to 100, or 0". Avoid high saturation together with high brightness. Make grays by duplicating the middle section, flipping it and desaturating it. His full palettes run 128 to 160 colors, but he advises starting with one small ramp — [Slynyrd Pixelblog 1: Color Palettes](https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes)

**HD-2D (Octopath Traveler)**
- The team kept "a good amount of pixel aesthetic" and set it in a 3D environment. An all-pixel version was tried first and "felt fake and low-quality". On big screens the sprites looked "lonely and simple", so the team raised the density of tile variations and colors — [Siliconera interview](https://www.siliconera.com/project-octopath-traveler-developers-answer-project-started-troubles-developing-hd-2d/); [Nintendo Everything](https://nintendoeverything.com/octopath-traveler-devs-on-character-origins-visual-style-initial-hd-rumble-plans-much-more/)
- It uses a tilt-shift-like depth effect (a secondary source, RPGamer), and point lights cast character shadows onto the environment (Unreal spotlight) — [RPGamer](https://rpgamer.com/2022/01/how-modern-pixel-art-rpgs-shine/); [Unreal Engine spotlight](https://www.unrealengine.com/en-US/spotlights/octopath-traveler-s-hd-2d-art-style-and-story-make-for-a-jrpg-dream-come-true)
- Octopath II: the characters "resemble flat sheets of paper", which limits how far the camera can rotate — [Unreal developer interview, Octopath II](https://www.unrealengine.com/developer-interviews/octopath-traveler-ii-builds-a-bigger-bolder-world-in-its-stunning-hd-2d-style)

**Isometric**
- 2:1 pixel "isometric" is really dimetric: arctan(sin 30°) ≈ 26.565° "forms a 2:1 pixel ratio", with inter-axis angles of ≈116.565°, 116.565° and 126.870°. True isometric uses a camera tilt of ≈35.264° and 30° axis lines, which "would not follow a neat pixel pattern". Final Fantasy Tactics put hand-drawn 2D sprites over a rotatable real-time 3D map — [Wikipedia: Isometric video game graphics](https://en.wikipedia.org/wiki/Isometric_video_game_graphics)

**Sprite stacking (NIUM style)**
- An object is drawn as horizontal slices stacked with a vertical offset of about 1 pixel each, which reads as 3D. Moppin's NIUM popularized it, and it also squashes the slices. Rotation is free: you rotate each slice. Animating across slices is "a big pain", and a model is hard to see while you draw it slice by slice. Voxel editors (Goxel) can export slice sheets — [GameMaker script page](https://azuzota.itch.io/sprite-stacking-with-perspective); [Wee Boats devlog](https://jamespoole.itch.io/wee-boats/devlog/685630/using-sprite-stacking-for-pseudo-3d-in-wee-boats); [Codemagic: Flaming stacks](https://blog.codemagic.io/flaming-stacks/)

### Inferences
- **Constraints an engine can enforce exactly** (each is a simple pass over an indexed buffer, or a rule at paint time):
  1. A palette lock, meaning every pixel is an index. Elsewhere's `Ink` already does this.
  2. A cap on colors per frame (Elsewhere's 8).
  3. Colors per sprite (NES 3 + transparent; GB 3 + transparent; Genesis/SNES 15 + transparent).
  4. Colors per attribute cell (NES 4 per 16x16 background region): check per cell, or choose the subpalette per cell from a histogram.
  5. Sprite size and grid snapping (8x8 or 8x16 cells).
  6. Sprites per scanline. This is a choice about flicker and authenticity, and nobody needs it for looks.
  7. Integer positions, with no rotation or scaling of sprites. This rules out "mixels", pixels of mismatched size.
  8. No anti-aliasing and no alpha: draw with nearest-neighbor only.
  These follow from the hardware facts above.
- **Constraints that need heuristic checks:**
  - Outline policy: dark outline, selective outline (sel-out), or none. Checkable: for each opaque pixel next to transparency, is its index in the outline set?
  - Orphan pixels and "jaggies" (uneven line steps). Checkable: count single pixels whose 8 neighbors are all another color, and check that line runs follow a monotone step pattern (1-1-2-2, never 1-3-1).
  - Pillow shading (light from the center outward, always wrong) and banding (parallel ramps that line up stair-like). These can be detected as concentric rings of index changes.
  - Dither density, as the share of checkerboard 2x2 blocks.
  Pixel-art craft teaching (Saint11, Pixel Logic) describes these rules, but none of those sources were fetched this session, so treat them as general knowledge.
- **Style rule sheet** (general knowledge, not verified this session):
  - **Game Boy:** 4 shades, about 16x16 characters, 160x144.
  - **NES:** 54 usable colors out of 64; 3 colors + transparent per sprite; 16x16 or 16x24 heroes made of 8x8 tiles; 8 sprites per scanline.
  - **SNES:** 256x224; 4bpp tiles (16 colors, 8 palettes); sprites up to 64x64; 128 sprites, with 32 per line.
  - **Genesis:** 320x224; 512-color master palette (9-bit); 4 palettes of 16 (15 + transparent), 61 on screen; shadow and highlight modes. (The specs page returned 404.)
  - **PICO-8:** 128x128, 16 colors, 8x8 sprites.
  - **TIC-80:** 240x136, 16 colors (Sweetie 16 by default), 8x8 sprites.
  - **1-bit:** 2 inks plus ordered or pattern dither. Downwell uses black, white and one accent red, swappable as palettes, at a narrow vertical resolution. Minit is 1-bit at about 128x96-ish.
  - **Hi-bit** (Owlboy, Hyper Light Drifter, Eastward, Sea of Stars): no hardware limit. Defined by internal resolutions from 320x180 to 480x270, large palettes with strong hue shifting, sub-pixel animation, colored light and particle post effects, and sometimes "mixels" accepted for effects.
  - **Minimalist** (Celeste at 320x180, Kingdom): tiny characters (Madeline is about 8x10 to 16x16), few colors per object, strong silhouettes, and carefully placed parallax and lighting.
  - **Painterly pixel** (Blasphemous): large sprites, large ramps, manual anti-aliasing, hand-placed texture clusters. This is the hardest to generate.
  - **Low-poly-pixel hybrid** (t3ssel8r): 3D meshes rendered at low res with an orthographic camera, toon or quantized lighting, an edge-detect outline pass and a snapped camera.
  - **Isometric pixel** (FFT, Habbo, eBoy): a 2:1 line grammar, with flat color and one light direction. eBoy and Habbo use a dark outline.
- **Voxel and sprite stacking** suit procedural content best of the "3D-looking" styles: a voxel model or a stack of 2D slices can come from noise or grammar rules, then be stacked automatically. Stacking also works naturally inside a palette lock, because every slice is an indexed 2D image.

### Gaps
- The text of the original Obra Dinn TIGSource devlog (403) and the exact settings of the shipped game's dither (pattern sizes, threshold remapping) could not be fetched.
- No primary write-up from t3ssel8r was found; the descriptions come from secondary sources (Unity forum, a Fab plugin listing).
- The Genesis technical spec page returned 404. The Genesis figures above (512 colors, 4×16 palettes, 61 on screen) are general knowledge only.
- Primary sources for Downwell's, Minit's, Celeste's, Kingdom's, Blasphemous's and Habbo's specific rules were not fetched.

---

## (b) Resolution and detail tiers: how each changes what is readable, and scaling on phones

### Takeaway
Internal resolution sets the "detail budget". At 128x128 or 160x144 one pixel is a feature (an eye, a hand), and characters at 8 to 16 px are mostly silhouette and color. At 320x180 or 384x216, characters at 16 to 32 px get faces and secondary motion. At 480x270 or 640x360, a pixel stops being individually meaningful, and charm depends on clean clusters, restrained palettes and a deliberate "detail budget". On phones, the 16:9 family (320x180, 384x216, 480x270, 640x360) scales to 1080p and 1440p by integers. Phone aspect ratios (19.5:9 to 20:9, with safe-area insets) mean you either pillarbox, letterbox, or render a variable-width internal canvas.

### Cited Findings
- The fixed hardware tiers above: GB 160x144, NES and SNES 256x224 (SNES also 512x224 and 512x448), PICO-8 128x128 — [Pan Docs](https://gbdev.io/pandocs/Specifications.html); [Wikipedia: SNES specs](https://en.wikipedia.org/wiki/Super_Nintendo_Entertainment_System_technical_specifications); [PICO-8 manual](https://www.lexaloffle.com/dl/docs/pico-8_manual.html)
- Octopath's team found that pixel sprites at HD screen sizes looked "lonely and simple". They answered with more tile variation and color density, not with bigger sprites. A real case of a detail budget being rebalanced at higher resolution — [Nintendo Everything](https://nintendoeverything.com/octopath-traveler-devs-on-character-origins-visual-style-initial-hd-rumble-plans-much-more/)
- On camera smoothing, pixel-perfect snapping makes motion jittery, while bilinear filtering without upscaling the assets blurs them. The commonly suggested middle path keeps blocky pixels while allowing smooth movement — [Unity forum thread](https://discussions.unity.com/t/smooth-looking-pixel-art-in-motion/907566)
- Low-res 3D pixel styles render at low resolution, upscale natively, and snap the camera to the texel grid "to avoid pixel creep and jitter". Rotating the camera re-rasterizes the scene, so pixels "swim" — [Fab plugin listing (third-party, unaffiliated with t3ssel8r)](https://www.fab.com/listings/816f34f2-1a2e-4910-b3dd-009b5da0873b)
- The "sharp bilinear" method is commonly used to keep edges crisp under non-integer scaling and sub-pixel scrolling — [Fab listing](https://www.fab.com/listings/816f34f2-1a2e-4910-b3dd-009b5da0873b)

### Inferences
- **Integer factors for common phone and desktop panels** (arithmetic, so verifiable):
  - 1920x1080: 320x180 ×6, 384x216 ×5, 480x270 ×4, 640x360 ×3.
  - 2560x1440: 320x180 ×8, 640x360 ×4.
  - A phone at 2400x1080 CSS-device pixels (20:9): 320x180 ×6 fills the height (1080), using 1920 of 2400 wide and leaving 480 px of bars. Alternatively widen the internal canvas to 400x180 (×6 = 2400) and fill it exactly.
  - Recommendation: fix the internal *height* (180 for Elsewhere), pick the largest integer scale that fits height and width after safe-area insets, then let the internal *width* grow to fill the remaining space in whole pixels, up to a cap. This is how many phone pixel games handle 16:9 to 21:9 (general practice, not sourced here).
- **Canvas mechanics for crisp scaling in a browser** (general knowledge, not verified this session):
  - Draw at internal resolution onto a small canvas.
  - Size the visible canvas to `scale*internal` *device* pixels, using `devicePixelRatio`, and set CSS width = device px / dpr.
  - Set `image-rendering: pixelated` and `ctx.imageSmoothingEnabled = false`.
  - Non-integer CSS sizes leave columns uneven: some source pixels become N device pixels wide and others N+1.
- **Sub-pixel camera smoothing:**
  1. Render the world at internal resolution, plus a 1-pixel margin.
  2. Snap the camera to whole internal pixels for the world render.
  3. Offset the final upscaled blit by the fractional remainder × scale, in device pixels.
  The world stays on its pixel grid while the scroll moves at device-pixel precision. This is the "upscaled render then offset" trick. The Unity thread and the Fab listing describe it (snapping plus a sub-pixel offset). UI and sprites that must look anchored should be drawn after the offset, or snapped as well.
- **Character size tiers and what they buy** (general pixel-art practice, not sourced here):
  - **8x8:** an icon and a silhouette, with 2–3 colors.
  - **16x16:** a readable face as 1–2 px eyes, and 4-frame walks.
  - **16x32 or 24x32:** separate head, torso and legs, plus held items.
  - **32x32:** expressions, and secondary motion such as hair and cape.
  - **48+:** "portrait" detail, where anti-aliasing and sub-pixel animation become necessary and hand-made quality starts to matter more than rules.
  - For a 320x180 frame, 16–24 px characters leave about 13–20 character-heights of world vertically.
- **Cluster theory and a detail budget:**
  - A "cluster" is a contiguous group of one color. Readable art uses few, deliberately shaped clusters. Noise is clusters of 1–2 px, which is why "no noise" rules ban them.
  - A generator can measure cluster count and size per sprite or per tile, and reject or smooth outputs below a minimum size (for example, no 1-px islands except highlights and eyes).
  - A detail budget can be written as caps: maximum clusters per 16x16 cell, and maximum distinct indexes per object.
  - Elsewhere's "no noise" rule maps directly onto such a check.

### Gaps
- No authoritative published numbers were found for a "detail budget" or cluster thresholds; this is craft knowledge (Pixel Logic and Saint11 were not fetched).
- No primary t3ssel8r or Celeste article on the sub-pixel camera offset was fetched. The technique is described above from secondary sources and general knowledge.
- Phone safe-area statistics (notch and island inset sizes) were not researched.

---

## (c) Palette and color science usable in code

### Takeaway
Build and judge palettes in OKLab or OKLCH, which is perceptually uniform and has better hue linearity than CIELAB. Generate ramps by stepping L evenly, arcing chroma (peak in the middle), and rotating hue (Slynyrd: up to about 20° per swatch, warmer as it gets lighter). Store art as indexes, so palette swaps are free. When mapping arbitrary colors onto a fixed palette, use OKLab distance, and dither with ordered patterns (Bayer, blue noise, or pattern dithering), because error diffusion (Floyd–Steinberg) shimmers when anything moves.

### Cited Findings
**OKLab (Björn Ottosson)**
- Linear sRGB to OKLab, in three steps — [Ottosson: A perceptual color space for image processing](https://bottosson.github.io/posts/oklab/):
  1. Linear sRGB to LMS:
     l = 0.4122214708r + 0.5363325363g + 0.0514459929b;
     m = 0.2119034982r + 0.6806995451g + 0.1073969566b;
     s = 0.0883024619r + 0.2817188376g + 0.6299787005b.
  2. Cube root: l′=∛l, m′=∛m, s′=∛s.
  3. LMS′ to Lab:
     L = 0.2104542553l′ + 0.7936177850m′ − 0.0040720468s′;
     a = 1.9779984951l′ − 2.4285922050m′ + 0.4505937099s′;
     b = 0.0259040371l′ + 0.7827717662m′ − 0.8086757660s′.
  The matrices were updated in January 2021.
- OKLCH: C = √(a²+b²), h = atan2(b,a). The inverse is a = C cos h, b = C sin h — [Ottosson](https://bottosson.github.io/posts/oklab/)
- Oklab's hue RMS error is 0.49 against CIELAB's 0.69, and its lightness RMS is 0.20 against CIELAB's 1.70. "CIELAB, CIELUV and HSV all show hue shifts towards purple" when blending white with blue — [Ottosson](https://bottosson.github.io/posts/oklab/)

**Ramps and palettes**
- Slynyrd's ramp rules, quoted under (a): 9 swatches, up to 20° of hue per step, warmer as brightness rises, saturation peaking mid-ramp, never pairing high saturation with high brightness — [Slynyrd](https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes)
- Endesga 32 (by ENDESGA, made for NYKRA) has 32 colors and about 207k downloads and 2.3k likes on Lospec. Its hexes: #be4a2f #d77643 #ead4aa #e4a672 #b86f50 #733e39 #3e2731 #a22633 #e43b44 #f77622 #feae34 #fee761 #63c74d #3e8948 #265c42 #193c3e #124e89 #0099db #2ce8f5 #ffffff #c0cbdc #8b9bb4 #5a6988 #3a4466 #262b44 #181425 #ff0044 #68386c #b55088 #f6757a #e8b796 #c28569 — [Lospec: Endesga 32](https://lospec.com/palette-list/endesga-32)
- Tools exist that generate palettes from Slynyrd's principles: Chickensoft PalettePainter (CLI), and an Aseprite "Smart Palette" extension — [PalettePainter (GitHub)](https://github.com/chickensoft-games/PalettePainter); [Aseprite Smart Palette](https://community.aseprite.org/t/extension-smart-palette/28320)

**Indexed rendering and palette swaps**
- PICO-8's `pal()` has separate draw-time and display-time remaps. A display remap recolors the whole frame as it is shown, which is the classic indexed palette swap for fades, night, damage flashes and alternate worlds — [PICO-8 manual](https://www.lexaloffle.com/dl/docs/pico-8_manual.html)

**Quantization**
- Median cut (Heckbert, 1980 thesis and 1982 paper) is "the most popular algorithm by far". Octree comes from Gervautz and Purgathofer. K-means was long thought too slow and too sensitive to initialization, but Celebi (2011) showed that "an efficient implementation of k-means outperforms a large number of color quantization methods". NeuQuant is "high-quality but slow". Spatial color quantization (scolorq) chooses the palette and the dither together, and is worthwhile only at ≤16 colors. Euclidean distance in Lab "is more consistent with perceptual difference" than in RGB — [Wikipedia: Color quantization](https://en.wikipedia.org/wiki/Color_quantization)

**Dithering**
- Bayer recursion: M₂ₙ = (1/(2n)²)[[4Mₙ, 4Mₙ+2], [4Mₙ+3, 4Mₙ+1]].
  M₂ = ¼[[0,2],[3,1]].
  M₄ = (1/16)[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]].
  General form: c′ = nearest_palette_color(c + r·(M(x mod n, y mod n) − ½)), with spread r ≈ 255/N for an evenly spaced palette. Closed form: M(i,j) = bit_reverse(bit_interleave(i XOR j, i))/n². Without the −½ normalization, results go wrong "especially when using a small or arbitrary palette" — [Wikipedia: Ordered dithering](https://en.wikipedia.org/wiki/Ordered_dithering)
- Void-and-cluster (blue noise) threshold maps keep the high-frequency character but show much less visible patterning. A 64×64 map takes "a couple of seconds" to generate, so precompute it. A spatiotemporal 3D extension exists for animation — [Wikipedia: Ordered dithering](https://en.wikipedia.org/wiki/Ordered_dithering)
- Floyd–Steinberg (1976) diffuses error as 7/16 to the right, 3/16 below-left, 5/16 below and 1/16 below-right. Serpentine scanning is a common variant — [Wikipedia: Floyd–Steinberg](https://en.wikipedia.org/wiki/Floyd%E2%80%93Steinberg_dithering)
- Stability under motion: a screen-fixed dither flickers as the camera moves. Obra Dinn used sphere mapping (stable while rotating), and surface-stable fractal dithering keeps the pattern stable while translating too — [runevision](https://runevision.com/tech/dither3d)
- PICO-8's `fillp()` is pattern dithering as a fill primitive: a 4x4 two-color pattern from a 16-bit mask — [PICO-8 manual](https://www.lexaloffle.com/dl/docs/pico-8_manual.html)

### Inferences
- **OKLCH ramp generator for code:**
  1. Choose a base hue h₀, a count n, and an L range (for example 0.20 to 0.95).
  2. For i in 0..n−1: t=i/(n−1); L = lerp(Lmin, Lmax, t), or ease so steps shrink near the top as Slynyrd says; C = Cmax·sin(πt)^γ, or a parabola peaking at t≈0.4–0.5 so darks keep chroma; h = h₀ + Δh·(t−0.5), where Δh is about 20°·(n−1) at most, with the sign chosen so highlights move toward yellow (about 90–110° in OKLCH) and shadows away from it.
  3. Convert to sRGB and gamut-clip by reducing C, never by clamping channels.
  This turns Slynyrd's rules into OKLab; the rules are from Slynyrd, the math from Ottosson.
- **Palette mapping:** convert each palette entry to OKLab once. Map each source color to the palette by nearest ΔE_ok (Euclidean in OKLab). For a fixed palette of 8 to 32 entries, brute force is cheap. Precompute a 32×32×32 LUT (15-bit RGB to index) for per-pixel speed.
- **Choosing a quantizer for engine use:** median cut or Wu for speed. Wu's algorithm is not covered by the fetched source, so its quality claims count as general knowledge. Run k-means in OKLab, seeded by median cut, when quality matters. For "N inks per frame" (Elsewhere: 8), use k-means in OKLab over the frame's histogram, constrained to the master palette by snapping centroids.
- **Dithering policy by use case:**
  - Static pictures painted once: any method. Floyd–Steinberg gives the most tonal detail but adds speckle, which breaks the "no noise" rule.
  - Anything that scrolls or animates: ordered dithering in *world* space, with the pattern anchored to world or tile coordinates, so it moves with the land and does not crawl.
  - Sparse two-color pattern dithering (checker, 25%, 50%, 75%) at transitions only. This is the hand-pixel style, and fits a frogs-rule look.
  - Blue noise for gradients such as skies and fog, where Bayer cross-hatching looks mechanical.
  - Elsewhere's 2:1 isometric grid suggests 2x1 or 4x2 dither cells aligned to the iso lattice.
- **Indexed rendering in a plain-JS canvas:**
  - Keep a `Uint8Array` framebuffer of indexes.
  - Each frame, resolve it through a `Uint32Array` palette LUT into `ImageData`, then `putImageData` to a small canvas, then `drawImage` scaled.
  - Palette swaps, fades through palette ramps, flashes and "print the world in another palette" all become LUT edits.
  - Elsewhere's `Ink` keeps pictures as palette indexes and must keep `View.g` drawing to the GPU-stand-in primitives. The equivalent is to resolve offscreen pictures through the LUT when they are painted, and repaint them on a palette change.
- **Color blindness** (general knowledge, not fetched this session):
  - About 8% of men and 0.5% of women have some color-vision deficiency.
  - Red–green confusion (deuteranopia, protanopia) is the most common.
  - Rules for code: (1) carry meaning in *value* (OKLab L) contrast, not only hue; check that important pairs differ by ΔL ≥ about 0.15–0.2. (2) Check palettes through a simulation matrix (Machado 2009 or Brettel/Viénot) and confirm distinct indexes stay distinct. (3) Pair color cues with shape or pattern cues.
  - A 1-bit or Game Boy style passes automatically because it is pure value.

### Gaps
- Lospec pages for PICO-8, Resurrect 64, Apollo and AAP-64 were not fetched. Their color counts (16, 64, 46, 64) and authors (Lexaloffle, Kerrie Lake, AdamCYounis, Adigun Polack) are general knowledge, not verified.
- Wu's algorithm (Xiaolin Wu, 1991, Graphics Gems II) was not in the fetched source, so no quality or speed claims are cited for it.
- Joel Yliluoma's arbitrary-palette positional dithering is referenced but was not fetched; it matters for ordered dithering onto irregular palettes such as Endesga.
- No color-blindness source was fetched.
- Pope's shipped dither parameters are unknown (see (a)).

---

## (d) Camera perspectives and projections: math, depth sorting, assets, cost and procedural fit

### Takeaway
Most phone pixel games need only parallel projections: side view, top-down, 3/4 oblique and 2:1 dimetric. These cost little in canvas (blits plus a sort) and fit procedural tile content best. The pseudo-3D family (Mode 7 floors, raycasting, pseudo-3D roads, voxel space) is cheap *per column or per scanline* and was built for weak hardware, so it runs fine in plain JS at 320x180 using an ImageData framebuffer. Sprite stacking and billboards add depth cheaply. Fez-style rotation needs a 3D world model, rendered orthographically from four sides.

### Cited Findings
- **2:1 dimetric ("pixel isometric"):** the axis angle is arctan(1/2) ≈ 26.565°, chosen because 30° lines "would not follow a neat pixel pattern". True isometric needs a camera tilt of ≈35.264°. Top-down *oblique* projection "fits objects snugly into non-overlapping square tiles, potentially removing the need for an extra Z-order calculation". Parallel projection has depth-confusion problems that level design has to manage — [Wikipedia: Isometric video game graphics](https://en.wikipedia.org/wiki/Isometric_video_game_graphics)
- **Hex grids:** store coordinates as axial, with cube s = −q−r and the constraint q+r+s=0. Distance = max(|q|,|r|,|s|) = (|q|+|r|+|s|)/2. Doubled-coordinate centers: pointy-top x = √3/2·col·size, y = 3/2·row·size; flat-top x = 3/2·col·size, y = √3/2·row·size. Pointy-top neighbors in a row sit √3·size apart. To round a fractional hex, round each of q, r, s and recompute the one with the largest rounding error from the other two — [Red Blob Games: Hexagonal grids](https://www.redblobgames.com/grids/hexagons/)
- **Mode 7:** six parameters per scanline (a, b, c, d, x0, y0): [x′;y′] = [a b; c d]([x;y] − [x0;y0]) + [x0;y0], sampled "without interpolation". The arithmetic is 16-bit signed fixed point with the radix point between bits 7 and 8, and offsets are limited to 13 bits. Games "set a different transformation matrix for each scanline" to get pseudo-perspective — [Wikipedia: Mode 7](https://en.wikipedia.org/wiki/Mode_7)
- **Raycasting (Wolfenstein-style):** position, a direction vector and a perpendicular camera plane. FOV = 2·atan(|plane|/|dir|), so 66° for a plane of 0.66. Per column: cameraX = 2x/w − 1; rayDir = dir + plane·cameraX. A DDA traversal uses deltaDist = |1/rayDir|. Use perpendicular wall distance (sideDist − deltaDist), not Euclidean, which is what prevents fisheye. lineHeight = h/perpWallDist. The cost is one ray per screen *column*, plus a texel loop per pixel when walls are textured — [Lode Vandevenne: Raycasting](https://lodev.org/cgtutor/raycasting.html)
- **Pseudo-3D road (OutRun-style):** project with y_screen = y_world·scaling/z + yres/2, where scaling = (xres/2)/tan(fov/2). Precompute a Z map per scanline, Z = Y_world/(Y_screen − h/2), which also avoids the "oatmeal effect". Curves accumulate per line (ddx += dx; current_x += ddx), and a curve ending at offset s over N lines needs A = 2(s−x)/[N(N+1)]. Stripes alternate as a texture position accumulates. Sprites are drawn back to front at road-x × (1/Z) + center, and 1/Z also gives road width. Hills are faked by skipping or repeating Z-map lines. Road Rash and Test Drive II project segments in true 3D instead — [Lou's Pseudo 3d Page](http://www.extentofthejam.com/pseudo/)
- **Voxel Space (Comanche, 1992):** a 1024×1024 byte height map plus a 1024×1024 color map with lighting baked in, one height per cell (no overhangs). Per depth line z: height_on_screen = (cam_h − heightmap[p])/z·scale_height + horizon. Draw back to front (painter's algorithm), or front to back with a per-column y-buffer that keeps the highest drawn y. LOD comes from dz growing with distance (dz += 0.2 per step). The whole thing is "less than 20 lines of code" — [s-macke/VoxelSpace](https://github.com/s-macke/VoxelSpace)
- **Sprite stacking:** slices drawn bottom to top, offset about 1 px in screen-y each, each slice rotated by the camera angle. Assets are N horizontal slices, often exported from a voxel editor — [itch.io GameMaker script](https://azuzota.itch.io/sprite-stacking-with-perspective); [Wee Boats devlog](https://jamespoole.itch.io/wee-boats/devlog/685630/using-sprite-stacking-for-pseudo-3d-in-wee-boats)
- **Billboards in 3D (HD-2D):** flat pixel sprites in a lit 3D scene with depth-of-field and tilt-shift. The sprites read as "flat sheets of paper", so camera rotation must stay limited — [Unreal: Octopath II interview](https://www.unrealengine.com/developer-interviews/octopath-traveler-ii-builds-a-bigger-bolder-world-in-its-stunning-hd-2d-style); [RPGamer](https://rpgamer.com/2022/01/how-modern-pixel-art-rpgs-shine/)
- **Low-res 3D with a snapped orthographic camera:** the camera snaps to the texel grid to prevent pixel creep, and rotation re-rasterizes the scene — [Fab listing](https://www.fab.com/listings/816f34f2-1a2e-4910-b3dd-009b5da0873b)

### Inferences
Per-perspective sheet. The cited items above give the math; the rest is standard practice, noted as general knowledge.

- **Side view (platformer):**
  - screen = world − camera, so no projection at all. Draw layers in a fixed order, with parallax layers at screen = world·k − camera·k for k<1.
  - Assets: a tileset with autotile edge variants (47-blob or 16-tile marching squares), and side sprites.
  - Cost: the lowest of all. Procedural content fits well: level chunks, Spelunky-style room grammars.
- **Top-down orthographic:** the same math, seen from above. Objects are flat, and depth is by layer only.
- **3/4 top-down (Zelda/Stardew, oblique):**
  - screen = (x, y − z), so wall and front faces show as vertical strips.
  - Depth: sort by the y of the base (feet), then by z. Tall objects are split into a "base" layer (under the actors) and a "top" layer (over them), or sorted per object by base y.
  - Assets: tile tops plus front-face tiles, and 4-direction sprites (3 drawn + 1 mirrored).
  - Cost: a per-frame sort of visible actors, O(n log n) on small n.
  - The best fit for procedural tile maps: the oblique "no Z-order" property cited above.
- **2:1 dimetric isometric (Elsewhere's current choice):**
  - Projection: screenX = (x − y)·(tileW/2), screenY = (x + y)·(tileH/2) − z·heightPx, with tileW = 2·tileH (for example 32x16 or 16x8).
  - Inverse for picking: x = (sx/(tileW/2) + sy/(tileH/2))/2, y = (sy/(tileH/2) − sx/(tileW/2))/2, after removing the camera offset and z.
  - Depth: draw tiles in order of increasing x+y (diagonals), then z. Sort actors by x+y of their footprint *front* corner. Multi-tile objects need splitting, or a topological sort on footprint overlap, because a pure x+y sort fails for long objects.
  - Line grammar: 2:1 steps (2 across, 1 up). Avoid 1:1 lines except for verticals. Lighting is usually a top face, a light left face and a dark right face (3 values per material).
  - Assets: a block or tile top, two side faces per material, 4 or 8 sprite directions (mirror the left and right pairs).
  - Procedural fit: good. A heightmap or voxel field to stacked blocks, painted from a few face templates per material, is exactly what an indexed-palette painter can generate.
  - Hiding the land beyond a frame edge needs overdraw of about 1 tile.
- **Hexagonal:** use Red Blob's axial and cube math above. For pixel art, choose hex sizes whose edges follow clean pixel steps. Common pointy-top pixel hexes approximate √3 with sizes such as 16x14 or 32x28, or use "squashed" hexes on a 2:1 iso-style grid. Depth sort by row for 3/4-view hexes.
- **Oblique cabinet:** screen = (x + z·cos α·k, y − z·sin α·k), with k=½ for cabinet and 1 for cavalier. Fronts are drawn undistorted, which suits pixel art because front faces stay rectangular.
- **Mode 7 floor in JS:**
  - For each scanline y below the horizon: dist = camH·focal/(y − horizon). The world-space step per pixel = dist/focal along the camera's right vector. Start at camPos + forward·dist − right·(w/2)·step.
  - Inner loop: u += du, v += dv, then index = map[(v&mask)*W + (u&mask)].
  - Cost: one texture fetch per floor pixel. At 320x90 that is about 29k fetches per frame, trivial in JS.
  - Assets: one tilemap or texture, plus billboard sprites scaled by focal/dist.
  - Procedural fit: excellent, because any generated 2D map becomes a floor.
- **Raycasting:** cost is about w rays × DDA steps, plus a texel fill per column. Sprites go through a z-buffer of perpWallDist per column, sorted far to near. Procedural fit: excellent for grid mazes and dungeons. Floors and ceilings go through the Mode 7 scanline method.
- **Pseudo-3D road:** cost is about a few operations per scanline plus sprite blits. Assets: road stripe colors, roadside sprites at a few prebuilt scales or scaled by drawImage, and a parallax backdrop. Procedural fit: a track is a list of segments (length, curve, hill), so it is easy to generate and seed.
- **Voxel Space:** cost per column per depth step. At 320 columns × about 200 steps that is about 64k samples, fine in JS. Assets: a heightmap and a color map, both easy to generate procedurally (noise, erosion, palette by slope and height). It suits landscapes and flyovers. Draw into an index buffer to keep the palette lock.
- **Sprite stacking:** cost is slices × objects drawImage calls. 16 slices × 50 objects = 800 calls, fine. Rotate by pre-rotating slices into an angle cache (8 to 32 angles) so no per-frame canvas rotation is needed, which keeps to Elsewhere's GPU-stand-in rule (transforms are allowed, but caches avoid filtering). Procedural fit: voxel models made by grammar become slices directly.
- **Billboards in 3D:** needs WebGL, or Tycho's GPU path, plus depth sorting or a depth buffer. Sprites should face the camera, and the camera should be constrained (yaw ±30° or so) to avoid the "paper" problem cited above.
- **Fez-style rotating fixed views:**
  - Keep a 3D voxel or tile world, and render it as one of four orthographic side projections (drop one axis).
  - Gameplay collapses depth: whatever is visible along a column is treated as adjacent.
  - The art is a tile per face orientation, and the cost is four projections, cacheable per rotation.
  - Fez itself is primary-source territory and was not fetched.
- **Parallax:** layer offset = camera·k (0<k<1). For pixel crispness, round each layer's offset to whole internal pixels *separately*, or use the sub-pixel blit offset from (b) per layer.

### Gaps
- No primary Fez technical source was fetched.
- No primary source was fetched for isometric depth-sorting algorithms (topological sort for multi-tile objects); the method above is general knowledge.
- Specific per-frame cost measurements of canvas 2D against WebGL on phones were not researched.
- Mode 7 tilemap specifics (128×128 tiles of 8×8 at 8bpp, so 1024×1024) were not in the fetched article and remain general knowledge.

---

## (e) How style choices interact with procedural generation

### Takeaway
Generation forgives more as resolution falls and as palettes tighten. At 8 to 16 px and 4 to 16 colors, the eye fills gaps, and random variation reads as character, not error. Strict palettes and fixed ramps hide noise because every output snaps to a designed color. Flat color with an outline style tolerates generated shapes far better than painterly or hi-bit styles, whose appeal depends on hand-placed clusters and anti-aliasing. Hardware-style constraints double as validators: a generated asset that breaks the palette, the colors-per-tile cap or the cluster rules can be rejected or repaired automatically.

### Cited Findings
- Tight, structured palettes give harmony across everything drawn from them: a large hue shift "creates harmony between ramps" — [Slynyrd](https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes)
- Raising resolution without raising detail looks empty. Octopath had to add tile-variation density and color, not just sprites — [Nintendo Everything](https://nintendoeverything.com/octopath-traveler-devs-on-character-origins-visual-style-initial-hd-rumble-plans-much-more/)
- The pseudo-3D families take generated 2D data directly as input: a voxel-space color map and height map, Mode 7 tilemaps, raycaster grid maps, road segment lists — [s-macke/VoxelSpace](https://github.com/s-macke/VoxelSpace); [lodev](https://lodev.org/cgtutor/raycasting.html); [Lou's Pseudo 3d](http://www.extentofthejam.com/pseudo/); [Wikipedia: Mode 7](https://en.wikipedia.org/wiki/Mode_7)
- Pattern fills such as PICO-8's `fillp` and ordered dither matrices are deterministic functions of (x, y), which suits seeded, reproducible rendering — [PICO-8 manual](https://www.lexaloffle.com/dl/docs/pico-8_manual.html); [Wikipedia: Ordered dithering](https://en.wikipedia.org/wiki/Ordered_dithering)

### Inferences
- **A generation pipeline that matches Elsewhere's rules** (deterministic, indexed, frogs' rule):
  1. Generate *shape* masks (noise, a grammar, mirrored halves for creatures and characters).
  2. Clean the masks: drop 1-px islands, fill 1-px holes, apply minimum cluster size.
  3. Shade by a fixed light direction into 2–3 ramp steps.
  4. Add a dark outline (full, or selective by light side).
  5. Map to palette indexes.
  6. Validate: index count, orphan pixels, colors per cell.
  Every step is a check over an indexed buffer, so it is deterministic under `ctx.rng`.
- Ordered dithering anchored to world coordinates is the only dithering both deterministic and stable under scrolling. Error diffusion depends on scan order and on the content, so it changes when a single pixel changes. Avoid it for anything animated.
- Repainting a world in another palette (Elsewhere's "printed again in another palette") works only if each palette keeps the same *value structure* per index, meaning the same OKLab L order. Check new palettes by sorting their entries by L and comparing them to the ramp roles.
- Recommended style for procedural content at 320x180: 16–24 px characters, 2:1 iso tiles of 32x16, 8 inks per frame drawn from a 32-ish master palette (Endesga 32-like), dark outlines, 3 values per material, sparse pattern dither only at material transitions, and no anti-aliasing. That combines the most forgiving style choices above with Elsewhere's existing rules.
- Styles to avoid generating procedurally: painterly (Blasphemous), large hi-bit portraits, and HD-2D, which needs WebGL and lighting. They depend on manual anti-aliasing and hand-placed clusters, which rule-based generators reproduce poorly. This is an inference from the cluster and outline arguments above.

### Gaps
- No published study or postmortem was found that measures how resolution or palette size affects the perceived quality of procedural sprites. The claims above are craft consensus and inference.
- Notable procedural-pixel generators (Dave Bollinger's pixel spaceships, the Sprator/Pixel Sprite Generator family, Wave Function Collapse tilesets) were not fetched here; adjacent research tracks may cover them.
