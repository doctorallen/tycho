# Eros

A sandbox in the terminal for Tyrell: load a town, watch it live, read its story as Irulan tells it, look inside anyone, and see, add and change everything it's made of, with the living documentation of every kind of thing a town can declare beside it. Named for the station in The Expanse that became one great experiment, watched from outside. It's for the people making the games; it isn't part of `dist/`, and nothing in a game loads it.

```sh
npm run eros                                            # Rocinante, the sample town
npm run eros -- tyrell/examples/rocinante.js --with bree --with harm --seed voight-kampff --days 2
npm run eros -- path/to/my-town.js                      # any setup file
```

The first run installs Eros's own dependencies (Ink and React, in `eros/node_modules`); every run builds it, so it's always the engine as it is now. It runs in the terminal's alternate screen and puts the terminal back as it was when you quit (`--no-alt` to draw in place).

- [The screens](#the-screens)
- [Keys](#keys)
- [Changing the town](#changing-the-town)
- [Opening and exporting](#opening-and-exporting)
- [The living documentation](#the-living-documentation)
- [From code](#from-code)
- [How it's made](#how-its-made)

## The screens

Above them all, a status line: the town, its options, the seed, the time, playing or paused and how fast, the checks, failing calls and warnings, and whether there's a change to undo.

**1 Story.** Irulan's telling of everything the run has written, with every setting on the left: the layout (`timeline` by the time of day, `person`, `thread` for the storylines then what else mattered, `paragraphs` as `tell()` gives them, `recap` for the headlines, `recount` for what someone would say of what's new, `feed` for what the live feed told as it happened, and `changes` for what the last change did), the least score, who it's about, whose point of view, the voice (first or third), whether the words vary, who matters more (focus) and how many (limit). People are bold, places green, and `!` or `!!` mark what matters most. The timeline and the feed follow the end while the town plays.

**2 Components.** Everything the town is made of, as its setup declared it: kinds on the left (Core's needs, places, links, actions, tasks, skills, pastimes, wishes, people, deeds, listeners, then each module's, then the setup's inputs, like a partner set or money paid), the town's things of the selected kind in the middle (by id and label), and the selected one as code on the right, with any error it raised.

**3 Catalog.** The living documentation: how Eros works; every kind a town can declare (its fields, their types, defaults and meanings, the docs page they come from, how many the town has, and an example); the setup inputs the town uses; every part of Tyrell (what it's for, what a town declares with it, its settings with their defaults, its methods); every setting, core and module, with its default and what it does; and every method of the world and its parts.

**4 Inspect.** Palantír's account of anyone: what they're doing and until when, their needs, money, skills, wishes, mood, feelings, beliefs, plan, what's expected of them and their last choice with its parts. Enter edits who they are.

**5 Log.** Westmarch's entries as they were written, in plain words, following the end.

## Keys

| Key | Where | What it does |
|---|---|---|
| `1`–`5`, tab | everywhere | The screens |
| space | everywhere | Play or pause |
| `+` / `-` | everywhere | Faster or slower: from ten minutes to a day of theirs a second of yours |
| `n` / `N` | everywhere | An hour, or a day, on |
| `b` / `B` | everywhere | An hour, or a day, back: by Esper as far as its snapshots reach, further by building the town again and running it to that moment (the same seed runs the same, so it's the same moment either way) |
| `r` | everywhere | Start again from the start |
| `s` | everywhere | A new seed, and start again |
| `c` / `C` | everywhere | Voight-Kampff's checks on the town, for a day or a week |
| `u` | everywhere | Undo the last change |
| `o` / `e` | everywhere | Open a setup file, export the town as one |
| `?` | everywhere | Help |
| `q`, ctrl+c | everywhere | Quit |
| ↑↓ ←→ | Story | Pick a setting, change it |
| `j` `k`, PgUp PgDn, `g` `G` | Story, Log | Scroll; the top; the end (and follow it) |
| ←→ ↑↓ | Components | Kinds and things; pick |
| enter / `x` | Components | Edit (a form, or code) / edit as code |
| `a` / `D` / `d` | Components | Add another of the kind (from its example) / duplicate / remove |
| ↑↓, → or enter, ← | Catalog | Pick a page, read it (↑↓ scroll), back to the pages |
| `a` | Catalog | Add one of the kind to the town, from its example |

## Changing the town

Edit anything in the Components screen (or add a kind from the Catalog). A kind with a definition gets a **form**: a line for each field, with its type, its default and what it does shown as you move through them; each value is JavaScript (`3`, `'text'`, `['a', 'b']`, `{ a: 1 }`, `(ctx) => …`), and empty fields are left out. Anything else, or anything you'd rather write, opens the **code editor**: the call's arguments as JavaScript, with the kind's documentation and an example beside it (ctrl+s applies, esc cancels, ctrl+f and ctrl+e switch between the two). In both, `w` is the world, and `HOUR`, `DAY` and `Tyrell` are there too.

A change builds the town again from the start, with the same seed, and runs it to the same moment, so what the change did is the difference in the story: the Story's `changes` layout shows the beats new and gone. A change the town won't take (a call that throws) is undone at once and the error shown. `u` undoes, as far back as fifty changes.

## Opening and exporting

**Opening** (`o`) runs a setup file (a function of `Tyrell` and options that returns a world, as Rocinante is: a script, CommonJS or an ES module) with the options you give (`bree, harm`, or `name=value`), and records every call it makes to declare its town, in order: a need, a place, a link, an action, a person, a feeling, a storylet, a listener, and the setup's own inputs (a partner, a purse). Lookups along the way (`w.kept`, a partner) aren't recorded, nor what the town's own functions do once it runs. The recorded copy is then checked against the file: both built with a seed and run a day, compared by hash.

**Exporting** (`e`) writes the town as a setup file in Rocinante's shape (it works as a script after `dist/tyrell.js`, with `require` and with `import`; a runner's options, `seed`, `start`, `modules`, `config`, `esper` and `moduleConfig`, still apply over the town's own), then loads it back and checks it builds the same world.

What an export keeps and doesn't: every call, in order, with its arguments; functions by their source, made again in each world with `w`, `HOUR`, `DAY`, `Tyrell` and `opts` in scope. Not the file's comments, its option branches (an export is the town as it was opened, with those options), or variables its functions lean on from the file's own scope: a function naming one (a table, a helper) is warned of when the file is opened, since it will fail when it runs. Keep such things inside the function, as Rocinante's words for the rain do.

## The living documentation

The catalog is generated each time Eros is built, from Tyrell's own source and docs, so it can't drift from the engine: every interface and type in `tyrell/src` with each field's type and doc comment; every public method of the world and its parts; which of them declare a kind of thing (a method taking a `...Def`, and a few others: links, listeners, condition terms, effects, kept values, Irulan's words, Bree's starter set, Cityspeak's lines); the parts of Tyrell from `tyrell/README.md`; and the defaults and meanings in the docs' tables, matched to a kind by the fields they share (on its own page first). Examples come from Rocinante itself, with all its options on, or from Bree's starter set, and for the few kinds Rocinante doesn't use, from examples written in `eros/src/catalog.ts`.

Eros's tests hold the catalog to being whole: every field of every kind and every setting has documentation (a doc comment in `tyrell/src`, or a row in its docs table), every kind has an example, and every example is something a town takes. A new field or kind without them fails the tests.

## From code

Eros's parts work without the screen (`eros/out/lib.mjs`, after `npm --prefix eros run build`):

```js
import * as Eros from './eros/out/lib.mjs';
const Tyrell = await Eros.loadTyrell();
const setup = await Eros.loadSetup('tyrell/examples/rocinante.js');
const town = Eros.record(setup, Tyrell, { bree: true }, 'rocinante');   // { create, calls: [{ id, target, method, code }], warnings }
Eros.sameAsFile(town, setup, Tyrell, 2);                              // null: the recorded copy builds the same world
const { world, errors } = Eros.replay(town, Tyrell, { seed: 'x' });   // a world from it, and any call that failed
fs.writeFileSync('my-town.js', Eros.exportCode(town));                // a setup file of it
const sb = new Eros.Sandbox(Tyrell, town, 'x');                       // live: step, back, apply, undo, runChecks, story(settings)
```

## How it's made

`eros/` stands apart from everything else in the repository: its own `package.json` (Ink and React, pinned), built with the repository's esbuild into `eros/out/` (not committed), and it loads Tyrell from `dist/` at run time, as a game does. Nothing else imports it, and it isn't in `dist/` or the package's files.

| File | What it is |
|---|---|
| `run.mjs` | `npm run eros`: installs its dependencies the first time, builds, runs |
| `build.mjs`, `catalog.mjs` | The build, and the catalog generated from `tyrell/src` and the docs |
| `src/code.ts` | Values as JavaScript and back; the names a function leans on |
| `src/recorder.ts` | Recording a setup, building from the record, exporting, checking against the file |
| `src/catalog.ts` | The catalog at run time, with examples |
| `src/sandbox.ts` | A town running live: the clock, going back, changes and undo, the checks, the story's layouts |
| `src/files.ts` | Opening and exporting |
| `src/ui/` | The screens, the form, the code editor, the pages of the catalog |
| `test/` | node:test suites, the screen drawn headless with `ink-testing-library` |

```sh
npm run test:eros      # Eros's type-check and tests (CI runs them too)
```
