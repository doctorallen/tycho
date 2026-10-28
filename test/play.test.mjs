// The play parts (input, items, guide) against the games' own code, which
// they replaced: the White Dragon's and Lodestar's controls, map gestures,
// shelf, pockets and carried motes, and the White Dragon's tutorial. Each
// game's original is kept here as it was, and so is the thin layer each game
// now keeps over Tycho's part, and the two are driven side by side with the
// same events and asked the same things.
//
// What's held to the originals is play with one device at a time, as people
// play: the controls agree on everything a game reads. Where the two games'
// own code disagreed with itself, Tycho's part does the plainer thing, and
// the sequences here leave those cases out (said where they're made):
//   - the White Dragon tracked a key by its action, so with two keys for one
//     action down (ArrowLeft and A), letting one go let go of the action;
//     Tycho tracks each key, as Lodestar did;
//   - a White Dragon button was let go by any finger lifting from it, with
//     two on it; Tycho's is held by the last finger down, as Lodestar's was;
//   - the White Dragon's axes and buttons, with keys and thumbs both down,
//     went to whichever spoke last (a button let up read as let go with its
//     key still held; the stick lifted read as still, keys held); Tycho's read
//     the stick while a thumb is on it, else the keys, and hold an action
//     while anything holds it;
//   - the White Dragon's map panned with three fingers down and kept a
//     finger the browser cancelled; Tycho's ignores a third finger, as
//     Lodestar's did, and forgets a cancelled one;
//   - Lodestar's mining() read as held always without a bot (a button it no
//     longer has); nothing draws from it now, and Tycho's reads Space or L.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as Tycho from '../dist/tycho.mjs';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- a page to drive: elements, events, a window --------------------------
class El {
  constructor(rect = { left: 0, top: 0, right: 400, bottom: 300 }) {
    this.ls = {}; this.cls = new Set(); this.style = {}; this.hidden = false;
    this.rect = { ...rect, width: rect.right - rect.left, height: rect.bottom - rect.top };
    this.width = this.rect.width; this.height = this.rect.height;
    const c = this.cls;
    this.classList = { add: (x) => c.add(x), remove: (x) => c.delete(x), contains: (x) => c.has(x) };
  }
  addEventListener(t, f) { (this.ls[t] = this.ls[t] || []).push(f); }
  removeEventListener(t, f) { this.ls[t] = (this.ls[t] || []).filter((g) => g !== f); }
  setPointerCapture() {}
  getBoundingClientRect() { return this.rect; }
  fire(t, e) { for (const f of this.ls[t] || []) f(e); if (this['on' + t]) this['on' + t](e); return e; }
}
const ev = (o) => Object.assign({ prevented: false, repeat: false, preventDefault() { this.prevented = true; } }, o);
// a seeded stream for the sequences
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
// (objects made in a page's realm compared as plain values)
const plain = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));

// ---- the White Dragon's controls -------------------------------------------
const WD_INPUT_ORIGINAL = String.raw`'use strict';
const Input = {
  ax: 0, ay: 0, jump: false, use: false, jumpHit: false, useHit: false,
  keys: new Set(), stick: null, touch: false, bot: null,
  init() {
    const map = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', Space: 'j', KeyK: 'j', KeyE: 'e', KeyF: 'e', ShiftLeft: 'slow', ShiftRight: 'slow' };
    addEventListener('keydown', (e) => {
      if (e.repeat) { if (map[e.code]) e.preventDefault(); return; }
      const k = map[e.code];
      if (k) { this.keys.add(k); if (k === 'j') this.jumpHit = true; if (k === 'e') this.useHit = true; e.preventDefault(); }
      if (e.code === 'KeyI' || e.code === 'Tab') { Hud.toggle('pack'); e.preventDefault(); }
      if (e.code === 'KeyM') Hud.toggle('map');
      if (e.code === 'Escape') Hud.toggle(Hud.open ? Hud.open : 'pause');
      this.fromKeys();
    });
    addEventListener('keyup', (e) => { const k = map[e.code]; if (k) { this.keys.delete(k); this.fromKeys(); } });
    addEventListener('blur', () => { this.keys.clear(); this.fromKeys(); });
    // the stick
    const pad = $('stickzone'), base = $('stick'), knob = $('knob');
    pad.addEventListener('pointerdown', (e) => {
      this.touch = true; document.body.classList.add('touch');
      this.stick = { id: e.pointerId, x: e.clientX, y: e.clientY };
      pad.setPointerCapture(e.pointerId);
      base.style.left = e.clientX + 'px'; base.style.top = e.clientY + 'px'; base.classList.add('on');
      knob.style.transform = 'translate(-50%,-50%)';
      e.preventDefault();
    });
    pad.addEventListener('pointermove', (e) => {
      if (!this.stick || e.pointerId !== this.stick.id) return;
      const R = 34, dx = clamp(e.clientX - this.stick.x, -R, R), dy = clamp(e.clientY - this.stick.y, -R, R);
      this.ax = Math.abs(dx) > R * 0.2 ? dx / R : 0; this.ay = Math.abs(dy) > R * 0.45 ? dy / R : 0;
      knob.style.transform = ${'`'}translate(calc(-50% + ${'${dx}'}px), calc(-50% + ${'${dy}'}px))${'`'};
    });
    const up = (e) => { if (!this.stick || e.pointerId !== this.stick.id) return; this.stick = null; this.ax = 0; this.ay = 0; base.classList.remove('on'); };
    pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
    // the buttons
    const hold = (el, on, off) => {
      el.addEventListener('pointerdown', (e) => { this.touch = true; document.body.classList.add('touch'); el.setPointerCapture(e.pointerId); el.classList.add('down'); on(); e.preventDefault(); });
      const end = () => { if (!el.classList.contains('down')) return; el.classList.remove('down'); off(); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    };
    hold($('bJump'), () => { this.jump = true; this.jumpHit = true; }, () => { this.jump = false; });
    hold($('bUse'), () => { this.use = true; this.useHit = true; }, () => { this.use = false; });
  },
  fromKeys() {
    const k = this.keys;
    if (!this.stick) { this.ax = ((k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0)) * (k.has('slow') ? 0.4 : 1); this.ay = (k.has('d') ? 1 : 0) - (k.has('u') ? 1 : 0); }
    this.jump = k.has('j') || $('bJump').classList.contains('down');
    this.use = k.has('e') || $('bUse').classList.contains('down');
  },
  take(name) { const v = this[name]; this[name] = false; return v; },
  apply() { if (!this.bot) return; const b = this.bot; this.ax = b.ax || 0; this.ay = b.ay || 0; this.jump = !!b.jump; this.use = !!b.use; },
};`;

