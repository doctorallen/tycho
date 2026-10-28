# Installable games

`dist/tycho-sw.js` is a service worker that makes a game installable and playable offline but never stale: every request goes to the network first (revalidating past the browser's HTTP cache) and falls back to the cached copy only without a network. Don't make it cache-first.

A worker controls only what's under its own folder, so a game keeps a few lines of its own `sw.js` at its root and imports Tycho's:

```js
self.TYCHO_SW = {
  name: 'mygame',          // the caches are named mygame-<build>
  build: '__BUILD__',      // stamped with the commit at deploy, so each deploy is a new worker
  files: ['fonts/a.woff'], // anything the page doesn't name
};
importScripts('vendor/tycho/dist/tycho-sw.js');
```

On install it keeps the page and every script, stylesheet and icon `index.html` names (read from the page, so a new file needs no line anywhere), the manifest and its icons, and `files`; with `page: false`, only `files`. It takes over at once and clears the caches of older builds. `version.json` always goes straight to the network: it's how a page learns which build is live.

The deploy stamps `__BUILD__` in `sw.js` (and wherever the page keeps its own build), and writes `version.json`.
