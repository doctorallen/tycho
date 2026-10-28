// The sound in a browser page, held to Lodestar's original. Run with
// `node test/audio.js` (or `npm run test:browser`, with the pixels' canvas
// work): Playwright's Chromium, or puppeteer-core with the Chrome in
// $CHROME, through the test kit.
//
// Lodestar's sound as it was (test/fixtures/lodestar-audio/before:
// its js/audio.js, music.js and sndbank.js before the move) beside Tycho's
// engine with Lodestar's recipes on it (after: the same files as they are
// on Tycho.audio), each in a frame of its own in one page. Both play the
// same cases in OfflineAudioContexts: every live cue with a spread of
// options, distance and pan, gaps, the voices' cap and the settings; every
// sound in the bank rendered, the bank's start (its order, the opening's
// first, its variants), want and drop, and the bank's cues played from it;
// the music built and run through a timeline of states, with the star fed,
// a magnitude reached, a dip, a lift and the footsteps it listens for.
// For each case every call made on Web Audio (each node made, every
// connection, every param's value and schedule, each buffer's contents,
// each start and stop) is traced, and the traces must be the same call for
// call, and the sound's own random stream must be at the same place after
// every case. The rendered samples must then agree to Chromium's own
// rounding: it sums a node's inputs in an order of its own, which moves the
// last bit between two runs of the same code, and a limiter, a saturation
// and a normalized peak carry that to about 6e-4 at most (SELF=1 compares
// the original with itself, to see it). What a render made, and the buffers
// made from it after, are compared by their samples, not by the trace.
'use strict';
const fs = require('fs');
const path = require('path');
const tk = require('../dist/testkit.cjs');