// the White Dragon's js/input.js now
const WD_INPUT_NOW = String.raw`'use strict';
const Input = {
  ax: 0, ay: 0, jump: false, use: false, touch: false,
  C: new Tycho.input.Controls({
    keys: { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'jump', KeyK: 'jump', KeyE: 'use', KeyF: 'use', ShiftLeft: 'slow', ShiftRight: 'slow' },
    axes: { left: 'left', right: 'right', up: 'up', down: 'down', slow: { action: 'slow', x: 0.4 } },
    presses: ['jump', 'use'],
    stick: { radius: 34, deadAxes: [0.2, 0.45], retake: true, onChange: (s) => Input.drawStick(s) },
    bot: { x: 'ax', y: 'ay' },
  }),
  get bot() { return this.C.bot; },
  set bot(b) { this.C.bot = b; },
  get jumpHit() { return this.C.presses.jump || false; },
  set jumpHit(v) { this.C.presses.jump = v; },
  get useHit() { return this.C.presses.use || false; },
  set useHit(v) { this.C.presses.use = v; },
  init() {
    this.C.listen({ stick: $('stickzone'), buttons: { jump: $('bJump'), use: $('bUse') }, heldClass: 'down', onTouch: () => { this.touch = true; document.body.classList.add('touch'); } });
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'KeyI' || e.code === 'Tab') { Hud.toggle('pack'); e.preventDefault(); }
      if (e.code === 'KeyM') Hud.toggle('map');
      if (e.code === 'Escape') Hud.toggle(Hud.open ? Hud.open : 'pause');
    });
  },
  drawStick(s) {
    const base = $('stick'), knob = $('knob');
    if (!s) { base.classList.remove('on'); return; }
    if (s.x === s.x0 && s.y === s.y0) { base.style.left = s.bx + 'px'; base.style.top = s.by + 'px'; base.classList.add('on'); knob.style.transform = 'translate(-50%,-50%)'; return; }
    const R = 34, dx = clamp(s.x - s.bx, -R, R), dy = clamp(s.y - s.by, -R, R);
    knob.style.transform = ${'`'}translate(calc(-50% + ${'${dx}'}px), calc(-50% + ${'${dy}'}px))${'`'};
  },
  take(name) { const v = this[name]; this[name] = false; return v; },
  apply() { const C = this.C; C.update(); this.ax = C.move.x; this.ay = C.move.y; this.jump = C.held('jump'); this.use = C.held('use'); },
};`;

function wdWorld(code) {
  const win = new El(), body = new El(), hud = [];
  const els = { stickzone: new El({ left: 0, top: 0, right: 300, bottom: 300 }), stick: new El(), knob: new El(), bJump: new El(), bUse: new El() };
  const ctx = vm.createContext({ Tycho, clamp, Math, $: (id) => els[id], Hud: { open: null, toggle: (w) => hud.push(w) }, addEventListener: (t, f) => win.addEventListener(t, f), document: { body } });
  vm.runInContext(code + '\nthis.Input = Input;', ctx);
  globalThis.window = win;
  ctx.Input.init();
  delete globalThis.window;
  return { I: ctx.Input, win, els, body, hud };
}
const knobOf = (t) => (t === 'translate(-50%,-50%)' ? 'translate(calc(-50% + 0px), calc(-50% + 0px))' : t);
function wdLook(w) {
  const { I, els, body, hud } = w;
  return { ax: I.ax, ay: I.ay, jump: I.jump, use: I.use, touch: body.cls.has('touch'), on: els.stick.cls.has('on'), left: els.stick.style.left, top: els.stick.style.top, knob: knobOf(els.knob.style.transform), jd: els.bJump.cls.has('down'), ud: els.bUse.cls.has('down'), hud: hud.join() };
}

test("the White Dragon's controls: keys, stick, buttons, presses and the bot as they were", () => {
  const CODES = ['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD', 'ArrowUp', 'KeyW', 'ArrowDown', 'KeyS', 'Space', 'KeyK', 'KeyE', 'KeyF', 'ShiftLeft', 'ShiftRight'];
  const ACTION = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', Space: 'j', KeyK: 'j', KeyE: 'e', KeyF: 'e', ShiftLeft: 's', ShiftRight: 's' };
  for (let seq = 0; seq < 60; seq++) {
    const r = rng(1000 + seq), A = wdWorld(WD_INPUT_ORIGINAL), B = wdWorld(WD_INPUT_NOW), both = [A, B];
    const keysOnly = seq % 2 === 0, down = new Set(), btn = { bJump: null, bUse: null };
    let stick = null, pid = 10;
    const send = (where, type, o) => { const es = both.map((w) => (where === 'win' ? w.win : w.els[where]).fire(type, ev(o))); assert.equal(es[0].prevented, es[1].prevented, `${where} ${type} ${JSON.stringify(o)} prevented`); };
    for (let n = 0; n < 160; n++) {
      const x = r();
      if (x < 0.12) { // a step: the game reads what it reads
        for (const w of both) w.I.apply();
        assert.deepEqual(wdLook(B), wdLook(A), `seq ${seq} step ${n}`);
        if (r() < 0.6) assert.deepEqual([B.I.take('jumpHit'), B.I.take('useHit')], [A.I.take('jumpHit'), A.I.take('useHit')]);
      } else if (x < 0.16 && !down.size && !stick && !btn.bJump && !btn.bUse) { // a bot, then let go as the smoke test does (with nothing else held)
        const bot = { ax: pick(r, [0, 1, -1, 0.4, -0.25]), ay: pick(r, [0, 1, -1]), jump: r() < 0.5, use: r() < 0.5 };
        for (const w of both) { w.I.bot = { ...bot }; w.I.apply(); }
        assert.deepEqual(wdLook(B), wdLook(A));
        if (r() < 0.5) { for (const w of both) w.I.useHit = true; }
        for (const w of both) { w.I.apply(); w.I.bot = null; w.I.ax = w.I.ay = 0; w.I.use = w.I.jump = false; }
      } else if (keysOnly) {
        const c = pick(r, CODES.concat(['KeyI', 'Tab', 'KeyM', 'Escape', 'KeyQ']));
        if (x < 0.2) { for (const w of both) w.win.fire('blur', ev({})); down.clear(); }
        else if (down.has(c)) { if (r() < 0.3) send('win', 'keydown', { code: c, repeat: true }); else { send('win', 'keyup', { code: c }); down.delete(c); } }
        else if (!ACTION[c] || ![...down].some((d) => ACTION[d] === ACTION[c])) { send('win', 'keydown', { code: c }); if (ACTION[c]) down.add(c); else send('win', 'keyup', { code: c }); }
      } else {
        const where = pick(r, ['stickzone', 'stickzone', 'stickzone', 'bJump', 'bUse']), px = Math.round(r() * 300), py = Math.round(r() * 300);
        if (where === 'stickzone') {
          if (!stick) { stick = ++pid; send('stickzone', 'pointerdown', { pointerId: stick, clientX: px, clientY: py }); }
          else if (r() < 0.8) send('stickzone', 'pointermove', { pointerId: r() < 0.9 ? stick : 99, clientX: px, clientY: py });
          else { send('stickzone', r() < 0.5 ? 'pointerup' : 'pointercancel', { pointerId: stick, clientX: px, clientY: py }); stick = null; }
        } else if (btn[where] === null) { btn[where] = ++pid; send(where, 'pointerdown', { pointerId: btn[where] }); }
        else { send(where, 'pointerup', { pointerId: btn[where] }); btn[where] = null; }
      }
    }
  }
});

