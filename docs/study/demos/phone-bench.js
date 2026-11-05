// phone-bench.js: a benchmark card to run on a phone. It times five of the study's typical workloads (a 256×256
// priority-flood, a noise fill, a falling-sand step, an indexed-to-RGBA blit scaled up, a frame of 600 drawImage
// sprites), compares each with the laptop the study was measured on, and then watches real frame times for three
// seconds while drawing sprites. "Copy results" puts the numbers on the clipboard as plain text to paste back.
(() => {
  const { worldJob, LUT, text, textW, measure, median, fmt, clockStep, device, model, copy } = StudyShared.phones;
  const PAL = Kit.PAL;

  // The reference, measured on the study's laptop (2019 MacBook Pro 16", Intel Core i9-9880H at 2.3 GHz, macOS 15.7,
  // headless Chrome 157): the median of three runs of this card, in ms per call.
  const LAPTOP = { flood: 9.08, noise: 17.3, sand: 0.475, blit: 0.266, sprites: 2.36 };
  const LAPTOP_NAME = '2019 MacBook Pro 16" (Intel Core i9-9880H, 2.3 GHz), headless Chrome 157';
  const W = 320, H = 180, SW = 320, SH = 180;

  // ---- the workloads ----
  // Each setup builds its data once (untimed) and returns the call that's timed.
  const J = worldJob();
  function setupNoise() { const Hf = new Float32Array(256 * 256); return () => J.noiseRows(Hf, 256, 7, 0, 256); }
  function setupFlood() {
    const H0 = new Float32Array(256 * 256); J.noiseRows(H0, 256, 7, 0, 256);
    const Hw = new Float32Array(H0.length);
    return () => { Hw.set(H0); J.flood(Hw, 256); };
  }
  // falling sand on the full 320×180 frame: sand, water and walls, a bottom-up scan with alternating direction and
  // a clock byte so nothing moves twice in one step. Ten steps per call from the same start; the time is per step.
  function setupSand() {
    const N = SW * SH, start = new Uint8Array(N), g = new Uint8Array(N), clock = new Uint8Array(N);
    for (let x = 0; x < SW; x++) {
      const top = 150 + Math.round(Kit.noise2(x / 40, 0.5, 3) * 18);
      for (let y = top; y < SH; y++) start[y * SW + x] = 3;
    }
    for (let k = 0; k < 6; k++) { const ly = 60 + k * 14, lx = Math.floor(Kit.hash2(k, 1, 9) * 260); for (let x = lx; x < lx + 50; x++) start[ly * SW + x] = 3; }
    for (let y = 0; y < 110; y++) for (let x = 0; x < SW; x++) {
      const i = y * SW + x; if (start[i]) continue;
      const r = Kit.hash2(x, y, 5); start[i] = r < 0.3 ? 1 : r < 0.45 ? 2 : 0;
    }
    let tick = 0;
    const empty = c => c === 0;
    function step() {
      tick = (tick + 1) & 255 || 1;
      for (let y = SH - 2; y >= 0; y--) {
        const ltr = ((y + tick) & 1) === 0;
        for (let i = 0; i < SW; i++) {
          const x = ltr ? i : SW - 1 - i, p = y * SW + x, c = g[p];
          if (c === 0 || c === 3 || clock[p] === tick) continue;
          const b = p + SW, side = Kit.hash2(x, y, tick) < 0.5 ? -1 : 1;
          let to = -1;
          if (c === 1) {
            if (g[b] === 0 || g[b] === 2) to = b;
            else if (x + side >= 0 && x + side < SW && (g[b + side] === 0 || g[b + side] === 2)) to = b + side;
          } else {
            if (empty(g[b])) to = b;
            else if (x + side >= 0 && x + side < SW && empty(g[b + side])) to = b + side;
            else if (x + side >= 0 && x + side < SW && empty(g[p + side])) to = p + side;
          }
          if (to >= 0) { g[p] = g[to]; g[to] = c; clock[to] = tick; }
        }
      }
    }
    return { fn: () => { g.set(start); clock.fill(0); for (let s = 0; s < 10; s++) step(); }, per: 10, g };
  }
  // indexes to RGBA through a Uint32 view, putImageData at 320×180, then drawImage scaled ×4 onto a 1280×720 canvas.
  // Times the CPU side: the browser may finish the GPU work later.
  function setupBlit() {
    const idx = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) idx[y * W + x] = 14 + ((Kit.noise2(x / 30, y / 30, 2) * 3 + 3) | 0);
    const small = document.createElement('canvas'); small.width = W; small.height = H;
    const sg = small.getContext('2d'), img = sg.createImageData(W, H), u32 = new Uint32Array(img.data.buffer);
    const big = document.createElement('canvas'); big.width = W * 4; big.height = H * 4;
    const bg = big.getContext('2d'); bg.imageSmoothingEnabled = false;
    return () => {
      for (let i = 0; i < idx.length; i++) u32[i] = LUT[idx[i]];
      sg.putImageData(img, 0, 0);
      bg.drawImage(small, 0, 0, W * 4, H * 4);
    };
  }
  // a frame of 600 16×16 sprites from a 64-sprite atlas onto a 320×180 canvas (also used for the frame-time watch)
  function makeAtlas() {
    const a = document.createElement('canvas'); a.width = 128; a.height = 128;
    const g = a.getContext('2d');
    for (let s = 0; s < 64; s++) {
      const ox = (s % 8) * 16, oy = (s >> 3) * 16, ramp = [Kit.RAMPS.green, Kit.RAMPS.red, Kit.RAMPS.blue, Kit.RAMPS.brown][s & 3];
      for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
        const dx = x - 7.5, dy = y - 7.5, inside = dx * dx + dy * dy < 50 && Kit.hash2(x, y, s) < 0.8;
        if (!inside) continue;
        const ink = PAL[ramp[2 + Math.floor(Kit.hash2(x, y, s + 99) * 4)]];
        g.fillStyle = ink; g.fillRect(ox + x, oy + y, 1, 1); g.fillRect(ox + 15 - x, oy + y, 1, 1); // mirrored, like a creature
      }
    }
    return a;
  }
  const POS = Array.from({ length: 600 }, (_, i) => [Kit.hash2(i, 1, 4) * (W + 16) - 16, Kit.hash2(i, 2, 4) * (H + 16) - 16, (Kit.hash2(i, 3, 4) * 64) | 0, Kit.hash2(i, 4, 4) * 2 - 1]);
  function spriteFrame(g, atlas, t) {
    g.fillStyle = PAL[1]; g.fillRect(0, 0, W, H);
    for (let i = 0; i < POS.length; i++) {
      const p = POS[i], s = p[2];
      let x = (p[0] + t * p[3] * 2) % (W + 16); if (x < -16) x += W + 32;
      g.drawImage(atlas, (s % 8) * 16, (s >> 3) * 16, 16, 16, Math.round(x), Math.round(p[1]), 16, 16);
    }
  }
  function setupSprites() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), atlas = makeAtlas(); let t = 0;
    return () => spriteFrame(g, atlas, t++);
  }

  const JOBS = [
    { key: 'flood', label: 'FLOOD 256', name: 'priority-flood 256x256', setup: setupFlood },
    { key: 'noise', label: 'NOISE 256', name: 'noise fill 256x256, 6 octaves', setup: setupNoise },
    { key: 'sand', label: 'SAND STEP', name: 'falling-sand step 320x180', setup: () => { const s = setupSand(); return { fn: s.fn, per: s.per }; } },
    { key: 'blit', label: 'BLIT X4', name: 'indexed blit 320x180 to 1280x720', setup: setupBlit },
    { key: 'sprites', label: '600 SPRITES', name: 'drawImage frame, 600 sprites', setup: setupSprites },
  ];

  Kit.register('phone-bench', { title: 'A phone bench', fit: 'per-frame' }, host => {
    const c = Kit.canvas(host, W, H), g = c.g;
    const atlas = makeAtlas();
    const res = {}; let frames = null, status = 'TAP RUN ON A PHONE', running = false;

    // ---- drawing the card ----
    function draw() {
      g.fillStyle = PAL[0]; g.fillRect(0, 0, W, H);
      g.fillStyle = PAL[12]; g.fillRect(4, 5, 5, 3); text(g, 'THIS DEVICE', 12, 4, 6);
      g.fillStyle = PAL[4]; g.fillRect(64, 5, 5, 3); text(g, 'LAPTOP 2019', 72, 4, 6);
      text(g, status, W - 4 - textW(status), 4, running ? 13 : 5);
      JOBS.forEach((j, k) => {
        const y = 14 + k * 19, lap = LAPTOP[j.key], me = res[j.key];
        text(g, j.label, 4, y, 7);
        const right = me ? fmt(me) + ' / ' + fmt(lap) + ' MS' : '- / ' + fmt(lap) + ' MS';
        text(g, right, W - 4 - textW(right), y, me ? 13 : 5);
        const span = W - 8, top = Math.max(lap, me || 0);
        g.fillStyle = PAL[2]; g.fillRect(4, y + 7, span, 9);
        g.fillStyle = PAL[4]; g.fillRect(4, y + 7, Math.max(1, Math.round(lap / top * span)), 3);
        if (me) { g.fillStyle = PAL[12]; g.fillRect(4, y + 11, Math.max(1, Math.round(me / top * span)), 5); }
      });
      // frame-time graph: one column per frame, 0 to 50 ms, guides at 16.7 and 33.3
      const gy = 120, gh = 44, gx = 4, gw = W - 8;
      text(g, 'FRAME TIMES', gx, gy - 8, 7);
      g.fillStyle = PAL[1]; g.fillRect(gx, gy, gw, gh);
      const yOf = ms => gy + gh - Math.min(gh, Math.round(ms / 50 * gh));
      g.fillStyle = PAL[3]; g.fillRect(gx, yOf(16.7), gw, 1); g.fillRect(gx, yOf(33.3), gw, 1);
      text(g, '16', gx + gw - 8, yOf(16.7) - 6, 4); text(g, '33', gx + gw - 8, yOf(33.3) - 6, 4);
      if (frames && frames.length) {
        const n = frames.length;
        for (let x = 0; x < gw; x++) {
          const a = Math.floor(x * n / gw), b = Math.max(a + 1, Math.floor((x + 1) * n / gw));
          if (a >= n) break;
          let m = 0; for (let i = a; i < b && i < n; i++) m = Math.max(m, frames[i]);
          g.fillStyle = PAL[m > 34 ? 11 : m > 20 ? 12 : 17]; g.fillRect(gx + x, yOf(m), 1, gy + gh - yOf(m));
        }
      }
      if (res.frames) {
        const f = res.frames, s = 'MEDIAN ' + fmt(f.median) + ' MS  ' + Math.round(1000 / f.median) + ' HZ  LONGEST ' + fmt(f.longest) + ' MS';
        text(g, s, gx, gy + gh + 4, 6);
      } else text(g, 'THREE SECONDS OF FRAMES AFTER THE TIMINGS', gx, gy + gh + 4, 4);
    }

    // ---- controls and the readout ----
    const b = Kit.bar(host);
    const run = b.button('Run', () => start());
    const cp = b.button('Copy results', () => {
      const t = report();
      copy(t).then(ok => { cp.textContent = ok ? 'Copied' : 'Select the text below'; setTimeout(() => { cp.textContent = 'Copy results'; }, 1800); });
      show(true);
    });
    cp.disabled = true;
    const note = b.note('Runs for about 5 seconds on a phone. Keep it plugged in and the screen on; Low Power Mode caps frames at 30.');
    const out = Kit.el('textarea', { readonly: '', rows: '12', 'aria-label': 'Results as plain text', style: 'display:none;width:100%;box-sizing:border-box;margin-top:8px;font:11px/1.35 ui-monospace,monospace;background:#0e0b16;color:#cdcbd9;border:1px solid #4a4566;border-radius:4px;padding:6px;' });
    const show = on => { out.style.display = on ? 'block' : 'none'; };
    host.appendChild(out);

    let dev = device(), mdl = '', step = 0;
    model().then(m => { mdl = m; });

    function report() {
      const lines = [];
      lines.push('Tycho study phone bench (docs/study/phones.md)');
      lines.push('Device: ' + (mdl ? mdl + ', ' : '') + dev.os + ', ' + dev.browser + ', screen ' + dev.screen + ' @' + dev.dpr + 'x, cores ' + (dev.cores || '?') + (dev.memory ? ', memory ' + dev.memory + ' GB' : '') + (dev.gpu ? ', GPU ' + dev.gpu : ''));
      lines.push('Timer step ' + (res.clock != null ? res.clock.toFixed(3) + ' ms' : '?') + ', cross-origin isolated ' + (dev.isolated ? 'yes' : 'no') + ', installed ' + (dev.standalone ? 'yes' : 'no'));
      lines.push('Workload (ms per call)            this    laptop  ratio');
      for (const j of JOBS) {
        const me = res[j.key], lap = LAPTOP[j.key];
        lines.push((j.name + '                                  ').slice(0, 34) + (me != null ? fmt(me) : '-').padStart(6) + fmt(lap).padStart(9) + (me != null ? (me / lap).toFixed(2) + 'x' : '-').padStart(7));
      }
      if (res.factor) lines.push('Overall: ' + verdict(res.factor) + ' (geometric mean of the five)');
      if (res.frames) {
        const f = res.frames;
        lines.push('Frames (3 s, 600 sprites a frame): median ' + fmt(f.median) + ' ms (' + Math.round(1000 / f.median) + ' Hz), 95th ' + fmt(f.p95) + ' ms, longest ' + fmt(f.longest) + ' ms, ' + f.slow + ' of ' + f.count + ' over 1.5x the median');
      }
      lines.push('Laptop: ' + LAPTOP_NAME);
      return lines.join('\n');
    }
    const verdict = f => f >= 1 ? f.toFixed(1) + 'x slower than the laptop' : (1 / f).toFixed(1) + 'x faster than the laptop';

    // ---- running ----
    // one workload per task, so the page repaints the progress between them
    function start() {
      if (running) return;
      running = true; run.disabled = true; cp.disabled = true; show(false);
      for (const k in res) delete res[k];
      frames = null; dev = device(); step = 0;
      res.clock = clockStep();
      next();
    }
    function next() {
      if (step < JOBS.length) {
        const j = JOBS[step];
        status = 'TIMING ' + j.label; draw();
        setTimeout(() => {
          const s = j.setup(), fn = typeof s === 'function' ? s : s.fn, per = s.per || 1;
          res[j.key] = measure(fn, 200, 3) / per;
          step++; draw(); next();
        }, 60);
        return;
      }
      let r = 1; for (const j of JOBS) r *= res[j.key] / LAPTOP[j.key];
      res.factor = Math.pow(r, 1 / JOBS.length);
      watchFrames();
    }
    // three seconds of rAF: each frame draws the 600-sprite scene on the card; the gaps between frames are the graph
    function watchFrames() {
      status = 'WATCHING FRAMES';
      const iv = []; let last = 0, t = 0; const t0 = performance.now();
      const tick = now => {
        if (last && t > 2) iv.push(now - last); // the first two gaps include the switch from timing to drawing
        last = now;
        spriteFrame(g, atlas, t++);
        g.fillStyle = PAL[0]; g.fillRect(0, 0, W, 12); text(g, 'WATCHING FRAMES ' + Math.max(0, 3 - Math.floor((now - t0) / 1000)), 4, 4, 13);
        if (now - t0 < 3000) requestAnimationFrame(tick);
        else finish(iv);
      };
      requestAnimationFrame(tick);
    }
    function finish(iv) {
      const s = [...iv].sort((a, b) => a - b), med = median(iv) || 16.7;
      frames = iv;
      res.frames = { median: med, p95: s[Math.floor(s.length * 0.95)] || med, longest: s[s.length - 1] || med, slow: iv.filter(v => v > med * 1.5).length, count: iv.length };
      running = false; run.disabled = false; cp.disabled = false;
      status = res.factor >= 1 ? res.factor.toFixed(1) + 'X SLOWER' : (1 / res.factor).toFixed(1) + 'X FASTER';
      draw();
      note.textContent = 'Overall ' + verdict(res.factor) + '. ' + dev.os + ', ' + dev.browser + ', ' + dev.screen + ' @' + dev.dpr + 'x, ' + (dev.cores || '?') + ' cores reported.';
      out.value = report(); show(true);
      host.__result = JSON.parse(JSON.stringify(res));
    }
    draw();
  });
})();
