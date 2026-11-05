# Palette and resolution

The palette, the resolution and the projection set the budget a generator must fit. This page covers the first two: which style rules an engine can enforce and which it can only check by heuristics, how to build color ramps and dither that stay honest, and what a pixel can mean at each size. Classic styles are written-down hardware limits, so an indexed engine can enforce them exactly; modern styles are habits. OKLab ramps and ordered dither anchored to world coordinates keep color steady under reprints and motion, and phones push toward integer scaling with an internal canvas widened in whole pixels. Projections are on [Perspectives](views.md).

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md).

Text marked *(inference)* is reasoning from the sources, not a sourced fact.

- [Hardware styles are rules; modern styles are habits](#hardware-styles-are-rules-modern-styles-are-habits)
- [Ramps in OKLab](#ramps-in-oklab)
- [Dither anchored to the world](#dither-anchored-to-the-world)
- [Resolution sets the detail budget](#resolution-sets-the-detail-budget)
- [Phones force integer scaling](#phones-force-integer-scaling)
- [Palettes everyone can read](#palettes-everyone-can-read)
- [Sources](#sources)

## Hardware styles are rules; modern styles are habits

Classic styles are written-down hardware limits, which makes them checkable.

| Style | Resolution | Color rules |
|---|---|---|
| NES | | 4 background and 4 sprite palettes of 4 colors each, entry 0 shared or transparent; one subpalette per 16×16 background area ([NESdev palettes](https://www.nesdev.org/wiki/PPU_palettes); [NESdev attributes](https://www.nesdev.org/wiki/PPU_attribute_tables)) |
| Game Boy | 160×144 | 4 shades; at most 10 sprites per line ([Pan Docs](https://gbdev.io/pandocs/Specifications.html)) |
| PICO-8 | 128×128 | A fixed 16-color palette; `pal()` remaps colors at draw time or at display time, and `fillp()` makes a 4×4 two-color dither pattern a drawing primitive ([PICO-8 manual](https://www.lexaloffle.com/dl/docs/pico-8_manual.html)) |

Modern styles (hi-bit, minimalist, painterly, HD-2D) are habits instead. An engine can enforce some rules exactly and check others only by heuristics *(inference)*:

| Enforced exactly | Checked by heuristics |
|---|---|
| A palette lock | Outline policy |
| A cap on colors per frame, sprite or cell | Orphan pixels |
| Integer positions | Uneven line steps |
| No anti-aliasing | Pillow shading |
| | Dither density |

<figure class="demo"><div class="stage" data-demo="styles"></div>
<figcaption><b>One scene, five rule sets.</b> The same scene description drawn through a palette lock, an outline policy and a dither policy for each style. A style becomes data an engine can enforce.</figcaption></figure>

Elsewhere's house style, the frogs' rule, translates almost entirely into checks over an indexed buffer: at most eight distinct indexes, every opaque edge pixel in the outline set, no clusters of one or two pixels except named marks, and dither only in "fat rows of dots" *(inference)*.

Generation also forgives more as palettes tighten and resolution falls, because every output snaps to a designed color. Painterly and large hi-bit work depend on hand-placed clusters and manual anti-aliasing, and local rules alone reproduce those poorly. That is a limit of rules, not of code: reaching those styles takes encoding more of their pipeline, such as a render step, anchor art or a stronger generator, as [Reaching a style](style.md) argues *(inference)*.

## Ramps in OKLab

Björn Ottosson's OKLab gives the matrices and cube roots to move from linear sRGB to a perceptual space ([Ottosson](https://bottosson.github.io/posts/oklab/)):

| Error | OKLab | CIELAB |
|---|---|---|
| Hue (RMS) | **0.49** | 0.69 |
| Lightness | **0.20** | 1.70 |

CIELAB, CIELUV and HSV all drift toward purple when blending white and blue.

A ramp generator in OKLCH *(inference, combining Slynyrd's rules with Ottosson's math)*:

- steps lightness evenly, or with smaller steps near the top, as Slynyrd suggests;
- arcs chroma to peak mid-ramp;
- rotates hue up to about 20° per swatch, toward yellow in the lights;
- clips to gamut by reducing chroma rather than clamping channels.

<figure class="demo"><div class="stage" data-demo="ramps"></div>
<figcaption><b>Ramps in OKLCH.</b> Even lightness steps, chroma that peaks mid-ramp, hue that leans cool in the shadows and warm in the lights, clipped by reducing chroma. Compare with a lightness-only ramp. OKLab's hue error is 0.49 against CIELAB's 0.69 (Ottosson).</figcaption></figure>

For mapping colors onto a fixed palette, Euclidean distance in a Lab space tracks perception better than RGB ([Wikipedia: Color quantization](https://en.wikipedia.org/wiki/Color_quantization)). A game that prints one sheet in several palettes, as Elsewhere does, needs a check: each palette must keep the same lightness order for each index role, or a reprint will flip which ink reads as shadow *(inference)*.

## Dither anchored to the world

Dithering has a firm rule for anything that moves.

| Method | Depends on | For motion |
|---|---|---|
| Ordered (Bayer) | (x, y) only: a pure function of position. The 4×4 is `[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]]/16`, and the formula needs its −½ offset to behave on small palettes ([Wikipedia: Ordered dithering](https://en.wikipedia.org/wiki/Ordered_dithering)) | Stable, once anchored |
| Floyd–Steinberg diffusion | Scan order and content, so one changed pixel changes the pattern ([Wikipedia: Floyd–Steinberg](https://en.wikipedia.org/wiki/Floyd%E2%80%93Steinberg_dithering)) | Crawls |

Lucas Pope found that screen-fixed dither flickers when the camera moves in Return of the Obra Dinn. Rune Skovbo Johansen's surface-stable dithering pins dots to surfaces ([runevision](https://runevision.com/tech/dither3d)). For a 2D game, the answer is ordered dither anchored to world coordinates, so the pattern moves with the land, in cells sized to the style.

<figure class="demo"><div class="stage" data-demo="dither"></div>
<figcaption><b>Dithering at 2, 4 and 8 colors.</b> Ordered Bayer and blue-noise thresholds are pure functions of position; Floyd–Steinberg depends on scan order, so one changed pixel changes the pattern. For anything that moves, anchor an ordered dither to world coordinates, in cells sized to the style. Elsewhere's lighthouse already dithers in 2-pixel cells.</figcaption></figure>

The games show the same local habit:

- **Elsewhere's lighthouse** dithers in 2-pixel cells, `(x>>1)&3` (its `quests/lighthouse/lighthouse.js`), and Elsewhere's 2:1 grid suggests 2×1 or 4×2 cells *(inference)*.
- **Merryfolk's ground** uses a Bayer 4×4 after quantizing to steps of 14 per channel ([Merryfolk world.js](https://github.com/doctorallen/merryfolk/blob/main/js/world.js)).
- **Lodestar's light bands** dither too ([Lodestar render.js](https://github.com/doctorallen/lodestar/blob/main/js/render.js)).

## Resolution sets the detail budget

Internal resolution sets what one pixel can mean. Octopath Traveler's team found that pixel sprites on big screens looked **"lonely and simple"**, and answered with more tile variation and color, not bigger sprites ([Nintendo Everything](https://nintendoeverything.com/octopath-traveler-devs-on-character-origins-visual-style-initial-hd-rumble-plans-much-more/)).

The size tiers below come from general practice, not from a fetched source *(general knowledge)*:

| Character size | What it can show |
|---|---|
| 8×8 | An icon |
| 16×16 | Eyes of one or two pixels; walks of four frames |
| 16×32 | Head, torso and legs separate; items can be held |
| 32×32 | Expressions and secondary motion |
| 48 and up | Hand-made quality matters more than rules |

Elsewhere's 320×180 with 16 to 24 pixel characters sits where kits and finishers work well.

<figure class="demo"><div class="stage" data-demo="resolution-tiers"></div>
<figcaption><b>Three detail tiers.</b> One seeded scene description repainted at 80×45, 160×90 and 320×180, shown at one size. Each tier repaints rather than shrinks: no outlines and two shades at the bottom, outlines and roof rows in the middle, planks, panes and the full paper doll at the top. In general practice, an 8-pixel figure is an icon, a 16-pixel one has one-pixel eyes, and from 32 pixels up head, torso and legs separate and items can be held. Generators forgive more as palettes tighten and resolution falls.</figcaption></figure>

Two of the games already decouple art pixels from world pixels. Lodestar draws 1.5 art pixels per world pixel (a 16-pixel tile is 24 art pixels) and doubles that in its FINE GRAIN mode, and Merryfolk paints villagers at their own resolution (`FOLK_RES = 4`), apart from its 2×2 world pixel ([Lodestar art.js](https://github.com/doctorallen/lodestar/blob/main/js/art.js); [Merryfolk util.js](https://github.com/doctorallen/merryfolk/blob/main/js/util.js)). Shared generators should therefore take a pixel density or target size as a parameter, so one recipe can draw a 16-pixel or a 24-pixel version without mixing pixel sizes in one frame *(inference)*.

## Phones force integer scaling

320×180 scales ×6 to 1080 rows. On a 20:9 screen, one choice is to fix the internal height and widen the internal canvas in whole pixels (for example 400×180) rather than letterbox *(inference, arithmetic)*. Smooth camera motion without broken pixels comes from snapping the world to whole internal pixels and offsetting the final upscaled blit by the leftover fraction ([Unity forum](https://discussions.unity.com/t/smooth-looking-pixel-art-in-motion/907566); [Fab listing](https://www.fab.com/listings/816f34f2-1a2e-4910-b3dd-009b5da0873b)).

## Palettes everyone can read

About 8% of men and 0.4% of women have a color vision deficiency ([DaltonLens](https://daltonlens.org/opensource-cvd-simulation/)). Nearly all of them see red and green differently:

| Type | Men | Women |
|---|---|---|
| Protanopia | 1.3% | 0.02% |
| Deuteranopia | 1.2% | 0.01% |
| Tritanopia | 0.008% | 0.008% |
| Protanomaly | 1.3% | 0.02% |
| Deuteranomaly | 5.0% | 0.35% |

That table is from [Wikipedia](https://en.wikipedia.org/wiki/Color_blindness). For a protanope "the brightness of red is much reduced", so a red scarf can read as near black.

An eight-ink palette is small enough to check completely: 28 pairs, each simulated three ways.

| Deficiency | Method | Why |
|---|---|---|
| Protanopia, deuteranopia | Viénot 1999, Brettel 1997 or Machado 2009 | All "solid choices", "with a slight advantage for Viénot" |
| Tritanopia | Brettel 1997 | "The most solid and basically only valid choice"; Machado's authors chose not to model it |
| Partial (anomalous) | Machado 2009, by severity | It models a shifted cone; others only blend toward the full simulation |

The methods' ranking is DaltonLens's ([review](https://daltonlens.org/opensource-cvd-simulation/)). DaltonLens also warns that the widely copied Coblis V1 matrices "should never be used", and that many copies skip sRGB decoding and come out too dark.

Brettel 1997 in practice is small. libDaltonLens precomputes it in linear RGB as two 3×3 matrices per deficiency and a plane normal that picks between them: `M = dot(rgb, n) >= 0 ? M1 : M2`. That's nine multiplies a color, public domain ([libDaltonLens](https://github.com/DaltonLens/libDaltonLens/blob/master/libDaltonLens.c)). The papers are Brettel, Viénot & Mollon 1997 ([JOSA A](https://doi.org/10.1364/JOSAA.14.002647)), Viénot, Brettel & Mollon 1999 ([Color Research & Application](https://doi.org/10.1002/(SICI)1520-6378(199908)24:4%3C243::AID-COL5%3E3.0.CO;2-3)), and Machado, Oliveira & Fernandes 2009 ([project page](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html)).

The demo measures every pair in OKLab, under each simulation, and flags pairs that come closer than a threshold.

<figure class="demo"><div class="stage" data-demo="colorblind"></div>
<figcaption><b>Eight inks under color vision deficiency.</b> A small scene in a palette's eight inks (roles by lightness: outline, roof, hills, trees, ground, walls, sky, sun), simulated for protanopia, deuteranopia and tritanopia with Brettel 1997 (libDaltonLens's matrices) and shown as lightness alone. The matrix puts every ink on every other, as ground and mark, under the worst of the three deficiencies or one chosen, and frames pairs whose OKLab distance falls under the threshold in black and white, so the flag reads under any deficiency. <i>Auto-fix lightness</i> pushes each flagged pair apart in OKLab lightness, keeping hue, until none is left. The palettes are four of Elsewhere's quests, Okabe and Ito's, and seeded random ones.</figcaption></figure>

CSS Color 4 takes "one JND [just noticeable difference] is an OkLCh difference of 0.02" ([CSS Color 4](https://www.w3.org/TR/css-color-4/)). Inks that must read as different objects in small clusters of pixels need several, so the demo flags pairs under 0.08 by default *(inference: a working threshold, not a source's)*.

Small marks make it worse for everyone. For small fields, about 20 arcminutes and under, normal observers lose blue-yellow discrimination: small-field tritanopia (Willmer & Wright 1945, [Nature](https://www.nature.com/articles/156119a0.pdf)). One art pixel at 320×180 on a phone held at 30 cm is about 4 arcminutes, so a 1-pixel glint of yellow on white, or of blue on grey, can vanish even for perfect color vision *(arithmetic, inference)*.

Elsewhere's own palettes, measured by the demo at 0.08 *(arithmetic)*:

| Palette | Flagged pairs | Worst pair (and where) |
|---|---|---|
| The frogs' day | 4 | Red `#d8483a` and tan `#b87a3c`: 0.026 under deuteranopia; green `#8cc84c` and orange `#f08a30`: 0.038 |
| Mrs. Pell's sun | 2 | Brick `#b0442c` and ivy green `#3f7a52`: 0.060 under deuteranopia, and 0.003 apart in lightness |
| The Road at dusk | 3 | Scarf pink `#a83c6a` and grass `#3d7a52`: 0.029 under deuteranopia, 0.007 apart in lightness |
| The lighthouse lit | 1 | Rust `#b0602c` and flame `#e0642c`: 0.047 under protanopia |
| Okabe–Ito | 1 | Bluish green `#009e73` and reddish purple `#cc79a7`: 0.077 under deuteranopia |

<div class="finding"><p>In two of Elsewhere's four palettes, the ink the traveler's scarf is printed in sits at the same lightness as the green of the ground (OKLab L within 0.01), so to a deuteranope the red scarf on grass is one color. Lightness is the cue that survives every deficiency: inks that must stand apart, such as figure and ground, should differ in OKLab L by about 0.1 or more, whatever their hues.</p></div>

The fix that keeps a palette's character pushes lightness, not hue. Lightness survives every deficiency and greyscale, so separating two inks in OKLab L separates them in every simulated view at once. The demo's auto-fix:

1. Find every pair under the threshold in any of the three simulations.
2. Move the darker ink of each down and the lighter up, 0.006 at a time, keeping hue and lowering chroma only to stay in gamut.
3. Repeat until no pair is flagged.

On the frogs' day palette it clears all four flags in a few milliseconds, but moves every ink, one by 0.17. A crude fix like that is a suggestion for a person to judge, not a gate *(inference)*. Not every pair matters either: two greens in one ramp may touch by design. What matters is the short list of pairs a quest relies on: figure on ground, a person's coat on grass, a pickup on the floor.

Okabe and Ito's Color Universal Design palette shows what a palette built for this looks like: black, orange `#E69F00`, sky blue `#56B4E9`, bluish green `#009E73`, yellow `#F0E442`, blue `#0072B2`, vermillion `#D55E00` and reddish purple `#CC79A7`. Its hues are spread so that lightness and the blue-yellow axis carry the differences red-green can't ([jfly](https://jfly.uni-koeln.de/color/); [R `see` documentation](https://rdrr.io/cran/see/man/scale_color_okabeito.html)). It still has one pair under 0.08 here, which says more about the threshold than about the palette *(inference)*.

What games do:

- **The Last of Us Part II** has over 60 accessibility settings, among them a High Contrast Display that mutes the world and colors allies, enemies, items and interactables. Its colorblind modes change only the HUD's accents ([PlayStation Blog](https://blog.playstation.com/2020/06/09/the-last-of-us-part-ii-accessibility-features-detailed)).
- **Fortnite** has protanope, deuteranope and tritanope modes with a strength slider ([Dot Esports](https://dotesports.com/fortnite/guides/the-best-colorblind-settings-for-fortnite)).
- **The IGDA's accessibility group** argues against whole-screen filters. Filters "bunch hues up closer together" and repaint things that didn't need it (all greens to blue, so grass stops looking like grass). It recommends shape and symbol first, then hand-chosen colors for the few elements that must stand apart, as Destiny does ([IGDA GASIG](https://igda-gasig.org/how/platform-level-accessibility-recommendations/do-not-implement-colorblind-filters/)).
- **Celeste's Assist Mode** changes rules, not colors: speed down to 50%, infinite stamina, invincibility ([Vice](https://www.vice.com/en/article/celeste-assist-mode-change-and-accessibility)). It is the model for options that never judge the player.

For a game that prints each world in its own eight inks, the IGDA's advice maps onto the palette directly *(inference)*:

- check each palette's important pairs when it's made;
- keep figure and ground apart in lightness;
- carry state with a shape, outline or mark as well as color;
- if a world still fails, offer an alternate print of the same sheet, the way the frog stall already has a dusk palette.

Tycho could carry the check as a palette lint: simulate, measure the 28 pairs, list the collisions and the text pair's WCAG contrast. It's milliseconds of plain JS, run at build time or in the dev panel, never per frame. The research is in [the notes on text, interface and legibility](notes/text_interface_legibility.md); the interface side is on [Text and interface](text.md).

## Sources

- [NESdev, PPU palettes](https://www.nesdev.org/wiki/PPU_palettes) and [PPU attribute tables](https://www.nesdev.org/wiki/PPU_attribute_tables)
- [Pan Docs, Game Boy specifications](https://gbdev.io/pandocs/Specifications.html)
- [PICO-8 manual](https://www.lexaloffle.com/dl/docs/pico-8_manual.html)
- [Björn Ottosson, OKLab](https://bottosson.github.io/posts/oklab/)
- [Wikipedia, color quantization](https://en.wikipedia.org/wiki/Color_quantization)
- [Wikipedia, ordered dithering](https://en.wikipedia.org/wiki/Ordered_dithering) and [Floyd–Steinberg dithering](https://en.wikipedia.org/wiki/Floyd%E2%80%93Steinberg_dithering)
- [Rune Skovbo Johansen, surface-stable dithering](https://runevision.com/tech/dither3d)
- [Nintendo Everything, Octopath Traveler's developers on its visual style](https://nintendoeverything.com/octopath-traveler-devs-on-character-origins-visual-style-initial-hd-rumble-plans-much-more/)
- [Unity forum, smooth-looking pixel art in motion](https://discussions.unity.com/t/smooth-looking-pixel-art-in-motion/907566) and [a Fab listing](https://www.fab.com/listings/816f34f2-1a2e-4910-b3dd-009b5da0873b)
- The games: [Merryfolk world.js](https://github.com/doctorallen/merryfolk/blob/main/js/world.js) and [util.js](https://github.com/doctorallen/merryfolk/blob/main/js/util.js), [Lodestar render.js](https://github.com/doctorallen/lodestar/blob/main/js/render.js) and [art.js](https://github.com/doctorallen/lodestar/blob/main/js/art.js)

The full research is in [the notes on styles, resolution and perspective](notes/styles_resolution_perspective.md).

<script src="demos/kit.js"></script>
<script src="demos/looks-shared.js"></script>
<script src="demos/styles.js"></script>
<script src="demos/ramps.js"></script>
<script src="demos/dither.js"></script>
<script src="demos/sprites-shared.js"></script>
<script src="demos/resolution-tiers.js"></script>
<script src="demos/text-shared.js"></script>
<script src="demos/colorblind.js"></script>
<script src="demos/start.js"></script>
