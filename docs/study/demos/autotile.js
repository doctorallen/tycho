// autotile.js: Autotiling: marching squares and the dual grid. A study demo, using worlds-shared.js.
(() => {
  const { PAL, clamp, fbm, bake, textG } = StudyShared.worlds;
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
})();