// ---- Lodestar's controls ----------------------------------------------------
const LODE_INPUT_ORIGINAL = String.raw`'use strict';
const STICK_R = 44; // CSS px
const STICK_DEAD = 6;
const HOLD_BUTTONS = { main: 'btn-main', off: 'btn-off', act: 'btn-act' };
const HOLD_KEYS = { main: ['KeyJ'], off: ['KeyK'], mine: ['Space', 'KeyL'], act: ['KeyE', 'Enter'] };
const DASH_KEYS = ['ShiftLeft', 'ShiftRight', 'KeyU'];
const Input = {
  move: { x: 0, y: 0 },
  stick: null,
  held: { main: null, off: null, act: null },
  actReq: false,
  dashReq: null,
  keys: new Set(),
  bot: null,
  hands: { main: { down: false, pressed: false, released: false }, off: { down: false, pressed: false, released: false } },
  isHeld(k) {
    if (this.bot) return !!this.bot[k === 'act' ? 'actHeld' : k];
    return this.held[k] !== null || HOLD_KEYS[k].some((c) => this.keys.has(c));
  },
  mining() { return this.isHeld('mine'); },
  hand(slot) {
    const h = this.hands[slot], out = { down: h.down, pressed: h.pressed, released: h.released };
    h.pressed = false; h.released = false;
    return out;
  },
  consumeDash() {
    if (this.bot) { const a = !!this.bot.dash; this.bot.dash = false; return a; }
    const r = this.dashReq; this.dashReq = null; return r;
  },
  consumeAct() {
    if (this.bot) { const a = !!this.bot.act; this.bot.act = false; return a; }
    const a = this.actReq; this.actReq = false; return a;
  },
  update() {
    for (const k of ['main', 'off']) {
      const h = this.hands[k], now = this.isHeld(k);
      if (now && !h.down) h.pressed = true;
      if (!now && h.down) h.released = true;
      h.down = now;
    }
    if (this.bot) { this.move.x = this.bot.x || 0; this.move.y = this.bot.y || 0; return; }
    const s = this.stick;
    if (s) {
      let dx = (s.x - s.bx) / STICK_R, dy = (s.y - s.by) / STICK_R;
      const m = Math.hypot(dx, dy);
      if (m * STICK_R < STICK_DEAD) dx = dy = 0;
      else if (m > 1) { dx /= m; dy /= m; }
      this.move.x = dx; this.move.y = dy;
      return;
    }
    const k = this.keys;
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const ky = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    const m = Math.hypot(kx, ky) || 1;
    this.move.x = kx / m; this.move.y = ky / m;
  },
  block() {
    this.stick = null;
    this.actReq = false;
    for (const k in this.held) { this.held[k] = null; $(HOLD_BUTTONS[k]).classList.remove('held'); }
    for (const k in this.hands) Object.assign(this.hands[k], { down: false, pressed: false, released: false });
    this.dashReq = null;
    this.keys.clear();
    drawStick();
  },
};
function drawStick() {
  const s = Input.stick, base = $('stick-base');
  if (!s) { base.hidden = true; return; }
  base.hidden = false;
  base.style.left = s.bx - STICK_R + 'px';
  base.style.top = s.by - STICK_R + 'px';
  let dx = s.x - s.bx, dy = s.y - s.by;
  const m = Math.hypot(dx, dy);
  if (m > STICK_R) { dx *= STICK_R / m; dy *= STICK_R / m; }
  $('stick-knob').style.transform = ${'`'}translate(${'${dx}'}px, ${'${dy}'}px)${'`'};
}
function setupInput() {
  const left = $('deck-left');
  left.addEventListener('pointerdown', (e) => {
    if (Game.modal || Input.stick) return;
    e.preventDefault();
    const r = left.getBoundingClientRect();
    const bx = clamp(e.clientX, r.left + STICK_R, Math.max(r.left + STICK_R, r.right - STICK_R));
    const by = clamp(e.clientY, r.top + STICK_R, Math.max(r.top + STICK_R, r.bottom - STICK_R));
    Input.stick = { id: e.pointerId, bx, by, x: e.clientX, y: e.clientY, t0: performance.now(), x0: e.clientX, y0: e.clientY, flicked: false };
    try { left.setPointerCapture(e.pointerId); } catch (err) { }
    drawStick();
  });
  left.addEventListener('pointermove', (e) => {
    const s = Input.stick;
    if (!s || s.id !== e.pointerId) return;
    s.x = e.clientX; s.y = e.clientY;
    const fx = s.x - s.x0, fy = s.y - s.y0;
    if (!s.flicked && performance.now() - s.t0 < T.dash.flickMs && Math.hypot(fx, fy) > T.dash.flickPx) { s.flicked = true; Input.dashReq = norm(fx, fy); }
    drawStick();
  });
  const endStick = (e) => { if (Input.stick && Input.stick.id === e.pointerId) { Input.stick = null; drawStick(); } };
  left.addEventListener('pointerup', endStick);
  left.addEventListener('pointercancel', endStick);
  for (const [k, id] of Object.entries(HOLD_BUTTONS)) {
    const btn = $(id);
    btn.addEventListener('pointerdown', (e) => {
      if (Game.modal) return;
      e.preventDefault();
      Input.held[k] = e.pointerId;
      try { btn.setPointerCapture(e.pointerId); } catch (err) { }
      btn.classList.add('held');
    });
    const end = (e) => { if (Input.held[k] === e.pointerId) { Input.held[k] = null; btn.classList.remove('held'); } };
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);
  }
  $('btn-dash').addEventListener('pointerdown', (e) => {
    if (Game.modal) return;
    e.preventDefault();
    Input.dashReq = true;
  });
  $('btn-act').addEventListener('pointerdown', (e) => {
    if (Game.modal) return;
    e.preventDefault();
    Input.actReq = true;
  });
  const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code) && !Game.modal) e.preventDefault();
    if (e.repeat) return;
    if ((e.code === 'Escape' || e.code === 'KeyP') && Game.dive) {
      if (Game.modal === 'screen-story') { }
      else if (Game.modal) UI.close();
      else UI.openPause();
      return;
    }
    if ((e.code === 'KeyE' || e.code === 'Enter') && !Game.modal) Input.actReq = true;
    if (DASH_KEYS.includes(e.code) && !Game.modal) Input.dashReq = true;
    Input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => { if (GAME_KEYS.has(e.code)) e.preventDefault(); Input.keys.delete(e.code); });
  window.addEventListener('blur', () => Input.keys.clear());
}`;

