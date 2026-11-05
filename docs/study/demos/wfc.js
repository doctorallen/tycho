// wfc.js: Wave function collapse, tile by tile. A study demo, using worlds-shared.js.
(() => {
  const { PAL, clamp, D4, bake, sprite, seedCtl } = StudyShared.worlds;
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
})();
