// Dev tools, for the people making a game: testing switches kept in the
// browser's storage under a key of their own (never in the save), shown when
// the address has ?dev (or once they've been shown), and flags read from the
// address (?nogl, ?perf); a log of what happened under the hood that any game
// can write to (Notes); and the dev drawer (Drawer): a small, dense, dark
// console docked at the side while the game runs on behind it and stays in
// sight, with tabs the game registers (each refreshed a few times a second
// without losing where it's scrolled to, what has focus or what's half
// typed), a line of frame times, overlay switches, the events, small pieces
// for what every tab shows (bars, tables, sections, steppers, toggles,
// choices), and a tag always on screen while a setting that changes play is
// off its default. It was Merryfolk's drawer, made for any game.
//
// The drawer knows no game: its tabs, their words and what they do are the
// game's, passed in. Its look is a compact dark default of its own, put in
// the page once with the prefix the game gives (every class and id carries
// it), which a game may restyle or leave out. A mind from Tycho.inspect.mind
// with the drawer's prefix is styled too, and its buttons (data-<prefix>sel,
// data-<prefix>do) work in it.
import { get, set } from './save';
import { esc } from './inspect';

/** Is `name` a flag in the address (?name or &name)? */
export function query(name: string, search: string = typeof location !== 'undefined' ? location.search : ''): boolean {
  return new RegExp('[?&]' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(search);
}

/** A set of dev switches: `s` holds them (over `defaults`), `load()` reads
 * them (and, with ?dev in the address, remembers that they're shown),
 * `save()` keeps them, `shown()` says whether the dev settings show. */
export class Flags<S extends Record<string, unknown> = Record<string, unknown>> {
  key: string; s: S & { shown?: boolean };
  constructor(key: string, defaults: S) { this.key = key; this.s = Object.assign({}, defaults); }
  load(): this {
    Object.assign(this.s, get<Record<string, unknown>>(this.key, {}) || {});
    if (query('dev') && !this.s.shown) { this.s.shown = true; this.save(); }
    return this;
  }
  save(): void { set(this.key, this.s); }
  shown(): boolean { return query('dev') || !!this.s.shown; }
}

// ---------------------------------------------------------------------------
// Notes: what happened, for the events
// ---------------------------------------------------------------------------

/** Something that happened, as the events show it. `impact` (0 to 1, how
 * much it matters to the story of the place) is room for the events by
 * impact (docs/events.md): shown when an event has one. */
export interface DevEvent { t: number; kind: string; text: string; who?: string | string[]; place?: string; impact?: number; html?: boolean; data?: unknown }
export interface NotesOptions {
  /** Kept, newest first (600). */
  most?: number;
  /** A note's time (else seconds since the page opened). */
  clock?: () => number;
}
/** A log any game can write to (a game without a drawer too): `note(kind,
 * text)` from anywhere; the newest first in `list`, the last `most` kept;
 * nothing's noted while `paused`. `count` rises with every note. */
export class Notes {
  o: NotesOptions;
  list: DevEvent[] = [];
  paused = false;
  count = 0;
  constructor(o: NotesOptions = {}) { this.o = o; }
  note(kind: string, text: string, more?: Partial<DevEvent>): DevEvent | null {
    if (this.paused) return null;
    const t = this.o.clock ? this.o.clock() : (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
    const e = Object.assign({ t, kind, text }, more) as DevEvent;
    this.list.unshift(e); this.count++;
    const most = this.o.most ?? 600;
    if (this.list.length > most) this.list.length = most;
    return e;
  }
  clear(): void { this.list = []; this.count++; }
  /** Drops what's later than t (the clock went back). */
  rewind(t: number): void { const n = this.list.length; this.list = this.list.filter((e) => e.t <= t); if (this.list.length !== n) this.count++; }
}

// ---------------------------------------------------------------------------
// The pieces every tab shows
// ---------------------------------------------------------------------------

/** Text made safe for an attribute in double quotes. */
function attr(t: unknown): string { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string); }
/** A data attribute's name in dataset's spelling (data-my-devset: myDevset). */
function camel(name: string): string { return name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()); }

export interface StepperOptions {
  /** The setting it changes (data-<prefix>set): what the drawer's `set` hears. */
  key: string;
  value: number | string;
  label?: string;
  /** The values to step through, in order; else numbers by `step` (1, or
   * several steps, each its own pair of buttons, the biggest outermost),
   * between min and max, or round them with `wrap`. */
  values?: (number | string)[];
  step?: number | number[];
  min?: number; max?: number; wrap?: boolean;
  /** Its default: off it, it's marked, with a button back (else the
   * drawer's `play` table's, if it's there). */
  def?: unknown;
  /** The value as words, and a step's (for several steps). */
  fmt?(v: number | string): string;
  stepWord?(s: number): string;
  title?: string;
}
export interface ToggleOptions { key: string; on: boolean; label: string; title?: string; def?: boolean }
export interface ChoiceOptions { key: string; value: unknown; options: (unknown | [unknown, string])[]; label?: string; def?: unknown }
export interface ButtonOptions { arg?: string; title?: string; on?: boolean; disabled?: boolean; cls?: string }

/** The small pieces of HTML a dev tab is made of, with their prefix. Bars,
 * a grid of bars, sections, lines, hints, rows of chips, tables, buttons
 * (data-<prefix>act), links to someone (data-<prefix>sel), and the controls
 * that change a setting (data-<prefix>set with its new value in
 * data-<prefix>to): steppers (never sliders: a thumb scrolling past can't
 * move one), toggles and choices, each marked while it's off its default. */