// Lodestar's js/input.js now (its header comment left out)
const LODE_INPUT_NOW = String.raw`'use strict';
const STICK_R = 44; // CSS px
const STICK_DEAD = 6;
const Input = {
  C: new Tycho.input.Controls({
    keys: {
      KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      KeyJ: 'main', KeyK: 'off', Space: 'mine', KeyL: 'mine', KeyE: 'act', Enter: 'act', ShiftLeft: 'dash', ShiftRight: 'dash', KeyU: 'dash',
    },
    axes: { left: 'left', right: 'right', up: 'up', down: 'down', round: true },
    presses: ['act', 'dash'],
    edges: ['main', 'off'],
    stick: { radius: STICK_R, dead: STICK_DEAD, inside: true, flick: { action: 'dash', get ms() { return T.dash.flickMs; }, get px() { return T.dash.flickPx; } }, onChange: () => drawStick() },
    bot: { held: { act: 'actHeld' }, press: { act: 'act', dash: 'dash' } },
    blocked: () => !!Game.modal,
    get guard() { return T.ui.tapGuard; },
    clock: () => Game.realT,
  }),
  get move() { return this.C.move; },
  get stick() { return this.C.stick; },
  get bot() { return this.C.bot; },
  set bot(b) { this.C.bot = b; },
  isHeld(k) { return this.C.held(k); },
  mining() { return this.isHeld('mine'); },
  hand(slot) { return this.C.edges(slot); },
  consumeDash() { return this.C.take('dash'); },
  consumeAct() { return this.C.take('act'); },
  update() { this.C.update(); },
  block() { this.C.block(); },
  guard(s) { this.C.guard(s); },
  guarded() { return this.C.guarded(); },
};
function drawStick() {
  const s = Input.stick, base = $('stick-base');
  if (!s) { base.hidden = true; return; }
  base.hidden = false;
  base.style.left = s.bx - STICK_R + 'px';
  base.style.top = s.by - STICK_R + 'px';
  let dx = s.x - s.bx, dy = s.y - s.by;
  const m = Math.hypot(dx, dy);
  if (m > STICK_R) { dx *= STICK_R / m; dy *= STICK_R / m; }
  $('stick-knob').style.transform = ${'`'}translate(${'${dx}'}px, ${'${dy}'}px)${'`'};
}
function setupInput() {
  Input.C.listen({
    stick: $('deck-left'),
    buttons: { main: $('btn-main'), off: $('btn-off'), act: $('btn-act') },
    taps: { dash: $('btn-dash') },
    prevent: ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
    preventUp: true,
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if ((e.code === 'Escape' || e.code === 'KeyP') && Game.dive) {
      if (Game.modal === 'screen-story') { }
      else if (Game.modal) UI.close();
      else UI.openPause();
    }
  });
  Input.guard();
}`;

const clock = { t: 1000 };
function lodeWorld(code) {
  const win = new El();
  const els = { 'deck-left': new El({ left: 0, top: 200, right: 180, bottom: 400 }), 'btn-main': new El(), 'btn-off': new El(), 'btn-act': new El(), 'btn-dash': new El(), 'stick-base': new El(), 'stick-knob': new El() };
  const ctx = vm.createContext({
    Tycho, clamp, Math, window: win, $: (id) => els[id], performance: { now: () => clock.t },
    norm: (x, y) => { const m = Math.hypot(x, y) || 1; return { x: x / m, y: y / m }; },
    T: { dash: { flickMs: 90, flickPx: 26 }, ui: { tapGuard: 0.4 } },
  });
  vm.runInContext('var Game = { modal: null, dive: {}, realT: 0 }; var UI = { log: [], close() { Game.modal = null; Input.block(); this.log.push("close"); }, openPause() { Game.modal = "screen-pause"; this.log.push("pause"); } };', ctx);
  vm.runInContext(code + '\nthis.Input = Input; this.setupInput = setupInput;', ctx);
  globalThis.window = win;
  ctx.setupInput();
  delete globalThis.window;
  return { ctx, I: ctx.Input, win, els };
}
function lodeLook(w) {
  const { I, els, ctx } = w, b = els['stick-base'];
  return plain({ move: I.move, act: I.isHeld('act'), main: I.isHeld('main'), off: I.isHeld('off'), base: [b.hidden, b.style.left, b.style.top, els['stick-knob'].style.transform], held: ['btn-main', 'btn-off', 'btn-act', 'btn-dash'].map((id) => els[id].cls.has('held')).join(), stick: I.stick, ui: ctx.UI.log.join(), modal: ctx.Game.modal });
}

