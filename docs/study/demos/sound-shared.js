// sound-shared.js: what the sound demos share (sfx, music, ambience), loaded before any of them.
// One AudioContext for the page, made on the first tap as browsers require, through a master gain and a
// limiter; asleep while the page is hidden. Also: pulse waves at the chip duties, a seeded noise buffer,
// Tycho's presence curve, and a 3x5 pixel font for labels inside the art. Nothing here draws from
// Math.random: noise and choices come from Kit.rng, so a seed always makes the same sound.
(() => {
  // ---- the context ----
  // Made inside a tap (Chrome starts a context made earlier as 'suspended'; iOS Safari will not play it).
  // Safari also has an 'interrupted' state after the page is left; resume() covers both.
  let A = null, wanted = false, override = null;
  function audio() {
    if (override) return override;
    if (!A) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      const ctx = new C({ latencyHint: 'interactive' });
      const out = ctx.createGain(); out.gain.value = 0.7;
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -10; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.2;
      out.connect(lim); lim.connect(ctx.destination);
      A = { ctx, out };
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) quiet(ctx.suspend());
        else if (wanted) quiet(ctx.resume());
      });
    }
    wanted = true;
    if (A.ctx.state !== 'running') quiet(A.ctx.resume());
    return A;
  }
  // a test can hand in its own context (an OfflineAudioContext) to render what a demo schedules
  function useContext(ctx) {
    if (!ctx) { override = null; return; }
    const out = ctx.createGain(); out.gain.value = 0.7; out.connect(ctx.destination);
    override = { ctx, out };
  }
  function quiet(p) { if (p && p.catch) p.catch(() => {}); }

  // ---- waves ----
  // A pulse at duty d as a PeriodicWave (the NES's 12.5, 25 and 50%), from its Fourier series.
  const waveCache = new WeakMap();
  function pulse(ctx, d) {
    let m = waveCache.get(ctx); if (!m) waveCache.set(ctx, m = {});
    if (m[d]) return m[d];
    const n = 48, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      re[k] = (2 / (k * Math.PI)) * Math.sin(2 * Math.PI * k * d);
      im[k] = (2 / (k * Math.PI)) * (1 - Math.cos(2 * Math.PI * k * d));
    }
    return (m[d] = ctx.createPeriodicWave(re, im));
  }
  // set an oscillator's wave by name: sine, triangle, sawtooth, square, or pulse12 / pulse25 / pulse50
  function setWave(ctx, osc, w) {
    if (w === 'pulse12') osc.setPeriodicWave(pulse(ctx, 0.125));
    else if (w === 'pulse25') osc.setPeriodicWave(pulse(ctx, 0.25));
    else if (w === 'pulse50') osc.setPeriodicWave(pulse(ctx, 0.5));
    else osc.type = w;
  }
  const noiseCache = new WeakMap();
  function noise(ctx) {
    let b = noiseCache.get(ctx);
    if (b) return b;
    const r = Kit.rng('noise'), n = ctx.sampleRate * 2;
    b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    noiseCache.set(ctx, b);
    return b;
  }

  // Tycho.audio's presence: how much of a layer is in as s rises past `at`, smoothly over w.
  function presence(s, at, w = 0.2) { let k = (s - at + w / 2) / w; k = k < 0 ? 0 : k > 1 ? 1 : k; return k * k * (3 - 2 * k); }
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

  // ---- a 3x5 pixel font ----
  // Five rows of three bits each (4 left, 2 middle, 1 right). Upper case, digits and a little punctuation.
  const G = {
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
    G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
    M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
    S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
    Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
    0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6], 4: [5, 5, 7, 1, 1], 5: [7, 4, 6, 1, 6],
    6: [3, 4, 7, 5, 7], 7: [7, 1, 2, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 6],
    '.': [0, 0, 0, 0, 2], ':': [0, 2, 0, 2, 0], '+': [0, 2, 7, 2, 0], '-': [0, 0, 7, 0, 0], '%': [5, 1, 2, 4, 5],
    '/': [1, 1, 2, 4, 4], '#': [5, 7, 5, 7, 5], '=': [0, 7, 0, 7, 0], '>': [4, 2, 1, 2, 4], '@': [2, 5, 7, 4, 3], ',': [0, 0, 0, 2, 4], ' ': [0, 0, 0, 0, 0],
  };
  // write s into a Pix at x, y in ink c; returns the x after it
  function text(pix, s, x, y, c) {
    for (const ch of String(s).toUpperCase()) {
      const g = G[ch] || G[' '];
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j] & (4 >> i)) pix.set(x + i, y + j, c);
      x += 4;
    }
    return x;
  }

  window.StudyShared = window.StudyShared || {};
  StudyShared.sound = { audio, useContext, quiet, pulse, setWave, noise, presence, midiHz, text };
})();
