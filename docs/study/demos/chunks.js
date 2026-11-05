// chunks.js: the `chunks` demo, an endless seeded world you can zoom from a region map down to single plants.
// After Merryfolk's zoom: a few whole-number steps, each with its own cache of chunk pictures. A chunk shows a flat
// sketch (or the coarser step's picture) until it is painted, nearest the middle first, a few milliseconds a frame,
// and the chunks seen longest ago are let go. Each step draws less: biome colors far out, then trees as speckle,
// blobs, half-size sprites, full sprites, and last every flower and grass tuft. One hash decides each plant at
// every step, so the speckle you see from far away is the forest you walk into. Plants come from window.Flora
// (demos/flora.js) when it is loaded, otherwise from a small set of blob plants in this file.
'use strict';
(() => {
  const PAL = Kit.PAL, hash2 = Kit.hash2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // Gradient noise on a hashed lattice with eight fixed gradients (the trick from worlds-shared.js: no cos or sin, so fast).
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

  // colors as packed little-endian pixels for a Uint32Array over ImageData, and back
  const rgbOf = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const pack = ([r, g, b]) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
  const P = h => pack(rgbOf(h));
  const shade = ([r, g, b], k) => [clamp(Math.round(r * k), 0, 255), clamp(Math.round(g * k), 0, 255), clamp(Math.round(b * k), 0, 255)];
  // 4x4 ordered dither thresholds, 0..1
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

  // A 3x5 pixel font for the label on the canvas.
  const GLYPH = {
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
    G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5],
    N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
    U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
    0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6], 4: [5, 5, 7, 1, 1],
    5: [7, 4, 6, 1, 6], 6: [3, 4, 6, 5, 2], 7: [7, 1, 2, 2, 2], 8: [2, 5, 2, 5, 2], 9: [2, 5, 3, 1, 6],
    '/': [1, 1, 2, 4, 4], ' ': [0, 0, 0, 0, 0],
  };
  function text(g, s, x, y, c) {
    g.fillStyle = c;
    for (let i = 0; i < s.length; i++) {
      const gl = GLYPH[s[i].toUpperCase()] || GLYPH[' '];
      for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (gl[r] & (4 >> b)) g.fillRect(x + i * 4 + b, y + r, 1, 1);
    }
  }

  // ---- fallback plants, with Flora's interface, for when demos/flora.js isn't loaded ----
  const Fallback = (() => {
    const species = [
      { id: 'oak', name: 'Oak', kind: 'tree', biomes: ['forest', 'meadow'], h: [18, 26], c: '#2f7a3b' },
      { id: 'birch', name: 'Birch', kind: 'tree', biomes: ['forest', 'meadow', 'taiga'], h: [18, 24], c: '#5aa546' },
      { id: 'pine', name: 'Pine', kind: 'tree', biomes: ['taiga', 'tundra'], h: [20, 30], c: '#1f5131' },
      { id: 'palm', name: 'Palm', kind: 'tree', biomes: ['beach', 'jungle', 'desert'], h: [20, 28], c: '#5aa546' },
      { id: 'kapok', name: 'Kapok', kind: 'tree', biomes: ['jungle'], h: [24, 32], c: '#1f5131' },
      { id: 'willow', name: 'Willow', kind: 'tree', biomes: ['swamp'], h: [18, 24], c: '#5aa546' },
      { id: 'bush', name: 'Bush', kind: 'shrub', biomes: ['forest', 'meadow', 'jungle', 'swamp'], h: [7, 10], c: '#2f7a3b' },
      { id: 'juniper', name: 'Juniper', kind: 'shrub', biomes: ['taiga', 'tundra'], h: [6, 9], c: '#1f5131' },
      { id: 'reed', name: 'Reed', kind: 'shrub', biomes: ['swamp', 'beach'], h: [8, 11], c: '#9ccf5a' },
      { id: 'cactus', name: 'Cactus', kind: 'succulent', biomes: ['desert'], h: [10, 18], c: '#2f7a3b' },
      { id: 'daisy', name: 'Daisy', kind: 'flower', biomes: ['meadow', 'forest'], h: [3, 5], c: '#f4f1ea' },
      { id: 'poppy', name: 'Poppy', kind: 'flower', biomes: ['meadow'], h: [4, 6], c: '#a8333a' },
      { id: 'bluebell', name: 'Bluebell', kind: 'flower', biomes: ['forest', 'taiga', 'jungle'], h: [3, 5], c: '#1f6aa0' },
      { id: 'cotton', name: 'Cotton grass', kind: 'flower', biomes: ['tundra', 'swamp'], h: [3, 5], c: '#f4f1ea' },
      { id: 'bloom', name: 'Desert bloom', kind: 'flower', biomes: ['desert', 'beach'], h: [3, 4], c: '#b464b0' },
      { id: 'tuft', name: 'Grass', kind: 'ground', biomes: ['meadow', 'forest', 'jungle', 'swamp', 'taiga'], h: [3, 5], c: '#5aa546' },
      { id: 'fern', name: 'Fern', kind: 'ground', biomes: ['forest', 'jungle', 'taiga'], h: [4, 6], c: '#2f7a3b' },
      { id: 'moss', name: 'Moss', kind: 'ground', biomes: ['tundra', 'taiga'], h: [2, 3], c: '#1f5131' },
      { id: 'dunegrass', name: 'Dune grass', kind: 'ground', biomes: ['beach', 'desert'], h: [3, 5], c: '#bd8f5e' },
    ];
    const byId = {};
    species.forEach(s => { byId[s.id] = s; });
    // a disc filled by color(dx, dy) with dx, dy in -1..1
    const disc = (p, cx, cy, rx, ry, col) => {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) p.set(x, y, col(dx, dy));
      }
    };
    const leafy = (dark, base, light) => (dx, dy) => (dx + dy > 0.45 ? dark : dx + dy < -0.7 ? light : base);
    function paint(id, seed, opts = {}) {
      const sp = byId[id] || species[0], r = Kit.rng((seed >>> 0) + 1);
      const H = clamp(Math.round(opts.size || (sp.h[0] + sp.h[1]) / 2), 2, 64);
      const big = sp.kind === 'tree' || sp.kind === 'shrub' || sp.kind === 'succulent';
      const W = big ? (Math.round(H * (sp.kind === 'shrub' ? 1.3 : id === 'kapok' ? 1 : 0.75)) | 1) + 2 : 7;
      const p = new Kit.Pix(W, H + 2), mx = W >> 1, fy = H; // foot at (mx, fy)
      if (id === 'pine') {
        p.rect(mx, fy - 2, 1, 3, 27);
        for (let t = 0; t < 3; t++) {
          const top = fy - H + t * H * 0.25, bot = top + H * 0.45, hw = (W / 2 - 1.2) * (0.5 + t * 0.25);
          for (let y = Math.floor(top); y < bot; y++) {
            const w = hw * (y - top) / (bot - top);
            for (let x = Math.round(mx - w); x <= Math.round(mx + w); x++) p.set(x, y, x > mx + w * 0.3 ? 14 : x < mx - w * 0.5 ? 16 : 15);
          }
        }
      } else if (id === 'palm') {
        const lean = r.range(-0.25, 0.25) * H;
        for (let y = 0; y < H * 0.75; y++) p.set(Math.round(mx + lean * (y / H) ** 2), fy - y, y % 3 ? 28 : 27);
        const tx = Math.round(mx + lean * 0.56), ty = Math.round(fy - H * 0.75);
        for (let f = 0; f < 6; f++) {
          const a = -Math.PI / 2 + (f - 2.5) * 0.6, L = H * 0.32;
          for (let s = 0; s <= L; s++) p.set(Math.round(tx + Math.cos(a) * s * 1.3), Math.round(ty + Math.sin(a) * s * 0.6 + (s / L) ** 2 * L * 0.5), f < 3 ? 17 : 16);
        }
      } else if (id === 'cactus') {
        p.rect(mx - 1, fy - H + 1, 3, H, 16); for (let y = fy - H + 1; y <= fy; y++) { p.set(mx - 1, y, 17); p.set(mx + 1, y, 15); }
        const ay = Math.round(fy - H * r.range(0.4, 0.6));
        p.rect(mx - 3, ay, 2, 1, 16); p.rect(mx - 3, ay - 3, 1, 3, 17);
        if (W > 7) { p.rect(mx + 2, ay + 1, 2, 1, 15); p.rect(mx + 3, ay - 2, 1, 3, 15); }
      } else if (id === 'reed') {
        for (let s = 0; s < 4; s++) { const x = mx - 2 + s + (s > 1 ? 1 : 0), h = H - r.int(0, 3); for (let y = 0; y < h; y++) p.set(x, fy - y, 17); p.rect(x, fy - h, 1, 2, 27); }
      } else if (sp.kind === 'tree') {
        const birch = id === 'birch', trunkH = Math.round(H * (id === 'kapok' ? 0.5 : 0.38));
        for (let y = 0; y < trunkH + 2; y++) { p.set(mx, fy - y, birch ? (y % 4 === 1 ? 2 : 6) : 27); if (!birch) p.set(mx + 1, fy - y, 26); }
        const ry = id === 'kapok' ? H * 0.24 : H * 0.34, cy = fy - H + ry + 1, rx = W / 2 - 1.2;
        const col = birch || id === 'willow' ? leafy(16, 17, 18) : id === 'kapok' ? leafy(14, 15, 16) : leafy(15, 16, 17);
        disc(p, mx + 0.5, cy, rx, ry, col);
        if (id === 'willow') for (let x = Math.ceil(mx - rx + 1); x < mx + rx; x += 2) for (let y = 0; y < H * 0.3; y++) p.set(x, Math.round(cy + ry * 0.6 + y), 16);
        for (let k = 0; k < 3; k++) p.set(Math.round(mx + r.range(-rx, rx) * 0.6), Math.round(cy + r.range(-ry, ry) * 0.6), birch ? 18 : 17);
      } else if (sp.kind === 'shrub') {
        disc(p, mx + 0.5, fy - H / 2 + 1, W / 2 - 1.2, H / 2, id === 'juniper' ? leafy(14, 15, 16) : leafy(15, 16, 17));
        if (id === 'bush') for (let k = 0; k < 3; k++) p.set(Math.round(mx + r.range(-2, 2)), Math.round(fy - H / 2 + r.range(-1, 2)), 10);
      } else if (sp.kind === 'flower') {
        const head = { daisy: [7, 13], poppy: [10, 9], bluebell: [23, 22], cotton: [7, 6], bloom: [31, 30] }[id] || [7, 13];
        for (let y = 0; y < H - 1; y++) p.set(mx, fy - y, 16);
        p.set(mx, fy - H + 1, head[1]); p.set(mx - 1, fy - H + 1, head[0]); p.set(mx + 1, fy - H + 1, head[0]); p.set(mx, fy - H, head[0]);
        if (H > 3) p.set(mx + 1, fy - 1, 17);
      } else if (id === 'moss') {
        p.rect(mx - 1, fy, 3, 1, 15); p.set(mx, fy - 1, 16);
      } else {
        const c = id === 'dunegrass' ? [28, 29] : id === 'fern' ? [15, 16] : [16, 17];
        for (let s = -1; s <= 1; s++) for (let y = 0; y < H - Math.abs(s); y++) p.set(mx + s * Math.ceil(y / 2), fy - y, s < 0 ? c[1] : c[0]);
      }
      // a dark outline on the bigger plants
      if (big) {
        const o = p.d.slice();
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
          if (p.get(x, y) >= 0) continue;
          if (p.get(x - 1, y) >= 0 || p.get(x + 1, y) >= 0 || p.get(x, y - 1) >= 0 || p.get(x, y + 1) >= 0) o[y * p.w + x] = 1;
        }
        p.d = o;
      }
      const cv = document.createElement('canvas');
      cv.width = p.w; cv.height = p.h;
      cv.getContext('2d').putImageData(p.toImage(), 0, 0);
      return { canvas: cv, w: p.w, h: p.h, ax: mx, ay: fy };
    }
    return { species, paint, color: id => (byId[id] || species[0]).c };
  })();

  // A half-size copy of a sprite (Merryfolk's `lo`): each 2x2 block keeps its most common opaque color,
  // and is clear unless at least two of its four pixels are opaque.
  function halve(src) {
    const w = src.width, h = src.height, W = Math.ceil(w / 2), H = Math.ceil(h / 2);
    const d = src.getContext('2d').getImageData(0, 0, w, h).data, out = new ImageData(W, H), o = new Uint32Array(out.data.buffer);
    const s32 = new Uint32Array(d.buffer.slice(0));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const cs = [];
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const X = x * 2 + i, Y = y * 2 + j;
        if (X < w && Y < h && d[(Y * w + X) * 4 + 3] > 127) cs.push(s32[Y * w + X]);
      }
      if (cs.length < 2) continue;
      let best = cs[0], bn = 0;
      for (const c of cs) { const n = cs.filter(q => q === c).length; if (n > bn) { bn = n; best = c; } }
      o[y * W + x] = best;
    }
    const c = document.createElement('canvas');
    c.width = W; c.height = H; c.getContext('2d').putImageData(out, 0, 0);
    return c;
  }

  // =====================================================================================
  // chunks: an endless world from a region map down to single plants.
  // =====================================================================================
  Kit.register('chunks', { title: 'Level of detail: an endless world from region map to single plants', fit: 'per-frame' }, host => {
    const F = window.Flora && Array.isArray(window.Flora.species) && typeof window.Flora.paint === 'function' ? window.Flora : Fallback;
    const SEASON = 'summer';
    const VW = 320, VH = 208, CP = 128; // view in canvas pixels; every chunk picture is CP x CP
    const cv = Kit.canvas(host, VW, VH);
    const g = cv.g;
    cv.cv.style.touchAction = 'none'; cv.cv.style.cursor = 'grab';

    // The zoom steps: screen pixels per tile (a tile is 16 world pixels), the cache each draws from, and the
    // scale that cache's pictures are drawn at. The two closest steps share one cache of 16 px art, drawn 2x and 3x.
    const STEPS = [
      { tpx: 1, c: 0, k: 1, name: 'region map' }, { tpx: 2, c: 1, k: 1, name: 'tree speckle' },
      { tpx: 4, c: 2, k: 1, name: 'tree blobs' }, { tpx: 8, c: 3, k: 1, name: 'half sprites' },
      { tpx: 16, c: 4, k: 1, name: 'sprites' }, { tpx: 32, c: 5, k: 2, name: 'every plant' },
      { tpx: 48, c: 5, k: 3, name: 'every plant' },
    ];
    const CACHES = [1, 2, 4, 8, 16, 16].map((tpx, i) => ({ tpx, cs: CP / tpx, label: i === 5 ? 'plants' : tpx + 'px', map: new Map() }));
    const MAX_CHUNKS = 64, BS = 32, MAX_BLOCKS = 700;

    // ---- the world: per-tile fields from noise ----
    const SEA = 0.43, BEACH = 0.012, RW = 0.016, PW = 0.0065;
    const DEEP = 0, OCEAN = 1, BEACHB = 2, MEADOW = 3, FOREST = 4, TAIGA = 5, DESERT = 6, SWAMP = 7, JUNGLE = 8, TUNDRA = 9, ROCK = 10, SNOW = 11;
    // the biome names Flora knows; rock borrows a few tundra plants
    const FLORA_BIOME = [null, null, 'beach', 'meadow', 'forest', 'taiga', 'desert', 'swamp', 'jungle', 'tundra', 'tundra', null];
    // [dark, base, light] per biome
    const BHEX = [
      ['#0f2340', '#163f6b', '#163f6b'], ['#163f6b', '#1f6aa0', '#2fa0c8'], ['#c9a063', '#e3c587', '#f3e0aa'],
      ['#4f9a44', '#79b84e', '#a3d264'], ['#1f5131', '#2f7a3b', '#468f42'], ['#173a33', '#245246', '#36684f'],
      ['#c0905a', '#dcb173', '#efd294'], ['#2e3a24', '#46522f', '#5f6a3c'], ['#14402a', '#1d6a35', '#2f8a3e'],
      ['#7c8a80', '#a0ac9e', '#c3cbbd'], ['#4a4566', '#6e6a8a', '#9b98b0'], ['#9b98b0', '#cdcbd9', '#f4f1ea'],
    ];
    const BCOL = BHEX.map(r => r.map(P));
    const WATER = ['#bff0ea', '#2fa0c8', '#1f6aa0', '#163f6b', '#0f2340'].map(P); // foam, shallow, sea, deep, deeper
    const RIVER = P('#2f8fc0'), RIVER_MID = P('#1f6aa0'), POOL = P('#2d4a40'), POOL_RIM = P('#24301c');
    const PATH = ['#8f6440', '#b08455', '#c9a06a'].map(P), BRIDGE = P('#a87a4c'), RAIL = P('#3b2318');
    const WALK = [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0];
    // plant densities per biome: [trees per tile, shrubs or succulents per tile, flowers per half-tile, ground plants per half-tile]
    const DENS = [null, null, [0.02, 0.04, 0.02, 0.1], [0.025, 0.05, 0.16, 0.5], [0.6, 0.1, 0.05, 0.3], [0.5, 0.08, 0.03, 0.28],
      [0.004, 0.07, 0.02, 0.05], [0.18, 0.18, 0.06, 0.4], [0.7, 0.2, 0.06, 0.45], [0.025, 0.06, 0.06, 0.25], [0.03, 0.03, 0.01, 0.06], null];

    let seed = 2024;
    function biome(e, m, t) {
      if (e < SEA - 0.09) return DEEP;
      if (e < SEA) return OCEAN;
      if (e < SEA + BEACH) return BEACHB;
      if (e > 0.82 || (e > 0.78 && t < 0.2)) return SNOW;
      if (e > 0.74) return ROCK;
      if (t < 0.3) return m > 0.47 ? TAIGA : TUNDRA;
      if (t < 0.63) return m < 0.36 ? MEADOW : m > 0.7 && e < SEA + 0.1 ? SWAMP : FOREST;
      return m < 0.36 ? DESERT : m < 0.56 ? MEADOW : JUNGLE;
    }
    // every field at one point (x, y in tiles); blocks, sketches and the home search all use this, so they agree
    function fields(x, y, o) {
      const f = 1 / 360;
      const qx = fbm(x * f * 1.5 + 5.2, y * f * 1.5 + 1.3, seed + 1, 2), qy = fbm(x * f * 1.5 + 9.1, y * f * 1.5 + 4.7, seed + 2, 2);
      const e = 0.5 + 1.1 * fbm(x * f + 0.45 * qx, y * f + 0.45 * qy, seed, 6);
      const m = 0.5 + 1.6 * fbm(x / 150 + 17.3, y / 150 - 3.1, seed + 17, 3);
      const t = 0.5 + 1.7 * fbm(x / 240 + 40.7, y / 240 - 9.2, seed + 23, 2) - Math.max(0, e - SEA) * 1.1;
      o.e = e;
      // rivers and paths are where a noise crosses zero, the usual trick for an endless map with no flow to simulate
      o.r = fbm(x / 170 + qx * 0.7 + 11.1, y / 170 + qy * 0.7 - 7.7, seed + 31, 3);
      o.p = fbm(x / 120 + 70.3, y / 120 - 30.9, seed + 41, 2);
      o.g = gnoise(x / 14 + 0.37, y / 14 + 0.71, seed + 51); // groves and glades
      o.b = biome(e, m, t);
      o.w = o.b === SWAMP ? gnoise(x / 5 + 0.3, y / 5 + 0.9, seed + 61) : -1; // swamp pools
    }
    // a river narrows to nothing as it climbs into the mountains
    const riverW = e => RW * clamp((0.75 - e) / 0.08, 0, 1.15);

    // Field blocks: BS x BS tiles of every field, shared by all the zoom steps and let go when unused longest.
    const blocks = new Map(), tmp = {};
    let stamp = 0;
    const bkey = (bx, by) => (bx + 32768) * 65536 + (by + 32768);
    function block(bx, by) {
      const key = bkey(bx, by);
      let b = blocks.get(key);
      if (b) { b.used = stamp; return b; }
      const n = BS * BS;
      b = { E: new Float32Array(n), R: new Float32Array(n), Pp: new Float32Array(n), G: new Float32Array(n), W: new Float32Array(n), B: new Uint8Array(n), used: stamp };
      for (let j = 0; j < BS; j++) for (let i = 0; i < BS; i++) {
        fields(bx * BS + i + 0.5, by * BS + j + 0.5, tmp);
        const k = j * BS + i;
        b.E[k] = tmp.e; b.R[k] = tmp.r; b.Pp[k] = tmp.p; b.G[k] = tmp.g; b.W[k] = tmp.w; b.B[k] = tmp.b;
      }
      blocks.set(key, b);
      return b;
    }
    // A window of tiles copied out of the blocks; tiles of blocks not yet made are worked out one by one
    // (they are only a chunk's margin, and making a whole block for them would waste time).
    function win(x0, y0, w, h) {
      const n = w * h, o = { x0, y0, w, h, E: new Float32Array(n), R: new Float32Array(n), Pp: new Float32Array(n), G: new Float32Array(n), W: new Float32Array(n), B: new Uint8Array(n) };
      for (let j = 0; j < h; j++) {
        const ty = y0 + j, by = Math.floor(ty / BS), ly = ty - by * BS;
        for (let i = 0; i < w; i++) {
          const tx = x0 + i, bx = Math.floor(tx / BS), k = j * w + i, b = blocks.get(bkey(bx, by));
          if (b) {
            b.used = stamp;
            const q = ly * BS + tx - bx * BS;
            o.E[k] = b.E[q]; o.R[k] = b.R[q]; o.Pp[k] = b.Pp[q]; o.G[k] = b.G[q]; o.W[k] = b.W[q]; o.B[k] = b.B[q];
          } else {
            fields(tx + 0.5, ty + 0.5, tmp);
            o.E[k] = tmp.e; o.R[k] = tmp.r; o.Pp[k] = tmp.p; o.G[k] = tmp.g; o.W[k] = tmp.w; o.B[k] = tmp.b;
          }
        }
      }
      return o;
    }
    // a field at a point in tiles, read bilinearly between tile centers
    function lerp2(Wn, A, u, v) {
      const a = u - 0.5 - Wn.x0, b = v - 0.5 - Wn.y0, i = Math.floor(a), j = Math.floor(b), fx = a - i, fy = b - j, k = j * Wn.w + i;
      return (A[k] * (1 - fx) + A[k + 1] * fx) * (1 - fy) + (A[k + Wn.w] * (1 - fx) + A[k + Wn.w + 1] * fx) * fy;
    }

    // ---- plants ----
    // species per biome, sorted into the four kinds of plant this demo places
    const SPECIES = F.species.filter(s => s && s.id && Array.isArray(s.biomes) && Array.isArray(s.h));
    const LISTS = FLORA_BIOME.map(name => {
      const of = test => (name ? SPECIES.filter(s => s.biomes.includes(name) && test(s.kind)) : []);
      return [of(k => k === 'tree'), of(k => k === 'shrub' || k === 'succulent'), of(k => k === 'flower'), of(k => k === 'ground')];
    });
    const NVAR = 3;
    // Flora draws plants at their own sizes (an oak is 56 to 84 px); this world's tile is 16 px, so they are asked
    // for smaller: trees about two tiles tall, the small plants a little over half size
    const SCALE = F === Fallback ? {} : { tree: 0.4, shrub: 0.6, succulent: 0.5, flower: 0.6, ground: 0.6 };
    const sizeOf = (sp, vi) => Math.max(3, Math.round((sp.h[0] + (sp.h[1] - sp.h[0]) * (vi + 0.5) / NVAR) * (SCALE[sp.kind] || 1)));
    const tallest = Math.max(16, ...SPECIES.map(s => sizeOf(s, NVAR - 1)));
    const BELOW = Math.ceil(tallest / 16) + 1, SIDE = Math.ceil(tallest * 0.6 / 16) + 1; // margins (tiles) for overhanging sprites
    const colors = new Map();
    function colorOf(sp) {
      let c = colors.get(sp.id);
      if (!c) {
        let h = null;
        try { h = F.color(sp.id, SEASON); } catch (e) { h = null; }
        const base = typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h) ? rgbOf(h) : [47, 122, 59];
        c = { base: pack(base), dark: pack(shade(base, 0.42)), light: pack(shade(base, 1.3)) };
        colors.set(sp.id, c);
      }
      return c;
    }
    const sprites = new Map();
    function spriteOf(sp, vi) {
      const key = sp.id + '|' + vi;
      let s = sprites.get(key);
      if (!s) {
        const size = sizeOf(sp, vi), sd = Kit.hashStr(sp.id) + vi * 7919;
        try { s = F.paint(sp.id, sd, { season: SEASON, size }); } catch (e) { s = null; }
        if (!s || !s.canvas || !s.canvas.width) s = Fallback.paint(sp.id, sd, { size });
        sprites.set(key, s);
      }
      return s;
    }
    const loOf = s => s.lo || (s.lo = halve(s.canvas));
    // the small plants are picked with the little ones far more often than the big (grass over toadstools)
    function pickSmall(list, h) {
      if (!list.cum) { let t = 0; list.cum = list.map(sp => (t += 1 / Math.pow(sizeOf(sp, 1), 2))); }
      const x = h * list.cum[list.cum.length - 1];
      let i = 0;
      while (i < list.length - 1 && list.cum[i] < x) i++;
      return list[i];
    }
    // whether a plant can stand at (u, v): not in the water, on a path or a river bank, or in a swamp pool
    function standable(Wn, u, v, b) {
      const e = lerp2(Wn, Wn.E, u, v);
      if (e < SEA + (b === BEACHB ? 0.003 : BEACH)) return false;
      const rw = riverW(e);
      if (rw > 0 && Math.abs(lerp2(Wn, Wn.R, u, v)) < rw * 1.6) return false;
      if (WALK[b] && e < 0.68 && Math.abs(lerp2(Wn, Wn.Pp, u, v)) < PW * 1.9) return false;
      if (b === SWAMP && lerp2(Wn, Wn.W, u, v) > 0.22) return false;
      return true;
    }
    // Every plant rooted in a range of tiles. One candidate per tile for trees and shrubs, four per tile for the small
    // ones; a hash of the world position decides each, so every zoom step finds the same plants in the same places.
    function plantsIn(Wn, tx0, ty0, tx1, ty1, small) {
      const out = [];
      for (let ty = ty0; ty < ty1; ty++) for (let tx = tx0; tx < tx1; tx++) {
        const k = (ty - Wn.y0) * Wn.w + (tx - Wn.x0), b = Wn.B[k], D = DENS[b];
        if (!D) continue;
        const gr = Wn.G[k], L = LISTS[b], h = hash2(tx, ty, seed + 11);
        const pt = D[0] * clamp(0.6 + gr * 1.2, 0, 1.5), ps = D[1];
        const kind = h < pt ? 0 : h < pt + ps ? 1 : -1;
        if (kind >= 0 && L[kind].length) {
          const sp = L[kind][Math.floor(hash2(tx, ty, seed + 12) * L[kind].length)];
          const u = tx + (3 + hash2(tx, ty, seed + 13) * 10) / 16, v = ty + (3 + hash2(tx, ty, seed + 14) * 10) / 16;
          if (standable(Wn, u, v, b)) out.push({ u, v, sp, vi: Math.floor(hash2(tx, ty, seed + 15) * NVAR), kind });
        }
        if (!small) continue;
        for (let s = 0; s < 4; s++) {
          const sx = tx * 2 + (s & 1), sy = ty * 2 + (s >> 1), hs = hash2(sx, sy, seed + 21);
          const pf = D[2] * clamp(0.7 - gr * 1.6, 0.1, 2.2), pg = D[3];
          const kd = hs < pf ? 2 : hs < pf + pg ? 3 : -1;
          if (kd < 0 || !L[kd].length || (kd === 3 && small < 2)) continue;
          const sp = pickSmall(L[kd], hash2(sx, sy, seed + 22));
          const u = sx / 2 + (1 + hash2(sx, sy, seed + 23) * 6) / 16, v = sy / 2 + (1 + hash2(sx, sy, seed + 24) * 6) / 16;
          if (standable(Wn, u, v, b)) out.push({ u, v, sp, vi: Math.floor(hash2(sx, sy, seed + 25) * NVAR), kind: kd });
        }
      }
      return out.sort((a, b) => a.v - b.v || a.u - b.u);
    }

    // ---- painting one chunk of one cache, a slice at a time ----
    function* paintChunk(ci, cx, cy) {
      const C = CACHES[ci], tpx = C.tpx, cs = C.cs, pxT = 1 / tpx, tx0 = cx * cs, ty0 = cy * cs;
      // the blocks under the chunk itself, one per slice so a frame's budget holds
      for (let by = Math.floor(ty0 / BS); by <= Math.floor((ty0 + cs - 1) / BS); by++) {
        for (let bx = Math.floor(tx0 / BS); bx <= Math.floor((tx0 + cs - 1) / BS); bx++) {
          if (!blocks.has(bkey(bx, by))) { block(bx, by); yield; }
        }
      }
      const mS = ci ? SIDE : 0, mB = ci ? BELOW : 0, mT = ci ? 1 : 0;
      const Wn = win(tx0 - mS - 2, ty0 - mT - 2, cs + 2 * mS + 4, cs + mT + mB + 4);
      const { E, R, Pp, W, B, w: ww, x0: wx0, y0: wy0 } = Wn;
      yield;
      // the ground, one pixel at a time, with the fields read between tile centers so coasts, rivers and paths
      // come out as curves at the close steps; the far steps keep lines at least a pixel wide so they never break up
      const img = new ImageData(CP, CP), px = new Uint32Array(img.data.buffer);
      const gx0 = cx * CP, gy0 = cy * CP, jit = tpx >= 4 ? 0.7 : 0, marks = tpx >= 16;
      for (let j = 0; j < CP; j++) {
        const v = ty0 + (j + 0.5) * pxT, bb = v - 0.5 - wy0, j0 = bb | 0, fy = bb - j0;
        for (let i = 0; i < CP; i++) {
          const u = tx0 + (i + 0.5) * pxT, aa = u - 0.5 - wx0, i0 = aa | 0, fx = aa - i0, k = j0 * ww + i0;
          const gx = fx * (1 - fy), q00 = (1 - fx) * (1 - fy), q01 = (1 - fx) * fy, q11 = fx * fy;
          const e00 = E[k], e10 = E[k + 1], e01 = E[k + ww], e11 = E[k + ww + 1];
          const e = e00 * q00 + e10 * gx + e01 * q01 + e11 * q11;
          const ex = (e10 - e00) * (1 - fy) + (e11 - e01) * fy, ey = (e01 - e00) * (1 - fx) + (e11 - e10) * fx;
          const d = BAYER[(((gy0 + j) & 3) << 2) | ((gx0 + i) & 3)];
          const ge = Math.abs(ex) + Math.abs(ey);
          let c;
          if (e < SEA) {
            const depth = SEA - e;
            if (depth < Math.max(0.004, 0.6 * ge * pxT)) c = WATER[0];
            else { const s = depth + (d - 0.5) * 0.01; c = s < 0.025 ? WATER[1] : s < 0.08 ? WATER[2] : s < 0.16 ? WATER[3] : WATER[4]; }
            px[j * CP + i] = c; continue;
          }
          let bt;
          if (jit) bt = B[((v + (hash2(gx0 + i, gy0 + j, seed + 72) - 0.5) * jit - wy0) | 0) * ww + ((u + (hash2(gx0 + i, gy0 + j, seed + 71) - 0.5) * jit - wx0) | 0)];
          else bt = B[(j0 + (fy >= 0.5 ? 1 : 0)) * ww + i0 + (fx >= 0.5 ? 1 : 0)];
          if (bt <= OCEAN) bt = BEACHB;
          // rivers
          const rw = riverW(e);
          let river = false, rv = 0, rwe = 0;
          if (rw > RW * 0.15) {
            const r00 = R[k], r10 = R[k + 1], r01 = R[k + ww], r11 = R[k + ww + 1];
            rv = Math.abs(r00 * q00 + r10 * gx + r01 * q01 + r11 * q11);
            const gr = Math.abs((r10 - r00) * (1 - fy) + (r11 - r01) * fy) + Math.abs((r01 - r00) * (1 - fx) + (r11 - r10) * fx);
            rwe = Math.max(rw, 0.5 * gr * pxT);
            river = rv < rwe;
          }
          // paths: a one-pixel line at 4 px a tile, their true width from 8 px
          let path = false, pv = 0, pwe = 0;
          if (tpx >= 4 && WALK[bt] && e < 0.68 && e >= SEA + BEACH) {
            const p00 = Pp[k], p10 = Pp[k + 1], p01 = Pp[k + ww], p11 = Pp[k + ww + 1];
            pv = Math.abs(p00 * q00 + p10 * gx + p01 * q01 + p11 * q11);
            const gp = Math.abs((p10 - p00) * (1 - fy) + (p11 - p01) * fy) + Math.abs((p01 - p00) * (1 - fx) + (p11 - p10) * fx);
            pwe = tpx >= 8 ? Math.max(PW, 0.5 * gp * pxT) : 0.45 * gp * pxT;
            path = pv < pwe;
          }
          if (river) {
            if (path) c = pv > pwe * 0.7 ? RAIL : BRIDGE;
            else c = tpx >= 8 && rv < rwe * 0.45 && rwe > RW * 0.8 ? RIVER_MID : RIVER;
          } else if (path) {
            c = tpx >= 8 && pv > pwe * 0.75 ? PATH[0] : (ex + ey) * 40 + (d - 0.5) * 0.4 > 0.5 ? PATH[2] : PATH[1];
          } else if (e < SEA + Math.max(BEACH, 0.5 * ge * pxT)) {
            c = BCOL[BEACHB][(ex + ey) * 30 + (d - 0.5) * 0.4 > 0.5 ? 2 : 1];
          } else if (bt === SWAMP && W[k] > -1 && lerp2(Wn, W, u, v) > 0.22) {
            c = lerp2(Wn, W, u, v) > 0.3 ? POOL : POOL_RIM;
          } else {
            // flat color, with a narrow dithered seam where the slope turns to the light or away from it
            const col = BCOL[bt], K = bt >= ROCK ? 60 : bt === DESERT ? 45 : 30;
            const s = (ex + ey) * K + (d - 0.5) * 0.4;
            c = s > 0.5 ? col[2] : s < -0.5 ? col[0] : col[1];
            // close up, a river gets a dark bank and the ground a few short marks
            if (tpx >= 8 && rv && rv < rwe * 1.5) c = col[0];
            else if (marks && hash2(Math.floor(u * 8), Math.floor(v * 16), seed + 81) < 0.012) c = col[0];
          }
          px[j * CP + i] = c;
        }
        if ((j & 31) === 31) yield;
      }
      // the far steps mark plants straight into the pixels: a dark speck per tree at 2 px a tile, a small blob at 4
      if (ci === 1 || ci === 2) {
        const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < CP && y < CP) px[y * CP + x] = c; };
        for (const p of plantsIn(Wn, tx0 - mS, ty0 - mT, tx0 + cs + mS, ty0 + cs + mB, 0)) {
          if (!colors.has(p.sp.id)) { colorOf(p.sp); yield; } // Flora paints a plant to find its color
          const col = colorOf(p.sp), size = sizeOf(p.sp, p.vi), fx = Math.floor((p.u - tx0) * tpx), fy = Math.floor((p.v - ty0) * tpx);
          if (ci === 1) { if (p.kind === 0) put(fx, fy - Math.round(size * 0.55 * tpx / 16), col.dark); continue; }
          if (p.kind !== 0) { put(fx, fy - 1, col.base); continue; }
          const R2 = clamp(size * tpx / 16 * 0.3, 1, 3), cy2 = fy - Math.round(size * 0.55 * tpx / 16);
          for (let dy = -Math.ceil(R2); dy <= Math.ceil(R2); dy++) for (let dx = -Math.ceil(R2); dx <= Math.ceil(R2); dx++) {
            if (dx * dx + dy * dy > R2 * R2 + 0.6) continue;
            put(fx + dx, cy2 + dy, dx + dy > 0.4 * R2 ? col.dark : dx + dy < -0.6 * R2 ? col.light : col.base);
          }
        }
      }
      const c = document.createElement('canvas');
      c.width = c.height = CP;
      const x = c.getContext('2d');
      x.putImageData(img, 0, 0);
      // the close steps draw the plants' sprites: half-size copies at 8 px a tile, the sprites themselves at 16,
      // with flowers from 16 and grass, ferns and moss only at the closest steps
      if (ci >= 3) {
        x.imageSmoothingEnabled = false;
        const s = tpx / 16, list = plantsIn(Wn, tx0 - mS, ty0 - mT, tx0 + cs + mS, ty0 + cs + mB, ci === 5 ? 2 : ci === 4 ? 1 : 0);
        let n = 0;
        for (const p of list) {
          const fresh = !sprites.has(p.sp.id + '|' + p.vi);
          const sp = spriteOf(p.sp, p.vi), half = ci === 3;
          const im = half ? loOf(sp) : sp.canvas, ax = half ? sp.ax >> 1 : sp.ax, ay = half ? sp.ay >> 1 : sp.ay;
          x.drawImage(im, Math.round((p.u - tx0) * 16 * s) - ax, Math.round((p.v - ty0) * 16 * s) - ay);
          if (fresh || ++n % 80 === 0) yield;
        }
      }
      return c;
    }

    // A flat sketch for a chunk not painted yet: an 8x8 summary of its biomes, from a point sample each.
    function sketch(ci, cx, cy) {
      const cs = CACHES[ci].cs, n = 8, c = document.createElement('canvas');
      c.width = c.height = n;
      const x = c.getContext('2d'), img = x.createImageData(n, n), u = new Uint32Array(img.data.buffer);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        fields(cx * cs + (i + 0.5) * cs / n, cy * cs + (j + 0.5) * cs / n, tmp);
        u[j * n + i] = tmp.e < SEA ? (tmp.e < SEA - 0.09 ? WATER[3] : WATER[2]) : BCOL[tmp.b][1];
      }
      x.putImageData(img, 0, 0);
      return c;
    }
    function entry(ci, cx, cy) {
      const key = cx + ',' + cy, map = CACHES[ci].map;
      let ch = map.get(key);
      if (!ch) { const sk = sketch(ci, cx, cy); ch = { ci, cx, cy, sk, cv: sk, painted: false, fade: 1, gen: null, used: 0 }; map.set(key, ch); }
      ch.used = stamp;
      return ch;
    }

    // ---- camera ----
    let zi = 3, camX = 0, camY = 0, borders = false, dirty = true;
    // the chunks of a step's cache that cover the view (plus a ring of pad chunks), around the camera
    function range(z, pad) {
      const st = STEPS[z], S = CP * st.k, sp = st.tpx;
      const ox = Math.round((camX - VW / 2 / sp) * sp), oy = Math.round((camY - VH / 2 / sp) * sp);
      return { st, S, ox, oy, x0: Math.floor(ox / S) - pad, x1: Math.floor((ox + VW - 1) / S) + pad, y0: Math.floor(oy / S) - pad, y1: Math.floor((oy + VH - 1) / S) + pad, mx: (ox + VW / 2) / S, my: (oy + VH / 2) / S };
    }
    // a starting place with forest, meadow, the sea and a river all within a screen or so (or, failing that, most of them)
    function findHome() {
      const o = {}, r = Kit.rng(seed * 31 + 7);
      let best = [0, 0], bs = -1;
      for (let t = 0; t < 400 && bs < 4; t++) {
        const x = (r() - 0.5) * 6000, y = (r() - 0.5) * 6000;
        fields(x, y, o);
        if (o.b !== FOREST && o.b !== MEADOW) continue;
        let water = 0, forest = 0, meadow = 0, river = 0;
        for (let a = 0; a < 12; a++) for (const d of [8, 16, 26]) {
          fields(x + Math.cos(a * 0.52) * d, y + Math.sin(a * 0.52) * d, o);
          if (o.e < SEA) water = 1; else if (Math.abs(o.r) < RW * 2 && riverW(o.e) > 0) river = 1;
          if (o.b === FOREST) forest = 1; if (o.b === MEADOW) meadow = 1;
        }
        const sc = water + forest + meadow + river;
        if (sc > bs) { bs = sc; best = [x, y]; }
      }
      return best;
    }
    function home() { [camX, camY] = findHome(); dirty = true; }

    // ---- painting under a budget: nearest the middle first, this step's view, then a ring, then the steps either side ----
    let busy = false;
    function work(budget) {
      const t0 = performance.now();
      busy = false;
      for (const [z, pad] of [[zi, 0], [zi, 1], [zi + 1, 0], [zi - 1, 0]]) {
        if (z < 0 || z >= STEPS.length) continue;
        const R0 = range(z, pad), ci = R0.st.c, todo = [];
        for (let cy = R0.y0; cy <= R0.y1; cy++) for (let cx = R0.x0; cx <= R0.x1; cx++) {
          const ch = entry(ci, cx, cy);
          if (!ch.painted) todo.push(ch);
        }
        todo.sort((a, b) => Math.hypot(a.cx + 0.5 - R0.mx, a.cy + 0.5 - R0.my) - Math.hypot(b.cx + 0.5 - R0.mx, b.cy + 0.5 - R0.my));
        for (const ch of todo) {
          if (!ch.gen) ch.gen = paintChunk(ch.ci, ch.cx, ch.cy);
          while (performance.now() - t0 < budget) {
            const r = ch.gen.next();
            if (r.done) { ch.cv = r.value; ch.painted = true; ch.gen = null; if (z === zi) { dirty = true; ch.fade = 0.2; } break; }
          }
          if (performance.now() - t0 >= budget) { busy = true; return; }
        }
      }
    }
    // let go of the chunks (and field blocks) seen longest ago once a cache holds too many
    function trim() {
      for (const C of CACHES) {
        if (C.map.size <= MAX_CHUNKS) continue;
        const all = [...C.map.entries()].sort((a, b) => a[1].used - b[1].used);
        for (const [k, ch] of all) { if (C.map.size <= MAX_CHUNKS) break; if (ch.used < stamp) C.map.delete(k); }
      }
      if (blocks.size > MAX_BLOCKS) {
        const all = [...blocks.entries()].sort((a, b) => a[1].used - b[1].used);
        for (let i = 0; i < all.length - MAX_BLOCKS * 0.85; i++) blocks.delete(all[i][0]);
      }
    }

    // ---- drawing: only drawImage and fillRect each frame ----
    const ST_COL = { painted: PAL[17], painting: PAL[13], coarse: PAL[23], sketch: PAL[10] };
    let fading = false;
    function render() {
      fading = false;
      const R0 = range(zi, 0), { st, S, ox, oy } = R0, ci = st.c;
      g.imageSmoothingEnabled = false;
      g.fillStyle = PAL[1]; g.fillRect(0, 0, VW, VH);
      const tags = [];
      for (let cy = R0.y0; cy <= R0.y1; cy++) for (let cx = R0.x0; cx <= R0.x1; cx++) {
        const ch = entry(ci, cx, cy), x = cx * S - ox, y = cy * S - oy;
        let state = 'painted';
        if (ch.painted && ch.fade >= 1) g.drawImage(ch.cv, x, y, S, S);
        else {
          // until it is painted, a chunk borrows the coarser cache's picture if that is ready, else shows its sketch;
          // a freshly painted chunk fades in over that
          const pc = ci - 1, P0 = pc >= 0 ? CACHES[pc] : null, cs = CACHES[ci].cs;
          const pcx = P0 && Math.floor(cx * cs / P0.cs), pcy = P0 && Math.floor(cy * cs / P0.cs);
          const par = P0 && P0.map.get(pcx + ',' + pcy);
          if (par && par.painted) {
            const f = CP / P0.cs, sw = cs * f;
            g.drawImage(par.cv, (cx * cs - pcx * P0.cs) * f, (cy * cs - pcy * P0.cs) * f, sw, sw, x, y, S, S);
            state = 'coarse';
          } else { g.drawImage(ch.sk, x, y, S, S); state = 'sketch'; }
          if (ch.gen) state = 'painting';
          if (ch.painted) {
            g.globalAlpha = ch.fade; g.drawImage(ch.cv, x, y, S, S); g.globalAlpha = 1;
            ch.fade = Math.min(1, ch.fade + 0.2); fading = true; state = 'painted';
          }
        }
        tags.push([x, y, state]);
      }
      if (borders) {
        g.globalAlpha = 0.55; g.fillStyle = PAL[0];
        for (let cx = R0.x0; cx <= R0.x1 + 1; cx++) g.fillRect(cx * S - ox, 0, 1, VH);
        for (let cy = R0.y0; cy <= R0.y1 + 1; cy++) g.fillRect(0, cy * S - oy, VW, 1);
        g.globalAlpha = 1;
        for (const [x, y, s] of tags) { g.fillStyle = PAL[0]; g.fillRect(x + 1, y + 1, 5, 5); g.fillStyle = ST_COL[s]; g.fillRect(x + 2, y + 2, 3, 3); }
      }
      // the zoom ladder and the step's name
      const label = st.tpx + ' PX/TILE  ' + st.name;
      g.globalAlpha = 0.7; g.fillStyle = PAL[0]; g.fillRect(3, VH - 12, 7 * 5 + 6 + label.length * 4, 9); g.globalAlpha = 1;
      for (let i = 0; i < STEPS.length; i++) { g.fillStyle = i === zi ? PAL[12] : i < zi ? PAL[5] : PAL[3]; g.fillRect(5 + i * 5, VH - 10 + (i === zi ? 0 : 1), 4, i === zi ? 5 : 3); }
      text(g, label, 5 + 7 * 5 + 3, VH - 10, PAL[7]);
    }

    // ---- the frame: paint for a few milliseconds, draw if anything changed, and keep the readout ----
    let tDraw = 0, tPaint = 0, nFrame = 0, noteEl = null, raf = 0, L = null;
    function frame() {
      stamp++;
      const t0 = performance.now();
      work(6);
      const t1 = performance.now();
      if (dirty || busy || fading) { render(); dirty = false; }
      const t2 = performance.now();
      trim();
      tPaint = tPaint * 0.9 + (t1 - t0) * 0.1;
      if (t2 - t1 > 0.01) tDraw = tDraw * 0.8 + (t2 - t1) * 0.2;
      if (noteEl && (nFrame++ % 10 === 0)) {
        const st = STEPS[zi];
        const held = CACHES.map((C, i) => {
          let n = 0;
          for (const ch of C.map.values()) if (ch.painted) n++;
          const s = C.label + ' ' + n;
          return i === st.c ? '[' + s + ']' : s;
        }).join(' · ');
        noteEl.textContent = `Step ${zi + 1} of ${STEPS.length}: ${st.tpx} px per tile, ${st.name}. Drawing ${tDraw.toFixed(2)} ms, painting ${tPaint.toFixed(1)} ms a frame. ` +
          `Chunks painted per cache: ${held} · field blocks ${blocks.size}`;
      }
      // with reduced motion the loop doesn't run, so the painting asks for its own frames until it is done
      if (L && L.reduced && (busy || dirty || fading) && !raf) raf = requestAnimationFrame(() => { raf = 0; frame(); });
    }
    const request = () => { dirty = true; if (L && L.reduced && !raf) raf = requestAnimationFrame(() => { raf = 0; frame(); }); };

    // ---- zoom and pan ----
    // zoom to step z keeping the world point under (ax, ay) (canvas pixels) where it is, as Merryfolk's setZoom does
    function setZoom(z, ax = VW / 2, ay = VH / 2) {
      z = clamp(z, 0, STEPS.length - 1);
      if (z === zi) return;
      const a = STEPS[zi].tpx, b = STEPS[z].tpx;
      camX += (ax - VW / 2) / a - (ax - VW / 2) / b; camY += (ay - VH / 2) / a - (ay - VH / 2) / b;
      zi = z; request();
    }
    const art = e => { const r = cv.cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * VW, (e.clientY - r.top) / r.height * VH]; };
    const pts = new Map();
    let drag = null, pinch = null, lastTap = null;
    const mid = () => { const [a, b] = [...pts.values()]; return { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; };
    const startDrag = p => { drag = { x: p[0], y: p[1], cx: camX, cy: camY }; };
    cv.cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      cv.cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, art(e));
      if (pts.size === 2) {
        // a pinch zooms in whole steps from where it started, around the point between the fingers
        const m = mid(), sp = STEPS[zi].tpx;
        pinch = { d0: Math.max(16, m.d), z0: zi, wx: camX + (m.x - VW / 2) / sp, wy: camY + (m.y - VH / 2) / sp };
        drag = null;
      } else if (pts.size === 1) {
        // a second tap or click close by, soon after the first, zooms in there
        const p = art(e), now = e.timeStamp;
        if (lastTap && now - lastTap.t < 320 && Math.hypot(p[0] - lastTap.x, p[1] - lastTap.y) < 12) { setZoom(zi + 1, p[0], p[1]); lastTap = null; }
        else lastTap = { t: now, x: p[0], y: p[1] };
        startDrag(p); cv.cv.style.cursor = 'grabbing';
      }
    });
    cv.cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      const p = art(e);
      pts.set(e.pointerId, p);
      if (pinch && pts.size >= 2) {
        const m = mid(), want = STEPS[pinch.z0].tpx * m.d / pinch.d0;
        let z = 0;
        STEPS.forEach((s, i) => { if (Math.abs(Math.log(s.tpx / want)) < Math.abs(Math.log(STEPS[z].tpx / want))) z = i; });
        zi = z;
        const sp = STEPS[zi].tpx;
        camX = pinch.wx - (m.x - VW / 2) / sp; camY = pinch.wy - (m.y - VH / 2) / sp;
        request();
      } else if (drag) {
        const sp = STEPS[zi].tpx;
        camX = drag.cx - (p[0] - drag.x) / sp; camY = drag.cy - (p[1] - drag.y) / sp;
        request();
      }
    });
    const up = e => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      // a finger left after a pinch carries on panning from where it is, without a jump
      if (pts.size === 1) startDrag([...pts.values()][0]);
      if (!pts.size) { drag = null; cv.cv.style.cursor = 'grab'; }
    };
    cv.cv.addEventListener('pointerup', up);
    cv.cv.addEventListener('pointercancel', up);
    // a mouse wheel clicks one step at a time; trackpad pinches (ctrl+wheel) send many small deltas, added up first
    let wheelAcc = 0;
    cv.cv.addEventListener('wheel', e => {
      e.preventDefault();
      wheelAcc += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      if (Math.abs(wheelAcc) < (e.ctrlKey ? 30 : 60) && Math.abs(e.deltaY) < 50) return;
      const [x, y] = art(e);
      setZoom(zi + (wheelAcc < 0 ? 1 : -1), x, y);
      wheelAcc = 0;
    }, { passive: false });
    document.addEventListener('gesturestart', e => { if (e.target === cv.cv) e.preventDefault(); });

    function forget() {
      for (const C of CACHES) C.map.clear();
      blocks.clear(); request();
    }
    const bar = Kit.bar(host);
    bar.button('−', () => setZoom(zi - 1));
    bar.button('+', () => setZoom(zi + 1));
    bar.button('Go home', home);
    bar.button('Forget chunks', forget);
    bar.check('Chunk borders', borders, v => { borders = v; request(); });
    bar.seed(seed, s => { seed = s; forget(); home(); });
    noteEl = Kit.bar(host).note('');
    Kit.bar(host).note('Drag to pan; scroll, pinch, double-tap or use − and + to zoom. With chunk borders on, each chunk\'s corner says whether it is painted (green), being painted (amber), borrowing the coarser step (blue) or a sketch (red).' +
      (F === Fallback ? ' (Plants: built-in fallback blobs; load demos/flora.js for the full plant library.)' : ''));
    home();
    L = Kit.loop(host, () => {}, frame, 30);
  });
})();
