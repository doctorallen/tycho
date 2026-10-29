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

`whyNot` and `describe` change nothing: they evaluate conditions as a look, so a `chance:` condition draws from a stream that leaves the person's own alone.

## Westmarch

The log of what happened, named for the Red Book of Westmarch, where the story was written down. It's part of the world's state (so it saves and rewinds), bounded to `config.logSize` entries (1000 by default; the oldest go first), and every entry is also emitted as a `log` event.

```js
world.westmarch.find({ k: 'started', who: 'ruth', since: world.now - 1440 });
world.westmarch.since(world.now - 60, ['told', 'report']);
world.westmarch.chronicle('ruth', world.now - 1440);
// ['08:10 set out for market', '08:14 got to market', '08:14 shopping at market', ...]
world.on('log', (e) => console.log(world.westmarch.describe(e)));
// 'set out for The Market', 'got to The Market', 'told Kofi about did:sam:theft', ...
```

| Call | Returns |
|---|---|
| `find({ k?, who?, since?, until? })` | Entries matching, oldest first. `k` is a kind or a list of kinds; `who` matches the entry's person, or an entry whose data names them as `target`, `for` or `to` (a deed done for them, gossip told to them); `since` and `until` are times |
| `since(t, k?)` | `find({ since: t, k })` |
| `chronicle(who, since)` | A short account in plain lines, `'HH:MM text'`: walks and arrivals (places by their `name`, when they have one), actions (by `label`), failures, feelings, what they told and heard, breaks, time spent with people, deeds; and what others did with them or for them, and what they heard (entries that name them as `target`, `for` or `to`). `since` is a time, or a list of entries (ones the game kept from the `log` events, to reach back further than the log keeps) |
| `describe(entry)` | One entry in plain words, as they'd follow the person's name, in the chronicle's wording: `'got to The Market'`, `'felt Nothing went right'`, `'chat with Lena ended fine after 3 turns'`. People and places by their names, actions, tasks and wishes by their labels; an entry with no person reads on its own (`'day 2 began'`). Every kind in the table below has words, and a kind it doesn't know comes out as its name and its data (`'party: size 3'`). A look: it reads the state and changes nothing |
| `about(entry, who)` | Whether an entry is about someone, as `find` judges it |

A `LogEntry` is `{ t, k, who?, d? }`. Kinds written by the engine and modules:

| Kind | Data | Written when |
|---|---|---|
| `joined` | | A person is added |
| `fact` | `{ key, value }` | A fact is set (by an input) |
| `sensed` | `{ kind, what, place, by }` | The game reported a stimulus |
| `did` | `{ verb, ...data }` | A deed |
| `directed`, `released` | `{ do, label? }` | A directive is given or cleared |
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

The log is in every snapshot and every save, so its size is the biggest lever on Esper's memory (see [Time](time.md#esperconfig-and-memory)).

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
| `interactions` | (Only when asked for by name.) Someone is in two of Bree's exchanges at once, an exchange has gone on for over 6 hours, or a grudge is out of range |
| `harm` | (Only when asked for by name.) Someone was killed with `lethality` 0; meant harm someone saw done left them no grudge (with Bree); a harm's severity or someone's hurt is out of range; someone has been down for over 6 hours; or, with at least six suspicions of poisonings, the poisoner was never suspected, or suspected every time |

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

`start(w, acc, fail)` is called once, when the world is built (to listen for events), `sample(w, acc, fail)` at every sample, `end(w, acc, fail)` once at the end; `acc` is a scratch object shared across calls.

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
| `stats.interactions` | When people interacted (Bree): exchanges and their turns, by kind and by outcome, escalations, people who walked off and who stepped in, and the grudges and feuds at the end |
| `stats.harm` | When people harmed each other (Morgul): harms by how they came, fights by numbers and their blows, downs and killings, traps set and sprung, taints and doses eaten, suspicions (right and wrong), tendings, answers to the player, and the wounds open and people down at the end |

`Tyrell.VoightKampff.compare(report, baseline, tolerance = 0.05)` returns the differences between two reports: action shares and mean mood further apart than the tolerance. An empty list means they match. Keep a baseline report from a run you're happy with, and compare after changes to catch behavior drifting.

### The command line

```sh
node vendor/tycho/tyrell/bin/voight-kampff.mjs my-town.js --days 7
node vendor/tycho/tyrell/bin/voight-kampff.mjs my-town.js --days 7 --save baseline.json
node vendor/tycho/tyrell/bin/voight-kampff.mjs my-town.js --days 7 --baseline baseline.json --tolerance 0.03
```

