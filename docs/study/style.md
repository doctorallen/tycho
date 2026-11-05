# Reaching a style

How a generator gets close to a named look, with Diablo II and Witchbrook as the two targets. A 320×180 frame in eight inks has 8^57,600 possible states, and code can put any of them on screen, so steering generation toward a style is a problem of specifying and checking which tiny corner of that space the target occupies *(inference)*. Both targets turn out to be pipelines, documented well enough to copy: Diablo II rendered 3D models and recolored them by lookup tables, and Witchbrook hand-draws flat sprites inside a recoloring system. This page covers the two pipelines, a measured Diablo II sprite sheet that turns its look into numbers, five ways to supply a style's specification, the metrics that make a style checkable, the style pack that holds them, what stays hard, and the legal line.

**Proposed: none of this is in Tycho yet.** The demo runs here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; it says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md): `check.style` in wave 1 and `style` in wave 2.

- [The finding](#the-finding)
- [Diablo II: renders and lookup tables](#diablo-ii-renders-and-lookup-tables)
- [A measured Diablo II sheet](#a-measured-diablo-ii-sheet)
- [Witchbrook: hand-drawn sprites, recolored](#witchbrook-hand-drawn-sprites-recolored)
- [Five levers](#five-levers)
- [Measuring a style](#measuring-a-style)
- [The style pack](#the-style-pack)
- [What stays hard](#what-stays-hard)
- [My view: the work is in the spec](#my-view-the-work-is-in-the-spec)
- [Copyright](#copyright)
- [Sources](#sources)

## The finding

<div class="finding"><p>Earlier in this research the assistant said some pixel styles can't be generated procedurally "because they need real design". That was wrong as stated. Code can put any pixel anywhere, so every style is reachable in principle. What limits it is <b>the specification</b>, how much of the style's knowledge has been written down as rules, parts and numbers, and <b>the check</b>, whether output can be measured against the target. To get closer to a style, encode its <b>pipeline</b>, not just its look.</p></div>

Both targets converge on "draw once, recolor by table", which is what an indexed picture does. Every step of Diablo II maps onto an indexed sheet, and Witchbrook's runtime recoloring maps onto indexes lit through a quantized table per time of day *(inference)*.

## Diablo II: renders and lookup tables

Erich Schaefer's postmortem states that "almost all of Diablo II's in-game and cinematic art was constructed and rendered in 3D Studio Max" ([Schaefer, Game Developer 2000](https://www.gamedeveloper.com/design/postmortem-blizzard-s-i-diablo-ii-i-)). Each step of the pipeline is a program: a model, a light, a renderer, a palette, a set of lookup tables and a layering rule.

| Step | What Diablo II did | Source |
|---|---|---|
| Models | Almost all art built and rendered in 3D Studio Max | [Schaefer](https://www.gamedeveloper.com/design/postmortem-blizzard-s-i-diablo-ii-i-) |
| Directions | An in-house tool rendered each model "from many different angles (eight for all monsters, 16 for player characters)" | [Schaefer](https://www.gamedeveloper.com/design/postmortem-blizzard-s-i-diablo-ii-i-) |
| Size | Player characters 75 px tall, in 2D sprites at 640×480 and 8-bit color | [Schaefer](https://www.gamedeveloper.com/design/postmortem-blizzard-s-i-diablo-ii-i-) |
| Armor | Light, medium and heavy pieces tested as "paper dolls", rendered separately as head, torso, legs, arms, weapon and shield | [Schaefer](https://www.gamedeveloper.com/design/postmortem-blizzard-s-i-diablo-ii-i-) |
| Backgrounds | Rendered rooms "cut into tiles and assembled into modular 'rooms'" the engine shuffled into levels; lighting baked from one direction so shadows matched across tiles; pre-arranged "set pieces" placed whole | [Schaefer](https://www.gamedeveloper.com/design/postmortem-blizzard-s-i-diablo-ii-i-); [Shacknews](https://www.shacknews.com/article/105720/how-diablo-2-evolved-from-gothic-horror-to-epic-fantasy) |
| Palette | One 256-color palette per act, shipped with precomputed 256-byte remaps: 32 dark-to-mid and 16 mid-to-bright light levels (48 in all), alpha tables at 25%, 50% and 75%, additive and multiply tables, and 111 color variations | [OpenDiablo2/pl2](https://github.com/OpenDiablo2/pl2) |
| Variants | Colormaps "decline" one animation into several monster color sets, applied per layer: the same sprite with its indexes remapped | [Phrozen Keep](https://d2mods.info/forum/viewtopic.php?f=6&t=4369) |
| Format | The DCC format limits each 4×4 cell to four colors; floor tiles are 160×80 diamonds, the same 2:1 ratio as Elsewhere's grid | [pd2-sprite-studio](https://github.com/RoofooEvazan/pd2-sprite-studio) |

Among the postmortem's failures: the tools could not preview monsters in the engine, and some art was redone a year later.

The "gothic" reputation needs care. Its own makers said Diablo II "doesn't feel as dark and gothic" as the first game "because it's set outdoors" ([Shacknews](https://www.shacknews.com/article/105720/how-diablo-2-evolved-from-gothic-horror-to-epic-fantasy)), and the research found no source for a "desaturated, grainy" Diablo II look. Render settings were never published, but the visible traits (soft internal shading, few hard outlines) are what a lit render quantized to a shared palette produces. So a Diablo II-like generator should render and quantize, with no outline pass, rather than draw with cluster rules *(inference)*. Every step maps onto an indexed sheet: a palette per world, a light table from index and level to index, blend tables, colormaps as remaps, part layers in per-direction order, and walls split into faces that can fade near the hero *(inference)*. Code can rebuild the system and invent its own models and palette; it can't fake a style it has never measured.

## A measured Diablo II sheet

To test those readings, a fan-ripped sheet of one Diablo II (Lord of Destruction) player character was measured: 2,103 frames in a 2605×6736 GIF from The Spriters Resource, supplied for study only. It was measured for numbers; nothing from it is copied into any demo or shipped asset, and the sheet itself is not in this repository.

| Count | Measured |
|---|---|
| Directions | 16 rows per animation, one per direction, as the postmortem says |
| Frames per direction | Walk and run 8, town idle 16, attacks about 20. One character with one weapon class and one armor set is about 2,100 frames, a volume only an offline render makes practical |
| Size | Median frame 37×67 px; heights 61 to 80 (percentiles 10/50/90: 61/67/80, the top including raised weapons and lunges). A standing body reads about 65 to 70 px with hair, about 33 to 35 px at 320×180 |
| Colors | 220 on the whole sheet, from one shared palette; 47 to 65 per frame, median 56; each hue's ramp runs into near-black |
| Value | Luma percentiles 10/25/50/75/90/99 are 5/8/32/61/86/184. A quarter of all pixels are in deep shadow (luma 8 or below); the only bright pixels (above 150, 1 to 2%) are small warm highlights on gold trim and skin |
| Outline | None, and no dark rim: 56% of silhouette-edge pixels are near-black against 55% inside, so the edge is exactly as dark as the body |
| Edges | Hard 1-bit alpha against the background |
| Surfaces | Mottled render texture, no flat fills |
| Color plan | One saturated costume hue (teal) over black cloth, warm skin and leather, gold trim, a cool steel accent |

Those numbers are the spec a Diablo II-like style pack would carry and that `check.style` would test: colors per sprite, luma percentiles, near-black share, edge-to-interior darkness ratio and highlight share. The demo's Gothic finish below was retuned against them and shows the gap that's left. They also confirm that this look is the opposite of Elsewhere's frogs' rule (eight inks, outlines, flat color). A Diablo II-like quest would be a deliberate change of look, built by a pre-render step, not by Elsewhere's house painter *(inference)*. The full measurements are in [the sheet study](notes/d2_sprite_sheet_study.md).

## Witchbrook: hand-drawn sprites, recolored

Witchbrook dropped its top-down look for an isometric view in April 2020 ([Game Informer](https://gameinformer.com/news/2020/04/02/chucklefish-reveals-new-look-for-witchbrook)). Its developers write that "everything in this game is 2D, including our characters" ([Witchbrook dev blog: Express Yourself!](https://www.witchbrook.com/dev-blog-express-yourself/)):

| Part | What Witchbrook does |
|---|---|
| Directions | "Animate 5 rotations and then the engine flips the remaining 3 angles to make 8" |
| Walks | 6 frames per direction |
| Drawing | More than 1,300 frames, all "drawn by hand" |
| Clothing | 11 layers worn at once, each a greyscale mask animated across frames with textures projected onto it, designed in "RGB base colours" for "separate colour assignment in our palette system"; five base masks make 60+ items; the masks are "less than 20 pixels wide" |
| Size | Some characters "only about 40 pixels" high, yet with "complex facial animations" (senior artist Jade Evans) |
| Light | "Elements of 3D" with "really nice shaders, lighting effects", drawing on Studio Ghibli and Google Street View |

Sources: [Express Yourself!](https://www.witchbrook.com/dev-blog-express-yourself/), [Gamereactor](https://www.gamereactor.eu/witchbrook-is-being-developed-with-inspiration-from-studio-ghibli-and-google-street-view-1649453/). Launch is set for January 28, 2027 ([witchbrook.com](https://www.witchbrook.com/)). Chucklefish has published no internal resolution, palette, outline rule or light direction.

Witchbrook's base art is flat hand-pixeled 2D with depth and light added at runtime, which for Tycho means indexed pictures lit through a quantized table per time of day *(inference)*. The kits, masks, mirroring, palettes and lighting can all be written as code. The drawings themselves need one of three things: anchor art to imitate, a stronger generator such as models rigged and rendered offline, or a long critique loop.

## Five levers

There are five ways to supply a style's specification, and they combine *(inference)*:

| Lever | What it is | Examples |
|---|---|---|
| Render and quantize | Geometry plus a renderer, brought down to pixels and a palette | Dead Cells rendered tiny frames "with no anti-aliasing" plus normal maps ([Vasseur](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-)). David Holland's reconstruction of t3ssel8r-style rendering snaps the camera to a texel grid, finds outlines from depth and normals so they stay one pixel wide, and highlights convex edges ([Holland](https://davidholland.netlify.app/articles/3d-pixel-art-rendering)). Gerstner's pixelated abstraction solves the downsample and the reduced palette together ([Gerstner et al. 2012](https://pixl.cs.princeton.edu/pubs/Gerstner_2012_PIA/index.php)) |
| Synthesis from examples | Output built only from patterns found in examples | WFC's overlapping model guarantees the output holds only N×N patterns found in the input ([mxgmn](https://github.com/mxgmn/WaveFunctionCollapse)), in the line of Efros–Leung synthesis and image quilting ([Efros & Leung](https://people.eecs.berkeley.edu/~efros/research/EfrosLeung.html); [Efros & Freeman](https://people.eecs.berkeley.edu/~efros/research/quilting.html)) |
| Measurement | Known rules turned into numbers | Slynyrd's hue shift of at most about 20° per step ([Slynyrd](https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes)), Saint11's ban on orphan pixels ([Saint11](https://medium.com/pixel-grimoire/how-to-start-making-pixel-art-2-bcd705cb04d7)), DCC's four colors per 4×4 cell |
| Diffusion with palette constraints | A learned prior held to a fixed palette | SD-πXL distills a diffusion model into a fixed n-color palette, so its output uses only the given colors ([arXiv 2410.06236](https://arxiv.org/abs/2410.06236)). Retro Diffusion says its model is trained on art licensed from consenting pixel artists, a claim no one has audited ([astropulse.itch.io](https://astropulse.itch.io/retrodiffusion)) |
| A human in the loop | Judgment from a person, as draw-overs or tests | Witchbrook's concept draw-overs on greybox layouts ([Witchbrook dev blog](https://www.witchbrook.com/category/dev-blog/)); Diablo II's paper dolls ([Schaefer](https://www.gamedeveloper.com/design/postmortem-blizzard-s-i-diablo-ii-i-)) |

The demo shows the first lever: one model, ray-marched and finished two ways, as a gothic pre-render and as a cozy 3/4 sprite. In Tycho this is a pre-bake, or better a build step whose output is committed as files.

<figure class="demo"><div class="stage" data-demo="prerender"></div>
<figcaption><b>Encode the pipeline: one model, two finishes.</b> Each sprite is a 3D model written in code as signed distance fields, ray-marched once per direction in your browser and cached.
<ul>
<li><i>Gothic</i> is a Diablo-like pre-render tuned to the measured sheet. It uses an isometric camera, light from above and the front with little fill, render texture, and hard edges with no outline. Colors come from an invented 256-color palette of hue ramps that run down to near-black. The Knight is 68 px tall in 16 directions; the others have 8. The Measure line compares the sprite with the sheet's numbers: facing the camera, he lands within a few points of all of them; seen from the back, his cape makes him darker than the sheet. Swapping the colormap recolors only the indexes, as Diablo II's monster variants did.</li>
<li><i>Cozy</i> takes the same model to a warm 3/4 look: OKLCH cel bands with violet shadows, a selective outline and cleanup.</li>
</ul>
Show raw render shows the step before the palette.</figcaption></figure>

## Measuring a style

Measurement is the lever that makes the others checkable, because each metric runs in plain JavaScript over palette indexes. The proposed set compares a reference with an output on nine counts *(inference; no paper defines this exact set)*:

| # | Metric | What it reads |
|---|---|---|
| 1 | Ramps | The palette sorted into ramps, with the hue step and the saturation curve per step |
| 2 | Colors per area | Colors per sprite and per 4×4 cell |
| 3 | Clusters | The cluster-size histogram and the orphan-pixel ratio |
| 4 | Outline | The share of silhouette pixels in the darkest ink, and black against selout |
| 5 | Light | The dominant light vector, from interior luminance gradients |
| 6 | Line weight | How thick lines run |
| 7 | Proportions | Sprite height, head-to-body ratio |
| 8 | Detail density | Index changes per opaque pixel |
| 9 | Pattern overlap | The fraction of an output's 3×3 patterns found anywhere in the anchors: WFC's condition turned into a score |

The research found no published work that uses style statistics like these as generator constraints, so this looks like an open niche *(inference)*. A game can measure its anchors once, store the numbers, and fail a test when generated output drifts, the way golden tests check frames today. The pattern-overlap score maps both pictures to ramp-position classes first, so a palette reprint doesn't count as drift. The thresholds are untested proposals, and the light-vector estimate should be checked against hand-labeled anchors before anything depends on it. Metrics can also be gamed: a generator can pass every threshold and still look wrong, so a human signs off on a golden contact sheet, especially for faces and anatomy *(inference)*.

## The style pack

Each target's own pipeline shows what its spec was. Diablo II fixed the tool, the angles, the 75-pixel height, the resolution and bit depth, one light direction and the part list. Witchbrook fixed the view, five drawn directions, six walk frames, about 40-pixel characters and a recoloring palette system ([Schaefer](https://www.gamedeveloper.com/design/postmortem-blizzard-s-i-diablo-ii-i-); [Express Yourself!](https://www.witchbrook.com/dev-blog-express-yourself/)). A style pack writes the same things down beside a world, as data an agent can check *(inference)*:

| Part | What it holds |
|---|---|
| Palette | Hex ramps with roles |
| Scale | Frame, tile, character height, head ratio, directions. Diablo II's 75 pixels at 640×480 are about 37 at 320×180 |
| Light rule | Direction, light-table levels, radius, time-of-day remaps |
| Line rule | Outline mode, weight, convex highlights |
| Anchors | Three to ten sprites at final size, as indexed data and as PNGs |
| Mood board | Kept out of the build |
| Acceptance | Thresholds on the metrics, plus one golden screenshot a human signs off |

The loop then runs generate, contact sheet, metrics, critique against the anchors, and change, and commits only when the metrics pass and a human approves. Elsewhere already has the loop's parts: a script that screenshots a quest as its bot plays, pinned first frames, and an indexed painter that keeps pictures as palette indexes. Agents can already drive sprite tools directly, as with pd2-sprite-studio's local MCP server of 31 tools ([pd2-sprite-studio](https://github.com/RoofooEvazan/pd2-sprite-studio)).

Pre-generation as a build step makes sense for anything heavier than a seeded runtime recipe. Running the pipeline offline and freezing its output as files in the repository makes the assets deterministic, reviewable in a diff and on a contact sheet, safe from floating-point drift between browser engines, and open to touch-ups by hand, while runtime code still multiplies them through kits, remaps and lighting.

## What stays hard

What stays hard is global and semantic rather than local. A body must stay one body across eight directions and many frames, a face of a few pixels must read as an expression, and every object must agree on one projection and one light. Local statistics can't see any of that. Production solves it with structure the generator owns: Diablo II rendered one model per part from fixed cameras, Dead Cells still had flicker it never fixed, and Witchbrook hand-draws its frames and calls fitting faces into 40 pixels a point of pride ([Schaefer](https://www.gamedeveloper.com/design/postmortem-blizzard-s-i-diablo-ii-i-); [Vasseur](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-); [Gamereactor](https://www.gamereactor.eu/witchbrook-is-being-developed-with-inspiration-from-studio-ghibli-and-google-street-view-1649453/)).

Expressive faces, anatomy and animation at 16 to 40 pixels are where design knowledge is densest and rules are thinnest. A single pixel is a whole feature there, and the mapping from form to pixels isn't smooth: a small pose change flips pixels and reads as boiling, which is why Dead Cells never fully solved its flicker ([Vasseur](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-)). The workarounds that hold up:

- a library of hand-drawn stamps (faces, hands, poses, expressions) that generators place but never invent;
- skeletons and 3D rigs rendered offline and mirrored, for consistent anatomy across directions, as both Diablo II and Witchbrook did;
- one shared projection and light vector across every asset;
- upscaled screenshots plus metrics, to cover a weak eye with numbers and magnification.

AI image models (PixelLab, Retro Diffusion) can draft kit parts offline, but they still need snapping to the palette and the grid. SD-πXL shows a hard palette constraint can be built into diffusion.

## My view: the work is in the spec

*This section is the opinion of the assistant who wrote the study, grounded in the research above.*

Code can place any pixel, so every style is reachable in principle, and the limits I was pointing at earlier aren't limits of code. They're the specification and the evaluation loop: when a generator misses a style, one or both is thin. So the way to get closer is to encode the style's pipeline, not just its look. Diablo II shows this best. It was 3D models, one fixed light baked into its backgrounds, 8 or 16 rendered directions, a 256-color palette with light-level and colormap lookup tables, and paper-doll armor parts ([Schaefer](https://www.gamedeveloper.com/design/postmortem-blizzard-s-i-diablo-ii-i-); [OpenDiablo2/pl2](https://github.com/OpenDiablo2/pl2)). Code can reproduce every one of those steps: SDF or mesh models, a fixed key light, a multi-angle render, quantization to ramps, and index remaps per light level and per monster. Witchbrook is the harder case, and it shows the boundary honestly: hand-drawn isometric sprites about 40 pixels tall, five drawn directions mirrored to eight, six-frame walks, and greyscale clothing layers recolored by palettes ([Express Yourself!](https://www.witchbrook.com/dev-blog-express-yourself/)). Code can reproduce the system around the drawings exactly. The drawings themselves need anchor art to imitate or a stronger generator, such as offline 3D rigs rendered and cleaned per direction.

**What you can feed me.** Each piece closes a known gap.

- **Reference screenshots at native 1:1 resolution**, cropped rather than scaled, so I measure real pixel sizes instead of guessing through scaling. Full sprite sheets like the Diablo II one are better still: a thousand frames give firm numbers.
- **Exact palettes in hex**, which end color drift.
- **The numbers**: sprite heights and tile size fix the scale; the projection, light direction and outline rule fix what every asset must agree on; frames per walk and directions fix the motion.
- **Three to five anchor sprites** you like and have the rights to use (bought, commissioned or your own), to imitate and to score pattern overlap against. Generators get much better at imitating a few concrete examples than at following adjectives.
- **A "never do" list** (pillow shading, banding, noisy single pixels, black shadows), which rules out failures faster than examples rule in successes.
- **Ratings or short critiques** of what I make ("heads too big", "too saturated"): the evaluation signal I can't produce alone, and each one turns into a rule.

**What I can do with it.**

- **Measure references** with the metrics above (colors per sprite and per 4×4 cell, ramp hue shifts, cluster sizes and orphan ratio, outline coverage and line weight, the light vector, head-to-body ratio, 3×3 pattern overlap), then check generated output against those numbers.
- **Build offline pre-render pipelines in Node**: 3D or SDF models, rigs for animation, renders in N directions, quantized with Gerstner-style pixel abstraction, finished, then frozen as files.
- **Run critique loops** with screenshots viewed at 1:1 and zoomed, the way the study's demos were built, writing what I learn back into the style pack so the next session starts from it.

**Still hard for me.** My own pixel-level judgment at tiny sizes is imperfect. The research found no study of how well vision-language models judge pixel-art fidelity, and I wouldn't trust my eye alone on a 40-pixel face; hand-authored stamps, offline rigs, and metrics with magnification cover it.

## Copyright

Style isn't protected; assets are. Nothing ripped from a game, whether Diablo II's palette files, its sprites or Witchbrook's art, should be shipped or used for training. Measuring reference screenshots for study, and writing an original palette that is *like* theirs, is the defensible line. In its non-binding May 2025 report, the US Copyright Office said training is not categorically fair use and that making competing expressive content weighs against it ([Jones Day](https://www.jonesday.com/en/insights/2025/05/us-copyright-office-issues-guidance-on-generative-ai-training)). *Thaler v. Perlmutter* held that a work made solely by AI can't be registered ([Loeb & Loeb](https://www.loeb.com/en/insights/publications/2025/03/thaler-v-perlmutter)). Steam requires disclosure of AI content that players consume ([GamingOnLinux](https://www.gamingonlinux.com/2024/01/valve-announces-new-rules-for-games-with-ai-content-on-steam/)). This is a reading of the cited legal summaries, not legal advice.

## Sources

- [Erich Schaefer, Postmortem: Blizzard's Diablo II (Game Developer, 2000)](https://www.gamedeveloper.com/design/postmortem-blizzard-s-i-diablo-ii-i-)
- [Shacknews, how Diablo 2 evolved from gothic horror to epic fantasy](https://www.shacknews.com/article/105720/how-diablo-2-evolved-from-gothic-horror-to-epic-fantasy)
- [OpenDiablo2/pl2, Diablo II palette and light-table format](https://github.com/OpenDiablo2/pl2)
- [Phrozen Keep, Diablo II colormaps](https://d2mods.info/forum/viewtopic.php?f=6&t=4369)
- [pd2-sprite-studio, DCC tools and an MCP server](https://github.com/RoofooEvazan/pd2-sprite-studio)
- [Game Informer, Witchbrook's new isometric look](https://gameinformer.com/news/2020/04/02/chucklefish-reveals-new-look-for-witchbrook)
- [Witchbrook dev blog, Express Yourself!](https://www.witchbrook.com/dev-blog-express-yourself/)
- [Witchbrook dev blog](https://www.witchbrook.com/category/dev-blog/)
- [Gamereactor, Witchbrook's inspirations](https://www.gamereactor.eu/witchbrook-is-being-developed-with-inspiration-from-studio-ghibli-and-google-street-view-1649453/)
- [witchbrook.com](https://www.witchbrook.com/)
- [Thomas Vasseur, Dead Cells' 3D pipeline for 2D animation](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-)
- [David Holland, 3D pixel art rendering](https://davidholland.netlify.app/articles/3d-pixel-art-rendering)
- [Gerstner et al. 2012, pixelated image abstraction](https://pixl.cs.princeton.edu/pubs/Gerstner_2012_PIA/index.php)
- [Maxim Gumin, WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse)
- [Efros & Leung, texture synthesis by non-parametric sampling](https://people.eecs.berkeley.edu/~efros/research/EfrosLeung.html)
- [Efros & Freeman, image quilting](https://people.eecs.berkeley.edu/~efros/research/quilting.html)
- [Slynyrd, Pixelblog 1: color palettes](https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes)
- [Saint11, how to start making pixel art 2](https://medium.com/pixel-grimoire/how-to-start-making-pixel-art-2-bcd705cb04d7)
- [SD-πXL, diffusion into a fixed palette (arXiv 2410.06236)](https://arxiv.org/abs/2410.06236)
- [Retro Diffusion](https://astropulse.itch.io/retrodiffusion)
- [Jones Day, the US Copyright Office on generative AI training](https://www.jonesday.com/en/insights/2025/05/us-copyright-office-issues-guidance-on-generative-ai-training)
- [Loeb & Loeb, Thaler v. Perlmutter](https://www.loeb.com/en/insights/publications/2025/03/thaler-v-perlmutter)
- [GamingOnLinux, Steam's rules for AI content](https://www.gamingonlinux.com/2024/01/valve-announces-new-rules-for-games-with-ai-content-on-steam/)

The full research is in [the style notes](notes/style_matching.md) and [the Diablo II sheet study](notes/d2_sprite_sheet_study.md).

<script src="demos/kit.js"></script>
<script src="demos/prerender.js"></script>
<script src="demos/start.js"></script>
