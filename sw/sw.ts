// The service worker for an installable game (dist/tycho-sw.js): installable
// and playable offline, but never stale. Every request goes to the network
// first (revalidating past the browser's HTTP cache) and only falls back to
// the cached copy when there's no network. Don't make it cache-first.
//
// A game keeps a few lines of its own sw.js at its root (a worker controls
// only what's under its own folder), which say what to keep and import this:
//
//   self.TYCHO_SW = { name: 'mygame', build: '__BUILD__', files: ['fonts/a.woff'] };
//   importScripts('vendor/tycho/dist/tycho-sw.js');
//
// `build` is replaced with the commit at deploy, so each deploy is a new
// worker: it installs, takes over at once, and the page moves onto the new
// version when it's safe to (Tycho.pwa). What's kept offline is the page and
// every script, stylesheet and icon index.html names (read from it, so a new
// file needs no line anywhere), the manifest and its icons, and `files`.
// With `page: false` only `files` (and './' and index.html) are kept.
// version.json always goes straight to the network: it's how a page learns
// which build is live.

interface SwConfig { name: string; build: string; files?: string[]; page?: boolean }
const sw = self as unknown as ServiceWorkerGlobalScope & { TYCHO_SW?: SwConfig };
const C: SwConfig = sw.TYCHO_SW || { name: 'game', build: 'dev' };
const CACHE = C.name + '-' + C.build;
const ALSO = ['./', 'index.html', 'manifest.webmanifest'];

const fresh = (url: string) => new Request(url, { cache: 'reload' });

async function wanted(): Promise<string[]> {
  const files = ALSO.concat(C.files || []);
  if (C.page !== false) {
    try {
      const page = await (await fetch(fresh('index.html'))).text();
      for (const m of page.matchAll(/(?:src|href)="([^"#:?]+)"/g)) files.push(m[1]);
    } catch (e) { /* offline at install: keep what's listed */ }
    try {
      const man = await (await fetch(fresh('manifest.webmanifest'))).json();
      for (const i of man.icons || []) if (i && i.src) files.push(i.src);
    } catch (e) { /* no manifest */ }
  }
  return [...new Set(files.map((f) => f.replace(/^\.\/(?=.)/, '')))];
}

sw.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // one at a time, so a file that's gone doesn't stop the rest
    for (const f of await wanted()) { try { await c.add(fresh(f)); } catch (err) { /* missing: skip */ } }
    await sw.skipWaiting();
  })());
});

sw.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith(C.name + '-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => sw.clients.claim()));
});

sw.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.json')) return; // always straight to the network
  e.respondWith(
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(async () => (await caches.match(req, { ignoreSearch: true }))
        || (req.mode === 'navigate' ? await caches.match('index.html') : undefined)
        || Response.error()),
  );
});
