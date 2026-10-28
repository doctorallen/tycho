// The inspector's mind against the White Dragon's Tyrell mode, which it
// replaced: for the same world, person and moment, the same HTML, character
// for character. Its original (js/tyrellmode.js, TyrellMode.mind) is kept
// here as it was, on Tyrell's Rocinante, with stand-ins for the game's
// tables (its residents, the census's places, where someone is on screen).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as Tycho from '../dist/tycho.mjs';

const require = createRequire(import.meta.url);
const Tyrell = require('../dist/tyrell.cjs');
const buildRocinante = require('../tyrell/examples/rocinante.js');
const { inspect } = Tycho;

// ---- the White Dragon's original, and the game round it -------------------------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function wdGame(w) {
  const RESIDENTS = {}, LABEL = { cafe: 'Mara\'s Cafe', market: 'The Market', bar: 'The Belt <late>', park: 'Ring Park' };
  for (const p of w.people()) RESIDENTS[p.id] = { name: p.name + (p.id === 'sam' ? ' & co' : ''), homePlace: p.def.home, likes: p.id === 'kofi' ? { reading: 1, walks: 1 } : p.id === 'ruth' ? {} : undefined };
  delete RESIDENTS.vance; // someone in the world who isn't a resident: named, not a button
  const Census = { places: Object.fromEntries(Object.entries(LABEL).map(([id, label]) => [id, { label }])) };
  const City = { w, state: (id) => ({ gap: id === 'kofi' || id === 'pip', level: id === 'lena' ? null : 'main', hidden: id === 'dev' }) };
  const Folk = { who: (id) => (id === 'pip' ? 'a child, 9' : 'lives in ' + (w.get(id).def.home || 'nowhere')) };
  const TM = {
    follow: false,
    hhmm(m) { const h = (((m / 60) % 24) + 24) % 24; return String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0'); },
    mind(id) {
      const w = City.w, p = w.get(id), R = RESIDENTS[id], C = Census.places, st = City.state(id), d = p.doing, at = (pid) => (!pid ? 'anywhere' : pid === R.homePlace ? 'home' : C[pid] ? C[pid].label : pid);
      const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
      let h = `<h3>${esc(R.name)}</h3><p class="sub">${esc(Folk.who(id))}</p>`;
      const now = !d ? 'Nothing, waiting to choose.' : d.kind === 'travel' ? `Walking${st.gap ? ' (off screen)' : ''} from ${esc(at(d.from))} to ${esc(at(d.to))}, to ${d.action}, till ${this.hhmm(d.end)}.` : d.kind === 'wait' ? `Waiting at ${esc(at(p.place))} till ${this.hhmm(d.end)}.` : `${d.action} at ${esc(at(d.place || p.place))}, till ${this.hhmm(d.end)}.`;
      h += `<p><b>Now</b> ${now}${d && d.rank !== undefined ? ` <small class="dim">(${d.layer || 'free'}, rank ${d.rank})</small>` : ''}</p>`;
      if (p.directive && !p.directive.done) h += `<p class="dim">Told to: ${p.directive.do}${p.directive.label ? ' · ' + esc(p.directive.label) : ''}</p>`;
      h += '<div class="tmneeds">' + Object.keys(p.needs).map((k) => { const v = w.needOf(id, k); return `<div><span>${k}</span><i><b style="width:${Math.round(clamp(v, 0, 1) * 100)}%;background:${v > 0.85 ? '#ff4a5a' : v > 0.6 ? '#ffb040' : '#3af0e0'}"></b></i></div>`; }).join('') + '</div>';
      const rv = w.reverie; if (rv) h += `<p class="dim">Mood ${(rv.mood(id) || 0).toFixed(2)}${p.vars && p.vars.money !== undefined ? ` · ${Math.round(p.vars.money)} cr` : ''}${R.likes && Object.keys(R.likes).length ? ' · likes ' + Object.keys(R.likes).join(', ') : ''}</p>`;
      const dec = w.why(id);
      if (!dec) h += '<h3>Why</h3><p class="dim">No choice made since the last time walk: play the clock on a little.</p>';
      if (dec) {
        h += `<h3>Why · ${this.hhmm(dec.t)}</h3><p class="dim">${esc(dec.reason || '')}</p><div class="tmwhy">`;
        const pk = dec.picked, isPick = (c) => !!pk && c.id === pk.id && c.place === pk.place && c.target === pk.target;
        const cands = dec.candidates.slice().sort((a, b) => isPick(b) - isPick(a) || b.rank - a.rank || b.weight - a.weight).slice(0, 9);
        if (pk) h += `<p>Chose <b>${pk.id}</b> at ${esc(at(pk.place))}${pk.layer ? ` <small class="dim">(${pk.layer})</small>` : ''}. It's drawn from the best few, by weight squared, so the top one doesn't always win.</p>`;
        for (const c of cands) h += `<div class="${isPick(c) ? 'pick' : c.blocked ? 'no' : ''}"><b>${c.id}</b> <small>${esc(at(c.place))} · rank ${c.rank}${c.blocked ? '' : ' · ' + c.weight.toFixed(3)}</small><br><small>${esc(c.blocked || (c.parts || []).map(([n, v]) => n + ' ' + (+v).toFixed(2)).join(' × '))}</small></div>`;
        h += '</div>';
      }
      const ra = w.mind.routineAt(p), plan = (w.mind.routineFor(p, w.now) || []).slice().sort((a, b) => a[0] - b[0]), cur = ra && ra.entry;
      if (plan.length) h += '<h3>Today</h3><div class="tmday">' + plan.map((e) => `<div class="${e === cur ? 'cur' : ''}"><span>${String(Math.floor(e[0])).padStart(2, '0')}:${String(Math.round((e[0] % 1) * 60)).padStart(2, '0')}</span> ${e[2] === '*' ? 'free' : e[2]} <small>${e[1] === null ? '' : esc(e[1] === 'home' ? 'home' : at(e[1]))}${e[3] && e[3].rank ? ' · holds' : ''}</small></div>`).join('') + '</div>';
      const lines = w.westmarch.chronicle(id, w.now - 12 * 60).slice(-10);
      if (lines.length) h += '<h3>Lately</h3><div class="tmlog">' + lines.map((l) => `<div>${esc(l)}</div>`).join('') + '</div>';
      const fs = w.fellowship ? w.fellowship.relations(id).slice(0, 4) : [];
      if (fs.length) h += '<h3>People</h3><div class="tmlist">' + fs.map((f) => RESIDENTS[f.id] ? `<button data-tmsel="${f.id}">${esc(RESIDENTS[f.id].name)} <small>regard ${f.regard.toFixed(2)}</small></button>` : `<span class="dim">${esc(f.id)} · ${f.regard.toFixed(2)}</span>`).join('') + '</div>';
      h += `<div class="buttons"><button data-tmdo="follow" class="${this.follow ? 'go' : ''}">${this.follow ? 'Following' : 'Follow'}</button><button data-tmdo="street">Their street</button><button data-tmdo="go" ${st.level && !st.hidden ? '' : 'disabled'}>Go there</button><button data-tmdo="close">Close</button></div>`;
      return h;
    },
  };
  // the same, on Tycho's inspector: the game's options
  const opts = {
    prefix: 'tm',
    name: (id) => RESIDENTS[id].name,
    who: (id) => Folk.who(id),
    place: (pid, id) => (!pid ? 'anywhere' : pid === RESIDENTS[id].homePlace ? 'home' : Census.places[pid] ? Census.places[pid].label : pid),
    walking: (id) => (City.state(id).gap ? ' (off screen)' : ''),
    about: (id, p) => `${p.vars && p.vars.money !== undefined ? ` · ${Math.round(p.vars.money)} cr` : ''}${RESIDENTS[id].likes && Object.keys(RESIDENTS[id].likes).length ? ' · likes ' + Object.keys(RESIDENTS[id].likes).join(', ') : ''}`,
    selectable: (id) => !!RESIDENTS[id],
    buttons: (id) => { const st = City.state(id); return `<button data-tmdo="follow" class="${TM.follow ? 'go' : ''}">${TM.follow ? 'Following' : 'Follow'}</button><button data-tmdo="street">Their street</button><button data-tmdo="go" ${st.level && !st.hidden ? '' : 'disabled'}>Go there</button>`; },
  };
  return { RESIDENTS, TM, opts };
}