export class Bits {
  readonly P: string;
  /** Each setting's default where one's known (steppers, toggles and
   * choices off theirs are marked): the drawer fills it from its `play`. */
  defaults: Record<string, unknown> = {};
  constructor(prefix = 'dev') { this.P = prefix; }
  esc(t: unknown): string { return esc(t); }
  attr(t: unknown): string { return attr(t); }
  /** A number to d places, or – if it isn't one. */
  num(v: unknown, d = 2): string { return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '–'; }
  /** Is v off its default (def, or the known one)? */
  off(key: string, v: unknown, def?: unknown): boolean {
    const d = def !== undefined ? def : this.defaults[key];
    if (d === undefined) return false;
    return JSON.stringify(v === undefined ? d : v) !== JSON.stringify(d);
  }
  /** A bar 0..max (1): warm over 0.4 and hot over 0.7 if `hot`, or a color. */
  bar(v: number, o: { hot?: boolean; color?: string; max?: number } = {}): string {
    const f = Math.max(0, Math.min(1, (v || 0) / (o.max || 1)));
    const cls = o.hot && f > 0.7 ? 'hot' : o.hot && f > 0.4 ? 'warm' : '';
    return `<span class="${this.P}-bar"><i style="width:${Math.round(f * 100)}%${o.color ? ';background:' + o.color : ''}"${cls ? ` class="${cls}"` : ''}></i></span>`;
  }
  /** A grid of bars: each row its label, its bar and its number (or text). */
  bars(rows: [string, number, { hot?: boolean; color?: string; max?: number; text?: string }?][]): string {
    return `<div class="${this.P}-bars">` + rows.map(([k, v, o = {}]) => `<span>${esc(k)}</span>${this.bar(v, o)}<span class="${this.P}-num">${o.text !== undefined ? o.text : this.num(v)}</span>`).join('') + '</div>';
  }
  section(title: string, small?: string): string { return `<h5>${title}${small ? ` <small>${small}</small>` : ''}</h5>`; }
  kv(html: string): string { return `<div class="${this.P}-kv">${html}</div>`; }
  hint(html: string): string { return `<p class="${this.P}-hint">${html}</p>`; }
  chips(html: string): string { return `<div class="${this.P}-chips">${html}</div>`; }
  /** A table: its heads, and rows of cells (HTML), each row with a class if
   * it's given as { cells, cls }; the columns in `nums` are numbers. */
  table(heads: string[], rows: (string[] | { cells: string[]; cls?: string })[], o: { nums?: number[] } = {}): string {
    const nums = new Set(o.nums || []), td = (c: string, i: number) => `<td${nums.has(i) ? ' class="num"' : ''}>${c}</td>`;
    return `<table class="${this.P}-table">` + (heads.length ? '<tr>' + heads.map((h, i) => `<th${nums.has(i) ? ' class="num"' : ''}>${h}</th>`).join('') + '</tr>' : '')
      + rows.map((r) => { const cells = Array.isArray(r) ? r : r.cells, cls = Array.isArray(r) ? '' : r.cls || ''; return `<tr${cls ? ` class="${cls}"` : ''}>` + cells.map(td).join('') + '</tr>'; }).join('') + '</table>';
  }
  /** A button that runs one of the drawer's acts, with its argument. */
  button(act: string, label: string, o: ButtonOptions = {}): string {
    const P = this.P;
    return `<button data-${P}act="${attr(act)}"${o.arg !== undefined ? ` data-${P}arg="${attr(o.arg)}"` : ''}${o.title ? ` title="${attr(o.title)}"` : ''}${o.disabled ? ' disabled' : ''} class="${[o.on ? 'on' : '', o.cls || ''].join(' ').trim()}">${label}</button>`;
  }
  /** Someone's name, a link that picks them. */
  who(id: string, label: string): string { return `<a data-${this.P}sel="${attr(id)}">${esc(label)}</a>`; }
  private setter(key: string, to: unknown, label: string, cls = '', more = ''): string {
    const P = this.P;
    return `<button data-${P}set="${attr(key)}" data-${P}to="${attr(JSON.stringify(to))}"${cls ? ` class="${cls}"` : ''}${more}>${label}</button>`;
  }
  /** A stepper: − value + (or several steps a side), and ↺ back to its
   * default when it's off it. */
  stepper(o: StepperOptions): string {
    const P = this.P, v = o.value, fmt = o.fmt || ((x: number | string) => String(x));
    const def = o.def !== undefined ? o.def : this.defaults[o.key], off = this.off(o.key, v, def);
    let down = '', up = '';
    if (o.values) {
      const V = o.values, i = V.findIndex((x) => x === v);
      // (a value not among them: the nearest either side)
      const prev = i >= 0 ? V[i - 1] : V.filter((x) => +x < +v).pop(), next = i >= 0 ? V[i + 1] : V.find((x) => +x > +v);
      down = prev === undefined ? `<button disabled>−</button>` : this.setter(o.key, prev, '−');
      up = next === undefined ? `<button disabled>+</button>` : this.setter(o.key, next, '+');
    } else {
      const steps = (Array.isArray(o.step) ? o.step : [o.step ?? 1]).slice().sort((a, b) => b - a), word = o.stepWord || ((s: number) => String(s));
      const to = (d: number) => {
        let x = +((+v) + d).toFixed(6);
        if (o.wrap && o.min !== undefined && o.max !== undefined) { const span = o.max - o.min; x = +((((x - o.min) % span) + span) % span + o.min).toFixed(6); return x; }
        if (o.min !== undefined && x < o.min) return (+v) > o.min ? o.min : undefined;
        if (o.max !== undefined && x > o.max) return (+v) < o.max ? o.max : undefined;
        return x;
      };
      const one = steps.length === 1;
      down = steps.map((s) => { const x = to(-s); return x === undefined ? `<button disabled>−${one ? '' : word(s)}</button>` : this.setter(o.key, x, '−' + (one ? '' : word(s))); }).join('');
      up = steps.slice().reverse().map((s) => { const x = to(s); return x === undefined ? `<button disabled>+${one ? '' : word(s)}</button>` : this.setter(o.key, x, '+' + (one ? '' : word(s))); }).join('');
    }
    const back = off ? this.setter(o.key, def, '↺', `${P}-reset`, ` title="Back to ${attr(fmt(def as number | string))}"`) : '';
    return `<span class="${P}-step${off ? ' ' + P + '-off' : ''}"${o.title ? ` title="${attr(o.title)}"` : ''}>${o.label ? `<span class="${P}-lab">${o.label}</span>` : ''}${down}<b>${esc(fmt(v))}</b>${up}${back}</span>`;
  }
  /** A switch: a button that turns a setting on or off. */
  toggle(o: ToggleOptions): string {
    const P = this.P, off = this.off(o.key, o.on, o.def);
    return this.setter(o.key, !o.on, esc(o.label), `${P}-tog${o.on ? ' on' : ''}${off ? ' ' + P + '-off' : ''}`, `${o.title ? ` title="${attr(o.title)}"` : ''} aria-pressed="${o.on}"`);
  }
  /** One of a few values: a button each, the one in force marked. */
  choice(o: ChoiceOptions): string {
    const P = this.P, off = this.off(o.key, o.value, o.def);
    const opts = o.options.map((x) => (Array.isArray(x) ? x : [x, String(x)]) as [unknown, string]);
    return `<span class="${P}-choice${off ? ' ' + P + '-off' : ''}">${o.label ? `<span class="${P}-lab">${o.label}</span>` : ''}` + opts.map(([v, l]) => this.setter(o.key, v, esc(l), JSON.stringify(v) === JSON.stringify(o.value) ? 'on' : '')).join('') + '</span>';
  }
}

// ---------------------------------------------------------------------------
// The drawer
// ---------------------------------------------------------------------------

/** A tab: its body's HTML, how often it's drawn again while it's showing
 * (seconds; 0 only when something's done in it), and what to wire after
 * each draw. `events: true` makes it the drawer's own events. */
export interface DevTab {
  id: string;
  label?: string;
  html?(d: Drawer): string;
  every?: number;
  bind?(body: HTMLElement, d: Drawer): void;
  events?: boolean;
}
/** A switch for something drawn over the game: a checkbox, or a choice of
 * `options` (the first meaning off). */
export interface DevOverlay { id: string; label?: string; on?: boolean | string; options?: string[]; title?: string }
/** A setting that changes play, with its default (read from the flags, or
 * by get()): while any is off its default, the tag says so. */