const ROOT = path.join(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures', 'lodestar-audio');
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

// ---- in each frame: the tracer, installed before anything else ------------
function tracer() {
  const TR = (window.__trace = { log: [], on: false });
  let nid = 0;
  // (what a render made, and what's made from it after, is compared by its
  // samples, not here: a render's last bits aren't the same twice)
  const ids = new WeakMap(), params = new WeakMap(), rendered = new WeakSet(), derived = new WeakSet();
  const id = (o) => { if (o === null || o === undefined) return o; let v = ids.get(o); if (v === undefined) { v = (o.constructor && o.constructor.name) + '#' + (++nid); ids.set(o, v); } return v; };
  const hashArr = (a) => { let h = 0x811c9dc5 | 0; const u = new Uint32Array(a.buffer, a.byteOffset, a.length); for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 0x01000193); return 'f32:' + a.length + ':' + (h >>> 0).toString(16); };
  const bufHash = (b) => { if (!b) return null; const out = [id(b), b.numberOfChannels, b.length, b.sampleRate]; if (derived.has(b)) out.push('rendered'); else for (let k = 0; k < b.numberOfChannels; k++) out.push(hashArr(b.getChannelData(k))); return out.join(' '); };
  const val = (x) => (x instanceof AudioParam ? params.get(x) || 'param?' : x instanceof Float32Array ? hashArr(x) : x instanceof AudioBuffer ? bufHash(x) : x !== null && typeof x === 'object' ? id(x) : x);
  const rec = (...e) => { if (TR.on) TR.log.push(e.map(val)); };
  const PARAMS = ['gain', 'frequency', 'detune', 'Q', 'pan', 'delayTime', 'playbackRate', 'threshold', 'knee', 'ratio', 'attack', 'release'];
  const name = (n) => { for (const k of PARAMS) { const p = n[k]; if (p instanceof AudioParam) params.set(p, id(n) + '.' + k); } };
  const BAC = BaseAudioContext.prototype;
  for (const m of ['createGain', 'createOscillator', 'createBiquadFilter', 'createBufferSource', 'createDynamicsCompressor', 'createStereoPanner', 'createDelay', 'createConvolver', 'createWaveShaper']) {
    const f = BAC[m];
    BAC[m] = function (...a) { const n = f.apply(this, a); id(n); name(n); rec('new', m, n, this, ...a); return n; };
  }
  const cb = BAC.createBuffer;
  BAC.createBuffer = function (...a) { const b = cb.apply(this, a); id(b); if (rendered.has(this)) derived.add(b); rec('buffer', b === null ? null : id(b), ...a); return b; };
  const cw = BAC.createPeriodicWave;
  BAC.createPeriodicWave = function (re, im, o) { const w = cw.call(this, re, im, o); rec('wave', id(w), re, im); return w; };
  const dest = Object.getOwnPropertyDescriptor(BAC, 'destination').get;
  Object.defineProperty(BAC, 'destination', { get() { const d = dest.call(this); if (!ids.has(d)) { id(d); rec('dest', d, this); } return d; } });
  const conn = AudioNode.prototype.connect, disc = AudioNode.prototype.disconnect;
  AudioNode.prototype.connect = function (...a) { rec('connect', this, ...a); return conn.apply(this, a); };
  AudioNode.prototype.disconnect = function (...a) { rec('disconnect', this, ...a); return disc.apply(this, a); };
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) {
    const f = AudioParam.prototype[m];
    AudioParam.prototype[m] = function (...a) { rec('p', this, m, ...a); return f.apply(this, a); };
  }
  const pv = Object.getOwnPropertyDescriptor(AudioParam.prototype, 'value');
  Object.defineProperty(AudioParam.prototype, 'value', { get: pv.get, set(v) { rec('v', this, v); pv.set.call(this, v); } });
  const prop = (P, k) => { const d = Object.getOwnPropertyDescriptor(P, k); Object.defineProperty(P, k, { get: d.get, set(v) { rec('set', this, k, typeof v === 'function' ? 'fn' : v); d.set.call(this, v); } }); };
  prop(OscillatorNode.prototype, 'type'); prop(BiquadFilterNode.prototype, 'type');
  prop(AudioBufferSourceNode.prototype, 'buffer'); prop(AudioBufferSourceNode.prototype, 'loop');
  prop(WaveShaperNode.prototype, 'curve'); prop(WaveShaperNode.prototype, 'oversample');
  prop(ConvolverNode.prototype, 'buffer'); prop(AudioScheduledSourceNode.prototype, 'onended');
  for (const m of ['start', 'stop']) { const f = AudioScheduledSourceNode.prototype[m]; AudioScheduledSourceNode.prototype[m] = function (...a) { rec(m, this, ...a); return f.apply(this, a); }; }
  const spw = OscillatorNode.prototype.setPeriodicWave;
  OscillatorNode.prototype.setPeriodicWave = function (w) { rec('setPeriodicWave', this, w); return spw.call(this, w); };
  const ctc = AudioBuffer.prototype.copyToChannel;
  AudioBuffer.prototype.copyToChannel = function (...a) { rec('copyToChannel', this, derived.has(this) ? 'rendered:' + a[0].length : a[0], a[1]); return ctc.apply(this, a); };
  const sr = OfflineAudioContext.prototype.startRendering;
  OfflineAudioContext.prototype.startRendering = function () { rec('render', this, this.length, this.sampleRate); rendered.add(this); return sr.call(this).then((b) => { derived.add(b); return b; }); };
}

// ---- in each frame: the game's surroundings the sound reads ---------------
const PRELUDE = `
const T = { sound: {
  stepAhead: 6, master: 0.9, music: 0.1, sfx: 0.8, soft: 0.4, space: 0.6, voices: 14, gap: 0.03,
  near: [50, 230], panW: 140, panMax: 0.7,
  presence: { kindled: 0.78, dark: [0.12, 0.66], deep: [0.04, 0.58] },
  figureAt: 0.62, phraseRest: [7, 12], callRest: [14, 22], awayRest: 1.5, beat: 0.8,
  figure: 0.5, bloom: 0.5, ping: 0.18, pingGap: 0.055,
  feedPer: 0.1, feedHeld: 0.6, feedFade: 0.45, feedSwell: 0.8, feedOpen: 900,
  magLate: 8, lift: 6, bedUnder: 0.55, bedDay: 0.6, events: 0.5, breath: 0.09,
  uneaseFrom: 2, uneasyPhrase: 0.6, lowHp: 0.3, stingR: 130, channel: 0.035,
}, story: { turnEcho: 5 } };
const TILE = 16, HAZ_CODES = { pool: 1, slick: 2, burn: 3 };
const Save = { data: { settings: {}, echoes: [], magnitude: 1 } };
const Game = { dive: null, modal: null, lit: false };
const Intro = { on: false };
function magnitudeOf() { return Math.max(1, Math.floor((Save.data && Save.data.magnitude) || 1)); }
function litAt() { return !!Game.lit; }
function stormHere(d) { return !!d.storm; }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
`;

