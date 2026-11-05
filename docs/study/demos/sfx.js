// sfx.js: a seeded sound-effect generator in the manner of sfxr and ZzFX, using sound-shared.js.
// A sound is a few layers, each one voice described by a handful of numbers (a wave, a pitch and its slide,
// an envelope, a filter, grains for texture); a category is a function from a seeded stream to those
// numbers, and Mutate nudges them. Each sound is rendered once, in a plain JS loop, into a Float32Array,
// then played as an AudioBuffer: the same samples on every device, one buffer source per play.
(() => {
  const { audio, text } = StudyShared.sound;
  const RATE = 44100, W = 192, H = 108;

  // ---- the synth ----
  // layer: { wave: square|saw|tri|sine|noise, f (Hz), slide and dslide (octaves per s, per s^2), duty (square),
  //   jump: [ratio, at s] (an arpeggio step), vib: [rate Hz, depth octaves], repeat (s: restart the pitch),
  //   at (s: starts after), a, s, punch, d (attack, sustain, punch on the sustain, decay: s),
  //   filter: { type lp|bp|hp, f, sweep (octaves per s), q }, hp (Hz, a one-pole high pass),
  //   grains: [per s, length s] (the voice heard only in short random bursts: grass, gravel, crackle),
  //   bits (quantize to 2^bits levels), g (level) }
  function render(snd) {
    const len = Math.max(...snd.layers.map(L => (L.at || 0) + (L.a || 0) + (L.s || 0) + (L.d || 0))) + 0.02;
    const n = Math.ceil(len * RATE), out = new Float32Array(n), dt = 1 / RATE;
    snd.layers.forEach((L, li) => {
      const r = Kit.rng((snd.seed >>> 0) * 31 + li * 7919 + 1);
      const i0 = Math.floor((L.at || 0) * RATE), a = L.a || 0, s = L.s || 0, d = L.d || 0.05, end = a + s + d;
      let phase = 0, f = L.f, slide = L.slide || 0, nz = 0, step = -1, rt = 0;
      let ic1 = 0, ic2 = 0, hpPrev = 0, hpOut = 0, grain = 0, a1 = 0, a2 = 0, a3 = 0;
      const F = L.filter, k = F ? 1 / (F.q || 0.707) : 0, hpA = L.hp ? Math.exp(-2 * Math.PI * L.hp / RATE) : 0;
      const levels = L.bits ? Math.pow(2, L.bits - 1) : 0;
      for (let i = 0; i < end * RATE && i0 + i < n; i++) {
        const t = i * dt;
        // pitch: slide, slide of the slide, an arpeggio jump, a repeat, vibrato
        rt += dt;
        if (L.repeat && rt >= L.repeat) { rt = 0; f = L.f; slide = L.slide || 0; }
        slide += (L.dslide || 0) * dt;
        f *= Math.pow(2, slide * dt);
        if (f < 20) f = 20; if (f > 16000) f = 16000;
        let fv = f * (L.jump && rt >= L.jump[1] ? L.jump[0] : 1);
        if (L.vib) fv *= Math.pow(2, L.vib[1] * Math.sin(2 * Math.PI * L.vib[0] * t));
        phase += fv * dt; if (phase >= 1) phase -= Math.floor(phase);
        // the wave
        let v;
        switch (L.wave) {
          case 'square': v = phase < (L.duty || 0.5) ? 1 : -1; break;
          case 'saw': v = 2 * phase - 1; break;
          case 'tri': v = 4 * Math.abs(phase - 0.5) - 1; break;
          case 'sine': v = Math.sin(2 * Math.PI * phase); break;
          default: { // noise with a pitch, as sfxr's: a new random value every sixteenth of a period
            const st = Math.floor(phase * 16);
            if (st !== step) { step = st; nz = r() * 2 - 1; }
            v = nz;
          }
        }
        // envelope: rise, a punchy sustain, a curved decay
        let e;
        if (t < a) e = t / a;
        else if (t < a + s) e = 1 + (L.punch || 0) * (1 - (t - a) / s);
        else { const x = 1 - (t - a - s) / d; e = x * x; }
        // grains: short random bursts, each a fast decay
        if (L.grains) {
          if (r() < L.grains[0] * dt) grain = 0.5 + r() * 0.5;
          v *= grain; grain *= Math.exp(-dt / L.grains[1]);
        }
        // filter: a state-variable filter (Cytomic's), stable at any cutoff, swept in octaves per second
        // (its coefficients made again every 16 samples, a third of a millisecond)
        if (F) {
          if ((i & 15) === 0) {
            const fc = Math.min(RATE * 0.45, F.f * Math.pow(2, (F.sweep || 0) * t)), gg = Math.tan(Math.PI * fc / RATE);
            a1 = 1 / (1 + gg * (gg + k)); a2 = gg * a1; a3 = gg * a2;
          }
          const v3 = v - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
          ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
          v = F.type === 'bp' ? v1 * k : F.type === 'hp' ? v - k * v1 - v2 : v2;
        }
        if (hpA) { hpOut = hpA * (hpOut + v - hpPrev); hpPrev = v; v = hpOut; }
        if (levels) v = Math.round(v * levels) / levels;
        out[i0 + i] += v * e * (L.g == null ? 1 : L.g);
      }
    });
    // bring it to a peak of 0.8 and say how loud it was
    let peak = 0, sum = 0;
    for (let i = 0; i < n; i++) { const x = Math.abs(out[i]); if (x > peak) peak = x; sum += out[i] * out[i]; }
    if (peak > 0) for (let i = 0; i < n; i++) out[i] *= 0.8 / peak;
    return { data: out, len, peak, rms: Math.sqrt(sum / n) * (peak ? 0.8 / peak : 0) };
  }

  // ---- the categories ----
  // Each is a seeded stream to layers, as sfxr's generators are: ranges, a few coin flips.
  const CAT = {
    Pickup: r => [{ wave: r.chance(0.7) ? 'square' : 'tri', duty: r.pick([0.25, 0.5]), f: r.range(600, 1300),
      jump: [r.pick([1.25, 1.335, 1.5, 2]), r.range(0.04, 0.09)], a: 0, s: r.range(0.03, 0.08), punch: r.range(0.3, 0.7), d: r.range(0.12, 0.3),
      repeat: r.chance(0.25) ? r.range(0.12, 0.2) : 0 }],
    Jump: r => [{ wave: 'square', duty: r.range(0.2, 0.5), f: r.range(160, 380), slide: r.range(1.5, 4), a: 0, s: r.range(0.04, 0.1), d: r.range(0.08, 0.2),
      filter: r.chance(0.5) ? { type: 'lp', f: r.range(2000, 6000), q: 0.8 } : null }],
    Hit: r => [
      { wave: 'noise', f: r.range(800, 3000), slide: r.range(-4, -1.5), a: 0, s: 0.01, d: r.range(0.06, 0.14), g: 0.8 },
      { wave: r.pick(['square', 'saw']), duty: 0.5, f: r.range(220, 520), slide: r.range(-7, -3), a: 0, s: 0.01, d: r.range(0.08, 0.16), hp: 150, g: 0.6 }],
    Explosion: r => [
      { wave: 'noise', f: r.range(50, 160), slide: r.range(-1.5, -0.4), a: 0, s: r.range(0.04, 0.12), punch: r.range(0.4, 0.9), d: r.range(0.5, 1.1),
        filter: { type: 'lp', f: r.range(1500, 4000), sweep: r.range(-3, -1.2), q: 0.9 } },
      { wave: 'sine', f: r.range(70, 120), slide: -2.5, a: 0, s: 0.02, d: r.range(0.25, 0.45), g: 0.9 },
      { wave: 'noise', f: 4000, a: 0, s: 0.1, d: r.range(0.4, 0.8), grains: [r.range(30, 80), 0.006], filter: { type: 'bp', f: 2500, q: 1 }, g: 0.5 }],
    // footsteps: heel then toe, a body for the surface and a texture (Cook's walking model in two layers)
    Grass: r => { const toe = r.range(0.05, 0.08); return [0, toe].flatMap((at, i) => [
      { at, wave: 'noise', f: 9000, a: 0.004, s: 0.01, d: r.range(0.07, 0.12), grains: [r.range(350, 700), 0.003],
        filter: { type: 'bp', f: r.range(2800, 5200), q: 0.8 }, g: i ? 0.55 : 1 },
      { at, wave: 'sine', f: r.range(80, 110), slide: -2, a: 0.002, s: 0, d: 0.04, g: 0.25 }]); },
    Stone: r => { const toe = r.range(0.05, 0.07); return [0, toe].flatMap((at, i) => [
      { at, wave: 'noise', f: 9000, a: 0, s: 0, d: r.range(0.018, 0.03), filter: { type: 'bp', f: r.range(1600, 2600) * (i ? 1.3 : 1), q: 1.6 }, g: i ? 0.5 : 1 },
      { at, wave: 'tri', f: r.range(140, 200), slide: -2, a: 0, s: 0, d: 0.035, g: 0.45 },
      { at, wave: 'noise', f: 9000, a: 0, s: 0.01, d: 0.05, grains: [r.range(60, 140), 0.002], filter: { type: 'hp', f: 3000 }, g: 0.3 }]); },
    Wood: r => { const toe = r.range(0.06, 0.09), ring = r.range(330, 620); return [0, toe].flatMap((at, i) => [
      { at, wave: 'noise', f: 9000, a: 0, s: 0, d: r.range(0.07, 0.11), filter: { type: 'bp', f: ring * (i ? 1.12 : 1), q: r.range(6, 11) }, g: i ? 0.6 : 1 },
      { at, wave: 'tri', f: r.range(100, 150), slide: -1, a: 0, s: 0, d: 0.07, g: 0.5 }]); },
    // a door: a creak (stick-slip: a low saw in bursts through a resonance), then the latch's thud and click
    Door: r => { const cl = r.range(0.45, 0.8); return [
      { wave: 'saw', f: r.range(60, 120), slide: r.range(-0.4, 0.6), vib: [r.range(5, 11), r.range(0.04, 0.1)], a: 0.05, s: cl - 0.15, d: 0.1,
        grains: [r.range(25, 60), 0.02], filter: { type: 'bp', f: r.range(700, 1400), q: r.range(2, 4) }, g: 0.9 },
      { at: cl, wave: 'noise', f: 9000, a: 0, s: 0, d: 0.07, filter: { type: 'bp', f: r.range(220, 380), q: 2 }, g: 0.9 },
      { at: cl, wave: 'sine', f: r.range(60, 80), slide: -1.5, a: 0, s: 0.01, d: 0.14, g: 0.8 },
      { at: cl + r.range(0.03, 0.06), wave: 'noise', f: 9000, a: 0, s: 0, d: 0.012, filter: { type: 'hp', f: 3500 }, g: 0.5 }]; },
  };

  // Mutate: every number moves a little, as sfxr's does (half of them, each by a small random amount).
  function mutate(snd, r) {
    const nudge = (o, key) => {
      const v = o[key];
      if (typeof v !== 'number' || !v || !r.chance(0.5)) return;
      o[key] = key === 'duty' ? Math.min(0.9, Math.max(0.05, v + r.range(-0.08, 0.08)))
        : key === 'slide' || key === 'dslide' || key === 'sweep' ? v + r.range(-0.6, 0.6)
        : v * Math.exp(r.range(-0.18, 0.18));
    };
    const next = JSON.parse(JSON.stringify(snd));
    next.seed = (snd.seed * 1664525 + 1013904223) >>> 0;
    for (const L of next.layers) {
      for (const key of Object.keys(L)) nudge(L, key);
      if (L.filter) for (const key of Object.keys(L.filter)) nudge(L.filter, key);
      if (L.jump) L.jump[0] = r.chance(0.3) ? r.pick([1.25, 1.335, 1.5, 2]) : L.jump[0];
    }
    next.mutations = (snd.mutations || 0) + 1;
    return next;
  }

  // ---- drawing ----
  const INK = { bg: 0, box: 1, grid: 2, dim: 3, text: 6, wave: 23, peak: 25, pitch: 12, head: 7, cat: 13 };
  const WAVE_NAME = { square: 'SQR', saw: 'SAW', tri: 'TRI', sine: 'SIN', noise: 'NOI' };
  const fmt = (v, p = 2) => (Math.round(v * Math.pow(10, p)) / Math.pow(10, p)).toString().replace(/^0\./, '.').replace(/^-0\./, '-.');

  Kit.register('sfx', { title: 'Seeded sound effects', fit: 'prebake' }, host => {
    const c = Kit.canvas(host, W, H), pix = new Kit.Pix(W, H);
    let cat = 'Pickup', seed = 7, snd = null, res = null, playAt = -1, ms = 0;
    const make = () => {
      const r = Kit.rng(cat + ':' + seed);
      snd = { cat, seed, layers: CAT[cat](r).filter(Boolean) };
    };
    let build = () => { const t0 = performance.now(); res = render(snd); ms = performance.now() - t0; };
    const play = () => {
      const A = audio(); if (!A) return;
      const buf = A.ctx.createBuffer(1, res.data.length, RATE);
      buf.copyToChannel(res.data, 0);
      const src = A.ctx.createBufferSource(); src.buffer = buf; src.connect(A.out); src.start();
      playAt = performance.now();
    };
    const draw = () => {
      pix.fill(INK.bg);
      // header: category, seed, length
      text(pix, snd.cat + (snd.mutations ? ' +' + snd.mutations : ''), 2, 2, INK.cat);
      text(pix, 'SEED ' + seed + '  ' + fmt(res.len) + 'S', W - 2 - 4 * ('SEED ' + seed + '  ' + fmt(res.len) + 'S').length, 2, INK.dim + 2);
      // the waveform: min and max of each column, with a dark box behind
      const top = 9, h = 40, mid = top + h / 2, n = res.data.length, cols = W - 4;
      pix.rect(1, top - 1, W - 2, h + 2, INK.box);
      for (let x = 0; x < cols; x += 8) for (let y = top; y < top + h; y += 2) pix.set(2 + x, y, INK.grid);
      for (let x = 0; x < cols; x++) {
        let lo = 0, hi = 0;
        const i0 = Math.floor(x * n / cols), i1 = Math.floor((x + 1) * n / cols);
        for (let i = i0; i < i1; i++) { const v = res.data[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
        const y0 = Math.round(mid - hi * h / 2), y1 = Math.round(mid - lo * h / 2);
        for (let y = y0; y <= y1; y++) pix.set(2 + x, y, y === y0 || y === y1 ? INK.peak : INK.wave);
      }
      // the first layer's pitch over time, on a log scale (50 Hz at the bottom, 3.2 kHz at the top)
      const L = snd.layers[0];
      if (L.wave !== 'noise' || L.slide) {
        let f = L.f, sl = L.slide || 0, rt = 0; const at = L.at || 0, end = at + (L.a || 0) + (L.s || 0) + (L.d || 0);
        for (let x = 0; x < cols; x++) {
          const t = x * res.len / cols, dtc = res.len / cols;
          if (t < at || t > end) continue;
          rt += dtc; if (L.repeat && rt >= L.repeat) { rt = 0; f = L.f; sl = L.slide || 0; }
          sl += (L.dslide || 0) * dtc; f = Math.max(20, f * Math.pow(2, sl * dtc));
          const fv = f * (L.jump && rt >= L.jump[1] ? L.jump[0] : 1);
          const y = Math.round(top + h - 2 - (Math.log2(fv / 50) / 6) * (h - 4));
          if (y > top && y < top + h) pix.set(2 + x, y, INK.pitch);
        }
      }
      // the playhead
      if (playAt >= 0) {
        const p = (performance.now() - playAt) / 1000 / res.len;
        if (p <= 1) { const x = 2 + Math.round(p * (cols - 1)); for (let y = top; y < top + h; y++) pix.set(x, y, INK.head); }
        else playAt = -1;
      }
      // a close look: 8 ms of the wave itself, where the sound is loudest
      const zt = top + h + 3, zh = 22, zm = zt + zh / 2, span = Math.round(0.008 * RATE);
      let at = 0, best = 0;
      for (let i = 0; i < n; i += 32) { const v = Math.abs(res.data[i]); if (v > best) { best = v; at = i; } }
      at = Math.max(0, Math.min(n - span, at - (span >> 1)));
      pix.rect(1, zt - 1, W - 2, zh + 2, INK.box);
      pix.rect(1, zm, W - 2, 1, INK.grid);
      let py = zm;
      for (let x = 0; x < cols; x++) {
        const v = res.data[at + Math.floor(x * span / cols)] || 0, yy = Math.round(zm - v * (zh / 2 - 1));
        for (let y = Math.min(py, yy); y <= Math.max(py, yy); y++) pix.set(2 + x, y, INK.peak);
        py = yy;
      }
      text(pix, '8MS', W - 15, zt + 1, INK.dim + 1);
      // the parameter list: a line per layer
      let y = zt + zh + 3;
      snd.layers.slice(0, 4).forEach((L, i) => {
        const parts = [WAVE_NAME[L.wave] + (L.wave === 'square' ? fmt(L.duty || 0.5) : ''), Math.round(L.f) + 'HZ'];
        if (L.slide) parts.push('SL' + (L.slide > 0 ? '+' : '') + fmt(L.slide, 1));
        if (L.jump) parts.push('J' + fmt(L.jump[0]));
        if (L.at) parts.push('@' + fmt(L.at));
        parts.push('A' + fmt(L.a || 0) + ' S' + fmt(L.s || 0) + ' D' + fmt(L.d || 0));
        if (L.filter) parts.push(L.filter.type.toUpperCase() + Math.round(L.filter.f));
        if (L.grains) parts.push('GR' + Math.round(L.grains[0]));
        const x = text(pix, (i + 1) + ' ', 2, y, INK.dim);
        text(pix, parts.join(' ').slice(0, 45), x, y, i === 0 ? INK.text : INK.text - 1);
        y += 6;
      });
      c.put(pix);
    };

    const ui = Kit.bar(host);
    ui.tabs(Object.keys(CAT), v => { cat = v; make(); build(); play(); }, cat);
    const ui2 = Kit.bar(host);
    ui2.button('Play', () => play());
    ui2.button('Mutate', () => { snd = mutate(snd, Kit.rng(snd.seed + 99)); build(); play(); });
    ui2.seed(seed, s => { seed = s; make(); build(); play(); });
    const note = ui2.note('');
    const say = () => { note.textContent = res.data.length.toLocaleString('en-US') + ' samples, rendered in ' + ms.toFixed(1) + ' ms, rms ' + res.rms.toFixed(3); };
    const build0 = build; build = () => { build0(); say(); };
    make(); build();
    Kit.loop(host, () => {}, draw, 30);
  });
})();
