// Input: the controls of a phone-first game, as one part each game
// configures. A stick wherever the thumb lands in its zone, buttons on the
// screen and keys, each holding an action; presses that wait until the game
// takes them (so a pause doesn't eat them), and presses and releases since
// the game last looked; the stick's axes, or the keys'; a test's bot over
// all of it; letting go of everything held when a screen opens, and a guard
// against taps for a moment after. And Gestures, the drag, pinch and tap of
// a map view.
//
// The state works without a page (the tests drive it in Node); listen()
// wires it to the page's pointers and keys. Drawing the stick is the game's
// (onChange tells it when).
import { clamp } from '../core/math';

/** The thumb on the stick: where it landed (x0, y0, at t0 ms), the stick's
 * base (bx, by: where it landed, or moved in to keep the stick inside its
 * zone) and where it is now (x, y), in CSS px. */
export interface StickState { id: number; bx: number; by: number; x: number; y: number; t0: number; x0: number; y0: number; flicked: boolean }

export interface StickOptions {
  /** How far the thumb goes for full tilt, in CSS px. */
  radius: number;
  /** A round dead zone in the middle (CSS px): inside it no tilt, and past
   * the radius the tilt is one, the direction kept. */
  dead?: number;
  /** Or a dead zone on each axis, a share of the radius ([x, y]): the
   * thumb's offset is held to a square the radius across, and an axis reads
   * nothing until it's past its share. */
  deadAxes?: [number, number];
  /** Keep the whole stick inside its zone: the base sits at least the
   * radius in from the zone's edges. */
  inside?: boolean;
  /** A second thumb landing in the zone takes the stick over (otherwise the
   * first keeps it till it lifts). */
  retake?: boolean;
  /** A quick flick as the thumb lands presses `action`, with the flick's
   * direction ({ x, y }, of length one): moved more than `px` within `ms`
   * of landing. (Read as it's needed, so it may be an object of getters.) */
  flick?: { action: string; ms: number; px: number };
  /** Called whenever the stick changes (landed, moved, lifted, let go), to
   * draw it: the thumb, or null. */
  onChange?: (stick: StickState | null) => void;
}

export interface ControlsOptions {
  /** A key's code (KeyboardEvent.code) to the action it holds. */
  keys?: Record<string, string>;
  /** The actions the keys move with, when the stick isn't held: each axis is
   * -1, 0 or 1, both scaled to length one if `round` (so a diagonal isn't
   * quicker), and scaled by `slow`'s factors while its action is held. */
  axes?: { left: string; right: string; up: string; down: string; round?: boolean; slow?: { action: string; x?: number; y?: number } };
  /** Actions whose press waits until the game takes it (take()): pressed by
   * a key going down, a button or tap landing, or a flick. */
  presses?: string[];
  /** Actions whose press and release since the game last looked are kept
   * (edges()), worked out each update(). */
  edges?: string[];
  stick?: StickOptions;
  /** The bot's fields: its axes (`x`, `y`, by default those names), the
   * actions it holds (`held`: an action to the field it's read from; by
   * default each action's own name), and the presses it makes (`press`: an
   * action to the field; a press taken clears it there; actions not named
   * take the real presses even while a bot drives). */
  bot?: { x?: string; y?: string; held?: Record<string, string>; press?: Record<string, string> };
  /** While true, nothing new is pressed: the stick and the buttons ignore
   * thumbs landing, and keys press nothing (a key held is still held). */
  blocked?: () => boolean;
  /** Seconds the guard lasts (guard()). */
  guard?: number;
  /** The clock the guard is measured by, in seconds (by default the page's). */
  clock?: () => number;
  /** The clock a flick is timed by, in ms (by default performance.now). */
  now?: () => number;
}

export interface ListenOptions {
  /** Where keys are heard (window by default; null for none). */
  keyboard?: EventTarget | null;
  /** The stick's zone. */
  stick?: HTMLElement | null;
  /** On-screen buttons, each holding an action while a pointer is down on
   * it (the last pointer down holds it; it's let go when that one lifts). */
  buttons?: Record<string, HTMLElement>;
  /** On-screen buttons that only press an action as a pointer lands. */
  taps?: Record<string, HTMLElement>;
  /** The class a held button wears ('held' by default). */
  heldClass?: string;
  /** Codes whose default is stopped as the key goes down (unless blocked):
   * by default every code in `keys`. */
  prevent?: string[];
  /** Stop the default as those keys come up too. */
  preventUp?: boolean;
  /** Called when a thumb lands on the stick or a button. */
  onTouch?: () => void;
}