// ---- in each frame: the cases, the same on both sides ---------------------
function scenario() {
  const TR = window.__trace, cases = [];
  const chans = (b) => { const out = []; if (b) for (let k = 0; k < b.numberOfChannels; k++) out.push(b.getChannelData(k)); return out; };
  const add = (name, fn) => cases.push([name, fn]);
  const ctx = (secs, rate = 24000) => new OfflineAudioContext(2, Math.ceil(secs * rate), rate);
  const RAR = ['common', 'magic', 'rare', 'legendary', 'set', 'exotic', 'relic', 'nope'];
  const OPTS = {
    mine: [{ tier: 1 }, { tier: 4 }, { tier: 6 }], oreBreak: [{ tier: 1 }, { tier: 3 }, { tier: 6 }], anvil: [{ grade: 'perfect' }, { grade: 'good' }, { grade: 'miss' }],
    loot: RAR.map((rarity) => ({ rarity })), reveal: RAR.map((rarity) => ({ rarity })), speak: [{ style: 'star' }, { style: 'wick' }, { style: 'other' }],
  };
  // every live cue, alone, from the start
  for (const name of Object.keys(SND_CUES)) {
    const C = SND_CUES[name];
    if (C.bank || C.music) continue;
    for (const o of OPTS[name] || [{}]) add('cue ' + name + ' ' + JSON.stringify(o), async () => { const c = ctx(5); Snd.build(c, false); const ok = Snd.play(name, o, 0.02); return { ok, buf: await c.startRendering() }; });
  }
  // distance and pan from the Kindler, a quick run of pickups, gaps, the
  // voices' cap and the settings
  add('engine: heard from where', async () => {
    const c = ctx(3); Snd.build(c, false); Game.dive = { p: { x: 0, y: 0 } };
    const r = [Snd.play('mine', { x: 90, y: 40, tier: 2 }, 0.02), Snd.play('oreBreak', { x: -160, y: 10, tier: 2 }, 0.3), Snd.play('thunder', { x: 400, y: 0 }, 0.5), Snd.play('waystone', { x: 20, y: 30, g: 0.5 }, 0.8), Snd.play('forgePress', {}, 1.2)];
    Game.dive = null; return { ok: r, buf: await c.startRendering() };
  });
  add('engine: pickups climb', async () => { const c = ctx(3); Snd.build(c, false); const r = []; for (let i = 0; i < 9; i++) r.push(Snd.play('pickup', {}, 0.02 + i * (i < 6 ? 0.1 : 0.8))); return { ok: r, buf: await c.startRendering() }; });
  add('engine: gaps and the cap', async () => {
    const c = ctx(4); Snd.build(c, false); const r = [], was = T.sound.voices;
    r.push(Snd.play('tap', {}, 0.01), Snd.play('tap', {}, 0.03), Snd.play('tap', {}, 0.06), Snd.play('nothing', {}, 0.1));
    T.sound.voices = 3;
    for (let i = 0; i < 6; i++) r.push(Snd.play('vent', {}, 0.2 + i * 0.26));
    r.push(Snd.play('bank', {}, 0.4), Snd.play('lightLow', {}, 0.45));
    T.sound.voices = was;
    return { ok: r, buf: await c.startRendering() };
  });
  add('engine: the settings', async () => {
    const r = [];
    for (const s of [{ sfx: false }, { sfx: 0.4, music: false }, { sfx: true, music: 0.4 }, { music: 2, sfx: -1 }]) {
      Save.data.settings = s; const c = ctx(1); Snd.build(c, false);
      r.push(Snd.level('music'), Snd.level('sfx'), Snd.wanted(), Snd.play('heal', {}, 0.02), Snd.play('channelBreak', {}, 0.02));
      Snd.applyLevels(false); await c.startRendering();
    }
    Save.data.settings = {};
    return { ok: r };
  });
  // the bank: every sound rendered, then the start, more variants, want and drop
  const keys = BANK_ORDER.concat(BANK_INTRO);
  add('bank: every sound', async () => {
    SndBank.rate = 48000; SndBank.irs = {}; const bufs = [];
    for (const k of keys) bufs.push(await SndBank.renderOne(BANK[k], 0));
    for (const k of ['hit.force', 'cast.ember', 'step.snow', 'kill']) bufs.push(await SndBank.renderOne(BANK[k], 1));
    return { bufs };
  });
  add('bank: start', async () => {
    Object.assign(SndBank, { bufs: {}, started: false, done: false, bytes: 0, irs: null, noises: null, queue: null });
    let paced = 0;
    await SndBank.start(48000, 0, { intro: true, pace: async () => { paced++; }, enough: () => true });
    const order = Object.keys(SndBank.bufs), bufs = [];
    for (const k of order) for (const b of SndBank.bufs[k]) bufs.push(b);
    return { ok: [order, order.map((k) => SndBank.bufs[k].length), SndBank.total, SndBank.first, SndBank.made, SndBank.done, SndBank.bytes, SndBank.queue.length, paced, SndBank.has('hit.force'), SndBank.has('intro.scene1'), SndBank.has('intro.scene2')], bufs };
  });
  add('bank: more variants, want and drop', async () => {
    for (let i = 0; i < 8; i++) await SndBank.renderNext();
    await SndBank.want(['intro.end', 'intro.skip', 'hit.force'], () => true, async () => {});
    const got = [SndBank.has('intro.end'), SndBank.has('intro.skip'), SndBank.bytes];
    SndBank.drop(['intro.end', 'nothing']);
    const bufs = [];
    for (const k of Object.keys(SndBank.bufs)) for (const b of SndBank.bufs[k]) bufs.push(b);
    return { ok: got.concat([SndBank.has('intro.end'), SndBank.bytes, SndBank.queue.length, SndBank.made]), bufs };
  });
  // the bank's cues, played from what's rendered
  add('bank: cues', async () => {
    const c = ctx(40); Snd.build(c, false); const r = []; let t = 0.02;
    const play = (n, o) => { r.push(sndReady(n, o), Snd.play(n, o, t)); t += 0.3; };
    for (const form of ['spark', 'arc', 'bolt', 'nova', 'lance', 'orb', 'well', 'ward', 'glaive', 'odd']) for (const els of [['force'], ['ember'], ['frost', 'shock'], []]) play('cast', { form, els, charged: form === 'orb', res: form === 'bolt' });
    play('cast', { form: 'arc', step: 2, els: ['shock'] });
    for (const el of ['force', 'shock', 'frost', 'ember', 'blight', 'odd']) for (const verdict of ['R', 'I', 'W', undefined]) play('hit', { el, verdict, crit: verdict === 'W', heavy: verdict === undefined, x: 30, y: 0 });
    for (const ground of ['dirt', 'snow', 'stone', 'metal', 'water', 'odd']) for (const foot of [0, 1]) play('step', { ground, foot });
    for (const n of ['dash', 'noCharge', 'react', 'kill', 'hurt', 'heal']) play(n, {});
    play('kill', { big: true });
    for (const kind of ['elite', 'boss', 'hollow']) play('sting', { kind });
    for (const n of [1, 2, 9]) play('introScene', { n });
    play('introThrust', { craft: true }); play('introThrust', {}); play('introEnd', { skipped: true }); play('introEnd', {});
    return { ok: r, buf: await c.startRendering() };
  });
  // the music: built, then a timeline of states, ten updates a second
  add('music', async () => {
    const c = ctx(26); Save.data = { settings: {}, echoes: [1, 2, 3, 4], magnitude: 8 };
    Snd.build(c, false); Music.build(Snd);
    Game.dive = { hub: true, channel: { t: 0.5, max: 2 }, kAnim: { walk: 1, ph: 0, ang: 0.3 }, p: { x: 10, y: 20, dashT: 0 }, dying: 0 };
    Music.tick(1 / 60);
    const st = (now) => now < 4 ? { mag: 8, unease: 0.5, s: 1, bed: 'hub', day: true, storm: false, dark: 0, dying: false }
      : now < 9 ? { mag: 8, unease: 1, s: 0.3, bed: 'magma', day: false, storm: true, dark: 0, dying: false }
      : now < 14 ? { mag: 3, unease: 0, s: 0.78, bed: 'bloomfen', day: true, storm: false, dark: 0, dying: false }
      : now < 18 ? { mag: 6, unease: 0.7, s: 0.05, bed: 'lair', day: false, storm: false, dark: 1, dying: false }
      : now < 21 ? { mag: 8, unease: 0.2, s: 0.9, bed: 'vault', day: false, storm: false, dark: 0, dying: false }
      : { mag: 9, unease: 0, s: 0.6, bed: 'nowhere', day: true, storm: false, dark: 0, dying: true };
    const r = [];
    for (let i = 0; i < 240; i++) {
      const now = 0.05 + i * 0.1;
      if (now < 4) { Game.dive.kAnim.ph = (now * 1.7) % 1; Music.listen(now); }
      if (i === 20) r.push(Snd.play('starFeedStart', {}, now));
      if (i === 25) r.push(Snd.play('starFeed', { tier: 3, rate: 30 }, now));
      if (i === 30) r.push(Snd.play('starFeed', { tier: 6, stream: true, n: 8 }, now));
      if (i === 35) r.push(Snd.play('starFeedEnd', {}, now));
      if (i === 60) r.push(Snd.play('starGrow', { mag: 9 }, now));
      if (i === 61) r.push(Snd.play('starGrow', { mag: 9, delay: 0.5 }, now));
      if (i === 100) Music.duck(now, 0.3, 1);
      if (i === 120) r.push(Snd.play('kindle', {}, now));
      if (i === 150) r.push(Snd.play('hurt', {}, now), Snd.play('death', {}, now + 0.5));
      Music.update(now, st(now));
    }
    Game.dive = null;
    r.push(Music.magHeard, Music.bloomed, Music.feed, Music.nextPhrase, Object.keys(Music.nextEv).sort().join(), Music.gust, Music.bedId, Music.breathAt);
    return { ok: r, buf: await c.startRendering() };
  });
  // what the music reads of the game
  add('music: the state', async () => {
    const r = [];
    Save.data = { settings: {}, echoes: [1, 2, 3], magnitude: 4.5 };
    for (const d of [null, { hub: true }, { deep: true, zone: 'lair', keeper: { dead: false }, clime: 'magma', pull: 0.4, p: { x: 0, y: 0 }, dying: 0 }, { deep: true, zone: 'deep', clime: null, pull: 0, p: { x: 0, y: 0 } }, { clime: 'frost', pull: 0.5, p: { x: 0, y: 0 }, storm: true, dying: 1 }]) {
      Game.dive = d; r.push(JSON.stringify(Music.state())); Game.lit = true; r.push(JSON.stringify(Music.state())); Game.lit = false;
    }
    Game.dive = null; Save.data = { settings: {}, echoes: [], magnitude: 1 };
    return { ok: r };
  });
  window.__cases = cases;
  window.__run = async (i) => {
    const [name, fn] = cases[i];
    TR.log = []; TR.on = true;
    let res;
    try { res = await fn(); } catch (e) { res = { error: String(e && e.stack || e) }; }
    TR.on = false;
    const out = { name, trace: TR.log, ok: res.ok, error: res.error, seed: window.__seed(), data: [] };
    for (const b of res.bufs || (res.buf ? [res.buf] : [])) out.data.push(chans(b));
    return out;
  };
}