test("Lodestar's controls: keys, the stick and its flick, buttons, hands, blocking and the bot as they were", () => {
  const realNow = performance.now;
  performance.now = () => clock.t;
  try {
    const CODES = ['KeyW', 'ArrowUp', 'KeyS', 'ArrowDown', 'KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight', 'KeyJ', 'KeyK', 'Space', 'KeyL', 'KeyE', 'Enter', 'ShiftLeft', 'ShiftRight', 'KeyU', 'Escape', 'KeyP', 'KeyQ'];
    for (let seq = 0; seq < 60; seq++) {
      const r = rng(2000 + seq), A = lodeWorld(LODE_INPUT_ORIGINAL), B = lodeWorld(LODE_INPUT_NOW), both = [A, B];
      const down = new Set(), on = { 'deck-left': [], 'btn-main': [], 'btn-off': [], 'btn-act': [] }, landed = {};
      let pid = 10;
      // (the last few events go with a failure, to read it by)
      const hist = [];
      const send = (where, type, o) => {
        hist.push([where, type, JSON.stringify(o), A.ctx.Game.modal].join(' '));
        const es = both.map((w) => (where === 'win' ? w.win : w.els[where]).fire(type, ev(o)));
        assert.equal(es[0].prevented, es[1].prevented, `seq ${seq}: ${where} ${type} ${JSON.stringify(o)} prevented\n` + hist.slice(-12).join('\n'));
      };
      for (let n = 0; n < 200; n++) {
        const x = r();
        clock.t += pick(r, [8, 8, 8, 30, 85, 95, 120]);
        if (x < 0.12) { // a step
          for (const w of both) { w.ctx.Game.realT += 1 / 60; w.I.update(); }
          assert.deepEqual(lodeLook(B), lodeLook(A), `seq ${seq} step ${n}`);
          assert.deepEqual(plain([B.I.hand('main'), B.I.hand('off')]), plain([A.I.hand('main'), A.I.hand('off')]));
          if (r() < 0.7) { const d = [B.I.consumeDash(), A.I.consumeDash()]; assert.deepEqual(plain(d[0] || null), plain(d[1] || null)); assert.equal(B.I.consumeAct(), A.I.consumeAct()); }
        } else if (x < 0.15) { // a bot
          const bot = { x: pick(r, [0, 1, -0.5]), y: pick(r, [0, -1]), main: r() < 0.5, off: r() < 0.3, mine: r() < 0.5, act: r() < 0.5, actHeld: r() < 0.5, dash: r() < 0.5 };
          for (const w of both) { w.I.bot = { ...bot }; w.I.update(); }
          assert.deepEqual(lodeLook(B), lodeLook(A));
          assert.equal(B.I.mining(), A.I.mining());
          assert.deepEqual(plain([B.I.hand('main'), B.I.consumeDash(), B.I.consumeAct(), B.I.consumeDash()]), plain([A.I.hand('main'), A.I.consumeDash(), A.I.consumeAct(), A.I.consumeDash()]));
          for (const w of both) { w.I.update(); w.I.bot = null; }
        } else if (x < 0.19) { // a screen opens or closes
          const m = r() < 0.5 ? 'screen-x' : null;
          for (const w of both) { w.ctx.Game.modal = m; if (r() < 2) w.I.block(); }
          for (const k in on) on[k] = [];
        } else if (x < 0.5) { // keys
          const c = pick(r, CODES);
          if (x < 0.21) { for (const w of both) w.win.fire('blur', ev({})); down.clear(); }
          else if (down.has(c)) { if (r() < 0.3) send('win', 'keydown', { code: c, repeat: true }); else { send('win', 'keyup', { code: c }); down.delete(c); } }
          else { send('win', 'keydown', { code: c }); down.add(c); }
        } else { // thumbs
          const where = pick(r, ['deck-left', 'deck-left', 'deck-left', 'btn-main', 'btn-off', 'btn-act', 'btn-dash']), px = Math.round(r() * 200), py = 180 + Math.round(r() * 240);
          if (where === 'btn-dash') { send(where, 'pointerdown', { pointerId: ++pid }); continue; }
          const L = on[where];
          if (!L.length || (L.length < 2 && r() < 0.25)) { L.push(++pid); landed[pid] = [px, py]; send(where, 'pointerdown', { pointerId: pid, clientX: px, clientY: py }); }
          else if (where === 'deck-left' && r() < 0.75) {
            // (often near where it landed, about a flick's distance)
            const id = pick(r, L), a = r() * 6.3, d = r() < 0.5 ? 20 + r() * 12 : 4 + r() * 5, near = r() < 0.6;
            send(where, 'pointermove', { pointerId: id, clientX: near ? Math.round(landed[id][0] + Math.cos(a) * d) : px, clientY: near ? Math.round(landed[id][1] + Math.sin(a) * d) : py });
          }
          else { const id = L.splice(Math.floor(r() * L.length), 1)[0]; send(where, r() < 0.8 ? 'pointerup' : 'pointercancel', { pointerId: id, clientX: px, clientY: py }); }
        }
      }
    }
  } finally { performance.now = realNow; }
});

test("Lodestar's tap guard: a screen's taps wait as long as they did", () => {
  // the original: UI.openedAt set when a screen shows, set back when a
  // confirm button arms (to guard 0.25 s), and the guard read from it
  const G = 0.4, r = rng(7);
  const c = new Tycho.input.Controls({ guard: G, clock: () => t });
  let t = 0, openedAt = 0;
  c.guard();
  for (let i = 0; i < 2000; i++) {
    t += r() < 0.2 ? 0.3 : 1 / 60;
    const x = r();
    if (x < 0.05) { openedAt = t; c.guard(); }
    else if (x < 0.08) { openedAt = t - G + 0.25; c.guard(0.25); }
    assert.equal(c.guarded(), t - openedAt < G, `at ${t}`);
  }
});

// ---- map gestures --------------------------------------------------------------
// The White Dragon's map (map.js and worldmap.js, the same code), with the
// view's calls written down
function wdMapOriginal(cv, log, { dpr }) {
  const self = { zoom: (k, x, y) => log.push(['zoom', k, x, y]) };
  const pts = new Map(); let moved = 0, pinch = 0;
  cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } };
  cv.onpointermove = (e) => {
    if (!pts.has(e.pointerId)) return; const [px, py] = pts.get(e.pointerId), dx = e.clientX - px, dy = e.clientY - py; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) self.zoom(d / pinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); pinch = d; moved = 99; return; }
    moved += Math.abs(dx) + Math.abs(dy); log.push(['pan', dx * dpr, dy * dpr]);
  };
  cv.onpointerup = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; if (moved < 6) log.push(['tap', e.clientX, e.clientY]); };
}
function wdMapNow(cv, log, { dpr }) {
  new Tycho.input.Gestures({ travel: 6, onPan: (dx, dy) => log.push(['pan', dx * dpr, dy * dpr]), onPinch: (k, x, y) => { if (k !== null) log.push(['zoom', k, x, y]); }, onTap: (x, y) => log.push(['tap', x, y]) }).listen(cv);
}
// Lodestar's map (map.js mapPointer), its view's calls written down
function lodeMapOriginal(cv, log, st) {
  const MapView = { pointers: new Map(), tap: null }, performance = { now: () => st.t };
  function mapPointer(e, kind) {
    const r = cv.getBoundingClientRect(), k = cv.width / r.width, x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k, P = MapView.pointers;
    if (kind === 'down') { P.set(e.pointerId, { x, y }); if (P.size === 1) MapView.tap = { x, y, t: performance.now() }; else MapView.tap = null; return; }
    if (kind === 'move') {
      const p = P.get(e.pointerId);
      if (!p) return;
      if (P.size === 1) {
        log.push(['pan', x - p.x, y - p.y]);
        if (MapView.tap && Math.hypot(x - MapView.tap.x, y - MapView.tap.y) > 10 * k) MapView.tap = null;
        p.x = x; p.y = y;
      } else if (P.size === 2) {
        const [a, b] = [...P.values()], other = a === p ? b : a;
        const d0 = Math.hypot(p.x - other.x, p.y - other.y), d1 = Math.hypot(x - other.x, y - other.y);
        const mx0 = (p.x + other.x) / 2, my0 = (p.y + other.y) / 2;
        p.x = x; p.y = y;
        const mx1 = (p.x + other.x) / 2, my1 = (p.y + other.y) / 2;
        log.push(['mid', mx1 - mx0, my1 - my0]);
        if (d0 > 8) log.push(['zoom', d1 / d0, mx1, my1]); else log.push(['still']);
      }
      return;
    }
    const was = P.size;
    P.delete(e.pointerId);
    if (kind === 'up' && was === 1 && MapView.tap && performance.now() - MapView.tap.t < 400 && st.ok) log.push(['tap', x, y]);
    MapView.tap = null;
  }
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); mapPointer(e, 'down'); });
  cv.addEventListener('pointermove', (e) => mapPointer(e, 'move'));
  cv.addEventListener('pointerup', (e) => mapPointer(e, 'up'));
  cv.addEventListener('pointercancel', (e) => mapPointer(e, 'cancel'));
}
function lodeMapNow(cv, log, st) {
  const k = () => cv.width / cv.getBoundingClientRect().width;
  const at = (e) => { const r = cv.getBoundingClientRect(), s = cv.width / r.width; return [(e.clientX - r.left) * s, (e.clientY - r.top) * s]; };
  new Tycho.input.Gestures({
    near: () => 10 * k(), ms: 400, pinchPan: true, pinchMin: 8, now: () => st.t,
    onPan: (dx, dy) => log.push(['pan', dx, dy]),
    onPinch: (z, x, y, dx, dy) => { log.push(['mid', dx, dy]); if (z !== null) log.push(['zoom', z, x, y]); else log.push(['still']); },
    onTap: (x, y) => { if (st.ok) log.push(['tap', x, y]); },
  }).listen(cv, at, { prevent: true });
}

