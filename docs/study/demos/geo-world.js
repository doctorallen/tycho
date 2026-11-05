// geo-world.js: the `geo-world` demo, a world made the way land is made, then a region of it to walk into.
// The world (256 x 256 cells) is built in stages you can watch: seeded plates drift and push up ranges where they
// meet; rivers cut the ranges down (stream-power erosion with uplift, on a Priority-Flood drainage graph) and talus
// slumps; water gathers into rivers, lakes and salt flats; westerlies and trade winds carry rain inland and drop it on
// windward slopes; Whittaker biomes and soils follow; villages settle where people did (water, flat arable land,
// shelter, sun, fords) and least-cost roads (Tobler's hiking function, 16 directions) join them, reusing each other.
// The rock follows the plates too: basalt where they part, arc and hotspot volcanoes, granite where ranges were
// stripped to their roots, and elsewhere a gently folded layer cake of limestone, sandstone and shale.
// Tap the map to embark: that cell's region in 3/4 oblique pixel art, terraced with the strata of its own rock, with
// waterfalls, a village whose form comes from its site (a street village along a valley road, a forest strip village,
// a green, an Anger on the road, a hill village, a fishing hamlet), trails, plants from window.Flora (simple shapes
// without it) whose biomes blend at their edges, and caves made by the rock: karst passages dissolved along joints at
// the water table and drained to springs, lava tubes down basalt slopes, sea caves and sandstone shelters.
// Built on Merryfolk's valley (js/terrain.js, js/layout.js) and the notes in settlements_paths_vegetation.md and
// caves_villages_edges.md.
'use strict';
(() => {
  const hash2 = Kit.hash2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ---- noise: gradient noise with eight fixed gradients (no trig, so fast), fBm and ridged fBm ----
  const GX = [1, -1, 0, 0, 0.7071, -0.7071, 0.7071, -0.7071], GY = [0, 0, 1, -1, 0.7071, 0.7071, -0.7071, -0.7071];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  function gnoise(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    let k = (hash2(x0, y0, seed) * 8) | 0; const a = GX[k] * fx + GY[k] * fy;
    k = (hash2(x0 + 1, y0, seed) * 8) | 0; const b = GX[k] * (fx - 1) + GY[k] * fy;
    k = (hash2(x0, y0 + 1, seed) * 8) | 0; const c = GX[k] * fx + GY[k] * (fy - 1);
    k = (hash2(x0 + 1, y0 + 1, seed) * 8) | 0; const d = GX[k] * (fx - 1) + GY[k] * (fy - 1);
    const sx = fade(fx), sy = fade(fy), ab = a + (b - a) * sx, cd = c + (d - c) * sx;
    return (ab + (cd - ab) * sy) * 1.41;
  }
  function fbm(x, y, seed, oct) {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += amp * gnoise(x * f, y * f, seed + i * 101); norm += amp; amp *= 0.5; f *= 2; }
    return s / norm;
  }
  function ridged(x, y, seed, oct) {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(gnoise(x * f, y * f, seed + i * 131)); s += amp * n * n; norm += amp; amp *= 0.5; f *= 2; }
    return s / norm;
  }

  // ---- colors: packed little-endian pixels for a Uint32Array over ImageData ----
  const pack = (r, g, b) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
  const P = h => pack(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16));
  const shadeC = (c, k) => pack(clamp((c & 255) * k, 0, 255) | 0, clamp(((c >>> 8) & 255) * k, 0, 255) | 0, clamp(((c >>> 16) & 255) * k, 0, 255) | 0);
  const mixC = (a, b, t) => pack(lerp(a & 255, b & 255, t) | 0, lerp((a >>> 8) & 255, (b >>> 8) & 255, t) | 0, lerp((a >>> 16) & 255, (b >>> 16) & 255, t) | 0);
  const css = c => `rgb(${c & 255},${(c >>> 8) & 255},${(c >>> 16) & 255})`;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  // a gradient as a lookup table: stops [[value, '#hex'], ...] sampled into n entries over [lo, hi]
  function ramp(stops, lo, hi, n = 256) {
    const out = new Uint32Array(n), cs = stops.map(([v, h]) => [v, P(h)]);
    for (let i = 0; i < n; i++) {
      const v = lo + (hi - lo) * i / (n - 1);
      let k = 0;
      while (k < cs.length - 2 && v > cs[k + 1][0]) k++;
      out[i] = mixC(cs[k][1], cs[k + 1][1], clamp((v - cs[k][0]) / (cs[k + 1][0] - cs[k][0]), 0, 1));
    }
    return { lut: out, at: v => out[clamp(Math.round((v - lo) / (hi - lo) * (n - 1)), 0, n - 1)] };
  }

  // ---- a 3x5 pixel font for labels drawn in the art ----
  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
    9: '111101111001110', '-': '000000111000000', '.': '000000000000010', ' ': '000000000000000', ':': '000010000010000',
    '/': '001001010100100', ',': '000000000010100', '+': '000010111010000', '<': '001010100010001', '>': '100010001010100',
  };
  function text(g, s, x, y, col) {
    g.fillStyle = col;
    for (const ch of String(s).toUpperCase()) { const f = FONT[ch] || FONT[' ']; for (let i = 0; i < 15; i++) if (f[i] === '1') g.fillRect(x + i % 3, y + (i / 3 | 0), 1, 1); x += 4; }
  }

  // ---- grids ----
  const N = 256, NN = N * N, CELL_KM = 4;
  const DX8 = [1, 1, 0, -1, -1, -1, 0, 1], DY8 = [0, 1, 1, 1, 0, -1, -1, -1];
  const DL8 = DX8.map((dx, k) => Math.hypot(dx, DY8[k]));
  // Galin's k = 2 mask: the eight neighbors plus the knight moves, sixteen headings 22.5 degrees apart on average
  const DX16 = [...DX8, 2, 1, -1, -2, -2, -1, 1, 2], DY16 = [...DY8, 1, 2, 2, 1, -1, -2, -2, -1];
  const DL16 = DX16.map((dx, k) => Math.hypot(dx, DY16[k]));

  // a binary min-heap of (key, index) in typed arrays
  class Heap {
    constructor(cap) { this.k = new Float64Array(cap); this.v = new Int32Array(cap); this.n = 0; }
    push(key, val) {
      if (this.n >= this.k.length) { const k = new Float64Array(this.k.length * 2), v = new Int32Array(this.k.length * 2); k.set(this.k); v.set(this.v); this.k = k; this.v = v; }
      const k = this.k, v = this.v;
      let i = this.n++;
      while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
      k[i] = key; v[i] = val;
    }
    pop() {
      const k = this.k, v = this.v, top = v[0];
      this.top = k[0];
      const n = --this.n;
      if (n > 0) {
        const lk = k[n], lv = v[n];
        let i = 0;
        for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; }
        k[i] = lk; v[i] = lv;
      }
      return top;
    }
  }

  // separable box blur, `passes` times (three passes is close to a Gaussian)
  function blur(src, w, h, r, passes = 1) {
    let a = Float32Array.from(src), b = new Float32Array(w * h);
    const inv = 1 / (2 * r + 1);
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < h; y++) {
        const row = y * w;
        let s = 0;
        for (let x = -r; x <= r; x++) s += a[row + clamp(x, 0, w - 1)];
        for (let x = 0; x < w; x++) { b[row + x] = s * inv; s += a[row + Math.min(x + r + 1, w - 1)] - a[row + Math.max(x - r, 0)]; }
      }
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let y = -r; y <= r; y++) s += b[clamp(y, 0, h - 1) * w + x];
        for (let y = 0; y < h; y++) { a[y * w + x] = s * inv; s += b[Math.min(y + r + 1, h - 1) * w + x] - b[Math.max(y - r, 0) * w + x]; }
      }
    }
    return a;
  }

  // chamfer distance (1 and the square root of 2) from every cell to the nearest masked cell, and which cell that is
  function distField(mask, w, h) {
    const n = w * h, d = new Float32Array(n).fill(1e9), s = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) if (mask[i]) { d[i] = 0; s[i] = i; }
    const pass = (y0, y1, dy, x0, x1, dx) => {
      for (let y = y0; y !== y1; y += dy) for (let x = x0; x !== x1; x += dx) {
        const i = y * w + x;
        const t = (nx, ny, c) => { if (nx < 0 || ny < 0 || nx >= w || ny >= h) return; const j = ny * w + nx; if (d[j] + c < d[i]) { d[i] = d[j] + c; s[i] = s[j]; } };
        t(x - dx, y, 1); t(x, y - dy, 1); t(x - dx, y - dy, Math.SQRT2); t(x + dx, y - dy, Math.SQRT2);
      }
    };
    pass(0, h, 1, 0, w, 1);
    pass(h - 1, -1, -1, w - 1, -1, -1);
    return { d, s };
  }

  // Priority-Flood (Barnes, Lehman & Mulla 2014) with epsilon: every pit is filled to its spill height plus a tiny
  // slope, so all water reaches an outlet. Cells pop from low to high, which is also an order where every cell comes
  // after the cell it drains to. Receivers are the steepest way down the filled surface.
  function flood(w, h, Hs, outlet, F, rec, ord, heap, done) {
    const n = w * h;
    done.fill(0); heap.n = 0;
    for (let i = 0; i < n; i++) if (outlet[i]) { done[i] = 1; F[i] = Hs[i]; heap.push(F[i], i); }
    let c = 0;
    while (heap.n) {
      const i = heap.pop();
      ord[c++] = i;
      const x = i % w, y = (i / w) | 0, e = F[i] + 1e-6;
      for (let d = 0; d < 8; d++) {
        const nx = x + DX8[d], ny = y + DY8[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (done[j]) continue;
        done[j] = 1; F[j] = Hs[j] > e ? Hs[j] : e; heap.push(F[j], j);
      }
    }
    for (let i = 0; i < n; i++) {
      if (outlet[i]) { rec[i] = i; continue; }
      const x = i % w, y = (i / w) | 0;
      let best = i, bs = 0;
      for (let d = 0; d < 8; d++) {
        const nx = x + DX8[d], ny = y + DY8[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx, s = (F[i] - F[j]) / DL8[d];
        if (s > bs) { bs = s; best = j; }
      }
      rec[i] = best;
    }
    return c;
  }

  // A* over a grid with the 16-direction mask. cost(i, j, k) is the price of step k from i to j (Infinity to forbid);
  // heur(i) must not overestimate much. Returns the path as cell indices, start first, or null.
  function makeAStar(w, h) {
    const n = w * h, g = new Float64Array(n), came = new Int32Array(n), seen = new Int32Array(n), shut = new Int32Array(n), heap = new Heap(4096);
    let gen = 0;
    return (start, goal, cost, heur, maxPop = 200000) => {
      gen++; heap.n = 0;
      g[start] = 0; came[start] = -1; seen[start] = gen;
      heap.push(heur(start), start);
      let pops = 0;
      while (heap.n) {
        const i = heap.pop();
        if (shut[i] === gen) continue;
        shut[i] = gen;
        if (i === goal) {
          const path = [];
          for (let c = i; c >= 0; c = came[c]) path.push(c);
          return path.reverse();
        }
        if (++pops > maxPop) return null;
        const x = i % w, y = (i / w) | 0;
        for (let k = 0; k < 16; k++) {
          const nx = x + DX16[k], ny = y + DY16[k];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (shut[j] === gen) continue;
          const c = cost(i, j, k);
          if (!(c < Infinity)) continue;
          const ng = g[i] + c;
          if (seen[j] !== gen || ng < g[j]) { seen[j] = gen; g[j] = ng; came[j] = i; heap.push(ng + heur(j), j); }
        }
      }
      return null;
    };
  }
  // the two cells a knight move passes between (for checking that a road doesn't hop a river)
  const midCells = (x, y, k, w) => {
    const dx = DX16[k], dy = DY16[k];
    if (k < 8) return null;
    const ax = x + (Math.abs(dx) === 2 ? dx / 2 : 0), ay = y + (Math.abs(dy) === 2 ? dy / 2 : 0);
    return [ay * w + ax, (ay + (Math.abs(dy) === 2 ? 0 : dy)) * w + ax + (Math.abs(dx) === 2 ? 0 : dx)];
  };
  // Tobler's hiking function as a pace relative to flat ground: e^(3.5 |S + 0.05|) / e^(3.5 * 0.05)
  const tobler = S => Math.exp(3.5 * Math.abs(S + 0.05) - 0.175);

  // ---- biomes and soils ----
  const ICE = 0, TUNDRA = 1, TAIGA = 2, FOREST = 3, GRASS = 4, DESERT = 5, SAVANNA = 6, JUNGLE = 7, SWAMP = 8, BEACH = 9, ALPINE = 10;
  const BIOME_NAME = ['ice', 'tundra', 'taiga', 'temperate forest', 'grassland', 'desert', 'savanna', 'rainforest', 'swamp', 'beach', 'alpine'];
  const BIOME_SHORT = ['ICE', 'TUNDRA', 'TAIGA', 'FOREST', 'GRASS', 'DESERT', 'SAVANNA', 'JUNGLE', 'SWAMP', 'BEACH', 'ALPINE'];
  const BIOME_COL = ['#eef2f6', '#9aa58e', '#3d6a4e', '#4f8a3c', '#a3c25e', '#e2c483', '#c8b85c', '#256b33', '#55693f', '#eedca2', '#8e8a80'].map(P);
  const ALLUVIUM = 0, LOAM = 1, CLAY = 2, THIN = 3, SAND = 4, PEAT = 5, ROCK = 6;
  const SOIL_SHORT = ['ALLUVIUM', 'LOAM', 'CLAY', 'THIN', 'SAND', 'PEAT', 'BARE ROCK'];
  const SOIL_COL = ['#6b4a2a', '#8f6a3a', '#a07a8a', '#b8b0a0', '#e8d49a', '#3a3428', '#6e6a70'].map(P);
  const OCEAN_DEEP = P('#14305e'), OCEAN = P('#1d4a86'), SHELF = P('#2f72ae'), SHALLOW = P('#4f9ccc'), LAKE = P('#3d8cc4'), SALT = P('#efe6d0'), SALT_LAKE = P('#5fb0b8'), RIVER = P('#2f7fc0'), RIVER_BIG = P('#2a6fb0');
  const ROAD = P('#5a3a20'), TRAIL = P('#b49a6a');
  // Whittaker's climate classes, shared by the world and the regions (cold desert, steppe or tundra where it's dry)
  const whittaker = (t, p) => t < -3 ? TUNDRA : t < 4 ? (p < 10 ? DESERT : p < 22 ? (t > 0 ? GRASS : TUNDRA) : TAIGA)
    : t < 18 ? (p < 22 ? DESERT : p < 55 ? GRASS : FOREST) : (p < 28 ? DESERT : p < 115 ? SAVANNA : JUNGLE);

  // ---- rock: volcanic where the plates say so, crystalline where ranges were stripped to their roots, and elsewhere
  // a layer cake of sedimentary beds 150 m thick, gently folded, so a valley cut deep enough reaches another bed ----
  const R_SHALE = 0, R_SAND = 1, R_LIME = 2, R_GRAN = 3, R_BAS = 4;
  const ROCK_NAME = ['shale', 'sandstone', 'limestone', 'granite', 'basalt'];
  const ROCK_COL = ['#8c7c6c', '#c47a4c', '#d6cdb0', '#a8828e', '#46424e'].map(P);
  const foldAt = (x, y, seed) => 0.45 * fbm(x / 40, y / 40, seed + 901, 2);
  function rockOf(seed, volc, crys, fold, z) {
    if (volc > 0.45) return R_BAS;
    if (crys > 0.5) return R_GRAN;
    const r = hash2(Math.floor((z + fold + 5) / 0.15), 0, seed + 907);
    return r < 0.42 ? R_LIME : r < 0.72 ? R_SAND : R_SHALE;
  }

  // ===================================================================================================
  // the world, in stages
  // ===================================================================================================
  const STAGES = ['Plates', 'Erosion', 'Water', 'Climate', 'Biomes', 'Settlements', 'Paths'];
  function* buildWorld(w) {
    const seed = w.seed, R = Kit.rng(seed * 7919 + 13);
    const H = w.H = new Float64Array(NN);

    // ---- 1. plates and uplift ----
    w.stage = 'Plates';
    const nP = 12 + R.int(0, 4), plates = [];
    for (let k = 0; k < nP; k++) {
      const a = R() * Math.PI * 2, sp = R.range(0.3, 1);
      // wt makes this a power diagram, so plates come in different sizes
      plates.push({ k, x: R.range(12, N - 12), y: R.range(12, N - 12), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, wt: R() * R() * 1600, cont: false });
    }
    // continental crust on about two plates in five, favoring those away from the map's edge
    const edgeD = p => Math.min(p.x, p.y, N - p.x, N - p.y);
    const ids = plates.map(p => p.k).sort((a, b) => edgeD(plates[b]) * (0.4 + hash2(b, 3, seed)) - edgeD(plates[a]) * (0.4 + hash2(a, 3, seed)));
    for (let k = 0; k < Math.round(nP * 0.42); k++) plates[ids[k]].cont = true;
    w.plates = plates;
    const pid = w.pid = new Uint8Array(NN), bd = w.bd = new Float32Array(NN), bconv = w.bconv = new Float32Array(NN);
    const up = new Float32Array(NN), dn = new Float32Array(NN), contRaw = new Float32Array(NN), volRaw = new Float32Array(NN);
    const sw = seed + 11;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        // plates are Voronoi cells of the seeds in warped space, so their edges wander
        const wx = x + 30 * fbm(x / 80, y / 80, sw, 4), wy = y + 30 * fbm(x / 80 + 31.7, y / 80 - 12.3, sw + 7, 4);
        let d1 = 1e9, j1 = 0;
        for (let j = 0; j < nP; j++) { const dx = wx - plates[j].x, dy = wy - plates[j].y, d = dx * dx + dy * dy - plates[j].wt; if (d < d1) { d1 = d; j1 = j; } }
        const a = plates[j1];
        let near = 1e9, nconv = 0, u = 0, v = 0, vo = 0;
        for (let j = 0; j < nP; j++) {
          if (j === j1) continue;
          const b = plates[j], ex = b.x - a.x, ey = b.y - a.y, el = Math.hypot(ex, ey) || 1;
          const dx = wx - b.x, dy = wy - b.y;
          // exact distance to the (power) bisector between the two seeds
          const d = (dx * dx + dy * dy - b.wt - d1) / (2 * el);
          if (d > 60) continue;
          // how fast the plates close along the line between them (negative: they part)
          const conv = ((a.vx - b.vx) * ex + (a.vy - b.vy) * ey) / el;
          if (d < near) { near = d; nconv = conv; }
          // vo gathers volcanic rock: arcs over sinking plates, basalt where plates part
          if (conv > 0.05) {
            if (a.cont && b.cont) u += conv * (1.5 * Math.exp(-((d / 12) ** 2)) + 0.3 * Math.exp(-((d / 26) ** 2))); // collision range and plateau
            else if (a.cont) { const t = conv * 1.5 * Math.exp(-(((d - 9) / 6.5) ** 2)); u += t; vo += t * 0.45; } // the overriding plate: a coastal range of volcanoes
            else if (b.cont) v += conv * 2 * Math.exp(-((d / 3.5) ** 2)); // the sinking plate: a trench
            else if (a.k < b.k) { const t = conv * 2.2 * Math.exp(-(((d - 6) / 3) ** 2)) * sstep(0.35, 0.65, ridged(x / 9, y / 9, seed + 5, 2)); u += t; vo += t; } // an island arc, in a chain
            else v += conv * 1.8 * Math.exp(-((d / 3) ** 2));
          } else if (conv < -0.05) {
            if (a.cont && b.cont) { const t = -conv * 0.32 * Math.exp(-((d / 3.5) ** 2)); v += t; vo += t * 4; } // a rift valley, floored with basalt
            else if (!a.cont && !b.cont) { const t = -conv * 1.2 * Math.exp(-((d / 9) ** 2)); u += t; vo += t; } // a mid-ocean ridge
          }
        }
        const i = y * N + x;
        pid[i] = j1; bd[i] = near; bconv[i] = nconv; up[i] = u; dn[i] = v; contRaw[i] = a.cont ? 1 : 0; volRaw[i] = vo;
      }
      if ((y & 15) === 15) { w.progress = y / N * 0.8; yield; }
    }
    // continents: the continental plates, blurred into shelves and slopes, with coasts wandering by noise
    const cont = blur(contRaw, N, N, 9, 2);
    const U = w.U = new Float32Array(NN), crys = w.crys = new Float32Array(NN);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, e = Math.min(x, y, N - 1 - x, N - 1 - y);
      const c = cont[i] + 0.44 * fbm(x / 52, y / 52, seed + 21, 5) - Math.max(0, (24 - e) / 24) * 0.8;
      const shelf = sstep(0.27, 0.4, c), land = sstep(0.43, 0.6, c);
      const mod = 0.4 + 1.1 * ridged(x / 20, y / 20, seed + 27, 3);
      const u = 2.2 * Math.tanh(up[i] * mod / 2.2); // crust can only stack so high
      // old ranges, worn down long ago, and broad swells and basins keep the interior from being one plain
      const old = Math.max(0, ridged(x / 44, y / 44, seed + 43, 4) - 0.6) * 2.4 * sstep(0.2, 0.5, fbm(x / 90, y / 90, seed + 45, 2) + 0.3);
      let h = -3.8 + 3.62 * shelf + 0.5 * land + u * 1.25 - dn[i] * 2.2;
      h += land * (0.32 * fbm(x / 64, y / 64, seed + 41, 4) + old * 0.9);
      h += (0.05 + 0.2 * land) * fbm(x / 15, y / 15, seed + 31, 4);
      H[i] = h;
      U[i] = h > -0.4 ? u * 0.03 + old * land * 0.012 : 0;
      // crystalline rock where a range has been lifted fast enough to be stripped to its granite core, or where old
      // ranges are worn to their roots; any land on an oceanic plate far from a continent is volcanic
      crys[i] = Math.max(sstep(0.7, 1.3, u), sstep(0.3, 0.55, old));
      volRaw[i] = volRaw[i] * 0.9 + 0.65 * (1 - contRaw[i]) * (1 - cont[i]);
    }
    // hotspots: a volcano over each, and older, sunken islands trailing behind along the plate's drift
    for (let k = 0; k < 3; k++) {
      const hx = R.range(20, N - 20), hy = R.range(20, N - 20), p = plates[pid[(hy | 0) * N + (hx | 0)]];
      for (let s = 0; s < 6; s++) {
        const px = hx - p.vx * s * 10, py = hy - p.vy * s * 10, amp = (p.cont ? 1.2 : 4.2) - s * 0.65, rad = 2.4 + s * 0.4;
        if (amp <= 0) break;
        for (let y = Math.max(0, (py - rad * 3) | 0); y < Math.min(N, py + rad * 3); y++) for (let x = Math.max(0, (px - rad * 3) | 0); x < Math.min(N, px + rad * 3); x++) {
          const g = Math.exp(-((x - px) ** 2 + (y - py) ** 2) / (rad * rad));
          H[y * N + x] += amp * g;
          volRaw[y * N + x] += 1.6 * Math.exp(-((x - px) ** 2 + (y - py) ** 2) / (rad * rad * 2.2)); // a shield of basalt flows
          if (s === 0) U[y * N + x] += 0.04 * g;
        }
      }
    }
    w.volc = blur(volRaw, N, N, 2, 1);
    w.H0 = Float32Array.from(H);
    w.progress = 1; w.done.Plates = true;
    yield;

    // ---- 2. erosion: stream power with uplift, solved implicitly (Braun & Willett 2013, as Cordonnier et al. 2016) ----
    w.stage = 'Erosion';
    const F = w.F = new Float64Array(NN), rec = w.rec = new Int32Array(NN), ord = w.ord = new Int32Array(NN);
    const A = w.A = new Float64Array(NN), outlet = new Uint8Array(NN), ocean = w.ocean = new Uint8Array(NN);
    const heap = new Heap(NN + 16), done = new Uint8Array(NN);
    const findOcean = () => {
      // the sea: below sea level and joined to the map's edge (a basin below sea level inland becomes a lake)
      ocean.fill(0);
      const q = new Int32Array(NN);
      let qt = 0;
      for (let i = 0; i < N; i++) for (const j of [i, (N - 1) * N + i, i * N, i * N + N - 1]) if (H[j] < 0 && !ocean[j]) { ocean[j] = 1; q[qt++] = j; }
      for (let qh = 0; qh < qt; qh++) {
        const i = q[qh], x = i % N, y = (i / N) | 0;
        if (x > 0 && !ocean[i - 1] && H[i - 1] < 0) { ocean[i - 1] = 1; q[qt++] = i - 1; }
        if (x < N - 1 && !ocean[i + 1] && H[i + 1] < 0) { ocean[i + 1] = 1; q[qt++] = i + 1; }
        if (y > 0 && !ocean[i - N] && H[i - N] < 0) { ocean[i - N] = 1; q[qt++] = i - N; }
        if (y < N - 1 && !ocean[i + N] && H[i + N] < 0) { ocean[i + N] = 1; q[qt++] = i + N; }
      }
      for (let i = 0; i < NN; i++) { const x = i % N, y = (i / N) | 0; outlet[i] = ocean[i] || x === 0 || y === 0 || x === N - 1 || y === N - 1 ? 1 : 0; }
    };
    const drain = () => {
      findOcean();
      const cnt = flood(N, N, H, outlet, F, rec, ord, heap, done);
      A.fill(1);
      for (let k = cnt - 1; k >= 0; k--) { const i = ord[k], r = rec[i]; if (r !== i) A[r] += A[i]; }
      return cnt;
    };
    const ITER = 16, KDT = 0.011;
    for (let it = 0; it < ITER; it++) {
      const cnt = drain();
      for (let k = 0; k < cnt; k++) {
        const i = ord[k];
        if (outlet[i]) continue;
        const r = rec[i], dx = (r % N) - (i % N), dist = dx && r - i !== dx ? Math.SQRT2 : 1;
        const f = KDT * Math.sqrt(A[i]) / dist, upl = U[i];
        let hn = (H[i] + upl + f * H[r]) / (1 + f);
        // in a pit, sediment settles instead: the basin floor creeps up toward its spill level, so only the deep
        // pits are still lakes at the end and the rest are flat alluvial plains
        if (hn > H[i] + upl) hn = H[i] + upl + (F[i] - H[i]) * 0.14;
        H[i] = hn;
      }
      w.progress = (it + 1) / (ITER + 1); w.iter = it + 1;
      yield;
    }
    // talus: anything steeper than the angle of repose slumps toward its lowest neighbor
    const TAL = 0.45;
    for (let p = 0; p < 4; p++) {
      for (let i = 0; i < NN; i++) {
        if (ocean[i]) continue;
        const x = i % N, y = (i / N) | 0;
        let lo = -1, ld = 0;
        for (let d = 0; d < 8; d++) {
          const nx = x + DX8[d], ny = y + DY8[d];
          if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
          const j = ny * N + nx, diff = H[i] - H[j] - TAL * DL8[d];
          if (diff > ld) { ld = diff; lo = j; }
        }
        if (lo >= 0) { H[i] -= ld * 0.25; H[lo] += ld * 0.25; }
      }
    }
    w.progress = 1; w.done.Erosion = true;
    yield;

    // ---- 3. water: drainage on the final land, lakes in the filled pits ----
    w.stage = 'Water';
    const cnt = drain();
    const slope = w.slope = new Float32Array(NN), relief = w.relief = new Float32Array(NN);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, xa = Math.max(0, x - 1), xb = Math.min(N - 1, x + 1), ya = Math.max(0, y - 1), yb = Math.min(N - 1, y + 1);
      slope[i] = Math.hypot(H[y * N + xb] - H[y * N + xa], H[yb * N + x] - H[ya * N + x]) / (2 * CELL_KM);
      let lo = 1e9, hi = -1e9;
      for (let j = ya; j <= yb; j++) for (let k = xa; k <= xb; k++) { const h = Math.max(0, H[j * N + k]); if (h < lo) lo = h; if (h > hi) hi = h; }
      relief[i] = hi - lo;
    }
    const lakeId = w.lakeId = new Int32Array(NN).fill(-1), lakes = w.lakes = [];
    {
      const q = new Int32Array(NN);
      for (let s = 0; s < NN; s++) {
        if (ocean[s] || lakeId[s] >= 0 || F[s] - H[s] < 0.004) continue;
        const L = { id: lakes.length, n: 0, out: s, level: F[s], salt: false, cells: [] };
        let qt = 0; q[qt++] = s; lakeId[s] = L.id;
        for (let qh = 0; qh < qt; qh++) {
          const i = q[qh], x = i % N, y = (i / N) | 0;
          L.cells.push(i);
          if (A[i] > A[L.out]) L.out = i;
          if (F[i] > L.level) L.level = F[i];
          for (let d = 0; d < 8; d++) {
            const nx = x + DX8[d], ny = y + DY8[d];
            if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
            const j = ny * N + nx;
            if (lakeId[j] < 0 && !ocean[j] && F[j] - H[j] >= 0.004) { lakeId[j] = L.id; q[qt++] = j; }
          }
        }
        L.n = L.cells.length;
        lakes.push(L);
      }
    }
    // what water stands on each cell: 0 none, 1 a lake, 2 a salt flat, 3 a salt lake (the last two once there is rain)
    const wtr = w.wtr = new Uint8Array(NN);
    for (let i = 0; i < NN; i++) wtr[i] = lakeId[i] >= 0 ? 1 : 0;
    w.Q = A; // until there is rain, every cell gives the same
    w.QR = 160;
    w.progress = 1; w.done.Water = true;
    yield;

    // ---- 4. climate: heat from latitude and height, rain carried by the wind ----
    w.stage = 'Climate';
    const T = w.T = new Float32Array(NN), Pr = w.P = new Float32Array(NN);
    const lat = y => 60 - 54 * y / (N - 1); // the map runs from 60 degrees north at the top to 6 at the bottom
    w.lat = lat;
    for (let i = 0; i < NN; i++) {
      const la = lat((i / N) | 0);
      T[i] = 27.5 - 0.62 * Math.max(0, la - 12) - 6.5 * Math.max(0, H[i]);
    }
    const wet = i => ocean[i] || wtr[i] === 1;
    // one sweep of moist air along the rows, west to east (dir 1) or east to west (dir -1): it picks up water over
    // the sea, rains a little everywhere and a lot where it is forced up a slope, and recycles some over land
    const sweep = dir => {
      const out = new Float32Array(NN), m = new Float32Array(N).fill(0.5), t = new Float32Array(N);
      for (let s = 0; s < N; s++) {
        const x = dir > 0 ? s : N - 1 - s, xp = x - dir;
        for (let y = 0; y < N; y++) {
          const i = y * N + x;
          if (wet(i)) {
            const ev = (ocean[i] ? 0.2 : 0.07) * clamp((T[i] + 8) / 32, 0.08, 1);
            m[y] += (1 - m[y]) * ev;
            out[i] = m[y] * 0.03;
          } else {
            const rise = xp >= 0 && xp < N ? Math.max(0, Math.max(0, H[i]) - Math.max(0, H[y * N + xp])) : 0;
            const p = m[y] * clamp(0.022 + 1.9 * rise, 0, 0.7);
            m[y] -= p * 0.68; // about a third of what falls on land comes back up from the leaves
            out[i] = p;
          }
        }
        t.set(m);
        for (let y = 1; y < N - 1; y++) m[y] = 0.25 * t[y - 1] + 0.5 * t[y] + 0.25 * t[y + 1];
      }
      return out;
    };
    const rw = sweep(1);
    yield;
    const re = sweep(-1);
    for (let y = 0; y < N; y++) {
      const la = lat(y), west = sstep(25, 35, la);
      // the belts: wet under the tropical rain belt, dry under the subtropical highs, wet again under the westerlies
      const belt = 0.4 + 1.5 * Math.exp(-(((la - 7) / 9) ** 2)) + 0.6 * Math.exp(-(((la - 52) / 14) ** 2));
      for (let x = 0; x < N; x++) { const i = y * N + x; Pr[i] = (west * rw[i] + (1 - west) * re[i]) * belt; }
    }
    {
      const b = blur(Pr, N, N, 2, 2);
      const land = [];
      for (let i = 0; i < NN; i++) if (!ocean[i]) land.push(b[i]);
      land.sort((a, c) => a - c);
      const k = land.length ? 170 / Math.max(1e-6, land[Math.floor(land.length * 0.88)]) : 1;
      for (let i = 0; i < NN; i++) Pr[i] = 420 * Math.tanh(b[i] * k / 420); // centimeters a year, the wettest slopes leveling off
    }
    // runoff: what rain the warmth doesn't take back, carried down the drainage graph and lost along dry reaches
    const Q = w.Q = new Float64Array(NN);
    const pet = i => clamp(25 + 3.4 * T[i], 8, 150);
    for (let i = 0; i < NN; i++) Q[i] = ocean[i] ? 0 : Math.max(0, Pr[i] - 0.55 * pet(i)) * 0.9 + 0.1 * Pr[i];
    for (let k = cnt - 1; k >= 0; k--) {
      const i = ord[k], r = rec[i];
      if (r === i) continue;
      const loss = 0.015 * clamp((pet(i) - Pr[i]) / pet(i), 0, 1);
      Q[r] += Q[i] * (1 - loss);
    }
    // endorheic basins: a lake whose inflow can't match its evaporation never spills. It shrinks to the area that
    // balances its inflow, a salt lake in the bottom of the basin ringed by salt flats, and the rivers below it
    // lose that water. Upstream lakes first, as their losses reach the lakes below.
    const pos = new Int32Array(NN);
    for (let k = 0; k < cnt; k++) pos[ord[k]] = k;
    lakes.sort((a, b) => pos[b.out] - pos[a.out]);
    for (const L of lakes) {
      const demand = L.n * pet(L.out) * 1.1;
      const inflow = Q[L.out];
      if (inflow >= demand) continue;
      L.salt = true;
      const cells = L.cells.slice().sort((a, b) => H[a] - H[b]), keep = Math.floor(L.n * inflow / demand);
      const top = keep ? H[cells[keep - 1]] : H[cells[0]];
      for (let k = 0; k < cells.length; k++) {
        const c = cells[k];
        if (k < keep) wtr[c] = 3;
        else if (k < keep * 2 + 3 || H[c] < top + 0.012) wtr[c] = 2;
        else { wtr[c] = 0; lakeId[c] = -1; }
      }
      for (let c = rec[L.out], guard = 0; c !== rec[c] && guard < NN; c = rec[c], guard++) Q[c] = Math.max(0, Q[c] - inflow);
    }
    lakes.sort((a, b) => a.id - b.id);
    w.QR = 9000; // a river: the runoff of about ninety cells at a meter a year
    const river = w.river = new Uint8Array(NN);
    for (let i = 0; i < NN; i++) river[i] = !ocean[i] && !wtr[i] && Q[i] > w.QR ? 1 : 0;
    // the surface of standing water on each cell, for the regions
    const wl = w.wl = new Float32Array(NN).fill(-1e9);
    for (const L of lakes) {
      let top = -1e9;
      for (const c of L.cells) if (wtr[c] === 3) top = Math.max(top, H[c]);
      for (const c of L.cells) if (wtr[c] === 1) wl[c] = L.level; else if (wtr[c] === 3) wl[c] = top + 0.003;
    }
    w.progress = 1; w.done.Climate = true;
    yield;

    // ---- 5. biomes (Whittaker, from mean heat and rain) and soils (deep on the flat, thin on the steep) ----
    w.stage = 'Biomes';
    const biome = w.biome = new Uint8Array(NN), soil = w.soil = new Uint8Array(NN), depth = w.depth = new Float32Array(NN), rock = w.rock = new Uint8Array(NN).fill(255);
    const nearRiver = distField(river, N, N);
    w.riverDist = nearRiver;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (ocean[i]) { biome[i] = 255; soil[i] = 255; continue; }
      const t = T[i], p = Pr[i], h = H[i], s = slope[i];
      let coast = false;
      for (let d = 0; d < 8 && !coast; d++) { const nx = x + DX8[d], ny = y + DY8[d]; if (nx >= 0 && ny >= 0 && nx < N && ny < N && ocean[ny * N + nx]) coast = true; }
      const twi = Math.log(A[i] / (s * 40 + 0.004));
      let b;
      if (t < -10 || (h > 2.1 && t < -6)) b = ICE;
      else if (h > 1.4 && t < -1.5) b = ALPINE;
      else if (coast && h < 0.12 && s < 0.03 && t > -3) b = BEACH;
      else if (p > 95 && t > 2 && s < 0.008 && twi > 7.5) b = SWAMP;
      else b = whittaker(t, p);
      biome[i] = b;
      rock[i] = rockOf(seed, w.volc[i], w.crys[i], foldAt(x + 0.5, y + 0.5, seed), h);
      // Cordonnier et al.: humus depth e^(-s^2 / (3 ln 2)), half as deep on a 30 degree slope; a world cell hides
      // steeper ground inside it, so its slope counts four times
      const dep = Math.exp(-((s * 4) ** 2) / (3 * Math.LN2));
      depth[i] = dep;
      let so;
      if (b === ICE || b === ALPINE) so = ROCK;
      else if (b === DESERT || b === BEACH) so = nearRiver.d[i] < 2 && s < 0.02 ? ALLUVIUM : SAND;
      else if (b === SWAMP || (b === TUNDRA && p > 40)) so = PEAT;
      else if (nearRiver.d[i] < 2.5 && s < 0.02 && h < 0.9) so = ALLUVIUM;
      else if (dep < 0.5 || h > 1.6) so = THIN;
      else if (p > 130 && s < 0.012) so = CLAY;
      else so = LOAM;
      soil[i] = so;
    }
    w.progress = 1; w.done.Biomes = true;
    yield;

    // ---- 6. settlements: score every cell the way people chose sites, keep the best few apart from each other ----
    w.stage = 'Settlements';
    const fresh = new Uint8Array(NN), coastM = new Uint8Array(NN), woods = new Uint8Array(NN), route = new Uint8Array(NN);
    for (let i = 0; i < NN; i++) {
      fresh[i] = river[i] || wtr[i] === 1 ? 1 : 0;
      coastM[i] = ocean[i];
      const b = biome[i];
      woods[i] = b === FOREST || b === TAIGA || b === JUNGLE || b === SWAMP ? 1 : 0;
    }
    // fords (a modest river on gentle ground) and confluences (two rivers meeting) draw roads and so villages
    for (let i = 0; i < NN; i++) {
      if (!river[i]) continue;
      let ins = 0;
      const x = i % N, y = (i / N) | 0;
      for (let d = 0; d < 8; d++) { const nx = x + DX8[d], ny = y + DY8[d]; if (nx >= 0 && ny >= 0 && nx < N && ny < N) { const j = ny * N + nx; if (river[j] && rec[j] === i) ins++; } }
      if (ins >= 2 || (Q[i] < w.QR * 5 && slope[i] < 0.01)) route[i] = 1;
    }
    const dFresh = distField(fresh, N, N), dCoast = distField(coastM, N, N), dWood = distField(woods, N, N), dRoute = distField(route, N, N);
    yield;
    const arable0 = new Float32Array(NN);
    const SOIL_Q = [1, 0.85, 0.6, 0.25, 0.12, 0.3, 0];
    const BIOME_Q = [0, 0.1, 0.45, 0.9, 1, 0.25, 0.7, 0.55, 0.3, 0.2, 0.05];
    for (let i = 0; i < NN; i++) arable0[i] = ocean[i] || wtr[i] ? 0 : SOIL_Q[soil[i]] * (soil[i] === ALLUVIUM ? 1 : BIOME_Q[biome[i]]);
    const arable = blur(arable0, N, N, 3, 1);
    const score = w.score = new Float32Array(NN);
    for (let y = 2; y < N - 2; y++) for (let x = 2; x < N - 2; x++) {
      const i = y * N + x, b = biome[i];
      if (ocean[i] || wtr[i] || river[i] || b === ICE || b === ALPINE || slope[i] > 0.1 || T[i] < -6) continue;
      const df = dFresh.d[i], dc = dCoast.d[i];
      const water = Math.max(df < 1.5 ? 0.85 : df <= 3 ? 1 : clamp(1 - (df - 3) / 6, 0, 1), dc < 3 ? 0.95 : 0); // a river, a lake, or a shore to fish from
      // out of the floodplain: higher than the river it is near
      const src = dFresh.s[i], above = src >= 0 ? H[i] - H[src] : 1;
      const dry = df > 3.5 ? 1 : sstep(0.004, 0.04, above);
      const flat = Math.exp(-((slope[i] / 0.025) ** 2));
      // shelter: the share of the upwind half-circle that stands higher (the lee of hills)
      const la = lat(y), upx = la > 30 ? -1 : 1;
      let hi = 0, nS = 0;
      for (let a = -2; a <= 2; a++) for (const r of [3, 6]) {
        const ang = a * 0.65, sx = Math.round(x + upx * Math.cos(ang) * r), sy = Math.round(y + Math.sin(ang) * r);
        if (sx < 0 || sy < 0 || sx >= N || sy >= N) continue;
        nS++; if (H[sy * N + sx] > H[i] + 0.06) hi++;
      }
      const shelter = nS ? hi / nS : 0;
      // the sun: ground falling away to the south (the bottom of the map) is the adret
      const south = clamp((H[i - N] - H[i + N]) / 0.08, -1, 1);
      const sun = 0.5 + 0.5 * south;
      const routeB = clamp(1 - dRoute.d[i] / 3, 0, 1);
      const wood = clamp(1 - (dWood.d[i] - 1) / 5, 0, 1);
      const comfort = sstep(-5, 6, T[i]) * (1 - sstep(27, 33, T[i]));
      const ar = arable[i];
      const s = (1.5 * water + 1.0 * dry + 1.1 * flat + 1.5 * ar + 0.7 * shelter + 0.5 * sun + 0.6 * routeB + 0.5 * wood) / 7.4 * comfort;
      score[i] = water < 0.05 ? s * 0.3 : s;
    }
    const towns = w.towns = [];
    {
      const cand = [];
      for (let i = 0; i < NN; i++) if (score[i] > 0.4) cand.push(i);
      cand.sort((a, b) => score[b] - score[a]);
      const take = (i, max) => {
        if (towns.length >= max) return;
        const x = i % N, y = (i / N) | 0;
        if (towns.some(t => Math.hypot(t.x - x, t.y - y) < 19)) return;
        towns.push({ x, y, i, score: score[i], big: towns.length < 4 });
      };
      for (const i of cand) take(i, 13);
      // fishing villages live by the sea, not the soil: the last three places go to the best sites on a shore
      for (const i of cand) if (dCoast.d[i] < 2.5) take(i, 16);
      for (const i of cand) take(i, 16);
    }
    w.progress = 1; w.done.Settlements = true;
    yield;

    // ---- 7. paths: roads between villages by least cost, then game trails from cover to water ----
    w.stage = 'Paths';
    const wear = w.wear = new Float32Array(NN), trail = w.trail = new Float32Array(NN);
    const roads = w.roads = [], trails = w.trails = [];
    const astar = makeAStar(N, N);
    const TERRAIN = [3, 1.3, 1.5, 1.4, 1, 1.25, 1.1, 1.9, 2.6, 1.1, 2];
    const stepCost = (wr, beta) => (i, j, k) => {
      if (ocean[j] || wtr[j] & 1) return Infinity;
      const len = DL16[k], S = (Math.max(0, H[j]) - Math.max(0, H[i])) / (len * CELL_KM) * 2.5;
      let c = len * tobler(S) * TERRAIN[biome[j]] * (1 - beta * Math.min(1, wr[j]));
      // rivers: ford a small one, bridge a big one; a crossing already made is cheap (Galin et al. 2010)
      const x = i % N, y = (i / N) | 0, mids = midCells(x, y, k, N);
      const cross = cell => river[cell] ? (Q[cell] > w.QR * 6 ? 14 : 4) * (wr[cell] > 0 ? 0.15 : 1) : 0;
      c += cross(j);
      if (mids) { if (ocean[mids[0]] || wtr[mids[0]] & 1 || ocean[mids[1]] || wtr[mids[1]] & 1) return Infinity; c += Math.max(cross(mids[0]), cross(mids[1])); }
      return c;
    };
    const lay = (path, wr, amt) => {
      for (let k = 0; k < path.length; k++) {
        const i = path[k];
        wr[i] = Math.min(2, wr[i] + amt);
        if (k) { // fill the cell a knight move skipped, so the road draws unbroken
          const a = path[k - 1], dx = (i % N) - (a % N), dy = ((i / N) | 0) - ((a / N) | 0);
          if (Math.abs(dx) === 2 || Math.abs(dy) === 2) { const m = ((a / N | 0) + Math.round(dy / 2)) * N + (a % N) + Math.round(dx / 2); wr[m] = Math.min(2, wr[m] + amt); }
        }
      }
    };
    // which pairs to join: a Gabriel graph over the villages (Galin et al. 2011 prune the complete graph much like this)
    const edges = [];
    for (let a = 0; a < towns.length; a++) for (let b = a + 1; b < towns.length; b++) {
      const A0 = towns[a], B0 = towns[b], dab = (A0.x - B0.x) ** 2 + (A0.y - B0.y) ** 2;
      if (dab > 95 * 95) continue;
      let ok = true;
      for (let c = 0; c < towns.length && ok; c++) {
        if (c === a || c === b) continue;
        const C = towns[c];
        if ((A0.x - C.x) ** 2 + (A0.y - C.y) ** 2 + (B0.x - C.x) ** 2 + (B0.y - C.y) ** 2 < dab) ok = false;
      }
      if (ok) edges.push([a, b, dab - (A0.big && B0.big ? 1e5 : 0)]);
    }
    edges.sort((p, q) => p[2] - q[2]);
    const roadCost = stepCost(wear, 0.6);
    for (const [a, b] of edges) {
      const A0 = towns[a], B0 = towns[b];
      const path = astar(A0.i, B0.i, roadCost, j => Math.hypot((j % N) - B0.x, ((j / N) | 0) - B0.y) * 0.5, 60000);
      if (path) { lay(path, wear, 1); roads.push({ a, b, path }); }
      w.progress = roads.length / Math.max(1, edges.length) * 0.7;
      yield;
    }
    // game trails (Helbing's active walkers, cheaply): from good cover to the nearest water, each trip preferring
    // ground earlier trips have worn, so the trails gather into trunks
    const TR = Kit.rng(seed * 31 + 5), trailCost = stepCost(trail, 0.75);
    for (let n = 0, tries = 0; n < 60 && tries < 600; tries++) {
      const i = Math.floor(TR() * NN), b = biome[i];
      if (ocean[i] || !(b === FOREST || b === TAIGA || b === SAVANNA || b === GRASS || b === JUNGLE) || dFresh.d[i] > 9 || dFresh.d[i] < 3) continue;
      const goal = dFresh.s[i];
      if (goal < 0) continue;
      // aim for the dry cell beside the water
      const gx = goal % N, gy = (goal / N) | 0, ix = i % N, iy = (i / N) | 0;
      const ddx = Math.sign(ix - gx), ddy = Math.sign(iy - gy), bank = (gy + ddy) * N + gx + ddx;
      if (bank < 0 || bank >= NN || ocean[bank] || wtr[bank]) continue;
      const path = astar(i, bank, trailCost, j => Math.hypot((j % N) - (bank % N), ((j / N) | 0) - ((bank / N) | 0)) * 0.3, 3000);
      if (path) { lay(path, trail, 0.5); trails.push(path); n++; }
    }
    w.progress = 1; w.done.Paths = true; w.stage = 'Done';
    yield;
  }

  // ===================================================================================================
  // the world map, one picture per tab
  // ===================================================================================================
  const HYPSO = ramp([[-4.5, '#0c1b3d'], [-2.5, '#173e74'], [-0.4, '#2a68a6'], [-0.02, '#5aa3cf'], [0, '#5d9548'], [0.25, '#86ad55'], [0.7, '#c2b366'],
    [1.2, '#a8835a'], [1.9, '#8a7a72'], [2.6, '#b8b4b4'], [3.2, '#f4f4f6']], -4.5, 3.6, 512);
  const TEMP = ramp([[-24, '#3b2a6e'], [-12, '#4a63b8'], [-3, '#8fc4e8'], [3, '#d8eef0'], [9, '#bfe08a'], [15, '#f0dc6a'], [21, '#f0a050'], [27, '#d8583a'], [32, '#8e2034']], -24, 32, 256);
  const RAIN = ramp([[0, '#9c5a2e'], [20, '#d8a858'], [45, '#ecdc8a'], [80, '#9ccf6a'], [130, '#3f9a52'], [200, '#2a8a8a'], [300, '#1f4f9a']], 0, 300, 256);
  const TABS = ['Height', 'Plates', 'Erosion', 'Water', 'Temp', 'Rain', 'Biomes', 'Soil', 'Rock', 'Final'];
  const TAB_NEEDS = { Height: 'Plates', Plates: 'Plates', Erosion: 'Erosion', Water: 'Water', Temp: 'Climate', Rain: 'Climate', Biomes: 'Biomes', Soil: 'Biomes', Rock: 'Biomes', Final: 'Biomes' };
  // which tab shows each stage best while it runs
  const STAGE_TAB = { Plates: 'Plates', Erosion: 'Erosion', Water: 'Water', Climate: 'Rain', Biomes: 'Biomes', Settlements: 'Final', Paths: 'Final', Done: 'Final' };

  // hill shading from the northwest, in four steps with an ordered dither between them
  function shadeAt(Hs, i, x, y, k) {
    const a = Hs[i - (x > 0 ? 1 : 0)], b = Hs[i - (y > 0 ? N : 0)];
    const s = clamp(1 + (Math.max(0, Hs[i]) * 2 - Math.max(0, a) - Math.max(0, b)) * k, 0.55, 1.5);
    const q = clamp(Math.floor((s - 0.7) / 0.15 + bay(x, y)), 0, 4);
    return [0.72, 0.86, 1, 1.12, 1.22][q];
  }
  function paintWorld(w, tab, px) {
    const H = w.H, ok = n => w.done[n];
    // a tab whose stage hasn't made its fields yet shows the height instead
    if (((tab === 'Soil' || tab === 'Rock') && !ok('Biomes')) || ((tab === 'Biomes' || tab === 'Final') && !w.biome) || (tab === 'Water' && !w.wtr) || ((tab === 'Temp' || tab === 'Rain') && !w.P)) tab = 'Height';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      let c;
      if (tab === 'Height' || (!ok('Plates') && tab !== 'Plates')) {
        const Hs = w.H0 || H;
        c = HYPSO.at(Hs[i]);
        if (Hs[i] > 0) c = shadeC(c, shadeAt(Hs, i, x, y, 2.2));
      } else if (tab === 'Plates') {
        const p = w.pid[i], pl = w.plates[p];
        const hue = hash2(p, 7, w.seed);
        c = pl.cont ? mixC(P('#b89a62'), P('#7aa05a'), hue) : mixC(P('#2c4f86'), P('#3b6aa0'), hue);
        if (w.bd[i] < 1.1) { const v = w.bconv[i]; c = v > 0.15 ? P('#ff5a3a') : v < -0.15 ? P('#6ff0f0') : P('#f0e070'); }
        else if (w.H0 && w.H0[i] > 0) c = shadeC(c, shadeAt(w.H0, i, x, y, 1.6));
      } else if (tab === 'Erosion') {
        const v = H[i];
        if (v < 0 && w.ocean && w.ocean[i]) c = HYPSO.at(v);
        else {
          c = mixC(P('#5f7a52'), P('#e8e2d0'), clamp(v / 2.6, 0, 1));
          c = shadeC(c, shadeAt(H, i, x, y, 3));
          if (w.A) { const a = Math.log(w.A[i]) / Math.log(4000); if (a > 0.45) c = mixC(c, P('#2f7fc0'), clamp((a - 0.45) * 2.2, 0, 1)); }
        }
      } else if (tab === 'Rock' && ok('Biomes')) {
        if (w.ocean[i]) c = mixC(HYPSO.at(H[i]), P('#1d3f74'), 0.4);
        else {
          const r = w.rock[i];
          c = shadeC(ROCK_COL[r], shadeAt(H, i, x, y, 2.4));
          // karst: limestone with rain enough to dissolve it, marked with the dots of its sinkholes
          if (r === R_LIME && w.P[i] > 45 && hash2(x, y, w.seed + 911) < 0.16) c = P('#5a5040');
          if (w.wtr[i]) c = w.wtr[i] === 1 ? LAKE : SALT;
          else if (w.river[i]) c = RIVER;
        }
      } else if (tab === 'Water' || tab === 'Final' || tab === 'Biomes' || tab === 'Soil' || tab === 'Rock') {
        if (w.ocean[i]) {
          const d = H[i];
          c = d > -0.25 ? (d > -0.06 ? SHALLOW : SHELF) : d > -2 ? OCEAN : OCEAN_DEEP;
        } else if (w.wtr[i]) {
          const k = w.wtr[i];
          c = k === 1 ? LAKE : k === 3 ? SALT_LAKE : SALT;
        } else {
          if (tab === 'Water') c = mixC(P('#4f5a48'), P('#a8a294'), clamp(H[i] / 2.4, 0, 1));
          else if (tab === 'Soil') c = SOIL_COL[w.soil[i]];
          else c = BIOME_COL[w.biome[i]];
          c = shadeC(c, shadeAt(H, i, x, y, tab === 'Water' ? 3 : 2.4));
          if (w.Q) {
            const q = w.Q[i], qr = w.QR;
            if (q > qr) c = tab === 'Water' ? P('#5ab4f0') : q > qr * 8 ? RIVER_BIG : RIVER;
            else if (q > qr * 0.3 && tab === 'Water') c = mixC(c, P('#5ab4f0'), 0.45);
          }
        }
        if (tab === 'Final' && w.wear && !w.ocean[i]) {
          if (w.wear[i] > 0) c = w.river[i] ? P('#8a6a44') : ROAD;
          else if (w.trail[i] >= 1) c = mixC(c, TRAIL, 0.55);
        }
      } else if (tab === 'Temp') {
        const t = w.T[i];
        c = TEMP.at(t);
        if (w.ocean[i]) c = shadeC(c, 0.8);
        const t2 = x < N - 1 ? w.T[i + 1] : t, t3 = y < N - 1 ? w.T[i + N] : t;
        if (Math.floor(t / 5) !== Math.floor(t2 / 5) || Math.floor(t / 5) !== Math.floor(t3 / 5)) c = shadeC(c, 0.55);
        else if (!w.ocean[i]) c = shadeC(c, shadeAt(H, i, x, y, 1.5));
      } else if (tab === 'Rain') {
        c = RAIN.at(w.P[i]);
        if (w.ocean[i]) c = mixC(c, P('#1d3f74'), 0.55);
        else c = shadeC(c, shadeAt(H, i, x, y, 2));
      }
      px[i] = c;
    }
    // widen the big rivers to two cells
    if ((tab === 'Final' || tab === 'Water' || tab === 'Biomes') && w.Q && w.river) {
      for (let i = 0; i < NN; i++) if (w.river[i] && w.Q[i] > w.QR * 8) { const j = i + 1; if (j % N && !w.ocean[j] && !w.wtr[j]) px[j] = tab === 'Water' ? P('#5ab4f0') : RIVER_BIG; }
    }
  }

  // ===================================================================================================
  // the region: a world cell and its neighbors, 64 x 48 tiles of 8 px (10 tiles to a cell), in 3/4 oblique
  // ===================================================================================================
  const RW = 64, RH = 48, TS = 8, FH = 4, TPC = 10, RN = RW * RH, TILE_KM = CELL_KM / TPC;
  // ground types: the biomes, then bare rock and salt
  const G_ROCK = 11, G_SALT = 12;
  const GROUND = [
    ['#a9bad2', '#dfe8f2', '#ffffff'], ['#7b8a72', '#98a48a', '#b6bea6'], ['#35573f', '#466d4c', '#5c835a'], ['#3e7433', '#56913f', '#74ab4f'],
    ['#7c9a3e', '#9cba50', '#bdd06a'], ['#c49e5e', '#dcbd7c', '#eed49a'], ['#a8984a', '#c4b35c', '#dacb78'], ['#1f5a2b', '#2c7035', '#3f8642'],
    ['#46593a', '#58703f', '#6e844a'], ['#d4ba7e', '#e9d59e', '#f6e8bd'], ['#77736c', '#928e84', '#aca89c'], ['#5f5b60', '#7a767c', '#95919a'],
    ['#d8d0bc', '#ece4d2', '#faf6ea'],
  ].map(r => r.map(P));
  // rock strata for the cliff faces, by the rock under the region
  const STRATA = {
    sedimentary: ['#8a6a4a', '#a3805a', '#76593e', '#b8936a'], granite: ['#6c6870', '#86828c', '#5a5660', '#9e9aa4'],
    limestone: ['#a39b86', '#bcb49c', '#8b8471', '#cfc7b0'], redrock: ['#9c5638', '#b86c45', '#84462e', '#cc8558'],
    basalt: ['#4a4650', '#5e5a66', '#3e3a44', '#726e7a'],
  };
  const STRATA_R = [STRATA.sedimentary, STRATA.redrock, STRATA.limestone, STRATA.granite, STRATA.basalt].map(a => a.map(P)); // by rock
  const W_SEA = 1, W_LAKE = 2, W_RIVER = 3, W_POND = 4;
  // F_SINK: a sinkhole, or a lava tube's skylight; F_MOUTH: a cave mouth in the cliff face; F_SPRING: a karst spring
  const F_PATH = 1, F_FIELD = 2, F_GREEN = 4, F_HOUSE = 8, F_SINK = 16, F_MOUTH = 32, F_BRIDGE = 64, F_SPRING = 128;
  const K_WET = 1, K_DRY = 2, K_LAVA = 3, K_SEA = 4, K_SHELTER = 5; // kinds of cave passage
  const FORM_NAME = { street: 'street village', strip: 'forest strip village', green: 'green village', anger: 'Anger village', hill: 'hill village', shore: 'fishing hamlet' };
  const INK = P('#1a1420'), FOAM = P('#d8f0f6');
  const WATER_C = { shallow: P('#5aaed6'), mid: P('#3a8cc6'), deep: P('#26679f'), river: P('#3c90cc'), riverLight: P('#6cc0e4'), salt: P('#6cb8bc') };
  const PATHC = [0, P('#a08a62'), P('#a47c4c'), P('#9a7246')], PATH_LIGHT = P('#c4a070'), PATH_DARK = P('#6e4e30');
  const CROPS = [[P('#d8b44c'), P('#b8922e')], [P('#7aa844'), P('#5a8a30')], [P('#8a6038'), P('#6a4628')], [P('#c8c050'), P('#a09a38')]];

  // sampling the world between cell centers: bilinear, and Catmull-Rom for height so slopes stay smooth
  function bilin(Fd, x, y) {
    const u = clamp(x - 0.5, 0, N - 1.001), v = clamp(y - 0.5, 0, N - 1.001), i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j, k = j * N + i;
    return (Fd[k] * (1 - fx) + Fd[k + 1] * fx) * (1 - fy) + (Fd[k + N] * (1 - fx) + Fd[k + N + 1] * fx) * fy;
  }
  // bilinear over the cells a mask leaves out (the sea), renormalized
  function bilinMask(Fd, mask, x, y) {
    const u = clamp(x - 0.5, 0, N - 1.001), v = clamp(y - 0.5, 0, N - 1.001), i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j, k = j * N + i;
    let s = 0, t = 0;
    const add = (c, wgt) => { if (!mask[c]) { s += Fd[c] * wgt; t += wgt; } };
    add(k, (1 - fx) * (1 - fy)); add(k + 1, fx * (1 - fy)); add(k + N, (1 - fx) * fy); add(k + N + 1, fx * fy);
    return t > 1e-6 ? s / t : bilin(Fd, x, y);
  }
  const crw = (t, a) => { const t2 = t * t, t3 = t2 * t; return a === -1 ? (-t3 + 2 * t2 - t) / 2 : a === 0 ? (3 * t3 - 5 * t2 + 2) / 2 : a === 1 ? (-3 * t3 + 4 * t2 + t) / 2 : (t3 - t2) / 2; };
  function cubic(Fd, x, y) {
    const u = x - 0.5, v = y - 0.5, i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j;
    let s = 0;
    for (let b = -1; b <= 2; b++) {
      const row = clamp(j + b, 0, N - 1) * N;
      let r = 0;
      for (let a = -1; a <= 2; a++) r += crw(fx, a) * Fd[row + clamp(i + a, 0, N - 1)];
      s += crw(fy, b) * r;
    }
    return s;
  }
  // Liebig's law of the minimum over Gain and Cordonnier's viability hats: -1 outside the tolerated range, ramps
  // up to 1 across the ideal range and back down (the falling ramp written as 1 - t, as the paper meant)
  const hat = (c, h) => c < h[0] || c > h[3] ? -1 : c < h[1] ? (c - h[0]) / (h[1] - h[0]) : c <= h[2] ? 1 : 1 - (c - h[2]) / (h[3] - h[2]);
  const rise = (c, h) => c < h[0] ? -1 : c < h[1] ? (c - h[0]) / (h[1] - h[0]) : 1;
  // [Flora id, kind, heat hat (C), rain hat (cm), soil depth rise, wetness rise, spacing (tiles), height (px), abundance]
  const SPECIES = [
    ['oak', 'tree', [3, 8, 16, 22], [35, 60, 220, 1600], [0.3, 0.6], null, 1.45, [20, 26], 1],
    ['maple', 'tree', [2, 6, 14, 19], [50, 80, 260, 1600], [0.35, 0.65], null, 1.3, [19, 24], 0.6],
    ['birch', 'tree', [-7, -3, 9, 15], [25, 40, 220, 1600], [0.05, 0.2], null, 1, [18, 23], 0.7],
    ['aspen', 'tree', [-6, -2, 8, 13], [30, 45, 220, 1600], [0.15, 0.35], null, 1, [18, 22], 0.4],
    ['scotspine', 'tree', [-4, 0, 12, 18], [22, 35, 160, 260], [0.01, 0.08], null, 1.1, [21, 27], 0.8],
    ['spruce', 'tree', [-11, -7, 3, 9], [25, 40, 260, 1600], [0.04, 0.15], null, 1, [21, 28], 1.1],
    ['hemlock', 'tree', [-3, 2, 10, 15], [70, 110, 600, 1600], [0.2, 0.4], null, 1.1, [21, 26], 0.5],
    ['willow', 'tree', [1, 6, 22, 28], [20, 40, 600, 1600], null, [0.6, 0.85], 1.4, [18, 23], 2],
    ['cypress', 'tree', [10, 14, 22, 26], [25, 40, 100, 150], [0.15, 0.35], null, 0.9, [20, 26], 0.4],
    ['cedar', 'tree', [4, 9, 18, 23], [35, 55, 160, 240], [0.08, 0.25], null, 1.4, [20, 25], 0.4],
    ['palm', 'tree', [17, 21, 40, 45], [30, 70, 600, 1600], null, null, 1.3, [22, 28], 0.5],
    ['kapok', 'tree', [18, 22, 40, 45], [100, 150, 600, 1600], [0.3, 0.5], null, 1.6, [26, 32], 0.6],
    ['banyan', 'tree', [18, 22, 40, 45], [95, 140, 600, 1600], null, null, 1.7, [22, 27], 0.5],
    ['treefern', 'tree', [14, 18, 40, 45], [120, 170, 700, 1600], null, null, 0.9, [14, 18], 0.6],
    ['bamboo', 'tree', [15, 19, 40, 45], [100, 150, 600, 1600], null, [0.3, 0.5], 0.9, [18, 24], 0.3],
    ['acacia', 'tree', [15, 19, 40, 45], [15, 28, 110, 150], null, null, 1.9, [17, 22], 1],
    ['baobab', 'tree', [18, 22, 40, 45], [12, 22, 90, 130], [0.2, 0.4], null, 2.3, [20, 25], 0.25],
    ['mangrove', 'tree', [20, 23, 40, 45], [70, 110, 600, 1600], null, [0.88, 0.97], 1.2, [16, 20], 1.4],
    ['saguaro', 'tree', [10, 16, 40, 45], [0, 3, 25, 40], null, null, 1.6, [15, 21], 0.6],
    ['organpipe', 'tree', [14, 18, 40, 45], [0, 3, 22, 35], null, null, 1.6, [14, 18], 0.35],
    ['snag', 'tree', [-9, -5, 8, 14], [25, 35, 600, 1600], null, null, 1.1, [18, 22], 0.06],
    ['berrybush', 'shrub', [-3, 2, 14, 20], [35, 55, 250, 1600], [0.2, 0.4], null, 0.7, [9, 11], 0.6],
    ['shrub', 'shrub', [2, 6, 24, 30], [30, 50, 600, 1600], [0.15, 0.3], null, 0.7, [8, 10], 0.8],
    ['heather', 'shrub', [-13, -8, 5, 11], [15, 30, 600, 1600], null, null, 0.6, [6, 8], 1],
    ['sagebrush', 'shrub', [-4, 3, 22, 30], [3, 9, 40, 60], null, null, 0.7, [7, 9], 1],
    ['pricklypear', 'shrub', [10, 15, 40, 45], [0, 4, 35, 50], null, null, 0.7, [7, 9], 0.7],
    ['barrel', 'shrub', [12, 17, 40, 45], [0, 2, 25, 40], null, null, 0.6, [6, 7], 0.6],
    ['agave', 'shrub', [12, 16, 40, 45], [2, 6, 40, 60], null, null, 0.7, [7, 8], 0.5],
    ['monstera', 'shrub', [18, 21, 40, 45], [120, 170, 700, 1600], null, null, 0.7, [8, 10], 0.8],
    ['fern', 'shrub', [2, 6, 22, 30], [70, 100, 600, 1600], null, [0.2, 0.4], 0.6, [6, 8], 0.6],
    ['cottongrass', 'shrub', [-13, -9, 2, 6], [20, 35, 600, 1600], null, [0.4, 0.6], 0.5, [6, 7], 0.8],
    ['reeds', 'reed', [0, 4, 35, 40], [8, 18, 600, 1600], null, [0.86, 0.95], 0.55, [10, 13], 1],
  ].map(([id, kind, T, Pr, soil, wet, r, sz, ab]) => ({ id, kind, T, P: Pr, soil, wet, r: r * 1.15, sz: sz.map(v => Math.round(v * (kind === 'tree' ? 0.8 : 0.9))), ab }));
  // how much of the ground each biome covers with trees and with shrubs, where the plants are happy
  const COVER = [0, 0.03, 0.6, 0.62, 0.06, 0.1, 0.14, 0.8, 0.4, 0.1, 0.03, 0.01, 0];
  const SHRUB = [0, 0.04, 0.04, 0.04, 0.035, 0.04, 0.05, 0.07, 0.06, 0.03, 0.05, 0.02, 0];

  // ---- sprites: plants from window.Flora (or simple shapes), houses and the well, all as pixel arrays ----
  const spriteCache = new Map();
  function canvasSprite(c, ax, ay) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    return { w: c.width, h: c.height, ax, ay, px: new Uint32Array(d.data.buffer) };
  }
  function blankSprite(w, h, ax, ay) { return { w, h, ax, ay, px: new Uint32Array(w * h) }; }
  const sset = (s, x, y, c) => { if (x >= 0 && y >= 0 && x < s.w && y < s.h) s.px[y * s.w + x] = c; };
  function outline(s) {
    const o = s.px.slice();
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      if (s.px[y * s.w + x]) continue;
      const at = (a, b) => a >= 0 && b >= 0 && a < s.w && b < s.h && s.px[b * s.w + a] !== 0 && s.px[b * s.w + a] !== INK;
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) o[y * s.w + x] = INK;
    }
    s.px = o;
    return s;
  }
  // stand-in plants for when demos/flora.js isn't loaded: a round crown, a cone, a palm, a cactus, a tuft
  function fallbackPlant(sp, size, vi) {
    const H = size, W = Math.max(5, Math.round(H * (sp.kind === 'tree' ? 0.7 : 1.1))) | 1, s = blankSprite(W + 2, H + 2, (W + 2) >> 1, H);
    const mx = s.ax, fy = H, r = Kit.rng(Kit.hashStr(sp.id) + vi);
    const id = sp.id, g3 = ['#2a5a2e', '#3f7a38', '#5c9a46'].map(P);
    const cone = /spruce|pine|hemlock|cedar|cypress/.test(id), cact = /saguaro|organpipe|barrel|prickly|agave/.test(id);
    if (sp.kind === 'reed') { for (let k = -2; k <= 2; k += 2) for (let y = 0; y < H - r.int(0, 3); y++) sset(s, mx + k, fy - y, P('#7a9a40')); return s; }
    if (cact) { for (let y = 0; y < H; y++) for (let x = -1; x <= 1; x++) sset(s, mx + x, fy - y, x < 0 ? P('#5c9a46') : x > 0 ? P('#2a5a2e') : P('#3f7a38')); return outline(s); }
    if (cone) {
      for (let y = 0; y < H - 1; y++) { const hw = Math.round((W / 2 - 1) * y / (H - 1)); for (let x = -hw; x <= hw; x++) sset(s, mx + x, fy - H + 1 + y, x > 0 ? g3[0] : x < -hw / 2 ? g3[2] : g3[1]); }
      sset(s, mx, fy, P('#5a3a20'));
      return outline(s);
    }
    if (sp.kind !== 'tree') { for (let y = 0; y < H; y++) for (let x = -W / 2 + 1; x < W / 2; x++) if ((x * x) / ((W / 2) ** 2) + ((y - H / 2) ** 2) / ((H / 2) ** 2) < 1) sset(s, mx + Math.round(x), fy - y, x + y - H / 2 > 0 ? g3[0] : g3[1]); return outline(s); }
    for (let y = 0; y < H * 0.4; y++) sset(s, mx, fy - y, P('#5a3a20'));
    const cy = fy - H * 0.62, ry = H * 0.36, rx = W / 2 - 1;
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x / rx) ** 2 + (y / ry) ** 2 <= 1) sset(s, Math.round(mx + x), Math.round(cy + y), x / rx + y / ry > 0.5 ? g3[0] : x / rx + y / ry < -0.6 ? g3[2] : g3[1]);
    return outline(s);
  }
  function plantSprite(sp, vi, season) {
    const size = Math.round(sp.sz[0] + (sp.sz[1] - sp.sz[0]) * (vi + 0.5) / 3), key = sp.id + '|' + vi + '|' + season;
    let s = spriteCache.get(key);
    if (s) return s;
    const F = window.Flora;
    if (F && typeof F.paint === 'function') {
      try { const p = F.paint(sp.id, Kit.hashStr(sp.id) + vi * 7919, { season, size }); if (p && p.canvas && p.canvas.width) s = canvasSprite(p.canvas, p.ax, p.ay); } catch (e) { s = null; }
    }
    if (!s) s = fallbackPlant(sp, size, vi);
    spriteCache.set(key, s);
    return s;
  }
  // a cottage 2 tiles wide: walls under a thatched or tiled roof. face 0: door toward the viewer (south), 1: away
  // (north, so no door shows), 2: the gable end toward the viewer (the house faces east or west)
  function houseSprite(face, v) {
    const key = 'house|' + face + '|' + v;
    let s = spriteCache.get(key);
    if (s) return s;
    const roofs = [['#7a3a2e', '#a8503a', '#c8704a'], ['#8a7034', '#b8963e', '#d8b85a'], ['#3e4a5a', '#56667a', '#728498']][v % 3].map(P);
    const wall = [P('#d8cdb0'), P('#efe4c8')], dark = P('#5a3a24'), win = P('#3a5a7a'), lit = P('#f7c46c');
    if (face === 2) {
      s = blankSprite(14, 16, 7, 15);
      for (let y = 9; y <= 15; y++) for (let x = 2; x <= 11; x++) sset(s, x, y, x < 4 ? wall[1] : wall[0]);
      for (let y = 2; y <= 9; y++) { const hw = Math.round((y - 2) * 0.75) + 1; for (let x = 7 - hw; x <= 6 + hw; x++) sset(s, x, y, x < 7 ? roofs[2] : roofs[1]); }
      for (let y = 5; y <= 9; y++) { const hw = Math.round((y - 2) * 0.75) - 1; for (let x = 7 - hw; x <= 6 + hw; x++) sset(s, x, y, wall[1]); }
      sset(s, 6, 7, win); sset(s, 7, 7, win);
      for (let y = 12; y <= 15; y++) { sset(s, 6, y, dark); sset(s, 7, y, dark); }
      sset(s, 10, 11, win); sset(s, 3, 11, win);
    } else {
      s = blankSprite(18, 15, 9, 14);
      for (let y = 8; y <= 14; y++) for (let x = 2; x <= 15; x++) sset(s, x, y, x < 4 ? wall[1] : wall[0]);
      for (let y = 1; y <= 8; y++) { const inset = Math.max(0, 3 - y); for (let x = 1 + inset; x <= 16 - inset; x++) sset(s, x, y, y < 3 ? roofs[2] : y > 6 ? roofs[0] : roofs[1]); }
      for (let x = 2; x <= 15; x += 3) sset(s, x, 4, roofs[0]);
      sset(s, 12, 0, dark); sset(s, 12, 1, dark); // chimney
      if (face === 0) { for (let y = 10; y <= 14; y++) { sset(s, 8, y, dark); sset(s, 9, y, dark); } sset(s, 9, 12, lit); }
      sset(s, 4, 10, win); sset(s, 5, 10, win); sset(s, 12, 10, win); sset(s, 13, 10, win);
    }
    outline(s);
    spriteCache.set(key, s);
    return s;
  }
  function wellSprite() {
    let s = spriteCache.get('well');
    if (s) return s;
    s = blankSprite(9, 11, 4, 10);
    for (let y = 6; y <= 10; y++) for (let x = 1; x <= 7; x++) sset(s, x, y, y === 6 ? P('#1a1420') : (x + y) % 3 ? P('#8e8a92') : P('#aaa6ae'));
    for (let y = 2; y <= 6; y++) { sset(s, 1, y, P('#5a3a24')); sset(s, 7, y, P('#5a3a24')); }
    for (let x = 0; x <= 8; x++) { sset(s, x, 1, P('#a8503a')); sset(s, x, 2, P('#7a3a2e')); }
    outline(s);
    spriteCache.set('well', s);
    return s;
  }
  // a rowing boat drawn up at the shore
  function boatSprite() {
    let s = spriteCache.get('boat');
    if (s) return s;
    s = blankSprite(12, 6, 6, 4);
    for (let y = 1; y <= 4; y++) for (let x = y - 1; x <= 11 - y; x++) sset(s, x, y, y === 1 ? P('#c08a52') : y === 2 ? P('#8a5a32') : P('#6a4024'));
    for (let x = 2; x <= 9; x += 3) sset(s, x, 1, P('#5a3a20'));
    outline(s);
    spriteCache.set('boat', s);
    return s;
  }
  function blit(buf, IW, IH, s, x, y) {
    const x0 = x - s.ax, y0 = y - s.ay;
    for (let j = 0; j < s.h; j++) {
      const Y = y0 + j;
      if (Y < 0 || Y >= IH) continue;
      for (let i = 0; i < s.w; i++) {
        const c = s.px[j * s.w + i];
        if ((c >>> 24) < 128) continue;
        const X = x0 + i;
        if (X >= 0 && X < IW) buf[Y * IW + X] = c | 0xff000000;
      }
    }
  }
  // Chaikin's corner cutting, for paths and rivers that bend instead of stepping
  function chaikin(pts, it) {
    for (let k = 0; k < it; k++) {
      if (pts.length < 3) return pts;
      const o = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
      o.push(pts[pts.length - 1]);
      pts = o;
    }
    return pts;
  }

  function* buildRegion(w, reg) {
    const t0 = performance.now(), seed = w.seed, cx = reg.cx, cy = reg.cy;
    const ox = cx + 0.5 - RW / TPC / 2, oy = cy + 0.5 - RH / TPC / 2;
    const X = tx => ox + (tx + 0.5) / TPC, Y = ty => oy + (ty + 0.5) / TPC;
    const toT = (wx, wy) => [(wx - ox) * TPC, (wy - oy) * TPC]; // world cell coords to tile coords
    const R = Kit.rng(seed * 131 + cx * 977 + cy * 7);
    reg.stage = 'shaping the land';
    // the rock under the region, for the strata in the cliffs, the escarpments, and whether it makes caves
    const ci = cy * N + cx, cb = w.biome[ci];
    const famR = rockOf(seed, w.volc[ci], w.crys[ci], foldAt(cx + 0.5, cy + 0.5, seed), Math.max(0, w.H[ci])), fam = ROCK_NAME[famR];
    // ---- height: the world's height, interpolated, plus detail where the world is rough ----
    const h = new Float64Array(RN), hW = new Float64Array(RN), T = new Float32Array(RN), Pc = new Float32Array(RN);
    const foldT = new Float32Array(RN), volcT = new Float32Array(RN), crysT = new Float32Array(RN);
    for (let ty = 0; ty < RH; ty++) for (let tx = 0; tx < RW; tx++) {
      const i = ty * RW + tx, x = X(tx), y = Y(ty);
      const base = cubic(w.H, x, y), r = bilin(w.relief, x, y);
      hW[i] = base;
      const amp = 0.022 + 0.12 * r;
      let d = amp * fbm(x * 1.5, y * 1.5, seed + 501, 3);
      if (r > 0.1) d += amp * 1.2 * (ridged(x * 1.2, y * 1.2, seed + 503, 3) - 0.5);
      h[i] = base + d;
      // rain from the land cells only, so a coast doesn't read the sea's dry air as a desert
      T[i] = bilin(w.T, x, y); Pc[i] = bilinMask(w.P, w.ocean, x, y);
      foldT[i] = foldAt(x, y, seed); volcT[i] = bilin(w.volc, x, y); crysT[i] = bilin(w.crys, x, y);
    }
    // ---- local erosion: a few rounds of stream power on the tiles, so the detail drains ----
    const F = new Float64Array(RN), rec = new Int32Array(RN), ord = new Int32Array(RN), A = new Float64Array(RN), out = new Uint8Array(RN), heap = new Heap(RN + 8), done = new Uint8Array(RN);
    const drainR = () => {
      for (let i = 0; i < RN; i++) { const x = i % RW, y = (i / RW) | 0; out[i] = h[i] < 0 || x === 0 || y === 0 || x === RW - 1 || y === RH - 1 ? 1 : 0; }
      const c = flood(RW, RH, h, out, F, rec, ord, heap, done);
      A.fill(1);
      for (let k = c - 1; k >= 0; k--) { const i = ord[k]; if (rec[i] !== i) A[rec[i]] += A[i]; }
      return c;
    };
    for (let it = 0; it < 5; it++) {
      const c = drainR();
      for (let k = 0; k < c; k++) {
        const i = ord[k];
        if (out[i]) continue;
        const r = rec[i], f = 0.02 * Math.sqrt(A[i]);
        const hn = (h[i] + f * h[r]) / (1 + f);
        if (hn < h[i]) h[i] = hn;
      }
    }
    // soften the tile-scale noise so terrace edges run as long contours rather than speckle
    {
      const b = blur(h, RW, RH, 1, 2);
      for (let i = 0; i < RN; i++) h[i] = b[i];
    }
    yield;

    // ---- water: the sea, the world's lakes, the world's rivers (meandering), then local ponds ----
    reg.stage = 'finding the water';
    const wt = new Uint8Array(RN), surf = new Float64Array(RN);
    for (let ty = 0; ty < RH; ty++) for (let tx = 0; tx < RW; tx++) {
      const i = ty * RW + tx, x = X(tx), y = Y(ty), ix = Math.floor(x), iy = Math.floor(y);
      let sea = false, lvl = -1e9, ind = 0, wsum = 0;
      for (let b = iy - 1; b <= iy + 1; b++) for (let a = ix - 1; a <= ix + 1; a++) {
        if (a < 0 || b < 0 || a >= N || b >= N) continue;
        const c = b * N + a, d = Math.hypot(a + 0.5 - x, b + 0.5 - y);
        if (w.ocean[c] && d < 1.6) sea = true;
        if (w.wl[c] > lvl && d < 1.5) lvl = w.wl[c];
        // a smooth lake indicator: the lake cells, weighted by nearness, so shores round off between cell centers
        const k = Math.max(0, 1.25 - d);
        ind += k * k * (w.wl[c] > -1e8 ? 1 : 0); wsum += k * k;
      }
      ind = ind / (wsum || 1) + 0.22 * fbm(x * 3, y * 3, seed + 511, 2);
      if (h[i] < 0 && sea) { wt[i] = W_SEA; surf[i] = 0; }
      else if (lvl > -1e8 && ind > 0.5) { wt[i] = W_LAKE; surf[i] = lvl; h[i] = Math.min(h[i], lvl - 0.004 - (ind - 0.5) * 0.06); }
      else if (lvl > -1e8 && h[i] < lvl + 0.003) h[i] = lvl + 0.003 + (0.5 - ind) * 0.02; // the shore stands just above the lake
      else if (h[i] < 0.002) h[i] = 0.002 + Math.abs(h[i]) * 0.1; // a hollow below sea level away from the sea is just low ground
    }
    // rivers: each world river cell's run to its receiver, bent by a smooth field so it meanders the same way in
    // every region that shows it, and as wide as its flow
    const rd = new Float32Array(RN).fill(1e9), rs = new Float64Array(RN), rwid = new Float32Array(RN);
    for (let b = Math.floor(oy) - 2; b <= Math.ceil(oy + RH / TPC) + 1; b++) for (let a = Math.floor(ox) - 2; a <= Math.ceil(ox + RW / TPC) + 1; a++) {
      if (a < 0 || b < 0 || a >= N || b >= N) continue;
      const c = b * N + a;
      if (!w.river[c]) continue;
      const r = w.rec[c];
      if (r === c) continue;
      const s0 = w.F[c], s1 = w.ocean[r] ? 0 : w.wtr[r] ? w.wl[r] : w.F[r];
      const wid = clamp(0.8 + 0.45 * Math.sqrt(w.Q[c] / w.QR), 1, 4);
      const ax = a + 0.5, ay = b + 0.5, bx = (r % N) + 0.5, by = ((r / N) | 0) + 0.5;
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8, px = lerp(ax, bx, t), py = lerp(ay, by, t);
        const mx = px + 0.24 * gnoise(px * 1.9, py * 1.9, seed + 521), my = py + 0.24 * gnoise(px * 1.9 + 7.3, py * 1.9 - 3.1, seed + 523);
        const [tx, ty] = toT(mx, my);
        pts.push([tx, ty, lerp(s0, s1, t)]);
      }
      for (let k = 0; k < 8; k++) {
        const [x0, y0, z0] = pts[k], [x1, y1, z1] = pts[k + 1], rr = wid / 2 + 3;
        const ex = x1 - x0, ey = y1 - y0, el = ex * ex + ey * ey || 1;
        for (let ty = Math.max(0, Math.floor(Math.min(y0, y1) - rr)); ty <= Math.min(RH - 1, Math.ceil(Math.max(y0, y1) + rr)); ty++) {
          for (let tx = Math.max(0, Math.floor(Math.min(x0, x1) - rr)); tx <= Math.min(RW - 1, Math.ceil(Math.max(x0, x1) + rr)); tx++) {
            const qx = tx + 0.5 - x0, qy = ty + 0.5 - y0, t = clamp((qx * ex + qy * ey) / el, 0, 1);
            const d = Math.hypot(qx - ex * t, qy - ey * t), i = ty * RW + tx;
            if (d < rd[i]) { rd[i] = d; rs[i] = lerp(z0, z1, t); rwid[i] = wid; }
          }
        }
      }
    }
    // the levels: integer terraces of a step chosen so the region shows up to about 15 of them
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < RN; i++) { const v = wt[i] ? surf[i] : h[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    const step = Math.max(0.02, (hi - lo) / 13), base = lo - step * 3.2; // the base: a few strata showing under the front row
    // escarpments (as Merryfolk's cliffs): along contours of a slow noise field the land steps up two terraces at
    // once, in tiers, the way a hard bed of rock stands up as a cuesta or a mesa; rivers keep their level and cut
    // gorges through. Limestone and sandstone country has more of them.
    const tiers = famR === R_LIME || famR === R_SAND ? 2 : 1;
    for (let ty = 0; ty < RH; ty++) for (let tx = 0; tx < RW; tx++) {
      const i = ty * RW + tx;
      if (wt[i] === W_SEA || wt[i] === W_LAKE) continue;
      const x = X(tx), y = Y(ty), e = fbm(x * 0.75, y * 0.75, seed + 595, 3);
      let up = sstep(0.06, 0.1, e) * 2.2;
      if (tiers > 1) up += sstep(0.3, 0.34, e) * 2.2;
      if (rd[i] < rwid[i] / 2 + 1.5) up = 0;
      h[i] += up * step * sstep(0.0, 0.01, h[i]);
    }
    // carve the river in, keep its banks above it; low banks and shores are held within the water's own terrace,
    // so they meet it in a curve (the per-pixel shore) instead of a cliff
    const topOf = v => base + (Math.floor((v - base) / step) + 1) * step - step * 0.04;
    for (let i = 0; i < RN; i++) {
      if (rd[i] > 1e8 || wt[i] === W_SEA || wt[i] === W_LAKE) continue;
      const half = Math.max(0.56, rwid[i] / 2), s = rs[i];
      if (rd[i] < half) { wt[i] = W_RIVER; surf[i] = s; h[i] = Math.min(h[i], s - step * 0.4); }
      else if (rd[i] < half + 2.5) {
        const bank = Math.max(h[i], s + step * 0.06 + (rd[i] - half) * step * 0.12);
        h[i] = rd[i] < half + 1.6 && bank < s + step * 1.2 ? Math.min(bank, Math.max(topOf(s), s + step * 0.04)) : bank;
      }
    }
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      const i = y * RW + x;
      if (wt[i]) continue;
      for (let d = 0; d < 8; d++) {
        const nx = x + DX8[d], ny = y + DY8[d];
        if (nx < 0 || ny < 0 || nx >= RW || ny >= RH) continue;
        const j = ny * RW + nx;
        if ((wt[j] === W_LAKE || wt[j] === W_SEA) && h[i] < surf[j] + step) { h[i] = Math.max(Math.min(h[i], topOf(surf[j])), surf[j] + 0.001); break; }
      }
    }
    // ponds: hollows the local drainage can't empty, where there is rain enough to fill them
    {
      for (let i = 0; i < RN; i++) { const x = i % RW, y = (i / RW) | 0; out[i] = wt[i] || x === 0 || y === 0 || x === RW - 1 || y === RH - 1 ? 1 : 0; }
      flood(RW, RH, h, out, F, rec, ord, heap, done);
      for (let i = 0; i < RN; i++) if (!wt[i] && F[i] - h[i] > step * 0.45 && Pc[i] > 40 && T[i] > -6) { wt[i] = W_POND; surf[i] = F[i]; }
    }
    const L = new Int16Array(RN);
    for (let i = 0; i < RN; i++) L[i] = Math.max(0, Math.floor(((wt[i] ? surf[i] : h[i]) - base) / step));
    // shores stand at least as high as the water beside them, and lone bumps and dents are smoothed away
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
        const i = y * RW + x;
        if (wt[i]) continue;
        let up = 0, dnn = 0, mx = -1, mn = 1e9;
        for (let d = 0; d < 8; d++) {
          const nx = x + DX8[d], ny = y + DY8[d];
          if (nx < 0 || ny < 0 || nx >= RW || ny >= RH) continue;
          const j = ny * RW + nx;
          if (wt[j] && L[j] > L[i]) L[i] = L[j];
          if (d & 1) continue;
          if (L[j] > L[i]) up++; else if (L[j] < L[i]) dnn++;
          mx = Math.max(mx, L[j]); mn = Math.min(mn, L[j]);
        }
        if (up >= 4) L[i] = mn; else if (dnn >= 4 && mx < L[i]) L[i] = mx;
      }
    }
    yield;

    // the rock at a terrace's height under a tile: the region's own layer cake, so cliffs show the beds they cut
    const zOf = l => base + (l + 0.5) * step;
    const rockAt = (i, l) => rockOf(seed, volcT[i], crysT[i], foldT[i], zOf(l));

    // ---- ground: biome by climate per tile (the world's heat and rain, jittered), snow and rock by height and slope ----
    reg.stage = 'reading the ground';
    const gt = new Uint8Array(RN), fl = new Uint8Array(RN), Tt = new Float32Array(RN), dep = new Float32Array(RN), rockS = new Uint8Array(RN);
    const waterMask = new Uint8Array(RN), freshMask = new Uint8Array(RN), seaMask = new Uint8Array(RN);
    for (let i = 0; i < RN; i++) { waterMask[i] = wt[i] ? 1 : 0; freshMask[i] = wt[i] && wt[i] !== W_SEA ? 1 : 0; seaMask[i] = wt[i] === W_SEA || wt[i] === W_LAKE ? 1 : 0; }
    const dW = distField(waterMask, RW, RH), dF = distField(freshMask, RW, RH), dS = distField(seaMask, RW, RH);
    for (let ty = 0; ty < RH; ty++) for (let tx = 0; tx < RW; tx++) {
      const i = ty * RW + tx, x = X(tx), y = Y(ty);
      // swamps and beaches still come from the world cell, looked up through a domain warp
      const jx = clamp(Math.floor(x + 0.9 * fbm(x * 1.7, y * 1.7, seed + 531, 3)), 0, N - 1), jy = clamp(Math.floor(y + 0.9 * fbm(x * 1.7 + 5.5, y * 1.7 + 1.7, seed + 533, 3)), 0, N - 1);
      const wb = w.biome[jy * N + jx];
      Tt[i] = T[i] - 6.5 * (h[i] - hW[i]);
      // the rest from the climate itself, jittered by a slow noise, so edges follow its contours, not the world grid
      // (read through a domain warp of about a cell, so a contour lying along a cell column wanders off it)
      const qx = x + 1.1 * fbm(x * 0.8 + 3.1, y * 0.8, seed + 538, 3), qy = y + 1.1 * fbm(x * 0.8, y * 0.8 + 7.9, seed + 539, 3);
      const t = Tt[i] + bilin(w.T, qx, qy) - T[i] + 2.4 * fbm(x * 1.4, y * 1.4, seed + 535, 3);
      const p = bilinMask(w.P, w.ocean, qx, qy) * (1 + 0.32 * fbm(x * 1.4 + 9.1, y * 1.4 - 4.7, seed + 537, 3));
      let b;
      if (t < -10 || (h[i] > 2.1 && t < -6) || Tt[i] < -9.5) b = ICE;
      else if ((h[i] > 1.4 && t < -1.5) || (Tt[i] < -4 && h[i] > 0.9)) b = ALPINE;
      else if (wb === SWAMP) b = SWAMP;
      else if ((wb === 255 || wb === BEACH) && dS.d[i] <= 2.5) b = BEACH;
      else b = whittaker(t, p);
      const xa = Math.max(0, tx - 1), xb = Math.min(RW - 1, tx + 1), ya = Math.max(0, ty - 1), yb = Math.min(RH - 1, ty + 1);
      const sl = Math.hypot(h[ty * RW + xb] - h[ty * RW + xa], h[yb * RW + tx] - h[ya * RW + tx]) / (2 * TILE_KM); // tan of the slope
      dep[i] = Math.exp(-(sl * sl) / (3 * Math.LN2));
      let drop = 0;
      for (const j of [i - 1, i + 1, i - RW, i + RW]) if (j >= 0 && j < RN && Math.abs(j % RW - tx) <= 1) drop = Math.max(drop, L[i] - L[j]);
      if (!wt[i]) {
        if (drop >= 4 && b !== ICE) b = G_ROCK;
        else if (dS.d[i] <= 1.5 && L[i] <= L[dS.s[i]] + 1 && b !== ICE && b !== SWAMP && (w.ocean[jy * N + jx] || b === BEACH || b === DESERT || b === SAVANNA || b === GRASS || dS.d[i] <= 1)) b = BEACH;
        if (w.wtr[jy * N + jx] === 2) b = G_SALT; // salt flats from the world
      }
      gt[i] = b;
      rockS[i] = rockOf(seed, volcT[i], crysT[i], foldT[i], h[i]);
    }
    // tiles beside another ground on the same terrace: their pixels blend across the seam when painted
    const mixed = new Uint8Array(RN);
    for (let i = 0; i < RN; i++) {
      if (wt[i]) continue;
      const x = i % RW;
      for (const j of [i - 1, i + 1, i - RW, i + RW]) if (j >= 0 && j < RN && Math.abs(j % RW - x) <= 1 && !wt[j] && L[j] === L[i] && gt[j] !== gt[i]) { mixed[i] = 1; break; }
    }
    let rockCount = new Int32Array(5);
    for (let i = 0; i < RN; i++) if (!wt[i]) rockCount[rockS[i]]++;
    yield;

    // ---- the roads first: the world's roads re-laid on the tiles by least cost, since villages grew along them ----
    reg.stage = 'laying the roads';
    const pathW = new Float32Array(RN), trailW = new Float32Array(RN), roadsR = [], trailsR = [];
    const astar = makeAStar(RW, RH);
    const tileCost = (wear, beta, offPath) => (i, j, k) => {
      const wj = wt[j];
      if (wj === W_SEA || wj === W_LAKE || wj === W_POND) return Infinity;
      if (fl[j] & (F_HOUSE | F_FIELD)) return Infinity;
      const len = DL16[k], dL = L[j] - L[i];
      if (k >= 8) { const m = midCells(i % RW, (i / RW) | 0, k, RW); if (m && (wt[m[0]] || wt[m[1]] || Math.abs(L[m[0]] - L[i]) > 1 || Math.abs(L[m[1]] - L[i]) > 1)) return Infinity; }
      const S = dL * step / (len * TILE_KM);
      let c = len * tobler(S) * offPath * (1 - beta * Math.min(1, wear[j]));
      if (Math.abs(dL) >= 2) c *= 3 + Math.abs(dL) * 2; // steps cut into a cliff: possible, but dear
      if (wj === W_RIVER) c += wear[j] > 0 ? 1 : 7; // a ford or a bridge
      if (gt[j] === SWAMP) c *= 1.8;
      return c;
    };
    const roadCost = tileCost(pathW, 0.7, 1.3);
    const layR = (path, wr) => { for (const i of path) wr[i] = Math.min(3, wr[i] + 1); };
    const landNear = (tx, ty) => {
      let best = -1, bd = 1e9;
      for (let y = Math.max(0, ty - 4); y <= Math.min(RH - 1, ty + 4); y++) for (let x = Math.max(0, tx - 4); x <= Math.min(RW - 1, tx + 4); x++) {
        const i = y * RW + x, d = Math.hypot(x - tx, y - ty);
        if (!wt[i] && !(fl[i] & (F_HOUSE | F_FIELD)) && d < bd) { bd = d; best = i; }
      }
      return best;
    };
    for (const rd0 of w.roads) {
      // the part of the world road inside (or just around) the region, as tile waypoints
      const wp = [];
      for (const c of rd0.path) wp.push(toT((c % N) + 0.5, ((c / N) | 0) + 0.5));
      let run = [];
      const runs = [];
      for (let k = 0; k < wp.length; k++) {
        const [tx, ty] = wp[k], inside = tx > -12 && ty > -12 && tx < RW + 12 && ty < RH + 12;
        if (inside) run.push(wp[k]); else if (run.length) { runs.push(run); run = []; }
      }
      if (run.length) runs.push(run);
      for (const ru of runs) {
        if (ru.length < 2) continue;
        // clip to the region's edge and lay each leg by A* on the tiles
        const pts = ru.map(([x, y]) => [clamp(x, 0.5, RW - 1.5), clamp(y, 0.5, RH - 1.5)]);
        let full = [];
        for (let k = 0; k < pts.length - 1; k++) {
          const a = landNear(Math.round(pts[k][0]), Math.round(pts[k][1])), b = landNear(Math.round(pts[k + 1][0]), Math.round(pts[k + 1][1]));
          if (a < 0 || b < 0 || a === b) continue;
          const p = astar(a, b, roadCost, j => Math.hypot((j % RW) - (b % RW), ((j / RW) | 0) - ((b / RW) | 0)) * 0.3, 20000);
          if (p) { layR(p, pathW); full = full.length ? full.concat(p.slice(1)) : p; }
        }
        if (full.length > 1) roadsR.push({ path: full, kind: 3 });
      }
    }
    yield;

    // ---- the village: sited by the same reasons as the world's, then given the form its site asks for ----
    reg.stage = 'siting the village';
    const score = new Float32Array(RN);
    const latY = w.lat(cy), upx = latY > 30 ? -1 : 1;
    const Lat = (x, y) => L[clamp(y, 0, RH - 1) * RW + clamp(x, 0, RW - 1)];
    const roadMask = new Uint8Array(RN);
    for (let i = 0; i < RN; i++) roadMask[i] = pathW[i] > 0 ? 1 : 0;
    const dRd = distField(roadMask, RW, RH);
    // a village whose world cell is on the coast or a lakeshore lives by the water: its site score wants the shore
    let coastal = false;
    for (const t of w.towns) {
      const [tx, ty] = toT(t.x + 0.5, t.y + 0.5);
      if (tx < 0 || ty < 0 || tx >= RW || ty >= RH) continue;
      for (let b = t.y - 2; b <= t.y + 2; b++) for (let a = t.x - 2; a <= t.x + 2; a++) if (a >= 0 && b >= 0 && a < N && b < N && (w.ocean[b * N + a] || w.wtr[b * N + a] === 1)) coastal = true;
    }
    for (let ty = 3; ty < RH - 3; ty++) for (let tx = 3; tx < RW - 3; tx++) {
      const i = ty * RW + tx, b = gt[i];
      if (wt[i] || pathW[i] > 0 || b === G_ROCK || b === ICE || b === G_SALT || b === ALPINE) continue;
      let same = 0, nS = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 10) { nS++; if (Lat(tx + dx, ty + dy) === L[i]) same++; }
      const flat = same / nS;
      const df = dF.d[i];
      const water = df < 2 ? 0.4 : df <= 7 ? 1 : clamp(1 - (df - 7) / 12, 0, 1);
      const dry = dW.s[i] >= 0 ? sstep(0, 1.5, L[i] - L[dW.s[i]]) : 1;
      let hiN = 0, nU = 0;
      for (let a = -2; a <= 2; a++) for (const r of [3, 5, 7]) { const ang = a * 0.45; nU++; if (Lat(Math.round(tx + upx * Math.cos(ang) * r), Math.round(ty + Math.sin(ang) * r)) > L[i] + 1) hiN++; }
      const shelter = hiN / nU;
      const sun = sstep(-1, 3, Lat(tx, ty - 3) - Lat(tx, ty + 3));
      const soilQ = dep[i] * (b === DESERT ? 0.3 : b === TUNDRA ? 0.3 : 1);
      const road = roadsR.length ? clamp(1 - dRd.d[i] / 5, 0, 1) : 0; // the road draws houses (Emilien's accessibility)
      const shore = coastal ? clamp(1 - (dS.d[i] - 1.5) / 4, 0, 1) : 0;
      score[i] = (1.3 * flat + 1.2 * water + 1 * dry + 0.8 * shelter + 0.6 * sun + 0.6 * soilQ + 0.7 * road + 1.2 * shore) / 6.2;
    }
    let village = null;
    {
      let town = null, bd2 = 1e9;
      for (const t of w.towns) {
        const [tx, ty] = toT(t.x + 0.5, t.y + 0.5), d = Math.hypot(tx - RW / 2, ty - RH / 2);
        if (tx > 4 && ty > 4 && tx < RW - 4 && ty < RH - 4 && d < bd2) { bd2 = d; town = { t, tx, ty }; }
      }
      if (town) {
        let best = -1, bs = 0;
        for (let i = 0; i < RN; i++) {
          const x = i % RW, y = (i / RW) | 0, d = Math.hypot(x - town.tx, y - town.ty);
          if (d > 14 || x < 8 || y < 8 || x >= RW - 8 || y >= RH - 6) continue;
          const s = score[i] - d * 0.004;
          if (s > bs) { bs = s; best = i; }
        }
        if (best >= 0) village = { x: best % RW, y: (best / RW) | 0, big: town.t.big, houses: [], fields: [], boats: [], well: true };
      }
    }
    const built = new Uint8Array(RN), fieldAt = new Int16Array(RN).fill(-1);
    if (village) {
      const { x: vx, y: vy } = village, vi = vy * RW + vx, Lc = L[vi], houses = village.houses, fields = village.fields;
      village.L = Lc;
      const inR = (x, y) => x >= 1 && y >= 1 && x < RW - 1 && y < RH - 1;
      const faceTo = (hx, hy, tx, ty) => { const dx = tx - (hx + 1), dy = ty - hy; return Math.abs(dx) * 0.8 > Math.abs(dy) ? 2 : dy > 0 ? 0 : 1; };
      // a cottage on two tiles, facing (tx, ty); a step of one terrace between its tiles is leveled
      const tryHouse = (hx, hy, tx, ty) => {
        if (hx < 1 || hy < 1 || hx >= RW - 2 || hy >= RH - 1) return false;
        const i0 = hy * RW + hx, i1 = i0 + 1;
        if (wt[i0] || wt[i1] || (fl[i0] | fl[i1]) & (F_HOUSE | F_GREEN | F_FIELD) || pathW[i0] > 0 || pathW[i1] > 0) return false;
        if (gt[i0] === G_ROCK || gt[i1] === G_ROCK || gt[i0] === ICE || Math.abs(L[i0] - L[i1]) > 1) return false;
        if (houses.some(q => Math.abs(q.x - hx) < 3 && Math.abs(q.y - hy) < 2)) return false;
        L[i0] = L[i1] = Math.max(L[i0], L[i1]);
        fl[i0] |= F_HOUSE; fl[i1] |= F_HOUSE; built[i0] = built[i1] = 1;
        houses.push({ x: hx, y: hy, face: faceTo(hx, hy, tx, ty), v: Math.floor(R() * 3) });
        return true;
      };
      const fieldOk = (i, L0) => !wt[i] && !(fl[i] & (F_FIELD | F_HOUSE | F_GREEN)) && !(pathW[i] > 0) && L[i] === L0 && gt[i] !== G_ROCK && gt[i] !== ICE && gt[i] !== BEACH && gt[i] !== G_SALT && gt[i] !== ALPINE;
      const addField = (tiles, crop, dir, strips, x0, y0) => {
        const id = fields.length;
        for (const i of tiles) { fieldAt[i] = id; fl[i] |= F_FIELD; built[i] = 1; }
        fields.push({ crop, dir, strips, x0, y0, n: tiles.length });
      };
      // open-field furlongs: blocks of strips on the flattest open land nearby, one terrace each
      const furlongs = (count, rMin, rMax) => {
        const dims = [[5, 3], [6, 3], [4, 4], [5, 4], [7, 3], [4, 3]];
        for (let f = 0; f < count; f++) {
          let best = null, bs = -1e9;
          for (let t = 0; t < 220; t++) {
            const [fw, fh] = dims[(f + t) % dims.length], ang = R() * Math.PI * 2, rr = R.range(rMin, rMax);
            const x0 = Math.round(vx + Math.cos(ang) * rr * 1.2 - fw / 2), y0 = Math.round(vy + Math.sin(ang) * rr * 0.9 - fh / 2);
            if (x0 < 1 || y0 < 1 || x0 + fw >= RW - 1 || y0 + fh >= RH - 1) continue;
            const L0 = L[y0 * RW + x0];
            let ok = true, soilS = 0;
            for (let y = y0 - 1; y <= y0 + fh && ok; y++) for (let x = x0 - 1; x <= x0 + fw && ok; x++) {
              const i = y * RW + x, inside = x >= x0 && y >= y0 && x < x0 + fw && y < y0 + fh;
              if (fl[i] & (F_FIELD | F_HOUSE | F_GREEN)) ok = false;
              if (!inside) continue;
              if (!fieldOk(i, L0)) ok = false;
              soilS += dep[i];
            }
            if (!ok) continue;
            const s = soilS / (fw * fh) - rr * 0.02 + R() * 0.05;
            if (s > bs) { bs = s; best = [x0, y0, fw, fh]; }
          }
          if (!best) continue;
          const [x0, y0, fw, fh] = best, tiles = [];
          for (let y = y0; y < y0 + fh; y++) for (let x = x0; x < x0 + fw; x++) tiles.push(y * RW + x);
          addField(tiles, f % CROPS.length, fw >= fh ? 0 : 1, true, x0, y0);
        }
      };
      // a croft: one strip behind a house, running away from the road until the ground changes level
      const stripBehind = (hs, nx, ny, len, wid, crop) => {
        const hx = hs.x + 1, hy = hs.y + 0.5, L0 = L[hs.y * RW + hs.x], tiles = new Set();
        for (let s = 1.6; s <= len; s += 0.5) {
          let any = false;
          for (let q = -wid / 2; q <= wid / 2 + 0.01; q += 0.5) {
            const tx = Math.floor(hx + nx * s - ny * q), ty = Math.floor(hy + ny * s + nx * q);
            if (!inR(tx, ty)) continue;
            const i = ty * RW + tx;
            if (tiles.has(i)) { any = true; continue; }
            if (fieldOk(i, L0)) { tiles.add(i); any = true; }
          }
          if (!any) break;
        }
        if (tiles.size >= 3) addField([...tiles], crop, Math.abs(nx) > Math.abs(ny) ? 0 : 1, false, 0, 0);
      };
      // the road nearest the center, as an ordered run of tiles, and its heading
      let rp = null, rk = -1;
      if (dRd.s[vi] >= 0 && dRd.d[vi] <= 4) { const t = dRd.s[vi]; for (const r of roadsR) { const k = r.path.indexOf(t); if (k >= 0) { rp = r.path; rk = k; break; } } }
      const tangent = k => { const a = rp[Math.max(0, k - 3)], b = rp[Math.min(rp.length - 1, k + 3)], dx = (b % RW) - (a % RW), dy = ((b / RW) | 0) - ((a / RW) | 0), l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
      // read the site: a hilltop (most of a ring lies lower), flat ground, woods, the shore, a valley along the road
      let lower = 0, ring = 0, same = 0, nS = 0, wood = 0, nW = 0, along = 0, across = 0;
      for (let a = 0; a < 24; a++) for (const r of [5, 7]) {
        const x = Math.round(vx + Math.cos(a / 24 * Math.PI * 2) * r * 1.2), y = Math.round(vy + Math.sin(a / 24 * Math.PI * 2) * r * 0.9);
        if (!inR(x, y)) continue;
        ring++; if (L[y * RW + x] < Lc) lower++;
      }
      for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
        const x = vx + dx, y = vy + dy;
        if (!inR(x, y) || dx * dx + dy * dy > 100) continue;
        const i = y * RW + x, b = gt[i];
        nW++; if (b === FOREST || b === TAIGA || b === JUNGLE) wood++;
        if (dx * dx + dy * dy * 1.3 <= 40) { nS++; if (Math.abs(L[i] - Lc) <= 1 && !wt[i]) same++; }
      }
      if (rp) {
        const [ux, uy] = tangent(rk);
        for (let s = -8; s <= 8; s++) {
          if (!s) continue;
          const ax = Math.round(vx + ux * s), ay = Math.round(vy + uy * s), bx = Math.round(vx - uy * s), by = Math.round(vy + ux * s);
          if (inR(ax, ay) && L[ay * RW + ax] === Lc && !wt[ay * RW + ax]) along++;
          if (inR(bx, by) && L[by * RW + bx] === Lc && !wt[by * RW + bx]) across++;
        }
      }
      const hill = lower / Math.max(1, ring), flat = same / Math.max(1, nS), woods = wood / Math.max(1, nW);
      const form = village.form = dS.d[vi] <= 7 ? 'shore' : hill > 0.6 || flat < 0.45 ? 'hill' : rp ? (woods > 0.3 ? 'strip' : along > across + 2 ? 'street' : 'anger') : 'green';
      Object.assign(village, { hill, flat, woods, along, across, sea: dS.d[vi] });
      if (form === 'street' || form === 'strip') {
        // Straßendorf: houses on both sides of the road, each with its croft behind; a Waldhufendorf spaces its
        // farms wider and runs each strip far back into the forest
        village.well = false;
        const gap = form === 'strip' ? 4 : 2.6, len = form === 'strip' ? 13 : 6, wid = form === 'strip' ? 2.6 : 1.6, reach = form === 'strip' ? 18 : 13;
        const nH = village.big ? (form === 'strip' ? 10 : 14) : (form === 'strip' ? 7 : 10);
        // level the street: ground a terrace off the road beside it takes the road's level
        for (const t of rp) {
          const tx = t % RW, ty = (t / RW) | 0;
          if (Math.hypot(tx - vx, ty - vy) > reach + 2) continue;
          for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) {
            if (!inR(x, y)) continue;
            const i = y * RW + x;
            if (!wt[i] && !(pathW[i] > 0) && Math.abs(L[i] - L[t]) === 1) { L[i] = L[t]; if (gt[i] === G_ROCK) gt[i] = GRASS; }
          }
        }
        // walk the road both ways from the center, a plot on each side every `gap` tiles
        const order = [];
        for (const dir of [1, -1]) {
          let acc = dir > 0 ? gap : gap / 2;
          for (let k = rk; k >= 0 && k < rp.length; k += dir) {
            if (k !== rk) { const a = rp[k - dir], b = rp[k]; acc += Math.hypot((b % RW) - (a % RW), ((b / RW) | 0) - ((a / RW) | 0)); }
            if (acc >= gap) { acc -= gap; order.push(k); }
            if (Math.hypot(rp[k] % RW - vx, ((rp[k] / RW) | 0) - vy) > reach) break;
          }
        }
        order.sort((a, b) => Math.abs(a - rk) - Math.abs(b - rk));
        for (const k of order) {
          if (houses.length >= nH) break;
          const t = rp[k], tx = (t % RW) + 0.5, ty = ((t / RW) | 0) + 0.5, [ux, uy] = tangent(k);
          for (const side of [1, -1]) {
            const nx = -uy * side, ny = ux * side;
            if (tryHouse(Math.round(tx + nx * 1.9 - 1), Math.floor(ty + ny * 1.9), tx, ty)) stripBehind(houses[houses.length - 1], nx, ny, len, wid, (houses.length + (side > 0 ? 0 : 2)) % CROPS.length);
          }
        }
      } else if (form === 'green' || form === 'anger' || form === 'hill') {
        // a green: a round one on open flats; an Anger, a lens of green along the road with a row of houses each
        // side; a hill village packs its houses round a small square on the top terrace
        let ax = 1, ay = 0, gl = 2.7, gw = 2.35, rad = 7.6;
        if (form === 'anger') { [ax, ay] = tangent(rk); gl = 5.2; gw = 2; }
        if (form === 'hill') { gl = gw = 1.4; rad = 5.6; }
        for (let y = vy - 8; y <= vy + 8; y++) for (let x = vx - 9; x <= vx + 9; x++) {
          if (!inR(x, y)) continue;
          const i = y * RW + x, dx = x - vx, dy = y - vy, u = dx * ax + dy * ay, v = -dx * ay + dy * ax;
          if (wt[i] || Math.hypot(dx, dy * 1.15) > rad + gnoise(x * 0.4, y * 0.4, seed + 561) * 1.2) continue;
          if (Math.abs(L[i] - Lc) <= 1) { L[i] = Lc; built[i] = 1; if (gt[i] === G_ROCK || gt[i] === BEACH) gt[i] = GRASS; }
          if (L[i] === Lc && !(pathW[i] > 0 && form !== 'anger') && (u / gl) ** 2 + (v / gw) ** 2 < 1 + 0.25 * gnoise(x * 0.7, y * 0.7, seed + 563)) fl[i] |= F_GREEN;
        }
        if (form === 'green') {
          const nH = village.big ? 11 : 7, a0 = R() * Math.PI * 2;
          for (let k = 0; k < nH; k++) {
            const ang = a0 + k * Math.PI * 2 / nH + R.range(-0.2, 0.2), rr = R.range(4.6, 6);
            tryHouse(Math.round(vx + Math.cos(ang) * rr * 1.2) - 1, Math.round(vy + Math.sin(ang) * rr * 0.9), vx, vy);
          }
          furlongs(village.big ? 6 : 4, 8, 19);
        } else if (form === 'anger') {
          const nH = village.big ? 12 : 8;
          for (let u = -gl - 1; u <= gl + 1.01 && houses.length < nH; u += 2.6) for (const side of [1, -1]) {
            const v = side * (gw + 2.3), px = vx + u * ax - v * ay, py = vy + u * ay + v * ax;
            tryHouse(Math.round(px - 1), Math.round(py), vx + u * ax, vy + u * ay);
          }
          furlongs(village.big ? 6 : 4, 8, 19);
        } else {
          const nH = village.big ? 14 : 10, cand = [];
          for (let y = vy - 6; y <= vy + 6; y++) for (let x = vx - 7; x <= vx + 6; x++) {
            const d = Math.hypot((x + 1 - vx) / 1.2, (y - vy) / 0.9);
            if (d >= 1.6 && d <= 6 && inR(x, y) && L[y * RW + x] >= Lc - 1) cand.push([x, y, d + R() * 1.6]);
          }
          cand.sort((a, b) => a[2] - b[2]);
          for (const [x, y] of cand) { if (houses.length >= nH) break; tryHouse(x, y, vx, vy); }
          furlongs(village.big ? 5 : 3, 7, 18);
        }
      } else {
        // a fishing hamlet: one row along the shore, facing the water, a boat drawn up in front of each house
        village.well = false;
        const cand = [];
        let mx = 0, my = 0;
        for (let y = vy - 12; y <= vy + 12; y++) for (let x = vx - 14; x <= vx + 14; x++) {
          if (!inR(x, y) || Math.hypot((x - vx) / 1.2, y - vy) > 12) continue;
          const i = y * RW + x;
          if (!wt[i] && dS.d[i] >= 1 && dS.d[i] <= 2.6 && dS.s[i] >= 0 && Math.abs(L[i] - L[dS.s[i]]) <= 1) { cand.push(i); mx += x; my += y; }
        }
        if (cand.length) {
          mx /= cand.length; my /= cand.length;
          let sxx = 0, syy = 0, sxy = 0;
          for (const i of cand) { const dx = i % RW - mx, dy = ((i / RW) | 0) - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
          const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ex = Math.cos(th), ey = Math.sin(th), proj = i => (i % RW) * ex + ((i / RW) | 0) * ey;
          cand.sort((a, b) => proj(a) - proj(b));
          const nH = village.big ? 10 : 7, cp = proj(vi);
          // from the middle of the shore outward, so the row centers on the site
          cand.sort((a, b) => Math.abs(proj(a) - cp) - Math.abs(proj(b) - cp));
          for (const i of cand) {
            if (houses.length >= nH) break;
            const x = i % RW, y = (i / RW) | 0, s = dS.s[i];
            if (houses.some(q => Math.abs(proj(q.y * RW + q.x) - proj(i)) < 2.6 && Math.hypot(q.x - x, q.y - y) < 4)) continue;
            if (tryHouse(x - 1, y, s % RW, (s / RW) | 0) || tryHouse(x, y, s % RW, (s / RW) | 0)) {
              const hs = houses[houses.length - 1], wtile = dS.s[hs.y * RW + hs.x + 1];
              if (wtile >= 0 && (wt[wtile] === W_SEA || wt[wtile] === W_LAKE)) village.boats.push(wtile);
            }
          }
        }
        furlongs(2, 4, 12);
      }
    }
    yield;

    // ---- lanes and trails: the village's lanes, then game trails ----
    reg.stage = 'laying the lanes';
    if (village) {
      // the lane: from the center to the nearest road (or out of the region toward the nearest other village)
      const vi = village.y * RW + village.x;
      let goal = -1, bd = 1e9;
      for (let i = 0; i < RN; i++) if (pathW[i] > 0 && !built[i]) { const d = Math.hypot(i % RW - village.x, ((i / RW) | 0) - village.y); if (d < bd) { bd = d; goal = i; } }
      if (goal < 0) {
        let other = null, od = 1e9;
        for (const t of w.towns) { const d = Math.hypot(t.x - cx, t.y - cy); if (d > 2 && d < od) { od = d; other = t; } }
        if (other) {
          const ang = Math.atan2(other.y - cy, other.x - cx), ex = clamp(Math.round(village.x + Math.cos(ang) * 40), 1, RW - 2), ey = clamp(Math.round(village.y + Math.sin(ang) * 40), 1, RH - 2);
          goal = landNear(ex, ey);
        }
      }
      if (goal >= 0 && bd > 1.5) {
        const p = astar(vi, goal, tileCost(pathW, 0.7, 1.3), j => Math.hypot((j % RW) - (goal % RW), ((j / RW) | 0) - ((goal / RW) | 0)) * 0.3, 20000);
        if (p) { layR(p, pathW); roadsR.push({ path: p, kind: 2 }); }
      }
      // short lanes from each door: to the street in a street village, along the row in a hamlet, else to the green
      const doorOf = hs => (hs.face === 1 ? hs.y - 1 : hs.y + 1) * RW + hs.x + (hs.face === 2 ? 0 : 1);
      let prev = -1;
      for (const hs of village.houses) {
        const door = doorOf(hs);
        if (door < 0 || door >= RN || wt[door] || fl[door] & (F_HOUSE | F_FIELD)) continue;
        let to = vi;
        if (village.form === 'street' || village.form === 'strip') { const s = dRd.s[door]; if (s >= 0 && dRd.d[door] <= 5) to = s; }
        if (village.form === 'shore') { to = prev >= 0 ? prev : vi; prev = door; }
        if (to === door) continue;
        const p = astar(door, to, tileCost(pathW, 0.8, 1.5), j => Math.hypot((j % RW) - (to % RW), ((j / RW) | 0) - ((to / RW) | 0)) * 0.3, 4000);
        if (p) { const q = p.filter(i => !(fl[i] & F_GREEN)); if (q.length) { layR(q, pathW); roadsR.push({ path: q, kind: 1 }); } }
      }
    }
    // game trails: animals from cover to the nearest water, each preferring ground earlier ones have worn
    {
      const trailCost = tileCost(trailW, 0.75, 1.6);
      for (let n = 0, tries = 0; n < 28 && tries < 400; tries++) {
        const i = Math.floor(R() * RN), b = gt[i];
        if (wt[i] || built[i] || !(b === FOREST || b === TAIGA || b === JUNGLE || b === SAVANNA || b === GRASS || b === SWAMP || b === TUNDRA)) continue;
        if (dF.d[i] < 5 || dF.d[i] > 22 || dF.s[i] < 0) continue;
        if (village && Math.hypot(i % RW - village.x, ((i / RW) | 0) - village.y) < 10) continue;
        const wtile = dF.s[i], gx = wtile % RW, gy = (wtile / RW) | 0, sx = i % RW, sy = (i / RW) | 0;
        const goal = landNear(gx + Math.sign(sx - gx), gy + Math.sign(sy - gy));
        if (goal < 0) continue;
        const p = astar(i, goal, trailCost, j => Math.hypot((j % RW) - (goal % RW), ((j / RW) | 0) - ((goal / RW) | 0)) * 0.25, 6000);
        if (p) { for (const c of p) trailW[c] += 1; trailsR.push(p); n++; }
      }
    }
    for (let i = 0; i < RN; i++) if (pathW[i] > 0) { fl[i] |= F_PATH; if (wt[i] === W_RIVER) fl[i] |= F_BRIDGE; }
    yield;

    // ---- caves, made by the rock: karst along joints at the water table, lava tubes, sea caves, shelters ----
    reg.stage = 'dissolving the caves';
    const cvL = [new Int8Array(RN).fill(-1), new Int8Array(RN).fill(-1)], cvK = [new Uint8Array(RN), new Uint8Array(RN)]; // two slots: lower and upper
    const cvTo = new Int32Array(RN).fill(-1), mouthL = new Int8Array(RN).fill(-1), flow = new Uint8Array(RN);
    const info = { karst: 0, pattern: [], springs: 0, dolines: 0, levels: 0, lava: 0, skylights: 0, sea: 0, shelters: 0, hidden: 0 };
    const mark = (slot, i, lv, kind) => { if (cvL[slot][i] < 0) { cvL[slot][i] = lv; cvK[slot][i] = kind; } };
    const tdist = (a, b) => Math.hypot(a % RW - b % RW, ((a / RW) | 0) - ((b / RW) | 0));
    // joints: two sets at right angles, square to the plate's drift (the regional squeeze), 4 or 5 tiles apart
    const plt = w.plates[w.pid[ci]], th = Math.atan2(plt.vy, plt.vx), ca = Math.cos(th), sa = Math.sin(th), JS = hash2(cx, cy, seed + 665) < 0.5 ? 4 : 5;
    const joint = new Uint8Array(RN);
    for (let ty = 0; ty < RH; ty++) for (let tx = 0; tx < RW; tx++) {
      const u = tx * ca + ty * sa + 0.9 * gnoise(tx * 0.13, ty * 0.13, seed + 661), v = -tx * sa + ty * ca + 0.9 * gnoise(tx * 0.13 + 3.3, ty * 0.13, seed + 663);
      joint[ty * RW + tx] = ((u % JS) + JS) % JS < 1 || ((v % JS) + JS) % JS < 1 ? 1 : 0;
    }
    // Dijkstra from many sources at once, each with its own level; every tile remembers which way leads back
    const dist = new Float32Array(RN), came = new Int32Array(RN), lvOf = new Int8Array(RN), hp = new Heap(RN * 2);
    const grow = (srcs, pass, cost) => {
      dist.fill(1e9); came.fill(-1); hp.n = 0;
      for (const s of srcs) { dist[s.i] = 0; lvOf[s.i] = s.lv; hp.push(0, s.i); }
      while (hp.n) {
        const i = hp.pop(), d = hp.top;
        if (d > dist[i]) continue;
        const x = i % RW, y = (i / RW) | 0, lv = lvOf[i];
        for (let k = 0; k < 8; k++) {
          const nx = x + DX8[k], ny = y + DY8[k];
          if (nx < 0 || ny < 0 || nx >= RW || ny >= RH) continue;
          const j = ny * RW + nx;
          if (!pass(j, lv)) continue;
          const nd = d + DL8[k] * cost(j);
          if (nd < dist[j]) { dist[j] = nd; came[j] = i; lvOf[j] = lv; hp.push(nd, j); }
        }
      }
    };
    // follow each inlet's way back to its outlet, marking the passage; returns the paths, inlet first
    const trace = (inlets, slot, kind) => inlets.map(s => {
      const path = [];
      for (let i = s, g = 0; i >= 0 && g < RN; i = came[i], g++) {
        path.push(i); mark(slot, i, lvOf[i], kind);
        if (kind === K_WET) { cvTo[i] = came[i]; flow[i] = Math.min(255, flow[i] + 1); }
      }
      return path;
    });
    // sinkholes: limestone at the surface on open, dry land, wetter and flatter first, at least 6 tiles apart
    const pickInlets = (ok, max) => {
      const c = [];
      for (let i = 0; i < RN; i++) {
        const tx = i % RW, ty = (i / RW) | 0;
        if (tx < 2 || ty < 2 || tx > RW - 3 || ty > RH - 3 || wt[i] || built[i] || pathW[i] > 0 || trailW[i] >= 2 || rockS[i] !== R_LIME || gt[i] === G_ROCK || !ok(i)) continue;
        c.push([i, hash2(i, 5, seed + 671) * (Pc[i] > 40 ? 1 : 0.5) * (0.5 + dep[i])]);
      }
      c.sort((a, b) => b[1] - a[1]);
      const out = [];
      for (const [i] of c) { if (out.length >= max) break; if (!out.some(j => tdist(i, j) < 6)) out.push(i); }
      return out;
    };
    // limestone dissolves only where there's water to do it: no karst under a desert
    let rainSum = 0;
    for (let i = 0; i < RN; i++) rainSum += Pc[i];
    const wetEnough = rainSum / RN > 25;
    const karstPass = (j, lv) => wetEnough && !wt[j] && L[j] >= lv + 1 && rockAt(j, lv) === R_LIME;
    const karstCost = j => (joint[j] ? 1 : 2.8) + 0.6 * hash2(j, 7, seed + 667);
    const dolines = [];
    // the active level: springs where limestone meets a river, lake or the sea at the water's own level
    const springC = [];
    // (within two tiles of the water, since low banks share the water's terrace; the spring issues on the side
    // toward the water, onto the bank or into the river)
    for (let i = 0; i < RN; i++) {
      const wq = dW.s[i];
      if (wt[i] || built[i] || wq < 0 || dW.d[i] > 2.5 || wt[wq] === W_POND) continue;
      const lv = L[wq];
      if (L[i] < lv + 1 || rockAt(i, lv) !== R_LIME) continue;
      const x = i % RW, y = (i / RW) | 0, sx = Math.sign((wq % RW) - x), sy = Math.sign(((wq / RW) | 0) - y);
      const q = Math.abs(sy) >= Math.abs(sx) && sy ? i + sy * RW : i + sx;
      if (q < 0 || q >= RN || L[q] > lv) continue;
      springC.push({ i, lv, q, k: hash2(i, 3, seed + 669) + (q === i + RW ? 0.3 : 0) + (wt[wq] === W_RIVER ? 0.2 : 0) });
    }
    springC.sort((a, b) => b.k - a.k);
    const springs = [];
    for (const s of springC) { if (springs.length >= 6) break; if (!springs.some(t => tdist(t.i, s.i) < 7)) springs.push(s); }
    const wetLv = new Set();
    if (springs.length) {
      grow(springs, karstPass, karstCost);
      const inl = pickInlets(i => dist[i] < 1e9 && L[i] >= lvOf[i] + 2, 9);
      if (inl.length) {
        const paths = trace(inl, 0, K_WET);
        dolines.push(...inl);
        info.karst = 1; info.levels = 1; info.pattern.push('branchwork');
        for (const s of springs) if (flow[s.i]) { cvTo[s.i] = s.q; fl[s.i] |= F_SPRING; info.springs++; wetLv.add(s.lv); }
        // trunks: a passage carrying three or more sinkholes' water is two tiles wide
        for (let i = 0; i < RN; i++) if (cvL[0][i] >= 0 && flow[i] >= 3) for (const j of [i + 1, i + RW]) if (j < RN && karstPass(j, cvL[0][i])) mark(0, j, cvL[0][i], K_WET);
        // a network maze where a sandstone cap lets water in everywhere: every joint round the passage opens
        const capped = [];
        for (let i = 0; i < RN; i++) if (cvL[0][i] >= 0 && rockAt(i, cvL[0][i] + 1) === R_SAND) capped.push(i);
        let maze = 0;
        for (const i of capped) {
          const lv = cvL[0][i], x = i % RW, y = (i / RW) | 0;
          for (let b = y - 3; b <= y + 3; b++) for (let a = x - 3; a <= x + 3; a++) {
            if (a < 0 || b < 0 || a >= RW || b >= RH) continue;
            const j = b * RW + a;
            if (joint[j] && cvL[0][j] < 0 && karstPass(j, lv)) { mark(0, j, lv, K_WET); maze++; }
          }
        }
        if (maze > 6) info.pattern.push('network maze');
        // anastomotic loops near a spring that a big river floods back into: side passages that braid and rejoin
        let braids = 0;
        for (const path of paths) {
          const sp = springs.find(s => s.i === path[path.length - 1]);
          if (!sp || !((wt[sp.q] === W_RIVER && rwid[sp.q] >= 2.2) || wt[sp.q] === W_LAKE) || path.length < 10) continue;
          const lv = sp.lv;
          for (let k = path.length - 9; k < path.length - 2; k += 3) {
            const a = path[k], b = path[Math.min(path.length - 1, k + 5)], salt = braids + k;
            grow([{ i: a, lv }], karstPass, j => 1 + 2.5 * hash2(j, salt, seed + 675) + (cvL[0][j] >= 0 ? 4 : 0));
            if (dist[b] >= 1e9) continue;
            for (let prev = b, i = came[b], g = 0; i >= 0 && i !== a && g < 60; prev = i, i = came[i], g++) if (cvL[0][i] < 0) { mark(0, i, lv, K_WET); cvTo[i] = prev; }
            braids++;
          }
        }
        if (braids) info.pattern.push('anastomotic');
      }
    }
    // the old level: an abandoned water table two to four terraces up, dry, opening where valleys cut it
    {
      const gapL = clamp(Math.round(0.07 / step), 2, 4), D = new Set();
      for (const l of wetLv) D.add(l + gapL);
      if (!D.size && wetEnough) {
        // no spring today: the level with limestone under enough ground and the most valley walls cutting it
        let bestL = -1, bc = 0;
        for (let l = 0; l < 40; l++) {
          let area = 0, walls = 0;
          for (let i = RW; i < RN - RW; i++) {
            if (wt[i] || L[i] < l + 1 || rockAt(i, l) !== R_LIME) continue;
            if (L[i] >= l + 2) area++;
            if (L[i + RW] <= l || L[i - 1] <= l || L[i + 1] <= l || L[i - RW] <= l) walls++;
          }
          const sc = Math.min(area / 12, walls);
          if (area > 60 && walls > 2 && sc > bc) { bc = sc; bestL = l; }
        }
        if (bestL >= 0) D.add(bestL);
      }
      const entC = [];
      for (let i = RW; i < RN - RW; i++) {
        if (wt[i] || built[i]) continue;
        const x = i % RW;
        for (const d of D) {
          if (L[i] < d + 1 || rockAt(i, d) !== R_LIME) continue;
          const q = i + RW;
          if (!wt[q] && L[q] <= d) { entC.push({ i, lv: d, vis: true, k: hash2(i, 9, seed + 677) + 0.5 }); break; }
          if ([i - 1, i + 1, i - RW].some(j => Math.abs(j % RW - x) <= 1 && L[j] <= d)) { entC.push({ i, lv: d, vis: false, k: hash2(i, 9, seed + 677) }); break; }
        }
      }
      entC.sort((a, b) => b.k - a.k);
      const ents = [];
      for (const e of entC) { if (ents.length >= 5) break; if (!ents.some(t => tdist(t.i, e.i) < 6)) ents.push(e); }
      if (ents.length) {
        grow(ents, karstPass, karstCost);
        const inl = pickInlets(i => dist[i] < 1e9 && L[i] >= lvOf[i] + 2 && !dolines.includes(i), 6);
        if (inl.length) {
          trace(inl, 1, K_DRY);
          dolines.push(...inl);
          for (const e of ents) {
            if (cvL[1][e.i] < 0) continue;
            if (e.vis) { fl[e.i] |= F_MOUTH; mouthL[e.i] = e.lv; } else info.hidden++;
          }
          info.levels++;
          if (!info.karst) { info.karst = 1; info.pattern.push('branchwork'); }
        }
      }
    }
    for (const i of dolines) fl[i] |= F_SINK;
    info.dolines = dolines.length;
    // lava tubes: from the highest basalt, a tube runs down the slope with momentum, a terrace under the surface,
    // and its roof has fallen in here and there as skylights
    if (rockCount[R_BAS] > RN * 0.2) {
      const bas = [];
      for (let i = 0; i < RN; i++) { const x = i % RW, y = (i / RW) | 0; if (!wt[i] && rockS[i] === R_BAS && x > 4 && y > 4 && x < RW - 5 && y < RH - 5) bas.push(i); }
      bas.sort((a, b) => hW[b] - hW[a]);
      const vents = [bas[0]];
      for (const i of bas) { if (vents.length >= 2) break; if (tdist(i, vents[0]) >= 18) vents.push(i); }
      for (const v of vents) {
        if (v === undefined) continue;
        const tube = [v], seen = new Set([v]);
        let p = v, dir = -1;
        for (let s = 0; s < 200; s++) {
          const x = p % RW, y = (p / RW) | 0;
          let best = -1, bc = 1e9, bk = -1;
          for (let k = 0; k < 8; k++) {
            const nx = x + DX8[k], ny = y + DY8[k];
            if (nx < 0 || ny < 0 || nx >= RW || ny >= RH) continue;
            const j = ny * RW + nx;
            if (seen.has(j) || (h[j] - h[p]) / step > 0.5 || nx < 1 || ny < 1 || nx >= RW - 1 || ny >= RH - 1) continue; // lava can't climb
            // down the broad slope of the volcano (the smooth world height), with momentum, wandering a little
            const turn = dir < 0 ? 0 : Math.min(Math.abs(k - dir), 8 - Math.abs(k - dir));
            const c = (hW[j] - hW[p]) / (DL8[k] * TILE_KM) * 6 + (h[j] - h[p]) / step * 0.3 + 0.3 * turn + 0.5 * hash2(j, k, seed + 673);
            if (c < bc) { bc = c; best = j; bk = k; }
          }
          if (best < 0 || wt[best] || rockS[best] !== R_BAS) break;
          dir = bk; p = best; seen.add(p); tube.push(p);
        }
        if (tube.length < 8) continue;
        info.lava++;
        tube.forEach((t, k) => {
          const lv = L[t] - 1;
          if (lv < 0) return;
          mark(1, t, lv, K_LAVA);
          if (k > 2 && k % 9 === 5 && !built[t] && !(pathW[t] > 0)) { fl[t] |= F_SINK; info.skylights++; }
        });
      }
    }
    // sea caves where waves meet a cliff of hard rock; shelters at the foot of sandstone cliffs
    {
      const cand = [];
      for (let i = 0; i < RN - RW; i++) {
        if (wt[i] || built[i]) continue;
        const x = i % RW;
        for (const q of [i + RW, i - 1, i + 1, i - RW]) {
          if (q < 0 || q >= RN || Math.abs(q % RW - x) > 1) continue;
          if (wt[q] === W_SEA && L[i] - L[q] >= 2 && rockAt(i, L[q]) !== R_SHALE) { cand.push({ i, q, lv: L[q], kind: K_SEA, k: hash2(i, 11, seed + 679) + (q === i + RW ? 0.6 : 0) }); break; }
          if (q === i + RW && !wt[q] && L[i] - L[q] >= 3 && rockAt(i, L[q]) === R_SAND && cvL[0][i] < 0) { cand.push({ i, q, lv: L[q], kind: K_SHELTER, k: hash2(i, 11, seed + 679) * 0.6 }); break; }
        }
      }
      cand.sort((a, b) => b.k - a.k);
      const took = [];
      for (const c of cand) {
        if ((c.kind === K_SEA ? info.sea >= 4 : info.shelters >= 2) || took.some(t => tdist(t, c.i) < 8)) continue;
        const dx = (c.i % RW) - (c.q % RW), dy = ((c.i / RW) | 0) - ((c.q / RW) | 0), len = c.kind === K_SEA ? 2 + ((hash2(c.i, 13, seed + 681) * 3) | 0) : 1;
        let n = 0;
        for (let s = 0; s < len; s++) {
          const x = (c.i % RW) + dx * s, y = ((c.i / RW) | 0) + dy * s;
          if (x < 0 || y < 0 || x >= RW || y >= RH) break;
          const t = y * RW + x;
          if (wt[t] || L[t] < c.lv + 1) break;
          mark(0, t, c.lv, c.kind); n++;
        }
        if (!n) continue;
        took.push(c.i);
        if (c.q === c.i + RW) { fl[c.i] |= F_MOUTH; mouthL[c.i] = c.lv; }
        if (c.kind === K_SEA) info.sea++; else info.shelters++;
      }
    }
    let caves = 0, mouths = info.hidden;
    for (let i = 0; i < RN; i++) { if (cvL[0][i] >= 0 || cvL[1][i] >= 0) caves++; if (fl[i] & F_MOUTH) mouths++; }
    yield;

    // ---- plants: viability by Liebig's law, spaced by dart throwing with each kind's own radius ----
    reg.stage = 'growing the plants';
    const plants = [];
    const wetOf = i => clamp(Math.max(Math.exp(-dF.d[i] / 2.2), Math.log(A[i]) / Math.log(600) * 0.55), 0, 1);
    const grid = Array.from({ length: RN }, () => null);
    const nearBuilt = distField(built, RW, RH);
    const pathMask = new Uint8Array(RN);
    for (let i = 0; i < RN; i++) pathMask[i] = pathW[i] > 0 || trailW[i] >= 2 ? 1 : 0;
    const dPath = distField(pathMask, RW, RH);
    // tree cover blurred over two tiles, so a wood thins out across its edge instead of stopping at a tile line
    const coverF = blur(Float32Array.from(gt, (b, i) => (wt[i] ? 0 : COVER[b])), RW, RH, 2, 1);
    const cand = [];
    for (let i = 0; i < RN; i++) for (let k = 0; k < 3; k++) cand.push([i, k, hash2(i, k, seed + 571)]);
    cand.sort((a, b) => a[2] - b[2]);
    const fits = (gx, gy, r) => {
      const tx = Math.floor(gx), ty = Math.floor(gy);
      for (let y = ty - 3; y <= ty + 3; y++) for (let x = tx - 3; x <= tx + 3; x++) {
        if (x < 0 || y < 0 || x >= RW || y >= RH) continue;
        const list = grid[y * RW + x];
        if (!list) continue;
        for (const q of list) if (Math.hypot(q.gx - gx, q.gy - gy) < 0.85 * Math.max(r, q.r)) return false;
      }
      return true;
    };
    for (const [i, k] of cand) {
      if (wt[i] || fl[i] & (F_HOUSE | F_FIELD | F_GREEN | F_SINK | F_SPRING)) continue;
      const tx = i % RW, ty = (i / RW) | 0, b = gt[i];
      const gx = tx + 0.15 + hash2(i, k, seed + 573) * 0.7, gy = ty + 0.2 + hash2(i, k, seed + 577) * 0.7;
      const wet = wetOf(i), temp = Tt[i], rain = Pc[i] + wet * 60;
      // where trees grow: the blurred cover, groves and clearings by noise, thinning to nothing round the village
      const x = X(tx), y = Y(ty), grove = fbm(x * 6, y * 6, seed + 581, 3), cf = coverF[i];
      let cover = cf, shrubD = SHRUB[b];
      if (wet > 0.72 && b !== ICE && b !== G_SALT) cover = Math.max(cover, b === DESERT ? 0.25 : 0.5); // gallery woods along water
      const open = 1 - sstep(0.2, 0.45, cf);
      cover *= lerp(sstep(-0.5, -0.22, grove), sstep(0.0, 0.32, grove) * 3, open);
      const clear = sstep(2, 7, nearBuilt.d[i] + gnoise(x * 5, y * 5, seed + 583) * 2.5) * (dPath.d[i] < 1 ? 0 : dPath.d[i] < 2 ? 0.5 : 1);
      // shrubs belong to a wood's mantle and fringe, beside paths and round clearings; under the canopy, few
      const edge = Math.exp(-(((cf - 0.3) / 0.12) ** 2)) + Math.exp(-(((grove + 0.3) / 0.14) ** 2)) * (1 - open) * 0.6 + (dPath.d[i] >= 1 && dPath.d[i] < 2.5 ? 0.5 : 0) + (nearBuilt.d[i] > 1.5 && nearBuilt.d[i] < 4 ? 0.4 : 0);
      cover *= clear; shrubD *= (0.12 + 1.5 * edge) * (dPath.d[i] < 1 ? 0 : 1);
      if (temp < -7.5) cover = 0; // above the treeline
      // which kind, by viability times abundance
      const want = k === 0 ? 'tree' : 'shrub';
      let pick = null, tot = 0, vbest = -1;
      const opts = [];
      for (let si = 0; si < SPECIES.length; si++) {
        const sp = SPECIES[si], kind = sp.kind === 'reed' ? 'shrub' : sp.kind;
        if (kind !== want) continue;
        let v = Math.min(hat(temp, sp.T), hat(rain, sp.P));
        if (sp.soil) v = Math.min(v, rise(dep[i], sp.soil));
        if (sp.wet) v = Math.min(v, rise(wet, sp.wet));
        if (sp.kind === 'reed' && dW.d[i] > 1.5) v = -1;
        if (sp.id === 'palm' && b !== BEACH && wet < 0.6) v = Math.min(v, 0.15);
        if (sp.id === 'heather' || sp.id === 'sagebrush' || sp.id === 'cottongrass') v *= clamp(1 - cf * 1.4, 0.05, 1); // open-ground plants
        if (v <= 0) continue;
        vbest = Math.max(vbest, v);
        // each kind grows in patches (stands of pine, groves of oak) and the best suited dominate
        const patch = 0.25 + 1.5 * sstep(-0.25, 0.35, gnoise(x * 1.3 + si * 17.3, y * 1.3 - si * 5.1, seed + 700));
        const wgt = v * v * sp.ab * patch * (sp.kind === 'reed' ? 6 : 1);
        opts.push([sp, wgt]); tot += wgt;
      }
      if (!opts.length) continue;
      const dens = want === 'tree' ? cover * vbest : shrubD * vbest;
      if (hash2(i, k, seed + 587) > dens) continue;
      let pr = hash2(i, k, seed + 589) * tot;
      for (const [sp, wg] of opts) { pick = sp; pr -= wg; if (pr <= 0) break; }
      if (!fits(gx, gy, pick.r)) continue;
      const q = { gx, gy, r: pick.r, sp: pick, vi: Math.floor(hash2(i, k, seed + 591) * 3), i };
      (grid[i] || (grid[i] = [])).push(q);
      plants.push(q);
    }
    yield;
    // paint the plants' sprites now, a few per slice
    const needed = new Map();
    for (const p of plants) { const s = Tt[p.i] < -4 && /spruce|pine|hemlock|snag/.test(p.sp.id) ? 'winter' : 'summer'; p.season = s; needed.set(p.sp.id + '|' + p.vi + '|' + s, p); }
    let painted = 0;
    for (const [key, p] of needed) {
      if (!spriteCache.has(key)) { plantSprite(p.sp, p.vi, p.season); if (++painted % 4 === 0) yield; }
    }

    // ---- paint: rows from back to front, each row's ground and cliff faces, then the things standing in it ----
    reg.stage = 'painting';
    let lift = 0;
    for (let i = 0; i < RN; i++) lift = Math.max(lift, L[i] * FH - ((i / RW) | 0) * TS);
    const IW = RW * TS, TOP = lift + 26, IH = TOP + RH * TS;
    const buf = new Uint32Array(IW * IH).fill(P('#0e0b16'));
    // path pixels on the ground plane: worn bands along the smoothed tile paths
    const pm = new Uint8Array(IW * RH * TS);
    const stamp = (pts, rad, kind) => {
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * TS));
        for (let s = 0; s <= n; s++) {
          const px = (x0 + (x1 - x0) * s / n) * TS, py = (y0 + (y1 - y0) * s / n) * TS;
          for (let y = Math.floor(py - rad); y <= Math.ceil(py + rad); y++) for (let x = Math.floor(px - rad); x <= Math.ceil(px + rad); x++) {
            if (x < 0 || y < 0 || x >= IW || y >= RH * TS) continue;
            const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
            if (d <= rad) { const o = y * IW + x; if (pm[o] < kind) pm[o] = kind; }
          }
        }
      }
    };
    const toPts = path => chaikin(path.map(i => [(i % RW) + 0.5, ((i / RW) | 0) + 0.5]), 2);
    for (const tr of trailsR) {
      const pts = toPts(tr.filter((c, k) => trailW[c] >= 2 || k > tr.length - 4));
      if (pts.length > 1) stamp(pts, 0.7, 1);
    }
    for (const rd0 of roadsR) stamp(toPts(rd0.path), rd0.kind === 3 ? 2.2 : rd0.kind === 2 ? 1.7 : 1.1, rd0.kind);
    // shading: the continuous height's slope toward the light (northwest), per tile
    const shade = new Float32Array(RN);
    for (let ty = 0; ty < RH; ty++) for (let tx = 0; tx < RW; tx++) {
      const i = ty * RW + tx, a = h[ty * RW + Math.max(0, tx - 1)], b = h[Math.max(0, ty - 1) * RW + tx];
      shade[i] = clamp((a + b - 2 * h[i]) / step * 0.9, -1.2, 1.2);
    }
    const shAt = (gx, gy) => {
      const u = gx / TS - 0.5, v = gy / TS - 0.5, i0 = clamp(Math.floor(u), 0, RW - 2), j0 = clamp(Math.floor(v), 0, RH - 2), fx = clamp(u - i0, 0, 1), fy = clamp(v - j0, 0, 1), k = j0 * RW + i0;
      return (shade[k] * (1 - fx) + shade[k + 1] * fx) * (1 - fy) + (shade[k + RW] * (1 - fx) + shade[k + RW + 1] * fx) * fy;
    };
    // what stands in each row: plants, houses, the well, boats
    const rows = Array.from({ length: RH }, () => []);
    for (const p of plants) rows[Math.min(RH - 1, Math.floor(p.gy))].push({ gy: p.gy, gx: p.gx, s: spriteCache.get(p.sp.id + '|' + p.vi + '|' + p.season), L: L[p.i] });
    if (village) {
      for (const hs of village.houses) rows[hs.y].push({ gy: hs.y + 0.85, gx: hs.x + 1, s: houseSprite(hs.face, hs.v), L: L[hs.y * RW + hs.x] });
      if (village.well) rows[village.y].push({ gy: village.y + 0.6, gx: village.x + 0.5, s: wellSprite(), L: village.L });
      for (const b of village.boats) rows[(b / RW) | 0].push({ gy: ((b / RW) | 0) + 0.6, gx: (b % RW) + 0.5, s: boatSprite(), L: L[b] });
    }
    for (const r of rows) r.sort((a, b) => a.gy - b.gy || a.gx - b.gx);
    // the water surface each tile can show at its own level (its own, or a neighbor's at the same level), and
    // the smooth height between tile centers: a pixel is wet where the height is below that surface
    const wsT = new Float64Array(RN).fill(-1e10), wkT = new Uint8Array(RN);
    for (let i = 0; i < RN; i++) {
      if (wt[i]) { wsT[i] = surf[i]; wkT[i] = wt[i]; continue; }
      const x = i % RW, y = (i / RW) | 0;
      for (let d = 0; d < 8; d++) {
        const nx = x + DX8[d], ny = y + DY8[d];
        if (nx < 0 || ny < 0 || nx >= RW || ny >= RH) continue;
        const j = ny * RW + nx;
        if (wt[j] && L[j] === L[i] && surf[j] > wsT[i]) { wsT[i] = surf[j]; wkT[i] = wt[j]; }
      }
    }
    const hAt = (gx, gy) => {
      const u = (gx + 0.5) / TS - 0.5, v = (gy + 0.5) / TS - 0.5, i0 = clamp(Math.floor(u), 0, RW - 2), j0 = clamp(Math.floor(v), 0, RH - 2), fx = clamp(u - i0, 0, 1), fy = clamp(v - j0, 0, 1), k = j0 * RW + i0;
      return (h[k] * (1 - fx) + h[k + 1] * fx) * (1 - fy) + (h[k + RW] * (1 - fx) + h[k + RW + 1] * fx) * fy;
    };
    const isW = (gx, gy, Lv) => {
      const tx = clamp(gx >> 3, 0, RW - 1), ty = clamp(gy >> 3, 0, RH - 1), t = ty * RW + tx;
      if (L[t] !== Lv) return wt[t] !== 0;
      return wsT[t] > -1e9 && (wt[t] === W_SEA || hAt(clamp(gx, 0, RW * TS - 1), clamp(gy, 0, RH * TS - 1)) < wsT[t]);
    };
    const SHAFT = P('#100a12'), MOUTH_IN = P('#06040a'), MOUTH_RIM = P('#2a2028');
    for (let ty = 0; ty < RH; ty++) {
      for (let tx = 0; tx < RW; tx++) {
        const i = ty * RW + tx, Lv = L[i], sx0 = tx * TS, sy0 = TOP + ty * TS - Lv * FH;
        const back = ty > 0 ? L[i - RW] : Lv, left = tx > 0 ? L[i - 1] : Lv, right = tx < RW - 1 ? L[i + 1] : Lv;
        const wtr = wt[i], flg = fl[i], g3 = GROUND[wtr === W_SEA ? BEACH : gt[i]], nearW = wsT[i] > -1e9;
        const fld = flg & F_FIELD ? village.fields[fieldAt[i]] : null, fid = fieldAt[i];
        const sky = (flg & F_SINK) && cvK[1][i] === K_LAVA, spTo = flg & F_SPRING ? cvTo[i] : -1;
        for (let py = 0; py < TS; py++) {
          const gy = ty * TS + py, row = (sy0 + py) * IW;
          for (let px = 0; px < TS; px++) {
            const gx = sx0 + px;
            let c;
            if (nearW && isW(gx, gy, Lv)) {
              // water, its edge found per pixel from the smooth height, so shores and banks curve
              const kind = wtr || wkT[i], depth = (wsT[i] - hAt(gx, gy)) / step;
              if (kind === W_RIVER) c = hash2(gx >> 1, gy, seed + 601) < 0.05 ? WATER_C.riverLight : WATER_C.river;
              else c = depth < 0.5 ? WATER_C.shallow : depth < 2.2 ? WATER_C.mid : WATER_C.deep;
              if (!isW(gx - 1, gy, Lv) || !isW(gx + 1, gy, Lv) || !isW(gx, gy - 1, Lv) || !isW(gx, gy + 1, Lv)) c = FOAM;
              else if (kind !== W_RIVER && hash2(gx, gy, seed + 603) < 0.008) c = WATER_C.riverLight;
              if (flg & F_BRIDGE) c = px === 0 || px === TS - 1 ? P('#5a3a24') : (py & 1 ? P('#a07848') : P('#8a6238'));
            } else {
              // near a seam between grounds, each pixel reads its ground from a point nudged by a slow noise and an
              // ordered dither, so the 8-pixel steps between biomes turn into a ragged, dithered edge
              let gp = g3, gtp = gt[i];
              if (mixed[i] && (px < 3 || px > 4 || py < 3 || py > 4)) {
                const jx = Math.floor((gx + gnoise(gx * 0.19, gy * 0.19, seed + 541) * 3 + (bay(gx, gy) - 0.5) * 4) / TS);
                const jy = Math.floor((gy + gnoise(gx * 0.19 + 7.7, gy * 0.19, seed + 543) * 3 + (bay(gx + 2, gy + 1) - 0.5) * 4) / TS);
                if (jx >= 0 && jy >= 0 && jx < RW && jy < RH) { const j = jy * RW + jx; if (j !== i && L[j] === Lv && !wt[j]) { gtp = gt[j]; gp = GROUND[gtp]; } }
              }
              const s = shAt(gx, gy) + (bay(gx, gy) - 0.5) * 0.7;
              c = s > 0.45 ? gp[2] : s < -0.45 ? gp[0] : gp[1];
              if (wtr && wtr !== W_SEA) c = shadeC(c, 0.86); // a muddy bank inside a water tile
              if (fld) {
                // fields: furrows along each strip, a darker border where the next field or the open ground begins
                const cc = CROPS[fld.strips ? (fld.crop + (fld.dir ? tx - fld.x0 : ty - fld.y0)) % CROPS.length : fld.crop];
                const edge = (px === 0 && (tx === 0 || fieldAt[i - 1] !== fid)) || (px === TS - 1 && (tx === RW - 1 || fieldAt[i + 1] !== fid)) || (py === 0 && (ty === 0 || fieldAt[i - RW] !== fid)) || (py === TS - 1 && (ty === RH - 1 || fieldAt[i + RW] !== fid));
                const sEdge = fld.strips && ((fld.dir && px === 0) || (!fld.dir && py === 0));
                c = edge ? P('#3e6a2e') : sEdge ? shadeC(cc[1], 0.8) : ((fld.dir ? gx : gy) & 1 ? cc[1] : cc[0]);
              } else if (flg & F_GREEN) c = s > 0.2 ? P('#8cc85a') : P('#74b44a');
              else if (hash2(gx, gy, seed + 607) < 0.014) c = gp[0];
              else if ((gtp === GRASS || gtp === FOREST || gtp === SAVANNA) && hash2(gx >> 1, gy, seed + 609) < 0.012) c = gp[2];
              if (gtp === GRASS && !fld && hash2(gx, gy, seed + 611) < 0.004) c = [P('#f4f1ea'), P('#f7c46c'), P('#d9583f')][(hash2(gx, gy, seed + 613) * 3) | 0];
              const m = pm[gy * IW + gx];
              if (m && !fld) c = m === 1 ? (hash2(gx, gy, seed + 617) < 0.6 ? PATHC[1] : c) : (hash2(gx, gy, seed + 619) < 0.12 ? PATH_DARK : hash2(gx, gy, seed + 621) < 0.1 ? PATH_LIGHT : PATHC[m]);
              if (flg & F_BRIDGE) c = px === 0 || px === TS - 1 ? P('#5a3a24') : (py & 1 ? P('#a07848') : P('#8a6238'));
              // a sinkhole: a bowl in the ground with a dark shaft; a skylight: a hole in the lava's roof
              if (flg & F_SINK) {
                const d = (px - 3.5) ** 2 + (py - 3.5) ** 2 * 1.4;
                if (sky) { if (d < 5) c = d < 2.2 ? MOUTH_IN : INK; else if (d < 9) c = shadeC(c, 0.72); }
                else { if (d < 13) c = shadeC(c, d < 6 ? 0.64 : 0.82); if (d < 1.8) c = SHAFT; }
              }
              // a spring: water welling up on the side toward the river it feeds
              if (spTo >= 0 && spTo !== i + RW) {
                const ddx = (spTo % RW) - tx, ddy = ((spTo / RW) | 0) - ty, along = (px - 3.5) * ddx + (py - 3.5) * ddy, acr = Math.abs((px - 3.5) * ddy - (py - 3.5) * ddx);
                if (along > 1 && acr < 1.6) c = along > 3 ? FOAM : WATER_C.riverLight;
              }
              // rims and shadows: a lit lip where the land drops away north or west, a dark one to the east,
              // and the shadow cliffs to the north and west cast on the ground at their feet
              if ((py === 0 && back < Lv) || (px === 0 && left < Lv)) c = shadeC(c, 1.18);
              else if (px === TS - 1 && right < Lv) c = shadeC(c, 0.78);
              if ((back > Lv && (py === 0 || (py === 1 && (gx & 1)))) || (left > Lv && (px === 0 || (px === 1 && (gy & 1))))) c = shadeC(c, 0.68);
            }
            buf[row + gx] = c;
          }
        }
        // the cliff face below this tile, down to the tile in front (the front row goes down to the base), in the
        // colors of the beds it cuts
        const front = ty < RH - 1 ? L[i + RW] : 0;
        if (front < Lv) {
          const fh = (Lv - front) * FH, fy0 = sy0 + TS;
          const mL = mouthL[i], mouth = (flg & F_MOUTH) && mL >= front && mL < Lv;
          const mb = mouth ? (Lv - mL) * FH - 1 : -1, mt = mouth ? Math.max(1, mb - (Lv - mL >= 2 ? 6 : 3)) : -1;
          const resurge = spTo === i + RW;
          let pal = null, palBand = 1e9;
          for (let r = 0; r < fh; r++) {
            const Y = fy0 + r;
            if (Y >= IH) break;
            const band = Lv - 1 - Math.floor(r / FH), rr = r % FH;
            if (band !== palBand) { palBand = band; pal = STRATA_R[rockAt(i, band)]; }
            for (let px = 0; px < TS; px++) {
              const gx = sx0 + px;
              let c;
              if (wtr && isW(gx, ty * TS + TS - 1, Lv)) {
                // a waterfall: streaks of falling water, foam at its foot
                const k = (gx * 7 + ((r + (gx & 1) * 2) >> 1)) % 5;
                c = r >= fh - 2 ? FOAM : k === 0 ? FOAM : k < 3 ? WATER_C.riverLight : WATER_C.river;
              } else {
                c = pal[(hash2(band, 17, seed + 631) * 3) | 0];
                if (rr === FH - 1 && (band & 1)) c = shadeC(c, 0.82); // bedding planes
                if (hash2(gx, band, seed + 633) < 0.12 && rr > 0 && rr < 3) c = shadeC(c, 0.62); // cracks
                if (px === 0 && left < Lv) c = shadeC(c, 1.12);
                if (px === TS - 1 && right < Lv) c = shadeC(c, 0.8);
                if (r === 0) c = gt[i] === ICE ? GROUND[ICE][1] : gt[i] === G_ROCK || gt[i] === BEACH || gt[i] === DESERT || gt[i] === G_SALT ? shadeC(g3[0], 0.85) : shadeC(g3[0], 0.8);
                else if (r === 1 && hash2(gx, 3, seed + 635) < 0.45 && gt[i] !== G_ROCK && gt[i] !== DESERT && gt[i] !== BEACH) c = shadeC(g3[0], 0.7);
                // a path down the cliff is cut into steps
                if (pm[(ty * TS + TS - 1) * IW + gx] >= 2 && r > 0 && r < fh - 1) c = (r & 1) ? PATH_DARK : PATHC[2];
                // a cave mouth, opening at the height of its own level in the face
                if (mouth && px >= 2 && px <= 5 && r >= mt && r <= mb) c = (r === mt && (px === 2 || px === 5)) ? c : r === mt || px === 2 || px === 5 ? MOUTH_RIM : MOUTH_IN;
                // a spring at the foot of the face, the river's water issuing from the rock
                if (resurge && px >= 2 && px <= 5 && r >= fh - 4) c = r === fh - 4 ? MOUTH_RIM : px === 3 || px === 4 ? (r >= fh - 2 ? FOAM : WATER_C.riverLight) : MOUTH_IN;
                if (r === fh - 1 && !(resurge && (px === 3 || px === 4))) c = INK;
              }
              buf[Y * IW + gx] = c;
            }
          }
        }
      }
      // the things standing in this row, back to front
      for (const o of rows[ty]) if (o.s) blit(buf, IW, IH, o.s, Math.round(o.gx * TS), Math.round(TOP + o.gy * TS - o.L * FH));
      if ((ty & 7) === 7) yield;
    }
    const mk = () => { const c = document.createElement('canvas'); c.width = IW; c.height = IH; return c; };
    const img = mk(), ictx = img.getContext('2d'), id = ictx.createImageData(IW, IH);
    new Uint32Array(id.data.buffer).set(buf);
    ictx.putImageData(id, 0, 0);
    yield;
    // ---- underground: the surface darkened, and the passages under it drawn as a cutaway, each at its own level ----
    reg.stage = 'mapping the caves';
    const ub = new Uint32Array(buf.length);
    for (let k = 0; k < buf.length; k++) { const c = buf[k]; ub[k] = pack(((c & 255) * 0.16 + 8) | 0, (((c >>> 8) & 255) * 0.16 + 8) | 0, (((c >>> 16) & 255) * 0.2 + 16) | 0); }
    const FLOOR = [];
    FLOOR[K_WET] = ['#4c4638', '#5a5446', '#6a6452'].map(P); FLOOR[K_DRY] = ['#766c58', '#8a8068', '#a09478'].map(P);
    FLOOR[K_LAVA] = ['#3a3440', '#4a4452', '#5c5464'].map(P); FLOOR[K_SEA] = ['#22506c', '#2a5a7a', '#336a8c'].map(P); FLOOR[K_SHELTER] = ['#86583c', '#9a6a4a', '#b07a54'].map(P);
    const STREAM = P('#3c90cc'), STREAM_L = P('#6cc0e4'), STAL = P('#efe6cc'), DAY = [P('#f7c46c'), P('#d9a050')], EDGE = P('#100a12');
    // a stream pixel: within reach of the segment from the tile's middle toward a neighbor's middle
    const nearSeg = (qx, qy, dx, dy) => { const l2 = dx * dx + dy * dy, t = clamp((qx * dx + qy * dy) / l2, 0, 1); return Math.hypot(qx - dx * t, qy - dy * t); };
    for (let ty = 0; ty < RH; ty++) for (const slot of [0, 1]) for (let tx = 0; tx < RW; tx++) {
      const i = ty * RW + tx, lv = cvL[slot][i];
      if (lv < 0) continue;
      const kind = cvK[slot][i], sx0 = tx * TS, sy0 = TOP + ty * TS - lv * FH, fc = FLOOR[kind];
      const open = j => cvL[slot][j] >= 0 && Math.abs(cvL[slot][j] - lv) <= 1;
      const backC = ty > 0 && open(i - RW), leftC = tx > 0 && open(i - 1), rightC = tx < RW - 1 && open(i + 1), frontC = ty < RH - 1 && open(i + RW);
      const wallP = STRATA_R[rockAt(i, lv + 1)].map(c => shadeC(c, 0.55));
      // the stream: this tile's way down toward its spring, and the ways in from the tiles that drain into it
      const segs = [];
      if (slot === 0 && kind === K_WET) {
        if (cvTo[i] >= 0) segs.push([(cvTo[i] % RW) - tx, ((cvTo[i] / RW) | 0) - ty]);
        for (let d = 0; d < 8; d++) { const nx = tx + DX8[d], ny = ty + DY8[d]; if (nx >= 0 && ny >= 0 && nx < RW && ny < RH && cvTo[ny * RW + nx] === i && cvL[0][ny * RW + nx] >= 0) segs.push([DX8[d], DY8[d]]); }
      }
      const lit = (fl[i] & F_SINK) && (slot === 1 || kind === K_WET), mo = (fl[i] & F_MOUTH) && mouthL[i] === lv;
      for (let py = 0; py < TS; py++) {
        const Y = sy0 + py;
        if (Y < 0 || Y >= IH) continue;
        for (let px = 0; px < TS; px++) {
          const gx = sx0 + px, gy = ty * TS + py;
          let c = fc[hash2(gx, gy, seed + 641) < 0.15 ? 0 : hash2(gx, gy, seed + 643) < 0.1 ? 2 : 1];
          if (kind === K_LAVA && (gx + gy * 2) % 6 === 0) c = fc[0]; // the ropy floor of a drained tube
          if (kind === K_DRY && hash2(gx, gy, seed + 647) < 0.04) c = STAL; // stalagmites in the dry passages
          if (kind === K_SEA && hash2(gx, gy, seed + 649) < 0.04) c = FOAM;
          for (const [dx, dy] of segs) if (nearSeg(px - 3.5, py - 3.5, dx * TS, dy * TS) < 1.3) { c = hash2(gx, gy, seed + 651) < 0.15 ? STREAM_L : STREAM; break; }
          if (!backC && py < 3) c = wallP[(py + (hash2(gx, ty, seed) * 2 | 0)) % 3]; // the back wall of the passage, in its rock
          if ((!leftC && px === 0) || (!rightC && px === TS - 1) || (!frontC && py === TS - 1) || (!backC && py === 3)) c = EDGE;
          if (lit && Math.hypot(px - 3.5, py - 4.5) < 2.2) c = DAY[(px + py) & 1]; // daylight down a shaft or skylight
          if (mo && py > 3 && px > 0 && px < TS - 1) c = DAY[(px + py) & 1]; // daylight at a mouth
          ub[Y * IW + gx] = c;
        }
      }
    }
    const uimg = mk(), uctx = uimg.getContext('2d'), uid = uctx.createImageData(IW, IH);
    new Uint32Array(uid.data.buffer).set(ub);
    uctx.putImageData(uid, 0, 0);
    // ---- the scores, for the overlay: the village site score on every tile top ----
    const simg = mk(), sctx = simg.getContext('2d');
    let smax = 0, smin = 1e9;
    for (let i = 0; i < RN; i++) if (score[i] > 0) { smax = Math.max(smax, score[i]); smin = Math.min(smin, score[i]); }
    for (let i = 0; i < RN; i++) {
      if (score[i] <= 0) continue;
      const v = (score[i] - smin) / (smax - smin || 1), tx = i % RW, ty = (i / RW) | 0;
      sctx.fillStyle = css(mixC(mixC(P('#2f2b9a'), P('#f0d040'), clamp(v * 1.6 - 0.3, 0, 1)), P('#f03a2a'), clamp(v * 3 - 2, 0, 1)));
      sctx.fillRect(tx * TS, TOP + ty * TS - L[i] * FH, TS, TS);
    }
    if (village) {
      const vx = village.x * TS + 4, vy = TOP + village.y * TS - village.L * FH + 4;
      sctx.fillStyle = '#ffffff';
      for (let a = 0; a < 40; a++) sctx.fillRect(Math.round(vx + Math.cos(a / 40 * Math.PI * 2) * 12), Math.round(vy + Math.sin(a / 40 * Math.PI * 2) * 9), 1, 1);
    }
    Object.assign(reg, {
      img, uimg, simg, IW, IH, TOP, step, village, caves, mouths, fam, caveInfo: info,
      cam: village ? [village.x * TS + 4, TOP + village.y * TS - village.L * FH] : [IW / 2, IH / 2],
      ms: performance.now() - t0, nPlants: plants.length, biome: BIOME_NAME[cb === 255 ? BEACH : cb] || 'sea',
      T: w.T[ci], Pv: w.P[ci], ready: true, stage: 'done',
    });
  }

  // ===================================================================================================
  // the demo
  // ===================================================================================================
  Kit.register('geo-world', { title: 'Geology first: plates, erosion, rain and roads make a world; tap it to embark on a region', fit: 'prebake' }, host => {
    const VW = 320, VH = 256, MAPX = 0, PANEL = 256;
    const cv = Kit.canvas(host, VW, VH);
    const g = cv.g;
    cv.cv.style.touchAction = 'none'; cv.cv.style.cursor = 'crosshair';
    const mapCv = document.createElement('canvas');
    mapCv.width = N; mapCv.height = N;
    const mg = mapCv.getContext('2d'), mapImg = mg.createImageData(N, N), mapPx = new Uint32Array(mapImg.data.buffer);

    let seed = 4242, world = null, gen = null, tab = 'Plates', follow = true, dirty = true, mapDirty = true, lastStage = '';
    let view = 'world', region = null, rgen = null, sel = null, showScores = false, under = false;
    const times = {};
    let tStart = 0, tTotal = 0;

    function start() {
      world = { seed, done: {}, stage: 'Plates', progress: 0 };
      gen = buildWorld(world);
      for (const s of STAGES) times[s] = 0;
      tStart = performance.now(); tTotal = 0;
      follow = true; tab = 'Plates'; setTab(tab);
      view = 'world'; region = null; rgen = null; sel = null;
      dirty = mapDirty = true;
    }

    // ---- drawing ----
    function legend() {
      const x0 = PANEL;
      g.fillStyle = '#15131c'; g.fillRect(x0, 0, VW - x0, VH);
      text(g, tab, x0 + 4, 4, '#f4f1ea');
      const sw = (y, c, label) => { g.fillStyle = typeof c === 'string' ? c : css(c); g.fillRect(x0 + 4, y, 5, 5); text(g, label, x0 + 12, y, '#cdcbd9'); };
      let y = 14;
      if (tab === 'Height' || tab === 'Erosion') {
        for (const [v, l] of [[3, '3 KM'], [2, '2 KM'], [1, '1 KM'], [0.3, '300 M'], [0.02, 'COAST'], [-0.2, 'SHELF'], [-3, 'DEEP']]) { sw(y, tab === 'Height' ? HYPSO.at(v) : v > 0 ? mixC(P('#5f7a52'), P('#e8e2d0'), clamp(v / 2.6, 0, 1)) : HYPSO.at(v), l); y += 8; }
        if (tab === 'Erosion') { sw(y, RIVER, 'DRAINAGE'); y += 8; if (world.iter) { text(g, 'STEP ' + world.iter + '/16', x0 + 4, y + 4, '#9b98b0'); } }
      } else if (tab === 'Plates') {
        sw(y, '#9a9a5e', 'CONTINENT'); y += 8; sw(y, '#33598f', 'OCEANIC'); y += 8;
        sw(y, '#ff5a3a', 'COLLIDE'); y += 8; sw(y, '#6ff0f0', 'SPREAD'); y += 8; sw(y, '#f0e070', 'SLIDE'); y += 8;
        text(g, 'ARROWS:', x0 + 4, y + 2, '#9b98b0'); text(g, 'DRIFT', x0 + 4, y + 9, '#9b98b0');
      } else if (tab === 'Water') {
        sw(y, RIVER, 'RIVER'); y += 8; sw(y, LAKE, 'LAKE'); y += 8; sw(y, SALT_LAKE, 'SALT LAKE'); y += 8; sw(y, SALT, 'SALT FLAT'); y += 8; sw(y, SHALLOW, 'COAST'); y += 8; sw(y, SHELF, 'SHELF'); y += 8; sw(y, OCEAN, 'OCEAN');
      } else if (tab === 'Temp') {
        for (const v of [25, 15, 5, -5, -15]) { sw(y, TEMP.at(v), v + ' C'); y += 8; }
        text(g, 'LINES 5 C', x0 + 4, y + 2, '#9b98b0');
      } else if (tab === 'Rain') {
        for (const v of [250, 150, 80, 40, 15]) { sw(y, RAIN.at(v), v + ' CM'); y += 8; }
        text(g, 'ARROWS:', x0 + 4, y + 2, '#9b98b0'); text(g, 'WIND', x0 + 4, y + 9, '#9b98b0');
      } else if (tab === 'Biomes' || tab === 'Final') {
        for (let b = 0; b < 11; b++) { sw(y, BIOME_COL[b], BIOME_SHORT[b]); y += 8; }
        if (tab === 'Final') { y += 2; sw(y, ROAD, 'ROAD'); y += 8; sw(y, TRAIL, 'TRAIL'); y += 8; sw(y, '#f4f1ea', 'VILLAGE'); y += 8; }
      } else if (tab === 'Soil') {
        for (let s = 0; s < 7; s++) { sw(y, SOIL_COL[s], SOIL_SHORT[s]); y += 8; }
      } else if (tab === 'Rock') {
        for (const r of [R_LIME, R_SAND, R_SHALE, R_GRAN, R_BAS]) { sw(y, ROCK_COL[r], ROCK_NAME[r]); y += 8; }
        sw(y, '#5a5040', 'KARST'); y += 8;
        text(g, 'CAVES:', x0 + 4, y + 4, '#9b98b0'); text(g, 'KARST IN', x0 + 4, y + 11, '#9b98b0'); text(g, 'LIMESTONE,', x0 + 4, y + 18, '#9b98b0'); text(g, 'LAVA TUBES', x0 + 4, y + 25, '#9b98b0'); text(g, 'IN BASALT', x0 + 4, y + 32, '#9b98b0');
      }
      // progress, or a hint
      if (gen) {
        const st = world.stage, k = STAGES.indexOf(st);
        text(g, st, x0 + 4, VH - 26, '#f08d4f');
        text(g, (k + 1) + '/' + STAGES.length, x0 + 4, VH - 18, '#9b98b0');
        g.fillStyle = '#2f2b4a'; g.fillRect(x0 + 4, VH - 9, 56, 3);
        g.fillStyle = '#f08d4f'; g.fillRect(x0 + 4, VH - 9, Math.round(56 * (k + clamp(world.progress, 0, 1)) / STAGES.length), 3);
      } else {
        text(g, 'TAP A CELL', x0 + 4, VH - 18, '#f7c46c'); text(g, 'TO EMBARK', x0 + 4, VH - 11, '#f7c46c');
      }
    }
    function drawWorld() {
      if (mapDirty) { paintWorld(world, tab, mapPx); mg.putImageData(mapImg, 0, 0); mapDirty = false; }
      g.imageSmoothingEnabled = false;
      g.drawImage(mapCv, MAPX, 0);
      // overlays drawn with fillRect: drift arrows, wind, villages, the region a tap would open
      if (tab === 'Plates' && world.plates) {
        for (const p of world.plates) arrow(p.x, p.y, p.vx * 16, p.vy * 16, '#f4f1ea');
      }
      if (tab === 'Rain' && world.done.Climate) {
        for (let y = 16; y < N; y += 32) for (let x = 16; x < N; x += 32) arrow(x, y, world.lat(y) > 30 ? 9 : -9, 0, 'rgba(14,11,22,0.75)');
      }
      if ((tab === 'Final' || tab === 'Biomes') && world.towns && world.done.Settlements) {
        if (showScores) {
          for (let y = 0; y < N; y += 2) for (let x = 0; x < N; x += 2) {
            const s = world.score[y * N + x];
            if (s <= 0.35) continue;
            g.globalAlpha = clamp((s - 0.35) * 3, 0, 0.85); g.fillStyle = s > 0.62 ? '#ff4030' : s > 0.52 ? '#f7a040' : '#f7e070'; g.fillRect(x, y, 2, 2);
          }
          g.globalAlpha = 1;
        }
        for (const t of world.towns) {
          const r = t.big ? 2 : 1;
          g.fillStyle = '#0e0b16'; g.fillRect(t.x - r - 1, t.y - r - 1, r * 2 + 3, r * 2 + 3);
          g.fillStyle = t.big ? '#f7c46c' : '#f4f1ea'; g.fillRect(t.x - r, t.y - r, r * 2 + 1, r * 2 + 1);
          if (t.big) { g.fillStyle = '#a8333a'; g.fillRect(t.x - r, t.y - r, r * 2 + 1, 1); }
        }
      }
      if (sel) {
        const [sx, sy] = sel;
        g.strokeStyle = '#f7c46c'; g.lineWidth = 1;
        g.fillStyle = '#f7c46c';
        const x0 = Math.round(sx + 0.5 - RW / TPC / 2), y0 = Math.round(sy + 0.5 - RH / TPC / 2), x1 = x0 + Math.round(RW / TPC) - 1, y1 = y0 + Math.round(RH / TPC) - 1; // the region's footprint
        g.fillRect(x0, y0 - 1, x1 - x0 + 1, 1); g.fillRect(x0, y1, x1 - x0 + 1, 1); g.fillRect(x0 - 1, y0 - 1, 1, y1 - y0 + 2); g.fillRect(x1 + 1, y0 - 1, 1, y1 - y0 + 2);
      }
      legend();
    }
    function arrow(x, y, dx, dy, col) {
      g.fillStyle = col;
      const n = Math.max(1, Math.round(Math.hypot(dx, dy)));
      for (let s = 0; s <= n; s++) g.fillRect(Math.round(x + dx * s / n), Math.round(y + dy * s / n), 1, 1);
      const L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, hx = x + dx, hy = y + dy;
      for (let s = 1; s <= 3; s++) {
        g.fillRect(Math.round(hx - ux * s - uy * s), Math.round(hy - uy * s + ux * s), 1, 1);
        g.fillRect(Math.round(hx - ux * s + uy * s), Math.round(hy - uy * s - ux * s), 1, 1);
      }
    }
    function render() {
      if (view === 'world' || !region) drawWorld();
      else drawRegion();
    }

    // ---- the frame: run the generators for a few milliseconds, then draw if anything changed ----
    function frame() {
      if (gen) {
        const t0 = performance.now();
        while (performance.now() - t0 < 12) {
          const st = world.stage, a = performance.now();
          const r = gen.next();
          times[st] = (times[st] || 0) + performance.now() - a;
          if (r.done) { gen = null; tTotal = performance.now() - tStart; break; }
          if (world.stage !== st) break; // show each finished stage for at least a frame
        }
        if (follow && world.stage !== lastStage) { lastStage = world.stage; tab = STAGE_TAB[world.stage] || tab; setTab(tab); }
        mapDirty = dirty = true;
        note();
      }
      if (rgen) {
        const t0 = performance.now();
        while (performance.now() - t0 < 14) { const r = rgen.next(); if (r.done) { rgen = null; break; } }
        dirty = true; note();
      }
      if (dirty) { render(); dirty = false; }
    }
    let noteEl = null;
    const caveText = r => {
      const c = r.caveInfo, parts = [], pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
      if (c.karst) parts.push(`${c.pattern.join(', ')} karst at ${pl(c.levels, 'level')} (${pl(c.springs, 'spring')}, ${pl(c.dolines, 'sinkhole')})`);
      if (c.lava) parts.push(`${pl(c.lava, 'lava tube')} with ${pl(c.skylights, 'skylight')}`);
      if (c.sea) parts.push(pl(c.sea, 'sea cave'));
      if (c.shelters) parts.push(pl(c.shelters, 'rock shelter'));
      return parts.length ? `Caves: ${parts.join('; ')}; ${pl(r.mouths, 'mouth')}.` : `No caves in its ${r.fam}.`;
    };
    function note() {
      if (!noteEl) return;
      const ms = STAGES.map(s => s.toLowerCase() + ' ' + Math.round(times[s] || 0)).join(', ');
      if (gen) noteEl.textContent = `Building the world: ${world.stage.toLowerCase()}... (${ms} ms)`;
      else if (rgen) noteEl.textContent = `Embarking on ${sel[0]},${sel[1]}: ${region ? region.stage : ''}...`;
      else if (view === 'region' && region && region.ready) {
        const r = region, v = r.village;
        noteEl.textContent = `Region ${r.cx},${r.cy}: ${r.biome}, ${Math.round(r.T)} C, ${Math.round(r.Pv)} cm of rain a year, ${r.fam} in terraces of ${Math.round(r.step * 1000)} m. ` +
          `${v ? `A ${FORM_NAME[v.form]}${v.big ? ' (a town)' : ''} of ${v.houses.length} houses and ${v.fields.length} field${v.fields.length === 1 ? '' : 's'}` : 'No village'}, ${r.nPlants} plants. ${caveText(r)} Built in ${Math.round(r.ms)} ms.`;
      }
      else noteEl.textContent = `World of seed ${seed} built in ${Math.round(tTotal)} ms of wall time; work per stage: ${ms} ms. ${world.towns ? world.towns.length : 0} villages, ${world.roads ? world.roads.length : 0} roads, ${world.lakes ? world.lakes.filter(l => !l.salt).length : 0} lakes, ${world.lakes ? world.lakes.filter(l => l.salt).length : 0} salt flats.`;
    }

    // ---- the region: drawn from its cached pictures at a whole-number zoom ----
    const regions = new Map();
    let zoom = 1;
    const clampCam = () => {
      const vw = VW / zoom, vh = VH / zoom, c = region.cam;
      c[0] = region.IW <= vw ? region.IW / 2 : clamp(c[0], vw / 2, region.IW - vw / 2);
      c[1] = region.IH <= vh ? region.IH / 2 : clamp(c[1], vh / 2, region.IH - vh / 2);
    };
    function drawRegion() {
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#0e0b16'; g.fillRect(0, 0, VW, VH);
      if (!region.ready) {
        text(g, 'EMBARKING ON ' + sel[0] + ',' + sel[1], 10, VH / 2 - 10, '#f4f1ea');
        text(g, region.stage, 10, VH / 2, '#f08d4f');
        return;
      }
      clampCam();
      const vw = Math.ceil(VW / zoom), vh = Math.ceil(VH / zoom);
      const sx = Math.round(region.cam[0] - VW / zoom / 2), sy = Math.round(region.cam[1] - VH / zoom / 2);
      const put = im => g.drawImage(im, sx, sy, vw, vh, 0, 0, vw * zoom, vh * zoom);
      put(under ? region.uimg : region.img);
      if (showScores) { g.globalAlpha = 0.55; put(region.simg); g.globalAlpha = 1; }
      if (under && !region.caves) { g.globalAlpha = 0.82; g.fillStyle = '#0e0b16'; g.fillRect(0, VH / 2 - 8, VW, 15); g.globalAlpha = 1; text(g, 'NO CAVES IN ' + region.fam, 10, VH / 2 - 3, '#f7c46c'); }
      g.globalAlpha = 0.82; g.fillStyle = '#0e0b16'; g.fillRect(0, 0, VW, 11); g.globalAlpha = 1;
      text(g, '< WORLD', 3, 3, '#f7c46c');
      text(g, (under ? 'UNDERGROUND  ' : '') + region.biome + '  ' + Math.round(region.T) + ' C  ' + Math.round(region.Pv) + ' CM', 40, 3, '#cdcbd9');
      text(g, zoom + 'X', VW - 12, 3, '#9b98b0');
      if (showScores) {
        const x0 = VW - 70, y0 = VH - 10;
        g.globalAlpha = 0.82; g.fillStyle = '#0e0b16'; g.fillRect(x0 - 3, y0 - 3, 73, 13); g.globalAlpha = 1;
        text(g, 'SITE SCORE', x0, y0, '#cdcbd9');
        for (let k = 0; k < 10; k++) { g.fillStyle = css(mixC(mixC(P('#2f2b9a'), P('#f0d040'), clamp(k / 9 * 1.6 - 0.3, 0, 1)), P('#f03a2a'), clamp(k / 9 * 3 - 2, 0, 1))); g.fillRect(x0 + 42 + k * 2, y0, 2, 5); }
      }
    }
    function embark(x, y) {
      sel = [x, y]; view = 'region'; zoom = 1;
      const key = x + ',' + y;
      region = regions.get(key);
      if (!region) {
        region = { cx: x, cy: y, stage: 'starting', ready: false };
        regions.set(key, region);
        rgen = buildRegion(world, region);
        if (regions.size > 6) regions.delete(regions.keys().next().value);
      } else if (!region.ready) rgen = buildRegion(world, region);
      dirty = true; note();
    }
    function back() { view = 'world'; rgen = region && !region.ready ? (regions.delete(sel[0] + ',' + sel[1]), null) : rgen; mapDirty = dirty = true; note(); }

    // ---- input: tap the map to embark; in a region drag to pan, pinch or scroll to zoom ----
    const art = e => { const r = cv.cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * VW, (e.clientY - r.top) / r.height * VH]; };
    const pts = new Map();
    let down = null, drag = null, pinch = null;
    const live = () => view === 'region' && region && region.ready;
    const setZoom = (z, ax = VW / 2, ay = VH / 2) => {
      z = clamp(z, 1, 4);
      if (z === zoom || !live()) return;
      const c = region.cam;
      c[0] += (ax - VW / 2) / zoom - (ax - VW / 2) / z; c[1] += (ay - VH / 2) / zoom - (ay - VH / 2) / z;
      zoom = z; dirty = true;
    };
    cv.cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      cv.cv.setPointerCapture(e.pointerId);
      const p = art(e);
      pts.set(e.pointerId, p);
      if (pts.size === 1) { down = { p, moved: false }; drag = live() ? { p, cam: region.cam.slice() } : null; }
      else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d0: Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])), z0: zoom }; drag = null; if (down) down.moved = true;
      }
    });
    cv.cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      const p = art(e);
      pts.set(e.pointerId, p);
      if (down && Math.hypot(p[0] - down.p[0], p[1] - down.p[1]) > 4) down.moved = true;
      if (!live()) return;
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        setZoom(Math.round(pinch.z0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d0), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      } else if (drag) {
        region.cam[0] = drag.cam[0] - (p[0] - drag.p[0]) / zoom; region.cam[1] = drag.cam[1] - (p[1] - drag.p[1]) / zoom;
        dirty = true;
      }
    });
    const up = e => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 1 && live()) { const q = [...pts.values()][0]; drag = { p: q, cam: region.cam.slice() }; }
      if (pts.size) return;
      const d = down; down = null; drag = null;
      if (!d || d.moved || e.type === 'pointercancel') return;
      const [x, y] = d.p;
      if (view === 'world') {
        if (gen) return;
        let mx = Math.floor(x - MAPX), my = Math.floor(y);
        if (mx < 0 || mx >= N || my < 0 || my >= N) return;
        // a tap close to a village visits the village
        let best = 3.5;
        for (const t of world.towns || []) { const d = Math.hypot(t.x - mx, t.y - my); if (d < best) { best = d; mx = t.x; my = t.y; } }
        embark(mx, my);
      } else if (y < 11 && x < 34) back();
    };
    cv.cv.addEventListener('pointerup', up);
    cv.cv.addEventListener('pointercancel', up);
    let wheelAcc = 0;
    cv.cv.addEventListener('wheel', e => {
      if (!live()) return;
      e.preventDefault();
      wheelAcc += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      if (Math.abs(wheelAcc) < 50) return;
      const [x, y] = art(e);
      setZoom(zoom + (wheelAcc < 0 ? 1 : -1), x, y);
      wheelAcc = 0;
    }, { passive: false });

    // ---- controls ----
    const bar = Kit.bar(host);
    bar.seed(seed, s => { seed = s; regions.clear(); start(); });
    const tabsEl = bar.tabs(TABS, t => { tab = t; follow = false; if (view !== 'world') back(); mapDirty = dirty = true; note(); }, tab);
    function setTab(t) { for (const b of tabsEl.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.textContent === t)); }
    const bar2 = Kit.bar(host);
    bar2.button('Back to world', back);
    bar2.check('Underground', under, v => { under = v; dirty = true; });
    bar2.check('Show scores', showScores, v => { showScores = v; dirty = mapDirty = true; });
    noteEl = Kit.bar(host).note('');
    Kit.bar(host).note('Watch the world build stage by stage, or pick a tab to see one stage. Tap the map to embark on that place: drag to pan, pinch or scroll to zoom, Back to return.');
    start();
    const L = Kit.loop(host, () => {}, frame, 30);
    // with reduced motion the loop draws once and waits, but building still has to run: drive the frames here
    if (L.reduced) { const pump = () => { frame(); requestAnimationFrame(pump); }; requestAnimationFrame(pump); }
  });
})();
