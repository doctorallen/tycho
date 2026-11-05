# The study

This study asks how games generate pixel characters, items, plants, worlds, light, motion and effects with code, which styles, resolutions and perspectives those methods suit, and what Tycho should add to support them. The finding fits in a sentence. Procedural pixel art that passes for hand-made is almost never pure generation: it pairs hand-made structure with small seeded generators and rule-based finishing passes, then drops bad seeds by test. At the resolutions Tycho's games use, from Neo's 192-pixel-wide view to Elsewhere's 320×180, the methods that pay off are cheap CPU work done once into palette-indexed buffers, so each frame only blits. Every page carries live demos, generated in your browser from a seed.

**Proposed: none of this is in Tycho yet.** The demos run in the pages, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho. What would move into Tycho, and when, is in [the roadmap](roadmap.md).

- [The finding](#the-finding)
- [What it means for Tycho](#what-it-means-for-tycho)
- [How the demos would run](#how-the-demos-would-run)
- [How to read it](#how-to-read-it)
- [The pages](#the-pages)

## The finding

<div class="finding"><p>Procedural pixel art that passes for hand-made is almost never pure generation. Every shipped case pairs <b>hand-made structure</b> (body masks, part kits, room templates, concept graphs, 3D models) with <b>small seeded generators</b>, then <b>finishing passes</b> (hue-shifted ramps, outlines, fixed light, cleanup), then a <b>test that throws out bad seeds</b>.</p></div>

The same pattern holds for light, zoomable worlds and target styles. A second round of research added a movable sun, seven kinds of lighting, zoom levels, a sixty-species plant library, a 26-material sand simulation and how to reach a target style. It held for every one: a table of data plus a small generator, and almost all of it bakes once.

| Number | What it is |
|---|---|
| 62 | Free pixels in Bollinger's ship mask: about 4×10¹⁸ ships ([sprites](sprites.md#masks)) |
| 16 vs 47 | Tiles for a dual-grid autotile set against a blob set ([worlds](worlds.md)) |
| ~20° | The most hue shift per ramp step (Slynyrd) ([sprites](sprites.md#finishing-passes)) |
| 4.3 → 1.3 ms | Lodestar's frame time on Tycho's GPU renderer, in Chrome ([the renderer](../renderer.md)) |

What pays off, topic by topic:

- **Sprites and plants:** mirrored masks for creatures, paper-doll kits drawn in material indexes, a Weber–Penn-style brancher with clump stamps for many species of trees, shrubs, flowers and cacti.
- **Color:** hue-shifted OKLab ramps and world-anchored Bayer dither.
- **Worlds:** noise and graph-first maps, small-region wave function collapse (WFC) and dual-grid autotiles.
- **Light** fits the same mold once it *selects an ink* instead of producing new colors. Three equations give a movable sun with season-dependent days, a cast shadow in any parallel projection is one affine `drawImage`, iso faces relight by palette remap at each sun step, and a tile flood fill in the manner of Minecraft, Terraria or Starbound feeds either Tycho's existing smooth light map or a stepped ramp table. Normal maps, soft shadows, global illumination and bloom need shaders and lose most of their value under eight inks.
- **Zoom:** endless chunked worlds like Merryfolk's zoom crisply through a pyramid of chunks at power-of-two scales, built by mode-downscaling palette indexes and kept consistent across levels by position-pure generation.
- **Falling sand:** materials reduce to a table of weights, temperature transitions and contact reactions with per-tick chances, run over a typed-array grid of 20,000 to 58,000 cells.
- **Style:** any target, from Diablo II's pre-rendered gloom to Witchbrook's cozy isometric town, is reachable in principle. The practical limits are how much of the style's pipeline has been encoded and whether output can be measured against the target, so a "style pack" of palettes, scales, light and line rules, anchor sprites and metrics is the real lever.

Under all of it, decisions rest on integer hashes and named seed streams, so a picture is a pure function of its seed and a save holds seeds and parameters, never pixels; machine learning stays an offline authoring tool ([sprites](sprites.md#determinism)).

## What it means for Tycho

Tycho already has a strong seeded core, color ramps, letter-row sprites, a chunked painter, a cell light map and a fast renderer. It has no indexed-color layer, generation, autotiling, animation tooling, sun, level of detail or style checks, and its five games each re-solve ramps, dither, outlines, noise, flood fills, chunk caches and light grids. Tycho should grow in five waves:

1. The indexed foundation, with style metrics.
2. Finishers, iso, kits, figures and style packs.
3. Generated places, with flora and the LOD pyramid.
4. The sun, ramp light and `tilelight`.
5. Specialties such as the falling-sand cell sim.

Elsewhere gains first from most of this, Lodestar and Merryfolk give the most code, and Neo gains only once it adopts Tycho. The waves are in [the roadmap](roadmap.md).

## How the demos would run

Each demo is tagged by how it would run in Tycho, under its rule that each frame draws only with the GPU stand-in's calls ([the renderer](../renderer.md)):

| Tag | Means |
|---|---|
| per frame | Fits the stand-in each frame: fillRect, drawImage, alpha, the four blends (source-over, lighter, destination-out, multiply), transforms and gradients |
| pre-bake | Painted once offscreen, where anything goes, then blitted each frame |
| shader | Per-pixel work every frame: a shader (`gpu.program`, `gpu.lightPass`), or at small sizes a typed array uploaded with `drawPixels` |

## How to read it

Claims with a link come from the research notes' sources: web pages, or files in the Tycho and game repositories. Text marked *(inference)* is reasoning from those sources, not a sourced fact. All the API sketches in the roadmap are proposals and count as inferences. The four games other than Elsewhere were surveyed by sampling files, not by reading every line, so some of their function names and counts may be slightly off. [Reaching a style](style.md) closes with an opinion written in the first person, which is the author's view and is labeled as such.

## The pages

| Page | What it covers |
|---|---|
| [Sprites and items](sprites.md) | Masks, kits and renders for characters, creatures and items; the finishing passes; determinism and machine learning |
| [Plants](plants.md) | One brancher, a crown envelope and clump stamps for sixty species of trees, shrubs, flowers and cacti |
| [Worlds and levels](worlds.md) | Noise and climate terrain, graph-first levels, small-region WFC, dual-grid autotiles, villages, and generate-and-test |
| [Real geography](geography.md) | How real landforms, water, climate and caves are made, with a world you can watch form and visit in 3/4 view |
| [Settlements, paths and trees](settling.md) | Where villages go, how paths and trails form, where each plant grows, and how height is drawn in 3/4 view |
| [People and histories](people.md) | Naming languages, cultures, generated histories that leave marks on a place, and daily routines, all feeding Tyrell |
| [Zoom and chunks](zoom.md) | An endless world zoomed from region map to single flower through a pyramid of indexed chunks |
| [Palette and resolution](looks.md) | Hardware and modern styles as rules, OKLab ramps, world-anchored dither, detail tiers, integer scaling and palettes colorblind players can read |
| [Text and interface](text.md) | Pixel fonts and talk boxes at 320×180, integer scaling and touch targets on phones |
| [Perspectives](views.md) | Top-down, 3/4, isometric, side, Mode 7, raycast, stacked and hex views, parallax, and sprite stacks against real 3D |
| [The sun](sun.md) | A three-equation sun, shadows as one affine drawImage, and faces relit by palette remap at each sun step |
| [Light](light.md) | Smooth, banded, dithered and reprinted light, tile flood fill, shadowcasting, and bounced light |
| [Motion](motion.md) | Timing, gaits, code for the soft parts, baked rotation, and palette cycling |
| [Effects and simulations](effects.md) | Water and weather, tiny integer automata, and falling sand as a material table |
| [Sound and music](sound.md) | Sound effects from a dozen seeded numbers, places from noise, adaptive music from a seed, and a sound palette per world |
| [Phones and budgets](phones.md) | How much slower phones are, their canvas, memory and storage limits, workers, and a bench to run on your own phone |
| [Reaching a style](style.md) | Diablo II, Witchbrook, the levers of a style, and the style pack an agent can check |
| [The five games](games.md) | What Tycho already has and what Neo, Lodestar, Merryfolk, the White Dragon and Elsewhere each solve on their own |
| [The roadmap](roadmap.md) | Five waves, from the indexed foundation to specialties, with order, risks and first steps |
| [Sources](sources.md) | Every source the study draws on |
| [Research notes](notes/README.md) | The full research, topic by topic |
