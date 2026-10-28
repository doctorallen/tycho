# Places (Ring) and strangers

Ring is the core's place graph, named for the Ring in The Expanse, the hub whose gates join every world. It knows places, what they offer, their opening hours, their slots and who holds them, and how long it takes to get from one to another. It never knows coordinates.

Strangers are the passers-by who don't need a mind of their own until someone looks at them.

- [Declaring a place](#declaring-a-place)
- [Tags](#tags)
- [Places inside places](#places-inside-places)
- [Regions](#regions)
- [Opening hours and closing](#opening-hours-and-closing)
- [Slots](#slots)
- [Offers, owners, quality and stock](#offers-owners-quality-and-stock)
- [Travel: links or the shell](#travel-links-or-the-shell)
- [Place specs](#place-specs)
- [The Ring API](#the-ring-api)
- [Strangers](#strangers)

## Declaring a place

```js
world.place({
  id: 'cafe', name: "Mara's Cafe", tags: ['food', 'social'], region: 'main',
  hours: [6, 21], slots: { seat: 8, counter: 1 }, owner: 'mara',
  stock: { bread: 30 }, restock: { bread: [10, 3] },
  data: { level: 'd_main', x: 420 },
});
```

| Field | Type | Default | Meaning |
|---|---|---|---|
| `id` | string | required | The place's id |
| `name` | string | none | For the game; the engine doesn't read it |
| `tags` | string[] | none | What actions can ask for: `'food'`, `'home'`, `'social'`... |
| `in` | place id | none | The place this one is inside |
| `region` | string | the parent's, else `'world'` | What the game loads at once |
| `hours` | `[open, close)` | always open | Opening hours, fractional, wrapping past midnight (`[17, 2]`). Equal values mean always open |
| `slots` | `{ name: count or SlotDef }` | none | Named slots with a capacity: stools, beds, a till |
| `offers` | action ids | none | Actions this place offers on top of those whose `at` matches it (see below for the limits) |
| `owner` | id | none | Whose place it is: prices are paid to them and wages paid by them (Ceres) |
| `quality` | number | 1 | Multiplies the relief of actions done here, when weighing and when it's applied |
| `stock` | `{ item: n }` | none | Goods on sale at the start; also the cap for restocking (Ceres) |
| `restock` | `{ item: [amount, everyHours] }` | none | Restocking (Ceres) |
| `data` | object | none | Anything the game wants to keep with the place: a level id, coordinates, spots |

Places are definitions: declare them on every start. Each declared place gets a state entry in `world.s.places[id]` (its slot claims and stock) the first time it's declared; a loaded save keeps the saved state.

## Tags

An action with `at: 'tag:food'` can happen at any place tagged `food`. A tag also counts for places inside the tagged place: `at:tag:food` is true for someone at the cafe's counter if the cafe is tagged `food`. But resolving `'tag:food'` to candidate places lists only places that carry the tag themselves.

No tag is special to the engine. `at: 'home'` means the person's own home (`PersonDef.home`), not any place tagged `home`; tags are only what your actions, conditions and storylets ask for.

## Places inside places

```js
world.place({ id: 'bar', tags: ['drink'], region: 'main', hours: [17, 2] });
world.place({ id: 'bar_till', in: 'bar', slots: { till: 1 } });
```

A place inside another:

- inherits its region (unless it sets its own), its tags (for `at:tag:` and for what it offers), its opening hours and a `closed:` fact on the parent;
- is reached for free from anywhere in the same outermost place, when travel comes from links. With a `shell.travel`, the shell decides (it's asked about any two different places);
- counts as "at" the parent: `at:bar` is true at the till, and the people at the till are present at the bar.

People who meet (for regard, gossip and barks) are those doing something at the same place or inside it. Actions aimed at a person look for targets anywhere in the outermost place.

## Regions

A region is what the game loads at once: a level, a district, a map. People get bodies when they're in a focused region (`world.focus(['main'])`), unless the game decides with its own `shell.near`. A place's region is its own, else its parent's, else `'world'`. A game with one map can leave regions out entirely and focus `['world']`. See [Integration: regions and focus](integration.md#regions-and-focus).

## Opening hours and closing

A place is open at a time when its `hours` include that hour, every parent's `hours` include it, and no `closed:<id>` fact is `true` for it or any parent.

```js
world.fact('closed:bar', true);    // a blackout: shut until further notice
world.fact('closed:bar', false);   // open again (by its hours)
world.ring.open('bar');            // is it open now?
world.ring.open('bar', world.now + 90);
```

Closing turns people away; it doesn't throw anyone out. Options at a closed place are ruled out ("bar is closed then") by the time they'd arrive, and someone who arrives after it closed fails and thinks again. Someone already doing something there finishes it. Staff doing their job's action at their job's place are let in when it's closed (see [Jobs](deciding.md#jobs-and-shifts)).

People with Reverie act on what they believe: a plan step goes to a place they think is open (`open:<id>` belief), and learns it's shut when it gets there.

## Slots

```js
world.place({ id: 'apt_1', tags: ['home'], slots: { bed: 2, shower: 1 } });
world.place({ id: 'club', slots: { sofa: { count: 4, who: ['member:regulars'] } } });
world.action({ id: 'sleep', at: 'home', slot: 'bed', minutes: 480, relieves: { energy: 0.95 } });
```

A slot has a capacity (`count`) and optionally `who`: conditions the person must meet to take it. An action with `slot` claims one when it starts and releases it when it ends, is interrupted or fails. Claims are state, so a full bar is full off screen too.

- When deciding, an option is ruled out if the person doesn't meet the slot's `who` ("the sofa isn't for them"), or if the slot is full (unless they already hold it).
- When the action starts, the claim is made. If it fails (someone got there first), the action fails, it's ruled out at that place for `config.backoff` minutes, and the person thinks again.
- A place with no such slot, or a capacity of 0, doesn't limit the action at all.

`who` is read for the person, at the place (`ctx.place`), both when deciding and when claiming.

Who holds a slot, in the order they claimed it: `world.ring.holders('cafe', 'seat')`. That order shifts when someone leaves, so if the game seats people on particular stools, assign the stool when the body starts the action and keep it (see [Integration: bodies](integration.md#mapping-place-and-slot-to-coordinates)).

## Offers, owners, quality and stock

**Offers.** `offers: ['eat']` says the place offers an action even though the action's `at` doesn't name it. In this version that only matters for routine entries of `'*'` at that place ("anything at the bar") and for `offeredAt` checks; free choices only look at the places the action's own `at` resolves to. To make an action available somewhere for free choice, list the place (or a tag it has) in the action's `at`.

**Owner.** With Ceres, an action's `price` is paid to the place's owner when it starts, and a `wage` (or the job's wage) is paid by the owner when it ends. The owner can be a person, a household or group id (its purse), or any id. No owner means `'world'`, outside the simulation.

**Quality** multiplies relief for actions done at the place (0.8 for a grubby diner, 1.2 for a good one). It's the place's own value; inner places don't inherit it.

**Stock** (Ceres): `stock` is the starting stock and the cap; `restock: { bread: [10, 3] }` adds 10 bread every 3 game hours (on hours where the hour count since minute 0 divides by 3), up to the cap. Actions with `buys` take from it and are ruled out when it's sold out. The game can add or remove stock with `world.ceres.restock(place, item, n)`.

## Travel: links or the shell

Travel time is minutes. It comes from one of two sources.

**Links** (the default): declare walks between places, and Tyrell finds the shortest path.

```js
world.link('apt_1', 'cafe', 8);           // both ways
world.link('cafe', 'market', 2);
world.link('lift_top', 'lift_bottom', 1, true);   // one way
world.ring.travel('apt_1', 'market');    // 10
```

Links join the outermost places; travel within one outermost place is free. Declare links between outermost places: a link on a place that's inside another is never used. Paths are computed with Dijkstra and cached. Places with no path between them are `Infinity` apart, and options there are ruled out ("can't get to"). Links are definitions: declare them every start.

**The shell**: give `shell.travel(from, to, person)` and Tyrell asks the game instead, for every pair of different places.

```js
const world = Tyrell.create({ shell: { travel: (from, to) => myPathMinutes(from, to) } });
```

The contract:

- Return minutes (fractions are fine), `0` for no walk, `Infinity` for unreachable.
- Be a pure function of the two ids (and the person, if you use it), the same on every call for the same state. It's called often (every candidate place of every option), during Esper replays too, and Tyrell doesn't cache it: cache it yourself.
- If travel depends on something that changes (a door unlocked, a bridge built), read it from Tyrell's state (a fact) so it rewinds with the world, and clear your cache when it changes.
- Match how fast bodies really walk on screen. If the shell says 6 minutes and the sprite takes 9, near and far disagree about when people arrive. See [Integration](integration.md#walking-along-a-route).

A walk always takes at least half a minute.

## Place specs

Wherever an action, a routine entry, a directive or a task step (an action step's `at`, or a `go:` step) names a place, it uses a place spec:

| Spec | Means |
|---|---|
| `'cafe'` | That place |
| `'tag:food'` | Any place with that tag (nearest first) |
| `'home'` | The person's home (`PersonDef.home`) |
| `'work'` | The person's job's place |
| `'here'` or `null` | Wherever the person is (their home if they're nowhere) |
| `'person:ruth'` | Wherever Ruth is now (nothing while she's walking) |
| `'target'` | Wherever the action's target is |
| an array | Any of these |

When a spec resolves to several places, they're sorted nearest first (ties by id), and only the first `config.placesPerAction` (4) are weighed. Omitting `at` on an action means `null`: it can be done anywhere.

## The Ring API

`world.ring` is the place graph. Reading is always safe. The methods that change state (`claim`, `release`) are for the engine; don't call them from the game.

| Method | Returns | Meaning |
|---|---|---|
| `place(def)` | void | Declares a place (use `world.place`) |
| `link(a, b, minutes, oneWay?)` | void | Declares a link (use `world.link`) |
| `get(id)` | PlaceDef or undefined | A place's definition |
| `defs` | Map | Every declared place |
| `state(id)` | PlaceState | `{ claims, stock? }`, made if missing |
| `tagged(tag)` | id[] | Places that carry the tag themselves |
| `hasTag(id, tag)` | boolean | The place or a parent has the tag |
| `region(id)` | string | Its region, or its parent's, or `'world'` |
| `root(id)` | id | The outermost place containing it |
| `within(inner, outer)` | boolean | `inner` is `outer` or inside it |
| `open(id, t?)` | boolean | Open at time `t` (default now) |
| `capacity(id, slot)` | number | The slot's capacity, 0 if none |
| `holders(id, slot)` | id[] | Who holds the slot, in claim order |
| `free(id, slot)` | number | Free places in the slot (`Infinity` if it doesn't limit) |
| `allowed(id, slot, person)` | boolean | The person (a PersonState) meets the slot's `who` |
| `present(id)` | id[] | Everyone at the place or inside it, not walking |
| `crowd(id)` | number | Share of the place's slot capacity in use, 0..1 |
| `travel(a, b, person?)` | minutes | Travel time (shell or links) |
| `resolve(spec, person, target?)` | id[] | Candidate places for a spec, nearest first |
| `claim(id, slot, who)` | boolean | Engine only |
| `release(id, slot, who)` | void | Engine only |

## Strangers

Strangers are the passers-by of a busy street. A region declares how many people set out each hour and on what errands; Tyrell works out from the seed alone who is where at any moment. They cost nothing: they aren't people, have no minds, take no slots, meet nobody, and aren't saved. When the game needs one to matter (the player talks to them, they witness something), promote them into a real person.

```js
world.strangers.define('main', {
  perHour: [0, 0, 0, 0, 0, 1, 2, 4, 6, 4, 3, 3, 5, 4, 3, 3, 4, 6, 5, 4, 3, 2, 1, 0],
  errands: [
    { from: 'station', to: 'cafe', action: 'eat_cafe', minutes: [20, 40], weight: 2, hours: [6, 21] },
    { from: 'station', to: 'park', weight: 3 },     // passing through
  ],
  data: (r, id) => ({ coat: r.pick(['gray', 'navy', 'rust']) }),
});

const passersBy = world.strangers.at('main');       // bodies, like world.bodies()
```

`StrangerDef`:

| Field | Meaning |
|---|---|
| `perHour` | How many set out each hour: one number, or 24 numbers (one per hour of the day) |
| `errands` | What they do. One errand is drawn per stranger, by `weight`, among those whose `hours` include the hour they set out |
| `data(r, id)` | Fills in what the game needs to draw one (a look), from the stranger's own stream `r`. Goes in `body.data` |

`StrangerErrand`:

| Field | Default | Meaning |
|---|---|---|
| `from` | required | Where they come from (a street end, a station) |
| `to` | required | Where they go |
| `action` | none | What they do there; its `pose` is used while they stay |
| `minutes` | 0 | How long they stay: a number or `[min, max]`. 0 means passing through: they walk from `from` to `to` and are gone |
| `weight` | 1 | How likely this errand is |
| `hours` | always | Only for strangers setting out in these hours |

Each stranger sets out at a seeded minute in its hour, walks in (the travel time, at least a minute), stays, and walks back to `from` if it stayed. `at(region, t?)` returns the bodies of strangers who set out in the current hour or the four before and are still walking or staying, so errands longer than about four hours in total are cut short. A stranger body has the id `'~region:hour:i'`, an empty `name`, and the usual body fields. While walking in, `action` is `'travel'` and `next` is the errand's action (or `'pass'` when passing through); while staying, `action` is the errand's action (or `'idle'`) with its pose; while walking out, `action` is `'travel'` and `next` is `'leave'`.

| Method | Returns | Meaning |
|---|---|---|
| `strangers.define(region, def)` | void | Declares a region's passers-by (a definition: declare every start) |
| `strangers.at(region, t?)` | Body[] | The strangers about at a time (default now) |
| `strangers.find(sid, t?)` | Body or null | One stranger by id; a body with `action: 'gone'` when they've left |
| `strangers.promote(sid, def?, id?)` | id | Makes them a person with a mind (an input). Returns the new id (`id`, or `'p1'`, `'p2'`...) |
| `strangers.promoted(sid)` | id or undefined | Who they became |

A promoted stranger becomes a person defined by `def`, placed where the stranger is now (or where they were headed, if walking), unless `def.place` says otherwise, with the stranger's `data` merged under `def.data` and the tag `'promoted'` added. They're no longer listed by `at()`. Give the new person a `home` in `def` if they should have one.

```js
const id = world.strangers.promote(passersBy[0].id, { name: 'Nadia', home: 'apt_5', traits: { talkative: 0.8 } });
world.sense({ kind: 'theft', actor: 'player', place: 'cafe', seenBy: [id] });
```

Since strangers come from the seed and the time alone, the same stranger is in the same place for the same seed, whether or not anyone looked. Strangers use the same travel times as everyone else (`shell.travel` if you have one).