export interface PlaySetting { key: string; def: unknown; word?(v: unknown): string; get?(): unknown }
export interface EventsOptions {
  /** Kept (600) and shown (250). */
  most?: number; shown?: number;
  /** The kinds' chips in order (others after, as they come), and kinds left
   * out of "all" (each shown when its chip is picked). */
  kinds?: string[]; apart?: string[];
  /** A note's time, and a time as words. */
  clock?(): number; when?(t: number): string;
  /** More events from elsewhere (Tyrell's log), merged in by time: oldest
   * first is cheapest. Called only while the events show. */
  from?(): DevEvent[];
  /** Each kind's color, and the words are HTML (else text). */
  colors?: Record<string, string>; html?: boolean;
  /** A line beside the filters, by the filter. */
  hint?(filter: string, d: Drawer): string;
  /** A box to find words in them. */
  find?: boolean;
}
export interface DrawerOptions {
  /** Where its own state is kept (open or not, the tab, the overlays, the
   * filters: flags.s[keep], 'drawer'); flags.shown() lets it open, unless
   * `always`. */
  flags: Flags;
  keep?: string;
  always?: boolean;
  /** Every class and id carries it ('dev'): #dev, .dev-body, data-devact. */
  prefix?: string;
  title?: string;
  tabs: DevTab[];
  overlays?: DevOverlay[];
  /** Overlays stay on while the drawer's closed (else only while it's open). */
  keepOverlays?: boolean;
  events?: EventsOptions;
  /** The settings that change play, with their defaults: a tag on screen
   * while any is off its default, which opens the drawer at `tagTab`. */
  play?: PlaySetting[];
  tagTab?: string;
  /** Docked at the left (the default) or the right; a bottom sheet on a
   * screen held upright. */
  side?: 'left' | 'right';
  /** Where its elements go (document.body). */
  parent?(): HTMLElement | null;
  /** The keys that open and close it (` and ~), never while typing. */
  keys?: string[] | false;
  /** A button that opens and closes it: the game's own element (shown only
   * when it may open), or true for one of the drawer's own. */
  button?: HTMLElement | (() => HTMLElement | null) | boolean;
  /** The header's line (HTML), else the frame rate and the frame times. */
  frame?(d: Drawer): string;
  /** Seconds between the header's refreshes, and a tab's by default (0.4). */
  every?: number;
  /** A setting changed (data-<prefix>set): else flags.s[key] = value, saved. */
  set?(key: string, value: unknown, d: Drawer): void;
  /** The acts (data-<prefix>act, with data-<prefix>arg; and a mind's
   * data-<prefix>do, with whoever's picked); false leaves the tab as it is. */
  acts?: Record<string, (arg: string | null | undefined, el: HTMLElement, d: Drawer) => boolean | void>;
  /** The game's own data attributes in the drawer, by name: clicks, changes
   * and typing. */
  click?: Record<string, (value: string, el: HTMLElement, e: Event, d: Drawer) => void>;
  change?: Record<string, (value: string, el: HTMLElement, e: Event, d: Drawer) => void>;
  input?: Record<string, (value: string, el: HTMLElement, e: Event, d: Drawer) => void>;
  /** While open, a tap on the game (anywhere outside the drawer) asks who's
   * there (x, y in CSS px): someone found is picked, and the tap goes no
   * further. */
  pick?(x: number, y: number, e: Event): string | null | undefined;
  /** The tab picking someone opens, by a tap or a link (else it stays). */
  selectTab?: string;
  onSelect?(id: string | null, d: Drawer): void;
  onOpen?(d: Drawer): void; onClose?(d: Drawer): void; onTab?(id: string, d: Drawer): void;
  /** A canvas over the game for the overlays (`layer()`). */
  layer?: boolean;
  /** The drawer's own look, put in the page (true). */
  style?: boolean;
  /** A class on the page's body while it's open (<prefix>-on). */
  bodyClass?: string;
  /** Its label for screen readers. */
  label?: string;
  /** Frame rates smoothed by this much a frame (0.05). */
  smooth?: number;
}
interface DrawerState { open?: boolean; tab?: string; ov: Record<string, boolean | string>; filter: string; find: string; least: number }

const isField = (t: EventTarget | null): boolean => { const el = t as HTMLElement | null; return !!el && !!el.tagName && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || !!el.isContentEditable); };
const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : 0);

/** The dev drawer. Made when the game's scripts load; `start()` once the page
 * is ready (after the flags are loaded); `frame(dt)` every frame, with the
 * real seconds since the last. */
export class Drawer extends Bits {
  o: DrawerOptions;
  flags: Flags;
  tabs: DevTab[];
  notes: Notes;
  /** Open now. */
  on = false;
  /** Whoever's picked (the game's id). */
  sel: string | null = null;
  /** Frames a second, smoothed; and the game's frame times (ms, smoothed). */
  fps = 60;
  times: Record<string, number> = {};
  root: HTMLElement | null = null;
  body: HTMLElement | null = null;
  /** How much of the screen it covers now (CSS px), at each side. */
  cover = { left: 0, right: 0, bottom: 0 };
  private started = false; private headT = 0; private bodyT = 0;
  private downs = new Set<number>(); private scrolled = -1e9;
  private typed = new Map<string, string>(); private opened = new Map<string, boolean>();
  private sig = ''; private frozen: DevEvent[] | null = null; private clearedAt = -Infinity;
  private tagEl: HTMLElement | null = null; private tagText: string | null = null;
  private btn: HTMLElement | null = null;
  private cv: HTMLCanvasElement | null = null; private cg: CanvasRenderingContext2D | null = null; private layerOn = false;
  private ovs = new Map<string, DevOverlay>();

  constructor(o: DrawerOptions) {
    super(o.prefix ?? 'dev');
    this.o = o; this.flags = o.flags; this.tabs = o.tabs.slice();
    this.notes = new Notes({ most: o.events && o.events.most, clock: o.events && o.events.clock });
    for (const p of o.play || []) this.defaults[p.key] = p.def;
    for (const ov of o.overlays || []) this.ovs.set(ov.id, ov);
  }

  // ---- its state, in the flags ----------------------------------------------
  /** Its own state (kept in the flags): open, tab, overlays, filter, find. */
  get st(): DrawerState {
    const s = this.flags.s as Record<string, unknown>, k = this.o.keep ?? 'drawer';
    let v = s[k] as DrawerState | undefined;
    if (!v || typeof v !== 'object') v = s[k] = { ov: {}, filter: 'all', find: '', least: 0 } as DrawerState;
    if (!v.ov) v.ov = {};
    for (const ov of this.o.overlays || []) if (!(ov.id in v.ov)) v.ov[ov.id] = ov.on !== undefined ? ov.on : ov.options ? ov.options[0] : false;
    if (v.filter === undefined) v.filter = 'all';
    if (v.find === undefined) v.find = '';
    if (v.least === undefined) v.least = 0;
    return v;
  }
  save(): void { this.flags.save(); }
  /** May it open (?dev, or once shown; or always)? */
  get allowed(): boolean { return !!this.o.always || this.flags.shown(); }
  /** The tab showing. */
  current(): DevTab | undefined { const id = this.st.tab; return this.tabs.find((t) => t.id === id) || this.tabs[0]; }
  /** A tab added (at index `at`, else at the end). */
  addTab(t: DevTab, at?: number): void { this.tabs = this.tabs.filter((x) => x.id !== t.id); this.tabs.splice(at ?? this.tabs.length, 0, t); if (this.root) this.build(true); }