test('map gestures: drag, pinch and tap as each game had them', () => {
  for (const [name, A0, B0, most, cancel] of [['the White Dragon', wdMapOriginal, wdMapNow, 2, false], ['Lodestar', lodeMapOriginal, lodeMapNow, 3, true]]) {
    for (let seq = 0; seq < 80; seq++) {
      const r = rng(3000 + seq), st = { t: 0, ok: true, dpr: 2 }, logs = [[], []];
      const cvs = [0, 1].map(() => { const c = new El({ left: 30, top: 50, right: 390, bottom: 410 }); c.width = 720; c.height = 720; return c; });
      A0(cvs[0], logs[0], st); B0(cvs[1], logs[1], st);
      const down = [], at = {}, land = {}; let pid = 0;
      for (let n = 0; n < 120; n++) {
        st.t += pick(r, [16, 16, 16, 100, 350, 500]); st.ok = r() < 0.85;
        const x = r(), px = 30 + Math.round(r() * 360), py = 50 + Math.round(r() * 360);
        let type, id;
        if (!down.length || (down.length < most && x < 0.15)) { type = 'pointerdown'; id = ++pid; down.push(id); }
        else if (x < 0.7) { type = 'pointermove'; id = pick(r, down); }
        else { id = down.splice(Math.floor(r() * down.length), 1)[0]; type = cancel && r() < 0.2 ? 'pointercancel' : 'pointerup'; }
        // small moves often, so taps happen
        // (moves are mostly small steps from where the pointer is, so taps and their limits come up)
        let cx = px, cy = py;
        if (type === 'pointerdown') { if (down.length > 1 && r() < 0.5) { const o = at[down[0]]; cx = o[0] + Math.round((r() - 0.5) * 10); cy = o[1] + Math.round((r() - 0.5) * 10); } at[id] = [cx, cy]; land[id] = [cx, cy]; }
        else if (r() < 0.1) { cx = land[id][0] + pick(r, [-10.5, 10, 10.5, 5.5]); cy = land[id][1]; } // (about a tap's reach from where it landed)
        else if (r() < 0.75) { cx = at[id][0] + Math.round((r() - 0.5) * 7); cy = at[id][1] + Math.round((r() - 0.5) * 5); }
        if (type === 'pointermove') at[id] = [cx, cy];
        const e = { pointerId: id, clientX: cx, clientY: cy };
        const es = cvs.map((c) => c.fire(type, ev(e)));
        assert.equal(es[1].prevented, es[0].prevented);
        assert.deepEqual(logs[1], logs[0], `${name}, seq ${seq}, event ${n}`);
      }
    }
  }
});

// ---- items: the White Dragon's shelf and pockets, Lodestar's motes ------------
const WD_PART_KINDS = ['cell', 'board', 'aerial', 'servo', 'relay'];
const WD_GRADES = ['military', 'clinic', 'street', 'scrap'], WD_STATES = ['ok', 'worn', 'dead', 'burnt'];
// parts.js, as it was
const wdShelfOriginal = {
  grades: WD_GRADES, states: WD_STATES,
  have(list, k) { return list.filter((p) => p.k === k); },
  stock(list) {
    return WD_PART_KINDS.map((k) => {
      const mine = list.filter((p) => p.k === k), rows = [];
      for (const g of this.grades) {
        const gauges = [...new Set(mine.filter((p) => p.g === g).map((p) => p.gauge || ''))].sort();
        for (const ga of gauges) {
          const these = mine.filter((p) => p.g === g && (p.gauge || '') === ga), st = {};
          for (const s of this.states) { const n = these.filter((p) => p.st === s).length; if (n) st[s] = n; }
          rows.push({ g, gauge: ga, n: these.length, st });
        }
      }
      return { k, n: mine.length, rows };
    }).filter((x) => x.n);
  },
  choices(list, k, job) {
    const have = this.have(list, k), out = [];
    for (const g of this.grades) for (const s of this.states) {
      const these = have.filter((p) => p.g === g && p.st === s), gauges = [...new Set(these.map((p) => p.gauge || ''))].sort();
      for (const ga of gauges) { const same = these.filter((p) => (p.gauge || '') === ga); out.push({ g, st: s, gauge: ga, n: same.length, id: (same.find((p) => p.how === 'pull' && p.out === job) || same[0]).id }); }
    }
    return out;
  },
};
// parts.js now
const { group, bag, things } = Tycho.items;
const wdShelfNow = {
  grades: WD_GRADES, states: WD_STATES,
  have(list, k) { return things.where(list, { k }); },
  stock(list) {
    return group(list, [{ by: 'k', order: WD_PART_KINDS }, { by: 'g', order: this.grades }, { by: (p) => p.gauge || '' }, { by: 'st', order: this.states }])
      .map(({ key: k, n, groups }) => ({ k, n, rows: groups.flatMap((G) => G.groups.map((ga) => ({ g: G.key, gauge: ga.key, n: ga.n, st: Object.fromEntries(ga.groups.map((s) => [s.key, s.n])) }))) }));
  },
  choices(list, k, job) {
    return group(this.have(list, k), [{ by: 'g', order: this.grades }, { by: 'st', order: this.states }, { by: (p) => p.gauge || '' }])
      .flatMap((G) => G.groups.flatMap((S) => S.groups.map((ga) => ({ g: G.key, st: S.key, gauge: ga.key, n: ga.n, id: (ga.items.find((p) => p.how === 'pull' && p.out === job) || ga.items[0]).id }))));
  },
};

