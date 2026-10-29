# Tycho's docs

A page for each part that's in. Tyrell's are in [../tyrell/docs](../tyrell/docs/README.md).

- [core.md](core.md): `Tycho.seed`, `Tycho.math`, `Tycho.color`, `Tycho.loop`.
- [renderer.md](renderer.md): `Tycho.gpu`, `Tycho.light`, `Tycho.post`: the frame on the GPU.
- [sprite.md](sprite.md): `Tycho.sprite`: canvases, letter-row sprites, outlines and copies, letter grids enlarged by rule, and the shape painter (`Shapes`).
- [paint.md](paint.md): `Tycho.paint`: the chunked lazy painter: a pixel buffer, flat or stroked, operations with their own seeds, the chunk cache.
- [fx.md](fx.md): `Tycho.fx`: particles thrown and falling, effects that run out, words rising.
- [world.md](world.md): `Tycho.grid`, `Tycho.collide`, `Tycho.move`, `Tycho.path`: tiles, the collision query, movers and paths.
- [play.md](play.md): `Tycho.input` (the controls and map gestures), `Tycho.items` (bags, things, slots, gear and counted views), `Tycho.guide` (a tutorial's steps).
- [harm.md](harm.md#tycho-the-moment): `Tycho.harm`, the moment of a hit: a pipeline of stages (resist, armor, soak, react, knock, stagger, hold and the game's own), statuses and their reactions, means, moves, triggers, the feel and the player's wounds; the page is also the whole design for harm, with what follows in Morgul, a Tyrell module.
- [shell.md](shell.md): `Tycho.save`, `Tycho.pwa`, `Tycho.dev`, `Tycho.loader`.
- [dev.md](dev.md): `Tycho.dev`, the dev tools: the address and the flags, `Notes` (a log any game can write to), and the dev drawer (a console docked at the side while the game runs: the game's tabs, overlays, the events, steppers and toggles, a tag while a setting that changes play is off its default).
- [audio.md](audio.md): `Tycho.audio`: sound made in code (the engine, the voices, the bank rendered ahead, the music's machinery).
- [inspect.md](inspect.md): `Tycho.inspect`: the minds inspector for a game whose people are Tyrell's.
- [ui.md](ui.md): `Tycho.ui`: toasts, rising lines, buttons wired by their data attributes, a screen's acts.
- [minds.md](minds.md): the bridge, `Tycho.minds` (`dist/tycho-minds.js`): the glue between a game and Tyrell.
- [installable.md](installable.md): the service worker (`dist/tycho-sw.js`).
- [testkit.md](testkit.md): the Node test kit (`dist/testkit.cjs`).
- [eros.md](eros.md): Eros, a sandbox in the terminal for Tyrell: a town live, its story, everything it's made of to see, add and change, the living documentation of every kind, and setup files opened and exported (`npm run eros`).
- [brand/](brand/README.md): the logo, its files and colors, and the script that draws it.
- [move.md](move.md): moving the three games onto Tycho, phase by phase: what moved, what changed, what's left.

Proposed, and not built yet:

- [events.md](events.md): watching the simulation's events by impact (a death near 1, a chat near 0) above a threshold you set: impact in Tyrell's log, the view in the development tools.
