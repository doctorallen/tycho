// The sound's parts that run without a browser, against Lodestar's own
// (js/audio.js, music.js, sndbank.js before the move): its random stream,
// pitches, settings, how a layer fades in, the saturation's curve and the
// reverb's impulse, bit for bit; and the music's machinery (targets set
// once, events now and then, the dip) against a stand-in for Web Audio.
// The rest (every call made on Web Audio, and what renders) is held to the
// original in a browser: test/audio.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Tycho from '../dist/tycho.mjs';

const { audio } = Tycho;

// ---- Lodestar's originals -----------------------------------------------------
let _sndSeed = 0x2545f491;
function sndRand() { _sndSeed ^= _sndSeed << 13; _sndSeed ^= _sndSeed >>> 17; _sndSeed ^= _sndSeed << 5; _sndSeed >>>= 0; return _sndSeed / 4294967296; }
function sndRange(a, b) { return a + (b - a) * sndRand(); }
function sndHz(semi) { return 293.66 * Math.pow(2, semi / 12); }
function sndClamp(v, a, b) { return v < a ? a : v > b ? b : v; }
const level = (v) => (v === undefined || v === true ? 1 : v === false ? 0 : sndClamp(+v || 0, 0, 1));
function musPresence(s, at) { const k = sndClamp((s - at + 0.1) / 0.2, 0, 1); return k * k * (3 - 2 * k); }
function bkCurve(k) {
  const n = 1025, a = new Float32Array(n), m = Math.tanh(k);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; a[i] = Math.tanh(k * x) / m; }
  return a;
}
function bkImpulse(rate, secs, metal) {
  const n = Math.floor(rate * secs), chs = [new Float32Array(n), new Float32Array(n)];
  const modes = metal ? [431, 1173, 1777, 2390] : [];
  for (let ch = 0; ch < 2; ch++) {
    let lp = 0;
    const d = chs[ch];
    for (let i = 0; i < n; i++) {
      const t = i / rate, env = Math.exp(-t * 6.5 / secs), k = 0.15 + 0.8 * Math.exp(-t * 4 / secs);
      lp += (sndRand() * 2 - 1 - lp) * k;
      let v = lp * env;
      for (let m = 0; m < modes.length; m++) v += Math.sin(2 * Math.PI * modes[m] * (1 + ch * 0.003) * t) * 0.05 * Math.exp(-t * (9 + m * 4));
      d[i] = t < 0.004 ? v * (t / 0.004) : v;
    }
  }
  return chs;
}

test('the random stream, pitches, settings and presence are Lodestar\'s', () => {
  _sndSeed = 0x2545f491;
  const R = new audio.Rand(0x2545f491);
  for (let i = 0; i < 20000; i++) assert.equal(i % 3 ? R.next() : R.range(-0.6, 0.6), i % 3 ? sndRand() : sndRange(-0.6, 0.6));
  assert.equal(new audio.Rand().s, 0x2545f491);
  for (let s = -30; s <= 30; s += 0.5) assert.equal(audio.hz(s, 293.66), sndHz(s));
  assert.equal(audio.hz(12), 880);
  for (const v of [undefined, true, false, 0, 0.4, 1, 2, -1, '0.4', 'x', null]) assert.equal(audio.setting(v), level(v));
  for (let s = -0.2; s <= 1.2; s += 0.01) for (const at of [0.16, 0.32, 0.46, 0.62, 0.84]) assert.equal(audio.presence(s, at), musPresence(s, at));
});

test('the saturation and the reverb\'s impulse are Lodestar\'s', () => {
  for (const k of [1.1, 1.4, 1.8, 2]) assert.deepEqual(audio.curve(k), bkCurve(k));
  _sndSeed = 0x2545f491;
  const R = new audio.Rand();
  for (const [rate, secs, metal] of [[48000, 0.45, true], [32000, 0.45, true], [24000, 1.4, false]]) {
    const a = audio.impulse(rate, secs, metal ? [431, 1173, 1777, 2390] : [], R), b = bkImpulse(rate, secs, metal);
    assert.deepEqual(a, b);
  }
  assert.equal(R.s, _sndSeed);
});

// a stand-in for an AudioParam, recording what's set on it
const param = () => ({ log: [], setTargetAtTime(v, t, tc) { this.log.push(['target', v, t, tc]); }, cancelScheduledValues(t) { this.log.push(['cancel', t]); } });