test("the White Dragon's shelf, counted: a card a kind, a row a grade and gauge, a chip a state, and the bench's choices", () => {
  for (let seq = 0; seq < 300; seq++) {
    const r = rng(4000 + seq), list = [], n = Math.floor(r() * 40);
    const holder = {};
    for (let i = 0; i < n; i++) {
      const p = { id: things.nextId(holder, 'pid', 1), k: pick(r, WD_PART_KINDS.concat(['widget'])), g: pick(r, WD_GRADES.concat(['odd'])), st: pick(r, WD_STATES.concat(['odd'])), from: 'd_x', how: pick(r, ['strip', 'trade', 'pull']) };
      const ga = pick(r, [undefined, undefined, 'heavy', 'light', '']); if (ga !== undefined) p.gauge = ga;
      if (p.how === 'pull') p.out = pick(r, ['Job A', 'Job B']);
      list.push(p);
    }
    assert.deepEqual(wdShelfNow.stock(list), wdShelfOriginal.stock(list));
    for (const k of WD_PART_KINDS) for (const job of ['Job A', 'Job B']) assert.deepEqual(wdShelfNow.choices(list, k, job), wdShelfOriginal.choices(list, k, job));
  }
  // a part's make, as Parts.make made it: the id first, then its attributes
  const s = {}, attrs = { k: 'cell', g: 'street', st: 'ok', from: 'd_dragon', how: 'strip' };
  const orig = () => { s.pid = (s.pid || 1) + 1; return Object.assign({ id: s.pid }, attrs, { gauge: 'heavy' }); };
  const a = orig(), b = things.make(things.nextId(s, 'pid', 1), attrs, { gauge: 'heavy' });
  assert.equal(JSON.stringify(a), '{"id":2,"k":"cell","g":"street","st":"ok","from":"d_dragon","how":"strip","gauge":"heavy"}');
  assert.equal(JSON.stringify(b), '{"id":3,"k":"cell","g":"street","st":"ok","from":"d_dragon","how":"strip","gauge":"heavy"}');
  const L = [a, b, { id: 9 }];
  assert.equal(things.pull(L, 3), b); assert.equal(things.pull(L, 3), null); assert.deepEqual(L.map((p) => p.id), [2, 9]);
});

test("the White Dragon's pockets and Lodestar's carried motes, counted as they were", () => {
  const SALVAGE = { wire: 4, alloy: 3, glass: 6, coolant: 8, chips: 14 }, ORDER = Object.keys(SALVAGE);
  // game.js as it was, and now
  const was = { s: { cr: 0, pack: {} },
    packCount() { let n = 0; for (const k in this.s.pack) n += this.s.pack[k]; return n; },
    give(item, n) { if (n <= 0) return 0; this.s.pack[item] = (this.s.pack[item] || 0) + n; return n; },
    canPay(cost) { for (const k in cost) { if (k === 'cr') { if (this.s.cr < cost.cr) return false; } else if ((this.s.pack[k] || 0) < cost[k]) return false; } return true; },
    pay(cost) { if (!this.canPay(cost)) return false; for (const k in cost) { if (k === 'cr') this.s.cr -= cost.cr; else this.s.pack[k] -= cost[k]; } return true; },
    sellAll(rate) { let cr = 0; for (const k of ORDER) { cr += Math.round((this.s.pack[k] || 0) * SALVAGE[k] * rate); this.s.pack[k] = 0; } this.s.cr += cr; return cr; },
    worth() { return ORDER.reduce((a, k) => a + (this.s.pack[k] || 0) * SALVAGE[k], 0); },
    salvage() { return ORDER.reduce((a, k) => a + (this.s.pack[k] || 0), 0); },
  };
  const now = { s: { cr: 0, pack: {} },
    packCount() { return bag.total(this.s.pack); },
    give(item, n) { return bag.add(this.s.pack, item, n); },
    canPay(cost) { const { cr, ...items } = cost; if (cr !== undefined && this.s.cr < cr) return false; return bag.has(this.s.pack, items); },
    pay(cost) { if (!this.canPay(cost)) return false; const { cr, ...items } = cost; if (cr !== undefined) this.s.cr -= cr; bag.pay(this.s.pack, items); return true; },
    sellAll(rate) { const cr = bag.worth(this.s.pack, (k, n) => Math.round(n * SALVAGE[k] * rate), ORDER); bag.empty(this.s.pack, ORDER); this.s.cr += cr; return cr; },
    worth() { return bag.worth(this.s.pack, (k, n) => n * SALVAGE[k], ORDER); },
    salvage() { return bag.total(this.s.pack, ORDER); },
  };
  const r = rng(5);
  for (let i = 0; i < 3000; i++) {
    const x = r(), k = pick(r, ORDER), n = pick(r, [0, 1, 2, 5, -1]);
    const cost = r() < 0.5 ? { cr: Math.floor(r() * 30) } : { [k]: 1 + Math.floor(r() * 3), ...(r() < 0.5 ? { cr: Math.floor(r() * 10) } : {}) };
    const rate = pick(r, [1, 0.85, 1.2]);
    const call = x < 0.4 ? ['give', k, n] : x < 0.6 ? ['canPay', cost] : x < 0.8 ? ['pay', cost] : x < 0.85 ? ['sellAll', rate] : x < 0.93 ? ['worth'] : ['salvage'];
    if (call[0] === 'give' && n > 0) was.s.cr = now.s.cr; // (money comes in too)
    const [f, ...args] = call;
    assert.deepEqual(now[f](...args), was[f](...args), `${i}: ${JSON.stringify(call)}`);
    assert.equal(now.packCount(), was.packCount());
    assert.equal(JSON.stringify(now.s), JSON.stringify(was.s));
    if (r() < 0.05) { was.s.cr += 50; now.s.cr += 50; }
  }
  // Lodestar's motes: carried from kills, banked at a set (motes.js)
  const NATURES = ['rime', 'cinder', 'spore', 'spark', 'grit'];
  const lodeWas = { C: {}, motes: { rime: 0, cinder: 0, spore: 0, spark: 0, grit: 0 },
    kill(nat, n) { const C = this.C; C[nat] = (C[nat] || 0) + n; },
    carriedN() { let n = 0; const M = this.C; for (const k in M) n += M[k]; return n; },
    bank() { const C = this.C, parts = []; for (const n of NATURES) if (C[n] > 0) { this.motes[n] += C[n]; parts.push(`${C[n]} ${n}`); C[n] = 0; } return parts; },
  };
  const lodeNow = { C: {}, motes: { rime: 0, cinder: 0, spore: 0, spark: 0, grit: 0 },
    kill(nat, n) { bag.add(this.C, nat, n); },
    carriedN() { return bag.total(this.C); },
    bank() { return bag.move(this.C, this.motes, NATURES).map(([n, k]) => `${k} ${n}`); },
  };
  for (let i = 0; i < 2000; i++) {
    const x = r();
    if (x < 0.7) { const nat = pick(r, NATURES), n = pick(r, [1, 3, 8]); lodeWas.kill(nat, n); lodeNow.kill(nat, n); }
    else if (x < 0.9) assert.deepEqual(lodeNow.bank(), lodeWas.bank());
    else { lodeWas.C = {}; lodeNow.C = {}; }
    assert.equal(lodeNow.carriedN(), lodeWas.carriedN());
    assert.deepEqual(lodeNow, { ...lodeNow, C: lodeWas.C, motes: lodeWas.motes });
  }
});

