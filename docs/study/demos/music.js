// music.js: a generative tune for a world from a seed, using sound-shared.js. The seed picks a sound
// palette (a family of modes, a root, a tempo, four voices with one wave each, a drum kit made of noise
// and a triangle kick); the tune is stored as scale degrees, so dusk and night play the same tune in a
// darker mode; the danger slider brings layers in at bar lines (vertical layering). Notes are scheduled a
// little ahead on the audio clock as live oscillator nodes, and drawn as a scrolling piano roll.
(() => {
  const { audio, setWave, noise, midiHz, text } = StudyShared.sound;
  const W = 192, H = 108;

  // ---- the palette ----
  const S = {
    lydian: [0, 2, 4, 6, 7, 9, 11], ionian: [0, 2, 4, 5, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
    'harm. major': [0, 2, 4, 5, 7, 8, 11], 'harm. minor': [0, 2, 3, 5, 7, 8, 11],
    'major pent.': [0, 2, 4, 7, 9], yo: [0, 2, 5, 7, 9], 'minor pent.': [0, 3, 5, 7, 10], in: [0, 1, 5, 7, 8],
  };
  // each family: its day, dusk and night modes, the same length so one tune of degrees fits all three
  const FAMILIES = [
    ['ionian', 'mixolydian', 'dorian'], ['lydian', 'ionian', 'aeolian'], ['dorian', 'aeolian', 'phrygian'],
    ['mixolydian', 'dorian', 'aeolian'], ['ionian', 'harm. major', 'harm. minor'],
    ['major pent.', 'yo', 'minor pent.'], ['yo', 'minor pent.', 'in'],
  ];
  const TOD = ['Day', 'Dusk', 'Night'];
  const BASS = ['triangle', 'pulse50'], PAD = ['pulse25', 'sawtooth', 'triangle', 'pulse50'], LEAD = ['pulse12', 'pulse25', 'triangle', 'sine'], ARP = ['pulse12', 'pulse25', 'sine'];
  const WNAME = { triangle: 'triangle', sine: 'sine', sawtooth: 'saw', pulse12: 'pulse 12.5%', pulse25: 'pulse 25%', pulse50: 'pulse 50%' };
  const KICKS = [[0, 8], [0, 6, 8], [0, 10], [0, 3, 8, 11], [0, 8, 14]], SNARES = [[4, 12], [12], [4, 12, 15]], HATS = [[0, 4, 8, 12], [2, 6, 10, 14], [0, 2, 4, 6, 8, 10, 12, 14]];
  const RHYTHMS = [[0, 4, 8, 12], [0, 6, 8, 12, 14], [0, 3, 6, 8, 12], [0, 8, 10, 12], [0, 2, 4, 8, 12], [0, 4, 6, 8], [0, 12], [0, 3, 8, 10, 12, 14]];
  // the layers and the danger each comes in at; the time of day takes some away
  const LAYERS = { pad: -1, bass: 0.1, lead: 0.25, hat: 0.45, kick: 0.55, arp: 0.7, snare: 0.85 };
  const NIGHT_DROPS = { 1: ['hat'], 2: ['hat', 'snare', 'kick'] };

  function palette(seed) {
    const r = Kit.rng('world:' + seed);
    const fam = r.pick(FAMILIES), len = S[fam[0]].length;
    const p = {
      seed, fam, len, root: r.int(41, 50), bpm: r.int(14, 26) * 5, swing: r.chance(0.35) ? 0.12 : 0,
      w: { bass: r.pick(BASS), pad: r.pick(PAD), lead: r.pick(LEAD), arp: r.pick(ARP) },
      kick: r.pick(KICKS), snare: r.pick(SNARES), hat: r.pick(HATS), echo: r.range(0.15, 0.4),
    };
    // chords: four bars of roots by a Markov step (moves of a third, fourth or fifth likeliest), then the same
    // four again ending home; each chord is three scale tones stacked a degree apart
    const moves = len === 7 ? [[2, 3], [3, 3], [4, 3], [5, 2], [1, 1], [6, 1]] : [[1, 2], [2, 3], [3, 3], [4, 2]];
    const step = () => { let t = r() * moves.reduce((s, m) => s + m[1], 0); for (const m of moves) if ((t -= m[1]) < 0) return m[0]; return moves[0][0]; };
    const prog = [0]; for (let i = 1; i < 4; i++) prog.push((prog[i - 1] + step()) % len);
    p.chords = [...prog, prog[0], prog[1], prog[2], r.chance(0.5) ? len - 3 : 0];
    // melody: two 2-bar motifs as scale degrees; the song is A A' B A''. Steps by an order-1 Markov over
    // intervals (small steps likeliest, a leap followed by a step back), chord tones on the strong beats.
    const IV = [[-1, 4], [1, 4], [-2, 2], [2, 2], [0, 1], [3, 0.7], [-3, 0.7], [4, 0.3], [-4, 0.3]];
    const iv = () => { let t = r() * 15; for (const m of IV) if ((t -= m[1]) < 0) return m[0]; return 1; };
    const motif = bars => {
      const notes = []; let d = len + r.int(0, 2), last = 0;
      for (let b = 0; b < 2; b++) {
        const ch = p.chords[bars[b]], rh = r.pick(RHYTHMS);
        rh.forEach((s, i) => {
          let k = iv(); if (Math.abs(last) >= 3) k = -Math.sign(last) * r.int(1, 2);
          d = Math.max(len - 2, Math.min(len * 2 + 2, d + k)); last = k;
          if (s % 8 === 0) { const tones = [0, 2, 4].map(x => ch + x); let best = d, bd = 99; for (const t0 of tones) for (const o of [0, len, 2 * len]) if (Math.abs(t0 + o - d) < bd) { bd = Math.abs(t0 + o - d); best = t0 + o; } d = best; }
          const next = i + 1 < rh.length ? rh[i + 1] : 16;
          notes.push({ bar: b, s, len: Math.max(1, next - s - (r.chance(0.3) ? 1 : 0)), d });
        });
      }
      return notes;
    };
    const A = motif([0, 1]), B = motif([2, 3]);
    const vary = m => m.map(n => (n.bar === 1 && r.chance(0.5) ? { ...n, d: n.d + r.pick([-1, 1, 2]) } : n));
    const home = m => { const c = m.map(n => ({ ...n })); const l = c[c.length - 1]; l.d = len; l.len = 16 - l.s; return c; };
    p.song = [A, vary(A), B, home(A)];
    p.arpDir = r.chance(0.5) ? 1 : -1;
    return p;
  }

  // degree to MIDI in a mode, from a base note
  const deg = (scale, d, base) => { const n = scale.length, o = Math.floor(d / n); return base + 12 * o + scale[((d % n) + n) % n]; };

  // the events of one bar, for a palette, a time of day and a danger: [{ v, s, len, m }] (m: MIDI or a drum name)
  function bar(p, b, tod, danger) {
    const sc = S[p.fam[tod]], len = p.len, ch = p.chords[b % 8], out = [];
    const on = v => danger >= LAYERS[v] && !(NIGHT_DROPS[tod] || []).includes(v) || (v === 'kick' && tod === 2 && danger > 0.9);
    const loop = Math.floor(b / 8), h = (s, k) => Kit.hash2(b, s, p.seed * 13 + k);
    // pad: the chord, held for the bar (two halves when danger is up)
    if (on('pad')) for (const x of [0, 2, 4]) {
      const m = deg(sc, ch + x, p.root + 12);
      if (danger > 0.6) { out.push({ v: 'pad', s: 0, len: 8, m }, { v: 'pad', s: 8, len: 8, m }); } else out.push({ v: 'pad', s: 0, len: 16, m });
    }
    // bass: the root, longer when calm, eighths with octave leaps when danger is high
    if (on('bass')) {
      const root = deg(sc, ch, p.root);
      if (danger > 0.75) for (let s = 0; s < 16; s += 2) out.push({ v: 'bass', s, len: 2, m: root + (s % 4 === 2 ? 12 : 0) });
      else if (danger > 0.4) [0, 6, 8, 12].forEach((s, i, a) => out.push({ v: 'bass', s, len: (a[i + 1] || 16) - s, m: root + (s === 6 ? 7 : 0) }));
      else out.push({ v: 'bass', s: 0, len: 8, m: root }, { v: 'bass', s: 8, len: 8, m: deg(sc, ch + 4, p.root) });
    }
    // lead: the song's motif for this bar; at night only every other note, an octave down
    if (on('lead')) {
      const sec = Math.floor((b % 8) / 2), half = b % 2;
      p.song[sec].filter(n => n.bar === half).forEach((n, i) => {
        if (tod === 2 && i % 2) return;
        // the second time round, the B section opens a step higher
        const lift = loop % 2 && sec === 2 && i === 0 ? 1 : 0;
        out.push({ v: 'lead', s: n.s, len: tod === 2 ? Math.min(16 - n.s, n.len * 2) : n.len, m: deg(sc, n.d + lift, p.root + 12 - (tod === 2 ? 12 : 0)) });
      });
    }
    // arpeggio: the chord in sixteenths, the chip way to sound a chord on one voice (eighths at night)
    if (on('arp')) {
      const st = tod === 2 ? 2 : 1;
      for (let s = 0, i = 0; s < 16; s += st, i++) { const k = [0, 2, 4, 7][(p.arpDir > 0 ? i : 3 - (i % 4) + 4) % 4]; out.push({ v: 'arp', s, len: st, m: deg(sc, ch + k, p.root + 24) }); }
    }
    for (const v of ['kick', 'snare', 'hat']) if (on(v)) for (const s of p[v]) out.push({ v, s, len: 1, m: v });
    // a fill on the last bar of every four when the drums are in
    if (on('snare') && b % 4 === 3) for (const s of [13, 14, 15]) if (h(s, 1) < 0.7) out.push({ v: 'snare', s, len: 1, m: 'snare' });
    return out;
  }

  // ---- playing ----
  const GAIN = { pad: 0.05, bass: 0.16, lead: 0.1, arp: 0.045, kick: 0.5, snare: 0.22, hat: 0.07 };
  function voice(A, p, e, t, dur, echo) {
    const { ctx, out } = A, g = ctx.createGain(), lv = GAIN[e.v];
    g.connect(e.v === 'lead' || e.v === 'arp' ? echo : out);
    if (e.v === 'kick') { // a triangle falling fast, as the NES's triangle kick
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
      g.gain.setValueAtTime(lv, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(g); o.start(t); o.stop(t + 0.18); return;
    }
    if (e.v === 'snare' || e.v === 'hat') {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter();
      src.buffer = noise(ctx);
      f.type = e.v === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = e.v === 'hat' ? 7000 : 1900; f.Q.value = e.v === 'hat' ? 0.7 : 0.9;
      const d = e.v === 'hat' ? 0.035 : 0.12;
      g.gain.setValueAtTime(lv, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      src.connect(f); f.connect(g); src.start(t, Kit.hash2(t * 1000 | 0, 3, 1) * 1.5); src.stop(t + d + 0.02); return;
    }
    const o = ctx.createOscillator(); setWave(ctx, o, p.w[e.v]);
    o.frequency.value = midiHz(e.m);
    const a = e.v === 'pad' ? Math.min(0.15, dur * 0.3) : 0.005, rel = e.v === 'pad' ? 0.2 : 0.05;
    const end = t + Math.max(a + 0.02, dur * (e.v === 'arp' ? 0.6 : 0.9));
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lv, t + a);
    g.gain.setValueAtTime(lv * (e.v === 'pad' ? 1 : 0.7), Math.max(t + a, end - rel)); g.gain.linearRampToValueAtTime(0, end);
    o.connect(g); o.start(t); o.stop(end + 0.02);
  }

  // ---- drawing ----
  const COL = { pad: [22, 21], bass: [28, 27], lead: [13, 12], arp: [18, 16], kick: 7, snare: 11, hat: 5 };
  const BG = [[1, 2], [30, 2], [0, 1]]; // background and scale rows by time of day

  Kit.register('music', { title: 'A tune for a world', fit: 'per-frame' }, host => {
    const c = Kit.canvas(host, W, H), pix = new Kit.Pix(W, H);
    let seed = 41, p = palette(seed), tod = 0, danger = 0.5;
    let playing = false, A = null, echo = null, tail = null, t0 = 0, nextBar = 0, bars = new Map();
    const spb = () => 60 / p.bpm / 4; // seconds per sixteenth
    const barAt = b => { if (!bars.has(b)) bars.set(b, bar(p, b, tod, danger)); return bars.get(b); };
    // when the state changes, bars not yet scheduled are made again
    const restate = () => { for (const k of [...bars.keys()]) if (k >= nextBar) bars.delete(k); say(); };
    const start = () => {
      A = audio(); if (!A) return;
      const ctx = A.ctx;
      echo = ctx.createGain(); echo.connect(A.out);
      const dl = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
      dl.delayTime.value = spb() * 3; fb.gain.value = p.echo; lp.type = 'lowpass'; lp.frequency.value = 2500;
      echo.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(A.out); tail = lp;
      t0 = ctx.currentTime + 0.1; nextBar = 0; bars.clear(); playing = true; playBtn.textContent = 'Stop';
    };
    const stop = () => { playing = false; playBtn.textContent = 'Play'; if (echo) { echo.disconnect(); tail.disconnect(); echo = tail = null; } };
    // the scheduler: every tick, the bars that start within the next 0.15 s
    const schedule = () => {
      if (!playing || !A) return;
      const now = A.ctx.currentTime;
      if (t0 + nextBar * 16 * spb() < now) { t0 = now + 0.05 - nextBar * 16 * spb(); } // woken after a pause: catch up
      while (t0 + nextBar * 16 * spb() < now + 0.15) {
        const bt = t0 + nextBar * 16 * spb();
        for (const e of barAt(nextBar)) {
          const sw = e.s % 2 ? p.swing * spb() : 0;
          voice(A, p, e, bt + e.s * spb() + sw, e.len * spb(), echo);
        }
        nextBar++;
      }
    };
    const draw = () => {
      const [bg, row] = BG[tod], sc = S[p.fam[tod]];
      pix.fill(bg);
      const lo = p.root - 2, y = m => 101 - (m - lo) * 2;
      // the rows of the current mode, a shade lighter; the roots lighter still
      for (let m = lo + 1; m < lo + 46; m++) {
        const pc = ((m - p.root) % 12 + 12) % 12;
        if (sc.includes(pc)) pix.rect(0, y(m), W, 2, pc === 0 ? 3 : row);
      }
      // time runs right to left past the playhead; a bar is 64 px (4 px a sixteenth)
      const PX = 4, head = 44, now = playing && A ? Math.max(0, (A.ctx.currentTime - t0) / spb()) : 0;
      const first = Math.max(0, Math.floor((now - head / PX) / 16)), last = Math.floor((now + (W - head) / PX) / 16);
      for (const k of bars.keys()) if (k < first - 1) bars.delete(k);
      for (let b = first; b <= last; b++) {
        const bx = head + (b * 16 - now) * PX;
        for (let yy = 9; yy < 108; yy += 2) pix.set(Math.round(bx), yy, 4);
        for (const e of barAt(b)) {
          const x0 = Math.round(bx + e.s * PX), x1 = Math.round(bx + (e.s + e.len) * PX) - 1;
          const lit = playing && now >= b * 16 + e.s && now < b * 16 + e.s + e.len;
          if (typeof e.m === 'string') { // drums in the bottom lane
            const yy = e.v === 'kick' ? 106 : e.v === 'snare' ? 104 : 102;
            pix.rect(x0, yy, 3, 1, lit ? 7 : COL[e.v]);
          } else {
            const yy = y(e.m); if (yy < 9 || yy > 100) continue;
            const [ink, edge] = COL[e.v];
            pix.rect(x0, yy, Math.max(1, x1 - x0 + 1), 2, lit ? 7 : ink);
            pix.set(x0, yy, edge); pix.set(x0, yy + 1, edge);
          }
        }
      }
      for (let yy = 9; yy < 108; yy++) pix.set(head, yy, 6);
      // header: the mode, the tempo, the voices in their colors
      pix.rect(0, 0, W, 8, 0);
      let x = text(pix, p.fam[tod].replace('.', ''), 2, 1, 7);
      text(pix, p.bpm + 'BPM', x + 4, 1, 5);
      x = W - 2 - 4 * 'BASS PAD LEAD ARP'.length;
      for (const [nm, v] of [['BASS ', 'bass'], ['PAD ', 'pad'], ['LEAD ', 'lead'], ['ARP', 'arp']]) x = text(pix, nm, x, 1, COL[v][0]);
      c.put(pix);
    };

    const ui = Kit.bar(host);
    const playBtn = ui.button('Play', () => (playing ? stop() : start()));
    ui.button('New world', () => { seed = (Math.imul(seed, 1103515245) + 12345 >>> 0) % 100000; p = palette(seed); bars.clear(); nextBar = 0; if (playing) { stop(); start(); } say(); });
    ui.tabs(TOD, v => { tod = TOD.indexOf(v); restate(); }, 'Day');
    const ui2 = Kit.bar(host);
    ui2.slider('Danger', 0, 1, 0.05, danger, v => { danger = v; restate(); });
    const note = ui2.note('');
    function say() {
      const inn = Object.keys(LAYERS).filter(v => danger >= LAYERS[v] && !(NIGHT_DROPS[tod] || []).includes(v));
      note.textContent = 'World ' + seed + ': ' + p.fam.join(' / ') + ', ' + p.bpm + ' bpm' + (p.swing ? ', swung' : '') +
        '. Bass ' + WNAME[p.w.bass] + ', pad ' + WNAME[p.w.pad] + ', lead ' + WNAME[p.w.lead] + ', arp ' + WNAME[p.w.arp] + '. Playing: ' + inn.join(', ') + '.';
    }
    say();
    const lp = Kit.loop(host, () => schedule(), draw, 30);
    if (lp.reduced) setInterval(() => { schedule(); draw(); }, 40);
    // off screen, it stops (the loop sleeps there, and notes already scheduled ring out)
    if (window.IntersectionObserver) new IntersectionObserver(es => { if (!es[es.length - 1].isIntersecting && playing) stop(); }).observe(host);
  });
})();
