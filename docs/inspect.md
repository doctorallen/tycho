# Tycho.inspect

The minds inspector, for a game whose people are Tyrell's: anyone's mind read from the world, and the clock to run from there. It was the White Dragon's Tyrell mode; the game keeps its map (its streets and rooms are its own) and draws it on the inspector's canvas.

A mind shows what they're doing and until when (and the layer and rank it came from), what they were told to do, their needs as bars, their mood, why (the last decision from Palantír: what they chose and where, every option weighed with its rank, its weight and what the weight was made of, or what ruled it out), today's routine with the hour they're in marked, what they've done lately (Westmarch's chronicle, or with `story` Irulan's telling of it and their storylines), and who they know best (Fellowship), each a button to their own mind.

## A mind alone

```js
const html = Tycho.inspect.mind(world, 'ruth', {
  prefix: 'dev',                                  // classes and data attributes: .devneeds, data-devsel, data-devdo
  name: (id) => folk[id].name, who: (id) => folk[id].trade,
  place: (pid, id) => (!pid ? 'anywhere' : places[pid] ? places[pid].label : pid),
  about: (id, p) => ` · ${p.vars.money} coins`,   // after the mood
  buttons: (id) => '<button data-devdo="follow">Follow</button>',  // before Close
});
```

Every option is optional; without them a mind reads from the world alone (names from the world, places by id). `walking(id)` adds a note after "Walking" (the White Dragon's " (off screen)"); `selectable(id)` says whether someone they know can be picked (else they're only named); `needColors`, `options` (9), `lately` (12 hours), `lines` (10) and `known` (4) set the rest. `hhmm(minutes)` and `esc(text)` are there too.

For a dev drawer ([dev.md](dev.md)) it can be dense: `numbers` puts each need's value beside its bar; `chances` the chance each option had of being drawn (Tyrell's pick worked out from the world's `cfg`: the top rank, the weak cut, a draw from the best few by weight to the power; `chances(candidates, cfg)` gives them alone); `table` lays the options out as a table (option and where, rank, weight, chance, why), the same option at places of the same name, weighed the same, one row; and `now` adds what they'd choose if they chose now, every option weighed again inside the world's `peek` (so nothing changes: not the state, not the streams), with what's ruled out grouped by why. `story` tells Lately as a story, by Irulan, Tyrell's narrator ([tools](../tyrell/docs/tools.md#irulan)), when the world has it: their beats since `lately`, a sentence each with its time (a span for what went on a while: "20:05–20:35 Dev helped Sam out at home for half an hour."), the day named where it changes, and the others in them links to their own minds; then the storylines they're in (Irulan's `threads`, from the story kept or the whole log), each folded under its title, open while it's going on. Only the beats that are theirs or that they took part in, not those they were only about for (`around: true` for those too). A list of more than `names` people (3) in a sentence folds after that many, "with Efua, Haruto Darko, Rosa Zhou…+2 home too", and opens in place to the rest; each fold, and each storyline, has a key (`data-keep`), so a drawer's redraw leaves it open or shut as it was. `story: { min, threads, around, weights, names }` leaves out beats scoring under `min` (0.1, the routine), shows that many storylines (3; 0 for none), gives Irulan its `weights` by kind of entry (`{ met: 0 }`: no company), and folds lists after `names`. Without these the mind is as it was, character for character.

The world is read through the shape Tyrell's `World` has (`now`, `get`, `needOf`, `why`, `mind.routineAt`/`routineFor`, `westmarch.chronicle`, and `fellowship`, `reverie`, `esper` and `irulan` when they're there), so the engine never takes Tyrell itself: a game passes its world in.

## The panel

```js
const ins = new Tycho.inspect.Inspector({
  prefix: 'tm', bg: '#0a0812',
  world: () => (City.on ? City.w : null),
  people: () => TOWN_ORDER,
  kinds: { work: { color: '#ffb040', word: 'working' }, other: { color: '#c8c0d8', word: 'other' } },
  kind: (id) => kindOf(City.state(id).act), note: (id) => City.state(id).act,
  clock: { now: () => minutes(), set: (m) => { setGameClock(m); City.sync(); }, text: () => 'Day 3 · 08:15' },
  speeds: [1, 10, 60, 240], speed: 60, say: (t) => toast(t),
  view: {
    height: (box) => Math.max(box, rowsHeight()),          // taller than its box scrolls
    draw(g, ins) { /* the map; people with ins.dot(g, x, y, color, id, moving), boxes with ins.badge({ x0, x1, y0, y1, ... }) */ },
    tap(badge, x, y, ins) { /* a tap that found nobody: the box under it, if any */ },
    grab: () => scroll, drag(dx, dy, from) { scroll = from - dx; ins.draw(); },
    wheel(e, x, y) { /* zoom */ },
  },
  bar: () => '<button data-tm="city">City</button>',      // the game's own on the bar
  act(key, id, ins) { /* the game's buttons (the bar's, a mind's data-tmdo); false: leave the panel be */ },
  summary: (ins) => '<h3>Everyone</h3>' + ins.legend(counts), // the side with nobody picked
  onSelect(id) {}, status() {}, open: () => Hud.open === 'tyrell',
  // and the mind's options above (name, who, place, walking, about, selectable, buttons)
});
panelBody.innerHTML = ins.html();
ins.attach(panelBody);   // wires it and runs until the panel closes
```

The bar is the clock, the steps (`steps`, minutes: −1h, −15m, +15m, +1h), Play at the chosen speed, and the game's own. The side is the mind of whoever's picked (`ins.sel`), a list of who's somewhere (`ins.list = { title, ids }`: a button each in their color, with `note(id)`), or the summary. A tap on the view picks the nearest person within 9 px; otherwise the view's `tap` hears of it with the box under it. Going back is Esper's time walk: no further than it remembers (the nearest quarter hour after, said through `say`).

| Call | What it does |
|---|---|
| `html()`, `attach(root)` | The panel's markup, and wiring it where it went |
| `step(min, quiet)` | The clock on or back |
| `draw()`, `size()`, `side(force)`, `clock()` | Redraw the view (sized again when its box or its height changes), the side (not under the pointer unless forced), the bar |
| `dot(g, x, y, color, id, moving, r)`, `badge(box)`, `color(id)` | For the view's drawing |
| `select(id)`, `tap(x, y)` | Picking |
| `legend(counts)`, `summary()`, `listHtml(list)` | The side's parts |

The words are the inspector's; the looks are the game's: every class and id carries the prefix (`.tm`, `.tmbar`, `#tmclock`, `.tmneeds`, `.tmwhy`, `.tmday`, `.tmlog`, `.tmstory`, `.tmthreads`, `.tmwhen`, `.tmmore`, `.tmlist`, `.tmlegend`...), so a game's CSS styles it.

`test/inspect.test.mjs` holds the mind to the White Dragon's Tyrell mode, character for character, on Rocinante at forty moments and after a time walk, and its story to Irulan's beats and threads.