export interface Edge { down: boolean; pressed: boolean; released: boolean }

type Bot = Record<string, unknown>;

/** The controls: what's held, the presses waiting, the edges, the stick and
 * the axes (`move`), and the bot. Fed by listen() on a page, or by keyDown,
 * stickDown and the rest directly. */
export class Controls {
  o: ControlsOptions;
  /** The axes, -1..1 each: the bot's, the stick's or the keys', worked out by
   * update(). The game may write them (a scene walking the player) until the
   * next update() writes over them. */
  move = { x: 0, y: 0 };
  /** The thumb on the stick, or null. */
  stick: StickState | null = null;
  /** A test's controls, read over the real ones by the names in `o.bot`. */
  bot: Bot | null = null;
  /** Presses waiting to be taken: true, or what pressed it (a flick's
   * direction); false or missing for none. */
  presses: Record<string, unknown> = {};
  /** The codes of the action keys down now. */
  keys = new Set<string>();
  /** The pointer holding each on-screen button, or null. */
  holders: Record<string, number | null> = {};
  private edgeOf: Record<string, Edge> = {};
  private els: Record<string, HTMLElement> = {};
  private heldClass = 'held';
  private guardAt = -Infinity;
  private guardFor = 0;

  constructor(o: ControlsOptions = {}) {
    this.o = o;
    for (const a of o.edges || []) this.edgeOf[a] = { down: false, pressed: false, released: false };
  }

  /** Is an action held: by the bot when one drives, else by a button or a key. */
  held(action: string): boolean {
    if (this.bot) return !!this.bot[this.botField('held', action)!];
    if (this.holders[action] != null) return true;
    const K = this.o.keys || {};
    for (const c of this.keys) if (K[c] === action) return true;
    return false;
  }
  /** Is something blocking new presses now? */
  isBlocked(): boolean { return !!(this.o.blocked && this.o.blocked()); }

  /** Presses an action: it waits, with `value`, until taken. */
  press(action: string, value: unknown = true): void { this.presses[action] = value; }
  /** The press waiting for an action (true, or its value), cleared; false if
   * none. A bot that presses the action is read instead (and cleared). */
  take(action: string): unknown {
    const f = this.bot ? this.botField('press', action) : null;
    if (this.bot && f) { const v = !!this.bot[f]; this.bot[f] = false; return v; }
    const v = this.presses[action];
    this.presses[action] = false;
    return v || false;
  }
  /** An action's state for the game to read: held now, and pressed or
   * released since it last looked (reading clears those). For the actions
   * in `o.edges`. */
  edges(action: string): Edge {
    const h = this.edgeOf[action] || (this.edgeOf[action] = { down: false, pressed: false, released: false });
    const out = { down: h.down, pressed: h.pressed, released: h.released };
    h.pressed = false; h.released = false;
    return out;
  }

  /** Each step, before the game reads the controls: the edges, then the axes
   * (the bot's, else the stick's while a thumb is on it, else the keys'). */
  update(): void {
    for (const a in this.edgeOf) {
      const h = this.edgeOf[a], now = this.held(a);
      if (now && !h.down) h.pressed = true;
      if (!now && h.down) h.released = true;
      h.down = now;
    }
    const m = this.move;
    if (this.bot) {
      const b = this.o.bot || {};
      m.x = (this.bot[b.x || 'x'] as number) || 0; m.y = (this.bot[b.y || 'y'] as number) || 0;
      return;
    }
    const s = this.stick, S = this.o.stick;
    if (s && S) {
      const R = S.radius;
      if (S.deadAxes) {
        const dx = clamp(s.x - s.bx, -R, R), dy = clamp(s.y - s.by, -R, R);
        m.x = Math.abs(dx) > R * S.deadAxes[0] ? dx / R : 0;
        m.y = Math.abs(dy) > R * S.deadAxes[1] ? dy / R : 0;
      } else {
        let dx = (s.x - s.bx) / R, dy = (s.y - s.by) / R;
        const len = Math.hypot(dx, dy);
        if (len * R < (S.dead || 0)) dx = dy = 0;
        else if (len > 1) { dx /= len; dy /= len; }
        m.x = dx; m.y = dy;
      }
      return;
    }
    const A = this.o.axes;
    if (!A) { m.x = m.y = 0; return; }
    let kx = (this.held(A.right) ? 1 : 0) - (this.held(A.left) ? 1 : 0), ky = (this.held(A.down) ? 1 : 0) - (this.held(A.up) ? 1 : 0);
    if (A.slow && this.held(A.slow.action)) { kx *= A.slow.x ?? 1; ky *= A.slow.y ?? 1; }
    if (A.round) { const len = Math.hypot(kx, ky) || 1; kx /= len; ky /= len; }
    m.x = kx; m.y = ky;
  }

