# The sun

A movable sun for a pixel game, in any parallel projection, that never leaves the palette. Light in a pixel game either **selects an ink** or **produces new colors**, and an eight-ink game sits at the strict end, where the sun works best as a few cheap, exact steps: three equations give the sun's path with season-dependent days, a cast shadow in any parallel projection is one affine `drawImage` of the sprite in a shadow ink, flat faces relight by palette remap at each sun step, and the sky and ambient color are a small table keyed on sun elevation. Graveyard Keeper proves this cheap family reads as dynamic light in a commercial pixel game. Lamps, light grids and global illumination are on [Light](light.md).

**Proposed: none of this is in Tycho yet.** The demos run here in the page, written in plain JS with the study's own kit (`demos/kit.js`), not Tycho; each says how it would run in Tycho: per frame (the GPU stand-in's calls), pre-bake (painted once offscreen), or shader (per-pixel work every frame). What would move into Tycho, and when, is in [the roadmap](roadmap.md).

Text marked *(inference)* is reasoning from the sources, not a sourced fact.

- [Two families of day cycle](#two-families-of-day-cycle)
- [The sun's path in three equations](#the-suns-path-in-three-equations)
- [Shadows are one affine drawImage](#shadows-are-one-affine-drawimage)
- [Keeping shadows on the pixel grid](#keeping-shadows-on-the-pixel-grid)
- [Faces relight by palette remap](#faces-relight-by-palette-remap)
- [Sky and ambient are a keyed table](#sky-and-ambient-are-a-keyed-table)
- [Sources](#sources)

## Two families of day cycle

Tycho's GPU stand-in draws each frame with fillRect, drawImage, alpha, transforms, gradients and four blends: **source-over, lighter, destination-out and multiply; there is no `screen`**. It also already draws an emissive target ("what glows", `gpu.ctx(F.EM)`) and an unlit overlay beside the color target ([the renderer](../renderer.md)). That makes the strict, ink-selecting end cheap.

Shipped games with a day cycle fall into two families.

| Family | Game | How |
|---|---|---|
| Real or proxy geometry, lit | Sea of Stars | "A custom-made render pipeline" with "full-on dynamic lighting" ([Sabotage press kit](https://sabotagestudio.com/presskits/sea-of-stars/)) |
| | Eastward | Assets rebuilt in 3D, with a hand-painted bump map for each ([Game Developer](https://www.gamedeveloper.com/art/eastward-s-creators-share-insights-on-making-pixel-art-adventures)) |
| | Graveyard Keeper's sequel | Pixel art projected onto Blender models ([80.lv](https://80.lv/articles/almost-every-object-in-this-stardew-valley-style-cemetery-sim-is-actually-3d)) |
| A global color keyed to the clock | Stardew Valley | One `outdoorLight` color scaled between a "starting to get dark" time and a "truly dark" time, per decompiled code quoted on a forum ([Chucklefish forum](https://community.playstarbound.com/threads/request-better-night-lighting.108239/)) |
| | Don't Starve | Colour cubes named day, dusk, night and full_moon, blended ([Klei forums](https://kleiforums.com/forums/topic/165348-guide-making-a-custom-colour-cube/)) |
| | Graveyard Keeper | **10 LUTs** for times of day; an ambient gradient that goes "dimmer" and takes "on a blue tint" at night; shadows made of sprites "that rotate around a point", up to four per object, drawn from "about ten different, more or less universal shadow sprites" ([Lazy Bear Games](https://slava.lazybeargames.com/graveyard-keeper-how-the-graphics-effects-are-made)) |

Graveyard Keeper, the best primary source, proves the cheap family reads as dynamic light in a commercial pixel game, and only that family fits the stand-in directly *(inference)*.

## The sun's path in three equations

| | Equation | Source |
|---|---|---|
| Declination | δ = −23.44°·cos[(360°/365)·(N + 10)], for day of the year N; errs by up to about 2° | [Wikipedia: Position of the Sun](https://en.wikipedia.org/wiki/Position_of_the_Sun) |
| Hour angle | h runs at 15° per hour from solar noon | |
| Elevation | sin α = sinΦ·sinδ + cosΦ·cosδ·cos h, for latitude Φ | [Wikipedia: Solar zenith angle](https://en.wikipedia.org/wiki/Solar_zenith_angle) |
| Azimuth | An atan2 form | [Wikipedia: Solar azimuth angle](https://en.wikipedia.org/wiki/Solar_azimuth_angle) |
| Sunrise | Where cos h₀ = −tanΦ·tanδ | [Wikipedia](https://en.wikipedia.org/wiki/Solar_zenith_angle) |

So **day length changes with the season for free**, which is what Witchbrook advertises ("Days get longer or shorter depending on the season") ([PC Gamer](https://www.pcgamer.com/witchbrook-release-date-gameplay-trailer-what-we-know)).

What follows for a game *(inference)*:

- **Each world declares a latitude**, so a polar world keeps its sun up and a tropical one loses noon shadows.
- **Each world picks its screen north**, to get a "stage sun" with shadows falling down and right: the pixel-art habit of light from the upper left.
- **The clock is the save's**, never the wall clock, which keeps the game deterministic.
- **The phase table** (sky gradient stops, ambient tint, shadow ink and alpha, palette row) is keyed on sun elevation rather than the hour. Golden hour is variously defined between about −6° and +10° of elevation, and in blue hour "There are no sharp shadows" ([Wikipedia: Golden hour](https://en.wikipedia.org/wiki/Golden_hour_(photography))).

## Shadows are one affine drawImage

A point at height h casts its shadow h·cot(e) away from the sun's azimuth, at sun elevation e. In every parallel projection (top-down, 3/4 oblique, 2:1 iso, military or cavalier) the shadow of an upright sprite card is therefore an affine image of the sprite. That is one `setTransform(û.x, û.y, c.x, c.y, F.x, F.y)` and one `drawImage` in a flat shadow ink, where c = −k·cot e·(sinA·ê + cosA·n̂) projects the sun's ground offset through the view's axes *(inference, derived from parallel-projection geometry; to be checked visually)*. A sun behind the object puts the shadow up-screen, a sun in front flips it toward the viewer, and a sun to the side is a pure shear.

Practice agrees in pieces:

- Shadows "can easily be created by skewing the sprite and drawing it in all black" ([Sector12 Games](https://www.sector12games.com/skewshear-vertex-shader/)).
- Gobs and Gods offsets each pixel's own silhouette along the shadow direction, scaled by height above a root line ([Gobs and Gods](https://www.gobsandgods.com/blog/shadows-2d.html)).
- HD-2D renderers alpha-test casters so "the shadow perfectly matches the character's pixel art shape" ([dev.to](https://dev.to/gaurav_de/creating-an-hd-2d-rendering-pipeline-on-dx12-205k)).

Iso buildings get an exact shadow from the hull of the footprint diamond and the roof diamond moved by the shadow offset, and each piece is a transformed fillRect, so no paths are needed *(inference)*. Side view has only a sliver of floor, and side-view games seem to sell time with sky and layer tints instead (unverified in the notes).

## Keeping shadows on the pixel grid

Pixel discipline matters more than the formula *(inference, except where linked)*.

| Rule | Why |
|---|---|
| Clamp elevation at 10° to 15° for shadow length, and fade shadow contrast to nothing below about 6° | cot e blows up near the horizon (cot 10° ≈ 5.7); a cool moon shadow then takes over at night |
| Quantize azimuth to 8 or 16 steps and elevation to 3 to 5, and rebake each caster's shadow only when the step changes | Keeps shadows integer-aligned and stops fractional shears from shimmering. At 16 by 4 steps the sun crosses a step every 20 to 45 game minutes, and the bake can run in the background and crossfade |
| Put shadows into one mask, composited once | Repeated `multiply` at partial alpha darkens overlaps twice |
| Give every figure a small contact blob | It holds at noon and at night |
| Shadow terrain by a grid march toward the sun per step, written into the light grid that `Tycho.light.Smooth` already draws | Precomputed horizon maps are the known fast path for this ([GameDev.net](https://gamedev.net/forums/topic/351505-terrain-self-shadows/3309444/)) |

Low suns distort sun-driven cloud shadows, so one open-source iso pipeline fixes their direction ([unity-isometric-pixel-pipeline](https://github.com/JoonyoungSeo/unity-isometric-pixel-pipeline)).

## Faces relight by palette remap

Lambert shading is linear, so a flat-faced iso box needs one dot product per face. The top face takes sin e, a wall facing azimuth φ takes cos e·cos(A − φ), and the result maps to one of the material's three or four tones *(inference)*. If tiles carry a per-pixel face ID (top, left, right), relighting is a pure palette remap: the tile is reprinted through the game's indexed painter with each face's ramp row chosen for the current sun step, so the left and right walls trade light as the sun passes and the frame never leaves its inks *(inference)*.

<figure class="demo"><div class="stage" data-demo="sun"></div>
<figcaption><b>Move the sun, in every projection.</b> One voxel scene lit by a sun dragged across the day strip, with a compass to swing north and real solar arcs for winter, equinox and summer. Each face is lit once per sun step in world space: its angle to the sun picks one of four ramp steps, and a ray marched toward the sun decides its shadow. So the same shadows fall in the same places in all eight views, from golden hour to moonlight. Sky, ambient and shadow colors key on sun elevation, not clock hour. In Tycho this is a re-bake when the sun crosses a step. For flat sprites the cheaper route is Graveyard Keeper's: a shadow is the sprite redrawn through one affine transform, length height × cot(elevation), away from the sun.</figcaption></figure>

Sprites with real volume can be relit two ways. Graveyard Keeper's artists paint light from four sides and a script merges the paintings into a normal map ([Lazy Bear Games](https://slava.lazybeargames.com/graveyard-keeper-how-the-graphics-effects-are-made)). Because Lambert is linear, those paintings can also be blended per sun step offscreen and then quantized back to the inks *(inference)*. Normals for generated sprites should come from shape (a bevel or chamfer height, as Lodestar's painter already does) rather than brightness. A comparison of generators found "no technique could produce maps as good as the one an artist can manually paint", and noted that 3D methods "may not yield correct results" on pixel art ([arXiv 2212.09692](https://arxiv.org/pdf/2212.09692v1.pdf); [Lodestar art.js](https://github.com/doctorallen/lodestar/blob/main/js/art.js)). A one-pixel rim of light ink on the edge facing the sun, baked per step, is strongest at golden hour *(inference)*.

## Sky and ambient are a keyed table

The sky and ambient color are a small keyed table, not a physical model. Indexed games can make it a palette texture with "U = color index, V = time", hand-designed per time of day. That beats full 3D LUTs, which need a 4096×4096 texture at 256³ that "mobile still really don't like" ([Unreal forums](https://forums.unrealengine.com/t/beautiful-8-bit-pixel-art-scenes-animated-through-color-cycling/35110); [Yanrishatum gist](https://gist.github.com/Yanrishatum/86794e9e663a7e343f9ef66e8b0f38ae); [pvigier](https://pvigier.github.io/2019/10/06/palette-swapping-with-shaders.html)).

Elsewhere's lighthouse already works this way. It keeps NIGHT, KINDLE and LIT palettes and reprints the room in each, so a lighting change is a palette swap (its `quests/lighthouse/lighthouse.js`). A hand-designed night palette (cool ramps, one or two warm lit inks, dark outlines kept) is the house-style answer, and it keeps the eight-ink limit exact where a multiplied LUT cannot *(inference)*.

Minecraft keeps sky light separate from block light and combines them through a two-axis lightmap texture indexed by block and sky level, so "day/night is a change of lookup table, not a re-propagation" ([Minecraft Wiki: Light](https://minecraft.wiki/w/Light)). The same split lets Tycho change the hour without relighting the world *(inference)*.

## Sources

- [Sabotage Studio, Sea of Stars press kit](https://sabotagestudio.com/presskits/sea-of-stars/)
- [Game Developer, Eastward's creators on pixel art](https://www.gamedeveloper.com/art/eastward-s-creators-share-insights-on-making-pixel-art-adventures)
- [80.lv, Graveyard Keeper's 3D objects](https://80.lv/articles/almost-every-object-in-this-stardew-valley-style-cemetery-sim-is-actually-3d)
- [Chucklefish forum, Stardew's night lighting](https://community.playstarbound.com/threads/request-better-night-lighting.108239/)
- [Klei forums, making a custom colour cube](https://kleiforums.com/forums/topic/165348-guide-making-a-custom-colour-cube/)
- [Lazy Bear Games, how Graveyard Keeper's graphics effects are made](https://slava.lazybeargames.com/graveyard-keeper-how-the-graphics-effects-are-made)
- Wikipedia: [position of the Sun](https://en.wikipedia.org/wiki/Position_of_the_Sun), [solar zenith angle](https://en.wikipedia.org/wiki/Solar_zenith_angle), [solar azimuth angle](https://en.wikipedia.org/wiki/Solar_azimuth_angle), [golden hour](https://en.wikipedia.org/wiki/Golden_hour_(photography))
- [PC Gamer, Witchbrook](https://www.pcgamer.com/witchbrook-release-date-gameplay-trailer-what-we-know)
- [Sector12 Games, skew and shear shadows](https://www.sector12games.com/skewshear-vertex-shader/)
- [Gobs and Gods, 2D shadows](https://www.gobsandgods.com/blog/shadows-2d.html)
- [dev.to, an HD-2D rendering pipeline on DX12](https://dev.to/gaurav_de/creating-an-hd-2d-rendering-pipeline-on-dx12-205k)
- [GameDev.net, terrain self-shadows](https://gamedev.net/forums/topic/351505-terrain-self-shadows/3309444/)
- [unity-isometric-pixel-pipeline](https://github.com/JoonyoungSeo/unity-isometric-pixel-pipeline)
- [arXiv 2212.09692, normal map generators compared](https://arxiv.org/pdf/2212.09692v1.pdf)
- Palette textures: [Unreal forums](https://forums.unrealengine.com/t/beautiful-8-bit-pixel-art-scenes-animated-through-color-cycling/35110), [Yanrishatum gist](https://gist.github.com/Yanrishatum/86794e9e663a7e343f9ef66e8b0f38ae), [pvigier, palette swapping with shaders](https://pvigier.github.io/2019/10/06/palette-swapping-with-shaders.html)
- [Minecraft Wiki, Light](https://minecraft.wiki/w/Light)
- [Lodestar art.js](https://github.com/doctorallen/lodestar/blob/main/js/art.js); Tycho's [renderer](../renderer.md)

The full research is in [the notes on the sun and time of day](notes/sun_and_time_of_day.md).

<script src="demos/kit.js"></script>
<script src="demos/sun.js"></script>
<script src="demos/start.js"></script>
