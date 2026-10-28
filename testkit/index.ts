// The test kit (dist/testkit.cjs): what every game's headless tests share.
// Launching Chromium (Playwright where it's installed, or puppeteer-core with
// the Chrome in $CHROME), serving the game over http or opening it from a
// file, viewports for a phone held upright or sideways and a desktop,
// gathering page errors, waiting for the game, screenshots, golden values
// kept in a JSON file, pictures compared tone by tone, and a test's verdict.
//
//   const tk = require('../vendor/tycho/dist/testkit.cjs');
//   const kit = await tk.launch({ gl: true });
//   const { page, errors } = await tk.open(kit, { root: ROOT, viewport: tk.PHONE_WIDE, ready: '!!window.Game' });
//
// The browser driver is the game's (its node_modules), found from where the
// test runs, so Tycho itself depends on neither.
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Page = any;
type Browser = any;

export interface Viewport { width: number; height: number; mobile?: boolean; scale?: number }
/** A phone held upright, held sideways, and a desktop window. */
export const PHONE: Viewport = { width: 390, height: 844, mobile: true, scale: 3 };
export const PHONE_WIDE: Viewport = { width: 844, height: 390, mobile: true, scale: 3 };
export const DESKTOP: Viewport = { width: 1280, height: 800, mobile: false, scale: 1 };

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function find(name: string): string | null {
  for (const from of [process.cwd(), __dirname]) {
    try { return require.resolve(name, { paths: [from] }); } catch (e) { /* not here */ }
  }
  try { return require.resolve(name); } catch (e) { return null; }
}

/** The installed Chrome, from $CHROME or the usual places. */
export function chromePath(): string | null {
  if (process.env.CHROME) return process.env.CHROME;
  for (const p of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium']) if (fs.existsSync(p)) return p;
  return null;
}

// A Playwright page that also takes the puppeteer-style calls the games'
// tests were written with: evaluate with several arguments,
// waitForFunction(fn, options, ...args), evaluateOnNewDocument, and
// setViewport for the size alone.
function puppeteerish(p: Page): Page {
  const evaluate = p.evaluate.bind(p), waitForFunction = p.waitForFunction.bind(p);
  const pack = (fn: unknown, args: unknown[]) => (args.length <= 1 || typeof fn !== 'function'
    ? [fn, ...args]
    : [({ s, a }: { s: string; a: unknown[] }) => (0, eval)('(' + s + ')')(...a), { s: (fn as () => unknown).toString(), a: args }]);
  p.evaluate = (fn: unknown, ...args: unknown[]) => evaluate(...pack(fn, args));
  p.waitForFunction = (fn: unknown, o?: { timeout?: number; polling?: number | string }, ...args: unknown[]) => {
    const [f, a] = pack(fn, args);
    return waitForFunction(f, a, { timeout: o && o.timeout, polling: o && typeof o.polling === 'number' ? o.polling : undefined });
  };
  if (!p.evaluateOnNewDocument) p.evaluateOnNewDocument = (fn: unknown, ...args: unknown[]) => p.addInitScript(...pack(fn, args));
  if (!p.setViewport) p.setViewport = (vp: { width: number; height: number }) => p.setViewportSize({ width: vp.width, height: vp.height });
  return p;
}

export interface Kit {
  driver: 'playwright' | 'puppeteer';
  browser: Browser;
  /** A new page at a viewport. */
  page(vp?: Viewport): Promise<Page>;
  close(): Promise<void>;
}

/** Launches the browser. `gl`: with WebGL2 in software (SwiftShader), so a GPU
 * renderer draws; without, the GPU is off and the 2D path runs. `driver`
 * (or $TYCHO_DRIVER) picks one; by default it's puppeteer-core when $CHROME is
 * set and the game has it (as CI does), otherwise Playwright, otherwise
 * puppeteer-core with whatever Chrome is installed. */
export async function launch(o: { gl?: boolean; args?: string[]; driver?: 'playwright' | 'puppeteer' } = {}): Promise<Kit> {
  const args = ['--allow-file-access-from-files', '--no-sandbox', '--autoplay-policy=no-user-gesture-required']
    .concat(o.gl ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--disable-gpu'], o.args || []);
  const pp = find('puppeteer-core'), pw = find('playwright');
  let driver = o.driver || (process.env.TYCHO_DRIVER as Kit['driver'] | undefined);
  if (!driver) driver = process.env.CHROME && pp ? 'puppeteer' : pw ? 'playwright' : 'puppeteer';
  if (driver === 'playwright') {
    if (!pw) throw new Error('testkit: Playwright is not installed');
    const { chromium } = require(pw);
    const browser = await chromium.launch({ args, executablePath: process.env.CHROME || undefined });
    return {
      driver, browser,
      page: async (vp = DESKTOP) => puppeteerish(await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale || 1, isMobile: !!vp.mobile, hasTouch: !!vp.mobile })),
      close: () => browser.close(),
    };
  }
  if (!pp) throw new Error('testkit: neither Playwright nor puppeteer-core is installed');
  const exe = chromePath();
  if (!exe) throw new Error('testkit: no Chrome found: set CHROME to the browser executable');
  const puppeteer = require(pp);
  const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', protocolTimeout: 900000, args });
  return {
    driver, browser,
    page: async (vp = DESKTOP) => {
      const p = await browser.newPage();
      await p.setViewport(vp.mobile ? { width: vp.width, height: vp.height, isMobile: true, hasTouch: true, deviceScaleFactor: vp.scale || 1 } : { width: vp.width, height: vp.height, deviceScaleFactor: vp.scale || 1 });
      return p;
    },
    close: () => browser.close(),
  };
}

const TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
};

export interface Server { url: string; port: number; close(): Promise<void> }
/** Serves a folder over http on a free port, as GitHub Pages would. `routes`
 * answer paths of their own first ({ '/version.json': '{"build":"local"}' }),
 * and version.json answers a local build unless the folder has one. */
export function serve(root: string, routes: Record<string, string> = {}): Promise<Server> {
  root = path.resolve(root);
  const R = Object.assign({ '/version.json': '{"build": "local"}' }, routes);
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const u = decodeURIComponent((req.url || '/').split('?')[0]);
      if (u === '/favicon.ico') { res.writeHead(204); res.end(); return; }
      const p = path.join(root, u.replace(/\/$/, '/index.html'));
      if (R[u] !== undefined && !(u === '/version.json' && fs.existsSync(p))) { res.writeHead(200, { 'content-type': TYPES[path.extname(u)] || 'text/plain' }); res.end(R[u]); return; }
      if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as { port: number }).port;
      ok({ url: `http://127.0.0.1:${port}/`, port, close: () => new Promise((r) => s.close(() => r())) });
    });
  });
}

/** Waits until `test` (a function or an expression, run in the page) is
 * true, polling every `every` ms; throws after `timeout` ms. Works the same
 * under either driver. */
export async function waitFor(page: Page, test: string | ((arg?: unknown) => unknown), o: { timeout?: number; every?: number; arg?: unknown } = {}): Promise<void> {
  const until = Date.now() + (o.timeout ?? 30000), fn = typeof test === 'string' ? `(() => (${test}))()` : test;
  for (;;) {
    let v: unknown = false;
    try { v = typeof fn === 'string' ? await page.evaluate(fn) : await page.evaluate(fn, o.arg); } catch (e) { /* the page is loading */ }
    if (v) return;
    if (Date.now() > until) throw new Error('testkit: timed out waiting for ' + (typeof test === 'string' ? test : test.toString().slice(0, 120)));
    await sleep(o.every ?? 100);
  }
}

/** Collects page errors and console errors into a list. A resource from
 * another site that fails to load (a web font, where the network's closed)
 * isn't the game's error and is left out unless `external` is set. */
export function errorsOf(page: Page, o: { external?: boolean } = {}): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(e.message + ' ' + ((e.stack || '').split('\n')[1] || '').trim()));
  page.on('console', (m: { type(): string; text(): string; location?(): { url?: string } }) => {
    if (m.type() !== 'error') return;
    const url = (m.location && m.location().url) || '';
    if (!o.external && /^Failed to load resource/.test(m.text()) && /^https?:\/\//.test(url) && !/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) return;
    errors.push('console: ' + m.text());
  });
  return errors;
}

export interface OpenOptions {
  /** The game's folder (opened from a file, or served when `serve` is set). */
  root?: string;
  /** Or a page to go to. */
  url?: string;
  /** Serve `root` over http (installable apps, fetches) rather than file://. */
  serve?: boolean | Record<string, string>;
  query?: string;
  viewport?: Viewport;
  /** localStorage to start from: null clears it; an object clears it and sets
   * each key (values not strings are written as JSON). Leave undefined to
   * keep it. The page loads once, the storage is set, then it reloads. */
  storage?: null | Record<string, unknown>;
  /** What says the game is ready (an expression, or a function run in the page). */
  ready?: string | (() => unknown);
  timeout?: number;
}
export interface Opened { page: Page; errors: string[]; server?: Server; url: string }

