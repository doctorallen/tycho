// The interface kit: the HUD's and the screens' machinery, without their
// looks. Toasts (a line or two of news over the game, gone after a while;
// hints that wait their turn and are never shown twice), lines rising over
// a point in the world (what Use just got), buttons wired by their data
// attributes, and a screen's buttons run from one delegated handler (an act
// by name, an argument, a confirming tap, the taps a screen ignores just
// after it opens). The games' skins (the CSS, the fonts, the words) stay
// theirs: what's made here is plain elements with the classes a game gives.
//
// Two games' toasts are in, each reachable by its options: the White
// Dragon's (a short list on game time, the whole of it redrawn on each
// change, the same words again soon keeping the last one longer, faded by
// opacity near the end) and Lodestar's (elements added and taken away on
// their own timers, the same words on screen giving way to the new, a CSS
// animation over each one's life, hints queued while a screen is open).

/** A toast shown (in the list that's redrawn whole). */
export interface ToastItem { text: string; kind: string; t: number }

export interface ToastOptions {
  /** Where they go. */
  box(): HTMLElement | null;
  /** At most this many on screen; the oldest goes for a new one. */
  most?: number | (() => number);
  /** Seconds on screen (by its words and kind). */
  life?: number | ((text: string, kind: string) => number);
  /** The clock (seconds) a redrawn list keeps time by; real time without it. */
  clock?: () => number;
  /** A toast's class. */
  cls?: (kind: string) => string;
  /** The words are HTML (else text). */
  html?: boolean;
  /** Redraw the whole list on each change, timed by `tick()` (the White
   * Dragon's); else each toast is an element of its own on its own timer
   * (Lodestar's). */
  redraw?: boolean;
  /** Redrawn: shown fully until this many seconds old, then faded (opacity
   * 0, the CSS easing it). */
  fadeAt?: number;
  /** Redrawn: the same words as the last within this many seconds keep the
   * last one instead (its time renewed). */
  merge?: number;
  /** Elements: the same words already on screen give way to the new. */
  replace?: boolean;
  /** Elements: the life set as the element's animation-duration (the CSS
   * fades it). */
  animate?: boolean;
  /** Kinds that wait their turn for room on screen (hints). */
  waits?: (kind: string) => boolean;
  /** While true, none of those waiting is shown (a screen is open). */
  held?: () => boolean;
  /** One that waited is never shown twice (until `forget()`). */
  once?: boolean;
  /** After each is shown. */
  after?: () => void;
}

/** Toasts. `show(text, kind)` from anywhere; `tick()` every frame (a
 * redrawn list's time, and the queue); `clear(fresh)` when a screen opens. */
export class Toasts {
  o: ToastOptions;
  /** A redrawn list's toasts, oldest first. */
  list: ToastItem[] = [];
  /** Those waiting their turn. */
  queue: { text: string; kind: string }[] = [];
  /** Words that waited and have been shown. */
  seen = new Set<string>();
  private kinds = new WeakMap<Element, string>();
  constructor(o: ToastOptions) { this.o = o; }

  now(): number { return this.o.clock ? this.o.clock() : performance.now() / 1000; }
  most(): number { const m = this.o.most; return m === undefined ? Infinity : typeof m === 'function' ? m() : m; }
  life(text: string, kind: string): number { const l = this.o.life; return l === undefined ? 4 : typeof l === 'function' ? l(text, kind) : l; }
  cls(kind: string): string { return this.o.cls ? this.o.cls(kind) : 'toast' + (kind ? ' ' + kind : ''); }

