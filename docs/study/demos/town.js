// town.js: Village: roads, lots, houses, fields. A study demo, using worlds-shared.js.
(() => {
  const { clamp, fbm, sprite, bfs } = StudyShared.worlds;
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
})();
