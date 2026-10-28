// The interface kit against the games' own, which it replaced: the White
// Dragon's toasts (Game.toast, Hud.toasts and Hud.tick's part) and its lines
// rising over a machine (Game.gain, Hud.tick's part), Lodestar's toasts and
// hints (UI.toast, showToast, pumpToasts and UI.show's part), and the White
// Dragon's panelBind and Lodestar's UI.onTap, kept here as they were. Each
// is played through the same steps beside Tycho's on a small stand-in for
// the DOM (with a clock and timers of its own), and what's on screen must be
// the same after every step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Tycho from '../dist/tycho.mjs';

const { ui } = Tycho;

// ---- a small stand-in for the DOM -------------------------------------------
class El {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.kids = []; this.parent = null; this.className = ''; this.text = ''; this.dataset = {}; this.style = {}; this.attrs = {}; this.disabled = false; this.onclick = null; this.listeners = {}; }
  get children() { return this.kids.slice(); }
  get firstChild() { return this.kids[0] || null; }
  get classList() { const el = this; return { contains: (c) => el.className.split(/\s+/).includes(c), add: (c) => { if (!el.classList.contains(c)) el.className = (el.className + ' ' + c).trim(); }, remove: (c) => { el.className = el.className.split(/\s+/).filter((x) => x !== c).join(' '); } }; }
  get textContent() { return this.text + this.kids.map((k) => k.textContent).join(''); }
  set textContent(v) { this.kids = []; this.text = String(v); }
  set innerHTML(h) {
    this.kids = []; this.text = '';
    const re = /<div class="([^"]*)" data-t="([^"]*)">([\s\S]*?)<\/div>/g; let m;
    while ((m = re.exec(h))) { const e = new El('div'); e.className = m[1]; e.dataset.t = m[2]; e.text = m[3]; this.appendChild(e); }
    this.html = h;
  }
  get innerHTML() { return this.html; }
  appendChild(e) { if (e.parent) e.remove(); e.parent = this; this.kids.push(e); return e; }
  remove() { if (this.parent) { this.parent.kids = this.parent.kids.filter((k) => k !== this); this.parent = null; } }
  all() { const out = []; for (const k of this.kids) out.push(k, ...k.all()); return out; }
  matches(sel) {
    for (const part of sel.split(',').map((s) => s.trim())) {
      const m = /^([a-z]*)((?:\[data-[a-z-]+\])*)((?::not\(\[data-[a-z-]+\]\))*)((?:\.[a-z-]+)*)$/.exec(part);
      if (!m) throw new Error('selector ' + part);
      if (m[1] && this.tagName !== m[1].toUpperCase()) continue;
      const camel = (n) => n.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if ([...m[2].matchAll(/\[data-([a-z-]+)\]/g)].some((x) => !(camel(x[1]) in this.dataset))) continue;
      if ([...m[3].matchAll(/\[data-([a-z-]+)\]/g)].some((x) => camel(x[1]) in this.dataset)) continue;
      if ([...m[4].matchAll(/\.([a-z-]+)/g)].some((x) => !this.classList.contains(x[1]))) continue;
      return true;
    }
    return false;
  }
  querySelectorAll(sel) { return this.all().filter((e) => e.matches(sel)); }
  closest(sel) { for (let e = this; e; e = e.parent) if (e.matches && e.matches(sel)) return e; return null; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
}
const state = (box) => box.kids.map((k) => [k.className, k.textContent, k.dataset.t, k.dataset.born, k.style.opacity, k.style.animationDuration].join('|')).join(' / ');

// ---- the White Dragon's toasts and rising lines -----------------------------------
test('the White Dragon\'s toasts and rising lines, step for step', () => {
  const boxA = new El(), boxB = new El();
  // as it was (js/game.js, js/hud.js)
  const GameA = {
    t: 0, toasts: [], gains: [],
    gain(x, y, list) { list.forEach((g, i) => this.gains.push(Object.assign({ x, y, t: this.t + i * 0.12, i, of: list.length }, g))); },
    toast(text, kind = '') {
      const last = this.toasts[this.toasts.length - 1];
      if (last && last.text === text && this.t - last.t < 2.5) { last.t = this.t; return; }
      this.toasts.push({ text, kind, t: this.t });
      if (this.toasts.length > 2) this.toasts.shift();
      HudA.toasts();
    },
  };
  const V = { cx: 37.5, cy: -12.25, scale: 3.25 }, dpr = 1.5;
  const HudA = {
    toasts() { boxA.innerHTML = GameA.toasts.map((t) => `<div class="toast ${t.kind}" data-t="${t.t}">${t.text}</div>`).join(''); },
    tick() {
      for (const n of boxA.children) n.style.opacity = GameA.t - +n.dataset.t > 3.6 ? 0 : 1;
      if (GameA.toasts.length && GameA.t - GameA.toasts[0].t > 4.2) { GameA.toasts.shift(); this.toasts(); }
      const sc = V.scale / dpr;
      let gh = ''; GameA.gains = GameA.gains.filter((g) => GameA.t - g.t < 2.4);
      for (const g of GameA.gains) { const a = GameA.t - g.t; if (a < 0) continue; const x = (g.x - V.cx) * sc, y = (g.y - V.cy) * sc - (g.of - 1 - g.i) * 21 - a * 12, o = a > 1.8 ? Math.max(0, 1 - (a - 1.8) / 0.6) : 1; gh += `<div class="gain${g.kind ? ' ' + g.kind : ''}" style="left:${(x - 34).toFixed(1)}px;top:${y.toFixed(1)}px;opacity:${o.toFixed(2)}"><b>+${g.n}</b> ${g.name}${g.icon ? `<img src="${g.icon}" alt="">` : ''}${g.tag ? `<i>${g.tag}</i>` : ''}</div>`; }
      return gh;
    },
  };
  // on Tycho
  const B = { t: 0 };
  const toaster = new ui.Toasts({ box: () => boxB, redraw: true, html: true, most: 2, life: 4.2, fadeAt: 3.6, merge: 2.5, clock: () => B.t, cls: (k) => 'toast ' + k });
  const rising = new ui.Rising({ clock: () => B.t, line: (g) => `<b>+${g.n}</b> ${g.name}${g.icon ? `<img src="${g.icon}" alt="">` : ''}${g.tag ? `<i>${g.tag}</i>` : ''}` });
  const tickB = () => { toaster.tick(); const sc = V.scale / dpr; return rising.html((x, y) => [(x - V.cx) * sc, (y - V.cy) * sc]); };
  const script = [
    ['toast', 'Neon Row · street level'], ['wait', 0.5], ['toast', 'Sold for 30 cr.', 'good'], ['wait', 1], ['toast', 'Sold for 30 cr.', 'good'], ['wait', 2.45], ['toast', 'Sold for 30 cr.', 'good'],
    ['gain', 120, 80, [{ n: 1, name: 'coil' }, { n: 2, name: 'scrap', kind: 'cr', tag: 'scrap', icon: 'data:x' }, { n: 1, name: 'servo' }]],
    ['wait', 3.1], ['toast', 'Esper only remembers back to 06:15.', 'warn'], ['wait', 0.05], ['toast', 'You <b>sleep</b>', ''],
    ['gain', -40.25, 300.5, [{ n: 5, name: 'cr', kind: 'cr' }]], ['wait', 2.9], ['toast', 'You <b>sleep</b>', ''], ['wait', 6], ['toast', 'x'],
  ];
  const dt = 1 / 60;
  for (const s of script) {
    if (s[0] === 'toast') { GameA.toast(s[1], s[2]); toaster.show(s[1], s[2]); }
    else if (s[0] === 'gain') { GameA.gain(s[1], s[2], s[3]); rising.add(s[1], s[2], s[3]); }
    else for (let k = 0; k < Math.round(s[1] / dt); k++) {
      GameA.t += dt; B.t += dt;
      const ga = HudA.tick(), gb = tickB();
      assert.equal(gb, ga);
      assert.equal(state(boxB), state(boxA));
      assert.equal(boxB.innerHTML, boxA.innerHTML);
    }
    assert.equal(state(boxB), state(boxA));
  }
  assert.deepEqual(toaster.list, GameA.toasts);
});

// ---- Lodestar's toasts and hints ----------------------------------------------------
function timers() {
  const T = { now: 1e12, q: [], seq: 0 };
  T.setTimeout = (fn, ms) => { T.q.push({ at: T.now + ms, fn, seq: T.seq++ }); };
  T.run = (ms) => { const end = T.now + ms; for (;;) { T.q.sort((a, b) => a.at - b.at || a.seq - b.seq); const n = T.q[0]; if (!n || n.at > end) break; T.q.shift(); T.now = n.at; n.fn(); } T.now = end; };
  return T;
}

test('Lodestar\'s toasts and hints, step for step', () => {
  const TA = timers(), TB = timers(), boxA = new El(), boxB = new El();
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const T = { ui: { toasts: 2 } };
  const GameA = { modal: null, dive: 1 }, GameB = { modal: null, dive: 1 };
  // as it was (js/ui.js), with its own clock and timers
  const UI = {
    hintQ: [], hintsSeen: new Set(), hintsFor: null,
    toast(msg, kind) {
      if (kind !== 'tip') { UI.showToast(msg, kind); return; }
      if (UI.hintsFor !== GameA.dive) { UI.hintsFor = GameA.dive; UI.hintsSeen.clear(); }
      if (UI.hintsSeen.has(msg) || UI.hintQ.some((h) => h.msg === msg)) return;
      UI.hintQ.push({ msg });
      UI.pumpToasts();
    },
    showToast(msg, kind) {
      const box = boxA, most = T.ui.toasts;
      for (const o of [...box.children]) if (o.textContent === msg) o.remove();
      const el = new El('div');
      el.className = 'toast' + (kind ? ' r-' + kind : '');
      el.textContent = msg;
      el.dataset.born = TA.now;
      const secs = clamp(msg.length * (kind === 'tip' ? 0.05 : 0.035), kind === 'tip' ? 2.6 : 1.8, 4.5);
      el.style.animationDuration = secs + 's';
      box.appendChild(el);
      while (box.children.length > most) box.firstChild.remove();
      if (kind === 'tip') UI.hintsSeen.add(msg);
      TA.setTimeout(() => { el.remove(); UI.pumpToasts(); }, secs * 1000);
    },
    pumpToasts() {
      const box = boxA;
      if (GameA.modal) return;
      while (UI.hintQ.length && box.children.length < T.ui.toasts) { const h = UI.hintQ.shift(); UI.showToast(h.msg, 'tip'); }
    },
    show(id) {
      for (const t of [...boxA.children]) {
        if (!t.classList.contains('r-tip')) { t.remove(); continue; }
        if (TA.now - t.dataset.born < 800) { UI.hintsSeen.delete(t.textContent); UI.hintQ.unshift({ msg: t.textContent, at: t.dataset.at }); }
        t.remove();
      }
      GameA.modal = id;
    },
  };
  // on Tycho: the same, with the stand-in's clock and timers
  const realNow = Date.now, realST = globalThis.setTimeout, realDoc = globalThis.document;
  globalThis.document = { createElement: (t) => new El(t) };
  let hintsFor = null;
  const toaster = new ui.Toasts({
    box: () => boxB, most: () => T.ui.toasts, replace: true, animate: true, once: true,
    cls: (kind) => 'toast' + (kind ? ' r-' + kind : ''),
    life: (msg, kind) => clamp(msg.length * (kind === 'tip' ? 0.05 : 0.035), kind === 'tip' ? 2.6 : 1.8, 4.5),
    waits: (kind) => kind === 'tip', held: () => !!GameB.modal,
  });
  const toastB = (msg, kind) => { if (kind === 'tip' && hintsFor !== GameB.dive) { hintsFor = GameB.dive; toaster.forget(); } toaster.show(msg, kind); };
  const onB = (fn) => { Date.now = () => TB.now; globalThis.setTimeout = TB.setTimeout; try { return fn(); } finally { Date.now = realNow; globalThis.setTimeout = realST; } };
  try {
    const both = (a, b) => { a(); onB(b); assert.equal(state(boxB), state(boxA)); assert.deepEqual(toaster.queue.map((h) => h.text), UI.hintQ.map((h) => h.msg)); assert.deepEqual([...toaster.seen].sort(), [...UI.hintsSeen].sort()); };
    const wait = (ms) => { for (let k = 0; k < ms; k += 16) { both(() => { TA.run(16); UI.pumpToasts(); }, () => { TB.run(16); toaster.tick(); }); } };
    const news = (m, k) => both(() => UI.toast(m, k), () => toastB(m, k));
    news('Your light is fading', 'legendary'); news('A shaft: the Deep is under here', 'tip'); news('Hold to mend: the vein will carry the light further', 'tip');
    news('Not with the thread in hand'); wait(500); news('Not with the thread in hand'); news('Banked: 3 ember', 'legendary');
    wait(2400); news('A shaft: the Deep is under here', 'tip');
    news('One more hint, for after', 'tip'); wait(752);
    // a screen opens: news goes, a hint just shown comes back after, the rest count as read
    both(() => UI.show('screen-pause'), () => { toaster.clear(0.8); GameB.modal = 'screen-pause'; });
    news('Can\'t stand there'); news('A hint while the screen is up', 'tip'); wait(3000);
    both(() => { GameA.modal = null; }, () => { GameB.modal = null; }); wait(6000);
    // a new world: its hints again
    both(() => { GameA.dive = 2; }, () => { GameB.dive = 2; }); news('A shaft: the Deep is under here', 'tip'); wait(5000);
    assert.equal(boxA.kids.length, 0);
  } finally { Date.now = realNow; globalThis.setTimeout = realST; globalThis.document = realDoc; }
});

// ---- buttons ---------------------------------------------------------------------------
test('buttons wired by their data attributes, as panelBind did, and acts as Lodestar\'s screens ran them', () => {
  const mk = (attrs, parent) => { const b = new El('button'); Object.assign(b.dataset, attrs); parent.appendChild(b); return b; };
  const body = new El('div'), got = [];
  const bs = [mk({ selljunk: '' }, body), mk({ buypart: '3' }, body), mk({ job: 'take:ozzy' }, body), mk({ job: 'take:lin', say: '2' }, body), mk({ say: '0' }, body), mk({ benchLoad: 'x' }, body)];
  const inner = new El('div'); body.appendChild(inner); const deep = mk({ talk: '1' }, inner);
  ui.bind(body, {
    selljunk: (v) => got.push(['junk', v]), buypart: (v) => got.push(['buy', +v]),
    'job:not([data-say])': (v) => got.push(['job', v]), say: (v, b) => got.push(['say', +v, b === bs[3] || b === bs[4]]),
    talk: (v) => got.push(['talk', v]), 'bench-load': (v) => got.push(['bench', v]),
  });
  for (const b of [...bs, deep]) b.onclick && b.onclick();
  assert.deepEqual(got, [['junk', ''], ['buy', 3], ['job', 'take:ozzy'], ['say', 2, true], ['say', 0, true], ['bench', 'x'], ['talk', '1']]);
  // acts: the original onTap, and Tycho's, on the same taps
  const run = (useTycho) => {
    const log = [], screen = new El('div'), doc = new El('div'); doc.appendChild(screen);
    let opened = 0, now = 0;
    const acts = { go: (a) => log.push('go ' + a), startOver: () => log.push('start over'), back: () => log.push('back') };
    const btn = (d, text) => { const b = new El('button'); Object.assign(b.dataset, d); b.textContent = text; screen.appendChild(b); const s = new El('span'); s.textContent = '·'; b.appendChild(s); return b; };
    const go = btn({ act: 'go', arg: 'screen-map' }, 'MAP'), over = btn({ act: 'startOver', confirm: 'TAP AGAIN' }, 'START OVER'), wipe = btn({ act: 'back', confirm: 'SURE?' }, 'WIPE'), off = btn({ act: 'go', arg: 'x' }, 'OFF'); off.disabled = true;
    const tapGuard = 0.4, realDoc = globalThis.document;
    globalThis.document = { querySelectorAll: (s) => doc.querySelectorAll(s) };
    const original = (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled || now - opened < tapGuard) return;
      if (el.dataset.confirm && !el.classList.contains('armed')) {
        for (const o of document.querySelectorAll('.armed')) { o.classList.remove('armed'); o.textContent = o.dataset.label; }
        el.dataset.label = el.textContent;
        el.classList.add('armed'); el.textContent = el.dataset.confirm;
        opened = now - tapGuard + 0.25;
        return;
      }
      const fn = acts[el.dataset.act];
      if (fn) { log.push('tap'); fn(el.dataset.arg); }
    };
    const A = new ui.Acts({ acts: () => acts, guard: () => now - opened < tapGuard, armed: () => { opened = now - tapGuard + 0.25; }, onAct: () => log.push('tap') });
    const tap = (el) => (useTycho ? A.tap({ target: el.kids[0] || el }) : original({ target: el.kids[0] || el }));
    try {
      for (const [dt, el] of [[0.1, go], [0.4, go], [0, off], [0, over], [0.1, over], [0.2, over], [0, wipe], [0.3, over], [0.3, over], [0, screen]]) { now += dt; tap(el); log.push([go, over, wipe].map((b) => b.className + ':' + b.textContent).join(',')); }
    } finally { globalThis.document = realDoc; }
    return log;
  };
  const a = run(false), b = run(true);
  assert.deepEqual(b, a);
  assert.ok(a.includes('start over') && a.includes('go screen-map'));
});
