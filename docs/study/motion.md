# Motion

How pixel sprites are animated by code without looking like vector art: a fixed-step tick and frames held unevenly, walk phase from distance snapped to a few poses, code for the soft parts (spines, tails, hair, knees, landings), rotation and squash baked rather than done per frame, and palette cycling, the most on-model animation an indexed engine has. Animation that reads as pixel art changes pose rarely and holds unevenly, and nearly all of it is math per tick over a few drawn or baked poses, rounded to whole pixels only when drawn.

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md).

- [Timing](#timing)
- [Gaits](#gaits)
- [The soft parts in code](#the-soft-parts-in-code)
- [Rotation and squash are baked](#rotation-and-squash-are-baked)
- [Palette cycling and sway](#palette-cycling-and-sway)
- [Where it runs](#where-it-runs)
- [Sources](#sources)

## Timing

Glenn Fiedler's fixed-step accumulator steps the simulation by a constant dt, carries the remainder, and clamps long frames to avoid a "spiral of death" ([Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/)). On top of that, an animation should be a list of `{frame, ticks}` driven by the tick count, not the clock *(inference)*. A frame index that is a function of the ticks since the clip began makes animation reproducible and saveable as two integers *(inference, from [the notes](notes/animation.md))*.

## Gaits

Walk phase should follow distance traveled, not time, so feet don't skate, and phase should snap to 4, 6 or 8 poses, since a continuously sliding limb reads as vector art rather than pixels *(inference)*. The games already solve gaits five ways:

| Game | Its walk |
|---|---|
| Under the White Dragon | sin/cos `walkN` and `runN`, six poses each (`js/people.js`) |
| Lodestar | Distance-driven eight-frame `kdWalk`, with `kdIK` (`js/diver.js`) |
| Merryfolk | walk1 and walk2 |
| Neo | A four-frame walk |
| Elsewhere | A two-frame traveler (`js/ink.js`) |

<figure class="demo"><div class="stage" data-demo="walk-cycle"></div>
<figcaption><b>A character animated by parameters.</b> Leg phase from distance, body bob, idle breathing, a squash-and-stretch jump, and a verlet scarf, all rounded to whole pixels only when drawn.</figcaption></figure>

## The soft parts in code

Rain World shows how far code can carry the soft parts: its creator moved the slugcat's limbs in code "since code is how you make things move in a computer game", mixing code with traditional animation ([Unity blog](https://unity.com/en/blog/exploring-procedural-design-rain-world)). For a small engine the core tools are few *(inference)*:

| Tool | For |
|---|---|
| A follow-the-leader point chain with an angle limit | Spines and tails |
| A verlet chain pinned to an anchor | Hair, scarves and capes |
| Two-bone analytic IK | Knees |
| Springs | The pop on a landing |

All of these run in the fixed step and round to whole pixels only when drawn *(inference)*. Lodestar's Kindler already pairs a skeleton with two-bone IK (see [sprites](sprites.md#renders)).

<figure class="demo"><div class="stage" data-demo="ik-creature"></div>
<figcaption><b>A procedural creature.</b> A spine that follows its head with bend limits, and legs solved with two-bone IK that step when a foot drifts too far from its rest spot. Point at it, or tap on a phone, to lead it; switch to the spider for eight legs.</figcaption></figure>

## Rotation and squash are baked

Rotating or scaling pixel sprites each frame destroys them, so rotations must be baked.

| Method | What it does |
|---|---|
| Scale2x, Scale4x | Scale2x's four rules preserve edges; Scale4x is Scale2x applied twice ([scale2x.it](https://www.scale2x.it/algorithm)) |
| RotSprite | Upscales that way, rotates with nearest sampling, then downsamples ([rotsprite crate](https://docs.rs/crate/rotsprite/latest/source/src/rotate.rs)) |
| cleanEdge | torcado's, MIT-licensed: treats pixel art "as if it were a vector drawing" and lets the outline color win ties, but it is a shader ([cleanEdge](https://torcado.com/cleanEdge/)) |
| MMPX | Magnifies 2× "while preserving the exact palette, transparency, and single-pixel features"; processes **64k pixels in under 0.5 ms** and ships JavaScript reference code ([McGuire and Gagiu 2021](https://casual-effects.com/research/McGuire2021PixelArt/McGuire2021PixelArt.pdf)) |

All of these pick only existing colors, so baked rotations stay inside an ink limit. Squash and stretch should be baked the same way, by duplicating or dropping rows and columns, because a per-frame `scale(1.2, 0.8)` creates mixels, pixels of mismatched size *(inference)*. Tycho already ships the Scale2x and Scale3x row scalers that Lodestar uses ([sprites](../sprite.md#letter-grids-enlarged-by-rule)).

<figure class="demo"><div class="stage" data-demo="rotation"></div>
<figcaption><b>Rotation must be baked.</b> Nearest-neighbor rotation breaks lines and drops pixels; a RotSprite-style pass (upscale, rotate, take the most common color per block) keeps the shape and the palette. Squash and stretch should be baked the same way, by duplicating or dropping rows, because scaling at draw time makes mixels.</figcaption></figure>

## Palette cycling and sway

Palette cycling is the most on-model animation for an indexed engine. Mark Ferrari animated rain, waves, waterfalls and fog in single 256-color images by rotating palette entries. Joseph Huckaby's Canvas Cycle made that fast in a browser by recording only the pixels that use cycling entries and redrawing just those, which **ran on an iPhone 3GS** ([Effect Games](http://www.effectgames.com/effect/article-Old_School_Color_Cycling_with_HTML5.html)). Ferrari's BlendShift mode fades between entries, which adds colors outside the palette ([80.lv](https://80.lv/articles/color-cycling-from-the-90s-returns-with-html5)).

In Tycho, a cycle of K steps over a region becomes K small canvases printed once, plus a per-frame blit of the current phase *(inference)*. The frogs' pond glints, the lighthouse lamp and a moor bog in Elsewhere are the first uses. None of Tycho's five games cycles palettes today ([the local survey](notes/local_games_and_tycho.md)).

<figure class="demo"><div class="stage" data-demo="palette-cycle"></div>
<figcaption><b>Palette cycling.</b> Water and fire move only by rotating palette entries, as in Mark Ferrari's scenes. Joseph Huckaby's Canvas Cycle redrew only the cycling pixels and ran on an iPhone 3GS. In Tycho a cycle of K steps becomes K small canvases printed once, plus one blit per frame. None of the five games cycles palettes yet.</figcaption></figure>

Foliage sway works per frame with row strips, where `drawImage` source rectangles shear a sprite row by row, as Merryfolk's `blitSway` does (`js/nature.js`). It also works as three or four baked lean frames picked by one shared wind function. Either way the offset grows with height and is floored to whole pixels ([plants](plants.md#finishing-foliage)).

## Where it runs

Under Tycho's rules ([the renderer](../renderer.md)), placed by inference from its documented limits:

| Technique family | Where it runs | How |
|---|---|---|
| Frame timing, gait, springs, chains, IK | Stand-in | Math per tick; baked poses; chain nodes as fillRects |
| Rotation of pixel sprites | Pre-bake (shader for live cleanEdge) | Angle caches by RotSprite or MMPX |
| Squash and stretch | Pre-bake | Row and column variants |
| Palette cycling | Pre-bake (CPU buffer for large areas) | K phase canvases, or changed rows via drawPixels |
| Wind sway | Stand-in or pre-bake | Row strips, or lean frames |

## Sources

- [Glenn Fiedler, Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/)
- [Unity blog, the procedural design of Rain World](https://unity.com/en/blog/exploring-procedural-design-rain-world)
- [Scale2x, the algorithm](https://www.scale2x.it/algorithm)
- [The rotsprite crate](https://docs.rs/crate/rotsprite/latest/source/src/rotate.rs)
- [torcado, cleanEdge](https://torcado.com/cleanEdge/)
- [McGuire and Gagiu 2021, MMPX style-preserving pixel art magnification](https://casual-effects.com/research/McGuire2021PixelArt/McGuire2021PixelArt.pdf)
- [Joseph Huckaby, old-school color cycling with HTML5](http://www.effectgames.com/effect/article-Old_School_Color_Cycling_with_HTML5.html)
- [80.lv, color cycling from the 90s returns](https://80.lv/articles/color-cycling-from-the-90s-returns-with-html5)

The full research is in [the notes on animation](notes/animation.md); the palette tricks are also in [the notes on effects](notes/effects_rendering.md).

<script src="demos/kit.js"></script>
<script src="demos/motion-shared.js"></script>
<script src="demos/walk-cycle.js"></script>
<script src="demos/ik-creature.js"></script>
<script src="demos/rotation.js"></script>
<script src="demos/fx-shared.js"></script>
<script src="demos/palette-cycle.js"></script>
<script src="demos/start.js"></script>
