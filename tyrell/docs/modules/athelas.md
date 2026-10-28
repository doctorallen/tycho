# Athelas

Conditions that run a course: ale wearing off into a sore head, a cold coming on and the sniffles after it, a toadstool's toxin, a sprained ankle, the flu that lays someone up for two days. Named for the kingsfoil of The Lord of the Rings, the herb Aragorn used in the Houses of Healing.

The ideas come from Merryfolk's body chemistry and illnesses (and Creatures' biochemistry before it): states that come on, change what someone wants and can do while they last, pass in their own time, and sometimes spread.

- [Courses and phases](#courses-and-phases)
- [What a phase does](#what-a-phase-does)
- [Catching it](#catching-it)
- [Again, and cures](#again-and-cures)
- [Why not Reverie](#why-not-reverie)
- [State](#state)
- [API](#api)
- [Terms, effects, events and log](#terms-effects-events-and-log)
- [Config](#config)
- [With other modules](#with-other-modules)
- [Example](#example)

## Courses and phases

A course is a list of phases. Afflicting someone starts the first; each phase lasts its `minutes` (a range is drawn from the person's stream, `scale` considerations on the person stretch or shorten it, and so does the headline knob `duration`), then the next starts; after the last, the course passes. Each change is a queued event, so it happens on time whether or not anyone is watching, and rewinds with everything else.

```js
world.athelas.course({
  id: 'cold', label: 'A cold', tags: ['illness'], immunity: 3 * 1440, then: ['remember:shook_off_a_cold'],
  contagion: { chance: 0.08, resist: [{ input: 'trait.hardiness', out: [1.2, 0.4] }] },
  phases: [
    { id: 'coming_on', label: 'coming on', minutes: [360, 600], spreads: false },
    { id: 'sniffles', label: 'the sniffles', minutes: [900, 1500], scale: [{ input: 'trait.hardiness', out: [1.4, 0.6] }],
      rates: { energy: 1.6 }, weigh: { sleep: 1.4, 'tag:work': 0.6, '*': 0.8 }, feel: 'under_the_weather' },
  ],
});
world.athelas.afflict('ana', 'cold');
```

When the last phase ends the course passes: it's logged and emitted as `recovered`, its `then` effects run, and with `immunity` the person can't have it again for that many minutes.

## What a phase does

While a phase lasts:

- **`rates`**: needs rise this many times as fast (`{ energy: 1.6 }` tires them, `{ hunger: 0.3 }` kills the appetite). It multiplies with an action's own `rates`, and with any other course's. Levels are kept up to date at every change, so a need carries on smoothly across a phase's edges, and the moment a need turns urgent is worked out again.
- **`weigh`**: options weigh this much more or less. An entry by the option's id wins, then the first `tag:<tag>` the action has, then `'*'` for everything else. The part is named for the course and phase: `A cold: the sniffles`.
- **`blocks`**: actions or tasks (ids, or `tag:<tag>`) are ruled out, with the course and phase as the reason.
- **`feel`**: a Reverie feeling given when it starts (it lasts as the feeling says). **`then`**: effects when it starts.
- **`stop`**: when it starts they stop what they're doing and choose again, just after (laid up in bed: their phase's `weigh` sends them home).

## Catching it

A course with `contagion` spreads by company: whenever two people spend time together (Tyrell's `met`: one starts something where the other is doing something, for a few minutes or more), each course one of them has in a catching phase may pass to the other, with chance `1 - (1 - chance × contagion) ^ hours together` (`contagion` is the headline knob: the world's times the catcher's own), times the `resist` considerations (the catcher is the person, the carrier their target). A phase with `spreads: false` doesn't spread (a cold coming on). Someone who already has it, or is immune, doesn't catch it. The draw is from the catcher's stream. `afflicted` carries `from`, and `athelas.of(id)` keeps who they caught it from.

## Again, and cures

Afflicted with a course they already have:

- `again: 'ignore'` (the default): nothing happens;
- `'extend'`: the phase they're in runs on as long again (another pint keeps them merry longer);
- `'restart'`: back to the first phase.

`athelas.cure(id, course?)` (an input) ends one course, or every course, at once: `recovered` with `cured: true`, immunity as usual, but not the course's `then` (which is for a course run out). `athelas.hasten(id, course, minutes)` brings the end of the phase they're in sooner by that many minutes (a friend's visit with soup; a negative number puts it off). Effects can `afflict:<course>`, `cure:<course>` and `hasten:<course>=<minutes>` too (a remedy's `then`, a toadstool eaten).

## Why not Reverie

Reverie is the mind: feelings, mood, memories, beliefs. A course is the body. It runs on a clock of its own (phases with durations), changes how fast needs rise, spreads from person to person and leaves immunity behind, none of which feelings do; and a game may want ale and colds without the whole of Reverie. With Reverie on, a phase's `feel` lets a course show in the mood, and its `weigh` works like a feeling's `boost`.

## State

In `world.s.mod.athelas`, made the first time anyone is afflicted (a world without courses saves and hashes as if Athelas were off):

| Key | Holds |
|---|---|
| `on` | By person, by course: `{ p, since, until, k, from? }` (the phase index, its start and end, the timer's token, who it was caught from) |
| `immune` | By person, by course: until when (let go at midnight once past) |
| `k` | The last timer token |

Phase changes are queue items addressed to the module, so they save and rewind.

## API

`world.athelas`. **Input** methods are recorded and safe from the game.

| Method | Returns | |
|---|---|---|
| `course(def)` | this | Declares a course: [CourseDef](#coursedef) |
| `afflict(id, course, from?)` | boolean | **Input** (applies at once). Afflicts someone; false if it didn't take (immune, already has it and `again: 'ignore'`, unknown) |
| `cure(id, course?)` | void | **Input.** Ends a course, or all of them |
| `hasten(id, course, minutes)` | void | **Input.** The phase they're in ends that much sooner (later, if negative) |
| `of(id)` | array | The courses running for someone: `{ course, label, phase, phaseLabel, since, until, from? }` |
| `immune(id, course)` | boolean | Immune now? |
| `courses` | Map | The declared courses |
| `applyAfflict(id, course, from?)`, `applyCure(id, course?)`, `applyHasten(id, course, minutes)` | | **Engine** versions |

### CourseDef

| Field | Default | Meaning |
|---|---|---|
| `id` | required | |
| `label` | the id | A readable name |
| `tags` | none | Free labels: `under:tag:<tag>` |
| `phases` | required | The phases, in order |
| `contagion` | none | `{ chance, resist? }`: the chance per hour together, and considerations on the catcher |
| `immunity` | 0 | Minutes after it passes when it can't come on again |
| `again` | `'ignore'` | `'ignore'`, `'extend'` or `'restart'` |
| `then` | none | Effects when it passes (not when cured) |

### CoursePhase

| Field | Default | Meaning |
|---|---|---|
| `id` | required | The phase's name (`under:<course>` reads it) |
| `label` | none | A readable name |
| `minutes` | required | Minutes, or `[min, max]` |
| `scale` | none | Considerations on the person, multiplied into the minutes |
| `rates` | none | `{ need: multiplier }` on how fast needs rise |
| `weigh` | none | `{ id or 'tag:<tag>' or '*': factor }` |
| `blocks` | none | Actions or tasks ruled out: ids or `tag:<tag>` |
| `feel` | none | A Reverie feeling given when it starts |
| `then` | none | Effects when it starts |
| `stop` | false | They stop and choose again when it starts |
| `spreads` | true | Whether it's catching in this phase (with `contagion`) |

## Terms, effects, events and log

Terms: `under:<course>` (the phase's id while it runs, else `false`), `under:tag:<tag>` (any course with the tag), `under` (how many courses), `immune:<course>`. Effects: `afflict:<course>` (from the context's target, if any), `cure:<course>`, `cure` (all), `hasten:<course>=<minutes>`.

| Event | Payload |
|---|---|
| `afflicted` | `{ id, course, from, label, again? }` |
| `course` | `{ id, course, phase, label }`: a phase started |
| `recovered` | `{ id, course, cured, label }` |

Log entries: `afflicted`, `course`, `recovered`.

## Config

`Tyrell.create({ moduleConfig: { athelas: { ... } } })`:

| Field | Default | Meaning |
|---|---|---|
| `contagion` | 1 | Headline knob: how catching courses are (every course's chance an hour together, times it); 0: nothing spreads |
| `duration` | 1 | Headline knob: how long courses last (every phase's minutes, times it, as the phase starts) |

A person's own `tune: { athelas: { contagion, duration } }` multiplies them for them: how easily they catch things, how long things last with them. See [Tuning](../tuning.md#athelas); during play, `world.tune('athelas', { ... })` (a phase already running keeps its end).

## With other modules

- **Bicameral** asks Athelas how fast needs rise (the module hook `rate`), and Athelas's `consider` and `block` hooks weigh and rule out options.
- **Reverie**: a phase's `feel`.
- **Fellowship** isn't needed: contagion follows who spends time together, whoever they are.
- **Voice**: lines can read `under:cold` (`*sniff*`), and an answer's effects can `cure:cold` (a remedy offered).

## Example

Merryfolk's ale, a toadstool and the flu:

```js
const A = world.athelas;
A.course({ id: 'ale', label: 'Ale', again: 'extend', phases: [
  { id: 'merry', label: 'merrily tipsy', minutes: 240, rates: { energy: 1.5 }, weigh: { 'tag:work': 0.6, dance: 1.4 }, feel: 'tipsy' },
  { id: 'sore_head', label: 'a sore head', minutes: 300, weigh: { 'tag:loud': 0.5, sleep: 1.3 }, feel: 'sore_head' },
] });
A.course({ id: 'toxin', label: 'A bad toadstool', tags: ['illness'], phases: [
  { id: 'poorly', minutes: [600, 900], rates: { hunger: 0.3 }, weigh: { sleep: 1.5, '*': 0.4 } },
] });
A.course({ id: 'flu', label: 'The flu', tags: ['illness'], immunity: 10 * 1440, phases: [
  { id: 'laid_up', label: 'laid up', minutes: [2300, 3700], stop: true, weigh: { sleep: 2, eat_home: 2, '*': 0.05 }, blocks: ['tag:work'], feel: 'laid_up' },
] });
world.action({ id: 'ale', at: 'tag:inn', minutes: 45, relieves: { fun: 0.4 }, then: ['afflict:ale'] });
world.action({ id: 'remedy', minutes: 5, if: ['under:tag:illness', 'has:remedy'], base: 0.5, then: ['take:remedy', 'cure:toxin', 'cure:cold'] });
world.on('afflicted', (e) => { if (e.course === 'flu') chronicle(`${world.get(e.id).name} is laid up with the flu.`); });
```