/** Opens the game in a fresh page and waits until it's ready. */
export async function open(kit: Kit, o: OpenOptions): Promise<Opened> {
  const page = await kit.page(o.viewport || DESKTOP);
  const errors = errorsOf(page);
  let server: Server | undefined, url = o.url || '';
  if (!url) {
    if (!o.root) throw new Error('testkit.open: give a root or a url');
    if (o.serve) { server = await serve(o.root, typeof o.serve === 'object' ? o.serve : {}); url = server.url + 'index.html'; }
    else url = 'file://' + path.join(path.resolve(o.root), 'index.html');
  }
  if (o.query) url += (url.includes('?') ? '&' : '?') + o.query.replace(/^\?/, '');
  await page.goto(url);
  if (o.storage !== undefined) {
    await page.evaluate((s: Record<string, unknown> | null) => {
      try { localStorage.clear(); for (const k of Object.keys(s || {})) localStorage.setItem(k, typeof s![k] === 'string' ? (s![k] as string) : JSON.stringify(s![k])); } catch (e) { /* no storage */ }
    }, o.storage);
    await page.reload();
  }
  if (o.ready) await waitFor(page, o.ready, { timeout: o.timeout ?? 60000 });
  return { page, errors, server, url };
}

/** A screenshot into `dir` (made if missing) as name.png. */
export async function shot(page: Page, dir: string, name: string): Promise<string> {
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name + '.png');
  await page.screenshot({ path: p });
  return p;
}

/** A test's verdict: prints the line and exits non-zero on failure. */
export function finish(name: string, failures: string[]): void {
  if (failures.length) {
    console.error(`${name}: FAIL\n  ` + failures.slice(0, 60).join('\n  ') + (failures.length > 60 ? `\n  …and ${failures.length - 60} more` : ''));
    process.exit(1);
  }
  console.log(`${name}: ok`);
}

/** Golden values: compares `now` (name -> value) with those kept in `file`,
 * returning a failure for each that changed, appeared or went. With `update`
 * (or --update on the command line) it writes `now` to the file instead. */
export function golden(file: string, now: Record<string, unknown>, o: { update?: boolean } = {}): string[] {
  const update = o.update ?? process.argv.includes('--update');
  if (update || !fs.existsSync(file)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(now).sort()) sorted[k] = now[k];
    fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n');
    console.log(`golden: wrote ${Object.keys(now).length} values to ${path.basename(file)}`);
    return [];
  }
  const was = JSON.parse(fs.readFileSync(file, 'utf8')), out: string[] = [];
  for (const k of Object.keys(was)) {
    if (!(k in now)) out.push(`${k}: gone (was ${JSON.stringify(was[k])})`);
    else if (JSON.stringify(was[k]) !== JSON.stringify(now[k])) out.push(`${k}: ${JSON.stringify(was[k])} -> ${JSON.stringify(now[k])}`);
  }
  for (const k of Object.keys(now)) if (!(k in was)) out.push(`${k}: new (${JSON.stringify(now[k])}); run with --update if it's meant`);
  return out;
}

/** Helpers put into a page with page.evaluate(tk.PAGE): `TK.hash(data)` of
 * bytes (FNV-1a, hex), `TK.canvas(c)` of a canvas's pixels (with its size),
 * `TK.image(src)` of an image's. */
export const PAGE = `window.TK = {
  hash(d) { let h = 0x811c9dc5 | 0; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 0x01000193); return (h >>> 0).toString(16).padStart(8, '0'); },
  canvas(c) { if (!c || !c.width || !c.height) return 'empty'; const g = c.getContext('2d', { willReadFrequently: true }); return c.width + 'x' + c.height + ':' + this.hash(g.getImageData(0, 0, c.width, c.height).data); },
  image(img) { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); return this.canvas(c); },
}; true`;

export interface Diff { width: number; height: number; same: boolean; maxTone: number; share: number; mean: number }
/** Compares two PNG pictures (buffers) of the same size, tone by tone: the
 * largest difference in any channel (0..255), the share of pixels that differ
 * by more than `tone`, and the mean difference. In a page of its own. */
export async function diff(kit: Kit, a: Buffer, b: Buffer, o: { tone?: number } = {}): Promise<Diff> {
  const page = await kit.page(DESKTOP);
  try {
    return await page.evaluate(async ([A, B, tone]: [string, string, number]) => {
      const load = (s: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'data:image/png;base64,' + s; });
      const [ia, ib] = await Promise.all([load(A), load(B)]);
      const px = (i: HTMLImageElement) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d')!; g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
      if (ia.width !== ib.width || ia.height !== ib.height) return { width: ia.width, height: ia.height, same: false, maxTone: 255, share: 1, mean: 255 };
      const da = px(ia), db = px(ib); let max = 0, over = 0, sum = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
        if (d > max) max = d; if (d > tone) over++; sum += d;
      }
      const n = da.length / 4;
      return { width: ia.width, height: ia.height, same: max === 0, maxTone: max, share: over / n, mean: sum / n };
    }, [a.toString('base64'), b.toString('base64'), o.tone ?? 8]);
  } finally { await page.close(); }
}
