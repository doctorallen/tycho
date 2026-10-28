/* Tycho 2.0.0 (tycho-sw): the service worker for an installable game. Built from sw/ by scripts/build.mjs; don't edit. MIT license. */
"use strict";
(() => {
  // sw/sw.ts
  var sw = self;
  var C = sw.TYCHO_SW || { name: "game", build: "dev" };
  var CACHE = C.name + "-" + C.build;
  var ALSO = ["./", "index.html", "manifest.webmanifest"];
  var fresh = (url) => new Request(url, { cache: "reload" });
  async function wanted() {
    const files = ALSO.concat(C.files || []);
    if (C.page !== false) {
      try {
        const page = await (await fetch(fresh("index.html"))).text();
        for (const m of page.matchAll(/(?:src|href)="([^"#:?]+)"/g)) files.push(m[1]);
      } catch (e) {
      }
      try {
        const man = await (await fetch(fresh("manifest.webmanifest"))).json();
        for (const i of man.icons || []) if (i && i.src) files.push(i.src);
      } catch (e) {
      }
    }
    return [...new Set(files.map((f) => f.replace(/^\.\/(?=.)/, "")))];
  }
  sw.addEventListener("install", (e) => {
    e.waitUntil((async () => {
      const c = await caches.open(CACHE);
      for (const f of await wanted()) {
        try {
          await c.add(fresh(f));
        } catch (err) {
        }
      }
      await sw.skipWaiting();
    })());
  });
  sw.addEventListener("activate", (e) => {
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(C.name + "-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => sw.clients.claim()));
  });
  sw.addEventListener("fetch", (e) => {
    const req = e.request, url = new URL(req.url);
    if (req.method !== "GET" || url.origin !== location.origin) return;
    if (url.pathname.endsWith("/version.json")) return;
    e.respondWith(
      fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(async () => await caches.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await caches.match("index.html") : void 0) || Response.error())
    );
  });
})();
