# Integration

Everything a game does to run Tyrell: the shell, regions and focus, bodies, the clock, reporting what happened, talking, saving. It ends with notes for two common layouts and a checklist.

- [What the game does](#what-the-game-does)
- [The shell](#the-shell)
- [Regions and focus](#regions-and-focus)
- [Bodies](#bodies)
- [Reporting back from a body](#reporting-back-from-a-body)
- [Who owns the clock](#who-owns-the-clock)
- [Sensing and deeds](#sensing-and-deeds)
- [Talking](#talking)
- [Directing the story](#directing-the-story)
- [Custom inputs](#custom-inputs)
- [Saving](#saving)
- [Layout: a side-scroller with many small levels](#layout-a-side-scroller-with-many-small-levels)
- [Layout: a top-down game with one map](#layout-a-top-down-game-with-one-map)
- [Checklist](#checklist)

## What the game does

| The game... | With |
|---|---|
| Declares the world on every start | `world.need`, `place`, `link`, `action`, `task`, `deed`, module declarations |
| Adds people (or loads them) | `world.person`, `world.load` |
| Moves time | `world.tick` or `world.advanceTo` |
| Says what's on screen | `world.focus` or `shell.near` |
| Draws and walks bodies | `embody`, `step`, `disembody` events; `world.bodies()`, `world.body(id)` |
| Says when a body couldn't do something | `world.report` |
| Says what was seen and done | `world.sense`, `world.did` |
| Asks people what they'd say | `cityspeak.choose`, `cityspeak.say`, `bark` events |
| Steers the story | `world.direct`, `world.fact`, Gaff storylets |
| Saves and loads | `world.save`, `world.load`, `world.keep` |

## The shell

The shell is three optional callbacks the engine asks the game. Pass them at creation:

```js
const world = Tyrell.create({
  seed: 'my-town',
  shell: {
    travel: (from, to, person) => pathMinutes(from, to),
    near: (body, world) => isOnScreen(body),
    check: (fact, ctx) => (fact === 'lights' ? game.lightsOn : undefined),
  },
});
```

| Callback | Asked | Return | Default |
|---|---|---|---|
| `travel(from, to, person?)` | Whenever a travel time is needed: weighing options (every candidate place), starting walks, strangers | Minutes; `0` for no walk; `Infinity` for unreachable | Shortest path over `world.link` links |
| `near(body, world)` | For every active person, every time bodies are refreshed (each `tick`, `advance`, `seek`, `focus`, `load`) | `true` if the person should have a body | In a focused region (or walking from or to one) |
| `check(fact, ctx)` | When a `fact:<key>` condition finds no fact set | A value, or `undefined` | Nothing (`null`) |

Contracts:

- **`travel`** must be deterministic: the same answer for the same ids and the same Tyrell state. It's called often and isn't cached by Tyrell, so cache it. It's called for any two different places, including a place and one inside it. Its minutes must match how fast bodies walk on screen. It may read Tyrell's state (facts) but not game state that doesn't rewind. See [Places: travel](places.md#travel-links-or-the-shell).
- **`near`** gets the body as it would be shown now. It decides only who gets a body; it never changes what anyone does. With a `near`, `focus()` no longer decides who's near (Gaff still reads it to find places nobody can see). It's called for every active person on every refresh, and builds a body for each, so keep it cheap.
- **`check`** is live and isn't rewound. Prefer `world.fact(key, value)` whenever the game's state changes: facts are saved, rewound and replayed. Use `check` only for things that never matter across a rewind.

## Regions and focus

A region is what the game loads at once: a level, a district, the whole map. Each place has one (`region` on the place, or its parent's, or `'world'`).

```js
world.place({ id: 'noodles', region: 'd_noodles', tags: ['food'], slots: { stool: 7 } });
world.place({ id: 'grocery', region: 'd_grocery', tags: ['shop'] });

world.focus(['d_noodles']);                 // the player walked into the noodle bar
```

`world.focus(regions)` says which regions are loaded. With the default near rule, a person is near when their place is in a focused region, or when they're walking from or to one. Focus isn't saved and isn't part of the state: call it on start, after a load (in a new world), and whenever the loaded level changes. Calling it refreshes bodies at once.

## Bodies

A body is a person as the game should show them now. The game gets bodies from events, and can ask for them any time:

```js
const sprites = new Map();
world.on('embody', (body) => sprites.set(body.id, makeSprite(body)));
world.on('step', (body) => { const s = sprites.get(body.id); if (s) s.body = body; });
world.on('disembody', ({ id }) => { destroySprite(sprites.get(id)); sprites.delete(id); });
world.on('arrive', ({ id, place }) => { /* anyone, near or far, got somewhere */ });

world.bodies();       // everyone near now
world.body('ruth');   // anyone's body, near or not (null if they're away or gone)
```

| Event | Payload | When |
|---|---|---|
| `embody` | Body | Someone comes into view: on focus, after time moves, after a seek or a load. They may be mid-walk or mid-meal |
| `step` | Body | A near person starts something: sets out, starts an action, starts a plan's wait, follows a leader |
| `disembody` | `{ id }` | Someone leaves view: walked out of the focused regions, went away, left for good, or every body before a backward seek or a load |
| `arrive` | `{ id, place }` | Anyone arrives anywhere, near or far |
| `failed` | `{ id, why }` | Anyone's action or walk failed (a closed door, a taken stool, a report) |

Listeners run in the middle of the engine's work. Inputs they make (a report, a fact) wait until the engine finishes the event it's handling. Calls that move time or replace the state (`tick`, `advanceTo`, `seek`, `load`...) made from a listener wait until the call that's running returns, then run.

Someone who finishes and has nothing to do waits (`action: 'wait'`) without a `step` event. Refresh a sprite's body from `world.body(id)` when `world.now` passes its `end`, or simply read `world.body(id)` every frame for the people on screen.

### Body fields

| Field | Meaning |
|---|---|
| `id` | The person's id |
| `name` | Their name |
| `place` | Where they are; `null` while walking |
| `slot` | The slot they hold, if any (`'stool'`) |
| `action` | The action id; `'travel'` while walking; `'wait'` while waiting or idle |
| `next` | While walking: the action they're walking to do (`'@go:<place>'` for a plan's bare walk) |
| `pose` | The action's `pose`; `'walk'` while walking; `'idle'` while waiting or for actions without a pose |
| `target` | The person the action is aimed at |
| `progress` | 0..1 through the current action or walk, when the body was made |
| `start`, `end` | When it started and ends, in minutes |
| `travel` | While walking: `{ from, to, start, end, f }`, with `f` the fraction walked when the body was made |
| `emotion`, `mood` | With Reverie: the emotion showing and the mood, for faces and posture |
| `with` | The person the routine entry names in `with` (a hint for walking side by side) |
| `data` | The person's `PersonDef.data` (a look, a sprite id) |

To know the layer (job, routine, need...), read `world.get(id).doing.layer`.

### Mapping place and slot to coordinates

Tyrell has no coordinates; keep them in the place's `data` and pick a spot per slot. `world.ring.holders(place, slot)` lists who holds a slot in claim order, but that order shifts as people leave, so assign each person a spot when they start and keep it:

```js
world.place({
  id: 'noodles', region: 'd_noodles', slots: { stool: 4 },
  data: { spots: { stool: [120, 150, 180, 210], default: [300, 330] } },
});

const seats = new Map();   // person id -> { place, slot, i }
function spotFor(body) {
  const spots = world.ring.get(body.place)?.data?.spots ?? {};
  const list = spots[body.slot ?? 'default'] ?? spots.default ?? [0];
  let s = seats.get(body.id);
  if (!s || s.place !== body.place || s.slot !== body.slot) {
    const taken = new Set([...seats.values()].filter((v) => v.place === body.place && v.slot === body.slot).map((v) => v.i));
    let i = 0;
    while (taken.has(i) && i < list.length - 1) i++;
    s = { place: body.place, slot: body.slot, i };
    seats.set(body.id, s);
  }
  return list[s.i];
}
world.on('disembody', ({ id }) => seats.delete(id));
```

### Walking along a route

While walking, a body has `travel: { from, to, start, end, f }`. The walk takes exactly `end - start` game minutes whether or not anyone watches. The simplest way to keep near and far in agreement is to place the sprite from the fraction each frame:

```js
function walkerPosition(body) {
  const tr = body.travel;
  const f = Math.min(1, Math.max(0, (world.now - tr.start) / (tr.end - tr.start)));
  const path = myRoute(tr.from, tr.to);          // the game's path, as points
  return pointAlong(path, f);                    // so the sprite arrives at tr.end
}
```

If your sprites walk at their own speed instead, the shell's travel times must match that speed, or sprites arrive before or after Tyrell says they do. Arriving early is harmless (stand at the door until the `step` for the action comes); arriving late means a snap. Don't call `world.report(id, 'done')` to make an on-screen walk end early: the arrival would then differ from the one an unwatched world would have.

### Hand-over mid-action

There's nothing to hand back. When someone comes into view, `embody` gives their body as it is now: halfway along a walk (`travel.f`), or forty minutes into a two-hour drink (`progress`). Place the sprite with the same functions as above. When they leave view, `disembody` tells you to remove the sprite, and Tyrell carries on with the same timetable.

## Reporting back from a body

When a body can't do what Tyrell asked, say so:

```js
world.report('ruth', 'failed', 'the door is locked');   // she stops, and thinks again
world.report('ruth', 'done');                           // she's finished early
```

| Report | Effect |
|---|---|
| `'failed'` | The current walk or action stops. A walk ends at the place they're nearest (`to` past halfway, else `from`); an action keeps the relief it gave so far. The `failed` event and log entry; the action is ruled out at that place for `config.backoff` minutes (15); a plan replans, and they think again |
| `'done'` | The current walk or action ends now, as if it ran its course: a walk arrives, an action gives its full relief and effects |

Both are inputs: a report made inside a `step` listener is deferred to the end of that event and recorded there.

A failure backs off: the action that failed is ruled out at that place for `config.backoff` minutes (15 by default), so the person chooses something else (the inspector says `failed recently`), and may try it again after that. Someone who fails over and over at one moment (a listener that reports a failure for every `step`) stops choosing after ten failures and waits `config.idle` minutes instead. So a failure can't loop, but an obstacle that stays makes them fail again each time the back-off runs out. Fail only when the obstacle is real, and when it lasts, change something (a fact, a closed place) so nobody chooses it:

```js
world.fact('closed:vault', true);          // now nobody chooses it
world.report('ruth', 'failed', 'locked');
```

## Who owns the clock

**Tyrell owns it.** Call `world.tick(seconds)` every frame. The game reads the time from Tyrell.

```js
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (!paused) world.tick(dt);       // minutesPerSecond × speed game minutes per second
  drawDayNight(world.hour);
  drawBodies();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

`config.minutesPerSecond` sets the pace (1 by default: a game day is 24 real minutes); `world.speed` scales it (0 pauses, negative plays backward with Esper). `tick` has a frame budget (`config.budgetMs`, 4 ms): on a heavy frame time runs a little slow instead of stuttering. Sleeping or a cut scene: `world.advance(minutes)`.

**The game owns it.** Games with their own clock (a day of N real seconds, a dev slider, sleep that jumps the clock) call `world.advanceTo` with the game's time in minutes every frame:

```js
function gameMinutes() { return (game.day * 24 + game.hour) * 60; }   // minutes since day 0, midnight

function syncTyrell() {
  const t = gameMinutes();
  if (t < world.esper.earliest()) rebuildWorld(t);   // further back than time walk remembers
  else if (t !== world.now) world.advanceTo(t);      // forward, or back with Esper
}
```

`advanceTo` has no frame budget, so a big jump runs at once. A time in the past seeks back with Esper (or does nothing if Esper is off), so make sure the game's clock never goes backward by accident, and uses the same epoch: minute 0 is midnight on day 0.

Either way, read `world.now`, `world.hour`, `world.day` and `world.weekday` for the time.

## Sensing and deeds

Tyrell never decides who saw what. The game knows where everyone is on screen, so it reports what was perceived and by whom.

```js
// the player stripped a till; the game works out who could see it
const seenBy = world.bodies()
  .filter((b) => b.place === 'grocery' && canSee(sprites.get(b.id), player))
  .map((b) => b.id);
world.sense({ kind: 'strip', actor: 'player', what: 'till', place: 'grocery', seenBy, strength: 0.8 });
```

`Stimulus`:

| Field | Default | Meaning |
|---|---|---|
| `kind` | required | What happened: `'strip'`, `'theft'`, `'fight'`, `'shout'`. With Wormtongue, a kind declared as a crime is treated as one |
| `actor` | required | Who did it (`'player'` for the player) |
| `what` | none | What it was done to or with (`'till'`). It becomes the value of the witnesses' belief |
| `place` | none | Where |
| `seenBy` | everyone at `place` except the actor | Who perceived it. Only people doing something at the place count by default, not people walking past |
| `strength` | 1 | How clearly, 0..1 |
| `disguise` | 0 | How well the actor was disguised, 0..1 |
| `data` | none | Anything else |

Off screen, people commit crimes too (actions with `crime`), and everyone at the place may witness them. What happens next (beliefs, memories, reports, heat, gossip) is [Wormtongue](modules/wormtongue.md).

A **deed** is something someone did to or for someone else. Declare what each verb means, then report deeds as they happen:

```js
world.deed('fixed', { feeling: 'helped', regard: 0.2, memory: 6, sentiment: 'fixed my radio', fame: 0.05 });
world.deed('cheated', { feeling: 'wronged', regard: -0.3, memory: 7, infamy: 0.1, crime: 'fraud' });

world.did('player', 'fixed', { for: 'ruth', what: 'radio' });
world.did('player', 'cheated', { for: 'dev', what: 'change', place: 'market', seenBy: ['ruth'] });
```

`DeedDef`:

| Field | Module | Meaning |
|---|---|---|
| `feeling` | Reverie | A feeling for the person it was done to |
| `witnessFeeling` | Reverie | A feeling for anyone in `seenBy` |
| `memory` | Reverie | The importance (1..10) of the memory it leaves the receiver |
| `regard` | Fellowship | Change in the receiver's regard for the doer (witnesses get 0.4 of it) |
| `sentiment` | Fellowship | A sentiment the receiver keeps about the doer (worth `regard`, or 0.1) |
| `fame`, `infamy` | Fellowship | Change in the doer's standing with each of the receiver's groups |
| `crime` | Wormtongue | Treat it as this crime when witnessed (needs `seenBy`) |

The `data` of `world.did`: the receiver is `for` (or `to`, or `target`); `what`, `place` and `seenBy` (an array of ids) are read by the modules; anything else is logged. Every deed is noted in the receiver's file on the doer (and the witnesses'), which conditions read as `file:player.fixed`. Actions with `deed` and a target report the same way when they end. In TypeScript, `seenBy` needs a cast, since `data` is typed as plain values.

`world.westmarch.chronicle(id, since)` lists deeds done to someone only when the data names them as `target`; use `{ for: id, target: id }` if you show chronicles.

## Talking

People's lines are [Cityspeak](modules/cityspeak.md). The game owns the words: lines carry a key (and optionally text), and the most specific line that matches the moment wins.

```js
const line = world.cityspeak.choose('mara', { topic: 'greet', to: 'player' });   // look only
const said = world.cityspeak.say('mara', { topic: 'greet', to: 'player' });      // say it
if (said) showBubble(said.who, said.text ?? myStrings[said.key]);

world.on('bark', ({ a, b, lines }) => {
  for (const l of lines) setTimeout(() => showBubble(l.who, l.text ?? myStrings[l.key]), l.after * 1000);
});
```

`choose` changes nothing; `say` is an input: it remembers the line was said (for `once` and `cooldown`), applies the line's `then` effects, and emits `say`. Barks are short exchanges between two people who meet while one of them is near; they never change the world. For a language-model voice, see [Joi](modules/joi.md).

## Directing the story

```js
world.direct('vance', { do: 'patrol', at: 'market', until: world.now + 120 });
world.direct('vance', null);
world.fact('festival', true);
world.gaff.trigger('blackout');
```

Directives outrank jobs and routines (see [Deciding](deciding.md#directives)); facts change what conditions see; Gaff's storylets pace events on their own (see [Gaff](modules/gaff.md)).

## Custom inputs

Some changes have no ready-made input: setting a need when the player feeds someone, changing a person's definition, recalling a memory in dialogue. Define an input, and call it through `world.input`, so Esper records and replays it:

```js
world.defineInput('feed', (id, amount) => {
  const p = world.get(id);
  if (p) world.mind.setLevel(p, 'hunger', world.mind.level(p, 'hunger') - amount);
});

world.input('feed', ['kofi', 0.5]);
```

- Define it on every start, before loading a save or seeking (a replay looks inputs up by name and skips unknown ones).
- Arguments must be plain JSON: they're copied into the history.
- Inside the handler, change state directly: the handler is the input.
- `world.input` returns the handler's result, except inside a listener, where the call is deferred and returns `undefined`.

## Saving

```js
localStorage.setItem('save', JSON.stringify({ game: game.s, tyrell: world.save() }));

// on start: declare everything, then load
const saved = JSON.parse(localStorage.getItem('save'));
if (saved) world.load(saved.tyrell);
world.focus([currentLevel]);
```

`world.save()` is the whole state as plain JSON. On load, declare everything first (or after: both work), and `world.person` returns the saved person. Small pieces of game state that should rewind with the world go in `world.keep`. See [Saving](saving.md).

## Layout: a side-scroller with many small levels

Games like *Under the White Dragon* show one small level at a time: a street, and each building's interior as a level of its own, joined by doors and by the ends of streets.

- **One region per level.** Every place belongs to the level it's drawn in: `{ id: 'noodles', region: 'd_noodles' }`. A street can be one place, or a place per spot that matters (`'street@424'` by a door). Interiors are places in their own regions. Seats and beds are slots, with x positions in `data`.
- **Travel through doors.** A walk from the flats to the noodle bar goes out of one door, along the street, and in at another. Either link places with minutes that match walking speed (flat to stairwell, stairwell to street, street to bar), or give `shell.travel` that measures the game's own route and divides by walking speed (cache it per pair).
- **Near from the route, not the ends.** The default near rule shows a walker whenever either end of the walk is in a focused region, so someone walking from the flats to the bar would stand in the bar for the whole walk. Give `shell.near(body)` that works out which level the walker is in at `travel.f` along the game's route (the leg containing `f` times the route's length) and compares it with the loaded level. People in places the game doesn't draw (asleep behind a wall) can return `false` too.
- **Still call focus.** With `shell.near`, focus doesn't decide who's near, but Gaff reads it to find places nobody can see. Call `world.focus([level])` when the level changes.
- **Bodies.** In a room, x comes from the place's `data` and the slot's spot. While walking, x comes from the leg in this level: a walker entering through a door starts at the door's x.
- **Sight.** The game knows who's in the level and how far away: `seenBy` is the people in the same level within some distance (and facing, and lit, if the game models that).
- **The clock.** These games often own their clock (a day of N real seconds; sleep jumps it). Call `world.advanceTo(gameMinutes())` every frame. Going back (a dev slider) seeks with Esper while it remembers; further back, rebuild the world.
- **A first look.** Create a new world a day before the game's start time and advance it to now, so everyone is mid-errand when the player first looks. With a save, load it instead.
- **Saving.** Put `world.save()` (or `world.s`, which is the same data uncopied) inside the game's own save.

## Layout: a top-down game with one map

Games like *Merryfolk* show the whole village on one map, with everyone visible all the time and travel along tiles.

- **Everyone is near.** Leave regions out (every place is in `'world'`) and call `world.focus(['world'])`. Every active person has a body, all the time. Prefer this to `shell.near: () => true`, which builds a body for every person on every refresh just to test it.
- **Places are tiles.** A house, a shop, a field: ids with `data: { x, y }` and slots for beds and benches with their own tiles.
- **Travel from the pathfinder.** `shell.travel(from, to)` returns the path length in tiles times minutes per tile, cached per pair, `Infinity` when there's no path. Walk the sprite along the same path by `travel.f`. If the map changes (a bridge is built), set a fact, clear the cache, and have the pathfinder read the fact, so travel stays right across a rewind.
- **Many events.** Everyone is near, so `step` comes for everyone and barks come from every meeting. Filter barks by distance to the camera before showing them.
- **Blocked sprites.** If the player stands in a doorway, either let the sprite wait and catch up with Tyrell's timetable (snap if it falls far behind), or report `'failed'` when the way is truly shut (and change something, so it doesn't fail again at once).

## Checklist

- [ ] `dist/tyrell.js` loaded before the game's scripts (and listed in the service worker).
- [ ] Every definition declared on every start: needs, places, links (or `shell.travel`), actions, tasks, deeds, module content, custom terms, effects and inputs.
- [ ] People added with `world.person` on every start (it returns saved people after a load).
- [ ] Setup inputs that must happen once (`ceres.pay`, `ceres.income`, `fellowship.setPartner`) guarded with `world.kept(...)` so they don't repeat.
- [ ] Time moved every frame: `world.tick(dt)` or `world.advanceTo(gameMinutes())`.
- [ ] `world.focus([...])` on start, after loading into a new world, and on every level change (or `shell.near`).
- [ ] `embody`, `step`, `disembody` handled; bodies refreshed when their `end` passes.
- [ ] Walks drawn from `travel.f`, or shell travel times that match walking speed.
- [ ] `world.report(id, 'failed')` only for real obstacles, with something changed when the obstacle lasts.
- [ ] `world.sense` and `world.did` with `seenBy` from the game's own geometry.
- [ ] No writes to `world.s` or engine-side methods from game code; custom inputs for anything else.
- [ ] Facts pushed with `world.fact`, not answered live by `shell.check`.
- [ ] Game state that must rewind kept with `world.keep` or restored on `seek`.
- [ ] Save with `world.save()`, load with `world.load()`, `MIGRATIONS` for schema changes.
- [ ] Voight-Kampff run on the game's world in CI.
