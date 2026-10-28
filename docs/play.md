# Play

The parts a game is played through: the controls, what the player carries, and the tutorial. More (interact, craft, trade, build, mine) move in later in phase 6. Each works on the game's own plain objects or is configured by it, so what a game calls things, what they look like and what they say stay the game's.

## Tycho.input

### Controls

A stick wherever the thumb lands in its zone, buttons on the screen and keys, each holding an action; presses that wait until the game takes them (so a pause doesn't eat them); presses and releases since the game last looked; the axes; a test's bot over all of it; and letting go of everything when a screen opens.

```js
const C = new Tycho.input.Controls({
  keys: { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', Space: 'jump', KeyE: 'use', ShiftLeft: 'slow' },
  axes: { left: 'left', right: 'right', up: 'up', down: 'down', round: true, slow: { action: 'slow', x: 0.4 } },
  presses: ['jump', 'use'],          // a press waits until take()n
  edges: ['main'],                    // pressed and released since edges() last looked
  stick: { radius: 44, dead: 6, inside: true, flick: { action: 'dash', ms: 90, px: 26 }, onChange: drawStick },
  bot: { x: 'x', y: 'y', held: { act: 'actHeld' }, press: { act: 'act' } },
  blocked: () => !!Game.modal,        // nothing new is pressed while a screen is up
  guard: 0.4, clock: () => Game.realT,
});
C.listen({ stick: $('deck'), buttons: { use: $('bUse') }, taps: { dash: $('bDash') }, heldClass: 'held', prevent: ['Space'], preventUp: true, onTouch });

// each step, before the game reads them
C.update();
C.move.x; C.move.y;        // -1..1: the bot's, else the stick's while a thumb is on it, else the keys'
C.held('use');             // held by a button, a key or the bot
C.take('jump');            // the press waiting (true, or a flick's direction), cleared; false if none
C.edges('main');           // { down, pressed, released }, reading clears the edges
C.block();                 // a screen opened: every thumb and key lets go, presses and edges dropped
C.guard(); C.guarded();    // taps don't count for `guard` seconds after
```

- **The stick.** `radius` is full tilt, in CSS px. A round dead zone (`dead`, px; past the radius the tilt is one, its direction kept), or a dead zone on each axis (`deadAxes: [0.2, 0.45]`, shares of the radius, with the thumb's offset held to a square). `inside` keeps the base the radius in from the zone's edges; `retake` lets a second thumb take the stick over (otherwise the first keeps it). A `flick` presses its action with the flick's direction when the thumb moves more than `px` within `ms` of landing. `onChange(stick)` is called to draw it (`stick` is `{ id, bx, by, x, y, x0, y0, t0, flicked }`, or null).
- **Keys.** Each code holds its action while down; a repeat does nothing. The keys' axes are -1, 0 or 1, times `scale`'s factors (none: 1), by `slow`'s factors while its action is held and by `fast`'s while its is (held to -1..1), then scaled to length one with `round`. The White Dragon's keys run at 0.66 (`scale`), walk with C held (`slow`) and sprint with Shift held (`fast`), the stick's three paces. `listen` stops the default for `prevent` (every mapped code by default) as a key goes down, unless blocked, and as it comes up too with `preventUp`. A game's own keys (pause, a map) are its own listener.
- **Buttons.** `buttons` hold an action while a pointer is down on them (the last pointer down holds it; it's let go when that one lifts) and wear `heldClass`; `taps` only press. Either presses its action if it's in `presses`.
- **The bot.** `C.bot = { ... }` drives everything from a test: the axes from its `x` and `y` fields (named by `o.bot`), each action held by its own field (or the one `o.bot.held` names), and the presses named in `o.bot.press` taken from it (cleared there as they're taken); other presses are the real ones even while a bot drives.
- **Without a page.** `keyDown(code, repeat)`, `keyUp`, `keysOff`, `stickDown(id, x, y, zoneBox)`, `stickMove`, `stickUp`, `buttonDown(action, id)`, `buttonUp` and `press(action, value)` are what `listen` calls; a test can call them too.

The White Dragon's controls are a stick (`deadAxes`, `retake`), Use and Jump with presses taken once a step; Lodestar's a stick kept inside the deck with a flick to dash, a button each hand with its edges, act and dash presses, blocked while a screen is up, and the tap guard. Each keeps an `Input` with its old names over its `Controls`. Merryfolk's camera keys are a `Controls` with keys and axes only, fed the keys' names (`e.key`, lowercased) by its own listener rather than `listen`'s codes. `test/play.test.mjs` drives each game's old controls and its new ones side by side with the same events and holds them to the same readings; the cases where a game's old code disagreed with itself (two keys for one action, two fingers on one button, keys and thumbs at once) are listed there.

### Gestures

Drag, pinch and tap for a map view, in whatever units the game feeds (the thresholds are in the same).

```js
const G = new Tycho.input.Gestures({
  onPan: (dx, dy) => { ... },                       // one pointer dragged
  onPinch: (k, x, y, dx, dy) => { ... },            // two: the zoom about their middle (null under pinchMin), and the middle's move
  onTap: (x, y) => { ... },
  travel: 6,                                        // a tap: moved less than this all told since one landed
  near: 10, ms: 400,                                // or a lone pointer lifted within `near` of where it landed, within `ms`
  pinchPan: true, pinchMin: 8,
});
const stop = G.listen(canvas, (e) => [e.clientX, e.clientY], { prevent: true });
```

A third pointer does nothing until there are two again; a cancelled pointer is never a tap. The wheel's zoom is the game's own.

## Tycho.items

Functions over the game's plain objects and arrays, so they stay in its save as they are.

| Name | What it does |
|---|---|
| `bag.count(b, kind)`, `bag.total(b, kinds?)` | A bag is counts by kind, `{ wire: 3 }` |
| `bag.add(b, kind, n)` | Returns how many went in (none for n <= 0) |
| `bag.take(b, kind, n)`, `bag.has(b, cost)`, `bag.pay(b, cost)` | All or nothing |
| `bag.empty(b, kinds?)`, `bag.move(from, to, kinds?)` | Every count to 0 (each kind given set, there or not), or into another bag; each returns `[kind, n]` for what there was |
| `bag.worth(b, value, kinds?)` | `value(kind, n)` summed, in the kinds' order |
| `things.nextId(holder, key, from = 0)` | One more than the last id given from `holder[key]` (or than `from`) |
| `things.make(id, ...attrs)` | A thing of its own: its id first, then its attributes |
| `things.pull(list, id)`, `things.where(list, attrs or test)` | Take one out by id; the ones alike |
| `slots.make(n)`, `slots.put(S, kind, n, stack)`, `slots.take`, `slots.count`, `slots.free` | An inventory by slot, `{ k, n }` or null each: putting tops up stacks before using empty slots and returns what didn't fit |
| `gear.make(names)`, `gear.equip(g, slot, thing, fits?)`, `gear.unequip`, `gear.worn` | Equipment: named slots of one thing each; `equip` returns what came off (or undefined if it doesn't go there) |
| `group(list, levels)` | A counted view: groups at the first level, each `{ key, n, items, groups }` with the next level among its things |

A level of `group` is `{ by, order }`: `by` an attribute's name or a function; `order` the values in order (others go in no group), a compare function, or by default the values there are, sorted as text. The White Dragon's shelf is `group(parts, [{ by: 'k', order: KINDS }, { by: 'g', order: grades }, { by: (p) => p.gauge || '' }, { by: 'st', order: states }])`: a card a kind, a row a grade and gauge, a chip a state. Its pockets (`Game.s.pack`) are a bag, and so are Lodestar's motes carried (`d.motes`, banked with `bag.move`) and Merryfolk's wizard's pack (`Game.wizPack`, filled again each morning).

Neither game has an inventory by slot or equipment yet (the White Dragon has no gear; Lodestar's `equip` is one rig that never changes), so `slots` and `gear` are here for the next game that does, held by their own tests.

## Tycho.guide

A tutorial as steps, each done when the game says so.

```js
const guide = new Tycho.guide.Guide({ steps: TUT, state: () => Game.s.tut });
Game.s.tut = Tycho.guide.fresh();   // a new game's: { i: 0 }; a save without one never sees it
guide.active();                     // started, not skipped, not past the end
guide.step;                         // the step it's on
guide.tick();                       // every frame: past whatever is done, several if ahead; the steps passed
guide.read('text');                 // a field that may be a function
guide.place();                      // { ch, at, of }: which step of its chapter
guide.skip(); guide.finish();       // skipped for good; read to the end
```

A step is `{ done: () => bool, end?, ch?, ...anything }`: `done` is asked every frame while it's current, and a step marked `end` waits for `finish()`. Where it stands (`{ i, off }`) is a plain object in the game's save, read through `state()` each time, since loading a save replaces it. The White Dragon's tutorial (`tutorial.js`) is its steps, card, marks and pulsing over a guide.
