# Moving the games onto Tycho

The record of the move planned in [the Tycho plan](https://claude.ai/artifact/NrDPrQpmBQpjMmQPUEAgWu): what moved in each phase, what changed in each game, and what's left. Each game does the work on a branch named `tycho` and keeps passing its own tests; the branches merge into `main` together when the move is done.

| Phase | What moves | State |
|---|---|---|
| 0 | The repository: Tyrell merged in with its history; the build, CI, license, test kit; golden tests in the games | Done |
| 1 | Core: seed, math, color, loop | In progress |
| 2 | save, pwa, dev, loader | |
| 3 | The renderer: view, gpu, light, post | |
| 4 | Pixels: sprite, figure, paint, fx, life, sky | |
| 5 | World: grid, collide (the shapes and the space in one), move, path, gen | grid, collide, move and path in; gen next |
| 6 | Play: input, interact, items, craft, trade, build, mine, guide | |
| 7 | The rest of the shell: ui, hud, map, audio, inspect | |
| 8 | Tyrell: Voice, Delos, skills, conditions (Athelas), novelty and wishes, production | Tyrell done; the White Dragon's talk next |
| 9 | Merryfolk's minds onto Tyrell | |
| 10 | The bridge | |

## Phase 0: the repository

- Tyrell's repository came in with its history, rewritten so every file sits under `tyrell/` (so `git log tyrell/src/core/world.ts` follows it back). Its package, build script and CI were folded into the root's: one `package.json`, one version (2.0.0, after Tyrell's 1.1.0), one build, one CI. The old `doctorallen/tyrell` repository is left as it was.
- The build makes three libraries (`tycho`, `tyrell`, `tycho-minds`), each as a global script, an ES module and a CommonJS module with declarations, plus the service worker and the test kit, and checks the layers' rule first. Tyrell's build is byte for byte what it was apart from its banner and version.
- MIT license.
- The test kit runs on Playwright or on puppeteer-core with `$CHROME`. The games keep puppeteer-core in their `package.json` for now (their lockfiles couldn't be regenerated where this work was done), so CI drives their tests through puppeteer-core and local runs through Playwright, with the same tests.
- CI builds and tests Tycho, then runs each game's own tests with the new build in place of its `vendor/tycho`.

## Phase 5: the world

- `Tycho.grid`, `Tycho.collide`, `Tycho.move` and `Tycho.path` ([world.md](world.md)). The plan's shapes and space became one part, `collide`: a `Space` holds the shapes (boxes, ellipses, the sides, walkways and stairs, ladders) and grids' tiles, and answers for all of them. `test/world.test.mjs` holds each to the code it came from, kept in the test: the White Dragon's on six of its levels as they're built (`test/fixtures/wd-levels.json`) and a level made to have ceilings and ledges, Lodestar's on floors made like its own, Merryfolk's A* on maps of its kind. Each game also recorded traces from its old code before anything moved (`test/traces.js`, `test/traces.json`) and replays them through the new, frame by frame.
- The White Dragon: `World.hits`, `World.way` and `World.ladderAt` ask the level's space (`L.space`, made when the level first loads: its solids, the props that block until they're done, its sides, its walkways and stairs, its ladders), and the runner's step is a `Tycho.move.Platform` with `T.player`'s numbers (the stick, the dev speed and what Use is busy at passed in; taking a ladder lets go of the machine, as before). Its 14 traces (14,574 frames: walls, every pace, hops and jumps, stairs, walkways jumped up through and dropped through, coyote jumps, ladders up, down, jumped off and let go of, long falls, and seeded random input in six places) replay bit for bit. Stayed in the game: `Town.route`, which is bound to the census and the residents' minds and will be reworked with them (`Tycho.path.Routes` is the graph router for that), and the people's footing (`Actors.ground` asks the World as before; residents are placed by the clock and the minds, not moved against the level).
- Lodestar: a floor's tiles and ore are a flat grid over its own arrays (`f.grid`, made by `floorSpace` as soon as a floor's tiles are), and `floorTile` is its lookup; `rockAt` is those tiles felt along the smooth line (`f.rock`, with the floor's noise), `bodyHits` and `bodyInRock` ask the floor's space (`f.space`), `moveBody` is `Tycho.move.topdown` and `floorDistances` is `Tycho.path.distances`. The one tile changed in play (a storm charging a vein) is set through the grid. Generation's golden hashes are unchanged; its 18 traces (8,688 frames on the surface, the Deep and a ruin, bodies of 4, 6 and 9 px walked into walls eight ways, round curves, wandering and dashing, worked out of a wedge) and its probes (the wall line on both its tables, the body test on a lattice, flow fields from five caverns) replay bit for bit. Stayed in the game: `clearLine`, the enemies' sight, sampled every 4 px through square tiles (`space.ray` is exact, so it would change what they see), and `wayToPlayer`, the enemies' own eight-way reading of the flow field.
- `path.distances` stays inside the grid where Lodestar's went round to the next row at the left and right edges; that never mattered, as its edge is always solid rock.
- Merryfolk isn't touched (it's being changed elsewhere): `Tycho.path.AStar` is its `findPath`, step for step, the game giving the costs, ready when it moves.
- Speed, measured in Node by CPU time on a 320 × 320 floor: the wall line 102 ms against the game's 131 for the same points, the body test 27 against 30, ten flow fields over open ground 28 against 62 (a flat grid reads the game's arrays straight; the field's queue is kept between searches).
- Not yet: gen, liquid and tilelight; a big grid's chunks let go of and made again (its changes are kept by chunk for that); and no game saves a grid's changes yet (Lodestar's world is made whole from its seed and keeps nothing of its tiles in a save).
