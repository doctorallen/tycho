# Moving the games onto Tycho

The record of the move planned in [the Tycho plan](https://claude.ai/artifact/NrDPrQpmBQpjMmQPUEAgWu): what moved in each phase, what changed in each game, and what's left. Each game does the work on a branch named `tycho` and keeps passing its own tests; the branches merge into `main` together when the move is done.

| Phase | What moves | State |
|---|---|---|
| 0 | The repository: Tyrell merged in with its history; the build, CI, license, test kit; golden tests in the games | Done |
| 1 | Core: seed, math, color, loop | In progress |
| 2 | save, pwa, dev, loader | |
| 3 | The renderer: view, gpu, light, post | |
| 4 | Pixels: sprite, figure, paint, fx, life, sky | sprite, paint and fx in; figure, life and sky stay in the games |
| 5 | World: grid, shapes, space, collide, move, path, gen | |
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

## Phase 4: pixels

The games' shared picture-making, moved in with every picture unchanged. Each part is held to the games' originals, kept in its test as they were: `test/pixels.test.mjs` without a browser (the painting itself, through a stand-in canvas), `test/browser.js` in a page (the canvas work: tinting, flipping, enlarging, outlines on real canvases; `npm run test:browser`, run by hand, since CI's build has no browser).

- **sprite** ([sprite.md](sprite.md)): canvases (the White Dragon's `canvasOf`, Lodestar's `makeCanvas` as `{ read: true, min: 1 }`, Merryfolk's as `{ read: !draw }`), `spriteFrom` (Lodestar's; Merryfolk's is `{ w: rows[0].length }`), `outline` (Lodestar's one ink, or Merryfolk's darkened own colors growing only at need: `{ own: 0.42, grow: 'edge' }`), `tinted`, `flipped`, `flipSprite`, `enlarged`, Merryfolk's `disc` and `ellipse`, Lodestar's letter-grid scalers (Scale2x, Scale3x with fixed letters, 1.5x, any k), and the White Dragon's shape painter as `Shapes` (its Spr: ell, box, limb, cap, shape, poly, parts with shadow lines, the outline), with the finish's ink and strengths as a `look`.
- **paint** ([paint.md](paint.md)): the White Dragon's chunked lazy painter: the pixel buffer `Pix` (put, tint, area, block; flat or stroked as an option, where the game had a constant), `strokeRow`, `blockV`, operations with boxes and seeds run only for the chunks they touch, the chunk cache (`Chunks`, `Painter`: get, ahead within a budget, an optional size with the longest unused let go). Flat, an area no longer works out strokes it never reads: the same pixels, less work.
- **fx** ([fx.md](fx.md)): lists of effects that run out (Lodestar's `tick`, the White Dragon's `age`), particles (`move`: drag, gravity, a bounce off the floor; `Particles`), the White Dragon's `sparks` and `burst`, and where a rising line of text is (`rise`, its gains).

In the games:

- The White Dragon: `Spr` is `Tycho.sprite.Shapes`, `flipSprite` and `canvasOf` Tycho's; `paint.js` keeps its materials and painters on Tycho's `Pix` (a subclass that paints flat) and its chunk cache is a `Tycho.paint.Painter`; `strokeRow` and `blockV` are gone from it. Its life's puffs and splashes age by `Tycho.fx.age`, and the HUD's gains rise by `Tycho.fx.rise`. Every value in its golden test (every level's painting, every sprite, the frames) is the same. Its sparks (`Fx` in `player.js`) can go onto `Tycho.fx.Particles`, `sparks` and `burst` once that file is free (another branch was working in it).
- Lodestar: `makeCanvas`, `spriteFrom`, `outlined`, `tinted`, `flipped`, `flippedSprite`, `artFineCanvas` and the letter-grid scalers are Tycho's; its cast effects tick and move by `Tycho.fx`. Its painted style (rock, shadows, `PntSpr`, its pixel buffers) stays its own, as decided. 1880 of its pictures (the Kindler, Wick, every biome's creatures, the outpost, the nodes, the caches a first frame fills) were compared before and after: all the same.
- Merryfolk is unchanged (another branch was working in it); its canvas helpers are reachable by the options above when it moves.

Left in the games, for now: the figures (the White Dragon's `person`, whose machinery, the gait and the arms' bend, is bound up with its looks), the ambient life (each game's critters, adverts, traffic and litter are its own) and the skyline.

