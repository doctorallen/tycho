// Installing, and staying current: the page's half of an installable game
// (the worker's half is dist/tycho-sw.js). The worker fetches from the
// network first, so a fresh launch is always the latest deploy. A game left
// open (or installed and resumed) looks for a new deploy whenever it comes
// back to the foreground and every fifteen minutes. When a new worker takes
// over, the page learns from version.json which build is live; if it isn't
// the page's own, the game is told (`onNewer`) and decides: reload at once
// (the White Dragon saves and reloads), or wait until nothing would be lost
// and ask (Lodestar). The browser's install pop-up is asked for at a good
// moment (`canAsk`), at most every few days.

export interface PwaOptions {
  /** This page's build, as the deploy stamped it ('__BUILD__' unstamped). */
  build: string;
  /** The worker's script. */
  sw?: string;
  /** How often to look for a new deploy while open, in ms. */
  every?: number;
  /** A newer build has taken over; `newer` is its name from version.json. */
  onNewer?: (newer: string) => void;
  /** Whether now is a good moment for the browser's install pop-up (a tap
   * outside play, say). Without it the pop-up is never asked for. */
  canAsk?: () => boolean;
  /** Storage key remembering when the pop-up was last asked for. */
  askedKey?: string;
  /** How long before asking again after it was turned down, in ms. */
  askEvery?: number;
  /** The browser said it can install (redraw a menu that offers it). */
  onInstallable?: () => void;
  /** Installed (say so). */
  onInstalled?: () => void;
  /** The session-storage key that remembers a reload was an update. */
  updatedKey?: string;
}

export class Pwa {
  o: PwaOptions;
  reg: ServiceWorkerRegistration | null = null;
  /** The browser's install prompt, while it can be shown. */
  prompt: (Event & { prompt(): Promise<void>; userChoice: Promise<unknown> }) | null = null;
  /** The live build, from version.json at start (null until known). */
  live: string | null = null;
  /** A newer build that has taken over, waiting for the game to load it. */
  newer: string | null = null;
  reloading = false;
  constructor(o: PwaOptions) { this.o = o; }

  /** Starts it all: the install prompt, the live build, the worker. Only
   * over http(s): opened from a file there's no worker. */
  start(): this {
    const o = this.o;
    addEventListener('beforeinstallprompt', (e) => { this.prompt = e as Pwa['prompt']; if (o.onInstallable) o.onInstallable(); });
    if (o.canAsk) {
      const ask = () => {
        if (!this.prompt || this.installed() || !o.canAsk!()) return;
        const key = o.askedKey || 'tycho.installAsked';
        let last = 0;
        try { last = +(localStorage.getItem(key) || 0) || 0; } catch (e) { /* storage unavailable */ }
        if (Date.now() - last < (o.askEvery ?? 3 * 864e5)) return;
        try { localStorage.setItem(key, String(Date.now())); } catch (e) { /* storage unavailable */ }
        this.install();
      };
      addEventListener('pointerup', ask); addEventListener('keyup', ask);
    }
    addEventListener('appinstalled', () => { this.prompt = null; if (o.onInstalled) o.onInstalled(); });
    if (!/^https?:$/.test(location.protocol)) return this;
    this.version().then((v) => { this.live = v; });
    if (!('serviceWorker' in navigator)) return this;
    // (on a first visit the first worker taking over is this build)
    let claimed = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!claimed) { claimed = true; return; }
      if (this.reloading || this.newer) return;
      this.version().then((v) => {
        if (v && v === o.build) return; // already running it
        this.newer = v || 'a new version';
        if (o.onNewer) o.onNewer(this.newer);
      });
    });
    navigator.serviceWorker.register(o.sw || 'sw.js', { updateViaCache: 'none' }).then((reg) => {
      this.reg = reg;
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.check(); });
      setInterval(() => this.check(), o.every ?? 15 * 60 * 1000);
    }).catch(() => { /* no worker: it plays as a page */ });
    return this;
  }
  /** The live build from version.json, or null. */
  version(): Promise<string | null> {
    return fetch('version.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((v) => (v && v.build) || null).catch(() => null);
  }
  /** Looks for a new deploy now. */
  check(): void { if (this.reg) this.reg.update().catch(() => { /* offline */ }); }
  /** Loads the page again onto the new build, remembering it was an update. */
  reload(): void {
    this.reloading = true;
    try { sessionStorage.setItem(this.o.updatedKey || 'tycho.updated', this.newer || '1'); } catch (e) { /* storage unavailable */ }
    location.reload();
  }
  /** After a reload onto a new build: what it was (once), or null. */
  updated(): string | null {
    const key = this.o.updatedKey || 'tycho.updated';
    let was: string | null = null;
    try { was = sessionStorage.getItem(key); sessionStorage.removeItem(key); } catch (e) { /* storage unavailable */ }
    return was;
  }
  installed(): boolean { return matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true; }
  ios(): boolean { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  /** Shows the browser's install prompt, if it can. */
  install(): void {
    if (!this.prompt) return;
    const p = this.prompt;
    p.prompt();
    p.userChoice.finally(() => { this.prompt = null; if (this.o.onInstallable) this.o.onInstallable(); });
  }
}

/** Makes and starts the page's half of an installable game. */
export function start(o: PwaOptions): Pwa { return new Pwa(o).start(); }