  /** A screen opened (or closed): every thumb and key held lets go, and the
   * presses and edges waiting are dropped, so nothing carries over. The
   * axes are left for the next update(). */
  block(): void {
    this.stick = null;
    for (const a in this.presses) this.presses[a] = false;
    for (const a in this.holders) { this.holders[a] = null; if (this.els[a]) this.els[a].classList.remove(this.heldClass); }
    for (const a in this.edgeOf) Object.assign(this.edgeOf[a], { down: false, pressed: false, released: false });
    this.keys.clear();
    if (this.o.stick && this.o.stick.onChange) this.o.stick.onChange(null);
  }
  /** Starts the guard: guarded() is true for `seconds` (o.guard by default). */
  guard(seconds: number = this.o.guard || 0): void { this.guardAt = this.clock(); this.guardFor = seconds; }
  /** Is the guard up (a tap now shouldn't count)? */
  guarded(): boolean { return this.clock() - this.guardAt < this.guardFor; }

  // ---- fed by the page (listen), or by a test ----
  /** A key went down: true if it holds an action. A repeat does nothing. */
  keyDown(code: string, repeat = false): boolean {
    const a = (this.o.keys || {})[code];
    if (!a || repeat) return !!a;
    this.keys.add(code);
    if ((this.o.presses || []).includes(a) && !this.isBlocked()) this.press(a);
    return true;
  }
  keyUp(code: string): void { this.keys.delete(code); }
  /** Every key let go (the page lost focus). */
  keysOff(): void { this.keys.clear(); }
  /** A thumb landed in the stick's zone (`zone`, its box, for `inside`):
   * true if it took the stick. */
  stickDown(id: number, x: number, y: number, zone?: { left: number; top: number; right: number; bottom: number } | null): boolean {
    const S = this.o.stick;
    if (!S || this.isBlocked() || (this.stick && !S.retake)) return false;
    let bx = x, by = y;
    if (S.inside && zone) {
      const R = S.radius;
      bx = clamp(x, zone.left + R, Math.max(zone.left + R, zone.right - R));
      by = clamp(y, zone.top + R, Math.max(zone.top + R, zone.bottom - R));
    }
    this.stick = { id, bx, by, x, y, t0: this.nowMs(), x0: x, y0: y, flicked: false };
    if (S.onChange) S.onChange(this.stick);
    return true;
  }
  stickMove(id: number, x: number, y: number): void {
    const s = this.stick, S = this.o.stick;
    if (!s || !S || s.id !== id) return;
    s.x = x; s.y = y;
    const F = S.flick;
    if (F && !s.flicked) {
      const fx = s.x - s.x0, fy = s.y - s.y0;
      if (this.nowMs() - s.t0 < F.ms && Math.hypot(fx, fy) > F.px) {
        s.flicked = true;
        const len = Math.hypot(fx, fy) || 1;
        this.press(F.action, { x: fx / len, y: fy / len });
      }
    }
    if (S.onChange) S.onChange(s);
  }
  stickUp(id: number): void {
    if (!this.stick || this.stick.id !== id) return;
    this.stick = null;
    if (this.o.stick && this.o.stick.onChange) this.o.stick.onChange(null);
  }
  /** A pointer landed on a button holding `action`: true if it took it. */
  buttonDown(action: string, id: number): boolean {
    if (this.isBlocked()) return false;
    this.holders[action] = id;
    if (this.els[action]) this.els[action].classList.add(this.heldClass);
    if ((this.o.presses || []).includes(action)) this.press(action);
    return true;
  }
  buttonUp(action: string, id: number): void {
    if (this.holders[action] !== id) return;
    this.holders[action] = null;
    if (this.els[action]) this.els[action].classList.remove(this.heldClass);
  }

