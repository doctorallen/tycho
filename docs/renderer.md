# The renderer

`Tycho.gpu`, `Tycho.light` and `Tycho.post`: Lodestar's design for drawing a frame on the GPU, for any game. Lodestar measured it against drawing on 2D canvases and uploading them to WebGL for the light: a frame went from 4.3 to 1.3 ms in Chrome and from 20 to 2 ms in WebKit (the engine on iPhones), because nothing is read back and nothing is copied between 2D canvases and WebGL.

## How a frame goes

1. `gpu.frameBegin([ctx...])`: the scene's color and glow layers cleared, the stand-in contexts reset.
2. The game draws as it would on 2D canvases, through stand-ins (`gpu.ctx(F.COL)` for the picture, `gpu.ctx(F.EM)` for what glows, `gpu.ctx(F.COL, true)` for an unlit overlay). Each call becomes a quad: a canvas's pixels go into an atlas (texture-array pages) the first time it's drawn; a picture rewritten every frame goes up as a texture of its own (`drawPixels`); a big painted ground can go up as textures by the box (`groundStart`, `groundDirty`, `groundSync`, `groundShift`).
3. A light model makes the lit picture from the scene in one pass (`light.ts`), or `gpu.plain()` for a frame that's lit already. What's drawn after goes over the lit picture.
4. A finish puts it on the canvas: the grid bloom and last pass (`gpu.frameEnd()`, Lodestar's), or `post.Blur` (the White Dragon's two bloom layers, reflections on wet ground, the fade, scaled up by whole pixels). The overlay's quads go on last.

Where there's no WebGL2 (`Gpu.create` returns null; `?nogpu` forces it), the game draws the same calls on real 2D canvases and lights them in JavaScript. A game's test holds the two to a tone (the White Dragon's `test/gpu.js`, Lodestar's `test/gllight.js`).

## Tycho.gpu

```js
const gpu = Tycho.gpu.Gpu.create(canvas, { onError, occlude: false }); // null without WebGL2
gpu.resize(w, h, bloom);           // the framebuffers at the view's size; bloom: [[cell px, strength]...] for the grid bloom
const g = gpu.ctx(Tycho.gpu.F.COL), gg = gpu.ctx(Tycho.gpu.F.EM);
```

The stand-in (`Ctx`) takes `fillRect`, `clearRect`, `drawImage` (all three forms), `globalAlpha`, `globalCompositeOperation` (source-over, lighter, destination-out, multiply), `imageSmoothingEnabled` (bilinear when scaled), `save`/`restore`, `translate`, `scale`, `rotate`, `setTransform`, a rectangle `clip` (through the transform), and `fillStyle` as a color, a `createLinearGradient` (drawn as strips) or a `createRadialGradient` (rasterized once by a 2D canvas for its shape and kept). Beyond a 2D context's:

| | |
|---|---|
| `ctx.tint = [r, g, b]` | Pictures drawn are multiplied by this color (0..1): a figure lit by the light where it stands, without a tinted copy |
| `ctx.lightMap = true` | Pictures drawn are multiplied by the light map (the smooth model's), pixel by pixel |
| `ctx.drawPixels(imageData, sx, sy, sw, sh, dx, dy, dw, dh)` | Pixels rewritten each frame, uploaded (the rows that changed) and drawn |

On the Gpu: `pic(canvas)` (its place in the atlas), `warm(...canvases)` (onto the atlas ahead of the first frame), `dirty(canvas)` (a canvas painted again: read anew), `ownTex`, `feet` (Lodestar's occlusion row for the quads pushed next, with `occlude: true`), `stats` (quads, draws, uploads this frame), `program(vs, fs, uniforms)`, `lightPass(program, setUniforms)`, `plain()`, `bloom(cx, cy)`, `frameEnd()`, `overlay()`, and `read('scene' | 'lit' | 'glow')` for tests.

A canvas that's painted again after it's been drawn needs `gpu.dirty(canvas)`, or the atlas keeps the old pixels. One painted afresh every frame (a darkness layer) can be marked `canvas.gpuLive = true`: it goes up as a texture of its own each time it's drawn. `canvas.gpuOwn = true` keeps a canvas out of the atlas, as a texture of its own uploaded once.

## Tycho.light

`new Tycho.light.Smooth(gpu).draw({ cells, w, h, cell, org, add })`: the White Dragon's light. `cells` is a grid of light (RGBA bytes, `w` × `h`), each cell `cell` view px, scaled up smooth from `org` (where a 2D canvas would draw it) and multiplied over the scene, with `add` of it added (0.1). The same map multiplies quads drawn with `ctx.lightMap`.

Lodestar's stepped light (dithered bands, violet in the dark, its lab looks) runs its own shader through `gpu.lightPass` (its `gllight.js`).

## Tycho.post

`new Tycho.post.Blur(gpu).finish({ out, wets, fade, time, near, far })`: the glow halved by averaging (so the bloom holds steady as the camera moves) and blurred into two layers; the lit picture, glow and bloom; each wet strip (`{ x0, y0, x1, depth, k }`, view px) reflecting what's above it with a ripple; the fade; scaled up `out` canvas px a view px.
