// phones-shared.js: the helpers the phone demos share (phone-bench, worker-gen, storage), loaded before any of them.
// The world job is one self-contained function, so the same source runs on the main thread, sliced across frames,
// or in a Web Worker built from a Blob URL (it reads nothing from the page: no Kit, no globals). Beside it: a 3×5
// pixel font for labels in the art, batch timing that survives a coarse clock, device facts, and a clipboard copy.
(() => {
  // ---- the world job ----
  // worldJob() returns the stages of a small seeded world generator, the study's typical load:
  // fbm height on an island falloff, priority-flood (fills pits, orders every cell), flow accumulation in
  // reverse flood order, then a paint into page palette indexes (sea, beach, grass, forest, hills, rock, snow,
  // lakes, rivers, a two-tone hillshade). Self-contained on purpose: its source is copied into a worker.
  function worldJob() {
    function hash2(x, y, seed) {
      let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) >>> 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    const GX = [1, -1, 0, 0, 0.7071, -0.7071, 0.7071, -0.7071], GY = [0, 0, 1, -1, 0.7071, 0.7071, -0.7071, -0.7071];
    function gnoise(x, y, seed) {
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      let k = (hash2(x0, y0, seed) * 8) | 0; const a = GX[k] * fx + GY[k] * fy;
      k = (hash2(x0 + 1, y0, seed) * 8) | 0; const b = GX[k] * (fx - 1) + GY[k] * fy;
      k = (hash2(x0, y0 + 1, seed) * 8) | 0; const c = GX[k] * fx + GY[k] * (fy - 1);
      k = (hash2(x0 + 1, y0 + 1, seed) * 8) | 0; const d = GX[k] * (fx - 1) + GY[k] * (fy - 1);
      const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10), sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
      const ab = a + (b - a) * sx, cd = c + (d - c) * sx;
      return (ab + (cd - ab) * sy) * 1.41;
    }
    function fbm(x, y, seed, oct) {
      let s = 0, amp = 1, f = 1, norm = 0;
      for (let i = 0; i < oct; i++) { s += amp * gnoise(x * f, y * f, seed + i * 101); norm += amp; amp *= 0.5; f *= 2; }
      return s / norm;
    }
    // rows y0..y1 of an N×N height field: six octaves over a round island falloff
    function noiseRows(H, N, seed, y0, y1) {
      const f = 5 / N;
      for (let y = y0; y < y1; y++) {
        const ny = y / N - 0.5;
        for (let x = 0; x < N; x++) {
          const nx = x / N - 0.5, d = Math.sqrt(nx * nx + ny * ny) * 2;
          H[y * N + x] = fbm(x * f, y * f, seed, 6) * 0.6 + 0.52 - d * d * 0.8;
        }
      }
    }
    // priority-flood state: a binary min-heap of cell indexes keyed by height, seeded with the border
    function floodStart(N) {
      const n = N * N, s = { N, heap: new Int32Array(n), key: new Float32Array(n), size: 0, done: new Uint8Array(n), ord: new Int32Array(n), rec: new Int32Array(n).fill(-1), k: 0 };
      return s;
    }
    function push(s, c, h) {
      let i = s.size++; const heap = s.heap, key = s.key;
      while (i > 0) { const p = (i - 1) >> 1; if (key[p] <= h) break; heap[i] = heap[p]; key[i] = key[p]; i = p; }
      heap[i] = c; key[i] = h;
    }
    function pop(s) {
      const heap = s.heap, key = s.key, top = heap[0], n = --s.size;
      if (n > 0) {
        const c = heap[n], h = key[n]; let i = 0;
        for (;;) {
          let l = 2 * i + 1; if (l >= n) break;
          if (l + 1 < n && key[l + 1] < key[l]) l++;
          if (key[l] >= h) break;
          heap[i] = heap[l]; key[i] = key[l]; i = l;
        }
        heap[i] = c; key[i] = h;
      }
      return top;
    }
    function floodBorder(s, H) {
      const N = s.N;
      for (let i = 0; i < N; i++) for (const c of [i, (N - 1) * N + i, i * N, i * N + N - 1]) if (!s.done[c]) { s.done[c] = 1; push(s, c, H[c]); }
    }
    // pop up to `budget` cells: each raises its unvisited neighbors to just above itself (epsilon fill) and drains into it
    function floodSome(s, H, budget) {
      const N = s.N, done = s.done, ord = s.ord, rec = s.rec;
      while (s.size > 0 && budget-- > 0) {
        const c = pop(s), cx = c % N, cy = (c - cx) / N, hc = H[c];
        ord[s.k++] = c;
        for (let dy = -1; dy <= 1; dy++) {
          const y = cy + dy; if (y < 0 || y >= N) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const x = cx + dx; if (x < 0 || x >= N || (dx === 0 && dy === 0)) continue;
            const nb = y * N + x; if (done[nb]) continue;
            done[nb] = 1; rec[nb] = c;
            if (H[nb] <= hc) H[nb] = hc + 1e-5;
            push(s, nb, H[nb]);
          }
        }
      }
      return s.size === 0;
    }
    function flood(H, N) { const s = floodStart(N); floodBorder(s, H); floodSome(s, H, Infinity); return s; }
    // flow accumulation: every cell passes its water to its receiver, walking the flood order backward
    function accumulate(s) {
      const n = s.N * s.N, acc = new Float32Array(n).fill(1), ord = s.ord, rec = s.rec;
      for (let k = n - 1; k >= 0; k--) { const c = ord[k], r = rec[c]; if (r >= 0) acc[r] += acc[c]; }
      return acc;
    }
    // paint into page palette indexes; [lit, shaded] per band, shaded where the ground faces away from a northwest sun
    const SEA = 0.3;
    const BANDS = [[0.33, 29, 28], [0.45, 17, 16], [0.58, 16, 15], [0.7, 28, 27], [0.8, 5, 4], [9, 7, 6]];
    function paint(H0, H, acc, N) {
      const idx = new Uint8Array(N * N), river = N * 1.5;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x, h0 = H0[i];
        if (h0 < SEA) { idx[i] = h0 < SEA - 0.12 ? 20 : h0 < SEA - 0.04 ? 21 : 22; continue; }
        if (H[i] - h0 > 0.004) { idx[i] = 22; continue; }
        if (acc[i] > river) { idx[i] = 23; continue; }
        const h = H[i], up = x > 0 && y > 0 ? H[i - N - 1] : h;
        let b = 0; while (h >= BANDS[b][0]) b++;
        idx[i] = up - h > 0.004 ? BANDS[b][2] : BANDS[b][1];
      }
      return idx;
    }
    // the whole job as a generator that yields every few rows or cells, so a caller can slice it across frames.
    // ms holds each stage's time from the caller's clock.
    function* gen(N, seed, now) {
      const t = now || (() => 0), ms = {};
      let t0 = t();
      const H = new Float32Array(N * N);
      for (let y = 0; y < N; y += 8) { noiseRows(H, N, seed, y, Math.min(N, y + 8)); yield; }
      const H0 = H.slice();
      ms.noise = t() - t0; t0 = t();
      const s = floodStart(N); floodBorder(s, H);
      while (!floodSome(s, H, 4096)) yield;
      ms.flood = t() - t0; t0 = t();
      const acc = accumulate(s); yield;
      ms.flow = t() - t0; t0 = t();
      const idx = paint(H0, H, acc, N);
      ms.paint = t() - t0;
      return { idx, N, ms };
    }
    function run(N, seed, now) { const it = gen(N, seed, now); let r; while (!(r = it.next()).done); return r.value; }
    return { hash2, fbm, noiseRows, flood, floodStart, floodBorder, floodSome, accumulate, paint, gen, run };
  }

  // the worker's source: the job, then a message handler. It posts 'ready' with its start time on the page's
  // clock (timeOrigin + now), so the page can time startup and transfer across threads.
  const workerSource = () => `'use strict';
const J = (${worldJob.toString()})();
const abs = () => performance.timeOrigin + performance.now();
postMessage({ type: 'ready', at: abs() });
onmessage = e => {
  const { N, seed } = e.data, t0 = performance.now();
  const r = J.run(N, seed, () => performance.now());
  const work = performance.now() - t0;
  postMessage({ type: 'done', idx: r.idx, N, ms: r.ms, work, at: abs() }, [r.idx.buffer]);
};`;

  // ---- palette lookups ----
  // RGBA as one little-endian Uint32 per page ink, for writing ImageData through a Uint32Array view
  const LUT = new Uint32Array(Kit.RGB.map(([r, g, b]) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0));
  // an N×N index map into a size×size ImageData (nearest sampling), for showing a world at any size
  function mapImage(idx, N, size) {
    const img = new ImageData(size, size), o = new Uint32Array(img.data.buffer);
    for (let y = 0; y < size; y++) {
      const sy = Math.floor(y * N / size) * N;
      for (let x = 0; x < size; x++) o[y * size + x] = LUT[idx[sy + Math.floor(x * N / size)]];
    }
    return img;
  }

  // ---- a 3×5 pixel font ----
  const GLYPH = {
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
    G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
    M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
    S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
    Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
    0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6], 4: [5, 5, 7, 1, 1],
    5: [7, 4, 6, 1, 6], 6: [3, 4, 6, 5, 2], 7: [7, 1, 2, 2, 2], 8: [2, 5, 2, 5, 2], 9: [2, 5, 3, 1, 6],
    '-': [0, 0, 7, 0, 0], '.': [0, 0, 0, 0, 2], ':': [0, 2, 0, 2, 0], '/': [1, 1, 2, 4, 4], '%': [5, 1, 2, 4, 5], ' ': [0, 0, 0, 0, 0],
  };
  // text(g, s, x, y, ink): fillRect pixels, so it draws within the GPU stand-in's calls
  function text(g, s, x, y, ink, shadow = -1) {
    x = Math.round(x); y = Math.round(y); // whole pixels, or fillRect smears
    const put = (ox, oy, c) => {
      g.fillStyle = Kit.PAL[c];
      for (let i = 0; i < s.length; i++) {
        const gl = GLYPH[s[i].toUpperCase()] || GLYPH[' '];
        for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (gl[r] & (4 >> b)) g.fillRect(ox + i * 4 + b, oy + r, 1, 1);
      }
    };
    if (shadow >= 0) put(x + 1, y + 1, shadow);
    put(x, y, ink);
  }
  const textW = s => s.length * 4 - 1;

  // ---- timing ----
  // measure(fn): mean ms per call, batching calls until at least minMs has passed, so a 1 ms clock (Safari's)
  // still gives a usable number. Two untimed calls first let the JIT warm up.
  function measure(fn, minMs = 150, minReps = 3) {
    fn(); fn();
    let reps = 0; const t0 = performance.now(); let t = t0;
    while (reps < minReps || t - t0 < minMs) { fn(); reps++; t = performance.now(); }
    return (t - t0) / reps;
  }
  const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length & 1 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
  const fmt = ms => ms >= 100 ? ms.toFixed(0) : ms >= 10 ? ms.toFixed(1) : ms.toFixed(2);
  // the smallest step performance.now() takes here (the timer's resolution as this page sees it)
  function clockStep() {
    let best = Infinity, last = performance.now();
    for (let i = 0; i < 200000 && best > 0.0005; i++) { const t = performance.now(); if (t > last) { best = Math.min(best, t - last); last = t; } }
    return best;
  }

  // ---- the device ----
  // what the page can see: a short browser and OS from the user agent, the screen, DPR, cores, memory, GPU
  function device() {
    const ua = navigator.userAgent;
    let os = 'other', br = 'other';
    let m;
    if ((m = ua.match(/iPhone OS (\d+)_(\d+)/)) || (m = ua.match(/CPU OS (\d+)_(\d+)/))) os = (/iPad/.test(ua) ? 'iPadOS ' : 'iOS ') + m[1] + '.' + m[2];
    else if ((m = ua.match(/Android (\d+(\.\d+)?)/))) os = 'Android ' + m[1];
    else if (/Mac OS X/.test(ua)) os = navigator.maxTouchPoints > 1 ? 'iPadOS (desktop mode)' : 'macOS';
    else if (/Windows/.test(ua)) os = 'Windows';
    else if (/Linux/.test(ua)) os = 'Linux';
    if ((m = ua.match(/(CriOS|FxiOS|EdgiOS|EdgA?|SamsungBrowser|Firefox|OPR)\/(\d+)/))) br = { CriOS: 'Chrome (WebKit)', FxiOS: 'Firefox (WebKit)', EdgiOS: 'Edge (WebKit)', Edg: 'Edge', EdgA: 'Edge', SamsungBrowser: 'Samsung Internet', Firefox: 'Firefox', OPR: 'Opera' }[m[1]] + ' ' + m[2];
    else if ((m = ua.match(/HeadlessChrome\/(\d+)/))) br = 'Headless Chrome ' + m[1];
    else if ((m = ua.match(/Chrome\/(\d+)/))) br = 'Chrome ' + m[1];
    else if ((m = ua.match(/Version\/(\d+(\.\d+)?).*Safari/))) br = 'Safari ' + m[1];
    let gpu = '';
    try {
      const c = document.createElement('canvas'), gl = c.getContext('webgl');
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      }
    } catch (e) { gpu = ''; }
    return {
      os, browser: br, gpu: String(gpu).replace(/\s+/g, ' ').slice(0, 60),
      screen: screen.width + '×' + screen.height, dpr: +(window.devicePixelRatio || 1).toFixed(2),
      cores: navigator.hardwareConcurrency || 0, memory: navigator.deviceMemory || 0,
      isolated: !!window.crossOriginIsolated,
      standalone: !!((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone),
    };
  }
  // Chromium also tells the phone's model, if asked (Android only; resolves to '' elsewhere)
  function model() {
    const d = navigator.userAgentData;
    if (!d || !d.getHighEntropyValues) return Promise.resolve('');
    return d.getHighEntropyValues(['model']).then(v => v.model || '', () => '');
  }

  // ---- copying ----
  // copy(text): the clipboard API where allowed, else a hidden textarea and execCommand. Resolves true on success.
  function copy(textStr) {
    const fallback = () => {
      const t = document.createElement('textarea');
      t.value = textStr; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); t.setSelectionRange(0, textStr.length);
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      t.remove(); return ok;
    };
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(textStr).then(() => true, () => fallback());
    return Promise.resolve(fallback());
  }

  window.StudyShared = window.StudyShared || {};
  StudyShared.phones = { worldJob, workerSource, LUT, mapImage, text, textW, measure, median, fmt, clockStep, device, model, copy };
})();