test('a mind reads as the White Dragon\'s Tyrell mode read it, character for character', () => {
  const w = buildRocinante(Tyrell, { seed: 'inspect', start: 5 * 60 });
  const { RESIDENTS, TM, opts } = wdGame(w);
  const ids = Object.keys(RESIDENTS);
  let n = 0, travel = 0, why = 0, none = 0;
  const check = () => {
    for (const id of ids) {
      const a = TM.mind(id), b = inspect.mind(w, id, opts);
      assert.equal(b, a, `${id} at ${w.now}`);
      n++; if (/Walking/.test(a)) travel++; if (/Chose/.test(a)) why++; if (/No choice made/.test(a)) none++;
    }
  };
  check();
  for (let i = 0; i < 40; i++) { w.advance(37); TM.follow = i % 3 === 0; check(); }
  // back by Esper's time walk: the decisions are gone until the next ones
  w.seek(w.now - 90); check();
  assert.ok(n > 300 && travel > 5 && why > 100 && none > 0, JSON.stringify({ n, travel, why, none }));
});

test('without the game\'s words a mind still reads, from the world alone', () => {
  const w = buildRocinante(Tyrell, { seed: 'plain', start: 7 * 60 });
  w.advance(90);
  const h = inspect.mind(w, 'ruth', {});
  for (const part of ['<h3>Ruth', '<b>Now</b>', 'class="inspneeds"', 'Mood ', '<h3>Why', '<h3>Today</h3>', '<h3>Lately</h3>', 'data-inspdo="close"']) assert.ok(h.includes(part), part);
  assert.ok(!h.includes('undefined'));
  assert.match(inspect.mind(w, 'nobody', {}), /Not in the world/);
  assert.equal(inspect.hhmm(0), '00:00'); assert.equal(inspect.hhmm(24 * 60 + 61.5), '01:01'); assert.equal(inspect.hhmm(-30), '23:30');
  assert.equal(inspect.esc('a<b>&c'), 'a&lt;b&gt;&amp;c');
});

