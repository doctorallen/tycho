# The shell

The parts around the game: saving, staying current as an installed app, dev settings and loading. The dev tools' drawer ([dev.md](dev.md)), sound ([audio.md](audio.md)), the minds inspector ([inspect.md](inspect.md)) and the interface kit ([ui.md](ui.md)) have pages of their own.

## Tycho.save

Storage that never throws (it can be missing, full or refused): `get(key, fallback)` and `set(key, value)` (JSON), `raw(key)`, `remove(key)`, `keys(prefix)`.

A `Store` keeps a game's one save object:

```js
const store = new Tycho.save.Store({
  key: 'mygame.save.v1',
  fresh: () => ({ v: 1, level: 'start', cr: 0 }),  // a new game's save
  old: ['oldgame.save.v1'],                         // keys no longer read: deleted on load
  renamed: [[/\bd_flats\b/g, 'd_apartments']],      // ids renamed since a save could have been made
  accept: (stored, fresh) => stored.v === fresh.v,  // else a new game
  clean: (data) => { data.notes = data.notes || {}; }, // put a loaded save right
  keepUnread: true,                                 // a save that can't be read is kept aside, never written over
  onRefused: () => toast("Progress can't be saved in this browser"), // once
});
const data = store.load();   // the stored save over a fresh one; store.loaded says whether there was one
store.write();               // store.data, or what's given
store.writeField('settings'); // one field at once, the rest as last stored
store.wipe();                // delete it and stop writing
store.startOver('mygame.', { v: 1, settings }); // every key with the prefix gone, the next save written
```

## Tycho.pwa

The page's half of an installable game (the worker's is [installable.md](installable.md)):

```js
const pwa = Tycho.pwa.start({
  build: '__BUILD__',                       // the page's build, stamped at deploy
  onNewer: (newer) => { save(); pwa.reload(); }, // a newer build took over: reload now, or wait and ask
  canAsk: () => !inPlay(),                  // a good moment for the browser's install pop-up
  askedKey: 'mygame.installAsked',          // when it was last asked (again after askEvery, 3 days)
  onInstallable: () => redrawMenu(), onInstalled: () => toast('Installed'),
});
pwa.updated();   // after a reload onto a new build: its name (once), to say so
pwa.installed(); pwa.ios(); pwa.install(); pwa.live; pwa.newer; pwa.check();
pwa.installedElsewhere().then((yes) => ...); // installed on this device, but open in a browser tab
```

Over http(s) only; opened from a file the game plays as a page. It looks for a new deploy when the page comes back to the foreground and every 15 minutes (`every`).

The browser's offer to install (`beforeinstallprompt`) is kept from the moment `tycho.js` loads, so a game that starts its installable app late, after building its world, still gets an offer that came first: `start` takes it up and calls `onInstallable` once it's done starting.

Once the game is installed, a browser tab never offers to install it again. `installedElsewhere()` says whether that's why, where the browser can tell (Chrome and Edge): the game's manifest lists itself in `related_applications`, as `{ "platform": "webapp", "url": "<the manifest's full address>" }`, and the menu can say to open it from the home screen instead.

## Tycho.dev

`query(name)` says whether `?name` is in the address. `new Flags(key, defaults).load()` keeps testing switches in their own storage key (never in the save): `s` holds them, `save()` keeps them, `shown()` is true with `?dev` in the address or once it has been. The dev drawer (a console docked at the side while the game runs, with the game's tabs, overlays, the events and the pieces every tab shows), and `Notes`, a log any game can write to, are in [dev.md](dev.md).

## Tycho.loader

Loading in slices with an honest bar (Lodestar's loader without its screen). `new Tasks({ slice: 12, onError, onFrame })`, then `await tasks.run([{ label, weight, fn, side }...])`. A task's `fn(job)` may do its work at once; return a step function, called a slice at a time until it returns true; or be async and `await job.yield()` often. `job.at(k, n)` moves the bar, `job.say(text)` changes its line. A task that throws is skipped and the rest go on. `tasks.progress()` is 0..1 by weight; `tasks.each(job, list, fn)` makes a step function over a list; `afterPaint(fn)` runs fn once the frame being drawn is on screen.
