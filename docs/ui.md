# Tycho.ui

The interface kit: the HUD's and the screens' machinery, without their looks. Toasts, lines rising over a point in the world, buttons wired by their data attributes, and a screen's buttons run from one handler. What's made is plain elements with the classes a game gives, so its skin (the CSS, the fonts, the words) stays its own. Blocking taps just after a screen opens is the controls' guard ([play.md](play.md), `Tycho.input`); `Acts` takes it as its `guard`.

## Toasts

A line or two of news over the game, gone after a while, and hints that wait their turn.

```js
// the White Dragon's: a short list on the game's clock, redrawn whole on each change
const toaster = new Tycho.ui.Toasts({
  box: () => $('toasts'), redraw: true, html: true, most: 2, life: 4.2, fadeAt: 3.6, merge: 2.5,
  clock: () => Game.t, cls: (kind) => 'toast ' + kind,
});
// Lodestar's: each an element on its own timer, hints queued while a screen is open
const toasts = new Tycho.ui.Toasts({
  box: () => $('toasts'), most: () => T.ui.toasts, replace: true, animate: true, once: true,
  cls: (kind) => 'toast' + (kind ? ' r-' + kind : ''),
  life: (msg, kind) => clamp(msg.length * (kind === 'tip' ? 0.05 : 0.035), kind === 'tip' ? 2.6 : 1.8, 4.5),
  waits: (kind) => kind === 'tip', held: () => !!Game.modal,
});
toasts.show('Your light is fading', 'legendary');   // now, or (a kind that waits) queued
toasts.tick();                                       // every frame
toasts.clear(0.8);                                   // a screen opens: news goes, a hint shown under 0.8 s ago comes back after
toasts.forget();                                     // a new world: its hints again
```

| Option | |
|---|---|
| `box()` | Where they go |
| `most` | At most this many on screen (a number, or a function read each time); the oldest goes for a new one |
| `life` | Seconds on screen (a number, or by the words and kind) |
| `cls(kind)`, `html` | Each one's class, and whether the words are HTML |
| `redraw` | The whole list redrawn on each change and timed by `tick()` on `clock` (seconds); `fadeAt` seconds old it's faded (opacity 0, the CSS easing it); the same words as the last within `merge` seconds keep the last one longer instead of adding another |
| without `redraw` | Each toast an element on its own timer (`data-born` its birth); `replace`: the same words already on screen give way to the new; `animate`: its life set as its `animation-duration`, for the CSS to fade it |
| `waits(kind)`, `held()`, `once` | Kinds that wait for room on screen, not while `held()`; with `once`, never shown twice until `forget()` |
| `after()` | After each is shown |

`show(text, kind)` shows or queues, `put(text, kind)` shows whatever its kind, `pump()` shows those waiting while there's room, `draw()` redraws a list, and `list`, `queue` and `seen` are how it stands.

## Rising lines

What came out of something, a line each over where it came from, the first on top, rising and fading (the White Dragon's salvage over a machine):

```js
const rising = new Tycho.ui.Rising({ clock: () => Game.t, line: (g) => `<b>+${g.n}</b> ${g.name}` });
rising.add(machine.x, machine.y, [{ n: 1, name: 'coil' }, { n: 12, name: 'cr', kind: 'cr' }]);
// every frame: the HTML for the box over the view, at the screen's px for a world point
gains.innerHTML = rising.html((x, y) => [(x - View.cx) * sc, (y - View.cy) * sc]);
```

Each line is a `div` of class `cls` (`gain`) and its `kind`, placed with `left`, `top` and `opacity`, moving as the pixels' rising words do (`Tycho.fx.rise`, [pixels.md](pixels.md)); `Rising` keeps the list and makes the HTML. It lasts `life` (2.4 s), fades from `fadeAt` (1.8) over `fadeFor` (0.6), rises `rise` px a second (12), sits `gap` px under the one before (21), comes `stagger` s after it (0.12), and starts `left` px left of the point (34).

## Buttons

```js
// each button with data-<key>: onclick runs the handler with its value and the button
Tycho.ui.bind(panelBody, {
  buypart: (i) => buy(+i),
  'job:not([data-say])': (code) => Jobs.act(code),   // more of a selector after the name
  say: (i) => Talk.answer(+i),
});

// a screen's buttons, from one handler: data-act names the act, data-arg its argument
const acts = new Tycho.ui.Acts({
  acts: () => UI.acts,                      // or the object itself
  guard: () => Input.guarded(),             // taps ignored just after a screen opens
  armed: () => Input.guard(0.25),           // a confirming button armed by its first tap
  onAct: () => snd('tap'),
});
acts.listen(screenElement);
```

`bind` wires its keys in order, so a later key takes a button that has both. `Acts` ignores a disabled button and anything while the guard is up; a button with `data-confirm` asks once: the first tap arms it (its words become `data-confirm`'s, the class `armed`, any other armed button back to its own words), the second runs it.

`test/ui.test.mjs` plays the White Dragon's toasts and rising lines and Lodestar's toasts and hints, as they were, beside Tycho's through the same steps on a stand-in for the DOM with its own clock and timers, and what's on screen must be the same after every one; the same for the White Dragon's `panelBind` and Lodestar's `UI.onTap`.
