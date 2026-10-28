# Concepts

This page explains the model Tyrell runs, end to end. Read it once before you integrate: everything else in the docs builds on it.

- [State and definitions](#state-and-definitions)
- [Time is minutes](#time-is-minutes)
- [People, needs, places and actions](#people-needs-places-and-actions)
- [The four steps of a decision](#the-four-steps-of-a-decision)
- [Doing things: the event queue](#doing-things-the-event-queue)
- [Near and far: one mind, two ways to carry it out](#near-and-far-one-mind-two-ways-to-carry-it-out)
- [Inputs and determinism](#inputs-and-determinism)
- [Modules](#modules)
- [What the engine never does](#what-the-engine-never-does)

## State and definitions

Tyrell keeps two kinds of data apart.

**Definitions** are what the game declares at setup: needs, places, links, actions, tasks, deeds, and each module's content (feelings, crimes, lines, storylets, goods...). They live in Maps on the world (`world.needs`, `world.actions`, `world.ring.defs`...), may contain functions, and are never saved. The game declares them again every time it starts, before or after loading a save.

**State** is everything that changes: the clock, every person, every place's slot claims and stock, the facts, the event queue, the log, and each module's data. It all lives in one plain JSON object, `world.s` (a `WorldState`). Because it's plain JSON, the whole world can be saved with `JSON.stringify`, snapshotted for time walk, and compared with `world.hash()`.

There is one deliberate exception: a person's definition (`PersonDef`: name, traits, home, job, routine...) is part of their state. It's copied into `world.s.people[id].def` when the person is added, and it's saved with them. That's why routines are plain data (`when` conditions in a routine are strings, never functions), and why `world.person(id, def)` returns the saved person, ignoring `def`, when the person already exists.

| | Definitions | State |
|---|---|---|
| Where | `world.needs`, `world.actions`, `world.tasks`, `world.deeds`, `world.ring.defs`, module Maps | `world.s` |
| Holds functions | Yes, wherever a field accepts one | Never |
| Saved | No: declare again on every start | Yes |
| Rewound by time walk | No | Yes |
| Changed by | The game, at setup | Inputs, and the simulation itself |

Treat the world's `config` the same way as definitions: set it at creation and don't change decision settings mid-run, because a rewind replays history with whatever config is current.

## Time is minutes

`world.now` counts game minutes since the world began. Minute 0 is midnight at the start of day 0. `Tyrell.HOUR` is 60 and `Tyrell.DAY` is 1440.

| Read | Meaning |
|---|---|
| `world.now` | Minutes since the world began (fractional while ticking) |
| `world.hour` | Hour of the day, 0 to 24, fractional (13.5 is 1:30 pm) |
| `world.day` | Day number, from 0 |
| `world.weekday` | `world.day % config.week` (0 to 6 by default) |

`Tyrell.create({ start: 8 * 60 })` starts the clock at 8 am on day 0. Hours everywhere in definitions (opening hours, routine entries, shifts, action hours) are fractional hours of the day, 0 to 24, and spans like `[17, 2]` wrap past midnight.

## People, needs, places and actions

A **person** is a mind with needs, variables (money and anything else), goods, a home, maybe a job and a routine, and whatever the modules add (feelings, memories, beliefs, relationships).

A **need** is a number from 0 (calm) to 1 (desperate) that rises steadily by the game hour: hunger, energy, fun, company. Needs are the bottom layer of motivation: when nothing else is required, people do whatever meets their needs best.

A **place** is an id with tags, maybe opening hours, maybe named slots with a capacity (six stools, two beds), maybe an owner. Places can sit inside other places (a till inside a shop). Each belongs to a **region**: the unit the game loads at once (a level, a map).

An **action** is something a person can do: where it happens, how long it takes, which slot it needs, which needs it relieves, what it costs, what it changes when it ends. A **task** is a compound action that a planner (Mentat) breaks into steps.

Above the needs sit the layers that make a life orderly: a **routine** (be at the bar from 19:00), a **job** (on shift at the market from 8 to 16), and the story's **directives** (go and meet the player at the docks). Each layer has a **rank**, and higher ranks always win. See [Deciding](deciding.md).

## The four steps of a decision

Every time someone decides what to do, Bicameral (the core's decision maker) runs four steps:

1. **What's required.** The stack is read top down: a directive from the story (rank 3), the job if they're on shift (rank 2), the routine entry for this hour (rank 1). Each requirement becomes an option at its rank.
2. **What's on offer.** Every action and task the person could do freely, at every place that offers it (the nearest few places per action), is listed. Options are ruled out with a reason: not for them, cooling down, failed there recently, unreachable, closed when they'd arrive, no free slot, a condition fails, a module blocks it (can't afford it, sold out).
3. **What it's worth.** Each option gets a weight: the relief it gives each need, scaled by how urgent the need is, plus a flat `base`; then multiplied by considerations (response curves over inputs like the hour or a trait), habit, travel time, and factors from the modules (mood, regard, price, the situation at the place). An urgent need lifts an option that really meets it above the routine; a desperate one lifts it above work.
4. **The pick.** Only options at the top rank count. Those under a share of the best weight are cut, the best few are kept, and one is drawn at random, weighted, from the person's own seeded stream.

The decision is recorded for the inspector (Palantír): `world.why(id)` returns it with every option, its rank, its weight and what the weight was made of, and `world.whyNot(id, action)` explains a choice that wasn't made.

## Doing things: the event queue

Off screen nothing ticks. When someone starts an action, Entmoot (the clock) works out when it ends and puts that moment in a queue. The clock jumps from one queued moment to the next. So a day for a hundred people is a few thousand events, not a few million frames.

What someone is doing is a `Doing` with a kind:

| Kind | Meaning |
|---|---|
| `travel` | Walking from one place to another, to do an action there |
| `act` | Doing an action at a place, holding its slot if it has one |
| `wait` | Waiting: nothing to do (they think again after `config.idle` minutes), or a plan's `wait:` step |

People think again when an action or walk ends, when they've been idle a while, and at the moments something changes for them: a routine entry starts, a shift starts or ends, a directive runs out, or a need is about to become urgent. Those moments are queued too, so an urgent need wakes someone at the right minute without anything polling.

When a walk ends, the person arrives and checks the action is still possible (the place may have closed on the way). If it isn't, the action **fails**: it's ruled out at that place for a while (`config.backoff`, 15 minutes), and they think again. The game can make things fail too (a body that couldn't get through a door) with `world.report(id, 'failed')`.

## Near and far: one mind, two ways to carry it out

Every person has one mind and one timetable. What changes is who carries it out.

- **Far**: the person is somewhere the game isn't showing. Tyrell alone carries the timetable: they leave at 18:50, they arrive at 19:00, they sit on a stool until 20:30.
- **Near**: the person is somewhere the game is showing. Tyrell hands the game a **body**: what they're doing, where, with which pose, how far through it they are. The game draws and animates it, and follows the same timetable.

The hand-over is just events: `embody` when someone comes into view (mid-walk or mid-meal, with their progress), `step` when a near person starts something new, `disembody` when they leave view. The game decides what's in view by **focusing** regions (`world.focus(['market'])`), or with its own `shell.near` test.

Because the timetable is the same either way, someone who sets out for the bar arrives at the same minute whether or not anyone watched, and a watched world hashes the same as an unwatched one. The game's job when a body is near is to make the walk and the action look right in the time Tyrell gave them. See [Integration](integration.md#bodies).

## Inputs and determinism

The same seed and the same inputs give the same world, byte for byte. That's what makes time walk work, and it's what lets you test behavior headless.

- **No outside randomness.** Every random draw comes from a seeded stream: `world.stream(person)` for a person's choices (it advances their counter), `world.worldStream(name)` for the world's (directors, strangers), `world.worldStreamPeek(...)` for draws that only look (choosing a line to show) and change nothing. Nothing in Tyrell calls `Math.random` or reads the wall clock, and nothing you put in a definition should either.
- **Inputs.** Anything from outside the simulation that changes the state goes through `world.input(name, args)`. Every public method that changes the world is an input: `world.fact`, `world.sense`, `world.did`, `world.report`, `world.direct`, `reverie.feel`, `fellowship.adjust`, `ceres.pay` and so on. Esper, the time walk, records each input with the time it came, and replays it after a rewind.
- **Listeners are deferred.** When the game calls an input from inside an event listener (say, reporting a failure the moment a `step` arrives), the call waits until the engine finishes the event it's handling, and is recorded to replay at exactly that point. Inputs that return a value (`world.person`, `strangers.promote`, `reverie.recall`, `cityspeak.say`, `cityspeak.resolve`, `gaff.draw`, `cradle.birth`) apply at once.
- **Engine-run game code isn't recorded.** A storylet's `fire` function runs inside `world.internally()`, so the inputs it makes are applied but not recorded: a replay runs `fire` again.
- **The game's own state is the game's.** Tyrell rewinds its own state. Anything the game keeps (the player's position, a door it opened) the game rewinds itself, or keeps with the world with `world.keep(key, value)` so it rewinds and saves along with it.

Changing `world.s` directly, or calling the internal `apply...` methods from game code, skips the input log: it works until the first rewind or replay, and then the world quietly diverges. If you need to change something there's no input for, define one with `world.defineInput`. See [Time](time.md#rules-for-a-rewind-safe-game).

## Modules

The core (Bicameral, Ring, Entmoot, Esper, Westmarch, Strangers) is always on. The modules are switched on by name in `Tyrell.create({ modules: [...] })` (all by default) and reach the minds through hooks: they add options, multiply weights, block options, and hear when people start and end things, meet, see things and are done things to.

| Module | Adds |
|---|---|
| [Reverie](modules/reverie.md) | Feelings, mood and emotion, breaks, stress, memories, beliefs, files on the player |
| [Fellowship](modules/fellowship.md) | Regard, attraction, sentiments, compatibility, groups and households, standing |
| [Wormtongue](modules/wormtongue.md) | Witnesses, reports and heat, gossip, lies, silencing, secrets, favors |
| [Cityspeak](modules/cityspeak.md) | Lines, barks, practices with roles, social acts, the mood of a room, an ink bridge |
| [Mentat](modules/mentat.md) | Planning: tasks with methods, `get:` searches, replanning |
| [Gaff](modules/gaff.md) | The director: storylets, intensity phases, decks, unseen places |
| [Ceres](modules/ceres.md) | Money, prices, stock, wages, rent, incomes, household purses and pantries |
| [Cradle](modules/cradle.md) | Ages and stages, couples, births, departures and inheritance |
| [Joi](modules/joi.md) | An optional language-model voice that never changes the world |

A module that's off leaves no trace: its getter (`world.reverie`) is `undefined`, its terms aren't registered, and its fields on definitions (`price`, `feels`, `crime`...) are ignored.

## What the engine never does

Tyrell knows about needs, places, time and other people. It deliberately knows nothing about space or the screen.

- **No coordinates.** Places are ids. Travel is minutes, from links you declare or from the game's own pathfinder (`shell.travel`). Where a stool is, which way a door faces, how a street is laid out: that's the game's.
- **No drawing or animation.** A body says `pose: 'sit'` and `progress: 0.4`. The game draws it.
- **No sight or hearing.** Tyrell never decides who can see what. The game reports what was seen or heard (`world.sense`) with the list of who perceived it, and what was done to whom (`world.did`).
- **No pathfinding, collisions or physics.** If a body can't get where it was going, the game says so (`world.report(id, 'failed')`).
- **No calls into the game.** Tyrell tells the game things only with events (`world.on`), and asks only through the shell's three optional callbacks. It never touches the game's globals.
- **No wall clock.** Time moves only when the game calls `world.tick`, `world.advance`, `world.advanceTo` or `world.seek`.

Next: [Getting started](getting-started.md) for a first world, or [Integration](integration.md) for everything a game wires up.
