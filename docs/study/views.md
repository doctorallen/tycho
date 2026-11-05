# Perspectives

Which camera projections suit generated content, and what each costs. Parallel projections suit procedural tile content: the 2:1 dimetric grid usually called isometric, the 3/4 top-down oblique view of Neo, Lodestar and Merryfolk, and the White Dragon's side view. The pseudo-3D family (Mode 7, raycasting, OutRun roads, Voxel Space) was built for weak hardware, runs per scanline or per column, fits plain JavaScript at 320×180 and takes generated 2D data directly, so each would make a single world with its own way of playing. Sprite stacks fake 3D with one `drawImage` per slice; real voxels hold at any angle but need WebGL.

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md).

Text marked *(inference)* is reasoning from the sources, not a sourced fact.

- [Parallel projections](#parallel-projections)
- [Pseudo-3D](#pseudo-3d)
- [Sprite stacks and real 3D](#sprite-stacks-and-real-3d)
- [Parallax](#parallax)
- [Sources](#sources)

## Parallel projections

| Projection | Used by | How it works |
|---|---|---|
| 2:1 "isometric" | Elsewhere | Really dimetric, at arctan(½) ≈ 26.565°, chosen because true isometric's 30° lines "would not follow a neat pixel pattern" ([Wikipedia: Isometric video game graphics](https://en.wikipedia.org/wiki/Isometric_video_game_graphics)). Projection `sx = (x − y)·tw/2`, `sy = (x + y)·th/2 − z`, which inverts easily for picking. Depth order is by x + y of each footprint's front corner, and long objects need splitting or a topological sort *(general knowledge)* |
| Top-down oblique (3/4) | Neo, Lodestar, Merryfolk | "Fits objects snugly into non-overlapping square tiles, potentially removing the need for an extra Z-order calculation" ([Wikipedia](https://en.wikipedia.org/wiki/Isometric_video_game_graphics)) |
| Side view | The White Dragon | No projection at all |

All three suit procedural tile content.

## Pseudo-3D

The pseudo-3D family was built for weak hardware and runs per scanline or per column, so it fits plain JavaScript at 320×180.

| Technique | How it works |
|---|---|
| Mode 7 | An affine matrix per scanline, sampled without interpolation ([Wikipedia: Mode 7](https://en.wikipedia.org/wiki/Mode_7)) |
| Wolfenstein-style raycaster | One ray per column with a grid traversal (DDA), and perpendicular distance to avoid fisheye ([Lodev](https://lodev.org/cgtutor/raycasting.html)) |
| OutRun-style roads | A precomputed Z map per line, and curves built by summing small per-line offsets ([Lou's Pseudo 3d Page](http://www.extentofthejam.com/pseudo/)) |
| Comanche's Voxel Space | A height map and a color map drawn in "less than 20 lines of code" ([s-macke/VoxelSpace](https://github.com/s-macke/VoxelSpace)) |

Each one takes generated 2D data directly as input. That fits Elsewhere's promise that every side quest has "its own way of playing": a raycast maze, a Mode 7 boat crossing or a voxel flyover would each be a single quest drawing into its own index buffer *(inference)*.

<figure class="demo"><div class="stage" data-demo="perspectives"></div>
<figcaption><b>One world, eight projections.</b> The same small height and tile map drawn top-down, 3/4 oblique, isometric, as a side slice, as a Mode 7 plane, through a raycaster, as stacked slices and on a hex grid. The note under each tab gives its projection.</figcaption></figure>

## Sprite stacks and real 3D

Sprite stacking, popularized by Moppin's NIUM, draws an object as horizontal slices stacked bottom to top, each offset about 1 pixel upward, which reads as 3D. Rotation is free: each slice is rotated about its center. Animating across slices is "a big pain", and a model is hard to see while it's drawn slice by slice; voxel editors (Goxel, MagicaVoxel) can export slice sheets ([Sprite stacking with perspective, GameMaker](https://azuzota.itch.io/sprite-stacking-with-perspective); [Wee Boats devlog](https://jamespoole.itch.io/wee-boats/devlog/685630/using-sprite-stacking-for-pseudo-3d-in-wee-boats); [Lexaloffle BBS](https://www.lexaloffle.com/bbs/?tid=39014)). Of the 3D-looking styles, voxels and stacks suit procedural content best: the model can come from noise or grammar rules, and every slice is an indexed 2D image, so stacking works inside a palette lock *(inference, from the notes)*. In plain JS, a stack pre-rendered per angle in 8 or 16 steps costs one `drawImage` per object per frame; rotating each slice by inverse mapping, not forward plotting, avoids holes *(inference, from the notes)*.

Real 3D rendered as pixel art, in the manner of t3ssel8r, snaps an orthographic camera to the texel grid, "where one snap corrects every pixel", shifts the output back by the snap error for smooth motion, and draws 1-pixel outlines by edge detection on depth and normal buffers ([David Holland, 3D Pixel Art Rendering](https://davidholland.netlify.app/articles/3d-pixel-art-rendering); [arXiv 2603.14587](https://arxiv.org/abs/2603.14587)).

<figure class="demo"><div class="stage" data-demo="stack-vs-3d"></div>
<figcaption><b>Sprite stack against real 3D.</b> The same height slices two ways, turning together. Left is a sprite stack: one <code>drawImage</code> per slice, which fits Tycho's 2D stand-in but fakes pitch, so walls shred at shallow angles. Right is the same slices turned into voxels, greedy-meshed once and drawn with WebGL into a frame the same size. It holds at any pitch, lights and shadows every face in palette steps, and can add t3ssel8r-style edge lines from depth. Drop the pitch to see where the stack breaks.</figcaption></figure>

## Parallax

Side and oblique views sell depth with layers that scroll at their own speeds. Far layers should be reprinted once in a lighter or bluer palette by index remap, not covered with alpha overlays, so the frame keeps its ink count *(inference, from [the effects notes](notes/effects_rendering.md))*.

<figure class="demo"><div class="stage" data-demo="parallax"></div>
<figcaption><b>Parallax with palette haze.</b> Peaks, midpoint-displacement hills, trees and grass in prebaked strips that scroll at their own speeds, with far layers shifted toward the sky by palette index rather than by alpha, so the frame keeps its ink count.</figcaption></figure>

## Sources

- [Wikipedia, isometric video game graphics](https://en.wikipedia.org/wiki/Isometric_video_game_graphics)
- [Wikipedia, Mode 7](https://en.wikipedia.org/wiki/Mode_7)
- [Lode Vandevenne, raycasting](https://lodev.org/cgtutor/raycasting.html)
- [Lou's Pseudo 3d Page](http://www.extentofthejam.com/pseudo/)
- [s-macke, VoxelSpace](https://github.com/s-macke/VoxelSpace)
- [Sprite stacking with perspective, GameMaker](https://azuzota.itch.io/sprite-stacking-with-perspective), [Wee Boats devlog](https://jamespoole.itch.io/wee-boats/devlog/685630/using-sprite-stacking-for-pseudo-3d-in-wee-boats) and [Lexaloffle BBS](https://www.lexaloffle.com/bbs/?tid=39014)
- [David Holland, 3D pixel art rendering](https://davidholland.netlify.app/articles/3d-pixel-art-rendering) and [Dylan Ebert, Texel Splatting (arXiv 2603.14587)](https://arxiv.org/abs/2603.14587)

The full research is in the notes on [styles, resolution and perspective](notes/styles_resolution_perspective.md) and on [sprites](notes/sprites_characters_items.md).

<script src="demos/kit.js"></script>
<script src="demos/views-shared.js"></script>
<script src="demos/perspectives.js"></script>
<script src="demos/stack-vs-3d.js"></script>
<script src="demos/parallax.js"></script>
<script src="demos/start.js"></script>
