# Mentat

Planning. The minds decide *what* (a task: get the radio working, make dinner); Mentat works out *how*. Named for Dune's human computers.

The ideas come from hierarchical task networks (Guerrilla's Decima engine, SHOP): a task is a list of methods tried in order, each with conditions and steps. For getting hold of things, where hand-written methods would never keep up, it uses a short backward search over every way to get an item, the strength of goal-oriented action planning (GOAP).

- [Tasks and methods](#tasks-and-methods)
- [Steps](#steps)
- [get: searches](#get-searches)
- [Running a plan](#running-a-plan)
- [Plans rest on beliefs](#plans-rest-on-beliefs)
- [Interrupted plans](#interrupted-plans)
- [State](#state)
- [API](#api)
- [Terms, events and log](#terms-events-and-log)
- [Config](#config)
- [With other modules](#with-other-modules)
- [Example](#example)

## Tasks and methods

```js
world.task({
  id: 'fix_radio', label: 'getting the radio working',
  relieves: { fun: 0.3 }, base: 0.05, if: ['has:broken_radio'], cooldown: 12 * 60,
  methods: [
    { name: 'take it in', if: ['thinks:open:workshop'], do: ['repair_service'] },
    { name: 'buy another', if: ['money>=60'], do: ['get:radio'] },
    { name: 'do without', do: ['shrug'] },
  ],
});
```

`TaskDef`:

| Field | Meaning |
|---|---|
| `id` | The task's id |
| `label` | A readable name |
| `relieves`, `base` | What it's worth when chosen freely (the same as an action's). This is only the expectation: the relief itself comes from the actions the plan does |
| `at` | Places to weigh it at (travel time and opening hours count against it). It doesn't decide where the steps happen |
| `if`, `who` | Conditions to start it, and who may |
| `rank` | The rank it's chosen at freely; below 0 means only when required |
| `considerations` | Extra factors |
| `cooldown` | Minutes before it can be chosen again, after the plan completes |
| `tags` | As for actions (Reverie boosts read them) |
| `methods` | The ways to do it, tried in order |

`MethodDef`: `{ name?, if?, do }`. A method's `if` is checked when the plan starts (or replans), for the person; the first method that isn't marked failed and whose conditions hold is used. Methods are named `'way 1'`, `'way 2'`... in the log if they have no name.

A task is chosen like an action: freely (if it has `relieves` or `base`), by a directive (`world.direct(id, { do: 'fix_radio' })`), by a routine entry, or as a job's action. A Reverie break can be a task too.

## Steps

| Step | Means |
|---|---|
| `'repair_service'` | An action: done at the nearest place it can be done now |
| `'dinner'` | Another task: expanded by its own methods |
| `'go:park'` | Walk to a place. Takes a place id only: `'go:home'` looks for a place with the id `home` (see below) |
| `'wait:15'` | Wait 15 minutes where they are |
| `'get:radio'` | Get hold of an item by whatever means (a search, below). Skipped if they have one |
| `{ action, at?, target? }` | An action at a place spec, or aimed at someone |

An action step goes to the nearest place (by the action's `at`, or the step's) where it isn't ruled out now. If every place is ruled out, the step fails.

Limitations in this version:

- `go:` takes a literal place id. `'go:home'` with no place called `home` gives a walk that never ends (an infinite travel time isn't caught). Use an action step for "go home and do X", or a real id.
- The step object's `minutes` field is declared but not read: the action takes its own time.

## get: searches

`get:<item>` searches every way to get the item: every action that `gives` it or `buys` it. For each, it works out a route and its cost, and takes the cheapest:

- **Conditions.** `has:<x>` conditions in the action's `if` (and anything in its `uses`) that the person doesn't meet become sub-goals, searched the same way (up to `config.depth`, 3, deep). Any other condition must hold now.
- **Place.** The nearest place that offers it, is open now, and has the stock to sell it.
- **Cost**, in minutes of effort: the action's minutes, plus its `cost`, plus the walk, plus:
  - a price: impossible if they can't afford it, else `price × priceWeight × (0.5 + thrift) × (1 + min(1, price / money))`;
  - an `'illegal'` tag: impossible for people with honesty 0.8 or more, else 60 + 300 × honesty + 20 × heat;
  - each value it goes `against`: impossible if they hold it at 0.9 or more, else 200 × how much they hold it;
  - plus the costs of its sub-goals.

So the same `get:food` buys for someone with money, and steals for someone broke and dishonest, and finds no way at all for someone broke and honest:

```js
world.mentat.acquire(world.get('lena'), 'food', 3, new Set());
// { steps: [{ action: 'buy_food', at: 'market' }], cost: 35.45 }   (minutes of effort)
```

A chain works the same way: with `scavenge` giving `wire`, and `make_antenna` (if `has:wire`, uses `wire`) giving `antenna`, `get:antenna` plans `scavenge` then `make_antenna`.

## Running a plan

When a task is picked, Mentat chooses a method and returns the first step. The person does it; when it ends, the next step follows, at the same rank, with layer `'plan'`. When the last step is done, the plan is complete: the `planned` event fires with `ok: true`, a directive for the task is marked done, and the task's cooldown starts.

When a step fails (the place was shut on arrival, the slot was taken, a step can't be done now), the plan **replans**: the innermost method is marked failed and the next method of that task is tried; if it has none left, the task above it replans, and so on. After `maxTries` (3) replans, or when nothing is left, the plan is given up: `planned` fires with `ok: false` and the reason, the person feels `frustrated` (with Reverie), and the task can't be chosen for two hours (or its cooldown, if longer).

If no method fits at the start, the task isn't planned at all (a `no-plan` log entry) and the person waits (`config.idle` minutes) before thinking again. Nothing stops them choosing the same task again, so give a task `if` conditions that match its methods (a method with no conditions as the last resort does the same).

## Plans rest on beliefs

Methods' conditions are checked against what the person believes, through the condition language: `thinks:open:workshop` reads their belief, falling back to the truth. And an action step at a place that's closed is still taken if the person believes it's open (`open:<place>` = true). They walk there, find it shut, and learn: they now believe `open:<place>` is false (as something seen), and the plan replans.

```js
world.fact('closed:workshop', true);                                 // shut today...
world.reverie.believe('ruth', 'open:workshop', true, 'assumed');    // ...but Ruth thinks it's open
world.direct('ruth', { do: 'fix_radio' });
// she walks to the workshop, finds it shut, believes so, and (if she can afford it) buys a radio instead
```

## Interrupted plans

When something outranks a plan's step (an urgent need, a routine entry, a directive), the plan is set aside, with the interrupted step to be done again. At the person's next decision, the set-aside plan is picked up again, unless the new choice outranks it, or the new choice is the same task (then it starts fresh), or it was started more than a day ago (then it's dropped). At most two plans are kept set aside.

## State

A person's plan is in their state: `person.plan` (a `PlanState`: the task, a stack of frames `{ task, method, steps, i }`, the methods failed per task, tries, when it started, its rank and layer) and `person.suspended` (plans set aside). Mentat keeps no module state of its own.

## API

`world.mentat`:

| Method | Returns | |
|---|---|---|
| `providers(item)` | ActionDef[] | Every action that gives or buys the item |
| `acquire(person, item, depth, seen)` | `{ steps, cost }` or null | The cheapest route for a person (a PersonState) to get an item. Pass `world.mentat.config.depth` and `new Set()`. Reads only |
| `cost(person, action)` | number | An action's cost for a person, in minutes of effort (`Infinity` if impossible) |
| `begin`, `stepDone`, `stepFailed`, `suspend`, `resume` | | **Engine.** Used by the clock to run plans |
| `config` | | The config |

## Terms, events and log

Term: `planning` / `planning:<task>`.

| Event | Payload |
|---|---|
| `planned` | `{ id, task, ok: true }` when a plan completes; `{ id, task, ok: false, why }` when it's given up |

Log entries: `planned` (a plan started, with the method), `no-plan`, `route` (a `get:` route, with its steps and cost), `replanned`, `done-plan`, `gave-up`, `set-aside`, `resumed`. Note that the log's `planned` marks a start, while the event marks the end.

## Config

`Tyrell.create({ moduleConfig: { mentat: { ... } } })`:

| Field | Default | Meaning |
|---|---|---|
| `maxTries` | 3 | Replans before giving up |
| `depth` | 3 | How deep `get:` looks (getting a part to make the thing to get) |
| `priceWeight` | 1 | Minutes of effort one unit of money is worth, before thrift |

## With other modules

- **Reverie**: methods read beliefs (`thinks:`, `believes:`); a step goes to a place believed open and teaches the truth on arrival; a plan given up gives `frustrated`.
- **Ceres**: `get:` buys only where the stock is enough, can't plan what the person can't afford, weighs prices by thrift, and turns `uses` into sub-goals.
- **Wormtongue**: an `'illegal'` action costs more for people with heat; a step whose action is a `crime` is witnessed like any other.
- **The stack**: a plan runs at the rank the task was chosen at, so a directive's plan holds against work and a free choice's plan gives way to a routine.

## Example

```js
world.place({ id: 'yard', tags: ['scrap'], region: 'river' });
world.link('workshop', 'yard', 6);
world.action({ id: 'scavenge', at: 'tag:scrap', minutes: 30, gives: { wire: 1 } });
world.action({ id: 'make_antenna', at: 'home', minutes: 20, if: ['has:wire'], uses: { wire: 1 }, gives: { antenna: 1 } });
world.action({ id: 'tune_in', at: 'home', minutes: 60, if: ['has:radio', 'has:antenna'], relieves: { fun: 0.4 }, pose: 'sit' });
world.task({ id: 'rig_antenna', base: 0.2, if: ['has:radio', '!has:antenna'], methods: [{ do: ['get:antenna', 'tune_in'] }] });

world.give('ruth', 'radio');
world.direct('ruth', { do: 'rig_antenna' });
world.on('planned', (e) => console.log(e.id, e.task, e.ok ? 'done' : 'gave up: ' + e.why));
```
