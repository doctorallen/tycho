# Getting started

This page gets Tyrell into a game, builds a first small world, and wires the frame loop and bodies. It assumes a browser game written in plain JavaScript; Node works the same way.

- [Add Tyrell to the game](#add-tyrell-to-the-game)
- [Load it](#load-it)
- [A first world](#a-first-world)
- [The frame loop](#the-frame-loop)
- [Focus and bodies](#focus-and-bodies)
- [Next steps](#next-steps)

## Add Tyrell to the game

Tyrell is pulled into a game as a git submodule. The built files in `dist/` are committed, so the game needs no build step and nothing installed.

```sh
git submodule add https://github.com/doctorallen/tyrell vendor/tyrell
git commit -m "Add Tyrell"
```

Anyone cloning the game then needs the submodule too:

```sh
git clone --recurse-submodules <your game>
# or, in an existing clone
git submodule update --init
```

**CI.** If the game deploys from CI, the checkout must fetch submodules. With GitHub Actions:

```yaml
- uses: actions/checkout@v4
  with:
    submodules: true
```

**Service worker.** A game that caches its files for offline play must cache Tyrell too. Add it to the worker's file list:

```js
const FILES = [
  './',
  'index.html',
  'vendor/tyrell/dist/tyrell.js',
  'js/main.js',
  // ...
];
```

If the game has a check that every `<script>` tag is in the worker's list, Tyrell's tag counts like any other.

**Updating.** Each game pins the engine version it was tested with. To move to a newer Tyrell, pull it and commit the new pointer:

```sh
git -C vendor/tyrell pull
git add vendor/tyrell
git commit -m "Update Tyrell"
```

## Load it

In the browser, one script tag defines one global, `Tyrell`. Load it before the game's own scripts:

```html
<script src="vendor/tyrell/dist/tyrell.js"></script>
<script src="js/main.js"></script>
```

For editor hints in plain JavaScript, reference the global's types at the top of a file:

```js
/// <reference path="../vendor/tyrell/dist/tyrell.global.d.ts" />
```

In Node or with a bundler, use the module builds (types are in `dist/tyrell.d.ts`):

```js
const Tyrell = require('./vendor/tyrell/dist/tyrell.cjs');
// or: import * as Tyrell from './vendor/tyrell/dist/tyrell.mjs';
```

## A first world

A town with one person, a flat, a cafe and a park. Save this as `first.js` and run it with `node first.js` (in the browser, drop the `require` line).

```js
const Tyrell = require('./vendor/tyrell/dist/tyrell.cjs');
const HOUR = 60;

const world = Tyrell.create({ seed: 'first-town', start: 7 * HOUR });

// needs: 0 is fine, 1 is desperate; rise is per game hour
world.need({ id: 'hunger', rise: 0.06, start: 0.4 });
world.need({ id: 'energy', rise: 0.04 });
world.need({ id: 'fun', rise: 0.05, urgent: 1.1 });   // never breaks a routine

// places, and the walks between them (minutes)
world.place({ id: 'flat', tags: ['home'], region: 'town', slots: { bed: 1 } });
world.place({ id: 'cafe', tags: ['food'], region: 'town', hours: [7, 22], slots: { seat: 4 } });
world.place({ id: 'park', region: 'town' });
world.link('flat', 'cafe', 10);
world.link('cafe', 'park', 5);

// what people can do
world.action({ id: 'eat', label: 'eating', at: 'tag:food', slot: 'seat', minutes: 30, relieves: { hunger: 0.6 }, pose: 'sit' });
const night = { name: 'night', input: 'hour', range: [0, 24], curve: [[0, 1], [6 / 24, 1], [8 / 24, 0.05], [20 / 24, 0.05], [22 / 24, 0.5], [23 / 24, 1], [1, 1]] };
world.action({ id: 'sleep', label: 'sleeping', at: 'home', slot: 'bed', minutes: 480, relieves: { energy: 0.95 }, pose: 'sleep', tags: ['sleep'], considerations: [night] });
world.action({ id: 'read', label: 'reading', at: 'home', minutes: 60, relieves: { fun: 0.1 }, base: 0.04, pose: 'sit' });
world.action({ id: 'stroll', label: 'a stroll', at: 'park', minutes: 40, relieves: { fun: 0.4 }, pose: 'walk' });

// a person: free time from 8, bed at 23
world.person('ana', { name: 'Ana', home: 'flat', routine: [[8, null, '*'], [23, 'home', 'sleep']] });

world.advance(16 * HOUR);
for (const line of world.westmarch.chronicle('ana', 0)) console.log(line);
console.log(world.describe('ana'));
```

It prints Ana's day, something like this:

```
07:00 sleeping at flat
08:00 set out for cafe
08:09 got to cafe
08:09 eating at cafe
08:39 set out for flat
08:50 got to flat
08:50 reading at flat
...
21:30 sleeping at flat
```

and an account of her: her needs, her mood, what she's doing and why. Some things to notice:

- Until 8:00 the routine's last entry (`sleep` from 23:00) is still in force, so she starts the day asleep.
- From 8:00 it's free time (`'*'` with no place), so her needs decide. Hunger sends her to the cafe; the walk takes the ten minutes the link says.
- Reading at home is a weak but steady choice; sleeping in the afternoon is held down by the `night` consideration.
- Change the seed and the day changes in its details, not its shape. Run it again with the same seed and it's the same day, minute for minute.

Try `world.why('ana')` and `world.whyNot('ana', 'stroll')` to see how the choices were weighed.

## The frame loop

In a game, time moves every frame. If Tyrell owns the clock, call `world.tick` with the frame's real seconds:

```js
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);   // cap long pauses (a background tab)
  last = now;
  world.tick(dt);                                    // dt × minutesPerSecond × speed game minutes
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

`config.minutesPerSecond` (default 1: a game day is 24 real minutes) and `world.speed` (0 pauses, 4 is four times as fast, negative plays backward) set the pace. Each `tick` spends at most `config.budgetMs` (4 ms) simulating; on a heavy frame, game time runs a little slow rather than the frame stuttering.

If the game owns its clock (its own day length, sleeping that jumps the clock), call `world.advanceTo` with the game's time in minutes instead:

```js
function frame() {
  game.step(1 / 60);                                   // the game's own clock moves
  world.advanceTo((game.day * 24 + game.hour) * 60);   // Tyrell keeps up
  draw();
}
```

`advanceTo` has no frame budget. A time in the past rewinds the world with Esper. See [Integration: who owns the clock](integration.md#who-owns-the-clock).

## Focus and bodies

Tyrell runs everyone, everywhere. The game draws only the people it's showing. Say which regions are loaded, and Tyrell hands over **bodies** for the people in them:

```js
world.focus(['town']);

const sprites = new Map();
world.on('embody', (body) => sprites.set(body.id, { body }));     // came into view
world.on('step', (body) => { const s = sprites.get(body.id); if (s) s.body = body; });   // started something
world.on('disembody', ({ id }) => sprites.delete(id));            // left view

function draw() {
  for (const [id, s] of sprites) {
    if (world.now >= s.body.end) s.body = world.body(id) ?? s.body;   // waiting doesn't announce itself
    const b = s.body;
    if (b.travel) {
      const f = Math.min(1, Math.max(0, (world.now - b.travel.start) / (b.travel.end - b.travel.start)));
      drawWalker(id, b.travel.from, b.travel.to, f);   // between two places, f of the way
    } else {
      drawPerson(id, b.place, b.slot, b.pose);          // at a place, in a slot, sitting or working
    }
  }
}
```

A body carries what the game needs to draw: the place and slot, the pose (`'sit'`, `'walk'`, `'sleep'`), how far through the action or walk they are, and with Reverie their emotion and mood. When the player walks into another region, call `world.focus` again: people there are embodied mid-whatever, and the ones left behind are disembodied and carry on off screen with the same timetable.

The game never moves people on its own initiative. If a body can't do what it was asked (a locked door, a blocked path), report it: `world.report(id, 'failed', 'locked')`.

## Next steps

- [Concepts](concepts.md): the model, end to end.
- [Integration](integration.md): the shell, bodies in depth, sensing, saving, and notes for side-scrollers and top-down games.
- [Deciding](deciding.md): needs, actions, routines, jobs, and how options are weighed.
- [Recipes](recipes.md): worked examples to copy from.
- `examples/rocinante.js`: a sample town of ten people that uses everything.