test('items: slots stack and spill, gear goes on and comes off, bags move', () => {
  const S = Tycho.items.slots.make(3);
  assert.equal(Tycho.items.slots.put(S, 'ore', 25, 10), 0);
  assert.deepEqual(S, [{ k: 'ore', n: 10 }, { k: 'ore', n: 10 }, { k: 'ore', n: 5 }]);
  assert.equal(Tycho.items.slots.put(S, 'gem', 4, 10), 4); // no room
  assert.equal(Tycho.items.slots.take(S, 'ore', 7), true);
  assert.deepEqual(S, [{ k: 'ore', n: 10 }, { k: 'ore', n: 8 }, null]);
  assert.equal(Tycho.items.slots.put(S, 'ore', 3, () => 10), 0);
  assert.deepEqual(S, [{ k: 'ore', n: 10 }, { k: 'ore', n: 10 }, { k: 'ore', n: 1 }]);
  assert.equal(Tycho.items.slots.take(S, 'ore', 99), false);
  assert.equal(Tycho.items.slots.count(S, 'ore'), 21);
  assert.equal(Tycho.items.slots.free(S), 0);
  const G = Tycho.items.gear.make(['main', 'charm']);
  assert.equal(Tycho.items.gear.equip(G, 'main', 'sword'), null);
  assert.equal(Tycho.items.gear.equip(G, 'main', 'axe'), 'sword');
  assert.equal(Tycho.items.gear.equip(G, 'boots', 'boot'), undefined);
  assert.equal(Tycho.items.gear.equip(G, 'charm', 'axe', (slot, t) => slot === 'charm' && t.startsWith('ring')), undefined);
  assert.deepEqual(Tycho.items.gear.worn(G), ['axe']);
  assert.equal(Tycho.items.gear.unequip(G, 'main'), 'axe');
  assert.deepEqual(G, { main: null, charm: null });
  const a = { x: 2, y: 0 }, b = { x: 1 };
  assert.deepEqual(bag.move(a, b), [['x', 2]]);
  assert.deepEqual([a, b], [{ x: 0, y: 0 }, { x: 3 }]);
  assert.equal(bag.take(b, 'x', 4), false); assert.equal(bag.take(b, 'x', 3), true); assert.equal(bag.count(b, 'x'), 0);
  assert.deepEqual(group([{ v: 10 }, { v: 9 }, { v: 9 }], [{ by: 'v', order: (p, q) => p - q }]).map((g) => [g.key, g.n]), [[9, 2], [10, 1]]);
});

// ---- the guide: the White Dragon's tutorial ------------------------------------
test("the guide: the White Dragon's tutorial moves on as it did", () => {
  const r = rng(9);
  for (let seq = 0; seq < 200; seq++) {
    const flags = {}, n = 3 + Math.floor(r() * 10);
    const steps = Array.from({ length: n }, (_, i) => ({ ch: pick(r, ['bench', 'parts', 'end']), name: 'step ' + i, end: i === n - 1 || r() < 0.08, done: () => !!flags[i], text: i % 2 ? 'Text ' + i : () => 'Said ' + i + (flags[i] ? '!' : '') }));
    const sw = { tut: { i: 0 } }, sn = { tut: { i: 0 } };
    // tutorial.js as it was
    const was = {
      get s() { return sw && sw.tut; },
      active() { const t = this.s; return !!t && !t.off && t.i < steps.length; },
      get step() { return steps[this.s.i]; },
      tick() { if (!this.active()) return null; let moved = false, flash = null; while (this.active() && !this.step.end && this.step.done()) { flash = this.step.name; this.s.i++; moved = true; } return moved ? flash : null; },
      text() { const st = this.step; return typeof st.text === 'function' ? st.text() : st.text; },
      head() { const st = this.step, all = steps.filter((q) => q.ch === st.ch); return `${st.ch}${all.length > 1 ? ' · ' + (all.indexOf(st) + 1) + '/' + all.length : ''}`; },
    };
    // and now
    const G = new Tycho.guide.Guide({ steps, state: () => sn && sn.tut });
    const now = {
      active: () => G.active(),
      tick() { const passed = G.tick(); return passed.length ? passed[passed.length - 1].name : null; },
      text: () => G.read('text'),
      head() { const { ch, at, of } = G.place(); return `${ch}${of > 1 ? ' · ' + at + '/' + of : ''}`; },
    };
    for (let k = 0; k < 40; k++) {
      const x = r();
      if (x < 0.5) flags[Math.floor(r() * n)] = true;
      else if (x < 0.53) { sw.tut.off = true; G.skip(); }
      else if (x < 0.56 && was.active() && was.step.end) { sw.tut.i = steps.length; G.finish(); }
      assert.equal(now.tick(), was.tick());
      assert.equal(now.active(), was.active());
      assert.deepEqual(sn, sw);
      if (was.active()) { assert.equal(now.text(), was.text()); assert.equal(now.head(), was.head()); }
    }
  }
  // a save without one never sees it
  const none = new Tycho.guide.Guide({ steps: [{ done: () => true }], state: () => undefined });
  assert.equal(none.active(), false); assert.deepEqual(none.tick(), []);
  assert.deepEqual(Tycho.guide.fresh(), { i: 0 });
});
