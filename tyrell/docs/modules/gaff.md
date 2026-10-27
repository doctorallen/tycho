# Gaff

The director: storylets that fire on a mean time between events, gated by conditions, cooldowns and the phase of an intensity cycle, drawn from shuffled decks so nothing repeats back to back, and placed where nobody's looking when that matters. Named for the Blade Runner detective who watches everything and leaves small origami figures behind.

The ideas come from RimWorld's storytellers (mean time between events), Left 4 Dead's AI director (build-up, peak, fade and relax), and card decks for variety without repetition.

- [Storylets](#storylets)
- [When storylets fire](#when-storylets-fire)
- [Intensity and phases](#intensity-and-phases)
- [Decks](#decks)
- [Unseen places](#unseen-places)
- [Metrics](#metrics)
- [Storylets and time walk](#storylets-and-time-walk)
- [State](#state)
- [API](#api)
- [Terms, events and log](#terms-events-and-log)
- [Config](#config)
- [With other modules](#with-other-modules)
- [Example](#example)

## Storylets

```js
world.gaff.storylet({
  id: 'rain', label: 'Rain', mtb: 2 * 1440, cooldown: 1440, when: ['!fact:raining'],
  fire: (w) => { w.fact('raining', true); w.at(w.now + 6 * 60, 'rain-stops'); },
});
world.on('timer:rain-stops', () => world.fact('raining', false));
```

`StoryletDef`:

| Field | Default | Meaning |
|---|---|---|
| `id` | required | The storylet's id |
| `label` | the id | A readable name, sent with the `director` event |
| `when` | none | Conditions (strings, read with no person: world terms, facts, metrics, phases), or a function `(world) => boolean` |
| `mtb` | required | Mean minutes between firings while it's eligible. `Infinity` means it never fires on its own (cards in a deck) |
| `cooldown` | none | Minutes before it can fire again |
| `phase` | any | Fires only in these phases of its subject's intensity: `'build'`, `'peak'`, `'fade'`, `'relax'`, or a list |
| `subject` | `'world'` | The intensity subject it reads and bumps (`'player'`, `'docks'`...) |
| `bump` | 0.2 | How much firing raises the subject's intensity |
| `deck` | none | When it comes up, a card is drawn from this deck and fired instead |
| `unseen` | none | A tag: fire at a place with this tag that nobody is at and the game isn't showing |
| `fire` | required | What happens: `(world, { place, subject, id }) => void` |

## When storylets fire

Gaff checks its storylets every game hour, on the hour, in the order they were declared. Each storylet that's eligible (not cooling down, in one of its phases, its `when` holds) fires with probability `1 - exp(-60 / mtb)`, so on average once every `mtb` minutes of eligible time. Firing:

1. records the time (for the cooldown) and the firing (the last 100, `history()`);
2. bumps its subject's intensity by `bump`;
3. logs `director` and emits `director` (`{ id, place, label }`);
4. runs `fire(world, { place, subject, id })`.

The game can force one with `world.gaff.trigger(id, place?)`, an input. A forced storylet fires at once, without checking eligibility or drawing from a deck.

## Intensity and phases

Each subject has an intensity (0..1) and a phase, moving through a cycle every hour:

| Phase | Moves on when |
|---|---|
| `build` | intensity reaches `peakAt` (0.7): to `peak` |
| `peak` | `peakMinutes` (4 hours) have passed: to `fade` |
| `fade` | intensity drops under 0.4 × `peakAt` (0.28): to `relax` |
| `relax` | `relaxMinutes` (12 hours) have passed: to `build` |

Intensity falls by `decay` (0.04) every hour, and rises when storylets fire (`bump`) or when the game bumps it (`gaff.bump(subject, by)`, an input). Give the big events `phase: ['build']` so they come while tension builds, and quiet ones `phase: ['relax']`.

A subject comes into being the first time it's bumped or read. Reading one from the game (`gaff.phase('docks')`) for the first time creates it in the state, outside the input log; bump the subjects you use at setup so they exist from the start.

## Decks

A deck is a list of storylet ids drawn in a shuffled order, with no card twice in a row (even across a reshuffle).

```js
world.gaff.storylet({ id: 'festival_season', mtb: 2 * 1440, phase: ['build', 'relax'], deck: 'festivals', fire: () => {} });
world.gaff.deck('festivals', ['street_party', 'lantern_night', 'market_day']);
world.gaff.storylet({ id: 'street_party', mtb: Infinity, cooldown: 3 * 1440, fire: (w) => w.fact('festival', true) });
```

When a storylet with `deck` comes up, a card is drawn and the card's storylet fires instead (if the card is eligible; if not, nothing fires, and the card is used up). The trigger's own `fire` isn't called. Give cards `mtb: Infinity` so they only come from the deck.

In this version, a cooldown on the trigger storylet has no effect (the firing is recorded against the card that was drawn). Put cooldowns on the cards.

## Unseen places

Some events should happen where nobody sees them happen: a break-in, a fire, a body found later. With `unseen: 'tag'`, a storylet fired without a place picks one with that tag that isn't in a focused region and has nobody at it (`null` if there's none), and passes it to `fire` as `place`.

Focus isn't part of the state. If the game's focus differs when Esper replays a storylet, the replay can pick a different place. Keep that in mind if the game rewinds through `unseen` storylets.

## Metrics

Metrics are numbers `when` conditions can read as `metric:<name>`:

| Metric | Value |
|---|---|
| `mood` | The mean mood of everyone active (0.5 without Reverie) |
| `people` | How many people are active |
| `heat.<actor>` | Wormtongue's heat on someone |
| your own | `gaff.defineMetric(name, (world) => number)` |

```js
world.gaff.defineMetric('closed', (w) => [...w.ring.defs.keys()].filter((id) => !w.ring.open(id)).length);
world.gaff.storylet({ id: 'crackdown', mtb: 1440, when: ['metric:heat.player>8'], fire: (w) => w.direct('vance', { do: 'patrol', at: 'market', until: w.now + 240 }) });
```

## Storylets and time walk

A storylet's `fire` is game code the engine runs. It runs inside `world.internally()`, so the calls it makes (`w.fact`, `w.direct`, `w.at`...) are applied but not recorded: a replay runs `fire` again and makes them again. So `fire` must be deterministic: draw randomness from `w.worldStream(name)` and read only Tyrell's state (facts, people, kept values). The test suite checks that a world with storylets rewinds and replays exactly.

## State

In `world.s.mod.gaff`:

| Key | Holds |
|---|---|
| `last` | When each storylet last fired |
| `decks` | Per deck: the cards left and the last card drawn |
| `intensity` | Per subject: `{ v, phase, since }` |
| `fired` | The last 100 firings: `{ t, id, place }` |

## API

`world.gaff`:

| Method | Returns | |
|---|---|---|
| `storylet(def)` | this | Declares a storylet |
| `deck(id, cards)` | this | Declares a deck |
| `defineMetric(name, fn)` | this | Declares a metric |
| `metric(name)` | number | A metric's value |
| `intensity(subject = 'world')` | number | A subject's intensity |
| `phase(subject = 'world')` | Phase | A subject's phase |
| `bump(subject, by)` | void | **Input.** Raises (or lowers) a subject's intensity |
| `trigger(id, place = null)` | void | **Input.** Fires a storylet now |
| `eligible(def)` | boolean | Could it fire now? (Its `when` may draw `chance:` from the world's stream) |
| `history()` | array | The last 100 firings |
| `draw(deck)` | id or undefined | **Engine.** Draws a card |
| `unseenPlace(tag)` | id or null | **Engine.** Picks a place nobody sees (draws from the world's stream) |
| `applyBump(subject, by)` | void | **Engine.** The direct version of `bump` |
| `config`, `storylets` | | The config and the declared storylets |

## Terms, events and log

Terms: `metric:<name>`, `intensity` / `intensity:<subject>`, `phase:<phase>` / `phase:<subject>.<phase>`.

| Event | Payload |
|---|---|
| `director` | `{ id, place, label }`, emitted just before `fire` runs |

Log entry: `director` (`{ storylet, place }`).

## Config

`Tyrell.create({ moduleConfig: { gaff: { ... } } })`:

| Field | Default | Meaning |
|---|---|---|
| `peakAt` | 0.7 | Intensity at which the build-up turns into a peak |
| `peakMinutes` | 240 | Minutes a peak lasts |
| `relaxMinutes` | 720 | Minutes of relaxing after the fade |
| `decay` | 0.04 | Intensity lost per hour |

## With other modules

- **Reverie**: the `mood` metric is the town's mean mood, so storylets can ease off when people are miserable.
- **Wormtongue**: `metric:heat.<actor>` lets the director react to the player's heat.
- **The clock**: `unseen` reads the focused regions; storylets' timers (`w.at`) come back as `timer:` events the game listens to.
- **Everything else** through `fire`, which can use the whole API: facts, directives, feelings, payments, births.

## Example

```js
const gaff = world.gaff;
gaff.storylet({
  id: 'blackout', label: 'A blackout at the Belt', mtb: 6 * 1440, cooldown: 3 * 1440, phase: ['build', 'relax'],
  fire: (w) => { w.fact('closed:bar', true); w.at(w.now + 3 * 60, 'power-back'); },
});
world.on('timer:power-back', () => world.fact('closed:bar', false));
world.on('director', (e) => showHeadline(e.label));

gaff.storylet({
  id: 'break_in', label: 'A break-in', mtb: 4 * 1440, unseen: 'home',
  fire: (w, { place }) => { if (place) w.fact('broken_into:' + place, true); },
});
```
