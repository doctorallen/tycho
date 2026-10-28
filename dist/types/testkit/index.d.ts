type Page = any;
type Browser = any;
export interface Viewport {
    width: number;
    height: number;
    mobile?: boolean;
    scale?: number;
}
/** A phone held upright, held sideways, and a desktop window. */
export declare const PHONE: Viewport;
export declare const PHONE_WIDE: Viewport;
export declare const DESKTOP: Viewport;
export declare const sleep: (ms: number) => Promise<void>;
/** The installed Chrome, from $CHROME or the usual places. */
export declare function chromePath(): string | null;
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
export declare function launch(o?: {
    gl?: boolean;
    args?: string[];
    driver?: 'playwright' | 'puppeteer';
}): Promise<Kit>;
export interface Server {
    url: string;
    port: number;
    close(): Promise<void>;
}
/** Serves a folder over http on a free port, as GitHub Pages would. `routes`
 * answer paths of their own first ({ '/version.json': '{"build":"local"}' }),
 * and version.json answers a local build unless the folder has one. */
export declare function serve(root: string, routes?: Record<string, string>): Promise<Server>;
/** Waits until `test` (a function or an expression, run in the page) is
 * true, polling every `every` ms; throws after `timeout` ms. Works the same
 * under either driver. */
export declare function waitFor(page: Page, test: string | ((arg?: unknown) => unknown), o?: {
    timeout?: number;
    every?: number;
    arg?: unknown;
}): Promise<void>;
/** Collects page errors and console errors into a list. A resource from
 * another site that fails to load (a web font, where the network's closed)
 * isn't the game's error and is left out unless `external` is set. */
export declare function errorsOf(page: Page, o?: {
    external?: boolean;
}): string[];
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
export interface Opened {
    page: Page;
    errors: string[];
    server?: Server;
    url: string;
}
/** Opens the game in a fresh page and waits until it's ready. */
export declare function open(kit: Kit, o: OpenOptions): Promise<Opened>;
/** A screenshot into `dir` (made if missing) as name.png. */
export declare function shot(page: Page, dir: string, name: string): Promise<string>;
/** A test's verdict: prints the line and exits non-zero on failure. Under
 * GitHub Actions the first failures are also annotations, which show on the
 * run's page without its log. */
export declare function finish(name: string, failures: string[]): void;
/** Under GitHub Actions, failures as error annotations (the first ten). */
export declare function annotate(name: string, failures: string[]): void;
/** Runs a test's body, turning a crash into a failed verdict (annotated). */
export declare function run(name: string, body: () => Promise<string[] | void>): Promise<void>;
/** Golden values: compares `now` (name -> value) with those kept in `file`,
 * returning a failure for each that changed, appeared or went. With `update`
 * (or --update on the command line) it writes `now` to the file instead. */
export declare function golden(file: string, now: Record<string, unknown>, o?: {
    update?: boolean;
}): string[];
/** Helpers put into a page with page.evaluate(tk.PAGE): `TK.hash(data)` of
 * bytes (FNV-1a, hex), `TK.canvas(c)` of a canvas's pixels (with its size),
 * `TK.image(src)` of an image's. */
export declare const PAGE = "window.TK = {\n  hash(d) { let h = 0x811c9dc5 | 0; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 0x01000193); return (h >>> 0).toString(16).padStart(8, '0'); },\n  canvas(c) { if (!c || !c.width || !c.height) return 'empty'; const g = c.getContext('2d', { willReadFrequently: true }); return c.width + 'x' + c.height + ':' + this.hash(g.getImageData(0, 0, c.width, c.height).data); },\n  image(img) { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); return this.canvas(c); },\n}; true";
export interface Diff {
    width: number;
    height: number;
    same: boolean;
    maxTone: number;
    share: number;
    mean: number;
}
/** Compares two PNG pictures (buffers) of the same size, tone by tone: the
 * largest difference in any channel (0..255), the share of pixels that differ
 * by more than `tone`, and the mean difference. In a page of its own. */
export declare function diff(kit: Kit, a: Buffer, b: Buffer, o?: {
    tone?: number;
}): Promise<Diff>;
export {};