  // ---- the page ---------------------------------------------------------------
  /** Wires the key, the button, the tag and picking, and opens it again if it was open. */
  start(): this {
    if (this.started || typeof document === 'undefined') return this;
    this.started = true;
    const keys = this.o.keys === false ? [] : this.o.keys || ['`', '~'];
    if (keys.length) addEventListener('keydown', (e: KeyboardEvent) => { if (keys.includes(e.key) && !isField(e.target) && this.allowed) { e.preventDefault(); this.toggleOpen(); } });
    const b = this.o.button;
    if (b) {
      this.btn = b === true ? this.make('button', `${this.P}-btn`, 'DEV') : typeof b === 'function' ? b() : b;
      if (this.btn) { this.btn.hidden = !this.allowed; this.btn.addEventListener('click', () => this.toggleOpen()); }
    }
    if (this.o.pick) addEventListener('pointerdown', (e: PointerEvent) => {
      if (!this.on || !this.o.pick || (this.root && this.root.contains(e.target as Node)) || (this.tagEl && this.tagEl.contains(e.target as Node))) return;
      const id = this.o.pick(e.clientX, e.clientY, e);
      if (id === null || id === undefined) return;
      e.stopPropagation(); e.preventDefault();
      this.select(id, this.o.selectTab);
    }, true);
    addEventListener('pointerup', (e: PointerEvent) => this.downs.delete(e.pointerId), true);
    addEventListener('pointercancel', (e: PointerEvent) => this.downs.delete(e.pointerId), true);
    addEventListener('resize', () => { if (this.on) this.measure(); });
    this.tag(true);
    if (this.st.open && this.allowed) this.open();
    return this;
  }
  private make(tag: string, cls: string, text = ''): HTMLElement {
    const el = document.createElement(tag); el.className = cls; el.id = cls; if (text) el.textContent = text;
    ((this.o.parent && this.o.parent()) || document.body).appendChild(el);
    return el;
  }
  /** Its elements, made once (and the tabs again, `again`). */
  private build(again = false): void {
    const P = this.P;
    if (this.root && again) { const nav = this.root.querySelector(`.${P}-tabs`); if (nav) nav.innerHTML = this.tabsHtml(); return; }
    if (this.root) return;
    // (its look goes first in the head, so the game's own CSS overrides it)
    if (this.o.style !== false && !document.getElementById(`${P}-style`)) { const s = document.createElement('style'); s.id = `${P}-style`; s.textContent = drawerCss(P); document.head.insertBefore(s, document.head.firstChild); }
    const el = document.createElement('aside');
    el.id = P; el.className = `${P} ${P}-${this.o.side || 'left'}`; el.hidden = true; el.setAttribute('aria-label', this.o.label || 'Developer tools');
    const ov = (this.o.overlays || []).map((o) => o.options
      ? `<label${o.title ? ` title="${attr(o.title)}"` : ''}>${esc(o.label || o.id)} <select data-${P}ov="${attr(o.id)}" id="${P}-ov-${attr(o.id)}">${o.options.map((x) => `<option>${esc(x)}</option>`).join('')}</select></label>`
      : `<label${o.title ? ` title="${attr(o.title)}"` : ''}><input type="checkbox" data-${P}ov="${attr(o.id)}" id="${P}-ov-${attr(o.id)}"> ${esc(o.label || o.id)}</label>`).join('');
    el.innerHTML = `<div class="${P}-head"><b>${esc(this.o.title || 'DEV')}</b><nav class="${P}-tabs">${this.tabsHtml()}</nav><button class="${P}-x" id="${P}-close" aria-label="Close">×</button></div>`
      + `<div class="${P}-overlays">${ov}<span class="${P}-fps" id="${P}-fps"></span></div><div class="${P}-body" id="${P}-body"></div>`;
    ((this.o.parent && this.o.parent()) || document.body).appendChild(el);
    this.root = el; this.body = el.querySelector(`.${P}-body`) as HTMLElement;
    el.addEventListener('click', (e) => this.click(e));
    el.addEventListener('input', (e) => this.typing(e, 'input'));
    el.addEventListener('change', (e) => this.typing(e, 'change'));
    el.addEventListener('toggle', (e) => { const d = e.target as HTMLDetailsElement, k = this.keyOf(d); if (k) this.opened.set(k, d.open); }, true);
    el.addEventListener('pointerdown', (e) => this.downs.add((e as PointerEvent).pointerId));
    // (keys typed into its fields aren't the game's)
    for (const type of ['keydown', 'keyup', 'keypress']) el.addEventListener(type, (e) => { if (isField(e.target)) e.stopPropagation(); });
    this.body.addEventListener('scroll', () => (this.scrolled = nowMs()), { passive: true } as AddEventListenerOptions);
    this.body.addEventListener('wheel', () => (this.scrolled = nowMs()), { passive: true } as AddEventListenerOptions);
  }
  private tabsHtml(): string { return this.tabs.map((t) => `<button data-${this.P}tab="${attr(t.id)}">${esc(t.label || t.id[0].toUpperCase() + t.id.slice(1))}</button>`).join(''); }

  // ---- open, close, the tab -------------------------------------------------------
  open(tab?: string): void {
    if (!this.allowed || typeof document === 'undefined') return;
    this.build();
    const st = this.st;
    if (tab && this.tabs.some((t) => t.id === tab)) st.tab = tab;
    const was = this.on;
    this.on = true; st.open = true; this.save();
    (this.root as HTMLElement).hidden = false;
    document.body.classList.add(this.o.bodyClass || `${this.P}-on`);
    if (this.btn) this.btn.classList.add('active');
    this.measure();
    this.refresh(true, true);
    if (!was && this.o.onOpen) this.o.onOpen(this);
  }
  close(): void {
    if (!this.on) return;
    this.on = false; this.st.open = false; this.save();
    if (this.root) this.root.hidden = true;
    if (typeof document !== 'undefined') document.body.classList.remove(this.o.bodyClass || `${this.P}-on`);
    if (this.btn) this.btn.classList.remove('active');
    this.measure(); this.layer();
    if (this.o.onClose) this.o.onClose(this);
  }
  toggleOpen(force?: boolean): void { if (force ?? !this.on) this.open(); else this.close(); }
  /** Shows a tab (from the top). */
  show(id: string): void {
    const st = this.st; st.tab = id; this.save();
    if (this.o.onTab) this.o.onTab(id, this);
    this.refresh(true, true);
  }
  /** Where it sits, as CSS variables on the page (--<prefix>-left, -right,
   * -bottom, px) for the game's own layout, and in `cover`. */
  private measure(): void {
    const c = { left: 0, right: 0, bottom: 0 };
    if (this.on && this.root && typeof innerWidth !== 'undefined') {
      const r = this.root.getBoundingClientRect();
      if (r.width >= innerWidth - 2) c.bottom = Math.round(innerHeight - r.top);
      else if (r.left < 2) c.left = Math.round(r.right);
      else c.right = Math.round(innerWidth - r.left);
    }
    this.cover = c;
    if (typeof document !== 'undefined' && document.documentElement && document.documentElement.style) for (const k of ['left', 'right', 'bottom'] as const) document.documentElement.style.setProperty(`--${this.P}-${k}`, c[k] + 'px');
  }
  /** How much of the screen it covers (CSS px) on each side: nothing while closed. */
  covered(): { left: number; right: number; bottom: number } { return this.cover; }

