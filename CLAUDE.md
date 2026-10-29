# CLAUDE.md

Guidance for AI agents (and people) working in this repository.

Tycho is an engine and a shelf of game features for small, phone-first pixel games in the browser, and Tyrell, a minds engine, lives inside it. Read `README.md` for the outputs and the parts, `docs/` for each part, and `tyrell/CLAUDE.md` before working in `tyrell/`, which keeps its own rules. Three games run on Tycho as a git submodule at `vendor/tycho`: Under the White Dragon, Lodestar and Merryfolk.

## Commands

```sh
npm install          # TypeScript 6.0.3, esbuild 0.28.2, @types/node (pinned: dist/ must build byte-identical in CI)
npm run build        # every output into dist/ (tycho, tyrell, tycho-minds: .js global, .mjs, .cjs, declarations; tycho-sw.js; testkit.cjs)
npm test             # build, then node --test test/*.test.mjs tyrell/test/*.test.mjs
npm run typecheck    # the engine, Tyrell, the bridge, the service worker and the test kit
npm run test:browser # what needs a browser page, in Chromium (Playwright, or puppeteer-core with $CHROME): the pixels' canvas work and the sound, against the games' originals
npm run vk           # Voight-Kampff: a week of Tyrell's Rocinante
npm run eros         # Eros, the sandbox in the terminal for Tyrell (installs its own dependencies the first time)
npm run test:eros    # Eros's type-check and tests
```

Always run `npm test` and commit `dist/` with any change to the sources. CI fails if `dist/` is stale, and runs each game's own tests against the new build.

## Layout

- `src/`: the engine (`Tycho`), in layers: `core/` (seed, math, color, loop), then `pixels/`, `world/`, `play/`, `shell/` as they move in; `index.ts` exports each part as a namespace (`Tycho.seed`, `Tycho.color`...).
- `tyrell/`: Tyrell, its own package: `src/`, `test/`, `docs/`, `examples/` (Rocinante), `bin/` (Voight-Kampff), its own `tsconfig.json`, `README.md` and `CLAUDE.md`.
- `minds/`: the bridge (`TychoMinds`, also `Tycho.minds`).
- `sw/`: the service worker games import (`dist/tycho-sw.js`).
- `eros/`: Eros, a sandbox in the terminal for Tyrell (Ink and React, its own `package.json`, built into `eros/out/`, not committed): it records setup files, runs a town live, and keeps the living documentation, generated from `tyrell/src` and the docs (`eros/catalog.mjs`). Its tests require every definition field and setting to be documented and every kind to have an example: a new field needs a doc comment (or a row in its docs table), a new kind an example (Rocinante, or `eros/src/catalog.ts`).
- `testkit/`: the Node test kit (`dist/testkit.cjs`): launch, serve, open, waitFor, golden, diff, finish. Uses the game's Playwright, or puppeteer-core with `$CHROME`.
- `test/`: the engine's node:test suites against the built `dist/`, and what needs a page, through the test kit: `browser.js` (what needs a real canvas) and `audio.js` (the sound against Lodestar's, its originals in `fixtures/`).
- `scripts/build.mjs`: the build. `scripts/layers.mjs`: the layers' rule, checked by the build.
- `docs/`: a page for each part, `move.md`, the record of moving the games onto Tycho, and `brand/`, the logo (drawn by `docs/brand/make.py`). They and `tyrell/docs/` are also the docs site (`.github/workflows/docs.yml`: `scripts/stage-docs.mjs` stages them with `docs/site`'s layout, Jekyll builds it, GitHub Pages serves it), so keep them plain Markdown with relative `.md` links.

## Rules

- **Layers.** A part uses only its own layer and those below it (core, pixels, world, play, shell). Tyrell uses nothing outside `tyrell/src`; the bridge takes only types (`import type`) from the engine and Tyrell; the service worker, the test kit and Eros stand alone. The build fails otherwise. Eros is the one part with dependencies: they stay in `eros/`, never in `dist/`.
- **Parameters, not defaults.** Whatever makes a game look or play its own way (palettes, recipes, painting operations, light models, tile kinds, items, save keys and migrations) is passed in. Never change a default in a way that changes an existing game; add an option instead.
- **Bit for bit.** When a game's code moves in, it moves in exactly: the same inputs give the same outputs, and a test in `test/` holds it to the game's original (see `test/core.test.mjs`). A part generalized for several games keeps each game's behavior reachable by its options.
- **Determinism.** Generation and painting use `Tycho.seed` only: never `Math.random`, `Date.now()` or anything outside the inputs. Iterate in a stable order. `Tycho.seed.fxRand` is only for effects nothing saves or tests.
- **No globals, no game knowledge.** The engine never reads a game's globals or names a game's content; a game passes what's needed. It may touch the DOM and canvases only in the parts that draw or listen (pixels and up), never in core.
- **Plain output.** The outputs are scripts a game loads with a tag. Keep them free of dependencies.

## Conventions

- American English everywhere: comments, docs, identifiers, messages (color, behavior, gray, center, neighbor, organize, meter).
- Comments and docs in plain English, matching the surrounding density. Each file opens with a comment saying what it is and why.
- Plain one-word names for the engine's parts (`sprite`, `grid`, `save`). Tyrell's modules and tools keep their names from Blade Runner, The Expanse, Westworld, Dune and The Lord of the Rings.
- When adding a part: its source in the right layer, its export in `src/index.ts`, a test, a page in `docs/`, and a line in the README's parts table.
- Commits have short sentence-case subjects.
