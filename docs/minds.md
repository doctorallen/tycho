# The bridge

`dist/tycho-minds.js` (the global `TychoMinds`, and `Tycho.minds` when the engine is loaded first) is the glue a game with people on Tyrell would otherwise write itself: the game's clock driving the minds', the minds in the save, seats, who might be where, travel times, who saw what, the reports the minds file, and [harm](#harm), where Tycho's half meets Tyrell's. It moved here from the White Dragon's `city.js`; Merryfolk's shell uses it too.

It uses neither library's code. It reads a Tyrell world through a few calls (`now`, `s.v`, `esper.earliest()`, `advanceTo`, `load`, `get`, `on`, and for harm `fact`, `have`, `morgul` and `bree`), written out as types in `minds/index.ts`, and changes the minds only through Tyrell's own calls, so time walk and determinism stay Tyrell's. What it needs of the engine at run time (`Tycho.harm`'s means maker) the game passes in. Load it after `tyrell.js`:

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

## Harm

Harm has two halves ([Harm](harm.md)): `Tycho.harm` plays the moment on screen, in frames (the hit through the game's stages, the moves, the triggers), and Tyrell's [Morgul](../tyrell/docs/modules/morgul.md) what follows, in minutes, on screen and off (the wound, the fear, the grudge, the blame). Off screen Morgul settles everything by numbers; on screen the game plays it, and the bridge hands over between them. All it tells Morgul goes through Morgul's inputs, so time walk records it.

### The means

`means(world, list, Tycho.harm.means)` declares one table to both halves, so a game writes its weapons, spells, poisons and traps once: each to the world's Morgul (which reads `id`, `kinds`, `use`, `severity` and `course`, and keeps the rest), a means that's `set` as Morgul's trap too (hidden as its `trigger` says, catching `uses`, 1 by default, with its own `catch` chance off screen), unless the game declared that trap itself; then it returns what the maker the game passed makes of the list (`Tycho.harm.means`: the `Arsenal`), or a copy of the list. Declare them again on a new world, as every definition. A character holds a means as a good of the same id.

```js
const ARSENAL = Tycho.minds.means(City.w, [
  { id: 'cudgel', kinds: ['blunt'], use: 'strike', severity: 0.2, move: { windup: 0.35, active: 0.1, recover: 0.45, area: { touch: 2 } }, blow: { amount: 8 } },
  { id: 'nightshade', kinds: ['poison'], use: 'dose', course: 'nightshade', severity: 0.4 },
  { id: 'snare', kinds: ['cut'], use: 'set', severity: 0.2, trigger: { zone: { w: 12, h: 4 }, once: true, hidden: true }, blow: { amount: 5 } },
], Tycho.harm.means);
```

### A hit, as a harm

`harm(world, hit, o)` turns a hit `Tycho.harm` landed (its `Hit`: the body struck, the blow, the amount that got through) into Morgul's harm, and returns it as Morgul tells it (with the wound it left and how hurt the one struck is), or null: no Morgul, nobody with a mind struck (a creature), or nothing got through. Call it for a hit that landed.

| Option | Default | |
|---|---|---|
| `id(body)` | its `id`, or the body if it's a string | The Tyrell id of a body: `'player'` for the player, null for a body with no mind |
| `whole` | | What the game measures in full on the one struck (a health bar's top, or a function of the body): the severity is the hit's share of it |
| `severity(hit)` | | Or the severity itself. With neither, the blow's own `severity` by the share of its amount that got through (a means' 0.2, halved by armor, is 0.1), else the amount |
| `by`, `via`, `intent`, `what`, `cause`, `course`, `place` | the blow's (`what` its `what` or `means`), `'blow'` | As Morgul's harm takes them; the place defaults to where the one struck is |
| `seenBy` | | Who saw it, by id; or |
| `people`, `sight`, `at` | the one struck | The bodies about and the game's sight, for `witnesses` (nearest first; the two in it and bodies with no mind left out) |

```js
const h = FOE_HIT.land(ruth, { ...cudgel.blow, kinds: cudgel.kinds, by: player, means: cudgel }, { rng });
Tycho.minds.harm(City.w, h, { id: (b) => b.mind, whole: (b) => b.maxHp, people: Actors.npcs, sight: { reach: [180, 40] } });
```

### The scuffle

A fight between characters goes on by numbers wherever it is (Bree's fight, each turn a blow by Morgul's odds); near the player the game shows it as a scuffle. `scuffles(world, { keep, heavyAt })` keeps what the game needs to show it in step with the turns, from Bree's events:

- `take(since?)`: the beats since the last take, in order. A **start** (the two squaring up), a **blow** each turn, and an **end**. A blow says whose turn it was and at whom (`swing`, `at`), whether their blow landed (`lands`; if not, the other countered), and the blow itself (`hit`: by, to, kind, `severity`, `heavy` past `heavyAt`, 0.25 by default, what with, how hurt the one struck is now, its harm's id), and `end` if the fight ends with it (`'down'`, `'yielded'`, `'left'`). The end says why (Bree's: those, or `'stepped in'`, `'done'`, `'parted'`), who walked off, who stepped in. Every beat has the fight's id, the time, its kind, the two in it, where, and who started it.
- `fights()`, `of(id)`: the fights going on now, as the world has them, so a rewind or a load leaves nothing stale (going forward again plays the same beats again).
- `keep(fight)`: which fights the game shows (the ones in its loaded level, say); only their beats are kept.

```js
const scuffle = Tycho.minds.scuffles(City.w, { keep: (f) => levelOf(f.place) === World.L.id });
for (const b of scuffle.take()) {
  if (b.type === 'blow') swingAt(npc(b.swing), npc(b.at), b.lands, b.hit);   // a flinch for a heavy one, the one struck staggering
  if (b.type === 'end' && b.end === 'down') lieDown(npc(b.who.find((x) => City.w.morgul.isDown(x))));
}
```

### Fights with the player

A fight with the player in it is played in frames: the player's strikes, casts and throws through `Tycho.harm`, each reported with `harm`, and the character's back with the moves of what they hold. Whether they fight back, flee, yield or call for help is Morgul's choice, made as the fight starts and after each harm between them face to face (not a trap or a dose). `fighters(world, { might, gap })` makes each answer into what the game's fighter should do:

- `take()`: the answers since the last take, each a plan: `act` (`'fight'`, `'flee'`, `'yield'`, `'help'`), when (`t`), whether the fight starts with it, their odds against the player, how hurt they are, who they call on (`help`), and `means`, what they'd fight with (the strongest means they hold that strikes, throws, shoots or casts, as Morgul picks it; null for their fists).
- `plan(id)`: someone's answer now, their last, unless the fight's gone quiet longer than `gap` (Morgul's `fightGap`, 30 minutes).
- `ask(id)`: how they'd answer now, a look that changes nothing (will they fight if the player squares up?). `means(id)`: what they'd fight with.
- `sync()`: sets the player's might, the game's own (`might()`: their gear, their strength), as the world's fact Morgul reads (`might:player`), an input only when it changes. Call it before reporting the player's hits, or each frame. `might(world, value)` does the same on its own.

```js
const foes = Tycho.minds.fighters(City.w, { might: () => 1 + Gear.might() });
foes.sync();
for (const p of foes.take()) brain(npc(p.id)).set(p.act, { with: p.means && ARSENAL.get(p.means.id), call: p.help });
```

### Traps near and far

Morgul springs traps off screen by chance, except at places near the player, which are the game's to spring with its triggers, so nobody is caught twice. `traps(world, { regions, make, drop })` hands them over:

- `sync()`: tells Morgul which regions are near (`regions()`, the game's loaded ones; Morgul's `near`, an input only when they change) and keeps the traps at near places as the game's: those that came near are made (`make(trap)`, the game's own trigger, from the trap's means, at its place's spot) and those gone off, disarmed or no longer near are let go (`drop(trap)`). It returns both, `{ add, drop }`.
- `list()`, `get(id)`: the game's traps now, each Morgul's (its kind, place, who set it and for whom, uses left, who knows of it) with its `means` and the game's own object (`obj`).
- `spring(id, who, seenBy?)`: a trigger sprang on a character or the player; Morgul's harm follows (by whoever set it, through the trap), and the next sync lets it go once it's spent. `disarm(id, by?)` and `set(kind, { by, place, for, seenBy })` do the same for a trap disarmed or set on screen (the player's own snare).

```js
const snares = Tycho.minds.traps(City.w, {
  regions: () => [World.L.id],
  make: (t) => World.addTrigger(new Tycho.harm.Trigger(t.means.trigger), spotOf(t.place), t.id),
  drop: (t) => World.removeTrigger(t.obj),
});
snares.sync();
// a body steps in one
if (trigger.spring(placed, body)) snares.spring(placed.trap, body.mind, witnessesOf(body));
```