test('the panel steps the clock no further back than Esper remembers, lists and counts', () => {
  const w = buildRocinante(Tyrell, { seed: 'panel', start: 6 * 60 });
  w.advance(120);
  let said = null, t = w.now;
  const ins = new inspect.Inspector({
    world: () => w, people: () => w.people().map((p) => p.id), prefix: 'tm',
    kinds: { work: { color: '#ffb040', word: 'working' }, other: { color: '#c8c0d8', word: 'other' } },
    kind: (id) => (w.get(id).doing && /work|bake|fix|serve|tend/.test(w.get(id).doing.action) ? 'work' : 'other'),
    note: (id) => (w.get(id).doing ? w.get(id).doing.action : ''), name: (id) => w.get(id).name,
    clock: { now: () => t, set: (m) => { t = m; w.seek(m); }, text: () => 'Day ' + Math.floor(t / 1440) },
    say: (s) => { said = s; },
  });
  ins.step(30); assert.equal(t, w.now); assert.equal(said, null);
  const e = w.esper.earliest();
  ins.step(-(t - e) - 200);
  assert.equal(t, Math.ceil(e / 15) * 15); assert.match(said, /^Esper only remembers back to \d\d:\d\d\.$/);
  const html = ins.html();
  assert.ok(html.includes('<button data-tm="-60" title="Back an hour">−1h</button><button data-tm="-15">−15m</button><button data-tm="play" class="go" id="tmplay">Play</button><button data-tm="15">+15m</button><button data-tm="60">+1h</button>'));
  assert.ok(html.includes('<option value="60" selected>×60</option>') && html.includes('<canvas id="tmcv"></canvas>'));
  const sum = ins.summary(), n = w.people().length;
  assert.ok(sum.startsWith(`<h3>${n} people</h3>`) && sum.includes('<div class="tmlegend">'));
  const L = ins.listHtml({ title: 'The Belt · 2 inside', ids: ['ines', 'sam'] });
  assert.equal(L, `<h3>The Belt · 2 inside</h3><div class="tmlist"><button data-tmsel="ines"><i style="background:${ins.color('ines')}"></i>Ines <small>${ins.o.note('ines')}</small></button><button data-tmsel="sam"><i style="background:${ins.color('sam')}"></i>Sam <small>${ins.o.note('sam')}</small></button></div><div class="buttons"><button data-tmdo="close">Back</button></div>`);
  // dots and taps: the nearest within 9 px is picked; else the box under it, to the view
  const got = [];
  ins.o.view = { draw() {}, tap: (b) => got.push(b && b.what) };
  ins.dots = [{ x: 10, y: 10, id: 'ruth' }, { x: 30, y: 10, id: 'kofi' }];
  ins.badges = [{ x0: 50, x1: 70, y0: 0, y1: 20, what: 'door' }];
  ins.draw = () => {}; ins.side = () => {};
  ins.tap(27, 12); assert.equal(ins.sel, 'kofi');
  ins.tap(60, 5); ins.tap(100, 100); assert.deepEqual(got, ['door', null]);
});