// ---- in the page: both frames, each case on both, compared -----------------
async function compareAll(page, src) {
  return page.evaluate(async (S) => {
    const frame = () => new Promise((ok) => { const f = document.createElement('iframe'); f.srcdoc = '<!doctype html><html><body></body></html>'; f.onload = () => ok(f.contentWindow); document.body.appendChild(f); });
    const inject = (w, code) => { const s = w.document.createElement('script'); s.textContent = code; w.document.body.appendChild(s); };
    const before = await frame(), after = await frame();
    for (const [w, files, seed] of [[before, S.before, 'function __seed() { return _sndSeed >>> 0; }'], [after, S.after, S.self ? 'function __seed() { return _sndSeed >>> 0; }' : 'function __seed() { return SND_RAND.s; }']]) {
      inject(w, '(' + S.tracer + ')();');
      inject(w, S.prelude);
      for (const f of files) inject(w, f);
      inject(w, seed);
      inject(w, '(' + S.scenario + ')();');
    }
    const out = { n: before.__cases.length, failures: [], exact: 0, maxDiff: 0, events: 0, samples: 0 };
    if (after.__cases.length !== out.n) out.failures.push('the sides have different cases');
    for (let i = 0; i < out.n; i++) {
      const a = await before.__run(i), b = await after.__run(i);
      const fail = (why) => out.failures.push(a.name + ': ' + why);
      if (a.error || b.error) { fail('threw: ' + (a.error || '') + ' | ' + (b.error || '')); continue; }
      out.events += a.trace.length;
      const ta = a.trace.map((e) => JSON.stringify(e)), tb = b.trace.map((e) => JSON.stringify(e));
      let k = 0; while (k < ta.length && k < tb.length && ta[k] === tb[k]) k++;
      if (k < ta.length || k < tb.length) fail(`the calls differ at ${k} of ${ta.length}/${tb.length}: before ${ta[k]} | after ${tb[k]} (just before: ${ta[k - 1]})`);
      if (JSON.stringify(a.ok) !== JSON.stringify(b.ok)) fail('the results differ: ' + JSON.stringify(a.ok).slice(0, 300) + ' | ' + JSON.stringify(b.ok).slice(0, 300));
      if (a.seed !== b.seed) fail(`the random stream ends at ${a.seed} before, ${b.seed} after`);
      if (a.data.length !== b.data.length) { fail('a different number of buffers'); continue; }
      let same = true, worst = 0;
      for (let j = 0; j < a.data.length; j++) {
        const A = a.data[j], B = b.data[j];
        if (A.length !== B.length) { fail(`buffer ${j} has ${A.length} channels before, ${B.length} after`); same = false; continue; }
        for (let c = 0; c < A.length; c++) {
          const x = A[c], y = B[c];
          if (x.length !== y.length) { fail(`buffer ${j} channel ${c} is ${x.length} long before, ${y.length} after`); same = false; continue; }
          out.samples += x.length;
          for (let q = 0; q < x.length; q++) { const d = Math.abs(x[q] - y[q]); if (d > 0) { same = false; if (d > worst) worst = d; } if (!(isFinite(x[q]) && isFinite(y[q]))) worst = Infinity; }
        }
      }
      if (same) out.exact++;
      out.maxDiff = Math.max(out.maxDiff, worst);
      if (worst > 2e-3) fail('the samples differ by ' + worst);
    }
    return out;
  }, src);
}

tk.run('audio', async () => {
  const failures = [];
  const kit = await tk.launch();
  try {
    const page = await kit.page();
    const errors = tk.errorsOf(page);
    await page.setContent('<!doctype html><html><body></body></html>');
    const files = ['audio.js', 'music.js', 'sndbank.js'];
    const src = {
      tracer: tracer.toString(), scenario: scenario.toString(), prelude: PRELUDE, self: !!process.env.SELF,
      before: files.map((f) => read(FIX, 'before', f)),
      after: process.env.SELF ? files.map((f) => read(FIX, 'before', f)) : [read(ROOT, 'dist', 'tycho.js')].concat(files.map((f) => read(FIX, 'after', f))),
    };
    const t0 = Date.now(), r = await compareAll(page, src);
    console.log(`audio: ${r.n} cases, ${r.events} Web Audio calls traced and matched, ${r.samples} samples compared (${r.exact} cases bit for bit; the rest within ${r.maxDiff.toExponential(1)}), in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    for (const f of r.failures) failures.push('audio: ' + f);
    if (r.n < 50) failures.push('audio: only ' + r.n + ' cases');
    for (const e of errors) failures.push('page error: ' + e);
  } finally { await kit.close(); }
  return failures;
});
