# Sun position, time of day and directional lighting in pixel-art games, across perspectives

Scope: how a 2D pixel engine (Tycho: per frame only fillRect, drawImage, alpha, 4 blends, transforms, gradients, tint, lightMap, drawPixels; everything heavier pre-baked offscreen) can move a sun across the sky and keep the lighting correct in top-down, 3/4 oblique, isometric 2:1, side view, military or cavalier oblique, and pseudo-3D views.

Related notes in this folder, not repeated here: `effects_rendering.md` (light grids, `Tycho.light.Smooth`, normal-map generator paper, cloud shadows, crossfading two reprints for day and night) and `local_games_and_tycho.md` (the stand-in's `tint`/`lightMap`, Lodestar's stepped light, White Dragon's `lightMap`).

Research note: shipped games rarely publish their time-of-day internals. The most complete primary source found was Lazy Bear's Graveyard Keeper write-up. Sea of Stars, Eastward, Kingdom, Terraria, Owlboy, Celeste, Unrest, Hyper Light Drifter, Moonlighter and Witchbrook have little or no published technical detail. The projection math in the Inferences sections is derived here from standard parallel-projection geometry and is labeled as derivation, not as a sourced claim.

## How shipped games handle the time of day

### Takeaway
Two families exist. Full 3D lighting systems light real or proxy geometry: Sea of Stars' custom pipeline, Eastward's 3D-with-bump-maps engine, Octopath's UE4 with invisible shadow proxies, Graveyard Keeper 2's projected pixel art on 3D models. Cheap 2D systems are a global ambient color or color-grade LUT keyed to the clock (Stardew, Don't Starve, Graveyard Keeper 1's 10 LUTs), plus a few rotating shadow sprites per object. Only the second family fits Tycho's stand-in directly. Graveyard Keeper 1 shows it can still look "dynamic".

### Cited Findings
**Graveyard Keeper (Lazy Bear Games, Unity): the most detailed primary source**
- The ambient light color comes from a time-of-day gradient: "By nightfall, the light source not only becomes dimmer but also takes on a blue tint." The intensity of light sprites also varies with the time of day. — [Slava Cherkasov, "Graveyard Keeper: how the graphics effects are made"](https://slava.lazybeargames.com/graveyard-keeper-how-the-graphics-effects-are-made); original on [Game Developer](https://gamedeveloper.com/programming/graveyard-keeper-how-the-graphics-effects-are-made)
- Color grading: "10 different LUTs to represent various times of day—night, twilight, evening, and so on." Each is a 3D RGB table stored as a 2D texture. An artist grades a game screenshot in Photoshop and the same adjustments are applied to an identity LUT. The article gives no LUT size or blend math. — [Lazy Bear blog](https://slava.lazybeargames.com/graveyard-keeper-how-the-graphics-effects-are-made)
- Shadows: "Shadows are created using sprites that rotate around a point." The rotation happens in a vertex shader, not the transform. They tried skewing and found it "unnecessary". Each object has "up to four shadows: one from the sun and up to three additional ones from dynamic light sources". A script in `Update()` finds the three nearest lights by distance and angle. The game reuses "about ten different, more or less universal shadow sprites." Known weakness: elongated objects such as fences make poor shadows. — [Lazy Bear blog](https://slava.lazybeargames.com/graveyard-keeper-how-the-graphics-effects-are-made)
- Normal maps: an artist "roughly paints the light on all four sides using a brush" and a script merges the four into a normal map. Sprite Lamp is mentioned as an alternative tool. Point lights fade by depth: "The shader calculates the distance between the light source and the sprite along the vertical (depth) axis", and the light fades rapidly once the sprite blocks it. — [Lazy Bear blog](https://slava.lazybeargames.com/graveyard-keeper-how-the-graphics-effects-are-made)
- Fog is "numerous horizontal cloud layers spread across the entire scene", so the tops of tall sprites pass through fewer layers (height fog without depth). — [Lazy Bear blog](https://slava.lazybeargames.com/graveyard-keeper-how-the-graphics-effects-are-made)
- For the sequel, artists made pixel art and then projected it onto Blender 3D models from a fixed angle to get realistic lighting and 3D shadows under an orthographic camera. — [80.lv](https://80.lv/articles/almost-every-object-in-this-stardew-valley-style-cemetery-sim-is-actually-3d)

**Sea of Stars (Sabotage Studio)**
- The press kit claims "Full-on dynamic lighting" and a "custom-made render pipeline". — [Sabotage press kit](https://sabotagestudio.com/presskits/sea-of-stars/)
- From a 2020 hands-on: "a totally dynamic lighting system reflecting the time of day"; "time fast forwarded at will in the demo"; "Shadows lengthened and the moon came out"; character sprites are "also dynamically lit" and "reflected in puddles". Thierry Boulanger: "It's doing things that 2D sprite games shouldn't do with lighting." — [Nintendo Life](https://www.nintendolife.com/news/2020/03/hands_on_first_impressions_of_sea_of_stars_the_next_project_from_the_messenger_dev_sabotage)
- The player controls the time of day: the Solstice Warriors switch between day and night with a button, and time is used in puzzles. Reviewers describe shadows rotating as the sun and moon trade places in a warm-to-cool transition. — [Wikipedia](https://en.wikipedia.org/wiki/Sea_of_Stars); [Hey Poor Player](https://www.heypoorplayer.com/2023/08/28/sea-of-stars-review-pc/)
- Kickstarter-era feature list: normal-mapped sprites, multi-angle shadow-casting sprites, volumetric lighting, screen-space indirect lighting. — [Niche Gamer, 2020](https://nichegamer.com/2020/03/19/the-messenger-prequel-rpg-sea-of-stars-enters-kickstarter-launches-2020-for-pc/)
- A Sabotage post credits the lighting system to programmer "Jeakim". No official technical breakdown was found. — [Sabotage story](https://sabotagestudio.com/story/)

**Eastward (Pixpil, custom engine descended from MOAI)**
- "Eastward is a 3D game with a 2D perspective! ... we use shader textures and lighting systems in our custom engine ... to help convey atmosphere, and things like the weather and the time." Assets "are rebuilt in a 3D environment, ready to be hand painted in the bump map one by one to ensure they have the correct lighting performance in-game." — [Game Developer interview](https://www.gamedeveloper.com/art/eastward-s-creators-share-insights-on-making-pixel-art-adventures)

**Octopath Traveler (HD-2D, UE4)**
- It uses UE4's deferred renderer, which suits many dynamic lights. An implementer's write-up says Octopath and Live A Live appear to use invisible 3D proxy shapes to cast shadows. That is the author's observation, not Square Enix's statement. — [dev.to HD-2D on DX12](https://dev.to/gaurav_de/creating-an-hd-2d-rendering-pipeline-on-dx12-205k)
- A point light was added with combat effects so characters cast shadows onto the environment. — [Unreal Engine spotlight](https://www.unrealengine.com/en-US/spotlights/octopath-traveler-s-hd-2d-art-style-and-story-make-for-a-jrpg-dream-come-true)
- Primary talk (no transcript found): "The Fusion of Nostalgia and Novelty in the Development of Octopath Traveler", Unreal Fest Europe 2019. — [Unreal Engine events](https://www.unrealengine.com/events/unreal-fest-europe-2019/the-fusion-of-nostalgia-and-novelty-in-the-development-of-octopath-traveler)

**Stardew Valley**
- From decompiled code quoted on a 2016 forum (pre-1.4, unverified against the current game): `UpdateGameClock()` checks "starting to get dark" and "truly dark" times and computes `Game1.outdoorLight = (Game1.isRaining ? Game1.ambientLight : Game1.eveningColor) * scale;`. The scale is `Math.Min(0.93f, 0.3f + (...))` from the start-of-dark time, or `Math.Min(0.93f, 0.75f + (...))` from the truly-dark time. A mod suggested `eveningColor = new Color(245, 225, 170)`. — [Starbound/Chucklefish forum thread](https://community.playstarbound.com/threads/request-better-night-lighting.108239/)
- Mods hook `getStartingToGetDarkTime` and `getTrulyDarkTime` (with `isNightOut` and `GameClock`) to change night timing. That confirms the structure: a scalar ramp between two clock thresholds drives one global color. — [Dynamic Night Time mod](https://forums.stardewvalley.net/resources/dynamic-night-time.41)
- Community mods add per-season ambient tints (orange in spring, yellow in summer, red in fall, violet in winter) and smooth night ramps, which suggests vanilla uses one tint per phase. — [Ambient Light mod](https://www.nexusmods.com/stardewvalley/mods/4639)

**Don't Starve / Don't Starve Together (Klei)**
- Ambient grading uses "colour cubes" (LUT textures). Mods supply a table keyed `day`, `dusk`, `night`, `full_moon`, and convert the cube image with Klei's TextureConverter. — [Klei forums guide](https://kleiforums.com/forums/topic/165348-guide-making-a-custom-colour-cube/)
- A `phasechanged` event triggers blending of the ambient colour cube on day, dusk and night transitions, and a moon-phase event updates the blend. The source is a third-party mirror of the API docs. — [DST API docs mirror](https://vietnd69.github.io/dst-api-webdocs/docs/game-scripts/components/colourcube)
- The game has a discrete day, dusk and night cycle. — [Don't Starve wiki](https://dontstarve.wiki.gg/wiki/Day-Night_Cycle)

**Terraria**
- The 1.1 lighting engine moved from one light level per tile to colored light with smooth sub-tile transitions. The "Retro" and "Trippy" modes keep per-tile light. — [Terraria wiki: Lighting mode](https://terraria.wiki.gg/wiki/Lighting_mode)
- A modder notes that lighting the sky, where every sky tile is a light source, is fast, and that the engine takes the max light value per tile, so negative lights don't work. A mod changelog mentions "sky color profiles". Both are secondhand. — [Fancy Lighting changelog (Steam)](https://steamcommunity.com/sharedfiles/filedetails/changelog/2822950837?p=4)

**Children of Morta (Dead Mage, Unity)**
- "We stretch the pixel animations in HD resolution (about 4 times ...). By doing this, our lighting could have a resolution as high as other normal 2D games." Lighting runs at screen resolution, not art resolution. — [TechRaptor](https://techraptor.net/content/how-dead-mage-created-the-art-for-children-of-morta)
- The team says it chose pixel art without technical limits, which allowed advanced lighting, shadows and post effects. — [Co-Optimus interview](https://www.co-optimus.com/Editorial/1448/indie-ana-co-op-and-the-children-of-morta-interview.html)

**Witchbrook (Chucklefish)**
- The day-night cycle follows the seasons: "Days get longer or shorter depending on the season." No rendering detail has been published. — [PC Gamer](https://www.pcgamer.com/witchbrook-release-date-gameplay-trailer-what-we-know); [GamesRadar](https://www.gamesradar.com/games/simulation/witchbrook-dev-chucklefish-reignites-excitement-for-the-cozy-life-sim-with-a-series-of-first-looks-that-are-giving-serious-stardew-valley-vibes-every-citizen-has-their-own-look-name-and-home)

**Others found**
- Unity isometric pixel pipeline (open source, URP): a day/night manager drives sun and moon rotation and intensity. Tying cloud-shadow direction to the sun angle "causes shadow compression and stretching at low sun angles", so it uses a fixed direction for cloud shadows. — [GitHub: unity-isometric-pixel-pipeline](https://github.com/JoonyoungSeo/unity-isometric-pixel-pipeline)
- Pixel 3D (Godot 4 shader): 480x270, orthographic, day/night cycle, toon lighting, light shafts from the sun's shadow map. The web build can't run Forward+, so it falls back to a time-of-day slider over prerendered frames, i.e. pre-baked sun phases. — [itch.io devlog](https://fcidade.itch.io/pixel-3d-godot-shader/devlog/1713028/pixel-3d-is-out)
- Mark Ferrari's color-cycling scenes (Living Worlds, HTML5 port by Joseph Huckaby): one flat 256-color image with no layers or alpha. The canvas port precomputes which pixels reference animated palette entries and redraws only those. — [EffectGames article](http://www.effectgames.com/effect/article-Old_School_Color_Cycling_with_HTML5.html)
- A forum thread on Ferrari-style scenes describes time of day as a palette texture where "U is color and V is time", with gradients hand-designed per time of day. — [Unreal forums](https://forums.unrealengine.com/t/beautiful-8-bit-pixel-art-scenes-animated-through-color-cycling/35110)

### Inferences
- The pattern that ships everywhere and fits Tycho: one scalar `t` (time of day) → (a) an ambient color or LUT index from a keyed table, (b) a sun direction feeding a handful of shadow sprites per object, (c) light-sprite intensities. Graveyard Keeper is the existence proof that this reads as "dynamic lighting" in a commercial pixel game without real 3D.
- Sea of Stars, Eastward and Octopath need real per-pixel shading (normal or bump maps plus shadow maps). On Tycho that means either `gpu.program`/`lightPass` shaders or pre-baking N sun phases (next sections).
- Witchbrook's season-dependent day length and Stardew's two thresholds are both cheaply covered by the solar model in the last section: sunrise and sunset fall out of latitude and declination.

### Gaps
- No primary technical source found for Sea of Stars' shadow method (whether multi-angle shadow sprites, as listed at Kickstarter, or shadow maps on proxies), Kingdom (Noio), Owlboy, Celeste, Unrest, Hyper Light Drifter or Moonlighter. Searches returned only reviews and fan speculation. Celeste and Hyper Light Drifter have no sun cycle as far as found.
- Graveyard Keeper's LUT size, blend math, and shadow rotation formula are not published.
- Whether Stardew's night darkening uses a subtractive lightmap blend was not confirmed in any fetched source.
- Terraria's sky-color-by-time code was not found (it would need tModLoader source).

## Cast shadows from a sun direction in each projection

### Takeaway
A shadow's length is height·cot(elevation) and its direction is opposite the sun's azimuth. In every parallel projection (top-down, 3/4, iso, dimetric, military, cavalier) the shadow of an upright sprite card is an affine image of the sprite: one `setTransform` and a `drawImage` in a flat shadow ink. That is exactly what Tycho's stand-in can do per frame. Height-field ray marching gives correct self-shadowing on terrain but needs a shader or a pre-bake. Shadow volumes and shadow maps belong to the pseudo-3D tier.

### Cited Findings
- Skew technique: sprite shadows "can easily be created by skewing the sprite and drawing it in all black", with the skew tied to the sprite's position relative to the light. — [Sector12 Games: Skew/Shear vertex shader](https://www.sector12games.com/skewshear-vertex-shader/)
- Godot "2D Cast Shadow" shader stretches vertex x in the vertex stage and builds the shadow in the fragment stage, with a flag to flip the direction for mirrored sprites. — [Godot Shaders: 2D cast shadow](https://godotshaders.com/shader/2d-cast-shadow/)
- Another Godot shader offsets the shadow by the sprite's position relative to the screen center, a fake point light. — [Godot Shaders: dynamic shadow for 2D sprites](https://godotshaders.com/shader/dynamic-shadow-shader-for-2d-sprites/)
- Self-silhouette offset (Gobs and Gods): per pixel, `dy = clamp(_yBottom - UV.y, 0, 1); shadowUV = UV - dy * shadowDirection; COLOR = mix(shadow, col, col.a);`. Each pixel samples its own sprite along the shadow direction, scaled by height above a root line. The direction is converted to pixel space so the angle doesn't depend on texture aspect. The quad is widened to avoid clipping, and edge samples are faded with smoothstep to avoid streaks. The direction vector sets angle and length together. — [Gobs and Gods: 2D shadows with a shader](https://www.gobsandgods.com/blog/shadows-2d.html)
- Graveyard Keeper rotates shadow sprites about a pivot rather than skewing: one sun shadow plus up to three from nearby lights, drawn from about ten generic shadow sprites. — [Lazy Bear blog](https://slava.lazybeargames.com/graveyard-keeper-how-the-graphics-effects-are-made)
- Top-down tilemap shadow shader parameters: shadow angle in degrees and a wall-height multiplier. — [Godot Shaders: 2D top-down shadows (tilemap ready)](https://godotshaders.com/shader/2d-top-down-shadows-tilemap-ready/)
- Height-field ray march: march from each fragment toward the light and darken if any sampled height is above the ray. Parameters are height scale, step count and step size. CC0. — [Godot Shaders: basic self-shadowing from heightmap](https://godotshaders.com/shader/basic-self-shadowing-from-heightmap/)
- For terrain, a precomputed horizon map (one horizon angle per texel per direction) is the fastest approach. Interpolating between several shadow maps approximates height-dependent shadows. — [GameDev.net: terrain self-shadows](https://gamedev.net/forums/topic/351505-terrain-self-shadows/3309444/)
- rayshader computes heightmap shadows from sun altitude and azimuth and can integrate over a range of angles for soft shadows. — [rayshader ray_shade docs](https://www.rdocumentation.org/packages/rayshader/versions/0.13.2/topics/ray_shade)
- Voxel editor: shadow length is controlled by sun elevation and direction by azimuth. — [Enki Software: Avoyd isometric render](https://www.enkisoftware.com/devlogpost-20220330-1-Isometric-Render-of-a-Minecraft-Map-in-Avoyd-Voxel-Editor)
- Billboards in a tilted camera (Paper2D): an upright camera-facing card casts its shadow in the wrong direction. An upright hidden caster then shadows the visible sprite when the light is in front. Fixes: a flat caster sprite hovering just above the ground, stretched and rotated into the wanted shadow (one per light direction), or separate light channels so the visible sprite ignores the shadow light. — [Unreal forums](https://forums.unrealengine.com/t/paper-2d-sprites-top-down-camera-how-to-get-shadows-consistent-with-3d-space-4-26/505228)
- HD-2D shadow maps: alpha-test the shadow pass (discard alpha < 0.9) so "the shadow perfectly matches the character's pixel art shape". Shadow bias causes "Peter Panning" (shadows detached from feet), fixed with screen-space contact shadows that ray-march toward the light against the depth buffer. — [dev.to HD-2D on DX12](https://dev.to/gaurav_de/creating-an-hd-2d-rendering-pipeline-on-dx12-205k)
- Low sun angles: the Unity iso pipeline fixed cloud-shadow direction because sun-driven direction distorted at low angles. — [GitHub: unity-isometric-pixel-pipeline](https://github.com/JoonyoungSeo/unity-isometric-pixel-pipeline)
- Blue hour: "There are no sharp shadows" because the sun is below the horizon. Golden-hour light has lower contrast, so shadows are less dark. — [Wikipedia: Golden hour](https://en.wikipedia.org/wiki/Golden_hour_(photography))

### Inferences (derivations, not sourced)
**General formula (all parallel projections).** World axes: E (east), N (north), Z (up). The sun has azimuth A (clockwise from north) and elevation e. The vector toward the sun is s = (sinA·cos e, cosA·cos e, sin e). A point at height h lands on the ground at offset d = −h·cot(e)·(sinA, cosA). Shadow length is L = h·cot e, pointing toward azimuth A+180°.

Let a projection map the world unit vectors to screen vectors ê, n̂, ẑ (ẑ points up the screen, so it has a negative screen y). Then a sprite card drawn with its foot at F, horizontal axis û (usually (1,0)) and pixel height v (v screen px up = v/|ẑ| world units) has a shadow that is the affine map

  (u, v) → F + u·û + v·k·(−cot e)·(sinA·ê + cosA·n̂),  with k = 1/|ẑ|.

For canvas this is `setTransform(û.x, û.y, c.x, c.y, F.x, F.y)` with c = −k·cot e·(sinA·ê + cosA·n̂), applied to the sprite with its rows flipped so v counts up from the foot. One matrix covers every sun position: a sun behind the object gives a shadow up-screen behind it, a sun in front gives a flipped shadow toward the viewer, a sun to the side gives a pure shear.

**Per view (screen y down):**
- *Top-down (orthographic, straight down):* ê = (1,0), n̂ = (0,−1). Heights are invisible, so cast shadows are the footprint (or roof outline) translated by (−L·sinA, +L·cosA). A tall object's shadow is the footprint swept along that offset: the union of the footprint at 0 and at the offset plus the connecting parallelogram, or many copies stepped 1 px along the vector.
- *3/4 oblique (Zelda, Stardew):* ê = (1,0), n̂ = (0,−q), where q is the ground's vertical squash (1 for square tiles), ẑ = (0,−1). Then c = cot e·(−sinA, q·cosA). When the sun is north, the shadow flips down toward the viewer. When the sun is south, it stretches up behind the sprite and is partly hidden by it (draw shadows before sprites in the same y-sort row).
- *Isometric 2:1:* ê = (tw/2, th/2)/tile, n̂ = (tw/2, −th/2)/tile (axes depend on which world direction is "north" on screen), th = tw/2, ẑ = (0, −hz). The same formula applies. Iso sprites are pictures of solids, not flat cards, so the sheared silhouette is an approximation. For box-like buildings the exact shadow is the convex hull of the footprint diamond and the roof diamond translated by d. That is the union of two diamonds and two edge parallelograms, and each is a `fillRect` under a transform (a transformed rect is a parallelogram), so it fits the stand-in with no paths.
- *Military oblique (plan true, verticals straight up at full scale):* like 3/4 with q = 1 and the ground rotated (often 45°): ê and n̂ are rotated unit vectors, ẑ = (0,−1).
- *Cavalier/cabinet oblique (front face true, depth at 45°, full or half scale):* ê = (1,0), n̂ = r·(cos45°, −sin45°) with r = 1 (cavalier) or 0.5 (cabinet), ẑ = (0,−1).
- *Side view:* the ground is a line, so the floor shadow is a sliver: draw a short flat ellipse or blob whose x-offset is −L·sinA in the screen plane and whose width grows with L. For a back wall at depth D behind a foreground object, the shadow on the wall is the silhouette translated by about D·(horizontal sun component, vertical component)/depth component. Low sun gives long horizontal displacement. Most side-view games instead sell the time of day with sky gradients, layer tints and silhouettes; see the next sections.

**Pixel-art discipline.**
- cot e blows up at the horizon (cot 15° ≈ 3.7, cot 10° ≈ 5.7, cot 5° ≈ 11.4). Clamp e to about 10–15° for shadow purposes, and fade shadow alpha or contrast to zero from about e = 6° down to 0°. That matches golden-hour softening and blue-hour shadowlessness. Hand off to a weak, cool moon shadow at night.
- Quantize: azimuth to 8 or 16 steps and elevation to 3–5 steps. Re-bake each object's shadow canvas only when the step changes. That gives crisp, integer-aligned shadows with no shimmering from fractional shears. In between, either hold the step (the classic look) or crossfade two baked steps with alpha.
- Draw shadows in an opaque dark ink, or into one mask layer composited once at fixed alpha, so overlapping shadows don't double-darken. Repeated `multiply` at partial alpha darkens overlaps twice.
- Contact or blob shadows: a small dark ellipse under every figure, independent of the sun (or slightly offset and stretched by it), keeps feet grounded where a sheared shadow is very short (high noon) or absent (night, overcast).
- Self-shadowing on terrain (hills casting onto slopes, cliffs onto lower tiles): on a tile or height grid, march each cell toward the sun in grid steps on the CPU when the sun step changes. Store a per-cell lit/shadow bit or a light byte in the existing light grid (`Tycho.light.Smooth`/`lightMap`). It is not per frame.

### Gaps
- No primary source gives a published "shear matrix for iso sun shadows". The formulas above are derived and should be verified visually in `test/look.js`.
- No shipped 2D game was found documenting side-view sun-cast shadows on back walls. The usual practice seems to be no sun shadows at all in side view (unverified).

## Shading the faces of sprites and tiles by sun direction

### Takeaway
Lambert is linear: I = ambient + diffuse·max(0, n·s). So a sprite lit from a few fixed directions can be blended, and flat-faced iso boxes need only one dot product per face, then a ramp lookup. Keep it pixel art by quantizing to the material's 3–4 tones (cel or banded lighting) and re-printing offscreen per sun step. Per-pixel normal maps need a shader or N pre-baked directions.

### Cited Findings
- Graveyard Keeper: artists paint light from four sides on each sprite and a script merges them into a normal map. Sprite Lamp is mentioned. — [Lazy Bear blog](https://slava.lazybeargames.com/graveyard-keeper-how-the-graphics-effects-are-made)
- Eastward hand-paints a bump map per asset after rebuilding it in 3D, to ensure "the correct lighting performance in-game". — [Game Developer](https://www.gamedeveloper.com/art/eastward-s-creators-share-insights-on-making-pixel-art-adventures)
- Tools: Laigter is free and open source (Windows and Linux). SpriteIlluminator is paid and has paint tools for drawing directly on the normal map plus a lighting preview. Sprite DLight is proprietary and generates bumpy normal maps in one click from existing sprites. Its author compares it against a generic generator that uses the sprite as a height map. — [AlternativeTo: SpriteIlluminator](https://alternativeto.net/software/spriteilluminator); [gamedev.net Sprite DLight thread](https://gamedev.net/forums/topic/663046-sprite-dlight-instant-normal-maps-for-2d-graphics/5194560/); [Laigter on itch.io](https://azagaya.itch.io/laigter/comments?before=17)
- Moreira, Coutinho and Chaimowicz (SBGames 2022) note that 3D normal-map methods applied to pixel art "may not yield correct results due to the style specificities" and compare generators on pixel art. More detail is in `effects_rendering.md`. — [SBC paper](https://sol.sbc.org.br/index.php/sbgames/article/view/23463); [arXiv 2212.09692](https://arxiv.org/pdf/2212.09692v1.pdf)
- Cel shading computes smooth lighting and quantizes it into a few discrete shades, so shadows and highlights become flat blocks. t3ssel8r-style 3D-rendered pixel art relies on it because it narrows the color range, combined with outlines from depth, normal and color. — [Kyriota: Unity pixelated art style in URP](https://kyriota.github.io/2022/08/02/UnityPixelatedArtStyleInURP/); [thecodecofficial: pixel art from 3D](https://thecodecofficial.github.io/Blog/PixelArt/)
- Children of Morta upscales sprites about 4x so lighting runs at a finer resolution than the art. That trades pixel purity for smooth light. — [TechRaptor](https://techraptor.net/content/how-dead-mage-created-the-art-for-children-of-morta)
- Hue shifting: shadows move from a yellow base toward red and then purple. Selective outlines go lighter where light hits and darker in shadow. — [pixnote: shading](https://pixnote.net/en/learn/shading)

### Inferences
- **Iso boxes and voxel faces (pre-bake, no shader).** Each visible face has a constant normal: top n = (0,0,1), and the two front walls have horizontal normals at azimuths φL and φR. Brightness: top = sin e; wall = cos e·cos(A − φ), clamped at 0. Map each to a tone index, idx = round(clamp(I_amb + I_dif·(n·s), 0, 1)·(T−1)), where T is the tones per material (3–4 per the house rules). If tiles are painted with a per-pixel face ID (top, left, right, plus maybe edge highlight), re-lighting is a pure palette remap: re-print the tile through `Ink` with each face's ramp row chosen for the current sun step. As the sun passes, the left and right walls swap which is lit, the top dims toward dusk, and at night everything sinks to the shadow ramp plus a cool moon ramp.
- **Four-direction blending (Sprite Lamp / Graveyard Keeper inputs as a runtime trick).** Since n·s = nx·sx + ny·sy + nz·sz, a sprite painted lit from +x, −x, +y and front can be relit for any sun by a weighted sum of the paintings, drawn as `drawImage` with alpha or the 'lighter' (additive) blend. Clamping and banding break linearity, and blending produces off-palette colors. So use this to bake per sun step offscreen, then quantize back to the 8 inks; don't do it per frame.
- **Normal maps in Tycho.** Per frame they need `gpu.program`/`lightPass` with a stepped (banded) Lambert. For the stand-in, bake each normal-mapped sprite at N azimuths × M elevations (for example 8×3 = 24 variants, quantized to the palette) at load or on sun-step change. Generate normals from shape (a bevel or distance-transform height and then a Sobel filter) rather than from brightness, because the paper above found brightness-based generators misbehave on pixel art.
- **Rim light.** A 1 px line of the light ink on the sprite edge facing the sun: where alpha(x+dx, y+dy) = 0 for the 2D screen projection of the sun direction (dx, dy), pixel (x, y) gets a rim. Bake it per sun step, the same as the shadow. It is strongest at low sun (golden hour, backlit), and the moon gets a cool rim at night. Lodestar's `spriteRim` (see `local_games_and_tycho.md`) is a starting point.
- **Banding.** Use 2 or 3 light bands, not continuous light, so the shading reads as hand-painted. Add a hue shift per band (warm lights, violet darks), which Elsewhere's palettes already encode.

### Gaps
- Primary docs for Sprite DLight, Laigter and SpriteIlluminator (exact algorithms, height-to-normal methods) were not fetched. The tool descriptions above come from listings and forum posts.
- No published source was found on how Sea of Stars quantizes its dynamic light to stay pixel art.

## Sky and ambient color through the day

### Takeaway
Games don't run physical sky models for pixel art. They key a small table (4–10 phases: night, blue hour, golden hour, day, plus moon) on time or, better, on sun elevation. Each phase holds sky gradient stops, an ambient multiply color, shadow ink and alpha, and either a color-grade LUT (Graveyard Keeper's 10, Don't Starve's day/dusk/night/full_moon cubes) or, for a true indexed palette, a palette remap row ("U is color, V is time"). Coherent nights come from hand-designed night palettes, not from darkening day colors.

### Cited Findings
- Golden hour by solar elevation: definitions vary between 0° to 6°, 0° to 10°, −4° to +6°, and (timeanddate.com) −6° to +6°. Light is "redder and softer", about 3,500 K versus about 5,500 K at midday, with lower contrast. Blue hour: the sun is about 3° to 10° below the horizon, the light is mostly blue indirect light, and "There are no sharp shadows". — [Wikipedia: Golden hour](https://en.wikipedia.org/wiki/Golden_hour_(photography))
- Hosek-Wilkie is described as the most realistic skylight model used in real-time renderers (a developer's opinion). Blender removed Preetham after adopting Hosek-Wilkie. Live for Speed uses Hosek-Wilkie for direction-dependent sky diffuse and for sun color by sun position. — [Lost Squad devlog (ModDB)](https://www.moddb.com/games/lost-squad/news/lost-squad-winter-2016-update-day-two-procedural-sky-rendering-with-source); [Blender bf-cycles list](https://lists.blender.org/pipermail/bf-cycles/2016-April/002661.html); [Live for Speed report](https://Lfs.net/report-jul2019); [Hosek and Wilkie, SIGGRAPH 2012](https://history.siggraph.org/?p=110574)
- Graveyard Keeper: 10 LUTs across the day, made by grading screenshots, plus an ambient gradient that goes dimmer and bluer at night. — [Lazy Bear blog](https://slava.lazybeargames.com/graveyard-keeper-how-the-graphics-effects-are-made)
- Don't Starve: day, dusk, night and full_moon colour cubes, blended on phase changes. — [Klei forums](https://kleiforums.com/forums/topic/165348-guide-making-a-custom-colour-cube/); [DST API mirror](https://vietnd69.github.io/dst-api-webdocs/docs/game-scripts/components/colourcube)
- Stardew: one global `outdoorLight` color scaled between dusk thresholds; rain swaps in `ambientLight`. — [forum decompile](https://community.playstarbound.com/threads/request-better-night-lighting.108239/)
- Indexed palette swapping: store sprites as grayscale indexes and look up a palette texture or uniform array. Full 3D LUTs are heavy (a 256³ table needs a 4096×4096 texture, which "mobile still really don't like"). For time of day, make the palette texture 2D with U = color index and V = time, with gradients hand-designed per time. — [pvigier: palette swapping with shaders](https://pvigier.github.io/2019/10/06/palette-swapping-with-shaders.html); [Yanrishatum gist](https://gist.github.com/Yanrishatum/86794e9e663a7e343f9ef66e8b0f38ae); [Unreal forums on Ferrari cycling](https://forums.unrealengine.com/t/beautiful-8-bit-pixel-art-scenes-animated-through-color-cycling/35110)
- Godot "Advanced Palette" supports swappable palettes of any size, per-index cycling, and optional blending between steps. — [Godot Shaders: Advanced Palette (Godot 4)](https://godotshaders.com/?p=4331)
- Keyframed time-of-day lighting (colors defined at set times such as 00:00, 12:00 and 18:00, interpolated) is the standard editor pattern. Exposure curves that dim the sky at evening and night increase day/night contrast. — [StarCraft II editor guide](https://s2editor-guides.readthedocs.io/New_Tutorials/02_Terrain_Editor/029_Time_of_Day_Lighting/); [ModDB Atmocity tutorial](https://www.moddb.com/games/atmocity/tutorials/daynight-cycle)
- A Minecraft-style engine keeps a global sky-light value from the time of day separate from block (torch) light, so daylight can change without relighting terrain. — [MC_CPP lighting docs](https://www.mintlify.com/dwnmf/MC_CPP/rendering/lighting)

### Inferences
- **Key the table on sun elevation, not clock hour.** Night (e < −10°), blue hour (−10° to −3°), golden hour (−4° to +8°), day (above +8°), with separate rows for rising and setting if dawn and dusk should differ. Seasons and latitude then change day length and the length of golden hour automatically (Witchbrook-style) with no extra data.
- **Per phase, store:** sky gradient stops (2–4 colors, drawn with the stand-in's gradients over the sky band, or as a vertical gradient over side-view backgrounds), an ambient `tint` [r,g,b] for figures, a light-grid ambient level for `lightMap`, shadow ink and alpha, rim color, and the palette row or LUT index. Interpolate between neighboring phases. For pixel art either snap (a hard palette switch every N minutes) or crossfade two reprints with alpha, as `effects_rendering.md` notes. Interpolate colors in OKLab so dusk doesn't pass through muddy grays (a general color-science practice, not sourced here).
- **Palette remap is the house-style answer.** Elsewhere paints with `Ink` as palette indexes, so a world can be re-printed in an 8-ink night palette designed by hand: shadows shift violet, lit windows and lamps keep warm inks, the sky keeps one or two blues. That is Ferrari's and the "U = color, V = time" approach, and it keeps the 8-ink limit exact, which a multiplied LUT can't. A LUT or tint is the fallback for things that aren't indexed (figures under `tint`).
- **Physical sky models are overkill at 320×180.** A Hosek-Wilkie or Preetham sky can still be useful offline: sample it at a few elevations to seed the gradient table, then quantize to the palette.
- **Night coherence rules:** keep at most 1–2 lit warm inks (windows, fire, the Lantern) against a cool ramp. Drop saturation and contrast in the ground, keep outlines dark, and make moonlight a weak cool directional light (short, soft shadows at the moon's elevation) so forms still read.

### Gaps
- No published LUT sizes or palette tables from a shipped pixel game were found (Graveyard Keeper, Don't Starve, Stardew).
- No source evaluated Preetham versus Hosek-Wilkie for stylized or pixel games specifically.

## Performance tricks

### Takeaway
Everything sun-dependent changes slowly, so bake it in steps. Quantize the sun to K directions, re-bake shadows, face shading and rims offscreen only when the step changes (or spread the work over several frames), and crossfade or hold between steps. Per frame, draw a few affine `drawImage` shadows, one ambient tint or lightMap, and a sky gradient. That is all stand-in-safe.

### Cited Findings
- Graveyard Keeper reuses about ten generic shadow sprites across all objects, caps shadows at four per object, and finds the nearest three lights in a script, not the shader. — [Lazy Bear blog](https://slava.lazybeargames.com/graveyard-keeper-how-the-graphics-effects-are-made)
- Pixel 3D's web build uses a time-of-day slider over prerendered frames instead of real-time lighting. — [itch.io devlog](https://fcidade.itch.io/pixel-3d-godot-shader/devlog/1713028/pixel-3d-is-out)
- Gobs and Gods notes that prebaked shadows enlarge textures (more GPU memory). Its runtime shader costs one extra texture read and a slightly larger quad. Multi-part sprites are rendered once into a viewport (updated only when visible), and the shader runs on that. — [Gobs and Gods](https://www.gobsandgods.com/blog/shadows-2d.html)
- Horizon maps are the fastest terrain self-shadowing. Blending several shadow maps approximates intermediate sun angles. — [GameDev.net](https://gamedev.net/forums/topic/351505-terrain-self-shadows/3309444/)
- A palette-cycling canvas renderer precomputes which pixels reference animated entries and redraws only those, which ran on an iPhone 3GS. — [EffectGames](http://www.effectgames.com/effect/article-Old_School_Color_Cycling_with_HTML5.html)
- Full 3D LUTs are VRAM-heavy on mobile; palette rows are cheap. — [Yanrishatum gist](https://gist.github.com/Yanrishatum/86794e9e663a7e343f9ef66e8b0f38ae)
- A global sky-light term separate from local light lets the time of day change without recomputing terrain light. — [MC_CPP lighting docs](https://www.mintlify.com/dwnmf/MC_CPP/rendering/lighting)

### Inferences
- **Sun steps.** With 16 azimuth × 4 elevation steps over a day, the sun crosses a step every ~20–45 game-minutes. Each crossing re-bakes (a) per-object shadow canvases (one sheared `drawImage` into a small offscreen canvas, then palette-snap), (b) iso tile face remaps (a re-print through `Ink`), (c) rim variants. Amortize across frames: bake the next step in the background while drawing the current one, then crossfade over about 0.5 s or snap.
- **Shadow atlas.** Bake all K steps of each shadow-casting sprite into one atlas at load (K × the sprite's size). Per frame, choose the step and `drawImage` the sub-rect: no transforms, perfectly crisp. Memory scales with the number of distinct casters, but Graveyard Keeper's "about ten generic shadows" shows a few blobs, poles, trees and boxes cover most props.
- **Low-res shadow grid.** For terrain self-shadow and building shadows over terrain, keep a per-cell shadow byte in the existing light grid (4 px cells, as in White Dragon's `lightMap`). Recompute it by grid ray march only on sun-step change, and let `Tycho.light.Smooth`/`lightMap` multiply it over the scene in one pass.
- **Dynamic only what moves.** Static props use baked shadows. Only figures (the traveler, people) get per-frame sheared shadows, and that's a handful of `drawImage` calls with `setTransform`.
- **Day/night crossfade** (two reprints, alpha) costs one extra full-screen `drawImage` during transitions only.
- **What needs shaders:** per-pixel normal-mapped Lambert at runtime, real shadow maps with alpha-tested casters (HD-2D), screen-space contact shadows, per-frame height-field ray marching, per-pixel LUT grading of non-indexed content. On Tycho these go through `gpu.program`/`lightPass`. Everything else in these notes pre-bakes.

### Gaps
- No measured numbers were found for any shipped pixel game's shadow or lighting cost on phones.

## The sun's path itself: a solar position model good enough for games

### Takeaway
Three equations are enough: declination from day of year (a cosine fit, about 2° error), hour angle at 15° per hour from solar noon, then elevation by sin α = sinΦ·sinδ + cosΦ·cosδ·cos h and azimuth by an atan2 form. Sunrise and sunset come from cos h₀ = −tanΦ·tanδ, which gives season-dependent day length for free. Games can also simply fake an arc, but this model costs only a few trig calls per sun step.

### Cited Findings
- Elevation and zenith: cos θs = sin αs = sinΦ·sinδ + cosΦ·cosδ·cos h, where Φ is latitude, δ is declination and h is the hour angle in local solar time. At solar noon, θs = Φ − δ. Refraction is neglected. — [Wikipedia: Solar zenith angle](https://en.wikipedia.org/wiki/Solar_zenith_angle)
- Sunrise and sunset hour angle: cos h₀ = −tanΦ·tanδ. h = 0 at solar noon and ±180° at midnight. — [Wikipedia: Solar zenith angle](https://en.wikipedia.org/wiki/Solar_zenith_angle)
- Azimuth (north-clockwise convention): cos φs = (sinδ·cosΦ − cos h·cosδ·sinΦ)/sin θs, giving 0–180° in the morning (h < 0) and 180–360° in the afternoon. Sine form: sin φs = −sin h·cosδ/sin θs. atan2 form (Zhang et al. 2021): Sx = cosδ·sin(λs−λo), Sy = cosΦ·sinδ − sinΦ·cosδ·cos(λs−λo), Sz = sinΦ·sinδ + cosΦ·cosδ·cos(λs−λo). Then zenith = acos(Sz) and azimuth = atan2(Sx, Sy) (north-clockwise), with λs = −15·(T_GMT − 12 + E_min/60). — [Wikipedia: Solar azimuth angle](https://en.wikipedia.org/wiki/Solar_azimuth_angle)
- Declination, simple: δ = −23.44°·cos[(360°/365)·(N + 10)], where N is the day of the year (0 at 1 January). It overestimates by up to +1.5° near the September equinox, with up to 2.0° total error. Better: δ = −arcsin{0.39779·cos[0.98565°(N+10) + 1.914°·sin(0.98565°(N−2))]}, with errors under ±0.2°. Almanac method (about 0.01° for 1950–2050): L = 280.460° + 0.9856474°·n, g = 357.528° + 0.9856003°·n, λ = L + 1.915°·sin g + 0.020°·sin 2g, ε ≈ 23.439°, δ = arcsin(sin ε·sin λ). — [Wikipedia: Position of the Sun](https://en.wikipedia.org/wiki/Position_of_the_Sun)
- The hour angle runs at 15° per hour: λs uses −15 per hour of offset from 12:00. — [Wikipedia: Solar azimuth angle](https://en.wikipedia.org/wiki/Solar_azimuth_angle)
- Witchbrook's day length varies with the season. — [PC Gamer](https://www.pcgamer.com/witchbrook-release-date-gameplay-trailer-what-we-know)

### Inferences
- **Game version (derived from the formulas above), in degrees:**
  - δ = −23.44·cos(360/365·(N+10));
  - h = 15·(hour − 12), using a game clock in solar time with no equation of time;
  - sin e = sinΦ·sinδ + cosΦ·cosδ·cos h;
  - A = atan2(−sin h·cosδ, sinδ·cosΦ − cos h·cosδ·sinΦ), normalized to 0–360 north-clockwise (the tangent form, which avoids the quadrant ambiguity of the arccos form);
  - day length = 2·acos(−tanΦ·tanδ)/15 hours (clamp the argument to [−1, 1] for polar day or night).
  - The moon can be faked as the sun's position at h + 180° with a small offset, or computed the same way with its own declination. A game rarely needs better.
- **Map world north to screen.** Choose which screen direction is "north" per quest (in iso, often up-right). Rotate A into the projection's ê/n̂ frame before the shadow formula. In the northern hemisphere at mid latitudes the noon sun is due south at elevation 90° − Φ + δ (for example Φ = 45°: about 21.5° at the winter solstice and about 68.5° at the summer solstice). So noon shadows point north (up-screen, behind objects, in 3/4 and top-down views with north up), which reads naturally because shadows tuck behind sprites. A designer may prefer a "stage sun" (latitude and screen-north chosen so shadows fall down-right, the pixel-art convention of light from the upper left). The model allows that by choosing Φ and the screen-north rotation per world.
- **Per-world flavor at no cost:** a quest's world can declare its latitude (a polar world with a sun that never sets, a tropical one where the sun passes overhead and shadows vanish at noon), its season, and its day length. All of it is deterministic from the save's clock, which fits Elsewhere's determinism rule (no wall clock).
- **Quantize the output (A, e) to the bake steps** from the performance section. A continuous model feeding discrete steps keeps both correctness and crisp pixels.

### Gaps
- None of the games surveyed document using a real solar model; most appear to use a simple scripted arc or phase table (inferred from their phase-keyed systems, not confirmed).
- The equation of time (up to about ±16 minutes) and refraction are ignored here. The fetched sources give the formulas but not a game-oriented error analysis.
