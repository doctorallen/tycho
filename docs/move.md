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
| 6 | Play: input, interact, items, craft, trade, build, mine, guide | |
| 7 | The rest of the shell: ui, hud, map, audio, inspect | audio, inspect and ui in, the games on them; hud and map stay the games' |
| 8 | Tyrell: Voice, Delos, skills, conditions (Athelas), novelty and wishes, production | Tyrell done; the White Dragon's talk next |
| 9 | Merryfolk's minds onto Tyrell | |
| 10 | The bridge | |

## Phase 0: the repository

- Tyrell's repository came in with its history, rewritten so every file sits under `tyrell/` (so `git log tyrell/src/core/world.ts` follows it back). Its package, build script and CI were folded into the root's: one `package.json`, one version (2.0.0, after Tyrell's 1.1.0), one build, one CI. The old `doctorallen/tyrell` repository is left as it was.
- The build makes three libraries (`tycho`, `tyrell`, `tycho-minds`), each as a global script, an ES module and a CommonJS module with declarations, plus the service worker and the test kit, and checks the layers' rule first. Tyrell's build is byte for byte what it was apart from its banner and version.
- MIT license.
- The test kit runs on Playwright or on puppeteer-core with `$CHROME`. The games keep puppeteer-core in their `package.json` for now (their lockfiles couldn't be regenerated where this work was done), so CI drives their tests through puppeteer-core and local runs through Playwright, with the same tests.
- CI builds and tests Tycho, then runs each game's own tests with the new build in place of its `vendor/tycho`.

## Phase 7: the rest of the shell (audio, inspect, ui)

- **audio** ([audio.md](audio.md)): Lodestar's sound engine, made general: `Engine` (the graph: two buses with sends to an echo, the chain and the limiter; the settings as levels; cues by name with gaps, a cap on voices, distance and pan from a listener; the first tap and the hidden page), the voices (`tone`, `noise`, `fm`, `stack`, `env`), `Bank` (sounds rendered ahead in an `OfflineAudioContext`, variants, the saturation and the reverb's impulse, a start paced by a loader's slices, idle rendering, `want` and `drop`) and `Music` (drones kept running, noise bands, targets set only when they change, a tick of its own, events now and then, the dip), all drawing from one stream of the sound's own (`Rand`, Lodestar's xorshift). Every number that makes Lodestar sound like itself is passed in by Lodestar (its cues, its bank's recipes and order, its waves, its chain, space, reverbs and trim); Tycho's defaults are the same numbers. `test/browser.js` traces every Web Audio call Lodestar's sound makes before and after (44,615 of them across 68 cases) and they're the same call for call; the samples agree to Chromium's own rounding. CI's build job now runs it, with Chrome and puppeteer-core.
- **inspect** ([inspect.md](inspect.md)): the White Dragon's Tyrell mode as `Inspector` (the bar, the clock and its time walk, the canvas the game draws its map on with `dot` and `badge`, the side) and `mind(world, id, options)` (the mind alone, as HTML). It reads the world through the shape of Tyrell's `World`, so the shell takes nothing from `tyrell/src`. `test/inspect.test.mjs` holds the mind to the game's original on Rocinante, character for character.
- **ui** ([ui.md](ui.md)): `Toasts` (the White Dragon's short list on game time, redrawn whole, the same words again soon keeping the last one up; Lodestar's elements on their own timers, the same words giving way to the new, hints queued while a screen's open and never shown twice), `Rising` (the White Dragon's lines over a machine), `bind` (buttons by their data attributes: the White Dragon's `panelBind`) and `Acts` (a screen's buttons from one handler: Lodestar's `UI.onTap`, with its confirming tap). `test/ui.test.mjs` plays each game's original beside Tycho's, step for step, on a stand-in for the DOM. Blocking taps after a screen opens is the controls' guard (phase 6, `Tycho.input`), which `Acts` takes as its `guard`.
- **Stayed in the games**: the HUD itself (what each shows, and where: the White Dragon's money, heat, prompt and bubbles over heads, Lodestar's bar, deck and speech) and the maps (the White Dragon's pause map and city map, Lodestar's map by layer): their looks and what they show are each game's, and the shared parts of them are in already (the maps' drag, pinch and tap are `Tycho.input`'s gestures). Lodestar's `UI.onTap` stays as it is for now: its guard lines are being changed on the play branch, so it moves onto `Acts` once that's merged (`new Tycho.ui.Acts({ acts: () => UI.acts, guard: () => Input.guarded(), armed: () => Input.guard(0.25), onAct: () => snd('tap') })`).
- **For Merryfolk, later**: its sound (buses, a reverb, a tone helper, the rain's bed, sleeping while hidden) fits `Engine`, the voices and `Music`'s bands, with its look-ahead tune its own; its single toast is `Toasts` with `most: 1`; its Brain tab becomes `inspect.mind` once its folk are on Tyrell (phase 9).
- **Changed in Lodestar**: `js/audio.js` keeps the mix, the chain's and the space's numbers, the waves and the cues, and makes `Snd` a Tycho engine (`snd`, `sndReady` and the first tap through it); `js/music.js` keeps its layers, phrases, beds and events and the music's own logic (`state`, `update`, `phrase`, `bed`, `fed`, `grow`, `listen`) on a Tycho `Music`; `js/sndbank.js` keeps its layers (`bkSub`, `bkPings`, `bkGrains`, `bkSnap`), elements, Forms, footsteps, opening and order, with `SndBank` a Tycho bank. The smoke test now checks the sound starts on the tap, with the bank rendered while the game loaded.
- **Changed in Lodestar, ui**: `UI.toast`, `showToast`, `pumpToasts` and `UI.show`'s hints are a Tycho `Toasts` (`UI.toasts`); the words, the classes and the CSS that fades them are the game's.
- **Changed in the White Dragon, ui**: `Game.toast` and `Game.gain` go to the HUD's `Toasts` and `Rising` (`Hud.toaster`, `Hud.rising`), and `panelBind` wires its buttons with `Tycho.ui.bind`.
- **Changed in the White Dragon**: `js/tyrellmode.js` is its map (the city's rows, a street's picture with its doors' counts, where everyone is, the summary) on Tycho's inspector, which draws the mind, runs the clock and wires the panel. The panel, the mind and the map are the same as before, pixel for pixel and character for character (compared step by step in a browser).

