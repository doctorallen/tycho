/* Tycho 2.0.0 (testkit): the test kit for games on Tycho. Built from testkit/ by scripts/build.mjs; don't edit. MIT license. */
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// testkit/index.ts
var index_exports = {};
__export(index_exports, {
  DESKTOP: () => DESKTOP,
  PAGE: () => PAGE,
  PHONE: () => PHONE,
  PHONE_WIDE: () => PHONE_WIDE,
  annotate: () => annotate,
  chromePath: () => chromePath,
  diff: () => diff,
  errorsOf: () => errorsOf,
  finish: () => finish,
  golden: () => golden,
  launch: () => launch,
  open: () => open,
  run: () => run,
  serve: () => serve,
  shot: () => shot,
  sleep: () => sleep,
  waitFor: () => waitFor
});
module.exports = __toCommonJS(index_exports);
var fs = __toESM(require("node:fs"));
var http = __toESM(require("node:http"));
var path = __toESM(require("node:path"));
var PHONE = { width: 390, height: 844, mobile: true, scale: 3 };
var PHONE_WIDE = { width: 844, height: 390, mobile: true, scale: 3 };
var DESKTOP = { width: 1280, height: 800, mobile: false, scale: 1 };
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function find(name) {
  for (const from of [process.cwd(), __dirname]) {
    try {
      return require.resolve(name, { paths: [from] });
    } catch (e) {
    }
  }
  try {
    return require.resolve(name);
  } catch (e) {
    return null;
  }
}
function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const p of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"]) if (fs.existsSync(p)) return p;
  return null;
}
function puppeteerish(p) {
  const evaluate = p.evaluate.bind(p), waitForFunction = p.waitForFunction.bind(p);
  const pack = (fn, args) => args.length <= 1 || typeof fn !== "function" ? [fn, ...args] : [({ s, a }) => (0, eval)("(" + s + ")")(...a), { s: fn.toString(), a: args }];
  p.evaluate = (fn, ...args) => evaluate(...pack(fn, args));
  p.waitForFunction = (fn, o, ...args) => {
    const [f, a] = pack(fn, args);
    return waitForFunction(f, a, { timeout: o && o.timeout, polling: o && typeof o.polling === "number" ? o.polling : void 0 });
  };
  if (!p.evaluateOnNewDocument) p.evaluateOnNewDocument = (fn, ...args) => p.addInitScript(...pack(fn, args));
  if (!p.setViewport) p.setViewport = (vp) => p.setViewportSize({ width: vp.width, height: vp.height });
  return p;
}
async function launch(o = {}) {
  const args = ["--allow-file-access-from-files", "--no-sandbox", "--autoplay-policy=no-user-gesture-required"].concat(o.gl ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] : ["--disable-gpu"], o.args || []);
  const pp = find("puppeteer-core"), pw = find("playwright");
  let driver = o.driver || process.env.TYCHO_DRIVER;
  if (!driver) driver = process.env.CHROME && pp ? "puppeteer" : pw ? "playwright" : "puppeteer";
  if (driver === "playwright") {
    if (!pw) throw new Error("testkit: Playwright is not installed");
    const { chromium } = require(pw);
    const browser2 = await chromium.launch({ args, executablePath: process.env.CHROME || void 0 });
    return {
      driver,
      browser: browser2,
      page: async (vp = DESKTOP) => puppeteerish(await browser2.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale || 1, isMobile: !!vp.mobile, hasTouch: !!vp.mobile })),
      close: () => browser2.close()
    };
  }
  if (!pp) throw new Error("testkit: neither Playwright nor puppeteer-core is installed");
  const exe = chromePath();
  if (!exe) throw new Error("testkit: no Chrome found: set CHROME to the browser executable");
  const puppeteer = require(pp);
  const browser = await puppeteer.launch({ executablePath: exe, headless: "new", protocolTimeout: 9e5, args });
  return {
    driver,
    browser,
    page: async (vp = DESKTOP) => {
      const p = await browser.newPage();
      await p.setViewport(vp.mobile ? { width: vp.width, height: vp.height, isMobile: true, hasTouch: true, deviceScaleFactor: vp.scale || 1 } : { width: vp.width, height: vp.height, deviceScaleFactor: vp.scale || 1 });
      return p;
    },
    close: () => browser.close()
  };
}
var TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg"
};
function serve(root, routes = {}) {
  root = path.resolve(root);
  const R = Object.assign({ "/version.json": '{"build": "local"}' }, routes);
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const u = decodeURIComponent((req.url || "/").split("?")[0]);
      if (u === "/favicon.ico") {
        res.writeHead(204);
        res.end();
        return;
      }
      const p = path.join(root, u.replace(/\/$/, "/index.html"));
      if (R[u] !== void 0 && !(u === "/version.json" && fs.existsSync(p))) {
        res.writeHead(200, { "content-type": TYPES[path.extname(u)] || "text/plain" });
        res.end(R[u]);
        return;
      }
      if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
      fs.createReadStream(p).pipe(res);
    });
    s.listen(0, "127.0.0.1", () => {
      const port = s.address().port;
      ok({ url: `http://127.0.0.1:${port}/`, port, close: () => new Promise((r) => s.close(() => r())) });
    });
  });
}
async function waitFor(page, test, o = {}) {
  const until = Date.now() + (o.timeout ?? 3e4), fn = typeof test === "string" ? `(() => (${test}))()` : test;
  for (; ; ) {
    let v = false;
    try {
      v = typeof fn === "string" ? await page.evaluate(fn) : await page.evaluate(fn, o.arg);
    } catch (e) {
    }
    if (v) return;
    if (Date.now() > until) throw new Error("testkit: timed out waiting for " + (typeof test === "string" ? test : test.toString().slice(0, 120)));
    await sleep(o.every ?? 100);
  }
}
function errorsOf(page, o = {}) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message + " " + ((e.stack || "").split("\n")[1] || "").trim()));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const url = m.location && m.location().url || "";
    if (!o.external && /^Failed to load resource/.test(m.text()) && /^https?:\/\//.test(url) && !/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) return;
    errors.push("console: " + m.text());
  });
  return errors;
}
async function open(kit, o) {
  const page = await kit.page(o.viewport || DESKTOP);
  const errors = errorsOf(page);
  let server, url = o.url || "";
  if (!url) {
    if (!o.root) throw new Error("testkit.open: give a root or a url");
    if (o.serve) {
      server = await serve(o.root, typeof o.serve === "object" ? o.serve : {});
      url = server.url + "index.html";
    } else url = "file://" + path.join(path.resolve(o.root), "index.html");
  }
  if (o.query) url += (url.includes("?") ? "&" : "?") + o.query.replace(/^\?/, "");
  await page.goto(url);
  if (o.storage !== void 0) {
    await page.evaluate((s) => {
      try {
        localStorage.clear();
        for (const k of Object.keys(s || {})) localStorage.setItem(k, typeof s[k] === "string" ? s[k] : JSON.stringify(s[k]));
      } catch (e) {
      }
    }, o.storage);
    await page.reload();
  }
  if (o.ready) await waitFor(page, o.ready, { timeout: o.timeout ?? 6e4 });
  return { page, errors, server, url };
}
async function shot(page, dir, name) {
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name + ".png");
  await page.screenshot({ path: p });
  return p;
}
function finish(name, failures) {
  if (failures.length) {
    console.error(`${name}: FAIL
  ` + failures.slice(0, 60).join("\n  ") + (failures.length > 60 ? `
  …and ${failures.length - 60} more` : ""));
    annotate(name, failures);
    process.exit(1);
  }
  console.log(`${name}: ok`);
}
function annotate(name, failures) {
  if (!process.env.GITHUB_ACTIONS) return;
  for (const f of failures.slice(0, 10)) console.log(`::error title=${name}::` + String(f).replace(/\r?\n/g, " ").slice(0, 900));
}
async function run(name, body) {
  let failures = [];
  try {
    failures = await body() || [];
  } catch (e) {
    failures = ["crashed: " + String(e.stack || e)];
  }
  finish(name, failures);
}
function golden(file, now, o = {}) {
  const update = o.update ?? process.argv.includes("--update");
  if (update || !fs.existsSync(file)) {
    const sorted = {};
    for (const k of Object.keys(now).sort()) sorted[k] = now[k];
    fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + "\n");
    console.log(`golden: wrote ${Object.keys(now).length} values to ${path.basename(file)}`);
    return [];
  }
  const was = JSON.parse(fs.readFileSync(file, "utf8")), out = [];
  for (const k of Object.keys(was)) {
    if (!(k in now)) out.push(`${k}: gone (was ${JSON.stringify(was[k])})`);
    else if (JSON.stringify(was[k]) !== JSON.stringify(now[k])) out.push(`${k}: ${JSON.stringify(was[k])} -> ${JSON.stringify(now[k])}`);
  }
  for (const k of Object.keys(now)) if (!(k in was)) out.push(`${k}: new (${JSON.stringify(now[k])}); run with --update if it's meant`);
  return out;
}
var PAGE = `window.TK = {
  hash(d) { let h = 0x811c9dc5 | 0; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 0x01000193); return (h >>> 0).toString(16).padStart(8, '0'); },
  canvas(c) { if (!c || !c.width || !c.height) return 'empty'; const g = c.getContext('2d', { willReadFrequently: true }); return c.width + 'x' + c.height + ':' + this.hash(g.getImageData(0, 0, c.width, c.height).data); },
  image(img) { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); return this.canvas(c); },
}; true`;
async function diff(kit, a, b, o = {}) {
  const page = await kit.page(DESKTOP);
  try {
    return await page.evaluate(async ([A, B, tone]) => {
      const load = (s) => new Promise((ok, no) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = no;
        i.src = "data:image/png;base64," + s;
      });
      const [ia, ib] = await Promise.all([load(A), load(B)]);
      const px = (i) => {
        const c = document.createElement("canvas");
        c.width = i.width;
        c.height = i.height;
        const g = c.getContext("2d");
        g.drawImage(i, 0, 0);
        return g.getImageData(0, 0, i.width, i.height).data;
      };
      if (ia.width !== ib.width || ia.height !== ib.height) return { width: ia.width, height: ia.height, same: false, maxTone: 255, share: 1, mean: 255 };
      const da = px(ia), db = px(ib);
      let max = 0, over = 0, sum = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
        if (d > max) max = d;
        if (d > tone) over++;
        sum += d;
      }
      const n = da.length / 4;
      return { width: ia.width, height: ia.height, same: max === 0, maxTone: max, share: over / n, mean: sum / n };
    }, [a.toString("base64"), b.toString("base64"), o.tone ?? 8]);
  } finally {
    await page.close();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DESKTOP,
  PAGE,
  PHONE,
  PHONE_WIDE,
  annotate,
  chromePath,
  diff,
  errorsOf,
  finish,
  golden,
  launch,
  open,
  run,
  serve,
  shot,
  sleep,
  waitFor
});