  // ---- every frame ------------------------------------------------------------------
  /** Every frame, with the real seconds since the last: the frame rate, the
   * tag, and while it's open the header and the tab when they're due. */
  frame(dt: number): void {
    const k = this.o.smooth ?? 0.05;
    if (dt > 0) this.fps = this.fps * (1 - k) + (1 / dt) * k;
    this.tag();
    if (!this.on) return;
    const every = this.o.every ?? 0.4;
    this.headT -= dt; this.bodyT -= dt;
    if (this.bodyT <= 0) { const t = this.current(); this.bodyT = t && !t.events && t.every !== undefined ? t.every || every : every; this.headT = every; this.refresh(false); }
    else if (this.headT <= 0) { this.headT = every; this.head(); }
  }
  /** A frame time the game measured (ms), smoothed (by k, 0.1). */
  time(name: string, ms: number, k = 0.1): void { const v = this.times[name]; this.times[name] = v === undefined ? ms : v + (ms - v) * k; }
  /** The default header line: the frame rate and the frame times. */
  frameText(): string {
    const names = Object.keys(this.times);
    return `${Math.round(this.fps)} fps` + (names.length ? ' · ' + names.map((n) => `${n} ${this.times[n].toFixed(1)}`).join(' ') + ' ms' : '');
  }

  // ---- drawing --------------------------------------------------------------------------
  /** The header: which tab, the frame line, the overlays' switches. */
  head(): void {
    if (!this.root) return;
    const P = this.P, st = this.st, cur = this.current();
    this.root.querySelectorAll<HTMLElement>(`[data-${P}tab]`).forEach((b) => b.classList.toggle('active', !!cur && b.dataset[camel(P + 'tab')] === cur.id));
    const f = this.root.querySelector(`.${P}-fps`) as HTMLElement | null;
    if (f) f.innerHTML = this.o.frame ? this.o.frame(this) : esc(this.frameText());
    this.root.querySelectorAll<HTMLInputElement>(`[data-${P}ov]`).forEach((i) => { const v = st.ov[i.dataset[camel(P + 'ov')] as string]; if (i.type === 'checkbox') i.checked = !!v; else if (i.value !== v) i.value = String(v); });
  }
  /** Draws the tab again: always if `full` (something was done), else only
   * if it's due and nobody's in the middle of using it (a finger down, a
   * scroll just now, a choice open); `reset` goes back to the top. */
  refresh(full = false, reset = false): void {
    if (!this.on || !this.root) return;
    this.head();
    const t = this.current();
    if (!t) return;
    if (!full) {
      if (this.holding()) return;
      if (t.events) { if (this.evSig() === this.sig) return; }
      else if (t.every === 0) return;
    }
    this.draw(t, reset);
  }
  /** Is someone in the middle of using it? */
  holding(): boolean {
    if (this.downs.size || nowMs() - this.scrolled < 600) return true;
    const a = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    return !!a && a.tagName === 'SELECT' && !!this.body && this.body.contains(a);
  }
  private keyOf(el: Element | null): string | null {
    if (!el || !(el as HTMLElement).getAttribute) return null;
    const h = el as HTMLElement, name = h.getAttribute('name');
    return h.id ? '#' + h.id : name ? 'n:' + name : h.dataset && h.dataset.keep ? 'k:' + h.dataset.keep : null;
  }
  private keyed(root: HTMLElement): Map<string, HTMLElement> {
    const m = new Map<string, HTMLElement>();
    root.querySelectorAll<HTMLElement>('input, select, textarea, details, [data-keep]').forEach((el) => { const k = this.keyOf(el); if (k && !m.has(k)) m.set(k, el); });
    return m;
  }
  private draw(t: DevTab, reset: boolean): void {
    const body = this.body as HTMLElement;
    // what to keep: where it's scrolled to (and anything inside that scrolls,
    // with data-keep), what has focus and where its caret is, what's been
    // typed and which sections are open
    const top = reset ? 0 : body.scrollTop, inner: [string, number][] = [];
    if (!reset) for (const [k, el] of this.keyed(body)) if (el.scrollTop) inner.push([k, el.scrollTop]);
    const fa = typeof document !== 'undefined' ? (document.activeElement as HTMLInputElement | null) : null;
    const fk = fa && body.contains(fa) ? this.keyOf(fa) : null;
    let caret: [number | null, number | null] | null = null;
    if (fk) try { caret = [fa!.selectionStart, fa!.selectionEnd]; } catch (e) { caret = null; }
    body.innerHTML = t.events ? this.eventsHtml() : t.html ? t.html(this) : '';
    if (t.events) this.sig = this.evSig();
    const els = this.keyed(body);
    for (const [k, v] of this.typed) { const el = els.get(k) as HTMLInputElement | undefined; if (el && 'value' in el && el.value !== v) el.value = v; }
    for (const [k, v] of this.opened) { const el = els.get(k) as HTMLDetailsElement | undefined; if (el && el.tagName === 'DETAILS') el.open = v; }
    for (const [k, v] of inner) { const el = els.get(k); if (el) el.scrollTop = v; }
    body.scrollTop = top;
    if (fk) { const el = els.get(fk) as HTMLInputElement | undefined; if (el && el.focus) { el.focus({ preventScroll: true }); if (caret && caret[0] !== null) try { el.setSelectionRange(caret[0], caret[1]); } catch (e) { /* (not a text field) */ } } }
    if (t.bind) t.bind(body, this);
  }

