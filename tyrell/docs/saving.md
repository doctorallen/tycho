# Saving

The whole world is plain JSON, so saving is copying it and loading is putting it back. This page covers what's in a save, the order to load in, history, versions, and changing a game's content under existing saves.

- [Save and load](#save-and-load)
- [What's in a save](#whats-in-a-save)
- [Declaring and loading](#declaring-and-loading)
- [Setup that must happen once](#setup-that-must-happen-once)
- [Changing content under existing saves](#changing-content-under-existing-saves)
- [Saving with history](#saving-with-history)
- [Schema versions and migrations](#schema-versions-and-migrations)
- [Where to store it](#where-to-store-it)

## Save and load

```js
const data = world.save();                       // { tyrell: 'world', v: 1, s: { ... } }
localStorage.setItem('town', JSON.stringify(data));

// later, in a new session
const town = buildTown();                        // create, declare everything, add everyone
town.load(localStorage.getItem('town'));         // an object or its JSON string
town.focus([currentLevel]);
```

`world.save(withHistory = false)` returns `SaveData`: `{ tyrell: 'world', v, s, history? }`, where `v` is the schema version and `s` a deep copy of the state. `world.load(data)` takes that object or its JSON string. A loaded world is the same world: the same hash, and it runs on exactly as the original would have (Voight-Kampff's `save-load` check tests both).

If the game writes the save at once, it can store `world.s` itself instead of a copy: `{ tyrell: 'world', v: world.s.v, s: world.s }` is what `save()` returns, without the copy.

## What's in a save

Everything that changes:

| In the save | |
|---|---|
| The clock | `now`, the sequence counter, the world's stream counter |
| People | Each person's definition (name, traits, home, job, routine...), status, needs, variables, goods, place, slot, what they're doing, habits, cooldowns, plan and set-aside plans, directive, time away, who they follow |
| Places | Slot claims and stock |
| Facts | All of them |
| The queue | Pending action ends, thoughts, the hourly tick, game timers (`world.at`), module timers (witnesses' pending reports), returns from away |
| The log | The last `config.logSize` entries |
| Module state | Feelings, memories, beliefs, files, stress; relationships, standing, partners; heat, reports, secrets, favors; lines said; deck draws, intensity; purses, pantries, rent; stages, parents, the departed; promoted strangers |
| Kept game state | Everything in `world.keep` |

Not in the save, so the game provides them on every start:

- **Definitions**: needs, places, links, actions, tasks, deeds; feelings, breaks, memory kinds, groups, crimes, lines, practices, social acts, storylets, decks, metrics, goods; custom terms, effects and inputs; Cradle's `namer` and `template`; Joi's provider.
- **The shell, config and listeners.**
- **Focus**: call `world.focus` again.
- **Palantír's decisions** and **bark cooldowns**: they start empty.
- **Esper's history and marks**, unless you save with history.

## Declaring and loading

Declare before loading, or after: both work, and both give the same world.

- Declaring places after a load keeps the saved state of each place (claims, stock) and adds state for new places.
- `world.person(id, def)` returns the saved person when one exists, ignoring `def`. So it's safe to add everyone on every start, before or after loading.
- A module whose state is missing from an older save gets fresh state on load.

What `load` does: migrates the state to the current schema, replaces the world's state, gives modules their fresh state where it's missing and calls their `loaded` hooks, makes sure every declared place has state, resets Esper (and restores its history if the save has one), clears Palantír's decisions, disembodies every body, and embodies whoever is near now. Listeners stay registered.

`load` doesn't move the clock: the loaded world is at the saved time. If the game owns the clock, load its own save first and then call `world.advanceTo(gameMinutes())` as usual.

## Setup that must happen once

Some setup is an input that changes the state, not a definition: starting money (`ceres.pay`), incomes and rent (`ceres.income`, `ceres.rent`), partners (`fellowship.setPartner`), secrets. Done on every start, it would happen again on top of a loaded save whenever the game declares after loading. Guard it with a kept flag:

```js
if (!world.kept('setup:money')) {
  world.ceres.pay('world', 'h_okafor', 200, 'savings');
  world.ceres.income('ruth', 120, 7);
  world.keep('setup:money', true);
}
if (!world.fellowship.partner('mara')) world.fellowship.setPartner('mara', 'tomas');
```

Rocinante does exactly this.

## Changing content under existing saves

Definitions come from code, so changing an action, a place or a line takes effect on the next start, saved games included. People are different: a person's definition is saved with them, so a new routine in code doesn't reach someone who's already in a save.

Update saved people with a custom input, run once per content version:

```js
world.defineInput('redefine', (id, patch) => {
  const p = world.get(id);
  if (p) Object.assign(p.def, patch);
});

world.load(saved);
if ((world.kept('content') ?? 1) < 2) {
  world.input('redefine', ['kofi', { routine: [[7, null, '*'], [12, 'park', 'sit_park'], [13, null, '*'], [23, 'home', 'sleep']] }]);
  world.keep('content', 2);
}
```

The change is an input, so it's recorded and replays after a rewind. People added in a new version just need a `world.person` call (they're added if missing). New needs are given to existing people the next time they think. A doing that names an action you've removed ends at its time and the person thinks again.

## Saving with history

`world.save(true)` also includes Esper's history (snapshots, recorded inputs and marks), so the loaded world can still rewind past the load. History is large: each snapshot is the whole state, so expect megabytes (Rocinante after a week: about 7 MB with history, 150 KB without). Save with history only when the game needs to rewind across a save, and lower `config.logSize` and Esper's `keep` option to shrink it. See [Time](time.md#esperconfig-and-memory).

Without history, a loaded world starts a fresh history at its first advance: it can't go back past the moment it was loaded.

## Schema versions and migrations

`Tyrell.SCHEMA` is the version of the state's shape (1 in this version). Every save carries it. When a future Tyrell changes the shape, it ships a migration in `Tyrell.MIGRATIONS`: `MIGRATIONS[v]` takes a version-`v` state and returns a version-`v + 1` state. `load` applies them in turn. It throws if a step is missing (`no migration from save version v`) or if the save is newer than the engine (`save version v is newer than this engine`): catch that and tell the player, or start a new world.

```js
try {
  world.load(saved);
} catch (e) {
  console.warn('The town could not be loaded; starting over.', e);
  // world is still the freshly built one
}
```

Tyrell's migrations cover Tyrell's own state. For the game's content (routines, new people), version it yourself with a kept number, as above.

## Where to store it

A save without history is small (tens to hundreds of KB for a town), and fits in `localStorage`. With history, use IndexedDB or a file. Keep Tyrell's save inside the game's own save, so the two never get out of step:

```js
const save = { game: game.s, tyrell: world.save() };
localStorage.setItem('mygame.save.v1', JSON.stringify(save));
```