| Flag | Meaning |
|---|---|
| `<setup.js>` | A module exporting `(Tyrell, { seed }) => world`, loaded with `require` (CommonJS; an ES module with a default export works on Node versions that can require ES modules) |
| `--days n` | Days to run (default 3) |
| `--seed s` | The seed (default `'voight-kampff'`) |
| `--with option` | Passes `{ option: true }` to the setup function (`--with bree` for Rocinante's interactions, `--with harm` for its harm); as many as you like |
| `--check name` | Adds a check to the usual ones (`--check interactions`, `--check harm`); as many as you like |
| `--json` | Print the whole report as JSON |
| `--save file` | Write the report to a file (for a baseline) |
| `--baseline file` | Compare with a saved report |
| `--tolerance x` | The comparison tolerance (default 0.05) |
| `--log` | Print every log entry as it's written, a line each: the day and time, the person's name, and what happened in Westmarch's words (`describe`), with where they were when the entry doesn't say |
| `--log all` | Every event besides (`world.on('*')`): decisions, Bree's exchanges and each turn's words, Morgul's harms, and the rest by their names and data |
| `--log kind,kind` | Only those kinds of entry, or events by those names (`--log started,arrived`, `--log bree:turn`) |
| `--who id` | With `--log`, only what's about one person: entries by them or naming them as `target`, `for` or `to`, and events with a field that names them |
| `--chronicle id` | Print that person's chronicle at the end, a day at a time, from every entry written in the run (not only what the log still holds) |

```
day 0 09:44  Ruth           got to The Market
day 0 09:44  Ruth           shopping at The Market
day 0 09:50  Dev            felt Saw something bad · at The Market
day 0 09:50  Dev            saw theft by Sam · at The Market
day 0 10:44  Dev            told Kofi about did:sam:theft · at The Market
```

Only the run's own world is watched: the `deterministic` and `save-load` checks build more worlds with the same seed, and those would tell it all again. Nothing is printed past the run's last minute (the checks run the world on a little after it), and listening changes nothing in the world: the report and its hash are the same with or without `--log`.

It prints the decisions and time taken, whether it passed (and the failures), the ten most chosen actions, the mean mood by day, and, when people interacted or harmed each other, what passed between them. It exits with 0 when everything passes (and matches the baseline), 1 when something fails or differs, and 2 when no setup file is given. In Tyrell's own repository, `npm run vk` runs a week of Rocinante, `npm run vk:bree` a week of it with Bree's interactions and the `interactions` check, `npm run vk:harm` a week of it with harm (Morgul) and the `harm` check, and `npm run vk:log` one day of it printed in full (`--log all`).

## Rocinante

The sample town that ships with Tyrell, named for the ship in The Expanse: `examples/rocinante.js`. Every part of the engine appears in it at least once, the tests and the runner use it, and it's the worked example to read next to these docs.

| | |
|---|---|
| **People** | Mara (baker, owns the cafe) and Tomas (mechanic), partners, with their son Pip (9), in a household that shares a purse; Ines (bartender, owns the Belt); Dev (grocer, Kofi's landlord); Ruth (retired, a broken radio, routine variants for one day of the week and for rain); Kofi (a student, no routine); Lena (doctor); Sam (broke and dishonest, no routine); Officer Vance (the Watch) |
| **Places** | Five apartments (region `blocks`); the cafe, market, bar, park and tram station (`main`); the workshop and clinic (`river`); linked by walks |
| **Needs** | hunger, energy, and fun, company and hygiene (which never break a routine) |
| **Actions** | Sleeping (slowing other needs), naps, showers, reading (it trains lore, and palls), eating out (bread from the cafe's stock) and in, shopping, stealing, drinking (it palls, and goes to their heads), walks and sitting in the park (they pall together), chatting (a social act), helping out (a deed), work for each job (baking makes the cafe's bread from its flour, more of it the better Mara bakes; baking and fixing train their skills), a breakdown's sulk and bender, and the radio repair |
| **Tasks** | Dinner at home (from the cupboard, or shop first with `get:food`); fixing the radio (take it in if they think the workshop's open, buy another, or do without) |
| **Growth** | Skills for baking, repair and lore, with Mara's and Tomas's starting levels and talents; Kofi's instincts (he'd rather be outdoors, or reading); wishes for a night at the Belt, some fresh air and a talk with a friend, and dreams of mastering a trade |
| **Modules** | Feelings, breaks and memory kinds; deeds; a household, the Watch and the regulars; theft and stripping as crimes; goods, a pension, a grant and rent, and the cafe's bread chain (flour to bread); lines, two practices and a social act; storylets for rain and a blackout; strangers passing through the main street; genomes for everyone (eyes, hair, traits, talents, instincts); a few drinks that wear off into a sore head, and a cold Kofi brings home that goes round; the player's talks (how someone is, Ruth's radio and a promise to fix it); with `bree`, Bree's starter set of interactions, a natter that interacts, a fight the Watch hears of, a few lines for their words, the natures they read, and a grudge Sam bears Dev; with `harm` (and Bree), Morgul: a brawl at the Belt Gaff paces, a snare Pip sets in the barn, nightshade in the cafe's stew, wounds that heal or fester, first aid, flight and revenge |

Run it:

```js
// Node
const Tyrell = require('./vendor/tycho/dist/tyrell.cjs');
const buildRocinante = require('./vendor/tycho/tyrell/examples/rocinante.js');
const world = buildRocinante(Tyrell, { seed: 'my-seed', start: 6 * 60 });
world.advance(24 * 60);
console.log(world.describe('ruth'));
```

```html
<!-- the browser: it defines buildRocinante -->
<script src="vendor/tycho/dist/tyrell.js"></script>
<script src="vendor/tycho/tyrell/examples/rocinante.js"></script>
<script>const world = buildRocinante(Tyrell, {});</script>
```

Options: `seed` (default `'rocinante'`), `start` (default 6:00 on day 0), `modules` (default all), `config`, `esper`, `moduleConfig` (merged over Rocinante's own, module by module), `tuned` (a town tuned to taste: the headline knobs for everyone and a few people's own `tune`; see [Tuning](tuning.md#an-example)), `bree` (Bree's interactions between the townsfolk: see [Bree](modules/bree.md#example)), and `harm` (harm between them, with Bree: see [Morgul](modules/morgul.md#example)). Couples don't form on their own in Rocinante (`autoPair: null`); Mara and Tomas are partners from the start.