  // ---- what's done in it -------------------------------------------------------------
  private data(el: Element, k: string): string | undefined { return (el as HTMLElement).dataset[camel(this.P + k)]; }
  private near(t: Element, sel: string): HTMLElement | null { const el = t.closest ? (t.closest(sel) as HTMLElement | null) : null; return el && this.root && this.root.contains(el) ? el : null; }
  private click(e: Event): void {
    const t = e.target as Element, P = this.P, st = this.st, o = this.o;
    if (!t || !t.closest) return;
    let el: HTMLElement | null;
    const done = (b: HTMLElement) => { if (b.tagName === 'BUTTON' && b.blur) b.blur(); }; // (so the game's keys are the game's again)
    if ((el = this.near(t, `[data-${P}tab]`))) { this.show(this.data(el, 'tab') as string); done(el); return; }
    if ((el = this.near(t, `.${P}-x`))) { this.close(); return; }
    if ((el = this.near(t, `[data-${P}set]`))) { if ((el as HTMLButtonElement).disabled) return; let v: unknown; try { v = JSON.parse(this.data(el, 'to') as string); } catch (err) { v = this.data(el, 'to'); } this.set(this.data(el, 'set') as string, v); done(el); return; }
    if ((el = this.near(t, `[data-${P}act]`))) {
      if ((el as HTMLButtonElement).disabled) return;
      const fn = o.acts && o.acts[this.data(el, 'act') as string];
      if (fn && fn(this.data(el, 'arg'), el, this) !== false) this.refresh(true);
      done(el); return;
    }
    if ((el = this.near(t, `[data-${P}sel]`))) { this.select(this.data(el, 'sel') || null, this.o.selectTab); return; }
    if ((el = this.near(t, `[data-${P}do]`))) {
      const k = this.data(el, 'do') as string, fn = o.acts && o.acts[k];
      if (k === 'close') this.select(null);
      else if (fn && fn(this.sel, el, this) !== false) this.refresh(true);
      done(el); return;
    }
    if ((el = this.near(t, `[data-${P}kind]`))) { st.filter = this.data(el, 'kind') as string; this.save(); this.refresh(true, true); done(el); return; }
    if ((el = this.near(t, `[data-${P}ev]`))) {
      const k = this.data(el, 'ev');
      if (k === 'pause') { this.notes.paused = !this.notes.paused; this.frozen = null; if (this.notes.paused) this.frozen = this.evAll(); }
      if (k === 'clear') { this.notes.clear(); let newest = -Infinity; for (const x of this.fromList()) if (x.t > newest) newest = x.t; this.clearedAt = newest; this.frozen = null; }
      this.refresh(true); done(el); return;
    }
    for (const k of Object.keys(o.click || {})) { const c = this.near(t, `[data-${k}]`); if (c) { (o.click as NonNullable<DrawerOptions['click']>)[k](c.dataset[camel(k)] as string, c, e, this); return; } }
  }
  private typing(e: Event, type: 'input' | 'change'): void {
    const t = e.target as HTMLInputElement, P = this.P, st = this.st;
    if (!t || !t.dataset) return;
    const k = this.keyOf(t);
    if (k && 'value' in t && t.type !== 'checkbox') this.typed.set(k, t.value);
    if (t.dataset[camel(P + 'ov')] !== undefined) { const id = t.dataset[camel(P + 'ov')] as string; st.ov[id] = t.type === 'checkbox' ? t.checked : t.value; this.save(); return; }
    if (type === 'input' && t.dataset[camel(P + 'find')] !== undefined) { st.find = t.value; this.save(); this.refresh(true); return; }
    const map = type === 'input' ? this.o.input : this.o.change;
    for (const key of Object.keys(map || {})) { const c = this.near(t, `[data-${key}]`); if (c) { (map as NonNullable<DrawerOptions['input']>)[key](c.dataset[camel(key)] as string, t, e, this); return; } }
  }
  /** A setting changed: the game's `set`, or the flags; then the tab again. */
  set(key: string, value: unknown): void {
    if (key === `${this.P}-least`) { this.st.least = +(value as number) || 0; this.save(); this.refresh(true); return; } // (the events' own)
    if (this.o.set) this.o.set(key, value, this); else this.store(key, value);
    this.tag(true);
    this.refresh(true);
  }
  /** A setting written to the flags and kept. */
  store(key: string, value: unknown): void { (this.flags.s as Record<string, unknown>)[key] = value; this.flags.save(); }
  /** Picks someone (or nobody): to `tab`, if one's given. */
  select(id: string | null, tab?: string): void {
    this.sel = id;
    if (this.o.onSelect) this.o.onSelect(id, this);
    if (id && tab && this.on && this.st.tab !== tab) { this.show(tab); return; }
    this.refresh(true);
  }

  // ---- the overlays ------------------------------------------------------------------------
  /** An overlay's value while it shows (the drawer open, or keepOverlays):
   * true, or a choice's value; false when it's off. */
  overlay(id: string): boolean | string {
    if (!this.on && !(this.o.keepOverlays && this.allowed)) return false;
    const v = this.st.ov[id], ov = this.ovs.get(id);
    if (ov && ov.options) return v && v !== ov.options[0] ? (v as string) : false;
    return !!v;
  }
  /** Is any overlay showing? */
  overlays(): boolean { for (const id of this.ovs.keys()) if (this.overlay(id)) return true; return false; }
  /** The canvas over the game for this frame's overlays, cleared and scaled
   * to CSS px, while any overlay shows; else null (and it's cleared away). */
  layer(): { g: CanvasRenderingContext2D; w: number; h: number } | null {
    if (!this.o.layer || typeof document === 'undefined') return null;
    if (!this.overlays()) { if (this.layerOn && this.cv && this.cg) { this.cg.setTransform(1, 0, 0, 1, 0, 0); this.cg.clearRect(0, 0, this.cv.width, this.cv.height); this.cv.hidden = true; } this.layerOn = false; return null; }
    if (!this.cv) { this.cv = this.make('canvas', `${this.P}-layer`) as HTMLCanvasElement; this.cg = this.cv.getContext('2d'); }
    const cv = this.cv, g = this.cg as CanvasRenderingContext2D, dpr = (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1, w = innerWidth, h = innerHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    cv.hidden = false; this.layerOn = true;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w, h };
  }

  // ---- the tag ----------------------------------------------------------------------------------
  /** The settings that change play and are off their defaults, in words. */
  offPlay(): string[] {
    const s = this.flags.s as Record<string, unknown>;
    return (this.o.play || []).filter((p) => this.off(p.key, p.get ? p.get() : s[p.key], p.def)).map((p) => { const v = p.get ? p.get() : s[p.key]; return p.word ? p.word(v) : `${p.key} ${v}`; });
  }
  /** The tag: on screen while any setting that changes play is off its default. */
  tag(force = false): void {
    if (!this.o.play || !this.started) return;
    const text = this.offPlay().join(' · ');
    if (text === this.tagText && !force) return;
    this.tagText = text;
    if (!this.tagEl) { this.tagEl = this.make('div', `${this.P}-tag`); this.tagEl.setAttribute('role', 'status'); this.tagEl.addEventListener('click', () => this.open(this.o.tagTab)); }
    this.tagEl.textContent = text; this.tagEl.hidden = !text; this.tagEl.title = text ? 'Dev settings that change play: ' + text : '';
  }

