# Tools

Palantír (the inspector), Westmarch (the log), Voight-Kampff (behavior tests) and Rocinante (the sample town).

- [Palantír](#palantír)
- [Westmarch](#westmarch)
- [Voight-Kampff](#voight-kampff)
- [Rocinante](#rocinante)

## Palantír

The inspector, named for the seeing-stones of The Lord of the Rings. Every decision is kept (the last `config.decisions`, 12, per person) with every option, its rank, its weight and what the weight was made of, so "why did she go to the bar?" and "why didn't she?" both have answers.

```js
const d = world.why('kofi');
console.log(d.reason);                        // 'need at rank 0; beat read, walk'
for (const c of d.candidates) console.log(c.id, c.place, c.rank, c.weight, c.blocked ?? world.palantir.parts(c));
console.log(world.whyNot('kofi', 'drink'));
console.log(world.describe('kofi'));
```

| Call | Returns |
|---|---|
| `world.why(id)` | The latest `Decision`, or `null` |
| `world.whyNot(id, action)` | A sentence: what rules the action (or task) out at each place, or what beat it |
| `world.describe(id)` | A readable account: status and time, what they're doing (and until when, layer, rank), needs, money, goods, mood, emotion and stress, feelings, the strongest beliefs, the plan, the directive, what's expected of them, and the last choice with its parts |
| `world.palantir.history(id)` | Their recent decisions, oldest first |
| `world.palantir.inspect(id)` | JSON-ready data: `{ person, needs, mood, emotion, decision, body }` |
| `world.palantir.parts(candidate)` | `'base 0.4 x habit 1.2 x travel 0.6'` |
| `world.palantir.enabled` | Set `false` to skip recording (big headless runs) |

A `Decision` is `{ t, who, picked, candidates, reason }`. The candidates kept are the first 16 by rank and weight, plus every required one (routine, job, story, break). A `Candidate` is `{ id, kind, place, target?, rank, weight, layer, parts, blocked?, slot?, until? }`; `parts` is `[name, value]` pairs, the base first; `blocked` is the reason it was ruled out.

`whyNot` weighs the action now, at every place it could be done, as if it were a free choice. Its answers look like:

- `cafe: cafe is closed then; diner: no free seat`
- `drink at bar weighs 0.12 (base 0.2 x travel 0.6); chat weighed 0.4 (base 0.4)`
- `serve outranks it (job, rank 2 against 0)`
- `bar: needs the job 'bartender'`, `drink isn't declared`, `Kofi is doing it now`, `Kofi is away`

Decisions aren't part of the world's state: they don't save, they aren't recorded while Esper replays, and a seek or a load clears them. Each decision also emits `decided` (`{ who, picked, place }`, with `picked` the id or `null`).

`whyNot` evaluates the action's conditions; a `chance:` condition draws from the person's stream, so inspecting can change what happens next. Keep `chance:` out of conditions you inspect, or inspect only in debug builds.

## Westmarch

The log of what happened, named for the Red Book of Westmarch, where the story was written down. It's part of the world's state (so it saves and rewinds), bounded to `config.logSize` entries (1000 by default; the oldest go first), and every entry is also emitted as a `log` event.

```js
world.westmarch.find({ k: 'started', who: 'ruth', since: world.now - 1440 });
world.westmarch.since(world.now - 60, ['told', 'report']);
world.westmarch.chronicle('ruth', world.now - 1440);
// ['08:10 set out for market', '08:14 got to market', '08:14 shopping at market', ...]
```

| Call | Returns |
|---|---|
| `find({ k?, who?, since?, until? })` | Entries matching, oldest first. `k` is a kind or a list of kinds; `who` matches the entry's person or an entry whose data names them as `target`; `since` and `until` are times |
| `since(t, k?)` | `find({ since: t, k })` |
| `chronicle(who, since)` | A short account in plain lines, `'HH:MM text'`: walks, arrivals, actions (by `label`), failures, feelings, what they told and heard, breaks, time spent with people, deeds; and what others did with them (entries that name them as `target`) |

A `LogEntry` is `{ t, k, who?, d? }`. Kinds written by the engine and modules:

| Kind | Data | Written when |
|---|---|---|
| `joined` | | A person is added |
| `fact` | `{ key, value }` | A fact is set (by an input) |
| `sensed` | `{ kind, what, place, by }` | The game reported a stimulus |
| `did` | `{ verb, ...data }` | A deed |
| `directed`, `released` | `{ do }` | A directive is given or cleared |
| `set-out` | `{ to, for }` | Someone sets out |
| `arrived` | `{ place }` | Someone arrives |
| `started` | `{ action, place, layer, target? }` | An action starts |
| `finished`, `stopped` | `{ action, place, frac }` | An action ends, or is cut short |
| `interrupted` | `{ action, why }` | Something is interrupted |
| `failed` | `{ why }` | Something fails |
| `away`, `back` | `{ until, summary }`, `{ summary }` | Someone goes away, comes back |
| `gone` | `{ why }` | Someone leaves for good |
| `timer` | `{ name }` | A game timer fires |
| `day` | `{ day }` | Midnight |
| `promoted` | `{ stranger }` | A stranger becomes a person |
| `felt`, `broke`, `changed` | | Reverie |
| `met`, `regard`, `sentiment` | `{ target, ... }` | Fellowship |
| `witnessed`, `report`, `silenced`, `told`, `exposed`, `owes` | | Wormtongue |
| `said`, `social` | | Cityspeak |
| `planned`, `no-plan`, `route`, `replanned`, `done-plan`, `gave-up`, `set-aside`, `resumed` | | Mentat |
| `director` | `{ storylet, place }` | Gaff |
| `rent` | `{ paid }` or `{ missed }` | Ceres |
| `paired`, `born`, `stage` | | Cradle |

The `log:<kind>` effect writes your own entries from inside the simulation. `world.log(kind, who, data)` writes one from the game: it's an input, so the entry is recorded and comes back after a rewind (inside the simulation it writes at once).

The log is in every snapshot and every save, so its size is the biggest lever on Esper's memory (see [Time](time.md#esperconfig-and-memory)). In the chronicle, clock times are rounded down, so a walk ending at 7:20 can show as 07:19.

## Voight-Kampff

The behavior tests, named for Blade Runner's test that tells a person from a machine. It runs a world headless for seeded days and checks that people still behave like people.

```js
const report = Tyrell.VoightKampff.run({
  build: (seed) => buildMyTown(Tyrell, { seed }),
  days: 7,
});
if (!report.passed) console.log(report.failures);
```

`VKOptions`:

| Field | Default | Meaning |
|---|---|---|
| `build` | required | `(seed) => World`: builds a fresh world, declaring everything and adding everyone. Called more than once |
| `days` | 3 | Days to run |
| `seed` | `'voight-kampff'` | The seed |
| `every` | 30 | Minutes between samples |
| `checks` | all of them | Check names, or your own `VKCheck` objects |

Built-in checks:

| Check | Fails when |
|---|---|
| `nobody-starves` | A need that can break a routine (`urgent` at most 1) sits at its worst (0.999 or more) for over 12 hours |
| `capacity` | A slot holds more people than its capacity |
| `everyone-sleeps` | Someone didn't start an action tagged `'sleep'` on a day (or the night before). Skipped if no action is tagged `'sleep'`. Judged from the log, so only days the log still covers are checked |
| `no-stuck` | Someone is doing nothing at all, or has been idle for over 4 hours |
| `deterministic` | A second world built with the same seed and run to the same time has a different hash |
| `esper` | Going back 6 hours and forward again changes the world (skipped with Esper off) |
| `save-load` | A saved and loaded world differs from the original, or runs differently for 3 more hours |

A custom check:

```js
const noStrandedKids = {
  name: 'no-stranded-kids',
  sample(w, acc, fail) {
    for (const p of w.people()) if (p.def.tags?.includes('child') && w.hour >= 22 && !w.ring.within(p.place, p.def.home)) fail(`${p.id} is out at ${w.hour}`);
  },
};
Tyrell.VoightKampff.run({ build: (seed) => buildMyTown(Tyrell, { seed }), checks: ['capacity', noStrandedKids] });
```

`sample(w, acc, fail)` is called at every sample, `end(w, acc, fail)` once at the end; `acc` is a scratch object shared across calls.

`VKReport`:

| Field | Meaning |
|---|---|
| `seed`, `days`, `checks` | What ran |
| `passed`, `failures` | Whether every check passed, and what failed (at most 200) |
| `hash` | The world's hash at the end |
| `stats.actions` | Each action's share of the actions started, from the log (so only the last `logSize` entries: raise `logSize` in the build for a whole run) |
| `stats.mood` | Per day: `{ day, mean, sd }` of everyone's mood (with Reverie) |
| `stats.places` | By hour of the day: where everyone was, summed over days (`'(walking)'` for walkers) |
| `stats.needs` | The highest level each need reached |
| `stats.decisions` | How many decisions were made |
| `stats.ms` | How long the run took |

`Tyrell.VoightKampff.compare(report, baseline, tolerance = 0.05)` returns the differences between two reports: action shares and mean mood further apart than the tolerance. An empty list means they match. Keep a baseline report from a run you're happy with, and compare after changes to catch behavior drifting.

### The command line

```sh
node vendor/tyrell/bin/voight-kampff.mjs my-town.js --days 7
node vendor/tyrell/bin/voight-kampff.mjs my-town.js --days 7 --save baseline.json
node vendor/tyrell/bin/voight-kampff.mjs my-town.js --days 7 --baseline baseline.json --tolerance 0.03
```

| Flag | Meaning |
|---|---|
| `<setup.js>` | A module exporting `(Tyrell, { seed }) => world`, loaded with `require` (CommonJS; an ES module with a default export works on Node versions that can require ES modules) |
| `--days n` | Days to run (default 3) |
| `--seed s` | The seed (default `'voight-kampff'`) |
| `--json` | Print the whole report as JSON |
| `--save file` | Write the report to a file (for a baseline) |
| `--baseline file` | Compare with a saved report |
| `--tolerance x` | The comparison tolerance (default 0.05) |

It prints the decisions and time taken, whether it passed (and the failures), the ten most chosen actions, and the mean mood by day. It exits with 0 when everything passes (and matches the baseline), 1 when something fails or differs, and 2 when no setup file is given. In Tyrell's own repository, `npm run vk` runs a week of Rocinante.

## Rocinante

The sample town that ships with Tyrell, named for the ship in The Expanse: `examples/rocinante.js`. Every part of the engine appears in it at least once, the tests and the runner use it, and it's the worked example to read next to these docs.

| | |
|---|---|
| **People** | Mara (baker, owns the cafe) and Tomas (mechanic), partners, with their son Pip (9), in a household that shares a purse; Ines (bartender, owns the Belt); Dev (grocer, Kofi's landlord); Ruth (retired, a broken radio, routine variants for one day of the week and for rain); Kofi (a student, no routine); Lena (doctor); Sam (broke and dishonest, no routine); Officer Vance (the Watch) |
| **Places** | Five flats (region `blocks`); the cafe, market, bar, park and tram station (`main`); the workshop and clinic (`river`); linked by walks |
| **Needs** | hunger, energy, and fun, company and hygiene (which never break a routine) |
| **Actions** | Sleeping (slowing other needs), naps, showers, reading, eating out and in, shopping, stealing, drinking, walks, chatting (a social act), helping out (a deed), work for each job, a breakdown's sulk and bender, and the radio repair |
| **Tasks** | Dinner at home (from the cupboard, or shop first with `get:food`); fixing the radio (take it in if they think the workshop's open, buy another, or do without) |
| **Modules** | Feelings, breaks and memory kinds; deeds; a household, the Watch and the regulars; theft and stripping as crimes; goods, a pension, a grant and rent; lines, two practices and a social act; storylets for rain and a blackout; strangers passing through the main street |

Run it:

```js
// Node
const Tyrell = require('./vendor/tyrell/dist/tyrell.cjs');
const buildRocinante = require('./vendor/tyrell/examples/rocinante.js');
const world = buildRocinante(Tyrell, { seed: 'my-seed', start: 6 * 60 });
world.advance(24 * 60);
console.log(world.describe('ruth'));
```

```html
<!-- the browser: it defines buildRocinante -->
<script src="vendor/tyrell/dist/tyrell.js"></script>
<script src="vendor/tyrell/examples/rocinante.js"></script>
<script>const world = buildRocinante(Tyrell, {});</script>
```

Options: `seed` (default `'rocinante'`), `start` (default 6:00 on day 0), `modules` (default all), `config`, `esper`. Couples don't form on their own in Rocinante (`autoPair: null`); Mara and Tomas are partners from the start.