test('the music sets a target only when it changes, keeps events due, and dips', () => {
  const m = new audio.Music({ layers: {}, every: 0.1 }), p = param();
  m.set(p, 0.5, 1, 0.3); m.set(p, 0.50001, 2, 0.3); m.set(p, 0.6, 3, 0.3); m.forget(p); m.set(p, 0.6, 4, 0.3);
  assert.deepEqual(p.log, [['target', 0.5, 1, 0.3], ['target', 0.6, 3, 0.3], ['target', 0.6, 4, 0.3]]);
  // events: Lodestar's bed loop, written out, against Music.due
  m.S = { rand: new audio.Rand(7) };
  _sndSeed = 7;
  const mine = [], theirs = [], next = {};
  const lists = (now) => (now < 30 ? [['drip', 2, 5, 0.6], ['crackle', 0.2, 1.2, 0.6]] : [['drip', 2, 5, 0.6], ['chirp', 4, 12, 0.5]]);
  for (let now = 0; now < 60; now += 0.1) {
    m.due(now, lists(now), (e) => mine.push([e[0], now, m.S.rand.next()]));
    const evs = lists(now);
    for (const [kind, lo, hi] of evs) {
      if (next[kind] === undefined) next[kind] = now + sndRange(lo, hi);
      if (now < next[kind]) continue;
      next[kind] = now + sndRange(lo, hi);
      theirs.push([kind, now, sndRand()]);
    }
    for (const kind of Object.keys(next)) if (!evs.some((e) => e[0] === kind)) delete next[kind];
  }
  assert.ok(mine.length > 40);
  assert.deepEqual(mine, theirs);
  assert.deepEqual(m.nextEv, next);
  // the dip: to k at t, back after hold
  const g = param(); m.master = { gain: g };
  m.duck(5, 0.4, 2);
  assert.deepEqual(g.log, [['cancel', 5], ['target', 0.4, 5, 0.04], ['target', 1, 7, 0.6]]);
  // the tick: listen every frame, the update every `every` s
  const seen = [];
  Object.assign(m, { built: true, S: { ctx: { currentTime: 0 }, rand: m.S.rand }, listen: (now) => seen.push('l' + now), state: () => 's', update: (now, st) => seen.push('u' + now + st) });
  for (const t of [0, 0.05, 0.1, 0.12, 0.25]) { m.S.ctx.currentTime = t; m.tick(1 / 60); }
  assert.deepEqual(seen, ['l0', 'u0s', 'l0.05', 'l0.1', 'u0.1s', 'l0.12', 'l0.25', 'u0.25s']);
});

test('a cue nobody knows does nothing, and nothing plays before the context is made', () => {
  const E = new audio.Engine({ cues: { tap: { fn() { throw new Error('no'); } } }, mix: { master: 1, music: 1, sfx: 1, space: 0.5, voices: 4, gap: 0.03, near: [50, 230], panW: 140, panMax: 0.7 } });
  assert.equal(E.ready, false);
  assert.equal(E.play('tap'), false);
  E.cue('tap'); E.cue('nothing');
  assert.equal(E.canPlay('nothing'), true);
  assert.equal(E.level('sfx'), 1); assert.equal(E.wanted(), true);
  assert.deepEqual(E.where({ x: 10, y: 0 }), { g: 1, pan: 0 });
  const L = new audio.Engine({ cues: {}, mix: E.o.mix, listener: () => ({ x: 0, y: 0 }), level: (k) => (k === 'sfx' ? 0 : 0.4) });
  assert.deepEqual(L.where({ x: 140, y: 0 }), { g: (1 - 90 / 180) ** 2, pan: 0.7 });
  assert.deepEqual(L.where({ x: -30, y: 40 }), { g: 1, pan: -30 / 140 });
  assert.equal(L.where({ x: 300, y: 0 }).g, 0);
  assert.equal(L.wanted(), true);
  const B = new audio.Bank({ recipes: {}, order: [] });
  assert.equal(B.has('x'), false);
  B.bufs.x = [1, 2, 3]; B.rand = new audio.Rand(3);
  const picks = []; for (let i = 0; i < 30; i++) picks.push(B.pick('x'));
  for (let i = 1; i < picks.length; i++) assert.notEqual(picks[i], picks[i - 1]); // never the one just played
});