  // ---- the events --------------------------------------------------------------------------------
  /** Something that happened, for the events. */
  note(kind: string, text: string, more?: Partial<DevEvent>): DevEvent | null { return this.notes.note(kind, text, more); }
  private fromList(): DevEvent[] { const f = this.o.events && this.o.events.from; return f ? f() || [] : []; }
  private evSig(): string { const f = this.fromList(); return `${this.notes.count}:${f.length}:${f.length ? f[f.length - 1].t + '/' + f[0].t : ''}:${this.notes.paused}`; }
  /** Every event, newest first: the notes and what `from` gives, merged by time. */
  evAll(): DevEvent[] {
    if (this.frozen) return this.frozen;
    let f = this.fromList();
    if (f.length && this.clearedAt > -Infinity) {
      let newest = -Infinity;
      for (const x of f) if (x.t > newest) newest = x.t;
      if (newest < this.clearedAt) this.clearedAt = -Infinity; // (the clock went back past the clearing)
      else f = f.filter((x) => x.t > this.clearedAt);
    }
    if (f.length) {
      let up = true;
      for (let i = 1; i < f.length && up; i++) if (f[i].t < f[i - 1].t) up = false;
      f = up ? f.slice().reverse() : f.slice().sort((a, b) => b.t - a.t);
    }
    const a = this.notes.list, out: DevEvent[] = [];
    let i = 0, j = 0;
    while (i < a.length || j < f.length) out.push(j >= f.length || (i < a.length && a[i].t >= f[j].t) ? a[i++] : f[j++]);
    return out;
  }
  /** The events: a chip a kind (with its count), pause and clear, the find
   * box, then the list, newest first. */
  eventsHtml(): string {
    const P = this.P, E = this.o.events || {}, st = this.st, all = this.evAll(), apart = new Set(E.apart || []);
    const counts: Record<string, number> = {};
    let n = 0;
    for (const e of all) { counts[e.kind] = (counts[e.kind] || 0) + 1; if (!apart.has(e.kind)) n++; }
    const named = E.kinds || [], kinds = named.concat(Object.keys(counts).filter((k) => !named.includes(k)).sort());
    const col = (k: string) => (E.colors && E.colors[k] ? ` style="color:${attr(E.colors[k])}"` : '');
    let h = `<div class="${P}-chips"><button data-${P}kind="all" class="${st.filter === 'all' ? 'on' : ''}">all ${n}</button>`
      + kinds.map((k) => `<button data-${P}kind="${attr(k)}" class="${[st.filter === k ? 'on' : '', apart.has(k) ? P + '-apart' : ''].join(' ').trim()}"${st.filter === k ? '' : col(k)}>${esc(k)} ${counts[k] || 0}</button>`).join('') + '</div>';
    const imp = all.some((e) => e.impact !== undefined);
    h += `<div class="${P}-chips"><button data-${P}ev="pause">${this.notes.paused ? 'resume log' : 'pause log'}</button><button data-${P}ev="clear">clear</button>`
      + (E.find ? `<input type="search" id="${P}-find" data-${P}find placeholder="find" value="${attr(st.find)}" autocomplete="off" spellcheck="false">` : '')
      + (imp ? this.stepper({ key: `${P}-least`, value: st.least, label: 'least impact', step: 0.1, min: 0, max: 1, fmt: (v) => (+v).toFixed(1) }) : '')
      + (E.hint ? E.hint(st.filter, this) : '') + '</div>';
    const q = E.find && st.find ? st.find.toLowerCase() : '', most = E.shown ?? 250, list: DevEvent[] = [];
    for (const e of all) {
      if (list.length >= most) break;
      if (st.filter === 'all' ? apart.has(e.kind) : e.kind !== st.filter) continue;
      if (q && !(e.text + ' ' + e.kind).toLowerCase().includes(q)) continue;
      if (imp && e.impact !== undefined && e.impact < st.least) continue;
      list.push(e);
    }
    const when = E.when || ((t: number) => String(Math.round(t)));
    h += list.map((e) => `<div class="${P}-ev k-${attr(e.kind.replace(/[^a-z0-9_-]/gi, '_'))}"><span class="${P}-t">${esc(when(e.t))}</span>${imp ? `<span class="${P}-imp">${e.impact !== undefined ? e.impact.toFixed(2) : ''}</span>` : ''}<span class="${P}-k"${col(e.kind)}>${esc(e.kind)}</span>${e.html || E.html ? e.text : esc(e.text)}</div>`).join('')
      || `<p class="${P}-hint">${all.length ? 'Nothing like that.' : 'Nothing logged yet.'}</p>`;
    return h;
  }
}

// ---------------------------------------------------------------------------
// Its look
// ---------------------------------------------------------------------------

/** The drawer's own look, for a prefix: compact, dark and monospace (with a
 * mind from Tycho.inspect.mind, of the same prefix, styled to match). Its
 * colors are CSS variables on the drawer (--dv-bg, --dv-fg, --dv-dim,
 * --dv-line, --dv-hi, --dv-acc, --dv-up, --dv-down, --dv-btn) and its width
 * --dv-w. Put first in the page's head by the drawer (unless `style: false`),
 * so the game's own CSS overrides it. */
