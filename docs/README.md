# Tycho's docs

A page for each part that's in. Tyrell's are in [../tyrell/docs](../tyrell/docs/README.md).

- [core.md](core.md): `Tycho.seed`, `Tycho.math`, `Tycho.color`, `Tycho.loop`.
- [renderer.md](renderer.md): `Tycho.gpu`, `Tycho.light`, `Tycho.post`: the frame on the GPU.
- [sprite.md](sprite.md): `Tycho.sprite`: canvases, letter-row sprites, outlines and copies, letter grids enlarged by rule, and the shape painter (`Shapes`).
- [paint.md](paint.md): `Tycho.paint`: the chunked lazy painter: a pixel buffer, flat or stroked, operations with their own seeds, the chunk cache.
- [fx.md](fx.md): `Tycho.fx`: particles thrown and falling, effects that run out, words rising.
- [world.md](world.md): `Tycho.grid`, `Tycho.collide`, `Tycho.move`, `Tycho.path`: tiles, the collision query, movers and paths.
- [play.md](play.md): `Tycho.input` (the controls and map gestures), `Tycho.items` (bags, things, slots, gear and counted views), `Tycho.guide` (a tutorial's steps).
- [shell.md](shell.md): `Tycho.save`, `Tycho.pwa`, `Tycho.dev`, `Tycho.loader`.
- [audio.md](audio.md): `Tycho.audio`: sound made in code (the engine, the voices, the bank rendered ahead, the music's machinery).
- [inspect.md](inspect.md): `Tycho.inspect`: the minds inspector for a game whose people are Tyrell's.
- [ui.md](ui.md): `Tycho.ui`: toasts, rising lines, buttons wired by their data attributes, a screen's acts.
- [minds.md](minds.md): the bridge, `Tycho.minds` (`dist/tycho-minds.js`): the glue between a game and Tyrell.
- [installable.md](installable.md): the service worker (`dist/tycho-sw.js`).
- [testkit.md](testkit.md): the Node test kit (`dist/testkit.cjs`).
- [brand/](brand/README.md): the logo, its files and colors, and the script that draws it.
- [move.md](move.md): moving the three games onto Tycho, phase by phase: what moved, what changed, what's left.
