# Effects

`Tycho.fx`: particles thrown and falling, effects that run out, and words rising over what they're about. Each is a game's own, bit for bit (`test/pixels.test.mjs`). Nothing here is saved or pinned by a golden test, so an effect may draw from `Tycho.seed.fxRand`; an emitter takes the random source it's given.

| Name | What it does |
|---|---|
| `tick(list, dt)` | Each one's time left (`t`) counted down by dt, those run out (t <= 0) dropped, in place (Lodestar's lists of rings, decals, flares...). Returns the list |
| `age(list, dt, life)` | Each one's age (`t`) counted up, those past their life (each one's `life`, or the one given) dropped, in place (the White Dragon's puffs and splashes) |
| `move(q, dt, { bounce, slide })` | One particle moved: `drag` (speed times e^(-drag·dt)), then gravity `g`, then motion; landing on its `floor` while falling, it keeps `bounce` of its fall (0.35) and `slide` of its slide (0.6) |
| `new Particles({ max, keep, bounce, slide })` | A list (`list`) that moves and runs out: `add(p)`, `step(dt)` (each loses dt of its time, those left move), `cap()` (past `max`, 260, the oldest go until `keep`, 200, are left), `length` |
| `sparks(x, y, n, draw, o)` | n sparks thrown up and falling, each its own speed, life and a hot color from orange to yellow (`c`): the White Dragon's (`spread` 160, `up` 40 + `upMore` 110, `life` 0.25 + `lifeMore` 0.35, `g` 400) |
| `burst(x, y, c, n, draw, o)` | A ring of n flying out in one color, each a little off its place round the ring (`speed` 40 + `speedMore` 70, `life` 0.3 + `lifeMore` 0.3) |
| `rise(age, i, of, o)` | The i-th of `of` lines of text rising together, at an age: `{ stack, up, alpha }` (its place is start - stack - up), or null before it starts and once it's gone; `speed` 12 px/s, `line` 21 px, fading from `fade` 1.8 s over `out` 0.6 s, gone at `life` 2.4 s (the White Dragon's gains) |

A particle is `{ x, y, vx, vy, t }` with `g`, `drag` and `floor` if it has them, and anything else the game draws it by. `draw(k, s)` is an emitter's random source: the k-th particle's s-th draw, 0..1. The White Dragon's is `(k, s) => hash(Game.frame, k, s)`, so a frame's sparks are the same however often it's drawn; `() => Tycho.seed.fxRand.f()` will do where nothing cares.

```js
const sparks = new Tycho.fx.Particles();
for (const p of Tycho.fx.sparks(x, y, 8, (k, s) => hash(frame, k, s))) sparks.add(p);
sparks.cap();
sparks.step(dt);                                      // each frame
for (const p of sparks.list) gg.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), 1, 1);
```
