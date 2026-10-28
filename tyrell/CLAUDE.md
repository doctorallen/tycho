# CLAUDE.md

Guidance for AI agents (and people) working in this repository.

Tyrell is a minds engine for games: people with needs, routines, plans, feelings, memories, beliefs and relationships, simulated on screen and off, with time walk (fast-forward, rewind, reverse playback) built into the core. It's TypeScript in `src/`, built by esbuild into plain JavaScript in the Tycho repository's `dist/` (Tyrell lives in `tyrell/` there, its own package with its own rules), which is committed so games can pull Tycho in as a git submodule and load `dist/tyrell.js` with a script tag. Nothing in `tyrell/src` may import from the engine (`src/`) or the bridge (`minds/`): `scripts/layers.mjs` fails the build if it does. Read `README.md` for the parts and their names, and `docs/` for how a game uses it.

## Commands

Run from the root of the Tycho repository:

```sh
npm install          # TypeScript 6.0.3 and esbuild 0.28.2 (pinned: dist/ must build byte-identical in CI)
npm run build        # every output: dist/tyrell.js (global), tyrell.mjs, tyrell.cjs, declarations, and the engine's
npm run test:tyrell  # build, then node --test tyrell/test/*.test.mjs
npm run typecheck
npm run vk           # Voight-Kampff: a week of the Rocinante sample town
```

Always run `npm test` and commit `dist/` with any change to `src/`. CI fails if `dist/` is stale.

## Layout

- `src/core/`: the engine itself.
  - `world.ts`: `World`, the public API, inputs (what Esper records), the condition language's core terms and effects.
  - `types.ts`: every definition and state shape.
  - `bicameral.ts`: needs, the layered stack, considerations, weighing and the pick, habits.
  - `entmoot.ts`: the event queue and clock, doing things (travel, act, finish, interrupt, fail), bodies.
  - `esper.ts`: time walk: snapshots, the input log, seek, branch, marks.
  - `ring.ts`: places, travel, slots, hours.
  - `westmarch.ts`: the log. `strangers.ts`: passers-by. `conds.ts`: the condition and effect language. `util.ts`: hashing, seeded streams, the heap. `module.ts`: the module hooks.
- `src/modules/`: Reverie, Fellowship, Wormtongue, Cityspeak, Mentat, Gaff, Ceres, Cradle, Joi.
- `src/tools/`: Palantír (`palantir.ts`) and Voight-Kampff (`voightkampff.ts`).
- `src/index.ts`: `create()` and the exports.
- `examples/rocinante.js`: the sample town (plain JS; works as a script, with require and import). Tests and the runner use it.
- `test/`: node:test suites against the built `dist/` (at the repository's root).
- `bin/voight-kampff.mjs`: the command-line runner. The build is the repository's `scripts/build.mjs`.

## Rules that keep the engine correct

- **Determinism.** The same seed and the same inputs must give the same world, byte for byte (`world.hash()`). Never use `Math.random`, `Date.now()` or anything outside the state in simulation code. Random draws come from `world.stream(person)` (advances that person's counter), `world.worldStream(name)` (advances the world's), or `world.worldStreamPeek(...)` (changes nothing, for choices that only look, like a line to show). Iterate in a stable order.
- **All state is plain JSON in `world.s`.** Modules keep theirs in `world.s.mod[name]`. Definitions (needs, places, actions, tasks, feelings, lines...) live outside the state, may hold functions, and are declared again by the game on every start. Never put a function, a Map or a class instance in the state.
- **Inputs.** Anything from outside that changes the state goes through `world.input(name, args)`, with a handler registered by `world.defineInput`. That's what Esper records and replays. Public mutators on modules (`reverie.feel`, `fellowship.adjust`...) go through inputs; code inside the simulation (hooks, effects, timers) calls the direct `apply...` versions. Calls the game makes from inside a listener are deferred to the end of the current event or input and recorded to replay at exactly that point. Code the engine runs on the game's behalf (a storylet's `fire`) runs inside `world.internally()`, so its calls aren't recorded twice.
- **Emit, don't call out.** The engine tells the game things with `world.emit(kind, data)` (silent while Esper replays). It never touches the game's globals.
- **Time is minutes.** `world.now` counts game minutes; `HOUR = 60`, `DAY = 1440`.
- **The game owns space and sight.** No coordinates in Tyrell: places are ids, travel is minutes, and the game reports what was seen (`world.sense`).

## Conventions

- American English everywhere: comments, docs, identifiers and messages (behavior, color, favor, rumor, neighbor, center, gray, organize).
- Comments and docs in plain English, matching the surrounding density. Each file opens with a comment saying what it is and why.
- Module and tool names come from Blade Runner, The Expanse, Westworld, Dune and The Lord of the Rings; keep new ones on that shelf.
- When adding a feature: types in `types.ts` (or the module), a test in `test/`, a mention in the docs, and Rocinante if it's something a game would use.
