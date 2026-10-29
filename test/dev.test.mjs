// The dev tools' drawer, notes and pieces, on a small stand-in for the DOM
// (elements parsed from the HTML the drawer writes, with selectors, events
// that capture and bubble, focus, values and scrolling): it opens only with
// ?dev (or once shown) by its key or its button, never while typing; its
// tabs draw, refresh when they're due and not while a finger's down, and
// keep where they're scrolled to, what has focus, its caret, what's typed
// and which sections are open; its steppers, toggles and choices change
// settings (never past their bounds), its acts run, the tag is up while a
// setting that changes play is off its default, overlays switch, the events
// merge the notes with another log by time and filter them, and a tap on
// the game picks someone. Then the mind's dense options, on Rocinante.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as Tycho from '../dist/tycho.mjs';

const require = createRequire(import.meta.url);
const { dev } = Tycho;

// ---- a small stand-in for the DOM -------------------------------------------------
const VOID = new Set(['input', 'br', 'img', 'hr', 'meta']);
const decode = (t) => t.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const camel = (n) => n.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
class Node_ {
  constructor() { this.parent = null; this.kids = []; this.listeners = []; }
  addEventListener(type, fn, opt) { this.listeners.push({ type, fn, capture: opt === true || !!(opt && opt.capture) }); }
  removeEventListener() {}
}
class El extends Node_ {
  constructor(tag, doc) { super(); this.tagName = tag.toUpperCase(); this.doc = doc; this.attrs = {}; this.text = ''; this.style = { setProperty() {} }; this.scrollTop = 0; this.value = ''; this.checked = false; this.open = false; this.disabled = false; this.type = ''; this.selectionStart = null; this.selectionEnd = null; this.rect = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  get id() { return this.attrs.id || ''; } set id(v) { this.attrs.id = v; }
  get className() { return this.attrs.class || ''; } set className(v) { this.attrs.class = v; }
  get hidden() { return 'hidden' in this.attrs; } set hidden(v) { if (v) this.attrs.hidden = ''; else delete this.attrs.hidden; }
  get classList() { const el = this, list = () => el.className.split(/\s+/).filter(Boolean); return { contains: (c) => list().includes(c), add: (c) => { if (!list().includes(c)) el.className = list().concat(c).join(' '); }, remove: (c) => { el.className = list().filter((x) => x !== c).join(' '); }, toggle: (c, on) => { const want = on === undefined ? !list().includes(c) : on; if (want) el.classList.add(c); else el.classList.remove(c); return want; } }; }
  get dataset() { const d = {}; for (const k in this.attrs) if (k.startsWith('data-')) d[camel(k.slice(5))] = this.attrs[k]; return d; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'value') this.value = String(v); if (k === 'type') this.type = String(v); }
  get children() { return this.kids.filter((k) => k instanceof El); }
  get textContent() { return this.text + this.kids.map((k) => k.textContent).join(''); }
  set textContent(v) { this.kids = []; this.text = String(v); }
  appendChild(e) { if (e.parent) e.parent.kids = e.parent.kids.filter((k) => k !== e); e.parent = this; this.kids.push(e); return e; }
  insertBefore(e, ref) { this.appendChild(e); if (ref) { this.kids.pop(); this.kids.splice(this.kids.indexOf(ref), 0, e); } return e; }
  get firstChild() { return this.kids[0] || null; }
  contains(e) { for (let n = e; n; n = n.parent) if (n === this) return true; return false; }
  get isConnected() { for (let n = this; n; n = n.parent) if (n === this.doc.documentElement) return true; return false; }
  set innerHTML(h) { this.kids = []; this.text = ''; parse(h, this, this.doc); this.html = h; }
  get innerHTML() { return this.html || ''; }
  all() { const out = []; for (const k of this.children) out.push(k, ...k.all()); return out; }
  matches(sel) { return sel.split(',').some((s) => one(this, s.trim())); }
  querySelectorAll(sel) { return this.all().filter((e) => e.matches(sel)); }
  querySelector(sel) { return this.all().find((e) => e.matches(sel)) || null; }
  closest(sel) { for (let e = this; e instanceof El; e = e.parent) if (e.matches(sel)) return e; return null; }
  getBoundingClientRect() { return this.rect; }
  focus() { this.doc.activeElement = this; }
  blur() { if (this.doc.activeElement === this) this.doc.activeElement = this.doc.body; }
  setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b; }
  getContext() { return { setTransform() {}, clearRect() {} }; }
}
// one compound selector: tag, #id, .class, [attr], [attr="v"]
function one(el, s) {
  const m = /^([a-z]*)((?:#[\w-]+)?)((?:\.[\w-]+)*)((?:\[[\w-]+(?:="[^"]*")?\])*)$/i.exec(s);
  if (!m) throw new Error('selector ' + s);
  if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
  if (m[2] && el.id !== m[2].slice(1)) return false;
  for (const c of m[3].split('.').filter(Boolean)) if (!el.classList.contains(c)) return false;
  for (const a of m[4].matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) { if (!(a[1] in el.attrs)) return false; if (a[2] !== undefined && el.attrs[a[1]] !== a[2]) return false; }
  return true;
}
function parse(h, into, doc) {
  const re = /<\/([a-z0-9]+)>|<([a-z0-9]+)((?:\s+[a-z0-9-]+(?:="[^"]*")?)*)\s*>|([^<]+)/gi;
  let m, at = into;
  while ((m = re.exec(h))) {
    if (m[1]) { if (at !== into) at = at.parent; continue; }
    if (m[4] !== undefined) { const t = new Node_(); t.textContent = decode(m[4]); t.text = decode(m[4]); Object.defineProperty(t, 'textContent', { get: () => t.text }); at.kids.push(t); t.parent = at; continue; }
    const el = new El(m[2], doc);
    for (const a of m[3].matchAll(/([a-z0-9-]+)(?:="([^"]*)")?/gi)) el.setAttribute(a[1], a[2] === undefined ? '' : decode(a[2]));
    if ('checked' in el.attrs) el.checked = true;
    if ('open' in el.attrs) el.open = true;
    if ('disabled' in el.attrs) el.disabled = true;
    at.appendChild(el);
    if (!VOID.has(m[2].toLowerCase())) at = el;
  }
}
function makeDoc() {
  const doc = new Node_();
  doc.documentElement = new El('html', doc); doc.head = new El('head', doc); doc.body = new El('body', doc);
  doc.documentElement.appendChild(doc.head); doc.documentElement.appendChild(doc.body);
  doc.documentElement.style = { props: {}, setProperty(k, v) { this.props[k] = v; } };
  doc.activeElement = doc.body;
  doc.createElement = (tag) => new El(tag, doc);
  doc.getElementById = (id) => doc.documentElement.all().find((e) => e.id === id) || null;
  return doc;
}
// an event through the stand-in: capture down from the window, then bubble back up
function fire(win, target, type, props = {}) {
  let stopped = false;
  const e = Object.assign({ type, target, bubbles: true, defaultPrevented: false, stopPropagation() { stopped = true; }, preventDefault() { this.defaultPrevented = true; } }, props);
  const path = []; for (let n = target; n; n = n.parent) path.unshift(n);
  const chain = [win, win.document].concat(path.filter((n) => n !== win.document));
  const run = (node, capture) => { for (const l of node.listeners.slice()) if (l.type === type && (capture === null || l.capture === capture)) { l.fn.call(node, e); } };
  for (const n of chain.slice(0, -1)) { run(n, true); if (stopped) return e; }
  run(target, null); if (stopped) return e;
  for (const n of chain.slice(0, -1).reverse()) { run(n, false); if (stopped) return e; }
  return e;
}
const click = (win, el) => { fire(win, el, 'pointerdown', { pointerId: 1 }); fire(win, el, 'pointerup', { pointerId: 1 }); return fire(win, el, 'click'); };
function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; }
// a page: the document, the window's listeners and size, the storage, the address
function page(search = '?dev') {
  const doc = makeDoc(), win = new Node_();
  win.document = doc;
  Object.assign(globalThis, { document: doc, window: win, localStorage: globalThis.localStorage || fakeStorage(), innerWidth: 844, innerHeight: 390, devicePixelRatio: 2 });
  globalThis.location = { search };
  globalThis.addEventListener = (t, f, o) => win.addEventListener(t, f, o);
  return { doc, win };
}
const fieldsOf = (root) => root.querySelectorAll('input');

// ---- the pieces -------------------------------------------------------------------
test('the pieces: steppers stop at their bounds and mark their defaults, toggles and choices set', () => {
  const b = new dev.Bits('dev');
  b.defaults.speed = 1;
  const at = (h) => [...h.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map(([, a, t]) => ({ t, to: (/data-devto="([^"]*)"/.exec(a) || [])[1], off: / disabled/.test(a), key: (/data-devset="([^"]*)"/.exec(a) || [])[1] }));
  // a list of values: the neighbors either side, none past the ends
  let s = at(b.stepper({ key: 'speed', value: 1, values: [0.5, 0.75, 1, 1.5, 2], fmt: (v) => '×' + v }));
  assert.deepEqual(s.map((x) => [x.t, x.to]), [['−', '0.75'], ['+', '1.5']]);
  assert.ok(!/dev-off/.test(b.stepper({ key: 'speed', value: 1, values: [0.5, 1, 2] })));
  const low = b.stepper({ key: 'speed', value: 0.5, values: [0.5, 1, 2] });
  assert.ok(/dev-off/.test(low) && /dev-reset/.test(low), 'off its default, marked, with a way back');
  assert.deepEqual(at(low).map((x) => [x.t, x.off, x.to]), [['−', true, undefined], ['+', false, '1'], ['↺', false, '1']]);
  // a value between them goes to the nearest either side
  assert.deepEqual(at(b.stepper({ key: 'x', value: 1.2, values: [0.5, 1, 2] })).map((x) => x.to), ['1', '2']);
  // numbers by steps, a pair a step, the biggest outermost, wrapping round a day
  s = at(b.stepper({ key: 'time', value: 23.75, step: [0.25, 1], min: 0, max: 24, wrap: true, stepWord: (h) => (h >= 1 ? h + 'h' : h * 60 + 'm') }));
  assert.deepEqual(s.map((x) => [x.t, +x.to]), [['−1h', 22.75], ['−15m', 23.5], ['+15m', 0], ['+1h', 0.75]]);
  // and stopping at a bound (landing on it first)
  s = at(b.stepper({ key: 'n', value: 0.3, step: 1, min: 0, max: 5 }));
  assert.deepEqual(s.map((x) => [x.t, x.off, x.to]), [['−', false, '0'], ['+', false, '1.3']]);
  s = at(b.stepper({ key: 'n', value: 0, step: 1, min: 0, max: 5 }));
  assert.equal(s[0].off, true);
  // a toggle sets the other way; a choice marks the one in force
  const tg = at(b.toggle({ key: 'freeze', on: false, label: 'Stop the clock' }))[0];
  assert.deepEqual([tg.key, tg.to], ['freeze', 'true']);
  const ch = b.choice({ key: 'weather', value: 'rain', options: [['auto', 'By the clock'], ['rain', 'Rain'], ['dry', 'Dry']], def: 'auto' });
  assert.ok(/class="dev-choice dev-off"/.test(ch) && /class="on"[^>]*>Rain/.test(ch));
  assert.deepEqual(at(ch).map((x) => x.to), ['&quot;auto&quot;', '&quot;rain&quot;', '&quot;dry&quot;'], 'each value as JSON');
  // bars, a grid of them, a table
  assert.ok(/width:50%/.test(b.bar(0.5)) && /class="hot"/.test(b.bar(0.9, { hot: true })) && /class="warm"/.test(b.bar(0.5, { hot: true })) && /width:100%/.test(b.bar(3)));
  assert.ok(/<span>hunger<\/span>.*0\.34/.test(b.bars([['hunger', 0.34]])));
  assert.ok(/<tr class="cur"><td>a<\/td><td class="num">1<\/td><\/tr>/.test(b.table(['x', 'n'], [{ cells: ['a', '1'], cls: 'cur' }], { nums: [1] })));
  assert.equal(b.num('x'), '–'); assert.equal(b.num(1 / 3, 1), '0.3');
});

test('notes: newest first, the last few hundred, none while paused, and back with the clock', () => {
  let t = 0;
  const n = new dev.Notes({ most: 3, clock: () => t });
  for (let i = 0; i < 5; i++) { t = i; n.note('k', 'e' + i); }
  assert.deepEqual(n.list.map((e) => e.text), ['e4', 'e3', 'e2']);
  n.paused = true; assert.equal(n.note('k', 'no'), null); n.paused = false;
  n.rewind(3); assert.deepEqual(n.list.map((e) => e.text), ['e3', 'e2']);
  const c = n.count; n.clear(); assert.equal(n.list.length, 0); assert.ok(n.count > c);
});

// ---- the drawer ----------------------------------------------------------------------
function drawer(o = {}) {
  const flags = new dev.Flags(o.key || 'g.dev', { speed: 1, weather: 'auto' }).load();
  const seen = { a: 0, b: 0, acts: [] };
  const d = new dev.Drawer(Object.assign({
    flags,
    tabs: [
      { id: 'a', html: (d) => { seen.a++; return `<p>A ${seen.a}</p><input type="search" id="find"><details data-keep="grp"><summary>more</summary>…</details>` + d.stepper({ key: 'speed', value: flags.s.speed, values: [0.5, 1, 2] }) + d.button('give', 'Give', { arg: '10' }); } },
      { id: 'b', label: 'Bee', every: 0, html: () => { seen.b++; return `<p>B ${seen.b}</p>`; } },
      { id: 'events', events: true },
    ],
    overlays: [{ id: 'labels', label: 'names', on: true }, { id: 'land', options: ['off', 'height'] }],
    play: [{ key: 'speed', def: 1, word: (v) => 'run ×' + v }, { key: 'weather', def: 'auto', word: (v) => 'weather ' + v }],
    tagTab: 'a',
    acts: { give: (arg) => { seen.acts.push(arg); } },
  }, o.opts || {}));
  return { d, flags, seen };
}

test('the drawer opens only with ?dev (or once shown), by its key or its button, never while typing', () => {
  let { doc, win } = page('');
  globalThis.localStorage = fakeStorage();
  const btn = doc.createElement('button'); doc.body.appendChild(btn);
  let { d } = drawer({ opts: { button: btn } });
  d.start();
  assert.equal(btn.hidden, true, 'no button without ?dev');
  fire(win, doc.body, 'keydown', { key: '`' });
  assert.equal(d.on, false, 'and no key either');
  // with ?dev (a fresh page: the drawer above is listening there)
  ({ doc, win } = page('?dev'));
  const btn2 = doc.createElement('button'); doc.body.appendChild(btn2);
  ({ d } = drawer({ key: 'g2.dev', opts: { button: btn2 } }));
  d.start();
  assert.equal(btn2.hidden, false);
  fire(win, doc.body, 'keydown', { key: '`' });
  assert.equal(d.on, true);
  assert.ok(doc.body.classList.contains('dev-on'));
  const root = doc.getElementById('dev');
  assert.ok(root && !root.hidden && doc.getElementById('dev-style'));
  assert.equal(doc.head.firstChild.id, 'dev-style', 'its look first, so the game\'s own CSS overrides it');
  // a key typed into its find box is the box's: not the drawer's, nor the game's
  const game = []; win.addEventListener('keydown', (e) => game.push(e.key));
  const find = doc.getElementById('find');
  fire(win, find, 'keydown', { key: '`' });
  assert.equal(d.on, true); assert.deepEqual(game, []);
  fire(win, doc.body, 'keydown', { key: 'a' }); assert.deepEqual(game, ['a']);
  // the × closes it; the button opens it again
  click(win, root.querySelector('.dev-x'));
  assert.equal(d.on, false); assert.ok(root.hidden && !doc.body.classList.contains('dev-on'));
  click(win, btn2); assert.equal(d.on, true); assert.ok(btn2.classList.contains('active'));
});

test('tabs draw, are remembered, and refresh when due, keeping scroll, focus, caret, typing and open sections', () => {
  const { doc, win } = page('?dev');
  globalThis.localStorage = fakeStorage();
  const { d, flags, seen } = drawer();
  d.start(); d.open();
  const body = doc.getElementById('dev-body');
  assert.ok(/A 1/.test(body.textContent));
  // the tabs' words, the one showing marked
  const tabs = doc.getElementById('dev').querySelectorAll('[data-devtab]');
  assert.deepEqual(tabs.map((t) => t.textContent), ['A', 'Bee', 'Events']);
  assert.ok(tabs[0].classList.contains('active'));
  // scrolled, a section opened, something typed with the caret in it
  body.scrollTop = 120;
  const det = body.querySelector('details'); det.open = true; fire(win, det, 'toggle');
  let find = doc.getElementById('find'); find.value = 'ines'; fire(win, find, 'input'); find.focus(); find.setSelectionRange(2, 3);
  d.frame(0.5);
  assert.equal(seen.a, 2, 'drawn again when due');
  find = doc.getElementById('find');
  assert.equal(body.scrollTop, 120); assert.equal(find.value, 'ines'); assert.equal(doc.activeElement, find); assert.deepEqual([find.selectionStart, find.selectionEnd], [2, 3]);
  assert.equal(body.querySelector('details').open, true);
  // not while a finger's down in it
  fire(win, body.querySelector('p'), 'pointerdown', { pointerId: 7 });
  d.frame(0.5); assert.equal(seen.a, 2);
  fire(win, body.querySelector('p'), 'pointerup', { pointerId: 7 });
  d.frame(0.5); assert.equal(seen.a, 3);
  // a tab that's drawn only when something's done in it
  click(win, tabs[1]);
  assert.equal(flags.s.drawer.tab, 'b'); assert.equal(seen.b, 1); assert.equal(body.scrollTop, 0);
  d.frame(0.5); d.frame(0.5); assert.equal(seen.b, 1);
  // its header still ticks: the frame line
  d.time('sim', 2); d.time('draw', 4);
  d.frame(0.5);
  assert.match(doc.getElementById('dev-fps').innerHTML, /fps · sim 2\.0 draw 4\.0 ms/);
  // a new drawer on the same flags opens where this one was
  const again = new dev.Drawer({ flags: new dev.Flags('g.dev', {}).load(), tabs: d.tabs });
  page('?dev'); again.start();
  assert.equal(again.on, true); assert.equal(again.current().id, 'b');
});

test('steppers, acts, the tag and the overlays', () => {
  const { doc, win } = page('?dev');
  globalThis.localStorage = fakeStorage();
  const { d, flags, seen } = drawer();
  d.start();
  assert.equal(doc.getElementById('dev-tag').hidden, true, 'nothing off its default: no tag');
  d.open('a');
  const body = doc.getElementById('dev-body'), btn = (t) => body.querySelectorAll('button').find((b) => b.textContent === t);
  click(win, btn('−'));
  assert.equal(flags.s.speed, 0.5, 'a step down');
  assert.ok(btn('−').disabled, 'and no further');
  const tag = doc.getElementById('dev-tag');
  assert.equal(tag.hidden, false); assert.equal(tag.textContent, 'run ×0.5');
  flags.s.weather = 'rain'; d.frame(0.016);
  assert.equal(tag.textContent, 'run ×0.5 · weather rain', 'the tag sees a setting changed anywhere');
  click(win, btn('↺')); flags.s.weather = 'auto'; d.frame(0.016);
  assert.equal(flags.s.speed, 1); assert.equal(tag.hidden, true);
  // the tag opens the drawer at its tab
  flags.s.speed = 2; d.frame(0.016); d.show('b'); d.close();
  click(win, tag); assert.equal(d.on, true); assert.equal(d.current().id, 'a');
  // an act, with its argument
  click(win, btn('Give')); assert.deepEqual(seen.acts, ['10']);
  // a game's own setter instead of the flags
  const heard = [];
  const g = new dev.Drawer({ flags, tabs: [{ id: 't', html: (d) => d.toggle({ key: 'freeze', on: !!flags.s.freeze, label: 'Stop' }) }], set: (k, v) => heard.push([k, v]), prefix: 'gx' });
  page('?dev'); g.start(); g.open();
  click(globalThis.window, globalThis.document.getElementById('gx-body').querySelector('button'));
  assert.deepEqual(heard, [['freeze', true]]);
  // overlays: switched in the header, kept, and only while it's open
  page('?dev'); const { d: o } = drawer({ key: 'g3.dev' }); o.start(); o.open();
  assert.equal(o.overlay('labels'), true); assert.equal(o.overlay('land'), false);
  const land = globalThis.document.getElementById('dev-ov-land'); land.value = 'height'; fire(globalThis.window, land, 'change');
  assert.equal(o.overlay('land'), 'height'); assert.equal(o.st.ov.land, 'height');
  o.close(); assert.equal(o.overlay('labels'), false);
});

test('the events merge the notes with another log by time, and filter, find, pause and clear', () => {
  const { doc, win } = page('?dev');
  globalThis.localStorage = fakeStorage();
  let log = [{ t: 1, kind: 'move', text: 'Ruth set out' }, { t: 3, kind: 'talk', text: 'Ruth and Kofi chat' }, { t: 5, kind: 'row', text: 'Sam rows with Dev' }];
  const flags = new dev.Flags('ev.dev', {}).load();
  let t = 0;
  const d = new dev.Drawer({ flags, tabs: [{ id: 'events', events: true }], events: { clock: () => t, from: () => log, kinds: ['job', 'talk'], apart: ['move'], when: (x) => 'm' + x, find: true } });
  d.start(); d.open();
  t = 2; d.note('job', 'You take the radio');
  t = 6; d.note('heat', 'Heat +5');
  d.refresh(true);
  const body = doc.getElementById('dev-body'), lines = () => body.querySelectorAll('.dev-ev').map((e) => e.textContent);
  assert.deepEqual(lines(), ['m6heatHeat +5', 'm5rowSam rows with Dev', 'm3talkRuth and Kofi chat', 'm2jobYou take the radio'], 'newest first, the move left out of all');
  const chips = body.querySelectorAll('[data-devkind]').map((b) => b.textContent);
  assert.deepEqual(chips, ['all 4', 'job 1', 'talk 1', 'heat 1', 'move 1', 'row 1'], 'its kinds first, then the rest');
  click(win, body.querySelectorAll('[data-devkind]').find((b) => b.textContent === 'move 1'));
  assert.deepEqual(lines(), ['m1moveRuth set out'], 'a kind apart, shown alone');
  assert.equal(flags.s.drawer.filter, 'move');
  click(win, body.querySelectorAll('[data-devkind]')[0]);
  // find
  const find = doc.getElementById('dev-find'); find.value = 'ruth'; fire(win, find, 'input');
  assert.deepEqual(lines(), ['m3talkRuth and Kofi chat']);
  assert.equal(doc.getElementById('dev-find').value, 'ruth');
  const again = doc.getElementById('dev-find'); again.value = ''; fire(win, again, 'input');
  // drawn again only when there's something new
  let draws = 0; const html = d.eventsHtml.bind(d); d.eventsHtml = () => { draws++; return html(); };
  d.frame(0.5); assert.equal(draws, 0);
  log = log.concat({ t: 7, kind: 'talk', text: 'Kofi and Pip chat' }); d.frame(0.5); assert.equal(draws, 1);
  // paused, it holds still; cleared, only what comes after
  click(win, body.querySelector('[data-devev="pause"]'));
  log = log.concat({ t: 8, kind: 'talk', text: 'late' }); d.refresh(true);
  assert.ok(!lines().some((l) => /late/.test(l)));
  click(win, body.querySelector('[data-devev="pause"]'));
  assert.ok(lines().some((l) => /late/.test(l)));
  click(win, body.querySelector('[data-devev="clear"]'));
  assert.equal(lines().length, 0);
  log = log.concat({ t: 9, kind: 'row', text: 'after' }); t = 9.5; d.note('job', 'hand back'); d.refresh(true);
  assert.deepEqual(lines(), ['m9.5jobhand back', 'm9rowafter']);
  // with an impact, a column for it (room for the events by impact)
  d.note('row', 'a fight', { impact: 0.61 }); d.refresh(true);
  assert.ok(body.querySelector('.dev-imp') && /0\.61/.test(lines()[0]));
});

test('a tap on the game picks someone while the drawer is open, and goes no further', () => {
  const { doc, win } = page('?dev');
  globalThis.localStorage = fakeStorage();
  const game = doc.createElement('div'); doc.body.appendChild(game);
  const stick = []; game.addEventListener('pointerdown', () => stick.push(1));
  const picked = [];
  const { d } = drawer({ opts: { pick: (x) => (x < 100 ? 'ruth' : null), selectTab: 'b', onSelect: (id) => picked.push(id) } });
  d.start();
  fire(win, game, 'pointerdown', { clientX: 50, clientY: 10, pointerId: 2 });
  assert.deepEqual([picked, stick.length], [[], 1], 'closed: the game has it');
  d.open('a');
  fire(win, game, 'pointerdown', { clientX: 50, clientY: 10, pointerId: 3 });
  assert.deepEqual(picked, ['ruth']); assert.equal(stick.length, 1); assert.equal(d.sel, 'ruth'); assert.equal(d.current().id, 'b');
  fire(win, game, 'pointerdown', { clientX: 500, clientY: 10, pointerId: 4 });
  assert.equal(stick.length, 2, 'nobody there: the game has it');
  // a link in a tab picks too (data-devsel), and a mind's close lets go
  d.tabs[1].html = () => '<a data-devsel="kofi">Kofi</a><button data-devdo="close">Close</button>'; d.refresh(true);
  click(win, doc.getElementById('dev-body').querySelector('a')); assert.equal(d.sel, 'kofi');
  click(win, doc.getElementById('dev-body').querySelector('button')); assert.equal(d.sel, null);
});

test('it says how much of the screen it covers', () => {
  const { doc } = page('?dev');
  globalThis.localStorage = fakeStorage();
  const { d } = drawer({ opts: { side: 'right' } });
  d.start(); d.open();
  doc.getElementById('dev').rect = { left: 456, right: 844, top: 0, bottom: 390, width: 388, height: 390 };
  d.close(); d.open();
  assert.deepEqual(d.covered(), { left: 0, right: 388, bottom: 0 });
  assert.equal(doc.documentElement.style.props['--dev-right'], '388px');
  assert.ok(doc.getElementById('dev').classList.contains('dev-right'));
  d.close(); assert.deepEqual(d.covered(), { left: 0, right: 0, bottom: 0 });
  assert.match(dev.drawerCss('dev'), /\.dev\.dev-right\{/);
});

// ---- the mind, dense ------------------------------------------------------------------------
test('a mind for a drawer: needs with numbers, chances that add up, tables, and what they would choose now', () => {
  const Tyrell = require('../dist/tyrell.cjs'), buildRocinante = require('../tyrell/examples/rocinante.js');
  const w = buildRocinante(Tyrell, { seed: 'dev-mind', start: 7 * 60 });
  w.advance(150);
  const id = w.people()[0].id;
  const plain = Tycho.inspect.mind(w, id, { prefix: 'dev' });
  const dense = Tycho.inspect.mind(w, id, { prefix: 'dev', numbers: true, chances: true, table: true, now: true });
  assert.ok(!/<em>|If they chose now|<table/.test(plain), 'nothing new unless asked for');
  assert.ok(/<em>\d\.\d\d<\/em>/.test(dense));
  assert.ok(/<table class="devwhy">/.test(dense) && /<th>chance<\/th>/.test(dense));
  assert.ok(/<h3>If they chose now<\/h3>/.test(dense));
  // the chances of the options drawn from add up to all of it
  const opts = w.peek(() => w.mind.options(w.get(id))), odds = Tycho.inspect.chances(opts, w.cfg);
  assert.ok(odds.size >= 1 && odds.size <= w.cfg.top);
  assert.ok(Math.abs([...odds.values()].reduce((a, b) => a + b, 0) - 1) < 1e-9);
  for (const c of odds.keys()) assert.ok(!c.blocked && c.weight > 0);
  // and the world's the same after (looked at, not changed)
  const h = w.hash(); Tycho.inspect.mind(w, id, { now: true }); assert.equal(w.hash(), h);
});