  /** A toast: shown now, or (a kind that waits) queued, unless it's waiting
   * already or (once) has been shown. */
  show(text: string, kind = ''): void {
    const o = this.o;
    if (o.waits && o.waits(kind)) {
      if (this.seen.has(text) || this.queue.some((h) => h.text === text)) return;
      this.queue.push({ text, kind });
      this.pump();
      return;
    }
    this.put(text, kind);
  }
  /** Shown now, whatever its kind. */
  put(text: string, kind = ''): void {
    const o = this.o;
    if (o.redraw) {
      const now = this.now(), last = this.list[this.list.length - 1];
      if (o.merge !== undefined && last && last.text === text && now - last.t < o.merge) { last.t = now; return; }
      this.list.push({ text, kind, t: now });
      if (this.list.length > this.most()) this.list.shift();
      this.draw();
      if (o.after) o.after();
      return;
    }
    const box = o.box();
    if (!box) return;
    if (o.replace) for (const c of Array.from(box.children)) if (c.textContent === text) c.remove();
    const el = document.createElement('div');
    el.className = this.cls(kind);
    if (o.html) el.innerHTML = text; else el.textContent = text;
    el.dataset.born = String(Date.now());
    this.kinds.set(el, kind);
    const secs = this.life(text, kind);
    if (o.animate) el.style.animationDuration = secs + 's';
    box.appendChild(el);
    while (box.children.length > this.most()) (box.firstChild as ChildNode).remove();
    if (o.after) o.after();
    if (o.waits && o.waits(kind) && o.once) this.seen.add(text);
    setTimeout(() => { el.remove(); this.pump(); }, secs * 1000);
  }
  /** A redrawn list, drawn. */
  draw(): void {
    const box = this.o.box();
    if (!box) return;
    const esc = (t: string) => (this.o.html ? t : t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string));
    box.innerHTML = this.list.map((t) => `<div class="${this.cls(t.kind)}" data-t="${t.t}">${esc(t.text)}</div>`).join('');
  }
  /** Every frame: a redrawn list fades and lets go of its oldest when its
   * time's up; and any waiting are shown if there's room. */
  tick(): void {
    const o = this.o;
    if (o.redraw) {
      const box = o.box(), now = this.now();
      if (box && o.fadeAt !== undefined) for (const n of Array.from(box.children) as HTMLElement[]) n.style.opacity = (now - +(n.dataset.t as string) > o.fadeAt ? 0 : 1) as unknown as string;
      if (this.list.length && now - this.list[0].t > this.life(this.list[0].text, this.list[0].kind)) { this.list.shift(); this.draw(); }
    }
    if (this.queue.length) this.pump();
  }
  /** Those waiting, shown while there's room (and nothing holds them). */
  pump(): void {
    if (this.o.held && this.o.held()) return;
    const box = this.o.box();
    if (!box) return;
    while (this.queue.length && box.children.length < this.most()) { const h = this.queue.shift() as { text: string; kind: string }; this.put(h.text, h.kind); }
  }
  /** Everything on screen goes (a screen opened): news is dropped; one of
   * the kinds that wait, shown less than `fresh` seconds ago, goes back to
   * the front of the queue to be shown after, and the rest count as read. */
  clear(fresh = 0): void {
    const box = this.o.box();
    if (this.o.redraw) { this.list = []; this.draw(); return; }
    if (!box) return;
    for (const t of Array.from(box.children) as HTMLElement[]) {
      const kind = this.kinds.get(t) || '';
      if (!(this.o.waits && this.o.waits(kind))) { t.remove(); continue; }
      if (Date.now() - +(t.dataset.born as string) < fresh * 1000) { this.seen.delete(t.textContent as string); this.queue.unshift({ text: t.textContent as string, kind }); }
      t.remove();
    }
  }
  /** Forgets which have been shown (a new world: its hints again). */
  forget(): void { this.seen.clear(); }
}

// ---------------------------------------------------------------------------
// Lines rising over a point in the world
// ---------------------------------------------------------------------------

/** A rising line: where, when, which of how many, and the game's own fields. */
export interface RisingLine { x: number; y: number; t: number; i: number; of: number; kind?: string; [k: string]: unknown }
export interface RisingOptions {
  /** The line's inner HTML. */
  line: (g: RisingLine) => string;
  /** The clock, in seconds. */
  clock: () => number;
  /** Seconds a line lasts (2.4), when it starts to fade (1.8) and how long it
   * takes (0.6). */
  life?: number; fadeAt?: number; fadeFor?: number;
  /** px a second it rises (12), px between lines (21), seconds between them
   * coming (0.12), px left of the point (34). */
  rise?: number; gap?: number; stagger?: number; left?: number;
  /** The class of each (its kind added). */
  cls?: string;
}
/** What came out of something, a line each, stacked over it (the first on
 * top), rising and fading. `add(x, y, lines)` where; `html(at)` every frame,
 * with `at(x, y)` the screen's px for a world point. */
