# Moving the games onto Tycho

The record of the move planned in [the Tycho plan](https://claude.ai/artifact/NrDPrQpmBQpjMmQPUEAgWu): what moved in each phase, what changed in each game, and what's left. Each game does the work on a branch named `tycho` and keeps passing its own tests; the branches merge into `main` together when the move is done.

| Phase | What moves | State |
|---|---|---|
| 0 | The repository: Tyrell merged in with its history; the build, CI, license, test kit; golden tests in the games | Done |
| 1 | Core: seed, math, color, loop | Done: all three games |
| 2 | save, pwa, dev, loader | Done: the White Dragon and Lodestar; Merryfolk's pwa (it's installable now), its save and dev flags after phase 9 |
| 3 | The renderer: gpu, light, post | Done: all three games (Merryfolk's first GPU path) |
| 4 | Pixels: sprite, figure, paint, fx, life, sky | |
| 5 | World: grid, shapes, space, collide, move, path, gen | |
| 6 | Play: input, interact, items, craft, trade, build, mine, guide | |
| 7 | The rest of the shell: ui, hud, map, audio, inspect | |
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

## Phase 8: Tyrell's new parts

- Voice (conversations), Delos (genomes inherited through births), skills that grow with practice, Athelas (conditions that run a course), pastimes that pall and wishes that pull, and production in Ceres. A test holds that a world using none of them is byte for byte what it was.
- The White Dragon's talk moved onto Voice (`js/talk.js`): what's theirs raised first (what they saw, what they heard, a job, a hand-back, a lead), then subjects, each answer with an approach that lands well or badly by the listener. The smoke test takes Ozzy's job through it.

## Phase 10: the bridge

- `dist/tycho-minds.js` (`Tycho.minds`, [minds.md](minds.md)): the clock (the game's time driving Tyrell's, back through time walk, remade past what Esper remembers), the minds in the save, seats, presence (who might be in a level, once per doing), travel times, witnesses and reports. It takes only shapes from Tyrell, so it builds and tests on its own.
- The White Dragon's `city.js` uses all of it; what stayed in the game is its own: the census, routines, the route on screen, the reactions' words.
