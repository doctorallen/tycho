# The world

`Tycho.grid`, `Tycho.collide`, `Tycho.move` and `Tycho.path`: one model of a world's space for every game. Tiles live in grids; tiles and hand-placed shapes are asked about through one collision query; bodies move against it; and ways are found through it. The White Dragon's runner, Lodestar's bodies and its crowd's flow field run on these, bit for bit what the games had (`test/world.test.mjs` holds each to the game's original, and each game replays traces recorded from its old code: `test/traces.js`). Merryfolk's A* is here too, waiting for it.

## Tycho.grid

A grid is w × h tiles in layers, each 8 or 16 bits a tile, under one lookup that answers an edge value outside.

```js
// a world generated whole, its arrays wrapped as they are (never copied)
const g = new Tycho.grid.Grid({ w, h, layers: [{ name: 'tiles', data: tiles, edge: TILE_EDGE }, { name: 'ore', data: ore }] });
// a big world in chunks, each made from the seed the first time it's touched
const big = new Tycho.grid.Grid({ w: 8400, h: 2400, chunk: 32, layers: [{ name: 'ground' }, { name: 'wall' }, { name: 'light', bits: 16 }],
  make: (c) => { /* fill c.cells[layer][(y - c.y0) * 32 + x - c.x0] from the seed */ } });
```

| | |
|---|---|
| `get(l, x, y)` | The tile in layer `l` (an index: `layer(name)`) at whole tile x, y; the layer's `edge` outside |
| `set(l, x, y, v)` | Writes it (false outside), marks its chunk's rectangle changed and, once sealed, keeps the change |
| `fill(l, x0, y0, x1, y1, v)` | A rectangle of tiles (x1, y1 not included), clipped to the grid |
| `array(l)` | A flat grid's layer as one w × h array (the game's own, if it brought it) |
| `chunkAt(cx, cy)`, `has(cx, cy)` | A chunked grid's chunk (`{ cx, cy, x0, y0, cells }`), made if it isn't yet |
| `takeDirty()` | The rectangles changed since the last take, one a chunk (the bounds of what changed in it), in rows of chunks: what to repaint |
| `seal()` | What's there now is what the seed made: from here on, changes from it are kept |
| `changes()` | Every tile that isn't what the seed made, by layer name, `[x, y, v, ...]` in rows: a save |
| `apply(changes)` | Puts a save's changes back over a world made again from its seed (and sealed) |

A flat grid (`flat: true`, or any layer given its `data`) keeps each layer as one array and still keeps its bookkeeping by chunks. A set that leaves a tile as it was changes nothing; one that puts a tile back to what the seed made drops the change.

## Tycho.collide

A `Space` gathers a level's solids and the surfaces that hold a body only some ways, and answers for all of them at once. Lists are kept by reference, or read through a function each time, so what's in them can change.

```js
// the White Dragon: boxes, props that block until they're done, the world's sides, walkways and stairs, ladders
const space = new Tycho.collide.Space()
  .boxes(L.solids)
  .boxes(() => World.props, (p) => p.block && !p.done ? p.block : null)
  .bounds(0, L.w).ways(L.ways).ladders(L.ladders);
// Lodestar: a floor's tiles felt along its smooth wall line, and round solids
const rock = new Tycho.collide.Tiles(grid, 0, { size: 16, solid: TILE_SOLID, smooth: { noise: (x, y) => wallNoise(x, y, 7), amp: 0.14 } });
const space = new Tycho.collide.Space().tiles(rock).ellipses(() => f.solids || []);
```

| Adding | |
|---|---|
| `boxes(list, pick?)` | Solid boxes `{ x0, y0, x1, y1 }`, or what `pick(item)` makes of each item (nothing: not solid now) |
| `bounds(x0, x1)` | Walls either side of the world |
| `tiles(new Tiles(grid, layer, { size, solid, smooth? }))` | A grid's layer: square tiles, or a smooth line (the four nearest tiles' solidity blended, `amp` of `noise` added, solid past a half; a diagonal pinch opened by `pinch`, 0.55) |
| `ellipses(list)` | Round solids `{ x, y, rx, ry }` |
| `ways(list)` | One-way surfaces `{ x0, y0, x1, y1 }` (x0 ≤ x1), flat or sloped: stood on from above |
| `ladders(list, reach = 6)` | Ladders `{ x, y0, y1 }`, taken within reach of their line |