export class Rising {
  o: RisingOptions;
  list: RisingLine[] = [];
  constructor(o: RisingOptions) { this.o = o; }
  add(x: number, y: number, lines: Record<string, unknown>[]): void {
    const t = this.o.clock(), st = this.o.stagger ?? 0.12;
    lines.forEach((g, i) => this.list.push(Object.assign({ x, y, t: t + i * st, i, of: lines.length }, g) as RisingLine));
  }
  html(at: (x: number, y: number) => [number, number]): string {
    const o = this.o, now = o.clock(), life = o.life ?? 2.4, fadeAt = o.fadeAt ?? 1.8, fadeFor = o.fadeFor ?? 0.6, rise = o.rise ?? 12, gap = o.gap ?? 21, left = o.left ?? 34, cls = o.cls ?? 'gain';
    this.list = this.list.filter((g) => now - g.t < life);
    let h = '';
    for (const g of this.list) {
      const a = now - g.t;
      if (a < 0) continue;
      const [sx, sy] = at(g.x, g.y), y = sy - (g.of - 1 - g.i) * gap - a * rise, op = a > fadeAt ? Math.max(0, 1 - (a - fadeAt) / fadeFor) : 1;
      h += `<div class="${cls}${g.kind ? ' ' + g.kind : ''}" style="left:${(sx - left).toFixed(1)}px;top:${y.toFixed(1)}px;opacity:${op.toFixed(2)}">${o.line(g)}</div>`;
    }
    return h;
  }
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

/** Wires buttons by their data attributes: for each key, every `tag` under
 * root with data-<key> runs handler(its value, the element) when clicked. A
 * key may go on with more of a selector (`'job:not([data-say])'`). Keys are
 * wired in order, so a later one takes a button that has both. */
export function bind(root: ParentNode, handlers: Record<string, (value: string, el: HTMLElement) => void>, tag = 'button'): void {
  for (const key of Object.keys(handlers)) {
    const m = /^([a-z0-9-]+)(.*)$/.exec(key) as RegExpExecArray, name = m[1], camel = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    root.querySelectorAll<HTMLElement>(`${tag}[data-${name}]${m[2]}`).forEach((b) => (b.onclick = () => handlers[key](b.dataset[camel] as string, b)));
  }
}

export interface ActsOptions {
  /** The acts, by the name in data-act (or a function giving them, if the
   * game fills them in later). */
  acts: Record<string, (arg: string | undefined, el: HTMLElement) => void> | (() => Record<string, (arg: string | undefined, el: HTMLElement) => void>);
  /** While true taps are ignored (a screen just opened). */
  guard?: () => boolean;
  /** A confirming button was armed (by its first tap). */
  armed?: (el: HTMLElement) => void;
  /** Before an act runs (a tap's sound, say). */
  onAct?: (name: string, el: HTMLElement) => void;
}
/** A screen's buttons, from one handler: a tap on anything with data-act
 * runs that act with its data-arg (unless it's disabled, or the guard's
 * up). One with data-confirm asks once: the first tap arms it (its words
 * become data-confirm's, any other armed button goes back), the second runs
 * it. */
export class Acts {
  o: ActsOptions;
  constructor(o: ActsOptions) { this.o = o; }
  /** Listens for taps on el (a screen, or the document). */
  listen(el: EventTarget, type = 'click'): this { el.addEventListener(type, (e) => this.tap(e)); return this; }
  tap(e: Event): void {
    const el = e.target && (e.target as Element).closest ? ((e.target as Element).closest('[data-act]') as HTMLElement | null) : null;
    if (!el || (el as HTMLButtonElement).disabled || (this.o.guard && this.o.guard())) return;
    if (el.dataset.confirm && !el.classList.contains('armed')) {
      for (const o of Array.from(document.querySelectorAll<HTMLElement>('.armed'))) { o.classList.remove('armed'); o.textContent = o.dataset.label as string; }
      el.dataset.label = el.textContent as string;
      el.classList.add('armed'); el.textContent = el.dataset.confirm;
      if (this.o.armed) this.o.armed(el);
      return;
    }
    const acts = typeof this.o.acts === 'function' ? this.o.acts() : this.o.acts, name = el.dataset.act as string, fn = acts[name];
    if (fn) { if (this.o.onAct) this.o.onAct(name, el); fn(el.dataset.arg, el); }
  }
}
