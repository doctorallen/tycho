# Tycho.dev

The dev tools, for the people making a game; players never see them. Testing switches kept in their own storage key (never in the save), flags read from the address, a log any game can write to, and the dev drawer: a small, dense, dark console docked at the side while the game runs on behind it and stays in sight. The drawer was Merryfolk's (its ` key, its tabs, its overlays row and frame line, its events), made for any game; the White Dragon's dev tools are on it.

- [The address and the flags](#the-address-and-the-flags)
- [Notes](#notes)
- [The drawer](#the-drawer)
- [Its tabs](#its-tabs)
- [The pieces](#the-pieces)
- [Settings that change play](#settings-that-change-play)
- [Overlays](#overlays)
- [The events](#the-events)
- [A mind in the drawer](#a-mind-in-the-drawer)
- [Its look](#its-look)
- [Merryfolk's drawer, on these options](#merryfolks-drawer-on-these-options)

## The address and the flags

`query(name)` says whether `?name` is in the address (`?nogl`, `?perf`). `new Flags(key, defaults).load()` keeps testing switches in their own storage key: `s` holds them, `save()` keeps them, `shown()` is true with `?dev` in the address or once it has been. The drawer keeps its own state in the same flags (`flags.s.drawer`: open or not, the tab, the overlays, the events' filter and find box).

## Notes

What happened under the hood, for the events. Any game can write to one, with a drawer or without (Lodestar's log for the events by impact will be one):

```js
const notes = new Tycho.dev.Notes({ most: 600, clock: () => Game.time });
notes.note('rift', 'a rift opened by the mill');  // newest first in notes.list, the last `most` kept
notes.paused = true;                                // nothing's noted
notes.rewind(t);                                    // what's later than t goes (the clock went back)
notes.clear();
```

An event is `{ t, kind, text }`, with `who`, `place`, `impact` (0 to 1) and `data` if the game has them; `count` rises with every note, for knowing when there's something new. A drawer has its own (`d.notes`, and `d.note(kind, text)`).

## The drawer

```js
const flags = new Tycho.dev.Flags('mygame.dev', { speed: 1, freeze: false });
const drawer = new Tycho.dev.Drawer({
  flags, side: 'right', title: 'DEV',
  button: () => document.getElementById('bDev'),    // the game's own button (or true for one of its own)
  tabs: [
    { id: 'mind', every: 0.5, html: (d) => mindHtml(d) },
    { id: 'events', events: true },
    { id: 'world', html: (d) => worldHtml(d) },     // every 0.4 s by default
    { id: 'tools', every: 0, html: (d) => toolsHtml(d), bind: (body, d) => {} },
  ],
  overlays: [{ id: 'names', on: true }, { id: 'boxes' }, { id: 'land', options: ['off', 'height', 'soil'] }],
  play: [{ key: 'speed', def: 1, word: (v) => 'run ×' + v }, { key: 'freeze', def: false, word: () => 'clock stopped' }],
  acts: { cr: () => { money += 1000; }, go: (id) => goTo(id) },
  pick: (x, y) => whoIsAt(x, y), selectTab: 'mind',
  events: { clock: () => minutes(), when: (t) => clock(t), from: () => worldLogAsEvents(), apart: ['moves'], find: true },
});
flags.load(); drawer.start();     // once the page is ready: the key, the button, the tag, picking
drawer.frame(dt);                 // every frame, with the real seconds since the last
drawer.time('sim', ms);           // a frame time measured, smoothed, for the header's line
```

It opens and closes with the ` key (or ~; `keys`), never while typing in a field, and with its button; it opens at all only with `?dev` in the address, or once it has been (`flags.shown()`), unless `always`. Its head is its title, a button a tab and a close button; under it a row of the overlays' switches and the frame line (`frame(d)` gives it, else the frame rate and the times reported with `time`); then the tab. It remembers whether it's open, the tab and the overlays across a reload. While it's open the page's body has a class (`bodyClass`, `<prefix>-on`), and the page carries CSS variables of how much it covers (`--<prefix>-left`, `--<prefix>-right`, `--<prefix>-bottom`, in px; also `d.covered()`), so the game's own panels can make room for it and its camera can keep the player in the part left showing. Keys typed into its fields never reach the game.

Docked at the left (the default) or the right, at most 440 px wide or 46% of the screen; on a phone held sideways that leaves the game more than half the screen, and its text gets smaller on a short screen. On a screen held upright it's a sheet at the foot instead.

| Call | What it does |
|---|---|
| `start()` | Wires the key, the button, the tag and picking; opens it again if it was open |
| `open(tab)`, `close()`, `toggleOpen(force)`, `on` | Opening and closing it |
| `show(tab)`, `current()`, `addTab(tab, at)` | The tabs |
| `refresh(full, reset)` | The tab drawn again: `full` whatever's going on, `reset` from the top |
| `frame(dt)`, `time(name, ms)`, `fps`, `frameText()` | Every frame; the frame times and the default line |
| `select(id, tab)`, `sel` | Whoever's picked (the game's id) |
| `set(key, value)`, `store(key, value)` | A setting changed (by the game's `set`, or into the flags) |
| `note(kind, text, more)`, `notes`, `evAll()` | The events |
| `overlay(id)`, `overlays()`, `layer()` | The overlays, and a canvas over the game to draw them on |
| `covered()`, `allowed`, `st` | How much of the screen it covers, whether it may open, its own state |

## Its tabs

A tab is `{ id, label, html(d), every, bind(body, d) }`: its body's HTML, how often it's drawn again while it's showing (seconds, 0.4 by default; 0 only when something's done in it, as a tools tab wants), and what to wire after each draw. `{ id, events: true }` is the drawer's own events.

Drawing a tab again never loses your place: where it's scrolled to (and anything inside it that scrolls, given `data-keep`), what has focus and where the caret is in it, what's been typed into a field, and which `details` are open (each field or section known by its `id`, `name` or `data-keep`). It isn't drawn again while a finger or the mouse is down in it, for a moment after it's scrolled, or while a choice is open, so a button is never swept away under a tap.

What's done in a tab goes by data attributes, with the drawer's prefix:

| Attribute | |
|---|---|
| `data-<prefix>act` (and `data-<prefix>arg`) | Runs `acts[name](arg, el, d)`, then the tab again (unless it returns false) |
| `data-<prefix>set` and `data-<prefix>to` | A setting: its key, and its new value as JSON (the steppers, toggles and choices make them) |
| `data-<prefix>sel` | Picks someone (to `selectTab`) |
| `data-<prefix>do` | A mind's button: `close` lets go of whoever's picked; the rest are `acts[name](sel, el, d)` |

The game's own attributes go to `click`, `change` and `input`, each a table by the attribute's name (`click: { v: (id) => pickVillager(id) }`, `input: { findwho: (v, el) => filter(el.value) }`). A button's focus is let go after its tap, so the game's keys are the game's again.

## The pieces

What every tab is made of, as HTML with the drawer's prefix (a `Bits` of a prefix gives them without a drawer):

```js
d.section('Clock', 'day 3')            // <h5>, with a small note
d.kv('day 3 · 08:15 · raining')        // a line
d.hint('Tap someone to read their mind.')
d.chips(d.button('cr', '+1000 cr') + d.button('go', 'Go there', { arg: id }))
d.bar(0.62, { hot: true })             // warm over 0.4, hot over 0.7, or a color
d.bars([['hunger', 0.34], ['energy', 0.8, { hot: true }]])   // a label, a bar and a number each
d.table(['who', 'doing'], [[name, 'pay'], { cells: [name2, 'eat'], cls: 'cur' }], { nums: [] })
d.who(id, 'Ines')                      // a link that picks them
d.stepper({ key: 'speed', label: 'Run speed', value: s.speed, values: [0.5, 0.75, 1, 1.5, 2], fmt: (v) => '×' + v })
d.stepper({ key: 'time', label: 'Time', value: hour, step: [0.25, 1], fmt: clock, stepWord: (h) => (h >= 1 ? h + 'h' : h * 60 + 'm') })
d.toggle({ key: 'freeze', on: s.freeze, label: 'Stop the clock' })
d.choice({ key: 'weather', label: 'Weather', value: s.weather, options: [['auto', 'by the clock'], ['rain', 'rain'], ['dry', 'dry']] })
```

A stepper goes through a list of `values`, or by `step` (several steps make a pair of buttons each, the biggest outermost) between `min` and `max` (landing on a bound before it stops), or round them with `wrap`. Steppers, never sliders, for anything that changes play: a thumb scrolling past can't move one. A stepper, a toggle or a choice off its default (`def`, or the `play` table's) is marked, and a stepper has ↺ to put it back. `num(v, places)` and `esc`, `attr` are there too.

## Settings that change play

`play` lists them, each with its default (read from the flags by its key, or by `get()`) and how to say it (`word(v)`). While any is off its default, a small tag is on screen, the drawer open or not ("run ×0.5 · clock stopped"); a tap on it opens the drawer at `tagTab`. A run speed left at half by a slip of the thumb can't go unnoticed.

## Overlays

`overlays` are switches in the drawer's head for what the game draws over itself: a checkbox each, or a choice of `options` (the first meaning off). `d.overlay(id)` is true (or the choice's value) while it shows, which is only while the drawer's open unless `keepOverlays`; they're kept in the flags. With `layer: true` the drawer has a canvas over the game for them: `d.layer()` each frame gives `{ g, w, h }`, cleared and scaled to CSS px, while any overlay shows, and null (the canvas cleared away) when none does.

`pick(x, y, e)`, given, makes a tap on the game while the drawer's open ask who's there (CSS px): someone found is picked (`select`, to `selectTab`) and the tap goes no further, so it doesn't move the game's stick; nobody there, and the game has the tap.

## The events

A tab with `events: true` shows what happened, newest first: the drawer's notes, and what `events.from()` gives (another log, such as Tyrell's, turned into events; oldest first is cheapest, and it's asked only while the events show), merged by time. Above the list, a chip a kind with its count (the kinds in `events.kinds` first, then any others as they come), the kinds in `apart` left out of "all" (each shown when its chip is picked: the many walks and arrivals of a city), pause and clear (cleared, only what comes after shows), a box to find words in them (`find`), and a line by the filter (`hint`). Each line is its time (`when(t)`), its kind (in `colors[kind]`, or the game's CSS: `.<prefix>-ev.k-<kind>`) and its words. It's drawn again only when there's something new.

`events.most` (600) are kept and `shown` (250) shown. An event with an `impact` gets a column for it and the list a least impact to show: room for the events by impact ([events.md](events.md)), which will be a view here.

## A mind in the drawer

A mind from `Tycho.inspect.mind` with the drawer's prefix is styled to match, and its buttons work in the drawer (`data-<prefix>sel` picks someone they know, `data-<prefix>do` is an act with whoever's picked). For a drawer it can be dense ([inspect.md](inspect.md)): each need's number beside its bar (`numbers`), the chance each option had of being drawn (`chances`), the options as a table (`table`), and what they'd choose if they chose now, every option weighed again without changing anything, with what's ruled out and why (`now`).

```js
tabs: [{ id: 'mind', every: 0.5, html: (d) => d.sel ? Tycho.inspect.mind(world, d.sel, { prefix: d.P, numbers: true, chances: true, table: true, now: true }) : pickList(d) }]
```

## Its look

Compact, dark and monospace, put first in the page's head (so the game's own CSS overrides it) unless `style: false`; `drawerCss(prefix)` is the stylesheet. Every class and id carries the prefix (`dev` by default: `#dev`, `.dev-head`, `.dev-tabs`, `.dev-overlays`, `#dev-fps`, `.dev-body`, `.dev-chips`, `.dev-bar`, `.dev-ev`, `#dev-tag`, `#dev-layer`). Its colors are CSS variables on it, for a game to give its own: `--dv-bg`, `--dv-fg`, `--dv-dim`, `--dv-line`, `--dv-btn`, `--dv-acc` (tabs, links, what's on), `--dv-hi` (titles, and what's off its default), `--dv-up`, `--dv-down`, and its width `--dv-w`.

## Merryfolk's drawer, on these options

Merryfolk keeps its own drawer until its harm work lands; every part of it is one of these options, so it can move without changing:

| Merryfolk's | The drawer's |
|---|---|
| The ` key, the Dev button (`#btn-dev`, `active` while open), `body.dev-on`, always there | `keys` (the default), `button: () => $('btn-dev')`, `bodyClass` (`dev-on`, the default), `always: true` |
| `<aside id="dev">` in `#game`, "Developer mode" | `prefix: 'dev'` (the default), `parent: () => $('game')`, `label` |
| Brain, Events, World, Tools; Brain and World every 0.4 s, Events when there's something new, Tools only when something's done | `tabs` (`every` 0.4 by default, `events: true`, `every: 0`) |
| The overlays' row (labels, paths, grid & lots, cliffs, chunks, the land's choice), drawn only while it's open | `overlays` (a checkbox each, `options` for the land), `overlay(id)` |
| The frame line (fps, sim, paint, draw, the folk, the speed, the chunks, the buckets, a red ! while an error's been caught) | `frame(d)`, with `time('sim', ms)` and the rest from the loop |
| `devLog(cat, text)`, the last 600, 250 shown, `Game.time`, `d1 08:23`, the chips by kind with their counts, pause and clear, a hint for decide and talk, the kinds' colors | `note`, `events.most`, `shown`, `clock`, `when`, `kinds` (`DEV_CATS`), `hint`, `colors` (or its CSS on `.dev-ev.k-<kind> .dev-k`) |
| A villager's link (`data-v`) picks them and shows the Brain; `data-act` runs a tool; `data-tune` changes a number in TUNE | `click: { v }` (or `data-devsel` with `selectTab: 'brain'`), `acts` (or `click: { act }`), `change: { tune }` |
| Its settings under `merryfolk-dev` | `flags` (the drawer's own state under `flags.s.drawer`) |
| Its look and its phone layout (a sheet at the foot under 720 px, the panel and the bottom bar stepping aside) | Its own CSS over the drawer's (on `#dev`, `body.dev-on`) |
