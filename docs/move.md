# Moving the games onto Tycho

The record of the move planned in [the Tycho plan](https://claude.ai/artifact/NrDPrQpmBQpjMmQPUEAgWu): what moved in each phase, what changed in each game, and what's left. Each game does the work on a branch named `tycho` and keeps passing its own tests; the branches merge into `main` together when the move is done.

| Phase | What moves | State |
|---|---|---|
| 0 | The repository: Tyrell merged in with its history; the build, CI, license, test kit; golden tests in the games | Done |
| 1 | Core: seed, math, color, loop | Done: all three games |
| 2 | save, pwa, dev, loader | Done: the White Dragon and Lodestar; Merryfolk's pwa (it's installable now), its save and dev flags after phase 9 |
| 3 | The renderer: gpu, light, post | Done: all three games (Merryfolk's first GPU path) |
| 4 | Pixels: sprite, figure, paint, fx, life, sky | sprite, paint and fx in, the White Dragon and Lodestar on them; figure, life and sky stay in the games |
| 5 | World: grid, collide (the shapes and the space in one), move, path, gen | grid, collide, move and path in; gen next |
| 6 | Play: input, interact, items, craft, trade, build, mine, guide | |
| 7 | The rest of the shell: ui, hud, map, audio, inspect | audio, inspect and ui in, the games on them; hud and map stay the games' |
| 8 | Tyrell: Voice, Delos, skills, conditions (Athelas), novelty and wishes, production | Done; the White Dragon talks on Voice |
| 9 | Merryfolk's minds onto Tyrell | |
| 10 | The bridge | In: the White Dragon uses it |

## Phase 0: the repository

- Tyrell's repository came in with its history, rewritten so every file sits under `tyrell/` (so `git log tyrell/src/core/world.ts` follows it back). Its package, build script and CI were folded into the root's: one `package.json`, one version (2.0.0, after Tyrell's 1.1.0), one build, one CI. The old `doctorallen/tyrell` repository is left as it was.
- The build makes three libraries (`tycho`, `tyrell`, `tycho-minds`), each as a global script, an ES module and a CommonJS module with declarations, plus the service worker and the test kit, and checks the layers' rule first. Tyrell's build is byte for byte what it was apart from its banner and version.
- MIT license.
- The test kit runs on Playwright or on puppeteer-core with `$CHROME`. The games keep puppeteer-core in their `package.json` for now (their lockfiles couldn't be regenerated where this work was done), so CI drives their tests through puppeteer-core and local runs through Playwright, with the same tests.
- CI builds and tests Tycho, then runs each game's own tests with the new build in place of its `vendor/tycho`.

## Phase 1: the core

- `Tycho.seed` (hashes, value noise, `mulberry32`, Lodestar's `Rng`, `fxRand`), `Tycho.math`, `Tycho.color` (mixing, shading, the painter's ramps), `Tycho.loop` (`Stepper` for fixed steps, `Samples` for frame times, `Governor` for the quality the White Dragon lowers when frames are slow). Each game's own copies went, and `test/core.test.mjs` holds each to the game's original, value for value.
- Each game names what it uses near the top of its first script (`const { hash, noise, Rng } = Tycho.seed;`), so the rest of its code reads as it did. The golden tests (every level's shape and painting, the sprites, the pictures) didn't move.

## Phase 2: the shell's first parts

- `Tycho.save`: storage that never throws, and a `Store` for a game's one save (old keys deleted, renamed ids put right, a save of another version started over, one that can't be read kept aside). The White Dragon and Lodestar keep their saves on it, under the same keys, so a save from before reads as it did.
- `Tycho.pwa`: the installable app (a new worker found when the game comes to the foreground and every 15 minutes; then save and reload, or ask). The service worker is `dist/tycho-sw.js`; each game's `sw.js` is a few lines naming what else to keep. Merryfolk became installable with it: a manifest, icons drawn from one of the valley's trees, the worker, `js/pwa.js` and `test/pwa.js`. Opened from a file it still plays as a page.
- `Tycho.dev` (the query, flags in storage) and `Tycho.loader` (loading in slices between frames: Lodestar's loading screen).
- Merryfolk keeps its own save and dev flags until its minds have moved (phase 9), which rewrites both.

## Phase 3: the renderer

- `Tycho.gpu` is Lodestar's GPU design made general: a batcher with a stand-in for the 2D context (`Ctx`: fillRect, drawImage, alpha, the blend modes, save and restore, transforms, a rect clip, linear and radial gradients), an atlas of every picture drawn, textures for a painted ground, the light map's multiply, a tint per quad, bloom, and `read()` for tests. `Tycho.light` is the White Dragon's smooth light model, and `Tycho.post` its blur finish (bloom, reflections, the fade).
- Lodestar's `js/gpu.js` is now a thin adapter over it; the White Dragon's own WebGL path (`js/gl.js`) went; Merryfolk had none and draws the valley on the GPU for the first time (about 6,800 quads in 3 to 6 draws a frame).
- Each game draws the same frame both ways in a test (`test/gpu.js`, Lodestar's `test/gllight.js`) and holds the GPU to the 2D picture within a few tones; the golden pictures stay the 2D path's.
- One change a player could see: the White Dragon's old GL path didn't dim the neon's glow by day (its alpha wasn't premultiplied); the new path dims it as the 2D path always did.

## Phase 4: pixels

The games' shared picture-making, moved in with every picture unchanged. Each part is held to the games' originals, kept in its test as they were: `test/pixels.test.mjs` without a browser (the painting itself, through a stand-in canvas), `test/audio.js` in a page (the canvas work: tinting, flipping, enlarging, outlines on real canvases; `npm run test:browser`, run by hand, since CI's build has no browser).

- **sprite** ([sprite.md](sprite.md)): canvases (the White Dragon's `canvasOf`, Lodestar's `makeCanvas` as `{ read: true, min: 1 }`, Merryfolk's as `{ read: !draw }`), `spriteFrom` (Lodestar's; Merryfolk's is `{ w: rows[0].length }`), `outline` (Lodestar's one ink, or Merryfolk's darkened own colors growing only at need: `{ own: 0.42, grow: 'edge' }`), `tinted`, `flipped`, `flipSprite`, `enlarged`, Merryfolk's `disc` and `ellipse`, Lodestar's letter-grid scalers (Scale2x, Scale3x with fixed letters, 1.5x, any k), and the White Dragon's shape painter as `Shapes` (its Spr: ell, box, limb, cap, shape, poly, parts with shadow lines, the outline), with the finish's ink and strengths as a `look`.
- **paint** ([paint.md](paint.md)): the White Dragon's chunked lazy painter: the pixel buffer `Pix` (put, tint, area, block; flat or stroked as an option, where the game had a constant), `strokeRow`, `blockV`, operations with boxes and seeds run only for the chunks they touch, the chunk cache (`Chunks`, `Painter`: get, ahead within a budget, an optional size with the longest unused let go). Flat, an area no longer works out strokes it never reads: the same pixels, less work.
- **fx** ([fx.md](fx.md)): lists of effects that run out (Lodestar's `tick`, the White Dragon's `age`), particles (`move`: drag, gravity, a bounce off the floor; `Particles`), the White Dragon's `sparks` and `burst`, and where a rising line of text is (`rise`, its gains).

In the games:

- The White Dragon: `Spr` is `Tycho.sprite.Shapes`, `flipSprite` and `canvasOf` Tycho's; `paint.js` keeps its materials and painters on Tycho's `Pix` (a subclass that paints flat) and its chunk cache is a `Tycho.paint.Painter`; `strokeRow` and `blockV` are gone from it. Its life's puffs and splashes age by `Tycho.fx.age`, and the HUD's gains rise by `Tycho.fx.rise`. Every value in its golden test (every level's painting, every sprite, the frames) is the same. Its sparks (`Fx` in `player.js`) can go onto `Tycho.fx.Particles`, `sparks` and `burst` once that file is free (another branch was working in it).
- Lodestar: `makeCanvas`, `spriteFrom`, `outlined`, `tinted`, `flipped`, `flippedSprite`, `artFineCanvas` and the letter-grid scalers are Tycho's; its cast effects tick and move by `Tycho.fx`. Its painted style (rock, shadows, `PntSpr`, its pixel buffers) stays its own, as decided. 1880 of its pictures (the Kindler, Wick, every biome's creatures, the outpost, the nodes, the caches a first frame fills) were compared before and after: all the same.
- Merryfolk is unchanged (another branch was working in it); its canvas helpers are reachable by the options above when it moves.

Left in the games, for now: the figures (the White Dragon's `person`, whose machinery, the gait and the arms' bend, is bound up with its looks), the ambient life (each game's critters, adverts, traffic and litter are its own) and the skyline.

## Phase 5: the world

- `Tycho.grid`, `Tycho.collide`, `Tycho.move` and `Tycho.path` ([world.md](world.md)). The plan's shapes and space became one part, `collide`: a `Space` holds the shapes (boxes, ellipses, the sides, walkways and stairs, ladders) and grids' tiles, and answers for all of them. `test/world.test.mjs` holds each to the code it came from, kept in the test: the White Dragon's on six of its levels as they're built (`test/fixtures/wd-levels.json`) and a level made to have ceilings and ledges, Lodestar's on floors made like its own, Merryfolk's A* on maps of its kind. Each game also recorded traces from its old code before anything moved (`test/traces.js`, `test/traces.json`) and replays them through the new, frame by frame.
- The White Dragon: `World.hits`, `World.way` and `World.ladderAt` ask the level's space (`L.space`, made when the level first loads: its solids, the props that block until they're done, its sides, its walkways and stairs, its ladders), and the runner's step is a `Tycho.move.Platform` with `T.player`'s numbers (the stick, the dev speed and what Use is busy at passed in; taking a ladder lets go of the machine, as before). Its 14 traces (14,574 frames: walls, every pace, hops and jumps, stairs, walkways jumped up through and dropped through, coyote jumps, ladders up, down, jumped off and let go of, long falls, and seeded random input in six places) replay bit for bit. Stayed in the game: `Town.route`, which is bound to the census and the residents' minds and will be reworked with them (`Tycho.path.Routes` is the graph router for that), and the people's footing (`Actors.ground` asks the World as before; residents are placed by the clock and the minds, not moved against the level).
- Lodestar: a floor's tiles and ore are a flat grid over its own arrays (`f.grid`, made by `floorSpace` as soon as a floor's tiles are), and `floorTile` is its lookup; `rockAt` is those tiles felt along the smooth line (`f.rock`, with the floor's noise), `bodyHits` and `bodyInRock` ask the floor's space (`f.space`), `moveBody` is `Tycho.move.topdown` and `floorDistances` is `Tycho.path.distances`. The one tile changed in play (a storm charging a vein) is set through the grid. Generation's golden hashes are unchanged; its 18 traces (8,688 frames on the surface, the Deep and a ruin, bodies of 4, 6 and 9 px walked into walls eight ways, round curves, wandering and dashing, worked out of a wedge) and its probes (the wall line on both its tables, the body test on a lattice, flow fields from five caverns) replay bit for bit. Stayed in the game: `clearLine`, the enemies' sight, sampled every 4 px through square tiles (`space.ray` is exact, so it would change what they see), and `wayToPlayer`, the enemies' own eight-way reading of the flow field.
- `path.distances` stays inside the grid where Lodestar's went round to the next row at the left and right edges; that never mattered, as its edge is always solid rock.
- Merryfolk isn't touched (it's being changed elsewhere): `Tycho.path.AStar` is its `findPath`, step for step, the game giving the costs, ready when it moves.
- Speed, measured in Node by CPU time on a 320 × 320 floor: the wall line 102 ms against the game's 131 for the same points, the body test 27 against 30, ten flow fields over open ground 28 against 62 (a flat grid reads the game's arrays straight; the field's queue is kept between searches).
- Not yet: gen, liquid and tilelight; a big grid's chunks let go of and made again (its changes are kept by chunk for that); and no game saves a grid's changes yet (Lodestar's world is made whole from its seed and keeps nothing of its tiles in a save).

## Phase 7: the rest of the shell (audio, inspect, ui)

- **audio** ([audio.md](audio.md)): Lodestar's sound engine, made general: `Engine` (the graph: two buses with sends to an echo, the chain and the limiter; the settings as levels; cues by name with gaps, a cap on voices, distance and pan from a listener; the first tap and the hidden page), the voices (`tone`, `noise`, `fm`, `stack`, `env`), `Bank` (sounds rendered ahead in an `OfflineAudioContext`, variants, the saturation and the reverb's impulse, a start paced by a loader's slices, idle rendering, `want` and `drop`) and `Music` (drones kept running, noise bands, targets set only when they change, a tick of its own, events now and then, the dip), all drawing from one stream of the sound's own (`Rand`, Lodestar's xorshift). Every number that makes Lodestar sound like itself is passed in by Lodestar (its cues, its bank's recipes and order, its waves, its chain, space, reverbs and trim); Tycho's defaults are the same numbers. `test/audio.js` traces every Web Audio call Lodestar's sound makes before and after (44,615 of them across 68 cases) and they're the same call for call; the samples agree to Chromium's own rounding. CI's build job now runs it, with Chrome and puppeteer-core.
- **inspect** ([inspect.md](inspect.md)): the White Dragon's Tyrell mode as `Inspector` (the bar, the clock and its time walk, the canvas the game draws its map on with `dot` and `badge`, the side) and `mind(world, id, options)` (the mind alone, as HTML). It reads the world through the shape of Tyrell's `World`, so the shell takes nothing from `tyrell/src`. `test/inspect.test.mjs` holds the mind to the game's original on Rocinante, character for character.
- **ui** ([ui.md](ui.md)): `Toasts` (the White Dragon's short list on game time, redrawn whole, the same words again soon keeping the last one up; Lodestar's elements on their own timers, the same words giving way to the new, hints queued while a screen's open and never shown twice), `Rising` (the White Dragon's lines over a machine), `bind` (buttons by their data attributes: the White Dragon's `panelBind`) and `Acts` (a screen's buttons from one handler: Lodestar's `UI.onTap`, with its confirming tap). `test/ui.test.mjs` plays each game's original beside Tycho's, step for step, on a stand-in for the DOM. Blocking taps after a screen opens is the controls' guard (phase 6, `Tycho.input`), which `Acts` takes as its `guard`.
- **Stayed in the games**: the HUD itself (what each shows, and where: the White Dragon's money, heat, prompt and bubbles over heads, Lodestar's bar, deck and speech) and the maps (the White Dragon's pause map and city map, Lodestar's map by layer): their looks and what they show are each game's, and the shared parts of them are in already (the maps' drag, pinch and tap are `Tycho.input`'s gestures). Lodestar's `UI.onTap` stays as it is for now: its guard lines are being changed on the play branch, so it moves onto `Acts` once that's merged (`new Tycho.ui.Acts({ acts: () => UI.acts, guard: () => Input.guarded(), armed: () => Input.guard(0.25), onAct: () => snd('tap') })`).
- **For Merryfolk, later**: its sound (buses, a reverb, a tone helper, the rain's bed, sleeping while hidden) fits `Engine`, the voices and `Music`'s bands, with its look-ahead tune its own; its single toast is `Toasts` with `most: 1`; its Brain tab becomes `inspect.mind` once its folk are on Tyrell (phase 9).
- **Changed in Lodestar**: `js/audio.js` keeps the mix, the chain's and the space's numbers, the waves and the cues, and makes `Snd` a Tycho engine (`snd`, `sndReady` and the first tap through it); `js/music.js` keeps its layers, phrases, beds and events and the music's own logic (`state`, `update`, `phrase`, `bed`, `fed`, `grow`, `listen`) on a Tycho `Music`; `js/sndbank.js` keeps its layers (`bkSub`, `bkPings`, `bkGrains`, `bkSnap`), elements, Forms, footsteps, opening and order, with `SndBank` a Tycho bank. The smoke test now checks the sound starts on the tap, with the bank rendered while the game loaded.
- **Changed in Lodestar, ui**: `UI.toast`, `showToast`, `pumpToasts` and `UI.show`'s hints are a Tycho `Toasts` (`UI.toasts`); the words, the classes and the CSS that fades them are the game's.
- **Changed in the White Dragon, ui**: `Game.toast` and `Game.gain` go to the HUD's `Toasts` and `Rising` (`Hud.toaster`, `Hud.rising`), and `panelBind` wires its buttons with `Tycho.ui.bind`.
- **Changed in the White Dragon**: `js/tyrellmode.js` is its map (the city's rows, a street's picture with its doors' counts, where everyone is, the summary) on Tycho's inspector, which draws the mind, runs the clock and wires the panel. The panel, the mind and the map are the same as before, pixel for pixel and character for character (compared step by step in a browser).

## Phase 8: Tyrell's new parts

- Voice (conversations), Delos (genomes inherited through births), skills that grow with practice, Athelas (conditions that run a course), pastimes that pall and wishes that pull, and production in Ceres. A test holds that a world using none of them is byte for byte what it was.
- The White Dragon's talk moved onto Voice (`js/talk.js`): what's theirs raised first (what they saw, what they heard, a job, a hand-back, a lead), then subjects, each answer with an approach that lands well or badly by the listener. The smoke test takes Ozzy's job through it.

## Phase 10: the bridge

- `dist/tycho-minds.js` (`Tycho.minds`, [minds.md](minds.md)): the clock (the game's time driving Tyrell's, back through time walk, remade past what Esper remembers), the minds in the save, seats, presence (who might be in a level, once per doing), travel times, witnesses and reports. It takes only shapes from Tyrell, so it builds and tests on its own.
- The White Dragon's `city.js` uses all of it; what stayed in the game is its own: the census, routines, the route on screen, the reactions' words.
