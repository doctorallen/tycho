# Time (Entmoot and Esper)

Entmoot is the clock and scheduler, named for the Ents' council, which takes its time and gets there in the end. Esper is time walk, named for Blade Runner's photo machine that moves around inside a single moment: run faster, rewind, play backward, branch, bookmark.

- [The event queue](#the-event-queue)
- [Moving time](#moving-time)
- [Speed and the frame budget](#speed-and-the-frame-budget)
- [Timers](#timers)
- [Away and back, following](#away-and-back-following)
- [How Esper works](#how-esper-works)
- [Seeking, rewinding and playing backward](#seeking-rewinding-and-playing-backward)
- [Branching and echoes](#branching-and-echoes)
- [Marks](#marks)
- [The game's own state: keep() and the seek event](#the-games-own-state-keep-and-the-seek-event)
- [EsperConfig and memory](#esperconfig-and-memory)
- [Saving with history](#saving-with-history)
- [Rules for a rewind-safe game](#rules-for-a-rewind-safe-game)
- [Building with time walk](#building-with-time-walk)

## The event queue

Off screen nothing ticks. The world's state holds a queue (a heap ordered by time, then by sequence number) of the moments something happens:

| Kind | What happens |
|---|---|
| `end` | Someone's action, walk or wait ends |
| `think` | Someone thinks again: after idling, at a routine or shift boundary, or when a need is about to become urgent |
| `hour` | Every whole game hour: modules' hourly upkeep (Gaff's storylets, Ceres' restocking); at midnight also the daily upkeep (feelings and beliefs fading, rent, births) and a `day` log entry |
| `timer` | A game timer set with `world.at` |
| `module` | A module's own timer (a witness's delayed report) |
| `back` | Someone who was away comes back |

Moving time means taking events off the queue in order and handling them, until the target time. Inputs from the game land between events, at the time they're made.

## Moving time

```js
world.tick(1 / 60);              // a frame: seconds × minutesPerSecond × speed
world.advance(8 * 60);           // eight hours at once (sleeping), no frame budget
world.advanceTo(myClockMinutes); // to a time: forward, or back if it's in the past
world.seek(world.now - 120);     // to any time Esper remembers, back or forward
world.rewind(30);                // back thirty minutes
```

| Call | What it does |
|---|---|
| `tick(seconds)` | Moves on by `seconds × config.minutesPerSecond × speed` game minutes. Forward runs with the frame budget; a negative speed plays history backward. Refreshes bodies either way |
| `advance(minutes)` | `advanceTo(now + minutes)` |
| `advanceTo(t)` | Runs every event up to `t`, with no frame budget. If `t` is in the past, seeks back |
| `seek(t)` | Back: restores and replays (Esper). Forward: `advanceTo(t)`. Back is clamped to the earliest time remembered |
| `rewind(minutes)` | `seek(now - minutes)` |

Use `tick` when Tyrell owns the clock and `advanceTo` when the game does. See [Integration: who owns the clock](integration.md#who-owns-the-clock).

Called from an event listener (a timer that ends the day, say), any of these waits until the call that's running returns, then runs: the engine never moves time or swaps its state in the middle of an event. See [rule 11](#rules-for-a-rewind-safe-game).

## Speed and the frame budget

`world.speed` scales `tick`: 1 is normal, 4 four times as fast, 0 paused, and a negative speed plays history backward. `config.minutesPerSecond` (default 1) says how many game minutes a real second is at speed 1.

```js
world.config.minutesPerSecond = 2;   // a game day is 12 real minutes
world.speed = 10;                    // fast-forward
world.speed = 0;                     // pause
world.speed = -30;                   // play backward: 60 game minutes per real second
```

Playing backward stops at the start of what Esper remembers: the speed is set to 0 and an `esper:start` event (`{ t }`) is emitted.

**The frame budget.** A forward `tick` stops early when the simulation has taken more than `config.budgetMs` (4 ms) of real time. It always finishes the timestamp it's on, so the state is whole, and it leaves the clock there. The minutes it didn't get to are not carried over: under load, game time runs slower rather than the frame stuttering. `advance`, `advanceTo` and `seek` have no budget. The budget reads the real clock, but it only changes how far a frame gets, never what happens, so worlds stay deterministic.

## Timers

```js
world.at(world.now + 6 * 60, 'rain-stops', { street: 'main' });
world.on('timer:rain-stops', (e) => world.fact('raining', false));
world.on('timer', (e) => console.log(e.name, e.data, e.t));
```

`world.at(t, name, data)` is an input. At time `t` the engine logs it and emits `timer` and `timer:<name>`, both with `{ name, data, t }`. Timers are in the state's queue, so they save and rewind: after a rewind, a timer fires again as time moves forward, and listeners hear it again. `data` holds plain JSON values.

## Away and back, following

```js
world.away('ruth', world.now + 2 * 1440, 'visiting her sister', 'station');
world.on('back', (e) => toast(`${world.get(e.id).name} is back from ${e.summary}`));
world.follow('pip', 'mara');    // Pip goes where Mara goes
world.follow('pip', null);      // and stops following
world.remove('tomas', 'moved away');
```

**Away.** `world.away(id, until, summary, place?)` sends someone out of the simulation until a time: what they were doing stops, their slot is let go, their plan is dropped, and they have no body and aren't listed by `world.people()` (their `status` is `'away'`). At `until` they come back to `place` (default their home) with every need capped at 0.4, a `back` log entry and event (`{ id, summary }`), and they think at once. Use it for trips, hospital stays, a night in the cells.

**Following.** With `world.follow(id, leader)`, whenever the leader starts a walk or an action, the follower stops what they're doing (unless it outranks the leader's) and does the same, ending at the same time, taking the same slot if it's free. Their doing has layer `'follow'`. Following only reacts to the leader starting things: a follower doesn't seek the leader out.

**Gone.** `world.remove(id, why)` takes someone out for good (`status: 'gone'`): their slot is let go, followers stop following them, modules hear about it, and a `gone` event (`{ id, why }`) is emitted. With Cradle, use `cradle.depart` instead to get grief and inheritance too.

## How Esper works

The world is deterministic: the same state and the same inputs give the same future. So Esper keeps two things:

- **snapshots** of the whole state, as JSON strings, at regular marks (every 15 game minutes by default, thinner further back), and
- **every input** from outside, with the time it came and, for inputs made inside a listener, the event it came after.

Going back means restoring the last snapshot before the target and replaying the events and recorded inputs up to it, silently (no events reach the game while it replays). Going forward again replays the recorded inputs at their times, so scrubbing back and forth shows the same history. A new input in the past starts a new timeline.

The first snapshot, the earliest point you can go back to, is taken the first time the world advances. Everything declared and added before that is in it.

## Seeking, rewinding and playing backward

A backward seek, from `world.seek`, `world.rewind`, `world.advanceTo` with a past time, or a `tick` at negative speed, does this, in order:

1. restores the snapshot and replays up to the target, silently;
2. emits `seek` with `{ from, to }`;
3. emits `disembody` for everyone who was near and isn't at the new time, `step` for everyone near at both times whose doing differs (another action, place, slot, or start and end), and `embody` for everyone near only at the new time.

Bodies that stay in view are never taken back and handed out again. Palantír's decision history is cleared (it isn't part of the state). Moving forward again afterward is ordinary running: `step`, `arrive`, timers and the rest are emitted again.

Playing backward with a negative speed is a small backward seek every frame, so each frame emits `seek`, and a `step` for each person in view whose doing changed in that stretch. A game that draws from `embody`, `step` and `disembody` (and places walkers by `world.now`) shows reverse playback without doing anything special.

Seeking is fast (a few milliseconds for Rocinante), because only the minutes after the nearest snapshot are replayed.

## Branching and echoes

After a rewind, the inputs that came later are still recorded: the world's "future". As time runs forward, they replay at their times. Two things can happen when the game makes an input in the past:

- **An echo.** If the input is exactly the one the recorded future holds next (the same name and arguments, at the same time, at the same point), it's treated as that input, not a new one. A game that reacts to replayed events the same way it did before (a listener that sets a fact on a timer) doesn't disturb the timeline.
- **A branch.** Anything else starts a new timeline: the recorded future (inputs and later snapshots) is dropped, and a `branch` event (`{ t, dropped }`) is emitted, with the number of inputs dropped.

Branching is what makes a rewind meaningful for the player: rewind, act differently, and the old future is gone. If the game needs the old future gone without the player doing anything (the start of a time loop), make any input right after seeking, for instance `world.keep('loop', n)`.

## Marks

```js
world.esper.mark('before the heist');
// ...later
if (!world.esper.seekMark('before the heist')) console.log('too long ago');
```

`mark(name)` names the present moment. `seekMark(name)` goes there (back or forward) and returns `false` if Esper has forgotten it (it's older than the earliest snapshot). Marks belong to Esper, not to the world's state: they're saved only with history (`world.save(true)`), and loading a save without history doesn't clear them.

## The game's own state: keep() and the seek event

Tyrell rewinds only its own state. The player's position, their inventory, a door the game opened: those are the game's, and the game must rewind them too. Two ways:

**Keep it with the world.** Small pieces of game state can live in the world's state, where they rewind and save with everything else:

```js
world.keep('door:vault', 'open');
world.kept('door:vault');            // 'open', and after a rewind, whatever it was then
```

`keep(key, value)` is an input (the value is copied as JSON). Conditions can read it (`game:door:vault==open`) and effects can set it (`game:door:vault=shut`). Because each `keep` is recorded, don't call it every frame: keep things that change now and then.

**Restore it on seek.** For state that changes every frame (the player's position), keep your own history keyed by `world.now`, and restore it when Esper seeks:

```js
const trail = [];   // [t, player state]
function remember() { trail.push([world.now, { x: player.x, level: player.level }]); }
world.on('seek', ({ to }) => {
  let best = null;
  for (const [t, s] of trail) if (t <= to) best = s;
  if (best) Object.assign(player, best);
  while (trail.length && trail[trail.length - 1][0] > to) trail.pop();
});
```

Don't make inputs in a `seek`, `embody` or `disembody` listener unless you mean to branch: after a rewind, any input that isn't an echo starts a new timeline.

## EsperConfig and memory

Pass these in `Tyrell.create({ esper: { ... } })`:

| Field | Default | Meaning |
|---|---|---|
| `on` | true | Record history. Off, nothing is recorded and the world can't go back (forward seeks still work) |
| `every` | 15 | A snapshot every this many game minutes |
| `keep` | 1440 | Keep this many minutes of history (one day) |
| `sparseAfter` | 240 | Snapshots older than this many minutes are thinned... |
| `sparseEvery` | 60 | ...to one per this many minutes (at whole multiples of it) |

Make `sparseEvery` a multiple of `every`, or the thinned region keeps fewer snapshots than you expect (only those at times divisible by `sparseEvery` survive). With the defaults that's about `240 / 15 + (1440 - 240) / 60 + 1 = 37` snapshots.

Each snapshot is the whole state as a string, so memory is roughly snapshots × state size. The state grows with people, with the log (`config.logSize` entries, 1000 by default, kept in every snapshot) and with what the modules remember. For Rocinante (ten people), a snapshot is about 70 KB after a day and about 150 KB after a week, so the defaults hold about 2.5 to 5.5 MB. Lowering `logSize` to 200 roughly halves it. Check yours with:

```js
world.esper.size();   // { snapshots, inputs, bytes }
world.esper.span();   // [earliest, latest]
```

Inputs older than the oldest snapshot are dropped (they can never be replayed). Turn Esper off (`esper: { on: false }`) for headless batch runs, or if the game never goes back.

## Saving with history

`world.save(true)` includes Esper's snapshots, recorded inputs and marks, so the loaded world can still rewind. That can be megabytes (Rocinante after a week: about 7 MB with history, 150 KB without), too big for `localStorage` in most browsers. Save without history unless the game needs to rewind past a load. See [Saving](saving.md).

## Rules for a rewind-safe game

Esper replays the inputs it recorded. Anything that changed the world without an input, or that reads something the replay can't see, makes the replayed world differ from the one the player saw. Follow these rules:

1. **Change Tyrell only through inputs.** Use the public API (`world.fact`, `world.sense`, `world.did`, `world.report`, `world.direct`, `world.keep`, and the modules' public mutators like `reverie.feel`, `fellowship.adjust`, `ceres.pay`). Never write to `world.s`, a `PersonState` or a module's state, and don't call the engine-side methods (`world.mind.setLevel`, `world.lang.apply`, and the modules' `apply...` methods: `reverie.applyFeel`, `reverie.applyNote`, `fellowship.applyRegard`, `cityspeak.applyResolve`, `ceres.applyPay`, `gaff.applyDraw`...) from game code. If you need a change there's no input for, define one (see [Integration: custom inputs](integration.md#custom-inputs)).
2. **Push facts; don't answer live.** `shell.check` answers `fact:` conditions from the game's live state, which a replay can't rewind. Prefer `world.fact(key, value)` whenever the game's state changes.
3. **Keep the shell pure.** `shell.travel` and `shell.near` may read Tyrell's state (facts, kept values), not game state that doesn't rewind.
4. **Calls from listeners are deferred.** An input made inside an event listener waits until the engine finishes the event it's handling (or the input it's applying), and is recorded to replay at exactly that point. Only `world.person`, `strangers.promote`, `reverie.recall`, `cityspeak.say`, `cityspeak.resolve`, `gaff.draw` and `cradle.birth` apply at once (they return a value). The return value of `world.input` is `undefined` for a deferred call.
5. **Storylets run inside `world.internally`.** A storylet's `fire` is game code the engine runs. Its inputs are applied but not recorded, because a replay runs `fire` again. So `fire` must be deterministic: no `Math.random`, no reading game state that doesn't rewind. Use `w.worldStream(name)` for randomness.
6. **The game rewinds its own state.** Use `keep()` or the `seek` event, as above.
7. **Don't branch by accident.** Don't make inputs in `seek`, `embody` or `disembody` listeners, and don't make inputs every frame regardless of what changed (`world.fact` with an unchanged value is fine: it's skipped).
8. **Definitions and config are constant.** They aren't in the history. Changing an action, a need's rise or a decision setting mid-run makes the replay differ.
9. **Looking changes nothing.** `world.whyNot`, `world.describe`, `cityspeak.choose`, barks and Joi evaluate conditions without advancing anyone's stream: a `chance:` there draws from a stream that changes nothing. When the game tests conditions itself only to look, wrap it in `world.peek(() => ...)` for the same.
10. **Focus isn't state.** It's never recorded, so nothing that changes the world reads it: Gaff's `unseen` storylets choose a place nobody is at from the state alone. A choice that depends on what's on screen is the game's to make and record, as an input (`gaff.trigger(id, gaff.unseenPlace(tag))`).
11. **Moving time from a listener waits.** `tick`, `advance`, `advanceTo`, `seek`, `rewind`, `esper.seekMark` and `load` called while the engine is busy (from an event listener, a storylet's `fire`, an effect or a custom input handler) don't run there, where they'd swap the state out from under the events being run: they wait until the call that's running returns (the `tick`, `advance` or input that led to the listener), then run in the order they were made. They return nothing meanwhile; `seekMark` still returns whether the mark is remembered.

Voight-Kampff's `esper` check (on by default) rewinds six hours and runs forward again, failing if the world differs: run it in CI.

## Building with time walk

### A rewind gadget

Hold a button to rewind; let go to carry on from there, with the old future gone.

```js
let rewinding = false;
function frame(dt) {
  if (!rewinding) remember();               // the player's trail, as above
  world.tick(dt);
}
function holdRewind() { rewinding = true; world.speed = -15; }
function releaseRewind() {
  rewinding = false;
  world.speed = 1;
  world.keep('rewound-at', world.now);      // a new input: the old future is dropped here
}
world.on('esper:start', () => showMessage("Can't go back any further."));
```

Without the `keep` on release, whatever the player did after this point would happen again as time ran forward (their recorded inputs replay), until they did something different.

### Fast-forward while sleeping

```js
function sleepUntilMorning() {
  const target = (world.day + (world.hour >= 7 ? 1 : 0)) * 1440 + 7 * 60;
  world.advanceTo(target);    // synchronous: a night for Rocinante takes tens of milliseconds
}
```

`advanceTo` runs every event with no frame budget and emits everything on the way (`step`, `arrive`, `log`...). For a visible fast-forward instead, raise `world.speed` for a few seconds; the frame budget keeps frames smooth.

### A time-loop game

The same day, again and again; the player remembers, the town doesn't. Two ways:

**Save at dawn, load at dusk.** Simple and cheap: no history needed.

```js
let dawn = world.save();                 // at the start of the loop
function endOfLoop() {
  world.load(dawn);                      // the town is back at dawn
  // the player's knowledge lives in the game, outside Tyrell: keep it
}
```

The town replays the same day exactly, unless the player changes something.

**A mark and a branch.** Uses Esper, so `keep` must cover the loop (the default is one day: raise it for a full 24-hour loop).

```js
world.esper.mark('dawn');
function endOfLoop(loop) {
  world.esper.seekMark('dawn');
  world.keep('loop', loop + 1);          // branch: last loop's player inputs won't replay
}
```

### A replay viewer

Esper can show any moment it remembers. A scrubber that leaves the present untouched:

```js
const present = world.now;
world.esper.mark('present');
function scrubTo(t) {
  world.seek(t);                          // bodies are refreshed; draw world.bodies()
}
function closeViewer() {
  world.esper.seekMark('present');        // back to now, exactly as it was
}
```

As long as the viewer makes no inputs, seeking back and forth changes nothing: the world's hash at `present` is the same afterward. For a replay longer than a day, raise Esper's `keep` option (and use sparse snapshots to bound memory), or save with history and load it in the viewer. `world.westmarch.chronicle(id, since)` gives a readable account to show alongside.
