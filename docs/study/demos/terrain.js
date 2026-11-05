// terrain.js: Island terrain: warped noise, falloff, biomes, rivers. A study demo, using worlds-shared.js.
(() => {
  const { clamp, D4, D8, fbm, legend } = StudyShared.worlds;
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
})();
