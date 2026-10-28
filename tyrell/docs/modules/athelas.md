# Athelas

Conditions that run a course: ale wearing off into a sore head, a cold coming on and the sniffles after it, a toadstool's toxin, a sprained ankle, the flu that lays someone up for two days. Named for the kingsfoil of The Lord of the Rings, the herb Aragorn used in the Houses of Healing.

The ideas come from Merryfolk's body chemistry and illnesses (and Creatures' biochemistry before it): states that come on, change what someone wants and can do while they last, pass in their own time, and sometimes spread. Wounds and poisons ([Morgul](morgul.md)) need a little more, all of it opt-in: how bad an affliction is, a second one adding to the first, phases whose next depends on conditions, care, a phase that ends in death, and quiet phases nobody notices.

- [Courses and phases](#courses-and-phases)
- [What a phase does](#what-a-phase-does)
- [Catching it](#catching-it)
- [Again, and cures](#again-and-cures)
- [Severity](#severity)
- [Branches](#branches)
- [Care](#care)
- [Ending badly](#ending-badly)
- [Quiet phases and telling](#quiet-phases-and-telling)
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
- `'restart'`: back to the first phase;
- `'worsen'`: the new [severity](#severity) adds to the old, up to 1, and the phase they're in runs as long as it would have at the new one (a second beating).

`athelas.cure(id, course?)` (an input) ends one course, or every course, at once: `recovered` with `cured: true`, immunity as usual, but not the course's `then` (which is for a course run out). `athelas.hasten(id, course, minutes)` brings the end of the phase they're in sooner by that many minutes (a friend's visit with soup; a negative number puts it off). Effects can `afflict:<course>`, `cure:<course>` and `hasten:<course>=<minutes>` too (a remedy's `then`, a toadstool eaten).

## Severity

`athelas.afflict(id, course, from?, severity)` (and the effect `afflict:<course>=<severity>`) gives an affliction a severity, 0..1: how bad it is. A course's numbers are written for `sevAt` (0.5); afflicted with none, or at it, its phases run as written. Otherwise, worked out as each phase starts:

- **It stretches the phases**: each lasts `sevStretch ^ ((severity - sevAt) × 2)` times as long (with `sevStretch` 2: twice as long at 1, half as long at 0).
- **It deepens what they do**: the phase's `rates` and `weigh` factors are raised to the power `1 + sevDepth × (severity - sevAt) / sevAt` (with `sevDepth` 1: twice as deep at 1, nothing at all at 0). A rate of 1.6 is 2.56 at severity 1; a weight of 0.5 is 0.25.

A course's own `severity: { at, stretch, depth }` overrides the config's for it. The term `sev:<course>` reads a running course's severity (`sevAt` for one given none, 0 when it isn't running); `sev:tag:<tag>` the worst of the courses with the tag.

## Branches

A phase's `next` says where it goes when it runs out: a phase's id, `null` (the course passes), or branches tried in order, the first whose conditions hold:

```js
{ id: 'bleeding', minutes: [60, 120], next: [{ if: ['tended:cut'], to: 'healing' }, { to: 'festering' }] }
```

The conditions read the person (`ctx.data.course` is the course). With no `next`, or no branch holding, the next phase in order, and after the last, the course passes. A branch can go back to an earlier phase (a fever that returns).

## Care

`athelas.tend(id, course?, by?)` (an input; with no course, every course they have), and the effect `tend` / `tend:<course>` (the person tends the target, or themselves with none), mark a course as tended: how well, 0..1, is `tendBase` (0.5), plus the rest of the way to 1 by the tender's share of `tendSkill` (a skill; none by default). The phase they're in ends sooner by `tendHasten` (0.25) of what's left, times how well. The mark lasts the course out (a better tending raises it, a worse one doesn't lower it), and `tended:<course>` reads it, for branches and choices. With Morgul on, its `tend` effect is this and more: someone down is helped up.

## Ending badly

A phase with `dies` (true, or the why: `'the plague'`) ends in death as it runs out: a departure through [Cradle](cradle.md) (`'died'`, or the why), with grief and inheritance. Without Cradle nobody dies: they pull through, and the course goes on as the phase's `next` says. A wound's (Morgul's) dies only as often as its `lethality` knob says (0 by default); spared, they pull through the same way.

## Quiet phases and telling

A phase with `quiet` is one nobody notices, the one who has it included: poison working. It gives no feeling (even if it names one), and `under:` reads the course as not there (nor in `under:tag:` or the count), so lines and choices can't know of it; its `rates`, `weigh` and `blocks` work all the same, and `athelas.of(id)` shows it with `quiet: true` for the game (the truth: the inspector marks it unnoticed). A phase with `tells` is when it shows: the `shows` event as it starts, and Morgul's onlookers and suspicion begin then.

```js
A.course({ id: 'nightshade', label: 'Nightshade', tags: ['poison'], phases: [
  { id: 'working', minutes: [180, 360], quiet: true, rates: { hunger: 0.6 } },
  { id: 'sick', label: 'violently sick', minutes: [600, 1080], tells: true, stop: true, weigh: { sleep: 2, '*': 0.4 }, feel: 'poisoned' },
] });
```

## Why not Reverie

Reverie is the mind: feelings, mood, memories, beliefs. A course is the body. It runs on a clock of its own (phases with durations), changes how fast needs rise, spreads from person to person and leaves immunity behind, none of which feelings do; and a game may want ale and colds without the whole of Reverie. With Reverie on, a phase's `feel` lets a course show in the mood, and its `weigh` works like a feeling's `boost`.

## State

In `world.s.mod.athelas`, made the first time anyone is afflicted (a world without courses saves and hashes as if Athelas were off):

| Key | Holds |
|---|---|
| `on` | By person, by course: `{ p, since, until, k, from?, sev?, tend? }` (the phase index, its start and end, the timer's token, who it was caught from, its severity, how well it's been tended: the last two only once given) |
| `immune` | By person, by course: until when (let go at midnight once past) |
| `k` | The last timer token |

Phase changes are queue items addressed to the module, so they save and rewind.

## API

`world.athelas`. **Input** methods are recorded and safe from the game.

| Method | Returns | |
|---|---|---|
| `course(def)` | this | Declares a course: [CourseDef](#coursedef) |
| `afflict(id, course, from?, severity?)` | boolean | **Input** (applies at once). Afflicts someone, at a severity if given; false if it didn't take (immune, already has it and `again: 'ignore'`, unknown) |
| `cure(id, course?)` | void | **Input.** Ends a course, or all of them |
| `hasten(id, course, minutes)` | void | **Input.** The phase they're in ends that much sooner (later, if negative) |
| `tend(id, course?, by?)` | void | **Input.** Tends a course (or all of them), by someone whose skill counts |
| `of(id)` | array | The courses running for someone: `{ course, label, phase, phaseLabel, since, until, from?, severity?, tended?, quiet? }` |
| `severityOf(id, course)` | number or undefined | A running course's severity (`sevAt` with none given) |
| `phaseOf(id, course)` | CoursePhase or undefined | The phase a course is in, quiet or not |
| `immune(id, course)` | boolean | Immune now? |
| `courses` | Map | The declared courses |
| `applyAfflict(id, course, from?, severity?)`, `applyCure(id, course?)`, `applyHasten(id, course, minutes)`, `applyTend(id, course?, by?)` | | **Engine** versions |

### CourseDef

| Field | Default | Meaning |
|---|---|---|
| `id` | required | |
| `label` | the id | A readable name |
| `tags` | none | Free labels: `under:tag:<tag>` |
| `phases` | required | The phases, in order |
| `contagion` | none | `{ chance, resist? }`: the chance per hour together, and considerations on the catcher |
| `immunity` | 0 | Minutes after it passes when it can't come on again |
| `again` | `'ignore'` | `'ignore'`, `'extend'`, `'restart'` or `'worsen'` |
| `severity` | none | `{ at?, stretch?, depth? }`: its own numbers for how [severity](#severity) changes it |
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
| `next` | the next in order | Where it goes when it runs out: a phase's id, `null` (it passes), or [branches](#branches) `[{ if?, to }]` |
| `dies` | false | It [ends in death](#ending-badly): true, or the why |
| `quiet` | false | Nobody notices it: no feeling, `under:` reads nothing |
| `tells` | false | The harm shows as it starts: `shows`, and Morgul's onlookers and suspicion |
| `hurts` | 1 (a quiet phase 0) | How much of the severity it still counts toward Morgul's `hurt` |

## Terms, effects, events and log

Terms: `under:<course>` (the phase's id while it runs, else `false`; a quiet phase reads `false`), `under:tag:<tag>` (any course with the tag), `under` (how many courses), `immune:<course>`, `sev:<course>` and `sev:tag:<tag>` (its severity), `tended:<course>` (how well it's been tended; `tended` alone, the best of any). Effects: `afflict:<course>` (from the context's target, if any; `=<severity>` for one), `cure:<course>`, `cure` (all), `hasten:<course>=<minutes>`, `tend` / `tend:<course>` (the person tends the target, or themselves).

| Event | Payload |
|---|---|
| `afflicted` | `{ id, course, from, label, again?, severity?, quiet? }` |
| `course` | `{ id, course, phase, label, quiet? }`: a phase started |
| `shows` | `{ id, course, phase, label }`: a phase that tells started |
| `tended` | `{ id, by, courses, quality }` |
| `recovered` | `{ id, course, cured, label }` |

Log entries: `afflicted`, `course`, `shows`, `tended`, `fatal`, `recovered`.

## Config

`Tyrell.create({ moduleConfig: { athelas: { ... } } })`:

| Field | Default | Meaning |
|---|---|---|
| `contagion` | 1 | Headline knob: how catching courses are (every course's chance an hour together, times it); 0: nothing spreads |
| `duration` | 1 | Headline knob: how long courses last (every phase's minutes, times it, as the phase starts) |
| `sevAt`, `sevStretch`, `sevDepth` | 0.5, 2, 1 | How [severity](#severity) changes a course: the severity it's written for, how much it stretches the phases, how much it deepens what they do |
| `tendBase`, `tendSkill`, `tendHasten` | 0.5, null, 0.25 | [Care](#care): how good a tending is with no skill, the skill that makes it better, and how much sooner it brings the phase's end |

A person's own `tune: { athelas: { contagion, duration } }` multiplies them for them: how easily they catch things, how long things last with them. See [Tuning](../tuning.md#athelas); during play, `world.tune('athelas', { ... })` (a phase already running keeps its end).

## With other modules

- **Bicameral** asks Athelas how fast needs rise (the module hook `rate`), and Athelas's `consider` and `block` hooks weigh and rule out options.
- **Reverie**: a phase's `feel`.
- **Cradle**: a phase that ends in death departs through it.
- **Morgul**: wounds and poisons are courses at their severity; it asks how fast a wound heals (its `healing` knob), whether a wound's death comes (`lethality`), and hears when a course tells and when it passes.
- **Skills**: tending is the better for `tendSkill`.
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
