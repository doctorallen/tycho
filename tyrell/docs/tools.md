# Tools

Palantír (the inspector), Westmarch (the log), Irulan (the narrator), Voight-Kampff (behavior tests) and Rocinante (the sample town).

- [Palantír](#palantír)
- [Westmarch](#westmarch)
- [Irulan](#irulan)
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

## Irulan

The narrator, named for the Princess Irulan of Dune, who wrote the histories of Muad'Dib. Westmarch keeps the log a line at a time; Irulan tells it as a story: for an inspector's "their day so far", a town journal, a recap after time away, the storylines running through the town, a notice when something happens, what someone says when asked what's new, or reading a Voight-Kampff run.

```js
const kept = [];
world.on('log', (e) => kept.push(e));   // (or tell from the log itself: a time instead of a list)
world.advance(2 * 1440);

world.irulan.beats(kept, { min: 0.3 });
// [{ t: 548, who: ['sam'], with: ['dev'], place: 'market', score: 0.97, kinds: [...], entries: [...],
//    text: "Sam went to The Market and pocketed some food, with Dev there.",
//    parts: [{ text: 'Sam', person: 'sam' }, { text: ' went to ' }, { text: 'The Market', place: 'market' }, ...] }, ...]
world.irulan.tell(kept, { min: 0.3 });     // ['Day 0, morning. Sam went to The Market and ...', ...]
world.irulan.day('ruth', kept);            // 'Ruth went to Tomas\'s Workshop and had the radio fixed, with Tomas there. ...'
world.irulan.recap(kept, { limit: 3 });    // the three beats that matter most, in order
world.irulan.recount('tomas', kept);     // ['Early yesterday, I was caught in a snare at The Old Barn, ...', 'Yesterday evening, I was poisoned and was hurt by tainted food.']
world.irulan.feed((beat) => notify(beat.parts), { min: 0.6 });   // each beat that matters, as it happens
world.irulan.threads(kept);
// { threads: [{ title: "Sam's nightshade", people: ['tomas', 'sam', ...], keys: ['harm:5', 'taint:x4'], beats: [
//     "Sam slipped nightshade into the stew at Mara's Cafe.", "Tomas was poisoned and was hurt by what Sam put in the food.",
//     "Tomas ... blamed Mara, who served it, ...", "Mara suspected Sam, who was about, ..."] }, ...],
//   rest: [...the beats in no storyline] }
```

### Beats

It folds the entries into beats:

- **An action from start to finish**, with the walk there, the company kept, how a social act went and a feeling it brought: "Lena showered at home for half an hour, with Kofi there, and felt fresh." The same action taken up again straight after is more of it, so a shift worked an hour at a time is one beat ("Mara went to Mara's Cafe and baked bread for eight hours"). One still going when the entries end is told as it was ("was reading").
- **A talk** (Bree) from its first word to its last, through what it turned into: "Dev argued with Lena at Mara's Cafe, which turned into a fight, and it ended in a row."
- **Whatever happened to someone in the same minute**, as one sentence: what happened, then how they felt, then what they did. "Kofi gave up on dinner at home (no way to get food) and was frustrated."
- **The same beat for several people at once**, told once: "Mara, Ruth and Kofi wished for some fresh air."

A deed told by the action it came of isn't told again, nor a chat both sides started, nor a suspicion of the person someone blamed. Places are named as the person would say them: `home` for their own, "Mara's place" for someone else's home with no `name`.

Every beat is scored for how much it matters, 0 to 1: the weight of its kinds (`IRULAN_WEIGHTS`: routine low, the day's turns in the middle, what a story is made of high; a feeling by how strongly it moves the mood; a job's work lower still, a crime done, a hostile talk or one that went badly higher), up to twice that for what's rare among the entries told, and `focus` for the people who matter more to the game. `min` leaves out what scores under it, a clause at a time, so what matters isn't told with the routine around it.

### Varied words

Each telling varies its words: a `tell` given as a list is variants (`did: ['read', 'curled up with a book', 'sat and read']`), and Irulan's own phrases have theirs ("went", "headed", "made their way"; "told Ines about", "told Ines of", "mentioned ... to Ines"; "with Kofi there", "with Kofi around", "in the company of Kofi"). One is drawn for each telling from the world's seed and what's told, so the same entries read the same every time, another seed reads differently, and nothing in the world changes. The draw never depends on who it's about, so the same thing done by several people still reads alike and is told once. `vary: false` always takes the first.

### Parts

Every beat's sentence also comes in `parts`: its words, and each person and place in them tagged with its id (`{ text: 'Sam', person: 'sam' }`, `{ text: 'home', place: 'apt_5' }`), so a game can make names links, color places or put a portrait by a name without searching the text. Joined, the parts' text is the sentence. A thread's title comes in parts too. The names `words` gets from its context (`name`, `place`) carry their tags into its words: put them in as they are. Words left to Westmarch's `describe` come untagged.

### Point of view

`as` tells only what one person knows, as they know it: what they did, what was done to them or in front of them, and what they were told. Not what others felt, wished, planned or thought of them (their feelings, wishes, grudges, suspicions, even folded into what they did); not a crime done in front of them they didn't catch (Wormtongue's witnesses); not who did something to them they couldn't have seen (a quiet harm: poisoned food is "tainted food", not "Sam's"). `voice: 'first'` tells it in their words: "I", "me", "my" ("Officer Vance told me about Sam's theft", "Tomas was hurt by my tainted food", "Kofi and I"), and the subject's "they" becomes "I" ("as I'd wished"). For gossip, for what someone says when asked, for a journal kept by the player's character.

`recount(id, entries, opts?)` is what they'd say when asked what's new: the few beats they know that matter most (`limit`, default 3, scoring `min`, default 0.4), in order, in their words, with when from `now` (default the world's): "Yesterday evening, I was poisoned and was hurt by tainted food." `ago(t, now?)` is when on its own: "this morning", "last night", "yesterday afternoon", "three days ago".

### Threads

`threads` finds the storylines running through the entries:

- **A matter**: a crime (what was done, who saw it, who was told and who reported it), a trap (set, sprung, disarmed, warned of, gossiped about), a taint and whom it poisoned, a harm (and whom it was blamed on and who was suspected). A crime seen or told of without knowing who did it belongs to the latest crime of its kind before it.
- **What passed between two people**, for what's about no matter: their talks, grudges, feuds, making up, deeds for each other, harm. A pair becomes a storyline only when something with consequences passed between them (not a chat that went fine, nor a kind word alone).

Matters are one story only when a single log entry links them (a quarrel that came to blows, a trap and the cut it gave), never for happening in the same minute: someone telling gossip as they start a chat doesn't tie the chat to the gossip. A beat about two stories is in both. What a thread's people felt in its course (after something in it that mattered, that they were in) comes with it: the thief's guilty conscience, the victim's breakdown. Everything about a thread's matters is in it whatever it scores; a thread needs two beats and one scoring `min` (default 0.4). They come the one that matters most first, each `{ id, keys, title, parts, people, beats, t, end, score, active }` (`people` the most involved first; `id` the same from one telling to the next, the first of its keys to turn up; `active` while something in it is within a day of now), with `rest`, the beats in no thread scoring `min`. Two with the same title (Sam poisoning the stew twice in a week) are told apart by the day each began: "Sam's nightshade, day 2".

### The story kept

The log keeps its last `config.logSize` entries, a day or so of a busy town, too little to follow a feud for a week. With `config.storySize`, Irulan keeps the entries that matter in a story of their own (`world.s.story`), as Westmarch writes them: whatever weighs `config.storyMin` (0.3) or more, a crime or a deed done and how it ended, a feeling that moves the mood by 0.1 or more, a talk with where it was. Walks, company and routine actions aren't kept. Past `storySize`, the least that matters goes, the oldest of it first. It's part of the world's state, so it saves, loads, rewinds and replays with the world; off (0, the default), a world has no story and hashes as before. Every call takes its entries from it when given none (`world.irulan.threads()`), and `book()` returns it. Each entry is about 100 bytes, in every save and every time-walk snapshot: a story of 1,000 is about 100 KB a snapshot.

### As it happens

`feed(fn, opts?)` tells the story as it happens: it calls `fn` with each beat once it's complete (its action or talk over, its last minute gone by, so it won't grow) and scores `min`, for a notice when something that matters happens. Each beat is judged once, when it completes, and told at most once; each call has what completed since the last, in the order it began. Beats are worked out every `every` game minutes (default 10) from the entries of the last `window` (default 12 hours), from the `log` events, so it costs a little time as the world runs and nothing in it. A rewind (Esper) forgets what came after the time gone back to, so the new course is told as it happens. It returns a function that stops it.

| Call | Returns |
|---|---|
| `beats(entries?, opts?)` | The entries told as beats, oldest first: `{ t, end?, who, with, place?, kinds, score, text, parts, entries }`. `who` is the subject (several when told as one, none for what happened to nobody in particular); `with` the others in it. `entries` is a list (the game's own, kept from the `log` events, to reach back further than the log keeps) or a time to tell the log from; without it, the story kept (`config.storySize`), or the whole log |
| `tell(entries, opts?)` | The beats as paragraphs, one for each part of each day, each starting with when: `'Day 0, morning. ...'` |
| `day(id, since, opts?)` | Someone's day as one paragraph: the beats about them, `min` 0.3 unless given. `since` is a time or a list of entries |
| `recap(entries, opts?)` | The headlines: the `limit` beats that matter most (default 5), in the order they happened |
| `threads(entries, opts?)` | `{ threads, rest }`: the storylines, the one that matters most first, and the beats in none |
| `recount(id, entries, opts?)` | What someone would say of what's new: the beats they know that matter most, in their words, with when |
| `ago(t, now?)` | When something was, from now: `'yesterday evening'` |
| `feed(fn, opts?)` | Calls `fn(beat)` with each beat as it completes; returns a function that stops it. `every` (10) and `window` (12 hours) besides the options below |
| `book()` | The story kept beyond the log (`config.storySize`), oldest first |
| `when(t, opts?)` | A time as the paragraphs say it: `'Day 0, early morning'` |
| `words(kind, fn)` | Gives a kind of entry the game's own words: `fn(entry, { name, place, world })` returns what follows the person's name (or the whole sentence, for an entry with no person), `null` to leave the entry out, or `undefined` for Irulan's own. A definition: declare it again on every start |

| Option | Default | Meaning |
|---|---|---|
| `who` | everyone | Only what's about this person: beats that are theirs, have them in it, or name them; threads they're in |
| `min` | 0 (`day`: 0.3, `threads`: 0.4) | Leave out what scores under this |
| `weights` | `IRULAN_WEIGHTS` | Weights by kind of entry, over Irulan's own; 0 leaves a kind out (`{ told: 0 }`) |
| `as` | none | Tell only what this person knows, as they know it ([point of view](#point-of-view)) |
| `voice` | `'third'` | With `as`, `'first'` tells it in their words |
| `vary` | true | Vary the words; false always takes the first |
| `focus` | none | People who matter more to the game (the player, their friends): `{ ruth: 2 }` scores a beat with Ruth in it twice as high, up to 1 |
| `limit` | 5 (`recount`: 3) | `recap` and `recount`: how many |
| `periods` | night, early morning (5), morning (8), afternoon (12), evening (17), night (21) | The parts of the day `tell` and `when` go by: `[hour it starts, name]`, earliest first |
| `day` | `'Day n'` | A day's name, for `tell` and `when` |

### Words

The words are the game's: an action's `tell` (`{ did: 'took a walk in {place}', doing: 'was walking in {place}' }`: see [actions](deciding.md#actions)), a feeling's (`'enjoyed a good meal'`: see [Reverie](modules/reverie.md)), a breakdown's (`'broke down and went on a bender'`), a wish's (`'dreamed of becoming an expert baker'`), an illness's (`{ on: 'caught a cold', over: 'shook off the cold' }`: see [Athelas](modules/athelas.md)), a kind of interaction's (`'argued with {with}'`: see [Bree](modules/bree.md)), and `words` for any kind of entry (Rocinante's rain: `'rain set in'`). The built-in feelings, Bree's starter kinds and Morgul's feelings have theirs. Without them, an action is told by its label (`'spent an hour juggling'`, `'had a kip'`), a feeling as `'felt <label>'`, an illness as `'came down with <label>'`, and the rest in Irulan's own words: gossip by what it's about ("told Ines about Sam's theft"), grudges by how deep they run and what they're over ("bore Dev a deep grudge over a fight"), harm by how it came ("was hurt in Pip's trap"), blame by why ("blamed Mara, who served it"); or, for what Irulan has no words of its own for, Westmarch's (`describe`). A person is told by their name; where Irulan's own words need a pronoun for them, they say "they" ("as they'd wished"). Like Palantír it's a look: it reads the state and changes nothing.

Telling a rewound world: if the game keeps entries from the `log` events and the player goes back in time (Esper), entries past the point it went back to no longer happened. Drop those on the `seek` event, or tell from the log itself (`tell(since)`), which rewinds with the world.

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
| `--story [min]` | Tell the run as a story at the end ([Irulan](#irulan)), from every entry written in the run, leaving out what scores under `min` (default 0.3; `--story 0` tells everything); with `--who`, only what's about them. A line for each beat with its time, `!` or `!!` by how much it matters, under a heading for each part of each day |
| `--story-by how` | `time` (the default: the timeline), `person` (each person's own beats under their name), `thread` (the storylines, the one that matters most first, then the rest of the town as a timeline), or `day` (paragraphs) |
| `--recap [n]` | Print the `n` headlines (default 5): the beats that matter most, in order |
| `--focus id` | Count what's about this person twice over (`focus`); as many as you like |
| `--feed [min]` | Print the story as it happens ([`feed`](#as-it-happens)), each beat as it completes, what scores under `min` left out (default 0.5) |
| `--as id` | Tell only what this person knows, as they know it ([point of view](#point-of-view)); with `--recap`, what they'd say of what's new (`recount`) |
| `--voice first` | With `--as`, in their own words |
| `--plain` | Don't vary the words (`vary: false`) |
| `--story-size n` | Keep Irulan's story beyond the log (`config.storySize`) and tell from it ([the story kept](#the-story-kept)) |
| `--log-size n` | The log's size (`config.logSize`). Like `--story-size`, passed to the setup file as `config`, which it must hand on to `create()`, as Rocinante does |
| `--no-color` | On a terminal, names are bold and places colored; this (or `NO_COLOR`) prints them plain |

```
day 0 09:44  Ruth           got to The Market
day 0 09:44  Ruth           shopping at The Market
day 0 09:50  Dev            felt Saw something bad · at The Market
day 0 09:50  Dev            saw theft by Sam · at The Market
day 0 10:44  Dev            told Kofi about did:sam:theft · at The Market
```

```
$ node bin/voight-kampff.mjs examples/rocinante.js --days 2 --seed voight-kampff --with harm --story 0.5 --story-by thread

── Pip's snare ─────────────────────────────────────────────────────────  Pip, Mara, Tomas, Officer Vance and others
day 0 12:20 !! Pip set a snare at The Old Barn, then went home and read for an hour.
day 1 07:37 !! Tomas was caught in a snare at The Old Barn, was cut, was hurt in Pip's trap, was in
               pain, was shaken and was furious.
day 1 08:00    Pip told Tomas about a trap, then sulked at home for two hours, with Tomas there.
...
── Sam's nightshade ────────────────────────────────────────────────────  Sam, Tomas, Mara, Pip
day 1 16:53 !! Sam slipped nightshade into the stew at Mara's Cafe, then went home and showered, and
               felt fresh.
day 1 20:56 !! Tomas was poisoned and was hurt by what Sam put in the food.
...
```

Only the run's own world is watched: the `deterministic` and `save-load` checks build more worlds with the same seed, and those would tell it all again. The `esper` check goes back six hours and runs forward again; what that tells a second time is left out. Nothing is printed past the run's last minute (the checks run the world on a little after it), and listening changes nothing in the world: the report and its hash are the same with or without `--log`.

It prints the decisions and time taken, whether it passed (and the failures), the ten most chosen actions, the mean mood by day, and, when people interacted or harmed each other, what passed between them. It exits with 0 when everything passes (and matches the baseline), 1 when something fails or differs, and 2 when no setup file is given. In Tyrell's own repository, `npm run vk` runs a week of Rocinante, `npm run vk:bree` a week of it with Bree's interactions and the `interactions` check, `npm run vk:harm` a week of it with harm (Morgul) and the `harm` check, `npm run vk:log` one day of it printed in full (`--log all`), and `npm run vk:story` one day of it, with Bree's interactions, told as a story (`--story`).

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
| **Modules** | Feelings, breaks and memory kinds; deeds; a household, the Watch and the regulars; theft and stripping as crimes; goods, a pension, a grant and rent, and the cafe's bread chain (flour to bread); its words for a story (every action, feeling, breakdown, dream and illness has its `tell`, and the rain and the blackout have words); lines, two practices and a social act; storylets for rain and a blackout; strangers passing through the main street; genomes for everyone (eyes, hair, traits, talents, instincts); a few drinks that wear off into a sore head, and a cold Kofi brings home that goes round; the player's talks (how someone is, Ruth's radio and a promise to fix it); with `bree`, Bree's starter set of interactions, a natter that interacts, a fight the Watch hears of, a few lines for their words, the natures they read, and a grudge Sam bears Dev; with `harm` (and Bree), Morgul: a brawl at the Belt Gaff paces, a snare Pip sets in the barn, nightshade in the cafe's stew, wounds that heal or fester, first aid, flight and revenge |

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