  /** Wires the controls to the page. Returns a function that unwires them. */
  listen(L: ListenOptions = {}): () => void {
    const off: (() => void)[] = [];
    const on = (el: EventTarget, type: string, fn: (e: any) => void, opt?: AddEventListenerOptions) => { el.addEventListener(type, fn, opt); off.push(() => el.removeEventListener(type, fn, opt)); };
    const capture = (el: HTMLElement, id: number) => { try { el.setPointerCapture(id); } catch (err) { /* a synthetic pointer */ } };
    const touch = () => { if (L.onTouch) L.onTouch(); };
    this.heldClass = L.heldClass || 'held';
    const kb = L.keyboard === undefined ? (typeof window !== 'undefined' ? window : null) : L.keyboard;
    if (kb) {
      const prevent = new Set(L.prevent || Object.keys(this.o.keys || {}));
      on(kb, 'keydown', (e: KeyboardEvent) => { if (prevent.has(e.code) && !this.isBlocked()) e.preventDefault(); this.keyDown(e.code, e.repeat); });
      on(kb, 'keyup', (e: KeyboardEvent) => { if (L.preventUp && prevent.has(e.code)) e.preventDefault(); this.keyUp(e.code); });
      on(kb, 'blur', () => this.keysOff());
    }
    const zone = L.stick;
    if (zone) {
      on(zone, 'pointerdown', (e: PointerEvent) => {
        if (!this.stickDown(e.pointerId, e.clientX, e.clientY, this.o.stick && this.o.stick.inside ? zone.getBoundingClientRect() : null)) return;
        e.preventDefault(); touch(); capture(zone, e.pointerId);
      });
      on(zone, 'pointermove', (e: PointerEvent) => this.stickMove(e.pointerId, e.clientX, e.clientY));
      const up = (e: PointerEvent) => this.stickUp(e.pointerId);
      on(zone, 'pointerup', up); on(zone, 'pointercancel', up);
    }
    for (const [a, el] of Object.entries(L.buttons || {})) {
      this.els[a] = el;
      if (!(a in this.holders)) this.holders[a] = null;
      on(el, 'pointerdown', (e: PointerEvent) => { if (!this.buttonDown(a, e.pointerId)) return; e.preventDefault(); touch(); capture(el, e.pointerId); });
      const end = (e: PointerEvent) => this.buttonUp(a, e.pointerId);
      on(el, 'pointerup', end); on(el, 'pointercancel', end);
    }
    for (const [a, el] of Object.entries(L.taps || {})) {
      on(el, 'pointerdown', (e: PointerEvent) => { if (this.isBlocked()) return; e.preventDefault(); touch(); this.press(a); });
    }
    return () => { for (const f of off.splice(0)) f(); };
  }

  private botField(kind: 'held' | 'press', action: string): string | null {
    const map = this.o.bot && this.o.bot[kind];
    if (kind === 'held') return (map && map[action]) || action;
    return (map && map[action]) || null;
  }
  private clock(): number { return this.o.clock ? this.o.clock() : this.nowMs() / 1000; }
  private nowMs(): number { return this.o.now ? this.o.now() : typeof performance !== 'undefined' ? performance.now() : 0; }
}

// ---- gestures ---------------------------------------------------------------

export interface GestureOptions {
  /** One pointer dragged by (dx, dy). */
  onPan?: (dx: number, dy: number) => void;
  /** Two pointers moved: the zoom (the new distance between them over the
   * old; null when they were closer than `pinchMin`), about (x, y), their
   * middle now; and how far the middle moved (dx, dy; zero unless
   * `pinchPan`). */
  onPinch?: (k: number | null, x: number, y: number, dx: number, dy: number) => void;
  /** A tap at (x, y). */
  onTap?: (x: number, y: number) => void;
  /** A lift is a tap if the pointers have moved less than this, all told,
   * since one last landed (a pinch counts as far). */
  travel?: number;
  /** Or a tap is a lone pointer lifted within `near` of where it landed
   * (and within `ms` of landing, if given). */
  near?: number | (() => number);
  ms?: number;
  /** Two pointers moving together pan as well as pinch. */
  pinchPan?: boolean;
  /** Pointers closer than this don't zoom (0: any distance but none). */
  pinchMin?: number;
  /** The clock a tap is timed by, in ms (by default performance.now). */
  now?: () => number;
}

