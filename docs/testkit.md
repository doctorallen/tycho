# The test kit

`dist/testkit.cjs`, for a game's headless tests in Node. It drives Chromium through the game's own Playwright, or through puppeteer-core with the Chrome in `$CHROME` (as CI's `browser-actions/setup-chrome` provides); `$TYCHO_DRIVER` picks one.

```js
const tk = require('../vendor/tycho/dist/testkit.cjs');
const kit = await tk.launch({ gl: true });             // gl: WebGL2 in software; without, the GPU is off
const { page, errors } = await tk.open(kit, {
  root: ROOT,                                          // the game's folder, opened from a file...
  serve: true,                                         // ...or served over http
  viewport: tk.PHONE_WIDE,                             // PHONE, PHONE_WIDE, DESKTOP, or { width, height, mobile, scale }
  storage: null,                                       // start with empty localStorage (or { key: value })
  ready: 'typeof Game !== "undefined" && Game.ready',  // an expression or a function run in the page
});
await tk.waitFor(page, () => Game.frame > 10);
await tk.shot(page, OUT, 'phone-start');
tk.finish('smoke', failures);                          // prints the verdict, exits 1 on failure
await kit.close();
```

| Name | What it does |
|---|---|
| `launch({ gl, args, driver })` | A browser: `{ driver, browser, page(viewport), close() }` |
| `serve(root, routes)` | Serves a folder on a free port (`version.json` answers a local build) |
| `open(kit, options)` | A fresh page on the game, errors gathered, storage set, ready waited for |
| `waitFor(page, test, { timeout, every, arg })` | Polls until true, the same under either driver |
| `errorsOf(page)` | Page errors and console errors, as they come |
| `shot(page, dir, name)` | A screenshot |
| `golden(file, values, { update })` | Compares name/value pairs with a JSON file; `--update` writes it |
| `PAGE` | Helpers to put in a page (`page.evaluate(tk.PAGE)`): `TK.hash(bytes)`, `TK.canvas(c)`, `TK.image(img)` |
| `diff(kit, pngA, pngB, { tone })` | Compares two pictures tone by tone: `{ same, maxTone, share, mean }` |
| `finish(name, failures)` | The verdict |
