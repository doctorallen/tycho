# Moving the games onto Tycho

The record of the move planned in [the Tycho plan](https://claude.ai/artifact/NrDPrQpmBQpjMmQPUEAgWu): what moved in each phase, what changed in each game, and what's left. Each game does the work on a branch named `tycho` and keeps passing its own tests; the branches merge into `main` together when the move is done.

| Phase | What moves | State |
|---|---|---|
| 0 | The repository: Tyrell merged in with its history; the build, CI, license, test kit; golden tests in the games | Done |
| 1 | Core: seed, math, color, loop | In progress |
| 2 | save, pwa, dev, loader | |
| 3 | The renderer: view, gpu, light, post | |
| 4 | Pixels: sprite, figure, paint, fx, life, sky | |
| 5 | World: grid, shapes, space, collide, move, path, gen | |
| 6 | Play: input, interact, items, craft, trade, build, mine, guide | input, items and guide in, the White Dragon and Lodestar on them; interact, craft, trade, build, mine to come |
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

## Phase 6: play (input, items, guide)

- **input** ([play.md](play.md)): `Controls`, the controls both games had as one configured part: actions held by keys, on-screen buttons and the bot; presses that wait to be taken (the White Dragon's `useHit`/`jumpHit`, Lodestar's `consumeAct`/`consumeDash`); edges since the game last looked (Lodestar's `hand`); the stick (the White Dragon's square with a dead zone each axis and a second thumb taking over, Lodestar's round one kept inside the deck, with its flick); blocking new presses while a screen is up, letting go of everything when one opens (`block`), and the tap guard (Lodestar's 400 ms). `Gestures`: drag, pinch and tap for the maps (the White Dragon's two maps, which shared their code, and Lodestar's), with each game's tap rule and pinch by options. `test/play.test.mjs` plays each game's old controls and gestures and its new ones side by side with the same events.
- **items**: bags by count (the White Dragon's pockets, Lodestar's motes carried and banked), things of their own with ids (the White Dragon's parts), slots, gear, and `group`, the counted view under the White Dragon's shelf and the bench's choices. Their words, prices and HTML stay the games'.
- **guide**: the White Dragon's tutorial step machine; its steps, card, marks and pulsing stay the game's.
- **Changed in the White Dragon**: `input.js` is a thin `Input` over Tycho's controls, refreshed each step by `apply()`; the maps' drag and pinch are Tycho's gestures (the wheel is still the game's); `Game`'s pockets, the salvage sums and the scrap bin use `items.bag`; `Parts.make`/`take`/`have` use `items.things` and `Parts.stock`/`choices` `items.group`; `Tutorial` runs on a guide.
- **Changed in Lodestar**: `input.js` is a thin `Input` over Tycho's controls, and the screens' tap guard is the controls' (`Input.guard`, `Input.guarded`, from `UI.show`, a confirm button arming and the map's tap); the map's drag, pinch and tap are Tycho's gestures; the motes carried (`d.motes`) are a bag. Its equipment (`Save.data.equip`: one rig, never changed or saved) and the unused `d.cargo` stayed as they were: neither is an inventory any more.
- Where the games' own controls disagreed with themselves, Tycho's do the plainer thing, the same in both games: two keys for one action (the White Dragon let go of the action when either came up), two fingers on one button (it let go when either lifted), keys and thumbs at once (the last to speak won), a third finger on a map (it panned) and a finger the browser cancelled on a map (it stayed down). None of these comes up playing on one device.

