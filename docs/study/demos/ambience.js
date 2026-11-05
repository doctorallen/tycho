// ambience.js: a place's sound from noise and filters, following the weather, using sound-shared.js.
// Wind is two bands of noise whose centers and levels follow a gust signal; the stream is a bed of low noise
// and single bubbles (a sine rising as it rings, at the Minnaert pitch of its size: van den Doel's model);
// birds are short sine chirps; rain is high noise and more bubbles; thunder a low rumble after its flash.
// One seeded event stream drives both the picture and the sound, so what you see is what you hear.
(() => {
  const { audio, noise, text } = StudyShared.sound;
  const W = 192, H = 108;

  Kit.register('ambience', { title: 'Wind, water and birds', fit: 'per-frame' }, host => {
    const c = Kit.canvas(host, W, H), pix = new Kit.Pix(W, H);
    const r = Kit.rng('ambience');
    let weather = 0.2, t = 0, wind = 0, flash = 0, playing = false, A = null, nodes = null;
    const birds = [], sparks = [], drops = [];
    // the land, painted once: hills, meadow, stream, near bank (the moving parts are drawn over it)
    const land = new Kit.Pix(W, H);
    for (let x = 0; x < W; x++) {
      const hill = Math.round(50 + 6 * Kit.noise2(x / 40, 0, 3) + 3 * Kit.noise2(x / 13, 1, 3));
      for (let y = hill; y < H; y++) land.set(x, y, y === hill ? 0 : y < 64 ? 15 : 16);
      const bank = Math.round(84 + 1.5 * Math.sin(x / 17)), near = Math.round(97 + 1.2 * Math.sin(x / 11 + 2));
      for (let y = bank; y < near; y++) land.set(x, y, y === bank ? 0 : y < bank + 3 ? 22 : 21);
      for (let y = near; y < H; y++) land.set(x, y, y === near ? 0 : 15);
    }
    const tufts = []; for (let i = 0; i < 26; i++) tufts.push([Math.floor(Kit.hash2(i, 0, 5) * W), 66 + Math.floor(Kit.hash2(i, 1, 5) * 16)]);
    const tree = { x: 150, y: 74 };

    // ---- sound ----
    const loopNoise = (ctx, type, f, q) => {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noise(ctx); s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0;
      s.connect(fl); fl.connect(g); g.connect(A.out); s.start(0, r() * 1.5);
      return { s, f: fl, g };
    };
    const start = () => {
      A = audio(); if (!A) return;
      const ctx = A.ctx;
      nodes = { lo: loopNoise(ctx, 'bandpass', 400, 1.2), hi: loopNoise(ctx, 'bandpass', 1200, 8), bed: loopNoise(ctx, 'lowpass', 500, 0.7), rain: loopNoise(ctx, 'highpass', 3000, 0.5) };
      playing = true; btn.textContent = 'Stop';
    };
    const stop = () => {
      playing = false; btn.textContent = 'Play';
      if (nodes) for (const k in nodes) { nodes[k].s.stop(); nodes[k].g.disconnect(); }
      nodes = null;
    };
    const set = (param, v) => param.setTargetAtTime(v, A.ctx.currentTime, 0.12);
    const bubble = (when, f, g) => { // a damped sine rising in pitch as it rings
      const ctx = A.ctx, o = ctx.createOscillator(), e = ctx.createGain(), d = Math.max(0.004, 12 / f);
      o.frequency.setValueAtTime(f, when); o.frequency.exponentialRampToValueAtTime(f * 1.5, when + d * 3);
      e.gain.setValueAtTime(g, when); e.gain.exponentialRampToValueAtTime(0.0005, when + d * 3);
      o.connect(e); e.connect(A.out); o.start(when); o.stop(when + d * 3 + 0.01);
    };
    const chirp = (when, f1, f2, len, g) => {
      const ctx = A.ctx, o = ctx.createOscillator(), e = ctx.createGain();
      o.frequency.setValueAtTime(f1, when); o.frequency.exponentialRampToValueAtTime(f2, when + len);
      e.gain.setValueAtTime(0, when); e.gain.linearRampToValueAtTime(g, when + len * 0.2); e.gain.linearRampToValueAtTime(0, when + len);
      o.connect(e); e.connect(A.out); o.start(when); o.stop(when + len + 0.01);
    };
    const thunder = when => {
      const ctx = A.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), e = ctx.createGain();
      s.buffer = noise(ctx); s.loop = true; f.type = 'lowpass'; f.frequency.value = 140;
      e.gain.setValueAtTime(0, when); e.gain.linearRampToValueAtTime(0.9, when + 0.15); e.gain.setTargetAtTime(0, when + 0.3, 0.7);
      s.connect(f); f.connect(e); e.connect(A.out); s.start(when); s.stop(when + 4);
    };

    // ---- the event stream: one step, 30 a second, for picture and sound alike ----
    const step = dt => {
      t += dt;
      const base = 0.08 + 0.62 * weather, amp = 0.1 + 0.3 * weather;
      wind = Math.max(0, Math.min(1, base + amp * Kit.noise2(t * 0.35, 0.5, 11)));
      const now = playing ? A.ctx.currentTime + 0.05 : 0;
      // bubbles in the stream: Poisson, more in rain; radius 0.8 to 4 mm, so 800 Hz to 4 kHz
      const rain = Math.max(0, weather - 0.45) / 0.55;
      const nb = (14 + 50 * rain) * dt;
      for (let k = 0; k < 4; k++) if (r() < nb / 4) {
        const rad = 0.8 + r() * r() * 3.2, f = 3260 / rad, x = Math.floor(r() * W);
        sparks.push({ x, y: 86 + Math.floor(r() * 10), life: 5 });
        if (playing) bubble(now + r() * dt, f, 0.05 + 0.06 * r());
      }
      // birds: fewer as the weather turns; each a phrase of 2 to 5 chirps
      if (r() < Math.pow(1 - weather, 2) * 0.6 * dt) {
        const f1 = 2500 + r() * 2200, down = r() < 0.6, n = 2 + Math.floor(r() * 4), len = 0.04 + r() * 0.05;
        birds.push({ x: Math.floor(r() * (W - 40)) + 10, y: 8 + Math.floor(r() * 30), dir: r() < 0.5 ? -1 : 1, life: 70, sing: n * 4 });
        if (playing) for (let i = 0; i < n; i++) chirp(now + i * (len + 0.04), f1 * (1 + 0.05 * i), f1 * (down ? 0.62 : 1.45), len, 0.07);
      }
      // thunder at the worst: a flash, then its sound after the light, as from a few hundred meters
      if (weather > 0.85 && r() < 0.1 * dt) { flash = 4; if (playing) thunder(now + 0.4 + r() * 1.2); }
      if (flash > 0) flash--;
      // rain streaks for the picture
      const nr = Math.floor(rain * 90);
      while (drops.length < nr) drops.push({ x: r() * W, y: r() * H });
      drops.length = Math.min(drops.length, nr);
      for (const d of drops) { d.y += 6; d.x += wind * 3; if (d.y > H) { d.y -= H; d.x = r() * W; } if (d.x > W) d.x -= W; }
      for (const b of birds) { b.x += b.dir * 0.8; b.life--; b.sing--; }
      for (const s of sparks) s.life--;
      while (birds.length && birds[0].life <= 0) birds.shift();
      while (sparks.length && sparks[0].life <= 0) sparks.shift();
      // the continuous bands follow
      if (playing && nodes) {
        set(nodes.lo.f.frequency, 250 + 700 * wind); set(nodes.lo.g.gain, 0.02 + 0.4 * wind * wind);
        set(nodes.hi.f.frequency, 800 + 1800 * wind); set(nodes.hi.g.gain, Math.max(0, wind - 0.5) * 0.25);
        set(nodes.bed.g.gain, 0.05 + 0.08 * rain); set(nodes.rain.g.gain, rain * 0.18);
      }
    };

    const draw = () => {
      const storm = weather;
      // sky: blue in calm, grey in storm, in flat bands
      const sky = flash ? [7, 6, 6] : storm < 0.35 ? [24, 23, 23] : storm < 0.7 ? [5, 4, 4] : [3, 2, 2];
      for (let y = 0; y < 60; y++) for (let x = 0; x < W; x++) pix.d[y * W + x] = sky[y < 14 ? 0 : y < 34 ? 1 : 2];
      for (let i = 0; i < land.d.length; i++) if (land.d[i] >= 0) pix.d[i] = land.d[i];
      // grass tufts lean with the wind
      for (const [x, y] of tufts) {
        const lean = Math.round(wind * 3 * (0.7 + 0.3 * Math.sin(t * 6 + x)));
        for (let k = 0; k < 4; k++) { pix.set(x + Math.round(lean * k / 3), y - k, k ? 18 : 17); pix.set(x + 2 + Math.round(lean * k / 4), y - k + 1, 17); }
      }
      // the tree: its crown sways
      const sway = Math.round(wind * 3 * Math.sin(t * 3));
      pix.rect(tree.x - 1, tree.y - 12, 3, 13, 26); pix.set(tree.x - 1, tree.y - 12, 0);
      for (let j = -9; j <= 9; j++) for (let i = -12; i <= 12; i++) {
        const d = (i * i) / 144 + (j * j) / 81;
        if (d <= 1) pix.set(tree.x + i + Math.round(sway * (1 - (j + 9) / 18)), tree.y - 22 + j, d > 0.8 ? 0 : (i + j < -6 ? 17 : 16));
      }
      // sparkles on the stream where bubbles burst
      for (const s of sparks) { pix.set(s.x, s.y, s.life > 2 ? 7 : 25); if (s.life > 3) pix.set(s.x + 1, s.y, 24); }
      // birds: two-pixel wings, flapping; a note above one that sings
      for (const b of birds) {
        const up = (b.life >> 2) % 2, x = Math.round(b.x);
        pix.set(x, b.y, 0); pix.set(x - 1, b.y - up, 0); pix.set(x + 1, b.y - up, 0); pix.set(x - 2, b.y - up * 2 + 1, 0); pix.set(x + 2, b.y - up * 2 + 1, 0);
        if (b.sing > 0) pix.set(x + 3 * b.dir, b.y - 4, 13);
      }
      for (const d of drops) { const x = Math.round(d.x), y = Math.round(d.y); pix.set(x, y, 6); pix.set(x - 1, y - 1, 5); pix.set(x - 2, y - 2, 4); }
      // the levels, as the mixer would show them
      const bars = [['WIND', wind, 11], ['RAIN', Math.max(0, weather - 0.45) / 0.55, 24], ['BIRDS', Math.pow(1 - weather, 2), 13]];
      const label = sky[0] === 24 || sky[0] === 7 ? 1 : 7;
      bars.forEach(([nm, v, ink], i) => {
        text(pix, nm, 3, 3 + i * 6, label);
        pix.rect(26, 3 + i * 6, 32, 5, 0); pix.rect(27, 4 + i * 6, Math.round(v * 30), 3, ink);
      });
      c.put(pix);
    };

    const ui = Kit.bar(host);
    const btn = ui.button('Play', () => (playing ? stop() : start()));
    ui.slider('Weather', 0, 1, 0.05, weather, v => { weather = v; });
    ui.note('calm, then rain, then storm');
    for (let i = 0; i < 60; i++) step(1 / 30);
    Kit.loop(host, step, draw, 30);
    if (window.IntersectionObserver) new IntersectionObserver(es => { if (!es[es.length - 1].isIntersecting && playing) stop(); }).observe(host);
  });
})();
