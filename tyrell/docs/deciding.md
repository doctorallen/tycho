# Deciding (Bicameral)

Bicameral is the core's decision maker, named for Westworld's bicameral mind: the voice that tells a host what to do until it becomes their own. It holds the needs, the layered priorities (story, job, routine, needs), the weighing of every option, the pick, and the habits people learn.

- [Needs](#needs)
- [Actions](#actions)
- [The layered stack](#the-layered-stack)
- [Routines](#routines)
- [Jobs and shifts](#jobs-and-shifts)
- [Directives](#directives)
- [Urgent and desperate needs](#urgent-and-desperate-needs)
- [What an option is worth](#what-an-option-is-worth)
- [Considerations and curves](#considerations-and-curves)
- [The pick](#the-pick)
- [When people think](#when-people-think)
- [Habits and rewards](#habits-and-rewards)
- [Config](#config)
- [Asking why](#asking-why)

## Needs

```js
world.need({ id: 'hunger', rise: 0.06, start: 0.3, emotion: 'irritable' });
world.need({ id: 'fun', rise: 0.05, urgent: 1.1, emotion: 'bored' });   // never breaks a routine
```

| Field | Type | Default | Meaning |
|---|---|---|---|
| `id` | string | required | The need's id, used in `relieves`, `rates`, `need.<id>` conditions |
| `rise` | number | required | How much the level rises per game hour (0 calm to 1 desperate). 0.06 means empty to desperate in about 17 hours |
| `start` | number | 0.2 | The level new people start at (a person's `needs` overrides it) |
| `curve` | Curve | `'pow1.5'` | Turns the level into urgency when weighing relief. See [curves](#considerations-and-curves) |
| `urgent` | number | `config.urgent` (0.85) | Above this level the need is urgent and can lift an option above the routine; at `max(urgent, 0.97)` it's desperate and lifts above work. Set it above 1 for needs that should never break a routine (fun, company, hygiene) |
| `label` | string | none | For your own UI; the engine doesn't read it |
| `emotion` | string | none | With Reverie: the emotion it shows as when the level is above 0.7 ('tired', 'lonely', 'irritable') |

A need's level is computed, not ticked: the stored value plus `rise` times the hours since it was stored, clamped to 0..1. While someone is doing an action that relieves the need, the level drops gradually through the action (by the fraction done), and the full relief is applied when the action ends. While someone is doing an action with `rates`, the need rises at `rise × rate` instead.

Read a level with `world.needOf(id, need)`. There's no public input that sets a need directly; see [Integration: custom inputs](integration.md#custom-inputs) if the game needs one (feeding someone, say).

## Actions

```js
world.action({
  id: 'eat_cafe', label: 'eating at the cafe',
  at: 'tag:food', slot: 'seat', minutes: [30, 45],
  relieves: { hunger: [0.5, 0.7], company: 0.1 },
  price: 6, pose: 'sit', tags: ['social', 'food'], feels: ['good_meal'],
});
```

Every field of `ActionDef`:

| Field | Type | Default | Meaning |
|---|---|---|---|
| `id` | string | required | The action's id |
| `label` | string | none | A readable name: chronicles and Joi's prompts use it |
| `minutes` | number or `[min, max]` | required | How long it takes. A range is drawn from the person's stream |
| `relieves` | `{ need: number or [min, max] }` | none | How much each need drops when it's done. A range is drawn at the end; the weighing uses the middle |
| `base` | number | 0 | A flat appeal added to the relief, for things people do for their own sake |
| `rates` | `{ need: number }` | none | While doing it, each listed need rises at its `rise` times this rate (sleeping: `{ hunger: 0.4 }`). Urgent checks are predicted at that rate too |
| `at` | PlaceSpec or PlaceSpec[] | `null` (here) | Where it happens. See [place specs](places.md#place-specs) |
| `slot` | string | none | The slot it needs at the place. Claimed when the action starts, released when it ends |
| `fill` | boolean | true | When chosen by a routine, job or directive with an end time, stretch to last until then (sitting at the bar all evening). `false` keeps its own length |
| `if` | Cond[] | none | Conditions to start it (checked for the person, at the candidate place, with the target) |
| `then` | Effect[] | none | Effects when it ends (not when it's interrupted) |
| `who` | Cond[] | none | Who may do it at all |
| `hours` | `[from, to)` | always | Only when the arrival time falls in these hours |
| `job` | string | none | Only for people with this job. Also lets staff do it in a closed place (see [Jobs](#jobs-and-shifts)) |
| `rank` | number | 0 | The rank it's chosen at freely. Below 0 means "only when required" (by a routine, job, directive, break or plan) |
| `considerations` | Consideration[] | none | Extra factors multiplied into the weight |
| `cooldown` | minutes | none | Minutes before the same person may choose it again (after it ends) |
| `tags` | string[] | none | Free labels. The engine reads `'sleep'` (exempt from the repeat penalty; Voight-Kampff's sleep check), `'social'` (Fellowship's regard factor), `'illegal'` (Mentat's cost), and any tag a Reverie feeling `boost`s |
| `target` | `'person'` | none | Aimed at someone: one option per suitable person at the place (up to six) |
| `targetIf` | Cond[] | none | Conditions on the target: `ctx.target` is the candidate (`'regard>0.2'`, `'target.is:child'`) |
| `pose` | string | `'idle'` | What the body shows while doing it ('sit', 'work', 'sleep') |
| `says` | string | none | Declared for a line key to say on starting; this version of the engine doesn't read it |
| `against` | string[] | none | Values it goes against (Reverie): weighs less for people who hold them, and costs them stress and a guilty conscience |
| `price` | number | none | Paid when it starts, to the place's owner (Ceres). Blocks it if they can't afford it |
| `buys` | `{ item: n }` | none | Goods bought from the place's stock when it starts (Ceres) |
| `uses` | `{ item: n }` | none | Goods used up when it starts; blocks it if they don't have them (Ceres) |
| `gives` | `{ item: n }` | none | Goods gained when it ends (Ceres), and what Mentat's `get:` searches for |
| `wage` | number | none | Pay per hour, paid at the end by the place's owner (Ceres) |
| `social` | string | none | A social act resolved with the target when it ends (Cityspeak) |
| `feels` | string[] | none | Feelings the person gets when it ends (Reverie) |
| `deed` | string | none | A deed done to the target when it ends: the same path as `world.did` (Reverie, Fellowship) |
| `crime` | string | none | Doing it is this crime: everyone at the place may witness it (Wormtongue) |
| `cost` | number | none | Extra planning cost in minutes (Mentat) |
| `data` | object | none | Anything the game wants to attach; the engine doesn't read it |

An action is a free choice only if it has `relieves` or `base`, its `rank` isn't below 0, and the person has its `job` (if it names one). Actions without either are still possible when something requires them.

## The layered stack

Every option has a **rank**. Only options at the highest rank available are considered at all; weight decides among them. The ranks come from the layer that asked:

| Rank | Layer | Where it comes from |
|---|---|---|
| 4 | `break` | A Reverie breakdown (very low mood) |
| 3 | `story` | A directive (`world.direct`); its `rank` can change this |
| 2.5 to 2.8 | `need` | A desperate need (0.97 and up): above work. The worse it gets, the higher |
| 2 | `job` | The job's action, on shift |
| 1.5 | `need` | An urgent need (above `urgent`): above the routine |
| 1 | `routine` | The routine entry for this hour (an entry's `rank` can change this) |
| 0 | `need` | Free choices (an action's `rank` can change this) |
| plan's rank | `plan` | A task's steps (Mentat) run at the rank the task was chosen at |
| leader's rank | `follow` | Someone following a leader (`world.follow`) |
| -1 | `idle` | Waiting with nothing to do |

The numbers in `urgentRank` (1.5) and `desperateRank` (2.5) are [config](#config).

What a person is doing carries its rank (`world.get(id).doing.rank`). While they're busy, they only switch to something new if it outranks what they're doing, or if the routine entry, shift or directive that started it has run out.

## Routines

A routine says what's expected when: from this hour, be at this place doing this, until the next entry.

```js
world.person('ruth', {
  home: 'flat_4',
  routine: [
    [8, null, '*'],               // from 8:00: free time
    [9.5, 'market', 'buy_food'],  // 9:30: shopping
    [9.75, null, '*'],            // 9:45: free again
    [18, 'tag:food', 'eat_cafe'], // 18:00: dinner out
    [19, null, '*'],
    [22, 'home', 'sleep'],        // 22:00 until 8:00 tomorrow: bed
  ],
});
```

Each entry is `[hour, place, activity, extra?]`:

| Part | Meaning |
|---|---|
| `hour` | When it starts, 0 to 24, fractional (9.75 is 9:45). Entries are sorted by hour |
| `place` | A [place spec](places.md#place-specs), or `null` |
| `activity` | An action id, a task id, or `'*'` |
| `extra.rank` | The rank of this entry. Default 1. Use 2 to make an entry hold like work |
| `extra.with` | A person id, shown on the body as `body.with` (a hint for the game: who they're with). The engine doesn't otherwise act on it |

**An entry lasts until the next one.** The last entry of the day runs until the first entry of the next day, so a routine with one entry fills the whole day, every day. Plan the day as a sequence.

**`'*'` means two different things:**

- `[19, null, '*']` (or `'*'` with `'here'`, or the activity `'free'` with no place): **free time.** Nothing is required; the person's needs decide.
- `[7, 'home', '*']`: **anything at that place.** Every action the place offers becomes an option at the routine's rank: actions whose `at` matches the place (its id, a tag it has, `'home'`/`'work'` for theirs), actions the place lists in `offers`, and also actions with no `at` (they can be done anywhere). Each gets the required bonus (+1 to its base), so the choice among them is close to even; each choice takes its own `minutes` and then they choose again, leaving on time for the next entry. Actions with `rank: -1` and job actions they don't hold are included in the list (job actions are then ruled out), so keep "only when required" actions that shouldn't happen at home (sulking, a bender) at places that aren't used with `'*'`, or give them `who`/`if` conditions.

**Fill.** When a routine entry names an action (not `'*'`), the action stretches to the end of the entry: `[19, 'bar', 'drink']` followed by `[21.5, null, '*']` means drinking at the bar until half past nine, however long `drink` normally takes. If the entry ends in under 5 minutes, the action lasts the shorter of its own length and 5 minutes. Set `fill: false` on an action to keep its own length.

**Variants** choose a different plan by day or by condition. The first variant that fits is used:

```js
world.person('lena', {
  home: 'flat_5',
  routine: [
    { days: [5, 6], plan: [[8, null, '*'], [23, 'home', 'sleep']] },                          // weekends
    { when: ['fact:raining'], plan: [[8, 'home', '*'], [22, 'home', 'sleep']] },             // rain: stay in
    { plan: [[8, null, '*'], [19, 'bar', 'drink'], [21.5, null, '*'], [23, 'home', 'sleep']] },
  ],
});
```

| Field | Meaning |
|---|---|
| `days` | Days of the week it applies on: `world.day % config.week`, 0 to 6 by default |
| `when` | Condition strings (not functions: routines are saved with the person). Checked whenever the routine is read, so a variant can take over mid-day when a fact changes; people notice at their next decision |
| `plan` | The entries |

If no variant fits, the person has no routine that day (their needs decide).

## Jobs and shifts

```js
world.action({ id: 'sell', at: 'market', slot: 'till', minutes: 60, job: 'grocer', rank: -1, pose: 'work' });
world.person('dev', {
  home: 'flat_3',
  job: { id: 'grocer', place: 'market', action: 'sell', shifts: [[8, 16]], days: [0, 1, 2, 3, 4, 5], wage: 0 },
});
```

| Field | Meaning |
|---|---|
| `id` | The job's id; actions name it in `job` |
| `place` | Where the work is. The job's action is required here, whatever the action's own `at` says |
| `action` | The action (or task) done on shift |
| `shifts` | `[start, end)` hours, wrapping past midnight (`[17, 1]`). Several shifts are allowed |
| `days` | Days of the week the shift applies, by the day the shift starts on. Default every day |
| `wage` | Pay per hour of the job's action (Ceres), paid by the place's owner |

On shift, the job's action is required at rank 2, until the shift ends, and fills the shift. Only a desperate need (or a break or a directive) takes them off it.

**Staff in a closed place.** A place that's closed (by its `hours` or a `closed:<id>` fact) turns everyone away, except for actions that name the person's job (`job: 'grocer'`) at their job's place. So give work actions `job`, or a baker whose shift starts before the bakery opens will be turned away at the door. This only works for actions: a job whose `action` is a task is blocked like anyone else.

Give work actions `rank: -1` so nobody chooses them in their free time.

## Directives

The story layer: tell someone to do something, above their job and routine.

```js
world.direct('kofi', { do: 'eat_cafe' });                                      // once, as soon as possible
world.direct('vance', { do: 'patrol', at: 'market', until: world.now + 120 }); // for two hours
world.direct('ruth', { do: 'fix_radio' });                                     // a task: Mentat plans it
world.direct('kofi', null);                                                    // release them
```

| Field | Default | Meaning |
|---|---|---|
| `do` | required | An action or task id |
| `at` | the action's `at` | Where, as a place spec |
| `target` | none | The person it's aimed at |
| `until` | none | Until this time (minutes). An action chosen by a directive with `until` fills to that time |
| `rank` | 3 | The rank. Use something lower to let a job or urgent need win |
| `repeat` | false | Keep doing it until `until`, not just once |
| `label` | none | For your own use; the engine doesn't read it |
| `done` | (set by the engine) | Set when the action starts, or when the task's plan completes |

A directive is active while it isn't done (or repeats) and `until` hasn't passed. It stays on the person (marked `done`) until you replace it or clear it with `null`. `world.direct` makes the person stop what they're doing and think again at once.

## Urgent and desperate needs

An option that's chosen freely (not required) gets its rank lifted when it meets an urgent need, but only if it really meets it: the action must relieve that need by 0.3 or more (the middle of its range times the place's `quality`).

- Level at arrival at or above `urgent` (default 0.85): rank `config.urgentRank` (1.5), above routines.
- Level at or above `max(urgent, 0.97)`: rank `config.desperateRank + (level - 0.97) × 10` (2.5 to 2.8), above work. So someone starving wakes up even when exhausted.

The level checked is the level when they'd arrive, so a long walk counts. Needs with `urgent` above 1 never lift anything: use that for needs that should color a day without ever breaking it.

People don't wait to notice: when someone starts anything, Tyrell works out when their next need will cross urgent, desperate or 1 (at the current action's `rates`), and schedules a check for that minute.

## What an option is worth

For each option that isn't ruled out, the weight is built up in parts. `world.why(id).picked.parts` and `world.whyNot(id, action)` show them.

**Base.**

```
base = action.base
     + sum over relieved needs: curve(level at arrival) × min(relief × quality, max(level, 0.05))
```

Relief beyond what the person needs counts for nothing (eating when barely hungry is worth little). A required option (from a routine, job or directive) adds 1 to `max(base, 0)`, so it's always worth something. An option with a base of 0 or less is ruled out ("nothing in it for them").

**Multipliers**, in this order (a factor of exactly 1 isn't listed):

| Part | Factor |
|---|---|
| considerations | Each consideration's output, compensated for how many there are (see below). A zero vetoes the option |
| `habit` | The person's habit for this action (1 when they've none) |
| `travel` | `1 / (1 + minutes / config.travelScale)`; 30 minutes away halves it |
| `did it last` | `config.repeat` (0.75) for a free choice that's the same as the last thing they did, ended under 90 minutes ago (actions tagged `'sleep'` are exempt) |
| `carrying on` | `config.inertia` (1.15) for what they're doing now, at the same place |
| Reverie | A feeling's `boost` for the action's tags; `against <value>` for actions against values they hold |
| Fellowship | `regard` for `'social'` actions with a target: `clamp(1 + regard × 0.8 + compat × 0.2, 0.1, 2)` |
| Ceres | `price`: `clamp(1 - share × (0.4 + thrift × 0.8), 0.05, 1)`, where share is price over money |
| Cityspeak | `<practice>: <role>`: the practice's `boost` (1.5) for role actions of people filling the role |
| your modules | Whatever `consider` returns |

**Ruled out** before weighing, with the reason shown in the inspector: no such action; needs a job they don't have; `who` fails; cooling down; can't get there (infinite travel); `hours` don't include the arrival time; the place is closed at arrival (except staff, above); no free slot (unless they already hold it); `if` fails; the target isn't around; or a module blocks it (Ceres: can't afford it, sold out, needs an item).

Slot `who` conditions ([places](places.md#slots)) are only checked when the slot is claimed, not here. Someone who isn't allowed the slot can choose the action, walk there and fail on arrival.

## Considerations and curves

A consideration takes an input, normalizes it over a range, passes it through a curve and maps the result to an output range. The result multiplies the weight.

```js
const night = { name: 'night', input: 'hour', range: [0, 24],
  curve: [[0, 1], [6 / 24, 1], [8 / 24, 0.12], [20 / 24, 0.3], [22.5 / 24, 1], [1, 1]] };
world.action({ id: 'sleep', at: 'home', slot: 'bed', minutes: [420, 510], relieves: { energy: 0.95 },
  rates: { hunger: 0.4 }, tags: ['sleep'], pose: 'sleep', considerations: [night] });

world.action({ id: 'gamble', at: 'tag:casino', minutes: 60, base: 0.2,
  considerations: [{ name: 'nerve', input: 'trait.courage', out: [0.2, 1.5] },
                   { name: 'broke', input: 'money', range: [0, 50], curve: 'smooth' }] });
```

| Field | Default | Meaning |
|---|---|---|
| `name` | the input string | A label for the inspector |
| `input` | required | A term from the [condition language](conditions.md) (`'need.hunger'`, `'trait.courage'`, `'hour'`, `'money'`, `'mood'`, `'regard'`...), `'travel'` (minutes to the place), or a function `(ctx) => number` |
| `range` | `[0, 1]` | The input range that maps to 0..1. Inputs outside it clamp |
| `curve` | `'linear'` | How 0..1 maps to 0..1 |
| `out` | `[0, 1]` | The output range the curve's 0..1 maps to. `[0.5, 1.5]` makes a consideration that can raise as well as lower |

The input is read with the option's context: the person, the candidate `place`, the `target`, the `action`. Any term works; terms that don't exist read as a fact of that name (usually nothing, so 0). In this version the inputs `'habit'` and `'crowd'` mentioned in the type comments aren't terms (they read 0), and `'price'` needs a good (`'price.radio'`); use a function input for anything else, such as `(ctx) => ctx.world.ring.crowd(ctx.place)`.

Curves:

| Curve | f(x) |
|---|---|
| `'linear'` | x |
| `'inverse'` | 1 - x |
| `'quadratic'` | x² |
| `'cubic'` | x³ |
| `'sqrt'` | √x |
| `'pow1.5'` | x^1.5 (the default for needs) |
| `'smooth'` | x² (3 - 2x) |
| `'logistic'` | 1 / (1 + e^(-12 (x - 0.5))) |
| `'step'` | 1 at 0.5 and above, else 0 |
| `[[x, y], ...]` | Points, linearly interpolated, flat beyond the ends |
| a function | `(x) => y`, clamped to 0..1 |

`Tyrell.curveAt(curve, x)` evaluates one, and `world.mind.consider(consideration, ctx)` evaluates a consideration.

**Compensation.** Multiplying many factors under 1 drags an option down just for having more considerations. With `config.compensate` (on by default), each factor `v` between 0 and 1 of an option with `n > 1` considerations is raised to `v + (1 - v) × (1 - 1/n) × v`, the compensation from Dave Mark's Infinite Axis Utility System. A 0 still vetoes and a 1 stays 1.

## The pick

1. Drop options that are ruled out or weigh 0.
2. Keep only the highest rank.
3. Drop options under `config.cut` (0.25) of the best weight at that rank.
4. Keep the best `config.top` (3), heaviest first (ties by id).
5. Draw one, with probability proportional to `weight ^ config.power` (2), from the person's own stream.

Squaring the weights makes the best option likely without making it certain. Setting `top: 1` makes people predictable; a lower `power` makes them whimsical.

If nothing is left, the person waits where they are (`config.idle` minutes, 20 by default) and thinks again.

## When people think

People decide at these moments, all of them queued events:

- an action or walk ends (and a plan's next step doesn't follow);
- they've been idle for `config.idle` minutes;
- a routine entry starts, a shift starts or ends, or a directive's `until` passes, during what they're doing (a "boundary" check: they switch if the new requirement outranks what they're doing, or if what they're doing came from the entry that just ended);
- a need is about to become urgent, desperate or reach 1 during an action (an "urge" check: they switch only if something now outranks what they're doing). Urge checks don't interrupt a walk; boundary checks do;
- a directive is given (`world.direct`), they come back from being away, or something fails.

A plan that was set aside for something urgent is picked up again at the next decision, unless something outranks it (see [Mentat](modules/mentat.md)).

## Habits and rewards

Each person keeps a habit weight per action, two numbers (fast and slow) whose average multiplies the action's weight. Everyone starts at 1.

After an action ends with more than 20% of it done, the habit learns from how it went: the relief actually got (each need weighted by its urgency) against the relief expected. Better than expected nudges the fast weight up, worse nudges it down; the fast weight is pulled slowly back toward 1, and the slow weight follows the fast one. Both stay between `habitMin` (0.25) and `habitMax` (4).

The game can reward or discourage a choice directly. This is an input, so it's recorded:

```js
world.reward('kofi', 'chat', 0.3);    // he enjoyed that: more likely to chat
world.reward('sam', 'steal_food', -0.5);
```

`reward` adds the amount to the fast weight and a quarter of it to the slow one. With Fellowship, people also pick up a little of the habits of people they like when they spend time together.

## Config

Pass any of these in `Tyrell.create({ config: { ... } })`. They're definitions, not state: don't change the decision settings mid-run (a rewind replays with the current values). `minutesPerSecond` and `budgetMs` are safe to change at any time.

| Field | Default | Meaning |
|---|---|---|
| `minutesPerSecond` | 1 | Game minutes per real second at speed 1 (`world.tick`) |
| `week` | 7 | Days in a week, for routine variants and job days |
| `urgent` | 0.85 | Need level above which a need is urgent (a need's `urgent` overrides it) |
| `urgentRank` | 1.5 | The rank an urgent need lifts an option to |
| `desperateRank` | 2.5 | The rank a desperate need (0.97 and up) lifts an option to, plus up to 0.3 more |
| `cut` | 0.25 | Options under this share of the best weight are dropped |
| `top` | 3 | At most this many options go into the draw |
| `power` | 2 | The draw is weighted by weight to this power |
| `inertia` | 1.15 | Bonus for carrying on with what they're doing |
| `repeat` | 0.75 | Multiplier for doing the same thing twice in a row |
| `travelScale` | 30 | Travel factor: `1 / (1 + minutes / travelScale)` |
| `placesPerAction` | 4 | How many candidate places (nearest first) to weigh per action |
| `idle` | 20 | Minutes someone with nothing to do waits before thinking again |
| `recheck` | 30 | Declared but not read by this version of the engine |
| `budgetMs` | 4 | Milliseconds of simulation per `world.tick` frame |
| `logSize` | 1000 | Westmarch log entries kept (the type comment says 3000; the code's default is 1000) |
| `decisions` | 12 | Decisions Palantír keeps per person |
| `habitFast` | 0.25 | Learning rate of the fast habit weight |
| `habitSlow` | 0.05 | How fast the slow weight follows the fast one |
| `habitMin` | 0.25 | Lowest habit weight |
| `habitMax` | 4 | Highest habit weight |
| `compensate` | true | Compensate considerations for their number (IAUS) |

## Asking why

```js
const d = world.why('kofi');          // the latest Decision
d.picked;                             // the Candidate chosen: id, place, rank, layer, weight, parts
d.reason;                             // 'need at rank 0; beat read, walk'
world.whyNot('kofi', 'drink');        // "drink at bar weighs 0.12 (base 0.2 x travel 0.6); chat weighed 0.4 (...)"
console.log(world.describe('kofi'));  // needs, mood, doing, plan, beliefs, what's expected, last choice
```

See [Tools](tools.md#palantír) for the inspector in full.