/** Drag, pinch and tap for a map view, from pointers' positions (in whatever
 * units the game feeds: the thresholds are in the same). One or two pointers
 * move the view; more do nothing until they're two again. */
export class Gestures {
  o: GestureOptions;
  /** The pointers down: id to where each is. */
  pts = new Map<number, { x: number; y: number }>();
  /** How far the pointers have moved since one last landed. */
  moved = 0;
  /** A lone pointer that may be a tap: where and when it landed. */
  tap: { x: number; y: number; t: number } | null = null;
  constructor(o: GestureOptions = {}) { this.o = o; }

  down(id: number, x: number, y: number): void {
    this.pts.set(id, { x, y });
    this.moved = 0;
    this.tap = this.pts.size === 1 ? { x, y, t: this.now() } : null;
  }
  move(id: number, x: number, y: number): void {
    const P = this.pts, p = P.get(id), o = this.o;
    if (!p) return;
    if (P.size === 1) {
      const dx = x - p.x, dy = y - p.y;
      this.moved += Math.abs(dx) + Math.abs(dy);
      if (this.tap && o.near !== undefined && Math.hypot(x - this.tap.x, y - this.tap.y) > this.nearPx()) this.tap = null;
      p.x = x; p.y = y;
      if (o.onPan) o.onPan(dx, dy);
    } else if (P.size === 2) {
      const [a, b] = [...P.values()], other = a === p ? b : a;
      const d0 = Math.hypot(p.x - other.x, p.y - other.y), d1 = Math.hypot(x - other.x, y - other.y);
      const mx0 = (p.x + other.x) / 2, my0 = (p.y + other.y) / 2;
      p.x = x; p.y = y;
      const mx1 = (p.x + other.x) / 2, my1 = (p.y + other.y) / 2;
      this.moved = Infinity;
      if (o.onPinch) o.onPinch(d0 > (o.pinchMin || 0) ? d1 / d0 : null, mx1, my1, o.pinchPan ? mx1 - mx0 : 0, o.pinchPan ? my1 - my0 : 0);
    }
  }
  /** A pointer lifted (or cancelled: never a tap). */
  up(id: number, x: number, y: number, cancel = false): void {
    const o = this.o, was = this.pts.size, t = this.tap;
    this.pts.delete(id);
    this.tap = null;
    let tap = !cancel;
    if (o.travel !== undefined) tap = tap && this.moved < o.travel;
    if (o.near !== undefined || o.ms !== undefined) tap = tap && was === 1 && !!t && (o.ms === undefined || this.now() - t.t < o.ms);
    if (tap && o.onTap) o.onTap(x, y);
  }
  /** Wires a view's element to it: `at(e)` gives a pointer's position (by
   * default its client x and y). Returns a function that unwires it. */
  listen(el: HTMLElement, at: (e: PointerEvent) => [number, number] = (e) => [e.clientX, e.clientY], opt: { prevent?: boolean } = {}): () => void {
    const fns: [string, (e: PointerEvent) => void][] = [
      ['pointerdown', (e) => { if (opt.prevent) e.preventDefault(); el.setPointerCapture(e.pointerId); const [x, y] = at(e); this.down(e.pointerId, x, y); }],
      ['pointermove', (e) => { if (!this.pts.has(e.pointerId)) return; const [x, y] = at(e); this.move(e.pointerId, x, y); }],
      ['pointerup', (e) => { const [x, y] = at(e); this.up(e.pointerId, x, y); }],
      ['pointercancel', (e) => { const [x, y] = at(e); this.up(e.pointerId, x, y, true); }],
    ];
    for (const [type, fn] of fns) el.addEventListener(type, fn as EventListener);
    return () => { for (const [type, fn] of fns) el.removeEventListener(type, fn as EventListener); };
  }
  private nearPx(): number { const n = this.o.near; return typeof n === 'function' ? n() : n || 0; }
  private now(): number { return this.o.now ? this.o.now() : typeof performance !== 'undefined' ? performance.now() : 0; }
}
