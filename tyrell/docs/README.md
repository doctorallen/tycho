# Tyrell documentation

Tyrell is a minds engine for games full of people. It decides what each person does, remembers what happened to them, keeps track of what they believe and how they feel about each other and about the player, and keeps them living when nobody is watching. Time walk (running faster, rewinding, playing backward) is built into the core. The game supplies the space (places and how long it takes to walk between them) and draws whatever Tyrell decides.

These docs describe Tyrell 1.0.0.

## Reading order

**If you're integrating Tyrell into a game:**

1. [Getting started](getting-started.md): add it, load it, a first world, the frame loop, bodies.
2. [Concepts](concepts.md): the model, end to end.
3. [Integration](integration.md): everything a game wires up, with notes for side-scrollers and top-down games.
4. [Deciding](deciding.md) and [Places](places.md): how people choose, and where.
5. [Time](time.md): the clock, and time walk.
6. [Conditions](conditions.md): the little language used everywhere.
7. The [module](#modules) pages for the modules you use.
8. [Recipes](recipes.md) to copy from, [Saving](saving.md), [Tools](tools.md).
9. [API reference](api.md) when you need an exact signature.

**If you're an AI agent asked to implement an integration:**

1. [For AI agents](for-ai.md): invariants, the procedure, the contracts, a runnable skeleton, pitfalls.
2. [API reference](api.md) for exact signatures and events.
3. [Integration](integration.md) for the reasoning behind each step, and the layout notes for the game's kind.
4. [Conditions](conditions.md) for every term and effect.
5. The module pages for each module the game switches on.

## The parts

**[Getting started](getting-started.md).** Adding Tyrell as a git submodule (and to CI and a service worker), loading it with a script tag, a first world that runs in a few dozen lines, the frame loop with `tick` or `advanceTo`, and how focus hands people's bodies to the game.

**[Concepts](concepts.md).** State and definitions; time in minutes; people, needs, places and actions; the four steps of every decision; the event queue; near and far (one mind, carried out by Tyrell off screen or by the game on screen); inputs and determinism; what the engine never does.

**[Integration](integration.md).** The shell (travel, near, check), regions and focus, bodies and their fields, mapping places and slots to coordinates, walking along routes, reporting failures, who owns the clock, sensing and deeds, talking, directing, custom inputs, saving, and notes for a side-scroller with many small levels and a top-down game with one map. Ends with a checklist.

**[Deciding (Bicameral)](deciding.md).** Needs, every field of an action, the layered stack of ranks (break, story, job, routine, needs), routines and their variants, jobs and shifts, directives, urgent and desperate needs, how an option's weight is built, considerations and curves, the pick, when people think, habits, and every config field.

**[Places (Ring) and strangers](places.md).** Places, tags, nesting, regions, hours and closing, slots and capacity, offers, owners, quality and stock, travel by links or by the shell, place specs, and the passers-by who cost nothing until promoted.

**[Time (Entmoot and Esper)](time.md).** The event queue; tick, advance, seek and rewind; speed and the frame budget; timers; away, back and following; how Esper's snapshots and input log work; seeking and playing backward; branches, echoes and marks; keeping the game's own state in step; memory; the rules a game must follow to be rewind-safe; and building a rewind gadget, a fast-forward, a time loop and a replay viewer.

**[Conditions and effects](conditions.md).** The syntax, where conditions are used and what they see, every term and effect from the core and the modules, functions instead of strings, extending the language, and which conditions are safe across a rewind.

**[Saving](saving.md).** Save and load, what's in a save, declaring and loading in either order, setup that must happen once, changing content under existing saves, history, schema versions and migrations.

**[Recipes](recipes.md).** A shop with a keeper on shift; a bar regular; a household purse; a crime with witnesses, reports, heat and a payoff; a rumor and a lie; a plan with fallbacks and a `get:` chain; a festival storylet with a deck; a detective game; a time-loop day; a rewind ability; a language-model voice.

**[Tools](tools.md).** Palantír (why, why not, describe, inspect), Westmarch (the log and chronicles), Voight-Kampff (headless behavior tests and the command line) and Rocinante (the sample town).

**[API reference](api.md).** Every export, option, property, method and event, the main types, and how to write a module.

**[For AI agents](for-ai.md).** The compact, exact version for an agent implementing an integration.

### Modules

| Module | Page | What it adds |
|---|---|---|
| Reverie | [reverie.md](modules/reverie.md) | Feelings, mood and emotion, breaks, stress, memories, beliefs, files on the player |
| Fellowship | [fellowship.md](modules/fellowship.md) | Regard, attraction, sentiments, compatibility, groups and households, standing |
| Wormtongue | [wormtongue.md](modules/wormtongue.md) | Witnesses, reports and heat, gossip, lies, silencing, secrets, favors |
| Cityspeak | [cityspeak.md](modules/cityspeak.md) | Lines, barks, practices with roles, social acts, the room, ink |
| Mentat | [mentat.md](modules/mentat.md) | Planning: tasks with methods, `get:` searches, replanning |
| Gaff | [gaff.md](modules/gaff.md) | The director: storylets, intensity phases, decks, unseen places |
| Ceres | [ceres.md](modules/ceres.md) | Money, prices, stock, wages, rent, incomes, purses and pantries |
| Cradle | [cradle.md](modules/cradle.md) | Ages and stages, couples, births, departures and inheritance |
| Joi | [joi.md](modules/joi.md) | An optional language-model voice that never changes the world |

## Glossary

**Action.** Something a person can do: where (`at`), for how long (`minutes`), with which slot, what it relieves, what it costs, what it changes when it ends. See [Deciding](deciding.md#actions).

**Body.** A person as the game should show them now: place and slot, or a walk between two places; the action and pose; how far through it they are. Handed to the game for people who are near. See [Integration](integration.md#bodies).

**Belief.** What someone takes to be true about a key, with where it came from (`saw`, `told`, `assumed`, `knew`), who told them, how strongly they hold it, and how many tellings it's come through. Can be wrong. See [Reverie](modules/reverie.md#beliefs).

**Branch.** What happens when the game makes a new input in the past after a rewind: the recorded future is dropped and a new timeline starts.

**Candidate.** One option weighed in a decision: an action or task at a place (and maybe aimed at someone), with its rank, weight and the parts the weight is made of, or the reason it was ruled out.

**Consideration.** A factor in an option's weight: an input, normalized over a range, passed through a curve, mapped to an output range.

**Deed.** Something someone did to or for someone else (`world.did('player', 'fixed', { for: 'ruth' })`), with what it means declared once (`world.deed`): feelings, memories, regard, standing, crime.

**Definition.** What the game declares at setup (needs, places, actions...). May hold functions; never saved; declared again on every start. Compare *state*.

**Directive.** An order from the story layer (`world.direct`), at rank 3 by default: above jobs and routines.

**Doing.** What someone is doing right now: an action (`act`), a walk (`travel`) or a wait, with its start, end, rank and layer.

**Emotion.** The one named emotion a person shows ('angry', 'tired', 'fine'), from their feelings and pressing needs (Reverie).

**Esper.** Time walk: snapshots of the state plus a log of every input, so the world can go back to any remembered moment and replay forward exactly.

**Fact.** A piece of the world's truth (`world.fact('raining', true)`), read by conditions (`fact:raining`). Facts are state: saved and rewound.

**Feeling.** A short-lived weight on someone's mood, with a label, a lifetime and a stack limit (Reverie).

**Focus.** The regions the game has loaded (`world.focus`). People in them are near.

**Heat.** The weight of crime reports against someone, fading by the day (Wormtongue).

**Input.** A change to the world from outside the simulation, made through `world.input` (every public mutator is one). Esper records inputs and replays them after a rewind.

**Job.** Work on shifts at a place (`PersonDef.job`): the job's action is required at rank 2 while on shift.

**Layer.** Where an option or doing came from: `story`, `job`, `routine`, `need`, `plan`, `break`, `follow`, `idle`.

**Mark.** A named moment Esper can go back to.

**Near and far.** Near: the person is somewhere the game is showing, so the game draws their body. Far: Tyrell alone carries out their timetable. Same mind, same timetable either way.

**Need.** A level from 0 (calm) to 1 (desperate) that rises by the game hour: hunger, energy, fun, company. Needs drive free choices, and urgent ones lift options above routines and work.

**Person.** A mind: needs, variables, goods, a home, maybe a job and a routine, and what the modules add. `world.person(id, def)`.

**Place.** An id with tags, maybe opening hours, slots, an owner and stock. Places can sit inside places. No coordinates.

**Plan.** A task being carried out step by step (Mentat), replanning when a step fails.

**Rank.** The priority of an option. Only options at the highest available rank are considered; weight decides among them.

**Region.** What the game loads at once: a level, a district, a map. Every place belongs to one.

**Routine.** A day's plan: from this hour, be at this place doing this, until the next entry (`PersonDef.routine`). Required at rank 1. Can have variants by day of the week or by condition.

**Shell.** The three optional callbacks the engine asks the game: `travel` (minutes between places), `near` (who gets a body), `check` (live facts).

**Slot.** A named, limited resource at a place (six stools, two beds). An action that needs a slot claims one while it lasts; a full slot rules the action out.

**Snapshot.** A copy of the whole state that Esper keeps at regular marks, to rewind from.

**State.** Everything that changes, as plain JSON in `world.s`. Saved, snapshotted and rewound. Compare *definition*.

**Stimulus.** Something perceived, reported by the game with `world.sense`: what kind, who did it, where, and who saw it.

**Storylet.** An event the director (Gaff) can fire: conditions, a mean time between firings, a cooldown, a phase, and a `fire` function.

**Stranger.** A passer-by worked out from the seed alone, with no mind and no cost, until the game promotes them to a person.

**Task.** A compound action that Mentat breaks into steps by its methods, tried in order.

**Term.** A named value in the condition language (`need.hunger`, `thinks:open:cafe`, `regard`). Modules add their own; so can the game.