| Asking | |
|---|---|
| `hits(x0, y0, x1, y1)` | The first solid the box overlaps (touching edges don't count): boxes in the order given, then square tiles, then the sides; null when clear |
| `solidAt(x, y)` | Is the point solid (tiles, boxes, ellipses, past the sides)? `inTiles(x, y)`: in the tiles only |
| `circleHits(x, y, r)` | Does a round body touch anything? Felt in the tiles at its middle and eight points round its edge, by overlap with ellipses (grown by r), boxes and the sides |
| `circleDepth(x, y, r)` | How far into the tiles it is: edge points in them, its middle counting double |
| `way(x, y0, y1)` | The highest one-way surface at x between y0 and y1, or null |
| `ladderAt(x, y0, y1)` | The first ladder in reach of x overlapping y0..y1, or null |
| `ray(x0, y0, x1, y1, step = 1)` | What the ray hits first, `{ t, x, y }` with the `box`, `tile` or `ellipse`, or null: boxes and sides by their edges, square tiles cell by cell, smooth tiles felt every `step` px, ellipses exactly |

`Tiles` also answer `at(x, y, table?)` (is the point solid, by its table or another: Lodestar asks which tiles rise as rock to paint them), `tileAt(x, y)` and `box(...)` (square tiles: the first solid one under a box).

## Tycho.move

### Platform

A side-on runner, the White Dragon's: a box with gravity whose pace is how far the stick is pushed (a walk under `walkUnder`, then up to a run), coyote time, a jump cut short when it's let go (`hop`), small ledges stepped up, walkways and stairs stood on from above, followed down while walking and dropped through with down and jump, and ladders climbed, jumped off (`leap`) and let go of sideways.

```js
const runner = new Tycho.move.Platform(T.player /* w, h, speed, walk, accel, airAccel, friction, jump, gravity, maxFall, coyote, climb */);
const r = runner.step(space, body, { ax, ay, jump, jumpHit, scale: devSpeed, busy: hold ? 0.15 : 1 }, 1 / 60);
if (r.grabbed) hold = null;     // a ladder taken this step (and the busy slowdown didn't apply)
if (r.climbing) { /* on a ladder */ }
```

The body is `{ x, y, vx, vy, face, ground, coyote, drop, ladder, walked }`, x the middle of the feet and y the soles. The numbers are read every step, so a game's tuning can change under it. Every finer number (thresholds on the stick, the ladder's grab and leap, the drop, the hop, the ledges, the stairs followed) is an option, each the White Dragon's by default. `hits(space, x, y)` is the body's box test (a hair inside its edges).

### topdown

`Tycho.move.topdown(space, body, dx, dy, r, options?)` moves a round body seen from above, Lodestar's: clear, it goes; wedged on a ragged edge, it may work out or along at the same depth with its middle clear, never deeper in; blocked, it slides one axis at a time as far as each goes (four halvings, `bisect`), and if that got it under a third of the way (`round`) it tries round, turning 0.7 then 1.2 radians either side at 0.8 of the step (`turns`, `reach`).

## Tycho.path

| | |
|---|---|
| `distances(cells, w, h, x, y, solid, avoid?, out?)` | Steps on foot from tile x, y to every tile (-1 unreached), four ways round, onto tiles not `solid` by value and not marked in `avoid`: Lodestar's flow field, which its crowds follow downhill. An Int16Array, or into `out` (Int16Array or Int32Array) |
| `new AStar(w, h, { cap, diag: 1.414 })` | Merryfolk's A*: `find(sx, sy, tx, ty, { walkable, cost, snap: 7 })` gives the tiles after the start to the goal, eight ways round without cutting corners, a diagonal `diag` times a step, an octile estimate; the start and goal moved to the nearest walkable tile within `snap`; at most `cap` tiles taken a search. `near(x, y, walkable, r)` alone |
| `new Routes()` | Places joined by links: `link(a, b, cost, leg, oneWay)`, then `route(a, b)` gives `{ cost, places, legs }`, the cheapest (Dijkstra; ties to the links added first), or null |

`Routes` is for people who travel off screen as well as on: a leg is whatever the game says it is (a walk along a street, the gap crossing one, a ride between bands). The White Dragon's own router (`Town.route`) stays in the game for now: it's bound to the census and the residents' minds and is reworked with them later.
