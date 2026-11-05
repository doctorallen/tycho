# Sprites and items

How characters, creatures and items are made by code so they pass for hand-drawn: mirrored masks for small, plentiful things, paper-doll kits drawn in material indexes for people and loot, renders from shapes or models, and the finishing passes that make any of them look drawn. The generator matters less than people expect. Every working case pairs a hand-made structure (a mask, a kit, a model) with a small seeded generator, then finishes it with hue-shifted ramps, an outline, light from one side and cleanup, and throws out bad seeds by test.

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md).

- [Masks](#masks)
- [Kits](#kits)
- [Renders](#renders)
- [Finishing passes](#finishing-passes)
- [Determinism](#determinism)
- [Machine learning](#machine-learning)
- [Where it runs](#where-it-runs)
- [Sources](#sources)

## Masks

The oldest family of sprite generators shows the pattern in its simplest form. Dave Bollinger's Pixel Spaceships work on a 14×14 grid with strict left-right symmetry, which leaves 7×14 cells to edit. A hand-drawn mask nicknamed "the avocado" leaves **62 pixels free to vary, about 4×10¹⁸ ships**, and a whole ship is six 32-bit words ([Bollinger](https://www.davebollinger.us/pixelspaceships)). Bollinger also curated his output: known bad sub-patterns such as "bug eyes" trigger extra fixes, and a second review throws out weak ships and makes new ones ([Bollinger](https://www.davebollinger.us/pixelspaceships)).

zfedoran's JavaScript port spells out the algorithm ([pixel-sprite-generator.js](https://raw.githubusercontent.com/zfedoran/pixel-sprite-generator/master/pixel-sprite-generator.js)):

| Mask cell | Becomes |
|---|---|
| -1 | Always outline |
| 0 | Always empty |
| 1 | Body or empty, at random |
| 2 | Body or outline, at random |

The mask is mirrored on X, Y or both, and any empty cell next to a body cell along a row or column becomes outline. It shades along one axis with `sin(πu)`, which reads as a rounded volume, and colors the outline at 0.3 of the fill. It also calls `Math.random` throughout, so **it cannot be seeded as shipped** ([source](https://raw.githubusercontent.com/zfedoran/pixel-sprite-generator/master/pixel-sprite-generator.js)). Sprator swaps the mask for a 4×8 noise grid and a few steps of a Life-like rule (a cell survives with 2 or 3 neighbors and is born with 0 or 1), then mirrors the grid and adds an outline ([yurkth/sprator](https://www.github.com/yurkth/sprator)).

<figure class="demo"><div class="stage" data-demo="sprite-masks"></div>
<figcaption><b>Mask sprites.</b> zfedoran's cell rules (always outline, always empty, body or empty, body or outline), mirrored, outlined and shaded along a ramp, beside Sprator's cellular-automaton variant (survive on 2 or 3, born on 0 or 1). Turn the outline off to see how much of the read it carries.</figcaption></figure>

In all three, the sprites read well because of the body plan, the symmetry and the outline, not because of the noise; the noise only varies details inside a silhouette that already works *(inference)*. That makes masks a good fit for small, plentiful things: Neo's bugs and watchdogs, Lodestar's per-clime creature variants, an Elsewhere world of beetles or moths. Mirrored masks alone will not give the charm of Elsewhere's hatted frogs.

## Kits

For characters and items that need to look hand-made, kits (paper dolls) do better: drawn parts, layered by slot.

| Kit | Parts | Color |
|---|---|---|
| Universal LPC Spritesheet Character Generator | Layer groups and z-order kept in JSON | Recolors break wherever assets don't share a ramp; a third-party fork made recoloring work only by capping each material at **six shades** ([OpenGameArt](https://opengameart.org/node/130839); [OpenGameArt forum](https://opengameart.org/node/159745)) |
| Caves of Qud | Each 16×24 tile drawn in at most three roles: foreground, detail, background | Real colors assigned at runtime from **18 fixed palette colors** ([Caves of Qud wiki](https://wiki.cavesofqud.com/wiki/Modding:Tiles)) |
| Starbound guns | Butt, middle and barrel parts | Palette-swapped images ([GunsNAmmo mod config](https://github.com/GTG3000/GunsNAmmo)) |
| A ProcJam spellbook generator | Image layers, each with several options | ([ProcJam Seeds](https://procjam.com/seeds/issues/3/spell.txt.html)) |

The lesson for Tycho is to draw kit parts in material-index space: index 1 to 3 for material A's ramp, 4 to 6 for material B, one index for the outline. A ramp table then turns any recolor into a lookup, and sockets (hand, head top, belt) line up held items and hats without drawing every combination *(inference)*.

<figure class="demo"><div class="stage" data-demo="sprite-people"></div>
<figcaption><b>Paper-doll villagers.</b> Body, head, hair, clothes and props chosen per seed and drawn in material slots, then printed through skin, hair and cloth ramps. A saved person is a handful of part ids and ramp names, which is plain JSON.</figcaption></figure>

Three of the games already have half-kits: Elsewhere's frogs quest has `hat(S, kind)` with seven hats (`quests/frogs/frogs.js`), the White Dragon's `person(o)` has eleven hair styles and a range of clothes and held items (`js/people.js`), and Merryfolk's gene-to-palette `villagerPalette` turns a few gene colors into about 35 palette letters (`js/sprites.js`).

Neo's loot has the most to gain from linking stats to looks. The base type picks the part family, the material picks the ramp, an elemental affix picks an accent ramp and an overlay, and rarity fills sockets, so the picture always agrees with the generated name *(inference)*.

<figure class="demo"><div class="stage" data-demo="items"></div>
<figcaption><b>Items tied to their names.</b> Part families by item type, ramps by material, accents by affix, so the picture always agrees with the generated name. This is what Neo's loot would gain.</figcaption></figure>

## Renders

Rendering pipelines are the third route. Dead Cells modeled simple low-poly characters in 3ds Max and rendered each frame **at tiny size with no anti-aliasing**, exported as PNG plus a normal map for a toon shader. The team accepted pixel flicker as a cost it never solved ([Vasseur, Game Developer](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-)). That flicker is an argument against rasterizing 3D at runtime when pixels must stay stable.

A small version of the same idea fits a phone: signed-distance shapes (capsules, spheres, boxes) sampled once at the pixel center, normals from the distance gradient, light quantized to three or four ramp steps, then an outline. Metaballs suit slimes, bushes and clouds, and L-systems with integer Bresenham lines suit bare trees, all drawn once into an index buffer *(inference)*. Lodestar's Kindler already does a home-grown version: a 3D-ish skeleton with two-bone IK, tapered tubes projected and z-buffered, and the result laid down as strokes (`js/diver.js`). Merryfolk's recursive `makeBareTree` and blob-lit `paintCrown` are its plant generators (`js/sprites.js`; see [plants](plants.md)). [Reaching a style](style.md) takes the render route furthest, with a model written in code and finished two ways.

Sprite stacking (horizontal slices offset 1 pixel each and rotated together, popularized by NIUM) gives cheap pseudo-3D, but animating across slices is "a big pain" ([Lexaloffle BBS](https://www.lexaloffle.com/bbs/?tid=39014); [Wee Boats devlog](https://jamespoole.itch.io/wee-boats/devlog/685630/using-sprite-stacking-for-pseudo-3d-in-wee-boats)). The `stack-vs-3d` demo in [perspectives](views.md) sets a sprite stack beside real WebGL voxels of the same object: the stack stays inside the stand-in's drawImage budget, while the voxels need a shader.

## Finishing passes

Whatever makes the shape, the same few passes make it look drawn, in this order:

| Pass | What it does |
|---|---|
| Hue-shifted ramps | Raymond Schlitter (Slynyrd) shifts hue between swatches but **tops out around 20°**, lets saturation peak mid-ramp, and warns against pairing high saturation with high brightness ([Slynyrd Pixelblog 1](https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes)) |
| Outline | A plain outer outline, or a selective outline ("selout") colored from the darkest step of the neighboring fill |
| Light | From one fixed direction |
| Cleanup | Removes orphan pixels, single-pixel holes and the L-shaped corner pixel that makes 1-pixel lines look ragged. Pixel Composer ships a "De-Corner" filter for exactly this ([Pixel Composer docs](https://docs.pixel-composer.com/nodes/filter/fix/de_corner.html)), and Krita has built a pixel-perfect stroke mode that does the same thing ([Krita MR 2158](https://invent.kde.org/graphics/krita/-/merge_requests/2158)) |
| Ordered dither | Last, and only on large gradients, never on small sprites *(inference)* |

Lodestar already carries the most complete local finisher. `buildArtSprite` runs chamfer distance passes to get each pixel's depth inside its silhouette and its material patch, turns that into a height and a normal, applies Lambert light from the top left, cuts hard to a ramp step, removes orphans, and outlines in black or selout (`js/art.js`). Its "A+" rules (at most 4 tones per material, hue-shifted ramps, texture in clusters, no dither on sprites) are a written style policy that a finisher can enforce (`DECISIONS.md`). Elsewhere's frogs' rule is the same kind of policy, stricter still: "a dark outline, flat color, a few bold marks, no noise". Ramps and dither have their own page, [palette and resolution](looks.md).

## Determinism

Seeding a generator is easy once every random call goes through a named stream. Bollinger's six words show the ideal: the sprite is a pure function of its seed ([Bollinger](https://www.davebollinger.us/pixelspaceships)). Elsewhere already gives each quest `ctx.rng(name)`, a `Tycho.seed.Rng` keyed by save seed, quest and name (its `js/shell.js`).

- Separate streams for shape, color and detail let one stage change without reshuffling the others *(inference)*.
- Rejection loops stay deterministic if they retry with `seed + attempt` up to a cap and then fall back to a fixed mask *(inference)*.
- Caches should be keyed by recipe version and seed, and a save should hold seeds and parameters, never pixels *(inference)*.

One risk deserves attention. JavaScript leaves `Math.sin`, `Math.pow` and `Math.exp` "implementation-approximated", so a generator that turns a sine into a threshold decision could, rarely, split between engines *(inference; the notes found no fetched source on cross-engine bit-exactness)*. Elsewhere's replays must rebuild a quest from its seed on any phone, while its tests run only in Chrome and Node, which share one JavaScript engine (V8), so a drift in Safari would go unseen *(inference)*. Decisions should rest on integer hashes and tables. Floating-point math is fine for shading values that are quantized afterward, as long as the quantization does not feed back into layout.

## Machine learning

Machine learning is an offline authoring tool, not a runtime generator.

- PixelLab sells skeleton-posed animation and directional rotations, with a model priced at **$0.0084 per 64×64 image** ([PixelLab API](https://pixellab.ai/pixellab-api); [PixelLab docs](https://www.pixellab.ai/docs/tools/skeleton-animation)).
- Retro Diffusion offers color reduction and "Neural Pixelate" inside Aseprite ([Astropulse](https://astropulse.gumroad.com/l/RetroDiffusion)).
- The research datasets are small: Sprite Sheet Diffusion trained on **152 paired action sequences** ([arXiv 2412.03685](https://arxiv.org/html/2412.03685v2)).

The tools' own features (palette controls, re-snapping to the grid, skeleton conditioning) show their known faults: off-palette colors, fake pixels, and drift between frames. Floating-point results also differ across GPUs, so on-device inference cannot promise the same pixels from the same seed. The useful hybrid is to draw or generate kit parts offline, quantize them to the game's palette in OKLab, clean them, store them as indexes, and let the deterministic kit make the variety at runtime *(inference)*.

## Where it runs

Under Tycho's rules ([the renderer](../renderer.md)), placed by inference from its documented limits:

| Technique family | Where it runs | How |
|---|---|---|
| Mask and automaton sprites, kits, SDF, metaball and L-system props | Pre-bake | Build once per seed into a sheet; one drawImage per frame |
| 3D-to-pixel renders (Dead Cells, Diablo II), SDF pre-renders for a style pack, AI generation | Offline | A Node build step; quantize to ramps, clean, store as indexes in the repo |
| Outlines, selout, form shading, cleanup, hit-flash silhouettes, dithered see-through variants | Pre-bake | Passes over index buffers |

## Sources

- [Dave Bollinger, Pixel Spaceships](https://www.davebollinger.us/pixelspaceships)
- [zfedoran, pixel-sprite-generator](https://raw.githubusercontent.com/zfedoran/pixel-sprite-generator/master/pixel-sprite-generator.js)
- [yurkth, Sprator](https://www.github.com/yurkth/sprator)
- [Universal LPC Spritesheet Character Generator, on OpenGameArt](https://opengameart.org/node/130839)
- [Caves of Qud wiki, modding tiles](https://wiki.cavesofqud.com/wiki/Modding:Tiles)
- [Thomas Vasseur, Dead Cells' 3D pipeline for 2D animation](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-)
- [Slynyrd, Pixelblog 1: color palettes](https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes)
- [Pixel Composer, De-Corner](https://docs.pixel-composer.com/nodes/filter/fix/de_corner.html)
- [PixelLab API](https://pixellab.ai/pixellab-api)
- [Sprite Sheet Diffusion, arXiv 2412.03685](https://arxiv.org/html/2412.03685v2)

The full research is in [the notes on sprites, characters and items](notes/sprites_characters_items.md); what the five games already do is in [the notes on the local games](notes/local_games_and_tycho.md).

<script src="demos/kit.js"></script>
<script src="demos/sprites-shared.js"></script>
<script src="demos/sprite-masks.js"></script>
<script src="demos/sprite-people.js"></script>
<script src="demos/items.js"></script>
<script src="demos/start.js"></script>