export function drawerCss(P = 'dev'): string {
  const D = '.' + P;
  return `${D}{--dv-bg:rgba(10,14,20,.94);--dv-line:#2a3644;--dv-fg:#d8e6f0;--dv-dim:#8196a9;--dv-hi:#ffe14a;--dv-up:#8ae6a0;--dv-down:#ff9a8a;--dv-acc:#6ad0ff;--dv-btn:#16202c;--dv-w:min(440px,46vw);position:fixed;z-index:60;top:0;bottom:0;left:0;width:var(--dv-w);min-width:min(300px,100vw);display:flex;flex-direction:column;box-sizing:border-box;margin:0;background:var(--dv-bg);color:var(--dv-fg);border-right:1px solid var(--dv-line);box-shadow:0 8px 30px rgba(0,0,0,.45);font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono","DejaVu Sans Mono",monospace;-webkit-font-smoothing:auto;letter-spacing:0;text-transform:none;text-align:left;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom) env(safe-area-inset-left);touch-action:manipulation;-webkit-user-select:none;user-select:none;pointer-events:auto}
${D}.${P}-right{left:auto;right:0;border-right:0;border-left:1px solid var(--dv-line);padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) 0}
${D}[hidden]{display:none}
${D} *{box-sizing:border-box}
${D} button,${D} input,${D} select,${D} summary{font:inherit;color:inherit;letter-spacing:0;text-transform:none}
${D} button{background:var(--dv-btn);color:var(--dv-fg);border:1px solid var(--dv-line);border-radius:3px;padding:2px 8px;min-height:22px;line-height:1.25;margin:0;cursor:pointer;clip-path:none;box-shadow:none;transform:none;animation:none;text-shadow:none;opacity:1}
${D} button:hover{border-color:var(--dv-acc)}
${D} button:active:not(:disabled){transform:none;box-shadow:none}
${D} button:disabled{opacity:.4;cursor:default}
${D} button.on,${D} button.active{background:var(--dv-acc);color:#06121c;border-color:var(--dv-acc)}
${D} button:focus-visible{outline:2px solid var(--dv-hi);outline-offset:1px}
${D} input[type=search],${D} input[type=text],${D} input[type=number],${D} select{background:#0b1620;color:var(--dv-fg);border:1px solid #2a3a48;border-radius:3px;padding:2px 5px;min-height:22px;-webkit-user-select:text;user-select:text}
${D} input[type=search]{min-width:9em;flex:1 1 9em}
${D} input[type=checkbox]{width:13px;height:13px;margin:0;accent-color:var(--dv-acc)}
${D} b{font-weight:700;color:#fff}
${D} small{font-size:11px;color:var(--dv-dim)}
${D} h3,${D} h4{display:block;margin:6px 0 4px;font-size:13px;font-weight:400;color:var(--dv-hi);letter-spacing:0;text-transform:none}
${D} h5{display:block;margin:10px 0 4px;font-size:11px;font-weight:400;color:var(--dv-acc);text-transform:uppercase;letter-spacing:1px}
${D} h3::before,${D} h3::after,${D} h4::after,${D} h5::after{content:none}
${D} h5 small{text-transform:none;letter-spacing:0}
${D} p{margin:3px 0}
${D} a{color:var(--dv-acc);cursor:pointer;text-decoration:underline;text-underline-offset:2px}
${D}-head{display:flex;align-items:center;gap:8px;padding:4px 6px 4px 8px;border-bottom:1px solid var(--dv-line)}
${D}-head>b{color:var(--dv-hi);letter-spacing:2px}
${D}-tabs{display:flex;flex-wrap:wrap;gap:2px;flex:1}
${D} ${D}-x{font-size:18px;line-height:1;background:none;border:0;color:var(--dv-dim);padding:0 6px;min-height:24px}
${D}-overlays{display:flex;flex-wrap:wrap;gap:2px 12px;align-items:center;padding:3px 8px;border-bottom:1px solid var(--dv-line);color:var(--dv-dim)}
${D}-overlays label{display:inline-flex;gap:4px;align-items:center;cursor:pointer}
${D}-overlays select{min-height:20px;padding:0 3px}
${D}-fps{margin-left:auto;font-variant-numeric:tabular-nums}
${D}-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:6px 10px 14px;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
${D}-kv{margin:1px 0;overflow-wrap:anywhere}
${D}-hint,${D} .dim,${D} .sub{color:var(--dv-dim);font-size:inherit}
${D} .up{color:var(--dv-up)}${D} .down{color:var(--dv-down)}
${D}-t{color:var(--dv-dim);font-variant-numeric:tabular-nums;margin-right:6px}
${D} .num,${D}-num{text-align:right;font-variant-numeric:tabular-nums}
${D}-chips,${D} .buttons{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0;align-items:center}
${D}-bar{display:inline-block;width:100%;min-width:40px;height:6px;background:#1c2836;border-radius:2px;overflow:hidden;vertical-align:middle}
${D}-bar i{display:block;height:100%;background:#5aa0c8}
${D}-bar i.warm{background:#e8b84a}${D}-bar i.hot{background:#ff6a5a}
${D}-bars{display:grid;grid-template-columns:auto 1fr 3.2em;gap:2px 8px;align-items:center}
${D} table{width:100%;border-collapse:collapse;font-size:11.5px}
${D} th{text-align:left;color:var(--dv-dim);font-weight:400;border-bottom:1px solid var(--dv-line);padding:2px 4px}
${D} th.num{text-align:right}
${D} td{padding:2px 4px;border-bottom:1px solid rgba(42,54,68,.5);vertical-align:top}
${D} tr.cur td,${D} tr.pick td{background:rgba(255,225,74,.12)}
${D} tr.no td{opacity:.55}
${D} td:last-child{overflow-wrap:anywhere}
${D} details{margin:4px 0}${D} summary{cursor:pointer;color:var(--dv-acc)}
${D}-step,${D}-choice{display:inline-flex;flex-wrap:wrap;align-items:center;gap:3px;margin:2px 12px 2px 0}
${D}-lab{color:var(--dv-dim);margin-right:3px}
${D}-step>b{min-width:3.4em;text-align:center;font-variant-numeric:tabular-nums}
${D}-off>b,${D}-off>${D}-lab{color:var(--dv-hi)}
${D} ${D}-choice${D}-off button.on{background:var(--dv-hi);border-color:var(--dv-hi)}
${D} ${D}-reset{color:var(--dv-hi);border-color:var(--dv-hi)}
${D} ${D}-tog::before{content:'';display:inline-block;width:8px;height:8px;margin-right:6px;border:1px solid currentColor;vertical-align:0}
${D} ${D}-tog.on{background:var(--dv-btn);color:var(--dv-up);border-color:var(--dv-up)}
${D} ${D}-tog.on::before{background:currentColor}
${D} ${D}-tog.${P}-off{color:var(--dv-hi);border-color:var(--dv-hi)}
${D}-ev{padding:2px 0;border-bottom:1px solid rgba(42,54,68,.5);overflow-wrap:anywhere;-webkit-user-select:text;user-select:text}
${D}-k{display:inline-block;min-width:56px;color:var(--dv-acc);margin-right:6px}
${D}-imp{display:inline-block;min-width:3em;color:var(--dv-hi);margin-right:6px}
${D} ${D}-apart{opacity:.65}
${D}-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:2px 10px}
${D}-tag{position:fixed;z-index:61;left:50%;bottom:max(4px,env(safe-area-inset-bottom));transform:translateX(-50%);max-width:90vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 8px;background:#3a2a00;color:#ffe14a;border:1px solid #ffe14a;border-radius:3px;font:11px/1.3 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:0;text-transform:none;cursor:pointer;pointer-events:auto}
${D}-tag[hidden],${D}-btn[hidden],${D}-layer[hidden]{display:none}
${D}-layer{position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:1}
${D}-btn{position:fixed;z-index:59;left:max(8px,env(safe-area-inset-left));bottom:max(8px,env(safe-area-inset-bottom));font:11px/1 ui-monospace,Menlo,monospace;padding:4px 8px;color:#ffe14a;background:rgba(10,14,20,.85);border:1px solid #2a3644;border-radius:3px;cursor:pointer}
@media (pointer:coarse){${D} button{min-height:28px;padding:3px 9px}${D} input[type=search],${D} select{min-height:28px}${D} ${D}-x{min-height:30px}}
@media (max-height:480px){${D}{font-size:11px}${D} small{font-size:10px}${D} table{font-size:10.5px}${D}-body{padding:4px 8px 10px}}
@media (max-aspect-ratio:4/5){${D},${D}.${P}-right{top:auto;left:0;right:0;width:auto;min-width:0;height:58vh;border:0;border-top:1px solid var(--dv-line);border-radius:10px 10px 0 0;padding:0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}}
${D} .${P}needs{display:grid;gap:2px;margin:4px 0}
${D} .${P}needs>div{display:grid;grid-template-columns:5.5em 1fr 3em;gap:6px;align-items:center}
${D} .${P}needs span{color:var(--dv-dim)}
${D} .${P}needs i{display:block;height:6px;background:#1c2836;border-radius:2px;overflow:hidden}
${D} .${P}needs b{display:block;height:100%}
${D} .${P}needs em{font-style:normal;text-align:right;font-variant-numeric:tabular-nums}
${D} div.${P}why>div{padding:2px 6px;margin:2px 0;background:#121a24}
${D} div.${P}why>div.pick{background:#12302e;box-shadow:inset 2px 0 0 var(--dv-acc)}
${D} div.${P}why>div.no{opacity:.6}
${D} .${P}day>div{padding:1px 4px}${D} .${P}day>div.cur{background:rgba(255,225,74,.12);color:var(--dv-hi)}${D} .${P}day span{color:var(--dv-dim);margin-right:4px}
${D} .${P}log>div{padding:1px 0}
${D} .${P}story>div,${D} .${P}threads details>div{padding:1px 0 1px 1.5em;text-indent:-1.5em}
${D} .${P}story span,${D} .${P}threads details>div span{color:var(--dv-dim);margin-right:4px;font-variant-numeric:tabular-nums}
${D} .${P}story a,${D} .${P}threads a{color:var(--dv-acc);cursor:pointer}
${D} .${P}story i,${D} .${P}threads i{font-style:normal;color:var(--dv-hi)}
${D} div.${P}when{color:var(--dv-dim);text-indent:0;padding:0;margin:5px 0 1px;border-bottom:1px solid var(--dv-line)}
${D} .${P}threads details{margin:2px 0 6px}${D} .${P}threads summary{cursor:pointer;color:var(--dv-hi)}${D} .${P}threads summary small{color:var(--dv-acc)}
${D} .${P}list{display:flex;flex-wrap:wrap;gap:3px}
${D} .${P}list i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px}
${D} .${P}out>div{margin:1px 0;overflow-wrap:anywhere}
`;
}
