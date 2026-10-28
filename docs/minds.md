# The bridge

`dist/tycho-minds.js` (the global `TychoMinds`, and `Tycho.minds` when the engine is loaded first) is the glue a game with people on Tyrell would otherwise write itself: the game's clock driving the minds', the minds in the save, seats, who might be where, travel times, who saw what, and the reports the minds file. It moved here from the White Dragon's `city.js`; Merryfolk's shell uses it too.

It uses neither library's code. It reads a Tyrell world through a few calls (`now`, `s.v`, `esper.earliest()`, `advanceTo`, `load`, `get`, `on`), written out as types in `minds/index.ts`, and changes the minds only through Tyrell's own calls, so time walk and determinism stay Tyrell's. Load it after `tyrell.js`:

```html
<script src="vendor/tycho/dist/tycho.js"></script>
<script src="vendor/tycho/dist/tyrell.js"></script>
<script src="vendor/tycho/dist/tycho-minds.js"></script>
```

## Time

`minutes(day, hour)` is Tyrell's time (minutes) from a day number and an hour; `hourOf(t)` the hour of the day at a time, before midnight too; `progress(doing, now)` how far along something from `start` to `end` is, 0 to 1 (a walk, say).

A `clock` runs the minds to the game's time each frame:

```js
const minds = Tycho.minds.clock({
  world: () => City.w,                  // a getter: the game may make a new world
  minutes: () => Tycho.minds.minutes(Game.day, Game.hour),
  remake: (t) => City.make(t, null),    // further back than Esper remembers: a new world from then
});
minds.sync(); // 'off' (no world), 'same', 'ran' (forward, or back through time walk), 'remade'
```

Back is Tyrell's `advanceTo`, which seeks through Esper. A game with time walk off passes `back: false`: a game time behind the world's is left, and the world waits for the game to catch up.

## Saving

`stash(world, extra)` is what goes in the game's save: `{ tyrell: 'world', v, ...extra, s }`, the state itself (the save writes it out), with the game's own fields beside it. `restore(world, saved, { accept, now })` reads it back into a world just made, and returns whether it did: a save `accept` turns down (another population, say) or one Tyrell can't read (`onError` is told) leaves the new world, run to `now` if given.

```js
Game.s.city = Tycho.minds.stash(w, { pop: CITY.pop });
// and on starting
Tycho.minds.restore(w, Game.s.city, { accept: (s) => s.pop === CITY.pop, now });
```

## Seats

A `Seats` hands out seats so nobody sits in anybody: someone doing an action at a place with several seats keeps one while they're doing that there. `take(id, place, act, start, n, first)` gives a seat from 0 to `n - 1`: the one they'd pick (`first`, a hash of who they are) or the first free one after it. A seat comes free when its sitter is somewhere else, on the way somewhere, or doing something else. `clear()` for a new world.

```js
const seats = new Tycho.minds.Seats(() => City.w);
const i = seats.take(id, place, 'drink', doing.start, stools.length, Math.floor(hash(id) * stools.length));
```

## Who might be where

Working out where everyone is each frame is costly in a big city; a `Presence` says whether someone might be in a region (a level, a room) without it. The regions a doing can touch are worked out once per doing by the game (`regions(person)`: for a walk, every region its route passes; staying put, the place's) and kept until they're doing something else. `may(id, region)` is false for anyone away or unknown.

```js
const here = new Tycho.minds.Presence(() => City.w, (p) => p.doing && p.doing.kind === 'travel' ? levelsOnRoute(p) : [levelOf(p.place)]);
if (here.may(id, World.L.id)) place(id);
```

## Travel times

`travelTimes(f)` keeps a travel time a pair of places (for Tyrell's `shell.travel`), worked out once by the game's own route `f(a, b)`, and 0 from a place to itself. `.clear()` forgets them.

## Who saw

`witnesses(at, people, { room, reach, can, far })` is who sees something done at a spot, nearest first: in a room (`room: true`) everyone in it; in the open, whoever is within `reach`, a box `[across, up and down]` (180 by 40 by default). `can(n)` says who can see at all (not someone hidden); `far(n, at)` orders them (the distance across by default; a top-down game would give the straight distance). The game then tells Tyrell what they saw (`world.sense`).

## Reports

`collect(world, kind, keep)` keeps what the world emits of one kind (Wormtongue's `report`) for the game to act on in its own time: `take()` hands them over and empties the list.

```js
const reports = Tycho.minds.collect(w, 'report', (r) => r.actor === 'player');
// later, each frame
const r = reports.take(); if (r.length) addHeat(r.length * 6);
```
