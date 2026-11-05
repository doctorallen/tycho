// worlds.js: world, level and map generation demos for the research page.
// Seven live demos: an island from warped noise, tiled wave function collapse, four dungeon generators,
// corner autotiling against the dual grid, a village, decoration scattering, and an endless chunked world.
// Every random choice comes from Kit.rng, Kit.hash2 or Kit.noise2, so a seed always rebuilds the same world.
'use strict';
(() => {
  const PAL = Kit.PAL;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
  const D8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

  // Gradient noise like Kit.noise2, but picking one of eight gradients from Kit.hash2 instead of calling cos and sin,
  // which makes it about twice as fast. The terrain and the chunks call it hundreds of thousands of times.
  const GX = [1, -1, 0, 0, 0.7071, -0.7071, 0.7071, -0.7071], GY = [0, 0, 1, -1, 0.7071, 0.7071, -0.7071, -0.7071];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  function gnoise(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    let k = (Kit.hash2(x0, y0, seed) * 8) | 0; const a = GX[k] * fx + GY[k] * fy;
    k = (Kit.hash2(x0 + 1, y0, seed) * 8) | 0; const b = GX[k] * (fx - 1) + GY[k] * fy;
    k = (Kit.hash2(x0, y0 + 1, seed) * 8) | 0; const c = GX[k] * fx + GY[k] * (fy - 1);
    k = (Kit.hash2(x0 + 1, y0 + 1, seed) * 8) | 0; const d = GX[k] * (fx - 1) + GY[k] * (fy - 1);
    const sx = fade(fx), sy = fade(fy), ab = a + (b - a) * sx, cd = c + (d - c) * sx;
    return (ab + (cd - ab) * sy) * 1.41;
  }
  function fbm(x, y, seed, oct) {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += amp * gnoise(x * f, y * f, seed + i * 101); norm += amp; amp *= 0.5; f *= 2; }
    return s / norm;
  }

  // A Pix painted once into an offscreen canvas, so a frame can drawImage it.
  function bake(pix) {
    const c = document.createElement('canvas');
    c.width = pix.w; c.height = pix.h;
    c.getContext('2d').putImageData(pix.toImage(), 0, 0);
    return c;
  }

  // A 3x5 pixel font for labels inside the art. Each glyph is five rows of three bits.
  const GLYPH = {
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
    G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
    M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
    S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
    Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
    0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6], 4: [5, 5, 7, 1, 1],
    5: [7, 4, 6, 1, 6], 6: [3, 4, 6, 5, 2], 7: [7, 1, 2, 2, 2], 8: [2, 5, 2, 5, 2], 9: [2, 5, 3, 1, 6],
    '-': [0, 0, 7, 0, 0], ',': [0, 0, 0, 2, 4], '.': [0, 0, 0, 0, 2], ' ': [0, 0, 0, 0, 0],
  };
  function glyphs(s, x, y, put) {
    for (let i = 0; i < s.length; i++) {
      const g = GLYPH[s[i].toUpperCase()] || GLYPH[' '];
      for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (g[r] & (4 >> b)) put(x + i * 4 + b, y + r);
    }
  }
  const textW = s => s.length * 4 - 1;
  function textPix(pix, s, x, y, c, sh = -1) {
    if (sh >= 0) glyphs(s, x + 1, y + 1, (a, b) => pix.set(a, b, sh));
    glyphs(s, x, y, (a, b) => pix.set(a, b, c));
  }
  function textG(g, s, x, y, c, sh = -1) {
    if (sh >= 0) { g.fillStyle = PAL[sh]; glyphs(s, x + 1, y + 1, (a, b) => g.fillRect(a, b, 1, 1)); }
    g.fillStyle = PAL[c]; glyphs(s, x, y, (a, b) => g.fillRect(a, b, 1, 1));
  }

  // Sprites from strings: each character names a palette index through a key; '.' is clear.
  function sprite(pix, rows, key, x, y, clip) {
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
      const k = rows[j][i];
      if (k === '.' || key[k] === undefined) continue;
      const px = x + i, py = y + j;
      if (clip && (px < clip[0] || py < clip[1] || px >= clip[2] || py >= clip[3])) continue;
      pix.set(px, py, key[k]);
    }
  }

  // Breadth-first distances over passable cells (4-connected); -1 where unreachable.
  function bfs(w, h, pass, starts) {
    const d = new Int32Array(w * h).fill(-1), q = new Int32Array(w * h);
    let qh = 0, qt = 0;
    for (const s of starts) { if (d[s] < 0) { d[s] = 0; q[qt++] = s; } }
    while (qh < qt) {
      const i = q[qh++], x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (d[j] >= 0 || !pass[j]) continue;
        d[j] = d[i] + 1; q[qt++] = j;
      }
    }
    return d;
  }
  const farthest = d => { let b = 0; for (let i = 1; i < d.length; i++) if (d[i] > d[b]) b = i; return b; };
  // Walk back down a distance field from `end` to its source.
  function route(w, d, end) {
    const out = [end];
    let i = end;
    while (d[i] > 0) {
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of D4) {
        const j = (y + dy) * w + x + dx;
        if (x + dx >= 0 && x + dx < w && j >= 0 && j < d.length && d[j] === d[i] - 1) { i = j; break; }
      }
      out.push(i);
    }
    return out;
  }

  // A row of color swatches with names, under a canvas.
  function legend(host) {
    const row = Kit.el('div', { class: 'ctl' });
    host.append(row);
    return items => {
      row.textContent = '';
      for (const [name, c] of items) {
        row.append(Kit.el('span', { class: 'note', style: 'display:inline-flex;align-items:center;gap:4px;opacity:.9;flex-basis:auto' },
          Kit.el('span', { style: `display:inline-block;width:10px;height:10px;background:${PAL[c]};box-shadow:0 0 0 1px ${PAL[0]}` }), name));
      }
    };
  }

  // A seed shown in the bar that code can also advance (the kit's seed control can't be set from outside).
  function seedCtl(bar, start, fn) {
    let s = start;
    const show = Kit.el('code', {}, String(s));
    const next = () => { s = ((Math.imul(s, 1103515245) + 12345) >>> 0) % 100000; show.textContent = String(s); fn(s); };
    bar.button('New seed', next);
    bar.row.append(Kit.el('span', { class: 'seed' }, 'seed ', show));
    return { next, get: () => s };
  }

  // =====================================================================================
  // 1. terrain: an island from domain-warped fBm with a falloff, biomes from height and moisture, rivers.
  // =====================================================================================
  Kit.register('terrain', { title: 'Island terrain: warped noise, falloff, biomes, rivers', fit: 'prebake' }, host => {
    const W = 160, H = 100;
    const cv = Kit.canvas(host, W, H);
    // [name, dark, base, light]: each biome has a three-step ramp for hill shading.
    const B = [['Ocean', 21, 22, 23], ['Beach', 29, 13, 13], ['Desert', 28, 29, 13], ['Grassland', 17, 18, 19],
      ['Forest', 15, 16, 17], ['Rainforest', 14, 15, 16], ['Tundra', 4, 5, 6], ['Snow', 6, 7, 7]];
    const BEACH = 1, DESERT = 2, GRASS = 3, FOREST = 4, RAIN = 5, TUNDRA = 6, SNOW = 7;
    // Whittaker-style table: rows by height above the sea, columns by moisture.
    function biome(el, m) {
      if (el < 0.04) return BEACH;
      if (el > 0.86) return m > 0.3 ? SNOW : TUNDRA;
      if (el > 0.7) return m > 0.55 ? FOREST : TUNDRA;
      if (m < 0.22) return DESERT;
      if (m < 0.46) return GRASS;
      if (m < 0.74) return FOREST;
      return RAIN;
    }
    const MOIST = [27, 28, 29, 13, 18, 17, 23, 22];
    let seed = 1234, warp = 1, sea = 0.4, view = 'Biomes';
    let E, M0;

    function fields() {
      E = new Float32Array(W * H); M0 = new Float32Array(W * H);
      const f = 0.019;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const fx = x * f, fy = y * f;
        // domain warp (Quilez): sample the noise at a point pushed around by two more noises
        const qx = fbm(fx + 3.1, fy + 7.7, seed + 1, 3), qy = fbm(fx + 11.3, fy + 1.9, seed + 2, 3);
        const n = fbm(fx + warp * 1.6 * qx, fy + warp * 1.6 * qy, seed, 4);
        // square bump falloff: 0 in the middle, 1 at the frame, so the land becomes an island
        const nx = (x + 0.5) / W * 2 - 1, ny = (y + 0.5) / H * 2 - 1;
        const d = 1 - (1 - nx * nx) * (1 - ny * ny);
        const i = y * W + x;
        E[i] = clamp(0.66 + n * 1.2 - 0.9 * d, 0, 1);
        M0[i] = clamp(0.5 + fbm(x * 0.022 + 40, y * 0.022, seed + 9, 3) * 1.5, 0, 1);
      }
    }

    // Rivers: start on wet high ground, step to the lowest neighbor until the sea. In a pit, take the lowest
    // unvisited neighbor even if it is higher (a crude stand-in for filling the pit into a lake).
    function rivers() {
      const R = new Uint8Array(W * H), r = Kit.rng(seed * 7 + 3);
      let made = 0;
      for (let tries = 0; tries < 600 && made < 10; tries++) {
        let i = r.int(3, H - 4) * W + r.int(3, W - 4);
        const el = (E[i] - sea) / (1 - sea);
        if (el < 0.3 || M0[i] < 0.25) continue;
        let near = false;
        const sx = i % W, sy = (i / W) | 0;
        for (let dy = -7; dy <= 7 && !near; dy++) for (let dx = -7; dx <= 7; dx++) if (R[clamp(sy + dy, 0, H - 1) * W + clamp(sx + dx, 0, W - 1)]) { near = true; break; }
        if (near) continue;
        const path = [], seen = new Set();
        let ok = false;
        for (let step = 0; step < 500; step++) {
          path.push(i); seen.add(i);
          if (E[i] < sea || (step > 0 && R[i])) { ok = true; break; }
          const x = i % W, y = (i / W) | 0;
          let best = -1, be = Infinity;
          for (const [dx, dy] of D8) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const j = ny * W + nx;
            if (!seen.has(j) && E[j] < be) { be = E[j]; best = j; }
          }
          if (best < 0) break;
          i = best;
        }
        if (!ok || path.length < 10) continue;
        // a river widens on its way down: the last stretch is two pixels wide
        path.forEach((p, k) => {
          if (E[p] < sea) return;
          R[p] = 1;
          if (k > path.length * 0.55 && p % W < W - 1 && E[p + 1] >= sea) R[p + 1] = 1;
        });
        made++;

      }
      return R;
    }

    const setLegend = legend(host);
    function paint() {
      const R = rivers();
      // rivers wet the land around them
      const M = M0.slice();
      for (let i = 0; i < W * H; i++) {
        if (!R[i]) continue;
        const x = i % W, y = (i / W) | 0;
        for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const d = Math.hypot(dx, dy);
          if (d > 5) continue;
          const j = ny * W + nx;
          M[j] = Math.max(M[j], Math.min(1, M0[j] + 0.32 * (1 - d / 6)));
        }
      }
      const pix = new Kit.Pix(W, H);
      const at = (x, y) => E[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, e = E[i];
        let c;
        if (e < sea) {
          const depth = (sea - e) / sea;
          c = depth < 0.07 ? 23 : depth < 0.22 ? 22 : depth < 0.45 ? 21 : 20;
          // surf where water touches land
          for (const [dx, dy] of D4) if (at(x + dx, y + dy) >= sea) { c = 24; break; }
          if (view === 'Moisture') c = 20;
        } else if (R[i]) {
          c = view === 'Height' ? 22 : 23;
        } else {
          const el = (e - sea) / (1 - sea);
          if (view === 'Height') c = Kit.RAMPS.grey[1 + clamp(Math.floor(el * 7), 0, 6)];
          else if (view === 'Moisture') c = MOIST[clamp(Math.floor(M[i] * 8), 0, 7)];
          else {
            const b = biome(el, M[i]);
            // hill shading, light from the top left; flat ground keeps its base color
            const s = at(x - 1, y - 1) - at(x + 1, y + 1);
            c = s < -0.024 ? B[b][3] : s > 0.024 ? B[b][1] : B[b][2];
            // a sparse stipple of darker trees in the forests
            if ((b === FOREST || b === RAIN) && c === B[b][2] && Kit.hash2(x, y, seed) < 0.14) c = B[b][1];
          }
        }
        pix.set(x, y, c);
      }
      cv.put(pix);
      if (view === 'Biomes') setLegend(B.map(b => [b[0], b[2]]).concat([['River', 23]]));
      else if (view === 'Height') setLegend([['Low', 1], ['', 3], ['', 5], ['High', 7], ['Sea', 21]]);
      else setLegend([['Dry', 27], ['', 29], ['', 18], ['Wet', 22], ['Sea', 20]]);
    }

    const bar = Kit.bar(host);
    bar.tabs(['Height', 'Moisture', 'Biomes'], v => { view = v; paint(); }, 'Biomes');
    bar.slider('Warp', 0, 2, 0.1, warp, v => { warp = v; fields(); paint(); });
    bar.slider('Sea level', 0.3, 0.6, 0.01, sea, v => { sea = v; paint(); });
    bar.seed(seed, s => { seed = s; fields(); paint(); });
    fields(); paint();
  });

  // =====================================================================================
  // 2. wfc: tiled wave function collapse over a small tileset, shown one tile at a time.
  // =====================================================================================
  Kit.register('wfc', { title: 'Wave function collapse, tile by tile', fit: 'per-frame' }, host => {
    const TS = 8, GW = 20, GH = 12, N = GW * GH;
    const cv = Kit.canvas(host, GW * TS, GH * TS);

    // The tileset. Terrain tiles are corner tiles: each corner is Water or Grass, and the beach is drawn inside the
    // tiles where they meet. Decorations and paths sit on all-grass tiles. Edge sockets (the two corners along an edge,
    // plus a path flag) decide which tiles may sit side by side.
    const tiles = [];
    const add = (corners, w, extra = {}) => tiles.push(Object.assign({ corners, w, path: 0, deco: null, v: 0 }, extra));
    for (let m = 0; m < 16; m++) {
      const c = [m & 1 ? 'G' : 'W', m & 2 ? 'G' : 'W', m & 4 ? 'G' : 'W', m & 8 ? 'G' : 'W']; // tl tr br bl
      // transitions light, solid tiles heavy, so regions grow large before they turn;
      // the two saddles (opposite corners) are left out because their beaches cross in an X
      if (m === 5 || m === 10) continue;
      const w = 0.5;
      if (m === 0) { add(c, 4); add(c, 2.5, { v: 1 }); add(c, 1.5, { v: 2 }); continue; }
      if (m === 15) { add(c, 3.5); add(c, 2, { v: 1 }); continue; }
      add(c, w);
    }
    const GGGG = ['G', 'G', 'G', 'G'];
    add(GGGG, 2.5, { deco: 'tree' });
    add(GGGG, 0.6, { deco: 'flowers' });
    add(GGGG, 0.25, { deco: 'rock' });
    // paths: bit 1 north, 2 east, 4 south, 8 west
    const PW = { 5: 0.4, 10: 0.4, 3: 0.15, 6: 0.15, 12: 0.15, 9: 0.15, 7: 0.02, 11: 0.02, 13: 0.02, 14: 0.02, 15: 0.01, 1: 0.12, 2: 0.12, 4: 0.12, 8: 0.12 };
    for (const p in PW) add(GGGG, PW[p], { path: +p });
    const T = tiles.length;
    const sock = t => {
      const [tl, tr, br, bl] = t.corners, p = t.path;
      return [tl + tr + (p & 1 ? 'p' : ''), tr + br + (p & 2 ? 'p' : ''), bl + br + (p & 4 ? 'p' : ''), tl + bl + (p & 8 ? 'p' : '')];
    };
    const socks = tiles.map(sock);
    // adj[d][a] = tiles allowed on side d of tile a
    const adj = [0, 1, 2, 3].map(d => tiles.map((_, a) => {
      const out = [];
      for (let b = 0; b < T; b++) if (socks[b][(d + 2) % 4] === socks[a][d]) out.push(b);
      return out;
    }));
    const wt = tiles.map(t => t.w), wlog = tiles.map(t => t.w * Math.log(t.w));
    const hasW = tiles.map(t => t.corners.includes('W')), hasG = tiles.map(t => t.corners.includes('G'));

    // Tile art. The terrain is a bilinear blend of corner heights (water 0, grass 2) cut into bands: water, foam,
    // wet sand, sand, a dark grass edge, grass. The blend along an edge depends only on that edge's corners,
    // so shorelines always line up across tiles.
    const HT = { W: 0, G: 2 };
    const SPR = {
      tree: ['..kkkk..', '.kflllk.', 'kffllffk', 'kfffffdk', 'kdfffddk', '.kddddk.', '..kttk..', '...ss...'],
      flowers: ['........', '.a......', '.g...b..', '.....g..', '..w.....', '..g...a.', '......g.', '........'],
      rock: ['........', '........', '..kkkk..', '.kllmmk.', '.kmmmdk.', '.kddddk.', '..kkkk..', '........'],
    };
    const KEY = { tree: { k: 14, f: 16, l: 18, d: 15, t: 27, s: 15 }, flowers: { a: 13, b: 31, w: 7, g: 16 }, rock: { k: 1, l: 6, m: 5, d: 4 } };
    const atlas = new Kit.Pix(T * TS, TS);
    tiles.forEach((t, k) => {
      const ox = k * TS, h = t.corners.map(c => HT[c]);
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        const u = (x + 0.5) / TS, v = (y + 0.5) / TS;
        const val = h[0] * (1 - u) * (1 - v) + h[1] * u * (1 - v) + h[2] * u * v + h[3] * (1 - u) * v;
        let c = val < 0.5 ? 22 : val < 0.7 ? 24 : val < 0.86 ? 29 : val < 1.28 ? 13 : val < 1.46 ? 15 : 17;
        // a few fixed marks per variant: ripples on water, grains on sand, tufts on grass
        if (c === 22 && t.v === 1 && y === 2 && (x === 1 || x === 2)) c = 23;
        if (c === 22 && t.v === 1 && y === 5 && (x === 5 || x === 6)) c = 23;
        if (c === 22 && t.v === 2 && y === 4 && x >= 2 && x <= 4) c = 23;
        if (c === 17 && !t.deco && !t.path && val >= 1.99 && ((x === 2 && y === 5) || (x === 6 && y === 2))) c = 18;
        atlas.set(ox + x, y, c);
      }
      if (t.path) {
        const p = t.path;
        const inR = (x, y) => {
          x = clamp(x, 0, 7); y = clamp(y, 0, 7);
          const cx = x >= 2 && x <= 5, cy = y >= 2 && y <= 5;
          return (cx && cy) || (p & 1 && cx && y <= 5) || (p & 4 && cx && y >= 2) || (p & 2 && cy && x >= 2) || (p & 8 && cy && x <= 5);
        };
        for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
          if (!inR(x, y)) continue;
          const edge = !inR(x - 1, y) || !inR(x + 1, y) || !inR(x, y - 1) || !inR(x, y + 1);
          atlas.set(ox + x, y, edge ? 28 : 29);
        }
      }
      if (t.deco) sprite(atlas, SPR[t.deco], KEY[t.deco], ox, 0);
    });
    const atlasCv = bake(atlas);

    // ---- the solver ----
    let seed = 5, r, wave, cnt, history, last, backtracks, restarts, done, hold, paused = false;
    function clear() { wave = new Uint8Array(N * T).fill(1); cnt = new Uint16Array(N).fill(T); history = []; last = -1; done = false; hold = 0; }
    function reset() { r = Kit.rng(seed); backtracks = 0; restarts = 0; clear(); }
    const ban = (i, t) => { wave[i * T + t] = 0; cnt[i]--; };
    // lowest Shannon entropy first, ties broken by a little seeded noise
    function pickCell() {
      let best = -1, be = Infinity;
      for (let i = 0; i < N; i++) {
        if (cnt[i] === 1) continue;
        let sw = 0, swl = 0;
        for (let t = 0; t < T; t++) if (wave[i * T + t]) { sw += wt[t]; swl += wlog[t]; }
        const e = Math.log(sw) - swl / sw + r() * 1e-3;
        if (e < be) { be = e; best = i; }
      }
      return best;
    }
    const sup = new Uint8Array(T);
    function propagate(stack) {
      while (stack.length) {
        const i = stack.pop(), x = i % GW, y = (i / GW) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = x + D4[d][0], ny = y + D4[d][1];
          if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
          const j = ny * GW + nx;
          sup.fill(0);
          for (let a = 0; a < T; a++) if (wave[i * T + a]) for (const b of adj[d][a]) sup[b] = 1;
          let changed = false;
          for (let b = 0; b < T; b++) if (wave[j * T + b] && !sup[b]) { ban(j, b); changed = true; }
          if (cnt[j] === 0) return false;
          if (changed) stack.push(j);
        }
      }
      return true;
    }
    // On a contradiction, undo the last choice and forbid it; give up and start over after many undos.
    function undo() {
      for (;;) {
        backtracks++;
        const h = history.pop();
        if (!h || backtracks > 300 * (restarts + 1)) { restarts++; clear(); return; }
        wave = h.wave; cnt = h.cnt;
        ban(h.i, h.t);
        if (cnt[h.i] > 0 && propagate([h.i])) return;
      }
    }
    function collapseOne() {
      if (done) return;
      const i = pickCell();
      if (i < 0) { done = true; last = -1; return; }
      let sw = 0;
      for (let t = 0; t < T; t++) if (wave[i * T + t]) sw += wt[t];
      let k = r() * sw, pick = -1;
      for (let t = 0; t < T; t++) if (wave[i * T + t]) { pick = t; k -= wt[t]; if (k <= 0) break; }
      history.push({ i, t: pick, wave: wave.slice(), cnt: cnt.slice() });
      for (let t = 0; t < T; t++) if (t !== pick && wave[i * T + t]) ban(i, t);
      last = i;
      if (!propagate([i])) undo();
    }

    const TINT = { w: [20, 21, 22, 23], g: [14, 15, 16, 17], n: [1, 2, 3, 4] };
    let speed = 2, loopOn = true, status;
    function draw() {
      const g = cv.g;
      let fixed = 0;
      for (let i = 0; i < N; i++) {
        const x = (i % GW) * TS, y = ((i / GW) | 0) * TS;
        if (cnt[i] === 1) {
          fixed++;
          let t = 0;
          while (!wave[i * T + t]) t++;
          g.drawImage(atlasCv, t * TS, 0, TS, TS, x, y, TS, TS);
          continue;
        }
        // undecided: dark, tinted by which terrains are still possible, with a dot that brightens as options run out
        let w = false, gr = false;
        for (let t = 0; t < T; t++) if (wave[i * T + t]) { if (hasW[t]) w = true; if (hasG[t]) gr = true; }
        const tint = w && !gr ? TINT.w : gr && !w ? TINT.g : TINT.n;
        const f = 1 - cnt[i] / T;
        g.fillStyle = PAL[tint[0]]; g.fillRect(x, y, TS, TS);
        g.fillStyle = PAL[tint[f < 0.25 ? 1 : f < 0.6 ? 2 : 3]]; g.fillRect(x + 3, y + 3, 2, 2);
      }
      if (last >= 0) {
        const x = (last % GW) * TS, y = ((last / GW) | 0) * TS;
        g.fillStyle = PAL[13];
        g.fillRect(x, y, TS, 1); g.fillRect(x, y + TS - 1, TS, 1); g.fillRect(x, y, 1, TS); g.fillRect(x + TS - 1, y, 1, TS);
      }
      const s = `${fixed}/${N} tiles, ${backtracks} undone, ${restarts} restarts, ${T} tile types`;
      if (status && status.textContent !== s) status.textContent = s;
    }
    function step() {
      if (done) { if (loopOn && !paused && ++hold > 75) seeds.next(); return; }
      if (paused) return;
      for (let k = 0; k < speed; k++) collapseOne();
    }

    reset();
    const bar = Kit.bar(host);
    const runBtn = bar.button('Pause', () => { paused = !paused; runBtn.textContent = paused ? 'Run' : 'Pause'; });
    bar.button('Step', () => { paused = true; runBtn.textContent = 'Run'; collapseOne(); draw(); });
    bar.button('Finish', () => { let guard = 0; while (!done && guard++ < 5000) collapseOne(); draw(); });
    const seeds = seedCtl(bar, seed, s => { seed = s; reset(); draw(); });
    bar.slider('Speed', 1, 10, 1, speed, v => { speed = v; });
    bar.check('Loop', loopOn, v => { loopOn = v; });
    const bar2 = Kit.bar(host);
    status = bar2.note('');
    Kit.loop(host, step, draw, 30);
  });

  // =====================================================================================
  // 3. dungeons: BSP rooms, cellular caves, a drunkard's walk, and Spelunky-style room templates.
  // =====================================================================================
  Kit.register('dungeons', { title: 'Dungeons: BSP, caves, drunkard\'s walk, room templates', fit: 'prebake' }, host => {
    const GW = 40, GH = 32, TS = 4;
    const cv = Kit.canvas(host, GW * TS, GH * TS);
    const MODES = ['BSP', 'Caves', 'Drunkard', 'Templates'];
    let seed = 7, mode = 'BSP', showRoute = true, showStruct = false;
    const at = (m, x, y) => x >= 0 && y >= 0 && x < GW && y < GH && m[y * GW + x] === 1;
    // entrance and exit: the two ends of the longest walk (find the farthest cell twice)
    function ends(m, from) {
      const a = farthest(bfs(GW, GH, m, [from]));
      const d = bfs(GW, GH, m, [a]);
      return { start: a, end: farthest(d), dist: d };
    }

    function genBSP(r) {
      const m = new Uint8Array(GW * GH), leaves = [], rooms = [];
      const carve = (x, y, w, h) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) m[j * GW + i] = 1; };
      const inRoom = rm => [rm.x + r.int(0, rm.w - 1), rm.y + r.int(0, rm.h - 1)];
      function corridor(a, b) {
        const [x1, y1] = inRoom(a), [x2, y2] = inRoom(b);
        const h = (xa, xb, y) => { for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) m[y * GW + x] = 1; };
        const v = (ya, yb, x) => { for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) m[y * GW + x] = 1; };
        if (r.chance(0.5)) { h(x1, x2, y1); v(y1, y2, x2); } else { v(y1, y2, x1); h(x1, x2, y2); }
      }
      function split(x, y, w, h, depth) {
        const MIN = 8, canV = w >= MIN * 2, canH = h >= MIN * 2;
        if ((!canV && !canH) || depth > 4 || (depth > 2 && r.chance(0.15))) {
          leaves.push({ x, y, w, h });
          const rw = r.int(Math.max(3, (w * 0.5) | 0), w - 2), rh = r.int(Math.max(3, (h * 0.5) | 0), h - 2);
          const room = { x: x + r.int(1, w - rw - 1), y: y + r.int(1, h - rh - 1), w: rw, h: rh };
          carve(room.x, room.y, room.w, room.h); rooms.push(room);
          return room;
        }
        const vert = canV && (!canH || r.chance(w > h ? 0.8 : 0.2));
        const c = vert ? r.int(MIN, w - MIN) : r.int(MIN, h - MIN);
        const a = vert ? split(x, y, c, h, depth + 1) : split(x, y, w, c, depth + 1);
        const b = vert ? split(x + c, y, w - c, h, depth + 1) : split(x, y + c, w, h - c, depth + 1);
        corridor(a, b); // siblings always join, so the whole tree is connected
        return r.chance(0.5) ? a : b;
      }
      split(0, 0, GW, GH, 0);
      const c0 = rooms[0], s = (c0.y + (c0.h >> 1)) * GW + c0.x + (c0.w >> 1);
      const d = bfs(GW, GH, m, [s]);
      let end = s, best = -1;
      for (const rm of rooms) { const i = (rm.y + (rm.h >> 1)) * GW + rm.x + (rm.w >> 1); if (d[i] > best) { best = d[i]; end = i; } }
      return { m, start: s, end, dist: d, leaves };
    }

    function genCaves(r) {
      let m = new Uint8Array(GW * GH);
      for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) m[y * GW + x] = r.chance(0.45) ? 0 : 1;
      // 4-5 rule: a wall stays with 4+ wall neighbors, a floor becomes wall with 5+
      for (let it = 0; it < 4; it++) {
        const n = new Uint8Array(GW * GH);
        for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
          let walls = 0;
          for (const [dx, dy] of D8) if (!at(m, x + dx, y + dy)) walls++;
          const wall = m[y * GW + x] ? walls >= 5 : walls >= 4;
          n[y * GW + x] = wall ? 0 : 1;
        }
        m = n;
      }
      // keep only the largest connected region; remember the rest to show what the flood fill removed
      const label = new Int32Array(GW * GH).fill(-1), sizes = [];
      for (let i = 0; i < GW * GH; i++) {
        if (!m[i] || label[i] >= 0) continue;
        const d = bfs(GW, GH, m, [i]);
        let n = 0;
        for (let j = 0; j < GW * GH; j++) if (d[j] >= 0) { label[j] = sizes.length; n++; }
        sizes.push(n);
      }
      const big = sizes.indexOf(Math.max(...sizes));
      const culled = new Uint8Array(GW * GH);
      let any = -1;
      for (let i = 0; i < GW * GH; i++) if (m[i]) { if (label[i] !== big) { m[i] = 0; culled[i] = 1; } else any = i; }
      return Object.assign({ m, culled }, ends(m, any));
    }

    function genDrunk(r) {
      const m = new Uint8Array(GW * GH);
      let x = GW >> 1, y = GH >> 1, floor = 0;
      const start = y * GW + x, target = (GW * GH * 0.36) | 0;
      for (let s = 0; s < 40000 && floor < target; s++) {
        if (!m[y * GW + x]) { m[y * GW + x] = 1; floor++; }
        const [dx, dy] = r.pick(D4);
        x = clamp(x + dx, 1, GW - 2); y = clamp(y + dy, 1, GH - 2);
      }
      const d = bfs(GW, GH, m, [start]);
      return { m, start, end: farthest(d), dist: d };
    }

    // Spelunky: a 4x4 grid of 10x8 rooms. A path drops from the top row to the bottom; each room on it gets a template
    // with the openings it needs (1 left-right, 2 also a hole in the floor, 3 also open above, 4 open above and below).
    const TPL = {
      0: [['0000000000', '0002200000', '0000000220', '0000000000', '0220000000', '0000002200', '1110000000', '1111111111'],
        ['1111111111', '1100000011', '1000000001', '1022002201', '1000000001', '1100000011', '1111111111', '1111111111'],
        ['1111111111', '1111111111', '1110000111', '1100000011', '1000220001', '1100000011', '1111111111', '1111111111']],
      1: [['0000000000', '0000000000', '0002222000', '0000000000', '0000000000', '0000000000', '1100000011', '1111111111'],
        ['0000000000', '0000000000', '0000000000', '0000110000', '0001111000', '2000000002', '1100000011', '1112222111'],
        ['0000000000', '0000000000', '0000000000', '0220000000', '0000000220', '0000000000', '0000000000', '1111111111']],
      2: [['0000000000', '0000000000', '0002222000', '0000000000', '0000000000', '1100000011', '1110000111', '1110000111'],
        ['0000000000', '0000000000', '0000000000', '0220000220', '0000000000', '2000000002', '1110000111', '1110000111']],
      3: [['0000000000', '0000000000', '0000000000', '0000000000', '0011000110', '0000000000', '1000000001', '1111111111'],
        ['0000000000', '0000000000', '0000000000', '2000000002', '1100000011', '1100220011', '1110000111', '1111111111']],
      4: [['0000000000', '0000000000', '0000000000', '0110000110', '0000000000', '1000000001', '1110000111', '1110000111'],
        ['0000000000', '0000000000', '2200000022', '0000000000', '0220000220', '0000000000', '1110000111', '1110000111']],
    };
    function genRooms(r) {
      const RW = 10, RH = 8, types = new Int8Array(16), order = [];
      let col = r.int(0, 3), row = 0, dir = r.chance(0.5) ? -1 : 1;
      types[col] = 1; order.push(col);
      for (let guard = 0; guard < 64; guard++) {
        const nc = col + dir;
        if (nc < 0 || nc > 3 || r.chance(0.3)) { // go down a row (or finish at the bottom)
          if (row === 3) break;
          types[row * 4 + col] = types[row * 4 + col] === 3 ? 4 : 2;
          row++; types[row * 4 + col] = 3; order.push(row * 4 + col);
          dir = r.chance(0.5) ? -1 : 1;
        } else { col = nc; types[row * 4 + col] = 1; order.push(row * 4 + col); }
      }
      const m = new Uint8Array(GW * GH); // 1 = solid here
      const onPath = new Uint8Array(16);
      for (const k of order) onPath[k] = 1;
      for (let k = 0; k < 16; k++) {
        const t = onPath[k] ? types[k] : 0;
        const tpl = r.pick(TPL[t]), flip = r.chance(0.5);
        const ox = (k % 4) * RW, oy = ((k / 4) | 0) * RH;
        for (let j = 0; j < RH; j++) for (let i = 0; i < RW; i++) {
          const ch = tpl[j][flip ? RW - 1 - i : i];
          m[(oy + j) * GW + ox + i] = ch === '1' || (ch === '2' && r.chance(0.5)) ? 1 : 0;
        }
      }
      for (let x = 0; x < GW; x++) { m[x] = 2; m[(GH - 1) * GW + x] = 2; }
      for (let y = 0; y < GH; y++) { m[y * GW] = 2; m[y * GW + GW - 1] = 2; }
      // a door stands on a floor inside the first and last rooms
      const door = k => {
        const ox = (k % 4) * RW, oy = ((k / 4) | 0) * RH;
        const xs = [4, 5, 3, 6, 2, 7, 1, 8];
        for (let j = RH - 1; j >= 1; j--) for (const i of xs) {
          const x = ox + i, y = oy + j;
          if (!m[y * GW + x] && !m[(y - 1) * GW + x] && m[(y + 1) * GW + x]) return y * GW + x;
        }
        return (oy + RH - 2) * GW + ox + 4;
      };
      return { m, side: true, start: door(order[0]), end: door(order[order.length - 1]), order, types, onPath };
    }

    const THEME = {
      BSP: { floor: 3, speck: 2, shade: 2, top: 1, rim: 4, face: 5, faceDark: 4, seam: 4, joint: 2 },
      Caves: { floor: 27, speck: 26, shade: 26, top: 14, rim: 16, face: 15, faceDark: 14, seam: 14, joint: -1 },
      Drunkard: { floor: 3, speck: 2, shade: 2, top: 20, rim: 22, face: 21, faceDark: 20, seam: 20, joint: -1 },
    };
    function renderTop(L, th) {
      const pix = new Kit.Pix(GW * TS, GH * TS).fill(0), m = L.m;
      const fl = (x, y) => at(m, x, y);
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        const ox = x * TS, oy = y * TS;
        if (fl(x, y)) {
          pix.rect(ox, oy, TS, TS, th.floor);
          if (th.joint >= 0) pix.set(ox, oy, th.joint);
          if (Kit.hash2(x, y, seed) < 0.12) pix.set(ox + 1 + ((x * 7 + y) % 2), oy + 2, th.speck);
          if (!fl(x, y - 1)) pix.rect(ox, oy, TS, 1, th.shade); // the wall above casts a short shadow
          continue;
        }
        let near = false;
        for (const [dx, dy] of D8) if (fl(x + dx, y + dy)) { near = true; break; }
        if (!near) continue; // solid rock far from any floor stays ink
        pix.rect(ox, oy, TS, TS, th.top);
        // a light rim where the wall top meets open floor
        if (fl(x - 1, y)) pix.rect(ox, oy, 1, TS, th.rim);
        if (fl(x + 1, y)) pix.rect(ox + TS - 1, oy, 1, TS, th.rim);
        if (fl(x, y - 1)) pix.rect(ox, oy, TS, 1, th.rim);
        if (fl(x - 1, y - 1)) pix.set(ox, oy, th.rim);
        if (fl(x + 1, y - 1)) pix.set(ox + TS - 1, oy, th.rim);
        if (fl(x - 1, y + 1)) pix.set(ox, oy + TS - 1, th.rim);
        if (fl(x + 1, y + 1)) pix.set(ox + TS - 1, oy + TS - 1, th.rim);
        if (fl(x, y + 1)) { // the wall's face, seen from the south in 3/4 view
          pix.rect(ox, oy, TS, 1, th.rim);
          pix.rect(ox, oy + 1, TS, 2, th.face);
          pix.rect(ox, oy + 3, TS, 1, th.faceDark);
          pix.set(ox + ((x + y) % 2 ? 1 : 3), oy + 1, th.seam);
        }
      }
      if (showStruct && L.leaves) {
        for (const lf of L.leaves) {
          const x0 = lf.x * TS, y0 = lf.y * TS, x1 = (lf.x + lf.w) * TS - 1, y1 = (lf.y + lf.h) * TS - 1;
          for (let x = x0; x <= x1; x += 2) { pix.set(x, y0, 31); pix.set(x, y1, 31); }
          for (let y = y0; y <= y1; y += 2) { pix.set(x0, y, 31); pix.set(x1, y, 31); }
        }
      }
      if (showStruct && L.culled) {
        for (let i = 0; i < GW * GH; i++) if (L.culled[i]) {
          const ox = (i % GW) * TS, oy = ((i / GW) | 0) * TS;
          pix.rect(ox, oy, TS, TS, 9); pix.rect(ox + 1, oy + 1, 2, 2, 10);
        }
      }
      if (showStruct && mode === 'Drunkard') {
        const ox = (L.start % GW) * TS, oy = ((L.start / GW) | 0) * TS;
        for (let k = -6; k <= 9; k += 2) { pix.set(ox + k, oy - 3, 31); pix.set(ox + k, oy + 6, 31); pix.set(ox - 3, oy + k, 31); pix.set(ox + 6, oy + k, 31); }
      }
      return pix;
    }
    function renderSide(L) {
      const pix = new Kit.Pix(GW * TS, GH * TS), m = L.m;
      for (let k = 0; k < 16; k++) pix.rect((k % 4) * 40, ((k / 4) | 0) * 32, 40, 32, L.onPath[k] ? 2 : 1);
      const solid = (x, y) => x < 0 || y < 0 || x >= GW || y >= GH || m[y * GW + x] > 0;
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        const v = m[y * GW + x];
        if (!v) continue;
        const ox = x * TS, oy = y * TS;
        const [base, lite, dark, top] = v === 2 ? [3, 4, 2, 5] : [27, 28, 26, 17];
        pix.rect(ox, oy, TS, TS, base);
        if (!solid(x - 1, y)) pix.rect(ox, oy, 1, TS, lite);
        if (!solid(x + 1, y)) pix.rect(ox + TS - 1, oy, 1, TS, dark);
        if (!solid(x, y + 1)) pix.rect(ox, oy + TS - 1, TS, 1, dark);
        if (!solid(x, y - 1)) { pix.rect(ox, oy, TS, 1, top); if (v === 1) pix.set(ox + ((x * 3 + y) % 3), oy + 1, 16); }
        else if (v === 1 && Kit.hash2(x, y, seed) < 0.3) pix.set(ox + 1 + (x % 2), oy + 2, 26);
      }
      if (showStruct) {
        for (let x = 0; x < GW * TS; x += 2) for (let k = 1; k < 4; k++) pix.set(x, k * 32, 4);
        for (let y = 0; y < GH * TS; y += 2) for (let k = 1; k < 4; k++) pix.set(k * 40, y, 4);
        for (let k = 0; k < 16; k++) if (L.onPath[k]) textPix(pix, String(L.types[k]), (k % 4) * 40 + 2, ((k / 4) | 0) * 32 + 2, 6, 0);
      }
      return pix;
    }
    function door(pix, i, frame) { // side view: a 4x6 doorway standing on the floor
      const ox = (i % GW) * TS, oy = ((i / GW) | 0) * TS + TS - 6;
      pix.rect(ox, oy, 4, 6, frame); pix.rect(ox + 1, oy + 1, 2, 5, 0);
      pix.set(ox, oy, -1); pix.set(ox + 3, oy, -1);
      pix.set(ox, oy, pix.get(ox - 1, oy) < 0 ? 1 : pix.get(ox - 1, oy));
    }
    function stairs(pix, i, a, b) { // top-down: a 6x6 stair marker with an ink outline
      const ox = (i % GW) * TS - 1, oy = ((i / GW) | 0) * TS - 1;
      pix.rect(ox, oy, 6, 6, 0);
      for (let j = 1; j < 5; j++) pix.rect(ox + 1, oy + j, 4, 1, j % 2 ? a : b);
    }

    const note = { BSP: 'Split the map in two again and again; one room per leaf; join sibling rooms with L-shaped corridors.',
      Caves: '45% walls, four passes of the 4-5 rule, then a flood fill keeps the largest cave (Structure shows what it cut).',
      Drunkard: 'One walker steps at random from the center until 36% of the map is floor. Always connected, never planned.',
      Templates: 'Spelunky: a path drops through a 4x4 grid of rooms; each room picks a template with the openings it needs (side view).' };
    let noteEl;
    function draw() {
      const r = Kit.rng(seed * 31 + MODES.indexOf(mode));
      const L = mode === 'BSP' ? genBSP(r) : mode === 'Caves' ? genCaves(r) : mode === 'Drunkard' ? genDrunk(r) : genRooms(r);
      let pix;
      if (L.side) {
        pix = renderSide(L);
        if (showRoute) { // a dotted line through the centers of the rooms on the path
          for (let k = 1; k < L.order.length; k++) {
            const a = L.order[k - 1], b = L.order[k];
            const ax = (a % 4) * 40 + 20, ay = ((a / 4) | 0) * 32 + 16, bx = (b % 4) * 40 + 20, by = ((b / 4) | 0) * 32 + 16;
            const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
            for (let s = 0; s <= n; s += 3) { const x = Math.round(ax + (bx - ax) * s / n), y = Math.round(ay + (by - ay) * s / n); pix.rect(x, y, 2, 2, 13); }
          }
        }
        door(pix, L.start, 18); door(pix, L.end, 12);
      } else {
        pix = renderTop(L, THEME[mode]);
        if (showRoute) {
          const path = route(GW, L.dist, L.end);
          path.forEach((i, k) => { if (k % 2 === 0) pix.rect((i % GW) * TS + 1, ((i / GW) | 0) * TS + 1, 2, 2, 13); });
        }
        stairs(pix, L.start, 18, 16); stairs(pix, L.end, 12, 10);
      }
      cv.put(pix);
      if (noteEl) noteEl.textContent = note[mode];
    }
    const bar = Kit.bar(host);
    bar.tabs(MODES, v => { mode = v; draw(); }, mode);
    bar.seed(seed, s => { seed = s; draw(); });
    bar.check('Route', showRoute, v => { showRoute = v; draw(); });
    bar.check('Structure', showStruct, v => { showStruct = v; draw(); });
    noteEl = Kit.bar(host).note('');
    draw();
  });

  // =====================================================================================
  // 4. autotile: paint terrain; marching squares picks one of 16 corner tiles; the dual grid is the same lookup with
  //    the map's cells as the corners, which lets 6 drawn tiles cover all 16 by rotation.
  // =====================================================================================
  Kit.register('autotile', { title: 'Autotiling: marching squares and the dual grid', fit: 'per-frame' }, host => {
    const TS = 8, TW = 20, TH = 12, VW = TW + 1, VH = TH + 1, MAPH = TH * TS, STRIP = 14;
    const cv = Kit.canvas(host, TW * TS, MAPH + STRIP);
    cv.cv.style.touchAction = 'none';
    const v = new Uint8Array(VW * VH);
    function blob() {
      for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
        const nx = (x - 10) / 8.5, ny = (y - 6) / 5.2;
        const d = Math.sqrt(nx * nx + ny * ny);
        v[y * VW + x] = 1 - d + 0.55 * Kit.fbm(x * 0.3, y * 0.3, 11, 3) > 0.22 ? 1 : 0;
      }
      v[5 * VW + 12] = v[5 * VW + 13] = v[6 * VW + 12] = 0; // a pond in the middle shows inner corners
      v[3 * VW + 17] = 1; v[10 * VW + 3] = 1; // and two islets show the single-corner tiles
    }
    blob();

    // Which pixels of a tile are grass, for corner mask idx (bits: 1 top-left, 2 top-right, 4 bottom-right, 8 bottom-left).
    // Each quadrant looks at its own corner and the two beside it; curves are quarter circles of radius half a tile
    // centered on the corners, so every boundary meets the tile edge at its midpoint, square on, and tiles always join.
    function mask(idx) {
      const m = new Uint8Array(64);
      const C = (qx, qy) => qy ? (qx ? 2 : 3) : (qx ? 1 : 0);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const qx = x >= 4 ? 1 : 0, qy = y >= 4 ? 1 : 0;
        const a = (idx >> C(qx, qy)) & 1, b = (idx >> C(1 - qx, qy)) & 1, d = (idx >> C(qx, 1 - qy)) & 1;
        const o = (idx >> C(1 - qx, 1 - qy)) & 1;
        const dx = x + 0.5 - qx * 8, dy = y + 0.5 - qy * 8, r2 = dx * dx + dy * dy;
        // with only two opposite corners set (a saddle), keep them apart as two quarter circles
        m[y * 8 + x] = a ? (b || d ? 1 : r2 < 16) : (b && d && o ? r2 >= 16 : 0);
      }
      return m;
    }
    // Lookups past the tile's edge mirror back inside, which matches the neighbor because boundaries cross square on.
    const mir = (m, x, y) => m[(y < 0 ? -1 - y : y > 7 ? 15 - y : y) * 8 + (x < 0 ? -1 - x : x > 7 ? 15 - x : x)];
    // Directional art for the 16-tile set: dark outline, a light lip along the top, a dirt cliff face below.
    function artLit(idx) {
      const m = mask(idx), out = new Int16Array(64);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const M = (dx, dy) => mir(m, x + dx, y + dy);
        let c;
        if (M(0, 0)) {
          const edge = !M(-1, 0) || !M(1, 0) || !M(0, -1) || !M(0, 1);
          c = edge ? 14 : !M(0, -2) ? 18 : 17;
          if (c === 17 && ((x === 2 && y === 5) || (x === 6 && y === 1))) c = 18;
        } else {
          c = M(0, -1) ? 27 : M(0, -2) ? 26 : 28;
          if (c === 28 && ((x === 1 && y === 2) || (x === 5 && y === 6))) c = 27;
        }
        out[y * 8 + x] = c;
      }
      return out;
    }
    // Art with no direction (outline and rim all round), so turning a tile gives another valid tile.
    function artSym(idx) {
      const m = mask(idx), out = new Int16Array(64);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const M = (dx, dy) => mir(m, x + dx, y + dy);
        let c;
        if (M(0, 0)) {
          const edge = !M(-1, 0) || !M(1, 0) || !M(0, -1) || !M(0, 1);
          const rim = !M(-2, 0) || !M(2, 0) || !M(0, -2) || !M(0, 2) || !M(-1, -1) || !M(1, -1) || !M(-1, 1) || !M(1, 1);
          c = edge ? 14 : rim ? 16 : 17;
          if (c === 17 && ((x === 3 && y === 3) || (x === 4 && y === 4))) c = 18;
        } else {
          const near = M(-1, 0) || M(1, 0) || M(0, -1) || M(0, 1);
          c = near ? 26 : 28;
          if (c === 28 && ((x === 1 && y === 1) || (x === 6 && y === 6))) c = 27;
        }
        out[y * 8 + x] = c;
      }
      return out;
    }
    const rotIdx = i => ((i << 1) | (i >> 3)) & 15; // a quarter turn clockwise moves each corner bit to the next
    const rotArt = a => { const o = new Int16Array(64); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) o[y * 8 + x] = a[(7 - x) * 8 + y]; return o; };
    const BASES = [0, 1, 3, 5, 7, 15];
    const lit = [], dual = [], baseOf = [];
    for (let i = 0; i < 16; i++) lit[i] = artLit(i);
    BASES.forEach((b, k) => {
      let art = artSym(b), idx = b;
      for (let t = 0; t < 4; t++) { if (!dual[idx]) { dual[idx] = art; baseOf[idx] = k; } art = rotArt(art); idx = rotIdx(idx); }
    });
    const sheet = arts => {
      const p = new Kit.Pix(arts.length * 8, 8);
      arts.forEach((a, k) => { for (let i = 0; i < 64; i++) p.set(k * 8 + (i % 8), (i / 8) | 0, a[i]); });
      return bake(p);
    };
    const litCv = sheet(lit), dualCv = sheet(dual), baseCv = sheet(BASES.map(b => artSym(b)));

    let mode = 'Marching squares', grid = false, hover = -1, raf = 0;
    const V = (x, y) => v[y * VW + x];
    const tileIdx = (i, j) => V(i, j) | V(i + 1, j) << 1 | V(i + 1, j + 1) << 2 | V(i, j + 1) << 3;
    function draw() {
      raf = 0;
      const g = cv.g, ms = mode === 'Marching squares';
      g.fillStyle = PAL[1]; g.fillRect(0, 0, TW * TS, MAPH + STRIP);
      const atlas = ms ? litCv : dualCv;
      for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) g.drawImage(atlas, tileIdx(i, j) * 8, 0, 8, 8, i * TS, j * TS, 8, 8);
      if (grid) {
        if (ms) { // the tiles, and the corner values they read
          g.globalAlpha = 0.35; g.fillStyle = PAL[0];
          for (let i = 1; i < TW; i++) g.fillRect(i * TS, 0, 1, MAPH);
          for (let j = 1; j < TH; j++) g.fillRect(0, j * TS, TW * TS, 1);
          g.globalAlpha = 1;
          for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
            g.fillStyle = PAL[0]; g.fillRect(x * TS - 2, y * TS - 2, 4, 4);
            g.fillStyle = PAL[V(x, y) ? 19 : 12]; g.fillRect(x * TS - 1, y * TS - 1, 2, 2);
          }
        } else { // the cells you painted (squares), offset half a tile from the tiles drawn
          g.globalAlpha = 0.16; g.fillStyle = PAL[7];
          for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) if (V(x, y)) g.fillRect(x * TS - 4, y * TS - 4, TS, TS);
          g.globalAlpha = 0.4; g.fillStyle = PAL[0];
          for (let i = 0; i <= TW; i++) g.fillRect(i * TS - 4, 0, 1, MAPH);
          for (let j = 0; j <= TH; j++) g.fillRect(0, j * TS - 4, TW * TS, 1);
          g.globalAlpha = 0.25; g.fillStyle = PAL[7];
          for (let i = 1; i < TW; i++) for (let y = 0; y < MAPH; y += 2) g.fillRect(i * TS, y, 1, 1);
          for (let j = 1; j < TH; j++) for (let x = 0; x < TW * TS; x += 2) g.fillRect(x, j * TS, 1, 1);
          g.globalAlpha = 1;
        }
      }
      // the tile sheet along the bottom, with the tile under the pointer picked out
      const hi = hover >= 0 ? tileIdx(hover % TW, (hover / TW) | 0) : -1;
      const y0 = MAPH + 3;
      if (hover >= 0) {
        const hx = (hover % TW) * TS, hy = ((hover / TW) | 0) * TS;
        g.fillStyle = PAL[13];
        g.fillRect(hx, hy, TS, 1); g.fillRect(hx, hy + TS - 1, TS, 1); g.fillRect(hx, hy, 1, TS); g.fillRect(hx + TS - 1, hy, 1, TS);
      }
      const n = ms ? 16 : 6, pick = ms ? hi : hi >= 0 ? baseOf[hi] : -1;
      for (let k = 0; k < n; k++) {
        const x = 1 + k * 9;
        g.fillStyle = PAL[k === pick ? 13 : 0]; g.fillRect(x - 1, y0 - 1, 10, 10);
        g.drawImage(ms ? litCv : baseCv, k * 8, 0, 8, 8, x, y0, 8, 8);
      }
      if (ms) textG(g, '16', 147, y0 + 2, 6);
      else textG(g, '6 TILES, ROTATED', 58, y0 + 2, 6);
    }
    const redraw = () => { if (!raf) raf = requestAnimationFrame(draw); };

    let paint = -1, lastV = -1;
    const vAt = (x, y) => clamp(Math.round(y / TS), 0, VH - 1) * VW + clamp(Math.round(x / TS), 0, VW - 1);
    function stroke(to) { // fill the vertices between the last one and this one, so quick drags leave no gaps
      if (lastV < 0) { v[to] = paint; lastV = to; return; }
      const ax = lastV % VW, ay = (lastV / VW) | 0, bx = to % VW, by = (to / VW) | 0;
      const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let s = 0; s <= n; s++) v[Math.round(ay + (by - ay) * s / (n || 1)) * VW + Math.round(ax + (bx - ax) * s / (n || 1))] = paint;
      lastV = to;
    }
    cv.cv.addEventListener('pointerdown', e => {
      const [x, y] = cv.at(e);
      if (y >= MAPH) return;
      e.preventDefault();
      const i = vAt(x, y);
      paint = v[i] ? 0 : 1; lastV = -1; stroke(i);
      cv.cv.setPointerCapture(e.pointerId);
      redraw();
    });
    cv.cv.addEventListener('pointermove', e => {
      const [x, y] = cv.at(e);
      hover = x >= 0 && y >= 0 && x < TW * TS && y < MAPH ? ((y / TS) | 0) * TW + ((x / TS) | 0) : -1;
      if (paint >= 0) stroke(vAt(x, y));
      redraw();
    });
    const up = () => { paint = -1; lastV = -1; };
    cv.cv.addEventListener('pointerup', up);
    cv.cv.addEventListener('pointercancel', up);
    cv.cv.addEventListener('pointerleave', () => { hover = -1; redraw(); });

    const notes = {
      'Marching squares': 'Terrain lives on the grid corners; each tile reads its 4 corners (16 cases) and draws one of 16 tiles. Lit from above, so all 16 are drawn.',
      'Dual grid': 'Terrain lives in the cells you paint; tiles sit half a cell off, each reading the 4 cells it overlaps: the same 16 cases, from 6 tiles turned.',
    };
    const bar = Kit.bar(host);
    let noteEl;
    bar.tabs(Object.keys(notes), m => { mode = m; noteEl.textContent = notes[m]; redraw(); }, mode);
    bar.check('Show grid', grid, b => { grid = b; redraw(); });
    bar.button('Clear', () => { v.fill(0); redraw(); });
    bar.button('Reset', () => { blob(); redraw(); });
    noteEl = Kit.bar(host).note(notes[mode]);
    Kit.bar(host).note('Drag on the map to paint or erase grass.');
    draw();
  });

  // =====================================================================================
  // 5. town: a main road, a cross street and lanes, houses on lots along them, fields and woods around.
  // =====================================================================================
  Kit.register('town', { title: 'Village: roads, lots, houses, fields', fit: 'prebake' }, host => {
    const W = 160, H = 120;
    const cv = Kit.canvas(host, W, H);
    const SHADE = { 17: 16, 18: 16, 16: 15, 15: 14, 19: 18, 29: 28, 28: 27, 27: 26, 13: 29, 12: 28, 7: 6, 6: 5, 5: 4, 4: 3 };
    const ROOFS = [[9, 10, 11], [2, 3, 4], [27, 28, 29], [21, 22, 23], [9, 10, 11]];
    let seed = 31;
    function gen() {
      const r = Kit.rng(seed);
      const pix = new Kit.Pix(W, H).fill(17);
      const occ = new Uint8Array(W * H), road = new Uint8Array(W * H), plaza = new Uint8Array(W * H);
      const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
      const free = (x, y, w, h, out) => {
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
          if (!inb(i, j)) { if (out) continue; return false; }
          if (occ[j * W + i]) return false;
        }
        return true;
      };
      const mark = (x, y, w, h, k) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (inb(i, j)) occ[j * W + i] = k; };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const h = Kit.hash2(x, y, seed);
        if (h < 0.018) { pix.set(x, y, 18); pix.set(x, y + 1, 16); }
      }

      // roads
      const stamp = (x, y, rad) => { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (inb(x + dx, y + dy)) road[(y + dy) * W + x + dx] = 1; };
      const y0 = H * 0.5 + r.range(-8, 8), off = r.range(0, 50);
      const roadY = [];
      for (let x = 0; x < W; x++) { roadY[x] = Math.round(y0 + 11 * Kit.noise2(x / 60, off, seed)); stamp(x, roadY[x], 2); }
      const px = Math.round(W / 2 + r.range(-14, 14)), py = roadY[px];
      const lanes = [];
      function lane(x0, dir, len) {
        const o = r.range(0, 100), ya = roadY[clamp(x0, 0, W - 1)];
        const xAt = y => Math.round(x0 + 5 * (Kit.noise2(y / 26, o, seed) - Kit.noise2(ya / 26, o, seed)));
        const yb = ya + dir * len;
        for (let y = ya; y !== yb; y += dir) stamp(xAt(y), y, 1);
        lanes.push({ xAt, ya, dir, len });
      }
      lane(px, -1, r.chance(0.5) ? py + 3 : r.int(22, py - 8));
      lane(px, 1, r.chance(0.5) ? H - py + 3 : r.int(22, H - py - 8));
      for (const s of [-1, 1]) {
        const x0 = px + s * r.int(36, 54);
        if (x0 > 10 && x0 < W - 10) lane(x0, r.chance(0.5) ? -1 : 1, r.int(24, 42));
      }
      // the square, where the cross street meets the main road
      for (let y = py - 10; y <= py + 10; y++) for (let x = px - 14; x <= px + 14; x++) {
        const dx = (x - px) / 13.5, dy = (y - py) / 9.5;
        if (inb(x, y) && dx * dx + dy * dy <= 1) plaza[y * W + x] = 1;
      }
      for (let i = 0; i < W * H; i++) if (plaza[i]) occ[i] = 5; else if (road[i]) occ[i] = 1;

      // houses on lots along the main road (both sides), then along each lane
      const houses = [];
      const place = (x, top, w, rd) => {
        const h = rd + 4;
        if (!free(x - 1, top - 1, w + 3, h + 2, false)) return false;
        mark(x - 1, top - 1, w + 3, h + 2, 2);
        houses.push({ x, top, w, rd, h, roof: r.pick(ROOFS), wall: r.chance(0.7) ? 7 : 29, door: r.int(2, w - 5), chim: r.chance(0.5) });
        return true;
      };
      for (const side of [-1, 1]) {
        let x = r.int(1, 5);
        while (x < W - 11) {
          if (r.chance(0.12)) { x += r.int(6, 14); continue; }
          const w = r.int(10, 15), rd = r.int(6, 8), h = rd + 4;
          let lo = Infinity, hi = -Infinity;
          for (let i = x; i < x + w + 2; i++) { lo = Math.min(lo, roadY[i] ?? lo); hi = Math.max(hi, roadY[i] ?? hi); }
          const top = side < 0 ? lo - 4 - h + 1 : hi + 4;
          x += place(x, top, w, rd) ? w + r.int(3, 7) : 2;
        }
      }
      for (const L of lanes) for (const side of [-1, 1]) {
        let t = 5;
        while (t < L.len) {
          const w = r.int(10, 14), rd = r.int(6, 8), h = rd + 4;
          const y = L.ya + L.dir * t, top = L.dir > 0 ? y : y - h + 1;
          let lo = Infinity, hi = -Infinity;
          for (let j = top - 1; j <= top + h; j++) { const xx = L.xAt(j); lo = Math.min(lo, xx); hi = Math.max(hi, xx); }
          const x = side < 0 ? lo - 3 - w : hi + 3;
          t += place(x, top, w, rd) ? h + r.int(2, 5) : 2;
        }
      }

      // fields a little way out from the roads, woods further still
      const dist = bfs(W, H, new Uint8Array(W * H).fill(1), [...occ.keys()].filter(i => occ[i] === 1 || occ[i] === 5));
      const crops = [(i, j) => (i % 3 === 2 ? 29 : 13), (i, j) => (i % 2 ? 28 : (j % 2 ? 17 : 18)), (i, j) => (i % 2 ? 27 : 28)];
      let fields = 0;
      for (let t = 0; t < 120 && fields < 6; t++) {
        const w = r.int(16, 30), h = r.int(10, 18), x = r.int(-8, W - w + 8), y = r.int(-8, H - h + 8);
        const d = dist[clamp(y + (h >> 1), 0, H - 1) * W + clamp(x + (w >> 1), 0, W - 1)];
        if (d < 9 || d > 36 || !free(x - 2, y - 2, w + 4, h + 4, true)) continue;
        mark(x, y, w, h, 3); fields++;
        const crop = r.pick(crops), across = r.chance(0.5);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
          pix.set(x + i, y + j, edge ? ((i + j) % 4 ? 15 : 16) : across ? crop(j, i) : crop(i, j));
        }
      }
      const trees = [];
      for (let gy = -1; gy <= H / 5; gy++) for (let gx = -1; gx <= W / 5; gx++) {
        const x = gx * 5 + r.int(0, 4), y = gy * 5 + r.int(0, 4);
        const d = dist[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)];
        const want = (d - 10) / 22 + Kit.fbm(x / 26, y / 26, seed + 5, 3) * 1.6;
        if (want < 0.3 || r() > want) continue;
        const rr = r.chance(0.65) ? 3 : 2;
        if (!free(x - rr - 1, y - 2 * rr - 3, 2 * rr + 4, 2 * rr + 5, true)) continue;
        mark(x - rr, y - 2 * rr - 2, 2 * rr + 1, 2 * rr + 3, 4);
        trees.push({ x, y, rr });
      }
      // a few garden trees right behind houses
      for (const hs of houses) if (r.chance(0.35)) {
        const x = hs.x + hs.w + 3, y = hs.top + 4;
        if (free(x - 3, y - 7, 7, 8, false)) { mark(x - 2, y - 6, 5, 7, 4); trees.push({ x, y, rr: 2 }); }
      }

      // ground: roads with a darker edge, the cobbled square, garden paths to the road
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (plaza[i]) {
          const edge = !plaza[i - 1] || !plaza[i + 1] || !plaza[i - W] || !plaza[i + W];
          const brick = y % 3 === 0 || (x + (((y / 3) | 0) % 2) * 2) % 4 === 0;
          pix.set(x, y, edge ? 4 : brick ? 5 : 6);
        } else if (road[i]) {
          const edge = (x > 0 && !road[i - 1] && !plaza[i - 1]) || (x < W - 1 && !road[i + 1] && !plaza[i + 1]) || (y > 0 && !road[i - W] && !plaza[i - W]) || (y < H - 1 && !road[i + W] && !plaza[i + W]);
          pix.set(x, y, edge ? 28 : Kit.hash2(x, y, seed + 1) < 0.05 ? 28 : 29);
        }
      }
      for (const hs of houses) { // a path from the door down to the road, when the road is below
        const dx = hs.x + hs.door + 1, y1 = hs.top + hs.h;
        let y = y1;
        while (y < H && y - y1 < 6 && !road[y * W + dx] && !plaza[y * W + dx]) y++;
        if (y < H && (road[y * W + dx] || plaza[y * W + dx])) for (let j = y1; j < y; j++) pix.set(dx, j, 29);
      }
      const shade = (x, y) => { if (inb(x, y)) { const c = pix.get(x, y); if (SHADE[c] !== undefined) pix.set(x, y, SHADE[c]); } };
      for (const hs of houses) {
        for (let j = hs.top + 2; j <= hs.top + hs.h; j++) { shade(hs.x + hs.w, j); shade(hs.x + hs.w + 1, j); }
        for (let i = hs.x + 2; i < hs.x + hs.w; i++) shade(i, hs.top + hs.h);
      }
      for (const t of trees) for (let i = -t.rr + 1; i <= t.rr + 1; i++) { shade(t.x + i, t.y); if (Math.abs(i) < t.rr) shade(t.x + i + 1, t.y + 1); }

      // things that stand up, back to front
      const objs = [];
      for (const hs of houses) objs.push({ y: hs.top + hs.h, f: () => house(pix, hs) });
      for (const t of trees) objs.push({ y: t.y, f: () => tree(pix, t.x, t.y, t.rr) });
      objs.push({ y: py + 3, f: () => well(pix, px - 3, py - 2) });
      for (const s of [-1, 1]) {
        const sx = px + (s < 0 ? -12 : 6), sy = py - 7;
        if (plaza[sy * W + sx] && plaza[(sy + 4) * W + sx + 5]) objs.push({ y: sy + 4, f: () => stall(pix, sx, sy, s < 0 ? 10 : 22) });
      }
      objs.sort((a, b) => a.y - b.y).forEach(o => o.f());
      return pix;
    }
    function house(pix, hs) {
      const { x, top, w, rd, roof } = hs, wy = top + rd;
      for (let j = 0; j < 4; j++) for (let i = 1; i < w - 1; i++) {
        let c = j === 0 ? (hs.wall === 7 ? 6 : 28) : hs.wall;
        if (i === 1 || i === w - 2 || j === 3) c = 0;
        pix.set(x + i, wy + j, c);
      }
      const d = x + hs.door;
      pix.rect(d, wy + 1, 2, 3, 27); pix.set(d + 1, wy + 2, 26);
      for (const wx of [x + 3, x + w - 5]) if (Math.abs(wx - d) > 2) { pix.set(wx, wy + 1, 24); pix.set(wx + 1, wy + 1, 22); pix.set(wx, wy + 2, 22); pix.set(wx + 1, wy + 2, 21); }
      // a gable roof seen from above: the far slope catches the light, the near slope is in shade with rows of shingles
      const ridge = top + ((rd * 0.42) | 0);
      for (let j = 0; j < rd; j++) for (let i = 0; i < w; i++) {
        const y = top + j;
        let c;
        if (i === 0 || i === w - 1 || j === 0 || j === rd - 1) c = 0;
        else if (y < ridge) c = roof[2];
        else if (y === ridge) c = roof[1];
        else c = (y - ridge) % 2 === 0 && (i + y) % 3 === 0 ? roof[0] : roof[1];
        pix.set(x + i, y, c);
      }
      if (hs.chim) { const cx = x + w - 4; pix.rect(cx - 1, top - 2, 3, 4, 0); pix.set(cx, top - 1, 4); pix.set(cx, top, 3); }
    }
    function tree(pix, x, y, rr) {
      pix.set(x, y, 26); pix.set(x, y - 1, 27); pix.set(x - 1, y, 0); pix.set(x + 1, y, 0);
      const cy = y - 2 - rr;
      const inside = (dx, dy) => dx * dx + dy * dy <= rr * rr + rr * 0.6;
      for (let dy = -rr - 1; dy <= rr + 1; dy++) for (let dx = -rr - 1; dx <= rr + 1; dx++) {
        if (!inside(dx, dy)) continue;
        const edge = !inside(dx - 1, dy) || !inside(dx + 1, dy) || !inside(dx, dy - 1) || !inside(dx, dy + 1);
        pix.set(x + dx, cy + dy, edge ? 14 : dx + dy <= -rr + 0.5 ? 18 : dx + dy >= rr - 0.5 ? 15 : 16);
      }
    }
    function well(pix, x, y) {
      sprite(pix, ['.kkkkk.', 'k66666k', 'k6www6k', 'k5wvw5k', 'k55555k', '.kkkkk.'], { k: 0, 6: 6, 5: 5, w: 21, v: 22 }, x, y);
    }
    function stall(pix, x, y, c) {
      sprite(pix, ['kkkkkk', 'acacac', 'kkkkkk', 'pbbbbp', 'pbbbbp'], { k: 0, a: c, c: 7, p: 27, b: 28 }, x, y);
    }
    const bar = Kit.bar(host);
    bar.seed(seed, s => { seed = s; cv.put(gen()); });
    cv.put(gen());
  });

  // =====================================================================================
  // 6. poisson: the same number of things scattered three ways.
  // =====================================================================================
  Kit.register('poisson', { title: 'Scattering: random, jittered grid, Poisson disk', fit: 'prebake' }, host => {
    const PWD = 52, PH = 64, GAP = 2, W = PWD * 3 + GAP * 2, H = PH + 9;
    const cv = Kit.canvas(host, W, H);
    let seed = 3, rad = 7, show = false;
    function bridson(r, w, h, rd, k = 30) {
      const cell = rd / Math.SQRT2, gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
      const grid = new Int32Array(gw * gh).fill(-1), pts = [], active = [];
      const add = (x, y) => { pts.push([x, y]); active.push(pts.length - 1); grid[((y / cell) | 0) * gw + ((x / cell) | 0)] = pts.length - 1; };
      add(r.range(0, w), r.range(0, h));
      while (active.length) {
        const ai = r.int(0, active.length - 1), [px, py] = pts[active[ai]];
        let found = false;
        for (let t = 0; t < k && !found; t++) {
          const a = r() * Math.PI * 2, d = rd * (1 + r());
          const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const gx = (x / cell) | 0, gy = (y / cell) | 0;
          let ok = true;
          for (let j = Math.max(0, gy - 2); j <= Math.min(gh - 1, gy + 2) && ok; j++) for (let i = Math.max(0, gx - 2); i <= Math.min(gw - 1, gx + 2); i++) {
            const q = grid[j * gw + i];
            if (q >= 0 && (pts[q][0] - x) ** 2 + (pts[q][1] - y) ** 2 < rd * rd) { ok = false; break; }
          }
          if (ok) { add(x, y); found = true; }
        }
        if (!found) { active[ai] = active[active.length - 1]; active.pop(); }
      }
      return pts;
    }
    const SPR = [
      [['.kkk.', 'kfhfk', 'kfffk', 'kdffk', '.kdk.', '..t..', '..t..'], 2, 6], // tree, anchored at its trunk
      [['.kk.', 'kffk', 'kkkk'], 2, 2], // bush
      [['.kk.', 'kllk', 'kmmk', '.kk.'], 2, 3], // rock
      [['.a.', 'aya', '.g.'], 1, 2], // flower
    ];
    const KEY = { k: 14, f: 16, h: 18, d: 15, t: 27, l: 6, m: 5, a: 31, y: 13, g: 16 };
    const KEYS = [KEY, Object.assign({}, KEY, { f: 17 }), Object.assign({}, KEY, { k: 1 }), KEY];
    let noteEl;
    function draw() {
      const r = Kit.rng(seed);
      const poisson = bridson(Kit.rng(seed + 1), PWD, PH, rad), n = poisson.length;
      const random = [];
      for (let i = 0; i < n; i++) random.push([r.range(0, PWD), r.range(0, PH)]);
      const s = Math.sqrt(PWD * PH / n), cols = Math.max(1, Math.round(PWD / s)), rows = Math.max(1, Math.round(PH / s));
      const jitter = [];
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) jitter.push([(i + r()) * PWD / cols, (j + r()) * PH / rows]);
      const pix = new Kit.Pix(W, H).fill(1);
      const close = [];
      [random, jitter, poisson].forEach((pts, p) => {
        const ox = p * (PWD + GAP), clip = [ox, 0, ox + PWD, PH];
        pix.rect(ox, 0, PWD, PH, 17);
        // too close: nearer than 70% of the Poisson spacing to another point
        const bad = pts.map((a, i) => pts.some((b, j) => j !== i && (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 < (rad * 0.7) ** 2));
        close.push(bad.filter(Boolean).length);
        const order = pts.map((q, i) => i).sort((a, b) => pts[a][1] - pts[b][1]);
        for (const i of order) {
          const [x, y] = pts[i], kind = Math.floor(Kit.hash2(i, p === 2 ? 0 : 0, seed + 7) * 100);
          const t = kind < 40 ? 0 : kind < 65 ? 1 : kind < 85 ? 2 : 3;
          const [rows_, ax, ay] = SPR[t], X = Math.round(ox + x), Y = Math.round(y);
          if (show && bad[i]) for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { // a red ring
            const d2 = dx * dx + dy * dy;
            if (d2 >= 13 && d2 <= 22 && X + dx >= clip[0] && X + dx < clip[2] && Y - 2 + dy < PH) pix.set(X + dx, Y - 2 + dy, 11);
          }
          if (t === 0) for (let k = 0; k < 3; k++) if (X + k < clip[2]) pix.set(X + k, Y, 15); // a short shadow
          sprite(pix, rows_, KEYS[t], X - ax, Y - ay, clip);
        }
        const label = ['RANDOM', 'JITTERED', 'POISSON'][p];
        textPix(pix, label, ox + ((PWD - textW(label)) >> 1), PH + 2, 6);
      });
      cv.put(pix);
      noteEl.textContent = `${n} objects in each panel. Too close (under 70% of the spacing): random ${close[0]}, jittered ${close[1]}, Poisson ${close[2]}.`;
    }
    const bar = Kit.bar(host);
    bar.seed(seed, v => { seed = v; draw(); });
    bar.slider('Spacing', 5, 10, 1, rad, v => { rad = v; draw(); });
    bar.check('Mark crowding', show, v => { show = v; draw(); });
    noteEl = Kit.bar(host).note('');
    draw();
  });

})();
